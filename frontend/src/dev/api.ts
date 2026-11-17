/** 开发会话 API 客户端 */
import type {
  DevPhaseCompleteResponse,
  DevPhaseRef,
  DevPhaseStartResponse,
  DevPhaseView,
  DevPhasesResponse,
  DevSessionListItem,
  DevSessionListResponse,
  DevStateResponse
} from './types'

export class DevApiError extends Error {
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

export function getDevState(appId: string, sessionId?: string | null): Promise<DevStateResponse> {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
  return request<DevStateResponse>('GET', `${base(appId)}${query}`)
}

export function listDevSessions(appId: string): Promise<DevSessionListResponse> {
  return request<DevSessionListResponse>('GET', `${base(appId)}/sessions`)
}

export function activateDevSession(appId: string, sessionId: string): Promise<DevStateResponse> {
  return request<DevStateResponse>('POST', `${base(appId)}/sessions/${encodeURIComponent(sessionId)}/activate`)
}

export function renameDevSession(appId: string, sessionId: string, patch: { title?: string; note?: string }): Promise<DevSessionListItem> {
  return request<DevSessionListItem>('PATCH', `${base(appId)}/sessions/${encodeURIComponent(sessionId)}`, patch)
}

export function archiveDevSessionById(appId: string, sessionId: string): Promise<{ ok: true; sessionId: string; status: 'archived' }> {
  return request('POST', `${base(appId)}/sessions/${encodeURIComponent(sessionId)}/archive`)
}

export function createDevSession(appId: string, reset = false): Promise<DevStateResponse> {
  return request<DevStateResponse>('POST', `${base(appId)}/session`, reset ? { new: true } : {})
}

export function archiveDevSession(appId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>('DELETE', `${base(appId)}/session`)
}

export function promptDevSession(appId: string, text: string): Promise<{ ok: true; phase?: DevPhaseRef; warning?: string }> {
  return request<{ ok: true; phase?: DevPhaseRef; warning?: string }>('POST', `${base(appId)}/prompt`, { text })
}

export function interruptDevSession(appId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>('POST', `${base(appId)}/interrupt`)
}

/** I-09a：请求 opencode 原生 compact（用户手动触发） */
export function compactDevSession(appId: string): Promise<{ ok: true; message: string }> {
  return request<{ ok: true; message: string }>('POST', `${base(appId)}/compact`)
}

export function replyDevPermission(appId: string, requestId: string, decision: 'once' | 'always' | 'reject', message?: string): Promise<{ ok: true }> {
  return request<{ ok: true }>('POST', `${base(appId)}/permission/${encodeURIComponent(requestId)}/reply`, { decision, message })
}

export function replyDevForm(appId: string, formId: string, answer: Record<string, unknown>): Promise<{ ok: true }> {
  return request<{ ok: true }>('POST', `${base(appId)}/form/${encodeURIComponent(formId)}/reply`, { answer })
}

// ---- U7：开发阶段（按需生成；历史交接包只读） ----

export function getDevPhases(appId: string, handoffVersion?: number | null): Promise<DevPhasesResponse> {
  const query =
    typeof handoffVersion === 'number' && Number.isInteger(handoffVersion) && handoffVersion > 0
      ? `?handoffVersion=${handoffVersion}`
      : ''
  return request<DevPhasesResponse>('GET', `${base(appId)}/phases${query}`)
}

export function generateDevPhases(appId: string): Promise<DevPhasesResponse> {
  return request<DevPhasesResponse>('POST', `${base(appId)}/phases/generate`)
}

export function startDevPhase(appId: string, phaseId: string): Promise<DevPhaseStartResponse> {
  return request<DevPhaseStartResponse>('POST', `${base(appId)}/phases/${encodeURIComponent(phaseId)}/start`)
}

export function completeDevPhase(appId: string, phaseId: string): Promise<DevPhaseCompleteResponse> {
  return request<DevPhaseCompleteResponse>('POST', `${base(appId)}/phases/${encodeURIComponent(phaseId)}/complete`)
}

export function skipDevPhase(appId: string, phaseId: string): Promise<DevPhaseView> {
  return request<DevPhaseView>('POST', `${base(appId)}/phases/${encodeURIComponent(phaseId)}/skip`)
}

export function reopenDevPhase(appId: string, phaseId: string): Promise<DevPhaseView> {
  return request<DevPhaseView>('POST', `${base(appId)}/phases/${encodeURIComponent(phaseId)}/reopen`)
}

export interface DevEventConnection {
  close: () => void
  readonly state: () => 'connecting' | 'open' | 'error' | 'closed'
}

/** SSE 代理；任何事件由调用方 debounce 刷新状态，避免在前端重放原始事件 */
export function connectDevEvents(
  appId: string,
  onEvent: (event: Record<string, unknown>) => void,
  onConnection?: (state: 'connecting' | 'open' | 'error' | 'closed') => void
): DevEventConnection {
  let connectionState: 'connecting' | 'open' | 'error' | 'closed' = 'connecting'
  const source = new EventSource(`/api${base(appId)}/events`)
  const update = (state: typeof connectionState): void => {
    connectionState = state
    onConnection?.(state)
  }
  source.onopen = () => update('open')
  source.onmessage = message => {
    try {
      const data = JSON.parse(message.data) as Record<string, unknown>
      onEvent(data)
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
