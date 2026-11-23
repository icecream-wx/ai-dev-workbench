<template>
  <section class="pt-query-panel" :class="{ 'pt-query-panel--header': layout === 'header' }">
    <header class="pt-query-panel__header">
      <h3>{{ title }}</h3>
      <el-tooltip :content="expanded ? '收起查询条件' : '展开查询条件'" placement="top">
        <el-button text :aria-expanded="expanded" :aria-label="expanded ? '收起查询条件' : '展开查询条件'"
          @click="toggle">
          <el-icon :size="16"><ArrowUp v-if="expanded" /><ArrowDown v-else /></el-icon>
        </el-button>
      </el-tooltip>
      <div v-if="layout === 'header'" class="pt-query-panel__header-actions">
        <slot name="actions">
          <el-button :disabled="loading" @click="$emit('reset')">重置</el-button>
          <el-button type="primary" :loading="loading" @click="$emit('search')">搜索</el-button>
        </slot>
      </div>
    </header>
    <el-form v-show="expanded" :model="model" :label-position="layout === 'header' ? 'top' : 'left'"
      :label-width="layout === 'header' ? 'auto' : '100px'" @submit.prevent="$emit('search')">
      <div class="pt-query-panel__row">
      <div class="pt-query-panel__fields"><slot /></div>
      <div v-if="layout !== 'header'" class="pt-query-panel__actions">
        <slot name="actions">
          <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
          <el-button :disabled="loading" @click="$emit('reset')">重置</el-button>
        </slot>
      </div>
      </div>
    </el-form>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { ElButton, ElForm, ElIcon, ElTooltip } from 'element-plus'
import { ArrowUp, ArrowDown } from '@element-plus/icons-vue'

const props = defineProps({
  title: { type: String, default: '查询条件' },
  model: { type: Object, required: true },
  layout: { type: String, default: 'grid', validator: value => ['grid', 'header'].includes(value) },
  defaultExpanded: { type: Boolean, default: true },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['search', 'reset', 'toggle'])
const expanded = ref(props.defaultExpanded)
function toggle() {
  expanded.value = !expanded.value
  emit('toggle', expanded.value)
}
</script>

<style scoped>
.pt-query-panel {
  padding: 12px 16px;
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: var(--el-border-radius-base, 4px);
  background: var(--el-bg-color, #fff);
  container-type: inline-size;
}
.pt-query-panel__header { display: flex; align-items: center; justify-content: space-between; }
.pt-query-panel__header h3 { margin: 0; font-size: 16px; color: var(--el-text-color-primary); }
.pt-query-panel--header { padding-bottom: 20px; }
.pt-query-panel--header .pt-query-panel__header { justify-content: flex-start; gap: 8px; }
.pt-query-panel__header-actions { display: flex; align-items: center; margin-left: auto; }
.pt-query-panel--header .pt-query-panel__row { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--el-border-color-lighter, #ebeef5); }
.pt-query-panel--header .pt-query-panel__fields :deep(.el-form-item__label) { line-height: 22px; margin-bottom: 6px; padding: 0; }
/* 字段与操作共享等宽网格，末项不拉满整行，按钮始终排在最后一行。 */
.pt-query-panel__row { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); align-items: start; gap: 12px 16px; margin-top: 8px; }
.pt-query-panel__fields { display: contents; }
.pt-query-panel__fields :deep(.el-form-item) { min-width: 0; width: 100%; margin: 0; }
.pt-query-panel__fields :deep(.el-form-item__content) { min-width: 0; }
.pt-query-panel__fields :deep(.el-form-item__label) { flex-shrink: 0; }
.pt-query-panel__fields :deep(.el-form-item__content > *) { width: 100%; min-width: 0; }
/* 操作区定位到末列，避免最后一行有空列时按钮停在中间。 */
.pt-query-panel__actions { grid-column: -2 / -1; display: flex; align-items: center; justify-content: flex-end; min-width: 0; }
@container (max-width: 520px) {
  .pt-query-panel__row { grid-template-columns: minmax(0, 1fr); }
}
</style>
<!-- Modified by AI on 2026-11-12 13:27:19 -->
