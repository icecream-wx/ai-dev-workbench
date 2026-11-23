<template>
  <pm-search
    class="contract-search"
    v-model:query="query"
    :default-prop="defaultProp"
    :placeholder="placeholder"
    @search="emit('search')"
  >
    <template #body>
      <el-form-item
        v-for="field in fields"
        :key="field.name"
        :label="field.label || field.name"
        :prop="field.name"
      >
        <FieldControl v-model="query[field.name]" :field="field" :control="controlOf(field, page)" />
      </el-form-item>
    </template>
  </pm-search>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FieldControl from './FieldControl.vue'
import { controlOf } from './contract-preview.js'

/**
 * 契约查询条（P9）：pm-search + 按字段类型映射的 pm 控件。
 *
 * 与模板页面用法一致：`v-model:query` 与 `#body` 里的 el-form-item 组合，
 * pm-search 负责收起态标签与高级搜索面板。
 */
const props = defineProps<{
  page: any
  fields?: any[]
  placeholder?: string
  defaultProp?: string
}>()

const emit = defineEmits<{ (event: 'search'): void }>()

const query = defineModel<Record<string, any>>('query', { default: () => ({}) })

const fields = computed(() => (Array.isArray(props.fields) ? props.fields : []))
const placeholder = computed(() => props.placeholder || '输入关键词后回车搜索')
const defaultProp = computed(() => props.defaultProp || (fields.value[0]?.name ?? 'keyword'))
</script>
