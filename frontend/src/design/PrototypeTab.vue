<template>
  <div :class="['proto-tab', { readonly }]">
    <header class="tab-head">
      <div class="tab-title">
        <h2>页面原型</h2>
        <button type="button" class="template-badge" title="打开原型模板中心" :disabled="readonly" @click="templateOpen = true">
          {{ project.template.name }}
          <span class="caret">▾</span>
        </button>
        <span class="tab-sub">{{ project.pageSets.length }} 个页面集 · {{ pageCount }} 个页面 · 已确认 {{ confirmedPageSetCount }}</span>
        <span v-if="focusEpicId" class="filter-chip" data-testid="proto-epic-filter">
          当前 Epic：{{ focusEpicId }} {{ focusEpicTitle }} · 仅显示相关页面集
          <button type="button" class="filter-clear" data-testid="proto-epic-filter-clear" @click="emit('clear-epic-filter')">清除</button>
        </span>
      </div>
      <div class="tab-actions">
        <button
          type="button"
          class="pane-toggle"
          title="打开页面集列表"
          aria-label="打开页面集列表"
          @click="setOpen = true"
        >
          页面集（{{ project.pageSets.length }}）
        </button>
        <div class="more-wrap">
          <button type="button" class="btn" data-testid="proto-more" :disabled="busy || readonly" @click="moreOpen = !moreOpen">更多 ▾</button>
          <div v-if="moreOpen" class="menu-mask" @click="moreOpen = false" />
          <div v-if="moreOpen" class="more-menu">
            <button
              type="button"
              class="menu-item"
              data-testid="proto-generate-default"
              :disabled="busy || readonly || !project.entities.length"
              @click="moreOpen = false; generatePages('default')"
            >
              按场景生成页面集（整模块兜底）
            </button>
            <button
              type="button"
              class="menu-item"
              data-testid="proto-generate-ai"
              :disabled="busy || readonly || !project.entities.length"
              @click="moreOpen = false; generatePages('ai')"
            >
              整模块 AI 生成页面集（兜底）
            </button>
          </div>
        </div>
        <button type="button" class="btn" @click="versionsOpen = true">版本</button>
        <div class="zoom-select">
          <span>缩放</span>
          <el-select v-model="zoom" size="small" style="width: 82px">
            <el-option :value="75" label="75%" />
            <el-option :value="90" label="90%" />
            <el-option :value="100" label="100%" />
            <el-option :value="115" label="115%" />
            <el-option :value="130" label="130%" />
          </el-select>
        </div>
        <div class="view-tabs">
          <button type="button" :class="['view-tab', { on: view === 'html' }]" @click="view = 'html'">原型</button>
          <button type="button" :class="['view-tab', { on: view === 'image' }]" @click="view = 'image'">图片</button>
        </div>
        <button type="button" class="btn" data-testid="proto-snapshot" :disabled="busy || readonly || capturing || !selectedPage" @click="snapshot">截图存档</button>
        <button type="button" class="btn" data-testid="proto-export" :disabled="busy || capturing || !selectedPage" @click="exportPng">导出 PNG</button>
        <button type="button" class="btn primary" :disabled="busy || readonly || !selectedSet" @click="confirmSet">确认页面集</button>
      </div>
    </header>

    <div v-if="readonly" class="readonly-banner">设计已确认，当前为只读；点击顶部「重新编辑设计」后才能修改页面规格/确认状态。</div>
    <div v-if="missingImageCount" class="missing-images-banner" data-testid="prototype-missing-images">
      还有 {{ missingImageCount }} 个页面没有原型截图；生成交接包前需逐个“截图存档”
    </div>

    <div class="proto-body">
      <div v-if="setOpen" class="pane-mask" @click="setOpen = false" />
      <aside :class="['set-list', { open: setOpen }]">
        <button type="button" class="pane-close" title="关闭页面集列表" aria-label="关闭页面集列表" @click="setOpen = false">×</button>
        <div v-for="set in visiblePageSets" :key="set.id" class="set-group">
          <button type="button" :class="['set-head', { on: set.id === selectedSetId }]" :data-set-id="set.id" @click="selectSet(set.id)">
            <span class="set-title">{{ set.title }}</span>
            <span :class="['set-status', set.status]">{{ set.status === 'confirmed' ? '已确认' : '草稿' }}</span>
          </button>
          <button
            v-for="page in set.pages"
            :key="page.id"
            type="button"
            :class="['page-item', { on: page.id === selectedPageId, draft: page.status !== 'confirmed' }]"
            @click="selectPage(set.id, page.id)"
          >
            <span class="page-type">{{ PAGE_TYPE_LABELS[page.type] }}</span>
            <span class="page-name">{{ page.title }}</span>
            <span v-if="page.imagePath" class="page-image-dot" title="已有原型截图" />
          </button>
        </div>
        <div v-if="!visiblePageSets.length" class="set-empty">
          <template v-if="focusEpicId">
            <p>该 Epic 还没有页面集。</p>
            <p>可在设计大纲点「生成此 Epic」按 Epic 生成。</p>
          </template>
          <template v-else>
            <p>还没有页面集。</p>
            <p>先完成实体设计，再点「更多 → 按场景生成页面集」或「生成此 Epic」。</p>
          </template>
        </div>
      </aside>

      <section class="canvas-pane">
        <div v-if="selectedPage && view === 'html'" class="canvas-scroll">
          <PrototypeCanvas
            ref="canvasRef"
            :page="selectedPage"
            :page-set="selectedSet"
            :page-sets="project.pageSets"
            :entities="project.entities"
            :template="project.template"
            :app-name="project.appName"
            :zoom="zoom"
            :capturing="capturing"
          />
        </div>
        <div v-else-if="selectedPage && view === 'image'" class="image-pane">
          <img v-if="selectedPage.imagePath" :src="imageUrl(selectedPage)" :alt="selectedPage.title" class="proto-image" />
          <div v-else class="canvas-empty">
            <p>该页面还没有原型图片。</p>
            <button type="button" class="btn primary" data-testid="proto-empty-snapshot" :disabled="readonly || capturing" @click="snapshot">截图并存档</button>
          </div>
        </div>
        <div v-else class="canvas-empty">
          <p>选择左侧页面查看原型；或先生成页面集。</p>
        </div>
        <div v-if="capturing" class="capture-mask">正在生成原型截图…</div>
      </section>

      <aside v-if="selectedPage" class="spec-pane">
        <div class="spec-head">
          <strong>页面规格</strong>
          <span :class="['status-chip', selectedPage.status]">{{ selectedPage.status === 'confirmed' ? '已确认' : '草稿' }}</span>
          <span class="spec-version">v{{ selectedPage.version }}</span>
        </div>
        <label class="spec-field">
          <span>页面标题</span>
          <el-input v-model="form.title" size="small" @input="markDirty" />
        </label>
        <div class="spec-row">
          <label class="spec-field">
            <span>类型</span>
            <el-select v-model="form.type" size="small" @change="markDirty">
              <el-option v-for="(label, value) in PAGE_TYPE_LABELS" :key="value" :label="label" :value="value" />
            </el-select>
          </label>
          <label class="spec-field">
            <span>绑定实体</span>
            <el-select v-model="form.entityId" size="small" clearable @change="markDirty">
              <el-option v-for="entity in project.entities" :key="entity.id" :label="entity.name" :value="entity.id" />
            </el-select>
          </label>
        </div>
        <label class="spec-field">
          <span>需求依据（Story/Epic，覆盖度用）</span>
          <el-select
            v-model="form.requirementRefs"
            multiple
            filterable
            collapse-tags
            size="small"
            :disabled="readonly"
            placeholder="选择该页面依据的 Story"
            @change="markDirty"
          >
            <el-option v-for="option in refOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </label>
        <label v-if="form.type === 'form'" class="spec-field">
          <span>表单模式（创建/编辑分别确认）</span>
          <el-select v-model="form.mode" size="small" @change="markDirty">
            <el-option label="创建表单" value="create" />
            <el-option label="编辑表单" value="edit" />
            <el-option label="创建/编辑共用" value="both" />
          </el-select>
        </label>
        <label class="spec-field">
          <span>动作（逗号分隔）</span>
          <el-input v-model="form.actionsText" size="small" placeholder="create, edit, delete, detail" @input="markDirty" />
        </label>
        <label class="spec-field">
          <span>页面字段（表单/详情；留空=实体全部）</span>
          <el-input v-model="form.fieldsText" size="small" :placeholder="fieldHint" @input="markDirty" />
        </label>
        <label class="spec-field">
          <span>列表列（逗号分隔字段名）</span>
          <el-input v-model="form.columnsText" size="small" :placeholder="fieldHint" @input="markDirty" />
        </label>
        <label class="spec-field">
          <span>查询字段（逗号分隔）</span>
          <el-input v-model="form.searchText" size="small" :placeholder="fieldHint" @input="markDirty" />
        </label>
        <label class="spec-field">
          <span>分页大小</span>
          <el-input-number v-model="form.pageSize" size="small" :min="5" :max="100" @change="markDirty" />
        </label>
        <label class="spec-field">
          <span>验收标准（每行一条）</span>
          <el-input v-model="form.acceptanceText" type="textarea" :rows="3" @input="markDirty" />
        </label>
        <label class="spec-field">
          <span>批注 / 说明</span>
          <el-input v-model="form.notes" type="textarea" :rows="3" placeholder="页面批注、待确认点" @input="markDirty" />
        </label>
        <div class="spec-actions">
          <button type="button" class="btn" :disabled="busy || saving" @click="savePage()">保存页面</button>
          <button type="button" class="btn" :disabled="busy" @click="askAiPage">问 AI</button>
          <button type="button" class="btn primary" :disabled="busy || saving" @click="confirmPage">确认此页</button>
          <button type="button" class="btn" :disabled="busy" @click="addPage">新增页面</button>
          <button type="button" class="btn danger" :disabled="busy || (selectedSet?.pages.length ?? 0) <= 1" @click="removePage">删除页面</button>
        </div>
        <div class="spec-foot">
          <span>{{ selectedSet?.title }}</span>
          <span>{{ selectedSet?.pages.length ?? 0 }} 页面</span>
          <span v-if="selectedSet?.epicId">Epic：{{ selectedSet.epicId }}</span>
          <span v-if="selectedSet?.storyIds.length">Stories：{{ selectedSet.storyIds.join('、') }}</span>
          <span v-if="selectedSet?.entityIds.length">实体：{{ selectedSet.entityIds.map(entityName).join('、') }}</span>
          <span v-if="dirty" class="dirty">未保存</span>
        </div>
      </aside>
    </div>

    <PrototypeTemplateDialog
      v-model="templateOpen"
      :current-template-id="project.template.id"
      @use="useTemplate"
    />
    <DesignVersionsDialog
      v-model="versionsOpen"
      :app-id="project.appId"
      :module-id="project.module.id"
      :readonly="readonly"
      :before-save="flushSave"
      @restored="onRestored"
      @saved="onVersionSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PrototypeCanvas from './PrototypeCanvas.vue'
