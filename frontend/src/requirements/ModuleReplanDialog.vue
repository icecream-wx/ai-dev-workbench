<template>
  <el-dialog
    :model-value="modelValue"
    :title="`AI 规划模块 · ${appName || '需求'}`"
    width="min(980px, calc(100vw - 24px))"
    top="4vh"
    append-to-body
    class="module-replan-dialog"
    :close-on-click-modal="false"
    :before-close="beforeClose"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="mrp" data-testid="module-replan-dialog">
      <header class="mrp-head">
        <div>
          <strong class="mrp-title">根据当前全部需求重新拆分模块</strong>
          <p class="mrp-desc">
            读取当前全部未归档模块的需求文档/Epics/Stories 后重新规划。结构变化不搬运章节：新/变更模块重新生成完整 PRD；
            旧模块未匹配时归档（内容/版本/对话保留，可恢复）。
          </p>
        </div>
        <span class="mrp-step">{{ stepLabel }}</span>
      </header>

      <!-- Step 1：当前模块 + 指令 -->
      <section v-if="step === 'input'" class="mrp-body" data-testid="replan-step-input">
        <div class="mrp-block">
          <div class="mrp-block-title">当前模块（{{ activeModuleCount }}）</div>
          <ul class="mrp-current">
            <li v-for="module in activeModules" :key="module.id">
              <span class="mrp-key">{{ module.moduleKey }}</span>
              <strong>{{ module.title }}</strong>
              <span :class="['mrp-status', module.docStatus ?? 'draft']">{{ statusLabel(module.docStatus) }}</span>
              <span v-if="module.docVersion" class="mrp-version">v{{ module.docVersion }}</span>
              <span v-if="module.docStatus === 'confirmed'" class="mrp-confirmed-chip">已确认</span>
            </li>
          </ul>
        </div>

        <label class="mrp-field">
          <span class="mrp-label">调整指令</span>
          <textarea
            v-model="instruction"
            class="mrp-instruction"
            data-testid="replan-instruction"
            rows="3"
            maxlength="2000"
            placeholder="例如：把订单管理拆成订单管理和售后管理，商品管理保持不变"
            :disabled="previewing"
          />
          <span class="mrp-hint">默认“根据当前全部需求内容重新拆分模块”；也可以说明合并/拆分/改名要求。</span>
        </label>

        <div v-if="previewing" class="mrp-loading" data-testid="replan-preview-loading">
          正在让 AI 基于当前全部需求重新规划…
          <button type="button" class="mrp-link" data-testid="replan-cancel-preview" @click="cancelPreview">取消</button>
        </div>
        <div v-if="previewError" class="mrp-error" data-testid="replan-preview-error">
          {{ previewError }}
          <button type="button" class="mrp-link" data-testid="replan-preview-retry" @click="startPreview">重试</button>
        </div>
      </section>

      <!-- Step 2：预览 diff / 编辑 / 应用 -->
      <section v-else-if="step === 'preview'" class="mrp-body" data-testid="replan-step-preview">
        <div v-if="preview?.sourceTruncated" class="mrp-warn" data-testid="replan-truncated">
          当前全部需求内容较长，规划基于截断摘要；请重点复核模块边界与覆盖。
        </div>

        <div v-if="summary.requiresReopenConfirmed" class="mrp-warn confirmed" data-testid="replan-confirmed-warning">
          <strong>本次调整会重新打开 {{ summary.affectedConfirmed.length }} 个已确认模块（退回草稿）</strong>
          <ul>
            <li v-for="module in summary.affectedConfirmed" :key="module.id">{{ module.moduleKey }} {{ module.title }}</li>
          </ul>
          <p>应用级需求确认需重新完成；keep 的已确认模块不受影响。</p>
          <label class="mrp-check">
            <input v-model="reopenConfirmed" type="checkbox" data-testid="replan-reopen-confirm" />
            允许重新打开已确认模块
          </label>
        </div>

        <div class="mrp-list">
          <article v-for="(item, index) in draftModules" :key="item.clientId" class="mrp-row" data-testid="replan-row">
            <div class="mrp-row-head">
              <span class="mrp-index">{{ index + 1 }}</span>
              <input
                v-model="item.title"
                class="mrp-title-input"
                data-testid="replan-row-title"
                maxlength="120"
                placeholder="模块名（业务域，如 商品管理）"
              />
              <span :class="['mrp-action-chip', effectiveAction(item)]" data-testid="replan-row-action">
                {{ actionLabel(effectiveAction(item)) }}
              </span>
              <div class="mrp-row-actions">
                <button type="button" class="mrp-icon" title="上移" :disabled="index === 0" @click="move(index, -1)">↑</button>
                <button
                  type="button"
                  class="mrp-icon"
                  title="下移"
                  :disabled="index === draftModules.length - 1"
                  @click="move(index, 1)"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="mrp-icon danger"
                  title="删除模块"
                  :disabled="draftModules.length <= 1"
                  data-testid="replan-row-remove"
                  @click="remove(index)"
                >
                  ×
                </button>
              </div>
            </div>

            <div class="mrp-row-grid">
              <label class="mrp-field small">
                <span class="mrp-label">映射现有模块</span>
                <select
                  class="mrp-select"
                  data-testid="replan-row-map"
                  :value="item.existingModuleId || ''"
                  @change="onMap(index, $event)"
                >
                  <option value="">新建模块</option>
                  <option v-for="option in optionsFor(index)" :key="option.id" :value="option.id">{{ option.label }}</option>
                </select>
              </label>
              <label class="mrp-field small">
                <span class="mrp-label">动作</span>
                <select v-model="item.action" class="mrp-select" data-testid="replan-row-action-select">
                  <option v-for="action in REPLAN_ACTIONS" :key="action" :value="action">{{ actionLabel(action) }}</option>
                </select>
              </label>
            </div>

            <textarea
              v-model="item.description"
              class="mrp-description"
              data-testid="replan-row-description"
              rows="2"
              placeholder="模块说明（职责边界）"
            />

            <label class="mrp-field">
              <span class="mrp-label">范围 / 排除项（每行一条；keep/rename 不允许改范围）</span>
              <textarea
                class="mrp-scope"
                data-testid="replan-row-scope"
                rows="3"
                :value="scopeToText(item.scope)"
                placeholder="订单创建&#10;订单查询&#10;不涉及：支付"
                @input="onScope(item, $event)"
              />
            </label>

            <details v-if="item.suggestedEpics.length" class="mrp-epics">
              <summary>建议 Epics（{{ item.suggestedEpics.length }}；仅预览，不直接写入）</summary>
              <ul>
                <li v-for="(epic, epicIndex) in item.suggestedEpics" :key="`${epic.title}-${epicIndex}`">
                  <span class="mrp-epic-title">{{ epic.title }}</span>
                  <span v-if="epic.stories.length" class="mrp-epic-stories">{{ epic.stories.join('、') }}</span>
                </li>
              </ul>
            </details>

            <p v-if="rowHint(item)" class="mrp-row-hint" :class="{ error: rowHint(item).isError }">
              {{ rowHint(item).text }}
            </p>
          </article>
        </div>

        <button type="button" class="mrp-add" data-testid="replan-add" @click="add">＋ 添加模块</button>

        <div v-if="summary.archiveModules.length" class="mrp-block warn" data-testid="replan-archive">
          <div class="mrp-block-title">将归档（{{ summary.archiveModules.length }}）</div>
          <ul class="mrp-archive">
            <li v-for="module in summary.archiveModules" :key="module.id">
              <span class="mrp-key">{{ module.moduleKey }}</span>
              <strong>{{ module.title }}</strong>
              <span v-if="module.status === 'confirmed'" class="mrp-confirmed-chip">已确认</span>
              <span class="mrp-archive-note">内容/版本/对话保留，可恢复</span>
              <button type="button" class="mrp-link" data-testid="replan-keep-archived" @click="keepArchived(module)">保留</button>
            </li>
          </ul>
        </div>

        <div v-if="previewPlan?.dependencies.length" class="mrp-block">
          <div class="mrp-block-title">跨模块依赖</div>
          <ul class="mrp-lines">
            <li v-for="(dependency, index) in previewPlan.dependencies" :key="`dep-${index}`">
              <strong>{{ keyLabel(dependency.from) }}</strong> → <strong>{{ keyLabel(dependency.to) }}</strong>
              <span v-if="dependency.description" class="mrp-muted">：{{ dependency.description }}</span>
            </li>
          </ul>
        </div>

        <div v-if="previewPlan?.coverage.length" class="mrp-block">
          <div class="mrp-block-title">需求覆盖</div>
          <ul class="mrp-lines">
            <li v-for="(item, index) in previewPlan.coverage" :key="`cov-${index}`">
              {{ item.requirement }} → <strong>{{ keyLabel(item.moduleKey) }}</strong>
            </li>
          </ul>
        </div>

        <div v-if="previewPlan?.unassigned.length" class="mrp-block warn">
          <div class="mrp-block-title">未分配 / 待确认</div>
          <ul class="mrp-lines">
            <li v-for="(item, index) in previewPlan.unassigned" :key="`un-${index}`">
              {{ item.requirement }}<span v-if="item.reason" class="mrp-muted">：{{ item.reason }}</span>
            </li>
          </ul>
        </div>

        <div v-if="allWarnings.length" class="mrp-block warn" data-testid="replan-warnings">
          <div class="mrp-block-title">提醒</div>
          <ul class="mrp-lines">
            <li v-for="(warning, index) in allWarnings" :key="`warn-${index}`">{{ warning }}</li>
          </ul>
        </div>

        <div v-if="previewPlan?.openIssues.length" class="mrp-block">
          <div class="mrp-block-title">待确认问题</div>
          <ul class="mrp-lines">
            <li v-for="(issue, index) in previewPlan.openIssues" :key="`issue-${index}`">{{ issue }}</li>
          </ul>
        </div>

        <div v-if="serverErrors.length" class="mrp-block warn" data-testid="replan-server-errors">
          <div class="mrp-block-title">服务端校验提示（可继续编辑）</div>
          <ul class="mrp-lines">
            <li v-for="(error, index) in serverErrors" :key="`server-err-${index}`">服务端：{{ error }}</li>
          </ul>
          <p class="mrp-hint">应用时会再次校验；以客户端校验与后端 400 结果为准。</p>
        </div>

        <div v-if="errors.length" class="mrp-errors" data-testid="replan-errors">
          <div class="mrp-block-title">无法应用</div>
          <ul class="mrp-lines">
            <li v-for="(error, index) in errors" :key="`err-${index}`">{{ error }}</li>
          </ul>
        </div>
        <div v-if="applyError" class="mrp-error" data-testid="replan-apply-error">{{ applyError }}</div>
      </section>

      <!-- Step 3：已应用 / 生成进度 -->
      <section v-else class="mrp-body" data-testid="replan-step-applied">
        <div class="mrp-applied" data-testid="replan-applied-summary">
          <strong>已应用调整</strong>
          <span>{{ appliedSummary }}</span>
        </div>
        <p class="mrp-hint">
          {{
            generation
              ? '正在为新建/重新生成的模块生成完整 PRD（草稿）；生成中可随时取消，已完成模块保留。'
              : '没有需要重新生成的模块（全部保留/改名）。可以关闭并继续逐模块审阅。'
          }}
        </p>

        <ModuleGenerationProgress
          v-if="generation"
          :state="generation"
          :disabled="false"
          @retry="retryGeneration"
          @cancel="cancelGeneration"
        />

        <div v-if="done" class="mrp-finished" data-testid="replan-finished">
          <span v-if="generationAllDone">已生成 {{ generationStats?.done ?? 0 }} 个模块（草稿），请逐模块确认。</span>
          <span v-else-if="generation">部分模块未完成，可在上方点“重试”；结构已应用，旧模块已归档保留。</span>
          <span v-else>结构已更新；未生成文档的模块可按现有流程继续编辑/生成。</span>
        </div>
        <p class="mrp-hint">
          旧模块归档后仍可在模块列表“已归档”中查看/恢复；新模块文档为重新生成，请逐模块审阅。
        </p>
      </section>
    </div>

    <template #footer>
      <div class="mrp-foot">
        <template v-if="step === 'input'">
          <el-button size="small" :disabled="previewing" @click="close">取消</el-button>
          <el-button
            size="small"
            type="primary"
            :loading="previewing"
            data-testid="replan-generate"
            @click="startPreview"
          >
            {{ previewError ? '重新生成建议' : '生成建议' }}
          </el-button>
        </template>
        <template v-else-if="step === 'preview'">
          <el-button size="small" :disabled="applying" @click="close">取消</el-button>
          <el-button size="small" :disabled="applying" data-testid="replan-back" @click="step = 'input'">返回修改</el-button>
          <el-button
            size="small"
            type="primary"
            :disabled="!canApply"
            :loading="applying"
            data-testid="replan-apply"
            @click="apply"
          >
            {{ applyLabel }}
          </el-button>
        </template>
        <template v-else>
          <el-button size="small" :disabled="busy" data-testid="replan-close" @click="close">关闭</el-button>
        </template>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ModuleGenerationProgress from './ModuleGenerationProgress.vue'
