/** 需求文档化（R1）前端 API 客户端 */

import { moduleQuery } from './api-query.js'

export { moduleQuery }

export type TemplateStage = 'requirements' | 'design' | 'test' | 'dev-plan'

export type TemplateSectionKind =
  | 'markdown'
  | 'meta'
  | 'metrics'
  | 'roles'
  | 'scenes'
  | 'epics'
  | 'rules'
  | 'pages'
  | 'nfr'
  | 'issues'
  | 'glossary'
  | 'acceptance'

export interface TemplateSectionDef {
  id: string
  title: string
  level: 2 | 3
  kind: TemplateSectionKind
  guidance: string
  required: boolean
}

export interface RequirementTemplate {
  id: string
  name: string
  stage: TemplateStage
  category: string
  description: string
  prompt: string
  sections: TemplateSectionDef[]
  builtin: boolean
  visibility: 'builtin' | 'private'
  createdAt: string
  updatedAt: string
}

export type RequirementDocStatus = 'draft' | 'review' | 'confirmed'
/** R2b 版本来源：自动保存不产版本，关键节点/手动保存生成 checkpoint */
export type RequirementDocVersionSource = 'ai' | 'manual' | 'template-change' | 'confirm' | 'rollback' | 'restore'

/** 结构化章节（H1）：稳定 ID 不随标题编辑变化 */
export interface OutlineScene {
  id: string
  title: string
  description: string
  position: number
  archived?: boolean
}

export interface OutlineEpic {
  id: string
  title: string
  goal: string
  priority: string
  sceneId: string | null
  position: number
  archived?: boolean
}

export interface OutlineStory {
  id: string
  epicId: string | null
  title: string
  description: string
  acceptance: string[]
  priority: string
  status?: string
  position: number
  archived?: boolean
}

export interface RequirementOutlineData {
  scenes: OutlineScene[]
  epics: OutlineEpic[]
  stories: OutlineStory[]
}

export interface RequirementDocSection {
  sectionKey: string
  title: string
  level: 2 | 3
  kind: TemplateSectionKind
  markdown: string
  data?: RequirementOutlineData
  required: boolean
  position: number
  updatedAt: string
}

export interface RequirementDoc {
  appId: string
  templateId: string
  title: string
  contentMd: string
  status: RequirementDocStatus
  version: number
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
}

export interface RequirementDocPayload {
  doc: RequirementDoc
  template: RequirementTemplate
  sections: RequirementDocSection[]
  warnings?: string[]
}

export interface DocIssue {
  sectionKey?: string
  title?: string
  message: string
}

export interface DocVersionMeta {
  version: number
  source: RequirementDocVersionSource
  createdAt: string
  title: string
  size: number
  /** 版本所属变更单（无变更时 null） */
  changeSetId?: string | null
  changeSetSeq?: number | null
}

export interface DocVersionDetail extends DocVersionMeta {
  contentMd: string
  sections: RequirementDocSection[]
}

export interface NextStep {
  label: string
  prompt: string
}

/** AI 建议 diff（R2a）：与 doc-diff.js 输出的纯数据结构一致 */
export type DocSuggestionChange = 'added' | 'modified' | 'unchanged' | 'removed'

export interface DocDiffLine {
  type: ' ' | '+' | '-'
  text: string
}

export interface DocDiffSection {
  sectionKey: string
  title: string
  titleBefore?: string
  titleChanged?: boolean
  level: 2 | 3
  kind: TemplateSectionKind
  markdown: string
  markdownBefore?: string
  lineDiff?: DocDiffLine[]
  data?: RequirementOutlineData
  required: boolean
  change: DocSuggestionChange
}

export interface DocSuggestionCounts {
  added: number
  modified: number
  removed: number
  unchanged: number
}

/** 随对话消息持久化的 AI 建议（未应用前不改文档） */
export interface DocSuggestion {
  title: string
  titleBefore: string
  titleChanged: boolean
  sections: DocDiffSection[]
  counts: DocSuggestionCounts
  warnings: string[]
  openIssues: Array<{ question: string }>
  /** 生成建议时的文档版本；应用前版本变化则视为过期 */
  baseVersion: number
  source: 'preview' | 'local'
  applied?: { version: number; sectionCount: number; removedCount: number } | null
  ignored?: boolean
}

export interface DocPreviewSection {
  sectionKey: string
  title: string
  level: 2 | 3
  kind: TemplateSectionKind
  markdown: string
  data?: RequirementOutlineData
  required: boolean
  change: 'added' | 'modified' | 'unchanged'
}

