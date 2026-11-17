/**
 * 需求模块 UI 支撑（M3）单测：
 * - 应用级模板切换 preview（只读）/ apply（单事务、每模块 template-change 版本、归档不动）
 * - 已确认模块阻塞（409 + issues，不写任何模块）
 * - scope=module 旧行为不变
 * - 模块排序（moduleIds 必须等于全部未归档模块）
 * - 按模块 doc 对话历史（模块 key 隔离 + 旧 key 只读回退 + 写不删旧 key）
 * - 模块新增门禁文案
 *
 * 用临时 RG_DATA_DIR + 真实 Express 挂载需求路由（不调模型、不启 opencode）。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-module-ui-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')

interface Setup {
  db: typeof import('../db').db
  readSetting: typeof import('../db').readSetting
  doc: typeof import('./doc')
  modules: typeof import('./modules')
}

let setup: Setup
let server: Server | null = null
let base = ''

before(async () => {
  const dbModule = await import('../db')
  const doc = await import('./doc')
  const modules = await import('./modules')
  setup = { db: dbModule.db, readSetting: dbModule.readSetting, doc, modules }

  const express = (await import('express')).default
  const { requirementDocRoutes, requirementModuleRoutes, requirementErrorHandler } = await import('./routes')
  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/apps/:id/requirements-doc', requirementDocRoutes)
  app.use('/api/apps/:id/requirements-modules', requirementModuleRoutes)
  app.use(requirementErrorHandler)
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

const TABLES = [
  'app_requirement_bundles',
  'app_requirement_doc_versions',
  'app_requirement_doc_sections',
  'app_requirement_docs',
  'app_modules',
  'app_stage_events'
]

function newApp(id: string, name: string, status = 'requirements'): Setup {
  for (const table of TABLES) setup.db.prepare(`DELETE FROM ${table} WHERE app_id = ?`).run(id)
  setup.db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  const now = new Date().toISOString()
  setup.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 8081, ?, ?, ?)`
    )
    .run(id, name, id, status, now, now)
  return setup
}

interface ApiResult {
  status: number
  data: Record<string, unknown> | null
}

async function request(method: string, apiPath: string, body?: unknown): Promise<ApiResult> {
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

function count(table: string, appId: string): number {
  return (setup.db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE app_id = ?`).get(appId) as { c: number }).c
}

function snapshotCounts(appId: string): string {
  return JSON.stringify({
    modules: count('app_modules', appId),
    docs: count('app_requirement_docs', appId),
    sections: count('app_requirement_doc_sections', appId),
    versions: count('app_requirement_doc_versions', appId),
    bundles: count('app_requirement_bundles', appId)
  })
}

function sectionMarkdown(payload: { sections: Array<{ sectionKey: string; markdown: string }> }, key: string): string {
  return payload.sections.find(section => section.sectionKey === key)?.markdown ?? ''
}

/** 填满必填章节（结构化 scenes/epics 用 data） */
function fillRequired(appId: string, moduleId: string, tag: string): void {
  const payload = setup.doc.ensureRequirementDoc(appId, undefined, moduleId)
  for (const section of payload.sections) {
    if (!section.required) continue
    if (section.kind === 'scenes') {
      setup.doc.saveDocSection(
        appId,
        'scenes',
        { data: { scenes: [{ title: `${tag} 场景`, description: `${tag} 说明` }], epics: [], stories: [] } },
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
            epics: [{ title: `${tag} Epic`, goal: `${tag} 目标` }],
            stories: [{ title: `${tag} Story`, acceptance: [`${tag} 验收`], priority: 'P0' }]
          }
        },
        moduleId
      )
      continue
    }
    if (section.markdown.trim()) continue
    setup.doc.saveDocSection(appId, section.sectionKey, { markdown: `${tag}：${section.title} 内容` }, moduleId)
  }
}

