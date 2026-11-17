<template>
  <section
    class="pv-panel"
    data-testid="requirements-prototype-preview"
    :data-spec-state="specState?.status ?? 'missing'"
  >
    <header class="pv-head">
      <div class="pv-head-main">
        <span class="pv-chip current">AI 参考原型</span>
        <strong class="pv-module" data-testid="prototype-module-title">{{ moduleTitle || preview?.module?.title || '需求模块' }}</strong>
        <span v-if="preview?.module" class="pv-module-key">{{ preview.module.key }}</span>
        <span v-if="preview?.template" class="pv-template" data-testid="prototype-template">
          {{ preview.template.name }}
          <span class="pv-source" data-testid="prototype-template-source">{{ templateSourceLabel(preview.template.source) }}</span>
        </span>
        <span v-if="versionLabel" class="pv-version">{{ versionLabel }}</span>
        <span v-if="spec" class="pv-stats" data-testid="prototype-spec-meta">{{ specMetaLabel(spec) }}</span>
        <span v-if="spec" class="pv-stats" data-testid="prototype-spec-coverage">{{ coverageLabel(specState?.coverage) }}</span>
      </div>
      <div class="pv-head-actions">
        <button
          v-if="spec"
          type="button"
          class="pv-btn"
          data-testid="prototype-regenerate"
          :disabled="generating || archivedModule"
          @click="generate(true)"
        >
          {{ generating ? '生成中…' : '重新生成' }}
        </button>
        <button
          v-else-if="preview && !emptyReason"
          type="button"
          class="pv-btn primary"
          data-testid="prototype-generate"
          :disabled="generating || archivedModule"
          @click="generate(false)"
        >
          {{ generating ? '生成中…' : '生成原型参考' }}
        </button>
        <button type="button" class="pv-btn" data-testid="prototype-refresh" :disabled="loading || generating" @click="emit('refresh')">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
        <button type="button" class="pv-btn" data-testid="prototype-open-doc" @click="emit('open-doc')">查看文档</button>
      </div>
    </header>

    <p class="pv-note-bar" data-testid="prototype-note">
      AI 参考原型 · 仅用于需求评审，不进入设计阶段/交接包
      <span v-if="docReadonlyHint" class="pv-note-readonly">{{ docReadonlyHint }}</span>
      <span v-if="archivedModule" class="pv-note-readonly" data-testid="prototype-archived-hint">
        模块已归档，不能重新生成（仅可查看旧规格）
      </span>
    </p>

    <div v-if="warnings.length" class="pv-warnings" data-testid="prototype-warnings">
      <span v-for="(warning, index) in warnings" :key="`${warning.code}-${index}`" class="pv-warning-chip" data-testid="prototype-warning">
        {{ warningText(warning) }}
      </span>
    </div>

    <div v-if="spec && specState?.status === 'stale'" class="pv-stale" data-testid="prototype-stale-banner">
      <span>
        需求已更新（v{{ spec.base.docVersion }} → v{{ preview?.module?.docVersion ?? 0 }}），建议重新生成参考原型；当前仍显示旧规格。
      </span>
      <button
        type="button"
        class="pv-btn"
        data-testid="prototype-stale-regenerate"
        :disabled="generating || archivedModule"
        @click="generate(true)"
      >
        重新生成
      </button>
    </div>

    <div v-if="generateError" class="pv-gen-error" data-testid="prototype-spec-error">
      <div class="pv-gen-error-main">
        <strong>原型生成失败</strong>
        <span data-testid="prototype-spec-error-message">{{ generateError }}</span>
      </div>
      <button
        type="button"
        class="pv-btn"
        data-testid="prototype-spec-retry"
        :disabled="generating || archivedModule"
        @click="generate(false)"
      >
        重试
      </button>
    </div>

    <details
      v-if="generateError && generateErrorDetail"
      class="pv-gen-detail"
      data-testid="prototype-spec-error-detail-wrap"
    >
      <summary>模型输出片段（前 300 字）</summary>
      <pre data-testid="prototype-spec-error-detail">{{ generateErrorDetail }}</pre>
    </details>

    <div v-if="generating && spec" class="pv-generating-bar" data-testid="prototype-spec-generating-bar">
      <span>正在生成原型参考…（通常 10—40 秒）</span>
      <button type="button" class="pv-btn" data-testid="prototype-spec-cancel" @click="cancelGenerate">取消</button>
    </div>

    <div v-if="loading && !preview" class="pv-state" data-testid="prototype-loading">正在加载原型参考…</div>
    <div v-else-if="error" class="pv-state error" data-testid="prototype-error">
      {{ error }}
      <div><button type="button" class="pv-btn" data-testid="prototype-error-retry" @click="load">重试</button></div>
    </div>
    <div v-else-if="emptyReason === 'no-module'" class="pv-state empty" data-testid="prototype-empty">
      <strong>应用还没有未归档的需求模块</strong>
      <p>确认需求前会按应用模板创建默认模块；创建模块后即可生成 AI 参考原型。</p>
    </div>
    <div v-else-if="generating && !spec" class="pv-state" data-testid="prototype-spec-generating">
      <strong>正在生成原型参考…</strong>
      <p>按当前模块需求由 AI 生成实体/字段/页面（通常 10—40 秒）。生成只写预览规格，不写设计数据。</p>
      <button type="button" class="pv-btn" data-testid="prototype-spec-generating-cancel" @click="cancelGenerate">取消</button>
    </div>
    <div v-else-if="!spec" class="pv-state empty" data-testid="prototype-spec-empty">
      <strong>还没有原型参考</strong>
      <p>
        按当前模块需求由 AI 生成实体、字段与页面，用真实字段和示例数据做需求评审；只写预览规格，<b>不进入设计阶段/交接包</b>。
      </p>
      <p class="pv-range" data-testid="prototype-spec-range">
        当前范围：{{ rangeLabel(preview?.stats) }} · Story 覆盖 —
      </p>
      <p v-if="!preview?.stats?.epics" class="pv-range-hint">建议先补全 Epics &amp; Stories，页面会挂到 Epic 上。</p>
      <button
        type="button"
        class="pv-btn primary"
        data-testid="prototype-spec-empty-generate"
        :disabled="generating || archivedModule"
        @click="generate(false)"
      >
        生成原型参考
      </button>
    </div>

    <template v-else>
      <div v-if="spec" class="pv-spec-info" data-testid="prototype-spec-info">
        <span data-testid="prototype-spec-model">模型 {{ spec.model || '未知' }}</span>
        <span v-if="generatedLabel" data-testid="prototype-spec-generated-at">生成于 {{ generatedLabel }}</span>
        <span data-testid="prototype-spec-base">{{ baseLabel(spec) }}</span>
        <span>{{ specMetaLabel(spec) }}</span>
        <span>{{ coverageLabel(specState?.coverage) }}</span>
      </div>

      <details v-if="spec?.notes?.length" class="pv-spec-notes" data-testid="prototype-spec-notes">
        <summary>{{ spec.notes.length }} 条生成说明 / 待确认</summary>
        <ul>
          <li v-for="(note, index) in spec.notes" :key="`note-${index}`">{{ note }}</li>
        </ul>
      </details>

      <div class="pv-chips" data-testid="prototype-pagesets">
        <button
          v-for="group in groups"
          :key="group.key"
          type="button"
          :class="['pv-chip-btn', { on: group.key === groupKey }]"
          :data-testid="`prototype-pageset-${group.epicId ?? 'other'}`"
          @click="selectGroup(group)"
        >
          <span class="pv-chip-key">{{ group.epicId ?? '其他' }}</span>
          <span class="pv-chip-title">{{ group.title || '未命名页面集' }}</span>
          <span class="pv-chip-count">{{ group.pages.length }}</span>
        </button>
      </div>

      <div class="pv-chips pages" data-testid="prototype-pages">
        <button
          v-for="page in currentPages"
          :key="page.id"
          type="button"
          :class="['pv-chip-btn', 'page', { on: page.id === pageId }]"
          :title="page.title"
          :data-testid="`prototype-page-${page.id}`"
          @click="selectPage(page)"
        >
          <span class="pv-chip-title">{{ specPageTitle(page) }}</span>
          <span class="pv-chip-type">{{ specPageTypeLabel(page.type) }}</span>
        </button>
        <span v-if="!currentPages.length" class="pv-chip-empty">该 Epic 还没有 AI 页面（可重新生成）</span>
      </div>

      <div ref="canvasRef" class="pv-canvas">
        <div :class="['proto-skin', `skin-${preview?.template?.category ?? 'custom'}`, 'pv-skin']" :style="skinStyle">
          <div :class="['proto-shell', 'pv-shell', { 'is-topbar': preview?.template?.shell.type === 'topbar' }]">
            <aside
              v-if="preview?.template?.shell.type !== 'topbar'"
              :class="['proto-sidebar', { 'is-light': !preview?.template?.shell.sidebarDark }]"
            >
              <div class="proto-brand">{{ preview?.module?.title || moduleTitle }}</div>
              <button
                v-for="group in groups"
                :key="`nav-${group.key}`"
                type="button"
                :class="['proto-nav-item', 'pv-nav', { 'is-active': group.key === groupKey }]"
                @click="selectGroup(group)"
              >
                <span class="proto-nav-dot" />
                <span class="pv-nav-text">{{ group.title || '未命名页面集' }}</span>
              </button>
            </aside>

            <div class="proto-main">
              <div class="proto-topbar">
                <template v-if="preview?.template?.shell.type === 'topbar'">
                  <span class="proto-brand pv-topbar-brand">{{ preview?.module?.title || moduleTitle }}</span>
                  <button
                    v-for="group in groups"
                    :key="`top-${group.key}`"
                    type="button"
                    :class="['proto-nav-item', 'pv-nav', { 'is-active': group.key === groupKey }]"
                    @click="selectGroup(group)"
                  >
                    {{ group.title || '未命名页面集' }}
                  </button>
                </template>
                <template v-else>
                  <span class="proto-topbar-title">{{ currentPageRaw ? specPageTitle(currentPageRaw) : currentGroup?.title || '—' }}</span>
                  <span class="proto-topbar-sub">{{ currentPageRaw ? specPageTypeLabel(currentPageRaw.type) : '页面集' }}</span>
                </template>
                <span class="proto-topbar-actions">AI 参考原型 · {{ preview?.template?.name ?? '模板' }}</span>
              </div>

              <div class="proto-canvas-scroll">
                <div v-if="!currentPageRaw" class="proto-empty">
                  {{ currentGroup ? '该页面集还没有 AI 页面（可重新生成）' : '选择左侧页面集查看参考原型' }}
                </div>
                <div v-else class="pv-stage" :style="stageStyle">
                  <div ref="paperRef" class="proto-paper pv-paper" :style="paperStyle" data-testid="prototype-paper">
                    <PrototypeRenderer
                      v-if="currentSpecPage && currentSpecEntity"
                      :page="currentSpecPage"
                      :entity="currentSpecEntity"
                      :layout="undefined"
                      :rows="currentRows"
                      :notes="[]"
                      :mobile="false"
                      :pages="[]"
                      module-id="requirements-preview"
                      readonly
                    />
                    <div v-else-if="currentSpecPage" class="proto-empty" data-testid="prototype-page-no-entity">
                      该页面未绑定实体（AI 未在需求文档中找到对应字段），请补充「业务规则与数据要求」后重新生成。
                    </div>
                    <div v-else class="proto-empty">选择页面查看参考原型</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import PrototypeRenderer from '../design/prototype/PrototypeRenderer.vue'
