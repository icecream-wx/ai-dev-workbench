/**
 * 开发会话服务（P4）
 *
 * 一个应用维护一个 active opencode 会话（build agent）；可新建会话、发送/停止、
 * 权限/表单回复、读取归一化时间线。工作台不限制开发 agent 的工具/流程。
 */
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { db, nowIso } from '../db'
import { appDirOf } from '../apps/scaffold'
import { opencode } from '../opencode/runtime'
import { redactDeep, registerSecret } from '../opencode/redact'
import { resolveChatModel, type ModelRef } from '../chat/service'
import { designHandoffSummary } from '../handoff/design-service'
import { buildProgress, type DevContextLevel, type DevContextUsage, type DevProgress } from './timeline'
import { latestPhaseRefs, phaseRefById, phaseRefsByIds, reopenPhaseForPrompt, type DevPhaseRef } from './phases'

/** #3：所有开发首条提示统一中文要求（模型不保证 100% 遵守） */
const CHINESE_INSTRUCTION = '请全程使用中文回复；思考/进度说明也使用中文。'

export const DEFAULT_DEV_PROMPT =
  '请阅读 docs/handoff/00-README.md，并按其中文档完成开发。完成后请总结：已实现需求、关键文件、如何运行、自测结果、未解决事项。' +
  CHINESE_INSTRUCTION

const REGENERATED_DEV_PROMPT =
  '交接包已在同一变更单内重新生成（应用目录可能已有代码）。请阅读 docs/handoff/00-README.md 与 docs/handoff/05-CHANGES.md，在现有代码上增量修改，保留未变更的功能/接口/页面/测试，不要重写整个项目。完成后请总结：变更点、影响文件、自测结果、未解决事项。' +
  CHINESE_INSTRUCTION

interface HandoffLike {
  version: number
  baselineHandoffVersion?: number | null
  changeSet?: { id: string; seq: number; title: string; status: string } | null
}

/** 首条提示按变更单生成：初次 / 同单重新生成 / 变更 #N（C1 §6） */
export function buildDevPrompt(handoff: HandoffLike | null): string {
  if (!handoff) return DEFAULT_DEV_PROMPT
  const changeSet = handoff.changeSet ?? null
  if (!changeSet || changeSet.seq <= 1) {
    return handoff.version > 1 ? REGENERATED_DEV_PROMPT : DEFAULT_DEV_PROMPT
  }
  const baseline = handoff.baselineHandoffVersion ? `v${handoff.baselineHandoffVersion}` : '—'
  return (
    `这是第 ${changeSet.seq} 次变更（变更单：${changeSet.title}），基线交接包 ${baseline}，当前交接包 v${handoff.version}。` +
    '请先阅读 docs/handoff/05-CHANGES.md，再读 docs/handoff/00-README.md 和相关章节；' +
    '在现有代码上增量实现，保留未变更部分，不要重写整个项目。完成后总结变更点、影响文件、自测结果、未解决事项。' +
    CHINESE_INSTRUCTION
  )
}

const HANDOFF_ENTRY = path.join('docs', 'handoff', '00-README.md')
const MAX_PROMPT_CHARS = 200_000
const secretSignatures = new Map<string, string>()
const SECRET_CONFIG_FILES = [
  path.join('backend', 'src', 'META-INF', '_srv', 'config', 'user-config.xml'),
  path.join('backend', 'src', 'application.properties'),
  path.join('backend', 'src', 'application-afc.properties'),
  path.join('backend', 'src', 'application-job.properties'),
  path.join('backend', 'src', 'application-nacos.properties'),
  path.join('backend', 'src', 'bootstrap.properties'),
  path.join('.env')
]

/** 从应用自己的配置中提取密码/密钥并注册到脱敏器（只在内存；不写数据库/日志） */
export function registerAppSecrets(appId: string, dir: string): void {
  const files: Array<{ file: string; text: string }> = []
  let signature = ''
  for (const relative of SECRET_CONFIG_FILES) {
    const file = path.join(dir, relative)
    try {
      const stat = fs.statSync(file)
      signature += `${relative}:${stat.mtimeMs}:${stat.size}|`
      files.push({ file, text: fs.readFileSync(file, 'utf8') })
    } catch {
      // 文件不存在
    }
  }
  if (!files.length || secretSignatures.get(appId) === signature) return
  secretSignatures.set(appId, signature)
  for (const item of files) {
    for (const secret of extractSecrets(item.file, item.text)) registerSecret(secret)
  }
}