import {
  applyModuleReplan,
  previewModuleReplan,
  streamModuleGeneration,
  type ModuleGenerationEvent,
  type ModuleGenerationReason,
  type ModuleGenerationUiState,
  type ModulePlan,
  type ModuleReplanApplyResult,
  type ModuleReplanCurrentModule,
  type ModuleReplanPreview,
  type RequirementModule
} from './api'
import { createGenerationState, firstGeneratedModuleId, generationSummary, reduceGenerationEvent } from './module-plan-helpers.js'
import {
  REPLAN_ACTIONS,
  actionLabel,
  resolveReplanAction,
  validateReplanDraft
} from './module-replan-protocol.js'
import {
  addReplanModule,
  applyMapping,
  createReplanDraft,
  firstReplanTargetId,
  mappingOptions,
  movePlanModule,
  removePlanModule,
  replanSummaryText,
  restoreArchiveModule,
  scopeMatchesCurrent,
  scopeToText,
  summarizeReplan,
  textToScope,
  toReplanApiPlan
} from './module-replan-helpers.js'

const DEFAULT_INSTRUCTION = '根据当前全部需求内容重新拆分模块'

const props = defineProps<{
  modelValue: boolean
  appId: string
  appName: string
  /** 当前全部模块（含归档；step 1 只显示未归档） */
  modules: RequirementModule[]
  /** 预览/应用前落盘当前编辑（失败则中止） */
  beforeRequest?: () => Promise<void>
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  applied: [ModuleReplanApplyResult]
  finished: [{ firstModuleId: string; generation: ModuleGenerationUiState | null; summary: string }]
  busy: [boolean]
}>()

