/**
 * design-adapter（D1）：entities.json + pages.json → 全局实体/页面集/页面契约；字段 code/label。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { adaptDesign, designLikeOf, designSummaryOf, designWarningsOf } from './design-adapter.js'

const ENTITIES = {
  entities: [
    {
      id: 'goods',
      name: '商品',
      table: 'biz_goods',
      fields: [
        { code: 'goodsCode', name: '商品编码', type: 'string', required: true, unique: true },
        {
          code: 'status',
          name: '状态',
          type: 'enum',
          options: [
            { value: 'ON_SALE', label: '上架' },
            { value: 'OFF_SALE', label: '下架' }
          ]
        },
        { code: 'categoryId', name: '分类', type: 'ref', ref: 'category' }
      ]
    },
    { id: 'category', name: '分类', fields: [{ code: 'name', name: '分类名称', type: 'string' }] }
  ],
  relations: [{ from: 'goods', to: 'category', type: 'N:1', label: '所属分类' }]
}

const PAGES = {
  pageSets: [
    {
      id: 'goods',
      epic: 'EP-001',
      title: '商品管理',
      primaryEntity: 'goods',
      pages: [
        {
          id: 'goods-list',
          name: '商品列表',
          type: 'list',
          recipe: 'list',
          entity: 'goods',
          columns: ['goodsCode', 'name', 'status'],
          filters: ['goodsCode', 'status'],
          rowActions: ['detail', 'edit', 'delete'],
          toolbarActions: ['create', 'batchDelete'],
          selection: true,
          pagination: { layout: 'three-part', pageSize: 20 },
          form: { presentation: 'dialog', columns: 2, width: 800, fields: ['goodsCode', 'status'] },
          components: { status: 'pm-select' }
        },
        { id: 'goods-form', name: '商品编辑', type: 'form', recipe: 'dialog-form', entity: 'goods' }
      ]
    }
  ]
}

function designLike() {
  return { ...ENTITIES, ...PAGES }
}test('全局实体/关系 + 页面集 = Epic；字段 code 作渲染键、label 作显示名', () => {
  const result = adaptDesign(designLike())
  assert.equal(result.entities.length, 2)
  assert.equal(result.relations.length, 1)
  assert.equal(result.entities[0].relations[0].target, 'category')
  assert.equal(result.pageSets.length, 1)
  assert.equal(result.pageSets[0].epic, 'EP-001')
  assert.equal(result.pages.length, 2)
  assert.equal(result.pages[0].pageSetId, 'goods')
  assert.equal(result.pages[0].entityId, 'goods')

  const fields = result.entities[0].fields
  assert.equal(fields[0].code, 'goodsCode')
  assert.equal(fields[0].name, 'goodsCode')
  assert.equal(fields[0].label, '商品编码')
  assert.equal(fields[0].required, true)
  assert.deepEqual(fields[1].options, ['上架', '下架'])
  assert.deepEqual(fields[1].optionValues, ['ON_SALE', 'OFF_SALE'])
  assert.equal(fields[2].ref, 'category')
  assert.deepEqual(result.warnings, [])
})

test('页面契约映射：列/查询/操作/选择/分页/表单/组件', () => {
  const page = adaptDesign(designLike()).pages[0]
  assert.deepEqual(page.layout.table.columns, ['goodsCode', 'name', 'status'])
  assert.deepEqual(page.layout.table.searchFields, ['goodsCode', 'status'])
  assert.equal(page.layout.table.pageSize, 20)
  assert.equal(page.layout.pagination.layout, 'three-part')
  assert.equal(page.layout.selection, true)
  assert.deepEqual(page.layout.rowActions, ['detail', 'edit', 'delete'])
  assert.deepEqual(page.layout.toolbarActions, ['create', 'batchDelete'])
  assert.deepEqual(page.spec.actions, ['create', 'batchDelete', 'detail', 'edit', 'delete'])
  assert.equal(page.layout.form.presentation, 'dialog')
  assert.deepEqual(page.layout.form.fields, ['goodsCode', 'status'])
  assert.deepEqual(page.layout.components, { status: 'pm-select' })
})

test('缺 pageSets 时把 pages 当作一个匿名页面集（兼容 synthetic design）', () => {
  const result = adaptDesign({
    entities: [{ id: 'x', name: 'X', fields: [{ code: 'a', name: 'A', type: 'string' }] }],
    pages: [{ id: 'x-list', name: 'X 列表', type: 'list', entity: 'x', columns: ['a'] }]
  })
  assert.equal(result.pageSets.length, 1)
  assert.equal(result.pageSets[0].id, 'app')
  assert.equal(result.pages[0].pageSetId, 'app')
})

test('未知实体/未知页面类型/重复 id → warning，不抛错', () => {
  const result = adaptDesign({
    entities: [
      { id: 'goods', name: '商品', fields: [] },
      { id: 'goods', name: '重复', fields: [] }
    ],
    relations: [{ from: 'goods', to: 'nope', type: 'N:1' }],
    pageSets: [
      {
        id: 'set',
        epic: 'EP-001',
        title: 'S',
        pages: [
          { id: 'p1', name: 'P1', type: 'unknown', entity: 'missing' },
          { id: 'p1', name: 'P2', type: 'list' }
        ]
      }
    ]
  })
  assert.equal(result.entities.length, 1)
  assert.ok(result.warnings.some(item => /实体 id 重复/.test(item)))
  assert.ok(result.warnings.some(item => /引用不存在的实体/.test(item)))
  assert.ok(result.warnings.some(item => /类型 unknown 不受支持/.test(item)))
  assert.ok(result.warnings.some(item => /页面 id 重复/.test(item)))
  assert.equal(result.pages[0].type, 'list')
})

test('actions 字段 → warning，并从 row/toolbar 派生（旧字段不参与渲染）', () => {
  const result = adaptDesign({
    entities: [{ id: 'x', name: 'X', fields: [] }],
    pageSets: [
      {
        id: 's',
        epic: 'EP-001',
        title: 'S',
        pages: [{ id: 'p', name: 'P', type: 'list', entity: 'x', actions: ['新增'], toolbarActions: ['create'], rowActions: ['edit'] }]
      }
    ]
  })
  assert.ok(result.warnings.some(item => /不再使用 actions/.test(item)))
  assert.deepEqual(result.pages[0].spec.actions, ['create', 'edit'])
})

test('design-like 输入为空/null 不抛错', () => {
  const empty = adaptDesign(null)
  assert.deepEqual(empty.entities, [])
  assert.deepEqual(empty.pages, [])
  assert.equal(empty.pageSets.length, 1)
  assert.equal(empty.pageSets[0].pages.length, 0)
})

test('designLikeOf / designSummaryOf / designWarningsOf（artifacts 形态）', () => {
  const artifacts = {
    requirement: { warnings: ['缺少 template'] },
    entities: {
      entities: ENTITIES.entities,
      relations: ENTITIES.relations,
      warnings: ['实体 id 重复：x'],
      errors: []
    },
    pages: { pageSets: PAGES.pageSets, pages: PAGES.pageSets[0].pages, warnings: ['页面 id 重复：p'], errors: [] },
    errors: [{ file: 'pages.json', path: '$', message: '坏 JSON' }]
  }
  const like = designLikeOf(artifacts)
  assert.equal(like.entities.length, 2)
  assert.equal(like.pageSets.length, 1)
  const summary = designSummaryOf(artifacts)
  assert.equal(summary.hasDesign, true)
  assert.equal(summary.entityCount, 2)
  assert.equal(summary.pageSetCount, 1)
  assert.equal(summary.pageCount, 2)
  assert.equal(summary.errorCount, 1)
  const lines = designWarningsOf(artifacts)
  assert.ok(lines.some(line => line.includes('entities.json')))
  assert.ok(lines.some(line => line.includes('pages.json')))
  assert.ok(lines.some(line => line.includes('requirements.md')))
})

test('B6-1 actionTargets：保留对象与未知动作键，写入 page/original', () => {
  const pages = {
    pageSets: [
      {
        ...PAGES.pageSets[0],
        pages: [
          {
            ...PAGES.pageSets[0].pages[0],
            actionTargets: { create: 'goods-form', edit: 'goods-form', detail: 'goods-detail', custom: 'goods-form' }
          },
          PAGES.pageSets[0].pages[1]
        ]
      }
    ]
  }
  const result = adaptDesign({ ...ENTITIES, ...pages })
  assert.deepEqual(result.pages[0].actionTargets, {
    create: 'goods-form',
    edit: 'goods-form',
    detail: 'goods-detail',
    custom: 'goods-form'
  })
  assert.deepEqual(result.pageSets[0].pages[0].actionTargets, {
    create: 'goods-form',
    edit: 'goods-form',
    detail: 'goods-detail',
    custom: 'goods-form'
  })
  assert.deepEqual(result.warnings, [])
})

test('B6-1 actionTargets：非对象/空值 → warning 后忽略/跳过', () => {
  const broken = adaptDesign({
    ...ENTITIES,
    pageSets: [
      {
        ...PAGES.pageSets[0],
        pages: [{ ...PAGES.pageSets[0].pages[0], actionTargets: ['goods-form'] }, PAGES.pageSets[0].pages[1]]
      }
    ]
  })
  assert.equal(broken.pages[0].actionTargets, undefined)
  assert.ok(broken.warnings.some(line => line.includes('actionTargets 不是对象')))

  const partial = adaptDesign({
    ...ENTITIES,
    pageSets: [
      {
        ...PAGES.pageSets[0],
        pages: [
          { ...PAGES.pageSets[0].pages[0], actionTargets: { create: 'goods-form', edit: '', detail: 42 } },
          PAGES.pageSets[0].pages[1]
        ]
      }
    ]
  })
  assert.deepEqual(partial.pages[0].actionTargets, { create: 'goods-form' })
  assert.ok(partial.warnings.some(line => line.includes('actionTargets.edit')))
  assert.ok(partial.warnings.some(line => line.includes('actionTargets.detail')))
})