/** 从 XML/properties 文本中提取非占位密码/密钥；导出便于单测 */
export function extractSecrets(file: string, text: string): string[] {
  const secrets: string[] = []
  const push = (value: string): void => {
    const clean = value.trim().replace(/^["']|["']$/g, '')
    if (clean.length < 4) return
    if (/^(CHANGE_ME|\*\*\*|\$\{[^}]+\})$/i.test(clean)) return
    secrets.push(clean)
  }
  if (/\.xml$/i.test(file)) {
    const withoutComments = text.replace(/<!--[\s\S]*?-->/g, '')
    const pattern = /<configValue\s+key="[^"]*(?:password|passwd|secret|token|api[_-]?key)[^"]*"\s*>([^<]*)<\/configValue>/gi
    for (const match of withoutComments.matchAll(pattern)) push(match[1])
    return secrets
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue
    const match = /^([\w.-]*(?:password|passwd|secret|token|sys-key|api[_-]?key)[\w.-]*)\s*[:=]\s*(.+)$/i.exec(trimmed)
    if (match) push(match[2])
  }
  return secrets
}

interface DevAppRow {
  id: string
  name: string
  description: string | null
  status: string
  design_confirmed_at: string | null
  completed_at: string | null
  handoff_hash: string | null
}

export interface AppSessionRow {
  id: string
  app_id: string
  stage: string
  opencode_session_id: string | null
  provider_id: string | null
  model_id: string | null
  status: string
  change_set_id: string | null
  handoff_version: number | null
  handoff_hash: string | null
  title: string | null
  note: string | null
  /** U7-1：所属开发阶段（旧会话/null） */
  dev_phase_id: string | null
  created_at: string
  updated_at: string
  last_active_at: string | null
}

export interface DevSessionInfo {
  id: string
  opencodeSessionId: string
  agent: string
  model: ModelRef | null
  status: string
  title: string | null
  note: string | null
  changeSetId: string | null
  handoffVersion: number | null
  handoffHash: string | null
  createdAt: string
  updatedAt: string
  lastActiveAt: string | null
  /** U7-1：会话所属开发阶段（旧会话 null） */
  phase: DevPhaseRef | null
}

/** I-10：左侧会话列表项（工作台记录 + best-effort 合并 opencode 会话信息） */
export interface DevSessionListItem {
  id: string
  opencodeSessionId: string
  title: string | null
  note: string | null
  displayTitle: string
  opencodeTitle: string | null
  status: string
  model: ModelRef | null
  createdAt: string
  updatedAt: string
  lastActiveAt: string | null
  changeSetId: string | null
  changeSetSeq: number | null
  changeSetTitle: string | null
  changeSetStatus: string | null
  handoffVersion: number | null
  handoffHash: string | null
  /** U7-1：阶段标签（列表展示；旧会话为 null） */
  phaseId: string | null
  phaseKey: string | null
  phaseTitle: string | null
  phaseOrder: number | null
  phaseStatus: string | null
  /** M6b：阶段所属模块（应用级阶段为 null） */
  phaseKind: string | null
  phaseModuleId: string | null
  phaseModuleKey: string | null
  phaseModuleTitle: string | null
  phaseParentKey: string | null
  /** opencode 侧是否仍存在该会话；opencode 不可用时为 null（不误判 stale） */
  opencodeExists: boolean | null
  active: boolean
}

export interface DevSessionListResponse {
  sessions: DevSessionListItem[]
  activeSessionId: string | null
  handoffVersion: number | null
}

export interface DevPending {
  permissions: unknown[]
  forms: unknown[]
}

export interface DevSessionState extends DevProgress {
  pending: DevPending
}

export interface DevStateResponse {
  app: {
    id: string
    name: string
    status: string
    completedAt: string | null
    handoff: {
      version: number
      hash: string
      createdAt: string
      changeSet?: { id: string; seq: number; title: string; status: string } | null
    } | null
  }
  session: DevSessionInfo | null
  state: DevSessionState | null
  defaultPrompt: string
  handoffReady: boolean
  readOnly: boolean
  /** U7-1：最新交接包的阶段摘要（未生成时为空数组；阶段接口返回完整信息） */
  phases: DevPhaseRef[]
  staleSession?: boolean
}

function httpError(status: number, message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number }
  error.status = status
  return error
}

