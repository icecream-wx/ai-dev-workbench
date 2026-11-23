/**
 * 会话服务（每视图一个活跃会话 + 历史）
 *
 * - 开发视图沿用完整会话列表/时间线/权限/表单/compact；
 * - 需求/设计视图共用同一套存储与状态读取（`?view=` 过滤）；
 * - 不做交接包/阶段/变更单门禁：应用目录存在即可对话。
 */
import fs from 'node:fs'
import path from 'node:path'
import { db, nowIso } from '../db'
import { appDirOf } from '../apps/scaffold'
import { opencode } from '../opencode/runtime'
import { registerSecret } from '../opencode/redact'
import { resolveChatModel, buildViewPrompt, type ModelRef } from '../chat/service'
import { CHINESE_INSTRUCTION } from '../chat/prompts'
import { developmentDigestForPrompt } from './digest'
import type { DevProgress } from './timeline'
import {
  dateTimeLabel,
  httpError,
  sessionInfoOf,
  sessionItemOf,
  stateForSession,
  viewLabel,
  type SessionInfo,
  type SessionList,
  type SessionListItem,
  type SessionPending,
  type SessionState
} from './session-support'
import {
  activeSessionRow,
  archiveActiveSessions,
  createSessionRow,
  isAppView,
  listSessionRows,
  sessionRowById,
  sessionRowOrThrow,
  setSessionActive,
  setSessionArchived,
  setSessionStale,
  touchSession,
  viewOf,
  type AppSessionRow,
  type AppView
} from '../sessions/store'

/** 开发视图首条提示：先读工作区产物与现有代码，不指向交接包 */
const DEFAULT_DEV_PROMPT =
  '请先阅读 AGENTS.md、docs/requirements/ 与 docs/design/ 下的设计参考：' +
  'docs/design/design-system.json（应用设计系统/页面库）、docs/design/<MOD>/design.json（数据模型/页面契约）、' +
  'design-brief.md、tokens.json、prototypes/*.png（模板风格截图；无显式契约的旧设计为线框）以及 docs/design/template/ 下的蓝图与样式。' +
  '优先级：需求 > design-system/design.json 契约 > 蓝图（布局/组件） > design-brief/tokens（视觉变量） > PNG（模板风格截图）；' +
  '冲突先报告，偏离必须说明，PNG 过期时不要盲从旧图。' +
  '实现前先填写 docs/design/<MOD>/ui-check.md 的对照表（软门禁，不阻断），再从蓝图复制页面到 frontend/src/views/，' +
  '保留结构/样式/组件并替换 mock/接口；使用 PageTemplates、宿主 pm-* 与 src/preferences/GlobalPreference.js，禁止自造 UI 替代模板。' +
  'pm-* 由 AFCenter 宿主全局提供，不重复注册；tokens/PNG 只约束 Vue3 前端，EOS 后端不吃风格。' +
  '完成后请总结：实现摘要、关键文件、页面与蓝图/契约对照结果、偏离与原因、如何运行、自测结果、未解决事项。' +
  CHINESE_INSTRUCTION

function defaultDevPrompt(module?: string): string {
  const key = String(module ?? '').trim()
  return key ? `${DEFAULT_DEV_PROMPT}\n本轮目标模块：${key}。` : DEFAULT_DEV_PROMPT
}

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
  status: string
  created_at: string
}

export type DevSessionInfo = SessionInfo
export type DevSessionListItem = SessionListItem
export type DevSessionListResponse = SessionList
export type DevPending = SessionPending
export type DevSessionState = SessionState

export interface DevStateResponse {
  app: {
    id: string
    name: string
    status: string
    createdAt: string
  }
  session: DevSessionInfo | null
  state: DevSessionState | null
  defaultPrompt: string
  readOnly: boolean
  view: AppView
  staleSession?: boolean
}

/** 应用存在 → 返回登记行；否则 404 */
export function appOrThrow(appId: string): DevAppRow {
  const row = db.prepare('SELECT id, name, status, created_at FROM apps WHERE id = ?').get(appId) as DevAppRow | undefined
  if (!row) throw httpError(404, `应用不存在：${appId}`)
  return row
}

function assertWorkspaceReady(app: DevAppRow): void {
  const dir = appDirOf(app.id)
  if (!fs.existsSync(dir)) throw httpError(409, `应用目录不存在：${dir}`)
}

function defaultSessionTitle(app: DevAppRow, view: AppView, createdAt: string): string {
  return `${app.name} ${viewLabel(view)} · ${dateTimeLabel(createdAt)}`
}

/** 应用会话状态：先按应用目录注册凭据，再复用共享时间线读取 */
async function stateFor(app: DevAppRow, row: AppSessionRow): Promise<DevSessionState | null> {
  registerAppSecrets(app.id, appDirOf(app.id))
  return stateForSession(appDirOf(app.id), row, { onMissing: () => setSessionStale(row.id) })
}

function viewFromOptions(options: { view?: unknown }): AppView {
  return isAppView(options.view) ? options.view : 'development'
}

