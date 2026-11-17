/**
 * OpencodeRuntime：工作台拥有的单个 opencode serve 进程
 *
 * 职责：
 * - serve 生命周期（启动/停止/状态/自动捕获密码）
 * - 模型/agent 列表、默认模型
 * - 会话创建/查询/删除、prompt、消息、中断
 * - 权限询问/表单询问
 * - 事件流（SSE）解析 + 按 sessionID/目录过滤后广播
 *
 * 边界：
 * - 不保存、不代理模型 API Key；provider/model 由 opencode 自身配置管理
 * - serve 密码只在内存，日志统一脱敏
 * - 不把工作台自己的环境变量（RG_、LLM_、WORKBENCH_、WB_ 前缀）传给 serve
 */
import { execFile, execFileSync, spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { config, workbenchInstanceId } from '../config'
import { OpencodeClient } from './client'
import {
  EventHub,
  createSseParser,
  type EventFilter,
  type EventListener,
  type OpencodeEvent
} from './events'
import { PasswordScanner } from './password'
import { redact, registerSecret } from './redact'

export interface OpencodeModel {
  id: string
  providerID: string
  modelID: string
  name: string
  status?: string
  enabled?: boolean
  variants: string[]
  limit?: unknown
  capabilities?: unknown
  cost?: unknown
  released?: number
}

export interface OpencodeAgent {
  id: string
  mode?: string
  hidden?: boolean
  description?: string
  model?: unknown
  permissions?: unknown[]
}

export interface OpencodeSession {
  id: string
  title?: string
  agent?: string
  model?: unknown
  location?: { directory?: string }
  time?: unknown
  [key: string]: unknown
}

export interface CreateSessionInput {
  directory: string
  title?: string
  agent?: string
  model?: { providerID: string; id: string; variant?: string | null } | null
}

export interface SessionMessages {
  data: unknown[]
  cursor?: unknown
}

export interface GenerateTextInput {
  directory: string
  prompt: string
  agent?: string
  model?: { providerID: string; id: string; variant?: string | null } | null
  timeoutMs?: number
  signal?: AbortSignal
  onDelta?: (delta: string) => void
}

export interface SessionModelRef {
  providerID: string
  id: string
  variant?: string
}

/** 从 opencode 会话/消息里的 model 字段提取模型引用 */
export function sessionModelRef(raw: unknown): SessionModelRef | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const providerID = typeof value.providerID === 'string' ? value.providerID : ''
  const id = typeof value.id === 'string' ? value.id : typeof value.modelID === 'string' ? value.modelID : ''
  if (!providerID || !id) return null
  return {
    providerID,
    id,
    ...(typeof value.variant === 'string' && value.variant ? { variant: value.variant } : {})
  }
}

export type StreamState = 'idle' | 'connecting' | 'open' | 'closed'

export interface OpencodeStatus {
  ready: boolean
  starting: boolean
  installed: boolean | null
  autoStart: boolean
  autoStartAttempted: boolean
  host: string
  port: number
  baseUrl: string
  bin: string | null
  version: string | null
  passwordCaptured: boolean
  streamState: StreamState
  lastEventAt: string | null
  lastError: string | null
  installError: string | null
  pendingSessions: number
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function logInfo(message: string): void {
  console.log(`[opencode] ${redact(message)}`)
}

function logWarn(message: string): void {
  console.warn(`[opencode] ${redact(message)}`)
}

/** 从 npm 的 .cmd/.bat shim 中解析真实 exe，避免把 cmd.exe 当作子进程导致清理不彻底 */
function resolveShimTarget(shimPath: string): string | null {
  try {
    const content = fs.readFileSync(shimPath, 'utf8')
    const match = content.match(/"(?:%dp0%|%~dp0)\\([^"]+\.exe)"/i)
    if (!match) return null
    const candidate = path.join(path.dirname(shimPath), match[1])
    return fs.existsSync(candidate) ? candidate : null
  } catch {
    return null
  }
}

