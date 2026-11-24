<template>
  <section class="doc" data-testid="requirements-document">
    <header class="doc-head">
      <div class="title-row">
        <h1 data-testid="doc-title">{{ requirement.title || '需求文档' }}</h1>
        <span v-if="requirement.template" class="badge" data-testid="doc-template-badge">{{ templateLabel }}</span>
        <span v-if="requirement.errors.length" class="badge error">错误 {{ requirement.errors.length }}</span>
        <span v-else-if="requirement.warnings.length" class="badge warn">警告 {{ requirement.warnings.length }}</span>
      </div>
      <div class="meta-row">
        <code data-testid="doc-file">{{ requirement.file }}</code>
        <span>{{ toc.length }} 节</span>
        <span>{{ summary.epicCount }} 个 Epic · {{ summary.storyCount }} 个 Story</span>
      </div>
      <p v-for="warning in requirement.warnings" :key="warning" class="warn-line">{{ warning }}</p>
      <p v-for="error in requirement.errors" :key="`${error.path}-${error.message}`" class="error-line">
        {{ error.file }} · {{ error.path }} · {{ error.message }}{{ error.expected ? `（期望：${error.expected}）` : '' }}
      </p>
    </header>

    <div class="doc-body">
      <nav v-if="toc.length" class="toc" data-testid="doc-toc">
        <strong>目录</strong>
        <ol>
          <li v-for="item in toc" :key="item.id" :class="[`lvl-${item.level}`]">
            <button
              type="button"
              :data-testid="`toc-item-${item.id}`"
              :title="item.kind === 'epic' ? 'Epic' : item.kind === 'story' ? 'Story' : undefined"
              @click="scrollToAnchor(item.id)"
            >
              <code v-if="item.key">{{ item.key }}</code>
              {{ item.title }}
            </button>
          </li>
        </ol>
      </nav>

      <div class="doc-main">
        <div v-if="!requirement.sections.length" class="empty">
          <p>这份需求文档还没有章节。可以在对话里让 AI 按模板补全。</p>
        </div>
        <div ref="docRoot" class="markdown-wrap" @click="onDocClick">
          <MarkdownView ref="markdownRef" :markdown="doc.markdown" />
        </div>

        <div class="design" data-testid="design-summary">
          <strong>设计摘要</strong>
          <span v-if="hasDesign">
            实体 {{ entityCount }} · 页面集 {{ pageSetCount }} · 页面 {{ pageCount }}
            <span v-if="designErrorCount" class="badge error">{{ designErrorCount }} 处格式问题</span>
          </span>
          <span v-else class="muted">还没有 docs/design/entities.json 与 pages.json</span>
          <button type="button" class="link" data-testid="go-design-btn" @click="emit('go-design')">去设计</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import MarkdownView from '../shared/MarkdownView.vue'
import { applyHeadingAnchors, buildDocument, requirementSummary } from './requirements-helpers.js'

interface DocRequirement {
  exists: boolean
  title: string
  template: string
  file: string
  sections: Array<{ key: string; title: string; level: number; markdown: string }>
  errors: Array<{ file: string; path: string; message: string; expected?: string }>
  warnings: string[]
}

interface DocEntities {
  exists?: boolean
  entities?: unknown[]
  errors?: unknown[]
}

interface DocPages {
  exists?: boolean
  pageSets?: unknown[]
  pages?: unknown[]
  errors?: unknown[]
}

const props = defineProps<{
  requirement: DocRequirement
  entities: DocEntities | null
  pages: DocPages | null
  templateName?: string
}>()
interface TocItem {
  id: string
  index: number
  level: number
  title: string
  kind?: string
  key?: string
}
const emit = defineEmits<{ 'go-design': []; 'ask-ai': [item: TocItem] }>()

const markdownRef = ref<InstanceType<typeof MarkdownView> | null>(null)
const docRoot = ref<HTMLElement | null>(null)
const doc = computed(() => buildDocument(props.requirement))
const toc = computed(() => doc.value.toc)
const summary = computed(() => requirementSummary(props.requirement))
const templateLabel = computed(() => props.templateName || props.requirement.template)

const entityCount = computed(() => (Array.isArray(props.entities?.entities) ? props.entities!.entities!.length : 0))
const pageSetCount = computed(() => (Array.isArray(props.pages?.pageSets) ? props.pages!.pageSets!.length : 0))
const pageCount = computed(() => (Array.isArray(props.pages?.pages) ? props.pages!.pages!.length : 0))
const designErrorCount = computed(
  () => (props.entities?.errors?.length ?? 0) + (props.pages?.errors?.length ?? 0)
)
const hasDesign = computed(() => entityCount.value > 0 || pageCount.value > 0 || pageSetCount.value > 0)

function headingHost(): HTMLElement | null {
  const instance = markdownRef.value as unknown as { $el?: HTMLElement } | null
  return instance?.$el ?? docRoot.value
}

