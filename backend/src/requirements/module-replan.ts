/**
 * 需求模块随时重新规划（RMP-2）
 *
 * 需求阶段、最终“完成需求阶段”之前，可基于**当前全部未归档模块**的需求内容
 * 让 AI 重新给出模块划分建议（`kind='replan'`）：
 * - preview 只读：聚合当前需求 → prompt → 模型输出 → 解析/归一化/校验；不写库；
 * - apply 单事务：先聚合 source / 重开受影响已确认模块 → 按 keep/rename/regenerate/create
 *   处理模块 → 归档未匹配旧模块（内容/版本/对话保留）→ 写 `modulePlanApplied`(kind=replan)/`modulePlanSource`；
 * - 不生成文档：create/regenerate 由前端接着调 RMP-1 生成接口（reason='replan'）。
 *
 * 内容策略：keep 不改内容；rename 只改标题/说明（范围不变）；regenerate 保留 ID/对话/版本并重新生成；
 * create 新建空 v1 并生成；未匹配旧模块归档（不删除、不搬运章节/Epic）。
 */
import fs from 'node:fs'
import { db, nowIso, writeSetting } from '../db'
import { activeChangeSetRow } from '../changesets/query'
import { appDirOf, ensureAppAgents } from '../apps/scaffold'
import { opencode } from '../opencode/runtime'
import { redact } from '../opencode/redact'
import { resolveChatModel } from '../chat/service'
import { RequirementDocError } from './templates'
import {
  appRowOrThrow,
  archiveModule,
  createModuleWithEmptyDoc,
  listModules,
  moduleOrThrow,
  type ModuleDocStatus,
  type ModuleRow
} from './modules'
import { updateRequirementDocTitle } from './doc'
import { parseSectionData } from './outline'
import {
  MODULE_PLAN_DELIMITER,
  MAX_PLAN_MODULES,
  MAX_PLAN_SOURCE_CHARS,
  readAppliedModulePlan,
  type AppliedModulePlan,
  type AppliedModulePlanModule,
  type ModulePlanCoverage,
  type ModulePlanDependency,
  type ModulePlanEpicSuggestion,
  type ModulePlanUnassigned
} from './module-plan'
import type { RequirementOutlineData } from './types'

export const DEFAULT_REPLAN_INSTRUCTION = '根据当前全部需求内容重新拆分模块'
/** 动作集合（apply 只接受这四个；其它值 400） */
export const REPLAN_ACTIONS = ['keep', 'rename', 'regenerate', 'create'] as const
export type ReplanAction = (typeof REPLAN_ACTIONS)[number]

/** 截断上限：单章节 / 单模块 / 总计（超限在 warnings 标记） */
export const REPLAN_SECTION_LIMIT = 4_000
export const REPLAN_MODULE_LIMIT = 16_000
export const REPLAN_TOTAL_LIMIT = 80_000

const REPLAN_GENERATION_TIMEOUT_MS = 600_000

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringList(value: unknown, limit = 40): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => asString(item))
    .filter(Boolean)
    .slice(0, limit)
}

function isAction(value: string): value is ReplanAction {
  return (REPLAN_ACTIONS as readonly string[]).includes(value)
}

// ---------------------------------------------------------------- 聚合当前需求

export interface ReplanEpic {
  title: string
  goal: string
  stories: Array<{ title: string; description: string; acceptance: string[]; priority: string }>
}

export interface ReplanCurrentModule {
  id: string
  moduleKey: string
  title: string
  description: string
  status: ModuleDocStatus
  version: number
  scope: string[]
  confirmed: boolean
}

export interface ReplanSourceModule extends ReplanCurrentModule {
  epics: ReplanEpic[]
  /** 该模块的聚合文本（章节 + 结构化 Epic/Story） */
  text: string
  truncated: boolean
  /** 真实内容字符数（标题/目录不算；用于判断是否“全空”） */
  contentChars: number
}

export interface ReplanSource {
  text: string
  modules: ReplanSourceModule[]
  truncated: boolean
  contentChars: number
}

interface DocSnapshotRow {
  module_id: string
  title: string
  status: string
  version: number
}

interface SectionSnapshotRow {
  section_key: string
  title: string
  kind: string
  markdown: string
  data_json: string | null
  position: number
}

function docSnapshot(appId: string, moduleId: string): DocSnapshotRow | undefined {
  return db
    .prepare('SELECT module_id, title, status, version FROM app_requirement_docs WHERE app_id = ? AND module_id = ?')
    .get(appId, moduleId) as DocSnapshotRow | undefined
}

function sectionSnapshots(appId: string, moduleId: string): SectionSnapshotRow[] {
  return db
    .prepare(
      'SELECT section_key, title, kind, markdown, data_json, position FROM app_requirement_doc_sections WHERE app_id = ? AND module_id = ? ORDER BY position ASC, rowid ASC'
    )
    .all(appId, moduleId) as SectionSnapshotRow[]
}

function docStatusOf(raw: string | null | undefined): ModuleDocStatus {
  return raw === 'confirmed' || raw === 'review' ? raw : 'draft'
}

