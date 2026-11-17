<template>
  <aside :class="['design-outline', { open }]">
    <header class="outline-head">
      <div class="outline-head-title">
        设计大纲
        <span class="outline-count">{{ roots.length }}</span>
      </div>
      <button type="button" class="outline-close" title="关闭设计大纲" aria-label="关闭设计大纲" @click="emit('close')">×</button>
    </header>

    <div class="outline-tools">
      <button type="button" class="outline-tool" title="应用级设计总览" data-testid="outline-overview" @click="emit('overview')">
        设计总览
      </button>
      <button
        type="button"
        class="outline-tool"
        data-testid="outline-template"
        :disabled="templateDisabled"
        :title="templateDisabled ? templateDisabledReason || '正在生成，暂不能切换原型模板' : '应用级原型模板切换'"
        @click="emit('template')"
      >
        原型模板
      </button>
    </div>

    <p v-if="readonlyNote" class="outline-note">{{ readonlyNote }}</p>

    <div class="outline-body" data-testid="outline-tree">
      <div
        v-for="root in roots"
        :key="root.moduleId"
        :class="['outline-module', { on: isCurrent(root) }]"
        :data-module-id="root.moduleId"
        data-testid="outline-module"
      >
        <button type="button" class="module-main" :title="root.title" @click="onModuleClick(root)">
          <span class="caret">{{ isCurrent(root) ? '▾' : '▸' }}</span>
          <span class="module-key">{{ root.moduleKey }}</span>
          <span class="module-title">{{ root.title }}</span>
          <span :class="['module-status', root.status]">{{ moduleStatusLabel(root) }}</span>
          <span class="module-version">{{ moduleVersionLabel(root) }}</span>
          <span v-if="root.required === false" class="module-optional">可选</span>
          <span v-if="root.missingImages" class="module-missing" :title="`${root.missingImages} 个页面缺少原型截图`">
            缺图 {{ root.missingImages }}
          </span>
          <span v-if="inChangeScope(root.moduleId)" class="module-scope">本次变更</span>
          <span v-else-if="hasScope" class="module-out-scope">未包含</span>
        </button>

        <div v-if="isCurrent(root)" class="module-children">
          <div class="module-tools">
            <button
              type="button"
              class="module-generate"
              data-testid="outline-generate-batch"
              :disabled="!canGenerate"
              :title="generateDisabledReason"
              @click="emit('generate-batch')"
            >
              按 Epic 生成
            </button>
          </div>

          <section class="outline-section">
            <button type="button" class="section-head" data-testid="outline-dataset-toggle" @click="datasetOpen = !datasetOpen">
              <span class="caret">{{ datasetOpen ? '▾' : '▸' }}</span>
              数据集
              <span class="section-count">{{ project?.entities.length ?? 0 }}</span>
              <span v-if="selectedEpicId" class="section-reset" @click.stop="emit('clear-epic')">查看全部</span>
            </button>
            <div v-if="datasetOpen" class="entity-list">
              <button
                v-for="entity in project?.entities ?? []"
                :key="entity.id"
                type="button"
                :class="['entity-row', { dim: selectedEpicId && !isEntityRelated(entity.id) }]"
                :data-entity-id="entity.id"
                data-testid="outline-entity"
                :title="entity.name"
                @click="emit('select-entity', entity.id)"
              >
                <span class="entity-name">{{ entity.name || '未命名实体' }}</span>
                <span class="entity-refs">{{ refsLabel(entity.requirementRefs) }}</span>
                <span :class="['entity-status', entity.status]">{{ entity.status === 'confirmed' ? '已确认' : '草稿' }}</span>
              </button>
              <p v-if="!(project?.entities ?? []).length" class="empty">还没有实体；按 Epic 生成或手动新增。</p>
            </div>
          </section>

          <section class="outline-section">
            <div class="section-head static">
              Epics
              <span class="section-count">{{ outline.nodes.length }}</span>
            </div>
            <div v-for="item in outline.nodes" :key="item.node.id" class="epic-group">
              <div :class="['epic-row', { on: selectedEpicId === item.node.id }]" :data-epic-id="item.node.id" data-testid="outline-epic">
                <button type="button" class="epic-main" :title="item.node.title" @click="onEpicClick(item.node.id)">
                  <span class="caret">{{ expandedEpicId === item.node.id ? '▾' : '▸' }}</span>
                  <span class="epic-key">{{ item.node.id }}</span>
                  <span class="epic-title">{{ item.node.title }}</span>
                </button>
                <div class="epic-lines">
                  <span class="epic-meta">页面集 {{ item.pageSetCount }} · 页面 {{ item.pageCount }}</span>
                  <span :class="['epic-coverage', { warn: item.storyTotal > 0 && item.coveredStories < item.storyTotal }]">
                    Story {{ item.coveredStories }}/{{ item.storyTotal }}
                  </span>
                  <span v-if="item.missingImages" class="epic-missing">缺图 {{ item.missingImages }}</span>
                  <span :class="['epic-status', batchStatusOf(item.node.id) || item.status]" data-testid="outline-epic-status">
                    {{ batchStatusOf(item.node.id) ? batchStatusLabel(batchStatusOf(item.node.id)) : epicStatusLabel(item.status) }}
                  </span>
                </div>
                <button
                  type="button"
                  class="epic-generate"
                  data-testid="outline-generate-epic"
                  :disabled="!canGenerate"
                  :title="generateDisabledReason"
                  @click.stop="emit('generate-epic', item.node.id)"
                >
                  生成此 Epic
                </button>
              </div>
              <div v-if="expandedEpicId === item.node.id" class="epic-children">
                <button
                  v-for="set in item.pageSets"
                  :key="set.id"
                  type="button"
                  class="set-row"
                  :data-set-id="set.id"
                  data-testid="outline-page-set"
                  :title="set.title"
                  @click="emit('select-page-set', set.id)"
                >
                  <span class="set-badge">页面集</span>
                  <span class="set-title">{{ set.title }}</span>
                  <span class="set-pages">{{ set.pages.length }} 页</span>
                  <span :class="['set-status', set.status]">{{ set.status === 'confirmed' ? '已确认' : '草稿' }}</span>
                </button>
                <p v-if="!item.pageSets.length" class="empty">还没有页面集；生成此 Epic 会创建。</p>
                <div v-if="item.entities.length" class="related">
                  <span class="related-label">相关实体：</span>
                  <button
                    v-for="entity in item.entities"
                    :key="entity.id"
                    type="button"
                    class="related-item"
                    :data-entity-id="entity.id"
                    data-testid="outline-related-entity"
                    @click="emit('select-entity', entity.id)"
                  >
                    {{ entity.name }}
                  </button>
                </div>
              </div>
            </div>
            <p v-if="!outline.nodes.length" class="empty">
              设计输入里还没有 Epic / 场景；请先在需求阶段补充 Epics &amp; Stories，或同步需求输入。
            </p>
          </section>

          <section v-if="outline.unassignedPageSets.length || outline.unassignedEntities.length" class="outline-section">
            <div class="section-head static">未归属 Epic / 场景</div>
            <button
              v-for="set in outline.unassignedPageSets"
              :key="set.id"
              type="button"
              class="set-row"
              :data-set-id="set.id"
              data-testid="outline-unassigned-page-set"
              @click="emit('select-page-set', set.id)"
            >
              <span class="set-badge">页面集</span>
              <span class="set-title">{{ set.title }}</span>
              <span class="set-pages">{{ set.pages.length }} 页</span>
            </button>
            <button
              v-for="entity in outline.unassignedEntities"
              :key="entity.id"
              type="button"
              class="entity-row"
              :data-entity-id="entity.id"
              data-testid="outline-unassigned-entity"
              @click="emit('select-entity', entity.id)"
            >
              <span class="entity-name">{{ entity.name }}</span>
              <span class="entity-refs">无需求依据</span>
              <span :class="['entity-status', entity.status]">{{ entity.status === 'confirmed' ? '已确认' : '草稿' }}</span>
            </button>
          </section>
        </div>
      </div>

      <p v-if="!roots.length" class="empty">还没有未归档模块；请先在需求阶段创建并完成需求。</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DesignModuleSummary } from '../workbench/api'
