<template>
  <div
    class="split-handle"
    role="separator"
    aria-orientation="vertical"
    :aria-valuenow="valueNow"
    :aria-valuemin="valueMin"
    :aria-valuemax="valueMax"
    :aria-label="label"
    :data-testid="testId"
    tabindex="0"
    @pointerdown="emit('pointerdown', $event)"
    @keydown="emit('keydown', $event)"
    @dblclick="emit('dblclick', $event)"
  >
    <span class="grip" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    valueNow: number
    valueMin: number
    valueMax: number
    label?: string
    testId?: string
  }>(),
  { label: '调整对话栏宽度', testId: 'chat-split' }
)
const emit = defineEmits<{
  pointerdown: [event: PointerEvent]
  keydown: [event: KeyboardEvent]
  dblclick: [event: MouseEvent]
}>()
</script>

<style scoped>
.split-handle {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background: transparent;
  position: relative;
  touch-action: none;
  outline: none;
}
.split-handle::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 2px;
  border-radius: 2px;
  background: transparent;
  transition: background 0.15s ease;
}
.split-handle:hover::before,
.split-handle:focus-visible::before {
  background: var(--rg-ai);
}
.split-handle:focus-visible {
  box-shadow: 0 0 0 2px var(--rg-ai-soft);
}
.grip {
  position: absolute;
  left: 1px;
  top: 50%;
  width: 4px;
  height: 28px;
  margin-top: -14px;
  border-radius: 999px;
  background: var(--rg-border-strong);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.split-handle:hover .grip,
.split-handle:focus-visible .grip {
  opacity: 1;
}
</style>
