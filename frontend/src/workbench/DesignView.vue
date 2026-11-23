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
        <RgButton size="sm" class="drawer-only" data-testid="design-outline-toggle" @click="toggleOutline">模块</RgButton>
        <RgButton size="sm" class="drawer-only" data-testid="design-chat-toggle" @click="toggleChat">对话</RgButton>
        <RgButton size="sm" data-testid="design-template-library" @click="designCenterOpen = true">
          模板页面库
        </RgButton>
        <RgButton
          variant="primary"
          size="sm"
          :disabled="!selectedModule || chatBusy"
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
      <span>原型图已过期：design.json 已变化，请重新导出。</span>
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

    <div :class="['design-body', { narrow }]">
      <div v-if="narrow && (outlineOpen || chatOpen)" class="mask" data-testid="design-drawer-mask" @click="closeDrawers" />

      <aside :class="['col', 'col-modules', { drawer: narrow, open: outlineOpen }]" data-testid="design-module-list">
        <header class="modules-head">
          <strong>模块</strong>
          <span class="count">{{ entries.length }}</span>
        </header>
        <StatePanel
          v-if="loading"
          variant="loading"
          skeleton="list"
          :loading-lines="3"
          test-id="design-module-loading"
          title="正在加载模块"
          class="module-state"
          compact
        />
        <p v-else-if="!entries.length" class="muted">还没有需求模块。先到需求视图新建模块。</p>
        <ul v-else class="modules">
          <li
            v-for="entry in entries"
            :key="entry.key"
            :class="['module', { on: entry.key === selectedKey }]"
            :data-testid="`design-module-${entry.key}`"
            role="button"
            tabindex="0"
            @click="selectModule(entry.key)"
            @keydown.enter="selectModule(entry.key)"
          >
            <div class="module-top">
              <code>{{ entry.key }}</code>
              <span v-if="entry.orphan" class="badge warn" data-testid="design-orphan-badge">缺需求模块</span>
              <span v-if="designStatus(entry.key).errorCount" class="dot error" />
            </div>
            <div class="module-title">{{ entry.title }}</div>
            <div class="module-meta">
              <span v-if="designStatus(entry.key).hasDesign">
                有设计 {{ designStatus(entry.key).entityCount }} 实体 / {{ designStatus(entry.key).pageCount }} 页面
              </span>
              <span v-else>未生成</span>
              <span v-if="designStatus(entry.key).errorCount" class="badge error">
                {{ designStatus(entry.key).errorCount }} 错
              </span>
            </div>
          </li>
        </ul>
      </aside>

      <main class="col col-main">
        <div v-if="loading" class="design-loading" data-testid="design-loading">
          <StatePanel
            variant="loading"
            skeleton="canvas"
            test-id="design-loading-canvas"
            title="正在读取设计产物"
            description="docs/design/<MOD>/design.json"
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
          v-else-if="!entries.length"
          variant="empty"
          test-id="design-no-modules"
          title="先创建需求模块"
          :icon="Brush"
          class="main-state"
        >
          <template #default>
            设计以需求模块为单位：<code>docs/design/&lt;MOD&gt;/design.json</code>。先去需求视图新建模块并确认目标。
          </template>
          <template #actions>
            <RgButton variant="primary" data-testid="design-go-requirements" @click="goRequirements">去需求视图</RgButton>
          </template>
        </StatePanel>
        <StatePanel
          v-else-if="!adapted"
          variant="empty"
          test-id="design-empty"
          :icon="Brush"
          :title="`${selectedEntry?.title || selectedKey} · 还没有设计`"
          class="main-state"
        >
          <template #default>
            agent 会按需求生成 <code>docs/design/{{ selectedKey }}/design.json</code>（实体 / 关系 / 页面）。
            生成后这里会渲染 ER 图与原型，也可以直接在对话里描述要改什么。
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
            </RgButton>
          </template>
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
                ER 图
              </button>
              <button
                type="button"
                :class="['rg-tab', { 'rg-tab--active': tab === 'prototype' }]"
                role="tab"
                :aria-selected="tab === 'prototype'"
                data-testid="design-tab-prototype"
                @click="tab = 'prototype'"
              >
                原型
              </button>
            </div>
            <div class="meta">
              <span v-if="selectedEntry?.orphan" class="badge warn" data-testid="design-orphan-note">缺需求模块 · 只读</span>
              <code data-testid="design-file">{{ adapted.file || `docs/design/${adapted.module}/design.json` }}</code>
              <span data-testid="design-refreshed-at">刷新于 {{ refreshedLabel }}</span>
              <span>{{ adapted.entities.length }} 实体 · {{ adapted.pages.length }} 页面</span>
              <span data-testid="design-brief-status">{{ briefStatus }}</span>
              <span data-testid="design-tokens-status">{{ tokensStatus }}</span>
              <span v-if="prototypeStatus" data-testid="design-prototype-status">{{ prototypeStatus }}</span>
            </div>
          </div>

          <div class="main-panel">
            <DesignErPanel v-if="tab === 'er'" :entities="adapted.entities" :relations="adapted.relations" />
            <DesignPrototypePanel
              v-else-if="prototypeSkin"
              :pages="adapted.pages"
              :page-set="adapted.pageSet"
              :entities="adapted.entities"
              :skin="prototypeSkin"
              :app-name="appName"
              :app-id="props.appId"
              :module-key="adapted.module"
              :application-type="designSystem?.applicationType?.id"
              :style-id="designSystem?.style?.id"
              :design-hash="currentDesignHash"
              :design-label="designBadge"
              :template-pages="designSystem?.pages ?? []"
              :exporting="exporting"
              @export="runExport('manual')"
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
        </template>
      </main>

      <div :class="['col', 'col-chat', { drawer: narrow, open: chatOpen }]">
        <AgentChatPanel
          ref="chatRef"
          :app-id="appId"
          view="design"
          :module-key="selectedKey"
          @busy-changed="chatBusy = $event"
        />
      </div>
    </div>

    <div class="export-host" data-testid="design-export-host" aria-hidden="true">
      <PrototypeCanvas
        v-if="exportPage && prototypeSkin && adapted"
        ref="exportCanvasRef"
        :page="exportPage"
        :page-set="adapted.pageSet"
        :page-sets="[adapted.pageSet]"
        :entities="adapted.entities"
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
import DesignTemplateCenter from './DesignTemplateCenter.vue'
import StatePanel from '../shared/StatePanel.vue'
import RgButton from '../shared/RgButton.vue'
import PrototypeCanvas from '../design/PrototypeCanvas.vue'
import { captureElementPng } from '../design/snapshot'
import { captureTemplatePage, shouldTemplateCapture } from '../design/template-capture'
import {
  connectArtifactEvents,
  getApp,
  getArtifacts,
  savePrototypePackage,
  type AppInfo,
  type ArtifactsResponse,
  type DesignArtifact
} from './api'
import {
  buildPrototypePayload,
  designHashOf,
  isPrototypeStale,
  needsPrototypeExport,
  prototypeSummary
} from '../design/design-export.js'
import {
  adaptDesign,
  designSummaryOf,
  designWarningsOf,
  mergeModuleEntries
} from '../design/design-adapter.js'
import { skinFromStyle } from '../design/prototype/skin.js'
import type { DesignPageRender, PrototypeSkin } from '../design/types'
import { composerFixText, mergeArtifactLines, sortModules } from './requirements-helpers.js'
import { designTemplateLabel } from './design-template-helpers.js'
import {
  getAppDesignSystem,
  type AppDesignSystem,
  type AppDesignSystemSelection
} from '../shared/design-system-api'

