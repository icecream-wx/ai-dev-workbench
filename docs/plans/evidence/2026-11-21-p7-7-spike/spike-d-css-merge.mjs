/**
 * P7-7 spike D：结构样式（structure.css）合并可行性 / 冲突清单
 *
 * 只读 templates/design-system/afcenter-app-templates-v1/application-types/<type>/structure.css：
 * - 解析顶层规则与 @media 内规则（模板 CSS 是“一行一规则” + 少量 @media 块）；
 * - 统计各类型的规则数、唯一选择器数；
 * - 统计跨类型“同选择器 + 同规则体”（可去重）与“同选择器 + 不同规则体”（冲突）；
 * - 输出推荐的合并键（@media 条件 + 选择器）与固定顺序。
 *
 * 运行：node spike-d-css-merge.mjs [--json-out <file>]
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const REPO = process.env.REPO_ROOT || path.resolve('E:/work_space_primeton/ai-dev-workbench')
const PACK = path.join(REPO, 'templates', 'design-system', 'afcenter-app-templates-v1')
const TYPES = [
  'enterprise-application-platform',
  'operations-management',
  'data-governance-workbench',
  'incident-response-console'
]

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** 读取从 index 开始的 { ... } 块，返回 { body, end } */
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
  throw new Error('CSS 块未闭合')
}

function norm(value) {
  return value.replace(/\s+/g, ' ').replace(/\s*([{}:;,>~+])\s*/g, '$1').trim()
}

/** 解析为 [{ media, selector, body, key }] */
function parseRules(css) {
  const clean = stripComments(css)
  const rules = []
  let i = 0
  while (i < clean.length) {
    const open = clean.indexOf('{', i)
    if (open < 0) break
    const head = clean.slice(i, open).trim()
    if (head.startsWith('@media')) {
      const block = readBlock(clean, open)
      const inner = parseRules(block.body)
      for (const rule of inner) rules.push({ ...rule, media: norm(head) })
      i = block.end
      continue
    }
    const block = readBlock(clean, open)
    const selector = norm(head)
    const body = norm(block.body)
    if (selector && !selector.startsWith('@')) rules.push({ media: '', selector, body, key: `${selector}|${body}` })
    i = block.end
  }
  return rules
}

function main() {
  const byType = new Map()
  for (const type of TYPES) {
    const file = path.join(PACK, 'application-types', type, 'structure.css')
    const rules = parseRules(fs.readFileSync(file, 'utf8'))
    byType.set(type, rules)
  }

  const selectorsByType = new Map()
  const rulesByKey = new Map() // `${media}||${selector}` -> [{type, body}]
  for (const [type, rules] of byType) {
    const selectors = new Set()
    for (const rule of rules) {
      selectors.add(`${rule.media}||${rule.selector}`)
      const key = `${rule.media}||${rule.selector}`
      const list = rulesByKey.get(key) || []
      list.push({ type, body: rule.body })
      rulesByKey.set(key, list)
    }
    selectorsByType.set(type, selectors)
  }

  const sharedKeys = []
  const conflicts = []
  const withinTypeRepeats = []
  for (const [key, list] of rulesByKey) {
    const types = [...new Set(list.map((item) => item.type))]
    if (types.length < 2) {
      if (list.length > 1 && new Set(list.map((item) => item.body)).size > 1) {
        withinTypeRepeats.push({ key, type: types[0], variants: new Set(list.map((item) => item.body)).size })
      }
      continue
    }
    const bodies = new Set(list.map((item) => item.body))
    if (bodies.size === 1) sharedKeys.push({ key, types, body: list[0].body })
    else conflicts.push({ key, entries: list })
  }

  const totalRules = [...byType.values()].reduce((sum, rules) => sum + rules.length, 0)
  const exactPairs = new Set()
  for (const rules of byType.values()) for (const rule of rules) exactPairs.add(`${rule.media}||${rule.selector}||${rule.body}`)
  const unionSelectors = new Set([...rulesByKey.keys()])
  const mergedRuleCount = exactPairs.size // 只去掉“选择器+规则体完全相同”的重复
  const dedupSaved = totalRules - mergedRuleCount
  const identicalSharedCases = sharedKeys.reduce((sum, item) => sum + (item.types.length - 1), 0)
  const crossTypeDifferentKeys = conflicts.length
  const withinTypeRepeatCount = withinTypeRepeats.reduce((sum, item) => sum + item.variants - 1, 0)

  // 合并顺序建议：按应用类型在 pack 中的出现顺序；完全相同只留一份；同选择器不同规则体按顺序保留（后写覆盖并记录）
  const result = {
    scannedAt: new Date().toISOString(),
    types: TYPES,
    perType: TYPES.map((type) => ({
      type,
      rules: byType.get(type).length,
      uniqueSelectorKeys: selectorsByType.get(type).size,
      mediaRules: byType.get(type).filter((rule) => rule.media).length,
      file: `application-types/${type}/structure.css`
    })),
    totalRules,
    unionSelectorKeys: unionSelectors.size,
    uniqueSelectorBodyPairs: exactPairs.size,
    mergedRuleCountIfDedup: mergedRuleCount,
    dedupSaved,
    identicalSharedCases,
    sharedSelectorCount: sharedKeys.length,
    conflictCount: crossTypeDifferentKeys,
    withinTypeRepeatedSelectorVariants: withinTypeRepeatCount,
    sharedExamples: sharedKeys.slice(0, 20),
    withinTypeRepeats,
    conflicts: conflicts.map((item) => ({
      key: item.key,
      entries: item.entries.map((entry) => ({ type: entry.type, body: entry.body.slice(0, 400) }))
    })),
    mergeAlgorithm: {
      order: TYPES,
      unit: '@media 条件 + 规范化选择器 + 规范化规则体（三元组完全相同才去重）',
      dedup: '三元组完全相同 → 只写一份（保留首次出现位置）',
      conflict: '同选择器不同规则体 → 按固定顺序全部保留（后者生效）并记录冲突清单；不静默删除，发布前可人工确认',
      comments: '输出文件按来源应用类型分节加注释，便于溯源；同一文件内重复选择器的级联顺序保持不变'
    }
  }

  const outArgIndex = process.argv.indexOf('--json-out')
  if (outArgIndex > 0 && process.argv[outArgIndex + 1]) {
    const out = process.argv[outArgIndex + 1]
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8')
    console.log(`[spike-d] JSON 写入 ${out}`)
  }

  console.log('[spike-d] 每类型规则数：')
  for (const item of result.perType) {
    console.log(`  ${item.type}\t规则=${item.rules}\t唯一选择器键=${item.uniqueSelectorKeys}\t@media 内=${item.mediaRules}`)
  }
  console.log(
    `[spike-d] 合计规则=${totalRules} 唯一选择器键=${unionSelectors.size} 最大去重节省=${dedupSaved} 完全相同的跨类型共享=${sharedKeys.length} 冲突=${conflicts.length}`
  )
  console.log('[spike-d] 冲突（同选择器不同规则体）样例：')
  for (const item of conflicts.slice(0, 15)) {
    console.log(`  ${item.key}`)
    for (const entry of item.entries) console.log(`    ${entry.type}: ${entry.body.slice(0, 180)}`)
  }
}

main()
