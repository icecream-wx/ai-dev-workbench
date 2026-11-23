import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COMPONENT_CONTROLS,
  computeFieldSpan,
  controlFromComponent,
  fieldSpanWithColumns,
  formView,
  isBatchAction,
  pagerSelectionText,
  paginationModel,
  resolveControl,
  resolveRowActions,
  resolveSelection,
  resolveToolbarActions,
  subTableView,
  treeModel
} from './contract-view.js'
import SHARED_CONTROLS from '../../../../templates/design-system/component-controls.json' with { type: 'json' }

const page = { id: 'org-list', title: '组织架构', actions: [] }

test('COMPONENT_CONTROLS：与共享 component-controls.json 完全一致（20 键）', () => {
  const sharedKeys = Object.keys(SHARED_CONTROLS)
  assert.equal(sharedKeys.length, 20)
  assert.deepEqual(Object.keys(COMPONENT_CONTROLS).sort(), [...sharedKeys].sort())
  for (const key of sharedKeys) {
    assert.equal(COMPONENT_CONTROLS[key], SHARED_CONTROLS[key], `${key} 映射应为 ${SHARED_CONTROLS[key]}`)
    assert.equal(controlFromComponent(key), SHARED_CONTROLS[key])
  }
  assert.ok(Object.isFrozen(COMPONENT_CONTROLS))
})

test('controlFromComponent：pm-* 映射与未知/空值', () => {
  assert.equal(controlFromComponent('pm-input'), 'input')
  assert.equal(controlFromComponent('pm-textarea'), 'textarea')
  assert.equal(controlFromComponent('pm-number'), 'number')
  assert.equal(controlFromComponent('pm-switch'), 'boolean')
  assert.equal(controlFromComponent('pm-datepicker'), 'date')
  assert.equal(controlFromComponent('pm-select'), 'select')
  assert.equal(controlFromComponent('pm-select-user'), 'select-user')
  assert.equal(controlFromComponent('pm-select-org'), 'select-org')
  assert.equal(controlFromComponent('pm-select-tree'), 'select')
  assert.equal(controlFromComponent('pm-radio'), 'radio')
  assert.equal(controlFromComponent('pm-checkbox'), 'checkbox')
  assert.equal(controlFromComponent('pm-upload'), 'upload')
  assert.equal(controlFromComponent('pm-image'), 'image')
  assert.equal(controlFromComponent('pm-unknown'), undefined)
  assert.equal(controlFromComponent(''), undefined)
  assert.equal(controlFromComponent(undefined), undefined)
})

test('resolveSelection：false 隐藏；true/缺省显示（保持现状）', () => {
  assert.equal(resolveSelection({ selection: false }), false)
  assert.equal(resolveSelection({ selection: true }), true)
  assert.equal(resolveSelection({}), true)
  assert.equal(resolveSelection(undefined), true)
})

test('resolveRowActions：layout 优先；缺省详情 + 编辑/删除', () => {
  assert.deepEqual(resolveRowActions(page, {}), ['detail', 'edit', 'delete'])
  assert.deepEqual(resolveRowActions({ actions: ['edit'] }, {}), ['detail', 'edit'])
  assert.deepEqual(resolveRowActions({ actions: ['detail', 'disable'] }, {}), ['detail'])
  assert.deepEqual(resolveRowActions({ actions: ['新增', '编辑', '删除'] }, {}), ['detail'], '中文旧动作码不命中 edit/delete')
  assert.deepEqual(resolveRowActions(page, { rowActions: ['detail', 'disable'] }), ['detail', 'disable'])
  assert.deepEqual(resolveRowActions(page, { rowActions: [] }), [])
})

test('resolveToolbarActions：toolbarActions > toolbar.actions > page.actions > 默认', () => {
  assert.deepEqual(resolveToolbarActions(page, {}), ['batchDelete', 'import', 'export'])
  assert.deepEqual(
    resolveToolbarActions({ actions: ['create', 'edit', 'detail', 'approve'] }, {}),
    ['approve']
  )
  assert.deepEqual(resolveToolbarActions(page, { toolbar: { actions: ['create', 'edit', 'import'] } }), ['import'])
  assert.deepEqual(
    resolveToolbarActions(page, { toolbarActions: ['create', 'import', 'batchDelete'] }),
    ['create', 'import', 'batchDelete']
  )
  assert.deepEqual(resolveToolbarActions(page, { toolbarActions: [] }), [])
})

