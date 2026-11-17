/**
 * 需求文档模式协议解析（纯 JS，便于 Node 直接单测）
 *
 * 与结构化需求模式（<<<SPEC_JSON>>>）分离：文档模式使用 <<<DOC_JSON>>>，
 * envelope = { doc?, sections?, title?, nextSteps?, openIssues?, actions? }。
 */
import { extractJsonCandidates, repairJson, stripCodeFence } from '../shared/protocol-output.js'

export const DOC_DELIMITER = '<<<DOC_JSON>>>'

const DOC_KEYS = new Set(['doc', 'sections', 'title', 'nextSteps', 'openIssues', 'actions'])

export function looksLikeDocEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  if (!keys.length) return true
  return keys.some(key => DOC_KEYS.has(key))
}

/** 去掉整篇文档误加的代码块围栏 */
export function unwrapMarkdown(text) {
  let out = String(text ?? '').trim()
  if (out.startsWith('```')) {
    out = out.replace(/^```[a-zA-Z]*\s*/, '')
    if (out.endsWith('```')) out = out.slice(0, -3)
  }
  return out.trim()
}

/** DOC_JSON 里的结构化章节数据（只做浅归一化，稳定 ID 校验在后端） */
export function normalizeOutlineData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const list = key =>
    Array.isArray(raw[key])
      ? raw[key]
          .filter(item => item && typeof item === 'object' && !Array.isArray(item))
          .map(item => ({ ...item }))
      : []
  const data = { scenes: list('scenes'), epics: list('epics'), stories: list('stories') }
  if (!data.scenes.length && !data.epics.length && !data.stories.length) return null
  return data
}

export function normalizeDocEnvelope(value) {
  if (!looksLikeDocEnvelope(value)) return null
  const raw = value && typeof value === 'object' ? value : {}
  const envelope = {}
  if (typeof raw.doc === 'string' && raw.doc.trim()) envelope.doc = unwrapMarkdown(raw.doc)
  if (Array.isArray(raw.sections)) {
    const sections = raw.sections
      .filter(item => item && typeof item === 'object')
      .map(item => {
        const id = typeof item.id === 'string' ? item.id : typeof item.sectionKey === 'string' ? item.sectionKey : ''
        const markdown = typeof item.markdown === 'string' ? item.markdown : ''
        const data = normalizeOutlineData(item.data)
        return {
          id,
          markdown,
          ...(data ? { data } : {}),
          ...(typeof item.title === 'string' && item.title.trim() ? { title: item.title.trim() } : {}),
          ...(item.level === 2 || item.level === 3 ? { level: item.level } : {}),
          ...(typeof item.kind === 'string' && item.kind ? { kind: item.kind } : {})
        }
      })
      .filter(item => item.id || item.title)
    if (sections.length) envelope.sections = sections
  }
  if (typeof raw.title === 'string' && raw.title.trim()) envelope.title = raw.title.trim()
  if (Array.isArray(raw.nextSteps)) {
    const nextSteps = raw.nextSteps
      .filter(item => item && typeof item === 'object' && typeof item.label === 'string' && item.label.trim())
      .map(item => ({
        label: item.label.trim(),
        prompt: typeof item.prompt === 'string' && item.prompt.trim() ? item.prompt.trim() : item.label.trim()
      }))
      .slice(0, 4)
    if (nextSteps.length) envelope.nextSteps = nextSteps
  }
  if (raw.openIssues && typeof raw.openIssues === 'object') {
    const add = Array.isArray(raw.openIssues.add)
      ? raw.openIssues.add
          .filter(item => item && typeof item === 'object' && typeof item.question === 'string' && item.question.trim())
          .map(item => ({ question: item.question.trim() }))
      : []
    if (add.length) envelope.openIssues = { add }
  }
  if (Array.isArray(raw.actions)) {
    const actions = raw.actions
      .filter(item => item && typeof item === 'object' && typeof item.label === 'string' && item.label.trim())
      .map(item => ({ label: item.label.trim(), ...(typeof item.value === 'string' ? { value: item.value } : {}) }))
      .slice(0, 4)
    if (actions.length) envelope.actions = actions
  }
  return envelope
}

