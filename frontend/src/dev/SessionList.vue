<template>
  <section class="session-list">
    <header class="list-head">
      <div class="head-row">
        <strong>开发会话</strong>
        <button type="button" class="btn primary small" :disabled="loading" @click="emit('new-session')">新会话</button>
      </div>
      <input v-model="query" class="search" type="search" placeholder="搜索标题 / 备注" />
    </header>

    <div v-if="loading && !sessions.length" class="list-hint">正在加载会话…</div>
    <div v-else-if="!filtered.length" class="list-empty">
      <p v-if="query.trim()">没有匹配“{{ query.trim() }}”的会话。</p>
      <p v-else>还没有开发会话。点击“新会话”开始。</p>
    </div>

    <div v-else class="groups">
      <div v-for="group in groups" :key="group.key" class="group">
        <button type="button" class="group-head" @click="toggleGroup(group.key)">
          <span class="chevron" :class="{ open: isOpen(group) }">›</span>
          <span class="group-title">{{ group.label }}</span>
          <span v-if="group.statusLabel" class="group-chip">{{ group.statusLabel }}</span>
          <span v-if="group.handoffVersion !== null" class="group-version">交接包 v{{ group.handoffVersion }}</span>
          <span class="group-count">{{ group.sessions.length }}</span>
        </button>

        <ul v-show="isOpen(group)" class="items">
          <li
            v-for="item in group.sessions"
            :key="item.id"
            :class="['item', { selected: item.id === selectedId, active: item.status === 'active' }]"
            role="button"
            tabindex="0"
            @click="emit('select', item)"
            @keyup.enter="emit('select', item)"
          >
            <div class="item-top">
              <span v-if="item.status === 'active'" class="dot" />
              <span class="item-title">{{ displayTitle(item) }}</span>
              <span :class="['status-chip', sessionStatusClass(item.status)]">{{ sessionStatusLabel(item.status) }}</span>
            </div>
            <div class="item-meta">
              <span>{{ sessionTimeLabel(item) }}</span>
              <span>{{ modelShort(item.model) }}</span>
              <span v-if="item.handoffVersion !== null">交接包 v{{ item.handoffVersion }}</span>
            </div>
            <p
              v-if="phaseChipLabel(item)"
              class="item-phase"
              :title="phaseChipLabel(item)"
              data-testid="session-phase-chip"
            >
              {{ phaseChipLabel(item) }}
            </p>
            <p v-if="item.note" class="item-note">{{ item.note }}</p>
            <div class="item-actions" @click.stop>
              <button type="button" class="mini" @click="emit('rename', item)">重命名</button>
              <button v-if="item.status === 'active'" type="button" class="mini" @click="emit('archive', item)">归档</button>
              <button v-else-if="item.status === 'archived'" type="button" class="mini" @click="emit('restore', item)">恢复</button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DevSessionListItem } from './types'
import {
  displayTitle,
  filterSessions,
  groupSessions,
  modelShort,
  sessionStatusClass,
  sessionStatusLabel,
  sessionTimeLabel
} from './session-labels.js'
import { phaseChipLabel } from './phase-labels.js'

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
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--rg-border, #e4e7ec);
}
.head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
}
.search {
  width: 100%;
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-fill, #f4f5f7);
  border-radius: 7px;
  padding: 6px 9px;
  font-size: 11.5px;
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
  font-size: 11px;
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
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 0.12s ease;
  font-size: 13px;
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
.group-chip {
  border-radius: 999px;
  padding: 1px 6px;
  background: var(--rg-fill-2, #eef0f4);
  font-size: 9.5px;
  white-space: nowrap;
}
.group-version {
  font-size: 9.5px;
  color: var(--rg-ai, #5b5bd6);
  white-space: nowrap;
}
.group-count {
  margin-left: auto;
  font-size: 10px;
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
  border-radius: 8px;
  padding: 7px 8px;
  cursor: pointer;
  border: 1px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.item:hover {
  background: var(--rg-hover, #f6f7f9);
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
  font-size: 12px;
  color: var(--rg-text, #1f2937);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-chip {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 1px 6px;
  font-size: 9.5px;
  background: var(--rg-fill-2, #eef0f4);
  color: var(--rg-text-3, #8a93a3);
}
.status-chip.active {
  color: var(--rg-ok, #12855f);
  background: var(--rg-ok-soft, #e8f5ef);
}
.status-chip.archived {
  color: var(--rg-text-3, #8a93a3);
}
.status-chip.stale {
  color: var(--rg-danger, #c23a45);
  background: var(--rg-danger-soft, #fdeeef);
}
.item-meta {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: var(--rg-text-3, #8a93a3);
  white-space: nowrap;
  overflow: hidden;
}
.item-phase {
  margin: 0;
  align-self: flex-start;
  max-width: 100%;
  border-radius: 999px;
  padding: 1px 7px;
  font-size: 9.5px;
  background: var(--rg-ai-soft, #eeeefc);
  color: var(--rg-ai, #5b5bd6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-note {
  margin: 0;
  font-size: 10.5px;
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
.mini {
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface, #fff);
  color: var(--rg-text-2, #4b5563);
  border-radius: 5px;
  padding: 3px 7px;
  font-size: 10px;
  cursor: pointer;
}
.mini:hover {
  border-color: var(--rg-border-strong, #d4d9e2);
  background: var(--rg-hover, #f6f7f9);
  color: var(--rg-text, #1f2937);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--rg-border, #e4e7ec);
  background: var(--rg-surface, #fff);
  color: var(--rg-text-2, #4b5563);
  border-radius: 7px;
  padding: 5px 9px;
  font-size: 11px;
  cursor: pointer;
}
.btn.primary {
  background: var(--rg-ink, #20242e);
  border-color: var(--rg-ink, #20242e);
  color: var(--rg-ink-contrast, #fff);
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-border-strong, #d4d9e2);
  background: var(--rg-hover, #f6f7f9);
  color: var(--rg-text, #1f2937);
}
.btn.primary:hover:not(:disabled) {
  background: var(--rg-ink-hover, #333846);
  border-color: var(--rg-ink-hover, #333846);
  color: var(--rg-ink-contrast, #fff);
}
.btn.small {
  padding: 4px 8px;
  font-size: 10.5px;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.list-hint,
.list-empty {
  padding: 18px 14px;
  font-size: 11.5px;
  color: var(--rg-text-3, #8a93a3);
  line-height: 1.7;
}
.list-empty p {
  margin: 0;
}
</style>
