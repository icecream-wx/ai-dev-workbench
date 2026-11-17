<template>
  <div class="doc-chat">
    <header class="chat-head">
      <span class="chat-badge">AI</span>
      <div class="chat-title">
        <strong>需求文档助手</strong>
        <span class="chat-sub">
          <span v-if="moduleTitle" class="chat-module">{{ moduleTitle }}</span>
          {{ templateName || '模板加载中' }} · {{ docStatusLabel }}
        </span>
      </div>
    </header>

    <div v-if="legacyFallback" class="chat-legacy-hint">
      该模块暂无独立历史，显示的是旧版应用级对话；新消息只保存到当前模块。
    </div>

    <div v-if="planMode" class="chat-plan-hint" data-testid="plan-mode-hint">
      首次需求：AI 先给出「模块拆分建议」，不会直接写文档；确认后再逐模块生成完整 PRD。
    </div>

    <div class="chat-scroll" ref="scrollRef">
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
          <span v-if="!nextSteps.length" class="next-empty-hint">（文档暂无待办）</span>
        </div>
        <button v-for="(step, index) in nextSteps" :key="`${step.label}-${index}`" type="button" class="next-item" :disabled="streaming || readonly || generationRunning" @click="onNextStep(step)">
          <span class="next-label">{{ step.label }}</span>
          <span class="next-prompt">{{ step.prompt }}</span>
        </button>
      </section>

      <div class="chat-divider"><span>对话</span></div>

      <div v-if="!messages.length && !streaming" class="chat-empty">
        <p class="chat-empty-title">
          {{ planMode ? '描述你要做的产品，AI 会先拆分模块，再逐模块生成 PRD' : '描述你要做的产品，AI 会按模板生成需求文档初稿' }}
        </p>
        <p class="chat-empty-desc">
          {{
            planMode
              ? '按业务域说清范围即可（例如：商品与明细、订单、不做支付）；AI 会给出可编辑的模块拆分建议。'
              : '可以直接写一句粗描述，也可以按“问题 / 用户 / 目标 / 关键流程”说清背景；之后可逐章节让我修改。'
          }}
        </p>
        <div class="chat-suggest">
          <button v-for="item in SUGGESTIONS" :key="item" type="button" class="suggest-chip" @click="draft = item">{{ item }}</button>
        </div>
      </div>

      <div v-for="message in messages" :key="message.id" :class="['msg', `msg-${message.role}`]">
        <div v-if="message.focusSectionKey" class="msg-focus">针对《{{ sectionTitle(message.focusSectionKey) }}》</div>
        <ModuleGuidanceCard
          v-if="isGuidance(message)"
          :content="message.content"
          :metadata="message.metadata!"
          :busy="streaming || generationRunning === true"
          @action="onGuidanceAction"
        />
        <div v-else class="msg-bubble">{{ message.content }}</div>
        <div v-if="message.role === 'assistant' && message.nextSteps?.length" class="msg-next">
          <span class="msg-next-title">建议下一步：</span>
          <button
            v-for="(step, index) in message.nextSteps"
            :key="index"
            type="button"
            class="msg-next-item"
            :disabled="streaming || readonly || generationRunning"
            @click="onNextStep(step)"
          >
            {{ step.label }}
          </button>
        </div>
        <AiSuggestionCard
          v-if="message.suggestion"
          :suggestion="message.suggestion"
          :current-version="docVersion"
          :readonly="readonly"
          :streaming="streaming"
          @apply="onApplySuggestion(message, $event)"
          @ignore="onIgnoreSuggestion(message)"
        />
        <ModulePlanCard
          v-if="message.modulePlan"
          :plan="message.modulePlan"
          :plan-state="planState"
          :outcome="planOutcome"
          :plan-kind="planKind"
          :readonly="readonly"
          @apply="onApplyPlan"
          @keep-single="onKeepSingle"
          @regenerate="emit('regenerate')"
          @retry="moduleId => emit('retry-generation', moduleId)"
          @cancel="emit('cancel-generation')"
        />
        <div v-if="message.role !== 'notice'" class="msg-time">{{ message.time }}</div>
      </div>

      <div v-if="streaming" class="msg msg-assistant">
        <div class="msg-bubble streaming">
          <template v-if="visibleStream">{{ visibleStream }}</template>
          <span v-else class="typing"><i /><i /><i /></span>
        </div>
        <div class="msg-time">{{ visibleStream ? '生成中' : '思考中' }} · {{ elapsedText }}</div>
      </div>

      <button v-show="!atBottom" type="button" class="to-bottom" title="回到底部" aria-label="回到底部" @click="scrollToBottom">↓</button>
    </div>

    <footer class="chat-composer-wrap">
      <div v-if="stageReadonly" class="chat-readonly-hint" data-testid="chat-readonly-hint">
        {{ READONLY_HINT }}
      </div>
      <div v-if="focusSectionKey" class="focus-chip">
        <span>当前章节：《{{ sectionTitle(focusSectionKey) }}》</span>
        <button type="button" title="清除章节焦点" aria-label="清除章节焦点" @click="emit('update:focusSectionKey', '')">×</button>
      </div>
      <div class="composer" :class="{ focused: focused }">
        <textarea
          ref="textareaRef"
          v-model="draft"
          class="composer-input"
          rows="3"
          :placeholder="inputPlaceholder"
          :disabled="inputDisabled"
          @keydown.enter.exact="onEnter"
          @focus="focused = true"
          @blur="focused = false"
        />
        <div class="composer-foot">
          <span class="composer-hint">{{ inputHint }}</span>
          <button
            v-if="!readonly || stageReadonly"
            type="button"
            :class="['send', { ready: !streaming && !generationRunning && draft.trim(), stop: streaming }]"
            :disabled="!streaming && (!draft.trim() || generationRunning)"
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
  getDocChat,
  previewRequirementDoc,
  saveDocChat,
  saveDocFull,
  streamDocChat,
  type DocChatMessage,
  type DocChatMetadata,
  type DocChatRequestMessage,
  type DocSuggestion,
  type ModulePlan,
  type ModulePlanUiState,
  type NextStep,
  type RequirementDocPayload,
  type RequirementDocSection,
  type RequirementDocStatus
} from './api'
import { DOC_DELIMITER, mergeDocSections, splitDocOutput } from './doc-protocol.js'
import { MODULE_PLAN_DELIMITER, splitModulePlanOutput } from './module-plan-protocol.js'
import { detectModuleIntent } from './module-intent.js'
import { buildApplyPayload, diffDocSections, hydrateSuggestion, trimSuggestion } from './doc-diff.js'
import { applyChangeSetPrefill } from '../changesets/change-set-prompt.js'
import AiSuggestionCard from './AiSuggestionCard.vue'
import ModuleGuidanceCard from './ModuleGuidanceCard.vue'
import ModulePlanCard from './ModulePlanCard.vue'

