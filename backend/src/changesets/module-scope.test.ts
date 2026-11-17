/**
 * #6 M5：变更单模块范围 + 设计输入 v2 + 覆盖度总览 + 取消按模块恢复。
 *
 * 覆盖：
 * - startChangeSet 选择子集（模块行 base/current/hash/template；选中模块回 draft；未选模块不动）
 * - 默认全选 / moduleIds 非法（空/重复/不存在/归档）400 且不写库；单模块回归
 * - 编辑门禁：未选模块需求/设计写 409；选中模块正常；应用级整体操作 409
 * - 模块管理：变更中新增自动入范围、归档 409、非需求阶段 update/order/archive 409
 * - 取消子集：只恢复选中模块（需求/设计/模板/输入）、未选逐行不变、bundle 重新生成、app/session 恢复
 * - 升级 scope 只影响选中模块；历史 ChangeSetView.modules 版本区间/hash
 * - 设计输入 v2：bundleVersion/hash、同 docHash 复用更新、stale 只按模块 docHash、bundleDrift 仅提示
 * - 设计总览：逐模块覆盖/未覆盖/缺图 + 汇总，只读不建行
 * - 删除应用清理 app_change_set_modules
 *
 * 临时 RG_DATA_DIR/RG_PROJECTS_DIR；不调模型/不启动 opencode。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-m5-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
const projectsDir = path.join(root, 'projects')

interface Setup {
  db: typeof import('../db').db
  doc: typeof import('../requirements/doc')
  modules: typeof import('../requirements/modules')
  design: typeof import('../design/service')
  input: typeof import('../design/input')
  changes: typeof import('../changesets/service')
  query: typeof import('../changesets/query')
  handoff: typeof import('../handoff/design-service')
  payload: typeof import('../apps/payload')
}

let setup: Setup
let server: Server | null = null
let base = ''

const TABLES = [
  'app_design_pages',
  'app_design_page_sets',
  'app_design_entities',
  'app_design_versions',
  'app_design_inputs',
  'app_design_projects',
  'app_requirement_doc_versions',
  'app_requirement_doc_sections',
  'app_requirement_docs',
  'app_requirement_bundles',
  'app_modules',
  'design_handoffs',
  'app_stage_events',
  'app_sessions',
  'app_dev_phases'
]

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03])

before(async () => {
  const dbModule = await import('../db')
  const doc = await import('../requirements/doc')
  const modules = await import('../requirements/modules')
  const design = await import('../design/service')
  const input = await import('../design/input')
  const changes = await import('../changesets/service')
  const query = await import('../changesets/query')
  const handoff = await import('../handoff/design-service')
  const payload = await import('../apps/payload')
  setup = { db: dbModule.db, doc, modules, design, input, changes, query, handoff, payload }

  const express = (await import('express')).default
  const { apps, appsErrorHandler } = await import('../apps/routes')
  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/apps', apps)
  app.use('/api/apps', appsErrorHandler)
  server = app.listen(0)
  await new Promise<void>(resolve => server?.once('listening', () => resolve()))
  const address = server.address() as AddressInfo
  base = `http://127.0.0.1:${address.port}`
})

after(() => {
  server?.close()
  try {
    setup?.db.close()
  } catch {
    // 已关闭
  }
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // Windows 上 SQLite 句柄释放可能滞后
  }
})

function cleanApp(appId: string): void {
  setup.db
    .prepare(
      'DELETE FROM app_change_set_modules WHERE change_set_id IN (SELECT id FROM app_change_sets WHERE app_id = ?)'
    )
    .run(appId)
  for (const table of TABLES) setup.db.prepare(`DELETE FROM ${table} WHERE app_id = ?`).run(appId)
  setup.db.prepare('DELETE FROM app_change_sets WHERE app_id = ?').run(appId)
  setup.db.prepare('DELETE FROM apps WHERE id = ?').run(appId)
}

function newApp(id: string): void {
  cleanApp(id)
  const now = new Date().toISOString()
  setup.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 8081, 'requirements', ?, ?)`
    )
    .run(id, `应用 ${id}`, id, now, now)
  fs.mkdirSync(path.join(projectsDir, id), { recursive: true })
}

function count(table: string, appId: string, extra = ''): number {
  const row = setup.db
    .prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE app_id = ?${extra}`)
    .get(appId) as { c: number }
  return row.c
}

function appStatus(appId: string): {
  status: string
  requirements_confirmed_at: string | null
  design_confirmed_at: string | null
  current_change_set_id: string | null
} {
  return setup.db
    .prepare('SELECT status, requirements_confirmed_at, design_confirmed_at, current_change_set_id FROM apps WHERE id = ?')
    .get(appId) as never
}

function fillAndConfirmModule(appId: string, moduleId: string, tag: string): void {
  const payload = setup.doc.ensureRequirementDoc(appId, undefined, moduleId)
  for (const section of payload.sections) {
    if (!section.required) continue
    if (section.kind === 'scenes') {
      setup.doc.saveDocSection(
        appId,
        'scenes',
        { data: { scenes: [{ title: `${tag} 场景`, description: `${tag} 场景说明` }], epics: [], stories: [] } },
        moduleId
      )
      continue
    }
    if (section.kind === 'epics') {
      setup.doc.saveDocSection(
        appId,
        'epics',
        {
          data: {
            scenes: [],
            epics: [{ title: `${tag} Epic`, goal: `${tag} 目标`, priority: 'P0' }],
            stories: [{ title: `${tag} 创建`, description: `${tag} 创建流程`, acceptance: ['保存成功'], priority: 'P0' }]
          }
        },
        moduleId
      )
      continue
    }
    if (section.markdown.trim()) continue
    setup.doc.saveDocSection(appId, section.sectionKey, { markdown: `${tag}：${section.title}` }, moduleId)
  }
  setup.doc.confirmRequirementDoc(appId, moduleId)
}

function buildConfirmedDesign(
  appId: string,
  moduleId: string,
  entityId: string,
  name: string,
  tableName: string,
  storyLimit: number
): string[] {
  const project = setup.design.getDesign(appId, moduleId)
  const stories = (project.input?.stories ?? []).slice(0, storyLimit).map(story => story.id)
  setup.design.saveEntities(
    appId,
    [
      {
        id: entityId,
        name,
        tableName,
        fields: [{ name: 'id', label: 'ID', type: 'string', unique: true }],
        relations: [],
        requirementRefs: stories,
        status: 'confirmed'
      }
    ],
    'manual',
    { moduleId }
  )
  setup.design.generateDefaultPageSets(appId, moduleId)
  const generated = setup.design.getDesign(appId, moduleId)
  const pageIds: string[] = []
  for (const set of generated.pageSets) {
    for (const page of set.pages) {
      pageIds.push(page.id)
      setup.design.savePageSnapshot(appId, page.id, {
        imageBase64: `data:image/png;base64,${PNG.toString('base64')}`,
        html: `<div>${page.title}</div>`
      }, moduleId)
    }
  }
  const afterSnapshot = setup.design.getDesign(appId, moduleId)
  setup.design.savePageSets(
    appId,
    afterSnapshot.pageSets.map(set => ({
      ...set,
      status: 'confirmed' as const,
      pages: set.pages.map(page => ({ ...page, status: 'confirmed' as const }))
    })),
    'manual',
    { moduleId }
  )
  setup.design.confirmDesign(appId, moduleId)
  return pageIds
}

/** 插入 fake 交接包 v1（M5 fixture：M6a 前用 fake 包提供基线；M6a 已可真实生成多模块交接包） */
function fakeHandoff(appId: string, templateId: string): string {
  const now = new Date().toISOString()
  setup.db
    .prepare(
      `INSERT INTO design_handoffs
        (app_id, version, hash, docs_dir, files_json, change_set_id, baseline_handoff_version,
         source_design_json, source_requirements_json, manifest_json, created_at)
       VALUES (?, 1, 'h1', 'docs/handoff', '[]', NULL, NULL, ?, '{}', '{}', ?)`
    )
    .run(appId, JSON.stringify({ templateId }), now)
  return 'cs-initial'
}

