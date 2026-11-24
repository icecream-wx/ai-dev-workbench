<template>
  <div class="contract-page" :data-recipe="recipe" :data-testid="`contract-page-${recipe}`">
    <p v-if="notes.length" class="contract-notes" data-testid="contract-notes">
      <span v-for="note in notes" :key="note">{{ note }}</span>
    </p>

    <!-- 列表：page-heading + panel（pm-search / pm-toolbar / pm-table / pm-pagination） -->
    <template v-if="recipe === 'list'">
      <header class="page-heading">
        <div>
          <h1>{{ page.title }}</h1>
          <p>{{ description }}</p>
        </div>
        <pm-toolbar class="contract-toolbar heading-actions" :bordered="false">
          <pm-toolbar-item v-for="action in toolbar.heading" :key="action" @click="emitAction(action)">
            {{ actionLabel(action) }}
          </pm-toolbar-item>
          <pm-toolbar-item v-if="toolbar.hasCreate" type="primary" :icon="Plus" @click="emitAction('create')">
            新增
          </pm-toolbar-item>
        </pm-toolbar>
      </header>

      <section class="panel" data-testid="contract-list-panel">
        <div class="table-toolbar">
          <pm-toolbar class="contract-toolbar table-toolbar-left" :bordered="false">
            <pm-toolbar-item
              v-for="action in toolbar.batch"
              :key="action"
              type="primary"
              plain
              :disabled="!selected.length"
              @click="emitAction(action)"
            >
              {{ actionLabel(action) }}
            </pm-toolbar-item>
          </pm-toolbar>
          <small>{{ listSummary }}</small>
        </div>

        <div class="contract-search-line">
          <ContractSearch
            v-model:query="searchQuery"
            :page="page"
            :fields="filterModel.fields"
            :placeholder="searchPlaceholder"
            @search="currentPage = 1"
          />
        </div>

        <pm-table
          class="contract-table"
          :table-data="pagedRows"
          :columns="tableColumns"
          :checked="selectionOn"
          show-index
          @changrows="selected = $event"
        >
          <template v-if="statusColumn" #status="{ row }">
            <span class="status-chip" :class="statusClassOf(row[statusColumn.prop])">
              {{ formatCellValue(statusField, row[statusColumn.prop]) }}
            </span>
          </template>
          <template v-if="rowActions.length" #action="{ row }">
            <button
              v-for="action in rowActions"
              :key="action.code"
              type="button"
              class="link-button"
              @click.stop="emitAction(action.code, action.label, row)"
            >
              {{ action.label }}
            </button>
          </template>
        </pm-table>

        <div class="table-footer">
          <span>{{ pagerText }}</span>
          <pm-pagination
            class="contract-pagination"
            v-model:current-page="currentPage"
            background
            layout="prev, pager, next"
            :page-size="pageSize"
            :total="total"
          />
        </div>
      </section>
    </template>

    <!-- 树表：org-ledger-shell（左 pm-tree，右面板表格） -->
    <template v-else-if="recipe === 'tree-list'">
      <section class="business-page org-ledger-shell" data-testid="contract-tree-shell">
        <aside class="org-tree-panel" data-testid="contract-tree-panel">
          <ContractSearch
            v-model:query="treeQuery"
            :page="page"
            :fields="[]"
            :placeholder="`搜索${tree.titleField || '目录'}`"
            default-prop="keyword"
          />
          <p v-if="tree.note" class="org-tree-note" data-testid="contract-tree-note">{{ tree.note }}</p>
          <div class="org-tree-wrap" data-testid="contract-tree">
            <pm-tree
              :data="treeNodes"
              :props="treeProps"
              :model-value="selectedNode"
              :editable="false"
              :removable="false"
              :searchable="false"
              default-expand-all
              highlight-current
              @node-click="onNodeClick"
            />
          </div>
        </aside>

        <main class="panel org-table-panel">
          <div class="ledger-title-row">
            <div>
              <span>{{ entity?.name || page.title }}</span>
              <h2>{{ selectedNode?.label || tree.titleField || '全部' }} · {{ page.title }}</h2>
              <p>{{ description }}</p>
            </div>
            <pm-toolbar class="contract-toolbar ledger-actions" :bordered="false">
              <pm-toolbar-item v-for="action in toolbar.heading" :key="action" @click="emitAction(action)">
                {{ actionLabel(action) }}
              </pm-toolbar-item>
              <pm-toolbar-item v-if="toolbar.hasCreate" type="primary" :icon="Plus" @click="emitAction('create')">
                新增
              </pm-toolbar-item>
            </pm-toolbar>
          </div>

          <div class="org-table-toolbar">
            <pm-toolbar class="contract-toolbar bulk-actions" :bordered="false">
              <pm-toolbar-item
                v-for="action in toolbar.batch"
                :key="action"
                type="primary"
                plain
                :disabled="!selected.length"
                @click="emitAction(action)"
              >
                {{ actionLabel(action) }}
              </pm-toolbar-item>
            </pm-toolbar>
            <div class="table-filter-line">
              <ContractSearch
                v-model:query="searchQuery"
                :page="page"
                :fields="filterModel.fields"
                :placeholder="searchPlaceholder"
                @search="currentPage = 1"
              />
            </div>
          </div>

          <pm-table
            class="contract-table"
            :table-data="pagedRows"
            :columns="tableColumns"
            :checked="selectionOn"
            show-index
            @changrows="selected = $event"
          >
            <template v-if="statusColumn" #status="{ row }">
              <span class="status-chip" :class="statusClassOf(row[statusColumn.prop])">
                {{ formatCellValue(statusField, row[statusColumn.prop]) }}
              </span>
            </template>
            <template v-if="rowActions.length" #action="{ row }">
              <button
                v-for="action in rowActions"
                :key="action.code"
                type="button"
                class="link-button"
                @click.stop="emitAction(action.code, action.label, row)"
              >
                {{ action.label }}
              </button>
            </template>
          </pm-table>

          <div class="ledger-footer">
            <span>{{ pagerText }}</span>
            <pm-pagination
              class="contract-pagination"
              v-model:current-page="currentPage"
              background
              layout="prev, pager, next"
              :page-size="pageSize"
              :total="total"
            />
          </div>
        </main>
      </section>
    </template>

    <!-- 页面表单：page-heading + panel.form-panel -->
    <template v-else-if="recipe === 'page-form'">
      <header class="page-heading">
        <div>
          <h1>{{ page.title }}</h1>
          <p>{{ description }}</p>
        </div>
        <pm-toolbar class="contract-toolbar heading-actions" :bordered="false">
          <pm-toolbar-item v-for="action in toolbar.heading" :key="action" @click="emitAction(action)">
            {{ actionLabel(action) }}
          </pm-toolbar-item>
        </pm-toolbar>
      </header>
      <section class="panel form-panel" data-testid="contract-form-panel">
        <ContractFormFields :page="page" :form="form" :model="formModel" show-actions @action="onFormAction" />
      </section>
    </template>

    <!-- 弹窗表单：背景列表 panel + pm-form-dialog -->
    <template v-else-if="recipe === 'dialog-form'">
      <header class="page-heading">
        <div>
          <h1>{{ page.title }}</h1>
          <p>{{ description }}</p>
        </div>
        <pm-toolbar class="contract-toolbar heading-actions" :bordered="false">
          <pm-toolbar-item type="primary" :icon="Plus" @click="dialogVisible = true">{{ actionLabel('create') }}</pm-toolbar-item>
        </pm-toolbar>
      </header>
      <section class="panel" data-testid="contract-dialog-backdrop">
        <pm-table class="contract-table" :table-data="rows.slice(0, 5)" :columns="backgroundColumns" show-index />
      </section>

      <pm-form-dialog
        :dialog-visible="dialogVisible"
        :title="page.title"
        :width="`${form.width}px`"
        :modal="false"
        :append-to-body="false"
        @update:dialog-visible="dialogVisible = $event"
        @submit="onDialogSubmit"
        @cancel="onDialogCancel"
      >
        <template #form>
          <ContractFormFields :page="page" :form="form" :model="formModel" />
        </template>
      </pm-form-dialog>
    </template>

    <!-- 驾驶舱：page-heading + metrics-grid + panel（pm-echarts / 最近记录 pm-table） -->
    <template v-else-if="recipe === 'dashboard'">
      <header class="page-heading">
        <div>
          <h1>{{ page.title }}</h1>
          <p>{{ description }}</p>
        </div>
        <pm-toolbar class="contract-toolbar heading-actions" :bordered="false">
          <pm-toolbar-item v-for="action in toolbar.heading" :key="action" @click="emitAction(action)">
            {{ actionLabel(action) }}
          </pm-toolbar-item>
          <pm-toolbar-item v-if="toolbar.hasCreate" type="primary" :icon="Plus" @click="emitAction('create')">
            新增
          </pm-toolbar-item>
        </pm-toolbar>
      </header>

      <div class="metrics-grid" data-testid="contract-dashboard-metrics">
        <article v-for="(metric, index) in dashboard.metrics" :key="`${metric.label}-${index}`" class="metric-card">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.note }}</small>
        </article>
      </div>

      <section class="panel" data-testid="contract-dashboard-chart">
        <h2 class="panel-title">分布 / 趋势</h2>
        <pm-echarts v-if="dashboard.chartOption" :option="dashboard.chartOption" height="260px" />
        <div v-else class="asset-empty" data-testid="contract-dashboard-chart-empty">暂无可展示的数据分布</div>
      </section>

      <section class="panel" data-testid="contract-dashboard-table">
        <h2 class="panel-title">最近记录</h2>
        <pm-table
          v-if="dashboard.rows.length"
          class="contract-table"
          :table-data="dashboard.rows"
          :columns="decorateColumns(dashboard.columns, entity)"
          show-index
        >
          <template v-if="statusColumn" #status="{ row }">
            <span class="status-chip" :class="statusClassOf(row[statusColumn.prop])">
              {{ formatCellValue(statusField, row[statusColumn.prop]) }}
            </span>
          </template>
        </pm-table>
        <div v-else class="asset-empty">暂无记录</div>
      </section>
    </template>

    <!-- 详情：page-heading + detail-hero + detail-grid（info-grid / timeline / 子表 pm-table） -->
    <template v-else-if="recipe === 'detail'">
      <header class="page-heading">
        <div>
          <div class="title-line">
            <h1>{{ page.title }}</h1>
            <span
              v-if="detail.status.value"
              class="status-chip"
              :class="detail.status.className"
              data-testid="contract-detail-status"
            >{{ detail.status.value }}</span>
          </div>
          <p>{{ description }}</p>
        </div>
        <pm-toolbar class="contract-toolbar heading-actions" :bordered="false">
          <pm-toolbar-item v-for="action in toolbar.heading" :key="action" @click="emitAction(action)">
            {{ actionLabel(action) }}
          </pm-toolbar-item>
        </pm-toolbar>
      </header>

      <section v-if="detail.empty" class="panel" data-testid="contract-detail-empty">
        <h2 class="panel-title">基本信息</h2>
        <div class="asset-empty">该页面未绑定实体：暂无可展示的详情字段。</div>
      </section>

      <template v-else>
        <section class="detail-hero" data-testid="contract-detail-hero">
          <div>
            <span>{{ detail.entityName }} · {{ page.title }}</span>
            <h2>{{ detail.hero.title }}</h2>
            <p>{{ [detail.hero.number, detail.hero.owner ? `负责人 ${detail.hero.owner}` : ''].filter(Boolean).join(' · ') || description }}</p>
          </div>
          <div class="detail-number">
            <span>{{ detail.status.label || '当前状态' }}</span>
            <strong>{{ detail.status.value || '—' }}</strong>
          </div>
        </section>

        <div class="detail-grid">
          <div>
            <section class="panel" data-testid="contract-detail-info">
              <h2 class="panel-title">基本信息</h2>
              <div class="info-grid">
                <div v-for="field in detail.fields" :key="field.name" class="info-item">
                  <span>{{ field.label }}</span>
                  <strong>{{ field.value }}</strong>
                </div>
              </div>
            </section>

            <section v-if="detail.subTables.length" class="panel" data-testid="contract-detail-subtables">
              <template v-if="detail.subTables.length > 1">
                <div class="contract-subtabs">
                  <button
                    v-for="(sub, index) in detail.subTables"
                    :key="sub.id"
                    type="button"
                    :class="['contract-subtab', { on: index === activeSubTable }]"
                    :data-testid="`contract-subtab-${index}`"
                    @click="activeSubTable = index"
                  >
                    {{ sub.title }}
                  </button>
                </div>
              </template>
              <template v-for="(sub, index) in detail.subTables" :key="sub.id">
                <section v-if="detail.subTables.length === 1 || index === activeSubTable" :data-testid="`contract-subtable-${index}`">
                  <h2 class="panel-title">{{ sub.title }}</h2>
                  <pm-table
                    class="contract-table"
                    :table-data="sub.rows"
                    :columns="decorateColumns(sub.columns, entityOf(sub.id))"
                    show-index
                  />
                </section>
              </template>
            </section>
          </div>

          <aside>
            <section class="panel" data-testid="contract-detail-timeline">
              <h2 class="panel-title">动态</h2>
              <ol class="timeline">
                <li v-for="item in detail.timeline" :key="item.title">
                  <strong>{{ item.title }}</strong>
                  <span>{{ item.desc }}</span>
                </li>
              </ol>
            </section>
          </aside>
        </div>
      </template>
    </template>

    <!-- 主子表：page-heading + 表单分组 panel + 子表 panel（多个子表用页签） -->
    <template v-else-if="recipe === 'main-sub'">
      <header class="page-heading">
        <div>
          <h1>{{ page.title }}</h1>
          <p>{{ description }}</p>
        </div>
        <pm-toolbar class="contract-toolbar heading-actions" :bordered="false">
          <pm-toolbar-item v-for="action in toolbar.heading" :key="action" @click="emitAction(action)">
            {{ actionLabel(action) }}
          </pm-toolbar-item>
          <pm-toolbar-item v-if="toolbar.hasCreate" type="primary" :icon="Plus" @click="emitAction('create')">
            新增
          </pm-toolbar-item>
        </pm-toolbar>
      </header>

      <section class="panel form-panel" data-testid="contract-main-sub-form">
        <div v-if="!entity" class="asset-empty">该页面未绑定实体：暂无表单字段。</div>
        <ContractFormFields
          v-else
          :page="page"
          :form="form"
          :model="formModel"
          show-actions
          @action="onFormAction"
        />
      </section>

      <section v-if="detail.subTables.length" class="panel" data-testid="contract-main-sub-subtables">
        <div v-if="detail.subTables.length > 1" class="contract-subtabs">
          <button
            v-for="(sub, index) in detail.subTables"
            :key="sub.id"
            type="button"
            :class="['contract-subtab', { on: index === activeMainSub }]"
            :data-testid="`contract-main-sub-tab-${index}`"
            @click="activeMainSub = index"
          >
            {{ sub.title }}
          </button>
        </div>
        <template v-for="(sub, index) in detail.subTables" :key="sub.id">
          <section
            v-if="detail.subTables.length === 1 || index === activeMainSub"
            :data-testid="`contract-main-sub-table-${index}`"
          >
            <h2 class="panel-title">{{ sub.title }}</h2>
            <pm-table
              class="contract-table"
              :table-data="sub.rows"
              :columns="decorateColumns(sub.columns, entityOf(sub.id))"
              show-index
            />
          </section>
        </template>
      </section>
      <section v-else class="panel" data-testid="contract-main-sub-empty">
        <h2 class="panel-title">子表明细</h2>
        <div class="asset-empty">该页面未声明可解析的子表（subTables）。</div>
      </section>
    </template>

    <!-- 分步表单：page-heading + pm-steps + 当前步骤分组 panel + 上一步/下一步/提交 -->
    <template v-else-if="recipe === 'wizard'">
      <header class="page-heading">
        <div>
          <h1>{{ page.title }}</h1>
          <p>{{ description }}</p>
        </div>
        <pm-toolbar class="contract-toolbar heading-actions" :bordered="false">
          <pm-toolbar-item v-for="action in toolbar.heading" :key="action" @click="emitAction(action)">
            {{ actionLabel(action) }}
          </pm-toolbar-item>
        </pm-toolbar>
      </header>

      <section class="panel" data-testid="contract-wizard-steps-wrap">
        <pm-steps
          v-model="activeStep"
          :options="wizardSteps"
          is-align-center
          data-testid="contract-wizard-steps"
        />
      </section>

      <section class="panel form-panel" data-testid="contract-wizard-panel">
        <div v-if="!entity" class="asset-empty">该页面未绑定实体：暂无表单字段。</div>
        <ContractFormFields
          v-else
          :page="page"
          :form="form"
          :model="formModel"
          :only-group="activeStep"
        />
      </section>

      <div class="form-actions wizard-actions" data-testid="contract-wizard-footer">
        <el-button v-if="activeStep > 0" data-testid="contract-wizard-prev" @click="activeStep -= 1">
          上一步
        </el-button>
        <el-button
          v-if="activeStep < wizardSteps.length - 1"
          type="primary"
          data-testid="contract-wizard-next"
          @click="activeStep += 1"
        >
          下一步
        </el-button>
        <el-button v-else type="primary" data-testid="contract-wizard-submit" @click="emitAction('submit')">
          提交
        </el-button>
      </div>
    </template>

    <!-- 通用兜底：模板 detail 通用页（page-heading + panel/info-grid 或空态，不出现灰阶线框） -->
    <template v-else>
      <header class="page-heading">
        <div>
          <h1>{{ page.title }}</h1>
          <p>{{ description }}</p>
        </div>
        <pm-toolbar class="contract-toolbar heading-actions" :bordered="false">
          <pm-toolbar-item v-for="action in toolbar.heading" :key="action" @click="emitAction(action)">
            {{ actionLabel(action) }}
          </pm-toolbar-item>
        </pm-toolbar>
      </header>
      <section class="panel" data-testid="contract-generic-panel">
        <h2 class="panel-title">基本信息</h2>
        <div v-if="detail.fields.length" class="info-grid">
          <div v-for="field in detail.fields" :key="field.name" class="info-item">
            <span>{{ field.label }}</span>
            <strong>{{ field.value }}</strong>
          </div>
        </div>
        <div v-else class="asset-empty">该页面暂无可用字段：请检查页面契约与实体定义。</div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import ContractSearch from './ContractSearch.vue'
