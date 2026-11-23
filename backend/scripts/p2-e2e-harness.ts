/**
 * P2 Playwright 专用后端（仅测试用，不进生产路由）
 *
 * - 真实 Express 后端 + 临时 SQLite/projects + 前端 dist（静态托管）
 * - `OPENCODE_AUTO_START=false`；进程内 stub `opencode`（不启动 serve、不调用模型）
 * - 按用户文本触发固定事件序列：文本流/工具卡/权限/表单/90% 上下文/中止/命令
 * - 测试状态写入 `P2_STATE_FILE`（Playwright 读取与外部改文件用）
 *
 * 端口：3422（后端）；不占用真实 3300 / 4771。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.env.P2_ROOT || fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p2-harness-'))
const stateFile = process.env.P2_STATE_FILE || path.join(root, 'state.json')
const port = Number(process.env.P2_PORT ?? 3422)
const appId = process.env.P2_APP_ID || 'p2-app'
const appName = process.env.P2_APP_NAME || 'P2 需求视图'
/** 测试可选：创建带设计系统的应用（P7-6a 一致性检查 e2e） */
const designSystemEnv = process.env.P2_DESIGN_SYSTEM || ''

process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = 'false'

interface StubSession {
  id: string
  title: string
  messages: unknown[]
  pending: { permissions: unknown[]; forms: unknown[] }
  listeners: Set<(event: Record<string, unknown>) => void>
  busy: boolean
  outcome: string | null
  sequence: number
  interrupted: boolean
}

interface HarnessState {
  appId: string
  appDir: string
  projectsDir: string
  port: number
  stateFile: string
  ready: boolean
  commands: Array<{ name: string; text: string; sessionID: string }>
  prompts: Array<{ text: string; sessionID: string }>
  compactCount: number
  sessions: Array<{ id: string; view: string; title: string }>
}

const sessions = new Map<string, StubSession>()
let sessionCounter = 0
let messageCounter = 0
const createdAt = Date.now()

const state: HarnessState = {
  appId,
  appDir: path.join(process.env.RG_PROJECTS_DIR as string, appId),
  projectsDir: process.env.RG_PROJECTS_DIR as string,
  port,
  stateFile,
  ready: false,
  commands: [],
  prompts: [],
  compactCount: 0,
  sessions: []
}

function sleepSync(ms: number): void {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  } catch {
    // 极少数运行时不允许 Atomics.wait：忽略
  }
}

/** Windows 上并发读取会让 rename/write 短暂 EPERM，重试即可 */
function persist(): void {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true })
  const text = JSON.stringify(state, null, 2)
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      fs.writeFileSync(stateFile, text, 'utf8')
      return
    } catch {
      sleepSync(10)
    }
  }
}

function emit(session: StubSession, event: Record<string, unknown>): void {
  for (const listener of session.listeners) {
    try {
      listener(event)
    } catch {
      // 订阅者已断开
    }
  }
}

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

function nextMessageId(prefix: string): string {
  messageCounter += 1
  return `${prefix}-${messageCounter}`
}

function userMessage(text: string): Record<string, unknown> {
  return { id: nextMessageId('user'), type: 'user', text, time: { created: Date.now() } }
}

function assistantMessage(
  text: string,
  options: {
    tokens?: Record<string, unknown>
    tool?: { path: string; content: string }
    reasoning?: string
  } = {}
): { message: Record<string, unknown>; textPart: Record<string, unknown> } {
  const textPart: Record<string, unknown> = { type: 'text', text }
  const content: Array<Record<string, unknown>> = [textPart]
  if (options.reasoning) content.unshift({ type: 'reasoning', text: options.reasoning })
  if (options.tool) {
    content.push({
      type: 'tool',
      tool: 'write',
      state: {
        status: 'completed',
        input: { filePath: options.tool.path, content: options.tool.content },
        output: { output: `wrote ${options.tool.path}` },
        title: `write ${options.tool.path}`,
        time: { start: Date.now() - 180, end: Date.now() - 20 }
      }
    })
  }
  const message = {
    id: nextMessageId('assistant'),
    type: 'assistant',
    content,
    tokens: options.tokens ?? { input: 120, output: 40, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() - 200, completed: Date.now() },
    finish: 'stop',
    model: { providerID: 'stub', modelID: 'stub-model' }
  }
  return { message, textPart }
}

function plainAssistant(text: string): Record<string, unknown> {
  return assistantMessage(text).message
}

function sessionInfo(session: StubSession): Record<string, unknown> {
  return {
    id: session.id,
    title: session.title,
    outcome: session.outcome,
    time: { created: createdAt, busy: session.busy }
  }
}