import type { DesignEntity, DesignPageSet, DesignProjectPayload } from './types'
import { designModuleStatusLabel, designModuleVersionLabel } from './design-module-helpers.js'
import {
  epicBatchStatusLabel,
  epicOutlineOf,
  epicStatusLabel,
  epicMatchesEntity
} from './design-epic-helpers.js'

interface OutlineNode {
  node: { id: string; title: string; storyIds: string[]; isScene: boolean; goal: string }
  entities: DesignEntity[]
  pageSets: DesignPageSet[]
  pageSetCount: number
  pageCount: number
  missingImages: number
  storyTotal: number
  coveredStories: number
  status: string
  needsWork: boolean
}

interface BatchItem {
  epicId: string
  status: string
}

const props = defineProps<{
  modules: DesignModuleSummary[]
  project: DesignProjectPayload | null
  selectedEpicId?: string
  readonly?: boolean
  changeScopeIds?: string[]
  /** 生成中/只读等（父级统一判断） */
  canGenerate?: boolean
  generateDisabledReason?: string
  /** MF-DRMP-2：生成中禁用原型模板入口 */
  templateDisabled?: boolean
  templateDisabledReason?: string
  batch?: BatchItem[]
  /** 窄屏抽屉开关 */
  open?: boolean
}>()

