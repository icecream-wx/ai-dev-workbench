/**
 * 开发会话时间线归一化（P4）
 *
 * 把 opencode 原始消息裁剪/脱敏为浏览器可安全渲染的：
 * - 用户/assistant 文本
 * - 工具卡（目标、状态、输出、diff、错误）
 * - 按阶段聚合的步骤（读取/实现/构建/测试/执行/提交）
 *
 * 参考旧 workbench-stub 的 progress.js，但只保留新开发页需要的最小契约。
 * 不向浏览器发送原始 tool payload；输出有长度上限。
 */
import path from 'node:path'
import { redact, redactDeep } from '../opencode/redact'
import { lastIdleMessage, sessionCompletion } from '../opencode/session-state'

export const LIMITS = {
  toolOutput: 20000,
  diff: 50000,
  inputString: 12000,
  totalChars: 1200000,
  maxMessages: 200,
  maxSteps: 300
}

const PHASE_LABELS: Record<string, string> = {
  analysis: '需求理解',
  implement: '实现',
  build: '构建',
  test: '测试',
  deliver: '提交',
  run: '执行'
}

const WRITE_TOOLS = new Set(['write', 'edit', 'patch', 'multiedit', 'apply_patch'])
const READ_TOOLS = new Set(['read', 'glob', 'grep', 'list', 'ls'])
const SHELL_TOOLS = new Set(['shell', 'bash'])

const DELIVER_RE = /\bgit\s+(?:commit|push|merge|rebase|tag|cherry-pick)\b/i
const TEST_RE = /\b(?:mvn(?:w|\.cmd)?\b[^\n]{0,300}\b(?:test|verify)|npm\s+(?:run\s+)?test|npx\s+(?:vitest|jest)|playwright\s+test|vitest|jest|junit)\b/i
const BUILD_RE = /\b(?:mvn(?:w|\.cmd)?\b[^\n]{0,300}\b(?:package|install|compile|clean|assemble)|npm\s+(?:run\s+)?(?:build|ci|install)|pnpm\s+build|yarn\s+build|vite\s+build|tsc|gradle(?:w)?\b[^\n]{0,300}\b(?:build|assemble)|javac)\b/i
const VCS_READ_RE = /\bgit\s+(?:status|log|diff|show|branch|remote|rev-parse|fetch|checkout|switch|stash)\b/i

export interface DevToolOutput {
  text: string
  truncated: boolean
  originalChars?: number
  keptChars?: number
  mode?: 'head' | 'tail'
  exit?: number | null
  status?: string | null
}

export interface DevToolDiff {
  mode: 'create' | 'replace'
  path?: string | null
  added: number
  removed: number
  text: string
  truncated: boolean
}

export interface DevToolItem {
  type: 'tool' | 'shell'
  id: string | null
  messageId: string | null
  name: string
  status: string
  target: string | null
  input: Record<string, unknown>
  inputTruncated?: boolean
  output: DevToolOutput
  diff: DevToolDiff | null
  error: { type?: string; message?: string; status?: number | null } | null
  metadata?: Record<string, unknown>
  time: { created: number | null; ran: number | null; completed: number | null }
  durationMs: number | null
}

export interface DevStep {
  id: string
  kind: 'tools'
  title: string
  phase: string
  status: 'completed' | 'running' | 'failed'
  startedAt: number | null
  endedAt: number | null
  durationMs: number | null
  toolCount: number
  targets: string[]
  items: DevToolItem[]
}

export interface DevSessionMessage {
  id: string
  type: string
  created: number | null
  /** I-09a：compaction 等系统提示的种类（不当作 assistant 文本） */
  kind?: 'compaction' | 'compaction-failed'
  text?: string
  reasoning?: string
  streaming?: boolean
  tools?: Array<{ id: string | null; name: string; status: string | null; title?: string | null; target: string | null; durationMs: number | null }>
  command?: string
  status?: string | null
  exit?: number | null
  output?: DevToolOutput
  outcome?: string | null
  error?: unknown
  agent?: string | null
  model?: unknown
  finish?: string | null
  cost?: number | null
  tokens?: unknown
  time?: unknown
}

