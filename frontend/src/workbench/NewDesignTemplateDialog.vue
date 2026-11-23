<template>
  <Teleport to="body">
    <div v-if="modelValue" class="ndt-mask" data-testid="new-design-template-dialog" @click.self="close">
      <section class="ndt" role="dialog" aria-modal="true" aria-label="新建自定义设计模板">
        <header class="ndt-head">
          <div>
            <h2>新建自定义模板</h2>
            <p>先创建草稿，随后进入模板工作室与 AI 一起确定页面清单；生成与发布都由你确认。</p>
          </div>
          <button type="button" class="icon-btn" aria-label="关闭" title="关闭" @click="close">×</button>
        </header>

        <form class="ndt-body" @submit.prevent="submit">
          <label class="field">
            <span>模板名称 <b>*</b></span>
            <input
              v-model.trim="form.name"
              placeholder="例如：供应商管理模板"
              maxlength="100"
              autocomplete="off"
              data-testid="new-template-name"
            />
            <small>显示在模板中心与新建应用；模板 id 创建后不可修改。</small>
          </label>

          <div class="field">
            <span>视觉风格</span>
            <div class="style-list" role="radiogroup" aria-label="视觉风格">
              <button
                v-for="style in styles"
                :key="style.id"
                type="button"
                :class="['style-option', { on: form.style === style.id }]"
                :data-testid="`new-template-style-${style.id}`"
                role="radio"
                :aria-checked="form.style === style.id"
                @click="form.style = style.id"
              >
                <i :style="{ background: style.signature || '#1f5eff' }" />
                <span>{{ style.name }}</span>
              </button>
            </div>
            <small>每个自定义模板固定复制 1 套内置风格；暂不支持修改 token。</small>
          </div>

          <label class="field">
            <span>基础应用类型</span>
            <select v-model="form.baseApplicationType" data-testid="new-template-base-type">
              <option v-for="type in applicationTypes" :key="type.id" :value="type.id">{{ type.name }}</option>
            </select>
            <small>决定 contract 页的根类与兜底结构样式；可后续在 spec 中调整。</small>
          </label>

          <p v-if="error" class="error" data-testid="new-template-error">{{ error }}</p>

          <footer class="actions">
            <button type="button" class="btn" :disabled="busy" @click="close">取消</button>
            <button type="submit" class="btn primary" :disabled="busy" data-testid="new-template-submit">
              {{ busy ? '创建中…' : '创建并进入工作室' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 新建自定义设计模板对话框（P7-7b-2b）
 *
 * 只调用 `POST /api/design-templates/drafts` 创建草稿；不生成、不发布。
 * 成功后 emit `created(packId)`，由模板中心关闭并跳转 `#/studio/<packId>`。
 */
import { reactive, ref, watch } from 'vue'
import { createDesignTemplateDraft, StudioApiError } from '../studio/api'

interface StyleOption {
  id: string
  name: string
  signature?: string
}

interface ApplicationTypeOption {
  id: string
  name: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    styles?: StyleOption[]
    applicationTypes?: ApplicationTypeOption[]
    defaultStyle?: string
    defaultApplicationType?: string
  }>(),
  {
    styles: () => [],
    applicationTypes: () => [],
    defaultStyle: '',
    defaultApplicationType: ''
  }
)

const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  created: [packId: string]
}>()

const busy = ref(false)
const error = ref('')
const form = reactive({ name: '', style: '', baseApplicationType: '' })

function reset(): void {
  form.name = ''
  form.style = props.defaultStyle || props.styles[0]?.id || ''
  form.baseApplicationType = props.defaultApplicationType || props.applicationTypes[0]?.id || ''
  error.value = ''
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) reset()
  }
)

function close(): void {
  if (busy.value) return
  emit('update:modelValue', false)
}

async function submit(): Promise<void> {
  if (busy.value) return
  if (!form.name.trim()) {
    error.value = '请填写模板名称'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const draft = await createDesignTemplateDraft({
      name: form.name.trim(),
      ...(form.style ? { style: form.style } : {}),
      ...(form.baseApplicationType ? { baseApplicationType: form.baseApplicationType } : {})
    })
    emit('update:modelValue', false)
    emit('created', draft.id)
  } catch (err) {
    error.value = err instanceof StudioApiError ? err.message : err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.ndt-mask {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--rg-overlay);
  font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: var(--rg-text);
}
.ndt {
  display: flex;
  flex-direction: column;
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: hidden;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius-lg);
  box-shadow: 0 28px 70px rgba(10, 14, 20, 0.34);
}
.ndt-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 12px;
}
.ndt-head h2 {
  margin: 0 0 5px;
  font-size: 16px;
  font-weight: 650;
}
.ndt-head p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--rg-text-2);
}
.icon-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--rg-text-3);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.icon-btn:hover {
  background: var(--rg-fill-2);
  color: var(--rg-text);
}
.ndt-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 6px 22px 20px;
  overflow-y: auto;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.field > span {
  font-size: 12px;
  color: var(--rg-text-2);
  font-weight: 500;
}
.field b {
  color: var(--rg-danger);
  font-weight: 600;
}
.field input,
.field select {
  border: 1px solid var(--rg-border-strong);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--rg-text);
  background: var(--rg-surface);
  outline: none;
}
.field input:focus,
.field select:focus {
  border-color: var(--rg-ai);
  box-shadow: 0 0 0 3px var(--rg-ai-soft);
}
.field small {
  font-size: 11px;
  line-height: 1.5;
  color: var(--rg-text-3);
}
.style-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
  gap: 8px;
}
.style-option {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  background: var(--rg-surface);
  color: var(--rg-text);
  padding: 7px 9px;
  font-size: 12px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.style-option i {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.style-option.on {
  border-color: var(--rg-ink);
  box-shadow: 0 0 0 2px var(--rg-ai-soft);
}
.error {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border: 1px solid var(--rg-danger-border);
  border-radius: 8px;
  padding: 8px 10px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--rg-border);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 6px 13px;
  font-size: 12.5px;
  font-family: inherit;
  cursor: pointer;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.btn.primary {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