/** 把文本分段写进同一条 assistant 消息，前端刷新即可看到逐步累积 */
async function streamAssistant(
  session: StubSession,
  text: string,
  options: {
    chunks?: number
    gap?: number
    tokens?: Record<string, unknown>
    tool?: { path: string; content: string }
    reasoning?: string
  } = {}
): Promise<void> {
  const { message, textPart } = assistantMessage('', {
    tokens: options.tokens,
    tool: options.tool,
    reasoning: options.reasoning
  })
  session.messages.push(message)
  const chunks = Math.max(1, options.chunks ?? 4)
  const gap = Math.max(30, options.gap ?? 260)
  const size = Math.max(1, Math.ceil(text.length / chunks))
  for (let index = 0; index < text.length; index += size) {
    textPart.text = String(textPart.text) + text.slice(index, index + size)
    emit(session, { type: 'session.text.delta', data: { delta: text.slice(index, index + size), sessionID: session.id } })
    await delay(gap)
  }
  emit(session, { type: 'session.text.ended', data: { text, sessionID: session.id } })
  session.busy = false
  session.outcome = 'succeeded'
  emit(session, { type: 'session.execution.succeeded', data: { sessionID: session.id } })
  emit(session, { type: 'session.idle', data: { sessionID: session.id } })
}

/** 从统一 prompt（带“用户消息：”前缀）里取出用户文本；兼容原文直发 */
function userTextOf(incoming: string): string {
  const marker = '用户消息：'
  const index = incoming.lastIndexOf(marker)
  return (index >= 0 ? incoming.slice(index + marker.length) : incoming).trim()
}

/** P3：generate-design 命令落地一个可渲染的 design.json（stub，仅测试用） */
function writeDesignFile(moduleKey: string): string {
  const key = moduleKey.trim() || 'MOD-001'
  const titles: Record<string, string> = { 'MOD-001': '商品管理', 'MOD-002': '订单管理' }
  const title = titles[key] ?? `模块 ${key}`
  const design = {
    module: key,
    title,
    entities: [
      {
        id: 'product',
        name: '商品',
        table: 'biz_product',
        fields: [
          { name: '商品编码', type: 'string', required: true, unique: true },
          { name: '商品名称', type: 'string', required: true },
          { name: '状态', type: 'enum', options: ['上架', '下架'] },
          { name: '分类', type: 'ref', ref: 'category' }
        ]
      },
      {
        id: 'category',
        name: '商品分类',
        table: 'biz_category',
        fields: [{ name: '分类名称', type: 'string', required: true }]
      }
    ],
    relations: [{ from: 'product', to: 'category', type: 'N:1', label: '所属分类' }],
    pages: [
      {
        id: 'product-list',
        name: '商品列表',
        type: 'list',
        entity: 'product',
        columns: ['商品编码', '商品名称', '状态'],
        actions: ['新增', '编辑', '删除']
      },
      {
        id: 'product-form',
        name: '商品编辑',
        type: 'form',
        entity: 'product',
        actions: ['保存', '取消']
      }
    ]
  }
  const dir = path.join(state.appDir, 'docs', 'design', key)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'design.json')
  fs.writeFileSync(file, `${JSON.stringify(design, null, 2)}\n`, 'utf8')
  return `docs/design/${key}/design.json`
}

