/**
 * 页面集总览导出（O4）：纯布局（overview-layout.js）+ 浏览器 canvas 拼图。
 *
 * - 先做下载，不写入 prototypes 持久化（后续可选）。
 * - 单页截图由调用方提供（模板截图优先，失败回退线框）。
 */
import { overviewLayout } from './overview-layout.js'

export { overviewFileName, overviewLayout, downloadDataUrl } from './overview-layout.js'
export interface OverviewPageInput {
  id: string
  title: string
  type: string
  recipe?: string
  pageSet?: string
  dataUrl?: string
  fallback?: boolean
  error?: string
}

export interface ComposeOverviewInput {
  title: string
  epic?: string
  pageSetId: string
  pages: OverviewPageInput[]
  exportedAt: string
  columns?: number
}

function loadImage(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = dataUrl
  })
}

function drawPlaceholder(
  context: CanvasRenderingContext2D,
  cell: { x: number; y: number; width: number; imageY: number; imageHeight: number },
  message: string
): void {
  context.fillStyle = '#f1f5f9'
  context.fillRect(cell.x, cell.imageY, cell.width, cell.imageHeight)
  context.strokeStyle = '#cbd5e1'
  context.setLineDash([6, 6])
  context.strokeRect(cell.x + 1, cell.imageY + 1, cell.width - 2, cell.imageHeight - 2)
  context.setLineDash([])
  context.fillStyle = '#64748b'
  context.font = '14px "Segoe UI", "Microsoft YaHei", sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(message, cell.x + cell.width / 2, cell.imageY + cell.imageHeight / 2)
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
}

/** 浏览器 canvas 合成总览 PNG（2 列；失败页占位 + 错误文案） */
export async function composeOverviewPng(input: ComposeOverviewInput): Promise<string> {
  if (typeof document === 'undefined') throw new Error('总览导出只能在浏览器中执行')
  const layout = overviewLayout(input.pages.length, { columns: input.columns })
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建 canvas 上下文')

  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, layout.width, layout.height)

  context.fillStyle = '#0f172a'
  context.font = '600 24px "Segoe UI", "Microsoft YaHei", sans-serif'
  context.textBaseline = 'alphabetic'
  context.fillText(input.title, layout.padding, 48)
  context.fillStyle = '#475569'
  context.font = '13px "Segoe UI", "Microsoft YaHei", sans-serif'
  const meta = [input.epic, input.pageSetId, `${input.pages.length} 页`, `导出 ${input.exportedAt}`]
    .filter(Boolean)
    .join(' · ')
  context.fillText(meta, layout.padding, 72)

  const images = await Promise.all(
    input.pages.map(page => (page.dataUrl ? loadImage(page.dataUrl) : Promise.resolve(null)))
  )

  input.pages.forEach((page, index) => {
    const cell = layout.cells[index]
    if (!cell) return
    context.fillStyle = '#ffffff'
    context.strokeStyle = '#e2e8f0'
    context.lineWidth = 1
    context.fillRect(cell.x, cell.y, cell.width, cell.height)
    context.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.width - 1, cell.height - 1)

    context.fillStyle = '#0f172a'
    context.font = '600 15px "Segoe UI", "Microsoft YaHei", sans-serif'
    context.fillText(page.title || page.id, cell.x + 12, cell.y + 22)
    context.fillStyle = '#64748b'
    context.font = '11px "JetBrains Mono", "Cascadia Code", Consolas, monospace'
    const tag = [page.type, page.recipe].filter(Boolean).join(' · ')
    context.fillText(tag || page.id, cell.x + 12, cell.y + 38)
    if (page.fallback) {
      context.fillStyle = '#b45309'
      context.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif'
      context.fillText('线框兜底', cell.x + cell.width - 72, cell.y + 22)
    }

    const image = images[index]
    if (image) {
      const scale = Math.min(cell.width / image.width, cell.imageHeight / image.height)
      const drawWidth = Math.max(1, Math.floor(image.width * scale))
      const drawHeight = Math.max(1, Math.floor(image.height * scale))
      const x = cell.x + Math.floor((cell.width - drawWidth) / 2)
      const y = cell.imageY + Math.floor((cell.imageHeight - drawHeight) / 2)
      context.fillStyle = '#ffffff'
      context.fillRect(cell.x, cell.imageY, cell.width, cell.imageHeight)
      context.drawImage(image, x, y, drawWidth, drawHeight)
    } else {
      drawPlaceholder(context, cell, page.error ? `截图失败：${page.error}` : '无截图')
    }
  })

  return canvas.toDataURL('image/png')
}