import { mockRows, type MockRow } from '../design/prototype/mock'
import type { SpecEntity, SpecPage } from '../design/prototype/spec-types'
import {
  generateRequirementsPrototypeSpec,
  getRequirementsPrototype,
  type RequirementsPrototypePreview,
  type RequirementsPrototypeSpec,
  type RequirementsSpecPage,
  type RequirementsSpecState
} from './api'
import {
  baseLabel,
  coverageLabel,
  ensureSpecSelection,
  findSpecGroup,
  findSpecPage,
  generatedAtLabel,
  groupPagesByEpic,
  rangeLabel,
  specEmptyReason,
  specEntityOfPage,
  specErrorOf,
  specMetaLabel,
  specPageTitle,
  specPageTypeLabel,
  toSpecEntity,
  toSpecPage
} from './prototype-spec-helpers.js'
import { fitScale, templateSourceLabel, warningText } from './prototype-helpers.js'
import '../design/design-skin.css'
import '../design/prototype/wireframe.css'

interface SpecPageGroup {
  key: string
  epicId: string | null
  title: string
  pages: RequirementsSpecPage[]
}

const props = defineProps<{
  appId: string
  moduleId: string
  moduleTitle?: string
  /** 文档保存/AI 应用/版本回滚后变化 → 自动刷新（父组件拼 updatedAt/version/章节 max updatedAt） */
  refreshKey?: string | number
  /** 只读原因提示（只读横幅仍由父组件渲染；这里只做补充说明） */
  docReadonlyHint?: string
}>()

