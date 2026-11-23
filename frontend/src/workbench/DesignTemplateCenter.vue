/**
 * 设计模板中心（P7-3b）
 *
 * 应用类型 × 视觉风格 + 页面库；iframe 加载工作台内 `/preview.html`。
 * - browse：首页/设计视图浏览；
 * - picker：新建应用选择，emit `select` 后关闭。
 *
 * 数据来自 `/api/design-system`（P7-1），预览宿主来自 P7-3a。
 */
<template>
  <Teleport to="body">
    <div v-if="modelValue" class="dtc-mask" data-testid="design-template-center">
      <section class="dtc" role="dialog" aria-modal="true" :aria-label="mode === 'picker' ? '选择设计模板' : '设计模板中心'">
        <header class="dtc-head">
          <div class="head-title">
            <h2>{{ mode === 'picker' ? '选择设计模板' : '设计模板中心' }}</h2>
            <p>
              应用类型 × 视觉风格 + 页面库；预览为工作台内 mock 渲染，不连接 AFCenter 平台。
              <span v-if="pack" class="pack-name">{{ pack.name }} v{{ pack.version }}</span>
            </p>
          </div>
          <div class="head-actions">
            <span v-if="mode === 'picker' && pickerLabel" class="current-pick" data-testid="design-template-current">
              当前：{{ pickerLabel }}
            </span>
            <button type="button" class="icon-btn" aria-label="关闭" title="关闭" data-testid="design-template-close" @click="close">
              ×
            </button>
          </div>
        </header>

        <div v-if="loading" class="dtc-state" data-testid="design-template-loading">正在加载设计模板…</div>
        <div v-else-if="error" class="dtc-state error" data-testid="design-template-error">
          <p>{{ error }}</p>
          <button type="button" class="btn" @click="load">重试</button>
        </div>

        <template v-else-if="pack">
          <!-- 列表：应用类型卡片 -->
          <div v-if="view === 'gallery'" class="gallery">
            <div class="gallery-toolbar">
              <div class="cats rg-tabs rg-tabs--wrap" role="tablist" aria-label="应用类型分类">
                <button
                  v-for="tab in categoryTabs"
                  :key="tab.value || 'all'"
                  type="button"
                  :class="['rg-tab', { 'rg-tab--active': category === tab.value }]"
                  role="tab"
                  :aria-selected="category === tab.value"
                  :data-testid="`design-template-category-${tab.value || 'all'}`"
                  @click="selectCategory(tab.value)"
                >
                  {{ tab.label }}<span class="rg-tab__count">{{ tab.count }}</span>
                </button>
              </div>
              <div class="gallery-actions">
                <span class="result-count">
                  {{ category === CUSTOM_DESIGN_CATEGORY ? `${filteredCustomItems.length} 个自定义模板` : `${filteredTypes.length} 个应用类型` }}
                </span>
                <input
                  v-model.trim="keyword"
                  type="search"
                  class="search"
                  placeholder="搜索应用类型 / 自定义模板 / 页面"
                  data-testid="design-template-search"
                />
              </div>
            </div>

            <div v-if="mode === 'picker' && filteredPickerCustomCards.length" class="picker-custom" data-testid="design-template-picker-custom">
              <div class="picker-custom-head">
                <strong>自定义模板（已发布）</strong>
                <span>选择后可在详情里确认风格与页面；草稿不在此列出。</span>
              </div>
              <div class="picker-custom-grid">
                <button
                  v-for="item in filteredPickerCustomCards"
                  :key="item.id"
                  type="button"
                  class="tpl-card custom-pick-card"
                  :data-testid="`design-template-custom-pick-${item.id}`"
                  @click="openCustomPicker(item)"
                >
                  <div class="card-body">
                    <div class="card-title">
                      <h3>{{ item.name }}</h3>
                      <span class="page-count">{{ item.pageCount }} 页</span>
                    </div>
                    <p>{{ item.styleName }}{{ item.version ? ` · v${item.version}` : '' }}</p>
                    <div class="card-foot">
                      <span class="badge">自定义</span>
                      <span>选择 →</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div v-if="category !== CUSTOM_DESIGN_CATEGORY" class="gallery-grid">
              <button
                v-if="mode === 'browse'"
                type="button"
                class="tpl-card custom-card"
                data-testid="design-template-custom-card"
                @click="openCustomCategory"
              >
                <div class="custom-visual" aria-hidden="true">
                  <span>+</span>
                  <i /><i /><i />
                </div>
                <div class="card-body">
                  <div class="card-title">
                    <h3>自定义模板</h3>
                    <span class="badge">{{ customItems.length }} 个</span>
                  </div>
                  <p>用 AI 组装页面库与业务组件，创建可复用的设计模板；草稿生成后由你确认发布。</p>
                  <div class="card-foot"><span>工作室 + AI</span><span>进入 →</span></div>
                </div>
              </button>

              <button
                v-for="type in filteredTypes"
                :key="type.id"
                type="button"
                :class="['tpl-card', { selected: activeTypeId === type.id && view === 'detail' }]"
                :data-testid="`design-template-card-${type.id}`"
                @click="openDetail(type.id)"
              >
                <div class="thumb" :style="{ '--thumb-accent': thumbAccent(type) }">
                  <div class="mock-browser">
                    <i /><i /><i /><span />
                  </div>
                  <div class="mock-page">
                    <div class="mock-side" />
                    <div class="mock-content">
                      <b />
                      <div class="mock-row"><i /><i /><i /></div>
                      <div class="mock-row long"><i /><i /><i /><i /></div>
                      <div class="mock-row"><i /><i /></div>
                    </div>
                  </div>
                  <span class="thumb-badge">{{ categoryLabel(type.category) }}</span>
                </div>
                <div class="card-body">
                  <div class="card-title">
                    <h3>{{ type.name }}</h3>
                    <span class="page-count">{{ type.pages.length }} 页</span>
                  </div>
                  <p>{{ type.description }}</p>
                  <div class="card-foot">
                    <span>{{ countTypeComponents(type) }} 个组件</span>
                    <span>查看页面 →</span>
                  </div>
                </div>
              </button>
            </div>

            <!-- 自定义模板列表（P7-7b-2b） -->
            <div v-else class="custom-panel" data-testid="design-template-custom-list">
              <div class="custom-head">
                <div>
                  <strong>自定义模板</strong>
                  <p>草稿与已发布模板都列在这里；进入工作室与 AI 确认页面清单后生成预览，再由你发布。</p>
                </div>
                <button type="button" class="btn primary" data-testid="design-template-custom-new" @click="newDialogOpen = true">
                  新建自定义模板
                </button>
              </div>

              <div v-if="customLoading" class="dtc-state inline">正在加载自定义模板…</div>
              <div v-else-if="customError" class="custom-error" data-testid="design-template-custom-error">
                <span>{{ customError }}</span>
                <button type="button" class="btn small" @click="loadCustom">重试</button>
              </div>

              <div v-if="confirmTarget" class="custom-confirm" data-testid="design-template-delete-confirm">
                <strong>
                  {{ actionsOf(confirmTarget).deleteMode === 'pack' ? '删除模板' : '丢弃草稿' }}「{{ confirmTarget.name }}」？
                </strong>
                <p v-if="actionsOf(confirmTarget).deleteMode === 'pack'">
                  将删除已发布模板与草稿；引用它的应用不会被删除，但下次打开会回退默认模板。
                </p>
                <p v-else>未发布的页面与生成结果会被删除，不可恢复。</p>
                <div class="custom-confirm-actions">
                  <button type="button" class="btn small" :disabled="!!deletingId" @click="confirmTarget = null">取消</button>
                  <button
                    type="button"
                    class="btn small danger"
                    :disabled="!!deletingId"
                    data-testid="design-template-delete-confirm-ok"
                    @click="confirmRemove"
                  >
                    {{ actionsOf(confirmTarget).deleteMode === 'pack' ? '删除模板' : '丢弃草稿' }}
                  </button>
                </div>
              </div>

              <div v-if="deleteConflict" class="custom-conflict" data-testid="design-template-delete-conflict">
                <strong>模板仍被 {{ deleteConflict.apps.length }} 个应用引用：{{ deleteConflict.name }}</strong>
                <ul>
                  <li v-for="app in deleteConflict.apps" :key="app.id">
                    <code>{{ app.id }}</code><span>{{ app.name }}</span>
                  </li>
                </ul>
                <p>请先在这些应用的设计视图里切换模板，再回来删除。</p>
                <button type="button" class="btn small" @click="deleteConflict = null">知道了</button>
              </div>

              <div v-if="!customLoading && !customError && !customItems.length" class="custom-empty" data-testid="design-template-custom-empty">
                <strong>还没有自定义模板</strong>
                <p>进入工作室，让 AI 根据你的业务组装一个。</p>
                <button type="button" class="btn" data-testid="design-template-custom-empty-new" @click="newDialogOpen = true">
                  新建自定义模板
                </button>
              </div>

              <div v-else-if="!customLoading && !customError" class="custom-grid">
                <article
                  v-for="item in filteredCustomItems"
                  :key="item.id"
                  class="custom-item"
                  :data-testid="`design-template-custom-item-${item.id}`"
                >
                  <div class="custom-item-head">
                    <h3>{{ item.name }}</h3>
                    <span :class="['status-badge', item.status]">{{ customStatusLabel(item.status) }}</span>
                  </div>
                  <div class="custom-meta">
                    <span class="chip">{{ styleNameOf(item) || item.style || '未设置风格' }}</span>
                    <span class="chip">{{ item.version ? `v${item.version}` : '未发布' }}</span>
                    <span>{{ customPageSummary(item) }}</span>
                    <span>{{ item.referencedApps.length }} 个应用引用</span>
                  </div>
                  <p class="custom-id"><code>{{ item.id }}</code></p>
                  <div class="custom-actions">
                    <button
                      type="button"
                      class="btn small primary"
                      :data-testid="`design-template-custom-open-${item.id}`"
                      :disabled="!!openingId"
                      @click="openStudio(item)"
                    >
                      {{ openingId === item.id ? '打开中…' : '进入工作室' }}
                    </button>
                    <button
                      type="button"
                      class="btn small"
                      :data-testid="`design-template-custom-preview-${item.id}`"
                      :disabled="!actionsOf(item).canPreview"
                      @click="openCustomPreview(item)"
                    >
                      预览
                    </button>
                    <button
                      type="button"
                      class="btn small danger"
                      :data-testid="`design-template-custom-delete-${item.id}`"
                      :disabled="deletingId === item.id"
                      @click="removeCustom(item)"
                    >
                      {{ deletingId === item.id ? '处理中…' : actionsOf(item).deleteMode === 'pack' ? '删除' : '丢弃草稿' }}
                    </button>
                  </div>
                </article>
              </div>
            </div>

            <p v-if="category !== CUSTOM_DESIGN_CATEGORY && !filteredTypes.length" class="dtc-state inline">
              没有匹配的应用类型，试试清空搜索或切换分类。
            </p>
            <p v-else-if="category === CUSTOM_DESIGN_CATEGORY && customItems.length && !filteredCustomItems.length" class="dtc-state inline">
              没有匹配的自定义模板，试试清空搜索。
            </p>
          </div>

          <!-- 详情：风格 + 页面集 + iframe -->
          <div v-else class="detail">
            <aside class="detail-side">
              <button type="button" class="back-btn" data-testid="design-template-back" @click="backToGallery">
                ← 返回应用类型
              </button>
              <h3>{{ activeType?.name }}</h3>
              <p>{{ activeType?.description }}</p>
              <dl class="facts">
                <div><dt>页面</dt><dd>{{ activeType?.pages.length ?? 0 }}</dd></div>
                <div><dt>组件</dt><dd>{{ activeType ? countTypeComponents(activeType) : 0 }}</dd></div>
                <div><dt>配方</dt><dd>{{ uniqueRecipes(activeType).length }}</dd></div>
              </dl>

              <div class="styles" aria-label="视觉风格">
                <strong>视觉风格</strong>
                <button
                  v-for="style in pack.styles"
                  :key="style.id"
                  type="button"
                  :class="['style-option', { on: styleId === style.id }]"
                  :title="style.description"
                  :data-testid="`design-template-style-${style.id}`"
                  @click="selectStyle(style.id)"
                >
                  <i :style="{ background: style.signature }" />
                  <span>
                    {{ style.name }}
                    <small>{{ style.description }}</small>
                  </span>
                </button>
              </div>

              <div class="type-switch">
                <strong>切换应用类型</strong>
                <button
                  v-for="type in pack.applicationTypes"
                  :key="type.id"
                  type="button"
                  :class="['type-option', { on: activeTypeId === type.id }]"
                  @click="openDetail(type.id)"
                >
                  {{ type.name }}
                </button>
              </div>
            </aside>

            <div class="detail-main">
              <div class="pages-head">
                <strong>页面集（{{ activeType?.pages.length ?? 0 }}）</strong>
                <span>点击页面在右侧预览；切换风格会重新加载预览。</span>
              </div>
              <div class="pages-grid">
                <article
                  v-for="page in activeType?.pages ?? []"
                  :key="page.id"
                  :class="['page-card', { on: previewPageId === page.id }]"
                >
                  <div class="page-title">
                    <h4>{{ page.name }}</h4>
                    <span class="type-tag">{{ page.type }}</span>
                  </div>
                  <p>{{ page.description }}</p>
                  <div class="chips">
                    <span class="kind-chip" :class="`kind-${page.kind || 'blueprint'}`">{{ pageKindLabel(page.kind) }}</span>
                    <span v-if="pageSourceLabel(page)" class="source-chip">{{ pageSourceLabel(page) }}</span>
                    <span v-for="component in page.components.slice(0, 4)" :key="component">{{ component }}</span>
                    <span v-if="page.components.length > 4" class="more">+{{ page.components.length - 4 }}</span>
                  </div>
                  <button
                    type="button"
                    class="btn small"
                    :data-testid="`design-template-page-${page.id}`"
                    @click="openPage(page.id)"
                  >
                    进入页面
                  </button>
                </article>
              </div>
            </div>

            <div class="preview-pane" data-testid="design-template-preview-pane">
              <div class="preview-head">
                <strong>{{ previewPage?.name || '页面预览' }}</strong>
                <span v-if="activeStyle">{{ activeStyle.name }}</span>
                <a v-if="previewUrl" :href="previewUrl" target="_blank" rel="noopener">新窗口打开</a>
                <button v-if="previewPageId" type="button" class="btn small" @click="loadPreview">刷新</button>
              </div>
              <div v-if="!previewPageId" class="preview-empty">选择页面后在这里预览</div>
              <div v-else class="preview-body">
                <div v-if="previewLoading" class="preview-note">正在加载预览…</div>
                <div v-else-if="previewError" class="preview-note error" data-testid="design-template-preview-error">
                  <span>{{ previewError }}</span>
                  <button type="button" class="btn small" @click="loadPreview">重试</button>
                  <small>预览入口缺失时，请先执行 <code>npm run build --prefix frontend</code>（或使用 dev server）。</small>
                </div>
                <iframe
                  v-show="!previewError"
                  :key="iframeKey"
                  :src="iframeSrc"
                  class="preview-frame"
                  title="设计模板页面预览"
                  data-testid="design-template-preview-frame"
                  @load="onFrameLoad"
                />
              </div>
            </div>
          </div>
        </template>

        <footer class="dtc-foot">
          <span class="foot-hint">
            <template v-if="view === 'gallery'">
              {{
                mode === 'picker'
                  ? '进入应用类型详情，选择视觉风格后使用。'
                  : category === CUSTOM_DESIGN_CATEGORY
                    ? '自定义模板保存在工作台数据目录；新建应用选择将在后续版本开放。'
                    : '内置模板包为只读；自定义模板在「自定义」分类中维护。'
              }}
            </template>
            <template v-else>
              {{ mode === 'picker' ? '将把应用类型与视觉风格写入应用设计系统。' : '页面库仅用于浏览；不会修改当前应用。' }}
            </template>
          </span>
          <div class="foot-actions">
            <button v-if="view === 'detail'" type="button" class="btn" data-testid="design-template-back-list" @click="backToGallery">
              返回列表
            </button>
            <button v-if="mode === 'picker'" type="button" class="btn" @click="close">取消</button>
            <button
              v-if="mode === 'picker'"
              type="button"
              class="btn primary"
              :disabled="!pickerSelection"
              data-testid="design-template-use"
              @click="useTemplate"
            >
              使用此模板
            </button>
            <button v-else type="button" class="btn primary" @click="close">关闭</button>
          </div>
        </footer>
      </section>

      <NewDesignTemplateDialog
        v-model="newDialogOpen"
        :styles="pack?.styles ?? []"
        :application-types="pack?.applicationTypes ?? []"
        :default-style="pack?.defaultStyle ?? ''"
        :default-application-type="pack?.defaultApplicationType ?? ''"
        @created="onTemplateCreated"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getDesignPack,
  listDesignPacks,
  type AppDesignSystemSelection,
  type DesignApplicationType,
  type DesignPack,
  type DesignPageMeta
} from '../shared/design-system-api'
import {
  deleteDesignPack,
  deleteDraft,
  ensureDraftFromPack,
  listDrafts,
  StudioApiError
} from '../studio/api'
import type { DraftSummary } from '../studio/types'
import NewDesignTemplateDialog from './NewDesignTemplateDialog.vue'
import {
  CUSTOM_DESIGN_CATEGORY,
  CUSTOM_STATUS_LABELS,
  appendCustomCategory,
  buildCustomPickerCards,
  buildCustomTemplateItems,
  buildPickerSelection,
  buildPreviewUrl,
  buildTemplatePreviewUrl,
  categoryLabel,
  categoryOptions,
  countTypeComponents,
  customPageSummary,
  customPreviewUrl,
  customStudioHash,
  customTemplateActions,
  describeDesignSelection,
  filterApplicationTypes,
  filterCustomTemplates,
  findApplicationType,
  findDesignStyle,
  pageKindLabel,
  pageSourceLabel,
  resolveDesignSelection
} from './design-template-helpers.js'

