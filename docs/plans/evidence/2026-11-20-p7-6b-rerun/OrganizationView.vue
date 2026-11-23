<template>
  <div
    class="optimized-suite application-type-enterprise-platform afcenter-template visual-style-host visual-style-platform-blue"
  >
    <div class="af-page">
      <header class="af-page-header">
        <div>
          <h1>组织与人员</h1>
          <p>维护组织机构、员工档案、账号、岗位与角色关联</p>
        </div>
        <div class="af-actions">
          <el-button :icon="Upload" @click="importAccounts">批量导入</el-button>
          <el-button type="primary" :icon="Plus" @click="openEditor()">新建账号</el-button>
        </div>
      </header>
      <div class="af-split">
        <aside class="af-panel af-tree-panel">
          <h2 class="af-panel-title">组织机构</h2>
          <pm-input size="default" v-model="treeKeyword" class="af-tree-search" clearable placeholder="搜索机构" />
          <pm-tree
            v-model="currentOrg"
            :data="filteredOrgTree"
            :props="treeProps"
            :default-expanded-keys="['all', 'platform']"
            :editable="false"
            :removable="false"
            :searchable="false"
            :context-menu-enable="false"
            default-expand-all
            highlight-current
            @node-click="selectOrg"
          />
        </aside>
        <section class="af-panel af-list-panel">
          <div class="af-table-head">
            <div>
              <strong>{{ currentOrg.label }}</strong>
              <span class="af-table-count">{{ filteredUsers.length }} 个账号</span>
            </div>
            <div class="af-toolbar af-toolbar-filters">
              <pm-input
                size="default"
                v-model="filters.name"
                clearable
                placeholder="员工姓名"
                style="width: 130px"
              />
              <pm-input
                size="default"
                v-model="filters.employeeNo"
                clearable
                placeholder="工号"
                style="width: 120px"
              />
              <pm-select
                size="default"
                v-model="filters.employmentStatus"
                :options="employmentStatusOptions"
                clearable
                placeholder="在职状态"
                style="width: 120px"
              />
            </div>
          </div>
          <div v-if="selections.length" class="batch-actions">
            <span class="af-batch-count" role="status">已选中 {{ selections.length }} 个账号</span>
            <el-button size="small" @click="openRoleDialog">批量分配角色</el-button>
            <button type="button" class="af-link" @click="clearSelection">取消选择</button>
          </div>
          <!-- TODO: pm-table 为宿主 el-table 封装；v-auto-height 由宿主指令提供，需在 AFCenter 宿主环境验证高度 -->
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
              <RowActions :actions="rowActions(row)" :row="row" :mode="bindings.rowActions.mode" @action="handleRowAction" />
            </template>
          </pm-table>
          <div class="af-table-footer">
            <span>已选 {{ selections.length }} 个账号，可批量分配角色</span>
            <div class="af-pagination">
              <ThreePartPagination
                v-model:current-page="page"
                v-model:page-size="pageSize"
                :page-sizes="bindings.pagination.pageSizes"
                :total="filteredUsers.length"
              />
            </div>
          </div>
        </section>
      </div>

      <pm-form-dialog
        v-model:dialog-visible="editorVisible"
        :title="editingId ? '编辑账号' : '新建账号'"
        width="560px"
        :loading="saving"
        @submit="save"
        @cancel="editorVisible = false"
      >
        <template #form>
          <el-form
            v-if="editorVisible"
            ref="formRef"
            v-bind="bindings.form"
            :model="editor"
            :rules="rules"
            :disabled="saving"
            @submit.prevent="save"
          >
            <FormSection title="账号信息" :columns="2">
              <el-form-item label="登录账号" prop="code">
                <pm-input size="default" v-model="editor.code" :disabled="Boolean(editingId)" placeholder="请输入登录账号" />
              </el-form-item>
              <el-form-item label="员工姓名" prop="name">
                <pm-input size="default" v-model="editor.name" placeholder="请输入员工姓名" />
              </el-form-item>
              <el-form-item label="角色" prop="roles">
                <pm-select size="default" v-model="editor.roles" :options="roleOptions" multiple placeholder="请选择角色" />
              </el-form-item>
            </FormSection>
            <FormSection title="归属信息" :columns="2">
              <el-form-item label="所属机构" prop="org">
                <pm-select size="default" v-model="editor.org" :options="orgOptions" placeholder="请选择所属机构" />
              </el-form-item>
              <el-form-item label="岗位" prop="position">
                <pm-select size="default" v-model="editor.position" :options="positionOptions" placeholder="请选择岗位" />
              </el-form-item>
            </FormSection>
            <FormSection title="账号状态" :columns="2">
              <el-form-item label="启用账号">
                <pm-switch
                  size="default"
                  :model-value="String(editor.enabled)"
                  @update:model-value="editor.enabled = $event === true || $event === 'true'"
                />
              </el-form-item>
              <!-- 锁定只由安全策略触发，界面只读展示，不能手工解锁（需求 §4） -->
              <el-form-item label="锁定">
                <span class="af-status" :class="editor.locked ? 'danger' : 'success'">
                  {{ editor.locked ? '已锁定' : '未锁定' }}
                </span>
              </el-form-item>
            </FormSection>
          </el-form>
        </template>
      </pm-form-dialog>

      <pm-form-dialog
        v-model:dialog-visible="roleDialogVisible"
        title="批量分配角色"
        width="440px"
        :loading="roleSaving"
        @submit="saveBatchRoles"
        @cancel="roleDialogVisible = false"
      >
        <template #form>
          <el-form v-if="roleDialogVisible" v-bind="bindings.form" :model="roleForm" :disabled="roleSaving">
            <el-form-item label="角色">
              <pm-select size="default" v-model="roleForm.roles" :options="roleOptions" multiple placeholder="请选择角色" />
            </el-form-item>
            <p class="af-form-tip">
              所选角色将追加到已勾选的 {{ selections.length }} 个账号（演示逻辑，覆盖/追加口径待确认）。
            </p>
          </el-form>
        </template>
      </pm-form-dialog>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Upload } from '@element-plus/icons-vue'
