<template>
  <el-dialog
    :model-value="modelValue"
    title="发起变更"
    width="min(560px, calc(100vw - 32px))"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @open="reset"
  >
    <div class="cs-form">
      <p class="cs-intro">
        变更会记录基线版本、归档当前开发会话，并把需求/设计回到草稿；完成后生成新的交接包，在新开发会话中增量实现。
      </p>

      <div class="cs-baseline">
        <span>基线：</span>
        <span>需求 v{{ app?.requirementDoc?.version ?? '—' }}</span>
        <span>设计 v{{ app?.designProject?.version ?? '—' }}</span>
        <span>交接包 {{ app?.handoff ? `v${app.handoff.version}` : '—' }}</span>
      </div>

      <div class="cs-field">
        <span>变更模块 <em>*</em>（默认全选）</span>
        <div class="cs-modules">
          <label
            v-for="module in moduleRows"
            :key="module.id"
            :class="['cs-module', { on: selectedIds.includes(module.id), disabled: busy }]"
          >
            <input
              type="checkbox"
              :checked="selectedIds.includes(module.id)"
              :disabled="busy"
              @change="toggleModule(module.id)"
            />
            <span class="cs-module-main">
              <span class="cs-module-line1">
                <code>{{ module.moduleKey }}</code>
                <strong>{{ module.title }}</strong>
                <span v-if="module.required" class="cs-req">必选</span>
              </span>
              <span class="cs-module-line2">
                需求 v{{ module.docVersion ?? '—' }} · 设计 v{{ module.designVersion ?? '—' }}
                <span :class="['cs-module-status', module.docStatus ?? 'draft']">{{ module.docStatusLabel }}</span>
                <span :class="['cs-module-status', module.designStatus ?? 'draft']">{{ module.designStatusLabel }}</span>
              </span>
            </span>
          </label>
          <p v-if="!moduleRows.length" class="cs-module-empty">还没有未归档模块。</p>
        </div>
        <p class="cs-module-hint">
          未选模块的需求/设计版本、确认状态、设计输入与开发会话都不会变化；需求范围会重开选中模块的需求+设计。
        </p>
      </div>

      <label class="cs-field">
        <span>标题 <em>*</em></span>
        <input v-model="title" type="text" maxlength="120" placeholder="例如：新增客户等级维度" :disabled="busy" />
      </label>

      <label class="cs-field">
        <span>说明</span>
        <textarea v-model="description" rows="3" placeholder="本次变更的目标、范围、验收要点（可选）" :disabled="busy" />
      </label>

      <div class="cs-field">
        <span>变更范围</span>
        <div class="cs-scopes">
          <label :class="['cs-scope', { on: scope === 'requirements' }]">
            <input v-model="scope" type="radio" value="requirements" :disabled="busy" />
            <strong>需求 + 设计</strong>
            <small>需求文档与设计都会回到草稿</small>
          </label>
          <label :class="['cs-scope', { on: scope === 'design' }]">
            <input v-model="scope" type="radio" value="design" :disabled="busy" />
            <strong>仅设计</strong>
            <small>需求不变，只调整实体/页面/原型</small>
          </label>
        </div>
      </div>

      <p class="cs-warn">
        发起后会归档当前开发会话（旧会话只读）；需求/设计回到 draft。纯代码修复不需要发起变更，直接在开发会话处理。
      </p>
      <p v-if="error" class="cs-error">{{ error }}</p>
    </div>

    <template #footer>
      <button type="button" class="cs-btn" :disabled="busy" @click="close">取消</button>
      <button type="button" class="cs-btn primary" :disabled="busy" @click="submit">
        {{ busy ? '发起中…' : '发起变更' }}
      </button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { startChangeSet, type ChangeSetStartResult } from './api'
import { defaultChangeSetModuleIds, validateChangeSetModuleSelection } from './module-scope.js'
import type { AppInfo } from '../workbench/api'

const props = defineProps<{ modelValue: boolean; app: AppInfo | null }>()
const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  started: [ChangeSetStartResult]
}>()

const title = ref('')
const description = ref('')
const scope = ref<'requirements' | 'design'>('requirements')
const selectedIds = ref<string[]>([])
const busy = ref(false)
const error = ref('')

interface ModuleRow {
  id: string
  moduleKey: string
  title: string
  required: boolean
  docVersion: number | null
  docStatus: 'draft' | 'review' | 'confirmed' | null
  docStatusLabel: string
  designVersion: number | null
  designStatus: 'draft' | 'review' | 'confirmed' | null
  designStatusLabel: string
}

const moduleRows = computed<ModuleRow[]>(() => {
  const modules = (props.app?.requirementModules ?? []).filter(module => !module.archived)
  const design = new Map((props.app?.designModules ?? []).map(item => [item.moduleId, item]))
  return modules.map(module => {
    const project = design.get(module.id)
    return {
      id: module.id,
      moduleKey: module.moduleKey,
      title: module.title,
      required: module.required,
      docVersion: module.docVersion,
      docStatus: module.docStatus,
      docStatusLabel:
        module.docStatus === 'confirmed' ? '需求已确认' : module.docStatus === 'review' ? '需求待审核' : '需求草稿',
      designVersion: project?.version ?? null,
      designStatus: project?.status ?? null,
      designStatusLabel:
        project?.status === 'confirmed' ? '设计已确认' : project?.status === 'review' ? '设计待审核' : project ? '设计草稿' : '未设计'
    }
  })
})

