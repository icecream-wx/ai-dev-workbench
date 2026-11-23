<template>
  <section class="pt-tree-panel" :class="{ 'is-flat': isFlat }" :data-action-style="effectiveActionStyle"
    :data-selection-style="effectiveSelectionStyle">
    <header v-if="isFlat && effectiveActionStyle === 'header'" class="pt-tree-panel-header">
      <h3>{{ title }}</h3>
      <el-button v-if="showCreate" class="pt-tree-panel-add" :icon="Plus" :disabled="createDisabled"
        :aria-label="createText" :title="createText" @click="$emit('create')" />
    </header>
    <el-input v-if="searchable" v-model="keyword" class="pt-tree-panel-search" clearable :prefix-icon="Search"
      :placeholder="searchPlaceholder" :aria-label="searchPlaceholder" />
    <div class="pt-tree-panel-body">
      <slot :keyword="keyword" :selectionStyle="effectiveSelectionStyle" :isFlat="isFlat" />
    </div>
    <footer v-if="isFlat && effectiveActionStyle === 'footer' && (showCreate || $slots.footer)" class="pt-tree-panel-footer al-action-button">
      <slot name="footer">
        <el-button plain class="w-full" :icon="Plus" :disabled="createDisabled" @click="$emit('create')">{{ createText }}</el-button>
      </slot>
    </footer>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElButton, ElInput } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { resolvePagePreferences } from './utils.js'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  preference: { type: Object, default: () => ({}) },
  selectionStyle: { type: String, default: '', validator: value => ['', 'platform', 'dot'].includes(value) },
  actionStyle: { type: String, default: '', validator: value => ['', 'header', 'footer'].includes(value) },
  title: { type: String, default: '分组导航' },
  structure: { type: String, default: 'flat', validator: value => ['flat', 'tree'].includes(value) },
  searchable: { type: Boolean, default: true },
  searchPlaceholder: { type: String, default: '搜索分组' },
  showCreate: { type: Boolean, default: true },
  createText: { type: String, default: '新建分组' },
  createDisabled: { type: Boolean, default: false },
  actions: { type: [Array, Function], default: () => [] }
})
const emit = defineEmits(['create', 'search'])
const keyword = ref('')
// 页面显式属性优先，偏好切换不重建树或清空选择。
const effectiveActionStyle = computed(() =>
  props.actionStyle || resolvePagePreferences(props.preference).treePanel.actionStyle)
const effectiveSelectionStyle = computed(() =>
  props.selectionStyle || resolvePagePreferences(props.preference).treePanel.selectionStyle)
// 结构由页面明确指定，外壳不读取业务树数据。
const isFlat = computed(() => props.structure === 'flat')
watch(keyword, value => emit('search', value))
</script>

<style scoped>
.pt-tree-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; gap: 10px; }
.pt-tree-panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 8px 8px; }
.pt-tree-panel-header h3 { margin: 0; color: var(--pt-sidebar-heading, var(--el-text-color-primary)); font-size: 15px; font-weight: 700; }
.pt-tree-panel-header .pt-tree-panel-add { width: 30px; height: 30px; padding: 0; border: 0; border-radius: var(--pt-control-radius, 8px); background: var(--pt-sidebar-selected, var(--el-color-primary-light-9)); color: var(--pt-sidebar-active, var(--el-color-primary)); font-size: 20px; }
.pt-tree-panel-header .pt-tree-panel-add.is-disabled { opacity: .5; }
.pt-tree-panel.is-flat[data-action-style='header'] .pt-tree-panel-body :deep(.el-tree) { border-top: 0; }
.pt-tree-panel :deep(.pt-tree-panel-count) { color: var(--pt-search-placeholder, var(--el-text-color-placeholder)); font-size: 12px; }
.pt-tree-panel-search { padding-left: 8px; padding-right: 8px; box-sizing: border-box; }
.pt-tree-panel-body { flex: 1; min-height: 0; overflow: auto; }
.pt-tree-panel-body :deep(.el-tree) {
  width: 100%;
  min-width: 0;
  min-height: 100%;
  box-sizing: border-box;
  border-top: 1px solid var(--line, var(--el-border-color-light));
}
.pt-tree-panel-body :deep(.el-tree-node),
.pt-tree-panel-body :deep(.el-tree-node__content),
.pt-tree-panel-body :deep(.el-tree-node__children) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
}
.pt-tree-panel :deep(.pt-tree-panel-node) { display: flex; align-items: center; flex: 1 1 0; width: 0; max-width: 100%; min-width: 0; overflow: hidden; gap: 4px; }
.pt-tree-panel :deep(.pt-tree-panel-icon.svgicon) { width: 12px; height: 10px; margin-right: 10px; flex-shrink: 0; }
.pt-tree-panel :deep(.pt-tree-panel-label) { flex: 1 1 0; width: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pt-tree-panel :deep(.pt-tree-panel-more) { flex: none; margin-left: auto; opacity: 0; }
.pt-tree-panel :deep(.el-tree-node__content:hover .pt-tree-panel-more),
.pt-tree-panel :deep(.pt-tree-panel-node:focus-within .pt-tree-panel-more),
.pt-tree-panel :deep(.pt-tree-panel-more.is-open) { opacity: 1; }
.pt-tree-panel :deep(.pt-tree-panel-trigger) { display: inline-flex; align-items: center; padding: 4px; border: 0; background: transparent; color: var(--el-text-color-secondary); cursor: pointer; }
.pt-tree-panel :deep(.pt-tree-panel-trigger:hover) { color: var(--el-color-primary); }
.pt-tree-panel-footer { flex: none; box-sizing: border-box; }
.pt-tree-panel-footer .el-button { width: 100%; }
/* 圆点模式完整接管选中标识，避免与平台左侧高亮条及总体样式边框叠加。 */
.pt-tree-panel[data-selection-style='dot'] .pt-tree-panel-body :deep(.el-tree-node__content) {
  height: var(--pt-tree-height, 42px);
  padding-right: 12px;
  border-left: 0;
  border-radius: 8px;
}
.pt-tree-panel[data-selection-style='dot'].is-flat .pt-tree-panel-body :deep(.el-tree-node__expand-icon) { display: none; }
.pt-tree-panel :deep(.pt-tree-panel-dot) { flex: none; width: 7px; height: 7px; margin: 0 8px; border-radius: 50%; background: #b8c1d1; }
.pt-tree-panel[data-selection-style='dot'] :deep(.pt-tree-panel-node) { gap: 6px; }
.pt-tree-panel[data-selection-style='dot'] .pt-tree-panel-body :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--pt-sidebar-selected, #edf2ff) !important;
  color: var(--pt-sidebar-active, #2856dc);
  border-radius: 8px !important;
  font-weight: 650;
}
.pt-tree-panel[data-selection-style='dot'] .pt-tree-panel-body :deep(.el-tree-node.is-current > .el-tree-node__content)::before { display: none; }
.pt-tree-panel[data-selection-style='dot'] :deep(.el-tree-node.is-current > .el-tree-node__content .pt-tree-panel-dot) {
  background: var(--pt-sidebar-active, #4169ee);
  box-shadow: 0 0 0 4px var(--pt-tree-dot-halo, rgba(65, 105, 238, .12));
}
@media (hover: none) { .pt-tree-panel :deep(.pt-tree-panel-more) { opacity: 1; } }
</style>
<!-- Modified by AI on 2026-11-13 09:44:21 -->
