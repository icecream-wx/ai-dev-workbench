<template>
  <div class="dev-view">
    <header class="dev-head">
      <div class="dev-title">
        <button
          type="button"
          class="pane-toggle"
          :class="{ active: sidebarOpen }"
          :title="sidebarOpen ? '收起会话列表' : '展开会话列表'"
          :aria-label="sidebarOpen ? '收起会话列表' : '展开会话列表'"
          :aria-expanded="sidebarOpen"
          @click="toggleSidebar"
        >
          ☰
        </button>
        <span class="badge">开发</span>
        <strong>{{ headerTitle }}</strong>
        <span class="meta">{{ session?.agent ?? 'build' }} · {{ modelLabel }}</span>
        <span v-if="handoff" class="meta handoff-meta">交接包 v{{ handoff.version }}{{ changeSetLabel ? ` · ${changeSetLabel}` : '' }}</span>
        <span v-if="readOnly" class="readonly-chip">只读 · {{ sessionStatusLabel(session?.status ?? '') }}</span>
      </div>
      <div class="dev-actions">
        <span
          v-if="session"
          :class="['ctx-chip', contextInfo.level]"
          :title="contextInfo.title"
          data-testid="context-chip"
        >
          {{ contextInfo.label }}
        </span>
        <button
          v-if="session && !readOnly"
          type="button"
          :class="['btn', 'compact-btn', contextInfo.level, { highlight: contextInfo.needsCompact }]"
          :disabled="actionBusy !== ''"
          data-testid="compact-btn"
          @click="compactContext"
        >
          {{ actionBusy === 'compact' ? '压缩中…' : '压缩上下文' }}
        </button>
        <span :class="['conn', connectionState]">{{ connectionLabel }}</span>
        <span :class="['run-status', statusClass]">{{ statusLabel }}</span>
        <button
          v-if="canGeneratePhases"
          type="button"
          class="btn"
          :disabled="actionBusy !== '' || phaseGenerating"
          data-testid="phase-generate-btn"
          @click="generatePhases"
        >
          {{ phaseGenerating ? '生成中…' : '按阶段开发' }}
        </button>
        <button type="button" class="btn" :disabled="actionBusy !== ''" @click="newSession">新会话</button>
        <button type="button" class="btn" @click="openHandoff()">交接包</button>
        <button
          v-if="session && !isCompleted && !readOnly"
          type="button"
          class="btn"
          :disabled="actionBusy !== ''"
          @click="completeDevelopment"
        >
          确认完成
        </button>
        <button
          type="button"
          class="pane-toggle"
          :class="{ active: asideOpen }"
          :title="asideOpen ? '收起会话信息' : '展开会话信息'"
          :aria-label="asideOpen ? '收起会话信息' : '展开会话信息'"
          :aria-expanded="asideOpen"
          @click="toggleAside"
        >
          ▤
        </button>
      </div>
    </header>

    <div :class="['dev-body', { 'sidebar-collapsed': !sidebarOpen, 'aside-collapsed': !asideOpen }]">
      <div v-if="maskVisible" class="dev-mask" aria-hidden="true" @click="closePanes" />
      <div class="dev-sessions">
        <SessionList
          :sessions="sessions"
          :selected-id="selectedSessionId"
          :loading="sessionsLoading"
          @select="selectSession"
          @rename="renameSession"
          @archive="archiveSession"
          @restore="restoreSession"
          @new-session="newSession"
        />
      </div>
      <main class="timeline">
        <PhaseBar
          v-if="phasesGenerated"
          :phases="phases"
          :current-phase-id="currentPhaseId"
          :current-handoff-version="handoff?.version ?? null"
          :read-only="readOnly"
          :busy="phaseBusy"
          @open="openPhaseDialog"
          @start="startPhase"
          @complete="completePhase"
          @skip="skipPhase"
          @reopen="reopenPhase"
        />
        <div v-if="loading" class="center-card">正在加载开发会话…</div>
        <div v-else-if="error" class="center-card error-card">
          <p>{{ error }}</p>
          <div class="center-actions">
            <button type="button" class="btn" @click="refresh(false)">重试</button>
            <button type="button" class="btn" @click="openHandoff()">查看交接包</button>
          </div>
        </div>
        <div v-else-if="!session && sessions.length" class="start-card">
          <div class="start-head">
            <h2>选择或新建会话</h2>
            <span class="hint">旧会话保留在左侧列表，可随时查看/恢复</span>
          </div>
          <p>当前没有进行中的开发会话。选择一个历史会话只读查看，或新建会话继续开发。</p>
          <div class="start-actions">
            <button type="button" class="btn primary" :disabled="actionBusy !== ''" @click="newSession">新建会话</button>
            <button type="button" class="btn" @click="toggleSidebar">查看会话列表</button>
          </div>
        </div>
        <div v-else-if="!session" class="start-card">
          <div class="start-head">
            <h2>开始开发</h2>
            <span class="hint">opencode 原生 build agent · 不限制工具/流程</span>
          </div>
          <p v-if="isCompleted" class="warn">应用已确认完成；开始开发并发送消息会重新打开开发状态。</p>
          <p v-if="!handoffReady" class="warn">交接包尚未生成，请先在“交接包”中生成。</p>

          <template v-if="phasesGenerated">
            <p>
              已生成 {{ executablePhases.length }} 个可执行阶段<template v-if="(phasesData?.modulePhaseCount ?? 0) > 0">（另 {{ phasesData?.modulePhaseCount }} 个模块里程碑，仅分组）</template>（来自 <code>04-PLAN.md</code> 的分阶段建议）。每个阶段使用单独会话，
              首条提示只放入输入框，不会自动发送；阶段不设门禁，也不会自动完成应用。
            </p>
            <ul class="phase-start-list" data-testid="phase-start-list">
              <li
                v-for="phase in executablePhases"
                :key="phase.id"
                :class="['phase-start-item', { current: phase.id === currentPhaseId }]"
              >
                <div class="psi-main">
                  <span class="psi-title">{{ phaseOrderLabel(phase.order, phases.length) }} · {{ phase.title }}</span>
                  <span :class="['phase-chip', phaseStatusClass(phase.status)]">{{ phaseStatusLabel(phase.status) }}</span>
                  <span v-if="phase.session" class="psi-session">会话</span>
                </div>
                <p class="psi-goal">
                  {{ phaseScopeLabel(phase.scope) }}<template v-if="phase.goal"> · {{ phase.goal }}</template>
                </p>
                <div class="psi-actions">
                  <button
                    type="button"
                    class="btn small primary"
                    :disabled="phaseBusy || !phaseActionStateFor(phase).canStart"
                    :data-testid="`phase-start-${phase.order}`"
                    @click="startPhase(phase)"
                  >
                    {{ phaseStartButtonLabel(phase) }}
                  </button>
                  <button type="button" class="btn small" @click="openPhaseDialog(phase.id)">查看范围</button>
                </div>
              </li>
            </ul>
            <button type="button" class="plain-toggle" @click="plainStartOpen = !plainStartOpen">
              {{ plainStartOpen ? '收起普通会话' : '普通会话（不关联阶段）' }}
            </button>
            <template v-if="plainStartOpen">
              <p>新会话不会关联阶段；仍只有一个 active 会话。默认提示只指向 <code>docs/handoff/00-README.md</code>。</p>
              <textarea v-model="startPrompt" rows="5" :disabled="actionBusy !== ''" />
              <div class="start-actions">
                <button type="button" class="btn" :disabled="actionBusy !== '' || !handoffReady" @click="start">
                  {{ actionBusy === 'start' ? '启动中…' : '开始普通会话' }}
                </button>
                <button type="button" class="btn" @click="openHandoff()">查看交接包</button>
              </div>
            </template>
          </template>

          <template v-else>
            <p>
              Agent 只会看到应用目录和交接包。默认提示只指向 <code>docs/handoff/00-README.md</code>；你可以编辑后再发送。
            </p>
            <textarea v-model="startPrompt" rows="5" :disabled="actionBusy !== ''" />
            <div class="start-actions">
              <button
                v-if="canGeneratePhases"
                type="button"
                class="btn"
                :disabled="actionBusy !== '' || phaseGenerating"
                data-testid="phase-generate-card-btn"
                @click="generatePhases"
              >
                {{ phaseGenerating ? '生成中…' : '按阶段开发' }}
              </button>
              <button type="button" class="btn primary" :disabled="actionBusy !== '' || !handoffReady" @click="start">
                {{ actionBusy === 'start' ? '启动中…' : '开始开发' }}
              </button>
              <button type="button" class="btn" @click="openHandoff()">查看交接包</button>
            </div>
          </template>
        </div>
        <template v-else>
          <div class="timeline-main">
            <div ref="scroller" class="timeline-scroll" @scroll="onScroll">
              <div ref="content" class="timeline-content">
                <div v-if="readOnly" class="readonly-banner">
                  该会话{{ sessionStatusLabel(session.status) }}，只读查看；恢复为当前会话后可继续发送。
                </div>
                <div v-if="isCompleted" class="completed-banner">
                  已确认完成{{ data?.app.completedAt ? `（${formatTime(data.app.completedAt)}）` : '' }}。继续发送消息会把应用状态改回“开发中”。
                </div>
                <div v-if="phaseWarningsText" class="context-banner warn" data-testid="phase-warnings">
                  <span>阶段摘要提示：{{ phaseWarningsText }}</span>
                </div>
                <div v-if="state?.status === 'failed'" class="error-banner">
                  Agent 本轮执行失败。请查看工具错误，修正后重新发送。
                </div>
                <div
                  v-if="!readOnly && contextInfo.hint"
                  :class="['context-banner', contextInfo.level]"
                  data-testid="context-hint"
                >
                  <span>{{ contextInfo.hint }}</span>
                  <button
                    type="button"
                    class="btn small"
                    :disabled="actionBusy !== ''"
                    data-testid="context-hint-compact"
                    @click="compactContext"
                  >
                    压缩上下文
                  </button>
                </div>

                <template v-for="entry in entries" :key="entry.key">
                  <div v-if="entry.kind === 'user'" class="user-message">
                    <pre>{{ entry.message?.text }}</pre>
                  </div>
                  <div v-else-if="entry.kind === 'assistant'" class="assistant-message">
                    <div v-if="entry.message?.reasoning" class="reasoning">
                      <span class="reasoning-label">思考</span>
                      <pre>{{ entry.message.reasoning }}</pre>
                    </div>
                    <pre v-if="entry.message?.text">{{ entry.message.text }}</pre>
                  </div>
                  <div
                    v-else-if="entry.kind === 'notice'"
                    :class="['timeline-notice', entry.message?.kind === 'compaction-failed' ? 'failed' : 'ok']"
                    data-testid="timeline-compaction"
                  >
                    <span class="notice-icon">⇄</span>
                    <span class="notice-text">{{ entry.message?.text }}</span>
                    <span v-if="entry.message?.created" class="notice-time">{{ formatClock(entry.message.created) }}</span>
                  </div>
                  <StepCard v-else-if="entry.kind === 'step'" :step="entry.step!" />
                </template>

                <div v-if="pendingPermissions.length || pendingForms.length" class="pending-stack">
                  <PermissionCard
                    v-for="permission in pendingPermissions"
                    :key="permission.id"
                    :permission="permission"
                    :busy="actionBusy !== ''"
                    :readonly="readOnly"
                    @reply="(decision, message) => replyPermission(permission.id, decision, message)"
                  />
                  <FormCard
                    v-for="form in pendingForms"
                    :key="form.id"
                    :form="form"
                    :busy="actionBusy !== ''"
                    :readonly="readOnly"
                    @submit="answer => replyForm(form.id, answer)"
                  />
                </div>

                <div v-if="state?.status === 'running'" class="working-row">
                  <span class="spinner" />
                  Agent 正在执行 · {{ state.phase.label }}
                </div>

                <div v-if="!entries.length && !pendingPermissions.length && !pendingForms.length" class="empty-timeline">
                  <p>会话已创建。发送消息后，文本、工具卡、diff 和权限询问会出现在这里。</p>
                </div>
              </div>
            </div>
            <button v-if="hasNew" type="button" class="back-latest" @click="scrollToBottom(true)">回到最新</button>
          </div>
        </template>
        <Composer
          v-if="session && !readOnly"
          ref="composerRef"
          v-model="composer"
          :disabled="actionBusy === 'start'"
          :busy="state?.status === 'running'"
          @send="send"
          @stop="stop"
        />
        <div v-else-if="session && readOnly" class="readonly-bar">
          <span>该会话{{ sessionStatusLabel(session.status) }}，只读查看；恢复为当前会话后可继续发送。</span>
          <button type="button" class="btn primary" :disabled="actionBusy !== ''" @click="restoreCurrent">恢复为当前会话</button>
        </div>
      </main>

      <aside class="dev-side">
        <section>
          <h3>会话</h3>
          <dl>
            <div><dt>标题</dt><dd :title="headerTitle">{{ headerTitle }}</dd></div>
            <div><dt>状态</dt><dd>{{ readOnly ? `只读 · ${sessionStatusLabel(session?.status ?? '')}` : statusLabel }}</dd></div>
            <div><dt>模型</dt><dd class="mono" :title="modelLabel">{{ modelLabel }}</dd></div>
            <div><dt>交接包</dt><dd>{{ session?.handoffVersion ? `v${session.handoffVersion}` : '—' }}</dd></div>
            <div>
              <dt>阶段</dt>
              <dd
                data-testid="aside-phase"
                :title="phaseReadOnlyReason ? `${asidePhaseLabel} · ${phaseReadOnlyReason}` : asidePhaseLabel"
              >
                {{ asidePhaseLabel }}
              </dd>
            </div>
            <div><dt>开始</dt><dd>{{ session ? formatTime(session.createdAt) : '—' }}</dd></div>
            <div><dt>耗时</dt><dd>{{ formatElapsed(state?.elapsedMs) }}</dd></div>
            <div><dt>消息</dt><dd>{{ state?.stats.messageCount ?? 0 }}</dd></div>
            <div><dt>工具</dt><dd>{{ state?.stats.toolTotal ?? 0 }}（失败 {{ state?.stats.failedTools ?? 0 }}）</dd></div>
            <div><dt>上下文</dt><dd :class="['ctx-detail', contextInfo.level]" data-testid="context-detail">{{ contextInfo.detail }}</dd></div>
            <div><dt>Token</dt><dd>{{ tokenLabel }}</dd></div>
          </dl>
          <div class="side-actions">
            <button type="button" class="btn small" :disabled="refreshing" @click="refresh(false)">刷新</button>
            <button v-if="session && !readOnly" type="button" class="btn small" :disabled="actionBusy !== ''" @click="newSession">新会话</button>
          </div>
        </section>

        <section>
          <h3>交接文档</h3>
          <p v-if="!handoff" class="muted">尚未生成交接包。</p>
          <template v-else>
            <p v-if="changeSetLabel" class="muted">{{ changeSetLabel }}</p>
            <p class="muted">v{{ handoff.version }} · {{ shortHash(handoff.hash) }}</p>
            <div v-if="handoffScale?.suggested" class="handoff-scale" data-testid="dev-handoff-scale">
              <span class="scale-chip">{{ handoffScaleBadge?.label }}</span>
              <span class="scale-counts">{{ handoffScaleCounts }}</span>
              <span v-if="handoffScaleTriggers" class="muted scale-triggers">{{ handoffScaleTriggers }}</span>
              <button type="button" class="btn small" @click="openHandoff('04-PLAN.md')">查看 04-PLAN.md</button>
            </div>
            <button
              v-for="file in handoffFiles"
              :key="file.name"
              type="button"
              class="doc-link"
              @click="openHandoff(file.name)"
            >
              <span>{{ file.name }}</span>
              <small>{{ formatBytes(file.size) }}</small>
            </button>
          </template>
        </section>

        <section>
          <h3>文件变化</h3>
          <p v-if="!changedFiles.length" class="muted">Agent 写入文件后会出现在这里。</p>
          <ul v-else class="file-list">
            <li v-for="file in changedFiles" :key="file.path">
              <code>{{ file.path }}</code>
              <span>{{ file.mode }}</span>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <PhaseDialog
      v-model="phaseDialogOpen"
      :phases="phases"
      :current-phase-id="selectedPhaseId ?? currentPhaseId"
      :current-handoff-version="handoff?.version ?? null"
      :handoff-version="phasesData?.handoffVersion ?? null"
      :read-only="readOnly"
      :busy="phaseBusy"
      :busy-action="phaseBusyAction"
      @start="startPhase"
      @complete="completePhase"
      @skip="skipPhase"
      @reopen="reopenPhase"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Composer from './Composer.vue'
