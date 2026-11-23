/**
 * 统一对话：视图会话选择、prompt 提示、command 触发、SSE 帧
 *
 * `../db` 在模块初始化时打开 SQLite：必须在 import 之前把 RG_DATA_DIR/RG_PROJECTS_DIR
 * 指向临时目录；opencode 运行时用内存 stub（不启动 serve、不调用模型）。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before, beforeEach } from 'node:test'
import { eventCompletion, sessionCompletion, shouldFallbackFinish } from '../opencode/session-state'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-chat-service-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

let service: typeof import('./service')
let dbModule: typeof import('../db')

before(async () => {
  dbModule = await import('../db')
  service = await import('./service')
})

after(async () => {
  dbModule.db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

interface RuntimeState {
  sessions: Array<{ id: string; directory: string; agent?: string; title?: string }>
  prompts: Array<{ sessionID: string; text: string }>
  commands: Array<{ sessionID: string; name: string; text: string }>
  failNextPrompt: boolean
  listener: ((event: { type: string; data?: Record<string, unknown> }) => void) | null
  deleted: string[]
  /** P7-6c：watchdog 回退读取的会话信息/消息 */
  info: Record<string, unknown> | null
  messages: unknown[]
  emitIdle: boolean
  interruptNext: boolean
  interrupted: number
  messagesCalls: number
}

const state: RuntimeState = {
  sessions: [],
  prompts: [],
  commands: [],
  failNextPrompt: false,
  listener: null,
  deleted: [],
  info: null,
  messages: [],
  emitIdle: true,
  interruptNext: false,
  interrupted: 0,
  messagesCalls: 0
}

function resetState(): void {
  state.sessions = []
  state.prompts = []
  state.commands = []
  state.failNextPrompt = false
  state.listener = null
  state.deleted = []
  state.info = null
  state.messages = []
  state.emitIdle = true
  state.interruptNext = false
  state.interrupted = 0
  state.messagesCalls = 0
}

async function stubRuntime(): Promise<void> {
  const runtime = await import('../opencode/runtime')
  const rt = runtime.opencode as unknown as Record<string, unknown>
  rt.lastUsedModel = async () => null
  rt.defaultModel = async () => null
  rt.session = async (id: string) => {
    const found = state.sessions.find(session => session.id === id)
    return found ? { id, title: found.title, ...(state.info ?? {}) } : null
  }
  rt.createSession = async (input: { directory: string; title?: string; agent?: string }) => {
    const created = { id: `mock-session-${state.sessions.length + 1}`, ...input }
    state.sessions.push(created)
    return created
  }
  rt.deleteSession = async (id: string) => {
    state.deleted.push(id)
  }
  rt.messages = async () => {
    state.messagesCalls += 1
    return { data: state.messages }
  }
  rt.interrupt = async () => {
    state.interrupted += 1
    return undefined
  }
  rt.track = () => undefined
  rt.subscribe = (_filter: unknown, callback: RuntimeState['listener']) => {
    state.listener = callback
    return () => {
      state.listener = null
    }
  }
  rt.prompt = async (sessionID: string, text: string) => {
    state.prompts.push({ sessionID, text })
    if (state.failNextPrompt) {
      state.listener?.({ type: 'session.execution.failed', data: { error: { status: 429, message: 'limit' } } })
      return
    }
    if (state.interruptNext) {
      state.listener?.({ type: 'session.text.delta', data: { delta: '中断前输出' } })
      state.listener?.({ type: 'session.execution.interrupted', data: {} })
      return
    }
    state.listener?.({ type: 'session.text.delta', data: { delta: '已处理。' } })
    state.listener?.({ type: 'session.text.ended', data: { text: '已处理。' } })
    if (state.emitIdle) state.listener?.({ type: 'session.execution.succeeded', data: {} })
  }
  rt.runCommand = async (sessionID: string, name: string, text: string) => {
    state.commands.push({ sessionID, name, text })
    state.listener?.({ type: 'session.text.delta', data: { delta: '命令已执行。' } })
    state.listener?.({ type: 'session.text.ended', data: { text: '命令已执行。' } })
    state.listener?.({ type: 'session.execution.succeeded', data: {} })
  }
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
  emit: (name: string) => void
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
    },
    emit(name) {
      for (const handler of [...(res.listeners[name] ?? [])]) handler()
    }
  }
  return res
}

