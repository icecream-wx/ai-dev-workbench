import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PAGE_TYPES,
  adaptDesign,
  designSummaryOf,
  designWarningsOf,
  mergeModuleEntries
} from './design-adapter.js'

const modules = [
  { key: 'MOD-001', title: '商品管理' },
  { key: 'MOD-002', title: '订单管理' }
]

const design = {
  module: 'MOD-001',
  title: '商品管理',
  file: 'docs/design/MOD-001/design.json',
  errors: [],
  entities: [
    {
      id: 'product',
      name: '商品',
      table: 'biz_product',
      fields: [
        { name: '编码', type: 'string', required: true, unique: true },
        { name: '状态', type: 'enum', options: ['上架', '下架'] },
        { name: '分类', type: 'ref', ref: 'category' }
      ]
    },
    { id: 'category', name: '分类', fields: [{ name: '名称', type: 'string' }] }
  ],
  relations: [{ from: 'product', to: 'category', type: 'N:1', label: '所属分类' }],
  pages: [
    {
      id: 'product-list',
      name: '商品列表',
      type: 'list',
      entity: 'product',
      columns: ['编码', '状态'],
      actions: ['新增', '删除']
    }
  ]
}

test('基本映射：实体/字段/关系/页面集/渲染页面', () => {
  const result = adaptDesign(design, { modules })
  assert.equal(result.module, 'MOD-001')
  assert.equal(result.title, '商品管理')
  assert.equal(result.file, 'docs/design/MOD-001/design.json')
  assert.equal(result.entities.length, 2)
  assert.deepEqual(result.entities[0].fields.map(field => field.name), ['编码', '状态', '分类'])
  assert.equal(result.entities[0].fields[0].label, '编码', '缺少 label 时回退字段名')
  assert.equal(result.entities[0].fields[1].options[0], '上架')
  assert.deepEqual(result.relations, [{ from: 'product', to: 'category', type: 'N:1', label: '所属分类' }])
  assert.equal(result.pageSet.id, 'MOD-001-main')
  assert.equal(result.pageSet.title, '商品管理')
  assert.equal(result.pageSet.pages[0].entity, 'product')
  const page = result.pages[0]
  assert.equal(page.title, '商品列表')
  assert.equal(page.pageSetId, 'MOD-001-main')
  assert.equal(page.entityId, 'product')
  assert.deepEqual(page.spec.columns, ['编码', '状态'])
  assert.deepEqual(page.spec.actions, ['新增', '删除'])
  assert.deepEqual(page.layout.table.columns, ['编码', '状态'])
  assert.deepEqual(page.layout.toolbar.actions, ['新增', '删除'])
  assert.deepEqual(result.warnings, [])
})

test('关系挂到实体上供 er-layout 使用（旧类型名 + target/name）', () => {
  const result = adaptDesign(design, { modules })
  assert.deepEqual(result.entities[0].relations, [{ target: 'category', type: 'many-to-one', name: '所属分类' }])
  assert.deepEqual(result.entities[1].relations, [])
})

test('页面引用其它模块实体 → entityId=null + warning', () => {
  const result = adaptDesign(
    { ...design, pages: [{ id: 'order-list', name: '订单列表', type: 'list', entity: 'MOD-002/order' }] },
    { modules }
  )
  assert.equal(result.pages[0].entityId, null)
  assert.ok(result.warnings.some(item => item.includes('MOD-002/order') && item.includes('其它模块')))
})

test('页面引用未知实体 → entityId=null + warning', () => {
  const result = adaptDesign({ ...design, pages: [{ id: 'x', name: 'X', type: 'detail', entity: 'nope' }] }, { modules })
  assert.equal(result.pages[0].entityId, null)
  assert.ok(result.warnings.some(item => item.includes('实体不存在：nope')))
})

