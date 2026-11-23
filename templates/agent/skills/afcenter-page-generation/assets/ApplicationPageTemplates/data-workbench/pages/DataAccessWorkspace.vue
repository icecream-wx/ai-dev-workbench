<template>
  <div class="optimized-suite data-workbench">
    <div class="template-stage">
      <div class="business-page advanced-components-page">
    <header class="page-heading">
      <div><h1>数据接入工作区</h1><p>完成文件接入、字段映射、质量校验与发布编排</p></div>
      <div class="heading-actions"><span class="workspace-state"><i /> 草稿已保存</span><el-button>预览结果</el-button><el-button type="primary" @click="save">保存并发布</el-button></div>
    </header>

    <div class="ingestion-status">
      <div><span>当前流程</span><strong>供应商对账数据接入</strong><small>ING-20261111-038 · 负责人 苏禾</small></div>
      <pm-steps v-model="step" :options="steps" is-align-center />
      <dl><div><dt>映射字段</dt><dd>8 / 8</dd></div><div><dt>质量规则</dt><dd>6 条</dd></div><div><dt>预计入库</dt><dd>12.8 万行</dd></div></dl>
    </div>

    <div class="advanced-layout">
      <aside class="panel outline-panel">
        <div class="outline-title"><span>WORKFLOW</span><strong>接入配置</strong></div>
        <nav class="workflow-nav"><button v-for="item in outlineItems" :key="item.value" type="button" :class="{ active: activeSection === item.value }" @click="scrollToSection(item.value)">{{ item.label }}</button></nav>
        <div class="outline-progress"><span><b :style="{ width: '75%' }" /></span><strong>完成度 75%</strong><small>还有 2 项待确认</small></div>
      </aside>

      <main>
        <section id="source" class="panel workspace-block">
          <div class="block-heading"><div><span>01 / SOURCE</span><h2>选择数据源</h2><p>上传本地文件或从已登记数据源中选择。</p></div><span class="status-chip status-success">连接正常</span></div>
          <div class="source-grid">
            <div class="source-upload"><h3>上传文件</h3><pm-upload v-model="sourceFileIds" accept=".csv,.xlsx,.json" list-type="list" :headers="{}" /><div class="uploaded-file"><div class="file-icon">CSV</div><span><strong>supplier_statement_202611.csv</strong><small>18.6 MB · 128,426 行 · 上传完成</small></span><button type="button">替换</button></div></div>
            <div class="source-catalog"><div class="subheading"><h3>已登记数据源</h3><pm-search v-model:query="sourceQuery" default-prop="keyword" placeholder="搜索数据源" /></div><pm-tree :data="sourceTree" :props="sourceTreeProps" :default-expanded-keys="['lake','supplier']" :editable="false" :removable="false" :searchable="false" @node-click="selectSource" /><div class="source-info"><span>当前选择</span><strong>{{ selectedSource }}</strong><small>生产环境 · 华东数据湖 · 最近同步 10:18</small></div></div>
          </div>
        </section>

        <section id="mapping" class="panel workspace-block">
          <div class="block-heading"><div><span>02 / MAPPING</span><h2>字段映射与样例</h2><p>确认源字段、目标字段、数据类型和脱敏策略。</p></div><el-button type="primary" plain @click="ElMessage.success('已自动匹配 8 个字段')">智能匹配</el-button></div>
          <div class="mapping-grid">
            <div class="mapping-table"><pm-table :table-data="fieldRows" :columns="fieldColumns" checked :default-sort="{ prop: 'quality', order: 'ascending' }"><template #quality="{ row }"><span class="status-chip" :class="row.quality === '通过' ? 'status-success' : 'status-warning'">{{ row.quality }}</span></template></pm-table></div>
            <div class="mapping-side"><h3>字段结构</h3><dl class="schema-summary"><div v-for="item in dynamicSchema" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div></dl><div class="switch-list"><label><span><strong>自动类型转换</strong><small>兼容数值与时间格式</small></span><pm-switch size="default" :model-value="String(mappingOptions.autoCast)" @update:model-value="mappingOptions.autoCast = $event === 'true'" /></label><label><span><strong>敏感字段脱敏</strong><small>手机号与账户号使用掩码</small></span><pm-switch size="default" :model-value="String(mappingOptions.masking)" @update:model-value="mappingOptions.masking = $event === 'true'" /></label><label><span><strong>保留原始字段</strong><small>写入 raw_data 扩展列</small></span><pm-switch size="default" :model-value="String(mappingOptions.keepRaw)" @update:model-value="mappingOptions.keepRaw = $event === 'true'" /></label></div></div>
          </div>
          <div class="sheet-section"><div class="subheading"><div><h3>数据样例</h3><span>前 5 行抽样，已应用字段转换</span></div><span class="sample-count">5 ROWS</span></div><pm-sheet :sheet-config="sheetConfig" style="height:300px" /></div>
        </section>

        <section id="quality" class="panel workspace-block">
          <div class="block-heading"><div><span>03 / QUALITY</span><h2>质量检查与票据识别</h2><p>组合结构化规则、OCR 识别和说明内容完成接入校验。</p></div><span class="status-chip status-warning">1 项待确认</span></div>
          <div class="quality-workspace">
            <div><h3>质量检测报告</h3><pm-html :html="htmlContent" /><div class="quality-chart"><div><strong>98.6%</strong><span>字段完整率</span></div><pm-echarts :option="qualityChartOption" height="184px" /></div></div>
            <div><h3>票据 OCR 抽查</h3><PmOCR :ocr-setting="ocrSetting" :form-data="ocrResult" @update:form-data="Object.assign(ocrResult, $event)" /><dl v-if="ocrResult.invoiceNo" class="ocr-result"><div><dt>票据编号</dt><dd>{{ ocrResult.invoiceNo }}</dd></div><div><dt>开票企业</dt><dd>{{ ocrResult.company }}</dd></div><div><dt>含税金额</dt><dd>¥{{ ocrResult.amount }}</dd></div></dl><div v-else class="ocr-placeholder">上传 1 张样例票据后展示结构化识别结果</div></div>
            <div><h3>接入说明</h3><pm-markdown :model-value="markdownContent" /><div class="rule-editor"><span>异常处理备注</span><pm-textarea size="default" v-model="qualityNote" :rows="3" /></div></div>
          </div>
        </section>

        <section id="publish" class="panel workspace-block">
          <div class="block-heading"><div><span>04 / PUBLISH</span><h2>发布计划与数据说明</h2><p>确认入库日历、通知范围和资产说明。</p></div><span class="status-chip status-neutral">待发布</span></div>
          <div class="publish-workspace">
            <div class="calendar-box"><div class="subheading"><div><h3>运行日历</h3><span>蓝色日期为计划接入窗口</span></div></div><pm-calendar :data="calendarData" :options="calendarOptions" pk-field="id" /></div>
            <div class="publish-form"><h3>发布配置</h3><div class="publish-fields"><label><span>目标数据集</span><pm-input size="default" v-model="publishForm.dataset" /></label><label><span>更新策略</span><pm-select size="default" v-model="publishForm.mode" :options="modeOptions" /></label><label><span>质量阻断</span><pm-switch size="default" :model-value="String(publishForm.qualityGate)" @update:model-value="publishForm.qualityGate = $event === 'true'" /></label><label><span>完成后通知</span><pm-switch size="default" :model-value="String(publishForm.notify)" @update:model-value="publishForm.notify = $event === 'true'" /></label></div><h3>资产说明</h3><pm-richtext v-model="richContent" /></div>
          </div>
        </section>
      </main>
    </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'


