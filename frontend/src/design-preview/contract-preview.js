/**
 * P9 设计产物模板风格渲染：页面契约 → 模板组件模型（纯函数，便于 node --test）
 *
 * 输入是 `design-adapter.js#adaptDesign` 产出的页面（DesignPageRender）与实体（DesignEntity）；
 * 输出列 / 查询 / 工具栏 / 行操作 / 树节点 / 表单分组 / 确定性 mock 行。
 *
 * 约束：
 * - 不依赖 Vue / DOM / 网络；
 * - 不产生随机数（同一 design.json 每次渲染一致）；
 * - 契约缺失时回退「实体字段」的保守展示，不抛错；
 * - 实体不存在的列/查询/表单字段跳过并记录提示（不渲染假列）。
 */
import {
  formView,
  inferControlType,
  isBatchAction,
  pagerSelectionText,
  resolveControl,
  resolveRowActions,
  resolveSelection,
  resolveToolbarActions
} from '../design/prototype/contract-view.js'

/**
 * 支持模板风格原生渲染的页面配方。
 *
 * P10b 起：**任何有显式契约（recipe/catalogRef/blueprint）的页面**都走模板渲染；
 * 未知/无映射配方按 `page.type` 映射到通用模板页（见 `resolveContractRecipe`），
 * 只有「无任何显式契约的旧设计」才默认线框。
 */
export const TEMPLATE_RENDER_RECIPES = [
  'list',
  'tree-list',
  'page-form',
  'dialog-form',
  'detail',
  'dashboard',
  'main-sub',
  'wizard'
]

/** 配方中文标签（页面描述/提示用） */
export const RECIPE_LABELS = {
  list: '列表台账',
  'tree-list': '树表台账',
  'page-form': '页面表单',
  'dialog-form': '弹窗表单',
  detail: '详情页',
  dashboard: '驾驶舱',
  'main-sub': '主子表',
  wizard: '分步表单'
}

