<template>
  <el-form :model="model" label-position="top" class="contract-form">
    <section v-for="(group, index) in visibleGroups" :key="`${group.title}-${index}`" class="form-section">
      <h3 v-if="group.title" class="form-section-title">
        <b>{{ pad(groupOffset + index + 1) }}</b>
        {{ group.title }}
      </h3>
      <div :class="['form-grid', { 'form-grid--single': form.columns === 1 }]">
        <el-form-item
          v-for="field in group.fields"
          :key="field.name"
          :label="field.label || field.name"
          :required="field.required === true"
          :prop="field.name"
        >
          <FieldControl v-model="model[field.name]" :field="field" :control="controlOf(field, page)" />
        </el-form-item>
      </div>
    </section>
    <div v-if="showActions && formActions.length" class="form-actions">
      <el-button
        v-for="action in formActions"
        :key="action.code"
        :type="action.primary ? 'primary' : undefined"
        @click="emit('action', action.label)"
      >
        {{ action.label }}
      </el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FieldControl from './FieldControl.vue'
import { actionLabel, controlOf } from './contract-preview.js'

/**
 * 契约表单字段（P9/P10b）：form.groups → 模板 `form-section`/`form-grid` + pm 控件。
 * page-form 直接放在 `.panel.form-panel`，dialog-form 放进 pm-form-dialog 的 `#form` 插槽；
 * `onlyGroup` 用于 wizard 只渲染当前步骤分组。
 */
const props = defineProps<{
  page: any
  form: any
  model: Record<string, any>
  showActions?: boolean
  /** 只渲染某一个分组（分步表单当前步骤） */
  onlyGroup?: number
}>()

const emit = defineEmits<{ (event: 'action', label: string): void }>()

const groupOffset = computed(() =>
  Number.isInteger(props.onlyGroup) && Number(props.onlyGroup) >= 0 ? Number(props.onlyGroup) : 0
)

const visibleGroups = computed(() => {
  const groups = Array.isArray(props.form?.groups) ? props.form.groups : []
  if (!Number.isInteger(props.onlyGroup) || Number(props.onlyGroup) < 0) return groups
  return groups.slice(groupOffset.value, groupOffset.value + 1)
})

const formActions = computed(() => {
  const raw = Array.isArray(props.page?.spec?.actions) ? props.page.spec.actions.map(String) : []
  const codes = raw.length ? raw : ['submit', 'cancel']
  const secondary = ['cancel', '取消']
  return codes.map(code => ({ code, label: actionLabel(code), primary: !secondary.includes(code) }))
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
</script>

<style scoped>
.form-grid--single {
  grid-template-columns: 1fr;
}
.contract-form :deep(.el-form-item) {
  margin-bottom: 12px;
}
.contract-form :deep(.form-section) {
  padding-bottom: 10px;
}
.contract-form :deep(.form-section + .form-section) {
  padding-top: 10px;
}
.contract-form :deep(.form-section-title) {
  margin-bottom: 12px;
}
.contract-form :deep(.form-actions) {
  padding-top: 12px;
}
</style>
