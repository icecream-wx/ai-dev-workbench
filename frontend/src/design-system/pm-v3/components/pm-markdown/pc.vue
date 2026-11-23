<template>
  <div class="pm-markdown" :class="{ dark: theme === 'dark' }" @keydown="onKeyDown">
    <div class="pm-markdown-toolbar">
      <div class="pm-markdown-toolbar-btn" :class="{ active: showOutline }" @click="showOutline = !showOutline">
        <el-icon><List /></el-icon>
      </div>
      <div class="pm-markdown-toolbar-actions">
        <slot name="actions" />
      </div>
      <div v-if="content" class="pm-markdown-toolbar-info">{{ charCount }}</div>
    </div>
    <div class="pm-markdown-progress-bar">
      <div class="pm-markdown-progress-fill" :style="{ width: scrollPercent + '%' }" />
    </div>
    <div class="pm-markdown-body">
      <div v-show="showOutline" ref="outline" class="pm-markdown-outline" :style="{ width: outlineWidth + 'px' }">
        <div class="pm-markdown-outline-header">
          <span>大纲</span>
          <span class="pm-markdown-outline-toggle" @click="expandAll = !expandAll">
            {{ expandAll ? '全部折叠' : '全部展开' }}
          </span>
        </div>
        <div class="pm-markdown-outline-search">
          <el-input v-model="outlineKeyword" clearable placeholder="搜索标题..." size="small" />
        </div>
        <div class="pm-markdown-outline-list">
          <div
            v-for="h in visibleHeadings"
            :key="h._index"
            class="pm-markdown-outline-item"
            :class="[
              'pm-outline-level-' + h.level,
              { 'pm-outline-active': activeHeadingIndex === h._index }
            ]"
            :title="h.text"
            @click="scrollToHeading(h)"
          >
            <i
              class="pm-outline-arrow"
              :class="h.level <= 2 && hasChildren(h._index)
                ? (collapsedMap[h._index] ? 'el-icon-arrow-right' : 'el-icon-arrow-down')
                : 'pm-outline-arrow-placeholder'"
              @click.stop="h.level <= 2 && hasChildren(h._index) && toggleCollapse(h)"
            />
            <span class="pm-outline-text">{{ h.text }}</span>
          </div>
          <div v-if="!visibleHeadings.length" class="pm-markdown-outline-empty">
            {{ headings.length ? '无匹配结果' : '暂无标题' }}
          </div>
        </div>
        <div class="pm-markdown-outline-resizer" @mousedown.prevent="onResizeStart" />
      </div>
      <div ref="preview" class="pm-markdown-preview" @scroll="onPreviewScroll">
        <div class="markdown md-body" v-html="renderedContent" />
        <div v-show="showBackTop" class="pm-markdown-back-top" @click="scrollToTop">
          <el-icon><CaretTop /></el-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { throttle } from 'lodash-es'
import MarkdownIt from 'markdown-it'
import { List, CaretTop } from '@element-plus/icons-vue'

/**
 * Markdown 编辑器组件，基于 CodeMirror 的 Markdown 编辑与实时预览
 */
interface Heading {
  _index: number
  level: number
  text: string
  el?: HTMLElement
}

type Theme = 'light' | 'dark'

interface Props {
  modelValue?: string
  content?: string
  outlineWidth?: number
  theme?: Theme
}

const STORAGE_KEY_WIDTH = 'pm_md_outline_width'

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  content: '',
  outlineWidth: 240,
  theme: 'light',
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>()

const content = computed(() => props.modelValue || props.content)

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

const renderedContent = computed(() => {
  return md.render(content.value)
})

const showOutline = ref(true)
const headings = ref<Heading[]>([])
const observer = ref<MutationObserver | null>(null)
const outlineWidth = ref(parseInt(localStorage.getItem(STORAGE_KEY_WIDTH) || '', 10) || props.outlineWidth)
const outlineKeyword = ref('')
const activeHeadingIndex = ref(-1)
const expandAll = ref(true)
const collapsedMap = ref<Record<number, boolean>>({})
const scrollPercent = ref(0)
const showBackTop = ref(false)
const preview = ref<HTMLElement | null>(null)
const outline = ref<HTMLElement | null>(null)

