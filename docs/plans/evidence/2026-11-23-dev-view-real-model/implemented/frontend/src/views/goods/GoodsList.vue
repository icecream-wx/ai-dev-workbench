<template>
  <div class="optimized-suite application-type-operations visual-style-data-cyan goods-ledger">
    <div class="template-stage">
      <div class="business-page ops-ledger-page">
        <header class="page-heading ops-ledger-heading">
          <div>
            <h1>商品管理</h1>
            <p>统一维护商品基础信息、价格库存与上架状态</p>
          </div>
          <pm-toolbar class="heading-actions" :bordered="false">
            <pm-toolbar-item type="primary" :icon="Plus" @click="openCreate">新增商品</pm-toolbar-item>
          </pm-toolbar>
        </header>

        <div class="ops-ledger-layout">
          <aside class="ops-ledger-sidebar">
            <section class="ledger-summary">
              <span class="ledger-section-index">01 / 商品概况</span>
              <div>
                <strong>{{ rows.length }}</strong>
                <span>全部商品</span>
              </div>
              <div>
                <strong>{{ onShelfCount }}</strong>
                <span>已上架</span>
              </div>
              <div>
                <strong>{{ offShelfCount }}</strong>
                <span>已下架</span>
              </div>
              <div>
                <strong>{{ draftCount }}</strong>
                <span>草稿待完善</span>
              </div>
            </section>
            <section class="ledger-attention">
              <span class="ledger-section-index">今日关注</span>
              <p><b>{{ lowStockCount }}</b> 个商品库存低于 20 件</p>
              <p><b>{{ draftCount }}</b> 个草稿等待上架</p>
            </section>
          </aside>

          <section class="ops-ledger-main">
            <QueryPanel class="ledger-query" title="商品检索" :model="query"
              :layout="bindings.queryPanel.layout" :default-expanded="bindings.queryPanel.defaultExpanded"
              @search="applySearch" @reset="resetQuery" @toggle="queryExpanded = $event">
              <el-form-item label="商品名称" prop="name">
                <el-input v-model="query.name" clearable placeholder="请输入商品名称" />
              </el-form-item>
              <el-form-item label="上架状态" prop="status">
                <pm-select v-model="query.status" size="default" :options="statusOptions"
                  clearable placeholder="全部状态" />
              </el-form-item>
            </QueryPanel>

            <section class="panel ops-ledger-table">
              <div class="ledger-table-title">
                <div>
                  <span class="ledger-section-index">02 / 商品明细</span>
                  <h2>商品台账</h2>
                </div>
                <div class="ledger-update">
                  <span class="status-chip status-success">演示数据</span>
                  <small>未接后端</small>
                </div>
              </div>

              <BusinessListPage v-bind="bindings.list" :show-create="false" :show-batch-delete="true"
                :selection-count="selections.length" :deleting="deleting"
                @batch-delete="batchDelete" @clear-selection="clearSelection">
                <template #summary>
                  <div class="table-toolbar">
                    <small>当前筛选 {{ filteredRows.length }} 条，已选 {{ selections.length }} 条</small>
                    <small class="ledger-scope">每页 {{ pageSize }} 条</small>
                  </div>
                </template>
                <pm-table :key="tableKey" v-auto-height :table-data="pagedRows" :columns="columns"
                  :data-query-expanded="queryExpanded" checked show-index @changrows="handleSelectionChange">
                  <template #code="{ row }">
                    <span class="goods-code">{{ row.code }}</span>
                  </template>
                  <template #name="{ row }">
                    <strong class="goods-name">{{ row.name }}</strong>
                  </template>
                  <template #status="{ row }">
                    <span class="status-chip" :class="statusClass(row.status)">{{ row.status }}</span>
                  </template>
                  <template #price="{ row }">
                    <span class="goods-price">¥ {{ formatPrice(row.price) }}</span>
                  </template>
                  <template #stock="{ row }">
                    <span class="goods-stock" :class="{ 'is-low': isLowStock(row) }">{{ row.stock }}</span>
                  </template>
                  <template #action="{ row }">
                    <RowActions :mode="bindings.rowActions.mode" :actions="rowActions" :row="row"
                      @action="handleRowAction" />
                  </template>
                </pm-table>
                <template #pagination>
                  <ThreePartPagination v-model:current-page="currentPage" :page-size="pageSize"
                    :page-sizes="bindings.pagination.pageSizes" :total="filteredRows.length"
                    @size-change="handleSizeChange" />
                </template>
              </BusinessListPage>
            </section>
          </section>
        </div>
      </div>
    </div>

    <GoodsForm v-model:dialog-visible="formVisible" :record="editingRecord" :records="rows"
      @saved="handleSaved" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElFormItem, ElInput, ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import GlobalPreference from '@/preferences/GlobalPreference'
