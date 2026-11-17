/**
 * 需求模块首次规划（RMP-1）：MODULE_PLAN_JSON 解析/校验 + 结构应用。
 *
 * 只处理“新应用、单个空默认模块、需求阶段、未最终确认”的首次规划：
 * - 规划本身只写聊天消息（由前端/chat 负责），不写文档、不建模块；
 * - 只有用户在建议卡点“应用拆分并生成”才调用 `applyModulePlan` 写库；
 * - 模块结构复用默认模块（保留 ID/文档/对话）+ 按顺序新建其余模块；
 * - 不新增表：规划结果/原始需求写入 `app_settings`，供逐模块生成读取。
 *
 * RMP-2（随时重规划、keep/rename/regenerate/archive）不在本文件范围。
 */
import { db, nowIso, readSetting, writeSetting } from '../db'
import { activeChangeSetRow } from '../changesets/query'
import { RequirementDocError } from './templates'
import {
  appRowOrThrow,
  createModuleWithEmptyDoc,
  listModules,
  moduleOrThrow,
  type ModuleRow
} from './modules'
import { ensureRequirementDoc, renderContentMd } from './doc'
import type { RequirementDocPayload } from './types'

export const MODULE_PLAN_DELIMITER = '<<<MODULE_PLAN_JSON>>>'
/** 技术保护：超过即 400（设计稿：不设业务硬上限，>8 warning） */
export const MAX_PLAN_MODULES = 50
/** 生成 prompt 里保留的原始需求上限 */
export const MAX_PLAN_SOURCE_CHARS = 60_000

export interface ModulePlanEpicSuggestion {
  title: string
  stories: string[]
}

export interface ModulePlanItem {
  /** AI 临时 key（依赖/覆盖引用）；apply 时映射为真实 moduleId */
  key: string
  title: string
  description: string
  scope: string[]
  suggestedEpics: ModulePlanEpicSuggestion[]
  /** RMP-1 固定为空 */
  existingModuleId: string | null
  /** RMP-1 固定为 create（其它动作 RMP-2 才支持，后端会拒绝） */
  action: string
}

export interface ModulePlanDependency {
  from: string
  to: string
  description: string
}

export interface ModulePlanCoverage {
  requirement: string
  moduleKey: string
}

export interface ModulePlanUnassigned {
  requirement: string
  reason: string
}

/** RMP-1 首次规划 / RMP-2 随时重新规划（同一分隔符，kind 区分） */
export type ModulePlanKind = 'initial' | 'replan'

export interface ModulePlan {
  kind: ModulePlanKind
  modules: ModulePlanItem[]
  dependencies: ModulePlanDependency[]
  coverage: ModulePlanCoverage[]
  unassigned: ModulePlanUnassigned[]
  openIssues: string[]
  warnings: string[]
  /** RMP-2：用户重新规划的调整指令（RMP-1 不写） */
  instruction?: string
}

export interface AppliedModulePlanModule extends ModulePlanItem {
  moduleId: string
  moduleKey: string
}

/** 写入 `app.<id>.modulePlanApplied` 的结构（生成时读取） */
export interface AppliedModulePlan extends Omit<ModulePlan, 'modules'> {
  modules: AppliedModulePlanModule[]
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringList(value: unknown, limit = 20): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => asString(item))
    .filter(Boolean)
    .slice(0, limit)
}

function normalizeEpics(value: unknown): ModulePlanEpicSuggestion[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map(item => {
      const raw = item as Record<string, unknown>
      return {
        title: asString(raw.title),
        stories: asStringList(raw.stories, 30)
      }
    })
    .filter(item => item.title)
    .slice(0, 20)
}

function normalizeItem(value: unknown, index: number): ModulePlanItem {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const key = asString(raw.key) || `m${index + 1}`
  const action = asString(raw.action)
  return {
    key,
    title: asString(raw.title),
    description: asString(raw.description),
    scope: asStringList(raw.scope, 40),
    suggestedEpics: normalizeEpics(raw.suggestedEpics),
    existingModuleId: asString(raw.existingModuleId) || null,
    // RMP-1 只支持 create；保留其它动作供校验拒绝（不静默改写）
    action: action || 'create'
  }
}

