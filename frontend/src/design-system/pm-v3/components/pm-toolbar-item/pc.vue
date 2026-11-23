<template>
  <component :is="inGroup ? 'el-dropdown-item' : 'el-button'" v-bind="$attrs" :command="inGroup ? handleClick : undefined" @click="!inGroup && handleClick($event)">
    <slot />
  </component>
</template>

<script setup>
import { inject } from 'vue'

/**
 * 工具栏项组件，定义工具栏中的单个操作按钮项
 */
defineOptions({ inheritAttrs: true })
const emit = defineEmits(['click'])
const inGroup = inject('inGroup', false)

function handleClick(event) {
  emit('click', event)
}
</script>
