<template>
  <section :class="['suggestion', { stale, settled: Boolean(applied || ignored) }]">
    <header class="sg-head">
      <span class="sg-badge">AI 建议修改</span>
      <span class="sg-counts">
        新增 {{ counts.added }} · 修改 {{ counts.modified }} · 删除 {{ counts.removed }} · 未变 {{ counts.unchanged }}
      </span>
      <span v-if="applied" class="sg-state applied">已应用 v{{ applied.version }}</span>
      <span v-else-if="ignored" class="sg-state ignored">已忽略</span>
    </header>

    <p v-if="stale" class="sg-stale">
      文档已更新（v{{ suggestion.baseVersion }} → v{{ currentVersion }}），建议已过期；请重新生成后再应用。
    </p>

    <div v-if="suggestion.titleChanged" class="sg-title">
      <el-checkbox v-model="includeTitle" :disabled="disabled" size="small">同时更新标题</el-checkbox>
      <span class="sg-title-from">{{ suggestion.titleBefore || '（无标题）' }}</span>
      <span class="sg-arrow">→</span>
      <span class="sg-title-to">{{ suggestion.title }}</span>
    </div>

    <ul v-if="visibleEntries.length" class="sg-list">
      <li v-for="entry in visibleEntries" :key="entry.sectionKey" :class="['sg-row', entry.change]">
        <div class="sg-row-head">
          <el-checkbox
            v-model="selected[entry.sectionKey]"
            size="small"
            :disabled="disabled || (entry.change === 'removed' && entry.required)"
          />
          <span :class="['sg-chip', entry.change]">{{ changeLabel(entry.change) }}</span>
          <strong class="sg-name">{{ entry.title }}</strong>
          <span v-if="entry.titleChanged && entry.titleBefore" class="sg-old-title">原：{{ entry.titleBefore }}</span>
          <span v-if="entry.required" class="sg-req">必填</span>
          <span v-if="entry.change === 'removed'" class="sg-del" :class="{ blocked: entry.required }">
            {{ entry.required ? '必填不可删' : '可删除' }}
          </span>
          <button
            v-if="entry.lineDiff && entry.lineDiff.length"
            type="button"
            class="sg-link"
            @click="toggleDiff(entry.sectionKey)"
          >
            {{ expanded[entry.sectionKey] ? '收起 diff' : '查看 diff' }}
          </button>
        </div>
        <div v-if="expanded[entry.sectionKey] && entry.lineDiff" class="sg-diff">
          <div v-for="(line, index) in entry.lineDiff" :key="index" :class="['sg-diff-line', lineClass(line.type)]">
            <span class="sg-diff-sign">{{ line.type === ' ' ? ' ' : line.type }}</span>{{ line.text || ' ' }}
          </div>
        </div>
      </li>
    </ul>

    <p v-if="!visibleEntries.length && !openIssues.length && !suggestion.titleChanged" class="sg-empty">本轮没有可应用的文档修改。</p>

    <div v-if="suggestion.warnings.length" class="sg-warnings">
      <span v-for="(warning, index) in suggestion.warnings" :key="index">· {{ warning }}</span>
    </div>

    <div v-if="openIssues.length" class="sg-issues">
      <strong class="sg-issues-title">待澄清问题</strong>
      <ul>
        <li v-for="(issue, index) in openIssues" :key="index">{{ issue.question }}</li>
      </ul>
      <el-checkbox v-model="includeIssues" :disabled="disabled" size="small">同时写入“待澄清问题”章节</el-checkbox>
    </div>

    <footer class="sg-actions">
      <button type="button" class="sg-btn primary" :disabled="disabled || !hasSelection" @click="onApplySelected">应用选中</button>
      <button type="button" class="sg-btn" :disabled="disabled" @click="onApplyAll">全部应用</button>
      <button type="button" class="sg-btn ghost" :disabled="ignoreDisabled" @click="emit('ignore')">忽略</button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { DocDiffSection, DocSuggestion } from './api'

const props = defineProps<{
  suggestion: DocSuggestion
  currentVersion: number
  readonly?: boolean
  streaming?: boolean
}>()

const emit = defineEmits<{
  apply: [
    {
      selectedKeys: string[]
      removedKeys: string[]
      includeTitle: boolean
      includeIssues: boolean
    }
  ]
  ignore: []
}>()