import FormCard from './FormCard.vue'
import PermissionCard from './PermissionCard.vue'
import PhaseBar from './PhaseBar.vue'
import PhaseDialog from './PhaseDialog.vue'
import SessionList from './SessionList.vue'
import StepCard from './StepCard.vue'
import {
  DevApiError,
  activateDevSession,
  archiveDevSessionById,
  compactDevSession,
  completeDevPhase,
  connectDevEvents,
  createDevSession,
  generateDevPhases,
  getDevPhases,
  getDevState,
  interruptDevSession,
  listDevSessions,
  promptDevSession,
  renameDevSession,
  reopenDevPhase,
  replyDevForm,
  replyDevPermission,
  skipDevPhase,
  startDevPhase,
  type DevEventConnection
} from './api'
import {
  contextDetail,
  contextHint,
  contextLabel,
  contextNeedsCompact,
  contextTitle
} from './dev-health.js'
import {
  executablePhases as executablePhaseList,
  phaseActionState,
  phaseGenerateConfirmText,
  phaseOrderLabel,
  phaseRefLabel,
  phaseScopeLabel,
  phaseStartConfirmText,
  phaseStatusClass,
  phaseStatusLabel
} from './phase-labels.js'
import {
  displayTitle as sessionDisplayTitle,
  handoffVersionMismatch,
  sessionStatusLabel
} from './session-labels.js'
import type {
  DevPhaseView,
  DevPhasesResponse,
  DevSessionListItem,
  DevSessionMessage,
  DevSessionState,
  DevStateResponse,
  DevStep,
  FormInfo,
  FormValue,
  HandoffSummary,
  PermissionRequest
} from './types'
import { completeApp } from '../workbench/api'
import { getDesignHandoff, type DesignHandoffMeta } from '../design/api'
import { scaleBadge, scaleCountsLabel, scaleTriggerLabels } from '../design/handoff-scale.js'

