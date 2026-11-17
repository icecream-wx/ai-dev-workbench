/**
 * 设计 → 开发交接包服务（D5）
 *
 * 流程：设计确认（app_design_projects.status=confirmed）
 *   → 校验需求输入/实体/页面/PNG/引用
 *   → 创建或复用 Change Set（首次为 #1“初始开发”）
 *   → 确定性渲染 00—05 + schema + template + manifest + prototypes/
 *   → 写 docs/handoff/、记录 design_handoffs 版本/hash
 *   → 应用切到 development，记录阶段事件
 *
 * 边界：本轮只支持首次交接与同一变更单内重新生成；完整变更循环（C1）未实现。
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { db, nowIso } from '../db'
import { appDirOf } from '../apps/scaffold'
import { appEntityIds, designStateHash, getDesign } from '../design/service'
import type { DesignProjectPayload } from '../design/types'
import { readDesignInput, validRefsOf } from '../design/input'
import { defaultModule, latestRequirementBundle, listModules } from '../requirements/modules'
import { sha256Hex } from '../requirements/module-migration'
import {
  activeChangeSetRow,
  changeSetModuleRows,
  changeSetModulesView,
  changeSetRowById,
  insertChangeSetModule,
  isClosedChangeSet,
  latestChangeSetRow,
  markChangeSetGenerated,
  nextChangeSetSeq,
  type ChangeSetRow
} from '../changesets/query'
import {
  buildDesignHandoffBundle,
  changeSetView,
  mergeChangeReports,
  moduleSummariesOf,
  prototypeTemplateHash
} from './design-bundle'
import { buildDesignChangeReport, type DesignChangeReport } from './design-changes'
import { assessHandoffScale, type DesignHandoffPhaseDraft } from './design-scale'
import {
  FILE_CHANGES,
  FILE_MANIFEST,
  renderDesignHandoffText,
  renderManifest
} from './design-render'
import type {
  DesignHandoffBundle,
  DesignHandoffChangeSet,
  DesignHandoffFileContent,
  DesignHandoffFileKind,
  DesignHandoffFileMeta,
  DesignHandoffMeta,
  DesignHandoffModuleChangeState,
  DesignHandoffModuleSummary,
  DesignHandoffReadResult,
  DesignHandoffScale,
  DesignHandoffTextFile,
  DesignHandoffValidation
} from './design-types'

const HANDOFF_DIR = path.join('docs', 'handoff')
const FILE_NAME = /^[A-Za-z0-9._/-]+$/
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

interface HandoffAppRow {
  id: string
  name: string
  description: string | null
  backend_port: number
  status: string
  design_confirmed_at: string | null
  development_started_at: string | null
  completed_at: string | null
  current_change_set_id: string | null
}

interface HandoffRow {
  id: number
  app_id: string
  version: number
  hash: string
  docs_dir: string
  files_json: string
  change_set_id: string | null
  baseline_handoff_version: number | null
  source_design_json: string
  source_requirements_json: string
  manifest_json: string
  created_at: string
}

interface PrototypeSource {
  pageId: string
  name: string
  sourcePng: string
  htmlName: string | null
  sourceHtml: string | null
}

export class DesignHandoffError extends Error {
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

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function sha256Buffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function sha256Text(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function appRow(appId: string): HandoffAppRow {
  const row = db
    .prepare(
      `SELECT id, name, description, backend_port, status, design_confirmed_at,
              development_started_at, completed_at, current_change_set_id
       FROM apps WHERE id = ?`
    )
    .get(appId) as HandoffAppRow | undefined
  if (!row) throw new DesignHandoffError(404, `应用不存在：${appId}`)
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

function appDirSafeJoin(appId: string, relative: string): string {
  const root = path.resolve(appDirOf(appId))
  const abs = path.resolve(root, relative)
  if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) {
    throw new DesignHandoffError(400, `路径越界：${relative}`)
  }
  return abs
}

// ---- Change Set ----

function latestHandoffRow(appId: string): HandoffRow | undefined {
  return db
    .prepare('SELECT * FROM design_handoffs WHERE app_id = ? ORDER BY version DESC LIMIT 1')
    .get(appId) as HandoffRow | undefined
}

function handoffRowByVersion(appId: string, version: number): HandoffRow | undefined {
  return db
    .prepare('SELECT * FROM design_handoffs WHERE app_id = ? AND version = ?')
    .get(appId, version) as HandoffRow | undefined
}

/**
 * Change Set 绑定：优先使用进行中的变更单；否则仅在“没有任何交接包”时创建 #1（初始开发）。
 * 已完成/已取消的变更单一律不复用（C1 修复）。
 */
interface ChangeSetBinding {
  view: DesignHandoffChangeSet
  baseInputId: string | null
  baseHandoffVersion: number | null
  baseRequirementsVersion: number | null
  baseDesignVersion: number | null
}

const NO_ACTIVE_CHANGE_SET_MESSAGE =
  '如需修改需求/设计，请先在应用头部“发起变更”；纯代码修复请直接在开发会话进行'

function bindingOfRow(row: ChangeSetRow): ChangeSetBinding {
  return {
    view: { ...changeSetView(row), modules: changeSetModulesView(row.id) },
    baseInputId: row.base_input_id,
    baseHandoffVersion: row.base_handoff_version,
    baseRequirementsVersion: row.base_requirements_version,
    baseDesignVersion: row.base_design_version
  }
}

function bindingOfView(view: DesignHandoffChangeSet): ChangeSetBinding {
  return {
    view,
    baseInputId: null,
    baseHandoffVersion: view.baselineHandoffVersion,
    baseRequirementsVersion: null,
    baseDesignVersion: null
  }
}

/** #1 首次基线的模块快照（写入 app_change_set_modules；base 全部 null） */
interface HandoffChangeSetModuleSnapshot {
  moduleId: string
  moduleKey: string
  title: string
  reqCurrentVersion: number | null
  reqCurrentHash: string | null
  designCurrentVersion: number | null
  designCurrentHash: string | null
  designTemplateId: string | null
}

function changeSetModuleSnapshots(sources: HandoffModuleSource[]): HandoffChangeSetModuleSnapshot[] {
  return sources
    .filter((source): source is HandoffModuleSource & { project: DesignProjectPayload } => Boolean(source.project))
    .map(source => ({
      moduleId: source.module.id,
      moduleKey: source.module.key,
      title: source.module.title,
      reqCurrentVersion: source.project.requirement?.version ?? null,
      reqCurrentHash: source.project.requirement ? sha256Hex(source.project.requirement.contentMd) : null,
      designCurrentVersion: source.project.version,
      designCurrentHash: designStateHash(source.project.entities, source.project.pageSets),
      designTemplateId: source.project.template.id
    }))
}

