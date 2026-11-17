import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DESIGN_VERSION_SOURCE_LABELS,
  designVersionChangeSetLabel,
  designVersionSourceLabel
} from './version-labels.js'

test('设计版本来源标签：confirm/ai/template-change/sync/rollback/restore/manual', () => {
  assert.deepEqual(Object.keys(DESIGN_VERSION_SOURCE_LABELS).sort(), [
    'ai',
    'confirm',
    'manual',
    'restore',
    'rollback',
    'sync',
    'template-change'
  ])
  assert.equal(designVersionSourceLabel('confirm'), '确认设计')
  assert.equal(designVersionSourceLabel('ai'), 'AI 生成')
  assert.equal(designVersionSourceLabel('template-change'), '模板切换')
  assert.equal(designVersionSourceLabel('sync'), '同步设计输入')
  assert.equal(designVersionSourceLabel('rollback'), '版本回滚')
  assert.equal(designVersionSourceLabel('restore'), '变更取消恢复')
  assert.equal(designVersionSourceLabel('manual'), '手动保存')
})

test('未知/缺失来源回退“手动保存”', () => {
  assert.equal(designVersionSourceLabel('legacy'), '手动保存')
  assert.equal(designVersionSourceLabel(undefined), '手动保存')
  assert.equal(designVersionSourceLabel(null), '手动保存')
})

test('变更单标签：有 seq 显示 变更 #N（可选标题），无 seq 为空串', () => {
  assert.equal(designVersionChangeSetLabel(3, '客户等级'), '变更 #3 · 客户等级')
  assert.equal(designVersionChangeSetLabel(2, ''), '变更 #2')
  assert.equal(designVersionChangeSetLabel(null, '客户等级'), '')
  assert.equal(designVersionChangeSetLabel(0, ''), '')
})
