<template>
  <div class="optimized-suite application-type-operations">
    <div class="template-stage">
      <div class="business-page permission-ledger-page">
    <header class="page-heading"><div><h1>部门权限</h1><p>按组织维护菜单权限、数据范围和敏感操作授权</p></div><pm-toolbar class="heading-actions" :bordered="false"><pm-toolbar-item>权限变更记录</pm-toolbar-item><pm-toolbar-item type="primary" :icon="Plus" @click="visible=true">新增权限</pm-toolbar-item></pm-toolbar></header>
    <div class="permission-summary"><article><span>组织节点</span><strong>{{departments.length}}</strong><small>覆盖 4 个一级中心</small></article><article><span>授权成员</span><strong>248</strong><small>本月新增 12 人</small></article><article><span>权限项</span><strong>{{permissions.length}}</strong><small>{{enabledCount}} 项已启用</small></article><article><span>待审批申请</span><strong>6</strong><small class="warning">其中高风险 2 项</small></article></div>
    <section class="department-index">
      <div class="department-search"><div><strong>组织索引</strong><small>选择部门查看权限账簿</small></div><pm-search v-model:query="departmentQuery" default-prop="keyword" placeholder="搜索部门名称" /></div>
      <div class="department-cards"><button v-for="department in filteredDepartments" :key="department.id" type="button" :class="{active:current.id===department.id}" @click="current=department"><span>{{department.parent||'一级部门'}}</span><strong>{{department.label}}</strong><footer><small>{{department.memberCount||0}} 名成员</small><b>{{department.risk||0}} 项敏感权限</b></footer></button></div>
    </section>
    <section class="panel permission-matrix">
      <aside>
        <span>当前权限账簿</span><h2>{{current.label}}</h2>
        <div class="department-stat"><strong>{{current.memberCount||0}}</strong><small>组织成员</small></div>
        <dl><div><dt>负责人</dt><dd>{{current.owner||'周宁'}}</dd></div><div><dt>上次审计</dt><dd>2026-11-08</dd></div><div><dt>继承方式</dt><dd>{{current.parent?'继承并覆盖':'独立配置'}}</dd></div></dl>
        <el-button>套用权限模板</el-button><el-button text type="primary">查看成员清单</el-button>
      </aside>
      <main>
        <div class="table-toolbar"><div><strong>权限矩阵</strong><small>调整后即时生效并记录审计日志</small></div><div class="heading-actions"><span class="status-chip status-success">策略已同步</span><pm-toolbar :bordered="false"><pm-toolbar-item>批量编辑</pm-toolbar-item></pm-toolbar></div></div>
        <pm-table :table-data="permissions" :columns="columns">
          <template #name="{row}"><div class="permission-name"><i :class="row.level"/><div><strong>{{row.name}}</strong><span>{{row.code}}</span></div></div></template>
          <template #scope="{row}"><pm-select size="default" v-model="row.scope" :options="scopeOptions" /></template>
          <template #level="{row}"><span class="risk-level" :class="row.level">{{levelLabel(row.level)}}</span></template>
          <template #enabled="{row}"><pm-switch size="default" :model-value="String(row.enabled)" @update:model-value="row.enabled = $event === 'true'" /></template>
        </pm-table>
        <div class="permission-footer"><span>已启用 {{enabledCount}} / {{permissions.length}} 项权限</span><small>权限变更将同步到该部门 {{current.memberCount||0}} 名成员</small></div>
      </main>
    </section>
    <pm-form-dialog v-model:dialog-visible="visible" title="新增权限" width="500px" @submit="add"><template #form><el-form label-position="top" style="padding:20px"><el-form-item label="权限名称" required><pm-input size="default" v-model="permissionName" /></el-form-item><el-form-item label="数据范围"><pm-select size="default" v-model="scope" :options="scopeOptions" style="width:100%" /></el-form-item><el-form-item label="风险等级"><pm-select size="default" v-model="riskLevel" :options="riskOptions" style="width:100%" /></el-form-item></el-form></template></pm-form-dialog>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'


