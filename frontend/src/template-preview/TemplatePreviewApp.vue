<template>
  <div
    class="template-preview-root visual-style-host"
    :class="[styleClass]"
    :data-type="packId"
    :data-style="styleId"
    :data-page="pageId"
    :data-kind="pageKind"
  >
    <div v-if="warnings.length" class="tpl-warning" role="status">
      <strong>预览提示</strong>
      <span v-for="item in warnings" :key="item">{{ item }}</span>
    </div>

    <div v-if="loading" class="tpl-state" data-testid="template-preview-loading">正在加载模板预览…</div>

    <div v-else-if="error" class="tpl-state error" data-testid="template-preview-error">
      <strong>预览加载失败</strong>
      <span>{{ error }}</span>
      <p v-if="availablePages.length">可选页面：{{ availablePages.map(page => page.id).join('、') }}</p>
      <p>可重试或查看生成报告。</p>
    </div>

    <iframe
      v-else-if="pageKind === 'reference' && frameSrc"
      class="tpl-frame"
      :src="frameSrc"
      :title="pageName"
      data-testid="template-preview-frame"
    />

    <div v-else-if="pageKind === 'reference'" class="tpl-state error" data-testid="template-preview-error">
      <strong>预览加载失败</strong>
      <span>reference 页缺少 source（内置源应用类型/页面）。</span>
    </div>

    <div
      v-else
      class="optimized-suite"
      :class="[shortTypeClass, `application-type-${baseTypeId}`]"
    >
      <div class="template-stage">
        <div class="business-page">
          <ContractPage
            v-if="page && entity"
            :page="page"
            :entity="entity"
            :recipe="recipe"
            :entities="entities"
            :primary="primaryColor"
            @action="onAction"
          />
          <div v-else class="tpl-state error" data-testid="template-preview-error">
            <strong>预览加载失败</strong>
            <span>contract 页缺少 sampleEntity（无法生成样例行/表单）。</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!embed && !loading && !error" class="tpl-badge" data-testid="template-preview-badge">
      <i />
      {{ packName }} · {{ pageKindLabel(pageKind) }} · mock 数据
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * P7-7b-2a 自定义模板预览（`frontend/template-preview.html`，iframe 专用）
 *
 * URL：`?draft=<packId>&page=<pageId>&embed=1` 或 `?pack=<packId>&page=<pageId>&embed=1`
 *
 * - reference：父页展示 `/preview.html?...&structureDraft|Pack=<packId>` iframe；
 * - contract：构造 synthetic design → `adaptDesign` → `ContractPage`，注入 pack 合并后的 structure.css；
 * - 只用于模板预览，不写 PNG；风格类来自内置 registry（自定义 pack 复制的是内置风格）。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ContractPage from '../design-preview/ContractPage.vue'
import { resolveContractRecipe } from '../design-preview/contract-preview.js'
import { adaptDesign } from '../design/design-adapter.js'
import { styles } from '../preview/registry'
import {
  draftDetailUrl,
  findPackPage,
  packPages,
  packStyleId,
  pageKindLabel,
  pageKindOf,
  publishedPackUrl,
  referencePreviewUrl,
  resolveTemplatePreviewParams,
  shortTypeClassFor,
  syntheticDesign,
  structureCssUrl
} from './helpers.js'

const params = resolveTemplatePreviewParams(window.location.search)
const mode = params.mode
const packId = params.packId
const embed = params.embed

const loading = ref(true)
const error = ref('')
const warnings = ref<string[]>([])
const pack = ref<any>(null)
const page = ref<any>(null)
const entity = ref<any>(null)
const entities = ref<any[]>([])
const recipe = ref('detail')
const frameSrc = ref('')
const pageId = ref(params.pageId)
/** 当前渲染的 pack 页面 kind（contract 的渲染页是 synthetic design 页面，不带 kind） */
const pageKind = ref<'reference' | 'contract'>('contract')

const availablePages = computed<any[]>(() => (pack.value ? packPages(pack.value) : []))
const pageName = computed(() => page.value?.name || pageId.value || '')
const packName = computed(() => pack.value?.name || packId || '')
const styleId = computed(() => (pack.value ? packStyleId(pack.value) : ''))
const baseTypeId = computed(() => pack.value?.origin?.baseApplicationType || 'enterprise-application-platform')
const shortTypeClass = computed(() => shortTypeClassFor(baseTypeId.value))
const styleClass = computed(() => {
  const meta = styles.find((item) => item.id === styleId.value)
  return meta?.className || (styleId.value ? `visual-style-${styleId.value}` : '')
})
const styleName = computed(() => styles.find((item) => item.id === styleId.value)?.name || styleId.value || '')
const primaryColor = computed(() => {
  const tokens = styles.find((item) => item.id === styleId.value)?.tokens as Record<string, unknown> | undefined
  const primary = tokens?.primary
  return typeof primary === 'string' && primary.trim() ? primary.trim() : '#145fba'
})

