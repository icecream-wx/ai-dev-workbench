<template>
  <section class="requirements-view" data-testid="requirements-view">
    <header class="toolbar">
      <div class="left">
        <span class="summary" data-testid="artifact-summary">{{ summary }}</span>
        <RgChip
          v-if="issueCount"
          tone="danger"
          size="sm"
          class="issues"
          data-testid="artifact-issues"
          :title="`${issueCount} 处问题，详见下方提示`"
        >
          {{ issueCount }} 处待处理
        </RgChip>
        <span :class="['sync', connectionState]" data-testid="sync-state">{{ syncLabel }}</span>
      </div>
      <div class="right">
        <RgButton size="sm" class="drawer-only" data-testid="chat-toggle" @click="toggleChat">对话</RgButton>
        <RgButton size="sm" data-testid="template-library-btn" @click="libraryOpen = true">模板库</RgButton>
        <RgButton size="sm" :disabled="loading" data-testid="refresh-btn" @click="loadAll(false)">刷新</RgButton>
      </div>
    </header>

    <div v-if="warningLines.length" class="warning-strip rg-panel rg-panel--warn" data-testid="artifact-warning-strip">
      <div class="strip-text">
        <strong>发现 {{ warningLines.length }} 处问题</strong>
        <ul>
          <li v-for="line in warningLines.slice(0, 3)" :key="line">{{ line }}</li>
        </ul>
      </div>
      <RgButton variant="danger" size="sm" data-testid="fix-with-ai-btn" @click="fixWithAi">让 AI 修</RgButton>
    </div>

    <div
      ref="bodyRef"
      :class="['req-body', { narrow }]"
      :style="narrow ? undefined : { '--chat-width': `${chatWidth}px` }"
    >
      <div v-if="narrow && chatOpen" class="mask" data-testid="drawer-mask" @click="closeDrawers" />

      <div :class="['col', 'col-chat', { drawer: narrow, open: chatOpen }]">
        <AgentChatPanel ref="chatRef" :app-id="appId" view="requirements" />
      </div>

      <SplitHandle
        v-if="!narrow"
        test-id="requirements-chat-split"
        :value-now="chatWidth"
        :value-min="chatMin"
        :value-max="chatMaxAllowed"
        label="调整对话栏宽度"
        @pointerdown="onChatPointerDown"
        @keydown="onChatKeydown"
        @dblclick="onChatDoubleClick"
      />

      <div class="col col-doc">
        <StatePanel
          v-if="loading"
          variant="loading"
          skeleton="doc"
          test-id="requirements-loading"
          title="正在读取需求文档"
          description="docs/requirements/requirements.md"
          class="doc-state"
        />
        <StatePanel
          v-else-if="error"
          variant="error"
          test-id="requirements-error"
          title="需求文档读取失败"
          description="请检查工作区或后端服务，稍后重试。"
          class="doc-state"
        >
          <template #actions>
            <RgButton size="sm" @click="loadAll(false)">重试</RgButton>
          </template>
          <template #details>
            <pre>{{ error }}</pre>
          </template>
        </StatePanel>
        <RequirementsDocument
          v-else-if="requirement?.exists"
          :requirement="requirement"
          :entities="entities"
          :pages="pages"
          :template-name="templateNameOf(requirement.template)"
          @go-design="goDesign"
          @ask-ai="onAskAi"
        />
        <StatePanel
          v-else
          variant="empty"
          test-id="requirements-empty"
          title="从需求文档开始"
          :icon="Document"
          class="doc-state"
        >
          <template #default>
            需求是单文档 <code>docs/requirements/requirements.md</code>。生成骨架后按模板章节补全；
            Epic 用 <code>EP-001</code>、Story 用 <code>US-001</code>，也可以直接在对话里描述目标，让 agent 生成或修改文档。
          </template>
          <template #examples>
            <ul class="examples">
              <li v-for="(example, index) in EXAMPLE_PROMPTS" :key="example">
                <button type="button" class="link" :data-testid="`example-prompt-${index + 1}`" @click="fillComposer(example)">
                  {{ example }}
                </button>
              </li>
            </ul>
          </template>
          <template #actions>
            <RgButton variant="primary" :disabled="busy" data-testid="empty-create-btn" @click="generateSkeleton">
              生成文档骨架
            </RgButton>
          </template>
        </StatePanel>
      </div>
    </div>

    <TemplateLibraryDialog v-model="libraryOpen" @changed="loadAll(true)" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import AgentChatPanel from './AgentChatPanel.vue'
import RequirementsDocument from './RequirementsDocument.vue'
import TemplateLibraryDialog from './TemplateLibraryDialog.vue'
import StatePanel from '../shared/StatePanel.vue'
import RgButton from '../shared/RgButton.vue'
import RgChip from '../shared/RgChip.vue'
import SplitHandle from '../shared/SplitHandle.vue'
import { useChatResize } from '../shared/useChatResize'
import {
  connectArtifactEvents,
  ensureRequirementDocument,
  getApp,
  getArtifacts,
  type AppInfo,
  type ArtifactsResponse
} from './api'
import { listRequirementTemplates, type RequirementTemplate } from '../shared/template-api'
import { composerFixText, mergeArtifactLines, requirementSummary, sectionAskFocus, sectionAskPrompt } from './requirements-helpers.js'

const props = defineProps<{ appId: string }>()