import GlobalPreference from '@/preferences/GlobalPreference'
import { FormSection, RowActions, ThreePartPagination, resolvePagePreferences } from '@/components/PageTemplates'

// 统一读取应用级偏好；页面只在 computed 合并，不修改 GlobalPreference 单例。
const bindings = computed(() => resolvePagePreferences(GlobalPreference))

const treeProps = { id: 'id', label: 'label', children: 'children', isLeaf: 'isLeaf' }

// TODO: 演示数据，接口就绪后替换为组织树/账号列表查询（按机构过滤、分页）。
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
      .map(node => ({ ...node, children: node.children ? filter(node.children) : undefined }))
      .filter(node => node.label.includes(term) || node.children?.length)
  return filter(orgTree)
})
const selectOrg = node => {
  currentOrg.value = node
}
// 需求 §2：按机构名称搜索并定位到匹配节点（唯一命中时联动选中，右侧列表同步过滤）。
watch(treeKeyword, keyword => {
  const term = keyword.trim()
  if (!term) return
  const matched = []
  const collect = nodes =>
    nodes.forEach(node => {
      if (node.label.includes(term)) matched.push(node)
      if (node.children) collect(node.children)
    })
  collect(orgTree)
  if (matched.length === 1) currentOrg.value = matched[0]
})

const filters = reactive({ name: '', employeeNo: '', employmentStatus: '' })
const employmentStatusOptions = ['在职', '离职'].map(value => ({ label: value, value }))

