<template>
  <div class="design-chat">
    <header class="chat-head">
      <span class="chat-badge">AI</span>
      <div class="chat-title">
        <strong>设计助手</strong>
        <span class="chat-sub">{{ readonly ? readonlyText : `实体 + 页面原型 · ${project.template.name} · 设计 v${project.version}` }}</span>
      </div>
    </header>

    <div ref="scrollRef" class="chat-scroll">
      <p v-if="legacyFallback" class="chat-legacy">
        当前模块还没有独立对话历史，正在显示旧的应用级历史（只读回退）；发送新消息后会写入本模块历史。
      </p>
      <section class="activity">
        <div class="activity-title">构建活动</div>
        <ol class="activity-list">
          <li v-for="item in activities" :key="item.key" :class="['activity-item', item.state]">
            <span class="activity-mark">{{ item.state === 'done' ? '✓' : item.state === 'current' ? '●' : '○' }}</span>
            <span>{{ item.label }}</span>
          </li>
        </ol>
      </section>

      <section class="next-steps">
        <div class="next-title">
          接下来做什么
          <span v-if="!nextSteps.length" class="next-empty-hint">（暂无待办）</span>
        </div>
        <button
          v-for="(step, index) in nextSteps"
          :key="`${step.label}-${index}`"
          type="button"
          class="next-item"
          :disabled="streaming || readonly"
          @click="onNextStep(step)"
        >
          <span class="next-label">{{ step.label }}</span>
          <span class="next-prompt">{{ step.prompt }}</span>
        </button>
      </section>

      <div class="chat-divider"><span>对话</span></div>

      <div v-if="!messages.length && !streaming" class="chat-empty">
        <p class="chat-empty-title">让设计助手把需求转成实体和页面原型</p>
        <p class="chat-empty-desc">可以直接说“根据需求生成实体设计”，也可以描述要改的实体/页面；AI 会按当前原型模板生成页面规格。</p>
        <div class="chat-suggest">
          <button v-for="item in suggestions" :key="item" type="button" class="suggest-chip" :disabled="readonly" @click="draft = item">{{ item }}</button>
        </div>
      </div>

      <div v-for="message in messages" :key="message.id" :class="['msg', `msg-${message.role}`]">
        <div v-if="message.focusKind && message.focusId" class="msg-focus">针对《{{ focusLabel(message.focusKind, message.focusId) }}》</div>
        <div class="msg-bubble">{{ message.content }}</div>
        <div v-if="message.role === 'assistant' && message.nextSteps?.length" class="msg-next">
          <span class="msg-next-title">建议下一步：</span>
          <button
            v-for="(step, index) in message.nextSteps"
            :key="index"
            type="button"
            class="msg-next-item"
            :disabled="streaming || readonly"
            @click="onNextStep(step)"
          >
            {{ step.label }}
          </button>
        </div>
        <div v-if="message.role !== 'notice'" class="msg-time">{{ message.time }}</div>
      </div>

      <div v-if="streaming" class="msg msg-assistant">
        <div class="msg-bubble streaming">
          <template v-if="visibleStream">{{ visibleStream }}</template>
          <span v-else class="typing"><i /><i /><i /></span>
        </div>
        <div class="msg-time">{{ visibleStream ? '生成中' : '思考中' }} · {{ elapsedText }}</div>
      </div>
    </div>

    <footer class="chat-composer-wrap">
      <div v-if="focus" class="focus-chip">
        <span>当前聚焦：《{{ focusLabel(focus.kind, focus.id) }}》</span>
        <button type="button" title="清除焦点" aria-label="清除焦点" @click="emit('update:focus', null)">×</button>
      </div>
      <div class="composer" :class="{ focused }">
        <textarea
          ref="textareaRef"
          v-model="draft"
          class="composer-input"
          rows="3"
          :placeholder="readonly ? readonlyPlaceholder : focus ? `针对「${focusLabel(focus.kind, focus.id)}」提问…` : '描述要生成的实体/页面，或让 AI 修改当前设计…'"
          :disabled="streaming || readonly"
          @keydown.enter.exact="onEnter"
          @focus="focused = true"
          @blur="focused = false"
        />
        <div class="composer-foot">
          <span class="composer-hint">Enter 发送 · Shift+Enter 换行</span>
          <button
            v-if="!readonly"
            type="button"
            :class="['send', { ready: !streaming && draft.trim(), stop: streaming }]"
            :disabled="!streaming && !draft.trim()"
            :title="streaming ? '停止生成' : '发送'"
            :aria-label="streaming ? '停止生成' : '发送'"
            @click="streaming ? stop() : onSend()"
          >
            {{ streaming ? '■' : '↑' }}
          </button>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getDesign,
  getDesignChat,
  saveDesignChat,
  saveDesignEntities,
  saveDesignPageSets,
  streamDesignChat,
  type DesignChatRequestMessage
} from './api'
import { DESIGN_DELIMITER, applyDesignEnvelope, splitDesignOutput } from './design-protocol.js'
import type { DesignChatMessage, DesignProjectPayload, NextStep } from './types'

