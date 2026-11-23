<template>
  <div class="optimized-suite application-type-enterprise-platform afcenter-template visual-style-host visual-style-platform-blue">
    <div class="af-page">
      <header class="af-page-header">
        <div>
          <h1>组织与人员</h1>
          <p>维护组织机构、用户账号、岗位与角色关联</p>
        </div>
        <div class="af-actions">
          <el-button :icon="Upload" @click="importAccounts">批量导入</el-button>
          <el-button type="primary" :icon="Plus" @click="openEditor()">新建账号</el-button>
        </div>
      </header>

      <div class="af-split">
        <aside class="af-panel af-tree-panel">
          <h2 class="af-panel-title">组织机构</h2>
          <pm-input
            size="default"
            v-model="treeKeyword"
            class="af-tree-search"
            clearable
            placeholder="搜索机构"
          />
          <div class="af-tree-body">
            <TreePanel :searchable="false" structure="tree">
              <pm-tree
                v-model="currentOrg"
                :data="filteredOrgTree"
                :props="treeProps"
                :default-expanded-keys="['all', 'platform']"
                :editable="false"
                :removable="false"
                :searchable="false"
                default-expand-all
                highlight-current
                @node-click="selectOrg"
              />
            </TreePanel>
          </div>
        </aside>

        <section class="af-panel af-table-panel" :data-density="bindings.list.density">
          <div class="af-table-head">
            <div>
              <strong>{{ currentOrg?.label }}</strong>
              <span class="af-table-count">{{ filteredUsers.length }} 个账号</span>
            </div>
            <div class="af-toolbar">
              <pm-input
                size="default"
                v-model="codeKeyword"
                clearable
                placeholder="登录账号"
                style="width: 150px"
              />
              <pm-input
                size="default"
                v-model="employeeKeyword"
                clearable
                placeholder="所属员工"
                style="width: 150px"
              />
              <pm-select
                size="default"
                v-model="status"
                :options="statusOptions"
                clearable
                placeholder="全部状态"
                style="width: 130px"
              />
            </div>
          </div>

          <div v-if="selectedRows.length" class="af-batch-actions batch-actions">
            <span>已选中 {{ selectedRows.length }} 个账号</span>
            <el-button type="primary" plain size="small" @click="assignRoles">批量分配角色</el-button>
            <el-button link size="small" @click="clearSelection">取消选择</el-button>
          </div>

          <pm-table
            ref="tableRef"
            v-auto-height
            :table-data="pagedUsers"
            :columns="columns"
            checked
            show-index
            @changrows="onSelectionChange"
          >
            <template #status="{ row }">
              <span class="af-status" :class="row.status === '启用' ? 'success' : 'neutral'">{{ row.status }}</span>
            </template>
            <template #lock="{ row }">
              <span class="af-status" :class="row.locked ? 'danger' : 'success'">
                {{ row.locked ? '已锁定' : '未锁定' }}
              </span>
            </template>
            <template #action="{ row }">
              <RowActions
                :row="row"
                :actions="rowActions(row)"
                :mode="bindings.rowActions.mode"
                @action="handleRowAction"
              />
            </template>
          </pm-table>

          <div class="af-table-footer">
            <span>已选账号可批量分配角色</span>
            <ThreePartPagination
              :total="filteredUsers.length"
              :current-page="currentPage"
              :page-size="pageSize"
              :page-sizes="bindings.pagination.pageSizes"
              @update:current-page="currentPage = $event"
              @update:page-size="pageSize = $event"
            />
          </div>
        </section>
      </div>

      <pm-form-dialog
        v-model:dialog-visible="editorVisible"
        :title="editingId ? '编辑账号' : '新建账号'"
        width="560px"
        @submit="save"
      >
        <template #form>
          <el-form ref="formRef" :model="editor" :rules="rules" :label-position="bindings.form.labelPosition">
            <FormSection title="基本信息" :columns="bindings.formPage.columns">
              <el-form-item label="登录账号" prop="code">
                <pm-input size="default" v-model="editor.code" :disabled="Boolean(editingId)" />
              </el-form-item>
              <el-form-item label="所属员工" prop="name">
                <pm-input size="default" v-model="editor.name" />
              </el-form-item>
              <el-form-item label="所属机构" prop="orgId">
                <pm-select size="default" v-model="editor.orgId" :options="orgOptions" />
              </el-form-item>
              <el-form-item label="岗位" prop="position">
                <pm-select size="default" v-model="editor.position" :options="positionOptions" />
              </el-form-item>
            </FormSection>
            <FormSection title="角色与状态" :columns="bindings.formPage.columns">
              <el-form-item label="角色" prop="roles">
                <pm-select size="default" v-model="editor.roles" :options="roleOptions" multiple />
              </el-form-item>
              <el-form-item label="启用账号">
                <pm-switch
                  size="default"
                  :model-value="String(editor.enabled)"
                  @update:model-value="editor.enabled = String($event) === 'true'"
                />
              </el-form-item>
              <el-form-item label="锁定状态">
                <span class="af-status" :class="editor.locked ? 'danger' : 'success'">
                  {{ editor.locked ? '已锁定' : '未锁定' }}
                </span>
              </el-form-item>
            </FormSection>
          </el-form>
        </template>
      </pm-form-dialog>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Upload } from '@element-plus/icons-vue'
