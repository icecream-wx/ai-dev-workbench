<template>
  <div class="optimized-suite afcenter-template">
    <div class="af-page">
    <header class="af-page-header">
      <div>
        <h1>审计日志</h1>
        <p>查询平台操作、登录访问和安全事件记录</p>
      </div>
      <el-button :icon="Download">导出日志</el-button>
    </header>
    <section class="af-panel">
      <div class="af-filter-grid">
        <label class="af-field">
          <span>操作人</span>
          <pm-input size="default" v-model="filters.operator" clearable placeholder="账号或姓名" />
        </label>
        <label class="af-field">
          <span>所属模块</span>
          <pm-select
            v-model="filters.module"
            :options="moduleOptions"
            clearable
            placeholder="全部模块"
          />
        </label>
        <label class="af-field">
          <span>操作结果</span>
          <pm-select
            v-model="filters.result"
            :options="resultOptions"
            clearable
            placeholder="全部结果"
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
          <strong>操作记录</strong>
          <span class="af-status success">审计服务正常</span>
        </div>
        <small style="color:var(--af-text-secondary)">日志保留 180 天</small>
      </div>
      <pm-table :table-data="filteredRows" :columns="columns" show-index>
        <template #result="{row}">
          <span class="af-status" :class="row.result==='成功'?'success':'danger'">{{row.result}}</span>
        </template>
        <template #risk="{row}">
          <span
            class="af-status"
            :class="row.risk==='低'?'neutral':row.risk==='中'?'warning':'danger'"
          >{{row.risk}}风险</span>
        </template>
        <template #action="{row}">
          <button class="af-link" @click="showDetail(row)">详情</button>
        </template>
      </pm-table>
      <div class="af-table-footer">
        <span>共 {{filteredRows.length}} 条日志</span>
        <pm-pagination
          background
          layout="total, prev, pager, next"
          :page-size="10"
          :total="filteredRows.length"
        />
      </div>
    </section>
    <pm-dialog v-model="detailVisible" title="审计日志详情" width="600px">
      <div v-if="current" class="audit-detail">
        <div v-for="item in detailItems" :key="item.label">
          <span>{{item.label}}</span>
          <strong>{{item.value}}</strong>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="detailVisible=false">关闭</el-button>
      </template>
    </pm-dialog>
    </div>
  </div>
</template>
<script setup>
import { computed, reactive, ref } from "vue";
import { Download, Search } from "@element-plus/icons-vue";
const options = values => values.map(value => ({ label: value, value })),
  moduleOptions = options(["应用管理", "组织权限", "平台配置", "安全中心"]),
  resultOptions = options(["成功", "失败"]);
const filters = reactive({ operator: "", module: "", result: "" });
const rows = [
  {
    id: "AUD-20261111-9842",
    operator: "周宁 / zhou.ning",
    module: "应用管理",
    action: "发布应用版本",
    target: "订单协同中心 v3.2.1",
    ip: "10.20.8.31",
    time: "2026-11-11 10:42:18",
    result: "成功",
    risk: "低"
  },
  {
    id: "AUD-20261111-9839",
    operator: "陈序 / chen.xu",
    module: "组织权限",
    action: "调整角色权限",
    target: "平台开发者",
    ip: "10.20.8.46",
    time: "2026-11-11 10:31:06",
    result: "成功",
    risk: "中"
  },
  {
    id: "AUD-20261111-9821",
    operator: "未知账号",
    module: "安全中心",
    action: "账号登录",
    target: "admin",
    ip: "172.16.3.201",
    time: "2026-11-11 09:56:42",
    result: "失败",
    risk: "高"
  },
  {
    id: "AUD-20261111-9817",
    operator: "林川 / lin.chuan",
    module: "平台配置",
    action: "更新数据源",
    target: "客户数据平台",
    ip: "10.20.8.52",
    time: "2026-11-11 09:22:13",
    result: "成功",
    risk: "中"
  },
  {
    id: "AUD-20261111-9803",
    operator: "系统任务",
    module: "应用管理",
    action: "同步运行状态",
    target: "全部应用",
    ip: "127.0.0.1",
    time: "2026-11-11 09:00:00",
    result: "成功",
    risk: "低"
  }
];
const filteredRows = computed(() =>
  rows.filter(
    row =>
      (!filters.operator || row.operator.includes(filters.operator)) &&
      (!filters.module || row.module === filters.module) &&
      (!filters.result || row.result === filters.result)
  )
);
const columns = [
  { prop: "id", label: "日志编号", width: 165 },
  { prop: "operator", label: "操作人", minWidth: 150 },
  { prop: "module", label: "所属模块", width: 110 },
  { prop: "action", label: "操作行为", minWidth: 140 },
  { prop: "target", label: "操作对象", minWidth: 150 },
  { prop: "ip", label: "来源 IP", width: 120 },
  { prop: "time", label: "操作时间", width: 160 },
  { prop: "result", label: "结果", width: 90, scope: "result" },
  { prop: "risk", label: "风险", width: 90, scope: "risk" },
  { prop: "actionCol", label: "操作", width: 80, scope: "action" }
];
const reset = () =>
  Object.assign(filters, { operator: "", module: "", result: "" });
const detailVisible = ref(false),
  current = ref();
const showDetail = row => {
  current.value = row;
  detailVisible.value = true;
};
const detailItems = computed(() =>
  current.value
    ? Object.entries({
        日志编号: current.value.id,
        操作人: current.value.operator,
        所属模块: current.value.module,
        操作行为: current.value.action,
        操作对象: current.value.target,
        "来源 IP": current.value.ip,
        操作时间: current.value.time,
        操作结果: current.value.result,
        风险级别: `${current.value.risk}风险`
      }).map(([label, value]) => ({ label, value }))
    : []
);
</script>
<style scoped>
.audit-detail {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px 22px;
}
.audit-detail div {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--af-border-light);
}
.audit-detail span,
.audit-detail strong {
  display: block;
}
.audit-detail span {
  margin-bottom: 5px;
  color: var(--af-text-secondary);
  font-size: 11px;
}
.audit-detail strong {
  font-size: 13px;
}
@media (max-width: 600px) {
  .audit-detail {
    grid-template-columns: 1fr;
  }
}
</style>
