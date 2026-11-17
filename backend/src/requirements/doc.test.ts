import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

interface Setup {
  root: string
  db: typeof import('../db').db
  doc: typeof import('./doc')
  templates: typeof import('./templates')
}

let setupPromise: Promise<Setup> | null = null

async function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-reqdoc-'))
    process.env.RG_DATA_DIR = path.join(root, 'data')
    process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
    const dbModule = await import('../db')
    const templates = await import('./templates')
    const doc = await import('./doc')
    const now = new Date().toISOString()
    dbModule.db.prepare(`
      INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
      VALUES ('doc-app', '文档应用', '测试', 'doc-app', 8081, 'requirements', ?, ?)
    `).run(now, now)
    return { root, db: dbModule.db, doc, templates }
  })()
  return setupPromise
}

after(async () => {
  if (!setupPromise) return
  const { root, db } = await setupPromise
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

/** 每个文档用例从空白文档开始，避免用例间状态耦合 */
async function freshDoc(): Promise<Setup> {
  const context = await setup()
  context.db.prepare('DELETE FROM app_requirement_doc_versions WHERE app_id = ?').run('doc-app')
  context.db.prepare('DELETE FROM app_requirement_doc_sections WHERE app_id = ?').run('doc-app')
  context.db.prepare('DELETE FROM app_requirement_docs WHERE app_id = ?').run('doc-app')
  // #7：切换模板会同步应用默认模板；重置以免影响后续用例的文档初始化
  context.db
    .prepare(
      "UPDATE apps SET status = 'requirements', requirements_confirmed_at = NULL, design_confirmed_at = NULL, requirement_template_id = NULL, prototype_template_id = NULL WHERE id = 'doc-app'"
    )
    .run()
  return context
}

function fillRequired(doc: Setup['doc'], overrides: Record<string, string> = {}): void {
  for (const section of doc.ensureRequirementDoc('doc-app').sections) {
    if (!section.required) continue
    const markdown = overrides[section.sectionKey] ?? `内容-${section.title}`
    doc.saveDocSection('doc-app', section.sectionKey, { markdown })
  }
}

test('内置模板 seed：需求阶段 3 个，标准 PRD 13 节，QA 属于测试阶段', async () => {
  const { templates } = await setup()
  const requirements = templates.listTemplates({ stage: 'requirements' })
  assert.equal(requirements.length, 3)
  const prd = requirements.find(template => template.id === 'builtin-prd')
  assert.ok(prd)
  assert.equal(prd?.builtin, true)
  assert.equal(prd?.visibility, 'builtin')
  assert.equal(prd?.sections.length, 13)
  assert.equal(prd?.sections[0].id, 'meta')
  assert.ok(prd?.sections.some(section => section.kind === 'epics' && section.required))
  const lite = requirements.find(template => template.id === 'builtin-prd-lite')
  assert.equal(lite?.sections.length, 6)
  const qa = templates.listTemplates({ stage: 'test' })
  assert.equal(qa.length, 1)
  assert.equal(qa[0].id, 'builtin-qa-test-plan')
  assert.equal(templates.defaultRequirementTemplate().id, 'builtin-prd')
})

test('内置模板只读；复制后可编辑、删除', async () => {
  const { templates } = await setup()
  assert.throws(() => templates.updateTemplate('builtin-prd', { name: 'x' }), /只读/)
  assert.throws(() => templates.deleteTemplate('builtin-prd'), /只读/)
  const copy = templates.duplicateTemplate('builtin-prd')
  assert.equal(copy.builtin, false)
  assert.equal(copy.visibility, 'private')
  assert.match(copy.name, /副本/)
  const updated = templates.updateTemplate(copy.id, { ...copy, name: '我的 PRD' })
  assert.equal(updated.name, '我的 PRD')
  templates.deleteTemplate(copy.id)
  assert.throws(() => templates.getTemplateOrThrow(copy.id), /不存在/)
})

test('文档初始化：按默认模板创建章节与 v1 快照', async () => {
  const { doc } = await freshDoc()
  const payload = doc.ensureRequirementDoc('doc-app')
  assert.equal(payload.template.id, 'builtin-prd')
  assert.equal(payload.doc.status, 'draft')
  assert.equal(payload.doc.version, 1)
  assert.equal(payload.sections.length, 13)
  assert.match(payload.doc.contentMd, /^# 文档应用 需求文档/)
  assert.match(payload.doc.contentMd, /## 问题与机会/)
  const versions = doc.listDocVersions('doc-app')
  assert.equal(versions.length, 1)
  assert.equal(versions[0].source, 'template-change')
})

test('章节自动保存：不生成版本、内容/模板同步，updated_at 刷新', async () => {
  const { doc } = await freshDoc()
  const before = doc.ensureRequirementDoc('doc-app')
  await new Promise(resolve => setTimeout(resolve, 5))
  const saved = doc.saveDocSection('doc-app', 'problem', { markdown: '用户需要季度报表。' })
  assert.equal(saved.doc.version, before.doc.version)
  assert.match(saved.doc.contentMd, /用户需要季度报表/)
  assert.notEqual(saved.doc.updatedAt, before.doc.updatedAt)
  const section = saved.sections.find(item => item.sectionKey === 'problem')
  assert.equal(section?.markdown, '用户需要季度报表。')
  const versions = doc.listDocVersions('doc-app')
  assert.equal(versions.length, 1)
  assert.equal(versions[0].source, 'template-change')

  await new Promise(resolve => setTimeout(resolve, 5))
  const second = doc.saveDocSection('doc-app', 'problem', { markdown: '再次自动保存。' })
  assert.equal(second.doc.version, before.doc.version)
  assert.notEqual(second.doc.updatedAt, saved.doc.updatedAt)
  assert.equal(doc.listDocVersions('doc-app').length, 1)

  // 显式 snapshot:true 仍可生成 manual 版本（例如外部调用需要 checkpoint）
  const manual = doc.saveDocSection('doc-app', 'problem', { markdown: '显式快照。', snapshot: true })
  assert.equal(manual.doc.version, before.doc.version + 1)
  assert.equal(doc.listDocVersions('doc-app')[0].source, 'manual')
})

test('确认校验：必填章节为空 / 无用户故事时阻塞；待澄清只做警告', async () => {
  const { doc } = await freshDoc()
  let message = ''
  try {
    doc.confirmRequirementDoc('doc-app')
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  assert.match(message, /确认条件/)

  fillRequired(doc)
  let issues: unknown[] = []
  try {
    doc.confirmRequirementDoc('doc-app')
  } catch (error) {
    issues = (error as { issues?: unknown[] }).issues ?? []
  }
  assert.ok(issues.some(issue => /用户故事|Epic/.test(JSON.stringify(issue))))

  doc.saveDocSection('doc-app', 'epics', { markdown: '- 作为运营，我希望查看季度报表，以便复盘业绩。' })
  doc.saveDocSection('doc-app', 'issues', { markdown: '- 待确认：是否需要导出 Excel？' })
  const result = doc.confirmRequirementDoc('doc-app')
  assert.equal(result.alreadyConfirmed, false)
  assert.equal(result.payload.doc.status, 'confirmed')
  assert.ok(result.warnings.some(warning => /待确认/.test(warning)))
})

test('确认需求切换应用阶段；重复确认幂等', async () => {
  const { db, doc } = await freshDoc()
  fillRequired(doc, { epics: '- 作为运营，我希望查看季度报表。' })
  doc.confirmRequirementDoc('doc-app')
  const app = db.prepare('SELECT status, requirements_confirmed_at FROM apps WHERE id = ?').get('doc-app') as {
    status: string
    requirements_confirmed_at: string | null
  }
  assert.equal(app.status, 'design')
  assert.ok(app.requirements_confirmed_at)
  const again = doc.confirmRequirementDoc('doc-app')
  assert.equal(again.alreadyConfirmed, true)
})

test('全文保存：按 ##/### 标题解析回章节，新标题落为 custom-*', async () => {
  const { doc } = await freshDoc()
  const saved = doc.saveDoc('doc-app', {
    contentMd: '# 新标题\n\n## 问题与机会\n\n背景 A\n\n## 自定义章节\n\n自定义内容\n\n### 子标题\n\n子内容',
    source: 'manual'
  })
  assert.equal(saved.doc.title, '新标题')
  const custom = saved.sections.find(section => section.title === '自定义章节')
  assert.ok(custom)
  assert.match(custom?.sectionKey ?? '', /^custom-/)
  assert.equal(custom?.markdown, '自定义内容\n\n### 子标题\n\n子内容')
  assert.equal(saved.sections.find(section => section.sectionKey === 'problem')?.markdown, '背景 A')
})

test('AI 章节更新：按 sections 合并并标记 source=ai', async () => {
  const { doc } = await freshDoc()
  const saved = doc.saveDoc('doc-app', {
    sections: [
      { id: 'problem', markdown: 'AI 修改后的问题描述' },
      { id: 'custom-extra', title: '补充说明', markdown: 'AI 新增章节' }
    ],
    source: 'ai'
  })
  assert.equal(saved.sections.find(section => section.sectionKey === 'problem')?.markdown, 'AI 修改后的问题描述')
  assert.ok(saved.sections.some(section => section.sectionKey === 'custom-extra'))
  assert.equal(doc.listDocVersions('doc-app')[0].source, 'ai')
})

test('切换模板：按标题保留内容，生成 template-change 版本', async () => {
  const { doc } = await freshDoc()
  doc.saveDocSection('doc-app', 'problem', { markdown: '问题描述保留' })
  const switched = doc.switchDocTemplate('doc-app', 'builtin-prd-lite')
  assert.equal(switched.template.id, 'builtin-prd-lite')
  assert.equal(switched.sections.length, 6)
  assert.equal(switched.sections.find(section => section.sectionKey === 'problem')?.markdown, '问题描述保留')
  assert.equal(doc.listDocVersions('doc-app')[0].source, 'template-change')
  assert.throws(() => doc.switchDocTemplate('doc-app', 'builtin-qa-test-plan'), /不能用于需求文档/)
})

test('版本查看与回滚：恢复章节正文，回滚版本来源为 rollback', async () => {
  const { doc } = await freshDoc()
  doc.ensureRequirementDoc('doc-app')
  doc.saveDocSection('doc-app', 'problem', { markdown: '版本二内容', snapshot: true })
  const versions = doc.listDocVersions('doc-app')
  const v2 = versions.find(item => item.version === 2)
  assert.ok(v2)
  assert.equal(v2?.source, 'manual')
  const detail = doc.getDocVersion('doc-app', 2)
  assert.equal(detail.sections.find(section => section.sectionKey === 'problem')?.markdown, '版本二内容')
  doc.saveDocSection('doc-app', 'problem', { markdown: '再次修改' })
  const rolled = doc.rollbackDocVersion('doc-app', 2)
  assert.equal(rolled.sections.find(section => section.sectionKey === 'problem')?.markdown, '版本二内容')
  assert.ok(rolled.doc.version > 0)
  assert.equal(doc.listDocVersions('doc-app')[0].source, 'rollback')
})

test('确认需求生成 confirm 版本（内容未变也 +1）；重复确认不重复生成', async () => {
  const { doc } = await freshDoc()
  fillRequired(doc, { epics: '- 作为运营，我希望查看季度报表。' })
  const before = doc.ensureRequirementDoc('doc-app')
  const result = doc.confirmRequirementDoc('doc-app')
  assert.equal(result.payload.doc.status, 'confirmed')
  assert.equal(result.payload.doc.version, before.doc.version + 1)
  const latest = doc.listDocVersions('doc-app')[0]
  assert.equal(latest.version, before.doc.version + 1)
  assert.equal(latest.source, 'confirm')
  assert.equal(doc.getDocVersion('doc-app', latest.version).sections.length, before.sections.length)
  // 幂等：再次确认不产新版本
  const again = doc.confirmRequirementDoc('doc-app')
  assert.equal(again.alreadyConfirmed, true)
  assert.equal(doc.listDocVersions('doc-app')[0].version, latest.version)
})

test('手动“保存版本”：+1 且 source=manual；已确认文档 409', async () => {
  const { doc } = await freshDoc()
  const before = doc.ensureRequirementDoc('doc-app')
  doc.saveDocSection('doc-app', 'problem', { markdown: '未产版本的自动保存内容' })
  const manual = doc.createManualDocVersion('doc-app')
  assert.equal(manual.doc.version, before.doc.version + 1)
  assert.match(manual.doc.contentMd, /未产版本的自动保存内容/)
  const latest = doc.listDocVersions('doc-app')[0]
  assert.equal(latest.version, manual.doc.version)
  assert.equal(latest.source, 'manual')
  assert.equal(latest.changeSetSeq, null)

  fillRequired(doc, { epics: '- 作为运营，我希望查看季度报表。' })
  doc.confirmRequirementDoc('doc-app')
  assert.throws(() => doc.createManualDocVersion('doc-app'), /文档已确认/)
})

test('版本列表/详情返回所属变更单序号 changeSetSeq', async () => {
  const { doc, db } = await freshDoc()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO app_change_sets (id, app_id, seq, title, description, scope, status, created_at, updated_at)
    VALUES ('cs-test', 'doc-app', 3, '测试变更', '', 'requirements', 'requirements', ?, ?)
  `).run(now, now)
  doc.ensureRequirementDoc('doc-app')
  doc.saveDocSection('doc-app', 'problem', { markdown: '变更中的自动保存' })
  doc.createManualDocVersion('doc-app')
  const latest = doc.listDocVersions('doc-app')[0]
  assert.equal(latest.source, 'manual')
  assert.equal(latest.changeSetSeq, 3)
  assert.equal(latest.changeSetId, 'cs-test')
  const detail = doc.getDocVersion('doc-app', latest.version)
  assert.equal(detail.changeSetSeq, 3)
  // 变更单删除后不报错，序号为 null
  db.prepare("DELETE FROM app_change_sets WHERE id = 'cs-test'").run()
  assert.equal(doc.listDocVersions('doc-app')[0].changeSetSeq, null)
})

test('确认后文档只读：章节保存/全文保存/切换模板/回滚均被拒绝', async () => {
  const { doc } = await freshDoc()
  fillRequired(doc, { epics: '- 作为运营，我希望查看季度报表。' })
  doc.confirmRequirementDoc('doc-app')
  assert.throws(() => doc.saveDocSection('doc-app', 'problem', { markdown: 'x' }), /只读/)
  assert.throws(() => doc.saveDoc('doc-app', { contentMd: '# 标题\n\n## 问题与机会\n\nx' }), /只读/)
  assert.throws(() => doc.switchDocTemplate('doc-app', 'builtin-prd-lite'), /只读/)
  assert.throws(() => doc.rollbackDocVersion('doc-app', 1), /只读/)
})

test('只读导出 01-REQUIREMENTS.md 与文档内容一致', async () => {
  const { doc } = await freshDoc()
  const payload = doc.ensureRequirementDoc('doc-app')
  const exported = doc.exportRequirementDoc('doc-app')
  assert.equal(exported.filename, '01-REQUIREMENTS.md')
  assert.equal(exported.content, payload.doc.contentMd)
  assert.equal(exported.status, payload.doc.status)
})

test('doc 模式 prompt 注入模板、聚焦章节与 DOC_JSON 协议', async () => {
  const { doc } = await freshDoc()
  const { buildDocChatPrompt } = await import('../chat/doc-prompt')
  const context = doc.loadDocChatContext('doc-app', undefined, 'problem')
  const prompt = buildDocChatPrompt(context, [{ role: 'user', content: '请细化问题与机会' }])
  assert.match(prompt, /<<<DOC_JSON>>>/)
  assert.match(prompt, /当前聚焦章节/)
  assert.match(prompt, /\[problem\] 问题与机会/)
  assert.match(prompt, /默认只修改当前聚焦章节/)
  assert.match(prompt, /请细化问题与机会/)
  assert.match(prompt, /结构化需求条目|结构/)
  assert.match(prompt, /不要把 Story/)
  assert.match(prompt, /每个 Epic 至少 1 个 Story/)
  assert.match(prompt, /stories\[\]\.epicId/)
})

test('结构化章节：保存 data 分配稳定 ID 并渲染 Markdown；再次保存保留 ID', async () => {
  const { doc } = await freshDoc()
  const saved = doc.saveDocSection('doc-app', 'epics', {
    data: {
      scenes: [],
      epics: [{ title: '订单创建', goal: '支持业务员创建订单', priority: 'P0' }],
      stories: [{ title: '创建订单', description: '作为业务员，我希望创建订单', acceptance: ['必填校验'], priority: 'P0' }]
    }
  })
  const epicsSection = saved.sections.find(section => section.sectionKey === 'epics')
  assert.ok(epicsSection?.data)
  assert.equal(epicsSection?.data?.epics[0].id, 'EPIC-001')
  assert.equal(epicsSection?.data?.stories[0].id, 'STORY-001')
  assert.match(epicsSection?.markdown ?? '', /### EPIC-001 订单创建/)
  assert.match(epicsSection?.markdown ?? '', /#### STORY-001 创建订单/)

  const renamed = doc.saveDocSection('doc-app', 'epics', {
    data: {
      scenes: [],
      epics: [{ id: 'EPIC-001', title: '订单创建（改）' }],
      stories: [{ id: 'STORY-001', title: '创建订单', description: '作为业务员，我希望创建订单', acceptance: ['必填校验'] }]
    }
  })
  const again = renamed.sections.find(section => section.sectionKey === 'epics')
  assert.equal(again?.data?.epics[0].id, 'EPIC-001')
  assert.equal(again?.data?.epics[0].title, '订单创建（改）')

  const reread = doc.ensureRequirementDoc('doc-app').sections.find(section => section.sectionKey === 'epics')
  assert.equal(reread?.data?.stories[0].id, 'STORY-001')
})

test('结构化兜底：Epic 内嵌 stories 展开为顶层 Story，epicId 正确并去重', async () => {
  const { doc } = await freshDoc()
  const saved = doc.saveDocSection('doc-app', 'epics', {
    data: {
      scenes: [],
      epics: [
        {
          title: '订单创建',
          goal: ['支持业务员创建订单', '减少漏单'],
          stories: [
            { title: '创建订单', description: '作为业务员，我希望创建订单', acceptance: ['必填校验'] },
            { id: 'STORY-002', title: '保存订单草稿', acceptance: ['可保存草稿'] }
          ]
        },
        { title: '订单查询', stories: [{ title: '查询订单', acceptance: ['能按客户筛选'] }] }
      ],
      stories: []
    }
  })
  const section = saved.sections.find(item => item.sectionKey === 'epics')
  const activeStories = (section?.data?.stories ?? []).filter(story => !story.archived)
  assert.equal(activeStories.length, 3)
  assert.equal(activeStories.filter(story => story.epicId === 'EPIC-001').length, 2)
  assert.equal(activeStories.filter(story => story.epicId === 'EPIC-002').length, 1)
  assert.equal(section?.data?.epics[0].goal, '支持业务员创建订单\n减少漏单')
  assert.match(section?.markdown ?? '', /#### STORY-\d{3} 创建订单/)

  // 内嵌 story 与顶层 stories[] 重复时只保留一条（顶层优先）
  const deduped = doc.saveDocSection('doc-app', 'epics', {
    data: {
      scenes: [],
      epics: [
        { id: 'EPIC-001', title: '订单创建', stories: [{ title: '创建订单', acceptance: ['必填校验'] }] },
        { id: 'EPIC-002', title: '订单查询', stories: [{ title: '查询订单', acceptance: ['能按客户筛选'] }] }
      ],
      stories: [{ id: 'STORY-001', epicId: 'EPIC-001', title: '创建订单', acceptance: ['必填校验'], description: '作为业务员，我希望创建订单' }]
    }
  })
  const dedupedStories = (deduped.sections.find(item => item.sectionKey === 'epics')?.data?.stories ?? []).filter(
    story => !story.archived
  )
  assert.equal(dedupedStories.filter(story => story.title === '创建订单').length, 1)
  assert.equal(dedupedStories.length, 2)
})

test('结构化兜底：不同 Epic 下同名 Story 都保留（标题去重按 Epic 范围）', async () => {
  const { doc } = await freshDoc()
  const saved = doc.saveDocSection('doc-app', 'epics', {
    data: {
      scenes: [],
      epics: [
        { title: '订单创建', stories: [{ title: '查看列表', acceptance: ['能查看创建记录'] }] },
        { title: '订单查询', stories: [{ title: '查看列表', acceptance: ['能查看查询结果'] }] }
      ],
      stories: []
    }
  })
  const section = saved.sections.find(item => item.sectionKey === 'epics')
  const active = (section?.data?.stories ?? []).filter(story => !story.archived)
  assert.equal(active.length, 2)
  assert.equal(active.filter(story => story.title === '查看列表').length, 2)
  assert.equal(active.filter(story => story.epicId === 'EPIC-001').length, 1)
  assert.equal(active.filter(story => story.epicId === 'EPIC-002').length, 1)
  assert.match(section?.markdown ?? '', /#### STORY-\d{3} 查看列表/)
})

test('Epic 无 Story：保存返回 warning（不阻塞保存），确认仍阻塞', async () => {
  const { doc } = await freshDoc()
  fillRequired(doc)
  const saved = doc.saveDocSection('doc-app', 'epics', {
    data: {
      scenes: [],
      epics: [{ title: '订单创建' }, { title: '订单查询' }],
      stories: []
    }
  })
  assert.equal(saved.doc.status, 'draft')
  const warnings = saved.warnings ?? []
  assert.equal(warnings.filter(warning => /没有 Story/.test(warning)).length, 2)
  assert.ok(warnings.some(warning => /EPIC-00\d.*没有 Story/.test(warning)))

  let issues: unknown[] = []
  try {
    doc.confirmRequirementDoc('doc-app')
  } catch (error) {
    issues = (error as { issues?: unknown[] }).issues ?? []
  }
  assert.ok(issues.length > 0)
  assert.ok(issues.some(issue => /Story/.test(JSON.stringify(issue))))
})

test('结构化场景：保存/重建后正文可导出且 ID 稳定', async () => {
  const { doc } = await freshDoc()
  doc.saveDocSection('doc-app', 'scenes', {
    data: { scenes: [{ title: '订单管理', description: '销售维护订单' }], epics: [], stories: [] }
  })
  let section = doc.ensureRequirementDoc('doc-app').sections.find(item => item.sectionKey === 'scenes')
  assert.equal(section?.data?.scenes[0].id, 'SCENE-001')
  assert.match(doc.ensureRequirementDoc('doc-app').doc.contentMd, /### SCENE-001 订单管理/)

  // 源码模式改成新标题：重建后沿用/分配 ID
  doc.saveDoc('doc-app', { contentMd: '# 新标题\n\n## 业务场景与流程\n\n### SCENE-001 订单管理（改）\n\n销售维护订单。\n' })
  section = doc.ensureRequirementDoc('doc-app').sections.find(item => item.sectionKey === 'scenes')
  assert.equal(section?.data?.scenes[0].id, 'SCENE-001')
  assert.equal(section?.data?.scenes[0].title, '订单管理（改）')
})

test('重建结构：从遗留 Markdown 生成 Epic/Story 稳定 ID', async () => {
  const { doc } = await freshDoc()
  doc.saveDocSection('doc-app', 'epics', {
    markdown: '### Epic 1：订单管理\n\n- 作为销售，我希望创建订单，以便记录成交。\n- 验收：必填字段校验\n'
  })
  const rebuilt = doc.rebuildRequirementOutline('doc-app', 'epics')
  const section = rebuilt.sections.find(item => item.sectionKey === 'epics')
  assert.ok(section?.data?.epics.length)
  assert.match(section?.data?.epics[0].id ?? '', /^EPIC-\d{3}$/)
  assert.match(section?.markdown ?? '', /### EPIC-\d{3} 订单管理/)
})

test('结构化确认校验：有 Epic 无 Story 阻塞；Story 无验收只警告', async () => {
  const { doc } = await freshDoc()
  fillRequired(doc)
  doc.saveDocSection('doc-app', 'epics', {
    data: { scenes: [], epics: [{ title: '订单创建' }], stories: [] }
  })
  let issues: unknown[] = []
  try {
    doc.confirmRequirementDoc('doc-app')
  } catch (error) {
    issues = (error as { issues?: unknown[] }).issues ?? []
  }
  assert.ok(issues.some(issue => /Story/.test(JSON.stringify(issue))))

  doc.saveDocSection('doc-app', 'epics', {
    data: {
      scenes: [],
      epics: [{ id: 'EPIC-001', title: '订单创建' }],
      stories: [{ title: '创建订单', description: '作为业务员，我希望创建订单', acceptance: [] }]
    }
  })
  issues = []
  let result: ReturnType<typeof doc.confirmRequirementDoc> | null = null
  try {
    result = doc.confirmRequirementDoc('doc-app')
  } catch (error) {
    issues = (error as { issues?: unknown[] }).issues ?? []
  }
  // 所有 Story 都没有验收标准：阻塞（至少 1 条）
  assert.ok(issues.some(issue => /验收/.test(JSON.stringify(issue))))
  assert.equal(result, null)
})

test('重新编辑需求：文档回到 draft、应用回到需求阶段；再次确认可回到设计', async () => {
  const { doc, db } = await freshDoc()
  fillRequired(doc, { epics: '- 作为运营，我希望查看季度报表。' })
  doc.confirmRequirementDoc('doc-app')
  const reopened = doc.reopenRequirementDoc('doc-app')
  assert.equal(reopened.doc.status, 'draft')
  const app = db.prepare('SELECT status, requirements_confirmed_at FROM apps WHERE id = ?').get('doc-app') as {
    status: string
    requirements_confirmed_at: string | null
  }
  assert.equal(app.status, 'requirements')
  assert.equal(app.requirements_confirmed_at, null)
  // 可继续编辑
  doc.saveDocSection('doc-app', 'problem', { markdown: '重新编辑后的背景' })
  doc.confirmRequirementDoc('doc-app')
  assert.equal(doc.ensureRequirementDoc('doc-app').doc.status, 'confirmed')
})

test('AI 建议预览：不写库/不产版本，标记 added/modified/unchanged，removed 仅自定义章节', async () => {
  const { doc } = await freshDoc()
  doc.saveDocSection('doc-app', 'problem', { markdown: '原始问题' })
  doc.saveDocSection('doc-app', 'custom-note', { title: '补充说明', markdown: '自定义内容' })
  const before = doc.ensureRequirementDoc('doc-app')
  const versionsBefore = doc.listDocVersions('doc-app').length

  const preview = doc.previewDoc('doc-app', {
    title: '新标题',
    contentMd: [
      '# 新标题',
      '',
      '## 问题与机会',
      '',
      '预览修改后的问题',
      '',
      '## 范围与约束',
      '',
      '## 全新章节',
      '',
      '新增内容'
    ].join('\n')
  })

  const after = doc.ensureRequirementDoc('doc-app')
  assert.equal(after.doc.version, before.doc.version)
  assert.equal(after.doc.title, before.doc.title)
  assert.equal(after.sections.find(section => section.sectionKey === 'problem')?.markdown, '原始问题')
  assert.equal(doc.listDocVersions('doc-app').length, versionsBefore)

  assert.equal(preview.title, '新标题')
  assert.equal(preview.baseVersion, before.doc.version)
  assert.equal(preview.sections.find(section => section.sectionKey === 'problem')?.change, 'modified')
  assert.equal(preview.sections.find(section => section.sectionKey === 'scope')?.change, 'unchanged')
  const added = preview.sections.find(section => section.title === '全新章节')
  assert.ok(added)
  assert.match(added?.sectionKey ?? '', /^custom-/)
  assert.equal(added?.change, 'added')
  assert.deepEqual(preview.removed.map(item => item.sectionKey), ['custom-note'])
  assert.ok(preview.warnings.some(warning => /必填章节「文档信息」/.test(warning)))
  assert.ok(!preview.removed.some(item => item.sectionKey === 'meta'))
})

test('AI 建议预览：章节更新模式不做删除，必填章节缺失不进入 removed', async () => {
  const { doc } = await freshDoc()
  doc.saveDocSection('doc-app', 'custom-note', { title: '补充说明', markdown: '自定义内容' })
  const preview = doc.previewDoc('doc-app', {
    sections: [{ id: 'problem', markdown: '预览更新' }]
  })
  assert.equal(preview.sections.find(section => section.sectionKey === 'problem')?.change, 'modified')
  assert.deepEqual(preview.removed, [])
  assert.equal(preview.sections.some(section => section.sectionKey === 'custom-note'), true)
})

test('应用 AI 建议：removeSectionKeys 只删自定义可选章节，必填/模板章节忽略并 warning，同一版本', async () => {
  const { doc } = await freshDoc()
  doc.saveDocSection('doc-app', 'problem', { markdown: '原始问题' })
  doc.saveDocSection('doc-app', 'custom-note', { title: '补充说明', markdown: '删除我' })
  const before = doc.ensureRequirementDoc('doc-app')
  const resolved = doc.saveDoc('doc-app', {
    sections: [{ id: 'problem', markdown: '应用后的问题' }],
    removeSectionKeys: ['custom-note', 'goals', 'custom-missing'],
    source: 'ai'
  })
  assert.equal(resolved.doc.version, before.doc.version + 1)
  assert.equal(resolved.sections.find(section => section.sectionKey === 'custom-note'), undefined)
  assert.ok(resolved.sections.find(section => section.sectionKey === 'goals'))
  assert.equal(resolved.sections.find(section => section.sectionKey === 'problem')?.markdown, '应用后的问题')
  assert.equal(doc.listDocVersions('doc-app')[0].source, 'ai')
  assert.ok(resolved.warnings?.some(warning => /模板章节「目标与成功指标」不可删除/.test(warning)))
  assert.ok(resolved.warnings?.some(warning => /章节不存在，已跳过删除/.test(warning)))
})

test('已确认文档的 AI 建议预览返回 409（与保存一致）', async () => {
  const { doc } = await freshDoc()
  fillRequired(doc, { epics: '- 作为运营，我希望查看季度报表。' })
  doc.confirmRequirementDoc('doc-app')
  assert.throws(() => doc.previewDoc('doc-app', { sections: [{ id: 'problem', markdown: 'x' }] }), /只读/)
})

test('变更取消恢复：恢复确认版本内容并生成 restore 版本', async () => {
  const { doc } = await freshDoc()
  fillRequired(doc, { epics: '- 作为运营，我希望查看季度报表。' })
  const confirmed = doc.confirmRequirementDoc('doc-app').payload
  const confirmVersion = confirmed.doc.version
  // 模拟变更中重新编辑并确认（生成新的 confirm 版本）
  doc.reopenRequirementDoc('doc-app')
  doc.saveDocSection('doc-app', 'problem', { markdown: '变更中的问题描述' })
  doc.confirmRequirementDoc('doc-app')
  const restored = doc.restoreRequirementDocVersionConfirmed('doc-app', confirmVersion)
  assert.equal(restored.doc.status, 'confirmed')
  assert.equal(restored.sections.find(section => section.sectionKey === 'problem')?.markdown, '内容-问题与机会')
  const latest = doc.listDocVersions('doc-app')[0]
  assert.equal(latest.source, 'restore')
  assert.equal(latest.version, restored.doc.version)
})

// ---------------------------------------------------------------- G1

test('G1 未知模块告警：保存引用 MOD-999/不存在的模块返回 warning（不阻塞、不产版本）', async () => {
  const { doc } = await freshDoc()
  const before = doc.ensureRequirementDoc('doc-app')
  const saved = doc.saveDocSection('doc-app', 'problem', {
    markdown: '订单客户管理归属 MOD-999，另见 MOD-003。\n\n商品管理（MOD-001）不受影响。'
  })
  const warnings = saved.warnings ?? []
  assert.equal(warnings.filter(warning => /MOD-999/.test(warning)).length, 1)
  assert.equal(warnings.filter(warning => /MOD-003/.test(warning)).length, 1)
  // 已存在的模块 key 不告警
  assert.equal(warnings.some(warning => /MOD-001/.test(warning)), false)
  // 同一 key 只出现一次
  assert.equal(warnings.filter(warning => /不存在的模块/.test(warning)).length, 2)
  assert.match(warnings[0], /新增模块请用左侧「\+ 新增模块」/)
  // 自动保存不产版本（与旧行为一致）
  assert.equal(saved.doc.version, before.doc.version)
})

test('G1 未知模块告警：全文保存多个章节引用同一 key 只告警一次；已有 key 不告警', async () => {
  const { doc } = await freshDoc()
  doc.saveDocSection('doc-app', 'goals', { markdown: '指标见 MOD-001。' })
  const saved = doc.saveDoc('doc-app', {
    sections: [
      { id: 'problem', markdown: '问题归属 MOD-777' },
      { id: 'goals', markdown: '指标归属 MOD-777，另见 MOD-001' }
    ],
    source: 'ai'
  })
  const unknown = (saved.warnings ?? []).filter(warning => /不存在的模块/.test(warning))
  assert.equal(unknown.length, 1)
  assert.match(unknown[0], /MOD-777/)
  assert.equal(unknown[0].includes('MOD-001'), false)
})

test('G1 未知模块告警：确认校验返回 warning 但确认仍可完成', async () => {
  const { db, doc } = await freshDoc()
  fillRequired(doc, { epics: '- 作为运营，我希望查看季度报表。', problem: '季度报表（预留 MOD-999）' })
  const payload = doc.ensureRequirementDoc('doc-app')
  const validation = doc.validateRequirementDoc(payload)
  assert.equal(validation.errors.length, 0)
  assert.ok(validation.warnings.some(warning => /MOD-999/.test(warning)))
  const result = doc.confirmRequirementDoc('doc-app')
  assert.equal(result.alreadyConfirmed, false)
  assert.equal(result.payload.doc.status, 'confirmed')
  assert.ok(result.warnings.some(warning => /MOD-999/.test(warning)))
  const app = db.prepare('SELECT status FROM apps WHERE id = ?').get('doc-app') as { status: string }
  assert.equal(app.status, 'design')
})
