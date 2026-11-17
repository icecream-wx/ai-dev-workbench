/**
 * 需求阶段 AI 参考原型（M7-2 / #8 v2）
 *
 * 用户明确：M7 的“纯骨架”没有评审价值，要按需求阶段已确认的实体/字段生成参考原型；
 * 且**需求阶段原型预览不作为设计阶段页面集来源**（单向、只读）。
 *
 * 因此本模块只做一件事：把模块 PRD 交给需求阶段 agent，产出“预览规格”
 * （实体/字段/页面），归一化后写 `app_settings` 的
 * `app.<appId>.requirementsPrototype.<moduleId>` 一个键。
 *
 * 硬约束（违反即缺陷）：
 * - 唯一写入 = 上述 settings 键；不写需求/设计/交接包/Change Set/阶段/会话/PNG；
 * - 输入只读：模块行、PRD 章节、活跃 Epics/Stories、原型模板元信息、应用名；
 *   不读设计实体/页面集/页面（模板解析只解析模板 id，不涉及设计内容）；
 * - 失败/取消不写库（保留旧规格）；
 * - 并发：模块级进程内锁（单实例工作台可接受）。
 *
 * 单测通过 `options.generator` 或 `setPrototypeSpecGeneratorForTests` 注入模型输出，
 * 生产路由不暴露 generator。
 */
import fs from 'node:fs'
import { nowIso, readSetting, writeSetting } from '../db'
import { appDirOf, ensureAppAgents } from '../apps/scaffold'
import { appPrototypeTemplate } from '../apps/template-resolution'
import { opencode } from '../opencode/runtime'
import { redact } from '../opencode/redact'
import { resolveChatModel } from '../chat/service'
import { RequirementDocError } from './templates'
import { readRequirementDocIfExists } from './doc'
import { appRowOrThrow, assertModuleWritable, defaultModule, moduleOrThrow, type ModuleRow } from './modules'
import type { PrototypePageSetRules, PrototypePatterns } from '../design/types'
import type { RequirementDoc, RequirementDocSection, RequirementEpic, RequirementStory } from './types'

export const PREVIEW_SPEC_DELIMITER = '<<<PREVIEW_SPEC_JSON>>>'
export const PREVIEW_SPEC_SCHEMA = 'requirements-prototype/1'

/** 单章节 / 文档总计输入上限（超限截断并写 note） */
export const SPEC_SECTION_LIMIT = 6_000
export const SPEC_TOTAL_LIMIT = 40_000
/** 归一化上限 */
export const SPEC_MAX_ENTITIES = 30
export const SPEC_MAX_FIELDS = 40
export const SPEC_MAX_PAGES = 80
export const SPEC_MAX_ACTIONS = 8
export const SPEC_MAX_OPTIONS = 20
export const SPEC_MAX_NOTES = 40
export const SPEC_TEXT_LIMIT = 200
export const SPEC_NOTE_LIMIT = 300
/** 单次生成超时（非 SSE） */
export const SPEC_GENERATE_TIMEOUT_MS = 120_000

export type SpecFieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'time'
  | 'boolean'
  | 'enum'
  | 'ref'

const FIELD_TYPES: readonly SpecFieldType[] = [
  'string',
  'text',
  'number',
  'decimal',
  'date',
  'datetime',
  'time',
  'boolean',
  'enum',
  'ref'
]

export type SpecPageType =
  | 'list'
  | 'form'
  | 'detail'
  | 'dashboard'
  | 'kanban'
  | 'calendar'
  | 'gantt'
  | 'custom'

const PAGE_TYPES: readonly SpecPageType[] = ['list', 'form', 'detail', 'dashboard', 'kanban', 'calendar', 'gantt', 'custom']

export interface PrototypeSpecEntityField {
  /** 服务端由 label 生成的稳定 ASCII key（渲染器列名/行数据键） */
  name: string
  label: string
  type: SpecFieldType
  required?: boolean
  unique?: boolean
  options?: string[]
  /** ref：目标实体 id（PE-n） */
  target?: string
  note?: string
}

export interface PrototypeSpecEntity {
  id: string
  name: string
  description: string
  fields: PrototypeSpecEntityField[]
}

export interface PrototypeSpecPage {
  id: string
  title: string
  type: SpecPageType
  epicId: string | null
  storyIds: string[]
  entityId: string | null
  /** 页面使用的实体字段 name（渲染器据此筛列/表单字段） */
  fields: string[]
  actions: string[]
}

export interface PrototypeSpec {
  schema: typeof PREVIEW_SPEC_SCHEMA
  generatedAt: string
  model: string | null
  base: { docVersion: number; docUpdatedAt: string | null }
  entities: PrototypeSpecEntity[]
  pages: PrototypeSpecPage[]
  notes: string[]
  stats: { entities: number; fields: number; pages: number }
}

export interface PrototypeSpecCoverage {
  stories: number
  coveredStories: number
  uncoveredStoryIds: string[]
}

export type PrototypeSpecStatus = 'missing' | 'ready' | 'stale'
export type PrototypeSpecStaleReason = 'doc-changed' | null

export interface PrototypeSpecState {
  status: PrototypeSpecStatus
  staleReason: PrototypeSpecStaleReason
  coverage: PrototypeSpecCoverage
}

/** GET 响应增量字段（M7 其余字段保持不变） */
export interface PrototypeSpecView {
  spec: PrototypeSpec | null
  specState: PrototypeSpecState
}

export interface PrototypeSpecPromptInput {
  appName: string
  module: { id: string; key: string; title: string; description: string }
  template: {
    name: string
    description: string
    patterns: PrototypePatterns
    pageSetRules: PrototypePageSetRules
  }
  sections: Array<{ title: string; kind: string; markdown: string }>
  epics: Array<{ id: string; title: string; goal: string; priority: string }>
  stories: Array<{
    id: string
    epicId: string | null
    title: string
    description: string
    acceptance: string[]
    priority: string
  }>
  /** 输入聚合阶段的截断说明（最终合并进 spec.notes） */
  notes: string[]
  prompt: string
}

