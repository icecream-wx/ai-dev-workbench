<template>
  <div class="optimized-suite data-workbench">
    <div class="template-stage">
      <div class="business-page data-canvas-page">
    <header class="page-heading data-canvas-heading">
      <div>
        <h1>分析任务</h1>
        <p>统一查看任务编排、调度状态与数据产出</p>
      </div>
      <div class="canvas-live"><i /> 调度服务正常 <span>队列等待 {{ queueCount }} 个</span></div>
    </header>

    <div class="data-canvas-layout">
      <main class="data-canvas-main">
        <div class="metrics-grid canvas-metrics">
          <article v-for="(metric, index) in metrics" :key="metric.label" class="metric-card" :class="metric.tone">
            <div><span>{{ metric.label }}</span><b>0{{ index + 1 }}</b></div>
            <strong>{{ metric.value }}</strong>
            <small>{{ metric.note }}</small>
          </article>
        </div>

        <section class="panel canvas-task-panel">
          <div class="table-toolbar task-toolbar">
            <div class="table-toolbar-left">
              <div><small>WORK QUEUE</small><h2>任务运行队列</h2></div>
              <pm-radio-group size="default" v-model="viewMode" :settings="viewModeSettings" option-type="button" />
            </div>
            <div class="table-toolbar-right">
              <span class="queue-count">{{ filteredRows.length }} TASKS</span>
              <el-button type="primary" plain @click="batchRun">批量运行</el-button>
              <pm-pagination class="queue-pager" v-model:current-page="currentPage" background layout="prev, pager, next" :page-size="pageSize" :total="filteredRows.length" />
            </div>
          </div>

          <pm-table v-if="viewMode === 'table'" :table-data="pagedRows" :columns="columns" :default-sort="{ prop: 'progress', order: 'descending' }" @row-click="showDetail">
            <template #task="{ row }">
              <div class="task-name-cell"><strong>{{ row.name }}</strong><span>{{ row.code }} · {{ row.type }}</span></div>
            </template>
            <template #schedule="{ row }">
              <div class="schedule-cell"><strong>{{ row.schedule }}</strong><span>{{ row.lastRun }}</span></div>
            </template>
            <template #progress="{ row }">
              <div class="progress-cell"><span><i :style="{ width: `${row.progress}%` }" /></span><b>{{ row.progress }}%</b></div>
            </template>
            <template #status="{ row }"><span class="status-chip" :class="statusClass(row.status)">{{ row.status }}</span></template>
            <template #action="{ row }">
              <button class="link-button" @click.stop="showDetail(row)">详情</button>
              <button class="link-button" @click.stop="run(row)">{{ row.status === '运行中' ? '查看' : '运行' }}</button>
            </template>
          </pm-table>

          <div v-else class="task-card-grid">
            <article v-for="row in pagedRows" :key="row.id" class="task-card" @click="showDetail(row)">
              <header><span class="status-chip" :class="statusClass(row.status)">{{ row.status }}</span><small>{{ row.code }}</small></header>
              <h3>{{ row.name }}</h3>
              <p>{{ row.dataset }}</p>
              <div class="card-progress"><span><i :style="{ width: `${row.progress}%` }" /></span><b>{{ row.progress }}%</b></div>
              <dl><div><dt>负责人</dt><dd>{{ row.owner }}</dd></div><div><dt>调度</dt><dd>{{ row.schedule }}</dd></div><div><dt>耗时</dt><dd>{{ row.duration }}</dd></div></dl>
            </article>
          </div>

          <div class="table-footer">
            <span>显示 {{ pagedRows.length }} / {{ filteredRows.length }} 个任务 · 最近同步 10:26:48</span>
            <div class="table-legend"><span><i class="running" />运行中</span><span><i class="success" />已完成</span><span><i class="failed" />异常</span></div>
          </div>
        </section>
      </main>

      <aside class="data-control-rail">
        <section class="control-module search-module">
          <span class="module-label">01 · 定位任务</span>
          <pm-search v-model:query="filters" default-prop="name" placeholder="搜索任务名称 / 编号" @search="currentPage = 1">
            <template #body>
              <el-form-item label="任务类型" prop="type"><pm-select size="default" v-model="filters.type" :options="typeOptions" clearable placeholder="全部类型" /></el-form-item>
              <el-form-item label="运行状态" prop="status"><pm-select size="default" v-model="filters.status" :options="statusOptions" clearable placeholder="全部状态" /></el-form-item>
              <el-form-item label="负责人" prop="owner"><pm-select size="default" v-model="filters.owner" :options="ownerOptions" clearable placeholder="全部负责人" /></el-form-item>
            </template>
          </pm-search>
          <el-button :icon="Filter" @click="advancedVisible = true">更多运行条件</el-button>
        </section>

        <section class="control-module pipeline-module">
          <div class="module-heading"><span class="module-label">02 · 活跃管道</span><b>3 / 8</b></div>
          <ol>
            <li v-for="item in pipelines" :key="item.name">
              <i :style="{ height: `${item.progress}%` }" />
              <div><strong>{{ item.name }}</strong><span>{{ item.stage }}</span></div>
              <b>{{ item.progress }}%</b>
            </li>
          </ol>
        </section>

        <section class="control-module resource-module">
          <div class="module-heading"><span class="module-label">03 · 计算资源</span><b class="healthy">健康</b></div>
          <div class="resource-ring"><strong>68%</strong><span>CU 使用率</span></div>
          <dl><div><dt>运行槽位</dt><dd>18 / 24</dd></div><div><dt>等待时长</dt><dd>18 秒</dd></div><div><dt>今日用量</dt><dd>384 CUh</dd></div></dl>
        </section>

        <el-button class="create-task-button" type="primary" :icon="Plus" @click="createTask">新建分析任务</el-button>
      </aside>
    </div>

    <pm-dialog v-model="advancedVisible" title="高级运行筛选" width="560px">
      <el-form label-position="top" class="dialog-form-grid">
        <el-form-item label="任务优先级"><pm-select size="default" v-model="advanced.priority" :options="priorityOptions" clearable style="width: 100%" /></el-form-item>
        <el-form-item label="资源队列"><pm-select size="default" v-model="advanced.queue" :options="queueOptions" clearable style="width: 100%" /></el-form-item>
        <el-form-item label="最近运行日期"><pm-date-picker size="default" v-model="advanced.date" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="最长耗时"><pm-select size="default" v-model="advanced.duration" :options="durationOptions" clearable style="width: 100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="advancedVisible = false">取消</el-button><el-button type="primary" @click="applyAdvanced">应用筛选</el-button></template>
    </pm-dialog>

    <pm-dialog v-model="detailVisible" title="任务运行摘要" width="620px">
      <div v-if="currentTask" class="task-dialog">
        <div class="dialog-task-title"><div><strong>{{ currentTask.name }}</strong><span>{{ currentTask.code }} · {{ currentTask.type }}</span></div><span class="status-chip" :class="statusClass(currentTask.status)">{{ currentTask.status }}</span></div>
        <div class="info-grid">
          <div class="info-item"><span>数据集</span><strong>{{ currentTask.dataset }}</strong></div>
          <div class="info-item"><span>负责人</span><strong>{{ currentTask.owner }}</strong></div>
          <div class="info-item"><span>调度周期</span><strong>{{ currentTask.schedule }}</strong></div>
          <div class="info-item"><span>上次运行</span><strong>{{ currentTask.lastRun }}</strong></div>
          <div class="info-item"><span>平均耗时</span><strong>{{ currentTask.duration }}</strong></div>
          <div class="info-item"><span>资源队列</span><strong>{{ currentTask.queue }}</strong></div>
        </div>
      </div>
      <template #footer><el-button @click="detailVisible = false">关闭</el-button><el-button type="primary" @click="run(currentTask)">立即运行</el-button></template>
    </pm-dialog>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Filter, Plus } from '@element-plus/icons-vue'


