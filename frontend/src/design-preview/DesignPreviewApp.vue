<template>
  <div
    ref="rootRef"
    class="design-preview-root visual-style-host"
    :class="[styleClass, { 'is-capture': capture }]"
    :data-type="typeId"
    :data-style="styleId"
    :data-page="pageId"
    :data-recipe="recipe"
    :data-template-kind="previewKind || undefined"
    :data-base-type="baseTypeId || undefined"
    :data-structure-fallback="structureFallback ? '1' : undefined"
    :data-capture="capture ? '1' : undefined"
  >
    <div class="optimized-suite" :class="[shortTypeClass, `application-type-${typeId}`]">
      <div class="template-stage">
        <div class="business-page">
          <div v-if="loading" class="design-preview-state" data-testid="design-preview-loading">
            正在加载设计产物…
          </div>
          <div v-else-if="error" class="design-preview-state error" data-testid="design-preview-error">
            <strong>设计产物渲染失败</strong>
            <span>{{ error }}</span>
            <p>请回到设计视图检查 entities.json / pages.json。</p>
          </div>
          <ContractPage
            v-else
            :page="page"
            :entity="entity"
            :recipe="recipe"
            :entities="entities"
            :primary="primaryColor"
            @action="onAction"
          />
        </div>
      </div>
    </div>

    <ContractActionDialog
      v-if="actionDialog"
      :page="actionDialog.page"
      :entity="entityOfPage(actionDialog.page)"
      :row="actionDialog.row"
      :mode="actionDialog.mode"
      :temporary="actionDialog.temporary"
      @submit="onActionDialogSubmit"
      @cancel="actionDialog = null"
    />

    <div
      v-if="!capture"
      class="design-preview-badge interactive"
      data-testid="design-preview-interactive-badge"
    >
      <i />
      交互预览 · 不保存
    </div>

    <div v-if="structureFallback && !embed && !capture" class="design-preview-badge warn" data-testid="design-preview-structure-warning">
      <i />
      自定义模板结构样式加载失败，已回退内置结构（请检查应用设计模板资产）
    </div>

    <div v-if="!embed && !capture" class="design-preview-badge" data-testid="design-preview-badge">
      <i />
      设计产物模板风格预览 · {{ typeName }} / {{ styleName }} · mock 数据
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import html2canvas from 'html2canvas'
import ContractPage from './ContractPage.vue'
import ContractActionDialog from './ContractActionDialog.vue'
import { adaptDesign } from '../design/design-adapter.js'
import {
  applicationTypes,
  defaultApplicationType,
  defaultStyle,
  structureLoaders,
  styles
} from '../preview/registry'
import { actionLabel, resolveContractRecipe } from './contract-preview.js'
import { buildTemporaryFormPage, resolveActionTarget } from './interaction.js'
import { resolveCustomPreview, shortTypeClassOf } from './custom-preview.js'

/**
 * P9 设计产物模板风格预览入口（frontend/design-preview.html，iframe 专用）
 *
 * URL：?app=&page=&type=&style=&embed=1&v=<designHash>&capture=1
 * 输入是 `GET /api/apps/:id/artifacts` 的实体集/页面集（entities.json + pages.json）；
 * 用所选应用类型的 structure.css + 视觉风格类还原模板结构与组件。
 *
 * P7-7c：自定义模板读 `design-system.preview`——base 应用类型短类 + 应用内资产接口的
 * 合并 structure.css + 内置风格类；失败回退 registry 并 warning（协议/尺寸不变）。
 *
 * P10 截图：`capture=1&rid=<id>` 时隐藏 notes/角标、禁用动画，加载完成后向父窗口发
 * `ready`；父窗口回 `capture` 后在本 iframe 内用 html2canvas 截模板页面并回 `png`/`error`。
 */
const PREVIEW_SOURCE = 'adp-design-preview'
const DESIGN_VIEW_SOURCE = 'adp-design-view'