const emit = defineEmits<{
  'open-doc': []
  refresh: []
}>()

const loading = ref(false)
const error = ref('')
const preview = ref<RequirementsPrototypePreview | null>(null)
const generating = ref(false)
const generateError = ref('')
const generateErrorDetail = ref('')
const groupKey = ref('')
const pageId = ref('')
const scale = ref(1)
const paperHeight = ref(560)
const canvasRef = ref<HTMLElement | null>(null)
const paperRef = ref<HTMLElement | null>(null)

let loadController: AbortController | null = null
let generateController: AbortController | null = null
let loadedModuleId = ''
let observer: ResizeObserver | null = null

const spec = computed<RequirementsPrototypeSpec | null>(() => preview.value?.spec ?? null)
const specState = computed<RequirementsSpecState | null>(() => preview.value?.specState ?? null)
const warnings = computed(() => (Array.isArray(preview.value?.warnings) ? preview.value?.warnings ?? [] : []))
const emptyReason = computed(() => specEmptyReason(preview.value))
const archivedModule = computed(() => preview.value?.module?.archived === true)
const groups = computed<SpecPageGroup[]>(() => groupPagesByEpic(spec.value, preview.value?.pageSets))
const currentGroup = computed<SpecPageGroup | null>(() => findSpecGroup(groups.value, groupKey.value) as SpecPageGroup | null)
const currentPages = computed<RequirementsSpecPage[]>(() => currentGroup.value?.pages ?? [])
const currentPageRaw = computed<RequirementsSpecPage | null>(() => findSpecPage(groups.value, groupKey.value, pageId.value) as RequirementsSpecPage | null)
const currentEntity = computed(() => (currentPageRaw.value ? specEntityOfPage(spec.value, currentPageRaw.value) : undefined))
const currentSpecEntity = computed<SpecEntity | undefined>(() => (currentEntity.value ? (toSpecEntity(currentEntity.value) as SpecEntity) : undefined))
const currentSpecPage = computed<SpecPage | undefined>(() => (currentPageRaw.value ? (toSpecPage(currentPageRaw.value) as SpecPage) : undefined))
const currentRows = computed<MockRow[]>(() => (currentSpecEntity.value ? mockRows(currentSpecEntity.value, 8) : []))

