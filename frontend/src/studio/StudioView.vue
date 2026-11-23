<template>
  <div class="studio-shell" data-testid="studio-view">
    <header class="studio-head">
      <div class="head-left">
        <button type="button" class="btn ghost" data-testid="studio-home" @click="goHome">← 返回首页</button>
        <div class="head-title">
          <strong>{{ draft?.name || packId }}</strong>
          <span class="chip mono">{{ packId }}</span>
          <span class="chip">{{ versionLabel }}</span>
          <span :class="['chip', 'status', draft?.status === 'published' ? 'published' : 'draft']" data-testid="studio-draft-status">
            {{ statusLabel }}
          </span>
          <span v-if="draft?.style" class="chip">{{ draft.style }}</span>
        </div>
      </div>
      <div class="head-right">
        <span
          :class="['runtime', health?.ready ? 'ok' : health?.starting ? 'starting' : 'idle']"
          :title="healthError || health?.lastError || health?.installError || ''"
        >
          {{ runtimeLabel }}
        </span>
        <select
          class="model-select"
          data-testid="studio-model-select"
          :value="modelValue"
          :disabled="modelBusy"
          @change="onModelChange"
        >
          <option value="">{{ defaultModelLabel }}</option>
          <option v-for="item in modelOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </div>
    </header>

    <div v-if="loading" class="studio-state">正在加载工作室…</div>

    <div v-else-if="fatal" class="studio-state error" data-testid="studio-fatal">
      <strong>工作室加载失败</strong>
      <span>{{ fatal }}</span>
      <div class="state-actions">
        <button type="button" class="btn" :disabled="actionBusy !== ''" @click="reloadAll()">重试</button>
        <button type="button" class="btn" @click="goHome">返回首页</button>
      </div>
    </div>

    <template v-else>
      <nav class="studio-tabs" role="tablist" aria-label="工作室面板" data-testid="studio-pane-tabs">
        <button
          type="button"
          :class="['studio-tab', { on: mobilePane === 'pages' }]"
          data-testid="studio-tab-pages"
          @click="mobilePane = 'pages'"
        >
          页面<span class="tab-count">{{ pages.length }}</span>
        </button>
        <button
          type="button"
          :class="['studio-tab', { on: mobilePane === 'chat' }]"
          data-testid="studio-tab-chat"
          @click="mobilePane = 'chat'"
        >
          对话
        </button>
        <button
          type="button"
          :class="['studio-tab', { on: mobilePane === 'preview' }]"
          data-testid="studio-tab-preview"
          @click="mobilePane = 'preview'"
        >
          预览
        </button>
      </nav>

    <main class="studio-body">
      <aside :class="['studio-left', { 'pane-active': mobilePane === 'pages' }]" data-testid="studio-pane-pages">
        <section class="block">
          <div class="block-head">
            <strong>页面清单</strong>
            <span class="pill">{{ pages.length }} 页</span>
          </div>
          <ul v-if="pages.length" class="page-list" data-testid="studio-page-list">
            <li
              v-for="page in pages"
              :key="page.id"
              :class="['page-item', { active: page.id === selectedPageId }]"
              data-testid="studio-page-item"
              tabindex="0"
              @click="selectPage(page.id)"
              @keydown.enter="selectPage(page.id)"
            >
              <div class="page-line">
                <span :class="['kind', page.kind]">{{ pageKindLabel(page.kind) }}</span>
                <strong class="page-name">{{ page.name }}</strong>
              </div>
              <div class="page-meta">
                <code>{{ page.id }}</code>
                <span v-if="page.recipe">{{ page.recipe }}</span>
                <span v-if="page.source">{{ page.source }}</span>
                <span v-if="!page.generated" class="muted">未生成</span>
              </div>
            </li>
          </ul>
          <p v-else class="empty-hint">让 agent 先确定页面清单（spec.json 的 pages 还是空的）。</p>
        </section>

        <section class="block">
          <div class="block-head">
            <strong>校验</strong>
            <span :class="['pill', issuesSummary.ok ? 'ok' : 'danger']">
              {{ issuesSummary.ok ? '通过' : `${issuesSummary.errors} 错误` }} · {{ issuesSummary.warnings }} 警告
            </span>
          </div>
          <p v-if="detail?.specError" class="error-line">spec.json 解析失败：{{ detail.specError }}</p>
          <ul v-if="issues.length" class="issue-list" data-testid="studio-validation">
            <li v-for="(issue, index) in issues.slice(0, 40)" :key="`${issue.source}-${issue.code}-${index}`" :class="issue.kind">
              <span class="issue-kind">{{ issue.kind === 'error' ? '错误' : '警告' }}</span>
              <code class="issue-path">{{ issue.path }}</code>
              <span class="issue-msg">{{ issue.message }}</span>
            </li>
          </ul>
          <p v-else class="empty-hint">暂无 spec/生成问题。</p>
        </section>

        <section class="block hint-block">
          <div class="block-head">
            <strong>首条提示</strong>
            <button type="button" class="btn tiny" :disabled="!defaultPrompt" @click="fillDefaultPrompt">填入输入框</button>
          </div>
          <pre v-if="defaultPrompt" class="prompt-preview">{{ defaultPrompt }}</pre>
          <p v-else class="empty-hint">会话建立后显示工作室提示。</p>
        </section>
      </aside>

      <section :class="['studio-chat', { 'pane-active': mobilePane === 'chat' }]" data-testid="studio-pane-chat">
        <AgentChatPanel
          ref="chatRef"
          :app-id="packId"
          view="template"
          :api="studioChatApi"
          :commands="[]"
          empty-hint="模板工作室：描述业务目标，agent 会先读 catalog，再写 spec.json。"
          composer-placeholder="给模板工作室 agent 发消息…  Enter 发送 · Shift+Enter 换行"
        />
      </section>

      <section :class="['studio-preview', { 'pane-active': mobilePane === 'preview' }]" data-testid="studio-pane-preview">
        <header class="preview-head">
          <select v-model="selectedPageId" class="page-select" data-testid="studio-preview-page" :disabled="!pages.length">
            <option v-if="!pages.length" value="">（无页面）</option>
            <option v-for="page in pages" :key="page.id" :value="page.id">{{ page.name }}（{{ page.id }}）</option>
          </select>
          <button type="button" class="btn tiny" :disabled="!previewSrc" @click="refreshPreview">刷新</button>
          <button type="button" class="btn tiny" :disabled="!previewSrc" @click="openPreviewWindow">新窗口</button>
        </header>
        <div v-if="!hasPack" class="preview-empty" data-testid="studio-preview-empty">
          <strong>尚未生成预览</strong>
          <span>先与 AI 确认页面清单，再点“生成预览”。</span>
        </div>
        <div v-else-if="!previewSrc" class="preview-empty">
          <strong>没有可预览页面</strong>
          <span>spec.json 的 pages 为空；让 agent 补齐页面后重新生成。</span>
        </div>
        <iframe
          v-else
          :key="`${previewSrc}-${previewKey}`"
          class="preview-frame"
          :src="previewSrc"
          title="模板预览"
          data-testid="studio-preview-frame"
        />
      </section>
    </main>
    </template>

    <footer class="studio-foot">
      <div class="foot-actions">
        <button
          type="button"
          class="btn primary"
          data-testid="studio-generate"
          :disabled="actionBusy !== ''"
          @click="onGenerate"
        >
          {{ actionBusy === 'generate' ? '生成中…' : '生成预览' }}
        </button>
        <button
          type="button"
          class="btn"
          data-testid="studio-publish"
          :disabled="actionBusy !== '' || !hasPack"
          @click="onPublish"
        >
          {{ actionBusy === 'publish' ? '发布中…' : '发布' }}
        </button>
        <button
          type="button"
          class="btn danger"
          data-testid="studio-discard"
          :disabled="actionBusy !== ''"
          @click="onDiscard"
        >
          {{ draft?.status === 'published' ? '丢弃草稿（保留模板）' : '丢弃草稿' }}
        </button>
        <button type="button" class="btn ghost" :disabled="actionBusy !== ''" @click="reloadAll()">刷新</button>
      </div>
      <div class="foot-summary">
        <span>最后生成：{{ lastGenerated }}</span>
        <span v-if="css.sources.length">CSS 来源：{{ css.sources.join(' + ') }}</span>
        <span v-if="css.rules || css.deduped">规则 {{ css.rules }} · 去重 {{ css.deduped }}</span>
        <span v-if="conflicts.length" class="conflict">
          冲突 {{ conflictView.total }} 条：{{ conflictView.shown.join('、') }}
          <button v-if="conflictView.more || conflictsExpanded" type="button" class="link" @click="conflictsExpanded = !conflictsExpanded">
            {{ conflictsExpanded ? '收起' : `+${conflictView.more}` }}
          </button>
        </span>
        <span v-if="modelsError" class="muted">模型列表加载失败：{{ modelsError }}</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