import ContractFormFields from './ContractFormFields.vue'
import {
  RECIPE_LABELS,
  actionLabel,
  buildColumns,
  buildDashboardModel,
  buildDetailModel,
  buildFilters,
  buildForm,
  buildRowActions,
  buildToolbar,
  buildTreeRows,
  formatCellValue,
  initialFormValue,
  mockRowCountOf,
  mockRowsForEntity,
  pageSizeOf,
  pagerTextOf,
  selectionEnabled,
  statusClassOfValue
} from './contract-preview.js'

/**
 * 设计产物模板风格渲染器（P9/P10/P10b）
 *
 * 输入 `design.json` 页面契约 + 实体，按配方用模板结构类与 pm-v3 组件渲染：
 * list / tree-list / page-form / dialog-form / detail / dashboard / main-sub / wizard；
 * 未知/无映射配方由 `resolveContractRecipe` 映射到通用模板页（不会到这里）。
 * 数据为确定性本地 mock。
 */
const props = defineProps<{
  page: any
  entity: any
  recipe: string
  /** 应用全部实体（详情子表 target 解析用） */
  entities?: any[]
  /** 模板主色（驾驶舱图表 series 颜色，来自所选视觉风格 tokens） */
  primary?: string
}>()

/**
 * 交互预览层（B5）：动作只 emit 给宿主（DesignPreviewApp / TemplatePreviewApp），
 * 由宿主决定弹窗 / 切页 / 确认 / 提示；本组件不写数据、不调接口。
 */
