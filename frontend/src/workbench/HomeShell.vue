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
        <RgButton
          variant="ghost"
          icon-only
          :icon="settingsStore.theme === 'dark' ? Sunny : Moon"
          :aria-label="themeLabel"
          :title="themeLabel"
          @click="settingsStore.toggleTheme()"
        />
      </div>
    </header>

    <main class="content">
      <section class="hero">
        <h1>从一个应用开始</h1>
        <p>共享工作区、模板与会话：agent 在对话里自主检索材料、修改产物并检查结果。</p>
        <div class="hero-actions">
          <RgButton variant="primary" size="lg" data-testid="home-new-app" @click="dialogOpen = true">新建应用</RgButton>
          <RgButton data-testid="home-template-library" @click="templateOpen = true">模板库</RgButton>
          <RgButton data-testid="home-design-templates" @click="designTemplateOpen = true">设计模板</RgButton>
        </div>
      </section>

      <div class="layout">
        <section class="rg-card apps-card">
          <div class="rg-card__head">
            <h2 class="rg-section-title">最近应用</h2>
            <span class="pill">{{ apps.length }} 个</span>
          </div>

          <StatePanel
            v-if="loading"
            variant="loading"
            skeleton="list"
            :loading-lines="3"
            test-id="home-loading"
            title="正在加载应用"
            compact
          />
          <StatePanel
            v-else-if="error"
            variant="error"
            test-id="home-error"
            title="加载失败"
            description="应用列表暂时不可用，请检查后端服务后重试。"
          >
            <template #actions>
              <RgButton size="sm" @click="refresh">重试</RgButton>
            </template>
            <template #details>
              <pre>{{ error }}</pre>
            </template>
          </StatePanel>
          <StatePanel
            v-else-if="!apps.length"
            variant="empty"
            test-id="home-empty"
            :icon="Plus"
            title="还没有应用"
            description="三步开始："
          >
            <template #examples>
              <ol class="steps">
                <li><span class="step-no">1</span><span>新建应用，生成独立工作区与 EOS 后端起点</span></li>
                <li><span class="step-no">2</span><span>选择需求模板，以及设计模板（应用类型 · 视觉风格）</span></li>
                <li><span class="step-no">3</span><span>在对话里让 agent 写需求、做设计、完成开发实现</span></li>
              </ol>
            </template>
            <template #actions>
              <RgButton variant="primary" @click="dialogOpen = true">新建应用</RgButton>
            </template>
          </StatePanel>
          <ul v-else class="app-list">
            <li
              v-for="app in apps"
              :key="app.id"
              class="app-item rg-card rg-card--sm rg-card--interactive"
              tabindex="0"
              @click="openApp(app)"
              @keydown.enter="openApp(app)"
              @keydown.space.prevent="openApp(app)"
            >
              <div class="app-head">
                <span class="app-mark" aria-hidden="true">{{ initial(app.name) }}</span>
                <strong class="app-name">{{ app.name }}</strong>
                <RgChip :tone="appStatusTone(app.status)" size="sm" class="status">{{ statusLabel(app.status) }}</RgChip>
              </div>
              <div class="app-tpl" data-testid="home-app-templates">
                <span>需求模板：{{ app.requirementTemplateName }}</span>
                <span>{{ designSummary(app) }}</span>
              </div>
              <div class="app-foot">
                <span class="rg-meta">更新于 {{ formatTime(app.updatedAt) }}</span>
                <div class="app-actions">
                  <RgButton size="sm" @click.stop="openApp(app)">打开</RgButton>
                  <el-dropdown trigger="click" placement="bottom-end" @command="() => removeApp(app)">
                    <RgButton
                      size="sm"
                      icon-only
                      :icon="MoreFilled"
                      :disabled="deleting === app.id"
                      aria-label="更多操作"
                      title="更多操作"
                      @click.stop
                    />
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item :disabled="deleting === app.id">删除应用</el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <el-icon class="chevron" aria-hidden="true"><ArrowRight /></el-icon>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <aside class="side">
          <section class="rg-card quick-card">
            <div class="rg-card__head">
              <h2 class="rg-section-title">快捷开始</h2>
            </div>
            <RgButton variant="ghost" class="quick-item" @click="dialogOpen = true">
              <span class="quick-icon"><el-icon><Plus /></el-icon></span>
              <span class="quick-text"><strong>新建应用</strong><small>独立工作区 + 需求/设计模板</small></span>
            </RgButton>
            <RgButton variant="ghost" class="quick-item" @click="templateOpen = true">
              <span class="quick-icon"><el-icon><FolderOpened /></el-icon></span>
              <span class="quick-text"><strong>模板库</strong><small>需求文档模板与同步</small></span>
            </RgButton>
            <RgButton variant="ghost" class="quick-item" @click="designTemplateOpen = true">
              <span class="quick-icon"><el-icon><Brush /></el-icon></span>
              <span class="quick-text"><strong>设计模板</strong><small>应用类型 × 视觉风格 + 页面库</small></span>
            </RgButton>
          </section>

          <section class="rg-card runtime-card" data-testid="home-runtime">
            <div class="rg-card__head">
              <h2 class="rg-section-title">运行状态</h2>
              <RgChip :tone="runtimeTone" size="sm" data-testid="home-runtime-state">{{ runtimeLabel }}</RgChip>
            </div>

            <p class="rg-meta runtime-version">版本 {{ status?.version ?? '—' }}</p>
            <p v-if="runtimeError" class="error">{{ runtimeError }}</p>
            <p v-else-if="status?.installError" class="error">{{ status.installError }}</p>
            <p v-else-if="status?.lastError" class="error">{{ status.lastError }}</p>

            <div class="actions">
              <RgButton size="sm" :disabled="busy" @click="refreshStatus">刷新</RgButton>
              <RgButton
                variant="primary"
                size="sm"
                :disabled="busy || status?.ready || status?.starting"
                :loading="busy || status?.starting"
                @click="startRuntime"
              >
                {{ busy || status?.starting ? '启动中…' : '启动 opencode' }}
              </RgButton>
            </div>

            <details class="diag" data-testid="home-runtime-diagnostics">
              <summary>诊断</summary>
              <dl class="kv">
                <dt>地址</dt>
                <dd><code>{{ status ? `${status.host}:${status.port}` : '—' }}</code></dd>
                <dt>CLI</dt>
                <dd>{{ status?.bin ?? (status?.installed === false ? '未找到 opencode' : status?.installed ? '已安装' : '探测中…') }}</dd>
                <dt>事件流</dt>
                <dd>{{ status?.streamState ?? '—' }}</dd>
              </dl>
            </details>
          </section>
        </aside>
      </div>
    </main>

    <NewAppDialog v-model="dialogOpen" @created="onCreated" />
    <TemplateLibraryDialog v-model="templateOpen" @changed="refresh" />
    <DesignTemplateCenter v-model="designTemplateOpen" mode="browse" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowRight, Brush, FolderOpened, Moon, MoreFilled, Plus, Sunny } from '@element-plus/icons-vue'