const props = defineProps<{ appId: string }>()

const EXAMPLE_PROMPTS = [
  '按当前需求生成实体、关系与页面（列表/表单/详情）。',
  '给当前模块补一个「编辑」表单页，并绑定主实体。',
  '检查需求与设计是否一致，列出具体差异。'
]

const loading = ref(true)
const error = ref('')
const artifacts = ref<ArtifactsResponse | null>(null)
const app = ref<AppInfo | null>(null)
const designSystem = ref<AppDesignSystem | null>(null)
const designCenterOpen = ref(false)
const selectedKey = ref<string | null>(null)
const tab = ref<'er' | 'prototype'>('er')
const connectionState = ref<'connecting' | 'open' | 'error' | 'closed'>('closed')
const narrow = ref(false)
const outlineOpen = ref(false)
const chatOpen = ref(false)
const chatBusy = ref(false)
const refreshedAt = ref<string>('')
const chatRef = ref<InstanceType<typeof AgentChatPanel> | null>(null)
const exporting = ref(false)
const exportError = ref('')
const exportPage = ref<DesignPageRender | null>(null)
const exportCanvasRef = ref<InstanceType<typeof PrototypeCanvas> | null>(null)

let connection: ReturnType<typeof connectArtifactEvents> | null = null
let reloadTimer: ReturnType<typeof setTimeout> | null = null
let exportTimer: ReturnType<typeof setTimeout> | null = null
let lastFailedKey = ''

