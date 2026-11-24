/**
 * 对话栏宽度纯函数（O2）：供 useChatResize 与单测共用。
 * 不依赖 Vue/DOM。
 */
export const CHAT_WIDTH_DEFAULT = 380
export const CHAT_WIDTH_MIN = 300
export const CHAT_WIDTH_MAX = 560
export const CHAT_WIDTH_STEP = 16
export const SPLIT_HANDLE_WIDTH = 6

/**
 * 计算对话栏允许宽度。
 * - containerWidth：容器可用宽度；
 * - otherMinWidth：对话栏以外区域的最小宽度（含分隔条）；
 * - desiredWidth：期望宽度（默认最小值）。
 */
export function clampChatWidth(containerWidth, minWidth, maxWidth, otherMinWidth, desiredWidth = minWidth) {
  const container = Number.isFinite(containerWidth) ? Math.max(0, containerWidth) : 0
  const min = Math.max(0, Number.isFinite(minWidth) ? minWidth : 0)
  const max = Math.max(min, Number.isFinite(maxWidth) ? maxWidth : min)
  const other = Math.max(0, Number.isFinite(otherMinWidth) ? otherMinWidth : 0)
  const availableMax = Math.max(min, Math.min(max, container - other))
  const desired = Number.isFinite(desiredWidth) ? desiredWidth : min
  return Math.round(Math.max(min, Math.min(availableMax, desired)))
}

/** 从 localStorage 读取宽度；非法/越界返回 fallback（只做基本容错，最终仍由 clamp 兜底） */
export function readStoredChatWidth(storage, key, fallback = CHAT_WIDTH_DEFAULT) {
  try {
    const raw = storage?.getItem?.(key)
    if (raw === null || raw === undefined || raw === '') return fallback
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : fallback
  } catch {
    return fallback
  }
}

/** 键盘调整：←/→ 步进，Home/End 到边界；其它键返回 null */
export function keyboardChatWidth(key, current, minWidth, maxWidth, step = CHAT_WIDTH_STEP) {
  const min = Math.max(0, Number.isFinite(minWidth) ? minWidth : 0)
  const max = Math.max(min, Number.isFinite(maxWidth) ? maxWidth : min)
  const value = Number.isFinite(current) ? current : min
  let next = null
  if (key === 'ArrowLeft') next = value - step
  else if (key === 'ArrowRight') next = value + step
  else if (key === 'Home') next = min
  else if (key === 'End') next = max
  if (next === null) return null
  return Math.round(Math.max(min, Math.min(max, next)))
}
