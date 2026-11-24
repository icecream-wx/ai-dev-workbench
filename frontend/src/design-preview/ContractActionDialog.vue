<template>
  <div class="contract-action-mask" data-testid="contract-action-dialog" @click.self="emit('cancel')">
    <div class="contract-action-card rg-panel">
      <pm-form-dialog
        :dialog-visible="true"
        :title="title"
        :width="`${width}px`"
        :modal="false"
        :append-to-body="false"
        :show-footer="false"
        :show-full-screen-button="false"
        @update:dialog-visible="onVisible"
        @cancel="emit('cancel')"
      >
        <template #form>
          <div v-if="temporary" class="contract-action-temporary" data-testid="contract-action-temporary">
            临时表单 · 未设计表单页
            <span>仅用于交互预览，建议让 AI 补表单页或 actionTargets。</span>
          </div>
          <ContractFormFields :page="page" :form="form" :model="model" />
        </template>
      </pm-form-dialog>
      <div class="contract-action-footer">
        <el-button data-testid="contract-action-cancel" @click="emit('cancel')">取消</el-button>
        <el-button type="primary" data-testid="contract-action-submit" @click="emit('submit')">提交</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import ContractFormFields from './ContractFormFields.vue'
import { actionLabel, buildForm } from './contract-preview.js'

/**
 * B5 交互预览层的表单弹窗（不写数据、不调接口）
 *
 * - create：空表单；edit：用当前行预填；
 * - 外层自定义 fixed 遮罩 + 居中卡片（保留模板视觉类，避免 append-to-body 丢 CSS）；
 * - 内部 pm-form-dialog 只负责标题/结构，提交/取消由本组件按钮 emit 给宿主。
 */
const props = defineProps<{
  page: any
  entity: any
  row?: any
  mode?: 'create' | 'edit'
  /** B6-2：无可用表单页时的临时表单（明确标注，不写文件） */
  temporary?: boolean
}>()

const emit = defineEmits<{ (event: 'submit'): void; (event: 'cancel'): void }>()

const form = buildForm(props.page, props.entity)
const width = form.width || 720
const isEdit = props.mode === 'edit'
const baseTitle = props.page?.title || props.entity?.name || '表单'
const title = props.temporary
  ? '临时表单 · 未设计表单页'
  : isEdit
    ? baseTitle
    : `${props.entity?.name || baseTitle} · ${actionLabel('create')}`

const model = reactive<Record<string, any>>({})
for (const group of form.groups) {
  for (const field of group.fields) {
    const value = isEdit && props.row && Object.prototype.hasOwnProperty.call(props.row, field.name) ? props.row[field.name] : ''
    model[field.name] = value
  }
}

function onVisible(visible: boolean): void {
  if (!visible) emit('cancel')
}
</script>

<style scoped>
.contract-action-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}

.contract-action-card {
  display: flex;
  flex-direction: column;
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  padding: 0;
  overflow: hidden;
}

/* pm-form-dialog 的遮罩层在卡片内静态排布，避免全屏遮罩叠两层（Element Plus 2.14 用 .el-modal-dialog） */
.contract-action-card :deep(.el-modal-dialog),
.contract-action-card :deep(.el-overlay) {
  position: static !important;
  inset: auto !important;
  height: auto !important;
  background: transparent !important;
}

.contract-action-card :deep(.el-overlay-dialog) {
  position: static !important;
  display: block;
  min-height: 0;
  overflow: visible;
}

.contract-action-card :deep(.el-dialog) {
  width: 100% !important;
  max-width: none;
  margin: 0;
  border-radius: 0;
  box-shadow: none;
}

.contract-action-card :deep(.el-dialog__body) {
  padding: 0;
}

.contract-action-card :deep(.pm-dialog__body) {
  max-height: min(58vh, 520px);
  overflow: auto;
  padding: 4px 20px 16px;
}

.contract-action-temporary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 4px 20px 10px;
  padding: 7px 10px;
  color: #8a5a00;
  border: 1px dashed #e3c67f;
  border-radius: 8px;
  background: #fff9ed;
  font-size: 12px;
}

.contract-action-temporary span {
  color: #7a6a4d;
  font-size: 11.5px;
}

.contract-action-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--rg-border, #e2e8f0);
  background: var(--rg-surface, #fff);
}
</style>
