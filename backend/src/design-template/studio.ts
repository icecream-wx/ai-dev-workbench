/**
 * 模板工作室会话服务（P7-7b-1）
 *
 * 复用应用三视图的会话存储（`app_sessions`，`view='template'`）、opencode 运行时与时间线：
 * - 每个自定义模板一个合成目标 `__template__:<packId>`（无 FK，不改表）；
 * - 模型 stage=`template`，键 `app.__template__:<packId>.model.template`，不继承应用三视图模型；
 * - 会话/时间线/权限/表单/compact 与 `/development/*` 同口径，但目录固定为工作室根；
 * - agent 只写 `drafts/<packId>/spec.json`（+ notes.md），prompt 与权限在 P7-7b/7c 约束。
 */
import { db, nowIso } from '../db'
import { opencode } from '../opencode/runtime'
import { redact } from '../opencode/redact'
import {
  activeSessionRow,
  archiveActiveSessions,
  createSessionRow,
  listSessionRows,
  sessionRowById,
  sessionRowOrThrow,
  setSessionActive,
  setSessionArchived,
  setSessionStale,
  touchSession,
  viewOf
} from '../sessions/store'
import {
  agentForModelStage,
  resolveChatModel,
  resolveFallbackModel,
  saveStoredModel,
  storedModel,
  verifyTargetAssets,
  type ChatTarget,
  type ModelRef
} from '../chat/service'
import {
  httpError,
  sessionInfoOf,
  sessionItemOf,
  stateForSession,
  type SessionList,
  type SessionListItem,
  type SessionState
} from '../dev/session-support'
import { getDraftDetail, draftSummary, type DraftSummary } from './draft'
import { assertPackId, studioRoot } from './paths'
import { ensureStudioAssets, STUDIO_COMMAND_NAME, STUDIO_SKILL_ID } from './workshop'

const MAX_PROMPT_CHARS = 200_000
const VIEW = 'template' as const

export interface StudioStateResponse {
  /** 工作室视图固定为 template（与 apps 的 AppView 三值区分） */
  view: 'template'
  draft: DraftSummary
  session: ReturnType<typeof sessionInfoOf> | null
  sessions: SessionListItem[]
  activeSessionId: string | null
  state: SessionState | null
  defaultPrompt: string
  spec: Record<string, unknown> | null
  specError: string | null
  validation: DraftSummary['validation']
  readOnly: boolean
  staleSession?: boolean
}

export interface StudioPromptResult {
  ok: true
  warning?: string
  command?: string
}

export function studioTargetId(packId: unknown): string {
  return `__template__:${assertPackId(packId)}`
}

/** 工作室模型设置键（`app_settings`；不改表） */
export function studioModelSettingKey(packId: unknown): string {
  return `app.${studioTargetId(packId)}.model.${VIEW}`
}

export function studioPrompt(packId: string, name: string, text: string): string {
  return [
    '当前工作室：设计模板编写。',
    `当前模板/草稿：${packId}（显示名 ${name}）。`,
    `只允许写 drafts/${packId}/spec.json 与 drafts/${packId}/notes.md；其它文件只读，禁止修改。`,
    '先读 AGENTS.md 与 catalog（index/pages/components/styles/recipes），再读 spec.json（若存在）。',
    '引用必须来自 catalog 的真实 id；contract 页字段必须来自 sampleEntity.fields。',
    `生成用 node .opencode/scripts/generate.cjs --draft ${packId}；不要发布；生成后把 errors/warnings 用中文汇报。`,
    '所有面向用户的文字使用中文。',
    '',
    '用户消息：',
    text
  ].join('\n')
}

/** 工作室首条提示（不自动发送，由 UI 展示） */
export function defaultStudioPrompt(packId: string): string {
  return [
    `当前模板/草稿：${packId}。`,
    '请先读 AGENTS.md 与 catalog（index/pages/components/styles/recipes），了解可用的页面、组件与风格，',
    `再读取 drafts/${packId}/spec.json（若存在）。`,
    '先复述你理解的业务目标与页面清单（reference / contract），只问真正阻塞的问题（≤3 个）；确认后写 spec.json。',
    '只写 spec.json（可选 notes.md）；不要发布。所有面向用户的文字使用中文。'
  ].join('\n')
}