/** 解析/归一化上下文（当前模块事实 + 生成基线） */
export interface SpecNormalizeContext {
  epics: RequirementEpic[]
  stories: RequirementStory[]
  docVersion: number
  docUpdatedAt: string | null
  model?: string | null
  generatedAt?: string
  extraNotes?: string[]
}

export interface PrototypeSpecSource {
  module: ModuleRow
  doc: RequirementDoc | null
  sections: RequirementDocSection[]
  epics: RequirementEpic[]
  stories: RequirementStory[]
  contentChars: number
  notes: string[]
  input: PrototypeSpecPromptInput
}

// ---------------------------------------------------------------- utils

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const list: string[] = []
  for (const item of value) {
    const text = asString(item)
    if (!text || seen.has(text)) continue
    seen.add(text)
    list.push(text.length > SPEC_TEXT_LIMIT ? text.slice(0, SPEC_TEXT_LIMIT) : text)
    if (list.length >= limit) break
  }
  return list
}

function clip(text: string, limit: number): string {
  const value = String(text ?? '').trim()
  return value.length > limit ? value.slice(0, limit) : value
}

function note(text: string): string {
  return clip(text, SPEC_NOTE_LIMIT)
}

function uniqueNotes(list: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of list) {
    const text = note(item)
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
    if (result.length >= SPEC_MAX_NOTES) break
  }
  return result
}

/** settings 键（唯一写入点；导出便于测试断言） */
export function prototypeSpecSettingKey(appId: string, moduleId: string): string {
  return `app.${appId}.requirementsPrototype.${moduleId}`
}

// ---------------------------------------------------------------- 输入聚合（只读）

function emptyOutline(): { epics: RequirementEpic[]; stories: RequirementStory[] } {
  const epics: RequirementEpic[] = []
  const stories: RequirementStory[] = []
  return { epics, stories }
}

/** 合并所有结构化章节的 epics/stories，过滤 archived（与 M7 预览同口径） */
export function outlineOfSections(sections: RequirementDocSection[]): { epics: RequirementEpic[]; stories: RequirementStory[] } {
  const merged = emptyOutline()
  for (const section of sections) {
    const data = section.data ?? null
    if (!data) continue
    merged.epics.push(...(Array.isArray(data.epics) ? data.epics : []))
    merged.stories.push(...(Array.isArray(data.stories) ? data.stories : []))
  }
  return {
    epics: merged.epics.filter(epic => epic && !epic.archived),
    stories: merged.stories.filter(story => story && !story.archived)
  }
}

interface TruncatedSection {
  title: string
  kind: string
  markdown: string
}

function sectionLines(sections: RequirementDocSection[]): {
  sections: TruncatedSection[]
  lines: string[]
  notes: string[]
  total: number
  contentChars: number
} {
  const notes: string[] = []
  const lines: string[] = []
  const kept: TruncatedSection[] = []
  let total = 0
  let contentChars = 0
  let sectionTruncated = 0
  let totalTruncated = false
  for (const section of sections) {
    let body = String(section.markdown ?? '').trim()
    if (!body) continue
    contentChars += body.length
    if (body.length > SPEC_SECTION_LIMIT) {
      body = `${body.slice(0, SPEC_SECTION_LIMIT)}\n（本章节内容过长，已截断）`
      sectionTruncated += 1
    }
    const block = `### ${section.title}（${section.kind}）\n${body}`
    if (total + block.length > SPEC_TOTAL_LIMIT) {
      totalTruncated = true
      continue
    }
    total += block.length
    lines.push(block)
    kept.push({ title: section.title, kind: section.kind, markdown: body })
  }
  if (sectionTruncated) notes.push(`${sectionTruncated} 个章节内容过长已截断（单章节上限 6KB）`)
  if (totalTruncated) notes.push('需求文档内容超过 40KB，已截断（建议拆分模块或精简章节）')
  return { sections: kept, lines, notes, total, contentChars }
}

function epicLines(
  epics: PrototypeSpecPromptInput['epics'],
  stories: PrototypeSpecPromptInput['stories']
): string[] {
  if (!epics.length) return ['（当前模块还没有 Epic / Story；页面无法挂到 Epic 时请把 epicId 留空）']
  const lines: string[] = []
  for (const epic of epics) {
    lines.push(`- ${epic.id} ${asString(epic.title)}${epic.goal ? `（目标：${clip(epic.goal, SPEC_TEXT_LIMIT)}）` : ''}${epic.priority ? `；优先级 ${epic.priority}` : ''}`)
    const own = stories.filter(story => story.epicId === epic.id)
    for (const story of own) {
      const extras: string[] = []
      if (story.description) extras.push(clip(story.description, SPEC_TEXT_LIMIT))
      if (story.acceptance?.length) extras.push(`验收：${story.acceptance.slice(0, 6).map(item => clip(item, SPEC_TEXT_LIMIT)).join('；')}`)
      if (story.priority) extras.push(`优先级 ${story.priority}`)
      lines.push(`  - ${story.id} ${asString(story.title)}${extras.length ? `：${extras.join('；')}` : ''}`)
    }
  }
  const orphans = stories.filter(story => !story.epicId || !epics.some(epic => epic.id === story.epicId))
  if (orphans.length) {
    lines.push('### 未归属 Story')
    for (const story of orphans) lines.push(`- ${story.id} ${asString(story.title)}（未归属 Epic）`)
  }
  return lines
}

/**
 * 聚合生成输入（只读；不建模块/文档/版本；不读设计实体/页面集）。
 * 显式 moduleId 必须存在（404）；文档缺失返回 doc:null 由调用方给守卫错误。
 */