/** 动作标识 → 中文按钮文案（与 design/prototype/layout.ts 的 ACTION_LABELS 对齐） */
const ACTION_LABELS = {
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

const NAME_POOL = ['张伟', '王芳', '李娜', '刘强', '陈静', '杨洋', '赵敏', '周杰', '吴磊', '郑爽']
const ORG_POOL = ['华东事业部', '华南事业部', '研发中心', '市场部', '人力资源部', '财务部']
const CATEGORY_POOL = ['数码家电', '家居日用', '食品饮料', '美妆个护', '服饰鞋包', '办公文具']
const BRAND_POOL = ['星禾', '云栖', '南屿', '青野', '北辰', '草木']
const UNIT_POOL = ['件', '箱', '盒', '千克']
const CITY_POOL = ['上海市浦东新区', '北京市海淀区', '广州市天河区', '深圳市南山区', '杭州市西湖区']
const TITLE_POOL = ['季度经营复盘', '供应商合同评审', '新品上市推广', '机房巡检记录', '客户满意度调研', '年度预算编制']
const TEXT_POOL = [
  '按当前页面契约生成的示意内容，仅用于设计预览。',
  '该字段为长文本，正式实现时按业务规则校验长度。',
  '记录本次变更的原因与影响范围，便于后续追溯。',
  '请相关负责人确认后提交，逾期将按默认流程处理。'
]
const FALLBACK_OPTIONS = ['选项一', '选项二', '选项三']

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function pad(value, length = 2) {
  return String(value).padStart(length, '0')
}

export function actionLabel(action) {
  const code = text(action)
  return ACTION_LABELS[code] ?? code
}

/* ------------------------------------------------------------------ *
 * 配方解析 / 支持判定
 * ------------------------------------------------------------------ */

/** 是否有显式设计契约（recipe / catalogRef / blueprint 任一即可，P10b） */
export function hasExplicitContract(page) {
  return Boolean(text(page?.recipe) || text(page?.catalogRef) || text(page?.blueprint))
}

/** 页面类型 → 模板通用配方（未知/无映射配方的兜底，最后落到 detail） */
function recipeForType(type) {
  switch (text(type)) {
    case 'form':
      return 'page-form'
    case 'list':
    case 'tree-list':
      return 'list'
    case 'dashboard':
      return 'dashboard'
    default:
      return 'detail'
  }
}

/**
 * 页面配方：显式 recipe 优先；其次 catalogRef 指向的模板页面配方；再次 blueprint / 页面类型。
 *
 * P10b：显式 recipe 不受支持（或未知）时按 `page.type` 映射到通用模板配方，
 * 返回值一定在 `TEMPLATE_RENDER_RECIPES` 内，`ContractPage` 不会落到“未支持”。
 *
 * @returns {string} 配方标识（总在 `TEMPLATE_RENDER_RECIPES` 内）
 */
export function resolveContractRecipe(page, templatePages = []) {
  if (!page) return 'detail'
  const explicit = text(page.recipe)
  if (explicit) {
    return TEMPLATE_RENDER_RECIPES.includes(explicit) ? explicit : recipeForType(page.type)
  }
  const catalogRef = text(page.catalogRef)
  if (catalogRef) {
    const separator = catalogRef.indexOf('/')
    const pageId = separator > 0 ? catalogRef.slice(separator + 1) : ''
    const meta = asArray(templatePages).find(item => item && text(item.id) === pageId)
    const recipe = text(meta?.recipe)
    if (TEMPLATE_RENDER_RECIPES.includes(recipe)) return recipe
  }
  return recipeForType(page.type)
}

/** 是否走模板风格原生渲染：有显式契约即可（P10b，不再限制配方列表） */
export function supportsTemplateRender(page, _templatePages = []) {
  return hasExplicitContract(page)
}

/** 原型默认模式：template（支持时） / wireframe */
export function prototypeModeFor(page, templatePages = []) {
  return supportsTemplateRender(page, templatePages) ? 'template' : 'wireframe'
}

/* ------------------------------------------------------------------ *
 * 确定性 mock 数据
 * ------------------------------------------------------------------ */

function dateAt(index) {
  return `2026-${pad(1 + (index % 9))}-${pad(1 + ((index * 3) % 28))}`
}

function mockString(field, index) {
  const key = `${field?.name ?? ''}${field?.label ?? ''}`
  if (/编码|编号|code|单号/i.test(key)) return `BH-${pad(index + 1, 4)}`
  if (/品牌|brand/i.test(key)) return BRAND_POOL[index % BRAND_POOL.length]
  if (/规格|型号|spec|model/i.test(key)) return `SP-${pad(11 + index)}`
  if (/单位|unit/i.test(key)) return UNIT_POOL[index % UNIT_POOL.length]
  if (/分类|类别|类型|category/i.test(key)) return CATEGORY_POOL[index % CATEGORY_POOL.length]
  if (/产地|地址|城市|address|city/i.test(key)) return CITY_POOL[index % CITY_POOL.length]
  if (/部门|机构|组织|org|department/i.test(key)) return ORG_POOL[index % ORG_POOL.length]
  if (/负责人|经办人|处理人|审批人|人员|员工|姓名|owner|assignee|handler/i.test(key)) {
    return NAME_POOL[index % NAME_POOL.length]
  }
  if (/备注|说明|描述|remark|note|desc/i.test(key)) return TEXT_POOL[index % TEXT_POOL.length]
  if (/名称|标题|主题|title|subject|name/i.test(key)) {
    const base = text(field?.label || field?.name).replace(/名称$|标题$/, '')
    if (base) return `${base} ${String.fromCharCode(65 + (index % 26))}`
    return TITLE_POOL[index % TITLE_POOL.length]
  }
  return TITLE_POOL[index % TITLE_POOL.length]
}

function mockNumber(field, index) {
  const key = `${field?.name ?? ''}${field?.label ?? ''}`
  if (/单价|价格|金额|费用|预算|price|amount|money/i.test(key)) {
    return Number((99.9 + index * 37.25).toFixed(2))
  }
  if (/库存|数量|件数|count|qty|stock/i.test(key)) return 20 + index * 3
  if (/天|天数|day/i.test(key)) return 30 + index
  if (/比例|率|百分比|percent/i.test(key)) return 60 + ((index * 7) % 40)
  return index + 1
}

/**
 * 单字段确定性 mock 值（按索引、字段类型与 options 生成）
 *
 * `offset` 只用于枚举字段的取值偏移（同类多枚举列避免逐行同值），
 * 字符串/数字等其它类型仍只看 index，保持既有 mock 分布不变。
 */
export function mockFieldValue(field, index, offset = 0) {
  const i = Number.isInteger(index) && index >= 0 ? index : 0
  switch (field?.type) {
    case 'number':
    case 'decimal':
      return mockNumber(field, i)
    case 'boolean':
      return i % 2 === 0
    case 'date':
      return dateAt(i)
    case 'datetime':
      return `${dateAt(i)} ${pad(9 + (i % 9))}:${pad((i * 13) % 60)}:00`
    case 'time':
      return `${pad(8 + (i % 12))}:00`
    case 'enum': {
      const options = asArray(field?.options).map(String).filter(Boolean)
      const shift = Number.isInteger(offset) && offset > 0 ? offset : 0
      const at = i + shift
      return options.length ? options[at % options.length] : FALLBACK_OPTIONS[at % FALLBACK_OPTIONS.length]
    }
    case 'ref':
      return NAME_POOL[i % NAME_POOL.length]
    case 'text':
      return TEXT_POOL[i % TEXT_POOL.length]
    default:
      return mockString(field, i)
  }
}

/** 为实体生成 count 行确定性 mock 数据（每行含 __id） */
export function mockRowsForEntity(entity, count) {
  const fields = asArray(entity?.fields)
  const total = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0
  // 枚举字段序号：首个枚举字段 offset=0（状态列等保持原分布），其后按序号错开，
  // 避免同一行的多个枚举列显示同一项（确定性，无随机）。
  const enumOffsets = new Map()
  let enumSeen = 0
  for (const field of fields) {
    if (field?.type !== 'enum' || enumOffsets.has(field)) continue
    enumOffsets.set(field, enumSeen)
    enumSeen += 1
  }
  const rows = []
  for (let i = 0; i < total; i += 1) {
    const row = { __id: `row-${i + 1}` }
    for (const field of fields) {
      if (!text(field?.name)) continue
      row[field.name] = mockFieldValue(field, i, enumOffsets.get(field) ?? 0)
    }
    rows.push(row)
  }
  return rows
}

/** 单元格展示文案（数字/布尔/空值可读化） */
export function formatCellValue(field, value) {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if ((field?.type === 'number' || field?.type === 'decimal') && typeof value === 'number') {
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: field.type === 'decimal' ? 2 : 0,
      maximumFractionDigits: field.type === 'decimal' ? 2 : 0
    })
  }
  return String(value)
}

