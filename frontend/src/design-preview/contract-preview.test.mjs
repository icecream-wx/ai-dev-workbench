import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TEMPLATE_RENDER_RECIPES,
  buildColumns,
  buildDashboardModel,
  buildDetailModel,
  buildFilters,
  buildForm,
  buildRowActions,
  buildToolbar,
  buildTreeRows,
  actionLabel,
  controlOf,
  formatCellValue,
  hasExplicitContract,
  mockFieldValue,
  mockRowsForEntity,
  pageSizeOf,
  pagerTextOf,
  prototypeModeFor,
  resolveContractRecipe,
  selectOptionsOf,
  statusClassOfValue,
  supportsTemplateRender
} from './contract-preview.js'

const ENTITY = {
  id: 'product',
  name: '商品',
  fields: [
    { name: '商品编码', label: '商品编码', type: 'string', required: true, unique: true },
    { name: '商品名称', label: '商品名称', type: 'string', required: true },
    { name: '商品分类', label: '商品分类', type: 'string' },
    { name: '销售单价', label: '销售单价', type: 'decimal' },
    { name: '库存数量', label: '库存数量', type: 'number' },
    { name: '商品状态', label: '商品状态', type: 'enum', options: ['上架', '下架'] },
    { name: '上架时间', label: '上架时间', type: 'datetime' },
    { name: '商品描述', label: '商品描述', type: 'text' },
    { name: '是否推荐', label: '是否推荐', type: 'boolean' }
  ]
}

/** 构造与 adaptDesign 输出同形的页面 */
function pageOf(overrides = {}) {
  return {
    id: 'product-list',
    type: 'list',
    title: '商品列表',
    pageSetId: 'product-main',
    entityId: 'product',
    spec: { columns: [], actions: [] },
    layout: {},
    ...overrides
  }
}

const TEMPLATE_PAGES = [
  { id: 'treeTable', recipe: 'tree-list' },
  { id: 'list', recipe: 'list' },
  { id: 'form', recipe: 'page-form' }
]

test('resolveContractRecipe：显式 recipe 优先', () => {
  assert.equal(resolveContractRecipe({ recipe: 'tree-list' }), 'tree-list')
  assert.equal(resolveContractRecipe({ recipe: 'dashboard' }), 'dashboard')
})

test('resolveContractRecipe：catalogRef 回退模板页面配方', () => {
  assert.equal(
    resolveContractRecipe({ catalogRef: 'operations-management/treeTable' }, TEMPLATE_PAGES),
    'tree-list'
  )
  assert.equal(resolveContractRecipe({ catalogRef: 'operations-management/list' }, TEMPLATE_PAGES), 'list')
})

test('resolveContractRecipe：无契约按页面类型推断', () => {
  assert.equal(resolveContractRecipe({ type: 'list' }), 'list')
  assert.equal(resolveContractRecipe({ type: 'form' }), 'page-form')
  assert.equal(resolveContractRecipe({ type: 'tree-list' }), 'list')
  assert.equal(resolveContractRecipe({ type: 'detail' }), 'detail')
  assert.equal(resolveContractRecipe({ type: 'workspace' }), 'detail')
  assert.equal(resolveContractRecipe({ type: 'dashboard' }), 'dashboard')
  assert.equal(resolveContractRecipe(null), 'detail')
})

test('resolveContractRecipe：未知显式 recipe 按 page.type 映射（P10b）', () => {
  assert.equal(resolveContractRecipe({ recipe: 'approval-flow', type: 'detail' }), 'detail')
  assert.equal(resolveContractRecipe({ recipe: 'matrix', type: 'form' }), 'page-form')
  assert.equal(resolveContractRecipe({ recipe: 'matrix', type: 'list' }), 'list')
  assert.equal(resolveContractRecipe({ recipe: 'matrix', type: 'dashboard' }), 'dashboard')
  assert.equal(resolveContractRecipe({ recipe: 'matrix', type: 'unknown' }), 'detail')
  // blueprint 也视为显式契约
  assert.equal(resolveContractRecipe({ blueprint: 'x/Page.vue', type: 'form' }), 'page-form')
})