/** 开发服务内部/阶段服务共用：应用不存在 → 404 */
export function appOrThrow(appId: string): DevAppRow {
  const row = db
    .prepare(
      'SELECT id, name, description, status, design_confirmed_at, completed_at, handoff_hash FROM apps WHERE id = ?'
    )
    .get(appId) as DevAppRow | undefined
  if (!row) throw httpError(404, `应用不存在：${appId}`)
  return row
}

function handoffOf(app: DevAppRow): DevStateResponse['app']['handoff'] {
  return designHandoffSummary(app.id)
}

function promptOf(app: DevAppRow, handoff: DevStateResponse['app']['handoff']): string {
  return buildDevPrompt(handoff as HandoffLike | null)
}

/** 阶段服务共用：开发阶段就绪校验（设计已确认 + 应用目录/交接包入口存在） */
export function assertDevReady(app: DevAppRow): void {
  if (!app.design_confirmed_at) throw httpError(409, '请先完成设计阶段并生成交接包')
  if (app.status !== 'development' && app.status !== 'completed') {
    throw httpError(409, `当前不是开发阶段（${app.status}）`)
  }
  const dir = appDirOf(app.id)
  if (!fs.existsSync(dir)) throw httpError(409, `应用目录不存在：${dir}`)
  if (!fs.existsSync(path.join(dir, HANDOFF_ENTRY))) {
    throw httpError(409, '交接包不存在；请先在“交接包”中生成 docs/handoff/00-README.md')
  }
}

function activeRow(appId: string): AppSessionRow | undefined {
  return db
    .prepare(`SELECT * FROM app_sessions WHERE app_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`)
    .get(appId) as AppSessionRow | undefined
}

function sessionRowById(id: string): AppSessionRow | undefined {
  return db.prepare('SELECT * FROM app_sessions WHERE id = ?').get(id) as AppSessionRow | undefined
}

function sessionRowOrThrow(appId: string, sid: string): AppSessionRow {
  const row = db.prepare('SELECT * FROM app_sessions WHERE id = ? AND app_id = ?').get(sid, appId) as
    | AppSessionRow
    | undefined
  if (!row) throw httpError(404, `会话不存在：${sid}`)
  return row
}

function two(value: number): string {
  return String(value).padStart(2, '0')
}

