/**
 * 变更单模块范围纯逻辑（M5）
 *
 * 不依赖 Vue / DOM，供 ChangeSetStartDialog / RequirementsDocView / DesignStudio /
 * ChangeSetHistoryDialog 复用；node --test 直接覆盖。
 */

/**
 * @typedef {Object} ChangeSetModuleLike
 * @property {string} moduleId
 * @property {string} [moduleKey]
 * @property {string} [title]
 * @property {number|null} [reqBaseVersion]
 * @property {number|null} [reqCurrentVersion]
 * @property {number|null} [designBaseVersion]
 * @property {number|null} [designCurrentVersion]
 * @property {string|null} [templateId]
 */

/**
 * @typedef {Object} ChangeSetLike
 * @property {number} [seq]
 * @property {ChangeSetModuleLike[]|null|undefined} [modules]
 */

/** 默认全选：全部未归档模块（archived=false）的 id，按传入顺序 */
export function defaultChangeSetModuleIds(modules) {
  return (Array.isArray(modules) ? modules : [])
    .filter(module => module && !module.archived)
    .map(module => module.id)
}

/**
 * 校验模块选择：非空、无重复、全部为未归档模块。
 * @returns {{ ok: boolean, error: string }}
 */
export function validateChangeSetModuleSelection(modules, selectedIds) {
  const active = (Array.isArray(modules) ? modules : []).filter(module => module && !module.archived)
  const activeIds = new Set(active.map(module => module.id))
  const ids = Array.isArray(selectedIds) ? selectedIds : []
  if (!ids.length) return { ok: false, error: '请至少选择 1 个模块' }
  const seen = new Set()
  for (const id of ids) {
    if (typeof id !== 'string' || !id.trim()) return { ok: false, error: '模块选择不合法' }
    if (seen.has(id)) return { ok: false, error: `模块重复：${id}` }
    seen.add(id)
    if (!activeIds.has(id)) return { ok: false, error: `模块不存在或已归档：${id}` }
  }
  return { ok: true, error: '' }
}

/** 变更范围模块 id 列表（旧变更单没有 modules → 空数组 = 不限制） */
export function changeScopeModuleIds(changeSet) {
  if (!changeSet || !Array.isArray(changeSet.modules)) return []
  return changeSet.modules.map(module => module.moduleId).filter(Boolean)
}

/** 变更是否限定了模块范围（旧变更单/无 active → false，视为全可选） */
export function hasModuleScope(changeSet) {
  return changeScopeModuleIds(changeSet).length > 0
}

/** 当前模块是否在变更范围内（无范围视为 true，保持旧行为） */
export function isModuleInChangeScope(changeSet, moduleId) {
  if (!moduleId) return true
  const ids = changeScopeModuleIds(changeSet)
  if (!ids.length) return true
  return ids.includes(moduleId)
}

/** 变更范围是否覆盖全部未归档模块（用于应用级模板切换/整体操作） */
export function isChangeScopeComplete(changeSet, activeModuleIds) {
  const ids = changeScopeModuleIds(changeSet)
  if (!ids.length) return true
  const active = Array.isArray(activeModuleIds) ? activeModuleIds : []
  return active.length > 0 && active.every(id => ids.includes(id))
}

/** 范围条文案：本次变更范围 2 个模块：MOD-001 商品管理、MOD-002 订单管理 */
export function changeSetModuleLabel(changeSet) {
  const modules = Array.isArray(changeSet?.modules) ? changeSet.modules : []
  if (!modules.length) return '全部模块'
  const names = modules.map(module => {
    const key = module.moduleKey ? `${module.moduleKey} ` : ''
    return `${key}${module.title || module.moduleId}`
  })
  return `${modules.length} 个模块：${names.join('、')}`
}

/** MF-M5-1：模块是否在本次变更中新增（无基线；取消时会自动归档） */
export function isNewChangeSetModule(module) {
  if (!module) return false
  const hasBaseFields =
    Object.prototype.hasOwnProperty.call(module, 'reqBaseVersion') ||
    Object.prototype.hasOwnProperty.call(module, 'designBaseVersion')
  if (!hasBaseFields) return false
  return module.reqBaseVersion == null || module.designBaseVersion == null
}

/** 本次变更是否包含“变更中新增”的模块 */
export function changeSetHasNewModules(changeSet) {
  const modules = Array.isArray(changeSet?.modules) ? changeSet.modules : []
  return modules.some(isNewChangeSetModule)
}

/** 单模块版本区间：需求 v1→v2 · 设计 v3→v4（缺失用 —；新增模块显示“变更中新增”；#1 为首次基线） */
export function moduleVersionRange(module, changeSet = null) {
  const value = input => (typeof input === 'number' && input > 0 ? `v${input}` : '—')
  if (isNewChangeSetModule(module)) {
    if (changeSet?.seq === 1) {
      return `需求 ${value(module?.reqCurrentVersion)} · 设计 ${value(module?.designCurrentVersion)}（首次基线）`
    }
    return '变更中新增'
  }
  return `需求 ${value(module?.reqBaseVersion)}→${value(module?.reqCurrentVersion)} · 设计 ${value(module?.designBaseVersion)}→${value(module?.designCurrentVersion)}`
}

/** 模块在当前变更里的角色文案（未选/范围内） */
export function moduleScopeChipLabel(changeSet, moduleId) {
  if (!hasModuleScope(changeSet)) return ''
  return isModuleInChangeScope(changeSet, moduleId) ? '本次变更' : '未包含'
}

/** 取消变更确认文案：列出将恢复的模块；变更中新增模块会归档 */
export function cancelModuleSummary(changeSet) {
  const modules = Array.isArray(changeSet?.modules) ? changeSet.modules : []
  const archivedNote = changeSetHasNewModules(changeSet) ? '；变更中新增的模块将被归档（内容保留，可之后恢复）' : ''
  if (!modules.length) return `将恢复需求/设计/应用到变更前的已确认版本${archivedNote}`
  return `将恢复 ${modules.length} 个模块：${modules
    .map(module => `${module.moduleKey || ''} ${module.title || module.moduleId}`.trim())
    .join('、')}${archivedNote}`
}
