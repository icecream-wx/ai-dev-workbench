<template>
  <div class="optimized-suite classic-ops-admin">
    <div class="template-stage">
      <div class="business-page org-ledger-page">
    <section class="org-ledger-shell">
      <aside class="org-tree-panel">
        <pm-search v-model:query="treeQuery" default-prop="keyword" placeholder="搜索组织名称" />
        <div class="org-tree-wrap">
          <pm-tree
            :data="filteredTree"
            :props="treeProps"
            :default-expanded-keys="['ops']"
            :editable="false"
            :removable="false"
            :searchable="false"
            default-expand-all
            highlight-current
            v-model="currentDepartment"
            @node-click="selectDepartment"
          />
        </div>
      </aside>

      <main class="panel org-table-panel">
        <div class="ledger-title-row">
          <div>
            <span>岗位明细</span>
            <h2>{{ currentDepartment.label }}岗位台账</h2>
            <p>{{ currentDepartment.description }}</p>
          </div>
          <pm-toolbar class="ledger-actions" :bordered="false">
            <pm-toolbar-item :icon="Download" @click="exportLedger">导出台账</pm-toolbar-item>
            <pm-toolbar-item type="primary" :icon="Plus" @click="openEditor">新增岗位</pm-toolbar-item>
          </pm-toolbar>
        </div>
        <div class="org-table-toolbar">
          <pm-toolbar class="bulk-actions" :bordered="false">
            <pm-toolbar-item type="primary" plain :disabled="!selected.length">批量调整</pm-toolbar-item>
            <pm-toolbar-item :disabled="!selected.length">转移组织</pm-toolbar-item>
            <pm-toolbar-item :disabled="!selected.length">设为停用</pm-toolbar-item>
          </pm-toolbar>
          <div class="table-filter-line">
            <pm-search
              v-model:query="filters"
              default-prop="keyword"
              placeholder="姓名 / 工号 / 岗位"
              @search="currentPage = 1"
            >
              <template #body>
                <el-form-item label="姓名 / 工号 / 岗位" prop="keyword">
                  <pm-input size="default" v-model="filters.keyword" placeholder="请输入姓名、工号或岗位" />
                </el-form-item>
                <el-form-item label="任职状态" prop="status">
                  <pm-select
                    size="default"
                    v-model="filters.status"
                    :options="statusOptions"
                    clearable
                    placeholder="全部任职状态"
                    style="width: 100%"
                  />
                </el-form-item>
                <el-form-item label="岗位级别" prop="level">
                  <pm-select
                    size="default"
                    v-model="filters.level"
                    :options="levelOptions"
                    clearable
                    placeholder="全部岗位级别"
                    style="width: 100%"
                  />
                </el-form-item>
              </template>
            </pm-search>
          </div>
        </div>

        <pm-table
          :table-data="pagedRows"
          :columns="columns"
          checked
          show-index
          @changrows="selected = $event"
        >
          <template #employee="{ row }">
            <div class="employee-cell">
              <div>{{ row.name.slice(0, 1) }}</div>
              <span>
                <strong>{{ row.name }}</strong>
                <small>{{ row.code }} · {{ row.position }}</small>
              </span>
            </div>
          </template>
          <template #responsibility="{ row }">
            <div class="responsibility-cell">
              <strong>{{ row.responsibility }}</strong>
              <span>{{ row.scope }}</span>
            </div>
          </template>
          <template #load="{ row }">
            <div class="load-cell">
              <span>
                <i :style="{ width: `${row.load}%` }" />
              </span>
              <b>{{ row.load }}%</b>
            </div>
          </template>
          <template #status="{ row }">
            <span class="status-chip" :class="statusClass(row.status)">{{ row.status }}</span>
          </template>
          <template #action="{ row }">
            <button class="link-button" @click="editRow(row)">编辑</button>
            <button class="link-button" @click="viewRecord(row)">档案</button>
          </template>
        </pm-table>
        <div class="ledger-footer">
          <span>当前组织 {{ filteredRows.length }} 条记录，已选 {{ selected.length }} 条 · 编制使用率 {{ capacityRate }}%</span>
          <pm-pagination
            v-model:current-page="currentPage"
            background
            layout="prev, pager, next"
            :page-size="pageSize"
            :total="filteredRows.length"
          />
        </div>
      </main>
    </section>

    <pm-form-dialog
      v-model:dialog-visible="editorVisible"
      :title="editingId ? '编辑岗位档案' : '新增岗位档案'"
      width="580px"
      @submit="saveEditor"
    >
      <template #form>
        <el-form :model="editor" label-position="top" style="padding: 20px">
          <div class="dialog-form-grid">
            <el-form-item label="员工姓名" prop="name" required>
              <pm-input size="default" v-model="editor.name" />
            </el-form-item>
            <el-form-item label="员工工号" prop="code">
              <pm-input size="default" v-model="editor.code" />
            </el-form-item>
            <el-form-item label="岗位名称" prop="position" required>
              <pm-input size="default" v-model="editor.position" />
            </el-form-item>
            <el-form-item label="岗位级别" prop="level">
              <pm-select size="default" v-model="editor.level" :options="levelOptions" style="width: 100%" />
            </el-form-item>
            <el-form-item label="任职状态" prop="status">
              <pm-select size="default" v-model="editor.status" :options="statusOptions" style="width: 100%" />
            </el-form-item>
            <el-form-item label="工作负荷" prop="load">
              <pm-number size="default" v-model="editor.load" :min="0" :max="100" suffix-value="%" />
            </el-form-item>
          </div>
          <el-form-item label="主要职责" prop="responsibility">
            <pm-input size="default" v-model="editor.responsibility" />
          </el-form-item>
        </el-form>
      </template>
    </pm-form-dialog>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Download, Plus } from "@element-plus/icons-vue";