const props = defineProps<{ appId: string; completed?: boolean }>()
const emit = defineEmits<{ 'open-handoff': [file?: string]; 'app-changed': [] }>()

type ConnectionState = 'connecting' | 'open' | 'error' | 'closed'

interface TimelineEntry {
  key: string
  kind: 'user' | 'assistant' | 'step' | 'notice'
  message?: DevSessionMessage
  step?: DevStep
}

const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const data = ref<DevStateResponse | null>(null)
const actionBusy = ref<'' | 'start' | 'send' | 'stop' | 'complete' | 'permission' | 'form' | 'switch' | 'rename' | 'archive' | 'activate' | 'compact'>('')
const composer = ref('')
const startPrompt = ref('')
const localCompleted = ref(false)
const handoffMeta = ref<DesignHandoffMeta | null>(null)
const connectionState = ref<ConnectionState>('closed')
const hasNew = ref(false)
const scroller = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const composerRef = ref<InstanceType<typeof Composer> | null>(null)
const sessions = ref<DevSessionListItem[]>([])
const sessionsLoading = ref(false)
const selectedSessionId = ref<string | null>(null)
/** U7：阶段数据（最新交接包；历史只读由 route 注入验证） */
const phasesData = ref<DevPhasesResponse | null>(null)
const phaseDialogOpen = ref(false)
const selectedPhaseId = ref<string | null>(null)
const phaseBusy = ref(false)
const phaseBusyAction = ref<'' | 'start' | 'complete' | 'skip' | 'reopen'>('')
const phaseGenerating = ref(false)
const phaseWarnings = ref<string[]>([])
/** 有阶段时“普通会话（不关联阶段）”入口默认折叠 */
const plainStartOpen = ref(false)
const sidebarOpen = ref(true)
/** 右侧会话信息/交接文档/文件变化；≤1024 折叠为抽屉 */
const asideOpen = ref(true)
/** 抽屉断点（与 CSS 的 1024 一致）：窄屏用遮罩 + 抽屉，宽屏用并列栏 */
const narrow = ref(false)
const maskVisible = computed(() => narrow.value && (sidebarOpen.value || asideOpen.value))

let connection: DevEventConnection | null = null
/** U7：阶段请求序号（只应用最新一次响应；切换 app 时递增以丢弃旧应用响应） */
let phasesSeq = 0
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let stick = true

const appName = computed(() => data.value?.app.name ?? props.appId)
const session = computed(() => data.value?.session ?? null)
const state = computed<DevSessionState | null>(() => data.value?.state ?? null)
const readOnly = computed(() => data.value?.readOnly ?? false)
const handoff = computed<HandoffSummary | null>(() => data.value?.app.handoff ?? null)
const currentItem = computed<DevSessionListItem | null>(() => {
  const id = selectedSessionId.value ?? data.value?.session?.id ?? null
  if (!id) return null
  return sessions.value.find(item => item.id === id) ?? null
})
const headerTitle = computed(() => (currentItem.value ? sessionDisplayTitle(currentItem.value, appName.value) : appName.value))
const changeSetLabel = computed(() => {
  const changeSet = handoff.value?.changeSet
  if (!changeSet) return ''
  return changeSet.seq === 1 && changeSet.title === '初始开发' ? '初始开发' : `变更 #${changeSet.seq} · ${changeSet.title}`
})
const handoffReady = computed(() => data.value?.handoffReady ?? false)
const handoffFiles = computed(() => handoffMeta.value?.files ?? [])
/** I-09b-1（U6）：大交接包建议分阶段；normal/旧交接包不显示 */
const handoffScale = computed(() => handoffMeta.value?.scale ?? null)
const handoffScaleBadge = computed(() => scaleBadge(handoffScale.value))
const handoffScaleCounts = computed(() => scaleCountsLabel(handoffScale.value))
const handoffScaleTriggers = computed(() => scaleTriggerLabels(handoffScale.value).join('、'))
/** U7：阶段列表/当前阶段/进度/可生成入口 */
const phases = computed<DevPhaseView[]>(() => phasesData.value?.phases ?? [])
const executablePhases = computed<DevPhaseView[]>(() => executablePhaseList(phases.value))
const phasesGenerated = computed(() => phasesData.value?.generated === true)
const phaseCurrentHandoffVersion = computed(() => handoff.value?.version ?? null)
const currentPhaseId = computed<string | null>(() => {
  const fromSession = session.value?.phase?.id ?? null
  if (fromSession) return fromSession
  return executablePhases.value.find(phase => phase.status === 'in_progress')?.id ?? null
})
const phaseTotal = computed(() => executablePhases.value.length)
const currentPhase = computed<DevPhaseView | null>(
  () => phases.value.find(phase => phase.id === currentPhaseId.value) ?? null
)
/** 大交接包（U6）+ 最新版本尚未生成阶段 */
const canGeneratePhases = computed(
  () => !readOnly.value && handoffScale.value?.suggested === true && phasesData.value?.canGenerate === true
)
const phaseReadOnlyReason = computed(
  () => phaseActionState(currentPhase.value, phaseCurrentHandoffVersion.value, readOnly.value).reason
)
const phaseWarningsText = computed(() => phaseWarnings.value.join('；'))
const asidePhaseLabel = computed(() => (session.value?.phase ? phaseRefLabel(session.value.phase) : '—'))
const isCompleted = computed(() => localCompleted.value)
const isRunning = computed(() => state.value?.status === 'running')
const pendingPermissions = computed(() => (state.value?.pending.permissions ?? []) as unknown as PermissionRequest[])
const pendingForms = computed(() => (state.value?.pending.forms ?? []) as unknown as FormInfo[])
const modelLabel = computed(() => {
  const model = session.value?.model
  return model ? `${model.providerID}/${model.id}` : 'opencode 默认模型'
})
const statusLabel = computed(() => {
  if (readOnly.value) return '只读查看'
  if (localCompleted.value) return '已确认完成'
  if (!session.value) return '未开始'
  const status = state.value?.status
  if (status === 'running') return '运行中'
  if (status === 'succeeded') return '本轮完成'
  if (status === 'failed') return '执行失败'
  if (status === 'interrupted') return '已停止'
  if (status === 'idle') return '空闲'
  return status || '空闲'
})
const statusClass = computed(() => ({
  running: isRunning.value,
  done: localCompleted.value || state.value?.status === 'succeeded',
  idle: Boolean(session.value) && !isRunning.value && !localCompleted.value
}))
const connectionLabel = computed(() => ({
  connecting: '连接中',
  open: '实时',
  error: '连接异常',
  closed: '未连接'
})[connectionState.value])
const tokenLabel = computed(() => {
  const tokens = state.value?.stats.tokens
  if (!tokens) return '—'
  return `${tokens.input} / ${tokens.output}`
})
/** I-09a：上下文健康度（只读会话不显示提示条/压缩按钮，但 chip 仍显示） */
const contextInfo = computed(() => {
  const context = state.value?.context ?? null
  return {
    label: contextLabel(context),
    detail: contextDetail(context),
    title: contextTitle(context),
    hint: readOnly.value ? '' : contextHint(context),
    level: context?.level ?? 'unknown',
    needsCompact: !readOnly.value && contextNeedsCompact(context)
  }
})