export interface DocPreviewResponse {
  title: string
  sections: DocPreviewSection[]
  removed: Array<{ sectionKey: string; title: string; required: boolean }>
  warnings: string[]
  baseVersion: number
  docStatus: RequirementDocStatus
}

// ------------------------------------------------------------ 模块（M3）

export interface RequirementModule {
  id: string
  appId: string
  moduleKey: string
  title: string
  description: string
  ownerLabel: string
  required: boolean
  archived: boolean
  archivedAt: string | null
  position: number
  docStatus: RequirementDocStatus | null
  docVersion: number | null
  docUpdatedAt: string | null
  templateId: string | null
  createdAt: string
  updatedAt: string
}

export interface RequirementModuleList {
  modules: RequirementModule[]
  defaultModuleId: string | null
  /** RMP-2：当前已应用模块计划类型（无规划为 null；用于 RMP-1 旧建议卡禁用“重新生成全部模块”） */
  planKind: 'initial' | 'replan' | null
}

export interface RequirementBundleModule {
  moduleId: string
  moduleKey: string
  title: string
  required: boolean
  position: number
  hasDoc: boolean
  docVersion: number
  docHash: string
  confirmed: boolean
}

export interface RequirementBundle {
  appId: string
  /** 当前各模块内容的实时聚合 hash（可能尚未落库） */
  bundleHash: string
  modules: RequirementBundleModule[]
  allRequiredConfirmed: boolean
  pendingModuleIds: string[]
  latest: { version: number; hash: string; changeSetId: string | null; createdAt: string } | null
}

export interface ConfirmBundleResult {
  bundle: RequirementBundle
  appConfirmed: boolean
  alreadyConfirmed: boolean
  pendingModuleIds: string[]
  appStatus: string | null
  requirementsConfirmedAt: string | null
}

export interface AppTemplateModuleImpact {
  moduleId: string
  moduleKey: string
  title: string
  docStatus: RequirementDocStatus
  docVersion: number
  fromSections: number
  toSections: number
  kept: number
  dropped: Array<{ sectionKey: string; title: string }>
  added: Array<{ sectionKey: string; title: string }>
  warnings: string[]
}

export interface AppTemplatePreview {
  template: { id: string; name: string }
  scope: 'app'
  modules: AppTemplateModuleImpact[]
  blockedModules: Array<{ moduleId: string; moduleKey: string; title: string; reason: 'confirmed' }>
  canApply: boolean
  warnings: string[]
}

export interface AppTemplateSwitchModuleResult extends AppTemplateModuleImpact {
  version: number
  sectionCount: number
}

export interface AppTemplateSwitchResult {
  appId: string
  template: { id: string; name: string }
  scope: 'app'
  modules: AppTemplateSwitchModuleResult[]
}

/** 读接口的 moduleId query 由 `api-query.js` 提供（纯函数，便于单测）；空值不拼参数（= 默认模块） */


/** 需求阶段只读原型预览（M7 / #8）+ AI 参考原型规格（M7-2）：Epic 范围 + 实体/字段/页面规格，不写设计数据 */
export type RequirementsPreviewPageType =
  | 'list'
  | 'form'
  | 'detail'
  | 'dashboard'
  | 'kanban'
  | 'calendar'
  | 'gantt'
  | 'custom'

export type RequirementsPreviewTemplateSource = 'design-project' | 'app-default' | 'global-default'

export interface RequirementsPreviewTemplate {
  id: string
  name: string
  category: string
  source: RequirementsPreviewTemplateSource
  tokens: {
    primary: string
    accent: string
    neutral: string
    background: string
    font: string
    radius: number
    spacing: number
    density: 'compact' | 'comfortable'
  }
  shell: { type: 'sidebar' | 'topbar'; sidebarDark: boolean; contentWidth?: number }
  patterns: {
    list: { filters: boolean; rowActions: boolean; pagination: boolean; selection?: boolean }
    form: { presentation: 'dialog' | 'page'; labelPosition: 'top' | 'left'; groups: boolean }
    detail: { sections: boolean; relatedLists?: boolean }
  }
  pageSetRules: {
    defaultPages: string[]
    formModes: string[]
    createAs: string
    editAs: string
    defaultPageSize: number
    defaultSearchFields: number
  }
}

export interface RequirementsPreviewPage {
  key: string
  storyId: string
  title: string
  type: RequirementsPreviewPageType
  priority: string
  summary: string
}

export interface RequirementsPreviewPageSet {
  key: string
  epicId: string | null
  title: string
  goal: string
  priority: string
  pages: RequirementsPreviewPage[]
}