interface ReplanDraftModule {
  clientId: string
  key: string
  title: string
  description: string
  scope: string[]
  suggestedEpics: Array<{ title: string; stories: string[] }>
  existingModuleId: string | null
  action: string
}

const step = ref<'input' | 'preview' | 'applied'>('input')
const instruction = ref(DEFAULT_INSTRUCTION)
const previewing = ref(false)
const previewError = ref('')
const preview = ref<ModuleReplanPreview | null>(null)
const previewPlan = computed(() => preview.value?.plan ?? null)
const currentModules = ref<ModuleReplanCurrentModule[]>([])
const draftModules = ref<ReplanDraftModule[]>([])
const draftMeta = ref({
  dependencies: [] as Array<{ from: string; to: string; description: string }>,
  coverage: [] as Array<{ requirement: string; moduleKey: string }>,
  unassigned: [] as Array<{ requirement: string; reason: string }>,
  openIssues: [] as string[],
  warnings: [] as string[]
})
const reopenConfirmed = ref(false)
const applying = ref(false)
const applyError = ref('')
const applied = ref<ModuleReplanApplyResult | null>(null)
const generation = ref<ModuleGenerationUiState | null>(null)
const done = ref(false)
let previewAbort: AbortController | null = null
let generationAbort: AbortController | null = null
let generationSeq = 0