export function collectPrototypeSpecSource(appId: string, moduleId: string): PrototypeSpecSource {
  const app = appRowOrThrow(appId)
  const module = moduleOrThrow(appId, moduleId)
  const read = readRequirementDocIfExists(appId, module.id)
  const outline = outlineOfSections(read.sections)
  const section = sectionLines(read.sections)
  const resolved = appPrototypeTemplate(appId, module.id)
  const template = resolved.template
  const input: PrototypeSpecPromptInput = {
    appName: app.name,
    module: {
      id: module.id,
      key: module.module_key,
      title: module.title,
      description: module.description ?? ''
    },
    template: {
      name: template.name,
      description: template.description,
      patterns: template.patterns,
      pageSetRules: template.pageSetRules
    },
    sections: section.sections,
    epics: outline.epics.map(epic => ({
      id: epic.id,
      title: asString(epic.title),
      goal: asString(epic.goal),
      priority: asString(epic.priority)
    })),
    stories: outline.stories.map(story => ({
      id: story.id,
      epicId: story.epicId ?? null,
      title: asString(story.title),
      description: asString(story.description),
      acceptance: Array.isArray(story.acceptance) ? story.acceptance.filter(Boolean) : [],
      priority: asString(story.priority)
    })),
    notes: section.notes,
    prompt: ''
  }
  input.prompt = buildPrototypeSpecPrompt(input, section.lines)
  return {
    module,
    doc: read.doc,
    sections: read.sections,
    epics: outline.epics,
    stories: outline.stories,
    contentChars: section.contentChars,
    notes: section.notes,
    input
  }
}

// ---------------------------------------------------------------- prompt

function pageSetRulesLines(rules: PrototypePageSetRules): string[] {
  const defaults = rules.defaultPages?.length ? rules.defaultPages.join('、') : '（无）'
  return [
    `- 默认页面：${defaults}`,
    `- 新建形态：${rules.createAs === 'dialog' ? '弹窗' : '独立页面'}；编辑形态：${rules.editAs === 'dialog' ? '弹窗' : '独立页面'}`,
    `- 列表默认每页 ${rules.defaultPageSize} 行；默认 ${rules.defaultSearchFields} 个查询条件`
  ]
}

function patternLines(patterns: PrototypePatterns): string[] {
  return [
    `- 列表：筛选 ${patterns.list.filters ? '有' : '无'}；行操作 ${patterns.list.rowActions ? '有' : '无'}；分页 ${patterns.list.pagination ? '有' : '无'}；多选 ${patterns.list.selection ? '有' : '无'}`,
    `- 表单：${patterns.form.presentation === 'dialog' ? '弹窗' : '页面'}形态；标签 ${patterns.form.labelPosition === 'left' ? '左对齐' : '顶部'}；分组 ${patterns.form.groups ? '有' : '无'}`,
    `- 详情：分区 ${patterns.detail.sections ? '有' : '无'}；关联列表 ${patterns.detail.relatedLists ? '有' : '无'}`
  ]
}

/**
 * 预览规格 prompt：PRD 事实 + 活跃 Epic/Story + 模板形态 + `<<<PREVIEW_SPEC_JSON>>>` 协议。
 * `sectionLines` 仅由 `collectPrototypeSpecSource` 传入（已按 6KB/40KB 截断）。
 */
export function buildPrototypeSpecPrompt(input: PrototypeSpecPromptInput, sectionBlocks?: string[]): string {
  const { appName, module, template, epics, stories } = input
  const blocks = sectionBlocks ?? input.sections.map(item => `### ${item.title}（${item.kind}）\n${item.markdown}`)
  const parts: string[] = [
    `你是需求原型 Agent。请基于应用「${appName}」当前模块「${module.title}」（${module.key}）的**需求文档事实**，产出一份用于需求评审的“参考原型规格”（实体/字段/页面）。`,
    '本轮只输出规格 JSON：不要创建/修改文件，不要执行命令，不要修改需求文档，不要写表结构、接口或代码。规格仅用于需求阶段预览，不会进入设计阶段或交接包。'
  ]

  parts.push(
    [
      '## 原型模板（决定页面形态，不决定字段）',
      `名称：${template.name}`,
      `说明：${template.description || '（无）'}`,
      '### 页面形态',
      ...patternLines(template.patterns),
      '### 页面集规则',
      ...pageSetRulesLines(template.pageSetRules)
    ].join('\n')
  )

  parts.push(
    [
      '## 当前模块需求文档（唯一事实来源）',
      module.description ? `模块说明：${module.description}` : '',
      blocks.length ? blocks.join('\n\n') : '（当前模块需求文档为空）'
    ]
      .filter(Boolean)
      .join('\n\n')
  )

  parts.push(['## 当前模块的结构化 Epics / Stories（页面必须挂到这些真实 ID）', ...epicLines(epics, stories)].join('\n'))

  parts.push(
    [
      '## 生成规则（必须遵守）',
      '1. 实体与字段**只能来自文档事实**（尤其是「业务规则与数据要求」「页面与交互需求」「Epics & User Stories」里的字段表、规则、状态）；文档没有的字段不要编造，缺失/待确认项写进 `notes`。',
      '2. 文档里的「> 待确认」「待定」「TBD」一律进 `notes`，不要当成确定字段。',
      '3. 字段 `type` ∈ string|text|number|decimal|date|datetime|time|boolean|enum|ref；金额/单价/数量等用 decimal/number；仅当文档给出明确枚举值时用 enum，并且必须给 `options`。',
      '4. 字段用中文业务名写 `label`（如“商品编码”“订单状态”）；不要写英文列名、不要写表结构/SQL/接口。',
      '5. 跨实体引用用 `type="ref"`，并用 `target` 写目标实体名称（必须是本规格里的另一个实体；不要指向其它模块）。',
      '6. 每个实体给出 3—15 个最有评审价值的字段；`required`/`unique` 仅在文档有依据时标注；字段规则写 `note`（如“4—32 位”）。',
      '7. 页面优先对齐「页面与交互需求」的页面清单；`pages[].type` ∈ list|form|detail|dashboard|kanban|calendar|gantt|custom；页面形态遵循模板形态（如企业级：列表 + 表单弹窗 + 详情分区）。',
      '8. 每个 Epic **至少 1 个列表页**；页面用真实 `epicId` 归属，尽量把对应 Story 放进 `storyIds`；实在挂不上的留空。',
      '9. 页面用 `entity` 写实体名称（必须是本规格实体），`fields` 写该实体字段的 `label` 列表（不要写英文 name）；`actions` 用中文动作名（如 新增/编辑/删除/导出/提交）。',
      '10. 不要把其它模块的业务写进来；不要虚构用户没有提到的报表/支付/审批等。',
      '11. 实体最多 30 个、每实体字段最多 40 个、页面最多 80 个；超出会被截断。'
    ].join('\n')
  )

  parts.push(
    [
      '## 输出协议',
      '**只输出一个合法 JSON 对象**：第一个非空字符必须是 `{`，最后一个非空字符必须是 `}`。',
      'JSON 之后不得有任何文字（不要说“好的”“以下是规格”，不要输出总结）；不允许 markdown 围栏（```）、注释、尾逗号；字符串内的换行必须转义为 `\\n`。',
      `可选：在 JSON 之前单独一行输出 ${PREVIEW_SPEC_DELIMITER}（仅便于调试，不是必需；除 JSON 外不要再输出其它 JSON）。`,
      '对象结构：',
      '{',
      '  "entities": [',
      '    {',
      '      "name": "商品档案",',
      '      "description": "商品主数据",',
      '      "fields": [',
      '        { "label": "商品编码", "type": "string", "required": true, "unique": true, "note": "4—32 位" },',
      '        { "label": "商品状态", "type": "enum", "required": true, "options": ["上架", "下架"] },',
      '        { "label": "商品分类", "type": "ref", "target": "商品分类" }',
      '      ]',
      '    }',
      '  ],',
      '  "pages": [',
      '    {',
      '      "title": "商品列表",',
      '      "type": "list",',
      '      "epicId": "EPIC-001",',
      '      "storyIds": ["STORY-001"],',
      '      "entity": "商品档案",',
      '      "fields": ["商品编码", "商品状态"],',
      '      "actions": ["新增", "编辑", "删除"]',
      '    }',
      '  ],',
      '  "notes": ["库存归属在商品档案还是明细待确认"]',
      '}',
      '再次强调：只输出上面这一个 JSON 对象本身（首个非空字符 `{`、末个非空字符 `}`），不要围栏/注释/尾逗号，不要输出 JSON 之外的任何说明文字。'
    ].join('\n')
  )

  return parts.join('\n\n')
}