export interface RequirementsPreviewWarning {
  code: 'no-module' | 'no-epics' | 'epic-without-story' | 'story-without-title' | 'unassigned-stories'
  message: string
  epicId?: string
  storyId?: string
}

export interface RequirementsPreviewModule {
  id: string
  key: string
  title: string
  archived: boolean
  hasDoc: boolean
  docVersion: number
  docStatus: RequirementDocStatus
  docUpdatedAt: string | null
}

export type RequirementsSpecFieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'time'
  | 'boolean'
  | 'enum'
  | 'ref'

export interface RequirementsSpecEntityField {
  /** 服务端由 label 生成的稳定 ASCII key（渲染器列/行键） */
  name: string
  label: string
  type: RequirementsSpecFieldType
  required?: boolean
  unique?: boolean
  options?: string[]
  /** ref 目标实体 id（PE-n） */
  target?: string
  note?: string
}

export interface RequirementsSpecEntity {
  id: string
  name: string
  description: string
  fields: RequirementsSpecEntityField[]
}

export interface RequirementsSpecPage {
  id: string
  title: string
  type: RequirementsPreviewPageType
  epicId: string | null
  storyIds: string[]
  entityId: string | null
  /** 页面使用的实体字段 name */
  fields: string[]
  actions: string[]
}

/** 预览规格（M7-2）：存 app_settings，不进设计阶段/交接包 */
export interface RequirementsPrototypeSpec {
  schema: string
  generatedAt: string
  model: string | null
  base: { docVersion: number; docUpdatedAt: string | null }
  entities: RequirementsSpecEntity[]
  pages: RequirementsSpecPage[]
  notes: string[]
  stats: { entities: number; fields: number; pages: number }
}

export interface RequirementsSpecCoverage {
  stories: number
  coveredStories: number
  uncoveredStoryIds: string[]
}

export interface RequirementsSpecState {
  status: 'missing' | 'ready' | 'stale'
  staleReason: 'doc-changed' | null
  coverage: RequirementsSpecCoverage
}

export interface RequirementsPrototypePreview {
  appId: string
  generatedAt: string
  module: RequirementsPreviewModule | null
  template: RequirementsPreviewTemplate | null
  pageSets: RequirementsPreviewPageSet[]
  stats: { epics: number; stories: number; pages: number; unmappedStories: number }
  warnings: RequirementsPreviewWarning[]
  /** 未生成时为 null */
  spec: RequirementsPrototypeSpec | null
  specState: RequirementsSpecState
}


export class DocApiError extends Error {
  readonly status: number
  readonly issues: DocIssue[]
  readonly warnings: string[]
  /** 后端诊断片段（例如原型生成失败时的模型原始输出片段；无则空串） */
  readonly detail: string

  constructor(status: number, message: string, issues: DocIssue[] = [], warnings: string[] = [], detail = '') {
    super(message)
    this.status = status
    this.issues = issues
    this.warnings = warnings
    this.detail = typeof detail === 'string' ? detail : ''
  }
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...(signal ? { signal } : {})
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const payload = (data ?? {}) as { error?: unknown; issues?: unknown; warnings?: unknown; detail?: unknown }
    throw new DocApiError(
      res.status,
      typeof payload.error === 'string' ? payload.error : `请求失败（HTTP ${res.status}）`,
      Array.isArray(payload.issues) ? (payload.issues as DocIssue[]) : [],
      Array.isArray(payload.warnings) ? (payload.warnings as string[]) : [],
      typeof payload.detail === 'string' ? payload.detail : ''
    )
  }
  return data as T
}

export async function listTemplates(params: { stage?: TemplateStage; category?: string; q?: string } = {}): Promise<RequirementTemplate[]> {
  const search = new URLSearchParams()
  if (params.stage) search.set('stage', params.stage)
  if (params.category) search.set('category', params.category)
  if (params.q) search.set('q', params.q)
  const suffix = search.toString()
  const data = await request<{ templates?: RequirementTemplate[] }>('GET', `/requirement-templates${suffix ? `?${suffix}` : ''}`)
  return Array.isArray(data.templates) ? data.templates : []
}

export async function createTemplate(input: Partial<RequirementTemplate>): Promise<RequirementTemplate> {
  const data = await request<{ template: RequirementTemplate }>('POST', '/requirement-templates', input)
  return data.template
}

export async function updateTemplate(id: string, input: Partial<RequirementTemplate>): Promise<RequirementTemplate> {
  const data = await request<{ template: RequirementTemplate }>('PUT', `/requirement-templates/${encodeURIComponent(id)}`, input)
  return data.template
}