/** 首次生成交接包时创建 Change Set #1（title=初始开发）；预览不写库，用临时视图。 */
function ensureChangeSet(
  appId: string,
  snapshots: HandoffChangeSetModuleSnapshot[],
  persist: boolean
): ChangeSetBinding {
  const existing = latestChangeSetRow(appId)
  if (existing) {
    if (isClosedChangeSet(existing.status)) {
      // 历史单已完成/取消：不自动新建，也不复用（生成需由“发起变更”创建新单）
      throw new DesignHandoffError(409, NO_ACTIVE_CHANGE_SET_MESSAGE)
    }
    return bindingOfRow(existing)
  }
  const now = nowIso()
  const requirementsVersion =
    snapshots.reduce<number | null>(
      (max, snapshot) =>
        snapshot.reqCurrentVersion === null ? max : Math.max(max ?? 0, snapshot.reqCurrentVersion),
      null
    ) ?? null
  const designVersion =
    snapshots.reduce<number | null>(
      (max, snapshot) =>
        snapshot.designCurrentVersion === null ? max : Math.max(max ?? 0, snapshot.designCurrentVersion),
      null
    ) ?? null
  const row: ChangeSetRow = {
    id: newId('cs'),
    app_id: appId,
    seq: nextChangeSetSeq(appId),
    title: '初始开发',
    description: '首次开发（无基线差异）',
    scope: 'requirements',
    status: 'design',
    base_requirements_version: null,
    base_design_version: null,
    base_handoff_version: null,
    base_input_id: null,
    base_app_status: null,
    base_completed_at: null,
    base_change_set_id: null,
    base_session_id: null,
    current_requirements_version: requirementsVersion,
    current_design_version: designVersion,
    current_handoff_version: null,
    changes_md: null,
    summary_json: null,
    created_at: now,
    updated_at: now,
    completed_at: null
  }
  // M6a MF1：模块行（#1 首次基线 base=null；current 必须记录）
  const insertModules = (): void => {
    for (const snapshot of snapshots) {
      insertChangeSetModule(row.id, snapshot.moduleId, {
        reqBaseVersion: null,
        reqBaseHash: null,
        reqCurrentVersion: snapshot.reqCurrentVersion,
        reqCurrentHash: snapshot.reqCurrentHash,
        designBaseVersion: null,
        designBaseHash: null,
        designBaseTemplateId: null,
        designCurrentVersion: snapshot.designCurrentVersion,
        designCurrentHash: snapshot.designCurrentHash
      })
    }
  }
  if (!persist) {
    // 预览不写库：合成带模块行的临时视图（与落库后结构一致）
    return bindingOfView({
      ...changeSetView(row),
      modules: snapshots.map(snapshot => ({
        moduleId: snapshot.moduleId,
        moduleKey: snapshot.moduleKey,
        title: snapshot.title,
        reqBaseVersion: null,
        reqBaseHash: null,
        reqCurrentVersion: snapshot.reqCurrentVersion,
        reqCurrentHash: snapshot.reqCurrentHash,
        designBaseVersion: null,
        designBaseHash: null,
        designCurrentVersion: snapshot.designCurrentVersion,
        designCurrentHash: snapshot.designCurrentHash,
        templateId: null
      }))
    })
  }
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO app_change_sets
        (id, app_id, seq, title, description, scope, status,
         base_requirements_version, base_design_version, base_handoff_version, base_input_id,
         current_requirements_version, current_design_version, current_handoff_version,
         created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
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
      row.current_requirements_version,
      row.current_design_version,
      row.current_handoff_version,
      row.created_at,
      row.updated_at
    )
    db.prepare('UPDATE apps SET current_change_set_id = ?, updated_at = ? WHERE id = ?').run(row.id, now, appId)
    insertModules()
  })
  tx()
  const saved = changeSetRowById(appId, row.id)
  if (!saved) throw new DesignHandoffError(500, '变更单创建失败')
  return bindingOfRow(saved)
}

/**
 * 解析本次交接包应绑定的变更单：
 * - 有 active 变更单 → 绑定该单；
 * - 无 active 且没有任何交接包 → 首次 #1（写/合成模块行）；
 * - 无 active 但已有交接包 → 仅允许预览（生成 409）。
 */
function resolveChangeSet(
  app: HandoffAppRow,
  snapshots: HandoffChangeSetModuleSnapshot[],
  previous: HandoffRow | undefined,
  mode: 'preview' | 'generate'
): { binding: ChangeSetBinding; allowGenerate: boolean; warnings: string[] } {
  const active = activeChangeSetRow(app.id)
  if (active) return { binding: bindingOfRow(active), allowGenerate: true, warnings: [] }
  if (!previous) {
    const binding = ensureChangeSet(app.id, snapshots, mode === 'generate')
    return { binding, allowGenerate: true, warnings: [] }
  }
  const latest = latestChangeSetRow(app.id)
  const binding = latest ? bindingOfRow(latest) : ensureChangeSet(app.id, snapshots, false)
  return {
    binding,
    allowGenerate: false,
    warnings: [`当前没有进行中的变更单：${NO_ACTIVE_CHANGE_SET_MESSAGE}`]
  }
}

/** 开发完成时关闭当前 active 变更单（只关一单，不再批量关闭；C1 修复） */
export function completeActiveChangeSet(appId: string): void {
  const active = activeChangeSetRow(appId)
  if (!active) return
  const now = nowIso()
  db.prepare(`
    UPDATE app_change_sets SET status = 'completed', completed_at = ?, updated_at = ?
    WHERE app_id = ? AND id = ?
  `).run(now, now, appId, active.id)
}

// ---- 模块装载（M6） ----

export interface HandoffModuleSource {
  module: { id: string; key: string; title: string; position: number; required: boolean }
  /** 缺少设计项目时为 null（校验给 issue，不创建项目） */
  project: DesignProjectPayload | null
  missingProject: boolean
}

/**
 * 按未归档模块顺序装载交接包所需数据（M6）。
 * 只读：设计项目不存在时**不创建**（校验阶段给出 issue）；归档模块不参与。
 * `getDesign` 会确保已有项目可读（可能补绑设计输入，沿用既有行为）。
 */
export function loadHandoffModules(appId: string): HandoffModuleSource[] {
  appRow(appId)
  return listModules(appId, false).map(row => {
    const projectRow = db
      .prepare('SELECT 1 AS found FROM app_design_projects WHERE app_id = ? AND module_id = ?')
      .get(appId, row.id)
    const exists = Boolean(projectRow)
    return {
      module: {
        id: row.id,
        key: row.moduleKey,
        title: row.title,
        position: row.position,
        required: row.required
      },
      project: exists ? getDesign(appId, row.id) : null,
      missingProject: !exists
    }
  })
}

function normalizeHandoffSources(
  input: DesignProjectPayload | HandoffModuleSource[]
): HandoffModuleSource[] {
  if (Array.isArray(input)) return input
  return [
    {
      module: {
        id: input.module.id,
        key: input.module.key,
        title: input.module.title,
        position: 0,
        required: true
      },
      project: input,
      missingProject: false
    }
  ]
}