/** 容错归一化：字段缺失/类型错误一律降级，不抛错（校验走 `validateModulePlan`） */
export function normalizeModulePlan(raw: unknown): ModulePlan {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const modules = Array.isArray(source.modules) ? source.modules.map((item, index) => normalizeItem(item, index)) : []
  // key 唯一（重复时补序号，避免依赖引用错乱）
  const used = new Set<string>()
  modules.forEach((item, index) => {
    let key = item.key
    if (!key || used.has(key)) key = `${item.key || 'm'}${index + 1}`
    while (used.has(key)) key = `${key}_`
    item.key = key
    used.add(key)
  })
  const keys = new Set(modules.map(item => item.key))
  const dependencies: ModulePlanDependency[] = Array.isArray(source.dependencies)
    ? source.dependencies
        .filter(item => item && typeof item === 'object')
        .map(item => {
          const row = item as Record<string, unknown>
          return { from: asString(row.from), to: asString(row.to), description: asString(row.description) }
        })
        .filter(item => item.from && item.to)
        .slice(0, 60)
    .filter(item => keys.has(item.from) && keys.has(item.to))
    : []
  const coverage: ModulePlanCoverage[] = Array.isArray(source.coverage)
    ? source.coverage
        .filter(item => item && typeof item === 'object')
        .map(item => {
          const row = item as Record<string, unknown>
          return { requirement: asString(row.requirement), moduleKey: asString(row.moduleKey) }
        })
        .filter(item => item.requirement)
        .slice(0, 80)
    : []
  const unassigned: ModulePlanUnassigned[] = Array.isArray(source.unassigned)
    ? source.unassigned
        .filter(item => item && typeof item === 'object')
        .map(item => {
          const row = item as Record<string, unknown>
          return { requirement: asString(row.requirement), reason: asString(row.reason) }
        })
        .filter(item => item.requirement)
        .slice(0, 40)
    : []
  return {
    kind: 'initial',
    modules,
    dependencies,
    coverage,
    unassigned,
    openIssues: asStringList(source.openIssues, 40),
    warnings: asStringList(source.warnings, 40)
  }
}

const CRUD_TITLE = /^(列表|新增|修改|删除|查询|详情|导入|导出|查看)/