const props = defineProps<{
  project: DesignProjectPayload
  focus: { kind: 'entity' | 'pageSet' | 'page' | 'epic'; id: string } | null
  readonly?: boolean
  /** 只读原因（如“正在按 Epic 生成”）；为空时按“设计已确认”提示 */
  readonlyReason?: string
  beforeSend?: () => Promise<void>
}>()
const emit = defineEmits<{
  update: [DesignProjectPayload]
  'update:focus': [{ kind: 'entity' | 'pageSet' | 'page' | 'epic'; id: string } | null]
}>()

const SUGGESTIONS = [
  '根据已确认需求生成实体设计',
  '根据需求场景/Epic 生成页面集（列表/创建/编辑/详情）',
  '把订单实体的字段补全：金额、状态、下单时间、下单人'
]

const messages = ref<DesignChatMessage[]>([])
/** M4：当前模块无历史、回退到旧应用级 key 时提示（只读回退，不删除旧 key） */
const legacyFallback = ref(false)
const draft = ref('')
const streaming = ref(false)
const streamingText = ref('')
const focused = ref(false)
const scrollRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
let followLocked = true
let abortController: AbortController | null = null
let turnStartedAt = 0
let elapsedTimer: ReturnType<typeof setInterval> | null = null
const nowTick = ref(Date.now())
let seq = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
let hydrating = false

const visibleStream = computed(() => streamingText.value.split(DESIGN_DELIMITER)[0])
const readonlyText = computed(() => props.readonlyReason || '设计已确认，对话只读')
const readonlyPlaceholder = computed(() =>
  props.readonlyReason
    ? `${props.readonlyReason}，完成后可继续对话`
    : '设计已确认，点击顶部「重新编辑设计」后可继续对话'
)
const elapsedText = computed(() => {
  if (!streaming.value) return ''
  const seconds = Math.max(nowTick.value - turnStartedAt, 0) / 1000
  return seconds < 60 ? `${seconds.toFixed(1)} 秒` : `${Math.floor(seconds / 60)} 分 ${String(Math.round(seconds % 60)).padStart(2, '0')} 秒`
})

function focusLabel(kind: string, id: string): string {
  if (kind === 'entity') return props.project.entities.find(item => item.id === id)?.name ?? id
  if (kind === 'pageSet') return props.project.pageSets.find(item => item.id === id)?.title ?? id
  if (kind === 'epic') {
    const input = props.project.input
    const epic = input?.epics.find(item => item.id === id)
    if (epic) return `${epic.id} ${epic.title}`
    const scene = input?.scenes.find(item => item.id === id)
    if (scene) return `${scene.id} ${scene.title}`
    return id
  }
  if (kind === 'page') {
    for (const set of props.project.pageSets) {
      const page = set.pages.find(item => item.id === id)
      if (page) return page.title
    }
  }
  return id
}