type Mode = 'browse' | 'picker'

interface PickerSelection {
  pack: string
  applicationType: string
  style: string
  applicationTypeName: string
  styleName: string
}

interface CustomTemplateItem {
  id: string
  name: string
  style: string
  baseApplicationType: string
  status: 'draft' | 'published'
  version: string
  pageCount: number
  pageKinds: { reference: number; contract: number; blueprint: number }
  referencedApps: Array<{ id: string; name: string }>
  hasDraft: boolean
  hasDraftPack: boolean
  hasPublishedPack: boolean
  hasPreview: boolean
  previewMode: 'draft' | 'pack'
  firstPageId: string
  updatedAt: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    mode?: Mode
    selection?: AppDesignSystemSelection
  }>(),
  { mode: 'browse', selection: undefined }
)

const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  select: [selection: PickerSelection]
}>()

const loading = ref(false)
const error = ref('')
const pack = ref<DesignPack | null>(null)
/** 内置 pack 详情（picker 从自定义详情返回时恢复；也是默认选择） */
const builtinPack = ref<DesignPack | null>(null)
const view = ref<'gallery' | 'detail'>('gallery')
const category = ref('')
const keyword = ref('')
const activeTypeId = ref('')
const styleId = ref('')
const previewPageId = ref('')
const previewLoading = ref(false)
const previewError = ref('')
const iframeSrc = ref('')
const iframeKey = ref(0)
const customItems = ref<CustomTemplateItem[]>([])
const customPickerCards = ref<Array<{ id: string; name: string; style: string; styleName: string; version: string; pageCount: number; baseApplicationType: string }>>([])
const customLoading = ref(false)
const customError = ref('')
const newDialogOpen = ref(false)
const openingId = ref('')
const deletingId = ref('')
const confirmTarget = ref<CustomTemplateItem | null>(null)
const deleteConflict = ref<{ id: string; name: string; apps: Array<{ id: string; name: string }> } | null>(null)
let frameTimer: ReturnType<typeof setTimeout> | null = null
let previewToken = 0
let loadToken = 0
let customLoadToken = 0

