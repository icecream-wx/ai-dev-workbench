/**
 * 设计模块化（M4）单测：模块隔离 / 确认门禁 / 版本 / 输入 stale / reopen /
 * 跨模块关系与页面绑定 / 多模块交接包与变更单门禁 / 应用级模板切换 / 应用摘要 / chat。
 *
 * 临时 RG_DATA_DIR + 真实 Express（挂 apps 路由），不调模型、不启动 opencode。
 * 基线（M3）187 → 本文件新增用例覆盖 M4。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-design-module-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')

interface Setup {
  db: typeof import('../db').db
  modules: typeof import('../requirements/modules')
  doc: typeof import('../requirements/doc')
  service: typeof import('./service')
  templates: typeof import('./templates')
  handoff: typeof import('../handoff/design-service')
  changesets: typeof import('../changesets/service')
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
  'app_change_sets',
  'design_handoffs',
  'app_stage_events',
  'app_sessions',
  'app_dev_phases'
]

before(async () => {
  const dbModule = await import('../db')
  const modules = await import('../requirements/modules')
  const doc = await import('../requirements/doc')
  const service = await import('./service')
  const templates = await import('./templates')
  const handoff = await import('../handoff/design-service')
  const changesets = await import('../changesets/service')
  const payload = await import('../apps/payload')
  setup = { db: dbModule.db, modules, doc, service, templates, handoff, changesets, payload }

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

function newApp(id: string, status = 'requirements'): void {
  for (const table of TABLES) {
    try {
      setup.db.prepare(`DELETE FROM ${table} WHERE app_id = ?`).run(id)
    } catch {
      // 部分表无 app_id（当前都有）
    }
  }
  setup.db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  const now = new Date().toISOString()
  setup.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 8081, ?, ?, ?)`
    )
    .run(id, `应用 ${id}`, id, status, now, now)
  fs.mkdirSync(path.join(root, 'projects', id), { recursive: true })
}

function fillAndConfirmRequirement(appId: string, moduleId?: string): void {
  const payload = setup.doc.ensureRequirementDoc(appId, undefined, moduleId)
  for (const section of payload.sections) {
    if (!section.required) continue
    setup.doc.saveDocSection(
      appId,
      section.sectionKey,
      {
        markdown:
          section.sectionKey === 'epics'
            ? '- 作为运营，我希望维护客户与订单，以便跟踪业务。'
            : `内容-${section.title}`
      },
      moduleId
    )
  }
  setup.doc.confirmRequirementDoc(appId, moduleId)
}

/** 两模块应用：返回 { moduleA, moduleB }（两个需求都已确认） */
function twoModuleApp(appId: string): { moduleA: string; moduleB: string } {
  newApp(appId)
  const moduleA = setup.modules.ensureDefaultModule(appId).id
  // 必须在需求阶段先建模块 B（单模块确认会把应用推进 design）
  const created = setup.modules.createModule(appId, { title: '订单管理' })
  fillAndConfirmRequirement(appId, moduleA)
  fillAndConfirmRequirement(appId, created.id)
  return { moduleA, moduleB: created.id }
}

interface DesignEntityInput {
  id: string
  name: string
  tableName: string
  relations?: Array<{ name: string; type: string; target: string }>
  status?: 'draft' | 'confirmed'
}

function saveEntity(appId: string, moduleId: string, entity: DesignEntityInput): string {
  const payload = setup.service.saveEntities(
    appId,
    [
      {
        id: entity.id,
        name: entity.name,
        tableName: entity.tableName,
        fields: [{ name: 'id', label: 'ID', type: 'string', unique: true }],
        relations: entity.relations ?? [],
        status: entity.status ?? 'confirmed',
        requirementRefs: []
      }
    ],
    'manual',
    { moduleId }
  )
  assert.equal(payload.module.id, moduleId)
  return payload.entities[0].id
}

