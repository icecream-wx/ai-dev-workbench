<template>
  <section class="design-view" data-testid="design-view">
    <header class="toolbar">
      <div class="left">
        <button
          v-if="designBadge"
          type="button"
          class="badge clickable"
          data-testid="design-template-badge"
          :title="`打开设计模板中心：${designBadge}`"
          @click="designCenterOpen = true"
        >
          {{ designBadge }}
        </button>
        <span class="summary" data-testid="design-summary">{{ summary }}</span>
        <span :class="['sync', connectionState]">{{ syncLabel }}</span>
      </div>
      <div class="right">
        <RgButton size="sm" class="drawer-only" data-testid="design-chat-toggle" @click="toggleChat">对话</RgButton>
        <RgButton size="sm" data-testid="design-template-library" @click="designCenterOpen = true">
          模板页面库
        </RgButton>
        <RgButton
          variant="primary"
          size="sm"
          :disabled="chatBusy"
          :loading="chatBusy"
          data-testid="design-generate-btn"
          @click="runGenerate"
        >
          {{ chatBusy ? '生成中…' : '生成/更新设计' }}
        </RgButton>
        <RgButton
          size="sm"
          :disabled="!canExport || exporting"
          :loading="exporting"
          data-testid="design-reexport-btn"
          @click="runExport('manual')"
        >
          {{ exporting ? '导出中…' : '重新导出' }}
        </RgButton>
        <RgButton size="sm" :disabled="loading" data-testid="design-refresh-btn" @click="loadAll(false)">刷新</RgButton>
      </div>
    </header>

    <div v-if="warningLines.length" class="warning-strip rg-panel rg-panel--warn" data-testid="design-warning-strip">
      <div class="strip-text">
        <strong>发现 {{ warningLines.length }} 处问题</strong>
        <ul>
          <li v-for="line in warningLines.slice(0, 3)" :key="line">{{ line }}</li>
        </ul>
      </div>
      <RgButton variant="danger" size="sm" data-testid="design-fix-with-ai" @click="fixWithAi">让 AI 修</RgButton>
    </div>

    <div v-if="prototypeStale" class="stale-strip rg-panel rg-panel--warn" data-testid="design-prototype-stale">
      <span>原型图已过期：设计产物已变化，请重新导出。</span>
      <RgButton size="sm" :disabled="exporting" data-testid="design-stale-reexport" @click="runExport('manual')">
        重新导出
      </RgButton>
    </div>

    <div v-if="exportError" class="export-error rg-panel rg-panel--danger" data-testid="design-export-error">
      <span>{{ exportError }}</span>
      <RgButton
        size="sm"
        :disabled="!canExport || exporting"
        data-testid="design-export-retry"
        @click="runExport('manual')"
      >重试</RgButton>
    </div>

    <div
      ref="bodyRef"
      :class="['design-body', { narrow }]"
      :style="narrow ? undefined : { '--chat-width': `${chatWidth}px` }"
    >
      <div v-if="narrow && chatOpen" class="mask" data-testid="design-drawer-mask" @click="closeDrawers" />

      <div :class="['col', 'col-chat', { drawer: narrow, open: chatOpen }]">
        <AgentChatPanel
          ref="chatRef"
          :app-id="appId"
          view="design"
          @busy-changed="chatBusy = $event"
        />
      </div>

      <SplitHandle
        v-if="!narrow"
        test-id="design-chat-split"
        :value-now="chatWidth"
        :value-min="chatMin"
        :value-max="chatMaxAllowed"
        label="调整对话栏宽度"
        @pointerdown="onChatPointerDown"
        @keydown="onChatKeydown"
        @dblclick="onChatDoubleClick"
      />

      <main class="col col-main">
        <div v-if="loading" class="design-loading" data-testid="design-loading">
          <StatePanel
            variant="loading"
            skeleton="canvas"
            test-id="design-loading-canvas"
            title="正在读取设计产物"
            description="docs/design/entities.json + pages.json"
            compact
          />
          <StatePanel
            variant="loading"
            skeleton="list"
            :loading-lines="4"
            test-id="design-loading-fields"
            title="正在加载实体与字段"
            compact
          />
        </div>
        <StatePanel
          v-else-if="error"
          variant="error"
          test-id="design-error"
          title="设计产物读取失败"
          description="请检查工作区或后端服务，稍后重试。"
          class="main-state"
        >
          <template #actions>
            <RgButton size="sm" @click="loadAll(false)">重试</RgButton>
          </template>
          <template #details>
            <pre>{{ error }}</pre>
          </template>
        </StatePanel>
        <StatePanel
          v-else-if="!hasDesign"
          variant="empty"
          test-id="design-empty"
          :icon="Brush"
          title="还没有设计产物"
          class="main-state"
        >
          <template #default>
            agent 会按需求一次生成三份设计文件：<code>docs/design/entities.json</code>（实体/关系）、
            <code>docs/design/pages.json</code>（页面集 = Epic / 页面契约）与
            <code>docs/design/api-design.md</code>（接口设计）。生成后这里会渲染全局 ER、模板风格原型与接口设计。
          </template>
          <template #examples>
            <ul class="examples">
              <li v-for="(example, index) in EXAMPLE_PROMPTS" :key="example">
                <button
                  type="button"
                  class="link"
                  :data-testid="`design-example-${index + 1}`"
                  @click="fillComposer(example)"
                >
                  {{ example }}
                </button>
              </li>
            </ul>
          </template>
          <template #actions>
            <RgButton
              variant="primary"
              :disabled="chatBusy"
              :loading="chatBusy"
              data-testid="design-empty-generate"
              @click="runGenerate"
            >
              生成设计
            </RgButton>          </template>
        </StatePanel>
        <template v-else>
          <div class="main-head">
            <div class="rg-tabs" role="tablist" aria-label="设计视图">
              <button
                type="button"
                :class="['rg-tab', { 'rg-tab--active': tab === 'er' }]"
                role="tab"
                :aria-selected="tab === 'er'"
                data-testid="design-tab-er"
                @click="tab = 'er'"
              >
                实体关系
              </button>
              <button
                type="button"
                :class="['rg-tab', { 'rg-tab--active': tab === 'prototype' }]"
                role="tab"
                :aria-selected="tab === 'prototype'"
                data-testid="design-tab-prototype"
                @click="tab = 'prototype'"
              >
                页面集
              </button>
              <button
                type="button"
                :class="['rg-tab', { 'rg-tab--active': tab === 'api' }]"
                role="tab"
                :aria-selected="tab === 'api'"
                data-testid="design-tab-api"
                @click="tab = 'api'"
              >
                接口设计
              </button>
            </div>
            <div class="meta">
              <code data-testid="design-file">{{ currentSet ? 'docs/design/entities.json + pages.json' : 'docs/design/pages.json' }}</code>
              <span data-testid="design-refreshed-at">刷新于 {{ refreshedLabel }}</span>
              <span>{{ entities.length }} 实体 · {{ pageSets.length }} 页面集 · {{ adapted?.pages.length ?? 0 }} 页面 · {{ apiInterfaceCount }} 接口</span>
              <span data-testid="design-brief-status">{{ briefStatus }}</span>
              <span data-testid="design-tokens-status">{{ tokensStatus }}</span>
              <span v-if="prototypeStatus" data-testid="design-prototype-status">{{ prototypeStatus }}</span>
            </div>
          </div>

          <div class="main-panel">
            <DesignErPanel
              v-if="tab === 'er'"
              :entities="adapted?.entities ?? []"
              :relations="adapted?.relations ?? []"
            />
            <div v-else-if="tab === 'prototype'" class="prototype-pane">
              <div
                v-if="pageSets.length"
                class="rg-tabs pageset-tabs"
                data-testid="design-pageset-tabs"
                role="tablist"
                aria-label="页面集"
              >
                <button
                  v-for="set in pageSets"
                  :key="set.id"
                  type="button"
                  :class="['rg-tab', { 'rg-tab--active': set.id === selectedPageSetId }]"
                  role="tab"
                  :aria-selected="set.id === selectedPageSetId"
                  :data-testid="`design-pageset-${set.id}`"
                  @click="selectPageSet(set.id)"
                >
                  {{ set.epic || set.id }} {{ set.title }}
                  <span class="tab-count">{{ set.pageCount }}</span>
                </button>
              </div>
              <DesignPrototypePanel
                v-if="prototypeSkin"
                :pages="visiblePages"
                :page-set="currentSet ?? emptyPageSet"
                :entities="adapted?.entities ?? []"
                :skin="prototypeSkin"
                :app-name="appName"
                :app-id="props.appId"
                :application-type="designSystem?.applicationType?.id"
                :style-id="designSystem?.style?.id"
                :design-hash="artifacts?.designHash ?? ''"
                :design-label="designBadge"
                :template-pages="designSystem?.pages ?? []"
                :exporting="exporting"
                :overview-exporting="overviewExporting"
                :overview-progress="overviewProgress"
                :overview-error="overviewError"
                @export="runExport('manual')"
                @export-overview="runOverviewExport"
              />
              <StatePanel
                v-else
                variant="empty"
                test-id="design-no-prototype-template"
                title="无法渲染原型"
                description="设计系统未解析出视觉风格，暂时无法渲染原型。请重新选择设计模板后重试。"
                compact
              />
            </div>
            <ApiDesignPanel
              v-else-if="tab === 'api'"
              :api-design="artifacts?.apiDesign ?? null"
              :busy="chatBusy"
              :fix-state="apiFixState"
              :fix-summary="apiFixSummary"
              @generate="runApiDesign"
              @fix="fixApiWithAi"
            />
          </div>
        </template>
      </main>
    </div>

    <div class="export-host" data-testid="design-export-host" aria-hidden="true">
      <PrototypeCanvas
        v-if="exportPage && prototypeSkin && currentSet"
        ref="exportCanvasRef"
        :page="exportPage"
        :page-set="currentSet"
        :page-sets="[currentSet]"
        :entities="adapted?.entities ?? []"
        :skin="prototypeSkin"
        :app-name="appName"
        :zoom="100"
        capturing
      />
    </div>

    <DesignTemplateCenter v-model="designCenterOpen" mode="browse" :selection="designCenterSelection" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Brush } from '@element-plus/icons-vue'
