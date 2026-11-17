import { findEntityInModule, parseEntityRef } from './refs'
import type { ControlType, PageLayout, SpecEntity, SpecField, SpecPage, WfBlock } from './spec-types'

/** 主键/审计字段：原型展示层不渲染（与转换器 AUDIT_FIELDS 同规则；id 主键转换时由平台自动生成） */
const RENDER_EXCLUDED_FIELDS = ['id', 'createUser', 'createTime', 'updateUser', 'updateTime', 'deleted', 'version', 'tenantId']

/** 页面展示字段：page.fields 优先，其次实体全量字段（spec 是唯一事实源）；主键/审计字段不进原型 */
export function resolvePageFields(page: SpecPage, entity: SpecEntity | undefined): SpecField[] {
  if (!entity) return []
  const byName = new Map(entity.fields.filter(f => !RENDER_EXCLUDED_FIELDS.includes(f.name)).map(f => [f.name, f]))
  if (page.fields?.length) {
    const list = page.fields.map(n => byName.get(n)).filter((f): f is SpecField => !!f)
    if (list.length) return list
  }
  return [...byName.values()]
}

/** 应用布局覆盖（显隐 + 排序）后的最终展示字段 */
export function effectiveFields(page: SpecPage, entity: SpecEntity | undefined, layout: PageLayout | undefined): SpecField[] {
  let fields = resolvePageFields(page, entity)
  const overrides = layout?.fieldOverrides ?? {}
  fields = fields.filter(f => !overrides[f.name]?.hidden)
  const order = layout?.fieldOrder
  if (order?.length) {
    const rank = new Map(order.map((name, i) => [name, i]))
    fields = [...fields].sort((a, b) => (rank.get(a.name) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.name) ?? Number.MAX_SAFE_INTEGER))
  }
  return fields
}

/** 按字段名/标签推断图片、上传类控件 */
function inferMediaControl(field: SpecField): ControlType | undefined {
  const text = `${field.label ?? ''}${field.name}`
  if (/图片|图像|头像|照片|封面|logo/i.test(text)) return 'image'
  if (/附件|文件|上传|材料/.test(text)) return 'upload'
  return undefined
}

/** 按字段名/标签推断人员、组织类选择控件（与转换器 inferFormControl 同构） */
function inferUserOrgControl(field: SpecField): ControlType | undefined {
  const text = `${field.label ?? ''}${field.name}`
  if (/负责人|经办人|处理人|审批人|人员|员工|销售员|归属|owner|assignee|handler/i.test(text)) return 'select-user'
  if (/部门|机构|组织|org|department/i.test(text)) return 'select-org'
  return undefined
}

export function inferControl(field: SpecField): ControlType {
  const media = inferMediaControl(field)
  if (media) return media
  const userOrg = inferUserOrgControl(field)
  if (userOrg) return userOrg
  switch (field.type) {
    case 'text': return 'textarea'
    case 'number': return 'number'
    case 'date': return 'date'
    case 'datetime': return 'datetime'
    case 'boolean': return 'boolean'
    case 'enum':
      // 少量选项（2-4）的枚举用单选框，更多选项用下拉
      if (field.options && field.options.length >= 2 && field.options.length <= 4) return 'radio'
      return 'select'
    case 'ref': return 'select'
    default: return 'input'
  }
}

/** 字段展示时的控件（布局覆盖优先） */
export function controlOf(field: SpecField, layout: PageLayout | undefined): ControlType {
  return layout?.fieldOverrides?.[field.name]?.control ?? inferControl(field)
}

export function fieldSpan(field: SpecField, layout: PageLayout | undefined): number {
  const override = layout?.fieldOverrides?.[field.name]?.span
  if (override) return override
  const control = controlOf(field, layout)
  if (control === 'textarea') return 24
  return 12
}

/** 表单分组：布局分组 + 未分组字段兜底区 */
export function fieldGroups(fields: SpecField[], layout: PageLayout | undefined): Array<{ title: string; fields: SpecField[] }> {
  const byName = new Map(fields.map(f => [f.name, f]))
  const groups: Array<{ title: string; fields: SpecField[] }> = []
  const used = new Set<string>()
  for (const group of layout?.groups ?? []) {
    const list = group.fields.map(n => byName.get(n)).filter((f): f is SpecField => !!f && !used.has(f.name))
    for (const f of list) used.add(f.name)
    if (list.length) groups.push({ title: group.title, fields: list })
  }
  const rest = fields.filter(f => !used.has(f.name))
  if (rest.length) groups.push({ title: '', fields: rest })
  return groups
}

