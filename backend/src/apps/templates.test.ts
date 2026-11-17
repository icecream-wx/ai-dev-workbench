/**
 * 创建应用选模板 + 模板解析（#7）
 *
 * 覆盖：
 * - 创建应用写入 requirement_template_id / prototype_template_id；
 * - 未提供时为 null，读取回退默认；
 * - 首次需求文档/设计项目初始化使用应用默认；
 * - 非法/不存在/QA 模板 → 400 且不创建目录/登记；
 * - 切换需求/原型模板同步应用默认；
 * - 只读解析端点优先级（design-project > app-default > global-default）且不创建文档/项目；
 * - 模板被删除时回退默认，payload/解析不 500。
 *
 * 使用临时 SQLite + 临时 projects 目录；不调用模型、不启动 opencode。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-app-templates-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects

interface Setup {
  db: typeof import('../db').db
  doc: typeof import('../requirements/doc')
  design: typeof import('../design/service')
  requirementTemplates: typeof import('../requirements/templates')
  prototypeTemplates: typeof import('../design/templates')
  resolution: typeof import('./template-resolution')
}

interface ApiResult {
  status: number
  data: Record<string, unknown> | null
}

let server: Server | null = null
let base = ''
let setupPromise: Promise<Setup> | null = null

function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const dbModule = await import('../db')
    return {
      db: dbModule.db,
      doc: await import('../requirements/doc'),
      design: await import('../design/service'),
      requirementTemplates: await import('../requirements/templates'),
      prototypeTemplates: await import('../design/templates'),
      resolution: await import('./template-resolution')
    }
  })()
  return setupPromise
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

async function createApp(input: Record<string, unknown>): Promise<ApiResult> {
  return request('POST', '/apps', input)
}

function appPayloadOf(result: ApiResult): Record<string, unknown> {
  const app = (result.data ?? {}).app as Record<string, unknown> | undefined
  assert.ok(app, '响应里应有 app')
  return app
}

before(async () => {
  const context = await setup()
  const express = (await import('express')).default
  const { apps, appsErrorHandler } = await import('./routes')

  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/apps', apps)
  app.use('/api/apps', appsErrorHandler)

  server = app.listen(0)
  await new Promise<void>(resolve => server?.once('listening', () => resolve()))
  const address = server.address() as AddressInfo
  base = `http://127.0.0.1:${address.port}`
  assert.ok(context.db)
})

after(async () => {
  server?.close()
  if (setupPromise) {
    const { db } = await setupPromise
    try {
      db.close()
    } catch {
      // 已关闭
    }
  }
  fs.rmSync(root, { recursive: true, force: true })
})

test('创建应用带两个模板：写入列 + payload 解析', async () => {
  const context = await setup()
  const result = await createApp({
    id: 'tpl-app',
    name: '模板应用',
    requirementTemplateId: 'builtin-prd-lite',
    prototypeTemplateId: 'builtin-prototype-minimal'
  })
  assert.equal(result.status, 201)
  const app = appPayloadOf(result)
  assert.equal(app.requirementTemplateId, 'builtin-prd-lite')
  assert.equal(app.requirementTemplateName, '精简 PRD')
  assert.equal(app.prototypeTemplateId, 'builtin-prototype-minimal')
  assert.equal(app.prototypeTemplateName, '简洁后台')
  // 尚无设计项目 → 应用默认
  assert.equal(app.prototypeTemplateSource, 'app-default')

  const row = context.db
    .prepare('SELECT requirement_template_id, prototype_template_id FROM apps WHERE id = ?')
    .get('tpl-app') as { requirement_template_id: string | null; prototype_template_id: string | null }
  assert.equal(row.requirement_template_id, 'builtin-prd-lite')
  assert.equal(row.prototype_template_id, 'builtin-prototype-minimal')

  // GET /apps/:id 与创建响应一致
  const detail = await request('GET', '/apps/tpl-app')
  assert.equal(detail.status, 200)
  assert.equal(appPayloadOf(detail).requirementTemplateId, 'builtin-prd-lite')
  assert.ok(fs.existsSync(path.join(projects, 'tpl-app')))
})

test('未带模板：列保存 null，payload/解析回退默认', async () => {
  const context = await setup()
  const result = await createApp({ id: 'default-app', name: '默认模板应用' })
  assert.equal(result.status, 201)
  const app = appPayloadOf(result)
  assert.equal(app.requirementTemplateId, 'builtin-prd')
  assert.equal(app.prototypeTemplateId, 'builtin-prototype-enterprise')
  assert.equal(app.prototypeTemplateSource, 'global-default')

  const row = context.db
    .prepare('SELECT requirement_template_id, prototype_template_id FROM apps WHERE id = ?')
    .get('default-app') as { requirement_template_id: string | null; prototype_template_id: string | null }
  assert.equal(row.requirement_template_id, null)
  assert.equal(row.prototype_template_id, null)

  const doc = context.doc.ensureRequirementDoc('default-app')
  assert.equal(doc.doc.templateId, 'builtin-prd')
  const project = context.design.ensureDesignProject('default-app')
  assert.equal(project.prototype_template_id, 'builtin-prototype-enterprise')
})

test('非默认内置模板：需求文档与设计项目按应用默认初始化，已有对象保持模板', async () => {
  const context = await setup()
  const doc = context.doc.ensureRequirementDoc('tpl-app')
  assert.equal(doc.doc.templateId, 'builtin-prd-lite')
  assert.equal(doc.template.name, '精简 PRD')
  assert.deepEqual(
    doc.sections.map(section => section.sectionKey),
    doc.template.sections.map(section => section.id)
  )

  const project = context.design.ensureDesignProject('tpl-app')
  assert.equal(project.prototype_template_id, 'builtin-prototype-minimal')

  // 已有文档/项目不被应用默认覆盖（即使应用默认已改）
  context.db.prepare("UPDATE apps SET requirement_template_id = 'builtin-prd', prototype_template_id = 'builtin-prototype-enterprise' WHERE id = 'tpl-app'").run()
  assert.equal(context.doc.ensureRequirementDoc('tpl-app').doc.templateId, 'builtin-prd-lite')
  assert.equal(context.design.ensureDesignProject('tpl-app').prototype_template_id, 'builtin-prototype-minimal')
  assert.equal(context.resolution.resolveAppTemplates('tpl-app').requirement.id, 'builtin-prd-lite')
  assert.equal(context.resolution.resolveAppTemplates('tpl-app').prototype.id, 'builtin-prototype-minimal')
  assert.equal(context.resolution.resolveAppTemplates('tpl-app').prototypeSource, 'design-project')
})

test('非法 / QA / 不存在模板：400 且不创建目录与登记', async () => {
  const context = await setup()
  const qa = await createApp({ id: 'qa-app', name: 'QA 模板应用', requirementTemplateId: 'builtin-qa-test-plan' })
  assert.equal(qa.status, 400)
  assert.match(String((qa.data ?? {}).error ?? ''), /阶段|不能用于需求文档/)

  const missingRequirement = await createApp({
    id: 'missing-req-app',
    name: '不存在需求模板',
    requirementTemplateId: 'tpl-does-not-exist'
  })
  assert.equal(missingRequirement.status, 400)

  const missingPrototype = await createApp({
    id: 'missing-proto-app',
    name: '不存在原型模板',
    prototypeTemplateId: 'proto-does-not-exist'
  })
  assert.equal(missingPrototype.status, 400)

  for (const id of ['qa-app', 'missing-req-app', 'missing-proto-app']) {
    const row = context.db.prepare('SELECT 1 FROM apps WHERE id = ?').get(id)
    assert.equal(row, undefined, `${id} 不应登记`)
    assert.equal(fs.existsSync(path.join(projects, id)), false, `${id} 不应创建目录`)
  }
})

test('切换需求/原型模板同步应用默认，解析跟随设计项目', async () => {
  const context = await setup()
  context.doc.switchDocTemplate('tpl-app', 'builtin-prd')
  let row = context.db
    .prepare('SELECT requirement_template_id FROM apps WHERE id = ?')
    .get('tpl-app') as { requirement_template_id: string | null }
  assert.equal(row.requirement_template_id, 'builtin-prd')

  const switched = context.design.switchProtoTemplate('tpl-app', 'builtin-prototype-enterprise')
  assert.equal(switched.template.id, 'builtin-prototype-enterprise')
  row = context.db
    .prepare('SELECT prototype_template_id FROM apps WHERE id = ?')
    .get('tpl-app') as { prototype_template_id: string | null }
  assert.equal(row.prototype_template_id, 'builtin-prototype-enterprise')

  const resolved = context.resolution.resolveAppTemplates('tpl-app')
  assert.equal(resolved.prototype.id, 'builtin-prototype-enterprise')
  assert.equal(resolved.prototypeSource, 'design-project')
  const detail = await request('GET', '/apps/tpl-app')
  assert.equal(appPayloadOf(detail).prototypeTemplateId, 'builtin-prototype-enterprise')
  assert.equal(appPayloadOf(detail).prototypeTemplateSource, 'design-project')
  assert.equal(appPayloadOf(detail).requirementTemplateId, 'builtin-prd')
})

test('解析端点优先级：设计项目 > 应用默认 > 全局默认，且不创建项目/文档', async () => {
  const context = await setup()
  const created = await createApp({
    id: 'resolve-app',
    name: '解析优先级应用',
    prototypeTemplateId: 'builtin-prototype-minimal'
  })
  assert.equal(created.status, 201)

  // 无设计项目/需求文档：只读，不创建
  const beforeCounts = (): { projects: number; docs: number } => ({
    projects: (context.db.prepare('SELECT COUNT(*) AS c FROM app_design_projects WHERE app_id = ?').get('resolve-app') as { c: number }).c,
    docs: (context.db.prepare('SELECT COUNT(*) AS c FROM app_requirement_docs WHERE app_id = ?').get('resolve-app') as { c: number }).c
  })
  assert.deepEqual(beforeCounts(), { projects: 0, docs: 0 })

  const appDefault = await request('GET', '/apps/resolve-app/templates')
  assert.equal(appDefault.status, 200)
  const payload = appDefault.data ?? {}
  assert.deepEqual(payload.requirement, { id: 'builtin-prd', name: '工作台标准 PRD' })
  assert.deepEqual(payload.prototype, { id: 'builtin-prototype-minimal', name: '简洁后台' })
  assert.equal(payload.prototypeSource, 'app-default')
  assert.deepEqual(beforeCounts(), { projects: 0, docs: 0 })

  // 设计项目存在 → design-project 优先（即使应用默认不同）
  context.design.ensureDesignProject('resolve-app')
  context.db.prepare("UPDATE apps SET prototype_template_id = 'builtin-prototype-enterprise' WHERE id = 'resolve-app'").run()
  const designProject = (await request('GET', '/apps/resolve-app/templates')).data ?? {}
  assert.deepEqual(designProject.prototype, { id: 'builtin-prototype-minimal', name: '简洁后台' })
  assert.equal(designProject.prototypeSource, 'design-project')

  // 删除设计项目 → 应用默认
  context.db.prepare('DELETE FROM app_design_projects WHERE app_id = ?').run('resolve-app')
  const afterDelete = (await request('GET', '/apps/resolve-app/templates')).data ?? {}
  assert.deepEqual(afterDelete.prototype, { id: 'builtin-prototype-enterprise', name: '企业级专业管理' })
  assert.equal(afterDelete.prototypeSource, 'app-default')

  // 应用默认也失效 → 全局默认
  context.db.prepare('UPDATE apps SET prototype_template_id = NULL WHERE id = ?').run('resolve-app')
  const globalDefault = (await request('GET', '/apps/resolve-app/templates')).data ?? {}
  assert.deepEqual(globalDefault.prototype, { id: 'builtin-prototype-enterprise', name: '企业级专业管理' })
  assert.equal(globalDefault.prototypeSource, 'global-default')

  // 需求：已有文档以文档为准（应用默认此时为 null）
  context.doc.switchDocTemplate('resolve-app', 'builtin-prd-lite')
  const withDoc = (await request('GET', '/apps/resolve-app/templates')).data ?? {}
  assert.deepEqual(withDoc.requirement, { id: 'builtin-prd-lite', name: '精简 PRD' })

  // 未知应用 404
  assert.equal((await request('GET', '/apps/not-found-app/templates')).status, 404)
})

test('模板被删除/无效：回退默认，不 500', async () => {
  const context = await setup()
  const reqTemplate = context.requirementTemplates.createTemplate({
    name: '临时需求模板',
    stage: 'requirements',
    category: '测试',
    description: '',
    prompt: '测试提示词',
    sections: [{ id: 'overview', title: '概述', level: 2, kind: 'markdown', guidance: '', required: true }]
  })
  const protoTemplate = context.prototypeTemplates.createPrototypeTemplate({ name: '临时原型模板', prompt: '测试提示词' })

  const created = await createApp({
    id: 'fallback-app',
    name: '回退应用',
    requirementTemplateId: reqTemplate.id,
    prototypeTemplateId: protoTemplate.id
  })
  assert.equal(created.status, 201)
  assert.equal(appPayloadOf(created).requirementTemplateId, reqTemplate.id)

  // 应用默认引用不阻塞删除模板（解析时回退）
  context.requirementTemplates.deleteTemplate(reqTemplate.id)
  context.prototypeTemplates.deletePrototypeTemplate(protoTemplate.id)

  const detail = await request('GET', '/apps/fallback-app')
  assert.equal(detail.status, 200)
  const app = appPayloadOf(detail)
  assert.equal(app.requirementTemplateId, 'builtin-prd')
  assert.equal(app.requirementTemplateName, '工作台标准 PRD')
  assert.equal(app.prototypeTemplateId, 'builtin-prototype-enterprise')
  assert.equal(app.prototypeTemplateSource, 'global-default')

  const resolved = (await request('GET', '/apps/fallback-app/templates')).data ?? {}
  assert.deepEqual(resolved.requirement, { id: 'builtin-prd', name: '工作台标准 PRD' })

  // 首次初始化同样回退默认
  assert.equal(context.doc.ensureRequirementDoc('fallback-app').doc.templateId, 'builtin-prd')
  assert.equal(context.design.ensureDesignProject('fallback-app').prototype_template_id, 'builtin-prototype-enterprise')
})
