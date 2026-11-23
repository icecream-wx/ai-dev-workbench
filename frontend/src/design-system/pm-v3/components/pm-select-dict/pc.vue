<template>
  <span v-if="mode === 'view'">{{ viewLabel || displayLabel || (selected !== undefined || options.length > 0 ? nullLabel : '') }}</span>
  <el-select
    v-else
    v-model="value"
    v-bind="$attrs"
    :disabled="finalDisabled"
    :filterable="filterable"
    :clearable="clearable"
    :multiple="multiple"
    :placeholder="placeholder"
    :loading="loading"
    @change="handleChange"
    @clear="handleClear"
    @visible-change="onVisibleChange"
  >
    <el-option
      v-for="option in options"
      :key="option.value"
      :label="option.label"
      :value="option.value"
      :disabled="option.disabled"
    />
    <template #empty>
      <p class="el-select-dropdown__empty">
        <template v-if="loading">
          <i class="el-icon-loading" /> {{ loadingText }}
        </template>
        <template v-else>{{ emptyText }}</template>
      </p>
    </template>
  </el-select>
</template>

<script setup>
import { ref, computed } from 'vue'
import { i18n } from '../../i18n/info'
import { useSelectSelected } from '../../composables/useSelectSelected'
import { useDictDataSource } from '../../composables/useDictDataSource'

/**
 * 字典下拉选择器组件
 *
 * 通过 dictTypeCode 从后端 DictEntryController 获取字典条目并展示为下拉列表。
 * 替代 pm-select + settings.type='dict' 的方式，API 更简洁、聚焦字典场景。
 *
 * 数据映射：label ← item.name, value ← item.code, color ← item.extend
 * 排序：按 sortBy 字段升序
 * 缓存：组件不自带缓存，由父组件通过 v-if / keep-alive 控制
 *
 * @example 基础用法 - <pm-select-dict v-model="val" dict-type-code="gender" />
 * @example 多选 - <pm-select-dict v-model="val" dict-type-code="gender" multiple />
 * @example 查看模式（纯文本展示，无边框/箭头，依赖 options 异步加载） - <pm-select-dict v-model="val" dict-type-code="gender" mode="view" />
 * @example 查看模式 + 传入 selected（零延迟，父组件已知道文本时使用） - <pm-select-dict v-model="val" dict-type-code="gender" mode="view" :selected="{ value: 'M', label: '男' }" />
 * @example 绑定选中对象（同步完整 option 对象） - <pm-select-dict v-model="val" dict-type-code="gender" v-model:selected="selectedObj" />
 */
const props = defineProps({
  /** 字典类型编码（必填），对应后端 DictType 的 code 字段 */
  dictTypeCode: {
    type: String,
    required: true,
  },
  /** 父级字典编码，用于树形字典联动过滤 */
  parentCode: {
    type: String,
    default: null,
  },
  /** v-model 绑定值，单选为 String，多选为 Array */
  modelValue: {
    default: null,
  },
  /** 是否禁用整个选择器 */
  disabled: {
    type: Boolean,
    default: false,
  },
  /** 是否只读（展示选中文本，不可交互） */
  readonly: {
    type: Boolean,
    default: false,
  },
  /** 是否显示清空按钮 */
  clearable: {
    type: Boolean,
    default: false,
  },
  /** 是否可输入搜索过滤选项 */
  filterable: {
    type: Boolean,
    default: false,
  },
  /** 是否启用多选 */
  multiple: {
    type: Boolean,
    default: false,
  },
  /** 选择框占位文本 */
  placeholder: {
    type: String,
    default: '',
  },
  /** 显示模式：edit-编辑模式 view-纯文本展示 */
  mode: {
    type: String,
    default: 'edit',
  },
  /** 空值占位文本 */
  nullLabel: {
    type: String,
    default: '--',
  },
  /** v-model:selected 绑定的选中对象，单选为 Object，多选为 Array */
  selected: {
    default: undefined,
  },
  /**
   * disableWhenParentEmpty：当 parentCode 为空时自动禁用组件
   * 用于父子字典联动场景，父级未选择时子级不允许操作
   */
  disableWhenParentEmpty: {
    type: Boolean,
    default: false,
  },
})

/** 判断父级字典编码是否为空 */
function isParentCodeEmpty(pc) {
  return !pc || pc === '' || pc === 'null' || pc === 'undefined'
}

/** parentCode 为空且 disableWhenParentEmpty 为 true 时禁用组件 */
const finalDisabled = computed(() => {
  if (props.disabled || props.readonly) return true
  if (props.disableWhenParentEmpty) return isParentCodeEmpty(props.parentCode)
  return false
})

const emit = defineEmits([
  /** v-model 值更新事件 */
  'update:modelValue',
  /** v-model:selected 选中对象更新事件 */
  'update:selected',
  /** 选中值变化回调，参数为当前选中值 */
  'change',
])

const emptyText = ref(i18n('无数据'))
const loadingText = ref(i18n('数据加载中'))

/** v-model 双向绑定计算属性 */
const value = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val),
})

/* 字典数据源（pc / mobile 共用）：options / loading / dataLoaded / fetchDictData */
const { options, loading, dataLoaded, fetchDictData } = useDictDataSource(props, emit)

/* v-model:selected 全量对象绑定 */
const { selected, viewLabel, clearSelected } = useSelectSelected(
  props, emit, options,
  'value', 'label',
  () => props.multiple,
)

/** view 模式下从 options 解析 label（仅 options 加载完成后生效，否则返回空避免闪烁 valueField） */
const displayLabel = computed(() => {
  if (isEmptyValue(props.modelValue)) return ''
  if (options.value.length === 0) return ''
  if (props.multiple && Array.isArray(props.modelValue)) {
    return props.modelValue.map(v => {
      const item = options.value.find(o => o.value === v)
      return item ? item.label : ''
    }).filter(Boolean).join('、')
  }
  const item = options.value.find(o => o.value === props.modelValue)
  return item ? item.label : ''
})


function isEmptyValue(val) {
  return val === null || val === undefined || val === ''
}

/** 选项变化时触发 change 事件 */
function handleChange(val) {
  emit('change', val)
}

function handleClear() {
  clearSelected()
}

/** 下拉展开时，若尚未加载完整数据（selected 回显场景）再触发请求 */
function onVisibleChange(visible) {
  if (visible && !dataLoaded.value) fetchDictData()
}
</script>