const props = defineProps<{
  appId: string
  /** M3：doc 对话历史按模块拆分（父组件切模块时用 :key 重挂载） */
  moduleId: string
  moduleTitle?: string
  templateId: string
  templateName: string
  docStatus: RequirementDocStatus
  docVersion: number
  docTitle: string
  sections: RequirementDocSection[]
  focusSectionKey: string
  beforeSend?: () => Promise<void>
  readonly?: boolean
  /** #4：变更单信息带入输入框（只预填，不自动发送；有历史也可预填一次） */
  initialPrompt?: string
  /** #4：预填标记 key（应用 + 变更单 ID）；同一变更单只预填一次 */
  prefillKey?: string
  /** RMP-1：首次模块规划模式（满足首次条件时为 true；应用/生成后由父组件关闭） */
  planMode?: boolean
  /** RMP-1：应用/生成运行态（父组件持有，跨消息/刷新展示） */
  planState?: ModulePlanUiState | null
  /** RMP-1：刷新后推导的已应用结果 */
  planOutcome?: { status: 'done'; mode: 'split' | 'single' } | null
  /** RMP-2：当前已应用计划类型（replan 时旧 initial 建议卡不再提供“重新生成全部模块”） */
  planKind?: 'initial' | 'replan' | null
  /** RMP-1 MF4：逐模块生成中禁用 Composer（生成不是聊天流） */
  generationRunning?: boolean
  /** G1：应用阶段（非 requirements 时聊天输入区只读提示；仍可发送模块操作询问得到指引） */
  appStatus?: string
}>()

