/**
 * 原型渲染所需的规格类型（从旧 structured 需求/设计工作台的 `spec/types.ts` 抽取）。
 *
 * 只保留线框渲染实际使用的部分：实体/字段、页面、页面布局覆盖项与批注。
 * 设计阶段的事实源是设计项目的实体/页面集，这里仅做「设计实体 → 线框渲染模型」的映射。
 */

export type SpecItemStatus = 'confirmed' | 'draft'

export type SpecFieldType = 'string' | 'text' | 'number' | 'date' | 'datetime' | 'time' | 'boolean' | 'enum' | 'ref'

export type SpecRelationType = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'

export type SpecPriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface SpecField {
  name: string
  label: string
  type: SpecFieldType
  required?: boolean
  options?: string[]
  target?: string
  constraints?: string[]
  note?: string
  /** 结构化校验：constraints 表达不了精确语义时使用 */
  unique?: boolean
  min?: number
  max?: number
  pattern?: string
  default?: unknown
}

export interface SpecRelation {
  type: SpecRelationType
  target: string
  name: string
}

export interface SpecEntity {
  id: string
  name: string
  description?: string
  status: SpecItemStatus
  fields: SpecField[]
  relations?: SpecRelation[]
  priority?: SpecPriority
  acceptanceCriteria?: string[]
}

export type SpecPageType = 'form' | 'list' | 'detail' | 'dashboard' | 'kanban' | 'gantt' | 'calendar' | 'custom'

export type SpecPageAction = 'submit' | 'cancel' | 'edit' | 'delete' | 'batchDelete' | 'approve' | string

export interface SpecPage {
  id: string
  type: SpecPageType
  title: string
  entity?: string
  fields?: string[]
  actions?: SpecPageAction[]
  status: SpecItemStatus
  priority?: SpecPriority
  acceptanceCriteria?: string[]
}

export type ControlType =
  | 'input'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'upload'
  | 'image'
  | 'select-user'
  | 'select-org'

export type ChartType = 'bar' | 'line' | 'pie'

export type WfBlockType = 'text' | 'banner' | 'image' | 'kv' | 'buttons' | 'steps' | 'timeline' | 'chart'

/**
 * 原型自由区块：布局层的表达元素（说明文本/公告/图片占位/键值对/按钮组/分步条/时间线/图表），
 * 仅服务原型评审。
 */
export interface WfBlock {
  type: WfBlockType
  /** 插入位置：top=页面主体内容之前，bottom=主体内容之后（缺省 bottom）；custom 页面按数组顺序渲染为主体 */
  position?: 'top' | 'bottom'
  /** 标题（text/banner/kv/chart 用） */
  title?: string
  /** 正文（text 正文 / banner 内容 / timeline 项说明） */
  text?: string
  /** banner 语义色（缺省 info） */
  level?: 'info' | 'warning' | 'error'
  /** 键值对组（kv）/ 按钮文案组（buttons，label=按钮文案） */
  items?: Array<{ label: string; value?: string }>
  /** 分步条文案（steps） */
  steps?: string[]
  /** 时间线条目（timeline） */
  timeline?: Array<{ title: string; description?: string }>
  /** 图表配置（chart，复用 metricLabel 解析指标名） */
  chart?: { type: ChartType; metric: string; dimension: string }
  /** 图表指标解析的实体（缺省页面绑定实体） */
  entity?: string
}

/**
 * 页面原型布局：只存相对 spec 默认布局的「覆盖项」。
 * spec（实体字段/页面字段）是唯一事实源，布局未覆盖的部分按默认规则渲染。
 */
export interface PageLayout {
  /** 字段级覆盖（key = 实体字段 name） */
  fieldOverrides?: Record<string, { hidden?: boolean; control?: ControlType; span?: 6 | 8 | 12 | 24 }>
  /** 展示顺序（子集排序，未列出的字段按 spec 顺序补在后面） */
  fieldOrder?: string[]
  /** 表单分组（fields 引用实体字段 name） */
  groups?: Array<{ title: string; fields: string[] }>
  /** 列表页表格 */
  table?: {
    columns?: string[]
    pageSize?: number
    /** 列表页查询条件（字段名数组）；缺省=列表列前 3 个（与原型查询区推导一致） */
    searchFields?: string[]
  }
  /** 列表页工具栏：按钮动作 id 列表（如 batchDelete/import/export，含 create 时展示新增入口）；未配置时用页面默认工具栏 */
  toolbar?: { actions?: string[] }
  /** 详情页：字段网格列数（默认 2；字段 fieldOverrides.span=24 时独占整行） */
  detail?: { columns?: 1 | 2 | 3 }
  /** 看板视图：分组字段（默认取第一个 enum 字段）+ 卡片展示字段 */
  kanban?: { groupField?: string; cardFields?: string[] }
  /** 甘特视图：名称/开始/结束/进度字段（开始默认取第一个 date 字段，无 end 时按 mock 时长） */
  gantt?: { nameField?: string; startField?: string; endField?: string; progressField?: string }
  /** 日历视图：日期字段 + 事件标题字段 */
  calendar?: { dateField?: string; titleField?: string }
  /** 仪表盘 */
  stats?: Array<{ label: string; metric: string }>
  charts?: Array<{ type: ChartType; metric: string; dimension: string; title?: string }>
  /** 表单分组展示形态：sections=分组卡片（默认），tabs=顶部页签 */
  groupMode?: 'groups' | 'tabs'
  /** 子表格覆盖项：默认按实体 one-to-many 关系自动渲染，可改标题/列或隐藏 */
  subTables?: Array<{ target: string; title?: string; columns?: string[]; hidden?: boolean }>
  /** 自由区块：布局层表达元素（说明文本/公告/图片/键值对/按钮组/分步条/时间线/图表） */
  blocks?: WfBlock[]
}

/**
 * 页面原型批注：锚定在线框元素的稳定标识上。
 * 锚点格式：field:<字段name>（表单字段）或区域标识（page=页面整体/header/search/table/footer/chart:<i>/col:<label> 等，
 * 由线框组件的 data-wf-anchor 定义）；锚点元素不存在时钉标自动隐藏，不影响渲染。
 */
export interface PageAnnotation {
  id: string
  anchor: string
  text: string
  createdAt: string
  resolved?: boolean
}
