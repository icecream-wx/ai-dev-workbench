/**
 * 需求文档 AI 建议 diff（纯函数，便于 Node 直接单测）
 *
 * 输入：当前章节 + 预览章节（后端 preview 或本地 mergeDocSections 的结果）+ removed。
 * 输出：每节的 change（added/modified/unchanged/removed）、标题变化、行级 LCS diff，
 * 以及“应用选中”需要的 API 载荷（sections + removeSectionKeys）。
 */

const MAX_DIFF_LINES = 400
const MAX_DIFF_CHARS = 40_000
const TRUNCATED_MARK = '…（diff 已截断）'

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function truncateText(text) {
  const value = normalizeText(text)
  if (value.length <= MAX_DIFF_CHARS) return value
  return `${value.slice(0, MAX_DIFF_CHARS)}\n${TRUNCATED_MARK}`
}

function truncateLines(lines) {
  if (lines.length <= MAX_DIFF_LINES) return { lines, truncated: false }
  return { lines: lines.slice(0, MAX_DIFF_LINES).concat(TRUNCATED_MARK), truncated: true }
}

function sameData(left, right) {
  if (!left && !right) return true
  try {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
  } catch {
    return false
  }
}

function changeOf(before, after) {
  if (!before) return 'added'
  if (
    String(before.title ?? '') !== String(after.title ?? '') ||
    (before.level === 3 ? 3 : 2) !== (after.level === 3 ? 3 : 2) ||
    String(before.kind ?? 'markdown') !== String(after.kind ?? 'markdown') ||
    normalizeText(before.markdown) !== normalizeText(after.markdown) ||
    !sameData(before.data, after.data)
  ) {
    return 'modified'
  }
  return 'unchanged'
}

/**
 * 行级 LCS diff：输出 {@link {type:' '|'+'|'-', text:string}[]}。
 * 大文本按行/字符上限截断，避免长文档阻塞 UI。
 */
export function lineDiff(before, after) {
  const start = truncateLines(truncateText(before).split('\n'))
  const end = truncateLines(truncateText(after).split('\n'))
  const a = start.lines
  const b = end.lines
  const n = a.length
  const m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: ' ', text: a[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: '-', text: a[i] })
      i += 1
    } else {
      out.push({ type: '+', text: b[j] })
      j += 1
    }
  }
  while (i < n) {
    out.push({ type: '-', text: a[i] })
    i += 1
  }
  while (j < m) {
    out.push({ type: '+', text: b[j] })
    j += 1
  }
  if ((start.truncated || end.truncated) && out[out.length - 1]?.text !== TRUNCATED_MARK) {
    out.push({ type: ' ', text: TRUNCATED_MARK })
  }
  return out
}

/**
 * 章节 diff。
 * @param {Array} currentSections 当前文档章节
 * @param {Array} previewSections 预览章节（来自 preview 接口或 mergeDocSections）
 * @param {Array} removed 预览允许删除的章节（仅 custom-* 且非必填）
 * @returns {{ sections: Array, counts: {added:number, modified:number, removed:number, unchanged:number} }}
 */
export function diffDocSections(currentSections, previewSections, removed = []) {
  const current = Array.isArray(currentSections) ? currentSections : []
  const preview = Array.isArray(previewSections) ? previewSections : []
  const byKey = new Map(current.map(section => [section.sectionKey, section]))
  const entries = []

  for (const next of preview) {
    if (!next || typeof next !== 'object' || !next.sectionKey) continue
    const before = byKey.get(next.sectionKey)
    const change = changeOf(before, next)
    const beforeMarkdown = normalizeText(before?.markdown)
    const afterMarkdown = normalizeText(next.markdown)
    const entry = {
      sectionKey: next.sectionKey,
      title: next.title ?? before?.title ?? next.sectionKey,
      titleBefore: before?.title ?? '',
      titleChanged: Boolean(before && before.title !== next.title),
      level: next.level === 3 ? 3 : 2,
      kind: next.kind ?? before?.kind ?? 'markdown',
      markdown: afterMarkdown,
      ...(next.data ? { data: next.data } : {}),
      required: Boolean(next.required ?? before?.required),
      change
    }
    if (change === 'modified') {
      entry.markdownBefore = beforeMarkdown
      entry.lineDiff = lineDiff(beforeMarkdown, afterMarkdown)
    }
    entries.push(entry)
  }

  for (const item of Array.isArray(removed) ? removed : []) {
    if (!item || typeof item !== 'object' || !item.sectionKey) continue
    if (entries.some(entry => entry.sectionKey === item.sectionKey)) continue
    const before = byKey.get(item.sectionKey)
    entries.push({
      sectionKey: item.sectionKey,
      title: item.title ?? before?.title ?? item.sectionKey,
      titleBefore: before?.title ?? item.title ?? '',
      titleChanged: false,
      level: before?.level === 3 ? 3 : 2,
      kind: before?.kind ?? 'markdown',
      markdown: '',
      markdownBefore: normalizeText(before?.markdown),
      required: Boolean(item.required ?? before?.required),
      change: 'removed'
    })
  }

  const counts = { added: 0, modified: 0, removed: 0, unchanged: 0 }
  for (const entry of entries) counts[entry.change] += 1
  return { sections: entries, counts }
}

