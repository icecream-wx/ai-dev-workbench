<template>
  <div class="optimized-suite afcenter-template">
    <div class="af-page">
    <header class="af-page-header">
      <div>
        <h1>组织与用户</h1>
        <p>维护组织机构、用户账号、岗位与角色关联</p>
      </div>
      <div class="af-actions">
        <el-button :icon="Upload">批量导入</el-button>
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
          :default-expanded-keys="['all','platform']"
          :editable="false"
          :removable="false"
          :searchable="false"
          default-expand-all
          highlight-current
          @node-click="selectOrg"
        />
      </aside>
      <section class="af-panel">
        <div class="af-table-head">
          <div>
            <strong>{{currentOrg.label}}</strong>
            <span
              style="margin-left:9px;color:var(--af-text-secondary);font-size:11px"
            >{{filteredUsers.length}} 个账号</span>
          </div>
          <div class="af-toolbar">
            <pm-input size="default" v-model="keyword" clearable placeholder="搜索账号或姓名" style="width:220px" />
            <pm-select
              v-model="status"
              :options="statusOptions"
              clearable
              placeholder="全部状态"
              style="width:130px"
            />
          </div>
        </div>
        <pm-table :table-data="filteredUsers" :columns="columns" checked show-index>
          <template #status="{row}">
            <span class="af-status" :class="row.status==='启用'?'success':'neutral'">{{row.status}}</span>
          </template>
          <template #lock="{row}">
            <span
              class="af-status"
              :class="row.locked?'danger':'success'"
            >{{row.locked?'已锁定':'未锁定'}}</span>
          </template>
          <template #action="{row}">
            <button class="af-link" @click="openEditor(row)">编辑</button>
            <button class="af-link" @click="toggle(row)">{{row.status==='启用'?'禁用':'启用'}}</button>
          </template>
        </pm-table>
        <div class="af-table-footer">
          <span>已选账号可批量分配角色</span>
          <pm-pagination
            background
            layout="prev, pager, next"
            :page-size="10"
            :total="filteredUsers.length"
          />
        </div>
      </section>
    </div>
    <pm-dialog v-model="editorVisible" :title="editingId?'编辑账号':'新建账号'" width="560px">
      <el-form label-position="top">
        <div class="af-form-grid">
          <el-form-item label="账号" required>
            <pm-input size="default" v-model="editor.code" :disabled="Boolean(editingId)" />
          </el-form-item>
          <el-form-item label="员工姓名" required>
            <pm-input size="default" v-model="editor.name" />
          </el-form-item>
          <el-form-item label="所属机构">
            <pm-select size="default" v-model="editor.org" :options="orgOptions" />
          </el-form-item>
          <el-form-item label="岗位">
            <pm-select size="default" v-model="editor.position" :options="positionOptions" />
          </el-form-item>
          <el-form-item label="角色">
            <pm-select size="default" v-model="editor.roles" :options="roleOptions" multiple />
          </el-form-item>
          <el-form-item label="启用账号">
            <pm-switch
              :model-value="String(editor.enabled)"
              @update:model-value="editor.enabled = $event === 'true'"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible=false">取消</el-button>
        <el-button type="primary" @click="save">确定</el-button>
      </template>
    </pm-dialog>
    </div>
  </div>
</template>
<script setup>
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Plus, Upload } from "@element-plus/icons-vue";
const treeProps = {
  id: "id",
  label: "label",
  children: "children",
  isLeaf: "isLeaf"
};
const orgTree = [
  {
    id: "all",
    label: "普元信息技术",
    children: [
      {
        id: "platform",
        label: "数字化平台部",
        children: [
          { id: "frontend", label: "前端研发组" },
          { id: "backend", label: "后端研发组" }
        ]
      },
      { id: "business", label: "业务运营部" },
      { id: "data", label: "数据管理部" }
    ]
  }
];
const currentOrg = ref(orgTree[0]),
  treeKeyword = ref(""),
  keyword = ref(""),
  status = ref(""),
  filteredOrgTree = computed(() => {
    const term = treeKeyword.value.trim();
    if (!term) return orgTree;
    const filter = nodes =>
      nodes
        .map(node => ({
          ...node,
          children: node.children ? filter(node.children) : undefined
        }))
        .filter(node => node.label.includes(term) || node.children?.length);
    return filter(orgTree);
  }),
  statusOptions = ["启用", "禁用"].map(value => ({ label: value, value }));