// ---------------------------------------------------------------- 解析 / 归一化

/**
 * 预处理：去 BOM；去掉任意位置的 ```json … ``` 围栏；`\r\n` → `\n`。
 * 不做括号补全（截断输出宁可解析失败）。
 */
export function preprocessSpecOutput(raw: string): string {
  let text = String(raw ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
  if (text.includes('```')) {
    text = text.replace(/```[a-zA-Z0-9_-]*[ \t]*\n?([\s\S]*?)```/g, (_match, body: string) => `\n${body}\n`)
  }
  return text
}

/** 后缀候选起点上限：只对最靠后的 N 个 `{` 起点单独试匹配（控制解析开销） */
export const SPEC_MAX_CANDIDATE_STARTS = 60
/** 单个 JSON 候选长度上限（超出直接跳过，避免超大输出的解析开销） */
export const SPEC_MAX_JSON_CANDIDATE_CHARS = 200_000

/** 字符串外的 `{` 起点（升序） */
function unquotedBraceStarts(text: string): number[] {
  const starts: number[] = []
  let inString = false
  let escaped = false
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') starts.push(index)
  }
  return starts
}

/**
 * 从 `start`（必须是 `{`）起做字符串感知的深度匹配，返回匹配 `}` 的下标；
 * 未闭合（截断）返回 -1（不补括号）。
 */
function matchClosingBrace(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const ch = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      depth += 1
      continue
    }
    if (ch === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

interface JsonCandidateSpan {
  from: number
  to: number
  /** 顶层完整对象（深度 0 → 0）；后缀抢救候选为 false */
  topLevel: boolean
}

/**
 * 平衡括号候选（按 start 升序；调用方从后往前尝试）：
 *
 * 1. **顶层**候选：忽略字符串内 `{}`，收集所有完整的顶层 `{…}`；
 * 2. **后缀**候选：再对每个字符串外 `{` 起点（只看最靠后的 N 个）单独做深度匹配，
 *    这样前面即使有**未闭合残片**，后面完整的 JSON 仍能被找到（残片起点匹配不到 `}` 被跳过）；
 * 3. 去掉被其它候选包含的嵌套对象（避免内层 `{…}` 冒充规格抢走解析）；
 * 4. 超长候选（> 200KB）跳过。
 */
function specJsonCandidateSpans(text: string): JsonCandidateSpan[] {
  const value = String(text ?? '')
  const spans = new Map<number, JsonCandidateSpan>()

  // 1) 顶层（深度 0 → 0）
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false
  for (let index = 0; index < value.length; index += 1) {
    const ch = value[index]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') {
      if (depth === 0) start = index
      depth += 1
      continue
    }
    if (ch === '}') {
      if (depth === 0) continue
      depth -= 1
      if (depth === 0 && start >= 0) {
        spans.set(start, { from: start, to: index, topLevel: true })
        start = -1
      }
    }
  }

  // 2) 后缀候选：容忍前面有未闭合残片（后 N 个起点）
  for (const braceStart of unquotedBraceStarts(value).slice(-SPEC_MAX_CANDIDATE_STARTS)) {
    if (spans.has(braceStart)) continue
    const end = matchClosingBrace(value, braceStart)
    if (end >= 0) spans.set(braceStart, { from: braceStart, to: end, topLevel: false })
  }

  // 3) 只保留最外层候选（去掉被包含的嵌套对象），按 start 升序
  const entries = [...spans.values()].sort((a, b) => a.from - b.from)
  return entries.filter(
    entry => !entries.some(other => other.from < entry.from && other.to > entry.to)
  )
}

