<template>
  <div class="er-wrap">
    <div class="er-toolbar">
      <div class="er-counts">
        <span>表 <strong>{{ entities.length }}</strong></span>
        <span class="er-sep">·</span>
        <span>关系 <strong>{{ layout.edges.length }}</strong></span>
      </div>
      <div class="er-legend" aria-label="图例">
        <span class="er-legend-item"><i class="er-legend-badge pk">PK</i>主键</span>
        <span class="er-legend-item"><i class="er-legend-badge fk">FK</i>外键</span>
        <span class="er-legend-item"><i class="er-legend-flag star">*</i>必填</span>
        <span class="er-legend-item"><i class="er-legend-flag unique">U</i>唯一</span>
      </div>
      <label class="er-zoom">
        <span>缩放</span>
        <select v-model.number="zoom" aria-label="缩放比例">
          <option :value="75">75%</option>
          <option :value="100">100%</option>
          <option :value="125">125%</option>
        </select>
      </label>
      <span class="er-hint">关系在实体编辑里维护</span>
    </div>

    <div :class="['er-canvas', { empty: !entities.length }]">
      <svg
        v-if="entities.length"
        class="er-svg"
        :viewBox="`0 0 ${layout.width} ${layout.height}`"
        :style="canvasStyle"
        role="img"
        :aria-label="`实体关系图，${entities.length} 张表，${layout.edges.length} 条关系`"
      >
        <defs>
          <marker
            id="er-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" class="er-arrow" />
          </marker>
        </defs>

        <g v-for="edge in layout.edges" :key="edge.key" class="er-edge">
          <title>{{ edge.title }}</title>
          <path :d="edge.path" class="er-edge-hit" />
          <path :d="edge.path" class="er-edge-line" marker-end="url(#er-arrow)" />
          <g class="er-edge-label">
            <rect
              :x="edge.labelX - edge.labelWidth / 2"
              :y="edge.labelY - edge.labelHeight / 2"
              :width="edge.labelWidth"
              :height="edge.labelHeight"
              rx="4"
            />
            <text
              :x="edge.labelX"
              :y="edge.labelSubtext ? edge.labelY - 2 : edge.labelY + 3"
              text-anchor="middle"
              class="er-edge-cardinality"
            >
              {{ edge.label }}
            </text>
            <text
              v-if="edge.labelSubtext"
              :x="edge.labelX"
              :y="edge.labelY + 9"
              text-anchor="middle"
              class="er-edge-name"
            >
              {{ edge.labelSubtext }}
            </text>
          </g>
        </g>

        <g
          v-for="node in layout.nodes"
          :key="node.id"
          :class="['er-node', { on: node.id === selectedId, draft: node.entity.status !== 'confirmed' }]"
          role="button"
          tabindex="0"
          :aria-label="`${node.entity.name}（${node.entity.tableName || '未设表名'}），${node.entity.fields.length} 个字段，${node.statusLabel}`"
          @click="emit('select', node.id)"
          @keydown="onNodeKeydown($event, node.id)"
        >
          <title>{{ node.entity.name }} · {{ node.entity.tableName || '未设表名' }}</title>
          <rect
            class="er-card-shadow"
            :x="node.x + 2"
            :y="node.y + 3"
            :width="node.width"
            :height="node.height"
            rx="10"
          />
          <rect class="er-card" :x="node.x" :y="node.y" :width="node.width" :height="node.height" rx="10" />
          <path class="er-header" :d="headerPath(node)" />
          <rect v-if="node.id === selectedId" class="er-accent-bar" :x="node.x" :y="node.y + 14" width="3" :height="node.height - 28" rx="1.5" />
          <line class="er-divider" :x1="node.x + 1" :x2="node.x + node.width - 1" :y1="node.y + node.headerHeight" :y2="node.y + node.headerHeight" />

          <text class="er-entity-name" :x="node.x + 12" :y="node.y + 18">{{ node.nameText }}</text>
          <text class="er-table-name" :x="node.x + 12" :y="node.y + 34">{{ node.tableText }}</text>
          <rect
            :class="['er-chip', node.entity.status === 'confirmed' ? 'ok' : 'draft']"
            :x="node.x + node.width - 54"
            :y="node.y + 11"
            width="42"
            height="16"
            rx="8"
          />
          <text
            :class="['er-chip-text', node.entity.status === 'confirmed' ? 'ok' : 'draft']"
            :x="node.x + node.width - 33"
            :y="node.y + 22.5"
            text-anchor="middle"
          >
            {{ node.statusLabel }}
          </text>

          <g v-for="row in node.rows" :key="row.index" class="er-row">
            <title>
              {{ row.name }}{{ row.label ? `（${row.label}）` : '' }} · {{ row.sqlType
              }}{{ row.fk && row.refName ? ` → ${row.refName}` : '' }}{{ row.required ? ' · 必填' : ''
              }}{{ row.unique ? ' · 唯一' : '' }}
            </title>
            <rect
              v-if="row.pk"
              class="er-key-badge pk"
              :x="node.x + 9"
              :y="rowY(node, row) - 9"
              width="15"
              height="11"
              rx="3"
            />
            <text v-if="row.pk" class="er-key-text pk" :x="node.x + 16.5" :y="rowY(node, row) - 1" text-anchor="middle">PK</text>
            <rect
              v-if="row.fk"
              class="er-key-badge fk"
              :x="node.x + 26"
              :y="rowY(node, row) - 9"
              width="15"
              height="11"
              rx="3"
            />
            <text v-if="row.fk" class="er-key-text fk" :x="node.x + 33.5" :y="rowY(node, row) - 1" text-anchor="middle">FK</text>
            <text v-if="row.required" class="er-flag-text star" :x="node.x + 45" :y="rowY(node, row)">*</text>
            <text v-if="row.unique" class="er-flag-text unique" :x="node.x + 54" :y="rowY(node, row) - 1">U</text>
            <text class="er-field-name" :x="node.x + 64" :y="rowY(node, row)">{{ row.nameText }}</text>
            <text v-if="row.fk && row.refText" class="er-field-ref" :x="node.x + 144" :y="rowY(node, row)">→ {{ row.refText }}</text>
            <text class="er-field-type" :x="node.x + node.width - 10" :y="rowY(node, row)" text-anchor="end">{{ row.typeText }}</text>
          </g>
          <text v-if="node.moreCount > 0" class="er-more" :x="node.x + 12" :y="moreY(node)">+{{ node.moreCount }} 更多字段</text>
        </g>
      </svg>
      <div v-else class="er-empty">还没有实体；先在左侧新增或让 AI 生成实体设计。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { buildErLayout, ROW_H } from './er-layout.js'
