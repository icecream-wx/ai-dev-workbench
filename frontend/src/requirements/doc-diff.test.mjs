import assert from 'node:assert/strict'
import test from 'node:test'
import { allApplicableSelected, buildApplyPayload, diffDocSections, hydrateSuggestion, lineDiff, trimSuggestion } from './doc-diff.js'

function section(sectionKey, title, markdown, extra = {}) {
  return { sectionKey, title, level: 2, kind: 'markdown', markdown, required: false, position: 0, updatedAt: '', ...extra }
}

test('diffDocSections：标记 added/modified/unchanged/removed 与标题变化', () => {
  const current = [
    section('problem', '问题与机会', '原始问题', { required: true }),
    section('goals', '目标与成功指标', '原始目标'),
    section('scope', '范围与约束', ''),
    section('custom-note', '补充说明', '会被删除')
  ]
  const preview = [
    section('problem', '问题与机会（改）', '修改后的问题', { required: true }),
    section('goals', '目标与成功指标', '原始目标'),
    section('scope', '范围与约束', ''),
    section('custom-new', '全新章节', '新增内容')
  ]
  const diff = diffDocSections(current, preview, [{ sectionKey: 'custom-note', title: '补充说明', required: false }])
  const byKey = new Map(diff.sections.map(entry => [entry.sectionKey, entry]))

  assert.equal(byKey.get('problem').change, 'modified')
  assert.equal(byKey.get('problem').titleChanged, true)
  assert.equal(byKey.get('problem').titleBefore, '问题与机会')
  assert.ok(byKey.get('problem').lineDiff.some(line => line.type === '-' && line.text === '原始问题'))
  assert.ok(byKey.get('problem').lineDiff.some(line => line.type === '+' && line.text === '修改后的问题'))
  assert.equal(byKey.get('goals').change, 'unchanged')
  assert.equal(byKey.get('scope').change, 'unchanged')
  assert.equal(byKey.get('custom-new').change, 'added')
  assert.equal(byKey.get('custom-note').change, 'removed')
  assert.equal(byKey.get('custom-note').required, false)
  assert.deepEqual(diff.counts, { added: 1, modified: 1, removed: 1, unchanged: 2 })
})

test('lineDiff：LCS 输出上下文/增/删行', () => {
  const diff = lineDiff('第一行\n第二行\n第三行', '第一行\n第二行（改）\n第三行')
  assert.deepEqual(
    diff.map(line => `${line.type}${line.text}`),
    [' 第一行', '-第二行', '+第二行（改）', ' 第三行']
  )
})

test('lineDiff：超大文本截断并标注', () => {
  const before = Array.from({ length: 600 }, (_, index) => `旧行 ${index}`).join('\n')
  const after = Array.from({ length: 600 }, (_, index) => `新行 ${index}`).join('\n')
  const diff = lineDiff(before, after)
  assert.ok(diff.length <= 804)
  assert.equal(diff[diff.length - 1].text, '…（diff 已截断）')
})

test('buildApplyPayload：默认只提交新增/修改章节，不写未变章节', () => {
  const entries = diffDocSections(
    [section('problem', '问题', '旧'), section('goals', '目标', '稳定')],
    [section('problem', '问题', '新'), section('goals', '目标', '稳定'), section('custom-new', '新增', '内容')]
  ).sections
  const payload = buildApplyPayload(entries)
  assert.deepEqual(payload.sections.map(item => item.id), ['problem', 'custom-new'])
  assert.deepEqual(payload.removeSectionKeys, [])
  assert.equal(payload.title, undefined)
})

test('buildApplyPayload：按勾选只提交选中章节 + 可删除章节', () => {
  const entries = diffDocSections(
    [section('problem', '问题', '旧'), section('custom-note', '说明', '删除')],
    [section('problem', '问题', '新'), section('custom-more', '再新增', '内容')],
    [{ sectionKey: 'custom-note', title: '说明', required: false }]
  ).sections
  const payload = buildApplyPayload(entries, {
    selectedKeys: ['custom-more'],
    removedKeys: ['custom-note'],
    includeTitle: true,
    title: '新标题'
  })
  assert.deepEqual(payload.sections.map(item => item.id), ['custom-more'])
  assert.deepEqual(payload.removeSectionKeys, ['custom-note'])
  assert.equal(payload.title, '新标题')
})

test('buildApplyPayload：必填章节不可删除（warning，不进入 removeSectionKeys）', () => {
  const entries = [
    {
      sectionKey: 'custom-req',
      title: '必填自定义',
      level: 2,
      kind: 'markdown',
      markdown: '',
      required: true,
      change: 'removed'
    }
  ]
  const payload = buildApplyPayload(entries, { removedKeys: ['custom-req'] })
  assert.deepEqual(payload.removeSectionKeys, [])
  assert.ok(payload.warnings.some(warning => /必填章节「必填自定义」不可删除/.test(warning)))
})