const activeModules = computed(() => props.modules.filter(module => !module.archived))
const activeModuleCount = computed(() => activeModules.value.length)

const busy = computed(() => previewing.value || applying.value || generation.value?.running === true)
const stepLabel = computed(() =>
  step.value === 'input' ? '① 生成建议' : step.value === 'preview' ? '② 预览并调整' : '③ 应用结果'
)

const draft = computed(() => ({
  kind: 'replan',
  instruction: instruction.value.trim() || DEFAULT_INSTRUCTION,
  modules: draftModules.value,
  ...draftMeta.value
}))

const validation = computed(() => validateReplanDraft(draft.value, currentModules.value))
const errors = computed(() => validation.value.errors)
const summary = computed(() => summarizeReplan(draftModules.value, currentModules.value))
/** MF-RMP2-4：服务端 preview 语义校验提示（展示，不阻塞编辑后的 apply） */
const serverErrors = computed(() => preview.value?.errors ?? [])
/** MF-RMP2-3：仅当全部模块成功且无失败/取消/全局错误时才显示“已生成 N 个” */
const generationStats = computed(() => (generation.value ? generationSummary(generation.value) : null))
const generationAllDone = computed(() => {
  const stats = generationStats.value
  if (!stats || !generation.value) return false
  return (
    stats.finished === true &&
    stats.total > 0 &&
    stats.done === stats.total &&
    stats.failed === 0 &&
    stats.cancelled === 0 &&
    generation.value.cancelled !== true &&
    !generation.value.globalError
  )
})
const allWarnings = computed(() =>
  Array.from(
    new Set([
      ...(preview.value?.warnings ?? []),
      ...draftMeta.value.warnings,
      ...validation.value.warnings
    ].filter(Boolean))
  )
)
const canApply = computed(
  () =>
    step.value === 'preview' &&
    !applying.value &&
    errors.value.length === 0 &&
    (!summary.value.requiresReopenConfirmed || reopenConfirmed.value)
)
const applyLabel = computed(() =>
  summary.value.generation.length
    ? `应用调整并重新生成 ${summary.value.generation.length} 个模块`
    : '应用调整（不重新生成）'
)
const appliedSummary = computed(() => replanSummaryText(applied.value))

