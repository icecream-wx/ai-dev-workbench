import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTemporaryFormPage, resolveActionTarget } from './interaction.js'

const PAGES = [
  { id: 'order-list', name: '订单列表', pageSetId: 'ep-sales', entityId: 'order', recipe: 'list' },
  { id: 'order-detail', name: '订单详情', pageSetId: 'ep-sales', entityId: 'order', recipe: 'detail' },
  { id: 'order-dialog-form', name: '订单新增/编辑', pageSetId: 'ep-sales', entityId: 'order', recipe: 'dialog-form' }
]

const ORDER_LIST = PAGES[0]

test('create：同页面集同实体优先 dialog-form → dialog', () => {
  const result = resolveActionTarget({ action: 'create', page: ORDER_LIST, pages: PAGES })
  assert.equal(result.kind, 'dialog')
  assert.equal(result.page.id, 'order-dialog-form')
  assert.equal(result.action, 'create')
})

test('create：无 dialog-form 时回退 page-form → navigate', () => {
  const pages = [
    ORDER_LIST,
    { id: 'customer-list', name: '客户列表', pageSetId: 'ep-crm', entityId: 'customer', recipe: 'list' },
    { id: 'customer-form', name: '客户信息', pageSetId: 'ep-crm', entityId: 'customer', recipe: 'page-form' },
    { id: 'customer-wizard', name: '客户分步', pageSetId: 'ep-crm', entityId: 'customer', recipe: 'wizard' }
  ]
  const result = resolveActionTarget({ action: 'create', page: pages[1], pages })
  assert.equal(result.kind, 'navigate')
  assert.equal(result.page.id, 'customer-form')
})

test('create：wizard 作为最后一个配方回退', () => {
  const pages = [
    { id: 'report-list', name: '报表列表', pageSetId: 'ep-report', entityId: 'report', recipe: 'list' },
    { id: 'report-wizard', name: '报表向导', pageSetId: 'ep-report', entityId: 'report', recipe: 'wizard' }
  ]
  const result = resolveActionTarget({ action: 'create', page: pages[0], pages })
  assert.equal(result.kind, 'navigate')
  assert.equal(result.page.id, 'report-wizard')
})

test('edit：同实体 dialog-form → dialog', () => {
  const result = resolveActionTarget({ action: 'edit', page: ORDER_LIST, pages: PAGES })
  assert.equal(result.kind, 'dialog')
  assert.equal(result.page.id, 'order-dialog-form')
})

test('detail：命中 detail → navigate', () => {
  const result = resolveActionTarget({ action: 'detail', page: ORDER_LIST, pages: PAGES })
  assert.equal(result.kind, 'navigate')
  assert.equal(result.page.id, 'order-detail')
})

test('delete / batchDelete → confirm（不需要目标页）', () => {
  for (const action of ['delete', 'batchDelete']) {
    const result = resolveActionTarget({ action, page: ORDER_LIST, pages: PAGES })
    assert.equal(result.kind, 'confirm')
    assert.equal(result.action, action)
  }
})

test('export / import / submit → notify（不跳转）', () => {
  for (const action of ['export', 'import', 'submit']) {
    assert.equal(resolveActionTarget({ action, page: ORDER_LIST, pages: PAGES }).kind, 'notify')
  }
})

test('无目标页面 → none + reason（不伪造表单）', () => {
  const pages = [
    { id: 'report-list', name: '报表列表', pageSetId: 'ep-report', entityId: 'report', recipe: 'list' }
  ]
  const result = resolveActionTarget({ action: 'create', page: pages[0], pages })
  assert.equal(result.kind, 'none')
  assert.match(result.reason, /未设计新增/)
})

test('同配方多候选：优先命中原型关键词，否则按数组顺序', () => {
  const pages = [
    ORDER_LIST,
    { id: 'order-form-a', name: '订单台账表单', pageSetId: 'ep-sales', entityId: 'order', recipe: 'page-form' },
    { id: 'order-edit', name: '订单编辑', pageSetId: 'ep-sales', entityId: 'order', recipe: 'page-form' }
  ]
  const keyword = resolveActionTarget({ action: 'edit', page: ORDER_LIST, pages })
  assert.equal(keyword.page.id, 'order-edit')
  const ordered = resolveActionTarget({ action: 'create', page: ORDER_LIST, pages })
  assert.equal(ordered.page.id, 'order-form-a')
})

