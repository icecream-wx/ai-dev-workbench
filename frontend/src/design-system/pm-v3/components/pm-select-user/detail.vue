<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    :title="title"
    width="980px"
    append-to-body
    :close-on-click-modal="false"
    class="ding-select-dialog"
    @open="onOpen"
    @close="onClose"
  >
    <el-tabs v-model="activeTab" :class="{ hidden_tabs: selectTypes.length <= 1 }">
      <el-tab-pane v-for="item in selectTypes" :key="item.id" :label="item.label" :name="item.id" lazy>
        <div class="transfer">
          <section class="transfer-panel">
            <header class="panel-header">
              <span class="panel-title">可选{{ typeLabel }}</span>
              <el-input
                v-model="searchKeyword"
                :placeholder="'搜索' + typeLabel"
                clearable
                prefix-icon="Search"
                class="panel-search"
                @input="onSearch"
              />
            </header>
            <div class="panel-sub">
              <el-breadcrumb v-if="!searchKeyword" separator="/">
                <el-breadcrumb-item>
                  <span class="crumb" :class="{ current: !leftPanel.path.length }" @click="jumpTo(-1)">全部</span>
                </el-breadcrumb-item>
                <el-breadcrumb-item v-for="(node, idx) in leftPanel.path" :key="node.id">
                  <span v-if="idx === leftPanel.path.length - 1" class="crumb current">{{ node.name }}</span>
                  <span v-else class="crumb" @click="jumpTo(idx)">{{ node.name }}</span>
                </el-breadcrumb-item>
              </el-breadcrumb>
              <span v-else class="search-hint">“{{ searchKeyword }}” 的搜索结果</span>
            </div>
            <div v-loading="leftPanel.loading || searchLoading" class="panel-body">
              <template v-if="!searchKeyword">
                <div
                  v-for="node in leftPanel.children"
                  :key="node.id"
                  class="level-item"
                  :class="{ 'is-drill': isDrillable(node), 'is-pick': isTarget(node) }"
                  @click="onRowClick(node)"
                >
                  <span class="checkbox-visual" :class="{ checked: isChecked(node) }" v-if="isTarget(node)">
                    <el-icon><Check /></el-icon>
                  </span>
                  <span class="item-icon" :class="'icon-' + (node.type || 'org')">
                    <el-icon><component :is="iconFor(node)" /></el-icon>
                  </span>
                  <span class="item-name">{{ node.name }}</span>
                  <span v-if="isTarget(node) && showCode && node.code" class="item-code">({{ node.code }})</span>
                  <el-icon v-if="isDrillable(node)" class="item-arrow"><ArrowRight /></el-icon>
                </div>
                <div v-if="!leftPanel.children.length && !leftPanel.loading" class="panel-empty">暂无数据</div>
              </template>
              <template v-else>
                <div
                  v-for="node in searchResults"
                  :key="node.id"
                  class="level-item"
                  :class="{ 'is-pick': isTarget(node) }"
                  @click="onRowClick(node)"
                >
                  <span class="checkbox-visual" :class="{ checked: isChecked(node) }" v-if="isTarget(node)">
                    <el-icon><Check /></el-icon>
                  </span>
                  <span class="item-icon" :class="'icon-' + (node.type || 'org')">
                    <el-icon><component :is="iconFor(node)" /></el-icon>
                  </span>
                  <span class="item-name">{{ node.name }}</span>
                  <span v-if="isTarget(node) && showCode && node.code" class="item-code">({{ node.code }})</span>
                </div>
                <div v-if="!searchResults.length && !searchLoading" class="panel-empty">无匹配结果</div>
              </template>
            </div>
          </section>

          <div class="transfer-actions">
            <el-button
              class="action-btn"
              type="primary"
              :disabled="!canSelectAll"
              title="将当前展示的人员全部加入已选"
              @click="selectAllCurrent"
            >
              <el-icon><DArrowRight /></el-icon>全部选中
            </el-button>
            <el-button
              class="action-btn"
              :disabled="!internalSelected.length"
              @click="clearAll"
            >
              <el-icon><DArrowLeft /></el-icon>全部取消
            </el-button>
          </div>

          <section class="transfer-panel">
            <header class="panel-header">
              <span class="panel-title">
                已选{{ typeLabel }}
                <em class="count-badge">{{ internalSelected.length }}</em>
              </span>
              <el-button
                link
                type="primary"
                size="small"
                :disabled="!internalSelected.length"
                @click="clearAll"
              >清空</el-button>
            </header>
            <div class="panel-body">
              <template v-if="internalSelected.length">
                <div v-for="item in internalSelected" :key="item.id" class="level-item">
                  <span class="item-icon icon-emp"><el-icon><User /></el-icon></span>
                  <span class="item-name">{{ item.name }}</span>
                  <span v-if="showCode && item.code" class="item-code">({{ item.code }})</span>
                  <el-icon class="item-remove" @click.stop="removeItem(item)"><Close /></el-icon>
                </div>
              </template>
              <div v-else class="panel-empty panel-empty-lg">
                <el-icon class="empty-icon"><User /></el-icon>
                <p>暂未选择{{ typeLabel }}</p>
              </div>
            </div>
          </section>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="cancel">取消</el-button>
      <el-button type="primary" @click="confirm">确定 ({{ internalSelected.length }})</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { cloneDeep, debounce } from 'lodash'
