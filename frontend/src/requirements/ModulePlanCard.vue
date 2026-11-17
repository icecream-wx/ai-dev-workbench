<template>
  <section class="plan-card" data-testid="module-plan-card">
    <header class="plan-head">
      <div class="plan-title-wrap">
        <span class="plan-badge">模块拆分建议</span>
        <span class="plan-count">{{ draft.modules.length }} 个模块</span>
      </div>
      <span v-if="appliedLabel" class="plan-applied">{{ appliedLabel }}</span>
      <span v-else-if="busy" class="plan-busy">{{ busyLabel }}</span>
    </header>

    <p class="plan-intro">
      每个模块会各自生成一份完整模板 PRD（草稿）。可以改名、调整说明/范围、排序、增删模块，再应用。
    </p>

    <ol class="plan-list">
      <li
        v-for="(item, index) in draft.modules"
        :key="item.clientId"
        class="plan-item"
        data-testid="plan-module-row"
      >
        <div class="plan-item-head">
          <span class="plan-index">{{ index + 1 }}</span>
          <input
            v-model="item.title"
            class="plan-title-input"
            data-testid="plan-module-title"
            :disabled="frozen"
            placeholder="模块名（业务域，如 商品管理）"
            maxlength="120"
          />
          <div class="plan-item-actions">
            <button type="button" class="icon-btn" title="上移" aria-label="上移" :disabled="frozen || index === 0" @click="move(index, -1)">↑</button>
            <button
              type="button"
              class="icon-btn"
              title="下移"
              aria-label="下移"
              :disabled="frozen || index === draft.modules.length - 1"
              @click="move(index, 1)"
            >
              ↓
            </button>
            <button type="button" class="icon-btn danger" title="删除模块" aria-label="删除模块" :disabled="frozen || draft.modules.length <= 1" @click="remove(index)">
              ×
            </button>
          </div>
        </div>

        <textarea
          v-model="item.description"
          class="plan-desc"
          rows="2"
          :disabled="frozen"
          placeholder="模块说明（职责边界）"
        />

        <label class="plan-field">
          <span class="plan-field-label">范围 / 排除项（每行一条）</span>
          <textarea
            class="plan-scope"
            rows="3"
            :disabled="frozen"
            :value="scopeToText(item.scope)"
            placeholder="商品档案 CRUD&#10;商品明细 CRUD&#10;不涉及：支付"
            @input="setScope(item, $event)"
          />
        </label>

        <details v-if="item.suggestedEpics.length" class="plan-epics">
          <summary>建议 Epics（{{ item.suggestedEpics.length }}；仅预览，不直接写入）</summary>
          <ul>
            <li v-for="(epic, epicIndex) in item.suggestedEpics" :key="`${epic.title}-${epicIndex}`">
              <span class="epic-title">{{ epic.title }}</span>
              <span v-if="epic.stories.length" class="epic-stories">{{ epic.stories.join('、') }}</span>
            </li>
          </ul>
        </details>
      </li>
    </ol>

    <button v-if="!frozen" type="button" class="plan-add" data-testid="plan-add-module" @click="add">＋ 添加模块</button>

    <div v-if="plan.dependencies.length" class="plan-block">
      <div class="plan-block-title">跨模块依赖</div>
      <ul class="plan-lines">
        <li v-for="(dep, index) in plan.dependencies" :key="`dep-${index}`">
          <strong>{{ keyLabel(dep.from) }}</strong> → <strong>{{ keyLabel(dep.to) }}</strong>
          <span v-if="dep.description" class="line-desc">：{{ dep.description }}</span>
        </li>
      </ul>
    </div>

    <div v-if="plan.coverage.length" class="plan-block">
      <div class="plan-block-title">需求覆盖</div>
      <ul class="plan-lines">
        <li v-for="(item, index) in plan.coverage" :key="`cov-${index}`">
          {{ item.requirement }} → <strong>{{ keyLabel(item.moduleKey) }}</strong>
        </li>
      </ul>
    </div>

    <div v-if="plan.unassigned.length" class="plan-block warn">
      <div class="plan-block-title">未分配 / 待确认</div>
      <ul class="plan-lines">
        <li v-for="(item, index) in plan.unassigned" :key="`un-${index}`">
          {{ item.requirement }}<span v-if="item.reason" class="line-desc">：{{ item.reason }}</span>
        </li>
      </ul>
    </div>

    <div v-if="allWarnings.length" class="plan-block warn" data-testid="plan-warnings">
      <div class="plan-block-title">提醒</div>
      <ul class="plan-lines">
        <li v-for="(warning, index) in allWarnings" :key="`warn-${index}`">{{ warning }}</li>
      </ul>
    </div>

    <div v-if="plan.openIssues.length" class="plan-block">
      <div class="plan-block-title">待确认问题</div>
      <ul class="plan-lines">
        <li v-for="(issue, index) in plan.openIssues" :key="`issue-${index}`">{{ issue }}</li>
      </ul>
    </div>

    <div v-if="errors.length" class="plan-errors" data-testid="plan-validation">
      <div class="plan-block-title">无法应用</div>
      <ul class="plan-lines">
        <li v-for="(error, index) in errors" :key="`err-${index}`">{{ error }}</li>
      </ul>
    </div>

    <div v-if="planState?.error" class="plan-errors" data-testid="plan-error">{{ planState.error }}</div>

    <ModuleGenerationProgress
      v-if="generation"
      :state="generation"
      :disabled="readonly"
      @retry="emit('retry', $event)"
      @cancel="emit('cancel')"
    />

    <footer v-if="!appliedLabel" class="plan-foot">
      <button
        type="button"
        class="plan-primary"
        data-testid="plan-apply"
        :disabled="frozen || readonly || errors.length > 0"
        @click="apply"
      >
        {{ planState?.status === 'applying' ? '应用中…' : '应用拆分并生成' }}
      </button>
      <button
        type="button"
        class="plan-secondary"
        data-testid="plan-keep-single"
        :disabled="frozen || readonly"
        @click="emit('keep-single')"
      >
        保持单模块
      </button>
    </footer>
    <p v-else class="plan-done-hint">
      {{ appliedMode === 'single' ? '已保持单模块：文档生成后可直接逐章节审阅并确认。' : '已应用拆分：模块已创建，可在大纲切换模块逐份审阅与确认。' }}
    </p>
    <div v-if="canRegenerate" class="plan-regen">
      <button type="button" class="plan-secondary" data-testid="plan-regenerate" @click="emit('regenerate')">
        重新生成全部模块
      </button>
      <p class="plan-regen-hint">
        刷新后生成进度不保留；将按已应用拆分重新生成全部模块，已完成模块会生成新的 AI 版本（旧版本保留，可回滚）。
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ModulePlan, ModulePlanUiState } from './api'
import ModuleGenerationProgress from './ModuleGenerationProgress.vue'
import {
  addPlanModule,
  createPlanDraft,
  generationSummary,
  movePlanModule,
  planKeyLabel,
  removePlanModule,
  scopeToText,
  textToScope,
  toApiPlan
} from './module-plan-helpers.js'
import { validateModulePlan } from './module-plan-protocol.js'

