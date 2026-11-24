<template>
  <section class="er-panel" data-testid="er-panel">
    <div v-if="entities.length" class="er-filter" data-testid="er-filter">
      <label class="search">
        <span>实体</span>
        <input v-model.trim="keyword" type="search" placeholder="搜索实体 name / id" data-testid="er-search" />
      </label>
    </div>
    <template v-if="visibleEntities.length">
      <div class="er-body">
        <div class="er-canvas rg-panel">
          <ErGraph
            :entities="visibleEntities"
            :selected-id="selectedId ?? undefined"
            @select="select"
            @background="collapseInspector"
          />
        </div>
        <aside
          v-if="selected && !collapsed"
          class="entity-inspector rg-panel rg-panel--sub"
          data-testid="entity-inspector"
        >
          <header class="inspector-head">
            <div class="inspector-title">
              <strong>{{ selected.name }}</strong>
              <code>{{ selected.id }}</code>
              <span v-if="selected.table" class="table">{{ selected.table }}</span>
              <span :class="['status', selected.status === 'confirmed' ? 'ok' : 'draft']">{{ statusLabel }}</span>
            </div>
            <div class="inspector-actions">
              <button
                type="button"
                class="icon-btn"
                data-testid="entity-inspector-collapse"
                title="收起为胶囊"
                @click="collapseInspector"
              >
                收起
              </button>
              <button
                type="button"
                class="icon-btn close"
                data-testid="entity-inspector-close"
                title="关闭字段浮层"
                aria-label="关闭字段浮层"
                @click="clearInspector"
              >
                ×
              </button>
            </div>
          </header>
          <div class="inspector-body" data-testid="entity-fields">
            <p v-if="selected.description" class="desc">{{ selected.description }}</p>
            <div class="field-head">
              <span>字段</span>
              <span class="count">{{ selected.fields.length }}</span>
            </div>
            <p v-if="!selected.fields.length" class="muted">该实体还没有字段。</p>
            <table v-else class="field-table">
              <thead>
                <tr>
                  <th>code</th>
                  <th>显示名</th>
                  <th>类型</th>
                  <th>约束</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="field in selected.fields" :key="field.code || field.name">
                  <td><code>{{ field.code || field.name }}</code></td>
                  <td>
                    {{ field.label || field.name }}
                    <span v-if="field.required" class="req" title="必填">*</span>
                  </td>
                  <td><code>{{ field.type }}</code></td>
                  <td>
                    <span v-if="field.unique" class="tag">唯一</span>
                    <span v-if="field.type === 'enum' && field.options?.length" class="tag enum">
                      {{ field.options.join(' / ') }}
                    </span>
                    <span v-else-if="field.ref" class="tag ref">→ {{ field.ref }}</span>
                    <span v-if="!field.unique && !field.ref && field.type !== 'enum'" class="muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="relationsOfSelected.length" class="relations">
              <strong>关系</strong>
              <span v-for="relation in relationsOfSelected" :key="`${relation.from}-${relation.to}-${relation.type}`">
                {{ relation.from }} → {{ relation.to }}（{{ relation.type }}<template v-if="relation.label"> · {{ relation.label }}</template>）
              </span>
            </p>
          </div>
        </aside>
        <button
          v-else-if="selected && collapsed"
          type="button"
          class="entity-inspector-pill"
          data-testid="entity-inspector-pill"
          @click="collapsed = false"
        >
          {{ selected.name }} · {{ selected.fields.length }} 字段
        </button>
      </div>
    </template>
    <StatePanel
      v-else
      variant="empty"
      test-id="er-empty"
      :title="entities.length ? '没有匹配的实体' : '还没有实体'"
      :description="entities.length ? '清空搜索后查看全部实体。' : '先让 agent 生成设计（entities.json），或在对话里描述要建哪些实体。'"
      class="er-state"
      compact
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ErGraph from '../design/ErGraph.vue'
import StatePanel from '../shared/StatePanel.vue'
import type { DesignEntity, DesignRelation } from '../design/types'

const props = defineProps<{ entities: DesignEntity[]; relations: DesignRelation[] }>()

/** 默认不选中实体：ER 画布占满主区，点击实体才出现右上浮层 */
const selectedId = ref<string | null>(null)
/** 浮层收起为胶囊 */
const collapsed = ref(false)
const keyword = ref('')

const visibleEntities = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  if (!search) return props.entities
  return props.entities.filter(
    entity => entity.id.toLowerCase().includes(search) || entity.name.toLowerCase().includes(search)
  )
})

