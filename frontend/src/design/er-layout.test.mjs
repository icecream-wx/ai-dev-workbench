import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildErLayout,
  relationCardinality,
  HEADER_H,
  ROW_H,
  MAX_VISIBLE_FIELDS
} from './er-layout.js'

function field(name, type = 'string', extra = {}) {
  return { name, label: name, type, ...extra }
}

function relation(type, target, name = 'relation', extra = {}) {
  return { name, type, target, ...extra }
}

function entity(id, name, fields, relations = [], position = 0, tableName = '') {
  return {
    id,
    name,
    tableName: tableName || `tbl_${id.replace(/-/g, '_')}`,
    description: '',
    fields,
    relations,
    requirementRefs: [],
    sourceSections: [],
    status: 'draft',
    position,
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: '2026-11-12T00:00:00.000Z'
  }
}

function nodeBox(node) {
  return { x: node.x, y: node.y, width: node.width, height: node.height }
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function assertNoOverlap(nodes) {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      assert.equal(
        overlaps(nodeBox(nodes[i]), nodeBox(nodes[j])),
        false,
        `节点重叠：${nodes[i].id} / ${nodes[j].id}`
      )
    }
  }
}

function assertInBounds(layout) {
  for (const node of layout.nodes) {
    assert.ok(node.x >= 0, `${node.id} x 越界`)
    assert.ok(node.y >= 0, `${node.id} y 越界`)
    assert.ok(node.x + node.width <= layout.width, `${node.id} 右边越界`)
    assert.ok(node.y + node.height <= layout.height, `${node.id} 下边越界`)
  }
}

test('无关系：2 列网格、无重叠、全部在画布内、顺序稳定', () => {
  const entities = Array.from({ length: 5 }, (_, index) =>
    entity(`ent-${index}`, `实体${index}`, [field('id'), field('name')], [], index)
  )
  const layout = buildErLayout(entities)
  assert.equal(layout.nodes.length, 5)
  assert.equal(layout.edges.length, 0)
  assertNoOverlap(layout.nodes)
  assertInBounds(layout)

  const nodes = layout.nodes
  assert.ok(nodes[1].x > nodes[0].x)
  assert.equal(nodes[0].x, nodes[2].x)
  assert.equal(nodes[1].x, nodes[3].x)
  assert.equal(nodes[0].y, nodes[1].y)
  assert.ok(nodes[2].y > nodes[0].y)

  const again = buildErLayout(entities)
  const snapshot = run => run.nodes.map(node => [node.id, node.x, node.y])
  assert.deepEqual(snapshot(layout), snapshot(again))
  assert.deepEqual(
    layout.nodes.map(node => node.id),
    entities.map(item => item.id)
  )
})

test('有向链 A→B→C：分层递增、边数与基数标签正确', () => {
  const entities = [
    entity('a', 'A', [field('id')], [relation('one-to-many', 'b', 'A-B')], 0),
    entity('b', 'B', [field('id')], [relation('many-to-one', 'c', 'B-C')], 1),
    entity('c', 'C', [field('id')], [], 2)
  ]
  const layout = buildErLayout(entities)
  const byId = new Map(layout.nodes.map(node => [node.id, node]))
  assert.ok(byId.get('a').layer < byId.get('b').layer)
  assert.ok(byId.get('b').layer < byId.get('c').layer)
  assert.ok(byId.get('a').x < byId.get('b').x)
  assert.ok(byId.get('b').x < byId.get('c').x)
  assert.equal(layout.edges.length, 2)
  for (const edge of layout.edges) {
    assert.ok(edge.path.startsWith('M '), 'edge path 应为 SVG path')
    assert.equal(edge.sourceId === byId.get(edge.sourceId).id, true)
  }
  const labels = layout.edges.map(edge => edge.label)
  assert.deepEqual(labels, ['1:N', 'N:1'])
  assert.ok(layout.edges.every(edge => edge.labelX > 0 && edge.labelY > 0))
  assertNoOverlap(layout.nodes)
  assertInBounds(layout)
})

test('循环 A→B→A：不死循环、不重叠、边可生成', () => {
  const entities = [
    entity('a', 'A', [field('id')], [relation('one-to-many', 'b', 'A-B')], 0),
    entity('b', 'B', [field('id')], [relation('many-to-one', 'a', 'B-A')], 1)
  ]
  const layout = buildErLayout(entities)
  assert.equal(layout.nodes.length, 2)
  assert.equal(layout.edges.length, 2)
  assert.ok(layout.edges.every(edge => edge.path.length > 0))
  assertNoOverlap(layout.nodes)
  assertInBounds(layout)
})

