<template>
  <div class="dev-view" data-testid="dev-view">
    <header class="dev-head">
      <div class="dev-title">
        <button
          type="button"
          class="pane-toggle"
          data-testid="dev-sidebar-toggle"
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
        <label v-if="moduleOptions.length" class="module-pick" title="开发目标模块；prompt 会带上模块并生成 ui-check 骨架">
          <span>模块</span>
          <select v-model="moduleKey" data-testid="dev-module-select" :disabled="actionBusy !== ''">
            <option value="">未指定</option>
            <option v-for="option in moduleOptions" :key="option.key" :value="option.key">
              {{ option.key }} · {{ option.title }}{{ option.hasDesign ? '' : '（无设计）' }}
            </option>
          </select>
        </label>
        <span v-else class="meta" data-testid="dev-module-empty">暂无设计模块</span>
        <span v-if="readOnly" class="readonly-chip">只读 · {{ sessionStatusLabel(session?.status ?? '') }}</span>
      </div>
      <div class="dev-actions">
        <span v-if="session" :class="['ctx-chip', contextInfo.level]" :title="contextInfo.title" data-testid="context-chip">
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
        <span :class="['run-status', statusClass]" data-testid="dev-status">{{ statusLabel }}</span>
        <button type="button" class="btn" :disabled="actionBusy !== ''" @click="newSession">新会话</button>
        <button
          type="button"
          class="pane-toggle"
          data-testid="dev-aside-toggle"
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
      <div v-if="maskVisible" class="dev-mask" data-testid="dev-mask" aria-hidden="true" @click="closePanes" />
      <div class="dev-sessions" data-testid="dev-sessions">
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
      <main class="timeline" data-testid="dev-timeline">
        <div v-if="loading" class="center-card">正在加载开发会话…</div>
        <div v-else-if="error" class="center-card error-card">
          <p>{{ error }}</p>
          <div class="center-actions">
            <button type="button" class="btn" @click="refresh(false)">重试</button>
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
        <div v-else-if="!session" class="start-card" data-testid="dev-start-card">
          <div class="start-head">
            <h2>开始开发</h2>
            <span class="hint">opencode 原生 build agent · 不限制工具/流程</span>
          </div>
          <p>
            产物是工作区里的文件：<code>AGENTS.md</code>、<code>docs/requirements/</code>、<code>docs/design/</code> 与现有代码。
            首条提示已让 agent 先读这些材料再动手；你可以编辑后再发送。
          </p>
          <textarea
            v-model="startPrompt"
            rows="5"
            data-testid="dev-start-prompt"
            :disabled="actionBusy !== ''"
          />
          <div class="start-actions">
            <button
              type="button"
              class="btn primary"
              data-testid="dev-start-btn"
              :disabled="actionBusy !== ''"
              @click="start"
            >
              {{ actionBusy === 'start' ? '启动中…' : '开始开发' }}
            </button>
          </div>
        </div>
        <template v-else>
          <div class="timeline-main">
            <div ref="scroller" class="timeline-scroll" @scroll="onScroll">
              <div ref="content" class="timeline-content">
                <div v-if="readOnly" class="readonly-banner">
                  该会话{{ sessionStatusLabel(session.status) }}，只读查看；恢复为当前会话后可继续发送。
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
                    <details v-if="showReasoning(entry.message)" class="rg-reasoning" open data-testid="dev-reasoning">
                      <summary>思考</summary>
                      <pre>{{ entry.message.reasoning }}</pre>
                    </details>
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

                <div v-if="pending" :class="['rg-pending', pending.phase]" :data-testid="pendingId">
                  <span v-if="pending.phase === 'awaiting'" class="rg-pending-spinner" />
                  <span>{{ pendingText }}</span>
                </div>

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

                <div v-if="state?.status === 'running' && !pending" class="working-row">
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
          placeholder="给开发 agent 发消息… 会先读 AGENTS.md 与 docs/ 再执行 · Enter 发送"
          @send="send"
          @stop="stop"
        />
        <div v-else-if="session && readOnly" class="readonly-bar" data-testid="dev-readonly-bar">
          <span>该会话{{ sessionStatusLabel(session.status) }}，只读查看；恢复为当前会话后可继续发送。</span>
          <button type="button" class="btn primary" :disabled="actionBusy !== ''" @click="restoreCurrent">恢复为当前会话</button>
        </div>
      </main>

      <aside class="dev-side">
        <section data-testid="dev-design-ref">
          <h3>设计参考</h3>
          <p v-if="designHint" class="muted warn" data-testid="dev-design-hint">{{ designHint }}</p>
          <dl>
            <div><dt>应用类型</dt><dd :title="designRef.applicationTypeName">{{ designRef.applicationTypeName || '—' }}</dd></div>
            <div><dt>视觉风格</dt><dd :title="designRef.styleName">{{ designRef.styleName || '—' }}</dd></div>
            <div><dt>页面库</dt><dd>{{ designRef.pageCount }} 页</dd></div>
            <div><dt>模块</dt><dd :title="selectedModule?.title ?? ''">{{ selectedModule ? `${selectedModule.key} · ${selectedModule.title}` : '未指定' }}</dd></div>
            <div>
              <dt>ui-check</dt>
              <dd
                :class="['ui-check', uiCheckTone(uiCheckStatus)]"
                :title="selectedModule?.uiCheckFile || 'docs/design/<MOD>/ui-check.md'"
                data-testid="dev-ui-check-status"
              >
                {{ uiCheckLabel(uiCheckStatus) }}
              </dd>
            </div>
            <div><dt>蓝图根</dt><dd class="mono" :title="designRef.blueprintRoot">{{ designRef.blueprintRoot }}</dd></div>
          </dl>
          <p v-if="uiCheckFlowPending" class="muted warn" data-testid="dev-ui-check-pending">
            {{ uiCheckHint(uiCheckStatus) }}
          </p>
          <p class="muted">软门禁：先填 ui-check 对照表再写代码；未填不阻断，只标记流程未完成。</p>
          <div class="side-actions">
            <button
              type="button"
              class="btn small"
              data-testid="dev-fidelity-check"
              :disabled="fidelityBusy"
              @click="runFidelityCheck"
            >
              {{ fidelityBusy ? '检查中…' : '检查一致性' }}
            </button>
            <button type="button" class="btn small" data-testid="dev-open-templates" @click="openDesignTemplates">打开模板中心</button>
          </div>
          <p class="muted">只读静态检查：PageTemplates/pm-*/表单/列表/样式/ui-check/PNG stale；不阻断、不改代码。</p>
          <p v-if="fidelityError" class="muted warn" data-testid="dev-fidelity-error">{{ fidelityError }}</p>
          <section v-if="fidelityReport" class="fidelity-report" data-testid="dev-fidelity-report">
            <div class="fidelity-head">
              <span :class="['fidelity-status', fidelityTone]" data-testid="dev-fidelity-status">{{ fidelityLabel }}</span>
              <span class="muted" data-testid="dev-fidelity-summary">{{ fidelitySummary }}</span>
            </div>
            <p class="muted" data-testid="dev-fidelity-meta">
              {{ fidelityScope }} · {{ formatTime(fidelityReport.generatedAt) }}
            </p>
            <p v-if="fidelityReport.empty" class="muted warn" data-testid="dev-fidelity-empty">{{ fidelityEmpty }}</p>
            <ul v-else class="fidelity-checks">
              <li
                v-for="check in fidelityReport.checks"
                :key="check.id"
                :class="['fidelity-item', check.status]"
                :data-testid="`dev-fidelity-check-${check.id}`"
              >
                <div class="fidelity-item-head">
                  <span :class="['fidelity-badge', fidelityStatusTone(check.status)]">{{ fidelityCheckLabel(check.status) }}</span>
                  <strong>{{ check.label }}</strong>
                </div>
                <p>{{ check.evidence }}</p>
                <p v-if="check.hint" class="fidelity-hint">建议：{{ check.hint }}</p>
              </li>
            </ul>
            <p class="muted">只读报告：不会自动修改代码；失败/警告请按建议处理。</p>
          </section>
        </section>

        <section>
          <h3>会话</h3>
          <dl>
            <div><dt>标题</dt><dd :title="headerTitle">{{ headerTitle }}</dd></div>
            <div><dt>状态</dt><dd>{{ readOnly ? `只读 · ${sessionStatusLabel(session?.status ?? '')}` : statusLabel }}</dd></div>
            <div><dt>视图</dt><dd>开发</dd></div>
            <div><dt>模型</dt><dd class="mono" :title="modelLabel">{{ modelLabel }}</dd></div>
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
          <h3>文件变化</h3>
          <p v-if="!changedFiles.length" class="muted">Agent 写入文件后会出现在这里。</p>
          <ul v-else class="file-list" data-testid="dev-file-changes">
            <li v-for="file in changedFiles" :key="file.path">
              <code>{{ file.path }}</code>
              <span>{{ file.mode }}</span>
            </li>
          </ul>
        </section>

        <section>
          <h3>工作区</h3>
          <p class="muted">
            需求：<code>docs/requirements/</code><br />
            设计：<code>docs/design/</code><br />
            约定：<code>AGENTS.md</code>
          </p>
          <p class="muted">产物以文件为准；agent 修改后需求/设计视图会自动刷新。</p>
        </section>
      </aside>
    </div>
    <DesignTemplateCenter v-model="designCenterOpen" mode="browse" :selection="designCenterSelection" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Composer from './Composer.vue'
