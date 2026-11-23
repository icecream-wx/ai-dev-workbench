<template>
  <section class="chat-panel" data-testid="chat-panel">
    <header class="chat-head">
      <div class="head-row">
        <strong>AI 对话</strong>
        <span :class="['run-status', statusClass]" data-testid="chat-status">{{ statusLabel }}</span>
      </div>
      <div class="head-row">
        <span
          v-if="session"
          :class="['ctx-chip', contextInfo.level]"
          :title="contextInfo.title"
          data-testid="context-chip"
        >
          {{ contextInfo.label }}
        </span>
        <button
          v-if="session"
          type="button"
          :class="['btn', 'small', { highlight: contextInfo.needsCompact }]"
          :disabled="actionBusy !== ''"
          data-testid="compact-btn"
          @click="compactContext"
        >
          {{ actionBusy === 'compact' ? '压缩中…' : '压缩' }}
        </button>
      </div>
      <div class="head-row history-row">
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
        <button
          type="button"
          class="btn small"
          :disabled="actionBusy !== ''"
          data-testid="chat-new-session-btn"
          @click="newSession()"
        >
          新会话
        </button>
      </div>
    </header>

    <div v-if="errorText" class="error-strip" data-testid="chat-error-strip">
      <span>{{ errorText }}</span>
      <button type="button" class="link" @click="errorText = ''">关闭</button>
    </div>

    <div
      v-if="session && needsContextBanner(contextInfo.level)"
      class="danger-banner"
      data-testid="context-danger-banner"
    >
      <span>{{ contextInfo.hint || '当前会话上下文接近上限' }}</span>
      <div class="banner-actions">
        <button type="button" class="btn small" data-testid="compact-continue-btn" :disabled="actionBusy !== ''" @click="compactContext">
          压缩后继续
        </button>
        <button
          type="button"
          class="btn small"
          data-testid="new-session-continue-btn"
          :disabled="actionBusy !== ''"
          @click="newSession(continuationComposerText)"
        >
          开新会话继续
        </button>
      </div>
    </div>

    <div ref="scroller" class="chat-scroll" data-testid="chat-timeline" @scroll="onScroll">
      <div class="chat-content">
        <div v-if="loading" class="muted">正在加载会话…</div>
        <div v-else-if="!entries.length && !pending && !pendingPermissions.length && !pendingForms.length" class="empty">
          <p>{{ emptyHintText }}</p>
        </div>
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
      <button type="button" class="btn small primary" :disabled="actionBusy !== ''" @click="restoreActive">切换为当前会话</button>
    </div>

    <div v-else class="composer-wrap" data-testid="chat-composer">
      <div v-if="showCommandsRow" class="commands">
        <button
          v-for="item in viewCommands"
          :key="item.name"
          type="button"
          class="btn small"
          :disabled="commandDisabled"
          :data-testid="`chat-command-${item.testId}`"
          @click="sendCommand(item.name)"
        >
          {{ item.label }}
        </button>
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
import Composer from '../dev/Composer.vue'
import FormCard from '../dev/FormCard.vue'
import PermissionCard from '../dev/PermissionCard.vue'
import StepCard from '../dev/StepCard.vue'
import MarkdownView from '../shared/MarkdownView.vue'
import '../shared/reasoning.css'
import {
  devApi,
  type ChatPanelApi,
  type DevEventConnection
} from '../dev/api'
import { contextHint, contextLabel, contextNeedsCompact, contextTitle } from '../dev/dev-health.js'
import { sessionStatusLabel } from '../dev/session-labels.js'
import { commandArgs, commandsForView } from '../dev/view-commands.js'
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
  moduleKey?: string | null
  /** 会话 API 适配器；默认应用三视图 `dev/api.ts`（工作室传 studio 适配器） */
  api?: ChatPanelApi
  /** 命令按钮；默认按视图取 `commandsForView(view)`（工作室传 [] 隐藏命令行） */
  commands?: ChatPanelCommand[]
  /** 空对话提示（默认需求视图文案） */
  emptyHint?: string
  /** 输入框占位（默认需求视图文案） */
  composerPlaceholder?: string
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
const continuationComposerText = computed(() => continuationText(props.moduleKey))

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
const statusClass = computed(() => ({ running: running.value, done: state.value?.status === 'succeeded', idle: Boolean(session.value) && !running.value }))
const commandDisabled = computed(() => actionBusy.value !== '' || running.value || readOnly.value)
const viewCommands = computed<ChatPanelCommand[]>(() => props.commands ?? commandsForView(props.view))
/** 工作室传 commands=[] 时隐藏整行（应用三视图保持原样，含 development 的提示行） */
const showCommandsRow = computed(() => viewCommands.value.length > 0 || props.commands === undefined)
const commandHint = computed(() => (running.value ? '生成中，命令暂不可用' : '命令会带上当前模块'))
const emptyHintText = computed(() => props.emptyHint ?? '需求对话：说明目标、要补的章节或要改的模块。')
const composerPlaceholderText = computed(
  () => props.composerPlaceholder ?? '给需求 agent 发消息…  Enter 发送 · Shift+Enter 换行'
)
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

