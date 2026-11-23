/**
 * 会话完成判定（纯函数，P7-6c）
 *
 * opencode 的事件流是 volatile 的：`session.idle` / `session.execution.succeeded`
 * 可能在网络抖动、事件流重连或客户端慢消费时丢失。本模块只做“是否已完成”的判定，
 * 不发起请求、不依赖时间：
 *
 * - 优先看最后一条 `idle` 消息 / 会话 `outcome`（opencode 的权威收尾记录）；
 * - 其次看 `time.idle`；
 * - 最后在 `time.busy === false` 且最后一条 assistant 已完成时视为完成；
 * - 其它情况一律返回 null（不误判长工具/权限等待）。
 *
 * `shouldFallbackFinish` 只回答“现在该不该查一次会话状态”，由调用方决定是否 finish。
 */
import type { OpencodeEvent } from './events'

export type SessionSignal = 'complete' | 'failed' | 'interrupted' | null

const IDLE_TYPES = new Set([
  'session.idle',
  'session.execution.succeeded',
  'session.execution.failed',
  'session.execution.interrupted'
])

const RUNNING_PART_STATUS = new Set(['running', 'streaming', 'pending', 'unknown'])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 会话/消息里的 outcome/status 文本 → 收尾信号 */
export function classifyOutcome(value: unknown): SessionSignal {
  const outcome = text(value).toLowerCase()
  if (!outcome || outcome === 'running' || outcome === 'busy' || outcome === 'active') return null
  if (outcome === 'failed' || outcome === 'error') return 'failed'
  if (outcome === 'interrupted' || outcome === 'aborted' || outcome === 'cancelled' || outcome === 'canceled') {
    return 'interrupted'
  }
  if (['succeeded', 'success', 'completed', 'complete', 'idle', 'done'].includes(outcome)) return 'complete'
  return null
}

export function lastMessage(messages: unknown): Record<string, unknown> | null {
  const list = Array.isArray(messages) ? messages : []
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const record = asRecord(list[index])
    if (record) return record
  }
  return null
}

export function lastIdleMessage(messages: unknown): Record<string, unknown> | null {
  const list = Array.isArray(messages) ? messages : []
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const record = asRecord(list[index])
    if (!record) continue
    const type = text(record.type)
    // 新的一轮已经以 user 消息开始：上一轮的 idle 不代表当前轮完成
    if (type === 'user') return null
    if (type === 'idle') return record
  }
  return null
}

/** opencode 用 `finish: tool-calls` 表示还有下一轮（不是本轮收尾） */
const TOOL_CALL_FINISH = new Set(['tool-calls', 'tool_calls', 'tool-use', 'tool_use'])

/** 最后一条 assistant 是否已收尾且没有运行中的工具（只看最后一条消息） */
export function transcriptComplete(messages: unknown): boolean {
  const message = lastMessage(messages)
  if (!message || text(message.type) !== 'assistant') return false
  if (message.error) return false
  if (assistantHasRunningTool(message)) return false
  const time = asRecord(message.time) ?? {}
  const finish = text(message.finish).toLowerCase()
  // `finish=tool-calls` 表示模型还要继续下一轮；工具本身 completed 也不代表本轮收尾。
  if (TOOL_CALL_FINISH.has(finish)) return false
  return number(time.completed) !== null || Boolean(finish)
}

function assistantHasRunningTool(message: Record<string, unknown>): boolean {
  const parts = Array.isArray(message.content) ? message.content : []
  for (const part of parts) {
    const record = asRecord(part)
    if (!record || text(record.type) !== 'tool') continue
    const state = asRecord(record.state) ?? {}
    if (RUNNING_PART_STATUS.has(text(state.status).toLowerCase())) return true
  }
  return false
}

export interface SessionInfoLike {
  outcome?: unknown
  time?: unknown
}

/**
 * 根据 opencode 会话信息 + 消息判断完成状态。
 * 返回 null 表示“无法确认完成”（可能仍在执行/等待权限）。
 */
export function sessionCompletion(info: SessionInfoLike | null | undefined, messages: unknown): SessionSignal {
  const last = lastMessage(messages)
  // 新一轮已开始（最后一条是 user）：上一轮的 outcome/idle 不能当作本轮完成
  if (last && text(last.type) === 'user') return null
  // 最后一条 assistant 仍有运行中的工具：即使 outcome 落后也不收尾
  if (last && text(last.type) === 'assistant' && assistantHasRunningTool(last)) return null

  const idle = lastIdleMessage(messages)
  if (idle) {
    const signal = classifyOutcome(idle.outcome) ?? 'complete'
    return signal
  }

  const record = asRecord(info) ?? {}
  const outcome = classifyOutcome(record.outcome)
  if (outcome) return outcome

  const time = asRecord(record.time) ?? {}
  if (number(time.idle) !== null) return 'complete'

  // opencode v2 的 `time.busy` 是“本轮开始忙碌”的时间戳（不是 boolean）；任何真值都表示仍在忙。
  const busyRaw = time.busy
  const busy =
    busyRaw === true ||
    busyRaw === 1 ||
    (typeof busyRaw === 'number' && Number.isFinite(busyRaw) && busyRaw > 1)
  if (!busy && transcriptComplete(messages)) return 'complete'
  return null
}

/** SSE 事件里是否有明确的收尾信号（新事件类型只有带显式状态词时才认） */
export function eventCompletion(event: OpencodeEvent | { type?: unknown; data?: unknown }): SessionSignal {
  const type = text(event.type)
  if (type === 'session.execution.succeeded' || type === 'session.idle') return 'complete'
  if (type === 'session.execution.failed') return 'failed'
  if (type === 'session.execution.interrupted') return 'interrupted'
  if (!['session.status', 'session.updated', 'session.state'].includes(type)) return null
  const data = asRecord(event.data) ?? {}
  const session = asRecord(data.session) ?? {}
  const status = text(data.status) || text(data.state) || text(session.outcome) || text(session.status)
  return classifyOutcome(status)
}

/** 是否是历史上就使用的显式收尾事件（这些事件无需先有活动也直接收尾） */
export function isExplicitFinishEvent(type: string): boolean {
  return IDLE_TYPES.has(type)
}

export interface FallbackInput {
  now: number
  lastEventAt: number
  hasActivity: boolean
  idleAfterMs: number
}

/** watchdog 是否应该去查一次会话状态：有活动、且距最后事件超过阈值 */
export function shouldFallbackFinish(input: FallbackInput): boolean {
  if (!input.hasActivity) return false
  if (!Number.isFinite(input.lastEventAt) || input.lastEventAt <= 0) return false
  return input.now - input.lastEventAt >= Math.max(0, input.idleAfterMs)
}