// TODO: 演示数据，接口就绪后替换为账号分页查询结果。
const users = ref([
  {
    id: 1,
    code: 'zhou.ning',
    name: '周宁',
    employeeNo: 'EMP001',
    orgId: 'platform',
    org: '数字化平台部',
    position: '产品经理',
    roles: ['应用管理员'],
    status: '启用',
    locked: false,
    employmentStatus: '在职',
    lastLogin: '今天 10:24',
  },
  {
    id: 2,
    code: 'lin.chuan',
    name: '林川',
    employeeNo: 'EMP002',
    orgId: 'data',
    org: '数据管理部',
    position: '数据工程师',
    roles: ['数据管理员'],
    status: '启用',
    locked: false,
    employmentStatus: '在职',
    lastLogin: '今天 09:51',
  },
  {
    id: 3,
    code: 'chen.xu',
    name: '陈序',
    employeeNo: 'EMP003',
    orgId: 'frontend',
    org: '前端研发组',
    position: '开发工程师',
    roles: ['平台开发者'],
    status: '启用',
    locked: false,
    employmentStatus: '在职',
    lastLogin: '昨天 18:32',
  },
  {
    id: 4,
    code: 'xu.an',
    name: '许安',
    employeeNo: 'EMP004',
    orgId: 'business',
    org: '业务运营部',
    position: '运营专员',
    roles: ['普通用户'],
    status: '禁用',
    locked: true,
    employmentStatus: '离职',
    lastLogin: '7 天前',
  },
])

const filteredUsers = computed(() =>
  users.value.filter(
    row =>
      (currentOrg.value.id === 'all' || row.orgId === currentOrg.value.id) &&
      (!filters.name || row.name.includes(filters.name.trim())) &&
      (!filters.employeeNo || row.employeeNo.includes(filters.employeeNo.trim())) &&
      (!filters.employmentStatus || row.employmentStatus === filters.employmentStatus)
  )
)

const page = ref(1)
const pageSize = ref(10)
const pagedUsers = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredUsers.value.slice(start, start + pageSize.value)
})

const tableRef = ref(null)
const selections = ref([])
const onSelectionChange = rows => {
  selections.value = Array.isArray(rows) ? rows : []
}
function clearSelection() {
  const table = tableRef.value
  if (table?.getSelectRows && table?.toggleSelection) {
    table.getSelectRows().forEach(row => table.toggleSelection(row))
  }
  selections.value = []
}

watch(
  () => [currentOrg.value.id, filters.name, filters.employeeNo, filters.employmentStatus],
  () => {
    page.value = 1
    clearSelection()
  }
)
watch(page, clearSelection)

const columns = [
  { prop: 'code', label: '登录账号', minWidth: 130 },
  { prop: 'name', label: '所属员工', width: 100 },
  { prop: 'org', label: '所属机构', minWidth: 140 },
  { prop: 'position', label: '岗位', width: 110 },
  { prop: 'roles', label: '角色', minWidth: 140 },
  { prop: 'status', label: '状态', width: 90, scope: 'status' },
  { prop: 'lock', label: '锁定', width: 90, scope: 'lock' },
  { prop: 'lastLogin', label: '最近登录', width: 120 },
  { prop: 'action', label: '操作', width: 150, scope: 'action' },
]

const options = values => values.map(value => ({ label: value, value }))
const orgOptions = options(['数字化平台部', '业务运营部', '数据管理部', '前端研发组', '后端研发组'])
const orgIdByLabel = new Map()
const indexOrg = nodes =>
  nodes.forEach(node => {
    orgIdByLabel.set(node.label, node.id)
    if (node.children) indexOrg(node.children)
  })
indexOrg(orgTree)
const orgIdOf = label => orgIdByLabel.get(label) ?? ''
const positionOptions = options(['产品经理', '开发工程师', '数据工程师', '运营专员'])
const roleOptions = options(['应用管理员', '数据管理员', '平台开发者', '普通用户'])

const editingId = ref(null)
const editorVisible = ref(false)
const saving = ref(false)
const formRef = ref(null)
const editor = reactive({
  code: '',
  name: '',
  org: '数字化平台部',
  position: '开发工程师',
  roles: [],
  enabled: true,
  locked: false,
})
const rules = {
  code: [{ required: true, whitespace: true, message: '请输入登录账号', trigger: 'blur' }],
  name: [{ required: true, whitespace: true, message: '请输入员工姓名', trigger: 'blur' }],
}

