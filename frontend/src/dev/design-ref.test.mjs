/**
 * 开发视图纯逻辑（D1 应用级）：设计参考计数、ui-check 状态、fidelity 文案。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  designRefCounts,
  designRefHint,
  designRefSummary,
  fidelityCheckLabel,
  fidelityEmptyText,
  fidelityStatusLabel,
  fidelityStatusTone,
  fidelitySummaryText,
  uiCheckHint,
  uiCheckLabel,
  uiCheckTone
} from './design-ref.js'

const ARTIFACTS = {
  requirement: { exists: true, epics: [{ id: 'EP-001', title: '商品', stories: [{ id: 'US-001', title: '列表' }] }] },
  entities: { entities: [{ id: 'goods' }, { id: 'category' }] },
  pages: { pageSets: [{ id: 'goods' }], pages: [{ id: 'goods-list' }, { id: 'goods-form' }] },
  uiCheck: { exists: true, file: 'docs/design/ui-check.md', status: 'skeleton' }
}

test('ui-check 标签/tone/hint', () => {
  assert.equal(uiCheckLabel('missing'), '未生成')
  assert.equal(uiCheckLabel('skeleton'), '已生成未填')
  assert.equal(uiCheckLabel('filled'), '已填')
  assert.equal(uiCheckTone('filled'), 'ok')
  assert.equal(uiCheckTone('skeleton'), 'warn')
  assert.equal(uiCheckTone('missing'), 'muted')
  assert.match(uiCheckHint('missing'), /自动生成/)
  assert.match(uiCheckHint('skeleton'), /实现前/)
  assert.equal(uiCheckHint('filled'), '')
})

test('designRefCounts：Epic/页面集/页面/实体 + ui-check', () => {
  const counts = designRefCounts(ARTIFACTS)
  assert.deepEqual(counts, {
    epicCount: 1,
    pageSetCount: 1,
    pageCount: 2,
    entityCount: 2,
    apiInterfaceCount: 0,
    apiExists: false,
    uiCheckStatus: 'skeleton',
    uiCheckFile: 'docs/design/ui-check.md'
  })
  const empty = designRefCounts(null)
  assert.equal(empty.epicCount, 0)
  assert.equal(empty.apiInterfaceCount, 0)
  assert.equal(empty.apiExists, false)
  assert.equal(empty.uiCheckStatus, 'missing')
})

test('designRefHint：无设计 / 有页面集无页面 / 正常', () => {
  assert.match(designRefHint(null), /暂无设计产物/)
  assert.match(designRefHint({ entities: { entities: [] }, pages: { pageSets: [{ id: 's' }], pages: [] } }), /还没有页面/)
  assert.equal(designRefHint(ARTIFACTS), '')
})

test('designRefSummary：设计系统摘要与回退', () => {
  const summary = designRefSummary({
    applicationType: { id: 'ops', name: '运营管理' },
    style: { id: 'data-cyan', name: '数据青' },
    pages: [{ id: 'a' }]
  })
  assert.deepEqual(summary, {
    hasDesignSystem: true,
    applicationTypeName: '运营管理',
    styleName: '数据青',
    pageCount: 1,
    blueprintRoot: 'docs/design/template'
  })
  const empty = designRefSummary(null)
  assert.equal(empty.hasDesignSystem, false)
  assert.equal(empty.pageCount, 0)
})

test('fidelity 文案：状态/检查项/空报告/摘要', () => {
  assert.equal(fidelityStatusLabel('pass'), '通过')
  assert.equal(fidelityStatusLabel('warn'), '有警告')
  assert.equal(fidelityStatusLabel('fail'), '有失败')
  assert.equal(fidelityStatusLabel(''), '未检查')
  assert.equal(fidelityStatusTone('warn'), 'warn')
  assert.equal(fidelityCheckLabel('fail'), '失败')
  assert.match(fidelityEmptyText({ empty: true }), /暂无设计/)
  assert.equal(fidelityEmptyText({ empty: false }), '')
  assert.equal(
    fidelitySummaryText({ empty: false, summary: { pass: 12, warn: 1, fail: 0 } }),
    '通过 12 · 警告 1 · 失败 0'
  )
})
