<template>
  <section class="gen-progress" data-testid="module-generation-progress">
    <header class="gen-head">
      <span class="gen-title">逐模块生成</span>
      <span class="gen-count">{{ summary.done }}/{{ summary.total }} 完成</span>
      <span v-if="state.running" class="gen-live">生成中…</span>
      <span v-else-if="state.cancelled || summary.cancelled > 0" class="gen-cancelled">
        {{ summary.cancelled > 0 ? `${summary.cancelled} 个已取消` : '已取消' }}
      </span>
      <span v-else-if="state.globalError || summary.failed" class="gen-failed">{{ summary.failed }} 个失败</span>
      <span v-else class="gen-ok">已完成</span>
    </header>

    <p class="gen-hint">
      按模块顺序生成完整 PRD；每个模块都是草稿，生成后请逐模块审阅并确认。生成中可随时取消（已完成保留）。
    </p>

    <ol class="gen-list">
      <li v-for="(item, index) in state.items" :key="item.moduleId || index" :class="['gen-item', item.status]">
        <span class="gen-index">{{ index + 1 }}</span>
        <div class="gen-main">
          <div class="gen-row">
            <span class="gen-module">{{ item.title || item.moduleId }}</span>
            <span :class="['gen-status', item.status]">{{ statusLabel(item.status) }}</span>
            <span v-if="item.status === 'done' && item.version" class="gen-version">v{{ item.version }}</span>
            <button
              v-if="retryable(item) && !state.running && !disabled"
              type="button"
              class="gen-retry"
              data-testid="retry-module"
              @click="emit('retry', item.moduleId)"
            >
              重试
            </button>
          </div>
          <div v-if="item.error" class="gen-error">{{ item.error }}</div>
          <div v-if="item.warnings.length" class="gen-warn">{{ item.warnings.slice(0, 3).join('；') }}</div>
        </div>
      </li>
    </ol>

    <div v-if="state.globalError" class="gen-global-error">{{ state.globalError }}</div>

    <footer class="gen-foot">
      <span v-if="state.running" class="gen-note">生成中暂不能重新规划；可查看已完成的模块。</span>
      <span v-else-if="state.cancelled || summary.cancelled > 0" class="gen-note">未完成模块可点“重试”；已完成的模块保留。</span>
      <span v-else-if="summary.failed" class="gen-note">失败模块可点“重试”；其它模块不受影响。</span>
      <span v-else class="gen-note">已生成 {{ summary.done }} 个模块（草稿），请逐模块确认需求。</span>
      <button
        v-if="state.running && !disabled"
        type="button"
        class="gen-cancel"
        data-testid="cancel-generation"
        @click="emit('cancel')"
      >
        取消剩余
      </button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ModuleGenerationItemStatus, ModuleGenerationUiState } from './api'
import { GENERATION_STATUS_LABELS, generationSummary } from './module-plan-helpers.js'

const props = defineProps<{
  state: ModuleGenerationUiState
  disabled?: boolean
}>()

const emit = defineEmits<{
  retry: [moduleId: string]
  cancel: []
}>()

const summary = computed(() => generationSummary(props.state))

function statusLabel(status: ModuleGenerationItemStatus): string {
  return GENERATION_STATUS_LABELS[status] ?? status
}

/** MF2：失败/已取消/跳过的模块都可以重试（生成结束且非只读时） */
function retryable(item: { status: ModuleGenerationItemStatus }): boolean {
  return item.status === 'error' || item.status === 'cancelled' || item.status === 'skipped'
}
</script>

<style scoped>
.gen-progress {
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  background: var(--rg-surface);
  padding: 9px 10px;
  margin-top: 8px;
  min-width: 0;
}
.gen-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rg-text);
}
.gen-count {
  font-weight: 500;
  color: var(--rg-text-2);
  font-size: 10.5px;
}
.gen-live {
  color: var(--rg-ai);
}
.gen-cancelled {
  color: var(--rg-warn);
}
.gen-failed {
  color: var(--rg-danger);
}
.gen-ok {
  color: var(--rg-ok);
}
.gen-hint {
  margin: 5px 0 7px;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--rg-text-3);
}
.gen-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.gen-item {
  display: flex;
  gap: 7px;
  border: 1px solid var(--rg-border);
  border-radius: 7px;
  padding: 6px 8px;
  background: var(--rg-surface-2);
  min-width: 0;
}
.gen-item.running {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
}
.gen-item.error {
  border-color: var(--rg-danger-border);
  background: var(--rg-danger-soft);
}
.gen-index {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 10px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.gen-main {
  min-width: 0;
  flex: 1;
}
.gen-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
.gen-module {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rg-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.gen-status {
  font-size: 10px;
  border-radius: 999px;
  padding: 0 7px;
  background: var(--rg-fill);
  color: var(--rg-text-3);
}
.gen-status.running {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.gen-status.done {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.gen-status.error {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.gen-status.cancelled,
.gen-status.skipped {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.gen-version {
  font-size: 10px;
  color: var(--rg-text-3);
}
.gen-retry {
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 10px;
  cursor: pointer;
}
.gen-retry:hover {
  border-color: var(--rg-ai-border);
  color: var(--rg-ai);
}
.gen-error {
  margin-top: 3px;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--rg-danger);
  word-break: break-word;
}
.gen-warn {
  margin-top: 3px;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--rg-warn);
}
.gen-global-error {
  margin-top: 6px;
  font-size: 11px;
  color: var(--rg-danger);
}
.gen-foot {
  margin-top: 7px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.gen-note {
  font-size: 10.5px;
  line-height: 1.55;
  color: var(--rg-text-3);
  min-width: 0;
}
.gen-cancel {
  border: 1px solid var(--rg-danger-border);
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 10.5px;
  cursor: pointer;
  flex-shrink: 0;
}
</style>
