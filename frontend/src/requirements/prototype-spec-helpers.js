/**
 * 需求阶段 AI 参考原型 UI 纯函数（M7-2，便于 Node 直接单测）
 *
 * 数据来自 `GET /requirements-prototype` 的 `spec`（预览规格）与 M7 的 `pageSets`
 * （Epic→页面集范围）。这里只做展示层规则：
 * - spec 实体/页面 → 设计渲染器可用的 SpecEntity / SpecPage；
 * - 按 Epic 分组（无 epicId 的进「其他页面」）、选中回退；
 * - 顶部统计、Story 覆盖、过期/空态文案。
 */

import { typeLabel } from './prototype-helpers.js'

/** 「其他页面」分组（无 epicId / epicId 不在当前 pageSets 的页面） */
export const SPEC_OTHER_GROUP_KEY = 'other'
export const SPEC_OTHER_TITLE = '其他页面'

function pagesOfSpec(spec) {
  return spec && Array.isArray(spec.pages) ? spec.pages.filter(Boolean) : []
}

function entitiesOfSpec(spec) {
  return spec && Array.isArray(spec.entities) ? spec.entities.filter(Boolean) : []
}

/** spec 实体 → SpecEntity（渲染器契约）；decimal→number，ref 带目标实体 id */
export function toSpecEntity(entity) {
  if (!entity || !Array.isArray(entity.fields)) return undefined
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description ?? '',
    status: 'draft',
    fields: entity.fields.filter(Boolean).map(field => {
      const type = field.type === 'decimal' ? 'number' : field.type
      return {
        name: field.name,
        label: field.label,
        type,
        ...(field.required ? { required: true } : {}),
        ...(field.unique ? { unique: true } : {}),
        ...(type === 'enum' && field.options?.length ? { options: field.options } : {}),
        ...(type === 'ref' && field.target ? { target: field.target } : {}),
        ...(field.note ? { note: field.note } : {})
      }
    })
  }
}

export function entityById(spec, entityId) {
  if (!entityId) return undefined
  return entitiesOfSpec(spec).find(entity => entity.id === entityId)
}

/** spec 页面 → SpecPage（渲染器契约）；entity 字段为实体 id */
export function toSpecPage(page) {
  if (!page) return undefined
  return {
    id: page.id,
    type: page.type ?? 'list',
    title: page.title ?? '',
    ...(page.entityId ? { entity: page.entityId } : {}),
    ...(Array.isArray(page.fields) && page.fields.length ? { fields: page.fields } : {}),
    ...(Array.isArray(page.actions) && page.actions.length ? { actions: page.actions } : {}),
    status: 'draft'
  }
}

/**
 * 按 M7 页面集（Epic）顺序分组 AI 页面；无 epicId 或 epicId 不在 pageSets 的进「其他页面」（最后）。
 * key 稳定：`epic:<EPIC-ID>` / `other`；空 Epic 也保留（chip 显示 0）。
 */
export function groupPagesByEpic(spec, pageSets) {
  if (!spec || !Array.isArray(spec.pages)) return []
  const pages = pagesOfSpec(spec)
  const byEpic = new Map()
  for (const page of pages) {
    if (!page.epicId) continue
    const list = byEpic.get(page.epicId) ?? []
    list.push(page)
    byEpic.set(page.epicId, list)
  }

  const groups = []
  const seen = new Set()
  const epicIds = new Set()
  for (const set of Array.isArray(pageSets) ? pageSets : []) {
    if (!set || !set.epicId) continue
    if (seen.has(set.epicId)) continue
    seen.add(set.epicId)
    epicIds.add(set.epicId)
    groups.push({
      key: `epic:${set.epicId}`,
      epicId: set.epicId,
      title: set.title || set.epicId,
      pages: byEpic.get(set.epicId) ?? []
    })
  }

  const other = pages.filter(page => !page.epicId || !epicIds.has(page.epicId))
  if (other.length) {
    groups.push({ key: SPEC_OTHER_GROUP_KEY, epicId: null, title: SPEC_OTHER_TITLE, pages: other })
  }
  return groups
}

