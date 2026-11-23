<template>
  <div>
    <!-- 手机：钉钉/微信式卡片列表 -->
    <template v-if="mobile">
      <div class="wf-m-search" data-wf-anchor="search">
        <span class="wf-m-search-inner"><span class="wf-m-search-icon">⌕</span>搜索</span>
      </div>
      <div class="wf-m-list" data-wf-anchor="table">
        <div v-for="(row, ri) in pageRows" :key="ri" :data-wf-anchor="`row:${ri}`" class="wf-m-card" @click="emit('nav', 'detail', ri)">
          <div class="wf-m-card-avatar" />
          <div class="wf-m-card-body">
            <div class="wf-m-card-title">
              <span>{{ titleOf(row) }}</span>
              <span v-if="statusCol" :class="['wf-tag', ri % 2 ? 'warn' : 'ok']">{{ displayValue(statusCol, row[statusCol.name]) }}</span>
            </div>
            <div v-for="meta in metaCols" :key="meta.name" class="wf-m-card-meta">
              <span class="wf-m-card-label">{{ meta.label }}</span>
              <span>{{ displayValue(meta, row[meta.name]) }}</span>
            </div>
          </div>
          <span class="wf-m-card-chev">›</span>
        </div>
        <div v-if="!pageRows.length" class="wf-empty">页面未绑定实体，先在「页面」编辑中绑定</div>
      </div>
      <button v-if="createVisible" class="wf-m-fab" type="button" @click="emit('nav', 'create')">＋ 新增</button>
      <div class="wf-m-loadmore" data-wf-anchor="pager">上拉加载更多</div>
    </template>

    <!-- 桌面 / 平板：可选树面板 + 检索区 + 表格 + 分页 -->
    <div v-else :class="tree ? 'wf-split' : ''">
      <aside v-if="tree" class="wf-tree" data-wf-anchor="tree" data-testid="wf-tree">
        <div class="wf-tree-head">
          <span class="wf-tree-title">{{ tree.title }}</span>
          <span v-if="tree.actionStyle === 'header'" class="wf-tree-actions">
            <span class="wf-tree-action" data-testid="wf-tree-action" @click="emit('nav', 'create')">{{ actionLabel('create') }}</span>
            <span class="wf-tree-action" @click="emit('notify', actionLabel('edit'))">{{ actionLabel('edit') }}</span>
          </span>
        </div>
        <div class="wf-tree-search"><span class="wf-tree-search-icon">⌕</span>搜索</div>
        <div class="wf-tree-nodes">
          <span
            v-for="(node, ni) in tree.nodes"
            :key="ni"
            :class="['wf-tree-node', `style-${tree.selectionStyle}`, { 'is-selected': selectedNode === ni }]"
            :style="{ paddingLeft: `${10 + node.depth * 14}px` }"
            data-testid="wf-tree-node"
            @click="selectedNode = ni"
          >
            <i v-if="tree.selectionStyle === 'dot'" class="wf-tree-dot" />
            <span class="wf-tree-node-label">{{ node.label }}</span>
          </span>
          <div v-if="!tree.nodes.length" class="wf-tree-empty">暂无节点</div>
        </div>
        <div v-if="tree.actionStyle === 'footer'" class="wf-tree-actions footer">
          <span class="wf-tree-action" @click="emit('nav', 'create')">{{ actionLabel('create') }}</span>
          <span class="wf-tree-action" @click="emit('notify', actionLabel('edit'))">{{ actionLabel('edit') }}</span>
        </div>
      </aside>

      <div :class="tree ? 'wf-main' : ''">
        <div class="wf-search" data-wf-anchor="search">
          <div v-for="field in searchFields" :key="field.name" class="wf-search-item">
            {{ field.label }}<span class="wf-search-bar" />
          </div>
          <span class="wf-btn wf-btn-primary">查询</span>
          <span class="wf-btn">重置</span>
        </div>
        <div class="wf-toolbar-row" data-wf-anchor="toolbar" style="margin-bottom: 10px; display: flex; gap: 8px">
          <span v-if="createVisible" class="wf-btn wf-btn-primary" @click="emit('nav', 'create')">+ 新增</span>
          <span v-for="action in toolbarItems" :key="action" class="wf-btn" @click="emit('notify', actionLabel(action))">{{ actionLabel(action) }}</span>
        </div>
        <div v-if="selectionEnabled && selected.size" class="wf-batch-bar" data-testid="wf-batch-bar">
          <span class="wf-batch-text">已选 {{ selected.size }} 项</span>
          <span v-for="action in batchActions" :key="action" class="wf-btn" @click="emit('notify', actionLabel(action))">{{ actionLabel(action) }}</span>
        </div>
        <div class="wf-table-wrap" data-wf-anchor="table">
          <table class="wf-table">
            <thead>
              <tr>
                <th v-if="selectionEnabled" class="wf-col-check" data-wf-anchor="selection">
                  <span :class="['wf-check', { on: selState === 'all', some: selState === 'some' }]" title="全选" @click="toggleAll" />
                </th>
                <th v-for="col in columns" :key="col.name" :data-wf-anchor="`column:${col.name}`">{{ col.label }}</th>
                <th style="width: 140px" data-wf-anchor="actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in pageRows" :key="ri" :data-wf-anchor="`row:${ri}`" :class="{ sel: selected.has(ri) }">
                <td v-if="selectionEnabled" class="wf-col-check">
                  <span :class="['wf-check', { on: selected.has(ri) }]" data-testid="wf-row-check" @click="toggleRow(ri)" />
                </td>
                <td v-for="col in columns" :key="col.name">
                  <span v-if="col.type === 'enum'" :class="['wf-tag', ri % 2 ? 'warn' : 'ok']">{{ displayValue(col, row[col.name]) }}</span>
                  <template v-else>{{ displayValue(col, row[col.name]) }}</template>
                </td>
                <td data-wf-anchor="actions" data-testid="wf-row-actions">
                  <span
                    v-for="action in rowActions"
                    :key="action"
                    :class="['wf-btn-text', { danger: action === 'delete' }]"
                    @click="onRowAction(action, ri)"
                  >{{ actionLabel(action) }}</span>
                  <span v-if="!rowActions.length" class="wf-btn-text ghost">—</span>
                </td>
              </tr>
              <tr v-if="!pageRows.length">
                <td :colspan="columns.length + (selectionEnabled ? 2 : 1)" class="wf-empty">页面未绑定实体，先在「页面」编辑中绑定</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div :class="['wf-pager', `wf-pager-${pager.layout}`]" data-wf-anchor="pager">
          <template v-if="pager.layout === 'three-part'">
            <span class="wf-pager-stat" data-testid="wf-pager-selection">{{ pagerSelectionText(selectionEnabled, selected.size, total) }}</span>
            <span class="wf-pager-pages">
              <span class="pg">‹</span>
              <span class="pg on">1</span>
              <span class="pg">2</span>
              <span class="pg">3</span>
              <span class="pg">›</span>
            </span>
            <span class="wf-pager-stat">{{ pager.pageSize }} 条/页 · 共 {{ total }} 条</span>
          </template>
          <template v-else-if="pager.layout === 'split'">
            <span class="wf-pager-stat">共 {{ total }} 条</span>
            <span class="wf-pager-pages">
              <span class="pg">‹</span>
              <span class="pg on">1</span>
              <span class="pg">2</span>
              <span class="pg">3</span>
              <span class="pg">›</span>
            </span>
          </template>
          <template v-else>
            <span v-if="selected.size" class="wf-sel-count">已选 {{ selected.size }} 项</span>
            <span class="pg">‹</span>
            <span class="pg on">1</span>
            <span class="pg">2</span>
            <span class="pg">3</span>
            <span class="pg">›</span>
            <span>共 {{ total }} 条</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { MockRow } from './mock'
