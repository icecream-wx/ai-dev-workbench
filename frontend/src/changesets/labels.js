/**
 * 变更单展示纯逻辑（C1b）
 *
 * 不依赖 Vue / DOM，供 AppShell、HomeShell、DesignStudio、RequirementsDocView
 * 复用一个 chip/状态文案；用 node --test 直接覆盖（*.test.mjs）。
 */

/**
 * @typedef {Object} ChangeSetLike
 * @property {number} seq
 * @property {string} [title]
 * @property {string} [status]
 * @property {string} [scope]
 * @property {boolean} [canCancel]
 * @property {string|null} [cancelBlockedReason]
 * @property {number|null} [baseRequirementsVersion]
 * @property {number|null} [baseDesignVersion]
 * @property {number|null} [baseHandoffVersion]
 * @property {number|null} [currentRequirementsVersion]
 * @property {number|null} [currentDesignVersion]
 * @property {number|null} [currentHandoffVersion]
 * @property {{ counts?: { added?: number, modified?: number, removed?: number, total?: number } }|null} [summary]
 */

/**
 * @typedef {Object} AppLike
 * @property {string} status
 * @property {ChangeSetLike|null} [activeChangeSet]
 * @property {Object|null} [handoff]
 */

/** @param {string} status */
export function changeSetStageLabel(status) {
  if (status === 'requirements') return '需求'
  if (status === 'design') return '设计'
  if (status === 'development') return '开发'
  if (status === 'completed') return '已完成'
  if (status === 'cancelled') return '已取消'
  return status || ''
}

/** @param {string} scope */
export function changeSetScopeLabel(scope) {
  return scope === 'design' ? '仅设计' : '需求+设计'
}

/** @param {string} status */
export function changeSetStatusLabel(status) {
  if (status === 'cancelled') return '已取消'
  if (status === 'completed') return '已完成'
  return changeSetStageLabel(status)
}

/**
 * 应用头部 chip：初始开发 · 开发中 / 变更 #2 · 设计 / 已完成 / 开发中…
 * @param {AppLike|null|undefined} app
 */
export function appChipLabel(app) {
  if (!app) return ''
  const active = app.activeChangeSet
  if (active) {
    const seqLabel = active.seq === 1 ? '初始开发' : `变更 #${active.seq}`
    return `${seqLabel} · ${changeSetStageLabel(active.status)}${moduleCountSuffix(active)}`
  }
  if (app.status === 'completed') return '已完成'
  if (app.status === 'development') return '开发中'
  if (app.status === 'design') return '设计中'
  return '需求中'
}

/** M5：多模块变更在 chip 上补充模块数；单模块/旧变更单不显示（保持旧文案） */
function moduleCountSuffix(changeSet) {
  const count = Array.isArray(changeSet?.modules) ? changeSet.modules.length : 0
  return count > 1 ? ` · ${count} 模块` : ''
}

/**
 * 首页应用行：变更中 #N · 阶段 / 已完成 / 开发中
 * @param {AppLike|null|undefined} app
 */
export function appListStatusLabel(app) {
  if (!app) return ''
  const active = app.activeChangeSet
  if (active) {
    const prefix = active.seq === 1 ? '初始开发' : `变更中 #${active.seq}`
    return `${prefix} · ${changeSetStageLabel(active.status)}${moduleCountSuffix(active)}`
  }
  return appChipLabel(app)
}

/**
 * 是否显示“发起变更”：开发中/已完成且没有 active 变更单。
 * @param {AppLike|null|undefined} app
 */
export function canStartChangeSet(app) {
  if (!app) return false
  if (app.activeChangeSet) return false
  return app.status === 'development' || app.status === 'completed'
}

/**
 * 是否允许生成/重新生成交接包：
 * - 有 active 变更单 → 允许（绑定该单）；
 * - 没有任何交接包 → 首次开发 #1；
 * - 其余（已完成/纯代码修复）→ 不允许。
 * @param {AppLike|null|undefined} app
 */
export function canGenerateHandoff(app) {
  if (!app) return false
  if (app.activeChangeSet) return true
  return !app.handoff
}

/** 无 active 变更单时的提示（与后端 409 文案一致） */
export const NO_ACTIVE_CHANGE_SET_HINT = '如需修改需求/设计，请先发起变更；纯代码修复请直接在开发会话进行'

/**
 * 版本范围：需求 v1→v2 · 设计 v3→v4 · 交接包 v1→v2
 * @param {ChangeSetLike} cs
 */
export function changeSetVersionRange(cs) {
  const version = value => (typeof value === 'number' && value > 0 ? `v${value}` : '—')
  const requirement = `${version(cs.baseRequirementsVersion)}→${version(cs.currentRequirementsVersion)}`
  const design = `${version(cs.baseDesignVersion)}→${version(cs.currentDesignVersion)}`
  const handoff = `${version(cs.baseHandoffVersion)}→${version(cs.currentHandoffVersion)}`
  return `需求 ${requirement} · 设计 ${design} · 交接包 ${handoff}`
}

/**
 * 变更计数文案：新增 2 / 修改 1 / 删除 0（无 summary 时返回空）
 * @param {ChangeSetLike} cs
 */
export function changeSetCountsLabel(cs) {
  const counts = cs?.summary?.counts
  if (!counts) return ''
  const added = Number(counts.added ?? 0)
  const modified = Number(counts.modified ?? 0)
  const removed = Number(counts.removed ?? 0)
  if (!added && !modified && !removed) return '无差异'
  return `新增 ${added} / 修改 ${modified} / 删除 ${removed}`
}

/**
 * 阶段内版本标识：变更 #2（基于 需求 v10 / 设计 v5）或 初始开发
 * @param {ChangeSetLike|null|undefined} cs
 */
export function changeSetBaseLabel(cs) {
  if (!cs) return ''
  if (cs.seq === 1) return '初始开发'
  const parts = []
  if (cs.baseRequirementsVersion) parts.push(`需求 v${cs.baseRequirementsVersion}`)
  if (cs.baseDesignVersion) parts.push(`设计 v${cs.baseDesignVersion}`)
  return parts.length ? `变更 #${cs.seq}（基于 ${parts.join(' / ')}）` : `变更 #${cs.seq}`
}
