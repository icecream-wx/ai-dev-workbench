<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="760px"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @open="load"
  >
    <p class="tpl-note">
      <template v-if="scope === 'module'">
        本次变更只包含部分模块：这里只切换当前模块的原型模板；当前模块设计回到草稿并生成 <code>template-change</code> 版本，未选模块保持不动。
      </template>
      <template v-else>
        原型模板是应用级共享的：切换后所有未归档模块一起使用新模板，并各自生成 <code>template-change</code> 版本、设计回到草稿。
        任一模块设计已确认时不能应用级切换，请先「重新编辑设计」。
      </template>
    </p>

    <div class="tpl-toolbar">
      <el-select v-model="selectedId" size="small" placeholder="选择原型模板" class="tpl-select" :disabled="loading">
        <el-option v-for="template in templates" :key="template.id" :label="template.name" :value="template.id" />
      </el-select>
      <button v-if="scope === 'app'" type="button" class="tpl-btn" :disabled="loading || !selectedId" @click="loadPreview">预览影响</button>
      <button type="button" class="tpl-btn primary" :disabled="!canApply" @click="apply">
        {{ applying ? '应用中…' : scope === 'module' ? '应用到当前模块' : '应用到全部模块' }}
      </button>
      <span v-if="currentTemplateName" class="tpl-current">当前：{{ currentTemplateName }}</span>
    </div>

    <p v-if="error" class="tpl-error">{{ error }}</p>

    <template v-if="preview">
      <div class="tpl-summary">
        <span>目标模板：{{ preview.templateName }}</span>
        <span>{{ preview.modules.length }} 个未归档模块</span>
        <span v-if="preview.blockedModules.length" class="tpl-blocked">被阻止 {{ preview.blockedModules.length }}</span>
        <span v-else-if="canApply" class="tpl-ok">可以应用</span>
      </div>
      <el-table :data="preview.modules" size="small" class="tpl-table">
        <el-table-column prop="moduleKey" label="模块" width="92" />
        <el-table-column prop="title" label="名称" min-width="130" show-overflow-tooltip />
        <el-table-column label="状态" width="92">
          <template #default="{ row }">
            <span :class="['tpl-status', row.status]">{{ row.status === 'confirmed' ? '已确认' : '草稿' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="版本" width="70">
          <template #default="{ row }">v{{ row.version }} → v{{ row.version + 1 }}</template>
        </el-table-column>
        <el-table-column label="结果" width="100">
          <template #default="{ row }">
            <span v-if="row.blocked" class="tpl-blocked">已确认，阻止</span>
            <span v-else class="tpl-ok">将切换</span>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="preview.blockedModules.length" class="tpl-blocked-list">
        需先重新编辑设计：{{ preview.blockedModules.map(item => `${item.moduleKey} ${item.title}`).join('、') }}
      </p>
    </template>
    <p v-else class="tpl-hint">选择模板后点击“预览影响”（预览只读，不写库）。</p>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  DesignApiError,
  listPrototypeTemplates,
  previewDesignTemplateSwitch,
  switchAppDesignTemplate,
  switchDesignTemplate,
  type DesignTemplateSwitchPreview
} from './api'
import type { PrototypeTemplate } from './types'
import { templateSwitchUsable } from './design-module-helpers.js'

const props = defineProps<{
  modelValue: boolean
  appId: string
  currentTemplateId?: string
  currentTemplateName?: string
  /** M5：app = 全部未归档模块；module = 只切当前模块（变更范围只含部分模块时） */
  scope?: 'app' | 'module'
  moduleId?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  applied: []
}>()

const templates = ref<PrototypeTemplate[]>([])
const selectedId = ref('')
const preview = ref<DesignTemplateSwitchPreview | null>(null)
const loading = ref(false)
const applying = ref(false)
const error = ref('')

const dialogTitle = computed(() =>
  props.scope === 'module' ? '原型模板（仅当前模块）' : '原型模板（应用到全部模块）'
)
const canApply = computed(() =>
  props.scope === 'module' ? Boolean(selectedId.value) && !loading.value && !applying.value : templateSwitchUsable(preview.value)
)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  preview.value = null
  try {
    templates.value = await listPrototypeTemplates()
    selectedId.value = props.currentTemplateId && templates.value.some(item => item.id === props.currentTemplateId)
      ? props.currentTemplateId
      : templates.value[0]?.id ?? ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function loadPreview(): Promise<void> {
  if (!selectedId.value) return
  loading.value = true
  error.value = ''
  try {
    preview.value = await previewDesignTemplateSwitch(props.appId, selectedId.value)
  } catch (err) {
    preview.value = null
    error.value = err instanceof DesignApiError && err.issues.length
      ? `${err.message}：${err.issues.map(item => (typeof item === 'string' ? item : (item as { title?: string }).title ?? '')).join('；')}`
      : err instanceof Error
        ? err.message
        : String(err)
  } finally {
    loading.value = false
  }
}

async function apply(): Promise<void> {
  if (applying.value) return
  if (props.scope === 'module') {
    if (!selectedId.value || !props.moduleId) return
    const templateName = templates.value.find(item => item.id === selectedId.value)?.name ?? selectedId.value
    try {
      await ElMessageBox.confirm(
        `把当前模块的原型模板切换为「${templateName}」？\n当前模块设计会回到草稿并生成 template-change 版本；未选模块不动。`,
        '切换当前模块原型模板',
        { type: 'warning', confirmButtonText: '应用', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
    applying.value = true
    error.value = ''
    try {
      await switchDesignTemplate(props.appId, selectedId.value, props.moduleId)
      ElMessage.success('当前模块原型模板已切换')
      emit('applied')
      emit('update:modelValue', false)
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      applying.value = false
    }
    return
  }
  if (!preview.value || !canApply.value) return
  try {
    await ElMessageBox.confirm(
      `把原型模板「${preview.value.templateName}」应用到全部 ${preview.value.modules.length} 个模块？\n所有模块设计会回到草稿，并各自生成 template-change 版本。`,
      '应用级切换原型模板',
      { type: 'warning', confirmButtonText: '应用到全部模块', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  applying.value = true
  error.value = ''
  try {
    const result = await switchAppDesignTemplate(props.appId, preview.value.templateId)
    ElMessage.success(`已切换 ${result.changedModuleIds.length} 个模块的原型模板`)
    emit('applied')
    emit('update:modelValue', false)
  } catch (err) {
    if (err instanceof DesignApiError && err.issues.length) {
      const names = err.issues
        .map(item => (typeof item === 'string' ? item : `${(item as { moduleKey?: string }).moduleKey ?? ''} ${(item as { title?: string }).title ?? ''}`))
        .filter(Boolean)
        .join('、')
      error.value = `${err.message}${names ? `：${names}` : ''}`
    } else {
      error.value = err instanceof Error ? err.message : String(err)
    }
  } finally {
    applying.value = false
  }
}
</script>

<style scoped>
.tpl-note {
  margin: 0 0 10px;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--rg-text-2);
}
.tpl-note code {
  background: var(--rg-fill);
  border-radius: 4px;
  padding: 0 4px;
}
.tpl-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tpl-select {
  width: 220px;
}
.tpl-btn {
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 5px 11px;
  font-size: 12px;
  cursor: pointer;
}
.tpl-btn:hover:not(:disabled) {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.tpl-btn.primary {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.tpl-btn.primary:hover:not(:disabled) {
  background: var(--rg-ink-hover);
  border-color: var(--rg-ink-hover);
}
.tpl-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.tpl-current {
  margin-left: auto;
  font-size: 11px;
  color: var(--rg-text-3);
}
.tpl-error {
  margin: 8px 0 0;
  font-size: 11.5px;
  color: var(--rg-danger);
}
.tpl-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 10px 0 6px;
  font-size: 11.5px;
  color: var(--rg-text-2);
}
.tpl-blocked {
  color: var(--rg-warn);
}
.tpl-ok {
  color: var(--rg-ok);
}
.tpl-table {
  margin-top: 4px;
}
.tpl-status {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.tpl-status.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.tpl-blocked-list {
  margin: 8px 0 0;
  font-size: 11.5px;
  color: var(--rg-warn);
}
.tpl-hint {
  margin: 10px 0 0;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
@media (max-width: 768px) {
  .tpl-select {
    width: 100%;
  }
}
</style>
