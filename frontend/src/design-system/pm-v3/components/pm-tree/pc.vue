<template>
  <div :class="['pm-tree', highlight ? 'pm-tree--highlight' : '']">
    <el-input v-if="searchable" v-model="keyword" placeholder="检索" clearable style="margin-bottom:8px">
      <template #prefix><el-icon>
          <Search />
        </el-icon></template>
    </el-input>
    <el-tree ref="treeRef" highlight-current :node-key="propsConf.id" :data="data" :filter-node-method="filterNode"
      :props="propsConf" :expand-on-click-node="false" :current-node-key="currentNodeKey"
      :default-expanded-keys="defaultExpandedKeys" v-bind="$attrs" :show-checkbox="multiple" :lazy="lazy" :load="loadFn"
      @node-click="handleNodeClick">
      <template #default="{ node, data: nodeData }">
        <div class="pm-tree__node--custom">
          <slot name="row" :data="nodeData" :node="node">
            <div class="name" :class="disabledKeys.includes(node.key) ? 'gray' : ''">
              {{ node.label }}
            </div>
            <div v-if="!nodeData.isLock" class="btns">
              <el-icon v-if="editable" class="btn-icon btn-icon--edit" @click.stop="$emit('edit', nodeData)">
                <EditPen />
              </el-icon>
              <el-icon v-if="removable" class="btn-icon btn-icon--remove" @click.stop="$emit('remove', nodeData)">
                <Delete />
              </el-icon>
            </div>
          </slot>
        </div>
      </template>
    </el-tree>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Search, EditPen, Delete } from '@element-plus/icons-vue'

/**
 * 树形组件，基于 el-tree 封装的树形数据展示，支持节点选择、展开/折叠和自定义节点
 */
const props = defineProps({
  line: { type: Boolean, default: false },
  highlight: { type: Boolean, default: true },
  multiple: { type: Boolean, default: false },
  load: { type: Function, default: null },
  size: { type: String, default: 'normal' },
  modelValue: { type: Object, default: null },
  editable: { type: Boolean, default: true },
  searchable: { type: Boolean, default: true },
  removable: { type: Boolean, default: true },
  lazy: { type: Boolean, default: false },
  contextMenuEnable: { type: Boolean, default: true },
  defaultExpandedKeys: { type: Array, default: () => [] },
  props: { type: Object, default: () => ({ id: 'id', label: 'name', children: 'children', isLeaf: 'isLeaf' }) },
  data: { type: Array, default: () => [] },
  disabledKeys: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'node-click', 'edit', 'remove', 'add'])

const propsConf = props.props
const treeRef = ref(null)
const currentNodeKey = ref(null)
const currentNode = ref(null)
const keyword = ref(null)

function filterNode(value, data) {
  if (!value) return true
  return data[propsConf.label]?.toLowerCase().includes(value.toLowerCase())
}

function setCurrentKey(key) {
  treeRef.value?.setCurrentKey(key)
  currentNodeKey.value = key
}

function handleNodeClick(data, node) {
  currentNode.value = node
  emit('update:modelValue', data)
  emit('node-click', data, node)
}

watch(() => props.modelValue, (val) => {
  if (val && val[propsConf.id]) {
    setTimeout(() => setCurrentKey(val[propsConf.id]))
  }
}, { immediate: true })

watch(keyword, (val) => {
  treeRef.value?.filter(val)
})

defineExpose({ setCurrentKey, refreshNode: () => {} })
</script>

<style lang="scss" scoped>
.pm-tree {
  min-height: 0;
  padding-top: 0;
  color: #53627a;
  border-top: 1px solid #d7e1f0;

  :deep(.el-input) {
    margin-bottom: 8px !important;
  }

  :deep(.el-input__wrapper) {
    height: 34px;
    padding: 0 10px;
    border: 1px solid #d6e1f0;
    border-radius: 8px;
    background: #fff;
    box-shadow: none;
  }

  :deep(.el-input__inner) {
    height: 32px;
    line-height: 32px;
    color: #243247;
    font-size: 13px;
  }

  :deep(.el-input__inner::placeholder) {
    color: #a7b4c7;
  }

  :deep(.el-input__prefix) {
    color: #9aa8ba;
  }

  :deep(.el-input__prefix .el-icon) {
    width: 15px;
    height: 15px;
  }

  :deep(.el-tree) {
    --el-tree-node-hover-bg-color: rgba(31, 94, 255, 0.05);
    color: #53627a;
    background: transparent;
  }

  :deep(.el-tree-node__content) {
    position: relative;
    height: 34px;
    line-height: 34px;
    margin-bottom: 4px;
    border-radius: 8px;
    transition: color .18s ease, background .18s ease;
  }

  :deep(.el-tree-node__content:hover) {
    color: var(--el-color-primary);
    background: rgba(31, 94, 255, 0.05);
  }

  &__node--custom {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    min-width: 0;
    padding: 0 8px;
    color: #53627a;
    font-size: 13px;
    font-weight: 500;
    height: 34px;
    line-height: 34px;

    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .gray {
      color: #bdbdbd;
    }

    .btns {
      display: flex;
      align-items: center;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.18s ease;
      margin-left: auto;
      padding-left: 8px;
    }

    &:hover .btns {
      opacity: 1;
    }

    .btn-icon {
      width: 22px;
      height: 22px;
      font-size: 14px;
      padding: 4px;
      border-radius: 50%;
      cursor: pointer;
      transition: background 0.18s, color 0.18s;
    }

    .btn-icon--edit {
      color: #1f2937;

      &:hover {
        color: var(--el-color-primary);
        background: rgba(31, 94, 255, 0.08);
      }
    }

    .btn-icon--remove {
      color: #f56c6c;

      &:hover {
        background: rgba(245, 108, 108, 0.1);
      }
    }
  }
}

.pm-tree--highlight :deep(.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content) {
  transition: all 0.15s ease;
  background: rgba(31, 94, 255, 0.1);
  border-radius: 8px;
  color: var(--el-color-primary);
}

.pm-tree--highlight :deep(.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content::before) {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 8px 0 0 8px;
  background: var(--el-color-primary);
}

/* 预览修复（P7-3a）：上游使用后代选择器，导致当前节点下所有后代文字变蓝；
   这里限定为当前节点的直接内容节点。 */
.pm-tree--highlight :deep(.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content > .pm-tree__node--custom) {
  color: var(--el-color-primary);
  font-weight: 400;
}
</style>