/** 候选 JSON 文本（升序；调用方从后往前尝试）；见 `specJsonCandidateSpans` */
export function balancedObjectCandidates(text: string): string[] {
  const value = String(text ?? '')
  return specJsonCandidateSpans(value)
    .map(span => value.slice(span.from, span.to + 1))
    .filter(candidate => candidate.length <= SPEC_MAX_JSON_CANDIDATE_CHARS)
}

/** 去掉尾逗号（字符串内的 `,` 不动） */
function stripTrailingCommas(text: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index]
    if (inString) {
      out += ch
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
      continue
    }
    if (ch === ',') {
      let next = index + 1
      while (next < text.length && /\s/.test(text[next])) next += 1
      if (text[next] === '}' || text[next] === ']') continue
    }
    out += ch
  }
  return out
}

/** 字符串内未转义换行/制表符 → 合法转义（JSON 不允许裸换行） */
function escapeNewlinesInStrings(text: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        out += ch
        escaped = false
        continue
      }
      if (ch === '\\') {
        out += ch
        escaped = true
        continue
      }
      if (ch === '"') {
        out += ch
        inString = false
        continue
      }
      if (ch === '\n') {
        out += '\\n'
        continue
      }
      if (ch === '\r') {
        out += '\\r'
        continue
      }
      if (ch === '\t') {
        out += '\\t'
        continue
      }
      out += ch
      continue
    }
    if (ch === '"') inString = true
    out += ch
  }
  return out
}

/** 单个候选：原样 → 去尾逗号 → 修未转义换行 → 全角引号兜底（仅最后手段） */
export function parseJsonObjectCandidate(text: string): Record<string, unknown> | null {
  const base = String(text ?? '').trim()
  if (!base) return null
  const variants: string[] = [base]
  const comma = stripTrailingCommas(base)
  if (comma !== base) variants.push(comma)
  const escaped = escapeNewlinesInStrings(comma)
  if (escaped !== base && escaped !== comma) variants.push(escaped)
  if (/[“”]/.test(base)) {
    const ascii = comma.replace(/[“”]/g, '"')
    variants.push(escapeNewlinesInStrings(ascii))
  }
  for (const variant of variants) {
    try {
      const parsed = JSON.parse(variant) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      // 试下一个变体
    }
  }
  return null
}

function looksLikeSpec(value: Record<string, unknown>): boolean {
  return Array.isArray(value.entities) || Array.isArray(value.pages)
}

/**
 * 从原始输出中取规格对象：分隔符之后的候选优先，**从后往前**逐个尝试
 * （最靠近末尾的规格对象优先）；都失败时退回最后一个**顶层完整**对象
 * （便于给归一化文案；截断残片里的内层对象不作为回退，避免误报）。
 */
export function parseSpecObject(raw: string): Record<string, unknown> | null {
  const text = preprocessSpecOutput(raw)
  const index = text.indexOf(PREVIEW_SPEC_DELIMITER)
  const segments = index >= 0 ? [text.slice(index + PREVIEW_SPEC_DELIMITER.length), text] : [text]
  let fallback: Record<string, unknown> | null = null
  for (const segment of segments) {
    const spans = specJsonCandidateSpans(segment)
    for (let position = spans.length - 1; position >= 0; position -= 1) {
      const span = spans[position]
      const candidate = segment.slice(span.from, span.to + 1)
      if (candidate.length > SPEC_MAX_JSON_CANDIDATE_CHARS) continue
      const parsed = parseJsonObjectCandidate(candidate)
      if (!parsed) continue
      if (looksLikeSpec(parsed)) return parsed
      if (!fallback && span.topLevel) fallback = parsed
    }
  }
  return fallback
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function fieldTypeOf(value: unknown): SpecFieldType {
  const raw = asString(value).toLowerCase()
  return (FIELD_TYPES as readonly string[]).includes(raw) ? (raw as SpecFieldType) : 'string'
}

function pageTypeOf(value: unknown): SpecPageType {
  const raw = asString(value).toLowerCase()
  return (PAGE_TYPES as readonly string[]).includes(raw) ? (raw as SpecPageType) : 'custom'
}

/** label → 稳定 ASCII key（无可用字符时按序号 fieldN；同实体内去重） */
function fieldNameOf(label: string, index: number, used: Set<string>): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  let name = base || `field${index + 1}`
  if (base && /^[0-9]/.test(name)) name = `f_${name}`
  let candidate = name
  let suffix = 2
  while (used.has(candidate)) {
    candidate = `${name}_${suffix}`
    suffix += 1
  }
  used.add(candidate)
  return candidate
}

interface RawEntityField {
  label: string
  type: SpecFieldType
  required?: boolean
  unique?: boolean
  options?: string[]
  targetLabel?: string
  note?: string
}

interface RawEntity {
  name: string
  description: string
  fields: RawEntityField[]
}

/** 实体/字段：去空白、去重合并（后面的非空属性补齐） */
function normalizeRawEntities(value: unknown, notes: string[]): RawEntity[] {
  if (!Array.isArray(value)) return []
  const entities = new Map<string, RawEntity>()
  let dropped = 0
  for (const item of value) {
    const row = asRecord(item)
    const name = clip(asString(row.name), SPEC_TEXT_LIMIT)
    if (!name) {
      dropped += 1
      continue
    }
    const key = name.toLowerCase()
    const existing = entities.get(key)
    const fields = normalizeRawFields(row.fields, name, notes)
    if (existing) {
      const seen = new Map(existing.fields.map(field => [field.label.toLowerCase(), field]))
      for (const field of fields) {
        const target = seen.get(field.label.toLowerCase())
        if (!target) {
          existing.fields.push(field)
          continue
        }
        target.type = target.type === 'string' && field.type !== 'string' ? field.type : target.type
        target.required = target.required || field.required || undefined
        target.unique = target.unique || field.unique || undefined
        if (!target.options?.length && field.options?.length) target.options = field.options
        if (!target.targetLabel && field.targetLabel) target.targetLabel = field.targetLabel
        if (!target.note && field.note) target.note = field.note
      }
      if (!existing.description && asString(row.description)) existing.description = clip(asString(row.description), SPEC_TEXT_LIMIT)
    } else {
      entities.set(key, {
        name,
        description: clip(asString(row.description), SPEC_TEXT_LIMIT),
        fields
      })
    }
  }
  if (dropped) notes.push(`${dropped} 个实体缺少名称，已忽略`)
  return [...entities.values()]
}