let _programmaticScroll = false
let _tryParseTimer: ReturnType<typeof setTimeout> | null = null

const filteredHeadings = computed(() => {
  const kw = outlineKeyword.value.trim().toLowerCase()
  if (!kw) return headings.value
  return headings.value.filter((h) => h.text.toLowerCase().includes(kw))
})

const visibleHeadings = computed(() => {
  const kw = outlineKeyword.value.trim().toLowerCase()
  if (kw) return filteredHeadings.value
  const collapsed = Object.keys(collapsedMap.value).filter((k) => collapsedMap.value[Number(k)]).map(Number)
  if (!collapsed.length) return headings.value
  return headings.value.filter((h) => {
    for (const idx of collapsed) {
      if (h._index <= idx) continue
      const parent = headings.value[idx]
      if (!parent) continue
      if (h.level <= parent.level) continue
      let underCollapsed = true
      for (let i = idx + 1; i < h._index; i++) {
        const mid = headings.value[i]
        if (mid && mid.level <= parent.level) {
          underCollapsed = false
          break
        }
      }
      if (underCollapsed) return false
    }
    return true
  })
})

const charCount = computed(() => {
  const text = (content.value || '').replace(/\s/g, '')
  const len = text.length
  if (len >= 10000) return (len / 10000).toFixed(1) + '万'
  return len + '字'
})

watch(outlineWidth, (val) => {
  localStorage.setItem(STORAGE_KEY_WIDTH, String(val))
})

watch(expandAll, (val) => {
  if (val) {
    const map: Record<number, boolean> = {}
    headings.value.forEach((h, i) => {
      map[i] = false
    })
    collapsedMap.value = map
  } else {
    const map: Record<number, boolean> = {}
    headings.value.forEach((h, i) => {
      if (h.level <= 2 && hasChildren(i)) {
        map[i] = true
      }
    })
    collapsedMap.value = map
  }
})

function startObserver() {
  const container = preview.value
  if (!container) return
  const tryParse = () => {
    const els = container.querySelectorAll<HTMLElement>('.markdown h1, .markdown h2, .markdown h3, .markdown h4')
    if (els.length) {
      headings.value = Array.from(els).map((el, i) => ({
        _index: i,
        level: parseInt(el.tagName[1], 10),
        text: (el.textContent || '').trim(),
        el,
      }))
      onPreviewScroll()
    }
  }
  tryParse()
  observer.value = new MutationObserver(() => {
    if (_tryParseTimer) clearTimeout(_tryParseTimer)
    _tryParseTimer = setTimeout(tryParse, 100)
  })
  observer.value.observe(container, { childList: true, subtree: true })
}

const onPreviewScroll = throttle(() => {
  if (_programmaticScroll) return
  const container = preview.value
  if (!container) return
  const scrollTop = container.scrollTop
  const scrollHeight = container.scrollHeight - container.clientHeight
  scrollPercent.value = scrollHeight > 0 ? Math.min(100, (scrollTop / scrollHeight) * 100) : 0
  showBackTop.value = scrollTop > 400
  const containerRect = container.getBoundingClientRect()
  const threshold = containerRect.top + 80
  let active = -1
  for (let i = headings.value.length - 1; i >= 0; i--) {
    const el = headings.value[i].el
    if (el) {
      const top = el.getBoundingClientRect().top
      if (top >= containerRect.top - 1 && top <= threshold) {
        active = i
        break
      }
    }
  }
  if (active === -1) {
    for (let i = 0; i < headings.value.length; i++) {
      const el = headings.value[i].el
      if (el && el.getBoundingClientRect().top >= containerRect.top - 1) {
        active = i
        break
      }
    }
  }
  activeHeadingIndex.value = active
  if (active >= 0) {
    nextTick(() => {
      const list = document.querySelector('.pm-markdown-outline-list')
      const activeEl = list && list.querySelector('.pm-outline-active')
      if (activeEl) {
        const listRect = list!.getBoundingClientRect()
        const elRect = activeEl.getBoundingClientRect()
        if (elRect.top < listRect.top || elRect.bottom > listRect.bottom) {
          _programmaticScroll = true
          activeEl.scrollIntoView({ block: 'nearest' })
          requestAnimationFrame(() => { _programmaticScroll = false })
        }
      }
    })
  }
}, 80)