/** 按用户文本触发确定的事件序列（requirements 视图的 prompt 会带固定前缀） */
async function runScenario(session: StubSession, incoming: string): Promise<void> {
  session.sequence += 1
  state.prompts.push({ text: incoming, sessionID: session.id })
  persist()

  const userText = userTextOf(incoming)
  // 与真实 opencode 一致：user 消息保存完整 prompt（含视图框架），展示层由 timeline 归一化
  session.messages.push(userMessage(incoming))
  session.busy = true
  session.outcome = null
  session.interrupted = false
  persist()

  // 90% 上下文
  if (userText.includes('上下文90')) {
    await streamAssistant(session, '已记录大量上下文，接着可能触发压缩提示。', {
      tokens: { input: 9000, output: 40, reasoning: 0, cache: { read: 0, write: 0 } },
      chunks: 2,
      gap: 120
    })
    return
  }

  // 权限卡：文本后挂起，等待 replyPermission 再继续
  if (userText.includes('权限')) {
    await streamAssistant(session, '需要写入需求文件，先请求权限。', { chunks: 3, gap: 180 })
    session.pending.permissions = [
      {
        id: 'perm-1',
        sessionID: session.id,
        action: 'edit',
        resources: ['docs/requirements/MOD-001-商品管理.md'],
        message: '允许本次写入？'
      }
    ]
    session.busy = false
    session.outcome = null
    emit(session, { type: 'permission.asked', data: { sessionID: session.id } })
    return
  }

  // 表单卡
  if (userText.includes('表单')) {
    await streamAssistant(session, '需要确认范围，请填写表单。', { chunks: 3, gap: 180 })
    session.pending.forms = [
      {
        id: 'form-1',
        sessionID: session.id,
        title: '补充信息',
        fields: [{ key: 'scope', type: 'string', title: '范围', required: true }]
      }
    ]
    session.busy = false
    session.outcome = null
    emit(session, { type: 'form.created', data: { sessionID: session.id } })
    return
  }

  // 静默长任务：保持运行且不产出内容，用于验证占位 → 中断
  if (userText.includes('静默长任务')) {
    session.busy = true
    session.outcome = null
    persist()
    return
  }

  // 长任务：保持运行，等待停止
  if (userText.includes('长任务')) {
    session.messages.push(plainAssistant('正在生成较长的需求草稿…'))
    emit(session, { type: 'session.text.delta', data: { delta: '正在生成较长的需求草稿…', sessionID: session.id } })
    session.busy = true
    persist()
    return
  }

  // 失败：占位必须被失败标记替换
  if (userText.includes('触发失败')) {
    await delay(220)
    session.busy = false
    session.outcome = 'failed'
    persist()
    emit(session, {
      type: 'session.execution.failed',
      data: { sessionID: session.id, error: { type: 'stub', message: '模型连接超时（stub）' } }
    })
    return
  }

  // reasoning：先出现“思考”折叠块，再输出正文
  if (userText.includes('思考过程')) {
    await streamAssistant(session, '已阅读工作区产物，准备按设计实现前端页面。', {
      reasoning: '先读工作区产物，再判断需要补哪些章节或页面。',
      chunks: 2,
      gap: 140
    })
    return
  }

  // 流式占位：先保持本地占位，首个 delta 到达后替换
  if (userText.includes('流式占位')) {
    await delay(700)
    await streamAssistant(session, '占位已被首个内容替换，后续继续输出。', { chunks: 2, gap: 140 })
    return
  }

  // 默认：文本（慢速时用于验证流式）+ 工具卡
  const slow = userText.includes('慢速')
  const tool = { path: 'docs/requirements/MOD-001-商品管理.md', content: '# 商品管理\n\n## 1. 文档信息\n' }
  const answer = slow
    ? '这是慢速流式输出：第一段已经出现，后续段落会继续追加到同一条回复里。'
    : session.sequence % 2 === 1
      ? '已更新需求文档：补充了目标与验收标准，并同步了设计摘要。'
      : '已根据你的说明调整文档，请确认章节与验收标准。'
  await streamAssistant(session, answer, { tool, chunks: slow ? 6 : 4, gap: slow ? 380 : 260 })
}

