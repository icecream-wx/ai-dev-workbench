/** 设计阶段（D1—D4）前端 API 客户端 */
import type {
  DesignChatMessage,
  DesignCoverage,
  DesignEntity,
  DesignInputBundle,
  DesignInputSummary,
  DesignInputSyncMode,
  DesignInputSyncResult,
  DesignPage,
  DesignPageSet,
  DesignProjectPayload,
  DesignStaleState,
  DesignVersionDetail,
  DesignVersionMeta,
  PrototypeTemplate
} from './types'

export class DesignApiError extends Error {
  readonly status: number
  readonly issues: string[]
  readonly warnings: string[]

  constructor(status: number, message: string, issues: string[] = [], warnings: string[] = []) {
    super(message)
    this.status = status
    this.issues = issues
    this.warnings = warnings
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
    const payload = (data ?? {}) as { error?: unknown; issues?: unknown; warnings?: unknown }
    throw new DesignApiError(
      res.status,
      typeof payload.error === 'string' ? payload.error : `请求失败（HTTP ${res.status}）`,
      Array.isArray(payload.issues) ? payload.issues.map(item => String(item)) : [],
      Array.isArray(payload.warnings) ? payload.warnings.map(item => String(item)) : []
    )
  }
  return data as T
}

/** M4：模块查询串（空/缺省 = 默认模块） */
function moduleQuery(moduleId?: string): string {
  return moduleId ? `?moduleId=${encodeURIComponent(moduleId)}` : ''
}

function withModule<T extends Record<string, unknown>>(body: T, moduleId?: string): T & { moduleId?: string } {
  return moduleId ? { ...body, moduleId } : body
}

export interface DesignTemplateSwitchModule {
  moduleId: string
  moduleKey: string
  title: string
  status: 'draft' | 'review' | 'confirmed'
  version: number
  fromTemplateId: string | null
  toTemplateId: string
  blocked: boolean
}

export interface DesignTemplateSwitchPreview {
  templateId: string
  templateName: string
  modules: DesignTemplateSwitchModule[]
  blockedModules: Array<{ moduleId: string; moduleKey: string; title: string }>
  canApply: boolean
}

// ---- 原型模板 ----

export async function listPrototypeTemplates(params: { category?: string; q?: string } = {}): Promise<PrototypeTemplate[]> {
  const search = new URLSearchParams()
  if (params.category) search.set('category', params.category)
  if (params.q) search.set('q', params.q)
  const suffix = search.toString()
  const data = await request<{ templates?: PrototypeTemplate[] }>('GET', `/prototype-templates${suffix ? `?${suffix}` : ''}`)
  return Array.isArray(data.templates) ? data.templates : []
}

export async function createPrototypeTemplate(input: Partial<PrototypeTemplate>): Promise<PrototypeTemplate> {
  const data = await request<{ template: PrototypeTemplate }>('POST', '/prototype-templates', input)
  return data.template
}

export async function updatePrototypeTemplate(id: string, input: Partial<PrototypeTemplate>): Promise<PrototypeTemplate> {
  const data = await request<{ template: PrototypeTemplate }>('PUT', `/prototype-templates/${encodeURIComponent(id)}`, input)
  return data.template
}

export async function deletePrototypeTemplate(id: string): Promise<void> {
  await request<{ ok: true }>('DELETE', `/prototype-templates/${encodeURIComponent(id)}`)
}

export async function duplicatePrototypeTemplate(id: string, name?: string): Promise<PrototypeTemplate> {
  const data = await request<{ template: PrototypeTemplate }>(
    'POST',
    `/prototype-templates/${encodeURIComponent(id)}/duplicate`,
    name ? { name } : {}
  )
  return data.template
}

// ---- 设计项目 ----

export async function getDesign(appId: string, moduleId?: string): Promise<DesignProjectPayload> {
  return request<DesignProjectPayload>('GET', `/apps/${encodeURIComponent(appId)}/design${moduleQuery(moduleId)}`)
}

export async function switchDesignTemplate(
  appId: string,
  templateId: string,
  moduleId?: string
): Promise<DesignProjectPayload> {
  return request<DesignProjectPayload>(
    'PUT',
    `/apps/${encodeURIComponent(appId)}/design/template`,
    withModule({ templateId, scope: 'module' }, moduleId)
  )
}