const emit = defineEmits<{ (event: 'action', payload: { code: string; label: string; row?: any }): void }>()

const rows = computed(() => mockRowsForEntity(props.entity, mockRowCountOf(props.page)))
const pageSize = computed(() => pageSizeOf(props.page))
const columnsModel = computed(() => buildColumns(props.page, props.entity))
const filterModel = computed(() => buildFilters(props.page, props.entity))
const toolbar = computed(() => buildToolbar(props.page))
const rowActions = computed(() => buildRowActions(props.page))
const form = computed(() => buildForm(props.page, props.entity))
const tree = computed(() => buildTreeRows(rows.value, props.page?.layout?.tree))
const selectionOn = computed(() => selectionEnabled(props.page))
const dashboard = computed(() =>
  buildDashboardModel({ page: props.page, entity: props.entity, rows: rows.value, primary: props.primary })
)
const detail = computed(() =>
  buildDetailModel({
    page: props.page,
    entity: props.entity,
    row: rows.value[0],
    subTables: props.page?.layout?.subTables,
    entities: props.entities ?? []
  })
)

const searchQuery = ref<Record<string, any>>({})
const treeQuery = ref<Record<string, any>>({ keyword: '' })
const selected = ref<any[]>([])
const currentPage = ref(1)
const selectedNode = ref<any>(null)
const activeSubTable = ref(0)
const activeMainSub = ref(0)
const activeStep = ref(0)
const formModel = reactive<Record<string, any>>({})
/** dialog-form 默认打开（与既有预览行为一致），可取消关闭、页头「新增」重新打开 */
const dialogVisible = ref(true)

