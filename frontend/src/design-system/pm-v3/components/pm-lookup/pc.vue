<template>
  <div v-if="mode === 'view'">{{ showContent || formatNullValue }}</div>
  <div class="pm-lookup-wrapper" v-else-if="mode === 'edit'">
    <null-value v-if="!modelValue && finalDisabled" :disabled="finalDisabled" :readonly="readonly" />
    <div class="pm-lookup-input" v-else>
      <template v-if="modelValue">
        <el-select :key="selectkey" v-if="multiple" @change="selectChange" style="width: 100%" v-bind="$attrs" v-model="selectValue" :multiple="multiple" :disabled="finalDisabled">
          <el-option v-for="item in options" :key="item.value" :label="item.customLable || item.label" :value="item.value" />
        </el-select>
        <el-input v-else readonly :disabled="finalDisabled" v-bind="$attrs" v-model="singleValue" @click="openDialog">
          <template #suffix>
            <el-icon v-if="closeButtonShow" class="pm-lookup-clear" :class="{ 'pm-lookup-clear-with-btn': !finalDisabled }" @click.stop="clearValue"><CircleClose /></el-icon>
          </template>
        </el-input>
      </template>
      <el-input v-else readonly :disabled="finalDisabled" v-bind="$attrs" @click="openDialog" />
      <el-button v-if="!finalDisabled" :disabled="finalDisabled" :icon="Search" class="pm-lookup-btn" type="text" @click="openDialog" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, getCurrentInstance } from 'vue'
import { get } from 'lodash'
import { Search, CircleClose } from '@element-plus/icons-vue'
import { useDispatchProxy, useControllers } from '../../composables/useDispatchProxy'
import { useFormatNullValue } from '../../composables/useFormatNullValue'
import NullValue from '../pm-null-value/pc.vue'

/**
 * 数据查找选择器，支持单选/多选，支持 entity 绑定模式与回显
 * @component pm-lookup
 * @example <pm-lookup v-model="value" entity="demoEntity" placeholder="请选择" />
 */
const props = defineProps({
  /** 绑定值，支持 String / Object / Array */
  modelValue: { default: null },
  /** 实体模型对象，用于回显展示 */
  selected: { default: null },
  /** 数据绑定方式：'value' — 值直传，'entity' — 对象绑定 */
  bindType: { type: String, default: 'value' },
  /** 显示字段名 */
  labelField: { type: String, default: 'name' },
  /** 值字段名 */
  valueField: { type: String, default: 'id' },
  /** 实体名称，用于回显时查询 */
  entity: { type: String, default: '' },
  /** 是否多选 */
  multiple: { type: Boolean, default: false },
  /** 多选时值的分隔符 */
  separator: { type: String, default: ',' },
  /** 显示模式：'edit' — 可编辑，'view' — 只读展示 */
  mode: { default: 'edit' },
  /** 是否只读 */
  readonly: { type: Boolean, default: false },
  /** 是否禁用 */
  disabled: { type: Boolean, default: false },
  /** 条件为空时禁用选择 */
  selectDisabled: { type: Boolean, default: false },
  /** 自定义标签 JS 表达式 */
  lableJs: { type: String, default: '' },
  /** 是否启用 lableJs */
  lableJsEnable: { type: Boolean, default: false },
  /** 弹窗打开的视图配置（复用页面模型 pageModel.views.list，含列/搜索/分页） */
  view: { type: Object, default: null },
  /** 目标表单组件树：弹窗 ListView 用它回填列字段类型/dictTypeCode，保证 select-dict 等渲染出 label */
  viewComponents: { type: Array, default: () => [] },
  /** 打开弹窗所需的附加查询条件 */
  queryCondition: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'update:selected', 'update:persistenceValue', 'confirmSelect', 'change'])

// setup 期间缓存组件实例：getCurrentInstance() 在事件回调中会返回 null，
// 需在 setup 同步阶段捕获，供 openDialog 里通过 proxy.Api 访问全局 Api
const _instance = getCurrentInstance()

const { dispatchProxy } = useDispatchProxy()
const Controllers = useControllers()
const { formatNullValue } = useFormatNullValue()

