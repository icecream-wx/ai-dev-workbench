/**
 * 需求文档路由守卫（R2a / R4b-2）
 *
 * 用真实 Express 挂载 requirementDocRoutes：
 * - 应用不存在 → 404（doc 端点与 doc 对话都不创建文档行）；
 * - 使用中的私有模板禁止删除，内置仍只读。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-reqdoc-routes-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')

let server: Server | null = null
let base = ''
let db: typeof import('../db').db

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

before(async () => {
  const express = (await import('express')).default
  db = (await import('../db')).db
  const { requirementDocRoutes, requirementTemplateRoutes, requirementErrorHandler } = await import('./routes')
  const { handleAppChat } = await import('../chat/service')

  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
    VALUES ('doc-app', '文档应用', '文档模式', 'doc-app', 8081, 'requirements', ?, ?)
  `).run(now, now)

  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/apps/:id/requirements-doc', requirementDocRoutes)
  app.post('/api/apps/:id/chat', (req, res, next) => {
    handleAppChat({ id: String(req.params.id), name: '路由测试' }, req, res).catch(next)
  })
  app.use('/api/requirement-templates', requirementTemplateRoutes)
  app.use(requirementErrorHandler)

  server = app.listen(0)
  await new Promise<void>(resolve => server?.once('listening', () => resolve()))
  const address = server.address() as AddressInfo
  base = `http://127.0.0.1:${address.port}`
})

after(() => {
  server?.close()
  try {
    db?.close()
  } catch {
    // 已关闭
  }
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // Windows 上 SQLite 句柄释放可能滞后
  }
})

function docRowCount(appId: string): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM app_requirement_docs WHERE app_id = ?').get(appId) as { count: number }
  return row.count
}

test('应用不存在时 doc 端点返回 404', async () => {
  const result = await request('GET', '/apps/missing-app/requirements-doc')
  assert.equal(result.status, 404)
})

test('doc 应用可正常初始化文档', async () => {
  const result = await request('GET', '/apps/doc-app/requirements-doc')
  assert.equal(result.status, 200)
  const doc = result.data?.doc as { version: number; status: string }
  assert.equal(doc.version, 1)
  assert.equal(doc.status, 'draft')
  assert.equal(docRowCount('doc-app'), 1)
})

test('模板删除保护：使用中的私有模板 400，未使用可删，内置仍只读', async () => {
  const created = await request('POST', '/requirement-templates', {
    name: '使用中模板',
    stage: 'requirements',
    category: '测试',
    prompt: '测试模板提示词',
    sections: [{ id: 'problem', title: '问题与机会', level: 2, kind: 'markdown', guidance: '', required: true }]
  })
  assert.equal(created.status, 201)
  const inUseId = (created.data?.template as { id: string }).id

  const switched = await request('PUT', '/apps/doc-app/requirements-doc/template', { templateId: inUseId })
  assert.equal(switched.status, 200)

  const blocked = await request('DELETE', `/requirement-templates/${inUseId}`)
  assert.equal(blocked.status, 400)
  assert.match(String(blocked.data?.error ?? ''), /正在被 1 个应用使用/)

  const unused = await request('POST', '/requirement-templates', {
    name: '未使用模板',
    stage: 'requirements',
    category: '测试',
    prompt: '测试模板提示词',
    sections: [{ id: 'problem', title: '问题与机会', level: 2, kind: 'markdown', guidance: '', required: true }]
  })
  const unusedId = (unused.data?.template as { id: string }).id
  const removed = await request('DELETE', `/requirement-templates/${unusedId}`)
  assert.equal(removed.status, 200)

  const builtin = await request('DELETE', '/requirement-templates/builtin-prd')
  assert.equal(builtin.status, 400)
  assert.match(String(builtin.data?.error ?? ''), /只读/)
})

test('文档模式应用可预览 AI 建议且不产版本，可应用选中章节', async () => {
  const before = await request('GET', '/apps/doc-app/requirements-doc')
  const versionBefore = (before.data?.doc as { version: number }).version

  const preview = await request('POST', '/apps/doc-app/requirements-doc/preview', {
    title: '建议标题',
    sections: [{ id: 'problem', markdown: '预览中的问题' }]
  })
  assert.equal(preview.status, 200)
  const previewSections = preview.data?.sections as Array<{ sectionKey: string; change: string }>
  assert.equal(previewSections.find(section => section.sectionKey === 'problem')?.change, 'modified')
  assert.equal((preview.data as { baseVersion: number }).baseVersion, versionBefore)

  const afterPreview = await request('GET', '/apps/doc-app/requirements-doc')
  assert.equal((afterPreview.data?.doc as { version: number }).version, versionBefore)

  const applied = await request('PUT', '/apps/doc-app/requirements-doc', {
    title: '建议标题',
    sections: [{ id: 'problem', markdown: '预览中的问题' }],
    source: 'ai'
  })
  assert.equal(applied.status, 200)
  assert.equal((applied.data?.doc as { version: number }).version, versionBefore + 1)
  assert.equal((applied.data?.doc as { title: string }).title, '建议标题')
  const sections = applied.data?.sections as Array<{ sectionKey: string; required: boolean }>
  assert.equal(sections.filter(section => section.required).length, 1)
  assert.equal(docRowCount('doc-app'), 1)
})

test('手动保存版本：POST /versions 快照当前内容（source=manual），自动保存不产版本', async () => {
  const before = await request('GET', '/apps/doc-app/requirements-doc')
  const versionBefore = (before.data?.doc as { version: number }).version
  // 自动保存（章节 PUT）不应产版本
  await request('PUT', '/apps/doc-app/requirements-doc/sections/problem', { markdown: '自动保存内容' })
  const afterAuto = await request('GET', '/apps/doc-app/requirements-doc')
  assert.equal((afterAuto.data?.doc as { version: number }).version, versionBefore)

  const manual = await request('POST', '/apps/doc-app/requirements-doc/versions')
  assert.equal(manual.status, 200)
  assert.equal((manual.data?.doc as { version: number }).version, versionBefore + 1)
  assert.match(String((manual.data?.doc as { contentMd: string }).contentMd), /自动保存内容/)

  const list = await request('GET', '/apps/doc-app/requirements-doc/versions')
  const versions = list.data?.versions as Array<{ version: number; source: string; changeSetSeq: number | null }>
  assert.equal(versions[0].version, versionBefore + 1)
  assert.equal(versions[0].source, 'manual')
  assert.equal(versions[0].changeSetSeq, null)
})

test('RMP-1 规划聊天守卫：不满足首次条件时 mode=doc-plan 返回 409 且不调模型', async () => {
  // 没有任何模块的 requirements 应用 → 不是“恰好 1 个空默认模块”
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
    VALUES ('plan-blocked', '规划应用', NULL, 'plan-blocked', 8081, 'requirements', ?, ?)
  `).run(now, now)

  const noModule = await request('POST', '/apps/plan-blocked/chat', {
    stage: 'requirements',
    mode: 'doc-plan',
    messages: [{ role: 'user', content: '做一个订单系统' }]
  })
  assert.equal(noModule.status, 409)
  assert.match(String(noModule.data?.error), /未归档模块|首次模块规划/)

  db.prepare(`UPDATE apps SET status = 'design' WHERE id = 'plan-blocked'`).run()
  const designStage = await request('POST', '/apps/plan-blocked/chat', {
    stage: 'requirements',
    mode: 'doc-plan',
    messages: [{ role: 'user', content: '做一个订单系统' }]
  })
  assert.equal(designStage.status, 409)
  assert.match(String(designStage.data?.error), /设计阶段|当前阶段/)
})
