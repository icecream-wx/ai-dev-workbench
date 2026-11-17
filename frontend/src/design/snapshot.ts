/** 浏览器端原型截图：html2canvas → PNG dataURL（不调用图片生成模型） */
import html2canvas from 'html2canvas'

export interface CaptureResult {
  dataUrl: string
  width: number
  height: number
}

export async function captureElementPng(element: HTMLElement, scale = 2): Promise<CaptureResult> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: Math.min(Math.max(scale, 1), 3),
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight
  })
  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