const stepStarts = computed(() => {
  const map = new Map<string, DevStep[]>()
  for (const step of state.value?.steps ?? []) {
    const messageId = step.items[0]?.messageId
    if (!messageId) continue
    const list = map.get(messageId) ?? []
    list.push(step)
    map.set(messageId, list)
  }
  return map
})

const entries = computed<TimelineEntry[]>(() => {
  const out: TimelineEntry[] = []
  const consumed = new Set<string>()
  const messages = [...(state.value?.messages ?? [])].sort((a, b) => (a.created ?? 0) - (b.created ?? 0))
  for (const message of messages) {
    if (message.type === 'user' && (message.text ?? '').trim()) {
      out.push({ key: `user-${message.id}`, kind: 'user', message })
    } else if (message.type === 'assistant') {
      if ((message.text ?? '').trim() || (message.reasoning ?? '').trim()) {
        out.push({ key: `assistant-${message.id}`, kind: 'assistant', message })
      }
      for (const step of stepStarts.value.get(message.id) ?? []) {
        out.push({ key: step.id, kind: 'step', step })
        consumed.add(step.id)
      }
    } else if (message.type === 'compaction' || message.kind === 'compaction' || message.kind === 'compaction-failed') {
      // I-09a：压缩事件作为轻量系统提示，不进入 assistant 文本
      out.push({ key: `notice-${message.id}`, kind: 'notice', message })
    } else if (message.type === 'shell') {
      for (const step of stepStarts.value.get(message.id) ?? []) {
        out.push({ key: step.id, kind: 'step', step })
        consumed.add(step.id)
      }
    }
  }
  for (const step of state.value?.steps ?? []) {
    if (!consumed.has(step.id)) out.push({ key: step.id, kind: 'step', step })
  }
  return out
})

const changedFiles = computed(() => {
  const files = new Map<string, string>()
  for (const step of state.value?.steps ?? []) {
    for (const item of step.items) {
      if (item.diff?.path) files.set(item.diff.path, item.diff.mode === 'create' ? '新建' : '修改')
      else if (['write', 'edit', 'patch', 'multiedit', 'apply_patch'].includes(item.name) && item.target) files.set(item.target, '写入')
    }
  }
  return [...files].slice(-30).map(([path, mode]) => ({ path, mode }))
})

function applyData(next: DevStateResponse, preserveComposer = true): void {
  const previousSessionId = data.value?.session?.opencodeSessionId
  const previousHandoffVersion = handoffMeta.value?.version ?? null
  data.value = next
  if (next.session && !selectedSessionId.value) selectedSessionId.value = next.session.id
  localCompleted.value = next.app.status === 'completed'
  if (next.defaultPrompt && !startPrompt.value) startPrompt.value = next.defaultPrompt
  if (!preserveComposer && next.session) composer.value = ''
  // 新会话/切换会话后，旧 SSE 连接不会收到新会话事件；关闭后由 ensureEvents 重连
  if (!next.session || (previousSessionId && next.session && previousSessionId !== next.session.opencodeSessionId)) {
    connection?.close()
    connection = null
  }
  if (!handoffMeta.value || (next.app.handoff?.version ?? null) !== previousHandoffVersion) void loadHandoff()
}

async function loadSessions(): Promise<void> {
  sessionsLoading.value = true
  try {
    const next = await listDevSessions(props.appId)
    sessions.value = next.sessions
    if (!selectedSessionId.value) selectedSessionId.value = next.activeSessionId ?? data.value?.session?.id ?? null
    else if (!next.sessions.some(item => item.id === selectedSessionId.value)) {
      selectedSessionId.value = next.activeSessionId ?? null
    }
  } catch {
    // 列表读取失败不覆盖主时间线错误；保留上次列表
  } finally {
    sessionsLoading.value = false
  }
}

async function loadHandoff(): Promise<void> {
  try {
    handoffMeta.value = (await getDesignHandoff(props.appId)).handoff
  } catch {
    handoffMeta.value = null
  }
}

/** U7：阶段数据（失败静默保留上次值，不覆盖主时间线错误；handoffVersion 只用于历史只读查看） */
async function loadPhases(handoffVersion?: number | null): Promise<void> {
  // 请求序号：轮询/操作并发时只应用最新一次响应，避免旧响应覆盖新数据或新请求被丢弃
  const seq = ++phasesSeq
  try {
    const next = await getDevPhases(props.appId, handoffVersion ?? undefined)
    if (seq === phasesSeq) phasesData.value = next
  } catch {
    // 阶段读取失败不覆盖主时间线错误；保留上次阶段数据
  }
}

function handlePhaseError(err: unknown, hint = ''): void {
  const message = err instanceof Error ? err.message : String(err)
  ElMessage.error(hint ? `${message}；${hint}` : message)
  if (err instanceof DevApiError && err.status === 409) void loadPhases()
}

/** 有阶段时“新会话”提示：新会话不关联阶段 */
function newSessionConfirmText(): string {
  const base = '当前会话会归档，新会话不会自动接续旧上下文；旧会话保留在左侧列表，可随时查看/恢复。'
  return phasesGenerated.value ? `${base}\n\n新会话不会关联阶段；建议用阶段列表开始阶段。` : base
}

