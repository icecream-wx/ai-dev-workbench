<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">AI</span>
        <div class="brand-text">
          <strong>智能开发工作台</strong>
          <span>需求 → 设计 → 开发</span>
        </div>
      </div>
      <div class="topbar-actions">
        <button type="button" class="btn icon" :aria-label="themeLabel" :title="themeLabel" @click="settingsStore.toggleTheme()">
          <svg v-if="settingsStore.theme === 'dark'" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="3.2" />
            <path d="M8 1.4v1.7M8 12.9v1.7M1.4 8h1.7M12.9 8h1.7M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2M12.7 3.3l-1.2 1.2M4.5 11.5l-1.2 1.2" />
          </svg>
          <svg v-else viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13.2 9.8A5.6 5.6 0 0 1 6.2 2.8a5.7 5.7 0 1 0 7 7Z" />
          </svg>
        </button>
        <button type="button" class="btn" data-testid="home-template-library" @click="templateOpen = true">模板库</button>
        <button type="button" class="btn" data-testid="home-design-templates" @click="designTemplateOpen = true">设计模板</button>
        <button type="button" class="btn primary" @click="dialogOpen = true">新建应用</button>
      </div>
    </header>

    <main class="content">
      <section class="hero">
        <h1>从一个应用开始</h1>
        <p>工作台提供共享工作区、模板、会话与三个视图（需求 / 设计 / 开发）；产物以文件为准，agent 在对话里自主检索与修改。</p>
      </section>

      <section class="grid">
        <article class="card list-card">
          <div class="card-head">
            <h2>应用</h2>
            <span class="pill">{{ apps.length }} 个</span>
          </div>

          <div v-if="loading" class="empty"><p class="empty-hint">正在加载应用…</p></div>
          <div v-else-if="error" class="empty">
            <p class="empty-title">加载失败</p>
            <p class="empty-hint">{{ error }}</p>
            <button type="button" class="btn" @click="refresh">重试</button>
          </div>
          <div v-else-if="!apps.length" class="empty">
            <p class="empty-title">还没有应用</p>
            <p class="empty-hint">创建第一个应用，工作台会生成独立的项目目录和 EOS 后端起点。</p>
            <button type="button" class="btn primary" @click="dialogOpen = true">新建应用</button>
          </div>
          <ul v-else class="app-list">
            <li v-for="app in apps" :key="app.id" class="app-item" tabindex="0" @click="openApp(app)" @keydown.enter="openApp(app)" @keydown.space.prevent="openApp(app)">
              <div class="app-main">
                <div class="app-title">
                  <strong>{{ app.name }}</strong>
                  <span :class="['status', app.status]">{{ statusLabel(app.status) }}</span>
                </div>
                <div class="app-meta">
                  <code>{{ app.id }}</code>
                  <span data-testid="home-app-templates">需求模板：{{ app.requirementTemplateName }} · {{ designSummary(app) }}</span>
                  <span>更新于 {{ formatTime(app.updatedAt) }}</span>
                </div>
              </div>
              <button type="button" class="app-delete" :disabled="deleting === app.id" title="删除应用" @click.stop="removeApp(app)">
                {{ deleting === app.id ? '删除中…' : '删除' }}
              </button>
              <span class="chevron">›</span>
            </li>
          </ul>
        </article>

        <article class="card runtime-card">
          <div class="card-head">
            <h2>opencode 运行时</h2>
            <span :class="['dot', status?.ready ? 'ok' : status?.starting ? 'starting' : 'idle']" />
          </div>

          <dl class="kv">
            <dt>状态</dt>
            <dd>{{ runtimeLabel }}</dd>
            <dt>地址</dt>
            <dd><code>{{ status ? `${status.host}:${status.port}` : '—' }}</code></dd>
            <dt>CLI</dt>
            <dd>{{ status?.bin ?? (status?.installed === false ? '未找到 opencode' : status?.installed ? '已安装' : '探测中…') }}</dd>
            <dt>版本</dt>
            <dd>{{ status?.version ?? '—' }}</dd>
            <dt>事件流</dt>
            <dd>{{ status?.streamState ?? '—' }}</dd>
          </dl>

          <p v-if="runtimeError" class="error">{{ runtimeError }}</p>
          <p v-else-if="status?.installError" class="error">{{ status.installError }}</p>
          <p v-else-if="status?.lastError" class="error">{{ status.lastError }}</p>

          <div class="actions">
            <button type="button" class="btn" :disabled="busy" @click="refreshStatus">刷新</button>
            <button
              type="button"
              class="btn primary"
              :disabled="busy || status?.ready || status?.starting"
              @click="startRuntime"
            >
              {{ busy || status?.starting ? '启动中…' : '启动 opencode' }}
            </button>
          </div>
        </article>
      </section>
    </main>

    <NewAppDialog v-model="dialogOpen" @created="onCreated" />
    <TemplateLibraryDialog v-model="templateOpen" @changed="refresh" />
    <DesignTemplateCenter v-model="designTemplateOpen" mode="browse" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import NewAppDialog from './NewAppDialog.vue'
