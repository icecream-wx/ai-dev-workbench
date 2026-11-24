<template>
  <section class="chat-panel rg-panel rg-panel--flush" data-testid="chat-panel">
    <header class="chat-head">
      <div class="head-row">
        <strong>AI 对话</strong>
        <RgChip :tone="statusTone" size="sm" class="run-status" data-testid="chat-status">{{ statusLabel }}</RgChip>
      </div>
      <div class="head-controls">
        <select
          class="history-select"
          data-testid="chat-history-select"
          :value="activeSessionId ?? ''"
          :disabled="actionBusy !== '' || !sessionOptions.length"
          @change="onHistoryChange"
        >
          <option v-if="!sessionOptions.length" value="">暂无会话</option>
          <option v-for="item in sessionOptions" :key="item.id" :value="item.id">
            {{ item.label }}{{ item.status === 'active' ? '（当前）' : item.status === 'archived' ? '（归档）' : '' }}
          </option>
        </select>
        <RgChip
          v-if="session"
          :tone="contextTone"
          class="ctx-chip"
          :title="contextInfo.title"
          data-testid="context-chip"
        >
          {{ contextInfo.label }}
        </RgChip>
        <RgButton
          v-if="session"
          size="sm"
          :variant="contextInfo.needsCompact ? 'danger' : 'secondary'"
          :disabled="actionBusy !== ''"
          :loading="actionBusy === 'compact'"
          data-testid="compact-btn"
          @click="compactContext"
        >
          {{ actionBusy === 'compact' ? '压缩中…' : '压缩' }}
        </RgButton>
        <RgButton
          size="sm"
          :disabled="actionBusy !== ''"
          data-testid="chat-new-session-btn"
          @click="newSession()"
        >
          新会话
        </RgButton>
      </div>
    </header>

    <div v-if="errorText" class="error-strip" data-testid="chat-error-strip" role="alert">
      <span class="error-text" :title="errorText">{{ errorText }}</span>
      <div class="error-actions">
        <RgButton variant="ghost" size="sm" data-testid="chat-error-retry" :disabled="loading" @click="retrySession">
          重试
        </RgButton>
        <RgButton variant="ghost" size="sm" @click="errorText = ''">关闭</RgButton>
      </div>
    </div>

    <div
      v-if="session && needsContextBanner(contextInfo.level)"
      class="danger-banner"
      data-testid="context-danger-banner"
    >
      <span>{{ contextInfo.hint || '当前会话上下文接近上限' }}</span>
      <div class="banner-actions">
        <RgButton size="sm" data-testid="compact-continue-btn" :disabled="actionBusy !== ''" @click="compactContext">
          压缩后继续
        </RgButton>
        <RgButton
          size="sm"
          data-testid="new-session-continue-btn"
          :disabled="actionBusy !== ''"
          @click="newSession(continuationComposerText)"
        >
          开新会话继续
        </RgButton>
      </div>
    </div>

    <div ref="scroller" class="chat-scroll" data-testid="chat-timeline" @scroll="onScroll">
      <div class="chat-content">
        <StatePanel
          v-if="loading"
          class="chat-loading"
          variant="loading"
          test-id="chat-loading"
          skeleton="timeline"
          :loading-lines="3"
          title="正在加载会话"
          description="读取会话与最近消息…"
          compact
        />
        <StatePanel
          v-else-if="showEmptyState"
          class="chat-empty"
          variant="empty"
          test-id="chat-empty"
          :icon="ChatDotRound"
          :title="emptyTitleText"
          compact
        >
          <template #default>{{ emptyHintText }}</template>
          <template #meta>
            <span
              v-for="pill in emptyPills"
              :key="pill.key"
              class="pill"
              :data-testid="`chat-context-${pill.key}`"
              :title="pill.title"
            >
              {{ pill.label }}
            </span>
          </template>
          <template #examples>
            <ul v-if="!readOnly" class="chat-examples">
              <li v-for="(example, index) in emptyExamples" :key="example">
                <button
                  type="button"
                  class="example-btn"
                  :data-testid="`chat-example-${index + 1}`"
                  @click="useExample(example)"
                >
                  <span class="example-text">{{ example }}</span>
                  <span class="example-arrow" aria-hidden="true">→</span>
                </button>
              </li>
            </ul>
          </template>
          <template #actions>
            <RgButton
              v-if="!session"
              variant="primary"
              size="sm"
              data-testid="chat-empty-cta"
              :disabled="actionBusy !== ''"
              @click="newSession()"
            >
              {{ emptyCopy.cta }}
            </RgButton>
            <RgButton
              v-else-if="!readOnly"
              size="sm"
              data-testid="chat-empty-cta"
              @click="focusComposer"
            >
              {{ emptyCopy.cta }}
            </RgButton>
          </template>
        </StatePanel>
        <template v-for="entry in entries" :key="entry.key">
          <div v-if="entry.kind === 'user'" class="msg user">
            <pre>{{ entry.message?.text }}</pre>
          </div>
          <div v-else-if="entry.kind === 'assistant'" class="msg assistant">
            <details
              v-if="showReasoning(entry.message)"
              class="rg-reasoning"
              data-testid="chat-reasoning"
            >
              <summary>思考</summary>
              <pre>{{ entry.message?.reasoning }}</pre>
            </details>
            <MarkdownView v-if="entry.message?.text" :markdown="entry.message.text" />
          </div>
          <div v-else-if="entry.kind === 'notice'" class="notice">
            <span>⇄</span>
            <span>{{ entry.message?.text }}</span>
          </div>
          <StepCard v-else-if="entry.kind === 'step'" :step="entry.step!" />
        </template>

        <div v-if="pending" :class="['rg-pending', pending.phase]" :data-testid="pendingId">
          <span v-if="pending.phase === 'awaiting'" class="rg-pending-spinner" />
          <span>{{ pendingText }}</span>
        </div>

        <div v-if="pendingPermissions.length || pendingForms.length" class="pending">
          <PermissionCard
            v-for="permission in pendingPermissions"
            :key="permission.id"
            :permission="permission"
            :busy="actionBusy !== ''"
            @reply="(decision, message) => replyPermission(permission.id, decision, message)"
          />
          <FormCard
            v-for="form in pendingForms"
            :key="form.id"
            :form="form"
            :busy="actionBusy !== ''"
            @submit="answer => replyForm(form.id, answer)"
          />
        </div>

        <div v-if="running && !pending" class="working">
          <span class="spinner" />
          {{ toolLine || 'Agent 正在执行' }}
        </div>
      </div>
    </div>

    <div v-if="session && readOnly" class="readonly-bar">
      <span>该会话{{ sessionStatusLabel(session.status) }}，只读查看；切到当前会话后可继续发送。</span>
      <RgButton variant="primary" size="sm" :disabled="actionBusy !== ''" @click="restoreActive">切换为当前会话</RgButton>
    </div>

    <div v-else class="composer-wrap" data-testid="chat-composer">
      <div v-if="sectionFocus" class="section-focus" data-testid="chat-section-focus">
        <span class="section-focus-label">定位章节：{{ sectionFocus.title || '本章节' }}</span>
        <button
          type="button"
          class="section-focus-clear"
          data-testid="chat-section-focus-clear"
          aria-label="移除定位章节"
          title="移除定位章节"
          @click="clearSectionFocus"
        >
          ×
        </button>
      </div>
      <div v-if="showCommandsRow" class="commands">
        <RgButton
          v-for="item in viewCommands"
          :key="item.name"
          size="sm"
          :disabled="commandDisabled"
          :data-testid="`chat-command-${item.testId}`"
          @click="sendCommand(item.name)"
        >
          {{ item.label }}
        </RgButton>
        <span class="hint">{{ commandHint }}</span>
      </div>
      <Composer
        ref="composerRef"
        v-model="composer"
        :disabled="actionBusy !== ''"
        :busy="running"
        :placeholder="composerPlaceholderText"
        @send="send"
        @stop="stop"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatDotRound } from '@element-plus/icons-vue'
