<template>
  <details class="tool-card" :open="item.status === 'running' || item.status === 'error' || item.status === 'streaming'">
    <summary class="tool-head">
      <span class="tool-icon" :class="iconClass">{{ icon }}</span>
      <span class="tool-name">{{ item.name }}</span>
      <code v-if="item.target" class="tool-target">{{ item.target }}</code>
      <span class="tool-meta">
        <span v-if="item.durationMs !== null" class="duration">{{ formatDuration(item.durationMs) }}</span>
        <span :class="['tool-status', statusClass]">{{ statusLabel }}</span>
      </span>
    </summary>

    <div v-if="item.error?.message" class="tool-error">{{ item.error.message }}</div>

    <div v-if="item.diff" class="diff-block">
      <div class="diff-head">
        <span>{{ item.diff.mode === 'create' ? '新建' : '修改' }} {{ item.diff.path || item.target }}</span>
        <span class="diff-stat"><b class="add">+{{ item.diff.added }}</b> <b class="del">-{{ item.diff.removed }}</b></span>
      </div>
      <pre class="diff-lines"><code><span v-for="(line, index) in diffLines" :key="index" :class="'dl ' + line.kind">{{ line.text }}</span></code></pre>
      <p v-if="item.diff.truncated" class="muted">diff 已截断</p>
    </div>

    <div v-else-if="item.output.text" class="output-block">
      <pre class="output-text">{{ item.output.text }}</pre>
      <div class="output-meta">
        <span v-if="typeof item.output.exit === 'number'" :class="{ bad: item.output.exit !== 0 }">exit {{ item.output.exit }}</span>
        <span v-if="item.output.truncated" class="muted">输出已截断</span>
      </div>
    </div>

    <p v-else-if="item.status === 'running' || item.status === 'streaming'" class="muted">运行中…</p>

    <details v-if="Object.keys(item.input).length" class="input-block">
      <summary>参数</summary>
      <pre>{{ prettyInput }}</pre>
    </details>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DevToolItem } from './types'

const props = defineProps<{ item: DevToolItem }>()

const icon = computed(() => {
  const name = props.item.name
  if (['write', 'edit', 'patch', 'multiedit', 'apply_patch'].includes(name)) return '✎'
  if (['read', 'glob', 'grep', 'list', 'ls'].includes(name)) return '⌕'
  if (name === 'shell' || name === 'bash') return '›_'
  return '◆'
})

const iconClass = computed(() => (
  ['write', 'edit', 'patch', 'multiedit', 'apply_patch'].includes(props.item.name) ? 'write' : ''
))

const statusLabel = computed(() => {
  const status = props.item.status
  if (status === 'running' || status === 'streaming') return '运行中'
  if (status === 'error') return '失败'
  if (status === 'completed' || status === 'success') return '完成'
  return status || '—'
})

const statusClass = computed(() => ({
  running: props.item.status === 'running' || props.item.status === 'streaming',
  bad: props.item.status === 'error' || (typeof props.item.output.exit === 'number' && props.item.output.exit !== 0),
  ok: props.item.status === 'completed' || props.item.status === 'success'
}))

const diffLines = computed(() => props.item.diff?.text.split('\n').map(line => ({
  kind: line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : 'ctx',
  text: line
})) ?? [])

const prettyInput = computed(() => {
  try {
    return JSON.stringify(props.item.input, null, 2)
  } catch {
    return String(props.item.input)
  }
})

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<style scoped>
.tool-card {
  border: 1px solid var(--rg-border, #e4e7ec);
  border-radius: 8px;
  background: var(--rg-surface, #fff);
  overflow: hidden;
}
.tool-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  font-size: 12px;
  color: var(--rg-text-2, #4b5563);
  list-style: none;
}
.tool-head:hover {
  background: var(--rg-hover, #f6f7f9);
}
.tool-head:focus-visible,
.input-block summary:focus-visible {
  outline: 2px solid var(--rg-focus-ring);
  outline-offset: -2px;
}
.tool-head::-webkit-details-marker {
  display: none;
}
.tool-icon {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: var(--rg-fill-2, #eef0f4);
  font-size: 11px;
  color: var(--rg-text-3, #8a93a3);
}
.tool-icon.write {
  background: var(--rg-ai-soft, #eeeefc);
  color: var(--rg-ai, #5b5bd6);
}
.tool-name {
  font-weight: 600;
  color: var(--rg-text, #1f2937);
}
.tool-target {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  color: var(--rg-text-3, #8a93a3);
}
.tool-meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.duration {
  font-size: 10.5px;
  color: var(--rg-text-3, #8a93a3);
}
.tool-status {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-fill-2, #eef0f4);
  color: var(--rg-text-3, #8a93a3);
}
.tool-status.running {
  background: var(--rg-ai-soft, #eeeefc);
  color: var(--rg-ai, #5b5bd6);
}
.tool-status.ok {
  background: var(--rg-ok-soft, #e8f5ef);
  color: var(--rg-ok, #12855f);
}
.tool-status.bad {
  background: var(--rg-danger-soft, #fdeeef);
  color: var(--rg-danger, #c23a45);
}
.tool-error {
  margin: 0 10px 8px;
  padding: 7px 9px;
  border-radius: 6px;
  background: var(--rg-danger-soft, #fdeeef);
  color: var(--rg-danger, #c23a45);
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.diff-block,
.output-block {
  border-top: 1px solid var(--rg-border, #e4e7ec);
}
.diff-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--rg-text-3, #8a93a3);
  font-family: 'JetBrains Mono', Consolas, monospace;
}
.diff-stat b {
  font-weight: 600;
}
.diff-stat .add {
  color: var(--rg-ok, #12855f);
}
.diff-stat .del {
  color: var(--rg-danger, #c23a45);
}
.diff-lines,
.output-text,
.input-block pre {
  margin: 0;
  padding: 8px 10px;
  max-height: 320px;
  overflow: auto;
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--rg-text-2, #4b5563);
}
.diff-lines {
  padding: 0;
  background: var(--rg-fill, #f4f5f7);
}
.dl {
  display: block;
  padding: 0 10px;
  min-height: 1.6em;
}
.dl.add {
  background: var(--rg-diff-add-bg, rgba(18, 133, 95, 0.1));
  color: var(--rg-ok, #12855f);
}
.dl.del {
  background: var(--rg-diff-del-bg, rgba(194, 58, 69, 0.08));
  color: var(--rg-danger, #c23a45);
}
.output-text {
  background: var(--rg-terminal-bg, #1d2129);
  color: var(--rg-terminal-text, #d7dae2);
}
.output-meta {
  display: flex;
  gap: 10px;
  padding: 4px 10px 7px;
  font-size: 10.5px;
  color: var(--rg-text-3, #8a93a3);
}
.output-meta .bad {
  color: var(--rg-danger, #c23a45);
}
.input-block {
  border-top: 1px solid var(--rg-border, #e4e7ec);
}
.input-block pre {
  background: var(--rg-code-bg, #f6f8fa);
  color: var(--rg-code-text, #333a45);
}
.input-block summary {
  padding: 6px 10px;
  font-size: 11px;
  color: var(--rg-text-3, #8a93a3);
  cursor: pointer;
}
.input-block summary:hover {
  color: var(--rg-text-2, #4b5563);
}
.muted {
  margin: 0;
  padding: 7px 10px;
  font-size: 11px;
  color: var(--rg-text-3, #8a93a3);
}
</style>
