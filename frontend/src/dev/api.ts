/** 会话 API 客户端（每视图一个活跃会话；开发视图沿用完整会话列表） */
import type {
  AppView,
  DesignFidelityReport,
  DevSessionListItem,
  DevSessionListResponse,
  DevStateResponse,
  SessionView
} from './types'

class DevApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const message = (data as { error?: unknown } | null)?.error
    throw new DevApiError(res.status, typeof message === 'string' ? message : `请求失败（HTTP ${res.status}）`)
  }
  return data as T
}

function base(appId: string): string {
  return `/apps/${encodeURIComponent(appId)}/development`
}

function withView(query: string, view?: AppView): string {
  const params = new URLSearchParams(query)
  if (view) params.set('view', view)
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function getDevState(appId: string, sessionId?: string | null, view?: AppView): Promise<DevStateResponse> {
  return request<DevStateResponse>('GET', `${base(appId)}${withView(sessionId ? `sessionId=${encodeURIComponent(sessionId)}` : '', view)}`)
}

export function listDevSessions(appId: string, view?: AppView): Promise<DevSessionListResponse> {
  return request<DevSessionListResponse>('GET', `${base(appId)}/sessions${withView('', view)}`)
}

export function activateDevSession(appId: string, sessionId: string, view?: AppView): Promise<DevStateResponse> {
  return request<DevStateResponse>(
    'POST',
    `${base(appId)}/sessions/${encodeURIComponent(sessionId)}/activate${withView('', view)}`
  )
}

export function renameDevSession(appId: string, sessionId: string, patch: { title?: string; note?: string }): Promise<DevSessionListItem> {
  return request<DevSessionListItem>('PATCH', `${base(appId)}/sessions/${encodeURIComponent(sessionId)}`, patch)
}

export function archiveDevSessionById(appId: string, sessionId: string): Promise<{ ok: true; sessionId: string; status: 'archived' }> {
  return request('POST', `${base(appId)}/sessions/${encodeURIComponent(sessionId)}/archive`)
}

export function createDevSession(
  appId: string,
  options: { new?: boolean; view?: AppView; module?: string } = {}
): Promise<DevStateResponse> {
  return request<DevStateResponse>('POST', `${base(appId)}/session`, {
    ...(options.new ? { new: true } : {}),
    ...(options.view ? { view: options.view } : {}),
    ...(options.module ? { module: options.module } : {})
  })
}

export function archiveDevSession(appId: string, view?: AppView): Promise<{ ok: true }> {
  return request<{ ok: true }>('DELETE', `${base(appId)}/session${withView('', view)}`)
}

export interface PromptOptions {
  /** 需求/设计视图的当前模块 key（后端用它组 prompt） */
  module?: string
  /** 存在的 command 名；存在时 text 作为命令参数 */
  command?: string
}

export function promptDevSession(
  appId: string,
  text: string,
  view?: AppView,
  options: PromptOptions = {}
): Promise<{ ok: true; warning?: string; command?: string }> {
  return request<{ ok: true; warning?: string; command?: string }>('POST', `${base(appId)}/prompt`, {
    text,
    ...(view ? { view } : {}),
    ...(options.module ? { module: options.module } : {}),
    ...(options.command ? { command: options.command } : {})
  })
}

export function interruptDevSession(appId: string, view?: AppView): Promise<{ ok: true }> {
  return request<{ ok: true }>('POST', `${base(appId)}/interrupt`, view ? { view } : {})
}

/** 请求 opencode 原生 compact（用户手动触发） */
export function compactDevSession(appId: string, view?: AppView): Promise<{ ok: true; message: string }> {
  return request<{ ok: true; message: string }>('POST', `${base(appId)}/compact`, view ? { view } : {})
}

export function replyDevPermission(
  appId: string,
  requestId: string,
  decision: 'once' | 'always' | 'reject',
  message?: string,
  view?: AppView
): Promise<{ ok: true }> {
  return request<{ ok: true }>('POST', `${base(appId)}/permission/${encodeURIComponent(requestId)}/reply`, {
    decision,
    ...(message === undefined ? {} : { message }),
    ...(view ? { view } : {})
  })
}

export function replyDevForm(appId: string, formId: string, answer: Record<string, unknown>, view?: AppView): Promise<{ ok: true }> {
  return request<{ ok: true }>('POST', `${base(appId)}/form/${encodeURIComponent(formId)}/reply`, {
    answer,
    ...(view ? { view } : {})
  })
}

/** P7-6a：设计一致性静态检查（只读，不阻断） */
export function checkDesignFidelity(appId: string, module?: string): Promise<DesignFidelityReport> {
  return request<DesignFidelityReport>('POST', `/apps/${encodeURIComponent(appId)}/design-fidelity`, {
    ...(module ? { module } : {})
  })
}

export interface DevEventConnection {
  close: () => void
  readonly state: () => 'connecting' | 'open' | 'error' | 'closed'
}

/**
 * `AgentChatPanel` 的会话 API 适配接口（P7-7b-2a）。
 *
 * 默认实现是本文件的 `devApi`（应用三视图）；模板工作室传 `studio/api.ts` 的适配器，
 * 方法签名保持一致，工作室忽略 app 三视图参数（只认 packId + view=template）。
 * 方法式签名（而非箭头属性）便于应用函数（参数为 `AppView`）直接赋值。
 */
export interface ChatPanelApi {
  getState(appId: string, sessionId?: string | null, view?: SessionView): Promise<DevStateResponse>
  listSessions(appId: string, view?: SessionView): Promise<DevSessionListResponse>
  activate(appId: string, sessionId: string, view?: SessionView): Promise<DevStateResponse>
  create(appId: string, options?: { new?: boolean; view?: SessionView; module?: string }): Promise<DevStateResponse>
  prompt(appId: string, text: string, view?: SessionView, options?: PromptOptions): Promise<{ ok: true; warning?: string; command?: string }>
  interrupt(appId: string, view?: SessionView): Promise<{ ok: true }>
  compact(appId: string, view?: SessionView): Promise<{ ok: true; message: string }>
  replyPermission(
    appId: string,
    requestId: string,
    decision: 'once' | 'always' | 'reject',
    message?: string,
    view?: SessionView
  ): Promise<{ ok: true }>
  replyForm(appId: string, formId: string, answer: Record<string, unknown>, view?: SessionView): Promise<{ ok: true }>
  connectEvents(
    appId: string,
    onEvent: (event: Record<string, unknown>) => void,
    onConnection?: (state: 'connecting' | 'open' | 'error' | 'closed') => void,
    view?: SessionView
  ): DevEventConnection
}

/** SSE 代理；任何事件由调用方 debounce 刷新状态，避免在前端重放原始事件 */
export function connectDevEvents(
  appId: string,
  onEvent: (event: Record<string, unknown>) => void,
  onConnection?: (state: 'connecting' | 'open' | 'error' | 'closed') => void,
  view?: AppView
): DevEventConnection {
  let connectionState: 'connecting' | 'open' | 'error' | 'closed' = 'connecting'
  const source = new EventSource(`/api${base(appId)}/events${withView('', view)}`)
  const update = (state: typeof connectionState): void => {
    connectionState = state
    onConnection?.(state)
  }
  source.onopen = () => update('open')
  source.onmessage = message => {
    try {
      onEvent(JSON.parse(message.data) as Record<string, unknown>)
    } catch {
      // 忽略心跳/非 JSON
    }
  }
  source.onerror = () => update('error')
  return {
    close: () => {
      source.close()
      update('closed')
    },
    state: () => connectionState
  }
}

/** AgentChatPanel 默认 API（应用三视图；工作室用 studio/api.ts 适配器覆盖） */
export const devApi: ChatPanelApi = {
  getState: getDevState,
  listSessions: listDevSessions,
  activate: activateDevSession,
  create: createDevSession,
  prompt: promptDevSession,
  interrupt: interruptDevSession,
  compact: compactDevSession,
  replyPermission: replyDevPermission,
  replyForm: replyDevForm,
  connectEvents: connectDevEvents
}
