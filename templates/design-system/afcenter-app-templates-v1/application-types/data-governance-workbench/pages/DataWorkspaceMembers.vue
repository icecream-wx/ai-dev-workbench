<template>
  <div class="optimized-suite application-type-data-governance">
    <div class="template-stage">
      <div class="business-page data-extra-page">
    <template v-if="page === 'dataset'">
      <header class="page-heading">
        <div><h1>数据资产目录</h1><p>按主题域查看资产质量、敏感级别与血缘状态</p></div>
        <div class="heading-actions"><el-button>批量导入</el-button><el-button type="primary" :icon="Plus" @click="ElMessage.success('已打开数据集登记向导')">登记数据集</el-button></div>
      </header>
      <div class="asset-summary">
        <article v-for="item in assetMetrics" :key="item.label"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ item.note }}</small></article>
      </div>
      <section class="asset-browser">
        <aside class="domain-shelf">
          <div class="shelf-heading"><span>主题域</span><small>{{ datasets.length }} ASSETS</small></div>
          <button v-for="domain in domains" :key="domain" type="button" :class="{ active: currentCategory === domain }" @click="currentCategory = domain"><i />{{ domain }}<b>{{ domainCount(domain) }}</b></button>
          <div class="shelf-note"><strong>资产盘点</strong><span>今日 06:20 已完成</span><b>覆盖率 100%</b></div>
        </aside>
        <main class="asset-main">
          <div class="asset-toolbar">
            <pm-search v-model:query="datasetQuery" default-prop="keyword" placeholder="搜索名称 / 资产编码 / 标签" />
            <div class="asset-filters"><pm-select size="default" v-model="assetType" :options="assetTypeOptions" clearable placeholder="资产类型" /><pm-select size="default" v-model="qualityLevel" :options="qualityOptions" clearable placeholder="质量等级" /></div>
          </div>
          <div class="dataset-card-grid">
            <article v-for="item in filteredDatasets" :key="item.code" class="dataset-card">
              <header><div><b>{{ item.code }}</b><span>{{ item.type }}</span></div><span class="status-chip" :class="item.quality >= 95 ? 'status-success' : item.quality >= 90 ? 'status-warning' : 'status-danger'">{{ item.quality }} 分</span></header>
              <h2>{{ item.name }}</h2><p>{{ item.description }}</p>
              <div class="dataset-tags"><span v-for="tag in item.tags" :key="tag">{{ tag }}</span></div>
              <div class="quality-row"><span>质量完整度</span><b>{{ item.quality }}%</b></div><div class="quality-track"><i :style="{ width: `${item.quality}%` }" /></div>
              <dl><div><dt>数据规模</dt><dd>{{ item.rows }}</dd></div><div><dt>更新周期</dt><dd>{{ item.cycle }}</dd></div><div><dt>敏感级别</dt><dd>{{ item.sensitivity }}</dd></div></dl>
              <footer><span>{{ item.owner }} · {{ item.source }}</span><strong>{{ item.updatedAt }}</strong></footer>
            </article>
          </div>
          <div v-if="!filteredDatasets.length" class="asset-empty">未找到符合条件的数据资产</div>
        </main>
      </section>
    </template>

    <template v-else-if="page === 'detail'">
      <header class="page-heading task-detail-heading">
        <div><div class="title-line"><h1>会员复购趋势分析</h1><span class="status-chip status-success">运行成功</span></div><p>TASK-AN-20261108 · 用户洞察 · 负责人 陈序</p></div>
        <div class="heading-actions"><el-button @click="ElMessage.info('配置已复制为新任务')">复制任务</el-button><el-button type="primary" @click="ElMessage.success('任务已重新加入运行队列')">重新运行</el-button></div>
      </header>
      <div class="run-banner"><div><i /><span><strong>今日 08:04 完成</strong><small>本次读取 18 个分区，数据质量检查全部通过</small></span></div><dl><div><dt>运行评分</dt><dd>98</dd></div><div><dt>实例编号</dt><dd>RUN-1108-042</dd></div><div><dt>下次调度</dt><dd>明日 08:00</dd></div></dl></div>
      <div class="metrics-grid detail-metrics"><article v-for="metric in detailMetrics" :key="metric.label" class="metric-card"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.note }}</small></article></div>
      <div class="detail-workspace">
        <main>
          <section class="panel detail-config"><div class="table-toolbar"><h2 class="panel-title">任务配置</h2><span class="config-version">配置版本 V18</span></div><div class="info-grid"><div v-for="item in detailInfo" :key="item.label" class="info-item"><span>{{ item.label }}</span><strong>{{ item.value }}</strong></div></div></section>
          <section class="panel lineage-panel"><div class="table-toolbar"><div><h2 class="panel-title">数据血缘</h2><p>输入、处理与输出链路</p></div><span class="status-chip status-success">链路正常</span></div><div class="lineage-flow"><div class="lineage-node source"><small>INPUT</small><strong>会员交易明细宽表</strong><span>2.84 亿行 · T+1</span></div><i>→</i><div class="lineage-node process"><small>TRANSFORM</small><strong>复购窗口聚合</strong><span>18 条规则 · Spark</span></div><i>→</i><div class="lineage-node output"><small>OUTPUT</small><strong>客户复购主题集</strong><span>842 万行 · 已发布</span></div></div></section>
          <section class="panel quality-panel"><div class="table-toolbar"><div><h2 class="panel-title">质量检查</h2><p>6 条规则全部通过</p></div><el-button text type="primary">查看检查报告</el-button></div><div class="quality-rules"><div v-for="rule in qualityRules" :key="rule.name"><span><i />{{ rule.name }}</span><b>{{ rule.result }}</b><em>{{ rule.target }}</em></div></div></section>
        </main>
        <aside>
          <section class="panel runtime-panel"><h2 class="panel-title">资源画像</h2><div class="runtime-ring"><strong>28 CU</strong><span>本次消耗</span></div><dl><div><dt>峰值内存</dt><dd>42.6 GB</dd></div><div><dt>并行度</dt><dd>18</dd></div><div><dt>扫描数据</dt><dd>186 GB</dd></div><div><dt>费用估算</dt><dd>¥ 8.42</dd></div></dl></section>
          <section class="panel"><h2 class="panel-title">运行时间线</h2><ol class="timeline"><li v-for="item in runs" :key="item.time"><strong>{{ item.title }}</strong><span>{{ item.time }} · {{ item.description }}</span></li></ol></section>
        </aside>
      </div>
    </template>

    <template v-else>
      <header class="page-heading">
        <div><h1>工作区成员</h1><p>管理角色权限、数据访问范围与协作状态</p></div>
        <el-button type="primary" :icon="Plus" @click="openInvite">邀请成员</el-button>
      </header>
      <div class="member-summary"><article v-for="item in memberMetrics" :key="item.label"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ item.note }}</small></article></div>
      <section class="member-toolbar"><pm-search v-model:query="memberQuery" default-prop="keyword" placeholder="搜索成员姓名 / 角色" /><div><pm-select size="default" v-model="memberRole" :options="roleOptions" clearable placeholder="全部角色" /><span>共 {{ filteredMembers.length }} 名成员</span></div></section>
      <section class="member-card-grid">
        <article v-for="member in filteredMembers" :key="member.id" class="member-card">
          <header><div class="member-avatar" :style="{ background: member.color }">{{ member.name.slice(0, 1) }}</div><span class="status-chip" :class="member.status === '在线' ? 'status-success' : member.status === '待加入' ? 'status-warning' : 'status-neutral'">{{ member.status }}</span></header>
          <div class="member-name"><h2>{{ member.name }}</h2><span>{{ member.department }}</span></div>
          <b>{{ member.role }}</b><p>{{ member.datasets.join('、') }}</p>
          <dl><div><dt>负责任务</dt><dd>{{ member.tasks }}</dd></div><div><dt>数据权限</dt><dd>{{ member.access }}</dd></div><div><dt>最近活跃</dt><dd>{{ member.lastActive }}</dd></div></dl>
          <footer><span>{{ member.email }}</span><button type="button" class="link-button" @click="editMember(member)">调整权限</button></footer>
        </article>
      </section>
    </template>

    <pm-form-dialog v-model:dialog-visible="memberVisible" :title="editingMember ? '调整成员权限' : '邀请协作成员'" width="560px" ok-text="保存权限" @submit="saveMember">
      <template #form><el-form label-position="top" class="member-editor">
        <el-form-item label="成员姓名"><pm-input size="default" v-model="memberEditor.name" :disabled="Boolean(editingMember)" /></el-form-item>
        <el-form-item label="所属角色"><pm-select size="default" v-model="memberEditor.role" :options="roleOptions" style="width: 100%" /></el-form-item>
        <el-form-item label="授权数据集" class="editor-full"><pm-select size="default" v-model="memberEditor.datasets" :options="datasetOptions" multiple style="width: 100%" /></el-form-item>
        <el-form-item label="数据访问级别"><pm-select size="default" v-model="memberEditor.access" :options="accessOptions" style="width: 100%" /></el-form-item>
        <el-form-item label="负责任务数"><pm-input size="default" v-model="memberEditor.tasks" /></el-form-item>
      </el-form></template>
    </pm-form-dialog>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'


