/**
 * 日志/响应脱敏
 *
 * 运行期注册的密钥（例如 opencode serve 的随机密码）会在所有日志中替换为 ***。
 * Authorization 头永远不完整输出。
 */
const secrets = new Set<string>()

const AUTH_PATTERN = /Authorization:\s*Basic\s+[A-Za-z0-9+/=]+/gi
const BASIC_PATTERN = /\bBasic\s+[A-Za-z0-9+/=]{8,}/gi

export function registerSecret(value: string | null | undefined): string | null {
  if (typeof value === 'string' && value.length >= 4) secrets.add(value)
  return value ?? null
}

export function redact(input: unknown): string {
  let out = String(input ?? '')
  out = out.replace(AUTH_PATTERN, 'Authorization: Basic ***')
  out = out.replace(BASIC_PATTERN, 'Basic ***')
  for (const secret of secrets) {
    if (secret && out.includes(secret)) out = out.split(secret).join('***')
  }
  return out
}

/** 递归清洗对象/数组中的字符串（用于 API 响应与事件广播） */
export function redactDeep<T>(value: T): T {
  if (typeof value === 'string') return redact(value) as unknown as T
  if (Array.isArray(value)) return value.map(item => redactDeep(item)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = redactDeep(item)
    return out as T
  }
  return value
}

/** 仅用于测试：清空已注册密钥 */
export function clearSecretsForTests(): void {
  secrets.clear()
}