function unknownRefIssues(project: DesignProjectPayload): string[] {
  const input = project.input
  if (!input) return ['设计项目还没有绑定需求输入，请重新同步需求后再生成交接包']
  const refs = validRefsOf(input)
  const issues: string[] = []
  for (const entity of project.entities) {
    for (const ref of entity.requirementRefs) {
      if (!refs.has(ref)) issues.push(`实体「${entity.name}」引用了不存在的需求条目：${ref}`)
    }
  }
  for (const set of project.pageSets) {
    if (set.epicId && !refs.has(set.epicId)) issues.push(`页面集「${set.title}」引用了不存在的 Epic：${set.epicId}`)
    for (const storyId of set.storyIds) {
      if (!refs.has(storyId)) issues.push(`页面集「${set.title}」引用了不存在的 Story：${storyId}`)
    }
    for (const page of set.pages) {
      for (const ref of page.requirementRefs) {
        if (!refs.has(ref)) issues.push(`页面「${page.title}」引用了不存在的需求条目：${ref}`)
      }
    }
  }
  return issues
}

/**
 * 交接包校验（M6：按模块）：
 * - 全部必选未归档模块：需求确认、设计确认、设计输入绑定、非 stale、readiness、引用完整、页面 PNG 齐全；
 * - 跨模块 FK / 表名重复 / 原型模板不一致只 warning，不阻塞；
 * - 无模块 → issue；多模块时消息前缀 `[MOD-xxx 标题]`（单模块保持旧文案）。
 * 失败不写盘、不切换阶段。
 */
export function validateDesignHandoff(
  appId: string,
  input: DesignProjectPayload | HandoffModuleSource[]
): DesignHandoffValidation {
  const issues: string[] = []
  const warnings: string[] = []
  const seen = new Set<string>()
  const pushIssue = (message: string): void => {
    if (seen.has(`i:${message}`)) return
    seen.add(`i:${message}`)
    issues.push(message)
  }
  const pushWarning = (message: string): void => {
    if (seen.has(`w:${message}`)) return
    seen.add(`w:${message}`)
    warnings.push(message)
  }

  const sources = normalizeHandoffSources(input)
  appRow(appId)
  if (!sources.length) pushIssue('应用没有未归档模块，无法生成交接包')

  const multi = sources.length > 1
  const globalEntityIds = appEntityIds(appId)
  const entityOwnerModule = new Map<string, string>()
  for (const source of sources) {
    if (!source.project) continue
    for (const entity of source.project.entities) entityOwnerModule.set(entity.id, source.module.id)
  }
  const moduleLabels = new Map(sources.map(source => [source.module.id, `${source.module.key} ${source.module.title}`]))
  const tableOwners = new Map<string, string>()
  const templates = new Map<string, string>()
  let htmlCount = 0

  for (const source of sources) {
    const label = multi ? `[${source.module.key} ${source.module.title}] ` : ''
    if (!source.project) {
      pushIssue(`${label}设计项目不存在，请先在设计 Studio 打开该模块并保存设计`)
      continue
    }
    const project = source.project
    if (!project.requirement) pushIssue(`${label}需求文档不存在，无法生成交接包`)
    else if (!project.requirement.confirmed) pushIssue(`${label}需求文档尚未确认，无法生成交接包`)
    if (!project.input) pushIssue(`${label}设计输入未绑定，无法生成交接包`)
    if (project.stale.stale) pushIssue(`${label}需求文档已变更，请先同步设计输入后再生成交接包`)
    if (project.status !== 'confirmed') pushIssue(`${label}设计尚未确认，请先完成设计确认`)

    for (const issue of project.readiness.issues) {
      // stale 已单独提示，避免重复
      if (/需求文档已变更/.test(issue) && project.stale.stale) continue
      pushIssue(`${label}${issue}`)
    }

    // 引用完整性（阻塞）
    for (const issue of unknownRefIssues(project)) pushIssue(`${label}${issue}`)

    // 页面绑定实体（允许跨模块实体，全应用 ID 有效；跨模块只提示）
    const moduleEntityIds = new Set(project.entities.map(entity => entity.id))
    for (const set of project.pageSets) {
      for (const page of set.pages) {
        if (!page.entityId) continue
        if (!globalEntityIds.has(page.entityId)) {
          pushIssue(`${label}页面「${page.title}」绑定的实体不存在`)
        } else if (!moduleEntityIds.has(page.entityId)) {
          pushWarning(`${label}跨模块依赖：页面「${page.title}」绑定了其它模块实体`)
        }
      }
    }

    // 实体关系（跨模块只提示；目标不存在提示）
    for (const entity of project.entities) {
      for (const relation of entity.relations) {
        const owner = entityOwnerModule.get(relation.target)
        if (!owner) {
          pushWarning(`${label}实体「${entity.name}」的关系目标不存在，已忽略（${relation.name}）`)
        } else if (owner !== source.module.id) {
          pushWarning(
            `${label}跨模块依赖：实体「${entity.name}」的关系目标在模块「${moduleLabels.get(owner) ?? owner}」`
          )
        }
      }
      const table = entity.tableName.trim()
      if (!table) continue
      const owner = tableOwners.get(table)
      if (owner && owner !== source.module.id) {
        pushWarning(
          `${label}表名「${table}」与模块「${moduleLabels.get(owner) ?? owner}」重复（需人工确认是否共享表）`
        )
      } else {
        tableOwners.set(table, source.module.id)
      }
    }

    // 每个页面必须有 PNG 原型图（阻塞）
    for (const set of project.pageSets) {
      for (const page of set.pages) {
        if (!page.imagePath) {
          pushIssue(`${label}页面「${page.title}」缺少原型 PNG 截图（请先在设计 Studio 中截图存档）`)
          continue
        }
        let buffer: Buffer
        try {
          buffer = fs.readFileSync(appDirSafeJoin(appId, page.imagePath))
        } catch {
          pushIssue(`${label}页面「${page.title}」的原型 PNG 文件不存在（${page.imagePath}），请重新截图`)
          continue
        }
        if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
          pushIssue(`${label}页面「${page.title}」的原型文件不是有效 PNG`)
        }
        if (page.htmlPath) {
          try {
            fs.accessSync(appDirSafeJoin(appId, page.htmlPath))
            htmlCount += 1
          } catch {
            pushWarning(`${label}页面「${page.title}」的 HTML 快照文件不存在，已忽略`)
          }
        }
      }
    }

    // 提示项（按模块）
    for (const warning of project.warnings) pushWarning(`${label}${warning}`)
    for (const warning of project.coverage.warnings) pushWarning(`${label}${warning}`)
    for (const warning of project.readiness.warnings) pushWarning(`${label}${warning}`)
    if (project.input?.structure === 'fallback') {
      pushWarning(`${label}需求文档不是标准 PRD 结构，交接包中的 Epic/Story 来自回退解析，建议人工复核`)
    }
    const questions = project.input?.openQuestions ?? []
    if (questions.length) {
      pushWarning(
        `${label}需求文档还有 ${questions.length} 个开放问题（${questions
          .slice(0, 3)
          .map(item => item.id)
          .join('、')}${questions.length > 3 ? '…' : ''}），开发前请确认`
      )
    }
    if (!project.pageSets.some(set => set.pages.some(page => page.type === 'list'))) {
      pushWarning(`${label}没有列表页：确认是否只需要表单/详情页面`)
    }
    templates.set(project.template.id, project.template.name)
  }

  if (templates.size > 1) {
    pushWarning(
      `多模块原型模板不一致：${Array.from(templates, ([id, name]) => `${name}（${id}）`).join('、')}；交接包 prototype-template.json 使用默认/第一个模块模板，其余模块仅提示`
    )
  }
  if (htmlCount > 0) {
    pushWarning('prototypes/ 中同时包含 HTML 快照：仅作参考，不是可独立运行页面；以页面规格为准')
  }
  pushWarning('未包含独立测试用例：测试/验收以 Story 验收标准与页面验收为准')

  return { issues, warnings }
}