/**
 * 模板工作室（P7-7b-2a）
 *
 * 路由：`#/studio/<packId>`（`App.vue` 解析）。布局参考设计 §14.2：
 * 头部（返回/模板名/版本/状态/模型）｜左（页面/spec/校验/首条提示）｜中（AgentChatPanel 工作室 API）｜
 * 右（template-preview.html iframe）｜底部（生成/发布/丢弃/刷新 + CSS 冲突与最后生成时间）。
 *
 * 边界：不做模板中心新建入口（P7-7b-2b）、不做 picker/scaffold（P7-7c）、不写 PNG、不调模型。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AgentChatPanel from '../workbench/AgentChatPanel.vue'
import {
  deleteDraft,
  generateDraft,
  getDraftDetail,
  getRuntimeHealth,
  getStudioModel,
  getStudioState,
  listModels,
  publishDraft,
  saveStudioModel,
  studioChatApi,
  StudioApiError,
  type RuntimeHealth
} from '../studio/api'
import type {
  DraftDetail,
  DraftFailurePayload,
  OpencodeModel,
  StudioModelResponse,
  StudioSessionResponse
} from '../studio/types'
import {
  conflictPreview,
  cssSummary,
  discardConfirmText,
  draftPageRows,
  draftStatusLabel,
  draftVersionLabel,
  formatDateTime,
  modelKey,
  modelLabel,
  pageKindLabel,
  previewUrlOf,
  publishConfirmText,
  validationItems,
  validationSummary
} from '../studio/spec-helpers.js'

const props = defineProps<{ packId: string }>()

type Busy = '' | 'generate' | 'publish' | 'discard' | 'reload'

const detail = ref<DraftDetail | null>(null)
const studio = ref<StudioSessionResponse | null>(null)
const models = ref<OpencodeModel[]>([])
const modelInfo = ref<StudioModelResponse | null>(null)
const modelValue = ref('')
const modelBusy = ref(false)
const modelsError = ref('')
const health = ref<RuntimeHealth | null>(null)
const healthError = ref('')
const loading = ref(true)
const fatal = ref('')
const actionBusy = ref<Busy>('')
/** 窄屏（≤1180）三块切换：页面 / 对话 / 预览；桌面三栏布局忽略该状态 */
const mobilePane = ref<'pages' | 'chat' | 'preview'>('chat')
const generateIssues = ref<DraftFailurePayload | null>(null)
const selectedPageId = ref('')
const previewKey = ref(0)
const conflictsExpanded = ref(false)
const chatRef = ref<InstanceType<typeof AgentChatPanel> | null>(null)