/** 会话默认标题/显示时间：MM-DD HH:mm（服务端本地时区） */
export function dateTimeLabel(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`
}

function defaultSessionTitle(app: DevAppRow, createdAt: string): string {
  return `${app.name} 开发 · ${dateTimeLabel(createdAt)}`
}

interface ChangeSetMeta {
  seq: number
  title: string
  status: string
}

function changeSetsById(ids: string[]): Map<string, ChangeSetMeta> {
  const map = new Map<string, ChangeSetMeta>()
  const unique = [...new Set(ids.filter(id => Boolean(id)))]
  if (!unique.length) return map
  const rows = db
    .prepare(`SELECT id, seq, title, status FROM app_change_sets WHERE id IN (${unique.map(() => '?').join(',')})`)
    .all(...unique) as Array<ChangeSetMeta & { id: string }>
  for (const row of rows) map.set(row.id, { seq: row.seq, title: row.title, status: row.status })
  return map
}

function sessionItemOf(
  app: DevAppRow,
  row: AppSessionRow,
  opencodeSessions: Map<string, { title?: string }> | null,
  changeSets: Map<string, ChangeSetMeta>,
  phases: Map<string, DevPhaseRef>
): DevSessionListItem {
  const opencodeId = row.opencode_session_id ?? ''
  const opencodeInfo = opencodeId && opencodeSessions ? opencodeSessions.get(opencodeId) ?? null : null
  const opencodeTitle = typeof opencodeInfo?.title === 'string' && opencodeInfo.title.trim() ? opencodeInfo.title.trim() : null
  const workbenchTitle = row.title?.trim() || null
  const changeSet = row.change_set_id ? changeSets.get(row.change_set_id) ?? null : null
  const phase = row.dev_phase_id ? phases.get(row.dev_phase_id) ?? null : null
  return {
    id: row.id,
    opencodeSessionId: opencodeId,
    title: workbenchTitle,
    note: row.note?.trim() || null,
    displayTitle: workbenchTitle ?? opencodeTitle ?? `${app.name} · ${dateTimeLabel(row.created_at)}`,
    opencodeTitle,
    status: row.status,
    model: modelOf(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at,
    changeSetId: row.change_set_id ?? null,
    changeSetSeq: changeSet?.seq ?? null,
    changeSetTitle: changeSet?.title ?? null,
    changeSetStatus: changeSet?.status ?? null,
    handoffVersion: row.handoff_version ?? null,
    handoffHash: row.handoff_hash ?? null,
    phaseId: phase?.id ?? null,
    phaseKey: phase?.key ?? null,
    phaseTitle: phase?.title ?? null,
    phaseOrder: phase?.order ?? null,
    phaseStatus: phase?.status ?? null,
    phaseKind: phase?.kind ?? null,
    phaseModuleId: phase?.moduleId ?? null,
    phaseModuleKey: phase?.moduleKey ?? null,
    phaseModuleTitle: phase?.moduleTitle ?? null,
    phaseParentKey: phase?.parentKey ?? null,
    opencodeExists: opencodeSessions ? Boolean(opencodeInfo) : null,
    active: row.status === 'active'
  }
}

function archiveActive(appId: string): void {
  db.prepare(`UPDATE app_sessions SET status = 'archived', updated_at = ? WHERE app_id = ? AND status = 'active'`).run(nowIso(), appId)
}

function markStale(row: AppSessionRow): void {
  db.prepare(`UPDATE app_sessions SET status = 'stale', updated_at = ? WHERE id = ?`).run(nowIso(), row.id)
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

function modelOf(row: AppSessionRow): ModelRef | null {
  if (!row.provider_id || !row.model_id) return null
  return { providerID: row.provider_id, id: row.model_id }
}

// ---- I-09a：上下文健康度 ----

/** 模型上下文上限缓存：同一 directory+model 60s 内只查一次 /api/model */
const MODEL_LIMIT_TTL_MS = 60_000
const modelLimitCache = new Map<string, { value: number | null; at: number }>()

/** 测试用：清空模型上限缓存 */
export function clearDevModelLimitCache(): void {
  modelLimitCache.clear()
}

/** 从 opencode 模型的 `limit` 里取 `context`（token 上限）；缺失/非法为 null */
export function contextLimitOf(limit: unknown): number | null {
  if (!limit || typeof limit !== 'object') return null
  const context = (limit as Record<string, unknown>).context
  if (typeof context !== 'number' || !Number.isFinite(context) || context <= 0) return null
  return Math.round(context)
}

/** 由 used/limit 计算 percent 与 level（阈值 60% 黄 / 85% 红） */
export function contextWithLimit(used: number, limit: number | null): DevContextUsage {
  const safeUsed = Number.isFinite(used) && used > 0 ? used : 0
  if (!limit || !Number.isFinite(limit) || limit <= 0) {
    return { used: safeUsed, limit: null, percent: null, level: 'unknown' }
  }
  const percent = safeUsed / limit
  const level: DevContextLevel = percent >= 0.85 ? 'danger' : percent >= 0.6 ? 'warn' : 'ok'
  return { used: safeUsed, limit, percent, level }
}

/**
 * 查询会话模型的上下限。opencode 未就绪时不主动启动（健康度不是关键路径），直接按未知返回；
 * 命中 60s 缓存，避免每轮刷新都拉模型列表。
 */
async function modelContextLimit(
  directory: string,
  providerID: string | null,
  modelID: string | null
): Promise<number | null> {
  if (!providerID || !modelID) return null
  const key = `${directory}|${providerID}/${modelID}`
  const cached = modelLimitCache.get(key)
  if (cached && Date.now() - cached.at < MODEL_LIMIT_TTL_MS) return cached.value
  if (!opencode.status().ready) return null
  let value: number | null = null
  try {
    const models = await opencode.listModels(directory)
    const found = models.find(model => model.providerID === providerID && (model.modelID === modelID || model.id === modelID))
    value = contextLimitOf(found?.limit)
  } catch {
    value = null
  }
  modelLimitCache.set(key, { value, at: Date.now() })
  return value
}

function sessionInfoOf(row: AppSessionRow): DevSessionInfo {
  return {
    id: row.id,
    opencodeSessionId: row.opencode_session_id ?? '',
    agent: 'build',
    model: modelOf(row),
    status: row.status,
    title: row.title?.trim() || null,
    note: row.note?.trim() || null,
    changeSetId: row.change_set_id ?? null,
    handoffVersion: row.handoff_version ?? null,
    handoffHash: row.handoff_hash ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at,
    phase: phaseRefById(row.dev_phase_id)
  }
}

async function stateFor(app: DevAppRow, row: AppSessionRow): Promise<DevSessionState | null> {
  registerAppSecrets(app.id, appDirOf(app.id))
  if (!row.opencode_session_id) return null
  const info = await opencode.session(row.opencode_session_id).catch(() => null)
  if (!info) {
    markStale(row)
    return null
  }
  const messages = await opencode.messages(row.opencode_session_id, { limit: 200, order: 'asc' })
  await opencode.refreshPending(row.opencode_session_id).catch(() => undefined)
  const pending = opencode.pendingFor(row.opencode_session_id)
  const progress = buildProgress({
    info: info as unknown as Record<string, unknown>,
    messages: messages.data,
    appDir: appDirOf(app.id)
  })
  // I-09a：used 来自最新 assistant 消息；limit/percent/level 由模型元数据补齐（archived 只读会话同样适用）
  const dir = appDirOf(app.id)
  const limit = await modelContextLimit(dir, row.provider_id, row.model_id)
  return {
    ...progress,
    context: contextWithLimit(progress.context.used, limit),
    pending: {
      permissions: redactDeep(pending.permissions),
      forms: redactDeep(pending.forms)
    }
  }
}

export async function getDevState(appId: string, options: { sessionId?: string } = {}): Promise<DevStateResponse> {
  const app = appOrThrow(appId)
  assertDevReady(app)
  const row = options.sessionId ? sessionRowOrThrow(appId, options.sessionId) : activeRow(appId)
  const handoff = handoffOf(app)
  const base = {
    app: {
      id: app.id,
      name: app.name,
      status: app.status,
      completedAt: app.completed_at,
      handoff
    },
    defaultPrompt: promptOf(app, handoff),
    handoffReady: true,
    readOnly: false,
    phases: latestPhaseRefs(appId)
  }
  if (!row) return { ...base, session: null, state: null }

  const readOnly = row.status !== 'active'
  const state = await stateFor(app, row)
  if (!state) {
    const current = sessionRowById(row.id) ?? row
    // 未指定 sessionId 时保持原有 stale 行为（前端显示“开始开发/新会话”）
    if (!options.sessionId) return { ...base, session: null, state: null, staleSession: true, readOnly: true }
    return { ...base, session: sessionInfoOf(current), state: null, staleSession: true, readOnly: true }
  }
  return { ...base, session: sessionInfoOf(row), state, readOnly }
}

/** I-10：列出应用全部开发会话（含归档/失效），best-effort 合并 opencode 会话标题/存在性 */
export async function listDevSessions(appId: string): Promise<DevSessionListResponse> {
  const app = appOrThrow(appId)
  const rows = db
    .prepare('SELECT * FROM app_sessions WHERE app_id = ? ORDER BY created_at DESC')
    .all(appId) as AppSessionRow[]
  const changeSets = changeSetsById(rows.map(row => row.change_set_id).filter((id): id is string => Boolean(id)))
  const phases = phaseRefsByIds(rows.map(row => row.dev_phase_id))

  let opencodeSessions: Map<string, { title?: string }> | null = null
  try {
    const status = opencode.status()
    // 不为了列表去启动 opencode；未运行/未确认安装时返回 null，前端不据此误判 stale
    if (status.ready || status.starting) {
      const list = await opencode.listSessions(appDirOf(appId), 100)
      opencodeSessions = new Map(list.map(session => [session.id, session]))
    }
  } catch {
    opencodeSessions = null
  }

  const sessions = rows.map(row => sessionItemOf(app, row, opencodeSessions, changeSets, phases))
  const handoff = handoffOf(app)
  return {
    sessions,
    activeSessionId: sessions.find(item => item.active)?.id ?? null,
    handoffVersion: handoff?.version ?? null
  }
}

/** I-10：切换 active；当前 active 先 best-effort 停止再归档，目标 opencode 不存在则标记 stale */
export async function activateDevSession(appId: string, sid: string): Promise<DevStateResponse> {
  const app = appOrThrow(appId)
  assertDevReady(app)
  const row = sessionRowOrThrow(appId, sid)
  if (!row.opencode_session_id) {
    markStale(row)
    throw httpError(409, '会话已失效，请新建会话')
  }
  const info = await opencode.session(row.opencode_session_id).catch(() => null)
  if (!info) {
    markStale(row)
    throw httpError(409, '会话已失效，请新建会话')
  }

  const current = activeRow(appId)
  if (current && current.id === row.id && row.status === 'active') {
    return getDevState(appId, { sessionId: row.id })
  }

  if (current && current.id !== row.id) {
    if (current.opencode_session_id) {
      // 避免两个会话同时写应用目录：切换前尽力停止当前会话，失败不阻塞用户操作
      await opencode.interrupt(current.opencode_session_id, true).catch(() => undefined)
    }
    db.prepare(`UPDATE app_sessions SET status = 'archived', updated_at = ? WHERE id = ? AND status = 'active'`).run(
      nowIso(),
      current.id
    )
  }

  const now = nowIso()
  db.prepare(`UPDATE app_sessions SET status = 'active', updated_at = ? WHERE id = ?`).run(now, row.id)
  recordEvent(appId, 'session-activated', {
    sessionId: row.id,
    opencodeSessionId: row.opencode_session_id,
    previousSessionId: current?.id ?? null
  })
  return getDevState(appId, { sessionId: row.id })
}

/** I-10：重命名/备注（只改工作台记录，不改 opencode 标题；空字符串清除） */
export async function renameDevSession(
  appId: string,
  sid: string,
  patch: { title?: unknown; note?: unknown }
): Promise<DevSessionListItem> {
  const app = appOrThrow(appId)
  const row = sessionRowOrThrow(appId, sid)
  const updates: string[] = []
  const values: unknown[] = []
  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    if (patch.title !== null && typeof patch.title !== 'string') throw httpError(400, 'title 必须为字符串')
    const title = typeof patch.title === 'string' ? patch.title.trim() : ''
    if (title.length > 120) throw httpError(400, 'title 最多 120 字符')
    updates.push('title = ?')
    values.push(title || null)
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'note')) {
    if (patch.note !== null && typeof patch.note !== 'string') throw httpError(400, 'note 必须为字符串')
    const note = typeof patch.note === 'string' ? patch.note.trim() : ''
    if (note.length > 500) throw httpError(400, 'note 最多 500 字符')
    updates.push('note = ?')
    values.push(note || null)
  }
  if (!updates.length) throw httpError(400, 'title/note 至少提供一个')
  db.prepare(`UPDATE app_sessions SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(...values, nowIso(), row.id)

  const list = await listDevSessions(app.id)
  const item = list.sessions.find(session => session.id === row.id)
  if (!item) throw httpError(404, `会话不存在：${sid}`)
  return item
}

