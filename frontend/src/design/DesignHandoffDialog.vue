<template>
  <Teleport to="body">
    <div v-if="modelValue" class="mask" @click.self="close">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="开发交接包">
        <header class="head">
          <div>
            <h2>开发交接包</h2>
            <p>
              由已确认需求文档 + 设计（实体/页面原型）+ 原型模板确定性生成：00—05、schema.sql、
              prototype-template.json、manifest.json 与 prototypes/。
            </p>
          </div>
          <button type="button" class="icon-btn" aria-label="关闭" title="关闭" @click="close">×</button>
        </header>

        <div v-if="meta" class="meta">
          <span class="badge">v{{ meta.version }}</span>
          <span v-if="meta.changeSet" class="chip">{{ changeSetLabel }}</span>
          <span v-if="props.mode === 'view' && !meta.changeSet?.baselineHandoffVersion" class="chip muted">初始开发</span>
          <span>hash <code>{{ shortHash(meta.hash) }}</code></span>
          <span>{{ formatTime(meta.createdAt) }}</span>
          <span>目录 <code>{{ meta.docsDir }}</code></span>
          <span v-if="meta.baselineHandoffVersion">基线 v{{ meta.baselineHandoffVersion }}</span>
        </div>
        <div v-else class="meta empty-meta">
          尚未生成交接包；可先预览，确认无误后生成并进入开发。
        </div>

        <div v-if="activeScale" class="scale-row" data-testid="handoff-scale">
          <span class="scale-title">规模：<strong>{{ scaleCountsLabel(activeScale) }}</strong></span>
          <template v-if="scaleBadgeInfo">
            <span class="chip warn" data-testid="handoff-scale-badge">{{ scaleBadgeInfo.label }}</span>
            <span class="hint warn" data-testid="handoff-scale-triggers">{{ scaleTriggerText }}</span>
            <button type="button" class="link-btn" @click="openFile('04-PLAN.md')">查看 04-PLAN.md 的分阶段建议</button>
            <span v-if="mode === 'preview'" class="hint">生成后可在 04-PLAN.md 查看</span>
          </template>
        </div>
        <div v-else-if="liveRows.length" class="scale-row" data-testid="handoff-scale">
          <span class="scale-title">规模：<strong>{{ liveCountsLabel }}</strong></span>
          <span class="hint">点击“预览”查看完整规模（Story/页面/文本）与生成结果</span>
        </div>

        <section v-if="moduleRows.length" class="module-section" data-testid="handoff-modules">
          <div class="module-head">
            <strong>模块（{{ moduleRows.length }}）</strong>
            <span v-if="requirementsBundleLabel" class="hint">{{ requirementsBundleLabel }}</span>
            <span :class="['chip', moduleBlockers.length ? 'warn' : 'ok']">
              {{ moduleBlockers.length ? `${moduleBlockers.length} 个未就绪` : '全部已确认' }}
            </span>
          </div>
          <div class="module-table-wrap">
            <table class="module-table">
              <thead>
                <tr>
                  <th>模块</th>
                  <th>需求</th>
                  <th>设计</th>
                  <th>实体/页面集/页面</th>
                  <th>缺图</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in moduleRows" :key="row.id" :class="{ blocked: row.blocked, changed: row.changeState === 'changed' }">
                  <td>
                    <strong>{{ row.key }}</strong>
                    <div class="module-title">{{ row.title }}</div>
                  </td>
                  <td>
                    v{{ row.reqVersion ?? '—' }}
                    <div :class="['module-sub', { warn: row.reqStatus !== 'confirmed' }]">{{ reqStatusLabel(row.reqStatus) }}</div>
                  </td>
                  <td>
                    v{{ row.designVersion ?? '—' }}
                    <div :class="['module-sub', { warn: row.designStatus !== 'confirmed' }]">{{ designStatusLabel(row.designStatus) }}</div>
                  </td>
                  <td>{{ row.entityCount }} / {{ row.pageSetCount }} / {{ row.pageCount }}</td>
                  <td :class="{ warn: row.missingImages > 0 }">{{ row.missingImages }}</td>
                  <td>
                    <span v-if="row.changeState === 'unchanged'" class="chip muted">本次未变更</span>
                    <span v-else-if="row.changeState === 'added'" class="chip">新增模块</span>
                    <span v-else-if="row.changeState === 'changed'" class="chip">有变更</span>
                    <span v-else-if="row.blocked" class="chip warn">未就绪</span>
                    <span v-else class="chip ok">就绪</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="moduleBlockers.length && isEnterMode" class="hint warn">
            全部必选模块完成设计确认且原型 PNG 齐全后才能生成：{{ moduleBlockers.slice(0, 4).join('；') }}{{ moduleBlockers.length > 4 ? '…' : '' }}
          </p>
          <p v-else-if="moduleRows.some(row => row.stale)" class="hint warn">
            有模块需求已变更（stale）：请先同步设计输入并重新确认该模块。
          </p>
        </section>

        <div class="toolbar">
          <button type="button" class="btn" :disabled="busy !== ''" @click="load">刷新</button>
          <button type="button" class="btn" :disabled="busy !== ''" @click="preview">预览（不写盘）</button>
          <button v-if="canGenerate" type="button" class="btn primary" :disabled="busy !== '' || generateBlocked" @click="generate">
            {{ busy === 'generate' ? '生成中…' : generateLabel }}
          </button>
          <span v-else class="hint warn">{{ noActiveHint }}</span>
          <span v-if="mode === 'preview'" class="hint warn">当前显示的是预览内容，尚未写入应用目录</span>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
        <div v-if="issues.length" class="issue-box">
          <strong>校验未通过，修正后重试：</strong>
          <ul>
            <li v-for="(issue, index) in issues" :key="index">{{ issue }}</li>
          </ul>
        </div>
        <div v-if="warnings.length" class="warning-box">
          <strong>提示（不阻塞）：</strong>
          <ul>
            <li v-for="(warning, index) in warnings" :key="index">{{ warning }}</li>
          </ul>
        </div>

        <div class="body">
          <aside class="files">
            <button
              v-for="file in files"
              :key="file.name"
              type="button"
              :class="['file', { active: file.name === activeFile }]"
              @click="activeFile = file.name"
            >
              <span class="file-kind">{{ kindLabel(file.kind) }}</span>
              <span class="file-name">{{ file.name }}</span>
              <small>{{ formatSize(file.size) }}</small>
            </button>
            <p v-if="!files.length" class="files-empty">暂无文件</p>
          </aside>

          <section class="preview">
            <div class="preview-head">
              <strong>{{ activeFile || '（未选择文件）' }}</strong>
              <span v-if="activeFileMeta" class="preview-kind">{{ kindLabel(activeFileMeta.kind) }}</span>
            </div>
            <div v-if="!activeFileMeta" class="preview-empty">
              <p>{{ mode === 'preview' ? '点击“预览”查看生成结果。' : '生成后在这里查看文件内容。' }}</p>
            </div>
            <div v-else-if="activeFileMeta.missing" class="preview-empty">
              <p>该版本的文件已被新版本覆盖，只能查看元数据；请查看最新交接包。</p>
            </div>
            <div v-else-if="activeFileMeta.kind === 'image'" class="image-preview">
              <img v-if="activeFileMeta.url" :src="activeFileMeta.url" :alt="activeFileMeta.name" />
              <p v-else class="hint">预览不包含图片文件；生成交接包后可在文件列表中查看 PNG。</p>
              <p class="hint">PNG 是视觉参考；页面契约见 <code>03-PAGES.md</code>。</p>
            </div>
            <pre v-else class="code-preview">{{ activeContent }}</pre>
          </section>
        </div>

        <footer class="foot">
          <span class="hint">生成会覆盖 <code>docs/handoff/</code> 下同名文件，并记录版本/hash 与变更单。</span>
          <button type="button" class="btn" @click="close">关闭</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  DesignApiError,
  generateDesignHandoff,
  getDesignHandoff,
  previewDesignHandoff,
  type DesignHandoffFileView,
  type DesignHandoffMeta,
  type DesignHandoffModuleSummary,
  type DesignHandoffPreviewResult,
  type DesignHandoffScale
} from './api'
import type { RequirementModule } from '../requirements/api'
import type { DesignModuleSummary } from '../workbench/api'
import { scaleBadge, scaleCountsLabel, scaleTriggerLabels } from './handoff-scale.js'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    appId: string
    /** enter：设计阶段“生成交接包并进入开发”；view：开发/完成阶段查看与重新生成 */
    mode?: 'enter' | 'view'
    initialFile?: string
    /** 是否允许生成：无 active 变更单且已有交接包时为 false（纯代码修复不需要新交接包） */
    canGenerate?: boolean
    /** 当前进行中的变更单（用于“生成变更交接包”文案） */
    activeChangeSet?: { seq: number } | null
    /** M6：生成前的实时模块状态（设计 Studio 传入；view 模式可省略） */
    requirementModules?: RequirementModule[]
    designModules?: DesignModuleSummary[]
  }>(),
  { canGenerate: true, initialFile: '' }
)
const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  generated: [result: { handoff: DesignHandoffMeta; developmentStarted: boolean; warnings: string[] }]
}>()

