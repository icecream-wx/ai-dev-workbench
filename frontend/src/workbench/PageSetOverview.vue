<template>
  <section class="overview" data-testid="pageset-overview">
    <header class="overview-head">
      <div class="title">
        <strong>{{ pageSet.title }}</strong>
        <span v-if="pageSet.epic" class="epic">{{ pageSet.epic }}</span>
        <span class="count">{{ pages.length }} 页</span>
      </div>
      <div class="actions">
        <div class="zoom-group" role="group" aria-label="总览缩放">
          <button type="button" class="zoom-btn" data-testid="overview-zoom-out" title="缩小" @click="zoomBy(-10)">−</button>
          <span class="zoom-value" data-testid="overview-zoom-value">{{ zoom }}%</span>
          <button type="button" class="zoom-btn" data-testid="overview-zoom-in" title="放大" @click="zoomBy(10)">+</button>
          <button type="button" class="zoom-btn fit" data-testid="overview-zoom-fit" @click="fitToView">适应窗口</button>
        </div>
        <span v-if="exporting" class="progress" data-testid="overview-progress">
          导出中 {{ progress?.current ?? 0 }}/{{ progress?.total ?? pages.length }}
        </span>
        <RgButton
          size="sm"
          :disabled="exporting || !pages.length"
          :loading="exporting"
          data-testid="overview-export-btn"
          @click="emit('export-overview')"
        >
          {{ exporting ? '导出中…' : '导出页面集总览 PNG' }}
        </RgButton>
      </div>
    </header>

    <p v-if="error" class="error" data-testid="overview-error" role="alert">{{ error }}</p>

    <StatePanel
      v-if="!pages.length"
      variant="empty"
      test-id="overview-empty"
      title="这个页面集还没有页面"
      description="先让 agent 生成设计，页面会出现在这里。"
      class="overview-state"
      compact
    />

    <div
      v-else
      ref="canvasRef"
      class="overview-canvas"
      data-testid="overview-canvas"
      @pointerdown="onPointerDown"
    >
      <div class="overview-stage" data-testid="overview-stage" :style="stageStyle">
        <article
          v-for="(page, index) in pages"
          :key="page.id"
          class="artboard"
          :style="artboardStyle(index)"
          :data-testid="`overview-card-${page.id}`"
          role="button"
          tabindex="0"
          @click="onSelectPage(page.id)"
          @keydown.enter="onSelectPage(page.id)"
        >
          <header class="artboard-label">
            <strong>{{ page.title }}</strong>
            <span class="type">{{ pageTypeLabel(page.type) }}</span>
            <span v-if="!hasExplicitContract(page)" class="badge">无显式契约</span>
          </header>
          <div class="artboard-frame">
            <iframe
              v-if="previewUrl(page) && !failed[page.id]"
              :src="previewUrl(page)"
              class="frame-el"
              loading="lazy"
              :data-testid="`overview-frame-${page.id}`"
              :title="`${page.title} 模板预览`"
              @error="markFailed(page.id)"
            />
            <div v-else class="frame-note">
              {{ failed[page.id] || '缺少应用类型/风格或页面不可预览，点击卡片查看单页。' }}
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import RgButton from '../shared/RgButton.vue'
import StatePanel from '../shared/StatePanel.vue'
import { PAGE_TYPE_LABELS, type DesignPageRender } from '../design/types'
import { buildDesignPreviewUrl } from './design-template-helpers.js'
import { hasExplicitContract } from '../design-preview/contract-preview.js'
import {
  clampOverviewZoom,
  fitOverviewZoom,
  overviewCanvasLayout,
  overviewZoomAt
} from '../design/overview-layout.js'

const props = defineProps<{
  pageSet: { id: string; title: string; epic?: string }
  pages: DesignPageRender[]
  appId: string
  applicationType?: string
  styleId?: string
  designHash?: string
  exporting?: boolean
  progress?: { current: number; total: number }
  error?: string
}>()

const emit = defineEmits<{
  (event: 'select-page', id: string): void
  (event: 'export-overview'): void
}>()

const failed = ref<Record<string, string>>({})
const canvasRef = ref<HTMLElement | null>(null)
const zoom = ref(100)
const panX = ref(0)
const panY = ref(0)
const layout = computed(() => overviewCanvasLayout(props.pages.length))

