<template>
  <div>
    <el-date-picker
      v-model="rangeValue"
      v-bind="filteredAttrs"
      :type="rangeType"
      :format="displayFormat"
      :value-format="displayValueFormat"
      :start-placeholder="startPlaceholder"
      :end-placeholder="endPlaceholder"
      :disabled-date="getDisabledDate"
      :popper-class="isHourOnly ? 'date-range-hour-only' : ''"
      :shortcuts="shortcutOptions"
      style="width: 100%"
      range-separator="~"
      @change="handleChange"
    />
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import moment from 'dayjs'

const SHORTCUTS = {
  week: {
    text: '本周',
    getRange: today => {
      const currentDay = today.getDay()
      const start = new Date(today)
      start.setDate(today.getDate() - currentDay)
      const end = new Date(today)
      end.setDate(today.getDate() + (6 - currentDay))
      return [start, end]
    }
  },
  lastWeek: {
    text: '上周',
    getRange: today => {
      const currentDay = today.getDay()
      const start = new Date(today)
      start.setDate(today.getDate() - currentDay - 7)
      const end = new Date(today)
      end.setDate(today.getDate() - currentDay - 1)
      return [start, end]
    }
  },
  nextWeek: {
    text: '下周',
    getRange: today => {
      const currentDay = today.getDay()
      const start = new Date(today)
      start.setDate(today.getDate() + (7 - currentDay))
      const end = new Date(today)
      end.setDate(today.getDate() + (13 - currentDay))
      return [start, end]
    }
  },
  month: {
    text: '本月',
    getRange: today => [
      new Date(today.getFullYear(), today.getMonth(), 1),
      new Date(today.getFullYear(), today.getMonth() + 1, 0)
    ]
  },
  lastMonth: {
    text: '上月',
    getRange: today => [
      new Date(today.getFullYear(), today.getMonth() - 1, 1),
      new Date(today.getFullYear(), today.getMonth(), 0)
    ]
  },
  nextMonth: {
    text: '下月',
    getRange: today => [
      new Date(today.getFullYear(), today.getMonth() + 1, 1),
      new Date(today.getFullYear(), today.getMonth() + 2, 0)
    ]
  },
  recentWeek: {
    text: '最近一周',
    getRange: () => [
      new Date(Date.now() - 3600 * 1000 * 24 * 7),
      new Date()
    ]
  },
  recentTwoWeeks: {
    text: '最近两周',
    getRange: () => [
      new Date(Date.now() - 3600 * 1000 * 24 * 14),
      new Date()
    ]
  },
  recentMonth: {
    text: '最近一个月',
    getRange: () => [
      new Date(Date.now() - 3600 * 1000 * 24 * 30),
      new Date()
    ]
  },
}

/**
 * 日期范围选择器组件，基于 el-date-picker 封装，支持开始/结束日期范围选择
 */
export default defineComponent({
  name: 'PmDatePickerRange',
  emits: ['update:modelValue', 'update:value2'],
  props: {
    modelValue: { default: null },
    value: { default: undefined },
    value2: { default: null },
    settings: { type: Object, default: () => ({}) },
    placeholder: { type: String, default: '开始日期' },
    placeholder2: { type: String, default: '结束日期' },
    valueFormat: { type: String, default: '' },
    shortcutsProp: { type: Boolean, default: false },
  },
  computed: {
    _value() {
      return this.modelValue !== undefined ? this.modelValue : this.value
    },
    rangeType() {
      const type = this.$attrs.type || 'date'
      if (type === 'datetime') return 'datetimerange'
      if (type === 'month') return 'monthrange'
      return 'daterange'
    },
    startPlaceholder() {
      return this.placeholder
    },
    endPlaceholder() {
      return this.placeholder2
    },
    isHourOnly() {
      return this.valueFormat === 'yyyy-MM-dd HH'
    },
    displayFormat() {
      const format = this.$attrs.format || this.valueFormat || 'YYYY-MM-DD HH:mm:ss'
      return this.convertFormat(format)
    },
    displayValueFormat() {
      const vf = this.valueFormat || 'YYYY-MM-DD HH:mm:ss'
      return this.convertFormat(vf)
    },
    filteredAttrs() {
      const { format, type, ...rest } = this.$attrs
      return rest
    },
    rangeValue: {
      get() {
        const start = this._value
        const end = this.value2
        if (!start && !end) return null
        const dayjsFormat = this.displayValueFormat
        const result = []
        if (start) {
          const m = moment(start)
          result.push(m.isValid() ? m.format(dayjsFormat) : null)
        }
        if (end) {
          const m = moment(end)
          result.push(m.isValid() ? m.format(dayjsFormat) : null)
        }
        return result.length ? result : null
      },
      set(val) {
        if (!val) {
          this.$emit('update:modelValue', null)
          this.$emit('update:value2', null)
          return
        }
        const dayjsFormat = this.displayValueFormat
        const valueFormat = this.valueFormat || 'yyyy-MM-dd HH:mm:ss'
        const emitFormat = this.convertFormat(valueFormat)
        const start = val[0] ? this.completeDateTimeByType(val[0], emitFormat) : null
        const end = val[1] ? this.completeDateTimeByType(val[1], emitFormat) : null
        this.$emit('update:modelValue', start)
        this.$emit('update:value2', end)
      },
    },
    shortcutOptions() {
      if (!this.shortcutsProp) return undefined
      const today = new Date()
      return Object.values(SHORTCUTS).map(s => ({
        text: s.text,
        value: s.getRange(today),
      }))
    },
  },
  methods: {
    convertFormat(format) {
      const formatMap = { 'yyyy': 'YYYY', 'MM': 'MM', 'dd': 'DD', 'HH': 'HH', 'mm': 'mm', 'ss': 'ss' }
      return format.replace(/yyyy|MM|dd|HH|mm|ss/g, match => formatMap[match])
    },
    completeDateTimeByType(val, dayjsFormat) {
      const type = this.$attrs.type || 'date'
      const momentVal = moment(val)
      switch (type) {
        case 'year': return momentVal.format('YYYY') + '-01-01 00:00:00'
        case 'month': return momentVal.format('YYYY-MM') + '-01 00:00:00'
        case 'date': return momentVal.format('YYYY-MM-DD') + ' 00:00:00'
        case 'datetime': {
          const datePart = momentVal.format('YYYY-MM-DD')
          const hour = momentVal.hour() || 0
          const minute = momentVal.minute() || 0
          const second = momentVal.second() || 0
          return `${datePart} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
        }
        default: return momentVal.format(dayjsFormat)
      }
    },
    getDisabledDate(time) {
      const { startTime, endTime } = this.settings
      const timeValue = time.getTime()
      if (startTime) {
        const startDate = new Date(startTime).setHours(0, 0, 0, 0)
        if (timeValue < startDate) return true
      }
      if (endTime) {
        const endDate = new Date(endTime).setHours(23, 59, 59, 999)
        if (timeValue > endDate) return true
      }
      return false
    },
    handleChange(val) {
      this.$emit('change', val)
    },
  },
})
</script>

<style lang="scss" scoped>
:deep(.el-input__prefix) {
  i.el-input__icon.el-icon-date {
    font-size: 14px;
    color: #999999;
  }
}
</style>

<style lang="scss">
.date-range-hour-only {
  .el-scrollbar:nth-of-type(2) {
    display: none !important;
  }
  .el-time-spinner {
    text-align: center;
  }
}
</style>