export function parseDocEnvelope(raw) {
  const text = stripCodeFence(raw)
  if (!text) return null
  for (const candidate of [text, repairJson(text)]) {
    try {
      const parsed = normalizeDocEnvelope(JSON.parse(candidate))
      if (parsed) return parsed
    } catch {
      // 继续尝试提取
    }
  }
  for (const candidate of extractJsonCandidates(text)) {
    for (const fixed of [candidate, repairJson(candidate)]) {
      try {
        const parsed = normalizeDocEnvelope(JSON.parse(fixed))
        if (parsed) return parsed
      } catch {
        // 下一个候选
      }
    }
  }
  return null
}

/**
 * 拆分模型输出：分隔符前为正文，后为 DOC JSON。
 * 容忍尾随分隔符/代码块/尾逗号；无分隔符时从整段中提取 JSON。
 * @param {string} raw
 * @returns {{ reply: string, envelope: Record<string, unknown> | null }}
 */
export function splitDocOutput(raw) {
  const text = String(raw ?? '').trim()
  const index = text.indexOf(DOC_DELIMITER)
  if (index === -1) {
    const envelope = parseDocEnvelope(text)
    if (envelope) {
      const start = text.indexOf('{')
      const reply = start > 0 ? text.slice(0, start).replace(/```[a-zA-Z]*\s*$/, '').trim() : ''
      if (!Object.keys(envelope).length && reply) return { reply: text, envelope: null }
      return { reply, envelope }
    }
    return { reply: text, envelope: null }
  }
  const reply = text.slice(0, index).trim()
  const tail = text.slice(index + DOC_DELIMITER.length)
  return { reply, envelope: parseDocEnvelope(tail) }
}

function hashText(text) {
  let hash = 5381
  for (let i = 0; i < String(text).length; i += 1) hash = ((hash << 5) + hash + String(text).charCodeAt(i)) >>> 0
  return hash.toString(36)
}

const KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/

function normalizeTitle(title) {
  return String(title ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * 把 AI 的章节更新合并到当前章节，返回新数组（不修改入参）。
 * - 按 sectionKey（id）或标题匹配；
 * - 未匹配的更新：合法 key 直接新增，否则生成 custom-*；
 * - position 重新排序。
 */
export function mergeDocSections(existing, updates) {
  const sections = Array.isArray(existing) ? existing.map(section => ({ ...section })) : []
  const list = Array.isArray(updates) ? updates : []
  const used = new Set(sections.map(section => section.sectionKey))
  for (const update of list) {
    if (!update || typeof update !== 'object') continue
    const key = String(update.id ?? update.sectionKey ?? '').trim()
    const title = String(update.title ?? '').trim()
    let target = key ? sections.find(section => section.sectionKey === key) : undefined
    if (!target && title) target = sections.find(section => normalizeTitle(section.title) === normalizeTitle(title))
    if (!target) {
      const desiredKey = KEY_PATTERN.test(key) ? key : `custom-${hashText(title || `section-${sections.length}`)}`
      const finalKey = used.has(desiredKey) ? `${desiredKey}-${sections.length}` : desiredKey
      target = {
        sectionKey: finalKey,
        title: title || '自定义章节',
        level: update.level === 3 ? 3 : 2,
        kind: typeof update.kind === 'string' && update.kind ? update.kind : 'markdown',
        markdown: '',
        required: Boolean(update.required),
        position: sections.length,
        updatedAt: new Date().toISOString()
      }
      sections.push(target)
      used.add(finalKey)
    }
    if (typeof update.markdown === 'string') target.markdown = update.markdown
    if (update.data && typeof update.data === 'object') target.data = update.data
    if (title) target.title = title
    if (update.level === 2 || update.level === 3) target.level = update.level
  }
  return sections.map((section, index) => ({ ...section, position: index }))
}

const STORY_LINE = /^\s*(?:[-*+]|\d+\.)\s+\S|^\s*#{2,4}\s+\S|作为[^\n]{0,40}(?:我|用户|角色)/m

function storyItemCount(markdown) {
  return String(markdown ?? '')
    .split('\n')
    .filter(line => /^\s*(?:[-*+]|\d+\.)\s+\S/.test(line)).length
}

/**
 * 前端预览用确认校验（后端仍是权威校验）：必填章节非空、epics 至少一个故事；
 * 有结构化数据时校验 Epic/Story/验收标准；待确认/TODO 只做警告，不阻塞。
 */
export function validateDocSections(sections) {
  const list = Array.isArray(sections) ? sections.filter(Boolean) : []
  const errors = []
  const warnings = []
  const epicsSection = list.find(section => section.kind === 'epics')
  const data = epicsSection && epicsSection.data
  const structured = Boolean(
    data &&
      ((Array.isArray(data.epics) && data.epics.some(item => !item.archived)) ||
        (Array.isArray(data.stories) && data.stories.some(item => !item.archived)))
  )

  for (const section of list) {
    const body = String(section.markdown ?? '').trim()
    const structuredBody =
      section.data &&
      ((section.kind === 'scenes' && (section.data.scenes ?? []).some(item => !item.archived)) ||
        (section.kind === 'epics' &&
          ((section.data.epics ?? []).some(item => !item.archived) ||
            (section.data.stories ?? []).some(item => !item.archived))))
    if (section.required && !body && !structuredBody) {
      errors.push({
        sectionKey: section.sectionKey,
        title: section.title,
        message: section.kind === 'epics' ? '至少需要 1 个 Epic / User Story' : '必填章节内容为空'
      })
    }
    if (body && /(待确认|待澄清|TODO)/i.test(body)) {
      warnings.push(`「${section.title}」仍有待确认/待澄清内容`)
    }
    if (section.kind === 'epics' && body && !structuredBody) {
      const count = storyItemCount(body)
      if (count < 1 && !STORY_LINE.test(body)) {
        errors.push({ sectionKey: section.sectionKey, title: section.title, message: '至少需要 1 个用户故事（列表项或故事标题）' })
      }
    }
  }

  if (structured) {
    const epics = (data.epics ?? []).filter(item => !item.archived)
    const stories = (data.stories ?? []).filter(item => !item.archived)
    if (!epics.length) {
      errors.push({ sectionKey: epicsSection?.sectionKey, title: epicsSection?.title, message: '结构化数据里至少需要 1 个 Epic' })
    }
    if (!stories.length) {
      errors.push({ sectionKey: epicsSection?.sectionKey, title: epicsSection?.title, message: '结构化数据里至少需要 1 个 Story' })
    }
    if (stories.length && !stories.some(story => Array.isArray(story.acceptance) && story.acceptance.length)) {
      errors.push({ sectionKey: epicsSection?.sectionKey, title: epicsSection?.title, message: '至少需要 1 个 Story 带验收标准' })
    }
    for (const story of stories) {
      if (!Array.isArray(story.acceptance) || !story.acceptance.length) {
        warnings.push(`${story.id || story.title}「${story.title}」缺少验收标准`)
      }
    }
    // #1.2 提示（不阻塞）：Epic 没有 Story 时设计阶段不会为它生成页面集
    for (const epic of epics) {
      if (!stories.some(story => story.epicId === epic.id)) {
        warnings.push(`${epic.id || epic.title}「${epic.title}」没有 Story；请补充或让 AI 重新生成`)
      }
    }
  } else if (epicsSection) {
    warnings.push('Epics & User Stories 还是纯 Markdown 结构；建议用结构编辑器或“重建结构”建立稳定 ID')
  }

  return { errors, warnings }
}
