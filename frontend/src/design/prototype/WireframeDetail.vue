<template>
  <div>
    <div v-if="items.length" :class="['wf-desc-grid', `cols-${columns}`]" data-wf-anchor="desc">
      <div v-for="item in items" :key="item.name" :class="['wf-desc-item', { full: item.full }]">
        <div class="wf-desc-label">{{ item.label }}</div>
        <div class="wf-desc-value">{{ item.value }}</div>
      </div>
      <!-- 独占行/末行留下的空位：占位格补齐底部横线，让线框布满整行 -->
      <div
        v-for="hole in descHoles"
        :key="`hole-${hole.row}-${hole.col}`"
        class="wf-desc-item wf-desc-phantom"
        :style="{ gridRow: `${hole.row}`, gridColumn: `${hole.col} / ${hole.col + 1}` }"
      />
    </div>
    <div v-else class="wf-empty">页面未绑定实体，先在「页面」编辑中绑定</div>
    <div class="wf-footer" data-wf-anchor="footer">
      <span class="wf-btn" @click="emit('nav', 'back')">返回</span>
      <span v-for="action in footerActions" :key="action" class="wf-btn wf-btn-primary" @click="emit('notify', action)">{{ actionLabel(action) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MockRow } from './mock'
import { displayValue } from './mock'
import type { PageLayout, SpecEntity, SpecPage } from './spec-types'
import { actionLabel, effectiveFields, fieldSpan } from './layout'

const props = defineProps<{
  page: SpecPage
  entity: SpecEntity | undefined
  layout: PageLayout | undefined
  row: MockRow | undefined
}>()

const emit = defineEmits<{
  nav: [kind: 'create' | 'detail' | 'back', rowIndex?: number]
  notify: [action: string]
}>()

/** 详情字段网格列数：AI/自定义布局 detail.columns 覆盖，默认 2 列 */
const columns = computed(() => props.layout?.detail?.columns ?? 2)

const items = computed(() =>
  effectiveFields(props.page, props.entity, props.layout).map(f => ({
    name: f.name,
    label: f.label,
    value: displayValue(f, props.row?.[f.name]),
    /** span=24（含 textarea 默认）独占整行 */
    full: fieldSpan(f, props.layout) >= 24
  }))
)

/** 独占行字段换行 / 末行未满时留下的空位（显式占位补边框），游标模拟与 CSS 稀疏自动布局一致 */
const descHoles = computed(() => {
  const cols = columns.value
  let row = 1
  let col = 1
  const holes: Array<{ row: number; col: number }> = []
  const pushHoles = (from: number) => {
    for (let c = from; c <= cols; c++) holes.push({ row, col: c })
  }
  for (const f of effectiveFields(props.page, props.entity, props.layout)) {
    if (fieldSpan(f, props.layout) >= 24) {
      if (col !== 1) pushHoles(col)
      row += 1
      col = 1
    } else if (col >= cols) {
      row += 1
      col = 1
    } else {
      col += 1
    }
  }
  if (col !== 1) pushHoles(col)
  return holes
})

const footerActions = computed(() =>
  (props.page.actions ?? []).filter(a => !['cancel', 'view', 'detail', 'create'].includes(a))
)
</script>

<!-- Modified by AI on 2026-09-15 10:46:15 -->