const selectValue = ref(null)
const singleValue = ref(null)
const options = ref([])
const selectkey = ref(0)

const valueIsObject = computed(() => !Array.isArray(props.modelValue) && Object.prototype.toString.call(props.modelValue) === '[object Object]')

const showContent = computed(() => {
  if (props.bindType === 'entity') {
    if (Array.isArray(props.selected)) return props.selected.map(em => get(em, props.labelField, '')).join(props.separator)
    return singleValue.value
  }
  if (!props.multiple) return singleValue.value
  if (Array.isArray(props.selected)) return props.selected.map(em => get(em, props.labelField, '')).join(props.separator)
  return props.selected?.[props.labelField] || props.modelValue
})

const finalDisabled = computed(() => {
  if (props.disabled || props.readonly) return true
  return false
})

const closeButtonShow = computed(() => !(props.disabled || props.readonly) && props.modelValue && !props.multiple)

onMounted(() => {
  if (props.modelValue && Array.isArray(props.modelValue) && props.bindType === 'entity') {
    setOptions(props.modelValue)
  }
})

watch(() => props.modelValue, (val) => {
  if (val) {
    if (valueIsObject.value) {
      if (val[props.valueField] || val[props.valueField] === 0) {
        setOptions([val])
        singleValue.value = getSingValuebyLableJs(val) || get(val, props.labelField)
      } else {
        singleValue.value = ''
      }
    }
    if (props.multiple) {
      setOptions(options.value)
      if (Array.isArray(val)) {
        selectValue.value = val.map(item => item[props.valueField])
      } else {
        selectValue.value = val.split(props.separator)
        if (props.mode === 'edit') toEchoValue()
      }
    }
    if (props.bindType !== 'entity' && !props.multiple) {
      if (options.value[0]) {
        singleValue.value = getSingValuebyLableJs(options.value[0]) || get(options.value[0], props.labelField)
      } else {
        if (props.mode === 'edit') toEchoValue()
        singleValue.value = val
      }
    }
  } else {
    selectValue.value = null
    options.value = []
    singleValue.value = null
  }
}, { immediate: true, deep: true })

watch(() => props.selected, (val) => {
  if (!val) return
  const valIsNull = val && Object.keys(val).every(key => !val[key])
  if (val && !valIsNull) {
    if (props.multiple) {
      setOptions(Array.isArray(val) ? val : [val])
    } else {
      if (props.bindType !== 'entity') {
        singleValue.value = getSingValuebyLableJs(val) || get(val, props.labelField) || props.modelValue
      }
    }
    setPersistenceValue(val)
  }
}, { immediate: true })

function setOptions(opts) {
  if (opts) {
    options.value = opts.map(item => ({
      label: get(item, props.labelField),
      value: get(item, props.valueField),
      disabled: true,
      _data: item,
    }))
  }
}

function clearValue() {
  emit('confirmSelect', null)
  emit('update:selected', {})
  emit('update:modelValue', null)
  emit('change', null)
}

function openDialog() {
  const selection = window.getSelection?.().toString()
  if (selection) return
  if (props.disabled || props.readonly) return
  const api = _instance?.proxy?.Api || window.Api
  if (!api || typeof api.openDialog !== 'function') {
    console.warn('[Lookup] openDialog: requires platform Api.openDialog implementation')
    return
  }
  api.openDialog({
    view: props.view,
    viewComponents: props.viewComponents,
    entity: props.entity,
    labelField: props.labelField,
    valueField: props.valueField,
    bindType: props.bindType,
    multiple: props.multiple,
    separator: props.separator,
    queryCondition: props.queryCondition,
    value: props.modelValue,
  }).then((result) => {
    if (result === undefined || result === null) return
    const records = Array.isArray(result) ? result : [result]
    applySelected(records)
  }).catch((err) => {
    console.error('[Lookup] openDialog failed:', err)
  })
}