/** 查找 opencode 可执行文件；显式 OPENCODE_BIN 优先，其次 PATH 中的 opencode(.exe/.cmd) */
export function resolveOpencodeBin(explicit?: string | null): string {
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error(`OPENCODE_BIN 不存在：${explicit}`)
    if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(explicit)) {
      return resolveShimTarget(explicit) ?? explicit
    }
    return explicit
  }
  const names = process.platform === 'win32' ? ['opencode.exe', 'opencode.cmd', 'opencode.bat'] : ['opencode']
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const full = path.join(dir, name)
      if (!fs.existsSync(full)) continue
      if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(full)) {
        return resolveShimTarget(full) ?? full
      }
      return full
    }
  }
  throw new Error('未找到 opencode 可执行文件；请安装 opencode 或设置 OPENCODE_BIN')
}

/** serve 只需要工具链与 opencode 自身配置；工作台密钥不进入子进程环境 */
export function buildServeEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  const blocked = /^(RG_|LLM_|WORKBENCH_|WB_|OPENCODE_PORT$|PORT$)/
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue
    if (blocked.test(key)) continue
    env[key] = value
  }
  return env
}

export function sanitizeModel(raw: unknown): OpencodeModel | null {
  if (!raw || typeof raw !== 'object') return null
  const model = raw as Record<string, unknown>
  const providerID = typeof model.providerID === 'string' ? model.providerID : ''
  const modelID = typeof model.modelID === 'string' ? model.modelID : typeof model.id === 'string' ? model.id : ''
  if (!providerID || !modelID) return null
  const variants = Array.isArray(model.variants)
    ? model.variants.map(variant => (variant && typeof variant === 'object' ? String((variant as { id?: unknown }).id ?? '') : '')).filter(Boolean)
    : []
  const time = model.time && typeof model.time === 'object' ? (model.time as Record<string, unknown>) : null
  return {
    id: typeof model.id === 'string' ? model.id : modelID,
    providerID,
    modelID,
    name: typeof model.name === 'string' ? model.name : modelID,
    ...(typeof model.status === 'string' ? { status: model.status } : {}),
    ...(typeof model.enabled === 'boolean' ? { enabled: model.enabled } : {}),
    variants,
    ...(model.limit !== undefined ? { limit: model.limit } : {}),
    ...(model.capabilities !== undefined ? { capabilities: model.capabilities } : {}),
    ...(model.cost !== undefined ? { cost: model.cost } : {}),
    ...(time && typeof time.released === 'number' ? { released: time.released } : {})
  }
}

export class OpencodeRuntime {
  readonly events: EventHub
  private readonly client: OpencodeClient
  private readonly baseUrl: string
  private child: ChildProcess | null = null
  private password: string | null = null
  private scanner: PasswordScanner | null = null
  private ready = false
  private stopping = false
  private startPromise: Promise<void> | null = null
  private streamAbort: AbortController | null = null
  private streamTimer: NodeJS.Timeout | null = null
  private streamRetries = 0
  private streamState: StreamState = 'idle'
  private lastEventAt: string | null = null
  private lastError: string | null = null
  private version: string | null = null
  private bin: string | null = null
  private installed: boolean | null = null
  private installError: string | null = null
  private autoStartAttempted = false
  private stderrTail: string[] = []
  private readonly pending = new Map<string, { permissions: unknown[]; forms: unknown[] }>()
  private readonly tracked = new Set<string>()
  private pollTimer: NodeJS.Timeout | null = null

  constructor() {
    this.baseUrl = `http://${config.opencode.host}:${config.opencode.port}`
    this.client = new OpencodeClient(this.baseUrl, () => this.password)
    this.events = new EventHub(config.opencode.eventBufferSize)
  }

  status(): OpencodeStatus {
    return {
      ready: this.ready,
      starting: Boolean(this.startPromise),
      installed: this.installed,
      autoStart: config.opencode.autoStart,
      autoStartAttempted: this.autoStartAttempted,
      host: config.opencode.host,
      port: config.opencode.port,
      baseUrl: this.baseUrl,
      bin: this.bin ? path.basename(this.bin) : null,
      version: this.version,
      passwordCaptured: Boolean(this.password),
      streamState: this.streamState,
      lastEventAt: this.lastEventAt,
      lastError: this.lastError,
      installError: this.installError,
      pendingSessions: [...this.pending.values()].filter(v => v.permissions.length || v.forms.length).length
    }
  }

