<template>
  <div
    v-if="showAll"
    :class="selectTreeClassName"
  >
    <el-tree-select
      :key="selectkey + '-' + (isLazyConfig ? 'lazy' : 'static') + '-' + (valueField || '')"
      ref="selectTree"
      v-model="finalValue"
      style="width: 100%"
      :lazy="isLazyConfig"
      :load="isLazyConfig ? loadNode : undefined"
      :data="treeData"
      :props="treePropsMap"
      :node-key="valueField"
      :multiple="multiple"
      :show-checkbox="multiple"
      :check-strictly="isCheckStrictly"
      :cache-data="cacheData"
      :filterable="isFilterable"
      :filter-method="isFilterable ? search : undefined"
      :filter-node-method="filterNodeMethod"
      :expand-on-click-node="false"
      :disabled="disabled"
      :clearable="clearable"
      :placeholder="i18n(placeholder)"
      @clear="clearHandle"
      @focus="handleFocus"
      @node-click="handleNodeClick"
      @check="handleCheck"
      @remove-tag="removeTagHandle"
    >
      <template #default="{ node, data }">
        <TreeOption
          :node="node"
          :data="data"
          v-bind="$props"
          :filterEntityText="filterEntityText"
          :currentKey="currentKey"
          @handleClickSetPosition="handleClickSetPosition"
        >
          <template #default="{data,labelField,settings,isJSON}">
            <slot :data="data" :labelField="labelField" :settings="settings" :isJSON="isJSON"></slot>
          </template>
        </TreeOption>
      </template>
      <template v-if="isJSON && multiple" #header>
        <el-checkbox v-model="isSelectAll" @change="selectAll">全选</el-checkbox>
      </template>
    </el-tree-select>
  </div>
</template>

<script>
import { concat } from 'lodash'
import { treeToList } from '../../../utils/treeList'
import common from '../common'
import TreeOption from './tree-option.vue'
import { getLinkNode } from '../utils/allMode'

const EMPTY_LIST = []

