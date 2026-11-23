<template>
  <div class="optimized-suite application-type-enterprise-platform afcenter-template">
    <div class="af-page">
    <header class="af-page-header">
      <div>
        <h1>应用中心</h1>
        <p>统一管理平台应用、运行状态和负责人</p>
      </div>
      <div class="af-actions">
        <el-button :icon="Upload">导入</el-button>
        <el-button type="primary" :icon="Plus" @click="$emit('navigate','application-form')">注册应用</el-button>
      </div>
    </header>
    <section class="af-panel">
      <div class="af-filter-grid">
        <label class="af-field">
          <span>应用名称</span>
          <pm-input size="default" v-model="filters.keyword" clearable placeholder="名称或编码" />
        </label>
        <label class="af-field">
          <span>应用类型</span>
          <pm-select size="default" v-model="filters.type" :options="typeOptions" clearable placeholder="全部类型" />
        </label>
        <label class="af-field">
          <span>运行状态</span>
          <pm-select
            size="default"
            v-model="filters.status"
            :options="statusOptions"
            clearable
            placeholder="全部状态"
          />
        </label>
        <div class="af-actions">
          <el-button type="primary" :icon="Search">查询</el-button>
          <el-button @click="reset">重置</el-button>
        </div>
      </div>
    </section>
    <section class="af-panel">
      <div class="af-table-head">
        <div class="af-toolbar">
          <strong>应用列表</strong>
          <pm-radio size="default" v-model="viewMode" :settings="viewModeSettings" option-type="button" />
        </div>
        <span style="color:var(--af-text-secondary);font-size:11px">共 {{filteredApps.length}} 个应用</span>
      </div>
      <div v-if="viewMode==='card'" class="af-app-grid">
        <article v-for="app in filteredApps" :key="app.id" class="af-app-card" @click="edit(app)">
          <header>
            <span class="af-app-logo" :style="{'--app-color':app.color}">{{app.name.slice(0,1)}}</span>
            <div>
              <h3>{{app.name}}</h3>
              <span
                class="af-status"
                :class="app.status==='运行中'?'success':app.status==='维护中'?'warning':'neutral'"
              >{{app.status}}</span>
            </div>
          </header>
          <p>{{app.description}}</p>
          <footer>
            <span>{{app.type}} · {{app.owner}}</span>
            <span>{{app.updatedAt}}</span>
          </footer>
        </article>
      </div>
      <pm-table v-else :table-data="filteredApps" :columns="columns" checked show-index>
        <template #status="{row}">
          <span
            class="af-status"
            :class="row.status==='运行中'?'success':row.status==='维护中'?'warning':'neutral'"
          >{{row.status}}</span>
        </template>
        <template #action="{row}">
          <button class="af-link" @click="edit(row)">编辑</button>
          <button class="af-link" @click="toggle(row)">{{row.status==='运行中'?'停用':'启用'}}</button>
        </template>
      </pm-table>
      <div class="af-table-footer">
        <span>已同步最新运行状态</span>
        <pm-pagination
          background
          layout="prev, pager, next"
          :page-size="9"
          :total="filteredApps.length"
        />
      </div>
    </section>
    <pm-form-dialog v-model:dialog-visible="editVisible" title="编辑应用" width="540px" @submit="save">
      <template #form><el-form label-position="top">
        <el-form-item label="应用名称">
          <pm-input size="default" v-model="editor.name" />
        </el-form-item>
        <el-form-item label="负责人">
          <pm-select size="default" v-model="editor.owner" :options="ownerOptions" style="width:100%" />
        </el-form-item>
        <el-form-item label="应用说明">
          <pm-textarea size="default" v-model="editor.description" :rows="3" />
        </el-form-item>
      </el-form></template>
    </pm-form-dialog>
    </div>
  </div>
</template>
<script setup>
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Plus, Search, Upload } from "@element-plus/icons-vue";
defineEmits(["navigate"]);
const options = values => values.map(value => ({ label: value, value }));
const filters = reactive({ keyword: "", type: "", status: "" }),
  typeOptions = options(["低代码应用", "高代码应用", "数据应用", "门户应用"]),
  statusOptions = options(["运行中", "维护中", "已停用"]),
  ownerOptions = options(["周宁", "林川", "陈序", "许安"]);
const apps = ref([
  {
    id: 1,
    name: "订单协同中心",
    code: "order-hub",
    type: "低代码应用",
    owner: "周宁",
    status: "运行中",
    updatedAt: "8分钟前",
    color: "#1f5eff",
    description: "订单受理、履约跟踪与售后协同一体化应用。"
  },
  {
    id: 2,
    name: "客户数据平台",
    code: "customer-data",
    type: "数据应用",
    owner: "林川",
    status: "运行中",
    updatedAt: "32分钟前",
    color: "#22a06b",
    description: "统一客户主数据、标签画像和分群分析能力。"
  },
  {
    id: 3,
    name: "供应商门户",
    code: "supplier-portal",
    type: "门户应用",
    owner: "陈序",
    status: "维护中",
    updatedAt: "2小时前",
    color: "#8b5cf6",
    description: "供应商准入、协同采购和履约评价门户。"
  },
  {
    id: 4,
    name: "营销活动中心",
    code: "marketing-hub",
    type: "低代码应用",
    owner: "许安",
    status: "运行中",
    updatedAt: "今天",
    color: "#f59e0b",
    description: "活动配置、客群触达和效果归因管理。"
  },
  {
    id: 5,
    name: "主数据管理",
    code: "mdm-center",
    type: "高代码应用",
    owner: "林川",
    status: "运行中",
    updatedAt: "昨天",
    color: "#0ea5e9",
    description: "企业级主数据建模、治理和分发平台。"
  },
  {
    id: 6,
    name: "历史报表系统",
    code: "legacy-report",
    type: "高代码应用",
    owner: "周宁",
    status: "已停用",
    updatedAt: "7天前",
    color: "#64748b",
    description: "历史经营报表归档与查询应用。"
  }
]);
const viewMode = ref("card");
const viewModeSettings = {
  type: "custom",
  options: [
    { label: "卡片", value: "card" },
    { label: "表格", value: "table" }
  ]
};
const filteredApps = computed(() =>
  apps.value.filter(
    app =>
      (!filters.keyword ||
        `${app.name}${app.code}`.includes(filters.keyword)) &&
      (!filters.type || app.type === filters.type) &&
      (!filters.status || app.status === filters.status)
  )
);
const columns = [
  { prop: "name", label: "应用名称", minWidth: 170 },
  { prop: "code", label: "应用编码", minWidth: 140 },
  { prop: "type", label: "应用类型", width: 120 },
  { prop: "owner", label: "负责人", width: 100 },
  { prop: "status", label: "状态", width: 100, scope: "status" },
  { prop: "updatedAt", label: "最近更新", width: 110 },
  { prop: "action", label: "操作", width: 120, scope: "action" }
];
const reset = () =>
  Object.assign(filters, { keyword: "", type: "", status: "" });
const editVisible = ref(false),
  editingId = ref(),
  editor = reactive({ name: "", owner: "", description: "" });
const edit = app => {
  editingId.value = app.id;
  Object.assign(editor, app);
  editVisible.value = true;
};
const save = () => {
  Object.assign(
    apps.value.find(app => app.id === editingId.value),
    editor
  );
  editVisible.value = false;
  ElMessage.success("应用信息已保存");
};
const toggle = row => {
  row.status = row.status === "运行中" ? "已停用" : "运行中";
  ElMessage.success("应用状态已更新");
};
</script>
