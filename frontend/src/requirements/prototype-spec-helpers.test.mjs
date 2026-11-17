import assert from 'node:assert/strict'
import test from 'node:test'
import {
  baseLabel,
  coverageLabel,
  ensureSpecSelection,
  entityById,
  findSpecGroup,
  findSpecPage,
  generatedAtLabel,
  groupPagesByEpic,
  rangeLabel,
  specEmptyReason,
  specEntityOfPage,
  specErrorOf,
  SPEC_ERROR_DETAIL_LIMIT,
  specMetaLabel,
  specPageTitle,
  specPageTypeLabel,
  specStateLabel,
  toSpecEntity,
  toSpecPage
} from './prototype-spec-helpers.js'

const spec = {
  schema: 'requirements-prototype/1',
  generatedAt: '2026-11-17T02:10:00.000Z',
  model: 'stub/model',
  base: { docVersion: 8, docUpdatedAt: '2026-11-17T01:00:00.000Z' },
  entities: [
    {
      id: 'PE-1',
      name: '商品档案',
      description: '商品主数据',
      fields: [
        { name: 'field1', label: '商品编码', type: 'string', required: true, unique: true, note: '4—32 位' },
        { name: 'field2', label: '商品状态', type: 'enum', required: true, options: ['上架', '下架'] },
        { name: 'field3', label: '商品分类', type: 'ref', target: 'PE-2' },
        { name: 'field4', label: '结算价', type: 'decimal' }
      ]
    },
    {
      id: 'PE-2',
      name: '商品分类',
      description: '',
      fields: [{ name: 'field1', label: '分类名称', type: 'string', required: true }]
    }
  ],
  pages: [
    { id: 'PP-1', title: '商品列表', type: 'list', epicId: 'EPIC-001', storyIds: ['STORY-001'], entityId: 'PE-1', fields: ['field1', 'field2'], actions: ['新增', '编辑'] },
    { id: 'PP-2', title: '商品详情', type: 'detail', epicId: 'EPIC-001', storyIds: ['STORY-002'], entityId: 'PE-1', fields: ['field1'], actions: [] },
    { id: 'PP-3', title: '空实体页面', type: 'custom', epicId: 'EPIC-002', storyIds: [], entityId: null, fields: [], actions: [] },
    { id: 'PP-4', title: '孤儿页面', type: 'dashboard', epicId: null, storyIds: [], entityId: 'PE-2', fields: [], actions: [] },
    { id: 'PP-5', title: '坏 Epic 页面', type: 'calendar', epicId: 'EPIC-404', storyIds: [], entityId: 'PE-9', fields: [], actions: [] }
  ],
  notes: ['库存归属待确认'],
  stats: { entities: 2, fields: 5, pages: 5 }
}

const pageSets = [
  { key: 'pv:MOD-001:EPIC-001', epicId: 'EPIC-001', title: '商品档案维护', pages: [] },
  { key: 'pv:MOD-001:EPIC-002', epicId: 'EPIC-002', title: '商品分析', pages: [] },
  { key: 'pv:MOD-001:unassigned', epicId: null, title: '未归属 Story', pages: [] }
]

test('toSpecEntity：status=draft、decimal→number、ref 带 target id、enum 带 options、required/unique/note', () => {
  const entity = toSpecEntity(spec.entities[0])
  assert.equal(entity.id, 'PE-1')
  assert.equal(entity.name, '商品档案')
  assert.equal(entity.status, 'draft')
  assert.equal(entity.description, '商品主数据')
  const byLabel = new Map(entity.fields.map(field => [field.label, field]))
  assert.deepEqual(byLabel.get('商品编码'), {
    name: 'field1',
    label: '商品编码',
    type: 'string',
    required: true,
    unique: true,
    note: '4—32 位'
  })
  assert.equal(byLabel.get('商品状态').type, 'enum')
  assert.deepEqual(byLabel.get('商品状态').options, ['上架', '下架'])
  assert.equal(byLabel.get('商品分类').type, 'ref')
  assert.equal(byLabel.get('商品分类').target, 'PE-2')
  assert.equal(byLabel.get('结算价').type, 'number')
  assert.equal(toSpecEntity(null), undefined)
  assert.equal(toSpecEntity({ id: 'PE-3' }), undefined)
})