function insertInitialChangeSet(appId: string): string {
  const now = new Date().toISOString()
  const id = `cs-initial-${appId}`
  setup.db
    .prepare(
      `INSERT INTO app_change_sets (id, app_id, seq, title, description, scope, status, created_at, updated_at, completed_at)
       VALUES (?, ?, 1, '初始开发', '', 'requirements', 'completed', ?, ?, ?)`
    )
    .run(id, appId, now, now, now)
  return id
}

interface ReadyApp {
  moduleA: string
  moduleB: string
  archivedModule: string
  storyIdsA: string[]
  storyIdsB: string[]
}

/** 两模块（A 商品、B 订单、C 归档）已确认需求/设计 + fake 交接包 + development + 变更单 #1 */
function readyTwoModuleApp(appId: string): ReadyApp {
  newApp(appId)
  const moduleA = setup.modules.ensureDefaultModule(appId).id
  const archived = setup.modules.createModule(appId, { title: '归档模块' })
  setup.modules.archiveModule(appId, archived.id)
  const moduleB = setup.modules.createModule(appId, { title: '订单管理' }).id
  fillAndConfirmModule(appId, moduleA, '商品')
  fillAndConfirmModule(appId, moduleB, '订单')
  setup.modules.confirmRequirementBundle(appId)
  buildConfirmedDesign(appId, moduleA, `${appId}-ent-a`, '商品', 'biz_product', 1)
  buildConfirmedDesign(appId, moduleB, `${appId}-ent-b`, '订单', 'biz_order', 0)
  const templateId = setup.design.getDesign(appId, moduleA).template.id
  fakeHandoff(appId, templateId)
  insertInitialChangeSet(appId)
  const now = new Date().toISOString()
  setup.db.prepare("UPDATE apps SET status = 'development', updated_at = ? WHERE id = ?").run(now, appId)
  return {
    moduleA,
    moduleB,
    archivedModule: archived.id,
    storyIdsA: (setup.design.getDesign(appId, moduleA).input?.stories ?? []).map(story => story.id),
    storyIdsB: (setup.design.getDesign(appId, moduleB).input?.stories ?? []).map(story => story.id)
  }
}

/** 单模块应用（需求确认即进入设计） */
function readySingleModuleApp(appId: string): string {
  newApp(appId)
  const moduleId = setup.modules.ensureDefaultModule(appId).id
  fillAndConfirmModule(appId, moduleId, '单模块')
  buildConfirmedDesign(appId, moduleId, `${appId}-ent`, '客户', 'biz_customer', 0)
  const templateId = setup.design.getDesign(appId, moduleId).template.id
  fakeHandoff(appId, templateId)
  insertInitialChangeSet(appId)
  const now = new Date().toISOString()
  setup.db.prepare("UPDATE apps SET status = 'development', updated_at = ? WHERE id = ?").run(now, appId)
  return moduleId
}

