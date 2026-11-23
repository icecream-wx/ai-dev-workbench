<template>
  <span :class="classes" :title="title" v-bind="$attrs">
    <span v-if="dot" class="rg-chip__dot" aria-hidden="true" />
    <el-icon v-if="icon" class="rg-chip__icon"><component :is="icon" /></el-icon>
    <span class="rg-chip__label"><slot /></span>
  </span>
</template>

<script setup lang="ts">
/**
 * RgChip：工作台统一状态 / 标识 chip 原语（UI-3a）
 *
 * - 24 高（sm 22）、11.5 字号、圆点 + 文案；tone 只复用现有 `--rg-*` token，不新增颜色
 * - `dot` 默认 true；也可传 `icon` 用 Element Plus 图标替代/补充标识
 * - `data-testid` / class / style 通过 `$attrs` 透传（chip 文案与 testid 保持不变）
 */
import { computed, type Component } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    tone?: 'neutral' | 'ai' | 'ok' | 'warn' | 'danger' | 'ink'
    size?: 'sm' | 'md'
    dot?: boolean
    icon?: Component
    title?: string
  }>(),
  {
    tone: 'neutral',
    size: 'md',
    dot: true,
    icon: undefined,
    title: undefined
  }
)

const classes = computed(() => ['rg-chip', `rg-chip--${props.tone}`, `rg-chip--${props.size}`])
</script>
