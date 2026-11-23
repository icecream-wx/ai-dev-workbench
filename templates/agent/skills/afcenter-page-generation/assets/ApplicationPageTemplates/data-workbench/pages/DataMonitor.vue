<template>
  <div class="optimized-suite data-workbench">
    <div class="template-stage">
      <div class="business-page monitor-page">
    <header class="page-heading">
      <div><h1>调度监控</h1><p>观察运行吞吐、计算资源与异常实例处理进度</p></div>
      <div class="heading-actions"><span class="monitor-live"><i /> 10 秒前更新</span><el-button :icon="Refresh" @click="refresh">刷新</el-button><pm-select size="default" v-model="range" :options="rangeOptions" style="width: 126px" /></div>
    </header>

    <div class="health-strip">
      <div class="health-summary"><span class="health-orbit"><i /></span><div><strong>计算集群运行健康</strong><small>12 个节点在线，核心服务无降级</small></div></div>
      <dl><div><dt>在线节点</dt><dd>12 / 12</dd></div><div><dt>运行槽位</dt><dd>18 / 24</dd></div><div><dt>消息积压</dt><dd>326</dd></div><div><dt>数据延迟</dt><dd>1.8s</dd></div></dl>
    </div>

    <div class="metrics-grid monitor-metrics">
      <article v-for="metric in metrics" :key="metric.label" class="metric-card">
        <div><span>{{ metric.label }}</span><em :class="metric.tone">{{ metric.badge }}</em></div>
        <strong>{{ metric.value }}</strong><small>{{ metric.note }}</small>
      </article>
    </div>

    <div class="monitor-grid">
      <section class="panel throughput-panel">
        <div class="table-toolbar"><div><h2 class="panel-title">近 7 日运行吞吐</h2><p>成功、失败与等待实例综合趋势</p></div><div class="chart-legend"><span><i class="success" />成功</span><span><i class="danger" />失败</span></div></div>
        <pm-echarts :option="throughputChartOption" height="236px" />
        <div class="chart-foot"><span>峰值 <b>216</b> 次 / 日</span><span>失败率 <b>1.3%</b></span><span>平均等待 <b>18 秒</b></span></div>
      </section>

      <section class="panel resource-panel">
        <div class="table-toolbar"><div><h2 class="panel-title">资源池分配</h2><p>各业务队列实时 CU 使用情况</p></div><span class="status-chip status-success">健康</span></div>
        <div class="resource-total"><div class="resource-donut"><strong>68%</strong><span>总体占用</span></div><div><strong>96 CU</strong><span>总计算容量</span><small>可用 31 CU</small></div></div>
        <div class="queue-bars">
          <div v-for="queue in queues" :key="queue.name"><span><b>{{ queue.name }}</b><em>{{ queue.used }} / {{ queue.total }} CU</em></span><i><b :style="{ width: `${queue.percent}%` }" /></i></div>
        </div>
      </section>
    </div>

    <div class="monitor-lower-grid">
      <section class="panel issue-panel">
        <div class="table-toolbar"><div><h2 class="panel-title">异常运行实例</h2><p>优先处理阻断数据产出的运行错误</p></div><el-button type="primary" plain @click="ElMessage.info('已打开全部异常实例')">查看全部</el-button></div>
        <pm-table :table-data="rows" :columns="columns" :default-sort="{ prop: 'severity', order: 'ascending' }">
          <template #instance="{ row }"><div class="instance-cell"><strong>{{ row.name }}</strong><span>{{ row.instance }} · {{ row.engine }}</span></div></template>
          <template #severity="{ row }"><span class="severity" :class="`severity-${row.severity}`">{{ severityLabel[row.severity] }}</span></template>
          <template #status="{ row }"><span class="status-chip" :class="statusClass(row.status)">{{ row.status }}</span></template>
          <template #action="{ row }"><button class="link-button" @click="retry(row)">重试</button><button class="link-button" @click="openLog(row)">日志</button></template>
        </pm-table>
        <div class="table-footer"><span>当前显示 6 条高关注异常 · 已自动归并同类错误 11 条</span><pm-pagination v-model:current-page="page" background layout="prev, pager, next" :page-size="6" :total="18" /></div>
      </section>

      <aside class="panel event-panel">
        <div class="event-heading"><div><h2>实时运行动态</h2><p>最近 20 分钟</p></div><span>LIVE</span></div>
        <ol class="event-stream">
          <li v-for="event in events" :key="event.time"><i :class="event.tone" /><div><strong>{{ event.title }}</strong><span>{{ event.description }}</span></div><time>{{ event.time }}</time></li>
        </ol>
        <button type="button" class="event-more" @click="ElMessage.info('已展开完整运行动态')">查看完整动态 →</button>
      </aside>
    </div>

    <pm-dialog v-model="logVisible" title="实例诊断日志" width="680px">
      <div v-if="selectedRow" class="log-dialog"><div class="log-summary"><strong>{{ selectedRow.name }}</strong><span>{{ selectedRow.instance }} · {{ selectedRow.owner }} · {{ selectedRow.queue }}</span></div><pre>{{ selectedRow.log }}</pre><div class="diagnosis"><b>诊断建议</b><span>{{ selectedRow.suggestion }}</span></div></div>
      <template #footer><el-button @click="logVisible = false">关闭</el-button><el-button type="primary" @click="retry(selectedRow)">修复后重试</el-button></template>
    </pm-dialog>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'