/** M4：应用级原型模板切换预览（只读；逐模块） */
export async function previewDesignTemplateSwitch(appId: string, templateId: string): Promise<DesignTemplateSwitchPreview> {
  return request<DesignTemplateSwitchPreview>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/design/template/preview`,
    { templateId }
  )
}

/** M4：应用级原型模板切换（全部未归档模块；任一已确认 409） */
export async function switchAppDesignTemplate(
  appId: string,
  templateId: string
): Promise<{ template: PrototypeTemplate; modules: DesignTemplateSwitchModule[]; changedModuleIds: string[] }> {
  return request('PUT', `/apps/${encodeURIComponent(appId)}/design/template`, { templateId, scope: 'app' })
}

// ---- 设计输入 / 覆盖度 / 需求变更同步（H2—H4） ----

/** M5：应用级设计总览（只读；逐模块覆盖率/未覆盖 Story/缺图 + 汇总 + 需求 bundle） */
export interface DesignOverviewCoverage {
  storyTotal: number
  coveredStories: number
  rate: number
  uncovered: Array<{ id: string; title: string }>
}

export interface DesignOverviewModule {
  moduleId: string
  moduleKey: string
  title: string
  required: boolean
  status: 'draft' | 'review' | 'confirmed'
  version: number
  entityCount: number
  pageSetCount: number
  pageCount: number
  missingImages: number
  coverage: DesignOverviewCoverage
  confirmedAt: string | null
}

export interface DesignOverview {
  appId: string
  modules: DesignOverviewModule[]
  summary: {
    moduleCount: number
    confirmed: number
    storyTotal: number
    coveredStories: number
    rate: number
    missingImages: number
  }
  bundle: { version: number; hash: string } | null
}

export async function getDesignOverview(appId: string): Promise<DesignOverview> {
  return request<DesignOverview>('GET', `/apps/${encodeURIComponent(appId)}/design/overview`)
}

export async function getDesignInput(
  appId: string,
  moduleId?: string
): Promise<{
  input: DesignInputBundle
  summary: DesignInputSummary
  bound?: DesignInputSummary | null
  stale: DesignStaleState
  bundle?: { version: number; hash: string } | null
  bundleDrift?: boolean
  history?: DesignInputSummary[]
}> {
  return request('GET', `/apps/${encodeURIComponent(appId)}/design/input${moduleQuery(moduleId)}`)
}

export async function getDesignCoverage(
  appId: string,
  moduleId?: string
): Promise<{ coverage: DesignCoverage; stale: DesignStaleState }> {
  return request('GET', `/apps/${encodeURIComponent(appId)}/design/coverage${moduleQuery(moduleId)}`)
}

export async function syncDesignInput(
  appId: string,
  mode: DesignInputSyncMode,
  moduleId?: string
): Promise<DesignInputSyncResult> {
  return request<DesignInputSyncResult>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/design/input/sync`,
    withModule({ mode }, moduleId)
  )
}

/** 重新编辑需求：文档回 draft、应用回需求阶段（设计阶段 stale 后使用） */
export async function reopenRequirements(appId: string, moduleId?: string): Promise<{ doc: unknown }> {
  return request('POST', `/apps/${encodeURIComponent(appId)}/requirements-doc/reopen`, moduleId ? { moduleId } : {})
}

export async function saveDesignEntities(
  appId: string,
  entities: DesignEntity[],
  source: 'ai' | 'manual' = 'manual',
  options: { snapshot?: boolean } = {},
  moduleId?: string
): Promise<DesignProjectPayload> {
  return request<DesignProjectPayload>(
    'PUT',
    `/apps/${encodeURIComponent(appId)}/design/entities`,
    withModule({ entities, source, snapshot: options.snapshot === true }, moduleId)
  )
}