import Composer from '../dev/Composer.vue'
import FormCard from '../dev/FormCard.vue'
import PermissionCard from '../dev/PermissionCard.vue'
import StepCard from '../dev/StepCard.vue'
import MarkdownView from '../shared/MarkdownView.vue'
import StatePanel from '../shared/StatePanel.vue'
import RgButton from '../shared/RgButton.vue'
import RgChip from '../shared/RgChip.vue'
import '../shared/reasoning.css'
import {
  devApi,
  type ChatPanelApi,
  type DevEventConnection
} from '../dev/api'
import { contextHint, contextLabel, contextNeedsCompact, contextTitle } from '../dev/dev-health.js'
import { sessionStatusLabel } from '../dev/session-labels.js'
import { commandArgs, commandsForView } from '../dev/view-commands.js'
import {
  composerPlaceholderFor,
  contextPillsFor,
  emptyCopyFor,
  emptyExamplesFor,
  emptyHintFor
} from './chat-empty.js'
import { nextPending, pendingLabel, pendingTestId, runningToolLine, shouldShowReasoning } from './chat-status.js'
import { continuationText, needsContextBanner, recentSessions } from './requirements-helpers.js'
import type {
  DevSessionListItem,
  DevSessionMessage,
  DevSessionState,
  DevStateResponse,
  DevStep,
  FormInfo,
  FormValue,
  PermissionRequest,
  RequirementSectionFocus,
  SessionView
} from '../dev/types'

