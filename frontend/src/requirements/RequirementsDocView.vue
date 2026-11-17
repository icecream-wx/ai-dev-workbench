<template>
  <div class="reqdoc" data-testid="reqdoc">
    <!-- 窄屏抽屉遮罩：点击关闭对话/大纲 -->
    <div v-if="chatOpen || outlineOpen" class="pane-mask" @click="closePanes" />

    <aside :class="['chat-pane', { open: chatOpen }]">
      <button type="button" class="pane-close" title="关闭对话面板" aria-label="关闭对话面板" @click="chatOpen = false">×</button>
      <DocChatPanel
        v-if="payload && selectedModuleId"
        :key="selectedModuleId"
        ref="chatRef"
        :app-id="appId"
        :module-id="selectedModuleId"
        :module-title="currentModule?.title ?? ''"
        :template-id="payload.template.id"
        :template-name="payload.template.name"
        :doc-status="payload.doc.status"
        :doc-version="payload.doc.version"
        :doc-title="payload.doc.title"
        :sections="payload.sections"
        :focus-section-key="focusSectionKey"
        :before-send="flushBeforeAi"
        :readonly="readonly"
        :initial-prompt="initialChatPrompt"
        :prefill-key="initialChatPrefillKey"
        :plan-mode="planMode"
        :plan-state="planState"
        :plan-outcome="planOutcome"
        :plan-kind="appliedPlanKind"
        :generation-running="Boolean(planState.generation?.running) || replanBusy"
        :app-status="appStatus"
        @update:focus-section-key="focusSectionKey = $event"
        @doc-changed="onAiChanged"
        @confirm="confirmDoc"
        @apply-plan="onApplyPlan"
        @keep-single="onKeepSingle"
        @regenerate="onRegenerateAll"
        @retry-generation="onRetryGeneration"
        @cancel-generation="onCancelGeneration"
        @module-action="onChatModuleAction"
      />
      <div v-else class="chat-placeholder">正在加载需求文档…</div>
    </aside>

    <section class="doc-pane">
      <header class="doc-head">
        <div class="doc-head-main">
          <button type="button" class="pane-toggle" title="打开需求对话" aria-label="打开需求对话" data-testid="open-chat" @click="chatOpen = true">
            对话
          </button>
          <div class="module-current">
            <strong class="module-current-title">{{ currentModule?.title ?? '需求模块' }}</strong>
            <span v-if="currentModule" class="module-current-key">{{ currentModule.moduleKey }}</span>
            <span v-if="currentModule?.archived" class="module-archived-chip">已归档</span>
          </div>
          <button type="button" class="template-badge" title="打开模板中心（应用级切换）" @click="openTemplateCenter">
            {{ payload?.template.name ?? '模板' }}
            <span class="caret">▾</span>
          </button>
          <span :class="['status-chip', docStatus]">{{ statusLabel }}</span>
          <span class="doc-version">v{{ payload?.doc.version ?? 1 }}</span>
          <span v-if="activeChangeSet" class="cs-chip" :title="'本次变更基于已确认的需求文档版本'">{{ activeChangeSetLabel }}</span>
          <span v-if="activeChangeSet && changeScopeIds.length" class="cs-scope-chip" :title="changeScopeLabel">
            {{ changeScopeIds.length }} 模块
          </span>
          <span :class="['save-state', saveState]">{{ saveLabel }}</span>
        </div>
        <div class="doc-head-actions">
          <button type="button" class="pane-toggle" title="打开模块与文档大纲" aria-label="打开模块与文档大纲" data-testid="open-outline" @click="outlineOpen = true">
            大纲
          </button>
          <button type="button" class="doc-btn overview-btn" data-testid="open-overview" @click="openOverview">
            需求总览
            <span class="overview-progress">{{ progress.requiredConfirmed }}/{{ progress.requiredTotal }}</span>
          </button>
          <template v-if="view === 'doc'">
            <button
              type="button"
              class="doc-btn replan-btn"
              data-testid="open-module-replan"
              :disabled="!replanAvailable || replanBusy"
              :title="replanHint"
              @click="openModuleReplan"
            >
              AI 规划模块
            </button>
            <div class="mode-tabs">
              <button type="button" :class="['mode-tab', { on: mode === 'edit' }]" @click="mode = 'edit'">章节编辑</button>
              <button type="button" :class="['mode-tab', { on: mode === 'preview' }]" @click="mode = 'preview'">预览</button>
              <button type="button" :class="['mode-tab', { on: mode === 'source' }]" @click="switchSource">全文源码</button>
            </div>
            <button type="button" class="doc-btn" @click="openTemplateCenter">模板中心</button>
            <button type="button" class="doc-btn" @click="versionOpen = true">版本</button>
            <button type="button" class="doc-btn" @click="onExport">导出 .md</button>
          </template>
          <template v-else>
            <span class="preview-view-chip" data-testid="prototype-view-chip">原型预览</span>
            <button type="button" class="doc-btn" data-testid="prototype-back-to-doc" @click="backToDoc">返回文档</button>
          </template>
          <button
            v-if="canCompleteRequirements"
            type="button"
            class="doc-btn primary"
            data-testid="complete-requirements"
            :disabled="completing"
            @click="completeRequirements"
          >
            {{ completing ? '提交中…' : '完成需求阶段' }}
          </button>
          <button
            v-else-if="!stageReadonly && !docConfirmed && currentModule && !currentModule.archived"
            type="button"
            class="doc-btn primary"
            data-testid="confirm-module"
            :disabled="confirming"
            @click="confirmDoc"
          >
            {{ confirming ? '校验中…' : '确认本模块' }}
          </button>
          <span v-else-if="docConfirmed" class="confirmed-note">本模块已确认</span>
        </div>
      </header>

      <div v-if="activeChangeSet && changeScopeIds.length" class="change-scope-strip">
        <span class="scope-label">本次变更范围</span>
        <span class="scope-text">{{ changeScopeLabel }}</span>
        <span v-if="currentOutOfScope" class="scope-warn">当前模块不在本次变更内（只读）</span>
        <span v-else class="scope-ok">当前模块可编辑</span>
      </div>

      <div v-if="visibleDocWarnings.length" class="doc-warning-strip" data-testid="doc-warning-strip">
        <span class="warning-mark">!</span>
        <ul class="warning-list">
          <li v-for="(warning, index) in visibleDocWarnings" :key="index">{{ warning }}</li>
        </ul>
        <button type="button" class="warning-close" title="关闭提示" aria-label="关闭提示" @click="dismissDocWarnings">×</button>
      </div>

      <div v-if="currentModule" class="overview-strip">
        <span class="strip-item">
          必选已确认 <strong>{{ progress.requiredConfirmed }}/{{ progress.requiredTotal }}</strong>
        </span>
        <span v-if="progress.pending.length" class="strip-item pending">
          待确认：{{ pendingLabel }}
        </span>
        <span v-else-if="progress.requiredTotal" class="strip-item ok">全部必选模块已确认</span>
        <span class="strip-item">
          需求聚合
          <template v-if="bundle?.latest">v{{ bundle.latest.version }} · {{ shortHash(bundle.latest.hash) }}</template>
          <template v-else>未生成</template>
        </span>
        <span v-if="bundleDrifted" class="strip-item warn">内容已变化（未落库）</span>
        <span v-if="progress.archived" class="strip-item">已归档 {{ progress.archived }}</span>
      </div>

      <div v-if="loading" class="doc-center">正在加载需求文档…</div>
      <div v-else-if="error" class="doc-center error">
        {{ error }}
        <div><button type="button" class="doc-btn" @click="loadDoc">重试</button></div>
      </div>
      <div v-else-if="payload" class="doc-body">
        <nav :class="['outline', { open: outlineOpen }]" data-testid="requirement-outline">
          <button type="button" class="pane-close" title="关闭需求大纲" aria-label="关闭需求大纲" @click="outlineOpen = false">×</button>
          <RequirementOutlineTree
            :modules="activeModules"
            :archived-modules="archivedModules"
            :selected-module-id="selectedModuleId"
            :expanded-module-id="outlineExpandedId"
            :sections="payload.sections"
            :active-section-key="activeSectionKey"
            :focus-section-key="focusSectionKey"
            :app-status="appStatus"
            :can-mutate="!stageReadonly"
            :change-scope-ids="changeScopeIds"
            :archive-blocked="Boolean(activeChangeSet)"
            :prototype-module-id="view === 'prototype' ? selectedModuleId : ''"
            @toggle="toggleOutlineModule"
            @jump="jumpToSection"
            @create="openCreateModule"
            @edit="openEditModule"
            @move="moveModule"
            @archive="archiveModuleById"
            @restore="restoreModuleById"
            @prototype="onOutlinePrototype"
          />
        </nav>

        <div ref="docScrollRef" class="doc-scroll">
          <div v-if="showOnboarding && view === 'doc'" class="onboarding">
            <div>
              <strong>已按「{{ payload.template.name }}」初始化文档结构</strong>
              <p>可以先在左侧描述需求让 AI 生成初稿，也可以直接在右侧章节里手动填写；切换模板会在应用级按标题保留已有内容并为每个模块生成新版本。</p>
            </div>
            <button type="button" class="doc-btn" @click="openTemplateCenter">切换模板</button>
          </div>

          <div v-if="currentOutOfScope" class="readonly-banner scope-out">
            <span>本次变更未包含该模块「{{ currentModule?.title }}」，当前只读；请切换到变更范围内的模块，或取消本次变更后重新发起。</span>
          </div>
          <div v-else-if="stageReadonly" class="readonly-banner">
            <span v-if="appStatus === 'design'">
              当前处于设计阶段，需求文档只读。需要修改需求时先「重新编辑需求」回到需求阶段（会清除应用级需求确认，需重新完成需求阶段）。
            </span>
            <span v-else>当前处于开发/完成阶段，需求文档只读；需求变更请先在应用头部「发起变更」（范围：需求+设计）。</span>
            <button v-if="appStatus === 'design'" type="button" class="doc-btn" :disabled="reopening" @click="reopenDoc">
              {{ reopening ? '处理中…' : '重新编辑需求' }}
            </button>
          </div>
          <div v-else-if="currentModule?.archived" class="readonly-banner archived">
            <span>该模块已归档（文档/版本保留），只能在模块列表里查看或恢复；恢复后可继续编辑与确认。</span>
          </div>
          <div v-else-if="docConfirmed" class="readonly-banner">
            <span>
              本模块需求已确认（v{{ payload.doc.version }}），当前只读；其它模块仍可继续编辑。全部必选模块确认后，在“需求总览”完成需求阶段。
            </span>
            <button type="button" class="doc-btn" :disabled="reopening" @click="reopenDoc">
              {{ reopening ? '处理中…' : '重新编辑需求' }}
            </button>
          </div>

          <template v-if="view === 'prototype'">
            <RequirementsPrototypePreview
              :key="`prototype-${selectedModuleId}`"
              :app-id="appId"
              :module-id="selectedModuleId"
              :module-title="currentModule?.title ?? ''"
              :refresh-key="prototypeRefreshKey"
              :doc-readonly-hint="readonly ? '当前文档只读，预览同样只读' : ''"
              @open-doc="openPrototypeDoc"
              @refresh="refreshPrototype"
            />
          </template>

          <template v-else-if="mode === 'preview'">
            <article class="preview-doc">
              <MarkdownView :markdown="previewMarkdown" />
            </article>
          </template>

          <template v-else-if="mode === 'source'">
            <div class="source-head">
              <span>整篇 Markdown（保存时按 ##/### 标题解析回章节；新标题会作为自定义章节）</span>
              <button v-if="!readonly" type="button" class="doc-btn primary" :disabled="sourceSaving" @click="saveSource">
                {{ sourceSaving ? '保存中…' : '保存全文' }}
              </button>
            </div>
            <textarea v-model="sourceText" class="source-editor" :readonly="readonly" spellcheck="false" />
          </template>

          <template v-else>
            <article
              v-for="section in payload.sections"
              :id="`doc-sec-${section.sectionKey}`"
              :key="section.sectionKey"
              class="section-card"
            >
              <div class="section-head">
                <div class="section-title">
                  <h2>{{ section.title }}</h2>
                  <span class="section-kind">{{ kindLabel(section.kind) }}</span>
                  <span :class="['section-req', { on: section.required }]">{{ section.required ? '必填' : '可选' }}</span>
                  <span v-if="section.required && !section.markdown.trim()" class="section-missing">待补全</span>
                </div>
                <div class="section-actions">
                  <button type="button" class="section-ai" :disabled="readonly" @click="askAi(section.sectionKey)">问 AI</button>
                  <button type="button" class="section-ai" @click="toggleSectionPreview(section.sectionKey)">
                    {{ previewKey === section.sectionKey ? '收起预览' : '预览' }}
                  </button>
                </div>
              </div>
              <p v-if="!section.markdown.trim()" class="section-hint">{{ guidanceFor(section) || '按模板要求填写本节内容。' }}</p>

              <div v-if="isStructured(section)" class="section-mode">
                <div class="mode-tabs small">
                  <button type="button" :class="['mode-tab', { on: structuredView(section) }]" @click="setStructureMode(section.sectionKey, true)">
                    结构化
                  </button>
                  <button type="button" :class="['mode-tab', { on: !structuredView(section) }]" @click="setStructureMode(section.sectionKey, false)">
                    Markdown
                  </button>
                </div>
                <span class="structure-tip">
                  ID 由系统分配；保存时按结构渲染 Markdown{{ structuredView(section) ? '' : '，点“重建结构”可把 Markdown 变化同步回结构' }}
                </span>
                <button v-if="!readonly" type="button" class="section-ai" :disabled="rebuilding === section.sectionKey" @click="rebuildSection(section.sectionKey)">
                  {{ rebuilding === section.sectionKey ? '重建中…' : '重建结构' }}
                </button>
              </div>

              <OutlineEditor
                v-if="isStructured(section) && structuredView(section)"
                :mode="section.kind === 'scenes' ? 'scenes' : 'epics'"
                :data="section.data ?? EMPTY_OUTLINE"
                :scenes="allScenes"
                :readonly="readonly"
                @change="onOutlineChange(section, $event)"
              />

              <template v-else>
                <div v-if="!readonly" class="section-toolbar">
                  <button type="button" title="二级标题" @click="insertLine('## ')">H2</button>
                  <button type="button" title="三级标题" @click="insertLine('### ')">H3</button>
                  <button type="button" title="粗体" @click="wrapSelection('**', '**')"><b>B</b></button>
                  <button type="button" title="斜体" @click="wrapSelection('*', '*')"><i>I</i></button>
                  <button type="button" title="列表" @click="insertLine('- ')">• 列表</button>
                  <button type="button" title="引用/待确认" @click="insertLine('> 待确认：')">引用</button>
                  <button type="button" title="代码" @click="wrapSelection('`', '`')">code</button>
                  <button type="button" title="链接" @click="insertLink">链接</button>
                </div>

                <textarea
                  :ref="el => setTextarea(section.sectionKey, el)"
                  v-model="section.markdown"
                  class="section-editor"
                  :rows="sectionRows(section)"
                  :readonly="readonly"
                  :placeholder="guidanceFor(section)"
                  spellcheck="false"
                  @input="onSectionInput(section.sectionKey)"
                  @focus="activeKey = section.sectionKey"
                />
              </template>

              <div v-if="previewKey === section.sectionKey" class="section-preview">
                <MarkdownView :markdown="section.markdown" />
              </div>
            </article>
          </template>
        </div>
      </div>
    </section>

    <TemplateCenterDialog
      v-model="templateOpen"
      :current-template-id="payload?.template.id"
      apply-scope="app"
      :has-divergent-templates="templatesDiverged"
      @use="useTemplate"
      @changed="onTemplatesChanged"
    />
    <VersionHistoryDialog
      v-if="payload"
      :key="`versions-${selectedModuleId}`"
      v-model="versionOpen"
      :app-id="appId"
      :module-id="selectedModuleId"
      :module-title="currentModule?.title"
      :readonly="readonly"
      :before-save="flushBeforeAi"
      @restored="onRestored"
      @saved="onVersionSaved"
    />
    <RequirementOverview
      v-model="overviewOpen"
      :app-name="appName"
      :modules="allModules"
      :bundle="bundle"
      :loading="bundleLoading"
      :confirming="completing"
      :app-status="appStatus"
      :current-module-id="selectedModuleId"
      @select="switchModule"
      @confirm="completeRequirements"
      @refresh="loadBundle"
    />
    <ModuleEditDialog
      v-model="moduleDialogOpen"
      :mode="moduleDialogMode"
      :module="editingModule"
      :saving="moduleSaving"
      @save="saveModule"
    />
    <AppTemplateSwitchDialog
      v-if="switchTemplate"
      v-model="switchTemplateOpen"
      :app-id="appId"
      :template-id="switchTemplate.id"
      :template-name="switchTemplate.name"
      @applied="onAppTemplateApplied"
    />
    <ModuleReplanDialog
      v-if="payload"
      v-model="replanOpen"
      :app-id="appId"
      :app-name="appName"
      :modules="allModules"
      :before-request="flushBeforeAi"
      @applied="onReplanApplied"
      @finished="onReplanFinished"
      @busy="onReplanBusy"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DocChatPanel from './DocChatPanel.vue'