import { displayValue } from './mock'
import type { PageLayout, SpecEntity, SpecField, SpecPage } from './spec-types'
import { actionLabel, tableColumns, tablePageSize } from './layout'
import {
  isBatchAction,
  pagerSelectionText,
  paginationModel,
  resolveRowActions,
  resolveSelection,
  resolveToolbarActions,
  treeModel
} from './contract-view.js'

const props = defineProps<{
  page: SpecPage
  entity: SpecEntity | undefined
  layout: PageLayout | undefined
  rows: MockRow[]
  /** 手机形态：卡片列表替代表格 */
  mobile?: boolean
}>()

const emit = defineEmits<{
  nav: [kind: 'create' | 'detail' | 'back', rowIndex?: number]
  notify: [action: string]
}>()

const columns = computed(() => tableColumns(props.page, props.entity, props.layout))

const searchFields = computed(() => {
  // 显式声明的查询条件（layout.table.searchFields）优先；缺省=列表列前 3 个（与转换器推导规则一致）
  const explicit = props.layout?.table?.searchFields
  if (explicit && explicit.length) {
    const pool = new Map<string, SpecField>()
    for (const f of columns.value) pool.set(f.name, f)
    for (const f of props.entity?.fields ?? []) if (!pool.has(f.name)) pool.set(f.name, f)
    return explicit.map(n => pool.get(n)).filter((f): f is SpecField => !!f)
  }
  const fields = columns.value.filter(f => ['input', 'select'].includes(f.type === 'ref' || f.type === 'enum' ? 'select' : 'input'))
  return fields.slice(0, 3)
})

