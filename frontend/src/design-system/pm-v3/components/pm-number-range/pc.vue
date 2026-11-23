<template>
  <div style="display: flex; width: 100%">
    <null-value v-if="modelValue == null && ($attrs.disabled || $attrs.readonly)" v-bind="$attrs" />
    <el-input-number v-else v-bind="$attrs" v-model="localStart" @change="numberChange" controls-position="right" style="width: 50%" />
    <span style="line-height: 1; padding-top: 7px">&nbsp;~&nbsp;</span>
    <null-value v-if="value2 == null && ($attrs.disabled || $attrs.readonly)" v-bind="$attrs" />
    <el-input-number v-else v-bind="$attrs" v-model="localEnd" @change="numberChange" controls-position="right" :placeholder="placeholder2" style="width: 50%" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import NullValue from '../../components/pm-null-value/pc.vue'

/**
 * 数字范围输入组件，支持最小值和最大值的范围输入
 */
const props = defineProps({
  modelValue: { default: null },
  value2: { default: null },
  separator: { type: String, default: ',' },
  placeholder2: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'update:value2'])

const localStart = computed({
  get: () => props.modelValue ?? null,
  set: (val) => emit('update:modelValue', val ?? null),
})

const localEnd = computed({
  get: () => props.value2 ?? null,
  set: (val) => emit('update:value2', val ?? null),
})

const numberChange = () => {
  if (localStart.value != null && localEnd.value != null && localEnd.value < localStart.value) {
    ElMessage.warning('结束数字不可小于开始数字！')
    localEnd.value = null
  }
}
</script>
