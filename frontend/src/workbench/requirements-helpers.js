/**
 * 需求视图纯逻辑：模块排序/交换、文档拼装与锚点、错误行合并、会话下拉、85% 文案。
 * 不依赖 Vue/DOM，便于 node --test 单测。
 */
import { artifactErrorLine } from './view-helpers.js'

export const CONTINUATION_TEXT =
  '上一会话因上下文接近上限已归档。工作区 docs/ 内为最新产物；请先阅读 docs/requirements/ 与 docs/design/ 下相关文件后继续。'

/** 稳定排序：order（1-based）→ 文件名 → key；order 非法/缺失置底 */
export function sortModules(modules) {
  return [...(modules ?? [])].sort((left, right) => {
    const leftOrder = Number(left?.order)
    const rightOrder = Number(right?.order)
    const a = Number.isFinite(leftOrder) && leftOrder > 0 ? leftOrder : Number.MAX_SAFE_INTEGER
    const b = Number.isFinite(rightOrder) && rightOrder > 0 ? rightOrder : Number.MAX_SAFE_INTEGER
    if (a !== b) return a - b
    const fileCompare = String(left?.file ?? '').localeCompare(String(right?.file ?? ''))
    if (fileCompare !== 0) return fileCompare
    return String(left?.key ?? '').localeCompare(String(right?.key ?? ''))
  })
}

/**
 * 与相邻模块交换位置：返回两条 PATCH {key, order}（按新位置 1-based 重排这两项）。
 * 越界返回 null；order 相同时也能得到确定结果。
 */
export function moveModuleOrder(modules, key, direction) {
  const list = sortModules(modules)
  const index = list.findIndex(module => module.key === key)
  const target = index + direction
  if (index < 0 || target < 0 || target >= list.length) return null
  const moving = list[index]
  const other = list[target]
  return {
    updates: [
      { key: moving.key, order: target + 1 },
      { key: other.key, order: index + 1 }
    ]
  }
}

export function anchorId(index) {
  return `sec-${index + 1}`
}

/** 模块 → 整篇 Markdown（H1 + 章节）+ TOC（锚点由前端按标题顺序分配） */
export function buildDocument(module) {
  const title = String(module?.title ?? '').trim() || String(module?.key ?? '').trim() || '未命名模块'
  const sections = Array.isArray(module?.sections) ? module.sections : []
  const lines = [`# ${title}`, '']
  const toc = []
  sections.forEach((section, index) => {
    const level = Number(section?.level) === 3 ? 3 : 2
    const sectionTitle = String(section?.title ?? '').trim()
    const id = anchorId(index)
    lines.push(`${'#'.repeat(level)} ${sectionTitle}`, '')
    const body = String(section?.markdown ?? '').trim()
    if (body) lines.push(body, '')
    toc.push({ id, index, level, title: sectionTitle })
  })
  return { markdown: `${lines.join('\n').trimEnd()}\n`, toc }
}

/** 给 MarkdownView 渲染出的标题按顺序补 id（TOC 点击定位用） */
export function applyHeadingAnchors(container, toc) {
  if (!container || !Array.isArray(toc) || !toc.length) return
  const headings = Array.from(container.querySelectorAll('h2, h3'))
  toc.forEach((item, index) => {
    const element = headings[index]
    if (element) element.id = item.id
  })
}

/** 合并 artifacts.errors + 当前模块 warnings，去重成“文件 · 字段 · 说明（期望）” */
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
export function continuationText(moduleKey) {
  const key = String(moduleKey ?? '').trim()
  return key ? `${CONTINUATION_TEXT}\n当前模块：${key}。` : CONTINUATION_TEXT
}

/** 模块项副标题：章节数 + 模板 + 错误/警告数 */
export function moduleMeta(module) {
  const sections = Array.isArray(module?.sections) ? module.sections.length : 0
  const errors = Array.isArray(module?.errors) ? module.errors.length : 0
  const warnings = Array.isArray(module?.warnings) ? module.warnings.length : 0
  const template = String(module?.template ?? '').trim()
  return { sections, errors, warnings, template }
}