/** 面板命令按钮（与 view-commands.js 的项同形；工作室传空数组） */
export interface ChatPanelCommand {
  name: string
  label: string
  args: 'module' | 'none'
  testId: string
}

const props = defineProps<{
  appId: string
  view: SessionView
  /** 会话 API 适配器；默认应用三视图 `dev/api.ts`（工作室传 studio 适配器） */
  api?: ChatPanelApi
  /** 命令按钮；默认按视图取 `commandsForView(view)`（工作室传 [] 隐藏命令行） */
  commands?: ChatPanelCommand[]
  /** 空对话说明（默认按视图，见 `chat-empty.js#emptyHintFor`） */
  emptyHint?: string
  /** 空态标题（默认：无会话「开始与 AI 协作」/ 有会话「发送第一条消息」） */
  emptyTitle?: string
  /** 空态示例 prompts（默认按视图 3 条；点击只填入输入框，不发送） */
  emptyExamples?: string[]
  /** 输入框占位（默认按视图） */
  composerPlaceholder?: string
  /** 工作室 packId（`view=template` 时空态上下文 pill 显示） */
  packId?: string
}>()
const emit = defineEmits<{ 'session-changed': []; 'busy-changed': [boolean] }>()

const chatApi = computed(() => props.api ?? devApi)

type ConnectionState = 'connecting' | 'open' | 'error' | 'closed'

interface TimelineEntry {
  key: string
  kind: 'user' | 'assistant' | 'step' | 'notice'
  message?: DevSessionMessage
  step?: DevStep
}

const loading = ref(true)
const errorText = ref('')
const data = ref<DevStateResponse | null>(null)
const sessions = ref<DevSessionListItem[]>([])
const composer = ref('')
const actionBusy = ref<'' | 'send' | 'stop' | 'compact' | 'switch' | 'permission' | 'form' | 'session' | 'command'>('')
const connectionState = ref<ConnectionState>('closed')
const composerRef = ref<InstanceType<typeof Composer> | null>(null)
const scroller = ref<HTMLElement | null>(null)
/** 需求文档章节「问 AI」的定位上下文（同一会话内保留，用户移除或切换/新建会话后清空） */
const sectionFocus = ref<RequirementSectionFocus | null>(null)
/** P6-1：发送后的本地占位（awaiting / failed / interrupted） */
const pending = ref<ReturnType<typeof nextPending>>(null)
/** 发送时的 assistant 消息基线：用于“首个 assistant 消息到达即替换占位” */
let assistantBaseline = 0

let connection: DevEventConnection | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let stick = true

const session = computed(() => data.value?.session ?? null)
const state = computed<DevSessionState | null>(() => data.value?.state ?? null)
const readOnly = computed(() => data.value?.readOnly ?? false)
const running = computed(() => state.value?.status === 'running')
const pendingPermissions = computed(() => (state.value?.pending.permissions ?? []) as unknown as PermissionRequest[])
const pendingForms = computed(() => (state.value?.pending.forms ?? []) as unknown as FormInfo[])
const activeSessionId = computed(() => session.value?.id ?? null)
const sessionOptions = computed(() => recentSessions(sessions.value, 5))
const continuationComposerText = computed(() => continuationText())

