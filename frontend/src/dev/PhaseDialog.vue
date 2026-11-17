<template>
  <Teleport to="body">
    <div v-if="modelValue" class="mask" @click.self="close">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="开发阶段" data-testid="phase-dialog">
        <header class="head">
          <div>
            <h2>开发阶段</h2>
            <p>
              阶段来自交接包 <code>04-PLAN.md</code> 的分阶段建议；一个阶段一个会话，
              <strong>不设门禁</strong>，不会自动发送首条提示，也不会自动完成应用。
            </p>
          </div>
          <button type="button" class="icon-btn" aria-label="关闭" title="关闭" @click="close">×</button>
        </header>

        <div class="meta">
          <span class="badge">已完成 {{ progress.completed }}/{{ progress.total }}</span>
          <span v-if="skippedCount" class="chip muted">已跳过 {{ skippedCount }}</span>
          <span v-if="handoffVersion" class="chip muted">交接包 v{{ handoffVersion }}</span>
          <span v-if="historical" class="chip warn" data-testid="phase-history-chip">历史交接包阶段只读</span>
        </div>

        <div class="body">
          <aside class="list">
            <template v-for="group in grouped.groups" :key="group.kind === 'module' ? `m:${group.key}` : `p:${group.phase.id}`">
              <div v-if="group.kind === 'module'" class="module-block" :data-testid="`phase-module-${group.key}`">
                <div :class="['module-row', { active: activeId === group.module.id }]">
                  <button
                    type="button"
                    class="module-toggle"
                    :aria-expanded="isModuleExpanded(group.key)"
                    :data-testid="`phase-module-toggle-${group.key}`"
                    @click="toggleModule(group.key)"
                  >
                    {{ isModuleExpanded(group.key) ? '▾' : '▸' }}
                  </button>
                  <button type="button" class="module-main" @click="activeId = group.module.id">
                    <span class="module-key">{{ group.key }}</span>
                    <span class="item-name" :title="group.module.title">{{ moduleName(group.module) }}</span>
                    <span :class="['phase-chip', phaseStatusClass(moduleStatus(group.phases))]">
                      {{ phaseStatusLabel(moduleStatus(group.phases)) }}
                    </span>
                    <span class="module-count">{{ moduleCompleted(group.phases) }}/{{ group.phases.length }}</span>
                  </button>
                </div>
                <div v-if="isModuleExpanded(group.key)" class="module-children">
                  <button
                    v-for="phase in group.phases"
                    :key="phase.id"
                    type="button"
                    :class="['phase-item', 'module-child', { active: phase.id === activeId }]"
                    data-testid="phase-item"
                    @click="activeId = phase.id"
                  >
                    <span class="item-order">{{ phaseOrderLabel(phase.order, executable.length) }}</span>
                    <span class="item-name" :title="phase.title">{{ phase.title }}</span>
                    <span :class="['phase-chip', phaseStatusClass(phase.status)]">{{ phaseStatusLabel(phase.status) }}</span>
                    <span v-if="phase.session" class="session-mark">会话</span>
                  </button>
                </div>
              </div>
              <button
                v-else
                type="button"
                :class="['phase-item', { active: group.phase.id === activeId }]"
                data-testid="phase-item"
                @click="activeId = group.phase.id"
              >
                <span class="item-order">{{ phaseOrderLabel(group.phase.order, executable.length) }}</span>
                <span class="item-name" :title="group.phase.title">{{ group.phase.title }}</span>
                <span :class="['phase-chip', phaseStatusClass(group.phase.status)]">{{ phaseStatusLabel(group.phase.status) }}</span>
                <span v-if="group.phase.session" class="session-mark">会话</span>
              </button>
            </template>
            <p v-if="!phases.length" class="list-empty">尚未生成阶段。</p>
          </aside>

          <section v-if="activePhase" class="detail" data-testid="phase-detail">
            <div class="detail-head">
              <h3>
                <template v-if="activePhase.kind === 'module'">模块阶段 · {{ activePhase.title }}</template>
                <template v-else>{{ phaseOrderLabel(activePhase.order, executable.length) }} · {{ activePhase.title }}</template>
              </h3>
              <span :class="['phase-chip', phaseStatusClass(activePhase.status)]">
                {{ phaseStatusLabel(activePhase.status) }}
              </span>
            </div>
            <p v-if="activePhase.moduleKey" class="module-detail-line" data-testid="phase-module-detail">
              模块：{{ activePhase.moduleKey }}
              <template v-if="activePhase.kind !== 'module'"> · 会话绑定模块内 Epic/页面阶段</template>
              <template v-else> · 分组/里程碑（不单独开会话、不单独调模型摘要）</template>
            </p>
            <p class="goal">{{ activePhase.goal || '按 04-PLAN.md 阶段章节' }}</p>

            <dl>
              <div class="scope-row">
                <dt>范围</dt>
                <dd data-testid="phase-scope">{{ phaseScopeDetail(activePhase.scope) }}</dd>
              </div>
              <div><dt>开始</dt><dd>{{ formatTime(activePhase.startedAt) }}</dd></div>
              <div><dt>完成</dt><dd>{{ formatTime(activePhase.completedAt) }}</dd></div>
              <div><dt>交接包</dt><dd>v{{ activePhase.handoffVersion }}</dd></div>
              <div><dt>变更单</dt><dd class="mono" :title="activePhase.changeSetId ?? ''">{{ shortId(activePhase.changeSetId) }}</dd></div>
            </dl>

            <section v-if="activePhase.kind === 'module'" class="summary" data-testid="phase-module-milestone">
              <div class="summary-head">
                <strong>模块里程碑</strong>
                <span class="summary-source">{{ moduleCompleted(activeModuleChildren) }}/{{ activeModuleChildren.length }} 子阶段已处理</span>
              </div>
              <p class="muted">
                模块阶段只做分组/进度汇总，不单独开始会话；请在该模块内选择 Epic/页面阶段开始开发。
              </p>
            </section>

            <section v-if="activePhase.kind !== 'module'" class="summary" data-testid="phase-summary">
              <div class="summary-head">
                <strong>阶段摘要</strong>
                <span class="summary-source">{{ phaseSummarySourceLabel(activePhase.summarySource) }}</span>
              </div>
              <p v-if="summaryPending" class="summary-pending">正在生成阶段摘要…</p>
              <pre v-else-if="activePhase.summary" class="summary-text">{{ activePhase.summary }}</pre>
              <p v-else class="muted">
                {{
                  activePhase.status === 'completed' || activePhase.status === 'skipped'
                    ? '暂无阶段摘要（该阶段没有会话或会话没有回复）。'
                    : '阶段完成后会尝试生成摘要（失败回退最后一条回复）。'
                }}
              </p>
            </section>

            <section v-if="activePhase.kind !== 'module'" class="session">
              <div class="summary-head">
                <strong>阶段会话</strong>
                <span class="muted">{{ activePhase.sessionCount }} 个</span>
              </div>
              <p v-if="!activePhase.session" class="muted">尚未创建阶段会话；开始阶段会创建会话并生成首条提示（不自动发送）。</p>
              <p v-else class="session-line">
                <span class="session-title" :title="activePhase.session.displayTitle">{{ activePhase.session.displayTitle }}</span>
                <span class="chip muted">{{ sessionStatusLabel(activePhase.session.status) }}</span>
              </p>
            </section>

            <p v-if="action.reason" class="readonly-reason" data-testid="phase-readonly-reason">{{ action.reason }}</p>

            <div v-if="activePhase.kind !== 'module'" class="actions">
              <button
                type="button"
                class="btn primary"
                :disabled="busy || !action.canStart"
                :title="action.canStart ? '' : action.reason || '当前状态不可开始'"
                data-testid="phase-start"
                @click="emit('start', activePhase)"
              >
                {{ busy && busyAction === 'start' ? '进入中…' : startLabel }}
              </button>
              <button
                type="button"
                class="btn"
                :disabled="busy || !action.canComplete"
                :title="action.canComplete ? '' : action.reason || '当前状态不可完成'"
                data-testid="phase-complete"
                @click="emit('complete', activePhase)"
              >
                {{ busy && busyAction === 'complete' && summaryPending ? '生成摘要中…' : '完成' }}
              </button>
              <button
                type="button"
                class="btn"
                :disabled="busy || !action.canSkip"
                :title="action.canSkip ? '' : action.reason || '当前状态不可跳过'"
                data-testid="phase-skip"
                @click="emit('skip', activePhase)"
              >
                跳过
              </button>
              <button
                type="button"
                class="btn"
                :disabled="busy || !action.canReopen"
                :title="action.canReopen ? '' : action.reason || '当前状态不可重新打开'"
                data-testid="phase-reopen"
                @click="emit('reopen', activePhase)"
              >
                重新打开
              </button>
            </div>
          </section>

          <section v-else class="detail empty">
            <p>尚未生成阶段。</p>
          </section>
        </div>

        <footer class="foot">
          <span class="foot-hint">
            已完成 {{ progress.completed }}/{{ progress.total }}
            <template v-if="hint"> · {{ hint }}</template>
          </span>
          <button type="button" class="btn" @click="close">关闭</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { DevPhaseView } from './types'
