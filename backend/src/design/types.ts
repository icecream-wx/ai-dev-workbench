/** 设计阶段（实体 + 页面原型）数据类型（D1—D4） */

export type PrototypeTemplateCategory = 'enterprise' | 'minimal' | 'mobile' | 'custom'
export type PrototypeDensity = 'compact' | 'comfortable'
export type PrototypeShellType = 'sidebar' | 'topbar'
export type PrototypeVisibility = 'builtin' | 'private'

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

export type PrototypePageType = 'list' | 'form' | 'detail' | 'dashboard' | 'kanban' | 'gantt' | 'calendar'
export type PrototypePageMode = 'dialog' | 'page'

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
  visibility: PrototypeVisibility
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

export type DesignItemStatus = 'draft' | 'confirmed'

export interface DesignEntity {
  id: string
  name: string
  tableName: string
  description: string
  fields: DesignField[]
  relations: DesignRelation[]
  /** 来源需求条目：STORY/EPIC/SCENE 稳定 ID（H2） */
  requirementRefs: string[]
  /** 来源需求章节 key（如 epics / rules） */
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
  /** 表单页语义：创建/编辑/两者；仅 form 页使用 */
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
  /** 来源需求条目稳定 ID（H2） */
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
  /** 对应需求 Epic（有 Epic 时优先；没有时为空） */
  epicId: string | null
  /** 页面集覆盖的 Story 稳定 ID */
  storyIds: string[]
  title: string
  description: string
  status: DesignItemStatus
  position: number
  pages: DesignPage[]
  /** 由页面绑定实体汇总；页面集可引用多个实体 */
  entityIds: string[]
  createdAt: string
  updatedAt: string
}

export type DesignProjectStatus = 'draft' | 'review' | 'confirmed'
/**
 * 设计版本来源（R2c）：
 * - ai：AI 生成/应用实体或页面集；manual：手动“保存版本”/默认页面集生成；
 * - template-change：切换原型模板；confirm：确认设计；sync：同步设计输入；
 * - rollback：版本回滚；restore：变更取消恢复。
 */
export type DesignVersionSource =
  | 'ai'
  | 'manual'
  | 'template-change'
  | 'confirm'
  | 'sync'
  | 'rollback'
  | 'restore'

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

/** M4：当前设计项目所属模块（只读摘要） */
export interface DesignModuleRef {
  id: string
  key: string
  title: string
  status: DesignProjectStatus
}

/** M4：其它模块实体（只读；供跨模块关系/页面绑定选择，跨模块引用只提示不阻塞） */
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
  /** M4：当前模块 */
  module: DesignModuleRef
  /** M4：其它模块实体（只读） */
  otherModuleEntities: DesignOtherModuleEntity[]
  /** M4：应用级设计门禁（全部必选未归档模块已确认） */
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
  /** requirementRefs 校验、覆盖度等非阻塞提示 */
  warnings: string[]
  chat: unknown
}

// ---- 设计输入（H2）：需求 → 设计的确定性快照 ----

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

export interface DesignInputQuestion {
  id: string
  question: string
}

export interface DesignInputGlossaryItem {
  term: string
  definition: string
}

export type DesignInputStructure = 'prd' | 'fallback'

export interface DesignInputBundle {
  id: string
  appId: string
  /** M4：按模块的设计输入（只在同一模块内去重/绑定） */
  moduleId: string
  moduleKey: string
  moduleTitle: string
  docVersion: number
  docHash: string
  /** M5：构建时引用的需求聚合 bundle（最新快照）；无快照为 null */
  bundleVersion: number | null
  bundleHash: string | null
  templateId: string
  templateName: string
  confirmedAt: string | null
  structure: DesignInputStructure
  scenes: DesignInputScene[]
  epics: DesignInputEpic[]
  stories: DesignInputStory[]
  roles: DesignInputRole[]
  dataRules: DesignInputSection
  pageRequirements: DesignInputSection
  nonFunctionals: DesignInputSection
  openQuestions: DesignInputQuestion[]
  glossary: DesignInputGlossaryItem[]
  warnings: string[]
  createdAt: string
}

export interface DesignInputSummary {
  id: string
  docVersion: number
  docHash: string
  structure: DesignInputStructure
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
  /** M5：需求 bundle 快照与最新 bundle 不同（仅提示，不影响 stale/确认门禁） */
  bundleDrift: boolean
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
  structure: DesignInputStructure
  scenes: DesignCoverageItem[]
  epics: DesignCoverageItem[]
  stories: DesignCoverageItem[]
  unlinkedEntities: Array<{ id: string; name: string }>
  unlinkedPages: Array<{ id: string; title: string; pageSetId: string }>
  warnings: string[]
  stats: {
    sceneCount: number
    epicCount: number
    storyCount: number
    coveredStoryCount: number
  }
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

// ---- D-RMP：按 Epic 生成（实体合并 + 页面集 primary 替换） ----

/** 目标 Epic 里已确认、生成会重新打开的项（需显式 reopenConfirmed） */
export interface DesignEpicImpact {
  entities: Array<{ id: string; name: string }>
  pageSets: Array<{ id: string; title: string }>
  pages: Array<{ id: string; title: string; pageSetId: string }>
}

export interface DesignEpicGenerationResult {
  project: DesignProjectPayload
  warnings: string[]
  epicId: string
  /** 本次新增实体数 */
  entitiesAdded: number
  /** 本次按 Epic 更新的已有实体数（合并字段/关系/refs） */
  entitiesUpdated: number
  pageSetId: string
  /** 该页面集本次生成的页面数 */
  pages: number
  /** reopenConfirmed=true 时被退回 draft 的已确认项 id */
  reopened: string[]
}
