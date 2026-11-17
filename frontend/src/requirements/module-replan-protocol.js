/**
 * 需求模块随时重新规划协议（RMP-2，纯 JS 便于 Node 单测）
 *
 * 预览接口返回已归一化的 plan；这里再做一次防御性归一化，并负责**编辑后**的校验：
 * - 动作/映射/标题唯一/范围变化；
 * - keep 若标题/说明变化 → 展示为 rename（与后端归一化一致）。
 */

export const REPLAN_ACTIONS = ['keep', 'rename', 'regenerate', 'create']
/** 后端技术保护（超过 400） */
export const MAX_REPLAN_MODULES = 50

export const REPLAN_ACTION_LABELS = {
  keep: '保留',
  rename: '改名',
  regenerate: '重新生成',
  create: '新建'
}

const CRUD_TITLE = /^(列表|新增|修改|删除|查询|详情|导入|导出|查看)/

function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringList(value, limit = 40) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => asString(item))
    .filter(Boolean)
    .slice(0, limit)
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function actionLabel(action) {
  return REPLAN_ACTION_LABELS[action] ?? action ?? ''
}

function normalizeEpic(item) {
  return { title: asString(item?.title), stories: asStringList(item?.stories, 30) }
}

/** 防御性归一化（与后端 plan 结构对齐；不改变后端已归一化的动作） */
export function normalizeReplanPlan(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    kind: 'replan',
    instruction: asString(source.instruction),
    modules: asArray(source.modules).map((item, index) => ({
      key: asString(item?.key) || `m${index + 1}`,
      title: asString(item?.title),
      description: asString(item?.description),
      scope: asStringList(item?.scope),
      suggestedEpics: asArray(item?.suggestedEpics).map(normalizeEpic).filter(epic => epic.title),
      existingModuleId: asString(item?.existingModuleId) || null,
      action: asString(item?.action) || 'create'
    })),
    dependencies: asArray(source.dependencies)
      .map(item => ({ from: asString(item?.from), to: asString(item?.to), description: asString(item?.description) }))
      .filter(item => item.from && item.to),
    coverage: asArray(source.coverage)
      .map(item => ({ requirement: asString(item?.requirement), moduleKey: asString(item?.moduleKey) }))
      .filter(item => item.requirement),
    unassigned: asArray(source.unassigned)
      .map(item => ({ requirement: asString(item?.requirement), reason: asString(item?.reason) }))
      .filter(item => item.requirement),
    openIssues: asStringList(source.openIssues),
    warnings: asStringList(source.warnings)
  }
}

export function currentModuleOf(currentModules, id) {
  if (!id) return null
  return asArray(currentModules).find(module => module && module.id === id) ?? null
}

export function sameScope(left, right) {
  const a = asStringList(left)
  const b = asStringList(right)
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((item, index) => item === sortedB[index])
}

/**
 * 展示/提交用的有效动作：keep 但标题/说明变化 → rename（与后端一致）。
 * 其它动作原样返回。
 */
export function resolveReplanAction(item, currentModules) {
  const action = asString(item?.action) || 'create'
  if (action !== 'keep') return action
  const current = currentModuleOf(currentModules, item?.existingModuleId)
  if (!current) return action
  if (asString(item?.title) !== asString(current.title)) return 'rename'
  if (asString(item?.description) !== asString(current.description)) return 'rename'
  return action
}

/**
 * 编辑后校验（应用前）：错误阻塞 apply，warning 只提示。
 * 与后端同口径：keep/rename 范围变化 → 必须 regenerate；create 不能映射；映射唯一。
 */
export function validateReplanDraft(draft, currentModules) {
  const errors = []
  const warnings = []
  const modules = asArray(draft?.modules)
  const currentList = asArray(currentModules)
  if (!modules.length) errors.push('至少需要 1 个模块')
  if (modules.length > MAX_REPLAN_MODULES) errors.push(`模块数量不能超过 ${MAX_REPLAN_MODULES} 个`)
  const byId = new Map(currentList.map(module => [module.id, module]))
  const usedTitles = new Set()
  const mapped = new Set()

  modules.forEach((item, index) => {
    const label = `第 ${index + 1} 个模块`
    const title = asString(item?.title)
    if (!title) {
      errors.push(`${label}标题为空`)
      return
    }
    if (title.length > 120) errors.push(`${label}标题超过 120 字`)
    const normalized = title.toLowerCase()
    if (usedTitles.has(normalized)) errors.push(`模块标题重复：${title}`)
    usedTitles.add(normalized)

    const action = asString(item?.action) || 'create'
    if (!REPLAN_ACTIONS.includes(action)) {
      errors.push(`模块「${title}」的动作不合法：${action || '(空)'}`)
      return
    }
    const existingModuleId = asString(item?.existingModuleId)
    if (action === 'create') {
      if (existingModuleId) errors.push(`新建模块「${title}」不能映射已有模块`)
    } else {
      if (!existingModuleId) {
        errors.push(`模块「${title}」需要选择映射的现有模块（或改为新建）`)
      } else if (!byId.has(existingModuleId)) {
        errors.push(`模块「${title}」映射的模块不存在：${existingModuleId}`)
      } else if (mapped.has(existingModuleId)) {
        errors.push(`同一现有模块被映射多次：${byId.get(existingModuleId).title}`)
      } else {
        mapped.add(existingModuleId)
        const current = byId.get(existingModuleId)
        const effective = resolveReplanAction(item, currentList)
        const scope = asStringList(item?.scope)
        const currentScope = asStringList(current?.scope)
        if ((effective === 'keep' || effective === 'rename') && scope.length && currentScope.length && !sameScope(scope, currentScope)) {
          errors.push(`模块「${title}」范围已变化，请选择「重新生成」`)
        }
      }
    }
    if (CRUD_TITLE.test(title) || /(列表|新增|修改|删除|查询)模块$/.test(title)) {
      warnings.push(`「${title}」看起来像 CRUD 功能而不是业务域，建议并入所属业务域模块`)
    }
  })

  if (modules.length > 8) warnings.push(`共 ${modules.length} 个模块，逐模块生成耗时较长；建议合并同业务域的模块`)
  if (!asArray(draft?.coverage).length) warnings.push('未提供需求覆盖说明，请确认没有遗漏')
  if (asArray(draft?.unassigned).length) warnings.push(`${draft.unassigned.length} 条需求未分配，请确认是否需要补充模块`)

  return { errors, warnings }
}