const selected = computed(() => visibleEntities.value.find(entity => entity.id === selectedId.value) ?? null)
const relationsOfSelected = computed(() =>
  props.relations.filter(relation => relation.from === selectedId.value || relation.to === selectedId.value)
)
const statusLabel = computed(() => (selected.value?.status === 'confirmed' ? '已确认' : '草稿'))

function select(id: string): void {
  selectedId.value = id
  collapsed.value = false
}

/** 收起为胶囊（保留选中；胶囊点击可恢复） */
function collapseInspector(): void {
  if (selectedId.value) collapsed.value = true
}

/** 清除选中（浮层与胶囊都消失，重新点实体才出现） */
function clearInspector(): void {
  selectedId.value = null
  collapsed.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !selectedId.value) return
  if (collapsed.value) clearInspector()
  else collapseInspector()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

watch(
  visibleEntities,
  next => {
    if (selectedId.value && !next.some(entity => entity.id === selectedId.value)) clearInspector()
  },
  { deep: false }
)
</script>

<style scoped>
.er-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}
.er-filter {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.search {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--rg-text-2);
}
.search input {
  height: 28px;
  min-width: 180px;
  border: 1px solid var(--rg-border-strong);
  border-radius: 7px;
  padding: 0 8px;
  font-size: 12px;
  background: var(--rg-surface);
  color: var(--rg-text);
}
/* 画布与浮层共用的定位容器（浮层固定在画布右上角，不随画布滚动） */
.er-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}
.er-canvas {
  flex: 1 1 auto;
  min-height: 280px;
  min-width: 0;
  overflow: auto;
  padding: 16px;
}
.er-canvas :deep(.er-hint) {
  display: none;
}
.er-canvas :deep(.er-wrap) {
  height: 100%;
  min-height: 0;
}
.entity-inspector {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  width: 360px;
  max-height: 70%;
  min-height: 0;
}
.inspector-head {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.inspector-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
.inspector-title strong {
  font-size: 13.5px;
  font-weight: 600;
}
.entity-inspector code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  background: var(--rg-fill-2);
  border-radius: 4px;
  padding: 1px 5px;
}
.inspector-title .table {
  font-size: 11px;
  color: var(--rg-text-3);
}
.inspector-title .status {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.inspector-title .status.ok {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.inspector-title .status.draft {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.inspector-actions {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.icon-btn {
  border: 1px solid var(--rg-border-strong);
  border-radius: 6px;
  background: var(--rg-surface);
  color: var(--rg-text-2);
  font-size: 11px;
  line-height: 1;
  height: 24px;
  padding: 0 8px;
  cursor: pointer;
}
.icon-btn.close {
  width: 24px;
  padding: 0;
  font-size: 14px;
}
.icon-btn:hover,
.icon-btn:focus-visible {
  border-color: var(--rg-ai);
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
}
.inspector-body {
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 8px;
  overflow: auto;
}
.desc {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--rg-text-2);
  line-height: 1.55;
}
.field-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--rg-text-2);
}
.count {
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 0 7px;
}
.field-table {
  width: 100%;
  margin-top: 4px;
  border-collapse: collapse;
  font-size: 11.5px;
}
.field-table th,
.field-table td {
  border-top: 1px solid var(--rg-border);
  padding: 4px 6px;
  text-align: left;
  vertical-align: top;
}
.field-table th {
  color: var(--rg-text-3);
  font-weight: 500;
}
.req {
  color: var(--rg-danger);
}
.tag {
  display: inline-block;
  margin-right: 4px;
  font-size: 11px;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.tag.ref {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.tag.enum {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.relations {
  margin: 10px 0 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11.5px;
  color: var(--rg-text-2);
}
.muted {
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.entity-inspector-pill {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 5;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--rg-ai-border);
  border-radius: 999px;
  background: var(--rg-surface);
  color: var(--rg-text-2);
  font-size: 12px;
  box-shadow: var(--rg-shadow-1);
  cursor: pointer;
}
.entity-inspector-pill:hover,
.entity-inspector-pill:focus-visible {
  border-color: var(--rg-ai);
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
}
.er-state {
  max-width: 520px;
  margin: 36px auto;
}

@media (max-width: 768px) {
  .er-canvas {
    min-height: 220px;
  }
  .entity-inspector {
    width: min(360px, calc(100% - 24px));
    max-height: 76%;
  }
}
</style>
