/**
 * 开发阶段（U7-1 / I-09b-2 后端）
 *
 * 阶段是**可选的会话组织**，不是门禁：
 * - 只在大交接包（`manifest.scale.suggested` + `manifest.phases`）下按需生成（`phases/generate`）；
 * - 一阶段可有多个会话，同一时间仍只有一个 active；
 * - 完成阶段不归档会话；开始下一阶段时才归档当前 active；
 * - 完成阶段 best-effort 生成 5—10 行摘要（失败回退最后一条 assistant 文本），下一阶段 brief 使用；
 * - 不影响 `apps.status` / `/complete` / Change Set / 交接包。
 *
 * 阶段行按 `app_id + handoff_version` 归属；新交接包需要重新生成阶段，旧阶段保留为历史（只读）。
 */
import { randomUUID } from 'node:crypto'
import { db, nowIso } from '../db'
import { appDirOf } from '../apps/scaffold'
import { opencode } from '../opencode/runtime'
import { resolveChatModel } from '../chat/service'
import { designHandoffManifest, type DesignHandoffManifestMeta } from '../handoff/design-service'
import {
  activateDevSession,
  activeSessionRow,
  appOrThrow,
  assertDevReady,
  createDevSession,
  getDevState,
  registerAppSecrets,
  type DevStateResponse
} from './service'
import { scrubText } from './timeline'

export type DevPhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export type DevPhaseKind = 'base' | 'module' | 'epic' | 'other' | 'pageSets' | 'all'

export type DevPhaseSummarySource = 'model' | 'fallback' | 'none'

/** `scope_json`：与 `manifest.phases` 的阶段范围一致（只含对外稳定编号） */
export interface DevPhaseScope {
  kind: DevPhaseKind
  storyIds: string[]
  pageSetCodes: string[]
  pageCodes: string[]
  note?: string
}

export interface DevPhaseRow {
  id: string
  app_id: string
  change_set_id: string | null
  handoff_version: number
  phase_key: string
  title: string
  goal: string | null
  scope_json: string
  status: string
  summary: string | null
  summary_source: string | null
  started_at: string | null
  completed_at: string | null
  ord: number
  /** M6b（旧行为 null） */
  module_id: string | null
  parent_key: string | null
  phase_kind: string | null
  created_at: string
  updated_at: string
}

/** 阶段轻量引用（会话/开发状态里展示；`order` 为可执行阶段 1-based） */
export interface DevPhaseRef {
  id: string
  key: string
  title: string
  order: number
  status: DevPhaseStatus
  /** M6b：kind（旧行由 scope.kind 推导） */
  kind: DevPhaseKind
  moduleId: string | null
  moduleKey: string | null
  moduleTitle: string | null
  /** M6b：父模块 key（模块内 Epic/other/pageSets/all）；应用级/模块行为 null */
  parentKey: string | null
}

/** `manifest.phases` 的一项（校验后） */
export interface ManifestDevPhase extends DevPhaseScope {
  key: string
  title: string
  goal: string
  moduleId?: string
  moduleKey?: string
  parentKey?: string
}

/** M6b：模块里程碑汇总（状态由子阶段派生） */
export interface DevPhaseModuleSummary {
  id: string
  key: string
  moduleId: string | null
  title: string
  order: number
  status: DevPhaseStatus
  total: number
  completed: number
  skipped: number
  inProgress: number
}

export interface DevPhaseSessionSummary {
  id: string
  title: string | null
  displayTitle: string
  status: string
  createdAt: string
}

export interface DevPhaseView extends DevPhaseRef {
  goal: string
  scope: DevPhaseScope
  summary: string | null
  summarySource: DevPhaseSummarySource | null
  startedAt: string | null
  completedAt: string | null
  handoffVersion: number
  changeSetId: string | null
  createdAt: string
  updatedAt: string
  /** 该阶段的当前/最新会话（active 优先，否则最新创建） */
  session: DevPhaseSessionSummary | null
  sessionCount: number
}

export interface DevPhasesResponse {
  handoffVersion: number | null
  changeSet: { id: string; seq: number; title: string; status: string } | null
  /** 最新交接包可生成阶段且尚未生成 */
  canGenerate: boolean
  generated: boolean
  phases: DevPhaseView[]
  /** M6b：模块里程碑分组（无模块阶段时为空数组） */
  modules: DevPhaseModuleSummary[]
  /** M6b：模块阶段数量（不计入可执行阶段） */
  modulePhaseCount: number
}

export type DevPhaseStartResult = DevStateResponse & { phase: DevPhaseView }

export interface CompleteDevPhaseResult {
  phase: DevPhaseView
  warnings: string[]
}

export interface DevPhaseSummaryInput {
  appId: string
  phase: DevPhaseRow
  /** 1-based */
  order: number
  total: number
  lastAssistantText: string
  prompt: string
}

