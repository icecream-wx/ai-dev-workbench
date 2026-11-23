<template>
  <!-- 类型代理：dict / entity / user / org / position / lookup -->
  <component
    v-if="proxyComponent"
    :is="proxyComponent"
    :model-value="modelValue"
    :selected="selected"
    :mode="mode"
    :disabled="disabled"
    :readonly="readonly"
    v-bind="proxyAttrs"
    @update:modelValue="handleProxyModelValue"
    @update:selected="handleProxySelected"
    @change="handleProxyChange"
  >
    <template v-for="(_, name) in $slots" :key="name" #[name]="scope">
      <slot :name="name" v-bind="scope" />
    </template>
  </component>

  <!-- 基础 el-select（静态选项） -->
  <div v-else class="pm-select-base" style="width: 100%; display: inline">
    <span v-if="mode === 'view'" class="pm-select-view">
      <template v-if="isHighlight">
        <span v-if="isEmptyValue(modelValue)">{{ nullLabel }}</span>
        <el-tag
          v-else
          v-for="item in selectedItems"
          :key="item.value"
          size="small"
          :color="getBackgrouncolor(item.color)"
          :style="`color:${item.color || 'rgb(144, 147, 153)'};border-color:${getBackgrouncolor(item.color)};border-radius:4px;margin-right:8px;height:26px;`"
        >{{ item.label }}</el-tag>
      </template>
      <template v-else>
        <span v-if="isEmptyValue(modelValue)">{{ nullLabel }}</span>
        <span v-else>{{ viewLabel }}</span>
      </template>
    </span>
    <el-select
      v-else
      v-bind="$attrs"
      :model-value="modelValue"
      :disabled="finalDisabled"
      :filterable="filterable"
      :clearable="clearable"
      :multiple="multiple"
      :placeholder="placeholder"
      :size="size"
      @update:model-value="handleModelValue"
      @change="handleChange"
      @clear="handleClear"
    >
      <template v-if="hasPrefixItem" #prefix>
        <slot name="prefix" />
      </template>
      <el-option
        v-for="option in finalOptions"
        :key="option.value"
        :label="option.label"
        :value="option.value"
        :disabled="option.disabled"
      >
        <el-tag
          v-if="isHighlight"
          size="small"
          :color="getBackgrouncolor(option.color)"
          :style="`color:${option.color || 'rgb(144, 147, 153)'};border-color:${getBackgrouncolor(option.color)};border-radius:4px;height:26px;`"
        >{{ option.label }}</el-tag>
      </el-option>
    </el-select>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { get } from 'lodash'
import { getBackgrouncolor } from '../../utils/util'
import PmSelectDict from '../pm-select-dict/pc.vue'
import PmSelectEntity from '../pm-select-entity/pc.vue'
import PmSelectUser from '../pm-select-user/pc.vue'
import PmSelectOrg from '../pm-select-org/pc.vue'
import PmSelectPosition from '../pm-select-position/pc.vue'
import PmLookup from '../pm-lookup/pc.vue'

/**
 * 下拉选择器总入口组件。
 *
 * 不传 type（或 type 为空）时为基础 el-select，支持静态 options：
 * - 可通过 options 属性直接传入 [{ label, value, disabled, color }]
 * - 兼容旧用法 settings.options（settings 其余字段已不再参与数据加载）
 *
 * 传 type 时深度代理到对应的专用下拉组件：
 * - dict → pm-select-dict
 * - entity → pm-select-entity
 * - user → pm-select-user
 * - org → pm-select-org
 * - position → pm-select-position
 * - lookup → pm-lookup
 * 代理时透传所有 $attrs、事件与插槽到子组件。
 *
 * @example 基础用法 - <pm-select v-model="val" :options="[{ label: 'A', value: 'A' }]" />
 * @example 字典代理 - <pm-select v-model="val" type="dict" dict-type-code="gender" />
 * @example 实体代理 - <pm-select v-model="val" type="entity" entity="User" label-field="userName" />
 * @example 用户代理 - <pm-select v-model="val" type="user" />
 */