import {
  FormSection,
  RowActions,
  ThreePartPagination,
  TreePanel,
  resolvePagePreferences,
} from '@/components/PageTemplates'
import GlobalPreference from '@/preferences/GlobalPreference'
// 蓝图结构与 platform-blue 风格随页面加载，保证作为 MF remote 被宿主直接消费时样式可用。
import '@/styles/structure.css'
import '@/styles/shared.css'
import '@/styles/style.css'

/**
 * 组织与人员（MOD-001 / org-list + org-form）。
 * 结构来自蓝图 pages/OrganizationUsers.vue；数据为占位演示数据。
 * TODO(接口): 接入机构树、账号列表、账号保存、批量导入、批量分配角色接口后替换演示数据。
 */

const treeProps = {
  id: 'id',
  label: 'label',
  children: 'children',
  isLeaf: 'isLeaf',
}

const orgTree = [
  {
    id: 'all',
    label: '普元信息技术',
    children: [
      {
        id: 'platform',
        label: '数字化平台部',
        children: [
          { id: 'frontend', label: '前端研发组' },
          { id: 'backend', label: '后端研发组' },
        ],
      },
      { id: 'business', label: '业务运营部' },
      { id: 'data', label: '数据管理部' },
    ],
  },
]

const currentOrg = ref(orgTree[0])
const treeKeyword = ref('')

const filteredOrgTree = computed(() => {
  const term = treeKeyword.value.trim()
  if (!term) return orgTree
  const filter = nodes =>
    nodes
      .map(node => ({
        ...node,
        children: node.children ? filter(node.children) : undefined,
      }))
      .filter(node => node.label.includes(term) || node.children?.length)
  return filter(orgTree)
})

const selectOrg = node => {
  currentOrg.value = node
}

const collectOrgIds = (node, out = []) => {
  out.push(node.id)
  ;(node.children || []).forEach(child => collectOrgIds(child, out))
  return out
}

const currentOrgIds = computed(() => collectOrgIds(currentOrg.value || orgTree[0]))

const flattenOrg = (nodes, out = []) => {
  nodes.forEach(node => {
    out.push({ label: node.label, value: node.id })
    if (node.children) flattenOrg(node.children, out)
  })
  return out
}

const orgOptions = flattenOrg(orgTree)
const orgLabelById = new Map(orgOptions.map(item => [item.value, item.label]))

const options = values => values.map(value => ({ label: value, value }))
const positionOptions = options(['产品经理', '开发工程师', '前端工程师', '后端工程师', '数据工程师', '数据分析师', '运营专员', '运营主管', '项目经理'])
const roleOptions = options(['应用管理员', '数据管理员', '平台开发者', '普通用户'])
const statusOptions = options(['启用', '禁用'])

