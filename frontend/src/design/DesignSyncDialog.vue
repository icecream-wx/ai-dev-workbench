<template>
  <el-dialog
    :model-value="modelValue"
    title="需求变更同步"
    width="min(820px, calc(100vw - 32px))"
    top="7vh"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @open="preview"
  >
    <div v-if="loading" class="sync-center">正在比对需求变更…</div>
    <div v-else-if="error" class="sync-center error">
      <p>{{ error }}</p>
      <el-button size="small" @click="preview">重试</el-button>
    </div>
    <div v-else-if="result" class="sync-body">
      <div class="sync-head">
        <div>
          <strong>需求输入 v{{ result.input.docVersion }}</strong>
          <span class="muted"> · 设计当前绑定 v{{ result.stale.designDocVersion ?? '—' }}</span>
        </div>
        <span class="muted">{{ result.stale.reason || '需求没有变化' }}</span>
      </div>

      <div class="sync-guide" data-testid="sync-guide">
        <strong>同步 ≠ 确认设计：</strong>
        选择下面任一同步方式后，设计输入会绑定到最新需求并回到草稿；关闭弹窗后请点击右上角「确认设计」完成确认。
      </div>

      <div class="diff-total">
        <span class="total add">新增 {{ result.diff.totals.added }}</span>
        <span class="total change">修改 {{ result.diff.totals.changed }}</span>
        <span class="total remove">删除 {{ result.diff.totals.removed }}</span>
      </div>

      <div class="diff-columns">
        <section class="diff-col">
          <h4>Scenes</h4>
          <p v-if="!hasDiff(result.diff.scenes)" class="muted">无变化</p>
          <div v-for="item in allEntries(result.diff.scenes)" :key="`s-${item.kind}-${item.id}`" :class="['diff-row', item.kind]">
            <span class="id-chip">{{ item.id }}</span>
            <span class="diff-title">{{ item.title }}</span>
            <span class="diff-kind">{{ diffLabel(item.kind) }}</span>
            <span v-if="item.changes.length" class="diff-changes">（{{ item.changes.join('、') }}）</span>
          </div>
        </section>
        <section class="diff-col">
          <h4>Epics</h4>
          <p v-if="!hasDiff(result.diff.epics)" class="muted">无变化</p>
          <div v-for="item in allEntries(result.diff.epics)" :key="`e-${item.kind}-${item.id}`" :class="['diff-row', item.kind]">
            <span class="id-chip">{{ item.id }}</span>
            <span class="diff-title">{{ item.title }}</span>
            <span class="diff-kind">{{ diffLabel(item.kind) }}</span>
            <span v-if="item.changes.length" class="diff-changes">（{{ item.changes.join('、') }}）</span>
          </div>
        </section>
        <section class="diff-col">
          <h4>Stories</h4>
          <p v-if="!hasDiff(result.diff.stories)" class="muted">无变化</p>
          <div v-for="item in allEntries(result.diff.stories)" :key="`t-${item.kind}-${item.id}`" :class="['diff-row', item.kind]">
            <span class="id-chip story">{{ item.id }}</span>
            <span class="diff-title">{{ item.title }}</span>
            <span class="diff-kind">{{ diffLabel(item.kind) }}</span>
            <span v-if="item.changes.length" class="diff-changes">（{{ item.changes.join('、') }}）</span>
          </div>
        </section>
      </div>

      <section class="affected">
        <h4>受影响的设计（按 requirementRefs）</h4>
        <div v-if="!hasAffected" class="muted">没有实体/页面引用变更的条目。</div>
        <div v-for="entity in result.affected.entities" :key="`ae-${entity.id}`" class="affected-row">
          <span class="kind-chip entity">实体</span>
          <span>{{ entity.name }}</span>
          <span class="muted">{{ entity.refs.join('、') }}</span>
        </div>
        <div v-for="set in result.affected.pageSets" :key="`as-${set.id}`" class="affected-row">
          <span class="kind-chip set">页面集</span>
          <span>{{ set.title }}</span>
          <span class="muted">{{ [set.epicId, ...set.storyIds].filter(Boolean).join('、') }}</span>
        </div>
        <div v-for="page in result.affected.pages" :key="`ap-${page.id}`" class="affected-row">
          <span class="kind-chip page">页面</span>
          <span>{{ page.title }}</span>
          <span class="muted">{{ page.refs.join('、') }}</span>
        </div>
      </section>

      <div v-if="result.warnings.length" class="sync-warnings">
        <p v-for="(warning, index) in result.warnings" :key="index">• {{ warning }}</p>
      </div>

      <p class="sync-note">
        「同步输入（保留设计）」只更新设计输入绑定并生成新版本，不改实体/页面内容；「同步并重置受影响项」会把受影响项置为草稿并清理失效引用，
        AI 重新生成需要你在实体/页面页手动触发或复核。两种同步都不会替你确认设计。
      </p>
    </div>

    <template #footer>
      <div class="sync-footer">
        <el-button size="small" @click="editRequirements">去修改需求</el-button>
        <div class="footer-spacer" />
        <el-button size="small" :disabled="applying" @click="defer">暂不处理</el-button>
        <el-button
          size="small"
          data-testid="sync-apply-additions"
          :loading="applying"
          :disabled="!result"
          @click="apply('additions')"
        >
          同步输入（保留设计）
        </el-button>
        <el-button
          size="small"
          type="primary"
          data-testid="sync-apply-regenerate"
          :loading="applying"
          :disabled="!result"
          @click="apply('regenerate')"
        >
          同步并重置受影响项
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DesignApiError, syncDesignInput } from './api'
import type { DesignInputDiffEntry, DesignInputDiffGroup, DesignInputSyncResult, DesignProjectPayload } from './types'

