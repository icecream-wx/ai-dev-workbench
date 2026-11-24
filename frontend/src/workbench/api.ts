/**
 * 应用/产物 API 客户端
 *
 * DB 只存应用与模板默认值；产物（单需求文档 / entities.json / pages.json）以文件为准，
 * 通过 `/api/apps/:id/artifacts` 读取、`/api/apps/:id/events` 监听变化。
 */
import { appRoute, isAppView, viewFromStatus, viewLabel } from './view-helpers.js'
import type { DesignStyle } from '../shared/design-system-api'

export { appRoute, isAppView, viewFromStatus, viewLabel }

export type AppView = 'requirements' | 'design' | 'development'
export type AppStatus = AppView | 'completed'

/** 应用 payload 中的设计系统摘要（P7-1 后端 `designSystem` 字段） */
export interface AppDesignSystemSummary {
  pack: { id: string; name: string; version: string; source: 'builtin' | 'custom' } | null
  /** P7-7c：自定义模板来源（内置为 null/缺省） */
  origin?: { kind: 'custom'; draftId: string; baseApplicationType: string } | null
  applicationType: {
    id: string
    name: string
    category: string
    description: string
    structure: string
    defaultStyle: string
    pageCount: number
  } | null
  style: DesignStyle | null
  pageCount: number
  source: string
}

export interface AppInfo {
  id: string
  name: string
  description: string | null
  dir: string
  backendPort: number
  status: AppStatus
  requirementTemplateId: string
  requirementTemplateName: string
  /** 应用设计系统摘要（pack × 应用类型 × 风格），始终解析 */
  designSystem?: AppDesignSystemSummary | null
  createdAt: string
  updatedAt: string
}

export interface ArtifactError {
  file: string
  path: string
  message: string
  expected?: string
}

export interface RequirementEpicStory {
  id: string
  title: string
}

export interface RequirementEpic extends RequirementEpicStory {
  stories: RequirementEpicStory[]
}

export interface RequirementArtifact {
  exists: boolean
  file: string
  title: string
  template: string
  sections: Array<{ key: string; title: string; level: number; markdown: string }>
  epics: RequirementEpic[]
  errors: ArtifactError[]
  warnings: string[]
}

export interface DesignPrototypePageArtifact {
  id: string
  file: string
  hash: string
  pageSet?: string
}

export interface DesignPrototypeArtifact {
  designHash: string
  styleId: string
  exportedAt: string
  stale: boolean
  pages: DesignPrototypePageArtifact[]
}

export interface EntitiesArtifact {
  exists: boolean
  file: string
  schemaVersion?: number
  entities: unknown[]
  relations: unknown[]
  errors: ArtifactError[]
  warnings: string[]
  hash: string
}

export interface PagesArtifact {
  exists: boolean
  file: string
  schemaVersion?: number
  pageSets: unknown[]
  pages: unknown[]
  pageCount: number
  errors: ArtifactError[]
  warnings: string[]
  hash: string
}

export interface ApiDesignInterface {
  id: string
  method: string
  path: string
  name?: string
  operation?: string
  epic?: string
  page?: string
  entity?: string
  permission?: string
}

export interface ApiDesignPageActionCoverage {
  pageSet: string
  epic?: string
  page: string
  action: string
  interface: string
  covered: boolean
}

export interface ApiDesignEntityCoverage {
  entity: string
  list: string
  detail: string
  create: string
  update: string
  delete: string
  missing: string[]
}

export interface ApiDesignArtifact {
  exists: boolean
  file: string
  schemaVersion?: number
  /** 原始 Markdown（设计视图渲染用） */
  markdown: string
  interfaces: ApiDesignInterface[]
  byEpic: Array<{ epic: string; count: number }>
  errors: ArtifactError[]
  warnings: string[]
  coverage: {
    pageActions: ApiDesignPageActionCoverage[]
    entities: ApiDesignEntityCoverage[]
  }
}

export interface ArtifactsResponse {
  appId: string
  requirement: RequirementArtifact
  entities: EntitiesArtifact
  pages: PagesArtifact
  /** P6-3：设计参考包（只读；无 manifest 时省略） */
  prototypes?: DesignPrototypeArtifact
  brief: { exists: boolean; file: string }
  tokens: { exists: boolean; styleId?: string }
  /** 开发对照表状态（只读；应用级） */
  uiCheck: { exists: boolean; file: string; status: 'missing' | 'skeleton' | 'filled' }
  /** D2：接口设计文档（无文件时 exists:false） */
  apiDesign: ApiDesignArtifact
  errors: ArtifactError[]
  hashes: Record<string, string>
  /** sha256(entities.json + pages.json + design-system.json) */
  designHash: string
}