test('支持判定：有任一显式契约（recipe/catalogRef/blueprint）即走模板风格（P10b）', () => {
  assert.equal(supportsTemplateRender(pageOf({ recipe: 'list' }), TEMPLATE_PAGES), true)
  assert.equal(supportsTemplateRender(pageOf({ recipe: 'dialog-form' }), TEMPLATE_PAGES), true)
  // 仅有 catalogRef、配方由模板页面推断
  assert.equal(supportsTemplateRender(pageOf({ catalogRef: 'operations-management/treeTable' }), TEMPLATE_PAGES), true)
  // 无显式契约（旧设计）→ 线框
  assert.equal(supportsTemplateRender(pageOf(), TEMPLATE_PAGES), false)
  assert.equal(hasExplicitContract(pageOf()), false)
  assert.equal(hasExplicitContract(pageOf({ blueprint: 'x/Page.vue' })), true)
  // P10/P10b：detail / dashboard / main-sub / wizard 都支持
  assert.equal(supportsTemplateRender(pageOf({ recipe: 'detail' }), TEMPLATE_PAGES), true)
  assert.equal(supportsTemplateRender(pageOf({ recipe: 'dashboard' }), TEMPLATE_PAGES), true)
  assert.equal(supportsTemplateRender(pageOf({ recipe: 'main-sub' }), TEMPLATE_PAGES), true)
  assert.equal(supportsTemplateRender(pageOf({ recipe: 'wizard' }), TEMPLATE_PAGES), true)
  // 未知显式配方 + blueprint 也支持（映射到通用模板页）
  assert.equal(
    supportsTemplateRender(pageOf({ recipe: 'approval-flow', blueprint: 'x/Page.vue' }), TEMPLATE_PAGES),
    true
  )
  assert.deepEqual(TEMPLATE_RENDER_RECIPES, [
    'list',
    'tree-list',
    'page-form',
    'dialog-form',
    'detail',
    'dashboard',
    'main-sub',
    'wizard'
  ])
})

test('prototypeModeFor：默认模式判定', () => {
  assert.equal(prototypeModeFor(pageOf({ recipe: 'list' }), TEMPLATE_PAGES), 'template')
  assert.equal(prototypeModeFor(pageOf({ recipe: 'main-sub' }), TEMPLATE_PAGES), 'template')
  assert.equal(prototypeModeFor(pageOf({ recipe: 'wizard' }), TEMPLATE_PAGES), 'template')
  assert.equal(prototypeModeFor(pageOf({ blueprint: 'x/Page.vue' }), TEMPLATE_PAGES), 'template')
  assert.equal(prototypeModeFor(pageOf(), TEMPLATE_PAGES), 'wireframe')
  assert.equal(prototypeModeFor(null, TEMPLATE_PAGES), 'wireframe')
})

test('mockRowsForEntity：确定性且可读', () => {
  const first = mockRowsForEntity(ENTITY, 6)
  const second = mockRowsForEntity(ENTITY, 6)
  assert.deepEqual(first, second)
  assert.equal(first.length, 6)
  assert.equal(first[0]['商品编码'], 'BH-0001')
  assert.equal(first[1]['商品编码'], 'BH-0002')
  assert.equal(first[0]['商品状态'], '上架')
  assert.equal(first[1]['商品状态'], '下架')
  assert.equal(typeof first[0]['销售单价'], 'number')
  assert.match(first[0]['上架时间'], /^2026-\d{2}-\d{2} \d{2}:\d{2}:00$/)
  assert.equal(first[0]['是否推荐'], true)
  assert.equal(mockRowsForEntity(null, 3).length, 3)
})

test('mockFieldValue：按类型与 options 生成，不随机', () => {
  assert.equal(mockFieldValue({ type: 'enum', options: ['甲', '乙'] }, 3), '乙')
  assert.equal(mockFieldValue({ type: 'boolean' }, 1), false)
  assert.equal(mockFieldValue({ type: 'number', name: '库存数量', label: '库存数量' }, 2), 26)
  assert.equal(mockFieldValue({ type: 'text' }, 0), mockFieldValue({ type: 'text' }, 0))
})

