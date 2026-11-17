/**
 * 交接包规模标签（I-09b-1 / U6）：纯逻辑，供交接包弹窗与开发页复用。
 * 只读 scale 对象，不做请求；旧交接包 scale=null 时全部返回空/隐藏。
 */

const METRIC_LABELS = {
  stories: 'Story',
  pages: '页面',
  textBytes: '文本'
}

function countText(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? String(value) : '—'
}

/** `12 Story / 14 页面 / 123 KB`（KB 向上取整；缺字段回退 —） */
export function scaleCountsLabel(scale) {
  if (!scale || typeof scale !== 'object') return ''
  const counts = scale.counts && typeof scale.counts === 'object' ? scale.counts : {}
  return `${countText(counts.stories)} Story / ${countText(counts.pages)} 页面 / ${kbText(scale.textBytes)}`
}

function kbText(textBytes) {
  if (typeof textBytes !== 'number' || !Number.isFinite(textBytes) || textBytes < 0) return '—'
  return `${Math.ceil(textBytes / 1024)} KB`
}

/** `['Story ≥ 10', '页面 ≥ 12']`；未知 metric 忽略 */
export function scaleTriggerLabels(scale) {
  const triggers = scale && Array.isArray(scale.triggers) ? scale.triggers : []
  const labels = []
  for (const trigger of triggers) {
    if (!trigger || typeof trigger !== 'object') continue
    const label = METRIC_LABELS[trigger.metric]
    if (!label) continue
    if (typeof trigger.threshold !== 'number' || !Number.isFinite(trigger.threshold)) continue
    const threshold = trigger.metric === 'textBytes' ? kbText(trigger.threshold) : String(trigger.threshold)
    labels.push(`${label} ≥ ${threshold}`)
  }
  return labels
}

/** 建议 chip：仅 suggested=true 时返回；normal/旧数据为 null */
export function scaleBadge(scale) {
  if (!scale || scale.suggested !== true) return null
  return { label: '建议分阶段', tone: 'warn' }
}

/** 完整提示：normal 返回空串 */
export function scaleHint(scale) {
  if (!scale || scale.suggested !== true) return ''
  const triggers = scaleTriggerLabels(scale)
  const reason = triggers.length ? `（${triggers.join('、')}）` : ''
  return `交接包较大：${scaleCountsLabel(scale)}${reason}；建议按 04-PLAN.md 分阶段推进，也可单会话完成。`
}
