<template>
    <div style="width: 100%;">
        <!-- view 模式：纯文本展示 -->
        <template v-if="mode === 'view'">
            <null-value v-if="!modelValue" :disabled="disabled" :readonly="readonly" />
            <span v-else class="pm-input-view-text">{{ modelValue }}</span>
        </template>

        <!-- edit 模式：交互输入框 -->
        <template v-else>
            <null-value v-if="!modelValue && (disabled || readonly)" :disabled="disabled" :readonly="readonly" />
            <el-tooltip v-else :disabled="tooltipDisabled" :content="String(localValue || '')" placement="top">
              <div class="pm-input-tooltip-wrapper" @mouseenter="updateTooltip">
                <el-input
                  ref="inputRef"
                  v-model="localValue"
                  :disabled="disabled"
                  :readonly="readonly"
                  :placeholder="placeholder"
                  :clearable="clearable"
                  v-bind="$attrs"
                  @focus="handleFocus"
                  @blur="handleBlur"
                >
                  <template #prepend v-if="$slots.prepend">
                    <slot name="prepend" />
                  </template>
                  <template #append v-if="$slots.append">
                    <slot name="append" />
                  </template>
                  <template #suffix v-if="$slots.suffix">
                    <slot name="suffix" />
                  </template>
                  <template #prefix v-if="$slots.prefix">
                    <slot name="prefix" />
                  </template>
                </el-input>
              </div>
            </el-tooltip>
        </template>
    </div>
</template>
<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { InputInstance } from 'element-plus'
import NullValue from '../pm-null-value/pc.vue'

/**
 * 输入框组件
 * @example 基础用法 - <pm-input v-model="value" placeholder="请输入" />
 * @example 只读模式 - <pm-input v-model="value" mode="view" />
 * @example 前置内容 - <pm-input v-model="value"><template #prepend>Http://</template></pm-input>
 * @example 可清空 - <pm-input v-model="value" clearable />
 * @example 密码框 - <pm-input v-model="value" type="password" show-password />
 */
interface Props {
  /**
   * 输入框的值，支持 v-model 双向绑定
   * @type {String|Number}
   */
  modelValue?: string | number | null
  /**
   * 组件模式
   * @type {String}
   * @values edit, view
   * @default edit
   * @description edit 为编辑模式，view 为只读展示模式
   */
  mode?: 'edit' | 'view'
  /**
   * 是否禁用
   * @type {Boolean}
   * @default false
   */
  disabled?: boolean
  /**
   * 是否只读
   * @type {Boolean}
   * @default false
   */
  readonly?: boolean
  /**
   * 是否可清空
   * @type {Boolean}
   * @default false
   */
  clearable?: boolean
  /**
   * 输入框占位文本
   * @type {String}
   */
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  mode: 'edit',
  disabled: false,
  readonly: false,
  clearable: false,
  placeholder: undefined
})

interface Emits {
  (e: 'update:modelValue', value: string | number | null): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
  (e: 'input', value: string | number): void
  (e: 'change', value: string | number): void
  (e: 'clear'): void
}

const emit = defineEmits<Emits>()

const inputRef = ref<InputInstance | null>(null)
const isFocused = ref(false)
const tooltipDisabled = ref(true)

const localValue = computed({
  get() {
    return props.modelValue ?? null
  },
  set(val: string | number | null) {
    emit('update:modelValue', val)
  }
})

const handleFocus = (event: FocusEvent) => {
  isFocused.value = true
  tooltipDisabled.value = true
  emit('focus', event)
}

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false
  emit('blur', event)
  nextTick(() => {
    updateTooltip()
  })
}

const updateTooltip = () => {
  const input = inputRef.value?.$refs?.input as HTMLInputElement | undefined
  if (!input) {
    tooltipDisabled.value = true
    return
  }
  tooltipDisabled.value = isFocused.value || !localValue.value || input.scrollWidth <= input.clientWidth
}

// 暴露给父组件的方法
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  select: () => inputRef.value?.select()
})
</script>
<style lang="scss" scoped>
.pm-input-tooltip-wrapper {
  width: 100%;
}
.pm-input-view-text {
  display: inline-block;
  width: 100%;
  line-height: 32px;
  color: #333333;
  word-break: break-all;
  white-space: pre-wrap;
}
:deep(.el-input-group__append) {
  background-color: #F5F7FA !important;
  color: #909399 !important;
}
</style>