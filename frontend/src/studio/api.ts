/**
 * 模板工作室 API 客户端（P7-7b-2a）
 *
 * - 草稿/生成/发布/删除/模型：`/api/design-templates/drafts/:id/*`；
 * - 会话适配器 `studioChatApi`：实现 `dev/api.ts#ChatPanelApi`，路径
 *   `/api/design-templates/drafts/:id/studio/*`，把 `StudioStateResponse` 映射成 `DevStateResponse`
 *   （`app` 用草稿摘要合成、`view='template'`），供 `AgentChatPanel` 直接复用；
 * - 错误信息保留后端 `{error}`（附 status/payload 供 UI 展示 errors/warnings）。
 */
import type { ChatPanelApi, DevEventConnection } from '../dev/api'
import type { DevSessionListResponse, DevStateResponse } from '../dev/types'
import type {
  CreateDraftInput,
  DraftDetail,
  DraftFailurePayload,
  DraftSummary,
  OpencodeModel,
  StudioModelRef,
  StudioModelResponse,
  StudioSessionResponse
} from './types'
import { draftBasePath, errorFromResponse, studioBasePath, studioEventsUrl, toDevList, toDevState } from './api-helpers.js'

export class StudioApiError extends Error {
  readonly status: number
  readonly payload: DraftFailurePayload | null

  constructor(status: number, message: string, payload: DraftFailurePayload | null = null) {
    super(message)
    this.name = 'StudioApiError'
    this.status = status
    this.payload = payload
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
    const failure = errorFromResponse(res.status, data)
    throw new StudioApiError(failure.status, failure.message, failure.payload as DraftFailurePayload | null)
  }
  return data as T
}

function draftBase(packId: string): string {
  return draftBasePath(packId)
}

function studioBase(packId: string): string {
  return studioBasePath(packId)
}

/* ------------------------------------------------------------------ *
 * 草稿 / 生成 / 发布 / 模型
 * ------------------------------------------------------------------ */

/** 模板中心自定义列表（草稿 + 引用应用数） */
export async function listDrafts(): Promise<DraftSummary[]> {
  const data = await request<{ drafts?: DraftSummary[] }>('GET', '/design-templates/drafts')
  return Array.isArray(data?.drafts) ? data.drafts : []
}

/** 新建自定义模板草稿（只创建草稿，不生成/发布） */
export async function createDesignTemplateDraft(input: CreateDraftInput): Promise<DraftSummary> {
  const data = await request<{ draft: DraftSummary }>('POST', '/design-templates/drafts', input)
  return data.draft
}

/** 编辑已发布模板：草稿不存在时由已发布 pack 反写草稿 */
export async function ensureDraftFromPack(packId: string): Promise<DraftSummary> {
  const data = await request<{ draft: DraftSummary }>(
    'POST',
    `/design-templates/packs/${encodeURIComponent(packId)}/draft`
  )
  return data.draft
}

/** 删除已发布自定义模板（内置 403；被引用 409 `pack-referenced`） */
export function deleteDesignPack(packId: string): Promise<{ ok: true; removedDraft: boolean }> {
  return request('DELETE', `/design-system/${encodeURIComponent(packId)}`)
}

export function getDraftDetail(packId: string): Promise<DraftDetail> {
  return request<DraftDetail>('GET', draftBase(packId))
}

/** 工作室状态（首条提示/会话/校验；工作室页面头部用） */
export function getStudioState(packId: string): Promise<StudioSessionResponse> {
  return request<StudioSessionResponse>('GET', studioBase(packId))
}

export interface GenerateDraftResponse {
  ok: true
  pack?: { id: string; version: string; pageCount: number }
  pages?: Array<Record<string, unknown>>
  css?: Record<string, unknown>
  warnings?: DraftFailurePayload['warnings']
  errors?: DraftFailurePayload['errors']
}

export function generateDraft(packId: string): Promise<GenerateDraftResponse> {
  return request<GenerateDraftResponse>('POST', `${draftBase(packId)}/generate`)
}