const page = 'members'
const optionize = values => values.map(value => ({ label: value, value }))
const assetMetrics = [
  { label: '已登记资产', value: '128', note: '本月新增 12 个' },
  { label: '质量平均分', value: '95.6', note: '较上月提升 1.8' },
  { label: '今日已更新', value: '114', note: '更新达成率 98.2%' },
  { label: '待治理问题', value: '7', note: 'P1 问题 1 个' },
]
const domains = ['全部数据资产', '客户主题域', '交易主题域', '商品主题域', '供应链主题域', '经营指标']
const currentCategory = ref('全部数据资产')
const datasetQuery = ref({ keyword: '' })
const assetType = ref('')
const qualityLevel = ref('')
const assetTypeOptions = optionize(['宽表', '事实表', '主题集', '指标集', '事件流'])
const qualityOptions = optionize(['A级 · 95分以上', 'B级 · 90-94分', 'C级 · 90分以下'])
const datasets = [
  { code: 'DS-1028', name: '会员交易明细宽表', category: '交易主题域', type: '宽表', owner: '数据中台', source: '湖仓平台', rows: '2.84 亿行', cycle: '每日 06:00', updatedAt: '10 分钟前', quality: 98, sensitivity: 'L3', tags: ['会员', '交易', '核心'], description: '统一整合会员订单、支付与商品明细，支撑用户复购和价值分析。' },
  { code: 'DS-1016', name: '客户标签主题集', category: '客户主题域', type: '主题集', owner: '用户增长组', source: '标签平台', rows: '3,628 万行', cycle: '每小时', updatedAt: '28 分钟前', quality: 96, sensitivity: 'L3', tags: ['标签', '画像', '实时'], description: '沉淀客户基础、行为和偏好标签，覆盖 186 个标准标签。' },
  { code: 'DS-0987', name: '区域经营指标集', category: '经营指标', type: '指标集', owner: '经营分析组', source: '指标中台', rows: '128 万行', cycle: '每小时', updatedAt: '1 小时前', quality: 94, sensitivity: 'L2', tags: ['经营', '区域', 'KPI'], description: '按区域、门店和渠道聚合销售目标、达成率与同比环比指标。' },
  { code: 'DS-0964', name: '订单退款事实表', category: '交易主题域', type: '事实表', owner: '风控中心', source: '订单中心', rows: '896 万行', cycle: '实时', updatedAt: '2 分钟前', quality: 97, sensitivity: 'L3', tags: ['退款', '风险', '事实'], description: '记录退款申请、审核和到账全链路事件，用于异常退款识别。' },
  { code: 'DS-0931', name: '商品价格变更事件流', category: '商品主题域', type: '事件流', owner: '商品运营组', source: 'Kafka', rows: '日均 420 万', cycle: '实时', updatedAt: '刚刚', quality: 95, sensitivity: 'L1', tags: ['商品', '价格', '事件'], description: '实时汇聚商品售价、促销价和渠道价变更事件，保留完整版本。' },
  { code: 'DS-0894', name: '门店库存日快照', category: '供应链主题域', type: '宽表', owner: '供应链数据组', source: 'ERP', rows: '1.26 亿行', cycle: '每日 05:30', updatedAt: '4 小时前', quality: 92, sensitivity: 'L2', tags: ['库存', '门店', '快照'], description: '记录门店与中心仓 SKU 库存、在途和可售数量，支持周转分析。' },
  { code: 'DS-0852', name: '营销归因数据集', category: '经营指标', type: '主题集', owner: '营销增长组', source: 'CDP', rows: '6,482 万行', cycle: '每日 07:00', updatedAt: '3 小时前', quality: 91, sensitivity: 'L2', tags: ['营销', '归因', '渠道'], description: '融合广告触点、访问和转化链路，计算多模型渠道贡献度。' },
  { code: 'DS-0817', name: '供应商履约事实表', category: '供应链主题域', type: '事实表', owner: '采购管理部', source: 'SRM', rows: '568 万行', cycle: '每日 04:00', updatedAt: '6 小时前', quality: 89, sensitivity: 'L2', tags: ['供应商', '采购', '履约'], description: '归集采购订单、交付、质检与结算信息，支撑供应商绩效评估。' },
  { code: 'DS-0786', name: '用户行为主题宽表', category: '客户主题域', type: '宽表', owner: '用户增长组', source: '行为采集平台', rows: '18.7 亿行', cycle: '每 15 分钟', updatedAt: '8 分钟前', quality: 96, sensitivity: 'L3', tags: ['行为', '活跃', '漏斗'], description: '整合浏览、搜索、收藏和购买行为，提供统一用户会话视图。' },
  { code: 'DS-0741', name: '商品主数据主题集', category: '商品主题域', type: '主题集', owner: '商品数据组', source: 'MDM', rows: '842 万行', cycle: '每日 02:00', updatedAt: '8 小时前', quality: 99, sensitivity: 'L1', tags: ['商品', '主数据', '类目'], description: '提供标准商品、品牌、类目和规格属性，是商品分析统一维度。' },
]
const filteredDatasets = computed(() => datasets.filter(row => {
  const keyword = datasetQuery.value.keyword.trim().toLowerCase()
  const keywordMatched = !keyword || row.name.toLowerCase().includes(keyword) || row.code.toLowerCase().includes(keyword) || row.tags.some(tag => tag.includes(keyword))
  const categoryMatched = currentCategory.value === '全部数据资产' || row.category === currentCategory.value
  const typeMatched = !assetType.value || row.type === assetType.value
  const qualityMatched = !qualityLevel.value || (qualityLevel.value.startsWith('A级') ? row.quality >= 95 : qualityLevel.value.startsWith('B级') ? row.quality >= 90 && row.quality < 95 : row.quality < 90)
  return keywordMatched && categoryMatched && typeMatched && qualityMatched
}))
const domainCount = domain => domain === '全部数据资产' ? datasets.length : datasets.filter(item => item.category === domain).length