test('toSpecPage：entityId→entity、fields/actions 透传、status=draft；无实体不写 entity', () => {
  const page = toSpecPage(spec.pages[0])
  assert.deepEqual(page, {
    id: 'PP-1',
    type: 'list',
    title: '商品列表',
    entity: 'PE-1',
    fields: ['field1', 'field2'],
    actions: ['新增', '编辑'],
    status: 'draft'
  })
  const empty = toSpecPage(spec.pages[2])
  assert.equal(empty.entity, undefined)
  assert.equal(empty.fields, undefined)
  assert.equal(empty.actions, undefined)
  assert.equal(toSpecPage(null), undefined)
})

test('groupPagesByEpic：按页面集顺序分组；无 epicId/未知 epic 进「其他页面」最后；空 Epic 保留', () => {
  const groups = groupPagesByEpic(spec, pageSets)
  assert.deepEqual(groups.map(group => group.key), ['epic:EPIC-001', 'epic:EPIC-002', 'other'])
  assert.equal(groups[0].title, '商品档案维护')
  assert.deepEqual(groups[0].pages.map(page => page.id), ['PP-1', 'PP-2'])
  assert.deepEqual(groups[1].pages.map(page => page.id), ['PP-3'])
  assert.equal(groups[2].epicId, null)
  assert.equal(groups[2].title, '其他页面')
  assert.deepEqual(groups[2].pages.map(page => page.id), ['PP-4', 'PP-5'])
  // null spec / 无页面
  assert.deepEqual(groupPagesByEpic(null, pageSets), [])
  assert.deepEqual(groupPagesByEpic({ pages: [] }, pageSets).map(group => group.pages.length), [0, 0])
})

test('ensureSpecSelection：默认首组首页；保留合法选中；组/页丢失与空组回退', () => {
  const groups = groupPagesByEpic(spec, pageSets)
  assert.deepEqual(ensureSpecSelection(groups), { groupKey: 'epic:EPIC-001', pageId: 'PP-1' })
  assert.deepEqual(ensureSpecSelection(groups, { groupKey: 'epic:EPIC-001', pageId: 'PP-2' }), {
    groupKey: 'epic:EPIC-001',
    pageId: 'PP-2'
  })
  assert.deepEqual(ensureSpecSelection(groups, { groupKey: 'gone', pageId: 'PP-2' }), {
    groupKey: 'epic:EPIC-001',
    pageId: 'PP-2'
  })
  assert.deepEqual(ensureSpecSelection(groups, { groupKey: 'epic:EPIC-002', pageId: 'PP-1' }), {
    groupKey: 'epic:EPIC-002',
    pageId: 'PP-3'
  })
  assert.deepEqual(ensureSpecSelection(groups, { groupKey: 'other', pageId: 'PP-1' }), {
    groupKey: 'other',
    pageId: 'PP-4'
  })
  assert.deepEqual(ensureSpecSelection([]), { groupKey: '', pageId: '' })
  assert.deepEqual(ensureSpecSelection(null), { groupKey: '', pageId: '' })
})

test('findSpecGroup / findSpecPage / entityById / specEntityOfPage：按 key 查找（不存在 null）', () => {
  const groups = groupPagesByEpic(spec, pageSets)
  assert.equal(findSpecGroup(groups, 'epic:EPIC-002')?.title, '商品分析')
  assert.equal(findSpecGroup(groups, 'nope'), null)
  assert.equal(findSpecPage(groups, 'epic:EPIC-001', 'PP-2')?.title, '商品详情')
  assert.equal(findSpecPage(groups, 'epic:EPIC-001', 'nope'), null)
  assert.equal(entityById(spec, 'PE-2')?.name, '商品分类')
  assert.equal(entityById(spec, 'PE-9'), undefined)
  assert.equal(specEntityOfPage(spec, spec.pages[0])?.id, 'PE-1')
  assert.equal(specEntityOfPage(spec, spec.pages[4]), undefined)
})