const treeProps = { id: 'id', label: 'label', children: 'children', isLeaf: 'isLeaf' }

const description = computed(() => {
  const entityName = props.entity?.name || ''
  const recipeLabel = RECIPE_LABELS[props.recipe] || ''
  return [entityName, recipeLabel, '设计产物 · 本地 mock 数据'].filter(Boolean).join(' · ')
})

const searchPlaceholder = computed(() => {
  const field = filterModel.value.fields[0]
  return field ? `搜索${field.label || field.name}` : '输入关键词后回车搜索'
})

const listSummary = computed(() => `当前筛选 ${total.value} 条 · 已选 ${selected.value.length} 条`)

/** 分步表单步骤：form.groups → pm-steps options（无分组时保留 buildForm 的默认单组） */
const wizardSteps = computed(() =>
  (form.value.groups.length ? form.value.groups : [{ title: '' }]).map((group: any, index: number) => ({
    value: index,
    label: group.title || `步骤 ${index + 1}`
  }))
)

/** 首个枚举列用模板状态标签（其余列走 formatter，避免同名插槽串值） */
const statusColumn = computed(() => columnsModel.value.columns.find(column => column.scope === 'status') ?? null)
const statusField = computed(() =>
  statusColumn.value ? props.entity?.fields?.find((field: any) => field.name === statusColumn.value?.prop) ?? null : null
)