const selected = reactive<Record<string, boolean>>({})
const expanded = reactive<Record<string, boolean>>({})
const includeTitle = ref(true)
const includeIssues = ref(true)

const entries = computed<DocDiffSection[]>(() => (Array.isArray(props.suggestion.sections) ? props.suggestion.sections : []))
// unchanged 不展示（只计数），避免建议卡过长
const visibleEntries = computed(() => entries.value.filter(entry => entry.change !== 'unchanged'))
const counts = computed(
  () => props.suggestion.counts ?? { added: 0, modified: 0, removed: 0, unchanged: 0 }
)
const openIssues = computed(() => (Array.isArray(props.suggestion.openIssues) ? props.suggestion.openIssues : []))
const applied = computed(() => props.suggestion.applied ?? null)
const ignored = computed(() => Boolean(props.suggestion.ignored))
const stale = computed(
  () => !applied.value && !ignored.value && props.suggestion.baseVersion !== props.currentVersion
)
const disabled = computed(() => Boolean(props.streaming) || Boolean(props.readonly) || stale.value || Boolean(applied.value || ignored.value))
// 忽略只改本地状态、不写库：过期/只读也允许忽略（R2b UX 修复）
const ignoreDisabled = computed(() => Boolean(props.streaming) || Boolean(applied.value || ignored.value))

const hasSelection = computed(
  () =>
    Object.entries(selected).some(
      ([key, value]) => value && entries.value.some(entry => entry.sectionKey === key && entry.change !== 'unchanged')
    ) || (includeIssues.value && openIssues.value.length > 0) || (suggestionTitleIncluded.value && suggestionTitleEnabled.value)
)
const suggestionTitleEnabled = computed(() => Boolean(props.suggestion.titleChanged && props.suggestion.title))
const suggestionTitleIncluded = computed(() => includeTitle.value)

function initSelection(): void {
  for (const key of Object.keys(selected)) delete selected[key]
  for (const key of Object.keys(expanded)) delete expanded[key]
  for (const entry of entries.value) {
    if (entry.change === 'added' || entry.change === 'modified') selected[entry.sectionKey] = true
  }
  includeTitle.value = true
  includeIssues.value = true
}

watch(() => props.suggestion, initSelection, { immediate: true })

function changeLabel(change: DocDiffSection['change']): string {
  if (change === 'added') return '新增'
  if (change === 'modified') return '修改'
  if (change === 'removed') return '删除'
  return '未变'
}

function lineClass(type: string): string {
  if (type === '+') return 'add'
  if (type === '-') return 'del'
  return 'ctx'
}

function toggleDiff(key: string): void {
  expanded[key] = !expanded[key]
}

function selectionPayload(all: boolean): {
  selectedKeys: string[]
  removedKeys: string[]
  includeTitle: boolean
  includeIssues: boolean
} {
  const selectedKeys = entries.value
    .filter(entry => entry.change === 'added' || entry.change === 'modified')
    .filter(entry => all || selected[entry.sectionKey])
    .map(entry => entry.sectionKey)
  const removedKeys = entries.value
    .filter(entry => entry.change === 'removed' && !entry.required)
    .filter(entry => all || selected[entry.sectionKey])
    .map(entry => entry.sectionKey)
  return {
    selectedKeys,
    removedKeys,
    includeTitle: includeTitle.value && suggestionTitleEnabled.value,
    includeIssues: includeIssues.value
  }
}

function onApplySelected(): void {
  if (disabled.value) return
  emit('apply', selectionPayload(false))
}

function onApplyAll(): void {
  if (disabled.value) return
  for (const entry of entries.value) {
    if (entry.change === 'added' || entry.change === 'modified' || (entry.change === 'removed' && !entry.required)) {
      selected[entry.sectionKey] = true
    }
  }
  includeIssues.value = openIssues.value.length > 0 ? true : includeIssues.value
  emit('apply', selectionPayload(true))
}
</script>