  /**
   * 首页/启动时自动探测本机 opencode：
   * - 只探测一次 CLI（resolveOpencodeBin），失败记录 installError；
   * - 已安装且 serve 未就绪时，自动拉起一次（OPENCODE_AUTO_START=false 可关闭）；
   * - 不阻塞调用方，启动进度通过 status().starting/ready 反映。
   */
  autoDetect(): void {
    if (this.ready || this.startPromise) return
    if (this.installed === null) {
      try {
        this.bin = resolveOpencodeBin(config.opencode.bin)
        this.installed = true
        this.installError = null
      } catch (error) {
        this.installed = false
        this.installError = error instanceof Error ? error.message : String(error)
        return
      }
    }
    if (!this.installed || !config.opencode.autoStart || this.autoStartAttempted) return
    this.autoStartAttempted = true
    void this.ensureStarted().catch(error => {
      this.lastError = redact(error instanceof Error ? error.message : String(error))
      logWarn(`自动启动 opencode 失败：${this.lastError}`)
    })
  }

  async ensureStarted(): Promise<void> {
    if (this.ready) return
    if (!this.startPromise) {
      this.startPromise = this.start().finally(() => {
        this.startPromise = null
      })
    }
    await this.startPromise
  }

  // ---- 进程生命周期 ----

  private pidFile(): string {
    return path.join(config.dataDir, `opencode-serve-${config.opencode.port}.json`)
  }

  private writePidFile(pid: number | undefined): void {
    if (!pid) return
    try {
      fs.mkdirSync(config.dataDir, { recursive: true })
      fs.writeFileSync(this.pidFile(), JSON.stringify({ pid, port: config.opencode.port, startedAt: new Date().toISOString() }))
    } catch {
      // pid 文件只用于清理残留进程，写入失败不影响主流程
    }
  }

  private clearPidFile(): void {
    try {
      fs.unlinkSync(this.pidFile())
    } catch {
      // 文件不存在
    }
  }

  private readPidFile(): { pid: number; port: number } | null {
    try {
      const data = JSON.parse(fs.readFileSync(this.pidFile(), 'utf8')) as { pid?: unknown; port?: unknown }
      return typeof data.pid === 'number' && typeof data.port === 'number' ? { pid: data.pid, port: data.port } : null
    } catch {
      return null
    }
  }