import FormCard from './FormCard.vue'
import PermissionCard from './PermissionCard.vue'
import SessionList from './SessionList.vue'
import StepCard from './StepCard.vue'
import DesignTemplateCenter from '../workbench/DesignTemplateCenter.vue'
import '../shared/reasoning.css'
import {
  activateDevSession,
  archiveDevSessionById,
  checkDesignFidelity,
  compactDevSession,
  connectDevEvents,
  createDevSession,
  getDevState,
  interruptDevSession,
  listDevSessions,
  promptDevSession,
  renameDevSession,
  replyDevForm,
  replyDevPermission,
  type DevEventConnection
} from './api'
import { getArtifacts } from '../workbench/api'
import { getAppDesignSystem, type AppDesignSystem } from '../shared/design-system-api'
import {
  buildModuleOptions,
  designRefHint,
  designRefSummary,
  fidelityCheckLabel,
  fidelityEmptyText,
  fidelityStatusLabel,
  fidelityStatusTone,
  fidelitySummaryText,
  moduleOptionOf,
  pickModuleKey,
  uiCheckHint,
  uiCheckLabel,
  uiCheckTone
} from './design-ref.js'
import { contextDetail, contextHint, contextLabel, contextNeedsCompact, contextTitle } from './dev-health.js'
import { displayTitle as sessionDisplayTitle, sessionStatusLabel } from './session-labels.js'
import { nextPending, pendingLabel, pendingTestId, shouldShowReasoning } from '../workbench/chat-status.js'
import type {
  DesignFidelityReport,
  DevSessionListItem,
  DevSessionMessage,
  DevSessionState,
  DevStateResponse,
  DevStep,
  FormInfo,
  FormValue,
  PermissionRequest
} from './types'

