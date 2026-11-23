<template>
  <div class="optimized-suite application-type-operations">
    <div class="template-stage">
      <div class="business-page component-form-page">
    <header class="page-heading"><div><h1>运营活动配置</h1><p>配置会员日活动内容、触达策略、预算和权益规则</p></div><pm-toolbar class="heading-actions" :bordered="false"><pm-toolbar-item>预览活动</pm-toolbar-item><pm-toolbar-item>保存草稿</pm-toolbar-item><pm-toolbar-item type="primary" @click="submit">提交审批</pm-toolbar-item></pm-toolbar></header>
    <div class="activity-overview"><div><span>活动编号</span><strong>{{form.code||'自动生成'}}</strong></div><div><span>当前状态</span><strong class="status">配置中</strong></div><div><span>目标用户</span><strong>{{form.target.toLocaleString()}} 人</strong></div><div><span>预算金额</span><strong>¥ {{form.budget.toLocaleString()}}</strong></div><div><span>负责人</span><strong>陈悦</strong></div></div>
    <el-form :model="form" label-position="top" class="component-form">
      <section class="panel component-section">
        <div class="section-heading"><b>01</b><div><h2>活动基本信息</h2><p>活动名称、编号、目标、预算和执行说明</p></div><span class="section-status">已完成 7 / 8</span></div>
        <div class="component-grid">
          <el-form-item label="单行文本"><pm-input size="default" v-model="form.name" placeholder="请输入活动名称" /></el-form-item>
          <el-form-item label="自动编号"><pm-auto-number size="default" v-model="form.code" readonly /></el-form-item>
          <el-form-item label="多行文本" class="span-2"><pm-textarea size="default" v-model="form.summary" :rows="3" placeholder="请输入活动说明" /></el-form-item>
          <el-form-item label="计数器"><pm-number size="default" v-model="form.stock" :min="0" :max="999" /></el-form-item>
          <el-form-item label="数字"><pm-number size="default" v-model="form.target" :min="0" /></el-form-item>
          <el-form-item label="金额"><pm-number size="default" v-model="form.budget" :precision="2" prefix-value="¥" /></el-form-item>
          <el-form-item label="数字区间"><pm-number-range size="default" v-model="form.minDiscount" v-model:value2="form.maxDiscount" placeholder="最低折扣" placeholder2="最高折扣" /></el-form-item>
          <el-form-item label="编辑器" class="span-2"><pm-richtext v-model="form.content" /></el-form-item>
        </div>
      </section>

      <section class="panel component-section">
        <div class="section-heading"><b>02</b><div><h2>触达与素材策略</h2><p>配置活动类型、渠道、周期、主题色和物料</p></div><span class="section-status warning">待补充素材</span></div>
        <div class="component-grid selection-grid">
          <el-form-item label="下拉选择"><pm-select size="default" v-model="form.type" :options="typeOptions" /></el-form-item>
          <el-form-item label="树形下拉"><pm-select-tree size="default" v-model="form.category" :settings="categoryTreeSettings" placeholder="请选择活动分类" /></el-form-item>
          <el-form-item label="单选框组"><pm-radio size="default" v-model="form.priority" :settings="prioritySettings" /></el-form-item>
          <el-form-item label="多选框组"><pm-checkbox size="default" v-model="form.channels" :settings="channelSettings" /></el-form-item>
          <el-form-item label="开关"><pm-switch size="default" :model-value="String(form.enabled)" active-text="启用活动" @update:model-value="form.enabled = $event === 'true'" /></el-form-item>
          <el-form-item label="时间选择"><pm-time-select size="default" v-model="form.publishTime" placeholder="选择发布时间" /></el-form-item>
          <el-form-item label="日期选择"><pm-datepicker size="default" v-model="form.publishDate" type="date" /></el-form-item>
          <el-form-item label="日期区间"><pm-datepick-range size="default" v-model="form.activeStart" v-model:value2="form.activeEnd" type="date" value-format="YYYY-MM-DD" /></el-form-item>
          <el-form-item label="评分"><el-rate v-model="form.rating" show-score /></el-form-item>
          <el-form-item label="颜色选择"><el-color-picker v-model="form.color" show-alpha /></el-form-item>
          <el-form-item label="附件上传"><pm-upload v-model="form.attachmentIds" multiple list-type="list" :headers="{}" /></el-form-item>
          <el-form-item label="图片"><pm-image :img-url="coverImage" img-width="100%" img-height="116px" style="width:100%;height:116px" /></el-form-item>
        </div>
      </section>

      <section class="panel component-section">
        <div class="section-heading"><b>03</b><div><h2>责任人与权益规则</h2><p>选择执行团队、责任岗位、关联方案和权益明细</p></div><span class="section-status">已配置 3 条规则</span></div>
        <div class="component-grid">
          <el-form-item label="人员选择"><pm-select-user size="default" v-model="form.owner" :selected="selectedOwner" clearable show-code /></el-form-item>
          <el-form-item label="机构选择"><pm-select-org size="default" v-model="form.org" :selected="selectedOrg" clearable /></el-form-item>
          <el-form-item label="岗位选择"><pm-select-position size="default" v-model="form.position" :entity-model="selectedPosition" clearable /></el-form-item>
          <el-form-item label="弹窗选择"><pm-lookup size="default" v-model="form.plan" :selected="selectedPlan" entity="marketingPlan" value-field="id" label-field="name" /></el-form-item>
        </div>
        <pm-divider content-position="left" title-text="子表格" />
        <pm-table :table-data="rules" :columns="ruleColumns" />
      </section>
    </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import coverImage from '../assets/ledger-workflow.svg'


