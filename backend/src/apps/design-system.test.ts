/**
 * 设计模板包 API + 应用级设计系统（P7-1）
 *
 * - GET /api/design-system、GET /api/design-system/:packId；
 * - POST /api/apps 设计系统字段（默认/自定义）落 app_settings；
 * - GET /api/apps/:id/design-system 默认/自定义；
 * - PATCH /api/apps/:id/design-system 校验后写入；
 * - 非法参数 4xx；DB 中不再有 prototype_templates 表。
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

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-design-system-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

const PACK_ID = 'afcenter-app-templates-v1'

interface ApiResult {
  status: number
  data: Record<string, unknown> | null
}

let server: Server | null = null
let base = ''
let db: typeof import('../db').db | null = null

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

function designOf(app: Record<string, unknown>): Record<string, unknown> {
  const design = app.designSystem as Record<string, unknown> | null | undefined
  assert.ok(design, 'payload 应有 designSystem')
  return design
}

before(async () => {
  db = (await import('../db')).db
  const express = (await import('express')).default
  const { apps, appsErrorHandler } = await import('../apps/routes')
  const { requirementTemplateRoutes, templateRoutes, templateErrorHandler } = await import('../templates/routes')
  const { designSystemRoutes, designSystemErrorHandler } = await import('../design/system-routes')

  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/apps', apps)
  app.use('/api/apps', appsErrorHandler)
  app.use('/api/requirement-templates', requirementTemplateRoutes)
  app.use('/api/requirement-templates', templateErrorHandler)
  app.use('/api/templates', templateRoutes)
  app.use('/api/templates', templateErrorHandler)
  app.use('/api/design-system', designSystemRoutes)
  app.use('/api/design-system', designSystemErrorHandler)

  server = app.listen(0)
  await new Promise<void>(resolve => server?.once('listening', () => resolve()))
  const address = server.address() as AddressInfo
  base = `http://127.0.0.1:${address.port}`
})

after(async () => {
  server?.close()
  db?.close()
  fs.rmSync(root, { recursive: true, force: true })
})

test('GET /api/design-system：1 个内置 pack，4 应用类型 / 4 风格 / 25 页面', async () => {
  const result = await request('GET', '/design-system')
  assert.equal(result.status, 200)
  const packs = result.data?.packs as Array<Record<string, unknown>>
  assert.equal(packs.length, 1)
  const pack = packs[0]
  assert.equal(pack.id, PACK_ID)
  assert.equal(pack.source, 'builtin')
  assert.equal(pack.pageCount, 25)
  assert.equal((pack.applicationTypes as unknown[]).length, 4)
  assert.equal((pack.styles as unknown[]).length, 4)
  assert.deepEqual(
    (pack.applicationTypes as Array<{ pageCount: number }>).map(type => type.pageCount),
    [5, 8, 8, 4]
  )
  assert.equal((pack.styles as Array<{ id: string }>)[0].id, 'platform-blue')
})

test('GET /api/design-system/:packId：完整 pack + 页面/配方/组件映射', async () => {
  const result = await request('GET', `/design-system/${PACK_ID}`)
  assert.equal(result.status, 200)
  assert.equal(result.data?.source, 'builtin')
  const pack = result.data?.pack as Record<string, unknown>
  assert.equal(pack.id, PACK_ID)
  const types = pack.applicationTypes as Array<{ id: string; pages: unknown[]; structure: string }>
  assert.equal(types.length, 4)
  assert.equal(types.reduce((total, type) => total + type.pages.length, 0), 25)
  assert.ok((pack.componentMap as Record<string, string>)['ref:org'] === 'pm-select-org')
  assert.ok((pack.pageRecipes as Record<string, string[]>)['tree-list'].includes('TreeListPage'))
  assert.ok((pack.conformance as string[]).some(line => line.includes('PageTemplates')))
  const orgPage = (
    types.find(type => type.id === 'enterprise-application-platform')!.pages as Array<Record<string, unknown>>
  ).find(page => page.id === 'organization')!
  assert.equal(orgPage.recipe, 'tree-list')
  assert.ok((orgPage.components as string[]).includes('pm-tree'))
  assert.match(String(orgPage.blueprint), /OrganizationUsers\.vue$/)

  const missing = await request('GET', '/design-system/not-exists')
  assert.equal(missing.status, 404)
  const bad = await request('GET', '/design-system/Not%20Allowed')
  assert.equal(bad.status, 400)
})

test('POST /api/apps：未传设计系统 → 默认 pack/类型/风格，落 app_settings 且不建原型模板表', async () => {
  const created = await request('POST', '/apps', { id: 'design-default', name: '默认设计应用' })
  assert.equal(created.status, 201)
  const app = appOf(created)
  const design = designOf(app)
  assert.equal((design.pack as { id: string }).id, PACK_ID)
  assert.equal((design.applicationType as { id: string }).id, 'enterprise-application-platform')
  assert.equal((design.style as { id: string }).id, 'platform-blue')
  assert.equal('legacyPrototypeTemplate' in app, false, 'payload 不应再有 legacyPrototypeTemplate')
  assert.equal('prototypeTemplateId' in app, false, 'payload 不应再有 prototypeTemplateId')

  const settings = db!
    .prepare('SELECT key, value FROM app_settings WHERE key LIKE ? ORDER BY key')
    .all('app.design-default.design.%') as Array<{ key: string; value: string }>
  assert.deepEqual(
    settings.map(row => [row.key, JSON.parse(row.value)]),
    [
      ['app.design-default.design.applicationType', 'enterprise-application-platform'],
      ['app.design-default.design.pack', PACK_ID],
      ['app.design-default.design.style', 'platform-blue']
    ]
  )

  const prototypeTable = db!
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'prototype_templates'")
    .get()
  assert.equal(prototypeTable, undefined, 'DB 不应再有 prototype_templates 表')

  const resolved = await request('GET', '/apps/design-default/design-system')
  assert.equal(resolved.status, 200)
  assert.deepEqual(resolved.data?.resolved, {
    pack: PACK_ID,
    applicationType: 'enterprise-application-platform',
    style: 'platform-blue',
    pageCount: 5
  })
  assert.equal((resolved.data?.pages as unknown[]).length, 5)
  assert.deepEqual(resolved.data?.skills, ['afcenter-page-generation', 'pm-components-usage'])
})

test('POST /api/apps：designSystem 对象/flat 字段写入自定义选择；非法值 400 且不建目录', async () => {
  const nested = await request('POST', '/apps', {
    id: 'design-ops',
    name: '运营应用',
    designSystem: {
      pack: PACK_ID,
      applicationType: 'operations-management',
      style: 'classic-warm'
    }
  })
  assert.equal(nested.status, 201)
  const design = designOf(appOf(nested))
  assert.equal((design.applicationType as { id: string }).id, 'operations-management')
  assert.equal((design.style as { id: string }).id, 'classic-warm')

  const flat = await request('POST', '/apps', {
    id: 'design-tool',
    name: '工具应用',
    designPack: PACK_ID,
    designApplicationType: 'incident-response-console',
    designStyle: 'high-contrast-tool'
  })
  assert.equal(flat.status, 201)
  const toolDesign = designOf(appOf(flat))
  assert.equal((toolDesign.applicationType as { id: string }).id, 'incident-response-console')
  assert.equal((toolDesign.style as { id: string }).id, 'high-contrast-tool')

  const appDesign = await request('GET', '/apps/design-ops/design-system')
  assert.equal(appDesign.status, 200)
  assert.equal((appDesign.data?.pages as unknown[]).length, 8)
  assert.equal((appDesign.data?.style as { id: string }).id, 'classic-warm')

  const badCases: Array<Record<string, unknown>> = [
    { id: 'bad-pack', designPack: 'missing-pack' },
    { id: 'bad-type', designApplicationType: 'missing-type' },
    { id: 'bad-style', designStyle: 'missing-style' }
  ]
  for (const body of badCases) {
    const result = await request('POST', '/apps', body)
    assert.equal(result.status, 400, `${String(body.id)} 应返回 400`)
    assert.equal(fs.existsSync(path.join(projects, String(body.id))), false, `${String(body.id)} 不应创建目录`)
    assert.equal(db!.prepare('SELECT 1 FROM apps WHERE id = ?').get(String(body.id)), undefined)
  }
})

test('PATCH /api/apps/:id/design-system：更新/保留字段 + 非法值 4xx', async () => {
  const updated = await request('PATCH', '/apps/design-default/design-system', {
    applicationType: 'data-governance-workbench',
    style: 'data-cyan'
  })
  assert.equal(updated.status, 200)
  const design = updated.data?.designSystem as Record<string, unknown>
  assert.equal((design.applicationType as { id: string }).id, 'data-governance-workbench')
  assert.equal((design.style as { id: string }).id, 'data-cyan')
  assert.equal((design.pack as { id: string }).id, PACK_ID)

  const styleOnly = await request('PATCH', '/apps/design-default/design-system', { style: 'platform-blue' })
  assert.equal(styleOnly.status, 200)
  const styleDesign = styleOnly.data?.designSystem as Record<string, unknown>
  assert.equal((styleDesign.applicationType as { id: string }).id, 'data-governance-workbench')
  assert.equal((styleDesign.style as { id: string }).id, 'platform-blue')

  const bad = await request('PATCH', '/apps/design-default/design-system', { style: 'missing-style' })
  assert.equal(bad.status, 400)
  const unchanged = await request('GET', '/apps/design-default/design-system')
  assert.equal((unchanged.data?.style as { id: string }).id, 'platform-blue')

  const badPack = await request('PATCH', '/apps/design-default/design-system', { pack: 'missing-pack' })
  assert.equal(badPack.status, 400)

  const missingApp = await request('PATCH', '/apps/not-exists/design-system', { style: 'platform-blue' })
  assert.equal(missingApp.status, 404)
})

test('自定义 pack：创建应用 + design-system origin/preview/pages + 应用内资产接口（白名单/路径安全）', async () => {
  const packId = 'supplier-hub'
  const builtinRoot = path.resolve(__dirname, '../../../templates/design-system/afcenter-app-templates-v1')
  const packRoot = path.join(process.env.RG_DATA_DIR as string, 'design-system', packId)
  const write = (relative: string, content: string | Buffer): void => {
    const file = path.join(packRoot, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  write(
    `application-types/${packId}/pages/supplier-list.vue`,
    fs.readFileSync(path.join(builtinRoot, 'application-types/operations-management/pages/OperationsList.vue'))
  )
  write(`application-types/${packId}/structure.css`, '.merged-marker { color: #145fba; }\n')
  write('styles/shared.css', ':root { --shared: 1; }\n')
  write('styles/data-cyan/style.css', '.visual-style-data-cyan { color: #145fba; }\n')
  write(
    'pack.json',
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: packId,
        name: '供应商管理模板',
        version: '1.0.2',
        defaultApplicationType: packId,
        defaultStyle: 'data-cyan',
        origin: {
          kind: 'custom',
          draftId: packId,
          baseApplicationType: 'enterprise-application-platform',
          style: 'data-cyan',
          revision: 3
        },
        applicationTypes: [
          {
            id: packId,
            name: '供应商管理模板',
            category: 'custom',
            description: '引用页 + 契约页',
            structure: `application-types/${packId}/structure.css`,
            defaultStyle: 'data-cyan',
            pages: [
              {
                id: 'supplier-list',
                name: '供应商列表',
                type: 'list',
                recipe: 'list',
                preview: 'list',
                description: '台账',
                kind: 'reference',
                blueprint: `application-types/${packId}/pages/supplier-list.vue`,
                source: { pack: PACK_ID, applicationType: 'operations-management', pageId: 'list' },
                components: ['pm-table']
              },
              {
                id: 'supplier-form',
                name: '供应商表单',
                type: 'form',
                recipe: 'dialog-form',
                preview: 'form',
                description: '弹窗表单',
                kind: 'contract',
                contract: { form: { presentation: 'dialog', columns: 2, fields: ['name'] } },
                sampleEntity: { id: 'supplier', name: '供应商', fields: [{ name: 'name', type: 'string' }] },
                components: ['pm-form-dialog']
              }
            ]
          }
        ],
        styles: [
          {
            id: 'data-cyan',
            name: '数据蓝青',
            className: 'visual-style-data-cyan',
            css: 'styles/data-cyan/style.css',
            description: '蓝青冷色',
            signature: '#145FBA',
            tokens: { primary: '#145fba', accent: '#07858d', neutral: '#66758a', background: '#f3f7fb', radius: 12, density: 'compact' }
          }
        ],
        skills: ['afcenter-page-generation', 'pm-components-usage'],
        componentMap: { 'ref:org': 'pm-select-org' },
        pageRecipes: { list: ['BusinessListPage'], 'dialog-form': ['StandardFormPage'] },
        conformance: ['页面使用 PageTemplates']
      },
      null,
      2
    )}\n`
  )

  const created = await request('POST', '/apps', {
    id: 'design-custom',
    name: '自定义模板应用',
    designSystem: { pack: packId, applicationType: packId, style: 'data-cyan' }
  })
  assert.equal(created.status, 201)
  const appDir = path.join(projects, 'design-custom')
  for (const relative of [
    'docs/design/design-system.json',
    `docs/design/template/${packId}/structure.css`,
    `docs/design/template/${packId}/pages/supplier-list.vue`,
    `docs/design/template/${packId}/contracts/supplier-form.json`,
    'docs/design/template/styles/data-cyan/style.css'
  ]) {
    assert.ok(fs.existsSync(path.join(appDir, relative)), `缺少 ${relative}`)
  }

  const resolved = await request('GET', '/apps/design-custom/design-system')
  assert.equal(resolved.status, 200)
  assert.deepEqual(resolved.data?.origin, {
    kind: 'custom',
    draftId: packId,
    baseApplicationType: 'enterprise-application-platform'
  })
  const preview = resolved.data?.preview as Record<string, unknown>
  assert.equal(preview?.kind, 'custom')
  assert.equal(preview?.baseApplicationType, 'enterprise-application-platform')
  assert.equal(preview?.styleClassName, 'visual-style-data-cyan')
  assert.match(String(preview?.structureUrl), /^\/api\/apps\/design-custom\/design-system\/asset\?path=/)
  const pages = resolved.data?.pages as Array<Record<string, unknown>>
  const listPage = pages.find(page => page.id === 'supplier-list')!
  const formPage = pages.find(page => page.id === 'supplier-form')!
  assert.equal(listPage.kind, 'reference')
  assert.equal(formPage.kind, 'contract')
  assert.equal(formPage.contractFile, `docs/design/template/${packId}/contracts/supplier-form.json`)

  const asset = await fetch(
    `${base}/api/apps/design-custom/design-system/asset?path=${encodeURIComponent(`${packId}/structure.css`)}`
  )
  assert.equal(asset.status, 200)
  assert.match(String(asset.headers.get('content-type')), /text\/css/)
  assert.match(await asset.text(), /merged-marker/)

  const jsonAsset = await fetch(
    `${base}/api/apps/design-custom/design-system/asset?path=${encodeURIComponent(`${packId}/contracts/supplier-form.json`)}`
  )
  assert.equal(jsonAsset.status, 400, '扩展名白名单只允许 css/svg/png/jpg/jpeg')
  const traversal = await fetch(
    `${base}/api/apps/design-custom/design-system/asset?path=${encodeURIComponent('../requirements/requirements-x.md')}`
  )
  assert.equal(traversal.status, 400, '路径安全：不允许 ..')
  const missing = await fetch(
    `${base}/api/apps/design-custom/design-system/asset?path=${encodeURIComponent(`${packId}/missing.css`)}`
  )
  assert.equal(missing.status, 404)
  const noApp = await fetch(
    `${base}/api/apps/not-exists/design-system/asset?path=${encodeURIComponent(`${packId}/structure.css`)}`
  )
  assert.equal(noApp.status, 404)

  // 受管副本删除后，打开应用（GET /apps/:id）会幂等恢复
  fs.rmSync(path.join(appDir, `docs/design/template/${packId}/contracts/supplier-form.json`))
  const reopened = await request('GET', '/apps/design-custom')
  assert.equal(reopened.status, 200)
  assert.ok(fs.existsSync(path.join(appDir, `docs/design/template/${packId}/contracts/supplier-form.json`)))
})

test('无设计三键的应用（旧登记/手工插入）：按默认 pack 解析（global-default），PATCH 后为 app-default', async () => {
  const now = new Date().toISOString()
  db!
    .prepare(
      `INSERT INTO apps
         (id, name, description, dir, backend_port, status, requirement_template_id, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, 'requirements', NULL, ?, ?)`
    )
    .run('bare-app', '裸应用', 'bare-app', 18082, now, now)

  const resolved = await request('GET', '/apps/bare-app/design-system')
  assert.equal(resolved.status, 200)
  assert.equal(resolved.data?.source, 'global-default')
  assert.equal((resolved.data?.pack as { id: string }).id, PACK_ID)
  assert.equal((resolved.data?.applicationType as { id: string }).id, 'enterprise-application-platform')
  assert.equal((resolved.data?.style as { id: string }).id, 'platform-blue')
  assert.equal((resolved.data?.pages as unknown[]).length, 5)

  const apps = await request('GET', '/apps')
  const bare = (apps.data?.apps as Array<Record<string, unknown>>).find(app => app.id === 'bare-app')
  assert.ok(bare)
  assert.ok(bare!.designSystem, 'payload 应始终返回 designSystem')
  assert.equal('legacyPrototypeTemplate' in bare!, false)

  const patched = await request('PATCH', '/apps/bare-app/design-system', { style: 'data-cyan' })
  assert.equal(patched.status, 200)
  const after = await request('GET', '/apps/bare-app/design-system')
  assert.equal(after.data?.source, 'app-default')
  assert.equal((after.data?.style as { id: string }).id, 'data-cyan')
})