test('重复实体/页面 id → 保留第一个 + warning', () => {
  const result = adaptDesign(
    {
      ...design,
      entities: [design.entities[0], { ...design.entities[1], id: 'product' }],
      pages: [design.pages[0], { ...design.pages[0] }]
    },
    { modules }
  )
  assert.equal(result.entities.length, 1)
  assert.equal(result.pages.length, 1)
  assert.ok(result.warnings.some(item => item.includes('实体 id 重复：product')))
  assert.ok(result.warnings.some(item => item.includes('页面 id 重复：product-list')))
})

test('未知页面类型降级 list + warning；缺失 id 自动生成', () => {
  const result = adaptDesign(
    { ...design, pages: [{ name: '奇怪页面', type: 'timeline' }, { id: 'ok', name: 'OK', type: 'form' }] },
    { modules }
  )
  assert.equal(result.pages[0].type, 'list')
  assert.match(result.pages[0].id, /^page-/)
  assert.equal(result.pages[1].type, 'form')
  assert.ok(result.warnings.some(item => item.includes('timeline') && item.includes('降级为 list')))
  assert.equal(PAGE_TYPES.includes('timeline'), false)
})

test('空设计/无页面/无实体不抛错', () => {
  const empty = adaptDesign({ module: 'MOD-002', title: '', entities: [], pages: [] }, { modules })
  assert.equal(empty.title, '订单管理', '标题为空时回退需求模块标题')
  assert.deepEqual(empty.entities, [])
  assert.deepEqual(empty.pages, [])
  assert.equal(empty.pageSet.pages.length, 0)

  const missing = adaptDesign(null, { modules })
  assert.equal(missing.entities.length, 0)
  assert.equal(missing.module, '')
  assert.equal(missing.title, '未命名设计')
})

test('跨模块/未知关系不画；未知关系类型按 N:1', () => {
  const result = adaptDesign(
    {
      ...design,
      relations: [
        { from: 'product', to: 'MOD-002/order', type: 'N:1', label: '所属订单' },
        { from: 'product', to: 'category', type: 'one-many', label: '' }
      ]
    },
    { modules }
  )
  assert.equal(result.relations.length, 1)
  assert.equal(result.relations[0].type, 'N:1')
  assert.ok(result.warnings.some(item => item.includes('引用外部/未知实体')))
  assert.ok(result.warnings.some(item => item.includes('one-many')))
})

test('designSummaryOf：未生成/有设计/错误数', () => {
  assert.deepEqual(designSummaryOf(null), { hasDesign: false, entityCount: 0, pageCount: 0, errorCount: 0 })
  assert.deepEqual(designSummaryOf(design), { hasDesign: true, entityCount: 2, pageCount: 1, errorCount: 0 })
  assert.equal(designSummaryOf({ ...design, errors: [{}, {}] }).errorCount, 2)
})

test('mergeModuleEntries：需求模块 + 孤儿设计（末尾、只读标记）', () => {
  const entries = mergeModuleEntries(modules, [
    { module: 'MOD-001', title: '商品管理', entities: [], pages: [] },
    { module: 'MOD-900', title: '历史设计', entities: [{ id: 'x' }], pages: [] }
  ])
  assert.deepEqual(
    entries.map(entry => entry.key),
    ['MOD-001', 'MOD-002', 'MOD-900']
  )
  assert.equal(entries[0].orphan, false)
  assert.equal(entries[2].orphan, true)
  assert.equal(entries[2].title, '历史设计')
  assert.equal(entries[2].order, Number.MAX_SAFE_INTEGER)
  // 没有孤儿时不追加
  assert.equal(mergeModuleEntries(modules, []).length, 2)
})

test('designWarningsOf：设计文件级 warnings → 错误条行（带文件/模块）', () => {
  const lines = designWarningsOf([
    { module: 'MOD-900', file: 'docs/design/MOD-900/design.json', warnings: ['设计模块 MOD-900 没有对应需求模块文件'] },
    { module: 'MOD-001', file: '', warnings: [] }
  ])
  assert.equal(lines.length, 1)
  assert.match(lines[0], /MOD-900\/design\.json · 警告 ·/)
  assert.match(lines[0], /没有对应需求模块/)
})