watch(
  () => props.modelValue,
  open => {
    if (open) reset()
    else {
      previewAbort?.abort()
      generationSeq += 1
      generationAbort?.abort()
    }
  }
)

watch(
  () => busy.value,
  value => emit('busy', value),
  { immediate: true }
)

function reset(): void {
  step.value = 'input'
  instruction.value = DEFAULT_INSTRUCTION
  previewing.value = false
  previewError.value = ''
  preview.value = null
  currentModules.value = []
  draftModules.value = []
  draftMeta.value = { dependencies: [], coverage: [], unassigned: [], openIssues: [], warnings: [] }
  reopenConfirmed.value = false
  applying.value = false
  applyError.value = ''
  applied.value = null
  generation.value = null
  done.value = false
  generationSeq += 1
  generationAbort?.abort()
  generationAbort = null
}

function statusLabel(status: RequirementModule['docStatus']): string {
  if (status === 'confirmed') return '已确认'
  if (status === 'review') return '待审核'
  return '草稿'
}

function effectiveAction(item: ReplanDraftModule): string {
  return resolveReplanAction(item, currentModules.value)
}

function optionsFor(index: number): Array<{ id: string; label: string }> {
  return mappingOptions(draftModules.value, currentModules.value, index)
}

function keyLabel(key: string): string {
  return draftModules.value.find(item => item.key === key)?.title || key
}

function rowHint(item: ReplanDraftModule): { text: string; isError: boolean } | null {
  const action = effectiveAction(item)
  if (action === 'create') return { text: '新建模块（空 v1）；应用后生成完整 PRD。', isError: false }
  if (action === 'regenerate') return { text: '保留模块 ID/对话/版本历史；应用后生成新的 AI 版本。', isError: false }
  if (action === 'rename') {
    if (!scopeMatchesCurrent(item, currentModules.value)) {
      return { text: '范围已变化：keep/rename 不生成新内容，请改为「重新生成」或恢复原范围。', isError: true }
    }
    return {
      text:
        item.action === 'keep'
          ? '标题/说明已变化：将按「改名」处理（保留文档/版本/对话，已确认需重开）。'
          : '只更新标题/说明与文档标题，不生成新版本；已确认需重开。',
      isError: false
    }
  }
  if (!scopeMatchesCurrent(item, currentModules.value)) {
    return { text: '范围已变化：keep/rename 不生成新内容，请改为「重新生成」或恢复原范围。', isError: true }
  }
  return { text: '内容/版本/确认均保持不变。', isError: false }
}