/** I-10：归档指定会话（幂等；active 先 best-effort 停止；不删除 opencode 数据） */
export async function archiveDevSessionById(
  appId: string,
  sid: string
): Promise<{ ok: true; sessionId: string; status: 'archived' }> {
  appOrThrow(appId)
  const row = sessionRowOrThrow(appId, sid)
  if (row.status === 'archived') return { ok: true, sessionId: row.id, status: 'archived' }
  if (row.status === 'active' && row.opencode_session_id) {
    await opencode.interrupt(row.opencode_session_id, true).catch(() => undefined)
  }
  db.prepare(`UPDATE app_sessions SET status = 'archived', updated_at = ? WHERE id = ?`).run(nowIso(), row.id)
  recordEvent(appId, 'session-archived', { sessionId: row.id, opencodeSessionId: row.opencode_session_id })
  return { ok: true, sessionId: row.id, status: 'archived' }
}

export interface CreateDevSessionOptions {
  /** 归档当前 active 后新建 */
  new?: boolean
  /** U7-1：阶段会话标签 */
  devPhaseId?: string | null
  /** 自定义会话标题（阶段会话：`<应用名> 开发 · 阶段 N <title>`） */
  title?: string | null
  /** 自定义首条提示（阶段 brief）；不自动发送 */
  defaultPrompt?: string | null
}

