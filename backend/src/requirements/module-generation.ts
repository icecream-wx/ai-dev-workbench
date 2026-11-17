/**
 * 需求模块逐模块生成（RMP-1）
 *
 * 用户在「模块拆分建议」卡确认后，按顺序为每个模块生成**完整模板 PRD**：
 * - 每个模块一个独立短暂 opencode 会话（需求阶段 agent/model），不写模块聊天历史；
 * - 模型输出沿用 `<<<DOC_JSON>>>`；后端解析后复用 `saveDoc(source='ai', snapshot)` 落库；
 * - 只写当前模块，全局 ID 由后端分配（不信任 AI ID）；生成后仍是 draft，不自动确认；
 * - SSE 事件：module-start / module-done / module-error / all-done；
 * - 失败不中断其它模块（继续生成），已完成的保留；客户端断开/取消 → 中止当前 opencode 会话。
 *
 * 单测通过 `options.generator` 注入模型输出，不调用真实模型。
 */
import fs from 'node:fs'
import { readSetting } from '../db'
import { appDirOf, ensureAppAgents } from '../apps/scaffold'
import { opencode } from '../opencode/runtime'
import { redact } from '../opencode/redact'
import { resolveChatModel } from '../chat/service'
import { DOC_DELIMITER } from '../chat/doc-prompt'
import { RequirementDocError } from './templates'
import { ensureRequirementDoc, parseContentMd, saveDoc, type SaveDocInput } from './doc'
import { activeChangeSetRow } from '../changesets/query'
import {
  appRowOrThrow,
  assertModuleWritable,
  listModules,
  moduleOrThrow,
  type ModuleRow
} from './modules'
import {
  readAppliedModulePlan,
  readAppliedModulePlanSource,
  type AppliedModulePlan
} from './module-plan'
import type { RequirementDoc, RequirementTemplate, RequirementDocSection } from './types'

export type ModuleGenerationReason = 'initial' | 'single' | 'retry' | 'replan'

export interface ModuleGenerationEvent {
  type: 'module-start' | 'module-done' | 'module-error' | 'all-done'
  moduleId?: string
  moduleKey?: string
  title?: string
  index?: number
  total?: number
  version?: number
  warnings?: string[]
  error?: string
  ok?: boolean
  cancelled?: boolean
  failed?: Array<{ moduleId: string; error: string }>
}

export interface ModuleGenerationInput {
  appId: string
  appName: string
  module: ModuleRow
  template: RequirementTemplate
  source: string
  plan: AppliedModulePlan | null
  modules: ModuleRow[]
  prompt: string
  signal?: AbortSignal
}

export interface PreparedModuleGeneration {
  appId: string
  appName: string
  reason: ModuleGenerationReason
  modules: ModuleRow[]
  plan: AppliedModulePlan | null
  source: string
}

const GENERATION_TIMEOUT_MS = 600_000
const MAX_SOURCE_CHARS = 30_000
/** RMP-2：重新规划的聚合需求可到 60k（与 modulePlanSource 上限一致） */
const MAX_REPLAN_SOURCE_CHARS = 60_000

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function truncate(text: string, limit = MAX_SOURCE_CHARS): string {
  const value = String(text ?? '')
  return value.length > limit ? `${value.slice(0, limit)}\n\n（内容过长已截断）` : value
}

function chatSourceOf(appId: string, moduleId: string): string {
  // 延迟读取不影响正确性：apply 时前端会先落盘聊天；这里再兜底一次
  const value = readSetting<{ messages?: unknown[] }>(`app.${appId}.requirementsDocChat.${moduleId}`)
  const messages = Array.isArray(value?.messages) ? value!.messages : []
  const parts: string[] = []
  for (const item of messages) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    if (row.role !== 'user') continue
    const content = asString(row.content)
    if (content) parts.push(content)
  }
  return parts.join('\n\n').slice(0, 60_000)
}

