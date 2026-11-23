<template>
  <div v-if="readonly">{{ customContent }}</div>
  <div v-else-if="mode === 'edit'">
    <el-radio-group v-if="optionsFilter && optionsFilter.length > 0" v-model="valueKey" class="pm-radio-button" v-bind="$attrs" :disabled="finalDisabled">
      <component :is="radioType" @click.native="onRadioChange($event)" :class="{'compotent-block': showStyle==='column'}" v-for="option in optionsFilter" :key="option.value" :label="option.label" :value="option.value" :disabled="option.disabled">
        <span :style="{'color': isHighlight ? option.color : ''}">{{ option.label }}</span>
      </component>
    </el-radio-group>
    <div v-else-if="emptyText">{{ emptyText }}</div>
  </div>
  <div v-else-if="mode === 'view'">{{ showContent }}</div>
  <div v-else />
</template>

<script>
import { defineComponent } from 'vue'
import { get } from 'lodash'
import datasource from '../mixins/datasource.js'
/**
 * 单选框组组件，基于 el-radio-group 封装，支持选项列表、禁用和自定义样式
 */
export default defineComponent({
  name: 'PmRadioGroup',
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
    radioType() {
      return this.optionType === 'button' ? 'el-radio-button' : 'el-radio'
    },
  },
  methods: {
    onRadioChange(e) {
      if (get(e, 'currentTarget.__vue__._props.value') === this.value && !this.finalDisabled) {
        this.valueKey = null
        e.stopPropagation()
        e.preventDefault()
        return false
      }
    },
  },
})
</script>

<style lang="scss" scoped>
.compotent-block { display: block; }
:deep(.el-radio) { position: relative; z-index: 100; }
</style>