test('跨页面集忽略：不同 pageSetId 的同实体页不作为目标', () => {
  const pages = [
    ORDER_LIST,
    { id: 'other-order-form', name: '订单新增', pageSetId: 'ep-other', entityId: 'order', recipe: 'dialog-form' }
  ]
  const result = resolveActionTarget({ action: 'create', page: ORDER_LIST, pages })
  assert.equal(result.kind, 'none')
})

test('源页面未绑定实体 → 不跨页查找', () => {
  const loose = { id: 'dashboard', name: '驾驶舱', pageSetId: 'ep-sales', entityId: null, recipe: 'dashboard' }
  const result = resolveActionTarget({ action: 'create', page: loose, pages: [...PAGES, loose] })
  assert.equal(result.kind, 'none')
})

test('未知动作 → notify（不改页面）', () => {
  const result = resolveActionTarget({ action: 'print', page: ORDER_LIST, pages: PAGES })
  assert.equal(result.kind, 'notify')
})

/* ------------------------------------------------------------------ *
 * B6-0：app1 形状（main-sub 是合法表单目标；detail 不被 create 选中）
 * ------------------------------------------------------------------ */

const APP1_GOODS_PAGES = [
  { id: 'goods-list', name: '商品列表', pageSetId: 'goods', entityId: 'goods', recipe: 'list' },
  { id: 'goods-view', name: '商品详情', pageSetId: 'goods', entityId: 'goods', recipe: 'detail' },
  { id: 'goods-form', name: '商品表单', pageSetId: 'goods', entityId: 'goods', recipe: 'main-sub' },
  { id: 'goods-detail-list', name: '商品明细列表', pageSetId: 'goods', entityId: 'goodsDetail', recipe: 'list' },
  { id: 'goods-detail-form', name: '商品明细表单', pageSetId: 'goods', entityId: 'goodsDetail', recipe: 'dialog-form' }
]

test('B6-0 app1：goods-list + goods-form(main-sub) → create 切页', () => {
  const result = resolveActionTarget({ action: 'create', page: APP1_GOODS_PAGES[0], pages: APP1_GOODS_PAGES })
  assert.equal(result.kind, 'navigate')
  assert.equal(result.page.id, 'goods-form')
  assert.equal(result.inferred, undefined)
})

test('B6-0 app1：goods-detail-list + goods-detail-form(dialog-form) → 弹窗', () => {
  const result = resolveActionTarget({ action: 'create', page: APP1_GOODS_PAGES[3], pages: APP1_GOODS_PAGES })
  assert.equal(result.kind, 'dialog')
  assert.equal(result.page.id, 'goods-detail-form')
})

test('B6-0：order-list + order-create(main-sub) → create 切页', () => {
  const pages = [
    { id: 'order-list', name: '订单列表', pageSetId: 'order', entityId: 'order', recipe: 'list' },
    { id: 'order-create', name: '新建订单', pageSetId: 'order', entityId: 'order', recipe: 'main-sub' },
    { id: 'order-detail', name: '订单详情', pageSetId: 'order', entityId: 'order', recipe: 'detail' }
  ]
  const result = resolveActionTarget({ action: 'create', page: pages[0], pages })
  assert.equal(result.kind, 'navigate')
  assert.equal(result.page.id, 'order-create')
})

test('B6-0：detail 页不会被 create 选中（只找表单配方）', () => {
  const pages = [
    APP1_GOODS_PAGES[0],
    { id: 'goods-view', name: '商品详情', pageSetId: 'goods', entityId: 'goods', recipe: 'detail' }
  ]
  const result = resolveActionTarget({ action: 'create', page: pages[0], pages })
  assert.notEqual(result.page?.id, 'goods-view')
  assert.equal(result.kind, 'none')
})