const modules = computed(() => sortModules(artifacts.value?.modules ?? []))
const designs = computed<DesignArtifact[]>(() => artifacts.value?.designs ?? [])
/** 需求模块 + 孤儿设计（有 design 无需求模块；末尾只读） */
const entries = computed(() => mergeModuleEntries(modules.value, designs.value))
const selectedEntry = computed(() => entries.value.find(entry => entry.key === selectedKey.value) ?? null)
const selectedModule = computed(
  () => modules.value.find(module => module.key === selectedKey.value) ?? null
)
const selectedDesign = computed<DesignArtifact | null>(
  () => designs.value.find(design => design.module === selectedKey.value) ?? null
)
const adapted = computed(() => (selectedDesign.value ? adaptDesign(selectedDesign.value, { modules: modules.value }) : null))
const appName = computed(() => app.value?.name ?? props.appId)

/** 原型皮肤：由应用设计系统的视觉风格构造（styleId + 风格 tokens） */
const prototypeSkin = computed<PrototypeSkin | null>(() => {
  const style = designSystem.value?.style
  return style ? (skinFromStyle(style) as PrototypeSkin) : null
})

/** 徽标：应用类型 + 视觉风格（自定义模板带版本，见 design-template-helpers） */
const designBadge = computed(() => designTemplateLabel(designSystem.value))
const designCenterSelection = computed<AppDesignSystemSelection>(() => {
  const design = designSystem.value
  if (!design?.resolved) return {}
  return {
    pack: design.resolved.pack,
    applicationType: design.resolved.applicationType,
    style: design.resolved.style
  }
})

const currentDesignHash = computed(() =>
  selectedDesign.value ? designHashOf(artifacts.value?.hashes, selectedDesign.value.module) : ''
)
const prototypeStale = computed(() => isPrototypeStale(selectedDesign.value, currentDesignHash.value))
const canExport = computed(
  () =>
    Boolean(
      selectedDesign.value &&
        prototypeSkin.value &&
        adapted.value?.pages.length &&
        currentDesignHash.value &&
        !(selectedDesign.value.errors?.length ?? 0)
    )
)
const exportKey = computed(
  () => `${selectedDesign.value?.module ?? ''}:${currentDesignHash.value}:${prototypeSkin.value?.id ?? ''}`
)
const briefStatus = computed(() => (selectedDesign.value?.brief?.exists ? 'brief 已生成' : 'brief 未生成'))
const tokensStatus = computed(() => (selectedDesign.value?.tokens?.exists ? 'tokens 已生成' : 'tokens 未生成'))
const prototypeStatus = computed(() => prototypeSummary(selectedDesign.value))

