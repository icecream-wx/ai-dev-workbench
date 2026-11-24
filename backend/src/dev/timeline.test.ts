import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProgress, buildSteps, contextUsedTokens, diffLines, displayUserText, normalizeMessages, scrubText, truncateText } from './timeline'

function messages(): unknown[] {
  return [
    {
      id: 'u1',
      type: 'user',
      text: '实现客户列表',
      time: { created: 1000 }
    },
    {
      id: 'a1',
      type: 'assistant',
      content: [
        { type: 'text', text: '我先看一下现有代码。' },
        { type: 'tool', id: 't1', name: 'read', state: { status: 'completed', input: { path: 'E:/app/src/a.ts' }, content: [{ type: 'text', text: 'export const a = 1' }], time: { created: 1100, completed: 1200 } } }
      ],
      time: { created: 1100 }
    },
    {
      id: 'a2',
      type: 'assistant',
      content: [
        {
          type: 'tool',
          id: 't2',
          name: 'write',
          state: {
            status: 'completed',
            input: { path: 'E:/app/src/CustomerList.vue', content: '<template>list</template>' },
            time: { created: 1300, completed: 1400 }
          }
        }
      ],
      time: { created: 1300 }
    },
    {
      id: 'a3',
      type: 'assistant',
      content: [
        {
          type: 'tool',
          id: 't3',
          name: 'shell',
          state: {
            status: 'completed',
            input: { command: 'npm run test' },
            content: [{ type: 'text', text: 'tests passed' }],
            metadata: { exit: 0 },
            time: { created: 1500, completed: 1800 }
          }
        }
      ],
      time: { created: 1500 }
    },
    { id: 'i1', type: 'idle', outcome: 'succeeded', time: { created: 1900 } }
  ]
}

test('buildSteps 按阶段聚合工具并归一化目标/diff/输出', () => {
  const { steps } = buildSteps(messages(), { appDir: 'E:/app', now: 2000 })
  assert.equal(steps.length, 3)
  assert.equal(steps[0].phase, 'analysis')
  assert.equal(steps[0].items[0].name, 'read')
  assert.equal(steps[0].items[0].target, 'src/a.ts')
  assert.equal(steps[1].phase, 'implement')
  assert.equal(steps[1].items[0].diff?.mode, 'create')
  assert.equal(steps[1].items[0].diff?.path, 'src/CustomerList.vue')
  assert.equal(steps[2].phase, 'test')
  assert.equal(steps[2].items[0].output.exit, 0)
  assert.match(steps[2].items[0].output.text, /tests passed/)
})

test('buildProgress 返回状态/统计/消息', () => {
  const progress = buildProgress({
    info: { outcome: 'running', time: { created: 1000, busy: 1 }, tokens: { input: 10, output: 20, cache: { read: 3 } } },
    messages: messages(),
    appDir: 'E:/app',
    now: 2000
  })
  // P7-6c：末条 idle 消息是权威收尾记录，优先于滞后的 outcome
  assert.equal(progress.status, 'succeeded')
  assert.equal(progress.stats.toolTotal, 3)
  assert.equal(progress.stats.tokens.input, 10)
  assert.equal(progress.stats.tokens.cacheRead, 3)
  assert.equal(progress.steps.length, 3)
  assert.equal(progress.messages[0].type, 'user')
  assert.equal(progress.messages[1].text, '我先看一下现有代码。')
})

test('buildProgress：无 idle 消息时按 outcome/busy 判定，不误报完成', () => {
  const running = buildProgress({
    info: { outcome: 'running', time: { created: 1000, busy: 1 } },
    messages: messages().filter(message => (message as { type?: string }).type !== 'idle'),
    now: 2000
  })
  assert.equal(running.status, 'running')

  const interrupted = buildProgress({
    info: { outcome: 'running', time: { created: 1000, busy: 1 } },
    messages: [...messages(), { id: 'i2', type: 'idle', outcome: 'interrupted', time: { created: 2000 } }],
    now: 3000
  })
  assert.equal(interrupted.status, 'interrupted')
  assert.equal(interrupted.endedAt, 2000)
})