export async function getDevState(
  appId: string,
  options: { sessionId?: string; view?: unknown } = {}
): Promise<DevStateResponse> {
  const app = appOrThrow(appId)
  assertWorkspaceReady(app)
  const view = viewFromOptions(options)
  const row = options.sessionId ? sessionRowOrThrow(appId, options.sessionId) : activeSessionRow(appId, view)
  const base = {
    app: { id: app.id, name: app.name, status: app.status, createdAt: app.created_at },
    defaultPrompt: defaultDevPrompt(),
    readOnly: false,
    view
  }
  if (!row) return { ...base, session: null, state: null }

  const readOnly = row.status !== 'active'
  const state = await stateFor(app, row)
  if (!state) {
    const current = sessionRowById(row.id) ?? row
    if (!options.sessionId) return { ...base, session: null, state: null, staleSession: true, readOnly: true }
    return { ...base, session: sessionInfoOf(current), state: null, staleSession: true, readOnly: true }
  }
  return { ...base, session: sessionInfoOf(row), state, readOnly }
}

/** 列出应用会话（按视图过滤；best-effort 合并 opencode 标题/存在性） */
export async function listDevSessions(appId: string, options: { view?: unknown } = {}): Promise<DevSessionListResponse> {
  const app = appOrThrow(appId)
  const view = viewFromOptions(options)
  const rows = listSessionRows(appId, view)

  let opencodeSessions: Map<string, { title?: string }> | null = null
  try {
    const status = opencode.status()
    if (status.ready || status.starting) {
      const list = await opencode.listSessions(appDirOf(appId), 100)
      opencodeSessions = new Map(list.map(session => [session.id, session]))
    }
  } catch {
    opencodeSessions = null
  }

  const sessions = rows.map(row => sessionItemOf(app.name, row, opencodeSessions))
  return {
    sessions,
    activeSessionId: sessions.find(item => item.active)?.id ?? null,
    view
  }
}

/** 切换 active（同视图内）；目标 opencode 会话不存在则标记 stale */
export async function activateDevSession(
  appId: string,
  sid: string,
  options: { view?: unknown } = {}
): Promise<DevStateResponse> {
  const app = appOrThrow(appId)
  assertWorkspaceReady(app)
  const row = sessionRowOrThrow(appId, sid)
  const view = viewOf(row)
  if (!row.opencode_session_id) {
    setSessionStale(row.id)
    throw httpError(409, '会话已失效，请新建会话')
  }
  const info = await opencode.session(row.opencode_session_id).catch(() => null)
  if (!info) {
    setSessionStale(row.id)
    throw httpError(409, '会话已失效，请新建会话')
  }

  const current = activeSessionRow(appId, view)
  if (current && current.id === row.id && row.status === 'active') {
    return getDevState(appId, { sessionId: row.id, view })
  }
  if (current && current.id !== row.id) {
    if (current.opencode_session_id) {
      await opencode.interrupt(current.opencode_session_id, true).catch(() => undefined)
    }
    setSessionArchived(current.id)
  }
  setSessionActive(row.id)
  return getDevState(appId, { sessionId: row.id, view: options.view ?? view })
}

/** 重命名/备注（只改工作台记录，不改 opencode 标题；空字符串清除） */
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

  const list = await listDevSessions(app.id, { view: viewOf(row) })
  const item = list.sessions.find(session => session.id === row.id)
  if (!item) throw httpError(404, `会话不存在：${sid}`)
  return item
}

/** 归档指定会话（幂等；active 先 best-effort 停止；不删除 opencode 数据） */
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
  setSessionArchived(row.id)
  return { ok: true, sessionId: row.id, status: 'archived' }
}

export interface CreateDevSessionOptions {
  /** 归档当前 active 后新建 */
  new?: boolean
  view?: unknown
  /** 开发视图当前模块（用于首条提示与 ui-check；可选） */
  module?: unknown
}

export async function createDevSession(appId: string, options: CreateDevSessionOptions = {}): Promise<DevStateResponse> {
  const app = appOrThrow(appId)
  assertWorkspaceReady(app)
  const view = viewFromOptions(options)
  const moduleKey = typeof options.module === 'string' ? options.module.trim() : ''
  if (!options.new) {
    const existing = activeSessionRow(appId, view)
    if (existing) {
      const state = await stateFor(app, existing)
      if (state) {
        return {
          app: { id: app.id, name: app.name, status: app.status, createdAt: app.created_at },
          session: sessionInfoOf(existing),
          state,
          defaultPrompt: defaultDevPrompt(view === 'development' ? moduleKey : ''),
          readOnly: false,
          view
        }
      }
    }
  }

  const dir = appDirOf(appId)
  const agents = await opencode.listAgents(dir).catch(() => [])
  if (agents.length && !agents.some(agent => agent.id === 'build')) {
    throw httpError(409, '该应用目录下没有 opencode 原生 build agent')
  }
  const model = await resolveChatModel(appId, view, dir)
  const session = await opencode.createSession({
    directory: dir,
    title: `${app.name} ${viewLabel(view)}`,
    agent: 'build',
    model
  })
  const now = nowIso()
  const row = createSessionRow({
    appId,
    view,
    opencodeSessionId: session.id,
    title: defaultSessionTitle(app, view, now),
    providerId: model?.providerID ?? null,
    modelId: model?.id ?? null
  })
  if (options.new) archiveActiveSessions(appId, view, row.id)
  opencode.track(session.id)
  return {
    app: { id: app.id, name: app.name, status: app.status, createdAt: app.created_at },
    session: sessionInfoOf(row),
    state: await stateFor(app, row),
    defaultPrompt: defaultDevPrompt(view === 'development' ? moduleKey : ''),
    readOnly: false,
    view
  }
}

