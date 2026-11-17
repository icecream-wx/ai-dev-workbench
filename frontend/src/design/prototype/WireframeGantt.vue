<template>
  <div>
    <div v-if="bars.length" class="wf-gantt" data-wf-anchor="chart">
      <div class="wf-gantt-axis">
        <span v-for="(tick, i) in ticks" :key="i" class="wf-gantt-tick" :style="{ left: `${tick.left}%` }">{{ tick.label }}</span>
      </div>
      <div v-for="(item, ri) in bars" :key="ri" class="wf-gantt-row" @click="emit('nav', 'detail')">
        <span class="wf-gantt-name">{{ item.name }}</span>
        <div class="wf-gantt-track">
          <div class="wf-gantt-bar" :style="{ left: `${item.left}%`, width: `${item.width}%` }">
            <div class="wf-gantt-progress" :style="{ width: `${item.progress}%` }" />
            <span class="wf-gantt-pct">{{ item.progress }}%</span>
          </div>
        </div>
      </div>
      <div class="wf-gantt-tip">条内填充示意进度，点击任务行查看详情</div>
    </div>
    <div v-else class="wf-empty">甘特视图需要日期类字段（起止时间），先在「实体」页签为实体补充 date 字段</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MockRow } from './mock'
import { displayValue, ganttBars, parseDateValue } from './mock'
import type { PageLayout, SpecEntity, SpecPage } from './spec-types'
import { ganttSpec } from './layout'

const props = defineProps<{
  page: SpecPage
  entity: SpecEntity | undefined
  layout: PageLayout | undefined
  rows: MockRow[]
}>()

const emit = defineEmits<{
  nav: [kind: 'create' | 'detail' | 'back', rowIndex?: number]
  notify: [action: string]
}>()

const spec = computed(() => ganttSpec(props.page, props.entity, props.layout))

const bars = computed(() => {
  const s = spec.value
  if (!s.startField) return []
  const items = ganttBars(props.rows.slice(0, 8), s.startField.name, s.endField?.name, s.progressField?.name)
  const nameField = s.nameField ?? s.startField
  return items.map(item => ({
    ...item,
    name: nameField ? displayValue(nameField, item.row[nameField.name]) : `任务 ${item.row[Object.keys(item.row)[0]] ?? ''}`
  }))
})

const ticks = computed(() => {
  if (!bars.value.length) return []
  // 时间轴按日期范围均分 5 档刻度，标签取起始日期的天数示意
  const starts = bars.value.map(b => parseDateValue(b.row[spec.value.startField!.name])?.day ?? 1)
  const min = Math.min(...starts)
  const max = Math.max(...starts) + 10
  const span = Math.max(max - min, 1)
  return [0, 0.25, 0.5, 0.75, 1].map(p => ({
    left: p * 100,
    label: `${min + Math.round(span * p)}日`
  }))
})
</script>

// Modified by AI on 2026-09-14 14:01:54
