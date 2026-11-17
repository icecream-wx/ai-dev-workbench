<template>
  <el-dialog
    :model-value="modelValue"
    title="设计总览"
    width="min(980px, calc(100vw - 32px))"
    append-to-body
    class="design-overview-dialog"
    @update:model-value="emit('update:modelValue', $event)"
    @open="load"
  >
    <div class="overview-head">
      <div class="overview-progress">
        <strong>{{ progress.confirmed }} / {{ progress.total }}</strong>
        <span>模块设计已确认</span>
        <span v-if="progress.pending.length" class="overview-pending">待确认 {{ progress.pending.length }}</span>
        <span v-else class="overview-done">全部已确认</span>
      </div>
      <span class="overview-coverage">
        需求覆盖 {{ summary.coveredStories }} / {{ summary.storyTotal }}（{{ coverageRateLabel(summary.rate) }}）
      </span>
      <span class="overview-missing" :class="{ warn: missingTotal > 0 }">缺原型截图 {{ missingTotal }}</span>
      <span v-if="bundle" class="overview-bundle">需求聚合 v{{ bundle.version }}</span>
      <button type="button" class="overview-refresh" :disabled="loading" @click="load">刷新</button>
    </div>

    <p class="overview-note">
      总览只读，不会创建设计项目/版本/输入。覆盖率 = 有实体或页面引用的 Story / 全部 Story；全部必选模块设计确认后即可在交接包弹窗生成应用级交接包（按模块组织）。
    </p>
    <p v-if="progress.pending.length" class="overview-pending-list">
      待确认：{{ progress.pending.map(item => item.title || item.moduleKey).join('、') }}
    </p>
    <p v-if="error" class="overview-error">{{ error }}</p>

    <div class="overview-table-wrap">
      <el-table v-loading="loading" :data="modules" size="small" class="overview-table">
        <el-table-column prop="moduleKey" label="模块" width="92">
          <template #default="{ row }">
            <span class="ov-key">{{ row.moduleKey }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="名称" min-width="130" show-overflow-tooltip />
        <el-table-column label="状态" width="86">
          <template #default="{ row }">
            <span :class="['ov-status', row.status]">{{ designModuleStatusLabel(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="版本" width="62">
          <template #default="{ row }">{{ designModuleVersionLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="覆盖 Story" width="96">
          <template #default="{ row }">
            <span :class="{ 'ov-warn': row.coverage.coveredStories < row.coverage.storyTotal }">
              {{ row.coverage.coveredStories }}/{{ row.coverage.storyTotal }}
              <small class="ov-rate">{{ coverageRateLabel(row.coverage.rate) }}</small>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="未覆盖 Story" min-width="150">
          <template #default="{ row }">
            <span v-if="row.coverage.uncovered.length" class="ov-uncovered" :title="uncoveredTitle(row.coverage.uncovered)">
              {{ uncoveredStoriesLabel(row.coverage.uncovered) }}
            </span>
            <span v-else class="ov-ok">全部覆盖</span>
          </template>
        </el-table-column>
        <el-table-column prop="entityCount" label="实体" width="54" align="right" />
        <el-table-column prop="pageSetCount" label="页面集" width="62" align="right" />
        <el-table-column prop="pageCount" label="页面" width="54" align="right" />
        <el-table-column label="缺图" width="58" align="right">
          <template #default="{ row }">
            <span :class="{ 'ov-warn': row.missingImages > 0 }">{{ row.missingImages }}</span>
          </template>
        </el-table-column>
        <el-table-column label="切换" width="70" align="right">
          <template #default="{ row }">
            <button type="button" class="ov-switch" @click="emit('select', row.moduleId)">打开</button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <p v-if="!loading && !modules.length" class="overview-empty">还没有未归档模块。</p>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { getDesignOverview, type DesignOverviewModule } from './api'
import type { DesignModuleSummary } from '../workbench/api'
import {
  coverageRateLabel,
  designMissingImageTotal,
  designModuleProgress,
  designModuleStatusLabel,
  designModuleVersionLabel,
  uncoveredStoriesLabel
} from './design-module-helpers.js'

const props = defineProps<{
  modelValue: boolean
  appId: string
  /** 可选初值（打开时仍会刷新一次，失败时回退） */
  designModules?: DesignModuleSummary[]
}>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  select: [string]
}>()

const modules = ref<DesignOverviewModule[]>([])
const summary = ref({ moduleCount: 0, confirmed: 0, storyTotal: 0, coveredStories: 0, rate: 1, missingImages: 0 })
const bundle = ref<{ version: number; hash: string } | null>(null)
const loading = ref(false)
const error = ref('')

const progress = computed(() => designModuleProgress(modules.value))
const missingTotal = computed(() => designMissingImageTotal(modules.value))

function uncoveredTitle(uncovered: Array<{ id: string; title: string }>): string {
  return uncovered.map(item => `${item.id} ${item.title}`).join('\n')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const data = await getDesignOverview(props.appId)
    modules.value = Array.isArray(data.modules) ? data.modules : []
    summary.value = data.summary
    bundle.value = data.bundle ?? null
  } catch (err) {
    modules.value = Array.isArray(props.designModules)
      ? props.designModules.map(module => ({
          ...module,
          coverage: { storyTotal: 0, coveredStories: 0, rate: 1, uncovered: [] }
        }))
      : []
    summary.value = {
      moduleCount: modules.value.length,
      confirmed: modules.value.filter(module => module.status === 'confirmed').length,
      storyTotal: 0,
      coveredStories: 0,
      rate: 1,
      missingImages: designMissingImageTotal(modules.value)
    }
    bundle.value = null
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.design-overview-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}
.overview-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.overview-progress {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: var(--rg-text-2);
}
.overview-progress strong {
  font-size: 18px;
  color: var(--rg-text);
}
.overview-pending {
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 10.5px;
}
.overview-done {
  color: var(--rg-ok);
  background: var(--rg-ok-soft);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 10.5px;
}
.overview-missing {
  font-size: 11px;
  color: var(--rg-text-3);
}
.overview-missing.warn {
  color: var(--rg-warn);
}
.overview-coverage,
.overview-bundle {
  font-size: 11px;
  color: var(--rg-text-2);
}
.overview-bundle {
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 999px;
  padding: 1px 8px;
}
.overview-table-wrap {
  overflow-x: auto;
}
.ov-rate {
  margin-left: 3px;
  font-size: 9.5px;
  color: var(--rg-text-3);
}
.ov-uncovered {
  font-size: 10.5px;
  color: var(--rg-warn);
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.ov-ok {
  font-size: 10.5px;
  color: var(--rg-ok);
}
.overview-refresh {
  margin-left: auto;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 3px 10px;
  font-size: 11.5px;
  cursor: pointer;
}
.overview-refresh:hover:not(:disabled) {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.overview-note,
.overview-pending-list,
.overview-empty {
  margin: 4px 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--rg-text-3);
}
.overview-pending-list {
  color: var(--rg-warn);
}
.overview-error {
  margin: 4px 0;
  font-size: 11.5px;
  color: var(--rg-danger);
}
.overview-table {
  margin-top: 8px;
}
.ov-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 10px;
  color: var(--rg-text-3);
}
.ov-status {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.ov-status.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.ov-status.review {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.ov-warn {
  color: var(--rg-warn);
}
.ov-switch {
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 6px;
  padding: 1px 8px;
  font-size: 10.5px;
  cursor: pointer;
}
.ov-switch:hover {
  background: var(--rg-hover);
  color: var(--rg-text);
}
@media (max-width: 768px) {
  .design-overview-dialog :deep(.el-dialog) {
    width: calc(100vw - 24px) !important;
  }
}
</style>