import { Folder, User, Avatar, Briefcase, Close, Check, ArrowRight, DArrowRight, DArrowLeft } from '@element-plus/icons-vue'
import { useSelectionTree } from '../../composables/useSelectionTree'
import { useSelectModel } from '../../composables/useSelectModel'

const props = defineProps({
  modelValue: { default: null },
  visible: { type: Boolean, default: false },
  multiple: { type: Boolean, default: false },
  showCode: { type: Boolean, default: false },
  currentType: { type: String, default: 'emp' },
  selectTypes: { type: Array, default: () => [] },
  tenantId: { type: String, default: '' },
  title: { type: String, default: '选择' },
})

const emit = defineEmits(['update:modelValue', 'update:visible', 'confirm'])

const { getEmpByOrgs } = useSelectModel()

const typeIconMap = { org: Folder, emp: User, role: Avatar, position: Briefcase, positionType: Briefcase, group: Folder }
const typeLabelMap = { org: '机构', emp: '人员', role: '角色', position: '岗位', group: '工作组' }

const activeTab = ref('')
const searchKeyword = ref('')
const internalSelected = ref([])
const rightPath = ref([])
const panelMap = reactive({})

const isMultiple = computed(() => props.multiple)
const typeLabel = computed(() => typeLabelMap[props.currentType] || '人员')

const rangeModeForTree = computed(() => {
  const item = props.selectTypes.find(t => t.id === activeTab.value) || props.selectTypes[0]
  return item ? { [props.currentType]: item.rangeMode } : { [props.currentType]: 'dimension' }
})

const rangeDataForTree = computed(() => {
  const item = props.selectTypes.find(t => t.id === activeTab.value) || props.selectTypes[0]
  return item ? { [props.currentType]: item.rangeData } : { [props.currentType]: {} }
})

const selectionTree = useSelectionTree({
  get currentType() { return props.currentType },
  get rangeMode() { return rangeModeForTree.value },
  get rangeData() { return rangeDataForTree.value },
  get tenantId() { return props.tenantId },
  get isMultiple() { return props.multiple },
})

const { search, searchResults, searchLoading, loadRootNodes, loadChildren } = selectionTree

const EMPTY_PANEL = { path: [], children: [], loading: false, loaded: false }
const leftPanel = computed(() => panelMap[activeTab.value] || EMPTY_PANEL)

function ensurePanel(tabId) {
  if (!panelMap[tabId]) {
    panelMap[tabId] = reactive({ path: [], children: [], loading: false, loaded: false })
  }
  return panelMap[tabId]
}

async function loadLevel(p) {
  p.loading = true
  try {
    const parent = p.path.length ? p.path[p.path.length - 1].raw : null
    p.children = parent ? (await loadChildren(parent)) || [] : (await loadRootNodes()) || []
    p.loaded = true
  } finally {
    p.loading = false
  }
}

function openTab(tab) {
  if (!tab || !props.visible) return
  const p = ensurePanel(tab)
  if (!p.loaded && !p.loading) loadLevel(p)
}