const props = defineProps<{
  plan: ModulePlan
  planState?: ModulePlanUiState | null
  /** 刷新后从当前模块/文档推导的已应用结果（无运行态时使用） */
  outcome?: { status: 'done'; mode: 'split' | 'single' } | null
  /** RMP-2：已应用计划类型；replan 时隐藏 RMP-1“重新生成全部模块” */
  planKind?: 'initial' | 'replan' | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  apply: [ModulePlan]
  'keep-single': []
  regenerate: []
  retry: [moduleId: string]
  cancel: []
}>()

const draft = ref(createPlanDraft(props.plan))

watch(
  () => props.plan,
  next => {
    if (next) draft.value = createPlanDraft(next)
  }
)

const validation = computed(() => validateModulePlan(toApiPlan(draft.value)))
const errors = computed(() => validation.value.errors)
const generation = computed(() => props.planState?.generation ?? null)
const generationStats = computed(() => (generation.value ? generationSummary(generation.value) : null))

const busy = computed(
  () => props.planState?.status === 'applying' || props.planState?.status === 'generating' || generation.value?.running === true
)

const appliedMode = computed<'split' | 'single' | null>(() => {
  if (props.planState?.status === 'done' && props.planState.mode) return props.planState.mode
  if (props.outcome?.status === 'done') return props.outcome.mode
  return null
})