/** 当前模块“范围”：优先取已应用规划（RMP-1/上一次 RMP-2）；没有时视为未知（空数组） */
function currentScopes(appId: string): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const applied = readAppliedModulePlan(appId)
  for (const item of applied?.modules ?? []) {
    if (!item.moduleId) continue
    map.set(item.moduleId, asStringList(item.scope))
  }
  return map
}

function epicsOf(sections: SectionSnapshotRow[]): ReplanEpic[] {
  const merged: RequirementOutlineData = { scenes: [], epics: [], stories: [] }
  for (const section of sections) {
    const data = parseSectionData(section.data_json)
    if (!data) continue
    merged.epics.push(...data.epics)
    merged.stories.push(...data.stories)
  }
  return merged.epics
    .filter(epic => epic && !epic.archived && epic.title)
    .slice(0, 40)
    .map(epic => ({
      title: epic.title,
      goal: epic.goal || '',
      stories: merged.stories
        .filter(story => story && !story.archived && story.epicId === epic.id && story.title)
        .slice(0, 40)
        .map(story => ({
          title: story.title,
          description: story.description || '',
          acceptance: Array.isArray(story.acceptance) ? story.acceptance.filter(Boolean).slice(0, 12) : [],
          priority: story.priority || ''
        }))
    }))
}

function epicText(epics: ReplanEpic[]): string[] {
  if (!epics.length) return []
  const lines: string[] = []
  for (const epic of epics) {
    lines.push(`- ${epic.title}${epic.goal ? `（目标：${epic.goal}）` : ''}`)
    for (const story of epic.stories) {
      const extras: string[] = []
      if (story.description) extras.push(story.description)
      if (story.acceptance.length) extras.push(`验收：${story.acceptance.join('；')}`)
      if (story.priority) extras.push(`优先级 ${story.priority}`)
      lines.push(`  - ${story.title}${extras.length ? `：${extras.join('；')}` : ''}`)
    }
  }
  return lines
}

/**
 * 聚合当前全部未归档模块的需求内容（只读；不建模块/文档/版本）。
 *
 * 截断：单章节 4k、单模块 16k、总计 80k；超限标记 `truncated`，由 preview 转 warning。
 */
export function collectReplanSource(appId: string): ReplanSource {
  const views = listModules(appId)
  const scopes = currentScopes(appId)
  let truncated = false
  let contentChars = 0

  const modules: ReplanSourceModule[] = views.map(view => {
    const row = docSnapshot(appId, view.id)
    const sections = sectionSnapshots(appId, view.id)
    const epics = epicsOf(sections)
    const scope = scopes.get(view.id) ?? []
    const status = docStatusOf(row?.status)
    const version = row?.version ?? 0

    const pieces: string[] = [
      `### 模块 ${view.moduleKey} ${view.title}（moduleId: ${view.id}；状态：${row ? status : '无文档'}；版本：v${version}）`
    ]
    if (view.description) pieces.push(`说明：${view.description}`)
    if (scope.length) pieces.push(`范围：${scope.join('；')}`)

    let moduleTruncated = false
    for (const section of sections) {
      let body = String(section.markdown ?? '').trim()
      if (!body) continue
      contentChars += body.length
      if (body.length > REPLAN_SECTION_LIMIT) {
        body = `${body.slice(0, REPLAN_SECTION_LIMIT)}\n（章节内容过长已截断）`
        moduleTruncated = true
      }
      pieces.push(`#### ${section.title}\n${body}`)
    }
    for (const epic of epics) {
      contentChars += epic.title.length + epic.goal.length
      for (const story of epic.stories) contentChars += story.title.length + story.description.length
    }
    const lines = epicText(epics)
    if (lines.length) pieces.push(`#### 结构化 Epics\n${lines.join('\n')}`)

    let text = pieces.join('\n\n')
    if (text.length > REPLAN_MODULE_LIMIT) {
      text = `${text.slice(0, REPLAN_MODULE_LIMIT)}\n（模块内容过长已截断）`
      moduleTruncated = true
    }
    if (moduleTruncated) truncated = true
    return {
      id: view.id,
      moduleKey: view.moduleKey,
      title: view.title,
      description: view.description,
      status,
      version,
      scope,
      confirmed: status === 'confirmed',
      epics,
      text,
      truncated: moduleTruncated,
      contentChars
    }
  })

  let text = modules.map(module => module.text).join('\n\n---\n\n')
  if (text.length > REPLAN_TOTAL_LIMIT) {
    text = `${text.slice(0, REPLAN_TOTAL_LIMIT)}\n\n（当前全部需求过长，已截断）`
    truncated = true
  }
  return { text, modules, truncated, contentChars }
}

// ---------------------------------------------------------------- 规划协议

export interface ReplanPlanModule {
  key: string
  title: string
  description: string
  scope: string[]
  suggestedEpics: ModulePlanEpicSuggestion[]
  existingModuleId: string | null
  action: string
}

export interface ReplanPlan {
  kind: 'replan'
  instruction: string
  modules: ReplanPlanModule[]
  dependencies: ModulePlanDependency[]
  coverage: ModulePlanCoverage[]
  unassigned: ModulePlanUnassigned[]
  openIssues: string[]
  warnings: string[]
}