async function generatePhases(): Promise<void> {
  if (phaseGenerating.value || actionBusy.value || readOnly.value) return
  try {
    await ElMessageBox.confirm(
      phaseGenerateConfirmText(handoffScale.value?.phaseCount ?? 0, handoffScale.value?.modulePhaseCount ?? 0),
      '按阶段开发',
      { type: 'warning', confirmButtonText: '生成阶段', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  phaseGenerating.value = true
  try {
    const next = await generateDevPhases(props.appId)
    phasesData.value = next
    await loadSessions()
    await refresh(true)
    await loadPhases()
    ElMessage.success(`已生成 ${next.phases.length} 个开发阶段`)
  } catch (err) {
    handlePhaseError(err, '请重新生成交接包')
  } finally {
    phaseGenerating.value = false
  }
}

function openPhaseDialog(target?: string | DevPhaseView | null): void {
  const id = typeof target === 'string' ? target : target?.id ?? currentPhaseId.value ?? null
  selectedPhaseId.value = id
  phaseDialogOpen.value = true
  if (!phases.value.length) void loadPhases()
}

function phaseActionStateFor(phase: DevPhaseView | null) {
  return phaseActionState(phase, phaseCurrentHandoffVersion.value, readOnly.value)
}

function phaseStartButtonLabel(phase: DevPhaseView): string {
  if (phase.status === 'skipped') return '重新开始'
  if (phase.status === 'in_progress') return '继续'
  if (phase.status === 'completed') return '已完成'
  return '开始'
}

/** 阶段切换后统一刷新：开发状态 → 阶段 → 会话列表 */
async function refreshAfterPhaseChange(): Promise<void> {
  connection?.close()
  connection = null
  await refresh(true)
  await loadPhases()
  await loadSessions()
}

async function startPhase(phase: DevPhaseView | null): Promise<void> {
  if (!phase || phaseBusy.value || readOnly.value) return
  const action = phaseActionStateFor(phase)
  if (!action.canStart) {
    ElMessage.warning(action.reason || '该阶段不可开始')
    return
  }
  try {
    await ElMessageBox.confirm(
      phaseStartConfirmText(phase, phaseTotal.value, {
        hasActiveSession: Boolean(session.value),
        running: isRunning.value
      }),
      '开始阶段',
      { type: 'warning', confirmButtonText: '开始阶段', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  phaseBusy.value = true
  phaseBusyAction.value = 'start'
  phaseWarnings.value = []
  try {
    const next = await startDevPhase(props.appId, phase.id)
    selectedSessionId.value = next.session?.id ?? null
    applyData(next)
    composer.value = next.defaultPrompt
    ensureEvents()
    await loadPhases()
    await loadSessions()
    phaseDialogOpen.value = false
    emit('app-changed')
    ElMessage.success(`已进入阶段 ${phase.order}，首条提示已放入输入框（未发送）`)
    await nextTick()
    composerRef.value?.focus()
  } catch (err) {
    handlePhaseError(err)
  } finally {
    phaseBusy.value = false
    phaseBusyAction.value = ''
  }
}

async function completePhase(phase: DevPhaseView | null): Promise<void> {
  if (!phase || phaseBusy.value || readOnly.value) return
  const action = phaseActionStateFor(phase)
  if (!action.canComplete) {
    ElMessage.warning(action.reason || '该阶段不可完成')
    return
  }
  try {
    await ElMessageBox.confirm(
      `完成阶段 ${phase.order}「${phase.title}」只更新阶段状态，不归档会话、不检查 Git/测试；会尝试生成阶段摘要（失败回退最后一条回复）。`,
      '完成阶段',
      { type: 'warning', confirmButtonText: '完成阶段', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  phaseBusy.value = true
  phaseBusyAction.value = 'complete'
  try {
    const result = await completeDevPhase(props.appId, phase.id)
    phaseWarnings.value = result.warnings
    await refreshAfterPhaseChange()
    if (result.warnings.length) ElMessage.warning(result.warnings.join('；'))
    else {
      phaseWarnings.value = []
      ElMessage.success('阶段已完成')
    }
  } catch (err) {
    handlePhaseError(err)
  } finally {
    phaseBusy.value = false
    phaseBusyAction.value = ''
  }
}

async function skipPhase(phase: DevPhaseView | null): Promise<void> {
  if (!phase || phaseBusy.value || readOnly.value) return
  const action = phaseActionStateFor(phase)
  if (!action.canSkip) {
    ElMessage.warning(action.reason || '该阶段不可跳过')
    return
  }
  try {
    await ElMessageBox.confirm(
      `跳过阶段 ${phase.order}「${phase.title}」只更新阶段状态：不会删除会话或代码，可稍后重新开始；不会自动完成应用。`,
      '跳过阶段',
      { type: 'warning', confirmButtonText: '跳过', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  phaseBusy.value = true
  phaseBusyAction.value = 'skip'
  try {
    await skipDevPhase(props.appId, phase.id)
    await refreshAfterPhaseChange()
    ElMessage.success('阶段已跳过')
  } catch (err) {
    handlePhaseError(err)
  } finally {
    phaseBusy.value = false
    phaseBusyAction.value = ''
  }
}

async function reopenPhase(phase: DevPhaseView | null): Promise<void> {
  if (!phase || phaseBusy.value || readOnly.value) return
  const action = phaseActionStateFor(phase)
  if (!action.canReopen) {
    ElMessage.warning(action.reason || '该阶段不可重新打开')
    return
  }
  try {
    await ElMessageBox.confirm(
      `重新打开阶段 ${phase.order}「${phase.title}」只把状态改回进行中：不会自动创建/切换会话，也不会移除摘要。`,
      '重新打开阶段',
      { type: 'warning', confirmButtonText: '重新打开', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  phaseBusy.value = true
  phaseBusyAction.value = 'reopen'
  try {
    await reopenDevPhase(props.appId, phase.id)
    await refreshAfterPhaseChange()
    ElMessage.success('阶段已重新打开')
  } catch (err) {
    handlePhaseError(err)
  } finally {
    phaseBusy.value = false
    phaseBusyAction.value = ''
  }
}

async function refresh(silent = true): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  if (!silent) error.value = ''
  try {
    const next = await getDevState(props.appId, selectedSessionId.value)
    applyData(next)
    error.value = ''
    if (next.session && !next.readOnly) ensureEvents()
    else {
      connection?.close()
      connection = null
      connectionState.value = 'closed'
    }
    if (next.app.handoff) void loadPhases()
    void loadSessions()
  } catch (err) {
    if (!silent || !data.value) error.value = err instanceof Error ? err.message : String(err)
  } finally {
    refreshing.value = false
    loading.value = false
  }
}

function ensureEvents(): void {
  if (connection) return
  connection = connectDevEvents(
    props.appId,
    () => scheduleRefresh(),
    connectionStateValue => {
      connectionState.value = connectionStateValue
    }
  )
}

function scheduleRefresh(): void {
  if (refreshTimer) return
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void refresh(true)
  }, 350)
}

async function start(): Promise<void> {
  if (actionBusy.value) return
  const prompt = startPrompt.value.trim()
  if (!prompt) {
    ElMessage.warning('请填写首条提示')
    return
  }
  actionBusy.value = 'start'
  error.value = ''
  try {
    const next = await createDevSession(props.appId)
    selectedSessionId.value = next.session?.id ?? null
    applyData(next)
    ensureEvents()
    await promptDevSession(props.appId, prompt)
    composer.value = ''
    startPrompt.value = next.defaultPrompt
    await refresh(true)
    ElMessage.success('开发会话已开始')
    emit('app-changed')
    await nextTick()
    composerRef.value?.focus()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    error.value = message
    ElMessage.error(message)
  } finally {
    actionBusy.value = ''
  }
}

async function newSession(): Promise<void> {
  if (actionBusy.value) return
  try {
    await ElMessageBox.confirm(
      newSessionConfirmText(),
      '新建开发会话',
      { type: 'warning', confirmButtonText: '新建', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  actionBusy.value = 'start'
  error.value = ''
  try {
    const next = await createDevSession(props.appId, true)
    selectedSessionId.value = next.session?.id ?? null
    applyData(next, false)
    composer.value = next.defaultPrompt
    ensureEvents()
    await refresh(true)
    await loadSessions()
    await nextTick()
    composerRef.value?.focus()
    ElMessage.success('已创建新会话')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    error.value = message
    ElMessage.error(message)
  } finally {
    actionBusy.value = ''
  }
}

function toggleSidebar(): void {
  sidebarOpen.value = !sidebarOpen.value
  if (sidebarOpen.value && narrow.value) asideOpen.value = false
}

function toggleAside(): void {
  asideOpen.value = !asideOpen.value
  if (asideOpen.value && narrow.value) sidebarOpen.value = false
}

function closePanes(): void {
  if (!narrow.value) return
  sidebarOpen.value = false
  asideOpen.value = false
}

/** 断点切换时重置抽屉状态：窄屏默认全部收起，宽屏恢复并列三栏 */
function syncPaneLayout(): void {
  const isNarrow = window.innerWidth <= 1024
  if (isNarrow === narrow.value) return
  narrow.value = isNarrow
  sidebarOpen.value = !isNarrow
  asideOpen.value = !isNarrow
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closePanes()
}

async function selectSession(item: DevSessionListItem): Promise<void> {
  if (actionBusy.value || item.id === selectedSessionId.value) return
  if (item.status === 'stale') {
    ElMessage.warning('该会话已失效，请新建会话')
    return
  }
  actionBusy.value = 'switch'
  try {
    connection?.close()
    connection = null
    selectedSessionId.value = item.id
    if (narrow.value) sidebarOpen.value = false
    const next = await getDevState(props.appId, item.id)
    applyData(next)
    phaseWarnings.value = []
    await loadSessions()
    if (!next.readOnly) ensureEvents()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ElMessage.error(message)
    await loadSessions()
  } finally {
    actionBusy.value = ''
  }
}

async function renameSession(item: DevSessionListItem): Promise<void> {
  if (actionBusy.value) return
  let value = ''
  try {
    const result = await ElMessageBox.prompt('会话标题（最多 120 字符；留空恢复默认标题）', '重命名会话', {
      inputValue: item.title ?? '',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValidator: (input: string) => (input.trim().length > 120 ? '标题最多 120 字符' : true)
    })
    value = result.value ?? ''
  } catch {
    return
  }
  actionBusy.value = 'rename'
  try {
    await renameDevSession(props.appId, item.id, { title: value })
    await loadSessions()
    ElMessage.success('已重命名')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    actionBusy.value = ''
  }
}

async function archiveSession(item: DevSessionListItem): Promise<void> {
  if (actionBusy.value) return
  try {
    await ElMessageBox.confirm(
      item.status === 'active'
        ? '归档会先停止当前会话，之后可在左侧列表只读查看或恢复；不会删除 opencode 会话。'
        : '归档后仍可在左侧列表只读查看或恢复；不会删除 opencode 会话。',
      '归档开发会话',
      { type: 'warning', confirmButtonText: '归档', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  actionBusy.value = 'archive'
  try {
    const wasSelected = selectedSessionId.value === item.id
    await archiveDevSessionById(props.appId, item.id)
    if (wasSelected) {
      connection?.close()
      connection = null
      selectedSessionId.value = null
      await refresh(false)
    } else {
      await loadSessions()
    }
    ElMessage.success('已归档会话')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
    await loadSessions()
  } finally {
    actionBusy.value = ''
  }
}

async function restoreSession(item: DevSessionListItem): Promise<void> {
  if (actionBusy.value) return
  const mismatch = handoffVersionMismatch(item, handoff.value?.version)
  const warning = mismatch
    ? `该会话基于交接包 v${item.handoffVersion}，当前交接包 v${handoff.value?.version}；继续可能使用旧上下文，建议新建会话。\n\n`
    : ''
  try {
    await ElMessageBox.confirm(
      `${warning}恢复会把当前会话归档，并让该会话成为当前会话。`,
      '恢复为当前会话',
      { type: 'warning', confirmButtonText: '恢复', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  actionBusy.value = 'activate'
  try {
    connection?.close()
    connection = null
    const next = await activateDevSession(props.appId, item.id)
    selectedSessionId.value = item.id
    applyData(next)
    phaseWarnings.value = []
    await loadSessions()
    await loadPhases()
    ensureEvents()
    emit('app-changed')
    ElMessage.success('已恢复为当前会话')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
    await loadSessions()
  } finally {
    actionBusy.value = ''
  }
}

async function restoreCurrent(): Promise<void> {
  if (currentItem.value) {
    await restoreSession(currentItem.value)
    return
  }
  if (session.value) {
    await restoreSession({
      id: session.value.id,
      opencodeSessionId: session.value.opencodeSessionId,
      title: session.value.title,
      note: session.value.note,
      displayTitle: headerTitle.value,
      opencodeTitle: null,
      status: session.value.status,
      model: session.value.model,
      createdAt: session.value.createdAt,
      updatedAt: session.value.updatedAt,
      lastActiveAt: session.value.lastActiveAt,
      changeSetId: session.value.changeSetId,
      changeSetSeq: null,
      changeSetTitle: null,
      changeSetStatus: null,
      handoffVersion: session.value.handoffVersion,
      handoffHash: session.value.handoffHash,
      opencodeExists: null,
      active: false,
      phaseId: session.value.phase?.id ?? null,
      phaseKey: session.value.phase?.key ?? null,
      phaseTitle: session.value.phase?.title ?? null,
      phaseOrder: session.value.phase?.order ?? null,
      phaseStatus: session.value.phase?.status ?? null
    })
  }
}

async function send(): Promise<void> {
  if (actionBusy.value || readOnly.value || !composer.value.trim()) return
  const text = composer.value.trim()
  actionBusy.value = 'send'
  error.value = ''
  try {
    const wasCompleted = localCompleted.value
    const result = await promptDevSession(props.appId, text)
    composer.value = ''
    if (wasCompleted) {
      localCompleted.value = false
      emit('app-changed')
    }
    ensureEvents()
    await refresh(true)
    if (result.warning) {
      ElMessage.warning(result.warning)
      void loadPhases()
    }
    await nextTick()
    scrollToBottom(true)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    error.value = message
    ElMessage.error(message)
  } finally {
    actionBusy.value = ''
  }
}

async function stop(): Promise<void> {
  if (actionBusy.value || readOnly.value) return
  actionBusy.value = 'stop'
  try {
    await interruptDevSession(props.appId)
    await refresh(true)
    ElMessage.success('已请求停止')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    actionBusy.value = ''
  }
}

/** I-09a：二次确认后请求 opencode 原生 compact；只读会话不提供入口 */
async function compactContext(): Promise<void> {
  if (actionBusy.value || readOnly.value) return
  try {
    await ElMessageBox.confirm(
      '压缩会用总结替换较早上下文，可能丢失细节；当前会话与代码不会中断。继续？',
      '压缩上下文',
      { type: 'warning', confirmButtonText: '压缩', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  actionBusy.value = 'compact'
  try {
    await compactDevSession(props.appId)
    ElMessage.success('已提交压缩请求，结果见时间线')
    await refresh(true)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    actionBusy.value = ''
  }
}

async function completeDevelopment(): Promise<void> {
  if (actionBusy.value) return
  try {
    await ElMessageBox.confirm('确认开发已完成？只记录完成状态，不检查 Git / 证据 / 测试门禁。', '确认完成开发', {
      type: 'warning',
      confirmButtonText: '确认完成',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  actionBusy.value = 'complete'
  try {
    await completeApp(props.appId)
    localCompleted.value = true
    emit('app-changed')
    ElMessage.success('已记录开发完成')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    actionBusy.value = ''
  }
}

async function replyPermission(requestId: string, decision: 'once' | 'always' | 'reject', message?: string): Promise<void> {
  if (actionBusy.value) return
  actionBusy.value = 'permission'
  try {
    await replyDevPermission(props.appId, requestId, decision, message)
    await refresh(true)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    actionBusy.value = ''
  }
}

async function replyForm(formId: string, answer: Record<string, FormValue>): Promise<void> {
  if (actionBusy.value) return
  actionBusy.value = 'form'
  try {
    await replyDevForm(props.appId, formId, answer)
    await refresh(true)
    ElMessage.success('表单已提交')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    actionBusy.value = ''
  }
}

function openHandoff(file?: string): void {
  emit('open-handoff', file)
}

function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

/** 时间线事件时间：ms → HH:mm:ss */
function formatClock(ms: number): string {
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('zh-CN', { hour12: false })
}

function formatElapsed(ms: number | null | undefined): string {
  if (!ms || ms < 0) return '—'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(1)} KB`
}

function onScroll(): void {
  const element = scroller.value
  if (!element) return
  stick = element.scrollHeight - element.scrollTop - element.clientHeight < 80
  if (stick) hasNew.value = false
}

async function scrollToBottom(force = false): Promise<void> {
  if (!force && !stick) return
  await nextTick()
  const element = scroller.value
  if (!element) return
  element.scrollTop = element.scrollHeight
  stick = true
  hasNew.value = false
}

watch(
  () => [state.value?.messages.length, state.value?.steps.length, state.value?.status],
  async () => {
    await nextTick()
    if (stick) await scrollToBottom(true)
    else hasNew.value = true
  }
)

watch(
  () => props.completed,
  value => {
    if (typeof value === 'boolean') localCompleted.value = value
  }
)

watch(
  () => props.appId,
  () => {
    connection?.close()
    connection = null
    loading.value = true
    data.value = null
    handoffMeta.value = null
    composer.value = ''
    startPrompt.value = ''
    sessions.value = []
    selectedSessionId.value = null
    phasesSeq += 1
    phasesData.value = null
    selectedPhaseId.value = null
    phaseDialogOpen.value = false
    phaseWarnings.value = []
    plainStartOpen.value = false
    void refresh(false)
  }
)

onMounted(async () => {
  sidebarOpen.value = window.innerWidth > 1024
  asideOpen.value = window.innerWidth > 1024
  syncPaneLayout()
  window.addEventListener('resize', syncPaneLayout)
  window.addEventListener('keydown', onKeydown)
  await refresh(false)
  pollTimer = setInterval(() => {
    if (session.value && !readOnly.value) void refresh(true)
  }, 5000)
})

onUnmounted(() => {
  connection?.close()
  connection = null
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  window.removeEventListener('resize', syncPaneLayout)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.dev-view {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--rg-bg, #f4f5f7);
  color: var(--rg-text, #1f2937);
  font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.dev-head {
  flex-shrink: 0;
  min-height: 46px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 6px 14px;
  background: var(--rg-surface, #fff);
  border-bottom: 1px solid var(--rg-border, #e4e7ec);
  font-size: 12px;
}
.dev-title {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
}
.pane-toggle {
  flex-shrink: 0;
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface, #fff);
  color: var(--rg-text-2, #4b5563);
  border-radius: 6px;
  width: 26px;
  height: 26px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.pane-toggle:hover {
  border-color: var(--rg-border-strong, #d4d9e2);
  background: var(--rg-hover, #f6f7f9);
  color: var(--rg-text, #1f2937);
}
.pane-toggle.active {
  border-color: var(--rg-ai-border, #d9d9f7);
  background: var(--rg-ai-soft, #eeeefc);
  color: var(--rg-ai, #5b5bd6);
}
.readonly-chip {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10px;
  color: var(--rg-warn, #a05e03);
  background: var(--rg-warn-soft, #fdf4e3);
}
.badge {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-ai-soft, #eeeefc);
  color: var(--rg-ai, #5b5bd6);
  font-size: 10.5px;
}
.dev-title strong {
  font-size: 13px;
  min-width: 0;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta {
  color: var(--rg-text-3, #8a93a3);
  font-size: 11px;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dev-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
}
.ctx-chip {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  border: 1px solid transparent;
  background: var(--rg-fill-2, #eef0f4);
  color: var(--rg-text-2, #4b5563);
  white-space: nowrap;
  cursor: default;
}
.ctx-chip.warn {
  background: var(--rg-warn-soft, #fdf4e3);
  color: var(--rg-warn, #a05e03);
  border-color: var(--rg-warn-border, #f2d9a8);
}
.ctx-chip.danger {
  background: var(--rg-danger-soft, #fdeeef);
  color: var(--rg-danger, #c23a45);
  border-color: var(--rg-danger-border, #f5c7cb);
}
.ctx-chip.unknown {
  color: var(--rg-text-3, #8a93a3);
}
.compact-btn.highlight {
  border-color: var(--rg-warn, #a05e03);
  color: var(--rg-warn, #a05e03);
  background: var(--rg-warn-soft, #fdf4e3);
}
.compact-btn.highlight.danger {
  border-color: var(--rg-danger, #c23a45);
  color: var(--rg-danger, #c23a45);
  background: var(--rg-danger-soft, #fdeeef);
}
.context-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-radius: 8px;
  padding: 9px 11px;
  font-size: 12px;
}
.context-banner.warn {
  background: var(--rg-warn-soft, #fdf4e3);
  color: var(--rg-warn, #a05e03);
}
.context-banner.danger {
  background: var(--rg-danger-soft, #fdeeef);
  color: var(--rg-danger, #c23a45);
}
.timeline-notice {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 92%;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 11.5px;
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-fill, #f4f5f7);
  color: var(--rg-text-2, #4b5563);
  text-align: left;
}
.timeline-notice .notice-text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.timeline-notice.failed {
  border-color: var(--rg-danger-border, #f5c7cb);
  background: var(--rg-danger-soft, #fdeeef);
  color: var(--rg-danger, #c23a45);
}
.timeline-notice .notice-icon {
  font-size: 12px;
  opacity: 0.7;
}
.timeline-notice .notice-time {
  color: var(--rg-text-3, #8a93a3);
  font-size: 10.5px;
}
.ctx-detail.ok {
  color: var(--rg-text-2, #4b5563);
}
.ctx-detail.warn {
  color: var(--rg-warn, #a05e03);
}
.ctx-detail.danger {
  color: var(--rg-danger, #c23a45);
}
.conn,
.run-status {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-fill-2, #eef0f4);
  color: var(--rg-text-3, #8a93a3);
}
.conn.open {
  color: var(--rg-ok, #12855f);
  background: var(--rg-ok-soft, #e8f5ef);
}
.conn.error {
  color: var(--rg-danger, #c23a45);
  background: var(--rg-danger-soft, #fdeeef);
}
.run-status.running {
  color: var(--rg-ai, #5b5bd6);
  background: var(--rg-ai-soft, #eeeefc);
}
.run-status.done {
  color: var(--rg-ok, #12855f);
  background: var(--rg-ok-soft, #e8f5ef);
}
.dev-body {
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
  overflow: hidden;
}
.dev-mask {
  position: absolute;
  inset: 0;
  z-index: 30;
  background: var(--rg-overlay, rgba(20, 24, 31, 0.42));
  border: 0;
  padding: 0;
}
.dev-sessions {
  width: 260px;
  flex-shrink: 0;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface, #fff);
  display: flex;
}
.dev-body.sidebar-collapsed .dev-sessions {
  display: none;
}
.timeline {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}
/* Composer/只读条移入 timeline 后，滚动区与“回到最新”共用这一层，按钮不再压住输入框 */
.timeline-main {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}
.timeline-scroll {
  flex: 1;
  overflow: auto;
  padding: 18px 20px;
}
.timeline-content {
  width: min(880px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.center-card,
.start-card {
  margin: 40px auto;
  width: min(720px, calc(100% - 40px));
  background: var(--rg-surface, #fff);
  border: 1px solid var(--rg-border, #e4e7ec);
  border-radius: 14px;
  padding: 22px;
}
.center-card {
  text-align: center;
  font-size: 12.5px;
  color: var(--rg-text-3, #8a93a3);
}
.error-card p {
  color: var(--rg-danger, #c23a45);
  white-space: pre-wrap;
}
.center-actions,
.start-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 14px;
}
.start-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.start-card h2 {
  margin: 0;
  font-size: 19px;
}
.start-card p {
  margin: 0 0 12px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--rg-text-2, #4b5563);
}
.start-card textarea {
  width: 100%;
  border: 1px solid var(--rg-border-strong, #d4d9e2);
  border-radius: 9px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--rg-text, #1f2937);
  background: var(--rg-surface-2, #fafbfc);
  resize: vertical;
  outline: none;
}
.start-card textarea::placeholder {
  color: var(--rg-text-3, #8a93a3);
}
.start-card textarea:focus {
  border-color: var(--rg-ai, #5b5bd6);
  background: var(--rg-surface, #fff);
  box-shadow: 0 0 0 3px var(--rg-ai-soft, #eeeefc);
}
.start-actions {
  justify-content: flex-start;
}
/* U7：开始卡片里的阶段快捷列表 */
.phase-start-list {
  list-style: none;
  margin: 4px 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.phase-start-item {
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface-2, #fafbfc);
  border-radius: 9px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.phase-start-item.current {
  border-color: var(--rg-ai-border, #d9d9f7);
}
.psi-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px 7px;
  min-width: 0;
}
.psi-title {
  flex: 1 1 200px;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--rg-text, #1f2937);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.phase-chip {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 9.5px;
  border: 1px solid transparent;
  background: var(--rg-fill-2, #eef0f4);
  color: var(--rg-text-3, #8a93a3);
  white-space: nowrap;
}
.phase-chip.in-progress {
  background: var(--rg-ai-soft, #eeeefc);
  color: var(--rg-ai, #5b5bd6);
}
.phase-chip.completed {
  background: var(--rg-ok-soft, #e8f5ef);
  color: var(--rg-ok, #12855f);
}
.phase-chip.skipped,
.phase-chip.unknown {
  background: var(--rg-fill-2, #eef0f4);
  color: var(--rg-text-3, #8a93a3);
}
.phase-chip.not-started {
  color: var(--rg-text-3, #8a93a3);
}
.psi-session {
  flex-shrink: 0;
  font-size: 9.5px;
  color: var(--rg-ai, #5b5bd6);
}
.psi-goal {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--rg-text-3, #8a93a3);
  overflow-wrap: anywhere;
}
.psi-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.plain-toggle {
  border: 0;
  background: transparent;
  padding: 2px 0;
  margin-bottom: 6px;
  font-size: 11.5px;
  color: var(--rg-ai, #5b5bd6);
  cursor: pointer;
  text-align: left;
}
.plain-toggle:hover {
  text-decoration: underline;
}
.hint,
.muted {
  font-size: 11px;
  color: var(--rg-text-3, #8a93a3);
}
.warn {
  color: var(--rg-warn, #a05e03);
  background: var(--rg-warn-soft, #fdf4e3);
  border-radius: 8px;
  padding: 8px 10px;
}
.user-message {
  align-self: flex-end;
  max-width: 78%;
  background: var(--rg-user-bubble, #20242e);
  color: var(--rg-user-bubble-text, #fff);
  border-radius: 12px 12px 4px 12px;
  padding: 9px 12px;
}
.user-message pre,
.assistant-message pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.7;
}
.assistant-message {
  align-self: flex-start;
  max-width: 90%;
  background: var(--rg-surface, #fff);
  border: 1px solid var(--rg-border, #e4e7ec);
  border-radius: 4px 12px 12px 12px;
  padding: 10px 13px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.reasoning {
  border-left: 2px solid var(--rg-border-strong, #d4d9e2);
  padding-left: 9px;
  color: var(--rg-text-3, #8a93a3);
}
.reasoning-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.reasoning pre {
  font-size: 11.5px !important;
}
.pending-stack {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 4px;
}
.completed-banner {
  border-radius: 8px;
  background: var(--rg-ok-soft, #e8f5ef);
  color: var(--rg-ok, #12855f);
  padding: 9px 11px;
  font-size: 12px;
}
.readonly-banner {
  border-radius: 8px;
  background: var(--rg-warn-soft, #fdf4e3);
  color: var(--rg-warn, #a05e03);
  padding: 9px 11px;
  font-size: 12px;
}
.readonly-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-warn-soft, #fdf4e3);
  color: var(--rg-warn, #a05e03);
  padding: 10px 16px;
  font-size: 12px;
}
.error-banner {
  border-radius: 8px;
  background: var(--rg-danger-soft, #fdeeef);
  color: var(--rg-danger, #c23a45);
  padding: 9px 11px;
  font-size: 12px;
}
.working-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--rg-text-3, #8a93a3);
  padding: 4px 2px;
}
.spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--rg-border, #e4e7ec);
  border-top-color: var(--rg-ai, #5b5bd6);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.empty-timeline {
  color: var(--rg-text-3, #8a93a3);
  font-size: 12.5px;
  text-align: center;
  padding: 40px 0;
}
.back-latest {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface, #fff);
  color: var(--rg-text-2, #4b5563);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 11.5px;
  box-shadow: var(--rg-shadow-2, 0 2px 6px rgba(16, 24, 40, 0.08));
  cursor: pointer;
}
.back-latest:hover {
  border-color: var(--rg-border-strong, #d4d9e2);
  color: var(--rg-text, #1f2937);
}
.dev-side {
  width: 260px;
  flex-shrink: 0;
  min-width: 0;
  border-left: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface, #fff);
  overflow: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.dev-body.aside-collapsed .dev-side {
  display: none;
}
.dev-side section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.dev-side h3 {
  margin: 0;
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--rg-text-3, #8a93a3);
}
.dev-side dl {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11.5px;
}
.dev-side dl div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
.dev-side dt {
  color: var(--rg-text-3, #8a93a3);
}
.dev-side dd {
  margin: 0;
  text-align: right;
  color: var(--rg-text-2, #4b5563);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mono {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px;
}
.side-actions {
  display: flex;
  gap: 6px;
}
.doc-link {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-fill, #f4f5f7);
  border-radius: 7px;
  padding: 6px 8px;
  font-size: 11px;
  color: var(--rg-text-2, #4b5563);
  cursor: pointer;
  text-align: left;
}
.doc-link:hover {
  border-color: var(--rg-border-strong, #d4d9e2);
  background: var(--rg-fill-2, #eef0f4);
}
.doc-link:focus-visible {
  outline: 2px solid var(--rg-focus-ring);
  outline-offset: 1px;
}
.doc-link small {
  color: var(--rg-text-3, #8a93a3);
  font-size: 10px;
  flex-shrink: 0;
}
.handoff-scale {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--rg-warn-border, #f0dcae);
  background: var(--rg-warn-soft, #fdf4e3);
  border-radius: 7px;
}
.handoff-scale .scale-chip {
  font-size: 10px;
  font-weight: 600;
  border-radius: 999px;
  padding: 1px 7px;
  color: var(--rg-warn, #a05e03);
  background: var(--rg-surface, #fff);
  border: 1px solid var(--rg-warn-border, #f0dcae);
  white-space: nowrap;
}
.handoff-scale .scale-counts {
  font-size: 11px;
  color: var(--rg-text-2, #4b5563);
}
.handoff-scale .scale-triggers {
  font-size: 10.5px;
}
.handoff-scale .btn {
  margin-left: auto;
}
.file-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.file-list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 10.5px;
  color: var(--rg-text-3, #8a93a3);
}
.file-list code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'JetBrains Mono', Consolas, monospace;
}
.file-list span {
  flex-shrink: 0;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface, #fff);
  color: var(--rg-text-2, #4b5563);
  border-radius: 7px;
  padding: 6px 10px;
  font-size: 11.5px;
  cursor: pointer;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-border-strong, #d4d9e2);
  background: var(--rg-hover, #f6f7f9);
  color: var(--rg-text, #1f2937);
}
.btn.primary {
  background: var(--rg-ink, #20242e);
  border-color: var(--rg-ink, #20242e);
  color: var(--rg-ink-contrast, #fff);
}
.btn.primary:hover:not(:disabled) {
  background: var(--rg-ink-hover, #333846);
  border-color: var(--rg-ink-hover, #333846);
  color: var(--rg-ink-contrast, #fff);
}
.btn.small {
  padding: 4px 8px;
  font-size: 11px;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
code {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  background: var(--rg-fill-2, #eef0f4);
  border-radius: 4px;
  padding: 1px 5px;
}
@media (max-width: 1280px) {
  .dev-sessions {
    width: 224px;
  }
  .dev-side {
    width: 236px;
    padding: 12px;
  }
  .dev-head {
    gap: 6px 10px;
    padding: 6px 12px;
  }
}
/* ≤1024：会话栏与右侧 aside 折叠为抽屉（遮罩 + Esc/点遮罩关闭），时间线全宽 */
@media (max-width: 1024px) {
  .handoff-meta {
    display: none;
  }
  .dev-sessions,
  .dev-side {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 40;
    width: min(320px, 86vw);
    box-shadow: var(--rg-shadow-2, 0 8px 28px rgba(16, 24, 40, 0.18));
  }
  .dev-sessions {
    left: 0;
    border-right: 1px solid var(--rg-border, #e4e7ec);
  }
  .dev-side {
    right: 0;
    border-left: 1px solid var(--rg-border, #e4e7ec);
  }
}
/* ≤768：单栏 + 抽屉；顶栏两行、Composer/只读条贴底 */
@media (max-width: 768px) {
  .dev-head {
    padding: 6px 10px;
  }
  .dev-title {
    flex-basis: 100%;
  }
  .dev-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-start;
    gap: 6px;
  }
  .dev-actions .conn {
    display: none;
  }
  .timeline-scroll {
    padding: 12px 10px;
  }
  .timeline-content {
    gap: 10px;
  }
  .user-message {
    max-width: 92%;
  }
  .assistant-message {
    max-width: 100%;
  }
  .center-card,
  .start-card {
    width: calc(100% - 24px);
    margin: 20px auto;
    padding: 16px;
  }
  .start-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .start-card h2 {
    font-size: 17px;
  }
  .readonly-bar {
    flex-wrap: wrap;
  }
  .dev-sessions,
  .dev-side {
    width: min(320px, calc(100vw - 40px));
  }
}
</style>