/** D-RMP：聚焦 Epic 时给出该 Epic 的快捷提示（不改变快速提示的通用列表） */
const focusEpicTitle = computed(() => {
  if (props.focus?.kind !== 'epic') return ''
  const input = props.project.input
  const node =
    input?.epics.find(item => item.id === props.focus?.id) ??
    input?.scenes.find(item => item.id === props.focus?.id)
  return node ? `${node.id} ${node.title}` : props.focus.id
})

const suggestions = computed(() => {
  if (props.focus?.kind !== 'epic' || !focusEpicTitle.value) return SUGGESTIONS
  return [
    `按当前 Epic「${focusEpicTitle.value}」生成/补全实体与页面集`,
    ...SUGGESTIONS
  ]
})

const activities = computed(() => {
  const hasUser = messages.value.some(message => message.role === 'user')
  const hasEntities = props.project.entities.length > 0
  const hasPages = props.project.pageSets.length > 0
  const openEntities = props.project.entities.filter(entity => entity.status !== 'confirmed').length
  const openSets = props.project.pageSets.filter(set => set.status !== 'confirmed').length
  const confirmed = props.project.status === 'confirmed'
  return [
    { key: 'requirement', label: '需求已确认', state: props.project.requirement?.confirmed ? 'done' : 'current' },
    {
      key: 'input',
      label: props.project.input
        ? `设计输入已生成（v${props.project.input.docVersion} · ${props.project.input.stories.length} Stories）`
        : '设计输入待生成',
      state: props.project.input ? (props.project.stale.stale ? 'current' : 'done') : 'current'
    },
    { key: 'entities', label: '实体设计已生成', state: hasEntities ? 'done' : hasUser ? 'current' : 'todo' },
    { key: 'pages', label: '页面原型已生成', state: hasPages ? 'done' : hasEntities ? 'current' : 'todo' },
    {
      key: 'confirm',
      label: confirmed ? '设计已确认' : openEntities || openSets ? '待确认' : hasPages ? '可确认设计' : '待生成',
      state: confirmed ? 'done' : openEntities || openSets ? 'current' : hasPages ? 'current' : 'todo'
    }
  ]
})

const nextSteps = computed<NextStep[]>(() => {
  const list: NextStep[] = []
  if (props.focus?.kind === 'epic' && focusEpicTitle.value) {
    list.push({
      label: `按 Epic「${props.focus.id}」补全设计`,
      prompt: `请按当前 Epic「${focusEpicTitle.value}」生成/补充实体与页面集：页面覆盖该 Epic 的 Stories，只改当前 Epic 相关设计，不要影响其它 Epic。`
    })
  }
  if (!props.project.entities.length) {
    list.push({ label: '生成实体初稿', prompt: '请根据已确认需求文档生成实体设计（表/字段/关系）。' })
  }
  for (const entity of props.project.entities.filter(item => item.status !== 'confirmed')) {
    list.push({ label: `确认实体「${entity.name}」`, prompt: `请检查并确认实体「${entity.name}」的字段与关系。` })
  }
  if (props.project.entities.length && !props.project.pageSets.length) {
    list.push({ label: '生成页面集', prompt: '请根据需求文档场景/Epic 与实体设计生成页面集（列表/创建表单/编辑表单/详情）。' })
  }
  for (const set of props.project.pageSets.filter(item => item.status !== 'confirmed')) {
    list.push({ label: `确认页面集「${set.title}」`, prompt: `请检查页面集「${set.title}」的页面与字段，若没问题我会在右侧确认。` })
  }
  const latest = [...messages.value].reverse().find(message => message.role === 'assistant' && message.nextSteps?.length)
  if (latest?.nextSteps) {
    for (const step of latest.nextSteps) {
      if (!list.some(item => item.label === step.label)) list.push(step)
    }
  }
  return list.slice(0, 6)
})

function nextId(): string {
  seq += 1
  return `dc${Date.now()}_${seq}`
}