async function opencodeSessionMap(): Promise<Map<string, { title?: string }> | null> {
  try {
    const status = opencode.status()
    if (!status.ready && !status.starting) return null
    const list = await opencode.listSessions(studioRoot(), 100)
    return new Map(list.map(session => [session.id, session]))
  } catch {
    return null
  }
}

/** 校验草稿存在并初始化工作室资产，返回会话目标（prompt/expected/model） */
export async function targetForDraft(packId: unknown): Promise<ChatTarget> {
  const id = assertPackId(packId)
  const draft = draftSummary(id)
  const prepared = await ensureStudioAssets()
  if (prepared.warnings.length) console.warn(`[studio] 工作室资产提示（${id}）：`, prepared.warnings.join('；'))
  return {
    id: studioTargetId(id),
    name: draft.name,
    directory: studioRoot(),
    view: VIEW,
    sessionTitle: () => `${draft.name} · 模板工作室`,
    beforeSession: async () => {
      const result = await ensureStudioAssets()
      return { warnings: result.warnings }
    },
    expectedSkills: () => [STUDIO_SKILL_ID],
    expectedCommands: () => [STUDIO_COMMAND_NAME],
    buildPrompt: (text: string) => studioPrompt(id, draft.name, text),
    allowModule: false
  }
}

async function listSessionsForTarget(target: ChatTarget): Promise<SessionList> {
  const rows = listSessionRows(target.id, VIEW)
  const opencodeSessions = await opencodeSessionMap()
  const sessions = rows.map(row => sessionItemOf(target.name, row, opencodeSessions))
  return {
    sessions,
    activeSessionId: sessions.find(item => item.active)?.id ?? null,
    view: VIEW
  }
}

export async function listStudioSessions(packId: unknown): Promise<SessionList> {
  return listSessionsForTarget(await targetForDraft(packId))
}

export async function studioState(
  packId: unknown,
  options: { sessionId?: string } = {}
): Promise<StudioStateResponse> {
  const id = assertPackId(packId)
  const target = await targetForDraft(id)
  const summary = draftSummary(id)
  const detail = getDraftDetail(id)
  const listed = await listSessionsForTarget(target)
  const row = options.sessionId ? sessionRowOrThrow(target.id, options.sessionId) : activeSessionRow(target.id, VIEW)
  if (row && viewOf(row) !== VIEW) {
    throw httpError(404, `模板工作室会话不存在：${options.sessionId}`)
  }
  const base = {
    view: VIEW,
    draft: summary,
    sessions: listed.sessions,
    activeSessionId: listed.activeSessionId,
    defaultPrompt: defaultStudioPrompt(summary.id),
    spec: detail.spec,
    specError: detail.specError,
    validation: detail.validation,
    readOnly: false
  } as const
  if (!row) return { ...base, session: null, state: null }

  const readOnly = row.status !== 'active'
  const state = await stateForSession(studioRoot(), row)
  if (!state) {
    const current = sessionRowById(row.id) ?? row
    if (!options.sessionId) return { ...base, session: null, state: null, staleSession: true, readOnly: true }
    return { ...base, session: sessionInfoOf(current), state: null, staleSession: true, readOnly: true }
  }
  return { ...base, session: sessionInfoOf(row), state, readOnly }
}

