<template>
  <el-pagination
    :page-sizes="pageSizes"
    :page-size="pageSize"
    background
    :layout="layout"
    v-bind="$attrs"
    class="mb-10"
  />
</template>

<script setup>
/**
 * 分页组件，基于 el-pagination 封装的分页导航，支持分页查询和切换
 */
defineProps({
  pageSizes: { type: Array, default: () => [10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 1000] },
  pageSize: { type: Number, default: 10 },
  layout: { type: String, default: 'slot,total, prev, pager, next, sizes,jumper' },
})
</script>