test('diffLines 统计增删并保留上下文', () => {
  const diff = diffLines('a\nb\nc', 'a\nB\nc')
  assert.equal(diff.added, 1)
  assert.equal(diff.removed, 1)
  assert.match(diff.text, /-b/)
  assert.match(diff.text, /\+B/)
})

test('scrubText / truncateText 处理凭据与长度', () => {
  assert.doesNotMatch(scrubText('Authorization: Basic abcdefghijklmnop'), /abcdefghijklmnop/)
  assert.doesNotMatch(scrubText('<configValue key="C3p0-Password">test-password-value</configValue>'), /test-password-value/)
  assert.match(scrubText('<configValue key="C3p0-Password">test-password-value</configValue>'), /\*\*\*/)
  assert.doesNotMatch(scrubText('spring.datasource.password=test-password-value'), /test-password-value/)
  assert.doesNotMatch(scrubText('{"password":"test-password-value"}'), /test-password-value/)
  assert.doesNotMatch(scrubText('<password>test-password-value</password>'), /test-password-value/)
  const truncated = truncateText('x'.repeat(100), 10, 'tail')
  assert.equal(truncated.text.length, 10)
  assert.equal(truncated.truncated, true)
})

test('write diff 输出也会脱敏', () => {
  const { steps } = buildSteps([
    {
      id: 'a1',
      type: 'assistant',
      content: [{
        type: 'tool',
        id: 't1',
        name: 'write',
        state: {
          status: 'completed',
          input: { path: '/app/config.xml', content: '<configValue key="C3p0-Password">test-password-value</configValue>' },
          time: { created: 1, completed: 2 }
        }
      }],
      time: { created: 1 }
    }
  ])
  assert.doesNotMatch(steps[0].items[0].diff?.text ?? '', /test-password-value/)
})

test('I-09a：上下文 used 取最新 assistant 的 input + cache.read + cache.write', () => {
  const withTokens = [
    { id: 'u1', type: 'user', text: '实现客户列表', time: { created: 1 } },
    { id: 'a1', type: 'assistant', content: [], tokens: { input: 900, output: 10, cache: { read: 100, write: 0 } }, time: { created: 2 } },
    { id: 'a2', type: 'assistant', content: [], tokens: { input: 1200, output: 10, cache: { read: 300, write: 50 } }, time: { created: 3 } }
  ]
  assert.equal(contextUsedTokens(withTokens), 1550)

  const progress = buildProgress({
    // 会话聚合 tokens 是累计值，不用于上下文百分比
    info: { time: { created: 1 }, tokens: { input: 999999, output: 888 } },
    messages: withTokens,
    now: 10
  })
  assert.equal(progress.context.used, 1550)
  assert.equal(progress.stats.tokens.input, 999999)
  assert.equal(progress.context.limit, null)
  assert.equal(progress.context.percent, null)
  assert.equal(progress.context.level, 'unknown')
})

test('I-09a：没有 assistant 消息时 used=0；最新 assistant 无 tokens 时回退上一条', () => {
  assert.equal(contextUsedTokens([{ id: 'u', type: 'user', text: 'x' }]), 0)
  assert.equal(contextUsedTokens([]), 0)
  assert.equal(
    contextUsedTokens([
      { id: 'a1', type: 'assistant', tokens: { input: 10, cache: { read: 5, write: 0 } } },
      { id: 'a2', type: 'assistant', content: [] }
    ]),
    15
  )
})

test('I-09a：compaction 消息归一化为轻量系统提示，不当 assistant 文本', () => {
  const normalized = normalizeMessages([
    { id: 'u1', type: 'user', text: '继续', time: { created: 1 } },
    { id: 'c1', type: 'compaction', status: 'completed', reason: 'manual', time: { created: 2 } },
    { id: 'a1', type: 'assistant', content: [{ type: 'text', text: '好' }], time: { created: 3 } }
  ])
  const compaction = normalized.find(message => message.type === 'compaction')
  assert.ok(compaction, '缺少 compaction 消息')
  assert.equal(compaction.kind, 'compaction')
  assert.equal(compaction.text, '上下文已压缩')
  assert.equal(compaction.created, 2)
  assert.equal(normalized.filter(message => message.type === 'assistant').length, 1)
  assert.doesNotMatch(JSON.stringify(compaction), /SUMMARY-BODY/)
})

