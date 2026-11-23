import assert from 'node:assert/strict'
import test from 'node:test'
import { commandsForView, commandArgs, commandById } from './view-commands.js'

test('requirements 视图命令：更新需求（带模块）+ 检查一致性', () => {
  const commands = commandsForView('requirements')
  assert.deepEqual(
    commands.map(item => item.name),
    ['update-requirements', 'check-consistency']
  )
  assert.equal(commands[0].label, '更新需求')
  assert.equal(commands[0].args, 'module')
  assert.equal(commands[1].args, 'none')
})

test('design 视图命令：生成/更新设计（带模块）+ 检查一致性', () => {
  const commands = commandsForView('design')
  assert.deepEqual(
    commands.map(item => item.name),
    ['generate-design', 'check-consistency']
  )
  assert.equal(commands[0].label, '生成/更新设计')
  assert.equal(commandById('design', 'generate-design')?.args, 'module')
})

test('development 暂无命令；未知视图返回空数组', () => {
  assert.deepEqual(commandsForView('development'), [])
  assert.deepEqual(commandsForView('nope'), [])
  assert.equal(commandById('design', 'update-requirements'), null)
})

test('命令参数：module 类型取当前模块，其余为空', () => {
  const [update, consistency] = commandsForView('requirements')
  assert.equal(commandArgs(update, 'MOD-001'), 'MOD-001')
  assert.equal(commandArgs(consistency, 'MOD-001'), '')
  assert.equal(commandArgs(null, 'MOD-001'), '')
  assert.equal(commandArgs(update, null), '')
})