const appliedLabel = computed(() => {
  if (!appliedMode.value) return ''
  if (busy.value) return appliedMode.value === 'single' ? '已保持单模块 · 生成中' : '已应用 · 生成中'
  const stats = generationStats.value
  if (stats && stats.done < stats.total) {
    // 取消/失败/部分完成后仍有未完成模块：不要用“已生成 N 个模块”暗示全部完成
    return appliedMode.value === 'single' ? '已保持单模块 · 未完成' : `已应用 · ${stats.done}/${stats.total} 模块`
  }
  if (appliedMode.value === 'single') return '已保持单模块'
  return stats ? `已应用 · 已生成 ${stats.done} 个模块` : '已应用拆分'
})

const busyLabel = computed(() => {
  if (props.planState?.status === 'applying') return '正在创建模块…'
  return '生成中…'
})

const frozen = computed(() => Boolean(appliedMode.value) || busy.value || props.readonly === true)

/** MF3：已应用但无运行态（如刷新后）时，让用户可显式重新生成全部模块；RMP-2 replan 后不再适用 */
const canRegenerate = computed(
  () =>
    Boolean(appliedMode.value) &&
    !busy.value &&
    !generation.value &&
    props.readonly !== true &&
    props.planKind !== 'replan'
)

const allWarnings = computed(() => {
  const list = [...(props.plan.warnings ?? []), ...validation.value.warnings]
  return Array.from(new Set(list.filter(Boolean)))
})

function keyLabel(key: string): string {
  return planKeyLabel(draft.value, key)
}

function setScope(item: { scope: string[] }, event: Event): void {
  const target = event.target as HTMLTextAreaElement | null
  item.scope = textToScope(target?.value ?? '')
}

function move(index: number, delta: number): void {
  draft.value.modules = movePlanModule(draft.value.modules, index, delta)
}

function remove(index: number): void {
  draft.value.modules = removePlanModule(draft.value.modules, index)
}

function add(): void {
  draft.value.modules = addPlanModule(draft.value.modules)
}

function apply(): void {
  if (frozen.value || errors.value.length) return
  emit('apply', toApiPlan(draft.value))
}
</script>

