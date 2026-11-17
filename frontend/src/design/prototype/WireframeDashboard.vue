<template>
  <div>
    <div class="wf-stat-row" data-wf-anchor="stats">
      <div v-for="stat in stats" :key="stat.metric + stat.label" class="wf-stat-card">
        <div class="wf-stat-label">{{ stat.label }}</div>
        <div class="wf-stat-value">{{ statValue(stat.metric) }}</div>
      </div>
    </div>
    <div v-if="charts.length" class="wf-chart-grid">
      <WireframeChart v-for="(chart, ci) in charts" :key="ci" :chart="chart" :entity="entity" :rows="rows" :data-wf-anchor="`chart:${ci}`" />
    </div>
    <div v-if="!stats.length && !charts.length" class="wf-empty">仪表盘暂无可展示的统计项，先绑定实体或用「AI 优化布局」生成</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MockRow } from './mock'
import WireframeChart from './WireframeChart.vue'
import type { PageLayout, SpecEntity } from './spec-types'
import { dashboardCharts, dashboardStats } from './layout'

const props = defineProps<{
  entity: SpecEntity | undefined
  layout: PageLayout | undefined
  rows: MockRow[]
}>()

const stats = computed(() => dashboardStats(props.entity, props.layout))
const charts = computed(() => dashboardCharts(props.entity, props.layout))

function statValue(metric: string): string {
  if (metric === '__count') return String(props.rows.length + 23)
  const values = props.rows.map(r => r[metric]).filter((v): v is number => typeof v === 'number')
  if (!values.length) return '—'
  return values.reduce((a, b) => a + b, 0).toLocaleString('zh-CN')
}
</script>

// Modified by AI on 2026-09-14 14:01:54

<!-- Modified by AI on 2026-10-20 14:34:10 -->
