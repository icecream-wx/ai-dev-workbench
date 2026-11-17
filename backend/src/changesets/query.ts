/**
 * 变更单查询/轻量更新（C1）
 *
 * 只依赖 db，不依赖 requirements/design/handoff，避免循环 import：
 * - 需求/设计/交接包服务需要“查询 active 变更单”“推进变更单状态”时引用这里；
 * - 变更单服务（service.ts）再在它之上编排业务动作。
 *
 * active 定义：status NOT IN ('completed','cancelled')；一个应用同时只允许一个。
 */
import { db, nowIso } from '../db'

export type ChangeSetScope = 'requirements' | 'design'

export interface ChangeSetRow {
  id: string
  app_id: string
  seq: number
  title: string
  description: string | null
  scope: string
  status: string
  base_requirements_version: number | null
  base_design_version: number | null
  base_handoff_version: number | null
  base_input_id: string | null
  base_app_status: string | null
  base_completed_at: string | null
  base_change_set_id: string | null
  base_session_id: string | null
  current_requirements_version: number | null
  current_design_version: number | null
  current_handoff_version: number | null
  changes_md: string | null
  summary_json: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

/** M5：变更单模块范围行（基线/当前需求与设计版本 + hash + 基线原型模板） */
export interface ChangeSetModuleRow {
  change_set_id: string
  module_id: string
  req_base_version: number | null
  req_base_hash: string | null
  req_current_version: number | null
  req_current_hash: string | null
  design_base_version: number | null
  design_base_hash: string | null
  design_base_template_id: string | null
  design_current_version: number | null
  design_current_hash: string | null
  created_at: string
  updated_at: string
}

/** 对外视图：每个选中模块的需求/设计版本区间（单模块旧字段仍保留） */
export interface ChangeSetModuleView {
  moduleId: string
  moduleKey: string
  title: string
  reqBaseVersion: number | null
  reqCurrentVersion: number | null
  reqBaseHash: string | null
  reqCurrentHash: string | null
  designBaseVersion: number | null
  designCurrentVersion: number | null
  designBaseHash: string | null
  designCurrentHash: string | null
  templateId: string | null
}

/** 对外视图：历史面板/应用头部使用 */
export interface ChangeSetView {
  id: string
  seq: number
  title: string
  description: string
  scope: string
  status: string
  baseRequirementsVersion: number | null
  baseDesignVersion: number | null
  baseHandoffVersion: number | null
  currentRequirementsVersion: number | null
  currentDesignVersion: number | null
  currentHandoffVersion: number | null
  baseAppStatus: string | null
  baseCompletedAt: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  summary: unknown
  changesMd: string | null
  /** M5：本次变更包含的模块（旧变更单为空数组） */
  modules: ChangeSetModuleView[]
  /** 是否为进行中（status 不在 completed/cancelled） */
  active: boolean
  /** 服务端计算的取消门禁（C1b 用，不要前端猜） */
  canCancel: boolean
  cancelBlockedReason: string | null
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function isClosedChangeSet(status: string): boolean {
  return status === 'completed' || status === 'cancelled'
}

interface CancelabilityRow {
  status: string
  version: number
}

/**
 * 取消门禁（C1 §4.3；M5 按模块行）：
 * - 必须是该应用当前 active 单；
 * - 该单没有生成过交接包；
 * - 任一选中模块的需求或设计已确认且与**该模块**基线不同（改一半的草稿不算）。
 *
 * 旧变更单（没有 app_change_set_modules 行）回退到 M4 的应用级单模块判断。
 */
export function cancelabilityOf(row: ChangeSetRow): { canCancel: boolean; reason: string | null } {
  if (isClosedChangeSet(row.status)) {
    return { canCancel: false, reason: row.status === 'cancelled' ? '变更已取消' : '变更已完成' }
  }
  if (activeChangeSetRow(row.app_id)?.id !== row.id) {
    return { canCancel: false, reason: '不是当前进行中的变更单' }
  }
  const handoff = db
    .prepare('SELECT COUNT(*) AS count FROM design_handoffs WHERE app_id = ? AND change_set_id = ?')
    .get(row.app_id, row.id) as { count: number }
  if (handoff.count > 0) {
    return {
      canCancel: false,
      reason: '本次变更已生成交接包，不能取消；请完成本次变更，或完成后发起新的变更'
    }
  }
  const moduleRows = changeSetModuleRows(row.id)
  let requirementsChanged = false
  let designChanged = false
  if (moduleRows.length) {
    for (const moduleRow of moduleRows) {
      const doc = db
        .prepare('SELECT status, version FROM app_requirement_docs WHERE app_id = ? AND module_id = ?')
        .get(row.app_id, moduleRow.module_id) as CancelabilityRow | undefined
      const project = db
        .prepare('SELECT status, version FROM app_design_projects WHERE app_id = ? AND module_id = ?')
        .get(row.app_id, moduleRow.module_id) as CancelabilityRow | undefined
      // 变更中新增的模块没有基线（base=null）：已确认即视为有差异
      if (doc?.status === 'confirmed') {
        if (moduleRow.req_base_version === null || doc.version !== moduleRow.req_base_version) requirementsChanged = true
      }
      if (project?.status === 'confirmed') {
        if (moduleRow.design_base_version === null || project.version !== moduleRow.design_base_version) designChanged = true
      }
    }
  } else {
    const doc = db.prepare('SELECT status, version FROM app_requirement_docs WHERE app_id = ?').get(row.app_id) as
      | CancelabilityRow
      | undefined
    const project = db.prepare('SELECT status, version FROM app_design_projects WHERE app_id = ?').get(row.app_id) as
      | CancelabilityRow
      | undefined
    requirementsChanged = doc?.status === 'confirmed' && doc.version !== row.base_requirements_version
    designChanged = project?.status === 'confirmed' && project.version !== row.base_design_version
  }
  if (!requirementsChanged && !designChanged) {
    return {
      canCancel: false,
      reason: '还没有已确认的需求/设计差异（编辑中的草稿不算）；继续编辑并确认后可取消'
    }
  }
  return { canCancel: true, reason: null }
}

/** 变更单模块行（无行时返回 []；按模块 position 排序） */
export function changeSetModuleRows(changeSetId: string): ChangeSetModuleRow[] {
  return db
    .prepare(`
      SELECT cm.*
      FROM app_change_set_modules cm
      LEFT JOIN app_modules m ON m.id = cm.module_id
      WHERE cm.change_set_id = ?
      ORDER BY COALESCE(m.position, 9999) ASC, COALESCE(m.module_key, '') ASC
    `)
    .all(changeSetId) as ChangeSetModuleRow[]
}

/** 对外模块视图（JOIN 模块显示名；模块仍存在） */
export function changeSetModulesView(changeSetId: string): ChangeSetModuleView[] {
  const rows = db
    .prepare(`
      SELECT cm.*, m.module_key AS module_key, m.title AS module_title
      FROM app_change_set_modules cm
      LEFT JOIN app_modules m ON m.id = cm.module_id
      WHERE cm.change_set_id = ?
      ORDER BY COALESCE(m.position, 9999) ASC, COALESCE(m.module_key, '') ASC
    `)
    .all(changeSetId) as Array<ChangeSetModuleRow & { module_key: string | null; module_title: string | null }>
  return rows.map(row => ({
    moduleId: row.module_id,
    moduleKey: row.module_key ?? '',
    title: row.module_title ?? '',
    reqBaseVersion: row.req_base_version,
    reqCurrentVersion: row.req_current_version,
    reqBaseHash: row.req_base_hash,
    reqCurrentHash: row.req_current_hash,
    designBaseVersion: row.design_base_version,
    designCurrentVersion: row.design_current_version,
    designBaseHash: row.design_base_hash,
    designCurrentHash: row.design_current_hash,
    templateId: row.design_base_template_id
  }))
}

export interface ChangeSetModuleInput {
  reqBaseVersion: number | null
  reqBaseHash: string | null
  reqCurrentVersion: number | null
  reqCurrentHash: string | null
  designBaseVersion: number | null
  designBaseHash: string | null
  designBaseTemplateId: string | null
  designCurrentVersion: number | null
  designCurrentHash: string | null
}

/** 写入一个模块范围行（startChangeSet / 变更中新增模块） */
export function insertChangeSetModule(changeSetId: string, moduleId: string, input: ChangeSetModuleInput): void {
  const now = nowIso()
  db.prepare(`
    INSERT INTO app_change_set_modules
      (change_set_id, module_id, req_base_version, req_base_hash, req_current_version, req_current_hash,
       design_base_version, design_base_hash, design_base_template_id,
       design_current_version, design_current_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    changeSetId,
    moduleId,
    input.reqBaseVersion,
    input.reqBaseHash,
    input.reqCurrentVersion,
    input.reqCurrentHash,
    input.designBaseVersion,
    input.designBaseHash,
    input.designBaseTemplateId,
    input.designCurrentVersion,
    input.designCurrentHash,
    now,
    now
  )
}

export interface ChangeSetModulePatch {
  reqCurrentVersion?: number | null
  reqCurrentHash?: string | null
  designCurrentVersion?: number | null
  designCurrentHash?: string | null
}

/** 同步模块 current 版本/hash（模块确认/设计确认/版本快照时调用；无该行静默跳过） */
export function touchChangeSetModule(changeSetId: string, moduleId: string, patch: ChangeSetModulePatch): void {
  const sets: string[] = []
  const values: unknown[] = []
  if (patch.reqCurrentVersion !== undefined) {
    sets.push('req_current_version = ?')
    values.push(patch.reqCurrentVersion)
  }
  if (patch.reqCurrentHash !== undefined) {
    sets.push('req_current_hash = ?')
    values.push(patch.reqCurrentHash)
  }
  if (patch.designCurrentVersion !== undefined) {
    sets.push('design_current_version = ?')
    values.push(patch.designCurrentVersion)
  }
  if (patch.designCurrentHash !== undefined) {
    sets.push('design_current_hash = ?')
    values.push(patch.designCurrentHash)
  }
  if (!sets.length) return
  sets.push('updated_at = ?')
  values.push(nowIso())
  values.push(changeSetId, moduleId)
  db.prepare(`UPDATE app_change_set_modules SET ${sets.join(', ')} WHERE change_set_id = ? AND module_id = ?`).run(...values)
}

/** 当前 active 变更单的模块范围；没有 active 返回 null（不限写） */
export function activeChangeSetModuleIds(appId: string): Set<string> | null {
  const active = activeChangeSetRow(appId)
  if (!active) return null
  const rows = changeSetModuleRows(active.id)
  if (!rows.length) return null
  return new Set(rows.map(row => row.module_id))
}

/** M5 写门禁：有 active 变更单时，只有选中模块可写；未选 409「本次变更未包含模块」 */
export function assertModuleInActiveChangeSet(appId: string, moduleId: string): void {
  const active = activeChangeSetRow(appId)
  if (!active) return
  const rows = changeSetModuleRows(active.id)
  if (!rows.length) return
  if (rows.some(row => row.module_id === moduleId)) return
  const module = db.prepare('SELECT title, module_key FROM app_modules WHERE id = ?').get(moduleId) as
    | { title: string; module_key: string }
    | undefined
  const label = module ? `${module.module_key} ${module.title}`.trim() : moduleId
  const error = new Error(`本次变更未包含模块「${label}」；请切换到变更范围内的模块，或取消本次变更`) as Error & {
    status: number
  }
  error.status = 409
  throw error
}

/** M5 应用级写门禁：有 active 变更单但未覆盖全部未归档模块时，禁止应用级整体操作 */
export function assertAllModulesInActiveChangeSet(appId: string): void {
  const active = activeChangeSetRow(appId)
  if (!active) return
  const rows = changeSetModuleRows(active.id)
  if (!rows.length) return
  const selected = new Set(rows.map(row => row.module_id))
  const modules = db
    .prepare('SELECT id, module_key, title FROM app_modules WHERE app_id = ? AND archived_at IS NULL')
    .all(appId) as Array<{ id: string; module_key: string; title: string }>
  const missing = modules.filter(module => !selected.has(module.id))
  if (!missing.length) return
  const error = new Error(
    `本次变更只包含 ${selected.size} 个模块（未包含：${missing.map(item => `${item.module_key} ${item.title}`).join('、')}），不能做应用级整体切换；请使用单模块操作或先取消变更`
  ) as Error & { status: number; issues?: unknown }
  error.status = 409
  error.issues = missing.map(item => ({ moduleId: item.id, moduleKey: item.module_key, title: item.title }))
  throw error
}

export function changeSetView(row: ChangeSetRow): ChangeSetView {
  const cancel = cancelabilityOf(row)
  return {
    id: row.id,
    seq: row.seq,
    title: row.title,
    description: row.description ?? '',
    scope: row.scope,
    status: row.status,
    baseRequirementsVersion: row.base_requirements_version,
    baseDesignVersion: row.base_design_version,
    baseHandoffVersion: row.base_handoff_version,
    currentRequirementsVersion: row.current_requirements_version,
    currentDesignVersion: row.current_design_version,
    currentHandoffVersion: row.current_handoff_version,
    baseAppStatus: row.base_app_status,
    baseCompletedAt: row.base_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    summary: parseJson<unknown>(row.summary_json, null),
    changesMd: row.changes_md,
    modules: changeSetModulesView(row.id),
    active: !isClosedChangeSet(row.status),
    canCancel: cancel.canCancel,
    cancelBlockedReason: cancel.reason
  }
}

/** 进行中的变更单（最新一单；正常情况下只有一单） */
export function activeChangeSetRow(appId: string): ChangeSetRow | undefined {
  return db
    .prepare(
      `SELECT * FROM app_change_sets
       WHERE app_id = ? AND status NOT IN ('completed','cancelled')
       ORDER BY seq DESC LIMIT 1`
    )
    .get(appId) as ChangeSetRow | undefined
}

export function latestChangeSetRow(appId: string): ChangeSetRow | undefined {
  return db.prepare('SELECT * FROM app_change_sets WHERE app_id = ? ORDER BY seq DESC LIMIT 1').get(appId) as
    | ChangeSetRow
    | undefined
}

export function changeSetRowById(appId: string, id: string | null | undefined): ChangeSetRow | undefined {
  if (!id) return undefined
  return db.prepare('SELECT * FROM app_change_sets WHERE app_id = ? AND id = ?').get(appId, id) as
    | ChangeSetRow
    | undefined
}

export function listChangeSetRows(appId: string): ChangeSetRow[] {
  return db.prepare('SELECT * FROM app_change_sets WHERE app_id = ? ORDER BY seq DESC').all(appId) as ChangeSetRow[]
}

export function nextChangeSetSeq(appId: string): number {
  const row = db.prepare('SELECT MAX(seq) AS seq FROM app_change_sets WHERE app_id = ?').get(appId) as
    | { seq: number | null }
    | undefined
  return (row?.seq ?? 0) + 1
}

export interface ChangeSetPatch {
  status?: string
  requirementsVersion?: number | null
  designVersion?: number | null
  handoffVersion?: number | null
  changesMd?: string | null
  summary?: unknown
  completedAt?: string | null
}

/** 更新 active 变更单（没有 active 时静默跳过，调用方无需判断） */
export function updateActiveChangeSet(appId: string, patch: ChangeSetPatch): ChangeSetRow | undefined {
  const row = activeChangeSetRow(appId)
  if (!row) return undefined
  updateChangeSet(appId, row.id, patch)
  return changeSetRowById(appId, row.id)
}

export function updateChangeSet(appId: string, id: string, patch: ChangeSetPatch): void {
  const sets: string[] = []
  const values: unknown[] = []
  if (patch.status !== undefined) {
    sets.push('status = ?')
    values.push(patch.status)
  }
  if (patch.requirementsVersion !== undefined) {
    sets.push('current_requirements_version = ?')
    values.push(patch.requirementsVersion)
  }
  if (patch.designVersion !== undefined) {
    sets.push('current_design_version = ?')
    values.push(patch.designVersion)
  }
  if (patch.handoffVersion !== undefined) {
    sets.push('current_handoff_version = ?')
    values.push(patch.handoffVersion)
  }
  if (patch.changesMd !== undefined) {
    sets.push('changes_md = ?')
    values.push(patch.changesMd)
  }
  if (patch.summary !== undefined) {
    sets.push('summary_json = ?')
    values.push(patch.summary === null ? null : JSON.stringify(patch.summary))
  }
  if (patch.completedAt !== undefined) {
    sets.push('completed_at = ?')
    values.push(patch.completedAt)
  }
  if (!sets.length) return
  sets.push('updated_at = ?')
  values.push(nowIso())
  values.push(appId, id)
  db.prepare(`UPDATE app_change_sets SET ${sets.join(', ')} WHERE app_id = ? AND id = ?`).run(...values)
}

/** 交接包生成后由 handoff 服务调用：绑定变更单为开发中并记录本次产出 */
export function markChangeSetGenerated(
  appId: string,
  id: string,
  input: {
    status: string
    requirementsVersion: number | null
    designVersion: number | null
    handoffVersion: number
    changesMd: string | null
    summary: unknown
  }
): void {
  updateChangeSet(appId, id, {
    status: input.status,
    requirementsVersion: input.requirementsVersion,
    designVersion: input.designVersion,
    handoffVersion: input.handoffVersion,
    changesMd: input.changesMd,
    summary: input.summary
  })
}
