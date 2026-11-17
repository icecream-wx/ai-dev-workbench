import assert from 'node:assert/strict'
import test from 'node:test'
import { scaleBadge, scaleCountsLabel, scaleHint, scaleTriggerLabels } from './handoff-scale.js'

function scaleOf(overrides = {}) {
  return {
    level: 'large',
    suggested: true,
    counts: { stories: 12, pages: 14, epics: 3, pageSets: 4 },
    textBytes: 123456,
    thresholds: { stories: 10, pages: 12, textBytes: 102400 },
    triggers: [
      { metric: 'stories', value: 12, threshold: 10 },
      { metric: 'pages', value: 14, threshold: 12 }
    ],
    phaseCount: 4,
    derivedFrom: 'epics',
    ...overrides
  }
}

test('scaleCountsLabel：12 Story / 14 页面 / 121 KB（KB 向上取整）', () => {
  assert.equal(scaleCountsLabel(scaleOf()), '12 Story / 14 页面 / 121 KB')
  assert.equal(scaleCountsLabel(scaleOf({ textBytes: 102400 })), '12 Story / 14 页面 / 100 KB')
  assert.equal(scaleCountsLabel(scaleOf({ textBytes: 101376 })), '12 Story / 14 页面 / 99 KB')
  assert.equal(scaleCountsLabel(scaleOf({ textBytes: 0 })), '12 Story / 14 页面 / 0 KB')
  assert.equal(scaleCountsLabel(scaleOf({ textBytes: 1 })), '12 Story / 14 页面 / 1 KB')
  assert.equal(scaleCountsLabel(scaleOf({ textBytes: 1025 })), '12 Story / 14 页面 / 2 KB')
})

test('scaleCountsLabel：缺 counts/旧数据回退', () => {
  assert.equal(scaleCountsLabel(null), '')
  assert.equal(scaleCountsLabel(undefined), '')
  assert.equal(scaleCountsLabel({}), '— Story / — 页面 / —')
  assert.equal(scaleCountsLabel({ counts: { stories: 3 }, textBytes: 4000 }), '3 Story / — 页面 / 4 KB')
})

test('scaleTriggerLabels：按 triggers 生成，未知 metric 忽略', () => {
  assert.deepEqual(scaleTriggerLabels(scaleOf()), ['Story ≥ 10', '页面 ≥ 12'])
  assert.deepEqual(
    scaleTriggerLabels(
      scaleOf({ triggers: [{ metric: 'textBytes', value: 120000, threshold: 102400 }] })
    ),
    ['文本 ≥ 100 KB']
  )
  assert.deepEqual(
    scaleTriggerLabels(
      scaleOf({
        triggers: [
          { metric: 'stories', value: 10, threshold: 10 },
          { metric: 'unknown', value: 1, threshold: 1 },
          { metric: 'pages', value: 12, threshold: 12 }
        ]
      })
    ),
    ['Story ≥ 10', '页面 ≥ 12']
  )
  assert.deepEqual(scaleTriggerLabels(null), [])
  assert.deepEqual(scaleTriggerLabels(scaleOf({ triggers: undefined })), [])
})

test('scaleBadge：仅 suggested=true 显示；normal/null 返回 null', () => {
  assert.deepEqual(scaleBadge(scaleOf()), { label: '建议分阶段', tone: 'warn' })
  assert.equal(scaleBadge(scaleOf({ suggested: false, level: 'normal' })), null)
  assert.equal(scaleBadge(null), null)
  assert.equal(scaleBadge(undefined), null)
})

test('scaleHint：large 给出规模与建议，normal/旧数据为空串', () => {
  assert.equal(
    scaleHint(scaleOf()),
    '交接包较大：12 Story / 14 页面 / 121 KB（Story ≥ 10、页面 ≥ 12）；建议按 04-PLAN.md 分阶段推进，也可单会话完成。'
  )
  assert.equal(
    scaleHint(scaleOf({ triggers: [{ metric: 'pages', value: 12, threshold: 12 }], counts: { stories: 4, pages: 12 }, textBytes: 2048 })),
    '交接包较大：4 Story / 12 页面 / 2 KB（页面 ≥ 12）；建议按 04-PLAN.md 分阶段推进，也可单会话完成。'
  )
  assert.equal(scaleHint(scaleOf({ suggested: false, level: 'normal' })), '')
  assert.equal(scaleHint(null), '')
})

test('text-only 触发：counts 很小但文本 ≥100KB 仍显示建议', () => {
  const scale = scaleOf({
    counts: { stories: 2, pages: 2 },
    textBytes: 102400,
    triggers: [{ metric: 'textBytes', value: 102400, threshold: 102400 }]
  })
  assert.deepEqual(scaleTriggerLabels(scale), ['文本 ≥ 100 KB'])
  assert.deepEqual(scaleBadge(scale), { label: '建议分阶段', tone: 'warn' })
  assert.match(scaleHint(scale), /2 Story \/ 2 页面 \/ 100 KB/)
})
