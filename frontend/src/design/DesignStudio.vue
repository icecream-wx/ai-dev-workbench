<template>
  <div class="design-studio">
    <header class="studio-head">
      <div class="studio-title">
        <h1>设计 Studio</h1>
        <span class="studio-sub">{{ project?.appName ?? appName }}</span>
        <span v-if="project" class="module-chip" :title="`${project.module.key} ${project.module.title}`">
          {{ project.module.key }} · {{ project.module.title }}
        </span>
        <span v-if="activeModuleCount > 1" class="multi-chip" title="应用级交接包按模块生成；全部模块确认后可生成">
          多模块 {{ activeModuleCount }}
        </span>
        <span v-if="project" :class="['status-chip', project.status]">{{ projectStatusLabel }}</span>
        <span v-if="project" class="version-chip">设计 v{{ project.version }}</span>
        <span v-if="activeChangeSet" class="cs-chip">{{ activeChangeSetLabel }}</span>
        <span v-if="activeChangeSet && changeScopeIds.length" class="cs-scope-chip" :title="changeScopeLabel">
          {{ changeScopeIds.length }} 模块
        </span>
        <button v-if="project" type="button" class="input-chip" :title="inputTooltip" @click="docOpen = true">
          {{ inputLabel }}
        </button>
        <span v-if="project?.input && project.input.structure === 'fallback'" class="fallback-chip">fallback</span>
        <span v-if="project" class="template-chip">{{ project.template.name }}</span>
      </div>
      <div class="studio-actions">
        <button type="button" class="btn" :disabled="!project?.requirement" @click="docOpen = true">需求文档</button>
        <button
          v-if="project && showSync"
          type="button"
          class="btn warn"
          :disabled="appReadonly || currentOutOfScope || epicRunning"
          @click="openSync"
        >
          重新同步需求
        </button>
        <span v-if="project" :class="['ready-chip', { ok: project.readiness.ok }]">
          {{ project.readiness.ok ? '可确认设计' : `阻塞 ${project.readiness.issues.length}` }}
        </span>
        <button
          type="button"
          class="btn"
          :disabled="loading || !project || epicRunning"
          title="查看交接包（按模块）"
          @click="openHandoff"
        >
          交接包{{ handoffMeta ? ` v${handoffMeta.version}` : '' }}
        </button>
        <button type="button" class="btn" :disabled="loading || epicRunning" @click="refreshDesign">刷新</button>
        <button
          v-if="project?.status === 'confirmed'"
          type="button"
          class="btn"
          :disabled="confirming || currentOutOfScope || epicRunning"
          @click="reopenDesign"
        >
          重新编辑设计
        </button>
        <button
          type="button"
          class="btn primary"
          :disabled="!project || confirming || appReadonly || currentOutOfScope || epicRunning"
          @click="onPrimaryAction"
        >
          {{ confirming ? '处理中…' : primaryLabel }}
        </button>
      </div>
    </header>

    <div v-if="appReadonly" class="app-readonly-banner">
      <span class="stale-dot" />
      <span class="stale-text">应用已进入开发/完成阶段，设计只读；如需修改设计请先在应用头部“发起变更”。</span>
    </div>

    <div v-if="activeChangeSet && changeScopeIds.length" class="change-scope-strip">
      <span class="scope-label">本次变更范围</span>
      <span class="scope-text">{{ changeScopeLabel }}</span>
      <span v-if="currentOutOfScope" class="scope-warn">当前模块未包含（只读）</span>
      <span v-else class="scope-ok">当前模块可编辑</span>
    </div>

    <div v-if="currentOutOfScope" class="scope-out-banner">
      <span class="stale-dot warn" />
      <span class="stale-text">本次变更未包含模块「{{ project?.module.title }}」，当前设计只读；请切换到变更范围内的模块，或取消变更后重新发起。</span>
    </div>

    <div v-if="project && project.stale.stale" class="stale-banner">
      <span class="stale-dot" />
      <span class="stale-text">{{ project.stale.reason || '需求文档已更新，设计输入过期' }}</span>
      <button type="button" class="btn small" :disabled="epicRunning" @click="openSync">查看 diff 并同步</button>
      <button type="button" class="btn small" :disabled="epicRunning" @click="editRequirements">去修改需求</button>
    </div>

    <div v-if="activeChangeSet && activeChangeSet.scope === 'design'" class="scope-banner">
      <span class="scope-dot" />
      <span class="scope-text">本次变更是“仅设计”；如果要同时修改需求，请先升级变更范围（需求/设计会一起回到草稿）。</span>
      <button type="button" class="btn small warn" :disabled="upgradingScope" @click="upgradeScope">
        {{ upgradingScope ? '升级中…' : '改为需求+设计变更' }}
      </button>
    </div>

    <div v-if="loading" class="center">正在加载设计项目…</div>
    <div v-else-if="error" class="center error">
      <p>{{ error }}</p>
      <button type="button" class="btn" @click="load">重试</button>
    </div>
    <div v-else-if="project" class="studio-body">
      <div v-if="chatOpen" class="pane-mask" @click="chatOpen = false" />
      <aside :class="['chat-pane', { open: chatOpen }]">
        <button type="button" class="pane-close" title="关闭设计对话" aria-label="关闭设计对话" @click="chatOpen = false">×</button>
        <DesignChatPanel
          ref="chatRef"
          :key="`chat-${moduleId}`"
          :project="project"
          :focus="focus"
          :readonly="pageReadonly"
          :readonly-reason="epicRunning ? '正在按 Epic 生成设计' : ''"
          :before-send="flushActiveTab"
          @update:focus="focus = $event"
          @update="onProjectUpdate"
        />
      </aside>

      <section class="canvas-pane">
        <div v-if="outlineOpen" class="pane-mask outline-mask" @click="outlineOpen = false" />
        <DesignOutlineTree
          :open="outlineOpen"
          :modules="designModules"
          :project="project"
          :selected-epic-id="selectedEpicId"
          :readonly="appReadonly"
          :change-scope-ids="changeScopeIds"
          :can-generate="canGenerateEpic"
          :generate-disabled-reason="generateDisabledReason"
          :template-disabled="epicRunning"
          :template-disabled-reason="'正在按 Epic 生成设计，请先停止或等待完成后再切换原型模板'"
          :batch="epicBatch"
          @select-module="switchModule"
          @select-epic="selectEpic"
          @clear-epic="clearEpicFilter"
          @select-entity="onOutlineEntity"
          @select-page-set="onOutlinePageSet"
          @generate-epic="openSingleEpicDialog"
          @generate-batch="openBatchEpicDialog"
          @overview="overviewOpen = true"
          @template="openTemplateSwitch"
          @close="outlineOpen = false"
        />

        <div class="canvas-main">
          <DesignEpicGenerationProgress
            v-if="epicBatch.length"
            :items="epicBatch"
            :running="epicRunning"
            :readonly="readonly"
            @stop="stopEpicGeneration"
            @retry="retryEpic"
            @retry-all="retryFailedEpics"
            @close="closeEpicProgress"
          />

          <div class="studio-tabs">
            <button
              type="button"
              class="pane-toggle module-toggle"
              title="打开设计大纲"
              aria-label="打开设计大纲"
              data-testid="open-outline"
              @click="outlineOpen = true; chatOpen = false"
            >
              大纲
            </button>
            <button
              type="button"
              class="pane-toggle"
              title="打开设计对话"
              aria-label="打开设计对话"
              @click="chatOpen = true; outlineOpen = false"
            >
              对话
            </button>
            <button type="button" :class="['studio-tab', { on: tab === 'entities' }]" @click="switchTab('entities')">
              实体设计
              <span class="tab-count">{{ project.entities.length }}</span>
            </button>
            <button type="button" :class="['studio-tab', { on: tab === 'prototypes' }]" @click="switchTab('prototypes')">
              页面原型
              <span class="tab-count">{{ pageCount }}</span>
            </button>
            <button type="button" :class="['studio-tab', { on: tab === 'coverage' }]" @click="switchTab('coverage')">
              需求覆盖
              <span
                :class="['tab-count', { warn: project.coverage.stats.coveredStoryCount < project.coverage.stats.storyCount }]"
              >
                {{ project.coverage.stats.coveredStoryCount }}/{{ project.coverage.stats.storyCount }}
              </span>
            </button>
            <div class="tabs-spacer" />
            <span v-if="project.status === 'confirmed'" class="confirmed-note">
              设计已确认；点击「{{ primaryLabel }}」继续
            </span>
            <span v-else-if="project.readiness.issues.length" class="blocking-note" :title="project.readiness.issues.join('\n')">
              {{ project.readiness.issues[0] }}
            </span>
          </div>

          <div v-show="tab === 'entities'" class="tab-pane">
            <EntityDesignTab
              ref="entityRef"
              :key="`entities-${moduleId}`"
              :project="project"
              :readonly="pageReadonly"
              :focus-epic-id="focusEpicNode?.id"
              :focus-epic-title="focusEpicNode?.title"
              :focus-epic-refs="focusEpicRefs"
              :focus-epic-entity-ids="focusEpicEntityIds"
              @update="onProjectUpdate"
              @focus-change="onEntityFocus"
              @clear-epic-filter="clearEpicFilter"
            />
          </div>
          <div v-show="tab === 'prototypes'" class="tab-pane">
            <PrototypeTab
              ref="protoRef"
              :key="`prototypes-${moduleId}`"
              :project="project"
              :readonly="pageReadonly"
              :focus-epic-id="focusEpicNode?.id"
              :focus-epic-title="focusEpicNode?.title"
              :focus-epic-refs="focusEpicRefs"
              :focus-epic-is-scene="focusEpicNode?.isScene === true"
              @update="onProjectUpdate"
              @focus-change="onPageFocus"
              @clear-epic-filter="clearEpicFilter"
            />
          </div>
          <div v-show="tab === 'coverage'" class="tab-pane">
            <RequirementCoveragePanel :project="project" @jump="onCoverageJump" />
          </div>
        </div>
      </section>
    </div>

    <el-drawer v-model="docOpen" title="需求文档（设计输入）" size="56%" append-to-body>
      <div v-if="project?.requirement" class="doc-drawer">
        <div class="doc-meta">
          <strong>{{ project.requirement.title }}</strong>
          <span>{{ project.requirement.templateName }}</span>
          <span>v{{ project.requirement.version }}</span>
          <span>{{ project.requirement.confirmed ? '已确认' : '未确认' }}</span>
        </div>
        <MarkdownView :markdown="project.requirement.contentMd" />
      </div>
      <p v-else class="doc-empty">还没有需求文档。</p>
    </el-drawer>

    <div v-if="project && project.readiness.issues.length" class="readiness-bar">
      <span class="readiness-label">确认前还有阻塞：</span>
      <span class="readiness-issue">{{ project.readiness.issues[0] }}</span>
      <button type="button" class="readiness-more" @click="showReadiness">查看全部 {{ project.readiness.issues.length }} 项</button>
    </div>

    <DesignSyncDialog
      v-if="project"
      v-model="syncOpen"
      :key="`sync-${moduleId}`"
      :app-id="props.appId"
      :module-id="moduleId"
      @applied="onProjectUpdate"
      @edit-requirements="editRequirements"
    />

    <DesignOverviewDialog
      v-model="overviewOpen"
      :app-id="props.appId"
      :design-modules="designModules"
      @select="onOverviewSelect"
    />

    <DesignTemplateSwitchDialog
      v-model="templateSwitchOpen"
      :app-id="props.appId"
      :current-template-id="project?.template.id"
      :current-template-name="project?.template.name"
      :scope="templateScope"
      :module-id="moduleId"
      @applied="onAppTemplateApplied"
    />

    <DesignHandoffDialog
      v-model="handoffOpen"
      :app-id="props.appId"
      mode="enter"
      :active-change-set="activeChangeSet"
      :requirement-modules="modules"
      :design-modules="designModules"
      @generated="onHandoffGenerated"
    />

    <el-dialog
      v-model="epicDialogOpen"
      :title="epicDialogMode === 'batch' ? '按 Epic 生成' : '生成此 Epic'"
      width="560px"
      append-to-body
    >
      <div v-if="project" class="epic-dialog" data-testid="epic-generate-dialog">
        <p class="epic-dialog-note">
          生成会：实体合并进模块共享实体池（不删其它 Epic/未提及字段）；替换该 Epic 的主页面集页面（保留页面集 id）；
          其它页面集保留；每个 Epic 生成一个设计版本，结果为<strong>草稿</strong>，不会自动确认。
        </p>

        <div v-if="epicDialogMode === 'batch'" class="epic-pick">
          <div class="pick-head">
            <span>选择要生成的 Epic（{{ epicSelection.length }}/{{ epicCandidates.length }}）</span>
            <button type="button" class="link" data-testid="epic-pick-toggle-all" @click="toggleAllEpics">
              {{ allSelected ? '清空' : '全选' }}
            </button>
          </div>
          <label v-for="item in epicCandidates" :key="item.node.id" class="pick-row" :data-epic-id="item.node.id">
            <el-checkbox v-model="epicSelection" :value="item.node.id" size="small" />
            <span class="pick-key">{{ item.node.id }}</span>
            <span class="pick-title" :title="item.node.title">{{ item.node.title }}</span>
            <span :class="['pick-status', item.status]">{{ epicStatusLabel(item.status) }}</span>
          </label>
          <p v-if="!epicCandidates.length" class="epic-dialog-empty">
            设计输入里还没有 Epic/场景；请先在需求阶段补充 Epics &amp; Stories。
          </p>
        </div>
        <div v-else class="epic-single">
          <span class="pick-key">{{ epicDialogEpicId }}</span>
          <span class="pick-title">{{ epicDialogTitle }}</span>
          <span :class="['pick-status', epicDialogStats?.status ?? '']">{{ epicStatusLabel(epicDialogStats?.status ?? 'none') }}</span>
        </div>

        <div v-if="epicAffected.count" class="epic-warn" data-testid="epic-affected-confirmed">
          <strong>目标包含已确认设计项（{{ epicAffected.count }}）</strong>
          <ul>
            <li v-for="line in epicAffected.items" :key="line">{{ line }}</li>
          </ul>
          <el-checkbox v-model="epicReopen" size="small" data-testid="epic-reopen-confirmed">
            允许重新打开已确认项（生成后这些项退回草稿；其它已确认项不受影响）
          </el-checkbox>
        </div>
        <p v-else class="epic-dialog-ok" data-testid="epic-affected-none">目标没有已确认项，可以直接生成。</p>

        <p v-if="epicError" class="epic-dialog-error" data-testid="epic-generate-error">{{ epicError }}</p>
      </div>
      <template #footer>
        <button type="button" class="btn" @click="epicDialogOpen = false">取消</button>
        <button
          type="button"
          class="btn primary"
          data-testid="epic-generate-confirm"
          :disabled="epicDialogBusy || !canSubmitEpic"
          @click="submitEpicGeneration"
        >
          {{ epicDialogBusy ? '生成中…' : '开始生成' }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DesignChatPanel from './DesignChatPanel.vue'
import DesignEpicGenerationProgress from './DesignEpicGenerationProgress.vue'
import DesignHandoffDialog from './DesignHandoffDialog.vue'
import DesignOutlineTree from './DesignOutlineTree.vue'
import DesignOverviewDialog from './DesignOverviewDialog.vue'
import DesignSyncDialog from './DesignSyncDialog.vue'
import DesignTemplateSwitchDialog from './DesignTemplateSwitchDialog.vue'
import EntityDesignTab from './EntityDesignTab.vue'
import PrototypeTab from './PrototypeTab.vue'
import RequirementCoveragePanel from './RequirementCoveragePanel.vue'
import MarkdownView from '../requirements/MarkdownView.vue'
import {
  DesignApiError,
  confirmDesignProject,
  generateDesignEpic,
  getDesign,
  getDesignHandoff,
  reopenDesignProject,
  reopenRequirements,
  type DesignHandoffMeta
} from './api'
import { listRequirementModules, type RequirementModule } from '../requirements/api'
import { getApp, type DesignModuleSummary } from '../workbench/api'
import {
  readStoredDesignModuleId,
  resolveDesignModuleId,
  writeStoredDesignModuleId
} from './design-module-helpers.js'
import {
  affectedConfirmedSummary,
  createEpicBatch,
  defaultEpicSelection,
  epicBatchSummary,
  epicOutlineOf,
  epicStatusLabel,
  nextPendingIndex,
  retryFailed,
  retryOne,
  skipPending,
  updateEpicBatch
} from './design-epic-helpers.js'
import { upgradeChangeSetScope } from '../changesets/api'
import { changeSetBaseLabel } from '../changesets/labels.js'
import {
  changeScopeModuleIds,
  changeSetModuleLabel,
  isChangeScopeComplete,
  isModuleInChangeScope
} from '../changesets/module-scope.js'
import type { ChangeSetInfo } from '../workbench/api'
import type { DesignEntity, DesignPageSet, DesignProjectPayload } from './types'

const props = defineProps<{
  appId: string
  appName: string
  /** 应用当前阶段：development/completed 时设计整页只读（M4） */
  appStatus?: string
  activeChangeSet?: ChangeSetInfo | null
}>()
const emit = defineEmits<{
  changed: []
  'requirements-changed': []
  'entered-development': []
  'scope-upgraded': []
}>()

const project = ref<DesignProjectPayload | null>(null)
const loading = ref(true)
const error = ref('')
const tab = ref<'entities' | 'prototypes' | 'coverage'>('entities')
const focus = ref<{ kind: 'entity' | 'pageSet' | 'page' | 'epic'; id: string } | null>(null)
const docOpen = ref(false)
// 窄屏（≤1024）设计对话/大纲抽屉；宽屏由 CSS 忽略该状态
const chatOpen = ref(false)
const outlineOpen = ref(false)
const syncOpen = ref(false)
const handoffOpen = ref(false)
const handoffMeta = ref<DesignHandoffMeta | null>(null)
const confirming = ref(false)
const upgradingScope = ref(false)
const entityRef = ref<InstanceType<typeof EntityDesignTab> | null>(null)
const protoRef = ref<InstanceType<typeof PrototypeTab> | null>(null)
const chatRef = ref<InstanceType<typeof DesignChatPanel> | null>(null)
// M4：模块（复用需求模块数据；设计页不提供增删/归档）
const modules = ref<RequirementModule[]>([])
const designModules = ref<DesignModuleSummary[]>([])
const selectedModuleId = ref('')
const overviewOpen = ref(false)
const templateSwitchOpen = ref(false)
const templateScope = ref<'app' | 'module'>('app')
const moduleLoading = ref(false)

// D-RMP：设计大纲树 / 按 Epic 生成
const selectedEpicId = ref('')
const epicDialogOpen = ref(false)
const epicDialogMode = ref<'single' | 'batch'>('single')
const epicDialogEpicId = ref('')
const epicSelection = ref<string[]>([])
const epicReopen = ref(false)
const epicDialogBusy = ref(false)
const epicError = ref('')
const epicBatch = ref<
  Array<{
    epicId: string
    title: string
    status: string
    error: string
    entitiesAdded: number
    entitiesUpdated: number
    pages: number
    reopened: string[]
  }>
>([])
const epicRunning = ref(false)
const epicStopRequested = ref(false)
const epicReopenUsed = ref(false)

const activeChangeSetLabel = computed(() => changeSetBaseLabel(props.activeChangeSet ?? null))
const pageCount = computed(() => project.value?.pageSets.reduce((sum, set) => sum + set.pages.length, 0) ?? 0)
const moduleId = computed(() => project.value?.module.id ?? selectedModuleId.value)
const activeModules = computed(() => modules.value.filter(module => !module.archived))
const activeModuleCount = computed(() => activeModules.value.length || designModules.value.length)
const appReadonly = computed(() => props.appStatus === 'development' || props.appStatus === 'completed')
// M5：本次变更模块范围（旧变更单没有 modules → 空 = 不限制）
const changeScopeIds = computed(() => changeScopeModuleIds(props.activeChangeSet ?? null))
const changeScopeLabel = computed(() => changeSetModuleLabel(props.activeChangeSet ?? null))
const currentOutOfScope = computed(
  () => Boolean(moduleId.value) && !isModuleInChangeScope(props.activeChangeSet ?? null, moduleId.value)
)
// 应用级原型模板切换会改全部模块；变更只覆盖部分模块时禁用（改为当前模块级）
const appTemplateBlocked = computed(
  () =>
    Boolean(props.activeChangeSet) &&
    changeScopeIds.value.length > 0 &&
    !isChangeScopeComplete(
      props.activeChangeSet ?? null,
      activeModules.value.map(module => module.id)
    )
)
const readonly = computed(
  () => project.value?.status === 'confirmed' || appReadonly.value || currentOutOfScope.value
)
// MF-DRMP-2：按 Epic 生成期间冻结会与生成写库冲突的编辑/操作（查看/停止/进度仍可用）
const pageReadonly = computed(() => readonly.value || epicRunning.value)
// D-RMP：设计大纲树（Epic 节点/数据集/未归属）
interface EpicOutlineNode {
  node: { id: string; title: string; storyIds: string[]; isScene: boolean; goal: string }
  entities: Array<{ id: string; name: string; status: string; requirementRefs: string[] }>
  pageSets: Array<{ id: string; title: string; status: string; pages: unknown[] }>
  primary: {
    id: string
    title: string
    status: string
    pages: Array<{ id: string; title: string; status: string }>
  } | null
  pageSetCount: number
  pageCount: number
  missingImages: number
  storyTotal: number
  coveredStories: number
  status: string
  needsWork: boolean
}
interface EpicOutline {
  nodes: EpicOutlineNode[]
  unassignedPageSets: DesignPageSet[]
  unassignedEntities: DesignEntity[]
}
const EMPTY_EPIC_OUTLINE: EpicOutline = { nodes: [], unassignedPageSets: [], unassignedEntities: [] }

const epicOutline = computed<EpicOutline>(() =>
  project.value ? (epicOutlineOf(project.value) as EpicOutline) : EMPTY_EPIC_OUTLINE
)
const epicStatsNodes = computed(() => epicOutline.value.nodes)
const selectedEpicStats = computed(
  () => epicStatsNodes.value.find(item => item.node.id === selectedEpicId.value) ?? null
)
const focusEpicNode = computed(() => selectedEpicStats.value?.node ?? null)
const focusEpicRefs = computed(() => {
  const node = focusEpicNode.value
  return node ? [node.id, ...node.storyIds] : []
})
// MF-DRMP-5：被当前 Epic 页面绑定（但 refs 未命中）的相关实体也要显示
const focusEpicEntityIds = computed(
  () => (selectedEpicStats.value?.entities ?? []).map((entity: { id: string }) => entity.id)
)
const epicCandidates = computed(() => epicStatsNodes.value)
const allSelected = computed(
  () => epicCandidates.value.length > 0 && epicSelection.value.length === epicCandidates.value.length
)
const epicDialogStats = computed(
  () => epicStatsNodes.value.find(item => item.node.id === epicDialogEpicId.value) ?? null
)
const epicDialogTitle = computed(() => epicDialogStats.value?.node.title ?? '')
const epicDialogNodes = computed(() =>
  epicDialogMode.value === 'batch'
    ? epicCandidates.value.filter(item => epicSelection.value.includes(item.node.id))
    : epicDialogStats.value
      ? [epicDialogStats.value]
      : []
)
const epicAffected = computed(() => affectedConfirmedSummary(project.value, epicDialogNodes.value) as {
  items: string[]
  count: number
})
const canSubmitEpic = computed(() => {
  if (epicDialogMode.value === 'batch' && !epicSelection.value.length) return false
  return epicAffected.value.count === 0 || epicReopen.value
})
// 生成门禁：只读/已确认/stale/变更外/生成中
const canGenerateEpic = computed(
  () =>
    Boolean(project.value) &&
    !readonly.value &&
    !project.value?.stale.stale &&
    !epicRunning.value &&
    !moduleLoading.value &&
    !epicDialogBusy.value
)
const generateDisabledReason = computed(() => {
  if (appReadonly.value) return '应用已进入开发/完成阶段，设计只读'
  if (currentOutOfScope.value) return '当前模块不在本次变更范围内（只读）'
  if (project.value?.status === 'confirmed') return '设计已确认，请先「重新编辑设计」'
  if (project.value?.stale.stale) return '需求已变更，请先同步设计输入'
  if (epicRunning.value) return '正在按 Epic 生成，请等待完成或停止剩余'
  if (moduleLoading.value) return '正在切换模块'
  return ''
})
const showSync = computed(() => Boolean(project.value?.input))
const inputLabel = computed(() => {
  const summary = project.value?.inputSummary
  if (!summary) return '需求输入未生成'
  return `需求输入 v${summary.docVersion} · ${summary.sceneCount} 场景 / ${summary.epicCount} Epics / ${summary.storyCount} Stories · ${
    project.value?.requirement?.confirmed ? '已确认' : '未确认'
  }`
})
const inputTooltip = computed(() => {
  const summary = project.value?.inputSummary
  if (!summary) return '需求确认后会自动生成设计输入快照'
  return `输入 ${summary.id}\nhash ${summary.docHash.slice(0, 16)}…\n结构 ${summary.structure === 'prd' ? 'PRD' : 'fallback'}`
})
const projectStatusLabel = computed(() => {
  if (!project.value) return ''
  if (project.value.status === 'confirmed') return '已确认'
  if (project.value.status === 'review') return '待审核'
  return '草稿'
})
const primaryLabel = computed(() => {
  if (!project.value) return '确认设计'
  if (project.value.stale.stale) return '同步需求'
  if (project.value.status === 'confirmed') {
    return props.activeChangeSet && props.activeChangeSet.seq > 1 ? '生成变更交接包并进入开发' : '生成交接包并进入开发'
  }
  return '确认设计'
})

async function loadModules(): Promise<void> {
  try {
    const list = await listRequirementModules(props.appId)
    modules.value = list.modules
    if (!selectedModuleId.value) {
      const stored = readStoredDesignModuleId(window.localStorage, props.appId)
      const resolved = resolveDesignModuleId(modules.value, {
        storedId: stored,
        defaultModuleId: list.defaultModuleId
      })
      selectedModuleId.value = resolved.moduleId ?? ''
      if (resolved.reason === 'stored-archived') ElMessage.info('上次选择的设计模块已归档，已切换到第一个未归档模块')
      else if (resolved.reason === 'stored-missing') ElMessage.info('上次选择的设计模块不存在，已切换到第一个未归档模块')
    }
  } catch {
    modules.value = []
  }
}

/** 应用级设计总览（只读；不建项目/版本） */
async function loadDesignModules(): Promise<void> {
  try {
    const app = await getApp(props.appId)
    designModules.value = Array.isArray(app.designModules) ? app.designModules : []
  } catch {
    // 保留旧值；总览弹窗自己会再次拉取
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    await loadModules()
    project.value = await getDesign(props.appId, selectedModuleId.value || undefined)
    if (selectedModuleId.value !== project.value.module.id) {
      selectedModuleId.value = project.value.module.id
      writeStoredDesignModuleId(window.localStorage, props.appId, selectedModuleId.value)
    }
    await Promise.all([loadHandoff(), loadDesignModules()])
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

/** 切模块前把所有可编辑状态落盘（实体/页面集/页面/对话；版本弹窗无草稿） */
async function flushAll(): Promise<void> {
  if (readonly.value) return
  await chatRef.value?.flushSave()
  await entityRef.value?.flushSave()
  await protoRef.value?.flushSave()
}

async function switchModule(nextModuleId: string): Promise<void> {
  outlineOpen.value = false
  if (!nextModuleId || nextModuleId === moduleId.value || moduleLoading.value) return
  if (epicRunning.value) {
    ElMessage.warning('正在按 Epic 生成，请等待完成或先停止剩余后再切换模块')
    return
  }
  moduleLoading.value = true
  try {
    await flushAll()
  } catch {
    ElMessage.error('当前模块还有未保存内容，已取消切换；请先处理保存失败')
    moduleLoading.value = false
    return
  }
  selectedModuleId.value = nextModuleId
  writeStoredDesignModuleId(window.localStorage, props.appId, nextModuleId)
  focus.value = null
  selectedEpicId.value = ''
  epicBatch.value = []
  syncOpen.value = false
  handoffOpen.value = false
  try {
    project.value = await getDesign(props.appId, nextModuleId)
    await loadHandoff()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    moduleLoading.value = false
  }
}

async function onOverviewSelect(nextModuleId: string): Promise<void> {
  overviewOpen.value = false
  await switchModule(nextModuleId)
}

async function onAppTemplateApplied(): Promise<void> {
  await load()
}

/** MF-DRMP-2：生成中统一拦截会写库/切换上下文的入口 */
function blockWhileGenerating(): boolean {
  if (!epicRunning.value) return false
  ElMessage.warning('正在按 Epic 生成设计，请先停止剩余或等待完成后再操作')
  return true
}

function openSync(): void {
  if (blockWhileGenerating()) return
  if (appReadonly.value) {
    ElMessage.warning('应用已进入开发/完成阶段，设计只读')
    return
  }
  if (currentOutOfScope.value) {
    ElMessage.warning('当前模块不在本次变更范围内（只读）')
    return
  }
  syncOpen.value = true
}

async function refreshDesign(): Promise<void> {
  if (blockWhileGenerating()) return
  await load()
}

/**
 * 原型模板切换入口（M5）：
 * - 无变更 / 变更覆盖全部模块 → 应用级切换（全部模块）
 * - 变更只覆盖部分模块 → 只允许**当前模块**切换（scope=module），不碰未选模块
 */
function openTemplateSwitch(): void {
  if (blockWhileGenerating()) return
  if (appReadonly.value) {
    ElMessage.warning('应用已进入开发/完成阶段，设计只读')
    return
  }
  if (currentOutOfScope.value) {
    ElMessage.warning('当前模块不在本次变更范围内（只读）；请切换到变更范围内的模块')
    return
  }
  if (appTemplateBlocked.value) {
    templateScope.value = 'module'
    ElMessage.info('本次变更只包含部分模块：原型模板只切换当前模块，未选模块保持不动')
  } else {
    templateScope.value = 'app'
  }
  templateSwitchOpen.value = true
}

function openHandoff(): void {
  if (blockWhileGenerating()) return
  handoffOpen.value = true
}

async function loadHandoff(): Promise<void> {
  try {
    const data = await getDesignHandoff(props.appId)
    handoffMeta.value = data.handoff
  } catch {
    handoffMeta.value = null
  }
}

function onProjectUpdate(next: DesignProjectPayload): void {
  project.value = next
  // 同步大纲根节点摘要（保存/确认/回滚后状态/版本/计数即时更新，避免整页重拉）
  syncDesignModules(next)
}

function onEntityFocus(payload: { kind: 'entity'; id: string } | null): void {
  focus.value = payload
}

function onPageFocus(payload: { kind: 'pageSet' | 'page'; id: string } | null): void {
  focus.value = payload
}

function onCoverageJump(payload: { kind: 'entity' | 'page'; id: string }): void {
  if (payload.kind === 'entity') {
    clearEpicFilter()
    tab.value = 'entities'
    void nextTick(() => entityRef.value?.selectEntity(payload.id))
    return
  }
  clearEpicFilter()
  tab.value = 'prototypes'
  void nextTick(() => protoRef.value?.selectPageById(payload.id))
}

// ---- D-RMP：设计大纲选中 / Epic 过滤 / 按 Epic 生成 ----

function selectEpic(epicId: string): void {
  if (!project.value) return
  if (!epicStatsNodes.value.some(item => item.node.id === epicId)) return
  if (selectedEpicId.value === epicId) {
    clearEpicFilter()
    return
  }
  selectedEpicId.value = epicId
  focus.value = { kind: 'epic', id: epicId }
}

function clearEpicFilter(): void {
  selectedEpicId.value = ''
  if (focus.value?.kind === 'epic') focus.value = null
}

/** 大纲点实体：清 Epic 过滤 → 切实体 Tab 并选中 */
function onOutlineEntity(entityId: string): void {
  clearEpicFilter()
  outlineOpen.value = false
  tab.value = 'entities'
  void nextTick(() => entityRef.value?.selectEntity(entityId))
}

/** 大纲点页面集：切原型 Tab 并选中；属于 Epic 时同步 Epic 过滤 */
function onOutlinePageSet(setId: string): void {
  const set = project.value?.pageSets.find(item => item.id === setId)
  outlineOpen.value = false
  if (set?.epicId) {
    selectedEpicId.value = set.epicId
    focus.value = { kind: 'epic', id: set.epicId }
  } else {
    clearEpicFilter()
  }
  tab.value = 'prototypes'
  void nextTick(() => protoRef.value?.selectSetById(setId))
}

function warnCannotGenerate(): boolean {
  if (canGenerateEpic.value) return false
  ElMessage.warning(generateDisabledReason.value || '当前不能按 Epic 生成')
  return true
}

function openSingleEpicDialog(epicId: string): void {
  if (warnCannotGenerate()) return
  epicDialogMode.value = 'single'
  epicDialogEpicId.value = epicId
  epicSelection.value = [epicId]
  epicReopen.value = false
  epicError.value = ''
  epicDialogOpen.value = true
}

function openBatchEpicDialog(): void {
  if (warnCannotGenerate()) return
  epicDialogMode.value = 'batch'
  epicDialogEpicId.value = ''
  const defaults = defaultEpicSelection(epicStatsNodes.value) as string[]
  epicSelection.value = defaults.length ? defaults : epicStatsNodes.value.map(item => item.node.id)
  epicReopen.value = false
  epicError.value = ''
  epicDialogOpen.value = true
}

function toggleAllEpics(): void {
  epicSelection.value = allSelected.value ? [] : epicCandidates.value.map(item => item.node.id)
}

function syncDesignModules(next: DesignProjectPayload): void {
  designModules.value = designModules.value.map(module => {
    if (module.moduleId !== next.module.id) return module
    return {
      ...module,
      status: next.status,
      version: next.version,
      entityCount: next.entities.length,
      pageSetCount: next.pageSets.length,
      pageCount: next.pageSets.reduce((sum, set) => sum + set.pages.length, 0),
      missingImages: next.pageSets.reduce((sum, set) => sum + set.pages.filter(page => !page.imagePath).length, 0),
      confirmedAt: next.confirmedAt
    }
  })
}

async function submitEpicGeneration(): Promise<void> {
  if (!canSubmitEpic.value || epicDialogBusy.value || epicRunning.value) return
  const ids = epicDialogMode.value === 'batch' ? [...epicSelection.value] : [epicDialogEpicId.value]
  if (!ids.length) return
  epicDialogBusy.value = true
  epicError.value = ''
  // MF-DRMP-1：生成返回的 project 会覆盖前端 draft，正式开始前必须先落盘手动编辑
  try {
    await flushAll()
  } catch {
    epicError.value = '当前编辑未保存，已取消生成；请先处理保存失败后重试'
    epicDialogBusy.value = false
    ElMessage.error('当前编辑未保存，已取消生成；请先处理保存失败')
    return
  }
  epicBatch.value = createEpicBatch(
    ids.map(epicId => ({
      epicId,
      title: epicStatsNodes.value.find(item => item.node.id === epicId)?.node.title ?? ''
    }))
  )
  epicReopenUsed.value = epicReopen.value
  epicDialogOpen.value = false
  try {
    await runEpicQueue()
  } finally {
    epicDialogBusy.value = false
  }
}

async function runEpicQueue(): Promise<void> {
  if (epicRunning.value) return
  epicRunning.value = true
  epicStopRequested.value = false
  try {
    for (;;) {
      if (epicStopRequested.value) {
        epicBatch.value = skipPending(epicBatch.value)
        break
      }
      const index = nextPendingIndex(epicBatch.value)
      if (index < 0) break
      const item = epicBatch.value[index]
      epicBatch.value = updateEpicBatch(epicBatch.value, item.epicId, { status: 'running' })
      try {
        const result = await generateDesignEpic(props.appId, item.epicId, {
          moduleId: moduleId.value,
          reopenConfirmed: epicReopenUsed.value
        })
        project.value = result.project
        syncDesignModules(result.project)
        epicBatch.value = updateEpicBatch(epicBatch.value, item.epicId, {
          status: 'success',
          entitiesAdded: result.entitiesAdded,
          entitiesUpdated: result.entitiesUpdated,
          pages: result.pages,
          reopened: result.reopened
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const issues = err instanceof DesignApiError && err.issues.length ? `（${err.issues.join('；')}）` : ''
        epicBatch.value = updateEpicBatch(epicBatch.value, item.epicId, {
          status: 'failed',
          error: `${message}${issues}`
        })
      }
    }
  } finally {
    epicRunning.value = false
  }
  await Promise.allSettled([loadDesignModules(), loadHandoff()])
  const summary = epicBatchSummary(epicBatch.value) as {
    success: number
    failed: number
    skipped: number
    total: number
  }
  const firstSuccess = epicBatch.value.find(item => item.status === 'success')
  if (firstSuccess) {
    selectedEpicId.value = firstSuccess.epicId
    focus.value = { kind: 'epic', id: firstSuccess.epicId }
  }
  if (summary.failed) {
    ElMessage.warning(`按 Epic 生成：${summary.success} 个成功、${summary.failed} 个失败；可在进度条点「重试」`)
  } else if (summary.skipped) {
    ElMessage.info(`已停止剩余；完成 ${summary.success} 个 Epic 的设计`)
  } else if (summary.success) {
    ElMessage.success(`已按 Epic 生成 ${summary.success} 个设计版本（草稿，不自动确认）`)
  }
}

function stopEpicGeneration(): void {
  if (!epicRunning.value) return
  epicStopRequested.value = true
}

async function retryEpic(epicId: string): Promise<void> {
  if (epicRunning.value) return
  epicBatch.value = retryOne(epicBatch.value, epicId) as typeof epicBatch.value
  if (!epicBatch.value.some(item => item.status === 'pending')) return
  await runEpicQueue()
}

async function retryFailedEpics(): Promise<void> {
  if (epicRunning.value) return
  epicBatch.value = retryFailed(epicBatch.value) as typeof epicBatch.value
  if (!epicBatch.value.some(item => item.status === 'pending')) return
  await runEpicQueue()
}

function closeEpicProgress(): void {
  if (epicRunning.value) return
  epicBatch.value = []
}

async function editRequirements(): Promise<void> {
  if (blockWhileGenerating()) return
  try {
    await ElMessageBox.confirm(
      '会把需求文档改回草稿、应用回到需求阶段；设计/原型保留，但会标记为“设计输入过期”。重新确认需求后再回设计阶段同步。',
      '去修改需求',
      { type: 'warning', confirmButtonText: '去修改需求', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await reopenRequirements(props.appId, moduleId.value)
    ElMessage.success('需求已回到草稿，正在跳转需求阶段')
    emit('requirements-changed')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  }
}

async function flushActiveTab(): Promise<void> {
  if (readonly.value) return
  if (tab.value === 'entities') await entityRef.value?.flushSave()
  else if (tab.value === 'prototypes') await protoRef.value?.flushSave()
}

/** 切换 Tab 前先落盘当前编辑，避免“保存版本/对话”读到旧内容（自动保存版本不变） */
async function switchTab(next: 'entities' | 'prototypes' | 'coverage'): Promise<void> {
  if (tab.value === next) return
  try {
    await flushActiveTab()
  } catch {
    // 落盘失败已在 Tab 内提示；仍允许切换查看
  }
  tab.value = next
}

function onPrimaryAction(): void {
  if (!project.value || confirming.value) return
  if (blockWhileGenerating()) return
  if (project.value.stale.stale) {
    ElMessage.warning('需求文档已变更，请先同步设计输入')
    openSync()
    return
  }
  if (project.value.status === 'confirmed') {
    handoffOpen.value = true
    return
  }
  void confirmDesign()
}

async function reopenDesign(): Promise<void> {
  if (!project.value || confirming.value) return
  if (blockWhileGenerating()) return
  try {
    await ElMessageBox.confirm(
      '重新编辑会把设计状态从「已确认」改为「草稿」，之后修改会生成新版本；再次确认前不会进入交接包/开发。',
      '重新编辑设计',
      { type: 'warning', confirmButtonText: '重新编辑', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  confirming.value = true
  try {
    project.value = await reopenDesignProject(props.appId, moduleId.value)
    ElMessage.success('当前模块设计已回到草稿，可以继续修改')
    await loadDesignModules()
    emit('changed')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    confirming.value = false
  }
}

/** 仅设计变更 → 需求+设计：升级后回到需求阶段（由 AppShell 跳转） */
async function upgradeScope(): Promise<void> {
  const cs = props.activeChangeSet
  if (!cs || upgradingScope.value) return
  if (blockWhileGenerating()) return
  try {
    await ElMessageBox.confirm(
      '升级为“需求+设计”变更？需求文档与设计都会回到草稿，之后需要重新确认需求、同步设计输入并确认设计。',
      '改为需求+设计变更',
      { type: 'warning', confirmButtonText: '升级范围', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  upgradingScope.value = true
  try {
    await upgradeChangeSetScope(props.appId, cs.id, 'requirements')
    ElMessage.success('已升级为“需求+设计”变更')
    emit('scope-upgraded')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    upgradingScope.value = false
  }
}

async function confirmDesign(): Promise<void> {
  if (!project.value || confirming.value) return
  if (blockWhileGenerating()) return
  if (project.value.stale.stale) {
    ElMessage.warning('需求文档已变更，请先同步设计输入后再确认设计')
    openSync()
    return
  }
  if (project.value.status === 'confirmed') {
    ElMessage.info('当前模块设计已确认；如需继续请切换模块或查看设计总览')
    return
  }
  if (!project.value.readiness.ok) {
    showReadiness()
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认「${project.value.module.title}」模块设计前会校验：需求文档已确认、实体已确认、所有页面集与页面已确认、无阻塞问题。\n确认只影响当前模块；全部模块确认后才能在交接包弹窗生成应用级交接包。`,
      '确认设计',
      { type: 'warning', confirmButtonText: '确认设计', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  confirming.value = true
  try {
    await flushAll()
    const result = await confirmDesignProject(props.appId, moduleId.value)
    project.value = result.project
    await loadDesignModules()
    if (result.alreadyConfirmed) {
      ElMessage.success('当前模块设计此前已确认')
    } else if (result.appConfirmed) {
      ElMessage.success('当前模块已确认；全部模块设计已确认，可生成应用级交接包')
    } else {
      const pending = result.pendingModuleIds?.length ?? 0
      ElMessage.success(pending ? `当前模块已确认；还有 ${pending} 个模块待确认` : '当前模块设计已确认')
    }
    emit('changed')
  } catch (err) {
    if (err instanceof DesignApiError && err.issues.length) {
      void ElMessageBox.alert(err.issues.map(line => `• ${line}`).join('\n'), err.message, {
        type: 'warning',
        confirmButtonText: '知道了'
      })
    } else {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    }
  } finally {
    confirming.value = false
  }
}

function onHandoffGenerated(result: {
  handoff: DesignHandoffMeta
  developmentStarted: boolean
  warnings: string[]
}): void {
  handoffMeta.value = result.handoff
  void loadDesignModules()
  emit('changed')
  if (result.developmentStarted) {
    emit('entered-development')
    return
  }
  if (result.warnings.length) {
    ElMessage.warning(`交接包已重新生成，有 ${result.warnings.length} 条提示`)
  }
}

function showReadiness(): void {
  if (!project.value) return
  const issues = project.value.readiness.issues.length
    ? project.value.readiness.issues.map(line => `• ${line}`).join('\n')
    : '没有阻塞问题。'
  const warnings = project.value.readiness.warnings.length
    ? `\n\n提示：\n${project.value.readiness.warnings.map(line => `• ${line}`).join('\n')}`
    : ''
  void ElMessageBox.alert(`${issues}${warnings}`, '设计确认条件', { type: 'warning', confirmButtonText: '知道了' })
}

watch(
  () => props.appId,
  () => {
    selectedModuleId.value = ''
    modules.value = []
    designModules.value = []
    selectedEpicId.value = ''
    epicBatch.value = []
    void load()
  }
)

function onStudioKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (chatOpen.value) chatOpen.value = false
  if (outlineOpen.value) outlineOpen.value = false
  if (epicDialogOpen.value) epicDialogOpen.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onStudioKeydown)
  void load()
})

onBeforeUnmount(() => window.removeEventListener('keydown', onStudioKeydown))
</script>

<style scoped>
.design-studio {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--rg-bg);
  color: var(--rg-text);
  min-height: 0;
  position: relative;
}
.studio-head {
  flex-shrink: 0;
  min-height: 56px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
  flex-wrap: wrap;
}
.studio-title,
.studio-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.studio-title h1 {
  margin: 0;
  font-size: 15px;
  color: var(--rg-text);
}
.studio-sub {
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.status-chip,
.version-chip,
.template-chip,
.ready-chip,
.input-chip,
.fallback-chip,
.cs-chip,
.module-chip,
.multi-chip {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.module-chip {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.multi-chip {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.cs-chip {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.cs-scope-chip {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
  white-space: nowrap;
}
.change-scope-strip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 16px;
  border-bottom: 1px solid var(--rg-ai-border);
  background: var(--rg-ai-soft);
  font-size: 11px;
  color: var(--rg-text-2);
}
.change-scope-strip .scope-label {
  font-weight: 600;
  color: var(--rg-ai);
}
.change-scope-strip .scope-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.change-scope-strip .scope-warn {
  color: var(--rg-warn);
}
.change-scope-strip .scope-ok {
  color: var(--rg-ok);
}
.scope-out-banner {
  flex-shrink: 0;
  min-height: 32px;
  padding: 6px 16px;
  background: var(--rg-warn-soft);
  border-bottom: 1px solid var(--rg-warn-border);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--rg-warn);
  flex-wrap: wrap;
}
.scope-out-banner .stale-dot.warn {
  background: var(--rg-warn);
}
.input-chip {
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-ai);
  cursor: pointer;
}
.input-chip:hover {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
}
.fallback-chip {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.stale-banner {
  flex-shrink: 0;
  min-height: 34px;
  padding: 6px 16px;
  background: var(--rg-warn-soft);
  border-bottom: 1px solid var(--rg-warn-border);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--rg-warn);
  flex-wrap: wrap;
}
.app-readonly-banner {
  flex-shrink: 0;
  min-height: 32px;
  padding: 6px 16px;
  background: var(--rg-fill);
  border-bottom: 1px solid var(--rg-border);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  flex-wrap: wrap;
}
.app-readonly-banner .stale-dot {
  background: var(--rg-text-3);
}
.stale-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--rg-warn);
  flex-shrink: 0;
}
.stale-text {
  flex: 1;
  min-width: 200px;
}
.scope-banner {
  flex-shrink: 0;
  min-height: 34px;
  padding: 6px 16px;
  background: var(--rg-ai-soft);
  border-bottom: 1px solid var(--rg-ai-border);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--rg-text);
  flex-wrap: wrap;
}
.scope-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--rg-ai);
  flex-shrink: 0;
}
.scope-text {
  flex: 1;
  min-width: 200px;
}
.btn.small {
  padding: 3px 9px;
  font-size: 11px;
}
.btn.warn {
  color: var(--rg-warn);
  border-color: var(--rg-warn-border);
  background: var(--rg-warn-soft);
}
.tab-count.warn {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.status-chip.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.version-chip {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.template-chip {
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.ready-chip {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.ready-chip.ok {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 6px 11px;
  font-size: 12px;
  cursor: pointer;
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
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.studio-body {
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
}
.chat-pane {
  width: 380px;
  flex-shrink: 0;
  border-right: 1px solid var(--rg-border);
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--rg-surface-2);
  position: relative;
}
.canvas-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  min-height: 0;
  position: relative;
}
.canvas-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.studio-tabs {
  flex-shrink: 0;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 14px;
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
  flex-wrap: wrap;
}
.studio-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  border: none;
  background: transparent;
  border-radius: 8px 8px 0 0;
  padding: 8px 12px;
  font-size: 12.5px;
  color: var(--rg-text-2);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.studio-tab:hover {
  color: var(--rg-text);
}
.studio-tab.on {
  color: var(--rg-text);
  font-weight: 600;
  border-bottom-color: var(--rg-ink);
}
.tab-count {
  font-size: 10px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
  border-radius: 999px;
  padding: 0 6px;
}
.tabs-spacer {
  flex: 1;
}
.confirmed-note {
  font-size: 11px;
  color: var(--rg-ok);
}
.blocking-note {
  font-size: 11px;
  color: var(--rg-warn);
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tab-pane {
  flex: 1;
  min-height: 0;
}
.center {
  flex: 1;
  display: grid;
  place-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--rg-text-3);
}
.center.error {
  color: var(--rg-danger);
}
.doc-drawer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow-y: auto;
  color: var(--rg-text);
}
.doc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--rg-border);
}
.doc-empty {
  color: var(--rg-text-3);
  font-size: 12.5px;
}
.readiness-bar {
  flex-shrink: 0;
  min-height: 30px;
  padding: 5px 14px;
  background: var(--rg-warn-soft);
  border-top: 1px solid var(--rg-warn-border);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--rg-warn);
  flex-wrap: wrap;
}
.readiness-label {
  font-weight: 600;
  flex-shrink: 0;
}
.readiness-issue {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.readiness-more {
  border: none;
  background: transparent;
  color: var(--rg-warn);
  font-size: 11px;
  text-decoration: underline;
  cursor: pointer;
  flex-shrink: 0;
}
/* 窄屏抽屉开关 */
.pane-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  margin-right: 4px;
}
.pane-toggle:hover {
  border-color: var(--rg-text-3);
  color: var(--rg-text);
  background: var(--rg-hover);
}
.pane-close {
  display: none;
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 7px;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.pane-close:hover {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.pane-mask {
  display: none;
}
.epic-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--rg-text);
  font-size: 12px;
}
.epic-dialog-note {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--rg-text-2);
  background: var(--rg-fill);
  border-radius: 8px;
  padding: 8px 10px;
}
.epic-pick {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  padding: 8px 10px;
}
.pick-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--rg-text-2);
  font-weight: 600;
}
.link {
  border: none;
  background: transparent;
  color: var(--rg-ai);
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
.pick-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 2px 0;
}
.pick-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 10px;
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.pick-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--rg-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pick-status {
  flex-shrink: 0;
  font-size: 9.5px;
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.pick-status.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.pick-status.stale {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.epic-single {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  padding: 8px 10px;
}
.epic-warn {
  border: 1px solid var(--rg-warn-border);
  background: var(--rg-warn-soft);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 11.5px;
  color: var(--rg-warn);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.epic-warn ul {
  margin: 0;
  padding-left: 18px;
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.6;
}
.epic-dialog-ok {
  margin: 0;
  font-size: 11.5px;
  color: var(--rg-ok);
  background: var(--rg-ok-soft);
  border-radius: 8px;
  padding: 7px 10px;
}
.epic-dialog-error {
  margin: 0;
  font-size: 11.5px;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border-radius: 8px;
  padding: 7px 10px;
}
.epic-dialog-empty {
  margin: 4px 0;
  font-size: 11.5px;
  color: var(--rg-text-3);
  line-height: 1.6;
}

@media (max-width: 1280px) {
  .chat-pane {
    width: 330px;
  }
  .studio-head {
    padding: 8px 12px;
  }
  .blocking-note {
    max-width: 280px;
  }
}

/* ≤1024：设计对话折叠为抽屉 */
@media (max-width: 1024px) {
  .pane-toggle {
    display: inline-flex;
  }
  .pane-close {
    display: inline-flex;
  }
  .pane-mask {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 40;
    background: var(--rg-overlay);
  }
  .chat-pane {
    display: none;
  }
  .chat-pane.open {
    display: flex;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(360px, calc(100vw - 48px));
    z-index: 41;
    box-shadow: var(--rg-shadow-2);
    border-right: 1px solid var(--rg-border);
  }
  .blocking-note {
    max-width: none;
    white-space: normal;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .studio-head {
    padding: 8px 10px;
    row-gap: 8px;
  }
  .studio-actions {
    width: 100%;
  }
  .studio-tabs {
    padding: 0 10px;
  }
  .studio-tab {
    padding: 8px 9px;
    font-size: 12px;
  }
  .readiness-bar {
    font-size: 10.5px;
    padding: 6px 10px;
  }
  .chat-pane.open {
    width: calc(100vw - 24px);
  }
  .btn,
  .pane-toggle,
  .input-chip {
    min-height: 32px;
  }
  .studio-tab {
    min-height: 32px;
  }
}
</style>
