/**
 * opencode 事件流解析与本地事件分发
 *
 * - parseSseFrame / createSseParser：把 /api/event 的 SSE 帧解析成事件对象
 * - EventHub：进程内订阅；按 sessionID / 项目目录过滤，避免把其他应用的事件广播给当前应用
 * - 环形缓冲仅用于调试/断线补看，不承诺可靠重放（opencode 事件本身是 volatile 的）
 */
export interface OpencodeEvent {
  id?: string | null
  created?: number
  type: string
  location?: { directory?: string } | null
  data?: Record<string, unknown>
  durable?: unknown
  [key: string]: unknown
}

export interface EventFilter {
  sessionID?: string
  /** 项目目录；比较时忽略大小写/分隔符差异（Windows） */
  directory?: string
}

export type EventListener = (event: OpencodeEvent) => void

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value) return value
  }
  return null
}

export function normalizeEvent(input: unknown): OpencodeEvent | null {
  const record = asRecord(input)
  const type = record ? firstString(record.type, record.event) : null
  if (!record || !type) return null
  return { ...record, type } as OpencodeEvent
}

/** 解析一个 SSE 帧（不含结尾空行）；无 data 或 JSON 非法时返回 null */
export function parseSseFrame(raw: string): OpencodeEvent | null {
  const dataLines: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue
    dataLines.push(line.slice(5).replace(/^ /, ''))
  }
  if (!dataLines.length) return null
  try {
    return normalizeEvent(JSON.parse(dataLines.join('\n')))
  } catch {
    return null
  }
}

export interface SseParser {
  push(chunk: string): void
  flush(): void
}

/** 增量 SSE 解析器：处理跨 chunk 的半帧 */
export function createSseParser(onEvent: (event: OpencodeEvent) => void): SseParser {
  let buffer = ''
  const drain = (): void => {
    let index: number
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      const event = parseSseFrame(raw)
      if (event) onEvent(event)
    }
  }
  return {
    push(chunk: string): void {
      buffer += chunk.replace(/\r\n/g, '\n')
      drain()
    },
    flush(): void {
      const raw = buffer.trim()
      buffer = ''
      if (!raw) return
      const event = parseSseFrame(raw)
      if (event) onEvent(event)
    }
  }
}

export function eventSessionId(event: OpencodeEvent): string | null {
  const data = asRecord(event.data)
  if (!data) return null
  const session = asRecord(data.session)
  return firstString(data.sessionID, data.sessionId, session?.id)
}

export function eventDirectory(event: OpencodeEvent): string | null {
  const location = asRecord(event.location)
  return firstString(location?.directory, location?.path)
}

function normalizeDir(value: string): string {
  let out = value.replace(/\\/g, '/').replace(/\/+$/, '')
  if (process.platform === 'win32') out = out.toLowerCase()
  return out
}

export function matchesFilter(event: OpencodeEvent, filter: EventFilter): boolean {
  if (filter.sessionID && eventSessionId(event) !== filter.sessionID) return false
  if (filter.directory) {
    const directory = eventDirectory(event)
    if (!directory || normalizeDir(directory) !== normalizeDir(filter.directory)) return false
  }
  return true
}

interface Subscription {
  filter: EventFilter
  listener: EventListener
}

export class EventHub {
  private readonly subscriptions = new Set<Subscription>()
  private readonly buffer: OpencodeEvent[] = []

  constructor(private readonly bufferLimit = 500) {}

  publish(event: OpencodeEvent): void {
    this.buffer.push(event)
    if (this.buffer.length > this.bufferLimit) this.buffer.splice(0, this.buffer.length - this.bufferLimit)

    for (const subscription of [...this.subscriptions]) {
      if (!matchesFilter(event, subscription.filter)) continue
      try {
        subscription.listener(event)
      } catch {
        // 单个订阅者异常不影响其他订阅者
      }
    }
  }

  subscribe(filter: EventFilter, listener: EventListener): () => void {
    const subscription: Subscription = { filter, listener }
    this.subscriptions.add(subscription)
    return () => {
      this.subscriptions.delete(subscription)
    }
  }

  /** 最近的原始事件（调试用；不做过滤） */
  recent(limit = 100): OpencodeEvent[] {
    return this.buffer.slice(-limit)
  }

  clear(): void {
    this.buffer.length = 0
    this.subscriptions.clear()
  }
}