/** 字段：label 去空白、同名合并（后出现的非空属性补齐） */
function normalizeRawFields(value: unknown, entityName: string, notes: string[]): RawEntityField[] {
  if (!Array.isArray(value)) return []
  const fields = new Map<string, RawEntityField>()
  for (const item of value) {
    const row = asRecord(item)
    const label = clip(asString(row.label) || asString(row.name), SPEC_TEXT_LIMIT)
    if (!label) continue
    const rawType = asString(row.type).toLowerCase()
    let type = fieldTypeOf(rawType)
    const options = asStringList(row.options, SPEC_MAX_OPTIONS)
    const targetLabel = clip(asString(row.target) || asString(row.ref) || asString(row.entity), SPEC_TEXT_LIMIT)
    if (rawType && !(FIELD_TYPES as readonly string[]).includes(rawType)) {
      notes.push(`「${entityName} · ${label}」类型 ${rawType} 不受支持，已按 string 处理`)
    }
    if (type === 'enum' && !options.length) {
      notes.push(`「${entityName} · ${label}」是 enum 但缺少 options，已按 string 处理`)
      type = 'string'
    }
    const next: RawEntityField = {
      label,
      type,
      ...(row.required === true || row.required === 1 ? { required: true } : {}),
      ...(row.unique === true || row.unique === 1 ? { unique: true } : {}),
      ...(type === 'enum' && options.length ? { options } : {}),
      ...(type === 'ref' && targetLabel ? { targetLabel } : {}),
      ...(asString(row.note) ? { note: clip(asString(row.note), SPEC_NOTE_LIMIT) } : {})
    }
    const key = label.toLowerCase()
    const existing = fields.get(key)
    if (!existing) {
      fields.set(key, next)
      continue
    }
    if (existing.type === 'string' && next.type !== 'string') existing.type = next.type
    existing.required = existing.required || next.required || undefined
    existing.unique = existing.unique || next.unique || undefined
    if (!existing.options?.length && next.options?.length) existing.options = next.options
    if (!existing.targetLabel && next.targetLabel) existing.targetLabel = next.targetLabel
    if (!existing.note && next.note) existing.note = next.note
  }
  return [...fields.values()]
}

/**
 * 解析/归一化模型输出。
 *
 * - 解析失败 → 502「原型生成结果无法解析，请重试」；
 * - 归一化后没有页面 → 502「模型没有产出可预览的页面，请重试」；
 * - id 一律服务端生成（忽略模型 id）；ref 指向本模块实体，否则降级 string + note。
 */
export function parsePrototypeSpecOutput(raw: string, context: SpecNormalizeContext): PrototypeSpec {
  const parsed = parseSpecObject(raw)
  if (!parsed) throw new RequirementDocError(502, '原型生成结果无法解析，请重试')

  const notes: string[] = [...(context.extraNotes ?? [])]
  const rawEntities = normalizeRawEntities(parsed.entities, notes).slice(0, SPEC_MAX_ENTITIES)
  if (Array.isArray(parsed.entities) && parsed.entities.length > SPEC_MAX_ENTITIES) {
    notes.push(`实体超过上限 ${SPEC_MAX_ENTITIES} 个，多出的已截断`)
  }

  const entities: PrototypeSpecEntity[] = rawEntities.map((entity, index) => {
    const id = `PE-${index + 1}`
    const used = new Set<string>()
    if (entity.fields.length > SPEC_MAX_FIELDS) {
      notes.push(`「${entity.name}」字段超过上限 ${SPEC_MAX_FIELDS} 个，多出的已截断`)
    }
    const fields = entity.fields.slice(0, SPEC_MAX_FIELDS).map((field, fieldIndex) => {
      const name = fieldNameOf(field.label, fieldIndex, used)
      return {
        name,
        label: field.label,
        type: field.type,
        ...(field.required ? { required: true } : {}),
        ...(field.unique ? { unique: true } : {}),
        ...(field.options?.length ? { options: field.options } : {}),
        ...(field.targetLabel ? { targetLabel: field.targetLabel } : {}),
        ...(field.note ? { note: field.note } : {})
      } as PrototypeSpecEntityField & { targetLabel?: string }
    })
    return { id, name: entity.name, description: entity.description, fields }
  })

  // ref 目标：按实体名称解析为本模块实体 id；悬空 → string + note
  const entityByName = new Map(entities.map(entity => [entity.name.toLowerCase(), entity]))
  for (const entity of entities) {
    for (const field of entity.fields as Array<PrototypeSpecEntityField & { targetLabel?: string }>) {
      if (field.type !== 'ref') continue
      const target = entityByName.get((field.targetLabel ?? '').toLowerCase())
      if (!target) {
        notes.push(`「${entity.name} · ${field.label}」ref 目标「${field.targetLabel || '未填'}」不在本模块实体中，已按 string 处理`)
        field.type = 'string'
        delete field.targetLabel
        continue
      }
      field.target = target.id
      delete field.targetLabel
    }
  }
  if (!entities.length) throw new RequirementDocError(502, '模型没有产出可预览的实体，请重试')

  const epicIds = new Set(context.epics.map(epic => epic.id))
  const storyIds = new Set(context.stories.map(story => story.id))
  const rawPages = Array.isArray(parsed.pages) ? parsed.pages : []
  let droppedPages = 0
  const pages: PrototypeSpecPage[] = []
  for (const item of rawPages) {
    if (pages.length >= SPEC_MAX_PAGES) {
      notes.push(`页面超过上限 ${SPEC_MAX_PAGES} 个，多出的已截断`)
      break
    }
    const row = asRecord(item)
    const title = clip(asString(row.title), SPEC_TEXT_LIMIT)
    if (!title) {
      droppedPages += 1
      continue
    }
    const epicId = asString(row.epicId)
    let epic: string | null = null
    if (epicId) {
      if (epicIds.has(epicId)) epic = epicId
      else notes.push(`页面「${title}」的 epicId「${epicId}」不在当前模块活跃 Epic 中，已归入其他页面`)
    }
    const entityName = asString(row.entity) || asString(row.entityName)
    const entity = entityName ? entityByName.get(entityName.toLowerCase()) ?? null : null
    if (entityName && !entity) notes.push(`页面「${title}」引用的实体「${entityName}」不存在，未绑定实体`)
    const labels = new Map((entity?.fields ?? []).map(field => [field.label.toLowerCase(), field.name]))
    const names = new Map((entity?.fields ?? []).map(field => [field.name, field.name]))
    const fields: string[] = []
    for (const rawField of Array.isArray(row.fields) ? row.fields : []) {
      const text = asString(rawField)
      if (!text) continue
      const name = labels.get(text.toLowerCase()) ?? names.get(text)
      if (name && !fields.includes(name)) fields.push(name)
    }
    pages.push({
      id: `PP-${pages.length + 1}`,
      title,
      type: pageTypeOf(row.type),
      epicId: epic,
      storyIds: asStringList(row.storyIds, 40).filter(id => storyIds.has(id)),
      entityId: entity?.id ?? null,
      fields,
      actions: asStringList(row.actions, SPEC_MAX_ACTIONS)
    })
  }
  if (droppedPages) notes.push(`${droppedPages} 个页面缺少标题，已忽略`)
  if (!pages.length) throw new RequirementDocError(502, '模型没有产出可预览的页面，请重试')

  const modelNotes = asStringList(parsed.notes, SPEC_MAX_NOTES)
  const fields = entities.reduce((sum, entity) => sum + entity.fields.length, 0)
  return {
    schema: PREVIEW_SPEC_SCHEMA,
    generatedAt: context.generatedAt ?? nowIso(),
    model: asString(context.model ?? '') || null,
    base: { docVersion: context.docVersion, docUpdatedAt: context.docUpdatedAt ?? null },
    entities,
    pages,
    notes: uniqueNotes([...notes, ...modelNotes]),
    stats: { entities: entities.length, fields, pages: pages.length }
  }
}

