/**
 * 设计模块 UI 纯函数（M4，便于 Node 直接单测）
 *
 * 设计页只复用模块数据（`/requirements-modules` + `GET /apps/:id` 的 designModules），
 * 不提供新增/归档；这里集中处理：
 * - 选中模块：localStorage → 默认模块 → 第一个未归档；失效/归档回退并给出原因；
 * - 应用级设计进度（confirmed/total + pending）；
 * - 缺图统计；
 * - 跨模块实体分组（当前模块优先，其它模块只读标记）；
 * - 应用级原型模板切换预览是否可用。
 */

export const DESIGN_MODULE_STORAGE_SUFFIX = 'designModuleId'

/** localStorage key：按应用持久化当前选中的设计模块（与需求页 key 独立） */
export function designModuleStorageKey(appId) {
  return `workbench:app:${appId}:${DESIGN_MODULE_STORAGE_SUFFIX}`
}

export function readStoredDesignModuleId(storage, appId) {
  try {
    const value = storage?.getItem(designModuleStorageKey(appId))
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

export function writeStoredDesignModuleId(storage, appId, moduleId) {
  try {
    if (!moduleId) storage?.removeItem(designModuleStorageKey(appId))
    else storage?.setItem(designModuleStorageKey(appId), moduleId)
  } catch {
    // localStorage 不可用时静默忽略（不影响切换）
  }
}

export function activeModulesOf(modules) {
  return (Array.isArray(modules) ? modules : []).filter(module => module && !module.archived)
}

/**
 * 初始/回退设计模块选择。
 * @returns {{ moduleId: string | null, reason: '' | 'none' | 'stored-missing' | 'stored-archived' }}
 */
export function resolveDesignModuleId(modules, options = {}) {
  const list = Array.isArray(modules) ? modules.filter(Boolean) : []
  const active = activeModulesOf(list)
  if (!active.length) return { moduleId: null, reason: 'none' }
  const storedId = typeof options.storedId === 'string' ? options.storedId : ''
  if (storedId) {
    const stored = active.find(module => module.id === storedId)
    if (stored) return { moduleId: stored.id, reason: '' }
    const archived = list.some(module => module.id === storedId && module.archived)
    const fallback = active.find(module => module.id === options.defaultModuleId) ?? active[0]
    return { moduleId: fallback.id, reason: archived ? 'stored-archived' : 'stored-missing' }
  }
  const preferred = active.find(module => module.id === options.defaultModuleId)
  return { moduleId: (preferred ?? active[0]).id, reason: '' }
}

/** 应用级设计进度：只统计未归档模块（required 缺省视为必选） */
export function designModuleProgress(designModules) {
  const list = (Array.isArray(designModules) ? designModules : []).filter(Boolean)
  const required = list.filter(module => module.required !== false)
  const pending = required.filter(module => module.status !== 'confirmed')
  return {
    total: list.length,
    confirmed: list.filter(module => module.status === 'confirmed').length,
    requiredTotal: required.length,
    requiredConfirmed: required.filter(module => module.status === 'confirmed').length,
    pending: pending.map(module => ({
      moduleId: module.moduleId ?? module.id,
      moduleKey: module.moduleKey ?? '',
      title: module.title ?? ''
    })),
    allRequiredConfirmed: required.length > 0 && pending.length === 0
  }
}

/** 缺原型截图总数（缺图不阻塞设计确认，但阻塞交接包） */
export function designMissingImageTotal(designModules) {
  return (Array.isArray(designModules) ? designModules : []).reduce((sum, module) => {
    const value = Number(module?.missingImages)
    return sum + (Number.isFinite(value) && value > 0 ? value : 0)
  }, 0)
}

/**
 * 跨模块实体分组（Element Plus el-option-group 形状）。
 * 只包含其它模块；同模块实体由调用方自己渲染（避免重复）。
 */
export function otherModuleEntityGroups(otherEntities) {
  const groups = []
  const byModule = new Map()
  for (const entity of Array.isArray(otherEntities) ? otherEntities : []) {
    if (!entity || !entity.id) continue
    const key = entity.moduleId ?? ''
    if (!byModule.has(key)) {
      const group = {
        key,
        label: `${entity.moduleKey ? `${entity.moduleKey} · ` : ''}${entity.moduleTitle || '其它模块'}（跨模块）`,
        options: []
      }
      byModule.set(key, group)
      groups.push(group)
    }
    byModule.get(key).options.push({ value: entity.id, label: entity.name, crossModule: true })
  }
  return groups
}

/** 关系目标是否为其它模块实体（用于提示；不阻塞保存） */
export function isCrossModuleEntityId(otherEntities, entityId) {
  if (!entityId) return false
  return (Array.isArray(otherEntities) ? otherEntities : []).some(entity => entity && entity.id === entityId)
}

/** 应用级原型模板切换预览可用性：canApply 且有模块且无 blocked */
export function templateSwitchUsable(preview) {
  if (!preview || preview.canApply !== true) return false
  if (!Array.isArray(preview.modules) || !preview.modules.length) return false
  return !Array.isArray(preview.blockedModules) || preview.blockedModules.length === 0
}

/** 模块设计状态标签 */
export function designModuleStatusLabel(module) {
  if (!module) return '—'
  if (module.status === 'confirmed') return '已确认'
  if (module.status === 'review') return '待审核'
  return '草稿'
}

/** 模块设计版本号展示（未建项目为 —） */
export function designModuleVersionLabel(module) {
  const version = Number(module?.version)
  return Number.isFinite(version) && version > 0 ? `v${version}` : '—'
}

/** M5 总览：覆盖率展示（0—1 → 百分比；无 Story 视为 100%） */
export function coverageRateLabel(rate) {
  const value = Number(rate)
  if (!Number.isFinite(value)) return '—'
  const clamped = Math.min(Math.max(value, 0), 1)
  return `${Math.round(clamped * 100)}%`
}

/** M5 总览：未覆盖 Story 展示（无未覆盖 → 空串；过多截断） */
export function uncoveredStoriesLabel(uncovered, limit = 3) {
  const list = Array.isArray(uncovered) ? uncovered : []
  if (!list.length) return ''
  const names = list.slice(0, limit).map(item => `${item.id || ''} ${item.title || ''}`.trim())
  return list.length > limit ? `${names.join('、')} 等 ${list.length} 个` : names.join('、')
}
