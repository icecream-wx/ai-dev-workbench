<template>
  <div class="optimized-suite data-workbench">
    <div class="template-stage">
      <div class="business-page analysis-builder">
    <header class="page-heading">
      <div><h1>新建分析任务</h1><p>按业务目标、数据范围、运行策略和发布确认完成任务配置</p></div>
      <div class="heading-actions"><span class="draft-state">草稿已自动保存 10:24</span><el-button @click="$emit('open-list')">返回任务列表</el-button></div>
    </header>

    <div class="builder-shell">
      <aside class="panel builder-steps">
        <div class="builder-mark"><span>PIPELINE BUILDER</span><strong>{{ activeStep }} / {{ steps.length }}</strong></div>
        <pm-steps v-model="activeStep" :options="steps" direction="vertical" />
        <div class="builder-help"><b>配置提示</b><p>{{ stepTips[activeStep - 1] }}</p></div>
        <div class="validation-state"><span><i />基本信息完整</span><span :class="{ muted: activeStep < 2 }"><i />数据范围可用</span><span :class="{ muted: activeStep < 3 }"><i />运行策略有效</span></div>
      </aside>

      <main class="builder-main">
        <el-form ref="formRef" :model="form" :rules="rules" label-position="left" label-width="94px" class="panel form-panel builder-form data-horizontal-form">
          <section v-if="activeStep === 1" class="form-section">
            <div class="section-heading"><div><span>STEP 01</span><h2>定义分析目标</h2><p>选择任务类型并补充工作区内可识别的业务信息。</p></div><b>基础</b></div>
            <div class="type-card-grid">
              <button v-for="item in taskTypes" :key="item.value" type="button" :class="{ active: form.type === item.value }" @click="form.type = item.value">
                <span>{{ item.icon }}</span><strong>{{ item.label }}</strong><small>{{ item.description }}</small><em>{{ item.engine }}</em>
              </button>
            </div>
            <div class="form-grid form-grid-wide">
              <el-form-item label="任务名称" prop="name"><pm-input size="default" v-model="form.name" placeholder="请输入清晰可识别的任务名称" /></el-form-item>
              <el-form-item label="任务编码"><pm-input size="default" v-model="form.code" disabled /></el-form-item>
              <el-form-item label="所属工作区" prop="workspace"><pm-select size="default" v-model="form.workspace" :options="workspaceOptions" /></el-form-item>
              <el-form-item label="负责人" prop="owner"><pm-select size="default" v-model="form.owner" :options="ownerOptions" filterable /></el-form-item>
              <el-form-item label="优先级"><pm-select size="default" v-model="form.priority" :options="priorityOptions" /></el-form-item>
              <el-form-item label="业务标签"><pm-select size="default" v-model="form.tags" :options="tagOptions" multiple /></el-form-item>
              <el-form-item class="full-row" label="任务说明"><pm-textarea size="default" v-model="form.description" :rows="3" placeholder="说明业务目标、口径和预期产出" /></el-form-item>
            </div>
          </section>

          <section v-else-if="activeStep === 2" class="form-section">
            <div class="section-heading"><div><span>STEP 02</span><h2>配置数据范围</h2><p>选择输入资产、字段与过滤范围，系统将实时估算扫描量。</p></div><b>数据</b></div>
            <div class="dataset-selection"><div><span>当前数据集</span><strong>{{ form.dataset || '尚未选择' }}</strong><small>{{ selectedDataset.description }}</small></div><dl><div><dt>质量评分</dt><dd>{{ selectedDataset.quality }}</dd></div><div><dt>数据规模</dt><dd>{{ selectedDataset.rows }}</dd></div><div><dt>更新周期</dt><dd>{{ selectedDataset.cycle }}</dd></div></dl></div>
            <div class="form-grid form-grid-wide">
              <el-form-item label="数据集来源" prop="dataset"><pm-select size="default" v-model="form.dataset" :options="datasetOptions" filterable /></el-form-item>
              <el-form-item label="输出数据集"><pm-input size="default" v-model="form.output" /></el-form-item>
              <el-form-item class="full-row" label="查询字段" prop="fields"><pm-select size="default" v-model="form.fields" :options="fieldOptions" multiple filterable /></el-form-item>
              <el-form-item class="full-row" label="过滤条件"><pm-textarea size="default" v-model="form.condition" :rows="3" /></el-form-item>
              <el-form-item label="数据窗口"><pm-select size="default" v-model="form.window" :options="windowOptions" /></el-form-item>
              <el-form-item label="结果更新方式"><pm-select size="default" v-model="form.refreshMode" :options="refreshOptions" /></el-form-item>
            </div>
            <div class="data-preview"><div class="preview-head"><div><strong>数据预览</strong><span>基于最近分区抽样 1,000 行</span></div><span class="status-chip status-success">可用</span></div><div class="preview-table"><span v-for="field in previewFields" :key="field.name"><b>{{ field.name }}</b><em>{{ field.type }}</em><strong>{{ field.sample }}</strong></span></div></div>
          </section>

          <section v-else-if="activeStep === 3" class="form-section">
            <div class="section-heading"><div><span>STEP 03</span><h2>设置运行策略</h2><p>配置调度、资源和失败处理，保障任务稳定产出。</p></div><b>运行</b></div>
            <div class="form-grid form-grid-wide">
              <el-form-item label="运行引擎"><pm-select size="default" v-model="form.engine" :options="engineOptions" /></el-form-item>
              <el-form-item label="资源队列"><pm-select size="default" v-model="form.queue" :options="queueOptions" /></el-form-item>
              <el-form-item label="调度周期" prop="schedule"><pm-select size="default" v-model="form.schedule" :options="scheduleOptions" /></el-form-item>
              <el-form-item label="首次运行时间"><pm-date-picker size="default" v-model="form.startAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" /></el-form-item>
              <el-form-item label="超时时间"><pm-select size="default" v-model="form.timeout" :options="timeoutOptions" /></el-form-item>
              <el-form-item label="失败重试"><pm-select size="default" v-model="form.retry" :options="retryOptions" /></el-form-item>
            </div>
            <div class="strategy-grid">
              <label><span><strong>依赖数据就绪后运行</strong><small>避免在上游未完成时提前执行</small></span><pm-switch size="default" :model-value="String(form.waitForData)" @update:model-value="form.waitForData = $event === 'true'" /></label>
              <label><span><strong>失败时通知负责人</strong><small>通过站内信与企业消息发送告警</small></span><pm-switch size="default" :model-value="String(form.notifyOwner)" @update:model-value="form.notifyOwner = $event === 'true'" /></label>
              <label><span><strong>开启质量阻断</strong><small>关键规则失败时不发布结果</small></span><pm-switch size="default" :model-value="String(form.qualityGate)" @update:model-value="form.qualityGate = $event === 'true'" /></label>
              <label><span><strong>保留运行快照</strong><small>保留最近 30 次输入与配置版本</small></span><pm-switch size="default" :model-value="String(form.keepSnapshot)" @update:model-value="form.keepSnapshot = $event === 'true'" /></label>
            </div>
            <div class="cost-estimate"><div><span>预计单次耗时</span><strong>4m 20s</strong></div><div><span>预计扫描数据</span><strong>186 GB</strong></div><div><span>预计资源消耗</span><strong>28 CU</strong></div><div><span>月度费用估算</span><strong>¥ 252.60</strong></div></div>
          </section>

          <section v-else class="form-section publish-section">
            <div class="section-heading"><div><span>STEP 04</span><h2>确认并发布</h2><p>核对任务摘要、数据链路和通知范围。</p></div><b>发布</b></div>
            <div class="publish-summary">
              <div class="summary-main"><div class="summary-icon">AN</div><div><strong>{{ form.name }}</strong><span>{{ form.code }} · {{ form.type }} · {{ form.workspace }}</span></div><span class="status-chip status-success">配置有效</span></div>
              <div class="summary-grid"><div v-for="item in summaryItems" :key="item.label"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div></div>
            </div>
            <div class="publish-columns">
              <div class="publish-card"><h3>数据链路</h3><div class="mini-lineage"><span>{{ form.dataset }}</span><i>→</i><span>{{ form.engine }}</span><i>→</i><span>{{ form.output }}</span></div><small>质量阻断已开启，输出将保留 90 天。</small></div>
              <div class="publish-card"><h3>发布检查</h3><ul><li><i />输入数据集可访问</li><li><i />字段与过滤条件有效</li><li><i />资源队列容量充足</li><li><i />调度时间无冲突</li></ul></div>
            </div>
            <el-form-item label="发布备注"><pm-textarea size="default" v-model="form.releaseNote" :rows="3" /></el-form-item>
          </section>

          <footer class="form-actions builder-actions">
            <div><el-button text @click="saveDraft">保存草稿</el-button><span>配置变更会自动记录版本</span></div>
            <div><el-button v-if="activeStep > 1" @click="activeStep--">上一步</el-button><el-button v-if="activeStep < steps.length" type="primary" @click="next">保存并继续</el-button><el-button v-else type="primary" @click="submit">创建并运行</el-button></div>
          </footer>
        </el-form>
      </main>
    </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'