test('应用级模板预览：只读/不产版本；逐模块 from/to/kept/dropped/added', () => {
  const appId = 'ui-preview'
  newApp(appId, '预览应用')
  const first = setup.doc.ensureRequirementDoc(appId).doc
  const second = setup.modules.createModule(appId, { title: '订单中心' })
  setup.doc.saveDocSection(appId, 'problem', { markdown: '默认模块的问题描述' }, first.moduleId)
  setup.doc.saveDocSection(appId, 'problem', { markdown: '第二模块的问题描述' }, second.id)
  const before = snapshotCounts(appId)

  const preview = setup.doc.previewAppDocTemplate(appId, 'builtin-prd-lite')
  assert.equal(preview.scope, 'app')
  assert.equal(preview.template.id, 'builtin-prd-lite')
  assert.equal(preview.modules.length, 2)
  assert.equal(preview.blockedModules.length, 0)
  assert.equal(preview.canApply, true)
  assert.equal(snapshotCounts(appId), before, '预览必须只读（模块/文档/章节/版本/bundle 不变）')

  const firstPreview = preview.modules.find(item => item.moduleId === first.moduleId)!
  assert.equal(firstPreview.fromSections, 13)
  assert.equal(firstPreview.toSections, 6)
  assert.equal(firstPreview.kept, 6)
  assert.equal(firstPreview.dropped.length, 7)
  assert.deepEqual(firstPreview.added, [])
  assert.ok(firstPreview.dropped.some(item => item.sectionKey === 'scope'))
  assert.equal(firstPreview.docStatus, 'draft')
  assert.equal(firstPreview.docVersion, 1)

  const secondPreview = preview.modules.find(item => item.moduleId === second.id)!
  assert.equal(secondPreview.fromSections, 13)
  assert.equal(secondPreview.toSections, 6)
  assert.equal(secondPreview.kept, 6)
  assert.equal(snapshotCounts(appId), before, '预览结束后仍不得写库')

  // 应用默认模板不因预览而变化
  const appRow = setup.db.prepare('SELECT requirement_template_id FROM apps WHERE id = ?').get(appId) as {
    requirement_template_id: string | null
  }
  assert.notEqual(appRow.requirement_template_id, 'builtin-prd-lite')
})

test('应用级模板切换：两模块都 6 节、各 version+1 且 template-change；内容不串；归档模块不动', () => {
  const appId = 'ui-apply'
  newApp(appId, '切换应用')
  const first = setup.doc.ensureRequirementDoc(appId).doc
  const second = setup.modules.createModule(appId, { title: '订单中心' })
  const third = setup.modules.createModule(appId, { title: '历史模块' })
  setup.doc.saveDocSection(appId, 'problem', { markdown: '模块一的问题' }, first.moduleId)
  setup.doc.saveDocSection(appId, 'problem', { markdown: '模块二的问题' }, second.id)
  setup.doc.saveDocSection(appId, 'problem', { markdown: '归档模块的问题' }, third.id)
  setup.modules.archiveModule(appId, third.id)
  const archivedVersionBefore = setup.doc.ensureRequirementDoc(appId, undefined, third.id).doc.version

  const result = setup.doc.switchDocTemplateForApp(appId, 'builtin-prd-lite')
  assert.equal(result.scope, 'app')
  assert.equal(result.modules.length, 2, '归档模块不参与应用级切换')
  assert.equal(result.modules.every(item => item.sectionCount === 6), true)

  for (const moduleId of [first.moduleId, second.id]) {
    const payload = setup.doc.ensureRequirementDoc(appId, undefined, moduleId)
    assert.equal(payload.sections.length, 6)
    assert.equal(payload.doc.version, 2)
    assert.equal(payload.doc.templateId, 'builtin-prd-lite')
    const versions = setup.doc.listDocVersions(appId, moduleId)
    assert.equal(versions.length, 2)
    assert.equal(versions[0].version, 2)
    assert.equal(versions[0].source, 'template-change')
  }
  // 同 section key 内容保留且不串模块
  assert.match(sectionMarkdown(setup.doc.ensureRequirementDoc(appId, undefined, first.moduleId), 'problem'), /模块一的问题/)
  assert.doesNotMatch(sectionMarkdown(setup.doc.ensureRequirementDoc(appId, undefined, first.moduleId), 'problem'), /模块二的问题/)
  assert.match(sectionMarkdown(setup.doc.ensureRequirementDoc(appId, undefined, second.id), 'problem'), /模块二的问题/)
  assert.doesNotMatch(sectionMarkdown(setup.doc.ensureRequirementDoc(appId, undefined, second.id), 'problem'), /模块一的问题/)

  // 应用默认模板同步
  const appRow = setup.db.prepare('SELECT requirement_template_id FROM apps WHERE id = ?').get(appId) as {
    requirement_template_id: string | null
  }
  assert.equal(appRow.requirement_template_id, 'builtin-prd-lite')

  // 归档模块保持原模板/版本，内容不动
  const archived = setup.doc.ensureRequirementDoc(appId, undefined, third.id)
  assert.equal(archived.doc.version, archivedVersionBefore)
  assert.equal(archived.sections.length, 13)
  assert.match(sectionMarkdown(archived, 'problem'), /归档模块的问题/)
})

