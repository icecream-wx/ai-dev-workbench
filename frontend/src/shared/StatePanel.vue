<template>
  <section
    :class="['state-panel', `is-${variant}`, { compact }]"
    :data-testid="testId || `state-${variant}`"
    :data-state="variant"
    :role="variant === 'error' ? 'alert' : variant === 'loading' ? 'status' : undefined"
    :aria-live="variant === 'loading' ? 'polite' : undefined"
    :aria-busy="variant === 'loading' ? 'true' : undefined"
  >
    <template v-if="variant === 'loading'">
      <div v-if="title || description" class="sp-loading-head">
        <p v-if="title" class="sp-title">{{ title }}</p>
        <p v-if="description" class="sp-desc">{{ description }}</p>
      </div>
      <div class="sp-skeleton" aria-hidden="true">
        <div v-if="skeleton === 'list'" class="sk-list">
          <div v-for="n in lineCount" :key="n" class="sk-row">
            <span class="sk-avatar" />
            <div class="sk-lines">
              <span class="sk-line w-60" />
              <span class="sk-line w-90" />
            </div>
          </div>
        </div>
        <div v-else-if="skeleton === 'doc'" class="sk-doc">
          <span class="sk-line sk-doc-title w-45" />
          <span
            v-for="n in lineCount"
            :key="n"
            :class="['sk-line', n === lineCount ? 'w-65' : 'w-100']"
          />
        </div>
        <div v-else-if="skeleton === 'canvas'" class="sk-canvas">
          <span class="sk-line w-30" />
          <div class="sk-card-grid">
            <span v-for="n in 3" :key="n" class="sk-card" />
          </div>
          <span class="sk-line w-100" />
          <span class="sk-line w-80" />
          <span class="sk-line w-90" />
        </div>
        <div v-else class="sk-timeline">
          <div v-for="n in lineCount" :key="n" class="sk-tl-card">
            <span class="sk-tl-dot" />
            <div class="sk-lines">
              <span class="sk-line w-40" />
              <span class="sk-line w-100" />
              <span class="sk-line w-70" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div v-if="resolvedIcon" :class="['sp-icon', `tone-${variant}`]" aria-hidden="true">
        <el-icon><component :is="resolvedIcon" /></el-icon>
      </div>
      <h3 v-if="title" class="sp-title">{{ title }}</h3>
      <p v-if="$slots.default || description" class="sp-desc">
        <slot>{{ description }}</slot>
      </p>
      <div v-if="$slots.meta" class="sp-meta">
        <slot name="meta" />
      </div>
      <div v-if="$slots.examples" class="sp-examples">
        <slot name="examples" />
      </div>
      <div v-if="$slots.actions" class="sp-actions">
        <slot name="actions" />
      </div>
      <details v-if="$slots.details" class="sp-details">
        <summary>技术详情</summary>
        <div class="sp-details-body"><slot name="details" /></div>
      </details>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Box, WarningFilled } from '@element-plus/icons-vue'

const props = withDefaults(
  defineProps<{
    variant?: 'empty' | 'error' | 'loading'
    title?: string
    description?: string
    /** Element Plus 图标组件；缺省按 variant 使用轻量图标 */
    icon?: Component
    testId?: string
    compact?: boolean
    loadingLines?: number
    skeleton?: 'list' | 'doc' | 'canvas' | 'timeline'
  }>(),
  {
    variant: 'empty',
    compact: false,
    skeleton: 'list'
  }
)

const resolvedIcon = computed<Component | null>(() => {
  if (props.variant === 'loading') return null
  if (props.icon) return props.icon
  return props.variant === 'error' ? WarningFilled : Box
})

const lineCount = computed(() => {
  if (props.loadingLines && props.loadingLines > 0) return props.loadingLines
  if (props.skeleton === 'doc') return 4
  return 3
})
</script>

