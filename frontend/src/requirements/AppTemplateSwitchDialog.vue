<template>
  <el-dialog
    :model-value="modelValue"
    title="应用到全部模块（需求模板）"
    width="min(900px, calc(100vw - 32px))"
    top="6vh"
    append-to-body
    class="app-template-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="ats">
      <div class="ats-head">
        <div>
          <strong class="ats-title">切换为「{{ templateName || preview?.template.name || '模板' }}」</strong>
          <p class="ats-desc">
            将重写当前应用的<strong>所有未归档模块</strong>：同 key/同标题章节保留内容，其余内容从新文档移除（旧版本仍可回滚）；
            每个模块生成一个 <code>template-change</code> 版本。
          </p>
        </div>
        <span class="ats-scope">应用级</span>
      </div>

      <div v-if="loading" class="ats-loading">正在计算逐模块影响…</div>
      <div v-else-if="error" class="ats-error">
        {{ error }}
        <button type="button" class="ats-retry" @click="load">重试</button>
      </div>
      <template v-else-if="preview">
        <div v-if="preview.blockedModules.length" class="ats-blocked">
          <strong>有 {{ preview.blockedModules.length }} 个模块的需求已确认，不能应用级切换：</strong>
          <ul>
            <li v-for="item in preview.blockedModules" :key="item.moduleId">
              {{ item.moduleKey }} {{ item.title }}（已确认）
            </li>
          </ul>
          <p>请先回到需求阶段并「重新编辑需求」，再切换模板。</p>
        </div>
        <ul v-else-if="preview.warnings.length" class="ats-warnings">
          <li v-for="(warning, index) in preview.warnings" :key="index">{{ warning }}</li>
        </ul>

        <div class="ats-modules">
          <div v-for="item in preview.modules" :key="item.moduleId" class="ats-card">
            <div class="ats-card-head">
              <span class="ats-key">{{ item.moduleKey }}</span>
              <strong>{{ item.title }}</strong>
              <span class="ats-flow">{{ item.fromSections }} → {{ item.toSections }} 节</span>
              <span class="ats-kept">保留 {{ item.kept }}</span>
              <span :class="['ats-status', item.docStatus]">{{ statusLabel(item.docStatus) }}</span>
            </div>
            <div class="ats-row">
              <span class="ats-row-label">移除</span>
              <span v-if="!item.dropped.length" class="ats-none">无</span>
              <span v-for="section in item.dropped" :key="`d-${section.sectionKey}`" class="ats-chip dropped">
                {{ section.title }}
              </span>
            </div>
            <div class="ats-row">
              <span class="ats-row-label">新增</span>
              <span v-if="!item.added.length" class="ats-none">无</span>
              <span v-for="section in item.added" :key="`a-${section.sectionKey}`" class="ats-chip added">
                {{ section.title }}
              </span>
            </div>
            <ul v-if="item.warnings.length" class="ats-module-warnings">
              <li v-for="(warning, index) in item.warnings" :key="index">{{ warning }}</li>
            </ul>
          </div>
        </div>
        <p v-if="!preview.modules.length" class="ats-empty">当前应用还没有未归档模块。</p>
      </template>
    </div>
    <template #footer>
      <div class="ats-footer">
        <el-button size="small" :disabled="applying" @click="emit('update:modelValue', false)">取消</el-button>
        <el-button
          size="small"
          type="primary"
          :disabled="!canApply"
          :loading="applying"
          @click="apply"
        >
          {{ applying ? '切换中…' : `应用到全部模块（${preview?.modules.length ?? 0}）` }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  previewAppTemplate,
  switchAppTemplate,
  type AppTemplatePreview,
  type AppTemplateSwitchResult,
  type RequirementDocStatus
} from './api'
import { canApplyTemplatePreview } from './module-helpers.js'

const props = defineProps<{
  modelValue: boolean
  appId: string
  templateId: string
  templateName: string
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  applied: [AppTemplateSwitchResult]
}>()

const preview = ref<AppTemplatePreview | null>(null)
const loading = ref(false)
const applying = ref(false)
const error = ref('')

const canApply = computed(() => canApplyTemplatePreview(preview.value))

const STATUS_LABELS: Record<RequirementDocStatus, string> = {
  draft: '草稿',
  review: '待审核',
  confirmed: '已确认'
}