test('应用级模板切换被已确认模块阻止：409 + issues；不写任何模块', () => {
  const appId = 'ui-blocked'
  newApp(appId, '阻塞应用')
  const first = setup.doc.ensureRequirementDoc(appId).doc
  const second = setup.modules.createModule(appId, { title: '第二模块' })
  fillRequired(appId, first.moduleId, '模块一')
  setup.doc.confirmRequirementDoc(appId, first.moduleId)
  const before = snapshotCounts(appId)
  const secondVersionBefore = setup.doc.ensureRequirementDoc(appId, undefined, second.id).doc.version

  const preview = setup.doc.previewAppDocTemplate(appId, 'builtin-prd-lite')
  assert.equal(preview.canApply, false)
  assert.equal(preview.blockedModules.length, 1)
  assert.equal(preview.blockedModules[0].moduleId, first.moduleId)
  assert.equal(preview.blockedModules[0].reason, 'confirmed')
  assert.equal(snapshotCounts(appId), before, '阻塞预览也必须只读')

  assert.throws(() => setup.doc.switchDocTemplateForApp(appId, 'builtin-prd-lite'), (error: unknown) => {
    const typed = error as { status?: number; issues?: Array<{ moduleId: string }> }
    assert.equal(typed.status, 409)
    assert.equal(typed.issues?.length, 1)
    assert.equal(typed.issues?.[0].moduleId, first.moduleId)
    return true
  })
  assert.equal(snapshotCounts(appId), before, '409 后不得写任何模块')
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, second.id).doc.version, secondVersionBefore)
})

test("scope='module' 旧行为不变：只切当前模块并同步应用默认模板", () => {
  const appId = 'ui-scope-module'
  newApp(appId, '旧行为应用')
  const first = setup.doc.ensureRequirementDoc(appId).doc
  const second = setup.modules.createModule(appId, { title: '第二模块' })
  const firstVersionBefore = setup.doc.ensureRequirementDoc(appId, undefined, first.moduleId).doc.version
  setup.doc.switchDocTemplate(appId, 'builtin-prd-lite', second.id)
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, second.id).sections.length, 6)
  const unchanged = setup.doc.ensureRequirementDoc(appId, undefined, first.moduleId)
  assert.equal(unchanged.sections.length, 13)
  assert.equal(unchanged.doc.version, firstVersionBefore)
})

test('模块排序：合法顺序写 position；缺失/多余/重复/含归档 → 400 且不改库', () => {
  const appId = 'ui-order'
  newApp(appId, '排序应用')
  const first = setup.doc.ensureRequirementDoc(appId).doc
  const second = setup.modules.createModule(appId, { title: '第二模块' })
  const third = setup.modules.createModule(appId, { title: '第三模块' })

  const reordered = setup.modules.reorderModules(appId, [third.id, first.moduleId, second.id])
  assert.deepEqual(
    reordered.map(item => item.id),
    [third.id, first.moduleId, second.id]
  )
  assert.deepEqual(
    reordered.map(item => item.position),
    [0, 1, 2]
  )
  const reread = setup.modules.listModules(appId)
  assert.deepEqual(
    reread.map(item => item.id),
    [third.id, first.moduleId, second.id]
  )

  const positions = (): string =>
    JSON.stringify(
      setup.db
        .prepare('SELECT id, position FROM app_modules WHERE app_id = ? ORDER BY position ASC, module_key ASC')
        .all(appId)
    )
  const before = positions()
  assert.throws(() => setup.modules.reorderModules(appId, [third.id, first.moduleId]), /全部 3 个未归档模块/)
  assert.throws(() => setup.modules.reorderModules(appId, [third.id, first.moduleId, second.id, 'missing']), /无效或已归档/)
  assert.throws(() => setup.modules.reorderModules(appId, [third.id, third.id, second.id]), /不能重复/)
  assert.throws(() => setup.modules.reorderModules(appId, [third.id, first.moduleId]), /全部/)
  assert.equal(positions(), before, '400 后 position 不得变化')

  setup.modules.archiveModule(appId, third.id)
  const afterArchive = positions()
  assert.throws(() => setup.modules.reorderModules(appId, [first.moduleId, second.id, third.id]), /无效或已归档/)
  assert.equal(positions(), afterArchive, '含归档模块 400 后 position 不得变化')
})

