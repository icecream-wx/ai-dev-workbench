<template>
  <div>
    <!-- Tabs 形态 -->
    <template v-if="isTabs && tabGroups.length">
      <div class="wf-tabs" data-wf-anchor="tabs">
        <span
          v-for="(tab, ti) in tabGroups"
          :key="ti"
          :class="['wf-tab', { on: activeTab === ti }]"
          :data-wf-anchor="`tab:${ti}`"
          @click="activeTab = ti"
        >{{ tabTitle(tab, ti) }}</span>
      </div>
      <div class="wf-form-grid">
        <div v-for="field in tabGroups[activeTab]?.fields ?? []" :key="field.name" class="wf-field" :data-wf-anchor="`field:${field.name}`" :style="{ gridColumn: `span ${fieldSpan(field, layout)}` }">
          <div class="wf-field-label">
            <span v-if="field.required" class="req">*</span>{{ field.label }}
          </div>
          <FieldControl :field="field" :layout="layout" :mobile="mobile" :row="rows?.[0]" />
        </div>
      </div>
    </template>

    <!-- 分组形态 -->
    <template v-else>
      <div v-for="(group, gi) in groups" :key="gi" class="wf-form-section">
        <div v-if="group.title" class="wf-form-section-title" :data-wf-anchor="`group:${gi}`">{{ group.title }}</div>
        <div class="wf-form-grid">
          <div v-for="field in group.fields" :key="field.name" class="wf-field" :data-wf-anchor="`field:${field.name}`" :style="{ gridColumn: `span ${fieldSpan(field, layout)}` }">
            <div class="wf-field-label">
              <span v-if="field.required" class="req">*</span>{{ field.label }}
            </div>
            <FieldControl :field="field" :layout="layout" :mobile="mobile" :row="rows?.[0]" />
          </div>
        </div>
      </div>
    </template>

    <!-- 子表格：按实体一对多关系自动渲染 -->
    <div
      v-for="(st, si) in visibleSubTables"
      :key="st.relationName"
      class="wf-subtable-section"
      :data-wf-anchor="`subtable:${si}`"
    >
      <div class="wf-subtable-head">
        <span class="wf-btn wf-subtable-add" @click="emit('notify', '添加行')">＋ 添加行</span>
        <span class="wf-subtable-title">{{ st.title }}</span>
        <span class="wf-subtable-entity">{{ st.targetEntity.name }}</span>
      </div>
      <!-- 手机：子卡片列表 -->
      <div v-if="mobile" class="wf-m-list">
        <div v-for="(row, ri) in subRows(st)" :key="ri" class="wf-m-card">
          <div class="wf-m-card-avatar small" />
          <div class="wf-m-card-body">
            <div class="wf-m-card-title">
              <span>{{ subTitle(st, row) }}</span>
              <span v-if="enumCol(st)" class="wf-tag">{{ subValue(row, enumCol(st)) }}</span>
            </div>
            <div v-for="meta in st.columns.filter(c => c.type !== 'enum').slice(0, 2)" :key="meta.name" class="wf-m-card-meta">
              <span class="wf-m-card-label">{{ meta.label }}</span>
              <span>{{ subValue(row, meta) }}</span>
            </div>
          </div>
        </div>
      </div>
      <!-- 桌面：内嵌小表格 -->
      <table v-else class="wf-table wf-subtable">
        <thead>
          <tr>
            <th v-for="col in st.columns" :key="col.name">{{ col.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in subRows(st)" :key="ri">
            <td v-for="col in st.columns" :key="col.name">
              <span v-if="col.type === 'enum'" class="wf-tag ok">{{ subValue(row, col) }}</span>
              <template v-else>{{ subValue(row, col) }}</template>
            </td>
          </tr>
          <tr v-if="!st.columns.length"><td class="wf-empty">目标实体暂无字段</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="!groups.length" class="wf-empty">页面未绑定实体或实体暂无字段，先在「实体」页签完善</div>
    <div class="wf-footer" data-wf-anchor="footer">
      <span class="wf-btn" @click="emit('nav', 'back')">取消</span>
      <span v-for="action in submitActions" :key="action" class="wf-btn wf-btn-primary" @click="emit('notify', actionLabel(action))">{{ actionLabel(action) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MockRow } from './mock'
import { displayValue, mockRows } from './mock'
import type { PageLayout, SpecEntity, SpecPage, SpecField } from './spec-types'
import { actionLabel, controlOf, effectiveFields, fieldGroups, fieldSpan, subTableModels } from './layout'
import FieldControl from './FieldControl.vue'

const props = defineProps<{
  page: SpecPage
  entity: SpecEntity | undefined
  layout: PageLayout | undefined
  /** 手机形态：输入组件按移动端样式渲染 */
  mobile?: boolean
  /** 示例数据（手机输入框内展示 Mock 值） */
  rows?: MockRow[]
  /** 当前模块 id（解析子表跨模块关系） */
  moduleId?: string
}>()

const emit = defineEmits<{
  nav: [kind: 'create' | 'detail' | 'back', rowIndex?: number]
  notify: [action: string]
}>()

const groups = computed(() => fieldGroups(effectiveFields(props.page, props.entity, props.layout), props.layout))
const groupMode = computed(() => props.layout?.groupMode ?? 'groups')
const isTabs = computed(() => groupMode.value === 'tabs' && groups.value.length > 0)

const tabGroups = computed(() => groups.value)
const activeTab = ref(0)

function tabTitle(tab: { title: string }, index: number): string {
  return tab.title || (index === 0 ? '基本信息' : `分组 ${index + 1}`)
}

const visibleSubTables = computed(() => subTableModels(props.entity, props.layout, props.moduleId ?? '').filter(st => !st.hidden))

const subRowCache = computed(() => {
  const map = new Map<string, MockRow[]>()
  for (const st of visibleSubTables.value) {
    map.set(st.relationName, mockRows(st.targetEntity, 3))
  }
  return map
})

function subRows(st: { relationName: string }): MockRow[] {
  return subRowCache.value.get(st.relationName) ?? []
}

function subValue(row: MockRow, field: SpecField | undefined): string {
  if (!field) return '-'
  return displayValue(field, row[field.name])
}

function enumCol(st: { columns: SpecField[] }): SpecField | undefined {
  return st.columns.find(c => c.type === 'enum')
}

function subTitle(st: { targetEntity: SpecEntity; columns: SpecField[] }, row: MockRow): string {
  const titleCol = st.columns.find(c => c.type === 'string') ?? st.targetEntity.fields.find(f => f.type === 'string')
  return titleCol ? displayValue(titleCol, row[titleCol.name]) : '记录'
}

const submitActions = computed(() => {
  const actions = (props.page.actions ?? []).filter(a => !['cancel', 'edit', 'delete', 'view', 'detail'].includes(a))
  return actions.length ? actions : ['提交']
})
</script>
<!-- Modified by AI on 2026-09-14 17:59:24 -->
