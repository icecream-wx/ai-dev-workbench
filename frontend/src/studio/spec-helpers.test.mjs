import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  conflictPreview,
  cssSummary,
  discardConfirmText,
  draftPageRows,
  draftStatusLabel,
  draftVersionLabel,
  formatDateTime,
  modelKey,
  modelLabel,
  modelRefOf,
  previewUrlOf,
  publishConfirmText,
  specPageCount,
  validationItems,
  validationSummary
} from './spec-helpers.js'

const detail = {
  draft: {
    id: 'supplier-hub',
    name: '供应商管理模板',
    status: 'draft',
    publishedVersion: null,
    updatedAt: '2026-11-21T12:30:00.000Z'
  },
  spec: {
    pages: [
      { id: 'supplier-list', name: '供应商列表', kind: 'reference', source: { applicationType: 'operations-management', pageId: 'list' } },
      { id: 'supplier-form', name: '供应商表单', kind: 'contract', recipe: 'dialog-form' }
    ]
  },
  specError: null,
  packSummary: null,
  generation: null,
  validation: {
    ok: false,
    errors: [{ code: 'page-count', path: 'pages', message: '至少需要一个页面' }],
    warnings: [{ code: 'sample-entity-missing', path: 'pages[1]', message: '缺少 sampleEntity' }]
  }
}

test('页面清单：未生成时来自 spec（kind/source/recipe），生成后来自 pack', () => {
  const rows = draftPageRows(detail)
  assert.deepEqual(
    rows.map((row) => [row.id, row.kind, row.source, row.recipe, row.generated]),
    [
      ['supplier-list', 'reference', 'operations-management/list', '', false],
      ['supplier-form', 'contract', '', 'dialog-form', false]
    ]
  )
  assert.equal(specPageCount(detail), 2)

  const generated = draftPageRows({
    ...detail,
    packSummary: {
      id: 'supplier-hub',
      version: '1.0.0',
      revision: 1,
      pageCount: 1,
      pages: [{ id: 'p1', name: '页面一', kind: 'contract', recipe: 'detail', source: '' }]
    }
  })
  assert.deepEqual(generated.map((row) => [row.id, row.generated]), [['p1', true]])
})

test('页面清单：空 spec / 空 pack → 空数组（UI 显示引导文案）', () => {
  assert.deepEqual(draftPageRows({ draft: {}, spec: { pages: [] }, packSummary: null }), [])
  assert.deepEqual(draftPageRows(null), [])
  assert.equal(specPageCount(null), 0)
})

test('校验摘要：spec + generation + 生成响应合并，路径/来源保留', () => {
  const items = validationItems(
    {
      ...detail,
      generation: {
        generatedAt: '',
        specHash: '',
        warnings: [{ code: 'contract-soft', path: 'pages[1].contract.columns', message: '列字段缺失' }],
        errors: []
      }
    },
    { errors: [{ code: 'page-field-unknown', path: 'pages[1].form', message: '字段不存在' }], warnings: [] }
  )
  assert.equal(items.length, 4)
  assert.deepEqual(
    items.map((item) => [item.kind, item.source, item.path]),
    [
      ['error', 'spec', 'pages'],
      ['warning', 'spec', 'pages[1]'],
      ['warning', 'generation', 'pages[1].contract.columns'],
      ['error', 'generate', 'pages[1].form']
    ]
  )
  assert.deepEqual(validationSummary(items), { errors: 2, warnings: 2, ok: false })
})

test('CSS 摘要/冲突展示：来源、规则数、去重、最多 3 条', () => {
  const summary = cssSummary({
    css: { sources: ['operations-management', 'enterprise-application-platform'], rules: 501, deduped: 292, conflicts: ['a', 'b', 'c', 'd'] }
  })
  assert.deepEqual(summary.sources, ['operations-management', 'enterprise-application-platform'])
  assert.equal(summary.rules, 501)
  assert.equal(summary.deduped, 292)
  assert.deepEqual(conflictPreview(summary.conflicts), { shown: ['a', 'b', 'c'], more: 1, total: 4 })
  assert.deepEqual(cssSummary(null), { sources: [], rules: 0, deduped: 0, conflicts: [] })
})

test('状态/版本/时间/模型工具函数', () => {
  assert.equal(draftStatusLabel('draft'), '草稿')
  assert.equal(draftStatusLabel('published'), '已发布')
  assert.equal(draftVersionLabel({ status: 'draft', publishedVersion: null }), '草稿')
  assert.equal(draftVersionLabel({ status: 'published', publishedVersion: '1.0.2' }), 'v1.0.2')
  assert.equal(formatDateTime(''), '—')
  assert.equal(formatDateTime('not-a-date'), 'not-a-date')
  assert.match(formatDateTime('2026-11-21T12:30:05.000Z'), /^\d\d-\d\d \d\d:\d\d:\d\d$/)

  assert.equal(modelKey({ providerID: 'p', id: 'm' }), 'p/m')
  assert.equal(modelKey(null), '')
  assert.equal(modelLabel({ providerID: 'packycode-deepseek', modelID: 'deepseek-flash', name: 'DeepSeek Flash' }), 'DeepSeek Flash（packycode-deepseek）')
  assert.deepEqual(modelRefOf('p/m'), { providerID: 'p', id: 'm' })
  assert.equal(modelRefOf(''), null)
  assert.equal(modelRefOf('no-slash'), null)
})

test('预览 URL / 确认文案', () => {
  assert.equal(previewUrlOf('supplier-hub', 'supplier-form'), '/template-preview.html?draft=supplier-hub&page=supplier-form&embed=1')
  assert.equal(previewUrlOf('', 'x'), '')
  assert.match(publishConfirmText({ name: '供应商', status: 'draft', publishedVersion: null }), /首次发布为 1\.0\.0/)
  assert.match(publishConfirmText({ name: '供应商', status: 'published', publishedVersion: '1.0.1' }), /1\.0\.1/)
  assert.match(discardConfirmText({ name: '供应商', status: 'draft' }), /草稿目录会被删除/)
  assert.match(discardConfirmText({ name: '供应商', status: 'published' }), /已发布模板会保留/)
})