test('mockFieldValue：枚举 offset 只错开取值，两参调用兼容', () => {
  const field = { type: 'enum', options: ['甲', '乙', '丙'] }
  // 两参调用与 offset=0 等价
  assert.equal(mockFieldValue(field, 0), '甲')
  assert.equal(mockFieldValue(field, 0, 0), '甲')
  assert.equal(mockFieldValue(field, 1), '乙')
  assert.equal(mockFieldValue(field, 1, 0), '乙')
  // offset 循环错开
  assert.equal(mockFieldValue(field, 0, 1), '乙')
  assert.equal(mockFieldValue(field, 0, 2), '丙')
  assert.equal(mockFieldValue(field, 3), '甲')
  assert.equal(mockFieldValue(field, 3, 1), '乙')
  // 非法 offset 视为 0，保持确定性
  assert.equal(mockFieldValue(field, 1, -2), '乙')
  assert.equal(mockFieldValue(field, 1, 1.5), '乙')
  // 非枚举类型不受 offset 影响
  assert.equal(mockFieldValue({ type: 'number' }, 1, 2), mockFieldValue({ type: 'number' }, 1))
  assert.equal(mockFieldValue({ type: 'boolean' }, 0, 2), mockFieldValue({ type: 'boolean' }, 0))
})

test('mockRowsForEntity：同一行多个枚举字段取值不同，首个枚举字段分布不变', () => {
  const entity = {
    id: 'audit',
    name: '审核单',
    fields: [
      { name: '单据编号', type: 'string' },
      { name: '主状态', type: 'enum', options: ['甲', '乙', '丙'] },
      { name: '子状态', type: 'enum', options: ['甲', '乙', '丙'] },
      { name: '审核状态', type: 'enum', options: ['甲', '乙', '丙'] }
    ]
  }
  const first = mockRowsForEntity(entity, 6)
  const second = mockRowsForEntity(entity, 6)
  // 确定性：两次调用一致
  assert.deepEqual(first, second)
  assert.equal(first.length, 6)
  // 首个枚举字段 offset=0：首行取 options[0]，逐行按 index 循环（状态标签/详情/dashboard 语义不变）
  assert.equal(first[0]['主状态'], '甲')
  assert.equal(first[1]['主状态'], '乙')
  assert.equal(first[2]['主状态'], '丙')
  first.forEach((row, index) => {
    assert.equal(row['主状态'], ['甲', '乙', '丙'][index % 3])
  })
  // 同一行三个枚举字段取值互不相同（offset 依次 0/1/2）
  for (const row of first) {
    assert.equal(new Set([row['主状态'], row['子状态'], row['审核状态']]).size, 3)
  }
})

test('mockRowsForEntity：既有商品实体状态列分布不变（回归）', () => {
  const rows = mockRowsForEntity(ENTITY, 4)
  assert.deepEqual(rows.map(row => row['商品状态']), ['上架', '下架', '上架', '下架'])
})

test('buildColumns：列映射 + 不存在列跳过', () => {
  const page = pageOf({ layout: { table: { columns: ['商品编码', '不存在的列', '商品状态', '销售单价'] } } })
  const { columns, skipped } = buildColumns(page, ENTITY)
  assert.deepEqual(columns.map(column => column.prop), ['商品编码', '商品状态', '销售单价'])
  assert.deepEqual(skipped, ['不存在的列'])
  assert.equal(columns[1].scope, 'status')
  assert.equal(columns[2].width, 120)
})

test('buildColumns：无契约列时取实体前 6 个字段', () => {
  const { columns, skipped } = buildColumns(pageOf(), ENTITY)
  assert.equal(columns.length, 6)
  assert.equal(skipped.length, 0)
})