const categories = computed(() => categoryOptions(pack.value?.applicationTypes ?? []))
const categoryTabs = computed(() =>
  props.mode === 'browse' ? appendCustomCategory(categories.value, customItems.value.length) : categories.value
)
const filteredTypes = computed(() =>
  filterApplicationTypes(pack.value?.applicationTypes ?? [], { category: category.value, keyword: keyword.value })
)
const filteredCustomItems = computed(() => filterCustomTemplates(customItems.value, keyword.value))
const filteredPickerCustomCards = computed(() => filterCustomTemplates(customPickerCards.value, keyword.value))
const activeType = computed<DesignApplicationType | null>(() => findApplicationType(pack.value, activeTypeId.value))
const activeStyle = computed(() => findDesignStyle(pack.value, styleId.value))
const previewPage = computed<DesignPageMeta | null>(
  () => activeType.value?.pages.find(page => page.id === previewPageId.value) ?? null
)
const previewUrl = computed(() =>
  pack.value?.origin?.kind === 'custom'
    ? buildTemplatePreviewUrl({
        packId: pack.value.id,
        pageId: previewPageId.value,
        embed: true
      })
    : buildPreviewUrl({
        applicationType: activeTypeId.value,
        style: styleId.value,
        page: previewPageId.value,
        embed: true
      })
)
const pickerSelection = computed<PickerSelection | null>(() =>
  buildPickerSelection(pack.value, { applicationType: activeTypeId.value, style: styleId.value })
)
const pickerLabel = computed(
  () =>
    describeDesignSelection(pack.value, { applicationType: activeTypeId.value, style: styleId.value })?.label ?? ''
)

