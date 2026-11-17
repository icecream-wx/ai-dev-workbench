import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cancelModuleSummary,
  changeScopeModuleIds,
  changeSetHasNewModules,
  changeSetModuleLabel,
  defaultChangeSetModuleIds,
  hasModuleScope,
  isChangeScopeComplete,
  isModuleInChangeScope,
  isNewChangeSetModule,
  moduleScopeChipLabel,
  moduleVersionRange,
  validateChangeSetModuleSelection
} from './module-scope.js'

const MODULES = [
  { id: 'm1', moduleKey: 'MOD-001', title: '商品管理', archived: false },
  { id: 'm2', moduleKey: 'MOD-002', title: '订单管理', archived: false },
  { id: 'm3', moduleKey: 'MOD-003', title: '归档模块', archived: true }
]

const CS = {
  seq: 2,
  modules: [
    {
      moduleId: 'm1',
      moduleKey: 'MOD-001',
      title: '商品管理',
      reqBaseVersion: 1,
      reqCurrentVersion: 3,
      designBaseVersion: 2,
      designCurrentVersion: 4
    },
    {
      moduleId: 'm2',
      moduleKey: 'MOD-002',
      title: '订单管理',
      reqBaseVersion: 5,
      reqCurrentVersion: 5,
      designBaseVersion: 6,
      designCurrentVersion: 7
    }
  ]
}

test('默认全选：只包含未归档模块', () => {
  assert.deepEqual(defaultChangeSetModuleIds(MODULES), ['m1', 'm2'])
  assert.deepEqual(defaultChangeSetModuleIds([]), [])
  assert.deepEqual(defaultChangeSetModuleIds(undefined), [])
})

test('模块选择校验：空/重复/归档/不存在', () => {
  assert.equal(validateChangeSetModuleSelection(MODULES, ['m1', 'm2']).ok, true)
  assert.match(validateChangeSetModuleSelection(MODULES, []).error, /至少选择/)
  assert.match(validateChangeSetModuleSelection(MODULES, ['m1', 'm1']).error, /重复/)
  assert.match(validateChangeSetModuleSelection(MODULES, ['m3']).error, /已归档/)
  assert.match(validateChangeSetModuleSelection(MODULES, ['ghost']).error, /不存在/)
})

test('范围判断：无范围视为全部可选；未包含模块只读判断', () => {
  assert.deepEqual(changeScopeModuleIds(CS), ['m1', 'm2'])
  assert.deepEqual(changeScopeModuleIds({ modules: [] }), [])
  assert.equal(hasModuleScope(CS), true)
  assert.equal(hasModuleScope({ seq: 2 }), false)
  assert.equal(isModuleInChangeScope(CS, 'm1'), true)
  assert.equal(isModuleInChangeScope(CS, 'm2'), true)
  assert.equal(isModuleInChangeScope(CS, 'm9'), false)
  assert.equal(isModuleInChangeScope({ seq: 2 }, 'm9'), true)
  assert.equal(isModuleInChangeScope(CS, ''), true)
  assert.equal(isChangeScopeComplete(CS, ['m1', 'm2']), true)
  assert.equal(isChangeScopeComplete(CS, ['m1', 'm2', 'm3']), false)
  assert.equal(isChangeScopeComplete({ seq: 2 }, ['m1']), true)
})

test('范围/版本区间/角色/取消文案', () => {
  assert.equal(changeSetModuleLabel(CS), '2 个模块：MOD-001 商品管理、MOD-002 订单管理')
  assert.equal(changeSetModuleLabel({ modules: [] }), '全部模块')
  assert.equal(moduleVersionRange(CS.modules[0]), '需求 v1→v3 · 设计 v2→v4')
  assert.equal(moduleVersionRange({}), '需求 —→— · 设计 —→—')
  assert.equal(moduleScopeChipLabel(CS, 'm1'), '本次变更')
  assert.equal(moduleScopeChipLabel(CS, 'm9'), '未包含')
  assert.equal(moduleScopeChipLabel({ seq: 2 }, 'm1'), '')
  assert.match(cancelModuleSummary(CS), /将恢复 2 个模块：MOD-001 商品管理、MOD-002 订单管理/)
  assert.match(cancelModuleSummary({ modules: [] }), /恢复需求\/设计\/应用/)
})

test('MF-M5-1：变更中新增模块（无基线）版本区间/标签/取消文案', () => {
  const newModule = {
    moduleId: 'm9',
    moduleKey: 'MOD-009',
    title: '支付管理',
    reqBaseVersion: null,
    reqCurrentVersion: 1,
    designBaseVersion: null,
    designCurrentVersion: null
  }
  assert.equal(isNewChangeSetModule(newModule), true)
  assert.equal(isNewChangeSetModule(CS.modules[0]), false)
  assert.equal(isNewChangeSetModule(null), false)
  assert.equal(moduleVersionRange(newModule, { seq: 1 }), '需求 v1 · 设计 —（首次基线）')
  assert.equal(changeSetHasNewModules({ modules: [...CS.modules, newModule] }), true)
  assert.equal(changeSetHasNewModules(CS), false)
  assert.equal(moduleVersionRange(newModule), '变更中新增')
  const summary = cancelModuleSummary({ modules: [...CS.modules, newModule] })
  assert.match(summary, /支付管理/)
  assert.match(summary, /变更中新增的模块将被归档（内容保留，可之后恢复）/)
  assert.doesNotMatch(cancelModuleSummary(CS), /将被归档/)
})