export default defineComponent({
  name: 'PmSelect',
  props: {
    /** v-model 绑定值，单选为 String/Number，多选为 Array */
    modelValue: { default: null },
    /** 下拉组件类型：不传/为空则使用基础 el-select；dict/entity/user/org/position/lookup 深度代理到对应子组件 */
    type: { type: String, default: '' },
    /** 静态选项 [{ label, value, disabled, color }] */
    options: { type: Array, default: () => [] },
    /** 兼容旧用法：仅读取 settings.options / settings.labelField / settings.valueField / settings.disabledField */
    settings: { type: Object, default: () => ({}) },
    /** 显示模式：edit-编辑模式 view-纯文本展示 */
    mode: { type: String, default: 'edit' },
    /** 是否禁用 */
    disabled: { type: Boolean, default: false },
    /** 是否只读 */
    readonly: { type: Boolean, default: false },
    /** 是否多选 */
    multiple: { type: Boolean, default: false },
    /** 是否显示清空按钮 */
    clearable: { type: Boolean, default: false },
    /** 是否可搜索过滤 */
    filterable: { type: Boolean, default: false },
    /** 占位文本 */
    placeholder: { type: String, default: '' },
    /** 多选分隔符（保留，主要供代理子组件使用） */
    separator: { type: String, default: ',' },
    /** 空值占位文本 */
    nullLabel: { type: String, default: '--' },
    /** 是否高亮显示选中项 */
    isHighlight: { type: Boolean, default: false },
    /** 是否渲染 prefix 插槽 */
    hasPrefixItem: { type: Boolean, default: false },
    /** 基础 el-select 尺寸 */
    size: { type: String, default: 'small' },
    /** v-model:selected 绑定的选中对象，单选为 Object，多选为 Array */
    selected: { default: undefined },
    /* ============ 以下属性用于透传给代理子组件 ============ */
    maxOptions: { type: Number, default: 200 },
    isInChildren: { type: Boolean, default: false },
    optionTemplateIsEnable: { type: Boolean, default: false },
    lableJs: { type: String, default: '' },
    lableJsEnable: { type: Boolean, default: false },
    entityModel: { default: null },
    isDynamicSearch: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'update:selected', 'change'],
  computed: {
    /** type 对应渲染的代理子组件；type 不在映射表内时返回 null，走基础 el-select 逻辑 */
    proxyComponent() {
      const proxyMap = {
        dict: PmSelectDict,
        entity: PmSelectEntity,
        user: PmSelectUser,
        org: PmSelectOrg,
        position: PmSelectPosition,
        lookup: PmLookup,
      }
      return proxyMap[this.type] || null
    },
    /**
     * 深度代理时透传给子组件的属性。
     * $attrs 外的 facade 声明属性不会被放入 $attrs，这里按子组件实际声明的 props 过滤后一并透传。
     * type 本身永远不透传（避免与 pm-select-user 等的按钮 type 冲突）。
     */
    proxyAttrs() {
      const comp = this.proxyComponent
      if (!comp) return {}
      const declared = comp.props ? Object.keys(comp.props) : []
      const shared = {
        multiple: this.multiple,
        clearable: this.clearable,
        filterable: this.filterable,
        placeholder: this.placeholder,
        separator: this.separator,
        maxOptions: this.maxOptions,
        isHighlight: this.isHighlight,
        size: this.size,
        isInChildren: this.isInChildren,
        optionTemplateIsEnable: this.optionTemplateIsEnable,
        lableJs: this.lableJs,
        lableJsEnable: this.lableJsEnable,
        entityModel: this.entityModel,
        isDynamicSearch: this.isDynamicSearch,
      }
      const forwarded = {}
      for (const key of Object.keys(shared)) {
        if (declared.includes(key)) forwarded[key] = shared[key]
      }
      return { ...this.$attrs, ...forwarded }
    },
    /** 归一化后的静态选项列表 */
    finalOptions() {
      const list = (this.options && this.options.length) ? this.options : (this.settings?.options || [])
      const labelField = this.settings?.labelField || 'label'
      const valueField = this.settings?.valueField || 'value'
      const disabledField = this.settings?.disabledField || 'disabled'
      return (Array.isArray(list) ? list : [])
        .map(item => {
          if (item == null) return null
          if (typeof item !== 'object') {
            return { label: String(item), value: item, disabled: false, color: '' }
          }
          return {
            label: get(item, labelField) ?? item.label ?? item.name ?? '',
            value: get(item, valueField) ?? item.value ?? item.code ?? '',
            disabled: item.disabled ?? get(item, disabledField),
            color: item.color ?? item.extend ?? '',
            _data: item,
          }
        })
        .filter(Boolean)
    },
    /** 基础模式下与 modelValue 匹配的选中项 */
    selectedItems() {
      if (this.isEmptyValue(this.modelValue)) return []
      const arr = (this.multiple && Array.isArray(this.modelValue)) ? this.modelValue : [this.modelValue]
      return arr
        .map(v => this.finalOptions.find(o => String(o.value) === String(v)))
        .filter(Boolean)
    },
    /** view 模式展示文本，优先使用外部传入的 selected */
    viewLabel() {
      if (this.selected != null) {
        const arr = this.multiple
          ? (Array.isArray(this.selected) ? this.selected : [])
          : (this.selected ? [this.selected] : [])
        return arr.map(i => i?.label ?? i?.name ?? '').filter(Boolean).join('、')
      }
      return this.selectedItems.map(o => o.label).join('、')
    },
    finalDisabled() {
      return this.disabled || this.readonly
    },
  },
  methods: {
    isEmptyValue(val) {
      return val === null || val === undefined || val === ''
    },
    handleModelValue(val) {
      this.$emit('update:modelValue', val)
    },
    handleChange(val) {
      const list = (Array.isArray(val) ? val : [val])
        .map(v => this.finalOptions.find(o => String(o.value) === String(v)))
        .filter(Boolean)
      this.$emit('change', val)
      this.$emit('update:selected', this.multiple ? list : (list[0] || null))
    },
    handleClear() {
      const val = this.multiple ? [] : null
      this.$emit('update:modelValue', val)
      this.$emit('update:selected', this.multiple ? [] : null)
      this.$emit('change', val)
    },
    handleProxyModelValue(val) {
      this.$emit('update:modelValue', val)
    },
    handleProxySelected(val) {
      this.$emit('update:selected', val)
    },
    handleProxyChange(val) {
      this.$emit('change', val)
    },
    getBackgrouncolor,
  },
})
</script>

<style lang="scss" scoped>
.pm-select-view {
  .el-select {
    width: 100%;
  }
}
</style>