const EXAMPLE_PROMPTS = [
  '按模板补全需求文档，重点写目标与验收标准。',
  '新增一个「订单管理」Epic，包含下单、支付、发货三个用户故事。',
  '检查需求文档与设计（实体/页面集）是否一致，列出具体差异。'
]

const loading = ref(true)
const busy = ref(false)
const error = ref('')
const artifacts = ref<ArtifactsResponse | null>(null)
const app = ref<AppInfo | null>(null)
const requirementTemplates = ref<RequirementTemplate[]>([])
const libraryOpen = ref(false)
const connectionState = ref<'connecting' | 'open' | 'error' | 'closed'>('closed')
const narrow = ref(false)
const chatOpen = ref(false)
const chatRef = ref<InstanceType<typeof AgentChatPanel> | null>(null)
const bodyRef = ref<HTMLElement | null>(null)

const {
  chatWidth,
  minWidth: chatMin,
  maxAllowed: chatMaxAllowed,
  onPointerDown: onChatPointerDown,
  onKeydown: onChatKeydown,
  onDoubleClick: onChatDoubleClick
} = useChatResize({
  containerRef: bodyRef,
  storageKey: 'rg.chat-width.requirements',
  otherMinWidth: 520 + 6,
  defaultWidth: 380
})

let connection: ReturnType<typeof connectArtifactEvents> | null = null
let reloadTimer: ReturnType<typeof setTimeout> | null = null

const requirement = computed(() => artifacts.value?.requirement ?? null)
const entities = computed(() => artifacts.value?.entities ?? null)
const pages = computed(() => artifacts.value?.pages ?? null)
const summary = computed(() => {
  const info = requirementSummary(requirement.value)
  if (!info.exists) return '未生成需求文档'
  return `需求文档 · ${info.epicCount} 个 Epic · ${info.storyCount} 个 Story`
})
const syncLabel = computed(
  () =>
    ({ connecting: '同步中…', open: '实时同步', error: '事件断开', closed: '未连接' })[connectionState.value]
)
const warningLines = computed(() => {
  const artifactsValue = artifacts.value
  if (!artifactsValue) return []
  return [
    ...mergeArtifactLines(
      artifactsValue.errors ?? [],
      [
        ...(artifactsValue.requirement?.warnings ?? []),
        ...(artifactsValue.entities?.warnings ?? []),
        ...(artifactsValue.pages?.warnings ?? [])
      ],
      '工作区'
    )
  ]
})
/** 工具栏只显示数量（人话），明细在下方提示条 */
const issueCount = computed(() => warningLines.value.length)

function templateNameOf(templateId: string): string {
  if (!templateId) return ''
  return requirementTemplates.value.find(item => item.id === templateId)?.name ?? templateId
}

async function loadAll(silent: boolean): Promise<void> {
  if (!silent) loading.value = true
  error.value = ''
  try {
    const [nextApp, nextArtifacts, templates] = await Promise.all([
      getApp(props.appId),
      getArtifacts(props.appId),
      listRequirementTemplates().catch(() => [] as RequirementTemplate[])
    ])
    app.value = nextApp
    artifacts.value = nextArtifacts
    requirementTemplates.value = templates.filter(item => item.stage === 'requirements')
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

async function generateSkeleton(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const result = await ensureRequirementDocument(props.appId)
    await loadAll(true)
    if (result.created) ElMessage.success(`已生成 ${result.file}`)
    else if (result.skipped) ElMessage.info('需求文档已存在，未覆盖')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    busy.value = false
  }
}

function fillComposer(text: string): void {
  if (narrow.value) chatOpen.value = true
  chatRef.value?.setComposer(text)
}

/** 章节「问 AI」：显示定位 chip + 预填默认提问（只填不发），发送时带隐藏章节上下文 */
function onAskAi(item: { id: string; title: string; level: number; key?: string; kind?: string }): void {
  if (narrow.value) chatOpen.value = true
  chatRef.value?.setSectionFocus(sectionAskFocus(item))
  fillComposer(sectionAskPrompt(item))
}

function fixWithAi(): void {
  fillComposer(composerFixText(warningLines.value))
}

function goDesign(): void {
  window.location.hash = `#/apps/${encodeURIComponent(props.appId)}/design`
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

onMounted(async () => {
  syncNarrow()
  window.addEventListener('resize', syncNarrow)
  window.addEventListener('keydown', onKeydown)
  await loadAll(false)
  subscribe()
})

onUnmounted(() => {
  connection?.close()
  connection = null
  if (reloadTimer) clearTimeout(reloadTimer)
  window.removeEventListener('resize', syncNarrow)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.requirements-view {
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
.summary {
  font-size: 12px;
  font-weight: 600;
  color: var(--rg-text-2);
}
.issues {
  flex-shrink: 0;
  max-width: 160px;
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
.strip-text {
  min-width: 0;
}
.strip-text ul {
  margin: 4px 0 0;
  padding-left: 16px;
  line-height: 1.6;
}
.strip-text li {
  word-break: break-word;
}
.req-body {
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
.col-doc {
  overflow: hidden;
  background: var(--rg-bg);
  padding: 12px 16px;
}
.col-doc :deep(.doc) {
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  box-shadow: var(--rg-shadow-1);
}
.doc-state {
  max-width: 640px;
  margin: 24px auto;
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
.drawer-only {
  display: none;
}
.mask {
  display: none;
}
@media (max-width: 1024px) {
  .drawer-only {
    display: inline-flex;
  }
  .req-body {
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
  .col-doc {
    height: 100%;
  }
}
</style>