export type DevPhaseSummarizer = (input: DevPhaseSummaryInput) => Promise<string>

export interface CompleteDevPhaseOptions {
  /** 测试注入：默认调用 opencode.generateText（60s 超时） */
  summarize?: DevPhaseSummarizer
}

const PHASE_KINDS: DevPhaseKind[] = ['base', 'module', 'epic', 'other', 'pageSets', 'all']
const PHASE_STATUSES: DevPhaseStatus[] = ['not_started', 'in_progress', 'completed', 'skipped']

const LAST_ASSISTANT_LIMIT = 4000
const FALLBACK_SUMMARY_LIMIT = 800
const SUMMARY_TIMEOUT_MS = 60_000

function httpError(status: number, message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number }
  error.status = status
  return error
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && Boolean(item))
}

function truncate(value: string, limit: number): string {
  const text = value.trim()
  return text.length > limit ? text.slice(0, limit) : text
}

function statusOf(value: string | null | undefined): DevPhaseStatus {
  return PHASE_STATUSES.includes(value as DevPhaseStatus) ? (value as DevPhaseStatus) : 'not_started'
}

/**
 * M6b：模块阶段状态由子阶段派生（只在读取时计算，不回写 status）：
 * - 全 completed/skipped 且至少 1 completed → completed；
 * - 全 skipped → skipped；
 * - 任意子阶段已开始/已有进度（in_progress/completed/skipped）→ in_progress；
 * - 否则 not_started。
 */
export function moduleStatusOf(children: Array<Pick<DevPhaseRow, 'status'>>): DevPhaseStatus {
  const statuses = children.map(row => statusOf(row.status))
  if (!statuses.length) return 'not_started'
  const done = statuses.filter(status => status === 'completed' || status === 'skipped')
  if (done.length === statuses.length) {
    return statuses.some(status => status === 'completed') ? 'completed' : 'skipped'
  }
  if (done.length > 0 || statuses.some(status => status === 'in_progress')) return 'in_progress'
  return 'not_started'
}

function moduleChildren(rows: DevPhaseRow[], moduleKey: string): DevPhaseRow[] {
  return rows.filter(row => phaseKindOf(row) !== 'module' && moduleKeyOf(row) === moduleKey)
}

function modulesOf(rows: DevPhaseRow[]): DevPhaseModuleSummary[] {
  return rows
    .filter(row => phaseKindOf(row) === 'module')
    .map(row => {
      const moduleKey = moduleKeyOf(row) ?? row.phase_key
      const children = moduleChildren(rows, moduleKey)
      const completed = children.filter(child => statusOf(child.status) === 'completed').length
      const skipped = children.filter(child => statusOf(child.status) === 'skipped').length
      const inProgress = children.filter(child => statusOf(child.status) === 'in_progress').length
      return {
        id: row.id,
        key: moduleKey,
        moduleId: row.module_id ?? null,
        title: row.title,
        order: Math.trunc(row.ord) + 1,
        status: moduleStatusOf(children),
        total: children.length,
        completed,
        skipped,
        inProgress
      }
    })
}

function kindOf(value: unknown): DevPhaseKind | null {
  return PHASE_KINDS.includes(value as DevPhaseKind) ? (value as DevPhaseKind) : null
}

/** 1-based 可执行阶段顺序（模块里程碑不占阶段号） */
function orderOf(row: DevPhaseRow): number {
  if (phaseKindOf(row) === 'module') return Math.trunc(row.ord) + 1
  const result = db
    .prepare(
      `SELECT COUNT(*) AS count FROM app_dev_phases
       WHERE app_id = ? AND handoff_version = ? AND ord <= ?
         AND (phase_kind IS NULL OR phase_kind <> 'module')`
    )
    .get(row.app_id, row.handoff_version, row.ord) as { count: number }
  return Math.max(1, result.count)
}

/** M6b：kind 优先取新列；旧行 phase_kind=null 时由 scope.kind 推导（不迁移） */
function phaseKindOf(row: Pick<DevPhaseRow, 'phase_kind' | 'scope_json'>): DevPhaseKind {
  return kindOf(row.phase_kind) ?? parseScope(row.scope_json).kind
}

/** M6b：模块 key（模块行取 key 前缀；子阶段取 parent_key） */
function moduleKeyOf(row: Pick<DevPhaseRow, 'phase_key' | 'phase_kind' | 'parent_key' | 'scope_json'>): string | null {
  if (phaseKindOf(row) === 'module') return row.phase_key.startsWith('module:') ? row.phase_key.slice(7) : null
  return row.parent_key?.trim() || null
}

function refOf(row: DevPhaseRow): DevPhaseRef {
  const moduleInfo = moduleInfoOf(row.module_id ?? null)
  return {
    id: row.id,
    key: row.phase_key,
    title: row.title,
    order: orderOf(row),
    status: statusOf(row.status),
    kind: phaseKindOf(row),
    moduleId: row.module_id ?? null,
    moduleKey: moduleKeyOf(row),
    moduleTitle: moduleInfo?.title ?? null,
    parentKey: row.parent_key?.trim() || null
  }
}