/* ------------------------------------------------------------------ *
 * 列表 / 查询 / 操作
 * ------------------------------------------------------------------ */

function columnOf(field) {
  const base = { prop: field.name, label: field.label || field.name }
  const width = field.type === 'date' ? 120
    : field.type === 'datetime' ? 165
      : field.type === 'number' || field.type === 'decimal' ? 120
        : field.type === 'boolean' ? 90
          : field.type === 'enum' ? 110
            : 0
  const column = { ...base }
  if (width) column.width = width
  else column.minWidth = 130
  // 枚举列用模板状态标签插槽；其它列走格式化函数（由渲染组件补齐）
  if (field.type === 'enum') column.scope = 'status'
  return column
}

/**
 * 列模型：`layout.table.columns`（缺失时取实体前 6 个字段）→ pm-table 列。
 * 实体不存在的列跳过并记录提示。
 */
export function buildColumns(page, entity) {
  const requested = asArray(page?.layout?.table?.columns ?? page?.spec?.columns).map(String)
  const fields = asArray(entity?.fields).filter(field => text(field?.name))
  const byName = new Map(fields.map(field => [field.name, field]))
  const names = requested.length ? requested : fields.slice(0, 6).map(field => field.name)
  const columns = []
  const skipped = []
  for (const name of names) {
    const field = byName.get(name)
    if (!field) {
      skipped.push(name)
      continue
    }
    columns.push(columnOf(field))
  }
  return { columns, skipped }
}