test('模块新增门禁文案：设计阶段先重新编辑需求；开发阶段走需求+设计变更', () => {
  const appId = 'ui-gate'
  newApp(appId, '门禁应用')
  setup.doc.ensureRequirementDoc(appId)
  setup.db.prepare("UPDATE apps SET status = 'design' WHERE id = ?").run(appId)
  assert.throws(() => setup.modules.createModule(appId, { title: '设计后新增' }), /重新编辑需求/)
  setup.db.prepare("UPDATE apps SET status = 'development' WHERE id = ?").run(appId)
  assert.throws(() => setup.modules.createModule(appId, { title: '开发后新增' }), /需求\+设计/)
})

test('按模块 doc 对话：模块 key 隔离；默认模块旧 key 只读回退；PUT 不删旧 key', async () => {
  const appId = 'ui-chat'
  newApp(appId, '对话应用')
  const first = setup.doc.ensureRequirementDoc(appId).doc
  const second = setup.modules.createModule(appId, { title: '第二模块' })

  // 旧应用级历史（模拟 M2 之前的数据）
  setup.db
    .prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)')
    .run(`app.${appId}.requirementsDocChat`, JSON.stringify({ messages: [{ id: 'legacy-1', role: 'user', content: '旧历史' }] }), new Date().toISOString())

  // 1) 默认模块无模块 key → 旧 key 回退 + legacyFallback
  const fallback = await request('GET', `/apps/${appId}/requirements-doc/chat?moduleId=${encodeURIComponent(first.moduleId)}`)
  assert.equal(fallback.status, 200)
  const fallbackMessages = fallback.data?.messages as Array<{ content: string }>
  assert.equal(fallbackMessages.length, 1)
  assert.equal(fallbackMessages[0].content, '旧历史')
  assert.equal(fallback.data?.legacyFallback, true)

  // 2) 非默认模块不回退旧 key
  const secondEmpty = await request('GET', `/apps/${appId}/requirements-doc/chat?moduleId=${encodeURIComponent(second.id)}`)
  assert.equal(secondEmpty.status, 200)
  assert.deepEqual(secondEmpty.data?.messages, [])

  // 3) PUT 模块 A：只写模块 key
  const savedA = await request('PUT', `/apps/${appId}/requirements-doc/chat?moduleId=${encodeURIComponent(first.moduleId)}`, {
    messages: [{ id: 'a-1', role: 'user', content: '模块 A 历史' }]
  })
  assert.equal(savedA.status, 200)
  const legacyStill = setup.readSetting<{ messages: Array<{ content: string }> }>(`app.${appId}.requirementsDocChat`)
  assert.equal(legacyStill?.messages[0].content, '旧历史', '旧 key 必须保留')

  const readA = await request('GET', `/apps/${appId}/requirements-doc/chat?moduleId=${encodeURIComponent(first.moduleId)}`)
  assert.equal((readA.data?.messages as Array<{ content: string }>)[0].content, '模块 A 历史')
  assert.equal(readA.data?.legacyFallback, undefined, '模块 key 有值时不回退旧 key')

  // 4) 模块 B 历史独立
  await request('PUT', `/apps/${appId}/requirements-doc/chat?moduleId=${encodeURIComponent(second.id)}`, {
    messages: [{ id: 'b-1', role: 'user', content: '模块 B 历史' }]
  })
  const readB = await request('GET', `/apps/${appId}/requirements-doc/chat?moduleId=${encodeURIComponent(second.id)}`)
  assert.equal((readB.data?.messages as Array<{ content: string }>)[0].content, '模块 B 历史')
  const readAAgain = await request('GET', `/apps/${appId}/requirements-doc/chat?moduleId=${encodeURIComponent(first.moduleId)}`)
  assert.equal((readAAgain.data?.messages as Array<{ content: string }>)[0].content, '模块 A 历史')

  // 5) 不传 moduleId（旧客户端）→ 默认模块的模块 key（已写入）
  const legacyClient = await request('GET', `/apps/${appId}/requirements-doc/chat`)
  assert.equal((legacyClient.data?.messages as Array<{ content: string }>)[0].content, '模块 A 历史')

  // 6) 未知模块 404
  const unknown = await request('GET', `/apps/${appId}/requirements-doc/chat?moduleId=missing-module`)
  assert.equal(unknown.status, 404)

  // 7) 没有模块的旧应用：不传 moduleId 的 PUT 仍写旧 key，不懒创建模块
  const legacyAppId = 'ui-chat-legacy'
  newApp(legacyAppId, '旧对话应用')
  const legacyPut = await request('PUT', `/apps/${legacyAppId}/requirements-doc/chat`, {
    messages: [{ id: 'legacy-2', role: 'user', content: '旧客户端写入' }]
  })
  assert.equal(legacyPut.status, 200)
  assert.equal(count('app_modules', legacyAppId), 0, '旧客户端写对话不应懒创建模块')
  const legacyValue = setup.readSetting<{ messages: Array<{ content: string }> }>(`app.${legacyAppId}.requirementsDocChat`)
  assert.equal(legacyValue?.messages[0].content, '旧客户端写入')
})

