<template>
  <section class="guide-card" data-testid="module-guidance-card">
    <header class="guide-head">
      <span class="guide-badge">模块操作</span>
      <strong>模块操作请用专用入口</strong>
      <span v-if="stageLabel" class="guide-stage">{{ stageLabel }}</span>
    </header>
    <p class="guide-text" data-testid="module-guidance-text">{{ content }}</p>
    <div class="guide-actions">
      <button
        v-for="item in buttons"
        :key="item.action"
        type="button"
        :class="['guide-btn', { primary: item.enabled }]"
        :data-testid="`guide-${item.action}`"
        :disabled="!item.enabled || busy"
        :title="item.title"
        @click="emit('action', item.action)"
      >
        {{ item.label }}
      </button>
    </div>
    <p class="guide-foot">本条消息没有修改任何文档，也不会产生新版本。</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DocChatMetadata } from './api'
import { guidanceButtonState } from './module-intent.js'

const props = defineProps<{
  content: string
  metadata: DocChatMetadata
  /** 生成中/只读时禁用所有动作 */
  busy?: boolean
}>()

const emit = defineEmits<{ action: [string] }>()

const buttons = computed(() => guidanceButtonState(props.metadata?.suggestions ?? []))
const stageLabel = computed(() => {
  const stage = props.metadata?.stage
  if (stage === 'design') return '设计阶段'
  if (stage === 'development') return '开发/完成阶段'
  return '需求阶段'
})
</script>

<style scoped>
.guide-card {
  width: 100%;
  border: 1px solid var(--rg-warn-border);
  background: var(--rg-warn-soft);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.guide-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  font-size: 12.5px;
  color: var(--rg-text);
}
.guide-badge {
  font-size: 10px;
  font-weight: 600;
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-warn);
  color: var(--rg-ink-contrast);
}
.guide-stage {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.guide-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  color: var(--rg-text-2);
}
.guide-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.guide-btn {
  min-height: 28px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 11.5px;
  cursor: pointer;
}
.guide-btn.primary {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  font-weight: 600;
}
.guide-btn:hover:not(:disabled) {
  border-color: var(--rg-ai);
}
.guide-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.guide-foot {
  margin: 0;
  font-size: 10.5px;
  color: var(--rg-text-3);
}
@media (max-width: 768px) {
  .guide-btn {
    min-height: 30px;
  }
}
</style>
