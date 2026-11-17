/**
 * 设计模式协议解析（纯 JS，便于 Node 单测）
 *
 * 设计对话使用 <<<DESIGN_JSON>>>，envelope =
 *   { entities?, pageSets?, nextSteps?, openIssues?, actions? }。
 * AI 可能只返回被修改的实体/页面集，前端按 id/name/sceneKey 合并后整体保存。
 */
import { extractJsonCandidates, repairJson, stripCodeFence } from '../shared/protocol-output.js'

export const DESIGN_DELIMITER = '<<<DESIGN_JSON>>>'

const DESIGN_KEYS = new Set(['entities', 'pageSets', 'nextSteps', 'openIssues', 'actions'])

function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function looksLikeDesignEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  if (!keys.length) return true
  return keys.some(key => DESIGN_KEYS.has(key))
}

export function normalizeDesignEnvelope(value) {
  if (!looksLikeDesignEnvelope(value)) return null
  const raw = value && typeof value === 'object' ? value : {}
  const envelope = {}
  if (Array.isArray(raw.entities)) {
    const entities = raw.entities
      .filter(item => item && typeof item === 'object' && !Array.isArray(item))
      .map(item => ({
        ...item,
        ...(asString(item.name) ? { name: asString(item.name) } : {}),
        ...(Array.isArray(item.fields) ? { fields: item.fields.filter(field => field && typeof field === 'object') } : {}),
        ...(Array.isArray(item.relations) ? { relations: item.relations.filter(rel => rel && typeof rel === 'object') } : {})
      }))
      .filter(item => item.name)
    if (entities.length) envelope.entities = entities
  }
  if (Array.isArray(raw.pageSets)) {
    const pageSets = raw.pageSets
      .filter(item => item && typeof item === 'object' && !Array.isArray(item))
      .map(item => ({
        ...item,
        ...(asString(item.title) ? { title: asString(item.title) } : {}),
        ...(asString(item.sceneKey) ? { sceneKey: asString(item.sceneKey) } : {}),
        ...(Array.isArray(item.pages)
          ? { pages: item.pages.filter(page => page && typeof page === 'object' && !Array.isArray(page)) }
          : {})
      }))
      .filter(item => item.title || item.sceneKey)
    if (pageSets.length) envelope.pageSets = pageSets
  }
  if (Array.isArray(raw.nextSteps)) {
    const nextSteps = raw.nextSteps
      .filter(item => item && typeof item === 'object' && asString(item.label))
      .map(item => ({ label: asString(item.label), prompt: asString(item.prompt) || asString(item.label) }))
      .slice(0, 4)
    if (nextSteps.length) envelope.nextSteps = nextSteps
  }
  if (raw.openIssues && typeof raw.openIssues === 'object') {
    const add = Array.isArray(raw.openIssues.add)
      ? raw.openIssues.add
          .filter(item => item && typeof item === 'object' && asString(item.question))
          .map(item => ({ question: asString(item.question) }))
      : []
    if (add.length) envelope.openIssues = { add }
  }
  if (Array.isArray(raw.actions)) {
    const actions = raw.actions
      .filter(item => item && typeof item === 'object' && asString(item.label))
      .map(item => ({ label: asString(item.label) }))
      .slice(0, 4)
    if (actions.length) envelope.actions = actions
  }
  return envelope
}

export function parseDesignEnvelope(raw) {
  const text = stripCodeFence(raw)
  if (!text) return null
  for (const candidate of [text, repairJson(text)]) {
    try {
      const parsed = normalizeDesignEnvelope(JSON.parse(candidate))
      if (parsed) return parsed
    } catch {
      // 继续尝试提取
    }
  }
  for (const candidate of extractJsonCandidates(text)) {
    for (const fixed of [candidate, repairJson(candidate)]) {
      try {
        const parsed = normalizeDesignEnvelope(JSON.parse(fixed))
        if (parsed) return parsed
      } catch {
        // 下一个候选
      }
    }
  }
  return null
}