const NO_ACTIVE_CHANGE_SET_HINT = '如需修改需求/设计，请先发起变更；纯代码修复请直接在开发会话进行'

const busy = ref<'' | 'load' | 'preview' | 'generate'>('')
const error = ref('')
const issues = ref<string[]>([])
const warnings = ref<string[]>([])
const meta = ref<DesignHandoffMeta | null>(null)
const currentFiles = ref<DesignHandoffFileView[]>([])
const previewFiles = ref<DesignHandoffFileView[]>([])
const previewScale = ref<DesignHandoffScale | null>(null)
const previewModules = ref<DesignHandoffModuleSummary[]>([])
const previewRequirementsBundle = ref<{ version: number; hash: string } | null>(null)
const mode = ref<'current' | 'preview'>('current')
const activeFile = ref('')

interface ModuleRow {
  id: string
  key: string
  title: string
  required: boolean
  reqVersion: number | null
  reqStatus: 'draft' | 'review' | 'confirmed' | null
  designVersion: number | null
  designStatus: string | null
  entityCount: number
  pageSetCount: number
  pageCount: number
  missingImages: number
  stale: boolean
  changeState: 'added' | 'changed' | 'unchanged' | null
  blocked: boolean
  reason: string
}

/** 生成前：来自设计 Studio 的实时模块状态（需求 + 设计） */
const liveRows = computed<ModuleRow[]>(() => {
  const requirementModules = (props.requirementModules ?? []).filter(module => !module.archived)
  if (!requirementModules.length) return []
  const designById = new Map((props.designModules ?? []).map(module => [module.moduleId, module]))
  return requirementModules.map(module => {
    const design = designById.get(module.id)
    const reqStatus = module.docStatus
    const designStatus = design?.status ?? null
    const missingImages = design?.missingImages ?? 0
    const reasons: string[] = []
    if (module.required && reqStatus !== 'confirmed') reasons.push('需求未确认')
    if (module.required && designStatus !== 'confirmed') reasons.push('设计未确认')
    if (missingImages > 0) reasons.push(`缺 ${missingImages} 张原型 PNG`)
    return {
      id: module.id,
      key: module.moduleKey,
      title: module.title,
      required: module.required,
      reqVersion: module.docVersion ?? null,
      reqStatus,
      designVersion: design?.version ?? null,
      designStatus,
      entityCount: design?.entityCount ?? 0,
      pageSetCount: design?.pageSetCount ?? 0,
      pageCount: design?.pageCount ?? 0,
      missingImages,
      stale: false,
      changeState: null,
      blocked: reasons.length > 0,
      reason: reasons.join(' / ')
    }
  })
})

