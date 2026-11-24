/**
 * ER 图缩放纯逻辑（B2）：滚轮/触摸板手势缩放、范围夹取、以光标为锚点的滚动修正。
 * 不依赖 Vue/DOM，便于 node --test 单测。
 */

export const ER_ZOOM_MIN = 20
export const ER_ZOOM_MAX = 200

/** 缩放百分比夹取到 20—200 的整数；非法值回落到 100 */
export function clampErZoom(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 100
  return Math.min(ER_ZOOM_MAX, Math.max(ER_ZOOM_MIN, Math.round(num)))
}

/**
 * 滚轮缩放：仅 Ctrl/⌘ + 滚轮参与缩放，返回新的缩放百分比；普通滚轮返回 null（不缩放，交给滚动）。
 * 指数步进，deltaY 为负（向上）放大。
 */
export function applyErWheel({ current, ctrl, meta, deltaY }) {
  if (!ctrl && !meta) return null
  const base = clampErZoom(current)
  const delta = Number(deltaY)
  if (!Number.isFinite(delta) || delta === 0) return base
  return clampErZoom(base * Math.exp(-delta * 0.0015))
}

/**
 * 以光标为锚点的滚动修正：内容坐标 = (scroll + offset) / scale，
 * 缩放后让同一内容点仍落在光标下。
 */
export function anchorScroll({ scrollLeft, scrollTop, offsetX, offsetY, from, to }) {
  const fromScale = clampErZoom(from) / 100
  const toScale = clampErZoom(to) / 100
  const ratio = toScale / fromScale
  const left = (Number(scrollLeft) + Number(offsetX)) * ratio - Number(offsetX)
  const top = (Number(scrollTop) + Number(offsetY)) * ratio - Number(offsetY)
  return {
    scrollLeft: Math.max(0, Math.round(Number.isFinite(left) ? left : 0)),
    scrollTop: Math.max(0, Math.round(Number.isFinite(top) ? top : 0))
  }
}
