<template>
  <el-dialog
    :model-value="modelValue"
    title="需求总览"
    width="min(860px, calc(100vw - 32px))"
    top="7vh"
    append-to-body
    class="req-overview-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="ov">
      <div class="ov-summary">
        <div class="ov-stat">
          <span class="ov-stat-label">必选模块已确认</span>
          <strong class="ov-stat-value">{{ progress.requiredConfirmed }} / {{ progress.requiredTotal }}</strong>
        </div>
        <div class="ov-stat">
          <span class="ov-stat-label">全部模块</span>
          <strong class="ov-stat-value">{{ progress.confirmed }} / {{ progress.total }}</strong>
        </div>
        <div class="ov-stat">
          <span class="ov-stat-label">需求聚合版本</span>
          <strong class="ov-stat-value">{{ bundle?.latest ? `v${bundle.latest.version}` : '未生成' }}</strong>
          <span v-if="bundle?.latest" class="ov-hash" :title="bundle.latest.hash">
            {{ shortHash(bundle.latest.hash) }} · {{ formatTime(bundle.latest.createdAt) }}
          </span>
        </div>
        <div class="ov-stat">
          <span class="ov-stat-label">当前内容</span>
          <strong class="ov-stat-value" :class="!bundle?.latest ? '' : drifted ? 'warn' : 'ok'">
            {{ !bundle?.latest ? '尚未生成聚合版本' : drifted ? '已变化（未落库）' : '与聚合版本一致' }}
          </strong>
          <span class="ov-hash" :title="bundle?.bundleHash">{{ shortHash(bundle?.bundleHash) }}</span>
        </div>
      </div>

      <div v-if="progress.pending.length" class="ov-pending">
        <strong>待确认模块：</strong>
        <button v-for="item in progress.pending" :key="item.moduleId" type="button" class="ov-pending-chip" @click="select(item.moduleId)">
          {{ item.moduleKey }} {{ item.title }}
        </button>
      </div>
      <div v-else class="ov-done">
        <strong>全部必选模块已确认</strong>
        <span v-if="appStatus === 'requirements'">可以完成需求阶段并进入设计。</span>
        <span v-else>应用已进入{{ stageLabel }}阶段。</span>
      </div>

      <div v-if="appStatus !== 'requirements'" class="ov-stage-note">
        当前应用处于{{ stageLabel }}阶段，需求文档只读；如需修改需求请走「重新编辑需求」或变更单。
      </div>

      <div class="ov-modules">
        <button
          v-for="module in activeModules"
          :key="module.id"
          type="button"
          :class="['ov-card', { on: module.id === currentModuleId }]"
          @click="select(module.id)"
        >
          <span class="ov-card-head">
            <span class="ov-key">{{ module.moduleKey }}</span>
            <strong>{{ module.title }}</strong>
            <span v-if="module.required" class="ov-req">必选</span>
            <span :class="['ov-status', statusClass(module)]">{{ statusLabel(module) }}</span>
          </span>
          <span class="ov-card-meta">
            <span>{{ versionLabel(module) }}</span>
            <span v-if="module.ownerLabel">负责人：{{ module.ownerLabel }}</span>
            <span v-else>负责人：—</span>
          </span>
          <span v-if="module.description" class="ov-card-desc">{{ module.description }}</span>
        </button>
      </div>

      <p v-if="!activeModules.length" class="ov-empty">还没有需求模块。</p>

      <p v-if="bundle?.latest && drifted" class="ov-drift-hint">
        “完成需求阶段”会按当前内容生成新的需求聚合版本；已确认版本仍可在版本历史查看。
      </p>
    </div>
    <template #footer>
      <div class="ov-footer">
        <el-button size="small" :loading="loading" @click="emit('refresh')">刷新</el-button>
        <el-button size="small" :disabled="confirming" @click="emit('update:modelValue', false)">关闭</el-button>
        <el-button
          size="small"
          type="primary"
          :disabled="!canComplete || confirming"
          :loading="confirming"
          @click="emit('confirm')"
        >
          {{ confirming ? '提交中…' : '完成需求阶段' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RequirementBundle, RequirementModule } from './api'
import { moduleStatusLabel, moduleVersionLabel, progressOf, shortHash } from './module-helpers.js'

const props = defineProps<{
  modelValue: boolean
  appName: string
  modules: RequirementModule[]
  bundle: RequirementBundle | null
  loading?: boolean
  confirming?: boolean
  appStatus: string
  currentModuleId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  select: [string]
  confirm: []
  refresh: []
}>()

const progress = computed(() => progressOf(props.modules))
const activeModules = computed(() => props.modules.filter(module => !module.archived))
const drifted = computed(() => Boolean(props.bundle?.latest && props.bundle.latest.hash !== props.bundle.bundleHash))
const canComplete = computed(() => props.appStatus === 'requirements' && progress.value.allRequiredConfirmed)
const stageLabel = computed(() => (props.appStatus === 'design' ? '设计' : props.appStatus === 'requirements' ? '需求' : '开发'))

function statusLabel(module: RequirementModule): string {
  return moduleStatusLabel(module)
}

function versionLabel(module: RequirementModule): string {
  return moduleVersionLabel(module)
}

function statusClass(module: RequirementModule): string {
  if (module.archived) return 'archived'
  if (module.docStatus === 'confirmed') return 'confirmed'
  if (module.docStatus === 'review') return 'review'
  return 'draft'
}

function formatTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function select(moduleId: string): void {
  emit('select', moduleId)
  emit('update:modelValue', false)
}
</script>

<style scoped>
.ov {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: var(--rg-text);
}
.ov-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.ov-stat {
  border: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  border-radius: 10px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.ov-stat-label {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.ov-stat-value {
  font-size: 15px;
  color: var(--rg-text);
}
.ov-stat-value.warn {
  color: var(--rg-warn);
  font-size: 12.5px;
}
.ov-stat-value.ok {
  color: var(--rg-ok);
  font-size: 12.5px;
}
.ov-hash {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 10px;
  color: var(--rg-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ov-pending,
.ov-done {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  border-radius: 9px;
  padding: 8px 11px;
  font-size: 11.5px;
}
.ov-pending {
  border: 1px solid var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.ov-done {
  border: 1px solid var(--rg-ok-border);
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.ov-pending-chip {
  border: 1px solid var(--rg-warn-border);
  background: var(--rg-surface);
  color: var(--rg-warn);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 11px;
  cursor: pointer;
}
.ov-pending-chip:hover {
  background: var(--rg-warn-soft);
}
.ov-stage-note {
  border: 1px solid var(--rg-border);
  background: var(--rg-fill);
  color: var(--rg-text-2);
  border-radius: 9px;
  padding: 8px 11px;
  font-size: 11.5px;
  line-height: 1.6;
}
.ov-modules {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.ov-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  border-radius: 10px;
  padding: 9px 11px;
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.ov-card:hover {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.ov-card.on {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
}
.ov-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12.5px;
}
.ov-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 9.5px;
  color: var(--rg-text-3);
}
.ov-req {
  font-size: 9px;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border-radius: 999px;
  padding: 0 5px;
}
.ov-status {
  margin-left: auto;
  border-radius: 999px;
  padding: 0 6px;
  font-size: 10px;
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
.ov-card-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.ov-card-desc {
  font-size: 11px;
  color: var(--rg-text-2);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ov-empty {
  margin: 0;
  padding: 18px 0;
  text-align: center;
  font-size: 12px;
  color: var(--rg-text-3);
}
.ov-drift-hint {
  margin: 0;
  font-size: 11px;
  color: var(--rg-text-3);
  line-height: 1.6;
}
.ov-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
@media (max-width: 900px) {
  .ov-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ov-modules {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 768px) {
  .ov-footer .el-button {
    min-height: 32px;
  }
}
</style>
