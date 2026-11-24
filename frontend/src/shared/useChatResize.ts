import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  CHAT_WIDTH_DEFAULT,
  CHAT_WIDTH_MAX,
  CHAT_WIDTH_MIN,
  clampChatWidth,
  keyboardChatWidth,
  readStoredChatWidth
} from './chat-resize.js'

export interface ChatResizeOptions {
  /** 布局容器（用于计算动态上限） */
  containerRef: { value: HTMLElement | null }
  /** localStorage key */
  storageKey: string
  /** 默认宽度（双击恢复） */
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  /** 对话栏以外区域的最小宽度（含分隔条） */
  otherMinWidth: number
}

/**
 * 左侧对话栏拖拽宽度：
 * - pointer 拖拽（向右变宽；对话栏在左侧）；
 * - localStorage 持久化；
 * - ResizeObserver/窗口 resize 动态限制；
 * - 键盘 ←/→、Home/End；双击恢复默认；
 * - 卸载时清理监听。
 */
export function useChatResize(options: ChatResizeOptions) {
  const minWidth = options.minWidth ?? CHAT_WIDTH_MIN
  const maxWidth = options.maxWidth ?? CHAT_WIDTH_MAX
  const defaultWidth = Math.max(minWidth, Math.min(maxWidth, options.defaultWidth ?? CHAT_WIDTH_DEFAULT))
  const width = ref(defaultWidth)
  const containerWidth = ref(0)
  let dragging = false
  let startX = 0
  let startWidth = 0
  let observer: ResizeObserver | null = null

  const maxAllowed = computed(() =>
    clampChatWidth(containerWidth.value || defaultWidth + options.otherMinWidth, minWidth, maxWidth, options.otherMinWidth, maxWidth)
  )
  const chatWidth = computed(() =>
    clampChatWidth(
      containerWidth.value || defaultWidth + options.otherMinWidth,
      minWidth,
      maxWidth,
      options.otherMinWidth,
      width.value
    )
  )

  function persist(): void {
    try {
      window.localStorage.setItem(options.storageKey, String(chatWidth.value))
    } catch {
      // localStorage 不可用时忽略
    }
  }

  function setWidth(next: number, save = true): void {
    width.value = clampChatWidth(
      containerWidth.value || defaultWidth + options.otherMinWidth,
      minWidth,
      maxWidth,
      options.otherMinWidth,
      next
    )
    if (save) persist()
  }

  function reset(): void {
    setWidth(defaultWidth)
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) return
    setWidth(startWidth + (event.clientX - startX), false)
  }

  function stopDrag(): void {
    if (!dragging) return
    dragging = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', stopDrag)
    window.removeEventListener('pointercancel', stopDrag)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    persist()
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return
    event.preventDefault()
    dragging = true
    startX = event.clientX
    startWidth = chatWidth.value
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopDrag)
    window.addEventListener('pointercancel', stopDrag)
  }

  function onKeydown(event: KeyboardEvent): void {
    const next = keyboardChatWidth(event.key, chatWidth.value, minWidth, maxAllowed.value)
    if (next === null) return
    event.preventDefault()
    setWidth(next)
  }

  function onDoubleClick(event: MouseEvent): void {
    event.preventDefault()
    reset()
  }

  function measure(): void {
    const element = options.containerRef.value
    containerWidth.value = element ? element.clientWidth : window.innerWidth
  }

  onMounted(() => {
    width.value = clampChatWidth(
      window.innerWidth,
      minWidth,
      maxWidth,
      options.otherMinWidth,
      readStoredChatWidth(window.localStorage, options.storageKey, defaultWidth)
    )
    measure()
    if (typeof ResizeObserver !== 'undefined' && options.containerRef.value) {
      observer = new ResizeObserver(() => measure())
      observer.observe(options.containerRef.value)
    }
    window.addEventListener('resize', measure)
  })

  onUnmounted(() => {
    stopDrag()
    observer?.disconnect()
    observer = null
    window.removeEventListener('resize', measure)
  })

  return {
    chatWidth,
    minWidth,
    maxAllowed,
    onPointerDown,
    onKeydown,
    onDoubleClick,
    reset
  }
}
