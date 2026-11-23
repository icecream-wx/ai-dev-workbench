<template>
  <div class="optimized-suite classic-ops-admin">
    <div class="template-stage">
      <div class="business-page ops-ledger-page">
    <header class="page-heading ops-ledger-heading">
      <div><h1>通知公告管理</h1><p>统一管理运营制度、活动通知、发布范围和阅读反馈</p></div>
      <pm-toolbar class="heading-actions" :bordered="false">
        <pm-toolbar-item :icon="Download">导出台账</pm-toolbar-item>
        <pm-toolbar-item type="primary" :icon="Plus" @click="openEditor()">新建公告</pm-toolbar-item>
      </pm-toolbar>
    </header>

    <div class="ops-ledger-layout">
      <aside class="ops-ledger-sidebar">
        <section class="ledger-search-card">
          <span class="ledger-section-index">01 / 检索台账</span>
          <pm-search v-model:query="filters" default-prop="title" placeholder="搜索标题、编号" @search="currentPage = 1">
            <template #body>
              <el-form-item label="发布状态" prop="status"><pm-select size="default" v-model="filters.status" :options="statusOptions" clearable placeholder="全部状态" /></el-form-item>
              <el-form-item label="目标受众" prop="audience"><pm-select size="default" v-model="filters.audience" :options="audienceOptions" clearable placeholder="全部受众" /></el-form-item>
            </template>
          </pm-search>
          <button type="button" class="ledger-reset" @click="reset">清空全部筛选</button>
        </section>
        <section class="ledger-summary">
          <span class="ledger-section-index">02 / 发布概况</span>
          <div><strong>{{rows.length}}</strong><span>全部公告</span></div>
          <div><strong>{{publishedCount}}</strong><span>已发布</span></div>
          <div><strong>{{draftCount}}</strong><span>待完善草稿</span></div>
          <div><strong>{{scheduledCount}}</strong><span>定时发布</span></div>
        </section>
        <section class="ledger-attention">
          <span class="ledger-section-index">今日关注</span>
          <p><b>3</b> 条公告阅读率低于 85%</p>
          <p><b>2</b> 条定时公告等待发布</p>
        </section>
      </aside>

      <section class="panel ops-ledger-table">
        <div class="ledger-table-title">
          <div><span class="ledger-section-index">03 / 公告明细</span><h2>发布记录</h2></div>
          <div class="ledger-update"><span class="status-chip status-success">数据已同步</span><small>最近更新 10:24</small></div>
        </div>
        <div class="table-toolbar">
          <pm-toolbar class="table-toolbar-left" :bordered="false">
            <pm-toolbar-item type="primary" plain :disabled="!selected.length">批量发布</pm-toolbar-item>
            <pm-toolbar-item :disabled="!selected.length">归档</pm-toolbar-item>
            <pm-toolbar-item :disabled="!selected.length">变更受众</pm-toolbar-item>
          </pm-toolbar>
          <small>当前筛选 {{filteredRows.length}} 条，已选 {{selected.length}} 条</small>
        </div>
        <pm-table :table-data="pagedRows" :columns="columns" checked show-index @changrows="selected=$event">
          <template #title="{row}"><div class="notice-title"><strong>{{row.title}}</strong><span>{{row.code}} · {{row.category}}</span></div></template>
          <template #readRate="{row}"><div class="read-progress"><span><i :style="{width:row.readRate+'%'}" /></span><b>{{row.readRate}}%</b></div></template>
          <template #status="{row}"><span class="status-chip" :class="statusClass(row.status)">{{row.status}}</span></template>
          <template #action="{row}"><button class="link-button" @click="openEditor(row)">编辑</button><button class="link-button" @click="toggleStatus(row)">{{row.status==='已发布'?'下线':'发布'}}</button></template>
        </pm-table>
        <div class="table-footer"><span>共 {{filteredRows.length}} 条公告 · 本月新增 18 条</span><pm-pagination v-model:current-page="currentPage" background layout="prev, pager, next" :page-size="pageSize" :total="filteredRows.length" /></div>
      </section>
    </div>

    <pm-form-dialog v-model:dialog-visible="editorVisible" :title="editingId?'编辑公告':'新建公告'" width="580px" @submit="save">
      <template #form>
        <el-form :model="editor" label-position="top" style="padding:20px">
          <el-form-item label="公告标题" prop="title" required><pm-input size="default" v-model="editor.title" placeholder="请输入公告标题" /></el-form-item>
          <div class="dialog-form-grid"><el-form-item label="公告分类" prop="category"><pm-select size="default" v-model="editor.category" :options="categoryOptions" /></el-form-item><el-form-item label="发布状态" prop="status"><pm-select size="default" v-model="editor.status" :options="statusOptions" /></el-form-item></div>
          <el-form-item label="目标受众" prop="audience"><pm-select size="default" v-model="editor.audience" :options="audienceOptions" style="width:100%" /></el-form-item>
        </el-form>
      </template>
    </pm-form-dialog>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Plus } from '@element-plus/icons-vue'