const tree=[
  {id:1,label:'运营中心',memberCount:86,owner:'周宁',risk:3,children:[{id:11,label:'活动运营组',memberCount:24,owner:'王可',risk:2},{id:12,label:'内容运营组',memberCount:18,owner:'林晓',risk:1},{id:13,label:'用户增长组',memberCount:21,owner:'赵洋',risk:2}]},
  {id:2,label:'客户服务中心',memberCount:64,owner:'陈雨',risk:4,children:[{id:21,label:'在线客服组',memberCount:32,owner:'陈悦',risk:2},{id:22,label:'客诉升级组',memberCount:15,owner:'许宁',risk:4}]},
  {id:3,label:'商品运营中心',memberCount:42,owner:'苏禾',risk:2,children:[{id:31,label:'品类运营组',memberCount:17,owner:'张然',risk:1},{id:32,label:'价格管理组',memberCount:12,owner:'王珂',risk:3}]},
  {id:4,label:'风控中心',memberCount:28,owner:'林川',risk:6,children:[{id:41,label:'交易风控组',memberCount:14,owner:'林川',risk:6}]},
]
const departments=tree.flatMap(parent=>[parent,...parent.children.map(child=>({...child,parent:parent.label}))])
const departmentQuery=ref({keyword:''})
const filteredDepartments=computed(()=>departments.filter(item=>!departmentQuery.value.keyword||item.label.includes(departmentQuery.value.keyword)))
const current=ref(tree[0])
const scopeOptions=['仅本部门','本部门及下级','指定业务线','全部数据'].map(value=>({label:value,value}))
const permissions=ref([
  {name:'通知公告管理',code:'ops:notice',category:'内容运营',scope:'本部门及下级',level:'normal',enabled:true},
  {name:'客服排班管理',code:'ops:schedule',category:'服务运营',scope:'仅本部门',level:'normal',enabled:true},
  {name:'订单异常处理',code:'ops:issue',category:'交易管理',scope:'指定业务线',level:'sensitive',enabled:true},
  {name:'运营报表查看',code:'ops:report',category:'数据权限',scope:'本部门及下级',level:'normal',enabled:true},
  {name:'营销费用审批',code:'ops:expense',category:'费用管理',scope:'仅本部门',level:'sensitive',enabled:false},
  {name:'会员权益调整',code:'ops:member-rights',category:'会员运营',scope:'指定业务线',level:'high',enabled:false},
  {name:'退款人工补账',code:'ops:refund-manual',category:'交易管理',scope:'仅本部门',level:'high',enabled:false},
  {name:'客户信息导出',code:'ops:customer-export',category:'数据权限',scope:'仅本部门',level:'high',enabled:true},
])
const columns=[{prop:'name',label:'权限项',minWidth:210,scope:'name'},{prop:'category',label:'业务分类',width:110},{prop:'scope',label:'数据范围',width:180,scope:'scope'},{prop:'level',label:'风险等级',width:105,scope:'level'},{prop:'enabled',label:'启用状态',width:100,scope:'enabled'}]
const enabledCount=computed(()=>permissions.value.filter(item=>item.enabled).length)
const levelLabel=value=>({normal:'普通',sensitive:'敏感',high:'高风险'}[value])
const visible=ref(false),permissionName=ref(''),scope=ref('仅本部门'),riskLevel=ref('normal')
const riskOptions=[{label:'普通',value:'normal'},{label:'敏感',value:'sensitive'},{label:'高风险',value:'high'}]
const add=()=>{if(!permissionName.value)return ElMessage.warning('请输入权限名称');permissions.value.push({name:permissionName.value,code:`ops:custom-${permissions.value.length+1}`,category:'自定义',scope:scope.value,level:riskLevel.value,enabled:true});visible.value=false;permissionName.value='';ElMessage.success('权限已添加')}
</script>