/** 生成并确认页面集/页面（默认不截图；`snapshots` 时补 PNG，供交接包门禁用） */
function buildConfirmedDesign(
  appId: string,
  moduleId: string,
  entity: DesignEntityInput,
  options: { snapshots?: boolean } = {}
): ReturnType<Setup['service']['confirmDesign']> {
  const entityId = saveEntity(appId, moduleId, { ...entity, status: 'confirmed' })
  setup.service.generateDefaultPageSets(appId, moduleId)
  const project = setup.service.getDesign(appId, moduleId)
  assert.ok(project.pageSets.length > 0, '应生成页面集')
  setup.service.savePageSets(
    appId,
    project.pageSets.map(set => ({
      ...set,
      status: 'confirmed' as const,
      pages: set.pages.map(page => ({ ...page, status: 'confirmed' as const, entityId: page.entityId ?? entityId }))
    })),
    'manual',
    { moduleId }
  )
  if (options.snapshots) {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03])
    const snapshot = setup.service.getDesign(appId, moduleId)
    for (const set of snapshot.pageSets) {
      for (const page of set.pages) {
        setup.service.savePageSnapshot(
          appId,
          page.id,
          { imageBase64: `data:image/png;base64,${png.toString('base64')}` },
          moduleId
        )
      }
    }
  }
  return setup.service.confirmDesign(appId, moduleId)
}