function thumbAccent(type: DesignApplicationType): string {
  const style = findDesignStyle(pack.value, type.defaultStyle)
  return style?.signature || '#1f5eff'
}

function uniqueRecipes(type: DesignApplicationType | null): string[] {
  return [...new Set((type?.pages ?? []).map(page => page.recipe).filter(Boolean))]
}

function customStatusLabel(status: string): string {
  return CUSTOM_STATUS_LABELS[status as keyof typeof CUSTOM_STATUS_LABELS] || status
}

function styleNameOf(item: CustomTemplateItem): string {
  return findDesignStyle(pack.value, item.style)?.name || item.style
}

function actionsOf(item: CustomTemplateItem): ReturnType<typeof customTemplateActions> {
  return customTemplateActions(item)
}

function selectCategory(value: string): void {
  category.value = value
  if (value === CUSTOM_DESIGN_CATEGORY && !customItems.value.length && !customLoading.value) void loadCustom()
}

function openCustomCategory(): void {
  category.value = CUSTOM_DESIGN_CATEGORY
  keyword.value = ''
  void loadCustom()
}

async function loadCustom(): Promise<void> {
  const token = (customLoadToken += 1)
  customLoading.value = true
  customError.value = ''
  try {
    const [draftResult, packResult] = await Promise.allSettled([listDrafts(), listDesignPacks()])
    if (token !== customLoadToken) return
    if (draftResult.status === 'rejected' && packResult.status === 'rejected') {
      throw draftResult.reason
    }
    const drafts: DraftSummary[] = draftResult.status === 'fulfilled' ? draftResult.value : []
    const packs = packResult.status === 'fulfilled' ? packResult.value : []
    const customPacks = packs.filter(item => (item.templateKind || item.source) === 'custom')
    const details: Record<string, DesignPack> = {}
    await Promise.all(
      customPacks
        .filter(item => !drafts.some(draft => draft.id === item.id))
        .map(async item => {
          try {
            details[item.id] = await getDesignPack(item.id)
          } catch {
            // 详情失败时保留摘要（页面 kind 计数为空），不阻塞列表
          }
        })
    )
    if (token !== customLoadToken) return
    customItems.value = buildCustomTemplateItems({ drafts, packs, details }) as CustomTemplateItem[]
  } catch (err) {
    if (token !== customLoadToken) return
    customError.value = `自定义模板加载失败：${err instanceof Error ? err.message : String(err)}`
    customItems.value = []
  } finally {
    if (token === customLoadToken) customLoading.value = false
  }
}