function moduleRow(changeSetId: string, moduleId: string): import('../changesets/query').ChangeSetModuleRow | undefined {
  return setup.query.changeSetModuleRows(changeSetId).find(row => row.module_id === moduleId)
}

function throwsStatus(fn: () => unknown, status: number, pattern: RegExp): void {
  assert.throws(fn, (error: { status?: number; message?: string }) => error.status === status && pattern.test(String(error.message)))
}

test('M5-1 startChangeSet 选择子集：模块行/基线 hash/模板；选中回 draft；未选文档/设计/版本/输入不动', () => {
  const appId = 'm5-subset'
  const ready = readyTwoModuleApp(appId)
  const baseDocA = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleA)
  const baseDocB = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB)
  const baseDesignAHash = setup.design.currentDesignStateHash(appId, ready.moduleA)
  const baseDesignB = setup.design.getDesign(appId, ready.moduleB)
  const bInputsBefore = count('app_design_inputs', appId, ` AND module_id = '${ready.moduleB}'`)
  const bVersionsBefore = count('app_design_versions', appId, ` AND module_id = '${ready.moduleB}'`)
  const bReqVersionsBefore = count('app_requirement_doc_versions', appId, ` AND module_id = '${ready.moduleB}'`)
  const bDesignTemplate = setup.design.getDesign(appId, ready.moduleB).template.id

  const { changeSet } = setup.changes.startChangeSet(appId, {
    title: '只改商品',
    scope: 'requirements',
    moduleIds: [ready.moduleA]
  })
  assert.equal(changeSet.seq, 2)
  assert.equal(changeSet.modules.length, 1)
  assert.equal(changeSet.modules[0].moduleId, ready.moduleA)
  assert.equal(changeSet.modules[0].reqBaseVersion, baseDocA.doc.version)
  assert.equal(changeSet.modules[0].reqCurrentVersion, baseDocA.doc.version)
  assert.equal(changeSet.modules[0].designBaseVersion, setup.query.changeSetModuleRows(changeSet.id)[0].design_base_version)
  assert.equal(changeSet.modules[0].templateId, setup.design.getDesign(appId, ready.moduleA).template.id)
  assert.match(changeSet.modules[0].reqBaseHash ?? '', /^[0-9a-f]{64}$/)
  assert.match(changeSet.modules[0].designBaseHash ?? '', /^[0-9a-f]{64}$/)

  const row = moduleRow(changeSet.id, ready.moduleA)
  assert.ok(row)
  assert.equal(row?.req_base_hash, changeSet.modules[0].reqBaseHash)
  assert.equal(row?.design_base_hash, changeSet.modules[0].designBaseHash)
  assert.equal(row?.design_base_template_id, setup.design.getDesign(appId, ready.moduleA).template.id)
  assert.equal(row?.design_base_hash, baseDesignAHash)

  // 选中模块需求/设计回 draft；未选模块逐行不变
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleA).doc.status, 'draft')
  assert.equal(setup.design.designSummary(appId, ready.moduleA)?.status, 'draft')
  const afterDocB = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB)
  assert.equal(afterDocB.doc.status, 'confirmed')
  assert.equal(afterDocB.doc.version, baseDocB.doc.version)
  assert.equal(afterDocB.doc.contentMd, baseDocB.doc.contentMd)
  const afterDesignB = setup.design.getDesign(appId, ready.moduleB)
  assert.equal(afterDesignB.status, 'confirmed')
  assert.equal(afterDesignB.version, baseDesignB.version)
  assert.equal(afterDesignB.entities.length, baseDesignB.entities.length)
  assert.equal(afterDesignB.pageSets.length, baseDesignB.pageSets.length)
  assert.equal(count('app_design_inputs', appId, ` AND module_id = '${ready.moduleB}'`), bInputsBefore)
  assert.equal(count('app_design_versions', appId, ` AND module_id = '${ready.moduleB}'`), bVersionsBefore)
  assert.equal(count('app_requirement_doc_versions', appId, ` AND module_id = '${ready.moduleB}'`), bReqVersionsBefore)
  assert.equal(setup.design.getDesign(appId, ready.moduleB).template.id, bDesignTemplate)

  const app = appStatus(appId)
  assert.equal(app.status, 'requirements')
  assert.equal(app.requirements_confirmed_at, null)
  assert.equal(app.current_change_set_id, changeSet.id)
  const event = setup.db
    .prepare("SELECT detail FROM app_stage_events WHERE app_id = ? AND event = 'change-set-started' ORDER BY rowid DESC LIMIT 1")
    .get(appId) as { detail: string }
  assert.deepEqual(JSON.parse(event.detail).moduleIds, [ready.moduleA])
})