function recordEvent(appId: string, event: string, detail?: Record<string, unknown>): void {
  db.prepare('INSERT INTO app_stage_events (app_id, stage, event, detail, created_at) VALUES (?, ?, ?, ?, ?)').run(
    appId,
    'development',
    event,
    detail ? JSON.stringify(detail) : null,
    nowIso()
  )
}

// ---- 查询 ----

export function phaseRowsOf(appId: string, handoffVersion: number): DevPhaseRow[] {
  return db
    .prepare('SELECT * FROM app_dev_phases WHERE app_id = ? AND handoff_version = ? ORDER BY ord ASC')
    .all(appId, handoffVersion) as DevPhaseRow[]
}

function latestHandoffVersion(appId: string): number | null {
  const row = db.prepare('SELECT MAX(version) AS version FROM design_handoffs WHERE app_id = ?').get(appId) as
    | { version: number | null }
    | undefined
  return typeof row?.version === 'number' ? row.version : null
}

function phaseRowById(appId: string, phaseId: string): DevPhaseRow | undefined {
  return db.prepare('SELECT * FROM app_dev_phases WHERE id = ? AND app_id = ?').get(phaseId, appId) as
    | DevPhaseRow
    | undefined
}

function phaseRowOrThrow(appId: string, phaseId: string): DevPhaseRow {
  const row = phaseRowById(appId, phaseId)
  if (!row) throw httpError(404, `开发阶段不存在：${phaseId}`)
  return row
}

/** 会话阶段引用；phaseId 为空/不存在返回 null（旧会话保持 null） */
export function phaseRefById(phaseId: string | null | undefined): DevPhaseRef | null {
  if (!phaseId) return null
  const row = db.prepare('SELECT * FROM app_dev_phases WHERE id = ?').get(phaseId) as DevPhaseRow | undefined
  return row ? refOf(row) : null
}

export function phaseRefsByIds(ids: Array<string | null | undefined>): Map<string, DevPhaseRef> {
  const map = new Map<string, DevPhaseRef>()
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (!unique.length) return map
  const rows = db
    .prepare(`SELECT * FROM app_dev_phases WHERE id IN (${unique.map(() => '?').join(',')})`)
    .all(...unique) as DevPhaseRow[]
  for (const row of rows) map.set(row.id, refOf(row))
  return map
}

/** 开发状态里的阶段摘要：只看最新交接包的阶段（历史阶段在阶段接口中查看） */
export function latestPhaseRefs(appId: string): DevPhaseRef[] {
  const version = latestHandoffVersion(appId)
  if (version === null) return []
  return phaseRowsOf(appId, version).map(refOf)
}

function parseScope(raw: string): DevPhaseScope {
  let value: Record<string, unknown> | null = null
  try {
    value = JSON.parse(raw) as Record<string, unknown>
  } catch {
    value = null
  }
  const kind = kindOf(value?.kind) ?? 'all'
  return {
    kind,
    storyIds: stringArray(value?.storyIds),
    pageSetCodes: stringArray(value?.pageSetCodes),
    pageCodes: stringArray(value?.pageCodes),
    ...(asString(value?.note).trim() ? { note: asString(value?.note).trim() } : {})
  }
}

function sessionsByPhase(appId: string): Map<string, Array<{ id: string; title: string | null; status: string; created_at: string }>> {
  const rows = db
    .prepare(
      `SELECT id, dev_phase_id, title, status, created_at FROM app_sessions
       WHERE app_id = ? AND dev_phase_id IS NOT NULL ORDER BY created_at DESC`
    )
    .all(appId) as Array<{ id: string; dev_phase_id: string; title: string | null; status: string; created_at: string }>
  const map = new Map<string, Array<{ id: string; title: string | null; status: string; created_at: string }>>()
  for (const row of rows) {
    const list = map.get(row.dev_phase_id) ?? []
    list.push({ id: row.id, title: row.title, status: row.status, created_at: row.created_at })
    map.set(row.dev_phase_id, list)
  }
  return map
}

interface PhaseSessionRow {
  id: string
  title: string | null
  status: string
  created_at: string
  opencode_session_id: string | null
}

function phaseSessions(appId: string, phaseId: string): PhaseSessionRow[] {
  return db
    .prepare(
      `SELECT id, title, status, created_at, opencode_session_id FROM app_sessions
       WHERE app_id = ? AND dev_phase_id = ? ORDER BY created_at DESC`
    )
    .all(appId, phaseId) as PhaseSessionRow[]
}

/** active 优先，否则最新创建 */
function currentPhaseSession(sessions: PhaseSessionRow[]): PhaseSessionRow | null {
  return sessions.find(session => session.status === 'active') ?? sessions[0] ?? null
}