const statusOptions=['已发布','定时发布','草稿','已归档'].map(value=>({label:value,value}))
const audienceOptions=['全体员工','运营中心','客服团队'].map(value=>({label:value,value}))
const categoryOptions=['运营制度','活动通知','服务规范','系统公告'].map(value=>({label:value,value}))
const filters=ref({title:'',status:'',audience:''}),selected=ref([]),currentPage=ref(1),pageSize=8
const rows=ref([
  {id:1,code:'NT-2026-118',title:'双十一大促客服排班与升级机制',category:'服务规范',audience:'客服团队',publisher:'林晓',publishAt:'11-10 09:30',readRate:96,status:'已发布'},
  {id:2,code:'NT-2026-117',title:'订单异常工单处理时限调整通知',category:'运营制度',audience:'运营中心',publisher:'周宁',publishAt:'11-09 16:00',readRate:88,status:'已发布'},
  {id:3,code:'NT-2026-116',title:'会员权益规则更新说明',category:'活动通知',audience:'全体员工',publisher:'王可',publishAt:'计划 11-12',readRate:0,status:'定时发布'},
  {id:4,code:'NT-2026-115',title:'夜间值班应急联系人变更',category:'服务规范',audience:'客服团队',publisher:'陈雨',publishAt:'11-07 10:10',readRate:100,status:'已归档'},
  {id:5,code:'NT-2026-114',title:'新客首单补贴活动上线',category:'活动通知',audience:'运营中心',publisher:'赵洋',publishAt:'11-06 11:30',readRate:92,status:'已发布'},
  {id:6,code:'NT-2026-113',title:'工单质检抽样规则试运行',category:'运营制度',audience:'客服团队',publisher:'林晓',publishAt:'刚刚保存',readRate:0,status:'草稿'},
  {id:7,code:'NT-2026-112',title:'运营数据周报提交流程',category:'运营制度',audience:'全体员工',publisher:'周宁',publishAt:'11-04 08:50',readRate:84,status:'已发布'},
  {id:8,code:'NT-2026-111',title:'收银台服务降级演练安排',category:'系统公告',audience:'运营中心',publisher:'苏禾',publishAt:'计划 11-13',readRate:0,status:'定时发布'},
  {id:9,code:'NT-2026-110',title:'会员日活动素材提报规范',category:'活动通知',audience:'全体员工',publisher:'王可',publishAt:'11-03 13:20',readRate:79,status:'已发布'},
  {id:10,code:'NT-2026-109',title:'客服满意度回访话术升级',category:'服务规范',audience:'客服团队',publisher:'陈雨',publishAt:'刚刚保存',readRate:0,status:'草稿'},
  {id:11,code:'NT-2026-108',title:'营销费用报销材料清单',category:'运营制度',audience:'运营中心',publisher:'赵洋',publishAt:'11-02 09:15',readRate:91,status:'已发布'},
  {id:12,code:'NT-2026-107',title:'季度运营复盘会议纪要',category:'系统公告',audience:'全体员工',publisher:'周宁',publishAt:'11-01 17:40',readRate:98,status:'已归档'},
])
const columns=[{prop:'title',label:'公告信息',minWidth:270,scope:'title'},{prop:'audience',label:'目标受众',width:105},{prop:'publisher',label:'发布人',width:85},{prop:'publishAt',label:'发布时间',width:120},{prop:'readRate',label:'阅读率',width:125,scope:'readRate'},{prop:'status',label:'状态',width:100,scope:'status'},{prop:'action',label:'操作',width:120,scope:'action',fixed:'right'}]
const filteredRows=computed(()=>rows.value.filter(row=>(!filters.value.title||`${row.title}${row.code}`.includes(filters.value.title))&&(!filters.value.status||row.status===filters.value.status)&&(!filters.value.audience||row.audience===filters.value.audience)))
const pagedRows=computed(()=>filteredRows.value.slice((currentPage.value-1)*pageSize,currentPage.value*pageSize))
const publishedCount=computed(()=>rows.value.filter(row=>row.status==='已发布').length)
const draftCount=computed(()=>rows.value.filter(row=>row.status==='草稿').length)
const scheduledCount=computed(()=>rows.value.filter(row=>row.status==='定时发布').length)
const editorVisible=ref(false),editingId=ref(null),editor=reactive({title:'',category:'运营制度',status:'草稿',audience:'全体员工'})
const reset=()=>{filters.value={title:'',status:'',audience:''};currentPage.value=1}
const statusClass=status=>({已发布:'status-success',定时发布:'status-warning',草稿:'status-warning',已归档:'status-neutral'}[status])
const openEditor=row=>{editingId.value=row?.id||null;Object.assign(editor,row||{title:'',category:'运营制度',status:'草稿',audience:'全体员工'});editorVisible.value=true}
const save=()=>{if(!editor.title.trim())return ElMessage.warning('请输入公告标题');if(editingId.value)Object.assign(rows.value.find(row=>row.id===editingId.value),editor);else rows.value.unshift({...editor,id:Date.now(),code:`NT-2026-${120+rows.value.length}`,publisher:'当前用户',publishAt:'刚刚',readRate:0});editorVisible.value=false;ElMessage.success('公告已保存')}
const toggleStatus=row=>{row.status=row.status==='已发布'?'已归档':'已发布';ElMessage.success(`公告已${row.status==='已发布'?'发布':'下线'}`)}
</script>