/** 列表页表格列（布局列优先，最多取 8 列） */
export function tableColumns(page: SpecPage, entity: SpecEntity | undefined, layout: PageLayout | undefined): SpecField[] {
  const fields = resolvePageFields(page, entity)
  const byName = new Map(fields.map(f => [f.name, f]))
  const columns = (layout?.table?.columns ?? []).map(n => byName.get(n)).filter((f): f is SpecField => !!f)
  const list = columns.length ? columns : fields
  return list.slice(0, 8)
}

export function tablePageSize(layout: PageLayout | undefined): number {
  return layout?.table?.pageSize ?? 10
}

/** 仪表盘统计卡：布局优先，否则按实体字段推导默认（__count = 记录数） */
export function dashboardStats(entity: SpecEntity | undefined, layout: PageLayout | undefined): Array<{ label: string; metric: string }> {
  if (layout?.stats?.length) return layout.stats
  if (!entity) return [{ label: '记录总数', metric: '__count' }]
  const numberField = entity.fields.find(f => f.type === 'number')
  const stats = [{ label: '记录总数', metric: '__count' }]
  if (numberField) stats.push({ label: `${numberField.label}合计`, metric: numberField.name })
  return stats
}

/** 仪表盘图表：布局优先，否则按实体字段推导默认 */
export function dashboardCharts(entity: SpecEntity | undefined, layout: PageLayout | undefined): Array<{ type: 'bar' | 'line' | 'pie'; metric: string; dimension: string; title?: string }> {
  if (layout?.charts?.length) return layout.charts
  if (!entity) return []
  const charts: Array<{ type: 'bar' | 'line' | 'pie'; metric: string; dimension: string; title?: string }> = []
  const enumField = entity.fields.find(f => f.type === 'enum')
  const numberField = entity.fields.find(f => f.type === 'number')
  const dimensionField = entity.fields.find(f => f.type === 'string' && f.name !== enumField?.name)
  if (enumField) charts.push({ type: 'pie', metric: '__count', dimension: enumField.name, title: `${enumField.label}分布` })
  if (numberField && dimensionField) charts.push({ type: 'bar', metric: numberField.name, dimension: dimensionField.name, title: `${numberField.label}（按${dimensionField.label}）` })
  return charts.slice(0, 2)
}

export function metricLabel(entity: SpecEntity | undefined, metric: string): string {
  if (metric === '__count') return '记录数'
  return entity?.fields.find(f => f.name === metric)?.label ?? metric
}

// ---- 看板 / 甘特 / 日历视图配置（布局覆盖优先，否则按字段类型推导默认） ----

export interface KanbanSpec {
  groupField: SpecField | undefined
  cardFields: SpecField[]
}

export function kanbanSpec(page: SpecPage, entity: SpecEntity | undefined, layout: PageLayout | undefined): KanbanSpec {
  const fields = resolvePageFields(page, entity)
  const byName = new Map(fields.map(f => [f.name, f]))
  const groupField = (layout?.kanban?.groupField ? byName.get(layout.kanban.groupField) : undefined) ?? fields.find(f => f.type === 'enum') ?? fields.find(f => f.type === 'ref') ?? fields[0]
  const used = new Set([groupField?.name])
  const cardFields = (layout?.kanban?.cardFields ?? [])
    .map(n => byName.get(n))
    .filter((f): f is SpecField => !!f && !used.has(f.name))
  if (!cardFields.length) {
    cardFields.push(...fields.filter(f => !used.has(f.name)).slice(0, 3))
  }
  return { groupField, cardFields: cardFields.slice(0, 3) }
}

export interface GanttSpec {
  nameField: SpecField | undefined
  startField: SpecField | undefined
  endField: SpecField | undefined
  progressField: SpecField | undefined
}

export function ganttSpec(page: SpecPage, entity: SpecEntity | undefined, layout: PageLayout | undefined): GanttSpec {
  const fields = resolvePageFields(page, entity)
  const byName = new Map(fields.map(f => [f.name, f]))
  const dateFields = fields.filter(f => f.type === 'date' || f.type === 'datetime')
  const nameField = (layout?.gantt?.nameField ? byName.get(layout.gantt.nameField) : undefined) ?? fields.find(f => f.type === 'string') ?? fields[0]
  const startField = (layout?.gantt?.startField ? byName.get(layout.gantt.startField) : undefined) ?? dateFields[0]
  const endField = (layout?.gantt?.endField ? byName.get(layout.gantt.endField) : undefined) ?? dateFields[1]
  const progressField = (layout?.gantt?.progressField ? byName.get(layout.gantt.progressField) : undefined) ?? fields.find(f => f.type === 'number')
  return { nameField, startField, endField, progressField }
}