/** 拆分模型输出：分隔符前为正文，后为 DESIGN JSON；容忍尾随分隔符/代码块/尾逗号 */
export function splitDesignOutput(raw) {
  const text = String(raw ?? '').trim()
  const index = text.indexOf(DESIGN_DELIMITER)
  if (index === -1) {
    const envelope = parseDesignEnvelope(text)
    if (envelope) {
      const start = text.indexOf('{')
      const reply = start > 0 ? text.slice(0, start).replace(/```[a-zA-Z]*\s*$/, '').trim() : ''
      if (!Object.keys(envelope).length && reply) return { reply: text, envelope: null }
      return { reply, envelope }
    }
    return { reply: text, envelope: null }
  }
  const reply = text.slice(0, index).trim()
  const tail = text.slice(index + DESIGN_DELIMITER.length)
  return { reply, envelope: parseDesignEnvelope(tail) }
}

function normalizeKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

function mergeFieldLists(existing, updates) {
  if (!Array.isArray(updates)) return existing
  const current = Array.isArray(existing) ? existing : []
  const byName = new Map(current.map(field => [normalizeKey(field.name), field]))
  return updates.map((update, index) => {
    const matched = byName.get(normalizeKey(update.name)) ?? current[index]
    return {
      ...(matched ?? {}),
      ...update,
      ...(Array.isArray(update.options) ? { options: update.options.map(String).filter(Boolean) } : {})
    }
  })
}

/** 合并实体：按 id/name 匹配；未出现的实体保留（避免模型漏掉时被误删） */
export function mergeEntities(existing, updates) {
  const current = Array.isArray(existing) ? existing.map(item => ({ ...item })) : []
  const list = Array.isArray(updates) ? updates : []
  const used = new Set()
  for (const update of list) {
    if (!update || typeof update !== 'object') continue
    const id = asString(update.id)
    const name = asString(update.name)
    const index = current.findIndex(
      item => (id && item.id === id) || (name && normalizeKey(item.name) === normalizeKey(name))
    )
    if (index >= 0) {
      const matched = current[index]
      used.add(matched.id)
      current[index] = {
        ...matched,
        ...(name ? { name } : {}),
        ...(asString(update.tableName) ? { tableName: asString(update.tableName) } : {}),
        ...(typeof update.description === 'string' ? { description: update.description } : {}),
        ...(Array.isArray(update.fields) ? { fields: mergeFieldLists(matched.fields, update.fields) } : {}),
        ...(Array.isArray(update.relations) ? { relations: update.relations } : {}),
        ...(Array.isArray(update.requirementRefs) ? { requirementRefs: update.requirementRefs.map(String) } : {}),
        ...(Array.isArray(update.sourceSections) ? { sourceSections: update.sourceSections.map(String) } : {}),
        status: 'draft'
      }
    } else if (name) {
      current.push({
        id,
        name,
        tableName: asString(update.tableName),
        description: asString(update.description),
        fields: mergeFieldLists([], update.fields),
        relations: Array.isArray(update.relations) ? update.relations : [],
        requirementRefs: Array.isArray(update.requirementRefs) ? update.requirementRefs.map(String) : [],
        sourceSections: Array.isArray(update.sourceSections) ? update.sourceSections.map(String) : [],
        status: 'draft',
        position: current.length
      })
    }
  }
  return current.map((item, index) => ({ ...item, position: index }))
}

function mergePages(existing, updates, pageSetId) {
  const current = Array.isArray(existing) ? existing.map(item => ({ ...item })) : []
  const list = Array.isArray(updates) ? updates : []
  for (const update of list) {
    if (!update || typeof update !== 'object') continue
    const id = asString(update.id)
    const pageKey = asString(update.pageKey)
    const title = asString(update.title)
    const index = current.findIndex(
      item => (id && item.id === id) || (pageKey && item.pageKey === pageKey) || (title && item.title === title && item.type === update.type)
    )
    if (index >= 0) {
      const matched = current[index]
      current[index] = {
        ...matched,
        ...(title ? { title } : {}),
        ...(asString(update.type) ? { type: update.type } : {}),
        ...(update.entityId !== undefined ? { entityId: update.entityId } : {}),
        ...(Array.isArray(update.requirementRefs) ? { requirementRefs: update.requirementRefs.map(String) } : {}),
        ...(update.spec && typeof update.spec === 'object' ? { spec: { ...(matched.spec ?? {}), ...update.spec } } : {}),
        ...(update.layout && typeof update.layout === 'object' ? { layout: { ...(matched.layout ?? {}), ...update.layout } } : {}),
        status: 'draft'
      }
    } else {
      current.push({
        id,
        pageSetId,
        pageKey,
        title: title || '新页面',
        type: asString(update.type) || 'list',
        entityId: update.entityId ?? null,
        requirementRefs: Array.isArray(update.requirementRefs) ? update.requirementRefs.map(String) : [],
        spec: update.spec && typeof update.spec === 'object' ? update.spec : {},
        layout: update.layout && typeof update.layout === 'object' ? update.layout : {},
        status: 'draft',
        position: current.length
      })
    }
  }
  return current.map((item, index) => ({ ...item, position: index }))
}

/** 合并页面集：按 id/sceneKey/title 匹配；未出现的页面集保留 */
export function mergePageSets(existing, updates) {
  const current = Array.isArray(existing) ? existing.map(item => ({ ...item, pages: Array.isArray(item.pages) ? [...item.pages] : [] })) : []
  const list = Array.isArray(updates) ? updates : []
  for (const update of list) {
    if (!update || typeof update !== 'object') continue
    const id = asString(update.id)
    const sceneKey = asString(update.sceneKey)
    const title = asString(update.title)
    const index = current.findIndex(
      item => (id && item.id === id) || (sceneKey && item.sceneKey === sceneKey) || (title && normalizeKey(item.title) === normalizeKey(title))
    )
    if (index >= 0) {
      const matched = current[index]
      current[index] = {
        ...matched,
        ...(title ? { title } : {}),
        ...(sceneKey ? { sceneKey } : {}),
        ...(update.epicId !== undefined ? { epicId: update.epicId || null } : {}),
        ...(Array.isArray(update.storyIds) ? { storyIds: update.storyIds.map(String) } : {}),
        ...(typeof update.description === 'string' ? { description: update.description } : {}),
        ...(Array.isArray(update.pages) ? { pages: mergePages(matched.pages, update.pages, matched.id) } : {}),
        status: 'draft'
      }
    } else if (title || sceneKey) {
      current.push({
        id,
        sceneKey: sceneKey || `scene-${current.length + 1}`,
        epicId: update.epicId || null,
        storyIds: Array.isArray(update.storyIds) ? update.storyIds.map(String) : [],
        title: title || sceneKey,
        description: asString(update.description),
        status: 'draft',
        position: current.length,
        pages: mergePages([], update.pages, id)
      })
    }
  }
  return current.map((item, index) => ({ ...item, position: index }))
}

/** 应用 envelope：返回需要保存的完整 entities/pageSets 与是否有变更 */
export function applyDesignEnvelope(current, envelope) {
  const hasEntities = Array.isArray(envelope?.entities) && envelope.entities.length > 0
  const hasPageSets = Array.isArray(envelope?.pageSets) && envelope.pageSets.length > 0
  return {
    entities: hasEntities ? mergeEntities(current?.entities, envelope.entities) : current?.entities ?? [],
    pageSets: hasPageSets ? mergePageSets(current?.pageSets, envelope.pageSets) : current?.pageSets ?? [],
    changed: hasEntities || hasPageSets
  }
}