// ---- 渲染 ----

function prototypeSources(appId: string, bundle: DesignHandoffBundle): PrototypeSource[] {
  const sources: PrototypeSource[] = []
  for (const module of bundle.modules) {
    for (const set of module.pageSets) {
      for (const page of set.pages) {
        if (!page.imagePath || !page.prototypePath) continue
        const htmlName = page.htmlPath ? page.prototypeHtmlPath ?? null : null
        sources.push({
          pageId: page.id,
          name: page.prototypePath,
          sourcePng: appDirSafeJoin(appId, page.imagePath),
          htmlName,
          sourceHtml: htmlName && page.htmlPath ? appDirSafeJoin(appId, page.htmlPath) : null
        })
      }
    }
  }
  return sources
}

interface RenderedHandoff {
  texts: DesignHandoffTextFile[]
  prototypes: PrototypeSource[]
  metas: DesignHandoffFileMeta[]
  hash: string
  manifest: Record<string, unknown>
  scale: DesignHandoffScale
  /** U7-1：建议分阶段草案（normal 时为空数组）；同时写进 `manifest.phases` */
  phases: DesignHandoffPhaseDraft[]
}

function renderHandoff(appId: string, bundle: DesignHandoffBundle): RenderedHandoff {
  // 两遍渲染：先用“建议章节渲染前”的文本测量字节数，再按规模决定是否插入建议章节（避免循环）。
  const measure = renderDesignHandoffText(bundle)
  const textBytes = measure.reduce((sum, file) => sum + Buffer.byteLength(file.content, 'utf8'), 0)
  const { scale, phases } = assessHandoffScale(bundle, textBytes)
  const texts = scale.suggested ? renderDesignHandoffText(bundle, scale, phases) : measure
  const prototypes = prototypeSources(appId, bundle)
  const metas: DesignHandoffFileMeta[] = []
  for (const file of texts) {
    metas.push({ name: file.name, size: Buffer.byteLength(file.content, 'utf8'), hash: sha256Text(file.content), kind: 'text' })
  }
  for (const prototype of prototypes) {
    const buffer = fs.readFileSync(prototype.sourcePng)
    metas.push({
      name: prototype.name,
      size: buffer.length,
      hash: sha256Buffer(buffer),
      kind: 'image',
      sourcePageId: prototype.pageId
    })
    if (prototype.htmlName && prototype.sourceHtml) {
      let html: string | null = null
      try {
        html = fs.readFileSync(prototype.sourceHtml, 'utf8')
      } catch {
        html = null
      }
      if (html !== null) {
        metas.push({ name: prototype.htmlName, size: Buffer.byteLength(html, 'utf8'), hash: sha256Text(html), kind: 'html' })
      }
    }
  }
  metas.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const manifestText = renderManifest(bundle, metas, scale, phases)
  const manifestMeta: DesignHandoffFileMeta = {
    name: FILE_MANIFEST,
    size: Buffer.byteLength(manifestText, 'utf8'),
    hash: sha256Text(manifestText),
    kind: 'text'
  }
  const allMetas = [...metas, manifestMeta].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const hash = createHash('sha256')
  for (const meta of allMetas) {
    hash.update(meta.name)
    hash.update('\u0000')
    hash.update(meta.hash)
    hash.update('\u0000')
  }
  return {
    texts: [...texts, { name: FILE_MANIFEST, content: manifestText }],
    prototypes,
    metas: allMetas,
    hash: hash.digest('hex'),
    manifest: parseJson<Record<string, unknown>>(manifestText, {}),
    scale,
    phases
  }
}

interface BaselineSnapshot {
  requirements: DesignInputBundleLike | null
  docVersion: number | null
  docHash: string | null
  designVersion: number | null
  templateHash: string | null
  entities: EntityLike[]
  pageSets: PageSetLike[]
}

type DesignInputBundleLike = NonNullable<DesignProjectPayload['input']>
type EntityLike = DesignProjectPayload['entities'][number]
type PageSetLike = DesignProjectPayload['pageSets'][number]

interface BaselineDesignModule {
  moduleId?: string
  moduleKey?: string
  designVersion?: number | null
  templateId?: string | null
  templateHash?: string | null
  entities: EntityLike[]
  pageSets: PageSetLike[]
}

interface BaselineRequirementModule {
  moduleId?: string
  moduleKey?: string
  title?: string
  docVersion?: number | null
  docHash?: string | null
  inputId?: string | null
}

interface BaselineSource {
  design: BaselineDesignModule[]
  requirements: BaselineRequirementModule[]
  manifestTemplateHash: string | null
}

interface ModuleBaseline {
  exists: boolean
  requirements: DesignInputBundleLike | null
  docVersion: number | null
  docHash: string | null
  designVersion: number | null
  templateHash: string | null
  entities: EntityLike[]
  pageSets: PageSetLike[]
}

/**
 * 变更基线（M6）：上一版交接包的模块快照。
 * 兼容旧单模块包（`{entities,pageSets}` / `{docVersion,docHash}`）→ 视为默认模块。
 */
function loadChangeBaseline(appId: string, binding: ChangeSetBinding): BaselineSource {
  const baseHandoff = binding.baseHandoffVersion ? handoffRowByVersion(appId, binding.baseHandoffVersion) : undefined
  const designJson = parseJson<{
    modules?: BaselineDesignModule[]
    entities?: EntityLike[]
    pageSets?: PageSetLike[]
    designVersion?: number | null
    templateId?: string | null
    templateHash?: string | null
  }>(baseHandoff?.source_design_json, {})
  const requirementJson = parseJson<{
    modules?: BaselineRequirementModule[]
    docVersion?: number | null
    docHash?: string | null
    inputId?: string | null
    title?: string
  }>(baseHandoff?.source_requirements_json, {})
  const manifest = parseJson<Record<string, unknown>>(baseHandoff?.manifest_json, {})
  const manifestTemplate = manifest.prototypeTemplate as { hash?: unknown } | undefined
  const design: BaselineDesignModule[] = Array.isArray(designJson.modules)
    ? designJson.modules
    : [
        {
          designVersion: designJson.designVersion ?? null,
          templateId: designJson.templateId ?? null,
          templateHash: designJson.templateHash ?? null,
          entities: designJson.entities ?? [],
          pageSets: designJson.pageSets ?? []
        }
      ]
  const requirements: BaselineRequirementModule[] = Array.isArray(requirementJson.modules)
    ? requirementJson.modules
    : [
        {
          title: requirementJson.title,
          docVersion: requirementJson.docVersion ?? null,
          docHash: requirementJson.docHash ?? null,
          inputId: requirementJson.inputId ?? null
        }
      ]
  return {
    design,
    requirements,
    manifestTemplateHash: typeof manifestTemplate?.hash === 'string' ? manifestTemplate.hash : null
  }
}

