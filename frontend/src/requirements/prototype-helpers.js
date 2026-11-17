/**
 * 需求阶段原型预览 UI 纯函数（M7 / M7-2，便于 Node 直接单测）
 *
 * M7-2 起：页面/字段内容来自 AI 预览规格（见 `prototype-spec-helpers.js`），
 * 本文件只保留仍被预览组件使用的展示层规则：类型/来源标签、warning 文案、画布缩放。
 */

/** 页面类型标签（与后端 PageType 对齐） */
export const PAGE_TYPE_LABELS = {
  list: '列表',
  form: '表单',
  detail: '详情',
  dashboard: '仪表盘',
  kanban: '看板',
  calendar: '日历',
  gantt: '甘特图',
  custom: '自定义'
}

/** 原型模板来源标签 */
export const TEMPLATE_SOURCE_LABELS = {
  'design-project': '设计项目模板',
  'app-default': '应用默认',
  'global-default': '全局默认'
}

export function typeLabel(type) {
  return PAGE_TYPE_LABELS[type] ?? PAGE_TYPE_LABELS.list
}

export function templateSourceLabel(source) {
  return TEMPLATE_SOURCE_LABELS[source] ?? ''
}

/**
 * 画布缩放系数（容器 < 内容时等比缩小，下限 min、上限 max）。
 *
 * 边界：
 * - 内容宽度非法/非正 → 上限（不做缩放）；
 * - 容器宽度非法/非正 → 下限（无法容纳宽画布）；
 * - 正常范围 clamp 到 [min, max]。
 */
export function fitScale(containerWidth, contentWidth, options = {}) {
  const min = Number.isFinite(options.min) ? options.min : 0.5
  const max = Number.isFinite(options.max) ? options.max : 1
  const container = Number(containerWidth)
  const content = Number(contentWidth)
  if (!Number.isFinite(content) || content <= 0) return max
  if (!Number.isFinite(container) || container <= 0) return min
  return Math.min(max, Math.max(min, container / content))
}

/** warning chip 文案（后端已给 message；缺失时按 code 兜底） */
export function warningText(warning) {
  const message = typeof warning?.message === 'string' ? warning.message.trim() : ''
  if (message) return message
  switch (warning?.code) {
    case 'no-module':
      return '应用还没有未归档的需求模块'
    case 'no-epics':
      return '该模块还没有 Epic / Story'
    case 'epic-without-story':
      return '有 Epic 还没有 Story'
    case 'story-without-title':
      return '有 Story 标题为空'
    case 'unassigned-stories':
      return '有 Story 未归属到 Epic'
    default:
      return '预览提示'
  }
}