function normalizeEpics(value: unknown): ModulePlanEpicSuggestion[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map(item => {
      const raw = item as Record<string, unknown>
      return { title: asString(raw.title), stories: asStringList(raw.stories, 30) }
    })
    .filter(item => item.title)
    .slice(0, 20)
}

function normalizeItem(value: unknown, index: number): ReplanPlanModule {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const key = asString(raw.key) || `m${index + 1}`
  const existingModuleId = asString(raw.existingModuleId) || null
  const action = asString(raw.action).toLowerCase() || (existingModuleId ? 'regenerate' : 'create')
  return {
    key,
    title: asString(raw.title),
    description: asString(raw.description),
    scope: asStringList(raw.scope, 40),
    suggestedEpics: normalizeEpics(raw.suggestedEpics),
    existingModuleId,
    action
  }
}

function normalizeDependencyList(value: unknown, keys: Set<string>): ModulePlanDependency[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const row = item as Record<string, unknown>
      return { from: asString(row.from), to: asString(row.to), description: asString(row.description) }
    })
    .filter(item => item.from && item.to && keys.has(item.from) && keys.has(item.to))
    .slice(0, 60)
}

function normalizeCoverage(value: unknown): ModulePlanCoverage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const row = item as Record<string, unknown>
      return { requirement: asString(row.requirement), moduleKey: asString(row.moduleKey) }
    })
    .filter(item => item.requirement)
    .slice(0, 80)
}

function normalizeUnassigned(value: unknown): ModulePlanUnassigned[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const row = item as Record<string, unknown>
      return { requirement: asString(row.requirement), reason: asString(row.reason) }
    })
    .filter(item => item.requirement)
    .slice(0, 40)
}

/**
 * 容错归一化。`currentModules` 用于 keep→rename 归一化：
 * keep 但标题/说明与当前模块不同 → 按 rename 处理（不静默丢改动）。
 */
export function normalizeReplanPlan(raw: unknown, currentModules: ReplanCurrentModule[] = []): ReplanPlan {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const modules = Array.isArray(source.modules) ? source.modules.map((item, index) => normalizeItem(item, index)) : []
  const used = new Set<string>()
  modules.forEach((item, index) => {
    let key = item.key
    if (!key || used.has(key)) key = `${item.key || 'm'}${index + 1}`
    while (used.has(key)) key = `${key}_`
    item.key = key
    used.add(key)
  })
  const byId = new Map(currentModules.map(module => [module.id, module]))
  for (const item of modules) {
    if (item.action !== 'keep' || !item.existingModuleId) continue
    const current = byId.get(item.existingModuleId)
    if (!current) continue
    if (item.title !== current.title || item.description !== current.description) item.action = 'rename'
  }
  const keys = new Set(modules.map(item => item.key))
  return {
    kind: 'replan',
    instruction: asString(source.instruction) || DEFAULT_REPLAN_INSTRUCTION,
    modules,
    dependencies: normalizeDependencyList(source.dependencies, keys),
    coverage: normalizeCoverage(source.coverage),
    unassigned: normalizeUnassigned(source.unassigned),
    openIssues: asStringList(source.openIssues, 40),
    warnings: asStringList(source.warnings, 40)
  }
}

const CRUD_TITLE = /^(列表|新增|修改|删除|查询|详情|导入|导出|查看)/

function sameScope(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const a = [...left].sort()
  const b = [...right].sort()
  return a.every((item, index) => item === b[index])
}

export interface ReplanArchiveModule {
  id: string
  moduleKey: string
  title: string
  status: ModuleDocStatus
}

export interface ReplanConfirmedModule {
  id: string
  moduleKey: string
  title: string
}

export interface ReplanValidation {
  errors: string[]
  warnings: string[]
  archiveModules: ReplanArchiveModule[]
  confirmedModules: ReplanConfirmedModule[]
  requiresReopenConfirmed: boolean
}

/**
 * 重新规划校验（RMP-2）：动作/映射/范围/确认/归档。
 * 错误阻塞 apply；覆盖/未分配/数量只做 warning。
 */
