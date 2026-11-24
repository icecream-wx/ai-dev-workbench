/**
 * 页面集总览布局/文件名/下载（O4 纯函数；不依赖 Vue/DOM 渲染）。
 * 供 overview-export.ts 与 node --test 共用。
 */
import { safePageId } from './design-export.js'

export function overviewLayout(count, options = {}) {
  const total = Math.max(0, Math.floor(Number(count) || 0))
  const columns = Math.max(1, Math.floor(Number(options.columns) || 2))
  const width = Math.max(320, Math.floor(Number(options.width) || 1440))
  const padding = Math.max(0, Math.floor(Number(options.padding) || 32))
  const gap = Math.max(0, Math.floor(Number(options.gap) || 24))
  const header = Math.max(0, Math.floor(Number(options.header) || 96))
  const footer = Math.max(0, Math.floor(Number(options.footer) || 36))
  const aspect = Number(options.aspect) > 0 ? Number(options.aspect) : 1440 / 900
  const rows = Math.ceil(total / columns)
  const cellWidth = Math.max(120, Math.floor((width - padding * 2 - gap * (columns - 1)) / columns))
  const cellHeight = Math.max(90, Math.floor(cellWidth / aspect))
  const cells = []
  const labelHeight = 44
  for (let index = 0; index < total; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = padding + column * (cellWidth + gap)
    const y = header + row * (cellHeight + gap)
    cells.push({
      x,
      y,
      width: cellWidth,
      height: cellHeight,
      imageY: y + labelHeight,
      imageHeight: Math.max(40, cellHeight - labelHeight - 8)
    })
  }
  return {
    columns,
    width,
    height: header + rows * cellHeight + Math.max(0, rows - 1) * gap + footer,
    cellWidth,
    cellHeight,
    padding,
    gap,
    header,
    footer,
    rows,
    cells
  }
}

/** `<pageSetId>-overview.png`（安全化；空 id 用 page-set） */
export function overviewFileName(pageSetId) {
  const id = safePageId(typeof pageSetId === 'string' ? pageSetId : '') || 'page-set'
  return `${id}-overview.png`
}

export const OVERVIEW_ZOOM_MIN = 10
export const OVERVIEW_ZOOM_MAX = 100

/** 总览画布缩放夹取到 10—100 的整数；非法值回落 100 */
export function clampOverviewZoom(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 100
  return Math.min(OVERVIEW_ZOOM_MAX, Math.max(OVERVIEW_ZOOM_MIN, Math.round(num)))
}

/**
 * 总览在线画布的世界坐标布局：2 列 1440×900 artboard + 标签高度，artboard 之间留白。
 * 只用于画布展示；导出仍用 `overviewLayout`（2 列拼图，行为不变）。
 */
export function overviewCanvasLayout(count, options = {}) {
  const total = Math.max(0, Math.floor(Number(count) || 0))
  const columns = Math.max(1, Math.floor(Number(options.columns) || 2))
  const artboardWidth = Math.max(320, Math.floor(Number(options.artboardWidth) || 1440))
  const artboardHeight = Math.max(200, Math.floor(Number(options.artboardHeight) || 900))
  const labelHeight = Math.max(0, Math.floor(Number(options.labelHeight) || 56))
  const gapX = Math.max(0, Math.floor(Number(options.gapX) || 160))
  const gapY = Math.max(0, Math.floor(Number(options.gapY) || 140))
  const padding = Math.max(0, Math.floor(Number(options.padding) || 160))
  const rows = Math.ceil(total / columns)
  const artboards = []
  for (let index = 0; index < total; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    artboards.push({
      x: padding + column * (artboardWidth + gapX),
      y: padding + row * (artboardHeight + labelHeight + gapY),
      width: artboardWidth,
      height: artboardHeight,
      labelHeight
    })
  }
  const worldWidth = padding * 2 + columns * artboardWidth + Math.max(0, columns - 1) * gapX
  const worldHeight =
    rows === 0
      ? padding * 2
      : padding * 2 + rows * (artboardHeight + labelHeight) + Math.max(0, rows - 1) * gapY
  return {
    columns,
    rows,
    width: worldWidth,
    height: worldHeight,
    artboardWidth,
    artboardHeight,
    labelHeight,
    gapX,
    gapY,
    padding,
    artboards
  }
}

/** 适应窗口：按视口/世界尺寸计算缩放（clamp 到 10—100） */
export function fitOverviewZoom({ viewportWidth, viewportHeight, worldWidth, worldHeight, padding = 48 } = {}) {
  const pad = Math.max(0, Number(padding) || 0)
  const usableWidth = Math.max(1, Number(viewportWidth) - pad * 2)
  const usableHeight = Math.max(1, Number(viewportHeight) - pad * 2)
  const worldW = Math.max(1, Number(worldWidth) || 1)
  const worldH = Math.max(1, Number(worldHeight) || 1)
  const scale = Math.min(usableWidth / worldW, usableHeight / worldH)
  return clampOverviewZoom(scale * 100)
}

/**
 * 以画布内光标为锚点缩放：screen = pan + world * scale，
 * 保持光标下的世界点不变，返回新的 panX/panY。
 */
export function overviewZoomAt({ zoom, nextZoom, pointX, pointY, panX, panY } = {}) {
  const fromScale = clampOverviewZoom(zoom) / 100
  const toScale = clampOverviewZoom(nextZoom) / 100
  const ratio = toScale / fromScale
  const x = Number(pointX)
  const y = Number(pointY)
  const panLeft = Number(panX) || 0
  const panTop = Number(panY) || 0
  return {
    panX: (Number.isFinite(x) ? x : 0) - ((Number.isFinite(x) ? x : 0) - panLeft) * ratio,
    panY: (Number.isFinite(y) ? y : 0) - ((Number.isFinite(y) ? y : 0) - panTop) * ratio
  }
}

/** 浏览器下载 dataUrl；测试/非浏览器环境安全返回 false */
export function downloadDataUrl(dataUrl, filename) {
  if (typeof document === 'undefined' || !dataUrl.startsWith('data:image/png;base64,')) return false
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  return true
}
