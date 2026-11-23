<template>
  <nav class="pt-three-pagination" aria-label="列表分页">
    <div class="pt-three-pagination__total">共 {{ total }} 条</div>
    <el-pagination :current-page="currentPage" :page-size="pageSize" :total="total"
      :disabled="disabled" :pager-count="5" layout="prev, pager, next"
      @update:current-page="changePage" />
    <div class="pt-three-pagination__size">
      <el-select :model-value="pageSize" :disabled="disabled" aria-label="每页条数" @update:model-value="changeSize">
        <el-option v-for="size in pageSizes" :key="size" :label="`${size} 条/页`" :value="size" />
      </el-select>
    </div>
  </nav>
</template>

<script setup>
import { ElPagination, ElSelect, ElOption } from 'element-plus'

const props = defineProps({
  total: { type: Number, default: 0 },
  currentPage: { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  pageSizes: { type: Array, default: () => [10, 20, 30, 50, 100] },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:currentPage', 'update:pageSize', 'current-change', 'size-change'])

function changePage(page) {
  if (props.disabled || page === props.currentPage) return
  emit('update:currentPage', page)
  emit('current-change', page)
}
function changeSize(size) {
  if (props.disabled || size === props.pageSize) return
  emit('update:pageSize', size)
  emit('update:currentPage', 1)
  emit('size-change', size)
}
</script>

<style scoped>
.pt-three-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-width: 0;
  color: var(--el-text-color-regular, #606266);
  font-size: 14px;
  container-type: inline-size;
}
.pt-three-pagination__total, .pt-three-pagination__size { flex: 1 1 0; min-width: 0; }
.pt-three-pagination__total { white-space: nowrap; }
.pt-three-pagination__size { display: flex; justify-content: flex-end; margin-left: auto; }
/* 覆盖平台选择框宽度和 flex 规则，保持右侧入口固定宽度。 */
.pt-three-pagination .pt-three-pagination__size :deep(.el-select) {
  flex: 0 0 120px;
  width: 120px !important;
  min-width: 120px;
  max-width: 120px;
}
.pt-three-pagination > .el-pagination { flex: 0 0 auto; }
.pt-three-pagination :deep(.el-pager li) { border-radius: 50%; }
.pt-three-pagination :deep(.el-pager li.is-active) {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
@container (max-width: 520px) {
  .pt-three-pagination__total, .pt-three-pagination__size { flex: 0 0 auto; }
}
@media (max-width: 600px) {
  .pt-three-pagination { flex-wrap: wrap; justify-content: center; }
}
</style>
<!-- Modified by AI on 2026-11-13 10:10:29 -->
