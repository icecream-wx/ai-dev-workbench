/**
 * P6-3 设计参考包：PNG 写入接口 / manifest / tokens / artifacts 扩展
 *
 * 使用临时 SQLite + 临时 projects + 本地 Express；不调用模型、不启动 opencode。
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-design-reference-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

let server: Server | null = null
let base = ''
let dbModule: typeof import('../db').db | null = null
let prototypes: typeof import('./prototypes')
const appId = 'ref-app'
const moduleKey = 'MOD-001'
const designDir = path.join(projects, appId, 'docs', 'design', moduleKey)
const designFile = path.join(designDir, 'design.json')
const prototypesDir = path.join(designDir, 'prototypes')
const manifestFile = path.join(prototypesDir, '_manifest.json')
const tokensFile = path.join(designDir, 'tokens.json')
const briefFile = path.join(designDir, 'design-brief.md')

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2xAAAAABJRU5ErkJggg=='

const DESIGN = {
  module: moduleKey,
  title: '商品管理',
  entities: [
    {
      id: 'product',
      name: '商品',
      table: 'biz_product',
      fields: [{ name: '商品编码', type: 'string', required: true }]
    }
  ],
  relations: [],
  pages: [
    { id: 'product-list', name: '商品列表', type: 'list', entity: 'product', columns: ['商品编码'] },
    { id: 'product-form', name: '商品编辑', type: 'form', entity: 'product' }
  ]
}

function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function writeDesign(content = DESIGN): string {
  fs.mkdirSync(designDir, { recursive: true })
  const text = `${JSON.stringify(content, null, 2)}\n`
  fs.writeFileSync(designFile, text, 'utf8')
  return hashOf(fs.readFileSync(designFile))
}

function cleanReference(): void {
  fs.rmSync(prototypesDir, { recursive: true, force: true })
  fs.rmSync(tokensFile, { force: true })
  fs.rmSync(briefFile, { force: true })
}

async function request(method: string, apiPath: string, body?: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(`${base}/api${apiPath}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

function payload(designHash: string, pages = [{ id: 'product-list', dataUrl: PNG_1X1 }]) {
  return { designHash, styleId: 'platform-blue', pages }
}

before(async () => {
  dbModule = (await import('../db')).db
  prototypes = await import('./prototypes')
  const express = (await import('express')).default
  const { apps, appsErrorHandler } = await import('../apps/routes')
  const app = express()
  app.use(express.json({ limit: '64mb' }))
  app.use('/api/apps', apps)
  app.use('/api/apps', appsErrorHandler)
  server = app.listen(0)
  await new Promise<void>(resolve => server?.once('listening', () => resolve()))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const created = await request('POST', '/apps', { id: appId, name: '设计参考应用' })
  assert.equal(created.status, 201)
})

after(async () => {
  server?.close()
  dbModule?.close()
  fs.rmSync(root, { recursive: true, force: true })
})

test('写入 PNG + manifest + tokens；artifacts 返回 prototypes/brief/tokens', async () => {
  cleanReference()
  const designHash = writeDesign()
  const result = await request('POST', `/apps/${appId}/design/${moduleKey}/prototypes`, payload(designHash))
  assert.equal(result.status, 200, JSON.stringify(result.data))
  assert.equal(result.data?.ok, true)
  const manifest = result.data?.manifest as {
    designHash: string
    styleId: string
    exportedAt: string
    pages: Record<string, { file: string; hash: string }>
  }
  assert.equal(manifest.designHash, designHash)
  assert.equal(manifest.styleId, 'platform-blue')
  assert.ok(manifest.exportedAt)
  assert.ok(manifest.pages['product-list'])
  assert.equal(manifest.pages['product-list'].file, 'product-list.png')
  assert.match(manifest.pages['product-list'].hash, /^[a-f0-9]{64}$/)
  assert.ok(fs.existsSync(path.join(prototypesDir, 'product-list.png')))
  assert.ok(fs.existsSync(manifestFile))

  const tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8')) as {
    styleId: string
    name: string
    tokens: Record<string, unknown>
  }
  assert.equal(tokens.styleId, 'platform-blue')
  assert.ok(tokens.name)
  assert.ok(tokens.tokens.primary)
  assert.equal('shell' in tokens, false, 'tokens.json 不应再有 shell')

  const artifacts = await request('GET', `/apps/${appId}/artifacts`)
  assert.equal(artifacts.status, 200)
  const design = (artifacts.data?.designs as Array<Record<string, unknown>>).find(item => item.module === moduleKey)
  assert.ok(design)
  const proto = design?.prototypes as { designHash: string; stale: boolean; pages: Array<{ id: string; file: string }> }
  assert.equal(proto.designHash, designHash)
  assert.equal(proto.stale, false)
  assert.equal(proto.pages.length, 1)
  assert.equal(proto.pages[0].file, `docs/design/${moduleKey}/prototypes/product-list.png`)
  assert.deepEqual(design?.brief, { exists: false, file: `docs/design/${moduleKey}/design-brief.md` })
  assert.deepEqual(design?.tokens, { exists: true, styleId: 'platform-blue' })

  fs.writeFileSync(briefFile, '# 设计参考\n\n- 概览：商品管理\n', 'utf8')
  const withBrief = await request('GET', `/apps/${appId}/artifacts`)
  const designAgain = (withBrief.data?.designs as Array<Record<string, unknown>>).find(item => item.module === moduleKey)
  assert.deepEqual(designAgain?.brief, { exists: true, file: `docs/design/${moduleKey}/design-brief.md` })
})

test('designHash 不匹配 → 409 且不写 manifest', async () => {
  cleanReference()
  writeDesign()
  const result = await request('POST', `/apps/${appId}/design/${moduleKey}/prototypes`, payload('0'.repeat(64)))
  assert.equal(result.status, 409)
  assert.match(String(result.data?.error ?? ''), /designHash/)
  assert.equal(fs.existsSync(manifestFile), false)
  assert.equal(fs.existsSync(tokensFile), false)
})

test('非法 page id / PNG 魔数 / 风格 / 模块 → 4xx', async () => {
  cleanReference()
  const designHash = writeDesign()

  const badId = await request(
    'POST',
    `/apps/${appId}/design/${moduleKey}/prototypes`,
    payload(designHash, [{ id: '../evil', dataUrl: PNG_1X1 }])
  )
  assert.equal(badId.status, 400)
  assert.match(String(badId.data?.error ?? ''), /页面 id/)

  const badMagic = await request(
    'POST',
    `/apps/${appId}/design/${moduleKey}/prototypes`,
    payload(designHash, [{ id: 'product-list', dataUrl: 'data:image/png;base64,AAAA' }])
  )
  assert.equal(badMagic.status, 400)
  assert.match(String(badMagic.data?.error ?? ''), /魔数/)

  const badStyle = await request('POST', `/apps/${appId}/design/${moduleKey}/prototypes`, {
    designHash,
    styleId: 'missing-style',
    pages: [{ id: 'product-list', dataUrl: PNG_1X1 }]
  })
  assert.equal(badStyle.status, 400)
  assert.match(String(badStyle.data?.error ?? ''), /视觉风格不存在/)

  const duplicate = await request(
    'POST',
    `/apps/${appId}/design/${moduleKey}/prototypes`,
    payload(designHash, [
      { id: 'product-list', dataUrl: PNG_1X1 },
      { id: 'product-list', dataUrl: PNG_1X1 }
    ])
  )
  assert.equal(duplicate.status, 400)

  const empty = await request('POST', `/apps/${appId}/design/${moduleKey}/prototypes`, payload(designHash, []))
  assert.equal(empty.status, 400)

  const badModule = await request('POST', `/apps/${appId}/design/MOD-1/prototypes`, payload(designHash))
  assert.equal(badModule.status, 400)

  const missingModule = await request('POST', `/apps/${appId}/design/MOD-999/prototypes`, payload(designHash))
  assert.equal(missingModule.status, 404)

  assert.equal(fs.existsSync(manifestFile), false)
  assert.equal(fs.existsSync(tokensFile), false)
})

test('超限：单页 PNG > 5MB → 400', () => {
  const oversized = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(5 * 1024 * 1024)
  ])
  assert.throws(
    () => prototypes.decodePngDataUrl(`data:image/png;base64,${oversized.toString('base64')}`),
    (error: Error & { status?: number }) => error.status === 400 && /上限/.test(error.message)
  )
})

test('删除不再存在的旧 PNG（manifest + 目录残留）', async () => {
  cleanReference()
  const designHash = writeDesign()
  const first = await request(
    'POST',
    `/apps/${appId}/design/${moduleKey}/prototypes`,
    payload(designHash, [
      { id: 'product-list', dataUrl: PNG_1X1 },
      { id: 'product-form', dataUrl: PNG_1X1 }
    ])
  )
  assert.equal(first.status, 200)
  assert.ok(fs.existsSync(path.join(prototypesDir, 'product-form.png')))
  fs.writeFileSync(path.join(prototypesDir, 'stray.png'), Buffer.from('stray'), 'utf8')

  const second = await request(
    'POST',
    `/apps/${appId}/design/${moduleKey}/prototypes`,
    payload(designHash, [{ id: 'product-list', dataUrl: PNG_1X1 }])
  )
  assert.equal(second.status, 200)
  assert.equal(fs.existsSync(path.join(prototypesDir, 'product-form.png')), false)
  assert.equal(fs.existsSync(path.join(prototypesDir, 'stray.png')), false)
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as { pages: Record<string, unknown> }
  assert.deepEqual(Object.keys(manifest.pages), ['product-list'])
})

test('design.json 变化 → artifacts.stale=true', async () => {
  cleanReference()
  writeDesign()
  const designHash = hashOf(fs.readFileSync(designFile))
  const result = await request('POST', `/apps/${appId}/design/${moduleKey}/prototypes`, payload(designHash))
  assert.equal(result.status, 200)

  const before = await request('GET', `/apps/${appId}/artifacts`)
  const first = (before.data?.designs as Array<Record<string, unknown>>).find(item => item.module === moduleKey)
  assert.equal((first?.prototypes as { stale: boolean }).stale, false)

  fs.appendFileSync(designFile, '\n', 'utf8')
  const changed = await request('GET', `/apps/${appId}/artifacts`)
  const second = (changed.data?.designs as Array<Record<string, unknown>>).find(item => item.module === moduleKey)
  const proto = second?.prototypes as { stale: boolean; designHash: string }
  assert.equal(proto.stale, true)
  assert.equal(proto.designHash, designHash)
})