export function validateModuleReplan(plan: ReplanPlan, currentModules: ReplanCurrentModule[]): ReplanValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const modules = plan.modules
  if (!modules.length) errors.push('至少需要 1 个模块')
  if (modules.length > MAX_PLAN_MODULES) {
    errors.push(`模块数量超过技术上限 ${MAX_PLAN_MODULES}，请合并/精简后再试`)
  }
  const byId = new Map(currentModules.map(module => [module.id, module]))
  const usedTitles = new Set<string>()
  const mapped = new Map<string, number>()

  modules.forEach((item, index) => {
    const label = `第 ${index + 1} 个模块`
    if (!item.title) {
      errors.push(`${label}标题为空`)
      return
    }
    if (item.title.length > 120) errors.push(`${label}标题超过 120 字`)
    const normalized = item.title.toLowerCase()
    if (usedTitles.has(normalized)) errors.push(`模块标题重复：${item.title}`)
    usedTitles.add(normalized)
    if (!isAction(item.action)) {
      errors.push(`模块「${item.title}」的动作不合法：${item.action || '(空)'}（只能是 keep/rename/regenerate/create）`)
    }
    let current: ReplanCurrentModule | null = null
    if (item.action === 'create') {
      if (item.existingModuleId) errors.push(`新建模块「${item.title}」不能映射已有模块`)
    } else if (isAction(item.action)) {
      if (!item.existingModuleId) {
        errors.push(`模块「${item.title}」缺少 existingModuleId（keep/rename/regenerate 必须映射现有模块）`)
      } else {
        current = byId.get(item.existingModuleId) ?? null
        if (!current) {
          errors.push(`模块「${item.title}」映射的模块不存在或已归档：${item.existingModuleId}`)
        } else if (mapped.has(item.existingModuleId)) {
          errors.push(`同一模块被映射多次：${current.moduleKey} ${current.title}`)
        } else {
          mapped.set(item.existingModuleId, index)
          // keep/rename 不允许改范围（空 scope = 未指定，视为不变）
          if ((item.action === 'keep' || item.action === 'rename') && item.scope.length && current.scope.length) {
            if (!sameScope(item.scope, current.scope)) {
              errors.push(`模块「${item.title}」范围已变化，请改为 regenerate（keep/rename 不生成新内容）`)
            }
          }
        }
      }
    }
    if (CRUD_TITLE.test(item.title) || /(列表|新增|修改|删除|查询)模块$/.test(item.title)) {
      warnings.push(`「${item.title}」看起来像 CRUD 功能而不是业务域，建议并入所属业务域模块`)
    }
  })

  if (modules.length > 8) {
    warnings.push(`共 ${modules.length} 个模块，逐模块生成耗时较长；建议合并同业务域的模块`)
  }
  if (!plan.coverage.length) warnings.push('未提供需求覆盖说明（coverage 为空），请确认没有遗漏')
  if (plan.unassigned.length) warnings.push(`${plan.unassigned.length} 条需求未分配，请确认是否需要补充模块`)
  if (plan.dependencies.length) {
    const keys = new Set(modules.map(item => item.key))
    const invalid = plan.dependencies.filter(item => !keys.has(item.from) || !keys.has(item.to))
    if (invalid.length) warnings.push(`${invalid.length} 条依赖引用了不存在的模块 key，已忽略`)
  }

  const archiveModules = currentModules
    .filter(module => !mapped.has(module.id))
    .map(module => ({ id: module.id, moduleKey: module.moduleKey, title: module.title, status: module.status }))
  if (archiveModules.length) {
    warnings.push(
      `${archiveModules.length} 个当前模块未出现在新计划中，将归档（内容/版本/对话保留，可在模块列表恢复）：${archiveModules
        .map(module => `「${module.title}」`)
        .join('、')}`
    )
  }

  const confirmedById = new Map<string, ReplanConfirmedModule>()
  for (const item of modules) {
    if (!item.existingModuleId || item.action === 'keep' || item.action === 'create') continue
    const current = byId.get(item.existingModuleId)
    if (current?.confirmed) confirmedById.set(current.id, { id: current.id, moduleKey: current.moduleKey, title: current.title })
  }
  for (const module of archiveModules) {
    const current = byId.get(module.id)
    if (current?.confirmed) confirmedById.set(current.id, { id: current.id, moduleKey: current.moduleKey, title: current.title })
  }
  const confirmedModules = Array.from(confirmedById.values())
  if (confirmedModules.length) {
    warnings.push(
      `本次调整会重新打开 ${confirmedModules.length} 个已确认模块（退回草稿），应用级需求确认需重新完成：${confirmedModules
        .map(module => `「${module.title}」`)
        .join('、')}`
    )
  }
  return {
    errors,
    warnings,
    archiveModules,
    confirmedModules,
    requiresReopenConfirmed: confirmedModules.length > 0
  }
}

/** 修复常见 JSON 问题：代码块围栏、首尾说明、尾逗号 */
function repairJsonText(text: string): string {
  let value = String(text ?? '').trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(value)
  if (fence) value = fence[1].trim()
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start >= 0 && end > start) value = value.slice(start, end + 1)
  return value.replace(/,\s*([}\]])/g, '$1')
}

function tryParsePlanJson(text: string): unknown {
  const candidate = repairJsonText(text)
  if (!candidate) return null
  try {
    return JSON.parse(candidate) as unknown
  } catch {
    return null
  }
}

/**
 * 拆分模型输出：分隔符前为回复正文，后为 `MODULE_PLAN_JSON`（kind=replan）。
 * 只处理解析层错误；语义校验由 `validateModuleReplan` 返回结构化 errors。
 */
export function splitModuleReplanOutput(
  raw: string,
  currentModules: ReplanCurrentModule[] = []
): { reply: string; plan: ReplanPlan | null; error: string } {
  const text = String(raw ?? '').trim()
  const index = text.indexOf(MODULE_PLAN_DELIMITER)
  const reply = index >= 0 ? text.slice(0, index).trim() : ''
  const tail = index >= 0 ? text.slice(index + MODULE_PLAN_DELIMITER.length) : text
  const parsed = tryParsePlanJson(tail)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { reply: index >= 0 ? reply : text, plan: null, error: '模型输出里没有可解析的 MODULE_PLAN_JSON（请重试）' }
  }
  const plan = normalizeReplanPlan(parsed, currentModules)
  if (!plan.modules.length) {
    return { reply, plan: null, error: '模块重新规划建议为空（modules 缺失），请重试' }
  }
  return { reply, plan, error: '' }
}