/* ------------------------------------------------------------------ *
 * B6-1：actionTargets 显式优先 / 无效回退 / 放宽兜底 / 可观测字段
 * ------------------------------------------------------------------ */

test('B6-1 显式 actionTargets 优先于启发式（同实体多表单页）', () => {
  const pages = [
    { id: 'order-list', name: '订单列表', pageSetId: 'ep-sales', entityId: 'order', recipe: 'list' },
    { id: 'order-dialog', name: '订单弹窗', pageSetId: 'ep-sales', entityId: 'order', recipe: 'dialog-form' },
    { id: 'order-page', name: '订单整页表单', pageSetId: 'ep-sales', entityId: 'order', recipe: 'page-form' }
  ]
  const list = { ...pages[0], actionTargets: { create: 'order-page' } }
  const result = resolveActionTarget({ action: 'create', page: list, pages: [list, ...pages.slice(1)] })
  assert.equal(result.explicit, true)
  assert.equal(result.page.id, 'order-page')
  assert.equal(result.kind, 'navigate')
})

test('B6-1 显式 actionTargets 对自定义动作码同样生效（不限于 create/edit/detail）', () => {
  const pages = [
    {
      id: 'order-list',
      name: '订单列表',
      pageSetId: 'ep-sales',
      entityId: 'order',
      recipe: 'list',
      actionTargets: { approve: 'approval-form' }
    },
    { id: 'approval-form', name: '审批表单', pageSetId: 'ep-sales', entityId: 'order', recipe: 'dialog-form' }
  ]
  const result = resolveActionTarget({ action: 'approve', page: pages[0], pages })
  assert.equal(result.kind, 'dialog')
  assert.equal(result.explicit, true)
  assert.equal(result.page.id, 'approval-form')

  const noTarget = resolveActionTarget({ action: 'changeStatus', page: pages[0], pages })
  assert.equal(noTarget.kind, 'notify')
})

test('B6-1 显式 dialog-form → dialog；非法显式目标回退启发式并给出 invalidTarget', () => {
  const pages = [
    { id: 'order-list', name: '订单列表', pageSetId: 'ep-sales', entityId: 'order', recipe: 'list' },
    { id: 'order-dialog', name: '订单弹窗', pageSetId: 'ep-sales', entityId: 'order', recipe: 'dialog-form' }
  ]
  const list = { ...pages[0], actionTargets: { create: 'order-dialog', edit: 'missing-page' } }
  const dialog = resolveActionTarget({ action: 'create', page: list, pages: [list, ...pages.slice(1)] })
  assert.equal(dialog.kind, 'dialog')
  assert.equal(dialog.explicit, true)
  const edit = resolveActionTarget({ action: 'edit', page: list, pages: [list, ...pages.slice(1)] })
  assert.equal(edit.kind, 'dialog')
  assert.equal(edit.explicit, undefined)
  assert.equal(edit.invalidTarget, 'missing-page')
})

test('B6-1 显式目标跨页面集 → 不采用（回退启发式/空）', () => {
  const pages = [
    { id: 'order-list', name: '订单列表', pageSetId: 'ep-sales', entityId: 'order', recipe: 'list' },
    { id: 'other-form', name: '其它表单', pageSetId: 'ep-other', entityId: 'order', recipe: 'page-form' }
  ]
  const list = { ...pages[0], actionTargets: { create: 'other-form' } }
  const result = resolveActionTarget({ action: 'create', page: list, pages: [list, ...pages.slice(1)] })
  assert.equal(result.kind, 'none')
  assert.equal(result.invalidTarget, 'other-form')
  assert.match(result.reason, /不存在或不在同一页面集/)
})

test('B6-1 放宽兜底：无同实体表单候选取同页面集唯一表单页并标 inferred', () => {
  const pages = [
    { id: 'order-list', name: '订单列表', pageSetId: 'ep-sales', entityId: 'order', recipe: 'list' },
    { id: 'customer-form', name: '客户表单', pageSetId: 'ep-sales', entityId: 'customer', recipe: 'page-form' }
  ]
  const result = resolveActionTarget({ action: 'create', page: pages[0], pages })
  assert.equal(result.inferred, true)
  assert.equal(result.page.id, 'customer-form')
  assert.equal(result.kind, 'navigate')
})