watch(activeTab, (tab) => {
  searchKeyword.value = ''
  openTab(tab)
})

watch(() => props.selectTypes, (val) => {
  if (!val?.length) return
  activeTab.value = val[0].id
  openTab(activeTab.value)
}, { immediate: true })

function isTarget(node) { return node.type === props.currentType }
function isDrillable(node) { return !node.isLeaf && node.type !== props.currentType }
function iconFor(node) { return typeIconMap[node.type] || Folder }
function isChecked(node) { return internalSelected.value.some(i => i.id === node.id) }

async function onRowClick(node) {
  if (isDrillable(node)) {
    if (searchKeyword.value || leftPanel.value.loading) return
    const p = ensurePanel(activeTab.value)
    p.path.push({ id: node.id, name: node.name, raw: node })
    await loadLevel(p)
  } else if (isTarget(node)) {
    toggleItem(node)
  }
}

async function jumpTo(idx) {
  const p = ensurePanel(activeTab.value)
  if (idx === -1 && !p.path.length) return
  p.path = p.path.slice(0, idx + 1)
  await loadLevel(p)
}

function rightEnter(org) {
  rightPath.value = [...rightPath.value, { id: org.id, name: org.name }]
}

function rightJumpTo(idx) {
  rightPath.value = rightPath.value.slice(0, idx + 1)
}

const leftList = computed(() => (searchKeyword.value ? searchResults.value : leftPanel.value.children) || [])
const canSelectAll = computed(() => isMultiple.value && leftList.value.length > 0)

function toSelection(node) {
  return {
    id: node.id,
    name: node.name || node.employeeName,
    code: node.code,
    type: node.type,
  }
}

function toggleItem(node) {
  if (isChecked(node)) {
    internalSelected.value = internalSelected.value.filter(i => i.id !== node.id)
  } else if (isMultiple.value) {
    internalSelected.value = [...internalSelected.value, toSelection(node)]
  } else {
    internalSelected.value = [toSelection(node)]
  }
}

async function selectAllCurrent() {
  if (!isMultiple.value) return
  const adds = []
  const push = (item) => {
    if (!item || !item.id) return
    if (adds.some(i => i.id === item.id) || isChecked(item)) return
    adds.push(toSelection(item))
  }
  for (const n of leftList.value) {
    if (isChecked(n)) continue
    if (isTarget(n)) {
      push(n)
    } else if (n.type === 'org') {
      const page = await getEmpByOrgs({ tenantId: props.tenantId, orgIds: n.id, isFirst: '1', pageIndex: 0, pageSize: -1 })
      ;(page?.data || []).forEach(push)
    }
  }
  if (adds.length) internalSelected.value = [...internalSelected.value, ...adds]
}

function removeItem(item) {
  internalSelected.value = internalSelected.value.filter(i => i.id !== item.id)
}

function clearAll() {
  internalSelected.value = []
  rightPath.value = []
}

function pathStartsWith(path, prefix) {
  if (prefix.length > path.length) return false
  return prefix.every((p, i) => p.id === path[i]?.id)
}

const rightView = computed(() => {
  const orgMap = new Map()
  const emps = []
  for (const s of internalSelected.value) {
    if (!Array.isArray(s.path) || !pathStartsWith(s.path, rightPath.value)) continue
    if (s.path.length === rightPath.value.length) {
      emps.push(s)
    } else {
      const child = s.path[rightPath.value.length]
      if (!orgMap.has(child.id)) orgMap.set(child.id, { id: child.id, name: child.name, count: 0 })
      orgMap.get(child.id).count++
    }
  }
  return { orgs: [...orgMap.values()], emps }
})

function normalizeSelected(val) {
  const arr = props.multiple
    ? (Array.isArray(val) ? val : val ? [val] : [])
    : (val && val.id ? [val] : [])
  return cloneDeep(arr).map(i => ({ ...i, path: Array.isArray(i.path) ? i.path : [] }))
}

watch(() => props.modelValue, (val) => {
  if (props.visible) internalSelected.value = normalizeSelected(val)
}, { immediate: true })

