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

/** 应用状态标签：与外壳状态 chip 一致（需求中/设计中/开发中/已完成），不再出现“X 视图” */
export function statusLabel(status) {
  if (status === 'completed') return '已完成'
  if (status === 'design') return '设计中'
  if (status === 'development') return '开发中'
  return '需求中'
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

/** 产物概览文案（人话）：单需求文档 + Epic/页面集/实体；错误数在视图里单独提示“N 处待处理” */
export function artifactSummary(artifacts) {
  const requirement = artifacts?.requirement ?? null
  const epics = Array.isArray(requirement?.epics) ? requirement.epics.length : 0
  const pageSets = Array.isArray(artifacts?.pages?.pageSets) ? artifacts.pages.pageSets.length : 0
  const pages = Array.isArray(artifacts?.pages?.pages) ? artifacts.pages.pages.length : 0
  const entities = Array.isArray(artifacts?.entities?.entities) ? artifacts.entities.entities.length : 0
  if (!requirement?.exists && !pageSets && !entities) return '未生成需求文档'
  return `${requirement?.exists ? '需求文档' : '无需求文档'} · ${epics} 个 Epic · 实体 ${entities} · 页面集 ${pageSets} · 页面 ${pages}`
}