function timeNow(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function push(role: DesignChatMessage['role'], content: string, extra: Partial<DesignChatMessage> = {}): void {
  messages.value.push({ id: nextId(), role, content, time: timeNow(), ...extra })
}

async function load(): Promise<void> {
  hydrating = true
  try {
    const data = await getDesignChat(props.project.appId, props.project.module.id)
    messages.value = data.messages.filter(message => message && typeof message.content === 'string')
    legacyFallback.value = data.legacyFallback === true
  } catch {
    messages.value = []
    legacyFallback.value = false
  } finally {
    hydrating = false
  }
  await nextTick()
  scrollToBottom()
}

function scheduleSave(): void {
  if (hydrating) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveDesignChat(props.project.appId, messages.value, props.project.module.id).catch(() => undefined)
  }, 600)
}

/** 切换模块/关闭前落盘（清掉 600ms 防抖；失败抛出，由调用方中止切换） */
async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (messages.value.length) {
    await saveDesignChat(props.project.appId, messages.value, props.project.module.id)
  }
}

watch(messages, scheduleSave, { deep: true })

function scrollToBottom(): void {
  followLocked = true
  const el = scrollRef.value
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

watch([() => messages.value.length, () => streamingText.value], () => {
  nextTick(() => {
    const el = scrollRef.value
    if (el && followLocked) el.scrollTop = el.scrollHeight
  })
})

onMounted(() => {
  void load()
})

onBeforeUnmount(() => {
  if (elapsedTimer) clearInterval(elapsedTimer)
  if (saveTimer) {
    clearTimeout(saveTimer)
    if (messages.value.length) {
      void saveDesignChat(props.project.appId, messages.value, props.project.module.id).catch(() => undefined)
    }
  }
  abortController?.abort()
})

function onEnter(event: Event): void {
  if ('isComposing' in event && event.isComposing) return
  event.preventDefault()
  onSend()
}

function nextRequestMessages(): DesignChatRequestMessage[] {
  return messages.value.slice(-20).map(message => {
    if (message.role === 'assistant') return { role: 'assistant' as const, content: message.content }
    if (message.role === 'notice') return { role: 'user' as const, content: `[系统提示] ${message.content}` }
    return { role: 'user' as const, content: message.content }
  })
}

async function onSend(): Promise<void> {
  if (props.readonly) return
  const text = draft.value.trim()
  if (!text || streaming.value) return
  draft.value = ''
  followLocked = true
  try {
    await props.beforeSend?.()
  } catch {
    ElMessage.warning('当前页面/实体尚未保存成功，请稍后重试')
    return
  }
  const focus = props.focus ? { ...props.focus } : undefined
  push('user', text, focus ? { focusKind: focus.kind, focusId: focus.id } : {})
  await runTurn(focus)
}

async function onNextStep(step: NextStep): Promise<void> {
  if (props.readonly || streaming.value) return
  draft.value = step.prompt
  await onSend()
}

async function runTurn(focus?: { kind: 'entity' | 'pageSet' | 'page' | 'epic'; id: string }): Promise<void> {
  streaming.value = true
  streamingText.value = ''
  turnStartedAt = Date.now()
  nowTick.value = turnStartedAt
  elapsedTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 100)
  abortController = new AbortController()

  try {
    const raw = await streamDesignChat(
      props.project.appId,
      { messages: nextRequestMessages(), moduleId: props.project.module.id, ...(focus ? { focus } : {}) },
      delta => {
        streamingText.value += delta
      },
      abortController.signal
    )
    const parsed = splitDesignOutput(raw)
    const envelope = parsed.envelope
    const reply = parsed.reply || (envelope?.entities || envelope?.pageSets ? '已根据你的输入更新设计。' : '')
    let applied: DesignProjectPayload | null = null

    if (envelope) {
      applied = await applyEnvelope(envelope)
      if (reply || applied) {
        push('assistant', reply || '已更新设计。', {
          ...(focus ? { focusKind: focus.kind, focusId: focus.id } : {}),
          ...(envelope.nextSteps ? { nextSteps: envelope.nextSteps } : {})
        })
      }
      if (applied) {
        emit('update', applied)
        push('notice', `已应用 AI 修改（设计 v${applied.version}）`)
        if (envelope.openIssues?.add?.length) {
          push('notice', `待确认问题：${envelope.openIssues.add.map(item => item.question).join('；')}`)
        }
      } else if (envelope.openIssues?.add?.length) {
        push('notice', `待确认问题：${envelope.openIssues.add.map(item => item.question).join('；')}`)
      } else {
        push('notice', '本轮 AI 只给出建议，未修改设计')
      }
    } else if (reply) {
      push('assistant', reply, focus ? { focusKind: focus.kind, focusId: focus.id } : {})
      push('notice', '本轮输出未能解析为设计修改（未找到 DESIGN_JSON），已仅保留文字回复。')
    } else {
      push('notice', '本轮输出未能解析为设计修改（未找到 DESIGN_JSON），请重试或换一种表述。')
    }
  } catch (error) {
    const aborted = error instanceof Error && error.message.includes('中止')
    push('notice', aborted ? '已停止生成' : `请求失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    streaming.value = false
    streamingText.value = ''
    abortController = null
    if (elapsedTimer) {
      clearInterval(elapsedTimer)
      elapsedTimer = null
    }
  }
}

type DesignEnvelope = {
  entities?: unknown[]
  pageSets?: unknown[]
  nextSteps?: NextStep[]
  openIssues?: { add?: Array<{ question: string }> }
}

async function applyEnvelope(envelope: DesignEnvelope): Promise<DesignProjectPayload | null> {
  const applied = applyDesignEnvelope({ entities: props.project.entities, pageSets: props.project.pageSets }, envelope)
  if (!applied.changed) return null
  try {
    let project = props.project
    if (envelope.entities?.length) {
      project = await saveDesignEntities(props.project.appId, applied.entities as never, 'ai', { snapshot: true }, props.project.module.id)
    }
    if (envelope.pageSets?.length) {
      project = await saveDesignPageSets(props.project.appId, applied.pageSets as never, 'ai', { snapshot: true }, props.project.module.id)
    }
    return await getDesign(props.project.appId, props.project.module.id).catch(() => project)
  } catch (error) {
    push('notice', `应用 AI 修改失败：${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

function stop(): void {
  abortController?.abort()
}

function focusComposer(): void {
  textareaRef.value?.focus()
}

watch(
  () => props.project.version,
  () => {
    // 服务端更新后保留对话；无需重载消息
  }
)

defineExpose({ focusComposer, flushSave })
</script>

<style scoped>
.design-chat {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--rg-surface-2);
  color: var(--rg-text);
  min-width: 0;
}
.chat-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 14px;
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
  flex-shrink: 0;
}
.chat-badge {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--rg-ink-contrast);
  font-size: 10.5px;
  font-weight: 700;
  background: var(--rg-ink);
  flex-shrink: 0;
}
.chat-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.chat-title strong {
  font-size: 13px;
  color: var(--rg-text);
}
.chat-sub {
  font-size: 10.5px;
  color: var(--rg-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px 16px;
}
.activity {
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 10px 12px;
}
.activity-title,
.next-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rg-text-2);
  margin-bottom: 7px;
}
.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.activity-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--rg-text-3);
}
.activity-item.done {
  color: var(--rg-ok);
}
.activity-item.current {
  color: var(--rg-ai);
  font-weight: 600;
}
.activity-mark {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}
.next-steps {
  margin-top: 10px;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 10px 12px;
}
.next-empty-hint {
  font-weight: 400;
  color: var(--rg-text-3);
}
.next-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  border-radius: 8px;
  padding: 7px 9px;
  margin-top: 6px;
  cursor: pointer;
}
.next-item:hover:not(:disabled) {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.next-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.next-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--rg-text);
}
.next-prompt {
  font-size: 10.5px;
  color: var(--rg-text-3);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.chat-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 10px;
  color: var(--rg-text-3);
  font-size: 10.5px;
}
.chat-divider::before,
.chat-divider::after {
  content: '';
  height: 1px;
  background: var(--rg-border);
  flex: 1;
}
.chat-legacy {
  margin: 0 0 8px;
  padding: 6px 8px;
  font-size: 10.5px;
  line-height: 1.55;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border: 1px solid var(--rg-warn-border);
  border-radius: 7px;
}
.chat-empty {
  padding: 4px 2px 8px;
}
.chat-empty-title {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--rg-text);
  line-height: 1.6;
}
.chat-empty-desc {
  margin: 6px 0 0;
  font-size: 11.5px;
  color: var(--rg-text-3);
  line-height: 1.7;
}
.chat-suggest {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.suggest-chip {
  text-align: left;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 11.5px;
  line-height: 1.5;
  cursor: pointer;
}
.suggest-chip:hover:not(:disabled) {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.suggest-chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.msg {
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
}
.msg-user {
  align-items: flex-end;
}
.msg-assistant,
.msg-notice {
  align-items: flex-start;
}
.msg-bubble {
  max-width: 92%;
  padding: 8px 11px;
  border-radius: 10px;
  font-size: 12.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-user .msg-bubble {
  background: var(--rg-user-bubble);
  color: var(--rg-user-bubble-text);
  border-radius: 10px 10px 3px 10px;
}
.msg-assistant .msg-bubble {
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  color: var(--rg-text);
  border-radius: 3px 10px 10px 10px;
}
.msg-notice .msg-bubble {
  background: var(--rg-fill);
  color: var(--rg-text-2);
  font-size: 11px;
  border-radius: 999px;
  padding: 3px 10px;
}
.msg-bubble.streaming {
  border-color: var(--rg-ai);
}
.msg-focus {
  font-size: 10.5px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 999px;
  padding: 1px 8px;
  margin-bottom: 3px;
}
.msg-next {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
  max-width: 92%;
  align-items: center;
}
.msg-next-title {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.msg-next-item {
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 11px;
  cursor: pointer;
}
.msg-next-item:hover:not(:disabled) {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.msg-time {
  font-size: 10px;
  color: var(--rg-text-3);
  margin-top: 4px;
}
.typing {
  display: inline-flex;
  gap: 3px;
  align-items: center;
  height: 12px;
}
.typing i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--rg-ai);
  animation: blink 1.2s infinite;
}
.typing i:nth-child(2) {
  animation-delay: 0.15s;
}
.typing i:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes blink {
  0%,
  60%,
  100% {
    opacity: 0.25;
  }
  30% {
    opacity: 1;
  }
}
.chat-composer-wrap {
  flex-shrink: 0;
  padding: 10px 12px 12px;
  background: var(--rg-surface-2);
  border-top: 1px solid var(--rg-border);
}
.focus-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  border-radius: 999px;
  font-size: 11px;
  padding: 2px 4px 2px 9px;
  margin-bottom: 6px;
  max-width: 100%;
}
.focus-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.focus-chip button {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0 4px;
  flex-shrink: 0;
}
.composer {
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  border-radius: 11px;
  padding: 8px 9px 6px 11px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.composer.focused {
  border-color: var(--rg-ai);
  box-shadow: 0 0 0 3px var(--rg-focus-ring);
}
.composer-input {
  display: block;
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  font-size: 12.5px;
  line-height: 1.6;
  font-family: inherit;
  color: var(--rg-text);
}
.composer-input::placeholder {
  color: var(--rg-text-3);
}
.composer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 3px;
}
.composer-hint {
  font-size: 10px;
  color: var(--rg-text-3);
}
.send {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-3);
  cursor: not-allowed;
  font-size: 13px;
}
.send.ready {
  background: var(--rg-ai);
  border-color: var(--rg-ai);
  color: var(--rg-ink-contrast);
  cursor: pointer;
}
.send.stop {
  background: var(--rg-danger-soft);
  border-color: var(--rg-danger-border);
  color: var(--rg-danger);
  cursor: pointer;
}

@media (max-width: 768px) {
  .msg-bubble,
  .msg-next {
    max-width: 96%;
  }
  .send {
    width: 32px;
    height: 32px;
  }
  .msg-next-item {
    min-height: 28px;
  }
}
</style>
