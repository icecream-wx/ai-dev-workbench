/**
 * 变更单服务（C1）
 *
 * 生命周期：
 *   已完成/开发中 → 发起变更（记录基线、需求/设计回 draft、归档旧开发会话）
 *   → 需求确认 → 设计确认 → 生成交接包（绑定时 / 写入 05-CHANGES 摘要）
 *   → 开发 → 确认完成（关闭当前变更单）
 *   或：生成交接包前取消 → 恢复基线版本/应用状态/会话，变更单 cancelled
 *
 * 一个应用同时只允许一个 active 变更单；scope 只有 requirements（需求+设计）/ design（仅设计）。
 * 纯代码修复不属于变更单，直接在开发会话处理。
 */
import { randomUUID } from 'node:crypto'
import { db, nowIso } from '../db'
import {
  activeChangeSetRow,
  cancelabilityOf,
  changeSetModuleRows,
  changeSetRowById,
  changeSetView,
  insertChangeSetModule,
  isClosedChangeSet,
  listChangeSetRows,
  nextChangeSetSeq,
  touchChangeSetModule,
  type ChangeSetRow,
  type ChangeSetScope,
  type ChangeSetView
} from './query'
import { ensureRequirementDoc, restoreRequirementDocVersionConfirmed } from '../requirements/doc'
import {
  createRequirementBundleSnapshot,
  defaultModule,
  listModules,
  moduleById
} from '../requirements/modules'
import { sha256Hex } from '../requirements/module-migration'
import { currentDesignStateHash, restoreDesignVersionConfirmed } from '../design/service'
import { latestDesignInput } from '../design/input'

export class ChangeSetError extends Error {
  readonly status: number
  readonly issues: string[]
  readonly warnings: string[]

  constructor(status: number, message: string, issues: string[] = [], warnings: string[] = []) {
    super(message)
    this.status = status
    this.issues = issues
    this.warnings = warnings
  }
}

interface AppRow {
  id: string
  name: string
  status: string
  completed_at: string | null
  current_change_set_id: string | null
  requirements_confirmed_at: string | null
  design_confirmed_at: string | null
}

interface DesignProjectRow {
  module_id: string
  version: number
  status: string
  source_input_id: string | null
  confirmed_at: string | null
  prototype_template_id: string
}

function appRow(appId: string): AppRow {
  const row = db
    .prepare(
      `SELECT id, name, status, completed_at, current_change_set_id,
              requirements_confirmed_at, design_confirmed_at
       FROM apps WHERE id = ?`
    )
    .get(appId) as AppRow | undefined
  if (!row) throw new ChangeSetError(404, `应用不存在：${appId}`)
  return row
}

