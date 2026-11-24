/**
 * 设计产物渲染契约（与 docs/design/entities.json + pages.json 对齐）
 *
 * 这里只保留渲染/编辑器需要的类型；格式唯一来源是
 * `.opencode/skills/adw-design-artifacts/references/entities.schema.json` 与 `pages.schema.json`。
 */

export type PrototypePageType = 'list' | 'form' | 'detail' | 'dashboard' | 'kanban' | 'gantt' | 'calendar'

/** P7 页面配方（来自设计模板包 pageRecipes） */
export type DesignPageRecipe =
  | 'list'
  | 'tree-list'
  | 'dialog-form'
  | 'page-form'
  | 'main-sub'
  | 'detail'
  | 'dashboard'
  | 'wizard'

export type DesignPaginationLayout = 'bar' | 'split' | 'three-part'

export interface DesignPagination {
  layout?: DesignPaginationLayout
  pageSize?: number
}

export interface DesignFormGroup {
  title?: string
  fields?: string[]
}

export interface DesignFormContract {
  presentation?: 'dialog' | 'page'
  columns?: 1 | 2
  width?: number
  fields?: string[]
  groups?: DesignFormGroup[]
}

export interface DesignTreeContract {
  titleField?: string
  parentField?: string
  actionStyle?: string
  selectionStyle?: string
}

export interface DesignSubTable {
  entity?: string
  title?: string
  columns?: string[]
  mode?: 'tab' | 'flow'
}

/** 应用级设计系统摘要（design.json 顶层可选） */
export interface DesignSystemRef {
  pack?: string
  applicationType?: string
  style?: string
}

export const PAGE_TYPE_LABELS: Record<PrototypePageType, string> = {
  list: '列表',
  form: '表单',
  detail: '详情',
  dashboard: '看板仪表盘',
  kanban: '看板',
  gantt: '甘特图',
  calendar: '日历'
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
  /** 英文字段名（新模型）；旧数据没有 code 时用 name 当键 */
  code?: string
  /** 渲染键（adapter 输出为字段 code；旧数据可能直接用 name 当键） */
  name: string
  /** 中文显示名 */
  label?: string
  type: DesignFieldType
  required?: boolean
  unique?: boolean
  default?: string | number | boolean | null
  options?: string[]
  optionValues?: string[]
  ref?: string
  note?: string
}

export type DesignRelationType = '1:1' | '1:N' | 'N:1' | 'N:M'

export interface DesignRelation {
  from: string
  to: string
  type: DesignRelationType
  label?: string
}

export interface DesignEntity {
  id: string
  name: string
  table?: string
  description?: string
  fields: DesignField[]
  /** 渲染器兼容字段（P3 adapter 从 design.json 映射后填充） */
  status?: string
  relations?: DesignRelation[]
}

export interface DesignPageSpec {
  columns?: string[]
  actions?: string[]
  fields?: string[]
  filters?: string[]
  selection?: boolean
  components?: Record<string, string>
  notes?: string
  acceptance?: string[]
}

export interface DesignPageLayout {
  table?: { columns?: string[]; searchFields?: string[]; pageSize?: number }
  toolbar?: { actions?: string[] }
  detail?: { columns?: 1 | 2 | 3 }
  stats?: Array<{ label: string; metric: string }>
  charts?: Array<{ type: 'bar' | 'line' | 'pie'; metric: string; dimension: string; title?: string }>
  groupMode?: 'groups' | 'tabs'
  /** P7 页面契约（渲染器可暂不消费） */
  pagination?: DesignPagination
  selection?: boolean
  rowActions?: string[]
  toolbarActions?: string[]
  form?: DesignFormContract
  /** 表单分组（adapter 从 form.groups 映射；未提供时不产生该键） */
  groups?: Array<{ title?: string; fields?: string[] }>
  tree?: DesignTreeContract
  subTables?: Array<{ target: string; title?: string; columns?: string[]; hidden?: boolean; mode?: 'tab' | 'flow' }>
  components?: Record<string, string>
}

export interface DesignPage {
  id: string
  name: string
  type: PrototypePageType
  entity?: string
  columns?: string[]
  actions?: string[]
  requirementRefs?: string[]
  /** P7 页面契约（均可选，旧设计继续有效） */
  recipe?: DesignPageRecipe
  catalogRef?: string
  blueprint?: string
  filters?: string[]
  rowActions?: string[]
  toolbarActions?: string[]
  selection?: boolean
  pagination?: DesignPagination
  form?: DesignFormContract
  tree?: DesignTreeContract
  subTables?: DesignSubTable[]
  components?: Record<string, string>
  /** 动作码 → 同页面集目标页面 id（B6：显式优先；create/edit/detail 等） */
  actionTargets?: Record<string, string>
}

/** 渲染器契约（P3 adapter 从 design.json 的 pages 映射；本轮不接线） */
export interface DesignPageRender extends Omit<DesignPage, 'name' | 'entity'> {
  title: string
  pageSetId: string
  entityId: string | null
  spec: DesignPageSpec
  layout: DesignPageLayout
}

/** 页面集（页面集 = Epic；pages.json 的 pageSets[]） */
export interface DesignPageSet {
  id: string
  /** 对应需求文档 Epic ID（EP-001） */
  epic?: string
  title: string
  pages: DesignPage[]
}

/** 原型皮肤：由应用设计系统的视觉风格构造（tokens + 外壳） */
export type PrototypeSkinCategory = 'custom'
export type PrototypeDensity = 'compact' | 'comfortable'

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
  type: 'sidebar' | 'topbar'
  sidebarDark: boolean
  contentWidth?: number
}

export interface PrototypeSkin {
  id: string
  name: string
  category: PrototypeSkinCategory
  tokens: PrototypeTokens
  shell: PrototypeShell
}
