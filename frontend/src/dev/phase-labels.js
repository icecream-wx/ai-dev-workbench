/**
 * U7 开发阶段纯逻辑：状态文案/CSS class、阶段序号、范围、进度、提示与二次确认文案。
 * 不依赖 Vue/DOM，便于 node --test 单测。
 *
 * 阶段是**可选的会话组织**，不是门禁：没有 Git/测试/证据/阶段门禁，
 * 全部阶段完成也不会自动完成应用。
 */

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function positiveInt(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function stringArray(value) {
  if (!Array.isArray(value)) return []
  return value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
}

export function phaseStatusLabel(status) {
  if (status === 'not_started') return '未开始'
  if (status === 'in_progress') return '进行中'
  if (status === 'completed') return '已完成'
  if (status === 'skipped') return '已跳过'
  return '未知状态'
}

/** 仅作 CSS class 后缀（`phase-chip--<class>`） */
export function phaseStatusClass(status) {
  if (status === 'not_started') return 'not-started'
  if (status === 'in_progress') return 'in-progress'
  if (status === 'completed') return 'completed'
  if (status === 'skipped') return 'skipped'
  return 'unknown'
}

/** `阶段 2/6`；order 非法 → `阶段 —` */
export function phaseOrderLabel(order, total) {
  if (!positiveInt(order)) return '阶段 —'
  return positiveInt(total) ? `阶段 ${order}/${total}` : `阶段 ${order}`
}

/** `阶段 2 · 标题`；opts.short → `阶段 2`；带模块时前缀 `MOD-001 · `；无阶段 → '' */
export function phaseRefLabel(phase, options = {}) {
  const order = phase?.order
  if (!positiveInt(order)) return ''
  const moduleKey = text(phase?.moduleKey)
  const moduleTitle = text(phase?.moduleTitle)
  const moduleLabel = moduleKey ? (moduleTitle ? `${moduleKey} ${moduleTitle}` : moduleKey) : ''
  const prefix = moduleLabel && options.module !== false ? `${moduleLabel} · ` : ''
  if (options.short) return `${prefix}阶段 ${order}`
  const title = text(phase?.title)
  return title ? `${prefix}阶段 ${order} · ${title}` : `${prefix}阶段 ${order}`
}

/** 会话列表 chip：读 `phaseOrder/phaseTitle/phaseModuleKey/phaseModuleTitle`；无阶段 → '' */
export function phaseChipLabel(session, options = {}) {
  const order = session?.phaseOrder
  if (!positiveInt(order)) return ''
  const moduleKey = text(session?.phaseModuleKey)
  const moduleTitle = text(session?.phaseModuleTitle)
  const moduleLabel = moduleKey ? (moduleTitle ? `${moduleKey} ${moduleTitle}` : moduleKey) : ''
  const prefix = moduleLabel && options.module !== false ? `${moduleLabel} · ` : ''
  if (options.short) return `${prefix}阶段 ${order}`
  const title = text(session?.phaseTitle)
  return title ? `${prefix}阶段 ${order} · ${title}` : `${prefix}阶段 ${order}`
}

/** 范围数量：`Story 3 · 页面集 2 · 页面 5`；全空 → `按 04-PLAN.md 阶段章节` */
export function phaseScopeLabel(scope) {
  const parts = []
  const stories = stringArray(scope?.storyIds)
  const pageSets = stringArray(scope?.pageSetCodes)
  const pages = stringArray(scope?.pageCodes)
  if (stories.length) parts.push(`Story ${stories.length}`)
  if (pageSets.length) parts.push(`页面集 ${pageSets.length}`)
  if (pages.length) parts.push(`页面 ${pages.length}`)
  return parts.length ? parts.join(' · ') : '按 04-PLAN.md 阶段章节'
}

/** 弹窗范围明细：`Story STORY-001、STORY-002；页面集 PS-001；页面 PAGE-001`；note 不丢 */
export function phaseScopeDetail(scope) {
  const parts = []
  const stories = stringArray(scope?.storyIds)
  const pageSets = stringArray(scope?.pageSetCodes)
  const pages = stringArray(scope?.pageCodes)
  if (stories.length) parts.push(`Story ${stories.join('、')}`)
  if (pageSets.length) parts.push(`页面集 ${pageSets.join('、')}`)
  if (pages.length) parts.push(`页面 ${pages.join('、')}`)
  if (!parts.length) parts.push('按 04-PLAN.md 阶段章节')
  const note = text(scope?.note)
  if (note) parts.push(`说明：${note}`)
  return parts.join('；')
}

/** `{ total, completed, skipped, done }`；completed 仅 completed，done = completed + skipped；模块里程碑不计入 */
export function phaseProgress(phases) {
  const list = Array.isArray(phases)
    ? phases.filter(item => item && typeof item === 'object' && item.kind !== 'module')
    : []
  const completed = list.filter(item => item.status === 'completed').length
  const skipped = list.filter(item => item.status === 'skipped').length
  return { total: list.length, completed, skipped, done: completed + skipped }
}

/** 只保留可执行阶段（排除模块里程碑） */
export function executablePhases(phases) {
  const list = Array.isArray(phases) ? phases.filter(item => item && typeof item === 'object') : []
  return list.filter(item => item.kind !== 'module')
}

/**
 * M6b：模块阶段状态派生（与后端一致）：
 * 全 completed/skipped 且至少 1 completed → completed；全 skipped → skipped；
 * 任意子阶段已开始/已有进度（in_progress/completed/skipped）→ in_progress；否则 not_started。
 */
export function moduleStatusOf(phases) {
  const statuses = (Array.isArray(phases) ? phases : [])
    .filter(item => item && typeof item === 'object' && item.kind !== 'module')
    .map(item => item.status)
  if (!statuses.length) return 'not_started'
  const done = statuses.filter(status => status === 'completed' || status === 'skipped')
  if (done.length === statuses.length) return statuses.some(status => status === 'completed') ? 'completed' : 'skipped'
  if (done.length > 0 || statuses.some(status => status === 'in_progress')) return 'in_progress'
  return 'not_started'
}

/** 模块展示名：`MOD-001 商品管理`（标题已含 key 时不重复） */
export function moduleLabel(phase) {
  const key = text(phase?.moduleKey) || text(phase?.key).replace(/^module:/, '')
  const title = text(phase?.title)
  if (!title) return key
  return key && !title.startsWith(key) ? `${key} ${title}` : title
}

/** 模块名称（不含 key，用于分组标题旁已显示 key 的场景） */
export function moduleName(phase) {
  const key = text(phase?.moduleKey) || text(phase?.key).replace(/^module:/, '')
  const title = text(phase?.title)
  if (!title) return ''
  return key && title.startsWith(`${key} `) ? title.slice(key.length + 1).trim() : title
}

/**
 * M6b：按模块分组（保持原顺序）：
 * `{ groups: [{kind:'phase',phase} | {kind:'module',key,module,phases}], modules, executable }`
 * 单模块旧数据（无 kind=module）→ groups 全为 phase，前端保持平铺。
 */
export function groupPhasesByModule(phases) {
  const list = Array.isArray(phases) ? phases.filter(item => item && typeof item === 'object') : []
  const groups = []
  const modules = []
  let current = null
  for (const phase of list) {
    if (phase.kind === 'module') {
      const key = text(phase.moduleKey) || text(phase.key).replace(/^module:/, '')
      const group = { kind: 'module', key, module: phase, phases: [] }
      groups.push(group)
      modules.push(group)
      current = group
      continue
    }
    const parent = text(phase.parentKey) || text(phase.moduleKey)
    if (current && parent && current.key === parent) {
      current.phases.push(phase)
      continue
    }
    current = null
    groups.push({ kind: 'phase', phase })
  }
  return { groups, modules, executable: list.filter(phase => phase.kind !== 'module') }
}

/** 全部完成/全部处理（含跳过）时的提示；否则 ''（不自动完成应用） */
export function phaseCompletionHint(phases) {
  const progress = phaseProgress(phases)
  if (!progress.total) return ''
  if (progress.completed === progress.total) return '全部阶段已完成，可确认完成开发（不会自动完成）。'
  if (progress.done === progress.total && progress.skipped > 0) return '阶段均已处理（含跳过），可确认完成开发。'
  return ''
}

/**
 * 阶段操作可用性（与后端语义一致）：
 * - 只读会话 / 无阶段 → 全 false；
 * - 历史交接包版本 → 全 false（后端 409 只读）；
 * - not_started / in_progress → 开始/完成/跳过；
 * - completed → 只能重新打开（start 会 409）；
 * - skipped → 可重新开始/重新打开。
 */
export function phaseActionState(phase, currentHandoffVersion, readOnly) {
  const none = { canStart: false, canComplete: false, canSkip: false, canReopen: false }
  if (readOnly || !phase) return { ...none, reason: '会话只读' }
  if (phase.kind === 'module') {
    return { ...none, reason: '模块阶段只作分组/里程碑，不单独开始会话；请选择模块内 Epic/页面阶段' }
  }
  if (phase.handoffVersion !== currentHandoffVersion) return { ...none, reason: '历史交接包阶段只读' }
  if (phase.status === 'completed') return { ...none, canReopen: true, reason: '' }
  if (phase.status === 'skipped') return { ...none, canStart: true, canReopen: true, reason: '' }
  if (phase.status === 'not_started' || phase.status === 'in_progress') {
    return { canStart: true, canComplete: true, canSkip: true, canReopen: false, reason: '' }
  }
  return { ...none, reason: '' }
}

/** 生成阶段的二次确认文案（含阶段数、模块里程碑、不门禁、单会话、不自动发送） */
export function phaseGenerateConfirmText(count, moduleCount = 0) {
  const total = positiveInt(count) ? count : 0
  const modules = positiveInt(moduleCount) ? moduleCount : 0
  return [
    `将为当前交接包生成 ${total} 个可执行开发阶段${modules ? `和 ${modules} 个模块里程碑` : ''}（与 04-PLAN.md 的分阶段建议一致）。`,
    '模块里程碑只作分组/进度汇总，不单独开会话；实际会话只绑定 base/Epic/页面阶段。',
    '阶段不设门禁：可随时切换、跳过或重新打开，应用不会被自动完成；仍是单会话模式（同一时间只有一个 active 会话），每个阶段使用单独会话；',
    '阶段首条提示只放入输入框，不会自动发送。'
  ].join('\n')
}

/** 开始阶段的二次确认文案；running 前置“会先请求停止”，hasActiveSession 提示归档当前会话 */
export function phaseStartConfirmText(phase, total, options = {}) {
  const order = phase?.order
  const title = text(phase?.title)
  const moduleKey = text(phase?.moduleKey)
  const prefix = moduleKey ? `${moduleKey} · ` : ''
  const label = positiveInt(order)
    ? `${prefix}${phaseOrderLabel(order, total)}${title ? `「${title}」` : ''}`
    : title
      ? `该阶段「${title}」`
      : '该阶段'
  const lines = []
  if (options.running) lines.push('Agent 正在执行，会先请求停止当前会话。')
  if (options.hasActiveSession) lines.push('当前会话会归档，之后可在左侧列表只读查看或恢复。')
  lines.push(
    `将进入${label}：阶段首条提示只放入输入框，不会自动发送；阶段不设门禁，也不会自动完成应用。`
  )
  return lines.join('\n')
}

/** 阶段摘要来源标签：模型/回退/无摘要 */
export function phaseSummarySourceLabel(source) {
  if (source === 'model') return '模型生成'
  if (source === 'fallback') return '回退（最后一条回复）'
  if (source === 'none') return '无摘要'
  return '无摘要'
}
