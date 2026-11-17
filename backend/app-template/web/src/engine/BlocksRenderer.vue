<script setup>
import { onMounted, ref } from 'vue'
import { api } from './api'
import { store } from './store'

/**
 * 自由区块渲染（清单 layout.blocks）：text / banner / image / kv / buttons / steps / timeline / chart
 * chart 通过 /api/res/<entity>/stats 拉取真实数据（bar: 横条；line: SVG 折线；pie: conic-gradient 扇形）
 */
const props = defineProps({
  blocks: { type: Array, default: () => [] },
  entity: { type: Object, default: null }
})

const chartData = ref({})

function chartKey(block, index) {
  return `${index}`
}

onMounted(async () => {
  for (let i = 0; i < props.blocks.length; i++) {
    const b = props.blocks[i]
    if (b.type !== 'chart' || !b.chart) continue
    const entityId = b.entity ?? props.entity?.id
    if (!entityId) continue
    try {
      chartData.value[i] = await api.stats(entityId, { metric: b.chart.metric, dimension: b.chart.dimension })
    } catch {
      chartData.value[i] = []
    }
  }
})

function barWidth(value, list) {
  const max = Math.max(...list.map(d => d.value), 1)
  return `${Math.max(4, Math.round((value / max) * 100))}%`
}