function hasChildren(index: number) {
  const parent = headings.value[index]
  if (!parent) return false
  const next = headings.value[index + 1]
  return next && next.level > parent.level
}

function toggleCollapse(h: Heading) {
  collapsedMap.value[h._index] = !collapsedMap.value[h._index]
}

function scrollToHeading(h: Heading) {
  if (!h || !h.el) return
  const container = preview.value
  if (!container) return
  const containerRect = container.getBoundingClientRect()
  const target = container.scrollTop + h.el.getBoundingClientRect().top - containerRect.top - 10
  const start = container.scrollTop
  const distance = target - start
  if (distance === 0) return
  const duration = Math.min(300, Math.max(80, Math.abs(distance) / 4))
  const startTime = performance.now()
  _programmaticScroll = true
  const animate = (now: number) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 3)
    container.scrollTop = start + distance * ease
    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      _programmaticScroll = false
    }
  }
  requestAnimationFrame(animate)
  activeHeadingIndex.value = h._index
}

function scrollToTop() {
  const container = preview.value
  if (!container) return
  const start = container.scrollTop
  if (start === 0) return
  const duration = Math.min(250, Math.max(60, start / 6))
  const startTime = performance.now()
  _programmaticScroll = true
  const animate = (now: number) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 3)
    container.scrollTop = start * (1 - ease)
    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      _programmaticScroll = false
    }
  }
  requestAnimationFrame(animate)
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    if (showOutline.value && outline.value) {
      const input = outline.value.querySelector('input')
      if (input) input.focus()
    }
  }
  if (e.key === 'Escape' && outlineKeyword.value) {
    outlineKeyword.value = ''
  }
}

