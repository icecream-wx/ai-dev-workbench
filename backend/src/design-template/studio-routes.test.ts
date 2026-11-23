/**
 * 工作室 API（P7-7b-1）：`/api/design-templates/drafts/:id/studio/*`
 * 临时目录/端口 + opencode 内存 stub；不启动 serve、不调模型。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-studio-routes-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_AUTO_START = 'false'

const PACK_ID = 'studio-routes-demo'

interface ApiResult {
  status: number
  data: Record<string, unknown> | null
  text: string
}

let server: Server | null = null
let base = ''
let db: typeof import('../db').db

interface RuntimeState {
  sessions: Array<{ id: string; title?: string }>
  prompts: Array<{ sessionID: string; text: string }>
  commands: Array<{ sessionID: string; name: string; text: string }>
}

const runtime: RuntimeState = { sessions: [], prompts: [], commands: [] }

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
  return { status: response.status, data, text }
}

async function stubRuntime(): Promise<void> {
  const runtimeModule = await import('../opencode/runtime')
  const rt = runtimeModule.opencode as unknown as Record<string, unknown>
  rt.status = () => ({ ready: false, starting: false })
  rt.ensureStarted = async () => undefined
  rt.listAgents = async () => []
  rt.defaultModel = async () => null
  rt.lastUsedModel = async () => null
  rt.createSession = async (input: { title?: string }) => {
    const created = { id: `oc-${runtime.sessions.length + 1}`, title: input.title }
    runtime.sessions.push(created)
    return created
  }
  rt.session = async (id: string) => (runtime.sessions.some(session => session.id === id) ? { id, title: id } : null)
  rt.messages = async () => ({ data: [] })
  rt.refreshPending = async () => undefined
  rt.pendingFor = () => ({ permissions: [], forms: [] })
  rt.prompt = async (sessionID: string, text: string) => {
    runtime.prompts.push({ sessionID, text })
  }
  rt.runCommand = async (sessionID: string, name: string, text: string) => {
    runtime.commands.push({ sessionID, name, text })
  }
  rt.interrupt = async () => undefined
  rt.compactSession = async () => undefined
  rt.replyPermission = async () => undefined
  rt.replyForm = async () => undefined
  rt.listSessions = async () => runtime.sessions
  rt.listModels = async () => [{ providerID: 'demo', modelID: 'model-a', id: 'model-a', name: 'Model A', variants: [] }]
  rt.track = () => undefined
  rt.subscribe = () => () => undefined
}

before(async () => {
  db = (await import('../db')).db
  const express = (await import('express')).default
  const { designTemplateRoutes, designTemplateErrorHandler } = await import('./routes')
  const { apps, appsErrorHandler } = await import('../apps/routes')
  await stubRuntime()

  const app = express()
  app.use(express.json({ limit: '16mb' }))
  app.use('/api/apps', apps)
  app.use('/api/apps', appsErrorHandler)
  app.use('/api/design-templates', designTemplateRoutes)
  app.use('/api/design-templates', designTemplateErrorHandler)

  server = app.listen(0)
  await new Promise<void>(resolve => server?.once('listening', () => resolve()))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  const now = new Date().toISOString()
  db.prepare('DELETE FROM apps WHERE id = ?').run('model-app')
  db.prepare(
    `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 18080, 'development', ?, ?)`
  ).run('model-app', '模型应用', 'model-app', now, now)
  fs.mkdirSync(path.join(root, 'projects', 'model-app'), { recursive: true })
})

after(() => {
  server?.close()
  db?.close()
  fs.rmSync(root, { recursive: true, force: true })
})

test('GET /studio：草稿 + spec/validation + 空会话；404 草稿/非法 id；sessionId 类型 400', async () => {
  const created = await request('POST', '/design-templates/drafts', {
    name: '工作室路由模板',
    id: PACK_ID,
    style: 'data-cyan'
  })
  assert.equal(created.status, 201)

  const state = await request('GET', `/design-templates/drafts/${PACK_ID}/studio`)
  assert.equal(state.status, 200, state.text)
  assert.equal(state.data?.view, 'template')
  assert.equal((state.data?.draft as Record<string, unknown>).id, PACK_ID)
  assert.equal(state.data?.session, null)
  assert.equal(state.data?.state, null)
  assert.equal(Array.isArray(state.data?.sessions), true)
  assert.equal((state.data?.sessions as unknown[]).length, 0)
  assert.equal(state.data?.readOnly, false)
  assert.match(String(state.data?.defaultPrompt), new RegExp(PACK_ID))
  assert.equal('pages' in ((state.data?.spec as Record<string, unknown>) ?? {}), true)
  assert.equal((state.data?.validation as Record<string, unknown>).ok, false, 'starter spec 空 pages')

  const missing = await request('GET', '/design-templates/drafts/no-such/studio')
  assert.equal(missing.status, 404)
  const bad = await request('GET', '/design-templates/drafts/Bad%20Id/studio')
  assert.equal(bad.status, 400)
  const badQuery = await request('GET', `/design-templates/drafts/${PACK_ID}/studio?sessionId=a&sessionId=b`)
  assert.equal(badQuery.status, 400)
  const badSession = await request('GET', `/design-templates/drafts/${PACK_ID}/studio?sessionId=missing`)
  assert.equal(badSession.status, 404)
})

test('session 生命周期：新建/列表/改名/切换/归档；无活跃 409', async () => {
  const beforeCreate = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/prompt`, { text: 'hi' })
  assert.equal(beforeCreate.status, 409)

  const created = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/session`, { new: true })
  assert.equal(created.status, 200, created.text)
  assert.equal((created.data?.session as Record<string, unknown>).view, 'template')
  assert.equal((created.data?.session as Record<string, unknown>).title, '工作室路由模板 · 模板工作室')
  const sid = (created.data?.session as Record<string, unknown>).id as string

  const listed = await request('GET', `/design-templates/drafts/${PACK_ID}/studio/sessions`)
  assert.equal(listed.status, 200)
  assert.equal(listed.data?.view, 'template')
  assert.equal((listed.data?.sessions as unknown[]).length, 1)

  const renamed = await request('PATCH', `/design-templates/drafts/${PACK_ID}/studio/sessions/${sid}`, {
    title: '改过的标题',
    note: '备注'
  })
  assert.equal(renamed.status, 200)
  assert.equal((renamed.data as Record<string, unknown>).title, '改过的标题')
  assert.equal((renamed.data as Record<string, unknown>).note, '备注')
  const badPatch = await request('PATCH', `/design-templates/drafts/${PACK_ID}/studio/sessions/${sid}`, { title: 1 })
  assert.equal(badPatch.status, 400)
  const emptyPatch = await request('PATCH', `/design-templates/drafts/${PACK_ID}/studio/sessions/${sid}`, {})
  assert.equal(emptyPatch.status, 400)

  const activated = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/sessions/${sid}/activate`)
  assert.equal(activated.status, 200)
  assert.equal((activated.data?.session as Record<string, unknown>).id, sid)

  const archived = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/sessions/${sid}/archive`)
  assert.deepEqual(archived.data, { ok: true, sessionId: sid, status: 'archived' })
  const missing = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/sessions/missing/activate`)
  assert.equal(missing.status, 404)
})

test('prompt/command/interrupt/compact/permission/form：200 与 4xx', async () => {
  const created = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/session`, { new: true })
  assert.equal(created.status, 200)

  const badPrompt = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/prompt`, { text: 1 })
  assert.equal(badPrompt.status, 400)
  const prompt = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/prompt`, { text: '做页面' })
  assert.equal(prompt.status, 200, prompt.text)
  assert.equal(prompt.data?.ok, true)
  assert.match(runtime.prompts[0].text, /当前工作室：设计模板编写/)
  assert.match(runtime.prompts[0].text, /用户消息：\n做页面/)

  const command = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/prompt`, {
    text: PACK_ID,
    command: 'generate-design-template'
  })
  assert.equal(command.status, 200)
  assert.equal(command.data?.command, 'generate-design-template')
  assert.equal(runtime.commands[0].name, 'generate-design-template')

  const interrupt = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/interrupt`)
  assert.deepEqual(interrupt.data, { ok: true })
  const compact = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/compact`)
  assert.equal(compact.status, 200)
  assert.match(String(compact.data?.message), /压缩/)

  const badDecision = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/permission/r1/reply`, {
    decision: 'nope'
  })
  assert.equal(badDecision.status, 400)
  const permission = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/permission/r1/reply`, {
    decision: 'once'
  })
  assert.deepEqual(permission.data, { ok: true })
  const form = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/form/f1/reply`, { answer: { a: 1 } })
  assert.deepEqual(form.data, { ok: true })
})

test('model：stage=template 独立读写；应用 model 路由不接受 template', async () => {
  const initial = await request('GET', `/design-templates/drafts/${PACK_ID}/studio/model`)
  assert.equal(initial.status, 200)
  assert.equal(initial.data?.stage, 'template')
  assert.equal(initial.data?.agent, 'build')
  assert.equal(initial.data?.model, null)

  const missingBody = await request('PUT', `/design-templates/drafts/${PACK_ID}/studio/model`, {})
  assert.equal(missingBody.status, 400)
  const badModel = await request('PUT', `/design-templates/drafts/${PACK_ID}/studio/model`, {
    model: { providerID: 'demo' }
  })
  assert.equal(badModel.status, 400)

  const saved = await request('PUT', `/design-templates/drafts/${PACK_ID}/studio/model`, {
    model: { providerID: 'demo', id: 'model-a' }
  })
  assert.equal(saved.status, 200, saved.text)
  assert.deepEqual(saved.data, { ok: true, stage: 'template', model: { providerID: 'demo', id: 'model-a' } })
  const reload = await request('GET', `/design-templates/drafts/${PACK_ID}/studio/model`)
  assert.deepEqual((reload.data as Record<string, unknown>).model, { providerID: 'demo', id: 'model-a' })

  // 应用 model 路由：stage=template 不在三视图内 → 回退 requirements（拒绝 template）
  const appModel = await request('GET', '/apps/model-app/model?stage=template')
  assert.equal(appModel.status, 200)
  assert.equal(appModel.data?.stage, 'requirements')
  const appPut = await request('PUT', '/apps/model-app/model', { stage: 'template', model: null })
  assert.equal(appPut.status, 200)
  assert.equal(appPut.data?.stage, 'requirements')
  const keys = db.prepare('SELECT key FROM app_settings WHERE key LIKE ? ORDER BY key').all('app.__template__:%') as Array<{
    key: string
  }>
  assert.deepEqual(
    keys.map(row => row.key),
    [`app.__template__:${PACK_ID}.model.template`]
  )

  const cleared = await request('PUT', `/design-templates/drafts/${PACK_ID}/studio/model`, { model: null })
  assert.deepEqual(cleared.data, { ok: true, stage: 'template', model: null })
})

test('events：无活跃会话 409；有活跃会话 → hello（SSE），带 template/draftId', async () => {
  // 先归档全部会话
  const listed = await request('GET', `/design-templates/drafts/${PACK_ID}/studio/sessions`)
  for (const item of (listed.data?.sessions as Array<{ id: string }>) ?? []) {
    await request('POST', `/design-templates/drafts/${PACK_ID}/studio/sessions/${item.id}/archive`)
  }
  const empty = await request('GET', `/design-templates/drafts/${PACK_ID}/studio/events`)
  assert.equal(empty.status, 409)

  const created = await request('POST', `/design-templates/drafts/${PACK_ID}/studio/session`, { new: true })
  assert.equal(created.status, 200)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(`${base}/api/design-templates/drafts/${PACK_ID}/studio/events`, {
      signal: controller.signal
    })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/)
    const reader = response.body!.getReader()
    const { value } = await reader.read()
    const chunk = new TextDecoder().decode(value)
    const line = chunk.split('\n').find(item => item.startsWith('data: ')) ?? ''
    const frame = JSON.parse(line.slice(6)) as Record<string, unknown>
    assert.equal(frame.type, 'hello')
    assert.equal(frame.view, 'template')
    assert.equal(frame.draftId, PACK_ID)
    assert.equal(typeof frame.sessionID, 'string')
    await reader.cancel().catch(() => undefined)
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
})

test('404：未知草稿的各类工作室接口', async () => {
  for (const [method, apiPath] of [
    ['GET', '/design-templates/drafts/no-such/studio/sessions'],
    ['POST', '/design-templates/drafts/no-such/studio/session'],
    ['POST', '/design-templates/drafts/no-such/studio/prompt'],
    ['POST', '/design-templates/drafts/no-such/studio/interrupt'],
    ['POST', '/design-templates/drafts/no-such/studio/compact'],
    ['GET', '/design-templates/drafts/no-such/studio/model']
  ] as const) {
    const body = method !== 'POST' ? undefined : apiPath.endsWith('/prompt') ? { text: 'x' } : {}
    const result = await request(method, apiPath, body)
    assert.equal(result.status, 404, `${method} ${apiPath}`)
  }
})
