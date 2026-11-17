<template>
  <div>
    <div v-if="columns.length" class="wf-kanban" data-wf-anchor="board">
      <div v-for="column in columns" :key="column.label" class="wf-kanban-col" :data-wf-anchor="`col:${column.label}`">
        <div class="wf-kanban-head">
          <span class="wf-kanban-dot" />
          <span class="wf-kanban-title">{{ column.label }}</span>
          <span class="wf-kanban-count">{{ column.cards.length }}</span>
        </div>
        <div class="wf-kanban-cards">
          <div v-for="card in column.cards" :key="card.key" class="wf-kanban-card" @click="emit('nav', 'detail')">
            <div class="wf-kanban-card-title">{{ card.title }}</div>
            <div v-for="cell in card.cells" :key="cell.label" class="wf-kanban-cell">
              <span class="wf-kanban-cell-label">{{ cell.label }}</span>
              <span class="wf-kanban-cell-value">{{ cell.value }}</span>
            </div>
          </div>
          <div v-if="!column.cards.length" class="wf-kanban-empty">暂无卡片</div>
        </div>
      </div>
    </div>
    <div v-else class="wf-empty">页面未绑定实体或实体暂无字段，先在「实体」页签完善</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MockRow } from './mock'
import { displayValue } from './mock'
import type { PageLayout, SpecEntity, SpecPage } from './spec-types'
import { kanbanSpec, resolvePageFields } from './layout'

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

const fields = computed(() => resolvePageFields(props.page, props.entity))

const spec = computed(() => kanbanSpec(props.page, props.entity, props.layout))

const columns = computed(() => {
  const field = spec.value.groupField
  if (!field) return []
  const values = field.type === 'enum' && field.options?.length ? field.options : ['待处理', '进行中', '已完成']
  const titleField = fields.value.find(f => f.type === 'string') ?? spec.value.cardFields[0] ?? field
  return values.map(label => ({
    label,
    cards: props.rows
      .filter(row => String(row[field.name] ?? '未分组') === String(label))
      .slice(0, 4)
      .map((row, i) => ({
        key: `${label}-${i}`,
        title: displayValue(titleField, row[titleField.name]),
        cells: spec.value.cardFields.map(f => ({ label: f.label, value: displayValue(f, row[f.name]) }))
      }))
  }))
})
</script>

// Modified by AI on 2026-09-14 14:01:54