async function installStub(): Promise<void> {
  const runtime = await import('../src/opencode/runtime')
  const rt = runtime.opencode as unknown as Record<string, unknown>

  rt.ensureStarted = async () => undefined
  rt.reloadLocations = async () => undefined
  rt.status = () => ({
    ready: true,
    starting: false,
    installed: true,
    autoStart: false,
    autoStartAttempted: true,
    host: '127.0.0.1',
    port: Number(process.env.OPENCODE_PORT),
    baseUrl: 'http://stub',
    bin: 'stub',
    version: 'stub',
    passwordCaptured: true,
    streamState: 'open',
    lastEventAt: new Date().toISOString(),
    lastError: null,
    installError: null,
    pendingSessions: 0
  })
  rt.listAgents = async () => [{ id: 'build', mode: 'primary' }]
  rt.listSkills = async () => []
  rt.listCommands = async () => []
  rt.listModels = async () => [
    { id: 'stub-model', providerID: 'stub', modelID: 'stub-model', name: 'Stub Model', variants: [], limit: { context: 10000 } }
  ]
  rt.defaultModel = async () => ({ id: 'stub-model', providerID: 'stub', modelID: 'stub-model', name: 'Stub Model', variants: [] })
  rt.lastUsedModel = async () => null
  rt.listSessions = async () => [...sessions.values()].map(session => ({ id: session.id, title: session.title }))
  rt.createSession = async (input: { directory: string; title?: string }) => {
    sessionCounter += 1
    const id = `oc-${sessionCounter}`
    const session: StubSession = {
      id,
      title: input.title ?? id,
      messages: [],
      pending: { permissions: [], forms: [] },
      listeners: new Set(),
      busy: false,
      outcome: null,
      sequence: 0,
      interrupted: false
    }
    sessions.set(id, session)
    state.sessions.push({ id, view: 'requirements', title: session.title })
    persist()
    return { id, title: session.title }
  }
  rt.session = async (id: string) => {
    const session = sessions.get(id)
    return session ? sessionInfo(session) : null
  }
  rt.messages = async (id: string) => ({ data: sessions.get(id)?.messages ?? [] })
  rt.refreshPending = async () => undefined
  rt.pendingFor = (id: string) => sessions.get(id)?.pending ?? { permissions: [], forms: [] }
  rt.track = () => undefined
  rt.deleteSession = async () => undefined
  rt.subscribe = (filter: { sessionID?: string }, listener: (event: Record<string, unknown>) => void) => {
    const session = filter?.sessionID ? sessions.get(filter.sessionID) : null
    if (!session) return () => undefined
    session.listeners.add(listener)
    return () => session.listeners.delete(listener)
  }
  rt.prompt = async (sessionID: string, text: string) => {
    const session = sessions.get(sessionID)
    if (session) void runScenario(session, text)
    return { ok: true }
  }
  rt.runCommand = async (sessionID: string, name: string, text: string) => {
    state.commands.push({ name, text, sessionID })
    persist()
    const session = sessions.get(sessionID)
    if (session) {
      session.busy = true
      session.messages.push(userMessage(`/${name} ${text}`.trim()))
      persist()
      emit(session, { type: 'session.text.delta', data: { delta: `已执行命令 ${name}`, sessionID } })
      await delay(120)
      let detail = `已执行命令 ${name}（参数：${text || '无'}）`
      if (name === 'generate-design') {
        const file = writeDesignFile(text)
        detail = `已生成 ${file}（2 实体 / 2 页面）`
      }
      session.messages.push(plainAssistant(detail))
      emit(session, { type: 'session.text.ended', data: { text: detail, sessionID } })
      session.busy = false
      session.outcome = 'succeeded'
      emit(session, { type: 'session.execution.succeeded', data: { sessionID } })
    }
    return { ok: true }
  }
  rt.interrupt = async (sessionID: string) => {
    const session = sessions.get(sessionID)
    if (!session) return { ok: true }
    if (session.outcome === 'interrupted') return { ok: true }
    session.busy = false
    session.outcome = 'interrupted'
    session.interrupted = true
    session.messages.push(plainAssistant('（已中止）'))
    emit(session, { type: 'session.execution.interrupted', data: { sessionID } })
    return { ok: true }
  }
  rt.compactSession = async (sessionID: string) => {
    state.compactCount += 1
    persist()
    const session = sessions.get(sessionID)
    if (session) {
      session.messages.push({ id: nextMessageId('compact'), type: 'compaction', time: { created: Date.now() } })
      emit(session, { type: 'session.idle', data: { sessionID } })
    }
    return { ok: true }
  }
  rt.replyPermission = async (sessionID: string, id: string, decision: string) => {
    const session = sessions.get(sessionID)
    if (!session) return
    session.pending.permissions = []
    emit(session, { type: 'permission.replied', data: { sessionID, id, decision } })
    session.busy = true
    await streamAssistant(
      session,
      decision === 'reject' ? '已拒绝写入，未修改文件。' : '已允许写入，继续完成需求更新。',
      { chunks: 3, gap: 160 }
    )
  }
  rt.replyForm = async (sessionID: string, id: string, answer: unknown) => {
    const session = sessions.get(sessionID)
    if (!session) return
    session.pending.forms = []
    emit(session, { type: 'form.replied', data: { sessionID, id } })
    session.busy = true
    await streamAssistant(session, `表单已收到：${JSON.stringify(answer)}`, { chunks: 2, gap: 140 })
  }
}

async function main(): Promise<void> {
  persist()
  await installStub()
  await import('../src/index')

  const base = `http://127.0.0.1:${port}`
  for (let index = 0; index < 150; index += 1) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break
    } catch {
      // 等待监听
    }
    await delay(100)
  }

  // 建一个空需求应用（无模块，供空态场景）；P2_DESIGN_SYSTEM 可带设计系统（P7-6a）
  let designSystem: unknown = undefined
  if (designSystemEnv) {
    try {
      designSystem = JSON.parse(designSystemEnv)
    } catch {
      throw new Error(`P2_DESIGN_SYSTEM 不是合法 JSON：${designSystemEnv}`)
    }
  }
  const response = await fetch(`${base}/api/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: appId,
      name: appName,
      requirementTemplateId: 'builtin-prd-lite',
      ...(designSystem ? { designSystem } : {})
    })
  })
  const created = (await response.json()) as { app?: { id: string }; warnings?: string[] }
  if (!response.ok) throw new Error(`创建应用失败（HTTP ${response.status}）：${JSON.stringify(created)}`)
  if (created.warnings?.length) console.warn('[p2-harness] 创建告警：', created.warnings.join('；'))
  state.ready = true
  persist()
  console.log(`[p2-harness] ready http://127.0.0.1:${port}/#/apps/${appId}/requirements`)
  console.log(`[p2-harness] state=${stateFile}`)
}

main().catch(error => {
  console.error('[p2-harness] 启动失败：', error instanceof Error ? error.message : error)
  process.exit(1)
})