const contextInfo = computed(() => {
  const context = state.value?.context ?? null
  return {
    label: contextLabel(context),
    title: contextTitle(context),
    hint: contextHint(context),
    level: context?.level ?? 'unknown',
    needsCompact: contextNeedsCompact(context)
  }
})
/** 上下文 chip tone：与健康度对齐（ok 绿 / warn 橙 / danger 红） */
const contextTone = computed<'ok' | 'warn' | 'danger' | 'neutral'>(() => {
  const level = contextInfo.value.level
  if (level === 'warn') return 'warn'
  if (level === 'danger') return 'danger'
  if (level === 'ok') return 'ok'
  return 'neutral'
})

const statusLabel = computed(() => {
  if (readOnly.value) return `只读 · ${sessionStatusLabel(session.value?.status ?? '')}`
  if (!session.value) return '未开始'
  if (running.value) return '运行中'
  const status = state.value?.status
  if (status === 'succeeded') return '本轮完成'
  if (status === 'failed') return '执行失败'
  if (status === 'interrupted') return '已停止'
  if (status === 'idle') return '空闲'
  return status || '空闲'
})
/** 会话状态 chip tone：运行中=AI 紫 / 完成=绿 / 其他=中性 */
const statusTone = computed<'ai' | 'ok' | 'neutral'>(() => {
  if (running.value) return 'ai'
  if (state.value?.status === 'succeeded') return 'ok'
  return 'neutral'
})
const commandDisabled = computed(() => actionBusy.value !== '' || running.value || readOnly.value)
const viewCommands = computed<ChatPanelCommand[]>(() => props.commands ?? commandsForView(props.view))
/** 工作室传 commands=[] 时隐藏整行（应用三视图保持原样，含 development 的提示行） */
const showCommandsRow = computed(() => viewCommands.value.length > 0 || props.commands === undefined)
const commandHint = computed(() => (running.value ? '生成中，命令暂不可用' : '命令会作用于当前应用上下文'))
const emptyHintText = computed(() => props.emptyHint ?? emptyHintFor(props.view))
const emptyExamples = computed(() => props.emptyExamples ?? emptyExamplesFor(props.view))
const emptyCopy = computed(() => emptyCopyFor({ hasSession: Boolean(session.value) }))
const emptyTitleText = computed(() => props.emptyTitle ?? emptyCopy.value.title)
const emptyPills = computed(() =>
  contextPillsFor({ view: props.view, packId: props.packId })
)
const showEmptyState = computed(
  () => !entries.value.length && !pending.value && !pendingPermissions.value.length && !pendingForms.value.length
)
const composerPlaceholderText = computed(() => props.composerPlaceholder ?? composerPlaceholderFor(props.view))
const pendingId = computed(() => pendingTestId(pending.value, 'chat'))
const pendingText = computed(() => pendingLabel(pending.value))
const toolLine = computed(() => (state.value?.status === 'running' ? runningToolLine(state.value?.steps) : ''))
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
      if ((message.text ?? '').trim()) out.push({ key: `assistant-${message.id}`, kind: 'assistant', message })
      for (const step of stepStarts.value.get(message.id) ?? []) {
        out.push({ key: step.id, kind: 'step', step })
        consumed.add(step.id)
      }
    } else if (message.type === 'compaction' || message.kind === 'compaction') {
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

function applyData(next: DevStateResponse): void {
  const previous = data.value?.session?.opencodeSessionId
  data.value = next
  if (!next.session || (previous && next.session && previous !== next.session.opencodeSessionId)) {
    connection?.close()
    connection = null
  }
}

async function loadState(silent = true): Promise<void> {
  try {
    const next = await chatApi.value.getState(props.appId, null, props.view)
    applyData(next)
    if (!silent) errorText.value = ''
    if (next.session && !next.readOnly) ensureEvents()
    else {
      connection?.close()
      connection = null
      connectionState.value = 'closed'
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
    void loadSessions()
  }
}

async function loadSessions(): Promise<void> {
  try {
    const next = await chatApi.value.listSessions(props.appId, props.view)
    sessions.value = next.sessions
  } catch {
    // 列表失败不覆盖主错误
  }
}

function ensureEvents(): void {
  if (connection || !session.value?.opencodeSessionId) return
  connection = chatApi.value.connectEvents(
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
      const immediate =
        type === 'session.idle' ||
        type.startsWith('session.execution.') ||
        type === 'permission.asked' ||
        type === 'permission.replied' ||
        type.startsWith('form.')
      scheduleRefresh(immediate ? 50 : 400)
    },
    value => {
      connectionState.value = value
      if (value === 'error') errorText.value = '实时事件连接断开；可点刷新重连'
    },
    props.view
  )
}

function scheduleRefresh(delayMs: number): void {
  if (delayMs <= 60) {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
    void loadState(true)
    return
  }
  // 节流（不是重置防抖）：400ms 窗口内只刷新一次，流式文本仍能逐段出现
  if (refreshTimer) return
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void loadState(true)
  }, delayMs)
}