export async function deleteTemplate(id: string): Promise<void> {
  await request<{ ok: true }>('DELETE', `/requirement-templates/${encodeURIComponent(id)}`)
}

export async function duplicateTemplate(id: string, name?: string): Promise<RequirementTemplate> {
  const data = await request<{ template: RequirementTemplate }>(
    'POST',
    `/requirement-templates/${encodeURIComponent(id)}/duplicate`,
    name ? { name } : {}
  )
  return data.template
}

export async function getRequirementDoc(appId: string, templateId?: string, moduleId?: string): Promise<RequirementDocPayload> {
  const search = new URLSearchParams()
  if (templateId) search.set('templateId', templateId)
  if (moduleId) search.set('moduleId', moduleId)
  const suffix = search.toString()
  return request<RequirementDocPayload>('GET', `/apps/${encodeURIComponent(appId)}/requirements-doc${suffix ? `?${suffix}` : ''}`)
}

/** 需求阶段只读原型预览（M7）：不写库/不产文件/不调模型 */
export async function getRequirementsPrototype(
  appId: string,
  moduleId?: string,
  signal?: AbortSignal
): Promise<RequirementsPrototypePreview> {
  return request<RequirementsPrototypePreview>(
    'GET',
    `/apps/${encodeURIComponent(appId)}/requirements-prototype${moduleQuery(moduleId)}`,
    undefined,
    signal
  )
}

/**
 * M7-2：生成/重新生成 AI 参考原型规格（写 app_settings 一个键；不写需求/设计/交接包）。
 * 失败/取消不覆盖旧规格。
 */
export async function generateRequirementsPrototypeSpec(
  appId: string,
  moduleId?: string,
  signal?: AbortSignal
): Promise<{ spec: RequirementsPrototypeSpec; specState: RequirementsSpecState }> {
  return request<{ spec: RequirementsPrototypeSpec; specState: RequirementsSpecState }>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-prototype/spec${moduleQuery(moduleId)}`,
    { regenerate: true },
    signal
  )
}

export async function saveDocSection(
  appId: string,
  key: string,
  input: { markdown?: string; data?: RequirementOutlineData; title?: string; snapshot?: boolean },
  moduleId?: string
): Promise<RequirementDocPayload> {
  return request<RequirementDocPayload>(
    'PUT',
    `/apps/${encodeURIComponent(appId)}/requirements-doc/sections/${encodeURIComponent(key)}`,
    moduleId ? { ...input, moduleId } : input
  )
}

export async function saveDocFull(
  appId: string,
  input: {
    contentMd?: string
    sections?: Array<{
      id?: string
      sectionKey?: string
      title?: string
      markdown?: string
      level?: 2 | 3
      data?: RequirementOutlineData
    }>
    title?: string
    source?: 'ai' | 'manual'
    snapshot?: boolean
    /** AI 建议应用：仅删除 custom-* 且非必填章节 */
    removeSectionKeys?: string[]
  },
  moduleId?: string
): Promise<RequirementDocPayload> {
  return request<RequirementDocPayload>(
    'PUT',
    `/apps/${encodeURIComponent(appId)}/requirements-doc`,
    moduleId ? { ...input, moduleId } : input
  )
}

/** AI 建议预览（R2a）：不写库、不产版本 */
export async function previewRequirementDoc(
  appId: string,
  input: {
    contentMd?: string
    sections?: Array<{
      id?: string
      sectionKey?: string
      title?: string
      markdown?: string
      level?: 2 | 3
      kind?: string
      data?: RequirementOutlineData
    }>
    title?: string
  },
  moduleId?: string
): Promise<DocPreviewResponse> {
  return request<DocPreviewResponse>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-doc/preview`,
    moduleId ? { ...input, moduleId } : input
  )
}

/** 从 Markdown 确定性重建结构化章节（H1） */
export async function rebuildRequirementOutline(
  appId: string,
  sectionKey?: string,
  moduleId?: string
): Promise<RequirementDocPayload> {
  return request<RequirementDocPayload>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-doc/outline/rebuild`,
    { ...(sectionKey ? { sectionKey } : {}), ...(moduleId ? { moduleId } : {}) }
  )
}

/** 重新编辑需求：文档回 draft、应用回需求阶段（H4） */
export async function reopenRequirementDoc(appId: string, moduleId?: string): Promise<RequirementDocPayload> {
  return request<RequirementDocPayload>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-doc/reopen`,
    moduleId ? { moduleId } : {}
  )
}