const emit = defineEmits<{
  'update:focusSectionKey': [string]
  'doc-changed': [RequirementDocPayload | null]
  confirm: []
  'apply-plan': [ModulePlan]
  'keep-single': []
  regenerate: []
  'retry-generation': [string]
  'cancel-generation': []
  /** G1：指引卡按钮（create-module / open-replan / reopen-requirements / open-change-set） */
  'module-action': [string]
}>()

const READONLY_HINT = '需求只读：修改请先「重新编辑需求」或发起「需求+设计」变更'

const SUGGESTIONS = [
  '做一个请假管理系统：员工提交申请，按天数分级审批，HR 可查看统计',
  '设备报修管理：提交报修单、派单、维修、验收，支持按区域筛选',
  '客户管理：客户、联系人、跟进记录、拜访计划，销售只能看自己的客户'
]

const messages = ref<DocChatMessage[]>([])
const legacyFallback = ref(false)
const draft = ref('')
const streaming = ref(false)
const streamingText = ref('')
const focused = ref(false)
const scrollRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const atBottom = ref(true)
let followLocked = true
let abortController: AbortController | null = null
let turnStartedAt = 0
let elapsedTimer: ReturnType<typeof setInterval> | null = null
const nowTick = ref(Date.now())
let seq = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
let hydrating = false
/** 只有真正产生新消息/修改建议后才落库（避免“打开模块”把旧历史隐式复制到模块 key） */
let chatDirty = false

const visibleStream = computed(() =>
  streamingText.value.split(DOC_DELIMITER)[0].split(MODULE_PLAN_DELIMITER)[0]
)
const docStatusLabel = computed(() => (props.docStatus === 'confirmed' ? '已确认' : props.docStatus === 'review' ? '待审核' : '草稿'))
/** G1：非需求阶段（设计/开发/完成）——需求文档只读，但聊天仍可询问模块操作入口 */
const stageReadonly = computed(() => (props.appStatus ?? 'requirements') !== 'requirements')
/**
 * G1：输入是否禁用。
 * - 流式/模块生成中：禁用；
 * - 文档只读（已确认/归档/不在变更范围）且仍是需求阶段：保持旧行为禁用；
 * - 仅“阶段只读”时可输入：发送时会先做模块意图预检，不是模块操作就提示入口、不发模型。
 */
const inputDisabled = computed(
  () => streaming.value || props.generationRunning === true || (props.readonly === true && !stageReadonly.value)
)
const inputPlaceholder = computed(() => {
  if (props.generationRunning === true) return '模块生成中，完成后可继续对话'
  if (stageReadonly.value) return '需求只读：可询问“新增模块”的正确入口'
  if (props.readonly === true) return '需求已确认，文档只读'
  if (props.focusSectionKey) return `针对「${sectionTitle(props.focusSectionKey)}」提问…`
  if (props.planMode === true) return '描述需求，AI 会先给出模块拆分建议…'
  return '向 AI 描述需求，或让它修改文档…'
})
const inputHint = computed(() => {
  if (props.generationRunning === true) return '模块生成中，完成后可继续对话'
  if (stageReadonly.value) return READONLY_HINT
  if (props.readonly === true) return '已确认的文档不再接受 AI 修改'
  if (props.planMode === true) return '先拆分模块；Enter 发送 · Shift+Enter 换行'
  return 'Enter 发送 · Shift+Enter 换行'
})

/** G1：该消息是模块操作指引卡（不是普通气泡） */
function isGuidance(message: DocChatMessage): boolean {
  return message?.metadata?.moduleAction === 'guidance'
}

function onGuidanceAction(action: string): void {
  if (streaming.value || props.generationRunning === true) return
  emit('module-action', action)
}
const elapsedText = computed(() => {
  if (!streaming.value) return ''
  const seconds = Math.max(nowTick.value - turnStartedAt, 0) / 1000
  return seconds < 60 ? `${seconds.toFixed(1)} 秒` : `${Math.floor(seconds / 60)} 分 ${String(Math.round(seconds % 60)).padStart(2, '0')} 秒`
})

function sectionTitle(key: string): string {
  const section = props.sections.find(item => item.sectionKey === key)
  return section?.title ?? key
}

const missingRequired = computed(() => props.sections.filter(section => section.required && !section.markdown.trim()))

