/**
 * 模型输出协议解析（纯 JS，便于 Node 直接单测）
 *
 * 需求文档（`<<<DOC_JSON>>>`）与设计（`<<<DESIGN_JSON>>>`）共用：模型偶尔会在
 * JSON 后再次输出分隔符、追加说明或使用 markdown 代码块，直接 JSON.parse
 * 分隔符后的整段文本会失败。这里改为：
 * 1. 优先解析分隔符后的内容；
 * 2. 解析失败时从文本中提取平衡的花括号 JSON 对象；
 * 3. 容忍常见尾逗号；
 * 4. 没有分隔符时，从整段回复中提取 JSON，并保留 JSON 前的自然语言。
 */

const ENVELOPE_KEYS = new Set([
  'card',
  'pointTarget',
  'patch',
  'patches',
  'openIssues',
  'actions',
  'newModules',
  'newScenes'
])

/**
 * 去掉 markdown 代码块围栏。
 * @param {string} text
 * @returns {string}
 */
export function stripCodeFence(text) {
  let out = String(text ?? '').trim()
  if (out.startsWith('```')) {
    out = out.replace(/^```[a-zA-Z]*\s*/, '')
    if (out.endsWith('```')) out = out.slice(0, -3)
  }
  return out.trim()
}

/**
 * 去掉 JSON 字符串外的尾逗号（`{"a":1,}` / `[1,2,]`）。
 * @param {string} text
 * @returns {string}
 */
export function repairJson(text) {
  const input = String(text ?? '')
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (inString) {
      out += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      out += char
      continue
    }
    if (char === ',') {
      let next = i + 1
      while (next < input.length && /\s/.test(input[next])) next += 1
      if (input[next] === '}' || input[next] === ']') continue
    }
    out += char
  }
  return out
}

/**
 * 从任意文本中提取平衡的顶层 JSON 对象（忽略字符串内的花括号）。
 * @param {string} text
 * @returns {string[]}
 */
export function extractJsonCandidates(text) {
  const input = String(text ?? '')
  const candidates = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') {
      if (depth === 0) start = i
      depth += 1
      continue
    }
    if (char === '}') {
      if (depth === 0) continue
      depth -= 1
      if (depth === 0 && start >= 0) {
        candidates.push(stripCodeFence(input.slice(start, i + 1)))
        start = -1
      }
    }
  }
  return candidates
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function looksLikeEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  if (keys.length === 0) return true
  return keys.some(key => ENVELOPE_KEYS.has(key))
}

/**
 * @param {unknown} value
 * @returns {string[] | undefined}
 */
function normalizeConstraints(value) {
  if (Array.isArray(value)) {
    const list = value
      .map(item => (typeof item === 'string' ? item.trim() : item && typeof item === 'object' ? JSON.stringify(item) : String(item ?? '')))
      .filter(Boolean)
    return list.length ? list : undefined
  }
  if (typeof value === 'string') {
    const text = value.trim()
    return text ? [text] : undefined
  }
  if (value && typeof value === 'object') {
    const list = Object.entries(value).map(([key, item]) => (item === true ? key : `${key}:${String(item)}`))
    return list.length ? list : undefined
  }
  return undefined
}

/**
 * 模型常把 field.constraints 写成字符串或对象，而规范要求字符串数组。
 * 在解析阶段统一归一化，避免整轮 patch 因单字段形状被校验拒绝。
 * @param {Record<string, unknown>} envelope
 * @returns {Record<string, unknown>}
 */
export function normalizeEnvelope(envelope) {
  const patches = []
  if (envelope.patch && typeof envelope.patch === 'object') patches.push(envelope.patch)
  for (const entry of Array.isArray(envelope.patches) ? envelope.patches : []) {
    if (entry && typeof entry === 'object' && entry.patch && typeof entry.patch === 'object') patches.push(entry.patch)
  }
  for (const scene of Array.isArray(envelope.newScenes) ? envelope.newScenes : []) {
    for (const mod of Array.isArray(scene?.modules) ? scene.modules : []) {
      if (mod?.patch && typeof mod.patch === 'object') patches.push(mod.patch)
    }
  }
  for (const mod of Array.isArray(envelope.newModules) ? envelope.newModules : []) {
    if (mod?.patch && typeof mod.patch === 'object') patches.push(mod.patch)
  }
  for (const patch of patches) {
    for (const entity of Array.isArray(patch.entities) ? patch.entities : []) {
      for (const field of Array.isArray(entity?.fields) ? entity.fields : []) {
        if (!field || typeof field !== 'object' || !('constraints' in field)) continue
        const normalized = normalizeConstraints(field.constraints)
        if (normalized) field.constraints = normalized
        else delete field.constraints
      }
    }
  }
  return envelope
}

/**
 * @param {string} raw
 * @returns {Record<string, unknown> | null}
 */
export function parseEnvelope(raw) {
  const text = stripCodeFence(raw)
  if (!text) return null
  for (const candidate of [text, repairJson(text)]) {
    try {
      const value = JSON.parse(candidate)
      if (looksLikeEnvelope(value)) return normalizeEnvelope(value)
    } catch {
      // 继续尝试提取
    }
  }
  for (const candidate of extractJsonCandidates(text)) {
    for (const fixed of [candidate, repairJson(candidate)]) {
      try {
        const value = JSON.parse(fixed)
        if (looksLikeEnvelope(value)) return normalizeEnvelope(value)
      } catch {
        // 下一个候选
      }
    }
  }
  return null
}

/**
 * @param {string} raw
 * @param {string} delimiter
 * @returns {{ reply: string, envelope: Record<string, unknown> | null }}
 */
export function splitProtocolOutput(raw, delimiter) {
  const text = String(raw ?? '').trim()
  const index = text.indexOf(delimiter)
  if (index === -1) {
    const envelope = parseEnvelope(text)
    if (envelope) {
      const start = text.indexOf('{')
      const reply = start > 0 ? text.slice(0, start).replace(/```[a-zA-Z]*\s*$/, '').trim() : ''
      // 正文里的孤立 {} 不当作结构化更新
      if (Object.keys(envelope).length === 0 && reply) return { reply: text, envelope: null }
      return { reply, envelope }
    }
    return { reply: text, envelope: null }
  }
  const reply = text.slice(0, index).trim()
  const tail = text.slice(index + delimiter.length)
  return { reply, envelope: parseEnvelope(tail) }
}
