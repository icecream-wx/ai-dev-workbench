<template>
  <section class="api-panel" data-testid="api-design-panel">
    <header class="api-head">
      <div class="title">
        <strong>接口设计</strong>
        <code data-testid="api-design-file">{{ apiDesign?.file || 'docs/design/api-design.md' }}</code>
      </div>
      <div class="meta" data-testid="api-design-summary">{{ summaryText }}</div>
      <div class="actions">
        <RgButton
          size="sm"
          :disabled="busy"
          data-testid="api-design-generate"
          @click="emit('generate')"
        >{{ apiDesign?.exists ? '补/更新接口设计' : '补生成接口设计' }}</RgButton>
        <RgButton
          size="sm"
          variant="danger"
          :disabled="!hasIssues || busy || fixState === 'running'"
          data-testid="api-design-fix"
          @click="fix"
        >让 AI 修</RgButton>
      </div>
    </header>

    <div
      v-if="fixState && fixState !== 'idle'"
      :class="['fix-status', fixState]"
      data-testid="api-design-fix-status"
      role="status"
    >
      <span v-if="fixState === 'running'" class="fix-spinner" aria-hidden="true" />
      <span>{{ fixStatusText }}</span>
    </div>

    <StatePanel
      v-if="!apiDesign?.exists"
      variant="empty"
      test-id="api-design-empty"
      title="还没有接口设计"
      description="接口设计会在「生成/更新设计」时与 entities/pages 同轮生成；如本次缺失，可单独补生成。只做文档，不生成后端代码。"
      class="api-state"
    >
      <template #actions>
        <RgButton variant="primary" data-testid="api-design-empty-generate" @click="emit('generate')">
          补生成接口设计
        </RgButton>
      </template>
    </StatePanel>

    <template v-else>
      <div v-if="hasIssues" class="issues" :class="{ error: errorCount > 0 }" data-testid="api-design-issues" role="alert">
        <div class="issues-head">
          <strong>{{ errorCount ? `${errorCount} 个错误` : `${warningCount} 个警告` }}</strong>
          <span>错误必须清零；警告只报告、不阻断。</span>
        </div>
        <ul>
          <li v-for="line in issueLines.slice(0, 8)" :key="line">{{ line }}</li>
        </ul>
        <p v-if="issueLines.length > 8" class="more">…其余 {{ issueLines.length - 8 }} 条见校验结果</p>
      </div>

      <div class="coverage" data-testid="api-design-coverage">
        <div class="coverage-block">
          <strong>页面动作覆盖</strong>
          <span>{{ summary.pageActionCovered }} / {{ summary.pageActionTotal }}</span>
          <ul v-if="uncoveredActions.length">
            <li v-for="item in uncoveredActions" :key="`${item.page}-${item.action}`">
              <code>{{ item.page }}</code> · {{ item.action }}（{{ item.pageSet || '未分组' }}）
            </li>
          </ul>
        </div>
        <div class="coverage-block">
          <strong>实体 CRUD 覆盖</strong>
          <span>{{ summary.entityCovered }} / {{ summary.entityTotal }}</span>
          <ul v-if="entityGaps.length">
            <li v-for="item in entityGaps" :key="item.entity">
              <code>{{ item.entity }}</code> 缺 {{ item.missing.join(' / ') }}
            </li>
          </ul>
        </div>
      </div>

      <div v-if="!apiDesign.markdown" class="render-error" data-testid="api-design-render-error">
        接口设计文档为空或无法渲染；请检查文件内容，或在对话里让 agent 重新生成。
      </div>
      <div v-else class="api-doc" data-testid="api-design-doc">
        <MarkdownView :markdown="apiDesign.markdown" />
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownView from '../shared/MarkdownView.vue'
import RgButton from '../shared/RgButton.vue'
import StatePanel from '../shared/StatePanel.vue'
import {
  apiDesignEntityGaps,
  apiDesignFixText,
  apiDesignIssueLines,
  apiDesignSummary,
  apiDesignSummaryText,
  apiDesignUncoveredActions
} from './api-design-helpers.js'
import type { ApiDesignArtifact } from './api'

const props = defineProps<{
  apiDesign: ApiDesignArtifact | null
  busy?: boolean
  /** B7：接口修复状态（running 状态条 + 完成后剩余警告） */
  fixState?: 'idle' | 'running' | 'done'
  fixSummary?: string
}>()
const emit = defineEmits<{ generate: []; fix: [text: string] }>()

const fixStatusText = computed(() => {
  if (props.fixState === 'running') return props.fixSummary || 'AI 正在修复接口设计…'
  if (props.fixState === 'done') return props.fixSummary || '修复完成'
  return ''
})

const summary = computed(() => apiDesignSummary(props.apiDesign))
const summaryText = computed(() => apiDesignSummaryText(props.apiDesign))
const issueLines = computed(() => apiDesignIssueLines(props.apiDesign))
const uncoveredActions = computed(() => apiDesignUncoveredActions(props.apiDesign))
const entityGaps = computed(() => apiDesignEntityGaps(props.apiDesign))
const errorCount = computed(() => summary.value.errorCount)
const warningCount = computed(() => summary.value.warningCount)
const hasIssues = computed(() => errorCount.value > 0 || warningCount.value > 0)

function fix(): void {
  const text = apiDesignFixText(props.apiDesign)
  if (text) emit('fix', text)
}
</script>

<style scoped>
.api-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  padding: 12px 16px 16px;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  box-shadow: var(--rg-shadow-1);
  overflow: hidden;
}
.api-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.title strong {
  font-size: 13.5px;
  font-weight: 600;
}
.title code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  color: var(--rg-text-3);
  word-break: break-all;
}
.meta {
  font-size: 11.5px;
  color: var(--rg-text-2);
}
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.fix-status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border-radius: 10px;
  font-size: 12px;
  border: 1px solid var(--rg-border);
  background: var(--rg-bg);
  color: var(--rg-text-2);
  flex-wrap: wrap;
}
.fix-status.running {
  border-color: var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.fix-status.done {
  border-color: #bfe3d0;
  background: #f0fdf6;
  color: #1f6b4a;
}
.fix-spinner {
  width: 12px;
  height: 12px;
  flex: none;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: fix-spin 0.8s linear infinite;
}
@keyframes fix-spin {
  to {
    transform: rotate(360deg);
  }
}
.issues {
  flex-shrink: 0;
  border: 1px solid var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 12px;
}
.issues.error {
  border-color: var(--rg-danger-soft);
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.issues-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.issues-head span {
  font-size: 11.5px;
  opacity: 0.85;
}
.issues ul {
  margin: 4px 0 0;
  padding-left: 16px;
  line-height: 1.6;
}
.issues li {
  word-break: break-word;
}
.more {
  margin: 4px 0 0;
  font-size: 11px;
  opacity: 0.8;
}
.coverage {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}
.coverage-block {
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  min-width: 0;
}
.coverage-block strong {
  font-size: 12px;
  color: var(--rg-text);
  margin-right: 6px;
}
.coverage-block ul {
  margin: 4px 0 0;
  padding-left: 14px;
  line-height: 1.6;
  color: var(--rg-text-3);
}
.coverage-block code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 10.5px;
}
.api-doc {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 12px 16px;
  background: var(--rg-bg);
}
.render-error {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--rg-danger);
  font-size: 12px;
  border: 1px dashed var(--rg-danger-soft);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
}
.api-state {
  max-width: 620px;
  margin: 24px auto;
}
@media (max-width: 768px) {
  .coverage {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