import NewAppDialog from './NewAppDialog.vue'
import TemplateLibraryDialog from './TemplateLibraryDialog.vue'
import DesignTemplateCenter from './DesignTemplateCenter.vue'
import StatePanel from '../shared/StatePanel.vue'
import RgButton from '../shared/RgButton.vue'
import RgChip from '../shared/RgChip.vue'
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

/** 运行状态 chip tone：已连接=ok / 启动中=warn / 失败或未安装=danger / 其他=neutral */
const runtimeTone = computed<'ok' | 'warn' | 'danger' | 'neutral'>(() => {
  const current = status.value
  if (!current) return 'neutral'
  if (current.ready) return 'ok'
  if (current.starting) return 'warn'
  if (current.installed === false || current.installError || current.lastError) return 'danger'
  return 'neutral'
})

/** 应用卡状态 chip tone（与顶部外壳状态 chip 一致） */
function appStatusTone(status: string): 'ai' | 'warn' | 'ok' | 'neutral' {
  if (status === 'requirements') return 'ai'
  if (status === 'design') return 'warn'
  if (status === 'development') return 'ok'
  return 'neutral'
}

/** 应用卡标识：名称首字母（无名称回退到 appId 首字母） */
function initial(name: string): string {
  const source = (name || '').trim()
  return source ? source.slice(0, 1).toUpperCase() : '·'
}

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
/* 顶部品牌区：wordmark + 主题切换（入口 CTA 放到 hero/快捷开始，避免重复大动作） */
.topbar {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rg-space-3);
  padding: 0 clamp(16px, 4vw, 28px);
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--rg-space-2);
  min-width: 0;
}
.brand-mark {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--rg-ink);
  color: var(--rg-ink-contrast);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
}
.brand-text {
  display: flex;
  align-items: baseline;
  gap: var(--rg-space-2);
  line-height: 1.25;
  min-width: 0;
}
.brand-text strong {
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
}
.brand-text span {
  font-size: var(--rg-font-caption);
  color: var(--rg-text-3);
  white-space: nowrap;
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--rg-space-2);
  flex-shrink: 0;
}
.content {
  max-width: 1120px;
  margin: 0 auto;
  padding: clamp(28px, 5vw, 48px) clamp(16px, 4vw, 28px) 64px;
}
.hero h1 {
  margin: 0 0 var(--rg-space-2);
  font-size: var(--rg-font-display);
  line-height: var(--rg-leading-title);
  font-weight: 650;
  letter-spacing: -0.3px;
}
.hero p {
  margin: 0;
  max-width: 640px;
  font-size: var(--rg-font-body);
  line-height: var(--rg-leading-body);
  color: var(--rg-text-2);
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rg-space-2);
  margin-top: var(--rg-space-5);
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
  gap: var(--rg-space-4);
  margin-top: var(--rg-space-6);
  align-items: start;
}
.side {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-4);
  min-width: 0;
}
@media (max-width: 1024px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
.pill {
  font-size: 11px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 3px 9px;
  white-space: nowrap;
}
.steps {
  list-style: none;
  margin: 0 0 var(--rg-space-4);
  padding: 0;
  display: grid;
  gap: var(--rg-space-2);
}
.steps li {
  display: flex;
  align-items: flex-start;
  gap: var(--rg-space-2);
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--rg-text-2);
}
.step-no {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  font-size: 11px;
  font-weight: 600;
}
.app-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--rg-space-3);
}
.app-item {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2);
  min-width: 0;
  padding: 16px;
  cursor: pointer;
}
.app-item:hover {
  box-shadow: var(--rg-shadow-1);
}
.app-item:focus-visible {
  outline: 2px solid var(--rg-focus-ring);
  outline-offset: 2px;
}
.app-head {
  display: flex;
  align-items: center;
  gap: var(--rg-space-2);
  min-width: 0;
}
.app-mark {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  font-size: 12px;
  font-weight: 600;
}
.app-name {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.app-tpl {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  font-size: 11.5px;
  color: var(--rg-text-3);
  min-width: 0;
}
.app-tpl span {
  overflow-wrap: anywhere;
}
.app-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rg-space-2);
  min-width: 0;
}
.app-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.12s;
}
.app-item:hover .app-actions,
.app-item:focus .app-actions,
.app-item:focus-within .app-actions {
  opacity: 1;
}
.chevron {
  color: var(--rg-border-strong);
  font-size: 16px;
  line-height: 1;
}
.quick-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.quick-item {
  height: auto;
  justify-content: flex-start;
  width: 100%;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: var(--rg-radius);
  background: transparent;
  text-align: left;
}
.quick-item :deep(.rg-btn__label) {
  display: flex;
  align-items: center;
  gap: var(--rg-space-3);
  width: 100%;
}
.quick-item:hover {
  border-color: var(--rg-border);
  background: var(--rg-hover);
}
.quick-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  color: var(--rg-text-2);
  font-size: 14px;
}
.quick-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.4;
}
.quick-text strong {
  font-size: 13px;
  font-weight: 600;
}
.quick-text small {
  font-size: 11.5px;
  color: var(--rg-text-3);
  overflow-wrap: anywhere;
}
.runtime-card {
  display: flex;
  flex-direction: column;
}
.runtime-version {
  margin: -6px 0 var(--rg-space-3);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rg-space-2);
}
.diag {
  margin-top: var(--rg-space-3);
  border-top: 1px solid var(--rg-border);
  padding-top: var(--rg-space-2);
}
.diag summary {
  font-size: 11.5px;
  color: var(--rg-text-3);
  cursor: pointer;
  list-style: none;
}
.diag summary::-webkit-details-marker {
  display: none;
}
.diag summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 5px;
  transition: transform 0.12s;
}
.diag[open] summary::before {
  transform: rotate(90deg);
}
.kv {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 6px 10px;
  margin: var(--rg-space-2) 0 0;
  font-size: 12px;
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
  .app-actions {
    opacity: 1;
  }
  .layout {
    margin-top: var(--rg-space-5);
  }
}
@media (max-width: 560px) {
  .brand-text span {
    display: none;
  }
  .hero h1 {
    font-size: 22px;
  }
  .rg-card {
    --rg-card-pad: 16px;
  }
}
</style>