const emit = defineEmits<{
  'select-module': [string]
  'select-epic': [string]
  'clear-epic': []
  'select-entity': [string]
  'select-page-set': [string]
  'generate-epic': [string]
  'generate-batch': []
  overview: []
  template: []
  close: []
}>()

const datasetOpen = ref(true)
const expandedEpicId = ref('')
const currentModuleId = computed(() => props.project?.module.id ?? '')

const roots = computed<DesignModuleSummary[]>(() => {
  const list = [...(props.modules ?? [])]
  if (props.project && !list.some(module => module.moduleId === props.project?.module.id)) {
    list.push({
      moduleId: props.project.module.id,
      moduleKey: props.project.module.key,
      title: props.project.module.title,
      required: true,
      position: list.length,
      status: props.project.status,
      version: props.project.version,
      entityCount: props.project.entities.length,
      pageSetCount: props.project.pageSets.length,
      pageCount: props.project.pageSets.reduce((sum, set) => sum + set.pages.length, 0),
      missingImages: props.project.pageSets.reduce(
        (sum, set) => sum + set.pages.filter(page => !page.imagePath).length,
        0
      ),
      confirmedAt: props.project.confirmedAt
    })
  }
  return list
})

const outline = computed<{ nodes: OutlineNode[]; unassignedPageSets: DesignPageSet[]; unassignedEntities: DesignEntity[] }>(() => {
  if (!props.project) return { nodes: [], unassignedPageSets: [], unassignedEntities: [] }
  return epicOutlineOf(props.project) as unknown as {
    nodes: OutlineNode[]
    unassignedPageSets: DesignPageSet[]
    unassignedEntities: DesignEntity[]
  }
})

const hasScope = computed(() => Array.isArray(props.changeScopeIds) && props.changeScopeIds.length > 0)
const readonlyNote = computed(() => (props.readonly ? '应用已进入开发/完成阶段，设计只读' : ''))

const relatedNode = computed(() => outline.value.nodes.find(item => item.node.id === props.selectedEpicId) ?? null)

watch(
  () => props.selectedEpicId,
  id => {
    if (id) expandedEpicId.value = id
  },
  { immediate: true }
)

watch(
  () => props.project?.module.id,
  () => {
    expandedEpicId.value = props.selectedEpicId ?? ''
    datasetOpen.value = true
  }
)

