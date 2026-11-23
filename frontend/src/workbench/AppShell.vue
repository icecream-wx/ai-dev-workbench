<template>
  <div class="app-shell">
    <header class="appbar">
      <a class="back" href="#/" title="返回应用列表">← 应用</a>
      <div class="title">
        <strong>{{ app?.name ?? appId }}</strong>
        <code>{{ appId }}</code>
      </div>

      <nav class="views" aria-label="视图">
        <button
          v-for="view in VIEWS"
          :key="view"
          type="button"
          :class="['view', { active: currentView === view }]"
          @click="navigate(view)"
        >
          {{ viewLabel(view) }}
        </button>
      </nav>

      <div class="bar-actions">
        <span v-if="app" class="status-text">{{ requirementLabel }}</span>
        <button type="button" class="btn" title="选择 opencode 模型" @click="settingsOpen = true">模型</button>
        <button type="button" class="btn danger" title="删除应用（本地目录与登记）" @click="removeApp">删除应用</button>
        <button type="button" class="btn icon" :aria-label="themeLabel" :title="themeLabel" @click="settingsStore.toggleTheme()">
          <svg v-if="settingsStore.theme === 'dark'" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="3.2" />
            <path d="M8 1.4v1.7M8 12.9v1.7M1.4 8h1.7M12.9 8h1.7M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2M12.7 3.3l-1.2 1.2M4.5 11.5l-1.2 1.2" />
          </svg>
          <svg v-else viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13.2 9.8A5.6 5.6 0 0 1 6.2 2.8a5.7 5.7 0 1 0 7 7Z" />
          </svg>
        </button>
      </div>
    </header>

    <main class="app-body">
      <div v-if="loading" class="center-card">正在加载应用…</div>
      <div v-else-if="error" class="center-card">
        <p class="error">{{ error }}</p>
        <a class="btn" href="#/">返回应用列表</a>
      </div>
      <DevView v-else-if="currentView === 'development'" :app-id="appId" @app-changed="refreshApp" />
      <RequirementsView v-else-if="currentView === 'requirements'" :app-id="appId" />
      <DesignView v-else :app-id="appId" />
    </main>
    <SettingsDialog v-model="settingsOpen" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import SettingsDialog from '../settings/SettingsDialog.vue'
import { useSettingsStore } from '../settings/store'
import DevView from '../dev/DevView.vue'
import DesignView from './DesignView.vue'
import RequirementsView from './RequirementsView.vue'
import { deleteApp, getApp, setAppView, viewFromStatus, viewLabel, type AppInfo, type AppView } from './api'

const props = defineProps<{ appId: string; stage?: string }>()

const settingsStore = useSettingsStore()
const themeLabel = computed(() => (settingsStore.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'))

const VIEWS: AppView[] = ['requirements', 'design', 'development']
const app = ref<AppInfo | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const settingsOpen = ref(false)

/** 顶部状态行：需求模板 · 设计模板（应用类型 · 风格；自定义带版本与来源） */
const requirementLabel = computed(() => {
  const current = app.value
  if (!current) return ''
  const design = current.designSystem
  let designText = ''
  if (design?.applicationType && design.style) {
    const custom = design.origin?.kind === 'custom' || design.pack?.source === 'custom'
    const version = custom && design.pack?.version ? ` v${design.pack.version}` : ''
    designText = `${design.applicationType.name}${version}${custom ? '（自定义）' : ''} · ${design.style.name}`
  }
  return [current.requirementTemplateName, designText].filter(Boolean).join(' · ')
})

function isView(value: string | undefined): value is AppView {
  return value === 'requirements' || value === 'design' || value === 'development'
}

/** 视图只做导航：没有任何锁定/推进条件 */
const currentView = computed<AppView>(() => {
  if (isView(props.stage)) return props.stage
  if (app.value) return viewFromStatus(app.value.status)
  return 'requirements'
})

function navigate(view: AppView): void {
  window.location.hash = `#/apps/${encodeURIComponent(props.appId)}/${view}`
  // 只记录“当前所在视图”，无门禁语义；失败不影响导航
  void setAppView(props.appId, view).catch(() => undefined)
}

async function refreshApp(): Promise<void> {
  try {
    app.value = await getApp(props.appId)
  } catch {
    // 保留当前状态
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    app.value = await getApp(props.appId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function removeApp(): Promise<void> {
  if (!app.value) return
  try {
    await ElMessageBox.confirm(
      `删除应用「${app.value.name}」（${props.appId}）？\n将删除本地目录 projects/${props.appId}、应用登记与会话记录，不可恢复；不会处理远端数据库或已部署服务。`,
      '删除应用',
      { type: 'error', confirmButtonText: '删除应用', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  busy.value = true
  try {
    await deleteApp(props.appId)
    ElMessage.success('应用已删除')
    window.location.hash = '#/'
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    busy.value = false
  }
}

watch(
  () => props.appId,
  () => void load()
)

watch(
  () => props.stage,
  () => {
    if (!loading.value) void refreshApp()
  }
)

onMounted(() => void load())
</script>

<style scoped>
.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--rg-bg);
  color: var(--rg-text);
  font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.appbar {
  min-height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
  z-index: 10;
}
.back {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  font-size: 12.5px;
  color: var(--rg-text-2);
  text-decoration: none;
  border: 1px solid var(--rg-border);
  border-radius: 7px;
  padding: 5px 9px;
  white-space: nowrap;
}
.back:hover {
  color: var(--rg-text);
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  max-width: 240px;
}
.title strong {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.title code {
  font-size: 11px;
  color: var(--rg-text-3);
  white-space: nowrap;
}
.views {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.view {
  flex-shrink: 0;
  min-height: 30px;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 12.5px;
  cursor: pointer;
}
.view:hover {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.view.active {
  border-color: var(--rg-ink);
  color: var(--rg-text);
  font-weight: 600;
  box-shadow: 0 0 0 3px var(--rg-ai-soft);
}
.bar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.status-text {
  font-size: 11.5px;
  color: var(--rg-text-3);
  white-space: nowrap;
}
.app-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.app-body > :deep(.rg-app) {
  flex: 1;
  min-width: 0;
}
.center-card {
  margin: 60px auto;
  align-self: flex-start;
  min-width: 320px;
  max-width: 560px;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--rg-text-2);
}
.error {
  color: var(--rg-danger);
  white-space: pre-wrap;
  line-height: 1.6;
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
  text-decoration: none;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.btn.danger {
  color: var(--rg-danger);
  border-color: var(--rg-danger-border);
}
.btn.danger:hover:not(:disabled) {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.btn.icon {
  width: 32px;
  padding: 0;
  border-color: var(--rg-border);
  color: var(--rg-text-2);
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
@media (max-width: 1024px) {
  .appbar {
    flex-wrap: wrap;
    row-gap: 8px;
    padding: 8px 14px;
  }
  .views {
    order: 3;
    flex-basis: 100%;
    justify-content: flex-start;
  }
  .bar-actions {
    margin-left: auto;
  }
  .status-text {
    display: none;
  }
}
</style>