function viewOf(row: DevPhaseRow, grouped: ReturnType<typeof sessionsByPhase>): DevPhaseView {
  const sessions = grouped.get(row.id) ?? []
  const current = sessions.find(session => session.status === 'active') ?? sessions[0] ?? null
  // 摘要可能来自旧数据/直接 DB 写入：返回前统一脱敏（defense-in-depth）
  const summary = row.summary?.trim() ? scrubText(row.summary.trim()) : null
  const ref = refOf(row)
  const status =
    ref.kind === 'module'
      ? moduleStatusOf(moduleChildren(phaseRowsOf(row.app_id, row.handoff_version), moduleKeyOf(row) ?? ''))
      : ref.status
  return {
    ...ref,
    status,
    goal: row.goal?.trim() ?? '',
    scope: parseScope(row.scope_json),
    summary: summary || null,
    summarySource: (row.summary_source as DevPhaseSummarySource | null) ?? null,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    handoffVersion: row.handoff_version,
    changeSetId: row.change_set_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    session: current
      ? {
          id: current.id,
          title: current.title?.trim() || null,
          displayTitle: current.title?.trim() || '会话',
          status: current.status,
          createdAt: current.created_at
        }
      : null,
    sessionCount: sessions.length
  }
}

function viewsOf(appId: string, rows: DevPhaseRow[]): DevPhaseView[] {
  const grouped = sessionsByPhase(appId)
  return rows.map(row => viewOf(row, grouped))
}

function phaseViewById(appId: string, phaseId: string): DevPhaseView | null {
  const row = phaseRowById(appId, phaseId)
  return row ? viewOf(row, sessionsByPhase(appId)) : null
}

// ---- manifest.phases ----

/** 校验 `manifest.phases`；非法/重复 key 的项直接忽略（不抛错） */
export function parseManifestPhases(manifest: Record<string, unknown> | null | undefined): ManifestDevPhase[] {
  const raw = manifest?.phases
  if (!Array.isArray(raw)) return []
  const phases: ManifestDevPhase[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const key = asString(record.key).trim()
    const title = asString(record.title).trim()
    const kind = kindOf(record.kind)
    if (!key || !title || !kind || seen.has(key)) continue
    seen.add(key)
    const goal = asString(record.goal).trim()
    const note = asString(record.note).trim()
    const moduleId = asString(record.moduleId).trim()
    const moduleKey = asString(record.moduleKey).trim()
    const parentKey = asString(record.parentKey).trim()
    phases.push({
      key,
      kind,
      title,
      goal: goal || title,
      storyIds: stringArray(record.storyIds),
      pageSetCodes: stringArray(record.pageSetCodes),
      pageCodes: stringArray(record.pageCodes),
      ...(moduleId ? { moduleId } : {}),
      ...(moduleKey ? { moduleKey } : kind === 'module' && key.startsWith('module:') ? { moduleKey: key.slice(7) } : {}),
      ...(parentKey ? { parentKey } : {}),
      ...(note ? { note } : {})
    })
  }
  return phases
}

function scaleSuggested(manifest: Record<string, unknown> | null | undefined): boolean {
  const scale = manifest?.scale
  if (!scale || typeof scale !== 'object') return false
  return (scale as Record<string, unknown>).suggested === true
}

function canGenerateOf(latest: DesignHandoffManifestMeta | null, existing: DevPhaseRow[]): boolean {
  if (!latest || existing.length) return false
  return scaleSuggested(latest.manifest) && parseManifestPhases(latest.manifest).length > 0
}

function changeSetOf(latest: DesignHandoffManifestMeta | null): DevPhasesResponse['changeSet'] {
  return latest?.changeSet ?? null
}

// ---- 生成 / 查询 ----

export function getDevPhases(appId: string, options: { handoffVersion?: number } = {}): DevPhasesResponse {
  appOrThrow(appId)
  const latest = designHandoffManifest(appId)
  const latestRows = latest ? phaseRowsOf(appId, latest.version) : []
  const requested = Number.isInteger(options.handoffVersion) && (options.handoffVersion as number) > 0
    ? (options.handoffVersion as number)
    : null
  let version = latest?.version ?? null
  let changeSet = changeSetOf(latest)
  if (requested !== null && requested !== latest?.version) {
    const meta = designHandoffManifest(appId, requested)
    if (!meta) throw httpError(404, `交接包版本不存在：v${requested}`)
    version = meta.version
    changeSet = meta.changeSet
  }
  const rows = version === null ? [] : version === latest?.version ? latestRows : phaseRowsOf(appId, version)
  return {
    handoffVersion: version,
    changeSet,
    canGenerate: canGenerateOf(latest, latestRows),
    generated: rows.length > 0,
    phases: viewsOf(appId, rows),
    modules: modulesOf(rows),
    modulePhaseCount: rows.filter(row => phaseKindOf(row) === 'module').length
  }
}

