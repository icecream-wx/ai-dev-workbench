<template>
<div style="width: 100%;">
    <el-input :value="formatNullValue" v-bind="$attrs"></el-input>
</div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { getLowCodePreferenceObject } from '../../utils/util'

/**
 * 空值占位组件，在空数据时展示统一的占位符样式
 */
const formatNullValue = computed(() => {
  const preferenceObject = getLowCodePreferenceObject()
  return preferenceObject?.formConf?.formatNullValue || ''
})
</script>

<style lang="scss" scoped>
</style>