function entryMatches(
  entry: { moduleId?: string; moduleKey?: string },
  module: HandoffModuleSource['module'],
  isDefault: boolean
): boolean {
  if (entry.moduleId) return entry.moduleId === module.id
  if (entry.moduleKey) return entry.moduleKey === module.key
  return isDefault
}

/** 按模块读取基线；`exists=false` 表示该模块不在基线（变更中新增） */
function moduleBaselineOf(
  appId: string,
  source: BaselineSource,
  module: HandoffModuleSource['module'],
  isDefault: boolean
): ModuleBaseline {
  const designEntry = source.design.find(entry => entryMatches(entry, module, isDefault))
  const requirementEntry = source.requirements.find(entry => entryMatches(entry, module, isDefault))
  const inputId = requirementEntry?.inputId ?? null
  const docHash = requirementEntry?.docHash ?? null
  let requirements: DesignInputBundleLike | null = null
  if (inputId) requirements = readDesignInput(appId, inputId, module.id)
  if (!requirements && docHash) {
    const row = db
      .prepare(
        'SELECT id FROM app_design_inputs WHERE app_id = ? AND module_id = ? AND doc_hash = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(appId, module.id, docHash) as { id: string } | undefined
    if (row) requirements = readDesignInput(appId, row.id, module.id)
  }
  return {
    exists: Boolean(designEntry),
    requirements,
    docVersion: requirementEntry?.docVersion ?? requirements?.docVersion ?? null,
    docHash: docHash ?? requirements?.docHash ?? null,
    designVersion: designEntry?.designVersion ?? null,
    templateHash:
      designEntry?.templateHash ?? source.manifestTemplateHash ?? null,
    entities: designEntry?.entities ?? [],
    pageSets: designEntry?.pageSets ?? []
  }
}

interface ModuleChangePlan {
  states: Map<string, DesignHandoffModuleChangeState>
  reports: Map<string, DesignChangeReport | null>
  aggregate: DesignChangeReport | null
}

/**
 * 变更单 #2+ 的真实 diff（按模块）：
 * - 只对 `app_change_set_modules` 选中的模块做 diff；未选模块 `changeState=unchanged`；
 * - 基线无该模块 → `added`（视为全新增）；
 * - seq=1 全部为 null（首次开发文案）。
 */
function changeReportFor(
  appId: string,
  binding: ChangeSetBinding,
  sources: HandoffModuleSource[],
  version: number,
  status: string
): ModuleChangePlan {
  const states = new Map<string, DesignHandoffModuleChangeState>()
  const reports = new Map<string, DesignChangeReport | null>()
  if (binding.view.seq <= 1) return { states, reports, aggregate: null }

  const baseline = loadChangeBaseline(appId, binding)
  const rows = changeSetModuleRows(binding.view.id)
  const selected = new Set(rows.length ? rows.map(row => row.module_id) : sources.map(source => source.module.id))
  const defaultId = defaultModule(appId)?.id
  const changeSetView = {
    seq: binding.view.seq,
    title: binding.view.title,
    scope: binding.view.scope,
    status,
    description: binding.view.description,
    baselineHandoffVersion: binding.view.baselineHandoffVersion,
    currentHandoffVersion: version
  }

  for (const source of sources) {
    if (!source.project) continue
    if (!selected.has(source.module.id)) {
      states.set(source.module.id, 'unchanged')
      reports.set(source.module.id, null)
      continue
    }
    const b = moduleBaselineOf(appId, baseline, source.module, defaultId === source.module.id)
    states.set(source.module.id, b.exists ? 'changed' : 'added')
    const inputDoc = source.project.input
    if (!inputDoc) {
      reports.set(source.module.id, null)
      continue
    }
    reports.set(
      source.module.id,
      buildDesignChangeReport({
        changeSet: changeSetView,
        baseline: {
          requirements: b.requirements,
          docVersion: b.docVersion,
          docHash: b.docHash,
          designVersion: b.designVersion,
          templateHash: b.templateHash,
          entities: b.entities,
          pageSets: b.pageSets
        },
        current: {
          requirements: inputDoc,
          docVersion: inputDoc.docVersion,
          docHash: inputDoc.docHash,
          designVersion: source.project.version,
          templateHash: prototypeTemplateHash(source.project.template),
          entities: source.project.entities,
          pageSets: source.project.pageSets
        }
      })
    )
  }
  return {
    states,
    reports,
    aggregate: mergeChangeReports(Array.from(reports.values()))
  }
}

function buildBundle(
  app: HandoffAppRow,
  sources: HandoffModuleSource[],
  changeSet: DesignHandoffChangeSet,
  version: number,
  warnings: string[],
  changePlan: ModuleChangePlan,
  requirementsBundle: { version: number; hash: string } | null
): DesignHandoffBundle {
  return buildDesignHandoffBundle({
    app: {
      id: app.id,
      name: app.name,
      description: app.description ?? '',
      backendPort: app.backend_port
    },
    modules: sources
      .filter((source): source is HandoffModuleSource & { project: DesignProjectPayload } => Boolean(source.project))
      .map(source => ({
        module: source.module,
        project: source.project,
        designHash: designStateHash(source.project.entities, source.project.pageSets),
        changeState: changePlan.states.get(source.module.id) ?? null,
        changeReport: changePlan.reports.get(source.module.id) ?? null
      })),
    changeSet: { ...changeSet, currentHandoffVersion: version },
    version,
    baselineHandoffVersion: changeSet.baselineHandoffVersion,
    changeReport: changePlan.aggregate,
    warnings,
    requirementsBundle
  })
}

/**
 * 生成后的目标状态：交接包里的变更单/README/manifest 必须反映生成后的状态，
 * 而不是生成前的 design。
 */
function targetStatuses(app: HandoffAppRow): { appStatus: string; changeSetStatus: string } {
  if (app.status === 'completed') return { appStatus: 'completed', changeSetStatus: 'completed' }
  if (app.status === 'design') return { appStatus: 'development', changeSetStatus: 'development' }
  return {
    appStatus: app.status,
    changeSetStatus: app.status === 'development' ? 'development' : app.status
  }
}

// ---- 写盘 ----

function docsDirOf(appId: string): string {
  return path.join(appDirOf(appId), HANDOFF_DIR)
}

function sameFile(a: string, b: string): boolean {
  return a === b
}

function writeHandoffFiles(
  appId: string,
  rendered: RenderedHandoff,
  previous: DesignHandoffFileMeta[]
): void {
  const docsDir = docsDirOf(appId)
  fs.mkdirSync(docsDir, { recursive: true })
  // 原型目录整体重建（生成目录，避免旧页面图片残留）
  fs.rmSync(path.join(docsDir, 'prototypes'), { recursive: true, force: true })
  for (const file of rendered.texts) {
    if (!FILE_NAME.test(file.name) || file.name.includes('..')) {
      throw new DesignHandoffError(500, `交接包文件名不合法：${file.name}`)
    }
    const abs = path.join(docsDir, file.name)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, file.content, 'utf8')
  }
  for (const prototype of rendered.prototypes) {
    const pngTarget = path.join(docsDir, prototype.name)
    fs.mkdirSync(path.dirname(pngTarget), { recursive: true })
    fs.copyFileSync(prototype.sourcePng, pngTarget)
    if (prototype.htmlName && prototype.sourceHtml) {
      try {
        fs.copyFileSync(prototype.sourceHtml, path.join(docsDir, prototype.htmlName))
      } catch {
        // HTML 可选；复制失败不影响 PNG 契约
      }
    }
  }
  // 清理上次生成、本次不再产生的文件（只处理安全文件名）
  const current = new Set(rendered.metas.map(meta => meta.name))
  for (const meta of previous) {
    if (current.has(meta.name)) continue
    if (meta.name.startsWith('prototypes/')) continue
    if (!FILE_NAME.test(meta.name) || meta.name.includes('..')) continue
    try {
      fs.rmSync(path.join(docsDir, meta.name), { force: true })
    } catch {
      // 清理失败不影响本次生成
    }
  }
}

