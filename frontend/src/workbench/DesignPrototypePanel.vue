<template>
  <section class="proto-panel rg-panel" data-testid="prototype-panel">
    <template v-if="pages.length">
      <header class="proto-head">
        <div class="pages" data-testid="prototype-pages">
          <button
            v-for="page in pages"
            :key="page.id"
            type="button"
            :class="['page-chip', { on: page.id === currentId }]"
            :data-testid="`page-chip-${page.id}`"
            @click="currentId = page.id"
          >
            {{ page.title }}
            <span class="type">{{ pageTypeLabel(page.type) }}</span>
          </button>
        </div>
        <div class="tools">
          <span class="render-mode" data-testid="prototype-render-mode">{{ renderModeLabel }}</span>
          <div v-if="mode === 'wireframe'" class="zoom-group" role="group" aria-label="缩放">
            <button
              v-for="value in ZOOMS"
              :key="value"
              type="button"
              :class="['zoom-btn', { on: zoom === value }]"
              :data-testid="`zoom-${value}`"
              @click="zoom = value"
            >
              {{ value }}%
            </button>
          </div>
          <button
            type="button"
            class="btn small"
            data-testid="export-png-btn"
            :disabled="exporting"
            title="导出 PNG（模板风格；无契约/失败为线框）"
            @click="emit('export')"
          >
            {{ exporting ? '导出中…' : '导出 PNG' }}
          </button>
        </div>
      </header>
      <p v-if="pageHint" class="page-hint" data-testid="prototype-page-hint">{{ pageHint }}</p>
      <p v-if="mode === 'template'" class="export-hint" data-testid="prototype-export-hint">
        当前为设计产物（按所选模板渲染，{{ previewLabel }}）；导出 PNG 使用模板风格截图。
      </p>
      <div v-if="mode === 'template' && previewSrc" class="preview-wrap" data-testid="prototype-preview-wrap">
        <iframe
          :src="previewSrc"
          class="preview-frame"
          data-testid="prototype-preview-frame"
          title="设计产物模板风格预览"
        />
      </div>
      <div v-else class="canvas-wrap">
        <PrototypeCanvas
          :page="currentPage!"
          :page-set="pageSet"
          :page-sets="[pageSet]"
          :entities="entities"
          :skin="skin"
          :app-name="appName"
          :zoom="zoom"
        />
      </div>
    </template>
    <StatePanel
      v-else
      variant="empty"
      test-id="prototype-empty"
      title="这个模块还没有页面"
      description="先让 agent 生成设计，页面会出现在这里。"
      class="proto-state"
      compact
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PrototypeCanvas from '../design/PrototypeCanvas.vue'
import StatePanel from '../shared/StatePanel.vue'
import { PAGE_TYPE_LABELS, type DesignEntity, type DesignPageRender, type DesignPageSet, type PrototypeSkin } from '../design/types'
import { buildDesignPreviewUrl } from './design-template-helpers.js'
import {
  RECIPE_LABELS,
  hasExplicitContract,
  resolveContractRecipe,
  supportsTemplateRender
} from '../design-preview/contract-preview.js'

const props = defineProps<{
  pages: DesignPageRender[]
  pageSet: DesignPageSet
  entities: DesignEntity[]
  skin: PrototypeSkin
  appName: string
  appId: string
  moduleKey: string
  applicationType?: string
  styleId?: string
  designHash?: string
  designLabel?: string
  templatePages?: Array<{ id: string; name?: string; recipe?: string }>
  /** 整包导出进行中（由 DesignView 控制） */
  exporting?: boolean
}>()

const emit = defineEmits<{ (event: 'export'): void }>()

const ZOOMS = [75, 100, 125]
const zoom = ref(100)
const currentId = ref<string | null>(null)

/** 调试入口（仅内部/测试）：URL `?prototype=wireframe` 强制结构草图，用户界面不提供切换 */
const debugWireframe =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('prototype') === 'wireframe'

const currentPage = computed(() => props.pages.find(page => page.id === currentId.value) ?? props.pages[0] ?? null)

/** 页面有显式契约（recipe/catalogRef/blueprint）时可用模板风格渲染 */
const supported = computed(() => supportsTemplateRender(currentPage.value, props.templatePages ?? []))
const previewable = computed(() => supported.value && Boolean(props.appId) && Boolean(props.applicationType))

/** 渲染模式只读：有契约 → 设计产物（模板风格）；无契约/调试 → 结构草图 */
const mode = computed<'template' | 'wireframe'>(() => {
  if (debugWireframe) return 'wireframe'
  return previewable.value ? 'template' : 'wireframe'
})