  /** 只清理本工作台上次遗留的 opencode serve（用 pid 文件 + 进程名双重校验） */
  private reapStaleServe(): void {
    const record = this.readPidFile()
    if (!record) return
    if (record.port !== config.opencode.port || !this.isOpencodeProcess(record.pid)) {
      this.clearPidFile()
      return
    }
    logWarn(`清理上次残留的 serve（pid=${record.pid}）`)
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/PID', String(record.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      } else {
        process.kill(record.pid, 'SIGKILL')
      }
    } catch {
      // 进程可能已退出
    }
    this.clearPidFile()
  }

  private isOpencodeProcess(pid: number): boolean {
    try {
      if (process.platform === 'win32') {
        const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
          encoding: 'utf8',
          windowsHide: true
        })
        return /opencode/i.test(out)
      }
      const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8')
      return /opencode/i.test(cmdline)
    } catch {
      return false
    }
  }

  private async portInUse(): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/api/info`, { signal: AbortSignal.timeout(1500) })
      return true
    } catch {
      return false
    }
  }

  /** 是否有另一个工作台后端在 config.port 上运行（用于避免误杀它拥有的 serve） */
  private async workbenchAlive(): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:${config.port}/api/health`, { signal: AbortSignal.timeout(1500) })
      if (!response.ok) return false
      const data = (await response.json()) as { instanceId?: unknown }
      return typeof data.instanceId === 'string' && data.instanceId !== workbenchInstanceId
    } catch {
      return false
    }
  }

  async start(): Promise<void> {
    if (this.ready) return
    this.stopping = false
    this.lastError = null
    this.stderrTail = []
    this.bin = resolveOpencodeBin(config.opencode.bin)
    this.installed = true
    this.installError = null
    this.password = null
    this.scanner = new PasswordScanner()

    fs.mkdirSync(config.projectsDir, { recursive: true })

    const occupied = await this.portInUse()
    if (occupied) {
      if (await this.workbenchAlive()) {
        throw new Error(`serve 端口 ${config.opencode.port} 已被另一个工作台实例使用；请先停止它，或改用 OPENCODE_PORT`)
      }
      // 没有工作台后端响应：视为上次异常退出留下的 serve，按 pid 文件清理
      this.reapStaleServe()
      if (await this.portInUse()) {
        throw new Error(
          `端口 ${config.opencode.port} 已被其他进程占用（不是本工作台登记的 serve）。请结束占用进程或设置 OPENCODE_PORT 后重试`
        )
      }
    } else {
      this.reapStaleServe()
    }

    const args = ['serve', '--port', String(config.opencode.port), '--hostname', config.opencode.host]
    logInfo(`启动 serve：${path.basename(this.bin)} ${args.join(' ')}（cwd=${config.projectsDir}）`)

    const needsShell = /\.(cmd|bat)$/i.test(this.bin)
    const spawnOptions: SpawnOptions = {
      cwd: config.projectsDir,
      windowsHide: true,
      env: buildServeEnv(),
      stdio: ['ignore', 'pipe', 'pipe']
    }
    const child = needsShell
      ? spawn(`"${this.bin}" ${args.join(' ')}`, { ...spawnOptions, shell: true })
      : spawn(this.bin, args, spawnOptions)
    this.child = child
    this.writePidFile(child.pid)

    const capture = (chunk: Buffer): void => {
      if (this.password || !this.scanner) return
      const password = this.scanner.feed(chunk.toString('utf8'))
      if (password) {
        this.password = registerSecret(password)
        logInfo('serve 密码已捕获（仅内存保存）')
      }
    }

    child.stdout?.on('data', capture)
    child.stderr?.on('data', chunk => {
      capture(chunk)
      const text = redact(chunk.toString('utf8')).trim()
      if (!text) return
      this.stderrTail.push(text.slice(0, 800))
      if (this.stderrTail.length > 20) this.stderrTail.shift()
      logWarn(`serve stderr：${text.slice(0, 800)}`)
    })
    child.on('exit', (code, signal) => {
      // 旧子进程在 stop/restart 后退出时，不要覆盖新 serve 的状态
      if (this.child !== child) return
      this.ready = false
      this.streamState = 'closed'
      if (!this.stopping) {
        this.lastError = `opencode serve 意外退出（code=${code ?? 'null'}, signal=${signal ?? 'null'}）`
        logWarn(this.lastError)
      }
      this.clearPidFile()
    })

    const deadline = Date.now() + config.opencode.startTimeoutMs
    while (Date.now() < deadline) {
      if (this.child && this.child.exitCode !== null) {
        const tail = this.stderrTail.slice(-3).join(' | ')
        throw new Error(`opencode serve 启动失败（code=${this.child.exitCode}）${tail ? `：${tail}` : ''}`)
      }
      if (this.password) {
        const info = await this.client
          .request<{ version?: string }>('GET', '/api/info', { timeoutMs: 3000 })
          .catch(() => null)
        if (info?.ok) {
          this.ready = true
          this.version = typeof info.data?.version === 'string' ? info.data.version : null
          logInfo(`serve 就绪：v${this.version ?? '?'} port=${config.opencode.port}`)
          this.startEventStream()
          this.startPolling()
          return
        }
      }
      await delay(250)
    }
    await this.killChild()
    this.clearPidFile()
    throw new Error(`opencode serve 未在 ${config.opencode.startTimeoutMs}ms 内就绪（host=${config.opencode.host}:${config.opencode.port}）`)
  }

  async stop(): Promise<void> {
    this.stopping = true
    this.ready = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.streamTimer) {
      clearTimeout(this.streamTimer)
      this.streamTimer = null
    }
    this.streamAbort?.abort()
    this.streamAbort = null
    this.streamState = 'idle'
    await this.killChild()
    this.child = null
    this.clearPidFile()
    this.password = null
    this.scanner = null
    this.version = null
    this.pending.clear()
    this.tracked.clear()
  }

  private async killChild(): Promise<void> {
    const child = this.child
    if (!child || child.exitCode !== null) return
    if (process.platform === 'win32') {
      await new Promise<void>(resolve => {
        execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => resolve())
      })
    } else {
      child.kill('SIGTERM')
    }
    this.child = null
  }

  /** 进程退出时的同步清理（不能 await 的场景，例如 process 'exit'） */
  stopSync(): void {
    this.stopping = true
    this.ready = false
    this.streamAbort?.abort()
    const child = this.child
    if (child && child.exitCode === null) {
      try {
        if (process.platform === 'win32') {
          execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
        } else {
          child.kill('SIGKILL')
        }
      } catch {
        // 进程可能已退出
      }
    }
    this.child = null
    this.clearPidFile()
  }

  // ---- 模型 / agent ----

  async listModels(directory?: string): Promise<OpencodeModel[]> {
    await this.ensureStarted()
    const result = await this.client.request<{ data?: unknown[] }>('GET', '/api/model', {
      query: {
        types: 'chat',
        ...(directory ? { 'location[directory]': directory } : {})
      }
    })
    if (!result.ok) throw this.httpError('读取模型列表', result.status, result.text)
    return (result.data?.data ?? []).map(sanitizeModel).filter((model): model is OpencodeModel => Boolean(model))
  }

  async defaultModel(directory?: string): Promise<OpencodeModel | null> {
    await this.ensureStarted()
    if (config.opencode.defaultModel) {
      const wanted = config.opencode.defaultModel
      const models = await this.listModels(directory).catch(() => [])
      const found = models.find(model => `${model.providerID}/${model.modelID}` === wanted || `${model.providerID}/${model.id}` === wanted)
      if (found) return found
      logWarn(`OPENCODE_DEFAULT_MODEL=${wanted} 未在模型列表中，回退 opencode 默认模型`)
    }
    const result = await this.client.request<{ data?: unknown }>('GET', '/api/model/default', {
      query: directory ? { 'location[directory]': directory } : undefined
    })
    if (!result.ok) throw this.httpError('读取默认模型', result.status, result.text)
    return sanitizeModel(result.data?.data)
  }

  /**
   * opencode CLI 最近一次会话使用的模型。
   * 新应用未显式选择模型时用它作为默认，避免回退到随机/额度已尽的免费模型。
   */
  async lastUsedModel(directory?: string): Promise<{ model: OpencodeModel; variant?: string } | null> {
    await this.ensureStarted()
    const sessions = await this.listSessions(undefined, 8).catch(() => [])
    if (!sessions.length) return null
    const models = await this.listModels(directory).catch(() => [])
    if (!models.length) return null
    for (const session of sessions) {
      const ref = sessionModelRef(session.model)
      if (!ref) continue
      const found = models.find(model => model.providerID === ref.providerID && (model.modelID === ref.id || model.id === ref.id))
      if (found) return { model: found, ...(ref.variant ? { variant: ref.variant } : {}) }
    }
    return null
  }

  async listAgents(directory?: string): Promise<OpencodeAgent[]> {
    await this.ensureStarted()
    const result = await this.client.request<{ data?: unknown[] }>('GET', '/api/agent', {
      query: directory ? { 'location[directory]': directory } : undefined
    })
    if (!result.ok) throw this.httpError('读取 agent 列表', result.status, result.text)
    return (result.data?.data ?? [])
      .map(raw => {
        if (!raw || typeof raw !== 'object') return null
        const agent = raw as Record<string, unknown>
        if (typeof agent.id !== 'string') return null
        return {
          id: agent.id,
          ...(typeof agent.mode === 'string' ? { mode: agent.mode } : {}),
          ...(typeof agent.hidden === 'boolean' ? { hidden: agent.hidden } : {}),
          ...(typeof agent.description === 'string' ? { description: agent.description } : {}),
          ...(agent.model !== undefined ? { model: agent.model } : {}),
          ...(Array.isArray(agent.permissions) ? { permissions: agent.permissions } : {})
        }
      })
      .filter((agent): agent is OpencodeAgent => Boolean(agent))
  }

  /** 让 opencode 重新加载 location 配置（新建应用的 .opencode/agents 可能需要） */
  async reloadLocations(): Promise<void> {
    await this.ensureStarted()
    const result = await this.client.request('POST', '/api/location/reload')
    if (!result.ok) throw this.httpError('重载 opencode 配置', result.status, result.text)
  }

  /** 确保目录下存在指定 agent；新应用首次对话时 opencode 可能尚未加载目录配置 */
  async ensureAgent(directory: string, agent: string): Promise<void> {
    const has = async (): Promise<boolean> => (await this.listAgents(directory).catch(() => [])).some(item => item.id === agent)
    if (await has()) return
    await this.reloadLocations().catch(() => undefined)
    if (!(await has())) throw new Error(`opencode 未加载 agent「${agent}」（目录：${directory}）`)
  }

  // ---- 会话 ----

  async createSession(input: CreateSessionInput): Promise<OpencodeSession> {
    await this.ensureStarted()
    const result = await this.client.request<{ data?: OpencodeSession }>('POST', '/api/session', {
      body: {
        title: input.title,
        agent: input.agent || 'build',
        ...(input.model ? { model: input.model } : {}),
        location: { directory: input.directory }
      }
    })
    if (!result.ok || !result.data?.data) throw this.httpError('创建会话', result.status, result.text)
    this.track(result.data.data.id)
    return result.data.data
  }

  async session(sessionId: string): Promise<OpencodeSession | null> {
    await this.ensureStarted()
    const result = await this.client.request<{ data?: OpencodeSession }>('GET', `/api/session/${encodeURIComponent(sessionId)}`)
    if (!result.ok) {
      if (result.status === 404) return null
      throw this.httpError('读取会话', result.status, result.text)
    }
    return result.data?.data ?? null
  }

  async listSessions(directory?: string, limit = 50): Promise<OpencodeSession[]> {
    await this.ensureStarted()
    const result = await this.client.request<{ data?: OpencodeSession[] }>('GET', '/api/session', {
      query: { limit: String(limit), order: 'desc', ...(directory ? { directory } : {}) }
    })
    if (!result.ok) throw this.httpError('读取会话列表', result.status, result.text)
    return result.data?.data ?? []
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureStarted()
    const result = await this.client.request('DELETE', `/api/session/${encodeURIComponent(sessionId)}`)
    if (!result.ok && result.status !== 404) throw this.httpError('删除会话', result.status, result.text)
    this.pending.delete(sessionId)
    this.tracked.delete(sessionId)
  }

  async prompt(sessionId: string, text: string, delivery?: string): Promise<unknown> {
    await this.ensureStarted()
    const result = await this.client.request('POST', `/api/session/${encodeURIComponent(sessionId)}/prompt`, {
      body: { text, ...(delivery ? { delivery } : {}) }
    })
    if (!result.ok) throw this.httpError('发送消息', result.status, result.text)
    this.track(sessionId)
    return result.data
  }

  async messages(sessionId: string, options: { limit?: number; order?: 'asc' | 'desc' } = {}): Promise<SessionMessages> {
    await this.ensureStarted()
    const result = await this.client.request<SessionMessages>('GET', `/api/session/${encodeURIComponent(sessionId)}/message`, {
      query: { limit: String(options.limit ?? 100), order: options.order ?? 'asc' }
    })
    if (!result.ok) throw this.httpError('读取会话消息', result.status, result.text)
    return { data: result.data?.data ?? [], ...(result.data?.cursor !== undefined ? { cursor: result.data.cursor } : {}) }
  }

  async interrupt(sessionId: string, resume = true): Promise<unknown> {
    await this.ensureStarted()
    const result = await this.client.request('POST', `/api/session/${encodeURIComponent(sessionId)}/interrupt`, {
      query: { resume: String(resume) }
    })
    if (!result.ok) throw this.httpError('中断会话', result.status, result.text)
    return result.data
  }

  /**
   * I-09a：opencode 原生上下文压缩（compact）。
   * 只做一次请求，不自研摘要；成功后会写入一条 type='compaction' 的消息。
   */
  async compactSession(sessionId: string): Promise<unknown> {
    await this.ensureStarted()
    const result = await this.client.request('POST', `/api/session/${encodeURIComponent(sessionId)}/compact`, {
      body: {}
    })
    if (!result.ok) throw this.httpError('压缩上下文', result.status, result.text)
    return result.data
  }

  /**
   * 一次性文本生成：短暂会话 + prompt + 收集 assistant 文本 + 删除会话。
   * 用于需求分析/测试用例等非交互任务；调用方负责解析 JSON。
   */
  async generateText(input: GenerateTextInput): Promise<string> {
    await this.ensureStarted()
    if (input.signal?.aborted) throw new Error('AI 生成已中止')
    if (input.agent) await this.ensureAgent(input.directory, input.agent)
    const session = await this.createSession({
      directory: input.directory,
      title: `transient-${Date.now()}`,
      agent: input.agent,
      model: input.model ?? null
    })

    const chunks: string[] = []
    let finalText = ''
    let settled = false
    let timer: NodeJS.Timeout | null = null
    let unsubscribe: () => void = () => undefined
    let onAbort: () => void = () => undefined
    let resolveOutcome: ((text: string) => void) | null = null
    let rejectOutcome: ((error: Error) => void) | null = null

    const outcome = new Promise<string>((resolve, reject) => {
      resolveOutcome = resolve
      rejectOutcome = reject
    })
    // 事件可能在 prompt 的 await 返回前就失败；先挂一个空 catch，避免未处理 rejection
    void outcome.catch(() => undefined)

    const cleanup = (): void => {
      if (timer) clearTimeout(timer)
      timer = null
      input.signal?.removeEventListener('abort', onAbort)
      unsubscribe()
    }

    const finish = (error?: Error, text?: string): void => {
      if (settled) return
      settled = true
      cleanup()
      if (error) rejectOutcome?.(error)
      else resolveOutcome?.(text ?? (finalText || chunks.join('')))
    }

    onAbort = () => {
      void this.interrupt(session.id, false).catch(() => undefined)
      finish(new Error('AI 生成已中止'))
    }

    unsubscribe = this.subscribe({ sessionID: session.id }, event => {
      const type = event.type
      if (type === 'session.text.delta') {
        const delta = String(event.data?.delta ?? '')
        if (!delta) return
        chunks.push(delta)
        input.onDelta?.(delta)
        return
      }
      if (type === 'session.text.ended') {
        finalText = String(event.data?.text ?? '')
        return
      }
      if (type === 'session.execution.succeeded' || type === 'session.idle') {
        finish(undefined, finalText || chunks.join(''))
        return
      }
      if (type === 'session.execution.failed') {
        finish(new Error(`模型执行失败：${JSON.stringify(event.data ?? {})}`))
        return
      }
      if (type === 'session.execution.interrupted') {
        finish(new Error('AI 生成已中止'))
      }
    })

    const timeoutMs = input.timeoutMs ?? 600000
    timer = setTimeout(() => {
      void this.interrupt(session.id, false).catch(() => undefined)
      finish(new Error(`AI 生成超时（${Math.round(timeoutMs / 1000)} 秒）`))
    }, timeoutMs)
    timer.unref?.()
    input.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      await this.prompt(session.id, input.prompt)
      return await outcome
    } finally {
      cleanup()
      await this.deleteSession(session.id).catch(() => undefined)
    }
  }

  // ---- 权限 / 表单 ----

  async permissions(sessionId: string): Promise<unknown[]> {
    await this.ensureStarted()
    const result = await this.client.request<{ data?: unknown[] }>('GET', `/api/session/${encodeURIComponent(sessionId)}/permission`)
    if (!result.ok) throw this.httpError('读取权限询问', result.status, result.text)
    return result.data?.data ?? []
  }

  async forms(sessionId: string): Promise<unknown[]> {
    await this.ensureStarted()
    const result = await this.client.request<{ data?: unknown[] }>('GET', `/api/session/${encodeURIComponent(sessionId)}/form`)
    if (!result.ok) throw this.httpError('读取表单询问', result.status, result.text)
    return result.data?.data ?? []
  }

  async replyPermission(sessionId: string, requestId: string, decision: string, message?: string): Promise<void> {
    await this.ensureStarted()
    const result = await this.client.request('POST', `/api/session/${encodeURIComponent(sessionId)}/permission/${encodeURIComponent(requestId)}/reply`, {
      body: { decision, ...(message ? { message } : {}) }
    })
    if (!result.ok) throw this.httpError('回复权限询问', result.status, result.text)
    await this.refreshPending(sessionId)
  }

  async replyForm(sessionId: string, formId: string, answer: unknown): Promise<void> {
    await this.ensureStarted()
    const result = await this.client.request('POST', `/api/session/${encodeURIComponent(sessionId)}/form/${encodeURIComponent(formId)}/reply`, {
      body: { answer }
    })
    if (!result.ok) throw this.httpError('回复表单询问', result.status, result.text)
    await this.refreshPending(sessionId)
  }

  pendingFor(sessionId: string): { permissions: unknown[]; forms: unknown[] } {
    return this.pending.get(sessionId) ?? { permissions: [], forms: [] }
  }

  track(sessionId: string): void {
    this.tracked.add(sessionId)
    void this.refreshPending(sessionId).catch(() => undefined)
  }

  async refreshPending(sessionId: string): Promise<void> {
    if (!this.ready) return
    const [permissions, forms] = await Promise.all([this.permissions(sessionId), this.forms(sessionId)])
    const next = { permissions, forms }
    const previous = this.pending.get(sessionId)
    const changed = JSON.stringify(previous ?? null) !== JSON.stringify(next)
    this.pending.set(sessionId, next)
    // 首次空状态不广播，避免会话一开始就产生无意义的 pending 事件
    if (changed && (previous || permissions.length || forms.length)) {
      this.events.publish({
        type: 'host.pending.updated',
        created: Date.now(),
        data: { sessionID: sessionId, ...next }
      })
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return
    // SSE 的兜底：事件流断开时仍能发现待处理询问
    this.pollTimer = setInterval(() => {
      for (const sessionId of this.tracked) {
        void this.refreshPending(sessionId).catch(() => undefined)
      }
    }, 5000)
    this.pollTimer.unref?.()
  }

  // ---- 事件流 ----

  subscribe(filter: EventFilter, listener: EventListener): () => void {
    return this.events.subscribe(filter, listener)
  }

  private startEventStream(): void {
    if (this.stopping || !this.password) return
    const controller = new AbortController()
    this.streamAbort = controller
    this.streamState = 'connecting'
    const parser = createSseParser(event => this.handleEvent(event))

    void this.client
      .openStream('/api/event', undefined, controller.signal)
      .then(async response => {
        this.streamState = 'open'
        this.streamRetries = 0
        logInfo('事件流已连接')
        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          parser.push(decoder.decode(value, { stream: true }))
        }
        parser.flush()
        throw new Error('事件流结束')
      })
      .catch(error => {
        if (this.stopping) return
        this.streamState = 'closed'
        const wait = Math.min(30000, 1000 * 2 ** Math.min(this.streamRetries++, 5))
        logWarn(`事件流断开（${error instanceof Error ? error.message : String(error)}），${wait}ms 后重连`)
        this.streamTimer = setTimeout(() => this.startEventStream(), wait)
        this.streamTimer.unref?.()
      })
  }

  private handleEvent(event: OpencodeEvent): void {
    this.lastEventAt = new Date().toISOString()
    const type = event.type
    const data = event.data ?? {}
    const sessionId = typeof data.sessionID === 'string' ? data.sessionID : typeof data.sessionId === 'string' ? data.sessionId : null

    if (sessionId && (type.startsWith('session.') || type.startsWith('permission.') || type.startsWith('form.'))) {
      this.tracked.add(sessionId)
    }
    if (sessionId && ['permission.asked', 'permission.replied', 'form.created', 'form.replied', 'form.cancelled'].includes(type)) {
      void this.refreshPending(sessionId).catch(() => undefined)
    }
    this.events.publish(event)
  }

  private httpError(action: string, status: number, text: string): Error & { status?: number } {
    const detail = redact(text).slice(0, 400)
    const error = new Error(`${action}失败（HTTP ${status}）${detail ? `：${detail}` : ''}`) as Error & { status?: number }
    // 4xx 原样透出（目录/参数/权限 ID 等），5xx 与网络错误统一为 502
    error.status = status >= 400 && status < 500 ? status : 502
    return error
  }
}

/** 进程级单例：一个 serve 服务多个项目目录 */
export const opencode = new OpencodeRuntime()