const props = defineProps<{ appId: string }>()
const emit = defineEmits<{ 'app-changed': [] }>()

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
const actionBusy = ref<
  '' | 'start' | 'send' | 'stop' | 'permission' | 'form' | 'switch' | 'rename' | 'archive' | 'activate' | 'compact'
>('')
const composer = ref('')
const pending = ref<ReturnType<typeof nextPending>>(null)
let assistantBaseline = 0
const startPrompt = ref('')
const connectionState = ref<ConnectionState>('closed')
const hasNew = ref(false)
const scroller = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const composerRef = ref<InstanceType<typeof Composer> | null>(null)
const sessions = ref<DevSessionListItem[]>([])
const sessionsLoading = ref(false)
const selectedSessionId = ref<string | null>(null)
const sidebarOpen = ref(true)
const asideOpen = ref(true)
const narrow = ref(false)
const maskVisible = computed(() => narrow.value && (sidebarOpen.value || asideOpen.value))
const moduleOptions = ref<ReturnType<typeof buildModuleOptions>>([])
const moduleKey = ref('')
const designSystem = ref<AppDesignSystem | null>(null)
const designCenterOpen = ref(false)
const fidelityReport = ref<DesignFidelityReport | null>(null)
const fidelityBusy = ref(false)
const fidelityError = ref('')
const MODULE_STORAGE_PREFIX = 'adw.dev.module.'

let connection: DevEventConnection | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let stick = true