test('buildApplyPayload：同时写入待澄清问题到 issues 章节', () => {
  const entries = diffDocSections([section('problem', '问题', '旧')], [section('problem', '问题', '新')]).sections
  const payload = buildApplyPayload(entries, {
    includeIssues: true,
    issues: [{ question: '是否需要导出 Excel？' }],
    issuesSection: section('issues', '待澄清问题', '- 已有问题', { kind: 'issues' })
  })
  const issues = payload.sections.find(item => item.id === 'issues')
  assert.ok(issues)
  assert.match(issues.markdown, /- 已有问题/)
  assert.match(issues.markdown, /- 待确认：是否需要导出 Excel？/)
})

test('buildApplyPayload：没有 issues 章节时只 warning，不强行创建', () => {
  const entries = diffDocSections([section('problem', '问题', '旧')], [section('problem', '问题', '新')]).sections
  const payload = buildApplyPayload(entries, {
    includeIssues: true,
    issues: [{ question: '待确认项' }]
  })
  assert.equal(payload.sections.some(item => item.id === 'issues'), false)
  assert.ok(payload.warnings.some(warning => /没有“待澄清问题”章节/.test(warning)))
})

test('allApplicableSelected：忽略必填删除项，全部勾选时为 true', () => {
  const entries = [
    { sectionKey: 'a', change: 'modified' },
    { sectionKey: 'b', change: 'removed', required: false },
    { sectionKey: 'c', change: 'removed', required: true }
  ]
  assert.equal(allApplicableSelected(entries, ['a', 'b']), true)
  assert.equal(allApplicableSelected(entries, ['a']), false)
})

test('trimSuggestion：持久化前删除 lineDiff，保留应用/展示所需字段', () => {
  const suggestion = {
    title: '标题',
    titleBefore: '旧标题',
    titleChanged: true,
    counts: { added: 1, modified: 1, removed: 0, unchanged: 0 },
    warnings: [],
    openIssues: [{ question: '是否导出？' }],
    baseVersion: 3,
    source: 'preview',
    ignored: false,
    sections: [
      {
        sectionKey: 'problem',
        title: '问题',
        level: 2,
        kind: 'markdown',
        markdown: '新内容',
        markdownBefore: '旧内容',
        lineDiff: [
          { type: '-', text: '旧内容' },
          { type: '+', text: '新内容' }
        ],
        required: true,
        change: 'modified'
      },
      { sectionKey: 'custom-new', title: '新增', level: 2, kind: 'markdown', markdown: '内容', required: false, change: 'added' }
    ]
  }
  const trimmed = trimSuggestion(suggestion)
  assert.equal(trimmed.sections[0].lineDiff, undefined)
  assert.equal(trimmed.sections[0].markdownBefore, '旧内容')
  assert.equal(trimmed.sections[0].markdown, '新内容')
  assert.equal(trimmed.sections[1].change, 'added')
  assert.equal(trimmed.baseVersion, 3)
  assert.deepEqual(trimmed.openIssues, [{ question: '是否导出？' }])
  // 原对象不被破坏（页面仍显示 diff）
  assert.equal(suggestion.sections[0].lineDiff.length, 2)
})

test('hydrateSuggestion：刷新后按 markdownBefore/markdown 重算 modified 的 lineDiff', () => {
  const persisted = {
    title: '标题',
    titleBefore: '标题',
    titleChanged: false,
    counts: { added: 0, modified: 1, removed: 0, unchanged: 0 },
    warnings: [],
    openIssues: [],
    baseVersion: 4,
    source: 'local',
    sections: [
      {
        sectionKey: 'goals',
        title: '目标',
        level: 2,
        kind: 'markdown',
        markdown: '第一行\n第二行（改）',
        markdownBefore: '第一行\n第二行',
        required: false,
        change: 'modified'
      },
      {
        sectionKey: 'custom-added',
        title: '新增',
        level: 2,
        kind: 'markdown',
        markdown: '新增内容',
        required: false,
        change: 'added'
      }
    ]
  }
  const hydrated = hydrateSuggestion(persisted)
  assert.deepEqual(
    hydrated.sections[0].lineDiff.map(line => `${line.type}${line.text}`),
    [' 第一行', '-第二行', '+第二行（改）']
  )
  assert.equal(hydrated.sections[1].lineDiff, undefined)
  // 已有 lineDiff 时不重复计算
  const existing = hydrateSuggestion(hydrated)
  assert.deepEqual(existing.sections[0].lineDiff, hydrated.sections[0].lineDiff)
})