function isCurrent(module: DesignModuleSummary): boolean {
  return module.moduleId === currentModuleId.value
}

function inChangeScope(moduleId: string): boolean {
  return Boolean(props.changeScopeIds && props.changeScopeIds.includes(moduleId))
}

function moduleStatusLabel(module: DesignModuleSummary): string {
  return designModuleStatusLabel(module)
}

function moduleVersionLabel(module: DesignModuleSummary): string {
  return designModuleVersionLabel(module)
}

function batchStatusOf(epicId: string): string {
  return (props.batch ?? []).find(item => item.epicId === epicId)?.status ?? ''
}

function batchStatusLabel(status: string): string {
  return epicBatchStatusLabel(status)
}

function isEntityRelated(entityId: string): boolean {
  const item = relatedNode.value
  if (!item) return true
  const entity = props.project?.entities.find(candidate => candidate.id === entityId)
  return entity ? epicMatchesEntity(entity, item.node) : true
}

function refsLabel(refs: string[]): string {
  const list = Array.isArray(refs) ? refs : []
  if (!list.length) return '无需求依据'
  return list.length > 3 ? `${list.slice(0, 3).join(', ')} 等 ${list.length} 个` : list.join(', ')
}

function onModuleClick(module: DesignModuleSummary): void {
  if (isCurrent(module)) return
  emit('select-module', module.moduleId)
}

function onEpicClick(epicId: string): void {
  expandedEpicId.value = expandedEpicId.value === epicId ? '' : epicId
  emit('select-epic', epicId)
}
</script>

<style scoped>
.design-outline {
  width: 260px;
  flex-shrink: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  color: var(--rg-text);
  position: relative;
}
.outline-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 6px;
}
.outline-head-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--rg-text-2);
}
.outline-count {
  font-size: 10.5px;
  font-weight: 400;
  color: var(--rg-text-3);
  background: var(--rg-fill);
  border-radius: 999px;
  padding: 0 6px;
}
.outline-close {
  display: none;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 7px;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}