test('B6-1 放宽兜底：多表单页按关键词优先，否则数组第一个', () => {
  const pages = [
    { id: 'order-list', name: '订单列表', pageSetId: 'ep-sales', entityId: 'order', recipe: 'list' },
    { id: 'customer-form-a', name: '客户台账', pageSetId: 'ep-sales', entityId: 'customer', recipe: 'page-form' },
    { id: 'customer-form-b', name: '客户新增', pageSetId: 'ep-sales', entityId: 'customer', recipe: 'page-form' }
  ]
  const keyword = resolveActionTarget({ action: 'create', page: pages[0], pages })
  assert.equal(keyword.inferred, true)
  assert.equal(keyword.page.id, 'customer-form-b')
  const ordered = resolveActionTarget({ action: 'edit', page: pages[0], pages })
  assert.equal(ordered.inferred, true)
  assert.equal(ordered.page.id, 'customer-form-a')
})

test('B6-1 放宽兜底：无同实体候选才回退；有同实体 detail 时不跨到别的实体表单', () => {
  const pages = [
    { id: 'report-list', name: '报表列表', pageSetId: 'ep-report', entityId: 'report', recipe: 'list' },
    { id: 'report-view', name: '报表详情', pageSetId: 'ep-report', entityId: 'report', recipe: 'detail' },
    { id: 'other-form', name: '其它表单', pageSetId: 'ep-report', entityId: 'other', recipe: 'dialog-form' }
  ]
  const result = resolveActionTarget({ action: 'create', page: pages[0], pages })
  assert.equal(result.kind, 'none')
  assert.deepEqual(result.candidates.map(item => item.id), ['report-view'])
})

test('B6-1 none 返回原因 + 同实体候选（便于 UI 解释）', () => {
  const pages = [
    { id: 'goods-list', name: '商品列表', pageSetId: 'goods', entityId: 'goods', recipe: 'list' },
    { id: 'goods-view', name: '商品详情', pageSetId: 'goods', entityId: 'goods', recipe: 'detail' }
  ]
  const result = resolveActionTarget({ action: 'create', page: pages[0], pages })
  assert.equal(result.kind, 'none')
  assert.match(result.reason, /未设计新增页/)
  assert.match(result.reason, /goods-view\(detail\)/)
  assert.deepEqual(result.candidates.map(item => item.id), ['goods-view'])
})

/* ------------------------------------------------------------------ *
 * B6-2：临时表单
 * ------------------------------------------------------------------ */

const GOODS_ENTITY = {
  id: 'goods',
  name: '商品',
  fields: [
    { code: 'goodsCode', name: '商品编码', type: 'string' },
    { code: 'name', name: '商品名称', type: 'string' }
  ]
}

const NO_FORM_SOURCE = { id: 'goods-list', title: '商品列表', pageSetId: 'goods', entityId: 'goods' }

test('B6-2 临时表单：继承页面集/实体并用实体字段生成 dialog 表单', () => {
  const page = buildTemporaryFormPage(NO_FORM_SOURCE, GOODS_ENTITY)
  assert.equal(page.title, '临时表单')
  assert.equal(page.type, 'form')
  assert.equal(page.recipe, 'dialog-form')
  assert.equal(page.pageSetId, 'goods')
  assert.equal(page.entityId, 'goods')
  assert.deepEqual(page.layout.form, {
    presentation: 'dialog',
    columns: 2,
    width: 720,
    fields: ['goodsCode', 'name']
  })
  assert.deepEqual(page.layout.groups, [{ title: '基本信息', fields: ['goodsCode', 'name'] }])
  assert.deepEqual(page.spec.fields, ['goodsCode', 'name'])
})

test('B6-2 临时表单：实体无字段 → null（不伪造空表单）', () => {
  assert.equal(buildTemporaryFormPage(NO_FORM_SOURCE, { id: 'goods', fields: [] }), null)
  assert.equal(buildTemporaryFormPage(NO_FORM_SOURCE, null), null)
})