const metrics = [
  { label: '今日运行', value: '186', note: '较昨日 +12.6%', tone: 'metric-primary' },
  { label: '运行成功率', value: '98.7%', note: '连续稳定 14 天', tone: 'metric-success' },
  { label: '平均耗时', value: '4m 12s', note: '较上周缩短 38 秒', tone: 'metric-secondary' },
  { label: '待处理告警', value: '6', note: '高优先级 1 条', tone: 'metric-warning' },
]
const pipelines = [
  { name: '会员复购趋势', stage: '聚合 18 个交易分区', progress: 76 },
  { name: '区域销售日报', stage: '等待质量规则检查', progress: 48 },
  { name: '退款风险识别', stage: '加载实时特征模型', progress: 31 },
]
const rows = ref([
  { id: 1, code: 'AN-2048', name: '会员复购趋势分析', type: '用户洞察', dataset: '会员交易明细宽表', owner: '陈序', status: '运行中', schedule: '每日 08:00', lastRun: '今天 10:18', duration: '4m 16s', progress: 76, priority: '高', queue: 'insight-pro' },
  { id: 2, code: 'AN-2037', name: '区域销售达成率日报', type: '经营分析', dataset: '区域经营指标集', owner: '林默', status: '已完成', schedule: '每小时', lastRun: '今天 10:00', duration: '1m 09s', progress: 100, priority: '中', queue: 'standard' },
  { id: 3, code: 'AN-2029', name: '异常退款订单识别', type: '风险识别', dataset: '订单退款事实表', owner: '周青', status: '运行失败', schedule: '实时触发', lastRun: '今天 09:31', duration: '2m 17s', progress: 63, priority: '高', queue: 'risk-fast' },
  { id: 4, code: 'AN-2018', name: '高价值客户流失预警', type: '用户洞察', dataset: '客户标签主题集', owner: '陈序', status: '等待调度', schedule: '每日 09:30', lastRun: '昨天 09:34', duration: '6m 28s', progress: 0, priority: '高', queue: 'insight-pro' },
  { id: 5, code: 'AN-1996', name: '渠道投放回报分析', type: '经营分析', dataset: '营销归因数据集', owner: '林默', status: '已完成', schedule: '每日 07:30', lastRun: '今天 07:36', duration: '5m 42s', progress: 100, priority: '中', queue: 'standard' },
  { id: 6, code: 'AN-1983', name: '门店库存周转监控', type: '经营分析', dataset: '门店库存日快照', owner: '苏禾', status: '已完成', schedule: '每日 06:00', lastRun: '今天 06:08', duration: '7m 52s', progress: 100, priority: '中', queue: 'batch-large' },
  { id: 7, code: 'AN-1964', name: '商品价格异常波动检测', type: '风险识别', dataset: '商品价格变更流水', owner: '周青', status: '运行中', schedule: '每 30 分钟', lastRun: '今天 10:15', duration: '2m 38s', progress: 54, priority: '高', queue: 'risk-fast' },
  { id: 8, code: 'AN-1942', name: '用户活跃度分层更新', type: '用户洞察', dataset: '用户行为主题宽表', owner: '唐宁', status: '等待调度', schedule: '每日 11:00', lastRun: '昨天 11:06', duration: '5m 11s', progress: 0, priority: '中', queue: 'insight-pro' },
  { id: 9, code: 'AN-1917', name: '供应商履约质量评分', type: '经营分析', dataset: '采购履约事实表', owner: '苏禾', status: '已暂停', schedule: '每周一 07:00', lastRun: '11-09 07:12', duration: '11m 20s', progress: 0, priority: '低', queue: 'batch-large' },
  { id: 10, code: 'AN-1886', name: '支付失败原因归因', type: '风险识别', dataset: '支付链路事件流', owner: '唐宁', status: '已完成', schedule: '每小时', lastRun: '今天 10:02', duration: '48s', progress: 100, priority: '中', queue: 'risk-fast' },
  { id: 11, code: 'AN-1855', name: '会员等级变更审计', type: '用户洞察', dataset: '会员等级变更记录', owner: '陈序', status: '已完成', schedule: '每日 02:00', lastRun: '今天 02:03', duration: '2m 54s', progress: 100, priority: '低', queue: 'standard' },
  { id: 12, code: 'AN-1824', name: '城市群消费趋势预测', type: '经营分析', dataset: '城市消费指标集', owner: '林默', status: '等待调度', schedule: '每周一 08:30', lastRun: '11-09 08:41', duration: '9m 36s', progress: 0, priority: '中', queue: 'batch-large' },
])