const query = new URLSearchParams(window.location.search)
const appId = (query.get('app') || '').trim()
const pageId = (query.get('page') || '').trim()
const embed = (() => {
  const value = (query.get('embed') || '').trim().toLowerCase()
  return value === '1' || value === 'true'
})()
const capture = (() => {
  const value = (query.get('capture') || '').trim().toLowerCase()
  return value === '1' || value === 'true'
})()
const requestId = (query.get('rid') || '').trim()

const rootRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref('')
const page = ref<any>(null)
const entity = ref<any>(null)
const entities = ref<any[]>([])
/** 全部页面（交互预览同页面集解析目标页用） */
const allPages = ref<any[]>([])
/** 设计系统模板页面（catalogRef → 配方解析） */
const templatePages = ref<any[]>([])
/** 交互预览表单弹窗（create/edit） */
const actionDialog = ref<{ page: any; row: any; mode: 'create' | 'edit'; temporary?: boolean } | null>(null)
const typeId = ref(defaultApplicationType)
const styleId = ref(defaultStyle)
const recipe = ref('')
/** 自定义模板预览映射（design-system.json 的 preview；内置为 null） */
const preview = ref<ReturnType<typeof resolveCustomPreview> | null>(null)
/** 设计系统里的应用类型显示名（自定义 type 不在 registry 时用它，避免显示裸 id） */
const apiTypeName = ref('')
const structureFallback = ref(false)

const previewKind = computed(() => (preview.value?.kind === 'custom' ? 'custom' : ''))
const baseTypeId = computed(() => (previewKind.value ? preview.value?.baseApplicationType || '' : ''))
const styleClass = computed(() => {
  if (previewKind.value && preview.value?.styleClassName) return preview.value.styleClassName
  return styles.find(item => item.id === styleId.value)?.className || `visual-style-${styleId.value}`
})
const shortTypeClass = computed(() => {
  if (previewKind.value) return preview.value?.shortTypeClass || shortTypeClassOf(baseTypeId.value)
  return shortTypeClassOf(typeId.value)
})
const typeName = computed(() => {
  if (previewKind.value && preview.value?.typeName) return preview.value.typeName
  return applicationTypes.find(item => item.id === typeId.value)?.name || apiTypeName.value || typeId.value
})
const styleName = computed(() => styles.find(item => item.id === styleId.value)?.name || styleId.value)
/** 模板主色（视觉风格 tokens；驾驶舱图表 series 用） */
const primaryColor = computed(() => {
  const tokens = styles.find(item => item.id === styleId.value)?.tokens as Record<string, unknown> | undefined
  const primary = tokens?.primary
  return typeof primary === 'string' && primary.trim() ? primary.trim() : '#145fba'
})

let structureStyleElement: HTMLStyleElement | null = null
let readySent = false
let captureBusy = false

function structureStyleTarget(): HTMLStyleElement {
  if (!structureStyleElement) {
    structureStyleElement = document.createElement('style')
    structureStyleElement.id = 'design-preview-structure-css'
    document.head.appendChild(structureStyleElement)
  }
  return structureStyleElement
}

/** 内置 registry 的结构样式（自定义模板加载失败时回退） */
async function applyRegistryStructure(type: string): Promise<void> {
  const loader = structureLoaders[type]
  if (!loader) return
  try {
    const css = (await loader()).default
    structureStyleTarget().textContent = css
  } catch {
    // 结构样式失败不影响内容渲染（共享样式与页面自带样式仍生效）
  }
}

/**
 * 结构样式：自定义模板从应用资产接口取合并后的 structure.css；
 * 失败回退内置 registry（base 应用类型）并记录 warning（不阻断渲染）。
 */
