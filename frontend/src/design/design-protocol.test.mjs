import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DESIGN_DELIMITER,
  applyDesignEnvelope,
  mergeEntities,
  mergePageSets,
  splitDesignOutput
} from './design-protocol.js'

test('解析 DESIGN_JSON：正文 + 实体/pageSets/nextSteps', () => {
  const raw = `已生成实体与页面集。
${DESIGN_DELIMITER}
{"entities":[{"name":"订单","fields":[{"name":"orderNo","label":"订单号","type":"string"}]}],"pageSets":[{"sceneKey":"entity:ent-1","title":"订单管理","pages":[{"pageKey":"order-list","title":"订单列表","type":"list","entityId":"ent-1"}]}],"nextSteps":[{"label":"补充字段","prompt":"请补充订单金额"}]}`
  const { reply, envelope } = splitDesignOutput(raw)
  assert.match(reply, /已生成实体/)
  assert.equal(envelope?.entities?.length, 1)
  assert.equal(envelope?.pageSets?.[0].title, '订单管理')
  assert.equal(envelope?.nextSteps?.[0].label, '补充字段')
})

test('容忍尾随分隔符、代码块与尾逗号', () => {
  const raw = `回复
${DESIGN_DELIMITER}
\`\`\`json
{"entities":[{"name":"客户","fields":[]},],}
\`\`\`
${DESIGN_DELIMITER}`
  const { envelope } = splitDesignOutput(raw)
  assert.equal(envelope?.entities?.[0].name, '客户')
})

test('没有分隔符时从整段提取 DESIGN JSON 并保留正文', () => {
  const raw = '说明文字\n{"pageSets":[{"title":"客户管理","pages":[]}]}'
  const { reply, envelope } = splitDesignOutput(raw)
  assert.equal(reply, '说明文字')
  assert.equal(envelope?.pageSets?.[0].title, '客户管理')
})

test('普通文字不误判为设计 envelope', () => {
  const { reply, envelope } = splitDesignOutput('好的，我先看一下需求。')
  assert.equal(reply, '好的，我先看一下需求。')
  assert.equal(envelope, null)
})

test('mergeEntities：按 id/name 合并，保留未出现的实体，新实体置 draft', () => {
  const existing = [
    { id: 'ent-1', name: '订单', tableName: 'biz_order', fields: [{ name: 'orderNo', label: '订单号', type: 'string' }], relations: [], status: 'confirmed', position: 0 },
    { id: 'ent-2', name: '客户', tableName: 'biz_customer', fields: [], relations: [], status: 'confirmed', position: 1 }
  ]
  const merged = mergeEntities(existing, [
    { id: 'ent-1', name: '订单', fields: [{ name: 'orderNo', label: '订单编号', type: 'string' }, { name: 'amount', label: '金额', type: 'decimal' }] },
    { name: '商品', fields: [{ name: 'title', label: '商品名', type: 'string' }] }
  ])
  assert.equal(merged.length, 3)
  assert.equal(merged[0].fields.length, 2)
  assert.equal(merged[0].fields[0].label, '订单编号')
  assert.equal(merged[0].status, 'draft')
  assert.equal(merged[1].status, 'confirmed')
  assert.equal(merged[2].name, '商品')
  assert.equal(merged[2].status, 'draft')
})

test('mergePageSets：按 id/sceneKey 合并页面与 spec，未出现的保留', () => {
  const existing = [
    {
      id: 'ps-1',
      sceneKey: 'entity:ent-1',
      title: '订单管理',
      status: 'confirmed',
      pages: [
        { id: 'pg-1', pageKey: 'order-list', title: '订单列表', type: 'list', entityId: 'ent-1', spec: { actions: ['create'] }, status: 'confirmed' }
      ]
    },
    { id: 'ps-2', sceneKey: 'entity:ent-2', title: '客户管理', status: 'confirmed', pages: [] }
  ]
  const merged = mergePageSets(existing, [
    {
      sceneKey: 'entity:ent-1',
      title: '订单管理',
      pages: [
        { id: 'pg-1', pageKey: 'order-list', title: '订单列表', type: 'list', spec: { columns: ['orderNo'] } },
        { pageKey: 'order-detail', title: '订单详情', type: 'detail', entityId: 'ent-1' }
      ]
    }
  ])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].pages.length, 2)
  assert.deepEqual(merged[0].pages[0].spec.actions, ['create'])
  assert.deepEqual(merged[0].pages[0].spec.columns, ['orderNo'])
  assert.equal(merged[0].pages[0].status, 'draft')
  assert.equal(merged[0].pages[1].status, 'draft')
  assert.equal(merged[1].status, 'confirmed')
})

test('applyDesignEnvelope：只更新出现的顶层键', () => {
  const current = { entities: [{ id: 'ent-1', name: '订单', fields: [] }], pageSets: [] }
  const entitiesOnly = applyDesignEnvelope(current, { entities: [{ id: 'ent-1', name: '订单', fields: [{ name: 'a', label: 'A', type: 'string' }] }] })
  assert.equal(entitiesOnly.changed, true)
  assert.equal(entitiesOnly.entities[0].fields.length, 1)
  assert.deepEqual(entitiesOnly.pageSets, [])

  const nothing = applyDesignEnvelope(current, { nextSteps: [{ label: '补充', prompt: '补充' }] })
  assert.equal(nothing.changed, false)
  assert.equal(nothing.entities[0].name, '订单')
})

test('mergeEntities/mergePageSets 保留 requirementRefs、epicId、storyIds', () => {
  const entities = mergeEntities(
    [{ id: 'ent-1', name: '订单', fields: [], relations: [], requirementRefs: ['STORY-001'], status: 'confirmed', position: 0 }],
    [{ id: 'ent-1', name: '订单', requirementRefs: ['STORY-001', 'STORY-002'], sourceSections: ['epics'] }]
  )
  assert.deepEqual(entities[0].requirementRefs, ['STORY-001', 'STORY-002'])
  assert.deepEqual(entities[0].sourceSections, ['epics'])

  const sets = mergePageSets([], [
    {
      sceneKey: 'EPIC-001',
      epicId: 'EPIC-001',
      storyIds: ['STORY-001'],
      title: '订单管理',
      pages: [{ pageKey: 'order-list', title: '订单列表', type: 'list', entityId: 'ent-1', requirementRefs: ['STORY-001'] }]
    }
  ])
  assert.equal(sets[0].epicId, 'EPIC-001')
  assert.deepEqual(sets[0].storyIds, ['STORY-001'])
  assert.deepEqual(sets[0].pages[0].requirementRefs, ['STORY-001'])
})
