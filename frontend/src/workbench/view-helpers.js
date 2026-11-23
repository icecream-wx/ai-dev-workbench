/**
 * 视图/产物纯逻辑（不依赖 Vue/DOM，便于 node --test 单测）
 *
 * 需求/设计/开发只是视图：`apps.status` 只表示“当前所在视图”，无门禁语义。
 */

export const APP_VIEWS = ['requirements', 'design', 'development']

export function isAppView(value) {
  return value === 'requirements' || value === 'design' || value === 'development'
}

/** 应用状态 → 默认视图（completed 回开发视图；未知回需求） */
export function viewFromStatus(status) {
  if (status === 'design') return 'design'
  if (status === 'development' || status === 'completed') return 'development'
  return 'requirements'
}

export function viewLabel(view) {
  if (view === 'requirements') return '需求'
  if (view === 'design') return '设计'
  if (view === 'development') return '开发'
  return '未知'
}

export function statusLabel(status) {
  if (status === 'completed') return '已完成'
  return `${viewLabel(viewFromStatus(status))}视图`
}

export function appRoute(app) {
  const view = viewFromStatus(app?.status)
  return `#/apps/${encodeURIComponent(app?.id ?? '')}/${view}`
}

/** 产物错误 → 一行“文件/字段/期望”（UI 横幅用） */
export function artifactErrorLine(error) {
  const file = typeof error?.file === 'string' && error.file ? error.file : '（未知文件）'
  const path = typeof error?.path === 'string' && error.path ? error.path : '$'
  const message = typeof error?.message === 'string' ? error.message : ''
  const expected = typeof error?.expected === 'string' && error.expected ? `（期望：${error.expected}）` : ''
  return `${file} · ${path} · ${message}${expected}`
}

/** 产物概览文案：模块数 / 设计数 / 错误数 */
export function artifactSummary(artifacts) {
  const modules = Array.isArray(artifacts?.modules) ? artifacts.modules.length : 0
  const designs = Array.isArray(artifacts?.designs) ? artifacts.designs.length : 0
  const errors = Array.isArray(artifacts?.errors) ? artifacts.errors.length : 0
  return `模块 ${modules} · 设计 ${designs}${errors ? ` · 错误 ${errors}` : ''}`
}