import PrototypeTemplateDialog from './PrototypeTemplateDialog.vue'
import DesignVersionsDialog from './DesignVersionsDialog.vue'
import { captureElementPng, downloadDataUrl } from './snapshot'
import {
  DesignApiError,
  generateDesignPageSets,
  saveDesignPage,
  saveDesignPageSet,
  switchDesignTemplate,
  uploadDesignSnapshot
} from './api'
import {
  PAGE_TYPE_LABELS,
  type DesignPage,
  type DesignPageSet,
  type DesignProjectPayload,
  type PrototypePageType,
  type PrototypeTemplate
} from './types'
import { epicMatchesPageSet } from './design-epic-helpers.js'

const props = defineProps<{
  project: DesignProjectPayload
  readonly?: boolean
  /** D-RMP：按 Epic 过滤显示（只影响页面集列表/选中；保存仍用完整页面集） */
  focusEpicId?: string
  focusEpicTitle?: string
  focusEpicRefs?: string[]
  focusEpicIsScene?: boolean
}>()
const emit = defineEmits<{
  update: [DesignProjectPayload]
  'focus-change': [{ kind: 'pageSet' | 'page'; id: string } | null]
  'clear-epic-filter': []
}>()

const selectedSetId = ref('')
const selectedPageId = ref('')
// 窄屏（≤1024）页面集抽屉
const setOpen = ref(false)
// “更多”菜单（整模块生成兜底，默认不展示）
const moreOpen = ref(false)
const templateOpen = ref(false)
const versionsOpen = ref(false)
const busy = ref(false)
const saving = ref(false)
const capturing = ref(false)
const dirty = ref(false)
const zoom = ref(100)
const view = ref<'html' | 'image'>('html')
const canvasRef = ref<InstanceType<typeof PrototypeCanvas> | null>(null)
// D-RMP：过滤/同步导致的被动选中不应覆盖 Epic 对话焦点（只有用户点击才 emit focus-change）
let autoSelecting = false

