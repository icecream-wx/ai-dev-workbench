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
        <RgButton size="sm" class="drawer-only" data-testid="outline-toggle" @click="toggleOutline">模块</RgButton>
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

    <div :class="['req-body', { narrow }]">
      <div v-if="narrow && (outlineOpen || chatOpen)" class="mask" data-testid="drawer-mask" @click="closeDrawers" />

      <div :class="['col', 'col-outline', { drawer: narrow, open: outlineOpen }]">
        <RequirementsOutline
          :modules="modules"
          :selected-key="selectedKey"
          :templates="requirementTemplates"
          :busy="busy"
          :loading="loading"
          @select="selectModule"
          @create="openCreate"
          @rename="openRename"
          @move="moveModule"
          @template="changeTemplate"
        />
      </div>

      <div class="col col-doc">
        <StatePanel
          v-if="loading"
          variant="loading"
          skeleton="doc"
          test-id="requirements-loading"
          title="正在读取需求文档"
          description="docs/requirements/"
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
          v-else-if="selectedModule"
          :module="selectedModule"
          :design="selectedDesign"
          :template-name="templateNameOf(selectedModule.template)"
          @go-design="goDesign"
        />
        <StatePanel
          v-else
          variant="empty"
          test-id="requirements-empty"
          title="从需求模块开始"
          :icon="Document"
          class="doc-state"
        >
          <template #default>
            模块 = <code>docs/requirements/MOD-xxx-&lt;标题&gt;.md</code>。新建后按应用默认模板生成章节骨架；
            也可以直接在对话里描述目标，让 agent 生成或修改文档。
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
            <RgButton variant="primary" data-testid="empty-create-btn" @click="openCreate">新建模块</RgButton>
          </template>
        </StatePanel>
      </div>

      <div :class="['col', 'col-chat', { drawer: narrow, open: chatOpen }]">
        <AgentChatPanel ref="chatRef" :app-id="appId" view="requirements" :module-key="selectedKey" />
      </div>
    </div>

    <el-dialog v-model="createOpen" title="新建模块" width="min(460px, calc(100vw - 32px))" append-to-body>
      <div class="dialog-form">
        <label>
          <span>模块标题</span>
          <input v-model.trim="createTitle" data-testid="new-module-title" placeholder="如：商品管理" @keyup.enter="submitCreate" />
        </label>
        <label>
          <span>模板</span>
          <select v-model="createTemplate" data-testid="new-module-template">
            <option value="">（使用应用默认模板）</option>
            <option v-for="item in requirementTemplates" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>
        <p class="dialog-hint">新模块会生成 frontmatter + 章节骨架；不会写入数据库。</p>
      </div>
      <template #footer>
        <el-button size="small" @click="createOpen = false">取消</el-button>
        <el-button size="small" type="primary" :loading="busy" data-testid="new-module-confirm" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="renameOpen" title="重命名模块" width="min(420px, calc(100vw - 32px))" append-to-body>
      <div class="dialog-form">
        <label>
          <span>模块标题</span>
          <input v-model.trim="renameTitle" data-testid="rename-input" @keyup.enter="submitRename" />
        </label>
        <p class="dialog-hint">会同步 frontmatter 的 title、H1 与文件名；模块 key 不变。</p>
      </div>
      <template #footer>
        <el-button size="small" @click="renameOpen = false">取消</el-button>
        <el-button size="small" type="primary" :loading="busy" data-testid="rename-confirm" @click="submitRename">保存</el-button>
      </template>
    </el-dialog>

    <TemplateLibraryDialog v-model="libraryOpen" @changed="loadAll(true)" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import AgentChatPanel from './AgentChatPanel.vue'
import RequirementsDocument from './RequirementsDocument.vue'
import RequirementsOutline from './RequirementsOutline.vue'
import TemplateLibraryDialog from './TemplateLibraryDialog.vue'
import StatePanel from '../shared/StatePanel.vue'
import RgButton from '../shared/RgButton.vue'
import RgChip from '../shared/RgChip.vue'
import {
  connectArtifactEvents,
  createModule,
  getApp,
  getArtifacts,
  updateModule,
  type AppInfo,
  type ArtifactsResponse,
  type DesignArtifact,
  type RequirementModuleArtifact
} from './api'
import { listRequirementTemplates, type RequirementTemplate } from '../shared/template-api'
import {
  composerFixText,
  mergeArtifactLines,
  moveModuleOrder,
  sortModules
} from './requirements-helpers.js'
import { artifactSummary } from './view-helpers.js'

const props = defineProps<{ appId: string }>()

const EXAMPLE_PROMPTS = [
  '按模板补全当前模块的需求文档，重点写目标与验收标准。',
  '新增一个「订单管理」模块，包含下单、支付、发货三个场景。',
  '检查需求与设计是否一致，列出具体差异。'
]

const loading = ref(true)
const busy = ref(false)
const error = ref('')
const artifacts = ref<ArtifactsResponse | null>(null)
const app = ref<AppInfo | null>(null)
const requirementTemplates = ref<RequirementTemplate[]>([])
const selectedKey = ref<string | null>(null)
const libraryOpen = ref(false)
const createOpen = ref(false)
const createTitle = ref('')
const createTemplate = ref('')
const renameOpen = ref(false)
const renameTitle = ref('')
const connectionState = ref<'connecting' | 'open' | 'error' | 'closed'>('closed')
const narrow = ref(false)
const outlineOpen = ref(false)
const chatOpen = ref(false)
const chatRef = ref<InstanceType<typeof AgentChatPanel> | null>(null)

