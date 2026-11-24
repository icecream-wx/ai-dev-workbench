/**
 * 需求视图纯逻辑（D1 单文档）：文档拼装/TOC、Epic/Story 识别、错误行合并、会话下拉、85% 文案。
 * 不依赖 Vue/DOM，便于 node --test 单测。
 */
import { artifactErrorLine } from './view-helpers.js'

export const CONTINUATION_TEXT =
  '上一会话因上下文接近上限已归档。工作区 docs/ 内为最新产物；请先阅读 docs/requirements/requirements.md 与 docs/design/ 下相关文件后继续。'

const EPIC_PATTERN = /^(EP-\d{3,})\s*(.*)$/
const STORY_PATTERN = /^(US-\d{3,})\s*(.*)$/

export function anchorId(index) {
  return `sec-${index + 1}`
}

/** 章节标题 → Epic/Story 识别（返回 id/title/kind；非 Epic/Story 返回 null） */
export function outlineKind(title) {
  const text = String(title ?? '').trim()
  const epic = EPIC_PATTERN.exec(text)
  if (epic) return { id: epic[1], title: epic[2].trim(), kind: 'epic' }
  const story = STORY_PATTERN.exec(text)
  if (story) return { id: story[1], title: story[2].trim(), kind: 'story' }
  return null
}

/** 需求单文档 → 整篇 Markdown（H1 + 章节）+ TOC（锚点由前端按标题顺序分配） */
export function buildDocument(requirement) {
  const title = String(requirement?.title ?? '').trim() || '需求文档'
  const sections = Array.isArray(requirement?.sections) ? requirement.sections : []
  const lines = [`# ${title}`, '']
  const toc = []
  sections.forEach((section, index) => {
    const level = Number(section?.level) === 3 ? 3 : Number(section?.level) === 4 ? 4 : 2
    const sectionTitle = String(section?.title ?? '').trim()
    const id = anchorId(index)
    lines.push(`${'#'.repeat(level)} ${sectionTitle}`, '')
    const body = String(section?.markdown ?? '').trim()
    if (body) lines.push(body, '')
    const outline = outlineKind(sectionTitle)
    toc.push({
      id,
      index,
      level,
      title: sectionTitle,
      ...(outline ? { kind: outline.kind, key: outline.id } : {})
    })
  })
  return { markdown: `${lines.join('\n').trimEnd()}\n`, toc }
}

/** 给 MarkdownView 渲染出的标题按顺序补 id（TOC 点击定位用） */
export function applyHeadingAnchors(container, toc) {
  if (!container || !Array.isArray(toc) || !toc.length) return
  const headings = Array.from(container.querySelectorAll('h2, h3, h4'))
  toc.forEach((item, index) => {
    const element = headings[index]
    if (element) element.id = item.id
  })
}

/** 「问 AI」可定位章节（h2/h3；h4 Story 不显示按钮） */
export function askableSections(toc) {
  return (Array.isArray(toc) ? toc : []).filter(item => {
    const level = Number(item?.level)
    return level === 2 || level === 3
  })
}

/** 章节「问 AI」的隐藏上下文（发送时随消息带给后端；不展示给用户） */
export function sectionAskFocus(item) {
  const anchor = String(item?.id ?? '').trim()
  if (!anchor) return null
  const level = Number(item?.level)
  const key = String(item?.key ?? '').trim()
  return {
    kind: 'requirements-section',
    anchor,
    title: String(item?.title ?? '').trim(),
    level: Number.isFinite(level) ? level : 0,
    ...(key ? { key } : {})
  }
}

/** 章节「问 AI」默认提问（只填入输入框，不自动发送；空标题用「本章节」） */
export function sectionAskPrompt(item) {
  const title = String(item?.title ?? '').trim() || '本章节'
  return `请基于「${title}」这一章节，补齐目标、范围与验收标准。`
}

/** 需求摘要：Epic/Story 数与文档标题 */
export function requirementSummary(requirement) {  const epics = Array.isArray(requirement?.epics) ? requirement.epics : []
  const storyCount = epics.reduce(
    (total, epic) => total + (Array.isArray(epic?.stories) ? epic.stories.length : 0),
    0
  )
  return {
    exists: Boolean(requirement?.exists),
    title: String(requirement?.title ?? '').trim(),
    epicCount: epics.length,
    storyCount,
    sectionCount: Array.isArray(requirement?.sections) ? requirement.sections.length : 0
  }
}

/** 合并 artifacts.errors + warnings，去重成“文件 · 字段 · 说明（期望）” */
export function mergeArtifactLines(errors, warnings, file = '') {
  const lines = []
  const seen = new Set()
  const push = line => {
    const text = String(line ?? '').trim()
    if (!text || seen.has(text)) return
    seen.add(text)
    lines.push(text)
  }
  for (const error of errors ?? []) {
    push(
      artifactErrorLine({
        ...error,
        file: String(error?.file ?? '').trim() || String(file ?? '').trim()
      })
    )
  }
  for (const warning of warnings ?? []) {
    push(`${file || '文档'} · 警告 · ${String(warning ?? '').trim()}`)
  }
  return lines
}

/** 「让 AI 修」填入 Composer 的文本（不自动发送）；过长时截断 */
export function composerFixText(lines, maxChars = 600) {
  const text = (lines ?? []).filter(Boolean).join('；')
  if (!text) return ''
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`
}

/** 历史下拉：最近 N 个会话（lastActive → updated → created 倒序） */
export function recentSessions(sessions, limit = 5) {
  const score = session => {
    const value = session?.lastActiveAt ?? session?.updatedAt ?? session?.createdAt
    const time = value ? new Date(value).getTime() : 0
    return Number.isFinite(time) ? time : 0
  }
  return [...(sessions ?? [])]
    .sort((left, right) => score(right) - score(left))
    .slice(0, limit)
    .map(session => ({
      id: session.id,
      label: String(session.displayTitle ?? session.title ?? session.id),
      status: session.status,
      active: session.status === 'active'
    }))
}

/** 85% 红线：危险级别才显示非阻塞横幅 */
export function needsContextBanner(level) {
  return level === 'danger'
}

/** 「开新会话继续」填入 Composer 的确定性衔接文案（不调模型、不自动发送） */
export function continuationText() {
  return CONTINUATION_TEXT
}