async function openStudio(item: CustomTemplateItem): Promise<void> {
  if (openingId.value) return
  openingId.value = item.id
  try {
    if (!item.hasDraft) await ensureDraftFromPack(item.id)
    close()
    window.location.hash = customStudioHash(item.id)
  } catch (err) {
    customError.value = err instanceof StudioApiError ? err.message : err instanceof Error ? err.message : String(err)
  } finally {
    openingId.value = ''
  }
}

function openCustomPreview(item: CustomTemplateItem): void {
  const url = customPreviewUrl(item)
  if (!url) return
  window.open(url, '_blank', 'noopener')
}

function removeCustom(item: CustomTemplateItem): void {
  if (deletingId.value) return
  deleteConflict.value = null
  confirmTarget.value = item
}

async function confirmRemove(): Promise<void> {
  const item = confirmTarget.value
  if (!item || deletingId.value) return
  const mode = actionsOf(item).deleteMode
  confirmTarget.value = null
  deletingId.value = item.id
  deleteConflict.value = null
  try {
    if (mode === 'pack') {
      await deleteDesignPack(item.id)
      ElMessage.success(`模板「${item.name}」已删除`)
    } else {
      await deleteDraft(item.id)
      ElMessage.success(`草稿「${item.name}」已丢弃`)
    }
    await loadCustom()
  } catch (err) {
    if (err instanceof StudioApiError && err.status === 409 && err.payload?.code === 'pack-referenced') {
      deleteConflict.value = {
        id: item.id,
        name: item.name,
        apps: err.payload.details?.apps ?? err.payload.apps ?? []
      }
    } else {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    }
  } finally {
    deletingId.value = ''
  }
}

function onTemplateCreated(packId: string): void {
  newDialogOpen.value = false
  close()
  window.location.hash = customStudioHash(packId)
}

function clearFrameTimer(): void {
  if (frameTimer) clearTimeout(frameTimer)
  frameTimer = null
}

function resetPreview(): void {
  previewToken += 1
  clearFrameTimer()
  previewPageId.value = ''
  previewLoading.value = false
  previewError.value = ''
  iframeSrc.value = ''
}

async function load(): Promise<void> {
  const token = (loadToken += 1)
  customLoadToken += 1
  loading.value = true
  error.value = ''
  pack.value = null
  builtinPack.value = null
  view.value = 'gallery'
  category.value = ''
  keyword.value = ''
  resetPreview()
  deleteConflict.value = null
  confirmTarget.value = null
  customItems.value = []
  customPickerCards.value = []
  customError.value = ''
  customLoading.value = false
  try {
    const summaries = await listDesignPacks()
    if (token !== loadToken) return
    if (!summaries.length) throw new Error('没有可用的设计模板包（templates/design-system）')
    const isCustom = (item: (typeof summaries)[number]): boolean =>
      (item.templateKind || item.source) === 'custom'
    // picker：只列已发布自定义 pack（listDesignPacks 不包含草稿）
    customPickerCards.value = props.mode === 'picker' ? buildCustomPickerCards(summaries) : []

    const builtinSummary = summaries.find(item => !isCustom(item)) ?? summaries[0]
    const builtinDetail = await getDesignPack(builtinSummary.id)
    if (token !== loadToken) return
    builtinPack.value = builtinDetail

    const requestedPack = props.selection?.pack
    const requested = requestedPack ? summaries.find(item => item.id === requestedPack) : undefined
    const requestedCustom = Boolean(requested && isCustom(requested))
    const detail = requestedCustom ? await getDesignPack((requested as (typeof summaries)[number]).id) : builtinDetail
    if (token !== loadToken) return
    pack.value = detail
    const resolved = resolveDesignSelection(detail, {
      applicationType: props.selection?.applicationType,
      style: props.selection?.style
    })
    activeTypeId.value = resolved.applicationType
    styleId.value = resolved.style
    // 带选择打开（设计视图「模板页面库」/ 新建应用 picker）时定位到当前应用类型
    if ((props.selection?.applicationType || props.selection?.style || requestedCustom) && resolved.applicationType) {
      openDetail(resolved.applicationType)
    }
    if (props.mode === 'browse') void loadCustom()
  } catch (err) {
    if (token !== loadToken) return
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (token === loadToken) loading.value = false
  }
}