const form = reactive({ name: '暖冬会员感恩回馈季', code: 'ACT-202611-0086', summary: '面向 V2 及以上会员开展暖冬回馈活动，通过满减券、双倍积分和专属客服权益提升活跃度与复购率。', stock: 680, target: 12000, budget: 68000, minDiscount: 8, maxDiscount: 9.5, content: '<h3>活动目标</h3><p>活动周期内会员复购率提升 8%，沉睡会员召回 1,500 人。</p><h3>执行要求</h3><p>每日 10:00 更新权益领取与核销数据，异常领取记录需在 2 小时内完成复核。</p>', type: '会员活动', category: 'member', priority: '高', channels: '站内,短信,邮件', enabled: true, publishTime: '10:00', publishDate: '2026-11-15', activeStart: '2026-11-15', activeEnd: '2026-12-15', rating: 4.6, color: '#c2542a', attachmentIds: '', owner: 'u01', org: 'o01', position: 'p01', plan: 'plan-01' })
const typeOptions = ['会员活动','促销活动','内容运营'].map(value => ({ label: value, value }))
const priorityOptions = ['高','中','低'].map(value => ({ label: value, value }))
const channelOptions = ['站内','短信','邮件'].map(value => ({ label: value, value }))
const prioritySettings = { type: 'custom', options: priorityOptions }
const channelSettings = { type: 'custom', options: channelOptions }
const categoryTree = [{ label: '用户运营', value: 'user', children: [{ label: '会员成长', value: 'member' }, { label: '用户召回', value: 'recall' }] }, { label: '交易运营', value: 'trade', children: [{ label: '满减促销', value: 'discount' }] }]
const categoryTreeSettings = { cascaderPanelType: 'json', modePanel: 'tree', JsonPanel: { label: 'label', value: 'value', children: 'children', options: categoryTree } }
const selectedOwner = { id: 'u01', name: '陈悦', code: 'chen.yue' }
const selectedOrg = { id: 'o01', name: '用户运营中心', code: 'USER-OPS' }
const selectedPosition = { id: 'p01', name: '高级活动运营', code: 'OP-P6' }
const selectedPlan = { id: 'plan-01', name: '2026 暖冬会员增长方案' }
const rules = [{ name: '新会员首单礼', condition: '注册 7 天内且未下单', reward: '满 100 减 20', quota:'2,000 份' }, { name: '高价值会员回馈', condition: '会员等级 ≥ V3', reward: '积分 2 倍',quota:'不限量' }, {name:'沉睡会员召回',condition:'连续 90 天未下单',reward:'无门槛 15 元券',quota:'1,500 份'}]
const ruleColumns = [{ prop: 'name', label: '规则名称', minWidth: 160 }, { prop: 'condition', label: '适用条件', minWidth: 190 }, { prop: 'reward', label: '权益内容', minWidth: 160 },{prop:'quota',label:'发放额度',width:120}]
const submit = () => ElMessage.success('活动配置已提交')
</script>

<style scoped>
.component-form-page .page-heading{padding:4px 0 14px;border-bottom:1px solid var(--template-border)}.activity-overview{margin-bottom:16px;display:grid;grid-template-columns:repeat(5,1fr);border:1px solid var(--template-border);border-radius:var(--template-radius);background:var(--template-surface);box-shadow:var(--template-shadow)}.activity-overview>div{padding:14px 16px;border-right:1px solid var(--template-border-light)}.activity-overview>div:last-child{border-right:0}.activity-overview span,.activity-overview strong{display:block}.activity-overview span{color:var(--template-text-soft);font-size:9px}.activity-overview strong{margin-top:5px;color:var(--template-heading);font-size:12px}.activity-overview strong.status{color:var(--template-warning)}.component-form{display:grid;gap:16px}.component-section{margin:0}.section-heading{margin-bottom:18px;display:flex;align-items:center;gap:12px}.section-heading>b{width:30px;height:30px;display:grid;place-items:center;color:var(--template-primary-contrast);border-radius:3px;background:var(--template-primary);font-size:11px}.section-heading h2,.section-heading p{margin:0}.section-heading h2{color:var(--template-heading);font-family:Georgia,"Songti SC",serif;font-size:16px}.section-heading p{margin-top:4px;color:var(--template-text-soft);font-size:11px}.section-status{margin-left:auto;padding:5px 8px;color:var(--template-success);border-radius:3px;background:var(--template-success-soft);font-size:9px;font-weight:700}.section-status.warning{color:var(--template-warning);background:var(--template-warning-soft)}.component-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 22px}.span-2{grid-column:1/-1}.selection-grid :deep(.el-upload){width:100%}.selection-grid :deep(.el-upload-dragger){padding:16px}.component-section :deep(.pm-richtext-editor){min-height:150px}@media(max-width:900px){.activity-overview{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.component-grid,.activity-overview{grid-template-columns:1fr}.activity-overview>div{border-right:0;border-bottom:1px solid var(--template-border-light)}.span-2{grid-column:auto}.section-heading{align-items:flex-start}.section-status{display:none}}
</style>