<style scoped>
.suggestion {
  margin-top: 6px;
  border: 1px solid var(--rg-ai-border);
  background: var(--rg-ai-soft);
  border-radius: 10px;
  padding: 9px 10px;
  max-width: 96%;
  color: var(--rg-text);
}
.suggestion.stale {
  border-color: var(--rg-warn-border);
  background: var(--rg-warn-soft);
}
.suggestion.settled {
  opacity: 0.86;
}
.sg-head {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.sg-badge {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--rg-ai);
  background: var(--rg-surface);
  border: 1px solid var(--rg-ai-border);
  border-radius: 999px;
  padding: 1px 8px;
}
.sg-counts {
  font-size: 10.5px;
  color: var(--rg-text-2);
}
.sg-state {
  margin-left: auto;
  font-size: 10px;
  border-radius: 999px;
  padding: 1px 7px;
}
.sg-state.applied {
  color: var(--rg-ok);
  background: var(--rg-ok-soft);
}
.sg-state.ignored {
  color: var(--rg-text-2);
  background: var(--rg-fill);
}
.sg-stale {
  margin: 7px 0 0;
  font-size: 10.5px;
  color: var(--rg-warn);
  line-height: 1.6;
}
.sg-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
  font-size: 11px;
  color: var(--rg-text-2);
}
.sg-title-from {
  color: var(--rg-text-3);
  text-decoration: line-through;
}
.sg-arrow {
  color: var(--rg-text-3);
}
.sg-title-to {
  color: var(--rg-text);
  font-weight: 600;
}
.sg-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sg-row {
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  border-radius: 8px;
  padding: 6px 8px;
}
.sg-row-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--rg-text);
}
.sg-chip {
  font-size: 9.5px;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.sg-chip.added {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.sg-chip.modified {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.sg-chip.removed {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.sg-name {
  font-weight: 600;
}
.sg-old-title {
  font-size: 10px;
  color: var(--rg-text-3);
}
.sg-req {
  font-size: 9.5px;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border-radius: 999px;
  padding: 0 6px;
}
.sg-del {
  font-size: 9.5px;
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
  border-radius: 999px;
  padding: 0 6px;
}
.sg-del.blocked {
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
}
.sg-link {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--rg-ai);
  font-size: 10.5px;
  cursor: pointer;
  padding: 0;
}
.sg-link:hover {
  text-decoration: underline;
}
.sg-diff {
  margin-top: 6px;
  border-top: 1px dashed var(--rg-border);
  padding-top: 5px;
  max-height: 260px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 10.5px;
  line-height: 1.55;
  background: var(--rg-code-bg);
  border-radius: 6px;
}
.sg-diff-line {
  white-space: pre-wrap;
  word-break: break-word;
  padding: 0 4px;
  border-radius: 3px;
  color: var(--rg-text-2);
}
.sg-diff-line.add {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.sg-diff-line.del {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.sg-diff-line.ctx {
  color: var(--rg-text-2);
}
.sg-diff-sign {
  display: inline-block;
  width: 9px;
  color: inherit;
  opacity: 0.7;
}
.sg-empty {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--rg-text-3);
}
.sg-warnings {
  margin-top: 7px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 10.5px;
  color: var(--rg-warn);
}
.sg-issues {
  margin-top: 8px;
  border-top: 1px dashed var(--rg-border);
  padding-top: 6px;
}
.sg-issues-title {
  font-size: 11px;
  color: var(--rg-text-2);
}
.sg-issues ul {
  margin: 4px 0 6px;
  padding-left: 16px;
  font-size: 10.5px;
  color: var(--rg-text-2);
  line-height: 1.6;
}
.sg-actions {
  display: flex;
  gap: 6px;
  margin-top: 9px;
  flex-wrap: wrap;
}
.sg-btn {
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 7px;
  padding: 3px 10px;
  font-size: 11px;
  cursor: pointer;
}
.sg-btn:hover:not(:disabled) {
  border-color: var(--rg-ai-border);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.sg-btn.primary {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.sg-btn.primary:hover:not(:disabled) {
  background: var(--rg-ink-hover);
  border-color: var(--rg-ink-hover);
  color: var(--rg-ink-contrast);
}
.sg-btn.ghost {
  border-color: transparent;
  background: transparent;
  color: var(--rg-text-3);
}
.sg-btn.ghost:hover:not(:disabled) {
  color: var(--rg-text);
  background: var(--rg-hover);
}
.sg-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .suggestion {
    max-width: 100%;
  }
  .sg-btn {
    min-height: 30px;
  }
}
</style>