test('M5-2 默认全选 / moduleIds 校验（空/重复/不存在/归档）/ 单模块回归', () => {
  const appId = 'm5-defaults'
  const ready = readyTwoModuleApp(appId)
  const changeSetsBefore = count('app_change_sets', appId)
  throwsStatus(() => setup.changes.startChangeSet(appId, { title: '空', moduleIds: [] }), 400, /不能为空/)
  throwsStatus(
    () => setup.changes.startChangeSet(appId, { title: '重复', moduleIds: [ready.moduleA, ready.moduleA] }),
    400,
    /不能重复/
  )
  throwsStatus(() => setup.changes.startChangeSet(appId, { title: '不存在', moduleIds: ['ghost'] }), 400, /不存在或已归档/)
  throwsStatus(() => setup.changes.startChangeSet(appId, { title: '归档', moduleIds: [ready.archivedModule] }), 400, /不存在或已归档/)
  assert.equal(count('app_change_sets', appId), changeSetsBefore)
  assert.equal(
    (setup.db
      .prepare(
        'SELECT COUNT(*) AS c FROM app_change_set_modules WHERE change_set_id IN (SELECT id FROM app_change_sets WHERE app_id = ?)'
      )
      .get(appId) as { c: number }).c,
    0
  )

  const all = setup.changes.startChangeSet(appId, { title: '默认全选' })
  assert.equal(all.changeSet.modules.length, 2)
  assert.deepEqual(all.changeSet.modules.map(item => item.moduleId).sort(), [ready.moduleA, ready.moduleB].sort())

  const singleId = 'm5-single'
  const singleModule = readySingleModuleApp(singleId)
  const single = setup.changes.startChangeSet(singleId, { title: '单模块回归' })
  assert.equal(single.changeSet.modules.length, 1)
  assert.equal(single.changeSet.modules[0].moduleId, singleModule)
  assert.equal(single.changeSet.status, 'requirements')
  assert.equal(setup.doc.ensureRequirementDoc(singleId).doc.status, 'draft')
  assert.equal(appStatus(singleId).status, 'requirements')
})

