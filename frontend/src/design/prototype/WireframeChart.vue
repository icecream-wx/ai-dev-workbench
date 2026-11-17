<template>
  <div class="wf-chart-card">
    <div class="wf-chart-title">{{ chart.title ?? chartTitle() }}</div>
    <div v-if="chart.type === 'pie'" class="wf-chart-pie-wrap">
      <div class="wf-chart-pie" />
      <div class="wf-chart-legend">
        <div v-for="[name, pct] in pieData" :key="name">
          <span class="wf-legend-dot" :style="{ background: GREYS[legendIndex(name) % GREYS.length] }" />{{ name }} · {{ pct }}%
        </div>
      </div>
    </div>
    <div v-else-if="chart.type === 'line'" class="wf-chart-bars">
      <svg viewBox="0 0 200 100" class="wf-line-chart" preserveAspectRatio="none">
        <polyline :points="linePoints" fill="none" stroke="#71717a" stroke-width="2" />
      </svg>
    </div>
    <div v-else class="wf-chart-bars">
      <div v-for="[name, value] in barData" :key="name" class="wf-chart-bar-item">
        <div class="wf-chart-bar-col" :style="{ height: `${barHeight(value)}%` }" />
        <div class="wf-chart-bar-label">{{ name }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MockRow } from './mock'
import { enumDistribution, numericByDimension } from './mock'
import type { SpecEntity } from './spec-types'
import { metricLabel } from './layout'

/**
 * 线框图表卡：bar/line/pie 三态，WireframeDashboard 与自由区块（WireframeBlocks）共用。
 * 数据来自 MockRow 聚合（enum 分布 / 按维度数值），保持「原型示意」语义。
 */
const GREYS = ['#52525b', '#a1a1aa', '#d4d4d8', '#eceef1', '#71717a']

const props = defineProps<{
  chart: { type: 'bar' | 'line' | 'pie'; metric: string; dimension: string; title?: string }
  entity: SpecEntity | undefined
  rows: MockRow[]
}>()

const chart = computed(() => props.chart)

function chartTitle(): string {
  return `${metricLabel(props.entity, props.chart.metric)}（按${metricLabel(props.entity, props.chart.dimension)}）`
}

const pieData = computed((): Array<[string, number]> => {
  const field = props.entity?.fields.find(f => f.name === props.chart.dimension)
  return enumDistribution(field)
})

const barData = computed((): Array<[string, number]> => numericByDimension(props.rows, props.chart.metric, props.chart.dimension))

function legendIndex(name: string): number {
  return pieData.value.findIndex(d => d[0] === name)
}

function barHeight(value: number): number {
  const max = Math.max(...barData.value.map(d => d[1]), 1)
  return Math.max(8, Math.round((value / max) * 92))
}

function linePoints(): string {
  const data = barData.value
  if (!data.length) return '0,100 200,100'
  const max = Math.max(...data.map(d => d[1]), 1)
  const stepX = 200 / Math.max(data.length - 1, 1)
  return data.map((d, i) => `${(i * stepX).toFixed(1)},${(100 - (d[1] / max) * 88).toFixed(1)}`).join(' ')
}
</script>

<!-- Modified by AI on 2026-10-20 14:34:10 -->
