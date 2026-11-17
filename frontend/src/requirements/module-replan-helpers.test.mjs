import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addReplanModule,
  applyMapping,
  computeArchiveModules,
  createReplanDraft,
  firstReplanTargetId,
  mappedModuleIds,
  mappingOptions,
  moduleScopeOf,
  movePlanModule,
  removePlanModule,
  replanSummaryText,
  restoreArchiveModule,
  scopeMatchesCurrent,
  summarizeReplan,
  textToScope,
  scopeToText,
  toReplanApiPlan
} from './module-replan-helpers.js'

const CURRENT = [
  {
    id: 'm-1',
    moduleKey: 'MOD-001',
    title: '商品管理',
    description: '商品与明细',
    status: 'draft',
    version: 2,
    scope: ['商品档案', '商品明细'],
    confirmed: false
  },
  {
    id: 'm-2',
    moduleKey: 'MOD-002',
    title: '订单管理',
    description: '订单创建与查询',
    status: 'confirmed',
    version: 3,
    scope: ['订单创建', '订单查询'],
    confirmed: true
  }
]

const PLAN = {
  kind: 'replan',
  instruction: '重新拆分',
  modules: [
    {
      key: 'product',
      title: '商品管理',
      description: '商品与明细',
      scope: ['商品档案', '商品明细'],
      suggestedEpics: [{ title: '商品档案', stories: ['商品列表'] }],
      existingModuleId: 'm-1',
      action: 'keep'
    },
    {
      key: 'order',
      title: '订单中心',
      description: '下单与查询',
      scope: ['订单创建', '订单查询'],
      existingModuleId: 'm-2',
      action: 'regenerate'
    },
    {
      key: 'aftersale',
      title: '售后管理',
      description: '售后',
      scope: ['售后申请'],
      existingModuleId: null,
      action: 'create'
    }
  ],
  dependencies: [{ from: 'order', to: 'product', description: '订单引用商品' }],
  coverage: [{ requirement: '商品', moduleKey: 'product' }],
  unassigned: [],
  openIssues: [],
  warnings: ['提醒']
}

test('createReplanDraft：克隆建议并带本地 clientId；scope 行编辑', () => {
  const draft = createReplanDraft(PLAN)
  assert.equal(draft.kind, 'replan')
  assert.equal(draft.modules.length, 3)
  assert.ok(draft.modules.every(item => item.clientId.startsWith('replan-row-')))
  assert.equal(new Set(draft.modules.map(item => item.clientId)).size, 3)
  assert.deepEqual(draft.modules[0].scope, ['商品档案', '商品明细'])
  assert.equal(draft.modules[0].suggestedEpics[0].title, '商品档案')
  assert.deepEqual(draft.dependencies, PLAN.dependencies)

  assert.equal(scopeToText(['a', 'b']), 'a\nb')
  assert.deepEqual(textToScope('  a \n\n b '), ['a', 'b'])

  const moved = movePlanModule(draft.modules, 0, 1)
  assert.equal(moved[1].key, 'product')
  assert.equal(movePlanModule(draft.modules, 0, -1)[0].key, 'product')
  const removed = removePlanModule(draft.modules, 0)
  assert.equal(removed.length, 2)
  assert.equal(removePlanModule([draft.modules[0]], 0).length, 1)
  const added = addReplanModule(draft.modules)
  assert.equal(added.length, 4)
  assert.equal(added[3].action, 'create')
  assert.equal(added[3].existingModuleId, null)
})

test('映射：options 过滤其它行已用、applyMapping 新建/保留/重新生成、唯一性', () => {
  let modules = createReplanDraft(PLAN).modules
  assert.deepEqual(mappedModuleIds(modules), ['m-1', 'm-2'])
  assert.deepEqual(
    mappingOptions(modules, CURRENT, 0).map(item => item.id),
    ['m-1']
  )
  assert.deepEqual(
    mappingOptions(modules, CURRENT, 2).map(item => item.id),
    [] // 两个现有模块都被其它行映射
  )

  // 新建行映射到 m-2（其它行先移走 m-2）
  modules = modules.map(item => (item.existingModuleId === 'm-2' ? { ...item, existingModuleId: null, action: 'create' } : item))
  modules = applyMapping(modules, 2, 'm-2', CURRENT)
  assert.equal(modules[2].existingModuleId, 'm-2')
  assert.equal(modules[2].action, 'regenerate') // 标题不同 → 重新生成
  assert.equal(modules[2].title, '售后管理')

  const sameTitle = applyMapping(
    [{ ...modules[0], existingModuleId: null, action: 'create' }],
    0,
    'm-1',
    CURRENT
  )
  assert.equal(sameTitle[0].action, 'keep') // 同标题 → 保留

  const toCreate = applyMapping(modules, 2, '', CURRENT)
  assert.equal(toCreate[2].existingModuleId, null)
  assert.equal(toCreate[2].action, 'create')
})

