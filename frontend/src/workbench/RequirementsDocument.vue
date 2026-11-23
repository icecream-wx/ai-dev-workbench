<template>
  <section class="doc" data-testid="requirements-document">
    <header class="doc-head">
      <div class="title-row">
        <h1 data-testid="doc-title">{{ module.title || module.key }}</h1>
        <span v-if="module.template" class="badge" data-testid="doc-template-badge">{{ templateLabel }}</span>
        <span v-if="module.errors.length" class="badge error">错误 {{ module.errors.length }}</span>
        <span v-else-if="module.warnings.length" class="badge warn">警告 {{ module.warnings.length }}</span>
      </div>
      <div class="meta-row">
        <code data-testid="doc-file">{{ module.file }}</code>
        <span>{{ toc.length }} 节</span>
        <span>{{ module.key }}</span>
      </div>
      <p v-for="warning in module.warnings" :key="warning" class="warn-line">{{ warning }}</p>
      <p v-for="error in module.errors" :key="`${error.path}-${error.message}`" class="error-line">
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
              @click="scrollToAnchor(item.id)"
            >
              {{ item.title }}
            </button>
          </li>
        </ol>
      </nav>

      <div class="doc-main">
        <div v-if="!module.sections.length" class="empty">
          <p>这个模块还没有章节。可以在对话里让 AI 按模板补全。</p>
        </div>
        <div ref="docRoot" class="markdown-wrap">
          <MarkdownView ref="markdownRef" :markdown="doc.markdown" />
        </div>

        <div class="design" data-testid="design-summary">
          <strong>设计摘要</strong>
          <span v-if="design">
            实体 {{ design.entities.length }} · 页面 {{ design.pages.length }}
            <span v-if="design.errors.length" class="badge error">{{ design.errors.length }} 处格式问题</span>
          </span>
          <span v-else class="muted">该模块还没有 docs/design/{{ module.key }}/design.json</span>
          <button type="button" class="link" data-testid="go-design-btn" @click="emit('go-design')">去设计</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import MarkdownView from '../shared/MarkdownView.vue'
import { applyHeadingAnchors, buildDocument } from './requirements-helpers.js'

interface DocModule {
  key: string
  title: string
  template: string
  file: string
  sections: Array<{ key: string; title: string; level: number; markdown: string }>
  errors: Array<{ file: string; path: string; message: string; expected?: string }>
  warnings: string[]
}

interface DocDesign {
  file: string
  module: string
  title: string
  entities: unknown[]
  pages: unknown[]
  errors: unknown[]
}

const props = defineProps<{ module: DocModule; design: DocDesign | null; templateName?: string }>()
const emit = defineEmits<{ 'go-design': [] }>()

const markdownRef = ref<InstanceType<typeof MarkdownView> | null>(null)
const docRoot = ref<HTMLElement | null>(null)
const doc = computed(() => buildDocument(props.module))
const toc = computed(() => doc.value.toc)
const templateLabel = computed(() => props.templateName || props.module.template)

function headingHost(): HTMLElement | null {
  const instance = markdownRef.value as unknown as { $el?: HTMLElement } | null
  return instance?.$el ?? docRoot.value
}

async function applyAnchors(): Promise<void> {
  await nextTick()
  applyHeadingAnchors(headingHost(), toc.value)
}

function scrollToAnchor(id: string): void {
  const host = headingHost()
  const element = host?.querySelector(`#${id}`) ?? (typeof document !== 'undefined' ? document.getElementById(id) : null)
  element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(() => [props.module.file, props.module.title, props.module.sections], applyAnchors, { immediate: true, deep: true })
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
  grid-template-columns: 184px minmax(0, 1fr);
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
    grid-template-columns: 160px minmax(0, 1fr);
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