/** 单模块切换模板（旧行为；需求 UI 用应用级切换 previewAppTemplate/switchAppTemplate） */
export async function switchDocTemplate(
  appId: string,
  templateId: string,
  moduleId?: string
): Promise<RequirementDocPayload> {
  return request<RequirementDocPayload>('PUT', `/apps/${encodeURIComponent(appId)}/requirements-doc/template`, {
    templateId,
    ...(moduleId ? { moduleId } : {})
  })
}

/** 应用级模板切换预览（M3）：只读、不写库、不产版本 */
export async function previewAppTemplate(appId: string, templateId: string): Promise<AppTemplatePreview> {
  return request<AppTemplatePreview>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-doc/template/preview`,
    { templateId, scope: 'app' }
  )
}

/** 应用级模板切换（M3）：所有未归档模块一起跟随，二次确认后调用 */
export async function switchAppTemplate(appId: string, templateId: string): Promise<AppTemplateSwitchResult> {
  return request<AppTemplateSwitchResult>('PUT', `/apps/${encodeURIComponent(appId)}/requirements-doc/template`, {
    templateId,
    scope: 'app'
  })
}

export interface ConfirmDocResponse extends RequirementDocPayload {
  warnings: string[]
  alreadyConfirmed: boolean
  /** 单模块确认后应用级是否已确认（多模块时为 false，需 bundle confirm） */
  appConfirmed?: boolean
  pendingModuleIds?: string[]
  module?: RequirementModule | null
  bundleVersion?: number
}

export async function confirmRequirementDoc(appId: string, moduleId?: string): Promise<ConfirmDocResponse> {
  return request<ConfirmDocResponse>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-doc/confirm`,
    moduleId ? { moduleId } : {}
  )
}

export async function listDocVersions(appId: string, moduleId?: string): Promise<DocVersionMeta[]> {
  const data = await request<{ versions?: DocVersionMeta[] }>(
    'GET',
    `/apps/${encodeURIComponent(appId)}/requirements-doc/versions${moduleQuery(moduleId)}`
  )
  return Array.isArray(data.versions) ? data.versions : []
}

/** 手动“保存版本”（R2b）：调用前应先 flush 未保存编辑；文档已确认时后端返回 409 */
export async function createDocVersion(appId: string, moduleId?: string): Promise<RequirementDocPayload> {
  return request<RequirementDocPayload>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-doc/versions`,
    moduleId ? { moduleId } : {}
  )
}

export async function getDocVersion(appId: string, version: number, moduleId?: string): Promise<DocVersionDetail> {
  const data = await request<{ version: DocVersionDetail }>(
    'GET',
    `/apps/${encodeURIComponent(appId)}/requirements-doc/versions/${version}${moduleQuery(moduleId)}`
  )
  return data.version
}

export async function rollbackDocVersion(appId: string, version: number, moduleId?: string): Promise<RequirementDocPayload> {
  return request<RequirementDocPayload>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-doc/versions/${version}/rollback`,
    moduleId ? { moduleId } : {}
  )
}

export async function exportRequirementDoc(
  appId: string,
  moduleId?: string
): Promise<{ filename: string; content: string; version: number; status: RequirementDocStatus }> {
  return request('GET', `/apps/${encodeURIComponent(appId)}/requirements-doc/export${moduleQuery(moduleId)}`)
}

export interface DocChatMessage {
  id: string
  role: 'user' | 'assistant' | 'notice'
  content: string
  time: string
  focusSectionKey?: string
  nextSteps?: NextStep[]
  /** AI 建议（R2a）：随消息持久化，刷新后仍可应用/忽略 */
  suggestion?: DocSuggestion
  /** RMP-1：首次模块拆分建议（随消息持久化，刷新后恢复建议卡） */
  modulePlan?: ModulePlan
  /** G1：模块级操作意图守卫的指引元数据（随消息持久化，刷新后恢复指引卡） */
  metadata?: DocChatMetadata
}

/** G1：服务端守卫返回的模块操作指引（meta 帧 `moduleAction='guidance'`） */
export interface DocChatGuidanceAction {
  action: 'create-module' | 'open-replan' | 'reopen-requirements' | 'open-change-set'
}

export interface DocChatMetadata {
  moduleAction: 'guidance'
  stage: 'requirements' | 'design' | 'development'
  changeSet: { seq: number; scope: string } | null
  suggestions: DocChatGuidanceAction[]
}

export async function getDocChat(
  appId: string,
  moduleId?: string
): Promise<{ messages: DocChatMessage[]; legacyFallback: boolean }> {
  const data = await request<{ messages?: DocChatMessage[]; legacyFallback?: boolean }>(
    'GET',
    `/apps/${encodeURIComponent(appId)}/requirements-doc/chat${moduleQuery(moduleId)}`
  )
  return { messages: Array.isArray(data.messages) ? data.messages : [], legacyFallback: data.legacyFallback === true }
}