const tableColumns = computed(() => {
  const columns = decorateColumns(columnsModel.value.columns, props.entity)
  if (!rowActions.value.length) return columns
  return [
    ...columns,
    {
      prop: '__actions',
      label: '操作',
      scope: 'action',
      width: Math.max(96, rowActions.value.length * 52)
    }
  ]
})

const backgroundColumns = computed(() =>
  (props.entity?.fields ?? []).slice(0, 4).map((field: any) => ({ prop: field.name, label: field.label || field.name }))
)

/** 列格式化：给非状态列补 formatter（子表按目标实体解析字段） */
function decorateColumns(columns: any[], targetEntity: any): any[] {
  return (columns ?? []).map(column => {
    if (column.scope === 'status') return column
    const field = targetEntity?.fields?.find((item: any) => item.name === column.prop)
    return {
      ...column,
      formatter: (row: any) => formatCellValue(field, row?.[column.prop])
    }
  })
}

function entityOf(entityId: string): any {
  return (props.entities ?? []).find((item: any) => item?.id === entityId) ?? null
}

const entityKeyField = computed(() => {
  const fields = props.entity?.fields ?? []
  const preferred = fields.find((field: any) => /名称|标题|编号|编码/.test(`${field.name}${field.label ?? ''}`))
  return (preferred || fields[0])?.name ?? '__id'
})