test('buildColumns：无实体 → 空列不白屏', () => {
  const { columns, skipped } = buildColumns(pageOf({ layout: { table: { columns: ['商品编码'] } } }), null)
  assert.equal(columns.length, 0)
  assert.deepEqual(skipped, ['商品编码'])
})

test('buildFilters：查询字段映射 + 跳过未知字段', () => {
  const page = pageOf({ layout: { table: { searchFields: ['商品名称', '幽灵字段', '商品状态'] } } })
  const { fields, skipped } = buildFilters(page, ENTITY)
  assert.deepEqual(fields.map(field => field.name), ['商品名称', '商品状态'])
  assert.deepEqual(skipped, ['幽灵字段'])
})

test('buildToolbar：create 单列，批量动作只进批量条', () => {
  const page = pageOf({
    spec: { actions: ['新增', '编辑', '删除'] },
    layout: { toolbarActions: ['create', 'import', 'batchDelete'] }
  })
  const toolbar = buildToolbar(page)
  assert.deepEqual(toolbar.heading, ['import'])
  assert.deepEqual(toolbar.batch, ['batchDelete'])
  assert.equal(toolbar.hasCreate, true)
})

test('buildRowActions：显式 rowActions 优先，标签中文化', () => {
  const page = pageOf({ layout: { rowActions: ['detail', 'edit', 'delete'] } })
  assert.deepEqual(buildRowActions(page).map(item => item.label), ['详情', '编辑', '删除'])
  assert.equal(actionLabel('unknownAction'), 'unknownAction')
})

test('buildTreeRows：无 parentField → 去重扁平 + 提示', () => {
  const rows = mockRowsForEntity(ENTITY, 6)
  const tree = buildTreeRows(rows, { titleField: '商品分类' })
  assert.equal(tree.flat, true)
  assert.ok(tree.nodes.length >= 2)
  const labels = tree.nodes.map(node => node.label)
  assert.equal(new Set(labels).size, labels.length)
  assert.match(tree.note, /未配置 parentField/)
})

test('buildTreeRows：parentField 可匹配 → 嵌套', () => {
  const rows = [
    { 名称: '总部', 上级: '' },
    { 名称: '华东', 上级: '总部' },
    { 名称: '华南', 上级: '总部' }
  ]
  const tree = buildTreeRows(rows, { titleField: '名称', parentField: '上级' })
  assert.equal(tree.flat, false)
  assert.equal(tree.nodes.length, 1)
  assert.equal(tree.nodes[0].children.length, 2)
  assert.equal(tree.note, '')
})

test('buildTreeRows：parentField 匹配不到 → 回退扁平 + 提示', () => {
  const rows = mockRowsForEntity(ENTITY, 4)
  const tree = buildTreeRows(rows, { titleField: '商品分类', parentField: '上级分类' })
  assert.equal(tree.flat, true)
  assert.match(tree.note, /未匹配到上级节点/)
})

test('buildTreeRows：重复子节点标签不重复挂到 roots（P7-7a 回归）', () => {
  // 同一个子节点在两行里各出现一次（parentField 相同），旧实现会把已挂载的子节点再次 push 到 roots
  const rows = [
    { 名称: '总部', 上级: '' },
    { 名称: '华东', 上级: '总部' },
    { 名称: '华南', 上级: '总部' },
    { 名称: '华东', 上级: '总部' },
    { 名称: '华南', 上级: '总部' }
  ]
  const tree = buildTreeRows(rows, { titleField: '名称', parentField: '上级' })
  assert.equal(tree.flat, false)
  assert.equal(tree.nodes.length, 1)
  assert.equal(tree.nodes[0].label, '总部')
  assert.deepEqual(tree.nodes[0].children.map(child => child.label), ['华东', '华南'])
  // 子节点不得同时出现在 roots
  const rootLabels = tree.nodes.map(node => node.label)
  assert.equal(rootLabels.filter(label => label === '华东').length, 0)
  assert.equal(rootLabels.filter(label => label === '华南').length, 0)
})