const emit = defineEmits(['open-list'])
const activeStep = ref(1)
const steps = [
  { label: '分析目标', description: '类型、名称与归属', value: 1 },
  { label: '数据范围', description: '输入、字段与过滤', value: 2 },
  { label: '运行策略', description: '调度、资源与容错', value: 3 },
  { label: '确认发布', description: '检查配置并创建', value: 4 },
]
const stepTips = ['名称应能直接说明指标或分析对象，便于团队检索。', '优先选择质量评分 A 级资产，减少后续治理成本。', '实时任务建议使用 risk-fast 队列，批任务使用 standard。', '发布后将立即创建首个运行实例并记录配置版本。']
const taskTypes = [
  { value: '用户洞察', label: '用户洞察', icon: '◎', description: '人群、标签与行为分析', engine: '推荐 Spark' },
  { value: '经营分析', label: '经营分析', icon: '▥', description: '指标、趋势与归因分析', engine: '推荐 Spark' },
  { value: '风险识别', label: '风险识别', icon: '△', description: '异常检测与实时预警', engine: '推荐 Flink' },
  { value: '数据加工', label: '数据加工', icon: '◇', description: '清洗、转换与主题建模', engine: '推荐 SQL' },
]
const optionize = values => values.map(value => ({ label: value, value }))
const formRef = ref()
const form = reactive({
  type: '用户洞察', name: '会员复购趋势分析', code: 'AN-20261111-2048', workspace: '增长分析工作区', owner: '陈序', priority: '高', tags: ['会员', '复购'], description: '按会员统计近 30 / 60 / 90 天购买频次、复购间隔和消费金额，产出复购分层结果。',
  dataset: '会员交易明细宽表', output: '客户复购主题集', fields: ['客户编号', '交易金额', '交易时间', '会员等级', '商品类目'], condition: "订单状态 = '已完成' AND 交易时间 >= CURRENT_DATE - 90", window: '最近 90 天', refreshMode: '增量更新',
  engine: 'Spark 3.5', queue: 'insight-pro', schedule: '每日 08:00', startAt: '2026-11-12 08:00:00', timeout: '30 分钟', retry: '失败后重试 2 次', waitForData: true, notifyOwner: true, qualityGate: true, keepSnapshot: true,
  releaseNote: '首版用于用户增长周报，口径已与会员运营团队确认。',
})
const workspaceOptions = optionize(['增长分析工作区', '经营决策工作区', '风险控制工作区', '供应链分析工作区'])
const ownerOptions = optionize(['陈序', '林默', '周青', '苏禾', '唐宁'])
const priorityOptions = optionize(['高', '中', '低'])
const tagOptions = optionize(['会员', '复购', '增长', '经营', '风控', '实时', '核心指标'])
const datasetOptions = optionize(['会员交易明细宽表', '客户标签主题集', '区域经营指标集', '订单退款事实表', '用户行为主题宽表'])
const fieldOptions = optionize(['客户编号', '交易金额', '交易时间', '会员等级', '商品类目', '渠道编码', '所在区域', '订单状态'])
const windowOptions = optionize(['最近 7 天', '最近 30 天', '最近 90 天', '自然月', '不限制'])
const refreshOptions = optionize(['增量更新', '全量覆盖', '追加写入'])
const engineOptions = optionize(['Spark 3.5', 'Flink 1.18', 'SQL Engine'])
const queueOptions = optionize(['insight-pro', 'standard', 'risk-fast', 'batch-large'])
const scheduleOptions = optionize(['实时触发', '每小时', '每日 08:00', '每周一 07:30', '仅运行一次'])
const timeoutOptions = optionize(['10 分钟', '30 分钟', '1 小时', '3 小时'])
const retryOptions = optionize(['不自动重试', '失败后重试 1 次', '失败后重试 2 次', '失败后重试 3 次'])
const datasetMeta = {
  会员交易明细宽表: { quality: '98 / A', rows: '2.84 亿行', cycle: '每日 06:00', description: '交易主题域核心宽表，最近一次更新于 10 分钟前。' },
  客户标签主题集: { quality: '96 / A', rows: '3,628 万行', cycle: '每小时', description: '覆盖 186 个标准客户标签，支持人群圈选。' },
  区域经营指标集: { quality: '94 / B', rows: '128 万行', cycle: '每小时', description: '按区域和门店提供统一经营指标口径。' },
  订单退款事实表: { quality: '97 / A', rows: '896 万行', cycle: '实时', description: '记录退款申请、审核和到账全链路事件。' },
  用户行为主题宽表: { quality: '96 / A', rows: '18.7 亿行', cycle: '15 分钟', description: '统一浏览、搜索、收藏和购买行为会话。' },
}
const selectedDataset = computed(() => datasetMeta[form.dataset] || { quality: '--', rows: '--', cycle: '--', description: '请选择数据集查看资产摘要。' })
const previewFields = [
  { name: 'customer_id', type: 'String', sample: 'C10293842' }, { name: 'order_amount', type: 'Decimal', sample: '428.60' },
  { name: 'paid_at', type: 'DateTime', sample: '2026-11-10 18:42' }, { name: 'member_level', type: 'String', sample: 'GOLD' },
  { name: 'category_name', type: 'String', sample: '个护健康' },
]
const summaryItems = computed(() => [
  { label: '负责人', value: form.owner }, { label: '输入数据集', value: form.dataset }, { label: '输出数据集', value: form.output },
  { label: '运行引擎', value: form.engine }, { label: '资源队列', value: form.queue }, { label: '调度周期', value: form.schedule },
  { label: '超时策略', value: form.timeout }, { label: '失败处理', value: form.retry },
])
const rules = {
  name: [{ required: true, message: '请输入任务名称' }], workspace: [{ required: true, message: '请选择工作区' }], owner: [{ required: true, message: '请选择负责人' }],
  dataset: [{ required: true, message: '请选择数据集' }], fields: [{ required: true, message: '请选择查询字段' }], schedule: [{ required: true, message: '请选择调度周期' }],
}
const next = async () => {
  try {
    if (activeStep.value === 1) await formRef.value.validateField(['name', 'workspace', 'owner'])
    if (activeStep.value === 2) await formRef.value.validateField(['dataset', 'fields'])
    if (activeStep.value === 3) await formRef.value.validateField(['schedule'])
    activeStep.value += 1
  } catch (_) { ElMessage.warning('请先补全当前步骤的必填信息') }
}
const saveDraft = () => ElMessage.success('任务草稿已保存')
const submit = async () => {
  try { await formRef.value.validate(); ElMessage.success('分析任务已创建并加入运行队列'); emit('open-list') }
  catch (_) { ElMessage.warning('请检查任务配置') }
}
</script>