const form = reactive({
  title: '',
  type: 'list' as PrototypePageType,
  mode: 'both' as 'create' | 'edit' | 'both',
  entityId: '' as string | null,
  requirementRefs: [] as string[],
  actionsText: '',
  fieldsText: '',
  columnsText: '',
  searchText: '',
  pageSize: 10,
  acceptanceText: '',
  notes: ''
})

const pageCount = computed(() => props.project.pageSets.reduce((sum, set) => sum + set.pages.length, 0))
const missingImageCount = computed(
  () => props.project.pageSets.reduce((sum, set) => sum + set.pages.filter(page => !page.imagePath).length, 0)
)
const confirmedPageSetCount = computed(() => props.project.pageSets.filter(set => set.status === 'confirmed').length)
const refOptions = computed(() => {
  const input = props.project.input
  if (!input) return []
  const options: Array<{ value: string; label: string }> = []
  for (const story of input.stories) options.push({ value: story.id, label: `${story.id} · ${story.title}` })
  for (const epic of input.epics) options.push({ value: epic.id, label: `${epic.id} · ${epic.title}（Epic）` })
  return options
})
const selectedSet = computed(() => props.project.pageSets.find(set => set.id === selectedSetId.value) ?? null)
/** D-RMP：过滤只影响页面集列表显示；页面集数据始终是完整 project.pageSets */
const filteredEpicNode = computed(() =>
  props.focusEpicId
    ? {
        id: props.focusEpicId,
        isScene: props.focusEpicIsScene === true,
        storyIds: props.focusEpicRefs ?? []
      }
    : null
)
const visiblePageSets = computed<DesignPageSet[]>(() => {
  const node = filteredEpicNode.value
  if (!node) return props.project.pageSets
  return props.project.pageSets.filter(set => epicMatchesPageSet(set, node))
})
const selectedPage = computed<DesignPage | null>(() => {
  if (!selectedPageId.value) return null
  for (const set of props.project.pageSets) {
    const page = set.pages.find(item => item.id === selectedPageId.value)
    if (page) return page
  }
  return null
})
const fieldHint = computed(() => {
  const entityId = form.entityId || selectedPage.value?.entityId
  const entity = props.project.entities.find(item => item.id === entityId)
  return entity ? entity.fields.map(field => field.name).slice(0, 6).join(', ') : 'orderNo, amount, status'
})

