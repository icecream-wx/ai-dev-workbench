<template>
  <div :class="['entity-tab', { readonly }]">
    <header class="tab-head">
      <div class="tab-title">
        <h2>实体设计</h2>
        <span class="tab-sub">应用级共享实体 · {{ entities.length }} 个 · 已确认 {{ confirmedCount }}</span>
        <span :class="['save-chip', saveState]">{{ saveLabel }}</span>
        <span v-if="focusEpicId" class="filter-chip" data-testid="entity-epic-filter">
          当前 Epic：{{ focusEpicId }} {{ focusEpicTitle }} · 仅显示相关实体
          <button type="button" class="filter-clear" data-testid="entity-epic-filter-clear" @click="emit('clear-epic-filter')">清除</button>
        </span>
      </div>
      <div class="tab-actions">
        <button
          type="button"
          class="pane-toggle"
          title="打开实体列表"
          aria-label="打开实体列表"
          @click="listOpen = true"
        >
          实体（{{ entities.length }}）
        </button>
        <div class="mode-tabs">
          <button type="button" :class="['mode-tab', { on: mode === 'fields' }]" @click="mode = 'fields'">字段编辑</button>
          <button type="button" :class="['mode-tab', { on: mode === 'er' }]" @click="mode = 'er'">ER 关系图</button>
        </div>
        <div class="more-wrap">
          <button type="button" class="btn" data-testid="entity-more" :disabled="busy || readonly" @click="moreOpen = !moreOpen">更多 ▾</button>
          <div v-if="moreOpen" class="menu-mask" @click="moreOpen = false" />
          <div v-if="moreOpen" class="more-menu">
            <button
              type="button"
              class="menu-item"
              data-testid="entity-generate-module"
              :disabled="busy || readonly"
              title="整模块 AI 生成（兜底；会按整模块需求重新生成实体）"
              @click="moreOpen = false; onGenerate()"
            >
              整模块生成实体（兜底）
            </button>
          </div>
        </div>
        <button type="button" class="btn" :disabled="busy || readonly" @click="addEntity">新增实体</button>
        <button type="button" class="btn" :disabled="busy || readonly || !dirty" @click="saveNow()">保存</button>
        <button type="button" class="btn primary" :disabled="busy || readonly || !entities.length" @click="confirmAll">确认全部实体</button>
      </div>
    </header>

    <div v-if="readonly" class="readonly-banner">设计已确认，当前为只读；点击顶部「重新编辑设计」后才能修改实体。</div>

    <div class="entity-body">
      <div v-if="listOpen" class="pane-mask" @click="listOpen = false" />
      <aside :class="['entity-list', { open: listOpen }]">
        <button type="button" class="pane-close" title="关闭实体列表" aria-label="关闭实体列表" @click="listOpen = false">×</button>
        <button
          v-for="entity in visibleEntities"
          :key="entity.id"
          type="button"
          :class="['entity-item', { on: entity.id === selectedId, draft: entity.status !== 'confirmed' }]"
          :data-entity-id="entity.id"
          @click="selectEntity(entity.id)"
        >
          <span class="entity-item-name">{{ entity.name || '未命名实体' }}</span>
          <span class="entity-item-meta">{{ entity.fields.length }} 字段 · {{ entity.status === 'confirmed' ? '已确认' : '草稿' }}</span>
        </button>
        <p v-if="!visibleEntities.length" class="entity-empty">
          {{ focusEpicId ? '该 Epic 还没有相关实体；可在设计大纲点「生成此 Epic」。' : '还没有实体。点击「新增实体」或「更多 → 整模块生成实体（兜底）」。' }}
        </p>
      </aside>

      <section v-if="mode === 'er'" class="entity-main">
        <ErGraph :entities="visibleEntities" :selected-id="selectedId" @select="selectEntity" />
        <div class="er-tip">ER 图根据实体的关系自动生成；关系可在字段编辑的「实体关系」中维护。</div>
      </section>

      <section v-else-if="selected" class="entity-main">
        <div class="entity-head">
          <label class="field">
            <span>实体名称</span>
            <el-input v-model="selected.name" size="small" placeholder="如：订单" @input="markDirty" />
          </label>
          <label class="field">
            <span>表名（可选）</span>
            <el-input v-model="selected.tableName" size="small" placeholder="如：biz_order" @input="markDirty" />
          </label>
          <label class="field wide">
            <span>描述</span>
            <el-input v-model="selected.description" size="small" placeholder="一句话说明这个实体" @input="markDirty" />
          </label>
          <div class="entity-head-actions">
            <span :class="['status-chip', selected.status]">{{ selected.status === 'confirmed' ? '已确认' : '草稿' }}</span>
            <button type="button" class="btn" :disabled="busy" @click="toggleEntityConfirm">
              {{ selected.status === 'confirmed' ? '取消确认' : '确认实体' }}
            </button>
            <button type="button" class="btn danger" :disabled="busy || entities.length <= 1" @click="removeEntity">删除实体</button>
          </div>
        </div>

        <div class="refs-row">
          <span class="refs-label">需求依据</span>
          <el-select
            v-model="selected.requirementRefs"
            multiple
            filterable
            collapse-tags
            size="small"
            class="refs-select"
            :disabled="readonly"
            placeholder="选择 Story/Epic（覆盖度用）"
            @change="markDirty"
          >
            <el-option v-for="option in refOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <span v-if="!selected.requirementRefs.length" class="refs-hint">无需求依据（覆盖度会提示，不影响保存）</span>
          <span v-if="selected.sourceSections.length" class="refs-sections">来源章节：{{ selected.sourceSections.join('、') }}</span>
        </div>

        <div class="section-head">
          <strong>字段（{{ selected.fields.length }}）</strong>
          <button type="button" class="btn small" @click="addField">新增字段</button>
        </div>
        <div class="table-wrap">
          <table class="edit-table">
            <thead>
              <tr>
                <th style="width: 132px">字段名</th>
                <th style="width: 120px">显示名</th>
                <th style="width: 92px">类型</th>
                <th style="width: 48px">必填</th>
                <th style="width: 48px">唯一</th>
                <th style="width: 150px">选项 / 引用</th>
                <th style="width: 120px">长度/精度</th>
                <th>备注</th>
                <th style="width: 40px" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(field, index) in selected.fields" :key="`${field.name}-${index}`">
                <td><el-input v-model="field.name" size="small" placeholder="orderNo" @input="markDirty" /></td>
                <td><el-input v-model="field.label" size="small" placeholder="订单号" @input="markDirty" /></td>
                <td>
                  <el-select v-model="field.type" size="small" @change="onFieldTypeChange(field)">
                    <el-option v-for="(label, value) in FIELD_TYPE_LABELS" :key="value" :label="label" :value="value" />
                  </el-select>
                </td>
                <td class="center"><el-checkbox v-model="field.required" size="small" @change="markDirty" /></td>
                <td class="center"><el-checkbox v-model="field.unique" size="small" @change="markDirty" /></td>
                <td>
                  <el-input
                    v-if="field.type === 'enum'"
                    :model-value="(field.options ?? []).join(', ')"
                    size="small"
                    placeholder="选项用逗号分隔"
                    @input="value => setOptions(field, value)"
                  />
                  <el-select
                    v-else-if="field.type === 'ref'"
                    v-model="field.ref"
                    size="small"
                    clearable
                    placeholder="引用实体"
                    @change="markDirty"
                  >
                    <el-option
                      v-for="item in entities.filter(e => e.id !== selected?.id)"
                      :key="item.id"
                      :label="item.name"
                      :value="item.id"
                    />
                  </el-select>
                  <span v-else class="muted">—</span>
                </td>
                <td>
                  <div class="length-cell">
                    <el-input
                      v-if="field.type === 'string'"
                      :model-value="field.length ? String(field.length) : ''"
                      size="small"
                      placeholder="长度"
                      @input="value => setLength(field, value)"
                    />
                    <el-input
                      v-else-if="field.type === 'decimal'"
                      :model-value="field.precision !== undefined ? String(field.precision) : ''"
                      size="small"
                      placeholder="精度"
                      @input="value => setPrecision(field, value)"
                    />
                    <span v-else class="muted">—</span>
                  </div>
                </td>
                <td><el-input v-model="field.note" size="small" placeholder="校验/说明" @input="markDirty" /></td>
                <td class="center">
                  <button type="button" class="icon-btn" title="删除字段" @click="removeField(index)">×</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section-head">
          <strong>实体关系（{{ selected.relations.length }}）</strong>
          <button type="button" class="btn small" @click="addRelation">新增关系</button>
        </div>
        <div class="relation-list">
          <div v-for="(relation, index) in selected.relations" :key="index" class="relation-row">
            <el-input v-model="relation.name" size="small" placeholder="关系名，如：订单明细" @input="markDirty" />
            <el-select v-model="relation.type" size="small" @change="markDirty">
              <el-option v-for="(label, value) in RELATION_TYPE_LABELS" :key="value" :label="`${label} ${value}`" :value="value" />
            </el-select>
            <el-select v-model="relation.target" size="small" placeholder="目标实体" @change="markDirty">
              <el-option
                v-for="item in entities.filter(e => e.id !== selected?.id)"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
              <el-option-group v-for="group in otherGroups" :key="group.key" :label="group.label">
                <el-option v-for="option in group.options" :key="option.value" :label="option.label" :value="option.value" />
              </el-option-group>
            </el-select>
            <button type="button" class="icon-btn" title="删除关系" @click="selected?.relations.splice(index, 1); markDirty()">×</button>
          </div>
          <p v-if="selected.relations.some(relation => isCrossModuleEntityId(props.project.otherModuleEntities, relation.target))" class="relation-cross">
            关系引用了其它模块实体（跨模块依赖）：可以保存与确认，交接包阶段会统一提示。
          </p>
          <p v-if="!selected.relations.length" class="muted">暂无关系；跨实体引用可在字段类型选「引用」。</p>
        </div>
      </section>

      <section v-else class="entity-main entity-main-empty">
        {{ focusEpicId ? '该 Epic 还没有可编辑的实体；先在设计大纲点「生成此 Epic」。' : '选择左侧实体查看字段；或新增一个实体。' }}
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ErGraph from './ErGraph.vue'
import {
  DesignApiError,
  generateDesignEntities,
  saveDesignEntities
} from './api'
import {
  FIELD_TYPE_LABELS,
  RELATION_TYPE_LABELS,
  type DesignEntity,
  type DesignField,
  type DesignProjectPayload
} from './types'
import { isCrossModuleEntityId, otherModuleEntityGroups } from './design-module-helpers.js'

