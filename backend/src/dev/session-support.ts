/**
 * 会话/时间线共享底层（P7-7b-1）
 *
 * 应用三视图（`dev/service.ts`）与模板工作室（`design-template/studio.ts`）共用同一套
 * 会话列表/状态/进度读取逻辑；本模块**不含应用语义**（不查 `apps` 表、不读应用凭据）：
 * - 调用方给出目录（应用工作区 / 工作室根）；
 * - 类型与 `dev/service.ts` 原有导出保持兼容（后者再 re-export）。
 *
 * 这样工作室不需要复制 `dev/service.ts`，也不会改变应用对外行为。
 */
import { opencode } from '../opencode/runtime'
import { redactDeep } from '../opencode/redact'
import { viewOf, type AppSessionRow, type SessionView } from '../sessions/store'
import { buildProgress, type DevContextLevel, type DevContextUsage, type DevProgress } from './timeline'
import type { ModelRef } from '../chat/service'

export type SessionModel = ModelRef

export interface SessionPending {
  permissions: unknown[]
  forms: unknown[]
}

export interface SessionState extends DevProgress {
  pending: SessionPending
}

export interface SessionInfo {
  id: string
  opencodeSessionId: string
  agent: string
  model: ModelRef | null
  status: string
  title: string | null
  note: string | null
  view: SessionView
  createdAt: string
  updatedAt: string
  lastActiveAt: string | null
}

export interface SessionListItem {
  id: string
  opencodeSessionId: string
  title: string | null
  note: string | null
  displayTitle: string
  opencodeTitle: string | null
  status: string
  model: ModelRef | null
  view: SessionView
  createdAt: string
  updatedAt: string
  lastActiveAt: string | null
  /** opencode 侧是否仍存在该会话；opencode 不可用时为 null（不误判 stale） */
  opencodeExists: boolean | null
  active: boolean
}

export interface SessionList {
  sessions: SessionListItem[]
  activeSessionId: string | null
  view: SessionView
}

export function httpError(status: number, message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number }
  error.status = status
  return error
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

export function viewLabel(view: SessionView): string {
  if (view === 'requirements') return '需求'
  if (view === 'design') return '设计'
  if (view === 'template') return '模板'
  return '开发'
}

export function modelOf(row: AppSessionRow): ModelRef | null {
  if (!row.provider_id || !row.model_id) return null
  return { providerID: row.provider_id, id: row.model_id }
}

export function sessionItemOf(
  targetName: string,
  row: AppSessionRow,
  opencodeSessions: Map<string, { title?: string }> | null
): SessionListItem {
  const opencodeId = row.opencode_session_id ?? ''
  const opencodeInfo = opencodeId && opencodeSessions ? opencodeSessions.get(opencodeId) ?? null : null
  const opencodeTitle = typeof opencodeInfo?.title === 'string' && opencodeInfo.title.trim() ? opencodeInfo.title.trim() : null
  const workbenchTitle = row.title?.trim() || null
  const view = viewOf(row)
  return {
    id: row.id,
    opencodeSessionId: opencodeId,
    title: workbenchTitle,
    note: row.note?.trim() || null,
    displayTitle: workbenchTitle ?? opencodeTitle ?? `${targetName} ${viewLabel(view)} · ${dateTimeLabel(row.created_at)}`,
    opencodeTitle,
    status: row.status,
    model: modelOf(row),
    view,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at,
    opencodeExists: opencodeSessions ? Boolean(opencodeInfo) : null,
    active: row.status === 'active'
  }
}

export function sessionInfoOf(row: AppSessionRow): SessionInfo {
  return {
    id: row.id,
    opencodeSessionId: row.opencode_session_id ?? '',
    agent: 'build',
    model: modelOf(row),
    status: row.status,
    title: row.title?.trim() || null,
    note: row.note?.trim() || null,
    view: viewOf(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at
  }
}

// ---- 上下文健康度（沿用 I-09a 机器，按会话/视图通用） ----

const MODEL_LIMIT_TTL_MS = 60_000
const modelLimitCache = new Map<string, { value: number | null; at: number }>()

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
  const percent = (safeUsed as number) / limit
  const level: DevContextLevel = percent >= 0.85 ? 'danger' : percent >= 0.6 ? 'warn' : 'ok'
  return { used: safeUsed, limit, percent, level }
}

export async function modelContextLimit(
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

export interface SessionStateOptions {
  /** opencode 会话不存在（opencode 侧丢失）时回调，通常标记 DB 行为 stale */
  onMissing?(): void
}

/** 读取会话时间线 + 待处理权限/表单（不登记应用凭据；调用方按需先注册） */
export async function stateForSession(
  directory: string,
  row: AppSessionRow,
  options: SessionStateOptions = {}
): Promise<SessionState | null> {
  if (!row.opencode_session_id) return null
  const info = await opencode.session(row.opencode_session_id).catch(() => null)
  if (!info) {
    options.onMissing?.()
    return null
  }
  const messages = await opencode.messages(row.opencode_session_id, { limit: 200, order: 'asc' })
  await opencode.refreshPending(row.opencode_session_id).catch(() => undefined)
  const pending = opencode.pendingFor(row.opencode_session_id)
  const progress = buildProgress({
    info: info as unknown as Record<string, unknown>,
    messages: messages.data,
    appDir: directory
  })
  const limit = await modelContextLimit(directory, row.provider_id, row.model_id)
  return {
    ...progress,
    context: contextWithLimit(progress.context.used, limit),
    pending: {
      permissions: redactDeep(pending.permissions),
      forms: redactDeep(pending.forms)
    }
  }
}