import MarkdownView from './MarkdownView.vue'
import OutlineEditor from './OutlineEditor.vue'
import TemplateCenterDialog from './TemplateCenterDialog.vue'
import VersionHistoryDialog from './VersionHistoryDialog.vue'
import RequirementOutlineTree from './RequirementOutlineTree.vue'
import RequirementsPrototypePreview from './RequirementsPrototypePreview.vue'
import RequirementOverview from './RequirementOverview.vue'
import ModuleEditDialog from './ModuleEditDialog.vue'
import AppTemplateSwitchDialog from './AppTemplateSwitchDialog.vue'
import ModuleReplanDialog from './ModuleReplanDialog.vue'
import {
  DocApiError,
  SECTION_KIND_LABELS,
  applyRequirementModulePlan,
  archiveRequirementModule,
  confirmRequirementBundle,
  confirmRequirementDoc,
  createRequirementModule,
  exportRequirementDoc,
  getRequirementBundle,
  getRequirementDoc,
  listRequirementModules,
  rebuildRequirementOutline,
  reopenRequirementDoc,
  reorderRequirementModules,
  restoreRequirementModule,
  saveDocFull,
  saveDocSection,
  streamModuleGeneration,
  updateRequirementModule,
  type AppTemplateSwitchResult,
  type ModuleGenerationReason,
  type ModulePlan,
  type ModulePlanUiState,
  type ModuleReplanApplyResult,
  type RequirementBundle,
  type RequirementDocPayload,
  type RequirementDocSection,
  type RequirementModule,
  type RequirementOutlineData,
  type RequirementTemplate,
  type TemplateSectionKind
} from './api'
import { validateDocSections } from './doc-protocol.js'
import {
  activeSectionFromTops,
  createModuleGate,
  hasDivergentTemplates,
  moveModuleIds,
  nextModuleAfterArchive,
  progressOf,
  readStoredModuleId,
  resolveInitialModule,
  resolveSectionTarget,
  scrollAtBottom,
  shortHash,
  writeStoredModuleId
} from './module-helpers.js'
import {
  createGenerationState,
  firstGeneratedModuleId,
  initialPlanEligible,
  reduceGenerationEvent
} from './module-plan-helpers.js'
import { changeSetBaseLabel } from '../changesets/labels.js'
import {
  changeScopeModuleIds,
  changeSetModuleLabel,
  isChangeScopeComplete,
  isModuleInChangeScope
} from '../changesets/module-scope.js'
import { changeSetInitialPrompt, changeSetPrefillKey } from '../changesets/change-set-prompt.js'
import type { ChangeSetInfo } from '../workbench/api'

const EMPTY_OUTLINE: RequirementOutlineData = { scenes: [], epics: [], stories: [] }

const props = defineProps<{
  appId: string
  appName: string
  /** 应用当前阶段（M3：非 requirements 整页只读） */
  appStatus?: string
  activeChangeSet?: ChangeSetInfo | null
}>()
const emit = defineEmits<{ confirmed: []; reopened: []; 'open-change-set': [] }>()