export async function saveDocChat(appId: string, messages: DocChatMessage[], moduleId?: string): Promise<void> {
  await request<{ ok: true }>('PUT', `/apps/${encodeURIComponent(appId)}/requirements-doc/chat`, {
    messages,
    ...(moduleId ? { moduleId } : {})
  })
}

// ------------------------------------------------------------ 模块 API（M3）

export async function listRequirementModules(appId: string, includeArchived = false): Promise<RequirementModuleList> {
  const data = await request<{ modules?: RequirementModule[]; defaultModuleId?: string | null; planKind?: string | null }>(
    'GET',
    `/apps/${encodeURIComponent(appId)}/requirements-modules${includeArchived ? '?includeArchived=true' : ''}`
  )
  return {
    modules: Array.isArray(data.modules) ? data.modules : [],
    defaultModuleId: typeof data.defaultModuleId === 'string' ? data.defaultModuleId : null,
    planKind: data.planKind === 'initial' || data.planKind === 'replan' ? data.planKind : null
  }
}

export interface CreateModuleInput {
  title: string
  description?: string
  ownerLabel?: string
  required?: boolean
}

export async function createRequirementModule(appId: string, input: CreateModuleInput): Promise<RequirementModule> {
  const data = await request<{ module: RequirementModule }>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-modules`,
    input
  )
  return data.module
}

export async function updateRequirementModule(
  appId: string,
  moduleId: string,
  input: { title?: string; description?: string; ownerLabel?: string; required?: boolean; position?: number }
): Promise<RequirementModule> {
  const data = await request<{ module: RequirementModule }>(
    'PATCH',
    `/apps/${encodeURIComponent(appId)}/requirements-modules/${encodeURIComponent(moduleId)}`,
    input
  )
  return data.module
}

export async function archiveRequirementModule(appId: string, moduleId: string): Promise<RequirementModule> {
  const data = await request<{ module: RequirementModule }>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-modules/${encodeURIComponent(moduleId)}/archive`
  )
  return data.module
}

export async function restoreRequirementModule(appId: string, moduleId: string): Promise<RequirementModule> {
  const data = await request<{ module: RequirementModule }>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-modules/${encodeURIComponent(moduleId)}/restore`
  )
  return data.module
}

/** 排序：moduleIds 必须与全部未归档模块 id 集合完全一致（否则后端 400） */
export async function reorderRequirementModules(appId: string, moduleIds: string[]): Promise<RequirementModule[]> {
  const data = await request<{ modules?: RequirementModule[] }>(
    'PUT',
    `/apps/${encodeURIComponent(appId)}/requirements-modules/order`,
    { moduleIds }
  )
  return Array.isArray(data.modules) ? data.modules : []
}

export async function getRequirementBundle(appId: string): Promise<RequirementBundle> {
  const data = await request<{ bundle: RequirementBundle }>(
    'GET',
    `/apps/${encodeURIComponent(appId)}/requirements-bundle`
  )
  return data.bundle
}

/** 应用级“完成需求阶段”：全部必选未归档模块确认后生成 bundle + 进入设计 */
export async function confirmRequirementBundle(appId: string): Promise<ConfirmBundleResult> {
  return request<ConfirmBundleResult>('POST', `/apps/${encodeURIComponent(appId)}/requirements-bundle/confirm`)
}

// ------------------------------------------------------------ 首次模块规划（RMP-1）

export interface ModulePlanEpicSuggestion {
  title: string
  stories: string[]
}

export interface ModulePlanModule {
  /** AI 临时 key（依赖/覆盖引用） */
  key: string
  title: string
  description: string
  scope: string[]
  suggestedEpics: ModulePlanEpicSuggestion[]
  existingModuleId: string | null
  action: string
}

export interface ModulePlanDependency {
  from: string
  to: string
  description: string
}

export interface ModulePlanCoverage {
  requirement: string
  moduleKey: string
}

export interface ModulePlanUnassigned {
  requirement: string
  reason: string
}

export interface ModulePlan {
  /** RMP-1 首次规划 / RMP-2 重新规划 */
  kind: 'initial' | 'replan'
  /** RMP-2：重新规划的调整指令 */
  instruction?: string
  modules: ModulePlanModule[]
  dependencies: ModulePlanDependency[]
  coverage: ModulePlanCoverage[]
  unassigned: ModulePlanUnassigned[]
  openIssues: string[]
  warnings: string[]
}

export interface AppliedModulePlanModule extends ModulePlanModule {
  moduleId: string
  moduleKey: string
}

export interface AppliedModulePlan extends Omit<ModulePlan, 'modules'> {
  modules: AppliedModulePlanModule[]
}

export interface ModulePlanApplyModule {
  id: string
  moduleKey: string
  title: string
  position: number
}

export interface ModulePlanApplyResult {
  modules: ModulePlanApplyModule[]
  created: ModulePlanApplyModule[]
  reused: ModulePlanApplyModule | null
  generation: Array<{ moduleId: string; title: string }>
}

/** 应用首次模块拆分（复用默认模块 + 新建其余；不生成文档） */
export async function applyRequirementModulePlan(appId: string, plan: ModulePlan): Promise<ModulePlanApplyResult> {
  return request<ModulePlanApplyResult>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-modules/plan/apply`,
    { plan }
  )
}