const designErrors = computed(() => designs.value.flatMap(design => design.errors ?? []))
const warningLines = computed(() => {
  const lines = [
    ...designWarningsOf(designs.value),
    ...mergeArtifactLines(
      designErrors.value,
      adapted.value?.warnings ?? [],
      selectedDesign.value?.file ?? ''
    )
  ]
  return [...new Set(lines)]
})

const summary = computed(() => {
  const entry = selectedEntry.value
  if (!entry) return `${modules.value.length} 个模块 · ${designs.value.length} 个设计`
  const status = designSummaryOf(selectedDesign.value)
  const issueText = designErrors.value.length ? ` · ${designErrors.value.length} 处待处理` : ''
  const orphanText = entry.orphan ? '缺需求模块 · ' : ''
  return status.hasDesign
    ? `${orphanText}实体 ${status.entityCount} · 页面 ${status.pageCount}${issueText}`
    : `未生成设计${issueText}`
})

const syncLabel = computed(
  () => ({ connecting: '同步中…', open: '实时同步', error: '事件断开', closed: '未连接' })[connectionState.value]
)
const refreshedLabel = computed(() => refreshedAt.value || '—')

function designStatus(moduleKey: string) {
  return designSummaryOf(designs.value.find(design => design.module === moduleKey) ?? null)
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
    const nextEntries = mergeModuleEntries(nextArtifacts.modules, nextArtifacts.designs)
    if (selectedKey.value && !nextEntries.some(entry => entry.key === selectedKey.value)) {
      selectedKey.value = nextEntries[0]?.key ?? null
      if (nextEntries.length) ElMessage.info(`当前模块已不存在，已切换到「${nextEntries[0].title || nextEntries[0].key}」`)
    }
    if (!selectedKey.value) selectedKey.value = nextEntries[0]?.key ?? null
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
  if (exporting.value || !canExport.value) return
  if (document.visibilityState !== 'visible') return
  if (!needsPrototypeExport(selectedDesign.value, currentDesignHash.value)) return
  if (lastFailedKey === exportKey.value) return
  exportTimer = setTimeout(() => {
    exportTimer = null
    void runExport('auto')
  }, 1000)
}