// ---------------------------------------------------------------- prompt

function moduleLine(module: ReplanSourceModule): string {
  return `- ${module.moduleKey} ${module.title}（moduleId: ${module.id}；状态：${module.status}；版本：v${module.version}；范围：${
    module.scope.length ? module.scope.join('；') : '（未记录）'
  }）`
}

/** 重新规划 prompt：当前全部需求 + 当前模块列表 + 动作规则 + `MODULE_PLAN_JSON` 协议 */
export function buildModuleReplanPrompt(input: { appName: string; source: ReplanSource; instruction: string }): string {
  const { appName, source, instruction } = input
  const parts: string[] = [
    `你是需求模块规划 Agent。应用「${appName}」已经有一组需求模块与需求文档，现在需要**基于当前全部需求内容重新规划模块边界**。`,
    '本轮**只规划、不写文档**：不要输出 DOC_JSON、不要生成章节正文、不要创建/修改文件或执行命令。',
    '重新规划的结构变化（合并/拆分/重划边界）不会搬运旧章节或 Epic；新/重新生成模块会基于当前全部需求重新生成完整 PRD，旧模块归档保留。'
  ]

  parts.push(
    [
      '## 当前模块（未归档，按当前顺序）',
      ...source.modules.map(moduleLine),
      '每个模块已经有独立 PRD/版本/确认状态；`moduleId` 是映射用的唯一标识。'
    ].join('\n')
  )

  parts.push(
    [
      '## 当前全部需求内容（用于判断业务域边界）',
      source.truncated ? '（内容过长，以下是截断摘要；不要因为缺失内容臆造功能）' : '',
      source.text || '（当前没有需求内容）'
    ]
      .filter(Boolean)
      .join('\n')
  )

  parts.push(['## 用户调整指令', instruction || DEFAULT_REPLAN_INSTRUCTION].join('\n'))

  parts.push(
    [
      '## 重新规划规则（必须遵守）',
      '1. 模块 = 业务域 / 团队协作边界；模块内部再用场景/Epic/Story 细分。',
      '2. **禁止按 CRUD 或单个实体拆模块**：不要出现「商品列表模块」「新增商品模块」「删除订单模块」这类标题。',
      '3. 同一业务域的实体与其明细归同一个模块（商品 + 商品明细 → 商品管理）。',
      '4. 用户明确排除项不生成模块（例如“不做支付”）。',
      '5. 尽量保留未变业务域：业务域与范围未变的模块用 `action="keep"` + 原 `existingModuleId`；只有标题/说明变化用 `rename`；边界/范围变化用 `regenerate`；全新业务域用 `create`（`existingModuleId=null`）。',
      '6. 合并：新模块用 `create` 或选一个旧模块 `regenerate`；其它旧模块不出现在新计划中（后端归档，内容保留）。',
      '7. 拆分：新目标模块用 `create`；原模块可 `keep`（保留一部分）或不出现在新计划中（归档）。',
      '8. 每个 `existingModuleId` 只能出现一次，且必须来自上面列出的 moduleId；`create` 必须为 null。',
      '9. 标题用业务域名词，非空且唯一，最多 120 字；模块数量由内容决定，>8 个会提示耗时。',
      '10. `scope` 写边界与排除项；`suggestedEpics` 只用于预览（每个 Epic 至少 1 个 Story）。',
      '11. 跨模块关系写进 `dependencies`（from → to，用模块 key 引用），并说明“不重复建实体”。',
      '12. `coverage` 列出每条需求归属哪个模块；无法归属/待确认的放 `unassigned`（不阻塞应用）。',
      '13. 输出**新的完整模块列表**（不是补丁）；旧模块未出现在列表里即视为归档。'
    ].join('\n')
  )

  parts.push(
    [
      '## 输出协议',
      '先输出 1—4 句简短中文回复（说明调整思路），再单独一行输出',
      MODULE_PLAN_DELIMITER,
      '最后输出一个合法 JSON 对象（JSON 之后不要再输出分隔符、代码块或解释）：',
      '{',
      '  "kind": "replan",',
      '  "instruction": "用户调整指令",',
      '  "modules": [',
      '    {',
      '      "key": "product",',
      '      "title": "商品管理",',
      '      "description": "商品与商品明细维护",',
      '      "scope": ["商品档案", "商品明细", "商品与明细 1:1"],',
      '      "suggestedEpics": [{ "title": "商品档案", "stories": ["商品列表", "新增商品"] }],',
      '      "existingModuleId": "m-001",',
      '      "action": "keep"',
      '    },',
      '    {',
      '      "key": "order",',
      '      "title": "订单管理",',
      '      "description": "下单与订单查询，不含售后",',
      '      "scope": ["订单创建", "订单查询"],',
      '      "suggestedEpics": [],',
      '      "existingModuleId": "m-002",',
      '      "action": "regenerate"',
      '    },',
      '    {',
      '      "key": "aftersale",',
      '      "title": "售后管理",',
      '      "description": "售后工单与处理",',
      '      "scope": ["售后申请", "售后处理"],',
      '      "suggestedEpics": [],',
      '      "existingModuleId": null,',
      '      "action": "create"',
      '    }',
      '  ],',
      '  "dependencies": [{ "from": "order", "to": "product", "description": "订单引用商品" }],',
      '  "coverage": [{ "requirement": "商品 CRUD", "moduleKey": "product" }],',
      '  "unassigned": [{ "requirement": "...", "reason": "..." }],',
      '  "openIssues": ["..."],',
      '  "warnings": ["商品与订单合并后原两个模块将归档"]',
      '}',
      '注意：',
      '- `action` 只能是 keep / rename / regenerate / create；',
      '- `existingModuleId` 必须是上面列出的真实 moduleId（create 用 null）；',
      '- `kind` 固定为 "replan"；',
      '- 只输出模块计划，不要输出任何章节正文/DOC_JSON；',
      '- JSON 必须是合法 JSON（不要尾逗号、不要注释、不要 markdown 围栏）。'
    ].join('\n')
  )

  return parts.join('\n\n')
}

