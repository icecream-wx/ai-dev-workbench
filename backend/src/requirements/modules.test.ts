/**
 * 需求模块服务（M2）单测：CRUD/归档/懒创建/隔离/跨模块 ID/确认门禁/bundle/模板/rollback/export/chat
 *
 * 用临时 RG_DATA_DIR 启动真实 src/db（新库即目标结构），直接调用服务层函数；
 * 每个用例用独立 app id，避免状态耦合。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

interface Setup {
  root: string
  db: typeof import('../db').db
  doc: typeof import('./doc')
  modules: typeof import('./modules')
  resolution: typeof import('../apps/template-resolution')
}

let setupPromise: Promise<Setup> | null = null

async function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-modules-'))
    process.env.RG_DATA_DIR = path.join(root, 'data')
    process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
    const dbModule = await import('../db')
    const doc = await import('./doc')
    const modules = await import('./modules')
    const resolution = await import('../apps/template-resolution')
    return { root, db: dbModule.db, doc, modules, resolution }
  })()
  return setupPromise
}

after(async () => {
  if (!setupPromise) return
  const { root, db } = await setupPromise
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

const TABLES = [
  'app_requirement_bundles',
  'app_requirement_doc_versions',
  'app_requirement_doc_sections',
  'app_requirement_docs',
  'app_modules',
  'app_stage_events'
]

/** 每个用例独立应用（清空旧数据后插入） */
async function newApp(id: string, name: string, status = 'requirements'): Promise<Setup> {
  const context = await setup()
  for (const table of TABLES) context.db.prepare(`DELETE FROM ${table} WHERE app_id = ?`).run(id)
  context.db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  const now = new Date().toISOString()
  context.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 8081, ?, ?, ?)`
    )
    .run(id, name, id, status, now, now)
  return context
}

import type { RequirementOutlineData } from './types'

interface SectionView {
  sectionKey: string
  markdown: string
  data?: RequirementOutlineData
}

function sectionsOf(payload: { sections: SectionView[] }, key: string): SectionView | undefined {
  return payload.sections.find(section => section.sectionKey === key)
}

/** 填满必填章节（结构化 scenes/epics 用 data） */
function fillRequired(context: Setup, appId: string, moduleId: string, tag: string): void {
  const payload = context.doc.ensureRequirementDoc(appId, undefined, moduleId)
  for (const section of payload.sections) {
    if (!section.required) continue
    if (section.kind === 'scenes') {
      context.doc.saveDocSection(
        appId,
        'scenes',
        { data: { scenes: [{ title: `${tag} 场景`, description: `${tag} 说明` }], epics: [], stories: [] } },
        moduleId
      )
      continue
    }
    if (section.kind === 'epics') {
      context.doc.saveDocSection(
        appId,
        'epics',
        {
          data: {
            scenes: [],
            epics: [{ title: `${tag} Epic`, goal: `${tag} 目标` }],
            stories: [{ title: `${tag} Story`, acceptance: [`${tag} 验收`], priority: 'P0' }]
          }
        },
        moduleId
      )
      continue
    }
    if (section.markdown.trim()) continue
    context.doc.saveDocSection(appId, section.sectionKey, { markdown: `${tag}：内容-${section.title}` }, moduleId)
  }
}

test('默认模块懒创建：MOD-001、title=应用名、文档标题保持旧行为；摘要只读', async () => {
  const context = await newApp('mod-default', '模块应用')
  assert.deepEqual(context.modules.moduleSummaries('mod-default'), [])
  assert.deepEqual(context.modules.listModules('mod-default'), [])

  const payload = context.doc.ensureRequirementDoc('mod-default')
  assert.equal(payload.doc.moduleKey, 'MOD-001')
  assert.ok(payload.doc.moduleId.length > 0)
  assert.equal(payload.doc.title, '模块应用 需求文档')
  assert.equal(payload.doc.version, 1)
  assert.equal(payload.sections.length, 13)
  assert.equal(context.doc.ensureRequirementDoc('mod-default', undefined, payload.doc.moduleId).doc.moduleId, payload.doc.moduleId)

  const list = context.modules.listModules('mod-default')
  assert.equal(list.length, 1)
  assert.equal(list[0].title, '模块应用')
  assert.equal(list[0].required, true)
  assert.equal(list[0].position, 0)
  assert.equal(list[0].docVersion, 1)
  assert.equal(list[0].docStatus, 'draft')

  const summary = context.modules.moduleSummaries('mod-default')
  assert.equal(summary.length, 1)
  assert.equal(summary[0].moduleKey, 'MOD-001')
  assert.equal(summary[0].docStatus, 'draft')
  assert.equal(summary[0].docVersion, 1)

  const docSummary = context.doc.requirementDocSummary('mod-default')
  assert.equal(docSummary?.version, 1)
  assert.equal(docSummary?.title, '模块应用 需求文档')

  // 只读：模块列表/摘要不会给新应用建模块
  context.db.prepare('DELETE FROM app_requirement_docs WHERE app_id = ?').run('mod-default')
  context.db.prepare('DELETE FROM app_requirement_doc_sections WHERE app_id = ?').run('mod-default')
  context.db.prepare('DELETE FROM app_requirement_doc_versions WHERE app_id = ?').run('mod-default')
  context.db.prepare('DELETE FROM app_modules WHERE app_id = ?').run('mod-default')
  assert.deepEqual(context.modules.listModules('mod-default'), [])
  assert.equal(context.doc.requirementDocSummary('mod-default'), null)
  assert.equal(
    (context.db.prepare('SELECT COUNT(*) AS c FROM app_modules WHERE app_id = ?').get('mod-default') as { c: number }).c,
    0
  )
})

test('新增模块：MOD-002 + 空文档 v1（复制应用模板）；非需求阶段/非法标题被拒绝', async () => {
  const context = await newApp('mod-create', '模块应用')
  context.doc.ensureRequirementDoc('mod-create')
  const created = context.modules.createModule('mod-create', { title: '订单管理', description: '订单域', ownerLabel: '张三' })
  assert.equal(created.moduleKey, 'MOD-002')
  assert.equal(created.docVersion, 1)
  assert.equal(created.docStatus, 'draft')
  assert.equal(created.required, true)
  assert.equal(created.ownerLabel, '张三')

  const payload = context.doc.ensureRequirementDoc('mod-create', undefined, created.id)
  assert.equal(payload.doc.title, '模块应用 · 订单管理 需求文档')
  assert.equal(payload.doc.version, 1)
  assert.equal(payload.doc.templateId, 'builtin-prd')
  assert.equal(payload.sections.length, 13)
  assert.ok(payload.sections.every(section => section.markdown === ''))
  const versions = context.doc.listDocVersions('mod-create', created.id)
  assert.equal(versions.length, 1)
  assert.equal(versions[0].source, 'template-change')
  assert.equal(
    (context.db.prepare('SELECT COUNT(*) AS c FROM app_requirement_docs WHERE app_id = ?').get('mod-create') as { c: number }).c,
    2
  )

  assert.throws(() => context.modules.createModule('mod-create', { title: '   ' }), /模块名称不能为空/)
  context.db.prepare("UPDATE apps SET status = 'design' WHERE id = 'mod-create'").run()
  assert.throws(() => context.modules.createModule('mod-create', { title: '设计后新增' }), /不能直接新增模块/)
  context.db.prepare("UPDATE apps SET status = 'requirements' WHERE id = 'mod-create'").run()
})

test('模块 CRUD：更新字段、归档保留至少 1 个、归档写 409/读允许、恢复', async () => {
  const context = await newApp('mod-crud', '模块应用')
  const first = context.doc.ensureRequirementDoc('mod-crud').doc
  const second = context.modules.createModule('mod-crud', { title: '第二模块' })

  const updated = context.modules.updateModule('mod-crud', second.id, {
    title: '第二模块（改）',
    ownerLabel: '李四',
    required: false,
    position: 5
  })
  assert.equal(updated.title, '第二模块（改）')
  assert.equal(updated.ownerLabel, '李四')
  assert.equal(updated.required, false)
  assert.equal(updated.position, 5)

  const archived = context.modules.archiveModule('mod-crud', second.id)
  assert.equal(archived.archived, true)
  assert.equal(context.modules.listModules('mod-crud').length, 1)
  assert.equal(context.modules.listModules('mod-crud', true).length, 2)
  assert.throws(() => context.modules.archiveModule('mod-crud', first.moduleId), /至少保留 1 个未归档模块/)
  assert.throws(
    () => context.doc.saveDocSection('mod-crud', 'problem', { markdown: '归档后写入' }, second.id),
    /模块已归档/
  )
  // 归档模块读允许（ensureRequirementDoc 已存在文档时不写库）
  assert.equal(context.doc.ensureRequirementDoc('mod-crud', undefined, second.id).doc.moduleId, second.id)

  const restored = context.modules.restoreModule('mod-crud', second.id)
  assert.equal(restored.archived, false)
  assert.equal(context.modules.listModules('mod-crud').length, 2)

  // 未知模块 404
  assert.throws(() => context.modules.moduleOrThrow('mod-crud', 'missing-module'), /模块不存在/)
  assert.throws(() => context.doc.ensureRequirementDoc('mod-crud', undefined, 'missing-module'), /模块不存在/)
})

test('模块隔离：同 section key 内容/版本独立；默认模块解析不串', async () => {
  const context = await newApp('mod-isolation', '模块应用')
  const first = context.doc.ensureRequirementDoc('mod-isolation').doc
  const second = context.modules.createModule('mod-isolation', { title: '第二模块' })

  context.doc.saveDocSection('mod-isolation', 'problem', { markdown: '模块一的问题' }, first.moduleId)
  context.doc.saveDocSection('mod-isolation', 'problem', { markdown: '模块二的问题' }, second.id)

  const readFirst = context.doc.ensureRequirementDoc('mod-isolation', undefined, first.moduleId)
  const readSecond = context.doc.ensureRequirementDoc('mod-isolation', undefined, second.id)
  assert.match(sectionsOf(readFirst, 'problem')?.markdown ?? '', /模块一的问题/)
  assert.match(sectionsOf(readSecond, 'problem')?.markdown ?? '', /模块二的问题/)
  assert.doesNotMatch(sectionsOf(readFirst, 'problem')?.markdown ?? '', /模块二的问题/)

  context.doc.createManualDocVersion('mod-isolation', first.moduleId)
  assert.equal(context.doc.listDocVersions('mod-isolation', first.moduleId).length, 2)
  assert.equal(context.doc.listDocVersions('mod-isolation', second.id).length, 1)

  // 不传 moduleId → 默认模块（MOD-001）
  const defaultRead = context.doc.ensureRequirementDoc('mod-isolation')
  assert.equal(defaultRead.doc.moduleId, first.moduleId)
  assert.match(sectionsOf(defaultRead, 'problem')?.markdown ?? '', /模块一的问题/)
})

test('跨模块 Outline ID 唯一（§9.3）：同名 Story 不共享 ID；借用他模块 ID 换新号；原模块不变', async () => {
  const context = await newApp('mod-ids', '模块应用')
  const first = context.doc.ensureRequirementDoc('mod-ids').doc
  const second = context.modules.createModule('mod-ids', { title: '第二模块' })

  context.doc.saveDocSection(
    'mod-ids',
    'epics',
    {
      data: {
        scenes: [],
        epics: [{ title: '季度报表' }],
        stories: [{ title: '查看列表', acceptance: ['可查看'], priority: 'P0' }]
      }
    },
    first.moduleId
  )
  const firstData = sectionsOf(
    context.doc.ensureRequirementDoc('mod-ids', undefined, first.moduleId),
    'epics'
  )!.data!
  const firstStory = firstData.stories[0].id
  const firstEpic = firstData.epics[0].id
  assert.equal(firstStory, 'STORY-001')
  assert.equal(firstEpic, 'EPIC-001')

  // ① 两个模块各新增同名 Story → ID 不同
  context.doc.saveDocSection(
    'mod-ids',
    'epics',
    {
      data: {
        scenes: [],
        epics: [{ title: '订单中心' }],
        stories: [{ title: '查看列表', acceptance: ['可查看'], priority: 'P0' }]
      }
    },
    second.id
  )
  const secondData = sectionsOf(context.doc.ensureRequirementDoc('mod-ids', undefined, second.id), 'epics')!.data!
  assert.notEqual(secondData.stories[0].id, firstStory)
  assert.notEqual(secondData.epics[0].id, firstEpic)
  assert.equal(secondData.stories[0].id, 'STORY-002')
  assert.equal(secondData.epics[0].id, 'EPIC-002')

  // ② 模块 B 的 payload 直接带模块 A 的 STORY-001 → B 换新 ID，A 不变
  context.doc.saveDocSection(
    'mod-ids',
    'epics',
    {
      data: {
        scenes: [],
        epics: [{ title: '订单中心' }],
        stories: [{ id: firstStory, title: '借用他模块 ID', acceptance: ['可查看'] }]
      }
    },
    second.id
  )
  const borrowed = sectionsOf(context.doc.ensureRequirementDoc('mod-ids', undefined, second.id), 'epics')!.data!
  const borrowedStory = borrowed.stories.find(story => story.title === '借用他模块 ID')
  assert.ok(borrowedStory)
  assert.notEqual(borrowedStory?.id, firstStory)
  assert.equal(borrowedStory?.id, 'STORY-003')
  const afterFirst = sectionsOf(context.doc.ensureRequirementDoc('mod-ids', undefined, first.moduleId), 'epics')!.data!
  assert.equal(afterFirst.stories[0].id, firstStory)

  // 场景同理：同名 Scene 不共享 ID
  context.doc.saveDocSection('mod-ids', 'scenes', { data: { scenes: [{ title: '列表页' }], epics: [], stories: [] } }, first.moduleId)
  context.doc.saveDocSection('mod-ids', 'scenes', { data: { scenes: [{ title: '列表页' }], epics: [], stories: [] } }, second.id)
  const firstScenes = sectionsOf(context.doc.ensureRequirementDoc('mod-ids', undefined, first.moduleId), 'scenes')!.data!
  const secondScenes = sectionsOf(context.doc.ensureRequirementDoc('mod-ids', undefined, second.id), 'scenes')!.data!
  assert.notEqual(firstScenes.scenes[0].id, secondScenes.scenes[0].id)
})

test('模块确认：单模块进入设计 + bundle v1；多模块需 bundle confirm；bundle GET 只读；hash 随内容变化', async () => {
  const context = await newApp('mod-single', '单模块应用')
  const single = context.doc.ensureRequirementDoc('mod-single').doc
  fillRequired(context, 'mod-single', single.moduleId, '单模块')
  const confirmedSingle = context.doc.confirmRequirementDoc('mod-single')
  assert.equal(confirmedSingle.alreadyConfirmed, false)
  assert.equal(confirmedSingle.appConfirmed, true)
  assert.deepEqual(confirmedSingle.pendingModuleIds, [])
  assert.ok(confirmedSingle.bundleVersion)
  const singleApp = context.db.prepare('SELECT status, requirements_confirmed_at FROM apps WHERE id = ?').get('mod-single') as {
    status: string
    requirements_confirmed_at: string | null
  }
  assert.equal(singleApp.status, 'design')
  assert.ok(singleApp.requirements_confirmed_at)
  const singleBundles = context.db
    .prepare('SELECT version FROM app_requirement_bundles WHERE app_id = ?')
    .all('mod-single') as Array<{ version: number }>
  assert.equal(singleBundles.length, 1)
  const again = context.doc.confirmRequirementDoc('mod-single')
  assert.equal(again.alreadyConfirmed, true)
  assert.equal(
    (context.db.prepare('SELECT COUNT(*) AS c FROM app_requirement_bundles WHERE app_id = ?').get('mod-single') as { c: number }).c,
    1
  )

  // 多模块：确认单模块不推进应用
  const multi = await newApp('mod-multi', '多模块应用')
  const first = multi.doc.ensureRequirementDoc('mod-multi').doc
  const second = multi.modules.createModule('mod-multi', { title: '第二模块' })
  fillRequired(multi, 'mod-multi', first.moduleId, '模块一')
  fillRequired(multi, 'mod-multi', second.id, '模块二')

  const counts = (): string => {
    const query = (sql: string): number => (multi.db.prepare(sql).get() as { c: number }).c
    return JSON.stringify({
      modules: query("SELECT COUNT(*) AS c FROM app_modules WHERE app_id = 'mod-multi'"),
      docs: query("SELECT COUNT(*) AS c FROM app_requirement_docs WHERE app_id = 'mod-multi'"),
      versions: query("SELECT COUNT(*) AS c FROM app_requirement_doc_versions WHERE app_id = 'mod-multi'"),
      bundles: query("SELECT COUNT(*) AS c FROM app_requirement_bundles WHERE app_id = 'mod-multi'")
    })
  }
  const beforeView = counts()
  const view = multi.modules.requirementBundleView('mod-multi')
  assert.equal(view.modules.length, 2)
  assert.equal(view.latest, null)
  assert.equal(view.allRequiredConfirmed, false)
  assert.equal(view.pendingModuleIds.length, 2)
  assert.equal(counts(), beforeView, 'bundle 视图必须只读')
  assert.equal(multi.modules.allRequiredModulesConfirmed('mod-multi'), false)

  const hashBefore = view.bundleHash
  multi.doc.saveDocSection('mod-multi', 'problem', { markdown: '多模块：改一次问题描述' }, second.id)
  const hashAfter = multi.modules.requirementBundleView('mod-multi').bundleHash
  assert.notEqual(hashAfter, hashBefore, '内容变化后聚合 hash 应变化')

  const confirmFirst = multi.doc.confirmRequirementDoc('mod-multi', first.moduleId)
  assert.equal(confirmFirst.appConfirmed, false)
  assert.deepEqual(confirmFirst.pendingModuleIds, [second.id])
  const appAfterFirst = multi.db.prepare('SELECT status, requirements_confirmed_at FROM apps WHERE id = ?').get('mod-multi') as {
    status: string
    requirements_confirmed_at: string | null
  }
  assert.equal(appAfterFirst.status, 'requirements')
  assert.equal(appAfterFirst.requirements_confirmed_at, null)
  assert.throws(() => multi.modules.confirmRequirementBundle('mod-multi'), /必选模块未确认需求/)

  const confirmSecond = multi.doc.confirmRequirementDoc('mod-multi', second.id)
  assert.equal(confirmSecond.appConfirmed, false)
  assert.deepEqual(confirmSecond.pendingModuleIds, [])
  assert.equal(multi.modules.allRequiredModulesConfirmed('mod-multi'), true)

  const result = multi.modules.confirmRequirementBundle('mod-multi')
  assert.equal(result.appConfirmed, true)
  assert.equal(result.alreadyConfirmed, false)
  assert.equal(result.bundle.latest?.version, 1)
  assert.equal(result.bundle.latest?.hash, result.bundle.bundleHash)
  assert.equal(result.bundle.modules.length, 2)
  const appAfterBundle = multi.db.prepare('SELECT status, requirements_confirmed_at FROM apps WHERE id = ?').get('mod-multi') as {
    status: string
    requirements_confirmed_at: string | null
  }
  assert.equal(appAfterBundle.status, 'design')
  assert.ok(appAfterBundle.requirements_confirmed_at)

  const againBundle = multi.modules.confirmRequirementBundle('mod-multi')
  assert.equal(againBundle.alreadyConfirmed, true)
  assert.equal(
    (multi.db.prepare('SELECT COUNT(*) AS c FROM app_requirement_bundles WHERE app_id = ?').get('mod-multi') as { c: number }).c,
    1
  )
})

test('模板切换/rollback/export/chat context 按模块；不传 moduleId 走默认；模板解析按模块', async () => {
  const context = await newApp('mod-ops', '模块应用')
  const first = context.doc.ensureRequirementDoc('mod-ops').doc
  const second = context.modules.createModule('mod-ops', { title: '第二模块' })
  context.doc.saveDocSection('mod-ops', 'problem', { markdown: '默认模块内容' })
  context.doc.saveDocSection('mod-ops', 'problem', { markdown: '第二模块内容' }, second.id)
  const firstVersionBefore = context.doc.ensureRequirementDoc('mod-ops').doc.version
  const secondVersionBefore = context.doc.ensureRequirementDoc('mod-ops', undefined, second.id).doc.version

  const switched = context.doc.switchDocTemplate('mod-ops', 'builtin-prd-lite', second.id)
  assert.equal(switched.sections.length, 6)
  assert.match(sectionsOf(switched, 'problem')?.markdown ?? '', /第二模块内容/)
  assert.equal(context.doc.ensureRequirementDoc('mod-ops').doc.version, firstVersionBefore)
  assert.equal(context.doc.ensureRequirementDoc('mod-ops').sections.length, 13)
  assert.equal(context.doc.ensureRequirementDoc('mod-ops', undefined, second.id).doc.version, secondVersionBefore + 1)
  // 模板解析：默认模块仍是标准 PRD；第二模块已切精简 PRD
  assert.equal(context.resolution.appRequirementTemplate('mod-ops').id, 'builtin-prd')
  assert.equal(context.resolution.appRequirementTemplate('mod-ops', second.id).id, 'builtin-prd-lite')

  const exportedDefault = context.doc.exportRequirementDoc('mod-ops')
  const exportedSecond = context.doc.exportRequirementDoc('mod-ops', second.id)
  assert.match(exportedDefault.content, /默认模块内容/)
  assert.match(exportedSecond.content, /第二模块内容/)
  assert.equal(exportedDefault.filename, '01-REQUIREMENTS.md')

  const chatDefault = context.doc.loadDocChatContext('mod-ops')
  const chatSecond = context.doc.loadDocChatContext('mod-ops', undefined, undefined, second.id)
  assert.equal(chatDefault.doc.moduleId, first.moduleId)
  assert.equal(chatSecond.doc.moduleId, second.id)
  assert.match(chatSecond.sections.find(section => section.sectionKey === 'problem')?.markdown ?? '', /第二模块内容/)

  const rolled = context.doc.rollbackDocVersion('mod-ops', secondVersionBefore, second.id)
  assert.equal(rolled.sections.length, 13)
  // v1 是空模板快照：回滚后内容清空，但不影响默认模块
  assert.equal(rolled.sections.find(section => section.sectionKey === 'problem')?.markdown, '')
  assert.equal(context.doc.ensureRequirementDoc('mod-ops').sections.length, 13)
  assert.match(
    context.doc.ensureRequirementDoc('mod-ops').sections.find(section => section.sectionKey === 'problem')?.markdown ?? '',
    /默认模块内容/
  )

  // ensureDefaultModule 不重复创建
  const defaultRow = context.modules.ensureDefaultModule('mod-ops')
  assert.equal(defaultRow.id, first.moduleId)
  assert.equal(context.modules.listModules('mod-ops').length, 2)
})

test('reopen 模块：模块回 draft + 清应用确认；bundle 仍需重新确认', async () => {
  const context = await newApp('mod-reopen', '模块应用')
  const first = context.doc.ensureRequirementDoc('mod-reopen').doc
  fillRequired(context, 'mod-reopen', first.moduleId, '模块一')
  context.doc.confirmRequirementDoc('mod-reopen')
  assert.equal(context.doc.ensureRequirementDoc('mod-reopen').doc.status, 'confirmed')

  const reopened = context.doc.reopenRequirementDoc('mod-reopen')
  assert.equal(reopened.doc.status, 'draft')
  const app = context.db.prepare('SELECT status, requirements_confirmed_at FROM apps WHERE id = ?').get('mod-reopen') as {
    status: string
    requirements_confirmed_at: string | null
  }
  assert.equal(app.status, 'requirements')
  assert.equal(app.requirements_confirmed_at, null)
})

test('MF3 取消变更恢复：多模块恢复单模块时不置应用级确认；单模块仍置位', async () => {
  const context = await newApp('mod-restore-multi', '多模块恢复')
  const first = context.doc.ensureRequirementDoc('mod-restore-multi').doc
  context.modules.createModule('mod-restore-multi', { title: '第二模块' })
  fillRequired(context, 'mod-restore-multi', first.moduleId, '模块一')
  context.doc.confirmRequirementDoc('mod-restore-multi', first.moduleId)
  const confirmed = context.doc.ensureRequirementDoc('mod-restore-multi', undefined, first.moduleId).doc
  assert.equal(confirmed.status, 'confirmed')

  const readApp = (): { status: string; requirements_confirmed_at: string | null } =>
    context.db.prepare('SELECT status, requirements_confirmed_at FROM apps WHERE id = ?').get('mod-restore-multi') as {
      status: string
      requirements_confirmed_at: string | null
    }
  // 模块二仍 draft：应用不应被标成“需求已确认”
  assert.equal(readApp().requirements_confirmed_at, null)

  const restored = context.doc.restoreRequirementDocVersionConfirmed('mod-restore-multi', confirmed.version, first.moduleId)
  assert.equal(restored.doc.status, 'confirmed')
  assert.equal(readApp().requirements_confirmed_at, null, '多模块下恢复单模块不应置应用级确认')
  assert.equal(context.modules.allRequiredModulesConfirmed('mod-restore-multi'), false)

  // 单模块：确认 + 取消恢复后仍置位（旧行为不变）
  const single = await newApp('mod-restore-single', '单模块恢复')
  const singleDoc = single.doc.ensureRequirementDoc('mod-restore-single').doc
  fillRequired(single, 'mod-restore-single', singleDoc.moduleId, '单模块')
  const confirmedSingle = single.doc.confirmRequirementDoc('mod-restore-single')
  const readSingleApp = (): { requirements_confirmed_at: string | null } =>
    single.db.prepare('SELECT requirements_confirmed_at FROM apps WHERE id = ?').get('mod-restore-single') as {
      requirements_confirmed_at: string | null
    }
  assert.ok(readSingleApp().requirements_confirmed_at)

  const restoredSingle = single.doc.restoreRequirementDocVersionConfirmed(
    'mod-restore-single',
    confirmedSingle.payload.doc.version
  )
  assert.equal(restoredSingle.doc.status, 'confirmed')
  assert.ok(readSingleApp().requirements_confirmed_at, '单模块恢复后应保持应用级确认')
})