/** 选中回退：分组丢失 → 首组；页面丢失 → 该组第一页；空组 → pageId '' */
export function ensureSpecSelection(groups, previous = {}) {
  const list = Array.isArray(groups) ? groups : []
  if (!list.length) return { groupKey: '', pageId: '' }
  const prevGroupKey = typeof previous.groupKey === 'string' ? previous.groupKey : ''
  const group = list.find(item => item.key === prevGroupKey) ?? list[0]
  const pages = Array.isArray(group.pages) ? group.pages : []
  const prevPageId = typeof previous.pageId === 'string' ? previous.pageId : ''
  const page = pages.find(item => item.id === prevPageId) ?? pages[0] ?? null
  return { groupKey: group.key, pageId: page ? page.id : '' }
}

export function findSpecGroup(groups, groupKey) {
  if (!groupKey) return null
  return (Array.isArray(groups) ? groups : []).find(group => group.key === groupKey) ?? null
}

export function findSpecPage(groups, groupKey, pageId) {
  const group = findSpecGroup(groups, groupKey)
  if (!group || !pageId) return null
  return (group.pages ?? []).find(page => page.id === pageId) ?? null
}

/** `2 实体 · 8 字段 · 3 页面`（stats 缺失时按数组推导） */
export function specMetaLabel(spec) {
  if (!spec) return ''
  const entities = Number.isFinite(spec.stats?.entities) ? spec.stats.entities : entitiesOfSpec(spec).length
  const pages = Number.isFinite(spec.stats?.pages) ? spec.stats.pages : pagesOfSpec(spec).length
  const fields = Number.isFinite(spec.stats?.fields)
    ? spec.stats.fields
    : entitiesOfSpec(spec).reduce((sum, entity) => sum + (Array.isArray(entity.fields) ? entity.fields.length : 0), 0)
  return `${entities} 实体 · ${fields} 字段 · ${pages} 页面`
}

/** `Story 覆盖 6/8`；无 Story → `Story 覆盖 —` */
export function coverageLabel(coverage) {
  const stories = Number.isFinite(coverage?.stories) ? coverage.stories : 0
  const covered = Number.isFinite(coverage?.coveredStories) ? coverage.coveredStories : 0
  if (stories <= 0) return 'Story 覆盖 —'
  return `Story 覆盖 ${covered}/${stories}`
}

/** 空态的范围统计：`2 Epic · 3 Story · 3 页` */
export function rangeLabel(stats) {
  const epics = Number.isFinite(stats?.epics) ? stats.epics : 0
  const stories = Number.isFinite(stats?.stories) ? stats.stories : 0
  const pages = Number.isFinite(stats?.pages) ? stats.pages : 0
  return `${epics} Epic · ${stories} Story · ${pages} 页`
}

export function specStateLabel(specState) {
  switch (specState?.status) {
    case 'ready':
      return '可评审'
    case 'stale':
      return '需求已更新，建议重新生成'
    default:
      return '未生成'
  }
}

/** 空态原因：无模块 / 未生成规格 / 正常 */
export function specEmptyReason(preview) {
  if (!preview) return ''
  if (!preview.module) return 'no-module'
  if (!preview.spec) return 'missing-spec'
  return ''
}

export function baseLabel(spec) {
  const version = Number.isFinite(spec?.base?.docVersion) ? spec.base.docVersion : 0
  return `基v${version}`
}

/** 生成时间：本地 `YYYY-MM-DD HH:mm`（非法/缺失 → ''） */
export function generatedAtLabel(value) {
  if (typeof value !== 'string' || !value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = number => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function specPageTypeLabel(type) {
  return typeLabel(type)
}

export function specPageTitle(page) {
  const title = typeof page?.title === 'string' ? page.title.trim() : ''
  return title || '未命名页面'
}

export function specEntityOfPage(spec, page) {
  return entityById(spec, page?.entityId)
}

/** 错误诊断片段长度上限（与后端 300 字对齐；前端再兜一层） */
export const SPEC_ERROR_DETAIL_LIMIT = 300

/**
 * 生成失败错误 → `{ message, detail }`（M7-2b）
 * - message：Error.message（非 Error 转字符串）；
 * - detail：仅错误对象带非空字符串 `detail` 时返回；超长按头 150 + `…` + 尾 150 截断。
 */
export function specErrorOf(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const raw = typeof error?.detail === 'string' ? error.detail.trim() : ''
  if (!raw) return { message, detail: '' }
  if (raw.length <= SPEC_ERROR_DETAIL_LIMIT) return { message, detail: raw }
  const half = SPEC_ERROR_DETAIL_LIMIT / 2
  return { message, detail: `${raw.slice(0, half)}…${raw.slice(-half)}` }
}