/** 解析请求体里的 moduleIds（可选）：数组、非空字符串、无重复 */
function parseModuleIds(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return null
  if (!Array.isArray(raw)) throw new RequirementDocError(400, 'moduleIds 需要是字符串数组')
  const ids: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const id = asString(item)
    if (!id) throw new RequirementDocError(400, 'moduleIds 含空值')
    if (seen.has(id)) throw new RequirementDocError(400, `moduleIds 不能重复：${id}`)
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function reasonOf(raw: unknown): ModuleGenerationReason {
  if (raw === undefined || raw === null || raw === '') return 'initial'
  if (raw === 'initial' || raw === 'single' || raw === 'retry' || raw === 'replan') return raw
  throw new RequirementDocError(400, 'reason 只能是 initial、single、retry 或 replan')
}

/**
 * 生成前校验/解析（同步；在 SSE 头之前调用，错误按普通 HTTP 错误返回）。
 *
 * - 仅需求阶段、无 active Change Set；
 * - `single`：当前未归档模块必须**恰好 1 个**（“保持单模块”只在未拆分时可用），不要求规划；
 * - `initial`：必须已有 modulePlanApplied + 原始需求；
 * - `retry`：有规划时按规划模块重试；没有规划但当前恰好 1 个未归档模块且 moduleIds 匹配时，
 *   按“单模块重试”处理（“保持单模块”失败后可重试）；其余维持 409。
 */
export function prepareModuleGeneration(appId: string, body: Record<string, unknown> = {}): PreparedModuleGeneration {
  const app = appRowOrThrow(appId)
  if (app.status !== 'requirements') {
    throw new RequirementDocError(409, `当前阶段（${app.status}）不能生成需求模块；请先回到需求阶段`)
  }
  if (activeChangeSetRow(appId)) {
    throw new RequirementDocError(409, '变更进行中不能生成需求模块；请先完成或取消本次变更')
  }
  const reason = reasonOf(body.reason)
  const requested = parseModuleIds(body.moduleIds)

  if (reason === 'single') {
    const active = listModules(appId)
    if (!active.length) throw new RequirementDocError(400, '应用还没有需求模块，无法生成')
    if (active.length !== 1) {
      throw new RequirementDocError(
        409,
        `当前有 ${active.length} 个未归档模块，不能按“保持单模块”生成；请使用已应用的模块拆分建议重试或重新生成`
      )
    }
    const onlyId = active[0].id
    if (requested && requested.length) {
      if (requested.length !== 1) throw new RequirementDocError(400, '保持单模块只能生成 1 个模块')
      if (requested[0] !== onlyId) {
        throw new RequirementDocError(409, '保持单模块只能生成当前唯一未归档模块')
      }
    }
    const module = moduleOrThrow(appId, onlyId)
    assertModuleWritable(module)
    const plan = readAppliedModulePlan(appId)
    const source = readAppliedModulePlanSource(appId) || chatSourceOf(appId, module.id)
    return { appId, appName: app.name, reason, modules: [module], plan, source }
  }

  const plan = readAppliedModulePlan(appId)
  if (!plan) {
    // MF1：没有规划时，允许“单模块 retry”（保持单模块失败后重试）
    const active = listModules(appId)
    const singleRetry =
      reason === 'retry' && requested && requested.length === 1 && active.length === 1 && active[0].id === requested[0]
    if (singleRetry) {
      const module = moduleOrThrow(appId, requested[0])
      assertModuleWritable(module)
      const source = readAppliedModulePlanSource(appId) || chatSourceOf(appId, module.id)
      return { appId, appName: app.name, reason, modules: [module], plan: null, source }
    }
    throw new RequirementDocError(409, '尚未应用模块拆分建议；请先在建议卡点击“应用拆分并生成”，或选择“保持单模块”')
  }
  // RMP-2：重新规划后的生成必须显式指定模块（只生成 create/regenerate），不默认全量
  if (reason === 'replan') {
    if (plan.kind !== 'replan') {
      throw new RequirementDocError(409, '尚未应用模块重新规划；请先在“AI 规划模块”中应用调整')
    }
    if (!(requested && requested.length)) {
      throw new RequirementDocError(400, '重新规划生成需要指定 moduleIds')
    }
  }
  if (reason === 'initial' && plan.kind === 'replan') {
    throw new RequirementDocError(409, '已应用模块重新规划；请按 replan/retry 生成指定模块（keep/rename 不生成）')
  }
  const source = readAppliedModulePlanSource(appId) || chatSourceOf(appId, plan.modules[0]?.moduleId ?? '')
  if (!source) {
    throw new RequirementDocError(409, '缺少原始需求记录，无法生成；请重新发送需求或重新应用模块拆分建议')
  }
  const planIds = new Set(plan.modules.map(item => item.moduleId))
  const ids = requested && requested.length ? requested : plan.modules.map(item => item.moduleId)
  if (!ids.length) throw new RequirementDocError(400, '没有需要生成的模块')
  if (reason === 'retry' && !(requested && requested.length)) {
    throw new RequirementDocError(400, '重试需要指定 moduleIds')
  }
  for (const id of ids) {
    if (!planIds.has(id)) throw new RequirementDocError(400, `模块不在已应用的拆分建议中：${id}`)
  }
  // 重新规划：生成范围只有 create/regenerate（keep/rename 不生成，retry 也只能重试这些模块）
  if (plan.kind === 'replan' && (reason === 'replan' || reason === 'retry')) {
    const byId = new Map(plan.modules.map(item => [item.moduleId, item]))
    for (const id of ids) {
      const item = byId.get(id)
      if (!item || (item.action !== 'create' && item.action !== 'regenerate')) {
        throw new RequirementDocError(400, `模块不在本次重新规划的生成范围（只生成新建/重新生成模块）：${id}`)
      }
    }
  }
  const modules = ids.map(id => {
    const module = moduleOrThrow(appId, id)
    assertModuleWritable(module)
    return module
  })
  return { appId, appName: app.name, reason, modules, plan, source }
}

// ---------------------------------------------------------------- prompt

function planModuleLine(item: AppliedModulePlan['modules'][number]): string {
  const scope = item.scope.length ? item.scope.join('；') : '（未提供）'
  return `- ${item.title}（${item.moduleKey}）：${item.description || '（无说明）'}；范围：${scope}`
}

/** 逐模块生成 prompt：模板 + 原始需求 + 全部模块边界 + 当前模块 + DOC_JSON 协议 */
export function buildModuleGeneratePrompt(input: {
  appName: string
  template: RequirementTemplate
  source: string
  plan: AppliedModulePlan | null
  modules: ModuleRow[]
  module: ModuleRow
}): string {
  const { appName, template, source, plan, module } = input
  const currentPlan = plan?.modules.find(item => item.moduleId === module.id) ?? null
  const parts: string[] = [
    `你是需求文档 Agent。请为应用「${appName}」的**当前模块**生成一份完整、可直接进入设计阶段的 Markdown 需求文档（PRD）。`,
    '只输出给用户的简短中文回复与协议 JSON；不要读取/创建/修改文件，不要执行命令。'
  ]

  parts.push(
    [
      '## 模板（每个模块都必须完整覆盖）',
      `名称：${template.name}（${template.category}${template.builtin ? '，内置' : '，我的模板'}）`,
      `模板说明：${template.description || '无'}`,
      `模板提示词：${template.prompt}`,
      '### 章节结构（顺序即文档顺序；required=必填）',
      ...template.sections.map(
        (section, index) =>
          `${index + 1}. [${section.id}] ${section.title}（${section.required ? '必填' : '可选'}；类型 ${section.kind}；${section.level === 3 ? '三级' : '二级'}标题）${
            section.guidance ? `：${section.guidance}` : ''
          }`
      )
    ].join('\n')
  )

  parts.push(
    [
      plan?.kind === 'replan' ? '## 当前全部需求（重新规划聚合摘要）' : '## 原始需求（来自用户首次模块规划对话）',
      truncate(source, plan?.kind === 'replan' ? MAX_REPLAN_SOURCE_CHARS : MAX_SOURCE_CHARS) ||
        '（缺失；请只按当前模块范围生成，信息不足处写“待确认”）'
    ].join('\n')
  )

  if (plan) {
    const dependencies = plan.dependencies.length
      ? plan.dependencies
          .map(item => {
            const from = plan.modules.find(moduleItem => moduleItem.key === item.from)
            const to = plan.modules.find(moduleItem => moduleItem.key === item.to)
            return `- ${from?.title || item.from} → ${to?.title || item.to}：${item.description || '（无说明）'}`
          })
          .join('\n')
      : '（无跨模块依赖）'
    parts.push(
      [
        '## 模块拆分规划（全部模块；用于划清边界）',
        ...plan.modules.map(item => planModuleLine(item)),
        '### 跨模块依赖',
        dependencies,
        '### 覆盖与缺口',
        ...(plan.coverage.length
          ? plan.coverage.map(item => `- ${item.requirement} → ${plan.modules.find(m => m.key === item.moduleKey)?.title || item.moduleKey}`)
          : ['- （未提供覆盖说明）']),
        ...(plan.unassigned.length ? plan.unassigned.map(item => `- 未分配：${item.requirement}（${item.reason || '待确认'}）`) : []),
        ...(plan.openIssues.length ? plan.openIssues.map(item => `- 待确认：${item}`) : [])
      ].join('\n')
    )
  }

  parts.push(
    [
      '## 当前模块（只写这个模块）',
      `模块：${module.title}（${module.module_key}）`,
      `模块说明：${module.description || '（无）'}`,
      currentPlan
        ? `本模块范围：${currentPlan.scope.length ? currentPlan.scope.join('；') : '（未提供）'}`
        : '本模块范围：按原始需求/模板尽量完整覆盖',
      currentPlan?.suggestedEpics.length
        ? `建议 Epics：\n${currentPlan.suggestedEpics
            .map(item => `- ${item.title}${item.stories.length ? `：${item.stories.join('、')}` : ''}`)
            .join('\n')}`
        : '建议 Epics：按本模块业务域自行拆分（每个 Epic 至少 1 个 Story）',
      '### 生成约束',
      '- 只生成本模块的需求：不要写其它模块的功能、页面或实体；其它模块只作为跨模块依赖出现；',
      '- 必须完整覆盖模板所有章节；必填章节不能为空；本模块确实不适用的章节写“本模块不涉及”并说明原因；',
      '- Scene / Epic / Story 只属于本模块；省略 ID（系统分配全局唯一 ID）；不要输出 SCENE-/EPIC-/STORY- 等 ID；',
      '- 每个 Epic 至少 1 个 Story；**优先把 Story 内嵌到对应 Epic 的 `stories` 数组**（省略 id，后端会展开并分配 ID）；',
      '- 只有在能确定 `epicId` 时才用顶层 `stories[]`；没有 id 时请用内嵌 stories，避免 Story 丢失 Epic 归属；',
      '- 跨模块关系（如订单引用商品）写在业务规则/数据说明里，说明依赖关系与基数；**不要在本模块重复建其它模块的实体**；',
      '- 用户明确排除的功能（例如“不做支付”）不得写成本模块功能；可在范围内写“不涉及：支付”；',
      '- 信息不足处写 `> 待确认：...`，不要编造业务规则。'
    ].join('\n')
  )

  parts.push(
    [
      '## 输出协议',
      '先输出给用户的简短中文回复（1—3 句），再单独一行输出',
      DOC_DELIMITER,
      '最后输出一个合法 JSON 对象（JSON 之后不要再输出分隔符、代码块或解释）：',
      '{',
      '  "doc": "完整 Markdown 文档（以 # 标题开头，章节用 ##/###，章节标题必须与模板一致）",',
      '  "sections": [{ "id": "problem", "markdown": "该章节 Markdown" }],',
      '  "openIssues": { "add": [{ "question": "..." }] }',
      '}',
      '规则：',
      '- 首次生成（模块文档全空）必须返回完整 doc（覆盖全部模板章节）；也可以同时返回 sections；',
      '- Markdown 标题只写章节标题本身（如 `## 问题与机会`），不要带 `[key]`、`（必填）` 等前后缀；章节 key 只用于 sections[].id；',
      '- 结构化章节请返回 sections 的 data（后端据此渲染 Markdown）：',
      '  { "id": "scenes", "data": { "scenes": [{ "title": "订单管理", "description": "..." }], "epics": [], "stories": [] } }',
      '  { "id": "epics", "data": { "scenes": [], "epics": [{ "title": "订单创建", "goal": "...", "stories": [{ "title": "选择商品生成订单", "description": "...", "acceptance": ["..."], "priority": "P0" }] }], "stories": [] } }',
      '- Story 内嵌在 Epic 的 stories 里时不要写 id/epicId；所有 ID 由后端分配；',
      '- 不要把整篇 Markdown 包在代码块里；不要输出 DOC_JSON 之外的 JSON。'
    ].join('\n')
  )

  return parts.join('\n\n')
}

// ---------------------------------------------------------------- DOC_JSON

function repairJsonText(text: string): string {
  let value = String(text ?? '').trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(value)
  if (fence) value = fence[1].trim()
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start >= 0 && end > start) value = value.slice(start, end + 1)
  return value.replace(/,\s*([}\]])/g, '$1')
}