const detailMetrics = [
  { label: '本次读取', value: '2.31 亿', note: '扫描 18 个有效分区' },
  { label: '输出记录', value: '842 万', note: '结果已发布至主题集' },
  { label: '运行耗时', value: '4m 16s', note: '较上次缩短 12%' },
  { label: '资源消耗', value: '28 CU', note: '低于预算 4 CU' },
]
const detailInfo = [
  { label: '分析类型', value: '用户洞察 / 聚合分析' }, { label: '负责人', value: '陈序 · 用户增长组' },
  { label: '调度周期', value: '每日 08:00' }, { label: '资源队列', value: 'insight-pro' },
  { label: '结果更新', value: '增量写入 / 保留 90 天' }, { label: '失败策略', value: '自动重试 2 次' },
  { label: '运行引擎', value: 'Spark 3.5 / 18 并行度' }, { label: '创建时间', value: '2026-10-21 14:30' },
]
const qualityRules = [
  { name: '客户编号非空率', result: '100%', target: '目标 ≥ 99.9%' },
  { name: '交易金额有效率', result: '99.98%', target: '目标 ≥ 99.5%' },
  { name: '会员等级枚举校验', result: '100%', target: '目标 = 100%' },
  { name: '分区数据波动检查', result: '+3.2%', target: '阈值 ± 20%' },
]
const runs = [
  { title: '结果发布完成', time: '08:04:16', description: '842 万条记录写入客户复购主题集' },
  { title: '质量规则通过', time: '08:03:42', description: '6 条质量规则全部通过' },
  { title: '聚合计算完成', time: '08:03:18', description: '完成 30 / 60 / 90 天窗口统计' },
  { title: '数据读取完成', time: '08:01:06', description: '读取 18 个分区，共 186 GB' },
  { title: '实例开始运行', time: '08:00:00', description: '由每日调度计划自动触发' },
]

