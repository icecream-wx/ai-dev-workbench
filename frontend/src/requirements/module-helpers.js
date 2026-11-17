/**
 * 需求模块 UI 纯函数（M3，便于 Node 直接单测）
 *
 * 模块 rail / 总览 / 模板应用级切换都用这里的规则，避免把判断散落在组件里：
 * - 初始模块选择：localStorage → defaultModuleId → 第一个未归档；失效/归档回退并说明原因；
 * - 进度：只统计未归档模块，必选模块未确认即 pending；
 * - 排序：上移/下移只换相邻位置，越界返回 null；
 * - 归档后回退：当前模块被归档时选下一个未归档模块；
 * - 新增门禁：只有需求阶段可以新增模块。
 */

export const MODULE_STORAGE_PREFIX = 'workbench:app:'

/** localStorage key：按应用持久化当前选中的需求模块 */
export function moduleStorageKey(appId) {
  return `${MODULE_STORAGE_PREFIX}${appId}:requirementsModuleId`
}

export function readStoredModuleId(storage, appId) {
  try {
    const value = storage?.getItem(moduleStorageKey(appId))
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

export function writeStoredModuleId(storage, appId, moduleId) {
  try {
    if (!moduleId) storage?.removeItem(moduleStorageKey(appId))
    else storage?.setItem(moduleStorageKey(appId), moduleId)
  } catch {
    // localStorage 不可用时静默忽略（不影响切换）
  }
}

export function activeModulesOf(modules) {
  return (Array.isArray(modules) ? modules : []).filter(module => module && !module.archived)
}

/**
 * 初始/回退模块选择。
 * @returns {{ moduleId: string | null, reason: '' | 'none' | 'stored-missing' | 'stored-archived' }}
 */
export function resolveInitialModule(modules, options = {}) {
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

/** 确认进度：只统计未归档模块（必选模块未确认即 pending） */
export function progressOf(modules) {
  const list = Array.isArray(modules) ? modules.filter(Boolean) : []
  const active = activeModulesOf(list)
  const required = active.filter(module => module.required)
  const pending = required.filter(module => module.docStatus !== 'confirmed')
  return {
    total: active.length,
    archived: list.filter(module => module.archived).length,
    confirmed: active.filter(module => module.docStatus === 'confirmed').length,
    requiredTotal: required.length,
    requiredConfirmed: required.filter(module => module.docStatus === 'confirmed').length,
    pending: pending.map(module => ({ moduleId: module.id, moduleKey: module.moduleKey, title: module.title })),
    allRequiredConfirmed: required.length > 0 && pending.length === 0
  }
}

/** 上移/下移：返回新的 id 顺序；越界或 id 不存在返回 null */
export function moveModuleIds(ids, moduleId, delta) {
  const list = Array.isArray(ids) ? ids.slice() : []
  const index = list.indexOf(moduleId)
  if (index < 0) return null
  const target = index + delta
  if (target < 0 || target >= list.length) return null
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
  return list
}

/** 归档后选中哪个模块：当前模块未被归档则保持；否则选第一个未归档模块 */
export function nextModuleAfterArchive(modules, archivedId, currentId) {
  const active = activeModulesOf(modules).filter(module => module.id !== archivedId)
  if (!active.length) return null
  if (currentId && currentId !== archivedId && active.some(module => module.id === currentId)) return currentId
  return active[0].id
}

/** 新增模块门禁（决策 1：只在需求阶段新增） */
export function createModuleGate(appStatus) {
  if (appStatus === 'requirements') return { allowed: true, hint: '' }
  if (appStatus === 'design') {
    return { allowed: false, hint: '设计阶段不能直接新增模块；请先「重新编辑需求」回到需求阶段' }
  }
  return { allowed: false, hint: '开发/完成阶段的新增需求请先发起“需求+设计”变更（模块选择在后续版本接入）' }
}

/** 应用级模板切换是否允许：canApply 且无阻塞模块 */
export function canApplyTemplatePreview(preview) {
  if (!preview || preview.canApply !== true) return false
  if (!Array.isArray(preview.modules) || !preview.modules.length) return false
  return !Array.isArray(preview.blockedModules) || preview.blockedModules.length === 0
}

/**
 * 是否存在模板不一致的未归档模块（M3 must-fix）：
 * M2 期间可能出现“模块 B 单独切了模板”，此时当前模板 X 的按钮不能因为
 * “selected.id === currentTemplateId” 而禁用，否则无法把 B 对齐回 X。
 * 无 templateId 的模块（无文档）忽略；归档模块不参与。
 */
export function hasDivergentTemplates(modules, currentTemplateId) {
  const current = typeof currentTemplateId === 'string' ? currentTemplateId : ''
  return activeModulesOf(modules).some(module => {
    const templateId = typeof module.templateId === 'string' ? module.templateId : ''
    return Boolean(templateId) && templateId !== current
  })
}

/** 版本 hash 短展示（8 位） */
export function shortHash(hash, length = 8) {
  const value = String(hash ?? '').trim()
  if (!value) return '—'
  return value.length <= length ? value : value.slice(0, length)
}

/** 模块状态标签（归档优先） */
export function moduleStatusLabel(module) {
  if (!module) return '—'
  if (module.archived) return '已归档'
  if (module.docStatus === 'confirmed') return '已确认'
  if (module.docStatus === 'review') return '待审核'
  return '草稿'
}

/** 模块文档版本号展示 */
export function moduleVersionLabel(module) {
  const version = module?.docVersion
  return typeof version === 'number' && version > 0 ? `v${version}` : '—'
}

/** 模块状态样式类（与 moduleStatusLabel 一一对应） */
export function moduleStatusClass(module) {
  if (module?.archived) return 'archived'
  if (module?.docStatus === 'confirmed') return 'confirmed'
  if (module?.docStatus === 'review') return 'review'
  return 'draft'
}

/**
 * 需求大纲根节点（模块行）展示信息。
 * @param {object} module RequirementModule
 * @param {{ current?: boolean, inChangeScope?: boolean }} options
 * @returns {{ statusLabel: string, statusClass: string, versionLabel: string, ownerLabel: string, chips: string[], current: boolean }}
 */
export function moduleOutlineRow(module, options = {}) {
  const chips = []
  if (module?.required) chips.push('必选')
  if (options.inChangeScope === true) chips.push('本次变更')
  return {
    statusLabel: moduleStatusLabel(module),
    statusClass: moduleStatusClass(module),
    versionLabel: moduleVersionLabel(module),
    ownerLabel: typeof module?.ownerLabel === 'string' ? module.ownerLabel : '',
    chips,
    current: options.current === true
  }
}

/** 模块行标题 tooltip：key + 标题 + 描述（描述不再常驻显示，保留在 tooltip/编辑弹窗） */
export function moduleOutlineTooltip(module) {
  if (!module) return ''
  const head = [module.moduleKey, module.title].filter(Boolean).join(' ')
  const description = typeof module.description === 'string' ? module.description.trim() : ''
  return description ? `${head} · ${description}` : head
}

/** 当前模块必填章节完成度（大纲标题和根节点第二行使用） */
export function outlineCompletion(sections) {
  const list = Array.isArray(sections) ? sections.filter(Boolean) : []
  const required = list.filter(section => section.required)
  const completed = required.filter(section => typeof section.markdown === 'string' && section.markdown.trim()).length
  return { required: required.length, completed }
}

/**
 * 滚动是否已到底（用于 scroll spy）。
 * 短文档不可滚动时恒为 false，避免“内容不足一屏”被误判为滚到底 → 高亮最后一节。
 * @param {{ scrollTop: number, clientHeight: number, scrollHeight: number }} metrics
 * @param {number} threshold 允许的误差像素
 */
export function scrollAtBottom(metrics, threshold = 4) {
  const scrollTop = Number(metrics?.scrollTop)
  const clientHeight = Number(metrics?.clientHeight)
  const scrollHeight = Number(metrics?.scrollHeight)
  if (!Number.isFinite(scrollTop) || !Number.isFinite(clientHeight) || !Number.isFinite(scrollHeight)) {
    return false
  }
  const slack = Number.isFinite(threshold) ? Number(threshold) : 4
  if (scrollHeight <= clientHeight + slack) return false
  return scrollTop + clientHeight >= scrollHeight - slack
}

/**
 * 滚动高亮：取最后一个“顶部 <= offset”的章节为 active。
 * @param {Array<number|{ key: string, top: number }>} items 章节顶部位置（相对滚动容器）
 * @param {{ offset?: number, atBottom?: boolean }} options
 * @returns {string|number} 传入对象时返回 key；传入数字时返回 index；空数组返回 ''
 */
export function activeSectionFromTops(items, options = {}) {
  const list = Array.isArray(items) ? items : []
  if (!list.length) return ''
  const offset = Number.isFinite(options.offset) ? Number(options.offset) : 24
  const keyOf = (item, index) => {
    if (item && typeof item === 'object') return typeof item.key === 'string' ? item.key : String(index)
    return index
  }
  if (options.atBottom === true) return keyOf(list[list.length - 1], list.length - 1)
  let activeIndex = 0
  let found = false
  for (let index = 0; index < list.length; index += 1) {
    const top = typeof list[index] === 'number' ? list[index] : Number(list[index]?.top)
    if (!Number.isFinite(top)) continue
    if (top <= offset) {
      activeIndex = index
      found = true
    }
  }
  if (!found) activeIndex = 0
  return keyOf(list[activeIndex], activeIndex)
}

/**
 * 目标章节解析：优先 preferred；不存在时回退第一节并标记 fallback。
 * @returns {{ key: string, fallback: boolean }}
 */
export function resolveSectionTarget(keys, preferred) {
  const list = Array.isArray(keys) ? keys.filter(key => typeof key === 'string' && key) : []
  if (!list.length) return { key: '', fallback: false }
  const wanted = typeof preferred === 'string' ? preferred : ''
  if (wanted && list.includes(wanted)) return { key: wanted, fallback: false }
  return { key: list[0], fallback: Boolean(wanted) }
}
