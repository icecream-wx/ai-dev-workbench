<template>
  <div class="select-panel">
    <el-input
      v-model="keyword"
      placeholder="搜索"
      clearable
      prefix-icon="Search"
      size="default"
      class="select-panel-search"
      @input="onSearch"
    />
    <div v-loading="loading" class="tree-wrapper">
      <el-tree
        v-if="!keyword"
        ref="treeRef"
        :props="treeProps"
        show-checkbox
        node-key="id"
        :check-strictly="props.currentType !== 'org' || !props.multiple"
        lazy
        :load="onLoadNode"
        @check="onCheck"
      >
        <template #default="{ data }">
          <span class="tree-node-label" :class="{ 'is-target': data.type === currentType, 'is-disabled': data.selectDisabled }">
            <el-icon v-if="data.type === 'org'" class="node-icon"><Folder /></el-icon>
            <el-icon v-else-if="data.type === 'emp'" class="node-icon"><User /></el-icon>
            <span class="node-name">{{ data.name }}</span>
            <el-tag v-if="data.type !== currentType && data.type" size="small" class="node-type-tag">{{ getTypeLabel(data.type) }}</el-tag>
            <span v-if="data.type === currentType && showCode && data.code" class="node-code">({{ data.code }})</span>
          </span>
        </template>
      </el-tree>
      <el-tree
        v-else
        ref="searchTreeRef"
        :data="searchResults"
        :props="treeProps"
        show-checkbox
        node-key="id"
        :check-strictly="props.currentType !== 'org' || !props.multiple"
        @check="onCheck"
      >
        <template #default="{ data }">
          <span class="tree-node-label" :class="{ 'is-target': data.type === currentType, 'is-disabled': data.selectDisabled }">
            <el-icon v-if="data.type === 'org'" class="node-icon"><Folder /></el-icon>
            <el-icon v-else-if="data.type === 'emp'" class="node-icon"><User /></el-icon>
            <span class="node-name">{{ data.name }}</span>
            <el-tag v-if="data.type !== currentType && data.type" size="small" class="node-type-tag">{{ getTypeLabel(data.type) }}</el-tag>
            <span v-if="data.type === currentType && showCode && data.code" class="node-code">({{ data.code }})</span>
          </span>
        </template>
      </el-tree>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { debounce } from 'lodash'
import { Folder, User } from '@element-plus/icons-vue'
import { useSelectionTree } from '../../composables/useSelectionTree'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  multiple: { type: Boolean, default: false },
  showCode: { type: Boolean, default: false },
  currentType: { type: String, default: 'emp' },
  selectTypes: { type: Array, default: () => [] },
  tenantId: { type: String, default: '' },
  rangeMode: { type: [String, Object], default: 'dimension' },
  rangeData: { type: Object, default: () => ({}) },
  queryDisableOrg: { type: Boolean, default: true },
  queryDisableUser: { type: Boolean, default: true },
})

const emit = defineEmits(['select', 'allowSelect'])

const treeRef = ref(null)
const searchTreeRef = ref(null)
const keyword = ref('')

const isOrgType = computed(() => props.currentType === 'org')

const treeProps = {
  label: 'name',
  children: 'children',
  isLeaf: 'isLeaf',
}

const typeLabelMap = {
  org: '组织',
  emp: '人员',
  role: '角色',
  position: '岗位',
}
function getTypeLabel(type) { return typeLabelMap[type] || type }

const rangeModeForTree = computed(() => {
  const firstType = props.selectTypes?.[0]
  if (firstType) return { [props.currentType]: firstType.rangeMode }
  return { [props.currentType]: 'dimension' }
})

const rangeDataForTree = computed(() => {
  const firstType = props.selectTypes?.[0]
  if (firstType) return { [props.currentType]: firstType.rangeData }
  return { [props.currentType]: {} }
})

const selectionTree = useSelectionTree({
  get currentType() { return props.currentType },
  get rangeMode() { return rangeModeForTree.value },
  get rangeData() { return rangeDataForTree.value },
  get tenantId() { return props.tenantId },
  get isMultiple() { return props.multiple },
})

const { treeData, loading, searchResults, expandedKeys, loadRootNodes, search } = selectionTree

onMounted(() => syncCheckedNodes())

watch(() => props.modelValue, () => syncCheckedNodes(), { deep: true })

function syncCheckedNodes() {
  nextTick(() => {
    const val = Array.isArray(props.modelValue) ? props.modelValue : (props.modelValue ? [props.modelValue] : [])
    const keys = val.filter(i => i && i.id && i.type === props.currentType).map(i => i.id)
    if (keyword.value) {
      searchTreeRef.value?.setCheckedKeys(keys)
    } else {
      treeRef.value?.setCheckedKeys(keys)
    }
  })
}

async function onLoadNode(node, resolve) {
  if (node.level === 0) {
    const rootNodes = await loadRootNodes()
    const items = (props.modelValue || []).filter(i => i.type === props.currentType)
    nextTick(() => treeRef.value?.setCheckedNodes(items))
    return resolve(rootNodes)
  } else {
    const children = await selectionTree.loadChildren(node.data)
    return resolve(children)
  }
}

function onCheck(checkedNode, checked) {
  nextTick(() => {
    const ref = keyword.value ? searchTreeRef.value : treeRef.value
    if (!ref) return
    const isOrg = props.currentType === 'org'
    if (!isOrg && checkedNode.selectDisabled) {
      ref.setChecked(checkedNode.id, false)
      return
    }
    const nodes = ref.getCheckedNodes() || []
    const filtered = props.multiple
      ? nodes.filter(n => n && n.type === props.currentType)
      : nodes.filter(n => n && n.type === props.currentType).slice(0, 1)
    if (!props.multiple && filtered.length > 0) {
      const allChecked = nodes.filter(n => n && n.type === props.currentType)
      allChecked.slice(0, -1).forEach(t => ref.setChecked(t.id, false))
    }
    emit('select', filtered)
  })
}

const onSearch = debounce(() => {
  if (keyword.value) {
    search(keyword.value)
  }
}, 300)
</script>

<style lang="scss" scoped>
.select-panel {
  width: 100%;
}

.select-panel-search {
  margin-bottom: 8px;
}

.select-panel-search :deep(.el-input__wrapper) {
  border-radius: 20px;
  background: #f5f6f8;
  box-shadow: none;
  border: none;
  padding: 1px 12px;
}

.tree-wrapper {
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 4px 0;
}

.tree-wrapper :deep(.el-tree-node__content) {
  height: 32px;
  padding-right: 8px;
}

.tree-node-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  width: 100%;
  overflow: hidden;
}

.tree-node-label.is-target {
  color: #303133;
  font-weight: 500;
}

.tree-node-label:not(.is-target) {
  color: #909399;
}

.tree-node-label.is-disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.node-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-type-tag {
  flex-shrink: 0;
  height: 18px;
  padding: 0 4px;
  font-size: 11px;
  line-height: 18px;
  border-radius: 3px;
  transform: scale(0.92);
}

.node-code {
  color: #8492a6;
  font-size: 12px;
  flex-shrink: 0;
}
</style>