function issueLines(issues) {
  return (Array.isArray(issues) ? issues : [])
    .map(item => (item && typeof item.question === 'string' ? item.question.trim() : ''))
    .filter(Boolean)
    .map(question => `- 待确认：${question}`)
}

/**
 * 生成“应用选中”的 API 载荷。
 *
 * @param {Array} entries diffDocSections().sections
 * @param {object} options
 * @param {string[]} [options.selectedKeys] 勾选的新增/修改章节；缺省为全部 added/modified
 * @param {string[]} [options.removedKeys] 勾选删除的章节；必填/模板章节会被忽略并 warning
 * @param {boolean} [options.includeTitle] 是否同时应用标题
 * @param {string} [options.title] 建议标题
 * @param {boolean} [options.includeIssues] 是否把待澄清问题写入 issues 章节
 * @param {Array<{question:string}>} [options.issues] 待澄清问题
 * @param {object} [options.issuesSection] 当前文档的 issues 章节（没有则 warning，不强行创建）
 * @returns {{ title?: string, sections: Array, removeSectionKeys: string[], warnings: string[] }}
 */
export function buildApplyPayload(entries, options = {}) {
  const list = Array.isArray(entries) ? entries : []
  const defaultSelected = list
    .filter(entry => entry.change === 'added' || entry.change === 'modified')
    .map(entry => entry.sectionKey)
  const selected = new Set(Array.isArray(options.selectedKeys) ? options.selectedKeys : defaultSelected)
  const removedSelected = new Set(Array.isArray(options.removedKeys) ? options.removedKeys : [])
  const warnings = []
  const sections = []
  const removeSectionKeys = []

  for (const entry of list) {
    if (!entry || !entry.sectionKey) continue
    if (entry.change === 'removed') {
      if (!removedSelected.has(entry.sectionKey)) continue
      if (entry.required) {
        warnings.push(`必填章节「${entry.title}」不可删除，已保留`)
        continue
      }
      removeSectionKeys.push(entry.sectionKey)
      continue
    }
    if (!selected.has(entry.sectionKey) || entry.change === 'unchanged') continue
    sections.push({
      id: entry.sectionKey,
      title: entry.title,
      level: entry.level === 3 ? 3 : 2,
      kind: entry.kind || 'markdown',
      markdown: String(entry.markdown ?? ''),
      ...(entry.data ? { data: entry.data } : {})
    })
  }

  if (options.includeIssues && Array.isArray(options.issues) && options.issues.length) {
    const lines = issueLines(options.issues)
    if (!lines.length) {
      // 没有有效问题，跳过
    } else if (!options.issuesSection) {
      warnings.push('当前模板没有“待澄清问题”章节，已跳过写入')
    } else {
      const target = options.issuesSection
      const existing = sections.find(section => section.id === target.sectionKey)
      const base = existing ? existing.markdown : normalizeText(target.markdown)
      const merged = [base.trim(), ...lines].filter(Boolean).join('\n')
      if (existing) {
        existing.markdown = merged
      } else {
        sections.push({
          id: target.sectionKey,
          title: target.title,
          level: target.level === 3 ? 3 : 2,
          kind: target.kind || 'markdown',
          markdown: merged
        })
      }
    }
  }

  const title = options.includeTitle && typeof options.title === 'string' && options.title.trim() ? options.title.trim() : undefined
  return {
    ...(title ? { title } : {}),
    sections,
    removeSectionKeys,
    warnings
  }
}

/** 是否所有可应用项都已勾选（用于“全部应用”高亮/禁用） */
export function allApplicableSelected(entries, selection) {
  const selectable = (Array.isArray(entries) ? entries : []).filter(
    entry => entry.change === 'added' || entry.change === 'modified' || (entry.change === 'removed' && !entry.required)
  )
  if (!selectable.length) return true
  const selected = new Set(Array.isArray(selection) ? selection : [])
  return selectable.every(entry => selected.has(entry.sectionKey))
}

/**
 * 持久化前裁剪 AI 建议（R2b）：删除各 entry 的行级 diff，
 * 保留应用所需的 markdownBefore/markdown/applied/ignored 等字段。
 */
export function trimSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== 'object') return suggestion
  const sections = Array.isArray(suggestion.sections)
    ? suggestion.sections.map(entry => {
        if (!entry || typeof entry !== 'object') return entry
        const copy = { ...entry }
        delete copy.lineDiff
        return copy
      })
    : []
  return { ...suggestion, sections }
}

/**
 * 加载历史建议后补回行级 diff（R2b）：modified 且缺 lineDiff 时用
 * markdownBefore/markdown 现算；其它状态保持原样。
 */
export function hydrateSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== 'object') return suggestion
  const sections = Array.isArray(suggestion.sections)
    ? suggestion.sections.map(entry => {
        if (!entry || typeof entry !== 'object') return entry
        if (entry.change !== 'modified') return entry
        if (Array.isArray(entry.lineDiff) && entry.lineDiff.length) return entry
        if (typeof entry.markdownBefore !== 'string') return entry
        return { ...entry, lineDiff: lineDiff(entry.markdownBefore, entry.markdown) }
      })
    : []
  return { ...suggestion, sections }
}