const draft = computed(() => detail.value?.draft ?? null)
const pages = computed(() => draftPageRows(detail.value))
const statusLabel = computed(() => draftStatusLabel(draft.value?.status))
const versionLabel = computed(() => draftVersionLabel(draft.value))
const issues = computed(() => validationItems(detail.value, generateIssues.value))
const issuesSummary = computed(() => validationSummary(issues.value))
const css = computed(() => cssSummary(detail.value?.generation))
const conflicts = computed(() => css.value.conflicts)
const conflictView = computed(() => conflictPreview(conflicts.value, conflictsExpanded.value ? 100 : 3))
const lastGenerated = computed(() => formatDateTime(detail.value?.generation?.generatedAt))
const hasPack = computed(() => Boolean(detail.value?.packSummary))
const selectedPage = computed(() => pages.value.find((page) => page.id === selectedPageId.value) ?? pages.value[0] ?? null)
const previewSrc = computed(() => (hasPack.value && selectedPage.value ? previewUrlOf(props.packId, selectedPage.value.id) : ''))
const defaultPrompt = computed(() => studio.value?.defaultPrompt ?? '')

const modelOptions = computed(() =>
  models.value.map((model) => ({ value: `${model.providerID}/${model.modelID || model.id}`, label: modelLabel(model) }))
)
const defaultModelLabel = computed(() => {
  const fallback = modelInfo.value?.fallback
  return fallback ? `默认（${modelLabel(fallback)}）` : '默认模型'
})
const runtimeLabel = computed(() => {
  if (healthError.value) return 'opencode 状态未知'
  if (!health.value) return 'opencode 检测中…'
  if (health.value.ready) return 'opencode 已连接'
  if (health.value.starting) return 'opencode 启动中…'
  return 'opencode 未就绪'
})

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function reloadDetail(): Promise<void> {
  try {
    detail.value = await getDraftDetail(props.packId)
    syncSelectedPage()
  } catch (error) {
    fatal.value = errorMessage(error)
  }
}

