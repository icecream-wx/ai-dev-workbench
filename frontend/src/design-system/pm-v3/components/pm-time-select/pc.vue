<template>
  <div>
    <span v-if="mode === 'view'">{{ _value || nullLabel }}</span>
    <template v-else-if="mode === 'edit'">
      <null-value v-if="!modelValue && ($attrs.disabled || $attrs.readonly)" :disabled="$attrs.disabled" :readonly="$attrs.readonly" />
      <el-time-picker
        v-else
        style="width: 100%"
        v-model="localValue"
        v-bind="$attrs"
        format="HH:mm:ss"
        :value-format="localValueFormat"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * 时间选择器组件，基于 el-time-select 封装，支持时间点选择和时段限制
 */
const props = defineProps({
  modelValue: { default: null },
  value: { default: undefined },
  valueFormat: { type: String, default: 'HH:mm:ss' },
  mode: { type: String, default: 'edit' },
  nullLabel: { type: String, default: '--' },
})

const emit = defineEmits(['update:modelValue'])

const _value = computed(() => props.modelValue !== undefined ? props.modelValue : props.value)

const localValue = computed({
  get() {
    return _value.value || null
  },
  set(val) {
    emit('update:modelValue', val)
  },
})

const localValueFormat = computed(() => {
  return _value.value && _value.value.split(':').length == 2 ? 'HH:mm' : props.valueFormat
})
</script>

<style lang="scss" scoped>
:deep(.el-input__prefix) {
  i.el-input__icon.el-icon-time {
    font-size: 14px;
    color: #999999;
  }
}
</style>