export async function createStudioSession(packId: unknown, options: { new?: boolean } = {}): Promise<StudioStateResponse> {
  const id = assertPackId(packId)
  const target = await targetForDraft(id)
  if (!options.new) {
    const existing = activeSessionRow(target.id, VIEW)
    if (existing) {
      const state = await stateForSession(studioRoot(), existing, { onMissing: () => setSessionStale(existing.id) })
      if (state) return studioState(id)
    }
  }

  const agents = await opencode.listAgents(target.directory).catch(() => [])
  if (agents.length && !agents.some(agent => agent.id === 'build')) {
    throw httpError(409, '工作室目录下没有 opencode 原生 build agent')
  }
  const existing = activeSessionRow(target.id, VIEW)
  if (existing) setSessionArchived(existing.id)

  const model = await resolveChatModel(target.id, VIEW, target.directory)
  const title = target.sessionTitle?.() ?? `${target.name} · 模板工作室`
  let session: { id: string }
  try {
    session = await opencode.createSession({
      directory: target.directory,
      title,
      agent: agentForModelStage(VIEW),
      model
    })
  } catch (error) {
    throw httpError(502, `opencode 未就绪：${redact(error instanceof Error ? error.message : String(error))}`)
  }
  const row = createSessionRow({
    appId: target.id,
    view: VIEW,
    opencodeSessionId: session.id,
    title,
    providerId: model?.providerID ?? null,
    modelId: model?.id ?? null
  })
  if (options.new) archiveActiveSessions(target.id, VIEW, row.id)
  opencode.track(session.id)
  await verifyTargetAssets(target)
  return studioState(id)
}

export async function activateStudioSession(packId: unknown, sid: string): Promise<StudioStateResponse> {
  const id = assertPackId(packId)
  const target = await targetForDraft(id)
  const row = sessionRowOrThrow(target.id, sid)
  if (viewOf(row) !== VIEW) throw httpError(404, `模板工作室会话不存在：${sid}`)
  if (!row.opencode_session_id) {
    setSessionStale(row.id)
    throw httpError(409, '会话已失效，请新建会话')
  }
  const info = await opencode.session(row.opencode_session_id).catch(() => null)
  if (!info) {
    setSessionStale(row.id)
    throw httpError(409, '会话已失效，请新建会话')
  }
  const current = activeSessionRow(target.id, VIEW)
  if (current && current.id === row.id && row.status === 'active') {
    return studioState(id, { sessionId: row.id })
  }
  if (current && current.id !== row.id) {
    if (current.opencode_session_id) {
      await opencode.interrupt(current.opencode_session_id, true).catch(() => undefined)
    }
    setSessionArchived(current.id)
  }
  setSessionActive(row.id)
  return studioState(id, { sessionId: row.id })
}

export async function renameStudioSession(
  packId: unknown,
  sid: string,
  patch: { title?: unknown; note?: unknown }
): Promise<SessionListItem> {
  const id = assertPackId(packId)
  const target = await targetForDraft(id)
  const row = sessionRowOrThrow(target.id, sid)
  if (viewOf(row) !== VIEW) throw httpError(404, `模板工作室会话不存在：${sid}`)
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

  const list = await listSessionsForTarget(target)
  const item = list.sessions.find(session => session.id === row.id)
  if (!item) throw httpError(404, `模板工作室会话不存在：${sid}`)
  return item
}

export async function archiveStudioSessionById(
  packId: unknown,
  sid: string
): Promise<{ ok: true; sessionId: string; status: 'archived' }> {
  const target = await targetForDraft(packId)
  const row = sessionRowOrThrow(target.id, sid)
  if (viewOf(row) !== VIEW) throw httpError(404, `模板工作室会话不存在：${sid}`)
  if (row.status === 'archived') return { ok: true, sessionId: row.id, status: 'archived' }
  if (row.status === 'active' && row.opencode_session_id) {
    await opencode.interrupt(row.opencode_session_id, true).catch(() => undefined)
  }
  setSessionArchived(row.id)
  return { ok: true, sessionId: row.id, status: 'archived' }
}

function activeOrThrow(target: ChatTarget) {
  const row = activeSessionRow(target.id, VIEW)
  if (!row?.opencode_session_id) throw httpError(409, '当前没有进行中的模板工作室会话，请先开始')
  return row
}

export async function promptStudioSession(
  packId: unknown,
  text: string,
  options: { command?: unknown } = {}
): Promise<StudioPromptResult> {
  const target = await targetForDraft(packId)
  const content = text.trim()
  const command = typeof options.command === 'string' ? options.command.trim() : ''
  if (!content && !command) throw httpError(400, 'text 不能为空')
  if (content.length > MAX_PROMPT_CHARS) throw httpError(413, `消息过长（${content.length} 字符）`)
  const row = activeOrThrow(target)
  const sessionID = row.opencode_session_id as string
  if (command) {
    await opencode.runCommand(sessionID, command, content)
  } else {
    await opencode.prompt(sessionID, target.buildPrompt(content, {}))
  }
  touchSession(row.id)
  return { ok: true, ...(command ? { command } : {}) }
}