function syncSelectedPage(): void {
  const rows = pages.value
  if (!rows.some((page) => page.id === selectedPageId.value)) selectedPageId.value = rows[0]?.id ?? ''
}

async function reloadAll(showSpinner = false): Promise<void> {
  if (showSpinner) loading.value = true
  fatal.value = ''
  try {
    detail.value = await getDraftDetail(props.packId)
  } catch (error) {
    fatal.value = errorMessage(error)
    detail.value = null
    loading.value = false
    return
  }
  syncSelectedPage()
  try {
    studio.value = await getStudioState(props.packId)
  } catch {
    studio.value = null
  }
  loading.value = false
  previewKey.value += 1
  void loadModels()
  void loadModel()
  void loadHealth()
}

async function loadModels(): Promise<void> {
  modelsError.value = ''
  try {
    models.value = await listModels()
  } catch (error) {
    models.value = []
    modelsError.value = errorMessage(error)
  }
}

async function loadModel(): Promise<void> {
  try {
    modelInfo.value = await getStudioModel(props.packId)
    modelValue.value = modelKey(modelInfo.value.model)
  } catch {
    modelInfo.value = null
    modelValue.value = ''
  }
}

async function loadHealth(): Promise<void> {
  try {
    health.value = await getRuntimeHealth()
    healthError.value = ''
  } catch (error) {
    health.value = null
    healthError.value = errorMessage(error)
  }
}

async function onModelChange(): Promise<void> {
  if (modelBusy.value) return
  modelBusy.value = true
  const previous = modelKey(modelInfo.value?.model ?? null)
  try {
    const result = await saveStudioModel(props.packId, modelRefOfValue(modelValue.value))
    modelInfo.value = {
      stage: 'template',
      agent: modelInfo.value?.agent ?? 'build',
      model: result.model,
      fallback: modelInfo.value?.fallback ?? null
    }
    modelValue.value = modelKey(result.model)
    ElMessage.success(result.model ? `已切换模型：${modelValue.value}` : '已改为默认模型')
  } catch (error) {
    modelValue.value = previous
    ElMessage.error(errorMessage(error))
  } finally {
    modelBusy.value = false
  }
}

function modelRefOfValue(value: string): { providerID: string; id: string } | null {
  if (!value || !value.includes('/')) return null
  const index = value.indexOf('/')
  const providerID = value.slice(0, index)
  const id = value.slice(index + 1)
  return providerID && id ? { providerID, id } : null
}

function selectPage(pageId: string): void {
  if (!pageId || pageId === selectedPageId.value) return
  selectedPageId.value = pageId
  previewKey.value += 1
}