<style scoped>
.ops-ledger-heading{margin-bottom:16px}.ops-ledger-layout{display:grid;grid-template-columns:278px minmax(0,1fr);gap:18px;align-items:start}.ops-ledger-sidebar{position:sticky;top:12px;display:grid;gap:14px}.ledger-search-card,.ledger-summary,.ledger-attention{padding:18px;border:1px solid var(--template-border);border-radius:var(--template-radius);background:var(--template-surface);box-shadow:var(--template-shadow)}.ledger-section-index{display:block;margin-bottom:14px;color:var(--template-primary);font-size:10px;font-weight:800;letter-spacing:.1em}.ledger-search-card :deep(.pm-search-body){display:grid;grid-template-columns:1fr}.ledger-search-card :deep(.pm-search-main){align-items:stretch;flex-direction:column}.ledger-search-card :deep(.pm-search-main .el-button){width:100%}.ledger-reset{margin-top:13px;padding:0;color:var(--template-text-soft);border:0;border-bottom:1px solid currentColor;background:transparent;font-size:11px;cursor:pointer}.ledger-summary{display:grid;grid-template-columns:1fr 1fr}.ledger-summary>.ledger-section-index{grid-column:1/-1}.ledger-summary div{padding:11px 0;border-top:1px solid var(--template-border-light)}.ledger-summary strong,.ledger-summary span{display:block}.ledger-summary strong{color:var(--template-heading);font:700 25px Georgia,serif}.ledger-summary div span{margin-top:4px;color:var(--template-text-soft);font-size:11px}.ledger-attention{border-left:3px solid var(--template-warning);background:#fffbf0}.ledger-attention p{margin:8px 0;color:var(--template-text-soft);font-size:11px}.ledger-attention b{color:var(--template-warning);font-size:15px}.ops-ledger-table{min-width:0;margin:0;padding:0 18px 16px}.ledger-table-title{margin:0 -18px 14px;padding:18px;display:flex;align-items:flex-end;justify-content:space-between;border-bottom:1px solid var(--template-border)}.ledger-table-title .ledger-section-index{margin-bottom:4px}.ledger-table-title h2{margin:0;color:var(--template-heading);font:650 21px Georgia,"Songti SC",serif}.ledger-update{display:flex;align-items:center;gap:10px}.ledger-update small{color:var(--template-text-soft)}.notice-title strong,.notice-title span{display:block}.notice-title strong{color:var(--template-heading);font-size:12px}.notice-title span{margin-top:4px;color:var(--template-text-soft);font-size:10px}.read-progress{display:flex;align-items:center;gap:8px}.read-progress>span{width:62px;height:5px;overflow:hidden;border-radius:5px;background:var(--template-border-light)}.read-progress i{height:100%;display:block;border-radius:inherit;background:var(--template-primary)}.read-progress b{color:var(--template-text-soft);font-size:10px}.dialog-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:960px){.ops-ledger-layout{grid-template-columns:1fr}.ops-ledger-sidebar{position:static;grid-template-columns:1fr 1fr}.ledger-attention{grid-column:1/-1}}@media(max-width:640px){.ops-ledger-sidebar,.dialog-form-grid{grid-template-columns:1fr}.ledger-attention{grid-column:auto}.ledger-table-title{align-items:flex-start;flex-direction:column;gap:8px}}
</style>
