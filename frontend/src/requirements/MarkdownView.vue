<template>
  <div class="md-view" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{ markdown: string }>()

/** 禁用原始 HTML，避免需求文档注入脚本 */
const md = new MarkdownIt({ html: false, linkify: false, breaks: true })

const html = computed(() => md.render(props.markdown || ''))
</script>

<style scoped>
.md-view {
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--rg-text);
  word-break: break-word;
  min-width: 0;
  overflow-x: auto;
}
.md-view :deep(h1) {
  font-size: 20px;
  margin: 4px 0 12px;
}
.md-view :deep(h2) {
  font-size: 16.5px;
  margin: 18px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--rg-border);
}
.md-view :deep(h3) {
  font-size: 14.5px;
  margin: 14px 0 6px;
}
.md-view :deep(p) {
  margin: 6px 0;
}
.md-view :deep(ul),
.md-view :deep(ol) {
  padding-left: 22px;
  margin: 6px 0;
}
.md-view :deep(li) {
  margin: 3px 0;
}
.md-view :deep(blockquote) {
  margin: 8px 0;
  padding: 6px 12px;
  border-left: 3px solid var(--rg-warn);
  background: var(--rg-warn-soft);
  color: var(--rg-text-2);
  border-radius: 0 6px 6px 0;
}
.md-view :deep(code) {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  background: var(--rg-code-bg);
  color: var(--rg-code-text);
  border: 1px solid var(--rg-code-border);
  border-radius: 4px;
  padding: 1px 5px;
}
.md-view :deep(pre) {
  background: var(--rg-code-bg);
  border: 1px solid var(--rg-code-border);
  border-radius: 8px;
  padding: 10px 12px;
  overflow: auto;
}
.md-view :deep(pre code) {
  border: none;
  background: transparent;
  padding: 0;
}
.md-view :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
}
.md-view :deep(th),
.md-view :deep(td) {
  border: 1px solid var(--rg-border);
  padding: 5px 8px;
  text-align: left;
}
.md-view :deep(th) {
  background: var(--rg-fill);
}
.md-view :deep(tr:nth-child(even) td) {
  background: var(--rg-surface-2);
}
.md-view :deep(a) {
  color: var(--rg-link);
}
.md-view :deep(hr) {
  border: none;
  border-top: 1px solid var(--rg-border);
  margin: 14px 0;
}
</style>