test('M5-3 编辑门禁：未选模块需求/设计写 409；选中模块正常；应用级整体操作 409', () => {
  const appId = 'm5-gates'
  const ready = readyTwoModuleApp(appId)
  setup.changes.startChangeSet(appId, { title: '只改 A', scope: 'requirements', moduleIds: [ready.moduleA] })
  const templateId = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleA).doc.templateId

  // 未选 B：需求写路径 409
  throwsStatus(() => setup.doc.saveDocSection(appId, 'problem', { markdown: '改 B' }, ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.doc.saveDoc(appId, { contentMd: '# x\n\n## 问题\n\nB' }, ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.doc.switchDocTemplate(appId, templateId, ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.doc.confirmRequirementDoc(appId, ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.doc.reopenRequirementDoc(appId, ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.doc.createManualDocVersion(appId, ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.doc.rollbackDocVersion(appId, 1, ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.doc.rebuildRequirementOutline(appId, undefined, ready.moduleB), 409, /未包含模块/)

  // 未选 B：设计写路径 409
  const bProject = setup.design.getDesign(appId, ready.moduleB)
  throwsStatus(
    () => setup.design.saveEntities(appId, bProject.entities, 'manual', { moduleId: ready.moduleB }),
    409,
    /未包含模块/
  )
  throwsStatus(() => setup.design.generateDefaultPageSets(appId, ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.design.confirmDesign(appId, ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.design.reopenDesign(appId, ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.design.syncDesignInput(appId, 'preview', ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.design.switchProtoTemplate(appId, bProject.template.id, ready.moduleB), 409, /未包含模块/)
  throwsStatus(() => setup.design.createDesignVersion(appId, ready.moduleB), 409, /未包含模块/)

  // 应用级整体操作（模板切换）拒绝
  throwsStatus(() => setup.doc.switchDocTemplateForApp(appId, templateId), 409, /只包含/)
  throwsStatus(() => setup.design.switchAppProtoTemplate(appId, bProject.template.id), 409, /只包含/)

  // 选中 A：正常编辑/确认
  const edited = setup.doc.saveDocSection(appId, 'problem', { markdown: 'A 的问题' }, ready.moduleA)
  assert.equal(edited.doc.status, 'draft')
  const confirmed = setup.doc.confirmRequirementDoc(appId, ready.moduleA)
  assert.equal(confirmed.payload.doc.status, 'confirmed')
  setup.design.syncDesignInput(appId, 'additions', ready.moduleA)
  const designConfirmed = setup.design.confirmDesign(appId, ready.moduleA)
  assert.equal(designConfirmed.moduleId, ready.moduleA)
})

test('M5-4 模块管理：变更中新增自动入范围、归档 409；非需求阶段 update/order/archive/restore 409', () => {
  const appId = 'm5-modules'
  const ready = readyTwoModuleApp(appId)
  const { changeSet } = setup.changes.startChangeSet(appId, { title: '只改 A', scope: 'requirements', moduleIds: [ready.moduleA] })
  const beforeVersion = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB).doc.version

  const created = setup.modules.createModule(appId, { title: '支付管理' })
  const view = setup.query.changeSetModulesView(changeSet.id)
  assert.equal(view.length, 2)
  const row = view.find(item => item.moduleId === created.id)
  assert.ok(row)
  assert.equal(row?.reqBaseVersion, null)
  assert.equal(row?.reqCurrentVersion, 1)
  assert.match(row?.reqCurrentHash ?? '', /^[0-9a-f]{64}$/)

  throwsStatus(() => setup.modules.archiveModule(appId, ready.moduleB), 409, /变更进行中不能归档/)

  // 元数据可改但版本不变
  setup.modules.updateModule(appId, ready.moduleB, { title: '订单管理（改）' })
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB).doc.version, beforeVersion)
  const activeIds = setup.modules.listModules(appId).map(module => module.id)
  setup.modules.reorderModules(appId, [...activeIds].reverse())
  // 归档模块恢复允许（不进入本次范围）
  setup.modules.restoreModule(appId, ready.archivedModule)

  // 非需求阶段：update/order/archive/restore 全部 409
  const otherId = 'm5-modules-dev'
  readyTwoModuleApp(otherId)
  setup.db.prepare("UPDATE apps SET status = 'development' WHERE id = ?").run(otherId)
  throwsStatus(() => setup.modules.updateModule(otherId, ready.moduleB, { title: 'x' }), 409, /当前阶段/)
  throwsStatus(() => setup.modules.reorderModules(otherId, [...activeIds]), 409, /当前阶段/)
  throwsStatus(() => setup.modules.archiveModule(otherId, ready.moduleB), 409, /当前阶段/)
  throwsStatus(() => setup.modules.restoreModule(otherId, ready.moduleA), 409, /当前阶段/)
})

test('M5-5 取消子集：只恢复选中模块（需求/设计/模板/输入），未选逐行不变；bundle 重新生成；app/session 恢复', () => {
  const appId = 'm5-cancel'
  const ready = readyTwoModuleApp(appId)
  const baseDocA = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleA)
  const baseBundle = setup.modules.requirementBundleView(appId).latest
  assert.ok(baseBundle)
  const baseDesignA = setup.design.getDesign(appId, ready.moduleA)
  const bDocBefore = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB)
  const bDesignBefore = setup.design.getDesign(appId, ready.moduleB)
  const bInputsBefore = count('app_design_inputs', appId, ` AND module_id = '${ready.moduleB}'`)
  const bVersionsBefore = count('app_design_versions', appId, ` AND module_id = '${ready.moduleB}'`)
  const bReqVersionsBefore = count('app_requirement_doc_versions', appId, ` AND module_id = '${ready.moduleB}'`)
  const appBefore = appStatus(appId)
  const baseChangeSetId = appBefore.current_change_set_id

  const { changeSet } = setup.changes.startChangeSet(appId, {
    title: '取消子集',
    scope: 'requirements',
    moduleIds: [ready.moduleA]
  })

  // 改 A 需求并确认、同步 + 确认设计（产生已确认差异）
  setup.doc.saveDocSection(
    appId,
    'epics',
    {
      data: {
        scenes: [],
        epics: [{ title: '商品 Epic（改）', goal: '商品目标', priority: 'P0' }],
        stories: [
          { id: ready.storyIdsA[0], title: '商品创建（改）', description: '改后', acceptance: ['保存成功'], priority: 'P0' }
        ]
      }
    },
    ready.moduleA
  )
  setup.doc.confirmRequirementDoc(appId, ready.moduleA)
  setup.design.syncDesignInput(appId, 'additions', ready.moduleA)
  setup.design.confirmDesign(appId, ready.moduleA)

  const cancelled = setup.changes.cancelChangeSet(appId, changeSet.id)
  assert.equal(cancelled.changeSet.status, 'cancelled')
  assert.equal(cancelled.restored.modules.length, 1)
  assert.equal(cancelled.restored.modules[0].moduleId, ready.moduleA)
  assert.ok((cancelled.restored.bundleVersion ?? 0) > (baseBundle?.version ?? 0))
  assert.equal(cancelled.restored.appStatus, 'development')

  // A 恢复基线内容/确认，版本追加
  const docAAfter = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleA)
  assert.equal(docAAfter.doc.status, 'confirmed')
  assert.equal(docAAfter.doc.contentMd, baseDocA.doc.contentMd)
  assert.ok(docAAfter.doc.version > baseDocA.doc.version)
  const designAAfter = setup.design.getDesign(appId, ready.moduleA)
  assert.equal(designAAfter.status, 'confirmed')
  assert.ok(designAAfter.version > baseDesignA.version)
  assert.equal(designAAfter.template.id, baseDesignA.template.id)

  // 未选 B 逐行不变
  const docBAfter = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB)
  assert.equal(docBAfter.doc.status, 'confirmed')
  assert.equal(docBAfter.doc.version, bDocBefore.doc.version)
  assert.equal(docBAfter.doc.contentMd, bDocBefore.doc.contentMd)
  const designBAfter = setup.design.getDesign(appId, ready.moduleB)
  assert.equal(designBAfter.status, 'confirmed')
  assert.equal(designBAfter.version, bDesignBefore.version)
  assert.equal(count('app_design_inputs', appId, ` AND module_id = '${ready.moduleB}'`), bInputsBefore)
  assert.equal(count('app_design_versions', appId, ` AND module_id = '${ready.moduleB}'`), bVersionsBefore)
  assert.equal(count('app_requirement_doc_versions', appId, ` AND module_id = '${ready.moduleB}'`), bReqVersionsBefore)

  // 应用恢复到之前状态/变更单；需求 bundle 在取消事务内重新生成
  const appAfter = appStatus(appId)
  assert.equal(appAfter.status, 'development')
  assert.equal(appAfter.current_change_set_id, baseChangeSetId)
  const latest = setup.modules.requirementBundleView(appId).latest
  assert.ok(latest)
  assert.equal(latest?.version, cancelled.restored.bundleVersion)
  assert.notEqual(latest?.changeSetId, changeSet.id)

  // 模块行 current 已更新为恢复后的版本
  const row = moduleRow(changeSet.id, ready.moduleA)
  assert.equal(row?.req_current_version, docAAfter.doc.version)
  assert.equal(row?.design_current_version, designAAfter.version)
})

test('M5-6 升级 scope：只重开选中模块需求+设计，其它模块保持 confirmed', () => {
  const appId = 'm5-upgrade'
  const ready = readyTwoModuleApp(appId)
  const bDocBefore = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB).doc.version
  const bDesignBefore = setup.design.designSummary(appId, ready.moduleB)?.version
  const { changeSet } = setup.changes.startChangeSet(appId, { title: '仅设计', scope: 'design', moduleIds: [ready.moduleA] })
  assert.equal(appStatus(appId).status, 'design')
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleA).doc.status, 'confirmed')

  setup.changes.upgradeChangeSetScope(appId, changeSet.id, 'requirements')
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleA).doc.status, 'draft')
  assert.equal(setup.design.designSummary(appId, ready.moduleA)?.status, 'draft')
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB).doc.status, 'confirmed')
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB).doc.version, bDocBefore)
  assert.equal(setup.design.designSummary(appId, ready.moduleB)?.version, bDesignBefore)
  assert.equal(appStatus(appId).status, 'requirements')
  const view = setup.changes.listChangeSets(appId).active
  assert.equal(view?.scope, 'requirements')
  assert.equal(view?.modules.length, 1)
})