function fakeReq(body: Record<string, unknown>): { body: Record<string, unknown> } {
  return { body }
}

/** watchdog/超时定时器是 unref 的；测试里手动保持事件循环，模拟长驻服务进程 */
function keepAlive(): () => void {
  const timer = setInterval(() => undefined, 5)
  return () => clearInterval(timer)
}

function seedApp(id: string): void {
  const now = new Date().toISOString()
  dbModule.db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  dbModule.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 8093, 'requirements', ?, ?)`
    )
    .run(id, `应用 ${id}`, id, now, now)
  fs.mkdirSync(path.join(projects, id), { recursive: true })
}

beforeEach(() => {
  resetState()
  seedApp('chat-app')
  seedApp('chat-app-2')
})

test('isModelStage 接受三个视图；agent 统一 build', () => {
  assert.equal(service.isModelStage('requirements'), true)
  assert.equal(service.isModelStage('design'), true)
  assert.equal(service.isModelStage('development'), true)
  assert.equal(service.isModelStage('other'), false)
  assert.equal(service.agentForModelStage('requirements'), 'build')
  assert.equal(service.agentForView('design'), 'build')
})

test('formatExecutionFailure 把免费额度 429 转成可读提示', () => {
  const message = service.formatExecutionFailure(
    { error: { type: 'provider.free-limit', message: 'Free usage limit reached', status: 429 } },
    { providerID: 'opencode', id: 'iceman-free' }
  )
  assert.match(message, /免费额度已用尽/)
  assert.match(message, /opencode\/iceman-free/)
  assert.equal(message.includes('{"'), false)

  const other = service.formatExecutionFailure(
    { error: { type: 'provider.error', message: 'upstream unavailable', status: 502 } },
    { providerID: 'p', id: 'm' }
  )
  assert.match(other, /模型执行失败/)
  assert.equal(other.includes('{"'), false)
})

test('buildViewPrompt：按视图给出产物路径与 skill，不输出聊天协议', () => {
  const requirements = service.buildViewPrompt('requirements', '加一个字段', 'MOD-001')
  assert.match(requirements, /当前视图：需求/)
  assert.match(requirements, /MOD-001/)
  assert.match(requirements, /docs\/requirements\/MOD-xxx-/)
  assert.match(requirements, /adw-requirements-document/)
  const chinese = '所有面向用户的文字——回复、思考\/进度说明、工具说明、汇报——一律使用中文'
  assert.ok(requirements.includes(chinese), '需求视图应注入中文要求')
  assert.equal(requirements.includes('<<<DOC_JSON>>>'), false)

  const design = service.buildViewPrompt('design', '生成设计')
  assert.match(design, /adw-design-artifacts/)
  assert.match(design, /design\.schema\.json/)
  assert.ok(design.includes(chinese), '设计视图应注入中文要求')

  const development = service.buildViewPrompt('development', '开始开发')
  assert.match(development, /当前视图：开发/)
  assert.ok(development.includes(chinese), '开发视图应注入中文要求')
  assert.match(development, /docs\/design\/design-system\.json/)
  assert.match(development, /docs\/design\/template\//)
  assert.match(development, /adw-frontend-implementation/)
  assert.match(development, /afcenter-page-generation/)
  assert.match(development, /pm-components-usage/)
  assert.match(development, /ui-check\.md/)
  assert.match(development, /PageTemplates/)
  assert.match(development, /pm-form-dialog/)
  assert.match(development, /GlobalPreference/)
  assert.match(development, /需求 > design-system\/design\.json 契约 > 蓝图/)
  assert.match(development, /冲突先报告/)
  assert.match(development, /EOS 后端不吃风格/)
  assert.match(development, /用户消息：\n开始开发/)

  const withDigest = service.buildViewPrompt('development', '开始开发', 'MOD-001', { digest: '【设计摘要】\n- 测试摘要' })
  assert.match(withDigest, /工作台注入的设计摘要/)
  assert.match(withDigest, /【设计摘要】\n- 测试摘要/)
  assert.match(withDigest, /MOD-001/)
})

test('handleAppChat：每视图一个活跃会话，第二轮复用同一会话', async () => {
  await stubRuntime()
  const res = fakeRes()
  await service.handleAppChat(
    { id: 'chat-app', name: '对话应用' },
    fakeReq({ view: 'requirements', text: '写商品管理需求' }) as never,
    res as never
  )
  const meta = res.frames[0] as Record<string, unknown>
  assert.equal(meta.type, 'meta')
  assert.equal(meta.view, 'requirements')
  assert.equal(meta.sessionID, 'mock-session-1')
  assert.equal((res.frames.at(-1) as Record<string, unknown>).type, 'done')
  assert.equal(state.prompts.length, 1)
  assert.match(state.prompts[0].text, /写商品管理需求/)
  assert.match(state.prompts[0].text, /adw-requirements-document/)

  const second = fakeRes()
  await service.handleAppChat(
    { id: 'chat-app', name: '对话应用' },
    fakeReq({ view: 'requirements', text: '再加验收标准' }) as never,
    second as never
  )
  assert.equal(state.sessions.length, 1, '同视图应复用活跃会话')
  assert.equal((second.frames[0] as Record<string, unknown>).sessionID, 'mock-session-1')
  assert.equal(state.prompts.length, 2)

  const rows = dbModule.db.prepare('SELECT view, opencode_session_id FROM app_sessions WHERE app_id = ?').all('chat-app') as Array<{
    view: string
    opencode_session_id: string
  }>
  assert.equal(rows.length, 1)
  assert.equal(rows[0].view, 'requirements')
  assert.equal(rows[0].opencode_session_id, 'mock-session-1')
})

test('不同视图 → 不同会话；列表按 view 过滤', async () => {
  await stubRuntime()
  await service.handleAppChat(
    { id: 'chat-app-2', name: '多视图应用' },
    fakeReq({ view: 'requirements', text: '需求' }) as never,
    fakeRes() as never
  )
  await service.handleAppChat(
    { id: 'chat-app-2', name: '多视图应用' },
    fakeReq({ view: 'design', text: '设计' }) as never,
    fakeRes() as never
  )
  await service.handleAppChat(
    { id: 'chat-app-2', name: '多视图应用' },
    fakeReq({ view: 'development', text: '开发' }) as never,
    fakeRes() as never
  )
  assert.equal(state.sessions.length, 3)

  const requirements = await service.ensureViewSession({ id: 'chat-app-2', name: '多视图应用' }, 'requirements', path.join(projects, 'chat-app-2'), null)
  assert.equal(requirements.opencodeSessionId, 'mock-session-1')
  const list = service.sessionsForView('chat-app-2', 'design')
  assert.equal(list.length, 1)
  assert.equal(list[0].view, 'design')
  assert.equal(service.sessionsForView('chat-app-2', 'development').length, 1)
})

test('command 模式：走 runCommand（name/text），不发普通 prompt', async () => {
  await stubRuntime()
  const res = fakeRes()
  await service.handleAppChat(
    { id: 'chat-app', name: '对话应用' },
    fakeReq({ view: 'design', command: 'generate-design', text: 'MOD-001' }) as never,
    res as never
  )
  assert.equal(state.prompts.length, 0)
  assert.equal(state.commands.length, 1)
  assert.equal(state.commands[0].name, 'generate-design')
  assert.equal(state.commands[0].text, 'MOD-001')
  const meta = res.frames[0] as Record<string, unknown>
  assert.equal(meta.command, 'generate-design')
  assert.equal(meta.view, 'design')
})

test('空消息 → 400；执行失败 → error 帧 + 可读提示', async () => {
  await stubRuntime()
  const empty = fakeRes()
  await service.handleAppChat({ id: 'chat-app', name: '对话应用' }, fakeReq({ view: 'requirements', text: '  ' }) as never, empty as never)
  assert.equal(empty.statusCode, 400)
  assert.equal(empty.jsonBody !== undefined, true)

  state.failNextPrompt = true
  const failed = fakeRes()
  await service.handleAppChat(
    { id: 'chat-app', name: '对话应用' },
    fakeReq({ view: 'requirements', text: '触发失败' }) as never,
    failed as never
  )
  const errorFrame = failed.frames.find(frame => frame.type === 'error') as { message?: string } | undefined
  assert.ok(errorFrame, '应返回 error 帧')
  assert.match(String(errorFrame?.message), /限流|模型执行失败/)
})

test('P7-6c 完成判定：idle 消息/outcome/busy 与 watchdog 阈值', () => {
  assert.equal(sessionCompletion({}, [{ type: 'idle', outcome: 'succeeded' }]), 'complete')
  assert.equal(sessionCompletion({}, [{ type: 'idle', outcome: 'interrupted' }]), 'interrupted')
  assert.equal(sessionCompletion({}, [{ type: 'idle' }]), 'complete')
  assert.equal(sessionCompletion({ outcome: 'failed' }, []), 'failed')
  assert.equal(
    sessionCompletion({ outcome: 'succeeded' }, [{ type: 'idle', outcome: 'succeeded' }, { type: 'user', text: '下一轮' }]),
    null,
    '新的一轮已开始时不能沿用上一轮收尾'
  )
  assert.equal(sessionCompletion({ outcome: 'running', time: { busy: true } }, []), null)
  assert.equal(
    sessionCompletion({ time: { busy: false } }, [{ type: 'assistant', content: [{ type: 'text', text: 'x' }], time: { created: 1, completed: 2 } }]),
    'complete'
  )
  assert.equal(
    sessionCompletion({ time: { busy: true } }, [{ type: 'assistant', content: [{ type: 'text', text: 'x' }], time: { created: 1, completed: 2 } }]),
    null,
    'busy 时不凭消息收尾，避免长工具误判'
  )
  assert.equal(
    sessionCompletion(
      { outcome: 'succeeded' },
      [{ type: 'assistant', content: [{ type: 'tool', state: { status: 'running' } }] }]
    ),
    null,
    '最后一条 assistant 仍有运行中工具时不收尾'
  )
  assert.equal(
    sessionCompletion({ time: { busy: false } }, [{ type: 'assistant', content: [{ type: 'tool', state: { status: 'running' } }], time: { created: 1, completed: 2 } }]),
    null,
    '工具仍在运行时不收尾'
  )
  assert.equal(
    sessionCompletion(
      { time: { busy: false } },
      [{ type: 'assistant', content: [{ type: 'tool', state: { status: 'completed' } }], finish: 'tool-calls', time: { created: 1, completed: 2 } }]
    ),
    null,
    'finish=tool-calls 表示还有下一轮，不能凭消息收尾（P7-7c-2 真实模型命中）'
  )
  assert.equal(
    sessionCompletion(
      { time: { busy: false } },
      [{ type: 'assistant', content: [{ type: 'text', text: '完成' }], finish: 'stop', time: { created: 1, completed: 2 } }]
    ),
    'complete',
    'finish=stop 且无运行中工具时可凭消息收尾'
  )
  assert.equal(
    sessionCompletion(
      { time: { busy: 1795267894965 } },
      [{ type: 'assistant', content: [{ type: 'text', text: '完成' }], finish: 'stop', time: { created: 1, completed: 2 } }]
    ),
    null,
    'opencode v2 的 time.busy 是时间戳：仍在忙，不凭消息收尾'
  )

  assert.equal(shouldFallbackFinish({ now: 1000, lastEventAt: 1000, hasActivity: false, idleAfterMs: 0 }), false)
  assert.equal(shouldFallbackFinish({ now: 1000, lastEventAt: 1000, hasActivity: true, idleAfterMs: 10 }), false)
  assert.equal(shouldFallbackFinish({ now: 1010, lastEventAt: 1000, hasActivity: true, idleAfterMs: 10 }), true)

  assert.equal(eventCompletion({ type: 'session.execution.succeeded' }), 'complete')
  assert.equal(eventCompletion({ type: 'session.status', data: { status: 'idle' } }), 'complete')
  assert.equal(eventCompletion({ type: 'session.updated', data: { status: 'running' } }), null)
  assert.equal(eventCompletion({ type: 'session.execution.interrupted' }), 'interrupted')
})

test('P7-6c watchdog：只发 delta/text 不发 idle → 回退读取会话并补 done', async () => {
  await stubRuntime()
  process.env.RG_CHAT_WATCHDOG_INTERVAL_MS = '10'
  process.env.RG_CHAT_WATCHDOG_IDLE_MS = '20'
  const stopKeepAlive = keepAlive()
  try {
    state.emitIdle = false
    state.info = { time: { created: 1, busy: false } }
    state.messages = [
      { id: 'a1', type: 'assistant', content: [{ type: 'text', text: '已完成' }], time: { created: 1, completed: 2 } }
    ]
    const res = fakeRes()
    const started = Date.now()
    await service.handleAppChat(
      { id: 'chat-app', name: '对话应用' },
      fakeReq({ view: 'development', text: '实现页面' }) as never,
      res as never
    )
    const last = res.frames.at(-1) as Record<string, unknown>
    assert.equal(last.type, 'done')
    assert.equal(last.text, '已处理。')
    assert.ok(state.messagesCalls >= 1, 'watchdog 应读取一次会话消息')
    assert.equal(state.interrupted, 0, '确认完成时不应中断会话')
    assert.ok(Date.now() - started < 3000, '不应挂起到总超时')
  } finally {
    stopKeepAlive()
    delete process.env.RG_CHAT_WATCHDOG_INTERVAL_MS
    delete process.env.RG_CHAT_WATCHDOG_IDLE_MS
  }
})

test('P7-6c 中断：execution.interrupted → error 帧、无 done', async () => {
  await stubRuntime()
  state.interruptNext = true
  const res = fakeRes()
  await service.handleAppChat(
    { id: 'chat-app', name: '对话应用' },
    fakeReq({ view: 'development', text: '实现页面' }) as never,
    res as never
  )
  assert.equal(res.frames.some(frame => frame.type === 'done'), false)
  const errorFrame = res.frames.find(frame => frame.type === 'error') as { message?: string } | undefined
  assert.match(String(errorFrame?.message), /已中止/)
})

test('P7-6c 总超时：未完成也不无限挂起，写 error 并中断一次', async () => {
  await stubRuntime()
  process.env.RG_CHAT_TIMEOUT_MS = '40'
  process.env.RG_CHAT_WATCHDOG_INTERVAL_MS = '10'
  process.env.RG_CHAT_WATCHDOG_IDLE_MS = '1000'
  const stopKeepAlive = keepAlive()
  try {
    state.emitIdle = false
    state.info = { time: { created: 1, busy: true } }
    state.messages = []
    const res = fakeRes()
    await service.handleAppChat(
      { id: 'chat-app', name: '对话应用' },
      fakeReq({ view: 'requirements', text: '长时间任务' }) as never,
      res as never
    )
    const errorFrame = res.frames.find(frame => frame.type === 'error') as { message?: string } | undefined
    assert.match(String(errorFrame?.message), /超时/)
    assert.equal(res.frames.some(frame => frame.type === 'done'), false)
    assert.equal(state.interrupted, 1)
  } finally {
    stopKeepAlive()
    delete process.env.RG_CHAT_TIMEOUT_MS
    delete process.env.RG_CHAT_WATCHDOG_INTERVAL_MS
    delete process.env.RG_CHAT_WATCHDOG_IDLE_MS
  }
})

test('P7-6c 客户端断开：只中断一次、不重复写 done', async () => {
  await stubRuntime()
  process.env.RG_CHAT_WATCHDOG_INTERVAL_MS = '10'
  process.env.RG_CHAT_WATCHDOG_IDLE_MS = '1000'
  try {
    state.emitIdle = false
    state.info = { time: { created: 1, busy: true } }
    state.messages = []
    const res = fakeRes()
    const pending = service.handleAppChat(
      { id: 'chat-app', name: '对话应用' },
      fakeReq({ view: 'development', text: '实现页面' }) as never,
      res as never
    )
    await new Promise(resolve => setTimeout(resolve, 30))
    res.emit('close')
    res.emit('close')
    await pending
    assert.equal(state.interrupted, 1, '断开只应中断一次')
    assert.equal(res.frames.some(frame => frame.type === 'done'), false)
  } finally {
    delete process.env.RG_CHAT_WATCHDOG_INTERVAL_MS
    delete process.env.RG_CHAT_WATCHDOG_IDLE_MS
  }
})