/** 按需生成阶段（幂等：当前交接包已有阶段时直接返回） */
export function generateDevPhases(appId: string): DevPhasesResponse {
  const app = appOrThrow(appId)
  assertDevReady(app)
  const latest = designHandoffManifest(appId)
  if (!latest) throw httpError(409, '请先完成设计并生成交接包')
  if (phaseRowsOf(appId, latest.version).length) return getDevPhases(appId)
  const drafts = parseManifestPhases(latest.manifest)
  if (!scaleSuggested(latest.manifest) || !drafts.length) {
    throw httpError(409, '当前交接包缺少阶段数据，请重新生成交接包')
  }

  const now = nowIso()
  const tx = db.transaction(() => {
    drafts.forEach((draft, index) => {
      const scope: DevPhaseScope = {
        kind: draft.kind,
        storyIds: draft.storyIds,
        pageSetCodes: draft.pageSetCodes,
        pageCodes: draft.pageCodes,
        ...(draft.note ? { note: draft.note } : {})
      }
      db.prepare(`
        INSERT INTO app_dev_phases
          (id, app_id, change_set_id, handoff_version, phase_key, title, goal, scope_json,
           status, summary, summary_source, started_at, completed_at, ord,
           module_id, parent_key, phase_kind, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'not_started', NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        appId,
        latest.changeSet?.id ?? null,
        latest.version,
        draft.key,
        draft.title,
        draft.goal,
        JSON.stringify(scope),
        index,
        draft.moduleId ?? null,
        draft.parentKey ?? null,
        draft.kind,
        now,
        now
      )
    })
  })
  tx()
  recordEvent(appId, 'phases-generated', { handoffVersion: latest.version, count: drafts.length })
  return getDevPhases(appId)
}

// ---- 开始 / 完成 / 跳过 / 重新打开 ----

function markInProgress(row: DevPhaseRow): void {
  const now = nowIso()
  db.prepare(
    `UPDATE app_dev_phases SET status = 'in_progress', started_at = COALESCE(started_at, ?),
       completed_at = NULL, updated_at = ? WHERE id = ?`
  ).run(now, now, row.id)
}

/** M6b：模块阶段只做分组/里程碑，不允许开始/完成/跳过/重新打开（不单独开会话） */
function assertExecutablePhase(row: DevPhaseRow): void {
  if (phaseKindOf(row) === 'module') {
    throw httpError(409, '模块阶段只作分组/里程碑，不单独开始会话；请在模块内选择 Epic/页面阶段')
  }
}

function moduleInfoOf(moduleId: string | null): { key: string; title: string } | null {
  if (!moduleId) return null
  const row = db.prepare('SELECT module_key, title FROM app_modules WHERE id = ?').get(moduleId) as
    | { module_key: string; title: string }
    | undefined
  return row ? { key: row.module_key, title: row.title } : null
}

function assertCurrentHandoff(appId: string, row: DevPhaseRow): void {
  const latest = designHandoffManifest(appId)
  if (!latest) throw httpError(409, '请先完成设计并生成交接包')
  if (row.handoff_version !== latest.version) {
    throw httpError(409, '该阶段属于历史交接包版本，只能查看；请重新生成交接包后按阶段开发')
  }
}

/**
 * 上一阶段摘要（M6b）：
 * - 模块内可执行阶段：只取同模块前一个可执行阶段（Epic/other/pageSets/all）；
 * - 应用级/旧单模块：沿用全局 ord 前一个。
 */
function previousSummaryOf(appId: string, row: DevPhaseRow): string | null {
  const previous = row.module_id
    ? (db
        .prepare(
          `SELECT summary FROM app_dev_phases
           WHERE app_id = ? AND handoff_version = ? AND module_id = ? AND ord < ?
             AND (phase_kind IS NULL OR phase_kind <> 'module')
           ORDER BY ord DESC LIMIT 1`
        )
        .get(appId, row.handoff_version, row.module_id, row.ord) as { summary: string | null } | undefined)
    : (db
        .prepare('SELECT summary FROM app_dev_phases WHERE app_id = ? AND handoff_version = ? AND ord = ?')
        .get(appId, row.handoff_version, row.ord - 1) as { summary: string | null } | undefined)
  const summary = previous?.summary?.trim()
  return summary ? scrubText(summary) : null
}

function totalOf(appId: string, row: DevPhaseRow): number {
  const result = db
    .prepare(
      `SELECT COUNT(*) AS count FROM app_dev_phases
       WHERE app_id = ? AND handoff_version = ? AND (phase_kind IS NULL OR phase_kind <> 'module')`
    )
    .get(appId, row.handoff_version) as { count: number }
  return result.count
}

/** 阶段首条提示（不自动发送；用户在 Composer 编辑后发送） */
export function buildPhasePrompt(input: {
  order: number
  total: number
  title: string
  goal: string
  scope: DevPhaseScope
  previousSummary?: string | null
  /** M6b：所属模块（有值时 brief 明确模块范围） */
  module?: { key: string; title: string } | null
}): string {
  const parts: string[] = []
  if (input.scope.storyIds.length) parts.push(`Story ${input.scope.storyIds.join('、')}`)
  if (input.scope.pageSetCodes.length) parts.push(`页面集 ${input.scope.pageSetCodes.join('、')}`)
  if (input.scope.pageCodes.length) parts.push(`页面 ${input.scope.pageCodes.join('、')}`)
  const range = parts.length ? parts.join('；') : '按 `04-PLAN.md` 阶段章节'
  // 上一阶段摘要可能来自旧数据/直接 DB：写进 brief 前必须脱敏
  const summary = scrubText(input.previousSummary?.trim() || '无上一阶段摘要')
  const lines = [
    `你现在在阶段 ${input.order}/${input.total}：${input.title}。`,
    ...(input.module ? [`模块：${input.module.key} ${input.module.title}（只做本模块阶段范围）。`] : []),
    `目标：${input.goal || input.title}`,
    `范围：${range}`,
    '交接包：docs/handoff/00-README.md、04-PLAN.md（阶段章节）、相关 03-PAGES/02-DATA-MODEL。',
    '要求：只做本阶段范围；不要扩展/重写其它阶段；完成后总结已实现/未完成/关键文件/下一阶段注意。',
    '语言：请全程使用中文回复；思考/进度说明也使用中文。',
    '上一阶段摘要：',
    summary
  ]
  if (input.scope.note) lines.splice(input.module ? 4 : 3, 0, `说明：${input.scope.note}`)
  return lines.join('\n')
}

function phaseSessionTitle(appName: string, row: DevPhaseRow): string {
  const module = moduleInfoOf(row.module_id)
  const prefix = module ? `${module.key} ${module.title} · ` : ''
  return `${appName} 开发 · 阶段 ${orderOf(row)} ${prefix}${row.title}`
}

/** 开始阶段响应：session.phase 与顶层 phase 都反映最新状态（创建会话时阶段还是 not_started） */
function withPhase(state: DevStateResponse, phase: DevPhaseView): DevPhaseStartResult {
  const ref: DevPhaseRef = {
    id: phase.id,
    key: phase.key,
    title: phase.title,
    order: phase.order,
    status: phase.status,
    kind: phase.kind,
    moduleId: phase.moduleId,
    moduleKey: phase.moduleKey,
    moduleTitle: phase.moduleTitle,
    parentKey: phase.parentKey
  }
  return {
    ...state,
    session: state.session ? { ...state.session, phase: ref } : null,
    phase
  }
}

/**
 * 开始/进入阶段：
 * - 该阶段已有会话：active 直接返回；archived 复用 I-10 activate；stale 由 activate 报 409；
 * - 无会话：best-effort interrupt 当前 active → 创建 build 会话（tag + 阶段 brief）→ 归档旧 active；
 * - 不自动发送消息。
 */
export async function startDevPhase(appId: string, phaseId: string): Promise<DevPhaseStartResult> {
  const app = appOrThrow(appId)
  assertDevReady(app)
  const row = phaseRowOrThrow(appId, phaseId)
  assertCurrentHandoff(appId, row)
  assertExecutablePhase(row)
  if (row.status === 'completed') throw httpError(409, '阶段已完成；如需继续请先“重新打开”')

  const sessions = phaseSessions(appId, phaseId)
  const current = currentPhaseSession(sessions)
  if (current) {
    const state =
      current.status === 'active'
        ? await getDevState(appId, { sessionId: current.id })
        : await activateDevSession(appId, current.id)
    markInProgress(phaseRowById(appId, row.id) ?? row)
    recordEvent(appId, 'phase-started', { phaseId: row.id, sessionId: current.id, resumed: true })
    const phase = phaseViewById(appId, phaseId)
    if (!phase) throw httpError(404, `开发阶段不存在：${phaseId}`)
    return withPhase(state, phase)
  }

  const active = activeSessionRow(appId)
  if (active?.opencode_session_id) {
    // 避免两个会话同时写应用目录；失败不阻塞用户操作
    await opencode.interrupt(active.opencode_session_id, true).catch(() => undefined)
  }
  const previousSummary = previousSummaryOf(appId, row)
  const brief = buildPhasePrompt({
    order: orderOf(row),
    total: totalOf(appId, row),
    title: row.title,
    goal: row.goal?.trim() ?? '',
    scope: parseScope(row.scope_json),
    previousSummary,
    module: moduleInfoOf(row.module_id)
  })
  const state = await createDevSession(appId, {
    new: true,
    devPhaseId: row.id,
    title: phaseSessionTitle(app.name, row),
    defaultPrompt: brief
  })
  markInProgress(phaseRowById(appId, row.id) ?? row)
  recordEvent(appId, 'phase-started', { phaseId: row.id, sessionId: state.session?.id ?? null, resumed: false })
  const phase = phaseViewById(appId, phaseId)
  if (!phase) throw httpError(404, `开发阶段不存在：${phaseId}`)
  return withPhase(state, phase)
}

function assistantTextOf(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const record = message as Record<string, unknown>
  const parts = Array.isArray(record.content) ? (record.content as Array<Record<string, unknown>>) : []
  return parts
    .filter(part => part?.type === 'text')
    .map(part => asString(part.text))
    .join('\n')
    .trim()
}

/** 最后一条 assistant 文本（按时间正序取最后一个非空） */
export function lastAssistantText(messages: unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message || typeof message !== 'object') continue
    if ((message as Record<string, unknown>).type !== 'assistant') continue
    const text = assistantTextOf(message)
    if (text) return text
  }
  return ''
}

function buildSummaryPrompt(input: {
  order: number
  total: number
  title: string
  goal: string
  scope: DevPhaseScope
  lastAssistantText: string
}): string {
  const parts: string[] = []
  if (input.scope.storyIds.length) parts.push(`Story ${input.scope.storyIds.join('、')}`)
  if (input.scope.pageSetCodes.length) parts.push(`页面集 ${input.scope.pageSetCodes.join('、')}`)
  if (input.scope.pageCodes.length) parts.push(`页面 ${input.scope.pageCodes.join('、')}`)
  const range = parts.length ? parts.join('；') : '按 `04-PLAN.md` 阶段章节'
  return [
    '你是开发阶段总结助手。请根据阶段目标与会话最后一条回复，输出 5—10 行中文摘要，包含：',
    '1) 已实现；2) 关键文件；3) 未完成或风险；4) 下一阶段注意。',
    '只输出摘要正文，不要前后缀、不要 Markdown 代码块。',
    '',
    `阶段：第 ${input.order}/${input.total} 阶段 · ${input.title}`,
    `目标：${input.goal || input.title}`,
    `范围：${range}`,
    '',
    '会话最后一条回复：',
    truncate(scrubText(input.lastAssistantText), LAST_ASSISTANT_LIMIT)
  ].join('\n')
}

/**
 * 摘要用只读 agent：优先 design（tools 全部 deny），其次 req；**绝不用 build**（有读写/命令权限）。
 * 纯函数便于单测；实际可用性由 opencode 的 agent 列表决定。
 */
export function pickSummaryAgent(agentIds: string[]): 'design' | 'req' | null {
  const ids = new Set(agentIds)
  if (ids.has('design')) return 'design'
  if (ids.has('req')) return 'req'
  return null
}

/** 默认摘要器：短暂 opencode 会话（design/req 只读 agent，60s 超时）；失败由调用方回退 */
async function defaultPhaseSummarizer(input: DevPhaseSummaryInput): Promise<string> {
  const dir = appDirOf(input.appId)
  const agents = await opencode.listAgents(dir).catch(() => [])
  const agent = pickSummaryAgent(agents.map(item => item.id))
  if (!agent) throw new Error('没有可用的只读摘要 agent（design/req）')
  const model = await resolveChatModel(input.appId, 'development', dir)
  return opencode.generateText({
    directory: dir,
    agent,
    model,
    prompt: input.prompt,
    timeoutMs: SUMMARY_TIMEOUT_MS
  })
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 完成阶段：置 completed，**不归档会话**；best-effort 生成摘要。
 * 失败/超时只回落到最后一条 assistant 文本，状态仍 completed（warnings 返回原因）。
 */
export async function completeDevPhase(
  appId: string,
  phaseId: string,
  options: CompleteDevPhaseOptions = {}
): Promise<CompleteDevPhaseResult> {
  const app = appOrThrow(appId)
  assertDevReady(app)
  const row = phaseRowOrThrow(appId, phaseId)
  assertCurrentHandoff(appId, row)
  assertExecutablePhase(row)
  if (row.status === 'completed') {
    const phase = phaseViewById(appId, phaseId)
    if (!phase) throw httpError(404, `开发阶段不存在：${phaseId}`)
    return { phase, warnings: [] }
  }

  const warnings: string[] = []
  let summary = ''
  let source: DevPhaseSummarySource = 'none'
  const session = currentPhaseSession(phaseSessions(appId, phaseId))

  if (session?.opencode_session_id) {
    // P5 教训：工具输出可能含 DB 密码/Authorization；读取前先注册应用配置里的密钥
    registerAppSecrets(appId, appDirOf(appId))
    let lastAssistant = ''
    try {
      const messages = await opencode.messages(session.opencode_session_id, { limit: 200, order: 'asc' })
      lastAssistant = scrubText(lastAssistantText(messages.data))
    } catch (error) {
      warnings.push(scrubText(`读取阶段会话消息失败，未生成阶段摘要：${messageOf(error)}`))
    }
    if (lastAssistant) {
      const prompt = buildSummaryPrompt({
        order: orderOf(row),
        total: totalOf(appId, row),
        title: row.title,
        goal: row.goal?.trim() ?? '',
        scope: parseScope(row.scope_json),
        lastAssistantText: lastAssistant
      })
      try {
        const summarize = options.summarize ?? defaultPhaseSummarizer
        // 模型返回内容也可能复述 secret：落库前再脱敏一次（含注入的测试摘要器）
        const generated = scrubText(
          (
            await summarize({
              appId,
              phase: row,
              order: orderOf(row),
              total: totalOf(appId, row),
              lastAssistantText: lastAssistant,
              prompt
            })
          ).trim()
        )
        if (!generated) throw new Error('模型返回空摘要')
        summary = truncate(generated, LAST_ASSISTANT_LIMIT)
        source = 'model'
      } catch (error) {
        summary = truncate(lastAssistant, FALLBACK_SUMMARY_LIMIT)
        source = 'fallback'
        warnings.push(scrubText(`阶段摘要生成失败，已改用最后一条回复：${messageOf(error)}`))
      }
    }
  }

  const now = nowIso()
  db.prepare(
    `UPDATE app_dev_phases SET status = 'completed', summary = ?, summary_source = ?, completed_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(summary || null, source, now, now, row.id)
  recordEvent(appId, 'phase-completed', { phaseId: row.id, summarySource: source, sessionId: session?.id ?? null })
  const phase = phaseViewById(appId, phaseId)
  if (!phase) throw httpError(404, `开发阶段不存在：${phaseId}`)
  return { phase, warnings }
}

export function skipDevPhase(appId: string, phaseId: string): DevPhaseView {
  const app = appOrThrow(appId)
  assertDevReady(app)
  const row = phaseRowOrThrow(appId, phaseId)
  assertCurrentHandoff(appId, row)
  assertExecutablePhase(row)
  if (row.status !== 'skipped') {
    const now = nowIso()
    db.prepare(
      `UPDATE app_dev_phases SET status = 'skipped', completed_at = ?, updated_at = ? WHERE id = ?`
    ).run(now, now, row.id)
    recordEvent(appId, 'phase-skipped', { phaseId: row.id })
  }
  const phase = phaseViewById(appId, phaseId)
  if (!phase) throw httpError(404, `开发阶段不存在：${phaseId}`)
  return phase
}

export function reopenDevPhase(appId: string, phaseId: string): DevPhaseView {
  const app = appOrThrow(appId)
  assertDevReady(app)
  const row = phaseRowOrThrow(appId, phaseId)
  assertCurrentHandoff(appId, row)
  assertExecutablePhase(row)
  if (row.status !== 'in_progress') {
    const now = nowIso()
    // 保留 summary（再次完成时覆盖），只清 completed_at
    db.prepare(
      `UPDATE app_dev_phases SET status = 'in_progress', started_at = COALESCE(started_at, ?), completed_at = NULL, updated_at = ?
       WHERE id = ?`
    ).run(now, now, row.id)
    recordEvent(appId, 'phase-reopened', { phaseId: row.id, reason: 'manual' })
  }
  const phase = phaseViewById(appId, phaseId)
  if (!phase) throw httpError(404, `开发阶段不存在：${phaseId}`)
  return phase
}

/**
 * 向已完成/已跳过阶段的 active 会话发消息 → 阶段自动回到 in_progress。
 * 历史交接包的阶段不自动改（保持只读历史）。
 */
export function reopenPhaseForPrompt(
  appId: string,
  phaseId: string | null | undefined
): { phase: DevPhaseRef | null; warning: string | null } {
  if (!phaseId) return { phase: null, warning: null }
  const row = phaseRowById(appId, phaseId)
  if (!row || (row.status !== 'completed' && row.status !== 'skipped')) return { phase: null, warning: null }
  if (phaseKindOf(row) === 'module') return { phase: null, warning: null }
  const latest = designHandoffManifest(appId)
  if (latest && row.handoff_version !== latest.version) return { phase: null, warning: null }
  const now = nowIso()
  db.prepare(
    `UPDATE app_dev_phases SET status = 'in_progress', completed_at = NULL, updated_at = ? WHERE id = ?`
  ).run(now, row.id)
  recordEvent(appId, 'phase-reopened', { phaseId: row.id, reason: 'prompt' })
  return {
    phase: { ...refOf(row), status: 'in_progress' },
    warning: `阶段「${row.title}」已重新打开`
  }
}

/** 删除应用时清理阶段（会话随应用删除；不改 opencode） */
export function deleteDevPhaseData(appId: string): void {
  db.prepare('DELETE FROM app_dev_phases WHERE app_id = ?').run(appId)
}