test('按模块 chat 守卫：未知 moduleId GET/PUT 404；归档模块读允许、写 409', async () => {
  const appId = 'ui-chat-guard'
  newApp(appId, '对话守卫应用')
  const first = setup.doc.ensureRequirementDoc(appId).doc
  setup.modules.createModule(appId, { title: '第二模块' })
  const archivedModule = setup.modules.createModule(appId, { title: '归档对话模块' })

  await request('PUT', `/apps/${appId}/requirements-doc/chat?moduleId=${encodeURIComponent(archivedModule.id)}`, {
    messages: [{ id: 'archived-1', role: 'user', content: '归档前历史' }]
  })
  setup.modules.archiveModule(appId, archivedModule.id)

  const readArchived = await request('GET', `/apps/${appId}/requirements-doc/chat?moduleId=${encodeURIComponent(archivedModule.id)}`)
  assert.equal(readArchived.status, 200)
  assert.equal((readArchived.data?.messages as Array<{ content: string }>)[0].content, '归档前历史')

  const writeArchived = await request('PUT', `/apps/${appId}/requirements-doc/chat?moduleId=${encodeURIComponent(archivedModule.id)}`, {
    messages: [{ id: 'archived-2', role: 'user', content: '归档后写入' }]
  })
  assert.equal(writeArchived.status, 409)

  const unknownGet = await request('GET', `/apps/${appId}/requirements-doc/chat?moduleId=missing-module`)
  assert.equal(unknownGet.status, 404)
  assert.match(String(unknownGet.data?.error ?? ''), /模块不存在/)
  const unknownPut = await request('PUT', `/apps/${appId}/requirements-doc/chat?moduleId=missing-module`, { messages: [] })
  assert.equal(unknownPut.status, 404)
  assert.match(String(unknownPut.data?.error ?? ''), /模块不存在/)

  // 缺省/空 moduleId 仍走默认模块（不因守卫变化）
  const defaultChat = await request('GET', `/apps/${appId}/requirements-doc/chat`)
  assert.equal(defaultChat.status, 200)
  const emptyModuleChat = await request('GET', `/apps/${appId}/requirements-doc/chat?moduleId=`)
  assert.equal(emptyModuleChat.status, 200)
  assert.equal(setup.doc.ensureRequirementDoc(appId).doc.moduleId, first.moduleId)
})