import { sessionStatusLabel } from './session-labels.js'
import {
  executablePhases,
  groupPhasesByModule,
  moduleName,
  moduleStatusOf,
  phaseActionState,
  phaseCompletionHint,
  phaseOrderLabel,
  phaseProgress,
  phaseScopeDetail,
  phaseStatusClass,
  phaseStatusLabel,
  phaseSummarySourceLabel
} from './phase-labels.js'

const props = defineProps<{
  modelValue: boolean
  phases: DevPhaseView[]
  currentPhaseId: string | null
  currentHandoffVersion: number | null
  handoffVersion: number | null
  readOnly: boolean
  busy: boolean
  busyAction: '' | 'start' | 'complete' | 'skip' | 'reopen'
}>()

const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  start: [phase: DevPhaseView]
  complete: [phase: DevPhaseView]
  skip: [phase: DevPhaseView]
  reopen: [phase: DevPhaseView]
}>()

const activeId = ref('')
const collapsedModules = ref<Record<string, boolean>>({})

const grouped = computed(() => groupPhasesByModule(props.phases))
const executable = computed(() => executablePhases(props.phases))
const activePhase = computed<DevPhaseView | null>(
  () => props.phases.find(phase => phase.id === activeId.value) ?? null
)
const activeModuleGroup = computed(() =>
  activePhase.value?.kind === 'module'
    ? grouped.value.modules.find(group => group.module.id === activePhase.value?.id) ?? null
    : null
)
const activeModuleChildren = computed<DevPhaseView[]>(() => activeModuleGroup.value?.phases ?? [])