const props = defineProps<{ modelValue: boolean; appId: string; moduleId?: string }>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  applied: [DesignProjectPayload]
  'edit-requirements': []
}>()

const loading = ref(false)
const applying = ref(false)
const error = ref('')
const result = ref<DesignInputSyncResult | null>(null)

const hasAffected = computed(() => {
  const value = result.value
  if (!value) return false
  return value.affected.entities.length + value.affected.pages.length + value.affected.pageSets.length > 0
})

function hasDiff(group: DesignInputDiffGroup): boolean {
  return group.added.length + group.removed.length + group.changed.length > 0
}

function allEntries(group: DesignInputDiffGroup): Array<DesignInputDiffEntry & { kind: 'added' | 'removed' | 'changed' }> {
  return [
    ...group.added.map(item => ({ ...item, kind: 'added' as const })),
    ...group.changed.map(item => ({ ...item, kind: 'changed' as const })),
    ...group.removed.map(item => ({ ...item, kind: 'removed' as const }))
  ]
}

function diffLabel(kind: 'added' | 'removed' | 'changed'): string {
  if (kind === 'added') return '新增'
  if (kind === 'removed') return '删除'
  return '修改'
}

function showError(err: unknown): string {
  if (err instanceof DesignApiError && err.issues.length) return `${err.message}：${err.issues.join('；')}`
  return err instanceof Error ? err.message : String(err)
}

async function preview(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    result.value = await syncDesignInput(props.appId, 'preview', props.moduleId)
  } catch (err) {
    error.value = showError(err)
    result.value = null
  } finally {
    loading.value = false
  }
}