async function request(method: string, apiPath: string, body?: unknown): Promise<{ status: number; data: Record<string, unknown> | null }> {
  const res = await fetch(`${base}/api${apiPath}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  let data: Record<string, unknown> | null = null
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : null
  } catch {
    data = { raw: text }
  }
  return { status: res.status, data }
}

test('两模块设计隔离：实体/页面集/页面/版本互不影响；默认模块缺省；未知 404；归档读允许写 409', async () => {
  const appId = 'm4-isolation'
  const { moduleA, moduleB } = twoModuleApp(appId)

  // 默认模块（不传 moduleId）
  const defaultPayload = setup.service.getDesign(appId)
  assert.equal(defaultPayload.module.id, moduleA)
  assert.equal(defaultPayload.module.key, 'MOD-001')

  const entityA = saveEntity(appId, moduleA, { id: 'ent-a', name: '客户', tableName: 'biz_customer' })
  const entityB = saveEntity(appId, moduleB, { id: 'ent-b', name: '订单', tableName: 'biz_order' })

  // 实体互不串
  assert.deepEqual(setup.service.getDesign(appId, moduleA).entities.map(item => item.id), [entityA])
  assert.deepEqual(setup.service.getDesign(appId, moduleB).entities.map(item => item.id), [entityB])

  // 页面集/页面互不串
  setup.service.generateDefaultPageSets(appId, moduleA)
  const payloadA = setup.service.getDesign(appId, moduleA)
  const payloadB = setup.service.getDesign(appId, moduleB)
  assert.ok(payloadA.pageSets.length > 0)
  assert.deepEqual(payloadB.pageSets, [])

  // 版本按模块：A 有 template-change + 生成页面集的 manual；B 只有 template-change
  const versionsA = setup.service.listDesignVersions(appId, moduleA)
  const versionsB = setup.service.listDesignVersions(appId, moduleB)
  assert.equal(versionsA[0].source, 'manual')
  assert.equal(versionsA[versionsA.length - 1].source, 'template-change')
  assert.equal(versionsB.length, 1)
  assert.equal(versionsB[0].source, 'template-change')

  // 未知 moduleId → 404
  assert.throws(() => setup.service.getDesign(appId, 'missing-module'), (error: { status?: number }) => error.status === 404)

  // 归档模块：读允许、写 409
  setup.modules.archiveModule(appId, moduleB)
  assert.equal(setup.service.getDesign(appId, moduleB).module.id, moduleB)
  assert.throws(
    () => setup.service.saveEntities(appId, [], 'manual', { moduleId: moduleB }),
    (error: { status?: number }) => error.status === 409
  )

  // 跨模块视图：A 能看到 B 的实体（B 已归档但实体仍在）
  const cross = setup.service.getDesign(appId, moduleA)
  assert.equal(cross.otherModuleEntities.some(item => item.id === entityB && item.moduleId === moduleB), true)
})

test('模块设计确认：只确认该模块；appConfirmed 只在全部必选确认后 true；确认产该模块 confirm 版本', () => {
  const appId = 'm4-confirm'
  const { moduleA, moduleB } = twoModuleApp(appId)

  const resultA = buildConfirmedDesign(appId, moduleA, { id: 'ent-a', name: '客户', tableName: 'biz_customer' })
  assert.equal(resultA.project.status, 'confirmed')
  assert.equal(resultA.appConfirmed, false)
  assert.deepEqual(resultA.pendingModuleIds, [moduleB])

  // A 确认后 B 仍可写（隔离）
  const resultB = buildConfirmedDesign(appId, moduleB, { id: 'ent-b', name: '订单', tableName: 'biz_order' })
  assert.equal(resultB.project.status, 'confirmed')
  assert.equal(resultB.appConfirmed, true)
  assert.deepEqual(resultB.pendingModuleIds, [])

  // 确认版本按模块
  const versionsA = setup.service.listDesignVersions(appId, moduleA)
  const versionsB = setup.service.listDesignVersions(appId, moduleB)
  assert.equal(versionsA[0].source, 'confirm')
  assert.equal(versionsB[0].source, 'confirm')

  // 再次确认幂等
  const again = setup.service.confirmDesign(appId, moduleA)
  assert.equal(again.alreadyConfirmed, true)
  assert.equal(again.appConfirmed, true)
})

test('版本按模块：手工保存只影响该模块；回滚只恢复该模块', () => {
  const appId = 'm4-versions'
  const { moduleA, moduleB } = twoModuleApp(appId)
  const entityA = saveEntity(appId, moduleA, { id: 'ent-a', name: '客户', tableName: 'biz_customer' })
  const entityB = saveEntity(appId, moduleB, { id: 'ent-b', name: '订单', tableName: 'biz_order' })

  const v1A = setup.service.getDesign(appId, moduleA).version
  const savedA = setup.service.createDesignVersion(appId, moduleA)
  assert.equal(savedA.version, v1A + 1)
  // B 版本不变
  assert.equal(setup.service.getDesign(appId, moduleB).version, 1)

  // 修改 A 后回滚到手工版本
  saveEntity(appId, moduleA, { id: entityA, name: '客户档案', tableName: 'biz_customer' })
  const rolled = setup.service.rollbackDesignVersion(appId, savedA.version, moduleA)
  assert.equal(rolled.entities[0].name, '客户')
  // B 实体不变
  assert.equal(setup.service.getDesign(appId, moduleB).entities[0].id, entityB)
  // B 版本仍未受影响
  assert.equal(setup.service.getDesign(appId, moduleB).version, 1)
  // 版本列表只含本模块
  assert.equal(setup.service.listDesignVersions(appId, moduleB).length, 1)
})

test('设计输入：按模块只含该模块需求；(app,module,docHash) 唯一；stale 按模块', () => {
  const appId = 'm4-input'
  const { moduleA, moduleB } = twoModuleApp(appId)

  const inputA = setup.service.getDesign(appId, moduleA).input
  const inputB = setup.service.getDesign(appId, moduleB).input
  assert.ok(inputA && inputB)
  assert.equal(inputA.moduleId, moduleA)
  assert.equal(inputB.moduleId, moduleB)
  assert.notEqual(inputA.id, inputB.id)

  const count = setup.db
    .prepare('SELECT COUNT(*) AS count FROM app_design_inputs WHERE app_id = ?')
    .get(appId) as { count: number }
  assert.equal(count.count, 2)

  // 修改模块 B 需求 → 仅 B stale
  setup.doc.reopenRequirementDoc(appId, moduleB)
  setup.doc.saveDocSection(appId, 'problem', { markdown: '订单模块需求已更新' }, moduleB)
  setup.doc.confirmRequirementDoc(appId, moduleB)
  const afterA = setup.service.getDesign(appId, moduleA)
  const afterB = setup.service.getDesign(appId, moduleB)
  assert.equal(afterA.stale.stale, false)
  assert.equal(afterB.stale.stale, true)

  // 同步 B 输入后恢复
  const synced = setup.service.syncDesignInput(appId, 'additions', moduleB)
  assert.equal(synced.stale.stale, false)
  assert.equal(setup.service.getDesign(appId, moduleA).stale.stale, false)
})

test('需求 reopen 模块 A：仅 A 设计项目退回 draft；B 仍 confirmed', () => {
  const appId = 'm4-reopen'
  const { moduleA, moduleB } = twoModuleApp(appId)
  buildConfirmedDesign(appId, moduleA, { id: 'ent-a', name: '客户', tableName: 'biz_customer' })
  buildConfirmedDesign(appId, moduleB, { id: 'ent-b', name: '订单', tableName: 'biz_order' })

  setup.doc.reopenRequirementDoc(appId, moduleA)
  assert.equal(setup.service.getDesign(appId, moduleA).status, 'draft')
  assert.equal(setup.service.getDesign(appId, moduleB).status, 'confirmed')
  // B 的版本未被追加
  assert.equal(setup.service.listDesignVersions(appId, moduleB)[0].source, 'confirm')
})

test('跨模块关系/页面绑定允许 + warning；页面集不能跨模块写入', () => {
  const appId = 'm4-cross'
  const { moduleA, moduleB } = twoModuleApp(appId)
  const entityA = saveEntity(appId, moduleA, { id: 'ent-a', name: '客户', tableName: 'biz_customer' })

  // B 的实体关系指向 A 的实体（跨模块）
  const payloadB = setup.service.saveEntities(
    appId,
    [
      {
        id: 'ent-b',
        name: '订单',
        tableName: 'biz_order',
        fields: [{ name: 'id', label: 'ID', type: 'string', unique: true }],
        relations: [{ name: '订单-客户', type: 'many-to-one', target: entityA }],
        status: 'draft',
        requirementRefs: []
      }
    ],
    'manual',
    { moduleId: moduleB }
  )
  assert.ok(payloadB.readiness.warnings.some(warning => warning.includes('跨模块依赖')))
  // A 的实体不被改写
  assert.equal(setup.service.getDesign(appId, moduleA).entities[0].relations.length, 0)

  // B 的页面绑定 A 的实体（跨模块）→ 允许
  setup.service.generateDefaultPageSets(appId, moduleB)
  const projectB = setup.service.getDesign(appId, moduleB)
  const updated = setup.service.savePageSets(
    appId,
    projectB.pageSets.map(set => ({ ...set, pages: set.pages.map(page => ({ ...page, entityId: entityA })) })),
    'manual',
    { moduleId: moduleB }
  )
  assert.ok(updated.pageSets[0].pages.every(page => page.entityId === entityA))
  assert.ok(updated.readiness.warnings.some(warning => warning.includes('跨模块依赖')))

  // A 的页面集 ID 不能在 B 写入
  setup.service.generateDefaultPageSets(appId, moduleA)
  const pageSetA = setup.service.getDesign(appId, moduleA).pageSets[0]
  assert.throws(
    () => setup.service.savePageSet(appId, pageSetA.id, { title: '越界' }, moduleB),
    (error: { status?: number }) => error.status === 404
  )
  const pageA = pageSetA.pages[0]
  assert.throws(
    () => setup.service.savePage(appId, pageA.id, { title: '越界' }, moduleB),
    (error: { status?: number }) => error.status === 404
  )
})

test('多模块交接包：M6a 起可生成（全部模块校验通过）', () => {
  const appId = 'm4-handoff'
  const { moduleA, moduleB } = twoModuleApp(appId)
  buildConfirmedDesign(appId, moduleA, { id: 'ent-a', name: '客户', tableName: 'biz_customer' }, { snapshots: true })
  buildConfirmedDesign(appId, moduleB, { id: 'ent-b', name: '订单', tableName: 'biz_order' }, { snapshots: true })
  setup.db.prepare("UPDATE apps SET status = 'design' WHERE id = ?").run(appId)

  const preview = setup.handoff.previewDesignHandoff(appId)
  assert.equal(preview.modules.length, 2)
  assert.ok(preview.files.some(file => file.name.startsWith('prototypes/MOD-001/')))
  assert.ok(preview.files.some(file => file.name.startsWith('prototypes/MOD-002/')))
  const generated = setup.handoff.generateDesignHandoff(appId)
  assert.equal(generated.handoff.version, 1)
  assert.equal(generated.handoff.modules.length, 2)
  const count = setup.db.prepare('SELECT COUNT(*) AS count FROM design_handoffs WHERE app_id = ?').get(appId) as {
    count: number
  }
  assert.equal(count.count, 1)
})

test('多模块 Change Set：M5 起不再 409「M5 接入」；无交接包仍拒绝且不创建变更单', () => {
  const appId = 'm4-changeset'
  const { moduleA, moduleB } = twoModuleApp(appId)
  buildConfirmedDesign(appId, moduleA, { id: 'ent-a', name: '客户', tableName: 'biz_customer' })
  buildConfirmedDesign(appId, moduleB, { id: 'ent-b', name: '订单', tableName: 'biz_order' })
  setup.db.prepare("UPDATE apps SET status = 'development' WHERE id = ?").run(appId)

  assert.throws(
    () => setup.changesets.startChangeSet(appId, { title: '多模块变更' }),
    (error: { status?: number; message?: string }) =>
      error.status === 409 && /还没有生成交接包/.test(String(error.message))
  )
  const count = setup.db.prepare('SELECT COUNT(*) AS count FROM app_change_sets WHERE app_id = ?').get(appId) as {
    count: number
  }
  assert.equal(count.count, 0)
})

test('应用级模板切换：preview 只读、逐模块；apply 全模块 template-change；任一 confirmed 阻止', () => {
  const appId = 'm4-template'
  const { moduleA, moduleB } = twoModuleApp(appId)
  // 建立两个设计项目（不确认）
  saveEntity(appId, moduleA, { id: 'ent-a', name: '客户', tableName: 'biz_customer' })
  saveEntity(appId, moduleB, { id: 'ent-b', name: '订单', tableName: 'biz_order' })
  const beforeA = setup.service.getDesign(appId, moduleA)
  const beforeB = setup.service.getDesign(appId, moduleB)
  const projectCountBefore = (setup.db
    .prepare('SELECT COUNT(*) AS count FROM app_design_projects WHERE app_id = ?')
    .get(appId) as { count: number }).count
  const versionRowsBefore = (setup.db
    .prepare('SELECT COUNT(*) AS count FROM app_design_versions WHERE app_id = ?')
    .get(appId) as { count: number }).count

  const target = 'builtin-prototype-minimal'
  const preview = setup.service.previewAppProtoTemplateSwitch(appId, target)
  assert.equal(preview.canApply, true)
  assert.equal(preview.modules.length, 2)
  assert.equal(preview.blockedModules.length, 0)
  // 只读：不建项目/版本
  assert.equal(
    (setup.db.prepare('SELECT COUNT(*) AS count FROM app_design_projects WHERE app_id = ?').get(appId) as { count: number }).count,
    projectCountBefore
  )
  assert.equal(
    (setup.db.prepare('SELECT COUNT(*) AS count FROM app_design_versions WHERE app_id = ?').get(appId) as { count: number }).count,
    versionRowsBefore
  )

  const applied = setup.service.switchAppProtoTemplate(appId, target)
  assert.deepEqual(applied.changedModuleIds.sort(), [moduleA, moduleB].sort())
  const afterA = setup.service.getDesign(appId, moduleA)
  const afterB = setup.service.getDesign(appId, moduleB)
  assert.equal(afterA.template.id, target)
  assert.equal(afterB.template.id, target)
  assert.equal(afterA.version, beforeA.version + 1)
  assert.equal(afterB.version, beforeB.version + 1)
  assert.equal(setup.service.listDesignVersions(appId, moduleA)[0].source, 'template-change')
  assert.equal(setup.service.listDesignVersions(appId, moduleB)[0].source, 'template-change')
  // 应用默认模板同步
  const appTemplate = setup.db.prepare('SELECT prototype_template_id FROM apps WHERE id = ?').get(appId) as {
    prototype_template_id: string
  }
  assert.equal(appTemplate.prototype_template_id, target)

  // 模块 A 确认后应用级切换被阻止，且不写库
  buildConfirmedDesign(appId, moduleA, { id: 'ent-a', name: '客户', tableName: 'biz_customer' })
  const blockedPreview = setup.service.previewAppProtoTemplateSwitch(appId, 'builtin-prototype-enterprise')
  assert.equal(blockedPreview.canApply, false)
  assert.equal(blockedPreview.blockedModules.length, 1)
  assert.equal(blockedPreview.blockedModules[0].moduleId, moduleA)
  const versionBeforeBlocked = setup.service.getDesign(appId, moduleB).version
  assert.throws(
    () => setup.service.switchAppProtoTemplate(appId, 'builtin-prototype-enterprise'),
    (error: { status?: number }) => error.status === 409
  )
  assert.equal(setup.service.getDesign(appId, moduleB).version, versionBeforeBlocked)

  // scope='module' 旧行为：只切当前模块
  const single = setup.service.switchProtoTemplate(appId, 'builtin-prototype-enterprise', moduleB)
  assert.equal(single.template.id, 'builtin-prototype-enterprise')
})

test('appPayload.designModules：只读摘要，不建项目/版本', () => {
  const appId = 'm4-payload'
  const { moduleA, moduleB } = twoModuleApp(appId)
  saveEntity(appId, moduleA, { id: 'ent-a', name: '客户', tableName: 'biz_customer' })
  const projectsBefore = (setup.db
    .prepare('SELECT COUNT(*) AS count FROM app_design_projects WHERE app_id = ?')
    .get(appId) as { count: number }).count
  const versionsBefore = (setup.db
    .prepare('SELECT COUNT(*) AS count FROM app_design_versions WHERE app_id = ?')
    .get(appId) as { count: number }).count

  const row = setup.db.prepare('SELECT * FROM apps WHERE id = ?').get(appId) as Parameters<Setup['payload']['appPayload']>[0]
  const payload = setup.payload.appPayload(row) as {
    designProject: unknown
    designModules: Array<{ moduleId: string; status: string; version: number; entityCount: number; missingImages: number }>
    designModulesConfirmed: boolean
  }
  assert.ok(payload.designProject, '旧字段 designProject 保留（默认模块摘要）')
  assert.equal(payload.designModules.length, 2)
  const summaryA = payload.designModules.find(item => item.moduleId === moduleA)
  const summaryB = payload.designModules.find(item => item.moduleId === moduleB)
  assert.ok(summaryA && summaryB)
  assert.equal(summaryA!.status, 'draft')
  assert.equal(summaryA!.entityCount, 1)
  assert.equal(summaryB!.entityCount, 0)
  assert.equal(payload.designModulesConfirmed, false)

  // 只读：不建项目/版本
  assert.equal(
    (setup.db.prepare('SELECT COUNT(*) AS count FROM app_design_projects WHERE app_id = ?').get(appId) as { count: number }).count,
    projectsBefore
  )
  assert.equal(
    (setup.db.prepare('SELECT COUNT(*) AS count FROM app_design_versions WHERE app_id = ?').get(appId) as { count: number }).count,
    versionsBefore
  )
})

test('设计 chat 按模块隔离；旧应用级 key 只读回退；未知/归档守卫', () => {
  const appId = 'm4-chat'
  const { moduleA, moduleB } = twoModuleApp(appId)
  setup.service.saveDesignChat(appId, { messages: [{ role: 'user', content: 'A 的对话' }] }, moduleA)
  setup.service.saveDesignChat(appId, { messages: [{ role: 'user', content: 'B 的对话' }] }, moduleB)
  assert.equal(
    (setup.service.readDesignChat(appId, moduleA) as { messages: Array<{ content: string }> }).messages[0].content,
    'A 的对话'
  )
  assert.equal(
    (setup.service.readDesignChat(appId, moduleB) as { messages: Array<{ content: string }> }).messages[0].content,
    'B 的对话'
  )
  // 缺省 = 默认模块 A
  assert.equal(
    (setup.service.readDesignChat(appId) as { messages: Array<{ content: string }> }).messages[0].content,
    'A 的对话'
  )

  // 旧 app 级 key：没有模块 key 时只读回退；写入不删/不改旧 key
  const legacyApp = 'm4-chat-legacy'
  newApp(legacyApp)
  setup.db
    .prepare("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)")
    .run(`app.${legacyApp}.designChat`, JSON.stringify({ messages: [{ role: 'user', content: '旧历史' }] }), new Date().toISOString())
  assert.equal(
    (setup.service.readDesignChat(legacyApp) as { messages: Array<{ content: string }> }).messages[0].content,
    '旧历史'
  )
  const legacyMeta = setup.service.readDesignChatWithMeta(legacyApp)
  assert.equal(legacyMeta.legacyFallback, true)
  // 模块有独立历史后不再标记旧回退
  assert.equal(setup.service.readDesignChatWithMeta(appId, moduleA).legacyFallback, false)

  // 未知模块 404；归档模块读允许、写 409
  assert.throws(() => setup.service.readDesignChat(appId, 'missing'), (error: { status?: number }) => error.status === 404)
  setup.modules.archiveModule(appId, moduleB)
  assert.equal(
    (setup.service.readDesignChat(appId, moduleB) as { messages: Array<{ content: string }> }).messages[0].content,
    'B 的对话'
  )
  assert.throws(
    () => setup.service.saveDesignChat(appId, { messages: [] }, moduleB),
    (error: { status?: number }) => error.status === 409
  )
})

test('HTTP 路由接线：moduleId query/body、未知 404、归档写 409、多模块门禁、模板 preview', async () => {
  const appId = 'm4-http'
  const { moduleA, moduleB } = twoModuleApp(appId)
  saveEntity(appId, moduleA, { id: 'ent-a', name: '客户', tableName: 'biz_customer' })

  const defaultRes = await request('GET', `/apps/${appId}/design`)
  assert.equal(defaultRes.status, 200)
  assert.equal((defaultRes.data?.module as { id: string }).id, moduleA)

  const moduleBRes = await request('GET', `/apps/${appId}/design?moduleId=${encodeURIComponent(moduleB)}`)
  assert.equal(moduleBRes.status, 200)
  assert.equal((moduleBRes.data?.module as { id: string }).id, moduleB)

  const designTemplates = await request('GET', `/apps/${appId}/design/templates?moduleId=${encodeURIComponent(moduleA)}`)
  assert.equal(designTemplates.status, 200)
  assert.equal(typeof (designTemplates.data as { prototype?: { id?: string } }).prototype?.id, 'string')

  const unknown = await request('GET', `/apps/${appId}/design?moduleId=missing`)
  assert.equal(unknown.status, 404)

  // 设计 chat GET 未知模块 404
  const chatUnknown = await request('GET', `/apps/${appId}/design/chat?moduleId=missing`)
  assert.equal(chatUnknown.status, 404)

  // 模板应用级 preview（只读）
  const previewRes = await request('POST', `/apps/${appId}/design/template/preview`, {
    templateId: 'builtin-prototype-minimal'
  })
  assert.equal(previewRes.status, 200)
  assert.equal(previewRes.data?.canApply, true)

  // 多模块交接包 preview：M6a 起不再 409；本 fixture 未截图 → 400（按模块 issues）
  const handoffRes = await request('POST', `/apps/${appId}/design/handoff/preview`)
  assert.equal(handoffRes.status, 400)
  const handoffIssues = (handoffRes.data as { issues?: string[] } | null)?.issues ?? []
  assert.ok(handoffIssues.some(issue => issue.startsWith('[MOD-001')), JSON.stringify(handoffIssues))

  // 归档模块写 → 409
  setup.modules.archiveModule(appId, moduleB)
  const archivedWrite = await request('PUT', `/apps/${appId}/design/entities?moduleId=${encodeURIComponent(moduleB)}`, {
    entities: []
  })
  assert.equal(archivedWrite.status, 409)
  setup.modules.restoreModule(appId, moduleB)

  // 多模块 Change Set → 409（应用需为开发阶段；这里只看门禁，不建交接包）
  setup.db.prepare("UPDATE apps SET status = 'development' WHERE id = ?").run(appId)
  const csRes = await request('POST', `/apps/${appId}/change-sets`, { title: '多模块' })
  assert.equal(csRes.status, 409)
})
