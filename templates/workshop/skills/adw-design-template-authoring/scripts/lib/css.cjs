/**
 * P7-7a 结构样式（structure.css）解析 / 合并（纯 CommonJS，无外部依赖）
 *
 * 算法（spike D，设计稿 §8.4 / 附录 D）：
 * - 解析单位：顶层 `selector { body }` + `@media <cond> { ...内部规则 }`；
 * - 去注释（比较时规范化空白）；输出保留首次出现的原始规则文本；
 * - 去重单位：`(media, 规范化选择器, 规范化规则体)` 三元组完全相同 → 只写首次出现的一份；
 * - 同选择器不同规则体：按固定来源顺序全部保留（后写覆盖）并记录冲突；
 * - 输出按来源类型分节（`===== <type> =====` 注释）。
 *
 * 计数口径与 spike D 一致：只统计普通规则 + @media 内规则（@keyframes 等 at-rule 记入
 * `atRules`，单独保留输出、不计入 793 基线）。内置 4 套结构：793 条 → 514 唯一三元组
 * （去重 279 条），跨类型真冲突 3 条。
 */

/** 把注释替换为等长空白，保证索引仍对应原文 */
function blankComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '))
}

function readBlock(css, index) {
  let depth = 0
  for (let i = index; i < css.length; i += 1) {
    const char = css[i]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return { body: css.slice(index + 1, i), end: i + 1 }
    }
  }
  return null
}

function normalize(value) {
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .trim()
}

/**
 * 解析 structure.css。
 * @returns {{ rules: Array<{ media, selector, body, mediaRaw, headRaw, bodyRaw }>, atRules: string[], warnings: object[] }}
 */
function parseStructureCss(css) {
  let source = String(css || '')
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1)
  const clean = blankComments(source)
  const rules = []
  const atRules = []
  const warnings = []
  let i = 0
  while (i < clean.length) {
    const open = clean.indexOf('{', i)
    if (open < 0) break
    const head = clean.slice(i, open).trim()
    const block = readBlock(clean, open)
    if (!block) {
      warnings.push({
        code: 'css-invalid',
        path: 'structure.css',
        message: `CSS 块未闭合（偏移 ${open}），已忽略剩余内容`
      })
      break
    }
    if (head.startsWith('@media')) {
      const media = normalize(head)
      const inner = parseStructureCss(block.body)
      for (const rule of inner.rules) {
        rules.push({ ...rule, media, mediaRaw: rule.mediaRaw || media.replace(/^@media\s*/, '') })
      }
      atRules.push(...inner.atRules)
      warnings.push(...inner.warnings)
    } else if (head.startsWith('@')) {
      // @keyframes 等：原样保留（不计入规则基线）
      atRules.push(`${clean.slice(i, open).trim()} {${source.slice(open + 1, block.end - 1)}}`)
    } else {
      const selector = normalize(head)
      if (selector) {
        const headRaw = clean.slice(i, open).trim()
        const mediaRaw = ''
        rules.push({
          media: '',
          mediaRaw,
          selector,
          body: normalize(block.body),
          headRaw,
          bodyRaw: source.slice(open + 1, block.end - 1)
        })
      }
    }
    i = block.end
  }
  return { rules, atRules, warnings }
}

function emitMediaBlock(mediaRaw, rules) {
  const lines = [`@media ${mediaRaw} {`]
  for (const rule of rules) lines.push(`${rule.headRaw} {${rule.bodyRaw}}`)
  lines.push('}')
  return lines.join('\n')
}

function emitSection(type, rules, atRules) {
  const lines = [`/* ===== ${type} ===== */`]
  for (const atRule of atRules) lines.push(atRule)
  let pendingMedia = ''
  let mediaRules = []
  const flush = () => {
    if (!pendingMedia || !mediaRules.length) return
    lines.push(emitMediaBlock(mediaRules[0].mediaRaw || pendingMedia, mediaRules))
    mediaRules = []
  }
  for (const rule of rules) {
    if (!rule.media) {
      flush()
      pendingMedia = ''
      lines.push(`${rule.headRaw} {${rule.bodyRaw}}`)
      continue
    }
    if (pendingMedia && pendingMedia !== rule.media) flush()
    pendingMedia = rule.media
    mediaRules.push(rule)
  }
  flush()
  return lines.join('\n')
}

/**
 * 合并多个来源类型的 structure.css。
 *
 * @param {Array<{ type: string, css: string }>} sources 固定顺序（reference 首次出现顺序 + baseApplicationType）
 * @returns {{ css, sources: string[], totalRules: number, rules: number, uniqueTriples: number,
 *             deduped: number, atRules: number, conflicts: Array<{selector, media, sources, effect}>, warnings: object[] }}
 */
function mergeStructureCss(sources) {
  const list = Array.isArray(sources) ? sources.filter(item => item && item.type) : []
  const seen = new Set()
  const seenAtRules = new Set()
  const bySelector = new Map()
  const warnings = []
  const sections = []
  let totalRules = 0
  let emitted = 0
  let atRuleCount = 0

  for (const source of list) {
    const type = String(source.type)
    const parsed = parseStructureCss(source.css)
    warnings.push(...parsed.warnings)
    const keptAtRules = []
    for (const atRule of parsed.atRules) {
      const key = normalize(atRule)
      if (seenAtRules.has(key)) continue
      seenAtRules.add(key)
      keptAtRules.push(atRule)
      atRuleCount += 1
    }
    const kept = []
    for (const rule of parsed.rules) {
      totalRules += 1
      const triple = `${rule.media}||${rule.selector}||${rule.body}`
      const selectorKey = `${rule.media}||${rule.selector}`
      const previous = bySelector.get(selectorKey)
      if (previous === undefined) bySelector.set(selectorKey, { body: rule.body, types: [type] })
      else if (previous.body !== rule.body && !previous.types.includes(type)) previous.types.push(type)
      if (seen.has(triple)) continue
      seen.add(triple)
      kept.push(rule)
      emitted += 1
    }
    if (kept.length || keptAtRules.length) sections.push(emitSection(type, kept, keptAtRules))
  }

  const conflicts = []
  for (const [selectorKey, entry] of bySelector.entries()) {
    if (entry.types.length < 2) continue
    const separator = selectorKey.indexOf('||')
    const media = selectorKey.slice(0, separator)
    const selector = selectorKey.slice(separator + 2)
    conflicts.push({
      selector,
      media,
      sources: [...entry.types],
      effect: '后者覆盖前者；预览以合并顺序靠后的来源类型样式为准'
    })
  }
  for (const conflict of conflicts) {
    warnings.push({
      code: 'css-conflict',
      path: conflict.media ? `${conflict.media} ${conflict.selector}` : conflict.selector,
      message: `同选择器不同规则体：${conflict.sources.join(' → ')}（全部保留，后者生效）`
    })
  }

  const css = `${sections.join('\n\n')}${sections.length ? '\n' : ''}`
  return {
    css,
    sources: list.map(source => String(source.type)),
    totalRules,
    rules: emitted,
    uniqueTriples: seen.size,
    deduped: totalRules - emitted,
    atRules: atRuleCount,
    conflicts,
    warnings
  }
}

module.exports = {
  parseStructureCss,
  mergeStructureCss,
  normalize
}