/** 查询字段：`layout.table.searchFields` / `spec.filters` → 字段对象 */
export function buildFilters(page, entity, max = 4) {
  const requested = asArray(page?.layout?.table?.searchFields ?? page?.spec?.filters).map(String)
  const fields = asArray(entity?.fields).filter(field => text(field?.name))
  const byName = new Map(fields.map(field => [field.name, field]))
  const result = []
  const skipped = []
  for (const name of requested) {
    const field = byName.get(name)
    if (!field) {
      skipped.push(name)
      continue
    }
    if (result.length >= max) continue
    result.push(field)
  }
  return { fields: result, skipped }
}

/** 页面动作（adapter 把 actions 放在 page.spec.actions） */
function pageActionsOf(page) {
  const fromSpec = asArray(page?.spec?.actions).map(String)
  if (fromSpec.length) return fromSpec
  return asArray(page?.actions).map(String)
}

/** 工具栏：{ heading: 页头动作, batch: 批量条动作 } */
export function buildToolbar(page) {
  const layout = page?.layout ?? {}
  const target = { ...page, actions: pageActionsOf(page) }
  const actions = resolveToolbarActions(target, layout)
  const explicit = Array.isArray(layout?.toolbarActions)
  const heading = actions.filter(action => action !== 'create' && !(explicit && isBatchAction(action)))
  const batch = actions.filter(isBatchAction)
  return { heading, batch, hasCreate: actions.includes('create') }
}

export function buildRowActions(page) {
  const target = { ...page, actions: pageActionsOf(page) }
  return resolveRowActions(target, page?.layout ?? {}).map(code => ({ code, label: actionLabel(code) }))
}

export function selectionEnabled(page) {
  return resolveSelection(page?.layout ?? {}) !== false
}

/** 每页条数：pagination.pageSize > table.pageSize > 10，上限 50 */
export function pageSizeOf(page) {
  const layout = page?.layout ?? {}
  const raw = Number(layout?.pagination?.pageSize ?? layout?.table?.pageSize)
  const size = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10
  return Math.min(Math.max(size, 1), 50)
}

/** mock 行数：至少能填满当前页，并保证有第二页（上限 120） */
export function mockRowCountOf(page) {
  return Math.min(Math.max(pageSizeOf(page), 12), 120)
}

/** 分页左侧文案：多选显示已选，否则显示总数 */
export function pagerTextOf(page, { total = 0, selectedCount = 0 } = {}) {
  return pagerSelectionText(selectionEnabled(page), selectedCount, total)
}

/* ------------------------------------------------------------------ *
 * 树
 * ------------------------------------------------------------------ */

function distinctLabels(rows, titleField) {
  const seen = new Set()
  const nodes = []
  for (const row of rows) {
    const label = text(row?.[titleField])
    if (!label || seen.has(label)) continue
    seen.add(label)
    nodes.push({ id: `tree-${nodes.length}`, label })
  }
  return nodes
}

/**
 * 树模型：
 * - `tree.parentField` 存在且能匹配到上级节点 → 嵌套；
 * - 否则按 `tree.titleField` 去重扁平展示，并给出提示（不阻断）。
 */
export function buildTreeRows(rows, tree) {
  const titleField = text(tree?.titleField)
  const parentField = text(tree?.parentField)
  const list = asArray(rows)
  if (!titleField) {
    return { titleField: '', nodes: [], flat: false, note: '未配置 tree.titleField，树面板暂无节点' }
  }
  if (!parentField) {
    return {
      titleField,
      nodes: distinctLabels(list, titleField),
      flat: true,
      note: `未配置 parentField，按「${titleField}」去重扁平展示`
    }
  }
  const nodesByLabel = new Map()
  const ensure = label => {
    let node = nodesByLabel.get(label)
    if (!node) {
      node = { id: `tree-${nodesByLabel.size}`, label, children: [] }
      nodesByLabel.set(label, node)
    }
    return node
  }
  for (const row of list) {
    const label = text(row?.[titleField])
    if (label) ensure(label)
  }
  const roots = []
  let nested = 0
  for (const row of list) {
    const label = text(row?.[titleField])
    if (!label) continue
    const node = ensure(label)
    const parentLabel = text(row?.[parentField])
    const parent = parentLabel && parentLabel !== label ? nodesByLabel.get(parentLabel) : null
    if (parent) {
      // 重复出现的子节点行只挂载一次；已挂载的节点不得再被 push 到 roots（P7-7a 修复）
      if (!parent.children.some(child => child.id === node.id)) {
        parent.children.push(node)
        nested += 1
      }
      const at = roots.findIndex(root => root.id === node.id)
      if (at >= 0) roots.splice(at, 1)
      continue
    }
    if (!roots.some(root => root.id === node.id)) roots.push(node)
  }
  if (!nested) {
    return {
      titleField,
      nodes: distinctLabels(list, titleField),
      flat: true,
      note: `parentField「${parentField}」未匹配到上级节点，按「${titleField}」去重扁平展示`
    }
  }
  const prune = node => {
    if (Array.isArray(node.children) && node.children.length === 0) delete node.children
    else (node.children ?? []).forEach(prune)
  }
  roots.forEach(prune)
  return { titleField, nodes: roots, flat: false, note: '' }
}

