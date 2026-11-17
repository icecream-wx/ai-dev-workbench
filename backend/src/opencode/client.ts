/** opencode serve HTTP 客户端：Basic Auth + 超时 + SSE 流 */
import { redact } from './redact'

export interface OpencodeResponse<T = unknown> {
  ok: boolean
  status: number
  data: T | null
  text: string
}

export interface RequestOptions {
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  timeoutMs?: number
}

export class OpencodeClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getPassword: () => string | null
  ) {}

  authHeader(): string {
    const password = this.getPassword()
    if (!password) throw new Error('opencode serve 密码尚未捕获')
    return 'Basic ' + Buffer.from(`opencode:${password}`).toString('base64')
  }

  buildUrl(pathname: string, query?: RequestOptions['query']): URL {
    const url = new URL(pathname, this.baseUrl)
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) continue
      url.searchParams.append(key, String(value))
    }
    return url
  }

  async request<T = unknown>(method: string, pathname: string, options: RequestOptions = {}): Promise<OpencodeResponse<T>> {
    const { body, query, timeoutMs = 120000 } = options
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(this.buildUrl(pathname, query), {
        method,
        headers: {
          Authorization: this.authHeader(),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      })
      const text = await response.text()
      let data: T | null = null
      try {
        data = text ? (JSON.parse(text) as T) : null
      } catch {
        data = null
      }
      return { ok: response.ok, status: response.status, data, text }
    } catch (error) {
      const message = controller.signal.aborted
        ? `opencode 请求超时（${method} ${pathname}，${timeoutMs}ms）`
        : `opencode 请求失败（${method} ${pathname}）：${error instanceof Error ? error.message : String(error)}`
      throw new Error(redact(message))
    } finally {
      clearTimeout(timer)
    }
  }

  /** 打开 SSE 流；HTTP 非 2xx 时抛出带状态的错误 */
  async openStream(pathname: string, query: RequestOptions['query'], signal: AbortSignal): Promise<Response> {
    const response = await fetch(this.buildUrl(pathname, query), {
      headers: { Authorization: this.authHeader() },
      signal
    })
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '')
      const error = new Error(`opencode 事件流失败（HTTP ${response.status}）${text ? `：${redact(text).slice(0, 200)}` : ''}`) as Error & {
        status?: number
      }
      error.status = response.status
      throw error
    }
    return response
  }
}