let connection: ReturnType<typeof connectArtifactEvents> | null = null
let reloadTimer: ReturnType<typeof setTimeout> | null = null

const modules = computed(() => sortModules(artifacts.value?.modules ?? []))
const selectedModule = computed<RequirementModuleArtifact | null>(
  () => modules.value.find(module => module.key === selectedKey.value) ?? null
)
const selectedDesign = computed<DesignArtifact | null>(
  () => artifacts.value?.designs.find(design => design.module === selectedModule.value?.key) ?? null
)
const summary = computed(() => artifactSummary(artifacts.value))
const syncLabel = computed(
  () =>
    ({ connecting: '同步中…', open: '实时同步', error: '事件断开', closed: '未连接' })[connectionState.value]
)
const warningLines = computed(() =>
  mergeArtifactLines(artifacts.value?.errors ?? [], selectedModule.value?.warnings ?? [], selectedModule.value?.file ?? '')
)
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
    const list = sortModules(nextArtifacts.modules)
    if (selectedKey.value && !list.some(module => module.key === selectedKey.value)) {
      selectedKey.value = list[0]?.key ?? null
      if (list.length) ElMessage.info(`当前模块已不存在，已切换到「${list[0].title || list[0].key}」`)
    }
    if (!selectedKey.value) selectedKey.value = list[0]?.key ?? null
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

function selectModule(key: string): void {
  selectedKey.value = key
  if (narrow.value) outlineOpen.value = false
}

function openCreate(): void {
  createTitle.value = ''
  createTemplate.value = app.value?.requirementTemplateId ?? ''
  createOpen.value = true
}

async function submitCreate(): Promise<void> {
  if (busy.value) return
  if (!createTitle.value.trim()) {
    ElMessage.warning('请填写模块标题')
    return
  }
  busy.value = true
  try {
    const result = await createModule(props.appId, {
      title: createTitle.value.trim(),
      ...(createTemplate.value ? { templateId: createTemplate.value } : {})
    })
    selectedKey.value = result.module.key
    createOpen.value = false
    await loadAll(true)
    ElMessage.success(`已创建 ${result.module.file}`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    busy.value = false
  }
}

function openRename(): void {
  if (!selectedModule.value) return
  renameTitle.value = selectedModule.value.title
  renameOpen.value = true
}

async function submitRename(): Promise<void> {
  if (busy.value || !selectedModule.value) return
  const title = renameTitle.value.trim()
  if (!title) {
    ElMessage.warning('请填写模块标题')
    return
  }
  busy.value = true
  try {
    await updateModule(props.appId, selectedModule.value.key, { title })
    renameOpen.value = false
    await loadAll(true)
    ElMessage.success('已重命名（frontmatter / H1 / 文件名已同步）')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    busy.value = false
  }
}

async function moveModule(direction: -1 | 1): Promise<void> {
  if (busy.value || !selectedKey.value) return
  const plan = moveModuleOrder(modules.value, selectedKey.value, direction)
  if (!plan) return
  busy.value = true
  try {
    for (const update of plan.updates) {
      await updateModule(props.appId, update.key, { order: update.order })
    }
    await loadAll(true)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    busy.value = false
  }
}

async function changeTemplate(templateId: string): Promise<void> {
  if (busy.value || !selectedModule.value) return
  busy.value = true
  try {
    await updateModule(props.appId, selectedModule.value.key, { template: templateId })
    await loadAll(true)
    ElMessage.info('模板已切换；如需按新模板重排章节，请发送 /update-requirements')
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

function fixWithAi(): void {
  fillComposer(composerFixText(warningLines.value))
}

function goDesign(): void {
  window.location.hash = `#/apps/${encodeURIComponent(props.appId)}/design`
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
  grid-template-columns: 260px minmax(0, 1fr) 380px;
  position: relative;
}
.col {
  min-width: 0;
  min-height: 0;
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
.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dialog-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--rg-text-2);
}
.dialog-form input,
.dialog-form select {
  height: 32px;
  border: 1px solid var(--rg-border-strong);
  border-radius: 8px;
  padding: 0 9px;
  font-size: 13px;
  background: var(--rg-surface);
  color: var(--rg-text);
}
.dialog-hint {
  margin: 0;
  font-size: 11.5px;
  color: var(--rg-text-3);
  line-height: 1.6;
}
.drawer-only {
  display: none;
}
.mask {
  display: none;
}
@media (max-width: 1280px) {
  .req-body {
    grid-template-columns: 240px minmax(0, 1fr) 340px;
  }
}
@media (max-width: 1024px) {
  .drawer-only {
    display: inline-flex;
  }
  .req-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .col-outline,
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
  .col-outline {
    left: 0;
    transform: translateX(-105%);
  }
  .col-chat {
    right: 0;
    width: min(400px, 90vw);
    transform: translateX(105%);
  }
  .col-outline.open,
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
