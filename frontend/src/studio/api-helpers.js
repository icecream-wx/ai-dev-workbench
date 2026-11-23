/**
 * 模板工作室 API 适配纯函数（P7-7b-2a）。
 *
 * - 路径：草稿/工作室/SSE（与后端 §13.3 对齐）；
 * - 状态映射：`StudioStateResponse` → `DevStateResponse`（`AgentChatPanel` 直接复用）；
 * - 错误：保留后端 `{error}` 与 `errors/warnings` payload；
 *
 * 不依赖 Vue / DOM / 网络，便于 node --test（`api.ts` 只负责 fetch/EventSource）。
 */

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function draftBasePath(packId) {
  return `/design-templates/drafts/${encodeURIComponent(text(packId))}`
}

export function studioBasePath(packId) {
  return `${draftBasePath(packId)}/studio`
}

export function studioEventsUrl(packId) {
  return `/api${studioBasePath(packId)}/events`
}

function toDevSession(session) {
  if (!session || typeof session !== 'object') return null
  return { ...session, view: 'template' }
}

function toDevListItem(item) {
  if (!item || typeof item !== 'object') return { view: 'template' }
  return { ...item, view: 'template' }
}

/** `StudioStateResponse` → `DevStateResponse`（app 用草稿摘要合成；view=template） */
export function toDevState(res) {
  const draft = res?.draft ?? {}
  return {
    app: {
      id: text(draft.id),
      name: text(draft.name),
      status: text(draft.status) || 'draft',
      createdAt: text(draft.createdAt)
    },
    session: toDevSession(res?.session),
    state: res?.state ?? null,
    defaultPrompt: text(res?.defaultPrompt),
    readOnly: Boolean(res?.readOnly),
    view: 'template',
    ...(res?.staleSession ? { staleSession: true } : {})
  }
}

export function toDevList(res) {
  return {
    sessions: Array.isArray(res?.sessions) ? res.sessions.map(toDevListItem) : [],
    activeSessionId: res?.activeSessionId ?? null,
    view: 'template'
  }
}

/** 解析 4xx/5xx 响应：`{error}` 优先，附带原始 payload（errors/warnings/apps） */
export function errorFromResponse(status, data) {
  const payload = data && typeof data === 'object' ? data : null
  const message = payload && typeof payload.error === 'string' && payload.error.trim()
    ? payload.error
    : `请求失败（HTTP ${status}）`
  return { status, message, payload }
}
