/** 结构化文本生成：统一走 opencode 短暂会话（不再直连 OpenAI 兼容接口） */
import { config } from '../config'
import { opencode } from '../opencode/runtime'

export interface ChatJsonOptions {
  /** opencode 工作目录；默认应用目录根 */
  directory?: string
  /** 使用的 agent（req/design/build…）；为空时用 opencode 默认 build */
  agent?: string
  model?: { providerID: string; id: string } | null
  signal?: AbortSignal
}

/** 请求 JSON 对象；解析失败自动追加“只输出 JSON”要求重试一次 */
export async function chatJson(
  system: string,
  user: string,
  retries = 1,
  options: ChatJsonOptions = {}
): Promise<Record<string, unknown>> {
  const directory = options.directory ?? config.projectsDir
  let lastError = ''
  let userText = user
  for (let attempt = 0; attempt <= retries; attempt++) {
    const prompt = `${system}\n\n${userText}`
    const text = await opencode.generateText({
      directory,
      prompt,
      agent: options.agent,
      model: options.model ?? null,
      signal: options.signal
    })
    try {
      return extractJson(text) as Record<string, unknown>
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      userText = `${user}\n\n【重试要求】你上一次输出无法解析（${lastError}）。请只输出一个合法 JSON 对象，不要 markdown 围栏、不要解释。`
    }
  }
  throw new Error(`AI 输出无法解析为 JSON：${lastError}`)
}

/** 从模型输出中提取 JSON：剥围栏 → 取首个 { 到末个 } */
export function extractJson(text: string): unknown {
  let t = text.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(t)
  if (fence) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('输出中未找到 JSON 对象')
  const parsed = JSON.parse(t.slice(start, end + 1))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('输出不是 JSON 对象')
  return parsed as Record<string, unknown>
}