test('M5-7 历史视图 modules：版本区间/hash/模板', () => {
  const appId = 'm5-history'
  const ready = readyTwoModuleApp(appId)
  const baseDoc = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleA)
  const { changeSet } = setup.changes.startChangeSet(appId, { title: '历史', scope: 'requirements', moduleIds: [ready.moduleA] })
  setup.doc.saveDocSection(appId, 'problem', { markdown: '历史问题' }, ready.moduleA)
  setup.doc.confirmRequirementDoc(appId, ready.moduleA)
  setup.design.syncDesignInput(appId, 'additions', ready.moduleA)
  setup.design.confirmDesign(appId, ready.moduleA)

  const active = setup.changes.listChangeSets(appId).active
  assert.ok(active)
  assert.equal(active?.modules.length, 1)
  const module = active?.modules[0]
  assert.equal(module?.moduleKey.length, 7)
  assert.equal(module?.reqBaseVersion, baseDoc.doc.version)
  assert.ok((module?.reqCurrentVersion ?? 0) > (module?.reqBaseVersion ?? 0))
  assert.ok((module?.designCurrentVersion ?? 0) > (module?.designBaseVersion ?? 0))
  assert.notEqual(module?.reqBaseHash, module?.reqCurrentHash)
  assert.match(module?.designBaseHash ?? '', /^[0-9a-f]{64}$/)
  assert.equal(module?.templateId, setup.design.getDesign(appId, ready.moduleA).template.id)
  assert.equal(module?.moduleId, ready.moduleA)
  void changeSet
})

test('M5-8 设计输入 v2：bundleVersion/hash、同 docHash 复用更新、stale 只按模块 docHash、bundleDrift 仅提示', () => {
  const appId = 'm5-input-v2'
  const ready = readyTwoModuleApp(appId)
  const latestBundle = setup.modules.latestRequirementBundle(appId)
  assert.ok(latestBundle)

  const inputA1 = setup.input.latestDesignInput(appId, ready.moduleA)
  const inputB1 = setup.input.latestDesignInput(appId, ready.moduleB)
  assert.equal(inputA1.bundleVersion, latestBundle?.version)
  assert.equal(inputA1.bundleHash, latestBundle?.hash)
  assert.equal(inputB1.bundleVersion, latestBundle?.version)
  const rowsBefore = count('app_design_inputs', appId, ` AND module_id = '${ready.moduleA}'`)

  // 内容不变、仅 bundle 版本递增：同 docHash 复用同一输入行并更新 bundle 字段
  const nextBundle = setup.modules.createRequirementBundleSnapshot(appId, { requireConfirmed: true })
  assert.equal(nextBundle.version, (latestBundle?.version ?? 0) + 1)
  assert.equal(nextBundle.hash, latestBundle?.hash)
  const inputA2 = setup.input.latestDesignInput(appId, ready.moduleA)
  assert.equal(inputA2.id, inputA1.id)
  assert.equal(inputA2.bundleVersion, nextBundle.version)
  assert.equal(inputA2.bundleHash, nextBundle.hash)
  assert.equal(count('app_design_inputs', appId, ` AND module_id = '${ready.moduleA}'`), rowsBefore)

  // 改 A 需求 → A stale；B 不 stale，仅 bundleDrift 提示
  setup.changes.startChangeSet(appId, { title: '改 A', scope: 'requirements', moduleIds: [ready.moduleA] })
  setup.doc.saveDocSection(appId, 'problem', { markdown: 'A 新问题' }, ready.moduleA)
  setup.doc.confirmRequirementDoc(appId, ready.moduleA)
  const newerBundle = setup.modules.createRequirementBundleSnapshot(appId, { requireConfirmed: true })
  assert.notEqual(newerBundle.hash, nextBundle.hash)

  const projectA = setup.design.getDesign(appId, ready.moduleA)
  assert.equal(projectA.stale.stale, true)
  const projectB = setup.design.getDesign(appId, ready.moduleB)
  assert.equal(projectB.stale.stale, false)
  assert.equal(projectB.stale.bundleDrift, true)
  assert.equal(projectB.input?.docHash, inputB1.docHash)
})