function refreshPreview(): void {
  previewKey.value += 1
}

function openPreviewWindow(): void {
  if (!previewSrc.value) return
  window.open(previewSrc.value, '_blank', 'noopener')
}

function fillDefaultPrompt(): void {
  if (!defaultPrompt.value) return
  chatRef.value?.setComposer(defaultPrompt.value)
}

function goHome(): void {
  window.location.hash = '#/'
}

function applyFailure(error: unknown): void {
  if (error instanceof StudioApiError) {
    generateIssues.value = error.payload
    ElMessage.error(error.message)
    return
  }
  ElMessage.error(errorMessage(error))
}

async function onGenerate(): Promise<void> {
  if (actionBusy.value) return
  actionBusy.value = 'generate'
  generateIssues.value = null
  try {
    const result = await generateDraft(props.packId)
    ElMessage.success(`已生成预览：${result?.pack?.pageCount ?? pages.value.length} 页`)
    await reloadAll(false)
  } catch (error) {
    applyFailure(error)
    await reloadDetail()
  } finally {
    actionBusy.value = ''
  }
}

async function onPublish(): Promise<void> {
  if (actionBusy.value || !hasPack.value) return
  try {
    await ElMessageBox.confirm(publishConfirmText(draft.value), '发布模板', {
      type: 'warning',
      confirmButtonText: '发布',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  actionBusy.value = 'publish'
  try {
    const result = await publishDraft(props.packId)
    ElMessage.success(`已发布 v${result?.pack?.version ?? ''}`)
    await reloadAll(false)
  } catch (error) {
    applyFailure(error)
    await reloadDetail()
  } finally {
    actionBusy.value = ''
  }
}

async function onDiscard(): Promise<void> {
  if (actionBusy.value) return
  try {
    await ElMessageBox.confirm(discardConfirmText(draft.value), '丢弃草稿', {
      type: 'error',
      confirmButtonText: '丢弃',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  actionBusy.value = 'discard'
  try {
    const result = await deleteDraft(props.packId)
    ElMessage.success(result?.packKept ? '草稿已丢弃，已发布模板保留' : '草稿已丢弃')
    goHome()
  } catch (error) {
    ElMessage.error(errorMessage(error))
    await reloadDetail()
  } finally {
    actionBusy.value = ''
  }
}

watch(selectedPageId, () => syncSelectedPage())

watch(
  () => props.packId,
  () => {
    selectedPageId.value = ''
    conflictsExpanded.value = false
    void reloadAll(true)
  }
)

onMounted(() => void reloadAll(true))
</script>

<style scoped>
.studio-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  background: var(--rg-bg);
  color: var(--rg-text);
  font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.studio-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 14px;
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
}
.head-left,
.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}
.head-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
}
.head-title strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}
.chip {
  flex-shrink: 0;
  font-size: 10.5px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 2px 8px;
}
.chip.mono {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
}
.chip.status.draft {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.chip.status.published {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.runtime {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  white-space: nowrap;
}
.runtime.ok {
  color: var(--rg-ok);
  background: var(--rg-ok-soft);
}
.runtime.starting {
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
}
.model-select {
  height: 26px;
  max-width: 260px;
  border: 1px solid var(--rg-border);
  border-radius: 7px;
  background: var(--rg-surface);
  color: var(--rg-text);
  font-size: 11px;
  padding: 0 6px;
}
.studio-state {
  display: grid;
  place-items: center;
  gap: 8px;
  flex: 1;
  padding: 24px;
  font-size: 12.5px;
  color: var(--rg-text-3);
  text-align: center;
}
.studio-state.error {
  color: var(--rg-danger);
}
.state-actions {
  display: flex;
  gap: 8px;
}
.studio-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr) minmax(0, 1.08fr);
  overflow: hidden;
}
/* 仅窄屏显示：页面 / 对话 / 预览 单栏切换（桌面三栏布局不使用） */
.studio-tabs {
  display: none;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--rg-border);
  background: var(--rg-surface);
}
.studio-tab {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 30px;
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  background: var(--rg-surface);
  color: var(--rg-text-2);
  font-size: 12px;
  cursor: pointer;
}
.studio-tab.on {
  border-color: var(--rg-ink);
  background: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.tab-count {
  font-size: 10px;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.studio-tab.on .tab-count {
  background: rgba(255, 255, 255, 0.2);
  color: inherit;
}
.studio-left {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  border-right: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
}
.pill {
  font-size: 10px;
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  white-space: nowrap;
}
.pill.ok {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.pill.danger {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.page-list,
.issue-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.page-item {
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  background: var(--rg-surface);
  padding: 6px 8px;
  cursor: pointer;
  min-width: 0;
}
.page-item:hover {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.page-item.active {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
}
.page-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.page-name {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kind {
  flex-shrink: 0;
  font-size: 9.5px;
  border-radius: 999px;
  padding: 1px 6px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.kind.reference {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.kind.contract {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.page-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 8px;
  margin-top: 3px;
  font-size: 10px;
  color: var(--rg-text-3);
  min-width: 0;
}
.page-meta code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
}
.issue-list li {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 6px;
  align-items: baseline;
  font-size: 10.5px;
  line-height: 1.5;
  padding: 4px 6px;
  border-radius: 6px;
  background: var(--rg-fill-2);
}
.issue-list li.error {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.issue-list li.warning {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.issue-kind {
  flex-shrink: 0;
  font-weight: 600;
}
.issue-path {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  word-break: break-all;
}
.issue-msg {
  word-break: break-word;
}
.error-line {
  margin: 0;
  font-size: 10.5px;
  color: var(--rg-danger);
}
.empty-hint {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--rg-text-3);
}
.prompt-preview {
  margin: 0;
  max-height: 140px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 10px;
  line-height: 1.55;
  color: var(--rg-text-2);
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 6px;
  padding: 6px 8px;
}
.studio-chat {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.studio-preview {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-left: 1px solid var(--rg-border);
  background: var(--rg-surface);
}
.preview-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--rg-border);
}
.page-select {
  flex: 1;
  min-width: 0;
  height: 26px;
  border: 1px solid var(--rg-border);
  border-radius: 7px;
  background: var(--rg-surface);
  color: var(--rg-text);
  font-size: 11px;
  padding: 0 6px;
}
.preview-frame {
  flex: 1;
  min-height: 0;
  width: 100%;
  border: 0;
  background: var(--rg-surface-2);
}
.preview-empty {
  display: grid;
  place-items: center;
  gap: 6px;
  flex: 1;
  padding: 24px;
  text-align: center;
  color: var(--rg-text-3);
  font-size: 12px;
}
.preview-empty strong {
  color: var(--rg-text-2);
  font-size: 13px;
}
.studio-foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 14px;
  border-top: 1px solid var(--rg-border);
  background: var(--rg-surface);
}
.foot-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.foot-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.conflict {
  color: var(--rg-warn);
}
.muted {
  color: var(--rg-text-3);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 7px;
  padding: 4px 10px;
  font-size: 11.5px;
  cursor: pointer;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.btn.small,
.btn.tiny {
  min-height: 22px;
  padding: 2px 7px;
  font-size: 10.5px;
}
.btn.primary {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.btn.danger {
  border-color: var(--rg-danger-border);
  color: var(--rg-danger);
}
.btn.danger:hover:not(:disabled) {
  background: var(--rg-danger-soft);
}
.btn.ghost {
  border-color: transparent;
  background: transparent;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.link {
  border: none;
  background: transparent;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  font-size: 10.5px;
  padding: 0;
}
@media (max-width: 1180px) {
  .studio-tabs {
    display: flex;
  }
  .studio-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .studio-left,
  .studio-chat,
  .studio-preview {
    display: none;
    border-right: none;
    border-left: none;
  }
  .studio-left.pane-active {
    display: flex;
  }
  .studio-chat.pane-active {
    display: block;
  }
  .studio-preview.pane-active {
    display: flex;
  }
}
</style>