const filteredRows = computed(() => {
  const query = searchQuery.value || {}
  const active = Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  if (!active.length) return rows.value
  return rows.value.filter(row => active.every(([key, value]) => String(row[key] ?? '').includes(String(value))))
})

const total = computed(() => filteredRows.value.length)
const pagedRows = computed(() =>
  filteredRows.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value)
)

const pagerText = computed(
  () =>
    `${pagerTextOf(props.page, { total: total.value, selectedCount: selected.value.length })} · 每页 ${pageSize.value} 条`
)

const notes = computed(() => {
  const list: string[] = []
  if (!props.entity) list.push('页面未绑定实体：表格与表单内容为空，仅渲染模板结构')
  if (columnsModel.value.skipped.length) {
    list.push(`已跳过实体不存在的列：${columnsModel.value.skipped.join('、')}`)
  }
  if (filterModel.value.skipped.length) {
    list.push(`已跳过实体不存在的查询字段：${filterModel.value.skipped.join('、')}`)
  }
  const formSkipped = [...new Set(form.value.skipped)].filter(
    name => !columnsModel.value.skipped.includes(name) && !filterModel.value.skipped.includes(name)
  )
  if (formSkipped.length) list.push(`已跳过实体不存在的表单字段：${formSkipped.join('、')}`)
  if (props.recipe === 'detail' && detail.value.skipped.length) {
    list.push(`已跳过无法解析的详情子表：${detail.value.skipped.join('、')}`)
  }
  return list
})