const props = defineProps<{
  project: DesignProjectPayload
  readonly?: boolean
  /** D-RMP：按 Epic 过滤显示（只影响列表/ER；保存始终使用完整实体列表） */
  focusEpicId?: string
  focusEpicTitle?: string
  focusEpicRefs?: string[]
  /** MF-DRMP-5：被本 Epic 页面绑定（但 requirementRefs 未命中）的相关实体 id */
  focusEpicEntityIds?: string[]
}>()
const emit = defineEmits<{
  update: [DesignProjectPayload]
  'focus-change': [{ kind: 'entity'; id: string } | null]
  'clear-epic-filter': []
}>()

const mode = ref<'fields' | 'er'>('fields')
const selectedId = ref('')
// 窄屏（≤768）实体列表抽屉
const listOpen = ref(false)
// “更多”菜单（整模块生成兜底，默认不展示）
const moreOpen = ref(false)
const draft = ref<DesignEntity[]>([])
const dirty = ref(false)
const busy = ref(false)
const saveState = ref<'saved' | 'dirty' | 'saving' | 'error'>('saved')
let saveTimer: ReturnType<typeof setTimeout> | null = null
let syncing = false
// D-RMP：过滤/同步导致的被动选中不应覆盖 Epic 对话焦点（只有用户点击才 emit focus-change）
let autoSelecting = false