export default {
  name: 'tree-select',
  components: { TreeOption },
  mixins: [common],
  inject: ['grandParent'],
  emits: ['selectTreeChange'],
  props: {
    value: {
      default: null,
    },
    placeholder: {
      default: '',
    },
    options: {
      type: Array,
      default: () => [],
    },
    staticTreeData: {
      type: Array,
      default: () => [],
    },
    settings: {
      type: Object,
      default: () => ({}),
    },
    cloneEntityModel: {
      default: null,
    },
    clearable: {
      type: Boolean,
      default: true,
    },
    optionTemplateIsEnable: {
      type: Boolean,
      default: true,
    },
    checkStrictly: {
      default: false,
    },
    multiple: {
      default: false,
    },
    isHighlight: {
      default: false,
    },
    isFilterable: {
      default: false,
    },
    isEntityAllSearch: {
      default: false,
    },
    separator: {
      default: '',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    selectTreeClassName() {
      return this.isHighlight ? 'select-tree select-tree-light' : 'select-tree'
    },
    isLazyConfig() {
      return this.isEntityData && !this.isEntityAllSearch
    },
    treeData() {
      if (this.isLazyConfig) {
        // 仅远程搜索返回结果时才切换数据；其余保持 undefined 走 el-tree 默认空数组（data 为 null 会破坏 cacheOptions）
        return this.filterEntityText && this.filterEntityList.length ? this.filterEntityList : undefined
      }
      if (this.isEntityData) {
        return this.filterEntityText && !this.isStaticTreeSearch ? this.filterEntityList : this.staticTreeData
      }
      return this.staticTreeData
    },
    cacheData() {
      const model = this.cloneEntityModel
      if (this.getValIsEmpty(model)) return EMPTY_LIST
      return Array.isArray(model) ? model.filter((item) => item) : [model]
    },
    flatStaticList() {
      if (this.isJSON) return this.jsonTreeList
      if (this.isEntityData && this.entityList.length) return this.entityList
      return treeToList(this.staticTreeData || [], [], {
        labelField: this.labelField,
        valueField: this.valueField,
        childrenField: this.childrenField,
      })
    },
  },
  data() {
    return {
      finalValue: this.multiple ? [] : null,
      currentKey: Date.now(),
      entityList: [],
      showAll: true,
      isAllow: null,
      isSelectAll: false,
      filterEntityText: '',
      filterEntityList: [],
      node: null,
      resolve: null,
      selectkey: 0,
      treePropsMap: {
        // 映射对象必须保持引用稳定：el-tree 的 store.props 不会跟随 props 变更，
        // 函数闭包在调用时读取响应式状态，保证映射始终为最新逻辑
        label: (data) => this.renderLabel(data),
        children: 'children',
        isLeaf: 'isLeaf',
        disabled: (data, node) => this.renderDisabled(data, node),
      },
      pathCache: new WeakMap(),
    }
  },
  watch: {
    cloneEntityModel: {
      immediate: true,
      handler(val) {
        this.finalValue = this.modelToKeys(val)
      },
    },
    multiple() {
      this.selectkey++
      this.finalValue = this.modelToKeys(this.cloneEntityModel)
    },
  },
  mounted() {
    if (this.isJSON && this.isJsonSelectAll) {
      this.isSelectAll = this.isJsonSelectAll
      this.selectAll()
    }
  },
  methods: {
    modelToKeys(val) {
      if (this.getValIsEmpty(val)) return this.multiple ? [] : null
      if (Array.isArray(val)) {
        const keys = val.filter((item) => item).map((item) => item[this.valueField])
        // pc 侧单选传入的 cloneEntityModel 也是数组（getValueArr 返回列表），需收敛为单 key
        return this.multiple ? keys : (keys[0] ?? null)
      }
      return val[this.valueField] || val.id || null
    },
    toKeyArray(val) {
      if (Array.isArray(val)) return val.filter((key) => key != null)
      if (val == null || val === '') return []
      return [val]
    },
    resolveSelection(keys) {
      const treeRef = this.$refs.selectTree
      const nodes = []
      keys.forEach((key) => {
        const node = treeRef && treeRef.getNode && treeRef.getNode(key)
        if (node && node.data) {
          nodes.push(node.data)
          return
        }
        const cached = this.cacheData.find((item) => item && item[this.valueField] === key)
        if (cached) nodes.push(cached)
      })
      return nodes
    },
    filterSelectable(nodes) {
      const result = []
      ;(nodes || []).forEach((item) => {
        if (!item) return
        const isAllow = this.getIsAllowSelect(item)
        if (typeof isAllow === 'boolean' && !isAllow) return
        const isEmit = this.isCheckStrictly ? item.type === this.checkNodeType : item.isLeaf
        if (isEmit || isAllow) result.push(item)
      })
      return result
    },
    emitSelection() {
      const keys = this.toKeyArray(this.finalValue)
      if (!keys.length) {
        this.$emit('selectTreeChange', null, this.entityList)
        return
      }
      const nodes = this.filterSelectable(this.resolveSelection(keys))
      if (this.multiple) {
        this.$emit('selectTreeChange', nodes, this.entityList)
      } else {
        this.$emit('selectTreeChange', nodes[0] || null, this.entityList)
      }
    },
    renderLabel(data) {
      if (!data || typeof data !== 'object') return ''
      if (this.isAllMode) {
        const cached = this.pathCache.get(data)
        if (cached !== undefined) return cached
        const nodes = getLinkNode(data, this.flatStaticList)
        const label = Array.isArray(nodes) && nodes.length
          ? nodes
            .map((node) => (node.hasOwnProperty('customLabel') && node[node.customLabel]) || node.label)
            .join(this.separator)
          : ''
        const result = label || data[this.labelField] || data.label || ''
        this.pathCache.set(data, result)
        return result
      }
      return data[this.labelField] ?? data.label ?? ''
    },
    isSelectable(data) {
      const isAllow = this.getIsAllowSelect(data)
      if (typeof isAllow === 'boolean' && !isAllow) return false
      const isEmit = this.isCheckStrictly ? data.type === this.checkNodeType : data.isLeaf
      return isEmit || !!isAllow
    },
    renderDisabled(data) {
      // 实体数据未绑定节点类型属于配置错误：禁用所有节点，alert 在 handleNodeClick 中保留
      if (this.isEntityData && !this.checkNodeType) return true
      if (this.multiple) {
        return this.getIsAllowSelect(data) === false
      }
      return !this.isSelectable(data)
    },
    filterNodeMethod(value, data) {
      if (!value) return true
      const label = (data && (data.label ?? data[this.labelField])) || ''
      return label.indexOf(value) !== -1
    },
    async search(value) {
      this.filterEntityText = value
      if (this.isEntityData && !this.isStaticTreeSearch) {
        if (value) {
          this.filterEntityList = (await this.getDataByFilter(value)) || []
        } else {
          this.filterEntityList = []
          await this.$nextTick()
          await this.loadNode(this.node, this.resolve)
          this.reapplyCheckedKeys()
        }
        return
      }
      this.$refs.selectTree && this.$refs.selectTree.filter && this.$refs.selectTree.filter(value)
    },
    handleFocus() {
      if (!this.filterEntityText && !this.filterEntityList.length) return
      this.filterEntityText = ''
      this.filterEntityList = []
      this.$nextTick(async () => {
        if (this.isLazyConfig) {
          await this.loadNode(this.node, this.resolve)
          this.reapplyCheckedKeys()
        } else {
          this.resetTreeFilter()
        }
      })
    },
    resetTreeFilter() {
      const treeRef = this.$refs.selectTree
      treeRef && treeRef.filter && treeRef.filter('')
    },
    handleClickSetPosition(data) {
      this.filterEntityText = ''
      const treeRef = this.$refs.selectTree
      treeRef && treeRef.filter && treeRef.filter('')
      this.$nextTick(() => {
        treeRef && treeRef.setCurrentKey && treeRef.setCurrentKey(data.id)
        const anchor = document.getElementById(this.currentKey + data[this.labelField])
        anchor && anchor.scrollIntoView()
      })
    },
    reapplyCheckedKeys() {
      if (!this.multiple) return
      const treeRef = this.$refs.selectTree
      treeRef && treeRef.setCheckedKeys && treeRef.setCheckedKeys(this.toKeyArray(this.finalValue))
    },
    async loadNode(node, resolve) {
      const { level } = node || {}
      if (level === 0) {
        this.node = node
        this.resolve = resolve
      }
      if (
        (this.configEntityList && level < this.configEntityList.length) ||
        this.isSelfCorrelation
      ) {
        let nodes = await this.getOptions(level, node)
        this.entityList = this.entityList.concat(nodes)
        resolve(nodes)
      } else {
        resolve([])
      }
    },
    async getOptions(index, node) {
      if (!this.configEntityList || this.configEntityList.length === 0) {
        return []
      }
      let cascaderPanelArray = this.configEntityList.filter(
        (item) => item.level === index + 1
      )
      let totalData = []
      if (this.isSelfCorrelation) {
        let cascaderPanel = this.configEntityList[0]
        let cascaderPanel_parent = this.configEntityList[0]
        let resp = await this.getData(
          cascaderPanel_parent,
          cascaderPanel,
          index,
          node
        )
        totalData = concat(totalData, resp)
      } else {
        for (let item of cascaderPanelArray) {
          let cascaderPanel = item
          let cascaderPanel_parent = this.configEntityList.find(
            (item) => item.level === index
          )
          let resp = await this.getData(
            cascaderPanel_parent,
            cascaderPanel,
            index,
            node
          )
          totalData = concat(totalData, resp)
        }
      }
      return totalData
    },
    clearHandle() {
      this.filterEntityText = ''
      this.filterEntityList = []
      this.$nextTick(async () => {
        if (this.isLazyConfig) {
          await this.loadNode(this.node, this.resolve)
          this.reapplyCheckedKeys()
        } else {
          this.resetTreeFilter()
        }
      })
      this.$emit('selectTreeChange', null, this.entityList)
    },
    removeTagHandle(val) {
      const remaining = this.cacheData.filter(
        (item) => item && item[this.valueField] !== val
      )
      this.$emit('selectTreeChange', remaining, this.entityList)
    },
    handleNodeClick(data) {
      if (this.multiple) return
      const isAllow = this.getIsAllowSelect(data)
      if (typeof isAllow === 'boolean' && !isAllow) {
        return
      }
      if (this.isEntityData && !this.checkNodeType) {
        alert('必须绑定节点类型')
        return
      }
      const isEmit = this.isCheckStrictly ? (data.type === this.checkNodeType) : data.isLeaf
      // 常规节点：tree-select 内部完成选中并关闭下拉；isAllow 强制的非叶子节点需手动选中
      if (!isEmit && isAllow && !this.isCheckStrictly) {
        this.finalValue = data[this.valueField || 'value'] ?? data.id ?? null
        this.emitSelection()
        this.$refs.selectTree && this.$refs.selectTree.blur && this.$refs.selectTree.blur()
      }
    },
    handleCheck(node, params) {
      if (!this.multiple) return
      this.isSelectAll = false
      const checkedNodes = (params && params.checkedNodes) || []
      const current = this.toKeyArray(this.finalValue)
      // isAllow 强制的非叶子节点：tree-select 的值只含叶子 key，需手动补充
      const additions = checkedNodes
        .filter((item) => item && !item.isLeaf && this.getIsAllowSelect(item) === true)
        .map((item) => item[this.valueField || 'value'])
        .filter((key) => key != null && !current.includes(key))
      this.finalValue = additions.length ? current.concat(additions) : current
      this.emitSelection()
    },
    selectAll() {
      if (this.isSelectAll) {
        const leafNodeList = this.jsonTreeList.filter((item) => item.isLeaf)
        const result = this.filterSelectable(leafNodeList)
        this.finalValue = leafNodeList.map((item) => item[this.valueField || 'value'])
        this.$emit('selectTreeChange', result, this.entityList)
      } else {
        this.finalValue = []
        this.$emit('selectTreeChange', [], this.entityList)
      }
    },
  },
}
</script>
<style lang="scss" scoped>
.select-tree {
  width: 100%;
}
</style>
<style  lang="scss">
@import url('../css/common.scss');

</style>