function statusLabel(status: RequirementDocStatus): string {
  return STATUS_LABELS[status] ?? '草稿'
}

async function load(): Promise<void> {
  if (!props.templateId) return
  loading.value = true
  error.value = ''
  preview.value = null
  try {
    preview.value = await previewAppTemplate(props.appId, props.templateId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

watch(
  [() => props.modelValue, () => props.templateId],
  ([open, templateId]) => {
    if (open && templateId) void load()
  },
  { immediate: true }
)

async function apply(): Promise<void> {
  if (!preview.value || !canApply.value || applying.value) return
  try {
    await ElMessageBox.confirm(
      `将把「${preview.value.template.name}」应用到 ${preview.value.modules.length} 个未归档模块，每个模块生成新版本（旧版本可回滚）。`,
      '应用级切换模板',
      { type: 'warning', confirmButtonText: '确认切换', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  applying.value = true
  try {
    const result = await switchAppTemplate(props.appId, props.templateId)
    emit('applied', result)
    emit('update:modelValue', false)
    ElMessage.success(`已切换为「${result.template.name}」（${result.modules.length} 个模块）`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    applying.value = false
  }
}
</script>

<style scoped>
.ats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--rg-text);
}
.ats-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.ats-title {
  font-size: 14px;
  color: var(--rg-text);
}
.ats-desc {
  margin: 5px 0 0;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--rg-text-2);
}
.ats-desc code {
  font-size: 10.5px;
  background: var(--rg-code-bg);
  border: 1px solid var(--rg-code-border);
  border-radius: 4px;
  padding: 0 4px;
  color: var(--rg-code-text);
}
.ats-scope {
  flex-shrink: 0;
  font-size: 10px;
  border-radius: 999px;
  padding: 2px 9px;
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.ats-loading,
.ats-empty {
  padding: 26px 0;
  text-align: center;
  font-size: 12px;
  color: var(--rg-text-3);
}
.ats-error {
  border: 1px solid var(--rg-danger-border);
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
  border-radius: 9px;
  padding: 9px 12px;
  font-size: 11.5px;
  line-height: 1.6;
}
.ats-retry {
  margin-left: 8px;
  border: 1px solid var(--rg-danger-border);
  background: var(--rg-surface);
  color: var(--rg-danger);
  border-radius: 6px;
  padding: 2px 9px;
  font-size: 11px;
  cursor: pointer;
}
.ats-blocked {
  border: 1px solid var(--rg-danger-border);
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
  border-radius: 9px;
  padding: 9px 12px;
  font-size: 11.5px;
  line-height: 1.65;
}
.ats-blocked ul {
  margin: 5px 0 0;
  padding-left: 18px;
}
.ats-blocked p {
  margin: 5px 0 0;
}
.ats-warnings {
  margin: 0;
  padding: 8px 12px 8px 26px;
  border: 1px solid var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
  border-radius: 9px;
  font-size: 11.5px;
  line-height: 1.65;
}
.ats-modules {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.ats-card {
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  border-radius: 10px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.ats-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12.5px;
}
.ats-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 9.5px;
  color: var(--rg-text-3);
}
.ats-flow {
  font-size: 11px;
  color: var(--rg-text-2);
  background: var(--rg-fill);
  border-radius: 999px;
  padding: 0 7px;
}
.ats-kept {
  font-size: 10.5px;
  color: var(--rg-ok);
  background: var(--rg-ok-soft);
  border-radius: 999px;
  padding: 0 7px;
}
.ats-status {
  margin-left: auto;
  font-size: 10px;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.ats-status.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.ats-status.review {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.ats-row {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  font-size: 10.5px;
}
.ats-row-label {
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.ats-none {
  color: var(--rg-text-3);
}
.ats-chip {
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 10.5px;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  color: var(--rg-text-2);
}
.ats-chip.dropped {
  border-color: var(--rg-danger-border);
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.ats-chip.added {
  border-color: var(--rg-ok-border);
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.ats-module-warnings {
  margin: 0;
  padding-left: 16px;
  font-size: 10.5px;
  color: var(--rg-warn);
  line-height: 1.55;
}
.ats-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
@media (max-width: 900px) {
  .ats-modules {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 768px) {
  .ats-footer .el-button {
    min-height: 32px;
  }
}
</style>