function move(index: number, delta: number): void {
  draftModules.value = movePlanModule(draftModules.value, index, delta)
}

function remove(index: number): void {
  draftModules.value = removePlanModule(draftModules.value, index)
}

function add(): void {
  draftModules.value = addReplanModule(draftModules.value)
}

function onMap(index: number, event: Event): void {
  const target = event.target as HTMLSelectElement | null
  draftModules.value = applyMapping(draftModules.value, index, target?.value ?? '', currentModules.value)
}

function onScope(item: ReplanDraftModule, event: Event): void {
  const target = event.target as HTMLTextAreaElement | null
  item.scope = textToScope(target?.value ?? '')
}

function keepArchived(module: ModuleReplanCurrentModule): void {
  draftModules.value = restoreArchiveModule(draftModules.value, module)
}

async function startPreview(): Promise<void> {
  if (previewing.value) return
  previewing.value = true
  previewError.value = ''
  const controller = new AbortController()
  previewAbort = controller
  try {
    if (props.beforeRequest) await props.beforeRequest()
    const result = await previewModuleReplan(props.appId, instruction.value.trim() || DEFAULT_INSTRUCTION, controller.signal)
    preview.value = result
    currentModules.value = result.currentModules
    const created = createReplanDraft(result.plan)
    created.instruction = instruction.value.trim() || DEFAULT_INSTRUCTION
    draftModules.value = created.modules as ReplanDraftModule[]
    draftMeta.value = {
      dependencies: created.dependencies,
      coverage: created.coverage,
      unassigned: created.unassigned,
      openIssues: created.openIssues,
      warnings: created.warnings
    }
    reopenConfirmed.value = false
    step.value = 'preview'
  } catch (error) {
    if (controller.signal.aborted) {
      previewError.value = '已取消生成建议'
      return
    }
    previewError.value = error instanceof Error ? error.message : String(error)
  } finally {
    if (previewAbort === controller) previewAbort = null
    previewing.value = false
  }
}

function cancelPreview(): void {
  previewAbort?.abort()
}

async function apply(): Promise<void> {
  if (!canApply.value) return
  applying.value = true
  applyError.value = ''
  try {
    if (props.beforeRequest) await props.beforeRequest()
    const plan = toReplanApiPlan(
      { ...draftMeta.value, modules: draftModules.value, instruction: instruction.value.trim() || DEFAULT_INSTRUCTION },
      { currentModules: currentModules.value, instruction: instruction.value.trim() || DEFAULT_INSTRUCTION }
    )
    const result = await applyModuleReplan(props.appId, plan as ModulePlan, reopenConfirmed.value)
    applied.value = result
    step.value = 'applied'
    emit('applied', result)
    if (result.generation.length) {
      await runGeneration(result.generation, 'replan')
    } else {
      done.value = true
      emit('finished', { firstModuleId: firstReplanTargetId(result), generation: null, summary: replanSummaryText(result) })
    }
  } catch (error) {
    applyError.value = error instanceof Error ? error.message : String(error)
  } finally {
    applying.value = false
  }
}

function retryGeneration(moduleId: string): void {
  const item = generation.value?.items.find(current => current.moduleId === moduleId)
  if (!item || generation.value?.running) return
  void runGeneration([{ moduleId, title: item.title }], 'retry', { retry: true })
}

function cancelGeneration(): void {
  const controller = generationAbort
  if (!controller || !generation.value?.running) return
  controller.abort()
  generation.value = reduceGenerationEvent(generation.value, { type: 'all-done', ok: false, cancelled: true, failed: [] })
}

