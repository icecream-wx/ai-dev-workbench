/**
 * 需求模块服务（M2，#6）
 *
 * 一个“模块”= 一份完整需求 PRD（需求文档/章节/版本都带 module_id）。
 * 本文件只负责模块本体与需求 bundle 聚合；文档读写仍在 `./doc`（doc 依赖本文件）。
 *
 * 约定：
 * - 存量单文档应用迁移后只有一个默认模块 `MOD-001`（title=应用名）；
 * - 未传 moduleId 的旧 API 一律落到默认模块（第一个未归档模块，按 position/module_key）；
 * - 模块只做归属/分组，`SCENE/EPIC/STORY` ID 仍全应用唯一（`collectAppOutlineIds`）；
 * - 归档 = `archived_at`，不物理删除文档/版本；至少保留 1 个未归档模块；
 * - 模块创建时立即按应用需求模板建空文档 v1（source=template-change）：
 *   默认模块文档标题 `${app.name} 需求文档`，新模块 `${app.name} · ${模块名} 需求文档`。
 *
 * 说明：本文件刻意不 import `./doc`（避免循环依赖），因此新模块的初始文档在这里用
 * 等价 SQL 落库（章节/版本格式与 doc.ts 的 snapshotVersion 一致），由测试保证与
 * `ensureRequirementDoc` 的初始化结果一致。
 */
import { randomUUID } from 'node:crypto'
import { db, nowIso } from '../db'
import { activeChangeSetRow, changeSetModuleRows, updateActiveChangeSet } from '../changesets/query'
import { appRequirementTemplate } from '../apps/template-resolution'
import { RequirementDocError } from './templates'
import { collectOutlineIds, parseSectionData } from './outline'
import {
  bundleHashOfModules,
  sha256Hex,
  type RequirementBundleHashEntry,
  type RequirementBundleModuleEntry
} from './module-migration'
import type { RequirementDocSection } from './types'