test('buildTreeRows：重复出现的父节点也只挂一次子节点', () => {
  const rows = [
    { 名称: '总部', 上级: '' },
    { 名称: '总部', 上级: '' },
    { 名称: '华东', 上级: '总部' },
    { 名称: '华东', 上级: '总部' }
  ]
  const tree = buildTreeRows(rows, { titleField: '名称', parentField: '上级' })
  assert.equal(tree.nodes.length, 1)
  assert.equal(tree.nodes[0].children.length, 1)
})

test('buildTreeRows：先出现为根、后出现带父级时从 roots 移走', () => {
  const rows = [
    { 名称: '华东', 上级: '' },
    { 名称: '总部', 上级: '' },
    { 名称: '华东', 上级: '总部' }
  ]
  const tree = buildTreeRows(rows, { titleField: '名称', parentField: '上级' })
  assert.equal(tree.flat, false)
  assert.deepEqual(tree.nodes.map(node => node.label), ['总部'])
  assert.deepEqual(tree.nodes[0].children.map(child => child.label), ['华东'])
})

test('buildTreeRows：缺 titleField → 明确提示', () => {
  const tree = buildTreeRows(mockRowsForEntity(ENTITY, 3), {})
  assert.equal(tree.nodes.length, 0)
  assert.match(tree.note, /titleField/)
})

test('buildForm：分组字段解析 + 弹窗宽度 clamp + 跳过未知字段', () => {
  const page = pageOf({
    recipe: 'dialog-form',
    type: 'form',
    layout: {
      form: {
        presentation: 'dialog',
        columns: 2,
        width: 760,
        groups: [
          { title: '基本信息', fields: ['商品编码', '商品名称', '幽灵字段'] },
          { title: '价格与库存', fields: ['销售单价', '库存数量', '商品状态'] }
        ]
      }
    }
  })
  const form = buildForm(page, ENTITY)
  assert.equal(form.dialog, true)
  assert.equal(form.columns, 2)
  assert.equal(form.width, 760)
  assert.deepEqual(form.groups.map(group => group.title), ['基本信息', '价格与库存'])
  assert.equal(form.groups[0].fields.length, 2)
  assert.deepEqual(form.skipped, ['幽灵字段'])
})

test('buildForm：宽度越界 clamp 到 360–900', () => {
  const wide = buildForm(pageOf({ layout: { form: { width: 2000 } } }), ENTITY)
  const narrow = buildForm(pageOf({ layout: { form: { width: 120 } } }), ENTITY)
  assert.equal(wide.width, 900)
  assert.equal(narrow.width, 360)
  assert.equal(buildForm(pageOf(), ENTITY).width, 560)
})

test('buildForm：无分组成员时按 form.fields 兜底', () => {
  const form = buildForm(pageOf({ layout: { form: { fields: ['商品编码', '销售单价'] } } }), ENTITY)
  assert.equal(form.groups.length, 1)
  assert.deepEqual(form.fields.map(field => field.name), ['商品编码', '销售单价'])
})

test('controlOf / selectOptionsOf：契约 components 覆盖与选项', () => {
  const page = pageOf({ layout: { components: { 商品状态: 'pm-switch', 销售单价: 'pm-number' } } })
  const status = ENTITY.fields.find(field => field.name === '商品状态')
  const price = ENTITY.fields.find(field => field.name === '销售单价')
  assert.equal(controlOf(status, page), 'boolean')
  assert.equal(controlOf(price, page), 'number')
  assert.equal(controlOf(ENTITY.fields[0], page), 'input')
  assert.deepEqual(selectOptionsOf(status), [
    { label: '上架', value: '上架' },
    { label: '下架', value: '下架' }
  ])
})

