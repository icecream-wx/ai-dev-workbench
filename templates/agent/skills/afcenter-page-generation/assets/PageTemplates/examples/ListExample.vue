<template>
  <QueryPanel v-if="bindings.queryPanel.mode === 'card'" :model="query"
    :layout="bindings.queryPanel.layout" :default-expanded="bindings.queryPanel.defaultExpanded" @search="search" @reset="reset"
    @toggle="queryExpanded = $event">
    <el-form-item label="编号" prop="code">
      <el-input v-bind="bindings.text" v-model="query.code" clearable placeholder="请输入编号" />
    </el-form-item>
    <el-form-item label="名称" prop="name">
      <el-input v-bind="bindings.text" v-model="query.name" clearable placeholder="请输入名称" />
    </el-form-item>
    <el-form-item label="描述" prop="description">
      <el-input v-bind="bindings.text" v-model="query.description" clearable placeholder="请输入描述关键词" />
    </el-form-item>
  </QueryPanel>
  <BusinessListPage v-bind="bindings.list" title="模板示例记录（内存数据）" entity-name="示例记录"
    :selection-count="selections.length" :deleting="deleting" :create-disabled="deleting"
    @create="openForm(null)" @batch-delete="batchDelete" @clear-selection="clearSelection">
    <template v-if="bindings.queryPanel.mode === 'inline'" #filters>
      <PmSearch class="al-search" v-model:query="query" default-prop="name" placeholder="搜索名称" @search="search">
        <template #body>
          <el-form-item label="编号" prop="code">
            <el-input v-bind="bindings.text" v-model="query.code" clearable />
          </el-form-item>
          <el-form-item label="名称" prop="name">
            <el-input v-bind="bindings.text" v-model="query.name" clearable />
          </el-form-item>
        </template>
      </PmSearch>
    </template>
    <el-table ref="tableRef" v-bind="bindings.table" v-auto-height :data="pageRows" row-key="id"
      :data-query-expanded="queryExpanded"
      @selection-change="selections = $event">
      <el-table-column type="selection" width="55" />
      <el-table-column prop="code" label="编号">
        <template #default="{ row }">
          <el-link type="primary" :disabled="deleting" @click="openForm(row)">{{ row.code }}</el-link>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="description" label="描述" show-overflow-tooltip />
      <el-table-column label="操作" width="210">
        <template #default="{ row }">
          <RowActions v-bind="bindings.rowActions" :actions="rowActions" :row="row" @action="handleRowAction" />
        </template>
      </el-table-column>
    </el-table>
    <template #pagination>
      <ThreePartPagination v-if="bindings.list.paginationLayout === 'three-part'" v-bind="bindings.pagination"
        v-model:current-page="page" :page-size="pageSize" :total="filteredRows.length" @size-change="changeSize" />
      <Pagination v-else v-bind="bindings.pagination" :selections="footerSelections" v-model:current-page="page" :page-size="pageSize"
        :total="filteredRows.length" @current-change="page = $event" @size-change="changeSize" />
    </template>
  </BusinessListPage>
  <pm-form-dialog v-model:dialog-visible="dialogVisible" :title="formTitle"
    :loading="saving" :width="formDialogWidth" top="60px"
    :show-footer="!isView" @submit="formRef?.submit()">
    <template #form>
      <FormExample v-if="formMode" ref="formRef" :preference="preference" :data="selected"
        :disabled="isView" :save="saveRecord"
        @update:loading="saving = $event" @success="handleSaved" />
    </template>
  </pm-form-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElFormItem, ElInput, ElLink, ElMessage, ElMessageBox, ElTable, ElTableColumn } from 'element-plus'
import { Delete, DocumentCopy, View } from '@element-plus/icons-vue'
import { BusinessListPage, RowActions, ThreePartPagination, QueryPanel, resolvePagePreferences } from '../index.js'
import FormExample from './FormExample.vue'

const props = defineProps({ preference: { type: Object, default: () => ({}) } })
const bindings = computed(() => resolvePagePreferences(props.preference))
// 双列弹窗需避开表单的 640px 单列断点，窄屏时仍限制在视口内。
const formDialogWidth = computed(() =>
  `min(${bindings.value.formPage.columns === 2 ? 800 : 520}px, calc(100vw - 32px))`)