test('P7 页面契约：designSystem + filters/columns/pagination/selection/行与工具栏操作/树/子表/组件', () => {
  const contract = {
    ...design,
    designSystem: {
      pack: 'afcenter-app-templates-v1',
      applicationType: 'enterprise-application-platform',
      style: 'platform-blue'
    },
    pages: [
      {
        id: 'org-list',
        name: '组织架构',
        type: 'list',
        entity: 'product',
        recipe: 'tree-list',
        catalogRef: 'enterprise-application-platform/organization',
        blueprint: 'application-types/enterprise-application-platform/pages/OrganizationUsers.vue',
        filters: ['编码', '状态'],
        columns: ['编码', '状态'],
        rowActions: ['detail', 'edit', 'delete'],
        toolbarActions: ['create', 'batchAssignRole'],
        selection: true,
        pagination: { layout: 'three-part', pageSize: 20 },
        tree: { titleField: '编码', parentField: '状态', actionStyle: 'header', selectionStyle: 'dot' },
        subTables: [{ entity: 'category', title: '子分类', columns: ['名称'], mode: 'tab' }],
        components: { 状态: 'pm-select' }
      },
      {
        id: 'org-form',
        name: '组织编辑',
        type: 'form',
        entity: 'product',
        recipe: 'dialog-form',
        form: {
          presentation: 'dialog',
          columns: 2,
          width: 800,
          fields: ['编码', '状态'],
          groups: [{ title: '基本信息', fields: ['编码'] }]
        }
      }
    ]
  }
  const result = adaptDesign(contract, { modules })
  assert.deepEqual(result.designSystem, {
    pack: 'afcenter-app-templates-v1',
    applicationType: 'enterprise-application-platform',
    style: 'platform-blue'
  })
  assert.deepEqual(result.warnings, [])

  const list = result.pages[0]
  assert.equal(list.recipe, 'tree-list')
  assert.equal(list.catalogRef, 'enterprise-application-platform/organization')
  assert.match(list.blueprint, /OrganizationUsers\.vue$/)
  assert.deepEqual(list.spec.columns, ['编码', '状态'])
  assert.deepEqual(list.spec.filters, ['编码', '状态'])
  assert.equal(list.spec.selection, true)
  // 未提供 actions 时合并 toolbarActions + rowActions（去重保序）
  assert.deepEqual(list.spec.actions, ['create', 'batchAssignRole', 'detail', 'edit', 'delete'])
  assert.deepEqual(list.layout.table, { columns: ['编码', '状态'], searchFields: ['编码', '状态'], pageSize: 20 })
  assert.deepEqual(list.layout.pagination, { layout: 'three-part', pageSize: 20 })
  assert.equal(list.layout.selection, true)
  assert.deepEqual(list.layout.rowActions, ['detail', 'edit', 'delete'])
  assert.deepEqual(list.layout.toolbarActions, ['create', 'batchAssignRole'])
  assert.deepEqual(list.layout.toolbar.actions, list.spec.actions)
  assert.deepEqual(list.layout.tree, {
    titleField: '编码',
    parentField: '状态',
    actionStyle: 'header',
    selectionStyle: 'dot'
  })
  assert.deepEqual(list.layout.subTables, [{ target: 'category', title: '子分类', columns: ['名称'], mode: 'tab' }])
  assert.deepEqual(list.layout.components, { 状态: 'pm-select' })
  assert.deepEqual(result.pageSet.pages[0].recipe, 'tree-list')
  assert.equal(result.pageSet.pages[0].catalogRef, 'enterprise-application-platform/organization')

  const form = result.pages[1]
  assert.equal(form.recipe, 'dialog-form')
  assert.deepEqual(form.spec.fields, ['编码', '状态'])
  assert.deepEqual(form.layout.form, {
    presentation: 'dialog',
    columns: 2,
    width: 800,
    fields: ['编码', '状态'],
    groups: [{ title: '基本信息', fields: ['编码'] }]
  })
})