// ---- 对外 API ----

export interface DesignHandoffFileView extends DesignHandoffFileMeta {
  content?: string
  url?: string
}

function fileView(appId: string, meta: DesignHandoffFileMeta, docsDir: string): DesignHandoffFileView {
  const view: DesignHandoffFileView = { ...meta }
  if (meta.kind === 'image') {
    view.url = handoffFileUrl(appId, meta.name)
    return view
  }
  try {
    view.content = fs.readFileSync(path.join(docsDir, meta.name), 'utf8')
  } catch {
    view.content = ''
  }
  return view
}

function handoffFileUrl(appId: string, name: string): string {
  const encoded = name.split('/').map(segment => encodeURIComponent(segment)).join('/')
  return `/api/apps/${encodeURIComponent(appId)}/design/handoff/files/${encoded}`
}

export interface DesignHandoffPreviewResult {
  ok: true
  version: number
  hash: string
  baselineHandoffVersion: number | null
  changeSet: DesignHandoffChangeSet
  manifest: Record<string, unknown>
  files: DesignHandoffFileView[]
  warnings: string[]
  /** 当前是否允许生成（没有 active 变更单且已有交接包时为 false） */
  canGenerate: boolean
  /** 变更单 #2+ 的差异计数；首次/同单重新生成或基线缺失时为 null；多模块为聚合 */
  changes: DesignChangeReport['counts'] | null
  /** 交接包规模与建议分阶段（预览与生成同一套计算） */
  scale: DesignHandoffScale
  /** M6：模块摘要（key/标题/需求+设计版本/计数/缺图/告警/变更状态） */
  modules: DesignHandoffModuleSummary[]
  /** M6：最新需求聚合快照 */
  requirementsBundle: { version: number; hash: string } | null
}

interface PreparedHandoff {
  app: HandoffAppRow
  version: number
  target: { appStatus: string; changeSetStatus: string }
  changeSet: DesignHandoffChangeSet
  plan: { allowGenerate: boolean; warnings: string[] }
  warnings: string[]
  sources: HandoffModuleSource[]
  changePlan: ModuleChangePlan
  bundle: DesignHandoffBundle
  rendered: RenderedHandoff
  requirementsBundle: { version: number; hash: string } | null
}

/** 预览/生成共用：装载模块 → 校验 → 变更单 → 渲染（预览不写盘、不建变更单）。 */
function prepareHandoff(appId: string, mode: 'preview' | 'generate'): PreparedHandoff {
  const app = appRow(appId)
  const sources = loadHandoffModules(appId)
  const validation = validateDesignHandoff(appId, sources)
  if (validation.issues.length) {
    throw new DesignHandoffError(400, '交接包校验未通过', validation.issues, validation.warnings)
  }
  if (mode === 'generate' && app.status === 'requirements') {
    throw new DesignHandoffError(409, '需求阶段尚未完成，不能生成交接包')
  }
  const previous = latestHandoffRow(appId)
  const version = (previous?.version ?? 0) + 1
  const target = targetStatuses(app)
  const snapshots = changeSetModuleSnapshots(sources)
  const plan = resolveChangeSet(app, snapshots, previous, mode)
  if (mode === 'generate' && !plan.allowGenerate) {
    throw new DesignHandoffError(409, `${NO_ACTIVE_CHANGE_SET_MESSAGE}（首次开发交接包请用“生成交接包并进入开发”）`)
  }
  const changeSet = { ...plan.binding.view, status: target.changeSetStatus }
  const changePlan = changeReportFor(appId, plan.binding, sources, version, target.changeSetStatus)
  const warnings = [...validation.warnings, ...plan.warnings]
  const latestBundle = latestRequirementBundle(appId)
  const requirementsBundle = latestBundle ? { version: latestBundle.version, hash: latestBundle.hash } : null
  const bundle = buildBundle(app, sources, changeSet, version, warnings, changePlan, requirementsBundle)
  const rendered = renderHandoff(appId, bundle)
  return {
    app,
    version,
    target,
    changeSet,
    plan,
    warnings,
    sources,
    changePlan,
    bundle,
    rendered,
    requirementsBundle
  }
}

export function previewDesignHandoff(appId: string): DesignHandoffPreviewResult {
  const prepared = prepareHandoff(appId, 'preview')
  const { version, changeSet, changePlan, rendered, warnings, plan, bundle } = prepared
  const textByName = new Map(rendered.texts.map(file => [file.name, file.content]))
  for (const prototype of rendered.prototypes) {
    if (!prototype.htmlName || !prototype.sourceHtml) continue
    try {
      textByName.set(prototype.htmlName, fs.readFileSync(prototype.sourceHtml, 'utf8'))
    } catch {
      // HTML 可选；读取失败时预览为空
    }
  }
  return {
    ok: true,
    version,
    hash: rendered.hash,
    baselineHandoffVersion: changeSet.baselineHandoffVersion,
    changeSet: { ...changeSet, currentHandoffVersion: version },
    manifest: rendered.manifest,
    files: rendered.metas.map(meta =>
      meta.kind === 'image'
        ? // 预览不写盘：不发可下载 URL，避免指向不存在的文件
          { ...meta }
        : { ...meta, content: textByName.get(meta.name) ?? '' }
    ),
    warnings,
    canGenerate: plan.allowGenerate,
    changes: changePlan.aggregate?.counts ?? null,
    scale: rendered.scale,
    modules: moduleSummariesOf(bundle),
    requirementsBundle: prepared.requirementsBundle
  }
}