export async function generateDesignEntities(
  appId: string,
  moduleId?: string
): Promise<{ project: DesignProjectPayload; warnings: string[] }> {
  return request<{ project: DesignProjectPayload; warnings: string[] }>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/design/generate-entities`,
    moduleId ? { moduleId } : {}
  )
}

export async function saveDesignPageSets(
  appId: string,
  pageSets: DesignPageSet[],
  source: 'ai' | 'manual' = 'manual',
  options: { snapshot?: boolean } = {},
  moduleId?: string
): Promise<DesignProjectPayload> {
  return request<DesignProjectPayload>(
    'PUT',
    `/apps/${encodeURIComponent(appId)}/design/page-sets`,
    withModule({ pageSets, source, snapshot: options.snapshot === true }, moduleId)
  )
}

export async function saveDesignPageSet(
  appId: string,
  pageSetId: string,
  input: { title?: string; description?: string; status?: 'draft' | 'confirmed'; pages?: DesignPage[] },
  moduleId?: string
): Promise<DesignProjectPayload> {
  return request<DesignProjectPayload>(
    'PUT',
    `/apps/${encodeURIComponent(appId)}/design/page-sets/${encodeURIComponent(pageSetId)}`,
    withModule(input, moduleId)
  )
}

export async function saveDesignPage(
  appId: string,
  pageId: string,
  input: Partial<DesignPage> & { setStatus?: 'draft' | 'confirmed' },
  moduleId?: string
): Promise<DesignProjectPayload> {
  return request<DesignProjectPayload>(
    'PUT',
    `/apps/${encodeURIComponent(appId)}/design/pages/${encodeURIComponent(pageId)}`,
    withModule(input as Record<string, unknown>, moduleId)
  )
}

export async function generateDesignPageSets(
  appId: string,
  mode: 'default' | 'ai' = 'default',
  moduleId?: string
): Promise<{ project: DesignProjectPayload; warnings: string[] }> {
  return request<{ project: DesignProjectPayload; warnings: string[] }>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/design/page-sets/generate`,
    withModule({ mode }, moduleId)
  )
}

/** D-RMP：按 Epic 生成（实体合并 + 页面集 primary 替换；每 Epic 一个 ai 版本；不自动确认） */
export interface DesignEpicGenerationResult {
  project: DesignProjectPayload
  warnings: string[]
  epicId: string
  entitiesAdded: number
  entitiesUpdated: number
  pageSetId: string
  pages: number
  reopened: string[]
}

export async function generateDesignEpic(
  appId: string,
  epicId: string,
  options: { moduleId?: string; reopenConfirmed?: boolean } = {}
): Promise<DesignEpicGenerationResult> {
  return request<DesignEpicGenerationResult>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/design/generate-epic`,
    withModule({ epicId, reopenConfirmed: options.reopenConfirmed === true }, options.moduleId)
  )
}

export async function uploadDesignSnapshot(
  appId: string,
  pageId: string,
  imageBase64: string,
  html?: string,
  moduleId?: string
): Promise<{ project: DesignProjectPayload; page: DesignPage; imageUrl: string }> {
  return request<{ project: DesignProjectPayload; page: DesignPage; imageUrl: string }>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/design/pages/${encodeURIComponent(pageId)}/snapshot`,
    withModule({ imageBase64, html }, moduleId)
  )
}

export interface ConfirmDesignResponse {
  project: DesignProjectPayload
  alreadyConfirmed: boolean
  /** 全部必选未归档模块设计已确认（应用级交接包门禁） */
  appConfirmed?: boolean
  pendingModuleIds?: string[]
  module?: { id: string; key: string }
}

export async function confirmDesignProject(appId: string, moduleId?: string): Promise<ConfirmDesignResponse> {
  return request<ConfirmDesignResponse>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/design/confirm`,
    moduleId ? { moduleId } : {}
  )
}

export async function reopenDesignProject(appId: string, moduleId?: string): Promise<DesignProjectPayload> {
  const data = await request<{ project: DesignProjectPayload }>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/design/reopen`,
    moduleId ? { moduleId } : {}
  )
  return data.project
}

// ---- 设计 → 开发交接包（D5） ----

export type DesignHandoffFileKind = 'text' | 'image' | 'html'

