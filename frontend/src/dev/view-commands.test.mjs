import assert from 'node:assert/strict'
import test from 'node:test'
import { commandsForView, commandArgs, commandById } from './view-commands.js'

test('requirements 视图命令：更新需求（无参数）+ 检查一致性', () => {
  const commands = commandsForView('requirements')
  assert.deepEqual(
    commands.map(item => item.name),
    ['update-requirements', 'check-consistency']
  )
  assert.equal(commands[0].label, '更新需求')
  assert.equal(commands[0].args, 'none')
  assert.equal(commands[1].args, 'none')
})

test('design 视图命令：生成/更新设计 + 生成接口设计 + 检查一致性（无参数）', () => {
  const commands = commandsForView('design')
  assert.deepEqual(
    commands.map(item => item.name),
    ['generate-design', 'generate-api-design', 'check-consistency']
  )
  assert.equal(commands[1].label, '补/更新接口设计')
  assert.equal(commandById('design', 'generate-api-design')?.args, 'none')
})

test('development 暂无命令；未知视图返回空数组', () => {
  assert.deepEqual(commandsForView('development'), [])
  assert.deepEqual(commandsForView('nope'), [])
  assert.equal(commandById('design', 'update-requirements'), null)
})

test('命令参数：去模块后所有命令为空', () => {
  const [update, consistency] = commandsForView('requirements')
  assert.equal(commandArgs(update), '')
  assert.equal(commandArgs(consistency), '')
  assert.equal(commandArgs(null), '')
})