/** picker：选中已发布自定义 pack → 载入详情（风格/页面/预览） */
async function openCustomPicker(item: { id: string }): Promise<void> {
  if (!item?.id || customLoading.value) return
  customLoading.value = true
  customError.value = ''
  try {
    const detail = await getDesignPack(item.id)
    pack.value = detail
    const resolved = resolveDesignSelection(detail, {})
    activeTypeId.value = resolved.applicationType
    styleId.value = resolved.style
    view.value = 'detail'
    previewPageId.value = detail.applicationTypes[0]?.pages[0]?.id ?? ''
    previewError.value = ''
    if (previewPageId.value) void loadPreview()
    else resetPreview()
  } catch (err) {
    customError.value = `自定义模板加载失败：${err instanceof Error ? err.message : String(err)}`
  } finally {
    customLoading.value = false
  }
}

function openDetail(typeId: string): void {
  const type = findApplicationType(pack.value, typeId)
  if (!type) return
  activeTypeId.value = type.id
  const currentStyle = findDesignStyle(pack.value, styleId.value)
  styleId.value = currentStyle?.id || type.defaultStyle || pack.value?.defaultStyle || ''
  view.value = 'detail'
  previewPageId.value = type.pages[0]?.id ?? ''
  previewError.value = ''
  if (previewPageId.value) void loadPreview()
  else resetPreview()
}

function backToGallery(): void {
  view.value = 'gallery'
  resetPreview()
  // 从自定义模板详情返回：恢复内置 pack（picker/browse 的内置卡片与分类继续可用）
  if (pack.value?.origin?.kind === 'custom' && builtinPack.value) {
    pack.value = builtinPack.value
    activeTypeId.value = builtinPack.value.defaultApplicationType
    styleId.value = builtinPack.value.defaultStyle
  }
}

function selectStyle(nextStyleId: string): void {
  styleId.value = nextStyleId
  if (previewPageId.value) void loadPreview()
}

function openPage(pageId: string): void {
  previewPageId.value = pageId
  void loadPreview()
}

/** 先探测预览入口，成功后再挂 iframe；失败给出清晰提示而不是白屏 */
async function loadPreview(): Promise<void> {
  const url = previewUrl.value
  if (!url) return
  const token = ++previewToken
  previewError.value = ''
  previewLoading.value = true
  clearFrameTimer()
  try {
    const response = await fetch(url, { headers: { Accept: 'text/html' } })
    if (token !== previewToken) return
    if (!response.ok) throw new Error(`预览入口返回 HTTP ${response.status}`)
    iframeSrc.value = url
    iframeKey.value += 1
    frameTimer = setTimeout(() => {
      if (token !== previewToken) return
      if (previewLoading.value) {
        previewLoading.value = false
        previewError.value = '预览加载超时：请确认预览入口已构建并可由工作台访问。'
      }
    }, 15000)
  } catch (err) {
    if (token !== previewToken) return
    previewLoading.value = false
    previewError.value = `预览加载失败：${err instanceof Error ? err.message : String(err)}`
  }
}

function onFrameLoad(): void {
  if (previewError.value) return
  previewLoading.value = false
  clearFrameTimer()
}

function close(): void {
  previewToken += 1
  loadToken += 1
  customLoadToken += 1
  clearFrameTimer()
  emit('update:modelValue', false)
}

function useTemplate(): void {
  const selection = pickerSelection.value
  if (!selection) return
  emit('select', selection)
  close()
}

watch(
  () => props.modelValue,
  open => {
    if (open) void load()
    else {
      previewToken += 1
      clearFrameTimer()
    }
  }
)

onUnmounted(() => {
  previewToken += 1
  clearFrameTimer()
})
</script>