import {
  BusinessListPage,
  QueryPanel,
  RowActions,
  ThreePartPagination,
  resolvePagePreferences
} from '@/components/PageTemplates/index.js'
import GoodsForm from './GoodsForm.vue'

// 页面级偏好合并：契约要求 three-part 分页，只在页面 computed 覆盖，不修改全局单例。
const pagePreference = computed(() => ({
  ...GlobalPreference,
  templates: {
    ...GlobalPreference.templates,
    list: { ...GlobalPreference.templates.list, paginationLayout: 'three-part' }
  }
}))
const bindings = computed(() => resolvePagePreferences(pagePreference.value))

const statusOptions = ['已上架', '已下架', '草稿'].map(value => ({ label: value, value }))
const rows = ref([
  { id: 1, code: 'SP-2026-001', name: '轻薄商务笔记本 14 英寸', category: '电子设备', status: '已上架', price: 5299, stock: 36, owner: '林晓', remark: '含三年上门保修' },
  { id: 2, code: 'SP-2026-002', name: '27 英寸 4K 显示器', category: '电子设备', status: '已上架', price: 1899, stock: 24, owner: '周宁', remark: '支持 Type-C 反向供电' },
  { id: 3, code: 'SP-2026-003', name: '无线蓝牙键鼠套装', category: '电子设备', status: '已上架', price: 299, stock: 120, owner: '王可', remark: '黑色，含收纳包' },
  { id: 4, code: 'SP-2026-004', name: '便携式移动固态硬盘 1TB', category: '电子设备', status: '已上架', price: 699, stock: 18, owner: '赵洋', remark: '库存偏低，待补货' },
  { id: 5, code: 'SP-2026-005', name: 'USB-C 多功能扩展坞', category: '电子设备', status: '已下架', price: 459, stock: 0, owner: '陈雨', remark: '供应商升级型号' },
  { id: 6, code: 'SP-2026-006', name: '降噪头戴式耳机', category: '电子设备', status: '草稿', price: 899, stock: 42, owner: '苏禾', remark: '待补充认证资料' },
  { id: 7, code: 'SP-2026-007', name: 'A4 复印纸 70g（5 包）', category: '办公用品', status: '已上架', price: 139, stock: 260, owner: '林晓', remark: '常备办公耗材' },
  { id: 8, code: 'SP-2026-008', name: '0.5mm 中性笔（12 支）', category: '办公用品', status: '已上架', price: 28.5, stock: 480, owner: '周宁', remark: '黑色笔芯' },
  { id: 9, code: 'SP-2026-009', name: '三层文件收纳架', category: '办公用品', status: '已上架', price: 79, stock: 64, owner: '王可', remark: '桌面收纳' },
  { id: 10, code: 'SP-2026-010', name: '人体工学办公椅', category: '办公用品', status: '已上架', price: 1299, stock: 12, owner: '赵洋', remark: '库存预警' },
  { id: 11, code: 'SP-2026-011', name: '可升降办公桌 1.4 米', category: '办公用品', status: '草稿', price: 2199, stock: 8, owner: '陈雨', remark: '待确认运费方案' },
  { id: 12, code: 'SP-2026-012', name: '白板 90×120cm', category: '办公用品', status: '已下架', price: 399, stock: 5, owner: '苏禾', remark: '暂停销售' },
  { id: 13, code: 'SP-2026-013', name: '硒鼓 CF280A', category: '耗材配件', status: '已上架', price: 429, stock: 33, owner: '林晓', remark: '适配激光打印机' },
  { id: 14, code: 'SP-2026-014', name: '墨盒 T6721 黑色', category: '耗材配件', status: '已上架', price: 69, stock: 76, owner: '周宁', remark: '原装耗材' },
  { id: 15, code: 'SP-2026-015', name: '标签打印纸 50×30mm', category: '耗材配件', status: '已上架', price: 35.8, stock: 150, owner: '王可', remark: '单卷 800 张' },
  { id: 16, code: 'SP-2026-016', name: '网线 CAT6 2 米', category: '耗材配件', status: '已上架', price: 19.9, stock: 210, owner: '赵洋', remark: '千兆屏蔽' },
  { id: 17, code: 'SP-2026-017', name: '电源适配器 65W', category: '耗材配件', status: '已下架', price: 159, stock: 0, owner: '陈雨', remark: '待更新安规认证' },
  { id: 18, code: 'SP-2026-018', name: '桌面理线器套装', category: '耗材配件', status: '草稿', price: 45, stock: 90, owner: '苏禾', remark: '待拍摄主图' },
  { id: 19, code: 'SP-2026-019', name: '4K 网络摄像头', category: '电子设备', status: '已上架', price: 599, stock: 27, owner: '林晓', remark: '自动对焦' },
  { id: 20, code: 'SP-2026-020', name: '会议全向麦克风', category: '电子设备', status: '已上架', price: 1599, stock: 9, owner: '周宁', remark: '库存偏低' },
  { id: 21, code: 'SP-2026-021', name: '翻页笔 激光版', category: '电子设备', status: '已下架', price: 129, stock: 31, owner: '王可', remark: '旧款清仓' },
  { id: 22, code: 'SP-2026-022', name: '桌面计算器 12 位', category: '办公用品', status: '已上架', price: 59, stock: 88, owner: '赵洋', remark: '太阳能双电源' },
  { id: 23, code: 'SP-2026-023', name: '订书机 重型', category: '办公用品', status: '草稿', price: 89, stock: 26, owner: '陈雨', remark: '待补充包装信息' },
  { id: 24, code: 'SP-2026-024', name: '热敏收银纸 80mm', category: '耗材配件', status: '已上架', price: 12.5, stock: 320, owner: '苏禾', remark: '单箱 50 卷' }
])
// 演示数据：无真实后端接口，接入时替换为查询/保存接口。
let nextId = 25

