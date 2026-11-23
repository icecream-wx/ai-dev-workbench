<template>
  <el-input
    style="display: block;"
    class="component_number_class"
    ref="numberRef"
    v-bind="$attrs"
    v-model="localValue"
    :type="isLeave ? 'text' : 'number'"
    @blur="EditFunc('blur')"
    @focus="EditFunc('focus')"
  >
    <template #prefix v-if="prefixValue && fixShow">
      <span style="font-style: italic; font-size: 14px; color: #999999; line-height: 26px">{{ prefixValue }}</span>
    </template>
    <template #suffix v-if="suffixValue && fixShow">
      <span style="font-style: italic; color: #999999; line-height: 26px">{{ suffixValue }}</span>
    </template>
  </el-input>
</template>

<script setup>
/**
 * 数字输入框组件
 * @example 基础用法 - <pm-number v-model="value" />
 * @example 千分位 - <pm-number v-model="value" format-setting="thousand" />
 * @example 精度 - <pm-number v-model="value" :precision="2" />
 */
import { useNumber } from './number.js'

const props = defineProps({
  modelValue: { default: null },
  prefixValue: { type: String, default: '' },
  suffixValue: { type: String, default: '' },
  precision: { type: [Number, String], default: null },
  PositiveColor: { type: String, default: '' },
  minusColor: { type: String, default: '' },
  formatSetting: { type: String, default: '' },
  zeroSetting: { type: String, default: '' },
  zeroSettingCustom: { type: String, default: '' },
  nullSetting: { type: String, default: 'noshow' },
  nullSettingCustom: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const { localValue, isLeave, isFocused, numberRef, fixShow, EditFunc } = useNumber(props, emit)

defineExpose({
  focus: () => numberRef.value?.focus(),
  blur: () => numberRef.value?.blur(),
})
</script>

<style lang="scss">
.component_number_class {
  input.el-input__inner {
    color: #333333;
  }
  .el-input__inner::placeholder {
    color: #999999;
  }
  .el-input__prefix {
    left: 0;
    width: 34px;
    text-align: center;
    vertical-align: middle;
    i {
      font-size: 14px !important;
      margin: 0 !important;
      color: #999999;
    }
  }
  input::-webkit-inner-spin-button,
  input::-webkit-outer-spin-button {
    -webkit-appearance: none !important;
  }
  input[type='number'] {
    appearance: textfield;
  }
}
</style>
