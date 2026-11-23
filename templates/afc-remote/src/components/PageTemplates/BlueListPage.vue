<template>
  <section class="pt-blue-list" :data-density="bindings.list.density">
    <header class="pt-blue-list__header">
      <div><slot name="header"><h2 v-if="title">{{ title }}</h2></slot></div>
      <PmToolbar class="pt-toolbar-blue">
        <slot name="actions">
          <PmToolbarItem v-if="showCreate" type="primary" :disabled="createDisabled || loading"
            @click="$emit('create')">新增{{ entityName }}</PmToolbarItem>
        </slot>
      </PmToolbar>
    </header>
    <el-form v-if="$slots.filters" class="pt-blue-list__query" :model="query" label-position="top"
      @submit.prevent="$emit('search')">
      <div v-show="expanded" class="pt-blue-list__fields"><slot name="filters" /></div>
      <div class="pt-blue-list__query-actions pt-toolbar-blue">
        <el-button text :aria-expanded="expanded" @click="toggle">
          {{ expanded ? '收起筛选' : '展开筛选' }}
          <el-icon><ArrowUp v-if="expanded" /><ArrowDown v-else /></el-icon>
        </el-button>
        <el-button :disabled="loading" @click="$emit('reset')">重置</el-button>
        <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
      </div>
    </el-form>
    <div v-if="selectionCount" class="pt-blue-list__selection pt-toolbar-blue">
      <span role="status">已勾选 <strong>{{ selectionCount }}</strong> 项</span>
      <el-button text :disabled="deleting" @click="$emit('clear-selection')">取消选择</el-button>
      <slot name="batch-actions">
        <el-button v-if="showBatchDelete" :loading="deleting" @click="$emit('batch-delete')">批量删除</el-button>
      </slot>
    </div>
    <div class="pt-blue-list__table">
      <slot table-class="pt-table-blue" :query-expanded="expanded" />
    </div>
    <footer v-if="$slots.pagination" class="al-footer pt-blue-list__pagination">
      <slot name="pagination" />
    </footer>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElButton, ElForm, ElIcon } from 'element-plus'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { resolvePagePreferences } from './utils.js'
import './list-blue.css'

const props = defineProps({
  title: { type: String, default: '' },
  entityName: { type: String, default: '记录' },
  query: { type: Object, required: true },
  preference: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  deleting: { type: Boolean, default: false },
  selectionCount: { type: Number, default: 0 },
  showCreate: { type: Boolean, default: true },
  createDisabled: { type: Boolean, default: false },
  showBatchDelete: { type: Boolean, default: true }
})
const emit = defineEmits(['search', 'reset', 'toggle', 'create', 'batch-delete', 'clear-selection'])
const bindings = computed(() => resolvePagePreferences(props.preference))
const expanded = ref(bindings.value.queryPanel.defaultExpanded)
// 折叠保留查询模型，仅通知页面重算表格高度。
function toggle() {
  expanded.value = !expanded.value
  emit('toggle', expanded.value)
}
</script>
<!-- Modified by AI on 2026-11-12 14:48:04 -->