// ------------------------------------------------------------ 随时重新规划（RMP-2）

export type ModuleReplanAction = 'keep' | 'rename' | 'regenerate' | 'create'

export interface ModuleReplanCurrentModule {
  id: string
  moduleKey: string
  title: string
  description: string
  status: RequirementDocStatus
  version: number
  scope: string[]
  confirmed: boolean
}

export interface ModuleReplanArchiveModule {
  id: string
  moduleKey: string
  title: string
  status: RequirementDocStatus
}

export interface ModuleReplanConfirmedModule {
  id: string
  moduleKey: string
  title: string
}

export interface ModuleReplanPreview {
  plan: ModulePlan
  reply: string
  currentModules: ModuleReplanCurrentModule[]
  archiveModules: ModuleReplanArchiveModule[]
  confirmedModules: ModuleReplanConfirmedModule[]
  requiresReopenConfirmed: boolean
  errors: string[]
  warnings: string[]
  sourceTruncated: boolean
}

export interface ModuleReplanAppliedModule {
  id: string
  moduleKey: string
  title: string
  position: number
}

export interface ModuleReplanApplyResult {
  modules: ModuleReplanAppliedModule[]
  kept: ModuleReplanAppliedModule[]
  renamed: ModuleReplanAppliedModule[]
  regenerated: ModuleReplanAppliedModule[]
  created: ModuleReplanAppliedModule[]
  archived: ModuleReplanAppliedModule[]
  reopened: ModuleReplanAppliedModule[]
  generation: Array<{ moduleId: string; title: string }>
  instruction: string
  sourceTruncated: boolean
}