<style scoped>
.draft-state{color:var(--template-text-soft);font-size:9px}.builder-shell{display:grid;grid-template-columns:238px minmax(0,1fr);gap:14px;align-items:start}.builder-steps{position:sticky;top:12px;min-height:610px;margin:0;padding:18px;background:linear-gradient(180deg,#edf7fc,#fff)}.builder-mark{margin-bottom:22px;display:flex;align-items:center;justify-content:space-between}.builder-mark span{color:var(--template-secondary);font-size:8px;font-weight:800;letter-spacing:.12em}.builder-mark strong{color:var(--template-primary);font-size:11px}.builder-steps :deep(.el-steps){height:340px}.builder-help{padding:12px;border-radius:9px;background:#fff;border:1px solid var(--template-border)}.builder-help b{font-size:10px}.builder-help p{margin:5px 0 0;color:var(--template-text-soft);font-size:9px;line-height:1.6}.validation-state{margin-top:14px;display:grid;gap:7px}.validation-state span{display:flex;align-items:center;gap:6px;color:var(--template-success);font-size:9px}.validation-state span.muted{color:var(--template-text-soft)}.validation-state i{width:6px;height:6px;border-radius:50%;background:currentColor}.builder-main{min-width:0}.builder-form{min-height:610px;margin:0;padding:24px}.section-heading{margin-bottom:20px;padding-bottom:14px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid var(--template-border-light)}.section-heading span{color:var(--template-secondary);font-size:8px;font-weight:800;letter-spacing:.12em}.section-heading h2{margin:4px 0 0;color:var(--template-heading);font-size:18px}.section-heading p{margin:5px 0 0;color:var(--template-text-soft);font-size:10px}.section-heading>b{padding:5px 9px;color:var(--template-primary);border-radius:99px;background:var(--template-primary-soft);font-size:9px}.type-card-grid{margin-bottom:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.type-card-grid button{min-width:0;padding:16px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;color:var(--template-text);text-align:left;border:1px solid var(--template-border);border-radius:11px;background:#fff;cursor:pointer;transition:.2s}.type-card-grid button:hover{border-color:#a9cae7}.type-card-grid button.active{border-color:var(--template-primary);background:linear-gradient(145deg,var(--template-primary-soft),#fff);box-shadow:0 0 0 2px rgba(20,95,186,.07)}.type-card-grid button>span{color:var(--template-primary);font-size:20px}.type-card-grid button strong{font-size:12px}.type-card-grid button small{min-height:28px;color:var(--template-text-soft);font-size:9px;line-height:1.5}.type-card-grid button em{color:var(--template-secondary);font-size:8px;font-style:normal}.form-grid-wide{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}.form-grid-wide .full-row{grid-column:1/-1}.dataset-selection{margin-bottom:18px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:20px;border:1px solid #c9e0e4;border-radius:11px;background:var(--template-secondary-soft)}.dataset-selection>div span,.dataset-selection>div strong,.dataset-selection>div small{display:block}.dataset-selection>div span{color:var(--template-secondary);font-size:8px;font-weight:800}.dataset-selection>div strong{margin-top:5px;font-size:13px}.dataset-selection>div small{margin-top:4px;color:var(--template-text-soft);font-size:9px}.dataset-selection dl{margin:0;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.dataset-selection dt{color:var(--template-text-soft);font-size:8px}.dataset-selection dd{margin:3px 0 0;font-size:10px;font-weight:700}.data-preview{padding:14px;border:1px solid var(--template-border);border-radius:11px;background:var(--template-surface-soft)}.preview-head{margin-bottom:10px;display:flex;align-items:center;justify-content:space-between}.preview-head strong,.preview-head span{display:block}.preview-head strong{font-size:11px}.preview-head div span{margin-top:3px;color:var(--template-text-soft);font-size:8px}.preview-table{display:grid;grid-template-columns:repeat(5,1fr);overflow:hidden;border:1px solid var(--template-border);border-radius:8px;background:#fff}.preview-table>span{min-width:0;padding:9px;border-right:1px solid var(--template-border-light)}.preview-table>span:last-child{border-right:0}.preview-table b,.preview-table em,.preview-table strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.preview-table b{font-size:9px}.preview-table em{margin-top:3px;color:var(--template-secondary);font-size:8px;font-style:normal}.preview-table strong{margin-top:8px;color:var(--template-text-soft);font-size:8px;font-weight:500}.strategy-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.strategy-grid label{padding:13px;display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid var(--template-border);border-radius:10px;background:var(--template-surface-soft)}.strategy-grid strong,.strategy-grid small{display:block}.strategy-grid strong{font-size:10px}.strategy-grid small{margin-top:3px;color:var(--template-text-soft);font-size:8px}.cost-estimate{margin-top:16px;padding:13px;display:grid;grid-template-columns:repeat(4,1fr);border-radius:10px;background:linear-gradient(90deg,#edf7fc,#f5fbfb)}.cost-estimate div{text-align:center}.cost-estimate div+div{border-left:1px solid var(--template-border)}.cost-estimate span,.cost-estimate strong{display:block}.cost-estimate span{color:var(--template-text-soft);font-size:8px}.cost-estimate strong{margin-top:5px;font-size:11px}.publish-summary{margin-bottom:14px;padding:16px;border:1px solid var(--template-border);border-radius:11px;background:linear-gradient(135deg,#f5faff,#fff)}.summary-main{padding-bottom:14px;display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--template-border)}.summary-icon{width:38px;height:38px;display:grid;place-items:center;color:#fff;border-radius:10px;background:linear-gradient(135deg,var(--template-primary),var(--template-secondary));font-size:10px;font-weight:800}.summary-main>div:nth-child(2){flex:1}.summary-main strong,.summary-main span{display:block}.summary-main strong{font-size:13px}.summary-main div span{margin-top:4px;color:var(--template-text-soft);font-size:9px}.summary-grid{padding-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:13px}.summary-grid span,.summary-grid strong{display:block}.summary-grid span{color:var(--template-text-soft);font-size:8px}.summary-grid strong{margin-top:4px;font-size:9px}.publish-columns{margin-bottom:15px;display:grid;grid-template-columns:1.2fr .8fr;gap:12px}.publish-card{padding:15px;border:1px solid var(--template-border);border-radius:10px}.publish-card h3{margin:0 0 12px;font-size:11px}.mini-lineage{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:6px;align-items:center}.mini-lineage span{padding:8px;overflow:hidden;color:var(--template-heading);border-radius:7px;background:var(--template-surface-soft);font-size:8px;text-align:center;text-overflow:ellipsis;white-space:nowrap}.mini-lineage i{color:var(--template-primary);font-style:normal}.publish-card>small{margin-top:10px;display:block;color:var(--template-text-soft);font-size:8px}.publish-card ul{margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:9px;list-style:none}.publish-card li{font-size:9px}.publish-card li i{width:6px;height:6px;margin-right:6px;display:inline-block;border-radius:50%;background:var(--template-success)}.builder-actions{align-items:center;justify-content:space-between}.builder-actions>div{display:flex;align-items:center;gap:8px}.builder-actions>div>span{color:var(--template-text-soft);font-size:8px}
@media(max-width:1050px){.builder-shell{grid-template-columns:1fr}.builder-steps{position:static;min-height:auto}.builder-steps :deep(.el-steps){height:auto}.type-card-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:700px){.form-grid-wide,.strategy-grid,.publish-columns{grid-template-columns:1fr}.form-grid-wide .full-row{grid-column:auto}.dataset-selection{align-items:flex-start;flex-direction:column}.dataset-selection dl{width:100%}.preview-table{grid-template-columns:1fr 1fr}.cost-estimate,.summary-grid{grid-template-columns:1fr 1fr;gap:10px}.cost-estimate div+div{border-left:0}.builder-actions{align-items:flex-start;flex-direction:column}.builder-actions>div:last-child{width:100%;justify-content:flex-end}}
</style>
