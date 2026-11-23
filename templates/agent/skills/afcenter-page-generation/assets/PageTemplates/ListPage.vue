<template>
  <section class="pt-page pt-list bg-white bg-radius" :data-density="density">
    <div v-if="actionsAlign === 'end'" class="top-block pt-list-inline-header" data-align="end">
      <div v-if="batchActive" class="pt-header pt-list-inline-title pt-list-batch-title">
        <span class="pt-list-selection-count" role="status">已选中 {{ selectionCount }} 条</span>
        <button type="button" class="pt-list-clear-selection" @click="$emit('clear-selection')">取消选择</button>
      </div>
      <header v-else-if="title || $slots.header" class="pt-header pt-list-inline-title">
        <slot name="header"><h2>{{ title }}</h2></slot>
      </header>
      <div v-if="$slots.filters" class="pt-list-inline-search"><slot name="filters" /></div>
      <div v-if="$slots.tools" class="pt-list-inline-tools"><slot name="tools" :icon-only="true" /></div>
      <slot name="actions" :icon-only="true" :selection-count="selectionCount" :batch-active="batchActive">
        <PmToolbar class="al-toolbar pt-list-inline-actions" :class="toolbarClass">
          <el-tooltip v-if="showBatchDelete" content="批量删除" placement="top">
          <span class="pt-list-icon-action" :class="{ 'is-active': batchActive }" tabindex="0" aria-label="批量删除">
            <PmToolbarItem text aria-label="批量删除" :disabled="selectionCount === 0 || deleting"
              :loading="deleting" @click="$emit('batch-delete')">
              <svg v-if="!deleting" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" />
              </svg>
            </PmToolbarItem>
          </span>
          </el-tooltip>
          <PmToolbarItem v-if="showCreate && !batchActive" type="primary" class="pt-list-create" :disabled="createDisabled"
            @click="$emit('create')">新增{{ entityName }}</PmToolbarItem>
        </PmToolbar>
      </slot>
    </div>
    <header v-else-if="title || $slots.header" class="pt-header">
      <slot name="header"><h2>{{ title }}</h2></slot>
    </header>
    <div v-if="$slots.summary" class="pt-region"><slot name="summary" /></div>
    <div v-if="actionsAlign !== 'end' && (showCreate || showBatchDelete || $slots.actions || $slots.filters || $slots.tools)" class="top-block pt-10">
      <el-row>
        <el-col :span="$slots.filters ? 16 : 24" class="pt-list-actions" :data-align="actionsAlign">
          <slot name="actions" :selection-count="selectionCount" :batch-active="batchActive">
            <PmToolbar class="al-toolbar" :class="toolbarClass">
              <template v-if="batchActive">
                <span class="pt-list-selection-count" role="status">已选中 {{ selectionCount }} 条</span>
                <PmToolbarItem text @click="$emit('clear-selection')">取消选择</PmToolbarItem>
                <PmToolbarItem v-if="showBatchDelete" type="primary" :disabled="deleting"
                  :loading="deleting" @click="$emit('batch-delete')">批量删除</PmToolbarItem>
              </template>
              <template v-else>
                <PmToolbarItem v-if="showCreate" plain :disabled="createDisabled" @click="$emit('create')">
                  新增{{ entityName }}
                </PmToolbarItem>
                <PmToolbarItem v-if="showBatchDelete" plain :disabled="selectionCount === 0 || deleting"
                  :loading="deleting" @click="$emit('batch-delete')">批量删除</PmToolbarItem>
              </template>
            </PmToolbar>
          </slot>
        </el-col>
        <el-col v-if="$slots.filters" :span="8" class="text-right"><slot name="filters" /></el-col>
      </el-row>
      <div v-if="$slots.tools"><slot name="tools" /></div>
    </div>
    <div v-if="$slots.selection"><slot name="selection" /></div>
    <slot />
    <div v-if="$slots.pagination" class="al-footer pt-list-footer" :data-align="paginationAlign" :data-layout="paginationLayout">
      <slot name="pagination" />
    </div>
  </section>
</template>

<script>
import './style.css'

export default {
  name: 'BusinessListPage',
  emits: ['create', 'batch-delete', 'clear-selection'],
  props: {
    title: { type: String, default: '' },
    toolbarClass: { type: String, default: '' },
    entityName: { type: String, default: '记录' },
    showCreate: { type: Boolean, default: true },
    showBatchDelete: { type: Boolean, default: true },
    createDisabled: { type: Boolean, default: false },
    selectionCount: { type: Number, default: 0 },
    deleting: { type: Boolean, default: false },
    density: { type: String, default: 'comfortable', validator: v => ['comfortable', 'compact'].includes(v) },
    actionsAlign: { type: String, default: 'start', validator: v => ['start', 'end'].includes(v) },
    paginationAlign: { type: String, default: 'end', validator: v => ['start', 'end'].includes(v) },
    paginationLayout: { type: String, default: 'bar', validator: v => ['bar', 'split', 'three-part'].includes(v) }
  },
  computed: {
    // 顶部批量态仅在分页拆分（split）模式下启用；bar 模式保持原行为，已选数量留在底部分页区。
    batchActive() {
      return ['split', 'three-part'].includes(this.paginationLayout) && this.selectionCount > 0
    }
  }
}
</script>
<!-- Modified by AI on 2026-11-12 14:32:37 -->
