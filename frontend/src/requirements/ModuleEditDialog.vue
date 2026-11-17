<template>
  <el-dialog
    :model-value="modelValue"
    :title="mode === 'create' ? '新增需求模块' : '编辑需求模块'"
    width="min(520px, calc(100vw - 32px))"
    append-to-body
    class="module-edit-dialog"
    @update:model-value="emit('update:modelValue', $event)"
    @open="reset"
  >
    <div class="med-form">
      <label class="med-field">
        <span>模块名称</span>
        <el-input v-model="title" size="small" maxlength="120" show-word-limit placeholder="如：订单管理 / 库存管理" />
      </label>
      <label class="med-field">
        <span>负责人（自由文本标签，不是权限）</span>
        <el-input v-model="ownerLabel" size="small" maxlength="60" placeholder="如：张三 / 产品组" />
      </label>
      <label class="med-field">
        <span>描述</span>
        <el-input v-model="description" type="textarea" :rows="3" maxlength="200" placeholder="一句话说明该模块覆盖的业务范围" />
      </label>
      <label class="med-required">
        <el-checkbox v-model="required">必选模块（完成需求阶段前必须确认）</el-checkbox>
      </label>
      <p class="med-tip">
        每个模块有独立的文档、章节、版本和确认状态；模板在应用级共享（切换时所有未归档模块一起跟随）。
      </p>
      <p v-if="error" class="med-error">{{ error }}</p>
    </div>
    <template #footer>
      <div class="med-footer">
        <el-button size="small" :disabled="saving" @click="emit('update:modelValue', false)">取消</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="submit">
          {{ mode === 'create' ? '创建模块' : '保存' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { RequirementModule } from './api'

const props = defineProps<{
  modelValue: boolean
  mode: 'create' | 'edit'
  module?: RequirementModule | null
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  save: [{ title: string; description: string; ownerLabel: string; required: boolean }]
}>()

const title = ref('')
const description = ref('')
const ownerLabel = ref('')
const required = ref(true)
const error = ref('')

function reset(): void {
  error.value = ''
  title.value = props.mode === 'edit' ? props.module?.title ?? '' : ''
  description.value = props.mode === 'edit' ? props.module?.description ?? '' : ''
  ownerLabel.value = props.mode === 'edit' ? props.module?.ownerLabel ?? '' : ''
  required.value = props.mode === 'edit' ? props.module?.required !== false : true
}

function submit(): void {
  error.value = ''
  const value = title.value.trim()
  if (!value) {
    error.value = '模块名称不能为空'
    return
  }
  if (value.length > 120) {
    error.value = '模块名称不能超过 120 字'
    return
  }
  emit('save', {
    title: value,
    description: description.value.trim(),
    ownerLabel: ownerLabel.value.trim(),
    required: required.value
  })
}
</script>

<style scoped>
.med-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.med-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11.5px;
  color: var(--rg-text-2);
}
.med-required {
  font-size: 12px;
  color: var(--rg-text-2);
}
.med-tip {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--rg-text-3);
}
.med-error {
  margin: 0;
  border: 1px solid var(--rg-danger-border);
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11.5px;
}
.med-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 768px) {
  .med-footer .el-button {
    min-height: 32px;
  }
}
</style>
