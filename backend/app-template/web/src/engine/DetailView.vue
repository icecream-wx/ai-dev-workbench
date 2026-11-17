<script setup>
import { computed } from 'vue'
import { store, entityName, goBack } from './store'
import BlocksRenderer from './BlocksRenderer.vue'

/** 清单驱动的详情页：只读字段网格（layout.detail.columns 控制列数）+ 自由区块 */
const props = defineProps({ page: { type: Object, required: true } })

const entity = computed(() => (store.manifest?.entities ?? []).find(e => e.id === props.page.entity) ?? null)
const layout = computed(() => props.page.layout ?? {})
const record = computed(() => store.current?.record ?? {})

const items = computed(() => {
  const fields = entity.value?.fields ?? []
  const overrides = layout.value.fieldOverrides ?? {}
  const order = layout.value.fieldOrder
  const names = order?.length
    ? [...order.filter(n => fields.some(f => f.name === n)), ...fields.map(f => f.name).filter(n => !order.includes(n))]
    : fields.map(f => f.name)
  return names
    .map(n => fields.find(f => f.name === n))
    .filter(Boolean)
    .filter(f => overrides[f.name]?.hidden !== true)
    .map(f => ({
      label: f.label,
      span: overrides[f.name]?.span === 24 ? 24 : 100 / (layout.value.detail?.columns ?? 2),
      value: f.type === 'ref' ? record.value[`${f.name}Label`] ?? record.value[f.name] ?? '-' : record.value[f.name] ?? '-',
      type: f.type
    }))
})

const bottomBlocks = computed(() => (layout.value.blocks ?? []).filter(b => b.position !== 'top'))
const topBlocks = computed(() => (layout.value.blocks ?? []).filter(b => b.position === 'top'))
</script>

<template>
  <div v-if="entity" class="pg">
    <div class="pg-head">
      <div>
        <h2 class="pg-title">{{ page.title }}</h2>
        <div class="pg-sub">{{ entityName(page.entity) }} · {{ record[entity.pk] ?? '' }}</div>
      </div>
      <div>
        <el-button size="small" type="primary" plain @click="store.openPage(store.current.pageId, { ...store.current, mode: 'edit' })">编辑</el-button>
        <el-button text @click="goBack">返回</el-button>
      </div>
    </div>

    <BlocksRenderer :blocks="topBlocks" :entity="entity" />

    <div class="pg-card">
      <el-descriptions :column="layout.detail?.columns ?? 2" border>
        <el-descriptions-item v-for="(it, i) in items" :key="i" :label="it.label" :span="Math.min(it.span, 4)">
          <el-tag v-if="it.type === 'enum'" size="small" effect="plain">{{ it.value }}</el-tag>
          <span v-else class="dv-value">{{ it.value }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <BlocksRenderer :blocks="bottomBlocks" :entity="entity" />
  </div>
</template>

<style scoped>
.pg { max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.pg-head { display: flex; align-items: center; justify-content: space-between; }
.pg-title { font-size: 17px; font-weight: 700; margin: 0; color: #1c2233; }
.pg-sub { font-size: 12px; color: #8b91a5; margin-top: 3px; }
.pg-card { background: #fff; border: 1px solid #e4e7ef; border-radius: 10px; padding: 18px 20px; }
.dv-value { color: #262a33; }
</style>
