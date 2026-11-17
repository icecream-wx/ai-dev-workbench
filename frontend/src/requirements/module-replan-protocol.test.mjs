import assert from 'node:assert/strict'
import test from 'node:test'
import {
  actionLabel,
  currentModuleOf,
  normalizeReplanPlan,
  resolveReplanAction,
  sameScope,
  validateReplanDraft
} from './module-replan-protocol.js'

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

function draft(modules, extra = {}) {
  return {
    kind: 'replan',
    instruction: '重新拆分',
    modules,
    dependencies: [],
    coverage: [{ requirement: '商品', moduleKey: 'product' }],
    unassigned: [],
    openIssues: [],
    warnings: [],
    ...extra
  }
}

test('normalizeReplanPlan：防御性归一化（缺字段/动作/映射/引用）', () => {
  const plan = normalizeReplanPlan({
    kind: 'initial',
    modules: [{ title: '商品', existingModuleId: '', action: '' }, null],
    dependencies: [{ from: 'a', to: 'b' }, { from: '', to: 'b' }],
    coverage: [{ requirement: 'x' }, {}],
    unassigned: [{ requirement: 'y' }, {}],
    openIssues: ['问题', ''],
    warnings: null
  })
  assert.equal(plan.kind, 'replan')
  assert.equal(plan.modules.length, 2)
  assert.equal(plan.modules[0].action, 'create')
  assert.equal(plan.modules[0].existingModuleId, null)
  assert.equal(plan.modules[1].title, '')
  assert.deepEqual(plan.dependencies, [{ from: 'a', to: 'b', description: '' }])
  assert.deepEqual(plan.coverage, [{ requirement: 'x', moduleKey: '' }])
  assert.deepEqual(plan.unassigned, [{ requirement: 'y', reason: '' }])
  assert.deepEqual(plan.openIssues, ['问题'])
  assert.deepEqual(plan.warnings, [])
  assert.equal(actionLabel('regenerate'), '重新生成')
  assert.equal(currentModuleOf(CURRENT, 'm-2')?.title, '订单管理')
  assert.equal(currentModuleOf(CURRENT, ''), null)
})

test('resolveReplanAction：keep 标题/说明变化按 rename；范围相同判断与顺序无关', () => {
  const unchanged = resolveReplanAction(
    { action: 'keep', existingModuleId: 'm-1', title: '商品管理', description: '商品与明细' },
    CURRENT
  )
  assert.equal(unchanged, 'keep')
  const titleChanged = resolveReplanAction(
    { action: 'keep', existingModuleId: 'm-1', title: '商品中心', description: '商品与明细' },
    CURRENT
  )
  assert.equal(titleChanged, 'rename')
  const descChanged = resolveReplanAction(
    { action: 'keep', existingModuleId: 'm-1', title: '商品管理', description: '新说明' },
    CURRENT
  )
  assert.equal(descChanged, 'rename')
  assert.equal(resolveReplanAction({ action: 'regenerate', existingModuleId: 'm-1' }, CURRENT), 'regenerate')
  assert.equal(resolveReplanAction({ action: 'create' }, CURRENT), 'create')
  assert.equal(sameScope(['b', 'a'], ['a', 'b']), true)
  assert.equal(sameScope(['a'], ['a', 'b']), false)
})

test('validateReplanDraft：空/重复标题、重复映射、create 带映射、范围变化、动作非法', () => {
  const emptyTitle = validateReplanDraft(draft([{ title: '', action: 'create' }]), CURRENT)
  assert.ok(emptyTitle.errors.some(error => error.includes('标题为空')))

  const dupTitle = validateReplanDraft(
    draft([
      { title: '同名', action: 'create' },
      { title: '同名', action: 'create' }
    ]),
    CURRENT
  )
  assert.ok(dupTitle.errors.some(error => error.includes('标题重复')))

  const dupMapping = validateReplanDraft(
    draft([
      { title: '商品', action: 'keep', existingModuleId: 'm-1', scope: ['商品档案', '商品明细'], description: '商品与明细' },
      { title: '商品二', action: 'regenerate', existingModuleId: 'm-1', scope: ['x'] }
    ]),
    CURRENT
  )
  assert.ok(dupMapping.errors.some(error => error.includes('映射多次')))

  const createWithMap = validateReplanDraft(
    draft([{ title: '新模块', action: 'create', existingModuleId: 'm-1' }]),
    CURRENT
  )
  assert.ok(createWithMap.errors.some(error => error.includes('不能映射已有模块')))

  const missingMapping = validateReplanDraft(draft([{ title: '保留模块', action: 'keep' }]), CURRENT)
  assert.ok(missingMapping.errors.some(error => error.includes('需要选择映射的现有模块')))

  const keepScopeChanged = validateReplanDraft(
    draft([
      {
        title: '商品管理',
        description: '商品与明细',
        action: 'keep',
        existingModuleId: 'm-1',
        scope: ['商品档案', '商品明细', '新范围']
      }
    ]),
    CURRENT
  )
  assert.ok(keepScopeChanged.errors.some(error => error.includes('范围已变化')))

  const renameScopeChanged = validateReplanDraft(
    draft([
      {
        title: '商品中心',
        description: '商品与明细',
        action: 'rename',
        existingModuleId: 'm-1',
        scope: ['只保留档案']
      }
    ]),
    CURRENT
  )
  assert.ok(renameScopeChanged.errors.some(error => error.includes('范围已变化')))

  // keep 标题变化（有效动作 rename）但 scope 未变 → 允许
  const keepRenamed = validateReplanDraft(
    draft([
      {
        title: '商品中心',
        description: '商品与明细',
        action: 'keep',
        existingModuleId: 'm-1',
        scope: ['商品明细', '商品档案']
      }
    ]),
    CURRENT
  )
  assert.deepEqual(keepRenamed.errors, [])

  const badAction = validateReplanDraft(draft([{ title: 'A', action: 'merge' }]), CURRENT)
  assert.ok(badAction.errors.some(error => error.includes('动作不合法')))
})

test('validateReplanDraft：合法草稿无错误、>8 warning、>50 错误、CRUD 标题 warning', () => {
  const valid = validateReplanDraft(
    draft([
      { title: '商品管理', description: '商品与明细', action: 'keep', existingModuleId: 'm-1', scope: ['商品档案', '商品明细'] },
      { title: '交易管理', description: '合并', action: 'create', existingModuleId: null, scope: ['商品', '订单'] }
    ]),
    CURRENT
  )
  assert.deepEqual(valid.errors, [])

  const many = validateReplanDraft(
    draft(Array.from({ length: 9 }, (_, index) => ({ title: `业务域${index}`, action: 'create', existingModuleId: null }))),
    CURRENT
  )
  assert.ok(many.warnings.some(warning => warning.includes('耗时')))

  const tooMany = validateReplanDraft(
    draft(Array.from({ length: 51 }, (_, index) => ({ title: `业务域${index}`, action: 'create', existingModuleId: null }))),
    CURRENT
  )
  assert.ok(tooMany.errors.some(error => error.includes('不能超过 50')))

  const crud = validateReplanDraft(draft([{ title: '新增商品', action: 'create', existingModuleId: null }]), CURRENT)
  assert.ok(crud.warnings.some(warning => warning.includes('CRUD')))
})
