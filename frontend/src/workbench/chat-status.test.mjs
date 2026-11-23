import assert from 'node:assert/strict'
import test from 'node:test'
import { nextPending, pendingLabel, pendingTestId, runningToolLine, shouldShowReasoning } from './chat-status.js'

test('占位状态：发送 → awaiting；首个内容 → 清除', () => {
  const awaiting = nextPending(null, { type: 'send' })
  assert.deepEqual(awaiting, { phase: 'awaiting', message: '' })
  assert.equal(nextPending(awaiting, { type: 'content' }), null)
  assert.equal(nextPending(awaiting, { type: 'reset' }), null)
  // 没有占位时收到内容不应凭空创建占位
  assert.equal(nextPending(null, { type: 'content' }), null)
})

test('占位状态：失败/中断必须替换，不能停留在“思考中”', () => {
  const awaiting = nextPending(null, { type: 'send' })
  const failed = nextPending(awaiting, { type: 'failed', message: '模型超时' })
  assert.equal(failed.phase, 'failed')
  assert.equal(failed.message, '模型超时')
  assert.equal(pendingLabel(failed), '本轮失败：模型超时')
  assert.equal(pendingLabel(nextPending(awaiting, { type: 'failed' })), '本轮失败，可在下方继续追问。')

  const interrupted = nextPending(awaiting, { type: 'interrupted' })
  assert.equal(interrupted.phase, 'interrupted')
  assert.equal(pendingLabel(interrupted), '已中止本轮生成。')
  // 失败/中断后再次发送回到 awaiting
  assert.equal(nextPending(failed, { type: 'send' }).phase, 'awaiting')
})

test('占位 testid 与文案（chat / dev 前缀）', () => {
  assert.equal(pendingTestId(nextPending(null, { type: 'send' })), 'chat-pending')
  assert.equal(pendingTestId(nextPending(null, { type: 'failed' })), 'chat-pending-failed')
  assert.equal(pendingTestId(nextPending(null, { type: 'interrupted' })), 'chat-pending-interrupted')
  assert.equal(pendingTestId(nextPending(null, { type: 'send' }), 'dev'), 'dev-pending')
  assert.equal(pendingTestId(null), '')
  assert.equal(pendingLabel(nextPending(null, { type: 'send' })), '思考中…')
})

test('reasoning 展示条件：非空才显示', () => {
  assert.equal(shouldShowReasoning({ reasoning: '先读工作区' }), true)
  assert.equal(shouldShowReasoning({ reasoning: '   ' }), false)
  assert.equal(shouldShowReasoning({ reasoning: null }), false)
  assert.equal(shouldShowReasoning(null), false)
})

test('运行中工具行：取最后一项；无工具为空', () => {
  const steps = [
    { items: [{ name: 'read', target: 'a.md' }] },
    { items: [{ name: 'write', target: 'docs/requirements/MOD-001.md' }] }
  ]
  assert.equal(runningToolLine(steps), '正在使用 write · docs/requirements/MOD-001.md')
  assert.equal(runningToolLine([]), '')
  assert.equal(runningToolLine(null), '')
  assert.equal(runningToolLine([{ items: [] }]), '')
})
