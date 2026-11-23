<template>
  <div>
    <div v-if="title" class="nav-title">{{ title }}</div>
    <el-input v-model="filterText" placeholder="检索" prefix-icon="Search" size="small" style="padding: 6px;" />
    <div v-loading="loading" class="nav-tree">
      <el-tree
        ref="treeRef"
        :data="treeData"
        :props="treeProps"
        node-key="nodeId"
        :default-expanded-keys="expandedKeys"
        @node-click="onNodeClick"
        @node-expand="onNodeExpand"
      >
        <template #default="{ data }">
          <span>{{ data.name }}</span>
          <span v-if="data.type === currentType && showCode && data.code"> ({{ data.code }})</span>
        </template>
      </el-tree>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { debounce } from 'lodash'
import { useSelectionTree } from '../../composables/useSelectionTree'

const props = defineProps({
  title: { type: String, default: '' },
  currentType: { type: String, default: 'emp' },
  rangeMode: { type: [String, Object], default: () => ({}) },
  rangeData: { type: Object, default: () => ({}) },
  showCode: { type: Boolean, default: false },
  tenantId: { type: String, default: '' },
  navigationTree: { type: Boolean, default: false },
})

const emit = defineEmits(['change'])

const treeRef = ref(null)
const filterText = ref('')
const treeProps = { label: 'name', children: 'children', isLeaf: 'isLeaf' }

const { treeData, loading, expandedKeys, loadRootNodes, loadChildren } = useSelectionTree({
  get currentType() { return props.currentType },
  get rangeMode() { return props.rangeMode },
  get rangeData() { return props.rangeData },
  get tenantId() { return props.tenantId },
  get isMultiple() { return false },
})

watch(filterText, () => { loadRootNodes() }, { immediate: true })

async function onNodeExpand(data) {
  if (data.childrenLoaded || data.isLeaf) return
  await loadChildren(data)
  data.childrenLoaded = true
}

function onNodeClick(data) {
  emit('change', data)
}
</script>

<style scoped>
.nav-title { padding: 8px; font-weight: 500; }
.nav-tree { max-height: 400px; overflow-y: auto; }
</style>
