/**
 * ChatTarget 抽象（P7-7b-1）：handleAppChat 等价包装 + 工作室式目标 + 模型 stage 隔离。
 * 临时目录 + opencode 内存 stub；不启动 serve、不调模型。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before, beforeEach } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-chat-target-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

let service: typeof import('./service')
let db: typeof import('../db').db
let store: typeof import('../sessions/store')

interface RuntimeState {
  sessions: Array<{ id: string; directory: string; title?: string; agent?: string }>
  prompts: Array<{ sessionID: string; text: string }>
  listener: ((event: { type: string; data?: Record<string, unknown> }) => void) | null
}

const runtime: RuntimeState = { sessions: [], prompts: [], listener: null }

before(async () => {
  db = (await import('../db')).db
  store = await import('../sessions/store')
  service = await import('./service')
})

after(() => {
  db?.close()
  fs.rmSync(root, { recursive: true, force: true })
})

async function stubRuntime(): Promise<void> {
  const runtimeModule = await import('../opencode/runtime')
  const rt = runtimeModule.opencode as unknown as Record<string, unknown>
  rt.lastUsedModel = async () => null
  rt.defaultModel = async () => null
  rt.session = async (id: string) => {
    const found = runtime.sessions.find(session => session.id === id)
    return found ? { id, title: found.title } : null
  }
  rt.createSession = async (input: { directory: string; title?: string; agent?: string }) => {
    const created = { id: `oc-${runtime.sessions.length + 1}`, ...input }
    runtime.sessions.push(created)
    return created
  }
  rt.track = () => undefined
  rt.subscribe = (_filter: unknown, callback: RuntimeState['listener']) => {
    runtime.listener = callback
    return () => {
      runtime.listener = null
    }
  }
  rt.prompt = async (sessionID: string, text: string) => {
    runtime.prompts.push({ sessionID, text })
    runtime.listener?.({ type: 'session.text.delta', data: { delta: 'ok' } })
    runtime.listener?.({ type: 'session.text.ended', data: { text: 'ok' } })
    runtime.listener?.({ type: 'session.execution.succeeded', data: {} })
  }
  rt.runCommand = async (_sessionID: string, _name: string, _text: string) => undefined
  rt.interrupt = async () => undefined
}

interface FakeRes {
  statusCode: number
  writableEnded: boolean
  headers: Record<string, string>
  frames: Array<Record<string, unknown>>
  listeners: Record<string, Array<() => void>>
  status: (code: number) => FakeRes
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
  flushHeaders: () => void
  write: (chunk: string) => boolean
  end: () => void
  on: (name: string, handler: () => void) => void
  removeListener: (name: string, handler: () => void) => void
  jsonBody?: unknown
}

function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 0,
    writableEnded: false,
    headers: {},
    frames: [],
    listeners: {},
    status(code) {
      res.statusCode = code
      return res
    },
    json(body) {
      res.jsonBody = body
      res.writableEnded = true
    },
    setHeader(name, value) {
      res.headers[name] = value
    },
    flushHeaders() {},
    write(chunk) {
      const text = String(chunk).trim()
      if (text.startsWith('data: ')) res.frames.push(JSON.parse(text.slice(6)) as Record<string, unknown>)
      return true
    },
    end() {
      res.writableEnded = true
    },
    on(name, handler) {
      const list = res.listeners[name] ?? []
      list.push(handler)
      res.listeners[name] = list
    },
    removeListener(name, handler) {
      res.listeners[name] = (res.listeners[name] ?? []).filter(item => item !== handler)
    }
  }
  return res
}

function seedApp(id: string): void {
  const now = new Date().toISOString()
  db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  db.prepare(
    `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 8093, 'requirements', ?, ?)`
  ).run(id, `应用 ${id}`, id, now, now)
  fs.mkdirSync(path.join(projects, id), { recursive: true })
}

beforeEach(async () => {
  runtime.sessions = []
  runtime.prompts = []
  runtime.listener = null
  db.prepare('DELETE FROM app_sessions').run()
  db.prepare('DELETE FROM apps').run()
  await stubRuntime()
})

test('isModelStage 仍拒绝 template（工作室 stage 不走应用 model 路由）', () => {
  assert.equal(service.isModelStage('requirements'), true)
  assert.equal(service.isModelStage('template'), false)
})

test('handleChat(appChatTarget)：与 handleAppChat 的视图/prompt 完全等价（无 module）', async () => {
  seedApp('target-a')
  seedApp('target-b')
  const viaWrapper = fakeRes()
  await service.handleAppChat(
    { id: 'target-a', name: '包装应用' },
    { body: { view: 'requirements', text: '写需求' } } as never,
    viaWrapper as never
  )
  const viaTarget = fakeRes()
  await service.handleChat(
    service.appChatTarget({ id: 'target-b', name: '包装应用' }, 'requirements'),
    { body: { view: 'requirements', text: '写需求' } } as never,
    viaTarget as never
  )
  const first = viaWrapper.frames[0] as Record<string, unknown>
  const second = viaTarget.frames[0] as Record<string, unknown>
  for (const key of ['type', 'view', 'command', 'agent', 'model']) {
    assert.deepEqual(second[key], first[key], key)
  }
  assert.equal('module' in first, false, '应用会话 meta 不再有 module')
  assert.equal(first.appId, 'target-a')
  assert.equal(second.appId, 'target-b')
  assert.equal(runtime.prompts[0].text, runtime.prompts[1].text)
  assert.match(runtime.prompts[1].text, /adw-requirements-document/)
  assert.match(runtime.prompts[1].text, /docs\/requirements\/requirements\.md/)

  const rows = db.prepare('SELECT view FROM app_sessions WHERE app_id = ?').all('target-b') as Array<{ view: string }>
  assert.deepEqual(rows.map(row => row.view), ['requirements'])
})

test('handleChat(工作室式 target)：template 视图、目标 prompt、独立会话 + 复用', async () => {
  seedApp('unused')
  const studio = path.join(root, 'studio')
  fs.mkdirSync(studio, { recursive: true })
  let prepared = 0
  const target: import('./service').ChatTarget = {
    id: '__template__:demo-pack',
    name: '演示模板',
    directory: studio,
    view: 'template',
    sessionTitle: () => '演示模板 · 模板工作室',
    beforeSession: () => {
      prepared += 1
      return { warnings: [] }
    },
    expectedSkills: () => ['adw-design-template-authoring'],
    expectedCommands: () => ['generate-design-template'],
    buildPrompt: (text) => `工作室框架\n用户消息：\n${text}`
  }

  const first = fakeRes()
  await service.handleChat(target, { body: { text: '做一个供应商模板' } } as never, first as never)
  const meta = first.frames[0] as Record<string, unknown>
  assert.equal(meta.type, 'meta')
  assert.equal(meta.view, 'template')
  assert.equal(meta.appId, '__template__:demo-pack')
  assert.equal('module' in meta, false, '工作室/应用都不再有 module 语义')
  assert.equal(prepared, 1, '每轮 beforeSession 一次')
  assert.match(runtime.prompts[0].text, /工作室框架/)
  assert.match(runtime.prompts[0].text, /做一个供应商模板/)
  assert.equal(runtime.sessions[0].title, '演示模板 · 模板工作室')

  const rows = db.prepare('SELECT app_id, view, title FROM app_sessions WHERE app_id = ?').all('__template__:demo-pack') as Array<{
    app_id: string
    view: string
    title: string
  }>
  assert.deepEqual(rows, [{ app_id: '__template__:demo-pack', view: 'template', title: '演示模板 · 模板工作室' }])

  const second = fakeRes()
  await service.handleChat(target, { body: { text: '继续' } } as never, second as never)
  assert.equal(runtime.sessions.length, 1, 'template 同名活跃会话复用')
  assert.equal((second.frames[0] as Record<string, unknown>).sessionID, 'oc-1')
  assert.equal(prepared, 2, '第二轮 beforeSession 再执行一次')
  assert.equal(store.viewOf(store.listSessionRows('__template__:demo-pack', 'template')[0]), 'template')
})

test('模型 stage：template 独立键且不继承应用三视图；应用视图仍继承', async () => {
  const appId = 'model-app'
  const templateId = '__template__:model-pack'
  service.saveStoredModel(appId, 'requirements', { providerID: 'p', id: 'app-model' })
  assert.deepEqual(await service.resolveChatModel(appId, 'design', path.join(projects, appId)), { providerID: 'p', id: 'app-model' })

  // 同一合成 id 下也放了应用模型：template 不能继承
  service.saveStoredModel(templateId, 'requirements', { providerID: 'p', id: 'app-model' })
  assert.equal(await service.resolveChatModel(templateId, 'template', root), null, 'template 不回退应用模型')
  assert.equal(service.storedModel(templateId, 'template'), null)

  service.saveStoredModel(templateId, 'template', { providerID: 'p', id: 'template-model' })
  assert.deepEqual(service.storedModel(templateId, 'template'), { providerID: 'p', id: 'template-model' })
  assert.deepEqual(await service.resolveChatModel(templateId, 'template', root), { providerID: 'p', id: 'template-model' })

  const keys = db
    .prepare('SELECT key FROM app_settings WHERE key LIKE ? ORDER BY key')
    .all(`app.${templateId}.model.%`) as Array<{ key: string }>
  assert.deepEqual(
    keys.map(row => row.key),
    [`app.${templateId}.model.requirements`, `app.${templateId}.model.template`]
  )

  service.saveStoredModel(templateId, 'template', null)
  assert.equal(service.storedModel(templateId, 'template'), null)
})