const range = ref('近 7 日')
const rangeOptions = ['近 7 日', '近 14 日', '近 30 日'].map(value => ({ label: value, value }))
const metrics = [
  { label: '运行实例', value: '1,486', note: '较上周期增加 118 次', badge: '+8.6%', tone: 'up' },
  { label: '成功实例', value: '1,447', note: '成功率保持健康', badge: '97.4%', tone: 'healthy' },
  { label: '队列等待', value: '18s', note: '峰值等待 1m 42s', badge: '-3s', tone: 'healthy' },
  { label: '资源占用', value: '68%', note: '预计 14:00 达到峰值', badge: '31 CU 可用', tone: 'steady' },
]
const chartData = [72, 84, 68, 92, 80, 97, 88]
const chartLabels = ['11/05', '11/06', '11/07', '11/08', '11/09', '11/10', '11/11']
const throughputChartOption = { chartView: { grid: { left: 38, right: 18, top: 22, bottom: 28 }, tooltip: { trigger: 'axis' }, legend: { data: ['成功','失败'] }, xAxis: { type: 'category', data: chartLabels }, yAxis: { type: 'value' }, series: [{ name: '成功', type: 'line', smooth: true, data: chartData.map(value => value * 2), lineStyle: { color: '#07858d' }, itemStyle: { color: '#07858d' } }, { name: '失败', type: 'bar', data: [2,3,1,4,2,3,2], itemStyle: { color: '#ef6c6c' } }] } }
const queues = [
  { name: 'insight-pro', used: 24, total: 32, percent: 75 },
  { name: 'risk-fast', used: 18, total: 24, percent: 75 },
  { name: 'batch-large', used: 16, total: 28, percent: 57 },
  { name: 'standard', used: 7, total: 12, percent: 58 },
]
const rows = ref([
  { id: 1, name: '异常退款订单识别', instance: 'RUN-20261111-031', engine: 'Flink 1.18', startAt: '10:18:31', duration: '2m 17s', owner: '周青', queue: 'risk-fast', severity: 'high', status: '运行失败', reason: '上游字段缺失', retry: 1, log: '[ERROR] Column refund_reason not found in source schema.\n[INFO] Schema version: v42, expected: v43.', suggestion: '同步上游订单退款事实表 v43 字段定义后重新运行。' },
  { id: 2, name: '会员复购趋势分析', instance: 'RUN-20261111-028', engine: 'Spark 3.5', startAt: '10:12:04', duration: '8m 43s', owner: '陈序', queue: 'insight-pro', severity: 'medium', status: '运行超时', reason: '分区扫描超时', retry: 0, log: '[WARN] Stage 18 exceeded timeout 480s.\n[INFO] Scanned partitions: 38 / 42.', suggestion: '提高并行度至 24，或将扫描范围限制为最近 30 天分区。' },
  { id: 3, name: '区域销售达成率日报', instance: 'RUN-20261111-019', engine: 'Spark 3.5', startAt: '10:00:02', duration: '1m 09s', owner: '林默', queue: 'standard', severity: 'high', status: '运行失败', reason: '质量规则阻断', retry: 2, log: '[ERROR] Quality rule QR-018 failed.\n[INFO] null_rate(region_code) = 3.8%, threshold = 1%.', suggestion: '检查华东区域编码空值并完成数据修复，或由数据负责人审批豁免。' },
  { id: 4, name: '商品价格异常检测', instance: 'RUN-20261111-014', engine: 'Flink 1.18', startAt: '09:45:17', duration: '16m 32s', owner: '周青', queue: 'risk-fast', severity: 'medium', status: '告警运行', reason: '数据延迟升高', retry: 0, log: '[WARN] Source lag reached 128 seconds.\n[INFO] Kafka topic: product_price_event.', suggestion: '关注消息队列消费积压，当前实例仍可持续运行。' },
  { id: 5, name: '门店库存周转监控', instance: 'RUN-20261111-008', engine: 'Spark 3.5', startAt: '08:00:09', duration: '7m 52s', owner: '苏禾', queue: 'batch-large', severity: 'low', status: '人工暂停', reason: '输出表维护', retry: 0, log: '[INFO] Instance paused by operator suhe.\n[INFO] Output table is under maintenance.', suggestion: '输出表维护窗口结束后可从检查点继续运行。' },
  { id: 6, name: '支付失败原因归因', instance: 'RUN-20261111-003', engine: 'Flink 1.18', startAt: '07:30:11', duration: '48s', owner: '唐宁', queue: 'risk-fast', severity: 'medium', status: '运行失败', reason: '连接器重试耗尽', retry: 3, log: '[ERROR] ClickHouse connector retry exhausted.\n[INFO] Endpoint response: 503 Service Unavailable.', suggestion: '确认结果库节点可用性，再清理本实例重试计数。' },
])
const columns = [
  { prop: 'name', label: '任务 / 实例', minWidth: 210, scope: 'instance', sortable: true },
  { prop: 'severity', label: '级别', width: 72, scope: 'severity', sortable: true },
  { prop: 'queue', label: '资源队列', width: 104, sortable: true },
  { prop: 'owner', label: '负责人', width: 78, sortable: true },
  { prop: 'duration', label: '耗时', width: 82, sortable: true },
  { prop: 'reason', label: '异常原因', minWidth: 135 },
  { prop: 'status', label: '当前状态', width: 105, scope: 'status', sortable: true },
  { prop: 'action', label: '处置', width: 100, scope: 'action', fixed: 'right', align: 'center' },
]
const severityLabel = { high: 'P1', medium: 'P2', low: 'P3' }
const events = [
  { title: '会员复购趋势分析进入写出阶段', description: '已处理 2.31 亿条记录', time: '10:24', tone: 'success' },
  { title: '异常退款订单识别触发失败', description: '缺少 refund_reason 字段', time: '10:21', tone: 'danger' },
  { title: 'risk-fast 队列完成扩容', description: '运行槽位 6 → 8', time: '10:18', tone: 'primary' },
  { title: '区域销售日报质量规则阻断', description: '区域编码空值率 3.8%', time: '10:06', tone: 'warning' },
  { title: '集群节点 worker-07 恢复', description: '自检与资源注册完成', time: '09:58', tone: 'success' },
]
const page = ref(1)
const logVisible = ref(false)
const selectedRow = ref(null)
const statusClass = status => status === '运行失败' ? 'status-danger' : status === '告警运行' || status === '运行超时' ? 'status-warning' : 'status-neutral'
const refresh = () => ElMessage.success('监控数据已刷新至 10:26:48')
const retry = row => { if (!row) return; row.status = '运行中'; row.retry += 1; logVisible.value = false; ElMessage.success(`${row.instance} 已重新加入 ${row.queue} 队列`) }
const openLog = row => { selectedRow.value = row; logVisible.value = true }
</script>