test('HTTP 路由接线：POST /template/preview 只读 + PUT /template scope=app 生效 + PUT /modules/order 400', async () => {
  const appId = 'ui-routes'
  newApp(appId, '路由应用')
  const first = setup.doc.ensureRequirementDoc(appId).doc
  setup.modules.createModule(appId, { title: '第二模块' })
  const before = snapshotCounts(appId)

  const preview = await request('POST', `/apps/${appId}/requirements-doc/template/preview`, { templateId: 'builtin-prd-lite' })
  assert.equal(preview.status, 200)
  assert.equal(preview.data?.canApply, true)
  assert.equal((preview.data?.modules as unknown[]).length, 2)
  assert.equal(snapshotCounts(appId), before)

  const applied = await request('PUT', `/apps/${appId}/requirements-doc/template`, {
    templateId: 'builtin-prd-lite',
    scope: 'app'
  })
  assert.equal(applied.status, 200)
  assert.equal(applied.data?.scope, 'app')
  assert.equal((applied.data?.modules as unknown[]).length, 2)
  const firstAfter = setup.doc.ensureRequirementDoc(appId, undefined, first.moduleId)
  assert.equal(firstAfter.sections.length, 6)

  const badOrder = await request('PUT', `/apps/${appId}/requirements-modules/order`, {
    moduleIds: [first.moduleId]
  })
  assert.equal(badOrder.status, 400)
  assert.equal(typeof badOrder.data?.error, 'string')
})

test('RMP-1 路由：POST /plan/apply 复用默认模块并新建其余；重复/非法/生成守卫按 HTTP 错误', async () => {
  const appId = 'ui-plan'
  newApp(appId, '订单系统')
  const first = setup.doc.ensureRequirementDoc(appId).doc
  setup.db.prepare('DELETE FROM app_settings WHERE key LIKE ?').run(`app.${appId}.%`)

  const plan = {
    modules: [
      { key: 'product', title: '商品管理', scope: ['商品档案'] },
      { key: 'order', title: '订单管理', scope: ['订单创建'] }
    ]
  }
  const bad = await request('POST', `/apps/${appId}/requirements-modules/plan/apply`, {
    plan: { modules: [{ title: 'A' }, { title: 'A' }] }
  })
  assert.equal(bad.status, 400)

  // MF6：聊天未落盘（无 source）→ 409 且不建模块/不写 settings
  const noSource = await request('POST', `/apps/${appId}/requirements-modules/plan/apply`, { plan })
  assert.equal(noSource.status, 409)
  assert.match(String(noSource.data?.error), /缺少原始需求记录/)
  assert.equal(setup.modules.listModules(appId).length, 1)
  assert.equal(setup.readSetting(`app.${appId}.modulePlanApplied`), null)

  // 正常 UI 会先落盘聊天；补上后 apply 成功
  const chatSaved = await request('PUT', `/apps/${appId}/requirements-doc/chat`, {
    messages: [{ id: 'm1', role: 'user', content: '做一个订单系统：商品管理与订单管理', time: '00:00:00' }]
  })
  assert.equal(chatSaved.status, 200)

  const applied = await request('POST', `/apps/${appId}/requirements-modules/plan/apply`, { plan })
  assert.equal(applied.status, 200)
  assert.equal((applied.data?.modules as unknown[]).length, 2)
  assert.equal((applied.data?.reused as { id: string }).id, first.moduleId)
  assert.equal((applied.data?.generation as unknown[]).length, 2)
  const modules = setup.modules.listModules(appId)
  assert.deepEqual(
    modules.map(module => module.moduleKey),
    ['MOD-001', 'MOD-002']
  )
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, first.moduleId).doc.title, '订单系统 · 商品管理 需求文档')
  const planKindAfterApply = await request('GET', `/apps/${appId}/requirements-modules`)
  assert.equal(planKindAfterApply.data?.planKind, 'initial')

  const again = await request('POST', `/apps/${appId}/requirements-modules/plan/apply`, { plan })
  assert.equal(again.status, 409)

  // 生成守卫（不进入 SSE）：非需求阶段
  newApp('ui-plan-design', '设计应用', 'design')
  const designGenerate = await request('POST', '/apps/ui-plan-design/requirements-modules/generate', {
    reason: 'single',
    moduleIds: ['missing']
  })
  assert.equal(designGenerate.status, 409)

  // 生成守卫：没有规划时 initial → 409（错误在 SSE 头之前返回）
  newApp('ui-generate-no-plan', '空应用')
  const noPlan = await request('POST', '/apps/ui-generate-no-plan/requirements-modules/generate', { reason: 'initial' })
  assert.equal(noPlan.status, 409)
  assert.match(String(noPlan.data?.error), /尚未应用模块拆分建议/)
})