const organizationTree = [
  {
    id: "ops",
    label: "运营管理中心",
    manager: "周宁",
    members: 86,
    capacity: 92,
    description: "统筹平台运营制度、经营分析和服务保障。",
    children: [
      {
        id: "content",
        label: "内容运营部",
        manager: "王可",
        members: 18,
        capacity: 20,
        description: "负责内容策划、活动素材与渠道发布。",
        children: [
          {
            id: "campaign",
            label: "活动策划组",
            manager: "孟星",
            members: 8,
            capacity: 9,
            description: "负责主题活动策划、资源协调和复盘。"
          },
          {
            id: "media",
            label: "内容传播组",
            manager: "许诺",
            members: 10,
            capacity: 11,
            description: "负责内容生产、渠道传播与品牌一致性。"
          }
        ]
      },
      {
        id: "service",
        label: "客户服务部",
        manager: "林晓",
        members: 32,
        capacity: 34,
        description: "负责客服排班、服务质量和用户反馈闭环。",
        children: [
          {
            id: "day",
            label: "日间服务组",
            manager: "陈雨",
            members: 18,
            capacity: 18,
            description: "承担日间咨询、投诉和工单处置。"
          },
          {
            id: "night",
            label: "夜间服务组",
            manager: "苏禾",
            members: 10,
            capacity: 12,
            description: "承担夜间值守和应急升级。"
          },
          {
            id: "quality",
            label: "服务质检组",
            manager: "唐宁",
            members: 4,
            capacity: 4,
            description: "负责服务抽检、培训和流程治理。"
          }
        ]
      },
      {
        id: "growth",
        label: "用户增长部",
        manager: "赵洋",
        members: 21,
        capacity: 23,
        description: "负责用户拉新、会员运营和生命周期增长。",
        children: [
          {
            id: "member",
            label: "会员运营组",
            manager: "陈序",
            members: 12,
            capacity: 13,
            description: "负责会员权益、留存和复购运营。"
          },
          {
            id: "channel",
            label: "渠道增长组",
            manager: "林默",
            members: 9,
            capacity: 10,
            description: "负责渠道投放、归因和增长实验。"
          }
        ]
      },
      {
        id: "analysis",
        label: "经营分析部",
        manager: "周青",
        members: 15,
        capacity: 15,
        description: "负责经营指标、专题分析和管理简报。"
      }
    ]
  }
];
const treeProps = { id: "id", label: "label", children: "children", isLeaf: "isLeaf" };
const currentDepartment = ref(organizationTree[0]);
const treeQuery = ref({ keyword: "" });
const flatten = nodes =>
  nodes.flatMap(node => [
    node,
    ...(node.children ? flatten(node.children) : [])
  ]);