const filters = ref({ name: '', type: '', status: '', owner: '' })
const optionize = values => values.map(value => ({ label: value, value }))
const typeOptions = optionize(['用户洞察', '经营分析', '风险识别'])
const statusOptions = optionize(['运行中', '已完成', '运行失败', '等待调度', '已暂停'])
const ownerOptions = optionize(['陈序', '林默', '周青', '苏禾', '唐宁'])
const priorityOptions = optionize(['高', '中', '低'])
const queueOptions = optionize(['insight-pro', 'standard', 'risk-fast', 'batch-large'])
const durationOptions = optionize(['1 分钟以内', '5 分钟以内', '10 分钟以内', '10 分钟以上'])
const columns = [
  { prop: 'name', label: '任务名称 / 编号', minWidth: 210, scope: 'task', sortable: true },
  { prop: 'dataset', label: '输入数据集', minWidth: 165, sortable: true },
  { prop: 'owner', label: '负责人', width: 82, sortable: true },
  { prop: 'schedule', label: '调度 / 上次运行', width: 135, scope: 'schedule' },
  { prop: 'progress', label: '当前进度', width: 122, scope: 'progress', sortable: true },
  { prop: 'status', label: '运行状态', width: 102, scope: 'status', sortable: true },
  { prop: 'action', label: '快捷操作', width: 110, scope: 'action', fixed: 'right', align: 'center' },
]
const filteredRows = computed(() => rows.value.filter(row => {
  const keyword = filters.value.name.trim()
  return (!keyword || row.name.includes(keyword) || row.code.toLowerCase().includes(keyword.toLowerCase()))
    && (!filters.value.type || row.type === filters.value.type)
    && (!filters.value.status || row.status === filters.value.status)
    && (!filters.value.owner || row.owner === filters.value.owner)
}))
const currentPage = ref(1)
const pageSize = 6
const pagedRows = computed(() => filteredRows.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize))
const queueCount = computed(() => rows.value.filter(row => row.status === '等待调度').length)
const viewMode = ref('table')
const viewModeSettings = {
  type: 'custom',
  options: [
    { label: '表格', value: 'table' },
    { label: '卡片', value: 'card' },
  ],
}
const advancedVisible = ref(false)
const advanced = reactive({ priority: '', queue: '', date: '', duration: '' })
const detailVisible = ref(false)
const currentTask = ref(null)