const entities = computed(() => draft.value)
/** 过滤只影响显示；draft 始终是完整实体列表（绝不能把过滤后的列表保存） */
const visibleEntities = computed(() => {
  if (!props.focusEpicId) return draft.value
  const refs = new Set(props.focusEpicRefs ?? [props.focusEpicId])
  refs.add(props.focusEpicId)
  const bound = new Set(props.focusEpicEntityIds ?? [])
  return draft.value.filter(
    entity => (entity.requirementRefs ?? []).some(ref => refs.has(ref)) || bound.has(entity.id)
  )
})
const confirmedCount = computed(() => entities.value.filter(entity => entity.status === 'confirmed').length)
const selected = computed(() => entities.value.find(entity => entity.id === selectedId.value))
const refOptions = computed(() => {
  const input = props.project.input
  if (!input) return []
  const options: Array<{ value: string; label: string }> = []
  for (const story of input.stories) {
    options.push({ value: story.id, label: `${story.id} · ${story.title}` })
  }
  for (const epic of input.epics) {
    options.push({ value: epic.id, label: `${epic.id} · ${epic.title}（Epic）` })
  }
  for (const scene of input.scenes) {
    options.push({ value: scene.id, label: `${scene.id} · ${scene.title}（场景）` })
  }
  return options
})
const saveLabel = computed(() => {
  if (busy.value || saveState.value === 'saving') return '保存中…'
  if (saveState.value === 'error') return '保存失败'
  return dirty.value ? '未保存' : '已保存'
})
/** M4：其它模块实体（只读；跨模块关系目标） */
const otherGroups = computed(() => otherModuleEntityGroups(props.project.otherModuleEntities))