import TemplateLibraryDialog from './TemplateLibraryDialog.vue'
import DesignTemplateCenter from './DesignTemplateCenter.vue'
import { appRoute, deleteApp, listApps, type AppInfo } from './api'
import { statusLabel } from './view-helpers.js'
import { useSettingsStore } from '../settings/store'

interface RuntimeStatus {
  ready: boolean
  starting: boolean
  installed: boolean | null
  autoStart: boolean
  autoStartAttempted: boolean
  host: string
  port: number
  bin: string | null
  version: string | null
  streamState: string
  lastError: string | null
  installError: string | null
  passwordCaptured: boolean
}

const apps = ref<AppInfo[]>([])
const status = ref<RuntimeStatus | null>(null)
const loading = ref(false)
const busy = ref(false)
const deleting = ref('')
const error = ref('')
const runtimeError = ref('')
const dialogOpen = ref(false)
const templateOpen = ref(false)
const designTemplateOpen = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollCount = 0

const settingsStore = useSettingsStore()
const themeLabel = computed(() => (settingsStore.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'))

const runtimeLabel = computed(() => {
  const current = status.value
  if (!current) return '—'
  if (current.ready) return '已连接'
  if (current.starting) return '启动中…'
  if (current.installed === false) return '未安装'
  if (current.installError || current.lastError) return '启动失败'
  return '未启动'
})

function formatTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

/** 应用摘要：设计模板（应用类型 · 风格；自定义模板带版本与来源） */
function designSummary(app: AppInfo): string {
  const design = app.designSystem
  if (design?.applicationType && design.style) {
    const custom = design.origin?.kind === 'custom' || design.pack?.source === 'custom'
    const version = custom && design.pack?.version ? ` v${design.pack.version}` : ''
    return `设计模板：${design.applicationType.name}${version}${custom ? '（自定义）' : ''} · ${design.style.name}`
  }
  return '设计模板：默认（应用类型 · 风格）'
}

async function refresh(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    apps.value = await listApps()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function fetchStatus(): Promise<void> {
  try {
    const res = await fetch('/api/opencode/health')
    if (res.ok) status.value = (await res.json()) as RuntimeStatus
  } catch (err) {
    runtimeError.value = err instanceof Error ? err.message : String(err)
  }
}

function shouldPoll(): boolean {
  const current = status.value
  if (!current || current.ready) return false
  if (current.starting) return true
  return current.autoStart && !current.autoStartAttempted && current.installed !== false && !current.lastError && !current.installError
}

function schedulePoll(): void {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = null
  if (!shouldPoll() || pollCount >= 80) return
  pollCount += 1
  pollTimer = setTimeout(async () => {
    await fetchStatus()
    schedulePoll()
  }, 1500)
}

async function refreshStatus(): Promise<void> {
  runtimeError.value = ''
  await fetchStatus()
  await refresh()
  pollCount = 0
  schedulePoll()
}

async function startRuntime(): Promise<void> {
  busy.value = true
  runtimeError.value = ''
  try {
    const res = await fetch('/api/opencode/start', { method: 'POST' })
    const data = (await res.json()) as RuntimeStatus & { error?: string }
    if (!res.ok) throw new Error(data.error || `启动失败（HTTP ${res.status}）`)
    status.value = data
  } catch (err) {
    runtimeError.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
    schedulePoll()
  }
}

function openApp(app: AppInfo): void {
  window.location.hash = appRoute(app)
}

function onCreated(app: AppInfo): void {
  window.location.hash = appRoute(app)
}

async function removeApp(app: AppInfo): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除应用「${app.name}」（${app.id}）？\n将删除本地目录 projects/${app.id}、应用登记、需求文档、对话、交接包与开发会话登记，不可恢复；不会处理远端数据库或已部署服务。`,
      '删除应用',
      { type: 'error', confirmButtonText: '删除应用', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  deleting.value = app.id
  try {
    await deleteApp(app.id)
    apps.value = apps.value.filter(item => item.id !== app.id)
    ElMessage.success(`应用「${app.name}」已删除`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    deleting.value = ''
  }
}

onMounted(() => {
  void refresh()
  void refreshStatus()
})

onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer)
})
</script>

<style scoped>
.shell {
  min-height: 100vh;
  background: var(--rg-bg);
  color: var(--rg-text);
  font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.topbar {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px clamp(16px, 4vw, 28px);
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.brand-mark {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--rg-ink);
  color: var(--rg-ink-contrast);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.4px;
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}
.brand-text strong {
  font-size: 13.5px;
  font-weight: 600;
}
.brand-text span {
  font-size: 11px;
  color: var(--rg-text-3);
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.content {
  max-width: 1040px;
  margin: 0 auto;
  padding: clamp(28px, 5vw, 56px) clamp(16px, 4vw, 28px) 72px;
}
.hero h1 {
  margin: 0 0 10px;
  font-size: clamp(22px, 3vw, 28px);
  font-weight: 650;
  letter-spacing: -0.3px;
}
.hero p {
  margin: 0;
  max-width: 640px;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--rg-text-2);
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
  gap: 18px;
  margin-top: 34px;
}
@media (max-width: 1024px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.card {
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius-lg);
  padding: 20px;
  min-height: 210px;
  min-width: 0;
  box-shadow: var(--rg-shadow-1);
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 16px;
}
.card-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.pill {
  font-size: 11px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 3px 9px;
  white-space: nowrap;
}
.empty {
  border: 1px dashed var(--rg-border-strong);
  border-radius: var(--rg-radius);
  padding: 22px;
  background: var(--rg-surface-2);
}
.empty-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
}
.empty-hint {
  margin: 0 0 10px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--rg-text-3);
}
.app-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
}
.app-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  background: var(--rg-surface);
  cursor: pointer;
  transition: background-color 0.12s, border-color 0.12s, box-shadow 0.12s;
}
.app-item:hover {
  background: var(--rg-hover);
  border-color: var(--rg-border-strong);
  box-shadow: var(--rg-shadow-1);
}
.app-item:focus-visible {
  outline: 2px solid var(--rg-focus-ring);
  outline-offset: 2px;
}
.app-main {
  flex: 1;
  min-width: 0;
}
.app-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  min-width: 0;
}
.app-title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 5px;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.status {
  flex-shrink: 0;
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.status.requirements {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.status.design {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.status.development {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.status.completed {
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.chevron {
  color: var(--rg-border-strong);
  font-size: 20px;
}
.app-delete {
  flex-shrink: 0;
  min-height: 28px;
  border: 1px solid var(--rg-danger-border);
  background: var(--rg-surface);
  color: var(--rg-danger);
  border-radius: 7px;
  padding: 4px 9px;
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s, background-color 0.12s;
}
.app-item:hover .app-delete,
.app-item:focus-within .app-delete,
.app-item:focus .app-delete {
  opacity: 1;
}
.app-delete:hover:not(:disabled) {
  background: var(--rg-danger-soft);
}
.app-delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.kv {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px 10px;
  margin: 0 0 16px;
  font-size: 12.5px;
}
.kv dt {
  color: var(--rg-text-3);
}
.kv dd {
  margin: 0;
  color: var(--rg-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
}
code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11.5px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  border-radius: 4px;
  padding: 1px 5px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--rg-text-3);
}
.dot.ok {
  background: var(--rg-ok);
}
.dot.starting {
  background: var(--rg-warn);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.btn.primary {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.btn.primary:hover:not(:disabled) {
  background: var(--rg-ink-hover);
  border-color: var(--rg-ink-hover);
  color: var(--rg-ink-contrast);
}
.btn.icon {
  width: 32px;
  padding: 0;
  border-color: var(--rg-border);
}
.btn.icon svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.error {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border: 1px solid var(--rg-danger-border);
  border-radius: 8px;
  padding: 8px 10px;
}
@media (max-width: 768px) {
  .app-delete {
    opacity: 1;
  }
  .app-list {
    grid-template-columns: minmax(0, 1fr);
  }
  .grid {
    margin-top: 24px;
  }
}
</style>
