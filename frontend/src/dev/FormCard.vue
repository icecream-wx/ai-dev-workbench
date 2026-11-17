<template>
  <article class="pending-card">
    <header>
      <span class="badge info">表单请求</span>
      <strong>{{ form.title }}</strong>
    </header>
    <div class="fields">
      <label v-for="field in visibleFields" :key="field.key" class="field">
        <span class="label">
          {{ field.title || field.key }}
          <b v-if="field.required">*</b>
        </span>
        <small v-if="field.description">{{ field.description }}</small>
        <el-select
          v-if="field.type === 'string' && field.options?.length"
          v-model="values[field.key] as string"
          size="small"
          :disabled="readonly"
          :placeholder="field.placeholder || '请选择'"
        >
          <el-option v-for="option in field.options" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-input
          v-else-if="field.type === 'string'"
          v-model="values[field.key] as string"
          size="small"
          :disabled="readonly"
          :placeholder="field.placeholder"
        />
        <el-input-number
          v-else-if="field.type === 'number' || field.type === 'integer'"
          v-model="values[field.key] as number"
          size="small"
          :disabled="readonly"
          :step="field.type === 'integer' ? 1 : undefined"
          :precision="field.type === 'integer' ? 0 : undefined"
          :min="field.minimum"
          :max="field.maximum"
        />
        <el-switch v-else-if="field.type === 'boolean'" v-model="values[field.key] as boolean" size="small" :disabled="readonly" />
        <el-select
          v-else-if="field.type === 'multiselect'"
          v-model="values[field.key] as string[]"
          size="small"
          multiple
          :disabled="readonly"
          placeholder="请选择"
        >
          <el-option v-for="option in field.options || []" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-link v-else-if="field.type === 'external'" :href="field.url" target="_blank" rel="noreferrer">
          {{ field.title || field.url }}
        </el-link>
      </label>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="actions">
      <el-button size="small" type="primary" :loading="busy" :disabled="readonly" @click="submit">提交</el-button>
      <span class="hint">{{ readonly ? '只读查看，恢复为当前会话后可提交。' : '表单由 Agent 发起，提交后继续执行' }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormField, FormInfo, FormValue } from './types'

const props = defineProps<{ form: FormInfo; busy?: boolean; readonly?: boolean }>()
const emit = defineEmits<{ submit: [answer: Record<string, FormValue>] }>()

const values = reactive<Record<string, FormValue>>({})
const error = ref('')

function defaultValue(field: FormField): FormValue {
  if (field.default !== undefined) return field.default
  if (field.type === 'boolean') return false
  if (field.type === 'multiselect') return []
  return ''
}

function reset(): void {
  for (const key of Object.keys(values)) delete values[key]
  for (const field of props.form.fields) values[field.key] = defaultValue(field)
  error.value = ''
}
reset()
watch(() => props.form.id, reset)

function visible(field: FormField): boolean {
  if (field.hidden) return false
  return (field.when ?? []).every(condition => {
    const current = values[condition.key]
    return condition.op === 'eq' ? String(current) === String(condition.value) : String(current) !== String(condition.value)
  })
}

const visibleFields = computed(() => props.form.fields.filter(visible))

function validate(): string {
  for (const field of visibleFields.value) {
    if (field.type === 'external') continue
    const value = values[field.key]
    const label = field.title || field.key
    if (field.required) {
      if (field.type === 'multiselect' && (!Array.isArray(value) || !value.length)) return `${label} 至少选择一项`
      if (field.type === 'boolean' && !value) return `${label} 需要勾选`
      if (field.type !== 'multiselect' && field.type !== 'boolean' && (value === '' || value === null || value === undefined)) {
        return `${label} 不能为空`
      }
    }
    if ((field.type === 'number' || field.type === 'integer') && value !== '' && value !== null && value !== undefined && !Number.isFinite(Number(value))) {
      return `${label} 需要是数字`
    }
    if (field.type === 'multiselect' && Array.isArray(value)) {
      if (field.minItems !== undefined && value.length < field.minItems) return `${label} 至少选择 ${field.minItems} 项`
      if (field.maxItems !== undefined && value.length > field.maxItems) return `${label} 最多选择 ${field.maxItems} 项`
    }
  }
  return ''
}

function submit(): void {
  error.value = validate()
  if (error.value) return
  const answer: Record<string, FormValue> = {}
  for (const field of visibleFields.value) {
    if (field.type === 'external') continue
    const value = values[field.key]
    answer[field.key] = (field.type === 'number' || field.type === 'integer') && value !== '' ? Number(value) : value
  }
  emit('submit', answer)
}
</script>

<style scoped>
.pending-card {
  border: 1px solid var(--rg-ai-border, #d9d9f7);
  background: var(--rg-ai-soft, #eeeefc);
  border-radius: 10px;
  padding: 11px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  flex-wrap: wrap;
}
.badge {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10.5px;
  background: var(--rg-surface, #fff);
  color: var(--rg-ai, #5b5bd6);
  border: 1px solid var(--rg-ai-border, #d9d9f7);
}
.fields {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.label {
  font-size: 11.5px;
  color: var(--rg-text-2, #4b5563);
  font-weight: 500;
}
.label b {
  color: var(--rg-danger, #c23a45);
}
.field small {
  font-size: 10.5px;
  color: var(--rg-text-3, #8a93a3);
}
.error {
  margin: 0;
  font-size: 11.5px;
  color: var(--rg-danger, #c23a45);
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.hint {
  font-size: 10.5px;
  color: var(--rg-text-3, #8a93a3);
}
</style>