/** GET /apps/:id/templates：应用默认需求模板解析（只读，模板删除时后端回退默认） */
export interface AppTemplatesResponse {
  requirement: { id: string; name: string }
}

export interface CreateAppInput {
  id: string
  name: string
  description?: string
  backendPort?: number
  requirementTemplateId?: string
  designPack?: string
  designApplicationType?: string
  designStyle?: string
  eosSysKey?: string
  dbHost?: string
  dbPort?: string
  dbName?: string
  dbUser?: string
  dbPassword?: string
  mailHost?: string
  mailUsername?: string
  mailPassword?: string
}

export class ApiError extends Error {
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
    const payload = (data ?? {}) as { error?: unknown }
    throw new ApiError(res.status, typeof payload.error === 'string' ? payload.error : `请求失败（HTTP ${res.status}）`)
  }
  return data as T
}

export async function listApps(): Promise<AppInfo[]> {
  const data = await request<{ apps?: AppInfo[] }>('GET', '/apps')
  return Array.isArray(data.apps) ? data.apps : []
}

export async function getApp(id: string): Promise<AppInfo> {
  const data = await request<{ app: AppInfo }>('GET', `/apps/${encodeURIComponent(id)}`)
  return data.app
}

export async function createApp(input: CreateAppInput): Promise<AppInfo> {
  const data = await request<{ app: AppInfo }>('POST', '/apps', input)
  return data.app
}

/** 删除应用：只删本地目录/登记/会话，不处理远端资源 */
export async function deleteApp(id: string): Promise<void> {
  await request<{ ok: true }>('DELETE', `/apps/${encodeURIComponent(id)}?confirm=true`)
}

/** 视图标签（无门禁语义） */
export async function setAppView(id: string, view: AppView): Promise<void> {
  await request('PATCH', `/apps/${encodeURIComponent(id)}/status`, { status: view })
}

// ---- 产物 ----

export async function getArtifacts(appId: string): Promise<ArtifactsResponse> {
  return request<ArtifactsResponse>('GET', `/apps/${encodeURIComponent(appId)}/artifacts`)
}

export interface PrototypePackagePayload {
  designHash: string
  styleId: string
  pages: Array<{ id: string; pageSet?: string; dataUrl: string }>
}

export interface PrototypePackageManifest {
  designHash: string
  styleId: string
  exportedAt: string
  pages: Record<string, { file: string; hash: string; exportedAt: string }>
}

/** P6-3 / D1：上传原型 PNG（应用级；工作台写 manifest/tokens；designHash 不匹配返回 409） */
export async function savePrototypePackage(
  appId: string,
  payload: PrototypePackagePayload
): Promise<{ ok: true; manifest: PrototypePackageManifest }> {
  return request<{ ok: true; manifest: PrototypePackageManifest }>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/design/prototypes`,
    payload
  )
}

/** 应用默认模板（需求/原型），只读解析 */
export async function getAppTemplates(appId: string): Promise<AppTemplatesResponse> {
  return request<AppTemplatesResponse>('GET', `/apps/${encodeURIComponent(appId)}/templates`)
}

/** 单需求文档：文件缺失时生成骨架（已存在不覆盖） */
export interface RequirementDocResult {
  created: boolean
  skipped: boolean
  file: string
  reason?: string
  warnings: string[]
  requirement: RequirementArtifact
}

export async function ensureRequirementDocument(appId: string): Promise<RequirementDocResult> {
  return request<RequirementDocResult>('POST', `/apps/${encodeURIComponent(appId)}/requirements-document`)
}

export interface ArtifactEventConnection {
  close: () => void
}

/** docs/ 变化 SSE；后端推送 `artifacts-changed {paths, hashes}` */
export function connectArtifactEvents(
  appId: string,
  onEvent: (event: Record<string, unknown>) => void,
  onConnection?: (state: 'connecting' | 'open' | 'error' | 'closed') => void
): ArtifactEventConnection {
  const source = new EventSource(`/api/apps/${encodeURIComponent(appId)}/events`)
  source.onopen = () => onConnection?.('open')
  source.onmessage = message => {
    try {
      onEvent(JSON.parse(message.data) as Record<string, unknown>)
    } catch {
      // 忽略心跳/非 JSON
    }
  }
  source.onerror = () => onConnection?.('error')
  return {
    close: () => {
      source.close()
      onConnection?.('closed')
    }
  }
}
