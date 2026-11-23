/**
 * 对话占位状态机（P6-1，纯函数）
 *
 * idle → awaiting（发送后本地占位）→ null（首个 delta / assistant 消息）
 *                        ↘ failed / interrupted（出错/中断时必须替换占位）
 * 不依赖 Vue/DOM，便于 node --test。
 */

export function nextPending(current, action) {
  const type = action && typeof action === 'object' ? action.type : ''
  if (type === 'send') return { phase: 'awaiting', message: '' }
  if (type === 'content' || type === 'reset') return null
  if (type === 'failed') {
    const message = action && typeof action.message === 'string' ? action.message.trim() : ''
    return { phase: 'failed', message }
  }
  if (type === 'interrupted') return { phase: 'interrupted', message: '' }
  return current ?? null
}

/** 占位气泡的 data-testid；prefix 为 chat / dev */
export function pendingTestId(pending, prefix = 'chat') {
  if (!pending) return ''
  if (pending.phase === 'failed') return `${prefix}-pending-failed`
  if (pending.phase === 'interrupted') return `${prefix}-pending-interrupted`
  return `${prefix}-pending`
}

export function pendingLabel(pending, failedText = '本轮失败，可在下方继续追问。') {
  if (!pending) return ''
  if (pending.phase === 'failed') return pending.message ? `本轮失败：${pending.message}` : failedText
  if (pending.phase === 'interrupted') return '已中止本轮生成。'
  return '思考中…'
}

/** assistant 是否应渲染“思考”折叠块 */
export function shouldShowReasoning(message) {
  const reasoning = message && typeof message.reasoning === 'string' ? message.reasoning : ''
  return reasoning.trim().length > 0
}

/** 运行中工具行：取最后一个 step 的最后一项；没有则不显示 */
export function runningToolLine(steps) {
  const list = Array.isArray(steps) ? steps : []
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const items = Array.isArray(list[index]?.items) ? list[index].items : []
    const item = items[items.length - 1]
    if (!item) continue
    const name = typeof item.name === 'string' ? item.name : ''
    const target = typeof item.target === 'string' ? item.target : item.diff?.path ?? ''
    if (!name && !target) continue
    return `正在使用 ${name || '工具'}${target ? ` · ${target}` : ''}`
  }
  return ''
}