test('pageSizeOf / pagerTextOf：分页与已选文案', () => {
  assert.equal(pageSizeOf(pageOf({ layout: { pagination: { pageSize: 20 } } })), 20)
  assert.equal(pageSizeOf(pageOf({ layout: { table: { pageSize: 5 } } })), 5)
  assert.equal(pageSizeOf(pageOf()), 10)
  assert.equal(pageSizeOf(pageOf({ layout: { pagination: { pageSize: 999 } } })), 50)
  assert.equal(pagerTextOf(pageOf({ layout: { selection: true } }), { total: 12, selectedCount: 2 }), '已选 2 项')
  assert.equal(pagerTextOf(pageOf({ layout: { selection: false } }), { total: 12, selectedCount: 2 }), '共 12 条')
})

test('formatCellValue：空值/布尔/小数可读化', () => {
  assert.equal(formatCellValue({ type: 'string' }, ''), '-')
  assert.equal(formatCellValue({ type: 'boolean' }, true), '是')
  assert.equal(formatCellValue({ type: 'decimal' }, 120.5), '120.50')
  assert.equal(formatCellValue({ type: 'number' }, 1200), '1,200')
})

/* ------------------------------------------------------------------ *
 * P10：detail / dashboard
 * ------------------------------------------------------------------ */

const DASH_ENTITY = {
  id: 'product',
  name: '商品',
  fields: [
    { name: '商品编码', label: '商品编码', type: 'string' },
    { name: '商品名称', label: '商品名称', type: 'string' },
    { name: '商品分类', label: '商品分类', type: 'string' },
    { name: '销售单价', label: '销售单价', type: 'decimal' },
    { name: '库存数量', label: '库存数量', type: 'number' },
    { name: '商品状态', label: '商品状态', type: 'enum', options: ['上架', '下架'] },
    { name: '创建时间', label: '创建时间', type: 'datetime' },
    { name: '更新时间', label: '更新时间', type: 'datetime' }
  ]
}

const DETAIL_ENTITY = {
  id: 'productDetail',
  name: '商品明细',
  fields: [
    { name: '明细编号', label: '明细编号', type: 'string' },
    { name: '规格型号', label: '规格型号', type: 'string' },
    { name: '包装方式', label: '包装方式', type: 'enum', options: ['袋', '盒', '罐', '箱'] }
  ]
}

test('buildDashboardModel：记录总数 + 数值字段合计（≥3 张指标卡）', () => {
  const rows = mockRowsForEntity(DASH_ENTITY, 12)
  const model = buildDashboardModel({ page: pageOf({ recipe: 'dashboard' }), entity: DASH_ENTITY, rows })
  assert.ok(model.metrics.length >= 3)
  assert.equal(model.metrics[0].label, '记录总数')
  assert.equal(model.metrics[0].value, '12')
  const labels = model.metrics.map(metric => metric.label)
  assert.ok(labels.includes('销售单价合计'))
  assert.ok(labels.includes('库存数量合计'))
  assert.ok(model.metrics.every(metric => String(metric.value) !== '—'))
  assert.equal(model.rows.length, 5)
  assert.equal(model.empty, false)
})

test('buildDashboardModel：枚举字段 → 饼图 option（确定性）', () => {
  const rows = mockRowsForEntity(DASH_ENTITY, 8)
  const first = buildDashboardModel({ page: pageOf({ recipe: 'dashboard' }), entity: DASH_ENTITY, rows })
  const second = buildDashboardModel({ page: pageOf({ recipe: 'dashboard' }), entity: DASH_ENTITY, rows })
  assert.deepEqual(first, second)
  assert.equal(first.chartOption.chartView.series[0].type, 'pie')
  const names = first.chartOption.chartView.series[0].data.map(item => item.name)
  assert.deepEqual(names, ['上架', '下架'])
})

test('buildDashboardModel：无枚举 → 数值柱图 option', () => {
  const entity = { ...DASH_ENTITY, fields: DASH_ENTITY.fields.filter(field => field.type !== 'enum') }
  const model = buildDashboardModel({ page: pageOf({ recipe: 'dashboard' }), entity, rows: mockRowsForEntity(entity, 6) })
  assert.equal(model.chartOption.chartView.series[0].type, 'bar')
  assert.ok(Array.isArray(model.chartOption.chartView.xAxis.data))
  assert.equal(model.chartOption.chartView.xAxis.data.length, 6)
})