.outline-close:hover {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.outline-tools {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  padding: 0 10px 8px;
}
.outline-tool {
  flex: 1;
  min-height: 26px;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 7px;
  font-size: 10.5px;
  cursor: pointer;
}
.outline-tool:hover {
  border-color: var(--rg-text-3);
  color: var(--rg-text);
  background: var(--rg-hover);
}
.outline-tool:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.outline-note {
  margin: 0 10px 6px;
  font-size: 10px;
  line-height: 1.5;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border-radius: 6px;
  padding: 4px 7px;
}
.outline-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.outline-module {
  border: 1px solid transparent;
  border-radius: 9px;
  background: var(--rg-surface);
}
.outline-module:hover {
  border-color: var(--rg-border);
}
.outline-module.on {
  border-color: var(--rg-ai-border);
}
.module-main {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  border-radius: 9px;
  padding: 7px 8px;
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.module-main:hover {
  background: var(--rg-hover);
}
.caret {
  font-size: 9px;
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.module-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 9.5px;
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.module-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rg-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}
.module-status,
.module-version,
.module-optional,
.module-scope,
.module-out-scope,
.module-missing {
  font-size: 9px;
  border-radius: 999px;
  padding: 0 5px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
  flex-shrink: 0;
}
.module-status.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.module-version {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.module-scope {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.module-out-scope,
.module-missing {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.module-children {
  border-top: 1px solid var(--rg-border);
  padding: 6px 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.module-tools {
  display: flex;
  gap: 4px;
}
.module-generate {
  flex: 1;
  min-height: 25px;
  border: 1px solid var(--rg-ai-border);
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
  border-radius: 7px;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
}
.module-generate:hover:not(:disabled) {
  border-color: var(--rg-ai);
}
.module-generate:disabled,
.epic-generate:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.outline-section {
  border-radius: 8px;
}
.section-head {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--rg-text-2);
  font-size: 10.5px;
  font-weight: 600;
  padding: 4px 6px;
  cursor: pointer;
  font-family: inherit;
}
.section-head.static {
  cursor: default;
}
.section-count {
  font-size: 9.5px;
  font-weight: 400;
  color: var(--rg-text-3);
  background: var(--rg-fill);
  border-radius: 999px;
  padding: 0 5px;
}
.section-reset {
  margin-left: auto;
  font-size: 9.5px;
  font-weight: 400;
  color: var(--rg-ai);
  cursor: pointer;
}
.entity-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-bottom: 2px;
}
.entity-row {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 4px 7px;
  cursor: pointer;
  color: inherit;
  font: inherit;
  min-width: 0;
}
.entity-row:hover {
  background: var(--rg-hover);
}
.entity-row.dim {
  opacity: 0.5;
}
.entity-name {
  font-size: 11.5px;
  color: var(--rg-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}
.entity-refs {
  font-size: 9px;
  color: var(--rg-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 96px;
  flex-shrink: 0;
}
.entity-status,
.set-status {
  font-size: 9px;
  border-radius: 999px;
  padding: 0 5px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
  flex-shrink: 0;
}
.entity-status.confirmed,
.set-status.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.epic-group {
  border-radius: 8px;
}
.epic-row {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 4px 6px;
}
.epic-row:hover {
  background: var(--rg-hover);
}
.epic-row.on {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
}
.epic-main {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 1px 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  min-width: 0;
}
.epic-key {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 9px;
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.epic-title {
  font-size: 11.5px;
  color: var(--rg-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.epic-lines {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding-left: 14px;
  font-size: 9.5px;
  color: var(--rg-text-3);
}
.epic-coverage.warn {
  color: var(--rg-warn);
}
.epic-missing {
  color: var(--rg-warn);
}
.epic-status {
  border-radius: 999px;
  padding: 0 5px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.epic-status.confirmed,
.epic-status.success {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.epic-status.running {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.epic-status.failed {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.epic-status.stale {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.epic-generate {
  margin: 3px 0 0 14px;
  min-height: 22px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 6px;
  font-size: 9.5px;
  padding: 0 7px;
  cursor: pointer;
}
.epic-generate:hover:not(:disabled) {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.epic-children {
  padding: 2px 0 4px 14px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.set-row {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 3px 6px;
  cursor: pointer;
  color: inherit;
  font: inherit;
  min-width: 0;
}
.set-row:hover {
  background: var(--rg-hover);
}
.set-badge {
  font-size: 8.5px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 4px;
  padding: 0 4px;
  flex-shrink: 0;
}
.set-title {
  font-size: 10.5px;
  color: var(--rg-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.set-pages {
  font-size: 9px;
  color: var(--rg-text-3);
  flex-shrink: 0;
}
.related {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  padding: 3px 6px;
}
.related-label {
  font-size: 9.5px;
  color: var(--rg-text-3);
}
.related-item {
  border: 1px dashed var(--rg-border-strong);
  background: transparent;
  color: var(--rg-text-2);
  border-radius: 999px;
  font-size: 9.5px;
  padding: 1px 7px;
  cursor: pointer;
}
.related-item:hover {
  border-color: var(--rg-ai-border);
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
}
.empty {
  margin: 4px 6px 8px;
  font-size: 10px;
  color: var(--rg-text-3);
  line-height: 1.6;
}

@media (max-width: 1280px) {
  .design-outline {
    width: 220px;
  }
}
@media (max-width: 1024px) {
  .design-outline {
    display: none;
  }
  .design-outline.open {
    display: flex;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(300px, calc(100vw - 48px));
    z-index: 41;
    box-shadow: var(--rg-shadow-2);
    border-right: 1px solid var(--rg-border);
    background: var(--rg-surface-2);
  }
  .outline-close {
    display: inline-flex;
  }
}
@media (max-width: 768px) {
  .design-outline.open {
    width: calc(100vw - 24px);
  }
}
</style>