export async function interruptStudioSession(packId: unknown): Promise<{ ok: true }> {
  const target = await targetForDraft(packId)
  const row = activeOrThrow(target)
  await opencode.interrupt(row.opencode_session_id as string, true)
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(nowIso(), row.id)
  return { ok: true }
}

export async function compactStudioSession(packId: unknown): Promise<{ ok: true; message: string }> {
  const target = await targetForDraft(packId)
  const row = activeSessionRow(target.id, VIEW)
  if (!row?.opencode_session_id) throw httpError(409, '当前没有进行中的模板工作室会话')
  await opencode.compactSession(row.opencode_session_id)
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(nowIso(), row.id)
  return { ok: true, message: '已请求压缩上下文，将在下一步生效' }
}

export async function replyStudioPermission(
  packId: unknown,
  requestId: string,
  decision: string,
  message?: string
): Promise<{ ok: true }> {
  if (!['once', 'always', 'reject'].includes(decision)) throw httpError(400, 'decision 只能是 once/always/reject')
  const target = await targetForDraft(packId)
  const row = activeOrThrow(target)
  await opencode.replyPermission(row.opencode_session_id as string, requestId, decision, message)
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(nowIso(), row.id)
  return { ok: true }
}

export async function replyStudioForm(packId: unknown, formId: string, answer: unknown): Promise<{ ok: true }> {
  const target = await targetForDraft(packId)
  const row = activeOrThrow(target)
  await opencode.replyForm(row.opencode_session_id as string, formId, answer)
  db.prepare('UPDATE app_sessions SET updated_at = ? WHERE id = ?').run(nowIso(), row.id)
  return { ok: true }
}

/** SSE 入口：当前活跃模板工作室会话的 opencode 会话 ID（未开始为 null） */
export async function activeStudioOpencodeSession(packId: unknown): Promise<string | null> {
  const target = await targetForDraft(packId)
  const row = activeSessionRow(target.id, VIEW)
  return row?.opencode_session_id ?? null
}

export interface StudioModelResponse {
  stage: 'template'
  agent: string
  model: ModelRef | null
  fallback: ModelRef | null
}

export async function getStudioModel(packId: unknown): Promise<StudioModelResponse> {
  const target = await targetForDraft(packId)
  let fallback: ModelRef | null = null
  if (opencode.status().ready) {
    fallback = await resolveFallbackModel(target.directory)
  }
  return { stage: VIEW, agent: agentForModelStage(VIEW), model: storedModel(target.id, VIEW), fallback }
}

export async function saveStudioModel(
  packId: unknown,
  value: unknown
): Promise<{ ok: true; stage: 'template'; model: ModelRef | null }> {
  const target = await targetForDraft(packId)
  if (value === null) {
    saveStoredModel(target.id, VIEW, null)
    return { ok: true, stage: VIEW, model: null }
  }
  if (!value || typeof value !== 'object') throw httpError(400, 'model 需要为 {providerID,id} 或 null')
  const provided = value as Record<string, unknown>
  if (typeof provided.providerID !== 'string' || typeof provided.id !== 'string') {
    throw httpError(400, 'model 需要 providerID 和 id')
  }
  let models: Awaited<ReturnType<typeof opencode.listModels>>
  try {
    models = await opencode.listModels(target.directory)
  } catch (error) {
    throw httpError(502, `opencode 未就绪：${redact(error instanceof Error ? error.message : String(error))}`)
  }
  const hit = models.find(
    model => model.providerID === provided.providerID && (model.modelID === provided.id || model.id === provided.id)
  )
  if (!hit) throw httpError(400, `模型不存在或未启用：${provided.providerID}/${provided.id}`)
  const model: ModelRef = { providerID: hit.providerID, id: hit.modelID }
  saveStoredModel(target.id, VIEW, model)
  return { ok: true, stage: VIEW, model }
}