/* ------------------------------------------------------------------ *
 * 表单
 * ------------------------------------------------------------------ */

/**
 * 表单模型：form.columns / width / presentation + 分组字段（实体字段对象）。
 * 分组/字段来自 form.groups（缺失时 layout.groups），再缺失时用 form.fields 或实体前 8 个字段。
 */
export function buildForm(page, entity) {
  const layout = page?.layout ?? {}
  const view = formView(layout, page)
  const fields = asArray(entity?.fields).filter(field => text(field?.name))
  const byName = new Map(fields.map(field => [field.name, field]))
  const skipped = []
  const resolveList = names => {
    const result = []
    for (const name of asArray(names).map(String)) {
      const field = byName.get(name)
      if (!field) {
        skipped.push(name)
        continue
      }
      result.push(field)
    }
    return result
  }
  const rawGroups = asArray(view.groups).length ? view.groups : asArray(layout.groups)
  const groups = []
  for (const group of rawGroups) {
    const list = resolveList(group.fields)
    const title = text(group.title)
    if (!title && !list.length) continue
    groups.push({ title, fields: list })
  }
  if (!groups.length) {
    const names = asArray(layout?.form?.fields).length
      ? layout.form.fields
      : fields.slice(0, 8).map(field => field.name)
    groups.push({ title: '', fields: resolveList(names) })
  }
  return {
    dialog: view.dialog,
    columns: view.columns,
    width: view.width,
    groups,
    fields: groups.flatMap(group => group.fields),
    skipped
  }
}

/* ------------------------------------------------------------------ *
 * 控件
 * ------------------------------------------------------------------ */

/** 字段控件（契约 components 覆盖 > 类型/命名推断） */
export function controlOf(field, page) {
  return resolveControl(field, page?.layout ?? {}) || inferControlType(field)
}

/** 下拉/单选/多选选项：枚举 options 优先，缺失时给确定性示意选项 */
export function selectOptionsOf(field) {
  const options = asArray(field?.options).map(String).filter(Boolean)
  const list = options.length ? options : FALLBACK_OPTIONS
  return list.map(value => ({ label: value, value }))
}

/** 字段初始值（表单 mock 回显） */
export function initialFormValue(field, index = 0) {
  if (field?.type === 'checkbox') return []
  return mockFieldValue(field, index)
}

/* ------------------------------------------------------------------ *
 * 状态标签
 * ------------------------------------------------------------------ */

/** 枚举值 → 模板状态标签类（与 P9 列表行一致：首项成功、次项警告/危险、其余中性） */
export function statusClassOfValue(field, value) {
  const options = asArray(field?.options).map(String)
  const index = options.indexOf(String(value))
  if (index === 0) return 'status-success'
  if (index === 1 && options.length > 2) return 'status-warning'
  if (index === 1) return 'status-danger'
  return 'status-neutral'
}

/* ------------------------------------------------------------------ *
 * 驾驶舱（dashboard）
 * ------------------------------------------------------------------ */

const DASHBOARD_COLORS = ['#3f9f74', '#c98b2f', '#8a6cc9', '#c2542a']

function fieldKey(field) {
  return `${field?.name ?? ''}${field?.label ?? ''}`
}

function fieldLabelOf(field) {
  return text(field?.label) || text(field?.name) || '字段'
}

function isNumericField(field) {
  return field?.type === 'number' || field?.type === 'decimal'
}

