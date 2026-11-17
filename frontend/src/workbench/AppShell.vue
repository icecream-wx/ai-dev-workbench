<template>
  <div class="app-shell">
    <header class="appbar">
      <a class="back" href="#/" title="返回应用列表">← 应用</a>
      <div class="title">
        <strong>{{ app?.name ?? appId }}</strong>
        <code>{{ appId }}</code>
      </div>

      <nav class="stages" aria-label="阶段">
        <template v-for="(stage, index) in STAGES" :key="stage">
          <span v-if="index > 0" class="arrow">›</span>
          <button
            type="button"
            :class="['stage', stageState(stage), { active: currentStage === stage }]"
            :disabled="stageState(stage) === 'locked'"
            @click="navigate(stage)"
          >
            <span class="mark">{{ stageState(stage) === 'done' ? '✓' : index + 1 }}</span>
            {{ stageLabel(stage) }}
          </button>
        </template>
      </nav>

      <div class="bar-actions">
        <span v-if="app" :class="['cs-chip', { active: Boolean(app.activeChangeSet) }]">{{ chipLabel }}</span>
        <span class="status-text">{{ app ? statusText : '加载中…' }}</span>
        <button v-if="showStartChangeSet" type="button" class="btn" title="发起需求/设计变更" @click="startChangeSetOpen = true">
          发起变更
        </button>
        <button v-if="showChangeHistory" type="button" class="btn" title="查看变更单历史与差异摘要" @click="changeSetHistoryOpen = true">
          变更历史
        </button>
        <button v-if="showHandoff" type="button" class="btn" title="查看/预览/生成开发交接包" @click="openHandoff()">
          交接包
        </button>
        <button type="button" class="btn" title="选择 opencode 模型" @click="settingsOpen = true">模型</button>
        <button type="button" class="btn danger" title="删除应用（本地目录/登记/会话/交接包）" @click="removeApp">删除应用</button>
        <button v-if="confirmLabel" type="button" class="btn primary" :disabled="busy" @click="confirmCurrent">
          {{ busy ? '处理中…' : confirmLabel }}
        </button>
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
      <DevView
        v-else-if="currentStage === 'development'"
        :app-id="appId"
        :completed="app?.status === 'completed'"
        @open-handoff="openHandoff"
        @app-changed="refreshApp"
      />
      <RequirementsDocView
        v-else-if="currentStage === 'requirements'"
        :app-id="appId"
        :app-name="app?.name ?? appId"
        :app-status="app?.status ?? 'requirements'"
        :active-change-set="app?.activeChangeSet ?? null"
        @confirmed="onRequirementsConfirmed"
        @reopened="refreshApp"
        @open-change-set="startChangeSetOpen = true"
      />
      <DesignStudio
        v-else
        :app-id="appId"
        :app-name="app?.name ?? appId"
        :app-status="app?.status ?? 'design'"
        :active-change-set="app?.activeChangeSet ?? null"
        @changed="refreshApp"
        @requirements-changed="onDesignRequirementsChanged"
        @scope-upgraded="onChangeSetScopeUpgraded"
        @entered-development="onEnteredDevelopment"
      />
    </main>
    <SettingsDialog v-model="settingsOpen" />
    <DesignHandoffDialog
      v-model="designHandoffOpen"
      :app-id="appId"
      mode="view"
      :initial-file="handoffInitialFile"
      :can-generate="canGenerateHandoffValue"
      :active-change-set="app?.activeChangeSet ?? null"
      @generated="onDesignHandoffGenerated"
    />
    <ChangeSetStartDialog v-model="startChangeSetOpen" :app="app" @started="onChangeSetStarted" />
    <ChangeSetHistoryDialog
      v-model="changeSetHistoryOpen"
      :app-id="appId"
      @changed="refreshApp"
      @cancelled="onChangeSetCancelled"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import SettingsDialog from '../settings/SettingsDialog.vue'