const treeNodes = computed(() => filterTree(tree.value.nodes, String(treeQuery.value?.keyword ?? '').trim()))

function filterTree(nodes: any[], keyword: string): any[] {
  if (!keyword) return nodes
  const list: any[] = []
  for (const node of nodes || []) {
    const children = filterTree(node.children || [], keyword)
    if (String(node.label).includes(keyword)) list.push({ ...node, children })
    else if (children.length) list.push({ ...node, children })
  }
  return list
}

function statusClassOf(value: unknown): string {
  return statusClassOfValue(statusField.value, value)
}

function onNodeClick(node: any): void {
  selectedNode.value = node
  selected.value = []
}

/** 动作冒泡到宿主（工具栏 / 行操作 / 批量 / 表单 / 向导） */
function emitAction(code: string, label?: string, row?: any): void {
  emit('action', { code, label: label || actionLabel(code), row })
}

/** 表单动作（ContractFormFields emit `{ code, label }`） */
function onFormAction(payload: { code: string; label?: string }): void {
  emitAction(payload?.code, payload?.label)
}

function onDialogSubmit(): void {
  dialogVisible.value = false
  emitAction('submit')
}

function onDialogCancel(): void {
  dialogVisible.value = false
  emitAction('cancel')
}

watch(
  () => [props.page, props.entity],
  () => {
    searchQuery.value = {}
    treeQuery.value = { keyword: '' }
    selected.value = []
    currentPage.value = 1
    Object.keys(formModel).forEach(key => delete formModel[key])
    form.value.fields.forEach((field: any, index: number) => {
      formModel[field.name] = initialFormValue(field, index)
    })
    selectedNode.value = tree.value.nodes[0] ?? null
    activeSubTable.value = 0
    activeMainSub.value = 0
    activeStep.value = 0
    dialogVisible.value = true
  },
  { immediate: true }
)

