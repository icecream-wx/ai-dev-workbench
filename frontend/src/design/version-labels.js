/** 设计版本来源/变更单标签（R2c，纯逻辑，供版本弹窗与 Playwright 断言复用） */

export const DESIGN_VERSION_SOURCE_LABELS = {
  confirm: '确认设计',
  ai: 'AI 生成',
  'template-change': '模板切换',
  sync: '同步设计输入',
  rollback: '版本回滚',
  restore: '变更取消恢复',
  manual: '手动保存'
}

/** 未知来源按“手动保存”兜底（旧数据） */
export function designVersionSourceLabel(source) {
  return DESIGN_VERSION_SOURCE_LABELS[String(source ?? '')] ?? DESIGN_VERSION_SOURCE_LABELS.manual
}

/** `变更 #N · 标题`；没有变更单时返回空串 */
export function designVersionChangeSetLabel(seq, title) {
  if (!seq) return ''
  const suffix = title ? ` · ${title}` : ''
  return `变更 #${seq}${suffix}`
}
