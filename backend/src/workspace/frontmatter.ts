/**
 * 极简 YAML frontmatter 解析（只支持本版契约需要的 `key: value`）
 *
 * 需求单文档开头：
 * ---
 * title: 商品管理应用
 * template: builtin-prd
 * ---
 *
 * 不支持嵌套/数组：出现缩进或非 `key: value` 行时记一条错误，但不抛异常
 * （格式错误要能显示在 UI 上，而不是 500）。
 */
import fs from 'node:fs'

export interface FrontmatterResult {
  data: Record<string, string>
  body: string
  errors: string[]
}

function unquote(raw: string): string {
  const value = raw.trim()
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    try {
      return JSON.parse(value) as string
    } catch {
      return value.slice(1, -1)
    }
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) return value.slice(1, -1)
  return value
}

export function parseFrontmatter(text: string): FrontmatterResult {
  const errors: string[] = []
  const normalized = text.replace(/^\uFEFF/, '')
  if (!normalized.startsWith('---')) {
    return { data: {}, body: normalized, errors: ['缺少 frontmatter（文件需以 --- 开头）'] }
  }
  const end = normalized.indexOf('\n---', 3)
  if (end < 0) return { data: {}, body: normalized, errors: ['frontmatter 未闭合（缺少结束的 ---）'] }

  const rawBlock = normalized.slice(3, end)
  const body = normalized.slice(end + 4).replace(/^\r?\n/, '')
  const data: Record<string, string> = {}
  for (const rawLine of rawBlock.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line)
    if (!match) {
      errors.push(`frontmatter 行无法解析：${line}`)
      continue
    }
    data[match[1]] = unquote(match[2])
  }
  return { data, body, errors }
}

export function readFrontmatterFile(file: string): FrontmatterResult & { text: string } {
  const text = fs.readFileSync(file, 'utf8')
  return { ...parseFrontmatter(text), text }
}

/** 按 `## ` 切章节（跳过代码块内的 ##） */
export interface MarkdownSection {
  key: string
  title: string
  level: number
  markdown: string
}

export function splitMarkdownSections(body: string): MarkdownSection[] {
  const sections: MarkdownSection[] = []
  const lines = body.split(/\r?\n/)
  let fence = false
  let current: MarkdownSection | null = null
  const flush = (): void => {
    if (current) {
      current.markdown = current.markdown.replace(/\s+$/, '')
      sections.push(current)
      current = null
    }
  }
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    const match = !fence ? /^(#{1,6})\s+(.+?)\s*$/.exec(line) : null
    if (match) {
      flush()
      const level = match[1].length
      if (level === 1) continue
      current = { key: `h${level}-${sections.length + 1}`, title: match[2], level, markdown: '' }
      continue
    }
    if (current) current.markdown += `${line}\n`
  }
  flush()
  return sections
}
