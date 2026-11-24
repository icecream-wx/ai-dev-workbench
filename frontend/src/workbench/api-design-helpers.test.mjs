import assert from 'node:assert/strict'
import test from 'node:test'
import {
  apiDesignEntityGaps,
  apiDesignFixSummary,
  apiDesignFixText,
  apiDesignIssueLines,
  apiDesignSummary,
  apiDesignSummaryText,
  apiDesignUncoveredActions
} from './api-design-helpers.js'

const ARTIFACT = {
  exists: true,
  file: 'docs/design/api-design.md',
  markdown: '# 商品管理应用 · 接口设计\n',
  interfaces: [
    { id: 'goods.list', method: 'GET', path: '/api/goods', operation: 'list' },
    { id: 'goods.create', method: 'POST', path: '/api/goods', operation: 'create' }
  ],
  byEpic: [{ epic: 'EP-001 商品管理', count: 2 }],
  errors: [{ file: 'docs/design/api-design.md', path: '接口索引[0]', message: '路径必须以 /api 开头', expected: '/api/...' }],
  warnings: ['覆盖矩阵.3.1：页面动作未覆盖：goods-list / export'],
  coverage: {
    pageActions: [
      { pageSet: 'EP-001 商品管理', page: 'goods-list', action: 'create', interface: 'goods.create', covered: true },
      { pageSet: 'EP-001 商品管理', page: 'goods-list', action: 'export', interface: '', covered: false }
    ],
    entities: [{ entity: 'goods', list: 'goods.list', detail: '', create: 'goods.create', update: '', delete: '', missing: ['detail', 'update', 'delete'] }]
  }
}

test('apiDesignSummary：接口/Epic/覆盖/校验计数', () => {
  const summary = apiDesignSummary(ARTIFACT)
  assert.equal(summary.exists, true)
  assert.equal(summary.interfaceCount, 2)
  assert.equal(summary.epicCount, 1)
  assert.equal(summary.pageActionCovered, 1)
  assert.equal(summary.pageActionTotal, 2)
  assert.equal(summary.entityCovered, 0)
  assert.equal(summary.entityTotal, 1)
  assert.equal(summary.errorCount, 1)
  assert.equal(summary.warningCount, 1)

  const empty = apiDesignSummary(null)
  assert.equal(empty.exists, false)
  assert.equal(empty.interfaceCount, 0)
  assert.equal(empty.errorCount, 0)
})

test('apiDesignSummaryText：未生成/正常/校验摘要', () => {
  assert.equal(apiDesignSummaryText(null), '接口设计未生成')
  const text = apiDesignSummaryText(ARTIFACT)
  assert.match(text, /接口 2 · Epic 1/)
  assert.match(text, /页面动作覆盖 1\/2/)
  assert.match(text, /校验 1 错 \/ 1 警/)
  assert.match(apiDesignSummaryText({ ...ARTIFACT, errors: [], warnings: [] }), /校验通过/)
})

test('未覆盖动作/实体缺口：上限与结构', () => {
  assert.deepEqual(apiDesignUncoveredActions(ARTIFACT), [
    { page: 'goods-list', action: 'export', pageSet: 'EP-001 商品管理' }
  ])
  assert.deepEqual(apiDesignEntityGaps(ARTIFACT), [
    { entity: 'goods', missing: ['detail', 'update', 'delete'] }
  ])
  assert.deepEqual(apiDesignUncoveredActions(null), [])
})

test('issue lines / fix 文本：包含文件/路径/期望，未发送语义由调用方保证', () => {
  const lines = apiDesignIssueLines(ARTIFACT)
  assert.equal(lines.length, 2)
  assert.match(lines[0], /api-design\.md · 接口索引\[0\] · 路径必须以 \/api 开头（期望：\/api\/\.\.\.）/)
  assert.match(lines[1], /警告 · 覆盖矩阵\.3\.1/)
  const fix = apiDesignFixText(ARTIFACT)
  assert.match(fix, /修复接口设计 docs\/design\/api-design\.md/)
  assert.match(fix, /路径必须以 \/api 开头/)
  assert.equal(apiDesignFixText({ ...ARTIFACT, errors: [], warnings: [] }), '')
  assert.ok(apiDesignFixText({ ...ARTIFACT, warnings: ['x'.repeat(2000)] }, 50).length <= 51)
})

test('apiDesignFixSummary：警告减少/清零/仍有问题/无变化', () => {
  assert.equal(apiDesignFixSummary({ errorCount: 0, warningCount: 6 }, { errorCount: 0, warningCount: 2 }), '修复完成：警告 6 → 2')
  assert.equal(apiDesignFixSummary({ errorCount: 0, warningCount: 6 }, { errorCount: 0, warningCount: 0 }), '修复完成：问题已清零（原 6 个）')
  assert.equal(apiDesignFixSummary({ errorCount: 0, warningCount: 0 }, { errorCount: 0, warningCount: 0 }), '修复完成：校验通过')
  assert.equal(apiDesignFixSummary({ errorCount: 0, warningCount: 6 }, { errorCount: 0, warningCount: 6 }), '修复结束，仍有 6 个警告')
  assert.equal(apiDesignFixSummary({ errorCount: 1, warningCount: 2 }, { errorCount: 1, warningCount: 1 }), '修复结束，仍有 1 个错误、1 个警告')
  assert.equal(apiDesignFixSummary(ARTIFACT, { errors: [], warnings: ['a'] }), '修复完成：问题 2 → 1')
  assert.equal(apiDesignFixSummary(null, null), '修复完成：校验通过')
})