import type { DesignEntity } from './types'

const props = defineProps<{ entities: DesignEntity[]; selectedId?: string }>()
const emit = defineEmits<{ select: [string] }>()

const zoom = ref(100)
const layout = computed(() => buildErLayout(props.entities))
const canvasStyle = computed(() => ({
  width: `${(layout.value.width * zoom.value) / 100}px`,
  height: `${(layout.value.height * zoom.value) / 100}px`
}))

interface LayoutNode {
  x: number
  y: number
  width: number
  height: number
  headerHeight: number
  rows: unknown[]
}

interface LayoutRow {
  index: number
}

function headerPath(node: LayoutNode): string {
  const radius = 10
  const { x, y, width, headerHeight } = node
  return [
    `M ${x} ${y + radius}`,
    `A ${radius} ${radius} 0 0 1 ${x + radius} ${y}`,
    `L ${x + width - radius} ${y}`,
    `A ${radius} ${radius} 0 0 1 ${x + width} ${y + radius}`,
    `L ${x + width} ${y + headerHeight}`,
    `L ${x} ${y + headerHeight}`,
    'Z'
  ].join(' ')
}

function rowY(node: LayoutNode, row: LayoutRow): number {
  return node.y + node.headerHeight + row.index * ROW_H + 14
}

function moreY(node: LayoutNode): number {
  return node.y + node.headerHeight + node.rows.length * ROW_H + 13
}

function onNodeKeydown(event: KeyboardEvent, id: string): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  emit('select', id)
}
</script>

<style scoped>
.er-wrap {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 340px);
  min-height: 400px;
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  background: var(--rg-surface);
  overflow: hidden;
}
.er-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-bottom: 1px solid var(--rg-border);
  background: var(--rg-surface);
}
.er-counts {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  white-space: nowrap;
}
.er-counts strong {
  color: var(--rg-text);
  font-weight: 700;
}
.er-sep {
  color: var(--rg-text-3);
}
.er-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.er-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: var(--rg-text-3);
  white-space: nowrap;
}
.er-legend-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 12px;
  padding: 0 2px;
  border-radius: 3px;
  font-family: var(--rg-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 8px;
  font-style: normal;
  font-weight: 700;
  line-height: 1;
}
.er-legend-badge.pk {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.er-legend-badge.fk {
  background: var(--rg-accent-soft);
  color: var(--rg-accent);
}
.er-legend-flag {
  display: inline-block;
  width: 9px;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  text-align: center;
  line-height: 1;
}
.er-legend-flag.star {
  color: var(--rg-warn);
}
.er-legend-flag.unique {
  color: var(--rg-ok);
}
.er-zoom {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--rg-text-3);
  white-space: nowrap;
}
.er-zoom select {
  height: 24px;
  padding: 0 4px;
  border: 1px solid var(--rg-border-strong);
  border-radius: 6px;
  background: var(--rg-surface);
  color: var(--rg-text-2);
  font-size: 10.5px;
  outline: none;
}
.er-zoom select:focus-visible {
  border-color: var(--rg-ai);
  box-shadow: 0 0 0 2px var(--rg-focus-ring);
}
.er-hint {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--rg-text-3);
  white-space: nowrap;
}
.er-canvas {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  background-color: var(--rg-canvas);
  background-image: radial-gradient(var(--rg-canvas-dot) 1px, transparent 1px);
  background-size: 16px 16px;
  background-position: -1px -1px;
}
.er-canvas.empty {
  display: grid;
  place-items: center;
}
.er-svg {
  display: block;
}
.er-empty {
  padding: 28px;
  text-align: center;
  font-size: 12px;
  color: var(--rg-text-3);
}