export async function createDevSession(appId: string, options: CreateDevSessionOptions = {}): Promise<DevStateResponse> {
  const app = appOrThrow(appId)
  assertDevReady(app)
  if (!options.new) {
    const existing = activeRow(appId)
    if (existing) {
      const state = await stateFor(app, existing)
      if (state) {
        const handoff = handoffOf(app)
        return {
          app: {
            id: app.id,
            name: app.name,
            status: app.status,
            completedAt: app.completed_at,
            handoff
          },
          session: sessionInfoOf(existing),
          state,
          defaultPrompt: options.defaultPrompt ?? promptOf(app, handoff),
          handoffReady: true,
          readOnly: false,
          phases: latestPhaseRefs(appId)
        }
      }
    }
  }

  const dir = appDirOf(appId)
  const agents = await opencode.listAgents(dir).catch(() => [])
  if (agents.length && !agents.some(agent => agent.id === 'build')) {
    throw httpError(409, '该应用目录下没有 opencode 原生 build agent')
  }
  const model = await resolveChatModel(appId, 'development', dir)
  const session = await opencode.createSession({
    directory: dir,
    title: options.title?.trim() || `${app.name} 开发`,
    agent: 'build',
    model
  })
  const now = nowIso()
  const handoff = handoffOf(app)
  const row: AppSessionRow = {
    id: randomUUID(),
    app_id: appId,
    stage: 'development',
    opencode_session_id: session.id,
    provider_id: model?.providerID ?? null,
    model_id: model?.id ?? null,
    status: 'active',
    change_set_id: handoff?.changeSet?.id ?? null,
    handoff_version: handoff?.version ?? null,
    handoff_hash: handoff?.hash ?? null,
    title: options.title?.trim() || defaultSessionTitle(app, now),
    note: null,
    dev_phase_id: options.devPhaseId ?? null,
    created_at: now,
    updated_at: now,
    last_active_at: null
  }
  db.prepare(`
    INSERT INTO app_sessions
      (id, app_id, stage, opencode_session_id, provider_id, model_id, status,
       change_set_id, handoff_version, handoff_hash, title, note, dev_phase_id, created_at, updated_at, last_active_at)
    VALUES (@id, @app_id, @stage, @opencode_session_id, @provider_id, @model_id, @status,
       @change_set_id, @handoff_version, @handoff_hash, @title, @note, @dev_phase_id, @created_at, @updated_at, @last_active_at)
  `).run(row)
  if (options.new) {
    // 新会话创建成功后再归档旧会话，避免创建失败导致当前会话丢失
    db.prepare(`UPDATE app_sessions SET status = 'archived', updated_at = ? WHERE app_id = ? AND id <> ? AND status = 'active'`).run(
      now,
      appId,
      row.id
    )
  }
  opencode.track(session.id)
  recordEvent(appId, 'session-started', { sessionId: row.id, opencodeSessionId: session.id, devPhaseId: row.dev_phase_id })
  return {
    app: {
      id: app.id,
      name: app.name,
      status: app.status,
      completedAt: app.completed_at,
      handoff
    },
    session: sessionInfoOf(row),
    state: await stateFor(app, row),
    defaultPrompt: options.defaultPrompt ?? promptOf(app, handoff),
    handoffReady: true,
    readOnly: false,
    phases: latestPhaseRefs(appId)
  }
}

