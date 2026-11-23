<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :aria-label="accessibleLabel"
    :title="title"
    :aria-busy="loading ? 'true' : undefined"
    v-bind="$attrs"
  >
    <span v-if="loading" class="rg-btn__spinner" aria-hidden="true" />
    <el-icon v-else-if="icon" class="rg-btn__icon"><component :is="icon" /></el-icon>
    <span v-if="!iconOnly" class="rg-btn__label"><slot /></span>
  </button>
</template>

<script setup lang="ts">
/**
 * RgButton：工作台统一按钮原语（UI-3a）
 *
 * - 统一 32 / 28 / 36 三档高度、8px 圆角、13px 字号与 hover/active/focus-visible/disabled
 * - `iconOnly` 时只渲染图标，必须配合 `aria-label` 或 `title`（保证可访问名称与 tooltip）
 * - `loading` 显示 spinner，并保留原文字（iconOnly 时只显示 spinner）
 * - `data-testid` / `class` / `style` / aria-* 通过 `$attrs` 透传（testid 与既有 e2e 断言保持不变）
 */
import { computed, type Component } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    icon?: Component
    iconOnly?: boolean
    ariaLabel?: string
    loading?: boolean
    disabled?: boolean
    title?: string
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    icon: undefined,
    iconOnly: false,
    ariaLabel: undefined,
    loading: false,
    disabled: false,
    title: undefined,
    type: 'button'
  }
)

const classes = computed(() => [
  'rg-btn',
  `rg-btn--${props.variant}`,
  `rg-btn--${props.size}`,
  { 'rg-btn--icon': props.iconOnly, 'is-loading': props.loading }
])

/** iconOnly 必须有可访问名称：优先 aria-label，其次 title */
const accessibleLabel = computed(() => props.ariaLabel || (props.iconOnly ? props.title : undefined) || undefined)
</script>