function onResizeStart(e: MouseEvent) {
  const startX = e.clientX
  const startW = outlineWidth.value
  const onMove = (ev: MouseEvent) => {
    const w = Math.min(500, Math.max(150, startW + ev.clientX - startX))
    outlineWidth.value = w
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

onMounted(() => {
  startObserver()
})

onBeforeUnmount(() => {
  if (observer.value) observer.value.disconnect()
})
</script>

<style scoped lang="scss">
.pm-markdown {
  /* 预览接入：窄容器（如三列工作区）自动隐藏大纲，避免预览区被挤成一字一行 */
  container-type: inline-size;
  --md-bg: #f5f7fa;
  --md-border: #e4e7ed;
  --md-text: #606266;
  --md-text-muted: #909399;
  --md-hover-bg: #e8eaed;
  --md-blue: #1f5eff;
  --md-blue-light: rgba(31, 94, 255, 0.15);
  --md-cyan: #0d9fba;
  --md-amber: #b7791f;
  --md-empty: #c0c4cc;

  --md-preview-bg: #ffffff;
  --md-preview-text: #263247;
  --md-preview-text-soft: #5f6f86;
  --md-ink: #101827;
  --md-line: #dbe5f2;
  --md-line-strong: #b8c8dc;

  --md-code-bg: #eef8fb;
  --md-code-text: #0b5f6b;
  --md-code-border: #d7e2f0;
  --md-pre-bg: linear-gradient(135deg, #081225, #102144 58%, #0b3c48);
  --md-pre-text: #d9f7ff;
  --md-pre-border: #233a62;

  --md-blockquote-bg: #fff8ec;
  --md-blockquote-text: #5b4a2f;
  --md-hr-gradient: transparent, var(--md-line-strong), transparent;

  --md-table-th-bg: linear-gradient(180deg, #f6f9ff, #edf4ff);
  --md-table-th-text: #172033;
  --md-table-td-bg: rgba(255, 255, 255, .94);
  --md-table-td-text: #2c394d;
  --md-table-td-hover-bg: #f8fbff;
  --md-table-border: var(--md-line);

  --md-back-top-shadow: rgba(0, 0, 0, 0.2);
  --md-back-top-hover-shadow: rgba(31, 94, 255, 0.4);

  &.dark {
    --md-bg: #1e1e1e;
    --md-border: #333;
    --md-text: #ccc;
    --md-text-muted: #888;
    --md-hover-bg: #333;
    --md-blue: #58a6ff;
    --md-blue-light: rgba(88, 166, 255, 0.15);
    --md-cyan: #39c5cf;
    --md-amber: #d29922;
    --md-empty: #484f58;

    --md-preview-bg: #0d1117;
    --md-preview-text: #c9d1d9;
    --md-preview-text-soft: #8b949e;
    --md-ink: #e6edf3;
    --md-line: #30363d;
    --md-line-strong: #484f58;

    --md-code-bg: #2d2d44;
    --md-code-text: #c9d1d9;
    --md-code-border: #3a3a5c;
    --md-pre-bg: linear-gradient(135deg, #0d1117, #161b22 58%, #1c2333);
    --md-pre-text: #c9d1d9;
    --md-pre-border: #30363d;

    --md-blockquote-bg: #1c1c3a;
    --md-blockquote-text: #c9d1d9;
    --md-hr-gradient: transparent, var(--md-line-strong), transparent;

    --md-table-th-bg: linear-gradient(180deg, #21262d, #161b22);
    --md-table-th-text: #c9d1d9;
    --md-table-td-bg: rgba(22, 27, 34, 0.6);
    --md-table-td-text: #c9d1d9;
    --md-table-td-hover-bg: #1c2128;
    --md-table-border: var(--md-line);

    --md-back-top-shadow: rgba(0, 0, 0, 0.4);
    --md-back-top-hover-shadow: rgba(88, 166, 255, 0.4);
  }

  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.pm-markdown-toolbar {
  display: flex;
  align-items: center;
  height: 30px;
  padding: 0 8px;
  background: var(--md-bg);
  border-bottom: 1px solid var(--md-border);
  flex-shrink: 0;
}

.pm-markdown-toolbar-btn {
  padding: 2px 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--md-text);
  border-radius: 3px;
  display: flex;
  align-items: center;
}

.pm-markdown-toolbar-actions {
  margin-left: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.pm-markdown-toolbar-btn:hover,
.pm-markdown-toolbar-btn.active {
  background: var(--md-hover-bg);
}

.pm-markdown-toolbar-info {
  margin-left: auto;
  font-size: 11px;
  color: var(--md-text-muted);
  white-space: nowrap;
  padding-right: 4px;
}

.pm-markdown-progress-bar {
  height: 2px;
  background: var(--md-border);
  flex-shrink: 0;
}

.pm-markdown-progress-fill {
  height: 100%;
  background: var(--md-blue);
  transition: width 0.15s;
  border-radius: 0 1px 1px 0;
}

.pm-markdown-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.pm-markdown-outline {
  position: relative;
  background: var(--md-bg);
  border-right: 1px solid var(--md-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.pm-markdown-outline-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}

.pm-markdown-outline-resizer:hover {
  background: rgba(31, 94, 255, 0.3);
}

.pm-markdown-outline-header {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--md-text);
  border-bottom: 1px solid var(--md-border);
  flex-shrink: 0;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pm-markdown-outline-toggle {
  font-size: 11px;
  cursor: pointer;
  color: var(--md-blue);
  opacity: 0.8;
  user-select: none;
}

.pm-markdown-outline-toggle:hover {
  opacity: 1;
}

.pm-markdown-outline-search {
  padding: 4px 8px 6px;
  flex-shrink: 0;
}

.pm-markdown-outline-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.pm-markdown-outline-item {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--md-text);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.15s;
  line-height: 1.5;
  display: flex;
  align-items: center;
}

.pm-markdown-outline-item:hover {
  background: var(--md-hover-bg);
}

.pm-outline-active {
  background: var(--md-blue-light) !important;
  border-left: 2px solid var(--md-blue);
}

.pm-outline-arrow {
  flex-shrink: 0;
  font-size: 10px;
  margin-right: 4px;
  width: 12px;
  text-align: center;
}
.pm-outline-arrow-placeholder {
  visibility: hidden;
}

.pm-outline-text {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.pm-markdown-outline-empty {
  padding: 12px;
  font-size: 13px;
  color: var(--md-empty);
  text-align: center;
}

.pm-outline-level-2 {
  padding-left: 24px;
}

.pm-outline-level-3 {
  padding-left: 36px;
  font-size: 12px;
}

.pm-outline-level-4 {
  padding-left: 48px;
  font-size: 12px;
  color: var(--md-text-muted);
}

.pm-markdown-preview {
  padding: 0;
  background: var(--md-preview-bg);
  flex: 1;
  overflow: auto;
  box-sizing: border-box;
  position: relative;

  :deep(.markdown) {
    padding: 8px 26px 34px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
    font-size: 14px;
    color: var(--md-preview-text);
    line-height: 1.78;

    code, pre {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }

    h1, h2, h3, h4 {
      position: relative;
      scroll-margin-top: 92px;
      letter-spacing: 0;
    }

    h1 {
      margin: 28px 0 18px;
      font-size: 30px;
      line-height: 1.24;
      color: var(--md-ink);
    }

    h2 {
      margin: 30px -6px 14px;
      padding: 14px 16px;
      border: 1px solid var(--md-line);
      border-left: 4px solid var(--md-blue);
      border-radius: 8px;
      background: linear-gradient(90deg, rgba(31, 94, 255, .08), rgba(13, 159, 186, .04), transparent);
      font-size: 21px;
      line-height: 1.35;
      color: var(--md-ink);
    }

    h3 {
      margin: 24px 0 12px;
      padding-left: 12px;
      border-left: 3px solid var(--md-cyan);
      font-size: 17px;
      color: var(--md-ink);
    }

    h4 {
      margin: 20px 0 10px;
      font-size: 15px;
      color: var(--md-ink);
    }

    p {
      margin: 10px 0;
      color: var(--md-preview-text);
      line-height: 1.78;
    }

    strong {
      color: var(--md-ink);
    }

    a {
      color: var(--md-blue);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    code {
      padding: 2px 6px;
      border: 1px solid var(--md-code-border);
      border-radius: 6px;
      color: var(--md-code-text);
      background: var(--md-code-bg);
      font-size: .92em;
    }

    pre {
      overflow: auto;
      margin: 14px 0;
      padding: 16px;
      border: 1px solid var(--md-pre-border);
      border-radius: 8px;
      color: var(--md-pre-text);
      background: var(--md-pre-bg);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
      line-height: 1.62;
    }

    pre code {
      padding: 0;
      border: 0;
      color: inherit;
      background: transparent;
    }

    blockquote {
      margin: 14px 0;
      padding: 12px 14px;
      border-left: 4px solid var(--md-amber);
      border-radius: 8px;
      background: var(--md-blockquote-bg);
      color: var(--md-blockquote-text);
    }

    hr {
      height: 1px;
      margin: 24px 0;
      border: 0;
      background: linear-gradient(90deg, var(--md-hr-gradient));
    }

    ul, ol {
      margin: 10px 0 14px 24px;
      padding: 0;
      color: var(--md-preview-text);
      line-height: 1.72;
    }

    img {
      max-width: 100%;
      border-radius: 6px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0 18px;
      font-size: 13px;
    }

    th {
      color: var(--md-table-th-text);
      background: var(--md-table-th-bg);
      font-weight: 800;
      white-space: nowrap;
    }

    th, td {
      padding: 10px 12px;
      border: 1px solid var(--md-table-border);
      text-align: left;
      vertical-align: top;
      line-height: 1.55;
    }

    td {
      color: var(--md-table-td-text);
      background: var(--md-table-td-bg);
    }

    tr:hover td {
      background: var(--md-table-td-hover-bg);
    }
  }
}

.pm-markdown-back-top {
  position: sticky;
  bottom: 20px;
  float: right;
  margin-right: 16px;
  margin-bottom: 16px;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--md-blue);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px var(--md-back-top-shadow);
  transition: opacity 0.2s, transform 0.2s;
  z-index: 5;
}

.pm-markdown-back-top:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--md-back-top-hover-shadow);
}

@container (max-width: 420px) {
  .pm-markdown-outline {
    display: none;
  }
}
</style>