test('RMP-2 路由：replan/preview 只读 + 守卫、replan/apply 200/409、generate replan 守卫与真实 HTTP 生成', async () => {
  const appId = 'ui-replan'
  newApp(appId, '订单系统')
  setup.db.prepare('DELETE FROM app_settings WHERE key LIKE ?').run(`app.${appId}.%`)
  const first = setup.doc.ensureRequirementDoc(appId).doc
  fillRequired(appId, first.moduleId, '商品')
  setup.modules.updateModule(appId, first.moduleId, { title: '商品管理', description: '商品' })
  const order = setup.modules.createModule(appId, { title: '订单管理', description: '订单创建与查询' })
  fillRequired(appId, order.id, '订单')

  const fsPath = await import('node:path')
  fs.mkdirSync(fsPath.join(process.env.RG_PROJECTS_DIR as string, appId), { recursive: true })
  const { opencode } = await import('../opencode/runtime')
  const target = opencode as unknown as Record<string, unknown>
  target.lastUsedModel = async () => null
  target.defaultModel = async () => null
  target.ensureAgent = async () => undefined
  const { MODULE_PLAN_DELIMITER } = await import('./module-plan')
  target.generateText = async (input: unknown) => {
    const prompt = String((input as { prompt?: unknown })?.prompt ?? '')
    if (prompt.includes('只写这个模块')) {
      return JSON.stringify({ sections: [{ id: 'problem', markdown: 'replan 真实 HTTP 生成内容' }] })
    }
    return [
      '保留商品管理，重新生成订单管理。',
      MODULE_PLAN_DELIMITER,
      JSON.stringify({
        kind: 'replan',
        modules: [
          { key: 'product', title: '商品管理', description: '商品', scope: ['商品'], existingModuleId: first.moduleId, action: 'keep' },
          {
            key: 'order',
            title: '订单中心',
            description: '下单与查询',
            scope: ['订单创建', '订单查询'],
            existingModuleId: order.id,
            action: 'regenerate'
          }
        ],
        dependencies: [],
        coverage: [{ requirement: '商品', moduleKey: 'product' }],
        unassigned: [],
        openIssues: [],
        warnings: []
      })
    ].join('\n')
  }

  const beforeModules = setup.modules.listModules(appId, true).length
  const beforeSettings = setup.readSetting(`app.${appId}.modulePlanApplied`)
  const beforeList = await request('GET', `/apps/${appId}/requirements-modules`)
  assert.equal(beforeList.data?.planKind, null)
  const preview = await request('POST', `/apps/${appId}/requirements-modules/replan/preview`, { instruction: '重新拆分' })
  assert.equal(preview.status, 200)
  const previewData = preview.data as {
    plan: { kind: string; modules: Array<{ action: string }> }
    currentModules: unknown[]
    errors: string[]
    requiresReopenConfirmed: boolean
  }
  assert.equal(previewData.plan.kind, 'replan')
  assert.equal(previewData.plan.modules.length, 2)
  assert.equal(previewData.currentModules.length, 2)
  assert.deepEqual(previewData.errors, [])
  assert.equal(previewData.requiresReopenConfirmed, false)
  assert.equal(setup.modules.listModules(appId, true).length, beforeModules)
  assert.equal(setup.readSetting(`app.${appId}.modulePlanApplied`), beforeSettings)

  // 设计阶段 → 409（不进入模型）
  newApp('ui-replan-design', '设计应用', 'design')
  const designPreview = await request('POST', '/apps/ui-replan-design/requirements-modules/replan/preview', {})
  assert.equal(designPreview.status, 409)

  // 非法计划 → 400 且不写
  const badApply = await request('POST', `/apps/${appId}/requirements-modules/replan/apply`, {
    plan: { modules: [{ title: 'A' }, { title: 'A' }] }
  })
  assert.equal(badApply.status, 400)
  assert.equal(setup.modules.listModules(appId, true).length, beforeModules)

  const applied = await request('POST', `/apps/${appId}/requirements-modules/replan/apply`, {
    plan: {
      kind: 'replan',
      modules: [
        { key: 'product', title: '商品管理', description: '商品', scope: ['商品'], existingModuleId: first.moduleId, action: 'keep' },
        {
          key: 'order',
          title: '订单中心',
          description: '下单与查询',
          scope: ['订单创建', '订单查询'],
          existingModuleId: order.id,
          action: 'regenerate'
        }
      ]
    },
    reopenConfirmed: false
  })
  assert.equal(applied.status, 200)
  assert.deepEqual((applied.data?.generation as unknown[]).length, 1)
  assert.equal((applied.data?.kept as unknown[]).length, 1)
  assert.equal((applied.data?.regenerated as unknown[]).length, 1)
  assert.equal(setup.readSetting<{ kind?: string }>(`app.${appId}.modulePlanApplied`)?.kind, 'replan')
  const afterList = await request('GET', `/apps/${appId}/requirements-modules`)
  assert.equal(afterList.data?.planKind, 'replan')

  // 生成守卫（普通 HTTP，未进入 SSE）
  const noIds = await request('POST', `/apps/${appId}/requirements-modules/generate`, { reason: 'replan', moduleIds: [] })
  assert.equal(noIds.status, 400)
  const initialAfter = await request('POST', `/apps/${appId}/requirements-modules/generate`, { reason: 'initial' })
  assert.equal(initialAfter.status, 409)
  const keepGenerate = await request('POST', `/apps/${appId}/requirements-modules/generate`, {
    reason: 'replan',
    moduleIds: [first.moduleId]
  })
  assert.equal(keepGenerate.status, 400)

  // 真实 HTTP SSE：replan 生成 regenerate 模块成功
  const beforeVersion = setup.doc.ensureRequirementDoc(appId, undefined, order.id).doc.version
  const res = await fetch(`${base}/api/apps/${appId}/requirements-modules/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'replan', moduleIds: [order.id] }),
    signal: AbortSignal.timeout(15000)
  })
  assert.equal(res.status, 200)
  const text = await res.text()
  assert.match(text, /"type":"module-start"/)
  assert.match(text, /"type":"module-done"/)
  assert.match(text, /"type":"all-done"/)
  assert.match(text, /"ok":true/)
  const orderAfter = setup.doc.ensureRequirementDoc(appId, undefined, order.id)
  assert.equal(orderAfter.doc.version, beforeVersion + 1)
  assert.equal(orderAfter.doc.status, 'draft')
  assert.ok(orderAfter.doc.contentMd.includes('replan 真实 HTTP 生成内容'))
})

test('MF7 生成 SSE：真实 HTTP 下能完整收到 module-start/module-done/all-done（res close 口径）', async () => {
  const appId = 'ui-generate-success'
  newApp(appId, '生成应用')
  const first = setup.doc.ensureRequirementDoc(appId).doc
  setup.db.prepare('DELETE FROM app_settings WHERE key LIKE ?').run(`app.${appId}.%`)
  await request('PUT', `/apps/${appId}/requirements-doc/chat`, {
    messages: [{ id: 'm1', role: 'user', content: '商品管理与订单管理', time: '00:00:00' }]
  })
  const applied = await request('POST', `/apps/${appId}/requirements-modules/plan/apply`, {
    plan: {
      modules: [
        { key: 'product', title: '商品管理', scope: ['商品档案'] },
        { key: 'order', title: '订单管理', scope: ['订单创建'] }
      ]
    }
  })
  assert.equal(applied.status, 200)

  // 应用目录（生成器会 ensureAppAgents）与 opencode 生成器 stub（不启动 serve/不调模型）
  fs.mkdirSync(path.join(process.env.RG_PROJECTS_DIR as string, appId), { recursive: true })
  const { opencode } = await import('../opencode/runtime')
  const target = opencode as unknown as Record<string, unknown>
  target.lastUsedModel = async () => null
  target.defaultModel = async () => null
  target.ensureAgent = async () => undefined
  target.generateText = async () =>
    JSON.stringify({ sections: [{ id: 'problem', markdown: '真实 HTTP SSE 回归：生成内容' }] })

  const res = await fetch(`${base}/api/apps/${appId}/requirements-modules/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'retry', moduleIds: [first.moduleId] }),
    signal: AbortSignal.timeout(15000)
  })
  assert.equal(res.status, 200)
  assert.match(String(res.headers.get('content-type')), /text\/event-stream/)
  const text = await res.text()
  assert.match(text, /"type":"module-start"/)
  assert.match(text, /"type":"module-done"/)
  assert.match(text, /"type":"all-done"/)
  assert.match(text, /"ok":true/)
  const doc = setup.doc.ensureRequirementDoc(appId, undefined, first.moduleId)
  assert.equal(doc.doc.version, 2)
  assert.ok(doc.sections.find(section => section.sectionKey === 'problem')?.markdown.includes('真实 HTTP SSE 回归'))
})
