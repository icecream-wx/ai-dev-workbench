<template>
  <div>
    <el-switch
      :disabled="disabled || readonly"
      v-if="displayStyle === 'switch'"
      v-bind="$attrs"
      v-model="valueData"
      :active-value="active"
      :inactive-value="inactive"
    />
    <el-checkbox
      v-else
      :disabled="disabled || readonly"
      v-model="valueData"
      :true-label="active"
      :false-label="inactive"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

/**
 * 开关组件，基于 el-switch 封装的开关切换组件，支持 edit/view 双模式
 */
const props = defineProps({
  modelValue: { default: '' },
  displayStyle: { type: String, default: 'switch' },
  activeValue: { default: 'true' },
  inactiveValue: { default: 'false' },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const active = ref('')
const inactive = ref('')

watch(() => props.activeValue, (val) => {
  if (val || val == 0 || val === false) {
    active.value = val + ''
  }
}, { immediate: true })

watch(() => props.inactiveValue, (val) => {
  if (val || val == 0 || val === false) {
    inactive.value = val + ''
  }
}, { immediate: true })

const valueData = computed({
  get() {
    if (props.modelValue || props.modelValue == 0 || props.modelValue === false) {
      return props.modelValue + ''
    }
    return ''
  },
  set(val) {
    emit('update:modelValue', val)
  },
})
</script>

<style lang="scss" scoped></style>
