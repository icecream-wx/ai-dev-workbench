/**
 * P10 模板风格 PNG 截图服务（工作台侧）
 *
 * 设计参考包 PNG 由 `design-preview.html` 内的真实模板渲染页面自截：
 * 这里动态创建隐藏 iframe（1440×900、移出视口），等 iframe 发 `ready` 后请求 `capture`，
 * 收到 `png`/`error`/超时后清理。纯函数 `shouldTemplateCapture` 决定页面走模板截图还是线框兜底。
 */
import { supportsTemplateRender } from '../design-preview/contract-preview.js'

export interface TemplateCaptureOptions {
  appId: string
  pageId: string
  applicationType: string
  styleId: string
  designHash?: string
  width?: number
  height?: number
  scale?: number
  timeoutMs?: number
}

export interface TemplateCaptureResult {
  dataUrl: string
  width: number
  height: number
}

const PREVIEW_SOURCE = 'adp-design-preview'
const DESIGN_VIEW_SOURCE = 'adp-design-view'
/** 后端 PNG 上限 5MB（解码后字节数） */
const MAX_PNG_BYTES = 5 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 20000

let requestCounter = 0

/** 页面是否支持模板风格渲染（有显式 recipe/catalogRef/blueprint 即可，P10b） */
export function shouldTemplateCapture(page: any, templatePages: any[] = []): boolean {
  return supportsTemplateRender(page, Array.isArray(templatePages) ? templatePages : [])
}

function decodedBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const body = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  return Math.floor((body.length * 3) / 4)
}

function buildCaptureUrl(options: TemplateCaptureOptions, requestId: string): string {
  const query = new URLSearchParams()
  query.set('app', options.appId)
  query.set('page', options.pageId)
  query.set('type', options.applicationType)
  if (options.styleId) query.set('style', options.styleId)
  if (options.designHash) query.set('v', options.designHash)
  query.set('embed', '1')
  query.set('capture', '1')
  query.set('rid', requestId)
  return `/design-preview.html?${query.toString()}`
}

function clampScale(value: unknown): number {
  const scale = Number(value)
  if (!Number.isFinite(scale)) return 2
  return Math.min(Math.max(scale, 1), 3)
}

/** 单次截图：创建 iframe → ready → capture → png；任何结果都清理 iframe/监听 */
function captureOnce(options: TemplateCaptureOptions, scale: number): Promise<TemplateCaptureResult> {
  const width = Math.max(320, Math.floor(Number(options.width) || 1440))
  const height = Math.max(240, Math.floor(Number(options.height) || 900))
  const timeoutMs = Math.max(3000, Math.floor(Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS))
  const requestId = `tc-${Date.now()}-${(requestCounter += 1)}`

  return new Promise<TemplateCaptureResult>((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.setAttribute('data-testid', 'template-capture-frame')
    iframe.style.cssText = [
      'position:fixed',
      'left:-20000px',
      'top:0',
      `width:${width}px`,
      `height:${height}px`,
      'border:0',
      'opacity:0',
      'pointer-events:none'
    ].join(';')

    let settled = false
    let phase: 'ready' | 'capture' = 'ready'
    let timer: ReturnType<typeof setTimeout> | null = null

    const cleanup = (): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      timer = null
      window.removeEventListener('message', onMessage)
      try {
        iframe.src = 'about:blank'
      } catch {
        // 已卸载
      }
      iframe.remove()
    }

    const finish = (run: () => void): void => {
      cleanup()
      run()
    }

    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) return
      if (event.source !== iframe.contentWindow) return
      const data = event.data as Record<string, unknown> | null
      if (!data || data.source !== PREVIEW_SOURCE || data.id !== requestId) return
      if (phase === 'ready' && data.type === 'ready') {
        phase = 'capture'
        iframe.contentWindow?.postMessage(
          { source: DESIGN_VIEW_SOURCE, type: 'capture', id: requestId, scale: clampScale(scale) },
          window.location.origin
        )
        return
      }
      if (data.type === 'png' && typeof data.dataUrl === 'string' && data.dataUrl.startsWith('data:image/png;base64,')) {
        finish(() =>
          resolve({
            dataUrl: data.dataUrl as string,
            width: Number(data.width) || 0,
            height: Number(data.height) || 0
          })
        )
        return
      }
      if (data.type === 'error') {
        finish(() => reject(new Error(String(data.message || '模板截图失败'))))
      }
    }

    window.addEventListener('message', onMessage)
    timer = setTimeout(() => {
      finish(() => reject(new Error(`模板截图超时（${timeoutMs}ms）`)))
    }, timeoutMs)

    iframe.src = buildCaptureUrl(options, requestId)
    document.body.appendChild(iframe)
  })
}

/**
 * 截取一张模板风格 PNG。
 *
 * dataUrl 估算超过后端 5MB 上限时用 scale=1 重试一次；仍超限则报错（由调用方回退线框）。
 */
export async function captureTemplatePage(options: TemplateCaptureOptions): Promise<TemplateCaptureResult> {
  const { appId, pageId, applicationType } = options
  if (!appId || !pageId || !applicationType) {
    throw new Error('模板截图缺少 app/page/type 参数')
  }
  const scale = clampScale(options.scale ?? 2)
  const first = await captureOnce(options, scale)
  if (decodedBytes(first.dataUrl) <= MAX_PNG_BYTES) return first
  if (scale <= 1) throw new Error('模板截图超过 5MB 上限')
  const retried = await captureOnce(options, 1)
  if (decodedBytes(retried.dataUrl) <= MAX_PNG_BYTES) return retried
  throw new Error('模板截图超过 5MB 上限（已用 scale=1 重试）')
}