test('pagerSelectionText：selection=true/缺省显示已选；false 退化为总数', () => {
  assert.equal(pagerSelectionText(true, 0, 31), '已选 0 项')
  assert.equal(pagerSelectionText(true, 2, 31), '已选 2 项')
  assert.equal(pagerSelectionText(undefined, 1, 31), '已选 1 项')
  assert.equal(pagerSelectionText(false, 0, 31), '共 31 条')
})

test('pagerSelectionText：selection=false 时不显示已选数量（即使计数非 0）', () => {
  assert.equal(pagerSelectionText(false, 3, 28), '共 28 条')
  assert.equal(pagerSelectionText(false, 0, 0), '共 0 条')
})

test('批量动作：默认含 batchDelete；只声明 create/import 时没有批量动作', () => {
  const defaults = resolveToolbarActions({ actions: [] }, {})
  assert.deepEqual(defaults.filter(isBatchAction), ['batchDelete'])
  const declaredToolbar = resolveToolbarActions({}, { toolbarActions: ['create', 'import'] })
  assert.deepEqual(declaredToolbar.filter(isBatchAction), [])
  const declaredPage = resolveToolbarActions({ actions: ['create', 'import'] }, {})
  assert.deepEqual(declaredPage.filter(isBatchAction), [])
  const explicitBatch = resolveToolbarActions({}, { toolbarActions: ['create', 'batchDelete', 'import'] })
  assert.deepEqual(explicitBatch.filter(isBatchAction), ['batchDelete'])
  assert.equal(isBatchAction('batchAssignRole'), true)
  assert.equal(isBatchAction('import'), false)
})

test('paginationModel：bar/split/three-part、pageSize 与非法回退', () => {
  assert.deepEqual(paginationModel({}, { total: 31, selectedCount: 2 }), {
    layout: 'bar',
    total: 31,
    selectedCount: 2,
    pageSize: 10
  })
  assert.equal(paginationModel({ pagination: { layout: 'split' } }).layout, 'split')
  assert.equal(paginationModel({ pagination: { layout: 'three-part' } }).layout, 'three-part')
  assert.equal(paginationModel({ pagination: { layout: 'grid' } }).layout, 'bar')
  assert.equal(paginationModel({ table: { pageSize: 20 } }).pageSize, 20)
  assert.equal(paginationModel({ pagination: { pageSize: 5 }, table: { pageSize: 20 } }).pageSize, 5)
  assert.equal(paginationModel({ pagination: { pageSize: 5 } }, { pageSize: 8 }).pageSize, 5)
  assert.deepEqual(paginationModel({ pagination: { layout: 'three-part', pageSize: 5 } }, { total: 31, selectedCount: 1 }), {
    layout: 'three-part',
    total: 31,
    selectedCount: 1,
    pageSize: 5
  })
})

test('treeModel：首行作根、其余作子节点（parentField 不匹配时）', () => {
  const rows = [{ 机构名称: '总部', 上级机构: '' }, { 机构名称: '研发中心', 上级机构: '不存在' }, { 机构名称: '市场部', 上级机构: '' }]
  const model = treeModel(rows, { titleField: '机构名称', parentField: '上级机构', actionStyle: 'header', selectionStyle: 'dot' })
  assert.equal(model.title, '目录树')
  assert.deepEqual(model.nodes, [
    { label: '总部', depth: 0 },
    { label: '研发中心', depth: 1 },
    { label: '市场部', depth: 1 }
  ])
  assert.equal(model.actionStyle, 'header')
  assert.equal(model.selectionStyle, 'dot')
})

test('treeModel：parentField 命中时嵌套；空值兜底；最多 12 个节点', () => {
  const rows = [
    { 名称: '总部' },
    { 名称: '研发中心', 上级: '总部' },
    { 名称: '前端组', 上级: '研发中心' },
    { 名称: '' }
  ]
  const model = treeModel(rows, { titleField: '名称', parentField: '上级', selectionStyle: 'background' })
  assert.deepEqual(model.nodes.map(node => [node.label, node.depth]), [
    ['总部', 0],
    ['研发中心', 1],
    ['前端组', 2],
    ['节点 4', 1]
  ])
  assert.equal(model.selectionStyle, 'background')
  assert.equal(model.actionStyle, 'header', 'actionStyle 缺省 header')
  const many = treeModel(Array.from({ length: 20 }, (_, i) => ({ 名称: `节点${i}` })), { titleField: '名称' })
  assert.equal(many.nodes.length, 12)
  assert.equal(treeModel([], { titleField: '名称' }).nodes.length, 0)
})