const memberMetrics = [
  { label: '工作区成员', value: '18', note: '本月新增 3 人' },
  { label: '当前在线', value: '7', note: '2 人正在编辑任务' },
  { label: '管理员', value: '3', note: '权限审计正常' },
  { label: '待处理邀请', value: '2', note: '将在 5 天后过期' },
]
const memberQuery = ref({ keyword: '' })
const memberRole = ref('')
const members = ref([
  { id: 1, name: '陈序', department: '用户增长组', role: '管理员', datasets: ['全部数据集'], tasks: 12, access: '管理', lastActive: '刚刚', status: '在线', email: 'chenxu@example.com', color: 'linear-gradient(135deg,#145fba,#07858d)' },
  { id: 2, name: '林默', department: '经营分析组', role: '分析师', datasets: ['区域经营指标集', '营销归因数据集'], tasks: 8, access: '编辑', lastActive: '12 分钟前', status: '在线', email: 'linmo@example.com', color: 'linear-gradient(135deg,#5b65c9,#145fba)' },
  { id: 3, name: '周青', department: '风控中心', role: '开发者', datasets: ['订单退款事实表', '支付事件流'], tasks: 6, access: '编辑', lastActive: '25 分钟前', status: '在线', email: 'zhouqing@example.com', color: 'linear-gradient(135deg,#07858d,#17a177)' },
  { id: 4, name: '苏禾', department: '供应链数据组', role: '分析师', datasets: ['门店库存日快照'], tasks: 5, access: '编辑', lastActive: '昨天', status: '离线', email: 'suhe@example.com', color: 'linear-gradient(135deg,#b87519,#d39a3b)' },
  { id: 5, name: '唐宁', department: '支付技术组', role: '开发者', datasets: ['支付链路事件流'], tasks: 4, access: '编辑', lastActive: '1 小时前', status: '在线', email: 'tangning@example.com', color: 'linear-gradient(135deg,#3e6994,#697f9a)' },
  { id: 6, name: '孟星', department: '商品运营组', role: '访客', datasets: ['商品主数据主题集'], tasks: 0, access: '只读', lastActive: '3 天前', status: '离线', email: 'mengxing@example.com', color: 'linear-gradient(135deg,#8656a8,#5b65c9)' },
  { id: 7, name: '许诺', department: '采购管理部', role: '分析师', datasets: ['供应商履约事实表'], tasks: 3, access: '编辑', lastActive: '2 小时前', status: '在线', email: 'xunuo@example.com', color: 'linear-gradient(135deg,#b34b65,#d16c7e)' },
  { id: 8, name: '季川', department: '营销增长组', role: '访客', datasets: ['营销归因数据集'], tasks: 0, access: '只读', lastActive: '尚未加入', status: '待加入', email: 'jichuan@example.com', color: 'linear-gradient(135deg,#697f9a,#94a4b8)' },
])
const roleOptions = optionize(['管理员', '分析师', '开发者', '访客'])
const accessOptions = optionize(['管理', '编辑', '只读'])
const datasetOptions = optionize(['全部数据集', ...datasets.slice(0, 8).map(item => item.name)])
const filteredMembers = computed(() => members.value.filter(row => {
  const keyword = memberQuery.value.keyword.trim()
  return (!keyword || row.name.includes(keyword) || row.role.includes(keyword) || row.department.includes(keyword)) && (!memberRole.value || row.role === memberRole.value)
}))
const memberVisible = ref(false)
const editingMember = ref(null)
const memberEditor = reactive({ name: '', role: '分析师', datasets: [], access: '只读', tasks: 0 })
const openInvite = () => { editingMember.value = null; Object.assign(memberEditor, { name: '', role: '分析师', datasets: [], access: '只读', tasks: 0 }); memberVisible.value = true }
const editMember = row => { editingMember.value = row.id; Object.assign(memberEditor, { name: row.name, role: row.role, datasets: [...row.datasets], access: row.access, tasks: row.tasks }); memberVisible.value = true }
const saveMember = () => {
  if (!memberEditor.name) return ElMessage.warning('请输入成员姓名')
  if (editingMember.value) Object.assign(members.value.find(row => row.id === editingMember.value), memberEditor)
  else members.value.push({ ...memberEditor, id: Date.now(), department: '待分配', lastActive: '尚未加入', status: '待加入', email: 'pending@example.com', color: 'linear-gradient(135deg,#697f9a,#94a4b8)' })
  memberVisible.value = false
  editingMember.value = null
  ElMessage.success('成员权限已保存')
}
</script>

