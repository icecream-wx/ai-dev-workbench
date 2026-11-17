<template>
  <el-dialog
    :model-value="modelValue"
    title="变更历史"
    width="min(860px, calc(100vw - 32px))"
    top="6vh"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @open="load"
  >
    <div class="csh-body">
      <p v-if="loading" class="csh-empty">正在加载变更历史…</p>
      <p v-else-if="error" class="csh-error">{{ error }}</p>
      <p v-else-if="!changeSets.length" class="csh-empty">还没有变更单；首次生成交接包时自动创建 #1「初始开发」。</p>
      <ul v-else class="csh-list">
        <li v-for="item in changeSets" :key="item.id" :class="['csh-item', { active: item.active }]">
          <div class="csh-row" @click="toggle(item.id)">
            <span class="csh-seq">#{{ item.seq }}</span>
            <strong class="csh-title">{{ item.title }}</strong>
            <span :class="['csh-status', item.status]">{{ changeSetStatusLabel(item.status) }}</span>
            <span class="csh-scope">{{ changeSetScopeLabel(item.scope) }}</span>
            <span v-if="item.modules && item.modules.length" class="csh-modules">{{ item.modules.length }} 模块</span>
            <span class="csh-range">{{ changeSetVersionRange(item) }}</span>
            <span class="csh-counts">{{ changeSetCountsLabel(item) }}</span>
            <span class="csh-time">{{ formatTime(item.createdAt) }}</span>
            <span class="csh-toggle">{{ expanded === item.id ? '收起' : '展开' }}</span>
          </div>

          <div v-if="expanded === item.id" class="csh-detail">
            <p v-if="item.description" class="csh-desc">{{ item.description }}</p>
            <p class="csh-meta">
              创建 {{ formatTime(item.createdAt) }}
              <template v-if="item.completedAt"> · 结束 {{ formatTime(item.completedAt) }}</template>
              <template v-if="item.baseAppStatus"> · 变更前状态 {{ item.baseAppStatus }}</template>
            </p>
            <p class="csh-meta">
              交接包：{{ item.baseHandoffVersion ? `基线 v${item.baseHandoffVersion}` : '无基线' }} →
              {{ item.currentHandoffVersion ? `v${item.currentHandoffVersion}` : '—' }}
            </p>

            <div v-if="item.modules && item.modules.length" class="csh-module-list">
              <div class="csh-module-head">本次变更模块（{{ item.modules.length }}）</div>
              <div v-for="module in item.modules" :key="module.moduleId" class="csh-module-row">
                <span class="csh-module-key">{{ module.moduleKey }}</span>
                <strong class="csh-module-title">{{ module.title }}</strong>
                <span class="csh-module-range">{{ moduleVersionRange(module, item) }}</span>
              </div>
            </div>

            <div v-if="item.changesMd" class="csh-md">
              <MarkdownView :markdown="item.changesMd" />
            </div>
            <p v-else class="csh-meta">
              {{ item.seq === 1 ? '初始开发（无基线差异）；生成交接包后记录摘要。' : '尚未生成交接包，暂无差异摘要。' }}
            </p>

            <div class="csh-actions">
              <button
                v-if="item.active && item.canCancel"
                type="button"
                class="csh-btn danger"
                :disabled="cancelling === item.id"
                @click.stop="cancel(item)"
              >
                {{ cancelling === item.id ? '取消中…' : '取消变更（恢复基线）' }}
              </button>
              <span v-else-if="item.active && item.cancelBlockedReason" class="csh-blocked">
                {{ item.cancelBlockedReason }}
              </span>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <template #footer>
      <span class="csh-hint">取消变更 = 恢复本次选中模块的需求/设计/模板/设计输入到变更前版本，并重新生成需求聚合；未选模块不动；变更中新增的模块会被归档（内容保留）。</span>
      <button type="button" class="csh-btn" @click="emit('update:modelValue', false)">关闭</button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MarkdownView from '../requirements/MarkdownView.vue'
import { cancelChangeSet, listChangeSets, type ChangeSetCancelResult } from './api'
import {
  changeSetCountsLabel,
  changeSetScopeLabel,
  changeSetStatusLabel,
  changeSetVersionRange
} from './labels.js'
import { cancelModuleSummary, moduleVersionRange } from './module-scope.js'
import type { ChangeSetInfo } from '../workbench/api'

const props = defineProps<{ modelValue: boolean; appId: string }>()
const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  changed: []
  cancelled: [ChangeSetCancelResult]
}>()

const changeSets = ref<ChangeSetInfo[]>([])
const loading = ref(false)
const error = ref('')
const expanded = ref('')
const cancelling = ref('')

function formatTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function toggle(id: string): void {
  expanded.value = expanded.value === id ? '' : id
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const data = await listChangeSets(props.appId)
    changeSets.value = data.changeSets
    if (!expanded.value) expanded.value = data.active?.id ?? data.changeSets[0]?.id ?? ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function cancel(item: ChangeSetInfo): Promise<void> {
  if (cancelling.value) return
  try {
    await ElMessageBox.confirm(
      `取消变更 #${item.seq}「${item.title}」？\n${cancelModuleSummary(item)}；未包含的模块保持不动。\n应用/开发会话会恢复到变更前状态，变更单标记为已取消；变更中产生的版本保留在版本历史。`,
      '取消变更',
      { type: 'warning', confirmButtonText: '取消变更', cancelButtonText: '返回' }
    )
  } catch {
    return
  }
  cancelling.value = item.id
  try {
    const result = await cancelChangeSet(props.appId, item.id)
    const modules = result.restored.modules ?? []
    const count = modules.length
    const archivedCount = modules.filter(module => module.archived).length
    ElMessage.success(
      `变更 #${item.seq} 已取消，已恢复${count ? ` ${count} 个模块` : '基线'}${
        archivedCount ? `（新增模块已归档 ${archivedCount} 个）` : ''
      }${result.restored.bundleVersion ? `（需求聚合 v${result.restored.bundleVersion}）` : ''}`
    )
    emit('cancelled', result)
    emit('changed')
    await load()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    cancelling.value = ''
  }
}
</script>

<style scoped>
.csh-body {
  max-height: min(64vh, calc(100vh - 240px));
  overflow: auto;
}
.csh-empty,
.csh-error {
  margin: 12px 4px;
  font-size: 12.5px;
  color: var(--rg-text-3);
}
.csh-error {
  color: var(--rg-danger);
}
.csh-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.csh-item {
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  overflow: hidden;
  background: var(--rg-surface);
}
.csh-item.active {
  border-color: var(--rg-ai-border);
  box-shadow: 0 0 0 3px var(--rg-ai-soft);
}
.csh-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 12px;
  color: var(--rg-text-2);
  flex-wrap: wrap;
}
.csh-row:hover {
  background: var(--rg-hover);
}
.csh-seq {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
}
.csh-title {
  color: var(--rg-text);
  font-size: 12.5px;
  min-width: 120px;
}
.csh-status {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10.5px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.csh-status.development {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.csh-status.requirements {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.csh-status.design {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.csh-status.cancelled {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.csh-scope,
.csh-counts {
  font-size: 11px;
  color: var(--rg-text-3);
}
.csh-modules {
  font-size: 10.5px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 999px;
  padding: 1px 7px;
}
.csh-module-list {
  margin: 6px 0 8px;
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  background: var(--rg-surface);
  padding: 7px 10px;
}
.csh-module-head {
  font-size: 10.5px;
  color: var(--rg-text-3);
  margin-bottom: 5px;
}
.csh-module-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 3px 0;
  font-size: 11px;
  color: var(--rg-text-2);
}
.csh-module-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 10px;
  color: var(--rg-text-3);
}
.csh-module-title {
  font-size: 11.5px;
  color: var(--rg-text);
}
.csh-module-range {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.csh-range {
  font-size: 11px;
  color: var(--rg-text-2);
}
.csh-time {
  margin-left: auto;
  font-size: 11px;
  color: var(--rg-text-3);
}
.csh-toggle {
  font-size: 11px;
  color: var(--rg-link);
  white-space: nowrap;
}
.csh-detail {
  border-top: 1px solid var(--rg-border);
  padding: 10px 14px 12px;
  background: var(--rg-surface-2);
}
.csh-desc {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--rg-text-2);
  white-space: pre-wrap;
}
.csh-meta {
  margin: 0 0 4px;
  font-size: 11px;
  color: var(--rg-text-3);
}
.csh-md {
  margin: 8px 0;
  max-height: 320px;
  overflow: auto;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
}
.csh-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.csh-blocked {
  font-size: 11px;
  color: var(--rg-warn);
}
.csh-hint {
  margin-right: auto;
  font-size: 11px;
  color: var(--rg-text-3);
  line-height: 1.5;
  text-align: left;
}
.csh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.csh-btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.csh-btn.danger {
  color: var(--rg-danger);
  border-color: var(--rg-danger-border);
}
.csh-btn.danger:hover:not(:disabled) {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.csh-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 768px) {
  .csh-body {
    max-height: none;
  }
  .csh-row {
    gap: 6px 8px;
  }
  .csh-time {
    margin-left: 0;
    width: 100%;
  }
  .csh-hint {
    display: none;
  }
}
</style>