test('buildDashboardModel：无实体 → 3 张占位卡 + 无图表（不伪造数据）', () => {
  const model = buildDashboardModel({ page: pageOf({ recipe: 'dashboard' }), entity: null, rows: [] })
  assert.equal(model.metrics.length, 3)
  assert.ok(model.metrics.every(metric => metric.value === '—'))
  assert.equal(model.chartOption, null)
  assert.equal(model.empty, true)
  assert.equal(model.columns.length, 0)
  assert.equal(model.rows.length, 0)
})

test('buildDetailModel：字段值来自第一行 mock + 状态映射', () => {
  const rows = mockRowsForEntity(DASH_ENTITY, 3)
  const model = buildDetailModel({ page: pageOf({ recipe: 'detail' }), entity: DASH_ENTITY, row: rows[1] })
  assert.equal(model.empty, false)
  const byName = new Map(model.fields.map(field => [field.name, field]))
  assert.equal(byName.get('商品编码').value, 'BH-0002')
  assert.equal(model.status.value, '下架')
  assert.equal(model.status.className, 'status-danger')
  assert.equal(model.hero.number, 'BH-0002')
  assert.ok(model.hero.title.startsWith('商品'))
})

test('buildDetailModel：创建/更新时间 → 时间线', () => {
  const rows = mockRowsForEntity(DASH_ENTITY, 1)
  const model = buildDetailModel({ page: pageOf({ recipe: 'detail' }), entity: DASH_ENTITY, row: rows[0] })
  assert.deepEqual(model.timeline.map(item => item.title), ['记录创建', '最近更新'])
  assert.ok(model.timeline[0].desc.includes('创建时间'))
})

test('buildDetailModel：无时间字段 → 只显示「暂无动态」', () => {
  const entity = {
    id: 'note',
    name: '备注',
    fields: [{ name: '标题', label: '标题', type: 'string' }]
  }
  const model = buildDetailModel({ page: pageOf({ recipe: 'detail' }), entity, row: { 标题: '示例' } })
  assert.equal(model.timeline.length, 1)
  assert.equal(model.timeline[0].title, '暂无动态')
  assert.equal(model.status.value, '')
})

test('buildDetailModel：子表按实体池解析（3 行）+ 未知 target 跳过', () => {
  const model = buildDetailModel({
    page: pageOf({
      recipe: 'detail',
      layout: {
        subTables: [
          { target: 'productDetail', title: '商品明细', columns: ['明细编号'], mode: 'tab' },
          { target: 'ghost', title: '不存在' }
        ]
      }
    }),
    entity: DASH_ENTITY,
    row: mockRowsForEntity(DASH_ENTITY, 1)[0],
    entities: [DASH_ENTITY, DETAIL_ENTITY]
  })
  assert.equal(model.subTables.length, 1)
  assert.equal(model.subTables[0].title, '商品明细')
  assert.equal(model.subTables[0].mode, 'tab')
  assert.equal(model.subTables[0].rows.length, 3)
  assert.deepEqual(model.subTables[0].columns.map(column => column.prop), ['明细编号'])
  assert.deepEqual(model.skipped, ['ghost'])
})

test('buildDetailModel：无实体 → 空态 + 占位动态', () => {
  const model = buildDetailModel({ page: pageOf({ recipe: 'detail' }), entity: null })
  assert.equal(model.empty, true)
  assert.equal(model.fields.length, 0)
  assert.equal(model.timeline[0].title, '暂无动态')
})

test('statusClassOfValue：枚举顺序映射状态色', () => {
  const field = { type: 'enum', options: ['上架', '下架'] }
  assert.equal(statusClassOfValue(field, '上架'), 'status-success')
  assert.equal(statusClassOfValue(field, '下架'), 'status-danger')
  assert.equal(statusClassOfValue({ type: 'enum', options: ['甲', '乙', '丙'] }, '乙'), 'status-warning')
  assert.equal(statusClassOfValue(field, '未知'), 'status-neutral')
})