const rows = ref(Array.from({ length: 24 }, (_, index) => ({
  id: index + 1, code: `DEMO_${index + 1}`, name: `示例记录 ${index + 1}`, description: '仅用于模板交互演示'
})))
let nextId = 25
const query = ref({ code: '', name: '', description: '' })
const queryExpanded = ref(true)
const appliedQuery = ref({ code: '', name: '', description: '' })
const page = ref(1)
const pageSize = ref(bindings.value.pagination.pageSizes[0])
const formMode = ref('') // ''=关闭；create=新增；edit=编辑；view=查看（同一表单，禁用状态）
const saving = ref(false)
const formRef = ref(null)
const isView = computed(() => formMode.value === 'view')
const formTitle = computed(() => {
  if (formMode.value === 'create') return '新增示例记录'
  if (formMode.value === 'edit') return '编辑示例记录'
  if (formMode.value === 'view') return '查看示例记录'
  return ''
})
const dialogVisible = computed({
  get: () => formMode.value !== '',
  // 保存中锁定弹窗，防止关闭/切换造成重复提交。
  set: value => { if (!saving.value && !value) formMode.value = '' }
})
const selected = ref(null)
const tableRef = ref(null)
const selections = ref([])
const deleting = ref(false)
const rowActions = computed(() => [
  { key: 'delete', label: '删除', icon: Delete, disabled: deleting.value },
  { key: 'view', label: '查看', icon: View, disabled: deleting.value },
  { key: 'copy', label: '复制', icon: DocumentCopy, disabled: deleting.value }
])

function handleRowAction(key, row) {
  if (key === 'delete') return removeRow(row)
  // 查看与新增/编辑共用同一表单，仅组件禁用，不再用 ElMessageBox 展示文本详情。
  if (key === 'view') return openForm(row, 'view')
  if (key === 'copy') {
    rows.value.unshift({ ...row, id: nextId, code: `COPY_${nextId++}`, name: `${row.name}（副本）` })
    reset()
    ElMessage.success('已复制到内存列表')
  }
}
const filteredRows = computed(() => rows.value.filter(row =>
  row.name.includes(appliedQuery.value.name) && row.code.includes(appliedQuery.value.code) &&
  (bindings.value.queryPanel.mode !== 'card' || row.description.includes(appliedQuery.value.description))))
// bar 模式保持原行为：已选数量由底部分页展示；split 模式改由顶部操作栏展示，分页不重复。
const footerSelections = computed(() =>
  bindings.value.list.paginationLayout === 'bar' ? selections.value : [])
const pageRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

watch(pageRows, () => {
  selections.value = []
  tableRef.value?.clearSelection()
})

async function batchDelete() {
  if (deleting.value || selections.value.length === 0) return
  const ids = new Set(selections.value.map(row => row.id))
  await deleteRecords(ids, `此操作将删除选中的 ${ids.size} 条记录，是否继续？`)
}

function clearSelection() {
  selections.value = []
  tableRef.value?.clearSelection()
}

async function removeRow(row) {
  await deleteRecords(new Set([row.id]), `此操作将删除记录“${row.code}”，是否继续？`)
}

async function deleteRecords(ids, message) {
  if (deleting.value) return
  deleting.value = true
  try {
    await ElMessageBox.confirm(message, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    })
    rows.value = rows.value.filter(row => !ids.has(row.id))
    page.value = Math.min(page.value, Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value)))
    selections.value = []
    tableRef.value?.clearSelection()
    ElMessage.success('删除成功')
  } catch (reason) {
    if (reason !== 'cancel' && reason !== 'close') ElMessage.error('删除失败，请重试')
  } finally {
    deleting.value = false
  }
}

function search() {
  appliedQuery.value = {
    code: (query.value.code || '').trim(), name: (query.value.name || '').trim(),
    description: (query.value.description || '').trim()
  }
  page.value = 1
}
function reset() {
  query.value = { code: '', name: '', description: '' }
  search()
}
function changeSize(size) {
  pageSize.value = size
  page.value = 1
}
function openForm(row, mode) {
  selected.value = row ? { ...row } : null
  formMode.value = row ? (mode || 'edit') : 'create'
}
async function saveRecord(record) {
  if (rows.value.some(row => row.code === record.code && row.id !== record.id)) {
    throw new Error('编号已存在')
  }
  const saved = { ...record, id: record.id ?? nextId++ }
  const index = rows.value.findIndex(row => row.id === saved.id)
  if (index === -1) rows.value.unshift(saved)
  else rows.value.splice(index, 1, saved)
  return saved
}
function handleSaved() {
  formMode.value = ''
  reset()
}
</script>
<!-- Modified by AI on 2026-11-12 13:22:33 -->