const pageRows = computed(() => props.rows.slice(0, props.mobile ? 8 : pager.value.pageSize))

const total = computed(() => props.rows.length + 23)

/** 多选：layout.selection=false 隐藏勾选列与批量条；缺省保持现状 */
const selectionEnabled = computed(() => resolveSelection(props.layout))

/** 新增入口：AI/自定义布局 toolbar.actions 优先，其次页面未定义动作时默认展示（P7-4a 前规则） */
const createVisible = computed(() => {
  const override = props.layout?.toolbar?.actions
  if (override?.length) return override.includes('create')
  return !props.page.actions?.length || props.page.actions.includes('create')
})

const toolbarActions = computed(() => resolveToolbarActions(props.page, props.layout))
const explicitToolbar = computed(() => Array.isArray(props.layout?.toolbarActions))
/** 显式 toolbarActions 时：批量动作只进批量条，create 保持主按钮 */
const toolbarItems = computed(() =>
  toolbarActions.value.filter(action => action !== 'create' && !(explicitToolbar.value && isBatchAction(action)))
)
/** 批量条动作：始终来自已声明的工具栏动作（默认组合含 batchDelete；未声明则只显示已选数量） */
const batchActions = computed(() => toolbarActions.value.filter(isBatchAction))

const rowActions = computed(() => resolveRowActions(props.page, props.layout))

const pager = computed(() =>
  paginationModel(props.layout, {
    total: total.value,
    selectedCount: selected.size,
    pageSize: tablePageSize(props.layout)
  })
)

/** 树列表：recipe=tree-list 或存在 tree 才有左侧树；节点不改变表格数据（PNG 稳定） */
const tree = computed(() => {
  if (!props.layout?.tree && props.page.recipe !== 'tree-list') return null
  return treeModel(props.rows, props.layout?.tree, {
    titleField: columns.value[0]?.name,
    maxNodes: 12
  })
})
const selectedNode = ref(0)

// 手机卡片：首个 string 字段作标题，enum 字段作状态角标，其余取 2 个作摘要行
const titleCol = computed(() => columns.value.find(f => f.type === 'string') ?? columns.value[0])
const statusCol = computed(() => columns.value.find(f => f.type === 'enum'))
const metaCols = computed(() => columns.value.filter(f => f.name !== titleCol.value?.name && f.name !== statusCol.value?.name).slice(0, 2))

function titleOf(row: MockRow): string {
  return titleCol.value ? displayValue(titleCol.value, row[titleCol.value.name]) : `记录 ${row[Object.keys(row)[0]] ?? ''}`
}

// ---- 多选：线框演示交互（仅前端演示态，不写入 spec）----
const selected = reactive(new Set<number>())

const selState = computed<'none' | 'some' | 'all'>(() => {
  if (!pageRows.value.length || !selected.size) return 'none'
  return selected.size >= pageRows.value.length ? 'all' : 'some'
})

function toggleRow(ri: number): void {
  if (selected.has(ri)) selected.delete(ri)
  else selected.add(ri)
}

function toggleAll(): void {
  if (selState.value === 'all') selected.clear()
  else pageRows.value.forEach((_, ri) => selected.add(ri))
}

/** 行操作：detail 触发导航，其余只做线框提示 */
function onRowAction(action: string, ri: number): void {
  if (action === 'detail' || action === 'view') {
    emit('nav', 'detail', ri)
    return
  }
  emit('notify', actionLabel(action))
}
</script>
<!-- Modified by AI on 2026-09-16 09:30:52 -->

<!-- Modified by AI on 2026-09-18 14:20:18 -->