function cloneEntities(list: DesignEntity[]): DesignEntity[] {
  return JSON.parse(JSON.stringify(list)) as DesignEntity[]
}

function syncFromProject(): void {
  syncing = true
  draft.value = cloneEntities(props.project.entities)
  const visible = visibleEntities.value
  if (!visible.some(entity => entity.id === selectedId.value)) {
    autoSelecting = true
    selectedId.value = visible[0]?.id ?? ''
    autoSelecting = false
  }
  dirty.value = false
  saveState.value = 'saved'
  syncing = false
}

// D-RMP：切换 Epic 过滤时把选中项收窄到可见列表（只影响显示与选中，不改数据）
watch(
  () => [
    props.focusEpicId ?? '',
    (props.focusEpicRefs ?? []).join(','),
    (props.focusEpicEntityIds ?? []).join(',')
  ],
  () => {
    const visible = visibleEntities.value
    if (!visible.some(entity => entity.id === selectedId.value)) {
      autoSelecting = true
      selectedId.value = visible[0]?.id ?? ''
      autoSelecting = false
    }
  }
)

watch(
  () => props.project.version,
  () => {
    if (!dirty.value) syncFromProject()
  },
  { immediate: true }
)

watch(
  () => selectedId.value,
  id => {
    if (autoSelecting) return
    emit('focus-change', id ? { kind: 'entity', id } : null)
  }
)

function markDirty(): void {
  if (props.readonly) return
  if (syncing) return
  dirty.value = true
  saveState.value = 'dirty'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (dirty.value && !busy.value) void saveNow(true)
  }, 900)
}

function selectEntity(id: string): void {
  selectedId.value = id
  listOpen.value = false
}

function nextPosition(): number {
  return draft.value.length
}

