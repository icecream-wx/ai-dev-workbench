<template>
  <div :key="currentKey" class="select-main custom-select-main-sj">
    <DisplayInput
      :cloneEntityModel="cloneEntityModel"
      v-bind="{ ...$props, ...$attrs }"
      :multiple="isMultiple"
      :disabled="finalDisabled"
      @selectTreeChange="handleTreeChange"
    />
    <div v-if="mode === 'edit'">
      <null-value v-if="!value && finalDisabled" :disabled="finalDisabled" :readonly="readonly"/>
      <template v-else>
        <SelectTree
        ref="select-tree"
        v-if="isTreeMode"
        @selectTreeChange="handleTreeChange"
        v-bind="{ ...$props, ...$attrs }"
        :staticTreeData="staticTreeData"
        :cloneEntityModel="cloneEntityModel"
        :isFilterable="isFilterable"
        :disabled="finalDisabled"
        :clearable="isClearable"
        :optionTemplateIsEnable="optionTemplateIsEnable"
      >
        <template #default="{ data, labelField: lf, settings: st, isJSON: ij }">
          <slot :data="data" :labelField="lf" :settings="st" :isJSON="ij"></slot>
        </template>
      </SelectTree>
      <CasTree
        v-else
        v-bind="{ ...$props, ...$attrs }"
        :staticTreeData="staticTreeData"
        :cloneEntityModel="cloneEntityModel"
        :isFilterable="isFilterable"
        :disabled="finalDisabled"
        :clearable="isClearable"
        :staticList="staticList"
        @changeCasValue="handleChangeCasValue"
      >
        <template #default="{ data, labelField: lf, settings: st, isJSON: ij }">
          <slot :data="data" :labelField="lf" :settings="st" :isJSON="ij"></slot>
        </template>
      </CasTree>
    </template>
    </div>
  </div>
</template>

<script>
import { cloneDeep } from 'lodash'
import datasource from '../mixins/datasource.js'
import DisplayInput from './comp/display-input.vue'
import SelectTree from './comp/select-tree.vue'
import CasTree from './comp/cas-tree.vue'
import { transNodes } from './utils/allMode.js'
import { getAllPathByIdUtil, getBrothersByIdUtil } from './utils/searchTree.js'
import { useCommon } from './useCommon.js'
import { useEntity } from './useEntity.js'

/**
 * 树形选择器组件，基于 el-tree-select 封装，支持树形数据结构和多级选择
 */