const columns = [
  { prop: 'code', label: '商品编码', minWidth: 130, scope: 'code' },
  { prop: 'name', label: '商品名称', minWidth: 200, scope: 'name' },
  { prop: 'category', label: '商品分类', width: 110 },
  { prop: 'status', label: '上架状态', width: 100, scope: 'status' },
  { prop: 'price', label: '销售单价（元）', width: 120, scope: 'price' },
  { prop: 'stock', label: '库存数量', width: 100, scope: 'stock' },
  { prop: 'action', label: '操作', width: 110, scope: 'action', fixed: 'right' }
]

const query = ref({ name: '', status: '' })
const appliedQuery = ref({ name: '', status: '' })
const queryExpanded = ref(bindings.value.queryPanel.defaultExpanded)
const currentPage = ref(1)
const pageSize = ref(20)
const selections = ref([])
const tableKey = ref(0)
const deleting = ref(false)
const formVisible = ref(false)
const editingRecord = ref(null)

const filteredRows = computed(() => {
  const name = appliedQuery.value.name
  const status = appliedQuery.value.status
  return rows.value.filter(row =>
    (!name || row.name.includes(name)) && (!status || row.status === status))
})
const pagedRows = computed(() =>
  filteredRows.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value))

const onShelfCount = computed(() => rows.value.filter(row => row.status === '已上架').length)
const offShelfCount = computed(() => rows.value.filter(row => row.status === '已下架').length)
const draftCount = computed(() => rows.value.filter(row => row.status === '草稿').length)
const lowStockCount = computed(() => rows.value.filter(row => Number(row.stock) < 20).length)

const rowActions = computed(() => [
  { key: 'edit', label: '编辑', disabled: deleting.value },
  { key: 'delete', label: '删除', disabled: deleting.value }
])

const STATUS_CLASS = { 已上架: 'status-success', 已下架: 'status-neutral', 草稿: 'status-warning' }
const statusClass = status => STATUS_CLASS[status] || 'status-neutral'
const formatPrice = value =>
  value === null || value === undefined || value === '' ? '--' : Number(value).toFixed(2)
const isLowStock = row => Number(row.stock) < 20

watch([currentPage, pageSize], () => clearSelection())

function handleSelectionChange(selectedRows) {
  selections.value = Array.isArray(selectedRows) ? selectedRows : []
}

function applySearch() {
  appliedQuery.value = {
    name: (query.value.name || '').trim(),
    status: query.value.status || ''
  }
  currentPage.value = 1
  clearSelection()
}

function resetQuery() {
  query.value = { name: '', status: '' }
  applySearch()
}

function handleSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
}

function clearSelection() {
  selections.value = []
  tableKey.value += 1
}

function openCreate() {
  editingRecord.value = null
  formVisible.value = true
}

function openEdit(row) {
  editingRecord.value = { ...row }
  formVisible.value = true
}

function handleRowAction(key, row) {
  if (key === 'edit') return openEdit(row)
  if (key === 'delete') return removeRow(row)
}