test('归档计算/恢复：未映射模块列表；恢复为 keep 行；已映射不重复', () => {
  const modules = createReplanDraft(PLAN).modules.slice(0, 1) // 只映射 m-1
  const archive = computeArchiveModules(modules, CURRENT)
  assert.deepEqual(archive.map(module => module.id), ['m-2'])

  const restored = restoreArchiveModule(modules, CURRENT[1])
  assert.equal(restored.length, 2)
  assert.equal(restored[1].existingModuleId, 'm-2')
  assert.equal(restored[1].action, 'keep')
  assert.equal(restoreArchiveModule(restored, CURRENT[1]).length, 2)

  assert.deepEqual(computeArchiveModules(createReplanDraft(PLAN).modules, CURRENT), [])
  assert.deepEqual(moduleScopeOf(CURRENT, 'm-2'), ['订单创建', '订单查询'])
  assert.equal(moduleScopeOf(CURRENT, 'missing').length, 0)
})

test('summarizeReplan：计数/生成列表/受影响确认模块（rename/regenerate/归档）', () => {
  const summary = summarizeReplan(createReplanDraft(PLAN).modules, CURRENT)
  assert.equal(summary.kept, 1)
  assert.equal(summary.renamed, 0)
  assert.equal(summary.regenerated, 1)
  assert.equal(summary.created, 1)
  assert.deepEqual(summary.archiveModules, [])
  assert.deepEqual(summary.generation.map(item => item.title), ['订单中心', '售后管理'])
  assert.deepEqual(summary.affectedConfirmed.map(module => module.id), ['m-2'])
  assert.equal(summary.requiresReopenConfirmed, true)

  // keep 仅标题变化 → 计 rename（与后端 keep→rename 一致）
  const keepRenamed = summarizeReplan(
    [
      {
        clientId: 'x',
        title: '商品中心',
        description: '商品与明细',
        scope: ['商品档案', '商品明细'],
        existingModuleId: 'm-1',
        action: 'keep'
      },
      {
        clientId: 'y',
        title: '订单管理',
        description: '订单创建与查询',
        scope: ['订单创建', '订单查询'],
        existingModuleId: 'm-2',
        action: 'keep'
      }
    ],
    CURRENT
  )
  assert.equal(keepRenamed.kept, 1)
  assert.equal(keepRenamed.renamed, 1)
  assert.equal(keepRenamed.requiresReopenConfirmed, false)

  const archiveConfirmed = summarizeReplan(
    [{ clientId: 'y', title: '新模块', description: '', scope: [], existingModuleId: null, action: 'create' }],
    CURRENT
  )
  assert.deepEqual(archiveConfirmed.archiveModules.map(module => module.id), ['m-1', 'm-2'])
  assert.deepEqual(archiveConfirmed.affectedConfirmed.map(module => module.id), ['m-2'])
})

test('toReplanApiPlan：提交动作按有效动作（keep→rename）、trim、保留元信息', () => {
  const draft = createReplanDraft(PLAN)
  draft.modules[0] = { ...draft.modules[0], title: '商品中心' }
  const payload = toReplanApiPlan(draft, { instruction: '  调整  ', currentModules: CURRENT })
  assert.equal(payload.kind, 'replan')
  assert.equal(payload.instruction, '调整')
  assert.equal(payload.modules[0].action, 'rename')
  assert.equal(payload.modules[0].existingModuleId, 'm-1')
  assert.equal(payload.modules[1].action, 'regenerate')
  assert.equal(payload.modules[2].action, 'create')
  assert.equal(payload.modules[2].existingModuleId, null)
  assert.deepEqual(payload.dependencies, PLAN.dependencies)
  assert.deepEqual(payload.openIssues, [])

  assert.equal(scopeMatchesCurrent(draft.modules[0], CURRENT), true)
  assert.equal(scopeMatchesCurrent({ ...draft.modules[0], scope: ['新'] }, CURRENT), false)
  assert.equal(scopeMatchesCurrent({ ...draft.modules[2], scope: ['任意'] }, CURRENT), true)
})

test('replanSummaryText / firstReplanTargetId：提示与选中目标', () => {
  const result = {
    modules: [{ id: 'm-1' }, { id: 'new-1' }],
    kept: [{ id: 'm-1' }],
    renamed: [{ id: 'm-2' }],
    regenerated: [{ id: 'new-2' }],
    created: [{ id: 'new-1' }],
    archived: [{ id: 'old-1' }],
    reopened: [{ id: 'm-2' }],
    generation: [{ moduleId: 'new-2', title: '订单中心' }]
  }
  assert.equal(
    replanSummaryText(result),
    '已保留 1、改名 1、重新生成 1、新建 1、归档 1、重新打开已确认 1'
  )
  assert.equal(firstReplanTargetId(result), 'new-2')
  assert.equal(
    firstReplanTargetId({ modules: [{ id: 'm-1' }], kept: [], renamed: [], regenerated: [], created: [], archived: [], reopened: [], generation: [] }),
    'm-1'
  )
  assert.equal(replanSummaryText(null), '')
  assert.equal(firstReplanTargetId(null), '')
})