test('treeModel：非法 selectionStyle/actionStyle 回退 platform/header', () => {
  const model = treeModel([{ 名称: 'A' }], { titleField: '名称', selectionStyle: 'rainbow', actionStyle: 'side' })
  assert.equal(model.selectionStyle, 'platform')
  assert.equal(model.actionStyle, 'header')
  const none = treeModel([{ 名称: 'A' }], { titleField: '名称', actionStyle: 'none' })
  assert.equal(none.actionStyle, 'none')
})

test('formView：dialog 判定、宽度 clamp、单列与分组', () => {
  const byPresentation = formView({ form: { presentation: 'dialog', columns: 1, width: 720, groups: [{ title: '基本信息', fields: ['机构名称'] }] } }, page)
  assert.equal(byPresentation.dialog, true)
  assert.equal(byPresentation.columns, 1)
  assert.equal(byPresentation.width, 720)
  assert.deepEqual(byPresentation.groups, [{ title: '基本信息', fields: ['机构名称'] }])

  assert.equal(formView({}, { recipe: 'dialog-form' }).dialog, true)
  assert.equal(formView({}, { recipe: 'tree-list' }).dialog, false)
  assert.equal(formView({ form: { width: 120 } }, page).width, 360, '下限 360')
  assert.equal(formView({ form: { width: 1200 } }, page).width, 900, '上限 900')
  assert.equal(formView({}, page).width, 560, '缺省 560')
  assert.equal(formView({ form: { columns: 2 } }, page).columns, 2)
  assert.equal(formView({}, page).columns, 2)
  assert.deepEqual(formView({ groups: [{ title: '兜底', fields: ['A'] }] }, page).groups, [{ title: '兜底', fields: ['A'] }])
})

test('subTableView：多个子表且有 tab → tabs，否则 flow', () => {
  assert.deepEqual(subTableView({ subTables: [{ target: 'a', mode: 'tab' }, { target: 'b', mode: 'tab' }] }), { tabs: true, flow: false })
  assert.deepEqual(subTableView({ subTables: [{ target: 'a', mode: 'tab' }] }), { tabs: false, flow: true })
  assert.deepEqual(subTableView({ subTables: [{ target: 'a', mode: 'flow' }, { target: 'b', mode: 'flow' }] }), { tabs: false, flow: true })
  assert.deepEqual(subTableView({ subTables: [{ target: 'a' }, { target: 'b', mode: 'tab' }] }), { tabs: true, flow: false })
  assert.deepEqual(subTableView({}), { tabs: false, flow: true })
})

test('fieldSpanWithColumns：form.columns=1 全宽；否则沿用旧 fieldSpan', () => {
  const field = { name: '备注', label: '备注', type: 'text' }
  assert.equal(fieldSpanWithColumns(field, { form: { columns: 1 } }), 24)
  assert.equal(fieldSpanWithColumns({ name: '名称', label: '名称', type: 'string' }, { form: { columns: 2 } }), 12)
  assert.equal(fieldSpanWithColumns(field, { form: { columns: 2 } }), 24, 'textarea 仍独占整行')
  assert.equal(fieldSpanWithColumns(field, { form: { columns: 1 }, fieldOverrides: { 备注: { span: 8 } } }), 24)
  assert.equal(fieldSpanWithColumns(field, { fieldOverrides: { 备注: { span: 8 } } }), 8)
  assert.equal(computeFieldSpan({ name: '名称', label: '名称', type: 'string' }, { form: { columns: 1 } }, false), 12)
})

test('resolveControl：override > components > 类型/命名推断', () => {
  const field = { name: '状态', label: '状态', type: 'enum', options: ['启用', '停用'] }
  assert.equal(resolveControl(field, undefined), 'radio')
  assert.equal(resolveControl(field, { components: { 状态: 'pm-switch' } }), 'boolean')
  assert.equal(resolveControl(field, { components: { 状态: 'pm-select' } }), 'select')
  assert.equal(resolveControl(field, { components: { 状态: 'pm-switch' }, fieldOverrides: { 状态: { control: 'select' } } }), 'select')
  assert.equal(resolveControl({ name: '负责人', label: '负责人', type: 'string' }, {}), 'select-user')
  assert.equal(resolveControl({ name: '备注', label: '备注', type: 'text' }, {}), 'textarea')
})
