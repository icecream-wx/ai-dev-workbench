<template>
  <div class="optimized-suite application-type-incident-response">
    <div class="template-stage">
      <div class="business-page tool-page">
    <header class="page-heading incident-command-heading">
      <div>
        <h1>异常事件指挥台</h1>
        <p>集中监控规则触发、处置状态和责任归属</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="createVisible=true">新建异常</el-button>
    </header>
    <div class="incident-command-layout">
      <aside class="incident-signal-rail">
        <span class="rail-label">SIGNAL LEVEL</span>
        <button v-for="(level,index) in levels" :key="level" type="button" :class="{active:activeLevel===level}" @click="activeLevel=level">
          <i>0{{index + 1}}</i><span>{{level}}</span><b>{{countLevel(level)}}</b>
        </button>
        <div class="rail-health"><span>MONITOR HEALTH</span><strong>99.98%</strong><small>采集链路正常</small></div>
      </aside>
      <main class="incident-stream">
        <section class="incident-search-deck">
          <div><span>事件定位</span><strong>{{filteredRows.length}} 条活动信号</strong></div>
          <pm-search v-model:query="searchQuery" default-prop="keyword" placeholder="搜索事件 / 规则 / 操作人" @search="currentPage=1">
            <template #body><el-form-item label="处置状态" prop="status"><pm-select size="default" v-model="searchQuery.status" :options="statusOptions" clearable placeholder="全部状态" /></el-form-item></template>
          </pm-search>
        </section>
        <section class="panel block-table">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <b>LIVE EVENT STREAM</b>
          <span class="stream-pulse"><i />持续接收中</span>
        </div>
        <small>最近更新：刚刚</small>
      </div>
      <pm-table
        :table-data="pagedRows"
        :columns="columns"
        @row-click="row=>$emit('open-detail',row)"
      >
        <template #level="{row}">
          <span class="status-chip" :class="levelClass(row.level)">{{row.level}}</span>
        </template>
        <template #status="{row}">
          <span class="status-chip" :class="statusClass(row.status)">{{row.status}}</span>
        </template>
        <template #action="{row}">
          <button class="tool-action" @click.stop="$emit('open-detail',row)">详情</button>
          <button class="tool-action" @click.stop="closeIncident(row)">处置</button>
        </template>
      </pm-table>
      <div class="table-footer">
        <span>共 {{filteredRows.length}} 条事件</span>
        <pm-pagination
          v-model:current-page="currentPage"
          background
          layout="prev, pager, next"
          :page-size="pageSize"
          :total="filteredRows.length"
        />
      </div>
        </section>
      </main>
    </div>
    <pm-form-dialog v-model:dialog-visible="createVisible" title="快速新建异常" width="500px" ok-text="创建事件" @submit="create">
      <template #form><el-form label-position="top">
        <el-form-item label="异常名称" required>
          <pm-input size="default" v-model="quick.name" />
        </el-form-item>
        <el-form-item label="严重级别">
          <pm-select
            size="default"
            v-model="quick.level"
            :options="levels.slice(1).map(value=>({label:value,value}))"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="异常描述">
          <pm-textarea size="default" v-model="quick.description" :rows="3" />
        </el-form-item>
      </el-form></template>
    </pm-form-dialog>
      </div>
    </div>
  </div>
</template>
<script setup>
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Plus } from "@element-plus/icons-vue";

defineEmits(["open-detail"]);
const levels = ["全部", "严重", "警告", "提示"];
const activeLevel = ref("全部");
const searchQuery = ref({ keyword: "", status: "" });
const statusOptions = ["待处置", "处置中", "已恢复"].map(value => ({
  label: value,
  value
}));
const rows = ref([
  {
    id: "EVT-260111-089",
    name: "支付成功率连续下降",
    rule: "PAY-SUCCESS-RATE",
    level: "严重",
    source: "支付网关",
    owner: "ops-01",
    occurredAt: "10:38:21",
    status: "待处置"
  },
  {
    id: "EVT-260111-088",
    name: "订单接口 P95 延迟过高",
    rule: "ORDER-P95-LATENCY",
    level: "警告",
    source: "订单服务",
    owner: "dev-zhou",
    occurredAt: "10:31:06",
    status: "处置中"
  },
  {
    id: "EVT-260111-083",
    name: "会员同步任务积压",
    rule: "MEMBER-SYNC-BACKLOG",
    level: "提示",
    source: "调度中心",
    owner: "dev-lin",
    occurredAt: "09:56:42",
    status: "已恢复"
  },
  {
    id: "EVT-260111-077",
    name: "退款金额波动异常",
    rule: "REFUND-AMOUNT-WAVE",
    level: "警告",
    source: "风控中心",
    owner: "ops-02",
    occurredAt: "09:22:13",
    status: "待处置"
  },
  {
    id: "EVT-260111-071",
    name: "库存同步消息堆积",
    rule: "STOCK-MQ-BACKLOG",
    level: "严重",
    source: "库存服务",
    owner: "dev-wu",
    occurredAt: "08:48:39",
    status: "处置中"
  },
  {
    id: "EVT-260111-065",
    name: "营销回调失败率升高",
    rule: "MKT-CALLBACK-FAIL",
    level: "提示",
    source: "营销中心",
    owner: "ops-03",
    occurredAt: "08:10:04",
    status: "已恢复"
  }
]);
const columns = [
  { prop: "id", label: "事件编号", width: 145 },
  { prop: "name", label: "异常事件", minWidth: 190 },
  { prop: "level", label: "级别", width: 90, scope: "level" },
  { prop: "source", label: "来源", width: 110 },
  { prop: "owner", label: "负责人", width: 100 },
  { prop: "occurredAt", label: "发生时间", width: 100 },
  { prop: "status", label: "状态", width: 100, scope: "status" },
  { prop: "action", label: "操作", width: 120, scope: "action" }
];
const filteredRows = computed(() =>
  rows.value.filter(
    row =>
      (activeLevel.value === "全部" || row.level === activeLevel.value) &&
      (!searchQuery.value.keyword ||
        `${row.name}${row.rule}${row.owner}`.includes(searchQuery.value.keyword)) &&
      (!searchQuery.value.status || row.status === searchQuery.value.status)
  )
);
const currentPage = ref(1),
  pageSize = 5,
  pagedRows = computed(() =>
    filteredRows.value.slice(
      (currentPage.value - 1) * pageSize,
      currentPage.value * pageSize
    )
  );