// ---------------------------------------------------------------- eligibility

export type ReplanReason = 'ok' | 'stage' | 'change-set' | 'confirmed' | 'no-module'

export interface ReplanEligibility {
  eligible: boolean
  reason: ReplanReason
  message: string
}

/**
 * RMP-2 入口守卫（preview/apply 共用）：
 * requirements + 无 active Change Set + 应用级需求未最终确认 + 至少 1 个未归档模块。
 */
export function replanEligibility(appId: string): ReplanEligibility {
  const app = appRowOrThrow(appId)
  if (app.status === 'design') {
    return {
      eligible: false,
      reason: 'stage',
      message:
        '当前处于设计阶段，不能直接重新规划模块；需求变更请发起“需求+设计”变更（或先重新编辑需求回到需求阶段）'
    }
  }
  if (app.status !== 'requirements') {
    return {
      eligible: false,
      reason: 'stage',
      message: `当前阶段（${app.status}）不能直接重新规划模块；需求变更请发起“需求+设计”变更`
    }
  }
  if (activeChangeSetRow(appId)) {
    return { eligible: false, reason: 'change-set', message: '变更进行中不能重新规划模块；请先完成或取消本次变更' }
  }
  if (app.requirements_confirmed_at) {
    return {
      eligible: false,
      reason: 'confirmed',
      message: '需求已最终确认，模块结构与需求已锁定；如需调整请「重新编辑需求」或发起变更'
    }
  }
  if (!listModules(appId).length) {
    return { eligible: false, reason: 'no-module', message: '应用还没有未归档模块，无法重新规划' }
  }
  return { eligible: true, reason: 'ok', message: '' }
}

// ---------------------------------------------------------------- preview

export interface ModuleReplanPreview {
  plan: ReplanPlan
  reply: string
  currentModules: ReplanCurrentModule[]
  archiveModules: ReplanArchiveModule[]
  confirmedModules: ReplanConfirmedModule[]
  requiresReopenConfirmed: boolean
  errors: string[]
  warnings: string[]
  sourceTruncated: boolean
}

export interface ReplanGeneratorInput {
  appId: string
  prompt: string
  signal?: AbortSignal
}

export type ReplanGenerator = (input: ReplanGeneratorInput) => Promise<string>

async function defaultReplanGenerator(input: ReplanGeneratorInput): Promise<string> {
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
    timeoutMs: REPLAN_GENERATION_TIMEOUT_MS
  })
}

function currentModulesOf(source: ReplanSource): ReplanCurrentModule[] {
  return source.modules.map(module => ({
    id: module.id,
    moduleKey: module.moduleKey,
    title: module.title,
    description: module.description,
    status: module.status,
    version: module.version,
    scope: module.scope,
    confirmed: module.confirmed
  }))
}

function sourceWarnings(source: ReplanSource): string[] {
  if (!source.truncated) return []
  return ['当前全部需求内容较长，规划基于截断摘要（单章节 4k / 单模块 16k / 总计 80k）']
}

export interface ReplanPreviewOptions {
  signal?: AbortSignal
  /** 单测注入：返回模型原始输出；缺省调用 opencode */
  generator?: ReplanGenerator
}

