import assert from 'node:assert/strict'
import test from 'node:test'
import {
  contextDetail,
  contextHint,
  contextLabel,
  contextLevel,
  contextNeedsCompact,
  contextPercent,
  contextTitle,
  formatTokenCount
} from './dev-health.js'

test('formatTokenCount：k/M 缩写与边界', () => {
  assert.equal(formatTokenCount(0), '0')
  assert.equal(formatTokenCount(999), '999')
  assert.equal(formatTokenCount(1000), '1k')
  assert.equal(formatTokenCount(65000), '65k')
  assert.equal(formatTokenCount(65500), '65.5k')
  assert.equal(formatTokenCount(1048576), '1.05M')
  assert.equal(formatTokenCount(1000000), '1M')
  assert.equal(formatTokenCount(-1), '—')
  assert.equal(formatTokenCount(null), '—')
  assert.equal(formatTokenCount(undefined), '—')
  assert.equal(formatTokenCount(Number.NaN), '—')
})

test('contextLevel：0 / 59.9% / 60% / 85% / 100% / null', () => {
  assert.equal(contextLevel(0), 'ok')
  assert.equal(contextLevel(0.599), 'ok')
  assert.equal(contextLevel(0.6), 'warn')
  assert.equal(contextLevel(0.62), 'warn')
  assert.equal(contextLevel(0.849), 'warn')
  assert.equal(contextLevel(0.85), 'danger')
  assert.equal(contextLevel(1), 'danger')
  assert.equal(contextLevel(null), 'unknown')
  assert.equal(contextLevel(undefined), 'unknown')
})

test('contextPercent：优先服务端 percent，缺失时用 used/limit 估算', () => {
  assert.equal(contextPercent({ used: 65000, limit: 1048576, percent: 0.62 }), 62)
  assert.equal(contextPercent({ used: 65000, limit: 100000 }), 65)
  assert.equal(contextPercent({ used: 65000, limit: null }), null)
  assert.equal(contextPercent(null), null)
})

test('contextLabel：百分比 + used/limit；limit 缺失只显示 token；无数据为 —', () => {
  assert.equal(contextLabel({ used: 65000, limit: 1050000, percent: 0.62 }), '上下文 62% (65k / 1.05M)')
  assert.equal(contextLabel({ used: 65000, limit: null, percent: null }), '上下文 65k')
  assert.equal(contextLabel({ used: 0, limit: 1048576, percent: 0 }), '上下文 0% (0 / 1.05M)')
  assert.equal(contextLabel(null), '上下文 —')
  assert.equal(contextLabel(undefined), '上下文 —')
})

test('contextDetail / contextTitle：右侧会话卡与 tooltip', () => {
  assert.equal(contextDetail({ used: 65000, limit: 1050000, percent: 0.62 }), '62% · 65k / 1.05M')
  assert.equal(contextDetail({ used: 65000, limit: null, percent: null }), '65k')
  assert.equal(contextDetail(null), '—')
  assert.match(contextTitle({ used: 65000, limit: 1050000 }), /65k \/ 上限 1.05M/)
  assert.match(contextTitle({ used: 65000, limit: null }), /上限未知/)
  assert.match(contextTitle(null), /不可用/)
})

test('contextHint / contextNeedsCompact：60% 建议、85% 强烈建议', () => {
  assert.equal(contextHint({ used: 100, limit: 1000, percent: 0.1, level: 'ok' }), '')
  assert.equal(
    contextHint({ used: 620, limit: 1000, percent: 0.62, level: 'warn' }),
    '上下文使用 62%，建议压缩上下文（可能丢失细节，由你确认）'
  )
  assert.equal(
    contextHint({ used: 880, limit: 1000, percent: 0.88, level: 'danger' }),
    '上下文使用 88%，强烈建议压缩上下文'
  )
  assert.equal(contextHint({ used: 65, limit: null, percent: null, level: 'unknown' }), '')
  assert.equal(contextNeedsCompact({ level: 'warn' }), true)
  assert.equal(contextNeedsCompact({ level: 'danger' }), true)
  assert.equal(contextNeedsCompact({ level: 'ok' }), false)
  assert.equal(contextNeedsCompact(null), false)
})