function splitList(value: string): string[] {
  return String(value)
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function splitLines(value: string): string[] {
  return String(value)
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

function selectSet(id: string): void {
  selectedSetId.value = id
  const set = props.project.pageSets.find(item => item.id === id)
  const page = set?.pages[0]
  if (page) selectPage(id, page.id)
}

function selectPage(setId: string, pageId: string): void {
  selectedSetId.value = setId
  selectedPageId.value = pageId
  setOpen.value = false
  if (dirty.value) void savePage(true)
  else syncForm()
}

/** 覆盖度跳转：按 page id 定位页面集并选中 */
function selectPageById(pageId: string): void {
  for (const set of props.project.pageSets) {
    if (set.pages.some(page => page.id === pageId)) {
      selectPage(set.id, pageId)
      return
    }
  }
}

/** 设计大纲点击页面集：切 Tab 并选中（由父组件负责切 Tab 与 Epic 过滤） */
function selectSetById(setId: string): void {
  selectSet(setId)
}

function syncSelection(): void {
  autoSelecting = true
  try {
    const sets = visiblePageSets.value
    if (!sets.length) {
      selectedSetId.value = ''
      selectedPageId.value = ''
      return
    }
    if (!sets.some(set => set.id === selectedSetId.value)) selectedSetId.value = sets[0].id
    const set = sets.find(item => item.id === selectedSetId.value) ?? sets[0]
    if (!set.pages.length) {
      selectedPageId.value = ''
      return
    }
    if (!set.pages.some(page => page.id === selectedPageId.value)) selectedPageId.value = set.pages[0].id
  } finally {
    autoSelecting = false
  }
  syncForm()
}

function syncForm(): void {
  const page = selectedPage.value
  if (!page) return
  form.title = page.title
  form.type = page.type
  form.mode = page.spec.mode ?? 'both'
  form.entityId = page.entityId
  form.requirementRefs = [...(page.requirementRefs ?? [])]
  form.actionsText = (page.spec.actions ?? []).join(', ')
  form.fieldsText = (page.spec.fields ?? []).join(', ')
  form.columnsText = (page.layout.table?.columns ?? page.spec.columns ?? []).join(', ')
  form.searchText = (page.layout.table?.searchFields ?? page.spec.searchFields ?? []).join(', ')
  form.pageSize = page.layout.table?.pageSize ?? 10
  form.acceptanceText = (page.spec.acceptance ?? []).join('\n')
  form.notes = page.spec.notes ?? ''
  dirty.value = false
}

watch(
  () => props.project.version,
  () => {
    if (!dirty.value) syncSelection()
  },
  { immediate: true }
)

// D-RMP：切换 Epic 过滤时把选中页面集收窄到可见列表（有未保存编辑时先不动）
watch(
  () => [props.focusEpicId ?? '', props.focusEpicIsScene === true ? '1' : '0', (props.focusEpicRefs ?? []).join(',')],
  () => {
    if (!dirty.value) syncSelection()
  }
)

watch(
  () => selectedPageId.value,
  id => {
    if (autoSelecting) return
    if (id) emit('focus-change', { kind: 'page', id })
  }
)

watch(
  () => selectedSetId.value,
  id => {
    if (autoSelecting) return
    if (id && !selectedPageId.value) emit('focus-change', { kind: 'pageSet', id })
  }
)

function markDirty(): void {
  if (props.readonly) return
  dirty.value = true
}

function buildPageInput(): Record<string, unknown> {
  const page = selectedPage.value
  if (!page) return {}
  const columns = splitList(form.columnsText)
  const search = splitList(form.searchText)
  return {
    title: form.title.trim() || page.title,
    type: form.type,
    entityId: form.entityId || null,
    requirementRefs: [...form.requirementRefs],
    spec: {
      ...page.spec,
      actions: splitList(form.actionsText),
      fields: splitList(form.fieldsText),
      columns,
      searchFields: search,
      acceptance: splitLines(form.acceptanceText),
      notes: form.notes.trim(),
      ...(form.type === 'form' ? { mode: form.mode } : {})
    },
    layout: {
      ...page.layout,
      table: {
        ...(page.layout.table ?? {}),
        columns,
        searchFields: search,
        pageSize: form.pageSize
      }
    }
  }
}

async function savePage(silent = false, throwOnError = false): Promise<void> {
  const page = selectedPage.value
  if (props.readonly || !page || saving.value) return
  saving.value = true
  try {
    const project = await saveDesignPage(props.project.appId, page.id, buildPageInput(), props.project.module.id)
    dirty.value = false
    emit('update', project)
    if (!silent) ElMessage.success('页面规格已保存')
  } catch (error) {
    showError(error)
    if (throwOnError) throw error
  } finally {
    saving.value = false
  }
}

async function confirmPage(): Promise<void> {
  const page = selectedPage.value
  if (props.readonly || !page) return
  saving.value = true
  try {
    const project = await saveDesignPage(props.project.appId, page.id, { ...buildPageInput(), status: 'confirmed' }, props.project.module.id)
    dirty.value = false
    emit('update', project)
    ElMessage.success('页面已确认')
  } catch (error) {
    showError(error)
  } finally {
    saving.value = false
  }
}

async function confirmSet(): Promise<void> {
  const set = selectedSet.value
  if (props.readonly || !set) return
  if (dirty.value) await savePage(true)
  try {
    await ElMessageBox.confirm(
      `确认页面集「${set.title}」？会同时确认该页面集下 ${set.pages.length} 个页面，并重置为已确认状态。`,
      '确认页面集',
      { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  busy.value = true
  try {
    const project = await saveDesignPageSet(props.project.appId, set.id, { status: 'confirmed' }, props.project.module.id)
    emit('update', project)
    ElMessage.success(`页面集「${set.title}」已确认`)
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}

async function generatePages(mode: 'default' | 'ai'): Promise<void> {
  if (props.readonly) return
  try {
    await ElMessageBox.confirm(
      mode === 'ai'
        ? 'AI 会读取需求文档与实体设计，按场景/Epic 生成页面集；可能覆盖同名页面集的内容。确认继续？'
        : '按原型模板规则，从需求文档的业务场景/Epic 生成页面集（列表/创建表单/编辑表单/详情）；无场景时按实体兜底。确认继续？',
      mode === 'ai' ? 'AI 生成页面集' : '按场景生成页面集',
      { type: 'warning', confirmButtonText: '生成', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  busy.value = true
  try {
    const result = await generateDesignPageSets(props.project.appId, mode, props.project.module.id)
    emit('update', result.project)
    const first = result.project.pageSets[0]
    if (first) {
      selectedSetId.value = first.id
      selectedPageId.value = first.pages[0]?.id ?? ''
    }
    ElMessage.success(`已生成 ${result.project.pageSets.length} 个页面集`)
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}

async function addPage(): Promise<void> {
  const set = selectedSet.value
  if (props.readonly || !set) return
  let title = ''
  try {
    const result = await ElMessageBox.prompt('页面标题', '新增页面', {
      confirmButtonText: '新增',
      cancelButtonText: '取消',
      inputValue: '新页面'
    })
    title = result.value.trim()
  } catch {
    return
  }
  if (!title) return
  const entityId = form.entityId || set.pages[0]?.entityId || props.project.entities[0]?.id || null
  const entity = props.project.entities.find(item => item.id === entityId)
  const today = new Date().toISOString()
  const page: DesignPage = {
    id: '',
    pageSetId: set.id,
    pageKey: `${entity?.id ?? 'page'}-${Date.now().toString(36)}`,
    title,
    type: 'list',
    entityId,
    spec: {
      actions: ['create', 'edit', 'delete', 'detail'],
      columns: entity?.fields.slice(0, 5).map(field => field.name) ?? [],
      searchFields: entity?.fields.slice(0, 2).map(field => field.name) ?? [],
      acceptance: [`能查看${title}`]
    },
    layout: { table: { columns: entity?.fields.slice(0, 5).map(field => field.name) ?? [], pageSize: 10 } },
    status: 'draft',
    version: 1,
    imagePath: null,
    htmlPath: null,
    imageHash: null,
    position: set.pages.length,
    createdAt: today,
    updatedAt: today
  }
  busy.value = true
  try {
    const project = await saveDesignPageSet(props.project.appId, set.id, { pages: [...set.pages, page] }, props.project.module.id)
    emit('update', project)
    const updated = project.pageSets.find(item => item.id === set.id)
    const last = updated?.pages[updated.pages.length - 1]
    if (last) selectPage(set.id, last.id)
    ElMessage.success('页面已新增')
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}

async function removePage(): Promise<void> {
  const set = selectedSet.value
  const page = selectedPage.value
  if (props.readonly || !set || !page) return
  if (set.pages.length <= 1) {
    ElMessage.warning('页面集至少保留 1 个页面')
    return
  }
  try {
    await ElMessageBox.confirm(`删除页面「${page.title}」？`, '删除页面', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  busy.value = true
  try {
    const project = await saveDesignPageSet(props.project.appId, set.id, {
      pages: set.pages.filter(item => item.id !== page.id)
    }, props.project.module.id)
    emit('update', project)
    selectSet(set.id)
    ElMessage.success('页面已删除')
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}

async function useTemplate(template: PrototypeTemplate): Promise<void> {
  if (props.readonly) {
    ElMessage.warning('设计已确认，请先重新编辑设计')
    return
  }
  if (template.id === props.project.template.id) {
    templateOpen.value = false
    return
  }
  if (props.project.pageSets.length) {
    try {
      await ElMessageBox.confirm(
        `切换为「${template.name}」会按新模板重新渲染原型；页面集与页面规格保留，生成新设计版本。`,
        '切换原型模板',
        { type: 'warning', confirmButtonText: '切换', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }
  busy.value = true
  try {
    const project = await switchDesignTemplate(props.project.appId, template.id, props.project.module.id)
    emit('update', project)
    templateOpen.value = false
    ElMessage.success(`已切换为「${template.name}」`)
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}

function captureTarget(): HTMLElement | null {
  const instance = canvasRef.value as unknown as { paperRef?: HTMLElement | null } | null
  return instance?.paperRef ?? null
}

/** 等待原型画布挂载且完成首次布局（html2canvas 需要非零尺寸 + connected 节点） */
function waitForPaper(timeoutMs = 1500): Promise<HTMLElement | null> {
  return new Promise(resolve => {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const tick = (): void => {
      const target = captureTarget()
      if (target && target.isConnected && target.clientWidth > 0 && target.clientHeight > 0) {
        resolve(target)
        return
      }
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (now - start >= timeoutMs) {
        resolve(null)
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

/**
 * #4 截图/导出统一入口：任意视图都能截图。
 * 「图片」视图下 PrototypeCanvas 未挂载（v-if），这里临时切回 html 视图、等画布可用再截图，
 * 结束后恢复原视图；截图成功上传后仍按现有逻辑切到「图片」。
 */
async function captureFromAnyView(): Promise<{ dataUrl: string; html: string } | null> {
  if (!selectedPage.value) return null
  const previous = view.value
  if (view.value !== 'html') {
    view.value = 'html'
    await nextTick()
  }
  try {
    const target = await waitForPaper()
    if (!target) return null
    try {
      await document.fonts?.ready
    } catch {
      // 字体加载失败不影响截图
    }
    capturing.value = true
    await nextTick()
    try {
      const result = await captureElementPng(target, 2)
      return { dataUrl: result.dataUrl, html: target.outerHTML }
    } finally {
      capturing.value = false
    }
  } finally {
    if (view.value !== previous) view.value = previous
  }
}

async function snapshot(): Promise<void> {
  const page = selectedPage.value
  if (props.readonly || !page) return
  busy.value = true
  try {
    const captured = await captureFromAnyView()
    if (!captured) {
      ElMessage.warning('原型画布渲染超时，请切回「原型」后重试')
      return
    }
    const result = await uploadDesignSnapshot(props.project.appId, page.id, captured.dataUrl, captured.html, props.project.module.id)
    emit('update', result.project)
    view.value = 'image'
    ElMessage.success('原型截图已保存到应用目录')
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}

async function exportPng(): Promise<void> {
  const page = selectedPage.value
  if (!page) return
  try {
    const captured = await captureFromAnyView()
    if (!captured) {
      ElMessage.warning('原型画布渲染超时，请切回「原型」后重试')
      return
    }
    downloadDataUrl(captured.dataUrl, `${page.pageKey || page.id}.png`)
    ElMessage.success('已导出 PNG')
  } catch (error) {
    showError(error)
  }
}

function imageUrl(page: DesignPage): string {
  const suffix = page.imageHash ? `&v=${encodeURIComponent(page.imageHash.slice(0, 8))}` : ''
  return `/api/apps/${encodeURIComponent(props.project.appId)}/design/pages/${encodeURIComponent(page.id)}/image?moduleId=${encodeURIComponent(props.project.module.id)}${suffix}`
}

function entityName(id: string): string {
  return props.project.entities.find(entity => entity.id === id)?.name ?? id
}

function onRestored(project: DesignProjectPayload): void {
  emit('update', project)
  syncSelection()
}

function onVersionSaved(project: DesignProjectPayload): void {
  emit('update', project)
  syncSelection()
}

function askAiPage(): void {
  if (selectedPage.value) emit('focus-change', { kind: 'page', id: selectedPage.value.id })
}

function showError(error: unknown): void {
  if (error instanceof DesignApiError) {
    if (error.issues.length) {
      void ElMessageBox.alert(error.issues.map(line => `• ${line}`).join('\n'), error.message, {
        type: 'warning',
        confirmButtonText: '知道了'
      })
      return
    }
    ElMessage.error(error.message)
    return
  }
  ElMessage.error(error instanceof Error ? error.message : String(error))
}

async function flushSave(): Promise<void> {
  if (props.readonly) return
  const startedAt = Date.now()
  while (saving.value) {
    if (Date.now() - startedAt > 5000) throw new Error('页面保存仍在进行，请稍后重试')
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  if (dirty.value) await savePage(true, true)
}

defineExpose({
  flushSave,
  selectPageById,
  selectSetById
})
</script>

<style scoped>
.proto-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
  background: var(--rg-bg);
  color: var(--rg-text);
}
.readonly-banner {
  flex-shrink: 0;
  margin: 10px 14px 0;
  border: 1px solid var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
  border-radius: 8px;
  padding: 7px 11px;
  font-size: 11.5px;
}
.missing-images-banner {
  flex-shrink: 0;
  margin: 10px 14px 0;
  border: 1px solid var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
  border-radius: 8px;
  padding: 7px 11px;
  font-size: 11.5px;
  line-height: 1.6;
}
.proto-tab.readonly .spec-field,
.proto-tab.readonly .spec-actions,
.proto-tab.readonly .template-badge {
  pointer-events: none;
  opacity: 0.86;
}
.tab-head {
  flex-shrink: 0;
  min-height: 52px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
  flex-wrap: wrap;
}
.tab-title,
.tab-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tab-title h2 {
  margin: 0;
  font-size: 14px;
  color: var(--rg-text);
}
.tab-sub {
  font-size: 11px;
  color: var(--rg-text-3);
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 999px;
  padding: 2px 4px 2px 9px;
  max-width: 100%;
}
.filter-clear {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 10.5px;
  text-decoration: underline;
  cursor: pointer;
  padding: 0 4px;
}
.more-wrap {
  position: relative;
}
.menu-mask {
  position: fixed;
  inset: 0;
  z-index: 30;
}
.more-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 31;
  min-width: 220px;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border-strong);
  border-radius: 9px;
  box-shadow: var(--rg-shadow-2);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.menu-item {
  text-align: left;
  border: none;
  background: transparent;
  color: var(--rg-text-2);
  border-radius: 7px;
  padding: 6px 9px;
  font-size: 11.5px;
  cursor: pointer;
  white-space: nowrap;
}
.menu-item:hover:not(:disabled) {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.menu-item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.template-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 26px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  border-radius: 8px;
  padding: 4px 9px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rg-text);
  cursor: pointer;
}
.template-badge:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
}
.caret {
  font-size: 9px;
  color: var(--rg-text-3);
}
.zoom-select,
.view-tabs {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--rg-text-2);
}
.view-tabs {
  background: var(--rg-fill);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.view-tab {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 4px 9px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  cursor: pointer;
}
.view-tab:hover {
  color: var(--rg-text);
}
.view-tab.on {
  background: var(--rg-surface);
  color: var(--rg-text);
  font-weight: 600;
  box-shadow: var(--rg-shadow-1);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
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
.btn.danger {
  color: var(--rg-danger);
  border-color: var(--rg-danger-border);
}
.btn.danger:hover:not(:disabled) {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.proto-body {
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
}
.set-list {
  width: 218px;
  flex-shrink: 0;
  border-right: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  padding: 10px 8px;
  overflow-y: auto;
  position: relative;
}
.set-group {
  margin-bottom: 10px;
}
.set-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 7px;
  padding: 5px 7px;
  cursor: pointer;
}
.set-head:hover {
  background: var(--rg-hover);
}
.set-head.on {
  background: var(--rg-ai-soft);
}
.set-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--rg-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.set-status {
  font-size: 9.5px;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
  flex-shrink: 0;
}
.set-status.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.page-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 4px 7px;
  cursor: pointer;
  margin-left: 4px;
}
.page-item:hover {
  background: var(--rg-hover);
}
.page-item.on {
  background: var(--rg-surface);
  box-shadow: var(--rg-shadow-1);
}
.page-type {
  font-size: 9.5px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 4px;
  padding: 0 5px;
  flex-shrink: 0;
}
.page-name {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  color: var(--rg-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-item.draft .page-name::after {
  content: ' ·';
  color: var(--rg-warn);
}
.page-image-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--rg-ok);
  flex-shrink: 0;
}
.set-empty {
  padding: 18px 8px;
  font-size: 11.5px;
  color: var(--rg-text-3);
  line-height: 1.7;
}
.canvas-pane {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--rg-canvas);
}
.canvas-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}
.canvas-empty,
.image-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--rg-text-3);
  font-size: 12.5px;
  padding: 24px;
  text-align: center;
}
.image-pane {
  overflow: auto;
  align-items: stretch;
  justify-content: flex-start;
}
/* 原型截图是“白纸”产物，保持浅色背景 */
.proto-image {
  max-width: 100%;
  border-radius: 10px;
  box-shadow: var(--rg-shadow-2);
  background: #fff;
  align-self: center;
}
.capture-mask {
  position: absolute;
  left: 50%;
  top: 16px;
  transform: translateX(-50%);
  background: var(--rg-ink);
  color: var(--rg-ink-contrast);
  font-size: 11.5px;
  border-radius: 999px;
  padding: 5px 12px;
  z-index: 5;
  white-space: nowrap;
}
.spec-pane {
  width: 296px;
  flex-shrink: 0;
  border-left: 1px solid var(--rg-border);
  background: var(--rg-surface);
  padding: 12px 14px;
  overflow-y: auto;
}
.spec-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.spec-head strong {
  font-size: 12.5px;
  color: var(--rg-text-2);
}
.spec-version {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.status-chip {
  font-size: 10px;
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.status-chip.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.spec-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--rg-text-2);
  margin-bottom: 9px;
  min-width: 0;
}
.spec-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.spec-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.spec-foot {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  font-size: 10.5px;
  color: var(--rg-text-3);
  flex-wrap: wrap;
}
.dirty {
  color: var(--rg-warn);
}
/* 窄屏抽屉开关 */
.pane-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.pane-toggle:hover {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.pane-close {
  display: none;
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 7px;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.pane-close:hover {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.pane-mask {
  display: none;
}

@media (max-width: 1280px) {
  .set-list {
    width: 196px;
  }
  .spec-pane {
    width: 268px;
  }
  .tab-head {
    padding: 8px 12px;
  }
}

/* ≤1024：页面集折叠为抽屉，画布 + 规格并排 */
@media (max-width: 1024px) {
  .pane-toggle {
    display: inline-flex;
  }
  .pane-close {
    display: inline-flex;
  }
  .pane-mask {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 40;
    background: var(--rg-overlay);
  }
  .set-list {
    display: none;
  }
  .set-list.open {
    display: block;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(300px, calc(100vw - 48px));
    z-index: 41;
    background: var(--rg-surface);
    box-shadow: var(--rg-shadow-2);
    border-right: 1px solid var(--rg-border);
    /* 给抽屉关闭按钮留出空间，避免压住首个页面集状态 */
    padding-top: 38px;
  }
  .tab-actions {
    row-gap: 6px;
  }
}

/* ≤768：单栏纵向（画布在上，规格在下） */
@media (max-width: 768px) {
  .tab-head {
    padding: 8px 10px;
  }
  .tab-actions {
    width: 100%;
  }
  .proto-body {
    flex-direction: column;
    overflow-y: auto;
  }
  .canvas-pane {
    min-height: 320px;
    flex: 1 1 auto;
  }
  .canvas-scroll {
    padding: 12px;
  }
  .spec-pane {
    width: auto;
    flex-shrink: 0;
    border-left: none;
    border-top: 1px solid var(--rg-border);
    max-height: none;
  }
  .spec-row {
    grid-template-columns: 1fr;
  }
  .btn,
  .pane-toggle,
  .template-badge {
    min-height: 32px;
  }
  .view-tab {
    min-height: 28px;
  }
  .set-list.open {
    width: calc(100vw - 24px);
  }
}
</style>