watch(total, () => {
  if (currentPage.value > 1 && (currentPage.value - 1) * pageSize.value >= total.value) currentPage.value = 1
})
</script>

<style scoped>
.contract-page {
  min-height: 100%;
}

.contract-notes {
  margin: 0 0 12px;
  padding: 7px 11px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--template-warning);
  border: 1px solid var(--template-warning-soft);
  border-radius: var(--template-radius-small);
  background: var(--template-warning-soft);
  font-size: 11px;
}

.contract-search-line,
.table-filter-line {
  margin-bottom: 12px;
}

.org-ledger-shell {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.org-tree-panel {
  position: sticky;
  top: 12px;
  padding: 14px;
  border: 1px solid var(--template-border);
  border-radius: var(--template-radius);
  background: var(--template-surface-soft);
  box-shadow: var(--template-shadow);
}

.org-tree-panel :deep(.pm-search-main) {
  align-items: stretch;
  flex-direction: column;
}

.org-tree-panel :deep(.pm-search-main .el-button) {
  width: 100%;
}

.org-tree-note {
  margin: 10px 0 0;
  color: var(--template-warning);
  font-size: 10px;
  line-height: 1.5;
}

.org-tree-wrap {
  min-height: 380px;
  margin: 10px 0 0;
  padding: 6px;
  overflow: auto;
  border-top: 1px solid var(--template-border-light);
  border-bottom: 1px solid var(--template-border-light);
}

.org-table-panel {
  min-width: 0;
  margin: 0;
  padding: 0 18px 16px;
}

.ledger-title-row {
  margin: 0 -18px 14px;
  padding: 17px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--template-border);
  background: var(--template-surface-soft);
}

.ledger-title-row > div > span {
  color: var(--template-primary);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.ledger-title-row h2 {
  margin: 4px 0 0;
  color: var(--template-heading);
  font: 650 20px Georgia, 'Songti SC', serif;
}

.ledger-title-row p {
  margin: 4px 0 0;
  color: var(--template-text-soft);
  font-size: 9px;
}

.org-table-toolbar {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ledger-footer {
  padding-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--template-text-soft);
  font-size: 9px;
}

.wizard-actions {
  margin-top: 0;
  padding: 14px 18px;
  border: 1px solid var(--template-border);
  border-radius: var(--template-radius);
  background: var(--template-surface);
  box-shadow: var(--template-shadow);
}

.title-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.asset-empty {
  padding: 18px 6px;
  color: var(--template-text-soft);
  font-size: 12px;
  text-align: center;
}

.detail-hero > div > span {
  color: var(--template-primary);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.detail-hero > div > h2 {
  margin: 6px 0 0;
  color: var(--template-heading);
  font: 650 22px Georgia, 'Songti SC', serif;
}

.detail-hero > div > p {
  margin: 6px 0 0;
  color: var(--template-text-soft);
  font-size: 11px;
}

.contract-subtabs {
  margin-bottom: 14px;
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--template-border-light);
}

.contract-subtab {
  padding: 7px 12px;
  color: var(--template-text-soft);
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
}

.contract-subtab.on {
  color: var(--template-primary);
  border-bottom-color: var(--template-primary);
  font-weight: 700;
}

@media (max-width: 720px) {
  .org-ledger-shell {
    grid-template-columns: 1fr;
  }
  .org-tree-panel {
    position: static;
  }
}
</style>