const allDepartments = flatten(organizationTree);
const filteredTree = computed(() => {
  const keyword = treeQuery.value.keyword.trim();
  if (!keyword) return organizationTree;
  return allDepartments
    .filter(item => item.label.includes(keyword))
    .map(item => ({ ...item, children: undefined }));
});
const rows = ref([
  {
    id: 1,
    department: "ops",
    code: "OP-0081",
    name: "周宁",
    position: "运营中心负责人",
    level: "M3",
    responsibility: "运营统筹与机制建设",
    scope: "全中心",
    load: 86,
    joinedAt: "2021-04-12",
    status: "在岗"
  },
  {
    id: 2,
    department: "ops",
    code: "OP-0116",
    name: "程安",
    position: "运营流程经理",
    level: "P7",
    responsibility: "制度流程与运营审计",
    scope: "全中心",
    load: 92,
    joinedAt: "2022-08-18",
    status: "在岗"
  },
  {
    id: 3,
    department: "content",
    code: "OP-0128",
    name: "王可",
    position: "内容运营经理",
    level: "M2",
    responsibility: "内容规划与团队管理",
    scope: "内容运营部",
    load: 84,
    joinedAt: "2022-11-03",
    status: "在岗"
  },
  {
    id: 4,
    department: "content",
    code: "OP-0193",
    name: "叶岚",
    position: "高级内容运营",
    level: "P6",
    responsibility: "专题内容与渠道发布",
    scope: "内容运营部",
    load: 78,
    joinedAt: "2024-02-21",
    status: "在岗"
  },
  {
    id: 5,
    department: "campaign",
    code: "OP-0226",
    name: "孟星",
    position: "活动策划主管",
    level: "M1",
    responsibility: "活动策划与资源协调",
    scope: "活动策划组",
    load: 96,
    joinedAt: "2024-07-08",
    status: "在岗"
  },
  {
    id: 6,
    department: "campaign",
    code: "OP-0251",
    name: "顾言",
    position: "活动运营专员",
    level: "P4",
    responsibility: "活动执行与数据复盘",
    scope: "活动策划组",
    load: 88,
    joinedAt: "2025-01-13",
    status: "试用期"
  },
  {
    id: 7,
    department: "media",
    code: "OP-0188",
    name: "许诺",
    position: "传播运营主管",
    level: "M1",
    responsibility: "传播矩阵与品牌规范",
    scope: "内容传播组",
    load: 82,
    joinedAt: "2023-09-18",
    status: "在岗"
  },
  {
    id: 8,
    department: "service",
    code: "OP-0062",
    name: "林晓",
    position: "客户服务经理",
    level: "M2",
    responsibility: "服务团队与质量管理",
    scope: "客户服务部",
    load: 91,
    joinedAt: "2020-06-22",
    status: "在岗"
  },
  {
    id: 9,
    department: "day",
    code: "OP-0145",
    name: "陈雨",
    position: "日间服务主管",
    level: "M1",
    responsibility: "日间排班与工单升级",
    scope: "日间服务组",
    load: 89,
    joinedAt: "2022-12-05",
    status: "在岗"
  },
  {
    id: 10,
    department: "night",
    code: "OP-0204",
    name: "苏禾",
    position: "夜间服务主管",
    level: "M1",
    responsibility: "夜间值守与应急响应",
    scope: "夜间服务组",
    load: 95,
    joinedAt: "2024-03-11",
    status: "在岗"
  },
  {
    id: 11,
    department: "quality",
    code: "OP-0172",
    name: "唐宁",
    position: "服务质检专家",
    level: "P7",
    responsibility: "质检规则与服务培训",
    scope: "服务质检组",
    load: 76,
    joinedAt: "2023-05-15",
    status: "在岗"
  },
  {
    id: 12,
    department: "growth",
    code: "OP-0097",
    name: "赵洋",
    position: "用户增长经理",
    level: "M2",
    responsibility: "增长目标与资源配置",
    scope: "用户增长部",
    load: 87,
    joinedAt: "2021-10-09",
    status: "在岗"
  },
  {
    id: 13,
    department: "member",
    code: "OP-0169",
    name: "陈序",
    position: "会员运营主管",
    level: "M1",
    responsibility: "会员权益与复购运营",
    scope: "会员运营组",
    load: 93,
    joinedAt: "2023-04-17",
    status: "在岗"
  },
  {
    id: 14,
    department: "channel",
    code: "OP-0218",
    name: "林默",
    position: "渠道增长主管",
    level: "M1",
    responsibility: "渠道投放与增长实验",
    scope: "渠道增长组",
    load: 81,
    joinedAt: "2024-05-20",
    status: "在岗"
  },
  {
    id: 15,
    department: "analysis",
    code: "OP-0105",
    name: "周青",
    position: "经营分析经理",
    level: "M2",
    responsibility: "经营指标与专题分析",
    scope: "经营分析部",
    load: 85,
    joinedAt: "2022-01-10",
    status: "在岗"
  }
]);
const filters = ref({ keyword: "", status: "", level: "" });
const statusOptions = ["在岗", "试用期", "借调", "停用"].map(value => ({
  label: value,
  value
}));
const levelOptions = ["M3", "M2", "M1", "P7", "P6", "P5", "P4"].map(value => ({
  label: value,
  value
}));
const columns = [
  { prop: "name", label: "人员 / 岗位", minWidth: 210, scope: "employee" },
  { prop: "level", label: "级别", width: 72 },
  {
    prop: "responsibility",
    label: "职责范围",
    minWidth: 190,
    scope: "responsibility"
  },
  { prop: "load", label: "工作负荷", width: 125, scope: "load" },
  { prop: "joinedAt", label: "任职日期", width: 110 },
  { prop: "status", label: "状态", width: 90, scope: "status" },
  { prop: "action", label: "操作", width: 108, scope: "action", fixed: "right" }
];
const selected = ref([]);
const currentPage = ref(1);
const pageSize = 8;
const departmentIds = computed(() => [
  currentDepartment.value.id,
  ...flatten(currentDepartment.value.children || []).map(item => item.id)
]);
const filteredRows = computed(() =>
  rows.value.filter(
    row =>
      departmentIds.value.includes(row.department) &&
      (!filters.value.keyword ||
        `${row.name}${row.code}${row.position}`.includes(
          filters.value.keyword
        )) &&
      (!filters.value.status || row.status === filters.value.status) &&
      (!filters.value.level || row.level === filters.value.level)
  )
);
const pagedRows = computed(() =>
  filteredRows.value.slice(
    (currentPage.value - 1) * pageSize,
    currentPage.value * pageSize
  )
);
const capacityRate = computed(() =>
  Math.round(
    (currentDepartment.value.members / currentDepartment.value.capacity) * 100
  )
);
watch(
  [currentDepartment, filters],
  () => {
    currentPage.value = 1;
  },
  { deep: true }
);
const selectDepartment = node => {
  currentDepartment.value = node;
  selected.value = [];
};
const statusClass = status =>
  ({
    在岗: "status-success",
    试用期: "status-warning",
    借调: "status-warning",
    停用: "status-neutral"
  }[status]);
