<template>
  <div class="app-shell">
    <header class="appbar">
      <div class="bar-left">
        <a class="rg-btn rg-btn--ghost rg-btn--icon" href="#/" aria-label="返回应用列表" title="返回应用列表">
          <el-icon class="rg-btn__icon"><ArrowLeft /></el-icon>
        </a>
        <span class="app-mark" aria-hidden="true">{{ appInitial }}</span>
        <strong class="app-name" :title="appTitle">{{ app?.name ?? appId }}</strong>
        <RgChip
          v-if="app"
          :tone="statusTone"
          class="app-status"
          data-testid="app-status"
        >
          {{ statusText }}
        </RgChip>
      </div>

      <nav class="views" aria-label="应用视图" data-testid="app-view-nav">
        <button
          v-for="view in VIEWS"
          :key="view"
          type="button"
          :class="['view', { active: currentView === view }]"
          :aria-current="currentView === view ? 'page' : undefined"
          :title="`${viewLabel(view)}视图`"
          @click="navigate(view)"
        >
          <el-icon class="view-icon"><component :is="VIEW_ICONS[view]" /></el-icon>
          <span>{{ viewLabel(view) }}</span>
        </button>
      </nav>

      <div class="bar-actions">
        <RgChip
          v-if="app && requirementLabel"
          tone="neutral"
          :dot="false"
          class="design-chip"
          :title="requirementLabel"
          data-testid="app-design-chip"
        >
          {{ requirementLabel }}
        </RgChip>
        <RgButton variant="ghost" :icon="Cpu" title="选择 opencode 模型" @click="settingsOpen = true">
          模型
        </RgButton>
        <RgButton
          variant="ghost"
          icon-only
          :icon="settingsStore.theme === 'dark' ? Sunny : Moon"
          :aria-label="themeLabel"
          :title="themeLabel"
          @click="settingsStore.toggleTheme()"
        />
        <el-dropdown trigger="click" placement="bottom-end" @command="onMoreCommand">
          <RgButton
            variant="ghost"
            icon-only
            :icon="MoreFilled"
            data-testid="app-more"
            aria-label="更多操作"
            title="更多操作"
          />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="settings">设置</el-dropdown-item>
              <el-dropdown-item command="delete" divided data-testid="app-delete">删除应用</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
import { ArrowLeft, Brush, Cpu, Document, Monitor, Moon, MoreFilled, Sunny } from '@element-plus/icons-vue'
import RgButton from '../shared/RgButton.vue'
import RgChip from '../shared/RgChip.vue'
import SettingsDialog from '../settings/SettingsDialog.vue'
import { useSettingsStore } from '../settings/store'
import DevView from '../dev/DevView.vue'
import DesignView from './DesignView.vue'
import RequirementsView from './RequirementsView.vue'
import { deleteApp, getApp, setAppView, viewFromStatus, viewLabel, type AppInfo, type AppView } from './api'
import { statusLabel } from './view-helpers.js'

const props = defineProps<{ appId: string; stage?: string }>()

const settingsStore = useSettingsStore()
const themeLabel = computed(() => (settingsStore.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'))

const VIEWS: AppView[] = ['requirements', 'design', 'development']
const VIEW_ICONS = { requirements: Document, design: Brush, development: Monitor } as const
const app = ref<AppInfo | null>(null)
const loading = ref(true)
const error = ref('')
const settingsOpen = ref(false)

/** 应用标识：名称首字母；无应用/空名回退到 appId */
const appInitial = computed(() => {
  const source = (app.value?.name ?? props.appId ?? '').trim()
  return source ? source.slice(0, 1).toUpperCase() : '·'
})

/** 应用名 tooltip 同时带 appId（不再把 appId 作为主行 raw 文本） */
const appTitle = computed(() => {
  const name = app.value?.name ?? props.appId
  return `${name}（${props.appId}）`
})

/** 状态 chip：只表示“当前所在视图”，无门禁语义（“需求中/设计中/开发中”，避免与视图标题栏重复） */
const STATUS_CHIP: Record<string, string> = {
  requirements: '需求中',
  design: '设计中',
  development: '开发中',
  completed: '已完成'
}
const statusText = computed(() => {
  if (!app.value) return ''
  return STATUS_CHIP[app.value.status] ?? statusLabel(app.value.status)
})
/** 状态 chip tone：需求=AI 紫 / 设计=警告橙 / 开发=完成绿 / 其他=中性 */
const statusTone = computed<'ai' | 'warn' | 'ok' | 'neutral'>(() => {
  const status = app.value?.status
  if (status === 'requirements') return 'ai'
  if (status === 'design') return 'warn'
  if (status === 'development') return 'ok'
  return 'neutral'
})

/** 设计模板/风格摘要（原状态行内容，收进右侧 chip，hover 显示完整） */
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

/** 更多菜单：设置（打开模型设置对话框）与危险项删除 */
function onMoreCommand(command: string | number | object): void {
  if (command === 'settings') {
    settingsOpen.value = true
    return
  }
  if (command === 'delete') void removeApp()
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
  try {
    await deleteApp(props.appId)
    ElMessage.success('应用已删除')
    window.location.hash = '#/'
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
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
/* 顶部应用栏：56px 三区（左=返回+应用标识 / 中=视图导航 / 右=设置与更多） */
.appbar {
  min-height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--rg-space-3);
  padding: 0 var(--rg-space-4);
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
  z-index: 10;
}
.bar-left,
.bar-actions {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--rg-space-2);
}
.bar-actions {
  justify-content: flex-end;
}
.app-mark {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--rg-ink);
  color: var(--rg-ink-contrast);
  font-size: 12px;
  font-weight: 700;
}
.app-name {
  min-width: 0;
  max-width: 240px;
  font-size: var(--rg-font-body);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 视图导航：文字 + 小图标，active 用实心墨色下划线 */
.views {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: var(--rg-space-1);
}
.view {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px 2px;
  border: 0;
  border-radius: var(--rg-radius-sm);
  background: transparent;
  color: var(--rg-text-2);
  font-size: 13.5px;
  cursor: pointer;
}
.view-icon {
  font-size: 14px;
  color: var(--rg-text-3);
}
.view::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 0;
  height: 2px;
  border-radius: 2px;
  background: transparent;
}
.view:hover {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.view:hover .view-icon {
  color: var(--rg-text-2);
}
.view.active {
  color: var(--rg-text);
  font-weight: 600;
}
.view.active .view-icon {
  color: var(--rg-ai);
}
.view.active::after {
  background: var(--rg-ink);
}
/* 设计模板/风格摘要 chip：只约束宽度，外观由 RgChip 统一 */
.design-chip {
  max-width: 320px;
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
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 1024px) {
  .appbar {
    flex-wrap: wrap;
    row-gap: var(--rg-space-1);
    padding: var(--rg-space-2) var(--rg-space-3);
  }
  .views {
    order: 3;
    flex-basis: 100%;
    justify-content: flex-start;
    border-top: 1px solid var(--rg-border);
    padding-top: var(--rg-space-1);
  }
  .design-chip {
    display: none;
  }
  .app-name {
    max-width: 200px;
  }
}
@media (max-width: 560px) {
  .appbar {
    gap: var(--rg-space-2);
  }
  .app-name {
    max-width: 120px;
  }
  .app-status {
    display: none;
  }
  .view {
    padding: 0 8px 2px;
    font-size: 13px;
  }
  .view::after {
    left: 8px;
    right: 8px;
  }
}
</style>