export interface ModuleRow {
  id: string
  app_id: string
  module_key: string
  title: string
  description: string | null
  owner_label: string | null
  required: number
  position: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type ModuleDocStatus = 'draft' | 'review' | 'confirmed'

/** 模块 + 该模块需求文档摘要（列表/详情共用；不创建文档） */
export interface RequirementModuleView {
  id: string
  appId: string
  moduleKey: string
  title: string
  description: string
  ownerLabel: string
  required: boolean
  archived: boolean
  archivedAt: string | null
  position: number
  docStatus: ModuleDocStatus | null
  docVersion: number | null
  docUpdatedAt: string | null
  templateId: string | null
  createdAt: string
  updatedAt: string
}

interface ModuleWithDocRow extends ModuleRow {
  doc_status: string | null
  doc_version: number | null
  doc_updated_at: string | null
  doc_template_id: string | null
}

interface AppRow {
  id: string
  name: string
  status: string
  requirements_confirmed_at: string | null
}

const MODULE_KEY_PATTERN = /^MOD-(\d{1,6})$/

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function appRowOrThrow(appId: string): AppRow {
  const row = db
    .prepare('SELECT id, name, status, requirements_confirmed_at FROM apps WHERE id = ?')
    .get(appId) as AppRow | undefined
  if (!row) throw new RequirementDocError(404, `应用不存在：${appId}`)
  return row
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

function rowToView(row: ModuleWithDocRow): RequirementModuleView {
  const status = row.doc_status === 'confirmed' || row.doc_status === 'review' ? row.doc_status : row.doc_status ? 'draft' : null
  return {
    id: row.id,
    appId: row.app_id,
    moduleKey: row.module_key,
    title: row.title,
    description: row.description ?? '',
    ownerLabel: row.owner_label ?? '',
    required: row.required === 1,
    archived: Boolean(row.archived_at),
    archivedAt: row.archived_at,
    position: row.position,
    docStatus: status,
    docVersion: row.doc_version ?? null,
    docUpdatedAt: row.doc_updated_at ?? null,
    templateId: row.doc_template_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const MODULE_SELECT = `
  SELECT m.*, d.status AS doc_status, d.version AS doc_version, d.updated_at AS doc_updated_at,
         d.template_id AS doc_template_id
  FROM app_modules m
  LEFT JOIN app_requirement_docs d ON d.app_id = m.app_id AND d.module_id = m.id
`

/** 模块列表（按 position/module_key；默认不含归档） */
export function listModules(appId: string, includeArchived = false): RequirementModuleView[] {
  appRowOrThrow(appId)
  const rows = db
    .prepare(`${MODULE_SELECT} WHERE m.app_id = ? ${includeArchived ? '' : 'AND m.archived_at IS NULL'}
      ORDER BY m.position ASC, m.module_key ASC`)
    .all(appId) as ModuleWithDocRow[]
  return rows.map(rowToView)
}

/** `appPayload.requirementModules` 用的只读摘要（不建模块/文档/版本） */
export function moduleSummaries(appId: string): Array<{
  id: string
  moduleKey: string
  title: string
  required: boolean
  archived: boolean
  position: number
  docStatus: ModuleDocStatus | null
  docVersion: number | null
}> {
  return listModules(appId, true).map(view => ({
    id: view.id,
    moduleKey: view.moduleKey,
    title: view.title,
    required: view.required,
    archived: view.archived,
    position: view.position,
    docStatus: view.docStatus,
    docVersion: view.docVersion
  }))
}

/** 默认模块（第一个未归档模块；只读，不创建） */
export function defaultModule(appId: string): ModuleRow | undefined {
  return db
    .prepare('SELECT * FROM app_modules WHERE app_id = ? AND archived_at IS NULL ORDER BY position ASC, module_key ASC LIMIT 1')
    .get(appId) as ModuleRow | undefined
}

export function moduleById(appId: string, moduleId: string): ModuleRow | undefined {
  return db.prepare('SELECT * FROM app_modules WHERE app_id = ? AND id = ?').get(appId, moduleId) as ModuleRow | undefined
}

/** 明确传 moduleId 时必须存在（404）；读已归档模块允许 */
export function moduleOrThrow(appId: string, moduleId: string): ModuleRow {
  const row = moduleById(appId, moduleId)
  if (!row) throw new RequirementDocError(404, `模块不存在：${moduleId}`)
  return row
}

/** 写操作守卫：已归档模块 → 409（读仍允许） */
export function assertModuleWritable(module: ModuleRow): void {
  if (module.archived_at) throw new RequirementDocError(409, `模块已归档：${module.title}`)
}

export function nextModuleKey(appId: string): string {
  const rows = db.prepare('SELECT module_key FROM app_modules WHERE app_id = ?').all(appId) as Array<{ module_key: string }>
  let max = 0
  for (const row of rows) {
    const found = MODULE_KEY_PATTERN.exec(row.module_key)
    if (found) max = Math.max(max, Number(found[1]))
  }
  return `MOD-${String(max + 1).padStart(3, '0')}`
}

function nextPosition(appId: string): number {
  const row = db.prepare('SELECT MAX(position) AS position FROM app_modules WHERE app_id = ?').get(appId) as
    | { position: number | null }
    | undefined
  return (row?.position ?? -1) + 1
}

/** 默认模块文档标题（旧行为不变）；其它模块带上模块名 */
export function docTitleFor(appName: string, module: Pick<ModuleRow, 'module_key' | 'title'>): string {
  return module.module_key === 'MOD-001' ? `${appName} 需求文档` : `${appName} · ${module.title} 需求文档`
}

function createModuleRow(
  appId: string,
  title: string,
  description: string | null,
  ownerLabel: string | null,
  position?: number
): ModuleRow {
  const now = nowIso()
  const id = randomUUID()
  const moduleKey = nextModuleKey(appId)
  db.prepare(`
    INSERT INTO app_modules
      (id, app_id, module_key, title, description, owner_label, required, position, archived_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL, ?, ?)
  `).run(id, appId, moduleKey, title, description, ownerLabel, typeof position === 'number' ? position : nextPosition(appId), now, now)
  const row = moduleById(appId, id)
  if (!row) throw new RequirementDocError(500, '模块创建失败')
  return row
}

/**
 * 默认模块懒创建（ensureRequirementDoc / 未传 moduleId 的旧 API）：
 * - 有未归档模块 → 直接返回；
 * - 完全没有模块（新应用/迁移后无文档应用） → 建 `MOD-001`（title=应用名）；
 * - 只有归档模块 → 建下一个 key（保证仍有可写模块）。
 */
export function ensureDefaultModule(appId: string): ModuleRow {
  const existing = defaultModule(appId)
  if (existing) return existing
  const app = appRowOrThrow(appId)
  return createModuleRow(appId, app.name, null, null)
}

/** 解析 moduleId：空/缺省 → 默认模块（懒创建）；否则必须存在 */
export function resolveModule(appId: string, moduleId?: string): ModuleRow {
  const trimmed = typeof moduleId === 'string' ? moduleId.trim() : ''
  if (!trimmed) return ensureDefaultModule(appId)
  return moduleOrThrow(appId, trimmed)
}

export interface CreateModuleInput {
  title?: unknown
  description?: unknown
  ownerLabel?: unknown
  required?: unknown
}

export interface CreateModuleWithDocInput {
  title: string
  description?: string | null
  ownerLabel?: string | null
  /** 显式文档标题（首次模块规划对 MOD-001 也要带模块名）；缺省走 docTitleFor */
  docTitle?: string
  /** 显式 position（模块规划按建议顺序落位）；缺省追加到末尾 */
  position?: number
}

/**
 * 模块 + 空文档 v1（不做事务边界/阶段校验，由调用方负责）。
 *
 * RMP-1：`createModule` 与首次模块规划 apply 共用，保证章节/版本格式完全一致。
 */
export function createModuleWithEmptyDoc(appId: string, input: CreateModuleWithDocInput): ModuleRow {
  const app = appRowOrThrow(appId)
  const now = nowIso()
  const template = appRequirementTemplate(appId)
  const changeSetId = activeChangeSetRow(appId)?.id ?? null
  const module = createModuleRow(appId, input.title, input.description ?? null, input.ownerLabel ?? null, input.position)
  const docTitle = asString(input.docTitle) || docTitleFor(app.name, module)
  const sections: RequirementDocSection[] = template.sections.map((definition, index) => ({
    sectionKey: definition.id,
    title: definition.title,
    level: definition.level,
    kind: definition.kind,
    markdown: '',
    required: definition.required,
    position: index,
    updatedAt: now
  }))
  const contentMd = renderContentMd(docTitle, sections)
  db.prepare(`
    INSERT INTO app_requirement_docs
      (app_id, module_id, template_id, title, content_md, status, version, created_at, updated_at, confirmed_at)
    VALUES (?, ?, ?, ?, ?, 'draft', 1, ?, ?, NULL)
  `).run(appId, module.id, template.id, docTitle, contentMd, now, now)
  writeModuleSections(appId, module.id, sections, now)
  db.prepare(`
    INSERT INTO app_requirement_doc_versions
      (app_id, module_id, version, template_id, content_md, sections_json, source, change_set_id, created_at)
    VALUES (?, ?, 1, ?, ?, ?, 'template-change', ?, ?)
  `).run(
    appId,
    module.id,
    template.id,
    contentMd,
    JSON.stringify(sections.map(sectionToSnapshot)),
    changeSetId,
    now
  )
  // M5：需求阶段变更中新增模块 → 自动纳入本次变更范围（base=null，current=初始文档 v1）
  addModuleToActiveRequirementChangeSet(appId, module.id, 1, contentMd)
  recordStageEvent(appId, 'requirements', 'module-created', {
    moduleId: module.id,
    moduleKey: module.module_key,
    titleLength: module.title.length
  })
  return module
}

/** 新模块：复制应用需求模板章节，生成空文档 v1（source=template-change） */
export function createModule(appId: string, input: CreateModuleInput): RequirementModuleView {
  const app = appRowOrThrow(appId)
  if (app.status !== 'requirements') {
    throw new RequirementDocError(
      409,
      `当前阶段（${app.status}）不能直接新增模块；设计阶段请先「重新编辑需求」回到需求阶段，开发/完成阶段请先发起“需求+设计”变更`
    )
  }
  const title = asString(input.title)
  if (!title) throw new RequirementDocError(400, '模块名称不能为空')
  if (title.length > 120) throw new RequirementDocError(400, '模块名称不能超过 120 字')
  const description = asString(input.description) || null
  const ownerLabel = asString(input.ownerLabel) || null

  let moduleId = ''
  const tx = db.transaction(() => {
    const module = createModuleWithEmptyDoc(appId, { title, description, ownerLabel })
    moduleId = module.id
  })
  tx()
  const row = moduleById(appId, moduleId)
  if (!row) throw new RequirementDocError(500, '模块创建失败')
  const view = listModules(appId, true).find(item => item.id === moduleId)
  if (!view) throw new RequirementDocError(500, '模块创建后读取失败')
  return view
}

export interface UpdateModuleInput {
  title?: unknown
  description?: unknown
  ownerLabel?: unknown
  required?: unknown
  position?: unknown
}

export function updateModule(appId: string, moduleId: string, input: UpdateModuleInput): RequirementModuleView {
  const app = appRowOrThrow(appId)
  if (app.status !== 'requirements') {
    throw new RequirementDocError(409, `当前阶段（${app.status}）不能修改模块信息；请先「重新编辑需求」或发起变更回到需求阶段`)
  }
  const module = moduleOrThrow(appId, moduleId)
  assertModuleWritable(module)
  const sets: string[] = []
  const values: unknown[] = []

  if (input.title !== undefined) {
    const title = asString(input.title)
    if (!title) throw new RequirementDocError(400, '模块名称不能为空')
    if (title.length > 120) throw new RequirementDocError(400, '模块名称不能超过 120 字')
    sets.push('title = ?')
    values.push(title)
  }
  if (input.description !== undefined) {
    sets.push('description = ?')
    values.push(asString(input.description) || null)
  }
  if (input.ownerLabel !== undefined) {
    sets.push('owner_label = ?')
    values.push(asString(input.ownerLabel) || null)
  }
  if (input.required !== undefined) {
    sets.push('required = ?')
    values.push(input.required === true || input.required === 1 || input.required === 'true' ? 1 : 0)
  }
  if (input.position !== undefined) {
    const position = Number(input.position)
    if (!Number.isInteger(position) || position < 0) throw new RequirementDocError(400, 'position 需要是非负整数')
    sets.push('position = ?')
    values.push(position)
  }
  if (!sets.length) return listModules(appId, true).find(item => item.id === moduleId)!
  sets.push('updated_at = ?')
  values.push(nowIso())
  db.prepare(`UPDATE app_modules SET ${sets.join(', ')} WHERE app_id = ? AND id = ?`).run(...values, appId, moduleId)
  const view = listModules(appId, true).find(item => item.id === moduleId)
  if (!view) throw new RequirementDocError(500, '模块更新后读取失败')
  return view
}

/**
 * 模块排序（M3 §3.2）：moduleIds 必须与“全部未归档模块 id 集合”完全一致
 * （缺失/多余/重复/含归档 → 400，不改库）；事务内写 position=0..n-1。
 * 归档模块 position 不动。
 */
export function reorderModules(appId: string, rawIds: unknown): RequirementModuleView[] {
  const app = appRowOrThrow(appId)
  if (app.status !== 'requirements') {
    throw new RequirementDocError(409, `当前阶段（${app.status}）不能调整模块顺序；请先回到需求阶段`)
  }
  if (!Array.isArray(rawIds) || !rawIds.length) throw new RequirementDocError(400, 'moduleIds 需要是非空数组')
  const ids: string[] = []
  for (const raw of rawIds) {
    const id = typeof raw === 'string' ? raw.trim() : ''
    if (!id) throw new RequirementDocError(400, 'moduleIds 需要是非空字符串数组')
    ids.push(id)
  }
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) throw new RequirementDocError(400, `moduleIds 不能重复：${id}`)
    seen.add(id)
  }
  const rows = db
    .prepare('SELECT id FROM app_modules WHERE app_id = ? AND archived_at IS NULL')
    .all(appId) as Array<{ id: string }>
  const activeIds = new Set(rows.map(row => row.id))
  for (const id of ids) {
    if (!activeIds.has(id)) throw new RequirementDocError(400, `moduleIds 含无效或已归档模块：${id}`)
  }
  if (ids.length !== activeIds.size) {
    throw new RequirementDocError(400, `moduleIds 必须包含全部 ${activeIds.size} 个未归档模块（当前 ${ids.length} 个）`)
  }
  const now = nowIso()
  const tx = db.transaction(() => {
    ids.forEach((id, index) => {
      db.prepare('UPDATE app_modules SET position = ?, updated_at = ? WHERE app_id = ? AND id = ?').run(index, now, appId, id)
    })
  })
  tx()
  return listModules(appId)
}

/** 归档（不物理删除文档/版本）；至少保留 1 个未归档模块 */
export function archiveModule(appId: string, moduleId: string): RequirementModuleView {
  const app = appRowOrThrow(appId)
  if (app.status !== 'requirements') {
    throw new RequirementDocError(409, `当前阶段（${app.status}）不能归档模块；请先回到需求阶段`)
  }
  if (activeChangeSetRow(appId)) {
    throw new RequirementDocError(409, '变更进行中不能归档模块（本次变更的模块范围已固定）；请先完成或取消变更')
  }
  const module = moduleOrThrow(appId, moduleId)
  if (module.archived_at) return listModules(appId, true).find(item => item.id === moduleId)!
  const activeCount = db
    .prepare('SELECT COUNT(*) AS count FROM app_modules WHERE app_id = ? AND archived_at IS NULL')
    .get(appId) as { count: number }
  if (activeCount.count <= 1) {
    throw new RequirementDocError(409, '至少保留 1 个未归档模块，不能归档最后一个模块')
  }
  const now = nowIso()
  db.prepare('UPDATE app_modules SET archived_at = ?, updated_at = ? WHERE app_id = ? AND id = ?').run(
    now,
    now,
    appId,
    moduleId
  )
  recordStageEvent(appId, 'requirements', 'module-archived', {
    moduleId,
    moduleKey: module.module_key
  })
  return listModules(appId, true).find(item => item.id === moduleId)!
}

export function restoreModule(appId: string, moduleId: string): RequirementModuleView {
  const app = appRowOrThrow(appId)
  if (app.status !== 'requirements') {
    throw new RequirementDocError(409, `当前阶段（${app.status}）不能恢复模块；请先回到需求阶段`)
  }
  const module = moduleOrThrow(appId, moduleId)
  if (!module.archived_at) return listModules(appId, true).find(item => item.id === moduleId)!
  const now = nowIso()
  db.prepare('UPDATE app_modules SET archived_at = NULL, updated_at = ? WHERE app_id = ? AND id = ?').run(now, appId, moduleId)
  recordStageEvent(appId, 'requirements', 'module-restored', {
    moduleId,
    moduleKey: module.module_key
  })
  return listModules(appId, true).find(item => item.id === moduleId)!
}

/** 应用级全量 Outline ID（含归档模块，用于跨模块唯一分配；只读） */
export function collectAppOutlineIds(appId: string): Set<string> {
  const rows = db
    .prepare('SELECT data_json FROM app_requirement_doc_sections WHERE app_id = ? AND data_json IS NOT NULL')
    .all(appId) as Array<{ data_json: string | null }>
  return collectOutlineIds(rows.map(row => parseSectionData(row.data_json)))
}

// ---------------------------------------------------------------- bundle

export interface RequirementBundleModuleView {
  moduleId: string
  moduleKey: string
  title: string
  required: boolean
  position: number
  hasDoc: boolean
  docVersion: number
  docHash: string
  confirmed: boolean
}

export interface RequirementBundleView {
  appId: string
  /** 当前各模块文档的聚合 hash（未持久化；模块无文档时 docHash 为空串参与计算） */
  bundleHash: string
  modules: RequirementBundleModuleView[]
  allRequiredConfirmed: boolean
  pendingModuleIds: string[]
  /** 最近一次落库的 bundle 快照（无则 null） */
  latest: { version: number; hash: string; changeSetId: string | null; createdAt: string } | null
}

interface BundleRow {
  id: string
  app_id: string
  version: number
  modules_json: string
  bundle_hash: string
  change_set_id: string | null
  created_at: string
}

interface BundleModuleRow {
  id: string
  module_key: string
  title: string
  required: number
  position: number
  doc_version: number | null
  content_md: string | null
  status: string | null
}

/** 当前模块（非归档）→ bundle 条目（含 title；参与 hash 时去掉） */
function currentBundleEntries(appId: string): Array<{
  entry: RequirementBundleModuleEntry
  required: boolean
  hasDoc: boolean
  docHash: string
  position: number
}> {
  const rows = db
    .prepare(`
      SELECT m.id, m.module_key, m.title, m.required, m.position,
             d.version AS doc_version, d.content_md, d.status
      FROM app_modules m
      LEFT JOIN app_requirement_docs d ON d.app_id = m.app_id AND d.module_id = m.id
      WHERE m.app_id = ? AND m.archived_at IS NULL
      ORDER BY m.position ASC, m.module_key ASC
    `)
    .all(appId) as BundleModuleRow[]
  return rows.map(row => {
    const docHash = row.content_md === null ? '' : sha256Hex(row.content_md)
    return {
      entry: {
        moduleId: row.id,
        moduleKey: row.module_key,
        title: row.title,
        docVersion: row.doc_version ?? 0,
        docHash,
        confirmed: row.status === 'confirmed'
      },
      required: row.required === 1,
      hasDoc: row.content_md !== null,
      docHash,
      position: row.position
    }
  })
}

function hashOf(entries: Array<{ entry: RequirementBundleModuleEntry }>): string {
  const hashEntries: RequirementBundleHashEntry[] = entries.map(item => item.entry)
  return bundleHashOfModules(hashEntries)
}

export function pendingModuleIds(appId: string): string[] {
  return currentBundleEntries(appId)
    .filter(item => item.required && !item.entry.confirmed)
    .map(item => item.entry.moduleId)
}

export function allRequiredModulesConfirmed(appId: string): boolean {
  return pendingModuleIds(appId).length === 0
}

/** 只读聚合视图（不创建模块/文档/bundle、不产版本） */
export function requirementBundleView(appId: string): RequirementBundleView {
  appRowOrThrow(appId)
  const items = currentBundleEntries(appId)
  const row = db
    .prepare(
      'SELECT version, bundle_hash, change_set_id, created_at FROM app_requirement_bundles WHERE app_id = ? ORDER BY version DESC LIMIT 1'
    )
    .get(appId) as Pick<BundleRow, 'version' | 'bundle_hash' | 'change_set_id' | 'created_at'> | undefined
  return {
    appId,
    bundleHash: hashOf(items),
    modules: items.map(item => ({
      moduleId: item.entry.moduleId,
      moduleKey: item.entry.moduleKey,
      title: item.entry.title,
      required: item.required,
      position: item.position,
      hasDoc: item.hasDoc,
      docVersion: item.entry.docVersion,
      docHash: item.docHash,
      confirmed: item.entry.confirmed
    })),
    allRequiredConfirmed: items.length > 0 && items.every(item => !item.required || item.entry.confirmed),
    pendingModuleIds: items.filter(item => item.required && !item.entry.confirmed).map(item => item.entry.moduleId),
    latest: row
      ? { version: row.version, hash: row.bundle_hash, changeSetId: row.change_set_id, createdAt: row.created_at }
      : null
  }
}

/**
 * 最近一次落库的需求 bundle 快照（M5：设计输入 v2 / 设计总览只读引用）。
 * 不创建模块/文档/快照；无快照返回 null。
 */
export interface LatestRequirementBundle {
  version: number
  hash: string
  modules: RequirementBundleModuleEntry[]
  changeSetId: string | null
  createdAt: string
}

export function latestRequirementBundle(appId: string): LatestRequirementBundle | null {
  const row = db
    .prepare(
      'SELECT version, modules_json, bundle_hash, change_set_id, created_at FROM app_requirement_bundles WHERE app_id = ? ORDER BY version DESC LIMIT 1'
    )
    .get(appId) as
    | { version: number; modules_json: string; bundle_hash: string; change_set_id: string | null; created_at: string }
    | undefined
  if (!row) return null
  let modules: RequirementBundleModuleEntry[] = []
  try {
    const parsed = JSON.parse(row.modules_json) as unknown
    if (Array.isArray(parsed)) modules = parsed as RequirementBundleModuleEntry[]
  } catch {
    modules = []
  }
  return {
    version: row.version,
    hash: row.bundle_hash,
    modules,
    changeSetId: row.change_set_id,
    createdAt: row.created_at
  }
}

/** 当前聚合 entries（只读；不写库、不产版本） */
export function requirementBundleEntries(appId: string): RequirementBundleModuleEntry[] {
  return currentBundleEntries(appId).map(item => item.entry)
}

/** 变更中新增模块：把模块纳入 active 需求变更范围（base=null，current=初始文档 v1） */
function addModuleToActiveRequirementChangeSet(
  appId: string,
  moduleId: string,
  docVersion: number,
  contentMd: string
): void {
  const active = activeChangeSetRow(appId)
  if (!active || active.scope !== 'requirements') return
  const now = nowIso()
  db.prepare(`
    INSERT INTO app_change_set_modules
      (change_set_id, module_id, req_base_version, req_base_hash, req_current_version, req_current_hash,
       design_base_version, design_base_hash, design_base_template_id,
       design_current_version, design_current_hash, created_at, updated_at)
    VALUES (?, ?, NULL, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)
  `).run(active.id, moduleId, docVersion, sha256Hex(contentMd), now, now)
}

/**
 * 生成模块需求聚合快照（bundle）。
 * - `requireConfirmed=true`：所有必选未归档模块必须 confirmed，否则 400 + issues(pending)；
 * - 版本号 = 当前 MAX(version)+1；同一内容重复生成会产生新版本号（与需求文档 confirm 语义一致）；
 * - `changeSetId` 显式传入时覆盖（M5 取消变更后生成 bundle，记录 null）。
 */
export function createRequirementBundleSnapshot(
  appId: string,
  options: { requireConfirmed: boolean; changeSetId?: string | null } = { requireConfirmed: true }
): { version: number; hash: string; modules: RequirementBundleModuleEntry[] } {
  appRowOrThrow(appId)
  const items = currentBundleEntries(appId)
  if (!items.length) throw new RequirementDocError(400, '应用还没有需求模块，无法生成需求聚合快照')
  const pending = items.filter(item => item.required && !item.entry.confirmed)
  if (options.requireConfirmed && pending.length) {
    throw new RequirementDocError(
      400,
      `还有 ${pending.length} 个必选模块未确认需求`,
      pending.map(item => ({
        moduleId: item.entry.moduleId,
        moduleKey: item.entry.moduleKey,
        title: item.entry.title
      }))
    )
  }
  const entries = items.map(item => item.entry)
  const hash = bundleHashOfModules(entries)
  const versionRow = db.prepare('SELECT MAX(version) AS version FROM app_requirement_bundles WHERE app_id = ?').get(appId) as
    | { version: number | null }
    | undefined
  const version = (versionRow?.version ?? 0) + 1
  db.prepare(`
    INSERT INTO app_requirement_bundles (id, app_id, version, modules_json, bundle_hash, change_set_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `reqb-${randomUUID()}`,
    appId,
    version,
    JSON.stringify(entries),
    hash,
    options.changeSetId === undefined ? (activeChangeSetRow(appId)?.id ?? null) : options.changeSetId,
    nowIso()
  )
  return { version, hash, modules: entries }
}

export interface ConfirmBundleResult {
  appConfirmed: boolean
  alreadyConfirmed: boolean
  pendingModuleIds: string[]
  bundle: RequirementBundleView
}

/**
 * 应用级“完成需求阶段”：全部必选未归档模块 confirmed → 生成 bundle + 应用确认 + 进入设计。
 * 已确认时幂等返回（不重复产 bundle）。
 */
export function confirmRequirementBundle(appId: string): ConfirmBundleResult {
  const app = appRowOrThrow(appId)
  // M5：需求变更单只校验/推进本次选中的模块；未选模块应保持 confirmed（不改动）
  const active = activeChangeSetRow(appId)
  const moduleRows = active && active.scope === 'requirements' ? changeSetModuleRows(active.id) : []
  const selected = moduleRows.length ? new Set(moduleRows.map(row => row.module_id)) : null
  const pending = pendingModuleIds(appId).filter(moduleId => !selected || selected.has(moduleId))
  const bundleView = requirementBundleView(appId)
  if (app.requirements_confirmed_at && app.status !== 'requirements') {
    return { appConfirmed: true, alreadyConfirmed: true, pendingModuleIds: pending, bundle: bundleView }
  }
  if (!bundleView.modules.length) {
    throw new RequirementDocError(400, '应用还没有需求模块，无法完成需求阶段')
  }
  if (pending.length) {
    const items = currentBundleEntries(appId)
    throw new RequirementDocError(
      400,
      `还有 ${pending.length} 个必选模块未确认需求`,
      items
        .filter(item => pending.includes(item.entry.moduleId))
        .map(item => ({ moduleId: item.entry.moduleId, moduleKey: item.entry.moduleKey, title: item.entry.title }))
    )
  }
  if (app.status !== 'requirements') {
    throw new RequirementDocError(409, `当前阶段不能完成需求（${app.status}）`)
  }

  const now = nowIso()
  let version = 0
  let aggregateVersion = 0
  const tx = db.transaction(() => {
    const snapshot = createRequirementBundleSnapshot(appId, { requireConfirmed: true })
    version = snapshot.version
    aggregateVersion = snapshot.modules.reduce((max, entry) => Math.max(max, entry.docVersion), 0)
    db.prepare('UPDATE apps SET status = ?, requirements_confirmed_at = ?, updated_at = ? WHERE id = ?').run(
      'design',
      now,
      now,
      appId
    )
    recordStageEvent(appId, 'requirements', 'bundle-confirmed', {
      bundleVersion: version,
      moduleCount: snapshot.modules.length,
      requirementsVersion: aggregateVersion
    })
  })
  tx()
  updateActiveChangeSet(appId, { status: 'design', requirementsVersion: aggregateVersion })
  return {
    appConfirmed: true,
    alreadyConfirmed: false,
    pendingModuleIds: [],
    bundle: requirementBundleView(appId)
  }
}

// ------------------------------------------------------------- 初始文档

/** 与 doc.ts `renderContentMd` 等价（模块初始文档用；文档保存仍走 doc.ts） */
function renderContentMd(title: string, sections: RequirementDocSection[]): string {
  const parts: string[] = [`# ${title}`]
  for (const section of sections) {
    parts.push(`${'#'.repeat(section.level)} ${section.title}`)
    const body = section.markdown.trim()
    if (body) parts.push(body)
  }
  return `${parts.join('\n\n')}\n`
}

function writeModuleSections(appId: string, moduleId: string, sections: RequirementDocSection[], now: string): void {
  const insert = db.prepare(`
    INSERT INTO app_requirement_doc_sections
      (app_id, module_id, section_key, title, level, kind, markdown, data_json, required, position, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  sections.forEach((section, index) => {
    insert.run(
      appId,
      moduleId,
      section.sectionKey,
      section.title,
      section.level,
      section.kind,
      section.markdown,
      section.data ? JSON.stringify(section.data) : null,
      section.required ? 1 : 0,
      index,
      now
    )
  })
}

/** 与 doc.ts `snapshotVersion` 的 sections_json 格式一致（去掉 updatedAt，保留 data） */
function sectionToSnapshot(section: RequirementDocSection): Record<string, unknown> {
  return {
    sectionKey: section.sectionKey,
    title: section.title,
    level: section.level,
    kind: section.kind,
    markdown: section.markdown,
    ...(section.data ? { data: section.data } : {}),
    required: section.required,
    position: section.position
  }
}