/** 预览重新规划：只读（不写 settings/模块/文档/版本）；模型失败/非法 JSON → 可读错误 */
export async function previewModuleReplan(
  appId: string,
  body: Record<string, unknown> = {},
  options: ReplanPreviewOptions = {}
): Promise<ModuleReplanPreview> {
  const eligibility = replanEligibility(appId)
  if (!eligibility.eligible) throw new RequirementDocError(409, eligibility.message)
  const instruction = asString(body.instruction) || DEFAULT_REPLAN_INSTRUCTION
  const source = collectReplanSource(appId)
  const currentModules = currentModulesOf(source)
  const app = appRowOrThrow(appId)
  const prompt = buildModuleReplanPrompt({ appName: app.name, source, instruction })
  const generator = options.generator ?? defaultReplanGenerator

  let raw: string
  try {
    raw = await generator({ appId, prompt, signal: options.signal })
  } catch (error) {
    if (options.signal?.aborted) throw new RequirementDocError(499, 'AI 规划已中止')
    const message = redact(error instanceof Error ? error.message : String(error))
    throw new RequirementDocError(502, `模块重新规划失败：${message}`)
  }
  if (options.signal?.aborted) throw new RequirementDocError(499, 'AI 规划已中止')

  const parsed = splitModuleReplanOutput(raw, currentModules)
  if (!parsed.plan) throw new RequirementDocError(502, parsed.error)
  const plan: ReplanPlan = { ...parsed.plan, instruction }
  const validation = validateModuleReplan(plan, currentModules)
  return {
    plan,
    reply: parsed.reply,
    currentModules,
    archiveModules: validation.archiveModules,
    confirmedModules: validation.confirmedModules,
    requiresReopenConfirmed: validation.requiresReopenConfirmed,
    errors: validation.errors,
    warnings: [...new Set([...sourceWarnings(source), ...plan.warnings, ...validation.warnings])],
    sourceTruncated: source.truncated
  }
}

// ---------------------------------------------------------------- apply

export interface ReplanAppliedModule {
  id: string
  moduleKey: string
  title: string
  position: number
}

export interface ApplyModuleReplanResult {
  modules: ReplanAppliedModule[]
  kept: ReplanAppliedModule[]
  renamed: ReplanAppliedModule[]
  regenerated: ReplanAppliedModule[]
  created: ReplanAppliedModule[]
  archived: ReplanAppliedModule[]
  reopened: ReplanAppliedModule[]
  generation: Array<{ moduleId: string; title: string }>
  instruction: string
  sourceTruncated: boolean
}

function moduleView(module: ModuleRow): ReplanAppliedModule {
  return { id: module.id, moduleKey: module.module_key, title: module.title, position: module.position }
}

function recordStageEvent(appId: string, event: string, detail: Record<string, unknown>, now: string): void {
  db.prepare('INSERT INTO app_stage_events (app_id, stage, event, detail, created_at) VALUES (?, ?, ?, ?, ?)').run(
    appId,
    'requirements',
    event,
    JSON.stringify(detail),
    now
  )
}

/** 已确认模块重开（等价 reopenRequirementDoc 的语义；调用方在事务内） */
function reopenConfirmedModule(appId: string, moduleId: string, now: string): boolean {
  const row = db
    .prepare('SELECT status FROM app_requirement_docs WHERE app_id = ? AND module_id = ?')
    .get(appId, moduleId) as { status: string } | undefined
  if (row?.status !== 'confirmed') return false
  db.prepare(`
    UPDATE app_requirement_docs SET status = 'draft', confirmed_at = NULL, updated_at = ?
    WHERE app_id = ? AND module_id = ?
  `).run(now, appId, moduleId)
  db.prepare('UPDATE apps SET status = ?, requirements_confirmed_at = NULL, updated_at = ? WHERE id = ?').run(
    'requirements',
    now,
    appId
  )
  const design = db
    .prepare('SELECT status FROM app_design_projects WHERE app_id = ? AND module_id = ?')
    .get(appId, moduleId) as { status: string } | undefined
  if (design?.status === 'confirmed') {
    db.prepare(
      'UPDATE app_design_projects SET status = ?, confirmed_at = NULL, updated_at = ? WHERE app_id = ? AND module_id = ?'
    ).run('draft', now, appId, moduleId)
    recordStageEvent(appId, 'design-reopened', { reason: 'module-replan', moduleId }, now)
  }
  recordStageEvent(appId, 'reopened', { reason: 'module-replan', moduleId }, now)
  return true
}

/**
 * 应用重新规划（单事务）：
 * - 先聚合 source、重开受影响已确认模块；
 * - keep：只改 position；rename：改标题/说明 + 文档标题（不产版本）；
 * - regenerate：改标题/说明/position + 文档标题，加入 generation；
 * - create：新建空文档 v1，加入 generation；
 * - 未匹配旧模块归档（先建后归档；内容/版本/对话保留）；
 * - 写 `modulePlanApplied`（kind=replan，含 moduleId 映射）/`modulePlanSource`；不生成文档。
 */