const exportLedger = () =>
  ElMessage.success(`${currentDepartment.value.label}岗位台账已导出`);
const viewRecord = row => ElMessage.info(`正在查看 ${row.name} 的完整岗位档案`);
const editorVisible = ref(false);
const editingId = ref(null);
const editor = reactive({
  name: "",
  code: "",
  position: "",
  level: "P4",
  status: "在岗",
  load: 80,
  responsibility: ""
});
const openEditor = () => {
  editingId.value = null;
  Object.assign(editor, {
    name: "",
    code: "",
    position: "",
    level: "P4",
    status: "在岗",
    load: 80,
    responsibility: ""
  });
  editorVisible.value = true;
};
const editRow = row => {
  editingId.value = row.id;
  Object.assign(editor, row);
  editorVisible.value = true;
};
const saveEditor = () => {
  if (!editor.name || !editor.position)
    return ElMessage.warning("请补充员工姓名和岗位名称");
  if (editingId.value)
    Object.assign(
      rows.value.find(row => row.id === editingId.value),
      editor
    );
  else
    rows.value.unshift({
      ...editor,
      id: Date.now(),
      department: currentDepartment.value.id,
      scope: currentDepartment.value.label,
      joinedAt: "2026-11-12"
    });
  editorVisible.value = false;
  ElMessage.success("岗位档案已保存");
};
</script>

