/**
 * 对话服务纯函数单测。
 *
 * 注意：`./service` 会在模块初始化时 import `../db`（为了设置/模型存储）。
 * 这里必须在 import 之前把 RG_DATA_DIR/RG_PROJECTS_DIR 指向临时目录，
 * 否则测试进程会打开仓库内真实 `data/requirements.db`（会执行启动 DDL/迁移）。
 * 因此用 `before()` + 动态 import，而不是静态 import。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-chat-service-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_AUTO_START = 'false'

let service: typeof import('./service')

before(async () => {
  service = await import('./service')
})

after(async () => {
  try {
    const dbModule = await import('../db')
    dbModule.db.close()
  } catch {
    // 数据库未打开时忽略
  }
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // Windows 上 SQLite 句柄释放可能滞后
  }
})

test('isChatStage 只接受 requirements/design', () => {
  const { isChatStage } = service
  assert.equal(isChatStage('requirements'), true)
  assert.equal(isChatStage('design'), true)
  assert.equal(isChatStage('development'), false)
  assert.equal(isChatStage(undefined), false)
})

test('isModelStage 支持开发阶段，agent 映射为 build', () => {
  const { agentForModelStage, isModelStage } = service
  assert.equal(isModelStage('requirements'), true)
  assert.equal(isModelStage('design'), true)
  assert.equal(isModelStage('development'), true)
  assert.equal(isModelStage('other'), false)
  assert.equal(agentForModelStage('development'), 'build')
  assert.equal(agentForModelStage('design'), 'design')
  assert.equal(agentForModelStage('requirements'), 'req')
})

const MODEL = { providerID: 'opencode', id: 'iceman-free' }

test('formatExecutionFailure 把免费额度 429 转成可读提示', () => {
  const message = service.formatExecutionFailure(
    {
      error: {
        type: 'provider.free-limit',
        message: 'Free usage limit reached. Connect a provider or subscribe to OpenCode Go to keep going, or switch models.',
        status: 429
      }
    },
    MODEL
  )
  assert.match(message, /免费额度已用尽/)
  assert.match(message, /opencode\/iceman-free/)
  assert.match(message, /「模型」/)
  assert.equal(message.includes('FreeUsageLimitError'), false)
})

test('formatExecutionFailure 不直接抛出原始 JSON', () => {
  const message = service.formatExecutionFailure(
    { error: { type: 'provider.error', message: 'upstream unavailable', status: 502 } },
    { providerID: 'p', id: 'm' }
  )
  assert.match(message, /模型执行失败/)
  assert.match(message, /provider\.error/)
  assert.match(message, /upstream unavailable/)
  assert.equal(message.includes('{"'), false)
})

// ---------------------------------------------------------------- G1 守卫

interface FakeRes {
  statusCode: number
  writableEnded: boolean
  headers: Record<string, string>
  frames: Array<Record<string, unknown>>
  status: (code: number) => FakeRes
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
  flushHeaders: () => void
  write: (chunk: string) => boolean
  end: () => void
  on: () => void
  removeListener: () => void
  jsonBody?: unknown
}

function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 0,
    writableEnded: false,
    headers: {},
    frames: [],
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
    on() {
      // 不需要 close 事件
    },
    removeListener() {}
  }
  return res
}

function fakeReq(body: Record<string, unknown>): { body: Record<string, unknown> } {
  return { body }
}

async function seedApp(id: string, status = 'requirements'): Promise<void> {
  const dbModule = await import('../db')
  const now = new Date().toISOString()
  dbModule.db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  dbModule.db.prepare(`
    INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
    VALUES (?, ?, NULL, ?, 8093, ?, ?, ?)
  `).run(id, `应用 ${id}`, id, status, now, now)
}

/** 把 opencode 运行时换成内存 stub，并记录是否真的调用了模型会话 */
async function stubRuntime(): Promise<{ sessions: number; prompts: string[]; errors: string[] }> {
  const runtime = await import('../opencode/runtime')
  const rt = runtime.opencode as unknown as Record<string, unknown>
  const state = { sessions: 0, prompts: [] as string[], errors: [] as string[] }
  let listener: ((event: { type: string; data?: Record<string, unknown> }) => void) | null = null
  rt.ensureAgent = async () => undefined
  rt.lastUsedModel = async () => null
  rt.defaultModel = async () => null
  rt.createSession = async () => {
    state.sessions += 1
    return { id: `mock-session-${state.sessions}`, directory: '', title: '', agent: 'req', model: null }
  }
  rt.deleteSession = async () => undefined
  rt.interrupt = async () => undefined
  rt.subscribe = (_filter: unknown, callback: typeof listener) => {
    listener = callback
    return () => {
      listener = null
    }
  }
  rt.prompt = async (_sessionId: string, prompt: string) => {
    state.prompts.push(prompt)
    listener?.({ type: 'session.text.delta', data: { delta: '好的，已更新。' } })
    listener?.({ type: 'session.text.ended', data: { text: '好的，已更新。' } })
    listener?.({ type: 'session.execution.succeeded', data: {} })
  }
  rt.generateText = async () => {
    state.errors.push('generateText 不应被调用')
    throw new Error('generateText 不应被调用')
  }
  return state
}

