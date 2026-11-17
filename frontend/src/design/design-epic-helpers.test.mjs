/**
 * D-RMP 前端纯函数单测：设计大纲树 / Epic 过滤 / 受影响 confirmed / 批量状态机。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  affectedConfirmedForEpic,
  affectedConfirmedSummary,
  createEpicBatch,
  defaultEpicSelection,
  epicBatchStatusLabel,
  epicBatchSummary,
  epicFilterEntities,
  epicFilterPageSets,
  epicMatchesEntity,
  epicMatchesPageSet,
  epicNodesOf,
  epicOutlineOf,
  epicPrimaryPageSet,
  epicStatsOf,
  epicStatusLabel,
  nextPendingIndex,
  retryFailed,
  retryOne,
  skipPending,
  updateEpicBatch
} from './design-epic-helpers.js'

function story(id, epicId) {
  return { id, epicId, title: `故事 ${id}`, description: '', acceptance: [], priority: '', position: 0 }
}

function entityFixture(id, name, refs, status = 'draft') {
  return { id, name, requirementRefs: refs, status, fields: [], relations: [], sourceSections: [], position: 0 }
}

function pageFixture(id, refs, status = 'draft', imagePath = 'x.png') {
  return { id, pageKey: id, title: `页面 ${id}`, type: 'list', entityId: 'ent-a', requirementRefs: refs, status, imagePath, spec: {}, layout: {}, position: 0 }
}

function setFixture(id, title, epicId, storyIds, pages, extra = {}) {
  return { id, sceneKey: epicId ?? 'SCENE-001', epicId, storyIds, title, description: '', status: 'draft', position: 0, pages, entityIds: [], ...extra }
}

function projectFixture() {
  return {
    status: 'draft',
    stale: { stale: false },
    input: {
      epics: [
        { id: 'EPIC-001', title: '商品档案', goal: '维护商品', priority: 'P0', sceneId: null, position: 0, stories: [story('STORY-001', 'EPIC-001'), story('STORY-002', 'EPIC-001')] },
        { id: 'EPIC-002', title: '订单管理', goal: '维护订单', priority: 'P1', sceneId: null, position: 1, stories: [story('STORY-003', 'EPIC-002')] }
      ],
      scenes: [],
      stories: [story('STORY-001', 'EPIC-001'), story('STORY-002', 'EPIC-001'), story('STORY-003', 'EPIC-002')]
    },
    entities: [
      entityFixture('ent-a', '商品', ['STORY-001'], 'confirmed'),
      entityFixture('ent-b', '订单', ['STORY-003'], 'confirmed'),
      entityFixture('ent-c', '日志', [], 'draft')
    ],
    pageSets: [
      setFixture('ps-1', '商品档案', 'EPIC-001', ['STORY-001', 'STORY-002'], [pageFixture('pg-1', ['STORY-001'], 'confirmed'), pageFixture('pg-2', ['STORY-002'], 'draft', null)], { status: 'confirmed', position: 0 }),
      setFixture('ps-2', '订单管理', 'EPIC-002', ['STORY-003'], [pageFixture('pg-3', ['STORY-003'])], { position: 1 }),
      setFixture('ps-manual', '商品补充', 'EPIC-001', ['STORY-002'], [pageFixture('pg-4', ['STORY-002'])], { position: 2 })
    ]
  }
}

test('epicNodesOf：Epic 优先；完全 fallback 时用场景（SCENE-xxx + 未归属 Story）', () => {
  const project = projectFixture()
  const nodes = epicNodesOf(project)
  assert.deepEqual(nodes.map(node => node.id), ['EPIC-001', 'EPIC-002'])
  assert.deepEqual(nodes[0].storyIds, ['STORY-001', 'STORY-002'])
  assert.equal(nodes[0].isScene, false)

  const fallback = {
    input: {
      epics: [],
      scenes: [{ id: 'SCENE-001', title: '订单管理', description: '销售维护订单', position: 0 }],
      stories: [story('STORY-001', null), story('STORY-002', 'EPIC-001')]
    }
  }
  const sceneNodes = epicNodesOf(fallback)
  assert.equal(sceneNodes.length, 1)
  assert.equal(sceneNodes[0].id, 'SCENE-001')
  assert.equal(sceneNodes[0].isScene, true)
  assert.deepEqual(sceneNodes[0].storyIds, ['STORY-001'], '只包含未归属 Epic 的 Story')

  assert.deepEqual(epicNodesOf({ input: null }), [])
  assert.deepEqual(epicNodesOf({}), [])
})

test('Epic 过滤：实体 requirementRefs、页面集 epicId/storyIds、primary 取最小 position', () => {
  const project = projectFixture()
  const node = epicNodesOf(project)[0]
  assert.equal(epicMatchesEntity(project.entities[0], node), true)
  assert.equal(epicMatchesEntity(project.entities[2], node), false)
  assert.deepEqual(
    epicFilterEntities(project.entities, node).map(entity => entity.id),
    ['ent-a']
  )
  assert.equal(epicFilterEntities(project.entities, null).length, 3, '无过滤时返回全部')
  assert.equal(epicMatchesPageSet(project.pageSets[2], node), true, 'storyIds 相交也算本 Epic')
  assert.deepEqual(
    epicFilterPageSets(project.pageSets, node).map(set => set.id),
    ['ps-1', 'ps-manual']
  )
  assert.equal(epicPrimaryPageSet(project.pageSets, node)?.id, 'ps-1')
  assert.equal(epicPrimaryPageSet(project.pageSets, null), null)

  // fallback：epicId=null + sceneKey 才算；有 epicId 的不属于场景
  const fallbackNode = { id: 'SCENE-001', title: '订单', isScene: true, storyIds: [] }
  assert.equal(epicMatchesPageSet(setFixture('x', 'x', null, [], [], { sceneKey: 'SCENE-001' }), fallbackNode), true)
  assert.equal(epicMatchesPageSet(setFixture('y', 'y', 'EPIC-001', [], [], { sceneKey: 'SCENE-001' }), fallbackNode), false)
})

test('epicStatsOf / epicOutlineOf：状态、Story 覆盖、缺图、数据集与未归属', () => {
  const project = projectFixture()
  const [epic1, epic2] = epicNodesOf(project)
  const stats1 = epicStatsOf(project, epic1)
  assert.equal(stats1.pageSetCount, 2)
  assert.equal(stats1.pageCount, 3, 'primary + 手工额外页面集的页面都算')
  assert.equal(stats1.primary?.id, 'ps-1')
  assert.equal(stats1.storyTotal, 2)
  assert.equal(stats1.coveredStories, 2)
  assert.equal(stats1.missingImages, 1, 'pg-2 没有图片')
  assert.equal(stats1.status, 'draft', '模块项目为 draft → 不算已确认')
  assert.equal(stats1.needsWork, false)

  const stats2 = epicStatsOf(project, epic2)
  assert.equal(stats2.status, 'draft')
  assert.equal(stats2.needsWork, false)

  // 已确认：项目非 draft + primary/pages/实体全部 confirmed
  const confirmedProject = {
    ...project,
    status: 'confirmed',
    entities: project.entities.map(entity => (entity.id === 'ent-a' ? { ...entity, status: 'confirmed' } : entity)),
    pageSets: project.pageSets.filter(set => set.id === 'ps-1').map(set => ({
      ...set,
      status: 'confirmed',
      pages: set.pages.map(page => ({ ...page, status: 'confirmed', imagePath: 'x.png' }))
    }))
  }
  assert.equal(epicStatsOf(confirmedProject, epic1).status, 'confirmed')

  const staleProject = { ...project, stale: { stale: true } }
  assert.equal(epicStatsOf(staleProject, epic1).status, 'stale')

  const outline = epicOutlineOf(project)
  assert.deepEqual(outline.nodes.map(item => item.node.id), ['EPIC-001', 'EPIC-002'])
  assert.deepEqual(outline.matchedEntities.map(entity => entity.id), ['ent-a', 'ent-b'])
  assert.deepEqual(outline.unassignedEntities.map(entity => entity.id), ['ent-c'])
  assert.deepEqual(outline.unassignedPageSets, [])

  const unassignedSet = setFixture('ps-x', '无归属', null, [], [], { sceneKey: 'scene:legacy' })
  const outline2 = epicOutlineOf({ ...project, pageSets: [...project.pageSets, unassignedSet] })
  assert.deepEqual(outline2.unassignedPageSets.map(set => set.id), ['ps-x'])
})

test('defaultEpicSelection：默认勾选未生成/无页面/Story 未覆盖的 Epic', () => {
  const project = projectFixture()
  const [epic1] = epicNodesOf(project)
  const nodes = [
    epicStatsOf({ ...project, pageSets: [], entities: [] }, epic1),
    epicStatsOf(project, epic1)
  ]
  assert.deepEqual(defaultEpicSelection(nodes), ['EPIC-001'])
  // Story 未覆盖 → needsWork
  const partial = {
    ...project,
    pageSets: project.pageSets.map(set =>
      set.epicId === 'EPIC-001'
        ? { ...set, storyIds: ['STORY-001'], pages: [pageFixture('pg-1', ['STORY-001'])] }
        : set
    )
  }
  assert.equal(epicStatsOf(partial, epic1).needsWork, true)
})

test('受影响 confirmed：实体/primary 页面集/页面；汇总去重并生成文案', () => {
  const project = projectFixture()
  const [epic1, epic2] = epicNodesOf(project)
  const impact = affectedConfirmedForEpic(project, epic1)
  assert.deepEqual(impact.entities.map(item => item.id), ['ent-a'])
  assert.deepEqual(impact.pageSets.map(item => item.id), ['ps-1'])
  assert.deepEqual(impact.pages.map(item => item.id), ['pg-1'])

  const summary = affectedConfirmedSummary(project, [epic1, epic2])
  assert.equal(summary.entities.length, 2)
  assert.equal(summary.pageSets.length, 1)
  assert.equal(summary.pages.length, 1)
  assert.equal(summary.count, 4)
  assert.ok(summary.items.some(line => line.includes('实体「商品」已确认')))
  assert.ok(summary.items.some(line => line.includes('页面集「商品档案」已确认')))
  assert.ok(summary.items.some(line => line.includes('页面「页面 pg-1」已确认')))

  const noConfirmed = affectedConfirmedSummary(
    {
      ...project,
      entities: project.entities.map(entity => ({ ...entity, status: 'draft' })),
      pageSets: project.pageSets.map(set => ({
        ...set,
        status: 'draft',
        pages: set.pages.map(page => ({ ...page, status: 'draft' }))
      }))
    },
    [epic1]
  )
  assert.equal(noConfirmed.count, 0)
})

test('MF-DRMP-3/4/5：draft 页面集内已确认 page / 仅页面绑定实体 / Epic 自身已确认', () => {
  const input = {
    epics: [
      {
        id: 'EPIC-001',
        title: '商品档案',
        goal: '',
        priority: '',
        sceneId: null,
        position: 0,
        stories: [story('STORY-001', 'EPIC-001')]
      }
    ],
    scenes: [],
    stories: [story('STORY-001', 'EPIC-001')]
  }
  const project = {
    status: 'draft',
    stale: { stale: false },
    input,
    entities: [
      { ...entityFixture('ent-bound', '绑定实体', [], 'confirmed') },
      { ...entityFixture('ent-other', '其它实体', ['STORY-999'], 'confirmed') }
    ],
    pageSets: [
      setFixture('ps-1', '商品档案', 'EPIC-001', ['STORY-001'], [
        { ...pageFixture('pg-confirmed', ['STORY-001'], 'confirmed'), entityId: 'ent-bound' },
        { ...pageFixture('pg-draft', ['STORY-001'], 'draft'), entityId: 'ent-bound' }
      ], { status: 'draft' })
    ]
  }
  const node = epicNodesOf(project)[0]
  const stats = epicStatsOf(project, node)
  assert.deepEqual(stats.entities.map(entity => entity.id), ['ent-bound'], '无 refs 但被页面绑定的实体算相关')
  assert.equal(stats.status, 'draft', '页面集仍 draft')

  const impact = affectedConfirmedForEpic(project, node)
  assert.deepEqual(impact.entities.map(item => item.id), ['ent-bound'])
  assert.deepEqual(impact.pageSets, [], '页面集 draft 不列入 pageSets')
  assert.deepEqual(impact.pages.map(item => item.id), ['pg-confirmed'], 'draft 页面集内已确认 page 也要提示')

  // MF-DRMP-4：Epic 自身全部确认时，即使模块项目仍 draft 也显示已确认
  const allConfirmed = {
    ...project,
    entities: project.entities.map(entity => (entity.id === 'ent-bound' ? entity : entity)),
    pageSets: [
      setFixture('ps-1', '商品档案', 'EPIC-001', ['STORY-001'], [
        { ...pageFixture('pg-confirmed', ['STORY-001'], 'confirmed'), entityId: 'ent-bound' },
        { ...pageFixture('pg-draft', ['STORY-001'], 'confirmed'), entityId: 'ent-bound' }
      ], { status: 'confirmed' })
    ]
  }
  assert.equal(epicStatsOf(allConfirmed, node).status, 'confirmed', 'project draft 但本 Epic 全确认 → confirmed')
  assert.equal(epicStatsOf({ ...allConfirmed, status: 'confirmed' }, node).status, 'confirmed')
  assert.equal(epicStatsOf({ ...allConfirmed, stale: { stale: true } }, node).status, 'stale', 'stale 优先')

  // 只有其它实体（无 refs、未被 page 绑定）不算本 Epic 相关
  const otherOnly = {
    ...project,
    entities: [entityFixture('ent-x', '无关实体', [], 'confirmed')],
    pageSets: []
  }
  assert.deepEqual(epicStatsOf(otherOnly, node).entities, [])
  assert.equal(epicStatsOf(otherOnly, node).status, 'none')
})

test('批量状态机：等待→运行→成功/失败→跳过/重试/汇总', () => {
  let items = createEpicBatch([
    { epicId: 'EPIC-001', title: '商品档案' },
    { epicId: 'EPIC-002', title: '订单管理' },
    { epicId: 'EPIC-003', title: '售后' }
  ])
  assert.deepEqual(items.map(item => item.status), ['pending', 'pending', 'pending'])
  assert.equal(nextPendingIndex(items), 0)

  items = updateEpicBatch(items, 'EPIC-001', { status: 'running' })
  assert.equal(nextPendingIndex(items), 1)
  items = updateEpicBatch(items, 'EPIC-001', { status: 'success', entitiesAdded: 1, pages: 3 })
  items = updateEpicBatch(items, 'EPIC-002', { status: 'running' })
  items = updateEpicBatch(items, 'EPIC-002', { status: 'failed', error: '模型失败' })
  assert.equal(items[1].error, '模型失败')

  // 停止剩余 → pending 变 skipped，当前 running/失败保留
  items = skipPending(items)
  assert.deepEqual(items.map(item => item.status), ['success', 'failed', 'skipped'])
  assert.equal(epicBatchSummary(items).finished, true)
  assert.deepEqual(epicBatchSummary(items), {
    total: 3,
    pending: 0,
    running: 0,
    success: 1,
    failed: 1,
    skipped: 1,
    finished: true
  })

  // 重试失败 / 重试单个
  let retried = retryFailed(items)
  assert.equal(retried[1].status, 'pending')
  assert.equal(retried[1].error, '')
  assert.equal(nextPendingIndex(retried), 1)
  retried = updateEpicBatch(retried, 'EPIC-002', { status: 'failed', error: '再次失败' })
  assert.equal(retryOne(retried, 'EPIC-002')[1].status, 'pending')
  assert.equal(retryOne(retried, 'EPIC-001')[0].status, 'success', '只重试失败项')

  assert.equal(epicStatusLabel('none'), '未生成')
  assert.equal(epicStatusLabel('stale'), '需同步')
  assert.equal(epicBatchStatusLabel('running'), '生成中')
  assert.equal(epicBatchStatusLabel('unknown'), 'unknown')
  assert.equal(epicBatchSummary([]).finished, false, '空队列不算完成')
})