import AgentChatPanel from './AgentChatPanel.vue'
import DesignErPanel from './DesignErPanel.vue'
import DesignPrototypePanel from './DesignPrototypePanel.vue'
import ApiDesignPanel from './ApiDesignPanel.vue'
import DesignTemplateCenter from './DesignTemplateCenter.vue'
import StatePanel from '../shared/StatePanel.vue'
import RgButton from '../shared/RgButton.vue'
import SplitHandle from '../shared/SplitHandle.vue'
import { useChatResize } from '../shared/useChatResize'
import PrototypeCanvas from '../design/PrototypeCanvas.vue'
import { captureElementPng } from '../design/snapshot'
import { captureTemplatePage, shouldTemplateCapture } from '../design/template-capture'
import { composeOverviewPng, downloadDataUrl, overviewFileName } from '../design/overview-export'
import {
  connectArtifactEvents,
  getApp,
  getArtifacts,
  savePrototypePackage,
  type AppInfo,
  type ArtifactsResponse
} from './api'
import {
  buildPrototypePayload,
  isPrototypeStale,
  needsPrototypeExport,
  prototypeSummary
} from '../design/design-export.js'
import { adaptDesign, designLikeOf, designSummaryOf, designWarningsOf } from '../design/design-adapter.js'
import { skinFromStyle } from '../design/prototype/skin.js'
import type { DesignPageRender, DesignPageSet, PrototypeSkin } from '../design/types'
import { composerFixText, mergeArtifactLines } from './requirements-helpers.js'
import { apiDesignFixSummary, apiDesignSummary } from './api-design-helpers.js'
import { designTemplateLabel } from './design-template-helpers.js'
import {
  getAppDesignSystem,
  type AppDesignSystem,
  type AppDesignSystemSelection
} from '../shared/design-system-api'