const activities = computed(() => {
  const hasUser = messages.value.some(message => message.role === 'user')
  const hasDoc = props.sections.some(section => section.markdown.trim()) || props.docVersion > 1
  const reviewed = props.docStatus !== 'draft'
  const confirmed = props.docStatus === 'confirmed'
  return [
    { key: 'request', label: '已收到请求', state: hasUser ? 'done' : 'current' },
    { key: 'template', label: '已选择模板', state: props.templateName ? 'done' : 'current' },
    { key: 'doc', label: '需求文档已创建', state: hasDoc ? 'done' : hasUser ? 'current' : 'todo' },
    { key: 'review', label: reviewed ? '文档已确认' : '文档待审核', state: reviewed ? 'done' : hasDoc ? 'current' : 'todo' },
    { key: 'design', label: '可生成设计', state: confirmed ? 'done' : 'todo' }
  ]
})

const nextSteps = computed<NextStep[]>(() => {
  const list: NextStep[] = []
  for (const section of missingRequired.value) {
    list.push({
      label: `补全「${section.title}」`,
      prompt: `请补全「${section.title}」章节。撰写提示：${sectionGuidance(section.sectionKey) || '按模板要求补全'}。信息不足处写“待确认”。`
    })
  }
  const latest = [...messages.value].reverse().find(message => message.role === 'assistant' && message.nextSteps?.length)
  if (latest?.nextSteps) {
    for (const step of latest.nextSteps) {
      if (!list.some(item => item.label === step.label)) list.push(step)
    }
  }
  return list.slice(0, 6)
})

function sectionGuidance(key: string): string {
  const section = props.sections.find(item => item.sectionKey === key)
  return section ? guidanceFromTemplate(key) : ''
}

// 模板 guidance 不在章节行里，使用章节 kind 作为兜底提示
function guidanceFromTemplate(key: string): string {
  const kind = props.sections.find(item => item.sectionKey === key)?.kind
  const map: Record<string, string> = {
    meta: '产品名、作者、日期、版本、状态',
    metrics: '业务目标、可量化指标与口径',
    roles: '角色清单、画像、权限与数据范围',
    scenes: '场景清单、用户旅程、关键状态',
    epics: 'Epic、用户故事、验收标准、优先级',
    rules: '业务实体/字段、规则、校验、状态流转',
    pages: '页面清单、动作、状态、空/错/加载',
    nfr: '性能、安全、兼容性、可用性',
    issues: '未决问题，用 - 待确认：… 记录',
    glossary: '业务术语与定义',
    acceptance: '整体验收清单'
  }
  return kind ? map[kind] ?? '' : ''
}

function nextId(): string {
  seq += 1
  return `dm${Date.now()}_${seq}`
}

function timeNow(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function push(role: DocChatMessage['role'], content: string, extra: Partial<DocChatMessage> = {}): void {
  messages.value.push({ id: nextId(), role, content, time: timeNow(), ...extra })
  chatDirty = true
}

async function load(): Promise<void> {
  hydrating = true
  try {
    const data = await getDocChat(props.appId, props.moduleId)
    legacyFallback.value = data.legacyFallback
    messages.value = data.messages
      .filter(message => message && typeof message.content === 'string')
      .map(hydrateMessage)
  } catch {
    messages.value = []
  } finally {
    hydrating = false
    chatDirty = false
  }
  applyInitialPrompt()
  await nextTick()
  scrollToBottom()
}

/**
 * 历史消息恢复：
 * - R2b：持久化时裁掉了行级 diff，加载后按 markdownBefore/markdown 重算；
 * - RMP-1：旧消息若把 MODULE_PLAN_JSON 直接存在 content 里，解析回计划卡。
 */
function hydrateMessage(message: DocChatMessage): DocChatMessage {
  let next = message.suggestion ? { ...message, suggestion: hydrateSuggestion(message.suggestion) } : message
  if (!next.modulePlan && next.role === 'assistant' && String(next.content ?? '').includes(MODULE_PLAN_DELIMITER)) {
    const parsed = splitModulePlanOutput(next.content)
    if (parsed.plan) next = { ...next, content: parsed.reply || '已给出模块拆分建议。', modulePlan: parsed.plan }
  }
  return next
}

/**
 * #4：变更单预填（在 load() 完成后决定一次）
 * - 有历史对话不影响预填（真实流程里需求阶段已有历史）；
 * - 用户已输入非空草稿 → 不覆盖、不标记，之后草稿为空仍可预填；
 * - 同一变更单只预填一次（localStorage 标记，刷新/重挂载不重复）；
 * - 只读 / 无变更单 #1 → 不预填；只写入输入框，绝不自动发送。
 */
function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function applyInitialPrompt(): void {
  const text = applyChangeSetPrefill({
    prompt: props.initialPrompt,
    prefillKey: props.prefillKey,
    draft: draft.value,
    readonly: props.readonly === true,
    storage: safeLocalStorage()
  })
  if (text) draft.value = text
}

/** 持久化前裁剪建议里的行级 diff（R2b），避免对话消息膨胀 */
function persistableMessages(): DocChatMessage[] {
  return messages.value.map(message =>
    message.suggestion ? { ...message, suggestion: trimSuggestion(message.suggestion) } : message
  )
}

function scheduleSave(): void {
  if (hydrating || props.readonly || !chatDirty) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    chatDirty = false
    void saveDocChat(props.appId, persistableMessages(), props.moduleId).catch(() => undefined)
  }, 600)
}