<style scoped>
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
  background: #fffaf5;
  box-shadow: var(--template-shadow);
}
.org-tree-panel :deep(.pm-search-main) {
  align-items: stretch;
  flex-direction: column;
}
.org-tree-panel :deep(.pm-search-main .el-button) {
  width: 100%;
}
.org-tree-wrap {
  height: calc(100vh - 190px);
  min-height: 420px;
  margin: 12px 0 0;
  padding: 5px 6px;
  overflow: auto;
  border-top: 1px solid var(--template-border-light);
  border-bottom: 1px solid var(--template-border-light);
}
.org-tree-wrap :deep(.el-tree-node__content) {
  height: 34px;
  border-radius: 4px;
}
.org-tree-wrap :deep(.el-tree-node.is-current > .el-tree-node__content) {
  color: var(--template-primary);
  background: var(--template-primary-soft);
  box-shadow: inset 3px 0 0 var(--template-primary);
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
  border-bottom: 1px solid var(--template-border);
  background: linear-gradient(90deg, #fffdfa, #fff);
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
  font: 650 20px Georgia, "Songti SC", serif;
}
.ledger-title-row p {
  margin: 4px 0 0;
  color: var(--template-text-soft);
  font-size: 9px;
}
.ledger-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.org-table-toolbar {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.bulk-actions,
.table-filter-line {
  display: flex;
  align-items: center;
  gap: 7px;
}
.table-filter-line > :deep(.pm-search-wrapper) {
  width: 360px;
}
.employee-cell {
  display: flex;
  align-items: center;
  gap: 9px;
}
.employee-cell > div {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  color: #fff;
  border-radius: 4px;
  background: var(--template-primary);
  font: 700 12px Georgia, serif;
}
.employee-cell strong,
.employee-cell small,
.responsibility-cell strong,
.responsibility-cell span {
  display: block;
}
.employee-cell strong {
  font-size: 11px;
}
.employee-cell small,
.responsibility-cell span {
  margin-top: 3px;
  color: var(--template-text-soft);
  font-size: 9px;
}
.responsibility-cell strong {
  font-size: 10px;
}
.load-cell {
  display: flex;
  align-items: center;
  gap: 7px;
}
.load-cell > span {
  width: 64px;
  height: 5px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--template-border-light);
}
.load-cell i {
  height: 100%;
  display: block;
  background: var(--template-secondary);
}
.load-cell b {
  color: var(--template-text-soft);
  font-size: 9px;
}
.ledger-footer {
  padding-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--template-text-soft);
  font-size: 9px;
}
.dialog-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
}
@media (max-width: 1080px) {
  .org-ledger-shell {
    grid-template-columns: 1fr;
  }
  .org-tree-panel {
    position: static;
  }
  .org-tree-wrap {
    height: 220px;
  }
  .org-table-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .table-filter-line {
    width: 100%;
  }
  .table-filter-line > :deep(.pm-search-wrapper) {
    min-width: 220px;
    flex: 1;
  }
}
@media (max-width: 700px) {
  .table-filter-line {
    align-items: stretch;
    flex-direction: column;
  }
  .table-filter-line > :deep(.pm-search-wrapper) {
    width: 100%;
  }
  .ledger-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
  .dialog-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
<style scoped>
.org-tree-wrap {
  padding: 8px 6px 8px 2px;
  border: 1px solid #eaded2;
  border-radius: 8px;
  background: repeating-linear-gradient(
      0deg,
      transparent 0,
      transparent 35px,
      rgba(130, 91, 62, 0.035) 36px
    ),
    #fffdf9;
  scrollbar-color: #b89b85 #f3ebe4;
  scrollbar-width: thin;
}
.org-tree-wrap::-webkit-scrollbar {
  width: 7px;
}
.org-tree-wrap::-webkit-scrollbar-track {
  border-radius: 8px;
  background: #f3ebe4;
}
.org-tree-wrap::-webkit-scrollbar-thumb {
  border: 2px solid #f3ebe4;
  border-radius: 8px;
  background: #b89b85;
}
.org-tree-wrap :deep(.el-tree) {
  padding: 2px 0;
  color: #594a3f;
  background: transparent !important;
  --el-tree-node-hover-bg-color: transparent;
}
.org-tree-wrap :deep(.el-tree-node) {
  position: relative;
}
.org-tree-wrap :deep(.el-tree-node__children) {
  position: relative;
}
.org-tree-wrap :deep(.el-tree-node__children::before) {
  position: absolute;
  top: 0;
  bottom: 10px;
  left: 12px;
  width: 1px;
  background: #e6d7ca;
  content: "";
}
.org-tree-wrap :deep(.el-tree-node__content) {
  position: relative;
  height: 36px;
  margin: 2px 0;
  color: #66574c;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent !important;
  box-shadow: none !important;
  transition: color 0.16s, border-color 0.16s, background 0.16s, transform 0.16s;
}
.org-tree-wrap :deep(.el-tree-node__content:hover) {
  color: #7d3f25;
  border-color: #ead3c4;
  background: #fbf0e8 !important;
  transform: translateX(2px);
}
.org-tree-wrap :deep(.el-tree-node:focus > .el-tree-node__content) {
  color: #6b4c3a;
  border-color: transparent;
  background: transparent !important;
}
.org-tree-wrap :deep(.el-tree-node.is-current > .el-tree-node__content),
.org-tree-wrap :deep(.el-tree-node.is-current:focus > .el-tree-node__content) {
  color: #9a3f1f !important;
  border-color: #dfbda8 !important;
  background: linear-gradient(90deg, #f7e2d5, #fff8f2) !important;
  box-shadow: inset 3px 0 0 var(--template-primary),
    0 4px 10px rgba(130, 71, 39, 0.08) !important;
  transform: none;
}
.org-tree-wrap :deep(.el-tree > .el-tree-node > .el-tree-node__content) {
  margin-bottom: 5px;
  color: #49382d;
  border-color: #eadccf;
  background: #f8f0e9 !important;
  font-family: Georgia, "Songti SC", serif;
  font-weight: 700;
}
.org-tree-wrap :deep(.el-tree-node__expand-icon) {
  color: #a1785d;
  font-size: 12px;
}
.org-tree-wrap :deep(.el-tree-node__expand-icon.is-leaf) {
  color: transparent;
}
.org-tree-wrap :deep(.el-tree-node__label) {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  line-height: 1;
}
.org-tree-wrap :deep(.el-tree-node__label::before) {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border: 1px solid #c2a995;
  border-radius: 2px;
  background: #fff;
  content: "";
}
.org-tree-wrap
  :deep(.el-tree
    > .el-tree-node
    > .el-tree-node__content
    .el-tree-node__label::before) {
  width: 9px;
  height: 8px;
  flex-basis: 9px;
  border-color: #9d7257;
  border-radius: 2px 2px 1px 1px;
  background: #b88a6e;
  box-shadow: inset 0 2px 0 #d8b8a3;
}
.org-tree-wrap
  :deep(.el-tree-node.is-current
    > .el-tree-node__content
    .el-tree-node__label) {
  font-weight: 750;
}
.org-tree-wrap
  :deep(.el-tree-node.is-current
    > .el-tree-node__content
    .el-tree-node__label::before) {
  border-color: var(--template-primary);
  background: var(--template-primary);
  box-shadow: 0 0 0 3px rgba(202, 83, 42, 0.11);
}
</style>