// ---------------------------------------------------------------- 读取 / 状态 / 覆盖度

export function readStoredPrototypeSpec(appId: string, moduleId: string): PrototypeSpec | null {
  const value = readSetting<PrototypeSpec | null>(prototypeSpecSettingKey(appId, moduleId))
  if (!value || typeof value !== 'object') return null
  if (value.schema !== PREVIEW_SPEC_SCHEMA) return null
  if (!Array.isArray(value.entities) || !Array.isArray(value.pages) || !Array.isArray(value.notes)) return null
  if (!value.base || typeof value.base !== 'object') return null
  return value
}

export function specStateOf(
  _appId: string,
  _moduleId: string,
  current: { docVersion: number; docUpdatedAt: string | null },
  spec: PrototypeSpec | null
): { status: PrototypeSpecStatus; staleReason: PrototypeSpecStaleReason } {
  if (!spec) return { status: 'missing', staleReason: null }
  const stale =
    spec.base.docVersion !== current.docVersion || (spec.base.docUpdatedAt ?? null) !== (current.docUpdatedAt ?? null)
  return stale ? { status: 'stale', staleReason: 'doc-changed' } : { status: 'ready', staleReason: null }
}

export function coverageOf(spec: PrototypeSpec | null, stories: RequirementStory[]): PrototypeSpecCoverage {
  const activeIds = stories.map(story => story.id)
  if (!spec) return { stories: activeIds.length, coveredStories: 0, uncoveredStoryIds: [...activeIds] }
  const covered = new Set<string>()
  for (const page of spec.pages) {
    for (const storyId of page.storyIds) if (activeIds.includes(storyId)) covered.add(storyId)
  }
  return {
    stories: activeIds.length,
    coveredStories: covered.size,
    uncoveredStoryIds: activeIds.filter(id => !covered.has(id))
  }
}

/** GET 增量字段：spec + specState（moduleId 为 null/模块不存在时 missing 空态，不写库） */
export function buildPrototypeSpecView(appId: string, moduleId: string | null): PrototypeSpecView {
  const empty: PrototypeSpecView = {
    spec: null,
    specState: {
      status: 'missing',
      staleReason: null,
      coverage: { stories: 0, coveredStories: 0, uncoveredStoryIds: [] }
    }
  }
  if (!moduleId) return empty
  const read = readRequirementDocIfExists(appId, moduleId)
  const outline = outlineOfSections(read.sections)
  const spec = readStoredPrototypeSpec(appId, moduleId)
  const current = { docVersion: read.doc?.version ?? 0, docUpdatedAt: read.doc?.updatedAt ?? null }
  const state = specStateOf(appId, moduleId, current, spec)
  return {
    spec,
    specState: {
      ...state,
      coverage: coverageOf(spec, outline.stories)
    }
  }
}

// ---------------------------------------------------------------- 生成

export type PrototypeSpecGenerator = (input: PrototypeSpecPromptInput) => Promise<string>

export interface PrototypeSpecGeneratorOverride {
  generate: PrototypeSpecGenerator
  model?: string | null
}

let generatorOverride: PrototypeSpecGeneratorOverride | null = null

/**
 * 测试专用：注入模型输出（生产路由不暴露；null 复位）。
 * 仅服务单测/冒烟，生产代码路径不会调用。
 */
export function setPrototypeSpecGeneratorForTests(next: PrototypeSpecGeneratorOverride | null): void {
  generatorOverride = next
}

export interface GeneratePrototypeSpecOptions {
  signal?: AbortSignal
  /** service 层注入（单测）；生产路由不传 */
  generator?: PrototypeSpecGenerator
  /** 注入 generator 时的模型标识（默认 generator 自动取 resolveChatModel） */
  model?: string | null
  /** 输出为空/解析失败/归一化后无实体或无页面时是否自动重试一次（默认 true；测试可关） */
  retry?: boolean
}