export async function archiveDevSession(appId: string): Promise<{ ok: true }> {
  appOrThrow(appId)
  archiveActive(appId)
  recordEvent(appId, 'session-archived')
  return { ok: true }
}

function activeOrThrow(appId: string): AppSessionRow {
  const row = activeRow(appId)
  if (!row?.opencode_session_id) throw httpError(409, '当前没有开发会话，请先开始开发')
  return row
}

/** 完成后再发消息：只恢复应用状态，变更单保持 completed（纯开发修复不属于 Change Set） */
export function resumeCompletedApp(appId: string): void {
  const now = nowIso()
  db.prepare(`UPDATE apps SET status = 'development', completed_at = NULL, updated_at = ? WHERE id = ?`).run(now, appId)
  recordEvent(appId, 'resumed', { reason: 'prompt-after-completion' })
}

export interface DevPromptResult {
  ok: true
  /** U7-1：若阶段因发消息自动重新打开，返回阶段与提示 */
  phase?: DevPhaseRef
  warning?: string
}

export async function promptDevSession(appId: string, text: string): Promise<DevPromptResult> {
  const app = appOrThrow(appId)
  assertDevReady(app)
  const content = text.trim()
  if (!content) throw httpError(400, 'text 不能为空')
  if (content.length > MAX_PROMPT_CHARS) throw httpError(413, `消息过长（${content.length} 字符）`)
  const row = activeOrThrow(appId)

  if (app.status === 'completed') resumeCompletedApp(appId)

  await opencode.prompt(row.opencode_session_id as string, content)
  const now = nowIso()
  db.prepare('UPDATE app_sessions SET last_active_at = ?, updated_at = ? WHERE id = ?').run(now, now, row.id)
  recordEvent(appId, 'prompt', { sessionId: row.id, length: content.length })
  // U7-1：向已完成/已跳过阶段的会话发消息 → 自动回到进行中（不改 apps.status）
  const reopened = reopenPhaseForPrompt(appId, row.dev_phase_id)
  if (reopened.phase) return { ok: true, phase: reopened.phase, warning: reopened.warning ?? undefined }
  return { ok: true }
}