export function applyModuleReplan(appId: string, body: Record<string, unknown> = {}): ApplyModuleReplanResult {
  const eligibility = replanEligibility(appId)
  if (!eligibility.eligible) throw new RequirementDocError(409, eligibility.message)
  const source = collectReplanSource(appId)
  const currentModules = currentModulesOf(source)
  const plan = normalizeReplanPlan(body.plan, currentModules)
  const validation = validateModuleReplan(plan, currentModules)
  if (validation.errors.length) {
    throw new RequirementDocError(400, `模块重新规划不合法：${validation.errors.join('；')}`)
  }
  if (validation.requiresReopenConfirmed && body.reopenConfirmed !== true) {
    throw new RequirementDocError(
      409,
      `本次调整会重新打开 ${validation.confirmedModules.length} 个已确认模块；请勾选“允许重新打开已确认模块”后重试`,
      validation.confirmedModules.map(module => ({ moduleId: module.id, moduleKey: module.moduleKey, title: module.title }))
    )
  }
  const generationItems = plan.modules.filter(item => item.action === 'create' || item.action === 'regenerate')
  if (generationItems.length && source.contentChars <= 0) {
    throw new RequirementDocError(
      409,
      '当前全部需求内容为空，无法重新生成模块；请先在模块中补充需求内容后再重新规划'
    )
  }
  const app = appRowOrThrow(appId)
  const now = nowIso()
  const kept: ReplanAppliedModule[] = []
  const renamed: ReplanAppliedModule[] = []
  const regenerated: ReplanAppliedModule[] = []
  const created: ReplanAppliedModule[] = []
  const archived: ReplanAppliedModule[] = []
  const reopened: ReplanAppliedModule[] = []
  const appliedModules: AppliedModulePlanModule[] = []
  const generation: Array<{ moduleId: string; title: string }> = []

  const tx = db.transaction(() => {
    // 1. 受影响已确认模块先重开（顺序：映射 rename/regenerate + 被归档的已确认模块）
    for (const item of validation.confirmedModules) {
      const module = moduleOrThrow(appId, item.id)
      if (reopenConfirmedModule(appId, module.id, now)) reopened.push(moduleView(module))
    }

    // 2. 按新计划处理模块（先创建/更新，再归档未匹配）
    plan.modules.forEach((item, index) => {
      if (item.action === 'create') {
        const module = createModuleWithEmptyDoc(appId, {
          title: item.title,
          description: item.description || null,
          docTitle: `${app.name} · ${item.title} 需求文档`,
          position: index
        })
        const view = moduleView(module)
        created.push(view)
        generation.push({ moduleId: module.id, title: module.title })
        appliedModules.push({ ...item, moduleId: module.id, moduleKey: module.module_key })
        return
      }
      const module = moduleOrThrow(appId, item.existingModuleId as string)
      if (module.archived_at) throw new RequirementDocError(409, `模块已归档：${module.title}`)
      if (item.action === 'keep') {
        db.prepare('UPDATE app_modules SET position = ?, updated_at = ? WHERE app_id = ? AND id = ?').run(
          index,
          now,
          appId,
          module.id
        )
        const updated = moduleOrThrow(appId, module.id)
        kept.push(moduleView(updated))
        appliedModules.push({ ...item, moduleId: updated.id, moduleKey: updated.module_key })
        return
      }
      // rename / regenerate：更新模块标题/说明/position + 文档标题
      db.prepare('UPDATE app_modules SET title = ?, description = ?, position = ?, updated_at = ? WHERE app_id = ? AND id = ?').run(
        item.title,
        item.description || null,
        index,
        now,
        appId,
        module.id
      )
      updateRequirementDocTitle(appId, module.id, `${app.name} · ${item.title} 需求文档`)
      const updated = moduleOrThrow(appId, module.id)
      if (item.action === 'rename') {
        renamed.push(moduleView(updated))
      } else {
        regenerated.push(moduleView(updated))
        generation.push({ moduleId: updated.id, title: updated.title })
      }
      appliedModules.push({ ...item, moduleId: updated.id, moduleKey: updated.module_key })
    })

    // 3. 归档未匹配旧模块（此时新模块已创建，active ≥ 1 始终成立）
    const mappedIds = new Set(appliedModules.map(item => item.moduleId))
    for (const module of source.modules) {
      if (mappedIds.has(module.id)) continue
      const view = archiveModule(appId, module.id)
      archived.push({ id: view.id, moduleKey: view.moduleKey, title: view.title, position: view.position })
    }

    // 4. 写生成输入（source 为旧模块全部需求聚合；截断到 60k）
    const appliedPlan: AppliedModulePlan = {
      kind: 'replan',
      instruction: plan.instruction,
      modules: appliedModules,
      dependencies: plan.dependencies,
      coverage: plan.coverage,
      unassigned: plan.unassigned,
      openIssues: plan.openIssues,
      warnings: plan.warnings
    }
    writeSetting(`app.${appId}.modulePlanApplied`, appliedPlan)
    writeSetting(`app.${appId}.modulePlanSource`, source.text.slice(0, MAX_PLAN_SOURCE_CHARS))

    recordStageEvent(
      appId,
      'module-replan-applied',
      {
        kept: kept.length,
        renamed: renamed.length,
        regenerated: regenerated.length,
        created: created.length,
        archived: archived.length,
        reopened: reopened.length,
        instructionLength: plan.instruction.length
      },
      now
    )
  })
  tx()

  return {
    modules: listModules(appId).map(module => ({
      id: module.id,
      moduleKey: module.moduleKey,
      title: module.title,
      position: module.position
    })),
    kept,
    renamed,
    regenerated,
    created,
    archived,
    reopened,
    generation,
    instruction: plan.instruction,
    sourceTruncated: source.truncated
  }
}