/** 已生成/预览：来自交接包返回的模块摘要 */
function rowsFromSummaries(summaries: DesignHandoffModuleSummary[]): ModuleRow[] {
  return summaries.map(summary => {
    const reasons: string[] = []
    if (summary.required && !summary.requirements.confirmed) reasons.push('需求未确认')
    if (summary.required && summary.design.status !== 'confirmed') reasons.push('设计未确认')
    if (summary.missingImages > 0) reasons.push(`缺 ${summary.missingImages} 张原型 PNG`)
    if (summary.stale) reasons.push('需求已变更（stale）')
    return {
      id: summary.id,
      key: summary.key,
      title: summary.title,
      required: summary.required,
      reqVersion: summary.requirements.version,
      reqStatus: summary.requirements.confirmed ? 'confirmed' : 'draft',
      designVersion: summary.design.version,
      designStatus: summary.design.status,
      entityCount: summary.counts.entities,
      pageSetCount: summary.counts.pageSets,
      pageCount: summary.counts.pages,
      missingImages: summary.missingImages,
      stale: summary.stale,
      changeState: summary.changeState,
      blocked: reasons.length > 0,
      reason: reasons.join(' / ')
    }
  })
}

const generatedRows = computed<ModuleRow[]>(() => {
  if (mode.value === 'preview') return rowsFromSummaries(previewModules.value)
  return rowsFromSummaries(meta.value?.modules ?? [])
})