export interface DesignHandoffChangeSet {
  id: string
  seq: number
  title: string
  description: string
  scope: string
  status: string
  baselineHandoffVersion: number | null
  currentHandoffVersion: number | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface DesignHandoffFileMeta {
  name: string
  size: number
  hash: string
  kind: DesignHandoffFileKind
  sourcePageId?: string
}

export interface DesignHandoffFileView extends DesignHandoffFileMeta {
  content?: string
  url?: string
  missing?: boolean
}

// I-09b-1（U6）：交接包规模（旧交接包没有 scale 时为 null）
export type DesignHandoffScaleMetric = 'stories' | 'pages' | 'textBytes'

export interface DesignHandoffScaleTrigger {
  metric: DesignHandoffScaleMetric
  value: number
  threshold: number
}

export interface DesignHandoffScaleCounts {
  scenes: number
  epics: number
  stories: number
  entities: number
  fields: number
  relations: number
  pageSets: number
  pages: number
  prototypes: number
}

export interface DesignHandoffScale {
  level: 'normal' | 'large'
  suggested: boolean
  counts: DesignHandoffScaleCounts
  textBytes: number
  thresholds: { stories: number; pages: number; textBytes: number }
  triggers: DesignHandoffScaleTrigger[]
  phaseCount: number
  /** M6b：模块里程碑阶段数（不计入 phaseCount） */
  modulePhaseCount?: number
  derivedFrom: 'epics' | 'pageSets' | 'none'
}

export interface DesignHandoffModuleCounts {
  scenes: number
  epics: number
  stories: number
  entities: number
  fields: number
  relations: number
  pageSets: number
  pages: number
  prototypes: number
}

/** M6：交接包模块摘要（read/preview 共用） */
export type DesignHandoffModuleChangeState = 'added' | 'changed' | 'unchanged'

export interface DesignHandoffModuleSummary {
  id: string
  key: string
  title: string
  position: number
  required: boolean
  requirements: {
    version: number
    docHash: string
    title: string
    templateId: string
    templateName: string
    confirmed: boolean
    confirmedAt: string | null
  }
  design: {
    version: number
    status: string
    confirmedAt: string | null
    templateId: string
    templateHash: string
    hash: string
  }
  counts: DesignHandoffModuleCounts
  coverageRate: number
  missingImages: number
  stale: boolean
  warnings: string[]
  changeState: DesignHandoffModuleChangeState | null
}

export interface DesignHandoffMeta {
  version: number
  hash: string
  docsDir: string
  createdAt: string
  changeSet: DesignHandoffChangeSet | null
  baselineHandoffVersion: number | null
  files: DesignHandoffFileMeta[]
  manifest: Record<string, unknown> | null
  template: { id: string; name: string; hash: string } | null
  scale?: DesignHandoffScale | null
  /** M6：模块摘要（旧交接包可能为空） */
  modules?: DesignHandoffModuleSummary[]
  requirementsBundle?: { version: number; hash: string } | null
}

export interface DesignHandoffPreviewResult {
  ok: true
  version: number
  hash: string
  baselineHandoffVersion: number | null
  changeSet: DesignHandoffChangeSet
  manifest: Record<string, unknown>
  files: DesignHandoffFileView[]
  warnings: string[]
  scale?: DesignHandoffScale | null
  /** M6 */
  modules?: DesignHandoffModuleSummary[]
  requirementsBundle?: { version: number; hash: string } | null
}

export interface DesignHandoffGenerateResult {
  ok: true
  appId: string
  appStatus: string
  developmentStarted: boolean
  handoff: DesignHandoffMeta
  changeSet: DesignHandoffChangeSet
  files: DesignHandoffFileView[]
  warnings: string[]
}

export interface DesignHandoffReadResult {
  handoff: DesignHandoffMeta | null
  changeSet: DesignHandoffChangeSet | null
  files: DesignHandoffFileView[]
  filesAvailable: boolean
}

export async function getDesignHandoff(appId: string, version?: number): Promise<DesignHandoffReadResult> {
  const suffix = version ? `?version=${version}` : ''
  return request<DesignHandoffReadResult>('GET', `/apps/${encodeURIComponent(appId)}/design/handoff${suffix}`)
}

export async function previewDesignHandoff(appId: string): Promise<DesignHandoffPreviewResult> {
  return request<DesignHandoffPreviewResult>('POST', `/apps/${encodeURIComponent(appId)}/design/handoff/preview`)
}

export async function generateDesignHandoff(appId: string): Promise<DesignHandoffGenerateResult> {
  return request<DesignHandoffGenerateResult>('POST', `/apps/${encodeURIComponent(appId)}/design/handoff/generate`)
}

export function designHandoffFileUrl(appId: string, name: string): string {
  const encoded = name.split('/').map(segment => encodeURIComponent(segment)).join('/')
  return `/api/apps/${encodeURIComponent(appId)}/design/handoff/files/${encoded}`
}

export async function listDesignVersions(appId: string, moduleId?: string): Promise<DesignVersionMeta[]> {
  const data = await request<{ versions?: DesignVersionMeta[] }>(
    'GET',
    `/apps/${encodeURIComponent(appId)}/design/versions${moduleQuery(moduleId)}`
  )
  return Array.isArray(data.versions) ? data.versions : []
}

export async function getDesignVersion(
  appId: string,
  version: number,
  moduleId?: string
): Promise<DesignVersionDetail> {
  const data = await request<{ version: DesignVersionDetail }>(
    'GET',
    `/apps/${encodeURIComponent(appId)}/design/versions/${version}${moduleQuery(moduleId)}`
  )
  return data.version
}

export async function rollbackDesignVersion(
  appId: string,
  version: number,
  moduleId?: string
): Promise<DesignProjectPayload> {
  return request<DesignProjectPayload>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/design/versions/${version}/rollback`,
    moduleId ? { moduleId } : {}
  )
}

/** 手动“保存版本”（R2c）：draft 时快照当前实体/页面集为 manual 版本；confirmed 409 */
export async function createDesignVersion(appId: string, moduleId?: string): Promise<DesignProjectPayload> {
  return request<DesignProjectPayload>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/design/versions`,
    moduleId ? { moduleId } : {}
  )
}

