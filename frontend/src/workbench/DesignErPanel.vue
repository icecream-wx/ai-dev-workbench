<template>
  <section class="er-panel" data-testid="er-panel">
    <template v-if="entities.length">
      <div class="er-canvas">
        <ErGraph :entities="entities" :selected-id="selectedId ?? undefined" @select="select" />
      </div>
      <aside class="field-panel" data-testid="entity-fields">
        <template v-if="selected">
          <header>
            <strong>{{ selected.name }}</strong>
            <code>{{ selected.id }}</code>
            <span v-if="selected.table" class="table">{{ selected.table }}</span>
          </header>
          <p v-if="selected.description" class="desc">{{ selected.description }}</p>
          <div class="field-head">
            <span>字段</span>
            <span class="count">{{ selected.fields.length }}</span>
          </div>
          <p v-if="!selected.fields.length" class="muted">该实体还没有字段。</p>
          <table v-else class="field-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>类型</th>
                <th>约束</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="field in selected.fields" :key="field.name">
                <td>
                  {{ field.name }}
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
          <p v-if="relations.length" class="relations">
            <strong>关系</strong>
            <span v-for="relation in relations" :key="`${relation.from}-${relation.to}-${relation.type}`">
              {{ relation.from }} → {{ relation.to }}（{{ relation.type }}<template v-if="relation.label"> · {{ relation.label }}</template>）
            </span>
          </p>
        </template>
        <p v-else class="muted">点击 ER 图中的实体查看字段。</p>
      </aside>
    </template>
    <div v-else class="empty" data-testid="er-empty">
      <p>还没有实体，先让 agent 生成设计。</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ErGraph from '../design/ErGraph.vue'
import type { DesignEntity, DesignRelation } from '../design/types'

const props = defineProps<{ entities: DesignEntity[]; relations: DesignRelation[] }>()

const selectedId = ref<string | null>(null)

const selected = computed(() => props.entities.find(entity => entity.id === selectedId.value) ?? null)
const relations = computed(() =>
  props.relations.filter(relation => relation.from === selectedId.value || relation.to === selectedId.value)
)

function select(id: string): void {
  selectedId.value = id
}

watch(
  () => props.entities,
  next => {
    if (selectedId.value && !next.some(entity => entity.id === selectedId.value)) selectedId.value = null
    if (!selectedId.value) selectedId.value = next[0]?.id ?? null
  },
  { immediate: true, deep: false }
)
</script>

<style scoped>
.er-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 12px 14px 16px;
  overflow-y: auto;
}
.er-canvas {
  flex: 0 0 auto;
  min-width: 0;
  overflow-x: auto;
}
/* P3 不做实体在线编辑：隐藏 ErGraph 的“在实体编辑里维护”提示 */
.er-canvas :deep(.er-hint) {
  display: none;
}
.field-panel {
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  background: var(--rg-surface);
  padding: 10px 12px;
  min-height: 120px;
}
.field-panel header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.field-panel header strong {
  font-size: 13px;
}
.field-panel code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 10.5px;
  background: var(--rg-fill-2);
  border-radius: 4px;
  padding: 1px 5px;
}
.field-panel .table {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.desc {
  margin: 6px 0 0;
  font-size: 11.5px;
  color: var(--rg-text-2);
  line-height: 1.6;
}
.field-head {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--rg-text-2);
}
.count {
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 0 7px;
}
.field-table {
  width: 100%;
  margin-top: 6px;
  border-collapse: collapse;
  font-size: 11.5px;
}
.field-table th,
.field-table td {
  border-top: 1px solid var(--rg-border);
  padding: 5px 6px;
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
  font-size: 10px;
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
  font-size: 11px;
  color: var(--rg-text-2);
}
.muted {
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.empty {
  margin: auto;
  text-align: center;
  font-size: 12px;
  color: var(--rg-text-3);
  line-height: 1.7;
}
</style>