test('I-09a：空会话 compact（opencode 返回 failed）显示未执行原因，不谎报已压缩', () => {
  const normalized = normalizeMessages([
    {
      id: 'c1',
      type: 'compaction',
      status: 'failed',
      reason: 'manual',
      error: { type: 'compaction.unavailable', message: 'Nothing to compact yet' },
      time: { created: 2 }
    }
  ])
  const notice = normalized.find(message => message.type === 'compaction')
  assert.ok(notice, '缺少 compaction 消息')
  assert.equal(notice.kind, 'compaction-failed')
  assert.equal(notice.text, '上下文压缩未执行：没有可压缩的上下文')
  // 未知错误原因也保留（脱敏、截断）
  const other = normalizeMessages([
    { id: 'c2', type: 'compaction', status: 'failed', error: { message: 'password=secret-value boom' }, time: { created: 3 } }
  ])[0]
  assert.equal(other.kind, 'compaction-failed')
  assert.match(other.text ?? '', /上下文压缩未执行/)
  assert.doesNotMatch(other.text ?? '', /secret-value/)
})

test('displayUserText：带视图框架的 user 消息只保留用户原文', () => {
  const framed =
    '当前视图：开发。\n' +
    '需求产物：docs/requirements/requirements.md（单文档）。\n' +
    '产物是工作区代码与 docs/ 下的需求/设计文件。\n' +
    '先读 AGENTS.md、docs/requirements/ 与 docs/design/ 下相关产物，以及现有代码，再动手实现。\n\n' +
    '用户消息：\n给 backend/README.md 补一节运行说明。'
  assert.equal(displayUserText(framed), '给 backend/README.md 补一节运行说明。')

  // 只认第一个 marker：用户原文里再次出现“用户消息：”也完整保留
  const nested = `当前视图：需求。\n需求产物：docs/requirements/requirements.md（单文档）。\n\n用户消息：\n第一行\n用户消息：\n第二段`
  assert.equal(displayUserText(nested), '第一行\n用户消息：\n第二段')

  // 归一化后的 user 消息同样只显示原文
  const normalized = normalizeMessages([
    { id: 'u1', type: 'user', text: framed, time: { created: 1 } }
  ])[0]
  assert.equal(normalized.text, '给 backend/README.md 补一节运行说明。')
})

test('displayUserText：不带框架 / 无 marker 的 user 消息原样返回', () => {
  assert.equal(displayUserText('直接输入的一句话'), '直接输入的一句话')
  assert.equal(displayUserText('当前视图：开发。\n只有框架，没有用户消息标记。'), '当前视图：开发。\n只有框架，没有用户消息标记。')
  assert.equal(displayUserText(''), '')
})

test('system 消息即使包含“用户消息：”也不裁剪', () => {
  const systemText = '当前视图：开发。\n用户消息：\n系统注入的说明'
  const normalized = normalizeMessages([{ id: 's1', type: 'system', text: systemText, time: { created: 1 } }])[0]
  assert.equal(normalized.text, systemText)
})

test('displayUserText：用户原文的换行/特殊字符完整保留', () => {
  const original = '第一行\n- 第二行：包含 <tag> 与 "引号" & 符号\n\n最后一行'
  assert.equal(displayUserText(`当前视图：开发。\n产物路径：docs/\n\n用户消息：\n${original}`), original)
  const normalized = normalizeMessages([
    { id: 'u2', type: 'user', text: `当前视图：设计。\n\n用户消息：\n${original}`, time: { created: 2 } }
  ])[0]
  assert.equal(normalized.text, original)
})