const allModules = ref<RequirementModule[]>([])
const defaultModuleId = ref<string | null>(null)
/** RMP-2：当前已应用计划类型（initial/replan/null；用于 RMP-1 旧建议卡禁用“重新生成全部模块”） */
const appliedPlanKind = ref<'initial' | 'replan' | null>(null)
const selectedModuleId = ref('')
const payload = ref<RequirementDocPayload | null>(null)
const bundle = ref<RequirementBundle | null>(null)
const bundleLoading = ref(false)
const loading = ref(true)
const error = ref('')
const focusSectionKey = ref('')
/** 大纲滚动高亮（只做视觉，不回写对话焦点） */
const activeSectionKey = ref('')
/** 跨模块章节跳转：切模块后 nextTick 再定位 */
const pendingScrollKey = ref('')
/** 手风琴：当前展开的模块（最多一个；空 = 全部收起） */
const outlineExpandedId = ref('')
// 窄屏（≤1024）抽屉：对话 / 大纲；宽屏由 CSS 忽略这两个状态
const chatOpen = ref(false)
const outlineOpen = ref(false)
const mode = ref<'edit' | 'preview' | 'source'>('edit')
/** M7 / M7-2：文档视图 / 模块 AI 参考原型（只读）；章节点击/切模块回到文档 */
const view = ref<'doc' | 'prototype'>('doc')
/** M7：手动刷新预览（只影响 refreshKey，不写库） */
const prototypeNonce = ref(0)
const sourceText = ref('')
const sourceSaving = ref(false)
const previewKey = ref('')
const templateOpen = ref(false)
const versionOpen = ref(false)
const overviewOpen = ref(false)
const moduleDialogOpen = ref(false)
const moduleDialogMode = ref<'create' | 'edit'>('create')
const editingModule = ref<RequirementModule | null>(null)
const moduleSaving = ref(false)
const switchTemplateOpen = ref(false)
const switchTemplate = ref<RequirementTemplate | null>(null)
/** RMP-2：随时重新规划弹窗 + 生成中状态（生成中禁用 Composer/入口） */
const replanOpen = ref(false)
const replanBusy = ref(false)
const confirming = ref(false)
const completing = ref(false)
const reopening = ref(false)
const rebuilding = ref('')
const saveState = ref<'saved' | 'saving' | 'dirty' | 'error'>('saved')
/** G1：文档保存/确认返回的非阻塞警告（如引用了不存在的模块 MOD-xxx） */
const docWarnings = ref<string[]>([])
const warningsDismissed = ref(false)
const activeKey = ref('')
const docScrollRef = ref<HTMLElement | null>(null)
const chatRef = ref<InstanceType<typeof DocChatPanel> | null>(null)
/** RMP-1：首次模块规划/逐模块生成运行态（父组件持有，刷新后由模块/文档推导已应用结果） */
const planState = ref<ModulePlanUiState>({
  status: 'idle',
  mode: null,
  error: '',
  applied: null,
  generation: null
})
let generationAbort: AbortController | null = null
let generationSeq = 0
const textareas = new Map<string, HTMLTextAreaElement>()
const markdownViewKeys = reactive(new Set<string>())
const pendingOutlines = reactive(new Map<string, RequirementOutlineData>())
const outlineTimers = new Map<string, ReturnType<typeof setTimeout>>()
let outlineChain: Promise<void> = Promise.resolve()

const dirty = reactive(new Set<string>())
let saveTimer: ReturnType<typeof setTimeout> | null = null
let flushChain: Promise<boolean> | null = null
let loadedOnce = false

const appStatus = computed(() => props.appStatus ?? 'requirements')
const stageReadonly = computed(() => appStatus.value !== 'requirements')
const activeModules = computed(() => allModules.value.filter(module => !module.archived))
const archivedModules = computed(() => allModules.value.filter(module => module.archived))
const currentModule = computed(() => allModules.value.find(module => module.id === selectedModuleId.value) ?? null)
const progress = computed(() => progressOf(allModules.value))
const templatesDiverged = computed(() => hasDivergentTemplates(allModules.value, payload.value?.template.id ?? ''))
const pendingLabel = computed(() => progress.value.pending.map(item => item.title).join('、'))
const bundleDrifted = computed(() => Boolean(bundle.value?.latest && bundle.value.latest.hash !== bundle.value.bundleHash))
const docStatus = computed(() => payload.value?.doc.status ?? 'draft')
const docConfirmed = computed(() => docStatus.value === 'confirmed')
const currentArchived = computed(() => currentModule.value?.archived === true)
// M5：本次变更模块范围（旧变更单没有 modules → 空 = 不限制）
const changeScopeIds = computed(() => changeScopeModuleIds(props.activeChangeSet ?? null))
const changeScopeLabel = computed(() => changeSetModuleLabel(props.activeChangeSet ?? null))
const currentOutOfScope = computed(
  () => Boolean(selectedModuleId.value) && !isModuleInChangeScope(props.activeChangeSet ?? null, selectedModuleId.value)
)
// 应用级模板切换会改全部模块：变更只覆盖部分模块时禁用
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
  () => docConfirmed.value || stageReadonly.value || currentArchived.value || currentOutOfScope.value
)
const canCompleteRequirements = computed(() => appStatus.value === 'requirements' && progress.value.allRequiredConfirmed)
/** RMP-2 入口：requirements + 无 active Change Set + 最终未确认（最终确认后 app 已进 design） */
const replanAvailable = computed(
  () =>
    appStatus.value === 'requirements' &&
    !props.activeChangeSet &&
    Boolean(payload.value) &&
    activeModules.value.length > 0 &&
    !planEligible.value &&
    planState.value.status !== 'applying' &&
    !planState.value.generation?.running
)
const replanHint = computed(() => {
  if (appStatus.value === 'design') {
    return '当前处于设计阶段：不能直接重新规划模块；需求变更请发起“需求+设计”变更（或先重新编辑需求回到需求阶段）'
  }
  if (appStatus.value !== 'requirements') {
    return '开发/完成阶段需求已锁定：需求变更请发起“需求+设计”变更'
  }
  if (props.activeChangeSet) return '变更进行中：请先完成或取消本次变更（RMP-2 不做 Change Set 内重规划）'
  if (!activeModules.value.length) return '应用还没有未归档模块，无法重新规划'
  if (planEligible.value) return '首次模块拆分未完成：请先在建议卡完成“应用拆分并生成”或“保持单模块”，再使用 AI 规划模块'
  if (planState.value.status === 'applying' || planState.value.generation?.running) {
    return '模块生成中：请等待完成或取消后再重新规划'
  }
  return '根据当前全部需求内容重新拆分模块：keep / rename / regenerate / create，未匹配旧模块归档'
})
const activeChangeSetLabel = computed(() => changeSetBaseLabel(props.activeChangeSet ?? null))
// #4：变更单信息只预填到需求对话输入框（初始开发 #1 / 无变更单不预填，不自动发送）
const initialChatPrompt = computed(() => changeSetInitialPrompt(props.activeChangeSet ?? null))
// #4：同一变更单只预填一次（localStorage 标记 key：应用 + 变更单 ID）
const initialChatPrefillKey = computed(() => changeSetPrefillKey(props.appId, props.activeChangeSet ?? null))
const statusLabel = computed(() => (docStatus.value === 'confirmed' ? '已确认' : docStatus.value === 'review' ? '待审核' : '草稿'))
const saveLabel = computed(() => {
  if (saveState.value === 'saving') return '保存中…'
  if (saveState.value === 'dirty') return '未保存'
  if (saveState.value === 'error') return '保存失败'
  return '已保存'
})
/** G1：可关闭的黄色告警条（保存/确认带到页面的 warnings） */
const visibleDocWarnings = computed(() => (warningsDismissed.value ? [] : docWarnings.value))
const showOnboarding = computed(() => {
  if (!payload.value) return false
  if (payload.value.doc.version > 1) return false
  return payload.value.sections.every(section => !section.markdown.trim())
})
const previewMarkdown = computed(() => {
  if (!payload.value) return ''
  const parts: string[] = [`# ${payload.value.doc.title}`]
  for (const section of payload.value.sections) {
    parts.push(`${'#'.repeat(section.level)} ${section.title}`)
    if (section.markdown.trim()) parts.push(section.markdown.trim())
  }
  return `${parts.join('\n\n')}\n`
})
const allScenes = computed(() => payload.value?.sections.flatMap(section => section.data?.scenes ?? []) ?? [])
/** M7：预览自动刷新键（文档保存/AI 应用/版本回滚都会改 updatedAt 或 version） */
const maxSectionUpdatedAt = computed(() =>
  (payload.value?.sections ?? []).reduce((max, section) => (section.updatedAt > max ? section.updatedAt : max), '')
)
const prototypeRefreshKey = computed(() => {
  if (!payload.value) return ''
  return `${payload.value.doc.updatedAt}|${payload.value.doc.version}|${maxSectionUpdatedAt.value}|${prototypeNonce.value}`
})

// ------------------------------------------------------------ RMP-1：首次模块规划

/** 首次规划资格（保守预判；后端 chat/apply 会再校验） */
const planEligible = computed(() =>
  initialPlanEligible({
    appStatus: appStatus.value,
    hasActiveChangeSet: Boolean(props.activeChangeSet),
    modules: allModules.value,
    selectedModuleId: selectedModuleId.value,
    doc: payload.value?.doc ?? null,
    sections: payload.value?.sections ?? []
  })
)
/** 新输入是否走 doc-plan：资格满足且本次流程未结束（已应用/已保持单模块后关闭） */
const planMode = computed(
  () => planEligible.value && planState.value.status !== 'done' && planState.value.mode === null
)
/** 刷新/重进后从模块与文档推导“已应用”状态（运行态优先） */
const planOutcome = computed<{ status: 'done'; mode: 'split' | 'single' } | null>(() => {
  if (planState.value.mode) return { status: 'done', mode: planState.value.mode }
  if (activeModules.value.length > 1) return { status: 'done', mode: 'split' }
  if (payload.value?.sections.some(section => section.markdown.trim())) return { status: 'done', mode: 'single' }
  return null
})

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function persistModule(id: string): void {
  writeStoredModuleId(safeLocalStorage(), props.appId, id)
}

function isStructured(section: RequirementDocSection): boolean {
  return section.kind === 'scenes' || section.kind === 'epics'
}

/** 有结构化数据时默认显示结构编辑器；用户可切到 Markdown */
function structuredView(section: RequirementDocSection): boolean {
  return isStructured(section) && !markdownViewKeys.has(section.sectionKey)
}

function syncStructureDefault(next: RequirementDocPayload | null): void {
  if (!next) return
  for (const section of next.sections) {
    if (!isStructured(section)) continue
    const hasData = Boolean(section.data && (section.data.scenes.length || section.data.epics.length || section.data.stories.length))
    if (hasData) markdownViewKeys.delete(section.sectionKey)
    else markdownViewKeys.add(section.sectionKey)
  }
}