/* ---- 边 ---- */
.er-edge-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 10;
}
.er-edge-line {
  fill: none;
  stroke: var(--rg-border-strong);
  stroke-width: 1.3;
}
.er-edge:hover .er-edge-line {
  stroke: var(--rg-ai);
}
.er-arrow {
  fill: var(--rg-text-3);
}
.er-edge:hover .er-arrow {
  fill: var(--rg-ai);
}
.er-edge-label rect {
  fill: var(--rg-surface);
  stroke: var(--rg-border);
  stroke-width: 1;
  opacity: 0.94;
}
.er-edge-cardinality {
  font-family: var(--rg-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 9px;
  font-weight: 700;
  fill: var(--rg-text-2);
}
.er-edge-name {
  font-size: 8.5px;
  fill: var(--rg-text-3);
}

/* ---- 节点卡片 ---- */
.er-node {
  cursor: pointer;
  outline: none;
  user-select: none;
}
.er-card-shadow {
  fill: var(--rg-border);
  opacity: 0.42;
}
.er-card {
  fill: var(--rg-surface);
  stroke: var(--rg-border-strong);
  stroke-width: 1.2;
  transition: stroke 0.15s, fill 0.15s;
}
.er-header {
  fill: var(--rg-surface-2);
}
.er-node:hover .er-card {
  stroke: var(--rg-ai-border);
}
.er-node:focus-visible .er-card {
  stroke: var(--rg-ai);
  stroke-width: 2;
}
.er-node.on .er-card {
  fill: var(--rg-ai-soft);
  stroke: var(--rg-ai);
  stroke-width: 2;
}
.er-node.draft .er-card {
  stroke-dasharray: 5 3;
}
.er-node.on.draft .er-card {
  stroke-dasharray: none;
}
.er-accent-bar {
  fill: var(--rg-ai);
}
.er-divider {
  stroke: var(--rg-border);
  stroke-width: 1;
}
.er-entity-name {
  font-size: 13px;
  font-weight: 600;
  fill: var(--rg-text);
}
.er-table-name {
  font-family: var(--rg-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 10.5px;
  fill: var(--rg-text-3);
}
.er-chip.ok {
  fill: var(--rg-ok-soft);
  stroke: var(--rg-ok-border);
  stroke-width: 1;
}
.er-chip.draft {
  fill: var(--rg-warn-soft);
  stroke: var(--rg-warn-border);
  stroke-width: 1;
}
.er-chip-text {
  font-size: 9px;
}
.er-chip-text.ok {
  fill: var(--rg-ok);
}
.er-chip-text.draft {
  fill: var(--rg-warn);
}

/* ---- 字段行 ---- */
.er-key-badge.pk {
  fill: var(--rg-ai-soft);
}
.er-key-badge.fk {
  fill: var(--rg-accent-soft);
}
.er-key-text {
  font-family: var(--rg-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 7.5px;
  font-weight: 700;
}
.er-key-text.pk {
  fill: var(--rg-ai);
}
.er-key-text.fk {
  fill: var(--rg-accent);
}
.er-flag-text {
  font-size: 10px;
  font-weight: 700;
}
.er-flag-text.star {
  fill: var(--rg-warn);
}
.er-flag-text.unique {
  font-size: 8.5px;
  fill: var(--rg-ok);
}
.er-field-name {
  font-family: var(--rg-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 10.5px;
  fill: var(--rg-text-2);
}
.er-row:hover .er-field-name {
  fill: var(--rg-text);
}
.er-field-ref {
  font-size: 9px;
  fill: var(--rg-accent);
}
.er-field-type {
  font-family: var(--rg-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 9px;
  fill: var(--rg-text-3);
}
.er-more {
  font-size: 9.5px;
  fill: var(--rg-text-3);
}

@media (max-width: 1024px) {
  .er-hint {
    margin-left: 0;
  }
}
@media (max-width: 768px) {
  .er-toolbar {
    gap: 8px 12px;
    padding: 8px 10px;
  }
  .er-wrap {
    height: calc(100vh - 380px);
    min-height: 340px;
  }
}
</style>