export async function interruptDevSession(appId: string): Promise<{ ok: true }> {
  appOrThrow(appId)
  const row = activeOrThrow(appId)
  await opencode.interrupt(row.opencode_session_id as string, true)
  const now = nowIso()
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(now, row.id)
  recordEvent(appId, 'interrupt', { sessionId: row.id })
  return { ok: true }
}

/**
 * I-09a：请求 opencode 原生 compact（用户手动触发，不自动）。
 * 没有 active 会话 → 409；opencode 错误按可读信息透传（不裸抛 500）。
 */
export async function compactDevSession(appId: string): Promise<{ ok: true; message: string }> {
  const app = appOrThrow(appId)
  assertDevReady(app)
  const row = activeRow(appId)
  if (!row?.opencode_session_id) throw httpError(409, '当前没有进行中的开发会话')
  await opencode.compactSession(row.opencode_session_id)
  const now = nowIso()
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(now, row.id)
  recordEvent(appId, 'context-compacted', {
    sessionId: row.id,
    opencodeSessionId: row.opencode_session_id
  })
  return { ok: true, message: '已请求压缩上下文，将在下一步生效' }
}

export async function replyDevPermission(appId: string, requestId: string, decision: string, message?: string): Promise<{ ok: true }> {
  if (!['once', 'always', 'reject'].includes(decision)) throw httpError(400, 'decision 只能是 once/always/reject')
  appOrThrow(appId)
  const row = activeOrThrow(appId)
  await opencode.replyPermission(row.opencode_session_id as string, requestId, decision, message)
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(nowIso(), row.id)
  return { ok: true }
}

export async function replyDevForm(appId: string, formId: string, answer: unknown): Promise<{ ok: true }> {
  appOrThrow(appId)
  const row = activeOrThrow(appId)
  await opencode.replyForm(row.opencode_session_id as string, formId, answer)
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(nowIso(), row.id)
  return { ok: true }
}

/** SSE 事件流入口使用：返回当前 active 会话的 opencode 会话 ID */
export function activeOpencodeSessionId(appId: string): string | null {
  appOrThrow(appId)
  const row = activeRow(appId)
  return row?.opencode_session_id ?? null
}

/** 测试/诊断：会话行（不触发 opencode 调用） */
export function activeSessionRow(appId: string): AppSessionRow | undefined {
  return activeRow(appId)
}