function setStructureMode(key: string, structured: boolean): void {
  if (structured) markdownViewKeys.delete(key)
  else markdownViewKeys.add(key)
}

function applyPayload(next: RequirementDocPayload | null): void {
  if (!next) return
  payload.value = next
  sourceText.value = next.doc.contentMd
  noteDocWarnings(next.warnings)
}

/** G1：把保存/确认返回的 warnings 合并到页面告警条（去重；新警告重新展开） */
function noteDocWarnings(warnings: string[] | undefined | null): void {
  if (!warnings || !warnings.length) return
  const merged = [...docWarnings.value]
  for (const warning of warnings) {
    if (!merged.includes(warning)) merged.push(warning)
  }
  docWarnings.value = merged
  warningsDismissed.value = false
}

function dismissDocWarnings(): void {
  warningsDismissed.value = true
}

/** G1：切换模块/重新加载时清空告警条，避免把上一个模块的警告带过来 */
function clearDocWarnings(): void {
  docWarnings.value = []
  warningsDismissed.value = false
}

/** 切换模块/重新加载文档时重置编辑态（焦点、结构视图、待保存草稿、滚动） */
function resetDocView(next: RequirementDocPayload): void {
  for (const timer of outlineTimers.values()) clearTimeout(timer)
  outlineTimers.clear()
  pendingOutlines.clear()
  dirty.clear()
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  markdownViewKeys.clear()
  focusSectionKey.value = ''
  previewKey.value = ''
  activeKey.value = ''
  activeSectionKey.value = ''
  mode.value = 'edit'
  clearDocWarnings()
  applyPayload(next)
  syncStructureDefault(next)
  saveState.value = 'saved'
  const el = docScrollRef.value
  if (el) el.scrollTop = 0
}

async function queueOutlineSave(section: RequirementDocSection, data: RequirementOutlineData): Promise<void> {
  pendingOutlines.set(section.sectionKey, data)
  const existing = outlineTimers.get(section.sectionKey)
  if (existing) clearTimeout(existing)
  outlineTimers.set(
    section.sectionKey,
    setTimeout(() => {
      outlineTimers.delete(section.sectionKey)
      void flushOutlines()
    }, 800)
  )
}

function onOutlineChange(section: RequirementDocSection, data: RequirementOutlineData): void {
  if (readonly.value) return
  saveState.value = 'dirty'
  void queueOutlineSave(section, data)
}

async function flushOutlines(): Promise<boolean> {
  for (const timer of outlineTimers.values()) clearTimeout(timer)
  outlineTimers.clear()
  if (!pendingOutlines.size) {
    await outlineChain
    return saveState.value !== 'error'
  }
  const entries = Array.from(pendingOutlines.entries())
  pendingOutlines.clear()
  outlineChain = outlineChain.then(async () => {
    saveState.value = 'saving'
    try {
      for (const [key, data] of entries) {
        const result = await saveDocSection(props.appId, key, { data, snapshot: false }, selectedModuleId.value || undefined)
        applyPayload(result)
        noteDocWarnings(result.warnings)
        if (result.warnings?.length) ElMessage.warning(result.warnings.join('；'))
      }
      saveState.value = 'saved'
    } catch (err) {
      saveState.value = 'error'
      showDocError(err, '保存结构化章节失败')
    }
  })
  await outlineChain
  return saveState.value !== 'error'
}

async function rebuildSection(key: string): Promise<void> {
  if (readonly.value || rebuilding.value) return
  rebuilding.value = key
  try {
    if (!(await flushAll())) throw new Error('当前模块还有未保存内容')
    const result = await rebuildRequirementOutline(props.appId, key, selectedModuleId.value || undefined)
    applyPayload(result)
    markdownViewKeys.delete(key)
    if (result.warnings?.length) ElMessage.warning(result.warnings.join('；'))
    else ElMessage.success('已从 Markdown 重建结构化条目')
  } catch (err) {
    showDocError(err, '重建结构失败')
  } finally {
    rebuilding.value = ''
  }
}

async function reopenDoc(): Promise<void> {
  if (reopening.value || !currentModule.value) return
  try {
    await ElMessageBox.confirm(
      appStatus.value === 'design'
        ? '重新编辑需求会把本模块需求文档改回草稿、应用回到需求阶段，设计会暂时锁定；已生成的设计/原型保留，但会标记为“设计输入过期”，需要重新完成需求阶段后再同步。'
        : '重新编辑需求会把本模块需求文档改回草稿，需重新确认；其它模块不受影响。',
      '重新编辑需求',
      { type: 'warning', confirmButtonText: '重新编辑', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  reopening.value = true
  try {
    const result = await reopenRequirementDoc(props.appId, selectedModuleId.value || undefined)
    resetDocView(result)
    await afterDocLoaded()
    await refreshModules()
    await loadBundle()
    ElMessage.success('需求已回到草稿，可以继续编辑')
    emit('reopened')
  } catch (err) {
    showDocError(err, '重新编辑需求失败')
  } finally {
    reopening.value = false
  }
}

function kindLabel(kind: TemplateSectionKind): string {
  return SECTION_KIND_LABELS[kind] ?? kind
}

function guidanceFor(section: RequirementDocSection): string {
  return payload.value?.template.sections.find(item => item.id === section.sectionKey)?.guidance ?? ''
}

async function refreshModules(): Promise<void> {
  const data = await listRequirementModules(props.appId, true)
  allModules.value = data.modules
  defaultModuleId.value = data.defaultModuleId
  appliedPlanKind.value = data.planKind
}

async function loadBundle(): Promise<void> {
  bundleLoading.value = true
  try {
    bundle.value = await getRequirementBundle(props.appId)
  } catch {
    bundle.value = null
  } finally {
    bundleLoading.value = false
  }
}

function sectionKeys(): string[] {
  return payload.value?.sections.map(section => section.sectionKey) ?? []
}

function scrollSectionIntoView(key: string, behavior: 'auto' | 'smooth'): void {
  const el = document.getElementById(`doc-sec-${key}`)
  if (el) el.scrollIntoView({ block: 'start', behavior })
}

/**
 * 文档加载/刷新后：处理跨模块待定位章节（不存在则回退第一节并提示），
 * 初始化滚动高亮到目标/第一节。
 */
async function afterDocLoaded(): Promise<void> {
  await nextTick()
  const preferred = pendingScrollKey.value
  pendingScrollKey.value = ''
  const target = resolveSectionTarget(sectionKeys(), preferred)
  activeSectionKey.value = target.key
  // 只有跨模块跳转（pending 非空）才滚动；普通加载/切模块保持 scrollTop=0，
  // 避免把新手引导/只读/已确认/已归档/变更范围横幅顶出视口。
  if (preferred && target.key && mode.value === 'edit') {
    scrollSectionIntoView(target.key, 'auto')
  }
  if (preferred && target.fallback) ElMessage.info('目标章节已不存在（模板可能已变化），已定位到第一节')
  void nextTick(scheduleSpy)
}

async function loadDoc(): Promise<boolean> {
  loading.value = true
  error.value = ''
  try {
    const next = await getRequirementDoc(props.appId, undefined, selectedModuleId.value || undefined)
    selectedModuleId.value = next.doc.moduleId
    persistModule(selectedModuleId.value)
    resetDocView(next)
    loadedOnce = true
    await afterDocLoaded()
    return true
  } catch (err) {
    // 加载失败不要保留待定位目标，避免影响下次切换
    pendingScrollKey.value = ''
    error.value = err instanceof Error ? err.message : String(err)
    return false
  } finally {
    loading.value = false
  }
}

async function boot(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    await refreshModules()
    const resolved = resolveInitialModule(allModules.value, {
      defaultModuleId: defaultModuleId.value ?? '',
      storedId: readStoredModuleId(safeLocalStorage(), props.appId)
    })
    if (resolved.reason === 'stored-archived') ElMessage.info('上次选中的模块已归档，已切换到默认模块')
    else if (resolved.reason === 'stored-missing') ElMessage.info('上次选中的模块已不存在，已切换到默认模块')
    selectedModuleId.value = resolved.moduleId ?? ''
    const next = await getRequirementDoc(props.appId, undefined, selectedModuleId.value || undefined)
    selectedModuleId.value = next.doc.moduleId
    persistModule(selectedModuleId.value)
    // 新应用首次打开会懒创建默认模块：再拉一次列表以显示模块信息
    await refreshModules()
    resetDocView(next)
    loadedOnce = true
    await afterDocLoaded()
    await loadBundle()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

void boot()

/** 切模块：先落盘当前模块未保存编辑；失败则中止切换（避免丢内容/写错模块） */
async function switchModule(id: string): Promise<boolean> {
  if (!id) return false
  if (id === selectedModuleId.value) {
    closePanes()
    return true
  }
  if (!(await flushAll())) {
    ElMessage.warning('当前模块还有未保存内容，已取消切换；请先处理保存失败')
    return false
  }
  // M7：切模块回到文档视图（原型预览按模块独立）
  view.value = 'doc'
  selectedModuleId.value = id
  persistModule(id)
  closePanes()
  return await loadDoc()
}

/** 大纲根节点：当前模块切换折叠；其它模块走 switchModule（手风琴随之展开新模块） */
async function toggleOutlineModule(id: string): Promise<void> {
  if (!id) return
  if (id === selectedModuleId.value) {
    outlineExpandedId.value = outlineExpandedId.value === id ? '' : id
    if (outlineExpandedId.value) void nextTick(scheduleSpy)
    return
  }
  await switchModule(id)
}

/**
 * 章节跳转：同模块直接滚动；跨模块记录 pending → 切模块 → loadDoc 后定位。
 * 预览/全文源码模式没有章节卡片：只切模块，不强制滚动（保持现有行为）。
 */
async function jumpToSection(moduleId: string, sectionKey: string): Promise<void> {
  if (!moduleId || !sectionKey) return
  // M7：章节点击退出原型预览，回到章节编辑
  if (view.value === 'prototype') {
    view.value = 'doc'
    mode.value = 'edit'
    outlineOpen.value = false
    await nextTick()
  }
  if (moduleId === selectedModuleId.value) {
    scrollToSection(sectionKey)
    return
  }
  if (mode.value !== 'edit') {
    await switchModule(moduleId)
    return
  }
  pendingScrollKey.value = sectionKey
  const switched = await switchModule(moduleId)
  if (!switched) pendingScrollKey.value = ''
}

// ------------------------------------------------------------ M7：模块原型预览（只读）

/** 大纲「原型预览」节点：切模块（含 flush）后进入预览；失败保持原状 */
async function onOutlinePrototype(moduleId: string): Promise<void> {
  if (!moduleId) return
  if (moduleId !== selectedModuleId.value) {
    const switched = await switchModule(moduleId)
    if (!switched) return
  } else if (!(await flushAll())) {
    ElMessage.warning('当前模块还有未保存内容，预览可能不含最新修改；请先处理保存失败')
  }
  view.value = 'prototype'
  closePanes()
  if (spyRaf) {
    cancelAnimationFrame(spyRaf)
    spyRaf = 0
  }
  activeSectionKey.value = ''
  await nextTick()
  if (docScrollRef.value) docScrollRef.value.scrollTop = 0
}

/** 预览内「查看文档 / 去补充需求」：回到章节编辑并定位 Epics 章节 */
async function openPrototypeDoc(): Promise<void> {
  const key = payload.value?.sections.find(section => section.sectionKey === 'epics')?.sectionKey ?? ''
  view.value = 'doc'
  mode.value = 'edit'
  await nextTick()
  if (!key) return
  scrollToSection(key)
}

/** 预览头部「返回文档」：回到章节编辑，保持当前定位 */
async function backToDoc(): Promise<void> {
  view.value = 'doc'
  await nextTick()
  void nextTick(scheduleSpy)
}

/** 手动刷新预览：先尽量落盘未保存编辑（只读预览不写库） */
async function refreshPrototype(): Promise<void> {
  const saved = await flushAll()
  if (!saved) ElMessage.warning('当前模块还有未保存内容，预览可能不含最新修改')
  prototypeNonce.value += 1
}

function setTextarea(key: string, element: unknown): void {
  const el = element as HTMLTextAreaElement | null
  if (el) textareas.set(key, el)
  else textareas.delete(key)
}

function sectionRows(section: RequirementDocSection): number {
  const lines = section.markdown.split('\n').length
  return Math.min(Math.max(lines + 2, 4), 18)
}

function onSectionInput(key: string): void {
  dirty.add(key)
  saveState.value = 'dirty'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void flushSave()
  }, 1000)
}

async function doFlush(): Promise<boolean> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  while (dirty.size && payload.value) {
    const keys = Array.from(dirty)
    dirty.clear()
    saveState.value = 'saving'
    for (const key of keys) {
      const section = payload.value.sections.find(item => item.sectionKey === key)
      if (!section) continue
      try {
        const result = await saveDocSection(
          props.appId,
          key,
          { markdown: section.markdown, snapshot: false },
          selectedModuleId.value || undefined
        )
        if (payload.value) {
          payload.value.doc = result.doc
          const updated = result.sections.find(item => item.sectionKey === key)
          if (updated && (updated.kind === 'scenes' || updated.kind === 'epics')) {
            section.markdown = updated.markdown
            section.data = updated.data
          }
        }
        noteDocWarnings(result.warnings)
        if (result.warnings?.length) ElMessage.warning(result.warnings.join('；'))
      } catch (err) {
        dirty.add(key)
        saveState.value = 'error'
        ElMessage.error(`章节「${section.title}」保存失败：${err instanceof Error ? err.message : String(err)}`)
        return false
      }
    }
  }
  saveState.value = 'saved'
  return true
}

function flushSave(): Promise<boolean> {
  if (flushChain) return flushChain
  flushChain = doFlush().finally(() => {
    flushChain = null
  })
  return flushChain
}

/** 落盘手动编辑（Markdown + 结构化章节）；返回是否全部成功 */
async function flushAll(): Promise<boolean> {
  const saved = await flushSave()
  const outlines = await flushOutlines()
  return saved && outlines
}

/** 发送对话/应用 AI 建议前：落盘手动编辑；失败抛错让对话提示重试 */
async function flushBeforeAi(): Promise<void> {
  if (!(await flushAll())) throw new Error('文档尚未保存成功')
}

async function onAiChanged(next: RequirementDocPayload | null): Promise<void> {
  if (!next) return
  payload.value = next
  sourceText.value = next.doc.contentMd
  noteDocWarnings(next.warnings)
  syncStructureDefault(next)
  dirty.clear()
  saveState.value = 'saved'
  if (focusSectionKey.value && !next.sections.some(section => section.sectionKey === focusSectionKey.value)) {
    focusSectionKey.value = ''
  }
  const target = resolveSectionTarget(
    next.sections.map(section => section.sectionKey),
    activeSectionKey.value
  )
  activeSectionKey.value = target.key
  void nextTick(scheduleSpy)
  await refreshModules()
}

function askAi(key: string): void {
  if (readonly.value) return
  focusSectionKey.value = key
  mode.value = 'edit'
  // 当前模块被收起时也展开大纲，确保能看到焦点章节高亮（不自动打开窄屏抽屉）
  outlineExpandedId.value = selectedModuleId.value
  // 点“问 AI”时大纲同步高亮焦点章节；短暂抑制 scroll spy，避免被当前滚动位置覆盖
  spySuppressedUntil = Date.now() + 400
  activeSectionKey.value = key
  chatOpen.value = true
  void nextTick(() => {
    activeSectionKey.value = key
    chatRef.value?.focusComposer()
  })
}

function closePanes(): void {
  chatOpen.value = false
  outlineOpen.value = false
}

function onPaneKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (chatOpen.value || outlineOpen.value) closePanes()
}

