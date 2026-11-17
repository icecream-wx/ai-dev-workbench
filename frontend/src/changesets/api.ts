/** 变更单 API 客户端（C1b） */
import type { AppInfo, ChangeSetInfo } from '../workbench/api'

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
    const payload = (data ?? {}) as { error?: unknown; issues?: unknown; warnings?: unknown }
    const error = new Error(typeof payload.error === 'string' ? payload.error : `请求失败（HTTP ${res.status}）`) as Error & {
      status: number
      issues: string[]
      warnings: string[]
    }
    error.status = res.status
    error.issues = Array.isArray(payload.issues) ? payload.issues.map(item => String(item)) : []
    error.warnings = Array.isArray(payload.warnings) ? payload.warnings.map(item => String(item)) : []
    throw error
  }
  return data as T
}

export interface ChangeSetStartInput {
  title: string
  description?: string
  scope: 'requirements' | 'design'
  /** M5：本次变更包含的模块；不传 = 全部未归档模块 */
  moduleIds?: string[]
}

export interface ChangeSetStartResult {
  changeSet: ChangeSetInfo
  app: AppInfo
}

export async function listChangeSets(appId: string): Promise<{ changeSets: ChangeSetInfo[]; active: ChangeSetInfo | null }> {
  const data = await request<{ changeSets?: ChangeSetInfo[]; active?: ChangeSetInfo | null }>(
    'GET',
    `/apps/${encodeURIComponent(appId)}/change-sets`
  )
  return { changeSets: Array.isArray(data.changeSets) ? data.changeSets : [], active: data.active ?? null }
}

export async function startChangeSet(appId: string, input: ChangeSetStartInput): Promise<ChangeSetStartResult> {
  return request<ChangeSetStartResult>('POST', `/apps/${encodeURIComponent(appId)}/change-sets`, input)
}

export interface ChangeSetCancelResult {
  changeSet: ChangeSetInfo
  app: AppInfo
  restored: {
    requirementsVersion: number | null
    designVersion: number | null
    templateId: string | null
    appStatus: string
    sessionRestored: boolean
    /** M5：逐个恢复的模块 */
    modules?: Array<{
      moduleId: string
      moduleKey: string
      title: string
      requirementsVersion: number | null
      designVersion: number | null
      templateId: string | null
      /** MF-M5-1：变更中新增模块取消时自动归档 */
      archived?: boolean
    }>
    /** M5：取消后重新生成的需求 bundle 版本 */
    bundleVersion?: number | null
  }
}

export async function cancelChangeSet(appId: string, changeSetId: string): Promise<ChangeSetCancelResult> {
  return request<ChangeSetCancelResult>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/change-sets/${encodeURIComponent(changeSetId)}/cancel`
  )
}

/** 仅设计变更 → 需求+设计（改需求前必须先升级范围） */
export async function upgradeChangeSetScope(
  appId: string,
  changeSetId: string,
  scope: 'requirements' = 'requirements'
): Promise<{ changeSet: ChangeSetInfo; app: AppInfo }> {
  return request<{ changeSet: ChangeSetInfo; app: AppInfo }>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/change-sets/${encodeURIComponent(changeSetId)}/scope`,
    { scope }
  )
}