export interface CalendarSpec {
  dateField: SpecField | undefined
  titleField: SpecField | undefined
}

export function calendarSpec(page: SpecPage, entity: SpecEntity | undefined, layout: PageLayout | undefined): CalendarSpec {
  const fields = resolvePageFields(page, entity)
  const byName = new Map(fields.map(f => [f.name, f]))
  const dateField = (layout?.calendar?.dateField ? byName.get(layout.calendar.dateField) : undefined) ?? fields.find(f => f.type === 'date' || f.type === 'datetime')
  const titleField = (layout?.calendar?.titleField ? byName.get(layout.calendar.titleField) : undefined) ?? fields.find(f => f.type === 'string') ?? fields[0]
  return { dateField, titleField }
}

// Modified by AI on 2026-09-15 10:51:46

/** 批注锚点的展示名：field:days → 字段 请假天数；表格列/行、区域锚点映射为中文名 */
export function anchorLabel(anchor: string, entity?: SpecEntity): string {
  if (anchor.startsWith('field:') || anchor.startsWith('column:')) {
    const name = anchor.slice(anchor.indexOf(':') + 1)
    const field = entity?.fields.find(f => f.name === name)
    const kind = anchor.startsWith('field:') ? '字段' : '列'
    return `${kind} ${field ? field.label : name}`
  }
  if (anchor.startsWith('row:')) return `第 ${Number(anchor.slice(4)) + 1} 行`
  if (anchor.startsWith('chart:')) return `图表 #${Number(anchor.slice(6)) + 1}`
  if (anchor.startsWith('col:')) return `泳道 ${anchor.slice(4)}`
  if (anchor.startsWith('group:')) return `分组 ${anchor.slice(6)}`
  if (anchor.startsWith('tab:')) return `页签 #${Number(anchor.slice(4)) + 1}`
  if (anchor.startsWith('subtable:')) return `子表格 #${Number(anchor.slice(9)) + 1}`
  if (anchor.startsWith('block:')) return `区块 #${Number(anchor.slice(6)) + 1}`
  const map: Record<string, string> = {
    page: '页面整体', header: '页头', search: '检索区', toolbar: '工具栏', table: '数据表格', selection: '选择列', actions: '操作列', pager: '分页',
    desc: '详情内容', footer: '底部操作', stats: '统计卡', board: '看板', chart: '图表', calendar: '日历', tabs: '页签'
  }
  return map[anchor] ?? anchor
}

/** 页面动作标识 → 中文按钮文案；未知/自定义动作原样显示 */
const ACTION_LABELS: Record<string, string> = {
  submit: '提交',
  cancel: '取消',
  edit: '编辑',
  delete: '删除',
  batchDelete: '批量删除',
  approve: '审批',
  reject: '驳回',
  view: '查看',
  create: '新增',
  detail: '详情',
  save: '保存',
  search: '查询',
  export: '导出',
  import: '导入',
  print: '打印',
  copy: '复制',
  enable: '启用',
  disable: '停用'
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

/** 子表格模型：按实体 one-to-many 关系推导，layout.subTables 提供覆盖 */
export interface SubTableModel {
  relationName: string
  targetEntity: SpecEntity
  title: string
  columns: SpecField[]
  hidden: boolean
}

export function subTableModels(entity: SpecEntity | undefined, layout: PageLayout | undefined, currentModuleId: string): SubTableModel[] {
  if (!entity) return []
  const overrides = layout?.subTables ?? []
  const list: SubTableModel[] = []
  for (const rel of entity.relations ?? []) {
    if (rel.type !== 'one-to-many') continue
    const { moduleId, entityId } = parseEntityRef(rel.target)
    const target = findEntityInModule(moduleId ?? currentModuleId, entityId)
    if (!target) continue
    const override = overrides.find(o => o.target === rel.target || o.target === rel.name)
    const columns = override?.columns?.length
      ? override.columns.map(n => target.fields.find(f => f.name === n)).filter((f): f is SpecField => !!f)
      : target.fields.slice(0, 4)
    list.push({
      relationName: rel.name,
      targetEntity: target,
      title: override?.title || rel.name || target.name,
      columns,
      hidden: override?.hidden ?? false
    })
  }
  return list
}

/** 页面区块条目（index 为 blocks 数组原始序号，批注锚点 block:<index> 依赖它）；position 缺省视为 bottom */
export function blockEntriesOf(layout: PageLayout | undefined, position?: 'top' | 'bottom'): Array<{ index: number; block: WfBlock }> {
  return (layout?.blocks ?? [])
    .map((block, index) => ({ index, block }))
    .filter(e => !position || (e.block.position ?? 'bottom') === position)
}

// Modified by AI on 2026-10-20 14:39:39
