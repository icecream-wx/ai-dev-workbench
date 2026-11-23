<template>
  <pm-form-dialog v-model:dialog-visible="dialogVisible" :title="dialogTitle" :width="dialogWidth"
    :loading="saving" @submit="submit">
    <template #form>
      <el-form ref="formRef" class="pt-page goods-form-page application-type-operations visual-style-data-cyan"
        v-bind="bindings.form" :model="form" :rules="rules">
        <FormSection title="基本信息" :columns="formColumns">
          <el-form-item label="商品编码" prop="code">
            <pm-input v-model="form.code" size="default" :disabled="saving" maxlength="32"
              placeholder="如 SP-2026-001" />
          </el-form-item>
          <el-form-item label="商品名称" prop="name">
            <pm-input v-model="form.name" size="default" :disabled="saving" maxlength="64"
              placeholder="请输入商品名称" />
          </el-form-item>
          <el-form-item label="商品分类" prop="category">
            <pm-select v-model="form.category" size="default" :options="categoryOptions"
              :disabled="saving" placeholder="请选择商品分类" />
          </el-form-item>
          <el-form-item label="上架状态" prop="status">
            <pm-select v-model="form.status" size="default" :options="statusOptions"
              :disabled="saving" placeholder="请选择上架状态" />
          </el-form-item>
        </FormSection>

        <FormSection title="价格与库存" :columns="formColumns">
          <el-form-item label="销售单价（元）" prop="price">
            <pm-number v-model="form.price" size="default" :min="0" :precision="2"
              :disabled="saving" />
          </el-form-item>
          <el-form-item label="库存数量" prop="stock">
            <pm-number v-model="form.stock" size="default" :min="0" :precision="0" :disabled="saving" />
          </el-form-item>
        </FormSection>

        <FormSection title="补充说明" :columns="formColumns">
          <el-form-item label="负责人" prop="owner">
            <pm-select-user v-model="form.owner" size="default" clearable :disabled="saving"
              :selected="ownerSelected" placeholder="请选择负责人" />
          </el-form-item>
          <el-form-item label="备注" prop="remark" class="pt-field-full">
            <pm-textarea v-model="form.remark" size="default" :rows="3" :disabled="saving"
              placeholder="补充规格、供货或上架说明" />
          </el-form-item>
        </FormSection>
      </el-form>
    </template>
  </pm-form-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElForm, ElFormItem } from 'element-plus'
import GlobalPreference from '@/preferences/GlobalPreference'
import { FormSection, resolvePagePreferences } from '@/components/PageTemplates/index.js'

const props = defineProps({
  dialogVisible: { type: Boolean, default: false },
  record: { type: Object, default: null },
  // 列表全量记录，用于商品编码唯一性校验（契约 code.unique）。
  records: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:dialogVisible', 'saved'])

// 契约要求表单双列，只在页面 computed 合并，不修改全局偏好单例。
const pagePreference = computed(() => ({
  ...GlobalPreference,
  templates: {
    ...GlobalPreference.templates,
    form: { ...GlobalPreference.templates.form, columns: 2 }
  }
}))
const bindings = computed(() => resolvePagePreferences(pagePreference.value))
const formColumns = computed(() => bindings.value.formPage.columns)
const dialogWidth = computed(() =>
  `min(${formColumns.value === 2 ? 800 : 520}px, calc(100vw - 32px))`)
const dialogTitle = computed(() => (props.record ? '编辑商品' : '新增商品'))
const dialogVisible = computed({
  get: () => props.dialogVisible,
  set: value => emit('update:dialogVisible', value)
})

const categoryOptions = ['电子设备', '办公用品', '耗材配件'].map(value => ({ label: value, value }))
const statusOptions = ['已上架', '已下架', '草稿'].map(value => ({ label: value, value }))

const EMPTY_FORM = {
  code: '',
  name: '',
  category: '电子设备',
  status: '草稿',
  price: null,
  stock: null,
  owner: null,
  remark: ''
}
const form = reactive({ ...EMPTY_FORM })
const formRef = ref(null)
const saving = ref(false)
// 演示数据未接用户服务：以当前值同时作为 id/name 回显；接入宿主后改为真实 selected 对象。
const ownerSelected = computed(() => (form.owner ? { id: form.owner, name: form.owner } : null))

function nonNegativeValidator(label, integer = false) {
  return (rule, value, callback) => {
    if (value === null || value === undefined || value === '') return callback()
    const number = Number(value)
    if (Number.isNaN(number) || number < 0) return callback(new Error(`${label}不能小于 0`))
    if (integer && !Number.isInteger(number)) return callback(new Error(`${label}必须为整数`))
    callback()
  }
}

function validateCode(rule, value, callback) {
  const code = String(value || '').trim()
  if (!code) return callback(new Error('请输入商品编码'))
  const recordId = props.record?.id
  const duplicated = props.records.some(item => item.code === code && item.id !== recordId)
  if (duplicated) return callback(new Error('商品编码已存在'))
  callback()
}

const rules = {
  code: [
    { required: true, message: '请输入商品编码', trigger: 'blur' },
    { validator: validateCode, trigger: ['blur', 'change'] }
  ],
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  price: [{ validator: nonNegativeValidator('销售单价'), trigger: 'change' }],
  stock: [{ validator: nonNegativeValidator('库存数量', true), trigger: 'change' }]
}

watch(
  () => [props.dialogVisible, props.record],
  () => {
    if (props.dialogVisible) resetForm()
  }
)

function resetForm() {
  Object.keys(form).forEach(key => { delete form[key] })
  Object.assign(form, { ...EMPTY_FORM, ...(props.record || {}) })
  nextTick(() => formRef.value?.clearValidate())
}

async function submit() {
  if (saving.value) return
  saving.value = true
  try {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    const saved = {
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      remark: (form.remark || '').trim()
    }
    if (props.record?.id !== undefined) saved.id = props.record.id
    emit('saved', saved)
    emit('update:dialogVisible', false)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.goods-form-page { padding: 0; background: var(--template-surface); }
.goods-form-page :deep(.pt-form-section h3) {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 14px;
  color: var(--template-heading);
  font-size: 15px;
}
.goods-form-page :deep(.pt-form-section h3::before) {
  width: 4px;
  height: 15px;
  border-radius: 2px;
  background: var(--template-primary);
  content: '';
}
.goods-form-page :deep(.el-form-item) { margin-bottom: 16px; }
.goods-form-page :deep(.pt-field-grid) { column-gap: 20px; }
</style>