// ------------------------------------------------------------ 大纲滚动高亮（scroll spy）

let spyTarget: HTMLElement | null = null
let spyRaf = 0
let spySuppressedUntil = 0

function scheduleSpy(): void {
  if (mode.value !== 'edit' || view.value === 'prototype') return
  if (spyRaf) return
  spyRaf = requestAnimationFrame(() => {
    spyRaf = 0
    computeActiveSection()
  })
}

function computeActiveSection(): void {
  if (mode.value !== 'edit' || view.value === 'prototype') {
    activeSectionKey.value = ''
    return
  }
  if (Date.now() < spySuppressedUntil) return
  const scroll = docScrollRef.value
  if (!scroll || !payload.value) return
  const rectTop = scroll.getBoundingClientRect().top
  const items = payload.value.sections.map(section => {
    const el = document.getElementById(`doc-sec-${section.sectionKey}`)
    return { key: section.sectionKey, top: el ? el.getBoundingClientRect().top - rectTop : Number.POSITIVE_INFINITY }
  })
  if (!items.length) {
    activeSectionKey.value = ''
    return
  }
  const atBottom = scrollAtBottom(scroll, 4)
  const next = activeSectionFromTops(items, { offset: 24, atBottom })
  activeSectionKey.value = typeof next === 'string' ? next : ''
}

function onDocScroll(): void {
  scheduleSpy()
}

/** .doc-scroll 只在有 payload 时渲染：ref 变化时重新绑定滚动监听 */
function bindScrollSpy(el: HTMLElement | null): void {
  if (spyTarget === el) return
  if (spyTarget) spyTarget.removeEventListener('scroll', onDocScroll)
  spyTarget = el
  if (el) el.addEventListener('scroll', onDocScroll, { passive: true })
}

watch(docScrollRef, el => bindScrollSpy((el as HTMLElement | null) ?? null), { flush: 'post' })
watch(mode, value => {
  if (value !== 'edit') {
    if (spyRaf) {
      cancelAnimationFrame(spyRaf)
      spyRaf = 0
    }
    activeSectionKey.value = ''
    return
  }
  void nextTick(scheduleSpy)
})
watch(selectedModuleId, id => {
  // 切模块成功后由 selectedModuleId 驱动手风琴（最多一个展开）
  outlineExpandedId.value = id
})

onMounted(() => window.addEventListener('keydown', onPaneKeydown))

function scrollToSection(key: string): void {
  outlineOpen.value = false
  const target = resolveSectionTarget(sectionKeys(), key)
  if (!target.key) return
  activeSectionKey.value = target.key
  if (mode.value === 'edit') scrollSectionIntoView(target.key, 'smooth')
}

function toggleSectionPreview(key: string): void {
  previewKey.value = previewKey.value === key ? '' : key
}

function currentTextarea(): HTMLTextAreaElement | null {
  const key = activeKey.value || payload.value?.sections[0]?.sectionKey || ''
  return key ? textareas.get(key) ?? null : null
}

function applyMarkdown(prefix: string, suffix: string, fallback: string): void {
  const key = activeKey.value
  const section = payload.value?.sections.find(item => item.sectionKey === key)
  const el = currentTextarea()
  if (!section) return
  if (!el) {
    section.markdown += `${fallback}`
    onSectionInput(section.sectionKey)
    return
  }
  const start = el.selectionStart ?? section.markdown.length
  const end = el.selectionEnd ?? start
  const selected = section.markdown.slice(start, end)
  const inserted = selected ? `${prefix}${selected}${suffix}` : fallback
  section.markdown = `${section.markdown.slice(0, start)}${inserted}${section.markdown.slice(end)}`
  onSectionInput(section.sectionKey)
  void nextTick(() => {
    el.focus()
    el.selectionStart = el.selectionEnd = start + inserted.length
  })
}

function wrapSelection(prefix: string, suffix: string): void {
  applyMarkdown(prefix, suffix, `${prefix}文本${suffix}`)
}

function insertLine(prefix: string): void {
  applyMarkdown(`\n${prefix}`, '', `${prefix}文本`)
}

function insertLink(): void {
  applyMarkdown('[', '](https://)', '[链接文字](https://)')
}

function switchSource(): void {
  if (mode.value !== 'source') {
    sourceText.value = previewMarkdown.value
    mode.value = 'source'
  }
}

async function saveSource(): Promise<void> {
  sourceSaving.value = true
  try {
    if (!(await flushAll())) throw new Error('当前模块还有未保存内容')
    const result = await saveDocFull(
      props.appId,
      { contentMd: sourceText.value, source: 'manual' },
      selectedModuleId.value || undefined
    )
    payload.value = result
    sourceText.value = result.doc.contentMd
    saveState.value = 'saved'
    activeSectionKey.value = resolveSectionTarget(
      result.sections.map(section => section.sectionKey),
      activeSectionKey.value
    ).key
    ElMessage.success(`全文已保存（v${result.doc.version}）`)
  } catch (err) {
    showDocError(err, '保存全文失败')
  } finally {
    sourceSaving.value = false
  }
}

