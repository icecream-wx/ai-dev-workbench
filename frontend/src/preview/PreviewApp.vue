<template>
  <div
    class="preview-root visual-style-host"
    :class="activeStyle.className"
    :data-type="typeId"
    :data-style="styleId"
    :data-page="pageId"
  >
    <div v-if="warnings.length" class="preview-warning" role="status">
      <strong>预览参数已回退</strong>
      <span v-for="item in warnings" :key="item">{{ item }}</span>
    </div>

    <div v-if="loadError" class="preview-error" role="alert">
      <strong>页面加载失败</strong>
      <span>{{ loadError }}</span>
    </div>

    <div v-else-if="!pageComponent" class="preview-loading">正在加载预览页面…</div>

    <component :is="pageComponent" v-else :key="`${typeId}/${pageId}`" />

    <div v-if="!embed" class="preview-badge" title="页面数据来自本地 mock，未连接真实平台">
      <i />
      设计模板预览 · {{ typeMeta.name }} / {{ pageMeta?.name }} · mock 数据
    </div>

    <div v-if="!embed" class="preview-style-switch" role="group" aria-label="视觉风格切换">
      <span>风格</span>
      <button
        v-for="item in styles"
        :key="item.id"
        type="button"
        :class="{ active: item.id === styleId }"
        :title="item.name"
        :aria-pressed="item.id === styleId"
        @click="switchStyle(item.id)"
      >
        <i :style="{ background: item.signature }" />
        {{ item.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue'
import type { Component } from 'vue'
import {
  applicationTypes,
  defaultApplicationType,
  defaultStyle,
  pageLoaders,
  styles,
  structureLoaders
} from './registry'
import { resolvePreviewParams, embedEnabled, resolveStructureOverride, structureAssetUrl, applyStructureOverride } from './preview-params.js'

const meta = {
  applicationTypes: applicationTypes.length
    ? applicationTypes
    : [{ id: defaultApplicationType, defaultStyle, pages: [] }],
  styles: styles.length ? styles : [{ id: defaultStyle }]
}

const resolved = resolvePreviewParams(window.location.search, meta)
/** 工作台 iframe 嵌入：隐藏预览自带风格切换器与 mock 角标（P8-2） */
const embed = embedEnabled(window.location.search)
/** 自定义 pack 结构样式覆盖（P7-7b-2a）：reference 页用合并后的 structure.css */
const structureOverride = resolveStructureOverride(window.location.search)

const typeId = shallowRef(resolved.typeId)
const styleId = shallowRef(resolved.styleId)
const pageId = shallowRef(resolved.pageId)
const warnings = shallowRef(resolved.warnings)

const typeMeta = computed(
  () => applicationTypes.find((item) => item.id === typeId.value) || applicationTypes[0]
)
const pageMeta = computed(
  () => typeMeta.value?.pages.find((item) => item.id === pageId.value) || null
)
const activeStyle = computed(
  () => styles.find((item) => item.id === styleId.value) || styles[0]
)

const pageComponent = shallowRef<Component | null>(null)
const loadError = shallowRef('')

async function loadPage(type: string, page: string): Promise<void> {
  loadError.value = ''
  pageComponent.value = null
  const loader = pageLoaders[type]?.[page]
  if (!loader) {
    loadError.value = `应用类型 ${type} 下找不到页面 ${page}`
    return
  }
  try {
    const mod = (await loader()) as { default: Component }
    pageComponent.value = mod.default || (mod as unknown as Component)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  }
}

let structureStyleElement: HTMLStyleElement | null = null
let structureFallbackWarned = false

function ensureStructureElement(): HTMLStyleElement {
  if (!structureStyleElement) {
    structureStyleElement = document.createElement('style')
    structureStyleElement.id = 'preview-structure-css'
    document.head.appendChild(structureStyleElement)
  }
  return structureStyleElement
}

async function applyRegistryStructureCss(type: string): Promise<boolean> {
  const loader = structureLoaders[type]
  if (!loader) return false
  try {
    const css = (await loader()).default
    ensureStructureElement().textContent = css
    return true
  } catch {
    // 结构样式加载失败不影响页面本身渲染；页面自带 scoped 样式仍生效
    return false
  }
}

async function applyStructureCss(type: string): Promise<void> {
  // P7-7b-2a：自定义 pack 覆盖；失败回退内置源类型 structure.css 并提示
  if (structureOverride.packId) {
    try {
      const res = await fetch(structureAssetUrl(structureOverride))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const css = await res.text()
      if (!css.trim()) throw new Error('结构样式为空')
      ensureStructureElement().textContent = css
      return
    } catch (error) {
      if (!structureFallbackWarned) {
        structureFallbackWarned = true
        const detail = error instanceof Error ? error.message : String(error)
        warnings.value = [...warnings.value, `结构样式加载失败（${detail}），已回退内置源类型结构样式`]
      }
    }
  }
  await applyRegistryStructureCss(type)
}

function updateLocation(): void {
  const query = new URLSearchParams()
  query.set('type', typeId.value)
  query.set('style', styleId.value)
  query.set('page', pageId.value)
  if (embed) query.set('embed', '1')
  applyStructureOverride(query, structureOverride)
  window.history.replaceState(null, '', `?${query.toString()}`)
  const title = [pageMeta.value?.name, typeMeta.value?.name, activeStyle.value?.name]
    .filter(Boolean)
    .join(' · ')
  document.title = title ? `${title} · 设计模板预览` : '设计模板预览'
}

function switchStyle(id: string): void {
  if (!styles.some((item) => item.id === id) || id === styleId.value) return
  // 只切换根节点视觉风格类，不重建页面组件，避免丢失页面内部状态
  styleId.value = id
  updateLocation()
}

watch(
  [typeId, pageId],
  ([type, page]) => {
    void loadPage(type, page)
    void applyStructureCss(type)
    updateLocation()
  },
  { immediate: true }
)

onMounted(() => {
  document.getElementById('preview-boot')?.remove()
})
</script>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
}

body {
  background: var(--template-bg, #eef3fa);
}

.preview-root {
  min-height: 100%;
  overflow: auto;
}

.preview-root .optimized-suite {
  min-height: 100%;
}

.preview-loading {
  display: grid;
  place-items: center;
  min-height: 60vh;
  color: #64748b;
  font-size: 13px;
}

.preview-warning,
.preview-error {
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 14px;
  font-size: 12px;
  line-height: 1.5;
}

.preview-warning {
  color: #8a5a00;
  border-bottom: 1px solid #f0d89b;
  background: #fff8e6;
}

.preview-error {
  color: #a02622;
  border-bottom: 1px solid #f2c0bd;
  background: #fff1f0;
}

.preview-warning strong,
.preview-error strong {
  font-size: 12px;
}

.preview-badge {
  position: fixed;
  right: 16px;
  bottom: 14px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: min(60vw, 520px);
  padding: 5px 10px;
  color: #40536d;
  border: 1px solid #d7e1f0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 6px 18px rgba(31, 94, 255, 0.12);
  font-size: 11px;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-badge i {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22a06b;
}

.preview-style-switch {
  position: fixed;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid #d7e1f0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 6px 18px rgba(31, 94, 255, 0.12);
  font-size: 11px;
}

.preview-style-switch > span {
  padding: 0 4px;
  color: #8a9ab0;
}

.preview-style-switch button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  color: #40536d;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  font-size: 11px;
  cursor: pointer;
}

.preview-style-switch button:hover {
  background: #eef3fa;
}

.preview-style-switch button.active {
  color: #10233d;
  border-color: #b9c7d9;
  background: #e8f0ff;
  font-weight: 600;
}

.preview-style-switch button i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
}
</style>