export type DevContextLevel = 'ok' | 'warn' | 'danger' | 'unknown'

/**
 * I-09a：会话上下文健康度（按模型上下文上限的百分比）。
 * `used` 由最新 assistant 消息的 tokens 推算；`limit/percent/level` 由 dev/service 补模型上限。
 */
export interface DevContextUsage {
  /** 最新 assistant 消息的上下文 token（input + cache.read + cache.write，近似值） */
  used: number
  /** 模型上下文上限（opencode listModels 的 limit.context）；未知为 null */
  limit: number | null
  /** used / limit；limit 未知为 null */
  percent: number | null
  level: DevContextLevel
}

export interface DevProgress {
  status: string
  startedAt: number | null
  endedAt: number | null
  elapsedMs: number | null
  context: DevContextUsage
  stats: {
    tokens: { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number }
    cost: number
    toolCounts: Record<string, number>
    toolTotal: number
    failedTools: number
    messageCount: number
    partial: boolean
    steps: number
    stepsTruncated: boolean
    droppedSteps: number
  }
  phase: { key: string; label: string; startedAt: number | null; history: Array<{ key: string; label: string; startedAt: number | null; endedAt: number | null }> }
  steps: DevStep[]
  messages: DevSessionMessage[]
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function scrubText(value: unknown): string {
  if (value === null || value === undefined) return ''
  let out = redact(value)
  out = out.replace(/(Authorization\s*:\s*(?:Basic|Bearer|Token)\s+)[^\s,;]+/gi, '$1***')
  out = out.replace(/\b([A-Z0-9_]*(?:TOKEN|PASSWORD|SECRET|API_KEY))\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, '$1=***')
  // XML 配置（如 EOS user-config.xml）：<configValue key="C3p0-Password">secret</configValue>
  out = out.replace(
    /(<configValue\s+key="[^"]*(?:password|passwd|secret|token|api[_-]?key)[^"]*"\s*>)[^<]*(<\/configValue>)/gi,
    '$1***$2'
  )
  out = out.replace(
    /(<(?:password|passwd|secret|token|api[_-]?key)[^>]*>)[^<]*(<\/(?:password|passwd|secret|token|api[_-]?key)>)/gi,
    '$1***$2'
  )
  // properties / JSON / YAML / 参数式密码
  out = out.replace(
    /((?:"|')?(?:password|passwd|secret|token|api[_-]?key)(?:"|')?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;<>]+)/gi,
    '$1***'
  )
  out = out.replace(/\b(https?:\/\/)([^/@\s]+)@/gi, '$1***@')
  return out
}

/**
 * 用户消息的展示文本。
 *
 * P2 起 `buildViewPrompt` 会在用户输入前拼一段“视图框架”（当前视图/产物路径/skill 提示），
 * 时间线不能把框架当用户原话展示：
 * - 仅当文本以 `当前视图：` 开头时，取**第一个** `\n用户消息：\n` 之后的内容；
 * - 找不到 marker / 不是框架开头 → 原样返回（不改用户原文，含换行与特殊字符）。
 */
export function displayUserText(text: string): string {
  const raw = typeof text === 'string' ? text : ''
  if (!raw.startsWith('当前视图：')) return raw
  const marker = '\n用户消息：\n'
  const index = raw.indexOf(marker)
  if (index < 0) return raw
  return raw.slice(index + marker.length)
}

export function truncateText(value: unknown, limit = LIMITS.toolOutput, mode: 'head' | 'tail' = 'tail'): DevToolOutput {
  const text = asText(value)
  const originalChars = text.length
  const kept = Math.max(0, Math.min(limit, originalChars))
  const truncated = originalChars > kept
  const out = !truncated ? text : mode === 'head' ? text.slice(0, kept) : text.slice(originalChars - kept)
  return { text: out, truncated, originalChars, keptChars: kept, mode }
}

export function toLines(value: unknown): string[] {
  const text = asText(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!text) return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** 有界行 diff：前后缀裁剪 + LCS；超大内容退化为全删全增 */
export function diffLines(
  oldValue: unknown,
  newValue: unknown,
  options: { maxChars?: number; maxCells?: number } = {}
): { added: number; removed: number; text: string; truncated: boolean } {
  const maxChars = options.maxChars ?? LIMITS.diff
  const maxCells = options.maxCells ?? 120000
  const oldLines = toLines(oldValue)
  const newLines = toLines(newValue)
  let start = 0
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start += 1
  let oldEnd = oldLines.length
  let newEnd = newLines.length
  while (oldEnd > start && newEnd > start && oldLines[oldEnd - 1] === newLines[newEnd - 1]) {
    oldEnd -= 1
    newEnd -= 1
  }

  const ops: Array<{ op: ' ' | '-' | '+'; text: string }> = []
  for (let index = 0; index < start; index += 1) ops.push({ op: ' ', text: oldLines[index] })
  const a = oldLines.slice(start, oldEnd)
  const b = newLines.slice(start, newEnd)
  if (a.length * b.length <= maxCells) {
    const rows = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1))
    for (let i = a.length - 1; i >= 0; i -= 1) {
      for (let j = b.length - 1; j >= 0; j -= 1) {
        rows[i][j] = a[i] === b[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        ops.push({ op: ' ', text: a[i] })
        i += 1
        j += 1
      } else if (rows[i + 1][j] >= rows[i][j + 1]) {
        ops.push({ op: '-', text: a[i] })
        i += 1
      } else {
        ops.push({ op: '+', text: b[j] })
        j += 1
      }
    }
    while (i < a.length) {
      ops.push({ op: '-', text: a[i] })
      i += 1
    }
    while (j < b.length) {
      ops.push({ op: '+', text: b[j] })
      j += 1
    }
  } else {
    for (const line of a) ops.push({ op: '-', text: line })
    for (const line of b) ops.push({ op: '+', text: line })
  }
  for (let index = oldEnd; index < oldLines.length; index += 1) ops.push({ op: ' ', text: oldLines[index] })

  let added = 0
  let removed = 0
  for (const op of ops) {
    if (op.op === '+') added += 1
    else if (op.op === '-') removed += 1
  }
  const full = ops.map(op => `${op.op}${op.text}`).join('\n')
  if (full.length <= maxChars) return { added, removed, text: full, truncated: false }
  const marker = `\n… diff truncated (${full.length - maxChars} chars) …\n`
  const tailLen = Math.min(1000, Math.floor(maxChars / 4))
  const headLen = Math.max(0, maxChars - tailLen - marker.length)
  return {
    added,
    removed,
    text: `${full.slice(0, headLen)}${marker}${tailLen ? full.slice(full.length - tailLen) : ''}`.slice(0, maxChars),
    truncated: true
  }
}

export function relativeTarget(target: unknown, appDir?: string | null): string | null {
  if (typeof target !== 'string' || !target) return null
  let value = target
  if (appDir) {
    try {
      const rel = path.relative(path.resolve(appDir), path.resolve(value))
      if (rel === '') value = '.'
      else if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) value = rel
    } catch {
      // 保留原值
    }
  }
  return value.replace(/\\/g, '/')
}

const PATH_FIELDS = ['path', 'filePath', 'file', 'filepath', 'target']

function pickPath(input: Record<string, unknown>): string | null {
  for (const key of PATH_FIELDS) {
    const value = input[key]
    if (typeof value === 'string' && value) return value
  }
  return null
}

export function toolTarget(name: string, input: Record<string, unknown> = {}, appDir?: string | null): string | null {
  if (SHELL_TOOLS.has(name)) return asText(input.command) || null
  if (name === 'glob' || name === 'grep') {
    const base = pickPath(input)
    const pattern = asText(input.pattern) || asText(input.query)
    if (base && pattern) return `${relativeTarget(base, appDir)}: ${pattern}`
    return pattern || relativeTarget(base, appDir)
  }
  const file = pickPath(input)
  if (file) return relativeTarget(file, appDir)
  if (typeof input.query === 'string') return input.query
  return null
}

export function extractExit(state: Record<string, unknown> = {}, contentText = ''): number | null {
  const metadata = (state.metadata && typeof state.metadata === 'object' ? state.metadata : {}) as Record<string, unknown>
  const value = metadata.exit ?? metadata.code ?? state.exit
  const numeric = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (Number.isFinite(numeric)) return numeric
  const matches = contentText.match(/(?:Exited with code|exit code:?)\s*(-?\d+)/gi)
  if (!matches?.length) return null
  const last = matches[matches.length - 1].match(/(-?\d+)/)
  return last ? Number.parseInt(last[1], 10) : null
}

function partOutputText(state: Record<string, unknown>): string {
  const content = Array.isArray(state.content) ? state.content : []
  return content
    .map(part => {
      const record = part && typeof part === 'object' ? (part as Record<string, unknown>) : {}
      if (record.type === 'text') return asText(record.text)
      if (record.type === 'file') return `[file: ${asText(record.name) || asText(record.uri) || 'file'}]`
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function readTime(part: Record<string, unknown>): { created: number | null; ran: number | null; completed: number | null } {
  const time = (part.time && typeof part.time === 'object' ? part.time : {}) as Record<string, unknown>
  return {
    created: typeof time.created === 'number' ? time.created : null,
    ran: typeof time.ran === 'number' ? time.ran : null,
    completed: typeof time.completed === 'number' ? time.completed : null
  }
}

function durationOf(time: { created: number | null; ran: number | null; completed: number | null }, status: string, now: number): number | null {
  if (time.completed && time.created) return Math.max(0, time.completed - time.created)
  if (time.ran && time.created) return Math.max(0, time.ran - time.created)
  if (time.created && (status === 'running' || status === 'streaming')) return Math.max(0, now - time.created)
  return null
}

function sanitizeValue(value: unknown, budget: { left: number }, depth = 0): unknown {
  if (budget.left <= 0) return null
  if (typeof value === 'string') {
    const cut = truncateText(value, Math.min(LIMITS.inputString, budget.left), 'head')
    budget.left -= cut.text.length
    return scrubText(cut.text)
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (depth >= 5) return '[depth]'
  if (Array.isArray(value)) {
    const out = value.slice(0, 100).map(item => sanitizeValue(item, budget, depth + 1))
    if (value.length > 100) out.push('…')
    return out
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeValue(item, budget, depth + 1)
      if (budget.left <= 0) break
    }
    return out
  }
  return String(value)
}

function normalizeToolPart(
  part: Record<string, unknown>,
  message: Record<string, unknown>,
  context: { appDir?: string | null; budget: { left: number }; now: number }
): DevToolItem {
  const name = asText(part.name) || asText(part.tool) || 'tool'
  const state = (part.state && typeof part.state === 'object' ? part.state : {}) as Record<string, unknown>
  const input = (state.input && typeof state.input === 'object' ? state.input : {}) as Record<string, unknown>
  const status = asText(state.status) || (state.error ? 'error' : 'unknown')
  const rawOutput = partOutputText(state)
  const output = truncateText(rawOutput, Math.max(0, Math.min(LIMITS.toolOutput, context.budget.left)), SHELL_TOOLS.has(name) || status === 'error' ? 'tail' : 'head')
  output.text = scrubText(output.text)
  output.exit = SHELL_TOOLS.has(name) ? extractExit(state, rawOutput) : null
  context.budget.left -= output.text.length

  let diff: DevToolDiff | null = null
  if (WRITE_TOOLS.has(name)) {
    const added = asText(input.content)
    const oldText = asText(input.oldString)
    const newText = asText(input.newString)
    if (added || oldText || newText) {
      const result = diffLines(oldText, added || newText, { maxChars: Math.max(0, Math.min(LIMITS.diff, context.budget.left)) })
      context.budget.left -= result.text.length
      diff = {
        ...result,
        text: scrubText(result.text),
        mode: added ? 'create' : 'replace',
        path: relativeTarget(pickPath(input), context.appDir)
      }
    }
  }

  const time = readTime(part)
  const error = state.error && typeof state.error === 'object'
    ? {
        type: asText((state.error as Record<string, unknown>).type) || 'error',
        message: scrubText((state.error as Record<string, unknown>).message ?? ''),
        status: typeof (state.error as Record<string, unknown>).status === 'number' ? Number((state.error as Record<string, unknown>).status) : null
      }
    : null

  const target = toolTarget(name, input, context.appDir)
  return {
    type: 'tool',
    id: asText(part.id) || null,
    messageId: asText(message.id) || null,
    name,
    status,
    target: target ? scrubText(target) : null,
    input: sanitizeValue(input, context.budget) as Record<string, unknown>,
    output,
    diff,
    error,
    time,
    durationMs: durationOf(time, status, context.now)
  }
}

function normalizeShellMessage(message: Record<string, unknown>, context: { budget: { left: number }; now: number }): DevToolItem {
  const output = (message.output && typeof message.output === 'object' ? message.output : {}) as Record<string, unknown>
  const raw = asText(output.output)
  const cut = truncateText(raw, Math.max(0, Math.min(LIMITS.toolOutput, context.budget.left)), 'tail')
  context.budget.left -= cut.text.length
  cut.exit = typeof message.exit === 'number' ? message.exit : null
  cut.status = asText(message.status) || null
  const time = {
    created: typeof (message.time as Record<string, unknown> | undefined)?.created === 'number' ? Number((message.time as Record<string, unknown>).created) : null,
    ran: null,
    completed: typeof (message.time as Record<string, unknown> | undefined)?.completed === 'number' ? Number((message.time as Record<string, unknown>).completed) : null
  }
  return {
    type: 'shell',
    id: asText(message.id) || null,
    messageId: asText(message.id) || null,
    name: 'shell',
    status: message.status === 'exited' ? 'completed' : asText(message.status) || 'unknown',
    target: scrubText(asText(message.command)) || null,
    input: { command: asText(message.command) },
    output: cut,
    diff: null,
    error: null,
    time,
    durationMs: durationOf(time, asText(message.status) || 'unknown', context.now)
  }
}

export function normalizeMessages(messages: unknown[], options: { appDir?: string | null } = {}): DevSessionMessage[] {
  const out: DevSessionMessage[] = []
  for (const raw of messages.slice(-LIMITS.maxMessages)) {
    if (!raw || typeof raw !== 'object') continue
    const message = raw as Record<string, unknown>
    const base = {
      id: asText(message.id) || `msg-${out.length}`,
      type: asText(message.type) || 'unknown',
      created: typeof (message.time as Record<string, unknown> | undefined)?.created === 'number'
        ? Number((message.time as Record<string, unknown>).created)
        : null
    }
    if (message.type === 'user') {
      out.push({ ...base, text: scrubText(displayUserText(asText(message.text))) })
      continue
    }
    if (message.type === 'system') {
      out.push({ ...base, text: scrubText(message.text) })
      continue
    }
    if (message.type === 'assistant') {
      const parts = Array.isArray(message.content) ? (message.content as Array<Record<string, unknown>>) : []
      const text = parts.filter(part => part.type === 'text').map(part => asText(part.text)).join('\n')
      const reasoning = parts.filter(part => part.type === 'reasoning').map(part => asText(part.text)).join('\n')
      const tools = parts
        .filter(part => part.type === 'tool')
        .map(part => {
          const state = (part.state && typeof part.state === 'object' ? part.state : {}) as Record<string, unknown>
          const input = (state.input && typeof state.input === 'object' ? state.input : {}) as Record<string, unknown>
          const time = readTime(part)
          const target = toolTarget(asText(part.name) || asText(part.tool) || 'tool', input, options.appDir)
          return {
            id: asText(part.id) || null,
            name: asText(part.name) || asText(part.tool) || 'tool',
            status: asText(state.status) || null,
            title: asText(state.title) || null,
            target: target ? scrubText(target) : null,
            durationMs: durationOf(time, asText(state.status) || 'unknown', Date.now())
          }
        })
      out.push({
        ...base,
        text: scrubText(text),
        ...(reasoning ? { reasoning: scrubText(reasoning) } : {}),
        tools,
        agent: asText(message.agent) || null,
        model: message.model ? redactDeep(message.model) : null,
        finish: asText(message.finish) || null,
        error: message.error ? redactDeep(message.error) : null,
        cost: typeof message.cost === 'number' ? message.cost : null,
        tokens: message.tokens,
        time: message.time
      })
      continue
    }
    if (message.type === 'shell') {
      const output = (message.output && typeof message.output === 'object' ? message.output : {}) as Record<string, unknown>
      const rawText = asText(output.output)
      const cut = truncateText(rawText, LIMITS.toolOutput, 'tail')
      out.push({
        ...base,
        text: scrubText(message.command ?? message.text ?? ''),
        command: scrubText(message.command ?? ''),
        status: asText(message.status) || null,
        exit: typeof message.exit === 'number' ? message.exit : extractExit(message, rawText),
        output: { ...cut, text: scrubText(cut.text) }
      })
      continue
    }
    if (message.type === 'idle') {
      out.push({ ...base, outcome: asText(message.outcome) || null, error: message.error ? redactDeep(message.error) : null })
      continue
    }
    if (message.type === 'compaction') {
      // I-09a：opencode 原生 compact 写入的消息；只作为轻量系统提示，不当 assistant 文本。
      // 空会话 compact 时 opencode 仍返回 200，但消息 status=failed（error.compaction.unavailable）。
      if (asText(message.status) === 'failed') {
        const raw = message.error && typeof message.error === 'object' ? asText((message.error as Record<string, unknown>).message) : ''
        const reason = /nothing to compact/i.test(raw) ? '没有可压缩的上下文' : scrubText(raw).slice(0, 120) || '未知原因'
        out.push({ ...base, kind: 'compaction-failed', text: `上下文压缩未执行：${reason}` })
      } else {
        out.push({ ...base, kind: 'compaction', text: '上下文已压缩' })
      }
      continue
    }
    out.push({ ...base, text: scrubText(message.text) })
  }
  return out
}

function classifyPhase(currentPhase: string | null, item: DevToolItem): string {
  const command = asText(item.input.command)
  if (WRITE_TOOLS.has(item.name)) return 'implement'
  if (SHELL_TOOLS.has(item.name)) {
    if (DELIVER_RE.test(command)) return 'deliver'
    if (TEST_RE.test(command)) return 'test'
    if (BUILD_RE.test(command)) return 'build'
    if (VCS_READ_RE.test(command)) return currentPhase || 'analysis'
    return currentPhase || 'run'
  }
  if (READ_TOOLS.has(item.name)) return ['implement', 'build', 'test', 'deliver'].includes(currentPhase ?? '') ? (currentPhase as string) : 'analysis'
  return currentPhase || 'run'
}

function isFailedItem(item: DevToolItem): boolean {
  if (item.status === 'error' || item.error) return true
  return SHELL_TOOLS.has(item.name) && typeof item.output.exit === 'number' && item.output.exit !== 0
}

function finalizeStep(step: { id: string; phase: string; items: DevToolItem[] }, now: number): DevStep {
  const items = step.items
  const startedAt = items.reduce<number | null>((min, item) => (item.time.created && (!min || item.time.created < min) ? item.time.created : min), null)
  const running = items.some(item => ['running', 'streaming', 'unknown'].includes(item.status))
  const failed = items.some(isFailedItem)
  const completed = items.every(item => typeof item.time.completed === 'number')
  const endedAt = completed ? Math.max(...items.map(item => item.time.completed as number)) : running ? null : startedAt
  const targets: string[] = []
  for (const item of items) {
    if (item.target && !targets.includes(item.target)) targets.push(item.target)
    if (targets.length >= 6) break
  }
  return {
    id: step.id,
    kind: 'tools',
    title: PHASE_LABELS[step.phase] ?? PHASE_LABELS.run,
    phase: step.phase,
    status: failed ? 'failed' : running ? 'running' : 'completed',
    startedAt,
    endedAt,
    durationMs: startedAt ? Math.max(0, (endedAt ?? now) - startedAt) : null,
    toolCount: items.length,
    targets,
    items
  }
}

export function buildSteps(messages: unknown[], options: { appDir?: string | null; now?: number } = {}): { steps: DevStep[]; stepsTruncated: boolean; droppedSteps: number } {
  const steps: DevStep[] = []
  const budget = { left: LIMITS.totalChars }
  const now = options.now ?? Date.now()
  let current: { id: string; phase: string; items: DevToolItem[] } | null = null
  let lastPhase: string | null = null
  let index = 0

  const flush = (): void => {
    if (!current || !current.items.length) return
    steps.push(finalizeStep(current, now))
    current = null
  }
  const addItem = (item: DevToolItem): void => {
    const phase = classifyPhase(lastPhase, item)
    lastPhase = phase
    if (!current || current.phase !== phase) {
      flush()
      index += 1
      current = { id: `step_${index}`, phase, items: [] }
    }
    current.items.push(item)
  }

  for (const raw of Array.isArray(messages) ? messages : []) {
    if (!raw || typeof raw !== 'object') continue
    const message = raw as Record<string, unknown>
    if (message.type === 'assistant') {
      const parts = Array.isArray(message.content) ? (message.content as Array<Record<string, unknown>>) : []
      for (const part of parts) {
        if (part.type === 'text') {
          if (asText(part.text).trim()) flush()
        } else if (part.type === 'tool') {
          addItem(normalizeToolPart(part, message, { appDir: options.appDir, budget, now }))
        }
      }
    } else if (message.type === 'shell') {
      addItem(normalizeShellMessage(message, { budget, now }))
    } else if (message.type === 'user' || message.type === 'idle' || message.type === 'compaction') {
      flush()
    }
  }
  flush()

  if (steps.length > LIMITS.maxSteps) {
    return { steps: steps.slice(-LIMITS.maxSteps), stepsTruncated: true, droppedSteps: steps.length - LIMITS.maxSteps }
  }
  return { steps, stepsTruncated: false, droppedSteps: 0 }
}

/** 最新 assistant 消息的上下文 token：input + cache.read + cache.write；没有 assistant 消息为 0 */
export function contextUsedTokens(messages: unknown[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const raw = messages[index]
    const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
    if (!record || record.type !== 'assistant') continue
    const tokens = record.tokens && typeof record.tokens === 'object' ? (record.tokens as Record<string, unknown>) : null
    if (!tokens) continue
    const input = typeof tokens.input === 'number' && Number.isFinite(tokens.input) ? tokens.input : 0
    const cache = tokens.cache && typeof tokens.cache === 'object' ? (tokens.cache as Record<string, unknown>) : {}
    const read = typeof cache.read === 'number' && Number.isFinite(cache.read) ? cache.read : 0
    const write = typeof cache.write === 'number' && Number.isFinite(cache.write) ? cache.write : 0
    return Math.max(0, input + read + write)
  }
  return 0
}

/** 只算 used；limit/percent/level 由 dev/service 补齐（需要查模型元数据） */
function contextUsage(messages: unknown[]): DevContextUsage {
  return { used: contextUsedTokens(messages), limit: null, percent: null, level: 'unknown' }
}

export function buildProgress(input: {
  info?: Record<string, unknown> | null
  messages?: unknown[]
  appDir?: string | null
  now?: number
} = {}): DevProgress {
  const info = input.info ?? null
  const messages = Array.isArray(input.messages) ? input.messages : []
  const now = input.now ?? Date.now()
  const time = (info?.time && typeof info.time === 'object' ? info.time : {}) as Record<string, unknown>
  let startedAt: number | null = typeof time.created === 'number' ? time.created : null
  if (startedAt === null) {
    for (const message of messages) {
      const record = message && typeof message === 'object' ? (message as Record<string, unknown>) : null
      const messageTime = record?.time
      if (messageTime && typeof messageTime === 'object' && typeof (messageTime as Record<string, unknown>).created === 'number') {
        startedAt = Number((messageTime as Record<string, unknown>).created)
        break
      }
    }
  }
  const endedIdleAt = (() => {
    const idle = lastIdleMessage(messages)
    const idleTime = idle && idle.time && typeof idle.time === 'object' ? (idle.time as Record<string, unknown>) : null
    return idleTime && typeof idleTime.created === 'number' ? idleTime.created : null
  })()
  // P7-6c：`session.idle` 事件可能丢失，但 opencode 仍会写 idle 消息/outcome；
  // 状态优先看消息收尾记录，避免开发视图长期停在“运行中”。
  const completion = sessionCompletion(info, messages)
  const status =
    completion === 'complete'
      ? 'succeeded'
      : completion === 'failed'
        ? 'failed'
        : completion === 'interrupted'
          ? 'interrupted'
          : asText(info?.outcome) || (time.busy ? 'running' : 'idle')
  const endedAt =
    status === 'running'
      ? info?.outcome
        ? typeof time.updated === 'number'
          ? time.updated
          : now
        : null
      : typeof time.idle === 'number'
        ? time.idle
        : (endedIdleAt ?? (typeof time.updated === 'number' ? time.updated : now))
  const elapsedMs = startedAt ? Math.max(0, (endedAt ?? now) - startedAt) : null
  const { steps, stepsTruncated, droppedSteps } = buildSteps(messages, { appDir: input.appDir, now })
  const stats = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }
  const tokens = (info?.tokens && typeof info.tokens === 'object' ? info.tokens : {}) as Record<string, unknown>
  stats.input = typeof tokens.input === 'number' ? tokens.input : 0
  stats.output = typeof tokens.output === 'number' ? tokens.output : 0
  stats.reasoning = typeof tokens.reasoning === 'number' ? tokens.reasoning : 0
  const cache = (tokens.cache && typeof tokens.cache === 'object' ? tokens.cache : {}) as Record<string, unknown>
  stats.cacheRead = typeof cache.read === 'number' ? cache.read : 0
  stats.cacheWrite = typeof cache.write === 'number' ? cache.write : 0

  const toolCounts: Record<string, number> = {}
  let toolTotal = 0
  let failedTools = 0
  for (const step of steps) {
    for (const item of step.items) {
      toolCounts[item.name] = (toolCounts[item.name] ?? 0) + 1
      toolTotal += 1
      if (isFailedItem(item)) failedTools += 1
    }
  }
  const phaseHistory: Array<{ key: string; label: string; startedAt: number | null; endedAt: number | null }> = []
  for (const step of steps) {
    const last = phaseHistory[phaseHistory.length - 1]
    const ended = step.status === 'running' ? null : (step.endedAt ?? now)
    if (last && last.key === step.phase) {
      last.endedAt = ended
    } else {
      phaseHistory.push({ key: step.phase, label: step.title, startedAt: step.startedAt, endedAt: ended })
    }
  }
  const currentPhase = phaseHistory[phaseHistory.length - 1] ?? {
    key: 'run',
    label: PHASE_LABELS.run,
    startedAt: typeof time.created === 'number' ? time.created : null,
    endedAt: null
  }

  return {
    status,
    startedAt,
    endedAt,
    elapsedMs,
    context: contextUsage(messages),
    stats: {
      tokens: stats,
      cost: typeof info?.cost === 'number' ? info.cost : 0,
      toolCounts,
      toolTotal,
      failedTools,
      messageCount: messages.length,
      partial: messages.length >= LIMITS.maxMessages,
      steps: steps.length,
      stepsTruncated,
      droppedSteps
    },
    phase: { key: currentPhase.key, label: currentPhase.label, startedAt: currentPhase.startedAt, history: phaseHistory },
    steps,
    messages: normalizeMessages(messages, { appDir: input.appDir })
  }
}
