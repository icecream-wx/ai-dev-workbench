/** 工作台应用 API 客户端（P1） */
export type AppStage = 'requirements' | 'design' | 'development'
export type AppStatus = AppStage | 'completed'
export type StageState = 'done' | 'current' | 'locked'

export interface RequirementDocSummary {
  status: 'draft' | 'review' | 'confirmed'
  version: number
  templateId: string
  templateName: string
  title: string
  updatedAt: string
}

export interface DesignProjectSummary {
  status: 'draft' | 'review' | 'confirmed'
  version: number
  templateId: string
  templateName: string
  entityCount: number
  confirmedEntityCount: number
  pageSetCount: number
  confirmedPageSetCount: number
  pageCount: number
  updatedAt: string
  confirmedAt: string | null
}

/** M4：应用级设计总览的模块摘要（只读；不建项目/版本） */
export interface DesignModuleSummary {
  moduleId: string
  moduleKey: string
  title: string
  required: boolean
  position: number
  status: 'draft' | 'review' | 'confirmed'
  version: number
  entityCount: number
  pageSetCount: number
  pageCount: number
  missingImages: number
  confirmedAt: string | null
}

/** 交接包摘要（D5：设计 → 开发交接包；只保留列表/状态所需字段） */
export interface HandoffSummary {
  version: number
  hash: string
  createdAt: string
  baselineHandoffVersion?: number | null
  changeSet?: { id: string; seq: number; title: string; status: string } | null
}

/** M5：变更单包含的模块（需求/设计版本区间 + hash + 基线原型模板） */
export interface ChangeSetModuleInfo {
  moduleId: string
  moduleKey: string
  title: string
  reqBaseVersion: number | null
  reqCurrentVersion: number | null
  reqBaseHash: string | null
  reqCurrentHash: string | null
  designBaseVersion: number | null
  designCurrentVersion: number | null
  designBaseHash: string | null
  designCurrentHash: string | null
  templateId: string | null
}

/** 变更单（C1）：服务端返回 canCancel/cancelBlockedReason，前端不要自己猜 */
export interface ChangeSetInfo {
  id: string
  seq: number
  title: string
  description: string
  scope: 'requirements' | 'design' | string
  status: string
  baseRequirementsVersion: number | null
  baseDesignVersion: number | null
  baseHandoffVersion: number | null
  currentRequirementsVersion: number | null
  currentDesignVersion: number | null
  currentHandoffVersion: number | null
  baseAppStatus: string | null
  baseCompletedAt: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  summary: { counts?: { added?: number; modified?: number; removed?: number; total?: number } } | null
  changesMd: string | null
  /** M5：本次变更包含的模块（旧变更单为空数组） */
  modules?: ChangeSetModuleInfo[]
  active: boolean
  canCancel: boolean
  cancelBlockedReason: string | null
}

export interface AppInfo {
  id: string
  name: string
  description: string | null
  dir: string
  backendPort: number
  status: AppStatus
  stages: Record<AppStage, StageState>
  /** #7：解析后的应用模板（模板删除时后端回退默认） */
  requirementTemplateId: string
  requirementTemplateName: string
  prototypeTemplateId: string
  prototypeTemplateName: string
  prototypeTemplateSource?: 'design-project' | 'app-default' | 'global-default'
  requirementDoc: RequirementDocSummary | null
  /** M2/M3：应用下需求模块摘要（只读；用于变更模块选择） */
  requirementModules?: Array<{
    id: string
    moduleKey: string
    title: string
    required: boolean
    archived: boolean
    position: number
    docStatus: 'draft' | 'review' | 'confirmed' | null
    docVersion: number | null
  }>
  designProject: DesignProjectSummary | null
  /** M4：各模块设计摘要（只读） */
  designModules?: DesignModuleSummary[]
  designModulesConfirmed?: boolean
  requirementsConfirmedAt: string | null
  designConfirmedAt: string | null
  developmentStartedAt: string | null
  completedAt: string | null
  handoffHash: string | null
  handoff: HandoffSummary | null
  changeSet: { id: string; seq: number; title: string; status: string } | null
  /** 进行中的变更单（C1）；没有 active 时为 null */
  activeChangeSet?: ChangeSetInfo | null
  createdAt: string
  updatedAt: string
}

export interface CreateAppInput {
  id: string
  name: string
  description?: string
  backendPort?: number
  /** #7：创建时选择的应用模板（不传则后端使用默认） */
  requirementTemplateId?: string
  prototypeTemplateId?: string
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
    throw new ApiError(
      res.status,
      typeof payload.error === 'string' ? payload.error : `请求失败（HTTP ${res.status}）`
    )
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

export async function completeApp(id: string): Promise<AppInfo> {
  const data = await request<{ app: AppInfo }>('POST', `/apps/${encodeURIComponent(id)}/complete`)
  return data.app
}

/** 删除应用：只删本地目录/登记/会话/交接包，不处理远端资源 */
export async function deleteApp(id: string): Promise<void> {
  await request<{ ok: true }>('DELETE', `/apps/${encodeURIComponent(id)}?confirm=true`)
}

export function stageFromStatus(status: AppStatus): AppStage {
  if (status === 'requirements' || status === 'design') return status
  return 'development'
}

export function stageLabel(stage: AppStage): string {
  if (stage === 'requirements') return '需求'
  if (stage === 'design') return '设计'
  return '开发'
}

export function appRoute(app: AppInfo): string {
  return `#/apps/${encodeURIComponent(app.id)}/${stageFromStatus(app.status)}`
}