const versionLabel = computed(() => {
  const version = preview.value?.module?.docVersion
  return typeof version === 'number' && version > 0 ? `v${version}` : ''
})
const generatedLabel = computed(() => (spec.value ? generatedAtLabel(spec.value.generatedAt) : ''))

const contentWidth = computed(() => {
  const width = Number(preview.value?.template?.shell.contentWidth)
  return Number.isFinite(width) && width > 0 ? width : 1180
})
const chromeWidth = computed(() => (preview.value?.template?.shell.type === 'topbar' ? 36 : 188 + 36))

const skinStyle = computed(() => {
  const tokens = preview.value?.template?.tokens
  if (!tokens) return {}
  return {
    '--proto-primary': tokens.primary,
    '--proto-accent': tokens.accent,
    '--proto-neutral': tokens.neutral,
    '--proto-bg': tokens.background,
    '--proto-font': tokens.font,
    '--proto-radius': `${tokens.radius}px`,
    '--proto-spacing': `${tokens.spacing}px`
  }
})

const paperStyle = computed(() => ({
  width: `${contentWidth.value}px`,
  transform: `scale(${scale.value})`,
  transformOrigin: 'top left',
  borderRadius: '10px'
}))

const stageStyle = computed(() => ({
  width: `${Math.round(contentWidth.value * scale.value)}px`,
  height: `${Math.round(paperHeight.value * scale.value)}px`
}))

function measure(): void {
  const el = canvasRef.value
  const available = (el?.clientWidth ?? 0) - chromeWidth.value
  scale.value = fitScale(available, contentWidth.value, { min: 0.5, max: 1 })
  const paper = paperRef.value
  if (paper) {
    const height = paper.offsetHeight
    if (height > 0) paperHeight.value = height
  }
}

function attachObserver(): void {
  if (typeof ResizeObserver === 'undefined') return
  if (!observer) observer = new ResizeObserver(() => measure())
  observer.disconnect()
  if (canvasRef.value) observer.observe(canvasRef.value)
  if (paperRef.value) observer.observe(paperRef.value)
}

