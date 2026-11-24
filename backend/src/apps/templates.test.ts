/**
 * 应用/模板 API：创建带模板、payload 解析、非法模板 400、模板删除回退、
 * 模板同步/引用、单需求文档 API、artifacts 空状态
 *
 * 使用临时 SQLite + 临时 projects；不调用模型、不启动 opencode。
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
process.env.OPENCODE_AUTO_START = 'false'

interface ApiResult {
  status: number
  data: Record<string, unknown> | null
}

let server: Server | null = null
let base = ''
let dbModule: typeof import('../db').db | null = null

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

function appOf(result: ApiResult): Record<string, unknown> {
  const app = (result.data ?? {}).app as Record<string, unknown> | undefined
  assert.ok(app, '响应里应有 app')
  return app
}

before(async () => {
  dbModule = (await import('../db')).db
  const express = (await import('express')).default
  const { apps, appsErrorHandler } = await import('./routes')
  const { requirementTemplateRoutes, templateRoutes, templateErrorHandler } = await import('../templates/routes')

  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/apps', apps)
  app.use('/api/apps', appsErrorHandler)
  app.use('/api/requirement-templates', requirementTemplateRoutes)
  app.use('/api/requirement-templates', templateErrorHandler)
  app.use('/api/templates', templateRoutes)
  app.use('/api/templates', templateErrorHandler)

  server = app.listen(0)
  await new Promise<void>(resolve => server?.once('listening', () => resolve()))
  const address = server.address() as AddressInfo
  base = `http://127.0.0.1:${address.port}`
})

after(async () => {
  server?.close()
  dbModule?.close()
  fs.rmSync(root, { recursive: true, force: true })
})

test('创建应用带模板：写入列 + payload 解析 + 工作区结构', async () => {
  const result = await request('POST', '/apps', {
    id: 'tpl-app',
    name: '模板应用',
    requirementTemplateId: 'builtin-prd-lite'
  })
  assert.equal(result.status, 201)
  const app = appOf(result)
  assert.equal(app.requirementTemplateId, 'builtin-prd-lite')
  assert.equal(app.requirementTemplateName, '精简 PRD')
  assert.equal((app.designSystem as { applicationType: { id: string } }).applicationType.id, 'enterprise-application-platform')
  assert.equal(app.prototypeTemplateId, undefined, 'payload 不应再有 prototypeTemplateId')
  assert.equal(app.prototypeTemplateName, undefined, 'payload 不应再有 prototypeTemplateName')
  assert.equal(app.legacyPrototypeTemplate, undefined, 'payload 不应再有 legacyPrototypeTemplate')
  assert.ok(fs.existsSync(path.join(projects, 'tpl-app', '.opencode', 'skills', 'adw-requirements-document', 'SKILL.md')))
  // P6-2：被选中的需求模板生成一个模板 skill
  assert.ok(
    fs.existsSync(
      path.join(projects, 'tpl-app', '.opencode', 'skills', 'adw-template-req-builtin-prd-lite', 'SKILL.md')
    )
  )
  // P7-5a：新应用按设计系统生成设计模板 skill；不再生成旧原型模板 skill
  assert.ok(
    fs.existsSync(
      path.join(
        projects,
        'tpl-app',
        '.opencode',
        'skills',
        'adw-template-proto-enterprise-application-platform',
        'assets',
        'design-system.json'
      )
    )
  )
  assert.equal(
    fs.existsSync(
      path.join(projects, 'tpl-app', '.opencode', 'skills', 'adw-template-proto-builtin-prototype-enterprise')
    ),
    false
  )

  const detail = await request('GET', '/apps/tpl-app')
  assert.equal(detail.status, 200)
  assert.equal(appOf(detail).requirementTemplateId, 'builtin-prd-lite')

  const templates = await request('GET', '/apps/tpl-app/templates')
  assert.deepEqual((templates.data ?? {}).requirement, { id: 'builtin-prd-lite', name: '精简 PRD' })
  assert.equal((templates.data ?? {}).prototype, undefined, 'templates 响应不应再有 prototype')
})

test('未带模板：需求列保存 null，payload 回退默认；设计系统始终解析', async () => {
  const result = await request('POST', '/apps', { id: 'default-app', name: '默认模板应用' })
  assert.equal(result.status, 201)
  const app = appOf(result)
  assert.equal(app.requirementTemplateId, 'builtin-prd')
  const design = app.designSystem as { pack: { id: string }; applicationType: { id: string }; style: { id: string } }
  assert.equal(design.pack.id, 'afcenter-app-templates-v1')
  assert.equal(design.applicationType.id, 'enterprise-application-platform')
  assert.equal(design.style.id, 'platform-blue')
  const row = dbModule?.prepare('SELECT requirement_template_id FROM apps WHERE id = ?').get('default-app') as
    | { requirement_template_id: string | null }
    | undefined
  assert.equal(row?.requirement_template_id, null)
  const columns = (dbModule?.prepare('PRAGMA table_info(apps)').all() as Array<{ name: string }>).map(item => item.name)
  assert.equal(columns.includes('prototype_template_id'), false, 'apps 不应再有 prototype_template_id 列')
})

test('非法 / QA / 不存在模板：400 且不创建目录与登记', async () => {
  const qa = await request('POST', '/apps', { id: 'qa-app', name: 'QA', requirementTemplateId: 'builtin-qa-test-plan' })
  assert.equal(qa.status, 400)
  assert.match(String((qa.data ?? {}).error ?? ''), /不能用于需求文档/)

  const missingRequirement = await request('POST', '/apps', {
    id: 'missing-req-app',
    name: '不存在需求模板',
    requirementTemplateId: 'tpl-does-not-exist'
  })
  assert.equal(missingRequirement.status, 400)

  for (const id of ['qa-app', 'missing-req-app']) {
    assert.equal(fs.existsSync(path.join(projects, id)), false, `${id} 不应创建目录`)
    const row = dbModule?.prepare('SELECT 1 FROM apps WHERE id = ?').get(id)
    assert.equal(row, undefined, `${id} 不应登记`)
  }
})

test('旧客户端带 prototypeTemplateId：忽略并 warning，不写入任何列', async () => {
  const ignored = await request('POST', '/apps', {
    id: 'ignored-proto-app',
    name: '忽略原型模板',
    prototypeTemplateId: 'builtin-prototype-enterprise'
  })
  assert.equal(ignored.status, 201)
  assert.ok(
    ((ignored.data?.warnings as string[]) ?? []).some(line => line.includes('prototypeTemplateId')),
    '应提示已忽略 prototypeTemplateId'
  )
  assert.equal(appOf(ignored).prototypeTemplateId, undefined)
  assert.equal(
    fs.existsSync(path.join(projects, 'ignored-proto-app', '.opencode', 'skills', 'adw-template-proto-builtin-prototype-enterprise')),
    false
  )
  assert.equal((await request('DELETE', '/apps/ignored-proto-app?confirm=true')).status, 200)
})

test('单需求文档 API：骨架已生成/不覆盖；artifacts 聚合', async () => {
  const existing = await request('GET', '/apps/tpl-app/requirements-document')
  assert.equal(existing.status, 200)
  assert.equal(existing.data?.requirement?.exists, true)
  assert.equal(existing.data?.requirement?.file, 'docs/requirements/requirements.md')

  const again = await request('POST', '/apps/tpl-app/requirements-document')
  assert.equal(again.status, 200)
  assert.equal(again.data?.skipped, true)
  assert.equal(again.data?.created, false)

  const artifacts = await request('GET', '/apps/tpl-app/artifacts')
  assert.equal(artifacts.status, 200)
  assert.equal(artifacts.data?.requirement?.exists, true)
  assert.ok((artifacts.data?.requirement?.sections as unknown[]).length >= 1)
  assert.deepEqual(artifacts.data?.errors, [])
  assert.deepEqual(artifacts.data?.pages?.pageSets, [])
  assert.equal(typeof artifacts.data?.designHash, 'string')

  const chatWithoutText = await request('POST', '/apps/tpl-app/chat', { view: 'requirements', text: '' })
  assert.equal(chatWithoutText.status, 400)
})

test('模板同步/引用接口：sync 幂等、usage 列出单需求文档引用', async () => {
  const custom = await request('POST', '/requirement-templates', {
    name: '接口模板',
    stage: 'requirements',
    prompt: '写需求',
    sections: [{ id: 'goals', title: '目标', level: 2, kind: 'markdown', guidance: '', required: true }]
  })
  assert.equal(custom.status, 201)
  const id = ((custom.data ?? {}).template as { id: string }).id

  assert.equal((await request('POST', '/apps', { id: 'sync-app', name: '同步应用', requirementTemplateId: id })).status, 201)
  // scaffold 已按所选模板生成 requirements.md 骨架（frontmatter template=id）

  const sync1 = await request('POST', `/templates/requirement/${id}/sync`)
  assert.equal(sync1.status, 200)
  assert.equal(sync1.data?.templateSkill, `adw-template-req-${id}`)
  assert.ok(Array.isArray(sync1.data?.warnings))
  assert.ok(
    fs.existsSync(path.join(projects, 'sync-app', '.opencode', 'skills', `adw-template-req-${id}`, 'SKILL.md'))
  )
  const sync2 = await request('POST', `/templates/requirement/${id}/sync`)
  assert.deepEqual(sync1.data?.apps, sync2.data?.apps)

  const usage = await request('GET', `/templates/requirement/${id}/usage`)
  assert.equal(usage.status, 200)
  assert.equal((usage.data?.apps as unknown[]).length, 1)

  const blocked = await request('DELETE', `/requirement-templates/${id}`)
  assert.equal(blocked.status, 409)
  assert.match(String((blocked.data ?? {}).error ?? ''), /仍被 1 个应用/)

  const badKind = await request('POST', '/templates/nope/x/sync')
  assert.equal(badKind.status, 400)
  const missing = await request('POST', '/templates/requirement/missing-template/sync')
  assert.equal(missing.status, 404)
})

test('应用默认模板被删除：解析回退默认，不 500', async () => {
  const custom = await request('POST', '/requirement-templates', {
    name: '临时需求模板',
    stage: 'requirements',
    prompt: '测试提示词',
    sections: [{ id: 'overview', title: '概述', level: 2, kind: 'markdown', guidance: '', required: true }]
  })
  const id = ((custom.data ?? {}).template as { id: string }).id
  assert.equal(
    (await request('POST', '/apps', { id: 'fallback-app', name: '回退应用', requirementTemplateId: id })).status,
    201
  )

  // 无文档引用 → 允许删除；先解除需求文档的 template 引用
  const doc = path.join(projects, 'fallback-app', 'docs', 'requirements', 'requirements.md')
  fs.writeFileSync(doc, '---\ntitle: "回退应用"\ntemplate: builtin-prd\n---\n\n# 回退应用\n', 'utf8')
  assert.equal((await request('DELETE', `/requirement-templates/${id}`)).status, 200)
  const detail = await request('GET', '/apps/fallback-app')
  assert.equal(detail.status, 200)
  assert.equal(appOf(detail).requirementTemplateId, 'builtin-prd')
})

test('删除应用：删除登记、会话与目录', async () => {
  const before = await request('DELETE', '/apps/sync-app')
  assert.equal(before.status, 400)
  assert.equal((await request('DELETE', '/apps/sync-app?confirm=true')).status, 200)
  assert.equal(fs.existsSync(path.join(projects, 'sync-app')), false)
  assert.equal(dbModule?.prepare('SELECT 1 FROM apps WHERE id = ?').get('sync-app'), undefined)
})