function designProjectRow(appId: string, moduleId?: string): DesignProjectRow | undefined {
  // M4：变更单仍是应用级单模块语义；缺省默认模块（多模块已在 startChangeSet 409）
  const module = moduleId ? moduleById(appId, moduleId) : defaultModule(appId)
  if (!module) return undefined
  return db
    .prepare(
      'SELECT module_id, version, status, source_input_id, confirmed_at, prototype_template_id FROM app_design_projects WHERE app_id = ? AND module_id = ?'
    )
    .get(appId, module.id) as DesignProjectRow | undefined
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * 基线原型模板：来自基线交接包的 source_design_json.templateId，
 * 取不到时回退 manifest_json.prototypeTemplate.id（C1 收口：取消要恢复模板）。
 */
function baselineTemplateId(appId: string, cs: ChangeSetRow): string | null {
  if (!cs.base_handoff_version) return null
  const row = db
    .prepare('SELECT source_design_json, manifest_json FROM design_handoffs WHERE app_id = ? AND version = ?')
    .get(appId, cs.base_handoff_version) as { source_design_json: string; manifest_json: string } | undefined
  if (!row) return null
  const source = parseJson<{ templateId?: unknown }>(row.source_design_json, {})
  if (typeof source.templateId === 'string' && source.templateId) return source.templateId
  const manifest = parseJson<Record<string, unknown>>(row.manifest_json, {})
  const template = manifest.prototypeTemplate as { id?: unknown } | undefined
  return typeof template?.id === 'string' && template.id ? template.id : null
}

function latestHandoffVersion(appId: string): number | null {  const row = db.prepare('SELECT MAX(version) AS version FROM design_handoffs WHERE app_id = ?').get(appId) as
    | { version: number | null }
    | undefined
  return row?.version ?? null
}

function activeSessionId(appId: string): string | null {
  const row = db
    .prepare(`SELECT id FROM app_sessions WHERE app_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`)
    .get(appId) as { id: string } | undefined
  return row?.id ?? null
}

function recordStageEvent(appId: string, stage: string, event: string, detail?: Record<string, unknown>): void {
  db.prepare('INSERT INTO app_stage_events (app_id, stage, event, detail, created_at) VALUES (?, ?, ?, ?, ?)').run(
    appId,
    stage,
    event,
    detail ? JSON.stringify(detail) : null,
    nowIso()
  )
}

export interface ChangeSetListResult {
  changeSets: ChangeSetView[]
  active: ChangeSetView | null
}

export function listChangeSets(appId: string): ChangeSetListResult {
  appRow(appId)
  const rows = listChangeSetRows(appId)
  const active = rows.find(row => !isClosedChangeSet(row.status)) ?? null
  return {
    changeSets: rows.map(changeSetView),
    active: active ? changeSetView(active) : null
  }
}

export interface StartChangeSetInput {
  title?: unknown
  description?: unknown
  scope?: unknown
  /** M5：本次变更包含的模块；缺省/空数组 = 全部未归档模块 */
  moduleIds?: unknown
}

export interface StartChangeSetResult {
  changeSet: ChangeSetView
}

/** 解析/校验变更模块选择（M5）：默认全选；显式数组必须非空、无重复、全部为未归档模块 */
function resolveChangeSetModules(appId: string, raw: unknown): Array<{
  id: string
  moduleKey: string
  title: string
  doc: ReturnType<typeof ensureRequirementDoc>
  project: DesignProjectRow
}> {
  const active = listModules(appId, false)
  if (!active.length) throw new ChangeSetError(409, '应用还没有未归档需求模块，不能发起变更')
  const activeById = new Map(active.map(module => [module.id, module]))
  let ids: string[]
  if (raw === undefined || raw === null) {
    ids = active.map(module => module.id)
  } else {
    if (!Array.isArray(raw)) throw new ChangeSetError(400, 'moduleIds 需要是字符串数组')
    if (!raw.length) throw new ChangeSetError(400, 'moduleIds 不能为空；不传则默认全部未归档模块')
    ids = []
    const seen = new Set<string>()
    for (const item of raw) {
      const id = typeof item === 'string' ? item.trim() : ''
      if (!id) throw new ChangeSetError(400, 'moduleIds 需要是非空字符串数组')
      if (seen.has(id)) throw new ChangeSetError(400, `moduleIds 不能重复：${id}`)
      seen.add(id)
      if (!activeById.has(id)) throw new ChangeSetError(400, `moduleIds 含不存在或已归档的模块：${id}`)
      ids.push(id)
    }
  }
  return ids.map(id => {
    const view = activeById.get(id)
    if (!view) throw new ChangeSetError(400, `moduleIds 含不存在或已归档的模块：${id}`)
    const doc = ensureRequirementDoc(appId, undefined, id)
    if (doc.doc.status !== 'confirmed') {
      throw new ChangeSetError(409, `模块「${view.title}」的需求尚未确认，不能发起变更`)
    }
    const project = designProjectRow(appId, id)
    if (!project) throw new ChangeSetError(409, `模块「${view.title}」还没有设计项目，不能发起变更`)
    if (project.status !== 'confirmed') {
      throw new ChangeSetError(409, `模块「${view.title}」的设计尚未确认，不能发起变更`)
    }
    return { id, moduleKey: view.moduleKey, title: view.title, doc, project }
  })
}

/** 发起变更（C1 §4.1 + M5 模块选择）：前置校验 → 记录模块基线 → 选中模块需求/设计回 draft → 归档会话 → 建变更单 */
export function startChangeSet(appId: string, input: StartChangeSetInput): StartChangeSetResult {
  const app = appRow(appId)
  const current = activeChangeSetRow(appId)
  if (current) {
    throw new ChangeSetError(409, `已有进行中的变更单：#${current.seq} ${current.title}，请先完成或取消`)
  }
  if (app.status !== 'development' && app.status !== 'completed') {
    throw new ChangeSetError(409, `只有开发中/已完成的应用可以发起变更（当前阶段：${app.status}）`)
  }
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title) throw new ChangeSetError(400, '变更标题不能为空')
  if (title.length > 120) throw new ChangeSetError(400, '变更标题不能超过 120 字')
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  const scope: ChangeSetScope = input.scope === undefined ? 'requirements' : (input.scope as ChangeSetScope)
  if (scope !== 'requirements' && scope !== 'design') {
    throw new ChangeSetError(400, 'scope 只能是 requirements 或 design')
  }
  // M5：不再对多模块 409；按选中模块记录范围，未选模块保持不动
  const selected = resolveChangeSetModules(appId, input.moduleIds)
  const handoffVersion = latestHandoffVersion(appId)
  if (!handoffVersion) {
    throw new ChangeSetError(409, '还没有生成交接包，不能发起变更；请先生成首次开发交接包')
  }

  const now = nowIso()
  const sessionId = activeSessionId(appId)
  const baseRequirementsVersion = Math.max(...selected.map(item => item.doc.doc.version))
  const baseDesignVersion = Math.max(...selected.map(item => item.project.version))
  // 兼容旧字段：base_input_id 取默认模块（未选默认模块时取第一个选中模块）
  const defaultId = defaultModule(appId)?.id
  const baseInputOwner = selected.find(item => item.id === defaultId) ?? selected[0]
  const row: ChangeSetRow = {
    id: `cs-${randomUUID()}`,
    app_id: appId,
    seq: nextChangeSetSeq(appId),
    title,
    description: description || null,
    scope,
    status: scope,
    base_requirements_version: baseRequirementsVersion,
    base_design_version: baseDesignVersion,
    base_handoff_version: handoffVersion,
    base_input_id: baseInputOwner.project.source_input_id,
    base_app_status: app.status,
    base_completed_at: app.completed_at,
    base_change_set_id: app.current_change_set_id,
    base_session_id: sessionId,
    current_requirements_version: baseRequirementsVersion,
    current_design_version: baseDesignVersion,
    current_handoff_version: handoffVersion,
    changes_md: null,
    summary_json: null,
    created_at: now,
    updated_at: now,
    completed_at: null
  }
  const moduleIds = selected.map(item => item.id)

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO app_change_sets
        (id, app_id, seq, title, description, scope, status,
         base_requirements_version, base_design_version, base_handoff_version, base_input_id,
         base_app_status, base_completed_at, base_change_set_id, base_session_id,
         current_requirements_version, current_design_version, current_handoff_version,
         changes_md, summary_json, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)
    `).run(
      row.id,
      row.app_id,
      row.seq,
      row.title,
      row.description,
      row.scope,
      row.status,
      row.base_requirements_version,
      row.base_design_version,
      row.base_handoff_version,
      row.base_input_id,
      row.base_app_status,
      row.base_completed_at,
      row.base_change_set_id,
      row.base_session_id,
      row.current_requirements_version,
      row.current_design_version,
      row.current_handoff_version,
      row.created_at,
      row.updated_at
    )

    for (const item of selected) {
      const reqHash = sha256Hex(item.doc.doc.contentMd)
      const designHash = currentDesignStateHash(appId, item.id)
      insertChangeSetModule(row.id, item.id, {
        reqBaseVersion: item.doc.doc.version,
        reqBaseHash: reqHash,
        reqCurrentVersion: item.doc.doc.version,
        reqCurrentHash: reqHash,
        designBaseVersion: item.project.version,
        designBaseHash: designHash,
        designBaseTemplateId: item.project.prototype_template_id,
        designCurrentVersion: item.project.version,
        designCurrentHash: designHash
      })
    }

    if (scope === 'requirements') {
      for (const item of selected) {
        db.prepare(
          'UPDATE app_requirement_docs SET status = ?, confirmed_at = NULL, updated_at = ? WHERE app_id = ? AND module_id = ?'
        ).run('draft', now, appId, item.id)
      }
      db.prepare('UPDATE apps SET status = ?, requirements_confirmed_at = NULL, updated_at = ? WHERE id = ?').run(
        'requirements',
        now,
        appId
      )
    } else {
      db.prepare('UPDATE apps SET status = ?, updated_at = ? WHERE id = ?').run('design', now, appId)
    }
    for (const item of selected) {
      db.prepare(`
        UPDATE app_design_projects SET status = 'draft', confirmed_at = NULL, updated_at = ?
        WHERE app_id = ? AND module_id = ?
      `).run(now, appId, item.id)
    }
    // 旧开发会话只读：归档当前 active 会话（C1 §4.1 第 3 步）
    db.prepare(`UPDATE app_sessions SET status = 'archived', updated_at = ? WHERE app_id = ? AND status = 'active'`).run(
      now,
      appId
    )
    db.prepare('UPDATE apps SET current_change_set_id = ?, updated_at = ? WHERE id = ?').run(row.id, now, appId)
    recordStageEvent(appId, 'change-set', 'change-set-started', {
      changeSetId: row.id,
      seq: row.seq,
      title: row.title,
      scope,
      moduleIds,
      moduleKeys: selected.map(item => item.moduleKey),
      baseRequirementsVersion: row.base_requirements_version,
      baseDesignVersion: row.base_design_version,
      baseHandoffVersion: row.base_handoff_version,
      baseAppStatus: row.base_app_status,
      archivedSessionId: sessionId
    })
  })
  tx()

  const saved = changeSetRowById(appId, row.id)
  if (!saved) throw new ChangeSetError(500, '变更单创建失败')
  return { changeSet: changeSetView(saved) }
}

export interface CancelRestoredModule {
  moduleId: string
  moduleKey: string
  title: string
  requirementsVersion: number | null
  designVersion: number | null
  templateId: string | null
  /** MF-M5-1：变更中新增（无基线）的模块取消时自动归档，内容保留 */
  archived?: boolean
}

export interface CancelChangeSetResult {
  changeSet: ChangeSetView
  restored: {
    requirementsVersion: number | null
    designVersion: number | null
    templateId: string | null
    appStatus: string
    sessionRestored: boolean
    /** M5：逐个恢复的模块（未选模块不出现/不动） */
    modules: CancelRestoredModule[]
    /** M5：取消后重新生成的需求 bundle 版本 */
    bundleVersion: number | null
  }
}

/**
 * 取消变更（C1 §4.3 + M5 模块范围）：仅在“已产生已确认基线差异”且“尚未生成新交接包”时允许；
 * 逐个**选中模块**恢复需求/设计/原型模板/设计输入，未选模块不动；
 * 恢复应用状态/会话，并在同一事务内重新生成需求 bundle（失败整体回滚）。
 */
export function cancelChangeSet(appId: string, changeSetId: string): CancelChangeSetResult {
  const row = changeSetRowById(appId, changeSetId)
  if (!row) throw new ChangeSetError(404, `变更单不存在：${changeSetId}`)
  if (isClosedChangeSet(row.status)) {
    throw new ChangeSetError(409, `变更单已${row.status === 'cancelled' ? '取消' : '完成'}，不能再次取消`)
  }
  const gate = cancelabilityOf(row)
  if (!gate.canCancel) {
    throw new ChangeSetError(409, gate.reason ?? '当前不能取消变更')
  }
  const moduleRows = changeSetModuleRows(row.id)
  // 旧变更单（M5 之前）没有模块行：按默认模块/旧字段回退
  if (!moduleRows.length) {
    const module = defaultModule(appId)
    if (!module) throw new ChangeSetError(409, '应用没有需求模块，无法取消变更')
    moduleRows.push({
      change_set_id: row.id,
      module_id: module.id,
      req_base_version: row.base_requirements_version,
      req_base_hash: null,
      req_current_version: row.current_requirements_version,
      req_current_hash: null,
      design_base_version: row.base_design_version,
      design_base_hash: null,
      design_base_template_id: baselineTemplateId(appId, row),
      design_current_version: row.current_design_version,
      design_current_hash: null,
      created_at: row.created_at,
      updated_at: row.updated_at
    })
  }
  const active = activeChangeSetRow(appId)
  if (!active || active.id !== row.id) throw new ChangeSetError(409, '只能取消当前进行中的变更单')

  const now = nowIso()
  const restoredModules: CancelRestoredModule[] = []
  let bundleVersion: number | null = null
  let sessionRestored = false
  const tx = db.transaction(() => {
    for (const moduleRow of moduleRows) {
      const module = moduleById(appId, moduleRow.module_id)
      if (!module) continue
      // MF-M5-1：变更中新增的模块没有基线 → 取消时自动归档（内容/版本/设计保留，可之后恢复）
      if (moduleRow.req_base_version === null || moduleRow.design_base_version === null) {
        db.prepare('UPDATE app_modules SET archived_at = ?, updated_at = ? WHERE app_id = ? AND id = ?').run(
          now,
          now,
          appId,
          module.id
        )
        restoredModules.push({
          moduleId: module.id,
          moduleKey: module.module_key,
          title: module.title,
          requirementsVersion: null,
          designVersion: null,
          templateId: null,
          archived: true
        })
        continue
      }
      const currentDoc = ensureRequirementDoc(appId, undefined, module.id)
      const currentProject = designProjectRow(appId, module.id)
      const restoreRequirements =
        currentDoc.doc.status !== 'confirmed' ||
        (moduleRow.req_base_version !== null && currentDoc.doc.version !== moduleRow.req_base_version)
      const restoreDesign = Boolean(
        currentProject &&
          (currentProject.status !== 'confirmed' ||
            (moduleRow.design_base_version !== null && currentProject.version !== moduleRow.design_base_version))
      )
      if (restoreRequirements) {
        restoreRequirementDocVersionConfirmed(appId, moduleRow.req_base_version, module.id)
      }
      if (restoreDesign) {
        restoreDesignVersionConfirmed(appId, moduleRow.design_base_version, module.id)
      }
      // 取消要恢复原型模板（变更中切换过模板时，实体/页面恢复不等于模板恢复）
      let restoredTemplateId: string | null = null
      if (moduleRow.design_base_template_id) {
        const exists = db.prepare('SELECT 1 FROM prototype_templates WHERE id = ?').get(moduleRow.design_base_template_id)
        if (exists) {
          db.prepare(
            'UPDATE app_design_projects SET prototype_template_id = ?, updated_at = ? WHERE app_id = ? AND module_id = ?'
          ).run(moduleRow.design_base_template_id, now, appId, module.id)
          restoredTemplateId = moduleRow.design_base_template_id
        }
      }
      const docAfter = ensureRequirementDoc(appId, undefined, module.id)
      const projectAfter = designProjectRow(appId, module.id)
      // 恢复后的需求文档会追加新版本；重新绑定等价的当前设计输入，避免“内容已恢复但输入 stale”
      if (docAfter.doc.status === 'confirmed' && projectAfter) {
        const input = latestDesignInput(appId, module.id)
        db.prepare(`
          UPDATE app_design_projects
          SET source_input_id = ?, source_input_hash = ?, source_doc_version = ?, updated_at = ?
          WHERE app_id = ? AND module_id = ?
        `).run(input.id, input.docHash, input.docVersion, now, appId, module.id)
        // 只清理属于当前被取消变更单的输入归属；基线输入不应被误清
        db.prepare('UPDATE app_design_inputs SET change_set_id = NULL WHERE id = ? AND change_set_id = ?').run(
          input.id,
          row.id
        )
      }
      touchChangeSetModule(row.id, module.id, {
        reqCurrentVersion: docAfter.doc.version,
        reqCurrentHash: sha256Hex(docAfter.doc.contentMd),
        designCurrentVersion: projectAfter?.version ?? null,
        designCurrentHash: projectAfter ? currentDesignStateHash(appId, module.id) : null
      })
      restoredModules.push({
        moduleId: module.id,
        moduleKey: module.module_key,
        title: module.title,
        requirementsVersion: docAfter.doc.version,
        designVersion: projectAfter?.version ?? null,
        templateId: restoredTemplateId ?? projectAfter?.prototype_template_id ?? null
      })
    }

    // MF-M5-1：归档变更中新增模块后必须仍有未归档模块（基线至少 1 个；防御性校验并整体回滚）
    const activeModuleCount = db
      .prepare('SELECT COUNT(*) AS count FROM app_modules WHERE app_id = ? AND archived_at IS NULL')
      .get(appId) as { count: number }
    if (activeModuleCount.count === 0) {
      throw new ChangeSetError(409, '取消后没有任何未归档模块，无法恢复基线；请联系维护者手动处理')
    }

    const baseStatus = row.base_app_status ?? 'development'
    db.prepare(`
      UPDATE apps SET status = ?, completed_at = ?, current_change_set_id = ?,
        requirements_confirmed_at = COALESCE(requirements_confirmed_at, ?),
        design_confirmed_at = COALESCE(design_confirmed_at, ?), updated_at = ?
      WHERE id = ?
    `).run(baseStatus, row.base_completed_at, row.base_change_set_id, now, now, now, appId)
    db.prepare(`
      UPDATE app_change_sets SET status = 'cancelled', completed_at = ?, updated_at = ? WHERE app_id = ? AND id = ?
    `).run(now, now, appId, row.id)

    // 会话恢复：只有恢复到开发阶段才把基线会话恢复为 active，其余 active 归档
    if (baseStatus === 'development' && row.base_session_id) {
      db.prepare(`UPDATE app_sessions SET status = 'archived', updated_at = ? WHERE app_id = ? AND status = 'active' AND id <> ?`).run(
        now,
        appId,
        row.base_session_id
      )
      const result = db
        .prepare(`UPDATE app_sessions SET status = 'active', updated_at = ? WHERE app_id = ? AND id = ?`)
        .run(now, appId, row.base_session_id)
      sessionRestored = result.changes > 0
    }

    // M5：取消后重新生成需求聚合 bundle（同一事务；失败整单回滚）；变更单已取消，bundle 不归属它
    const snapshot = createRequirementBundleSnapshot(appId, { requireConfirmed: true, changeSetId: null })
    bundleVersion = snapshot.version

    const requirementsVersion = restoredModules.reduce<number | null>(
      (max, item) => (item.requirementsVersion && (!max || item.requirementsVersion > max) ? item.requirementsVersion : max),
      null
    )
    const designVersion = restoredModules.reduce<number | null>(
      (max, item) => (item.designVersion && (!max || item.designVersion > max) ? item.designVersion : max),
      null
    )
    const defaultId = defaultModule(appId)?.id
    const defaultRestored = restoredModules.find(item => item.moduleId === defaultId) ?? restoredModules[0] ?? null
    recordStageEvent(appId, 'change-set', 'change-set-cancelled', {
      changeSetId: row.id,
      seq: row.seq,
      scope: row.scope,
      moduleIds: restoredModules.map(item => item.moduleId),
      restoredRequirementsVersion: requirementsVersion,
      restoredDesignVersion: designVersion,
      restoredTemplateId: defaultRestored?.templateId ?? null,
      bundleVersion,
      appStatus: baseStatus,
      sessionRestored
    })
  })
  tx()

  const saved = changeSetRowById(appId, row.id)
  if (!saved) throw new ChangeSetError(500, '变更单取消失败')
  const compat = restoredModules.reduce(
    (acc, item) => ({
      requirementsVersion: item.requirementsVersion && (!acc.requirementsVersion || item.requirementsVersion > acc.requirementsVersion)
        ? item.requirementsVersion
        : acc.requirementsVersion,
      designVersion: item.designVersion && (!acc.designVersion || item.designVersion > acc.designVersion)
        ? item.designVersion
        : acc.designVersion
    }),
    { requirementsVersion: null as number | null, designVersion: null as number | null }
  )
  const defaultId = defaultModule(appId)?.id
  const defaultRestored = restoredModules.find(item => item.moduleId === defaultId) ?? restoredModules[0] ?? null
  return {
    changeSet: changeSetView(saved),
    restored: {
      requirementsVersion: compat.requirementsVersion,
      designVersion: compat.designVersion,
      templateId: defaultRestored?.templateId ?? null,
      appStatus: row.base_app_status ?? 'development',
      sessionRestored,
      modules: restoredModules,
      bundleVersion
    }
  }
}

/**
 * 变更范围升级（C1 收口）：仅设计变更 → 需求+设计。
 * 仅在 active、原 scope=design、且该单未生成交接包时允许。
 */
export function upgradeChangeSetScope(
  appId: string,
  changeSetId: string,
  rawScope: unknown
): { changeSet: ChangeSetView } {
  if (rawScope !== 'requirements') {
    throw new ChangeSetError(400, 'scope 只支持升级为 requirements（需求+设计）')
  }
  const row = changeSetRowById(appId, changeSetId)
  if (!row) throw new ChangeSetError(404, `变更单不存在：${changeSetId}`)
  if (isClosedChangeSet(row.status)) {
    throw new ChangeSetError(409, '变更单已结束，不能升级范围；请发起新的变更')
  }
  const active = activeChangeSetRow(appId)
  if (!active || active.id !== row.id) {
    throw new ChangeSetError(409, '只能升级当前进行中的变更单')
  }
  if (row.scope !== 'design') {
    throw new ChangeSetError(409, '只有“仅设计”变更可以升级为“需求+设计”')
  }
  const handoffCount = db
    .prepare('SELECT COUNT(*) AS count FROM design_handoffs WHERE app_id = ? AND change_set_id = ?')
    .get(appId, row.id) as { count: number }
  if (handoffCount.count > 0) {
    throw new ChangeSetError(409, '本次变更已生成交接包，不能升级范围；请完成本次变更，或完成后发起新的变更')
  }
  const moduleRows = changeSetModuleRows(row.id)
  let moduleIds = moduleRows.map(item => item.module_id)
  if (!moduleIds.length) {
    const module = defaultModule(appId)
    if (!module) throw new ChangeSetError(409, '应用还没有需求模块，不能升级变更')
    moduleIds = [module.id]
  }

  const now = nowIso()
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE app_change_sets SET scope = 'requirements', status = 'requirements', updated_at = ?
      WHERE app_id = ? AND id = ?
    `).run(now, appId, row.id)
    db.prepare(`
      UPDATE apps SET status = 'requirements', requirements_confirmed_at = NULL, updated_at = ? WHERE id = ?
    `).run(now, appId)
    for (const moduleId of moduleIds) {
      db.prepare(`
        UPDATE app_requirement_docs SET status = 'draft', confirmed_at = NULL, updated_at = ?
        WHERE app_id = ? AND module_id = ?
      `).run(now, appId, moduleId)
      db.prepare(`
        UPDATE app_design_projects SET status = 'draft', confirmed_at = NULL, updated_at = ?
        WHERE app_id = ? AND module_id = ?
      `).run(now, appId, moduleId)
      // 只对**选中模块**升级：base 不变，current 记录升级时的版本
      const doc = ensureRequirementDoc(appId, undefined, moduleId)
      const project = designProjectRow(appId, moduleId)
      touchChangeSetModule(row.id, moduleId, {
        reqCurrentVersion: doc.doc.version,
        reqCurrentHash: sha256Hex(doc.doc.contentMd),
        designCurrentVersion: project?.version ?? null,
        designCurrentHash: project ? currentDesignStateHash(appId, moduleId) : null
      })
    }
    recordStageEvent(appId, 'change-set', 'change-set-scope-upgraded', {
      changeSetId: row.id,
      seq: row.seq,
      from: 'design',
      to: 'requirements',
      moduleIds
    })
  })
  tx()
  const saved = changeSetRowById(appId, row.id)
  if (!saved) throw new ChangeSetError(500, '变更单范围升级失败')
  return { changeSet: changeSetView(saved) }
}

/**
 * 应用详情用：当前进行中变更单（没有则为 null）
 */
export function activeChangeSetView(appId: string): ChangeSetView | null {
  const row = activeChangeSetRow(appId) ?? null
  return row ? changeSetView(row) : null
}