let structureStyleElement: HTMLStyleElement | null = null

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url)
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const message = data && typeof data.error === 'string' ? data.error : `请求失败（HTTP ${res.status}）`
    const failure = new Error(message) as Error & { status?: number }
    failure.status = res.status
    throw failure
  }
  return data
}

async function applyStructureCss(): Promise<void> {
  const url = structureCssUrl(mode, packId)
  if (!url) return
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const css = await res.text()
    if (!css.trim()) throw new Error('结构样式为空')
    if (!structureStyleElement) {
      structureStyleElement = document.createElement('style')
      structureStyleElement.id = 'template-preview-structure-css'
      document.head.appendChild(structureStyleElement)
    }
    structureStyleElement.textContent = css
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    warnings.value = [...warnings.value, `结构样式加载失败（${detail}），预览可能缺少模板结构样式`]
  }
}

function loadContract(selected: any): void {
  const design = syntheticDesign(pack.value, selected)
  const adapted = adaptDesign(design)
  const target = adapted.pages[0] || null
  if (!target) throw new Error('contract 页契约无效（无法构造预览页面）')
  recipe.value = resolveContractRecipe(target)
  page.value = target
  entity.value = adapted.entities.find((item: any) => item.id === target.entityId) || null
  entities.value = adapted.entities
  if (!entity.value && selected?.sampleEntity?.id) {
    warnings.value = [...warnings.value, `样例实体缺失：${selected.sampleEntity.id}`]
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  warnings.value = []
  if (!mode || !packId) {
    error.value = '缺少 draft 或 pack 参数（template-preview.html?draft=<packId>&page=<pageId>）'
    loading.value = false
    return
  }
  if (!params.pageId) {
    error.value = '缺少 page 参数（template-preview.html?draft=<packId>&page=<pageId>）'
    loading.value = false
    return
  }

  try {
    let loadedPack: any = null
    if (mode === 'draft') {
      // 草稿详情：spec/validation/generation + 权威 pack（含 contract/sampleEntity）
      const detail = await fetchJson(draftDetailUrl(packId))
      loadedPack = detail?.pack ?? null
      if (!loadedPack) {
        error.value = '尚未生成预览；先与 AI 确认页面清单，再点“生成预览”。'
        return
      }
    } else {
      const detail = await fetchJson(publishedPackUrl(packId))
      loadedPack = detail?.pack ?? null
      if (!loadedPack) throw new Error('已发布模板数据为空')
    }
    pack.value = loadedPack

    const selected = findPackPage(loadedPack, params.pageId)
    if (!selected) {
      error.value = `模板中找不到页面 ${params.pageId}`
      return
    }
    pageId.value = selected.id

    if (pageKindOf(selected) === 'reference') {
      pageKind.value = 'reference'
      page.value = selected
      frameSrc.value = referencePreviewUrl({
        mode,
        packId,
        page: selected,
        styleId: packStyleId(loadedPack),
        embed
      })
      if (!frameSrc.value) error.value = 'reference 页缺少源页面（source.applicationType/source.pageId）'
    } else {
      pageKind.value = 'contract'
      await applyStructureCss()
      loadContract(selected)
    }
    document.title = [selected.name, packName.value, styleName.value].filter(Boolean).join(' · ')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

/** 模板预览里动作只做轻提示（不写数据、不跨页） */
function onAction(payload: { code: string; label?: string }): void {
  const label = payload?.label || payload?.code || '操作'
  ElMessage.info(`${label}（模板预览）`)
}

onMounted(() => {
  document.getElementById('template-preview-boot')?.remove()
  void load()
})
</script>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
}

body {
  background: var(--template-bg, #eef3fa);
}

.template-preview-root {
  min-height: 100%;
  overflow: auto;
}

.template-preview-root .optimized-suite {
  min-height: 100%;
}

.tpl-frame {
  display: block;
  width: 100%;
  height: 100vh;
  border: 0;
  background: transparent;
}

.tpl-state {
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 60vh;
  padding: 24px;
  color: #64748b;
  font-size: 13px;
  text-align: center;
}

.tpl-state.error {
  align-content: center;
  color: #a02622;
}

.tpl-state.error strong {
  font-size: 14px;
}

.tpl-state.error p {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.tpl-warning {
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 14px;
  color: #8a5a00;
  border-bottom: 1px solid #f0d89b;
  background: #fff8e6;
  font-size: 12px;
  line-height: 1.5;
}

.tpl-badge {
  position: fixed;
  right: 16px;
  bottom: 14px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: min(60vw, 520px);
  padding: 5px 10px;
  color: #40536d;
  border: 1px solid #d7e1f0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 6px 18px rgba(31, 94, 255, 0.12);
  font-size: 11px;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tpl-badge i {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22a06b;
}
</style>