// TODO(接口): 占位演示数据；接入账号查询接口后替换。
const users = ref([
  { id: 1, code: 'zhou.ning', name: '周宁', orgId: 'platform', org: '数字化平台部', position: '产品经理', roles: '应用管理员', status: '启用', locked: false, lastLogin: '今天 10:24' },
  { id: 2, code: 'lin.chuan', name: '林川', orgId: 'data', org: '数据管理部', position: '数据工程师', roles: '数据管理员', status: '启用', locked: false, lastLogin: '今天 09:51' },
  { id: 3, code: 'chen.xu', name: '陈序', orgId: 'platform', org: '数字化平台部', position: '开发工程师', roles: '平台开发者', status: '启用', locked: false, lastLogin: '昨天 18:32' },
  { id: 4, code: 'xu.an', name: '许安', orgId: 'business', org: '业务运营部', position: '运营专员', roles: '普通用户', status: '禁用', locked: true, lastLogin: '7 天前' },
  { id: 5, code: 'wang.yi', name: '王一', orgId: 'frontend', org: '前端研发组', position: '前端工程师', roles: '平台开发者', status: '启用', locked: false, lastLogin: '今天 09:12' },
  { id: 6, code: 'li.na', name: '李娜', orgId: 'backend', org: '后端研发组', position: '后端工程师', roles: '平台开发者', status: '启用', locked: false, lastLogin: '昨天 20:05' },
  { id: 7, code: 'zhao.min', name: '赵敏', orgId: 'business', org: '业务运营部', position: '运营主管', roles: '应用管理员', status: '启用', locked: false, lastLogin: '昨天 16:41' },
  { id: 8, code: 'sun.hao', name: '孙浩', orgId: 'frontend', org: '前端研发组', position: '前端工程师', roles: '普通用户', status: '禁用', locked: false, lastLogin: '3 天前' },
  { id: 9, code: 'qian.duo', name: '钱多', orgId: 'data', org: '数据管理部', position: '数据分析师', roles: '数据管理员', status: '启用', locked: true, lastLogin: '今天 08:30' },
  { id: 10, code: 'wu.yue', name: '吴越', orgId: 'backend', org: '后端研发组', position: '后端工程师', roles: '普通用户', status: '启用', locked: false, lastLogin: '昨天 11:18' },
  { id: 11, code: 'zheng.nan', name: '郑楠', orgId: 'platform', org: '数字化平台部', position: '项目经理', roles: '应用管理员', status: '启用', locked: false, lastLogin: '今天 11:02' },
  { id: 12, code: 'feng.qi', name: '冯琪', orgId: 'business', org: '业务运营部', position: '运营专员', roles: '普通用户', status: '启用', locked: false, lastLogin: '2 天前' },
])

const codeKeyword = ref('')
const employeeKeyword = ref('')
const status = ref('')

const filteredUsers = computed(() => {
  const codeTerm = codeKeyword.value.trim().toLowerCase()
  const employeeTerm = employeeKeyword.value.trim()
  return users.value.filter(row => {
    if (!currentOrgIds.value.includes(row.orgId)) return false
    if (codeTerm && !row.code.toLowerCase().includes(codeTerm)) return false
    if (employeeTerm && !row.name.includes(employeeTerm)) return false
    if (status.value && row.status !== status.value) return false
    return true
  })
})

const pageSize = ref(10)
const currentPage = ref(1)

const pagedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredUsers.value.slice(start, start + pageSize.value)
})

const selectedRows = ref([])
const tableRef = ref()

const onSelectionChange = payload => {
  if (Array.isArray(payload)) selectedRows.value = payload
  else if (Array.isArray(payload?.rows)) selectedRows.value = payload.rows
  else selectedRows.value = []
}

const clearSelection = () => {
  const table = tableRef.value
  if (table?.clearSelection) table.clearSelection()
  else if (table?.toggleSelection) selectedRows.value.forEach(row => table.toggleSelection(row))
  selectedRows.value = []
}

watch([codeKeyword, employeeKeyword, status, currentOrg], () => {
  currentPage.value = 1
})

watch(filteredUsers, rows => {
  const maxPage = Math.max(1, Math.ceil(rows.length / pageSize.value))
  if (currentPage.value > maxPage) currentPage.value = maxPage
})

watch([codeKeyword, employeeKeyword, status, currentOrg, currentPage, pageSize], () => {
  clearSelection()
})

const columns = [
  { prop: 'code', label: '登录账号', minWidth: 130 },
  { prop: 'name', label: '所属员工', width: 100 },
  { prop: 'org', label: '所属机构', minWidth: 140 },
  { prop: 'position', label: '岗位', width: 110 },
  { prop: 'roles', label: '角色', width: 120 },
  { prop: 'status', label: '状态', width: 90, scope: 'status' },
  { prop: 'lock', label: '锁定状态', width: 100, scope: 'lock' },
  { prop: 'lastLogin', label: '最近登录', width: 120 },
  { prop: 'action', label: '操作', width: 150, scope: 'action' },
]

