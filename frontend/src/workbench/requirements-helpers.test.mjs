import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CONTINUATION_TEXT,
  anchorId,
  applyHeadingAnchors,
  buildDocument,
  composerFixText,
  continuationText,
  mergeArtifactLines,
  moduleMeta,
  moveModuleOrder,
  needsContextBanner,
  recentSessions,
  sortModules
} from './requirements-helpers.js'

const modules = [
  { key: 'MOD-002', order: 2, title: '订单管理', file: 'docs/requirements/MOD-002-订单管理.md', template: 'builtin-prd', sections: [{}], errors: [] },
  { key: 'MOD-001', order: 1, title: '商品管理', file: 'docs/requirements/MOD-001-商品管理.md', template: 'builtin-prd-lite', sections: [{}, {}], errors: [{ path: 'title' }] },
  { key: 'MOD-003', order: 0, title: '缺 order', file: 'docs/requirements/MOD-003-缺order.md', template: '', sections: [], warnings: ['order 不是正整数'] }
]

test('sortModules：order 升序，缺失/非法 order 置底；不改原数组', () => {
  const sorted = sortModules(modules)
  assert.deepEqual(
    sorted.map(item => item.key),
    ['MOD-001', 'MOD-002', 'MOD-003']
  )
  assert.equal(modules[0].key, 'MOD-002', '不应原地修改')
})

test('moveModuleOrder：上/下移按新位置重排两模块 order；边界返回 null', () => {
  const up = moveModuleOrder(modules, 'MOD-002', -1)
  assert.deepEqual(up, {
    updates: [
      { key: 'MOD-002', order: 1 },
      { key: 'MOD-001', order: 2 }
    ]
  })
  const down = moveModuleOrder(modules, 'MOD-001', 1)
  assert.deepEqual(down, {
    updates: [
      { key: 'MOD-001', order: 2 },
      { key: 'MOD-002', order: 1 }
    ]
  })
  assert.equal(moveModuleOrder(modules, 'MOD-001', -1), null)
  assert.equal(moveModuleOrder(modules, 'MOD-003', 1), null)
  assert.equal(moveModuleOrder(modules, 'MOD-999', 1), null)
})

test('moveModuleOrder：order 重复时按位置重排，结果确定', () => {
  const duplicated = [
    { key: 'A', order: 1, file: 'a.md' },
    { key: 'B', order: 1, file: 'b.md' },
    { key: 'C', order: 1, file: 'c.md' }
  ]
  const plan = moveModuleOrder(duplicated, 'B', -1)
  assert.deepEqual(plan, {
    updates: [
      { key: 'B', order: 1 },
      { key: 'A', order: 2 }
    ]
  })
})