const countLevel = level =>
  level === "全部"
    ? rows.value.length
    : rows.value.filter(row => row.level === level).length;
const levelClass = level =>
  level === "严重"
    ? "status-danger"
    : level === "警告"
    ? "status-warning"
    : "status-neutral";
const statusClass = value =>
  value === "已恢复"
    ? "status-success"
    : value === "处置中"
    ? "status-warning"
    : "status-danger";
const closeIncident = row => {
  row.status = "处置中";
  ElMessage.success(`${row.id} 已进入处置流程`);
};
const createVisible = ref(false),
  quick = reactive({ name: "", level: "警告", description: "" });
const create = () => {
  if (!quick.name) return ElMessage.warning("请输入异常名称");
  rows.value.unshift({
    id: `EVT-${Date.now()
      .toString()
      .slice(-6)}`,
    name: quick.name,
    rule: "MANUAL-EVENT",
    level: quick.level,
    source: "人工上报",
    owner: "当前用户",
    occurredAt: "刚刚",
    status: "待处置"
  });
  createVisible.value = false;
  quick.name = "";
  ElMessage.success("异常事件已创建");
};
</script>
<style scoped>
.incident-command-heading{margin-bottom:16px;padding:4px 0 14px;border-bottom:1px solid var(--template-border)}.incident-command-heading h1{font-size:22px;font-weight:800}
.incident-command-layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:14px;align-items:start}.incident-signal-rail{position:sticky;top:12px;border:1px solid var(--template-border);background:var(--template-surface)}.rail-label{padding:13px 14px;display:block;color:var(--template-primary-contrast);background:var(--template-heading);font-size:9px;font-weight:800;letter-spacing:.14em}.incident-signal-rail>button{width:100%;height:54px;padding:0 12px;display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:7px;color:var(--template-heading);text-align:left;border:0;border-bottom:1px solid var(--template-border);background:var(--template-surface);cursor:pointer}.incident-signal-rail>button i{color:var(--template-text-soft);font-size:9px;font-style:normal}.incident-signal-rail>button span{font-weight:750}.incident-signal-rail>button b{min-width:24px;padding:3px 5px;text-align:center;border:1px solid var(--template-border);background:var(--template-surface-soft);font-size:10px}.incident-signal-rail>button.active{background:var(--template-primary)}.rail-health{padding:18px 14px}.rail-health span,.rail-health strong,.rail-health small{display:block}.rail-health span{font-size:8px;font-weight:800;letter-spacing:.12em}.rail-health strong{margin-top:7px;font-size:22px}.rail-health small{margin-top:3px;color:var(--template-text-soft)}.incident-stream{min-width:0}.incident-search-deck{margin-bottom:14px;padding:14px 16px;display:grid;grid-template-columns:170px minmax(0,1fr);gap:18px;align-items:center;border:1px solid var(--template-border);background:var(--template-primary-soft)}.incident-search-deck>div span,.incident-search-deck>div strong{display:block}.incident-search-deck>div span{font-size:9px;font-weight:800;letter-spacing:.1em}.incident-search-deck>div strong{margin-top:5px;font-size:13px}.incident-search-deck :deep(.pm-search-body){margin-top:8px}.incident-search-deck :deep(.pm-search-body .el-form-item){width:180px}.incident-search-deck :deep(.el-form-item__label){font-size:10px}.stream-pulse{padding:4px 7px;border:1px solid var(--template-border);background:var(--template-surface);font-size:9px}.stream-pulse i{width:6px;height:6px;margin-right:5px;display:inline-block;background:var(--template-primary)}
.tool-kicker {
  margin: 0 0 4px !important;
  color: var(--template-primary-dark) !important;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.tag-filter {
  margin-bottom: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag-filter button {
  height: 36px;
  padding: 0 14px;
  color:var(--template-heading);
  border: 1px solid var(--template-border);
  border-radius: 2px;
  background:var(--template-surface);
  cursor: pointer;
}
.tag-filter button.active {
  background: var(--template-primary);
}
.tag-filter b {
  margin-left: 8px;
  font-size: 10px;
}
.tool-action {
  height: 26px;
  margin-right: 5px;
  padding: 0 8px;
  color:var(--template-heading);
  border: 1px solid var(--template-border);
  border-radius: 2px;
  background:var(--template-surface);
  cursor: pointer;
}
.tool-action:hover {
  border-color: var(--template-primary-dark);
  background: var(--template-primary-soft);
}
.block-table {
  border-color: var(--template-border);
}
@media(max-width:900px){.incident-command-layout{grid-template-columns:1fr}.incident-signal-rail{position:static;display:grid;grid-template-columns:repeat(4,1fr)}.rail-label,.rail-health{display:none}.incident-signal-rail>button{border-right:1px solid var(--template-border)}}
@media(max-width:640px){.incident-search-deck{grid-template-columns:1fr}.incident-signal-rail{grid-template-columns:repeat(2,1fr)}}
</style>