const appName = computed(() => data.value?.app.name ?? props.appId)
const session = computed(() => data.value?.session ?? null)
const state = computed<DevSessionState | null>(() => data.value?.state ?? null)
const readOnly = computed(() => data.value?.readOnly ?? false)
const currentItem = computed<DevSessionListItem | null>(() => {
  const id = selectedSessionId.value ?? data.value?.session?.id ?? null
  if (!id) return null
  return sessions.value.find(item => item.id === id) ?? null
})
const headerTitle = computed(() => (currentItem.value ? sessionDisplayTitle(currentItem.value, appName.value) : appName.value))
const isRunning = computed(() => state.value?.status === 'running')
const pendingPermissions = computed(() => (state.value?.pending.permissions ?? []) as unknown as PermissionRequest[])
const pendingForms = computed(() => (state.value?.pending.forms ?? []) as unknown as FormInfo[])
const modelLabel = computed(() => {
  const model = session.value?.model
  return model ? `${model.providerID}/${model.id}` : 'opencode 默认模型'
})
const statusLabel = computed(() => {
  if (readOnly.value) return '只读查看'
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
  done: state.value?.status === 'succeeded',
  idle: Boolean(session.value) && !isRunning.value
}))
const connectionLabel = computed(
  () => ({ connecting: '连接中', open: '实时', error: '连接异常', closed: '未连接' })[connectionState.value]
)
const tokenLabel = computed(() => {
  const tokens = state.value?.stats.tokens
  if (!tokens) return '—'
  return `${tokens.input} / ${tokens.output}`
})
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
const selectedModule = computed(() => moduleOptionOf(moduleOptions.value, moduleKey.value))
const uiCheckStatus = computed(() => selectedModule.value?.uiCheckStatus ?? 'missing')
const uiCheckFlowPending = computed(() => Boolean(selectedModule.value) && uiCheckStatus.value !== 'filled')
const designRef = computed(() => designRefSummary(designSystem.value))
const designHint = computed(() => designRefHint(moduleOptions.value))
const designCenterSelection = computed(() => {
  const design = designSystem.value
  if (!design || !design.pack || !design.applicationType || !design.style) return undefined
  return { pack: design.pack.id, applicationType: design.applicationType.id, style: design.style.id }
})
const fidelityTone = computed(() => fidelityStatusTone(fidelityReport.value?.summary?.status ?? ''))
const fidelityLabel = computed(() => fidelityStatusLabel(fidelityReport.value?.summary?.status ?? ''))
const fidelitySummary = computed(() => fidelitySummaryText(fidelityReport.value))
const fidelityEmpty = computed(() => fidelityEmptyText(fidelityReport.value))
const fidelityScope = computed(() => {
  const report = fidelityReport.value
  if (!report) return ''
  if (report.module) return `模块 ${report.module}`
  if (report.modules.length) return `全部模块 ${report.modules.join('、')}`
  return '无模块'
})

const pendingId = computed(() => pendingTestId(pending.value, 'dev'))
const pendingText = computed(() => pendingLabel(pending.value))
const assistantCount = computed(() => (state.value?.messages ?? []).filter(message => message.type === 'assistant').length)

function applyPending(action: { type: string; message?: string }): void {
  pending.value = nextPending(pending.value, action)
}

function beginPending(): void {
  assistantBaseline = assistantCount.value
  applyPending({ type: 'send' })
}

function showReasoning(message?: { reasoning?: string }): boolean {
  return shouldShowReasoning(message)
}

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
      else if (['write', 'edit', 'patch', 'multiedit', 'apply_patch'].includes(item.name) && item.target)
        files.set(item.target, '写入')
    }
  }
  return [...files].slice(-30).map(([path, mode]) => ({ path, mode }))
})

function applyData(next: DevStateResponse, preserveComposer = true): void {
  const previousSessionId = data.value?.session?.opencodeSessionId
  data.value = next
  if (next.session && !selectedSessionId.value) selectedSessionId.value = next.session.id
  if (next.defaultPrompt && !startPrompt.value) startPrompt.value = next.defaultPrompt
  if (!preserveComposer && next.session) composer.value = ''
  // 新会话/切换会话后，旧 SSE 连接不会收到新会话事件；关闭后由 ensureEvents 重连
  if (!next.session || (previousSessionId && next.session && previousSessionId !== next.session.opencodeSessionId)) {
    connection?.close()
    connection = null
  }
}