export async function archiveDevSession(appId: string, options: { view?: unknown } = {}): Promise<{ ok: true }> {
  appOrThrow(appId)
  archiveActiveSessions(appId, viewFromOptions(options))
  return { ok: true }
}

function activeOrThrow(appId: string, view: AppView): AppSessionRow {
  const row = activeSessionRow(appId, view)
  if (!row?.opencode_session_id) throw httpError(409, `当前没有${viewLabel(view)}会话，请先开始`)
  return row
}

export interface DevPromptResult {
  ok: true
  warning?: string
  /** 本次通过 command 触发时回显命令名 */
  command?: string
}

export interface DevPromptOptions {
  view?: unknown
  /** 需求/设计视图的当前模块 key（透传给 buildViewPrompt） */
  module?: unknown
  /** 存在的 command 名走 opencode `/api/session/:id/command`，text 作为参数 */
  command?: unknown
}

export async function promptDevSession(appId: string, text: string, options: DevPromptOptions = {}): Promise<DevPromptResult> {
  const app = appOrThrow(appId)
  assertWorkspaceReady(app)
  const content = text.trim()
  const view = viewFromOptions(options)
  const command = typeof options.command === 'string' ? options.command.trim() : ''
  const moduleKey = typeof options.module === 'string' ? options.module.trim() : ''
  if (!content && !command) throw httpError(400, 'text 不能为空')
  if (content.length > MAX_PROMPT_CHARS) throw httpError(413, `消息过长（${content.length} 字符）`)
  const row = activeOrThrow(appId, view)

  const sessionID = row.opencode_session_id as string
  if (command) {
    // P0：command 由 opencode 展开 $ARGUMENTS，text 即参数
    await opencode.runCommand(sessionID, command, content)
  } else {
    // 三个视图统一口径：给当前视图/模块 + 去读哪些产物；具体做法交给 skill
    // 开发视图额外注入设计摘要（模块明确时先生成 ui-check 骨架）
    const context =
      view === 'development'
        ? { digest: developmentDigestForPrompt(appId, moduleKey || undefined, appDirOf(appId)) }
        : undefined
    await opencode.prompt(sessionID, buildViewPrompt(view, content, moduleKey || undefined, context))
  }
  touchSession(row.id)
  return { ok: true, ...(command ? { command } : {}) }
}

export async function interruptDevSession(appId: string, options: { view?: unknown } = {}): Promise<{ ok: true }> {
  appOrThrow(appId)
  const row = activeOrThrow(appId, viewFromOptions(options))
  await opencode.interrupt(row.opencode_session_id as string, true)
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(nowIso(), row.id)
  return { ok: true }
}

/** opencode 原生 compact（用户手动触发，不自动） */
export async function compactDevSession(appId: string, options: { view?: unknown } = {}): Promise<{ ok: true; message: string }> {
  const app = appOrThrow(appId)
  assertWorkspaceReady(app)
  const view = viewFromOptions(options)
  const row = activeSessionRow(appId, view)
  if (!row?.opencode_session_id) throw httpError(409, `当前没有进行中的${viewLabel(view)}会话`)
  await opencode.compactSession(row.opencode_session_id)
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(nowIso(), row.id)
  return { ok: true, message: '已请求压缩上下文，将在下一步生效' }
}

export async function replyDevPermission(
  appId: string,
  requestId: string,
  decision: string,
  message?: string,
  options: { view?: unknown } = {}
): Promise<{ ok: true }> {
  if (!['once', 'always', 'reject'].includes(decision)) throw httpError(400, 'decision 只能是 once/always/reject')
  appOrThrow(appId)
  const row = activeOrThrow(appId, viewFromOptions(options))
  await opencode.replyPermission(row.opencode_session_id as string, requestId, decision, message)
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(nowIso(), row.id)
  return { ok: true }
}

export async function replyDevForm(
  appId: string,
  formId: string,
  answer: unknown,
  options: { view?: unknown } = {}
): Promise<{ ok: true }> {
  appOrThrow(appId)
  const row = activeOrThrow(appId, viewFromOptions(options))
  await opencode.replyForm(row.opencode_session_id as string, formId, answer)
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(nowIso(), row.id)
  return { ok: true }
}

/** SSE 事件流入口使用：返回当前活跃会话的 opencode 会话 ID */
export function activeOpencodeSessionId(appId: string, options: { view?: unknown } = {}): string | null {
  appOrThrow(appId)
  const row = activeSessionRow(appId, viewFromOptions(options))
  return row?.opencode_session_id ?? null
}
