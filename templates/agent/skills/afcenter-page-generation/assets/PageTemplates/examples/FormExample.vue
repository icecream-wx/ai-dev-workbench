<template>
  <div class="pt-page" :data-density="bindings.formPage.density">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-form ref="formRef" v-bind="bindings.form" :model="form" :rules="rules"
        :class="{ 'pt-form-view': viewAsText }" :disabled="disabled || saving" :hide-required-asterisk="viewAsText">
        <FormSection :columns="bindings.formPage.columns">
          <el-form-item label="编号" prop="code">
            <span v-if="viewAsText" class="pt-form-view-text">{{ form.code || '--' }}</span>
            <el-input v-else v-bind="bindings.text" v-model.trim="form.code" :disabled="Boolean(data)" maxlength="32" />
          </el-form-item>
          <el-form-item label="名称" prop="name">
            <span v-if="viewAsText" class="pt-form-view-text">{{ form.name || '--' }}</span>
            <el-input v-else v-bind="bindings.text" v-model.trim="form.name" maxlength="64" />
          </el-form-item>
          <el-form-item label="描述" prop="description" class="pt-field-full">
            <span v-if="viewAsText" class="pt-form-view-text">{{ form.description || '--' }}</span>
            <el-input v-else v-bind="bindings.textarea" v-model="form.description" type="textarea" :rows="3" maxlength="200" />
          </el-form-item>
        </FormSection>
      </el-form>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElAlert, ElForm, ElFormItem, ElInput } from 'element-plus'
import { FormSection, resolvePagePreferences } from '../index.js'

const props = defineProps({
  preference: { type: Object, default: () => ({}) },
  data: { type: Object, default: null },
  // 查看模式：整个表单禁用，布局与新增/编辑完全一致。
  // 本示例字段为原生 el-input，el-form 的禁用上下文可直接生效；
  // 使用 pm- 封装组件时因其声明 disabled prop（默认 false）会短路表单上下文，需逐组件显式绑定。
  disabled: { type: Boolean, default: false },
  save: { type: Function, required: true }
})
const emit = defineEmits(['success', 'update:loading'])
const bindings = computed(() => resolvePagePreferences(props.preference))
// 查看态且偏好 viewDisplay=text 时，字段只显示内容文本，不渲染输入组件。
const viewAsText = computed(() => props.disabled && bindings.value.view.display === 'text')
const formRef = ref(null)
const saving = ref(false)
const error = ref('')
const form = reactive({ code: '', name: '', description: '' })
const rules = {
  code: [{ required: true, message: '请输入编号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }]
}

watch(() => props.data, data => {
  // Remove old record identity when switching from edit to create.
  Object.keys(form).forEach(key => { delete form[key] })
  Object.assign(form, { code: '', name: '', description: '' }, data || {})
  error.value = ''
  formRef.value?.clearValidate()
}, { immediate: true })

async function submit() {
  if (saving.value) return
  saving.value = true
  emit('update:loading', true)
  error.value = ''
  try {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    const saved = await props.save({ ...form })
    emit('success', saved)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '保存失败，请重试'
  } finally {
    saving.value = false
    emit('update:loading', false)
  }
}
defineExpose({ submit })
</script>
<!-- Modified by AI on 2026-11-09 14:53:21 -->