function onOpen() {
  internalSelected.value = normalizeSelected(props.modelValue)
  searchKeyword.value = ''
  rightPath.value = []
  openTab(activeTab.value)
}

function onClose() {
  searchKeyword.value = ''
}

function cancel() { emit('update:visible', false) }

function confirm() {
  const result = props.multiple ? internalSelected.value : internalSelected.value[0] || null
  emit('update:modelValue', result)
  emit('confirm', internalSelected.value)
  cancel()
}

const onSearch = debounce(() => {
  if (searchKeyword.value) search(searchKeyword.value)
}, 300)
</script>

<style lang="scss" scoped>
.transfer {
  display: flex;
  align-items: stretch;
  gap: 12px;
  height: 460px;
}

.transfer-panel {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #ebeef5;
  background: #fafbfc;
  flex-shrink: 0;
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.count-badge {
  font-style: normal;
  font-weight: 500;
  font-size: 12px;
  line-height: 18px;
  padding: 0 7px;
  color: #fff;
  background: var(--el-color-primary, #409eff);
  border-radius: 10px;
}

.panel-search {
  flex: 1;
  min-width: 0;
}

.panel-search :deep(.el-input__wrapper) {
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 0 0 1px #e4e7ed inset;
}

.panel-sub {
  display: flex;
  align-items: center;
  min-height: 34px;
  padding: 4px 12px;
  border-bottom: 1px solid #f5f7fa;
  flex-shrink: 0;
  overflow: hidden;
}

.panel-sub :deep(.el-breadcrumb) {
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.panel-sub :deep(.el-breadcrumb__inner) {
  display: inline;
}

.crumb {
  color: #909399;
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: var(--el-color-primary, #409eff);
  }

  &.current {
    color: #303133;
    font-weight: 600;
    cursor: default;
  }
}

.search-hint {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 3px;
  }
}

.level-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 13px;
  color: #303133;
  user-select: none;

  & + .level-item {
    margin-top: 1px;
  }
}

.level-item.is-drill {
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #f5f7fa;

    .item-arrow {
      color: var(--el-color-primary, #409eff);
      transform: translateX(2px);
    }
  }
}

.level-item.is-pick {
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #f5f7fa;
  }
}

.checkbox-visual {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  border: 1px solid #dcdfe6;
  border-radius: 3px;
  background: #fff;
  color: #fff;
  font-size: 11px;
  transition: all 0.15s;

  &.checked {
    background: var(--el-color-primary, #409eff);
    border-color: var(--el-color-primary, #409eff);
  }
}

.item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 5px;
  font-size: 13px;

  &.icon-org {
    color: #409eff;
    background: #ecf5ff;
  }

  &.icon-emp {
    color: #67c23a;
    background: #f0f9eb;
  }

  &.icon-role,
  &.icon-position,
  &.icon-positionType,
  &.icon-group {
    color: #e6a23c;
    background: #fdf6ec;
  }
}

.item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-code {
  flex-shrink: 0;
  font-size: 12px;
  color: #8492a6;
}

.item-arrow {
  flex-shrink: 0;
  font-size: 14px;
  color: #c0c4cc;
  transition: color 0.15s, transform 0.15s;
}

.item-badge {
  flex-shrink: 0;
  min-width: 20px;
  text-align: center;
  font-size: 11px;
  line-height: 17px;
  padding: 0 6px;
  color: #909399;
  background: #f0f2f5;
  border-radius: 9px;
}

.item-remove {
  flex-shrink: 0;
  font-size: 14px;
  color: #c0c4cc;
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: #f56c6c;
  }
}

.transfer-actions {
  flex-shrink: 0;
  width: 96px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.action-btn {
  width: 96px;
  height: 32px;
  padding: 0;
  margin: 0 !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  border-radius: 6px;
}

.panel-empty {
  text-align: center;
  color: #c0c4cc;
  font-size: 13px;
  padding: 40px 0;
}

.panel-empty-lg {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  padding: 0;

  .empty-icon {
    font-size: 42px;
    color: #e4e7ed;
  }

  p {
    margin: 0;
  }
}

.hidden_tabs :deep(.el-tabs__header) {
  display: none;
}
</style>

<!-- Modified by AI on 2026-09-15 10:00:00 -->
