import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DOC_DELIMITER,
  mergeDocSections,
  splitDocOutput,
  validateDocSections
} from './doc-protocol.js'
test('splitDocOutput 解析 DOC_JSON（正文 + doc）', () => {
  const raw = `已生成初稿。\n\n${DOC_DELIMITER}\n{"doc":"# 标题\\n\\n## 问题与机会\\n\\n背景","title":"标题"}`
  const parsed = splitDocOutput(raw)
  assert.equal(parsed.reply, '已生成初稿。')
  assert.match(parsed.envelope.doc, /^# 标题/)
  assert.equal(parsed.envelope.title, '标题')
})

test('splitDocOutput 容忍尾随分隔符/代码块/尾逗号', () => {
  const raw = `收到。\n${DOC_DELIMITER}\n\`\`\`json\n{"sections":[{"id":"problem","markdown":"新问题"},],"nextSteps":[{"label":"细化权限","prompt":"请细化权限"}],}\n\`\`\`\n${DOC_DELIMITER}`
  const parsed = splitDocOutput(raw)
  assert.equal(parsed.reply, '收到。')
  assert.deepEqual(parsed.envelope.sections, [{ id: 'problem', markdown: '新问题' }])
  assert.deepEqual(parsed.envelope.nextSteps, [{ label: '细化权限', prompt: '请细化权限' }])
})

test('splitDocOutput 无分隔符时提取 JSON 并保留前文', () => {
  const parsed = splitDocOutput('说明文字\n{"sections":[{"id":"goals","markdown":"目标"}]}')
  assert.equal(parsed.reply, '说明文字')
  assert.equal(parsed.envelope.sections[0].id, 'goals')
})

test('splitDocOutput 无法解析时返回原文、无 envelope', () => {
  const parsed = splitDocOutput('只有一段普通回复，没有 JSON')
  assert.equal(parsed.reply, '只有一段普通回复，没有 JSON')
  assert.equal(parsed.envelope, null)
})

test('openIssues 归一化只保留问题文本', () => {
  const parsed = splitDocOutput(`${DOC_DELIMITER}\n{"openIssues":{"add":[{"question":"是否导出 Excel？"},{"x":1}]}}`)
  assert.deepEqual(parsed.envelope.openIssues, { add: [{ question: '是否导出 Excel？' }] })
})

test('mergeDocSections 按 key/标题修改并追加自定义章节', () => {
  const existing = [
    { sectionKey: 'problem', title: '问题与机会', markdown: '旧', kind: 'markdown', required: true, level: 2, position: 0 },
    { sectionKey: 'goals', title: '目标与指标', markdown: '', kind: 'metrics', required: true, level: 2, position: 1 }
  ]
  const next = mergeDocSections(existing, [
    { id: 'problem', markdown: '新问题' },
    { title: '目标与指标', markdown: '新目标' },
    { id: 'custom-extra', title: '补充', markdown: '补充内容' }
  ])
  assert.equal(next.find(section => section.sectionKey === 'problem').markdown, '新问题')
  assert.equal(next.find(section => section.sectionKey === 'goals').markdown, '新目标')
  assert.equal(next.find(section => section.sectionKey === 'custom-extra').markdown, '补充内容')
  assert.equal(next.length, 3)
  assert.deepEqual(next.map(section => section.position), [0, 1, 2])
})

test('mergeDocSections 不修改入参', () => {
  const existing = [{ sectionKey: 'problem', title: '问题', markdown: '旧', required: true, position: 0 }]
  mergeDocSections(existing, [{ id: 'problem', markdown: '新' }])
  assert.equal(existing[0].markdown, '旧')
})

test('validateDocSections 检出必填为空（含 epics）', () => {
  const { errors } = validateDocSections([
    { sectionKey: 'problem', title: '问题与机会', kind: 'markdown', required: true, markdown: '' },
    { sectionKey: 'epics', title: 'Epics', kind: 'epics', required: true, markdown: '' }
  ])
  assert.equal(errors.length, 2)
  assert.ok(errors.some(error => /必填/.test(error.message)))
  assert.ok(errors.some(error => /用户故事|Epic/.test(error.message)))
})

test('validateDocSections 待澄清只做警告', () => {
  const { errors, warnings } = validateDocSections([
    { sectionKey: 'epics', title: 'Epics', kind: 'epics', required: true, markdown: '- 作为用户，我希望查看报表' },
    { sectionKey: 'issues', title: '待澄清问题', kind: 'issues', required: false, markdown: '- 待确认：导出格式' }
  ])
  assert.equal(errors.length, 0)
  assert.ok(warnings.some(warning => /待确认/.test(warning)))
  assert.ok(warnings.some(warning => /纯 Markdown 结构/.test(warning)))
})

test('DOC_JSON 支持结构化 data：解析/合并/校验', () => {
  const raw = `补充结构。
${DOC_DELIMITER}
{"sections":[{"id":"epics","data":{"scenes":[],"epics":[{"id":"EPIC-001","title":"订单创建"}],"stories":[{"id":"STORY-001","epicId":"EPIC-001","title":"创建订单","acceptance":["必填校验"]}]}}]}`
  const { envelope } = splitDocOutput(raw)
  assert.equal(envelope?.sections?.[0]?.data?.epics?.[0]?.id, 'EPIC-001')

  const merged = mergeDocSections(
    [{ sectionKey: 'epics', title: 'Epics', kind: 'epics', markdown: '', data: { scenes: [], epics: [], stories: [] } }],
    envelope.sections
  )
  assert.equal(merged[0].data.epics.length, 1)
  assert.equal(merged[0].data.stories[0].acceptance[0], '必填校验')

  const ok = validateDocSections([
    { sectionKey: 'epics', title: 'Epics', kind: 'epics', required: true, markdown: '', data: merged[0].data }
  ])
  assert.equal(ok.errors.length, 0)

  const missingStory = validateDocSections([
    { sectionKey: 'epics', title: 'Epics', kind: 'epics', required: true, markdown: '', data: { scenes: [], epics: [{ id: 'EPIC-001', title: '订单' }], stories: [] } }
  ])
  assert.ok(missingStory.errors.some(error => /Story/.test(error.message)))

  const noAcceptance = validateDocSections([
    { sectionKey: 'epics', title: 'Epics', kind: 'epics', required: true, markdown: '', data: { scenes: [], epics: [{ id: 'EPIC-001', title: '订单' }], stories: [{ id: 'STORY-001', epicId: 'EPIC-001', title: '创建', acceptance: [] }] } }
  ])
  assert.ok(noAcceptance.errors.some(error => /验收/.test(error.message)))
})

test('validateDocSections：Epic 无 Story 给警告（不阻塞），不误报有 Story 的 Epic', () => {
  const data = {
    scenes: [],
    epics: [
      { id: 'EPIC-001', title: '订单创建' },
      { id: 'EPIC-002', title: '订单查询' }
    ],
    stories: [{ id: 'STORY-001', epicId: 'EPIC-001', title: '创建订单', acceptance: ['必填校验'] }]
  }
  const { errors, warnings } = validateDocSections([
    { sectionKey: 'epics', title: 'Epics', kind: 'epics', required: true, markdown: '', data }
  ])
  assert.equal(errors.length, 0)
  assert.ok(warnings.some(warning => /EPIC-002「订单查询」没有 Story/.test(warning)))
  assert.ok(!warnings.some(warning => /EPIC-001「订单创建」没有 Story/.test(warning)))
})
