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
      <button v-if="canCreate" class="wf-m-fab" type="button" @click="emit('nav', 'create')">＋ 新增</button>
      <div class="wf-m-loadmore" data-wf-anchor="pager">上拉加载更多</div>
    </template>

    <!-- 桌面 / 平板：检索区 + 表格 + 分页 -->
    <template v-else>
      <div class="wf-search" data-wf-anchor="search">
        <div v-for="field in searchFields" :key="field.name" class="wf-search-item">
          {{ field.label }}<span class="wf-search-bar" />
        </div>
        <span class="wf-btn wf-btn-primary">查询</span>
        <span class="wf-btn">重置</span>
      </div>
      <div class="wf-toolbar-row" data-wf-anchor="toolbar" style="margin-bottom: 10px; display: flex; gap: 8px">
        <span v-if="canCreate" class="wf-btn wf-btn-primary" @click="emit('nav', 'create')">+ 新增</span>
        <span v-for="action in toolbarActions" :key="action" class="wf-btn" @click="emit('notify', actionLabel(action))">{{ actionLabel(action) }}</span>
      </div>
      <div class="wf-table-wrap" data-wf-anchor="table">
        <table class="wf-table">
          <thead>
            <tr>
              <th class="wf-col-check" data-wf-anchor="selection">
                <span :class="['wf-check', { on: selState === 'all', some: selState === 'some' }]" title="全选" @click="toggleAll" />
              </th>
              <th v-for="col in columns" :key="col.name" :data-wf-anchor="`column:${col.name}`">{{ col.label }}</th>
              <th style="width: 140px" data-wf-anchor="actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in pageRows" :key="ri" :data-wf-anchor="`row:${ri}`" :class="{ sel: selected.has(ri) }">
              <td class="wf-col-check"><span :class="['wf-check', { on: selected.has(ri) }]" @click="toggleRow(ri)" /></td>
              <td v-for="col in columns" :key="col.name">
                <span v-if="col.type === 'enum'" :class="['wf-tag', ri % 2 ? 'warn' : 'ok']">{{ displayValue(col, row[col.name]) }}</span>
                <template v-else>{{ displayValue(col, row[col.name]) }}</template>
              </td>
              <td data-wf-anchor="actions">
                <span class="wf-btn-text" @click="emit('nav', 'detail', ri)">详情</span>
                <span v-if="canEdit" class="wf-btn-text" @click="emit('notify', '编辑')">编辑</span>
                <span v-if="canDelete" class="wf-btn-text danger" @click="emit('notify', '删除')">删除</span>
              </td>
            </tr>
            <tr v-if="!pageRows.length">
              <td :colspan="columns.length + 2" class="wf-empty">页面未绑定实体，先在「页面」编辑中绑定</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="wf-pager" data-wf-anchor="pager">
        <span v-if="selected.size" class="wf-sel-count">已选 {{ selected.size }} 项</span>
        <span class="pg">‹</span>
        <span class="pg on">1</span>
        <span class="pg">2</span>
        <span class="pg">3</span>
        <span class="pg">›</span>
        <span>共 {{ total }} 条</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { MockRow } from './mock'
import { displayValue } from './mock'
import type { PageLayout, SpecEntity, SpecField, SpecPage } from './spec-types'
import { actionLabel, tableColumns, tablePageSize } from './layout'

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

const pageRows = computed(() => props.rows.slice(0, props.mobile ? 8 : tablePageSize(props.layout)))

const total = computed(() => props.rows.length + 23)

/** 行操作默认规则：页面未声明 actions 时默认展示 详情/编辑/删除（与 spec 归一化规则一致） */
const canEdit = computed(() => !props.page.actions?.length || props.page.actions.includes('edit'))
/** 新增入口：AI/自定义布局 toolbar.actions 优先，其次页面未定义动作时默认展示 */
const canCreate = computed(() => {
  const override = props.layout?.toolbar?.actions
  if (override?.length) return override.includes('create')
  return !props.page.actions?.length || props.page.actions.includes('create')
})
const canDelete = computed(() => !props.page.actions?.length || props.page.actions.includes('delete'))

/** 列表页工具栏默认动作：新增之外为 批量删除 / 导入 / 导出 */
const LIST_TOOLBAR_DEFAULTS = ['batchDelete', 'import', 'export']

/** 行级/流程动作不进工具栏 */
const NON_TOOLBAR_ACTIONS = ['create', 'edit', 'delete', 'detail', 'submit', 'cancel', 'view']

const toolbarActions = computed(() => {
  // AI/自定义布局覆盖 > 页面显式动作 > 默认组合
  const override = props.layout?.toolbar?.actions
  if (override?.length) return override.filter(a => !NON_TOOLBAR_ACTIONS.includes(a))
  const extra = (props.page.actions ?? []).filter(a => !NON_TOOLBAR_ACTIONS.includes(a))
  return extra.length ? extra : LIST_TOOLBAR_DEFAULTS
})

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
</script>
<!-- Modified by AI on 2026-09-16 09:30:52 -->

<!-- Modified by AI on 2026-09-18 14:20:18 -->