test('M5-9 设计总览：逐模块覆盖率/未覆盖 Story/缺图 + 汇总；只读不建项目/版本/输入', () => {
  const appId = 'm5-overview'
  const ready = readyTwoModuleApp(appId)
  // A 覆盖 1 条 Story，B 0 条；B 去掉 1 张图片 → 缺图 1
  // 测试 fixture：清掉 B 页面集/页面需求引用（生产由设计生成决定，这里只构造“未覆盖”场景）
  setup.db
    .prepare("UPDATE app_design_page_sets SET epic_id = NULL, story_ids_json = '[]' WHERE app_id = ? AND module_id = ?")
    .run(appId, ready.moduleB)
  setup.db
    .prepare("UPDATE app_design_pages SET requirement_refs_json = '[]' WHERE app_id = ? AND module_id = ?")
    .run(appId, ready.moduleB)
  const bPage = setup.design.getDesign(appId, ready.moduleB).pageSets.flatMap(set => set.pages)[0]
  setup.db.prepare('UPDATE app_design_pages SET image_path = NULL WHERE id = ?').run(bPage.id)

  const countsBefore = JSON.stringify({
    projects: count('app_design_projects', appId),
    versions: count('app_design_versions', appId),
    inputs: count('app_design_inputs', appId),
    entities: count('app_design_entities', appId),
    pageSets: count('app_design_page_sets', appId),
    pages: count('app_design_pages', appId)
  })
  const overview = setup.design.designOverview(appId)
  const countsAfter = JSON.stringify({
    projects: count('app_design_projects', appId),
    versions: count('app_design_versions', appId),
    inputs: count('app_design_inputs', appId),
    entities: count('app_design_entities', appId),
    pageSets: count('app_design_page_sets', appId),
    pages: count('app_design_pages', appId)
  })
  assert.equal(countsAfter, countsBefore)

  assert.equal(overview.modules.length, 2)
  const moduleA = overview.modules.find(module => module.moduleId === ready.moduleA)
  const moduleB = overview.modules.find(module => module.moduleId === ready.moduleB)
  assert.ok(moduleA && moduleB)
  assert.equal(moduleA?.status, 'confirmed')
  assert.equal(moduleA?.coverage.storyTotal, 1)
  assert.equal(moduleA?.coverage.coveredStories, 1)
  assert.equal(moduleA?.coverage.rate, 1)
  assert.equal(moduleA?.coverage.uncovered.length, 0)
  assert.equal(moduleB?.coverage.storyTotal, 1)
  assert.equal(moduleB?.coverage.coveredStories, 0)
  assert.equal(moduleB?.coverage.uncovered.length, 1)
  assert.equal(moduleB?.missingImages, 1)

  assert.equal(overview.summary.moduleCount, 2)
  assert.equal(overview.summary.confirmed, 2)
  assert.equal(overview.summary.storyTotal, 2)
  assert.equal(overview.summary.coveredStories, 1)
  assert.equal(overview.summary.rate, 0.5)
  assert.equal(overview.summary.missingImages, 1)
  assert.ok(overview.bundle)
  assert.equal(overview.bundle?.version, setup.modules.latestRequirementBundle(appId)?.version)
})

