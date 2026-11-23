/**
 * P7-7a API 端到端（/api/design-templates + /api/design-system 扩展）
 *
 * 覆盖：catalog / drafts CRUD / generate / validate / publish / asset / delete，
 * 以及内置 403、引用 409、路径安全 400、404。
 * 使用临时 RG_DATA_DIR / RG_PROJECTS_DIR 与临时端口；不启动 opencode、不调模型。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p77a-routes-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_AUTO_START = 'false'

interface ApiResult {
  status: number
  data: Record<string, unknown> | null
  text: string
  contentType: string
}

let server: Server | null = null
let base = ''
let db: typeof import('../db').db | null = null
let paths: typeof import('./paths') | null = null

const PACK_ID = 'supplier-hub'
const BUILTIN_ID = 'afcenter-app-templates-v1'

async function request(method: string, apiPath: string, body?: unknown): Promise<ApiResult> {
  const response = await fetch(`${base}/api${apiPath}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await response.text()
  let data: Record<string, unknown> | null = null
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : null
  } catch {
    data = null
  }
  return { status: response.status, data, text, contentType: response.headers.get('content-type') ?? '' }
}

function validSpec(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: PACK_ID,
    name: '供应商管理模板',
    description: '供应商台账 + 表单',
    baseApplicationType: 'enterprise-application-platform',
    style: 'data-cyan',
    pages: [
      {
        id: 'supplier-list',
        name: '供应商列表',
        kind: 'reference',
        source: { pack: BUILTIN_ID, applicationType: 'operations-management', pageId: 'list' }
      },
      {
        id: 'supplier-form',
        name: '供应商表单',
        kind: 'contract',
        type: 'form',
        recipe: 'dialog-form',
        contract: { form: { presentation: 'dialog', columns: 2, groups: [{ title: '基本信息', fields: ['name'] }] } },
        sampleEntity: { id: 'supplier', name: '供应商', fields: [{ name: 'name', label: '名称', type: 'string' }] }
      }
    ]
  }
}

before(async () => {
  db = (await import('../db')).db
  paths = await import('./paths')
  const express = (await import('express')).default
  const { designTemplateRoutes, designTemplateErrorHandler } = await import('./routes')
  const { designSystemRoutes, designSystemErrorHandler } = await import('../design/system-routes')

  const app = express()
  app.use(express.json({ limit: '16mb' }))
  app.use('/api/design-templates', designTemplateRoutes)
  app.use('/api/design-templates', designTemplateErrorHandler)
  app.use('/api/design-system', designSystemRoutes)
  app.use('/api/design-system', designSystemErrorHandler)

  server = app.listen(0)
  await new Promise<void>(resolve => server?.once('listening', () => resolve()))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(() => {
  server?.close()
  db?.close()
  fs.rmSync(root, { recursive: true, force: true })
})

test('GET /catalog：200，25 页 / 39 组件 / 13/39 可映射控件', async () => {
  const result = await request('GET', '/design-templates/catalog')
  assert.equal(result.status, 200)
  const counts = result.data?.index as { counts: Record<string, number>; controls: Record<string, number> }
  assert.equal(counts.counts.pages, 25)
  assert.equal(counts.counts.components, 39)
  assert.equal(counts.controls.keys, 20)
  assert.equal(counts.controls.mappable, 13)
})

test('drafts CRUD：创建/列表/详情/非法参数/404', async () => {
  const bad = await request('POST', '/design-templates/drafts', { name: '坏风格', style: 'nope' })
  assert.equal(bad.status, 400)

  const created = await request('POST', '/design-templates/drafts', {
    name: '供应商管理模板',
    id: PACK_ID,
    style: 'data-cyan'
  })
  assert.equal(created.status, 201)
  const draft = created.data?.draft as Record<string, unknown>
  assert.equal(draft.id, PACK_ID)
  assert.equal(draft.status, 'draft')

  const duplicate = await request('POST', '/design-templates/drafts', { name: '重复', id: PACK_ID })
  assert.equal(duplicate.status, 409)
  assert.equal(duplicate.data?.code, 'pack-id-exists')

  const list = await request('GET', '/design-templates/drafts')
  assert.equal(list.status, 200)
  assert.equal((list.data?.drafts as unknown[]).length, 1)

  const detail = await request('GET', `/design-templates/drafts/${PACK_ID}`)
  assert.equal(detail.status, 200)
  assert.equal((detail.data?.draft as Record<string, unknown>).id, PACK_ID)
  assert.equal((detail.data?.validation as Record<string, unknown>).ok, false, 'starter spec 空 pages 校验失败')

  const missingDraft = await request('GET', '/design-templates/drafts/no-such')
  assert.equal(missingDraft.status, 404)
  const badId = await request('GET', '/design-templates/drafts/Bad%20Id')
  assert.equal(badId.status, 400)
})

test('generate / validate：非法 spec 400；合法 spec 生成 200 且校验通过', async () => {
  const invalid = await request('POST', `/design-templates/drafts/${PACK_ID}/generate`)
  assert.equal(invalid.status, 400)
  assert.ok(
    (invalid.data?.errors as Array<{ code: string }>).some(issue => issue.code === 'page-count'),
    JSON.stringify(invalid.data)
  )

  const specFile = paths!.draftSpecFile(PACK_ID)
  fs.writeFileSync(specFile, `${JSON.stringify(validSpec(), null, 2)}\n`, 'utf8')
  const generated = await request('POST', `/design-templates/drafts/${PACK_ID}/generate`)
  assert.equal(generated.status, 200, JSON.stringify(generated.data))
  assert.equal(generated.data?.ok, true)
  assert.equal((generated.data?.pack as Record<string, unknown>).pageCount, 2)

  const validated = await request('POST', `/design-templates/drafts/${PACK_ID}/validate`)
  assert.equal(validated.status, 200)
  assert.equal(validated.data?.ok, true)
  assert.equal((validated.data?.pack as Record<string, unknown>).id, PACK_ID)

  const notGenerated = await request('POST', '/design-templates/drafts/no-such/validate')
  assert.equal(notGenerated.status, 404)
})

test('草稿资产：structure.css 200；非法扩展/穿越 400；不存在 404', async () => {
  const structurePath = `application-types/${PACK_ID}/structure.css`
  const ok = await request('GET', `/design-templates/drafts/${PACK_ID}/asset?path=${encodeURIComponent(structurePath)}`)
  assert.equal(ok.status, 200)
  assert.match(ok.contentType, /text\/css/)
  assert.match(ok.text, new RegExp(`application-type|optimized-suite|\\.pm-`))

  const badExt = await request(
    'GET',
    `/design-templates/drafts/${PACK_ID}/asset?path=${encodeURIComponent('pack.json')}`
  )
  assert.equal(badExt.status, 400)

  const traversal = await request(
    'GET',
    `/design-templates/drafts/${PACK_ID}/asset?path=${encodeURIComponent('../pack.json')}`
  )
  assert.equal(traversal.status, 400)

  const missing = await request(
    'GET',
    `/design-templates/drafts/${PACK_ID}/asset?path=${encodeURIComponent('application-types/x/none.css')}`
  )
  assert.equal(missing.status, 404)
})

test('发布 + 只读 pack：publish 200；design-system 摘要/详情/资产；内置 403', async () => {
  const builtinPublish = await request('POST', `/design-templates/drafts/${BUILTIN_ID}/publish`)
  assert.equal(builtinPublish.status, 403)
  assert.equal(builtinPublish.data?.code, 'builtin-readonly')

  const published = await request('POST', `/design-templates/drafts/${PACK_ID}/publish`)
  assert.equal(published.status, 200, JSON.stringify(published.data))
  assert.deepEqual(published.data?.pack, { id: PACK_ID, version: '1.0.0', revision: 1 })

  const packs = await request('GET', '/design-system')
  assert.equal(packs.status, 200)
  const custom = (packs.data?.packs as Array<Record<string, unknown>>).find(item => item.id === PACK_ID)!
  assert.equal(custom.templateKind, 'custom')
  assert.equal((custom.origin as Record<string, unknown>).revision, 1)

  const detail = await request('GET', `/design-system/${PACK_ID}`)
  assert.equal(detail.status, 200)
  assert.equal(detail.data?.source, 'custom')
  const pack = detail.data?.pack as Record<string, unknown>
  const pages = (pack.applicationTypes as Array<Record<string, unknown>>)[0].pages as Array<Record<string, unknown>>
  assert.deepEqual(pages.map(page => page.kind), ['reference', 'contract'])

  const asset = await request(
    'GET',
    `/design-system/${PACK_ID}/asset?path=${encodeURIComponent(`application-types/${PACK_ID}/structure.css`)}`
  )
  assert.equal(asset.status, 200)
  assert.match(asset.contentType, /text\/css/)

  const builtinAsset = await request(
    'GET',
    `/design-system/${BUILTIN_ID}/asset?path=${encodeURIComponent('application-types/operations-management/structure.css')}`
  )
  assert.equal(builtinAsset.status, 403)

  const traversal = await request(
    'GET',
    `/design-system/${PACK_ID}/asset?path=${encodeURIComponent('../pack.json')}`
  )
  assert.equal(traversal.status, 400)

  const builtinDelete = await request('DELETE', `/design-system/${BUILTIN_ID}`)
  assert.equal(builtinDelete.status, 403)
  assert.equal(builtinDelete.data?.code, 'builtin-readonly')
})

test('由已发布 pack 反写草稿（DELETE draft 保留 pack）', async () => {
  const dropped = await request('DELETE', `/design-templates/drafts/${PACK_ID}`)
  assert.equal(dropped.status, 200)
  assert.equal(dropped.data?.packKept, true)

  const recreated = await request('POST', `/design-templates/packs/${PACK_ID}/draft`)
  assert.equal(recreated.status, 200, JSON.stringify(recreated.data))
  assert.equal((recreated.data?.draft as Record<string, unknown>).status, 'published')

  const detail = await request('GET', `/design-templates/drafts/${PACK_ID}`)
  assert.equal(detail.status, 200)
  const spec = detail.data?.spec as Record<string, unknown>
  assert.equal((spec.pages as Array<Record<string, unknown>>)[0].kind, 'reference')

  const missingPack = await request('POST', '/design-templates/packs/no-such/draft')
  assert.equal(missingPack.status, 404)
})

test('删除保护：引用应用 409 + 列表；解除引用后 200（removedDraft）', async () => {
  const now = new Date().toISOString()
  db!
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, requirement_template_id, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, 'requirements', NULL, ?, ?)`
    )
    .run('app-ref', '引用应用', 'app-ref', 18080, now, now)
  db!.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
    'app.app-ref.design.pack',
    JSON.stringify(PACK_ID),
    now
  )

  const list = await request('GET', '/design-system')
  const listed = (list.data?.packs as Array<Record<string, unknown>>).find(item => item.id === PACK_ID)!
  assert.deepEqual(listed.referencedApps, [{ id: 'app-ref', name: '引用应用' }])

  const blocked = await request('DELETE', `/design-system/${PACK_ID}`)
  assert.equal(blocked.status, 409)
  assert.equal(blocked.data?.code, 'pack-referenced')
  const details = blocked.data?.details as { apps: Array<{ id: string; name: string }> }
  assert.equal(details.apps.length, 1)
  assert.equal(details.apps[0].id, 'app-ref')
  assert.equal(details.apps[0].name, '引用应用')

  db!.prepare('DELETE FROM app_settings WHERE key = ?').run('app.app-ref.design.pack')
  const removed = await request('DELETE', `/design-system/${PACK_ID}`)
  assert.equal(removed.status, 200)
  assert.deepEqual(removed.data, { ok: true, removedDraft: true })

  const packs = await request('GET', '/design-system')
  assert.equal((packs.data?.packs as Array<Record<string, unknown>>).some(item => item.id === PACK_ID), false)
})
