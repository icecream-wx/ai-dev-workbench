<template>
  <div class="optimized-suite application-type-incident-response">
    <div class="template-stage">
      <div class="business-page tool-page">
    <header class="detail-hero">
      <div class="detail-number">
        <span>异常事件 / INCIDENT</span>
        <strong>{{incident.id}}</strong>
        <p>{{incident.name}}</p>
      </div>
      <div class="heading-actions">
        <span class="status-chip status-danger">{{incident.level}}</span>
        <span class="status-chip status-warning">{{incident.status}}</span>
        <el-button type="primary" @click="handleVisible=true">立即处置</el-button>
      </div>
    </header>
    <div class="detail-grid">
      <main>
        <section class="panel detail-block">
          <h2 class="panel-title">事件概览</h2>
          <div class="info-grid">
            <div v-for="item in info" :key="item.label" class="info-item">
              <span>{{item.label}}</span>
              <strong>{{item.value}}</strong>
            </div>
          </div>
        </section>
        <section class="panel detail-block">
          <h2 class="panel-title">指标快照</h2>
          <div class="snapshot">
            <div>
              <span>当前成功率</span>
              <strong>82.4%</strong>
            </div>
            <div>
              <span>基准成功率</span>
              <strong>99.1%</strong>
            </div>
            <div>
              <span>影响订单</span>
              <strong>1,284</strong>
            </div>
          </div>
        </section>
        <section class="panel detail-block">
          <h2 class="panel-title">操作日志</h2>
          <pm-table :table-data="logs" :columns="logColumns" />
        </section>
      </main>
      <aside class="panel detail-block">
        <h2 class="panel-title">处置时间线</h2>
        <ol class="timeline">
          <li v-for="item in timeline" :key="item.time">
            <strong>{{item.title}}</strong>
            <span>{{item.time}} · {{item.description}}</span>
          </li>
        </ol>
      </aside>
    </div>
    <pm-form-dialog v-model:dialog-visible="handleVisible" title="处置异常事件" width="520px" ok-text="提交处置" @submit="submitHandle">
      <template #form><el-form label-position="top">
        <el-form-item label="处置方式">
          <pm-select size="default" v-model="handler.method" :options="methodOptions" style="width:100%" />
        </el-form-item>
        <el-form-item label="处置说明">
          <pm-textarea size="default" v-model="handler.note" :rows="4" placeholder="记录本次处置过程与结果" />
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

const props = defineProps({
  incident: {
    type: Object,
    default: () => ({
      id: "EVT-260111-089",
      name: "支付成功率连续下降",
      rule: "PAY-SUCCESS-RATE",
      level: "严重",
      source: "支付网关",
      owner: "ops-01",
      occurredAt: "10:38:21",
      status: "待处置"
    })
  }
});
const info = computed(() => [
  { label: "触发规则", value: props.incident.rule },
  { label: "事件来源", value: props.incident.source },
  { label: "责任人", value: props.incident.owner },
  { label: "首次发生", value: `2026-11-11 ${props.incident.occurredAt}` },
  { label: "影响范围", value: "收银台 / 移动端" },
  { label: "关联版本", value: "payment-gateway v3.8.2" }
]);
const timeline = [
  {
    title: "异常首次触发",
    time: "10:38:21",
    description: "成功率跌破 90% 阈值"
  },
  {
    title: "通知责任人",
    time: "10:38:28",
    description: "已发送站内与短信通知"
  },
  {
    title: "自动采集快照",
    time: "10:39:02",
    description: "保存指标与日志上下文"
  },
  { title: "等待人工处置", time: "当前", description: "尚未提交处置结论" }
];
const logs = [
    {
      time: "10:39:02",
      operator: "系统",
      action: "采集诊断快照",
      result: "成功"
    },
    {
      time: "10:38:28",
      operator: "系统",
      action: "通知 ops-01",
      result: "成功"
    },
    {
      time: "10:38:21",
      operator: "规则引擎",
      action: "创建异常事件",
      result: "成功"
    }
  ],
  logColumns = [
    { prop: "time", label: "时间", width: 110 },
    { prop: "operator", label: "操作人", width: 110 },
    { prop: "action", label: "操作内容", minWidth: 170 },
    { prop: "result", label: "结果", width: 90 }
  ];
const handleVisible = ref(false),
  handler = reactive({ method: "切换备用通道", note: "" }),
  methodOptions = [
    "切换备用通道",
    "回滚最近版本",
    "调整规则阈值",
    "确认误报"
  ].map(value => ({ label: value, value }));
const submitHandle = () => {
  if (!handler.note) return ElMessage.warning("请填写处置说明");
  props.incident.status = "处置中";
  handleVisible.value = false;
  ElMessage.success("处置记录已提交");
};
</script>
<style scoped>
.detail-block {
  border-color: var(--template-border);
}
.detail-number p {
  margin: 8px 0 0;
  color: var(--template-text-soft);
}
.snapshot {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.snapshot div {
  padding: 16px;
  border: 1px solid var(--template-border);
  background: var(--template-primary-soft);
}
.snapshot span,
.snapshot strong {
  display: block;
}
.snapshot span {
  font-size: 11px;
  color: var(--template-text-soft);
}
.snapshot strong {
  margin-top: 7px;
  font-size: 23px;
}
@media (max-width: 700px) {
  .snapshot {
    grid-template-columns: 1fr;
  }
}
</style>
