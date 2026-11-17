<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from './api'
import { store, entityName } from './store'
import BlocksRenderer from './BlocksRenderer.vue'

/** 清单驱动的仪表盘：统计卡（layout.stats）+ 图表（layout.charts，复用区块渲染器） */
const props = defineProps({ page: { type: Object, required: true } })

const entity = computed(() => (store.manifest?.entities ?? []).find(e => e.id === props.page.entity) ?? null)
const layout = computed(() => props.page.layout ?? {})
const total = ref(0)
const sums = ref({})

onMounted(async () => {
  if (!entity.value) return
  try {
    const res = await api.list(entity.value.id, { page: 1, pageSize: 1 })
    total.value = res.total ?? 0
  } catch {
    total.value = 0
  }
  for (const s of layout.value.stats ?? []) {
    if (s.metric === '__count') {
      sums.value[s.label] = total.value
      continue
    }
    try {
      const res = await api.list(entity.value.id, { page: 1, pageSize: 200 })
      sums.value[s.label] = (res.rows ?? []).reduce((acc, r) => acc + (Number(s.metric === '__count' ? 1 : r[s.metric]) || 0), 0)
    } catch {
      sums.value[s.label] = '-'
    }
  }
})

const chartBlocks = computed(() =>
  (layout.value.charts ?? []).map(c => ({ type: 'chart', title: c.title, chart: c }))
)
</script>

<template>
  <div v-if="entity" class="pg">
    <div class="pg-head">
      <div>
        <h2 class="pg-title">{{ page.title }}</h2>
        <div class="pg-sub">{{ entityName(page.entity) }}</div>
      </div>
    </div>

    <div class="stat-grid">
      <div v-for="s in layout.stats ?? [{ label: '记录数', metric: '__count' }]" :key="s.label" class="stat-card">
        <div class="stat-label">{{ s.label }}</div>
        <div class="stat-value">{{ s.metric === '__count' ? total : sums[s.label] ?? '…' }}</div>
      </div>
      <div v-if="!layout.stats?.length" class="stat-card">
        <div class="stat-card-label">记录数</div>
        <div class="stat-value">{{ total }}</div>
      </div>
    </div>

    <BlocksRenderer :blocks="chartBlocks" :entity="entity" />
    <div v-if="!(layout.stats ?? []).length && !(layout.charts ?? []).length" class="empty-hint">
      该仪表盘未配置 stats/charts；在需求侧调整布局或由智能体生成插件
    </div>
  </div>
</template>

<style scoped>
.pg { max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.pg-head { display: flex; align-items: center; justify-content: space-between; }
.pg-title { font-size: 17px; font-weight: 700; margin: 0; color: #1c2233; }
.pg-sub { font-size: 12px; color: #8b91a5; margin-top: 3px; }
.stat-card, .stat-card { background: #fff; border: 1px solid #e4e7ef; border-radius: 10px; padding: 16px 18px; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.stat-label { font-size: 12px; color: #8b91a5; }
.stat-value { font-size: 24px; font-weight: 700; color: #1c2233; margin-top: 6px; font-variant-numeric: tabular-nums; }
.empty-hint { color: #9aa0b5; font-size: 12.5px; padding: 20px; text-align: center; }
</style>