export interface DocJsonEnvelope {
  doc?: string
  sections?: Array<Record<string, unknown>>
  [key: string]: unknown
}

/** 解析模型输出的 DOC_JSON（容错代码块/尾逗号/无分隔符） */
export function parseDocJsonOutput(raw: string): DocJsonEnvelope | null {
  const text = String(raw ?? '').trim()
  const index = text.indexOf(DOC_DELIMITER)
  const tail = index >= 0 ? text.slice(index + DOC_DELIMITER.length) : text
  const candidate = repairJsonText(tail)
  if (!candidate) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const envelope = parsed as DocJsonEnvelope
  const hasDoc = typeof envelope.doc === 'string' && envelope.doc.trim()
  const hasSections = Array.isArray(envelope.sections) && envelope.sections.length > 0
  if (!hasDoc && !hasSections) return null
  if (typeof envelope.doc === 'string') {
    let doc = envelope.doc.trim()
    if (doc.startsWith('```')) {
      doc = doc.replace(/^```[a-zA-Z]*\s*/, '')
      if (doc.endsWith('```')) doc = doc.slice(0, -3)
      envelope.doc = doc.trim()
    }
  }
  return envelope
}

function missingRequired(
  templateSections: RequirementTemplate['sections'],
  savedSections: RequirementDocSection[]
): string[] {
  return templateSections
    .filter(section => {
      if (!section.required) return false
      const saved = savedSections.find(item => item.sectionKey === section.id)
      if (!saved) return true
      if (saved.markdown.trim()) return false
      if (!saved.data) return true
      return !saved.data.scenes.length && !saved.data.epics.length && !saved.data.stories.length
    })
    .map(section => section.title)
}

function titleKey(title: string): string {
  return String(title ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

interface SectionUpdate {
  id?: string
  title?: string
  markdown?: string
  data?: unknown
}

/**
 * DOC_JSON → 章节更新。
 *
 * 不直接把 `doc` 交给 contentMd 全文保存：全文保存会以解析出的标题为准，
 * 漏写的模板章节会被丢弃。这里按模板章节标题映射成 sections 更新，
 * 未命中的标题作为自定义章节新增；结构化 data 优先取 `sections[].data`。
 */
function buildSectionUpdates(existingSections: RequirementDocSection[], envelope: DocJsonEnvelope): SectionUpdate[] {
  const updates: SectionUpdate[] = []
  if (typeof envelope.doc === 'string' && envelope.doc.trim()) {
    const parsed = parseContentMd(envelope.doc, existingSections)
    for (const item of parsed.sections) {
      const match = existingSections.find(section => titleKey(section.title) === titleKey(item.title))
      updates.push({
        ...(match ? { id: match.sectionKey } : { title: item.title }),
        markdown: item.markdown
      })
    }
  }
  for (const raw of envelope.sections ?? []) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const row = raw as Record<string, unknown>
    const id = asString(row.id) || asString(row.sectionKey)
    const title = asString(row.title)
    const isData = row.data !== undefined
    const isMarkdown = typeof row.markdown === 'string'
    if (!id && !title) continue
    const existing = updates.find(item => (id && item.id === id) || (title && item.title && titleKey(item.title) === titleKey(title)))
    const patch: SectionUpdate = {
      ...(id ? { id } : {}),
      ...(title ? { title } : {}),
      ...(isMarkdown ? { markdown: row.markdown as string } : {}),
      ...(isData ? { data: row.data } : {})
    }
    if (existing) Object.assign(existing, patch)
    else updates.push(patch)
  }
  return updates.filter(item => item.id || item.title)
}

/** 把 DOC_JSON 应用到模块（saveDoc source=ai + snapshot；只写该模块；不确认） */
export function applyGeneratedDoc(
  appId: string,
  moduleId: string,
  envelope: DocJsonEnvelope
): { version: number; warnings: string[]; doc: RequirementDoc } {
  const baseline = ensureRequirementDoc(appId, undefined, moduleId)
  const updates = buildSectionUpdates(baseline.sections, envelope)
  if (!updates.length) throw new Error('模型输出里没有可用的 doc 章节或 sections')
  const input: SaveDocInput = { source: 'ai', sections: updates }
  const saved = saveDoc(appId, input, moduleId)
  const warnings = [...(saved.warnings ?? [])]
  // 模板必填章节为空时给用户明确提示（不阻塞，可重试）
  const missing = missingRequired(baseline.template.sections, saved.sections)
  if (missing.length) warnings.push(`${missing.length} 个模板必填章节未生成：${missing.join('、')}（建议重试该模块）`)
  return { version: saved.doc.version, warnings, doc: saved.doc }
}

// ---------------------------------------------------------------- run

async function defaultModuleDocGenerator(input: ModuleGenerationInput): Promise<string> {
  const directory = appDirOf(input.appId)
  if (!fs.existsSync(directory)) throw new Error(`应用目录不存在：${directory}`)
  ensureAppAgents(input.appId)
  await opencode.ensureAgent(directory, 'req')
  const model = await resolveChatModel(input.appId, 'requirements', directory)
  return opencode.generateText({
    directory,
    agent: 'req',
    model,
    prompt: input.prompt,
    signal: input.signal,
    timeoutMs: GENERATION_TIMEOUT_MS
  })
}

export interface RunModuleGenerationOptions {
  onEvent?: (event: ModuleGenerationEvent) => void
  signal?: AbortSignal
  /** 单测注入：返回模型原始输出；缺省调用 opencode */
  generator?: (input: ModuleGenerationInput) => Promise<string>
}

export interface RunModuleGenerationResult {
  ok: boolean
  cancelled: boolean
  failed: Array<{ moduleId: string; error: string }>
}

/** 顺序生成；单模块失败不影响其它模块；取消保留已完成模块 */
export async function runModuleGeneration(
  prepared: PreparedModuleGeneration,
  options: RunModuleGenerationOptions = {}
): Promise<RunModuleGenerationResult> {
  const generator = options.generator ?? defaultModuleDocGenerator
  const failed: Array<{ moduleId: string; error: string }> = []
  let cancelled = false
  const total = prepared.modules.length

  for (let index = 0; index < total; index += 1) {
    const module = prepared.modules[index]
    if (options.signal?.aborted) {
      cancelled = true
      break
    }
    options.onEvent?.({
      type: 'module-start',
      moduleId: module.id,
      moduleKey: module.module_key,
      title: module.title,
      index: index + 1,
      total
    })
    try {
      const payload = ensureRequirementDoc(prepared.appId, undefined, module.id)
      if (payload.doc.status !== 'draft') {
        throw new Error(`模块「${module.title}」需求已确认或已锁定，不能覆盖生成`)
      }
      const prompt = buildModuleGeneratePrompt({
        appName: prepared.appName,
        template: payload.template,
        source: prepared.source,
        plan: prepared.plan,
        modules: prepared.modules,
        module
      })
      const raw = await generator({
        appId: prepared.appId,
        appName: prepared.appName,
        module,
        template: payload.template,
        source: prepared.source,
        plan: prepared.plan,
        modules: prepared.modules,
        prompt,
        signal: options.signal
      })
      if (options.signal?.aborted) {
        cancelled = true
        break
      }
      const envelope = parseDocJsonOutput(raw)
      if (!envelope) throw new Error('模型输出未包含可解析的 DOC_JSON（未生成任何文档内容）')
      const saved = applyGeneratedDoc(prepared.appId, module.id, envelope)
      options.onEvent?.({
        type: 'module-done',
        moduleId: module.id,
        moduleKey: module.module_key,
        title: module.title,
        version: saved.version,
        warnings: saved.warnings
      })
    } catch (error) {
      if (options.signal?.aborted) {
        cancelled = true
        break
      }
      const message = redact(error instanceof Error ? error.message : String(error))
      failed.push({ moduleId: module.id, error: message })
      options.onEvent?.({
        type: 'module-error',
        moduleId: module.id,
        moduleKey: module.module_key,
        title: module.title,
        error: message
      })
    }
  }

  const ok = !cancelled && failed.length === 0
  options.onEvent?.({ type: 'all-done', ok, cancelled, failed })
  return { ok, cancelled, failed }
}