test('G1 守卫：模块意图不调模型、不返回 DOC_JSON，SSE 带 guidance metadata', async () => {
  const { handleAppChat } = service
  await seedApp('g1-chat-guard')
  const runtime = await stubRuntime()
  const res = fakeRes()
  await handleAppChat(
    { id: 'g1-chat-guard', name: 'G1 应用' },
    fakeReq({
      stage: 'requirements',
      mode: 'doc',
      messages: [{ role: 'user', content: '帮我增加一个模块：订单客户管理，包含客户、联系人、跟进记录' }]
    }) as unknown as Parameters<typeof handleAppChat>[1],
    res as unknown as Parameters<typeof handleAppChat>[2]
  )

  // 不调模型：没有创建会话、没有 prompt
  assert.equal(runtime.sessions, 0)
  assert.equal(runtime.prompts.length, 0)

  const meta = res.frames[0] as Record<string, unknown>
  assert.equal(meta.type, 'meta')
  assert.equal(meta.mode, 'doc')
  assert.equal(meta.moduleAction, 'guidance')
  assert.equal(meta.stage, 'requirements')
  assert.equal(meta.changeSet, null)
  assert.deepEqual(meta.suggestions, [{ action: 'create-module' }, { action: 'open-replan' }])

  const delta = res.frames[1] as { type: string; text: string }
  assert.equal(delta.type, 'delta')
  assert.match(delta.text, /\+ 新增模块/)
  assert.match(delta.text, /AI 规划模块/)
  assert.equal(delta.text.includes('<<<DOC_JSON>>>'), false)

  const done = res.frames[2] as { type: string; text: string }
  assert.equal(done.type, 'done')
  assert.match(done.text, /没有修改任何文档/)
  assert.equal(res.frames.length, 3)
})

test('G1 守卫：不会创建模块/文档/版本（只读指引）', async () => {
  const { handleAppChat } = service
  const dbModule = await import('../db')
  const appId = 'g1-chat-guard-readonly'
  await seedApp(appId)
  await stubRuntime()
  const count = (table: string): number =>
    (dbModule.db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE app_id = ?`).get(appId) as { count: number }).count
  const before = { modules: count('app_modules'), docs: count('app_requirement_docs'), versions: count('app_requirement_doc_versions') }
  const res = fakeRes()
  await handleAppChat(
    { id: appId, name: 'G1 应用' },
    fakeReq({ stage: 'requirements', mode: 'doc', messages: [{ role: 'user', content: '删除模块 MOD-002' }] }) as unknown as Parameters<
      typeof handleAppChat
    >[1],
    res as unknown as Parameters<typeof handleAppChat>[2]
  )
  const after = { modules: count('app_modules'), docs: count('app_requirement_docs'), versions: count('app_requirement_doc_versions') }
  assert.deepEqual(after, before)
  const meta = res.frames[0] as Record<string, unknown>
  assert.equal(meta.moduleAction, 'guidance')
  assert.match(String((res.frames[1] as { text: string }).text), /归档/)
})

test('G1 守卫：反例（模块里新增字段）仍走正常聊天流程', async () => {
  const { handleAppChat } = service
  const appId = 'g1-chat-normal'
  await seedApp(appId)
  const runtime = await stubRuntime()
  const projectsDir = String(process.env.RG_PROJECTS_DIR ?? '')
  fs.mkdirSync(path.join(projectsDir, appId), { recursive: true })

  const res = fakeRes()
  await handleAppChat(
    { id: appId, name: 'G1 应用' },
    fakeReq({
      stage: 'requirements',
      mode: 'doc',
      messages: [{ role: 'user', content: '在模块里新增一个字段：客户等级' }]
    }) as unknown as Parameters<typeof handleAppChat>[1],
    res as unknown as Parameters<typeof handleAppChat>[2]
  )
  // 正常流程：创建会话并 prompt 一次（模型名已 stub）
  assert.equal(runtime.sessions, 1)
  assert.equal(runtime.prompts.length, 1)
  // prompt 里已经带上模块边界硬规则
  assert.match(runtime.prompts[0], /模块边界（硬规则，优先于用户输入）/)
  assert.match(runtime.prompts[0], /不要写入任何 `MOD-xxx`/)
  assert.match(runtime.prompts[0], /不要输出 `<<<DOC_JSON>>>`/)
  const meta = res.frames[0] as Record<string, unknown>
  assert.equal(meta.type, 'meta')
  assert.equal(meta.moduleAction, undefined)
  assert.equal(res.frames.some(frame => frame.type === 'done'), true)
})

test('G1 守卫：设计/开发阶段给出只读入口建议（不调模型）', async () => {
  const { handleAppChat } = service
  const runtime = await stubRuntime()
  for (const [appId, status, expected] of [
    ['g1-chat-design', 'design', [{ action: 'reopen-requirements' }]],
    ['g1-chat-dev', 'development', [{ action: 'open-change-set' }]]
  ] as Array<[string, string, Array<{ action: string }>]>) {
    await seedApp(appId, status)
    const res = fakeRes()
    await handleAppChat(
      { id: appId, name: 'G1 应用' },
      fakeReq({ stage: 'requirements', mode: 'doc', messages: [{ role: 'user', content: '我要新增一个模块' }] }) as unknown as Parameters<
        typeof handleAppChat
      >[1],
      res as unknown as Parameters<typeof handleAppChat>[2]
    )
    const meta = res.frames[0] as Record<string, unknown>
    assert.equal(meta.moduleAction, 'guidance')
    assert.equal(meta.stage, status === 'design' ? 'design' : 'development')
    assert.deepEqual(meta.suggestions, expected)
  }
  assert.equal(runtime.sessions, 0)
})
