<template>
  <div :key="currentKey" :class="selectTreeClassName" >
    <!-- 层级-动态 -->
    <el-cascader
      :separator="separator"
      :value="cascaderValue"
      @change="handleChangeCasValue"
      :show-all-levels="isAllMode"
      style="width: 100%"
      ref="cascaderSelect"
      v-if="isShowDynamic"
      :props="{
        ...cascaderProps,
        value: this.valueField,
        label: this.labelField,
        checkStrictly: this.isCheckStrictly,
      }"
      :filterable="isFilterable"
      :disabled="disabled"
      :clearable="clearable"
      @input="filterNode"
      :placeholder="getPlaceholder() || i18n(placeholder)"
      @visible-change="handleVisibleChange"
    >
      <template #default="{ node, data }">
        <TreeOption :node="node" :data="data" v-bind="$props" :filterEntityText="filterEntityText" >
          <template #default="{ data, labelField, settings, isJSON }">
            <slot :data="data" :labelField="labelField" :settings="settings" :isJSON="isJSON"></slot>
          </template>
        </TreeOption>
      </template>
    </el-cascader>
    <!-- 层级-静态 -->
    <el-cascader
      v-else
      :separator="separator"
      ref="cascaderSelect"
      :value="cascaderValue"
      @change="handleChangeCasValue"
      :show-all-levels="isAllMode"
      style="width: 100%"
      :options="isEntityData && filterEntityText && !isEntityAllSearch ? filterEntityList : staticTreeData"
      :filterable="isFilterable"
      :props="{
        multiple: this.multiple,
        value: this.valueField,
        label: this.labelField,
        checkStrictly: this.isCheckStrictly,
      }"
      :disabled="disabled"
      :clearable="clearable"
      :placeholder="getPlaceholder() || placeholder"
      @visible-change="handleVisibleChange"
    >
      <template #default="{ node, data }">
        <TreeOption :node="node" :data="data" v-bind="$props" :filterEntityText="filterEntityText" >
          <template #default="{ data, labelField, settings, isJSON }">
            <slot :data="data" :labelField="labelField" :settings="settings" :isJSON="isJSON"></slot>
          </template>
        </TreeOption>
      </template>
    </el-cascader>
  </div>
</template>

<script>
import { concat, cloneDeep, debounce } from 'lodash'
import common from '../common'
import TreeOption from './tree-option.vue'
import { transCasNode } from '../utils/allMode'
export default {
  name: 'tree-select',
  components: { TreeOption },
  mixins: [common],
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
    staticList: {
      type: Array,
      default: () => [],
    },
    settings: {
      type: Object,
      default: () => ({}),
    },
    cloneEntityModel: {
      // type: Object,
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
    multiple: {
      type: Boolean,
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
    checkStrictly: {
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
      const name = this.getPlaceholder() ? 'select-tree custom-placeholder' : 'select-tree'
      return this.isHighlight ? name + ' select-tree-light' : name
    },
    isShowDynamic() {
      return this.isEntityData && (this.isStaticTreeSearch  || !this.filterEntityText) && !this.isEntityAllSearch
    }
  },
  data() {
    return {
      finalName: null, //展示勾选字段
      checkedKeys: [], //回显勾选
      cascaderProps: {
        //层级面板配置
        lazy: true,
        multiple: this.multiple,
        value: 'value',
        label: 'label',
        leaf: 'isLeaf',
        lazyLoad: (node, resolve) => {
          this.loadNode(node, resolve)
        },
      },
      currentKey: new Date().getTime(),
      entityList: [],
      cascaderValue: null,
      isAllow: null,
      isSelectAll: false, //静态数据全选
      filterEntityText: '',
      filterEntityList: [],
      node: null,
      resolve: null,
    }
  },
  watch: {
    cloneEntityModel: {
      immediate: true,
      handler(val) {
        if (!this.getValIsEmpty(val)) {
          // 回显值
          const list = Array.isArray(val) ? val : [val]
          const setting = {
            labelField: this.labelField,
            valueField: this.valueField,
            isAllMode: this.isAllMode,
            multiple: this.multiple,
            separator: this.separator,
            staticList: this.staticList
          }
            
          const result = transCasNode(list, setting)
          this.cascaderValue = result
        } else {
          this.cascaderValue = null
        }
      },
    },
  },
  mounted() {},
  methods: {
    handleVisibleChange(isVisible) {
      if(isVisible) {
        return
      }
      setTimeout(()=>{
        this.filterEntityText = ''
      }, 300)
    },
    handleChangeCasValue($event) {
      if(Array.isArray($event)) {
        this.$emit('changeCasValue', $event, this.entityList)
        // this.$nextTick(()=>this.filterEntityText = '')
      }
    },
    async filterNode(event, value) {
      this.filterEntityText = (event && event.target && event.target.value) || value
      if (this.isEntityData) {
        if (this.filterEntityText && !this.isStaticTreeSearch) {
          this.filterEntityList = await this.getDataByFilter(this.filterEntityText)
          this.entityList = this.filterEntityList
        } else {
          // this.loadNode(this.node, this.resolve)
        }
        return
      }
    },
    getPlaceholder() {
      let models = (Array.isArray(this.cloneEntityModel) && this.cloneEntityModel) || (this.cloneEntityModel && [this.cloneEntityModel]) || []
      const result = models.map(ele => typeof ele === 'object' && ele[this.labelField]).filter(item => item)
      return result.join('  ')
    },
    async loadNode(node, resolve) {
      const { level } = node
      if (level === 0) {
        this.node = node
        this.resolve = resolve
      }
      if ((this.configEntityList && level < this.configEntityList.length) || this.isSelfCorrelation) {
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
      //查找多层 进行拼接f
      let cascaderPanelArray = this.configEntityList.filter(item => item.level === index + 1)
      let totalData = []
      if (this.isSelfCorrelation) {
        let cascaderPanel = this.configEntityList[0]
        let cascaderPanel_parent = this.configEntityList[0]
        let resp = await this.getData(cascaderPanel_parent, cascaderPanel, index, node)
        totalData = concat(totalData, resp)
      } else {
        for (let item of cascaderPanelArray) {
          let cascaderPanel = item
          let cascaderPanel_parent = this.configEntityList.find(item => item.level === index)
          let resp = await this.getData(cascaderPanel_parent, cascaderPanel, index, node)
          totalData = concat(totalData, resp)
        }
      }
      return totalData
    },
  },
}
</script>
<style lang="scss">
@import url('../css/common.scss');
</style>