test('buildDocument：H1 + 章节（##/###）+ 空章节不产生空段；TOC 锚点稳定', () => {
  const module = {
    key: 'MOD-001',
    title: '商品管理',
    sections: [
      { key: 'a', title: '1. 背景与目标', level: 2, markdown: '卖货。' },
      { key: 'b', title: '1.1 子节', level: 3, markdown: '' },
      { key: 'c', title: '2. 验收', level: 2, markdown: '- 能下单' }
    ]
  }
  const doc = buildDocument(module)
  assert.match(doc.markdown, /^# 商品管理\n/)
  assert.match(doc.markdown, /\n## 1\. 背景与目标\n\n卖货。\n/)
  assert.match(doc.markdown, /\n### 1\.1 子节\n/)
  assert.match(doc.markdown, /\n## 2\. 验收\n\n- 能下单\n/)
  assert.equal(doc.markdown.includes('\n\n\n'), false)
  assert.deepEqual(
    doc.toc.map(item => item.id),
    [anchorId(0), anchorId(1), anchorId(2)]
  )
  assert.deepEqual(doc.toc.map(item => item.level), [2, 3, 2])
  assert.equal(buildDocument({ key: 'MOD-009', sections: [] }).markdown.trim(), '# MOD-009')
})

test('applyHeadingAnchors：按渲染顺序给 h2/h3 补 id（TOC 定位）', () => {
  const fake = elements => ({
    querySelectorAll: () => elements
  })
  const first = {}
  const second = {}
  applyHeadingAnchors(fake([first, second]), [{ id: 'sec-1' }, { id: 'sec-2' }])
  assert.equal(first.id, 'sec-1')
  assert.equal(second.id, 'sec-2')
  assert.doesNotThrow(() => applyHeadingAnchors(null, [{ id: 'x' }]))
})

test('mergeArtifactLines：errors + warnings 去重，含文件/字段/期望', () => {
  const lines = mergeArtifactLines(
    [
      { file: 'docs/design/MOD-001/design.json', path: 'entities', message: '类型应为 array', expected: 'array' },
      { file: 'docs/requirements/MOD-001-商品.md', path: 'module', message: '缺少 module' }
    ],
    ['order 不是正整数'],
    'docs/requirements/MOD-001-商品.md'
  )
  assert.equal(lines.length, 3)
  assert.match(lines[0], /design\.json · entities · 类型应为 array（期望：array）/)
  assert.match(lines[1], /缺少 module/)
  assert.match(lines[2], /警告 · order 不是正整数/)

  const deduped = mergeArtifactLines([{ file: 'a.md', path: '$', message: 'x' }, { file: 'a.md', path: '$', message: 'x' }], [])
  assert.deepEqual(deduped, ['a.md · $ · x'])
})

test('composerFixText：合并为一行并截断，不自动发送', () => {
  assert.equal(composerFixText(['a', 'b']), 'a；b')
  assert.equal(composerFixText([]), '')
  const long = composerFixText(['x'.repeat(700)], 10)
  assert.equal(long, `${'x'.repeat(10)}…`)
})

test('recentSessions：最近 N 个（活跃时间优先），带 label/active', () => {
  const list = recentSessions(
    [
      { id: '1', displayTitle: '最早', status: 'archived', createdAt: '2026-11-01T00:00:00.000Z' },
      { id: '2', displayTitle: '较新', status: 'active', lastActiveAt: '2026-11-03T00:00:00.000Z' },
      { id: '3', displayTitle: '中间', status: 'archived', updatedAt: '2026-11-02T00:00:00.000Z' },
      { id: '4', displayTitle: '第四', status: 'archived', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: '5', displayTitle: '第五', status: 'archived', createdAt: '2026-09-01T00:00:00.000Z' },
      { id: '6', displayTitle: '第六', status: 'archived', createdAt: '2026-08-01T00:00:00.000Z' }
    ],
    5
  )
  assert.equal(list.length, 5)
  assert.deepEqual(
    list.map(item => item.id),
    ['2', '3', '1', '4', '5']
  )
  assert.equal(list[0].active, true)
  assert.equal(list[0].label, '较新')
})

test('85% 文案：仅 danger 显示横幅；衔接文案确定且带模块', () => {
  assert.equal(needsContextBanner('danger'), true)
  assert.equal(needsContextBanner('warn'), false)
  assert.equal(needsContextBanner(undefined), false)
  assert.equal(continuationText(''), CONTINUATION_TEXT)
  const text = continuationText('MOD-001')
  assert.match(text, /已归档/)
  assert.match(text, /docs\/requirements/)
  assert.match(text, /当前模块：MOD-001/)
})

test('moduleMeta：章节数/模板/错误/警告', () => {
  assert.deepEqual(moduleMeta(modules[1]), { sections: 2, errors: 1, warnings: 0, template: 'builtin-prd-lite' })
  assert.deepEqual(moduleMeta(modules[2]), { sections: 0, errors: 0, warnings: 1, template: '' })
  assert.deepEqual(moduleMeta(null), { sections: 0, errors: 0, warnings: 0, template: '' })
})
