/** 设计阶段（实体 + 页面原型）前端类型（D1—D4） */

export type PrototypeTemplateCategory = 'enterprise' | 'minimal' | 'mobile' | 'custom'
export type PrototypeDensity = 'compact' | 'comfortable'
export type PrototypeShellType = 'sidebar' | 'topbar'
export type PrototypePageType = 'list' | 'form' | 'detail' | 'dashboard' | 'kanban' | 'gantt' | 'calendar'
export type PrototypePageMode = 'dialog' | 'page'
export type DesignItemStatus = 'draft' | 'confirmed'
export type DesignProjectStatus = 'draft' | 'review' | 'confirmed'
export type DesignVersionSource = 'ai' | 'manual' | 'template-change' | 'confirm' | 'sync' | 'rollback' | 'restore'

export interface PrototypeTokens {
  primary: string
  accent: string
  neutral: string
  background: string
  font: string
  radius: number
  spacing: number
  density: PrototypeDensity
}

export interface PrototypeShell {
  type: PrototypeShellType
  sidebarDark: boolean
  contentWidth?: number
}

export interface PrototypePatterns {
  list: { filters: boolean; rowActions: boolean; pagination: boolean; selection?: boolean }
  form: { presentation: 'dialog' | 'page'; labelPosition: 'top' | 'left'; groups: boolean }
  detail: { sections: boolean; relatedLists?: boolean }
}

export interface PrototypePageSetRules {
  defaultPages: PrototypePageType[]
  formModes: Array<'create' | 'edit'>
  createAs: PrototypePageMode
  editAs: PrototypePageMode
  defaultPageSize: number
  defaultSearchFields: number
}

export interface PrototypeTemplate {
  id: string
  name: string
  category: PrototypeTemplateCategory
  description: string
  tokens: PrototypeTokens
  shell: PrototypeShell
  patterns: PrototypePatterns
  pageSetRules: PrototypePageSetRules
  prompt: string
  builtin: boolean
  visibility: 'builtin' | 'private'
  previewPath?: string
  createdAt: string
  updatedAt: string
}

export type DesignFieldType =
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

export interface DesignField {
  name: string
  label: string
  type: DesignFieldType
  required?: boolean
  unique?: boolean
  default?: string | number | boolean | null
  options?: string[]
  ref?: string
  length?: number
  precision?: number
  note?: string
}

export type DesignRelationType = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'

export interface DesignRelation {
  name: string
  type: DesignRelationType
  target: string
  sourceField?: string
  targetField?: string
  description?: string
}

export interface DesignEntity {
  id: string
  name: string
  tableName: string
  description: string
  fields: DesignField[]
  relations: DesignRelation[]
  requirementRefs: string[]
  sourceSections: string[]
  status: DesignItemStatus
  position: number
  createdAt: string
  updatedAt: string
}

export interface DesignPageSpec {
  fields?: string[]
  actions?: string[]
  searchFields?: string[]
  columns?: string[]
  groups?: Array<{ title: string; fields: string[] }>
  acceptance?: string[]
  states?: string[]
  notes?: string
  description?: string
  mode?: 'create' | 'edit' | 'both'
}

export interface DesignPageLayout {
  table?: { columns?: string[]; searchFields?: string[]; pageSize?: number }
  toolbar?: { actions?: string[] }
  detail?: { columns?: 1 | 2 | 3 }
  stats?: Array<{ label: string; metric: string }>
  charts?: Array<{ type: 'bar' | 'line' | 'pie'; metric: string; dimension: string; title?: string }>
  groupMode?: 'groups' | 'tabs'
}

