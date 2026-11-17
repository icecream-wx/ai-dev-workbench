/**
 * 首次模块规划 UI 纯逻辑（RMP-1，便于 Node 单测）
 *
 * - 计划草稿编辑：克隆 / 上移下移 / 增删 / 转 API payload；
 * - 首次规划资格（前端预判，后端仍是权威）；
 * - 生成进度状态机：SSE 事件 → 每模块状态（等待/生成中/成功/失败/跳过/取消）。
 */

let clientSeq = 0

function nextClientId() {
  clientSeq += 1
  return `plan-row-${Date.now()}-${clientSeq}`
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringList(value) {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : []
}

/** 文档章节是否全空（与后端同口径：markdown 空且结构化章节无条目） */
export function isEmptySections(sections) {
  return (Array.isArray(sections) ? sections : []).every(section => {
    if (!section) return true
    if (asString(section.markdown)) return false
    const data = section.data
    if (!data) return true
    return !(Array.isArray(data.scenes) ? data.scenes.length : 0) &&
      !(Array.isArray(data.epics) ? data.epics.length : 0) &&
      !(Array.isArray(data.stories) ? data.stories.length : 0)
  })
}

/**
 * 前端首次规划资格（保守预判；apply/chat 后端会再校验）：
 * requirements + 无 active Change Set + 恰好 1 个未归档模块 + 当前模块 + 文档 draft 且全空。
 */
export function initialPlanEligible(input) {
  const value = input || {}
  if (value.appStatus !== 'requirements') return false
  if (value.hasActiveChangeSet === true) return false
  const active = (Array.isArray(value.modules) ? value.modules : []).filter(module => module && !module.archived)
  if (active.length !== 1) return false
  const selected = asString(value.selectedModuleId)
  if (selected && selected !== active[0].id) return false
  if (!value.doc || value.doc.status !== 'draft') return false
  if (!Array.isArray(value.sections)) return false
  return isEmptySections(value.sections)
}

/** 深拷贝为可编辑草稿：每个模块带 clientId（仅本地 v-for key，提交时去掉） */
export function createPlanDraft(plan) {
  const source = plan && typeof plan === 'object' ? plan : {}
  const modules = (Array.isArray(source.modules) ? source.modules : []).map(item => ({
    clientId: nextClientId(),
    key: asString(item?.key),
    title: asString(item?.title),
    description: asString(item?.description),
    scope: asStringList(item?.scope),
    suggestedEpics: (Array.isArray(item?.suggestedEpics) ? item.suggestedEpics : [])
      .filter(epic => epic && typeof epic === 'object')
      .map(epic => ({ title: asString(epic.title), stories: asStringList(epic.stories) }))
      .filter(epic => epic.title),
    existingModuleId: item?.existingModuleId ?? null,
    action: asString(item?.action) || 'create'
  }))
  return {
    kind: 'initial',
    modules,
    dependencies: (Array.isArray(source.dependencies) ? source.dependencies : []).map(item => ({
      from: asString(item?.from),
      to: asString(item?.to),
      description: asString(item?.description)
    })),
    coverage: (Array.isArray(source.coverage) ? source.coverage : []).map(item => ({
      requirement: asString(item?.requirement),
      moduleKey: asString(item?.moduleKey)
    })),
    unassigned: (Array.isArray(source.unassigned) ? source.unassigned : []).map(item => ({
      requirement: asString(item?.requirement),
      reason: asString(item?.reason)
    })),
    openIssues: asStringList(source.openIssues),
    warnings: asStringList(source.warnings)
  }
}

/** 上移/下移；越界返回原数组（新数组引用） */
export function movePlanModule(modules, index, delta) {
  const list = Array.isArray(modules) ? modules.slice() : []
  const target = index + delta
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
  return list
}

/** 删除模块（保留至少 1 个：只剩 1 个时返回原数组） */
export function removePlanModule(modules, index) {
  const list = Array.isArray(modules) ? modules.slice() : []
  if (list.length <= 1) return list
  if (index < 0 || index >= list.length) return list
  list.splice(index, 1)
  return list
}

/** 新增空白模块（追加到末尾，标题留空由用户填写） */
export function addPlanModule(modules) {
  const list = Array.isArray(modules) ? modules.slice() : []
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

/** scope 编辑：每行一条 */
export function scopeToText(scope) {
  return asStringList(scope).join('\n')
}

export function textToScope(text) {
  return String(text ?? '')
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

/** 可编辑草稿 → 提交 payload（去 clientId、trim、过滤空 scope/空模块不动：空标题交给校验拦截） */
export function toApiPlan(draft) {
  const source = draft && typeof draft === 'object' ? draft : {}
  return {
    kind: 'initial',
    modules: (Array.isArray(source.modules) ? source.modules : []).map(item => ({
      key: asString(item?.key),
      title: asString(item?.title),
      description: asString(item?.description),
      scope: asStringList(item?.scope),
      suggestedEpics: (Array.isArray(item?.suggestedEpics) ? item.suggestedEpics : [])
        .map(epic => ({ title: asString(epic?.title), stories: asStringList(epic?.stories) }))
        .filter(epic => epic.title),
      existingModuleId: item?.existingModuleId ?? null,
      action: asString(item?.action) || 'create'
    })),
    dependencies: (Array.isArray(source.dependencies) ? source.dependencies : []).map(item => ({
      from: asString(item?.from),
      to: asString(item?.to),
      description: asString(item?.description)
    })),
    coverage: (Array.isArray(source.coverage) ? source.coverage : []).map(item => ({
      requirement: asString(item?.requirement),
      moduleKey: asString(item?.moduleKey)
    })),
    unassigned: (Array.isArray(source.unassigned) ? source.unassigned : []).map(item => ({
      requirement: asString(item?.requirement),
      reason: asString(item?.reason)
    })),
    openIssues: asStringList(source.openIssues),
    warnings: asStringList(source.warnings)
  }
}

/** 依赖里引用的模块标题（找不到回退 key） */
export function planKeyLabel(plan, key) {
  const found = (Array.isArray(plan?.modules) ? plan.modules : []).find(item => item.key === key)
  return found?.title || key
}

// ---------------------------------------------------------------- 生成进度

export const GENERATION_STATUS_LABELS = {
  waiting: '等待',
  running: '生成中',
  done: '已生成',
  error: '失败',
  skipped: '跳过',
  cancelled: '已取消'
}

/**
 * 创建生成进度状态。
 * @param {{ modules: Array<{ moduleId: string, title: string }>, reason: string }} input
 */
export function createGenerationState(input) {
  const items = (Array.isArray(input?.modules) ? input.modules : []).map(item => ({
    moduleId: asString(item?.moduleId),
    title: asString(item?.title),
    status: 'waiting',
    version: null,
    warnings: [],
    error: ''
  }))
  return {
    reason: asString(input?.reason) || 'initial',
    running: true,
    cancelled: false,
    ok: null,
    globalError: '',
    items
  }
}

function cloneState(state) {
  return {
    ...state,
    items: (Array.isArray(state?.items) ? state.items : []).map(item => ({
      ...item,
      warnings: Array.isArray(item.warnings) ? item.warnings.slice() : []
    }))
  }
}

function findItem(state, moduleId) {
  return state.items.find(item => item.moduleId === moduleId) ?? null
}

/**
 * 归并一个 SSE 事件（不修改入参）。
 * module-error 缺少 moduleId 视为全局错误（路由兜底帧）。
 */
export function reduceGenerationEvent(state, event) {
  const next = cloneState(state || {})
  next.items = Array.isArray(next.items) ? next.items : []
  const type = asString(event?.type)
  if (type === 'module-start') {
    const item = findItem(next, asString(event.moduleId))
    if (item) item.status = 'running'
    return next
  }
  if (type === 'module-done') {
    const item = findItem(next, asString(event.moduleId))
    if (item) {
      item.status = 'done'
      item.version = typeof event.version === 'number' ? event.version : item.version
      item.warnings = Array.isArray(event.warnings) ? event.warnings.slice() : []
      item.error = ''
    }
    return next
  }
  if (type === 'module-error') {
    const moduleId = asString(event.moduleId)
    if (!moduleId) {
      next.globalError = asString(event.error) || '生成失败'
      return next
    }
    const item = findItem(next, moduleId)
    if (item) {
      item.status = 'error'
      item.error = asString(event.error) || '生成失败'
    }
    return next
  }
  if (type === 'all-done') {
    next.running = false
    next.ok = event.ok === true
    next.cancelled = event.cancelled === true
    if (next.cancelled) {
      for (const item of next.items) {
        if (item.status === 'waiting' || item.status === 'running') item.status = 'cancelled'
      }
    }
    if (Array.isArray(event.failed)) {
      for (const failure of event.failed) {
        const item = findItem(next, asString(failure?.moduleId))
        if (item && item.status !== 'done') {
          item.status = 'error'
          item.error = asString(failure?.error) || item.error || '生成失败'
        }
      }
    }
    return next
  }
  return next
}

/** 进度摘要：用于卡片标题/提示 */
export function generationSummary(state) {
  const items = Array.isArray(state?.items) ? state.items : []
  const count = status => items.filter(item => item.status === status).length
  return {
    total: items.length,
    done: count('done'),
    failed: count('error'),
    running: count('running'),
    waiting: count('waiting'),
    cancelled: count('cancelled'),
    finished: Boolean(state) && state.running !== true,
    ok: state?.ok === true
  }
}

/** 失败模块（重试用） */
export function failedGenerationModules(state) {
  return (Array.isArray(state?.items) ? state.items : [])
    .filter(item => item.status === 'error')
    .map(item => ({ moduleId: item.moduleId, title: item.title, error: item.error }))
}

/** 已完成/正在生成的模块（刷新后选中第一个生成模块） */
export function firstGeneratedModuleId(state) {
  const items = Array.isArray(state?.items) ? state.items : []
  return items.find(item => item.status === 'done' || item.status === 'running')?.moduleId ?? ''
}