function isModuleExpanded(key: string): boolean {
  return collapsedModules.value[key] !== true
}

function toggleModule(key: string): void {
  collapsedModules.value = { ...collapsedModules.value, [key]: isModuleExpanded(key) }
}

function moduleStatus(children: DevPhaseView[]): string {
  return moduleStatusOf(children)
}

function moduleCompleted(children: DevPhaseView[]): number {
  return children.filter(phase => phase.status === 'completed' || phase.status === 'skipped').length
}

function defaultActiveId(): string {
  return (
    props.currentPhaseId ??
    executable.value.find(phase => phase.status === 'in_progress')?.id ??
    executable.value[0]?.id ??
    props.phases[0]?.id ??
    ''
  )
}

const progress = computed(() => phaseProgress(props.phases))
const skippedCount = computed(() => executable.value.filter(phase => phase.status === 'skipped').length)
const hint = computed(() => phaseCompletionHint(props.phases))
const action = computed(() => phaseActionState(activePhase.value, props.currentHandoffVersion, props.readOnly))
const historical = computed(() => Boolean(activePhase.value && activePhase.value.handoffVersion !== props.currentHandoffVersion))
const summaryPending = computed(
  () => props.busy && props.busyAction === 'complete' && Boolean(activePhase.value)
)
const startLabel = computed(() => {
  const status = activePhase.value?.status
  if (status === 'skipped') return '重新开始'
  if (status === 'in_progress') return '继续阶段'
  return '开始阶段'
})

watch(
  () => props.modelValue,
  open => {
    if (!open) return
    activeId.value = defaultActiveId()
  }
)

watch(
  () => props.phases.map(phase => phase.id).join('|'),
  () => {
    if (activeId.value && props.phases.some(phase => phase.id === activeId.value)) return
    activeId.value = defaultActiveId()
  }
)

function close(): void {
  if (props.busy) return
  emit('update:modelValue', false)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.modelValue) close()
}

function formatTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function shortId(value: string | null): string {
  if (!value) return '—'
  return value.length > 12 ? `${value.slice(0, 8)}…` : value
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 1900;
  background: var(--rg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.dialog {
  width: min(1000px, calc(100vw - 32px));
  height: min(760px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius-lg);
  box-shadow: 0 24px 60px rgba(10, 14, 20, 0.3);
  font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: var(--rg-text);
  overflow: hidden;
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 8px;
  flex-shrink: 0;
}
.head h2 {
  margin: 0 0 5px;
  font-size: 17px;
  font-weight: 650;
}
.head p {
  margin: 0;
  font-size: 12px;
  color: var(--rg-text-2);
  line-height: 1.55;
}
.icon-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--rg-text-3);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.icon-btn:hover {
  background: var(--rg-fill-2);
  color: var(--rg-text);
}
.meta {
  margin: 0 24px 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  flex-shrink: 0;
}
.badge {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  border-radius: 999px;
  padding: 2px 8px;
  font-weight: 600;
}
.chip {
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.chip.muted {
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.chip.warn {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
  border: 1px solid var(--rg-warn-border);
}
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  margin: 0 24px 8px;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  overflow: hidden;
}
.list {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  padding: 8px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.phase-item {
  width: 100%;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 8px;
  padding: 7px 8px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  color: var(--rg-text-2);
}
.module-block {
  border-radius: 8px;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  overflow: hidden;
}
.module-row {
  display: flex;
  align-items: stretch;
  gap: 0;
}
.module-row.active {
  background: var(--rg-fill-2);
}
.module-toggle {
  border: none;
  background: transparent;
  color: var(--rg-text-3);
  cursor: pointer;
  padding: 0 4px;
  font-size: 10px;
  flex-shrink: 0;
}
.module-toggle:hover {
  color: var(--rg-text);
}
.module-main {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  padding: 7px 8px 7px 0;
  color: var(--rg-text);
}
.module-main:hover {
  color: var(--rg-text);
}
.module-key {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 4px;
  padding: 1px 5px;
  flex-shrink: 0;
}
.module-count {
  font-size: 9.5px;
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.module-children {
  border-top: 1px solid var(--rg-border);
  padding: 3px 5px 5px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.phase-item.module-child {
  padding: 5px 7px;
}
.module-detail-line {
  margin: 0;
  font-size: 11.5px;
  color: var(--rg-ai);
}
.phase-item:hover {
  background: var(--rg-fill-2);
  color: var(--rg-text);
}
.phase-item.active {
  background: var(--rg-surface);
  border-color: var(--rg-border-strong);
  color: var(--rg-text);
  box-shadow: var(--rg-shadow-1);
}
.item-order {
  font-size: 10px;
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.item-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.phase-chip {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 1px 6px;
  font-size: 9.5px;
  border: 1px solid transparent;
  background: var(--rg-fill-2);
  color: var(--rg-text-3);
  white-space: nowrap;
}
.phase-chip.in-progress {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.phase-chip.completed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.phase-chip.skipped,
.phase-chip.unknown {
  background: var(--rg-fill-2);
  color: var(--rg-text-3);
}
.phase-chip.not-started {
  color: var(--rg-text-3);
}
.session-mark {
  font-size: 9.5px;
  color: var(--rg-ai);
  flex-shrink: 0;
}
.list-empty {
  margin: 12px 8px;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.detail {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  background: var(--rg-surface);
}
.detail.empty {
  display: grid;
  place-items: center;
  color: var(--rg-text-3);
  font-size: 12.5px;
}
.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.detail-head h3 {
  margin: 0;
  font-size: 14px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.goal {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--rg-text-2);
}
dl {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11.5px;
}
dl div {
  display: flex;
  gap: 10px;
}
dl dt {
  width: 56px;
  flex-shrink: 0;
  color: var(--rg-text-3);
}
dl dd {
  margin: 0;
  min-width: 0;
  color: var(--rg-text-2);
  overflow-wrap: anywhere;
}
.scope-row dd {
  line-height: 1.6;
}
.summary,
.session {
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  padding: 9px 11px;
  background: var(--rg-surface-2);
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
}
.summary-source {
  font-size: 10.5px;
  color: var(--rg-text-3);
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 1px 7px;
}
.summary-text {
  margin: 0;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.7;
  color: var(--rg-text-2);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 220px;
  overflow: auto;
}
.summary-pending {
  margin: 0;
  font-size: 12px;
  color: var(--rg-ai);
}
.session-line {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  min-width: 0;
}
.session-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.muted {
  margin: 0;
  font-size: 11.5px;
  color: var(--rg-text-3);
  line-height: 1.6;
}
.readonly-reason {
  margin: 0;
  border-radius: 7px;
  padding: 7px 9px;
  font-size: 11.5px;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border: 1px solid var(--rg-warn-border);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
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
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 24px 16px;
}
.foot-hint {
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.mono {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px;
}
code {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  border-radius: 4px;
  padding: 1px 5px;
}
@media (max-width: 820px) {
  .mask {
    padding: 10px;
  }
  .dialog {
    width: calc(100vw - 20px);
    height: calc(100vh - 20px);
  }
  .head,
  .foot {
    padding-left: 14px;
    padding-right: 14px;
  }
  .meta,
  .body {
    margin-left: 14px;
    margin-right: 14px;
  }
  .body {
    flex-direction: column;
  }
  .list {
    width: auto;
    max-height: 148px;
    border-right: none;
    border-bottom: 1px solid var(--rg-border);
  }
}
</style>