import { useSettingsStore } from '../settings/store'
import ChangeSetStartDialog from '../changesets/ChangeSetStartDialog.vue'
import ChangeSetHistoryDialog from '../changesets/ChangeSetHistoryDialog.vue'
import DevView from '../dev/DevView.vue'
import RequirementsDocView from '../requirements/RequirementsDocView.vue'
import DesignStudio from '../design/DesignStudio.vue'
import DesignHandoffDialog from '../design/DesignHandoffDialog.vue'
import type { DesignHandoffMeta } from '../design/api'
import { appChipLabel, canGenerateHandoff, canStartChangeSet } from '../changesets/labels.js'
import { readStoredModuleId, resolveInitialModule, writeStoredModuleId } from '../requirements/module-helpers.js'
import { readStoredDesignModuleId, resolveDesignModuleId, writeStoredDesignModuleId } from '../design/design-module-helpers.js'
import type { ChangeSetCancelResult, ChangeSetStartResult } from '../changesets/api'
import {
  completeApp,
  deleteApp,
  getApp,
  stageFromStatus,
  stageLabel,
  type AppInfo,
  type AppStage,
  type StageState
} from './api'

const props = defineProps<{ appId: string; stage?: string }>()

const settingsStore = useSettingsStore()
const themeLabel = computed(() => (settingsStore.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'))

const STAGES: AppStage[] = ['requirements', 'design', 'development']

const app = ref<AppInfo | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const settingsOpen = ref(false)
const designHandoffOpen = ref(false)
const startChangeSetOpen = ref(false)
const changeSetHistoryOpen = ref(false)
const handoffInitialFile = ref('')

function isAppStage(value: string | undefined): value is AppStage {
  return value === 'requirements' || value === 'design' || value === 'development'
}

function stageState(stage: AppStage): StageState {
  if (!app.value) return stage === 'requirements' ? 'current' : 'locked'
  return app.value.stages[stage] ?? 'locked'
}

/** 路由 stage 未锁定则采用，否则回退到当前状态对应阶段 */
const currentStage = computed<AppStage>(() => {
  if (!app.value) return isAppStage(props.stage) ? props.stage : 'requirements'
  const fallback = stageFromStatus(app.value.status)
  if (!isAppStage(props.stage)) return fallback
  return app.value.stages[props.stage] === 'locked' ? fallback : props.stage
})

const statusText = computed(() => {
  if (!app.value) return ''
  const { status, requirementDoc, designProject } = app.value
  if (status === 'design' && designProject) {
    return `设计阶段 · v${designProject.version} · 实体 ${designProject.entityCount} / 页面集 ${designProject.pageSetCount}`
  }
  const stageText =
    status === 'completed' ? '已确认完成' : status === 'development' ? '开发阶段' : status === 'design' ? '设计阶段' : '需求阶段'
  const docText = requirementDoc
    ? `文档 v${requirementDoc.version} · ${requirementDoc.status === 'confirmed' ? '已确认' : '草稿'}`
    : '文档未创建'
  return `${stageText} · ${docText}`
})

/** 需求完成后才显示交接包入口（开发/完成阶段可查看/重新生成；设计阶段在 Studio 内生成） */
const showHandoff = computed(
  () => Boolean(app.value && (app.value.status === 'development' || app.value.status === 'completed'))
)

/** 变更单 chip：初始开发 / 变更 #N · 阶段 / 已完成 / 开发中 */
const chipLabel = computed(() => appChipLabel(app.value))

/** 发起变更：开发中/已完成且没有 active 变更单 */
const showStartChangeSet = computed(() => canStartChangeSet(app.value))

/** 变更历史：已有交接包（首次开发后才有变更单） */
const showChangeHistory = computed(() => Boolean(app.value && app.value.handoff))

/** 交接包是否允许生成：有 active 变更单，或还没有任何交接包（首次 #1） */
const canGenerateHandoffValue = computed(() => canGenerateHandoff(app.value))

/** 需求/设计确认由文档视图与 DesignStudio 负责；顶栏只保留“确认完成开发” */
const confirmLabel = computed(() => {
  if (!app.value || busy.value) return ''
  if (app.value.status === 'development' && currentStage.value === 'development') return '确认完成开发'
  return ''
})

function navigate(stage: AppStage): void {
  if (stageState(stage) === 'locked') {
    ElMessage.warning('请先完成前一阶段')
    return
  }
  window.location.hash = `#/apps/${encodeURIComponent(props.appId)}/${stage}`
}

function openHandoff(file?: string): void {
  handoffInitialFile.value = file?.trim() ?? ''
  designHandoffOpen.value = true
}

async function onDesignHandoffGenerated(result: {
  handoff: DesignHandoffMeta
  developmentStarted: boolean
  warnings: string[]
}): Promise<void> {
  await refreshApp()
  if (result.warnings.length) {
    ElMessage.warning(`交接包 v${result.handoff.version} 已生成，有 ${result.warnings.length} 条提示`)
  } else {
    ElMessage.success(`交接包 v${result.handoff.version} 已生成`)
  }
}

/** 设计 Studio 生成交接包并进入开发：刷新应用状态后跳转开发页 */
async function onEnteredDevelopment(): Promise<void> {
  await refreshApp()
  ElMessage.success('已生成交接包并进入开发阶段')
  navigate('development')
}

/** 发起变更成功：按 scope 跳到需求或设计阶段 */
async function onChangeSetStarted(result: ChangeSetStartResult): Promise<void> {
  app.value = result.app
  if (result.changeSet.scope === 'design') {
    navigate('design')
    return
  }
  navigate('requirements')
}

/** 取消变更成功：应用/需求/设计已恢复基线 */
async function onChangeSetCancelled(result: ChangeSetCancelResult): Promise<void> {
  app.value = result.app
  const count = result.restored.modules?.length ?? 0
  // MF-M5-1：变更中新增的模块会被归档；若当前选中模块被归档，按既有回退逻辑切到默认模块
  const archivedIds = new Set(
    (result.restored.modules ?? []).filter(module => module.archived).map(module => module.moduleId)
  )
  if (archivedIds.size) {
    const storage = (() => {
      try {
        return window.localStorage
      } catch {
        return null
      }
    })()
    const modules = result.app.requirementModules ?? []
    let switched = false
    const storedRequirement = readStoredModuleId(storage, props.appId)
    if (storedRequirement && archivedIds.has(storedRequirement)) {
      const resolved = resolveInitialModule(modules, { storedId: storedRequirement })
      if (resolved.moduleId) {
        writeStoredModuleId(storage, props.appId, resolved.moduleId)
        switched = true
      }
    }
    const storedDesign = readStoredDesignModuleId(storage, props.appId)
    if (storedDesign && archivedIds.has(storedDesign)) {
      const resolved = resolveDesignModuleId(modules, { storedId: storedDesign })
      if (resolved.moduleId) {
        writeStoredDesignModuleId(storage, props.appId, resolved.moduleId)
        switched = true
      }
    }
    if (switched) ElMessage.info('当前选中模块已被归档（内容保留，可之后恢复），已切换到默认模块')
  }
  ElMessage.success(
    `变更 #${result.changeSet.seq} 已取消，已恢复${count ? ` ${count} 个模块` : '基线'}与上一版完成时间`
  )
  navigate('development')
}

/** 仅设计变更升级为需求+设计：刷新后回到需求阶段 */
async function onChangeSetScopeUpgraded(): Promise<void> {
  await refreshApp()
  ElMessage.info('已升级为“需求+设计”变更；请修改并确认需求，再同步设计输入')
  navigate('requirements')
}

/** 开发页/交接包生成后静默刷新应用状态，避免整页 loading 把开发会话卸载 */
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

function handleApiError(err: unknown): void {
  ElMessage.error(err instanceof Error ? err.message : String(err))
}

async function completeDevelopment(): Promise<void> {
  try {
    await ElMessageBox.confirm('确认开发已完成？此操作只记录完成状态，不检查 Git / 证据 / 测试门禁。', '确认完成开发', {
      type: 'warning',
      confirmButtonText: '确认完成',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  busy.value = true
  try {
    app.value = await completeApp(props.appId)
    ElMessage.success('已记录开发完成')
  } catch (err) {
    handleApiError(err)
  } finally {
    busy.value = false
  }
}

function confirmCurrent(): void {
  if (app.value?.status === 'development' && currentStage.value === 'development') void completeDevelopment()
}

/** 需求文档确认后：刷新应用状态并询问是否进入设计阶段 */
async function onRequirementsConfirmed(): Promise<void> {
  await refreshApp()
  const enter = await ElMessageBox.confirm('需求已确认，已进入设计阶段，是否立即进入？', '需求完成', {
    type: 'success',
    confirmButtonText: '进入设计',
    cancelButtonText: '稍后'
  })
    .then(() => true)
    .catch(() => false)
  if (enter) navigate('design')
}

/** 设计阶段「重新编辑需求」：应用回到 requirements，刷新后跳转 */
async function onDesignRequirementsChanged(): Promise<void> {
  await refreshApp()
  ElMessage.info('需求已回到草稿，可以继续编辑；重新确认需求后再回设计阶段同步设计输入')
  navigate('requirements')
}

async function removeApp(): Promise<void> {
  if (!app.value) return
  try {
    await ElMessageBox.confirm(
      `删除应用「${app.value.name}」（${props.appId}）？\n将删除本地目录 projects/${props.appId}、应用登记、需求文档、对话、交接包与开发会话登记，不可恢复；不会处理远端数据库或已部署服务。`,
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
    handleApiError(err)
  } finally {
    busy.value = false
  }
}

watch(
  currentStage,
  () => {
    if (app.value && isAppStage(props.stage) && app.value.stages[props.stage] === 'locked') {
      ElMessage.warning(`请先完成${stageLabel(stageFromStatus(app.value.status))}阶段`)
      window.location.hash = `#/apps/${encodeURIComponent(props.appId)}/${stageFromStatus(app.value.status)}`
    }
  },
  { immediate: true }
)

watch(
  () => props.appId,
  () => void load()
)

// 外部阶段变化（例如本页确认后跳转、另一个标签页确认）时刷新应用状态
watch(
  () => props.stage,
  () => {
    if (!loading.value) void load()
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
.stages {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 2px 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.stages::-webkit-scrollbar {
  display: none;
}
.arrow {
  color: var(--rg-border-strong);
  font-size: 16px;
  flex-shrink: 0;
}
.stage {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12.5px;
  cursor: pointer;
}
.stage:hover:not(:disabled) {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.stage .mark {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 10px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.stage.current {
  border-color: var(--rg-ink);
  color: var(--rg-text);
  font-weight: 600;
}
.stage.current .mark {
  background: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.stage.done {
  color: var(--rg-ok);
  border-color: var(--rg-ok-border);
  background: var(--rg-ok-soft);
}
.stage.done .mark {
  background: var(--rg-ok);
  color: var(--rg-bg);
}
.stage.locked {
  opacity: 0.55;
  cursor: not-allowed;
}
.stage.active {
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
.cs-chip {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 3px 9px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  white-space: nowrap;
}
.cs-chip.active {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
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
code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11.5px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  border-radius: 4px;
  padding: 1px 5px;
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
@media (max-width: 1280px) {
  .appbar {
    gap: 10px;
  }
  .title {
    max-width: 180px;
  }
  .status-text {
    display: none;
  }
}
@media (max-width: 1024px) {
  .appbar {
    flex-wrap: wrap;
    row-gap: 8px;
    padding: 8px 14px;
  }
  .stages {
    order: 3;
    flex-basis: 100%;
    justify-content: flex-start;
  }
  .bar-actions {
    margin-left: auto;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}
@media (max-width: 768px) {
  .appbar {
    padding: 8px 12px;
  }
  .title {
    flex: 1;
    min-width: 120px;
    max-width: none;
  }
  .title code {
    display: none;
  }
  .btn {
    padding: 6px 10px;
  }
}
</style>