export function publishDraft(packId: string): Promise<{
  ok: true
  pack: { id: string; version: string }
  warnings?: DraftFailurePayload['warnings']
}> {
  return request('POST', `${draftBase(packId)}/publish`)
}

export function deleteDraft(packId: string): Promise<{ ok: true; packKept: boolean }> {
  return request('DELETE', draftBase(packId))
}

export function getStudioModel(packId: string): Promise<StudioModelResponse> {
  return request<StudioModelResponse>('GET', `${studioBase(packId)}/model`)
}

export function saveStudioModel(packId: string, model: StudioModelRef | null): Promise<{ ok: true; stage: 'template'; model: StudioModelRef | null }> {
  return request('PUT', `${studioBase(packId)}/model`, { model })
}

/** 可用模型（与设置面板同一接口；失败只提示，不阻断工作室） */
export async function listModels(): Promise<OpencodeModel[]> {
  const data = await request<{ models?: OpencodeModel[] }>('GET', '/opencode/models')
  return Array.isArray(data?.models) ? data.models : []
}

export interface RuntimeHealth {
  ready: boolean
  starting?: boolean
  lastError?: string | null
  installError?: string | null
}

export function getRuntimeHealth(): Promise<RuntimeHealth> {
  return request<RuntimeHealth>('GET', '/opencode/health')
}

/* ------------------------------------------------------------------ *
 * AgentChatPanel 适配器（studio）
 * ------------------------------------------------------------------ */

/** 工作室会话适配器：AgentChatPanel 的 `api` prop */
export const studioChatApi: ChatPanelApi = {
  async getState(packId, _sessionId, _view) {
    return toDevState(await request<StudioSessionResponse>('GET', studioBase(packId))) as DevStateResponse
  },
  async listSessions(packId, _view) {
    return toDevList(
      await request<{ sessions?: Array<Record<string, unknown>>; activeSessionId?: string | null }>(
        'GET',
        `${studioBase(packId)}/sessions`
      )
    ) as DevSessionListResponse
  },
  async activate(packId, sessionId, _view) {
    return toDevState(
      await request<StudioSessionResponse>(
        'POST',
        `${studioBase(packId)}/sessions/${encodeURIComponent(sessionId)}/activate`
      )
    ) as DevStateResponse
  },
  async create(packId, options = {}) {
    return toDevState(
      await request<StudioSessionResponse>('POST', `${studioBase(packId)}/session`, options?.new ? { new: true } : {})
    ) as DevStateResponse
  },
  prompt(packId, text, _view, options = {}) {
    return request<{ ok: true; warning?: string; command?: string }>('POST', `${studioBase(packId)}/prompt`, {
      text,
      ...(options?.command ? { command: options.command } : {})
    })
  },
  interrupt(packId) {
    return request<{ ok: true }>('POST', `${studioBase(packId)}/interrupt`)
  },
  compact(packId) {
    return request<{ ok: true; message: string }>('POST', `${studioBase(packId)}/compact`)
  },
  replyPermission(packId, requestId, decision, message) {
    return request<{ ok: true }>('POST', `${studioBase(packId)}/permission/${encodeURIComponent(requestId)}/reply`, {
      decision,
      ...(message === undefined ? {} : { message })
    })
  },
  replyForm(packId, formId, answer) {
    return request<{ ok: true }>('POST', `${studioBase(packId)}/form/${encodeURIComponent(formId)}/reply`, { answer })
  },
  connectEvents(packId, onEvent, onConnection): DevEventConnection {
    let connectionState: 'connecting' | 'open' | 'error' | 'closed' = 'connecting'
    const source = new EventSource(studioEventsUrl(packId))
    const update = (state: typeof connectionState): void => {
      connectionState = state
      onConnection?.(state)
    }
    source.onopen = () => update('open')
    source.onmessage = (message) => {
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
}
