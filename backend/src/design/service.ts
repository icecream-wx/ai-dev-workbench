/**
 * 设计阶段服务（D1—D4；M4 模块化）
 *
 * 数据（全部按 app + module 归属）：
 * - app_design_projects：一行/应用+模块（原型模板、状态、版本、来源需求文档版本）
 * - app_design_entities：模块内实体（字段/关系 JSON；实体 ID 全应用唯一）
 * - app_design_page_sets + app_design_pages：模块内页面集/页面规格/确认/图片路径
 * - app_design_versions：模块设计版本（实体 + 页面集快照）
 * - app_design_inputs：模块需求输入快照（唯一 app+module+docHash）
 *
 * 边界：D1—D4/M4 只记录设计确认状态，不生成交接包、不切换开发阶段（D5/M6）。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { db, nowIso, readSetting, writeSetting } from '../db'
import { appDirOf } from '../apps/scaffold'
import { prototypeTemplateForNewProject, syncAppPrototypeTemplate } from '../apps/template-resolution'
import { activeChangeSetRow, assertAllModulesInActiveChangeSet, assertModuleInActiveChangeSet, touchChangeSetModule, updateActiveChangeSet } from '../changesets/query'
import { chatJson } from '../agents/llm'
import { ensureRequirementDoc } from '../requirements/doc'
import {
  assertModuleWritable,
  defaultModule,
  latestRequirementBundle,
  moduleById,
  moduleOrThrow,
  resolveModule,
  type ModuleRow
} from '../requirements/modules'
import { DesignError } from './errors'
import { epicRefsOf, findEpicNode, pageSetBelongsToEpic, type DesignEpicNode } from './epic-context'
import {
  buildEntityGenerationPrompt,
  buildEpicEntityGenerationPrompt,
  buildEpicPageSetGenerationPrompt,
  buildPageSetGenerationPrompt
} from './prompt'
import {
  buildDesignInput,
  computeCoverage,
  computeStale,
  diffDesignInputs,
  filterRefs,
  latestDesignInput,
  persistDesignInput,
  readDesignInput,
  requirementRefWarnings,
  summaryOf,
  validRefsOf
} from './input'
import { defaultPrototypeTemplate, getPrototypeTemplateOrThrow } from './templates'
import type {
  DesignCoverage,
  DesignEntity,
  DesignEpicGenerationResult,
  DesignEpicImpact,
  DesignField,
  DesignFieldType,
  DesignInputBundle,
  DesignInputEpic,
  DesignInputSyncMode,
  DesignInputSyncResult,
  DesignItemStatus,
  DesignPage,
  DesignPageLayout,
  DesignPageSet,
  DesignPageSpec,
  DesignOtherModuleEntity,
  DesignProjectPayload,
  DesignProjectStatus,
  DesignReadiness,
  DesignRelation,
  DesignRelationType,
  DesignRequirementSource,
  DesignStaleState,
  DesignSyncAffected,
  DesignVersionDetail,
  DesignVersionMeta,
  DesignVersionSource,
  PrototypePageType,
  PrototypeTemplate
} from './types'

interface ProjectRow {
  app_id: string
  module_id: string
  prototype_template_id: string
  status: string
  version: number
  source_doc_version: number | null
  source_input_id: string | null
  source_input_hash: string | null
  created_at: string
  updated_at: string
  confirmed_at: string | null
}

interface EntityRow {
  id: string
  app_id: string
  module_id: string
  name: string
  table_name: string | null
  description: string | null
  fields_json: string
  relations_json: string
  requirement_refs_json: string | null
  source_sections_json: string | null
  status: string
  position: number
  created_at: string
  updated_at: string
}

interface PageSetRow {
  id: string
  app_id: string
  module_id: string
  scene_key: string
  epic_id: string | null
  story_ids_json: string | null
  title: string
  description: string | null
  status: string
  position: number
  created_at: string
  updated_at: string
}

interface PageRow {
  id: string
  app_id: string
  module_id: string
  page_set_id: string
  page_key: string
  title: string
  type: string
  entity_id: string | null
  requirement_refs_json: string | null
  spec_json: string
  layout_json: string
  status: string
  version: number
  image_path: string | null
  html_path: string | null
  image_hash: string | null
  position: number
  created_at: string
  updated_at: string
}

interface VersionRow {
  id: number
  app_id: string
  module_id: string
  version: number
  entities_json: string
  page_sets_json: string
  source: string
  change_set_id: string | null
  change_set_seq: number | null
  change_set_title: string | null
  created_at: string
}

const FIELD_TYPES: DesignFieldType[] = ['string', 'text', 'number', 'decimal', 'date', 'datetime', 'time', 'boolean', 'enum', 'ref']
const RELATION_TYPES: DesignRelationType[] = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many']
const PAGE_TYPES: PrototypePageType[] = ['list', 'form', 'detail', 'dashboard', 'kanban', 'gantt', 'calendar']
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/
const FIELD_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/
/** 需求稳定 ID：SCENE-001 / EPIC-001 / STORY-001 / ROLE-001 / Q-001 */
const REF_PATTERN = /^(?:SCENE|EPIC|STORY|ROLE|Q)-\d{1,6}$/
const SECTION_REF_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/
const MAX_IMAGE_BYTES = 16 * 1024 * 1024
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === 'true'
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const ACTION_ALIASES: Record<string, string> = {
  新增: 'create',
  新建: 'create',
  创建: 'create',
  新增客户: 'create',
  新增订单: 'create',
  增加: 'create',
  编辑: 'edit',
  修改: 'edit',
  删除: 'delete',
  查看: 'detail',
  详情: 'detail',
  查看详情: 'detail',
  提交: 'submit',
  取消: 'cancel',
  保存: 'save',
  导出: 'export',
  导入: 'import',
  批量删除: 'batchDelete',
  审批: 'approve',
  驳回: 'reject'
}

function actionList(value: unknown): string[] {
  return stringList(value).map(action => ACTION_ALIASES[action] ?? action)
}
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const list: string[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      const text = item.trim()
      if (text) list.push(text)
      continue
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    const candidate = record.name ?? record.field ?? record.fieldName ?? record.key ?? record.value ?? record.label ?? record.id
    const text = typeof candidate === 'string' ? candidate.trim() : ''
    if (text) list.push(text)
  }
  return list
}

/** 需求稳定 ID 列表：容忍大小写，过滤非法值 */
function refList(value: unknown): string[] {
  const seen = new Set<string>()
  const refs: string[] = []
  for (const item of stringList(value)) {
    const ref = item.toUpperCase()
    if (!REF_PATTERN.test(ref) || seen.has(ref)) continue
    seen.add(ref)
    refs.push(ref)
  }
  return refs
}

function appOrThrow(appId: string): { id: string; name: string; status: string } {
  const row = db.prepare('SELECT id, name, status FROM apps WHERE id = ?').get(appId) as
    | { id: string; name: string; status: string }
    | undefined
  if (!row) throw new DesignError(404, `应用不存在：${appId}`)
  return row
}

function projectRowOf(appId: string, moduleId: string): ProjectRow | undefined {
  return db
    .prepare('SELECT * FROM app_design_projects WHERE app_id = ? AND module_id = ?')
    .get(appId, moduleId) as ProjectRow | undefined
}

/** 解析模块：空/缺省 → 默认模块（懒创建）；未知 ID → 404 */
function moduleOf(appId: string, moduleId?: string): ModuleRow {
  return resolveModule(appId, moduleId)
}

/** 写操作模块守卫：已归档模块 → 409（读仍允许） */
function writableModuleOf(appId: string, moduleId?: string): ModuleRow {
  const module = moduleOf(appId, moduleId)
  assertModuleWritable(module)
  return module
}

function assertDesignEditable(appId: string, moduleId: string): void {
  const row = projectRowOf(appId, moduleId)
  if (row?.status === 'confirmed') {
    throw new DesignError(409, '设计已确认，当前为只读；请先点击「重新编辑设计」再修改')
  }
}

function projectStatus(value: string): DesignProjectStatus {
  return value === 'confirmed' || value === 'review' ? value : 'draft'
}