const props = defineProps<{ appId: string }>()

const EXAMPLE_PROMPTS = [
  '按当前需求一次生成实体/关系、页面集与接口设计（entities/pages/api-design）。',
  '给「商品管理」Epic 补一个「编辑」表单页，并绑定主实体；同步补接口。',
  '检查需求 Epic 与页面集/接口设计是否一致，列出具体差异。'
]

const EMPTY_PAGE_SET: DesignPageSet = { id: 'empty', title: '页面集', pages: [] }

const loading = ref(true)
const error = ref('')
const artifacts = ref<ArtifactsResponse | null>(null)
const app = ref<AppInfo | null>(null)
const designSystem = ref<AppDesignSystem | null>(null)
const designCenterOpen = ref(false)
const selectedPageSetId = ref<string | null>(null)
const tab = ref<'er' | 'prototype' | 'api'>('er')
const connectionState = ref<'connecting' | 'open' | 'error' | 'closed'>('closed')
const narrow = ref(false)
const chatOpen = ref(false)
const chatBusy = ref(false)
const refreshedAt = ref<string>('')
const chatRef = ref<InstanceType<typeof AgentChatPanel> | null>(null)
const bodyRef = ref<HTMLElement | null>(null)
const exporting = ref(false)
const overviewExporting = ref(false)
const overviewProgress = ref<{ current: number; total: number }>({ current: 0, total: 0 })
const overviewError = ref('')
const exportError = ref('')
const exportPage = ref<DesignPageRender | null>(null)
const exportCanvasRef = ref<InstanceType<typeof PrototypeCanvas> | null>(null)
/** B7 接口设计「让 AI 修」状态（running/done + 摘要） */
const apiFixState = ref<'idle' | 'running' | 'done'>('idle')
const apiFixSummary = ref('')
const apiFixBefore = ref<{ errorCount: number; warningCount: number }>({ errorCount: 0, warningCount: 0 })

