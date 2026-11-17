import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NO_ACTIVE_CHANGE_SET_HINT,
  appChipLabel,
  appListStatusLabel,
  canGenerateHandoff,
  canStartChangeSet,
  changeSetBaseLabel,
  changeSetCountsLabel,
  changeSetScopeLabel,
  changeSetStageLabel,
  changeSetStatusLabel,
  changeSetVersionRange
} from './labels.js'

test('应用头部 chip：初始开发 / 变更 #N / 已完成 / 开发中', () => {
  assert.equal(appChipLabel({ status: 'development', activeChangeSet: { seq: 1, status: 'development' } }), '初始开发 · 开发')
  assert.equal(appChipLabel({ status: 'design', activeChangeSet: { seq: 2, status: 'design' } }), '变更 #2 · 设计')
  assert.equal(appChipLabel({ status: 'requirements', activeChangeSet: { seq: 2, status: 'requirements' } }), '变更 #2 · 需求')
  assert.equal(
    appChipLabel({
      status: 'requirements',
      activeChangeSet: { seq: 2, status: 'requirements', modules: [{ moduleId: 'm1' }, { moduleId: 'm2' }] }
    }),
    '变更 #2 · 需求 · 2 模块'
  )
  assert.equal(
    appChipLabel({ status: 'requirements', activeChangeSet: { seq: 3, status: 'requirements', modules: [{ moduleId: 'm1' }] } }),
    '变更 #3 · 需求'
  )
  assert.equal(appChipLabel({ status: 'completed', activeChangeSet: null }), '已完成')
  assert.equal(appChipLabel({ status: 'development', activeChangeSet: null }), '开发中')
  assert.equal(appChipLabel({ status: 'design', activeChangeSet: null }), '设计中')
  assert.equal(appChipLabel({ status: 'requirements', activeChangeSet: null }), '需求中')
  assert.equal(appChipLabel(null), '')
})

test('首页应用行：变更中 #N · 阶段 / 已完成 / 开发中', () => {
  assert.equal(appListStatusLabel({ status: 'design', activeChangeSet: { seq: 2, status: 'design' } }), '变更中 #2 · 设计')
  assert.equal(appListStatusLabel({ status: 'development', activeChangeSet: { seq: 1, status: 'development' } }), '初始开发 · 开发')
  assert.equal(appListStatusLabel({ status: 'completed', activeChangeSet: null }), '已完成')
  assert.equal(appListStatusLabel({ status: 'development', activeChangeSet: null }), '开发中')
})

test('发起变更/生成交接包门禁', () => {
  assert.equal(canStartChangeSet({ status: 'development', activeChangeSet: null, handoff: { version: 1 } }), true)
  assert.equal(canStartChangeSet({ status: 'completed', activeChangeSet: null, handoff: { version: 1 } }), true)
  assert.equal(canStartChangeSet({ status: 'completed', activeChangeSet: { seq: 2 }, handoff: { version: 1 } }), false)
  assert.equal(canStartChangeSet({ status: 'design', activeChangeSet: null, handoff: { version: 1 } }), false)

  assert.equal(canGenerateHandoff({ status: 'design', activeChangeSet: { seq: 2 }, handoff: { version: 1 } }), true)
  assert.equal(canGenerateHandoff({ status: 'design', activeChangeSet: null, handoff: null }), true)
  assert.equal(canGenerateHandoff({ status: 'completed', activeChangeSet: null, handoff: { version: 2 } }), false)
  assert.equal(canGenerateHandoff(null), false)
  assert.match(NO_ACTIVE_CHANGE_SET_HINT, /请先发起变更/)
})

test('状态/范围文案', () => {
  assert.equal(changeSetStageLabel('requirements'), '需求')
  assert.equal(changeSetStageLabel('development'), '开发')
  assert.equal(changeSetStageLabel('completed'), '已完成')
  assert.equal(changeSetStatusLabel('cancelled'), '已取消')
  assert.equal(changeSetScopeLabel('design'), '仅设计')
  assert.equal(changeSetScopeLabel('requirements'), '需求+设计')
})

test('版本范围与计数（缺失版本用 —）', () => {
  assert.equal(
    changeSetVersionRange({
      baseRequirementsVersion: 10,
      currentRequirementsVersion: 12,
      baseDesignVersion: 5,
      currentDesignVersion: 7,
      baseHandoffVersion: 1,
      currentHandoffVersion: 2
    }),
    '需求 v10→v12 · 设计 v5→v7 · 交接包 v1→v2'
  )
  assert.equal(
    changeSetVersionRange({
      baseRequirementsVersion: null,
      currentRequirementsVersion: null,
      baseDesignVersion: 5,
      currentDesignVersion: null,
      baseHandoffVersion: null,
      currentHandoffVersion: null
    }),
    '需求 —→— · 设计 v5→— · 交接包 —→—'
  )
  assert.equal(changeSetCountsLabel({ summary: { counts: { added: 2, modified: 1, removed: 0 } } }), '新增 2 / 修改 1 / 删除 0')
  assert.equal(changeSetCountsLabel({ summary: { counts: { added: 0, modified: 0, removed: 0 } } }), '无差异')
  assert.equal(changeSetCountsLabel({ summary: null }), '')
})

test('阶段内基线标识', () => {
  assert.equal(changeSetBaseLabel({ seq: 1, baseRequirementsVersion: null, baseDesignVersion: null }), '初始开发')
  assert.equal(
    changeSetBaseLabel({ seq: 2, baseRequirementsVersion: 10, baseDesignVersion: 5 }),
    '变更 #2（基于 需求 v10 / 设计 v5）'
  )
  assert.equal(changeSetBaseLabel({ seq: 3, baseRequirementsVersion: null, baseDesignVersion: 4 }), '变更 #3（基于 设计 v4）')
  assert.equal(changeSetBaseLabel(null), '')
})
