<template>
  <div v-if="readonly">{{ customContent }}</div>
  <div v-else-if="mode === 'edit'">
    <el-checkbox-group v-if="options && options.length > 0" v-bind="$attrs" :disabled="finalDisabled" v-model="valueKey" class="pm-checkbox-button">
      <component :is="checkboxType" :class="{'compotent-block': showStyle==='column'}" v-for="option in optionsFilter" :key="option.value" :label="option.label" :value="option.value" :disabled="option.disabled">
        <span :style="{'color': isHighlight ? option.color : ''}">{{ option.label }}</span>
      </component>
    </el-checkbox-group>
    <div v-else-if="emptyText">{{ emptyText }}</div>
  </div>
  <div v-else-if="mode === 'view'">{{ showContent }}</div>
  <div v-else />
</template>

<script>
/**
 * 复选框组组件
 * @example 基础用法 - <pm-checkbox-group v-model="value" :settings="settings" />
 */
import { defineComponent } from 'vue'
import datasource from '../mixins/datasource.js'
export default defineComponent({
  name: 'PmCheckboxGroup',
  mixins: [datasource],
  props: {
    emptyText: { default: '' },
    optionType: { default: undefined },
    showStyle: { type: String, default: 'row' },
    readonly: { type: Boolean, default: false },
    isHighlight: { type: Boolean, default: false },
  },
  computed: {
    customContent() {
      if (this.readonly) {
        if (Array.isArray(this.showContent)) {
          return this.showContent.map((ele) => ele.label || ele.name).join(',')
        }
        const { label } = this.showContent || {}
        return label || this.showContent
      }
    },
    checkboxType() {
      return this.optionType === 'button' ? 'el-checkbox-button' : 'el-checkbox'
    },
  },
})
</script>

<style lang="scss" scoped>
.compotent-block {
  display: block;
  width: 100%;
}
:deep(.el-checkbox__label) {
  position: relative;
  z-index: 100;
}
</style>