function itemStatus(value: unknown): DesignItemStatus {
  return value === 'confirmed' ? 'confirmed' : 'draft'
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

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * 设计数据的三张表都是全局主键（id 上无 app_id 复合约束），
 * 因此“本应用未占用”不等于“可插入”；生成/接受 raw id 前必须查目标表。
 * 表名用固定白名单，不拼接外部输入。
 */
type DesignIdTable = 'app_design_entities' | 'app_design_page_sets' | 'app_design_pages'

function idExists(table: DesignIdTable, id: string): boolean {
  return Boolean(db.prepare(`SELECT 1 AS found FROM ${table} WHERE id = ?`).get(id))
}

function idAvailable(table: DesignIdTable, id: string, used: Set<string>): boolean {
  return !used.has(id) && !idExists(table, id)
}

function uniqueId(prefix: string, used: Set<string>, table: DesignIdTable): string {
  let candidate = newId(prefix)
  while (!idAvailable(table, candidate, used)) candidate = newId(prefix)
  used.add(candidate)
  return candidate
}

// ---- 读取 ----

function rowToEntity(row: EntityRow): DesignEntity {
  return {
    id: row.id,
    name: row.name,
    tableName: row.table_name ?? '',
    description: row.description ?? '',
    fields: parseJson<DesignField[]>(row.fields_json, []),
    relations: parseJson<DesignRelation[]>(row.relations_json, []),
    requirementRefs: parseJson<string[]>(row.requirement_refs_json, []),
    sourceSections: parseJson<string[]>(row.source_sections_json, []),
    status: itemStatus(row.status),
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function rowToPage(row: PageRow): DesignPage {
  return {
    id: row.id,
    pageSetId: row.page_set_id,
    pageKey: row.page_key,
    title: row.title,
    type: (PAGE_TYPES as string[]).includes(row.type) ? (row.type as PrototypePageType) : 'list',
    entityId: row.entity_id,
    requirementRefs: parseJson<string[]>(row.requirement_refs_json, []),
    spec: parseJson<DesignPageSpec>(row.spec_json, {}),
    layout: parseJson<DesignPageLayout>(row.layout_json, {}),
    status: itemStatus(row.status),
    version: row.version,
    imagePath: row.image_path,
    htmlPath: row.html_path,
    imageHash: row.image_hash,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function readEntities(appId: string, moduleId: string): DesignEntity[] {
  const rows = db
    .prepare('SELECT * FROM app_design_entities WHERE app_id = ? AND module_id = ? ORDER BY position ASC, rowid ASC')
    .all(appId, moduleId) as EntityRow[]
  return rows.map(rowToEntity)
}

function readOtherModuleEntities(
  appId: string,
  moduleId: string
): { models: DesignEntity[]; views: DesignOtherModuleEntity[] } {
  const rows = db
    .prepare(
      `SELECT e.*, m.module_key AS owner_module_key, m.title AS owner_module_title
       FROM app_design_entities e
       JOIN app_modules m ON m.app_id = e.app_id AND m.id = e.module_id
       WHERE e.app_id = ? AND e.module_id <> ?
       ORDER BY m.position ASC, m.module_key ASC, e.position ASC`
    )
    .all(appId, moduleId) as Array<EntityRow & { owner_module_key: string; owner_module_title: string }>
  return {
    models: rows.map(rowToEntity),
    views: rows.map(row => ({
      id: row.id,
      name: row.name,
      tableName: row.table_name ?? '',
      moduleId: row.module_id,
      moduleKey: row.owner_module_key,
      moduleTitle: row.owner_module_title
    }))
  }
}

/** 全应用实体 ID 集合（跨模块关系/页面绑定校验；只读） */
export function appEntityIds(appId: string): Set<string> {
  const rows = db.prepare('SELECT id FROM app_design_entities WHERE app_id = ?').all(appId) as Array<{ id: string }>
  return new Set(rows.map(row => row.id))
}

function readPageSets(appId: string, moduleId: string): DesignPageSet[] {
  const setRows = db
    .prepare(
      'SELECT * FROM app_design_page_sets WHERE app_id = ? AND module_id = ? ORDER BY position ASC, rowid ASC'
    )
    .all(appId, moduleId) as PageSetRow[]
  const pageRows = db
    .prepare(
      `SELECT p.* FROM app_design_pages p
       JOIN app_design_page_sets s ON s.id = p.page_set_id
       WHERE s.app_id = ? AND s.module_id = ?
       ORDER BY p.position ASC, p.rowid ASC`
    )
    .all(appId, moduleId) as PageRow[]
  const bySet = new Map<string, DesignPage[]>()
  for (const row of pageRows) {
    const list = bySet.get(row.page_set_id) ?? []
    list.push(rowToPage(row))
    bySet.set(row.page_set_id, list)
  }
  return setRows.map(row => {
    const pages = bySet.get(row.id) ?? []
    return {
      id: row.id,
      sceneKey: row.scene_key,
      epicId: row.epic_id ?? null,
      storyIds: parseJson<string[]>(row.story_ids_json, []),
      title: row.title,
      description: row.description ?? '',
      status: itemStatus(row.status),
      position: row.position,
      pages,
      entityIds: Array.from(new Set(pages.map(page => page.entityId).filter((id): id is string => Boolean(id)))),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  })
}

function requirementSource(appId: string, moduleId: string): DesignRequirementSource | null {
  try {
    const payload = ensureRequirementDoc(appId, undefined, moduleId)
    return {
      docId: payload.doc.appId,
      title: payload.doc.title,
      version: payload.doc.version,
      status: payload.doc.status,
      templateId: payload.template.id,
      templateName: payload.template.name,
      contentMd: payload.doc.contentMd,
      confirmed: payload.doc.status === 'confirmed'
    }
  } catch {
    return null
  }
}

function templateForProject(row: ProjectRow): PrototypeTemplate {
  try {
    return getPrototypeTemplateOrThrow(row.prototype_template_id)
  } catch {
    const fallback = defaultPrototypeTemplate()
    db.prepare(
      'UPDATE app_design_projects SET prototype_template_id = ?, updated_at = ? WHERE app_id = ? AND module_id = ?'
    ).run(fallback.id, nowIso(), row.app_id, row.module_id)
    return fallback
  }
}

export function ensureDesignProject(appId: string, moduleId?: string): ProjectRow {
  appOrThrow(appId)
  return ensureDesignProjectForModule(appId, moduleOf(appId, moduleId))
}

function ensureDesignProjectForModule(appId: string, module: ModuleRow): ProjectRow {
  let row = projectRowOf(appId, module.id)
  if (row) {
    // 旧项目补绑设计输入（H2）
    if (!row.source_input_id) {
      const input = currentInputIfConfirmed(appId, module.id)
      if (input) {
        db.prepare(`
          UPDATE app_design_projects SET source_input_id = ?, source_input_hash = ?, source_doc_version = ?, updated_at = ?
          WHERE app_id = ? AND module_id = ?
        `).run(input.id, input.docHash, input.docVersion, nowIso(), appId, module.id)
        row = projectRowOf(appId, module.id)
        if (!row) throw new DesignError(500, '设计项目读取失败')
      }
    }
    return row
  }
  const now = nowIso()
  // #7：新项目使用应用默认原型模板（无效/已删除时回退全局默认）
  const template = prototypeTemplateForNewProject(appId)
  const input = currentInputIfConfirmed(appId, module.id)
  db.prepare(`
    INSERT INTO app_design_projects
      (app_id, module_id, prototype_template_id, status, version, source_doc_version, source_input_id, source_input_hash, created_at, updated_at, confirmed_at)
    VALUES (?, ?, ?, 'draft', 1, ?, ?, ?, ?, ?, NULL)
  `).run(appId, module.id, template.id, input?.docVersion ?? null, input?.id ?? null, input?.docHash ?? null, now, now)
  row = projectRowOf(appId, module.id)
  if (!row) throw new DesignError(500, '设计项目创建失败')
  snapshotVersion(appId, module.id, 'template-change', 1, [], [])
  return row
}

/** 只有已确认需求文档才生成并绑定设计输入 */
function currentInputIfConfirmed(appId: string, moduleId: string): DesignInputBundle | null {
  try {
    const payload = ensureRequirementDoc(appId, undefined, moduleId)
    if (payload.doc.status !== 'confirmed') return null
    return latestDesignInput(appId, moduleId)
  } catch {
    return null
  }
}

// ---- 校验 ----

export interface EntityValidationResult {
  issues: string[]
  warnings: string[]
}

/**
 * 实体校验（M4 模块化）：
 * - 表名/字段名唯一性、字段/关系必填等仍按**本模块**校验（阻塞）；
 * - 关系目标 / ref 字段允许引用**全应用**其它模块实体（跨模块依赖），只给 warning 不阻塞；
 * - 与其它模块表名重复只给 warning（M6 交接包再统一处理）。
 */
export function validateEntities(entities: DesignEntity[], otherEntities: DesignEntity[] = []): EntityValidationResult {
  const issues: string[] = []
  const warnings: string[] = []
  const names = new Set<string>()
  const tables = new Set<string>()
  const ids = new Set(entities.map(entity => entity.id))
  const localByName = new Map(entities.map(entity => [entity.name, entity.id]))
  const otherById = new Map(otherEntities.map(entity => [entity.id, entity]))
  const otherByName = new Map(otherEntities.map(entity => [entity.name, entity]))
  const otherTables = new Map(
    otherEntities.filter(entity => entity.tableName).map(entity => [entity.tableName.toLowerCase(), entity])
  )
  const resolveTarget = (target: string): { local: boolean; other?: DesignEntity } => {
    if (ids.has(target) || localByName.has(target)) return { local: true }
    const other = otherById.get(target) ?? otherByName.get(target)
    return other ? { local: false, other } : { local: false }
  }
  for (const entity of entities) {
    if (!entity.name) issues.push('实体名称不能为空')
    if (names.has(entity.name.toLowerCase())) issues.push(`实体名称重复：${entity.name}`)
    names.add(entity.name.toLowerCase())
    if (entity.tableName) {
      const key = entity.tableName.toLowerCase()
      if (tables.has(key)) issues.push(`表名重复：${entity.tableName}`)
      else if (otherTables.has(key)) {
        warnings.push(`跨模块表名重复：${entity.tableName}（与其它模块实体「${otherTables.get(key)?.name ?? ''}」同名）`)
      }
      tables.add(key)
    }
    if (!entity.fields.length) issues.push(`实体「${entity.name}」至少需要 1 个字段`)
    const hasKey = entity.fields.some(field => field.name === 'id' || field.unique)
    if (entity.fields.length && !hasKey) issues.push(`实体「${entity.name}」缺少主键（id 或唯一字段）`)
    const fieldNames = new Set<string>()
    for (const field of entity.fields) {
      if (fieldNames.has(field.name)) issues.push(`实体「${entity.name}」字段名重复：${field.name}`)
      fieldNames.add(field.name)
      if (!FIELD_TYPES.includes(field.type)) issues.push(`实体「${entity.name}」字段「${field.label}」类型不合法`)
      if (field.type === 'enum' && !field.options?.length) issues.push(`实体「${entity.name}」枚举字段「${field.label}」缺少选项`)
      if (field.type === 'ref' && field.ref) {
        const target = resolveTarget(field.ref)
        if (!target.local && !target.other) {
          issues.push(`实体「${entity.name}」字段「${field.label}」引用的实体不存在：${field.ref}`)
        } else if (target.other) {
          warnings.push(`跨模块依赖：实体「${entity.name}」字段「${field.label}」引用其它模块实体「${target.other.name}」`)
        }
      }
    }
    for (const relation of entity.relations) {
      if (!RELATION_TYPES.includes(relation.type)) issues.push(`实体「${entity.name}」关系「${relation.name}」类型不合法`)
      const target = resolveTarget(relation.target)
      if (!target.local && !target.other) {
        issues.push(`实体「${entity.name}」关系「${relation.name}」目标不存在：${relation.target}`)
      } else if (target.other) {
        warnings.push(`跨模块依赖：实体「${entity.name}」关系「${relation.name}」引用其它模块实体「${target.other.name}」`)
      }
    }
  }
  return { issues, warnings: Array.from(new Set(warnings)) }
}

export function readinessOf(
  entities: DesignEntity[],
  pageSets: DesignPageSet[],
  requirement: DesignRequirementSource | null,
  otherEntities: DesignEntity[] = []
): DesignReadiness {
  const issues: string[] = []
  const warnings: string[] = []
  if (!requirement) issues.push('缺少需求文档，无法确认设计')
  else if (!requirement.confirmed) issues.push('需求文档尚未确认')
  if (!entities.length) issues.push('至少需要 1 个实体')
  const validation = validateEntities(entities, otherEntities)
  for (const issue of validation.issues) issues.push(issue)
  for (const warning of validation.warnings) warnings.push(warning)
  const otherEntityIds = new Set(otherEntities.map(entity => entity.id))
  for (const set of pageSets) {
    for (const page of set.pages) {
      if (page.entityId && otherEntityIds.has(page.entityId)) {
        warnings.push(`跨模块依赖：页面「${page.title}」绑定了其它模块实体`)
      }
    }
  }
  const openEntities = entities.filter(entity => entity.status !== 'confirmed')
  if (entities.length && openEntities.length) issues.push(`还有 ${openEntities.length} 个实体未确认：${openEntities.map(e => e.name).join('、')}`)
  if (!pageSets.length) issues.push('至少需要 1 个页面集')
  for (const set of pageSets) {
    if (!set.pages.length) issues.push(`页面集「${set.title}」没有页面`)
    if (!set.pages.some(page => page.type === 'list')) warnings.push(`页面集「${set.title}」没有列表页`)
    if (set.status !== 'confirmed') issues.push(`页面集「${set.title}」未确认`)
    const openPages = set.pages.filter(page => page.status !== 'confirmed')
    if (openPages.length) issues.push(`页面集「${set.title}」还有 ${openPages.length} 个页面未确认`)
  }
  // #5 前置提示：原型截图缺失不阻塞设计确认，但交接包要求每页 PNG，提前告知
  const missingImages = pageSets.reduce((sum, set) => sum + set.pages.filter(page => !page.imagePath).length, 0)
  if (missingImages) {
    warnings.push(`还有 ${missingImages} 个页面没有原型截图；生成交接包前需在设计 Studio 中截图存档`)
  }
  return {
    ok: issues.length === 0,
    issues,
    warnings,
    entityCount: entities.length,
    confirmedEntityCount: entities.filter(entity => entity.status === 'confirmed').length,
    pageSetCount: pageSets.length,
    confirmedPageSetCount: pageSets.filter(set => set.status === 'confirmed').length,
    pageCount: pageSets.reduce((sum, set) => sum + set.pages.length, 0),
    confirmedPageCount: pageSets.reduce((sum, set) => sum + set.pages.filter(page => page.status === 'confirmed').length, 0)
  }
}

// ---- 归一化 ----

function normalizeFieldName(raw: unknown, label: string, index: number): string {
  const value = asString(raw)
  if (FIELD_PATTERN.test(value)) return value
  const ascii = value.replace(/[^a-zA-Z0-9_]/g, '')
  if (/^[a-zA-Z_]/.test(ascii)) return ascii
  const labelAscii = label.replace(/[^a-zA-Z0-9_]/g, '')
  if (/^[a-zA-Z_]/.test(labelAscii)) return labelAscii
  return `field${index + 1}`
}

function normalizeField(raw: unknown, index: number): DesignField {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const label = asString(input.label) || asString(input.name) || `字段 ${index + 1}`
  const name = normalizeFieldName(input.name, label, index)
  const type = (FIELD_TYPES as string[]).includes(asString(input.type)) ? (asString(input.type) as DesignFieldType) : 'string'
  return {
    name,
    label,
    type,
    ...(asBool(input.required) ? { required: true } : {}),
    ...(asBool(input.unique) ? { unique: true } : {}),
    ...(input.default !== undefined && input.default !== null && input.default !== '' ? { default: input.default as string | number | boolean } : {}),
    ...(Array.isArray(input.options)
      ? {
          options: input.options
            .map(item => {
              if (typeof item === 'string') return item.trim()
              if (item && typeof item === 'object' && !Array.isArray(item)) {
                const record = item as Record<string, unknown>
                const candidate = record.label ?? record.name ?? record.value
                return typeof candidate === 'string' ? candidate.trim() : ''
              }
              return ''
            })
            .filter(Boolean)
        }
      : type === 'enum'
        ? { options: ['选项一', '选项二'] }
        : {}),
    ...(asString(input.ref) ? { ref: asString(input.ref) } : {}),
    ...(Number.isFinite(Number(input.length)) ? { length: Math.max(Number(input.length), 1) } : {}),
    ...(Number.isFinite(Number(input.precision)) ? { precision: Math.max(Number(input.precision), 0) } : {}),
    ...(asString(input.note) ? { note: asString(input.note) } : {})
  }
}

function normalizeRelation(raw: unknown): DesignRelation | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  const target = asString(input.target)
  if (!target) return null
  const type = (RELATION_TYPES as string[]).includes(asString(input.type))
    ? (asString(input.type) as DesignRelationType)
    : 'many-to-one'
  return {
    name: asString(input.name) || target,
    type,
    target,
    ...(asString(input.sourceField) ? { sourceField: asString(input.sourceField) } : {}),
    ...(asString(input.targetField) ? { targetField: asString(input.targetField) } : {}),
    ...(asString(input.description) ? { description: asString(input.description) } : {})
  }
}

function normalizeEntities(raw: unknown, existing: DesignEntity[]): DesignEntity[] {
  if (!Array.isArray(raw)) throw new DesignError(400, 'entities 需要是数组')
  const now = nowIso()
  const byId = new Map(existing.map(entity => [entity.id, entity]))
  const byName = new Map(existing.map(entity => [entity.name.toLowerCase(), entity]))
  const used = new Set(existing.map(entity => entity.id))
  const idRemap = new Map<string, string>()
  const result: DesignEntity[] = []
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const input = item as Record<string, unknown>
    const name = asString(input.name)
    if (!name) return
    const rawId = asString(input.id)
    const matched = (rawId ? byId.get(rawId) : undefined) ?? byName.get(name.toLowerCase())
    const id = matched
      ? matched.id
      : rawId && ID_PATTERN.test(rawId) && idAvailable('app_design_entities', rawId, used)
        ? rawId
        : uniqueId('ent', used, 'app_design_entities')
    // 无条件登记：同一 payload 内重复 raw id 时，第二个对象必须换新 ID（不能都认为可用）
    used.add(id)
    // 跨应用 raw id 冲突被换 ID 时，同一 payload 内的字段/关系引用要跟着改写；
    // raw id 若是本应用已有/本次已保留的行（used 命中），不改写，避免误伤现有引用；
    // 同一 rawId 已有映射时不覆盖（引用应指向第一个保留 rawId 的对象）
    if (rawId && rawId !== id && !used.has(rawId) && !idRemap.has(rawId)) idRemap.set(rawId, id)
    const fieldsRaw = Array.isArray(input.fields) ? input.fields : matched?.fields ?? []
    const relationsRaw = Array.isArray(input.relations) ? input.relations : matched?.relations ?? []
    const entity: DesignEntity = {
      id,
      name,
      tableName: asString(input.tableName) || matched?.tableName || '',
      description: asString(input.description) || matched?.description || '',
      fields: fieldsRaw.map((field, fieldIndex) => normalizeField(field, fieldIndex)),
      relations: relationsRaw.map(normalizeRelation).filter((relation): relation is DesignRelation => Boolean(relation)),
      requirementRefs:
        input.requirementRefs === undefined
          ? matched?.requirementRefs ?? []
          : refList(input.requirementRefs),
      sourceSections:
        input.sourceSections === undefined
          ? matched?.sourceSections ?? []
          : stringList(input.sourceSections).filter(item => SECTION_REF_PATTERN.test(item)),
      status: input.status === 'draft' ? 'draft' : input.status === 'confirmed' ? 'confirmed' : 'draft',
      position: Number.isFinite(Number(input.position)) ? Number(input.position) : index,
      createdAt: matched?.createdAt ?? now,
      updatedAt: now
    }
    result.push(entity)
  })
  // 跨应用 raw id 冲突：先把同一 payload 内的字段/关系引用改写到新 ID，再走名称 → id 解析
  if (idRemap.size) {
    for (const entity of result) {
      entity.fields = entity.fields.map(field =>
        field.ref && idRemap.has(field.ref) ? { ...field, ref: idRemap.get(field.ref) as string } : field
      )
      entity.relations = entity.relations.map(relation =>
        idRemap.has(relation.target) ? { ...relation, target: idRemap.get(relation.target) as string } : relation
      )
    }
  }
  // 关系/字段引用：名称 → id
  const idByName = new Map(result.map(entity => [entity.name, entity.id]))
  for (const entity of result) {
    entity.fields = entity.fields.map(field =>
      field.ref && idByName.has(field.ref) ? { ...field, ref: idByName.get(field.ref) } : field
    )
    entity.relations = entity.relations.map(relation =>
      idByName.has(relation.target) ? { ...relation, target: idByName.get(relation.target) as string } : relation
    )
  }
  return result.sort((a, b) => a.position - b.position)
}

function normalizePageSpec(raw: unknown): DesignPageSpec {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const strings = stringList
  return {
    ...(strings(input.fields).length ? { fields: strings(input.fields) } : {}),
    ...(actionList(input.actions).length ? { actions: actionList(input.actions) } : {}),
    ...(strings(input.searchFields).length ? { searchFields: strings(input.searchFields) } : {}),
    ...(strings(input.columns).length ? { columns: strings(input.columns) } : {}),
    ...(Array.isArray(input.groups)
      ? {
          groups: input.groups
            .filter((group): group is Record<string, unknown> => Boolean(group) && typeof group === 'object')
            .map(group => ({ title: asString(group.title), fields: strings(group.fields) }))
            .filter(group => group.title && group.fields.length)
        }
      : {}),
    ...(strings(input.acceptance).length ? { acceptance: strings(input.acceptance) } : {}),
    ...(strings(input.states).length ? { states: strings(input.states) } : {}),
    ...(asString(input.notes) ? { notes: asString(input.notes) } : {}),
    ...(asString(input.description) ? { description: asString(input.description) } : {}),
    ...(input.mode === 'create' || input.mode === 'edit' || input.mode === 'both' ? { mode: input.mode } : {})
  }
}

function normalizePageLayout(raw: unknown): DesignPageLayout {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const table = input.table && typeof input.table === 'object' ? (input.table as Record<string, unknown>) : {}
  const toolbar = input.toolbar && typeof input.toolbar === 'object' ? (input.toolbar as Record<string, unknown>) : {}
  const detail = input.detail && typeof input.detail === 'object' ? (input.detail as Record<string, unknown>) : {}
  const strings = stringList
  return {
    ...(strings(table.columns).length || strings(table.searchFields).length || Number.isFinite(Number(table.pageSize))
      ? {
          table: {
            ...(strings(table.columns).length ? { columns: strings(table.columns) } : {}),
            ...(strings(table.searchFields).length ? { searchFields: strings(table.searchFields) } : {}),
            ...(Number.isFinite(Number(table.pageSize)) ? { pageSize: Math.min(Math.max(Number(table.pageSize), 5), 100) } : {})
          }
        }
      : {}),
    ...(actionList(toolbar.actions).length ? { toolbar: { actions: actionList(toolbar.actions) } } : {}),
    ...(detail.columns === 1 || detail.columns === 2 || detail.columns === 3 ? { detail: { columns: detail.columns } } : {}),
    ...(Array.isArray(input.stats)
      ? {
          stats: input.stats
            .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
            .map(item => ({ label: asString(item.label), metric: asString(item.metric) }))
            .filter(item => item.label && item.metric)
        }
      : {}),
    ...(Array.isArray(input.charts)
      ? {
          charts: input.charts
            .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
            .map(item => ({
              type: (item.type === 'line' || item.type === 'pie' ? item.type : 'bar') as 'bar' | 'line' | 'pie',
              metric: asString(item.metric),
              dimension: asString(item.dimension),
              ...(asString(item.title) ? { title: asString(item.title) } : {})
            }))
            .filter(item => item.metric && item.dimension)
        }
      : {}),
    ...(input.groupMode === 'tabs' ? { groupMode: 'tabs' as const } : {})
  }
}

function defaultPageSpec(type: PrototypePageType, entity: DesignEntity): DesignPageSpec {
  const fields = entity.fields.map(field => field.name)
  const searchPool = entity.fields.filter(field => ['string', 'enum', 'ref', 'date', 'datetime'].includes(field.type)).map(field => field.name)
  if (type === 'list') {
    return {
      actions: ['create', 'edit', 'delete', 'detail'],
      columns: fields.slice(0, 6),
      searchFields: searchPool.slice(0, 3),
      acceptance: [`能查看${entity.name}列表并按条件查询`, `能分页浏览${entity.name}数据`]
    }
  }
  if (type === 'form') {
    return {
      fields,
      actions: ['submit', 'cancel'],
      groups: fields.length > 6 ? [{ title: '基本信息', fields: fields.slice(0, 6) }, { title: '其他信息', fields: fields.slice(6) }] : [],
      acceptance: [`能新增/编辑${entity.name}并保存`, '必填字段校验生效']
    }
  }
  if (type === 'detail') {
    return {
      fields,
      actions: ['edit', 'back'],
      acceptance: [`能查看${entity.name}完整信息`, '能返回列表']
    }
  }
  return { acceptance: [`展示${entity.name}统计视图`] }
}

function normalizePages(
  raw: unknown,
  pageSetId: string,
  existing: DesignPage[],
  entities: DesignEntity[],
  allowedEntityIds: Set<string>
): DesignPage[] {
  if (!Array.isArray(raw)) return []
  const now = nowIso()
  const byId = new Map(existing.map(page => [page.id, page]))
  const byKey = new Map(existing.map(page => [page.pageKey, page]))
  const used = new Set(existing.map(page => page.id))
  const entityById = new Map(entities.map(entity => [entity.id, entity]))
  const entityByName = new Map(entities.map(entity => [entity.name, entity]))
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((input, index) => {
      const title = asString(input.title) || `页面 ${index + 1}`
      const rawId = asString(input.id)
      const pageKey = asString(input.pageKey) || asString(input.key) || `page-${index + 1}`
      const matched = (rawId ? byId.get(rawId) : undefined) ?? byKey.get(pageKey)
      const id = matched
        ? matched.id
        : rawId && ID_PATTERN.test(rawId) && idAvailable('app_design_pages', rawId, used)
          ? rawId
          : uniqueId('pg', used, 'app_design_pages')
      // 无条件登记：同一 payload 内重复 raw id 时后续对象换新 ID
      used.add(id)
      const type = (PAGE_TYPES as string[]).includes(asString(input.type)) ? (asString(input.type) as PrototypePageType) : 'list'
      const rawEntity = asString(input.entityId)
      // M4：页面允许绑定其它模块实体（全应用 ID），只给 warning 不阻塞
      const entityId = entityById.has(rawEntity)
        ? rawEntity
        : entityByName.get(rawEntity)?.id ??
          (allowedEntityIds.has(rawEntity) ? rawEntity : matched?.entityId ?? null)
      const spec = input.spec && typeof input.spec === 'object' ? normalizePageSpec(input.spec) : { ...(matched?.spec ?? {}) }
      const layout = input.layout && typeof input.layout === 'object' ? normalizePageLayout(input.layout) : { ...(matched?.layout ?? {}) }
      const status = input.status === 'confirmed' ? 'confirmed' : 'draft'
      return {
        id,
        pageSetId,
        pageKey,
        title,
        type,
        entityId,
        requirementRefs:
          input.requirementRefs === undefined
            ? matched?.requirementRefs ?? []
            : refList(input.requirementRefs),
        spec,
        layout,
        status,
        version: matched?.version ?? 1,
        imagePath:
          input.imagePath === null
            ? null
            : typeof input.imagePath === 'string'
              ? input.imagePath
              : matched?.imagePath ?? null,
        htmlPath:
          input.htmlPath === null
            ? null
            : typeof input.htmlPath === 'string'
              ? input.htmlPath
              : matched?.htmlPath ?? null,
        imageHash:
          input.imageHash === null
            ? null
            : typeof input.imageHash === 'string'
              ? input.imageHash
              : matched?.imageHash ?? null,
        position: index,
        createdAt: matched?.createdAt ?? now,
        updatedAt: now
      } satisfies DesignPage
    })
}

function normalizePageSets(
  raw: unknown,
  existing: DesignPageSet[],
  entities: DesignEntity[],
  allowedEntityIds: Set<string>
): DesignPageSet[] {
  if (!Array.isArray(raw)) throw new DesignError(400, 'pageSets 需要是数组')
  const now = nowIso()
  const byId = new Map(existing.map(set => [set.id, set]))
  const byScene = new Map(existing.map(set => [set.sceneKey, set]))
  const byTitle = new Map(existing.map(set => [set.title.toLowerCase(), set]))
  const used = new Set(existing.map(set => set.id))
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((input, index) => {
      const title = asString(input.title) || `页面集 ${index + 1}`
      const sceneKey = asString(input.sceneKey) || `scene-${index + 1}`
      const rawId = asString(input.id)
      const matched =
        (rawId ? byId.get(rawId) : undefined) ?? byScene.get(sceneKey) ?? byTitle.get(title.toLowerCase())
      const id = matched
        ? matched.id
        : rawId && ID_PATTERN.test(rawId) && idAvailable('app_design_page_sets', rawId, used)
          ? rawId
          : uniqueId('ps', used, 'app_design_page_sets')
      // 无条件登记：同一 payload 内重复 raw id 时后续对象换新 ID
      used.add(id)
      const pages = normalizePages(input.pages, id, matched?.pages ?? [], entities, allowedEntityIds)
      const status = input.status === 'confirmed' ? 'confirmed' : 'draft'
      const normalizedPages = status === 'confirmed' ? pages.map(page => ({ ...page, status: 'confirmed' as const })) : pages
      const epicId =
        input.epicId === undefined
          ? matched?.epicId ?? null
          : REF_PATTERN.test(asString(input.epicId).toUpperCase())
            ? asString(input.epicId).toUpperCase()
            : null
      const storyIds =
        input.storyIds === undefined
          ? matched?.storyIds ?? []
          : refList(input.storyIds)
      return {
        id,
        sceneKey,
        epicId,
        storyIds,
        title,
        description: asString(input.description) || matched?.description || '',
        status,
        position: index,
        pages: normalizedPages,
        entityIds: Array.from(
          new Set(normalizedPages.map(page => page.entityId).filter((entityId): entityId is string => Boolean(entityId)))
        ),
        createdAt: matched?.createdAt ?? now,
        updatedAt: now
      } satisfies DesignPageSet
    })
}

// ---- 写盘 ----

function writeEntities(appId: string, moduleId: string, entities: DesignEntity[]): void {
  const now = nowIso()
  const insert = db.prepare(`
    INSERT INTO app_design_entities
      (id, app_id, module_id, name, table_name, description, fields_json, relations_json,
       requirement_refs_json, source_sections_json, status, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  // 先删后插必须原子：插入失败时旧实体保留（better-sqlite3 嵌套事务自动用 savepoint）
  const write = db.transaction(() => {
    db.prepare('DELETE FROM app_design_entities WHERE app_id = ? AND module_id = ?').run(appId, moduleId)
    entities.forEach((entity, index) => {
      insert.run(
        entity.id,
        appId,
        moduleId,
        entity.name,
        entity.tableName || null,
        entity.description || null,
        JSON.stringify(entity.fields),
        JSON.stringify(entity.relations),
        JSON.stringify(entity.requirementRefs ?? []),
        JSON.stringify(entity.sourceSections ?? []),
        entity.status,
        index,
        entity.createdAt || now,
        now
      )
    })
  })
  write()
}

function writePageSets(appId: string, moduleId: string, pageSets: DesignPageSet[]): void {
  const now = nowIso()
  const insertSet = db.prepare(`
    INSERT INTO app_design_page_sets
      (id, app_id, module_id, scene_key, epic_id, story_ids_json, title, description, status, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertPage = db.prepare(`
    INSERT INTO app_design_pages
      (id, app_id, module_id, page_set_id, page_key, title, type, entity_id, requirement_refs_json, spec_json, layout_json,
       status, version, image_path, html_path, image_hash, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  // 先删后插必须原子：插入失败时旧页面集/页面保留（better-sqlite3 嵌套事务自动用 savepoint）
  const write = db.transaction(() => {
    db.prepare(
      `DELETE FROM app_design_pages
       WHERE page_set_id IN (SELECT id FROM app_design_page_sets WHERE app_id = ? AND module_id = ?)`
    ).run(appId, moduleId)
    db.prepare('DELETE FROM app_design_page_sets WHERE app_id = ? AND module_id = ?').run(appId, moduleId)
    pageSets.forEach((set, setIndex) => {
      insertSet.run(
        set.id,
        appId,
        moduleId,
        set.sceneKey,
        set.epicId,
        JSON.stringify(set.storyIds ?? []),
        set.title,
        set.description || null,
        set.status,
        setIndex,
        set.createdAt || now,
        now
      )
      set.pages.forEach((page, pageIndex) => {
        insertPage.run(
          page.id,
          appId,
          moduleId,
          set.id,
          page.pageKey,
          page.title,
          page.type,
          page.entityId,
          JSON.stringify(page.requirementRefs ?? []),
          JSON.stringify(page.spec),
          JSON.stringify(page.layout),
          page.status,
          page.version,
          page.imagePath,
          page.htmlPath,
          page.imageHash,
          pageIndex,
          page.createdAt || now,
          now
        )
      })
    })
  })
  write()
}

function snapshotVersion(
  appId: string,
  moduleId: string,
  source: DesignVersionSource,
  version: number,
  entities: DesignEntity[],
  pageSets: DesignPageSet[]
): void {
  // 变更中产生的版本标记变更单（C1）；没有 active 变更单时为 null
  const changeSetId = activeChangeSetRow(appId)?.id ?? null
  db.prepare(`
    INSERT INTO app_design_versions (app_id, module_id, version, entities_json, page_sets_json, source, change_set_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(appId, moduleId, version, JSON.stringify(entities), JSON.stringify(pageSets), source, changeSetId, nowIso())
  // M5：同步变更单模块 current 设计版本/hash（历史面板版本区间）
  if (changeSetId) {
    touchChangeSetModule(changeSetId, moduleId, {
      designCurrentVersion: version,
      designCurrentHash: designStateHash(entities, pageSets)
    })
  }
}

/**
 * 设计状态固定 hash（M5 变更单/设计输入）：
 * - `sha256(JSON.stringify({ entities, pageSets }))`；
 * - 实体/页面集/页面都按 position 排序（同 position 保持读取顺序）；
 * - 只取稳定字段（去掉 createdAt/updatedAt，避免仅“触碰”就换 hash），字段顺序固定；
 * - 页面 `spec/layout` 直接 JSON 序列化；测试按同一函数固定语义。
 */
export function designStateHash(entities: DesignEntity[], pageSets: DesignPageSet[]): string {
  const byPosition = <T extends { position: number }>(items: T[]): T[] =>
    [...items].sort((a, b) => a.position - b.position)
  const normalizedEntities = byPosition(entities).map(entity => ({
    id: entity.id,
    name: entity.name,
    tableName: entity.tableName,
    description: entity.description,
    fields: entity.fields,
    relations: entity.relations,
    requirementRefs: entity.requirementRefs,
    sourceSections: entity.sourceSections,
    status: entity.status,
    position: entity.position
  }))
  const normalizedPageSets = byPosition(pageSets).map(set => ({
    id: set.id,
    sceneKey: set.sceneKey,
    epicId: set.epicId,
    storyIds: set.storyIds,
    title: set.title,
    description: set.description,
    status: set.status,
    position: set.position,
    pages: byPosition(set.pages).map(page => ({
      id: page.id,
      pageSetId: page.pageSetId,
      pageKey: page.pageKey,
      title: page.title,
      type: page.type,
      entityId: page.entityId,
      requirementRefs: page.requirementRefs,
      spec: page.spec,
      layout: page.layout,
      status: page.status,
      version: page.version,
      imagePath: page.imagePath,
      htmlPath: page.htmlPath,
      imageHash: page.imageHash,
      position: page.position
    }))
  }))
  return crypto.createHash('sha256').update(JSON.stringify({ entities: normalizedEntities, pageSets: normalizedPageSets })).digest('hex')
}

/** 读取当前模块设计并计算固定 hash（变更单基线/取消恢复/设计输入） */
export function currentDesignStateHash(appId: string, moduleId: string): string {
  return designStateHash(readEntities(appId, moduleId), readPageSets(appId, moduleId))
}


/** 自动保存：只更新 updated_at，不递增版本、不写快照（R2c） */
function touchProject(appId: string, moduleId: string): void {
  db.prepare('UPDATE app_design_projects SET updated_at = ? WHERE app_id = ? AND module_id = ?').run(
    nowIso(),
    appId,
    moduleId
  )
}

/**
 * 关键节点快照：版本 +1 并写入当前实体/页面集快照（R2c）。
 * 默认把项目退回 draft（AI 生成/模板切换/回滚/同步都是编辑动作）；
 * confirmDesign/取消恢复在各自事务里显式处理版本与状态，不走这里。
 */
function appendVersion(appId: string, moduleId: string, source: DesignVersionSource): number {
  const row = projectRowOf(appId, moduleId)
  if (!row) throw new DesignError(500, '设计项目不存在')
  const version = row.version + 1
  const now = nowIso()
  // 注意：需求输入绑定只在创建/同步时更新；这里不刷新 source_*，否则需求变更会被静默吞掉
  db.prepare(`
    UPDATE app_design_projects SET version = ?, status = 'draft', confirmed_at = NULL, updated_at = ?
    WHERE app_id = ? AND module_id = ?
  `).run(version, now, appId, moduleId)
  snapshotVersion(appId, moduleId, source, version, readEntities(appId, moduleId), readPageSets(appId, moduleId))
  return version
}

// ---- 对外：读取/保存 ----

export function getDesign(appId: string, moduleId?: string): DesignProjectPayload {
  const app = appOrThrow(appId)
  const module = moduleOf(appId, moduleId)
  const row = ensureDesignProjectForModule(appId, module)
  const template = templateForProject(row)
  const entities = readEntities(appId, module.id)
  const pageSets = readPageSets(appId, module.id)
  const other = readOtherModuleEntities(appId, module.id)
  const requirement = requirementSource(appId, module.id)
  const current = buildDesignInput(appId, module.id)
  const bound = row.source_input_id ? readDesignInput(appId, row.source_input_id, module.id) : null
  const input = bound ?? (requirement?.confirmed ? persistDesignInput(appId, current, module.id) : null)
  const stale = computeStale(input, current, current, current.bundleHash)
  const coverage = computeCoverage(input, entities, pageSets)
  const refWarnings = requirementRefWarnings(input, entities, pageSets)
  const warnings = Array.from(new Set([...refWarnings, ...coverage.warnings]))
  const readiness = readinessOf(entities, pageSets, requirement, other.models)
  if (stale.stale) {
    const staleIssue = '需求文档已变更，请先同步设计输入后再确认设计'
    if (!readiness.issues.includes(staleIssue)) readiness.issues.push(staleIssue)
    readiness.ok = false
  }
  for (const warning of coverage.warnings) {
    if (!readiness.warnings.includes(warning)) readiness.warnings.push(warning)
  }
  const modules = designModulesState(appId)
  return {
    appId,
    appName: app.name,
    module: {
      id: module.id,
      key: module.module_key,
      title: module.title,
      status: projectStatus(row.status)
    },
    otherModuleEntities: other.views,
    allModulesConfirmed: modules.allModulesConfirmed,
    pendingModuleIds: modules.pendingModuleIds,
    status: projectStatus(row.status),
    version: row.version,
    sourceDocVersion: row.source_doc_version,
    sourceInputId: row.source_input_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
    template,
    entities,
    pageSets,
    readiness,
    requirement,
    input,
    inputSummary: input ? summaryOf(input) : null,
    latestInput: summaryOf(current),
    stale,
    coverage,
    warnings,
    chat: readDesignChat(appId, module.id)
  }
}

export interface DesignModuleSummary {
  moduleId: string
  moduleKey: string
  title: string
  required: boolean
  position: number
  status: DesignProjectStatus
  version: number
  entityCount: number
  pageSetCount: number
  pageCount: number
  missingImages: number
  confirmedAt: string | null
}

export interface DesignModulesState {
  modules: DesignModuleSummary[]
  /** 全部必选未归档模块设计已确认（应用级交接包门禁） */
  allModulesConfirmed: boolean
  pendingModuleIds: string[]
}

/**
 * 应用级设计总览（只读）：不建模块/项目/版本，不调模型。
 * 数据源：未归档模块 LEFT JOIN 模块设计项目 + 实体/页面集/页面（缺图）计数。
 */
export function designModulesState(appId: string): DesignModulesState {
  const rows = db
    .prepare(`
      SELECT m.id, m.module_key, m.title, m.required, m.position,
             p.status AS project_status, p.version AS project_version, p.confirmed_at,
             (SELECT COUNT(*) FROM app_design_entities e
               WHERE e.app_id = m.app_id AND e.module_id = m.id) AS entity_count,
             (SELECT COUNT(*) FROM app_design_page_sets s
               WHERE s.app_id = m.app_id AND s.module_id = m.id) AS page_set_count,
             (SELECT COUNT(*) FROM app_design_pages pg
               WHERE pg.app_id = m.app_id AND pg.module_id = m.id) AS page_count,
             (SELECT COUNT(*) FROM app_design_pages pg
               WHERE pg.app_id = m.app_id AND pg.module_id = m.id AND pg.image_path IS NULL) AS missing_images
      FROM app_modules m
      LEFT JOIN app_design_projects p ON p.app_id = m.app_id AND p.module_id = m.id
      WHERE m.app_id = ? AND m.archived_at IS NULL
      ORDER BY m.position ASC, m.module_key ASC
    `)
    .all(appId) as Array<{
    id: string
    module_key: string
    title: string
    required: number
    position: number
    project_status: string | null
    project_version: number | null
    confirmed_at: string | null
    entity_count: number
    page_set_count: number
    page_count: number
    missing_images: number
  }>
  const modules: DesignModuleSummary[] = rows.map(row => ({
    moduleId: row.id,
    moduleKey: row.module_key,
    title: row.title,
    required: row.required === 1,
    position: row.position,
    status: row.project_status === 'confirmed' || row.project_status === 'review' ? projectStatus(row.project_status) : 'draft',
    version: row.project_version ?? 0,
    entityCount: row.entity_count,
    pageSetCount: row.page_set_count,
    pageCount: row.page_count,
    missingImages: row.missing_images,
    confirmedAt: row.confirmed_at
  }))
  const pendingModuleIds = modules.filter(module => module.required && module.status !== 'confirmed').map(module => module.moduleId)
  return {
    modules,
    allModulesConfirmed: modules.length > 0 && pendingModuleIds.length === 0,
    pendingModuleIds
  }
}

/**
 * 应用级设计总览（M5，只读）：逐模块覆盖率/未覆盖 Story/缺图/状态/版本 + 应用汇总 + 需求 bundle。
 * **不得**创建模块/设计项目/版本/输入；只读当前实体/页面集与需求输入。
 */
export interface DesignOverviewCoverage {
  storyTotal: number
  coveredStories: number
  rate: number
  uncovered: Array<{ id: string; title: string }>
}

export interface DesignOverviewModule {
  moduleId: string
  moduleKey: string
  title: string
  required: boolean
  status: DesignProjectStatus
  version: number
  entityCount: number
  pageSetCount: number
  pageCount: number
  missingImages: number
  coverage: DesignOverviewCoverage
  confirmedAt: string | null
}

export interface DesignOverview {
  appId: string
  modules: DesignOverviewModule[]
  summary: {
    moduleCount: number
    confirmed: number
    storyTotal: number
    coveredStories: number
    rate: number
    missingImages: number
  }
  bundle: { version: number; hash: string } | null
}

export function designOverview(appId: string): DesignOverview {
  appOrThrow(appId)
  const state = designModulesState(appId)
  const modules: DesignOverviewModule[] = state.modules.map(module => {
    const docRow = db
      .prepare('SELECT 1 AS found FROM app_requirement_docs WHERE app_id = ? AND module_id = ?')
      .get(appId, module.moduleId)
    let coverage: DesignCoverage | null = null
    if (docRow) {
      try {
        coverage = computeCoverage(buildDesignInput(appId, module.moduleId), readEntities(appId, module.moduleId), readPageSets(appId, module.moduleId))
      } catch {
        coverage = null
      }
    }
    const storyTotal = coverage?.stats.storyCount ?? 0
    const coveredStories = coverage?.stats.coveredStoryCount ?? 0
    const uncovered = (coverage?.stories ?? [])
      .filter(story => !story.covered)
      .map(story => ({ id: story.id, title: story.title }))
    return {
      moduleId: module.moduleId,
      moduleKey: module.moduleKey,
      title: module.title,
      required: module.required,
      status: module.status,
      version: module.version,
      entityCount: module.entityCount,
      pageSetCount: module.pageSetCount,
      pageCount: module.pageCount,
      missingImages: module.missingImages,
      coverage: {
        storyTotal,
        coveredStories,
        rate: storyTotal ? coveredStories / storyTotal : 1,
        uncovered
      },
      confirmedAt: module.confirmedAt
    }
  })
  const storyTotal = modules.reduce((sum, module) => sum + module.coverage.storyTotal, 0)
  const coveredStories = modules.reduce((sum, module) => sum + module.coverage.coveredStories, 0)
  const latest = latestRequirementBundle(appId)
  return {
    appId,
    modules,
    summary: {
      moduleCount: modules.length,
      confirmed: modules.filter(module => module.status === 'confirmed').length,
      storyTotal,
      coveredStories,
      rate: storyTotal ? coveredStories / storyTotal : 1,
      missingImages: modules.reduce((sum, module) => sum + module.missingImages, 0)
    },
    bundle: latest ? { version: latest.version, hash: latest.hash } : null
  }
}

export function designSummary(appId: string, moduleId?: string): null | {
  status: DesignProjectStatus
  version: number
  templateId: string
  templateName: string
  entityCount: number
  confirmedEntityCount: number
  pageSetCount: number
  confirmedPageSetCount: number
  pageCount: number
  updatedAt: string
  confirmedAt: string | null
} {
  // 只读摘要：不创建模块/项目/版本（appPayload 会在列表页调用）
  const module = moduleId ? moduleById(appId, moduleId) : defaultModule(appId)
  if (!module) return null
  const row = projectRowOf(appId, module.id)
  if (!row) return null
  let templateName = row.prototype_template_id
  try {
    templateName = getPrototypeTemplateOrThrow(row.prototype_template_id).name
  } catch {
    // 保留 id
  }
  const entities = readEntities(appId, module.id)
  const pageSets = readPageSets(appId, module.id)
  return {
    status: projectStatus(row.status),
    version: row.version,
    templateId: row.prototype_template_id,
    templateName,
    entityCount: entities.length,
    confirmedEntityCount: entities.filter(entity => entity.status === 'confirmed').length,
    pageSetCount: pageSets.length,
    confirmedPageSetCount: pageSets.filter(set => set.status === 'confirmed').length,
    pageCount: pageSets.reduce((sum, set) => sum + set.pages.length, 0),
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at
  }
}

/** 内部选项：snapshot=true 时本次保存产版本（AI 生成/应用等显式动作） */
export interface DesignSaveOptions {
  snapshot?: boolean
  /** 空/缺省 = 默认模块；未知 → 404；归档 → 409（写） */
  moduleId?: string
}

export function saveEntities(
  appId: string,
  raw: unknown,
  source: DesignVersionSource = 'manual',
  options: DesignSaveOptions = {}
): DesignProjectPayload {
  const module = writableModuleOf(appId, options.moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  ensureDesignProjectForModule(appId, module)
  assertDesignEditable(appId, module.id)
  const existing = readEntities(appId, module.id)
  const other = readOtherModuleEntities(appId, module.id)
  const entities = normalizeEntities(raw, existing)
  const validation = validateEntities(entities, other.models)
  if (validation.issues.length) throw new DesignError(400, '实体设计校验失败', validation.issues)
  writeEntities(appId, module.id, entities)
  if (options.snapshot) appendVersion(appId, module.id, source)
  else touchProject(appId, module.id)
  return getDesign(appId, module.id)
}

export function savePageSets(
  appId: string,
  raw: unknown,
  source: DesignVersionSource = 'manual',
  options: DesignSaveOptions = {}
): DesignProjectPayload {
  const module = writableModuleOf(appId, options.moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  ensureDesignProjectForModule(appId, module)
  assertDesignEditable(appId, module.id)
  const entities = readEntities(appId, module.id)
  const pageSets = normalizePageSets(raw, readPageSets(appId, module.id), entities, appEntityIds(appId))
  writePageSets(appId, module.id, pageSets)
  if (options.snapshot) appendVersion(appId, module.id, source)
  else touchProject(appId, module.id)
  return getDesign(appId, module.id)
}

export function savePageSet(
  appId: string,
  id: string,
  input: Record<string, unknown>,
  moduleId?: string
): DesignProjectPayload {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  ensureDesignProjectForModule(appId, module)
  assertDesignEditable(appId, module.id)
  const existing = readPageSets(appId, module.id)
  const target = existing.find(set => set.id === id)
  if (!target) throw new DesignError(404, `页面集不存在：${id}`)
  const next = existing.map(set =>
    set.id === id
      ? {
          ...set,
          ...(asString(input.title) ? { title: asString(input.title) } : {}),
          ...(asString(input.description) ? { description: asString(input.description) } : {}),
          ...(input.epicId !== undefined
            ? {
                epicId: REF_PATTERN.test(asString(input.epicId).toUpperCase()) ? asString(input.epicId).toUpperCase() : null
              }
            : {}),
          ...(input.storyIds !== undefined
            ? { storyIds: refList(input.storyIds) }
            : {}),
          status: input.status === 'confirmed' ? 'confirmed' : input.status === 'draft' ? 'draft' : set.status,
          ...(Array.isArray(input.pages) ? { pages: input.pages } : {})
        }
      : set
  )
  return savePageSets(appId, next, 'manual', { moduleId: module.id })
}

export function savePage(
  appId: string,
  pageId: string,
  input: Record<string, unknown>,
  moduleId?: string
): DesignProjectPayload {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  ensureDesignProjectForModule(appId, module)
  assertDesignEditable(appId, module.id)
  const sets = readPageSets(appId, module.id)
  const owner = sets.find(set => set.pages.some(page => page.id === pageId))
  if (!owner) throw new DesignError(404, `页面不存在：${pageId}`)
  const entities = readEntities(appId, module.id)
  const next = sets.map(set => {
    if (set.id !== owner.id) return set
    const pages = set.pages.map(page => {
      if (page.id !== pageId) return page
      const changedSpec = input.spec !== undefined
      const changedLayout = input.layout !== undefined
      return {
        ...page,
        ...(asString(input.title) ? { title: asString(input.title) } : {}),
        ...(PAGE_TYPES.includes(asString(input.type) as PrototypePageType) ? { type: asString(input.type) as PrototypePageType } : {}),
        ...(input.entityId !== undefined ? { entityId: asString(input.entityId) || null } : {}),
        ...(input.requirementRefs !== undefined
          ? { requirementRefs: refList(input.requirementRefs) }
          : {}),
        ...(changedSpec ? { spec: normalizePageSpec(input.spec) } : {}),
        ...(changedLayout ? { layout: normalizePageLayout(input.layout) } : {}),
        status: input.status === 'confirmed' ? 'confirmed' : 'draft',
        version: changedSpec || changedLayout ? page.version + 1 : page.version,
        updatedAt: nowIso()
      } satisfies DesignPage
    })
    return { ...set, pages, status: input.setStatus === 'confirmed' ? set.status : 'draft' }
  })
  // M4：页面允许绑定其它模块实体（全应用 ID）；本模块实体也必须在
  const entityIds = appEntityIds(appId)
  const hasInvalid = next.some(set => set.pages.some(page => page.entityId && !entityIds.has(page.entityId)))
  if (hasInvalid) throw new DesignError(400, '页面绑定的实体不存在')
  return savePageSets(appId, next, 'manual', { moduleId: module.id })
}

export function switchProtoTemplate(appId: string, templateId: unknown, moduleId?: string): DesignProjectPayload {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  ensureDesignProjectForModule(appId, module)
  assertDesignEditable(appId, module.id)
  const template = getPrototypeTemplateOrThrow(asString(templateId))
  const now = nowIso()
  db.prepare(`
    UPDATE app_design_projects SET prototype_template_id = ?, status = 'draft', confirmed_at = NULL, updated_at = ?
    WHERE app_id = ? AND module_id = ?
  `).run(template.id, now, appId, module.id)
  // #7：切换后同步应用默认模板（需求阶段原型预览跟随）
  syncAppPrototypeTemplate(appId, template.id)
  appendVersion(appId, module.id, 'template-change')
  return getDesign(appId, module.id)
}

export interface AppTemplateSwitchModulePreview {
  moduleId: string
  moduleKey: string
  title: string
  status: DesignProjectStatus
  version: number
  fromTemplateId: string | null
  toTemplateId: string
  blocked: boolean
}

export interface AppTemplateSwitchPreview {
  templateId: string
  templateName: string
  modules: AppTemplateSwitchModulePreview[]
  blockedModules: Array<{ moduleId: string; moduleKey: string; title: string }>
  canApply: boolean
}

/**
 * 应用级原型模板切换预览（只读）：不写库、不建项目/版本。
 * 归档模块不参与；任一未归档模块设计已确认 → blocked。
 */
export function previewAppProtoTemplateSwitch(appId: string, templateId: unknown): AppTemplateSwitchPreview {
  appOrThrow(appId)
  const template = getPrototypeTemplateOrThrow(asString(templateId))
  const modules = designModulesState(appId).modules
  const rows = modules.map(module => {
    const project = projectRowOf(appId, module.moduleId)
    const blocked = project?.status === 'confirmed'
    return {
      moduleId: module.moduleId,
      moduleKey: module.moduleKey,
      title: module.title,
      status: module.status,
      version: module.version,
      fromTemplateId: project?.prototype_template_id ?? null,
      toTemplateId: template.id,
      blocked
    }
  })
  const blockedModules = rows
    .filter(row => row.blocked)
    .map(row => ({ moduleId: row.moduleId, moduleKey: row.moduleKey, title: row.title }))
  return {
    templateId: template.id,
    templateName: template.name,
    modules: rows,
    blockedModules,
    canApply: rows.length > 0 && blockedModules.length === 0
  }
}

/**
 * 应用级原型模板切换：全部未归档模块保持一致。
 * - 任一未归档模块设计已确认 → 409 + issues，不写任何模块；
 * - 每个已有项目的模块：模板更新、退回 draft、版本 +1、`template-change` 快照；
 * - 尚无设计项目的模块不预建项目（懒创建时会用新的应用默认模板）；
 * - 归档模块不参与；同步应用默认原型模板。
 */
export function switchAppProtoTemplate(appId: string, templateId: unknown): {
  template: PrototypeTemplate
  modules: AppTemplateSwitchModulePreview[]
  changedModuleIds: string[]
} {
  appOrThrow(appId)
  assertAllModulesInActiveChangeSet(appId)
  const template = getPrototypeTemplateOrThrow(asString(templateId))
  const preview = previewAppProtoTemplateSwitch(appId, template.id)
  if (preview.blockedModules.length) {
    throw new DesignError(
      409,
      `还有 ${preview.blockedModules.length} 个模块设计已确认，不能应用级切换原型模板；请先「重新编辑设计」`,
      preview.blockedModules
    )
  }
  if (!preview.modules.length) throw new DesignError(409, '应用还没有未归档模块，不能切换原型模板')
  const changedModuleIds: string[] = []
  const now = nowIso()
  const tx = db.transaction(() => {
    for (const module of preview.modules) {
      const row = projectRowOf(appId, module.moduleId)
      if (!row) continue
      db.prepare(`
        UPDATE app_design_projects
        SET prototype_template_id = ?, status = 'draft', confirmed_at = NULL, version = ?, updated_at = ?
        WHERE app_id = ? AND module_id = ?
      `).run(template.id, row.version + 1, now, appId, module.moduleId)
      snapshotVersion(appId, module.moduleId, 'template-change', row.version + 1, readEntities(appId, module.moduleId), readPageSets(appId, module.moduleId))
      changedModuleIds.push(module.moduleId)
    }
    syncAppPrototypeTemplate(appId, template.id)
    recordStageEvent(appId, 'design', 'app-template-switched', {
      templateId: template.id,
      modules: changedModuleIds.length
    })
  })
  tx()
  return {
    template,
    modules: previewAppProtoTemplateSwitch(appId, template.id).modules,
    changedModuleIds
  }
}

/** 按模板规则从实体生成默认页面集（不需要 AI） */
function hashKey(text: string): string {
  let hash = 5381
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0
  return hash.toString(36)
}

interface RequirementScene {
  key: string
  title: string
  description: string
  primary: DesignEntity
  matched: DesignEntity[]
  /** 来源需求条目（H2）：Epic/Scene + Stories */
  epicId?: string | null
  storyIds?: string[]
  requirementRefs?: string[]
}

const SCENE_TITLE_PREFIX =
  /^\s*(?:(?:Epic|Feature|Story|User\s*Story|场景|业务场景)\s*[0-9一二三四五六七八九十百]*\s*[：:、.\-]\s*|(?:Epic|Feature|Story|User\s*Story)\s+)/i
const SCENE_TITLE_EXCLUDE = /^(用户故事|验收标准|验收要点|业务规则|页面|字段|流程|待确认|说明|背景)/

function cleanSceneTitle(raw: string): string {
  return raw
    .replace(/^#{1,6}\s*/, '')
    .replace(SCENE_TITLE_PREFIX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function parseSceneSection(markdown: string): Array<{ title: string; description: string }> {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const scenes: Array<{ title: string; description: string }> = []
  let current: { title: string; lines: string[] } | null = null
  const flush = (): void => {
    if (!current) return
    const title = cleanSceneTitle(current.title)
    if (title && !SCENE_TITLE_EXCLUDE.test(title) && !scenes.some(item => item.title.toLowerCase() === title.toLowerCase())) {
      const description = current.lines
        .map(line => line.replace(/^\s*[-*+]\s+/, '').trim())
        .filter(Boolean)
        .join(' ')
        .slice(0, 500)
      scenes.push({ title, description })
    }
    current = null
  }
  for (const line of lines) {
    const heading = /^###\s+(.+?)\s*$/.exec(line)
    if (heading) {
      flush()
      current = { title: heading[1], lines: [] }
      continue
    }
    const boldItem = /^\s*[-*+]\s+\*\*(.+?)\*\*/.exec(line)
    if (boldItem) {
      flush()
      current = { title: boldItem[1], lines: [] }
      continue
    }
    if (current) current.lines.push(line)
  }
  flush()
  return scenes
}

function entityMatchScore(entity: DesignEntity, text: string): number {
  const haystack = String(text ?? '').toLowerCase()
  const name = entity.name.toLowerCase()
  let score = 0
  if (name.length >= 2 && haystack.includes(name)) score += name.length * 4
  const core = entity.name.replace(/(管理|明细|信息|资料|数据|记录)$/g, '')
  if (core.length >= 2 && core !== entity.name && haystack.includes(core)) score += core.length * 3
  if (entity.tableName && haystack.includes(entity.tableName.toLowerCase())) score += 2
  return score
}

interface EntitySceneMatch {
  entity: DesignEntity
  storyHits: number
  epicHit: number
  sceneHit: number
  textScore: number
}

/**
 * Epic → 实体匹配分量（P2）。
 *
 * 实体 requirementRefs 与 Epic/Story 的引用交集优先：排序键严格为
 * storyHits → epicHit → sceneHit → textScore，保证只要有 Story 引用命中，
 * 就一定优先于纯文本命中（不受实体名长度影响）。
 * 无引用时退化为旧逻辑的 textScore = entityMatchScore(title) * 10 + entityMatchScore(text)。
 */
function entitySceneMatch(entity: DesignEntity, epic: DesignInputEpic, text: string): EntitySceneMatch {
  const refs = entity.requirementRefs ?? []
  const storyIds = new Set(epic.stories.map(story => story.id))
  return {
    entity,
    storyHits: refs.filter(ref => storyIds.has(ref)).length,
    epicHit: refs.includes(epic.id) ? 1 : 0,
    sceneHit: epic.sceneId && refs.includes(epic.sceneId) ? 1 : 0,
    textScore: entityMatchScore(entity, epic.title) * 10 + entityMatchScore(entity, text)
  }
}

/** 严格字典序：引用命中档位优先，文本分只在同一档位内比较；完全同分保持实体顺序（稳定排序） */
function compareEntitySceneMatch(a: EntitySceneMatch, b: EntitySceneMatch): number {
  if (b.storyHits !== a.storyHits) return b.storyHits - a.storyHits
  if (b.epicHit !== a.epicHit) return b.epicHit - a.epicHit
  if (b.sceneHit !== a.sceneHit) return b.sceneHit - a.sceneHit
  return b.textScore - a.textScore
}

/** 从已确认需求文档的“业务场景与流程 / Epics”派生页面集；优先使用设计项目绑定的输入，避免静默采用未同步的需求 */
function deriveRequirementScenes(
  appId: string,
  moduleId: string,
  entities: DesignEntity[],
  boundInput?: DesignInputBundle | null
): RequirementScene[] {
  const first = entities[0]
  if (!first) return []

  // H2：优先使用设计输入（稳定 ID + Epic/Story）；没有绑定输入时才读取最新文档
  let input: DesignInputBundle | null = boundInput ?? null
  if (!input) {
    try {
      input = latestDesignInput(appId, moduleId)
    } catch {
      input = null
    }
  }
  if (input && input.structure === 'prd' && input.epics.length) {
    const sceneTitle = new Map(input.scenes.map(scene => [scene.id, scene.title]))
    return input.epics.map(epic => {
      const storyText = epic.stories.map(story => `${story.title} ${story.description} ${story.acceptance.join(' ')}`).join(' ')
      const text = `${epic.title} ${epic.goal} ${epic.sceneId ? sceneTitle.get(epic.sceneId) ?? '' : ''} ${storyText}`
      const scored = entities
        .map(entity => entitySceneMatch(entity, epic, text))
        .sort(compareEntitySceneMatch)
      const matched = scored
        .filter(item => item.storyHits + item.epicHit + item.sceneHit + item.textScore > 0)
        .map(item => item.entity)
      const primary = matched[0] ?? first
      const storyIds = epic.stories.map(story => story.id)
      return {
        key: epic.id,
        title: epic.title,
        description: epic.goal || epic.stories[0]?.description || '',
        primary,
        matched: matched.length ? matched : [primary],
        epicId: epic.id,
        storyIds,
        requirementRefs: storyIds.length ? storyIds : [epic.id]
      }
    })
  }
  if (input && input.structure === 'prd' && input.scenes.length) {
    return input.scenes.map(scene => {
      const scored = entities
        .map(entity => ({ entity, score: entityMatchScore(entity, scene.title) * 10 + entityMatchScore(entity, scene.description) }))
        .sort((a, b) => b.score - a.score)
      const matched = scored.filter(item => item.score > 0).map(item => item.entity)
      const primary = matched[0] ?? first
      return {
        key: scene.id,
        title: scene.title,
        description: scene.description,
        primary,
        matched: matched.length ? matched : [primary],
        epicId: null,
        storyIds: [],
        requirementRefs: [scene.id]
      }
    })
  }

  let drafts: Array<{ title: string; description: string }> = []
  try {
    const payload = ensureRequirementDoc(appId, undefined, moduleId)
    for (const section of payload.sections) {
      if (section.kind !== 'scenes' && section.kind !== 'epics') continue
      drafts.push(...parseSceneSection(section.markdown))
    }
  } catch {
    drafts = []
  }
  const used = new Set<string>()
  const scenes: RequirementScene[] = []
  for (const draft of drafts) {
    const title = cleanSceneTitle(draft.title)
    if (!title || used.has(title.toLowerCase())) continue
    used.add(title.toLowerCase())
    const scored = entities
      .map(entity => ({
        entity,
        score: entityMatchScore(entity, title) * 10 + entityMatchScore(entity, draft.description)
      }))
      .sort((a, b) => b.score - a.score)
    const matched = scored.filter(item => item.score > 0).map(item => item.entity)
    const primary = matched[0] ?? entities[0]
    if (!primary) continue
    scenes.push({
      key: `scene:${hashKey(title)}`,
      title,
      description: draft.description,
      primary,
      matched: matched.length ? matched : [primary],
      epicId: null,
      storyIds: [],
      requirementRefs: []
    })
  }
  if (scenes.length) return scenes
  return entities.map(entity => ({
    key: `scene:entity-${entity.id}`,
    title: `${entity.name}管理`,
    description: entity.description,
    primary: entity,
    matched: [entity],
    epicId: null,
    storyIds: [],
    requirementRefs: []
  }))
}

function buildDefaultPagesForScene(
  scene: RequirementScene,
  template: PrototypeTemplate,
  matchedSet: DesignPageSet | undefined,
  now: string,
  usedPages: Set<string>
): DesignPage[] {
  const entity = scene.primary
  const definitions: Array<{ type: PrototypePageType; mode?: 'create' | 'edit' | 'both'; relatedEntity?: DesignEntity }> = []
  for (const type of template.pageSetRules.defaultPages) {
    if (type === 'form') {
      const modes = template.pageSetRules.formModes.length ? template.pageSetRules.formModes : (['both'] as Array<'create' | 'edit' | 'both'>)
      for (const mode of modes) definitions.push({ type: 'form', mode })
      continue
    }
    definitions.push({ type })
  }
  // 场景标题里明确提到的子实体（如“订单及明细管理”）补一个详情页，页面集可引用多个实体
  for (const related of scene.matched) {
    if (related.id === entity.id) continue
    if (!scene.title.includes(related.name)) continue
    if (!template.pageSetRules.defaultPages.includes('detail')) continue
    if (!definitions.some(item => item.type === 'detail' && item.relatedEntity?.id === related.id)) {
      definitions.push({ type: 'detail', relatedEntity: related })
    }
  }

  return definitions.map((definition, index) => {
    const target = definition.relatedEntity ?? entity
    const modeSuffix = definition.mode ? `-${definition.mode}` : ''
    const pageKey = `${target.id}-${definition.type}${modeSuffix}`
    const sceneSuffix = hashKey(scene.key)
    const requirementRefs = scene.storyIds?.length ? [...scene.storyIds] : scene.epicId ? [scene.epicId] : [...(scene.requirementRefs ?? [])]
    const old =
      matchedSet?.pages.find(page => page.pageKey === pageKey) ??
      (definition.type === 'form' && definition.mode === 'create'
        ? matchedSet?.pages.find(page => page.pageKey === `${target.id}-form`)
        : undefined)
    const title =
      definition.type === 'list'
        ? `${target.name}列表`
        : definition.type === 'form'
          ? definition.mode === 'create'
            ? `创建${target.name}`
            : definition.mode === 'edit'
              ? `编辑${target.name}`
              : `${target.name}表单`
          : definition.type === 'detail'
            ? `${target.name}详情`
            : `${target.name}${definition.type}`
    const spec = old?.spec ?? defaultPageSpec(definition.type, target)
    // 编辑已有页面保留原 ID；新页面优先用稳定可读 ID，但目标表全局已占用时必须换新
    const preferred = `${target.id}-${sceneSuffix}-${definition.type}${modeSuffix}`
    let id: string
    if (old?.id) {
      id = old.id
      usedPages.add(id)
    } else if (idAvailable('app_design_pages', preferred, usedPages)) {
      id = preferred
      usedPages.add(preferred)
    } else {
      id = uniqueId('pg', usedPages, 'app_design_pages')
    }
    return {
      id,
      pageSetId: matchedSet?.id ?? '',
      pageKey,
      title,
      type: definition.type,
      entityId: target.id,
      requirementRefs,
      spec: definition.type === 'form' ? { ...spec, mode: definition.mode ?? 'both' } : spec,
      layout:
        old?.layout ??
        {
          ...(definition.type === 'list'
            ? {
                table: {
                  columns: target.fields.slice(0, 6).map(field => field.name),
                  searchFields: target.fields.slice(0, template.pageSetRules.defaultSearchFields).map(field => field.name),
                  pageSize: template.pageSetRules.defaultPageSize
                }
              }
            : {}),
          ...(definition.type === 'detail' ? { detail: { columns: 2 as const } } : {})
        },
      status: old?.status ?? 'draft',
      version: old?.version ?? 1,
      imagePath: old?.imagePath ?? null,
      htmlPath: old?.htmlPath ?? null,
      imageHash: old?.imageHash ?? null,
      position: index,
      createdAt: old?.createdAt ?? now,
      updatedAt: now
    } satisfies DesignPage
  })
}

export function generateDefaultPageSets(appId: string, moduleId?: string): DesignProjectPayload {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  ensureDesignProjectForModule(appId, module)
  assertDesignEditable(appId, module.id)
  const entities = readEntities(appId, module.id)
  if (!entities.length) throw new DesignError(400, '请先完成实体设计，再生成页面集')
  const projectRow = ensureDesignProjectForModule(appId, module)
  const template = templateForProject(projectRow)
  const existing = readPageSets(appId, module.id)
  const existingByScene = new Map(existing.map(set => [set.sceneKey, set]))
  const existingByTitle = new Map(existing.map(set => [set.title.toLowerCase(), set]))
  const existingByEntity = new Map(existing.map(set => [set.sceneKey.replace(/^entity:/, ''), set]))
  const now = nowIso()
  const usedSets = new Set(existing.map(set => set.id))
  // 页面 ID 全局主键，必须在整次生成内共享 used，避免跨页面集重复
  const usedPages = new Set(existing.flatMap(set => set.pages.map(page => page.id)))
  const boundInput = projectRow.source_input_id ? readDesignInput(appId, projectRow.source_input_id, module.id) : null
  const scenes = deriveRequirementScenes(appId, module.id, entities, boundInput)
  const pageSets: DesignPageSet[] = scenes.map((scene, index) => {
    const legacy =
      existingByScene.get(scene.key) ??
      existingByTitle.get(scene.title.toLowerCase()) ??
      existingByEntity.get(scene.primary.id)
    const pages = buildDefaultPagesForScene(scene, template, legacy, now, usedPages)
    const id = legacy?.id ?? uniqueId('ps', usedSets, 'app_design_page_sets')
    const attached = pages.map(page => ({ ...page, pageSetId: id }))
    return {
      id,
      sceneKey: scene.key,
      epicId: scene.epicId ?? null,
      storyIds: scene.storyIds ?? [],
      title: scene.title,
      description: scene.description || scene.primary.description,
      status: legacy?.status ?? 'draft',
      position: index,
      pages: attached,
      entityIds: Array.from(new Set(attached.map(page => page.entityId).filter((entityId): entityId is string => Boolean(entityId)))),
      createdAt: legacy?.createdAt ?? now,
      updatedAt: now
    }
  })
  writePageSets(appId, module.id, pageSets)
  appendVersion(appId, module.id, 'manual')
  return getDesign(appId, module.id)
}

/** AI：从需求文档生成实体初稿 */
export async function generateEntitiesFromRequirement(
  appId: string,
  model?: { providerID: string; id: string; variant?: string | null } | null,
  moduleId?: string
): Promise<{ project: DesignProjectPayload; warnings: string[] }> {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  const project = getDesign(appId, module.id)
  assertDesignEditable(appId, module.id)
  if (!project.requirement?.confirmed) throw new DesignError(400, '需求文档尚未确认，不能生成实体设计')
  const { system, user } = buildEntityGenerationPrompt(project)
  const result = await chatJson(system, user, 1, {
    directory: appDirOf(appId),
    agent: 'design',
    model: model ?? null
  })
  if (!Array.isArray(result.entities)) throw new DesignError(400, 'AI 输出缺少 entities 数组')
  const saved = saveEntities(appId, result.entities, 'ai', { snapshot: true, moduleId: module.id })
  return { project: saved, warnings: saved.warnings }
}

/** AI：按场景/Epic 生成页面集 */
export async function generatePageSetsFromRequirement(
  appId: string,
  model?: { providerID: string; id: string; variant?: string | null } | null,
  moduleId?: string
): Promise<{ project: DesignProjectPayload; warnings: string[] }> {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  const project = getDesign(appId, module.id)
  assertDesignEditable(appId, module.id)
  if (!project.requirement?.confirmed) throw new DesignError(400, '需求文档尚未确认，不能生成页面集')
  if (!project.entities.length) throw new DesignError(400, '请先完成实体设计，再生成页面集')
  const { system, user } = buildPageSetGenerationPrompt(project)
  const result = await chatJson(system, user, 1, {
    directory: appDirOf(appId),
    agent: 'design',
    model: model ?? null
  })
  if (!Array.isArray(result.pageSets)) throw new DesignError(400, 'AI 输出缺少 pageSets 数组')
  const saved = savePageSets(appId, result.pageSets, 'ai', { snapshot: true, moduleId: module.id })
  return { project: saved, warnings: saved.warnings }
}

// ---- D-RMP：按 Epic 生成（实体合并进模块共享池 + 页面集 primary 替换） ----

/** 实体 → 归一化前的 raw 形状（保留 id/状态/位置，供 merge 后重新 normalize） */
function rawEntityOf(entity: DesignEntity): Record<string, unknown> {
  return {
    id: entity.id,
    name: entity.name,
    tableName: entity.tableName,
    description: entity.description,
    fields: entity.fields.map(field => ({ ...field })),
    relations: entity.relations.map(relation => ({ ...relation })),
    requirementRefs: [...entity.requirementRefs],
    sourceSections: [...entity.sourceSections],
    status: entity.status,
    position: entity.position
  }
}

/** 页面 → raw 形状（其它页面集原样保留时使用，避免 normalize 丢字段/状态） */
function rawPageOf(page: DesignPage): Record<string, unknown> {
  return {
    id: page.id,
    pageKey: page.pageKey,
    title: page.title,
    type: page.type,
    entityId: page.entityId,
    requirementRefs: [...page.requirementRefs],
    spec: { ...page.spec },
    layout: { ...page.layout },
    status: page.status,
    version: page.version,
    imagePath: page.imagePath,
    htmlPath: page.htmlPath,
    imageHash: page.imageHash,
    position: page.position
  }
}

function rawPageSetOf(set: DesignPageSet): Record<string, unknown> {
  return {
    id: set.id,
    sceneKey: set.sceneKey,
    epicId: set.epicId,
    storyIds: [...set.storyIds],
    title: set.title,
    description: set.description,
    status: set.status,
    position: set.position,
    pages: set.pages.map(rawPageOf)
  }
}

/** 字段按 name 合并：生成字段覆盖同名，已有未提及字段保留 */
function mergeFieldsForEpic(current: unknown, generated: unknown): DesignField[] {
  const base = Array.isArray(current) ? (current.map(field => ({ ...(field as DesignField) })) as DesignField[]) : []
  const list = Array.isArray(generated) ? generated : []
  const index = new Map(base.map((field, at) => [field.name, at]))
  for (const item of list) {
    const field = normalizeField(item, index.size)
    const at = index.get(field.name)
    if (at === undefined) {
      index.set(field.name, base.length)
      base.push(field)
    } else {
      base[at] = field
    }
  }
  return base
}

/**
 * 关系按名称合并（同名覆盖，未提及保留）。
 * 说明：已有关系 target 是实体 id、模型输出多为实体 name，按 name+target 会产生重复，因此优先按 name 匹配；
 * 仅在重名关系时才用 name+target 区分。
 */
function mergeRelationsForEpic(current: unknown, generated: unknown): DesignRelation[] {
  const base = Array.isArray(current) ? (current.map(item => ({ ...(item as DesignRelation) })) as DesignRelation[]) : []
  const list = Array.isArray(generated) ? generated : []
  const nameCount = new Map<string, number>()
  for (const relation of base) nameCount.set(relation.name, (nameCount.get(relation.name) ?? 0) + 1)
  const keyOf = (relation: DesignRelation): string =>
    (nameCount.get(relation.name) ?? 0) > 1 ? `${relation.name}|${relation.target}` : relation.name
  const index = new Map<string, number>()
  base.forEach((relation, at) => index.set(keyOf(relation), at))
  for (const item of list) {
    const relation = normalizeRelation(item)
    if (!relation) continue
    const key = keyOf(relation)
    const at = index.get(key)
    if (at === undefined) {
      index.set(key, base.length)
      base.push(relation)
    } else {
      base[at] = relation
    }
  }
  return base
}

/**
 * D-RMP 实体合并（模块共享实体池）：
 * - 按 id → name（不区分大小写）匹配已有实体；
 * - 字段按 name、关系按 name 合并：生成覆盖同名，未提及字段/关系保留；
 * - requirementRefs/sourceSections 取并集；更新/新增实体 status='draft'；
 * - 未提及的已有实体原样保留（其它 Epic 数据不丢）。
 */
export function mergeEntitiesForEpic(
  existing: DesignEntity[],
  generated: unknown,
  _epic?: { id: string; isScene: boolean }
): { raw: Record<string, unknown>[]; added: number; updated: number } {
  const list = Array.isArray(generated) ? generated : []
  const byId = new Map(existing.map(entity => [entity.id, entity]))
  const byName = new Map(existing.map(entity => [entity.name.toLowerCase(), entity]))
  const merged = new Map<string, Record<string, unknown>>()
  const order: string[] = []
  for (const entity of existing) {
    merged.set(entity.id, rawEntityOf(entity))
    order.push(entity.id)
  }
  let added = 0
  let updated = 0
  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const input = item as Record<string, unknown>
    const name = asString(input.name)
    const rawId = asString(input.id)
    const match = (rawId ? byId.get(rawId) : undefined) ?? (name ? byName.get(name.toLowerCase()) : undefined)
    if (!match) {
      if (!name) continue
      const key = `__new__${order.length}_${merged.size}`
      order.push(key)
      merged.set(key, { ...input, status: 'draft' })
      added += 1
      continue
    }
    const base = merged.get(match.id) ?? rawEntityOf(match)
    const requirementRefs = Array.from(
      new Set([...(base.requirementRefs as string[]), ...refList(input.requirementRefs)])
    )
    const sourceSections = Array.from(
      new Set([
        ...(base.sourceSections as string[]),
        ...stringList(input.sourceSections).filter(value => SECTION_REF_PATTERN.test(value))
      ])
    )
    merged.set(match.id, {
      ...base,
      name: match.name,
      tableName: asString(input.tableName) || base.tableName,
      description: asString(input.description) || base.description,
      fields: mergeFieldsForEpic(base.fields, input.fields),
      relations: mergeRelationsForEpic(base.relations, input.relations),
      requirementRefs,
      sourceSections,
      status: 'draft'
    })
    updated += 1
  }
  return { raw: order.map(key => merged.get(key) as Record<string, unknown>), added, updated }
}

/**
 * D-RMP 页面集合并（每 Epic 一个 primary）：
 * - primary = 该 Epic 下 position 最小的页面集（epicId 匹配；fallback 用 epicId=null + sceneKey）；
 * - 有 primary：保留 id，替换 title/description/storyIds/pages，status='draft'；
 * - 无 primary：追加；
 * - 其它页面集（其它 Epic / 手工额外）原样保留。
 */
export function mergePageSetForEpic(
  existing: DesignPageSet[],
  generated: Record<string, unknown>,
  node: DesignEpicNode
): { raw: Record<string, unknown>[]; replaced: boolean } {
  const raw = existing.map(rawPageSetOf)
  const primary = existing.find(set => pageSetBelongsToEpic(set, node))
  const storyIds = node.stories.map(story => story.id)
  const pages = Array.isArray(generated.pages) ? generated.pages : []
  const base = {
    sceneKey: node.id,
    epicId: node.isScene ? null : node.id,
    storyIds: storyIds.length ? storyIds : refList(generated.storyIds),
    status: 'draft',
    pages
  }
  if (primary) {
    const at = raw.findIndex(item => item.id === primary.id)
    raw[at] = {
      ...raw[at],
      ...base,
      id: primary.id,
      title: asString(generated.title) || primary.title,
      description: asString(generated.description) || primary.description,
      position: primary.position
    }
    return { raw, replaced: true }
  }
  raw.push({ ...generated, ...base, position: raw.length })
  return { raw, replaced: false }
}

/** D-RMP：目标 Epic 里已确认、生成会重新打开的项 */
export function epicGenerationImpact(project: DesignProjectPayload, node: DesignEpicNode): DesignEpicImpact {
  const refs = new Set(epicRefsOf(node))
  const primary = project.pageSets.find(set => pageSetBelongsToEpic(set, node))
  // MF-DRMP-5：primary 页面绑定的共享实体也算相关（不要求 requirementRefs 命中）
  const boundEntityIds = new Set<string>(
    (primary?.pages ?? []).map(page => page.entityId).filter((entityId): entityId is string => Boolean(entityId))
  )
  return {
    entities: project.entities
      .filter(
        entity =>
          entity.status === 'confirmed' &&
          (entity.requirementRefs.some(ref => refs.has(ref)) || boundEntityIds.has(entity.id))
      )
      .map(entity => ({ id: entity.id, name: entity.name })),
    pageSets: primary && primary.status === 'confirmed' ? [{ id: primary.id, title: primary.title }] : [],
    // MF-DRMP-3：页面集是 draft 时，其中已确认的 page 也会被替换，必须纳入重开提示
    pages: (primary?.pages ?? [])
      .filter(page => page.status === 'confirmed')
      .map(page => ({ id: page.id, title: page.title, pageSetId: primary?.id ?? page.pageSetId }))
  }
}

function impactIssues(impact: DesignEpicImpact): string[] {
  return [
    ...impact.entities.map(item => `实体「${item.name}」已确认`),
    ...impact.pageSets.map(item => `页面集「${item.title}」已确认`),
    ...impact.pages.map(item => `页面「${item.title}」已确认`)
  ]
}

export interface GenerateEpicOptions {
  /** 空/缺省 = 默认模块；未知 404；归档 409 */
  moduleId?: string
  /** 目标已确认项退回 draft 必须显式 true */
  reopenConfirmed?: boolean
  model?: { providerID: string; id: string; variant?: string | null } | null
  /** 单测注入：返回已解析 JSON 对象（不调用真实模型） */
  generator?: (system: string, user: string) => Promise<Record<string, unknown>>
}

/**
 * D-RMP：按 Epic 生成实体 + 页面集（两次模型调用，内存合并，校验后一次写入 + 一个版本）。
 *
 * - 实体：只生成当前 Epic 需要的实体，合并进模块共享实体池（不删其它 Epic/未提及字段/关系）；
 * - 页面集：只生成当前 Epic 的一个页面集；有 primary 则保留 id 替换页面，其它页面集保留；
 * - 任一模型调用/解析/校验失败：不写库、不产版本；
 * - 目标已确认项需要 `reopenConfirmed=true`，且只把受影响项退回 draft；
 * - 生成结果 draft，不自动确认；每 Epic 一个 `ai` 版本。
 */
export async function generateEpicDesign(
  appId: string,
  rawEpicId: string,
  options: GenerateEpicOptions = {}
): Promise<DesignEpicGenerationResult> {
  const epicId = asString(rawEpicId).toUpperCase()
  if (!epicId) throw new DesignError(400, '缺少 epicId')
  const module = writableModuleOf(appId, options.moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  ensureDesignProjectForModule(appId, module)
  assertDesignEditable(appId, module.id)
  const project = getDesign(appId, module.id)
  if (!project.requirement?.confirmed) throw new DesignError(400, '需求文档尚未确认，不能生成设计')
  if (project.stale.stale) throw new DesignError(409, '需求文档已变更，请先同步设计输入后再生成')
  const node = findEpicNode(project, epicId)
  if (!node) throw new DesignError(404, `设计输入中没有该 Epic/场景：${epicId}`)

  const reopen = options.reopenConfirmed === true
  const impact = epicGenerationImpact(project, node)
  if (!reopen) {
    const issues = impactIssues(impact)
    if (issues.length) {
      throw new DesignError(
        409,
        '当前 Epic 已有已确认的设计项；如需重新生成，请勾选“允许重新打开已确认项”后重试',
        issues
      )
    }
  }

  const generator =
    options.generator ??
    ((system: string, user: string) =>
      chatJson(system, user, 1, {
        directory: appDirOf(appId),
        agent: 'design',
        model: options.model ?? null
      }))

  // 1) 实体：只聚焦当前 Epic；合并进模块共享实体池
  const entityPrompt = buildEpicEntityGenerationPrompt(project, node)
  let entityResult: Record<string, unknown>
  try {
    entityResult = await generator(entityPrompt.system, entityPrompt.user)
  } catch (error) {
    throw new DesignError(502, `AI 生成实体失败：${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Array.isArray(entityResult.entities)) throw new DesignError(400, 'AI 输出缺少 entities 数组')
  const existingEntities = readEntities(appId, module.id)
  const merged = mergeEntitiesForEpic(existingEntities, entityResult.entities, node)
  if (!merged.raw.length) throw new DesignError(400, 'AI 未生成任何实体，且当前模块没有可复用的实体')
  // 模型可能按名称复用了其它 Epic 的已确认实体（refs 未命中 Epic）：也算“受影响”，
  // 未显式 reopenConfirmed 时不写库，避免静默把其它 confirmed 项改为 draft。
  const impactedEntityIds = new Set(impact.entities.map(item => item.id))
  const extraConfirmed = existingEntities.filter(
    entity =>
      entity.status === 'confirmed' &&
      !impactedEntityIds.has(entity.id) &&
      merged.raw.some(raw => raw.id === entity.id && raw.status === 'draft')
  )
  if (!reopen && extraConfirmed.length) {
    throw new DesignError(
      409,
      '生成的实体包含其它已确认实体；如需更新，请勾选“允许重新打开已确认项”后重试',
      [...impactIssues(impact), ...extraConfirmed.map(entity => `实体「${entity.name}」已确认`)]
    )
  }
  const other = readOtherModuleEntities(appId, module.id)
  let entities = normalizeEntities(merged.raw, existingEntities)
  const entityValidation = validateEntities(entities, other.models)
  if (entityValidation.issues.length) throw new DesignError(400, '实体设计校验失败', entityValidation.issues)

  // 2) 页面集：用内存中的 mergedEntities 生成，只取当前 Epic 的一个页面集
  const pagePrompt = buildEpicPageSetGenerationPrompt(project, node, entities)
  let pageResult: Record<string, unknown>
  try {
    pageResult = await generator(pagePrompt.system, pagePrompt.user)
  } catch (error) {
    throw new DesignError(502, `AI 生成页面集失败：${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Array.isArray(pageResult.pageSets)) throw new DesignError(400, 'AI 输出缺少 pageSets 数组')
  const candidates = (pageResult.pageSets as unknown[]).filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  )
  const generatedSet =
    candidates.find(item => {
      const key = asString(item.epicId).toUpperCase() || asString(item.sceneKey).toUpperCase()
      return key === node.id
    }) ?? candidates[0]
  if (!generatedSet) throw new DesignError(400, 'AI 输出缺少 pageSets 数组')
  if (!Array.isArray(generatedSet.pages) || !generatedSet.pages.length) {
    throw new DesignError(400, 'AI 生成的页面集没有页面')
  }

  const existingPageSets = readPageSets(appId, module.id)
  const mergedSets = mergePageSetForEpic(existingPageSets, generatedSet, node)
  const pageSets = normalizePageSets(mergedSets.raw, existingPageSets, entities, appEntityIds(appId))

  // 3) 确认项重开：只把受影响项退回 draft，其它 confirmed 保留
  const reopened: string[] = []
  if (reopen) {
    const reopenEntityIds = new Set(impact.entities.map(item => item.id))
    for (const extra of extraConfirmed) reopenEntityIds.add(extra.id)
    if (reopenEntityIds.size) {
      entities = entities.map(entity =>
        reopenEntityIds.has(entity.id) ? { ...entity, status: 'draft' as const } : entity
      )
    }
    reopened.push(...impact.entities.map(item => item.id), ...impact.pageSets.map(item => item.id))
    reopened.push(...impact.pages.map(item => item.id))
    reopened.push(...extraConfirmed.map(item => item.id))
  }

  // 4) 一次写入 + 一个 ai 版本（不自动确认）
  const write = db.transaction(() => {
    writeEntities(appId, module.id, entities)
    writePageSets(appId, module.id, pageSets)
    appendVersion(appId, module.id, 'ai')
  })
  write()

  const savedSets = readPageSets(appId, module.id)
  const pageSet = savedSets.find(set => pageSetBelongsToEpic(set, node))
  const warnings = Array.from(new Set(entityValidation.warnings))
  const otherIds = new Set(other.models.map(entity => entity.id))
  for (const set of savedSets) {
    for (const page of set.pages) {
      if (page.entityId && otherIds.has(page.entityId)) {
        warnings.push(`跨模块依赖：页面「${page.title}」绑定了其它模块实体`)
      }
    }
  }
  return {
    project: getDesign(appId, module.id),
    warnings: Array.from(new Set(warnings)),
    epicId: node.id,
    entitiesAdded: merged.added,
    entitiesUpdated: merged.updated,
    pageSetId: pageSet?.id ?? '',
    pages: pageSet?.pages.length ?? 0,
    reopened
  }
}

/** 需求变更影响：按 requirementRefs / epicId / storyIds 找受影响实体/页面/页面集 */
function computeAffected(
  entities: DesignEntity[],
  pageSets: DesignPageSet[],
  changedIds: Set<string>
): DesignSyncAffected {
  return {
    entities: entities
      .filter(entity => entity.requirementRefs.some(ref => changedIds.has(ref)))
      .map(entity => ({ id: entity.id, name: entity.name, refs: [...entity.requirementRefs] })),
    pages: pageSets
      .flatMap(set => set.pages.map(page => ({ page, set })))
      .filter(({ page }) => page.requirementRefs.some(ref => changedIds.has(ref)))
      .map(({ page, set }) => ({ id: page.id, title: page.title, pageSetId: set.id, refs: [...page.requirementRefs] })),
    pageSets: pageSets
      .filter(
        set =>
          (set.epicId ? changedIds.has(set.epicId) : false) || set.storyIds.some(ref => changedIds.has(ref))
      )
      .map(set => ({ id: set.id, title: set.title, epicId: set.epicId, storyIds: [...set.storyIds] }))
  }
}

/** 需求变更同步（H4）：preview / additions / regenerate / defer，绝不静默覆盖 */
export function syncDesignInput(appId: string, rawMode: unknown, moduleId?: string): DesignInputSyncResult {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  const mode: DesignInputSyncMode =
    rawMode === 'additions' || rawMode === 'regenerate' || rawMode === 'defer' ? rawMode : 'preview'
  const project = getDesign(appId, module.id)
  ensureDesignProjectForModule(appId, module)
  const current = buildDesignInput(appId, module.id)
  const latest = persistDesignInput(appId, current, module.id)
  const bound = project.input
  const diff = bound ? diffDesignInputs(bound, latest) : diffDesignInputs(latest, latest)
  const changedIds = new Set<string>()
  for (const group of [diff.scenes, diff.epics, diff.stories]) {
    for (const item of [...group.added, ...group.removed, ...group.changed]) changedIds.add(item.id)
  }
  const affected = computeAffected(project.entities, project.pageSets, changedIds)
  const warnings = [
    ...(bound ? [] : ['设计项目还没有绑定需求输入，将直接绑定最新输入']),
    ...(diff.totals.added + diff.totals.removed + diff.totals.changed
      ? []
      : ['需求条目没有变化（仅正文/章节文本可能变化）'])
  ]

  if (mode === 'preview' || mode === 'defer') {
    if (mode === 'defer') {
      recordStageEvent(appId, 'design', 'input-sync-deferred', {
        moduleId: module.id,
        fromVersion: bound?.docVersion ?? null,
        toVersion: latest.docVersion
      })
    }
    return {
      mode,
      input: latest,
      diff,
      affected,
      stale: computeStale(bound, current, latest, current.bundleHash),
      warnings,
      project: getDesign(appId, module.id)
    }
  }

  // 绑定新输入：需求必须已确认（否则设计无法基于该文档继续）
  const payload = ensureRequirementDoc(appId, undefined, module.id)
  if (payload.doc.status !== 'confirmed') {
    throw new DesignError(409, '需求文档尚未确认，不能同步设计输入；请先确认需求')
  }

  const valid = validRefsOf(latest)
  const now = nowIso()
  if (mode === 'regenerate') {
    const affectedEntityIds = new Set(affected.entities.map(item => item.id))
    let entityChanged = false
    const entities = readEntities(appId, module.id).map(entity => {
      const refs = filterRefs(entity.requirementRefs, valid)
      const refsChanged = refs.length !== entity.requirementRefs.length
      const isAffected = affectedEntityIds.has(entity.id) || refsChanged
      if (isAffected) entityChanged = true
      return {
        ...entity,
        requirementRefs: refs,
        ...(isAffected ? { status: 'draft' as const } : {})
      }
    })
    if (entityChanged) writeEntities(appId, module.id, entities)

    const epicStories = new Map(latest.epics.map(epic => [epic.id, epic.stories.map(story => story.id)]))
    const affectedPageIds = new Set(affected.pages.map(item => item.id))
    const affectedPageSetIds = new Set(affected.pageSets.map(item => item.id))
    const pageSets = readPageSets(appId, module.id).map(set => {
      const epicId = set.epicId && valid.has(set.epicId) ? set.epicId : null
      const storyIds = epicId ? epicStories.get(epicId) ?? filterRefs(set.storyIds, valid) : filterRefs(set.storyIds, valid)
      const isAffected = affectedPageSetIds.has(set.id)
      const pages = set.pages.map(page => {
        const kept = filterRefs(page.requirementRefs, valid)
        const requirementRefs = kept.length ? kept : storyIds
        const pageAffected =
          affectedPageIds.has(page.id) || kept.length !== page.requirementRefs.length || isAffected
        return {
          ...page,
          requirementRefs,
          ...(pageAffected ? { status: 'draft' as const } : {})
        }
      })
      return { ...set, epicId, storyIds, pages, ...(isAffected ? { status: 'draft' as const } : {}) }
    })
    writePageSets(appId, module.id, pageSets)
    warnings.push('受影响实体/页面已重置为草稿；请复核或重新生成后再确认设计')
  }

  db.prepare(`
    UPDATE app_design_projects SET source_input_id = ?, source_input_hash = ?, source_doc_version = ?,
      status = 'draft', confirmed_at = NULL, updated_at = ? WHERE app_id = ? AND module_id = ?
  `).run(latest.id, latest.docHash, latest.docVersion, now, appId, module.id)
  appendVersion(appId, module.id, 'sync')
  recordStageEvent(appId, 'design', 'input-synced', {
    moduleId: module.id,
    mode,
    inputId: latest.id,
    docVersion: latest.docVersion,
    diff: diff.totals
  })

  return {
    mode,
    input: latest,
    diff,
    affected,
    stale: computeStale(latest, current, latest, current.bundleHash),
    warnings,
    project: getDesign(appId, module.id)
  }
}

export interface ConfirmDesignResult {
  project: DesignProjectPayload
  alreadyConfirmed: boolean
  /** 全部必选未归档模块设计已确认（应用级交接包门禁） */
  appConfirmed: boolean
  pendingModuleIds: string[]
  moduleId: string
  moduleKey: string
}

export function confirmDesign(appId: string, moduleId?: string): ConfirmDesignResult {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  const project = getDesign(appId, module.id)
  // stale 是硬阻塞：需求已变更时，即使设计项目被标记 confirmed 也不能再视为可交接
  if (project.stale.stale) {
    throw new DesignError(
      409,
      '需求文档已变更，请先同步设计输入后再确认设计',
      ['需求文档已变更，请先同步设计输入后再确认设计', ...project.readiness.issues.filter(issue => !/需求文档已变更/.test(issue))],
      project.readiness.warnings
    )
  }
  const after = (): ConfirmDesignResult => {
    const state = designModulesState(appId)
    return {
      project: getDesign(appId, module.id),
      alreadyConfirmed: false,
      appConfirmed: state.allModulesConfirmed,
      pendingModuleIds: state.pendingModuleIds,
      moduleId: module.id,
      moduleKey: module.module_key
    }
  }
  if (project.status === 'confirmed') {
    const state = designModulesState(appId)
    return {
      project,
      alreadyConfirmed: true,
      appConfirmed: state.allModulesConfirmed,
      pendingModuleIds: state.pendingModuleIds,
      moduleId: module.id,
      moduleKey: module.module_key
    }
  }
  const readiness = project.readiness
  if (!readiness.ok) throw new DesignError(400, '设计尚未满足确认条件', readiness.issues, readiness.warnings)
  const tx = db.transaction(() => {
    const row = projectRowOf(appId, module.id)
    if (!row) throw new DesignError(500, '设计项目不存在')
    const now = nowIso()
    // R2c：确认设计总是产 confirm 版本，保证 C1 base_design_version/取消恢复指向已确认快照
    const version = row.version + 1
    db.prepare(`
      UPDATE app_design_projects SET status = 'confirmed', confirmed_at = ?, version = ?, updated_at = ?
      WHERE app_id = ? AND module_id = ?
    `).run(now, version, now, appId, module.id)
    snapshotVersion(appId, module.id, 'confirm', version, readEntities(appId, module.id), readPageSets(appId, module.id))
    recordStageEvent(appId, 'design', 'design-confirmed', {
      moduleId: module.id,
      moduleKey: module.module_key,
      entities: readiness.entityCount,
      pageSets: readiness.pageSetCount,
      pages: readiness.pageCount,
      version,
      source: 'confirm'
    })
    // 变更单阶段推进：设计确认后保持/置为 design（C1 §4.2）；用确认后的版本号
    updateActiveChangeSet(appId, { status: 'design', designVersion: version })
  })
  tx()
  return after()
}

/** 重新编辑设计：把 confirmed 退回 draft；需用户二次确认后调用 */
export function reopenDesign(appId: string, moduleId?: string): DesignProjectPayload {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  const app = appOrThrow(appId)
  const project = getDesign(appId, module.id)
  if (project.status !== 'confirmed') return project
  if (app.status === 'development' || app.status === 'completed') {
    // C1 门禁：开发/完成阶段必须先发起变更（scope 不限，需求+设计/仅设计都可以）
    const active = activeChangeSetRow(appId)
    if (!active) {
      throw new DesignError(
        409,
        '应用已进入开发阶段；如需修改设计，请先在应用头部“发起变更”；纯代码修复请直接在开发会话进行'
      )
    }
  }
  const now = nowIso()
  db.prepare(
    'UPDATE app_design_projects SET status = ?, confirmed_at = NULL, updated_at = ? WHERE app_id = ? AND module_id = ?'
  ).run('draft', now, appId, module.id)
  recordStageEvent(appId, 'design', 'design-reopened', { moduleId: module.id, fromVersion: project.version })
  return getDesign(appId, module.id)
}

// ---- 图片快照 ----

function prototypeDir(appId: string): string {
  return path.join(appDirOf(appId), 'docs', 'design', 'prototypes')
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
}

export function savePageSnapshot(
  appId: string,
  pageId: string,
  input: { imageBase64?: unknown; html?: unknown },
  moduleId?: string
): { project: DesignProjectPayload; page: DesignPage; imageUrl: string } {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  ensureDesignProjectForModule(appId, module)
  assertDesignEditable(appId, module.id)
  const sets = readPageSets(appId, module.id)
  const owner = sets.find(set => set.pages.some(page => page.id === pageId))
  const page = owner?.pages.find(item => item.id === pageId)
  if (!owner || !page) throw new DesignError(404, `页面不存在：${pageId}`)
  const raw = asString(input.imageBase64)
  if (!raw) throw new DesignError(400, '缺少 imageBase64')
  const base64 = raw.replace(/^data:image\/png;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  if (!buffer.length) throw new DesignError(400, '图片内容为空')
  if (buffer.length > MAX_IMAGE_BYTES) throw new DesignError(413, '图片过大（超过 16MB）')
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new DesignError(400, '快照必须是 PNG 图片（PNG 签名不匹配）')
  }
  const dir = prototypeDir(appId)
  fs.mkdirSync(dir, { recursive: true })
  const filename = `${safeFileName(pageId)}-v${page.version}.png`
  const abs = path.join(dir, filename)
  fs.writeFileSync(abs, buffer)
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  let htmlPath: string | null = null
  const html = typeof input.html === 'string' ? input.html : ''
  if (html.trim()) {
    const htmlFile = filename.replace(/\.png$/, '.html')
    fs.writeFileSync(path.join(dir, htmlFile), html, 'utf8')
    htmlPath = path.join('docs', 'design', 'prototypes', htmlFile).replace(/\\/g, '/')
  }
  const imagePath = path.join('docs', 'design', 'prototypes', filename).replace(/\\/g, '/')
  db.prepare('UPDATE app_design_pages SET image_path = ?, html_path = ?, image_hash = ?, updated_at = ? WHERE id = ?').run(
    imagePath,
    htmlPath,
    hash,
    nowIso(),
    pageId
  )
  const project = getDesign(appId, module.id)
  const saved = project.pageSets.flatMap(set => set.pages).find(item => item.id === pageId)
  if (!saved) throw new DesignError(500, '页面快照保存失败')
  return { project, page: saved, imageUrl: `/api/apps/${encodeURIComponent(appId)}/design/pages/${encodeURIComponent(pageId)}/image?v=${hash.slice(0, 8)}` }
}

export function pageImageFile(appId: string, pageId: string, moduleId?: string): { abs: string; page: DesignPage } {
  const module = moduleOf(appId, moduleId)
  const sets = readPageSets(appId, module.id)
  const page = sets.flatMap(set => set.pages).find(item => item.id === pageId)
  if (!page) throw new DesignError(404, `页面不存在：${pageId}`)
  if (!page.imagePath) throw new DesignError(404, '该页面还没有原型图片')
  const abs = path.resolve(appDirOf(appId), page.imagePath)
  const root = path.resolve(appDirOf(appId))
  if (!abs.startsWith(root)) throw new DesignError(400, '图片路径越界')
  if (!fs.existsSync(abs)) throw new DesignError(404, '原型图片文件不存在，请重新截图')
  return { abs, page }
}

export function pageHtmlFile(appId: string, pageId: string, moduleId?: string): { abs: string; page: DesignPage } {
  const module = moduleOf(appId, moduleId)
  const sets = readPageSets(appId, module.id)
  const page = sets.flatMap(set => set.pages).find(item => item.id === pageId)
  if (!page) throw new DesignError(404, `页面不存在：${pageId}`)
  if (!page.htmlPath) throw new DesignError(404, '该页面还没有 HTML 快照')
  const abs = path.resolve(appDirOf(appId), page.htmlPath)
  const root = path.resolve(appDirOf(appId))
  if (!abs.startsWith(root)) throw new DesignError(400, 'HTML 路径越界')
  if (!fs.existsSync(abs)) throw new DesignError(404, 'HTML 文件不存在，请重新截图')
  return { abs, page }
}

// ---- 版本 ----

const VERSION_SELECT = `
  SELECT v.*, cs.seq AS change_set_seq, cs.title AS change_set_title
  FROM app_design_versions v
  LEFT JOIN app_change_sets cs ON cs.id = v.change_set_id AND cs.app_id = v.app_id
`

function versionMetaOf(row: VersionRow): DesignVersionMeta {
  const entities = parseJson<DesignEntity[]>(row.entities_json, [])
  const pageSets = parseJson<DesignPageSet[]>(row.page_sets_json, [])
  return {
    version: row.version,
    source: (row.source as DesignVersionSource) || 'manual',
    createdAt: row.created_at,
    entityCount: entities.length,
    pageSetCount: pageSets.length,
    changeSetId: row.change_set_id ?? null,
    changeSetSeq: row.change_set_seq ?? null,
    changeSetTitle: row.change_set_title ?? null
  }
}

export function listDesignVersions(appId: string, moduleId?: string): DesignVersionMeta[] {
  const module = moduleOf(appId, moduleId)
  ensureDesignProjectForModule(appId, module)
  const rows = db
    .prepare(`${VERSION_SELECT} WHERE v.app_id = ? AND v.module_id = ? ORDER BY v.version DESC`)
    .all(appId, module.id) as VersionRow[]
  return rows.map(versionMetaOf)
}

/**
 * 手动“保存版本”（R2c）：draft 时把当前实体/页面集快照为 manual 版本（+1）。
 * confirmed 时 409：确认版本已存在，需先重新编辑设计。
 */
export function createDesignVersion(appId: string, moduleId?: string): DesignProjectPayload {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  ensureDesignProjectForModule(appId, module)
  const row = projectRowOf(appId, module.id)
  if (!row) throw new DesignError(500, '设计项目不存在')
  if (row.status === 'confirmed') {
    throw new DesignError(409, '设计已确认；确认版本已存在，如需新版本请先重新编辑设计')
  }
  const version = row.version + 1
  const now = nowIso()
  // 手动留档不改状态/确认时间，只递增版本并写快照
  db.prepare('UPDATE app_design_projects SET version = ?, updated_at = ? WHERE app_id = ? AND module_id = ?').run(
    version,
    now,
    appId,
    module.id
  )
  snapshotVersion(appId, module.id, 'manual', version, readEntities(appId, module.id), readPageSets(appId, module.id))
  recordStageEvent(appId, 'design', 'design-version-saved', { moduleId: module.id, version, source: 'manual' })
  return getDesign(appId, module.id)
}

export function getDesignVersion(appId: string, version: unknown, moduleId?: string): DesignVersionDetail {
  const module = moduleOf(appId, moduleId)
  ensureDesignProjectForModule(appId, module)
  const value = Number(version)
  if (!Number.isInteger(value) || value < 1) throw new DesignError(400, '版本号不合法')
  const row = db
    .prepare(`${VERSION_SELECT} WHERE v.app_id = ? AND v.module_id = ? AND v.version = ?`)
    .get(appId, module.id, value) as VersionRow | undefined
  if (!row) throw new DesignError(404, `版本不存在：v${value}`)
  const entities = parseJson<DesignEntity[]>(row.entities_json, []).map(entity => ({
    ...entity,
    requirementRefs: entity.requirementRefs ?? [],
    sourceSections: entity.sourceSections ?? []
  }))
  const pageSets = parseJson<DesignPageSet[]>(row.page_sets_json, []).map(set => ({
    ...set,
    epicId: set.epicId ?? null,
    storyIds: set.storyIds ?? [],
    pages: (set.pages ?? []).map(page => ({ ...page, requirementRefs: page.requirementRefs ?? [] }))
  }))
  return {
    ...versionMetaOf(row),
    entityCount: entities.length,
    pageSetCount: pageSets.length,
    entities,
    pageSets
  }
}

export function rollbackDesignVersion(appId: string, version: unknown, moduleId?: string): DesignProjectPayload {
  const module = writableModuleOf(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  ensureDesignProjectForModule(appId, module)
  assertDesignEditable(appId, module.id)
  const detail = getDesignVersion(appId, version, module.id)
  // 实体 + 页面集 + 版本快照原子恢复：任何一步失败都不留下半套设计
  const restore = db.transaction(() => {
    writeEntities(appId, module.id, detail.entities)
    const entities = readEntities(appId, module.id)
    writePageSets(
      appId,
      module.id,
      normalizePageSets(detail.pageSets, readPageSets(appId, module.id), entities, appEntityIds(appId))
    )
    appendVersion(appId, module.id, 'rollback')
  })
  restore()
  return getDesign(appId, module.id)
}

/**
 * 取消变更：把设计恢复为基线版本并保持 confirmed（内部方法，C1 §4.3）。
 *
 * 与 rollbackDesignVersion 的区别：后者受“已确认只读”守卫限制并回到 draft；
 * 这里按取消语义恢复实体/页面集、保持已确认，并追加一个新版本（不物理删除变更中的版本）。
 */
export function restoreDesignVersionConfirmed(appId: string, version: unknown, moduleId?: string): DesignProjectPayload {
  appOrThrow(appId)
  const module = moduleOf(appId, moduleId)
  ensureDesignProjectForModule(appId, module)
  const detail = getDesignVersion(appId, version, module.id)
  if (!detail.entities.length && !detail.pageSets.length) {
    throw new DesignError(409, `基线设计版本 v${String(version)} 没有实体/页面快照，无法取消变更`)
  }
  const now = nowIso()
  // 实体 + 页面集 + 版本 + 应用状态原子恢复
  const restore = db.transaction(() => {
    writeEntities(
      appId,
      module.id,
      detail.entities.map(entity => ({ ...entity, status: 'confirmed' as const }))
    )
    const entities = readEntities(appId, module.id)
    const restoredSets = detail.pageSets.map(set => ({
      ...set,
      status: 'confirmed' as const,
      pages: (set.pages ?? []).map(page => ({ ...page, status: 'confirmed' as const }))
    }))
    writePageSets(
      appId,
      module.id,
      normalizePageSets(restoredSets, readPageSets(appId, module.id), entities, appEntityIds(appId))
    )
    const row = projectRowOf(appId, module.id)
    if (!row) throw new DesignError(500, '设计项目不存在')
    const nextVersion = row.version + 1
    db.prepare(`
      UPDATE app_design_projects SET version = ?, status = 'confirmed', confirmed_at = ?, updated_at = ?
      WHERE app_id = ? AND module_id = ?
    `).run(nextVersion, now, now, appId, module.id)
    snapshotVersion(appId, module.id, 'restore', nextVersion, readEntities(appId, module.id), readPageSets(appId, module.id))
    db.prepare('UPDATE apps SET design_confirmed_at = COALESCE(design_confirmed_at, ?), updated_at = ? WHERE id = ?').run(
      now,
      now,
      appId
    )
    recordStageEvent(appId, 'design', 'design-restored', {
      moduleId: module.id,
      reason: 'change-set-cancelled',
      baseVersion: detail.version,
      version: nextVersion
    })
  })
  restore()
  return getDesign(appId, module.id)
}

/** 删除应用时清理全部模块设计数据（不按模块过滤） */
export function deleteDesignData(appId: string): void {
  db.prepare('DELETE FROM app_design_pages WHERE app_id = ?').run(appId)
  db.prepare('DELETE FROM app_design_page_sets WHERE app_id = ?').run(appId)
  db.prepare('DELETE FROM app_design_entities WHERE app_id = ?').run(appId)
  db.prepare('DELETE FROM app_design_versions WHERE app_id = ?').run(appId)
  db.prepare('DELETE FROM app_design_inputs WHERE app_id = ?').run(appId)
  db.prepare('DELETE FROM app_design_projects WHERE app_id = ?').run(appId)
  db.prepare('DELETE FROM app_settings WHERE key = ? OR key LIKE ?').run(
    `app.${appId}.designChat`,
    `app.${appId}.designChat.%`
  )
}

// ---- 设计聊天持久化（M4：按模块；旧应用级 key 只读回退，不删除/不覆盖） ----

function designChatSettingKey(appId: string, moduleId: string): string {
  return `app.${appId}.designChat.${moduleId}`
}

function legacyDesignChatKey(appId: string): string {
  return `app.${appId}.designChat`
}

/**
 * 读取模块设计对话（含回退标记）：
 * - 明确 moduleId → 必须存在（未知 404，归档可读）；
 * - 缺省 → 默认模块；模块 key 无数据时只读回退旧应用级 key（迁移前历史）；
 * - 应用还没有任何模块 → 直接返回旧 key（不建模块）。
 */
export function readDesignChatWithMeta(
  appId: string,
  moduleId?: string
): { chat: unknown; legacyFallback: boolean; moduleId: string | null } {
  const requested = typeof moduleId === 'string' ? moduleId.trim() : ''
  if (requested) {
    const module = moduleOrThrow(appId, requested)
    return {
      chat: readSetting<unknown>(designChatSettingKey(appId, module.id)) ?? { messages: [] },
      legacyFallback: false,
      moduleId: module.id
    }
  }
  const module = defaultModule(appId)
  if (!module) {
    const legacy = readSetting<unknown>(legacyDesignChatKey(appId))
    return { chat: legacy ?? { messages: [] }, legacyFallback: legacy !== null, moduleId: null }
  }
  const scoped = readSetting<unknown>(designChatSettingKey(appId, module.id))
  if (scoped !== null) return { chat: scoped, legacyFallback: false, moduleId: module.id }
  const legacy = readSetting<unknown>(legacyDesignChatKey(appId))
  return { chat: legacy ?? { messages: [] }, legacyFallback: legacy !== null, moduleId: module.id }
}

/** 读取模块设计对话内容（getDesign payload / 兼容旧调用） */
export function readDesignChat(appId: string, moduleId?: string): unknown {
  return readDesignChatWithMeta(appId, moduleId).chat
}

/** 写入模块设计对话（只写模块 key；未知模块 404、归档 409；旧 key 不动） */
export function saveDesignChat(appId: string, value: unknown, moduleId?: string): { moduleId: string } {
  const module = writableModuleOf(appId, moduleId)
  writeSetting(designChatSettingKey(appId, module.id), value ?? { messages: [] })
  return { moduleId: module.id }
}