let connection: ReturnType<typeof connectArtifactEvents> | null = null
let reloadTimer: ReturnType<typeof setTimeout> | null = null
let exportTimer: ReturnType<typeof setTimeout> | null = null
let lastFailedKey = ''

const {
  chatWidth,
  minWidth: chatMin,
  maxAllowed: chatMaxAllowed,
  onPointerDown: onChatPointerDown,
  onKeydown: onChatKeydown,
  onDoubleClick: onChatDoubleClick
} = useChatResize({
  containerRef: bodyRef,
  storageKey: 'rg.chat-width.design',
  otherMinWidth: 520 + 6,
  defaultWidth: 380
})

const adapted = computed(() => (artifacts.value ? adaptDesign(designLikeOf(artifacts.value)) : null))
const entities = computed(() => adapted.value?.entities ?? [])
const pageSets = computed(() =>
  (adapted.value?.pageSets ?? []).map(set => {
    const pages = adapted.value?.pages.filter(page => page.pageSetId === set.id) ?? []
    const entityIds = [...new Set(pages.map(page => page.entityId).filter(Boolean))] as string[]
    const raw = artifacts.value?.pages?.pageSets?.find(item => (item as { id?: string })?.id === set.id) as
      | { primaryEntity?: string }
      | undefined
    return {
      id: set.id,
      epic: set.epic,
      title: set.title,
      pageCount: pages.length,
      entityIds,
      primaryEntity: raw?.primaryEntity
    }
  })
)
const hasDesign = computed(() => Boolean(designSummaryOf(artifacts.value).hasDesign))
const currentSet = computed<DesignPageSet | null>(
  () => adapted.value?.pageSets.find(set => set.id === selectedPageSetId.value) ?? null
)
const currentSetInfo = computed(() => pageSets.value.find(set => set.id === selectedPageSetId.value) ?? null)
const visiblePages = computed(() => {
  const all = adapted.value?.pages ?? []
  if (!selectedPageSetId.value) return all
  return all.filter(page => page.pageSetId === selectedPageSetId.value)
})
const appName = computed(() => app.value?.name ?? props.appId)

const prototypeSkin = computed<PrototypeSkin | null>(() => {
  const style = designSystem.value?.style
  return style ? (skinFromStyle(style) as PrototypeSkin) : null
})
const designBadge = computed(() => designTemplateLabel(designSystem.value))
const designCenterSelection = computed<AppDesignSystemSelection>(() => {
  const design = designSystem.value
  if (!design?.resolved) return {}
  return { pack: design.resolved.pack, applicationType: design.resolved.applicationType, style: design.resolved.style }
})