async function applyAnchors(): Promise<void> {
  await nextTick()
  const host = headingHost()
  applyHeadingAnchors(host, toc.value)
  injectSectionAskButtons(host, toc.value)
}

/**
 * 为 h2/h3 标题注入「问 AI」按钮（DOM 后处理，只用于需求文档，不改共享 MarkdownView）。
 * 重新渲染后 DOM 被替换，因此每次锚点应用都重新注入；同一标题不重复注入。
 */
function injectSectionAskButtons(host: HTMLElement | null, items: TocItem[]): void {
  if (!host || !items.length) return
  const byId = new Map(items.map(item => [item.id, item]))
  const headings = Array.from(host.querySelectorAll('h2, h3, h4'))
  for (const heading of headings) {
    const item = heading.id ? byId.get(heading.id) : undefined
    if (!item || item.level > 3) continue
    if (heading.querySelector('[data-ask-anchor]')) continue
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'section-ask'
    button.dataset.testid = `section-ask-ai-${item.id}`
    button.dataset.askAnchor = item.id
    button.textContent = '问 AI'
    button.title = item.title ? `让 AI 基于「${item.title}」回答` : '让 AI 基于本章节回答'
    heading.appendChild(button)
  }
}

/** 事件委托：点击标题内「问 AI」→ 通知父视图（填入默认提问 + 隐藏章节上下文） */
function onDocClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  const button = target?.closest?.('[data-ask-anchor]') as HTMLElement | null
  if (!button) return
  const anchor = button.dataset.askAnchor ?? ''
  const item = toc.value.find(entry => entry.id === anchor)
  if (!item) return
  event.preventDefault()
  emit('ask-ai', item)
}

function scrollToAnchor(id: string): void {
  const host = headingHost()
  const element = host?.querySelector(`#${id}`) ?? (typeof document !== 'undefined' ? document.getElementById(id) : null)
  element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(
  () => [props.requirement.file, props.requirement.title, props.requirement.sections],
  applyAnchors,
  { immediate: true, deep: true }
)
</script>

<style scoped>
.doc {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: var(--rg-surface);
  overflow: hidden;
}
.doc-head {
  flex-shrink: 0;
  padding: 14px 20px 12px;
  border-bottom: 1px solid var(--rg-border);
}
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.title-row h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.2px;
}
.badge {
  font-size: 11px;
  border-radius: 999px;
  padding: 1px 8px;
  background: var(--rg-fill-2);
  color: var(--rg-text-2);
}
.badge.error {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.badge.warn {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.meta-row {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.meta-row code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
  word-break: break-all;
}
.warn-line,
.error-line {
  margin: 6px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
}
.warn-line {
  color: var(--rg-warn);
}
.error-line {
  color: var(--rg-danger);
}
.doc-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr);
}
.toc {
  min-height: 0;
  overflow-y: auto;
  border-right: 1px solid var(--rg-border);
  padding: 14px 12px;
  background: var(--rg-surface-2);
}
.toc strong {
  font-size: 12px;
  color: var(--rg-text-2);
}
.toc ol {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.toc li.lvl-3 {
  padding-left: 10px;
}
.toc li.lvl-4 {
  padding-left: 20px;
}
.toc button {
  border: none;
  background: transparent;
  color: var(--rg-text-2);
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  padding: 3px 5px;
  border-radius: 5px;
  cursor: pointer;
  width: 100%;
  word-break: break-word;
}
.toc button code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 10px;
  margin-right: 4px;
  color: var(--rg-text-3);
}
.toc button:hover {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.doc-main {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 24px 32px;
}
.markdown-wrap {
  min-width: 0;
  max-width: 880px;
}
.markdown-wrap :deep(.section-ask) {
  margin-left: 8px;
  vertical-align: middle;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-3);
  border-radius: 999px;
  font-size: 11px;
  line-height: 1;
  padding: 2px 8px;
  cursor: pointer;
  opacity: 0.85;
  white-space: nowrap;
}
.markdown-wrap :deep(.section-ask:hover),
.markdown-wrap :deep(.section-ask:focus-visible) {
  border-color: var(--rg-ai);
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  opacity: 1;
}
.markdown-wrap :deep(.section-ask:focus-visible) {
  outline: 2px solid var(--rg-focus-ring);
  outline-offset: 1px;
}
.empty {
  font-size: 12.5px;
  color: var(--rg-text-3);
  line-height: 1.7;
}
.design {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px dashed var(--rg-border);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--rg-text-2);
}
.design strong {
  font-size: 12px;
  color: var(--rg-text);
}
.muted {
  color: var(--rg-text-3);
}
.link {
  border: none;
  background: transparent;
  color: var(--rg-ai);
  font-size: 11.5px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
@media (max-width: 1280px) {
  .doc-body {
    grid-template-columns: 168px minmax(0, 1fr);
  }
}
@media (max-width: 768px) {
  .doc-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .toc {
    border-right: none;
    border-bottom: 1px solid var(--rg-border);
    max-height: 150px;
  }
}
</style>