function applySelection(previous?: { groupKey?: string; pageId?: string }): void {
  const selection = ensureSpecSelection(groups.value, previous ?? { groupKey: groupKey.value, pageId: pageId.value })
  groupKey.value = selection.groupKey
  pageId.value = selection.pageId
}

function selectGroup(group: SpecPageGroup): void {
  groupKey.value = group.key
  pageId.value = group.pages[0]?.id ?? ''
}

function selectPage(page: RequirementsSpecPage): void {
  pageId.value = page.id
}

async function load(): Promise<void> {
  loadController?.abort()
  const local = new AbortController()
  loadController = local
  loading.value = true
  error.value = ''
  try {
    const next = await getRequirementsPrototype(props.appId, props.moduleId || undefined, local.signal)
    if (local.signal.aborted) return
    const previous = loadedModuleId === props.moduleId ? { groupKey: groupKey.value, pageId: pageId.value } : {}
    preview.value = next
    loadedModuleId = props.moduleId
    applySelection(previous)
    await nextTick()
    attachObserver()
    measure()
  } catch (err) {
    if (local.signal.aborted) return
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (!local.signal.aborted) loading.value = false
  }
}

async function generate(withConfirm: boolean): Promise<void> {
  if (generating.value || archivedModule.value) return
  if (withConfirm && spec.value) {
    try {
      await ElMessageBox.confirm('重新生成会覆盖当前原型参考规格（不影响需求文档/设计数据），是否继续？', '重新生成原型参考', {
        type: 'warning',
        confirmButtonText: '重新生成',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
  }
  generateController?.abort()
  const local = new AbortController()
  generateController = local
  generating.value = true
  generateError.value = ''
  generateErrorDetail.value = ''
  try {
    const result = await generateRequirementsPrototypeSpec(props.appId, props.moduleId || undefined, local.signal)
    if (local.signal.aborted) return
    if (preview.value) {
      preview.value = { ...preview.value, spec: result.spec, specState: result.specState }
    } else {
      await load()
      return
    }
    applySelection()
    await nextTick()
    attachObserver()
    measure()
  } catch (err) {
    if (local.signal.aborted) return
    const parsed = specErrorOf(err)
    generateError.value = parsed.message
    generateErrorDetail.value = parsed.detail
  } finally {
    if (!local.signal.aborted) generating.value = false
  }
}

function cancelGenerate(): void {
  generateController?.abort()
  generating.value = false
}

watch(() => props.moduleId, () => {
  generateController?.abort()
  generating.value = false
  generateError.value = ''
  generateErrorDetail.value = ''
  groupKey.value = ''
  pageId.value = ''
  loadedModuleId = ''
  preview.value = null
  void load()
})

watch(() => props.refreshKey, () => {
  void load()
})

// 画布/纸面元素切换（选中有页/无页、切页面集）后重新绑定观察并测量
watch(
  [canvasRef, paperRef],
  () => {
    attachObserver()
    void nextTick(() => measure())
  },
  { flush: 'post' }
)

onMounted(() => {
  void load()
})

onBeforeUnmount(() => {
  loadController?.abort()
  generateController?.abort()
  observer?.disconnect()
  observer = null
})
</script>

<style scoped>
.pv-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.pv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 12px;
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  background: var(--rg-surface);
}
.pv-head-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.pv-head-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.pv-chip.current {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  flex-shrink: 0;
}
.pv-module {
  font-size: 13px;
  color: var(--rg-text);
  min-width: 0;
}
.pv-module-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 10px;
  color: var(--rg-text-3);
}
.pv-template {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--rg-text-2);
  background: var(--rg-fill);
  border-radius: 999px;
  padding: 2px 8px;
  min-width: 0;
}
.pv-source {
  font-size: 9.5px;
  color: var(--rg-text-3);
  border-left: 1px solid var(--rg-border);
  padding-left: 5px;
}
.pv-version,
.pv-stats {
  font-size: 11px;
  color: var(--rg-text-3);
}
.pv-note-bar {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--rg-text-3);
  background: var(--rg-surface-2);
  border: 1px dashed var(--rg-border);
  border-radius: 8px;
  padding: 6px 10px;
}
.pv-note-readonly {
  margin-left: 8px;
  color: var(--rg-warn);
}
.pv-warnings {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pv-warning-chip {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 9px;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border: 1px solid var(--rg-warn-border);
}
.pv-stale {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border: 1px solid var(--rg-warn-border);
  border-radius: 8px;
  padding: 7px 10px;
}
.pv-gen-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border: 1px solid var(--rg-danger-soft);
  border-radius: 8px;
  padding: 7px 10px;
}
.pv-gen-error-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.pv-gen-detail {
  font-size: 10.5px;
  color: var(--rg-text-2);
  background: var(--rg-surface-2);
  border: 1px dashed var(--rg-danger-soft);
  border-radius: 8px;
  padding: 6px 10px;
}
.pv-gen-detail summary {
  cursor: pointer;
  color: var(--rg-text-2);
}
.pv-gen-detail pre {
  margin: 6px 0 0;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--rg-text-2);
  background: var(--rg-fill);
  border-radius: 6px;
  padding: 6px 8px;
}
.pv-generating-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border: 1px solid var(--rg-ai-border);
  border-radius: 8px;
  padding: 7px 10px;
}
.pv-spec-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 10.5px;
  color: var(--rg-text-3);
  padding: 0 2px;
}
.pv-spec-notes {
  font-size: 10.5px;
  color: var(--rg-text-3);
  background: var(--rg-surface-2);
  border: 1px dashed var(--rg-border);
  border-radius: 8px;
  padding: 6px 10px;
}
.pv-spec-notes summary {
  cursor: pointer;
  color: var(--rg-text-2);
}
.pv-spec-notes ul {
  margin: 6px 0 0;
  padding-left: 18px;
  line-height: 1.7;
}
.pv-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
.pv-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-height: 26px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 3px 9px;
  font-size: 11.5px;
  cursor: pointer;
}
.pv-chip-btn:hover {
  border-color: var(--rg-ai-border);
  color: var(--rg-text);
}
.pv-chip-btn.on {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  font-weight: 600;
}
.pv-chip-btn.page {
  border-radius: 999px;
}
.pv-chip-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 9.5px;
  color: var(--rg-text-3);
}
.pv-chip-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pv-chip-count {
  font-size: 9.5px;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.pv-chip-btn.on .pv-chip-count {
  background: var(--rg-surface);
  color: var(--rg-ai);
}
.pv-chip-type {
  font-size: 9.5px;
  color: var(--rg-text-3);
  border-left: 1px solid var(--rg-border);
  padding-left: 5px;
  flex-shrink: 0;
}
.pv-chip-empty {
  font-size: 11px;
  color: var(--rg-text-3);
}
.pv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 3px 10px;
  font-size: 11.5px;
  cursor: pointer;
}
.pv-btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.pv-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.pv-btn.primary {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.pv-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 260px;
  text-align: center;
  font-size: 12px;
  color: var(--rg-text-3);
  border: 1px dashed var(--rg-border);
  border-radius: 10px;
  padding: 24px;
  background: var(--rg-surface);
}
.pv-state strong {
  font-size: 13px;
  color: var(--rg-text);
}
.pv-state p {
  margin: 0;
  line-height: 1.7;
  max-width: 480px;
}
.pv-state.error {
  color: var(--rg-danger);
  border-color: var(--rg-danger-soft);
}
.pv-range {
  font-size: 11px;
  color: var(--rg-text-2);
}
.pv-range-hint {
  font-size: 11px;
  color: var(--rg-warn);
}
.pv-canvas {
  min-width: 0;
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--rg-surface-2);
  padding: 8px;
}
.pv-skin {
  min-width: 0;
}
.pv-shell {
  min-height: 0;
}
.pv-shell.is-topbar {
  min-height: 0;
}
.pv-nav {
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.pv-nav.is-active {
  cursor: default;
}
.pv-nav-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pv-topbar-brand {
  padding: 0;
  color: #0f172a;
}
.proto-topbar .pv-nav {
  width: auto;
  padding: 4px 8px;
  opacity: 0.8;
  color: #334155;
}
.proto-topbar .pv-nav.is-active {
  background: var(--rg-fill);
  color: var(--proto-primary);
  opacity: 1;
}
.pv-stage {
  position: relative;
  overflow: hidden;
}
.pv-paper {
  background: #fff;
  overflow: hidden;
}
:deep(.proto-empty) {
  font-size: 12px;
}

@media (max-width: 1024px) {
  .pv-head {
    align-items: flex-start;
  }
}
@media (max-width: 768px) {
  .pv-head {
    flex-direction: column;
  }
  .pv-head-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .pv-chip-btn {
    min-height: 30px;
  }
  .pv-btn {
    min-height: 30px;
  }
}
</style>
