<template>
  <section class="phase-bar" data-testid="phase-bar">
    <div class="bar-main">
      <div class="bar-title">
        <span class="bar-index">{{ barLabel }}</span>
        <span v-if="currentPhase" :class="['phase-chip', phaseStatusClass(currentPhase.status)]">
          {{ phaseStatusLabel(currentPhase.status) }}
        </span>
      </div>
      <span class="bar-progress">已完成 {{ progress.completed }}/{{ progress.total }}</span>
      <div v-if="moduleGroups.length" class="module-strip" data-testid="phase-bar-modules">
        <button
          v-for="group in moduleGroups"
          :key="group.key"
          type="button"
          :class="['module-chip', phaseStatusClass(moduleStatus(group))]"
          :title="`${moduleLabel(group.module)} · ${phaseStatusLabel(moduleStatus(group))}`"
          :data-testid="`phase-bar-module-${group.key}`"
          @click="emit('open', group.module)"
        >
          <span class="module-key">{{ group.key }}</span>
          <span class="module-progress">{{ moduleCompleted(group) }}/{{ group.phases.length }}</span>
        </button>
      </div>
      <div class="bar-actions">
        <button
          type="button"
          class="btn small"
          :disabled="busy"
          data-testid="phase-bar-open"
          @click="emit('open', currentPhase)"
        >
          选择阶段
        </button>
        <button
          v-if="currentPhase"
          type="button"
          class="btn small"
          :disabled="busy"
          data-testid="phase-bar-scope"
          @click="emit('open', currentPhase)"
        >
          查看范围
        </button>
        <button
          v-if="showComplete"
          type="button"
          class="btn small"
          :disabled="busy || actionDisabled"
          data-testid="phase-bar-complete"
          @click="currentPhase && emit('complete', currentPhase)"
        >
          完成
        </button>
        <button
          v-if="showSkip"
          type="button"
          class="btn small"
          :disabled="busy || actionDisabled"
          data-testid="phase-bar-skip"
          @click="currentPhase && emit('skip', currentPhase)"
        >
          跳过
        </button>
        <button
          v-if="showReopen"
          type="button"
          class="btn small"
          :disabled="busy || actionDisabled"
          data-testid="phase-bar-reopen"
          @click="currentPhase && emit('reopen', currentPhase)"
        >
          重新打开
        </button>
      </div>
    </div>
    <p v-if="hint" class="bar-hint" data-testid="phase-bar-hint">{{ hint }}</p>
    <p v-else-if="currentPhase && action.reason" class="bar-reason" data-testid="phase-bar-reason">{{ action.reason }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DevPhaseView } from './types'
import {
  executablePhases,
  groupPhasesByModule,
  moduleLabel,
  moduleStatusOf,
  phaseActionState,
  phaseCompletionHint,
  phaseOrderLabel,
  phaseProgress,
  phaseRefLabel,
  phaseStatusClass,
  phaseStatusLabel
} from './phase-labels.js'

const props = defineProps<{
  phases: DevPhaseView[]
  currentPhaseId: string | null
  currentHandoffVersion: number | null
  readOnly: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  open: [phase: DevPhaseView | null]
  start: [phase: DevPhaseView]
  complete: [phase: DevPhaseView]
  skip: [phase: DevPhaseView]
  reopen: [phase: DevPhaseView]
}>()

const total = computed(() => executablePhases(props.phases).length)
const currentPhase = computed<DevPhaseView | null>(
  () => props.phases.find(phase => phase.id === props.currentPhaseId && phase.kind !== 'module') ?? null
)
const progress = computed(() => phaseProgress(props.phases))
const groups = computed(() => groupPhasesByModule(props.phases))
const moduleGroups = computed(() => groups.value.modules)
const moduleCompleted = (group: { phases: DevPhaseView[] }): number =>
  group.phases.filter(phase => phase.status === 'completed').length
const moduleStatus = (group: { phases: DevPhaseView[] }): string => moduleStatusOf(group.phases)
const hint = computed(() => phaseCompletionHint(props.phases))
const action = computed(() => phaseActionState(currentPhase.value, props.currentHandoffVersion, props.readOnly))
const barLabel = computed(() =>
  currentPhase.value
    ? `${phaseRefLabel(currentPhase.value)}` || `${phaseOrderLabel(currentPhase.value.order, total.value)} · ${currentPhase.value.title}`
    : '按阶段开发 · 选择阶段开始'
)
const status = computed(() => currentPhase.value?.status ?? '')
const showComplete = computed(() => status.value === 'not_started' || status.value === 'in_progress')
const showSkip = computed(() => showComplete.value)
const showReopen = computed(() => status.value === 'completed' || status.value === 'skipped')
/** 只读或历史交接包：按钮保留但禁用（原因见下方提示行） */
const actionDisabled = computed(
  () => props.readOnly || Boolean(currentPhase.value && currentPhase.value.handoffVersion !== props.currentHandoffVersion)
)
</script>

<style scoped>
.phase-bar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 7px 14px;
  border-bottom: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface-2, #fafbfc);
  font-size: 11.5px;
  color: var(--rg-text-2, #4b5563);
}
.bar-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  min-width: 0;
}
.bar-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 220px;
}
.bar-index {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-text, #1f2937);
  font-weight: 600;
}
.phase-chip {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 10px;
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
.bar-progress {
  flex-shrink: 0;
  color: var(--rg-text-3, #8a93a3);
  font-size: 10.5px;
  white-space: nowrap;
}
.module-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}
.module-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface, #fff);
  color: var(--rg-text-2, #4b5563);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 10px;
  cursor: pointer;
  white-space: nowrap;
}
.module-chip:hover {
  border-color: var(--rg-border-strong, #d4d9e2);
  background: var(--rg-hover, #f6f7f9);
}
.module-chip.in-progress {
  border-color: var(--rg-ai, #5b5bd6);
  color: var(--rg-ai, #5b5bd6);
  background: var(--rg-ai-soft, #eeeefc);
}
.module-chip.completed {
  border-color: var(--rg-ok, #12855f);
  color: var(--rg-ok, #12855f);
  background: var(--rg-ok-soft, #e8f5ef);
}
.module-chip.skipped {
  color: var(--rg-text-3, #8a93a3);
}
.module-key {
  font-weight: 600;
}
.module-progress {
  color: inherit;
  opacity: 0.8;
}
.bar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}
.bar-hint {
  margin: 0;
  color: var(--rg-ok, #12855f);
  font-size: 11px;
}
.bar-reason {
  margin: 0;
  color: var(--rg-warn, #a05e03);
  font-size: 11px;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface, #fff);
  color: var(--rg-text-2, #4b5563);
  border-radius: 7px;
  padding: 5px 9px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-border-strong, #d4d9e2);
  background: var(--rg-hover, #f6f7f9);
  color: var(--rg-text, #1f2937);
}
.btn.small {
  padding: 4px 8px;
  font-size: 10.5px;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 1024px) {
  .bar-actions {
    margin-left: 0;
  }
  .bar-title {
    flex-basis: 100%;
  }
}
@media (max-width: 768px) {
  .phase-bar {
    padding: 6px 10px;
  }
  .bar-title {
    flex-basis: auto;
  }
  .bar-actions {
    width: 100%;
  }
}
</style>