async function ensureSession(): Promise<void> {
  if (session.value && !readOnly.value) return
  actionBusy.value = 'session'
  try {
    await chatApi.value.create(props.appId, { view: props.view })
    await loadState(false)
    emit('session-changed')
  } finally {
    actionBusy.value = ''
  }
}

async function send(): Promise<boolean> {
  const text = composer.value.trim()
  if (!text || actionBusy.value || running.value || readOnly.value) return false
  actionBusy.value = 'send'
  errorText.value = ''
  beginPending()
  try {
    await ensureSession()
    await chatApi.value.prompt(props.appId, text, props.view, {
      ...(sectionFocus.value ? { focus: sectionFocus.value } : {})
    })
    composer.value = ''
    scheduleRefresh(120)
    await nextTick()
    scrollToBottom(true)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errorText.value = message
    applyPending({ type: 'failed', message })
    return false
  } finally {
    actionBusy.value = ''
  }
}

/**
 * 外部视图按钮（如接口设计「让 AI 修」）一键填入并发送（B7）。
 * 进程内检查与 `send` 一致；被阻止（空文本/忙/只读）返回 false。
 */
async function sendComposer(text?: string): Promise<boolean> {
  if (text !== undefined) composer.value = text
  if (!composer.value.trim() || actionBusy.value || running.value || readOnly.value) return false
  return send()
}

async function sendCommand(name: string): Promise<boolean> {
  const command = viewCommands.value.find(item => item.name === name) ?? null
  if (!command || commandDisabled.value) return false
  actionBusy.value = 'command'
  errorText.value = ''
  beginPending()
  try {
    await ensureSession()
    const args = commandArgs(command)
    await chatApi.value.prompt(props.appId, args, props.view, { command: name })
    ElMessage.success(`已发送 /${name}`)
    scheduleRefresh(150)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errorText.value = message
    applyPending({ type: 'failed', message })
    return false
  } finally {
    actionBusy.value = ''
  }
}

async function stop(): Promise<void> {
  if (actionBusy.value || readOnly.value) return
  actionBusy.value = 'stop'
  try {
    await chatApi.value.interrupt(props.appId, props.view)
    applyPending({ type: 'interrupted' })
    scheduleRefresh(120)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    actionBusy.value = ''
  }
}

async function compactContext(): Promise<void> {
  if (actionBusy.value || readOnly.value) return
  actionBusy.value = 'compact'
  try {
    await chatApi.value.compact(props.appId, props.view)
    ElMessage.success('已提交压缩请求，结果见时间线')
    await loadState(true)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    actionBusy.value = ''
  }
}

async function newSession(fillText = ''): Promise<void> {
  if (actionBusy.value) return
  actionBusy.value = 'session'
  applyPending({ type: 'reset' })
  try {
    await chatApi.value.create(props.appId, { view: props.view, new: true })
    await loadState(false)
    await loadSessions()
    sectionFocus.value = null
    emit('session-changed')
    if (fillText) {
      composer.value = fillText
      await nextTick()
      composerRef.value?.focus()
    }
    ElMessage.success(fillText ? '已新建会话；衔接文案已填入输入框（未发送）' : '已新建会话')
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    actionBusy.value = ''
  }
}