export interface DesignHandoffGenerateResult {
  ok: true
  appId: string
  appStatus: string
  developmentStarted: boolean
  handoff: DesignHandoffMeta
  changeSet: DesignHandoffChangeSet
  baselineHandoffVersion: number | null
  files: DesignHandoffFileView[]
  warnings: string[]
}

export function generateDesignHandoff(appId: string): DesignHandoffGenerateResult {
  const prepared = prepareHandoff(appId, 'generate')
  const { app, version, target, changeSet, warnings, sources, changePlan, bundle, rendered } = prepared
  const previous = latestHandoffRow(appId)
  const changesMd = rendered.texts.find(file => file.name === FILE_CHANGES)?.content ?? null
  const changeSummary = changePlan.aggregate ? changePlan.aggregate.summary : null
  const docsDir = docsDirOf(appId)
  const previousFiles = previous ? parseJson<DesignHandoffFileMeta[]>(previous.files_json, []) : []
  writeHandoffFiles(appId, rendered, previousFiles)

  const createdAt = nowIso()
  const docsDirLabel = HANDOFF_DIR.split(path.sep).join('/')
  const meta: DesignHandoffMeta = {
    version,
    hash: rendered.hash,
    docsDir: docsDirLabel,
    createdAt,
    changeSet: { ...changeSet, currentHandoffVersion: version },
    baselineHandoffVersion: changeSet.baselineHandoffVersion,
    files: rendered.metas,
    manifest: rendered.manifest,
    template: { id: bundle.template.id, name: bundle.template.name, hash: prototypeTemplateHash(bundle.template) },
    scale: rendered.scale,
    modules: moduleSummariesOf(bundle),
    requirementsBundle: prepared.requirementsBundle
  }
  const moduleSources = sources.filter(
    (source): source is HandoffModuleSource & { project: DesignProjectPayload } => Boolean(source.project)
  )
  const primary = moduleSources[0]
  const sourceDesign = JSON.stringify({
    generatedAt: createdAt,
    modules: moduleSources.map(source => ({
      moduleId: source.module.id,
      moduleKey: source.module.key,
      title: source.module.title,
      position: source.module.position,
      designVersion: source.project.version,
      designStatus: source.project.status,
      confirmedAt: source.project.confirmedAt,
      templateId: source.project.template.id,
      templateHash: prototypeTemplateHash(source.project.template),
      entities: source.project.entities,
      pageSets: source.project.pageSets
    })),
    // 兼容旧单模块读取（默认模块）
    designVersion: primary?.project.version ?? null,
    designStatus: primary?.project.status ?? null,
    confirmedAt: primary?.project.confirmedAt ?? null,
    templateId: primary?.project.template.id ?? null,
    templateHash: primary ? prototypeTemplateHash(primary.project.template) : null,
    ...(moduleSources.length === 1
      ? { entities: primary?.project.entities ?? [], pageSets: primary?.project.pageSets ?? [] }
      : {})
  })
  const sourceRequirements = JSON.stringify({
    generatedAt: createdAt,
    bundleVersion: prepared.requirementsBundle?.version ?? null,
    bundleHash: prepared.requirementsBundle?.hash ?? null,
    modules: moduleSources.map(source => ({
      moduleId: source.module.id,
      moduleKey: source.module.key,
      title: source.module.title,
      position: source.module.position,
      docVersion: source.project.requirement?.version ?? null,
      docHash: source.project.input?.docHash ?? null,
      inputId: source.project.input?.id ?? null,
      inputHash: source.project.input?.docHash ?? null,
      inputStructure: source.project.input?.structure ?? null,
      templateId: source.project.requirement?.templateId ?? null,
      templateName: source.project.requirement?.templateName ?? null
    })),
    // 兼容旧单模块读取（默认模块）
    docVersion: primary?.project.requirement?.version ?? null,
    docHash: primary?.project.input?.docHash ?? null,
    inputId: primary?.project.input?.id ?? null,
    inputHash: primary?.project.input?.docHash ?? null,
    inputStructure: primary?.project.input?.structure ?? null
  })
  const nextStatus = target.appStatus
  const developmentStarted = app.status === 'design'
  const confirmedAts = moduleSources
    .map(source => source.project.confirmedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
  const designConfirmedAt = app.design_confirmed_at ?? confirmedAts[confirmedAts.length - 1] ?? createdAt
  const developmentStartedAt = app.development_started_at ?? (developmentStarted ? createdAt : null)

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO design_handoffs
        (app_id, version, hash, docs_dir, files_json, change_set_id, baseline_handoff_version,
         source_design_json, source_requirements_json, manifest_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      appId,
      version,
      rendered.hash,
      docsDirLabel,
      JSON.stringify(rendered.metas),
      changeSet.id,
      changeSet.baselineHandoffVersion,
      sourceDesign,
      sourceRequirements,
      JSON.stringify(rendered.manifest),
      createdAt
    )
    markChangeSetGenerated(appId, changeSet.id, {
      status: target.changeSetStatus,
      requirementsVersion:
        moduleSources.reduce((max, source) => Math.max(max, source.project.requirement?.version ?? 0), 0) || null,
      designVersion:
        moduleSources.reduce((max, source) => Math.max(max, source.project.version), 0) || null,
      handoffVersion: version,
      changesMd,
      summary: changeSummary
    })
    db.prepare(`
      UPDATE apps SET
        status = ?, design_confirmed_at = ?, development_started_at = ?, handoff_hash = ?,
        current_change_set_id = ?, updated_at = ?
      WHERE id = ?
    `).run(nextStatus, designConfirmedAt, developmentStartedAt, rendered.hash, changeSet.id, createdAt, appId)
    recordStageEvent(appId, 'design', 'handoff-generated', {
      version,
      hash: rendered.hash,
      files: rendered.metas.map(item => item.name),
      changeSetId: changeSet.id,
      changeSetSeq: changeSet.seq
    })
    if (developmentStarted) {
      recordStageEvent(appId, 'design', 'confirmed', { handoff: { version, hash: rendered.hash } })
      recordStageEvent(appId, 'development', 'started', { handoffVersion: version, changeSetId: changeSet.id })
    }
  })
  tx()

  return {
    ok: true,
    appId,
    appStatus: nextStatus,
    developmentStarted,
    handoff: meta,
    changeSet: { ...changeSet, status: target.changeSetStatus, currentHandoffVersion: version },
    baselineHandoffVersion: changeSet.baselineHandoffVersion,
    files: rendered.metas.map(metaItem => fileView(appId, metaItem, docsDir)),
    warnings
  }
}

function scaleFromManifest(manifest: Record<string, unknown> | null): DesignHandoffScale | null {
  const raw = manifest?.scale
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Partial<DesignHandoffScale>
  if (candidate.level !== 'normal' && candidate.level !== 'large') return null
  if (typeof candidate.suggested !== 'boolean') return null
  if (!candidate.counts || typeof candidate.counts !== 'object') return null
  if (!candidate.thresholds || typeof candidate.thresholds !== 'object') return null
  if (!Array.isArray(candidate.triggers)) return null
  if (typeof candidate.phaseCount !== 'number') return null
  return candidate as DesignHandoffScale
}