export default {
  name: 'pm-select-tree',
  mixins: [datasource],
  components: { DisplayInput, SelectTree, CasTree },
  emits: ['update:modelValue', 'update:entityModel', 'update:displayField', 'update:selected', 'selectedSuccess', 'allowSelect', 'getCondition', 'change'],
  props: {
    entityModel: { default: null },
    isEntityAllSearch: { default: false },
    settings: { type: Object, default: () => ({}) },
    placeholder: { type: String, default: () => '请输入' },
    selected: { default: undefined },
  },
  setup() {
    const common = useCommon()
    const entity = useEntity()
    return { ...common, ...entity }
  },
  data() {
    return {
      currentKey: Date.now(),
      dicTreeData: [],
      dicEntryList: [],
      entityTreeData: [],
      entityList: [],
      cloneEntityModel: null,
      lazyList: [],
      isChangeByUser: false,
      execute: true,
    }
  },
  computed: {
    staticList() {
      return (this.isJSON && this.jsonTreeList) || (this.isDic && this.dicEntryList) || (this.isEntityData && this.lazyList) || []
    },
    staticTreeData() {
      if (this.isJSON) return this.jsonTreeData || []
      else if (this.isDic) return this.dicTreeData
      else if (!!this.isEntityAllSearch) return this.entityTreeData
    },
  },
  watch: {
    mode: {
      immediate: true,
      deep: true,
      handler(val, oVal) {
        if (val !== oVal && val === 'edit' && oVal === 'view') this.initTree()
      },
    },
    settings: {
      immediate: true,
      deep: true,
      handler(val, oVal) {
        const oldCondition = sessionStorage.getItem('conditionStr')
        const newConditionStr = this.getConditionValueStr(val)
        if (JSON.stringify(val) !== JSON.stringify(oVal) || oldCondition !== newConditionStr) {
          sessionStorage.setItem('conditionStr', newConditionStr)
          setTimeout(() => { val && oVal && this.init() }, 100)
        }
      },
    },
    _value: {
      immediate: true,
      deep: true,
      handler(val) {
        if (!val) {
          this.initTree()
          this.cloneEntityModel = []
        } else if (val) {
          this.init()
        }
      },
    },
  },
  methods: {
    async initTree() {
      if (this.isChangeByUser) return
      if ((this.readonly || this.disabled) && !this.getValIsEmpty(this.entityModel, this.valueField)) return
      if (!!this.isEntityAllSearch && this.mode === 'edit' && this.isEntityData) {
        const { tree, list: treeList } = await this.getAllEntityData(this.configEntityList, this.settings)
        this.entityTreeData = tree
        this.entityList = treeList
      }
      if (this.mode === 'edit' && this.isDic) {
        const { value } = this.settings.dicPanel
        const { tree, list } = await this.getDicTreeAndList(value)
        this.dicEntryList = list
        this.dicTreeData = tree
      }
    },
    async init() {
      let allList = []
      await this.initTree()
      if (this.isJSON || this.isDic) {
        if (this.isJSON) allList = cloneDeep(this.jsonTreeList)
        else if (this.isDic) allList = this.dicEntryList

        if (this.isDic && !this.getValIsEmpty(this.entityModel, this.valueField)) {
          this.cloneEntityModel = this.entityModel
        } else {
          this.cloneEntityModel = this.getValueArr((this._value && this._value.split(',')) || '', allList)
        }
        if (this.isAllMode && this.mode === 'edit') {
          const result = transNodes(this.cloneEntityModel, {
            labelField: this.labelField, isAllMode: this.isAllMode,
            separator: this.separator, staticList: this.staticList, isEntityData: this.isEntityData,
          })
          this.cloneEntityModel = result
        }
      } else {
        const isAllModeAndHaveData = !this.getValIsEmpty(this.entityModel, this.valueField) && this.isEntityData && this.isAllMode && this.mode === 'edit'
        if (this._value && this.getValIsEmpty(this.entityModel, this.valueField)) {
          const { entityName } = this.configEntityList.find(item => item.name === this.checkNodeType) || {}
          if (entityName) {
            const res = await this.queryEntityByValue(this.valueField, this.labelField, this._value, entityName)
            this.cloneEntityModel = this.isMultiple ? res : res[0]
            return
          }
        }
        if (isAllModeAndHaveData) {
          let list = []
          if (this.isEntityAllSearch) list = this.entityList
          else if (this.isSelfCorrelation) list = await this.getSelfStaticList(this.entityModel, this.configEntityList)
          else list = await this.getStaticEntityList(this.entityModel, this.configEntityList)
          this.lazyList = list
          const transModel = this.isEntityData ? this.transEntityModel(this.entityModel, this.configEntityList) : this.entityModel
          this.cloneEntityModel = transNodes(transModel, {
            isEntityData: this.isEntityData, labelField: this.labelField,
            isAllMode: this.isAllMode, separator: this.separator, staticList: list,
          })
        } else {
          this.cloneEntityModel = this.entityModel
        }
      }
    },
    getConditionValueStr(setting) {
      const { condition } = setting || {}
      const { and, or } = condition || {}
      const { items: andItems = [] } = and || {}
      const { items: orItems = [] } = or || {}
      return andItems.concat(orItems).map(ele => ele.propertyValue.op + ele.propertyValue.value).join(',')
    },
    async handleChangeCasValue(val, entityList) {
      this.isChangeByUser = true
      let arr = cloneDeep(val)
      if (!val || val.length === 0) {
        this.cloneEntityModel = []
        this.$emit('update:entityModel', {})
        this.$emit('update:cloneEntityModel', null)
        this.$emit('update:modelValue', null)
        this.$emit('selectedSuccess', null)
      } else {
        if (this.isMultiple) arr = val.map(item => item[item.length - 1])
        else arr = [val[val.length - 1]]

        let list = []
        if (this.isDic) list = cloneDeep(this.dicEntryList)
        else if (this.isJSON) list = cloneDeep(this.jsonTreeList)
        else list = this.entityList.length ? this.entityList : cloneDeep(entityList)

        const leafNodeList = this.isEntityData
          ? list.filter(item => arr.includes(item[this.valueField]) && item.type === this.checkNodeType)
          : this.getValueArr(arr, list)

        let allowLeafNodeList = []
        for (let i = 0; i < leafNodeList.length; i++) {
          const isAllow = this.getIsAllowSelect(leafNodeList[i])
          if (isAllow || typeof isAllow !== 'boolean') allowLeafNodeList.push(leafNodeList[i])
        }
        this.handleTreeChange(allowLeafNodeList, list)
      }
    },
    handleTreeChange(arr, lazyList) {
      this.isChangeByUser = true
      const value = arr ? (Array.isArray(arr) ? arr.map(item => item[this.valueField] || item) : arr[this.valueField]) : null
      // value 是 props，Vue3 下不允许直接赋值，用局部变量记账并向下 emit
      const finalValue = Array.isArray(value) ? value.join(',') : value
      this.lazyList = this.isEntityAllSearch ? this.entityList : this.lazyList.concat(lazyList)
      const setting = {
        labelField: this.labelField, isAllMode: this.isAllMode, separator: this.separator,
        staticList: (this.isJSON && this.jsonTreeList) || (this.isDic && this.dicEntryList) || (this.isEntityData && this.lazyList),
      }
      const result = transNodes(arr, { ...setting, isKeepName: true })
      if (this.isAllMode) {
        const resultDisplay = transNodes(arr, { ...setting })
        let displayField = Array.isArray(resultDisplay) ? resultDisplay.map(ele => ele[this.labelField]).join('   ') : resultDisplay[this.labelField]
        this.$emit('update:displayField', displayField)
      }
      if (!this.isMultiple && !this.isTreeMode) {
        this.$emit('update:entityModel', result[0] || {})
      } else {
        this.$emit('update:entityModel', result || {})
      }
      this.$emit('update:modelValue', finalValue)
      this.$emit('update:selected', result)
      this.$emit('selectedSuccess', result)
    },
    getAllPathByKey(id) { getAllPathByIdUtil(id, this.staticTreeData) },
    getBrothersById(id) { getBrothersByIdUtil(id, this.staticTreeData) },
    refresh() { this.currentKey = Date.now() },
    reloadParent(node) { this.$refs['select-tree']?.reloadParent?.(node) },
    reloadChildren(node) { this.$refs['select-tree']?.reloadChildren?.(node) },
    expand(node, state) { this.$refs['select-tree']?.expand?.(node, state) },
    expandAll(state) { this.$refs['select-tree']?.expandAll?.(state) },
  },
}
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
.custom-select-main-sj {
  position: relative;
  /* 预览接入：el-form-item__content 是 flex，默认会收缩到内容宽度 */
  width: 100%;
}
</style>