/** RMP-2 预览重新规划（只读；模型失败/非法 JSON 返回可读错误，不写库） */
export async function previewModuleReplan(
  appId: string,
  instruction: string,
  signal?: AbortSignal
): Promise<ModuleReplanPreview> {
  return request<ModuleReplanPreview>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-modules/replan/preview`,
    { instruction },
    signal
  )
}

/** RMP-2 应用重新规划结构（不生成文档；generation 由调用方接着调 streamModuleGeneration） */
export async function applyModuleReplan(
  appId: string,
  plan: ModulePlan,
  reopenConfirmed: boolean
): Promise<ModuleReplanApplyResult> {
  return request<ModuleReplanApplyResult>(
    'POST',
    `/apps/${encodeURIComponent(appId)}/requirements-modules/replan/apply`,
    { plan, reopenConfirmed }
  )
}

export type ModuleGenerationReason = 'initial' | 'single' | 'retry' | 'replan'

export interface ModuleGenerationEvent {
  type: 'module-start' | 'module-done' | 'module-error' | 'all-done'
  moduleId?: string
  moduleKey?: string
  title?: string
  index?: number
  total?: number
  version?: number
  warnings?: string[]
  error?: string
  ok?: boolean
  cancelled?: boolean
  failed?: Array<{ moduleId: string; error: string }>
}

// ---- 前端 UI 状态（与 module-plan-helpers.js 的状态机输出一致） ----

export type ModuleGenerationItemStatus = 'waiting' | 'running' | 'done' | 'error' | 'skipped' | 'cancelled'

export interface ModuleGenerationItem {
  moduleId: string
  title: string
  status: ModuleGenerationItemStatus
  version: number | null
  warnings: string[]
  error: string
}

export interface ModuleGenerationUiState {
  reason: ModuleGenerationReason | string
  running: boolean
  cancelled: boolean
  ok: boolean | null
  globalError: string
  items: ModuleGenerationItem[]
}

export type ModulePlanUiStatus = 'idle' | 'applying' | 'generating' | 'done' | 'error'

export interface ModulePlanUiState {
  status: ModulePlanUiStatus
  mode: 'split' | 'single' | null
  error: string
  applied: ModulePlanApplyResult | null
  generation: ModuleGenerationUiState | null
}

/**
 * 逐模块生成（SSE）：`POST /apps/:id/requirements-modules/generate`
 * 帧：module-start / module-done / module-error / all-done；校验错误按普通 HTTP 错误返回。
 */
export async function streamModuleGeneration(
  appId: string,
  payload: { moduleIds?: string[]; reason: ModuleGenerationReason },
  onEvent: (event: ModuleGenerationEvent) => void,
  signal?: AbortSignal,
  timeoutMs = 600000
): Promise<void> {
  const effectiveSignal =
    signal ?? (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined)

  let response: Response
  try {
    response = await fetch(`/api/apps/${encodeURIComponent(appId)}/requirements-modules/generate`, {
      method: 'POST',
      signal: effectiveSignal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') throw new Error(`模块生成超时（${Math.round(timeoutMs / 1000)} 秒）`)
    if (err instanceof DOMException && err.name === 'AbortError') throw new Error('模块生成已中止')
    throw err
  }

  if (!response.ok || !response.body) {
    const text = await response
      .text()
      .catch(() => '')
      .then(value => value.slice(0, 300))
    let message = `模块生成失败（HTTP ${response.status}）${text ? `：${text}` : ''}`
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
      let frame: ModuleGenerationEvent | null = null
      try {
        frame = JSON.parse(dataLines.join('\n')) as ModuleGenerationEvent
      } catch {
        continue
      }
      if (!frame || typeof frame.type !== 'string') continue
      onEvent(frame)
      if (frame.type === 'all-done') return
    }
  }
}

export interface DocChatRequestMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * doc 模式聊天：POST /api/apps/:id/chat { mode:'doc', templateId, focusSectionKey, messages }
 * SSE 帧：{type:'meta'|'delta'|'done'|'error'}
 */
export async function streamDocChat(
  appId: string,
  payload: { messages: DocChatRequestMessage[]; templateId?: string; focusSectionKey?: string; moduleId?: string; mode?: 'doc' | 'doc-plan' },
  onDelta: (text: string) => void,
  signal?: AbortSignal,
  timeoutMs = 600000,
  onMeta?: (meta: Partial<DocChatMetadata> & { mode?: string; sessionID?: string; agent?: string }) => void
): Promise<string> {
  const effectiveSignal =
    signal ?? (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined)

  let response: Response
  try {
    response = await fetch(`/api/apps/${encodeURIComponent(appId)}/chat`, {
      method: 'POST',
      signal: effectiveSignal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: 'requirements',
        mode: payload.mode === 'doc-plan' ? 'doc-plan' : 'doc',
        templateId: payload.templateId,
        focusSectionKey: payload.focusSectionKey,
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
      .then(value => value.slice(0, 300))
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
      let frame: { type?: string; text?: string; message?: string } & Record<string, unknown>
      try {
        frame = JSON.parse(dataLines.join('\n')) as { type?: string; text?: string; message?: string } & Record<string, unknown>
      } catch {
        continue
      }
      if (frame.type === 'meta') {
        if (onMeta) {
          onMeta({
            mode: typeof frame.mode === 'string' ? frame.mode : undefined,
            sessionID: typeof frame.sessionID === 'string' ? frame.sessionID : undefined,
            agent: typeof frame.agent === 'string' ? frame.agent : undefined,
            ...(frame.moduleAction === 'guidance'
              ? {
                  moduleAction: 'guidance' as const,
                  stage: (frame.stage as DocChatMetadata['stage']) ?? 'requirements',
                  changeSet:
                    frame.changeSet && typeof frame.changeSet === 'object'
                      ? (frame.changeSet as DocChatMetadata['changeSet'])
                      : null,
                  suggestions: Array.isArray(frame.suggestions)
                    ? (frame.suggestions as DocChatMetadata['suggestions'])
                    : []
                }
              : {})
          })
        }
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

export function templateStageLabel(stage: TemplateStage): string {
  if (stage === 'requirements') return '需求'
  if (stage === 'design') return '设计'
  if (stage === 'test') return '测试'
  return '开发计划'
}

export const SECTION_KIND_LABELS: Record<TemplateSectionKind, string> = {
  markdown: '正文',
  meta: '文档信息',
  metrics: '指标',
  roles: '角色',
  scenes: '场景',
  epics: 'Epics/故事',
  rules: '业务规则',
  pages: '页面',
  nfr: '非功能',
  issues: '待澄清',
  glossary: '术语',
  acceptance: '验收'
}