<style scoped>
.permission-summary{margin-bottom:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.permission-summary article{padding:15px 17px;border:1px solid var(--template-border);border-top:3px solid var(--template-secondary);border-radius:var(--template-radius);background:var(--template-surface);box-shadow:var(--template-shadow)}.permission-summary span,.permission-summary strong,.permission-summary small{display:block}.permission-summary span{color:var(--template-text-soft);font-size:10px}.permission-summary strong{margin-top:7px;color:var(--template-heading);font:700 24px Georgia,serif}.permission-summary small{margin-top:3px;color:var(--template-success);font-size:9px}.permission-summary small.warning{color:var(--template-warning)}.department-index{margin-bottom:16px;padding:18px;border:1px solid var(--template-border);border-radius:var(--template-radius);background:var(--template-surface-soft);box-shadow:var(--template-shadow)}.department-search{display:grid;grid-template-columns:190px minmax(280px,440px);align-items:center;gap:18px}.department-search>div strong,.department-search>div small{display:block}.department-search>div strong{color:var(--template-heading);font:650 16px Georgia,"Songti SC",serif}.department-search>div small{margin-top:4px;color:var(--template-text-soft);font-size:10px}.department-cards{margin-top:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.department-cards button{min-width:0;padding:13px;text-align:left;color:var(--template-text);border:1px solid var(--template-border);border-left:3px solid transparent;border-radius:var(--template-radius-small);background:var(--template-surface);cursor:pointer}.department-cards button:hover{border-color:var(--template-border)}.department-cards button.active{border-color:var(--template-border);border-left-color:var(--template-primary);background:var(--template-primary-soft)}.department-cards span,.department-cards strong{display:block}.department-cards span{color:var(--template-text-soft);font-size:9px}.department-cards strong{margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.department-cards footer{margin-top:10px;display:flex;align-items:center;justify-content:space-between;color:var(--template-text-soft);font-size:9px}.department-cards footer b{color:var(--template-warning);font-weight:600}.permission-matrix{padding:0;display:grid;grid-template-columns:225px minmax(0,1fr);overflow:hidden}.permission-matrix>aside{padding:22px;display:flex;align-items:flex-start;flex-direction:column;border-right:1px solid var(--template-border);background:var(--template-surface-soft)}.permission-matrix>aside>span{font-size:9px;font-weight:800;letter-spacing:.1em}.permission-matrix h2{margin:9px 0 18px;color:var(--template-heading);font:650 19px Georgia,"Songti SC",serif}.department-stat{width:100%;padding:14px 0;border-top:1px solid var(--template-border);border-bottom:1px solid var(--template-border)}.department-stat strong,.department-stat small{display:block}.department-stat strong{font:700 30px Georgia,serif}.department-stat small{color:var(--template-text-soft);font-size:9px}.permission-matrix dl{width:100%;margin:16px 0}.permission-matrix dl>div{padding:7px 0;display:flex;justify-content:space-between}.permission-matrix dt,.permission-matrix dd{font-size:9px}.permission-matrix dt{color:var(--template-text-soft)}.permission-matrix dd{margin:0;font-weight:650}.permission-matrix>aside .el-button{width:100%;margin:6px 0 0}.permission-matrix>main{min-width:0;padding:18px}.permission-matrix .table-toolbar>div>strong,.permission-matrix .table-toolbar>div>small{display:block}.permission-matrix .table-toolbar small{margin-top:3px}.permission-name{display:flex;align-items:center;gap:10px}.permission-name>i{width:8px;height:28px;border-radius:3px;background:var(--template-success)}.permission-name>i.sensitive{background:var(--template-warning)}.permission-name>i.high{background:var(--template-danger)}.permission-name strong,.permission-name span{display:block}.permission-name strong{font-size:12px}.permission-name span{margin-top:3px;color:var(--template-text-soft);font-family:monospace;font-size:9px}.risk-level{padding:4px 7px;border-radius:3px;font-size:10px;font-weight:700}.risk-level.normal{color:var(--template-success);background:var(--template-success-soft)}.risk-level.sensitive{color:var(--template-warning);background:var(--template-warning-soft)}.risk-level.high{color:var(--template-danger);background:var(--template-danger-soft)}.permission-footer{padding-top:14px;display:flex;align-items:center;justify-content:space-between;color:var(--template-text-soft);font-size:10px}@media(max-width:1050px){.department-cards{grid-template-columns:repeat(3,1fr)}}@media(max-width:800px){.permission-summary{grid-template-columns:repeat(2,1fr)}.department-search{grid-template-columns:1fr}.department-cards{grid-template-columns:repeat(2,1fr)}.permission-matrix{grid-template-columns:1fr}.permission-matrix>aside{border-right:0;border-bottom:1px solid var(--template-border)}}@media(max-width:560px){.permission-summary,.department-cards{grid-template-columns:1fr}.permission-footer{align-items:flex-start;flex-direction:column;gap:6px}}
</style>