const currentDesignHash = computed(() => artifacts.value?.designHash ?? '')
const prototypeStale = computed(() => isPrototypeStale(artifacts.value?.prototypes, currentDesignHash.value))
const canExport = computed(
  () =>
    Boolean(
      adapted.value?.pages.length &&
        prototypeSkin.value &&
        currentDesignHash.value &&
        !(artifacts.value?.errors?.length ?? 0)
    )
)
const exportKey = computed(() => `${currentDesignHash.value}:${prototypeSkin.value?.id ?? ''}`)
const briefStatus = computed(() => (artifacts.value?.brief?.exists ? 'brief 已生成' : 'brief 未生成'))
const tokensStatus = computed(() => (artifacts.value?.tokens?.exists ? 'tokens 已生成' : 'tokens 未生成'))
const prototypeStatus = computed(() => prototypeSummary(artifacts.value?.prototypes))
const apiInterfaceCount = computed(() => (artifacts.value?.apiDesign?.exists ? artifacts.value.apiDesign.interfaces.length : 0))

const warningLines = computed(() => {
  const value = artifacts.value
  if (!value) return []
  return [
    ...new Set(
      mergeArtifactLines(
        value.errors ?? [],
        [...designWarningsOf(value), ...(value.requirement?.warnings ?? [])],
        '设计产物'
      )
    )
  ]
})

const summary = computed(() => {
  const status = designSummaryOf(artifacts.value)
  const issueText = (artifacts.value?.errors?.length ?? 0) ? ` · ${artifacts.value!.errors.length} 处待处理` : ''
  if (!status.hasDesign) return `未生成设计${issueText}`
  const apiText = apiInterfaceCount.value ? ` · ${apiInterfaceCount.value} 接口` : ''
  return `实体 ${status.entityCount} · 页面集 ${status.pageSetCount} · 页面 ${status.pageCount}${apiText}${issueText}`
})

const syncLabel = computed(
  () => ({ connecting: '同步中…', open: '实时同步', error: '事件断开', closed: '未连接' })[connectionState.value]
)
const refreshedLabel = computed(() => refreshedAt.value || '—')
const emptyPageSet = EMPTY_PAGE_SET

function selectPageSet(id: string): void {
  selectedPageSetId.value = id
}