const openEditor = row => {
  editingId.value = row?.id || null
  Object.assign(
    editor,
    row
      ? {
          code: row.code,
          name: row.name,
          org: row.org,
          position: row.position,
          roles: [...row.roles],
          enabled: row.status === '启用',
          locked: row.locked,
        }
      : {
          code: '',
          name: '',
          org: currentOrg.value.id === 'all' ? '数字化平台部' : currentOrg.value.label,
          position: '开发工程师',
          roles: [],
          enabled: true,
          locked: false,
        }
  )
  editorVisible.value = true
}

async function save() {
  if (saving.value || !formRef.value) return
  saving.value = true
  try {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    const current = users.value.find(row => row.id === editingId.value)
    const value = {
      code: editor.code.trim(),
      name: editor.name.trim(),
      employeeNo: current?.employeeNo ?? '',
      orgId: orgIdOf(editor.org) || current?.orgId || '',
      org: editor.org,
      position: editor.position,
      roles: [...editor.roles],
      status: editor.enabled ? '启用' : '禁用',
      locked: current?.locked ?? false,
      employmentStatus: current?.employmentStatus ?? '在职',
      lastLogin: current?.lastLogin ?? '尚未登录',
    }
    if (current) Object.assign(current, value)
    else users.value.push({ ...value, id: Date.now() })
    editorVisible.value = false
    ElMessage.success('账号已保存')
  } finally {
    saving.value = false
  }
}

const rowActions = row => [
  { key: 'edit', label: '编辑' },
  { key: 'enable', label: '启用', visible: row.status === '禁用' },
  { key: 'disable', label: '禁用', visible: row.status === '启用' },
]
function handleRowAction(key, row) {
  if (key === 'edit') return openEditor(row)
  if (key === 'enable' || key === 'disable') {
    row.status = key === 'enable' ? '启用' : '禁用'
    ElMessage.success('账号状态已更新')
  }
}

const roleDialogVisible = ref(false)
const roleSaving = ref(false)
const roleForm = reactive({ roles: [] })
function openRoleDialog() {
  if (!selections.value.length) return ElMessage.warning('请先勾选账号')
  roleForm.roles = []
  roleDialogVisible.value = true
}
async function saveBatchRoles() {
  if (roleSaving.value) return
  if (!roleForm.roles.length) return ElMessage.warning('请选择要分配的角色')
  if (!selections.value.length) return ElMessage.warning('请先勾选账号')
  roleSaving.value = true
  try {
    selections.value.forEach(row => {
      row.roles = [...new Set([...row.roles, ...roleForm.roles])]
    })
    roleDialogVisible.value = false
    ElMessage.success(`已为 ${selections.value.length} 个账号分配角色`)
    clearSelection()
  } finally {
    roleSaving.value = false
  }
}

// TODO: 批量导入的模板与接口未定，先占位提示，避免伪造上传流程。
function importAccounts() {
  ElMessage.info('批量导入接口待接入')
}
</script>

<style scoped>
.af-table-count {
  margin-left: 9px;
  color: var(--af-text-secondary);
  font-size: 11px;
}
.af-toolbar-filters {
  flex-wrap: wrap;
  justify-content: flex-end;
}
.af-list-panel {
  display: flex;
  flex-direction: column;
  min-height: 500px;
  min-width: 0;
}
.batch-actions {
  margin-bottom: 10px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--af-border-light);
  border-radius: var(--af-radius);
  background: var(--af-surface-soft);
  font-size: 12px;
}
.af-batch-count {
  color: var(--af-primary);
  font-weight: 600;
}
.af-pagination {
  min-width: 0;
  flex: 1;
}
.af-form-tip {
  margin: 4px 0 0;
  color: var(--af-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}
</style>
