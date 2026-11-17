/**
 * 设计模块 UI 纯函数单测（M4）
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  coverageRateLabel,
  designMissingImageTotal,
  designModuleProgress,
  designModuleStatusLabel,
  designModuleStorageKey,
  designModuleVersionLabel,
  isCrossModuleEntityId,
  otherModuleEntityGroups,
  readStoredDesignModuleId,
  resolveDesignModuleId,
  templateSwitchUsable,
  uncoveredStoriesLabel,
  writeStoredDesignModuleId
} from './design-module-helpers.js'

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    dump: () => Object.fromEntries(map)
  }
}

const modules = [
  { id: 'm1', moduleKey: 'MOD-001', title: '商品管理', archived: false, required: true },
  { id: 'm2', moduleKey: 'MOD-002', title: '订单管理', archived: false, required: true },
  { id: 'm3', moduleKey: 'MOD-003', title: '归档模块', archived: true, required: true }
]

test('设计模块选择：stored → 默认 → 第一个未归档；失效/归档回退并说明原因', () => {
  assert.deepEqual(resolveDesignModuleId(modules, { storedId: 'm2', defaultModuleId: 'm1' }), {
    moduleId: 'm2',
    reason: ''
  })
  assert.deepEqual(resolveDesignModuleId(modules, { defaultModuleId: 'm2' }), { moduleId: 'm2', reason: '' })
  assert.deepEqual(resolveDesignModuleId(modules, {}), { moduleId: 'm1', reason: '' })
  assert.deepEqual(resolveDesignModuleId(modules, { storedId: 'gone' }), { moduleId: 'm1', reason: 'stored-missing' })
  assert.deepEqual(resolveDesignModuleId(modules, { storedId: 'm3' }), { moduleId: 'm1', reason: 'stored-archived' })
  assert.deepEqual(resolveDesignModuleId([], { storedId: 'm1' }), { moduleId: null, reason: 'none' })
  // 只有归档模块
  assert.deepEqual(resolveDesignModuleId([modules[2]], {}), { moduleId: null, reason: 'none' })
})

test('设计模块 localStorage：按应用独立 key，读写/清除', () => {
  const storage = fakeStorage()
  assert.equal(designModuleStorageKey('app-a'), 'workbench:app:app-a:designModuleId')
  assert.equal(readStoredDesignModuleId(storage, 'app-a'), '')
  writeStoredDesignModuleId(storage, 'app-a', 'm2')
  assert.equal(readStoredDesignModuleId(storage, 'app-a'), 'm2')
  assert.equal(readStoredDesignModuleId(storage, 'app-b'), '')
  writeStoredDesignModuleId(storage, 'app-a', '')
  assert.equal(readStoredDesignModuleId(storage, 'app-a'), '')
  // 不可用 storage 不抛错
  assert.equal(readStoredDesignModuleId(null, 'app-a'), '')
})

test('设计进度：只统计未归档；必选未确认即 pending；全部确认才 true', () => {
  const partial = designModuleProgress([
    { moduleId: 'm1', moduleKey: 'MOD-001', title: '商品', status: 'confirmed', required: true },
    { moduleId: 'm2', moduleKey: 'MOD-002', title: '订单', status: 'draft', required: true },
    { moduleId: 'm3', moduleKey: 'MOD-003', title: '可选', status: 'draft', required: false }
  ])
  assert.equal(partial.total, 3)
  assert.equal(partial.confirmed, 1)
  assert.equal(partial.requiredTotal, 2)
  assert.equal(partial.requiredConfirmed, 1)
  assert.equal(partial.pending.length, 1)
  assert.equal(partial.pending[0].moduleId, 'm2')
  assert.equal(partial.allRequiredConfirmed, false)

  const done = designModuleProgress([
    { moduleId: 'm1', status: 'confirmed', required: true },
    { moduleId: 'm3', status: 'draft', required: false }
  ])
  assert.equal(done.allRequiredConfirmed, true)
  assert.deepEqual(done.pending, [])

  assert.deepEqual(designModuleProgress(null), {
    total: 0,
    confirmed: 0,
    requiredTotal: 0,
    requiredConfirmed: 0,
    pending: [],
    allRequiredConfirmed: false
  })
})

test('缺图统计：累加缺失图片，忽略非法值', () => {
  assert.equal(
    designMissingImageTotal([{ missingImages: 2 }, { missingImages: 0 }, { missingImages: '3' }, {}, { missingImages: -1 }]),
    5
  )
  assert.equal(designMissingImageTotal(null), 0)
})

test('跨模块实体分组：按模块分组、保持顺序、只含其它模块实体', () => {
  const groups = otherModuleEntityGroups([
    { id: 'e1', name: '客户', moduleId: 'm2', moduleKey: 'MOD-002', moduleTitle: '订单管理' },
    { id: 'e2', name: '订单', moduleId: 'm2', moduleKey: 'MOD-002', moduleTitle: '订单管理' },
    { id: 'e3', name: '库存', moduleId: 'm3', moduleKey: 'MOD-003', moduleTitle: '库存管理' }
  ])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].label, 'MOD-002 · 订单管理（跨模块）')
  assert.deepEqual(groups[0].options.map(option => option.value), ['e1', 'e2'])
  assert.equal(groups[0].options[0].crossModule, true)
  assert.deepEqual(groups[1].options.map(option => option.value), ['e3'])
  assert.deepEqual(otherModuleEntityGroups(null), [])
})

test('跨模块目标判断 & 原型模板切换预览可用性', () => {
  const other = [{ id: 'e1', moduleId: 'm2' }]
  assert.equal(isCrossModuleEntityId(other, 'e1'), true)
  assert.equal(isCrossModuleEntityId(other, 'local'), false)
  assert.equal(isCrossModuleEntityId(other, null), false)

  assert.equal(
    templateSwitchUsable({ canApply: true, modules: [{ moduleId: 'm1' }], blockedModules: [] }),
    true
  )
  assert.equal(
    templateSwitchUsable({ canApply: false, modules: [{ moduleId: 'm1' }], blockedModules: [] }),
    false
  )
  assert.equal(
    templateSwitchUsable({ canApply: true, modules: [{ moduleId: 'm1' }], blockedModules: [{ moduleId: 'm1' }] }),
    false
  )
  assert.equal(templateSwitchUsable({ canApply: true, modules: [], blockedModules: [] }), false)
  assert.equal(templateSwitchUsable(null), false)
})

test('模块状态/版本标签', () => {
  assert.equal(designModuleStatusLabel({ status: 'confirmed' }), '已确认')
  assert.equal(designModuleStatusLabel({ status: 'review' }), '待审核')
  assert.equal(designModuleStatusLabel({ status: 'draft' }), '草稿')
  assert.equal(designModuleStatusLabel(null), '—')
  assert.equal(designModuleVersionLabel({ version: 3 }), 'v3')
  assert.equal(designModuleVersionLabel({ version: 0 }), '—')
  assert.equal(designModuleVersionLabel({}), '—')
})

test('M5 总览：覆盖率与未覆盖 Story 展示', () => {
  assert.equal(coverageRateLabel(0.75), '75%')
  assert.equal(coverageRateLabel(0), '0%')
  assert.equal(coverageRateLabel(1), '100%')
  assert.equal(coverageRateLabel(1.2), '100%')
  assert.equal(coverageRateLabel(-0.2), '0%')
  assert.equal(coverageRateLabel('abc'), '—')
  assert.equal(uncoveredStoriesLabel([{ id: 'STORY-001', title: '创建订单' }]), 'STORY-001 创建订单')
  assert.equal(
    uncoveredStoriesLabel([
      { id: 'S1', title: 'A' },
      { id: 'S2', title: 'B' },
      { id: 'S3', title: 'C' },
      { id: 'S4', title: 'D' }
    ]),
    'S1 A、S2 B、S3 C 等 4 个'
  )
  assert.equal(uncoveredStoriesLabel([]), '')
  assert.equal(uncoveredStoriesLabel(null), '')
})