async function applyStructureCss(type: string): Promise<void> {
  structureFallback.value = false
  const customUrl = previewKind.value ? preview.value?.structureUrl || '' : ''
  if (customUrl) {
    try {
      const res = await fetch(customUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const css = await res.text()
      if (!css.trim()) throw new Error('结构样式为空')
      structureStyleTarget().textContent = css
      return
    } catch (err) {
      structureFallback.value = true
      console.warn(
        `[design-preview] 自定义结构样式加载失败，回退内置结构（${baseTypeId.value || type}）：${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }
  await applyRegistryStructure(baseTypeId.value || type)
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}：${url}`)
  return res.json()
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    if (!appId) throw new Error('缺少 app 参数（design-preview.html?app=&page=）')
    if (!pageId) throw new Error('缺少 page 参数')

    const [artifacts, designSystem] = await Promise.all([
      fetchJson(`/api/apps/${encodeURIComponent(appId)}/artifacts`),
      fetchJson(`/api/apps/${encodeURIComponent(appId)}/design-system`).catch(() => null)
    ])
    const adapted = adaptDesign({
      entities: artifacts?.entities?.entities ?? [],
      relations: artifacts?.entities?.relations ?? [],
      pageSets: artifacts?.pages?.pageSets ?? []
    })
    const target = adapted.pages.find((item: any) => item.id === pageId)
    if (!target) throw new Error(`pages.json 中找不到页面 ${pageId}`)
    const templatePageList = Array.isArray(designSystem?.pages) ? designSystem.pages : []

    preview.value = null
    apiTypeName.value = typeof designSystem?.applicationType?.name === 'string' ? designSystem.applicationType.name : ''
    typeId.value =
      (query.get('type') || '').trim() ||
      adapted.designSystem?.applicationType ||
      designSystem?.applicationType?.id ||
      defaultApplicationType
    styleId.value =
      (query.get('style') || '').trim() || adapted.designSystem?.style || designSystem?.style?.id || defaultStyle
    preview.value = resolveCustomPreview(designSystem, { typeId: typeId.value })
    recipe.value = resolveContractRecipe(target, templatePageList)

    page.value = target
    entity.value = adapted.entities.find((item: any) => item.id === target.entityId) || null
    entities.value = adapted.entities
    allPages.value = adapted.pages
    templatePages.value = templatePageList
    actionDialog.value = null

    await applyStructureCss(typeId.value)
    document.title = [target.title, typeName.value, styleName.value].filter(Boolean).join(' · ')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
    if (capture) {
      if (error.value) {
        window.parent.postMessage(
          { source: PREVIEW_SOURCE, type: 'error', id: requestId, message: error.value },
          location.origin
        )
      } else {
        void signalReady()
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * B5 交互预览层：动作 → 弹窗 / 切页 / 确认 / 提示（不写数据、不调接口）
 * ------------------------------------------------------------------ */

function entityOfPage(target: any): any {
  const id = target?.entityId
  return entities.value.find((item: any) => item.id === id) || null
}

/** 本地切页（独立打开 design-preview.html 时；iframe 内交给父层切 Tab） */
function switchPage(target: any): void {
  page.value = target
  entity.value = entityOfPage(target)
  recipe.value = resolveContractRecipe(target, templatePages.value)
  actionDialog.value = null
  document.title = [target?.title, typeName.value, styleName.value].filter(Boolean).join(' · ')
}

function navigateTo(target: any): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(
      { source: PREVIEW_SOURCE, type: 'navigate-page', pageId: target?.id },
      location.origin
    )
    return
  }
  switchPage(target)
}

async function confirmDelete(label: string): Promise<void> {
  try {
    await ElMessageBox.confirm('交互预览不会保存任何修改，是否继续？', `${label}（预览）`, {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    })
    ElMessage.success('已删除（预览）')
  } catch {
    // 取消：页面不变
  }
}

function onAction(payload: { code: string; label?: string; row?: any }): void {
  const code = payload?.code || ''
  const label = payload?.label || actionLabel(code)
  const result = resolveActionTarget({ action: code, page: page.value, pages: allPages.value })
  if (result.kind === 'dialog') {
    actionDialog.value = { page: result.page, row: payload?.row ?? null, mode: code === 'edit' ? 'edit' : 'create' }
    return
  }
  if (result.kind === 'navigate') {
    navigateTo(result.page)
    return
  }
  if (result.kind === 'confirm') {
    void confirmDelete(label)
    return
  }
  if (result.kind === 'notify') {
    ElMessage.info(`${label}（预览）`)
    return
  }
  if (result.kind === 'none') {
    const reason = (result as any).reason || '该页面集未设计新增/编辑页'
    const canTemporary = code === 'create' || code === 'edit'
    const temporary = canTemporary ? buildTemporaryFormPage(page.value, entityOfPage(page.value)) : null
    if (temporary) {
      actionDialog.value = { page: temporary, row: payload?.row ?? null, mode: code === 'edit' ? 'edit' : 'create', temporary: true }
      ElMessage.warning(`${reason}（预览 · 已打开临时表单）`)
      return
    }
    ElMessage.warning(`${reason}（预览）`)
    return
  }
  ElMessage.warning(`${(result as any).reason || '该页面集未设计新增/编辑页'}（预览）`)
}

function onActionDialogSubmit(): void {
  actionDialog.value = null
  ElMessage.success('已提交（预览）')
}

/* ------------------------------------------------------------------ *
 * P10 模板风格截图（iframe 内自截 → postMessage 回工作台）
 * ------------------------------------------------------------------ */

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

/** 等懒加载图表出现（最多 ~2s），避免截图时 pm-echarts 还是空容器 */
async function waitForCharts(limitMs = 2000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < limitMs) {
    const canvases = Array.from(document.querySelectorAll('.optimized-suite canvas')) as HTMLCanvasElement[]
    if (canvases.length && canvases.every(canvas => canvas.width > 0 && canvas.height > 0)) return
    await nextFrame()
  }
}

async function signalReady(): Promise<void> {
  if (readySent) return
  readySent = true
  try {
    await nextTick()
    if (document.fonts?.ready) await document.fonts.ready
  } catch {
    // 字体 API 不可用（旧浏览器）不阻断截图
  }
  await nextFrame()
  await nextFrame()
  await waitForCharts()
  await new Promise(resolve => setTimeout(resolve, 300))
  window.parent.postMessage(
    { source: PREVIEW_SOURCE, type: 'ready', id: requestId, pageId },
    location.origin
  )
}

function captureTarget(): HTMLElement | null {
  return (
    (rootRef.value?.querySelector('.optimized-suite') as HTMLElement | null) ||
    (document.querySelector('.optimized-suite') as HTMLElement | null) ||
    rootRef.value
  )
}

function clampScale(value: unknown): number {
  const scale = Number(value)
  if (!Number.isFinite(scale)) return 2
  return Math.min(Math.max(scale, 1), 3)
}

/**
 * html2canvas 1.4.1 不支持 CSS Color 4 的 `color(srgb …)`（部分模板用 color-mix 计算得到）。
 * 截图克隆节点时把这类计算值替换为等价可解析颜色，避免整页截图失败；只影响截图，不改预览。
 */
const UNSUPPORTED_COLOR = /\bcolor\(|\boklch\(|\blab\(|\blch\(/i
const CAPTURE_COLOR_PROPS: Array<[string, string]> = [
  ['color', '#333333'],
  ['background-color', 'transparent'],
  ['border-color', '#888888'],
  ['border-top-color', '#888888'],
  ['border-right-color', '#888888'],
  ['border-bottom-color', '#888888'],
  ['border-left-color', '#888888'],
  ['outline-color', '#888888'],
  ['text-decoration-color', '#888888'],
  ['caret-color', '#333333'],
  ['column-rule-color', '#888888'],
  ['box-shadow', 'none'],
  ['background-image', 'none'],
  ['fill', '#333333'],
  ['stroke', '#333333']
]

function sanitizeClonedColors(clonedDoc: Document): void {
  const view = clonedDoc.defaultView
  if (!view) return
  for (const element of Array.from(clonedDoc.querySelectorAll<HTMLElement>('*'))) {
    const computed = view.getComputedStyle(element)
    for (const [prop, fallback] of CAPTURE_COLOR_PROPS) {
      const value = computed.getPropertyValue(prop)
      if (value && UNSUPPORTED_COLOR.test(value)) element.style.setProperty(prop, fallback, 'important')
    }
  }
}

async function doCapture(id: string, scale: number): Promise<void> {
  if (captureBusy) return
  captureBusy = true
  const target = captureTarget()
  try {
    if (!target) throw new Error('模板页面尚未渲染')
    window.scrollTo(0, 0)
    if (rootRef.value) rootRef.value.scrollTop = 0
    await nextFrame()
    await nextTick()
    const background = getComputedStyle(document.body).backgroundColor
    const canvas = await html2canvas(target, {
      backgroundColor: background && background !== 'rgba(0, 0, 0, 0)' ? background : '#ffffff',
      scale: clampScale(scale),
      useCORS: true,
      logging: false,
      width: Math.max(target.scrollWidth, target.clientWidth),
      height: Math.max(target.scrollHeight, target.clientHeight),
      windowWidth: Math.max(target.scrollWidth, target.clientWidth),
      windowHeight: Math.max(target.scrollHeight, target.clientHeight),
      onclone: clonedDoc => sanitizeClonedColors(clonedDoc)
    })
    const dataUrl = canvas.toDataURL('image/png')
    window.parent.postMessage(
      { source: PREVIEW_SOURCE, type: 'png', id, dataUrl, width: canvas.width, height: canvas.height },
      location.origin
    )
  } catch (err) {
    window.parent.postMessage(
      {
        source: PREVIEW_SOURCE,
        type: 'error',
        id,
        message: err instanceof Error ? err.message : String(err)
      },
      location.origin
    )
  } finally {
    captureBusy = false
  }
}

function onParentMessage(event: MessageEvent): void {
  if (!capture) return
  if (event.origin !== location.origin) return
  if (event.source !== window.parent) return
  const data = event.data as Record<string, unknown> | null
  if (!data || data.source !== DESIGN_VIEW_SOURCE || data.type !== 'capture') return
  const id = typeof data.id === 'string' && data.id ? data.id : requestId
  void doCapture(id, clampScale(data.scale))
}

onMounted(() => {
  document.getElementById('design-preview-boot')?.remove()
  if (capture) window.addEventListener('message', onParentMessage)
  void load()
})

onUnmounted(() => {
  window.removeEventListener('message', onParentMessage)
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

.design-preview-root {
  min-height: 100%;
  overflow: auto;
}

.design-preview-root .optimized-suite {
  min-height: 100%;
}

/* P10 截图模式：整页展开、隐藏提示与角标、禁用动画 */
.design-preview-root.is-capture {
  overflow: visible;
}

.design-preview-root.is-capture .optimized-suite {
  height: auto;
  min-height: 100vh;
  overflow: visible;
}

.design-preview-root.is-capture * {
  animation: none !important;
  transition: none !important;
}

.design-preview-root.is-capture .contract-notes {
  display: none !important;
}

.design-preview-state {
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 60vh;
  color: #64748b;
  font-size: 13px;
  text-align: center;
}

.design-preview-state.error {
  align-content: center;
  color: #a02622;
}

.design-preview-state.error strong {
  font-size: 14px;
}

.design-preview-state.error p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.design-preview-badge {
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

.design-preview-badge i {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22a06b;
}

.design-preview-badge.warn {
  bottom: 46px;
  color: #8a5a00;
  border-color: #f0d9a8;
  background: rgba(255, 249, 237, 0.95);
}

.design-preview-badge.warn i {
  background: #d99a1c;
}

/* B5 交互预览角标（左下，避免与模板信息角标重叠；截图模式隐藏） */
.design-preview-badge.interactive {
  right: auto;
  left: 16px;
  bottom: 14px;
  color: #1f6b4a;
  border-color: #bfe3d0;
  background: rgba(240, 253, 246, 0.95);
}

.design-preview-badge.interactive i {
  background: #1f9d63;
}
</style>