const moduleRows = computed<ModuleRow[]>(() => (liveRows.value.length ? liveRows.value : generatedRows.value))
const liveCountsLabel = computed(() => {
  const rows = liveRows.value
  const entities = rows.reduce((sum, row) => sum + row.entityCount, 0)
  const pageSets = rows.reduce((sum, row) => sum + row.pageSetCount, 0)
  const pages = rows.reduce((sum, row) => sum + row.pageCount, 0)
  return `模块 ${rows.length} / 实体 ${entities} / 页面集 ${pageSets} / 页面 ${pages}`
})
const moduleBlockers = computed(() =>
  moduleRows.value.filter(row => row.required && row.blocked).map(row => `${row.key} ${row.title}（${row.reason || '未就绪'}）`)
)
const generateBlocked = computed(() => props.mode === 'enter' && liveRows.value.length > 0 && moduleBlockers.value.length > 0)
const requirementsBundleLabel = computed(() => {
  const bundle = mode.value === 'preview' ? previewRequirementsBundle.value : meta.value?.requirementsBundle ?? null
  return bundle ? `需求聚合 v${bundle.version}` : ''
})

const canGenerate = computed(() => props.canGenerate !== false)
const isEnterMode = computed(() => props.mode === 'enter')
const noActiveHint = NO_ACTIVE_CHANGE_SET_HINT
const files = computed(() => (mode.value === 'preview' ? previewFiles.value : currentFiles.value))
const activeFileMeta = computed(() => files.value.find(file => file.name === activeFile.value) ?? null)
const activeContent = computed(() => activeFileMeta.value?.content ?? '')
/** 预览显示预览结果的 scale；查看模式显示已生成 meta 的 scale */
const activeScale = computed<DesignHandoffScale | null>(() =>
  mode.value === 'preview' ? previewScale.value : meta.value?.scale ?? null
)
const scaleBadgeInfo = computed(() => scaleBadge(activeScale.value))
const scaleTriggerText = computed(() => scaleTriggerLabels(activeScale.value).join('、'))
const generateLabel = computed(() => {
  const entering = props.mode === 'enter'
  if (entering) {
    return props.activeChangeSet && props.activeChangeSet.seq > 1 ? '生成变更交接包并进入开发' : '生成交接包并进入开发'
  }
  return meta.value ? '重新生成交接包' : '生成交接包'
})
const changeSetLabel = computed(() => {
  const changeSet = meta.value?.changeSet
  if (!changeSet) return ''
  return changeSet.seq === 1 && changeSet.title === '初始开发' ? '初始开发' : `变更 #${changeSet.seq} · ${changeSet.title}`
})

watch(
  () => props.modelValue,
  open => {
    if (!open) return
    error.value = ''
    issues.value = []
    warnings.value = []
    previewFiles.value = []
    previewScale.value = null
    previewModules.value = []
    previewRequirementsBundle.value = null
    mode.value = 'current'
    void load()
  }
)

watch(files, value => {
  if (!value.some(file => file.name === activeFile.value)) {
    activeFile.value = value.find(file => file.name === '00-README.md')?.name ?? value[0]?.name ?? ''
  }
})

watch(
  () => props.initialFile,
  value => {
    if (!props.modelValue) return
    const preferred = value?.trim()
    if (preferred && files.value.some(file => file.name === preferred)) activeFile.value = preferred
  }
)

function close(): void {
  if (busy.value === 'generate') return
  emit('update:modelValue', false)
}

/** 规模提示的“查看 04-PLAN.md”：在文件列表里选中（预览/已生成都可用） */
function openFile(name: string): void {
  if (files.value.some(file => file.name === name)) activeFile.value = name
}

