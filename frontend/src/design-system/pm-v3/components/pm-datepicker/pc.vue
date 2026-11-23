<template>
  <div>
    <div v-if="mode === 'view'">{{ showContent || formatNullValue }}</div>
    <template v-else-if="mode === 'edit'">
      <null-value
        v-if="!modelValue && (disabled || readonly)"
        :disabled="disabled"
        :readonly="readonly"
      />
      <el-date-picker
        v-else
        ref="dateRef"
        :key="isHourOnly"
        v-model="localValue"
        v-bind="filteredAttrs"
        :format="displayFormat"
        :value-format="displayValueFormat"
        :disabled-date="getDisabledDate"
        :popper-class="isHourOnly ? 'pickerDeleteMinutes' : ''"
        style="width: 100%"
        :readonly="readonly"
        :disabled="disabled || false"
        @focus="handleFocus"
        @change="handleChange"
      />
    </template>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import moment from 'dayjs'
import formatNullValue from '../mixins/formatNullValue.js'

const DATE_FORMATS = {
  yyyy: 'YYYY',
  'yyyy-MM': 'YYYY-MM',
  'yyyy-MM-dd': 'YYYY-MM-DD',
  'yyyy-MM-dd HH': 'YYYY-MM-DD HH',
  'yyyy-MM-dd HH:mm': 'YYYY-MM-DD HH:mm',
  'yyyy-MM-dd HH:mm:ss': 'YYYY-MM-DD HH:mm:ss',
}

const SHORTCUTS = {
  week: {
    text: '本周',
    getRange: today => {
      const currentDay = today.getDay()
      const start = new Date(today)
      start.setDate(today.getDate() - currentDay)
      const end = new Date(today)
      end.setDate(today.getDate() + (6 - currentDay))
      return { start, end }
    }
  },
  lastWeek: {
    text: '上周',
    getRange: today => {
      const { start, end } = SHORTCUTS.week.getRange(today)
      return {
        start: new Date(start.setDate(start.getDate() - 7)),
        end: new Date(end.setDate(end.getDate() - 7))
      }
    }
  },
  nextWeek: {
    text: '下周',
    getRange: today => {
      const { start, end } = SHORTCUTS.week.getRange(today)
      return {
        start: new Date(start.setDate(start.getDate() + 7)),
        end: new Date(end.setDate(end.getDate() + 7))
      }
    }
  },
  month: {
    text: '本月',
    getRange: today => ({
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: new Date(today.getFullYear(), today.getMonth() + 1, 0)
    })
  },
  lastMonth: {
    text: '上月',
    getRange: today => ({
      start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      end: new Date(today.getFullYear(), today.getMonth(), 0)
    })
  },
  nextMonth: {
    text: '下月',
    getRange: today => ({
      start: new Date(today.getFullYear(), today.getMonth() + 1, 1),
      end: new Date(today.getFullYear(), today.getMonth() + 2, 0)
    })
  },
  recentWeek: {
    text: '最近一周',
    getRange: () => ({
      start: new Date(Date.now() - 3600 * 1000 * 24 * 7),
      end: new Date()
    })
  },
  recentTwoWeeks: {
    text: '最近两周',
    getRange: () => ({
      start: new Date(Date.now() - 3600 * 1000 * 24 * 14),
      end: new Date()
    })
  },
  recentMonth: {
    text: '最近一个月',
    getRange: () => ({
      start: new Date(Date.now() - 3600 * 1000 * 24 * 30),
      end: new Date()
    })
  },
}

/**
 * 日期选择器组件，基于 el-date-picker 封装，支持日期/月份/年份选择
 */