watch(messages, scheduleSave, { deep: true })

/**
 * 立即落盘对话（RMP-1：应用拆分/保持单模块前必须）。
 * 后端生成时会读取默认模块聊天里的 user 消息作为“原始需求”，
 * 若仅依赖 600ms 防抖，用户快速点击会读到空历史。
 */
async function persistChatNow(): Promise<boolean> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (hydrating || props.readonly === true || !chatDirty) return true
  try {
    await saveDocChat(props.appId, persistableMessages(), props.moduleId)
    chatDirty = false
    return true
  } catch {
    return false
  }
}

async function onApplyPlan(plan: ModulePlan): Promise<void> {
  if (props.readonly === true || streaming.value) return
  if (!(await persistChatNow())) {
    ElMessage.warning('对话尚未保存成功，请稍后重试')
    return
  }
  emit('apply-plan', plan)
}

async function onKeepSingle(): Promise<void> {
  if (props.readonly === true || streaming.value) return
  if (!(await persistChatNow())) {
    ElMessage.warning('对话尚未保存成功，请稍后重试')
    return
  }
  emit('keep-single')
}

function onListScroll(): void {
  const el = scrollRef.value
  if (!el) return
  atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  if (!atBottom.value) followLocked = false
}

function scrollToBottom(): void {
  followLocked = true
  const el = scrollRef.value
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

watch([() => messages.value.length, () => streamingText.value], () => {
  nextTick(() => {
    const el = scrollRef.value
    if (!el) return
    if (followLocked) {
      el.scrollTop = el.scrollHeight
      atBottom.value = true
    }
  })
})

onMounted(() => {
  scrollRef.value?.addEventListener('scroll', onListScroll, { passive: true })
  void load()
})

onBeforeUnmount(() => {
  scrollRef.value?.removeEventListener('scroll', onListScroll)
  if (elapsedTimer) clearInterval(elapsedTimer)
  if (saveTimer) {
    clearTimeout(saveTimer)
    if (messages.value.length && !props.readonly && chatDirty) {
      void saveDocChat(props.appId, persistableMessages(), props.moduleId).catch(() => undefined)
    }
  }
  abortController?.abort()
})

function onEnter(event: Event): void {
  if ('isComposing' in event && event.isComposing) return
  event.preventDefault()
  onSend()
}

function nextRequestMessages(): DocChatRequestMessage[] {
  const history = messages.value.slice(-20).map(message => {
    if (message.role === 'assistant') {
      // RMP-1：多轮 refinement 时把上一版计划回传给模型，保证“基于上一版更新完整计划”
      const content =
        props.planMode === true && message.modulePlan
          ? `${message.content}\n\n${MODULE_PLAN_DELIMITER}\n${JSON.stringify(message.modulePlan)}`
          : message.content
      return { role: 'assistant' as const, content }
    }
    if (message.role === 'notice') return { role: 'user' as const, content: `[系统提示] ${message.content}` }
    return { role: 'user' as const, content: message.content }
  })
  return history
}

async function onSend(): Promise<void> {
  if (props.generationRunning === true) return
  if (props.readonly === true && !stageReadonly.value) return
  const text = draft.value.trim()
  if (!text || streaming.value) return
  // G1：仅“阶段只读”时可输入；非模块级操作不发模型，直接提示正确入口（草稿保留）
  if (stageReadonly.value && !detectModuleIntent(text)) {
    ElMessage.info(READONLY_HINT)
    return
  }
  draft.value = ''
  followLocked = true
  try {
    await props.beforeSend?.()
  } catch {
    ElMessage.warning('文档尚未保存成功，请稍后重试')
    return
  }
  const focus = props.focusSectionKey || undefined
  push('user', text, focus ? { focusSectionKey: focus } : {})
  await runTurn(focus)
}

async function onNextStep(step: NextStep): Promise<void> {
  if (streaming.value || props.generationRunning === true) return
  draft.value = step.prompt
  await onSend()
}

async function runTurn(focusSectionKey?: string): Promise<void> {
  streaming.value = true
  streamingText.value = ''
  turnStartedAt = Date.now()
  nowTick.value = turnStartedAt
  elapsedTimer = setInterval(() => {
    nowTick.value = Date.now()
  }, 100)
  abortController = new AbortController()

  try {
    const planTurn = props.planMode === true
    const guidanceBox: { value: DocChatMetadata | null } = { value: null }
    const raw = await streamDocChat(
      props.appId,
      {
        messages: nextRequestMessages(),
        templateId: props.templateId,
        focusSectionKey,
        moduleId: props.moduleId,
        mode: planTurn ? 'doc-plan' : 'doc'
      },
      delta => {
        streamingText.value += delta
      },
      abortController.signal,
      undefined,
      meta => {
        if (meta.moduleAction !== 'guidance') return
        guidanceBox.value = {
          moduleAction: 'guidance',
          stage: meta.stage ?? 'requirements',
          changeSet: meta.changeSet ?? null,
          suggestions: Array.isArray(meta.suggestions) ? meta.suggestions : []
        }
      }
    )
    // G1：模块操作意图守卫（服务端不调模型）→ 渲染指引卡，不解析/应用 DOC_JSON
    const guidance = guidanceBox.value
    if (guidance) {
      push('assistant', raw.trim() || '这是模块级操作，请使用文档里的专用入口。', {
        ...(focusSectionKey ? { focusSectionKey } : {}),
        metadata: guidance
      })
      return
    }
    if (planTurn) {
      const parsed = splitModulePlanOutput(raw)
      if (parsed.plan) {
        push(
          'assistant',
          parsed.reply || '已给出模块拆分建议，可在下方调整后应用，或选择“保持单模块”。',
          { ...(focusSectionKey ? { focusSectionKey } : {}), modulePlan: parsed.plan }
        )
        push(
          'notice',
          parsed.error
            ? `拆分建议有需要修正的问题：${parsed.error}`
            : '模块拆分建议只做规划，尚未写入文档；点击“应用拆分并生成”或继续对话调整。'
        )
      } else {
        if (parsed.reply) push('assistant', parsed.reply, focusSectionKey ? { focusSectionKey } : {})
        push('notice', parsed.error || '本轮没有解析出模块拆分建议，请重试或换一种表述。')
      }
      return
    }
    const parsed = splitDocOutput(raw)
    const reply = parsed.reply || ''
    const envelope = parsed.envelope
    const suggestion = envelope ? await buildSuggestion(envelope) : null

    if (suggestion) {
      push('assistant', reply || '已生成 AI 修改建议，请选择要应用的章节。', {
        ...(focusSectionKey ? { focusSectionKey } : {}),
        ...(envelope?.nextSteps ? { nextSteps: envelope.nextSteps } : {}),
        suggestion
      })
      push('notice', '已生成 AI 建议，请选择要应用的章节；未点击“应用”前文档不会改变')
    } else if (reply) {
      push('assistant', reply, focusSectionKey ? { focusSectionKey } : {})
      push('notice', '本轮没有文档修改建议（DOC_JSON 中没有 doc/sections），已仅保留文字回复。')
    } else {
      push('notice', '本轮输出未能解析为文档修改（未找到 DOC_JSON），请重试或换一种表述。')
    }
  } catch (error) {
    const aborted = error instanceof Error && error.message.includes('中止')
    const message = error instanceof Error ? error.message : String(error)
    push('notice', aborted ? '已停止生成' : message.startsWith('生成 AI 建议失败') ? message : `请求失败：${message}`)
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

type DocEnvelope = {
  doc?: string
  sections?: Array<{ id?: string; title?: string; markdown?: string; level?: 2 | 3; kind?: string; data?: unknown }>
  title?: string
  nextSteps?: NextStep[]
  openIssues?: { add?: Array<{ question: string }> }
}

function suggestionTitleOf(envelope: DocEnvelope, fallbackTitle: string): {
  title: string
  titleBefore: string
  titleChanged: boolean
} {
  const title = typeof envelope.title === 'string' && envelope.title.trim() ? envelope.title.trim() : fallbackTitle
  return {
    title,
    titleBefore: props.docTitle,
    titleChanged: Boolean(title && title !== props.docTitle)
  }
}

function openIssuesOf(envelope: DocEnvelope): Array<{ question: string }> {
  return (envelope.openIssues?.add ?? [])
    .filter(item => item && typeof item.question === 'string' && item.question.trim())
    .map(item => ({ question: item.question.trim() }))
}

/**
 * 把 DOC_JSON 转换成“AI 建议”：
 * - doc：调用后端 preview（不写库、不产版本），拿到建议章节 + removed + warnings；
 * - sections：本地 mergeDocSections 生成建议（不删除任何章节）。
 */
async function buildSuggestion(envelope: DocEnvelope): Promise<DocSuggestion | null> {
  const hasDoc = typeof envelope.doc === 'string' && envelope.doc.trim()
  const hasSections = Array.isArray(envelope.sections) && envelope.sections.length > 0
  const issues = openIssuesOf(envelope)
  const hasTitle = typeof envelope.title === 'string' && envelope.title.trim()
  if (!hasDoc && !hasSections && !issues.length && !hasTitle) return null

  const titleInfo = suggestionTitleOf(envelope, props.docTitle)
  try {
    if (hasDoc) {
      const preview = await previewRequirementDoc(
        props.appId,
        {
          contentMd: envelope.doc as string,
          ...(titleInfo.title ? { title: titleInfo.title } : {})
        },
        props.moduleId
      )
      const diff = diffDocSections(props.sections, preview.sections, preview.removed)
      return {
        title: preview.title || titleInfo.title,
        titleBefore: props.docTitle,
        titleChanged: Boolean((preview.title || titleInfo.title) && (preview.title || titleInfo.title) !== props.docTitle),
        sections: diff.sections as DocSuggestion['sections'],
        counts: diff.counts,
        warnings: preview.warnings ?? [],
        openIssues: issues,
        baseVersion: preview.baseVersion || props.docVersion,
        source: 'preview'
      }
    }
    if (hasSections) {
      const merged = mergeDocSections(props.sections, envelope.sections ?? [])
      const diff = diffDocSections(props.sections, merged, [])
      return {
        title: titleInfo.title,
        titleBefore: titleInfo.titleBefore,
        titleChanged: titleInfo.titleChanged,
        sections: diff.sections as DocSuggestion['sections'],
        counts: diff.counts,
        warnings: [],
        openIssues: issues,
        baseVersion: props.docVersion,
        source: 'local'
      }
    }
    return {
      title: titleInfo.title,
      titleBefore: titleInfo.titleBefore,
      titleChanged: titleInfo.titleChanged,
      sections: [],
      counts: { added: 0, modified: 0, removed: 0, unchanged: 0 },
      warnings: [],
      openIssues: issues,
      baseVersion: props.docVersion,
      source: 'local'
    }
  } catch (error) {
    throw new Error(`生成 AI 建议失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

interface SuggestionSelection {
  selectedKeys: string[]
  removedKeys: string[]
  includeTitle: boolean
  includeIssues: boolean
}

async function onApplySuggestion(message: DocChatMessage, selection: SuggestionSelection): Promise<void> {
  const suggestion = message.suggestion
  if (!suggestion || suggestion.applied || suggestion.ignored) return
  if (props.readonly) {
    ElMessage.warning('需求文档已确认，当前只读')
    return
  }
  // R2b：先判断版本再 flush，避免把过期建议应用到已变化的文档
  if (suggestion.baseVersion !== props.docVersion) {
    ElMessage.warning(`文档已更新（v${suggestion.baseVersion} → v${props.docVersion}），请重新生成 AI 建议后再应用`)
    return
  }
  // 落盘未保存的手动编辑，避免应用建议时覆盖/丢失
  try {
    await props.beforeSend?.()
    await nextTick()
  } catch {
    ElMessage.warning('文档尚未保存成功，请稍后重试')
    return
  }
  if (suggestion.baseVersion !== props.docVersion) {
    ElMessage.warning('已保存未提交的编辑，文档版本已变化；请重新生成 AI 建议后再应用')
    return
  }
  const issuesSection = props.sections.find(section => section.kind === 'issues' || section.sectionKey === 'issues')
  const payload = buildApplyPayload(suggestion.sections, {
    selectedKeys: selection.selectedKeys,
    removedKeys: selection.removedKeys,
    includeTitle: selection.includeTitle,
    title: suggestion.title,
    includeIssues: selection.includeIssues,
    issues: suggestion.openIssues,
    issuesSection
  })
  const hasChange = payload.sections.length > 0 || payload.removeSectionKeys.length > 0 || Boolean(payload.title)
  if (!hasChange) {
    push('notice', '没有可应用的修改（未勾选章节）')
    return
  }
  try {
    const saved = await saveDocFull(
      props.appId,
      {
        ...(payload.title ? { title: payload.title } : {}),
        sections: payload.sections,
        removeSectionKeys: payload.removeSectionKeys,
        source: 'ai'
      },
      props.moduleId
    )
    suggestion.applied = {
      version: saved.doc.version,
      sectionCount: payload.sections.length,
      removedCount: payload.removeSectionKeys.length
    }
    const detail = [
      `${payload.sections.length} 章节`,
      payload.removeSectionKeys.length ? `删除 ${payload.removeSectionKeys.length} 节` : ''
    ]
      .filter(Boolean)
      .join('，')
    push('notice', `已应用 AI 修改（文档 v${saved.doc.version}，${detail}）`)
    const warnings = [...payload.warnings, ...(saved.warnings ?? [])]
    if (warnings.length) ElMessage.warning(warnings.join('；'))
    emit('doc-changed', saved)
  } catch (error) {
    push('notice', `应用 AI 修改失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

function onIgnoreSuggestion(message: DocChatMessage): void {
  const suggestion = message.suggestion
  if (!suggestion || suggestion.applied) return
  suggestion.ignored = true
  push('notice', '已忽略本轮 AI 建议（文档未修改）')
}

function stop(): void {
  abortController?.abort()
}

function focusComposer(): void {
  textareaRef.value?.focus()
}

defineExpose({ focusComposer })
</script>

<style scoped>
.doc-chat {
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
.chat-module {
  color: var(--rg-text-2);
  font-weight: 600;
}
.chat-module::after {
  content: ' · ';
  font-weight: 400;
  color: var(--rg-text-3);
}
.chat-legacy-hint {
  flex-shrink: 0;
  margin: 8px 12px 0;
  border: 1px solid var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
  border-radius: 8px;
  padding: 6px 9px;
  font-size: 11px;
  line-height: 1.55;
}
.chat-plan-hint {
  flex-shrink: 0;
  margin: 8px 12px 0;
  border: 1px solid var(--rg-ai-border);
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  border-radius: 8px;
  padding: 6px 9px;
  font-size: 11px;
  line-height: 1.55;
}
.msg :deep(.plan-card) {
  width: 100%;
}
.chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px 16px;
  position: relative;
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
.suggest-chip:hover {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
  color: var(--rg-text);
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
.to-bottom {
  position: sticky;
  bottom: 6px;
  margin-left: auto;
  display: block;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  cursor: pointer;
  box-shadow: var(--rg-shadow-1);
}
.to-bottom:hover {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.chat-composer-wrap {
  flex-shrink: 0;
  padding: 10px 12px 12px;
  background: var(--rg-surface-2);
  border-top: 1px solid var(--rg-border);
}
.chat-readonly-hint {
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--rg-text-3);
  background: var(--rg-fill);
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  padding: 5px 9px;
  margin-bottom: 7px;
}
.msg :deep(.guide-card) {
  width: 100%;
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
  .msg-bubble {
    max-width: 96%;
  }
  .msg-next {
    max-width: 96%;
  }
  .to-bottom,
  .send {
    width: 32px;
    height: 32px;
  }
  .msg-next-item {
    min-height: 28px;
  }
}
</style>
