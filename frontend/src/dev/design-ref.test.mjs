import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildModuleOptions,
  designRefHint,
  designRefSummary,
  fidelityCheckLabel,
  fidelityEmptyText,
  fidelityStatusLabel,
  fidelityStatusTone,
  fidelitySummaryText,
  moduleOptionOf,
  pickModuleKey,
  uiCheckHint,
  uiCheckLabel,
  uiCheckTone
} from './design-ref.js'

const artifacts = {
  modules: [
    { key: 'MOD-001', title: '商品管理', order: 1, file: 'docs/requirements/MOD-001-商品管理.md' },
    { key: 'MOD-002', title: '订单管理', order: 2, file: 'docs/requirements/MOD-002-订单管理.md' }
  ],
  designs: [
    { module: 'MOD-001', title: '商品管理', uiCheck: { status: 'skeleton', file: 'docs/design/MOD-001/ui-check.md' } },
    { module: 'MOD-003', title: '仅设计模块', uiCheck: { status: 'filled', file: 'docs/design/MOD-003/ui-check.md' } }
  ]
}

test('buildModuleOptions：需求模块 + 设计模块合并，带 ui-check 状态', () => {
  const options = buildModuleOptions(artifacts)
  assert.deepEqual(
    options.map(option => [option.key, option.hasDesign, option.uiCheckStatus]),
    [
      ['MOD-001', true, 'skeleton'],
      ['MOD-002', false, 'missing'],
      ['MOD-003', true, 'filled']
    ]
  )
  assert.equal(moduleOptionOf(options, 'MOD-001')?.title, '商品管理')
  assert.equal(moduleOptionOf(options, 'MOD-404'), null)
  assert.equal(options[2].uiCheckFile, 'docs/design/MOD-003/ui-check.md')
})

test('pickModuleKey：保存优先；单设计模块/单模块自动选中', () => {
  const options = buildModuleOptions(artifacts)
  assert.equal(pickModuleKey(options, 'MOD-002', ''), 'MOD-002', '保存值有效时优先')
  assert.equal(pickModuleKey(options, 'MOD-404', 'MOD-001'), 'MOD-001', '保存失效时回退上次')
  assert.equal(pickModuleKey(options, '', ''), '', '多个设计模块不自动选择')

  const single = buildModuleOptions({ modules: [{ key: 'MOD-009', title: '唯一', order: 1 }], designs: [] })
  assert.equal(pickModuleKey(single, '', ''), 'MOD-009', '单模块自动选中')

  const oneDesign = buildModuleOptions({
    modules: [{ key: 'MOD-001', title: 'A', order: 1 }, { key: 'MOD-002', title: 'B', order: 2 }],
    designs: [{ module: 'MOD-002', title: 'B', uiCheck: { status: 'missing' } }]
  })
  assert.equal(pickModuleKey(oneDesign, '', ''), 'MOD-002', '唯一设计模块自动选中')
  assert.equal(pickModuleKey([], 'MOD-001', ''), '', '无模块为空')
})

test('uiCheckLabel/Tone 与设计参考摘要', () => {
  assert.equal(uiCheckLabel('missing'), '未生成')
  assert.equal(uiCheckLabel('skeleton'), '已生成未填')
  assert.equal(uiCheckLabel('filled'), '已填')
  assert.equal(uiCheckTone('filled'), 'ok')
  assert.equal(uiCheckTone('skeleton'), 'warn')
  assert.equal(uiCheckTone('missing'), 'muted')
  const summary = designRefSummary({
    applicationType: { id: 'enterprise-application-platform', name: '企业级应用管理平台' },
    style: { id: 'platform-blue', name: '平台蓝白' },
    pages: [{}, {}, {}]
  })
  assert.equal(summary.hasDesignSystem, true)
  assert.equal(summary.applicationTypeName, '企业级应用管理平台')
  assert.equal(summary.styleName, '平台蓝白')
  assert.equal(summary.pageCount, 3)
  assert.equal(summary.blueprintRoot, 'docs/design/template')

  const empty = designRefSummary({ applicationType: null, style: null, pages: [] })
  assert.equal(empty.hasDesignSystem, false)
  assert.equal(empty.applicationTypeName, '')
  assert.equal(empty.styleName, '')
  assert.equal(designRefSummary(null).hasDesignSystem, false)
})

test('uiCheckHint：未生成提示自动生成；已生成未填提示先填；已填为空', () => {
  assert.equal(
    uiCheckHint('missing'),
    '未生成：在开发视图选中模块并发送首条开发消息后自动生成；实现前先填。'
  )
  assert.match(uiCheckHint('missing'), /自动生成/)
  assert.match(uiCheckHint('skeleton'), /实现前/)
  assert.equal(uiCheckHint('skeleton'), '已生成未填：先填「实现前」对照表再写代码；未填不阻断。')
  assert.doesNotMatch(uiCheckHint('skeleton'), /自动生成/)
  assert.equal(uiCheckHint('filled'), '')
  assert.equal(uiCheckHint(''), '')
  assert.equal(uiCheckHint(undefined), '')
})

test('designRefHint：无模块/无设计时提示先做设计', () => {
  assert.match(designRefHint([]), /请先在设计视图/)
  assert.match(designRefHint([{ key: 'MOD-001', hasDesign: false }]), /还没有设计/)
  assert.equal(designRefHint([{ key: 'MOD-001', hasDesign: true }]), '')
})

test('fidelity 状态映射：总体/单项/空报告', () => {
  assert.equal(fidelityStatusLabel('pass'), '通过')
  assert.equal(fidelityStatusLabel('warn'), '有警告')
  assert.equal(fidelityStatusLabel('fail'), '有失败')
  assert.equal(fidelityStatusLabel(''), '未检查')
  assert.equal(fidelityStatusTone('pass'), 'ok')
  assert.equal(fidelityStatusTone('warn'), 'warn')
  assert.equal(fidelityStatusTone('fail'), 'fail')
  assert.equal(fidelityStatusTone(''), 'muted')
  assert.equal(fidelityCheckLabel('pass'), '通过')
  assert.equal(fidelityCheckLabel('warn'), '警告')
  assert.equal(fidelityCheckLabel('fail'), '失败')
  assert.equal(fidelityCheckLabel('unknown'), '未知')
})

test('fidelitySummaryText/EmptyText：计数与空设计原因', () => {
  const report = {
    empty: false,
    module: 'MOD-001',
    summary: { pass: 8, warn: 3, fail: 1, total: 12, status: 'fail' },
    checks: []
  }
  assert.equal(fidelitySummaryText(report), '通过 8 · 警告 3 · 失败 1')
  assert.equal(fidelitySummaryText(null), '')
  assert.equal(fidelityEmptyText(report), '')

  const noDesign = { empty: true, reason: 'no-design', module: null, summary: { pass: 0, warn: 2, fail: 0 } }
  assert.match(fidelityEmptyText(noDesign), /暂无设计/)
  assert.match(fidelitySummaryText(noDesign), /暂无设计/)

  const missing = { empty: true, reason: 'design-missing', module: 'MOD-404', summary: { pass: 0, warn: 0, fail: 1 } }
  assert.match(fidelityEmptyText(missing), /MOD-404/)
  assert.match(fidelitySummaryText(missing), /MOD-404/)
})