const rowActions = row => [
  { key: 'edit', label: '编辑' },
  { key: row.status === '启用' ? 'disable' : 'enable', label: row.status === '启用' ? '禁用' : '启用' },
]

const handleRowAction = (key, row) => {
  if (key === 'edit') openEditor(row)
  else toggle(row)
}

const toggle = row => {
  row.status = row.status === '启用' ? '禁用' : '启用'
  ElMessage.success('账号状态已更新')
}

// 占位动作：设计说明中“批量导入/批量分配角色”交互与来源待确认，先保留入口不伪造流程。
const importAccounts = () => {
  ElMessage.info('批量导入：待接入导入模板与校验接口（TODO）')
}

const assignRoles = () => {
  if (!selectedRows.value.length) return
  ElMessage.info(`已选中 ${selectedRows.value.length} 个账号；角色清单待接入权限模块（TODO）`)
}

const editorVisible = ref(false)
const editingId = ref(null)
const formRef = ref()
const editor = reactive({
  code: '',
  name: '',
  orgId: 'platform',
  position: '开发工程师',
  roles: [],
  enabled: true,
  locked: false,
})

const rules = {
  code: [{ required: true, message: '请填写登录账号', trigger: 'blur' }],
  name: [{ required: true, message: '请填写所属员工', trigger: 'blur' }],
}

const openEditor = row => {
  editingId.value = row?.id ?? null
  Object.assign(
    editor,
    row
      ? {
          code: row.code,
          name: row.name,
          orgId: row.orgId,
          position: row.position,
          roles: row.roles ? row.roles.split('、') : [],
          enabled: row.status === '启用',
          locked: Boolean(row.locked),
        }
      : {
          code: '',
          name: '',
          orgId: !currentOrg.value || currentOrg.value.id === 'all' ? 'platform' : currentOrg.value.id,
          position: '开发工程师',
          roles: [],
          enabled: true,
          locked: false,
        }
  )
  editorVisible.value = true
  nextTick(() => formRef.value?.clearValidate?.())
}

const save = async () => {
  try {
    await formRef.value?.validate?.()
  } catch {
    return
  }
  if (!editor.code.trim() || !editor.name.trim()) {
    ElMessage.warning('请填写登录账号和所属员工')
    return
  }
  const payload = {
    code: editor.code.trim(),
    name: editor.name.trim(),
    orgId: editor.orgId,
    org: orgLabelById.get(editor.orgId) || '',
    position: editor.position,
    roles: editor.roles.join('、'),
    status: editor.enabled ? '启用' : '禁用',
  }
  const target = users.value.find(row => row.id === editingId.value)
  if (target) Object.assign(target, payload)
  else users.value.push({ ...payload, id: Date.now(), locked: false, lastLogin: '尚未登录' })
  editorVisible.value = false
  ElMessage.success('账号已保存')
}

// 设计契约优先：dialog-form 双列 560px、three-part 分页；仅在本页 computed 合并，不改全局单例。
const effectivePreference = computed(() => ({
  ...GlobalPreference,
  templates: {
    ...GlobalPreference.templates,
    list: { ...GlobalPreference.templates.list, paginationLayout: 'three-part' },
    form: { ...GlobalPreference.templates.form, columns: 2 },
  },
}))

const bindings = computed(() => resolvePagePreferences(effectivePreference.value))
</script>

<style scoped>
.af-tree-panel {
  display: flex;
  flex-direction: column;
  min-height: 500px;
}
.af-tree-body {
  flex: 1;
  min-height: 0;
}
.af-table-panel {
  display: flex;
  flex-direction: column;
  min-height: 500px;
}
.af-table-count {
  margin-left: 9px;
  color: var(--af-text-secondary);
  font-size: 11px;
}
.af-batch-actions {
  margin-bottom: 10px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--af-border-light);
  border-radius: 8px;
  background: var(--af-primary-soft);
  color: var(--af-text-secondary);
  font-size: 12px;
}
.af-batch-actions > span {
  color: var(--af-primary);
  font-weight: 600;
}
.af-table-footer > span {
  flex: none;
  white-space: nowrap;
}
.af-table-footer :deep(.pt-three-pagination) {
  flex: 1;
  min-width: 0;
}
</style>