export default defineComponent({
  name: 'PmDatePicker',
  mixins: [formatNullValue],
  emits: ['update:modelValue', 'update:max', 'update:min', 'update:maxValue', 'update:minValue', 'change'],
  props: {
    modelValue: { default: null },
    value: { default: undefined },
    settings: {
      type: Object,
      default: () => ({
        pickerCustomChecked: false,
        customPickerDays: 0,
        pickerDays: 0,
        startTime: null,
        endTime: null,
      })
    },
    mode: { type: String, default: 'edit' },
    readonly: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    isInChildren: { type: Boolean, default: false },
    isPickerRange: { type: Boolean, default: false },
    maxValue: { type: String, default: '' },
    minValue: { type: String, default: '' },
    shortcutsProp: { type: Boolean, default: false },
    isEndDate: { type: Boolean, default: false },
  },
  data() {
    return {}
  },
  computed: {
    _value() {
      return this.modelValue !== undefined ? this.modelValue : this.value
    },
    localValue: {
      get() {
        if (!this._value) return null
        const momentVal = moment(this._value)
        if (!momentVal.isValid()) return null
        return momentVal.format(this.displayValueFormat)
      },
      set(val) {
        if (!val) {
          this.$emit('update:modelValue', val)
          this.$emit('update:max', null)
          this.$emit('update:min', null)
          return
        }
        const formatToUnitMap = {
          'yyyy': 'year',
          'yyyy-MM': 'month',
          'yyyy-MM-dd': 'day',
          'yyyy-MM-dd HH': 'hour'
        }
        const unit = formatToUnitMap[this.$attrs.format]
        const valueFormat = this.$attrs.valueFormat || 'yyyy-MM-dd HH:mm:ss'
        const dayjsFormat = this.convertFormat(valueFormat)
        let formattedVal = this.completeDateTimeByType(val)
        if (this.isPickerRange && this.isEndDate && unit) {
          this.$emit('update:modelValue', moment(formattedVal).endOf(unit).format(dayjsFormat))
        } else if (this.isPickerRange && !this.isEndDate && unit) {
          this.$emit('update:modelValue', moment(formattedVal).startOf(unit).format(dayjsFormat))
        } else {
          this.$emit('update:modelValue', moment(formattedVal).format(dayjsFormat))
        }
      },
    },
    showContent() {
      if (!this._value) return ''
      const format = this.$attrs.format || 'yyyy-MM-dd HH:mm:ss'
      return moment(this._value).format(this.convertFormat(format))
    },
    isDateTimePicker() {
      return this.$attrs.type === 'datetime' || this.$attrs.type === 'datetimerange' || this.isHourOnly
    },
    displayFormat() {
      const format = this.$attrs.format || 'YYYY-MM-DD HH:mm:ss'
      return this.convertFormat(format)
    },
    displayValueFormat() {
      const valueFormat = this.$attrs.valueFormat || 'YYYY-MM-DD HH:mm:ss'
      return this.convertFormat(valueFormat)
    },
    filteredAttrs() {
      const { format, valueFormat, ...rest } = this.$attrs
      return rest
    },
    isHourOnly() {
      return this.$attrs.format === 'yyyy-MM-dd HH'
    },
    maxIntervalDays() {
      if (!this.isPickerRange) return null
      return this.settings.pickerCustomChecked ? this.settings.customPickerDays : this.settings.pickerDays
    },
  },
  methods: {
    convertFormat(format) {
      const formatMap = { 'yyyy': 'YYYY', 'MM': 'MM', 'dd': 'DD', 'HH': 'HH', 'mm': 'mm', 'ss': 'ss' }
      return format.replace(/yyyy|MM|dd|HH|mm|ss/g, match => formatMap[match])
    },
    completeDateTimeByFormat(val) {
      const momentVal = moment(val)
      if (!momentVal.isValid()) return null
      return momentVal.toDate()
    },
    completeDateTimeByType(val) {
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
        default: return val
      }
    },
    getDisabledDate(time) {
      const timeValue = time.getTime()
      if (this.isDateOutsideRange(time)) return true
      if (this.isPickerRange) {
        if (this.isEndDate) {
          if (this.minValue) {
            const minDate = new Date(this.minValue)
            if (timeValue < minDate.getTime()) return true
          }
          if (this.minValue && this.maxIntervalDays > 0) {
            const minDate = new Date(this.minValue)
            const maxAllowedDate = new Date(minDate)
            maxAllowedDate.setDate(minDate.getDate() + this.maxIntervalDays)
            if (timeValue > maxAllowedDate.getTime()) return true
          }
        } else {
          if (this.maxValue) {
            const maxDate = new Date(this.maxValue)
            if (timeValue > maxDate.getTime()) return true
          }
          if (this.maxValue && this.maxIntervalDays > 0) {
            const maxDate = new Date(this.maxValue)
            const minAllowedDate = new Date(maxDate)
            minAllowedDate.setDate(maxDate.getDate() - this.maxIntervalDays)
            if (timeValue < minAllowedDate.getTime()) return true
          }
        }
      }
      return false
    },
    isDateOutsideRange(time) {
      const { startTime, endTime } = this.settings
      if (startTime) {
        const startDate = moment(startTime).startOf('day')
        const currentDate = moment(time).startOf('day')
        if (currentDate.isBefore(startDate)) return true
      }
      if (endTime) {
        const endDate = moment(endTime).startOf('day')
        const currentDate = moment(time).startOf('day')
        if (currentDate.isAfter(endDate)) return true
      }
      return false
    },
    handleFocus() {},
    handleChange(val) {
      this.turnTorangeValue()
      if (this.isPickerRange) {
        if (!this.isEndDate && val) {
          this.$emit('update:minValue', val)
        } else if (this.isEndDate && val) {
          this.$emit('update:maxValue', val)
        }
      }
    },
    turnTorangeValue() {
      if (!this.$attrs.shortcuts) {
        const type = this.$attrs.type
        const value = this.localValue
        if (!value) return
        let startDate = null, endDate = null
        if (type === 'month') {
          startDate = moment(value).startOf('month')
          endDate = moment(value).endOf('month')
        } else if (type === 'year') {
          startDate = moment(value).startOf('year')
          endDate = moment(value).endOf('year')
        } else if (type === 'date') {
          startDate = moment(value).startOf('day')
          endDate = moment(value).endOf('day')
        }
        const format = this.$attrs.valueFormat || 'yyyy-MM-dd HH:mm:ss'
        if (format) {
          const dayjsFormat = this.convertFormat(format)
          if (endDate) this.$emit('update:max', endDate.format(dayjsFormat))
          if (startDate) this.$emit('update:min', startDate.format(dayjsFormat))
        }
      }
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
.pickerDeleteMinutes {
  .el-scrollbar:nth-of-type(2) {
    display: none !important;
  }
  .el-time-spinner {
    text-align: center;
  }
}
</style>
