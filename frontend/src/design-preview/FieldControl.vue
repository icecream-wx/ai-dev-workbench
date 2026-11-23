<template>
  <pm-select-user v-if="control === 'select-user'" v-model="model" size="default" />
  <pm-select-org v-else-if="control === 'select-org'" v-model="model" size="default" />
  <pm-select
    v-else-if="control === 'select'"
    v-model="model"
    size="default"
    :options="options"
    clearable
    :placeholder="`请选择${label}`"
    style="width: 100%"
  />
  <pm-radio v-else-if="control === 'radio'" v-model="model" size="default" :settings="settings" />
  <pm-checkbox v-else-if="control === 'checkbox'" v-model="model" size="default" :settings="settings" />
  <pm-number v-else-if="control === 'number'" v-model="model" size="default" :min="0" />
  <pm-switch v-else-if="control === 'boolean'" v-model="model" size="default" />
  <pm-datepicker
    v-else-if="control === 'date'"
    v-model="model"
    size="default"
    type="date"
    value-format="YYYY-MM-DD"
    :placeholder="`请选择${label}`"
  />
  <pm-datepicker
    v-else-if="control === 'datetime'"
    v-model="model"
    size="default"
    type="datetime"
    value-format="YYYY-MM-DD HH:mm:ss"
    :placeholder="`请选择${label}`"
  />
  <pm-textarea v-else-if="control === 'textarea'" v-model="model" size="default" :rows="3" :placeholder="`请输入${label}`" />
  <pm-upload v-else-if="control === 'upload'" v-model="model" size="default" :headers="{}" />
  <pm-image v-else-if="control === 'image'" v-model="model" img-width="120px" img-height="80px" />
  <pm-input v-else v-model="model" size="default" clearable :placeholder="`请输入${label}`" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { selectOptionsOf } from './contract-preview.js'

/**
 * 契约字段 → pm-v3 控件（P9）
 *
 * 控件由 `contract-preview.js#controlOf` 决定：契约 components 覆盖 > 类型/命名推断。
 * 未知控件回退 pm-input；不伪造组件。
 */
const props = defineProps<{
  field: { name: string; label?: string; type?: string; options?: string[] }
  control?: string
}>()

const model = defineModel<unknown>({ default: null })

const options = computed(() => selectOptionsOf(props.field))
const settings = computed(() => ({ type: 'custom', options: options.value }))
const label = computed(() => props.field?.label || props.field?.name || '')
</script>