function distinctCounts(rows, fieldName, limit = 5) {
  const counts = new Map()
  for (const row of rows) {
    const label = text(String(row?.[fieldName] ?? ''))
    if (!label) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].slice(0, limit).map(([name, value]) => ({ name, value }))
}

/**
 * 驾驶舱模型（纯函数）：指标卡 + 图表 option + 最近记录表和列。
 *
 * - 指标：记录总数 + 最多 2 个数值字段合计 + 枚举种类（不足 3 张补占位卡）；
 * - 图表：优先枚举字段饼图，否则数值字段柱图，无可用字段返回 null（渲染空态）；
 * - 无实体/无字段只给占位卡，不伪造业务数据。
 */
export function buildDashboardModel({ page, entity, rows, primary = '#145fba', rowLimit = 5 } = {}) {
  const list = Array.isArray(rows) ? rows : mockRowsForEntity(entity, mockRowCountOf(page))
  const fields = asArray(entity?.fields).filter(field => text(field?.name))
  const entityName = text(entity?.name) || text(page?.title) || '页面'
  const hasEntity = Boolean(entity) && fields.length > 0
  const numericFields = fields.filter(isNumericField)
  const enumFields = fields.filter(field => field.type === 'enum')

  const metrics = []
  metrics.push({
    label: '记录总数',
    value: hasEntity ? String(list.length) : '—',
    note: hasEntity ? `${entityName} · 本地 mock` : '页面未绑定实体'
  })
  for (const field of numericFields.slice(0, 2)) {
    const sum = list.reduce((total, row) => total + (Number(row?.[field.name]) || 0), 0)
    metrics.push({
      label: `${fieldLabelOf(field)}合计`,
      value: hasEntity ? formatCellValue(field, sum) : '—',
      note: `${list.length} 条记录累计`
    })
  }
  if (metrics.length < 3 && enumFields.length) {
    const field = enumFields[0]
    metrics.push({
      label: `${fieldLabelOf(field)}种类`,
      value: String(distinctCounts(list, field.name, 50).length),
      note: '按枚举值去重'
    })
  }
  while (metrics.length < 3) {
    metrics.push({ label: '数据指标', value: '—', note: '实体未提供可用字段' })
  }

  let chartOption = null
  if (hasEntity && list.length) {
    if (enumFields.length) {
      const field = enumFields[0]
      const data = distinctCounts(list, field.name)
      if (data.length) {
        chartOption = {
          chartView: {
            animation: false,
            color: [primary, ...DASHBOARD_COLORS],
            tooltip: { trigger: 'item' },
            series: [
              {
                name: `${fieldLabelOf(field)}分布`,
                type: 'pie',
                radius: ['42%', '70%'],
                label: { show: true, formatter: '{b} {c}' },
                data
              }
            ]
          }
        }
      }
    } else if (numericFields.length) {
      const numericField = numericFields[0]
      const dimension = fields.find(field => field.name !== numericField.name && field.type !== 'number' && field.type !== 'decimal')
      const slice = list.slice(0, 6)
      const labels = slice.map((row, index) => text(String(row?.[dimension?.name] ?? '')) || `记录 ${index + 1}`)
      chartOption = {
        chartView: {
          animation: false,
          color: [primary],
          tooltip: { trigger: 'axis' },
          grid: { left: 40, right: 16, top: 22, bottom: 30 },
          xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { interval: 0, rotate: labels.some(label => label.length > 6) ? 18 : 0 }
          },
          yAxis: { type: 'value' },
          series: [
            {
              name: fieldLabelOf(numericField),
              type: 'bar',
              barMaxWidth: 36,
              data: slice.map(row => Number(row?.[numericField.name]) || 0)
            }
          ]
        }
      }
    }
  }

  const columns = buildColumns(page, entity).columns
  return {
    metrics,
    chartOption,
    columns,
    rows: hasEntity ? list.slice(0, Math.max(0, Number(rowLimit) || 5)) : [],
    entityName,
    empty: !hasEntity
  }
}

/* ------------------------------------------------------------------ *
 * 详情（detail）
 * ------------------------------------------------------------------ */

function isDateField(field) {
  return field?.type === 'date' || field?.type === 'datetime'
}