async function runGeneration(
  items: Array<{ moduleId: string; title: string }>,
  reason: ModuleGenerationReason,
  options: { retry?: boolean } = {}
): Promise<void> {
  if (!items.length) return
  const seq = ++generationSeq
  generationAbort?.abort()
  const controller = new AbortController()
  generationAbort = controller

  const previous = generation.value
  const state = createGenerationState({ modules: items, reason })
  if (options.retry && previous) {
    const previousById = new Map(previous.items.map(item => [item.moduleId, item]))
    state.items = state.items.map(item => {
      const old = previousById.get(item.moduleId)
      return old ? { ...old, status: 'waiting', error: '', warnings: [] } : item
    })
    for (const old of previous.items) {
      if (!state.items.some(item => item.moduleId === old.moduleId)) state.items.push({ ...old })
    }
  }
  generation.value = state

  try {
    await streamModuleGeneration(
      props.appId,
      { moduleIds: items.map(item => item.moduleId), reason },
      (event: ModuleGenerationEvent) => {
        if (seq !== generationSeq) return
        if (generation.value) generation.value = reduceGenerationEvent(generation.value, event)
      },
      controller.signal
    )
    if (seq === generationSeq && generation.value?.running) {
      generation.value = {
        ...generation.value,
        running: false,
        ok: false,
        globalError: '生成连接中断（未收到完成事件），请重试'
      }
    }
  } catch (error) {
    if (seq !== generationSeq) return
    const aborted = controller.signal.aborted || (error instanceof Error && error.message.includes('中止'))
    const message = aborted ? '已取消剩余模块' : error instanceof Error ? error.message : String(error)
    if (generation.value) {
      const current = generation.value
      generation.value = aborted
        ? reduceGenerationEvent(current, { type: 'all-done', ok: false, cancelled: true, failed: [] })
        : {
            ...current,
            running: false,
            ok: false,
            globalError: message,
            items: current.items.map(item =>
              item.status === 'done' ? item : { ...item, status: 'error', error: item.error || message }
            )
          }
    }
  } finally {
    if (seq !== generationSeq) return
    generationAbort = null
    done.value = true
    const generatedId = firstGeneratedModuleId(generation.value)
    emit('finished', {
      firstModuleId: generatedId || firstReplanTargetId(applied.value),
      generation: generation.value,
      summary: replanSummaryText(applied.value)
    })
  }
}

function beforeClose(next: () => void): void {
  if (busy.value) {
    ElMessage.warning('正在处理或生成，请先取消或等待完成')
    return
  }
  next()
}

function close(): void {
  if (busy.value) return
  emit('update:modelValue', false)
}
</script>

