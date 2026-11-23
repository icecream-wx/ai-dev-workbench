<template>
  <TreeListPage :appearance="appearance" :preference="preference" :title="`${groupName}（内存数据）`"
    :show-create="false" :show-batch-delete="false" :selection-count="selections.length"
    @clear-selection="clearSelection">
    <template #tree>
      <TreePanel :preference="preference" title="分组导航" structure="flat"
        @search="filterTree" @create="createGroup">
        <template #default>
          <el-tree ref="treeRef" :data="groups" :props="{ label: 'name', children: 'children' }" node-key="id"
            :current-node-key="groupId" default-expand-all @node-click="selectGroup"
            :filter-node-method="filterNode" highlight-current :expand-on-click-node="false">
            <template #default="{ node, data: item }">
              <div class="pt-tree-panel-node custom-tree-node">
                  <span v-if="bindings.treePanel.selectionStyle === 'dot'" class="pt-tree-panel-dot" aria-hidden="true" />
                  <svg-icon v-else class="pt-tree-panel-icon svgicon" icon-class="group" />
                  <span class="pt-tree-panel-label" :title="node.label">{{ node.label }}</span>
                  <span v-if="item.count != null" class="pt-tree-panel-count">{{ item.count }}</span>
                <el-dropdown v-if="treeActions(item).length" trigger="click" placement="bottom-start"
                  class="pt-tree-panel-more" :class="{ 'is-open': openNode === node }"
                  @visible-change="openNode = $event ? node : (openNode === node ? null : openNode)"
                  @command="command => handleTreeAction(command, item)">
                  <button type="button" class="pt-tree-panel-trigger" :aria-label="`${node.label}的操作`"
                    @click.stop @keydown.stop>
                    <el-icon><MoreFilled /></el-icon>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item v-for="action in treeActions(item)" :key="action.key"
                        :command="action.key" :disabled="action.disabled" :divided="action.divided">
                        {{ action.label }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-tree>
        </template>
      </TreePanel>
    </template>
    <template v-if="bindings.queryPanel.mode === 'card'" #query>
      <QueryPanel :model="query" :layout="bindings.queryPanel.layout" :default-expanded="bindings.queryPanel.defaultExpanded"
        @search="search" @reset="reset" @toggle="queryExpanded = $event">
        <el-form-item label="名称" prop="name">
          <el-input v-model="query.name" v-bind="bindings.text" clearable />
        </el-form-item>
      </QueryPanel>
    </template>
    <template v-if="bindings.queryPanel.mode === 'inline'" #filters>
      <PmSearch v-model:query="query" class="al-search" default-prop="name"
        placeholder="搜索名称" @search="search">
        <template #body>
          <el-form-item label="名称" prop="name">
            <el-input v-model="query.name" v-bind="bindings.text" clearable />
          </el-form-item>
        </template>
      </PmSearch>
    </template>
    <el-table ref="tableRef" v-bind="bindings.table" v-auto-height :data="pageRows" row-key="id"
      :data-query-expanded="queryExpanded" @selection-change="selections = $event">
      <el-table-column type="selection" width="55" />
      <el-table-column prop="code" label="编号" min-width="140" />
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column prop="groupName" label="所属分组" min-width="120" />
    </el-table>
    <template #pagination>
      <ThreePartPagination v-if="bindings.list.paginationLayout === 'three-part'" v-bind="bindings.pagination"
        v-model:current-page="page" :page-size="pageSize" :total="filteredRows.length" @size-change="changeSize" />
      <Pagination v-else v-bind="bindings.pagination" v-model:current-page="page" :page-size="pageSize"
        :total="filteredRows.length" :selections="bindings.list.paginationLayout === 'bar' ? selections : []"
        @current-change="page = $event" @size-change="changeSize" />
    </template>
  </TreeListPage>
  <pm-form-dialog v-model:dialog-visible="groupDialogVisible" :title="editingGroup ? '编辑分组' : '新建分组'"
    width="min(520px, calc(100vw - 32px))" :loading="groupSaving" @submit="saveGroup">
    <template #form>
      <el-form v-if="groupDialogVisible" ref="groupFormRef" v-bind="bindings.form"
        :model="groupForm" :rules="groupRules" :disabled="groupSaving" @submit.prevent="saveGroup">
        <el-form-item label="分组名称" prop="name">
          <el-input v-model.trim="groupForm.name" v-bind="bindings.text" clearable placeholder="请输入分组名称" />
        </el-form-item>
      </el-form>
    </template>
  </pm-form-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { MoreFilled } from '@element-plus/icons-vue'
import { ElTree, ElDropdown, ElDropdownMenu, ElDropdownItem, ElIcon, ElForm, ElFormItem, ElInput, ElTable, ElTableColumn, ElMessage, ElMessageBox } from 'element-plus'
import { TreeListPage, TreePanel, QueryPanel, ThreePartPagination, resolvePagePreferences } from '../index.js'

const props = defineProps({
  preference: { type: Object, default: () => ({}) },
  appearance: { type: String, default: 'platform' }
})
// 节点直接读取响应式偏好，避免嵌套树插槽持有旧的外层作用域值。
const bindings = computed(() => resolvePagePreferences(props.preference))
const groups = ref([{ id: 'all', name: '全部分组', children: [
  { id: 'system', name: '系统分组' }, { id: 'app', name: '应用分组' }
] }])
const treeRef = ref(null)
const openNode = ref(null)
const treeKeyword = ref('')
// 树查询、节点菜单和数据操作直接在业务页面生成，不由外壳代管。
function filterNode(value, data, node) {
  return !value || String(node.label ?? '').includes(value)
}
function filterTree(value) {
  treeKeyword.value = value
  treeRef.value?.filter(value)
}
watch(groups, () => treeRef.value?.filter(treeKeyword.value), { deep: true, flush: 'post' })
const groupId = ref('all')
const groupName = ref('全部分组')
const tableRef = ref(null)
const selections = ref([])
const query = ref({ name: '' })
const appliedName = ref('')
const queryExpanded = ref(true)
const page = ref(1)
const pageSize = ref(bindings.value.pagination.pageSizes[0])
const rows = Array.from({ length: 36 }, (_, index) => ({
  id: index + 1, code: `DEMO_${index + 1}`, name: `示例记录 ${index + 1}`,
  groupId: index % 2 === 0 ? 'system' : 'app', groupName: index % 2 === 0 ? '系统分组' : '应用分组'
}))
const filteredRows = computed(() => rows.filter(row =>
  (groupId.value === 'all' || row.groupId === groupId.value) && row.name.includes(appliedName.value)))
const pageRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
watch(pageRows, clearSelection)

// “全部分组”为虚拟根节点，不提供编辑或删除操作。
function treeActions(data) {
  return data.id === 'all' ? [] : [
    { key: 'edit', label: '编辑' },
    { key: 'remove', label: '删除', disabled: rows.some(row => row.groupId === data.id) }
  ]
}
let nextGroupId = 1
const groupDialogOpen = ref(false)
const groupSaving = ref(false)
const groupFormRef = ref(null)
const editingGroup = ref(null)
const groupForm = ref({ name: '' })
const groupRules = { name: [{ required: true, whitespace: true, message: '请输入分组名称', trigger: 'blur' }] }
const groupDialogVisible = computed({
  get: () => groupDialogOpen.value,
  set: value => { if (!groupSaving.value) groupDialogOpen.value = value }
})
// 新增与编辑共用平台弹窗，使用副本避免取消时修改树节点。
function openGroupForm(data = null) {
  editingGroup.value = data
  groupForm.value = { name: data?.name || '' }
  groupFormRef.value?.clearValidate()
  groupDialogOpen.value = true
}
function createGroup() {
  openGroupForm()
}
async function saveGroup() {
  if (groupSaving.value || !groupFormRef.value) return
  groupSaving.value = true
  try {
    const valid = await groupFormRef.value.validate().catch(() => false)
    if (!valid) return
    const name = groupForm.value.name.trim()
    if (editingGroup.value) {
      editingGroup.value.name = name
      if (groupId.value === editingGroup.value.id) groupName.value = name
    } else {
      groups.value[0].children.push({ id: `demo-group-${nextGroupId++}`, name })
    }
    groupDialogOpen.value = false
  } catch (reason) {
    ElMessage.error('保存失败，请重试')
  } finally {
    groupSaving.value = false
  }
}
async function handleTreeAction(key, data) {
  try {
    if (key === 'edit') {
      openGroupForm(data)
    } else if (key === 'remove') {
      if (rows.some(row => row.groupId === data.id)) return
      await ElMessageBox.confirm(`确定删除“${data.name}”？`, '提示', { type: 'warning' })
      groups.value[0].children = groups.value[0].children.filter(item => item.id !== data.id)
      if (groupId.value === data.id) selectGroup(groups.value[0])
    }
  } catch (reason) {
    if (reason !== 'cancel' && reason !== 'close') ElMessage.error('操作失败')
  }
}
function clearSelection() {
  selections.value = []
  tableRef.value?.clearSelection()
}
function selectGroup(data) {
  groupId.value = data.id
  groupName.value = data.name
  page.value = 1
  clearSelection()
}
function search() {
  appliedName.value = (query.value.name || '').trim()
  page.value = 1
  clearSelection()
}
function reset() {
  query.value = { name: '' }
  search()
}
function changeSize(size) {
  pageSize.value = size
  page.value = 1
}
</script>
<!-- Modified by AI on 2026-11-12 14:10:03 -->