test('自引用：节点仍一个、边存在（自环）', () => {
  const entities = [
    entity('user', '用户', [field('id'), field('parentId', 'ref', { ref: 'user' })], [
      relation('one-to-many', 'user', '上级', { sourceField: 'parentId' })
    ])
  ]
  const layout = buildErLayout(entities)
  assert.equal(layout.nodes.length, 1)
  assert.equal(layout.edges.length, 1)
  const edge = layout.edges[0]
  assert.equal(edge.sourceId, 'user')
  assert.equal(edge.targetId, 'user')
  assert.equal(edge.cardinality, '1:N')
  assert.ok(edge.path.includes('C '), '自环应为三次贝塞尔')
  assert.ok(layout.width > layout.nodes[0].x + layout.nodes[0].width, '自环需要额外右留白')
  assertInBounds(layout)
})

test('多组件：互不相连的两组纵向分离', () => {
  const entities = [
    entity('a', 'A', [field('id')], [relation('one-to-one', 'b', 'A-B')], 0),
    entity('b', 'B', [field('id')], [], 1),
    entity('c', 'C', [field('id')], [relation('one-to-many', 'd', 'C-D')], 2),
    entity('d', 'D', [field('id')], [], 3)
  ]
  const layout = buildErLayout(entities)
  const first = layout.nodes.filter(node => node.component === 0)
  const second = layout.nodes.filter(node => node.component === 1)
  assert.equal(first.length, 2)
  assert.equal(second.length, 2)
  const firstBottom = Math.max(...first.map(node => node.y + node.height))
  const secondTop = Math.min(...second.map(node => node.y))
  assert.ok(secondTop > firstBottom, '第二个组件应位于第一个组件下方')
  assertNoOverlap(layout.nodes)
  assertInBounds(layout)
})

test('字段数：高度随字段增加，>12 时输出省略行信息', () => {
  const small = buildErLayout([entity('e3', 'E3', Array.from({ length: 3 }, (_, i) => field(`f${i}`)))])
  const max = buildErLayout([
    entity('e12', 'E12', Array.from({ length: MAX_VISIBLE_FIELDS }, (_, i) => field(`f${i}`)))
  ])
  const many = buildErLayout([
    entity('e15', 'E15', Array.from({ length: 15 }, (_, i) => field(i === 0 ? 'id' : `f${i}`)))
  ])
  assert.ok(max.nodes[0].height > small.nodes[0].height)
  assert.ok(many.nodes[0].height > max.nodes[0].height)
  assert.equal(many.nodes[0].rows.length, MAX_VISIBLE_FIELDS)
  assert.equal(many.nodes[0].moreCount, 3)
  assert.equal(many.nodes[0].hiddenFields, 3)
  assert.equal(max.nodes[0].moreCount, 0)
  assert.equal(many.nodes[0].height, HEADER_H + MAX_VISIBLE_FIELDS * ROW_H + ROW_H + 8)
})

test('relationCardinality：四种类型 + 未知回退 1:N', () => {
  assert.equal(relationCardinality('one-to-one'), '1:1')
  assert.equal(relationCardinality('one-to-many'), '1:N')
  assert.equal(relationCardinality('many-to-one'), 'N:1')
  assert.equal(relationCardinality('many-to-many'), 'N:N')
  assert.equal(relationCardinality('unknown'), '1:N')
  assert.equal(relationCardinality(undefined), '1:N')
})

test('字段行元数据：PK/FK/必填/唯一与外键目标名', () => {
  const entities = [
    entity('customer', '客户', [field('id'), field('name')], [], 0),
    entity(
      'order',
      '订单',
      [
        field('id'),
        field('customerId', 'ref', { ref: 'customer', required: true }),
        field('orderNo', 'string', { unique: true }),
        field('amount', 'decimal', { required: true })
      ],
      [relation('many-to-one', 'customer', '所属客户', { sourceField: 'customerId' })]
    )
  ]
  const layout = buildErLayout(entities)
  const order = layout.nodes.find(node => node.id === 'order')
  const idRow = order.rows.find(row => row.name === 'id')
  const customerRow = order.rows.find(row => row.name === 'customerId')
  const orderNoRow = order.rows.find(row => row.name === 'orderNo')
  assert.equal(idRow.pk, true)
  assert.equal(customerRow.fk, true)
  assert.equal(customerRow.required, true)
  assert.equal(customerRow.refName, '客户')
  assert.equal(orderNoRow.unique, true)
  assert.equal(layout.nodes.find(node => node.id === 'customer').rows[0].pk, true)
})
