<template>
  <div class="composer">
    <div class="composer-inner">
      <textarea
        ref="input"
        :value="modelValue"
        :placeholder="placeholder || '给开发 agent 发消息…  Enter 发送 · Shift+Enter 换行'"
        aria-label="给开发 agent 发消息"
        rows="3"
        :disabled="disabled"
        @input="onInput"
        @keydown="onKeydown"
      />
      <div class="composer-bar">
        <span class="hint">{{ busy ? 'Agent 正在运行，可随时停止或继续追加' : 'Enter 发送 · Shift+Enter 换行' }}</span>
        <div class="actions">
          <el-button v-if="busy" size="small" type="danger" plain @click="emit('stop')">停止</el-button>
          <el-button size="small" type="primary" :disabled="disabled || !modelValue.trim()" @click="emit('send')">发送</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{ modelValue: string; disabled?: boolean; busy?: boolean; placeholder?: string }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  stop: []
}>()
const input = ref<HTMLTextAreaElement | null>(null)

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

/** 输入法组合态（中文候选词确认）不触发发送；keyCode 229 兼容旧版浏览器 */
function composing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || composing(event)) return
  // Shift+Enter 换行；Ctrl/Cmd+Enter 保持兼容（可与 Shift 同时按）
  if (event.shiftKey && !event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  if (!props.disabled && props.modelValue.trim()) emit('send')
}

watch(
  () => props.modelValue,
  async () => {
    await nextTick()
    const element = input.value
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(220, element.scrollHeight)}px`
  }
)

function focus(): void {
  input.value?.focus()
}

defineExpose({ focus })
</script>

<style scoped>
.composer {
  flex-shrink: 0;
  min-width: 0;
  border-top: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface, #fff);
  /* 横向 padding 与 .timeline-scroll 一致，内层才能与 .timeline-content 对齐 */
  padding: 10px 20px 12px;
}
.composer-inner {
  width: min(880px, 100%);
  margin: 0 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
textarea {
  width: 100%;
  resize: none;
  border: 1px solid var(--rg-border-strong, #d4d9e2);
  border-radius: 9px;
  padding: 9px 11px;
  min-height: 68px;
  max-height: 220px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  color: var(--rg-text, #1f2937);
  background: var(--rg-surface-2, #fafbfc);
  outline: none;
}
textarea::placeholder {
  color: var(--rg-text-3, #8a93a3);
}
textarea:focus {
  border-color: var(--rg-ai, #5b5bd6);
  background: var(--rg-surface, #fff);
  box-shadow: 0 0 0 3px var(--rg-ai-soft, #eeeefc);
}
textarea:disabled {
  opacity: 0.6;
  background: var(--rg-fill, #f4f5f7);
  cursor: not-allowed;
}
.composer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.hint {
  font-size: 10.5px;
  color: var(--rg-text-3, #8a93a3);
}
.actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
@media (max-width: 768px) {
  .composer {
    padding: 8px 10px 10px;
  }
  textarea {
    min-height: 56px;
    font-size: 12.5px;
  }
}
</style>
