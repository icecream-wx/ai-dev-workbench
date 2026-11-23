<template>
  <section class="session-list">
    <header class="list-head">
      <div class="head-row">
        <strong>开发会话</strong>
        <RgButton variant="primary" size="sm" :disabled="loading" @click="emit('new-session')">新会话</RgButton>
      </div>
      <input v-model="query" class="search" type="search" placeholder="搜索标题 / 备注" />
    </header>

    <StatePanel
      v-if="loading && !sessions.length"
      variant="loading"
      skeleton="list"
      :loading-lines="3"
      test-id="session-list-loading"
      title="正在加载会话"
      class="list-state"
      compact
    />
    <StatePanel
      v-else-if="!filtered.length"
      variant="empty"
      test-id="session-list-empty"
      :title="emptyTitle"
      :description="emptyDescription"
      class="list-state"
      compact
    />

    <div v-else class="groups">
      <div v-for="group in groups" :key="group.key" class="group">
        <button type="button" class="group-head" @click="toggleGroup(group.key)">
          <el-icon class="chevron" :class="{ open: isOpen(group) }"><ArrowRight /></el-icon>
          <span class="group-title">{{ group.label }}</span>
          <span class="group-count">{{ group.sessions.length }}</span>
        </button>

        <ul v-show="isOpen(group)" class="items">
          <li
            v-for="item in group.sessions"
            :key="item.id"
            :class="['item', { selected: item.id === selectedId, active: item.status === 'active' }]"
            data-testid="session-item"
            role="button"
            tabindex="0"
            @click="emit('select', item)"
            @keyup.enter="emit('select', item)"
          >
            <div class="item-top">
              <span v-if="item.status === 'active'" class="dot" />
              <span class="item-title">{{ displayTitle(item) }}</span>
              <RgChip :tone="statusTone(item.status)" size="sm" class="status-chip">{{ sessionStatusLabel(item.status) }}</RgChip>
            </div>
            <div class="item-meta">
              <span>{{ sessionTimeLabel(item) }}</span>
              <span>{{ modelShort(item.model) }}</span>
            </div>
            <p v-if="item.note" class="item-note">{{ item.note }}</p>
            <div class="item-actions" @click.stop>
              <RgButton size="sm" data-testid="session-rename" @click="emit('rename', item)">重命名</RgButton>
              <RgButton v-if="item.status === 'active'" size="sm" data-testid="session-archive" @click="emit('archive', item)">归档</RgButton>
              <RgButton v-else-if="item.status === 'archived'" size="sm" data-testid="session-restore" @click="emit('restore', item)">恢复</RgButton>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import StatePanel from '../shared/StatePanel.vue'
import RgButton from '../shared/RgButton.vue'
import RgChip from '../shared/RgChip.vue'
import type { DevSessionListItem } from './types'
import {
  displayTitle,
  filterSessions,
  groupSessions,
  modelShort,
  sessionStatusLabel,
  sessionTimeLabel
} from './session-labels.js'

const props = defineProps<{
  sessions: DevSessionListItem[]
  selectedId: string | null
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [item: DevSessionListItem]
  rename: [item: DevSessionListItem]
  archive: [item: DevSessionListItem]
  restore: [item: DevSessionListItem]
  'new-session': []
}>()

const query = ref('')
const expanded = ref<Set<string>>(new Set())
let groupKeys = ''

const filtered = computed(() => filterSessions(props.sessions, query.value))
const groups = computed(() => groupSessions(filtered.value))
const searching = computed(() => Boolean(query.value.trim()))
const emptyTitle = computed(() => (searching.value ? '没有匹配的会话' : '还没有开发会话'))
const emptyDescription = computed(() =>
  searching.value ? `没有匹配“${query.value.trim()}”的会话。` : '点击“新会话”开始。'
)

watch(
  groups,
  next => {
    const keys = next.map(group => group.key).join('|')
    if (!groupKeys) {
      const target = next.find(group => group.active) ?? next[0]
      expanded.value = new Set(target ? [target.key] : [])
    } else if (keys !== groupKeys) {
      const alive = new Set(next.map(group => group.key))
      const kept = [...expanded.value].filter(key => alive.has(key))
      const target = next.find(group => group.active)
      if (target) kept.push(target.key)
      expanded.value = new Set(kept)
    }
    groupKeys = keys
  },
  { immediate: true }
)

function isOpen(group: { key: string }): boolean {
  return searching.value || expanded.value.has(group.key)
}

/** 会话状态 chip tone：进行中=绿 / 已归档=中性 / 已失效=红 */
function statusTone(status: string): 'ok' | 'neutral' | 'danger' {
  if (status === 'active') return 'ok'
  if (status === 'stale') return 'danger'
  return 'neutral'
}

function toggleGroup(key: string): void {
  if (searching.value) return
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}
</script>

<style scoped>
.session-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: var(--rg-surface, #fff);
}
.list-head {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 13px 14px 11px;
  border-bottom: 1px solid var(--rg-border, #e4e7ec);
}
.head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}
.search {
  width: 100%;
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-fill, #f4f5f7);
  border-radius: 7px;
  padding: 6px 9px;
  font-size: 12px;
  font-family: inherit;
  color: var(--rg-text, #1f2937);
  outline: none;
}
.search::placeholder {
  color: var(--rg-text-3, #8a93a3);
}
.search:focus {
  border-color: var(--rg-ai, #5b5bd6);
  background: var(--rg-surface, #fff);
  box-shadow: 0 0 0 3px var(--rg-ai-soft, #eeeefc);
}
.groups {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 6px 8px 14px;
}
.group + .group {
  margin-top: 4px;
}
.group-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  padding: 7px 4px;
  font-size: 11.5px;
  color: var(--rg-text-3, #8a93a3);
  cursor: pointer;
  text-align: left;
  border-radius: 6px;
}
.group-head:hover {
  background: var(--rg-hover, #f6f7f9);
  color: var(--rg-text-2, #4b5563);
}
.chevron {
  display: inline-flex;
  transform: rotate(0deg);
  transition: transform 0.12s ease;
  font-size: 12px;
  line-height: 1;
}
.chevron.open {
  transform: rotate(90deg);
}
.group-title {
  font-weight: 600;
  color: var(--rg-text-2, #4b5563);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.group-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--rg-text-3, #8a93a3);
}
.items {
  list-style: none;
  margin: 0;
  padding: 0 0 0 2px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.item {
  position: relative;
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.item:hover {
  background: var(--rg-hover, #f6f7f9);
  border-color: var(--rg-border, #e4e7ec);
}
.item.selected {
  background: var(--rg-ai-soft, #eeeefc);
  border-color: var(--rg-ai-border, #d9d9f7);
}
.item.active.selected {
  border-color: var(--rg-ai, #5b5bd6);
}
.item-top {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--rg-ok, #12855f);
  flex-shrink: 0;
}
.item-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--rg-text, #1f2937);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-chip {
  flex-shrink: 0;
}
.item-meta {
  display: flex;
  gap: 8px;
  font-size: 11.5px;
  color: var(--rg-text-3, #8a93a3);
  white-space: nowrap;
  overflow: hidden;
}
.item-note {
  margin: 0;
  font-size: 11.5px;
  color: var(--rg-text-3, #8a93a3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-actions {
  display: none;
  gap: 4px;
  margin-top: 2px;
}
.item:hover .item-actions,
.item.selected .item-actions,
.item:focus-within .item-actions,
.item:focus-visible .item-actions {
  display: flex;
}
.list-state {
  width: auto;
  margin: 10px 8px;
}
</style>
