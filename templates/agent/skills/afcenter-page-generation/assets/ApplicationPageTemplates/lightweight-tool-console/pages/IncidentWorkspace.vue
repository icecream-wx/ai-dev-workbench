<template>
  <div class="optimized-suite lightweight-tool-console">
    <div class="template-stage">
      <div class="business-page layout-components-page">
    <header class="page-heading"><div><h1>处置工作区布局</h1><p>标签、折叠、卡片、分栏和操作组件组合</p></div><el-button type="primary" @click="save">保存布局</el-button></header>

    <section class="layout-board">
      <pm-card class="layout-card tabs-card">
        <template #header><strong>标签页</strong></template>
        <el-tabs v-model="activeTab"><el-tab-pane label="事件概览" name="overview">当前有 6 条活动事件，1 条严重事件等待处置。</el-tab-pane><el-tab-pane label="处置记录" name="records">最近一次处置由 ops-01 于 10:42 提交。</el-tab-pane><el-tab-pane label="关联规则" name="rules">已关联支付成功率、接口延迟两条监控规则。</el-tab-pane></el-tabs>
      </pm-card>

      <pm-card class="layout-card fold-card">
        <template #header><strong>折叠页 / 分组控制</strong></template>
        <pm-fold-group accordion><pm-fold name="1" title="基础信息">维护事件名称、责任人和严重等级。</pm-fold><pm-fold name="2" title="检测条件">配置指标、周期、操作符和阈值。</pm-fold><pm-fold name="3" title="响应动作">配置通知渠道与自动处置动作。</pm-fold></pm-fold-group>
      </pm-card>

      <pm-card class="layout-card split-card">
        <template #header><strong>分割面板</strong></template>
        <pm-split v-model="splitRatio" style="min-height:260px"><template #left><h3>事件队列</h3><ul class="event-list"><li v-for="item in events" :key="item.id"><b>{{item.id}}</b><span>{{item.name}}</span></li></ul></template><template #right><h3>处置详情</h3><div class="detail-copy"><strong>支付成功率连续下降</strong><p>当前成功率 82.4%，已影响 1,284 笔订单。</p><span>负责人：ops-01</span></div></template></pm-split>
      </pm-card>

      <pm-card class="layout-card table-layout-card">
        <template #header><strong>表格布局</strong></template>
        <pm-table :table-data="tableRows" :columns="columns" />
      </pm-card>

      <pm-card class="layout-card action-card">
        <template #header><strong>分割线、按钮组、按钮与备注</strong></template>
        <pm-divider content-position="left" title-text="处置操作" />
        <pm-toolbar>
          <pm-toolbar-item type="primary" @click="runAction('确认事件')">确认事件</pm-toolbar-item>
          <pm-toolbar-item @click="runAction('转交')">转交</pm-toolbar-item>
          <pm-toolbar-item @click="runAction('静默 30 分钟')">静默 30 分钟</pm-toolbar-item>
        </pm-toolbar>
        <pm-divider content-position="left" title-text="处置备注" />
        <pm-textarea size="default" v-model="remark" :rows="4" placeholder="记录处置过程、判断依据和后续计划" />
        <div class="single-button"><el-button type="primary" @click="save">提交处置</el-button></div>
      </pm-card>
    </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'


const activeTab = ref('overview')
const splitRatio = ref(0.38)
const remark = ref('已核对支付网关与渠道返回码，建议保留人工复核并继续观察 30 分钟。')
const events = [{ id: 'EVT-089', name: '支付成功率下降' }, { id: 'EVT-088', name: '接口延迟过高' }, { id: 'EVT-083', name: '同步任务积压' }]
const tableRows = [{ group: '基础信息', field: '事件名称', span: '2 列', required: '是' }, { group: '检测条件', field: '触发阈值', span: '1 列', required: '是' }, { group: '响应动作', field: '通知渠道', span: '1 列', required: '否' }]
const columns = [{ prop: 'group', label: '分组', width: 120 }, { prop: 'field', label: '字段', minWidth: 160 }, { prop: 'span', label: '布局跨度', width: 110 }, { prop: 'required', label: '必填', width: 80 }]
const runAction = label => ElMessage.success(`${label}操作已执行`)
const save = () => ElMessage.success('处置工作区已保存')
</script>

<style scoped>
.layout-components-page .page-heading{padding:4px 0 14px;border-bottom:1px solid #111}.layout-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.layout-card{min-width:0;border-color:#111}.split-card,.action-card{grid-column:1/-1}.layout-card :deep(.el-card__header){padding:13px 16px;border-bottom-color:#111;background:var(--template-surface-soft)}.layout-card :deep(.el-card__body){padding:16px}.split-card :deep(.el-card__body){padding:0}.event-list{margin:0;padding:0;list-style:none}.event-list li{padding:9px 0;display:grid;grid-template-columns:75px 1fr;border-bottom:1px solid var(--template-border-light);font-size:11px}.event-list b{font-family:monospace}.detail-copy strong,.detail-copy span{display:block}.detail-copy p{color:var(--template-text-soft);line-height:1.7}.detail-copy span{font-size:11px}.single-button{margin-top:12px;display:flex;justify-content:flex-end}@media(max-width:800px){.layout-board{grid-template-columns:1fr}.split-card,.action-card{grid-column:auto}.pm-split{grid-template-columns:1fr!important}.pm-split>section+section{border-top:1px solid #111;border-left:0}}
</style>
