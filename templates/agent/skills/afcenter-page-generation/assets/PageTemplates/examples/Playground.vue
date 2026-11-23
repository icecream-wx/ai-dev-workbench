<template>
  <div>
    <el-form :inline="true" aria-label="模板偏好演示">
      <el-form-item label="操作按钮">
        <el-select v-model="GlobalPreference.blocks.actionBar.align" style="width: 120px">
          <el-option label="居左" value="start" /><el-option label="居右" value="end" />
        </el-select>
      </el-form-item>
      <el-form-item label="紧凑模式"><el-switch v-model="compact" /></el-form-item>
      <el-form-item label="查询模板">
        <el-select v-model="GlobalPreference.blocks.queryPanel.mode" style="width: 160px">
          <el-option label="快捷搜索 PmSearch" value="inline" />
          <el-option label="独立查询卡片" value="card" />
        </el-select>
      </el-form-item>
      <el-form-item label="查询卡片布局">
        <el-select v-model="GlobalPreference.blocks.queryPanel.layout" style="width: 160px">
          <el-option label="标签居左 / 底部按钮" value="grid" />
          <el-option label="标签在上 / 顶部按钮" value="header" />
        </el-select>
      </el-form-item>
      <el-form-item label="列操作">
        <el-select v-model="GlobalPreference.blocks.rowActions.mode" style="width: 150px">
          <el-option label="文字操作" value="text" />
          <el-option label="图标操作" value="icon" />
          <el-option label="超过两项收起" value="more" />
        </el-select>
      </el-form-item>
      <el-form-item label="分页模板">
        <el-select v-model="GlobalPreference.templates.list.paginationLayout" style="width: 160px">
          <el-option label="标准分页" value="bar" />
          <el-option label="分页拆分" value="split" />
          <el-option label="三段式分页" value="three-part" />
        </el-select>
      </el-form-item>
      <el-form-item label="表格边框"><el-switch v-model="GlobalPreference.tableConfig.border" /></el-form-item>
      <el-form-item label="表单两列"><el-switch v-model="twoColumns" /></el-form-item>
      <el-form-item label="表单标签">
        <el-select v-model="GlobalPreference.formConf.labelPosition" style="width: 120px">
          <el-option label="顶部" value="top" />
          <el-option label="左对齐" value="left" />
          <el-option label="右对齐" value="right" />
        </el-select>
      </el-form-item>
      <el-form-item label="查看展示">
        <el-select v-model="GlobalPreference.templates.form.viewDisplay" style="width: 160px">
          <el-option label="禁用组件" value="component" />
          <el-option label="只显示内容" value="text" />
        </el-select>
      </el-form-item>
    </el-form>
    <ListExample :preference="GlobalPreference" />
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { ElForm, ElFormItem, ElOption, ElSelect, ElSwitch } from 'element-plus'
import ListExample from './ListExample.vue'

const GlobalPreference = reactive({
  common: { density: 'comfortable' },
  blocks: { actionBar: { align: 'start' }, queryPanel: { mode: 'inline', defaultExpanded: true }, rowActions: { mode: 'text' } },
  templates: { list: { actionsAlign: null, paginationLayout: 'bar' }, form: { columns: 1, viewDisplay: 'component' } },
  tableConfig: { stripe: true, border: false, pageSizes: '[10,20,30,50,100]' },
  // 输入统计是偏好项而非模板写死：单行 text 默认关闭（演示默认值），多行 textarea 开启以演示偏好生效。
  text: { showWordLimit: false },
  textarea: { showWordLimit: true },
  formConf: { labelPosition: 'top' }
})
const compact = computed({
  get: () => GlobalPreference.common.density === 'compact',
  set: value => { GlobalPreference.common.density = value ? 'compact' : 'comfortable' }
})
const twoColumns = computed({
  get: () => GlobalPreference.templates.form.columns === 2,
  set: value => { GlobalPreference.templates.form.columns = value ? 2 : 1 }
})
</script>
<!-- Modified by AI on 2026-11-12 13:20:38 -->
