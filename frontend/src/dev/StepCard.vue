<template>
  <section class="step-card">
    <header class="step-head">
      <span :class="['step-mark', step.status]">{{ step.status === 'failed' ? '!' : step.status === 'running' ? '…' : '✓' }}</span>
      <strong>{{ step.title }}</strong>
      <span class="muted">{{ step.toolCount }} 个工具</span>
      <span v-if="step.durationMs !== null" class="muted">{{ formatDuration(step.durationMs) }}</span>
      <span class="step-targets" v-if="step.targets.length">{{ step.targets.join(' · ') }}</span>
    </header>
    <div class="step-tools">
      <ToolCard v-for="item in step.items" :key="item.id || `${item.messageId}-${item.name}-${item.time.created}`" :item="item" />
    </div>
  </section>
</template>

<script setup lang="ts">
import ToolCard from './ToolCard.vue'
import type { DevStep } from './types'

defineProps<{ step: DevStep }>()

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<style scoped>
.step-card {
  border: 1px solid var(--rg-border, #e4e7ec);
  border-radius: 10px;
  background: var(--rg-surface, #fff);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}
.step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--rg-text-2, #4b5563);
  flex-wrap: wrap;
}
.step-mark {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 10px;
  background: var(--rg-fill-2, #eef0f4);
  color: var(--rg-text-3, #8a93a3);
}
.step-mark.completed {
  background: var(--rg-ok-soft, #e8f5ef);
  color: var(--rg-ok, #12855f);
}
.step-mark.running {
  background: var(--rg-ai-soft, #eeeefc);
  color: var(--rg-ai, #5b5bd6);
}
.step-mark.failed {
  background: var(--rg-danger-soft, #fdeeef);
  color: var(--rg-danger, #c23a45);
}
.step-targets {
  margin-left: auto;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px;
  color: var(--rg-text-3, #8a93a3);
}
.step-tools {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.muted {
  font-size: 10.5px;
  color: var(--rg-text-3, #8a93a3);
}
</style>