export async function getDesignChat(
  appId: string,
  moduleId?: string
): Promise<{ messages: DesignChatMessage[]; legacyFallback: boolean }> {
  const data = await request<{ messages?: DesignChatMessage[]; legacyFallback?: boolean }>(
    'GET',
    `/apps/${encodeURIComponent(appId)}/design/chat${moduleQuery(moduleId)}`
  )
  return {
    messages: Array.isArray(data.messages) ? data.messages : [],
    legacyFallback: data.legacyFallback === true
  }
}

export async function saveDesignChat(
  appId: string,
  messages: DesignChatMessage[],
  moduleId?: string
): Promise<void> {
  await request<{ ok: true }>(
    'PUT',
    `/apps/${encodeURIComponent(appId)}/design/chat`,
    moduleId ? { messages, moduleId } : { messages }
  )
}

export interface DesignChatRequestMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 设计对话：POST /api/apps/:id/chat { stage:'design', mode:'design', focus, messages }
 * SSE 帧：{type:'meta'|'delta'|'done'|'error'}
 */
export async function streamDesignChat(
  appId: string,
  payload: {
    messages: DesignChatRequestMessage[]
    focus?: { kind: 'entity' | 'pageSet' | 'page' | 'epic'; id: string }
    moduleId?: string
  },
  onDelta: (text: string) => void,
  signal?: AbortSignal,
  timeoutMs = 900000
): Promise<string> {
  const effectiveSignal =
    signal ??
    (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined)
  let response: Response
  try {
    response = await fetch(`/api/apps/${encodeURIComponent(appId)}/chat`, {
      method: 'POST',
      signal: effectiveSignal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'design',
        mode: 'design',
        focus: payload.focus,
        ...(payload.moduleId ? { moduleId: payload.moduleId } : {}),
        messages: payload.messages
      })
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') throw new Error(`AI 请求超时（${Math.round(timeoutMs / 1000)} 秒）`)
    if (err instanceof DOMException && err.name === 'AbortError') throw new Error('AI 请求已中止')
    throw err
  }
  if (!response.ok || !response.body) {
    const text = await response
      .text()
      .catch(() => '')
      .then(value => value.slice(0, 400))
    let message = `AI 请求失败（HTTP ${response.status}）${text ? `：${text}` : ''}`
    try {
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed?.error) message = parsed.error
    } catch {
      // 保留原文
    }
    throw new Error(message)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let index: number
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      const dataLines = raw
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).replace(/^ /, ''))
      if (!dataLines.length) continue
      let frame: { type?: string; text?: string; message?: string }
      try {
        frame = JSON.parse(dataLines.join('\n')) as { type?: string; text?: string; message?: string }
      } catch {
        continue
      }
      if (frame.type === 'delta' && frame.text) {
        full += frame.text
        onDelta(frame.text)
        continue
      }
      if (frame.type === 'done') return frame.text || full
      if (frame.type === 'error') throw new Error(frame.message || 'AI 生成失败')
    }
  }
  return full
}