test('P7 页面契约：旧页面无新字段时行为不变、designSystem 为 null', () => {
  const result = adaptDesign(design, { modules })
  assert.equal(result.designSystem, null)
  const page = result.pages[0]
  assert.deepEqual(Object.keys(page).sort(), ['entityId', 'id', 'layout', 'pageSetId', 'spec', 'title', 'type'])
  assert.deepEqual(page.spec, { columns: ['编码', '状态'], actions: ['新增', '删除'] })
  assert.deepEqual(page.layout, {
    table: { columns: ['编码', '状态'] },
    toolbar: { actions: ['新增', '删除'] }
  })
  assert.deepEqual(Object.keys(page.spec).sort(), ['actions', 'columns'])
  assert.deepEqual(Object.keys(page.layout).sort(), ['table', 'toolbar'])
})

test('P7 页面契约：非法枚举/类型只 warning，旧页面不抛错', () => {
  const result = adaptDesign(
    {
      ...design,
      designSystem: { pack: '  ', applicationType: 'x' },
      pages: [
        {
          id: 'bad',
          name: '坏契约',
          type: 'list',
          recipe: 'timeline',
          pagination: { layout: 'grid', pageSize: 0 },
          form: { presentation: 'modal', columns: 3, width: -1 },
          tree: 'oops',
          subTables: [{ title: '无实体' }, { entity: 'category', mode: 'grid' }],
          components: { 状态: 123 }
        }
      ]
    },
    { modules }
  )
  assert.deepEqual(result.designSystem, { applicationType: 'x' })
  const page = result.pages[0]
  assert.equal(page.recipe, undefined)
  assert.equal(page.layout.pagination, undefined)
  assert.equal(page.layout.form, undefined)
  assert.equal(page.layout.tree, undefined)
  assert.deepEqual(page.layout.subTables, [{ target: 'category' }])
  assert.equal(page.layout.components, undefined)
  assert.ok(result.warnings.some(item => item.includes('timeline')))
  assert.ok(result.warnings.some(item => item.includes('分页形态 grid')))
  assert.ok(result.warnings.some(item => item.includes('表单形态 modal')))
  assert.ok(result.warnings.some(item => item.includes('form.columns')))
  assert.ok(result.warnings.some(item => item.includes('tree 不是对象')))
  assert.ok(result.warnings.some(item => item.includes('缺少 entity')))
  assert.ok(result.warnings.some(item => item.includes('mode grid')))
  assert.ok(result.warnings.some(item => item.includes('components.状态')))
})

test('P7 页面契约：form.groups 映射为 layout.groups（供 fieldGroups 消费）', () => {
  const result = adaptDesign(
    {
      ...design,
      pages: [
        {
          id: 'org-form',
          name: '机构编辑',
          type: 'form',
          entity: 'product',
          recipe: 'dialog-form',
          form: {
            presentation: 'dialog',
            columns: 1,
            width: 720,
            fields: ['编码', '状态'],
            groups: [
              { title: '基本信息', fields: ['编码'] },
              { title: '其他信息', fields: ['状态'] }
            ]
          }
        }
      ]
    },
    { modules }
  )
  const formPage = result.pages[0]
  assert.deepEqual(formPage.layout.groups, [
    { title: '基本信息', fields: ['编码'] },
    { title: '其他信息', fields: ['状态'] }
  ])
  assert.deepEqual(formPage.layout.form.groups, [
    { title: '基本信息', fields: ['编码'] },
    { title: '其他信息', fields: ['状态'] }
  ])
})

test('P7 页面契约：无 form.groups 时不产生 layout.groups（旧输出不变）', () => {
  const result = adaptDesign(
    {
      ...design,
      pages: [
        {
          id: 'org-form',
          name: '机构编辑',
          type: 'form',
          entity: 'product',
          form: { presentation: 'page', columns: 2, fields: ['编码', '状态'] }
        }
      ]
    },
    { modules }
  )
  const formPage = result.pages[0]
  assert.equal('groups' in formPage.layout, false)
  assert.deepEqual(formPage.layout.form, { presentation: 'page', columns: 2, fields: ['编码', '状态'] })
})