function showDocError(err: unknown, fallback: string): void {
  if (err instanceof DocApiError) {
    if (err.issues.length) {
      const lines = err.issues
        .map(issue => `• ${issue.title || issue.sectionKey || '章节'}：${issue.message}`)
        .join('\n')
      void ElMessageBox.alert(lines, err.message, { type: 'warning', confirmButtonText: '知道了' })
      return
    }
    ElMessage.error(err.message)
    return
  }
  ElMessage.error(err instanceof Error ? err.message : `${fallback}：${String(err)}`)
}

/** 确认当前模块（多模块不离开需求页；单模块保持旧行为进入设计） */
async function confirmDoc(): Promise<void> {
  if (readonly.value || confirming.value || !currentModule.value) return
  const validation = validateDocSections(payload.value?.sections ?? [])
  if (validation.errors.length) {
    const lines = validation.errors.map(error => `• ${error.title}：${error.message}`).join('\n')
    void ElMessageBox.alert(lines, '需求文档尚未满足确认条件', { type: 'warning', confirmButtonText: '继续编辑' })
    return
  }
  const multiModule = activeModules.value.length > 1
  try {
    await ElMessageBox.confirm(
      multiModule
        ? `确认「${currentModule.value.title}」？本模块文档将变为只读，但仍停留在需求阶段；全部必选模块确认后，在“需求总览”完成需求阶段。\n校验：必填章节非空、至少一个 Epics/User Story；待澄清问题只做警告。`
        : '确认需求后文档变为只读，并进入设计阶段。\n校验：必填章节非空、至少一个 Epics/User Story；待澄清问题只做警告。',
      multiModule ? '确认本模块需求' : '确认需求',
      { type: 'warning', confirmButtonText: multiModule ? '确认本模块' : '确认并进入设计', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  confirming.value = true
  try {
    if (!(await flushAll())) throw new Error('当前模块还有未保存内容')
    const result = await confirmRequirementDoc(props.appId, selectedModuleId.value || undefined)
    applyPayload(result)
    sourceText.value = result.doc.contentMd
    dirty.clear()
    saveState.value = 'saved'
    await refreshModules()
    await loadBundle()
    const pending = result.pendingModuleIds ?? []
    if (result.appConfirmed) {
      ElMessage.success('需求已确认，已进入设计阶段')
      if (result.warnings.length) {
        void ElMessageBox.alert(result.warnings.map(line => `• ${line}`).join('\n'), '待澄清提示（不阻塞）', {
          type: 'info',
          confirmButtonText: '知道了'
        })
      }
      emit('confirmed')
      return
    }
    ElMessage.success(
      pending.length
        ? `「${currentModule.value?.title ?? '模块'}」已确认；还有 ${pending.length} 个必选模块待确认`
        : `「${currentModule.value?.title ?? '模块'}」已确认；可在“需求总览”完成需求阶段`
    )
    if (result.warnings.length) {
      void ElMessageBox.alert(result.warnings.map(line => `• ${line}`).join('\n'), '待澄清提示（不阻塞）', {
        type: 'info',
        confirmButtonText: '知道了'
      })
    }
    // 多模块：自动跳到下一个待确认模块，减少来回点选
    if (pending.length) await switchModule(pending[0])
  } catch (err) {
    showDocError(err, '确认需求失败')
  } finally {
    confirming.value = false
  }
}

/** 应用级“完成需求阶段”：全部必选模块确认后生成 bundle 并进入设计 */
async function completeRequirements(): Promise<void> {
  if (completing.value || !canCompleteRequirements.value) return
  try {
    await ElMessageBox.confirm(
      '将按当前所有未归档模块的内容生成需求聚合版本，并进入设计阶段；之后如需修改需求要重新编辑或发起变更。',
      '完成需求阶段',
      { type: 'warning', confirmButtonText: '完成并进入设计', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  completing.value = true
  try {
    if (!(await flushAll())) throw new Error('当前模块还有未保存内容')
    const result = await confirmRequirementBundle(props.appId)
    await loadBundle()
    await refreshModules()
    const version = result.bundle?.latest?.version
    ElMessage.success(version ? `需求阶段已完成（聚合 v${version}）` : '需求阶段已完成')
    overviewOpen.value = false
    emit('confirmed')
  } catch (err) {
    showDocError(err, '完成需求阶段失败')
  } finally {
    completing.value = false
  }
}

// ------------------------------------------------------------ RMP-1：规划应用与逐模块生成

/**
 * 应用模块拆分：先落盘当前模块编辑 → apply（复用默认模块 + 新建）→ 刷新 → 逐模块生成。
 * 生成失败不阻塞结构应用；重试/取消由进度组件触发。
 */
async function onApplyPlan(plan: ModulePlan): Promise<void> {
  if (planState.value.status === 'applying' || planState.value.generation?.running) return
  planState.value = { status: 'applying', mode: 'split', error: '', applied: null, generation: null }
  try {
    if (!(await flushAll())) throw new Error('当前模块还有未保存内容')
    const applied = await applyRequirementModulePlan(props.appId, plan)
    planState.value.applied = applied
    await refreshModules()
    await loadBundle()
    const firstId = applied.modules[0]?.id
    if (firstId) {
      selectedModuleId.value = firstId
      persistModule(firstId)
      await loadDoc()
    }
    ElMessage.success(`已创建 ${applied.modules.length} 个模块，开始逐模块生成…`)
    await runModuleGeneration(
      applied.generation.map(item => ({ moduleId: item.moduleId, title: item.title })),
      'initial'
    )
  } catch (err) {
    planState.value.status = 'error'
    planState.value.mode = null
    planState.value.error = err instanceof Error ? err.message : String(err)
    showDocError(err, '应用模块拆分失败')
  }
}

/** 保持单模块：不 apply 结构，只生成当前唯一模块 */
async function onKeepSingle(): Promise<void> {
  if (planState.value.generation?.running || planState.value.status === 'applying') return
  const module = activeModules.value[0]
  if (!module) {
    ElMessage.warning('没有可生成的需求模块')
    return
  }
  planState.value = { status: 'generating', mode: 'single', error: '', applied: null, generation: null }
  await runModuleGeneration([{ moduleId: module.id, title: module.title }], 'single')
}

function onRetryGeneration(moduleId: string): void {
  const generation = planState.value.generation
  if (!generation || generation.running) return
  const item = generation.items.find(current => current.moduleId === moduleId)
  if (!item) return
  void runModuleGeneration([{ moduleId, title: item.title }], 'retry', { retry: true })
}

/**
 * MF3：刷新后生成进度不保留，但已应用的拆分/文档还在。
 * 用户显式确认后按当前未归档模块重新生成全部（拆分 → retry；单模块 → single）。
 * 已完成模块会生成新的 ai 版本，旧版本保留可回滚。
 */
async function onRegenerateAll(): Promise<void> {
  if (planState.value.generation?.running || planState.value.status === 'applying') return
  const modules = activeModules.value
  if (!modules.length) return
  try {
    await ElMessageBox.confirm(
      '刷新后生成进度不保留。将按已应用拆分重新生成全部模块；已完成模块会生成新的 AI 版本（旧版本保留，可回滚）。',
      '重新生成全部模块',
      { type: 'warning', confirmButtonText: '重新生成', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  const mode = modules.length === 1 ? 'single' : 'split'
  planState.value = {
    status: 'generating',
    mode,
    error: '',
    applied: planState.value.applied,
    generation: null
  }
  await runModuleGeneration(
    modules.map(module => ({ moduleId: module.id, title: module.title })),
    mode === 'single' ? 'single' : 'retry',
    { retry: false }
  )
}

function onCancelGeneration(): void {
  const controller = generationAbort
  const generation = planState.value.generation
  if (!controller || !generation || !generation.running) return
  controller.abort()
  planState.value.generation = reduceGenerationEvent(generation, {
    type: 'all-done',
    ok: false,
    cancelled: true,
    failed: []
  })
}

/**
 * 逐模块生成（SSE）：事件驱动进度；完成后刷新模块/文档/聚合，并选中第一个生成模块。
 * retry=true 时保留既有进度状态，仅把目标模块重置为等待。
 */
async function runModuleGeneration(
  items: Array<{ moduleId: string; title: string }>,
  reason: ModuleGenerationReason,
  options: { retry?: boolean } = {}
): Promise<void> {
  if (!items.length) return
  const seq = ++generationSeq
  generationAbort?.abort()
  const controller = new AbortController()
  generationAbort = controller

  const previous = planState.value.generation
  let state = createGenerationState({ modules: items, reason })
  if (options.retry && previous) {
    const previousById = new Map(previous.items.map(item => [item.moduleId, item]))
    state.items = state.items.map(item => {
      const old = previousById.get(item.moduleId)
      return old
        ? { ...old, status: 'waiting', error: '', warnings: [] }
        : item
    })
    // 保留其它已完成/失败模块的展示
    for (const old of previous.items) {
      if (!state.items.some(item => item.moduleId === old.moduleId)) state.items.push({ ...old })
    }
  }
  planState.value.status = 'generating'
  if (planState.value.mode === null) planState.value.mode = reason === 'single' ? 'single' : 'split'
  planState.value.error = ''
  planState.value.generation = state

  try {
    await streamModuleGeneration(
      props.appId,
      { moduleIds: items.map(item => item.moduleId), reason },
      event => {
        if (seq !== generationSeq) return
        if (planState.value.generation) {
          planState.value.generation = reduceGenerationEvent(planState.value.generation, event)
        }
      },
      controller.signal
    )
    if (seq === generationSeq && planState.value.generation?.running) {
      planState.value.generation = {
        ...planState.value.generation,
        running: false,
        ok: false,
        globalError: '生成连接中断（未收到完成事件），请重试'
      }
    }
  } catch (err) {
    if (seq !== generationSeq) return
    const aborted = controller.signal.aborted || (err instanceof Error && err.message.includes('中止'))
    const message = aborted ? '已取消剩余模块' : err instanceof Error ? err.message : String(err)
    if (planState.value.generation) {
      const current = planState.value.generation
      planState.value.generation = aborted
        ? reduceGenerationEvent(current, { type: 'all-done', ok: false, cancelled: true, failed: [] })
        : {
            ...current,
            running: false,
            ok: false,
            globalError: message,
            items: current.items.map(item =>
              item.status === 'done' ? item : { ...item, status: 'error', error: item.error || message }
            )
          }
    }
  } finally {
    if (seq !== generationSeq) return
    generationAbort = null
    await refreshModules().catch(() => undefined)
    await loadBundle().catch(() => undefined)
    await loadDoc().catch(() => undefined)
    if (seq !== generationSeq) return
    const generation = planState.value.generation
    if (generation) {
      const hasProblem =
        Boolean(generation.globalError) ||
        generation.cancelled ||
        generation.items.some(item => item.status === 'error' || item.status === 'cancelled' || item.status === 'skipped')
      planState.value.status = generation.running ? 'error' : 'done'
      if (!hasProblem) {
        // 定向重试（retry）不切换当前模块：避免建议卡/进度随切模块从聊天中消失
        if (!options.retry) {
          const firstId = firstGeneratedModuleId(generation)
          if (firstId && firstId !== selectedModuleId.value) {
            selectedModuleId.value = firstId
            persistModule(firstId)
            await loadDoc().catch(() => undefined)
          }
        }
        ElMessage.success(`已生成 ${generation.items.filter(item => item.status === 'done').length} 个模块（草稿），请逐模块确认`)
      } else if (generation.cancelled) {
        ElMessage.info('已取消剩余模块；已完成的模块已保留')
      } else if (generation.globalError) {
        ElMessage.error(generation.globalError)
      } else {
        ElMessage.info(
          `已生成 ${generation.items.filter(item => item.status === 'done').length} 个模块；未完成模块可点“重试”`
        )
      }
    }
  }
}

// ------------------------------------------------------------ RMP-2：随时重新规划

function openModuleReplan(): void {
  if (!replanAvailable.value || replanBusy.value) {
    ElMessage.warning(replanHint.value)
    return
  }
  if (planState.value.generation?.running) {
    ElMessage.warning('模块生成中，请等待完成或取消后再重新规划')
    return
  }
  replanOpen.value = true
}

/** 结构应用后：刷新模块/聚合，并选中第一个生成/保留/改名模块（文档由弹窗继续生成） */
async function onReplanApplied(result: ModuleReplanApplyResult): Promise<void> {
  await refreshModules()
  await loadBundle()
  const target =
    result.generation[0]?.moduleId ||
    result.kept[0]?.id ||
    result.renamed[0]?.id ||
    result.regenerated[0]?.id ||
    result.modules[0]?.id
  if (target && target !== selectedModuleId.value) {
    selectedModuleId.value = target
    persistModule(target)
    await loadDoc()
  }
}

/** 生成结束（成功/失败/取消）：刷新文档/大纲/聚合，选中第一个生成模块并提示调整摘要 */
async function onReplanFinished(payload: { firstModuleId: string; summary: string }): Promise<void> {
  await refreshModules()
  await loadBundle()
  if (payload.firstModuleId && payload.firstModuleId !== selectedModuleId.value) {
    selectedModuleId.value = payload.firstModuleId
    persistModule(payload.firstModuleId)
  }
  await loadDoc()
  if (payload.summary) ElMessage.info(payload.summary)
}

function onReplanBusy(value: boolean): void {
  replanBusy.value = value
}

// ------------------------------------------------------------ 模块管理

/** G1：聊天指引卡按钮 → 复用现有入口（新增模块 / AI 规划模块 / 重新编辑需求 / 发起变更） */
function onChatModuleAction(action: string): void {
  if (action === 'create-module') {
    openCreateModule()
    return
  }
  if (action === 'open-replan') {
    openModuleReplan()
    return
  }
  if (action === 'reopen-requirements') {
    void reopenDoc()
    return
  }
  if (action === 'open-change-set') {
    emit('open-change-set')
  }
}

function openCreateModule(): void {
  const gate = createModuleGate(appStatus.value)
  if (!gate.allowed) {
    ElMessage.warning(gate.hint)
    return
  }
  moduleDialogMode.value = 'create'
  editingModule.value = null
  moduleDialogOpen.value = true
}

function openEditModule(module: RequirementModule): void {
  if (stageReadonly.value) {
    ElMessage.warning('当前阶段需求文档只读，不能编辑模块信息')
    return
  }
  moduleDialogMode.value = 'edit'
  editingModule.value = module
  moduleDialogOpen.value = true
}

async function saveModule(input: {
  title: string
  description: string
  ownerLabel: string
  required: boolean
}): Promise<void> {
  if (moduleSaving.value) return
  moduleSaving.value = true
  try {
    if (moduleDialogMode.value === 'create') {
      // 新增后会切到新模块：先落盘当前模块未保存编辑，失败则不创建、不切换（弹窗保持打开）
      if (!(await flushAll())) {
        ElMessage.warning('当前模块还有未保存内容，已取消新增模块；请先处理保存失败')
        return
      }
      const created = await createRequirementModule(props.appId, input)
      moduleDialogOpen.value = false
      await refreshModules()
      selectedModuleId.value = created.id
      persistModule(created.id)
      await loadDoc()
      await loadBundle()
      ElMessage.success(`已新增模块「${created.title}」`)
      return
    }
    if (!editingModule.value) return
    await updateRequirementModule(props.appId, editingModule.value.id, input)
    moduleDialogOpen.value = false
    await refreshModules()
    await loadBundle()
    ElMessage.success('模块信息已保存')
  } catch (err) {
    showDocError(err, '保存模块失败')
  } finally {
    moduleSaving.value = false
  }
}

async function moveModule(moduleId: string, delta: number): Promise<void> {
  if (stageReadonly.value) return
  const ids = activeModules.value.map(module => module.id)
  const next = moveModuleIds(ids, moduleId, delta)
  if (!next) return
  try {
    await reorderRequirementModules(props.appId, next)
    await refreshModules()
  } catch (err) {
    showDocError(err, '模块排序失败')
  }
}

async function archiveModuleById(module: RequirementModule): Promise<void> {
  if (stageReadonly.value) return
  if (activeModules.value.length <= 1) {
    ElMessage.warning('至少保留 1 个未归档模块')
    return
  }
  try {
    await ElMessageBox.confirm(
      `归档「${module.title}」？文档/版本会保留但变为只读，可在模块列表底部“已归档”里恢复。`,
      '归档模块',
      { type: 'warning', confirmButtonText: '归档', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  // 归档当前模块会回退并 loadDoc：先落盘未保存编辑，失败则中止归档/切换
  if (selectedModuleId.value === module.id && !(await flushAll())) {
    ElMessage.warning('当前模块还有未保存内容，已取消归档；请先处理保存失败')
    return
  }
  try {
    await archiveRequirementModule(props.appId, module.id)
    await refreshModules()
    if (selectedModuleId.value === module.id) {
      const fallback = nextModuleAfterArchive(allModules.value, module.id, selectedModuleId.value)
      selectedModuleId.value = fallback ?? ''
      if (selectedModuleId.value) {
        persistModule(selectedModuleId.value)
        await loadDoc()
      }
      ElMessage.info('当前模块已归档，已切换到其它未归档模块')
    }
    await loadBundle()
    ElMessage.success(`模块「${module.title}」已归档`)
  } catch (err) {
    showDocError(err, '归档模块失败')
  }
}

async function restoreModuleById(module: RequirementModule): Promise<void> {
  if (stageReadonly.value) return
  // 恢复后会选中并 loadDoc：先落盘当前模块未保存编辑，失败则中止恢复/切换
  if (!(await flushAll())) {
    ElMessage.warning('当前模块还有未保存内容，已取消恢复；请先处理保存失败')
    return
  }
  try {
    await restoreRequirementModule(props.appId, module.id)
    await refreshModules()
    selectedModuleId.value = module.id
    persistModule(module.id)
    await loadDoc()
    await loadBundle()
    ElMessage.success(`模块「${module.title}」已恢复`)
  } catch (err) {
    showDocError(err, '恢复模块失败')
  }
}

function openOverview(): void {
  overviewOpen.value = true
  void loadBundle()
}

// ------------------------------------------------------------ 模板 / 导出 / 版本

/** 应用非需求阶段整页只读：模板切换会写文档，直接拦截 */
function openTemplateCenter(): void {
  if (stageReadonly.value) {
    ElMessage.warning('当前阶段需求文档只读，不能切换模板')
    return
  }
  if (appTemplateBlocked.value) {
    ElMessage.warning('本次变更只包含部分模块，不能应用级切换需求模板；请使用其他方式或取消变更后用单模块操作')
    return
  }
  templateOpen.value = true
}

/** 模板中心“应用到全部模块”：先 flush 未保存编辑，再预览影响 + 二次确认（决策 2） */
async function useTemplate(template: RequirementTemplate): Promise<void> {
  templateOpen.value = false
  if (stageReadonly.value) {
    ElMessage.warning('当前阶段需求文档只读，不能切换模板')
    return
  }
  if (appTemplateBlocked.value) {
    ElMessage.warning('本次变更只包含部分模块，不能应用级切换需求模板')
    return
  }
  if (!template) return
  // 本来就是全一致：不重复应用（不 flush/不写库）；存在不一致模块时允许用当前模板对齐
  if (template.id === payload.value?.template.id && !templatesDiverged.value) return
  // must-fix：模板切换会重写文档，先落盘当前模块未保存编辑；失败则中止，避免丢失输入
  if (!(await flushAll())) {
    ElMessage.warning('当前模块还有未保存内容，已取消切换；请先处理保存失败')
    return
  }
  switchTemplate.value = template
  switchTemplateOpen.value = true
}

async function onAppTemplateApplied(result: AppTemplateSwitchResult): Promise<void> {
  switchTemplate.value = null
  await refreshModules()
  await loadDoc()
  await loadBundle()
  ElMessage.success(`已应用到 ${result.modules.length} 个模块；每个模块都生成了模板切换版本`)
}

async function onTemplatesChanged(): Promise<void> {
  if (!loadedOnce || !payload.value) return
  try {
    const fresh = await getRequirementDoc(props.appId, undefined, selectedModuleId.value || undefined)
    if (fresh.template.id !== payload.value.template.id || fresh.doc.version !== payload.value.doc.version) {
      applyPayload(fresh)
      activeSectionKey.value = resolveSectionTarget(
        fresh.sections.map(section => section.sectionKey),
        activeSectionKey.value
      ).key
      void nextTick(scheduleSpy)
    }
  } catch {
    // 忽略刷新失败
  }
}

function onRestored(next: RequirementDocPayload): void {
  applyPayload(next)
  syncStructureDefault(next)
  dirty.clear()
  saveState.value = 'saved'
  focusSectionKey.value = ''
  activeSectionKey.value = next.sections[0]?.sectionKey ?? ''
  void nextTick(scheduleSpy)
  void refreshModules()
  void loadBundle()
}

/** 手动“保存版本”：内容未变、仅版本号 +1（服务端快照） */
function onVersionSaved(next: RequirementDocPayload): void {
  applyPayload(next)
  dirty.clear()
  saveState.value = 'saved'
  void refreshModules()
}

async function onExport(): Promise<void> {
  try {
    if (!(await flushAll())) throw new Error('当前模块还有未保存内容')
    const exported = await exportRequirementDoc(props.appId, selectedModuleId.value || undefined)
    const blob = new Blob([exported.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exported.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${exported.filename}（v${exported.version}）`)
  } catch (err) {
    showDocError(err, '导出失败')
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onPaneKeydown)
  bindScrollSpy(null)
  if (spyRaf) {
    cancelAnimationFrame(spyRaf)
    spyRaf = 0
  }
  generationSeq += 1
  generationAbort?.abort()
  if (saveTimer) clearTimeout(saveTimer)
  for (const timer of outlineTimers.values()) clearTimeout(timer)
  outlineTimers.clear()
  if (dirty.size) void flushSave().catch(() => undefined)
  if (pendingOutlines.size) void flushOutlines().catch(() => undefined)
})
</script>

<style scoped>
.reqdoc {
  flex: 1;
  min-width: 0;
  display: flex;
  height: 100%;
  position: relative;
  background: var(--rg-bg);
  color: var(--rg-text);
}
.chat-pane {
  width: 400px;
  flex-shrink: 0;
  border-right: 1px solid var(--rg-border);
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--rg-surface-2);
  position: relative;
}
.chat-placeholder {
  padding: 24px;
  font-size: 12.5px;
  color: var(--rg-text-3);
}
.doc-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.doc-head {
  flex-shrink: 0;
  min-height: 52px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
  flex-wrap: wrap;
}
.doc-head-main,
.doc-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.module-current {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 260px;
}
.module-current-title {
  font-size: 13px;
  color: var(--rg-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.module-current-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 10px;
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.module-archived-chip {
  font-size: 10px;
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-fill-2);
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.overview-strip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 6px 16px;
  border-bottom: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  font-size: 11px;
  color: var(--rg-text-3);
}
.strip-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.strip-item strong {
  color: var(--rg-text-2);
  font-weight: 600;
}
.strip-item.pending {
  color: var(--rg-warn);
}
.strip-item.ok {
  color: var(--rg-ok);
}
.strip-item.warn {
  color: var(--rg-warn);
}
.overview-btn {
  gap: 6px;
}
.overview-progress {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
/* 窄屏抽屉开关：宽屏不显示 */
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
.template-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rg-text);
  cursor: pointer;
}
.template-badge:hover {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
}
.caret {
  font-size: 9px;
  color: var(--rg-text-3);
}
.status-chip {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.status-chip.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.status-chip.review {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.doc-version {
  font-size: 11px;
  color: var(--rg-text-3);
}
.preview-view-chip {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  white-space: nowrap;
}
.cs-chip {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  white-space: nowrap;
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
.doc-warning-strip {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 16px;
  border-bottom: 1px solid var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
  font-size: 11.5px;
  line-height: 1.6;
}
.doc-warning-strip .warning-mark {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--rg-warn);
  color: var(--rg-ink-contrast);
  font-size: 10px;
  font-weight: 700;
  display: grid;
  place-items: center;
  margin-top: 1px;
}
.doc-warning-strip .warning-list {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding-left: 16px;
}
.doc-warning-strip .warning-list li {
  word-break: break-word;
}
.doc-warning-strip .warning-close {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}
.save-state {
  font-size: 11px;
  color: var(--rg-text-3);
}
.save-state.saving,
.save-state.dirty {
  color: var(--rg-warn);
}
.save-state.error {
  color: var(--rg-danger);
}
.mode-tabs {
  display: flex;
  gap: 2px;
  background: var(--rg-fill);
  border-radius: 8px;
  padding: 3px;
}
.mode-tab {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  cursor: pointer;
}
.mode-tab:hover {
  color: var(--rg-text);
}
.mode-tab.on {
  background: var(--rg-surface);
  color: var(--rg-text);
  font-weight: 600;
  box-shadow: var(--rg-shadow-1);
}
.doc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}
.doc-btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.doc-btn.primary {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.doc-btn.primary:hover:not(:disabled) {
  background: var(--rg-ink-hover);
  border-color: var(--rg-ink-hover);
  color: var(--rg-ink-contrast);
}
.doc-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.confirmed-note {
  font-size: 11.5px;
  color: var(--rg-ok);
  background: var(--rg-ok-soft);
  border-radius: 999px;
  padding: 3px 9px;
}
.doc-body {
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
}
.outline {
  width: 248px;
  flex-shrink: 0;
  border-right: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
.doc-scroll {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 16px 22px 48px;
}
.onboarding {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  border: 1px solid var(--rg-ai-border);
  background: var(--rg-ai-soft);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
}
.onboarding strong {
  font-size: 12.5px;
  color: var(--rg-text);
}
.onboarding p {
  margin: 4px 0 0;
  font-size: 11.5px;
  color: var(--rg-text-2);
  line-height: 1.65;
}
.readonly-banner {
  border: 1px solid var(--rg-ok-border);
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
  border-radius: 9px;
  padding: 8px 12px;
  font-size: 11.5px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.readonly-banner.archived {
  border-color: var(--rg-border-strong);
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.readonly-banner.scope-out {
  border-color: var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.section-mode {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 8px 0 6px;
}
.mode-tabs.small {
  padding: 2px;
}
.structure-tip {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.section-card {
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 11px;
  padding: 14px 16px;
  margin-bottom: 12px;
  scroll-margin-top: 12px;
}
.section-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex-wrap: wrap;
}
.section-title h2 {
  margin: 0;
  font-size: 14.5px;
  color: var(--rg-text);
}
.section-kind {
  font-size: 10px;
  color: var(--rg-text-2);
  background: var(--rg-fill);
  border-radius: 999px;
  padding: 1px 7px;
}
.section-req {
  font-size: 10px;
  color: var(--rg-text-3);
  background: var(--rg-fill);
  border-radius: 999px;
  padding: 1px 7px;
}
.section-req.on {
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
}
.section-missing {
  font-size: 10px;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border-radius: 999px;
  padding: 1px 7px;
}
.section-actions {
  display: flex;
  gap: 5px;
}
.section-ai {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  cursor: pointer;
}
.section-ai:hover:not(:disabled) {
  border-color: var(--rg-ai-border);
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
}
.section-ai:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.section-hint {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--rg-text-3);
  line-height: 1.6;
}
.section-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin: 8px 0 6px;
}
.section-toolbar button {
  border: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  color: var(--rg-text-2);
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 10.5px;
  cursor: pointer;
}
.section-toolbar button:hover {
  border-color: var(--rg-text-3);
  color: var(--rg-text);
}
.section-editor {
  display: block;
  width: 100%;
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  padding: 8px 10px;
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
  color: var(--rg-text);
  background: var(--rg-surface-2);
  resize: vertical;
  outline: none;
}
.section-editor::placeholder {
  color: var(--rg-text-3);
}
.section-editor:focus {
  border-color: var(--rg-ai);
  box-shadow: 0 0 0 3px var(--rg-focus-ring);
}
.section-editor[readonly] {
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.section-preview {
  margin-top: 8px;
  border-top: 1px dashed var(--rg-border);
  padding-top: 8px;
}
.preview-doc,
.source-head {
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 11px;
}
.preview-doc {
  padding: 18px 22px;
  overflow-x: auto;
}
.source-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  margin-bottom: 8px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  flex-wrap: wrap;
}
.source-editor {
  width: 100%;
  min-height: 60vh;
  border: 1px solid var(--rg-border);
  border-radius: 11px;
  padding: 14px 16px;
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
  color: var(--rg-text);
  background: var(--rg-surface);
  resize: vertical;
  outline: none;
}
.source-editor:focus {
  border-color: var(--rg-ai);
  box-shadow: 0 0 0 3px var(--rg-focus-ring);
}
.doc-center {
  flex: 1;
  display: grid;
  place-items: center;
  font-size: 12.5px;
  color: var(--rg-text-3);
  gap: 10px;
}
.doc-center.error {
  color: var(--rg-danger);
}

@media (max-width: 1280px) {
  .chat-pane {
    width: 336px;
  }
  .outline {
    width: 220px;
  }
  .doc-head {
    padding: 8px 12px;
  }
  .overview-strip {
    padding: 6px 12px;
  }
  .doc-scroll {
    padding: 14px 16px 40px;
  }
  .module-current {
    max-width: 200px;
  }
}

/* ≤1024：对话/大纲折叠为抽屉，编辑区全宽 */
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
  .outline {
    display: none;
  }
  .outline.open {
    display: flex;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(320px, calc(100vw - 56px));
    z-index: 41;
    box-shadow: var(--rg-shadow-2);
    border-right: 1px solid var(--rg-border);
    background: var(--rg-surface);
  }
  /* 大纲抽屉的内容从标题开始，给关闭按钮留出空间 */
  .outline.open :deep(.otree-head) {
    padding-right: 32px;
  }
}

@media (max-width: 768px) {
  .doc-head {
    padding: 8px 10px;
    row-gap: 8px;
  }
  .doc-head-main,
  .doc-head-actions {
    width: 100%;
  }
  .module-current {
    flex: 1;
    max-width: none;
  }
  .overview-strip {
    padding: 6px 10px;
    gap: 8px;
  }
  .doc-scroll {
    padding: 12px 12px 36px;
  }
  .section-card {
    padding: 12px;
  }
  .section-title h2 {
    font-size: 13.5px;
  }
  .source-editor {
    min-height: 50vh;
    padding: 12px;
  }
  .preview-doc {
    padding: 14px;
  }
  .chat-pane.open {
    width: calc(100vw - 24px);
  }
  .outline.open {
    width: calc(100vw - 24px);
  }
  /* 窄屏按钮触达 ≥32px */
  .doc-btn,
  .pane-toggle,
  .template-badge {
    min-height: 32px;
  }
  .mode-tab {
    min-height: 28px;
  }
  .section-ai {
    min-height: 30px;
  }
}
</style>