/** 逐页离屏渲染 → 批量上传 PNG；失败不阻塞视图 */
async function runExport(mode: 'auto' | 'manual'): Promise<void> {
  if (exporting.value) return
  if (mode === 'manual') lastFailedKey = ''
  exporting.value = true
  exportError.value = ''
  try {
    // 开始前先对齐最新 hash/页面，避免用旧状态导出
    await loadAll(true)
    const design = selectedDesign.value
    const skin = prototypeSkin.value
    const adaptedValue = adapted.value
    const designHash = currentDesignHash.value
    if (!design || !skin || !adaptedValue || !designHash || !adaptedValue.pages.length) {
      if (mode === 'manual') ElMessage.warning('当前模块没有可导出的设计或视觉风格')
      return
    }
    if (design.errors?.length) {
      exportError.value = '设计文件有错误，修正后再导出原型'
      return
    }
    const pages: Array<{ id: string; dataUrl: string }> = []
    const fallbackPages: string[] = []
    const applicationType = designSystem.value?.applicationType?.id ?? ''
    const styleId = designSystem.value?.style?.id ?? ''
    const templatePages = designSystem.value?.pages ?? []
    for (const page of adaptedValue.pages) {
      let shot: { dataUrl: string } | null = null
      // P10b：所有有显式契约的页面用 design-preview 的真实模板风格截图
      if (applicationType && styleId && shouldTemplateCapture(page, templatePages)) {
        try {
          shot = await captureTemplatePage({
            appId: props.appId,
            moduleKey: design.module,
            pageId: page.id,
            applicationType,
            styleId,
            designHash
          })
        } catch (error) {
          fallbackPages.push(page.id)
          console.warn(
            `[design-export] 模板截图失败，回退线框：${page.id}：${error instanceof Error ? error.message : String(error)}`
          )
        }
      }
      // 无显式契约旧设计 / 模板截图失败 → 隐藏线框画布兜底
      if (!shot) {
        exportPage.value = page
        await nextTick()
        await nextFrame()
        const element = exportPaperElement()
        if (!element) throw new Error('原型尚未渲染，无法导出 PNG')
        shot = await captureElementPng(element, 2)
      }
      pages.push({ id: page.id, dataUrl: shot.dataUrl })
    }
    // design.json 在渲染期间变化 → 放弃本次（下次 hash 变化会重新触发），避免 409
    const latest = await getArtifacts(props.appId)
    if (designHashOf(latest.hashes, design.module) !== designHash) return
    const payload = buildPrototypePayload({ designHash, styleId, pages })
    if (!payload) throw new Error('没有可导出的原型页面')
    await savePrototypePackage(props.appId, design.module, payload)
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

function selectModule(key: string): void {
  selectedKey.value = key
  if (narrow.value) outlineOpen.value = false
}

async function runGenerate(): Promise<void> {
  if (!selectedModule.value) return
  const ok = await chatRef.value?.runCommand('generate-design')
  if (!ok) ElMessage.warning('命令未发出（可能正在生成）')
}

function fillComposer(text: string): void {
  if (narrow.value) chatOpen.value = true
  chatRef.value?.setComposer(text)
}

function fixWithAi(): void {
  fillComposer(composerFixText(warningLines.value))
}

function goRequirements(): void {
  window.location.hash = `#/apps/${encodeURIComponent(props.appId)}/requirements`
}

function toggleOutline(): void {
  outlineOpen.value = !outlineOpen.value
  if (outlineOpen.value) chatOpen.value = false
}

function toggleChat(): void {
  chatOpen.value = !chatOpen.value
  if (chatOpen.value) outlineOpen.value = false
}

function closeDrawers(): void {
  outlineOpen.value = false
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
  grid-template-columns: 240px minmax(0, 1fr) 380px;
  position: relative;
}
.col {
  min-width: 0;
  min-height: 0;
}
.col-modules {
  border-right: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  display: flex;
  flex-direction: column;
}
.modules-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--rg-border);
}
.modules-head strong {
  font-size: 13.5px;
  font-weight: 600;
}
.count {
  font-size: 11.5px;
  color: var(--rg-text-3);
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 1px 7px;
}
.modules {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.module {
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  background: var(--rg-surface);
  padding: 16px;
  box-shadow: var(--rg-shadow-1);
  cursor: pointer;
  min-width: 0;
}
.module:hover {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.module.on {
  border-color: var(--rg-ink);
  box-shadow: 0 0 0 2px var(--rg-ai-soft);
}
.module-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.module-top code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  background: var(--rg-fill-2);
  border-radius: 4px;
  padding: 1px 5px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-left: auto;
}
.dot.error {
  background: var(--rg-danger);
}
.module-title {
  margin-top: 4px;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.module-meta {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.module-meta .badge.error {
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
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
.module-state {
  width: auto;
  margin: 10px;
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
  padding: 12px;
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
    grid-template-columns: 220px minmax(0, 1fr) 340px;
  }
}
@media (max-width: 1024px) {
  .drawer-only {
    display: inline-flex;
  }
  .design-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .col-modules,
  .col-chat {
    position: absolute;
    top: 0;
    bottom: 0;
    width: min(340px, 86vw);
    z-index: 20;
    box-shadow: var(--rg-shadow-2);
    transition: transform 0.18s ease;
    background: var(--rg-surface);
  }
  .col-modules {
    left: 0;
    transform: translateX(-105%);
  }
  .col-chat {
    right: 0;
    width: min(400px, 90vw);
    transform: translateX(105%);
  }
  .col-modules.open,
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