const activeSection = ref('source')
const outlineItems = [{ label: '数据源选择', value: 'source' }, { label: '字段映射', value: 'mapping' }, { label: '质量检查', value: 'quality' }, { label: '发布计划', value: 'publish' }]
const step = ref(3)
const steps = [{ label: '数据源', value: 1 }, { label: '字段映射', value: 2 }, { label: '质量检查', value: 3 }, { label: '发布入库', value: 4 }]
const sourceQuery = ref({ keyword: '' })
const sourceFileIds = ref('')
const selectedSource = ref('华东数据湖 / supplier / statement_daily')
const sourceTree = [
  { id: 'lake', label: '华东数据湖', children: [{ id: 'supplier', label: 'supplier', children: [{ id: 'statement_daily', label: 'statement_daily' }, { id: 'delivery_record', label: 'delivery_record' }] }, { id: 'finance', label: 'finance', children: [{ id: 'payment_order', label: 'payment_order' }] }] },
  { id: 'database', label: '业务数据库', children: [{ id: 'purchase', label: '采购管理系统' }, { id: 'supplier-platform', label: '供应商协同平台' }] },
  { id: 'storage', label: '对象存储', children: [{ id: 'incoming', label: 'incoming-data' }, { id: 'archive', label: 'archive-2026' }] },
]
const sourceTreeProps = { id: 'id', label: 'label', children: 'children', isLeaf: 'isLeaf' }
const selectSource = node => { if (!node.children) selectedSource.value = `华东数据湖 / ${node.label}` }
const fieldRows = [
  { source: 'supplier_code', target: 'supplier_id', type: 'String', sample: 'SUP-02918', policy: '原值', quality: '通过' },
  { source: 'statement_no', target: 'statement_no', type: 'String', sample: 'ST202611-0086', policy: '唯一键', quality: '通过' },
  { source: 'amount_total', target: 'total_amount', type: 'Decimal(18,2)', sample: '12680.00', policy: '格式化', quality: '通过' },
  { source: 'tax_amount', target: 'tax_amount', type: 'Decimal(18,2)', sample: '718.30', policy: '格式化', quality: '通过' },
  { source: 'statement_date', target: 'statement_date', type: 'Date', sample: '2026-11-10', policy: '日期转换', quality: '通过' },
  { source: 'bank_account', target: 'bank_account', type: 'String', sample: '6222****9821', policy: '脱敏', quality: '待确认' },
]
const fieldColumns = [
  { prop: 'source', label: '源字段', minWidth: 125, sortable: true },
  { prop: 'target', label: '目标字段', minWidth: 125, sortable: true },
  { prop: 'type', label: '目标类型', width: 115, sortable: true },
  { prop: 'sample', label: '样例值', minWidth: 120 },
  { prop: 'policy', label: '处理策略', width: 88, sortable: true },
  { prop: 'quality', label: '校验结果', width: 94, scope: 'quality', sortable: true },
]
const dynamicSchema = [{ label: '源字段数', value: '8' }, { label: '已映射', value: '8' }, { label: '主键字段', value: 'statement_no' }, { label: '敏感字段', value: '1' }, { label: '分区字段', value: 'statement_date' }, { label: '字符编码', value: 'UTF-8' }]
const mappingOptions = reactive({ autoCast: true, masking: true, keepRaw: false })
const sheetRows = [
  ['供应商', '对账单号', '金额', '日期'], ['星禾商贸', 'ST-0086', '12,680.00', '2026-11-10'], ['东辰科技', 'ST-0087', '8,420.50', '2026-11-10'],
  ['悦航物流', 'ST-0088', '26,900.00', '2026-11-10'], ['青禾包装', 'ST-0089', '5,612.80', '2026-11-11'], ['远达实业', 'ST-0090', '18,346.00', '2026-11-11'],
]
const sheetConfig = [{ name: '数据样例', index: 0, status: 1, order: 0, celldata: sheetRows.flatMap((row, r) => row.map((value, c) => ({ r, c, v: { v: value, m: String(value), bg: r === 0 ? '#e9f3f8' : undefined } }))), config: { columnlen: { 0: 120, 1: 130, 2: 110, 3: 120 } } }]
const htmlContent = '<h3>质量检查总体通过</h3><p>已扫描 <strong>128,426</strong> 行数据，字段完整率 <strong>98.6%</strong>。银行账户字段存在 32 条格式异常，建议确认脱敏规则后发布。</p>'
const qualityChartOption = { chartView: { grid: { left: 35, right: 12, top: 12, bottom: 28 }, xAxis: { type: 'category', data: ['供应商','单据号','金额','税额','日期','币种'], axisLabel: { fontSize: 9 } }, yAxis: { type: 'value', min: 90, max: 100 }, tooltip: { trigger: 'axis' }, series: [{ type: 'bar', data: [98,100,94,99,97,100], itemStyle: { color: '#07858d', borderRadius: [4,4,0,0] } }] } }
const ocrResult = reactive({ invoiceNo: 'INV-20261111-0836', company: '上海星禾商贸有限公司', amount: '12,680.00' })
const ocrFields = [{ ocrValue: 'invoiceNo', ocrField: 'invoiceNo' }, { ocrValue: 'company', ocrField: 'company' }, { ocrValue: 'amount', ocrField: 'amount' }]
const ocrSetting = { type: 'invoice', fields: ocrFields }
const markdownContent = '# 接入检查清单\n- 供应商编码已与主数据对齐\n- 金额统一保留两位小数\n- 银行账户字段启用掩码\n- 原始文件保留 90 天'
const qualityNote = ref('32 条银行账户格式异常记录将写入隔离区，不阻断其余数据发布。')
const calendarData = [{ id: 1, title: '供应商对账增量入库', startDate: '2026-11-12', endDate: '2026-11-12' }, { id: 2, title: '质量复核窗口', startDate: '2026-11-14', endDate: '2026-11-15' }, { id: 3, title: '月度全量校准', startDate: '2026-11-28', endDate: '2026-11-29' }]
const calendarOptions = { fields: [{ name: 'title', title: '标题' }, { name: 'startDate', title: '开始日期' }, { name: 'endDate', title: '结束日期' }], startConfig: { dateField: 'startDate', type: 'date' }, endConfig: { dateField: 'endDate', type: 'date' }, recordConfig: { field: 'title', optionTemplate: { isEnable: false } }, colorConfig: { bgColor: '#dff3f3', color: '#056b72' }, rowConfig: { buttons: [] }, toolConfig: { buttons: [] } }
const publishForm = reactive({ dataset: '供应商对账事实表', mode: '每日增量写入', qualityGate: true, notify: true })
const modeOptions = ['每日增量写入', '全量覆盖', '追加写入'].map(value => ({ label: value, value }))
const richContent = ref('<p><strong>供应商对账事实表</strong>统一承载采购对账、税额与付款状态，用于财务核对和供应商履约分析。</p><p>数据责任人：苏禾；业务责任部门：采购管理部。</p>')
const save = () => ElMessage.success('数据接入流程已保存，发布检查通过')
const scrollToSection = value => { activeSection.value = value; document.getElementById(value)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
</script>

<style scoped>
.workspace-state{display:flex;align-items:center;gap:6px;color:var(--template-text-soft);font-size:9px}.workspace-state i{width:6px;height:6px;border-radius:50%;background:var(--template-success)}.ingestion-status{margin-bottom:14px;padding:13px 16px;display:grid;grid-template-columns:220px minmax(0,1fr) 260px;gap:22px;align-items:center;border:1px solid var(--template-border);border-radius:12px;background:#fff;box-shadow:var(--template-shadow)}.ingestion-status>div>span,.ingestion-status>div>strong,.ingestion-status>div>small{display:block}.ingestion-status>div>span{color:var(--template-secondary);font-size:8px;font-weight:800}.ingestion-status>div>strong{margin-top:4px;font-size:12px}.ingestion-status>div>small{margin-top:3px;color:var(--template-text-soft);font-size:8px}.ingestion-status :deep(.el-step__title){font-size:9px}.ingestion-status :deep(.el-step__description){display:none}.ingestion-status dl{margin:0;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ingestion-status dt{color:var(--template-text-soft);font-size:8px}.ingestion-status dd{margin:3px 0 0;font-size:10px;font-weight:700}.advanced-layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:14px;align-items:start}.outline-panel{position:sticky;top:12px;margin:0;padding:14px}.outline-title{margin:2px 7px 12px}.outline-title span,.outline-title strong{display:block}.outline-title span{color:var(--template-secondary);font-size:8px;font-weight:800;letter-spacing:.12em}.outline-title strong{margin-top:4px;font-size:12px}.outline-progress{margin-top:16px;padding:11px;border-radius:9px;background:var(--template-surface-soft)}.outline-progress>span{height:5px;display:block;overflow:hidden;border-radius:99px;background:var(--template-border)}.outline-progress>span b{height:100%;display:block;border-radius:inherit;background:linear-gradient(90deg,var(--template-primary),var(--template-secondary))}.outline-progress strong,.outline-progress small{display:block}.outline-progress strong{margin-top:7px;font-size:9px}.outline-progress small{margin-top:3px;color:var(--template-text-soft);font-size:8px}.advanced-layout main{min-width:0;display:grid;gap:14px}.workspace-block{margin:0;padding:18px}.block-heading{margin-bottom:16px;padding-bottom:13px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--template-border-light)}.block-heading>div>span{color:var(--template-secondary);font-size:8px;font-weight:800;letter-spacing:.1em}.block-heading h2,.block-heading p{margin:0}.block-heading h2{margin-top:3px;font-size:15px}.block-heading p{margin-top:4px;color:var(--template-text-soft);font-size:9px}.workspace-block h3{margin:0 0 10px;font-size:11px}.source-grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:14px}.source-upload,.source-catalog{min-width:0}.uploaded-file{margin-top:10px;padding:10px;display:flex;align-items:center;gap:9px;border:1px solid var(--template-border);border-radius:9px}.file-icon{width:34px;height:34px;display:grid;place-items:center;color:#fff;border-radius:8px;background:var(--template-secondary);font-size:8px;font-weight:800}.uploaded-file span{min-width:0;flex:1}.uploaded-file strong,.uploaded-file small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.uploaded-file strong{font-size:9px}.uploaded-file small{margin-top:3px;color:var(--template-text-soft);font-size:8px}.uploaded-file button{color:var(--template-primary);border:0;background:transparent;font-size:9px;cursor:pointer}.subheading{margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:10px}.subheading h3{margin:0}.subheading>:deep(.pm-search){max-width:260px}.source-catalog :deep(.el-tree){height:130px;padding:7px;overflow:auto;border:1px solid var(--template-border);border-radius:9px;background:var(--template-surface-soft)}.source-info{margin-top:9px;padding:10px;border-radius:8px;background:var(--template-secondary-soft)}.source-info span,.source-info strong,.source-info small{display:block}.source-info span{color:var(--template-secondary);font-size:8px}.source-info strong{margin-top:3px;font-size:9px}.source-info small{margin-top:3px;color:var(--template-text-soft);font-size:8px}.mapping-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(240px,.55fr);gap:14px}.mapping-side{padding:13px;border:1px solid var(--template-border);border-radius:10px;background:var(--template-surface-soft)}.switch-list{margin-top:12px;display:grid;gap:8px}.switch-list label{padding:9px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-radius:8px;background:#fff}.switch-list strong,.switch-list small{display:block}.switch-list strong{font-size:9px}.switch-list small{margin-top:3px;color:var(--template-text-soft);font-size:8px}.sheet-section{margin-top:14px}.subheading>div h3,.subheading>div span{margin:0;display:block}.subheading>div span{margin-top:3px;color:var(--template-text-soft);font-size:8px}.sample-count{color:var(--template-primary);font-size:8px;font-weight:800}.quality-workspace{display:grid;grid-template-columns:1.15fr .8fr .8fr;gap:14px}.quality-workspace>div{min-width:0}.quality-chart{margin-top:10px;padding:10px;display:grid;grid-template-columns:90px 1fr;align-items:center;border:1px solid var(--template-border);border-radius:9px}.quality-chart>div{text-align:center}.quality-chart strong,.quality-chart span{display:block}.quality-chart strong{color:var(--template-primary);font-size:18px}.quality-chart span{margin-top:3px;color:var(--template-text-soft);font-size:8px}.ocr-result{margin:10px 0 0;padding:10px;display:grid;gap:7px;border-radius:8px;background:var(--template-surface-soft)}.ocr-result div{display:flex;justify-content:space-between;gap:8px}.ocr-result dt{color:var(--template-text-soft);font-size:8px}.ocr-result dd{margin:0;font-size:8px;font-weight:650}.ocr-placeholder{margin-top:10px;padding:12px;color:var(--template-text-soft);border-radius:8px;background:var(--template-surface-soft);font-size:8px;text-align:center}.rule-editor{margin-top:10px}.rule-editor>span{margin-bottom:6px;display:block;font-size:9px;font-weight:650}.publish-workspace{display:grid;grid-template-columns:.85fr 1.15fr;gap:14px}.calendar-box{min-width:0;overflow:hidden}.calendar-box :deep(.el-calendar){border:1px solid var(--template-border);border-radius:9px}.calendar-box :deep(.el-calendar__header){padding:8px 10px}.calendar-box :deep(.el-calendar__body){padding:5px}.calendar-box :deep(.el-calendar-table .el-calendar-day){height:34px;padding:4px;font-size:8px}.publish-form{min-width:0}.publish-fields{margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.publish-fields label{min-width:0}.publish-fields label>span{margin-bottom:5px;display:block;color:var(--template-text-soft);font-size:8px}.publish-fields label:nth-child(n+3){padding:9px;display:flex;align-items:center;justify-content:space-between;border-radius:8px;background:var(--template-surface-soft)}.publish-fields label:nth-child(n+3)>span{margin:0;color:var(--template-text);font-weight:650}
@media(max-width:1100px){.ingestion-status{grid-template-columns:1fr}.ingestion-status dl{max-width:420px}.quality-workspace{grid-template-columns:1fr 1fr}.quality-workspace>div:first-child{grid-column:1/-1}}
@media(max-width:850px){.advanced-layout{grid-template-columns:1fr}.outline-panel{position:static}.source-grid,.mapping-grid,.publish-workspace{grid-template-columns:1fr}}
@media(max-width:640px){.quality-workspace{grid-template-columns:1fr}.quality-workspace>div:first-child{grid-column:auto}.publish-fields{grid-template-columns:1fr}.quality-chart{grid-template-columns:1fr}}
.workflow-nav{display:grid;gap:6px}.workflow-nav button{padding:9px 11px;color:var(--template-text-soft);border:0;border-left:3px solid transparent;border-radius:7px;background:transparent;font-size:9px;text-align:left;cursor:pointer}.workflow-nav button:hover,.workflow-nav button.active{color:var(--template-primary);border-left-color:var(--template-primary);background:var(--template-primary-soft);font-weight:700}.schema-summary{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:7px}.schema-summary div{padding:8px;border-radius:7px;background:#fff}.schema-summary dt{color:var(--template-text-soft);font-size:8px}.schema-summary dd{margin:3px 0 0;color:var(--template-heading);font-size:9px;font-weight:700}
</style>
