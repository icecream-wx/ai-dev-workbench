<template>
  <div
    :class="['proto-skin', `skin-${template.category}`, { 'is-capturing': capturing }]"
    :style="skinStyle"
  >
    <div :class="['proto-shell', { 'is-topbar': template.shell.type === 'topbar' }]">
      <aside v-if="template.shell.type === 'sidebar'" :class="['proto-sidebar', { 'is-light': !template.shell.sidebarDark }]">
        <div class="proto-brand">{{ appName }}</div>
        <div
          v-for="set in pageSets"
          :key="set.id"
          :class="['proto-nav-item', { 'is-active': set.id === pageSetId }]"
        >
          <span class="proto-nav-dot" />
          <span>{{ set.title }}</span>
        </div>
      </aside>

      <div class="proto-main">
        <div v-if="template.shell.type === 'topbar'" class="proto-topbar">
          <span class="proto-brand" style="padding: 0; color: #0f172a">{{ appName }}</span>
          <span
            v-for="set in pageSets"
            :key="set.id"
            :class="['proto-nav-item', { 'is-active': set.id === pageSetId }]"
            style="padding: 4px 8px; opacity: 0.8"
          >{{ set.title }}</span>
          <span class="proto-topbar-actions">{{ template.name }}</span>
        </div>
        <div v-else class="proto-topbar">
          <span class="proto-topbar-title">{{ pageSet?.title ?? page.title }}</span>
          <span class="proto-topbar-sub">{{ pageTypeLabel }}</span>
          <span class="proto-topbar-actions">原型 · {{ template.name }}</span>
        </div>

        <div class="proto-canvas-scroll">
          <div ref="paperRef" data-testid="prototype-paper" class="proto-paper" :style="paperStyle">
            <PrototypeRenderer
              v-if="specPage && specEntity"
              :page="specPage"
              :entity="specEntity"
              :layout="specLayout"
              :rows="rows"
              :notes="[]"
              :mobile="false"
              :pages="[]"
              module-id="design"
            />
            <div v-else-if="specPage" class="proto-empty">
              该页面还没有绑定实体，请在右侧页面规格中选择实体后重新渲染。
            </div>
            <div v-else class="proto-empty">选择左侧页面查看原型</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PrototypeRenderer from './prototype/PrototypeRenderer.vue'
import { mockRows, type MockRow } from './prototype/mock'
import type { PageLayout, SpecEntity, SpecField, SpecFieldType, SpecPage } from './prototype/spec-types'
import './prototype/wireframe.css'
import './design-skin.css'
import {
  PAGE_TYPE_LABELS,
  type DesignEntity,
  type DesignPage,
  type DesignPageLayout,
  type DesignPageSet,
  type DesignField,
  type PrototypeTemplate
} from './types'

const props = defineProps<{
  page: DesignPage
  pageSet?: DesignPageSet
  pageSets: DesignPageSet[]
  entities: DesignEntity[]
  template: PrototypeTemplate
  appName: string
  zoom?: number
  capturing?: boolean
}>()

const paperRef = ref<HTMLElement | null>(null)

const pageSetId = computed(() => props.pageSet?.id ?? props.page.pageSetId)
const pageTypeLabel = computed(() => PAGE_TYPE_LABELS[props.page.type] ?? props.page.type)
const entity = computed(() => props.entities.find(item => item.id === props.page.entityId))
const rows = computed<MockRow[]>(() => (entity.value ? mockRows(toSpecEntity(entity.value), 8) : []))

const skinStyle = computed(() => ({
  '--proto-primary': props.template.tokens.primary,
  '--proto-accent': props.template.tokens.accent,
  '--proto-neutral': props.template.tokens.neutral,
  '--proto-bg': props.template.tokens.background,
  '--proto-font': props.template.tokens.font,
  '--proto-radius': `${props.template.tokens.radius}px`,
  '--proto-spacing': `${props.template.tokens.spacing}px`
}))

const paperStyle = computed(() => {
  const width = props.template.shell.contentWidth ?? 1180
  if (props.capturing) {
    return { width: `${width}px` }
  }
  return {
    width: `${width}px`,
    transform: `scale(${(props.zoom ?? 100) / 100})`,
    transformOrigin: 'top left',
    marginRight: `${Math.max(((props.zoom ?? 100) / 100 - 1) * width, 0)}px`,
    marginBottom: `${Math.max(((props.zoom ?? 100) / 100 - 1) * 560, 0)}px`
  }
})

const fieldTypeMap: Record<DesignField['type'], SpecFieldType> = {
  string: 'string',
  text: 'text',
  number: 'number',
  decimal: 'number',
  date: 'date',
  datetime: 'datetime',
  time: 'time',
  boolean: 'boolean',
  enum: 'enum',
  ref: 'ref'
}

function toSpecField(field: DesignField): SpecField {
  return {
    name: field.name,
    label: field.label,
    type: fieldTypeMap[field.type] ?? 'string',
    ...(field.required ? { required: true } : {}),
    ...(field.unique ? { unique: true } : {}),
    ...(field.options?.length ? { options: field.options } : {}),
    ...(field.ref ? { target: field.ref } : {}),
    ...(field.note ? { note: field.note } : {}),
    ...(field.default !== undefined ? { default: field.default } : {})
  }
}

function toSpecEntity(item: DesignEntity): SpecEntity {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    status: 'confirmed',
    fields: item.fields.map(toSpecField)
  }
}

const specEntity = computed(() => (entity.value ? toSpecEntity(entity.value) : undefined))

const specPage = computed<SpecPage | undefined>(() => {
  const page = props.page
  return {
    id: page.id,
    type: page.type,
    title: page.title,
    ...(page.entityId ? { entity: page.entityId } : {}),
    ...(page.spec.fields?.length ? { fields: page.spec.fields } : page.layout.table?.columns?.length ? { fields: page.layout.table.columns } : {}),
    ...(page.spec.actions?.length ? { actions: page.spec.actions } : {}),
    status: 'confirmed',
    ...(page.spec.acceptance?.length ? { acceptanceCriteria: page.spec.acceptance } : {})
  }
})

function toPageLayout(layout: DesignPageLayout): PageLayout {
  return {
    ...(layout.table ? { table: { ...layout.table } } : {}),
    ...(layout.toolbar ? { toolbar: { ...layout.toolbar } } : {}),
    ...(layout.detail ? { detail: { ...layout.detail } } : {}),
    ...(layout.stats?.length ? { stats: layout.stats } : {}),
    ...(layout.charts?.length ? { charts: layout.charts } : {}),
    ...(layout.groupMode ? { groupMode: layout.groupMode } : {})
  }
}

const specLayout = computed(() => toPageLayout(props.page.layout))

defineExpose({ paperRef })
</script>