<style scoped>
.state-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rg-space-2);
  width: 100%;
  min-width: 0;
  padding: var(--rg-space-6) var(--rg-space-5);
  text-align: center;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius-lg);
  background: var(--rg-surface);
  color: var(--rg-text-2);
}
.state-panel.is-empty {
  border-style: dashed;
  border-color: var(--rg-border-strong);
  background: var(--rg-surface-2);
}
.state-panel.is-error {
  border-color: var(--rg-danger-border);
  background: var(--rg-surface);
}
.state-panel.is-loading {
  align-items: stretch;
  border-color: var(--rg-border);
  background: var(--rg-surface);
}
.state-panel.compact {
  padding: var(--rg-space-4);
  gap: var(--rg-space-1);
  border-radius: var(--rg-radius);
}
.sp-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-bottom: var(--rg-space-1);
  border-radius: 10px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  font-size: 17px;
}
.sp-icon.tone-error {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.compact .sp-icon {
  width: 28px;
  height: 28px;
  font-size: 14px;
}
.sp-title {
  margin: 0;
  font-size: 14.5px;
  line-height: var(--rg-leading-title);
  font-weight: 600;
  color: var(--rg-text);
}
.state-panel.compact .sp-title {
  font-size: 13.5px;
}
.state-panel.is-error .sp-title {
  color: var(--rg-danger);
}
.sp-desc {
  margin: 0;
  max-width: 58ch;
  font-size: 12.5px;
  line-height: var(--rg-leading-body);
  color: var(--rg-text-2);
}
.compact .sp-desc {
  font-size: 12px;
}
.sp-desc :slotted(code) {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11.5px;
  background: var(--rg-fill-2);
  border-radius: 4px;
  padding: 1px 5px;
  overflow-wrap: anywhere;
}
.sp-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--rg-space-1);
  width: 100%;
  max-width: 560px;
  min-width: 0;
}
.sp-examples,
.sp-actions {
  width: 100%;
  max-width: 560px;
}
.sp-examples {
  margin-top: var(--rg-space-1);
  text-align: left;
}
.sp-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--rg-space-2);
  margin-top: var(--rg-space-2);
}
.compact .sp-actions {
  margin-top: var(--rg-space-1);
}
.sp-details {
  width: 100%;
  max-width: 560px;
  margin-top: var(--rg-space-1);
  text-align: left;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.sp-details summary {
  cursor: pointer;
  width: fit-content;
  border-radius: 4px;
  padding: 1px 2px;
}
.sp-details summary:focus-visible {
  outline: 2px solid var(--rg-focus-ring);
  outline-offset: 2px;
}
.sp-details-body {
  margin-top: var(--rg-space-2);
}
.sp-details :slotted(pre),
.sp-details :slotted(p) {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
  color: var(--rg-text-2);
  background: var(--rg-fill);
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  padding: 8px 10px;
}

/* ---- loading skeleton ---- */
.sp-loading-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--rg-space-2);
}
.sp-loading-head .sp-title {
  font-size: 13px;
  font-weight: 550;
  color: var(--rg-text-2);
}
.sp-loading-head .sp-desc {
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.sp-skeleton {
  width: 100%;
  min-width: 0;
}
.sk-list,
.sk-timeline {
  display: flex;
  flex-direction: column;
  gap: var(--rg-space-2);
}
.sk-row,
.sk-tl-card {
  display: flex;
  align-items: flex-start;
  gap: var(--rg-space-3);
  padding: 10px 12px;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  background: var(--rg-surface-2);
  min-width: 0;
}
.sk-avatar {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background: var(--rg-fill-2);
}
.sk-tl-card {
  position: relative;
  padding-left: 26px;
}
.sk-tl-dot {
  position: absolute;
  left: 12px;
  top: 15px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--rg-border-strong);
}
.sk-lines {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sk-doc {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 14px 16px;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  background: var(--rg-surface-2);
}
.sk-doc-title {
  height: 14px !important;
  margin-bottom: 4px;
}
.sk-canvas {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  background: var(--rg-surface-2);
}
.sk-card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 4px 0 6px;
}
.sk-card {
  height: 54px;
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  background: var(--rg-surface);
}
.sk-line {
  display: block;
  height: 8px;
  max-width: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--rg-fill-2) 0%, var(--rg-fill) 50%, var(--rg-fill-2) 100%);
  background-size: 200% 100%;
  animation: rg-skeleton 1.4s ease-in-out infinite;
}
.sk-line.w-30 {
  width: 30%;
}
.sk-line.w-40 {
  width: 40%;
}
.sk-line.w-45 {
  width: 45%;
}
.sk-line.w-60 {
  width: 60%;
}
.sk-line.w-65 {
  width: 65%;
}
.sk-line.w-70 {
  width: 70%;
}
.sk-line.w-80 {
  width: 80%;
}
.sk-line.w-90 {
  width: 90%;
}
.sk-line.w-100 {
  width: 100%;
}
@keyframes rg-skeleton {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk-line {
    animation: none;
  }
}

@media (max-width: 560px) {
  .state-panel {
    padding: var(--rg-space-5) var(--rg-space-4);
  }
  .sk-card-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .sk-card {
    height: 38px;
  }
}
</style>