async function loadSessions(): Promise<void> {
  sessionsLoading.value = true
  try {
    const next = await listDevSessions(props.appId, 'development')
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

function moduleStorageKey(): string {
  return `${MODULE_STORAGE_PREFIX}${props.appId}`
}

function readSavedModule(): string {
  try {
    return localStorage.getItem(moduleStorageKey()) ?? ''
  } catch {
    return ''
  }
}

function persistModule(key: string): void {
  try {
    if (key) localStorage.setItem(moduleStorageKey(), key)
    else localStorage.removeItem(moduleStorageKey())
  } catch {
    // 隐私模式/存储不可用：仅本次会话生效
  }
}

/** 读取 artifacts（模块 + ui-check 状态）与应用设计系统（只读参考） */
async function loadDesignRef(): Promise<void> {
  const [artifactsResult, designResult] = await Promise.allSettled([
    getArtifacts(props.appId),
    getAppDesignSystem(props.appId)
  ])
  if (designResult.status === 'fulfilled') designSystem.value = designResult.value
  if (artifactsResult.status !== 'fulfilled') return
  const options = buildModuleOptions(artifactsResult.value)
  moduleOptions.value = options
  const next = pickModuleKey(options, readSavedModule(), moduleKey.value)
  moduleKey.value = next
  persistModule(next)
}

function openDesignTemplates(): void {
  designCenterOpen.value = true
}

/** P7-6a：只读一致性检查；报告仅供查看，不自动改代码 */
async function runFidelityCheck(): Promise<void> {
  if (fidelityBusy.value) return
  fidelityBusy.value = true
  fidelityError.value = ''
  try {
    fidelityReport.value = await checkDesignFidelity(props.appId, moduleKey.value || undefined)
  } catch (err) {
    fidelityReport.value = null
    fidelityError.value = err instanceof Error ? err.message : String(err)
  } finally {
    fidelityBusy.value = false
  }
}

async function refresh(silent = true): Promise<void> {
  if (refreshing.value) return
  refreshing.value = true
  if (!silent) error.value = ''
  try {
    const next = await getDevState(props.appId, selectedSessionId.value, 'development')
    applyData(next)
    error.value = ''
    if (next.session && !next.readOnly) ensureEvents()
    else {
      connection?.close()
      connection = null
      connectionState.value = 'closed'
    }
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
    event => {
      const type = String(event.type ?? '')
      const data = (event.data ?? {}) as Record<string, unknown>
      if (type === 'session.text.delta' || type === 'session.text.ended') {
        applyPending({ type: 'content' })
      } else if (type === 'session.execution.failed') {
        const nested = (data.error ?? {}) as Record<string, unknown>
        const message =
          (typeof nested.message === 'string' && nested.message) ||
          (typeof data.message === 'string' && data.message) ||
          ''
        applyPending({ type: 'failed', message })
      } else if (type === 'session.execution.interrupted') {
        applyPending({ type: 'interrupted' })
      } else if (type === 'session.idle' || type === 'session.execution.succeeded') {
        if (pending.value?.phase === 'awaiting') applyPending({ type: 'content' })
      }
      scheduleRefresh()
    },
    value => {
      connectionState.value = value
    },
    'development'
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
  beginPending()
  try {
    const next = await createDevSession(props.appId, { view: 'development', module: moduleKey.value || undefined })
    selectedSessionId.value = next.session?.id ?? null
    applyData(next)
    ensureEvents()
    await promptDevSession(props.appId, prompt, 'development', { module: moduleKey.value || undefined })
    composer.value = ''
    startPrompt.value = next.defaultPrompt
    await Promise.all([refresh(true), loadDesignRef()])
    ElMessage.success('开发会话已开始')
    emit('app-changed')
    await nextTick()
    composerRef.value?.focus()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    error.value = message
    applyPending({ type: 'failed', message })
    ElMessage.error(message)
  } finally {
    actionBusy.value = ''
  }
}

async function newSession(): Promise<void> {
  if (actionBusy.value) return
  try {
    await ElMessageBox.confirm(
      '当前会话会归档，新会话不会自动接续旧上下文；旧会话保留在左侧列表，可随时查看/恢复。',
      '新建开发会话',
      { type: 'warning', confirmButtonText: '新建', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  actionBusy.value = 'start'
  error.value = ''
  applyPending({ type: 'reset' })
  try {
    const next = await createDevSession(props.appId, { new: true, view: 'development', module: moduleKey.value || undefined })
    selectedSessionId.value = next.session?.id ?? null
    applyData(next, false)
    composer.value = next.defaultPrompt
    ensureEvents()
    await Promise.all([refresh(true), loadDesignRef()])
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
  applyPending({ type: 'reset' })
  try {
    connection?.close()
    connection = null
    selectedSessionId.value = item.id
    if (narrow.value) sidebarOpen.value = false
    const next = await getDevState(props.appId, item.id, 'development')
    applyData(next)
    await loadSessions()
    if (!next.readOnly) ensureEvents()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
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
  try {
    await ElMessageBox.confirm('恢复会把当前会话归档，并让该会话成为当前会话。', '恢复为当前会话', {
      type: 'warning',
      confirmButtonText: '恢复',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  actionBusy.value = 'activate'
  try {
    connection?.close()
    connection = null
    const next = await activateDevSession(props.appId, item.id, 'development')
    selectedSessionId.value = item.id
    applyData(next)
    await loadSessions()
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
      view: 'development',
      createdAt: session.value.createdAt,
      updatedAt: session.value.updatedAt,
      lastActiveAt: session.value.lastActiveAt,
      opencodeExists: null,
      active: false
    })
  }
}

async function send(): Promise<void> {
  if (actionBusy.value || readOnly.value || !composer.value.trim()) return
  const text = composer.value.trim()
  actionBusy.value = 'send'
  error.value = ''
  beginPending()
  try {
    await promptDevSession(props.appId, text, 'development', { module: moduleKey.value || undefined })
    composer.value = ''
    ensureEvents()
    await Promise.all([refresh(true), loadDesignRef()])
    await nextTick()
    scrollToBottom(true)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    error.value = message
    applyPending({ type: 'failed', message })
    ElMessage.error(message)
  } finally {
    actionBusy.value = ''
  }
}

async function stop(): Promise<void> {
  if (actionBusy.value || readOnly.value) return
  actionBusy.value = 'stop'
  try {
    await interruptDevSession(props.appId, 'development')
    applyPending({ type: 'interrupted' })
    await refresh(true)
    ElMessage.success('已请求停止')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    actionBusy.value = ''
  }
}

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
    await compactDevSession(props.appId, 'development')
    ElMessage.success('已提交压缩请求，结果见时间线')
    await refresh(true)
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
    await replyDevPermission(props.appId, requestId, decision, message, 'development')
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
    await replyDevForm(props.appId, formId, answer, 'development')
    await refresh(true)
    ElMessage.success('表单已提交')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    actionBusy.value = ''
  }
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

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

watch(assistantCount, next => {
  if (pending.value?.phase === 'awaiting' && next > assistantBaseline) applyPending({ type: 'content' })
})

watch(moduleKey, key => {
  persistModule(key)
  // 模块切换后旧报告不再对应，清空避免误读
  fidelityReport.value = null
  fidelityError.value = ''
})

watch(
  () => state.value?.status,
  status => {
    if (pending.value?.phase !== 'awaiting') return
    if (status === 'failed') applyPending({ type: 'failed' })
    else if (status === 'interrupted') applyPending({ type: 'interrupted' })
    // P7-6c：完成事件可能丢失；GET development 收敛到 succeeded/idle 后清掉“思考中”
    else if (status && status !== 'running') applyPending({ type: 'content' })
  }
)

watch(
  () => props.appId,
  () => {
    connection?.close()
    connection = null
    loading.value = true
    data.value = null
    pending.value = null
    composer.value = ''
    startPrompt.value = ''
    sessions.value = []
    selectedSessionId.value = null
    moduleOptions.value = []
    moduleKey.value = ''
    designSystem.value = null
    designCenterOpen.value = false
    fidelityReport.value = null
    fidelityError.value = ''
    fidelityBusy.value = false
    void refresh(false).then(() => loadDesignRef())
  }
)

onMounted(async () => {
  sidebarOpen.value = window.innerWidth > 1024
  asideOpen.value = window.innerWidth > 1024
  syncPaneLayout()
  window.addEventListener('resize', syncPaneLayout)
  window.addEventListener('keydown', onKeydown)
  await refresh(false)
  await loadDesignRef()
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
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.badge {
  border-radius: 999px;
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  font-size: 10.5px;
  padding: 2px 9px;
}
.dev-title strong {
  font-size: 13px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  font-size: 11px;
  color: var(--rg-text-3);
}
.module-pick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--rg-text-3);
}
.module-pick select {
  max-width: 240px;
  min-height: 26px;
  border: 1px solid var(--rg-border-strong);
  border-radius: 7px;
  padding: 2px 7px;
  background: var(--rg-surface);
  color: var(--rg-text);
  font-size: 11.5px;
}
.ui-check.ok {
  color: var(--rg-ok);
}
.ui-check.warn {
  color: var(--rg-warn);
}
.ui-check.muted {
  color: var(--rg-text-3);
}
.muted.warn {
  color: var(--rg-warn);
}
.readonly-chip {
  font-size: 10.5px;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border-radius: 999px;
  padding: 2px 8px;
}
.dev-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.ctx-chip {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 3px 9px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.ctx-chip.warn {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.ctx-chip.danger {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.conn {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.conn.error {
  color: var(--rg-danger);
}
.run-status {
  font-size: 11px;
  border-radius: 999px;
  padding: 3px 9px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.run-status.running {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.run-status.done {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.dev-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr) 280px;
}
.dev-body.sidebar-collapsed {
  grid-template-columns: 0 minmax(0, 1fr) 280px;
}
.dev-body.aside-collapsed {
  grid-template-columns: 268px minmax(0, 1fr) 0;
}
.dev-body.sidebar-collapsed.aside-collapsed {
  grid-template-columns: 0 minmax(0, 1fr) 0;
}
.dev-sessions,
.dev-side {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--rg-surface-2, #fafbfc);
}
.dev-sessions {
  border-right: 1px solid var(--rg-border, #e4e7ec);
}
.dev-side {
  border-left: 1px solid var(--rg-border, #e4e7ec);
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dev-side h3 {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--rg-text-2);
}
.dev-side dl {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dev-side dl > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
}
.dev-side dt {
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.dev-side dd {
  margin: 0;
  text-align: right;
  color: var(--rg-text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dev-side dd.mono {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 10.5px;
}
.ctx-detail.warn {
  color: var(--rg-warn);
}
.ctx-detail.danger {
  color: var(--rg-danger);
}
.side-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.fidelity-report {
  margin-top: 10px;
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 8px 10px;
  background: var(--rg-surface);
}
.fidelity-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.fidelity-status {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.fidelity-status.ok {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.fidelity-status.warn {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.fidelity-status.fail {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.fidelity-checks {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.fidelity-item {
  border-left: 2px solid var(--rg-border-strong);
  padding: 2px 0 2px 7px;
}
.fidelity-item.pass {
  border-left-color: var(--rg-ok);
}
.fidelity-item.warn {
  border-left-color: var(--rg-warn);
}
.fidelity-item.fail {
  border-left-color: var(--rg-danger);
}
.fidelity-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}
.fidelity-badge {
  font-size: 10px;
  border-radius: 4px;
  padding: 1px 5px;
  background: var(--rg-fill-2);
  color: var(--rg-text-3);
}
.fidelity-badge.ok {
  color: var(--rg-ok);
}
.fidelity-badge.warn {
  color: var(--rg-warn);
}
.fidelity-badge.fail {
  color: var(--rg-danger);
}
.fidelity-item p {
  margin: 2px 0 0;
  font-size: 10.5px;
  line-height: 1.55;
  color: var(--rg-text-3);
  word-break: break-word;
}
.fidelity-item .fidelity-hint {
  color: var(--rg-warn);
}
.muted {
  font-size: 11px;
  color: var(--rg-text-3);
  line-height: 1.7;
  margin: 0;
}
.file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10.5px;
}
.file-list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.file-list code {
  word-break: break-all;
  color: var(--rg-text-2);
}
.timeline {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--rg-bg, #f4f5f7);
}
.center-card {
  margin: 60px auto;
  min-width: 300px;
  max-width: 520px;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  padding: 22px;
  text-align: center;
  font-size: 12.5px;
  color: var(--rg-text-2);
}
.error-card p {
  color: var(--rg-danger);
  white-space: pre-wrap;
  line-height: 1.6;
}
.center-actions,
.start-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 12px;
}
.start-card {
  margin: 26px auto;
  max-width: 640px;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  padding: 18px;
  font-size: 12.5px;
  color: var(--rg-text-2);
}
.start-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.start-head h2 {
  margin: 0;
  font-size: 15px;
  color: var(--rg-text);
}
.start-head .hint {
  font-size: 11px;
  color: var(--rg-text-3);
}
.start-card p {
  line-height: 1.7;
}
.start-card .warn {
  color: var(--rg-warn);
}
.start-card textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 9px 11px;
  font-size: 12.5px;
  line-height: 1.6;
  resize: vertical;
  background: var(--rg-surface);
  color: var(--rg-text);
}
.timeline-main {
  flex: 1;
  min-height: 0;
  position: relative;
}
.timeline-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 14px clamp(12px, 3vw, 26px);
}
.timeline-content {
  max-width: 900px;
  margin: 0 auto;
}
.readonly-banner,
.context-banner,
.error-banner {
  border-radius: 9px;
  padding: 8px 12px;
  font-size: 11.5px;
  line-height: 1.7;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.readonly-banner {
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.context-banner {
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.context-banner.warn {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.context-banner.danger {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.error-banner {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.user-message,
.assistant-message {
  margin: 0 0 12px;
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--rg-surface);
}
.user-message {
  background: var(--rg-surface-2);
}
.user-message pre,
.assistant-message pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--rg-text);
}
.timeline-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 9px;
  padding: 7px 11px;
  margin-bottom: 10px;
}
.timeline-notice.failed {
  color: var(--rg-danger);
}
.notice-time {
  margin-left: auto;
  color: var(--rg-text-3);
  font-size: 10.5px;
}
.pending-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}
.working-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  padding: 6px 2px;
}
.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--rg-border-strong);
  border-top-color: var(--rg-ai);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.empty-timeline {
  font-size: 12px;
  color: var(--rg-text-3);
  text-align: center;
  padding: 28px 0;
}
.back-latest {
  position: absolute;
  right: 18px;
  bottom: 16px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 11px;
  cursor: pointer;
  box-shadow: var(--rg-shadow-1);
}
.readonly-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 16px;
  border-top: 1px solid var(--rg-border);
  background: var(--rg-surface);
  font-size: 11.5px;
  color: var(--rg-text-2);
}
.pane-toggle {
  width: 28px;
  height: 28px;
  border: 1px solid var(--rg-border);
  border-radius: 7px;
  background: var(--rg-surface);
  color: var(--rg-text-2);
  cursor: pointer;
}
.pane-toggle.active {
  border-color: var(--rg-border-strong);
  color: var(--rg-text);
}
.dev-mask {
  display: none;
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
  padding: 5px 11px;
  font-size: 12px;
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
.btn.small {
  min-height: 26px;
  padding: 3px 9px;
  font-size: 11px;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.compact-btn.warn {
  border-color: var(--rg-warn-border);
  color: var(--rg-warn);
}
.compact-btn.danger,
.compact-btn.highlight {
  border-color: var(--rg-danger-border);
  color: var(--rg-danger);
}
code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  background: var(--rg-fill-2);
  border-radius: 4px;
  padding: 1px 5px;
}
@media (max-width: 1024px) {
  .dev-body,
  .dev-body.sidebar-collapsed,
  .dev-body.aside-collapsed,
  .dev-body.sidebar-collapsed.aside-collapsed {
    grid-template-columns: minmax(0, 1fr);
    position: relative;
  }
  .dev-sessions,
  .dev-side {
    position: absolute;
    top: 0;
    bottom: 0;
    width: min(320px, 86vw);
    z-index: 20;
    box-shadow: var(--rg-shadow-2);
    transition: transform 0.18s ease;
  }
  .dev-sessions {
    left: 0;
    transform: translateX(-105%);
  }
  .dev-side {
    right: 0;
    transform: translateX(105%);
  }
  .dev-body:not(.sidebar-collapsed) .dev-sessions {
    transform: translateX(0);
  }
  .dev-body:not(.aside-collapsed) .dev-side {
    transform: translateX(0);
  }
  .dev-mask {
    display: block;
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.32);
    z-index: 15;
  }
}
</style>