<style scoped>
.monitor-live{display:inline-flex;align-items:center;gap:6px;color:var(--template-text-soft);font-size:10px}.monitor-live i{width:6px;height:6px;border-radius:50%;background:var(--template-success);box-shadow:0 0 0 3px var(--template-success-soft)}.health-strip{margin-bottom:14px;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:20px;border:1px solid #cce1e5;border-radius:12px;background:linear-gradient(90deg,#edf9f8,#fff);box-shadow:var(--template-shadow)}.health-summary{display:flex;align-items:center;gap:12px}.health-summary strong,.health-summary small{display:block}.health-summary strong{color:var(--template-heading);font-size:13px}.health-summary small{margin-top:3px;color:var(--template-text-soft);font-size:10px}.health-orbit{width:34px;height:34px;display:grid;place-items:center;border:1px solid #96cdd1;border-radius:50%;background:#fff}.health-orbit i{width:10px;height:10px;border-radius:50%;background:var(--template-secondary);box-shadow:0 0 0 5px var(--template-secondary-soft)}.health-strip dl{margin:0;display:grid;grid-template-columns:repeat(4,1fr);gap:24px}.health-strip dl div{min-width:72px}.health-strip dt{color:var(--template-text-soft);font-size:9px}.health-strip dd{margin:3px 0 0;color:var(--template-heading);font-size:12px;font-weight:700}.monitor-metrics .metric-card{padding:14px 16px}.monitor-metrics .metric-card>div{display:flex;align-items:center;justify-content:space-between}.monitor-metrics em{padding:3px 6px;border-radius:99px;color:var(--template-primary);background:var(--template-primary-soft);font-size:8px;font-style:normal;font-weight:700}.monitor-metrics em.healthy{color:var(--template-success);background:var(--template-success-soft)}.monitor-metrics em.steady{color:var(--template-secondary);background:var(--template-secondary-soft)}.monitor-metrics .metric-card strong{font-size:23px}.monitor-metrics .metric-card small{font-size:10px}.monitor-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(310px,.72fr);gap:14px}.monitor-grid .panel,.monitor-lower-grid .panel{margin-bottom:14px}.throughput-panel .table-toolbar>div>p,.resource-panel .table-toolbar>div>p,.issue-panel .table-toolbar>div>p{margin:4px 0 0;color:var(--template-text-soft);font-size:10px}.throughput-panel .panel-title,.resource-panel .panel-title,.issue-panel .panel-title{margin:0}.chart-legend{display:flex;gap:12px;color:var(--template-text-soft);font-size:9px}.chart-legend span{display:flex;align-items:center;gap:5px}.chart-legend i{width:7px;height:7px;border-radius:2px}.chart-legend i.success{background:var(--template-primary)}.chart-legend i.danger{background:var(--template-danger)}.chart-foot{padding-top:11px;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--template-border-light);color:var(--template-text-soft);font-size:9px}.chart-foot span{text-align:center}.chart-foot b{color:var(--template-heading)}.resource-total{margin:4px 0 18px;padding:12px;display:flex;align-items:center;gap:18px;border-radius:10px;background:var(--template-surface-soft)}.resource-donut{width:84px;height:84px;display:grid;place-content:center;text-align:center;border:9px solid var(--template-primary-soft);border-top-color:var(--template-secondary);border-right-color:var(--template-primary);border-radius:50%}.resource-donut strong{font-size:19px}.resource-donut span{color:var(--template-text-soft);font-size:8px}.resource-total>div:last-child strong,.resource-total>div:last-child span,.resource-total>div:last-child small{display:block}.resource-total>div:last-child strong{font-size:16px}.resource-total>div:last-child span{margin-top:3px;color:var(--template-text-soft);font-size:9px}.resource-total>div:last-child small{margin-top:8px;color:var(--template-success);font-size:9px}.queue-bars{display:grid;gap:12px}.queue-bars>div>span{margin-bottom:5px;display:flex;justify-content:space-between}.queue-bars b{font-size:10px}.queue-bars em{color:var(--template-text-soft);font-size:9px;font-style:normal}.queue-bars>div>i{height:6px;display:block;overflow:hidden;border-radius:99px;background:var(--template-border-light)}.queue-bars>div>i b{height:100%;display:block;border-radius:inherit;background:linear-gradient(90deg,var(--template-primary),var(--template-secondary))}.monitor-lower-grid{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:14px}.issue-panel{min-width:0}.instance-cell strong,.instance-cell span{display:block}.instance-cell strong{color:var(--template-heading);font-size:11px}.instance-cell span{margin-top:3px;color:var(--template-text-soft);font-size:9px}.severity{width:30px;height:20px;display:inline-grid;place-items:center;border-radius:6px;font-size:9px;font-weight:800}.severity-high{color:var(--template-danger);background:var(--template-danger-soft)}.severity-medium{color:var(--template-warning);background:var(--template-warning-soft)}.severity-low{color:var(--template-neutral);background:var(--template-neutral-soft)}.event-panel{padding:16px}.event-heading{margin-bottom:16px;display:flex;align-items:center;justify-content:space-between}.event-heading h2,.event-heading p{margin:0}.event-heading h2{font-size:15px}.event-heading p{margin-top:3px;color:var(--template-text-soft);font-size:9px}.event-heading>span{padding:3px 6px;color:var(--template-danger);border-radius:99px;background:var(--template-danger-soft);font-size:8px;font-weight:800}.event-stream{margin:0;padding:0;list-style:none}.event-stream li{position:relative;padding:0 0 17px 17px;display:grid;grid-template-columns:1fr auto;gap:6px;border-left:1px solid var(--template-border)}.event-stream li:last-child{padding-bottom:6px;border-left-color:transparent}.event-stream li>i{position:absolute;top:2px;left:-4px;width:7px;height:7px;border:2px solid #fff;border-radius:50%;background:var(--template-primary)}.event-stream li>i.success{background:var(--template-success)}.event-stream li>i.danger{background:var(--template-danger)}.event-stream li>i.warning{background:var(--template-warning)}.event-stream strong,.event-stream span{display:block}.event-stream strong{font-size:10px;line-height:1.4}.event-stream span{margin-top:3px;color:var(--template-text-soft);font-size:8px}.event-stream time{color:var(--template-text-soft);font-size:8px}.event-more{width:100%;padding:9px;color:var(--template-primary);border:0;border-radius:8px;background:var(--template-primary-soft);font-size:10px;cursor:pointer}.log-summary{margin-bottom:12px}.log-summary strong,.log-summary span{display:block}.log-summary strong{font-size:14px}.log-summary span{margin-top:4px;color:var(--template-text-soft);font-size:10px}.log-dialog pre{margin:0;padding:15px;overflow:auto;color:#b9d6f0;border-radius:9px;background:#10243f;font:11px/1.7 Consolas,monospace}.diagnosis{margin-top:12px;padding:12px;display:flex;gap:10px;border-radius:9px;background:var(--template-warning-soft);font-size:10px}.diagnosis b{color:var(--template-warning);white-space:nowrap}.diagnosis span{color:#66522d;line-height:1.6}
@media(max-width:1080px){.monitor-grid,.monitor-lower-grid{grid-template-columns:1fr}.event-panel{order:-1}.event-stream{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.event-stream li{border-left:0;border-bottom:1px solid var(--template-border-light)}}
@media(max-width:760px){.health-strip{align-items:flex-start;flex-direction:column}.health-strip dl{width:100%;grid-template-columns:repeat(2,1fr);gap:10px}.event-stream{grid-template-columns:1fr}.monitor-metrics{grid-template-columns:repeat(2,1fr)}}
</style>
