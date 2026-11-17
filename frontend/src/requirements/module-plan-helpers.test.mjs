import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addPlanModule,
  createGenerationState,
  createPlanDraft,
  failedGenerationModules,
  firstGeneratedModuleId,
  generationSummary,
  initialPlanEligible,
  isEmptySections,
  movePlanModule,
  reduceGenerationEvent,
  removePlanModule,
  scopeToText,
  textToScope,
  toApiPlan
} from './module-plan-helpers.js'

const MODULES = [{ id: 'm1', title: '应用', archived: false }]
const EMPTY_SECTIONS = [
  { sectionKey: 'problem', markdown: '', kind: 'markdown', required: true },
  { sectionKey: 'epics', markdown: '', kind: 'epics', required: true, data: { scenes: [], epics: [], stories: [] } }
]

test('isEmptySections：markdown 空且结构化无条目才算空', () => {
  assert.equal(isEmptySections(EMPTY_SECTIONS), true)
  assert.equal(isEmptySections([{ markdown: '内容' }]), false)
  assert.equal(
    isEmptySections([{ markdown: '', data: { scenes: [], epics: [{ id: 'EPIC-1' }], stories: [] } }]),
    false
  )
  assert.equal(isEmptySections([]), true)
})

test('initialPlanEligible：满足首次条件才 true；阶段/变更/多模块/文档状态/内容都拦截', () => {
  const base = {
    appStatus: 'requirements',
    hasActiveChangeSet: false,
    modules: MODULES,
    selectedModuleId: 'm1',
    doc: { status: 'draft' },
    sections: EMPTY_SECTIONS
  }
  assert.equal(initialPlanEligible(base), true)
  assert.equal(initialPlanEligible({ ...base, appStatus: 'design' }), false)
  assert.equal(initialPlanEligible({ ...base, hasActiveChangeSet: true }), false)
  assert.equal(initialPlanEligible({ ...base, modules: [...MODULES, { id: 'm2', archived: false }] }), false)
  assert.equal(initialPlanEligible({ ...base, selectedModuleId: 'm2' }), false)
  assert.equal(initialPlanEligible({ ...base, doc: { status: 'confirmed' } }), false)
  assert.equal(initialPlanEligible({ ...base, sections: [{ markdown: '内容' }] }), false)
  assert.equal(initialPlanEligible({ ...base, modules: [{ id: 'm1', archived: true }] }), false)
})

test('计划草稿：克隆/排序/增删/转 API（去 clientId、scope 行编辑）', () => {
  const draft = createPlanDraft({
    modules: [
      { key: 'a', title: '商品管理', scope: ['档案'], suggestedEpics: [{ title: '商品', stories: ['列表'] }] },
      { key: 'b', title: '订单管理' }
    ],
    dependencies: [{ from: 'b', to: 'a', description: 'x' }]
  })
  assert.equal(draft.modules.length, 2)
  assert.ok(draft.modules.every(item => typeof item.clientId === 'string'))

  const moved = movePlanModule(draft.modules, 0, 1)
  assert.equal(moved[0].title, '订单管理')
  assert.equal(movePlanModule(draft.modules, 0, -1)[0].title, '商品管理')

  const removed = removePlanModule(draft.modules, 0)
  assert.equal(removed.length, 1)
  assert.equal(removePlanModule([draft.modules[0]], 0).length, 1)

  const added = addPlanModule(draft.modules)
  assert.equal(added.length, 3)
  assert.equal(added[2].title, '')

  assert.equal(scopeToText(['a', 'b']), 'a\nb')
  assert.deepEqual(textToScope('a\n\n b '), ['a', 'b'])

  const api = toApiPlan({ ...draft, modules: [{ ...draft.modules[0], scope: textToScope('档案\n明细') }] })
  assert.equal(api.modules[0].clientId, undefined)
  assert.equal(api.kind, 'initial')
  assert.deepEqual(api.modules[0].scope, ['档案', '明细'])
  assert.equal(api.modules[0].existingModuleId, null)
  assert.equal(api.modules[0].action, 'create')
})

test('生成状态机：start/done/error/all-done 顺序与失败/取消', () => {
  let state = createGenerationState({
    modules: [
      { moduleId: 'm1', title: '商品管理' },
      { moduleId: 'm2', title: '订单管理' }
    ],
    reason: 'initial'
  })
  assert.equal(state.running, true)
  assert.deepEqual(state.items.map(item => item.status), ['waiting', 'waiting'])

  state = reduceGenerationEvent(state, { type: 'module-start', moduleId: 'm1', index: 1, total: 2 })
  assert.equal(state.items[0].status, 'running')
  state = reduceGenerationEvent(state, { type: 'module-done', moduleId: 'm1', version: 2, warnings: ['w'] })
  assert.equal(state.items[0].status, 'done')
  assert.equal(state.items[0].version, 2)
  assert.deepEqual(state.items[0].warnings, ['w'])
  state = reduceGenerationEvent(state, { type: 'module-start', moduleId: 'm2' })
  state = reduceGenerationEvent(state, { type: 'module-error', moduleId: 'm2', error: '超时' })
  assert.equal(state.items[1].status, 'error')
  assert.equal(state.items[1].error, '超时')
  state = reduceGenerationEvent(state, {
    type: 'all-done',
    ok: false,
    cancelled: false,
    failed: [{ moduleId: 'm2', error: '超时' }]
  })
  assert.equal(state.running, false)
  assert.equal(state.ok, false)
  assert.deepEqual(generationSummary(state), {
    total: 2,
    done: 1,
    failed: 1,
    running: 0,
    waiting: 0,
    cancelled: 0,
    finished: true,
    ok: false
  })
  assert.deepEqual(failedGenerationModules(state).map(item => item.moduleId), ['m2'])
  assert.equal(firstGeneratedModuleId(state), 'm1')

  // 取消：等待中的模块标记 cancelled
  let cancelled = createGenerationState({ modules: [{ moduleId: 'm1', title: 'A' }, { moduleId: 'm2', title: 'B' }], reason: 'initial' })
  cancelled = reduceGenerationEvent(cancelled, { type: 'module-start', moduleId: 'm1' })
  cancelled = reduceGenerationEvent(cancelled, { type: 'all-done', ok: false, cancelled: true, failed: [] })
  assert.equal(cancelled.items[0].status, 'cancelled')
  assert.equal(cancelled.items[1].status, 'cancelled')
  assert.equal(generationSummary(cancelled).cancelled, 2)
})

test('生成状态机：无 moduleId 的 module-error 视为全局错误；未知事件不崩溃', () => {
  let state = createGenerationState({ modules: [{ moduleId: 'm1', title: 'A' }], reason: 'initial' })
  state = reduceGenerationEvent(state, { type: 'module-error', error: '服务异常' })
  assert.equal(state.globalError, '服务异常')
  assert.equal(reduceGenerationEvent(state, { type: 'unknown' }).items.length, 1)
})
