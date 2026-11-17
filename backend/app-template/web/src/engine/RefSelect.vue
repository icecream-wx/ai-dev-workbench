<script setup>
import { onMounted, ref } from 'vue'
import { api } from './api'
import { store } from './store'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const options = ref([])
const loading = ref(false)

onMounted(async () => {
  const target = props.field.target
  const entity = (store.manifest?.entities ?? []).find(e => e.id === target)
  if (!entity) return
  loading.value = true
  try {
    const res = await api.list(target, { page: 1, pageSize: 200 })
    const label = entity.labelField ?? entity.pk
    options.value = (res.rows ?? []).map(r => ({ value: String(r[entity.pk]), label: String(r[label] ?? r[entity.pk]) }))
  } catch {
    // 目标资源不可用时展示空选项
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <el-select
    :model-value="modelValue || ''"
    :disabled="disabled"
    :loading="loading"
    filterable
    clearable
    placeholder="请选择"
    style="width: 100%"
    @update:model-value="v => emit('update:modelValue', v ?? '')"
  >
    <el-option v-for="o in options" :key="o.value" :label="o.label" :value="o.value" />
  </el-select>
</template>
