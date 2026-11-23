<template>
  <div :class="classes">
    <div :class="barConClasses">
      <i v-for="i in 8" :key="`trigger-${i}`" :class="`${prefix}-bar`" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  mode: { type: String, default: '' },
})

const prefix = 'pm-split-trigger'

const isVertical = computed(() => props.mode === 'vertical')

const classes = computed(() => [
  prefix,
  isVertical.value ? `${prefix}-vertical` : `${prefix}-horizontal`,
])

const barConClasses = computed(() => [
  `${prefix}-bar-con`,
  isVertical.value ? 'vertical' : 'horizontal',
])
</script>