test('M5-11 MF-M5-1 取消含“变更中新增模块”：新增模块自动归档、内容保留、bundle 排除', () => {
  const appId = 'm5-cancel-new-module'
  const ready = readyTwoModuleApp(appId)
  const baseDocA = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleA)
  const baseDesignA = setup.design.getDesign(appId, ready.moduleA)
  const bDocBefore = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB)
  const bDesignBefore = setup.design.getDesign(appId, ready.moduleB)
  const bInputsBefore = count('app_design_inputs', appId, ` AND module_id = '${ready.moduleB}'`)
  const bVersionsBefore = count('app_design_versions', appId, ` AND module_id = '${ready.moduleB}'`)
  const latestBefore = setup.modules.latestRequirementBundle(appId)
  assert.ok(latestBefore)

  const { changeSet } = setup.changes.startChangeSet(appId, {
    title: '新增模块后取消',
    scope: 'requirements',
    moduleIds: [ready.moduleA]
  })
  const created = setup.modules.createModule(appId, { title: '支付管理' })
  const newRow = moduleRow(changeSet.id, created.id)
  assert.ok(newRow)
  assert.equal(newRow?.req_base_version, null)
  assert.equal(newRow?.design_base_version, null)
  fillAndConfirmModule(appId, created.id, '支付')
  buildConfirmedDesign(appId, created.id, `${appId}-ent-c`, '支付', 'biz_payment', 1)

  // A 产生已确认需求差异（满足可取消门禁）
  setup.doc.saveDocSection(appId, 'problem', { markdown: 'A 取消前的问题' }, ready.moduleA)
  setup.doc.confirmRequirementDoc(appId, ready.moduleA)

  const newModuleCountsBefore = JSON.stringify({
    docs: count('app_requirement_docs', appId, ` AND module_id = '${created.id}'`),
    sections: count('app_requirement_doc_sections', appId, ` AND module_id = '${created.id}'`),
    reqVersions: count('app_requirement_doc_versions', appId, ` AND module_id = '${created.id}'`),
    projects: count('app_design_projects', appId, ` AND module_id = '${created.id}'`),
    entities: count('app_design_entities', appId, ` AND module_id = '${created.id}'`),
    designVersions: count('app_design_versions', appId, ` AND module_id = '${created.id}'`)
  })

  const cancelled = setup.changes.cancelChangeSet(appId, changeSet.id)
  assert.equal(cancelled.changeSet.status, 'cancelled')
  assert.equal(cancelled.restored.appStatus, 'development')

  // C 被归档，内容/版本/设计数据全部保留
  const newModuleAfter = setup.modules.moduleById(appId, created.id)
  assert.ok(newModuleAfter?.archived_at, '变更中新增模块取消后应归档')
  const newModuleCountsAfter = JSON.stringify({
    docs: count('app_requirement_docs', appId, ` AND module_id = '${created.id}'`),
    sections: count('app_requirement_doc_sections', appId, ` AND module_id = '${created.id}'`),
    reqVersions: count('app_requirement_doc_versions', appId, ` AND module_id = '${created.id}'`),
    projects: count('app_design_projects', appId, ` AND module_id = '${created.id}'`),
    entities: count('app_design_entities', appId, ` AND module_id = '${created.id}'`),
    designVersions: count('app_design_versions', appId, ` AND module_id = '${created.id}'`)
  })
  assert.equal(newModuleCountsAfter, newModuleCountsBefore)
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, created.id).doc.status, 'confirmed')
  assert.equal(setup.design.designSummary(appId, created.id)?.status, 'confirmed')

  // A 恢复基线；B 逐行不变
  const docAAfter = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleA)
  assert.equal(docAAfter.doc.status, 'confirmed')
  assert.equal(docAAfter.doc.contentMd, baseDocA.doc.contentMd)
  assert.ok(docAAfter.doc.version > baseDocA.doc.version)
  const designAAfter = setup.design.getDesign(appId, ready.moduleA)
  assert.equal(designAAfter.status, 'confirmed')
  assert.ok(designAAfter.version > baseDesignA.version)
  const docBAfter = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB)
  assert.equal(docBAfter.doc.status, 'confirmed')
  assert.equal(docBAfter.doc.version, bDocBefore.doc.version)
  assert.equal(docBAfter.doc.contentMd, bDocBefore.doc.contentMd)
  const designBAfter = setup.design.getDesign(appId, ready.moduleB)
  assert.equal(designBAfter.status, 'confirmed')
  assert.equal(designBAfter.version, bDesignBefore.version)
  assert.equal(count('app_design_inputs', appId, ` AND module_id = '${ready.moduleB}'`), bInputsBefore)
  assert.equal(count('app_design_versions', appId, ` AND module_id = '${ready.moduleB}'`), bVersionsBefore)

  // restored.modules 含新增模块 archived:true
  const restoredNew = cancelled.restored.modules.find(module => module.moduleId === created.id)
  assert.ok(restoredNew)
  assert.equal(restoredNew?.archived, true)
  assert.equal(restoredNew?.requirementsVersion, null)
  assert.equal(restoredNew?.designVersion, null)
  const restoredA = cancelled.restored.modules.find(module => module.moduleId === ready.moduleA)
  assert.equal(restoredA?.archived ?? false, false)

  // 需求 bundle 版本递增且不含归档模块
  const latestAfter = setup.modules.latestRequirementBundle(appId)
  assert.ok(latestAfter)
  assert.ok((latestAfter?.version ?? 0) > (latestBefore?.version ?? 0))
  assert.equal(latestAfter?.modules.length, 2)
  assert.ok(!(latestAfter?.modules ?? []).some(module => module.moduleId === created.id))
  assert.equal(cancelled.restored.bundleVersion, latestAfter?.version)

  // 应用回 development；未归档模块 A/B 仍在
  const app = appStatus(appId)
  assert.equal(app.status, 'development')
  const activeModules = setup.modules.listModules(appId).map(module => module.id)
  assert.deepEqual(activeModules.sort(), [ready.moduleA, ready.moduleB].sort())
})

test('M5-10 删除应用清理 app_change_set_modules', async () => {
  const appId = 'm5-delete'
  const ready = readyTwoModuleApp(appId)
  const { changeSet } = setup.changes.startChangeSet(appId, { title: '删除清理', scope: 'requirements', moduleIds: [ready.moduleA] })
  assert.equal(setup.query.changeSetModuleRows(changeSet.id).length, 1)

  const response = await fetch(`${base}/api/apps/${encodeURIComponent(appId)}?confirm=true`, { method: 'DELETE' })
  assert.equal(response.status, 200)
  const rows = setup.db
    .prepare(
      'SELECT COUNT(*) AS c FROM app_change_set_modules WHERE change_set_id IN (SELECT id FROM app_change_sets WHERE app_id = ?)'
    )
    .get(appId) as { c: number }
  assert.equal(rows.c, 0)
  assert.equal(
    (setup.db.prepare('SELECT COUNT(*) AS c FROM app_change_sets WHERE app_id = ?').get(appId) as { c: number }).c,
    0
  )
  assert.equal((setup.db.prepare('SELECT COUNT(*) AS c FROM apps WHERE id = ?').get(appId) as { c: number }).c, 0)
})