const users = ref([
  {
    id: 1,
    code: "zhou.ning",
    name: "周宁",
    org: "数字化平台部",
    position: "产品经理",
    roles: "应用管理员",
    status: "启用",
    locked: false,
    lastLogin: "今天 10:24"
  },
  {
    id: 2,
    code: "lin.chuan",
    name: "林川",
    org: "数据管理部",
    position: "数据工程师",
    roles: "数据管理员",
    status: "启用",
    locked: false,
    lastLogin: "今天 09:51"
  },
  {
    id: 3,
    code: "chen.xu",
    name: "陈序",
    org: "数字化平台部",
    position: "开发工程师",
    roles: "平台开发者",
    status: "启用",
    locked: false,
    lastLogin: "昨天 18:32"
  },
  {
    id: 4,
    code: "xu.an",
    name: "许安",
    org: "业务运营部",
    position: "运营专员",
    roles: "普通用户",
    status: "禁用",
    locked: true,
    lastLogin: "7 天前"
  }
]);
const filteredUsers = computed(() =>
  users.value.filter(
    row =>
      (currentOrg.value.id === "all" || row.org === currentOrg.value.label) &&
      (!keyword.value || `${row.code}${row.name}`.includes(keyword.value)) &&
      (!status.value || row.status === status.value)
  )
);
const columns = [
  { prop: "code", label: "账号", minWidth: 130 },
  { prop: "name", label: "所属员工", width: 100 },
  { prop: "org", label: "所属机构", minWidth: 140 },
  { prop: "roles", label: "角色", width: 120 },
  { prop: "status", label: "状态", width: 90, scope: "status" },
  { prop: "lock", label: "锁定", width: 90, scope: "lock" },
  { prop: "lastLogin", label: "最近登录", width: 120 },
  { prop: "action", label: "操作", width: 120, scope: "action" }
];
const selectOrg = node => (currentOrg.value = node);
const options = values => values.map(value => ({ label: value, value })),
  orgOptions = options(["数字化平台部", "业务运营部", "数据管理部"]),
  positionOptions = options([
    "产品经理",
    "开发工程师",
    "数据工程师",
    "运营专员"
  ]),
  roleOptions = options(["应用管理员", "数据管理员", "平台开发者", "普通用户"]);
const editorVisible = ref(false),
  editingId = ref(),
  editor = reactive({
    code: "",
    name: "",
    org: "数字化平台部",
    position: "开发工程师",
    roles: [],
    enabled: true
  });
const openEditor = row => {
  editingId.value = row?.id || null;
  Object.assign(
    editor,
    row
      ? { ...row, roles: [row.roles], enabled: row.status === "启用" }
      : {
          code: "",
          name: "",
          org:
            currentOrg.value.id === "all"
              ? "数字化平台部"
              : currentOrg.value.label,
          position: "开发工程师",
          roles: [],
          enabled: true
        }
  );
  editorVisible.value = true;
};
const save = () => {
  if (!editor.code || !editor.name)
    return ElMessage.warning("请填写账号和员工姓名");
  const value = {
    ...editor,
    roles: editor.roles.join("、"),
    status: editor.enabled ? "启用" : "禁用",
    locked: false,
    lastLogin: "尚未登录"
  };
  if (editingId.value)
    Object.assign(
      users.value.find(row => row.id === editingId.value),
      value
    );
  else users.value.push({ ...value, id: Date.now() });
  editorVisible.value = false;
  ElMessage.success("账号已保存");
};
const toggle = row => {
  row.status = row.status === "启用" ? "禁用" : "启用";
  ElMessage.success("账号状态已更新");
};
</script>
