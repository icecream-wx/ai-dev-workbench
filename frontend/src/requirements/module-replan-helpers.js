/**
 * 需求模块重新规划 UI 纯逻辑（RMP-2，便于 Node 单测）
 *
 * - 建议 → 可编辑草稿（clientId/映射/动作）；
 * - 增删/排序/scope 行编辑（复用 RMP-1 的通用编辑函数）；
 * - 映射唯一性、将归档列表、受影响已确认模块、生成列表、apply 摘要。
 */

import { movePlanModule, removePlanModule, scopeToText, textToScope } from './module-plan-helpers.js'
import {
  currentModuleOf,
  normalizeReplanPlan,
  resolveReplanAction,
  sameScope
} from './module-replan-protocol.js'

export { movePlanModule, removePlanModule, scopeToText, textToScope }

let clientSeq = 0

function nextClientId() {
  clientSeq += 1
  return `replan-row-${Date.now()}-${clientSeq}`
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringList(value) {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : []
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function cloneModule(item) {
  return {
    clientId: nextClientId(),
    key: asString(item?.key),
    title: asString(item?.title),
    description: asString(item?.description),
    scope: asStringList(item?.scope),
    suggestedEpics: asArray(item?.suggestedEpics).map(epic => ({
      title: asString(epic?.title),
      stories: asStringList(epic?.stories)
    })),
    existingModuleId: asString(item?.existingModuleId) || null,
    action: asString(item?.action) || 'create'
  }
}

/** 建议计划 → 可编辑草稿（每行带 clientId，仅本地 v-for key） */
export function createReplanDraft(plan) {
  const normalized = normalizeReplanPlan(plan)
  return {
    kind: 'replan',
    instruction: normalized.instruction,
    modules: normalized.modules.map(cloneModule),
    dependencies: normalized.dependencies,
    coverage: normalized.coverage,
    unassigned: normalized.unassigned,
    openIssues: normalized.openIssues,
    warnings: normalized.warnings
  }
}

/** 新增空白模块（默认“新建”） */
export function addReplanModule(modules) {
  const list = asArray(modules).slice()
  return [
    ...list,
    {
      clientId: nextClientId(),
      key: `custom${list.length + 1}`,
      title: '',
      description: '',
      scope: [],
      suggestedEpics: [],
      existingModuleId: null,
      action: 'create'
    }
  ]
}

/** 已映射的现有模块 ID（按行顺序；同一模块只取第一次） */
export function mappedModuleIds(modules) {
  const ids = []
  const seen = new Set()
  for (const item of asArray(modules)) {
    const id = asString(item?.existingModuleId)
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

/**
 * 将归档列表：当前未归档模块里没有被任何行映射的（与后端一致）。
 */
export function computeArchiveModules(modules, currentModules) {
  const mapped = new Set(mappedModuleIds(modules))
  return asArray(currentModules).filter(module => module && !mapped.has(module.id))
}

/** 某行可选的映射目标：全部现有模块 + 本行已选（调用方过滤掉其它行已用） */
export function mappingOptions(modules, currentModules, rowIndex) {
  const row = asArray(modules)[rowIndex]
  const ownId = asString(row?.existingModuleId)
  const usedByOthers = new Set(
    asArray(modules)
      .filter((_item, index) => index !== rowIndex)
      .map(item => asString(item?.existingModuleId))
      .filter(Boolean)
  )
  return asArray(currentModules)
    .filter(module => module && (!usedByOthers.has(module.id) || module.id === ownId))
    .map(module => ({ id: module.id, label: `${module.moduleKey} ${module.title}` }))
}

/** 把“将归档”模块恢复为一行映射（默认 keep；已映射则不变） */
export function restoreArchiveModule(modules, currentModule) {
  const list = asArray(modules).slice()
  if (!currentModule || mappedModuleIds(list).includes(currentModule.id)) return list
  list.push({
    clientId: nextClientId(),
    key: asString(currentModule.moduleKey).toLowerCase() || `m${list.length + 1}`,
    title: asString(currentModule.title),
    description: asString(currentModule.description),
    scope: asStringList(currentModule.scope),
    suggestedEpics: [],
    existingModuleId: currentModule.id,
    action: 'keep'
  })
  return list
}

/** 切换映射：空 = 新建；选了现有模块时按“同标题→保留，否则重新生成”给默认动作 */
export function applyMapping(modules, rowIndex, moduleId, currentModules) {
  const list = asArray(modules).slice()
  const row = list[rowIndex]
  if (!row) return list
  const id = asString(moduleId)
  if (!id) {
    list[rowIndex] = { ...row, existingModuleId: null, action: 'create' }
    return list
  }
  const current = currentModuleOf(currentModules, id)
  const effective = current && asString(row.title) === asString(current.title) ? 'keep' : 'regenerate'
  list[rowIndex] = { ...row, existingModuleId: id, action: effective }
  return list
}

export function moduleScopeOf(currentModules, moduleId) {
  return asStringList(currentModuleOf(currentModules, moduleId)?.scope)
}

/**
 * 编辑草稿摘要：
 * - kept/renamed/regenerated/created 计数（keep 标题变化按 rename 计入，与后端一致）；
 * - archiveModules（未映射）；
 * - affectedConfirmed（rename/regenerate + 被归档的已确认模块）；
 * - generation（create/regenerate，带标题）。
 */
export function summarizeReplan(modules, currentModules) {
  const list = asArray(modules)
  const byId = new Map(asArray(currentModules).map(module => [module.id, module]))
  const summary = {
    kept: 0,
    renamed: 0,
    regenerated: 0,
    created: 0,
    archiveModules: computeArchiveModules(list, currentModules),
    affectedConfirmed: [],
    generation: []
  }
  const confirmed = new Map()
  for (const item of list) {
    const action = resolveReplanAction(item, currentModules)
    const current = item?.existingModuleId ? byId.get(item.existingModuleId) : null
    if (action === 'create') {
      summary.created += 1
      summary.generation.push({ moduleId: '', title: asString(item.title), key: asString(item.key) })
    } else if (action === 'keep') {
      summary.kept += 1
    } else if (action === 'rename') {
      summary.renamed += 1
      if (current?.confirmed) confirmed.set(current.id, current)
    } else if (action === 'regenerate') {
      summary.regenerated += 1
      if (current?.confirmed) confirmed.set(current.id, current)
      summary.generation.push({ moduleId: current?.id ?? '', title: asString(item.title), key: asString(item.key) })
    }
  }
  for (const module of summary.archiveModules) {
    if (module.confirmed) confirmed.set(module.id, module)
  }
  summary.affectedConfirmed = Array.from(confirmed.values())
  summary.requiresReopenConfirmed = summary.affectedConfirmed.length > 0
  return summary
}

/**
 * 草稿 → apply payload（keep 标题/说明变化按 rename 提交；scope trim）。
 */
export function toReplanApiPlan(draft, extras = {}) {
  const currentModules = asArray(extras.currentModules)
  const source = draft && typeof draft === 'object' ? draft : {}
  return {
    kind: 'replan',
    instruction: asString(extras.instruction ?? source.instruction),
    modules: asArray(source.modules).map(item => ({
      key: asString(item?.key) || `m${asArray(source.modules).indexOf(item) + 1}`,
      title: asString(item?.title),
      description: asString(item?.description),
      scope: asStringList(item?.scope),
      suggestedEpics: asArray(item?.suggestedEpics)
        .map(epic => ({ title: asString(epic?.title), stories: asStringList(epic?.stories) }))
        .filter(epic => epic.title),
      existingModuleId: asString(item?.existingModuleId) || null,
      action: resolveReplanAction(item, currentModules)
    })),
    dependencies: asArray(source.dependencies).map(item => ({
      from: asString(item?.from),
      to: asString(item?.to),
      description: asString(item?.description)
    })),
    coverage: asArray(source.coverage).map(item => ({
      requirement: asString(item?.requirement),
      moduleKey: asString(item?.moduleKey)
    })),
    unassigned: asArray(source.unassigned).map(item => ({
      requirement: asString(item?.requirement),
      reason: asString(item?.reason)
    })),
    openIssues: asStringList(source.openIssues),
    warnings: asStringList(source.warnings)
  }
}

/** apply 结果 → 提示文案 */
export function replanSummaryText(result) {
  if (!result) return ''
  const parts = [
    `已保留 ${asArray(result.kept).length}`,
    `改名 ${asArray(result.renamed).length}`,
    `重新生成 ${asArray(result.regenerated).length}`,
    `新建 ${asArray(result.created).length}`,
    `归档 ${asArray(result.archived).length}`
  ]
  const reopened = asArray(result.reopened).length
  if (reopened) parts.push(`重新打开已确认 ${reopened}`)
  return parts.join('、')
}

/** apply 后应选中的模块：第一个生成模块 → 第一个保留 → 第一个改名 → 第一个模块 */
export function firstReplanTargetId(result) {
  if (!result) return ''
  const generated = asArray(result.generation)[0]?.moduleId
  if (generated) return generated
  const kept = asArray(result.kept)[0]?.id
  if (kept) return kept
  const renamed = asArray(result.renamed)[0]?.id
  if (renamed) return renamed
  return asArray(result.modules)[0]?.id ?? ''
}

/** 范围是否与当前模块一致（keep/rename 规则提示用） */
export function scopeMatchesCurrent(item, currentModules) {
  const current = currentModuleOf(currentModules, item?.existingModuleId)
  if (!current) return true
  const scope = asStringList(item?.scope)
  if (!scope.length || !asStringList(current.scope).length) return true
  return sameScope(scope, current.scope)
}