function pieStyle(list) {
  const total = list.reduce((s, d) => s + d.value, 0) || 1
  const palette = ['#5b5bd6', '#8a7bf7', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#4ade80']
  let acc = 0
  const stops = list.map((d, i) => {
    const from = (acc / total) * 360
    acc += d.value
    const to = (acc / total) * 360
    return `${palette[i % palette.length]} ${from}deg ${to}deg`
  })
  return { background: `conic-gradient(${stops.join(', ')})` }
}

function linePoints(list) {
  const max = Math.max(...list.map(d => d.value), 1)
  const step = 100 / Math.max(list.length - 1, 1)
  return list.map((d, i) => `${i * step},${40 - (d.value / max) * 34}`).join(' ')
}

function entityLabel(entityId) {
  return store.manifest?.entities?.find(e => e.id === entityId)?.name ?? entityId
}
</script>

<template>
  <div class="blocks">
    <template v-for="(b, i) in blocks" :key="i">
      <div v-if="b.type === 'text'" class="blk blk-text">
        <div v-if="b.title" class="blk-title">{{ b.title }}</div>
        <div class="blk-body">{{ b.text }}</div>
      </div>
      <el-alert
        v-else-if="b.type === 'banner'"
        :title="b.title || '提示'"
        :description="b.text"
        :type="b.level === 'warning' ? 'warning' : b.level === 'error' ? 'error' : 'info'"
        show-icon
        :closable="false"
        class="blk"
      />
      <div v-else-if="b.type === 'image'" class="blk blk-image">
        <div v-if="b.title" class="blk-title">{{ b.title }}</div>
        <div class="blk-image-ph">{{ b.text || '图片占位' }}</div>
      </div>
      <div v-else-if="b.type === 'kv'" class="blk blk-kv">
        <div v-if="b.title" class="blk-title">{{ b.title }}</div>
        <div class="blk-kv-grid">
          <div v-for="(item, ki) in b.items ?? []" :key="ki" class="blk-kv-item">
            <span class="blk-kv-label">{{ item.label }}</span>
            <span class="blk-kv-value">{{ item.value ?? '-' }}</span>
          </div>
        </div>
      </div>
      <div v-else-if="b.type === 'buttons'" class="blk blk-buttons">
        <el-button v-for="(item, bi) in b.items ?? []" :key="bi" size="small">{{ item.label }}</el-button>
      </div>
      <div v-else-if="b.type === 'steps'" class="blk blk-steps">
        <el-steps :active="b.steps?.length ?? 0" align-center finish-status="success">
          <el-step v-for="(s, si) in b.steps ?? []" :key="si" :title="s" />
        </el-steps>
      </div>
      <div v-else-if="b.type === 'timeline'" class="blk blk-timeline">
        <div v-if="b.title" class="blk-title">{{ b.title }}</div>
        <el-timeline>
          <el-timeline-item v-for="(t, ti) in b.timeline ?? []" :key="ti" :timestamp="t.description">
            {{ t.title }}
          </el-timeline-item>
        </el-timeline>
      </div>
      <div v-else-if="b.type === 'chart' && b.chart" class="blk blk-chart">
        <div class="blk-title">{{ b.title || `${b.chart.metric} 按 ${b.chart.dimension}` }}</div>
        <template v-if="(chartData[i] ?? []).length">
          <div v-if="b.chart.type === 'bar'" class="blk-chart-bars">
            <div v-for="d in chartData[i]" :key="d.label" class="blk-chart-bar">
              <span class="blk-chart-label">{{ d.label }}</span>
              <div class="blk-chart-track"><div class="blk-chart-fill" :style="{ width: barWidth(d.value, chartData[i]) }" /></div>
              <span class="blk-chart-value">{{ d.value }}</span>
            </div>
          </div>
          <svg v-else-if="b.chart.type === 'line'" viewBox="0 0 100 40" class="blk-chart-line" preserveAspectRatio="none">
            <polyline :points="linePoints(chartData[i])" fill="none" stroke="#5b5bd6" stroke-width="1.4" />
          </svg>
          <div v-else class="blk-chart-pie-wrap">
            <div class="blk-chart-pie" :style="pieStyle(chartData[i])" />
            <div class="blk-chart-legend">
              <span v-for="d in chartData[i]" :key="d.label" class="blk-legend-item">{{ d.label }}（{{ d.value }}）</span>
            </div>
          </div>
        </template>
        <div v-else class="blk-chart-empty">暂无数据</div>
        <div class="blk-chart-meta">{{ entityLabel(b.entity ?? entity?.id) }} · {{ b.chart.metric }} / {{ b.chart.dimension }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.blocks { display: flex; flex-direction: column; gap: 12px; }
.blk { background: #fff; border: 1px solid #e4e7ef; border-radius: 8px; padding: 14px 16px; }
.blk-title { font-size: 13px; font-weight: 600; color: #262a33; margin-bottom: 10px; }
.blk-body { font-size: 13px; color: #4b5163; line-height: 1.8; white-space: pre-wrap; }
.blk-image-ph {
  height: 120px; border: 1px dashed #c9cedd; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; color: #9aa0b5; font-size: 12px;
}
.blk-kv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px 18px; }
.blk-kv-item { display: flex; gap: 10px; font-size: 12.5px; }
.blk-kv-label { color: #8b91a5; flex-shrink: 0; }
.blk-kv-value { color: #262a33; font-weight: 500; }
.blk-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.blk-chart-bars { display: flex; flex-direction: column; gap: 8px; }
.blk-chart-bar { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.blk-chart-label { width: 90px; text-align: right; color: #6b7185; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.blk-chart-track { flex: 1; height: 10px; background: #eef0f6; border-radius: 5px; overflow: hidden; }
.blk-chart-fill { height: 100%; background: linear-gradient(90deg, #5b5bd6, #8a7bf7); border-radius: 5px; }
.blk-chart-value { width: 48px; color: #262a33; font-variant-numeric: tabular-nums; }
.blk-chart-line { width: 100%; height: 120px; }
.blk-chart-pie-wrap { display: flex; align-items: center; gap: 20px; }
.blk-chart-pie { width: 110px; height: 110px; border-radius: 50%; }
.blk-chart-legend { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #4b5163; }
.blk-chart-empty { color: #9aa0b5; font-size: 12px; padding: 12px 0; }
.blk-chart-meta { margin-top: 8px; font-size: 11px; color: #9aa0b5; }
</style>