export interface GeneratedPrototypeSpec {
  moduleId: string
  spec: PrototypeSpec
}

/** 502 诊断：最后一次原始输出截断长度（头 150 + … + 尾 150） */
export const SPEC_ERROR_DETAIL_LIMIT = 300

/** 诊断片段：redact 后截断到 300 字（保留开头与结尾） */
export function specErrorDetail(raw: string): string {
  const text = redact(String(raw ?? '')).trim()
  if (text.length <= SPEC_ERROR_DETAIL_LIMIT) return text
  const half = SPEC_ERROR_DETAIL_LIMIT / 2
  return `${text.slice(0, half)}…${text.slice(-half)}`
}

function logSpecWarn(message: string): void {
  console.warn(`[requirements-prototype] ${redact(message)}`)
}

/** 模块级并发锁（进程内；单实例工作台可接受） */
const INFLIGHT = new Map<string, AbortController>()

async function defaultGenerator(
  appId: string,
  prompt: string,
  signal: AbortSignal,
  onModel: (model: string | null) => void
): Promise<string> {
  const directory = appDirOf(appId)
  if (!fs.existsSync(directory)) throw new Error(`应用目录不存在：${directory}`)
  ensureAppAgents(appId)
  await opencode.ensureAgent(directory, 'req')
  const model = await resolveChatModel(appId, 'requirements', directory)
  onModel(model ? `${model.providerID}/${model.id}` : null)
  return opencode.generateText({
    directory,
    agent: 'req',
    model,
    prompt,
    signal,
    timeoutMs: SPEC_GENERATE_TIMEOUT_MS
  })
}

/**
 * 生成/重新生成预览规格（唯一写入 = settings 键）。
 *
 * 守卫：应用 404 / 模块 404（缺省模块不存在也视为 404）/ 归档 409 /
 * 无文档或空文档 409 / 并发生成 409；失败取消 502/499 且不覆盖旧规格。
 */
export async function generatePrototypeSpec(
  appId: string,
  moduleId?: string,
  options: GeneratePrototypeSpecOptions = {}
): Promise<GeneratedPrototypeSpec> {
  appRowOrThrow(appId)
  const explicit = typeof moduleId === 'string' ? moduleId.trim() : ''
  const module = explicit ? moduleOrThrow(appId, explicit) : defaultModule(appId)
  if (!module) throw new RequirementDocError(404, '应用还没有未归档的需求模块，无法生成原型参考')
  assertModuleWritable(module)

  const read = readRequirementDocIfExists(appId, module.id)
  const outline = outlineOfSections(read.sections)
  const contentChars = read.sections.reduce((sum, section) => sum + String(section.markdown ?? '').trim().length, 0)
  if (!read.doc || (contentChars <= 0 && outline.epics.length === 0)) {
    throw new RequirementDocError(409, '请先补全需求文档再生成原型')
  }

  const lockKey = module.id
  if (INFLIGHT.has(lockKey)) throw new RequirementDocError(409, '正在生成原型参考，请稍候')

  const controller = new AbortController()
  INFLIGHT.set(lockKey, controller)
  const external = options.signal
  const onExternalAbort = (): void => controller.abort()
  if (external) {
    if (external.aborted) controller.abort()
    else external.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    const source = collectPrototypeSpecSource(appId, module.id)
    const generator = options.generator ?? generatorOverride?.generate
    let usedModel = options.model ?? generatorOverride?.model ?? null
    const attempts = options.retry === false ? 1 : 2
    let lastRaw = ''
    let lastError: RequirementDocError | null = null

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (controller.signal.aborted || external?.aborted) throw new RequirementDocError(499, '原型生成已中止')
      let produced: string
      try {
        produced = generator
          ? await generator(source.input)
          : await defaultGenerator(appId, source.input.prompt, controller.signal, model => {
              usedModel = model
            })
      } catch (error) {
        // 中止（499）与模型调用抛错不重试
        if (controller.signal.aborted || external?.aborted) throw new RequirementDocError(499, '原型生成已中止')
        if (error instanceof RequirementDocError) throw error
        const message = redact(error instanceof Error ? error.message : String(error))
        throw new RequirementDocError(502, `原型生成失败：${message}`)
      }
      if (controller.signal.aborted || external?.aborted) throw new RequirementDocError(499, '原型生成已中止')

      const raw = typeof produced === 'string' ? produced : String(produced ?? '')
      lastRaw = raw
      try {
        const spec = parsePrototypeSpecOutput(raw, {
          epics: source.epics,
          stories: source.stories,
          docVersion: source.doc?.version ?? 0,
          docUpdatedAt: source.doc?.updatedAt ?? null,
          model: usedModel,
          generatedAt: nowIso(),
          extraNotes: source.notes
        })
        writeSetting(prototypeSpecSettingKey(appId, module.id), spec)
        return { moduleId: module.id, spec }
      } catch (error) {
        if (controller.signal.aborted || external?.aborted) throw new RequirementDocError(499, '原型生成已中止')
        if (!(error instanceof RequirementDocError) || error.status !== 502) throw error
        lastError = error
        // 只记录长度与开头片段（不含完整文档内容）
        logSpecWarn(
          `原型规格生成失败：moduleId=${module.id} attempt=${attempt}/${attempts} rawLen=${raw.length} head=${raw.replace(/\s+/g, ' ').slice(0, 120)}`
        )
      }
    }

    const detail = specErrorDetail(lastRaw)
    const baseMessage = lastError?.message || '原型生成结果无法解析，请重试'
    const message = attempts > 1 ? `${baseMessage}（已自动重试 ${attempts - 1} 次）` : baseMessage
    throw new RequirementDocError(502, message, [], [], detail)
  } finally {
    if (external) external.removeEventListener('abort', onExternalAbort)
    if (INFLIGHT.get(lockKey) === controller) INFLIGHT.delete(lockKey)
  }
}