function modulesFromManifest(manifest: Record<string, unknown> | null): DesignHandoffModuleSummary[] {
  const raw = manifest?.modules
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is DesignHandoffModuleSummary =>
      Boolean(item) && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'
  )
}

function requirementsBundleFromManifest(
  manifest: Record<string, unknown> | null
): { version: number; hash: string } | null {
  const raw = manifest?.requirementsBundle as { version?: unknown; hash?: unknown } | null | undefined
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.version !== 'number' || typeof raw.hash !== 'string') return null
  return { version: raw.version, hash: raw.hash }
}

export function readDesignHandoff(appId: string, version?: unknown): DesignHandoffReadResult {
  appRow(appId)
  const latest = latestHandoffRow(appId)
  if (!latest) {
    const changeSet = latestChangeSetRow(appId)
    return {
      handoff: null,
      changeSet: changeSet ? changeSetView(changeSet) : null,
      files: [],
      filesAvailable: false
    }
  }
  let row = latest
  const requested = Number(version)
  if (Number.isInteger(requested) && requested > 0 && requested !== latest.version) {
    const found = handoffRowByVersion(appId, requested)
    if (!found) throw new DesignHandoffError(404, `交接包版本不存在：v${requested}`)
    row = found
  }
  const changeSetRow = changeSetRowById(appId, row.change_set_id)
  const metas = parseJson<DesignHandoffFileMeta[]>(row.files_json, [])
  const manifest = parseJson<Record<string, unknown> | null>(row.manifest_json, null)
  const docsDir = path.join(appDirOf(appId), row.docs_dir)
  const filesAvailable = row.version === latest.version
  const files: DesignHandoffFileContent[] = metas.map(meta => {
    const base: DesignHandoffFileContent = {
      name: meta.name,
      size: meta.size,
      hash: meta.hash,
      kind: meta.kind,
      content: '',
      missing: !filesAvailable,
      ...(meta.sourcePageId ? { sourcePageId: meta.sourcePageId } : {})
    }
    if (meta.kind === 'image') {
      // 只有最新版本的文件在磁盘上；历史版本不发 URL，避免指向当前版本的图片
      if (filesAvailable) {
        const abs = path.join(docsDir, meta.name)
        if (fs.existsSync(abs)) base.url = handoffFileUrl(appId, meta.name)
        else base.missing = true
      }
      return base
    }
    if (!filesAvailable) return base
    try {
      base.content = fs.readFileSync(path.join(docsDir, meta.name), 'utf8')
    } catch {
      base.missing = true
    }
    return base
  })
  const handoff: DesignHandoffMeta = {
    version: row.version,
    hash: row.hash,
    docsDir: row.docs_dir,
    createdAt: row.created_at,
    changeSet: changeSetRow ? changeSetView(changeSetRow) : null,
    baselineHandoffVersion: row.baseline_handoff_version,
    files: metas,
    manifest,
    template: (() => {
      const template = manifest?.prototypeTemplate as { id?: string; name?: string; hash?: string } | undefined
      return template && typeof template.id === 'string'
        ? { id: template.id, name: String(template.name ?? template.id), hash: String(template.hash ?? '') }
        : null
    })(),
    scale: scaleFromManifest(manifest),
    modules: modulesFromManifest(manifest),
    requirementsBundle: requirementsBundleFromManifest(manifest)
  }
  return { handoff, changeSet: handoff.changeSet, files, filesAvailable }
}

/** 交接包文件读取（仅最新版本文件在磁盘上） */
export function designHandoffFile(appId: string, rawName: string): { abs: string; kind: DesignHandoffFileKind } {
  const name = String(rawName ?? '').replace(/\\/g, '/')
  if (!name || !FILE_NAME.test(name) || name.includes('..') || name.startsWith('/')) {
    throw new DesignHandoffError(400, '文件名不合法')
  }
  const latest = latestHandoffRow(appId)
  if (!latest) throw new DesignHandoffError(404, '还没有生成交接包')
  const metas = parseJson<DesignHandoffFileMeta[]>(latest.files_json, [])
  const meta = metas.find(item => sameFile(item.name, name))
  if (!meta) throw new DesignHandoffError(404, `交接包文件不存在：${name}`)
  const abs = path.join(path.join(appDirOf(appId), latest.docs_dir), name)
  if (!fs.existsSync(abs)) throw new DesignHandoffError(404, `交接包文件已被删除：${name}`)
  return { abs, kind: meta.kind }
}

export function designHandoffSummary(appId: string): {
  version: number
  hash: string
  createdAt: string
  baselineHandoffVersion: number | null
  changeSet: { id: string; seq: number; title: string; status: string } | null
  modules: DesignHandoffModuleSummary[]
  requirementsBundle: { version: number; hash: string } | null
} | null {
  const row = latestHandoffRow(appId)
  if (!row) return null
  const changeSet = changeSetRowById(appId, row.change_set_id)
  const manifest = parseJson<Record<string, unknown> | null>(row.manifest_json, null)
  return {
    version: row.version,
    hash: row.hash,
    createdAt: row.created_at,
    baselineHandoffVersion: row.baseline_handoff_version,
    changeSet: changeSet
      ? { id: changeSet.id, seq: changeSet.seq, title: changeSet.title, status: changeSet.status }
      : null,
    modules: modulesFromManifest(manifest),
    requirementsBundle: requirementsBundleFromManifest(manifest)
  }
}

/** 应用删除时清理交接包/变更单（文件由 removeAppDir 处理） */
export function deleteDesignHandoffData(appId: string): void {
  db.prepare(
    'DELETE FROM app_change_set_modules WHERE change_set_id IN (SELECT id FROM app_change_sets WHERE app_id = ?)'
  ).run(appId)
  db.prepare('DELETE FROM design_handoffs WHERE app_id = ?').run(appId)
  db.prepare('DELETE FROM app_change_sets WHERE app_id = ?').run(appId)
  db.prepare('UPDATE apps SET current_change_set_id = NULL WHERE id = ?').run(appId)
}

/**
 * U7-1：只读取交接包元数据 + manifest（不读文件、不算 scale）。
 * `version` 缺省为最新版本；不存在返回 null（不抛 404，调用方决定语义）。
 */
export interface DesignHandoffManifestMeta {
  version: number
  hash: string
  createdAt: string
  manifest: Record<string, unknown> | null
  changeSet: { id: string; seq: number; title: string; status: string } | null
}

export function designHandoffManifest(appId: string, version?: number): DesignHandoffManifestMeta | null {
  appRow(appId)
  const row = Number.isInteger(version) && (version as number) > 0
    ? handoffRowByVersion(appId, version as number)
    : latestHandoffRow(appId)
  if (!row) return null
  const changeSet = changeSetRowById(appId, row.change_set_id)
  return {
    version: row.version,
    hash: row.hash,
    createdAt: row.created_at,
    manifest: parseJson<Record<string, unknown> | null>(row.manifest_json, null),
    changeSet: changeSet
      ? { id: changeSet.id, seq: changeSet.seq, title: changeSet.title, status: changeSet.status }
      : null
  }
}
