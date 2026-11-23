<template>
  <PmSecondaryMenu class="pt-tree-list bg-radius" :class="{ 'pt-appearance': appearance !== 'platform' }"
    :data-appearance="appearance" :show-title="false" :right-title="false"
    :left-width="leftWidth" :allow-resize="allowResize">
    <template #left-body><div class="pt-tree-list-sidebar"><slot name="tree" /></div></template>
    <template #right-body>
      <slot name="query" />
      <BusinessListPage v-bind="{ ...bindings.list, ...$attrs }" :title="showTitle ? $attrs.title : ''">
        <template v-for="name in Object.keys($slots).filter(slot =>
          !['tree', 'query'].includes(slot) && (slot !== 'header' || showTitle))"
          :key="name" #[name]="scope">
          <slot :name="name" v-bind="scope || {}" />
        </template>
      </BusinessListPage>
    </template>
  </PmSecondaryMenu>
</template>

<script>
import BusinessListPage from './ListPage.vue'
import { resolvePagePreferences } from './utils.js'

export default {
  name: 'TreeListPage',
  inheritAttrs: false,
  components: { BusinessListPage },
  props: {
    preference: { type: Object, default: () => ({}) },
    appearance: { type: String, default: 'platform', validator: value => ['platform', 'blue', 'editorial'].includes(value) },
    showTitle: { type: Boolean, default: false },
    leftWidth: { type: [Number, String], default: 250 },
    allowResize: { type: Boolean, default: true }
  },
  computed: {
    bindings() {
      return resolvePagePreferences(this.preference)
    }
  }
}
</script>

<style scoped>
.pt-tree-list { min-width: 0; }
.pt-tree-list-sidebar { padding-top: 10px; height: 100%; box-sizing: border-box; }
.pt-tree-list :deep(.left .el-scrollbar__view) { height: 100%; }
.pt-tree-list :deep(.hamburger) { display: none !important; }
.pt-tree-list :deep(.left),
.pt-tree-list :deep(.right) { min-width: 0; box-sizing: border-box; }
.pt-tree-list :deep(.left .body),
.pt-tree-list :deep(.left .secondary-menu__scroll),
.pt-tree-list :deep(.left .el-scrollbar__wrap),
.pt-tree-list :deep(.left .el-scrollbar__view) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}
@media (min-width: 641px) {
  /* 覆盖平台内联 height: inherit，父级高度为 auto 时左栏仍随右栏撑满。 */
  .pt-tree-list :deep(.left) { display: flex; align-self: stretch; height: auto !important; min-height: 0; }
  .pt-tree-list :deep(.left > div) { display: flex; flex-direction: column; flex: 1; min-height: 0; height: auto !important; }
  .pt-tree-list :deep(.left .body) { flex: 1; min-height: 0; height: auto !important; }
  /* 滚动视图逐层伸展，避免百分比高度在 auto 父级中退化为内容高度。 */
  .pt-tree-list :deep(.left .secondary-menu__scroll),
  .pt-tree-list :deep(.left .el-scrollbar__wrap),
  .pt-tree-list :deep(.left .el-scrollbar__view) { display: flex; flex-direction: column; flex: 1; min-height: 0; }
  .pt-tree-list-sidebar { display: flex; flex-direction: column; flex: 1; min-height: 0; height: auto; }
  .pt-tree-list-sidebar :deep(.pt-tree-panel) { flex: 1; height: auto; }
}
@media (max-width: 640px) {
  .pt-tree-list { flex-direction: column; }
  .pt-tree-list :deep(.left) { flex: 0 0 auto !important; width: 100%; height: auto !important; }
  .pt-tree-list :deep(.left .body) { max-height: 240px; overflow-y: auto; }
  .pt-tree-list :deep(.handle) { display: none; }
  .pt-tree-list :deep(.right) { width: 100%; margin-left: 0; }
}
</style>
<!-- Modified by AI on 2026-11-13 09:44:21 -->