function addEntity(): void {
  if (props.readonly) return
  const id = `ent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  draft.value.push({
    id,
    name: `新实体${draft.value.length + 1}`,
    tableName: '',
    description: '',
    fields: [
      { name: 'id', label: '主键ID', type: 'string', required: true, unique: true },
      { name: 'name', label: '名称', type: 'string', required: true },
      { name: 'createdAt', label: '创建时间', type: 'datetime' }
    ],
    relations: [],
    requirementRefs: [],
    sourceSections: [],
    status: 'draft',
    position: nextPosition(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
  selectedId.value = id
  mode.value = 'fields'
  markDirty()
}

function removeEntity(): void {
  if (props.readonly || !selected.value) return
  void ElMessageBox.confirm(`删除实体「${selected.value.name}」？引用它的字段/关系需要后续修正。`, '删除实体', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  })
    .then(() => {
      draft.value = draft.value.filter(entity => entity.id !== selectedId.value)
      selectedId.value = draft.value[0]?.id ?? ''
      markDirty()
    })
    .catch(() => undefined)
}

function addField(): void {
  if (props.readonly || !selected.value) return
  selected.value.fields.push({
    name: `field${selected.value.fields.length + 1}`,
    label: `字段${selected.value.fields.length + 1}`,
    type: 'string'
  })
  markDirty()
}

function removeField(index: number): void {
  if (props.readonly) return
  selected.value?.fields.splice(index, 1)
  markDirty()
}

function onFieldTypeChange(field: DesignField): void {
  if (field.type === 'enum' && !field.options?.length) field.options = ['选项一', '选项二']
  if (field.type !== 'enum') delete field.options
  if (field.type !== 'ref') delete field.ref
  markDirty()
}

function setOptions(field: DesignField, value: string): void {
  field.options = String(value)
    .split(/[,，、]/)
    .map(item => item.trim())
    .filter(Boolean)
  markDirty()
}

function setLength(field: DesignField, value: string): void {
  const number = Number(value)
  if (Number.isFinite(number) && number > 0) field.length = Math.round(number)
  else delete field.length
  markDirty()
}

function setPrecision(field: DesignField, value: string): void {
  const number = Number(value)
  if (Number.isFinite(number) && number >= 0 && value !== '') field.precision = Math.round(number)
  else delete field.precision
  markDirty()
}

function addRelation(): void {
  if (props.readonly || !selected.value) return
  // M4：当前模块优先；只有跨模块实体时也允许建立跨模块关系（保存给 warning，不阻塞）
  const local = entities.value.find(entity => entity.id !== selected.value?.id)
  const cross = props.project.otherModuleEntities.find(entity => entity.id !== selected.value?.id)
  const target = local ?? cross
  if (!target) {
    ElMessage.warning('至少需要两个实体（或其它模块实体）才能建立关系')
    return
  }
  selected.value.relations.push({ name: `${selected.value.name}-${target.name}`, type: 'many-to-one', target: target.id })
  markDirty()
}

async function flushSave(): Promise<void> {
  if (props.readonly) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  // 等正在进行的保存结束，确保生成前拿到最新落盘；超时则让调用方取消生成
  const startedAt = Date.now()
  while (busy.value) {
    if (Date.now() - startedAt > 5000) throw new Error('实体保存仍在进行，请稍后重试')
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  if (dirty.value) await saveNow(true, true)
}

async function saveNow(silent = false, throwOnError = false): Promise<void> {
  if (props.readonly || busy.value) return
  busy.value = true
  saveState.value = 'saving'
  try {
    const project = await saveDesignEntities(props.project.appId, draft.value, 'manual', {}, props.project.module.id)
    dirty.value = false
    saveState.value = 'saved'
    emit('update', project)
    if (!silent) ElMessage.success('实体设计已保存')
  } catch (error) {
    saveState.value = 'error'
    showError(error)
    if (throwOnError) throw error
  } finally {
    busy.value = false
  }
}

async function onGenerate(): Promise<void> {
  if (props.readonly) return
  try {
    await ElMessageBox.confirm(
      'AI 会读取已确认需求文档并生成完整实体初稿（会覆盖/补齐当前实体）。确认继续？',
      'AI 生成实体',
      { type: 'warning', confirmButtonText: '生成', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await flushSave()
  } catch (error) {
    showError(error)
    return
  }
  busy.value = true
  try {
    const result = await generateDesignEntities(props.project.appId, props.project.module.id)
    emit('update', result.project)
    ElMessage.success(`已生成 ${result.project.entities.length} 个实体`)
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}

async function toggleEntityConfirm(): Promise<void> {
  if (props.readonly || !selected.value) return
  const next = selected.value.status === 'confirmed' ? 'draft' : 'confirmed'
  const name = selected.value.name
  selected.value.status = next
  busy.value = true
  try {
    const project = await saveDesignEntities(props.project.appId, draft.value, 'manual', {}, props.project.module.id)
    dirty.value = false
    saveState.value = 'saved'
    emit('update', project)
    ElMessage.success(next === 'confirmed' ? `实体「${name}」已确认` : `实体「${name}」已取消确认`)
  } catch (error) {
    selected.value.status = next === 'confirmed' ? 'draft' : 'confirmed'
    showError(error)
  } finally {
    busy.value = false
  }
}

async function confirmAll(): Promise<void> {
  if (props.readonly) return
  draft.value = draft.value.map(entity => ({ ...entity, status: 'confirmed' }))
  busy.value = true
  try {
    const project = await saveDesignEntities(props.project.appId, draft.value, 'manual', {}, props.project.module.id)
    dirty.value = false
    saveState.value = 'saved'
    emit('update', project)
    ElMessage.success('全部实体已确认')
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}

function showError(error: unknown): void {
  if (error instanceof DesignApiError) {
    if (error.issues.length) {
      void ElMessageBox.alert(error.issues.map(line => `• ${line}`).join('\n'), error.message, {
        type: 'warning',
        confirmButtonText: '知道了'
      })
      return
    }
    ElMessage.error(error.message)
    return
  }
  ElMessage.error(error instanceof Error ? error.message : String(error))
}

defineExpose({ flushSave, selectEntity })
</script>

<style scoped>
.entity-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
  background: var(--rg-bg);
  color: var(--rg-text);
}
.readonly-banner {
  flex-shrink: 0;
  margin: 10px 14px 0;
  border: 1px solid var(--rg-warn-border);
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
  border-radius: 8px;
  padding: 7px 11px;
  font-size: 11.5px;
}
.entity-tab.readonly .entity-head,
.entity-tab.readonly .table-wrap,
.entity-tab.readonly .relation-list,
.entity-tab.readonly .section-head .btn {
  pointer-events: none;
  opacity: 0.86;
}
.tab-head {
  flex-shrink: 0;
  min-height: 52px;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--rg-surface);
  border-bottom: 1px solid var(--rg-border);
  flex-wrap: wrap;
}
.tab-title,
.tab-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tab-title h2 {
  margin: 0;
  font-size: 14px;
  color: var(--rg-text);
}
.tab-sub {
  font-size: 11px;
  color: var(--rg-text-3);
}
.save-chip {
  font-size: 10.5px;
  color: var(--rg-text-3);
  background: var(--rg-fill);
  border-radius: 999px;
  padding: 2px 8px;
}
.save-chip.dirty {
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
}
.save-chip.saving {
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
}
.save-chip.error {
  color: var(--rg-danger);
  background: var(--rg-danger-soft);
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border-radius: 999px;
  padding: 2px 4px 2px 9px;
  max-width: 100%;
}
.filter-clear {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 10.5px;
  text-decoration: underline;
  cursor: pointer;
  padding: 0 4px;
}
.more-wrap {
  position: relative;
}
.menu-mask {
  position: fixed;
  inset: 0;
  z-index: 30;
}
.more-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 31;
  min-width: 190px;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border-strong);
  border-radius: 9px;
  box-shadow: var(--rg-shadow-2);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.menu-item {
  text-align: left;
  border: none;
  background: transparent;
  color: var(--rg-text-2);
  border-radius: 7px;
  padding: 6px 9px;
  font-size: 11.5px;
  cursor: pointer;
  white-space: nowrap;
}
.menu-item:hover:not(:disabled) {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.menu-item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.mode-tabs {
  display: flex;
  gap: 2px;
  background: var(--rg-fill);
  border-radius: 8px;
  padding: 3px;
}
.mode-tab {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  cursor: pointer;
}
.mode-tab:hover {
  color: var(--rg-text);
}
.mode-tab.on {
  background: var(--rg-surface);
  color: var(--rg-text);
  font-weight: 600;
  box-shadow: var(--rg-shadow-1);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}
.btn:hover:not(:disabled) {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.btn.primary {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.btn.primary:hover:not(:disabled) {
  background: var(--rg-ink-hover);
  border-color: var(--rg-ink-hover);
  color: var(--rg-ink-contrast);
}
.btn.danger {
  color: var(--rg-danger);
  border-color: var(--rg-danger-border);
}
.btn.danger:hover:not(:disabled) {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.btn.small {
  padding: 3px 9px;
  font-size: 11px;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.entity-body {
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
}
.entity-list {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--rg-border);
  background: var(--rg-surface-2);
  padding: 10px 8px;
  overflow-y: auto;
  position: relative;
  display: flex;
  flex-direction: column;
}
.entity-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 8px;
  padding: 8px 9px;
  cursor: pointer;
  margin-bottom: 4px;
}
.entity-item:hover {
  background: var(--rg-hover);
}
.entity-item.on {
  background: var(--rg-surface);
  border-color: var(--rg-border-strong);
  box-shadow: var(--rg-shadow-1);
}
.entity-item-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rg-text);
}
.entity-item-meta {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.entity-item.draft .entity-item-name::after {
  content: ' ·';
  color: var(--rg-warn);
}
.entity-empty {
  padding: 16px 8px;
  font-size: 11.5px;
  color: var(--rg-text-3);
  line-height: 1.6;
}
.entity-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 14px 16px 40px;
}
.entity-main-empty {
  display: grid;
  place-items: center;
  color: var(--rg-text-3);
  font-size: 12.5px;
}
.entity-head {
  display: grid;
  grid-template-columns: 1.2fr 1.2fr 2fr auto;
  gap: 10px;
  align-items: end;
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 12px 14px;
}
.entity-head .field.wide {
  grid-column: 1 / span 2;
}
.entity-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-self: end;
  flex-wrap: wrap;
}
.refs-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
  background: var(--rg-surface-2);
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 7px 10px;
}
.refs-label {
  font-size: 11px;
  color: var(--rg-text-2);
  font-weight: 600;
  flex-shrink: 0;
}
.refs-select {
  min-width: 240px;
  flex: 1;
  max-width: 520px;
}
.refs-hint {
  font-size: 10.5px;
  color: var(--rg-warn);
}
.refs-sections {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--rg-text-2);
  min-width: 0;
}
.status-chip {
  font-size: 10.5px;
  border-radius: 999px;
  padding: 2px 8px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
}
.status-chip.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 3px 8px;
}
.section-head strong {
  font-size: 12.5px;
  color: var(--rg-text-2);
}
.table-wrap {
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  overflow-x: auto;
}
.edit-table {
  width: 100%;
  min-width: 880px;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--rg-text);
}
.edit-table th,
.edit-table td {
  border-bottom: 1px solid var(--rg-border);
  padding: 6px 6px;
  font-size: 11.5px;
  text-align: left;
  vertical-align: middle;
}
.edit-table th {
  background: var(--rg-fill);
  color: var(--rg-text-2);
  font-weight: 600;
  white-space: nowrap;
}
.edit-table tbody tr:hover td {
  background: var(--rg-hover);
}
.edit-table tr:last-child td {
  border-bottom: none;
}
.center {
  text-align: center;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--rg-danger);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  border-radius: 6px;
}
.icon-btn:hover {
  background: var(--rg-danger-soft);
}
.length-cell {
  display: flex;
  gap: 4px;
}
.muted {
  color: var(--rg-text-3);
  font-size: 11px;
}
.relation-cross {
  margin: 4px 0 0;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--rg-warn);
}
.relation-list {
  background: var(--rg-surface);
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 10px 12px;
}
.relation-row {
  display: grid;
  grid-template-columns: 1.4fr 1.2fr 1.4fr 30px;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
.er-tip {
  margin-top: 8px;
  font-size: 11px;
  color: var(--rg-text-3);
}
/* 窄屏抽屉开关（≤768 实体列表折叠） */
.pane-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border: 1px solid var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.pane-toggle:hover {
  border-color: var(--rg-text-3);
  background: var(--rg-hover);
  color: var(--rg-text);
}
.pane-close {
  display: none;
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
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
}
.pane-close:hover {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.pane-mask {
  display: none;
}

@media (max-width: 1280px) {
  .entity-head {
    grid-template-columns: 1fr 1fr;
  }
  .entity-head .field.wide {
    grid-column: 1 / -1;
  }
  .entity-head-actions {
    grid-column: 1 / -1;
    justify-self: start;
  }
  .entity-list {
    width: 180px;
  }
}

@media (max-width: 768px) {
  .pane-toggle {
    display: inline-flex;
  }
  .pane-close {
    display: inline-flex;
  }
  .pane-mask {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 40;
    background: var(--rg-overlay);
  }
  .entity-list {
    display: none;
  }
  .entity-list.open {
    display: flex;
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(280px, calc(100vw - 48px));
    z-index: 41;
    background: var(--rg-surface);
    box-shadow: var(--rg-shadow-2);
    border-right: 1px solid var(--rg-border);
    /* 给抽屉关闭按钮留出空间，避免压住首个实体项 */
    padding-top: 38px;
  }
  .tab-head {
    padding: 8px 10px;
  }
  .tab-actions {
    width: 100%;
  }
  .entity-main {
    padding: 12px 10px 32px;
  }
  .relation-row {
    grid-template-columns: 1fr;
  }
  .btn,
  .pane-toggle {
    min-height: 32px;
  }
  .icon-btn {
    width: 30px;
    height: 30px;
  }
}
</style>