async function onHistoryChange(event: Event): Promise<void> {
  const id = (event.target as HTMLSelectElement).value
  if (!id || id === activeSessionId.value || actionBusy.value) return
  actionBusy.value = 'switch'
  applyPending({ type: 'reset' })
  try {
    await chatApi.value.activate(props.appId, id, props.view)
    await loadState(false)
    sectionFocus.value = null
    emit('session-changed')
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
    await loadSessions()
  } finally {
    actionBusy.value = ''
  }
}

async function restoreActive(): Promise<void> {
  const target = sessions.value.find(item => item.status === 'active') ?? sessions.value[0]
  if (!target) return
  actionBusy.value = 'switch'
  try {
    await chatApi.value.activate(props.appId, target.id, props.view)
    await loadState(false)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    actionBusy.value = ''
  }
}

async function replyPermission(requestId: string, decision: 'once' | 'always' | 'reject', message?: string): Promise<void> {
  if (actionBusy.value) return
  actionBusy.value = 'permission'
  try {
    await chatApi.value.replyPermission(props.appId, requestId, decision, message, props.view)
    scheduleRefresh(120)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    actionBusy.value = ''
  }
}

async function replyForm(formId: string, answer: Record<string, FormValue>): Promise<void> {
  if (actionBusy.value) return
  actionBusy.value = 'form'
  try {
    await chatApi.value.replyForm(props.appId, formId, answer, props.view)
    ElMessage.success('表单已提交')
    scheduleRefresh(120)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    actionBusy.value = ''
  }
}

function onScroll(): void {
  const element = scroller.value
  if (!element) return
  stick = element.scrollHeight - element.scrollTop - element.clientHeight < 80
}

async function scrollToBottom(force = false): Promise<void> {
  if (!force && !stick) return
  await nextTick()
  const element = scroller.value
  if (!element) return
  element.scrollTop = element.scrollHeight
}

function setComposer(text: string): void {
  composer.value = text
  void nextTick().then(() => composerRef.value?.focus())
}

/** 章节定位上下文：需求视图「问 AI」时由父视图设置（null 清空） */
function setSectionFocus(focus: RequirementSectionFocus | null): void {
  sectionFocus.value = focus ? { ...focus } : null
}

function clearSectionFocus(): void {
  sectionFocus.value = null
}

function focusComposer(): void {
  composerRef.value?.focus()
}

/** 空态示例：只填入输入框并聚焦，**不自动发送** */
function useExample(text: string): void {
  if (readOnly.value) return
  setComposer(text)
}

/** 错误条重试：重新拉取会话状态/最近消息（不新增接口） */
async function retrySession(): Promise<void> {
  await loadState(false)
  await loadSessions()
}

/** 供空态/工具栏按钮调用（返回是否成功发出） */
function runCommand(name: string): Promise<boolean> {
  return sendCommand(name)
}

defineExpose({ setComposer, focusComposer, runCommand, sendComposer, setSectionFocus })

watch(
  () => [state.value?.messages.length, state.value?.steps.length, state.value?.status],
  async () => {
    await nextTick()
    if (stick) await scrollToBottom(true)
  }
)

watch(
  [running, actionBusy],
  ([isRunning, busy]) => emit('busy-changed', Boolean(isRunning) || busy !== ''),
  { immediate: true }
)

// P6-1：首个 assistant 消息到达 → 替换本地占位
watch(assistantCount, next => {
  if (pending.value?.phase === 'awaiting' && next > assistantBaseline) applyPending({ type: 'content' })
})

// P6-1：状态进入 failed/interrupted 时占位必须被替换（不能停留在“思考中”）
watch(
  () => state.value?.status,
  status => {
    if (pending.value?.phase !== 'awaiting') return
    if (status === 'failed') applyPending({ type: 'failed' })
    else if (status === 'interrupted') applyPending({ type: 'interrupted' })
  }
)