<style scoped>
.mrp {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--rg-text);
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 2px;
}
.mrp-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.mrp-title {
  font-size: 13.5px;
  color: var(--rg-text);
}
.mrp-desc {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--rg-text-3);
}
.mrp-step {
  flex-shrink: 0;
  font-size: 10px;
  border-radius: 999px;
  padding: 2px 9px;
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.mrp-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mrp-block {
  border: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  border-radius: 9px;
  padding: 8px 10px;
  min-width: 0;
}
.mrp-block.warn {
  border-color: var(--rg-warn-border);
  background: var(--rg-warn-soft);
}
.mrp-block-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--rg-text-2);
  margin-bottom: 4px;
}
.mrp-block.warn .mrp-block-title {
  color: var(--rg-warn);
}
.mrp-current {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
}
.mrp-current li {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--rg-text-2);
}
.mrp-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 9.5px;
  color: var(--rg-text-3);
}
.mrp-status {
  font-size: 10px;
  border-radius: 999px;
  padding: 0 7px;
  background: var(--rg-fill);
  color: var(--rg-text-3);
}
.mrp-status.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.mrp-status.review {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.mrp-version {
  font-size: 10px;
  color: var(--rg-text-3);
}
.mrp-confirmed-chip {
  font-size: 9.5px;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.mrp-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.mrp-field.small {
  flex: 1;
}
.mrp-label {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.mrp-instruction,
.mrp-description,
.mrp-scope,
.mrp-title-input,
.mrp-select {
  border: 1px solid var(--rg-border);
  border-radius: 6px;
  background: var(--rg-surface);
  color: var(--rg-text);
  font-family: inherit;
  font-size: 11.5px;
  padding: 5px 7px;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}
.mrp-instruction,
.mrp-description,
.mrp-scope {
  resize: vertical;
  line-height: 1.55;
}
.mrp-hint {
  margin: 0;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--rg-text-3);
}
.mrp-loading,
.mrp-error,
.mrp-warn {
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 11px;
  line-height: 1.6;
}
.mrp-loading {
  border: 1px dashed var(--rg-ai-border);
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.mrp-error {
  border: 1px solid var(--rg-danger-border);
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
  word-break: break-word;
}
.mrp-warn {
  border: 1px solid var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.mrp-warn.confirmed strong {
  display: block;
}
.mrp-warn ul {
  margin: 4px 0;
  padding-left: 17px;
}
.mrp-warn p {
  margin: 4px 0;
}
.mrp-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--rg-text);
  margin-top: 4px;
}
.mrp-link {
  border: none;
  background: transparent;
  color: var(--rg-ai);
  font-size: 10.5px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0 2px;
}
.mrp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mrp-row {
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  background: var(--rg-surface);
  padding: 8px 9px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.mrp-row-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.mrp-index {
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
.mrp-title-input {
  flex: 1;
  font-weight: 600;
  font-size: 12px;
}
.mrp-action-chip {
  flex-shrink: 0;
  font-size: 9.5px;
  border-radius: 999px;
  padding: 1px 7px;
  border: 1px solid var(--rg-border);
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.mrp-action-chip.keep {
  border-color: var(--rg-ok-border);
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.mrp-action-chip.rename {
  border-color: var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.mrp-action-chip.regenerate {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.mrp-action-chip.create {
  border-color: var(--rg-border-strong);
  color: var(--rg-text);
}
.mrp-row-actions {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}
.mrp-icon {
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
.mrp-icon:hover:not(:disabled) {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.mrp-icon.danger:hover:not(:disabled) {
  color: var(--rg-danger);
  border-color: var(--rg-danger-border);
  background: var(--rg-danger-soft);
}
.mrp-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.mrp-row-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.mrp-epics {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.mrp-epics summary {
  cursor: pointer;
  color: var(--rg-text-2);
}
.mrp-epics ul {
  margin: 4px 0 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mrp-epic-title {
  color: var(--rg-text-2);
  font-weight: 600;
}
.mrp-epic-stories {
  margin-left: 5px;
}
.mrp-row-hint {
  margin: 0;
  font-size: 10px;
  line-height: 1.55;
  color: var(--rg-text-3);
}
.mrp-row-hint.error {
  color: var(--rg-danger);
}
.mrp-add {
  width: 100%;
  border: 1px dashed var(--rg-border-strong);
  background: transparent;
  color: var(--rg-text-2);
  border-radius: 7px;
  padding: 5px 8px;
  font-size: 11px;
  cursor: pointer;
}
.mrp-add:hover {
  color: var(--rg-ai);
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
}
.mrp-archive {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
}
.mrp-archive li {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--rg-text-2);
}
.mrp-archive-note {
  font-size: 10px;
  color: var(--rg-text-3);
}
.mrp-lines {
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
.mrp-muted {
  color: var(--rg-text-3);
}
.mrp-errors {
  border: 1px solid var(--rg-danger-border);
  background: var(--rg-danger-soft);
  border-radius: 8px;
  padding: 7px 10px;
  color: var(--rg-danger);
  font-size: 10.5px;
}
.mrp-errors .mrp-block-title {
  color: var(--rg-danger);
}
.mrp-applied {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  border: 1px solid var(--rg-ok-border);
  background: var(--rg-ok-soft);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 11.5px;
  color: var(--rg-ok);
}
.mrp-finished {
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--rg-text-2);
}
.mrp-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .mrp {
    max-height: 66vh;
  }
  .mrp-title-input,
  .mrp-instruction,
  .mrp-description,
  .mrp-scope,
  .mrp-select {
    font-size: 12px;
  }
  .mrp-row-grid {
    flex-direction: column;
  }
}
</style>
