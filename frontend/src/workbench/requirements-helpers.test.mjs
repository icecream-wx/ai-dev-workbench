import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CONTINUATION_TEXT,
  anchorId,
  applyHeadingAnchors,
  askableSections,
  buildDocument,
  composerFixText,
  continuationText,
  mergeArtifactLines,
  needsContextBanner,
  outlineKind,
  recentSessions,
  requirementSummary,
  sectionAskFocus,
  sectionAskPrompt
} from './requirements-helpers.js'

const requirement = {
  exists: true,
  title: '商品管理应用',
  template: 'builtin-prd',
  file: 'docs/requirements/requirements.md',
  sections: [
    { key: 'h2-1', title: '1. 背景与目标', level: 2, markdown: '卖货。' },
    { key: 'h3-2', title: 'EP-001 商品管理', level: 3, markdown: '目标。' },
    { key: 'h4-3', title: 'US-001 商品列表', level: 4, markdown: '' },
    { key: 'h2-4', title: '2. 验收', level: 2, markdown: '- 能下单' }
  ],
  epics: [{ id: 'EP-001', title: '商品管理', stories: [{ id: 'US-001', title: '商品列表' }] }]
}

test('outlineKind：Epic/Story 稳定 ID 识别', () => {
  assert.deepEqual(outlineKind('EP-001 商品管理'), { id: 'EP-001', title: '商品管理', kind: 'epic' })
  assert.deepEqual(outlineKind('US-012 商品列表'), { id: 'US-012', title: '商品列表', kind: 'story' })
  assert.equal(outlineKind('1. 背景与目标'), null)
  assert.equal(outlineKind(''), null)
})

test('buildDocument：H1 + 章节（##/###/####）+ 空章节不产生空段；TOC 锚点稳定且标 Epic/Story', () => {
  const doc = buildDocument(requirement)
  assert.match(doc.markdown, /^# 商品管理应用\n/)
  assert.match(doc.markdown, /\n## 1\. 背景与目标\n\n卖货。\n/)
  assert.match(doc.markdown, /\n### EP-001 商品管理\n/)
  assert.match(doc.markdown, /\n#### US-001 商品列表\n/)
  assert.equal(doc.markdown.includes('\n\n\n'), false)
  assert.deepEqual(
    doc.toc.map(item => item.id),
    [anchorId(0), anchorId(1), anchorId(2), anchorId(3)]
  )
  assert.deepEqual(doc.toc.map(item => item.level), [2, 3, 4, 2])
  assert.equal(doc.toc[1].kind, 'epic')
  assert.equal(doc.toc[1].key, 'EP-001')
  assert.equal(doc.toc[2].kind, 'story')
  assert.equal(buildDocument({ title: '', sections: [] }).markdown.trim(), '# 需求文档')
})

test('applyHeadingAnchors：按渲染顺序给 h2/h3/h4 补 id（TOC 定位）', () => {
  const fake = elements => ({ querySelectorAll: () => elements })
  const first = {}
  const second = {}
  applyHeadingAnchors(fake([first, second]), [{ id: 'sec-1' }, { id: 'sec-2' }])
  assert.equal(first.id, 'sec-1')
  assert.equal(second.id, 'sec-2')
  assert.doesNotThrow(() => applyHeadingAnchors(null, [{ id: 'x' }]))
})

test('requirementSummary：文档标题/Epic/Story/章节数', () => {
  assert.deepEqual(requirementSummary(requirement), {
    exists: true,
    title: '商品管理应用',
    epicCount: 1,
    storyCount: 1,
    sectionCount: 4
  })
  assert.deepEqual(requirementSummary(null), {
    exists: false,
    title: '',
    epicCount: 0,
    storyCount: 0,
    sectionCount: 0
  })
})

test('mergeArtifactLines：errors + warnings 去重，含文件/字段/期望', () => {
  const lines = mergeArtifactLines(
    [
      { file: 'docs/design/pages.json', path: 'pageSets', message: '类型应为 array', expected: 'array' },
      { file: 'docs/requirements/requirements.md', path: 'title', message: '缺少 title' }
    ],
    ['文档还没有 Epic'],
    'docs/requirements/requirements.md'
  )
  assert.equal(lines.length, 3)
  assert.match(lines[0], /pages\.json · pageSets · 类型应为 array（期望：array）/)
  assert.match(lines[1], /缺少 title/)
  assert.match(lines[2], /警告 · 文档还没有 Epic/)

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

test('85% 文案：仅 danger 显示横幅；衔接文案确定（单文档）', () => {
  assert.equal(needsContextBanner('danger'), true)
  assert.equal(needsContextBanner('warn'), false)
  assert.equal(needsContextBanner(undefined), false)
  const text = continuationText()
  assert.equal(text, CONTINUATION_TEXT)
  assert.match(text, /已归档/)
  assert.match(text, /docs\/requirements\/requirements\.md/)
})

test('askableSections：只取 h2/h3（h4 Story 不显示「问 AI」）', () => {
  const doc = buildDocument(requirement)
  const ids = askableSections(doc.toc).map(item => item.id)
  assert.deepEqual(ids, [anchorId(0), anchorId(1), anchorId(3)])
  assert.deepEqual(askableSections(null), [])
  assert.deepEqual(askableSections([{ id: 'x', level: 4 }]), [])
})

test('sectionAskFocus：章节隐藏上下文（含 Epic key）与空值兜底', () => {
  const epic = sectionAskFocus({ id: 'sec-2', title: 'EP-001 商品管理', level: 3, key: 'EP-001', kind: 'epic' })
  assert.deepEqual(epic, {
    kind: 'requirements-section',
    anchor: 'sec-2',
    title: 'EP-001 商品管理',
    level: 3,
    key: 'EP-001'
  })
  const plain = sectionAskFocus({ id: 'sec-1', title: '1. 目标', level: 2 })
  assert.equal(plain.kind, 'requirements-section')
  assert.equal('key' in plain, false)
  assert.equal(sectionAskFocus(null), null)
  assert.equal(sectionAskFocus({ title: '无锚点' }), null)
})

test('sectionAskPrompt：默认提问带章节标题；空标题用「本章节」', () => {
  const text = sectionAskPrompt({ id: 'sec-1', title: '1. 目标', level: 2 })
  assert.match(text, /请基于「1\. 目标」这一章节/)
  assert.match(text, /验收标准/)
  assert.match(sectionAskPrompt({ title: '' }), /请基于「本章节」/)
})