<style scoped>
.plan-card {
  border: 1px solid var(--rg-ai-border);
  background: var(--rg-surface);
  border-radius: 10px;
  padding: 10px 11px;
  margin-top: 7px;
  max-width: 100%;
  min-width: 0;
}
.plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  flex-wrap: wrap;
}
.plan-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.plan-badge {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 999px;
  padding: 2px 9px;
}
.plan-count {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.plan-applied {
  font-size: 10.5px;
  color: var(--rg-ok);
  background: var(--rg-ok-soft);
  border-radius: 999px;
  padding: 1px 8px;
}
.plan-busy {
  font-size: 10.5px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 999px;
  padding: 1px 8px;
}
.plan-intro {
  margin: 6px 0 8px;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--rg-text-3);
}
.plan-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.plan-item {
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  background: var(--rg-surface-2);
  padding: 7px 8px;
  min-width: 0;
}
.plan-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.plan-index {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 10px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.plan-title-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--rg-border);
  border-radius: 6px;
  background: var(--rg-surface);
  color: var(--rg-text);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 7px;
  font-family: inherit;
}
.plan-title-input:disabled,
.plan-desc:disabled,
.plan-scope:disabled {
  opacity: 0.75;
}
.plan-item-actions {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}
.icon-btn {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}
.icon-btn:hover:not(:disabled) {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.icon-btn.danger:hover:not(:disabled) {
  color: var(--rg-danger);
  border-color: var(--rg-danger-border);
  background: var(--rg-danger-soft);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.plan-desc,
.plan-scope {
  display: block;
  width: 100%;
  border: 1px solid var(--rg-border);
  border-radius: 6px;
  background: var(--rg-surface);
  color: var(--rg-text);
  font-size: 11px;
  line-height: 1.55;
  padding: 5px 7px;
  resize: vertical;
  font-family: inherit;
  margin-top: 5px;
  box-sizing: border-box;
}
.plan-field {
  display: block;
  margin-top: 2px;
}
.plan-field-label {
  display: block;
  margin-top: 5px;
  font-size: 10px;
  color: var(--rg-text-3);
}
.plan-epics {
  margin-top: 5px;
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.plan-epics summary {
  cursor: pointer;
  color: var(--rg-text-2);
}
.plan-epics ul {
  margin: 4px 0 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.epic-title {
  color: var(--rg-text-2);
  font-weight: 600;
}
.epic-stories {
  margin-left: 5px;
}
.plan-add {
  margin-top: 8px;
  width: 100%;
  border: 1px dashed var(--rg-border-strong);
  background: transparent;
  color: var(--rg-text-2);
  border-radius: 7px;
  padding: 5px 8px;
  font-size: 11px;
  cursor: pointer;
}
.plan-add:hover {
  color: var(--rg-ai);
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
}
.plan-block {
  margin-top: 9px;
  border-top: 1px dashed var(--rg-border);
  padding-top: 7px;
}
.plan-block.warn .plan-block-title {
  color: var(--rg-warn);
}
.plan-block-title {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--rg-text-2);
  margin-bottom: 3px;
}
.plan-lines {
  margin: 0;
  padding-left: 15px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 10.5px;
  line-height: 1.55;
  color: var(--rg-text-2);
  word-break: break-word;
}
.plan-lines strong {
  color: var(--rg-text);
}
.line-desc {
  color: var(--rg-text-3);
}
.plan-errors {
  margin-top: 9px;
  border: 1px solid var(--rg-danger-border);
  background: var(--rg-danger-soft);
  border-radius: 7px;
  padding: 6px 8px;
  color: var(--rg-danger);
  font-size: 10.5px;
}
.plan-errors .plan-block-title {
  color: var(--rg-danger);
}
.plan-errors .plan-lines {
  color: var(--rg-danger);
}
.plan-foot {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 10px;
  border-top: 1px dashed var(--rg-border);
  padding-top: 8px;
}
.plan-primary {
  border: 1px solid var(--rg-ai);
  background: var(--rg-ai);
  color: var(--rg-ink-contrast);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}
.plan-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.plan-secondary {
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 5px 11px;
  font-size: 11.5px;
  cursor: pointer;
}
.plan-secondary:hover:not(:disabled) {
  border-color: var(--rg-ai-border);
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
}
.plan-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.plan-done-hint {
  margin: 8px 0 0;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--rg-text-3);
}
.plan-regen {
  margin-top: 8px;
  border-top: 1px dashed var(--rg-border);
  padding-top: 8px;
}
.plan-regen-hint {
  margin: 5px 0 0;
  font-size: 10px;
  line-height: 1.6;
  color: var(--rg-text-3);
}

@media (max-width: 768px) {
  .plan-card {
    padding: 9px;
  }
  .plan-title-input,
  .plan-desc,
  .plan-scope {
    font-size: 12px;
  }
}
</style>