const statusClass = status => ({
  运行中: 'status-warning',
  已完成: 'status-success',
  运行失败: 'status-danger',
  等待调度: 'status-neutral',
  已暂停: 'status-neutral',
}[status])
const showDetail = row => { currentTask.value = row; detailVisible.value = true }
const run = row => {
  if (!row) return
  row.status = '运行中'
  row.progress = Math.max(row.progress, 8)
  detailVisible.value = false
  ElMessage.success(`${row.name} 已加入运行队列`)
}
const batchRun = () => ElMessage.success(`已将 ${Math.min(3, filteredRows.value.length)} 个任务加入运行队列`)
const applyAdvanced = () => { advancedVisible.value = false; currentPage.value = 1; ElMessage.success('高级筛选条件已应用') }
const createTask = () => ElMessage.info('请从“新建分析任务”页面创建任务')
</script>

<style scoped>
.data-canvas-heading{margin-bottom:14px}.canvas-live{display:flex;align-items:center;gap:7px;color:var(--template-primary);font-size:11px;font-weight:700}.canvas-live i{width:7px;height:7px;border-radius:50%;background:var(--template-secondary);box-shadow:0 0 0 4px rgba(7,133,141,.12)}.canvas-live span{padding-left:8px;color:var(--template-text-soft);border-left:1px solid var(--template-border);font-weight:500}.data-canvas-layout{display:grid;grid-template-columns:minmax(0,1fr) 292px;gap:16px;align-items:start}.data-canvas-main{min-width:0}.canvas-metrics{grid-template-columns:repeat(4,1fr)}.canvas-metrics .metric-card{padding:15px 16px}.canvas-metrics .metric-card>div{display:flex;align-items:center;justify-content:space-between}.canvas-metrics .metric-card>div b{color:#b9cce0;font-size:11px}.canvas-metrics .metric-card strong{margin-top:7px;font-size:23px}.canvas-metrics .metric-card small{font-size:10px}.canvas-task-panel{margin:0;padding:16px;border-radius:14px}.task-toolbar{margin-bottom:12px}.task-toolbar .table-toolbar-left>div small{color:var(--template-secondary);font-size:9px;font-weight:800;letter-spacing:.12em}.task-toolbar h2{margin:2px 10px 0 0;color:var(--template-heading);font-size:16px}.queue-count{padding:5px 8px;color:var(--template-primary);border-radius:999px;background:var(--template-primary-soft);font-size:9px;font-weight:800}.queue-pager{padding-left:8px;border-left:1px solid var(--template-border)}.task-name-cell strong,.task-name-cell span,.schedule-cell strong,.schedule-cell span{display:block}.task-name-cell strong{color:var(--template-heading);font-size:12px}.task-name-cell span,.schedule-cell span{margin-top:3px;color:var(--template-text-soft);font-size:10px}.schedule-cell strong{font-size:11px}.progress-cell{display:flex;align-items:center;gap:7px}.progress-cell>span,.card-progress>span{height:5px;overflow:hidden;flex:1;border-radius:999px;background:var(--template-border-light)}.progress-cell i,.card-progress i{height:100%;display:block;border-radius:inherit;background:linear-gradient(90deg,var(--template-primary),var(--template-secondary))}.progress-cell b,.card-progress b{color:var(--template-text-soft);font-size:9px}.table-legend{display:flex;align-items:center;gap:12px}.table-legend span{display:flex;align-items:center;gap:5px;font-size:9px}.table-legend i{width:6px;height:6px;border-radius:2px;background:var(--template-neutral)}.table-legend i.running{background:var(--template-warning)}.table-legend i.success{background:var(--template-success)}.table-legend i.failed{background:var(--template-danger)}.data-control-rail{position:sticky;top:12px;display:grid;gap:12px}.control-module{padding:16px;border:1px solid var(--template-border);border-radius:14px;background:rgba(255,255,255,.95);box-shadow:var(--template-shadow)}.module-label{display:block;color:var(--template-secondary);font-size:9px;font-weight:800;letter-spacing:.1em}.module-heading{margin-bottom:14px;display:flex;align-items:center;justify-content:space-between}.module-heading .module-label{margin:0}.module-heading>b{color:var(--template-primary);font-size:10px}.module-heading>.healthy{color:var(--template-success)}.search-module>.module-label{margin-bottom:13px}.search-module :deep(.pm-search-body){display:grid;grid-template-columns:1fr;gap:10px}.search-module>:deep(.el-button){width:100%;margin-top:10px}.pipeline-module ol{margin:0;padding:0;display:grid;gap:14px;list-style:none}.pipeline-module li{position:relative;display:grid;grid-template-columns:4px 1fr auto;gap:9px;align-items:center}.pipeline-module li>i{width:4px;max-height:34px;min-height:8px;align-self:end;border-radius:4px;background:linear-gradient(var(--template-secondary),var(--template-primary))}.pipeline-module strong,.pipeline-module span{display:block}.pipeline-module strong{font-size:11px}.pipeline-module span{margin-top:3px;color:var(--template-text-soft);font-size:9px}.pipeline-module li>b{color:var(--template-primary);font-size:10px}.resource-ring{width:94px;height:94px;margin:0 auto 14px;display:grid;place-content:center;text-align:center;border:9px solid var(--template-primary-soft);border-top-color:var(--template-secondary);border-right-color:var(--template-primary);border-radius:50%}.resource-ring strong{color:var(--template-heading);font-size:20px}.resource-ring span{margin-top:2px;color:var(--template-text-soft);font-size:8px}.resource-module dl{margin:0;display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.resource-module dl div{text-align:center}.resource-module dt{color:var(--template-text-soft);font-size:8px}.resource-module dd{margin:3px 0 0;color:var(--template-heading);font-size:10px;font-weight:700}.create-task-button{width:100%;height:42px}.task-card-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.task-card{padding:16px;border:1px solid var(--template-border);border-radius:12px;background:var(--template-surface);cursor:pointer;transition:.2s}.task-card:hover{transform:translateY(-2px);border-color:var(--template-primary);box-shadow:var(--template-shadow-hover)}.task-card header{display:flex;align-items:center;justify-content:space-between}.task-card header small,.task-card p{color:var(--template-text-soft);font-size:10px}.task-card h3{margin:13px 0 6px;color:var(--template-heading);font-size:14px}.task-card p{min-height:30px;margin:0}.card-progress{margin:13px 0;display:flex;align-items:center;gap:8px}.task-card dl{margin:0;padding-top:11px;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--template-border-light)}.task-card dt{color:var(--template-text-soft);font-size:8px}.task-card dd{margin:3px 0 0;font-size:10px;font-weight:650}.dialog-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.dialog-task-title{margin-bottom:18px;padding-bottom:14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--template-border)}.dialog-task-title strong,.dialog-task-title span{display:block}.dialog-task-title strong{color:var(--template-heading);font-size:16px}.dialog-task-title div span{margin-top:4px;color:var(--template-text-soft);font-size:11px}
@media(max-width:1120px){.data-canvas-layout{grid-template-columns:1fr}.data-control-rail{position:static;grid-template-columns:1fr 1fr}.search-module{grid-row:span 2}.create-task-button{grid-column:2}}
@media(max-width:780px){.canvas-metrics{grid-template-columns:repeat(2,1fr)}.data-control-rail{grid-template-columns:1fr}.search-module{grid-row:auto}.create-task-button{grid-column:auto}.task-card-grid{grid-template-columns:1fr}}
@media(max-width:560px){.dialog-form-grid{grid-template-columns:1fr}.canvas-live span{display:none}}
</style>
