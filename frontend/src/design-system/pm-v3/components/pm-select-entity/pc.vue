<template>
   <span v-if="mode === 'view'">{{ viewLabel || displayLabel || (selected !== undefined || viewReady ? nullLabel : '') }}</span>
   <el-select
    v-else
    
    v-model="value"
    v-bind="$attrs"
    :disabled="disabled"
    :filterable="filterable"
    :clearable="clearable"
    :multiple="multiple"
    :placeholder="placeholder"
    :loading="loading"
    @change="handleChange"
    @visible-change="onVisibleChange"
    @clear="handleClear"
    :filter-method="filterable ? handleSearch : undefined"
  >
    <el-option
      v-for="option in options"
      :key="option.value"
      :label="option.customLable || option.label"
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
import { useEntityDataSource } from '../../composables/useEntityDataSource'

/**
 * 实体下拉选择器组件
 *
 * 通过 entity 名称从后端 LowcodeModelController 查询实体数据并展示为下拉列表。
 * 替代 pm-select + settings.type='entity' 的方式，API 更简洁。
 *
 * API：LowcodeModelController.queryWithPage
 * 数据映射：label ← get(item, labelField), value ← get(item, valueField)
 * 支持 queryCondition 查询过滤、sortFields 排序、filterable 动态搜索
 *
 * @example 基础用法
 * <pm-select-entity v-model="val" entity="User" />
 *
 * @example 多选
 * <pm-select-entity v-model="val" entity="User" multiple />
 *
 * @example 查看模式（纯文本展示，无边框/箭头，依赖 options 异步加载）
 * <pm-select-entity v-model="val" entity="User" mode="view" />
 *
 * @example 查看模式 + 传入 selected（零延迟，父组件已知道文本时使用）
 * <pm-select-entity v-model="val" entity="User" mode="view" :selected="{ value: '1', label: '管理员' }" />
 *
 * @example 绑定选中对象（同步完整 option 对象）
 * <pm-select-entity v-model="val" entity="User" v-model:selected="selectedObj" />
 *
 * @example 添加条件查询（propertyName 需为实体字段名）
 *
 * | 字段名      | 中文名 | 类型 |
 * | ----------- | ------ | ---- |
 * | status 📝   | 状态   | String |
 * | age 🔢      | 年龄   | Number |
 * | createTime 📅 | 创建时间 | Date |
 *
 * <pm-select-entity
 *   v-model="val"
 *   entity="User"
 *   labelField="userName"
 *   :queryCondition="{
 *     and: {
 *       items: [
 *         { op: '=', propertyName: 'status', propertyValue: 'active' }
 *       ]
 *     }
 *   }"
 * />
 */
const props = defineProps({
  /** 实体名称（必填），对应后端 entityName */
  entity: {
    type: String,
    required: true,
  },
  /** 显示字段名，支持 a.b.c 路径语法 */
  labelField: {
    type: String,
    default: 'label',
  },
  /** 值字段名，支持 a.b.c 路径语法 */
  valueField: {
    type: String,
    default: 'value',
  },
  /** 查询过滤条件，格式同 LowcodeModelController.condition 参数 */
  queryCondition: {
    type: Object,
    default: null,
  },
  /** 排序字段列表 [{ field, order }] */
  sortFields: {
    type: Array,
    default: () => [],
  },
  /** 排序字段名（与 sortFields 二选一） */
  sortField: {
    type: String,
    default: '',
  },
  /** 是否升序排列（配合 sortField 使用，true=asc, false=desc） */
  sortAscending: {
    type: Boolean,
    default: true,
  },
  /** 禁用字段名 */
  disabledField: {
    type: String,
    default: 'disabled',
  },
  /** v-model 绑定值 */
  modelValue: {
    default: null,
  },
  /** 是否禁用 */
  disabled: { type: Boolean, default: false },
  /** 是否只读 */
  readonly: { type: Boolean, default: false },
  /** 是否显示清空按钮 */
  clearable: { type: Boolean, default: false },
  /** 是否可搜索（启用后下拉打开时请求后端，输入时动态搜索） */
  filterable: { type: Boolean, default: false },
  /** 是否多选 */
  multiple: { type: Boolean, default: false },
  /** 占位文本 */
  placeholder: { type: String, default: '' },
  /** 最大选项数 */
  maxOptions: { type: Number, default: 200 },
  /** 显示模式：edit-编辑模式 view-纯文本展示 */
  mode: { type: String, default: 'edit' },
  /** 空值占位文本 */
  nullLabel: { type: String, default: '--' },
  /** v-model:selected 绑定的选中对象，单选为 Object，多选为 Array */
  selected: { default: undefined },
})

const emit = defineEmits([
  /** v-model 值更新 */
  'update:modelValue',
  /** v-model:selected 选中对象更新 */
  'update:selected',
  /** 选中值变化回调 */
  'change',
])

const emptyText = ref(i18n('无数据'))
const loadingText = ref(i18n('数据加载中'))
const dropdownVisible = ref(false)

const value = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val),
})

/* 实体数据源（pc / mobile 共用）：options / loading / dataLoaded / searchKey / fetchEntityData / handleSearch */
const { options, loading, dataLoaded, searchKey, fetchEntityData, handleSearch } = useEntityDataSource(props, emit)

/* v-model:selected 全量对象绑定 */
const { selected, viewLabel, clearSelected } = useSelectSelected(
  props, emit, options,
  () => props.valueField,
  () => props.labelField,
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

/** view 模式下 options 是否已加载完成，避免显示 raw value 闪烁 */
const viewReady = computed(() => {
  if (isEmptyValue(props.modelValue)) return true
  if (props.selected !== undefined) return true
  return options.value.length > 0
})

function isEmptyValue(val) {
  return val === null || val === undefined || val === ''
}

function handleChange(val) {
  emit('change', val)
}

function handleClear() {
  clearSelected()
}

function onVisibleChange(visible) {
  dropdownVisible.value = visible
  if (visible) {
    if (!dataLoaded.value) {
      fetchEntityData()
    }
  } else {
    if (searchKey.value) {
      handleSearch('')
    }
  }
}
</script>