const renderModeLabel = computed(() => {
  if (debugWireframe) return '调试 · 结构草图'
  if (previewable.value) return '设计产物 · 模板风格'
  if (currentPage.value && !hasExplicitContract(currentPage.value)) return '结构草图（无契约）'
  return '结构草图（缺设计模板）'
})

/** `design.json` 页面契约 → 模板风格渲染入口（iframe 同源读取 artifacts） */
const previewSrc = computed(() =>
  previewable.value
    ? buildDesignPreviewUrl({
        appId: props.appId,
        moduleKey: props.moduleKey,
        pageId: currentPage.value?.id ?? '',
        applicationType: props.applicationType ?? '',
        style: props.styleId ?? '',
        designHash: props.designHash ?? ''
      })
    : ''
)

const previewLabel = computed(
  () => props.designLabel || [props.applicationType, props.styleId].filter(Boolean).join(' · ')
)

const recipeLabel = computed(() => {
  const recipe = resolveContractRecipe(currentPage.value, props.templatePages ?? [])
  return RECIPE_LABELS[recipe] || recipe
})

const pageHint = computed(() => {
  const page = currentPage.value
  if (!page) return ''
  if (mode.value === 'template') {
    if (page.entityId) return ''
    return '该页面没有绑定本模块实体：设计产物仅渲染页面结构，实体相关内容为空。'
  }
  if (!hasExplicitContract(page)) {
    return '该页面没有显式设计契约（recipe/catalogRef/blueprint），显示结构草图；补齐契约后自动套模板。'
  }
  if (debugWireframe) return ''
  return `当前应用缺少设计模板（应用类型/风格），暂用结构草图${recipeLabel.value ? `（${recipeLabel.value}）` : ''}。`
})

function pageTypeLabel(type: string): string {
  return PAGE_TYPE_LABELS[type as keyof typeof PAGE_TYPE_LABELS] ?? type
}

watch(
  () => props.pages,
  next => {
    if (currentId.value && next.some(page => page.id === currentId.value)) return
    currentId.value = next[0]?.id ?? null
  },
  { immediate: true }
)
</script>

<style scoped>
.proto-panel {
  display: flex;
  flex-direction: column;
  gap: 9px;
  height: 100%;
  min-height: 0;
  padding: 12px 16px 16px;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  box-shadow: var(--rg-shadow-1);
}
.proto-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.pages {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
.page-chip {
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 999px;
  padding: 4px 11px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.page-chip.on {
  border-color: var(--rg-ink);
  color: var(--rg-text);
  background: var(--rg-fill-2);
}
.page-chip .type {
  font-size: 11px;
  color: var(--rg-text-3);
}
.tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.render-mode {
  flex-shrink: 0;
  font-size: 11.5px;
  color: var(--rg-text-3);
  background: var(--rg-fill-2);
  border: 1px solid var(--rg-border);
  border-radius: 999px;
  padding: 3px 9px;
  white-space: nowrap;
}
.zoom-group {
  display: inline-flex;
  border: 1px solid var(--rg-border);
  border-radius: 7px;
  overflow: hidden;
}
.zoom-btn {
  border: none;
  background: var(--rg-surface);
  color: var(--rg-text-2);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
}
.zoom-btn + .zoom-btn {
  border-left: 1px solid var(--rg-border);
}
.zoom-btn.on {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  font-weight: 600;
}
.page-hint {
  flex-shrink: 0;
  margin: 0;
  font-size: 11.5px;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border: 1px solid var(--rg-warn-border);
  border-radius: 8px;
  padding: 6px 10px;
}
.export-hint {
  flex-shrink: 0;
  margin: 0;
  font-size: 11.5px;
  color: var(--rg-text-3);
  background: var(--rg-fill-2);
  border: 1px solid var(--rg-border);
  border-radius: 8px;
  padding: 6px 10px;
}
.canvas-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  background: var(--rg-surface-2);
}
.preview-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--rg-border);
  border-radius: 12px;
  background: var(--rg-surface-2);
}
.preview-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 7px;
  padding: 3px 9px;
  font-size: 11.5px;
  cursor: pointer;
  white-space: nowrap;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.empty {
  margin: auto;
  text-align: center;
  font-size: 12.5px;
  color: var(--rg-text-3);
  line-height: 1.7;
}
.proto-state {
  max-width: 520px;
  margin: 36px auto;
}
</style>