function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(1)} KB`
}

function kindLabel(kind: string): string {
  if (kind === 'image') return 'PNG'
  if (kind === 'html') return 'HTML'
  return 'TEXT'
}

function reqStatusLabel(status: 'draft' | 'review' | 'confirmed' | null): string {
  if (status === 'confirmed') return '已确认'
  if (status === 'review') return '待审核'
  if (status === 'draft') return '草稿'
  return '无文档'
}

function designStatusLabel(status: string | null): string {
  if (status === 'confirmed') return '已确认'
  if (status === 'review') return '待审核'
  if (status === 'draft') return '草稿'
  return '未开始'
}

function handleApiError(err: unknown): void {
  if (err instanceof DesignApiError) {
    error.value = err.message
    issues.value = err.issues
    warnings.value = err.warnings
    return
  }
  error.value = err instanceof Error ? err.message : String(err)
}

async function load(): Promise<void> {
  if (busy.value) return
  busy.value = 'load'
  try {
    const data = await getDesignHandoff(props.appId)
    meta.value = data.handoff
    currentFiles.value = data.files
    previewFiles.value = []
    previewScale.value = null
    mode.value = 'current'
    error.value = ''
    issues.value = []
    warnings.value = []
    const preferred = props.initialFile?.trim()
    if (preferred && data.files.some(file => file.name === preferred)) activeFile.value = preferred
    else activeFile.value = data.files.find(file => file.name === '00-README.md')?.name ?? data.files[0]?.name ?? ''
  } catch (err) {
    handleApiError(err)
  } finally {
    busy.value = ''
  }
}

async function preview(): Promise<void> {
  if (busy.value) return
  busy.value = 'preview'
  error.value = ''
  issues.value = []
  warnings.value = []
  try {
    const result: DesignHandoffPreviewResult = await previewDesignHandoff(props.appId)
    previewFiles.value = result.files
    previewScale.value = result.scale ?? null
    previewModules.value = result.modules ?? []
    previewRequirementsBundle.value = result.requirementsBundle ?? null
    warnings.value = result.warnings
    mode.value = 'preview'
    activeFile.value = result.files[0]?.name ?? ''
    ElMessage.success(`预览已生成（${result.files.length} 个文件，未写盘）`)
  } catch (err) {
    handleApiError(err)
  } finally {
    busy.value = ''
  }
}

async function generate(): Promise<void> {
  if (busy.value) return
  if (!canGenerate.value) {
    ElMessage.warning(NO_ACTIVE_CHANGE_SET_HINT)
    return
  }
  if (generateBlocked.value) {
    ElMessage.warning(`全部模块确认后才能生成：${moduleBlockers.value.slice(0, 3).join('；')}`)
    return
  }
  const entering = props.mode === 'enter'
  try {
    await ElMessageBox.confirm(
      entering
        ? '将校验交接包并写入 projects/<app-id>/docs/handoff/，随后应用切换到开发阶段。\n校验失败不会写盘，也不会切换阶段。'
        : '将重新生成交接包并写入 docs/handoff/，版本递增。\n当前开发会话不会被中断；新交接包版本会提示给后续会话。',
      entering ? '生成交接包并进入开发' : '重新生成交接包',
      { type: 'warning', confirmButtonText: entering ? '生成并进入开发' : '生成', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  busy.value = 'generate'
  error.value = ''
  issues.value = []
  warnings.value = []
  try {
    const result = await generateDesignHandoff(props.appId)
    meta.value = result.handoff
    currentFiles.value = result.files
    previewFiles.value = []
    previewScale.value = null
    mode.value = 'current'
    warnings.value = result.warnings
    ElMessage.success(`交接包 v${result.handoff.version} 已生成${result.developmentStarted ? '，已进入开发' : ''}`)
    emit('generated', {
      handoff: result.handoff,
      developmentStarted: result.developmentStarted,
      warnings: result.warnings
    })
  } catch (err) {
    handleApiError(err)
  } finally {
    busy.value = ''
  }
}
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 1900;
  background: var(--rg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.dialog {
  width: min(1080px, calc(100vw - 32px));
  height: min(800px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius-lg);
  box-shadow: 0 24px 60px rgba(10, 14, 20, 0.3);
  font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: var(--rg-text);
  overflow: hidden;
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 10px;
  flex-shrink: 0;
}
.head h2 {
  margin: 0 0 5px;
  font-size: 17px;
  font-weight: 650;
}
.head p {
  margin: 0;
  font-size: 12px;
  color: var(--rg-text-2);
  line-height: 1.55;
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
.meta {
  margin: 0 24px 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  flex-shrink: 0;
}
.meta.empty-meta {
  color: var(--rg-text-3);
}
.badge {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  border-radius: 999px;
  padding: 2px 8px;
  font-weight: 600;
}
.chip {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  border-radius: 999px;
  padding: 2px 8px;
}
.chip.muted {
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 24px 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.hint {
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.hint.warn {
  color: var(--rg-warn);
}
.scale-row {
  margin: 0 24px 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  flex-shrink: 0;
}
.scale-title strong {
  font-weight: 600;
  color: var(--rg-text);
}
.scale-row .chip.warn {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
  border: 1px solid var(--rg-warn-border);
}
.module-section {
  margin: 0 24px 10px;
  flex-shrink: 0;
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  background: var(--rg-surface-2);
  padding: 10px 12px;
}
.module-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: var(--rg-text-2);
}
.module-head strong {
  color: var(--rg-text);
}
.chip.ok {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.module-table-wrap {
  margin-top: 8px;
  max-height: 168px;
  overflow: auto;
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  background: var(--rg-surface);
}
.module-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11.5px;
}
.module-table th,
.module-table td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid var(--rg-border);
  white-space: nowrap;
}
.module-table th {
  position: sticky;
  top: 0;
  background: var(--rg-surface-2);
  color: var(--rg-text-3);
  font-weight: 500;
  z-index: 1;
}
.module-table tbody tr:last-child td {
  border-bottom: none;
}
.module-table tr.blocked td {
  background: var(--rg-warn-soft);
}
.module-table tr.changed td {
  background: var(--rg-ai-soft);
}
.module-title {
  color: var(--rg-text-2);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.module-sub {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.module-sub.warn,
.module-table td.warn {
  color: var(--rg-warn);
  font-weight: 600;
}
.module-section .hint {
  margin: 8px 0 0;
  line-height: 1.55;
}
.link-btn {
  border: none;
  background: transparent;
  padding: 0;
  font-size: 11.5px;
  color: var(--rg-ai);
  text-decoration: underline;
  cursor: pointer;
}
.link-btn:hover {
  color: var(--rg-text);
}
.error,
.issue-box,
.warning-box {
  margin: 0 24px 10px;
  border-radius: 8px;
  padding: 9px 11px;
  font-size: 12px;
  line-height: 1.6;
  flex-shrink: 0;
  max-height: 150px;
  overflow: auto;
}
.error {
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border: 1px solid var(--rg-danger-border);
}
.issue-box {
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border: 1px solid var(--rg-danger-border);
}
.warning-box {
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border: 1px solid var(--rg-warn-border);
}
.issue-box ul,
.warning-box ul {
  margin: 5px 0 0;
  padding-left: 18px;
}
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  margin: 0 24px 10px;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  overflow: hidden;
}
.files {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  padding: 8px;
  overflow: auto;
}
.file {
  width: 100%;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 7px;
  padding: 7px 8px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--rg-text-2);
}
.file:hover {
  background: var(--rg-fill-2);
  color: var(--rg-text);
}
.file.active {
  background: var(--rg-surface);
  border-color: var(--rg-border-strong);
  color: var(--rg-text);
  box-shadow: var(--rg-shadow-1);
}
.file-kind {
  font-size: 9.5px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  border-radius: 4px;
  padding: 1px 4px;
  flex-shrink: 0;
}
.file-name {
  flex: 1;
  min-width: 0;
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file small {
  font-size: 10px;
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.files-empty {
  margin: 12px 8px;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.preview {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--rg-surface);
}
.preview-head {
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  border-bottom: 1px solid var(--rg-border);
  font-size: 12px;
}
.preview-kind {
  font-size: 10px;
  color: var(--rg-text-3);
}
.code-preview {
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px;
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--rg-code-text);
  background: var(--rg-code-bg);
  white-space: pre-wrap;
  word-break: break-word;
}
.preview-empty {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--rg-text-3);
  font-size: 12.5px;
  padding: 24px;
  text-align: center;
}
.image-preview {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}
.image-preview img {
  max-width: 100%;
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  background: #fff;
}
.foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 24px 16px;
}
code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
  border-radius: 4px;
  padding: 1px 5px;
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
  padding: 6px 12px;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
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
.btn.primary:hover:not(:disabled) {
  background: var(--rg-ink-hover);
  border-color: var(--rg-ink-hover);
  color: var(--rg-ink-contrast);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 1024px) {
  .files {
    width: 220px;
  }
}
@media (max-width: 820px) {
  .mask {
    padding: 10px;
  }
  .dialog {
    width: calc(100vw - 20px);
    height: calc(100vh - 20px);
  }
  .head,
  .toolbar,
  .foot {
    padding-left: 14px;
    padding-right: 14px;
  }
  .meta,
  .scale-row,
  .module-section,
  .error,
  .issue-box,
  .warning-box,
  .body {
    margin-left: 14px;
    margin-right: 14px;
  }
  .module-table {
    min-width: 560px;
  }
  .body {
    flex-direction: column;
  }
  .files {
    width: auto;
    max-height: 132px;
    border-right: none;
    border-bottom: 1px solid var(--rg-border);
  }
}
</style>