/** 规划校验（RMP-1 保守口径）：返回可读错误与不阻塞 warning */
export function validateModulePlan(plan: ModulePlan): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const modules = plan.modules
  if (!modules.length) {
    errors.push('至少需要 1 个模块')
  }
  if (modules.length > MAX_PLAN_MODULES) {
    errors.push(`模块数量超过技术上限 ${MAX_PLAN_MODULES}，请合并/精简后再试`)
  }
  const seen = new Set<string>()
  modules.forEach((item, index) => {
    const label = `第 ${index + 1} 个模块`
    if (!item.title) {
      errors.push(`${label}标题为空`)
      return
    }
    if (item.title.length > 120) errors.push(`${label}标题超过 120 字`)
    const normalized = item.title.toLowerCase()
    if (seen.has(normalized)) errors.push(`模块标题重复：${item.title}`)
    seen.add(normalized)
    if (item.existingModuleId) errors.push(`模块「${item.title}」的 existingModuleId 必须为空（RMP-1 只支持新建）`)
    if (item.action !== 'create') errors.push(`模块「${item.title}」的 action 只能是 create（RMP-1 只支持新建）`)
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
  return { errors, warnings }
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
 * 拆分模型输出：分隔符前为回复正文，后为 MODULE_PLAN_JSON。
 * 无法解析出含 modules 的对象时返回 `plan=null` + 可读错误。
 */
export function splitModulePlanOutput(raw: string): { reply: string; plan: ModulePlan | null; error: string } {
  const text = String(raw ?? '').trim()
  const index = text.indexOf(MODULE_PLAN_DELIMITER)
  const reply = index >= 0 ? text.slice(0, index).trim() : ''
  const tail = index >= 0 ? text.slice(index + MODULE_PLAN_DELIMITER.length) : text
  const parsed = tryParsePlanJson(tail)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { reply: index >= 0 ? reply : text, plan: null, error: '模型输出里没有可解析的 MODULE_PLAN_JSON（请重试或补充需求）' }
  }
  const plan = normalizeModulePlan(parsed)
  if (!plan.modules.length) {
    return { reply, plan: null, error: '模块拆分建议为空（modules 缺失），请重试' }
  }
  const validation = validateModulePlan(plan)
  if (validation.errors.length) {
    return { reply, plan, error: validation.errors.join('；') }
  }
  return { reply, plan, error: '' }
}

// ---------------------------------------------------------------- eligibility

export type InitialPlanReason =
  | 'ok'
  | 'stage'
  | 'change-set'
  | 'confirmed'
  | 'module-count'
  | 'doc-status'
  | 'doc-not-empty'

export interface InitialPlanEligibility {
  eligible: boolean
  reason: InitialPlanReason
  message: string
  moduleId: string | null
  moduleTitle: string | null
}

/** 文档是否完全为空（所有章节 markdown 为空且结构化章节没有条目） */
export function isEmptyRequirementDoc(payload: RequirementDocPayload): boolean {
  return payload.sections.every(section => {
    if (section.markdown.trim()) return false
    if (!section.data) return true
    return !section.data.scenes.length && !section.data.epics.length && !section.data.stories.length
  })
}

/**
 * 首次规划守卫（聊天/apply 共用）：
 * requirements + 无 active Change Set + 恰好 1 个未归档模块 + 文档 draft 且全空 + 未最终确认。
 */
export function initialPlanEligibility(appId: string): InitialPlanEligibility {
  const app = appRowOrThrow(appId)
  const fail = (reason: InitialPlanReason, message: string, module?: ModuleRow | null): InitialPlanEligibility => ({
    eligible: false,
    reason,
    message,
    moduleId: module?.id ?? null,
    moduleTitle: module?.title ?? null
  })

  if (app.status !== 'requirements') {
    return fail(
      'stage',
      `当前阶段（${app.status}）不能进行首次模块规划；设计阶段请先「重新编辑需求」，开发/完成阶段请发起“需求+设计”变更`
    )
  }
  if (activeChangeSetRow(appId)) {
    return fail('change-set', '变更进行中，不能进行首次模块规划；请先完成或取消本次变更')
  }
  if (app.requirements_confirmed_at) {
    return fail('confirmed', '需求已确认，模块结构与需求已锁定；如需调整请重新编辑需求或发起变更')
  }
  const modules = listModules(appId)
  if (modules.length !== 1) {
    return fail(
      'module-count',
      modules.length === 0
        ? '应用还没有未归档模块，无法进行首次模块规划'
        : `当前有 ${modules.length} 个未归档模块，已不是首次规划；请按现有单模块流程继续（重规划后续版本提供）`
    )
  }
  const module = moduleOrThrow(appId, modules[0].id)
  const payload = ensureRequirementDoc(appId, undefined, module.id)
  if (payload.doc.status !== 'draft') {
    return fail('doc-status', '当前模块需求不是草稿状态，不能覆盖生成；请先「重新编辑需求」', module)
  }
  if (!isEmptyRequirementDoc(payload)) {
    return fail('doc-not-empty', '当前模块需求文档已有内容，不再自动进入首次规划；请按现有单模块流程继续（重规划后续版本提供）', module)
  }
  return {
    eligible: true,
    reason: 'ok',
    message: '',
    moduleId: module.id,
    moduleTitle: module.title
  }
}

// ---------------------------------------------------------------- apply

export interface ModulePlanAppliedModule {
  id: string
  moduleKey: string
  title: string
  position: number
}

export interface ApplyModulePlanResult {
  modules: ModulePlanAppliedModule[]
  created: ModulePlanAppliedModule[]
  reused: ModulePlanAppliedModule | null
  generation: Array<{ moduleId: string; title: string }>
}

function chatSourceOf(appId: string, moduleId: string): string {
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
  return parts.join('\n\n').slice(0, MAX_PLAN_SOURCE_CHARS)
}

export interface ApplyModulePlanOptions {
  /** 覆盖原始需求来源（测试/后续复用）；缺省读默认模块聊天的 user 消息 */
  source?: string
}

/**
 * 应用首次模块拆分（单事务）：
 * - 第一个模块复用默认模块：保留 ID/文档/对话，更新标题/描述/position/文档标题；
 * - 其余模块按顺序新建（MOD-002…）；
 * - 写 modulePlanApplied（含 moduleId 映射）/ modulePlanSource；
 * - 不生成文档内容、不确认、不进入 design。
 */
export function applyModulePlan(appId: string, rawPlan: unknown, options: ApplyModulePlanOptions = {}): ApplyModulePlanResult {
  const eligibility = initialPlanEligibility(appId)
  if (!eligibility.eligible) {
    throw new RequirementDocError(409, eligibility.message)
  }
  const plan = normalizeModulePlan(rawPlan)
  const validation = validateModulePlan(plan)
  if (validation.errors.length) {
    throw new RequirementDocError(400, `模块拆分建议不合法：${validation.errors.join('；')}`)
  }
  const app = appRowOrThrow(appId)
  const defaultRow = moduleOrThrow(appId, eligibility.moduleId as string)
  const source = String(options.source ?? chatSourceOf(appId, defaultRow.id)).slice(0, MAX_PLAN_SOURCE_CHARS)
  // MF6：fail-closed——没有原始需求就不允许应用拆分，避免“模块已建、source 为空、生成 409”的半应用状态
  if (!source.trim()) {
    throw new RequirementDocError(409, '缺少原始需求记录，无法应用模块拆分；请先发送需求后重试')
  }
  const now = nowIso()

  const appliedModules: AppliedModulePlanModule[] = []
  const created: ModulePlanAppliedModule[] = []
  let reused: ModulePlanAppliedModule | null = null

  const tx = db.transaction(() => {
    plan.modules.forEach((item, index) => {
      const docTitle = `${app.name} · ${item.title} 需求文档`
      let module: ModuleRow
      if (index === 0) {
        // 复用空默认模块：保留 ID/文档/版本/对话
        db.prepare(`
          UPDATE app_modules SET title = ?, description = ?, required = 1, position = ?, updated_at = ?
          WHERE app_id = ? AND id = ?
        `).run(item.title, item.description || null, index, now, appId, defaultRow.id)
        const payload = ensureRequirementDoc(appId, undefined, defaultRow.id)
        const contentMd = renderContentMd(docTitle, payload.sections)
        db.prepare('UPDATE app_requirement_docs SET title = ?, content_md = ?, updated_at = ? WHERE app_id = ? AND module_id = ?').run(
          docTitle,
          contentMd,
          now,
          appId,
          defaultRow.id
        )
        module = moduleOrThrow(appId, defaultRow.id)
        const view = {
          id: module.id,
          moduleKey: module.module_key,
          title: module.title,
          position: index
        }
        reused = view
        appliedModules.push({ ...item, moduleId: module.id, moduleKey: module.module_key })
        return
      }
      module = createModuleWithEmptyDoc(appId, {
        title: item.title,
        description: item.description || null,
        docTitle,
        position: index
      })
      const view = {
        id: module.id,
        moduleKey: module.module_key,
        title: module.title,
        position: index
      }
      created.push(view)
      appliedModules.push({ ...item, moduleId: module.id, moduleKey: module.module_key })
    })

    const appliedPlan: AppliedModulePlan = {
      ...plan,
      modules: appliedModules
    }
    writeSetting(`app.${appId}.modulePlanApplied`, appliedPlan)
    writeSetting(`app.${appId}.modulePlanSource`, source)
    db.prepare('INSERT INTO app_stage_events (app_id, stage, event, detail, created_at) VALUES (?, ?, ?, ?, ?)').run(
      appId,
      'requirements',
      'module-plan-applied',
      JSON.stringify({ moduleCount: appliedModules.length, createdCount: created.length }),
      now
    )
  })
  tx()

  const modules = listModules(appId).map(item => ({
    id: item.id,
    moduleKey: item.moduleKey,
    title: item.title,
    position: item.position
  }))
  return {
    modules,
    created,
    reused,
    generation: appliedModules.map(item => ({ moduleId: item.moduleId, title: item.title }))
  }
}

/** 读取已应用规划（生成用）；结构不合法返回 null（不猜） */
export function readAppliedModulePlan(appId: string): AppliedModulePlan | null {
  const raw = readSetting<unknown>(`app.${appId}.modulePlanApplied`)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  if (!Array.isArray(value.modules)) return null
  const applied = normalizeModulePlan(value)
  const modules: AppliedModulePlanModule[] = []
  value.modules.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return
    const row = item as Record<string, unknown>
    const moduleId = asString(row.moduleId)
    const moduleKey = asString(row.moduleKey)
    if (!moduleId || !moduleKey) return
    modules.push({
      ...(applied.modules[index] ?? normalizeItem(row, index)),
      moduleId,
      moduleKey
    })
  })
  if (!modules.length) return null
  const kind: ModulePlanKind = value.kind === 'replan' ? 'replan' : 'initial'
  const instruction = asString(value.instruction)
  return {
    kind,
    ...(instruction ? { instruction } : {}),
    modules,
    dependencies: applied.dependencies,
    coverage: applied.coverage,
    unassigned: applied.unassigned,
    openIssues: applied.openIssues,
    warnings: applied.warnings
  }
}

export function readAppliedModulePlanSource(appId: string): string {
  const value = readSetting<unknown>(`app.${appId}.modulePlanSource`)
  return typeof value === 'string' ? value.slice(0, MAX_PLAN_SOURCE_CHARS) : ''
}
