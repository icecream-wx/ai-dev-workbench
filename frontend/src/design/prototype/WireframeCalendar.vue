<template>
  <div>
    <template v-if="dateField">
      <div class="wf-cal-head">
        <span class="wf-btn">‹</span>
        <span class="wf-cal-title">{{ year }} 年 {{ month }} 月</span>
        <span class="wf-btn">›</span>
        <span class="wf-btn wf-btn-primary" style="margin-left: auto" @click="emit('notify', '新建')">+ 新建</span>
      </div>
      <div class="wf-cal-grid" data-wf-anchor="calendar">
        <span v-for="w in WEEKS" :key="w" class="wf-cal-week">{{ w }}</span>
        <div v-for="(day, i) in grid" :key="i" :class="['wf-cal-cell', { dim: !day, today: day === today }]">
          <span v-if="day" class="wf-cal-day">{{ day }}</span>
          <div v-if="day" class="wf-cal-events">
            <span v-for="(title, ti) in eventsByDay.get(day) ?? []" :key="ti" class="wf-cal-chip" :title="title" @click="emit('nav', 'detail')">{{ title }}</span>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="wf-empty">日历视图需要日期类字段，先在「实体」页签为实体补充 date 字段</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MockRow } from './mock'
import { calendarEvents, monthGrid } from './mock'
import type { PageLayout, SpecEntity, SpecPage } from './spec-types'
import { calendarSpec } from './layout'

const WEEKS = ['一', '二', '三', '四', '五', '六', '日']

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

const spec = computed(() => calendarSpec(props.page, props.entity, props.layout))
const dateField = computed(() => spec.value.dateField)

const events = computed(() => {
  const field = dateField.value
  if (!field) return null
  return calendarEvents(props.rows, field.name, spec.value.titleField?.name ?? field.name)
})

const year = computed(() => events.value?.year ?? 2026)
const month = computed(() => events.value?.month ?? 9)
const grid = computed(() => monthGrid(year.value, month.value))
const eventsByDay = computed(() => events.value?.byDay ?? new Map())
const today = computed(() => new Date().getDate())
</script>

// Modified by AI on 2026-09-14 14:01:54