async function send(): Promise<void> {
  const text = composer.value.trim()
  if (!text || actionBusy.value || running.value || readOnly.value) return
  actionBusy.value = 'send'
  errorText.value = ''
  beginPending()
  try {
    await ensureSession()
    await chatApi.value.prompt(props.appId, text, props.view, { module: props.moduleKey ?? undefined })
    composer.value = ''
    scheduleRefresh(120)
    await nextTick()
    scrollToBottom(true)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    errorText.value = message
    applyPending({ type: 'failed', message })
  } finally {
    actionBusy.value = ''
  }
}

async function sendCommand(name: string): Promise<boolean> {
  const command = viewCommands.value.find(item => item.name === name) ?? null
  if (!command || commandDisabled.value) return false
  actionBusy.value = 'command'
  errorText.value = ''
  beginPending()
  try {
    await ensureSession()
    const args = commandArgs(command, props.moduleKey)
    await chatApi.value.prompt(props.appId, args, props.view, { module: props.moduleKey ?? undefined, command: name })
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

function focusComposer(): void {
  composerRef.value?.focus()
}

/** 供空态/工具栏按钮调用（返回是否成功发出） */
function runCommand(name: string): Promise<boolean> {
  return sendCommand(name)
}

defineExpose({ setComposer, focusComposer, runCommand })

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
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--rg-border);
}
.head-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.head-row strong {
  font-size: 12.5px;
}
.history-row {
  flex-wrap: nowrap;
}
.history-select {
  flex: 1;
  min-width: 0;
  height: 26px;
  border: 1px solid var(--rg-border);
  border-radius: 7px;
  background: var(--rg-surface);
  color: var(--rg-text);
  font-size: 11.5px;
  padding: 0 6px;
}
.run-status {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 2px 8px;
}
.run-status.running {
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
}
.run-status.done {
  color: var(--rg-ok);
  background: var(--rg-ok-soft);
}
.ctx-chip {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
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
.error-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border-bottom: 1px solid var(--rg-danger-border);
}
.danger-banner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px;
  font-size: 11.5px;
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
  padding: 10px 12px;
}
.chat-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.msg {
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 8px 10px;
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
  font-size: 12.5px;
  line-height: 1.65;
}
.notice {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 8px;
  padding: 5px 9px;
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
  font-size: 11px;
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
.empty,
.muted {
  font-size: 11.5px;
  color: var(--rg-text-3);
  line-height: 1.7;
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
  padding: 8px 12px 0;
}
.hint {
  font-size: 10px;
  color: var(--rg-text-3);
}
.readonly-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 9px 12px;
  border-top: 1px solid var(--rg-border);
  font-size: 11.5px;
  color: var(--rg-text-2);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 7px;
  padding: 4px 10px;
  font-size: 11.5px;
  cursor: pointer;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.btn.small {
  min-height: 24px;
  padding: 3px 8px;
  font-size: 11px;
}
.btn.primary {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.btn.highlight {
  border-color: var(--rg-danger-border);
  color: var(--rg-danger);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.link {
  border: none;
  background: transparent;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
  font-size: 11px;
}
@media (max-width: 1024px) {
  .chat-panel {
    border-left: none;
  }
}
</style>
