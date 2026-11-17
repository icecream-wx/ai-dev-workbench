<template>
  <div class="wf-blocks">
    <div v-for="entry in entries" :key="entry.index" class="wf-block" :data-wf-anchor="`block:${entry.index}`">
      <!-- 说明文本：标题 + 正文（无正文时画灰色占位行） -->
      <template v-if="entry.block.type === 'text'">
        <div v-if="entry.block.title" class="wf-block-title">{{ entry.block.title }}</div>
        <div v-if="entry.block.text" class="wf-block-text">{{ entry.block.text }}</div>
        <div v-else class="wf-block-placeholder">
          <span class="wf-ph-line" style="width: 92%" />
          <span class="wf-ph-line" style="width: 78%" />
        </div>
      </template>

      <!-- 提示条/公告 -->
      <div v-else-if="entry.block.type === 'banner'" :class="['wf-banner', `is-${entry.block.level ?? 'info'}`]">
        <span class="wf-banner-icon">{{ entry.block.level === 'error' ? '✕' : entry.block.level === 'warning' ? '!' : 'i' }}</span>
        <div class="wf-banner-body">
          <div v-if="entry.block.title" class="wf-banner-title">{{ entry.block.title }}</div>
          <div class="wf-banner-text">{{ entry.block.text || '（提示内容）' }}</div>
        </div>
      </div>

      <!-- 图片占位 -->
      <div v-else-if="entry.block.type === 'image'" class="wf-image-ph" :title="entry.block.title || '图片占位'">
        <span class="wf-image-ph-icon" />
        <span v-if="entry.block.title" class="wf-image-ph-title">{{ entry.block.title }}</span>
      </div>

      <!-- 键值对组 -->
      <div v-else-if="entry.block.type === 'kv'">
        <div v-if="entry.block.title" class="wf-block-title">{{ entry.block.title }}</div>
        <div class="wf-desc-grid">
          <div v-for="(item, i) in entry.block.items ?? []" :key="i" class="wf-desc-item" :class="{ full: item.value && item.value.length > 30 }">
            <span class="wf-desc-label">{{ item.label }}</span>
            <span class="wf-desc-value">{{ item.value || '—' }}</span>
          </div>
        </div>
      </div>

      <!-- 按钮组 -->
      <div v-else-if="entry.block.type === 'buttons'" class="wf-block-buttons">
        <span
          v-for="(item, i) in entry.block.items ?? []"
          :key="i"
          :class="['wf-btn', { 'wf-btn-primary': i % 2 === 0 }]"
          @click="emit('notify', item.label)"
        >{{ item.label }}</span>
      </div>

      <!-- 分步条 -->
      <div v-else-if="entry.block.type === 'steps'" class="wf-steps-bar">
        <template v-for="(step, i) in entry.block.steps ?? []" :key="i">
          <span :class="['wf-step', { on: i === 0 }]">
            <span class="wf-step-dot">{{ i + 1 }}</span>
            <span class="wf-step-label">{{ step }}</span>
          </span>
          <span v-if="i < (entry.block.steps ?? []).length - 1" class="wf-step-line" />
        </template>
      </div>

      <!-- 时间线 -->
      <div v-else-if="entry.block.type === 'timeline'">
        <div v-if="entry.block.title" class="wf-block-title">{{ entry.block.title }}</div>
        <div class="wf-timeline">
          <div v-for="(item, i) in entry.block.timeline ?? []" :key="i" class="wf-timeline-item">
            <span class="wf-timeline-dot" />
            <div class="wf-timeline-body">
              <div class="wf-timeline-title">{{ item.title }}</div>
              <div v-if="item.description" class="wf-timeline-desc">{{ item.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 图表（复用仪表盘图表画法） -->
      <WireframeChart v-else-if="entry.block.type === 'chart' && blockChart(entry.block)" :chart="blockChart(entry.block)" :entity="chartEntity(entry.block)" :rows="rows" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MockRow } from './mock'
import type { SpecEntity, WfBlock } from './spec-types'
import { findEntityInModule, parseEntityRef } from './refs'
import WireframeChart from './WireframeChart.vue'

const props = defineProps<{
  /** 区块条目：index 为 blocks 数组原始序号（批注锚点 block:<index> 用） */
  entries: Array<{ index: number; block: WfBlock }>
  entity: SpecEntity | undefined
  rows: MockRow[]
  mobile?: boolean
  /** 当前模块 id（区块 chart 的 entity 跨模块解析用） */
  moduleId?: string
}>()

const emit = defineEmits<{ notify: [action: string] }>()

function blockChart(block: WfBlock): { type: 'bar' | 'line' | 'pie'; metric: string; dimension: string; title?: string } | undefined {
  if (!block.chart || !block.chart.metric || !block.chart.dimension) return undefined
  return { ...block.chart, title: block.title }
}

/** 图表指标解析实体：block.entity 优先（支持 moduleId:entityId 跨模块引用），缺省页面绑定实体 */
function chartEntity(block: WfBlock): SpecEntity | undefined {
  if (!block.entity) return props.entity
  const { moduleId, entityId } = parseEntityRef(block.entity)
  if (!moduleId && props.entity && props.entity.id === entityId) return props.entity
  const owner = moduleId ?? props.moduleId
  return owner ? findEntityInModule(owner, entityId) : props.entity
}
</script>

<!-- Modified by AI on 2026-10-20 14:35:42 -->