watch(
  () => [props.appId, props.view],
  () => {
    connection?.close()
    connection = null
    loading.value = true
    data.value = null
    sessions.value = []
    composer.value = ''
    sectionFocus.value = null
    void loadState(false)
  }
)

onMounted(() => void loadState(false))

onUnmounted(() => {
  connection?.close()
  connection = null
  if (refreshTimer) clearTimeout(refreshTimer)
})
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: var(--rg-surface);
  border-left: 1px solid var(--rg-border);
}
.chat-head {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--rg-border);
}
.head-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.head-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
.head-row strong {
  font-size: 13.5px;
  font-weight: 600;
}
.history-select {
  flex: 1 1 120px;
  min-width: 0;
  height: 28px;
  border: 1px solid var(--rg-border);
  border-radius: 7px;
  background: var(--rg-surface);
  color: var(--rg-text);
  font-size: 12px;
  padding: 0 6px;
}
.run-status {
  margin-left: auto;
  flex-shrink: 0;
}
.ctx-chip {
  flex-shrink: 0;
}
.error-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 14px;
  font-size: 11.5px;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border-bottom: 1px solid var(--rg-danger-border);
}
.error-text {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: var(--rg-leading-caption);
}
.error-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
}
.danger-banner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 14px;
  font-size: 12px;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border-bottom: 1px solid var(--rg-danger-border);
}
.banner-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
}
.chat-content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
/* 空态/加载：顶部对齐（距头部约 28px：滚动区 12px + 这里 16px），不在长面板里垂直居中 */
.chat-empty,
.chat-loading {
  margin-top: 16px;
}
.chat-empty :deep(.sp-examples),
.chat-empty :deep(.sp-actions) {
  max-width: 100%;
}
.chat-empty :deep(.sp-title) {
  font-size: 14px;
}
.chat-examples {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.example-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: var(--rg-radius);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  padding: 6px 9px;
  font-size: 12px;
  line-height: var(--rg-leading-body);
  text-align: left;
  cursor: pointer;
}
.example-btn:hover,
.example-btn:focus-visible {
  border-color: var(--rg-border-strong);
  color: var(--rg-text);
  background: var(--rg-hover);
}
.example-btn:focus-visible {
  outline: 2px solid var(--rg-focus-ring);
  outline-offset: 1px;
}
.example-text {
  flex: 1;
  min-width: 0;
}
.example-arrow {
  flex-shrink: 0;
  color: var(--rg-text-3);
  font-size: 12px;
}
.example-btn:hover .example-arrow,
.example-btn:focus-visible .example-arrow {
  color: var(--rg-ai);
}
.pill {
  font-size: 11.5px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  color: var(--rg-text-2);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.msg {
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 9px 12px;
  background: var(--rg-surface-2);
  min-width: 0;
}
.msg.user {
  align-self: flex-end;
  max-width: 92%;
  background: var(--rg-ai-soft);
  border-color: var(--rg-ai-border);
}
.msg.user pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.65;
}
.notice {
  display: flex;
  gap: 6px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 8px;
  padding: 6px 10px;
}
.pending {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.working {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--rg-text-2);
}
.spinner {
  width: 11px;
  height: 11px;
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
.composer-wrap {
  flex-shrink: 0;
  border-top: 1px solid var(--rg-border);
  background: var(--rg-surface);
}
.commands {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 9px 14px 0;
}
.section-focus {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 9px 14px 0;
  padding: 4px 6px 4px 10px;
  border: 1px solid var(--rg-ai-border);
  background: var(--rg-ai-soft);
  border-radius: 999px;
  max-width: calc(100% - 28px);
  width: fit-content;
}
.section-focus-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
  color: var(--rg-ai);
}
.section-focus-clear {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--rg-ai);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.section-focus-clear:hover,
.section-focus-clear:focus-visible {
  background: var(--rg-surface);
}
.hint {
  font-size: 11px;
  color: var(--rg-text-3);
}
.readonly-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-top: 1px solid var(--rg-border);
  font-size: 12px;
  color: var(--rg-text-2);
}
@media (max-width: 1024px) {
  .chat-panel {
    border-left: none;
  }
}
</style>