<style scoped>
.dtc-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--rg-overlay);
  font-family: 'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: var(--rg-text);
}
.dtc {
  display: flex;
  flex-direction: column;
  width: min(1440px, calc(100vw - 32px));
  height: min(920px, calc(100vh - 40px));
  overflow: hidden;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius-lg);
  box-shadow: 0 28px 70px rgba(10, 14, 20, 0.34);
}
.dtc-head {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px 14px;
  border-bottom: 1px solid var(--rg-border);
}
.dtc-head h2 {
  margin: 0 0 5px;
  font-size: 17px;
  font-weight: 650;
}
.dtc-head p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--rg-text-2);
}
.pack-name {
  margin-left: 8px;
  font-size: 11px;
  color: var(--rg-text-3);
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.current-pick {
  font-size: 11.5px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 4px 10px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.icon-btn {
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
.dtc-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 30px;
  font-size: 12.5px;
  color: var(--rg-text-2);
}
.dtc-state.error {
  color: var(--rg-danger);
}
.dtc-state.inline {
  flex: none;
  padding: 16px;
}
.gallery {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.gallery-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 22px;
  border-bottom: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
}
.cats {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.gallery-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.result-count {
  font-size: 11.5px;
  color: var(--rg-text-3);
  white-space: nowrap;
}
.search {
  width: 220px;
  border: 1px solid var(--rg-border-strong);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 12.5px;
  font-family: inherit;
  color: var(--rg-text);
  background: var(--rg-surface);
  outline: none;
}
.search:focus {
  border-color: var(--rg-ai);
  box-shadow: 0 0 0 3px var(--rg-ai-soft);
}
.gallery-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 14px;
  padding: 18px 22px 24px;
  align-content: start;
}
.tpl-card {
  display: flex;
  flex-direction: column;
  text-align: left;
  padding: 0;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  background: var(--rg-surface);
  color: var(--rg-text);
  cursor: pointer;
  overflow: hidden;
  font-family: inherit;
  transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s;
}
.tpl-card:hover:not(:disabled) {
  border-color: var(--rg-border-strong);
  box-shadow: var(--rg-shadow-1);
  transform: translateY(-1px);
}
.tpl-card.selected {
  border-color: var(--rg-ink);
  box-shadow: 0 0 0 2px var(--rg-ai-soft);
}
.tpl-card:disabled {
  cursor: not-allowed;
}
.thumb {
  --thumb-accent: #1f5eff;
  position: relative;
  height: 132px;
  padding: 14px 14px 0;
  background: linear-gradient(140deg, color-mix(in srgb, var(--thumb-accent) 12%, #f8fafc), #eef2f7);
  border-bottom: 1px solid var(--rg-border);
  overflow: hidden;
}
.mock-browser {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 18px;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--thumb-accent) 26%, #dbe3ef);
  border-bottom: none;
  border-radius: 7px 7px 0 0;
  background: #fff;
}
.mock-browser i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--thumb-accent) 45%, #cbd5e1);
}
.mock-browser span {
  margin-left: 5px;
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #eef2f7;
}
.mock-page {
  display: flex;
  height: 112px;
  border: 1px solid color-mix(in srgb, var(--thumb-accent) 26%, #dbe3ef);
  border-top: none;
  border-radius: 0 0 7px 7px;
  background: #fff;
  overflow: hidden;
}
.mock-side {
  width: 26%;
  background: color-mix(in srgb, var(--thumb-accent) 9%, #f8fafc);
  border-right: 1px solid #eef2f7;
}
.mock-content {
  flex: 1;
  padding: 9px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mock-content b {
  display: block;
  width: 38%;
  height: 7px;
  border-radius: 4px;
  background: var(--thumb-accent);
  opacity: 0.85;
}
.mock-row {
  display: flex;
  gap: 5px;
}
.mock-row i {
  flex: 1;
  height: 10px;
  border-radius: 3px;
  background: #eef2f7;
}
.mock-row.long i {
  height: 15px;
}
.mock-row.long i:first-child {
  flex: 1.6;
  background: color-mix(in srgb, var(--thumb-accent) 16%, #eef2f7);
}
.thumb-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 10px;
  color: var(--thumb-accent);
  background: #fff;
  border: 1px solid color-mix(in srgb, var(--thumb-accent) 30%, #dbe3ef);
  border-radius: 999px;
  padding: 2px 8px;
}
.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 13px 14px 14px;
}
.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.card-title h3 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 650;
}
.page-count,
.badge {
  flex-shrink: 0;
  font-size: 10.5px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 2px 8px;
}
.card-body p {
  margin: 0;
  min-height: 32px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--rg-text-2);
}
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--rg-text-3);
}
.card-foot .disabled {
  color: var(--rg-text-3);
}
.custom-card {
  border-style: dashed;
  background: var(--rg-surface-2);
}
.custom-card .custom-visual {
  height: 132px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 1px dashed var(--rg-border);
  color: var(--rg-text-3);
}
.custom-card .custom-visual > span {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px dashed var(--rg-border-strong);
  border-radius: 50%;
  font-size: 18px;
}
.custom-card .custom-visual i {
  width: 92px;
  height: 5px;
  border-radius: 3px;
  background: var(--rg-fill-2);
}
.custom-card .custom-visual i:nth-child(3) {
  width: 68px;
}
.custom-card .custom-visual i:nth-child(4) {
  width: 80px;
}
.custom-panel {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 22px 24px;
}
.custom-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.custom-head strong {
  font-size: 13.5px;
}
.custom-head p {
  margin: 4px 0 0;
  max-width: 720px;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--rg-text-2);
}
.custom-error,
.custom-confirm,
.custom-conflict,
.custom-empty {
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  background: var(--rg-surface-2);
  padding: 14px 16px;
  font-size: 12px;
  line-height: 1.65;
  color: var(--rg-text-2);
}
.custom-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border-color: var(--rg-danger-border);
}
.custom-confirm {
  border-color: var(--rg-danger-border);
  background: var(--rg-danger-soft);
  color: var(--rg-text);
}
.custom-confirm p {
  margin: 6px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--rg-text-2);
}
.custom-confirm-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.custom-conflict {
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border-color: var(--rg-warn-soft);
}
.custom-conflict ul {
  list-style: none;
  margin: 8px 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.custom-conflict li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--rg-text);
  font-size: 11.5px;
}
.custom-conflict p {
  margin: 0 0 8px;
  color: var(--rg-text-2);
  font-size: 11.5px;
}
.custom-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 34px 20px;
  text-align: center;
}
.custom-empty strong {
  font-size: 13px;
  color: var(--rg-text);
}
.custom-empty p {
  margin: 0;
}
.custom-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 310px), 1fr));
  gap: 12px;
}
.custom-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  background: var(--rg-surface);
  padding: 13px 14px;
  min-width: 0;
}
.custom-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.custom-item-head h3 {
  margin: 0;
  min-width: 0;
  font-size: 13px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-badge {
  flex-shrink: 0;
  font-size: 10px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.status-badge.draft {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.status-badge.published {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.custom-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.custom-meta .chip {
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.custom-id {
  margin: 0;
}
.custom-id code {
  font-size: 10px;
}
.custom-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}
.btn.small.danger {
  color: var(--rg-danger);
  border-color: var(--rg-danger-border);
}
.btn.small.danger:hover:not(:disabled) {
  background: var(--rg-danger-soft);
}
@media (max-width: 860px) {
  .custom-panel {
    padding: 12px 16px 20px;
  }
}
.detail {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) minmax(340px, 44%);
}
.detail-side {
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  border-right: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
}
.back-btn {
  border: none;
  background: transparent;
  color: var(--rg-link);
  font-size: 12px;
  padding: 0;
  cursor: pointer;
  margin-bottom: 12px;
}
.back-btn:hover {
  text-decoration: underline;
}
.detail-side h3 {
  margin: 0 0 6px;
  font-size: 15px;
}
.detail-side > p {
  margin: 0 0 12px;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--rg-text-2);
}
.facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 0 0 16px;
  padding: 10px;
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  background: var(--rg-surface);
}
.facts dt {
  font-size: 10px;
  color: var(--rg-text-3);
}
.facts dd {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
}
.styles {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}
.styles > strong,
.type-switch > strong {
  font-size: 11px;
  color: var(--rg-text-3);
  font-weight: 600;
  margin-bottom: 2px;
}
.style-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  text-align: left;
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  background: var(--rg-surface);
  color: var(--rg-text);
  padding: 7px 9px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.style-option i {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  margin-top: 3px;
  border-radius: 50%;
}
.style-option span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.style-option small {
  font-size: 10.5px;
  line-height: 1.45;
  color: var(--rg-text-3);
}
.style-option.on {
  border-color: var(--rg-ink);
  box-shadow: 0 0 0 2px var(--rg-ai-soft);
}
.type-switch {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.type-option {
  text-align: left;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--rg-text-2);
  padding: 5px 8px;
  font-size: 11.5px;
  font-family: inherit;
  cursor: pointer;
}
.type-option:hover {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.type-option.on {
  border-color: var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text);
  font-weight: 600;
}
.detail-main {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.pages-head {
  flex-shrink: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--rg-border);
}
.pages-head strong {
  font-size: 12.5px;
}
.pages-head span {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.pages-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 10px;
  padding: 14px 16px 20px;
  align-content: start;
}
.page-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  background: var(--rg-surface);
  padding: 11px 12px;
}
.page-card.on {
  border-color: var(--rg-ink);
  box-shadow: 0 0 0 2px var(--rg-ai-soft);
}
.page-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.page-title h4 {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
}
.type-tag {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--rg-text-3);
  background: var(--rg-fill-2);
  border-radius: 4px;
  padding: 1px 5px;
}
.page-card p {
  margin: 0;
  font-size: 11px;
  line-height: 1.55;
  color: var(--rg-text-2);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chips span {
  font-size: 9.5px;
  color: var(--rg-text-3);
  background: var(--rg-fill-2);
  border-radius: 4px;
  padding: 1px 5px;
}
.chips .more {
  color: var(--rg-text-2);
}
.page-card .btn {
  align-self: flex-start;
  margin-top: 2px;
}
.preview-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
}
.preview-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--rg-border);
  background: var(--rg-surface);
}
.preview-head strong {
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-head span {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.preview-head a {
  margin-left: auto;
  font-size: 11px;
  color: var(--rg-link);
  text-decoration: none;
  white-space: nowrap;
}
.preview-head a:hover {
  text-decoration: underline;
}
.preview-head .btn {
  margin-left: 2px;
}
.preview-empty,
.preview-note {
  margin: 24px auto;
  max-width: 360px;
  padding: 18px;
  text-align: center;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--rg-text-2);
}
.preview-note.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border: 1px solid var(--rg-danger-border);
  border-radius: 9px;
}
.preview-note.error small {
  color: var(--rg-text-2);
  font-size: 10.5px;
}
.preview-body {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}
.preview-body > .preview-note {
  flex: none;
}
.preview-frame {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: none;
  background: #fff;
}
.dtc-foot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 22px;
  border-top: 1px solid var(--rg-border);
  background: var(--rg-surface);
}
.foot-hint {
  font-size: 11px;
  line-height: 1.55;
  color: var(--rg-text-3);
}
.foot-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.btn.small {
  min-height: 24px;
  padding: 3px 8px;
  font-size: 11px;
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
code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 10px;
  background: var(--rg-fill-2);
  border-radius: 4px;
  padding: 1px 4px;
}
@media (max-width: 1200px) {
  .detail {
    grid-template-columns: 230px minmax(0, 1fr);
  }
  .preview-pane {
    grid-column: 1 / -1;
    border-left: none;
    border-top: 1px solid var(--rg-border);
    min-height: 320px;
  }
}
@media (max-width: 860px) {
  .dtc-mask {
    padding: 10px;
  }
  .dtc {
    width: calc(100vw - 20px);
    height: calc(100vh - 20px);
  }
  .dtc-head {
    padding: 14px 16px 10px;
  }
  .gallery-toolbar {
    padding: 10px 16px;
  }
  .gallery-grid {
    padding: 14px 16px 20px;
  }
  .search {
    width: 100%;
  }
  .detail {
    grid-template-columns: minmax(0, 1fr);
    overflow-y: auto;
  }
  .detail-side {
    border-right: none;
    border-bottom: 1px solid var(--rg-border);
  }
  .detail-main {
    min-height: 320px;
  }
  .preview-pane {
    min-height: 420px;
  }
  .dtc-foot {
    padding: 9px 16px;
  }
  .foot-hint {
    display: none;
  }
}
@media (max-width: 560px) {
  .dtc-head {
    flex-wrap: wrap;
  }
  .head-title {
    flex: 1 1 100%;
  }
  .head-actions {
    width: 100%;
    justify-content: space-between;
  }
  .current-pick {
    max-width: calc(100% - 40px);
  }
  .head-actions .icon-btn {
    margin-left: auto;
  }
  .gallery-actions {
    width: 100%;
  }
  .search {
    flex: 1;
    min-width: 0;
    width: auto;
  }
}

/* P7-7c：picker 自定义分组（已发布） */
.picker-custom {
  margin: 0 0 14px;
  padding: 12px 14px;
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  background: var(--rg-fill-2);
}

.picker-custom-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.picker-custom-head strong {
  font-size: 13px;
}

.picker-custom-head span {
  font-size: 11.5px;
  color: var(--rg-text-3);
}

.picker-custom-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.custom-pick-card {
  display: block;
  padding: 0;
  text-align: left;
}

.custom-pick-card .card-body {
  padding: 10px 12px;
}

.chips .kind-chip {
  border: 1px solid var(--rg-border-strong);
  border-radius: 999px;
  padding: 1px 7px;
  font-weight: 600;
}

.chips .kind-chip.kind-reference {
  color: #145fba;
  border-color: #b9d4f4;
  background: #eef5fd;
}

.chips .kind-chip.kind-contract {
  color: #8a5a00;
  border-color: #f0d9a8;
  background: #fff9ed;
}

.chips .source-chip {
  color: var(--rg-text-3);
  font-size: 10.5px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
