/**
 * I-09a 开发会话健康度纯逻辑：token 简写、上下文百分比/等级/文案。
 * 不依赖 Vue/DOM，便于 node --test 单测。
 */

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 去掉小数末尾的 0：'65.0' → '65'，'1.050' → '1.05' */
function trimZero(text) {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}

/** 65000 → 65k；65500 → 65.5k；1048576 → 1.05M；999 → 999；非法 → — */
export function formatTokenCount(value) {
  const n = num(value)
  if (n === null || n < 0) return '—'
  if (n < 1000) return String(Math.round(n))
  if (n < 1000000) return `${trimZero((n / 1000).toFixed(1))}k`
  return `${trimZero((n / 1000000).toFixed(2))}M`
}

/** 百分比（0..1）→ ok/warn/danger/unknown；≥60% 黄、≥85% 红 */
export function contextLevel(percent) {
  const value = num(percent)
  if (value === null) return 'unknown'
  if (value >= 0.85) return 'danger'
  if (value >= 0.6) return 'warn'
  return 'ok'
}

/** 0.6203 → 62；percent 缺失时用 used/limit 估算；无法计算为 null */
export function contextPercent(context) {
  const percent = num(context?.percent)
  if (percent !== null) return Math.max(0, Math.round(percent * 100))
  const used = num(context?.used)
  const limit = num(context?.limit)
  if (used === null || limit === null || limit <= 0) return null
  return Math.max(0, Math.round((used / limit) * 100))
}

/** 顶部 chip：`上下文 62% (65k / 1.05M)` / `上下文 65k` / `上下文 —` */
export function contextLabel(context) {
  if (!context) return '上下文 —'
  const used = num(context.used) ?? 0
  const percent = contextPercent(context)
  if (percent === null) return `上下文 ${formatTokenCount(used)}`
  const limit = num(context.limit)
  if (limit === null) return `上下文 ${percent}% (${formatTokenCount(used)})`
  return `上下文 ${percent}% (${formatTokenCount(used)} / ${formatTokenCount(limit)})`
}

/** 右侧会话卡：`62% · 65k / 1.05M` / `65k` / `—` */
export function contextDetail(context) {
  if (!context) return '—'
  const used = num(context.used) ?? 0
  const percent = contextPercent(context)
  const limit = num(context.limit)
  if (percent === null) return formatTokenCount(used)
  if (limit === null) return `${percent}% · ${formatTokenCount(used)}`
  return `${percent}% · ${formatTokenCount(used)} / ${formatTokenCount(limit)}`
}

/** chip 的 title：说明是近似值 */
export function contextTitle(context) {
  if (!context) return '上下文用量不可用'
  const used = num(context.used) ?? 0
  const limit = num(context.limit)
  if (limit === null) return `上下文已用 ${formatTokenCount(used)}（模型上限未知，按估算显示）`
  return `上下文已用 ${formatTokenCount(used)} / 上限 ${formatTokenCount(limit)}（约，按最新一轮 assistant 消息估算）`
}

/** warn/danger 提示条文案；ok/unknown 返回空串 */
export function contextHint(context) {
  const percent = contextPercent(context)
  if (percent === null) return ''
  const level = context?.level ?? contextLevel(context?.percent)
  if (level === 'danger') return `上下文使用 ${percent}%，强烈建议压缩上下文`
  if (level === 'warn') return `上下文使用 ${percent}%，建议压缩上下文（可能丢失细节，由你确认）`
  return ''
}

/** 压缩按钮/提示条是否高亮 */
export function contextNeedsCompact(context) {
  return context?.level === 'warn' || context?.level === 'danger'
}