async function apply(mode: 'additions' | 'regenerate'): Promise<void> {
  if (!result.value || applying.value) return
  try {
    await ElMessageBox.confirm(
      mode === 'additions'
        ? '同步设计输入：新增/修改的 Story 会出现在覆盖度里，现有实体/页面内容不改。同步后设计会回到草稿，需要重新点击「确认设计」完成确认。'
        : '同步并重置受影响项：受影响实体/页面会被置为草稿、清理失效引用（不自动覆盖内容）。同步后设计会回到草稿，需要重新点击「确认设计」完成确认；AI 重新生成请在实体/页面页手动触发。',
      mode === 'additions' ? '同步输入（保留设计）' : '同步并重置受影响项',
      { type: 'warning', confirmButtonText: '继续同步', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  applying.value = true
  try {
    const applied = await syncDesignInput(props.appId, mode, props.moduleId)
    result.value = applied
    ElMessage.success(
      applied.stale.stale
        ? '已记录，但设计输入仍然过期'
        : '需求输入已同步；设计已回到草稿，请点击右上角「确认设计」'
    )
    emit('applied', applied.project)
    emit('update:modelValue', false)
  } catch (err) {
    ElMessage.error(showError(err))
  } finally {
    applying.value = false
  }
}

async function defer(): Promise<void> {
  if (applying.value) return
  applying.value = true
  try {
    await syncDesignInput(props.appId, 'defer', props.moduleId)
    ElMessage.info('已暂不处理；设计会保持“设计输入过期”提示')
    emit('update:modelValue', false)
  } catch (err) {
    ElMessage.error(showError(err))
  } finally {
    applying.value = false
  }
}

function editRequirements(): void {
  emit('update:modelValue', false)
  emit('edit-requirements')
}
</script>

<style scoped>
.sync-center {
  display: grid;
  place-items: center;
  grid-auto-flow: row;
  gap: 10px;
  min-height: 160px;
  font-size: 12.5px;
  color: var(--rg-text-3);
}
.sync-center.error {
  color: var(--rg-danger);
}
.sync-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: min(66vh, calc(100vh - 260px));
  overflow-y: auto;
  color: var(--rg-text);
}
.sync-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12.5px;
}
.sync-guide {
  border: 1px solid var(--rg-ai-border);
  background: var(--rg-ai-soft);
  color: var(--rg-text);
  border-radius: 9px;
  padding: 8px 11px;
  font-size: 11.5px;
  line-height: 1.7;
}
.sync-guide strong {
  color: var(--rg-ai);
}
.diff-total {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.total {
  font-size: 11px;
  border-radius: 999px;
  padding: 2px 9px;
}
.total.add {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.total.change {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.total.remove {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.diff-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.diff-col {
  background: var(--rg-surface-2);
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 9px 10px;
  min-width: 0;
}
.diff-col h4,
.affected h4 {
  margin: 0 0 6px;
  font-size: 11.5px;
  color: var(--rg-text-2);
}
.diff-row,
.affected-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  padding: 3px 0;
  border-bottom: 1px dashed var(--rg-border);
  flex-wrap: wrap;
}
.diff-row:last-child,
.affected-row:last-child {
  border-bottom: none;
}
.diff-row.added .diff-kind {
  color: var(--rg-ok);
}
.diff-row.removed .diff-title {
  text-decoration: line-through;
  color: var(--rg-danger);
}
.diff-row.removed .diff-kind {
  color: var(--rg-danger);
}
.diff-row.changed .diff-kind {
  color: var(--rg-ai);
}
.id-chip {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 9px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 4px;
  padding: 1px 4px;
}
.id-chip.story {
  color: var(--rg-accent);
  background: var(--rg-accent-soft);
}
.diff-title {
  flex: 1;
  min-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.diff-kind {
  font-size: 9.5px;
  flex-shrink: 0;
}
.diff-changes {
  color: var(--rg-text-3);
  font-size: 10px;
}
.affected {
  background: var(--rg-surface-2);
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 9px 11px;
}
.kind-chip {
  font-size: 9px;
  border-radius: 4px;
  padding: 1px 5px;
}
.kind-chip.entity {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.kind-chip.page {
  background: var(--rg-accent-soft);
  color: var(--rg-accent);
}
.kind-chip.set {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.sync-warnings {
  background: var(--rg-warn-soft);
  border: 1px solid var(--rg-warn-border);
  border-radius: 9px;
  padding: 7px 10px;
  font-size: 11px;
  color: var(--rg-warn);
}
.sync-warnings p {
  margin: 2px 0;
}
.sync-note {
  margin: 0;
  font-size: 11px;
  color: var(--rg-text-3);
  line-height: 1.7;
}
.muted {
  color: var(--rg-text-3);
  font-size: 11px;
}
.sync-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.footer-spacer {
  flex: 1;
}

@media (max-width: 820px) {
  .diff-columns {
    grid-template-columns: 1fr;
  }
  .sync-body {
    max-height: none;
  }
  .footer-spacer {
    flex-basis: 100%;
  }
}
</style>