<style scoped>
.asset-summary,.member-summary{margin-bottom:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.asset-summary article,.member-summary article{padding:13px 15px;border:1px solid var(--template-border);border-radius:11px;background:var(--template-surface);box-shadow:var(--template-shadow)}.asset-summary span,.asset-summary strong,.asset-summary small,.member-summary span,.member-summary strong,.member-summary small{display:block}.asset-summary span,.member-summary span{color:var(--template-text-soft);font-size:9px}.asset-summary strong,.member-summary strong{margin-top:5px;color:var(--template-heading);font-size:20px}.asset-summary small,.member-summary small{margin-top:3px;color:var(--template-success);font-size:9px}.asset-browser{display:grid;grid-template-columns:205px minmax(0,1fr);gap:14px;align-items:start}.domain-shelf{position:sticky;top:12px;padding:13px;border:1px solid var(--template-border);border-radius:13px;background:var(--template-surface-soft);box-shadow:var(--template-shadow)}.shelf-heading{margin:2px 6px 10px;display:flex;align-items:center;justify-content:space-between}.shelf-heading span{color:var(--template-heading);font-size:12px;font-weight:700}.shelf-heading small{color:var(--template-secondary);font-size:8px;font-weight:800}.domain-shelf button{width:100%;height:40px;padding:0 9px;display:grid;grid-template-columns:7px 1fr auto;align-items:center;gap:7px;color:var(--template-text);text-align:left;border:0;border-radius:8px;background:transparent;cursor:pointer}.domain-shelf button i{width:5px;height:5px;border-radius:50%;background:var(--template-border)}.domain-shelf button b{font-size:9px}.domain-shelf button.active{color:var(--template-primary);background:var(--template-surface);box-shadow:0 4px 14px rgba(32,72,111,.09)}.domain-shelf button.active i{background:var(--template-secondary);box-shadow:0 0 0 3px var(--template-secondary-soft)}.shelf-note{margin-top:12px;padding:12px;border-radius:9px;background:var(--template-secondary-soft)}.shelf-note strong,.shelf-note span,.shelf-note b{display:block}.shelf-note strong{font-size:10px}.shelf-note span{margin-top:4px;color:var(--template-text-soft);font-size:8px}.shelf-note b{margin-top:7px;color:var(--template-secondary);font-size:9px}.asset-main{min-width:0}.asset-toolbar{margin-bottom:12px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--template-border);border-radius:12px;background:var(--template-surface);box-shadow:var(--template-shadow)}.asset-toolbar>:deep(.pm-search){max-width:520px}.asset-filters{display:flex;gap:8px}.asset-filters>:deep(.el-select){width:132px}.dataset-card-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.dataset-card{padding:17px;border:1px solid var(--template-border);border-radius:13px;background:var(--template-surface);box-shadow:var(--template-shadow);transition:.2s}.dataset-card:hover{transform:translateY(-2px);border-color:var(--template-border);box-shadow:var(--template-shadow-hover)}.dataset-card header,.dataset-card footer,.quality-row{display:flex;align-items:center;justify-content:space-between}.dataset-card header>div{display:flex;align-items:center;gap:8px}.dataset-card header b{color:var(--template-secondary);font-size:9px}.dataset-card header>div span{padding-left:8px;color:var(--template-text-soft);border-left:1px solid var(--template-border);font-size:9px}.dataset-card h2{margin:15px 0 5px;color:var(--template-heading);font-size:15px}.dataset-card>p{min-height:34px;margin:0;color:var(--template-text-soft);font-size:10px;line-height:1.6}.dataset-tags{margin:10px 0;display:flex;gap:5px}.dataset-tags span{padding:3px 6px;color:var(--template-primary);border-radius:5px;background:var(--template-primary-soft);font-size:8px}.quality-row{margin-top:13px;color:var(--template-text-soft);font-size:9px}.quality-row b{color:var(--template-heading)}.quality-track{height:5px;margin:6px 0 13px;border-radius:99px;background:var(--template-border-light)}.quality-track i{height:100%;display:block;border-radius:inherit;background:linear-gradient(90deg,var(--template-primary),var(--template-secondary))}.dataset-card dl{margin:0;padding:11px 0;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--template-border-light);border-bottom:1px solid var(--template-border-light)}.dataset-card dt{color:var(--template-text-soft);font-size:8px}.dataset-card dd{margin:3px 0 0;font-size:9px;font-weight:650}.dataset-card footer{padding-top:11px;color:var(--template-text-soft);font-size:9px}.dataset-card footer strong{font-weight:500}.asset-empty{padding:60px;text-align:center;color:var(--template-text-soft);border:1px dashed var(--template-border);border-radius:12px;background:var(--template-surface)}.title-line{display:flex;align-items:center;gap:10px}.title-line h1{margin:0}.run-banner{margin-bottom:14px;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:20px;border:1px solid var(--template-border);border-radius:12px;background:var(--template-surface-soft);box-shadow:var(--template-shadow)}.run-banner>div{display:flex;align-items:center;gap:11px}.run-banner>div>i{width:28px;height:28px;border:8px solid var(--template-secondary-soft);border-top-color:var(--template-secondary);border-radius:50%}.run-banner strong,.run-banner small{display:block}.run-banner strong{font-size:12px}.run-banner small{margin-top:3px;color:var(--template-text-soft);font-size:9px}.run-banner dl{margin:0;display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.run-banner dt{color:var(--template-text-soft);font-size:8px}.run-banner dd{margin:3px 0 0;color:var(--template-heading);font-size:11px;font-weight:700}.detail-metrics .metric-card{padding:14px 16px}.detail-metrics .metric-card strong{font-size:22px}.detail-metrics .metric-card small{font-size:9px}.detail-workspace{display:grid;grid-template-columns:minmax(0,1fr) 285px;gap:14px}.detail-workspace main{min-width:0}.detail-workspace .panel{margin-bottom:14px}.detail-config .panel-title,.lineage-panel .panel-title,.quality-panel .panel-title{margin:0}.config-version{padding:4px 7px;color:var(--template-primary);border-radius:99px;background:var(--template-primary-soft);font-size:8px;font-weight:700}.lineage-panel .table-toolbar>div>p,.quality-panel .table-toolbar>div>p{margin:3px 0 0;color:var(--template-text-soft);font-size:9px}.lineage-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:10px;align-items:center}.lineage-flow>i{color:var(--template-primary);font-style:normal;font-weight:800}.lineage-node{padding:13px;border:1px solid var(--template-border);border-radius:10px;background:var(--template-surface-soft)}.lineage-node small,.lineage-node strong,.lineage-node span{display:block}.lineage-node small{color:var(--template-secondary);font-size:8px;font-weight:800}.lineage-node strong{margin-top:6px;font-size:11px}.lineage-node span{margin-top:4px;color:var(--template-text-soft);font-size:8px}.lineage-node.process{border-color:var(--template-primary-soft);background:var(--template-secondary-soft)}.quality-rules{display:grid;grid-template-columns:1fr 1fr;gap:8px}.quality-rules>div{padding:10px 12px;display:grid;grid-template-columns:1fr auto;gap:4px;border:1px solid var(--template-border-light);border-radius:9px;background:var(--template-surface-soft)}.quality-rules span{font-size:10px}.quality-rules span i{width:6px;height:6px;margin-right:6px;display:inline-block;border-radius:50%;background:var(--template-success)}.quality-rules b{color:var(--template-success);font-size:10px}.quality-rules em{grid-column:1/-1;color:var(--template-text-soft);font-size:8px;font-style:normal}.runtime-ring{width:116px;height:116px;margin:6px auto 17px;display:grid;place-content:center;text-align:center;border:12px solid var(--template-primary-soft);border-top-color:var(--template-secondary);border-right-color:var(--template-primary);border-radius:50%}.runtime-ring strong{font-size:19px}.runtime-ring span{color:var(--template-text-soft);font-size:8px}.runtime-panel dl{margin:0;display:grid;grid-template-columns:1fr 1fr;gap:9px}.runtime-panel dl div{padding:9px;border-radius:8px;background:var(--template-surface-soft)}.runtime-panel dt{color:var(--template-text-soft);font-size:8px}.runtime-panel dd{margin:3px 0 0;font-size:10px;font-weight:700}.member-toolbar{margin-bottom:14px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--template-border);border-radius:12px;background:var(--template-surface);box-shadow:var(--template-shadow)}.member-toolbar>:deep(.pm-search){max-width:500px}.member-toolbar>div{display:flex;align-items:center;gap:12px}.member-toolbar>div>:deep(.el-select){width:130px}.member-toolbar>div>span{color:var(--template-text-soft);font-size:9px}.member-card-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.member-card{padding:17px;border:1px solid var(--template-border);border-radius:13px;background:var(--template-surface);box-shadow:var(--template-shadow)}.member-card header,.member-card footer{display:flex;align-items:center;justify-content:space-between}.member-avatar{width:38px;height:38px;display:grid;place-items:center;color:var(--template-primary-contrast);border-radius:11px;font-weight:800}.member-name{margin:13px 0 5px;display:flex;align-items:center;justify-content:space-between}.member-name h2{margin:0;font-size:15px}.member-name span{color:var(--template-text-soft);font-size:8px}.member-card>b{color:var(--template-secondary);font-size:9px}.member-card>p{min-height:32px;margin:7px 0;color:var(--template-text-soft);font-size:9px;line-height:1.6}.member-card dl{margin:11px 0 0;padding:10px 0;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--template-border-light);border-bottom:1px solid var(--template-border-light)}.member-card dt{color:var(--template-text-soft);font-size:8px}.member-card dd{margin:3px 0 0;font-size:9px;font-weight:650}.member-card footer{padding-top:10px;color:var(--template-text-soft);font-size:8px}.member-editor{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.member-editor .editor-full{grid-column:1/-1}
@media(max-width:1050px){.member-card-grid{grid-template-columns:repeat(2,1fr)}.detail-workspace{grid-template-columns:1fr}.detail-workspace aside{display:grid;grid-template-columns:1fr 1fr;gap:14px}.detail-workspace aside .panel{margin-bottom:0}}
@media(max-width:800px){.asset-browser{grid-template-columns:1fr}.domain-shelf{position:static}.dataset-card-grid{grid-template-columns:1fr}.asset-summary,.member-summary{grid-template-columns:repeat(2,1fr)}.run-banner{align-items:flex-start;flex-direction:column}.run-banner dl{width:100%}.member-card-grid{grid-template-columns:1fr}}
@media(max-width:640px){.asset-toolbar,.member-toolbar{align-items:stretch;flex-direction:column}.asset-filters,.member-toolbar>div{align-items:stretch;flex-direction:column}.asset-filters>:deep(.el-select),.member-toolbar>div>:deep(.el-select){width:100%}.detail-workspace aside{grid-template-columns:1fr}.lineage-flow{grid-template-columns:1fr}.lineage-flow>i{transform:rotate(90deg);text-align:center}.quality-rules,.member-editor{grid-template-columns:1fr}.member-editor .editor-full{grid-column:auto}}
</style>