async function loadAll(silent: boolean): Promise<void> {
  if (!silent) loading.value = true
  error.value = ''
  try {
    const [nextApp, nextArtifacts, nextDesignSystem] = await Promise.all([
      getApp(props.appId),
      getArtifacts(props.appId),
      getAppDesignSystem(props.appId).catch(() => null)
    ])
    app.value = nextApp
    artifacts.value = nextArtifacts
    designSystem.value = nextDesignSystem
    refreshedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    const nextSets = adaptDesign(designLikeOf(nextArtifacts)).pageSets
    if (selectedPageSetId.value && !nextSets.some(set => set.id === selectedPageSetId.value)) {
      selectedPageSetId.value = nextSets[0]?.id ?? null
    }
    if (!selectedPageSetId.value) selectedPageSetId.value = nextSets[0]?.id ?? null
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

function scheduleReload(): void {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => {
    reloadTimer = null
    void loadAll(true)
  }, 350)
}

function exportPaperElement(): HTMLElement | null {
  const exposed = exportCanvasRef.value as unknown as {
    paperRef?: HTMLElement | { value?: HTMLElement }
  } | null
  const target = exposed?.paperRef
  if (!target) return null
  return 'value' in target ? (target.value ?? null) : (target as HTMLElement)
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

function scheduleAutoExport(): void {
  if (exportTimer) {
    clearTimeout(exportTimer)
    exportTimer = null
  }
  if (exporting.value || overviewExporting.value || !canExport.value) return
  if (document.visibilityState !== 'visible') return
  if (!needsPrototypeExport(artifacts.value?.prototypes, currentDesignHash.value)) return
  if (lastFailedKey === exportKey.value) return
  exportTimer = setTimeout(() => {
    exportTimer = null
    void runExport('auto')
  }, 1000)
}

/** 单页截图：模板截图优先；失败/无显式契约回退隐藏 PrototypeCanvas 线框 */
async function capturePageForExport(
  page: DesignPageRender,
  scale = 2
): Promise<{ dataUrl: string; fallback: boolean }> {
  const applicationType = designSystem.value?.applicationType?.id ?? ''
  const styleId = designSystem.value?.style?.id ?? ''
  const templatePages = designSystem.value?.pages ?? []
  const designHash = currentDesignHash.value
  let shot: { dataUrl: string } | null = null
  let fallback = false
  if (applicationType && styleId && shouldTemplateCapture(page, templatePages)) {
    try {
      shot = await captureTemplatePage({
        appId: props.appId,
        pageId: page.id,
        applicationType,
        styleId,
        designHash
      })
    } catch (error) {
      fallback = true
      console.warn(
        `[design-export] 模板截图失败，回退线框：${page.id}：${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  if (!shot) {
    fallback = true
    exportPage.value = page
    await nextTick()
    await nextFrame()
    const element = exportPaperElement()
    if (!element) throw new Error('原型尚未渲染，无法导出 PNG')
    shot = await captureElementPng(element, scale)
  }
  return { dataUrl: shot.dataUrl, fallback }
}

/** 逐页离屏渲染 → 批量上传 PNG（应用级 manifest）；失败不阻塞视图 */
async function runExport(mode: 'auto' | 'manual'): Promise<void> {
  if (exporting.value || overviewExporting.value) return
  if (mode === 'manual') lastFailedKey = ''
  exporting.value = true
  exportError.value = ''
  try {
    await loadAll(true)
    const adaptedValue = adapted.value
    const skin = prototypeSkin.value
    const designHash = currentDesignHash.value
    if (!adaptedValue || !skin || !designHash || !adaptedValue.pages.length) {
      if (mode === 'manual') ElMessage.warning('当前没有可导出的设计或视觉风格')
      return
    }
    if (artifacts.value?.errors?.length) {
      exportError.value = '设计产物有错误，修正后再导出原型'
      return
    }
    const pages: Array<{ id: string; pageSet?: string; dataUrl: string }> = []
    const fallbackPages: string[] = []
    const styleId = designSystem.value?.style?.id ?? ''
    for (const page of adaptedValue.pages) {
      const captured = await capturePageForExport(page, 2)
      if (captured.fallback) fallbackPages.push(page.id)
      pages.push({ id: page.id, pageSet: page.pageSetId, dataUrl: captured.dataUrl })
    }
    const latest = await getArtifacts(props.appId)
    if (latest.designHash !== designHash) return
    const payload = buildPrototypePayload({ designHash, styleId, pages })
    if (!payload) throw new Error('没有可导出的原型页面')
    await savePrototypePackage(props.appId, payload)
    lastFailedKey = ''
    await loadAll(true)
    if (fallbackPages.length) {
      console.warn(`[design-export] 以下页面为线框兜底：${fallbackPages.join('、')}`)
      if (mode === 'manual') {
        ElMessage.warning(`${fallbackPages.length} 页模板截图失败，已回退线框：${fallbackPages.join('、')}`)
      }
    }
    if (mode === 'manual') ElMessage.success(`已导出原型 ${payload.pages.length} 页`)
  } catch (error) {
    lastFailedKey = exportKey.value
    exportError.value = `原型导出失败：${error instanceof Error ? error.message : String(error)}`
    if (mode === 'manual') ElMessage.error(exportError.value)
  } finally {
    exporting.value = false
    exportPage.value = null
    scheduleAutoExport()
  }
}

/** 页面集总览导出：逐页截图（scale 1；失败线框）→ canvas 2 列拼图 → 下载（不写 prototypes） */
async function runOverviewExport(): Promise<void> {
  if (overviewExporting.value || exporting.value) return
  const set = currentSet.value
  const pages = visiblePages.value.slice()
  if (!set || !pages.length) {
    overviewError.value = '当前页面集没有可导出的页面'
    return
  }
  overviewExporting.value = true
  overviewError.value = ''
  overviewProgress.value = { current: 0, total: pages.length }
  const exportedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  try {
    const items = []
    for (const page of pages) {
      overviewProgress.value = { current: overviewProgress.value.current + 1, total: pages.length }
      const base = {
        id: page.id,
        title: page.title,
        type: page.type,
        ...(page.recipe ? { recipe: page.recipe } : {}),
        pageSet: page.pageSetId
      }
      try {
        const captured = await capturePageForExport(page, 1)
        items.push({ ...base, dataUrl: captured.dataUrl, fallback: captured.fallback })
      } catch (error) {
        items.push({
          ...base,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    const dataUrl = await composeOverviewPng({
      title: appName.value,
      epic: set.epic,
      pageSetId: set.id,
      pages: items,
      exportedAt
    })
    const filename = overviewFileName(set.id)
    if (!downloadDataUrl(dataUrl, filename)) throw new Error('浏览器未触发下载')
    ElMessage.success(`已导出页面集总览：${filename}`)
  } catch (error) {
    overviewError.value = `总览导出失败：${error instanceof Error ? error.message : String(error)}`
    ElMessage.error(overviewError.value)
  } finally {
    overviewExporting.value = false
    exportPage.value = null
    scheduleAutoExport()
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') scheduleAutoExport()
}

watch(
  exportKey,
  (next, previous) => {
    if (next !== previous) lastFailedKey = ''
    scheduleAutoExport()
  },
  { immediate: true }
)

function subscribe(): void {
  connection?.close()
  connection = connectArtifactEvents(
    props.appId,
    event => {
      if (event.type === 'artifacts-changed') scheduleReload()
    },
    state => {
      connectionState.value = state
    }
  )
}

async function runGenerate(): Promise<void> {
  const ok = await chatRef.value?.runCommand('generate-design')
  if (!ok) ElMessage.warning('命令未发出（可能正在生成）')
}

async function runApiDesign(): Promise<void> {
  apiFixState.value = 'idle'
  apiFixSummary.value = ''
  const ok = await chatRef.value?.runCommand('generate-api-design')
  if (!ok) ElMessage.warning('命令未发出（可能正在生成）')
}

function apiIssueCounts(): { errorCount: number; warningCount: number } {
  const summary = apiDesignSummary(artifacts.value?.apiDesign ?? null)
  return { errorCount: summary.errorCount, warningCount: summary.warningCount }
}

/** B7：接口设计「让 AI 修」一键填入并发送，完成后按实际校验结果显示剩余警告 */
async function fixApiWithAi(text: string): Promise<void> {
  if (chatBusy.value) {
    ElMessage.warning('当前会话运行中，请稍后再试')
    return
  }
  apiFixBefore.value = apiIssueCounts()
  if (narrow.value) chatOpen.value = true
  clearApiFixTimer()
  apiFixState.value = 'running'
  apiFixSummary.value = 'AI 正在修复接口设计…'
  const ok = await chatRef.value?.sendComposer(text)
  if (!ok) {
    clearApiFixTimer()
    apiFixState.value = 'idle'
    apiFixSummary.value = ''
    ElMessage.warning('接口修复未发出（可能会话运行中或只读）')
  }
}

function fillComposer(text: string): void {
  if (narrow.value) chatOpen.value = true
  chatRef.value?.setComposer(text)
}

function fixWithAi(): void {
  fillComposer(composerFixText(warningLines.value))
}

function toggleChat(): void {
  chatOpen.value = !chatOpen.value
}

function closeDrawers(): void {
  chatOpen.value = false
}

function syncNarrow(): void {
  const next = window.innerWidth <= 1024
  if (next === narrow.value) return
  narrow.value = next
  closeDrawers()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeDrawers()
}

/** B7：接口修复完成判定（避免“发送 ack”把运行态误判为结束） */
let apiFixTimer: ReturnType<typeof setTimeout> | null = null

function clearApiFixTimer(): void {
  if (apiFixTimer) {
    clearTimeout(apiFixTimer)
    apiFixTimer = null
  }
}

async function finalizeApiFix(): Promise<void> {
  if (chatBusy.value || apiFixState.value !== 'running') return
  try {
    await loadAll(true)
    const after = apiIssueCounts()
    apiFixState.value = 'done'
    apiFixSummary.value = apiDesignFixSummary(apiFixBefore.value, after)
    ElMessage.info(apiFixSummary.value)
  } catch {
    apiFixState.value = 'done'
    apiFixSummary.value = '修复结束，请点「刷新」查看最新校验结果'
  }
}

// B7：chatBusy true → false 后延迟确认；若又回到运行中则不结束
watch(chatBusy, (busy, wasBusy) => {
  if (!wasBusy || busy || apiFixState.value !== 'running') return
  clearApiFixTimer()
  apiFixTimer = setTimeout(() => {
    apiFixTimer = null
    void finalizeApiFix()
  }, 400)
})

// 切换 Tab 时重置修复状态，避免旧状态常驻
watch(tab, () => {
  clearApiFixTimer()
  apiFixState.value = 'idle'
  apiFixSummary.value = ''
})

onMounted(async () => {
  syncNarrow()
  window.addEventListener('resize', syncNarrow)
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('visibilitychange', onVisibilityChange)
  await loadAll(false)
  subscribe()
})

onUnmounted(() => {
  connection?.close()
  connection = null
  if (reloadTimer) clearTimeout(reloadTimer)
  if (exportTimer) clearTimeout(exportTimer)
  exportTimer = null
  clearApiFixTimer()
  window.removeEventListener('resize', syncNarrow)
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped>
.design-view {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--rg-bg);
  color: var(--rg-text);
  overflow: hidden;
}
.toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 16px;
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
}
.left,
.right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.badge {
  font-size: 11.5px;
  border-radius: 999px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  padding: 2px 8px;
}
.badge.clickable {
  border: 1px solid var(--rg-border);
  font-family: inherit;
  cursor: pointer;
}
.badge.clickable:hover {
  border-color: var(--rg-ai);
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
}
.summary {
  font-size: 12px;
  font-weight: 600;
  color: var(--rg-text-2);
}
.sync {
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.sync.open {
  color: var(--rg-ok);
}
.sync.error {
  color: var(--rg-danger);
}
.warning-strip {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin: 10px 16px 0;
  padding: 12px 14px;
  color: var(--rg-warn);
  font-size: 12.5px;
  border-radius: 12px;
}
.strip-text ul {
  margin: 4px 0 0;
  padding-left: 16px;
  line-height: 1.6;
}
.strip-text li {
  word-break: break-word;
}
.stale-strip,
.export-error {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 10px 16px 0;
  padding: 12px 14px;
  font-size: 12px;
  border-radius: 12px;
}
.stale-strip {
  color: var(--rg-warn);
}
.export-error {
  color: var(--rg-danger);
}
.export-host {
  position: fixed;
  top: -20000px;
  left: 0;
  width: 1400px;
  z-index: -1;
  pointer-events: none;
}
.design-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--chat-width, 380px) 6px minmax(0, 1fr);
  position: relative;
}
.col {
  min-width: 0;
  min-height: 0;
}
.col-chat {
  overflow: hidden;
  background: var(--rg-surface);
}
.col-main {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--rg-surface);
  overflow: hidden;
}
.main-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 9px 16px;
  border-bottom: 1px solid var(--rg-border);
}
.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.meta code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  word-break: break-all;
}
.main-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 12px 16px 16px;
  background: var(--rg-bg);
  display: flex;
  flex-direction: column;
}
.prototype-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pageset-tabs {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: thin;
}
.pageset-tabs::-webkit-scrollbar {
  height: 6px;
}
.pageset-tabs .rg-tab {
  flex-shrink: 0;
  white-space: nowrap;
}
.tab-count {
  margin-left: 6px;
  font-size: 10.5px;
  color: var(--rg-text-3);
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 0 6px;
}
.prototype-pane :deep(.proto-panel) {
  flex: 1;
  min-height: 0;
}
.main-panel > .state-panel {
  max-width: 640px;
  margin: 24px auto;
}
.design-loading {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--rg-space-5);
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  align-content: start;
  gap: var(--rg-space-4);
}
.main-state {
  max-width: 640px;
  margin: 36px auto;
}
.examples {
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.link {
  border: 1px dashed var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 8px 11px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  width: 100%;
}
.link:hover {
  border-color: var(--rg-ai);
  color: var(--rg-ai);
}
.muted {
  font-size: 12px;
  color: var(--rg-text-3);
  line-height: 1.7;
  padding: 2px 0;
  margin: 0;
}
.drawer-only {
  display: none;
}
.mask {
  display: none;
}
@media (max-width: 1280px) {
  .design-body {
    grid-template-columns: var(--chat-width, 380px) 6px minmax(0, 1fr);
  }
}
@media (max-width: 1024px) {
  .drawer-only {
    display: inline-flex;
  }
  .design-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .col-chat {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(400px, 90vw);
    z-index: 20;
    box-shadow: var(--rg-shadow-2);
    transition: transform 0.18s ease;
    background: var(--rg-surface);
    transform: translateX(-105%);
  }
  .col-chat.open {
    transform: translateX(0);
  }
  .mask {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 15;
    background: rgba(15, 23, 42, 0.32);
  }
  .col-main {
    height: 100%;
  }
  .design-loading {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--rg-space-4);
  }
}
</style>
