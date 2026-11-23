<template>
  <aside class="outline" data-testid="module-outline">
    <header class="outline-head">
      <strong>模块</strong>
      <span class="count">{{ modules.length }}</span>
      <RgButton
        variant="primary"
        size="sm"
        :icon="Plus"
        :disabled="busy"
        data-testid="new-module-btn"
        @click="emit('create')"
      >
        新建模块
      </RgButton>
    </header>

    <StatePanel
      v-if="loading"
      variant="loading"
      skeleton="list"
      :loading-lines="3"
      test-id="module-outline-loading"
      title="正在加载模块"
      class="outline-state"
      compact
    />

    <div v-else-if="!modules.length" class="empty">还没有需求模块。先新建一个模块，或让 AI 按模板生成。</div>

    <ul v-else class="items">
      <li
        v-for="module in modules"
        :key="module.key || module.file"
        :class="['item', { on: module.key === selectedKey }]"
        :data-testid="`module-item-${module.key || 'unknown'}`"
        role="button"
        tabindex="0"
        @click="emit('select', module.key)"
        @keydown.enter="emit('select', module.key)"
      >
        <div class="item-top">
          <code>{{ module.key || '（缺 module）' }}</code>
          <span v-if="metaOf(module).errors" class="dot error" title="有错误" />
          <span v-else-if="metaOf(module).warnings" class="dot warn" title="有警告" />
        </div>
        <div class="item-title">{{ module.title || '（缺 title）' }}</div>
        <div class="item-meta">
          <span>{{ metaOf(module).sections }} 节</span>
          <span v-if="metaOf(module).template" class="tpl">{{ metaOf(module).template }}</span>
          <span v-if="metaOf(module).errors" class="badge error">{{ metaOf(module).errors }} 错</span>
          <span v-else-if="metaOf(module).warnings" class="badge warn">{{ metaOf(module).warnings }} 警</span>
        </div>
      </li>
    </ul>

    <div v-if="selected" class="actions">
      <div class="actions-row">
        <RgButton
          size="sm"
          :disabled="busy"
          data-testid="module-rename-btn"
          @click="emit('rename')"
        >
          改名
        </RgButton>
        <RgButton
          size="sm"
          :disabled="busy || isFirst"
          data-testid="module-up-btn"
          @click="emit('move', -1)"
        >
          上移
        </RgButton>
        <RgButton
          size="sm"
          :disabled="busy || isLast"
          data-testid="module-down-btn"
          @click="emit('move', 1)"
        >
          下移
        </RgButton>
      </div>
      <label class="template-row">
        <span>模板</span>
        <select
          class="template-select"
          data-testid="module-template-select"
          :value="selected.template || ''"
          :disabled="busy"
          @change="onTemplateChange"
        >
          <option value="">（使用应用默认）</option>
          <option v-for="item in templates" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import StatePanel from '../shared/StatePanel.vue'
import RgButton from '../shared/RgButton.vue'
import { moduleMeta } from './requirements-helpers.js'

interface OutlineModule {
  key: string
  title: string
  order: number
  template: string
  file: string
  sections: unknown[]
  errors: Array<{ file: string; path: string; message: string }>
  warnings: string[]
}

interface TemplateOption {
  id: string
  name: string
}

const props = defineProps<{
  modules: OutlineModule[]
  selectedKey: string | null
  templates: TemplateOption[]
  busy?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [key: string]
  create: []
  rename: []
  move: [direction: -1 | 1]
  template: [templateId: string]
}>()

const selected = computed(() => props.modules.find(module => module.key === props.selectedKey) ?? null)
const index = computed(() => (selected.value ? props.modules.indexOf(selected.value) : -1))
const isFirst = computed(() => index.value <= 0)
const isLast = computed(() => index.value < 0 || index.value >= props.modules.length - 1)

function metaOf(module: OutlineModule) {
  return moduleMeta(module)
}

function onTemplateChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  emit('template', value)
}
</script>

<style scoped>
.outline {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  border-right: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
}
.outline-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--rg-border);
}
.outline-head strong {
  font-size: 13.5px;
  font-weight: 600;
}
.count {
  font-size: 11.5px;
  color: var(--rg-text-3);
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 1px 7px;
}
.outline-head .rg-btn {
  margin-left: auto;
}
.items {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.item {
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  background: var(--rg-surface);
  padding: 16px;
  box-shadow: var(--rg-shadow-1);
  cursor: pointer;
  min-width: 0;
}
.item:hover {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.item.on {
  border-color: var(--rg-ink);
  box-shadow: 0 0 0 2px var(--rg-ai-soft);
}
.item-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.item-top code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  color: var(--rg-text-2);
  background: var(--rg-fill-2);
  border-radius: 4px;
  padding: 1px 5px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-left: auto;
}
.dot.error {
  background: var(--rg-danger);
}
.dot.warn {
  background: var(--rg-warn);
}
.item-title {
  margin-top: 4px;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-meta {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.tpl {
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 1px 6px;
}
.badge {
  border-radius: 999px;
  padding: 1px 6px;
}
.badge.error {
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
}
.badge.warn {
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
}
.actions {
  flex-shrink: 0;
  border-top: 1px solid var(--rg-border);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.actions-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.template-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--rg-text-2);
}
.template-select {
  flex: 1;
  min-width: 0;
  height: 28px;
  border: 1px solid var(--rg-border);
  border-radius: 7px;
  background: var(--rg-surface);
  color: var(--rg-text);
  font-size: 12px;
  padding: 0 6px;
}
.empty {
  margin: 18px 14px;
  font-size: 12px;
  color: var(--rg-text-3);
  line-height: 1.7;
}
.outline-state {
  width: auto;
  margin: 10px;
}
@media (max-width: 1024px) {
  .outline {
    border-right: none;
  }
}
</style>