function reset(): void {
  title.value = ''
  description.value = ''
  scope.value = 'requirements'
  selectedIds.value = defaultChangeSetModuleIds(props.app?.requirementModules ?? [])
  busy.value = false
  error.value = ''
}

function toggleModule(moduleId: string): void {
  if (busy.value) return
  selectedIds.value = selectedIds.value.includes(moduleId)
    ? selectedIds.value.filter(id => id !== moduleId)
    : [...selectedIds.value, moduleId]
}

function close(): void {
  if (busy.value) return
  emit('update:modelValue', false)
}

async function submit(): Promise<void> {
  if (busy.value) return
  if (!props.app) return
  const value = title.value.trim()
  if (!value) {
    error.value = '请填写变更标题'
    return
  }
  const selection = validateChangeSetModuleSelection(props.app.requirementModules ?? [], selectedIds.value)
  if (!selection.ok) {
    error.value = selection.error
    return
  }
  busy.value = true
  error.value = ''
  try {
    const result = await startChangeSet(props.app.id, {
      title: value,
      description: description.value.trim() || undefined,
      scope: scope.value,
      moduleIds: [...selectedIds.value]
    })
    const moduleCount = result.changeSet.modules?.length ?? selectedIds.value.length
    ElMessage.success(
      `已发起变更 #${result.changeSet.seq}（${result.changeSet.scope === 'design' ? '仅设计' : '需求+设计'} · ${moduleCount} 个模块）`
    )
    emit('started', result)
    emit('update:modelValue', false)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.cs-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 12.5px;
  color: var(--rg-text);
}
.cs-intro {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: var(--rg-text-2);
}
.cs-baseline {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 10px;
  background: var(--rg-ai-soft);
  border: 1px solid var(--rg-ai-border);
  border-radius: 8px;
  font-size: 11.5px;
  color: var(--rg-ai);
}
.cs-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.cs-field > span {
  font-size: 12px;
  color: var(--rg-text-2);
}
.cs-field em {
  color: var(--rg-danger);
  font-style: normal;
}
.cs-field input[type='text'],
.cs-field textarea {
  border: 1px solid var(--rg-border-strong);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--rg-text);
  background: var(--rg-surface);
  resize: vertical;
}
.cs-field input::placeholder,
.cs-field textarea::placeholder {
  color: var(--rg-text-3);
}
.cs-field input:focus,
.cs-field textarea:focus {
  outline: none;
  border-color: var(--rg-ai);
  box-shadow: 0 0 0 3px var(--rg-ai-soft);
}
.cs-scopes {
  display: flex;
  gap: 10px;
}
.cs-scope {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--rg-border-strong);
  border-radius: 9px;
  padding: 9px 11px;
  cursor: pointer;
  color: var(--rg-text-2);
  background: var(--rg-surface);
}
.cs-scope:hover {
  border-color: var(--rg-text-3);
}
.cs-scope.on {
  border-color: var(--rg-ink);
  background: var(--rg-surface-2);
  color: var(--rg-text);
}
.cs-scope input {
  display: none;
}
.cs-scope strong {
  font-size: 12.5px;
}
.cs-scope small {
  font-size: 11px;
  color: var(--rg-text-3);
}
.cs-warn {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border: 1px solid var(--rg-warn-border);
  border-radius: 8px;
  padding: 8px 10px;
}
.cs-modules {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}
.cs-module {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid var(--rg-border-strong);
  border-radius: 8px;
  padding: 7px 9px;
  cursor: pointer;
  background: var(--rg-surface);
}
.cs-module:hover {
  border-color: var(--rg-text-3);
}
.cs-module.on {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
}
.cs-module.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.cs-module input {
  margin-top: 2px;
  accent-color: var(--rg-ai);
}
.cs-module-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.cs-module-line1 {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12.5px;
  color: var(--rg-text);
}
.cs-module-line1 code {
  font-size: 10px;
  color: var(--rg-text-3);
}
.cs-module-line2 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: var(--rg-text-3);
  flex-wrap: wrap;
}
.cs-req {
  font-size: 9px;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border-radius: 999px;
  padding: 0 5px;
}
.cs-module-status {
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.cs-module-status.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.cs-module-status.review {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.cs-module-hint {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.55;
  color: var(--rg-text-3);
}
.cs-module-empty {
  margin: 0;
  font-size: 11px;
  color: var(--rg-text-3);
}
.cs-error {
  margin: 0;
  font-size: 12px;
  color: var(--rg-danger);
}
.cs-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 12.5px;
  cursor: pointer;
}
.cs-btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.cs-btn.primary {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
  margin-left: 8px;
}
.cs-btn.primary:hover:not(:disabled) {
  background: var(--rg-ink-hover);
  border-color: var(--rg-ink-hover);
  color: var(--rg-ink-contrast);
}
.cs-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 640px) {
  .cs-scopes {
    flex-direction: column;
  }
}
</style>
