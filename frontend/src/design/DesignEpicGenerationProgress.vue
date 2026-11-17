<template>
  <section class="epic-progress" data-testid="epic-progress">
    <header class="progress-head">
      <div class="progress-title">
        按 Epic 生成
        <span class="progress-count">{{ summary.success }}/{{ summary.total }}</span>
        <span v-if="summary.failed" class="progress-failed">失败 {{ summary.failed }}</span>
        <span v-if="summary.skipped" class="progress-skipped">跳过 {{ summary.skipped }}</span>
        <span v-if="running" class="progress-running">生成中…</span>
      </div>
      <div class="progress-actions">
        <button
          v-if="running"
          type="button"
          class="btn small"
          data-testid="epic-progress-stop"
          @click="emit('stop')"
        >
          停止剩余
        </button>
        <button
          v-if="!running && summary.failed"
          type="button"
          class="btn small warn"
          data-testid="epic-progress-retry-all"
          @click="emit('retry-all')"
        >
          重试失败（{{ summary.failed }}）
        </button>
        <button
          v-if="!running"
          type="button"
          class="btn small"
          data-testid="epic-progress-close"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>
    </header>
    <ol class="progress-list">
      <li
        v-for="item in items"
        :key="item.epicId"
        :class="['progress-item', item.status]"
        :data-epic-id="item.epicId"
        data-testid="epic-progress-item"
      >
        <span class="item-key">{{ item.epicId }}</span>
        <span class="item-title" :title="item.title">{{ item.title || '未命名 Epic' }}</span>
        <span :class="['item-status', item.status]" data-testid="epic-progress-status">
          {{ statusLabel(item.status) }}
        </span>
        <span v-if="item.status === 'success'" class="item-meta">
          实体 +{{ item.entitiesAdded }}/改{{ item.entitiesUpdated }} · 页面 {{ item.pages }}
          <span v-if="item.reopened.length"> · 重开 {{ item.reopened.length }}</span>
        </span>
        <span v-else-if="item.status === 'failed'" class="item-error" :title="item.error">{{ item.error }}</span>
        <span v-else-if="item.status === 'skipped'" class="item-meta">已停止，未生成</span>
        <button
          v-if="item.status === 'failed' && !running && !readonly"
          type="button"
          class="btn tiny"
          data-testid="epic-progress-retry"
          @click="emit('retry', item.epicId)"
        >
          重试
        </button>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { epicBatchStatusLabel, epicBatchSummary } from './design-epic-helpers.js'

interface BatchItem {
  epicId: string
  title: string
  status: string
  error: string
  entitiesAdded: number
  entitiesUpdated: number
  pages: number
  reopened: string[]
}

const props = defineProps<{
  items: BatchItem[]
  running?: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{
  stop: []
  retry: [string]
  'retry-all': []
  close: []
}>()

const summary = computed(() => epicBatchSummary(props.items) as {
  total: number
  pending: number
  running: number
  success: number
  failed: number
  skipped: number
  finished: boolean
})

function statusLabel(status: string): string {
  return epicBatchStatusLabel(status)
}
</script>

<style scoped>
.epic-progress {
  flex-shrink: 0;
  border-bottom: 1px solid var(--rg-ai-border);
  background: var(--rg-ai-soft);
  color: var(--rg-text);
  padding: 6px 12px 8px;
}
.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.progress-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rg-ai);
}
.progress-count {
  font-weight: 400;
  font-size: 10.5px;
  color: var(--rg-text-2);
  background: var(--rg-surface);
  border-radius: 999px;
  padding: 0 6px;
}
.progress-failed {
  font-weight: 400;
  font-size: 10.5px;
  color: var(--rg-danger);
}
.progress-skipped {
  font-weight: 400;
  font-size: 10.5px;
  color: var(--rg-warn);
}
.progress-running {
  font-weight: 400;
  font-size: 10.5px;
  color: var(--rg-ai);
}
.progress-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11px;
  cursor: pointer;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.btn.warn {
  color: var(--rg-warn);
  border-color: var(--rg-warn-border);
  background: var(--rg-warn-soft);
}
.btn.tiny {
  min-height: 22px;
  padding: 0 7px;
  font-size: 10px;
}
.btn.small {
  padding: 3px 9px;
  font-size: 11px;
}
.progress-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  max-height: 132px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.progress-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
  color: var(--rg-text-2);
  padding: 2px 4px;
  border-radius: 6px;
  min-width: 0;
}
.progress-item.running {
  background: var(--rg-surface);
}
.item-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 9.5px;
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.item-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--rg-text);
}
.item-status {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 0 6px;
  font-size: 9.5px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.item-status.success {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.item-status.failed {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.item-status.running {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.item-status.skipped {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.item-meta {
  flex-shrink: 0;
  font-size: 9.5px;
  color: var(--rg-text-3);
}
.item-error {
  flex-shrink: 1;
  min-width: 0;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9.5px;
  color: var(--rg-danger);
}
@media (max-width: 768px) {
  .epic-progress {
    padding: 6px 8px;
  }
  .progress-list {
    max-height: 148px;
  }
  .item-meta {
    display: none;
  }
  .btn,
  .btn.small {
    min-height: 30px;
  }
}
</style>