/**
 * 详情模型（纯函数）：基础字段、状态标签、主信息、动态时间线、可选子表。
 *
 * - 字段/值来自实体字段 + 第一行确定性 mock（没有实体只给空态）；
 * - 时间线只用实体自带的创建/更新时间，缺失时显示「暂无动态」，不伪造业务事件；
 * - 子表按页面 subTables（target）在本模块实体池中解析，最多 3 行。
 */
export function buildDetailModel({ page, entity, row, subTables, entities = [], rowLimit = 3 } = {}) {
  const fields = asArray(entity?.fields).filter(field => text(field?.name))
  const source = row && typeof row === 'object' ? row : mockRowsForEntity(entity, 1)[0] ?? {}
  const entityName = text(entity?.name) || text(page?.title) || '页面'

  const infoFields = fields.map(field => ({
    name: field.name,
    label: fieldLabelOf(field),
    type: field.type,
    value: formatCellValue(field, source[field.name])
  }))

  const statusField =
    fields.find(field => field.type === 'enum' && /状态|status/i.test(fieldKey(field))) ||
    fields.find(field => field.type === 'enum') ||
    null
  const statusValue = statusField ? source[statusField.name] : ''
  const status = statusField
    ? {
        field: statusField.name,
        label: fieldLabelOf(statusField),
        value: statusValue === undefined || statusValue === null || statusValue === '' ? '' : String(statusValue),
        className: statusValue === undefined || statusValue === null || statusValue === ''
          ? 'status-neutral'
          : statusClassOfValue(statusField, statusValue)
      }
    : { field: '', label: '', value: '', className: 'status-neutral' }

  const heroTitleField = fields.find(field => /名称|标题|name|title/i.test(fieldKey(field)))
  const heroNumberField = fields.find(field => /编码|编号|code|单号/i.test(fieldKey(field)))
  const heroOwnerField = fields.find(field => /负责人|经办人|处理人|人员|owner|assignee|handler/i.test(fieldKey(field)))
  const hero = {
    title: heroTitleField ? formatCellValue(heroTitleField, source[heroTitleField.name]) : entityName,
    number: heroNumberField ? formatCellValue(heroNumberField, source[heroNumberField.name]) : '',
    owner: heroOwnerField ? formatCellValue(heroOwnerField, source[heroOwnerField.name]) : ''
  }

  const createdField = fields.find(field => isDateField(field) && /创建|create|建档/i.test(fieldKey(field)))
  const updatedField = fields.find(field => isDateField(field) && /更新|修改|update|modify/i.test(fieldKey(field)))
  const timeline = []
  if (createdField) {
    timeline.push({ title: '记录创建', desc: `${fieldLabelOf(createdField)}：${formatCellValue(createdField, source[createdField.name])}` })
  }
  if (updatedField && updatedField !== createdField) {
    timeline.push({ title: '最近更新', desc: `${fieldLabelOf(updatedField)}：${formatCellValue(updatedField, source[updatedField.name])}` })
  }
  if (!timeline.length) {
    timeline.push({
      title: '暂无动态',
      desc: entity ? '实体未提供创建/更新时间字段' : '页面未绑定实体'
    })
  }

  const pool = asArray(entities).filter(item => item && text(item.id))
  const rawSubTables = asArray(subTables).length ? subTables : asArray(page?.layout?.subTables)
  const subTableModels = []
  const skipped = []
  for (const item of rawSubTables) {
    const target = text(item?.target) || text(item?.entity)
    const targetEntity = pool.find(candidate => candidate.id === target)
    if (!targetEntity) {
      skipped.push(target || '未指定实体')
      continue
    }
    const { columns, skipped: missingColumns } = buildColumns(
      { layout: { table: asArray(item?.columns).length ? { columns: asArray(item?.columns) } : {} } },
      targetEntity
    )
    if (missingColumns.length) skipped.push(`${target}:${missingColumns.join('、')}`)
    subTableModels.push({
      id: target,
      title: text(item?.title) || `${targetEntity.name || target}明细`,
      mode: item?.mode === 'tab' ? 'tab' : 'flow',
      columns,
      rows: mockRowsForEntity(targetEntity, Math.max(0, Number(rowLimit) || 3))
    })
  }

  return {
    fields: infoFields,
    status,
    hero,
    timeline,
    subTables: subTableModels,
    skipped,
    entityName,
    empty: !entity
  }
}