const stageStyle = computed(() => ({
  width: `${layout.value.width}px`,
  height: `${layout.value.height}px`,
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value / 100})`
}))

function artboardStyle(index: number): Record<string, string> {
  const board = layout.value.artboards[index]
  if (!board) return {}
  return {
    left: `${board.x}px`,
    top: `${board.y}px`,
    width: `${board.width}px`,
    height: `${board.height + board.labelHeight}px`
  }
}

function previewUrl(page: DesignPageRender): string {
  return buildDesignPreviewUrl({
    appId: props.appId,
    pageId: page.id,
    applicationType: props.applicationType ?? '',
    style: props.styleId ?? '',
    designHash: props.designHash ?? ''
  })
}

function pageTypeLabel(type: string): string {
  return PAGE_TYPE_LABELS[type as keyof typeof PAGE_TYPE_LABELS] ?? type
}

function markFailed(id: string): void {
  failed.value = { ...failed.value, [id]: '预览加载失败，可点开单页查看。' }
}

function zoomBy(delta: number): void {
  zoom.value = clampOverviewZoom(zoom.value + delta)
}

/** 适应窗口：按画布与世界的尺寸计算缩放，并复位平移 */
function fitToView(): void {
  const element = canvasRef.value
  if (!element) {
    zoom.value = 100
    panX.value = 0
    panY.value = 0
    return
  }
  zoom.value = fitOverviewZoom({
    viewportWidth: element.clientWidth,
    viewportHeight: element.clientHeight,
    worldWidth: layout.value.width,
    worldHeight: layout.value.height,
    padding: 48
  })
  panX.value = 0
  panY.value = 0
}

/** Ctrl/⌘ + 滚轮缩放（光标锚点）；普通滚轮平移；触摸板捏合走 ctrl+wheel */
function onWheel(event: WheelEvent): void {
  const element = canvasRef.value
  if (!element) return
  event.preventDefault()
  if (event.ctrlKey || event.metaKey) {
    const rect = element.getBoundingClientRect()
    const next = clampOverviewZoom(zoom.value * Math.exp(-event.deltaY * 0.0015))
    if (next === zoom.value) return
    const nextPan = overviewZoomAt({
      zoom: zoom.value,
      nextZoom: next,
      pointX: event.clientX - rect.left,
      pointY: event.clientY - rect.top,
      panX: panX.value,
      panY: panY.value
    })
    zoom.value = next
    panX.value = nextPan.panX
    panY.value = nextPan.panY
    return
  }
  panX.value -= event.deltaX
  panY.value -= event.deltaY
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  panX: number
  panY: number
  moved: boolean
}

let drag: DragState | null = null
let suppressClick = false

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 && event.button !== 1) return
  drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX: panX.value,
    panY: panY.value,
    moved: false
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(event: PointerEvent): void {
  if (!drag) return
  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return
  drag.moved = true
  panX.value = drag.panX + dx
  panY.value = drag.panY + dy
}

function onPointerUp(): void {
  const moved = drag?.moved ?? false
  drag = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  if (!moved) return
  // 本次拖动结束后抑制一次 click，避免误进单页
  suppressClick = true
  setTimeout(() => {
    suppressClick = false
  }, 0)
}

function onSelectPage(id: string): void {
  if (suppressClick) return
  emit('select-page', id)
}

onMounted(() => {
  canvasRef.value?.addEventListener('wheel', onWheel, { passive: false })
  failed.value = {}
  void nextTick(fitToView)
})

onUnmounted(() => {
  canvasRef.value?.removeEventListener('wheel', onWheel)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

watch(
  () => props.pages.length,
  () => {
    failed.value = {}
    void nextTick(fitToView)
  }
)
</script>

<style scoped>
.overview {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
  padding: 4px;
}
.overview-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.title strong {
  font-size: 14px;
  font-weight: 600;
}
.epic {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 4px;
  padding: 1px 6px;
}
.count {
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.zoom-group {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--rg-border);
  border-radius: 7px;
  overflow: hidden;
}
.zoom-btn {
  border: none;
  background: var(--rg-surface);
  color: var(--rg-text-2);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
}
.zoom-btn + .zoom-value,
.zoom-value + .zoom-btn,
.zoom-btn + .zoom-btn {
  border-left: 1px solid var(--rg-border);
}
.zoom-btn:hover,
.zoom-btn:focus-visible {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.zoom-value {
  min-width: 42px;
  text-align: center;
  font-size: 11px;
  color: var(--rg-text-2);
  font-variant-numeric: tabular-nums;
  padding: 0 4px;
}
.progress {
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.error {
  margin: 0;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border: 1px solid var(--rg-danger-soft);
  border-radius: 8px;
  padding: 6px 10px;
}
.overview-canvas {
  position: relative;
  flex: 1 1 auto;
  min-height: 280px;
  overflow: hidden;
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  background-color: var(--rg-canvas);
  background-image: radial-gradient(var(--rg-canvas-dot) 1px, transparent 1px);
  background-size: 16px 16px;
  background-position: -1px -1px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.overview-canvas:active {
  cursor: grabbing;
}
.overview-stage {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}
.artboard {
  position: absolute;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  background: var(--rg-surface);
  box-shadow: var(--rg-shadow-1);
  overflow: hidden;
  cursor: pointer;
}
.artboard:hover {
  border-color: var(--rg-border-strong);
}
.artboard-label {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 16px 18px;
  min-width: 0;
  border-bottom: 1px solid var(--rg-border);
}
.artboard-label strong {
  font-size: 20px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.artboard-label .type {
  font-size: 15px;
  color: var(--rg-text-3);
  white-space: nowrap;
}
.artboard-label .badge {
  margin-left: auto;
  font-size: 13px;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border: 1px solid var(--rg-warn-border);
  border-radius: 999px;
  padding: 1px 10px;
  white-space: nowrap;
}
.artboard-frame {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  background: var(--rg-surface-2);
  overflow: hidden;
}
.frame-el {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
  pointer-events: none;
}
.frame-note {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 24px;
  text-align: center;
  font-size: 20px;
  color: var(--rg-text-3);
}
.overview-state {
  max-width: 520px;
  margin: 36px auto;
}
</style>