test('统计/覆盖/状态文案：缺省与正常路径', () => {
  assert.equal(specMetaLabel(spec), '2 实体 · 5 字段 · 5 页面')
  assert.equal(specMetaLabel({ entities: [{ fields: [{}, {}] }], pages: [] }), '1 实体 · 2 字段 · 0 页面')
  assert.equal(specMetaLabel(null), '')
  assert.equal(rangeLabel({ epics: 2, stories: 3, pages: 5 }), '2 Epic · 3 Story · 5 页')
  assert.equal(rangeLabel(null), '0 Epic · 0 Story · 0 页')
  assert.equal(coverageLabel({ stories: 8, coveredStories: 6, uncoveredStoryIds: [] }), 'Story 覆盖 6/8')
  assert.equal(coverageLabel({ stories: 0, coveredStories: 0, uncoveredStoryIds: [] }), 'Story 覆盖 —')
  assert.equal(coverageLabel(null), 'Story 覆盖 —')
  assert.equal(specStateLabel({ status: 'ready' }), '可评审')
  assert.equal(specStateLabel({ status: 'stale' }), '需求已更新，建议重新生成')
  assert.equal(specStateLabel({ status: 'missing' }), '未生成')
  assert.equal(specStateLabel(null), '未生成')
})

test('空态/基线/生成时间/页面标题：容错', () => {
  assert.equal(specEmptyReason(null), '')
  assert.equal(specEmptyReason({ module: null, spec: null }), 'no-module')
  assert.equal(specEmptyReason({ module: { id: 'm' }, spec: null }), 'missing-spec')
  assert.equal(specEmptyReason({ module: { id: 'm' }, spec }), '')
  assert.equal(baseLabel(spec), '基v8')
  assert.equal(baseLabel(null), '基v0')
  assert.match(generatedAtLabel('2026-11-17T02:10:00.000Z'), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  assert.equal(generatedAtLabel('not-a-date'), '')
  assert.equal(generatedAtLabel(null), '')
  assert.equal(specPageTitle({ title: '  商品列表 ' }), '商品列表')
  assert.equal(specPageTitle({ title: '' }), '未命名页面')
  assert.equal(specPageTypeLabel('form'), '表单')
  assert.equal(specPageTypeLabel('calendar'), '日历')
  assert.equal(specPageTypeLabel('unknown'), '列表')
})

test('specErrorOf（M7-2b）：无 detail 不显示；有空字符串/非字符串也视为无', () => {
  assert.deepEqual(specErrorOf(new Error('原型生成失败：请求失败（HTTP 502）')), {
    message: '原型生成失败：请求失败（HTTP 502）',
    detail: ''
  })
  const withEmpty = new Error('boom')
  withEmpty.detail = '   '
  assert.equal(specErrorOf(withEmpty).detail, '')
  const withNumber = new Error('boom')
  withNumber.detail = 123
  assert.equal(specErrorOf(withNumber).detail, '')
  assert.deepEqual(specErrorOf(null), { message: '', detail: '' })
  // 正常短片段透传
  const short = new Error('原型生成结果无法解析，请重试（已自动重试 1 次）')
  short.detail = '抱歉，我需要先确认库存规则。'
  assert.deepEqual(specErrorOf(short), {
    message: '原型生成结果无法解析，请重试（已自动重试 1 次）',
    detail: '抱歉，我需要先确认库存规则。'
  })
})

test('specErrorOf（M7-2b）：超长 detail 截断为头 150 + … + 尾 150', () => {
  const error = new Error('boom')
  error.detail = `开头${'x'.repeat(400)}结尾`
  const result = specErrorOf(error)
  assert.equal(result.message, 'boom')
  assert.ok(result.detail.startsWith('开头'))
  assert.ok(result.detail.endsWith('结尾'))
  assert.ok(result.detail.includes('…'))
  assert.ok(result.detail.length <= SPEC_ERROR_DETAIL_LIMIT + 1)
  const boundary = new Error('boom')
  boundary.detail = 'y'.repeat(SPEC_ERROR_DETAIL_LIMIT)
  assert.equal(specErrorOf(boundary).detail.length, SPEC_ERROR_DETAIL_LIMIT)
  assert.ok(!specErrorOf(boundary).detail.includes('…'))
})