/** 平台弹窗返回选中记录后，按单选/多选、绑定方式回填值并触发事件 */
function applySelected(records) {
  const items = (records || []).filter(Boolean)
  if (items.length === 0) return
  // valueField 在记录中可能不存在（如主键为 _id），回退取记录自带的 id/_id
  const pickVal = (item) => {
    const v = get(item, props.valueField)
    if (v !== undefined && v !== null && v !== '') return v
    return item.id ?? item._id ?? item[props.valueField]
  }
  const vals = items.map(item => pickVal(item))
  const selected = props.multiple ? items : items[0]
  let value
  if (props.multiple) {
    value = props.bindType === 'entity' ? items : vals.join(props.separator)
  } else {
    value = props.bindType === 'entity' ? items[0] : vals[0]
  }
  if (props.multiple) {
    setOptions(items)
    selectValue.value = vals
  } else {
    setOptions(items)
    singleValue.value = getSingValuebyLableJs(items[0]) || get(items[0], props.labelField) || (props.bindType === 'entity' ? '' : vals[0])
  }
  emit('update:modelValue', value)
  emit('update:selected', selected)
  emit('confirmSelect', props.multiple ? items : items[0])
  emit('change', value)
}

async function toEchoValue() {
  try {
    if (props.modelValue && (!props.selected || (props.selected && (objIsNull(props.selected) || (!props.multiple && props.modelValue !== props.selected[props.valueField]) || (props.multiple && !checkKeysExist(selectValue.value, props.selected)))))) {
      const conditionItem = { op: '=', propertyName: props.valueField, propertyValue: props.modelValue }
      if (props.multiple) {
        conditionItem.op = 'contains'
        const data = await loadEntity(conditionItem)
        data && props.bindType !== 'entity' && emit('update:selected', data)
      } else {
        if (!valueIsObject.value) {
          const data = await loadEntity(conditionItem)
          data && emit('update:selected', data[0])
        }
      }
    }
  } catch (error) {
    console.error('toEchoValue出错', error)
  }
}

async function loadEntity(conditionItem) {
  if (props.entity) {
    const resp = await dispatchProxy(Controllers.LowcodeModelController?.queryWithPage, {
      params: { entityName: props.entity, pageIndex: 0, pageSize: -1 },
      payload: { condition: { and: { items: [{ ...conditionItem }] } } },
    })
    if (!resp.error) {
      const data = resp.data?.data || resp.data
      return data?.length ? data : []
    }
  }
  return []
}

function setPersistenceValue(selected) {
  if (props.multiple && selected instanceof Array) {
    emit('update:persistenceValue', selected.map(item => item[props.labelField]).join(','))
  } else {
    emit('update:persistenceValue', selected[props.labelField])
  }
}

function selectChange(items) {
  let newValue = null
  if (items && Array.isArray(items)) {
    if (props.bindType === 'entity') {
      newValue = options.value
    } else {
      newValue = items.join(props.separator)
      if (props.selected && Array.isArray(props.selected)) {
        const selected = props.selected.filter(item => items.includes(get(item, props.valueField)))
        emit('update:selected', selected)
      }
    }
  }
  emit('update:modelValue', newValue)
}

function objIsNull(obj) {
  return obj && Object.keys(obj).every(key => !obj[key])
}

function checkKeysExist(requiredKeys, selected) {
  if (Array.isArray(selected) && Array.isArray(requiredKeys)) {
    if (requiredKeys.length === selected.length) {
      const existingKeys = new Set(selected.map(item => item[props.valueField]))
      return requiredKeys.every(code => existingKeys.has(code))
    }
  }
  return false
}

function executeString(str, data) {
  try { return new Function('data', `return (${str})`)(data) } catch { return null }
}

function getSingValuebyLableJs(data) {
  if (props.modelValue && props.lableJs && props.lableJsEnable) return executeString(props.lableJs, data)
  return null
}
</script>

<style lang="scss" scoped>
.pm-lookup-wrapper { width: 100%; }
.pm-lookup-input { position: relative; display: flex; align-items: center; width: 100%; }
.pm-lookup-clear { cursor: pointer; color: #c0c4cc; &:hover { color: #909399; } }
.pm-lookup-clear-with-btn { margin-right: 32px; }
.pm-lookup-btn { position: absolute; right: 4px; top: -1px; color: #c0c4cc !important; &:hover { color: #909399 !important; } }
</style>
<!-- Modified by AI on 2026-08-04 11:55:49 -->
