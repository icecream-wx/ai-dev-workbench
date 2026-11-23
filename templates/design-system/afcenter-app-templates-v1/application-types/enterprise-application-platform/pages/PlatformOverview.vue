<template>
  <div class="optimized-suite application-type-enterprise-platform afcenter-template">
    <div class="af-page">
    <header class="af-page-header">
      <div>
        <h1>管理驾驶舱</h1>
        <p>组织、用户、应用和资源的统一运行概览</p>
      </div>
      <div class="af-actions">
        <pm-select size="default" v-model="tenant" :options="tenantOptions" style="width:160px" />
        <el-button :icon="Refresh" @click="refresh">刷新</el-button>
      </div>
    </header>
    <section class="af-metrics">
      <article v-for="metric in metrics" :key="metric.label" class="af-metric">
        <div class="af-metric-top">
          <span>{{metric.label}}</span>
          <span class="af-metric-icon">
            <el-icon>
              <component :is="metric.icon" />
            </el-icon>
          </span>
        </div>
        <strong>{{metric.value}}</strong>
        <small>{{metric.note}}</small>
      </article>
    </section>
    <div class="af-dashboard-grid">
      <section class="af-panel">
        <div class="af-table-head">
          <h2 class="af-panel-title" style="margin:0">组织与应用增长</h2>
          <span class="af-status success">运行正常</span>
        </div>
        <pm-echarts :option="growthChartOption" height="270px" />
      </section>
      <section class="af-panel">
        <h2 class="af-panel-title">平台动态</h2>
        <ul class="af-activity-list">
          <li v-for="item in activities" :key="item.title">
            <i />
            <div>
              <strong>{{item.title}}</strong>
              <span>{{item.description}}</span>
            </div>
            <time>{{item.time}}</time>
          </li>
        </ul>
      </section>
    </div>
    <section class="af-panel">
      <div class="af-table-head">
        <h2 class="af-panel-title" style="margin:0">最近活跃应用</h2>
        <el-button text type="primary" @click="$emit('navigate','applications')">查看全部</el-button>
      </div>
      <pm-table :table-data="apps" :columns="columns">
        <template #status="{row}">
          <span class="af-status" :class="row.status==='运行中'?'success':'warning'">{{row.status}}</span>
        </template>
        <template #action="{row}">
          <button class="af-link" @click="ElMessage.info(`${row.name} 运行详情`)">运行详情</button>
        </template>
      </pm-table>
    </section>
    </div>
  </div>
</template>
<script setup>
import { ref } from "vue";
import { ElMessage } from "element-plus";
import {
  Grid,
  OfficeBuilding,
  Refresh,
  Tickets,
  User
} from "@element-plus/icons-vue";

defineEmits(["navigate"]);
const tenant = ref("普元平台租户");
const tenantOptions = [
  "普元平台租户",
  "华东业务租户",
  "研发测试租户"
].map(value => ({ label: value, value }));
const metrics = [
  {
    label: "组织机构",
    value: "128",
    note: "本月新增 6 个",
    icon: OfficeBuilding
  },
  { label: "平台用户", value: "2,846", note: "本周活跃 81.3%", icon: User },
  { label: "运行应用", value: "46", note: "全部应用可用", icon: Grid },
  { label: "资源数量", value: "12,680", note: "较上月 +9.4%", icon: Tickets }
];
const growthChartOption = {
  chartView: {
    grid: { left: 36, right: 18, top: 24, bottom: 30 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: ["5月", "6月", "7月", "8月", "9月", "10月", "11月"]
    },
    yAxis: { type: "value" },
    series: [
      {
        name: "应用数",
        type: "line",
        smooth: true,
        data: [46, 58, 63, 72, 84, 91, 96],
        areaStyle: { color: "rgba(31,94,255,.12)" },
        lineStyle: { color: "#1f5eff", width: 3 },
        itemStyle: { color: "#1f5eff" }
      }
    ]
  }
};
const activities = [
  {
    title: "应用发布成功",
    description: "订单协同中心 v3.2.1",
    time: "8分钟前"
  },
  { title: "新增组织机构", description: "华南区域运营中心", time: "32分钟前" },
  {
    title: "角色权限调整",
    description: "平台开发者增加数据权限",
    time: "1小时前"
  },
  { title: "用户批量导入", description: "导入 128 名员工账号", time: "今天" }
];
const apps = [
  {
    name: "订单协同中心",
    code: "order-hub",
    type: "低代码应用",
    owner: "周宁",
    updatedAt: "8 分钟前",
    status: "运行中"
  },
  {
    name: "客户数据平台",
    code: "customer-data",
    type: "数据应用",
    owner: "林川",
    updatedAt: "32 分钟前",
    status: "运行中"
  },
  {
    name: "供应商门户",
    code: "supplier-portal",
    type: "门户应用",
    owner: "陈序",
    updatedAt: "2 小时前",
    status: "维护中"
  }
];
const columns = [
  { prop: "name", label: "应用名称", minWidth: 170 },
  { prop: "code", label: "应用编码", minWidth: 140 },
  { prop: "type", label: "应用类型", width: 120 },
  { prop: "owner", label: "负责人", width: 100 },
  { prop: "updatedAt", label: "最近更新", width: 120 },
  { prop: "status", label: "状态", width: 100, scope: "status" },
  { prop: "action", label: "操作", width: 100, scope: "action" }
];
const refresh = () => ElMessage.success("驾驶舱数据已刷新");
</script>