async function removeRow(row) {
  if (deleting.value) return
  try {
    await ElMessageBox.confirm(`确定删除商品“${row.name}”吗？删除后不可恢复。`, '删除确认', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'
    })
  } catch {
    return
  }
  deleting.value = true
  try {
    rows.value = rows.value.filter(item => item.id !== row.id)
    currentPage.value = Math.min(
      currentPage.value,
      Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value))
    )
    clearSelection()
    ElMessage.success('商品已删除')
  } finally {
    deleting.value = false
  }
}

async function batchDelete() {
  if (deleting.value || !selections.value.length) return
  const count = selections.value.length
  try {
    await ElMessageBox.confirm(`此操作将删除选中的 ${count} 个商品，是否继续？`, '批量删除', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'
    })
  } catch {
    return
  }
  const ids = new Set(selections.value.map(row => row.id))
  deleting.value = true
  try {
    rows.value = rows.value.filter(row => !ids.has(row.id))
    currentPage.value = Math.min(
      currentPage.value,
      Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value))
    )
    clearSelection()
    ElMessage.success(`已删除 ${count} 个商品`)
  } finally {
    deleting.value = false
  }
}

function handleSaved(saved) {
  const index = rows.value.findIndex(row => row.id === saved.id)
  if (index >= 0) {
    rows.value.splice(index, 1, saved)
  } else {
    rows.value.unshift({ ...saved, id: nextId++ })
    // 新增后回到未筛选的第一页，避免新记录被当前筛选隐藏。
    resetQuery()
  }
  clearSelection()
  ElMessage.success('商品已保存')
}
</script>

<style scoped>
.ops-ledger-heading { margin-bottom: 16px; }
.ops-ledger-layout { display: grid; grid-template-columns: 278px minmax(0, 1fr); gap: 18px; align-items: start; }
.ops-ledger-sidebar { position: sticky; top: 12px; display: grid; gap: 14px; }
.ledger-summary, .ledger-attention { padding: 18px; border: 1px solid var(--template-border); border-radius: var(--template-radius); background: var(--template-surface); box-shadow: var(--template-shadow); }
.ledger-section-index { display: block; margin-bottom: 14px; color: var(--template-primary); font-size: 10px; font-weight: 800; letter-spacing: .1em; }
.ledger-summary { display: grid; grid-template-columns: 1fr 1fr; }
.ledger-summary > .ledger-section-index { grid-column: 1 / -1; }
.ledger-summary div { padding: 11px 0; border-top: 1px solid var(--template-border-light); }
.ledger-summary strong, .ledger-summary span { display: block; }
.ledger-summary strong { color: var(--template-heading); font: 700 25px Georgia, serif; }
.ledger-summary div span { margin-top: 4px; color: var(--template-text-soft); font-size: 11px; }
.ledger-attention { border-left: 3px solid var(--template-warning); background: var(--template-warning-soft); }
.ledger-attention p { margin: 8px 0; color: var(--template-text-soft); font-size: 11px; }
.ledger-attention b { color: var(--template-warning); font-size: 15px; }
.ops-ledger-main { min-width: 0; display: grid; gap: 14px; }
.ledger-query { margin-bottom: 0; border-color: var(--template-border); border-radius: var(--template-radius); background: var(--template-surface); }
.ops-ledger-table { min-width: 0; margin: 0; padding: 0 18px 16px; }
.ledger-table-title { margin: 0 -18px 14px; padding: 18px; display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 1px solid var(--template-border); }
.ledger-table-title .ledger-section-index { margin-bottom: 4px; }
.ledger-table-title h2 { margin: 0; color: var(--template-heading); font: 650 21px Georgia, "Songti SC", serif; }
.ledger-update { display: flex; align-items: center; gap: 10px; }
.ledger-update small { color: var(--template-text-soft); }
.ledger-scope { color: var(--template-text-soft); }
.goods-code { color: var(--template-text-soft); font-family: "JetBrains Mono", Consolas, monospace; font-size: 12px; }
.goods-name { color: var(--template-heading); font-size: 12px; font-weight: 650; }
.goods-price { color: var(--template-heading); font-variant-numeric: tabular-nums; }
.goods-stock { font-variant-numeric: tabular-nums; }
.goods-stock.is-low { color: var(--template-warning); font-weight: 700; }
@media (max-width: 960px) {
  .ops-ledger-layout { grid-template-columns: 1fr; }
  .ops-ledger-sidebar { position: static; grid-template-columns: 1fr 1fr; }
  .ledger-attention { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  .ops-ledger-sidebar { grid-template-columns: 1fr; }
  .ledger-attention { grid-column: auto; }
  .ledger-table-title { align-items: flex-start; flex-direction: column; gap: 8px; }
}
</style>
