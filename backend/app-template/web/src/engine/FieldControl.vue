<script setup>
import RefSelect from './RefSelect.vue'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: null, default: undefined },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

function set(value) {
  emit('update:modelValue', value)
}
</script>

<template>
  <el-switch
    v-if="field.type === 'boolean'"
    :model-value="!!modelValue"
    :disabled="disabled"
    @update:model-value="set"
  />
  <el-input-number
    v-else-if="field.type === 'number'"
    :model-value="modelValue ?? undefined"
    :min="field.min"
    :max="field.max"
    :disabled="disabled"
    controls-position="right"
    style="width: 100%"
    @update:model-value="set"
  />
  <el-date-picker
    v-else-if="field.type === 'date'"
    :model-value="modelValue ?? ''"
    type="date"
    value-format="YYYY-MM-DD"
    :disabled="disabled"
    style="width: 100%"
    @update:model-value="set"
  />
  <el-date-picker
    v-else-if="field.type === 'datetime'"
    :model-value="modelValue ?? ''"
    type="datetime"
    value-format="YYYY-MM-DD HH:mm:ss"
    :disabled="disabled"
    style="width: 100%"
    @update:model-value="set"
  />
  <el-time-picker
    v-else-if="field.type === 'time'"
    :model-value="modelValue ?? ''"
    :disabled="disabled"
    style="width: 100%"
    @update:model-value="set"
  />
  <el-select
    v-else-if="field.type === 'enum' && (field.options?.length ?? 0) > 0"
    :model-value="modelValue ?? ''"
    :disabled="disabled"
    clearable
    style="width: 100%"
    @update:model-value="set"
  >
    <el-option v-for="o in field.options ?? []" :key="o" :label="o" :value="o" />
  </el-select>
  <el-input
    v-else-if="field.type === 'enum'"
    :model-value="modelValue ?? ''"
    :disabled="disabled"
    :placeholder="'选项未配置，可手动录入'"
    clearable
    @update:model-value="set"
  />
  <RefSelect
    v-else-if="field.type === 'ref'"
    :field="field"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="set"
  />
  <el-input
    v-else-if="field.type === 'text'"
    :model-value="modelValue ?? ''"
    type="textarea"
    :rows="3"
    :disabled="disabled"
    @update:model-value="set"
  />
  <el-input v-else :model-value="modelValue ?? ''" :disabled="disabled" clearable @update:model-value="set" />
</template>
