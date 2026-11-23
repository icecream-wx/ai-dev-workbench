import { cloneDeep, get, has, isArray, isEqual, isString, set, debounce } from "lodash"
import md5 from "md5"
import { getBackgrouncolor, getFontColor, findAppName, getQueryVariable, isEmpty } from "../../utils/util"
import { getCurrentInstance } from "vue"
import { useDispatchProxy, useControllers } from '../../composables/useDispatchProxy'

const cache = new Map()
const CACHE_MAX = 200

export default {
  props: {
    /**
     * 组件模式
     * @type {String}
     * @values edit, view
     * @default edit
     * @description edit 为编辑模式，view 为只读展示模式
     */
    mode: {
      default: "edit",
    },
    /**
     * 选择器配置项
     * @type {Object}
     * @property {String} type - 数据源类型 (dict/entity/mdmDict/mdmModel/mdmCode)
     * @property {String} labelField - 显示字段名 (默认: label)
     * @property {String} valueField - 值字段名 (默认: value)
     * @property {String} dictShowField - 字典显示字段
     * @property {String} modelShowField - 模型显示字段
     * @property {String} bindType - 绑定类型 (默认: value)
     * @property {Array} options - 静态选项数据 [{label, value, disabled, color}]
     * @property {String} condition - 查询条件
     * @property {String} entity - 实体名称
     * @property {Boolean} selectDisabled - 是否禁用选择
     * @property {String} mdmDictType - MDM字典类型 (TREE/LIST)
     * @property {String} persistenceField - 持久化字段名
     * @property {Object} servicePanel - 服务面板配置
     */
    settings: {
      type: Object,
      default: () => ({}),
    },
    /**
     * 选择器的值，支持 v-model 双向绑定
     * @type {String|Number|Array}
     */
    value: {
      default: null,
    },
    modelValue: {
      default: undefined,
    },
    /**
     * 选项无匹配值时是否清空
     * @type {Boolean}
     * @default true
     */
    cleanWhenNoMatch: {
      default: true,
    },
    /**
     * 多选时的分隔符
     * @type {String}
     * @default ,
     */
    separator: {
      default: ",",
    },
    /**
     * 实体模型对象
     * @type {Object}
     */
    entityModel: {
      default: null,
    },
    /**
     * 是否在子表格中
     * @type {Boolean}
     * @default false
     */
    isInChildren: {
      default: false,
    },
    /**
     * 是否只读
     * @type {Boolean}
     * @default false
     */
    readonly: {
      default: false,
    },
    /**
     * 是否禁用
     * @type {Boolean}
     * @default false
     */
    disabled: {
      type: Boolean,
      default: false,
    },
    /**
     * 是否高亮显示选中项
     * @type {Boolean}
     * @default false
     */
    isHighlight: {
      type: Boolean,
      default: false,
    },
    /**
     * 持久化值
     * @type {String|Number}
     */
    persistenceValue:{
      default: null,
    },
    /**
     * 多列配置
     * @type {Object}
     */
    mulColumns:{
      type: Object,
      default: () => ({}),
    },
    /**
     * 是否启用选项模板
     * @type {Boolean}
     * @default false
     */
    optionTemplateIsEnable:{
      type: Boolean,
      default: false,
    },
    /**
     * 禁用过滤函数
     * @type {Function}
     */
    disableFilter:{
      type:Function,
      default: null,
    },
    /**
     * 时间区间最大值
     * @type {String}
     */
    maxValue:{
      type:String,
      default: null,
    },
    /**
     * 时间区间最小值
     * @type {String}
     */
    minValue:{
      type:String,
      default: null,
    },
    /**
     * MDM引用标识
     * @type {String}
     */
    mdm_ref:{
      type:String,
      default: null,
    },
    /**
     * 第二个占位符文本
     * @type {String}
     */
    placeholder2:{
      type:String,
      default: '',
    },
    /**
     * 是否显示快捷选项
     * @type {Boolean}
     * @default false
     */
    shortcuts:{
      type: Boolean,
      default: false,
    },
    /**
     * 最大选项数量
     * @type {Number}
     * @default 200
     */
    maxOptions: {
      default: 200
    },
    //动态查询；查询和搜索时调用后端 最大加载200条
    isDynamicSearch:{
      type: Boolean,
      default: false,
    },
    //显示lablen js
    lableJs:{
      type: String,
      default: ""
    },
    lableJsEnable:{
      type: Boolean,
      default: false,
    },
    isSelectedTop:{
      type: Boolean,
      default: false,
    }
  },

  data() {
    return {
      options: null,
      loading: false,
      test: [],
      nullEntityModel: { id: null },
      lastFilter: null,
      isFirstChange: 0,
      dataId: null,
      keyId: "0",
      colors: [],
      getFontColor: getFontColor,
      getBackgrouncolor: getBackgrouncolor,
      filters: {
        hidden:null,
        hiddenKey:null,
        disabled:null,
        disabledKey:null,
      },
      searchKey: null,
      emptyArr: []
    }
  },
  created() {
    this.keyId = "id" + Math.floor(Math.random() * 10000)
  },
  mounted() {
    this.$nextTick(() => {
      this.setTaghighLightClass(this.entityModel)
    })
  },
  computed: {
    realOptionsFilter(){
      const sortedOptions = this.sortSelectedTopOptions(this.optionsFilter)
      if(sortedOptions.length > this.maxOptions && !this.isDynamicSearch){
        return sortedOptions.slice(0,this.maxOptions)
      }else {
        return sortedOptions
      }
    },
    optionsFilter(){
      if(!this.options) {
        return []
      }
      if(this.filters.hidden && this.filters.hiddenKey){
        if(typeof this.filters.hidden === 'function' ){
          return this.getOptionsBySearchKey(this.options.filter((op) => !this.filters.hidden(op)))
        } else if(Array.isArray(this.filters.hidden)){
          const {  valueField } = this.settings
          return this.getOptionsBySearchKey(this.options.filter(op => !this.filters.hidden.includes(this.getValue(op, valueField))))
        }
      }
      if(this.filters.disabled && this.filters.disabledKey){
        if(typeof this.filters.disabled === 'function' ){
          return this.getOptionsBySearchKey(this.options.map(op => {
            let disabled = this.filters.disabled(op)
            return {
              ...op,
              disabled
            }
          }))
        } else if (Array.isArray(this.filters.disabled)){
          const {  valueField } = this.settings
          return this.getOptionsBySearchKey(this.options.map(op => {
            let disabled = this.filters.disabled.includes(this.getValue(op, valueField))
            return {
              ...op,
              disabled
            }
          }))
        }
      }
      return this.getOptionsBySearchKey(this.options)
    },
    parentCodeIsNullDisabled(){
      // debugger
        const { type, selectDisabled } = this.settings
        if (type === "dict") {
          if(selectDisabled){
            return (!this.parentCode ||
              this.parentCode === "" ||
              this.parentCode === "null" ||
              this.parentCode === "undefined")
          }else{
            return false
          }
        } else if(type === "entity"){
          if(this.entityNullDisabled){
            return true
          } else {
            return false
          }
        }
    },
    finalDisabled() {
      // 综合计算最终的disabled 状态
      if (this.disabled || this.readonly) {
        // 外部控制优先级最高, 且不需要做任何操作
        return true
      }
      if(!this.settings) {
        return
      }
      const { type, selectDisabled, condition } = this.settings
      let disabled = false
      if (selectDisabled) {
        if (
          type === "dict" &&
          (!this.parentCode ||
            this.parentCode === "" ||
            this.parentCode === "null" ||
            this.parentCode === "undefined")
        ) {
          // 需要判断勾选了“过滤条件为空时禁用”
          if (selectDisabled) {
            disabled = true
            this.$emit("input", '')
            this.$emit("update:modelValue", '')
          }
        } else if (type === "entity") {
          disabled = this.entityNullDisabled
        }
      }
      return disabled
    },

    entityNullDisabled(){
      const { type, selectDisabled, condition } = this.settings
      let disabled = false
      // 暂时只处理了“且”的场景
      let finalCondition = get(condition, "and.items", [])
      const hasNonValue = finalCondition.some((c) => {
        let propertyValueIsNull = !c.propertyValue || c.propertyValue === ""
        // 如果绑定的是对象
        if (
          Object.prototype.toString.call(c.propertyValue) ===
          "[object Object]"
        ) {
          propertyValueIsNull = Object.keys(c.propertyValue).every(
            (key) => !c.propertyValue[key]
          )
        }
        return propertyValueIsNull
      })
      if (finalCondition.length && hasNonValue) {
        let bindValueIsNull = !this._value
        if (
          Object.prototype.toString.call(this._value) === "[object Object]"
        ) {
          bindValueIsNull = Object.keys(this._value).every(
            (key) => !this._value[key]
          )
        }
        if (selectDisabled) {
          disabled = true
          this.$emit("input", null)
          this.$emit("update:modelValue", null)
        }
      }
      return disabled
    },

    isMultiple() {
      return (
        this.$attrs.multiple || this.$attrs.multiple === "" || this.isCheckbox
      )
    },
    isFilterable() {
      return this.$attrs.filterable || this.$attrs.filterable === ""
    },
    isClearable() {
      return this.$attrs.clearable || this.$attrs.clearable === ""
    },
    isSelect() {
      const tag = this.$options?.name || this.$options?._componentTag || ''
      return tag === 'PmSelect' || tag === 'pm-select'
    },
    isSelectTree() {
      const tag = this.$options?.name || this.$options?._componentTag || ''
      return tag === 'PmSelectTree' || tag === 'pm-select-tree' || tag === 'PC' || tag === 'PCT'
    },
    isCheckbox() {
      const tag = this.$options?.name || this.$options?._componentTag || ''
      return tag === 'PmCheckboxGroup' || tag === 'pm-checkbox-group'
    },
    showContentMobile() {
      // 如果绑定的是对象, 直接显示 label 字段
      let content = ''
   
      if (Array.isArray(this.valueKey)) {
        if (this.options) {
          content = this.options
            .filter((item) => this.valueKey.includes(item.value))
            .map((item) => item.customLable || item.label)
            .join(this.separator)
        }
      } else {
        const selectedItem =
          this.options &&
          this.options.find((item) => item.value === this.valueKey)
          content = selectedItem ? selectedItem.customLable || selectedItem.label : ""
      }
      if (this.settings) {
        let { bindType = "value", labelField,dictShowField,modelShowField,options} = this.settings
        if (bindType === "entity") {
          if (Array.isArray(this.entityModel)) {
            content = this.entityModel
              .map((em) => this.getLabel(em, labelField, ""))
              .join(this.separator)
          }
          content = this.entityModel
            ? this.getLabel(this.entityModel, labelField, "")
            : null
        }
        if (this.settings.type === "mdmDict") {
          if (Array.isArray(this.entityModel)) {
            if(this.isMultiple && this.settings.mdmDictType === 'TREE') {
              content = this.showTextRef
            } else {
              content = this.entityModel
                .map((em) => this.getLabel(em, dictShowField, ""))
                .join(this.separator)
            }
          }else{
            content = this.entityModel
              ? this.getLabel(this.entityModel, dictShowField, "")
              : null
          }
        }
        if (this.settings.type === "mdmModel") {
          if (Array.isArray(this.entityModel)) {
            content = this.entityModel
              .map((em) => this.getLabel(em, modelShowField, ""))
              .join(this.separator)
          }else{
            content = this.entityModel
              ? this.getLabel(this.entityModel, modelShowField, "")
              : null
          }
        }
        //静态数据处理
        if(options && Array.isArray(options)){
          if (Array.isArray(this.valueKey)) {
            if (this.options) {
              content = this.options
                .filter((item) => this.valueKey.includes(item.value))
                .map((em) => this.getLabel(em, labelField, ""))
                .join(this.separator)
            }
          }else {
            const selectedItem =
              this.options &&
              this.options.find((item) => item.value === this.valueKey)
              if(selectedItem && !this.isHighlight){
                content =  this.getLabel(selectedItem, labelField, "")
              }
          }
        } 
      }
      return content 

    },
    showContent() {
      // 如果绑定的是对象, 直接显示 label 字段
      let content = ''
      if (Array.isArray(this.valueKey)) {
        if (this.options) {
          content = this.options
            .filter((item) => this.valueKey.includes(item.value))
            // .map((item) => item.label)
            // .join(this.separator)
        }
      } else {
        const selectedItem =
          this.options &&
          this.options.find((item) => item.value == this.valueKey)
          content = selectedItem 
      }
      if (this.settings) {
        let { bindType = "value", labelField, dictShowField,modelShowField,options} = this.settings
        if (bindType === "entity") {
          if (Array.isArray(this.entityModel)) {
            content = this.entityModel
              .map((em) => this.getLabel(em, labelField, ""))
              .join(this.separator)
          }else{
            content = this.entityModel
              ? this.getLabel(this.entityModel, labelField, "")
              : null
          }
        }
        if (this.settings.type === "mdmDict") {
          if (Array.isArray(this.entityModel)) {
            if(this.isMultiple && this.settings.mdmDictType === 'TREE') {
              content = this.showTextRef
            } else {
              content = this.entityModel
                .map((em) => this.getLabel(em, dictShowField, ""))
                .join(this.separator)
            }
          }else{
            content = this.entityModel
              ? this.getLabel(this.entityModel, dictShowField, "")
              : null
          }
        }
        if (this.settings.type === "mdmModel") {
          if (Array.isArray(this.entityModel)) {
            content = this.entityModel
              .map((em) => this.getLabel(em, modelShowField, ""))
              .join(this.separator)
          }else{
            content = this.entityModel
              ? this.getLabel(this.entityModel, modelShowField, "")
              : null
          }
        }
        //静态数据处理
        if(options && Array.isArray(options)){
          if (Array.isArray(this.valueKey)) {
            if (this.options) {
              content = this.options.filter((item) => this.valueKey.includes(item.value))
              if(!this.isHighlight){
                content = content.map((em) => this.getLabel(em, labelField, "")).join(this.separator)
              }  
            }
          }else {
            const selectedItem =
              this.options &&
              this.options.find((item) => item.value == this.valueKey)
              if(selectedItem && !this.isHighlight){
                content =  this.getLabel(selectedItem, labelField, "")
              }
          }
        } 
      }
      return content 
    },
    contents() {
      return Array.isArray(this.showContent) ? this.showContent : [this.showContent]
    },
    _value() {
      return this.modelValue !== undefined ? this.modelValue : this.value
    },
    valueIsObject() {
      return (
        !Array.isArray(this._value) &&
        Object.prototype.toString.call(this._value) === "[object Object]"
      )
    },
    valueKey: {
      get() {
        let value = cloneDeep(this._value)
        if(typeof(this._value) === 'number'){
          value +="" 
        }
        let { valueField } = this.settings
        if (this.valueIsObject) {
          return value ? value[valueField] : null
        } else {
          if (this.isMultiple) {
            if (value) {
              if (Array.isArray(value)) {
                return value
              } else {
                return value.toString().split(this.separator)
              }
            } else {
              return this.emptyArr
            }
          } else {
            return value
          }
        }
      },
      set(val) {
        let { bindType = "value", type } = this.settings
        const emitValue = (v) => {
          this.$emit("input", v)
          this.$emit("update:modelValue", v)
        }
        if (bindType === "entity") {
          if (val === null || val === undefined || val === '') {
            this.updateEntityModelById(null,cloneDeep(this.nullEntityModel))
            emitValue(cloneDeep(this.nullEntityModel) || null)
          } else {
            this.updateEntityModelById(val)
            if (Array.isArray(val)) {
              emitValue(val.join(this.separator) || null)
            } else {
              emitValue(
                cloneDeep(
                  get(
                    this.options &&
                      this.options.find((item) => item.value === val),
                    "_data",
                    null
                  )
                )
              )
            }
          }
        } else {
          if(!['mdmDict', 'mdmModel'].includes(type)){
            this.updateEntityModelById(Array.isArray(val) ? val : [val])
          }
          if (Array.isArray(val) && val) {
            emitValue(val.join(this.separator) || null)
          } else {
            emitValue(val || null)
          }
        }
        if (this.$attrs?.onChange || this.$attrs?.onchange) {
          this.$emit("change", val)
        }
      },
    },
    selectedItem() {
      return this.options
        ? this.options.filter((item) =>
            Array.isArray(this.valueKey)
              ? this.valueKey.includes(item.value)
              : item.value === this.valueKey
          )
        : []
    },
    dispatchProxy() {
      const { dispatchProxy } = useDispatchProxy(this)
      if (dispatchProxy) {
        return dispatchProxy
      } else {
        return this.dispatch || ((action, params) => Promise.resolve())
      }
    },
    bus() {
      const inst = getCurrentInstance()
      const gp = inst?.appContext?.config?.globalProperties
      return gp?.$bus || gp?.BaseBus
    },
    parentCode(){
      // // debugger
      if(has(this.settings,'parentCode.value')){
        return get(this.settings,'parentCode.value',null)
      }else{
        return get(this.settings,'parentCode',null)
      }
    }
  },
  watch: {
    settings: {
      immediate: true,
      handler(val, oVal){
        if(this.isFirstChange > 0 && isEqual(val,oVal)){
          return
        }
        //解决下拉多选时选择后，下拉选项只显示了选择的数据
        if(this.$attrs.isMobile && this.isMultiple && this.mobileConfirmed && val && oVal && JSON.stringify(val) === JSON.stringify(oVal)){
          return
        }
        const newDataId = md5(JSON.stringify(val)).substring(0, 10)
        const {valueField = 'id'}  = val
        const filterIsChange = this.dataId !== newDataId
        this.dataId = newDataId
        if (this.isFirstChange === 0) { //第一次调用
          if (this.mode === 'view' && this.$props && this.$props.selected !== undefined) {
            this.showAll = false
            this.isFirstChange++
            return
          }
          // 默认有缓存
          if(!val.noCache){
            if (
              this.isSelect &&
              (this._value === null || this._value[valueField] === null  || Array.isArray(this._value) && this._value.length === 0)
            ) { // 性能优化， select组件 value 为空时不查询 options，
              // this.isFirstChange ++
              return
            }
          } else {
            this.dataId = null
          }
          this.showAll = false
          this.isFirstChange++
          this.debInitDefault()
        } else if (filterIsChange) {
          if(!this.parentCodeIsNullDisabled){
            this.initDefault(false)
          }
          this.isLoadRemoteData = true
        }
      },
    },
    value: {
      immediate:true,
      handler(val){
        this._onValueChanged(val)
      }
    },
    modelValue: {
      immediate: false,
      handler(val) {
        this._onValueChanged(val)
      }
    },
    entityModel: {
      deep: true,
      handler(val) {
        this.setEntityModelCustomLable()
        if(this.settings.persistenceField){
          this.setPersistenceValue(val)
        }
        this.setTaghighLightClass(val)
        //解决根据entityModel设置options，entityModel变化但是options没有更新问题
        let { valueField = 'id' ,type} = this.settings
        if(type === 'dict'){valueField = 'code'}
        if(!Array.isArray(val) && this._value && val[valueField] &&
          Object.prototype.toString.call(val) === "[object Object]" && this.options && this.options.findIndex(item=>item.value+"" === val[valueField]+"") == -1){
            this.options = []
            this.setOptionsByEntityModel()
          }
      },
    },
  },
  methods: {
    _onValueChanged(val) {
      if(!this.settings) {
        return
      }
      const { type, selectDisabled, condition, bindType = 'value' } = this.settings
      const valueField = type === 'dict' ? 'code' : this.settings.valueField
      if (val !==  null) {
        if (selectDisabled && !this.disabled && !this.readonly) {
          if (type === "entity") {
            let finalCondition = get(condition, "and.items", [])
            this.$attrs.disable = finalCondition.some((c) => {
              let valueIsNull = !c.propertyValue || c.propertyValue === ""
              if (
                Object.prototype.toString.call(c.propertyValue) ===
                "[object Object]"
              ) {
                valueIsNull = Object.keys(c.propertyValue).every(
                  (key) => !c.propertyValue[key]
                )
              }
              return valueIsNull
            })
          } else if (type === "dict" && !this.parentCode) {
            this.$attrs.disabled = true
          }
        }
        if(!(this.mode === 'view' && this.selected !== undefined) && bindType !== "entity" && !['mdmDict', 'mdmModel'].includes(type) && !this.valueInEntityModel(val) && !this.valueInOptions(val) && !this.isSelectTree){
          this.debInitDefault()
          const valueKeyList = val.toString().split(this.separator)
          this.updateEntityModelById(valueKeyList)
        }
        if (bindType !== "entity" && !['mdmDict', 'mdmModel'].includes(type)) {
          if (val === null || val === undefined || val === "") {
            this.$emit("update:entityModel", this.isMultiple ? [] : cloneDeep(this.nullEntityModel))
          } else if (this.options && !this.isEntityModelMatchedValue()) {
            this.updateEntityModelById(Array.isArray(this.valueKey) ? this.valueKey : [this.valueKey])
          }
        }

        this.$emit('update:persistenceValue', null)
        if(this.$attrs.isMobile && this.isMultiple){
          const valueKeyList = this._value.toString().split(this.separator)
          this.selected = valueKeyList.map(i=>{
            return {
              value:i
            }
          })
        }
      }
      if(this.isHighlight){
        if(type === 'custom'){
          this.setcustomHighlight()
        }         
        this.setTaghighLightClass()
      }
    },
    buildOrderPropertyNames(sortFields = [], sortField, isSortByAsc) {
      if (Array.isArray(sortFields) && sortFields.length > 0) {
        const orderItems = sortFields
          .filter((item) => item && item.field)
          .map((item) => `${item.field}:${item.order === "desc" ? "desc" : "asc"}`)
        if (orderItems.length > 0) {
          return orderItems.join(",")
        }
      }
      if (sortField) {
        return `${sortField}:${isSortByAsc ? "asc" : "desc"}`
      }
      return ""
    },
    getAppName() {
      return getQueryVariable('appName') || findAppName(this)
    },
    getOptionsBySearchKey(list){
      if(this.searchKey) {
        return list.filter(op => op?.label?.indexOf(this.searchKey) > -1)
      } else {
        return list
      }
    },
    sortSelectedTopOptions(list = []) {
      if (
        !this.isSelectedTop ||
        !this.isMultiple ||
        !Array.isArray(this.valueKey)
      ) {
        return list
      }
      const optionMap = new Map(list.map((item) => [String(item.value), item]))
      const selectedOptions = this.valueKey
        .map((value) => optionMap.get(String(value)))
        .filter(Boolean)
      const selectedValueSet = new Set(
        selectedOptions.map((item) => String(item.value))
      )
      const unselectedOptions = list.filter(
        (item) => !selectedValueSet.has(String(item.value))
      )
      return [...selectedOptions, ...unselectedOptions]
    },
    setDefaultModelObject() {

      const {  valueField = 'id' } = this.settings
      if (
        this.valueKey !== "" &&
        this.valueKey !== null &&
        this.valueKey !== undefined &&
        this.valueKey.length !== 0
      ) {
        if (!this.entityModel || !this.entityModel[valueField] || (this.entityModel && !this.entityModel[valueField] && this.isSelectTree)) {
          this.updateEntityModelById(this.valueKey)
        }
      }
    },

    getValue(item, valueField, defaultValue = null) {
      let value = null
      if (valueField) {
        value = get(item, valueField, defaultValue)
      } else {
        if (item?.code !== undefined) {
          value = item.code || defaultValue
        }else if (item?.value !== undefined) {
          value = item.value || defaultValue
        }else if (item?.id !== undefined) {
          value = item.id || defaultValue
        }
      }
      return value!== null ? value +'' : null
    },
    getLabel(item, labelField, defaultLabel = null) {
      if (labelField) {
        return get(item, labelField, get(item, 'label', defaultLabel))
      } else {
        if (item.name !== undefined) {
          return item.name || defaultLabel
        }
        if (item.label !== undefined) {
          return item.label || defaultLabel
        }
      }
      return null
    },
    getEntityModelList(entityModel = this.entityModel) {
      if (!entityModel) {
        return []
      }
      return Array.isArray(entityModel) ? entityModel : [entityModel]
    },
    updateEntityModelById(ids, model) {
      if(ids === null && model){
        this.$emit("update:entityModel", model)
      } else {
        const resIds = Array.isArray(ids) && ids.map(id => typeof id === 'number' ? String(id) : id) || [String(ids)]
        let selections = ids.length === 0 ? [] : this.options?.filter(op => resIds.includes(op.value)) || []
        if (selections.length === 0){
          if(this.isMultiple){
            if(!this.settings?.mdmDictType || this.settings?.mdmDictType !== 'TREE') {
              this.$emit("update:entityModel",[])
            }
          }else{
            this.$emit("update:entityModel", cloneDeep(this.nullEntityModel))
          }
        } else if (this.isMultiple) {
          const newObj = cloneDeep(selections.map((s) => s._data))
          this.$emit("update:entityModel", newObj)
        } else if (selections.length === 1) {
          const newObj = cloneDeep(selections[0]._data)
          this.$emit("update:entityModel", newObj)
        } 
      }
    },
    updateEntityModel(obj) {
      this.$nextTick(()=>{
        if (this.selectedItem.length === 1) {
          const newObj = obj || cloneDeep(this.selectedItem[0]._data)
          this.$emit("update:entityModel", newObj)
        } else if (this.selectedItem.length > 1) {
          const newObj = obj || cloneDeep(this.selectedItem.map((s) => s._data))
          this.$emit("update:entityModel", newObj)
        }
      })
    },
    setOptionsFilter(rule, type = 'hidden') {
      this.filters[type] = rule
      this.filters[type+'Key'] = Math.random(10000)
    },
    setOptions(options, settings) {
      if(settings){
        if(settings?.labelField)
        this.settings.labelField = settings?.labelField
        if( settings?.valueField)
        this.settings.valueField = settings?.valueField
      }
      const { labelField, valueField } = this.settings
      this._setOptions(
        options.map((op) => {
          return {
            value: this.getValue(op, valueField),
            label: this.getLabel(op, labelField),
            color: op?.extend || op?.color || '',
          }
        })
      )
    },
    _setOptions(options, isLoadRemoteData = true) {
      options.forEach( async item => {
        if(this.disableFilter) {
          item.disabled =  await this.disableFilter(item)
        }
        let description = ''
        if(this.mulColumns && this.mulColumns.isEnable &&  this.mulColumns.columns && this.mulColumns.columns && this.mulColumns.columns.length){
          const fields = this.mulColumns.columns.map(item=>{
            return item.name
          })
          description = fields.map(key => get(item._data, key, '')).join(' | ');
          item['description'] = description
        }
        if(this.lableJs && this.lableJsEnable){
          item.customLable = this.executeString(this.lableJs,item?._data)
        }
      });
      // // debugger
      this.isLoadRemoteData = isLoadRemoteData
      this.options = options
      if (this.options.length > 0) {
        this.showAll = true
      }
      const { type, selectDisabled, condition } = this.settings
      // 1. [数据来源type为“字典”或“实体”]cleanWhenNoMatch为true且联动后的options不存在与当前选中值匹配的项时, 清空联动目标选中值
      if (
        this.cleanWhenNoMatch &&
        (type === "dict" || type === "entity") &&
        !isEmpty(this._value)
      ) {
        // valueKey判断当前是单选or多选
        if (
          isString(this.valueKey) &&
          !this.options.some((op) => op.value === this.valueKey) &&
          !this.isSelectTree && !this.isDynamicSearch && this.parentCode// 下拉树有可能是动态加载          
        ) {
          this.$emit("input", null)
          this.$emit("update:modelValue", null)
        } else if (isArray(this.valueKey) && this.valueKey.length) {
        }
      }
    },
    pointFilter() {
      const {
        type,
        dictTypeCode,
        entity,
        cascade,
        action,
        condition,
        dataField = null,
        params,
        labelField,
        sortFields = [],
        sortField,
        isSortByAsc,
        modelTypeCode,
        mdmCodingStandardId,
        mdmCondition,
      } = this.settings
      const orderPropertyNames = this.buildOrderPropertyNames(sortFields, sortField, isSortByAsc)
      if (type === "entity") {
        let curCondition  = cloneDeep(condition)
        if(Array.isArray(curCondition) && condition.length ===0){
          curCondition = {}
        }
        let finalCondition = get(curCondition, "and.items", [])
        let orCondition = get(curCondition, "or.items", [])
        set(
          curCondition,
          "and.items",
          finalCondition.filter((c) => c.propertyValue !== "null")
        )
        set(
          curCondition,
          "or.items",
          orCondition.filter((c) => c.propertyValue !== "null")
        )
        if(this.isDynamicSearch && this.searchKey){
          const searchObj = {
            op: "%like%",
            propertyName: labelField,
            propertyValue: this.searchKey
          }
          if(curCondition?.and?.items){
            curCondition.and.items.push(searchObj)
          }else{
            set(
              curCondition,
              "and.items",
              [searchObj]
            )
          }
        }
        //设置排序条件
        if(orderPropertyNames){
          set(
            curCondition,
            "orderPropertyNames",
            orderPropertyNames
          )
        }
        return get(curCondition, "and.items", []).length > 0  || orderPropertyNames || get(curCondition, "or.items", []).length > 0  ? curCondition : null
      } else if (type === "dict") {
        return { dictTypeCode, parentCode:this.parentCode }
      } else if (type === 'mdmModel') {
        return { entityName: `entity:mdm.${modelTypeCode}` }
      } else if (type === 'mdmCode') {
        return { standardId: mdmCodingStandardId }
      } else if(type === 'mdmDict') {
        let curCondition  = cloneDeep(mdmCondition)
        if(Array.isArray(curCondition) && curCondition.length ===0){
          curCondition = {}
        }
        let finalCondition = get(curCondition, "and.items", [])
        let orCondition = get(curCondition, "or.items", [])
        set(
          curCondition,
          "and.items",
          finalCondition.filter((c) => (c.propertyValue && c.propertyValue !== "null"))
        )
        set(
          curCondition,
          "or.items",
          orCondition.filter((c) => (c.propertyValue && c.propertyValue !== "null"))
        )
        //设置排序条件
        if(orderPropertyNames){
          set(
            curCondition,
            "orderPropertyNames",
            orderPropertyNames
          )
        }
        return get(curCondition, "and.items", []).length > 0  || orderPropertyNames || get(curCondition, "or.items", []).length > 0  ? curCondition : null
      }
    },
    getOptions() {
      return this.options
    },
    debDynamicQuery: debounce(function () {
      this.dynamicQuery(false)
    }, 300),
    debInitDefault() {
      this.initDefault(this.isSelect)
    },
    setOptionsByEntityModel() {
      if(this.settings.type === 'mdmDict'){
        this.settings.labelField = "name"
        this.settings.valueField = "code"
      }
      const {
        type = "dict",
        labelField = "label",
        valueField = "value",
        bindType = "value"
      } = this.settings
      if ((isEmpty(this._value) || !this.entityModel) && this.isSelect) {
        // 开启缓存后 如果 value 为空 则 option 直接设置为 [], 阻断请求
        this._setOptions([], false)
        return true
      }
      if (this.entityModel) {
        if (type !== "dict") {
          if (
            this.isFirstChange > 1 ||
            (this.lastFilter !== null &&
              JSON.stringify(this.lastFilter) !==
                JSON.stringify(this.pointFilter()))
          ) {
            // 如果筛选条件发生变化, 则直接清空 options 和 value
            // this._setOptions([])
            // this.valueKey = null
            return true
          }
        }
        console.log("懒加载数据...")
        if (this.isMultiple){
          const entityModelList = this.getEntityModelList()
          if(entityModelList.length > 0 && this.checkKeysExist(this._value, entityModelList)){
            this._setOptions(
              entityModelList.map((em) => {
                return {
                  value: this.getValue(em, valueField),
                  label: this.getLabel(em, labelField),
                  _data: cloneDeep(em),
                }
              }),
              false
            )
            return true
          }else{
            return false
          }
        } else if (
          this.entityModel[valueField] &&
          this.entityModel[labelField]
        ) {
          if (
            this.getValue(this.entityModel, valueField) ||
            this.getLabel(this.entityModel, labelField)
          ) {
            if (!this.options || this.options.length === 0) {
              this._setOptions(
                [
                  {
                    value: this.getValue(this.entityModel, valueField),
                    label: this.getLabel(this.entityModel, labelField),
                    _data: cloneDeep(this.entityModel),
                  },
                ],
                false
              )
              return true
            }
            if(bindType  !== "entity" && !this.isMultiple && this.getValue(this.entityModel, valueField) !== this._value){
              return false
            }
            return true
          }
        } else if (this.settings.type === "dict") {
          if (this.entityModel["code"] || this.entityModel["name"]) {
            if (!this.options || this.options.length === 0) {
              this._setOptions(
                [
                  {
                    value: this.entityModel["code"],
                    label: this.entityModel["name"],
                    color: this.entityModel["color"],
                    _data: cloneDeep( this.entityModel),
                  },
                ],
                false
              )
            }else if(this.options && !this.checkKeysExistInList(this._value,this.options)){
              return false
            }
            return true
          }
        }
      }
      console.log(this.options,'options--')
      return false
    },
    initDefault(lazy = false) {
      if (this.mode === 'view' && this.selected !== undefined) return
      // // debugger
      // 当绑定值为对象时初始化对象模型, 用于清空时回填
      if (
        !Array.isArray(this._value) &&
        Object.prototype.toString.call(this._value) === "[object Object]"
      ) {
        this.nullEntityModel = cloneDeep(this._value)
        Object.keys(this.nullEntityModel).forEach((key) => {
          this.nullEntityModel[key] = null
        })
      }
      const {
        type = "dict",
        options,
        labelField = "label",
        valueField = "value",
        disabledField = "disabled",
        cascaderField = "",
        labelIsFormatted = false,
        descriptionField = "description",
      } = this.settings
      // 静态数据优先
      if (options && Array.isArray(options)) {
        this._setOptions(
          options.map((item) => {
            if (typeof item === "string") {
              return {
                label: item,
                value: item,
              }
            } else {
              return {
                label:
                  labelIsFormatted && get(item, descriptionField)
                    ? `${get(
                        item,
                        descriptionField,
                        "description"
                      )}(${this.getLabel(item, labelField)})`
                    : this.getLabel(item, labelField),
                value: this.getValue(item, valueField),
                color: item.extend,
                disabled: get(item, disabledField || "disabled"),
                _data: cloneDeep(item),
              }
            }
          })
        )
        return
      }

      if (lazy && this.entityModel) {
        // 当entityModel 有数据时, 填充 options
        if (this.setOptionsByEntityModel()) {
          return
        }
      } else {
        console.log("加载全部数据...")
      }

      if (this.dataId !== 'null' && this.dataId !== null) {
        const cached = cache.get(this.dataId)
        if (cached) {
          this._setOptions(cached, false)
          this.setDefaultModelObject()
          return
        }
      }

      const {
        dictTypeCode,
        entity,
        cascade,
        action,
        condition,
        dataField = null,
        params,
        modelTypeCode,
        modelRefField,
        modelShowField,
        mdmCodingStandardId,
        mdmDictTypeCode
      } = this.settings

      // debugger
      this.lastFilter = this.pointFilter() // 记录本次筛选条件
      if (this.settings.type === "dict" && dictTypeCode && !this.isSelectTree) {
        this.loading = true
        let response = this.dispatchProxy(
          useControllers(this).DictEntryController
            .queryDictEntrysByCriteria,
          {
            ...this.lastFilter,
            pageSize: 0,
            pageIndex: 0,
            orderFields: "sortBy",
            orderDirection: "ASC",
            __apiPrefix: "/"+(this.getAppName() || 'afc')
          },
        )
        response.then((data) => {
          if (has(data, "error")) data = data.data
          if (data) {
            // 修复: 后端返回的 data.data 可能不是数组（如返回 null/undefined/对象），需校验后再调用 map
            // 否则会报错: TypeError: data.data.map is not a function
            this._setOptions(
              Array.isArray(data.data)
                ? data.data.map((item) => {
                    return {
                      label: item.name,
                      value: item.code,
                      color: item.extend,
                      _data: cloneDeep(item),
                      disabled: get(item, disabledField || "disabled"),
                    }
                  })
                : []
            )
            this.putInCache(this.options)
           //  this.bus.$emit(`data:${this.dataId}`, this.options)
            this.setDefaultModelObject()
            // delete cache[this.dataId]
          }
          this.loading = false
        })
        if (response.end) {
          response.end((d) => {
            this.loading = false
          })
        }
      } else if (this.settings.type === "mdmDict" && mdmDictTypeCode && !this.isSelectTree) {
        this.loading = true
        const filter = encodeURIComponent(JSON.stringify({
          keyword: '',
          criteria: this.lastFilter
        }))
        let response = this.dispatchProxy(
          useControllers(this).LowcodeIntegrationMdmController.queryDictsWithPage,
          {
            matchWord: filter,
            code: mdmDictTypeCode,
            pageSize: 10,
            pageIndex: 0,
            orderFields: "sortBy",
            orderDirection: "ASC",
          }
        )
        response.then((data) => {
          if (has(data, "error")) data = data.data
          if (data) {
            // 修复: 后端返回的 data.data 可能不是数组，需校验后再调用 map
            this._setOptions(
              Array.isArray(data.data)
                ? data.data.map((item) => {
                    return {
                      label: item.name,
                      value: item.code,
                      color: item.extend,
                      _data: item,
                      disabled: get(item, disabledField || "disabled"),
                    }
                  })
                : []
            )
            this.putInCache(this.options)
            this.setDefaultModelObject()
          }
          this.loading = false
        })
        if (response.end) {
          response.end((d) => {
            this.loading = false
          })
        }
       } else if (this.settings.type === "entity" && entity && !this.isSelectTree && !this.isDynamicSearch) {
        this.loading = true
        // 处理 condition
        let response = this.dispatchProxy(
          useControllers(this).LowcodeModelController.queryWithPage,
          {
            params: {
              entityName: entity,
              pageIndex: 0,
              pageSize: this.isDynamicSearch ? this.maxOptions : -1,
            },
            payload: {
              condition: this.lastFilter,
            },
          }
        )
        response.then((data) => {
          if (has(data, "error")) data = data.data
          if (data) {
            // 修复: 后端返回的 data.data 可能不是数组，需校验后再调用 map
            this._setOptions(
              Array.isArray(data.data)
                ? data.data.map((item) => {
                    return {
                      label: this.getLabel(item, labelField),
                      value: this.getValue(item, valueField),
                      disabled: get(item, disabledField || "disabled"),
                      _data: cloneDeep(item),
                    }
                  })
                : []
            )
            this.putInCache(this.options)
            this.setDefaultModelObject()
          }
          this.loading = false
        })
        if (response.end) {
          response.end((d) => {
            this.loading = false
          })
        }
      } else if (this.settings.type === "entity" && entity && !this.isSelectTree && this.isDynamicSearch) {
        this.dynamicQuery(true)
      } 
      else if (this.settings.type === "mdmModel" && modelTypeCode && !this.isSelectTree && !this.isDynamicSearch) {
        // 暂时注释，测试完成后再删除
        // this.loading = true
        // let response = this.dispatchProxy(
        //   _VueCompat.getControllers().LowcodeModelController.queryWithPage,
        //   {
        //     params: {
        //       ...this.lastFilter,
        //       pageIndex: 0,
        //       pageSize: 10,
        //       __apiPrefix: "/MDM"
        //    },
        //     payload: {
        //       condition: {
        //         orderPropertyNames: "",
        //         expandConfigs: [{ propertyNames: "", refEntityName: "WfParticipant", refPropertyName: "id" }],
        //         and: {
        //           items: [
        //             { propertyName: "M_DATA_STATE", op: "=", propertyValue: "0" }
        //           ]
        //         },
        //         includeLogicDel: false,
        //         excludeLobProperty: false
        //       }
        //     }
        //   }
        // )
        // response.then((data) => {
        //   if (has(data, "error")) data = data.data
        //   if (data) {
        //     this._setOptions(
        //       data.data.map((item) => {
        //         return {
        //           label: item[modelShowField],
        //           value: item[modelRefField],
        //           _data: cloneDeep(item),
        //           disabled: get(item, disabledField || "disabled"),
        //         }
        //       })
        //     )
        //     this.putInCache(this.options)
        //     //  this.bus.$emit(`data:${this.dataId}`, this.options)
        //     this.setDefaultModelObject()
        //     // delete cache[this.dataId]
        //   }
        //   this.loading = false
        // })
        // if (response.end) {
        //   response.end((d) => {
        //     this.loading = false
        //   })
        // }
      } else if (this.settings.type === "mdmCode" && mdmCodingStandardId && !this.isSelectTree && !this.isDynamicSearch) {
        console.log('...this.lastFilter,', this.lastFilter,)
        this.loading = true
         let response = this.dispatchProxy(
          useControllers(this).LowcodeModelController.queryDictStandardValueInfo,
          {
            ...this.lastFilter,
            pageIndex: 0,
            pageSize: 999999,
            __apiPrefix: "/MDM"
          }
        )
        response.then((data) => {
          if (has(data, "error")) data = data.data
          if (data) {
            // 修复: 后端返回的 data.data 可能不是数组，需校验后再调用 map
            this._setOptions(
              Array.isArray(data.data)
                ? data.data.map((item) => {
                    return {
                      label: item['dictValue'],
                      value: item['dictCode'],
                      _data: cloneDeep(item),
                      disabled: get(item, disabledField || "disabled"),
                    }
                  })
                : []
            )
            this.putInCache(this.options)
            //  this.bus.$emit(`data:${this.dataId}`, this.options)
            this.setDefaultModelObject()
            // delete cache[this.dataId]
          }
          this.loading = false
        })
        if (response.end) {
          response.end((d) => {
            this.loading = false
          })
        }
      } else if (action) {
        this.loading = true
        this.dispatchProxy(action, params)
          .then((data) => {
            if (has(data, "error")) data = data.data
            let dataArr = []
            if(dataField){
              if(data.data[dataField]){
                //ide引用数据多套一层
                dataArr = data.data[dataField]
              }else{
                dataArr = data[dataField]
              }
            }else{
              dataArr = data
            }
            this._setOptions(
              ([...dataArr] || []).map((item) => {
                return {
                  label: get(item, labelField || "name"),
                  value: get(item, valueField || "id", ""),
                  disabled: get(item, disabledField || "disabled"),
                  _data: cloneDeep(item),
                }
              })
            )
            this.putInCache(this.options)
           //  this.bus.$emit(`data:${this.dataId}`, this.options)
            this.setDefaultModelObject()
            // delete cache[this.dataId]
          })
          .end((d) => {
            this.loading = false
          })
      }
    },
    putInCache(options){
      if (this.dataId !== 'null' && this.dataId !== null) {
        if (cache.size >= CACHE_MAX) {
          const firstKey = cache.keys().next().value
          cache.delete(firstKey)
        }
        cache.set(this.dataId, options)
      }
    },
    //服务实体特殊处理
    setPersistenceValue(entityModel){
      let { labelField } = this.settings
      if(this.isMultiple && entityModel instanceof Array){
        const persistenceValue = entityModel.map(item=>{
          return item[labelField]
        }).join(',')
        this.$emit('update:persistenceValue', persistenceValue)

      }else{
        this.$emit('update:persistenceValue', entityModel[labelField])
      }
    },
    // 静态数据高亮处理
    setcustomHighlight(){
      const { options } = this.settings
      if (this.isHighlight && options && Array.isArray(options)) {
        if (!this.isMultiple) {
          const currentObject = options.filter(
            (item) => item.code == this._value
          )[0]
          this.colors = currentObject?.extend
            ? [currentObject.extend]
            : ["rgba(144, 147, 153,1)"]
          this.$nextTick(() => {
            this.selSingleSlectStyle(
              currentObject?.name,
              currentObject,
              this.colors[0]
            )
          })
        } else {
          const entityModel =  options.filter(
            (item) => this._value && this._value.split(',').includes(item.code)
          )
          this.colors = this.getColorList(this._value && this._value.split(','), entityModel)
          this.$nextTick(() => {
            this.selMulSelctStyle() 
          })
        }
      }
    },
    dynamicQuery(init = false){
      if (this.mode === 'view' && this.selected !== undefined) return
      //init 是否初始化（此时需要判断查询回显数据并赋值entityModel；通过搜索时不需要是正常的）
      const {
        type = "dict",
        labelField = "label",
        valueField = "value",
        disabledField = "disabled",
        entity,
        bindType = "value",
      } = this.settings
      this.lastFilter = this.pointFilter()
    if (type === "entity" && entity && !this.isSelectTree) {
        this.loading = true
        let response = this.dispatchProxy(
          useControllers(this).LowcodeModelController.queryWithPage,
          {
            params: {
              entityName: entity,
              pageIndex: 0,
              pageSize: this.isDynamicSearch ? this.maxOptions : -1,
            },
            payload: {
              condition: this.lastFilter,
            },
          }
        )
        response.then(async (data) => {
          if (has(data, "error")) data = data.data
          if (data) {
            let resData = data.data
            if(this.isDynamicSearch && this._value){
              // 回显处理，把默认值对应的加到option中；防止option中没有对应的值回显不出来
              if (Object.prototype.toString.call(this.entityModel) === "[object Object]" && !this.objIsNull(this.entityModel)){
                resData = [this.entityModel].concat(resData)
              }else if(Array.isArray(this.entityModel)){
                resData = this.entityModel.concat(resData)
              }
              if(init){
                if(bindType !== "entity" && this._value && !this.checkKeysExistInList(this._value,resData)){
                  const conditionTtem = {
                    op: "=",
                    propertyName: valueField,
                    propertyValue: this._value,
                  }
                  if (this.isMultiple) {
                    conditionTtem.op = "contains"
                  }
                  const optionsData = await this.loadDetailEntity(conditionTtem)
                  resData = optionsData.concat(resData)
                }
              }
              //去重
              resData = resData.filter((item, index, self) =>
                index === self.findIndex(t => t[valueField] === item[valueField])
              )
            }
            this._setOptions(
              resData.map((item) => {
                return {
                  label: this.getLabel(item, labelField),
                  value: this.getValue(item, valueField),
                  disabled: get(item, disabledField || "disabled"),
                  _data: cloneDeep(item),
                }
              })
            )
            this.putInCache(this.options)
            if(this._value && init){
              const valueKeyList = this.isMultiple ? this._value && this._value.split(',') : this._value
              this.updateEntityModelById(valueKeyList)
            }
          }
          this.loading = false
        })
        if (response.end) {
          response.end((d) => {
            this.loading = false
          })
        }
      }
    },
    getColorList(values, array) {
      if (array instanceof Array) {
        return values && values.map((value) => {
          const item = array.find((obj) => obj.code === value)
          return item
            ? item.extend || "rgba(144, 147, 153,1)"
            : "rgba(144, 147, 153,1)"
        })
      } else {
        return array.extend ? [array.extend] : ["rgba(144, 147, 153,1)"]
      }
    },
    selSingleSlectStyle(content, currentObject, color = 'rgb(144, 147, 153)') {
      let selectElement = document
        .getElementById(this.keyId)
        ?.querySelector(".el-select")
      //删除上一次渲染元素
      let tagsElements = selectElement?.querySelectorAll(".el-select__tags") || []
      tagsElements.forEach((tagsElement) => {
        selectElement.removeChild(tagsElement)
      })
      //渲染元素
      if (currentObject && this.valueKey && selectElement) {
        //清除input中的placeholder 和 value
        let tagsElement = document.createElement("div")
        tagsElement.classList.add("el-select__tags")
        selectElement.style.position = "relative"
        tagsElement.style.position = "absolute"
        tagsElement.style.left = "8px"
        tagsElement.style.top = "50%"
        tagsElement.style.transform = "translateY(-50%)"
        tagsElement.style.zIndex = "2"
        tagsElement.style.display = "flex"
        tagsElement.style.alignItems = "center"
        tagsElement.style.width = "auto"
        tagsElement.style.height = "26px"
        tagsElement.style.lineHeight = "26px"
        tagsElement.style.maxWidth = "calc(100% - 40px)"
        tagsElement.style.pointerEvents = "none"
        tagsElement.innerHTML = `<span><span style="height:26px;line-height:26px;color:${color || 'rgb(144, 147, 153)'} !important;padding-left:8px;padding-right: 8px; border-radius:8px;background-color:${getBackgrouncolor(
          color
        )};border-color:${getBackgrouncolor(
          color
        )};max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" class="el-tag el-tag--info el-tag--small el-tag--light"><span class="el-select__tags-text">${content}</span></span></span>`
        selectElement.appendChild(tagsElement)

        const input = selectElement.querySelector('input[type="text"]')
        input.placeholder = ""
        input.value = ""
      }
    },
    selMulSelctStyle() {
      try{
      //1.修改el-tag X 样式去掉背景色
        // 创建一个新的 <style> 元素
        const styleElement = document.createElement("style")
        // 设置样式规则
        const cssRule = `#${this.keyId} .el-select .el-tag__close.el-icon-close {background: none;}`
        // 将样式规则添加到 <style> 元素的 innerHTML 中
        styleElement.innerHTML = cssRule
        // 将 <style> 元素添加到文档头部
        document.head.appendChild(styleElement)
      //2.修改el-tag X 颜色
        const selectElement = document.getElementById(this.keyId)
        const elements = selectElement?.getElementsByClassName("el-tag--info") || []
        for (let i = 0; i < elements.length; i++) {
            const styleElement = document.createElement("style")
            const cssRule = `#${this.keyId} .el-select__tags>span>span:nth-child(${
            i + 1
            })>i {color:${this.colors[i]} }`
            styleElement.innerHTML = cssRule
            document.head.appendChild(styleElement)
        }
      }catch(e){
        console.log(e)
      }
    },
    setTaghighLightClass(newEntityModel) {
      const { labelField, servicePanel } = this.settings
      const entityModel = newEntityModel || (this.isMultiple ? cloneDeep(this.selectedItem.map(item=>{return item?._data})) : cloneDeep(this.selectedItem[0]?._data)) || this.entityModel
      if (
        entityModel && 
        !this.isMultiple &&
        this.isHighlight &&
        !servicePanel
      ) {
        this.colors = entityModel.extend
          ? [entityModel.extend]
          : ["rgba(144, 147, 153,1)"]
        const content = this.getLabel(entityModel, labelField, "")
        this.selSingleSlectStyle(content, entityModel, entityModel.extend)
      } else if (entityModel && this.isMultiple && this.isHighlight && !servicePanel) {
        this.colors = this.getColorList(this.valueKey, entityModel)
        this.selMulSelctStyle()
      }
    },
    showContentSpan(option){      
      return option.description ? 
      `<span style="float: left"> ${option.label}</span>
       <span style="float: right; color: #8492a6; font-size: 13px">${option.description}</span> `
      :`<span style="float: left"> ${option.customLable || option.label}</span>`
    },
    valueInEntityModel(value){
      return value && this.entityModel && this.checkKeysExist(value,this.entityModel)
    },
    valueInOptions(value){
      return value && this.options && this.checkKeysExistInList(value,this.options)  
    },
    //检查当前值是否全部包含在entityModel数组中;要求值和对应的entityModel必须一致（value:1 ,entityModel:[{code:1},{code:2}] 是false）
    checkKeysExist(requiredKeys, entityModel) {
      if(!entityModel) return false
      const valueKeyList = requiredKeys.toString().split(this.separator)
      const entityModelList =  entityModel && Array.isArray(entityModel) ? entityModel : [entityModel]
      if(Array.isArray(entityModelList) && Array.isArray(valueKeyList) ){
        if(valueKeyList.length === entityModelList.length){
          const { type } = this.settings
          const valueField = type === 'dict' ? 'code' : this.settings.valueField
          const existingKeys = new Set(entityModelList.map(item => item[valueField]));
          return valueKeyList.every(code => existingKeys.has(code+""));  
        }else{
          return false
        }
      }
      return false
    },
    objIsNull(obj) {
      return obj && Object.keys(obj).every(
        (key) => !obj[key]
      )
    },
    checkKeysExistInList(keys,list){
      if(list?.length){
        const valueKeyList = keys.toString().split(this.separator)
        const { type } = this.settings
        const valueField = type === 'dict' ? 'code' : this.settings.valueField
        const existingKeys = new Set(list.map(item => item?.value ?? item[valueField]));
        return valueKeyList.every(code => existingKeys.has(code+""));  
      }else{
        return false
      }
    },
    async loadDetailEntity(conditionTtem) {
      const { entity } = this.settings
      if (entity) {
        const resp = await this.dispatchProxy(
        useControllers(this).LowcodeModelController.queryWithPage,
        {
            params: {
            entityName: entity,
            pageIndex: 0,
            pageSize: -1,
            },
            payload: {
            condition: {
                and: {
                items: [{ ...conditionTtem }],
                },
              },
            },
        })
        if (!resp.error) {
          const data = resp.data?.data || res.data
          return data && data.length ? data : []
        }
      } else {
        return []
      }
    },
    executeString(str,data) {
      try {
          return new Function('data', `return (${str})`)(data)
        } catch (error) {
          console.error('executeString出错:',error)
          return null
        }
    },
    setEntityModelCustomLable() {
      if(this.entityModel && this.lableJs && this.lableJsEnable){
        if(Array.isArray(this.entityModel)){
          this.entityModel.map((item) => {
            return {
              ...item,
              customLable: this.executeString(this.lableJs,item)
            }
          })
        }else if (Object.prototype.toString.call(this.entityModel) === "[object Object]"){
          this.entityModel.customLable = this.executeString(this.lableJs,this.entityModel)
        }
      }
    },
    isEntityModelMatchedValue() {
      const { valueField } = this.settings
      const currentEntityValue = this.isMultiple
        ? (
          Array.isArray(this.entityModel)
            ? this.entityModel.map((item) => this.getValue(item, valueField))
            : (this.entityModel ? [this.getValue(this.entityModel, valueField)] : [])
        )
        : this.getValue(this.entityModel, valueField)
      return this.isMultiple
        ? isEqual(currentEntityValue, Array.isArray(this.valueKey) ? this.valueKey : [this.valueKey])
        : currentEntityValue === this.valueKey
    },

  },
  beforeUnmount() {
    // this.bus?.$off(`data:${this.dataId}`)
  },
}
// Modified by AI on 2026-05-19 15:19:26