export interface DesignPage {
  id: string
  pageSetId: string
  pageKey: string
  title: string
  type: PrototypePageType
  entityId: string | null
  requirementRefs: string[]
  spec: DesignPageSpec
  layout: DesignPageLayout
  status: DesignItemStatus
  version: number
  imagePath: string | null
  htmlPath: string | null
  imageHash: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export interface DesignPageSet {
  id: string
  sceneKey: string
  epicId: string | null
  storyIds: string[]
  title: string
  description: string
  status: DesignItemStatus
  position: number
  pages: DesignPage[]
  entityIds: string[]
  createdAt: string
  updatedAt: string
}

export interface DesignReadiness {
  ok: boolean
  issues: string[]
  warnings: string[]
  entityCount: number
  confirmedEntityCount: number
  pageSetCount: number
  confirmedPageSetCount: number
  pageCount: number
  confirmedPageCount: number
}

export interface DesignRequirementSource {
  docId: string
  title: string
  version: number
  status: string
  templateId: string
  templateName: string
  contentMd: string
  confirmed: boolean
}

/** M4：当前设计项目所属模块 */
export interface DesignModuleRef {
  id: string
  key: string
  title: string
  status: DesignProjectStatus
}

/** M4：其它模块实体（只读；跨模块关系/页面绑定选择用） */
export interface DesignOtherModuleEntity {
  id: string
  name: string
  tableName: string
  moduleId: string
  moduleKey: string
  moduleTitle: string
}

export interface DesignProjectPayload {
  appId: string
  appName: string
  /** M4 */
  module: DesignModuleRef
  otherModuleEntities: DesignOtherModuleEntity[]
  allModulesConfirmed: boolean
  pendingModuleIds: string[]
  status: DesignProjectStatus
  version: number
  sourceDocVersion: number | null
  sourceInputId: string | null
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  template: PrototypeTemplate
  entities: DesignEntity[]
  pageSets: DesignPageSet[]
  readiness: DesignReadiness
  requirement: DesignRequirementSource | null
  input: DesignInputBundle | null
  inputSummary: DesignInputSummary | null
  latestInput: DesignInputSummary | null
  stale: DesignStaleState
  coverage: DesignCoverage
  warnings: string[]
  chat: unknown
}

// ---- 设计输入 / 覆盖度（H2/H3） ----

export interface DesignInputScene {
  id: string
  title: string
  description: string
  position: number
}

export interface DesignInputStory {
  id: string
  epicId: string | null
  title: string
  description: string
  acceptance: string[]
  priority: string
  position: number
}

export interface DesignInputEpic {
  id: string
  title: string
  goal: string
  priority: string
  sceneId: string | null
  position: number
  stories: DesignInputStory[]
}

export interface DesignInputRole {
  id: string
  name: string
  description: string
}

export interface DesignInputSection {
  sectionKey: string
  markdown: string
}

export interface DesignInputBundle {
  id: string
  appId: string
  /** M4：按模块的设计输入 */
  moduleId: string
  moduleKey: string
  moduleTitle: string
  docVersion: number
  docHash: string
  /** M5：构建时引用的需求聚合 bundle（最新快照）；无快照为 null */
  bundleVersion?: number | null
  bundleHash?: string | null
  templateId: string
  templateName: string
  confirmedAt: string | null
  structure: 'prd' | 'fallback'
  scenes: DesignInputScene[]
  epics: DesignInputEpic[]
  stories: DesignInputStory[]
  roles: DesignInputRole[]
  dataRules: DesignInputSection
  pageRequirements: DesignInputSection
  nonFunctionals: DesignInputSection
  openQuestions: Array<{ id: string; question: string }>
  glossary: Array<{ term: string; definition: string }>
  warnings: string[]
  createdAt: string
}

export interface DesignInputSummary {
  id: string
  docVersion: number
  docHash: string
  structure: 'prd' | 'fallback'
  sceneCount: number
  epicCount: number
  storyCount: number
  createdAt: string
}

export interface DesignStaleState {
  stale: boolean
  designDocVersion: number | null
  latestDocVersion: number | null
  latestInputId: string | null
  reason: string
  /** M5：需求 bundle 快照与最新 bundle 不同（仅提示，不阻塞确认） */
  bundleDrift?: boolean
}

export interface DesignCoverageItem {
  kind: 'scene' | 'epic' | 'story'
  id: string
  title: string
  parentId: string | null
  entityIds: string[]
  pageSetIds: string[]
  pageIds: string[]
  covered: boolean
}

export interface DesignCoverage {
  inputId: string | null
  docVersion: number | null
  structure: 'prd' | 'fallback'
  scenes: DesignCoverageItem[]
  epics: DesignCoverageItem[]
  stories: DesignCoverageItem[]
  unlinkedEntities: Array<{ id: string; name: string }>
  unlinkedPages: Array<{ id: string; title: string; pageSetId: string }>
  warnings: string[]
  stats: { sceneCount: number; epicCount: number; storyCount: number; coveredStoryCount: number }
}

export interface DesignInputDiffEntry {
  id: string
  title: string
  changes: string[]
}

export interface DesignInputDiffGroup {
  added: DesignInputDiffEntry[]
  removed: DesignInputDiffEntry[]
  changed: DesignInputDiffEntry[]
}

export interface DesignInputDiff {
  scenes: DesignInputDiffGroup
  epics: DesignInputDiffGroup
  stories: DesignInputDiffGroup
  totals: { added: number; removed: number; changed: number }
}

export interface DesignSyncAffected {
  entities: Array<{ id: string; name: string; refs: string[] }>
  pages: Array<{ id: string; title: string; pageSetId: string; refs: string[] }>
  pageSets: Array<{ id: string; title: string; epicId: string | null; storyIds: string[] }>
}

export type DesignInputSyncMode = 'preview' | 'additions' | 'regenerate' | 'defer'

export interface DesignInputSyncResult {
  mode: DesignInputSyncMode
  input: DesignInputBundle
  diff: DesignInputDiff
  affected: DesignSyncAffected
  stale: DesignStaleState
  warnings: string[]
  project: DesignProjectPayload
}

export interface DesignVersionMeta {
  version: number
  source: DesignVersionSource
  createdAt: string
  entityCount: number
  pageSetCount: number
  /** 版本写入时的 active 变更单（没有或已删除为 null） */
  changeSetId: string | null
  changeSetSeq: number | null
  changeSetTitle: string | null
}

export interface DesignVersionDetail extends DesignVersionMeta {
  entities: DesignEntity[]
  pageSets: DesignPageSet[]
}

export interface DesignChatMessage {
  id: string
  role: 'user' | 'assistant' | 'notice'
  content: string
  time: string
  focusKind?: 'entity' | 'pageSet' | 'page' | 'epic' | ''
  focusId?: string
  nextSteps?: Array<{ label: string; prompt: string }>
}

export interface NextStep {
  label: string
  prompt: string
}

export const PAGE_TYPE_LABELS: Record<PrototypePageType, string> = {
  list: '列表',
  form: '表单',
  detail: '详情',
  dashboard: '仪表盘',
  kanban: '看板',
  gantt: '甘特',
  calendar: '日历'
}

export const FIELD_TYPE_LABELS: Record<DesignFieldType, string> = {
  string: '文本',
  text: '长文本',
  number: '整数',
  decimal: '小数',
  date: '日期',
  datetime: '日期时间',
  time: '时间',
  boolean: '布尔',
  enum: '枚举',
  ref: '引用'
}

export const RELATION_TYPE_LABELS: Record<DesignRelationType, string> = {
  'one-to-one': '1:1',
  'one-to-many': '1:N',
  'many-to-one': 'N:1',
  'many-to-many': 'N:N'
}

export const TEMPLATE_CATEGORY_LABELS: Record<PrototypeTemplateCategory, string> = {
  enterprise: '企业级',
  minimal: '简洁',
  mobile: '移动端',
  custom: '自定义'
}
