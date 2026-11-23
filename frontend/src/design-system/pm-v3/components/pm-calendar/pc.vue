<template>
  <div class="calendar-view">
    <div class="calendar-view-main">
      <div class="calendar">
        <DatePanel
          ref="dateSelect"
          :dateField="dateField"
          v-model:cardList="cardList"
          v-model:dateList="dateList"
        />
        <DraggablePanel
          ref="draggablePanel"
          class="month"
          dateType="month"
          :dateField="dateField"
          :endConfig="endConfig"
          :recordConfig="recordConfig"
          :colorConfig="colorConfig"
          :rowConfig="rowConfig"
          :toolConfig="toolConfig"
          :data="data"
          v-model:dateList="dateList"
          :options="options"
          :formProxy="formProxy"
          :pkField="pkField"
          :mergeReadonly="mergeReadonly"
          @operCard="operateCard"
          @addCard="addCard"
          @moveCard="moveCard"
          @resizeCard="resizeCard"
        />
      </div>
    </div>
  </div>
</template>

<script>
import dayjs from "dayjs";
import { cloneDeep, get } from "lodash";
import DatePanel from "./DatePanel.vue"
import DraggablePanel from "./DraggablePanel.vue"
import { assembleData } from "./utils"

/**
 * 日历组件，展示日期日历，支持日期选择、事件标记和视图切换
 */
export default {
  name: 'pm-calendar',
  components: {
    DatePanel,
    DraggablePanel,
  },
  props: {
    data: {
      type: Array,
      default: () => [],
    },
    options: {
      type: Object,
      default: () => ({}),
    },
    formProxy: {
      type: Object,
      default: () => ({}),
    },
    pkField: {
      type: String,
      default: () => 'id',
    },
    mergeReadonly: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      cardList: [],
      dateList: [],
      cardListRaw: [],
      dateField: {
        start: '',
        end: '',
      },
    }
  },
  computed: {
    startConfig() {
      const startConfig = get(this.options, 'startConfig', {})
      if(!startConfig || !startConfig.dateField) {
        this.$notify.warning({
          title: '提示',
          message: '未设置开始日期字段，请在日历视图配置中设置'
        });
        return startConfig
      }
      const dateTypeSet = ['date', 'datetime', 'year', 'month']
      if(startConfig && startConfig.type && !dateTypeSet.includes(startConfig.type)) {
        this.$notify.error({
          title: '提示',
          message: '开始日期字段格式不正确，请在日历视图配置中设置'
        });
      }
      return startConfig
    },
    endConfig() {
      const endConfig = get(this.options, 'endConfig', {})
      const dateTypeSet = ['date', 'datetime', 'year', 'month']
      if(endConfig && endConfig.type && !dateTypeSet.includes(endConfig.type)) {
        this.$notify.error({
          title: '提示',
          message: '结束日期字段格式不正确，请在日历视图配置中设置'
        });
      }
      return endConfig
    },
    recordConfig() {
      return get(this.options, 'recordConfig', {})
    },
    colorConfig() {
      return get(this.options, 'colorConfig', {})
    },
    rowConfig() {
      return get(this.options, 'rowConfig', {})
    },
    toolConfig() {
      return get(this.options, 'toolConfig', {})
    },
  },
  watch: {
    data: {
      deep: true,
      immediate: true,
      handler(val) {
        if(!val || !val.length) return
        if(!this.options.fields || !this.options.fields.length) return
        this.cardListRaw = this.handleData(val, this.options.fields)
        this.cardList = assembleData({
          cardListRaw: this.cardListRaw,
          startField: this.startConfig.dateField,
          endField: this.endConfig.dateField,
        })
      }
    },
    'startConfig.dateField': {
      immediate: true,
      handler(val) {
        this.dateField.start = val || ''
      }
    },
    'endConfig.dateField': {
      immediate: true,
      handler(val) {
        this.dateField.end = val || ''
      }
    },
  },
  methods: {
    handleData(data = [], fields) {
      return cloneDeep(data).map(item => {
        fields.forEach((col) => {
          let attr = col.name
          if(attr in item) {
            let oldVal = item[attr]
            item[attr] = {
              label: col.title,
              value: oldVal,
            }
          }
        })
        return item
      })
    },
    isSameDate(d1, d2) {
      if(!d1 || !d2 || !d1.value) return false;
      return dayjs(d1.value).isSame(dayjs(d2))
    },
    operateCard({ card, action }) {
      const targetItem = this.data.find(item => Number(item[this.pkField]) === Number(card[this.pkField]));
      if (!targetItem) return;
      this.$emit(`${action}Card`, targetItem);
      if(action === 'view') {
        this.$emit(`clickCard`, targetItem);
      }
    },
    addCard({ partialCard }) {
      this.$emit("addCard", partialCard);
    },
    moveCard({ day }) {
      const { isSameDate, dateField } = this
      for (const card of day.cardList) {
        if(card.isPlaceholder) continue
        if(!isSameDate(card[dateField.start], day.dateString)) {
          const targetItem = this.data.find(item => Number(item[this.pkField]) === Number(card[this.pkField]));
          if (!targetItem) return;
          targetItem[dateField.start] = dayjs(day.dateString).format("YYYY-MM-DD")
          if(dateField.end) targetItem[dateField.end] = dayjs(day.dateString).add(card.daysInTotal - 1, 'day').format("YYYY-MM-DD")
          this.$emit("moveCard", targetItem);
          this.$emit("cardMove", targetItem);
          return
        }
      }
    },
    resizeCard({ card, day, resizePos = 'start', direction = 'left', benchmarkDay }) {
      const { start, end } = this.dateField
      if(!end) return
      const targetItem = this.data.find(item => Number(item[this.pkField]) === Number(card[this.pkField]));
      if(!targetItem) return
      if('start' === resizePos) {
        targetItem[start] = dayjs(day.dateString).format("YYYY-MM-DD")
        if('left' === direction) targetItem[end] = benchmarkDay
        if('right' === direction) {
          targetItem[end] = dayjs(benchmarkDay).subtract(1, "day").format("YYYY-MM-DD")
        }
      }
      if('end' === resizePos) {
        targetItem[end] = dayjs(day.dateString).format("YYYY-MM-DD")
        if('right' === direction) targetItem[start] = benchmarkDay
        if('left' === direction) {
          targetItem[start] = dayjs(benchmarkDay).add(1, "day").format("YYYY-MM-DD")
        }
      }
      this.$emit("moveCard", targetItem);
      this.$emit("cardResize", targetItem);
    },
  },
}
</script>

<style lang="scss" scoped>
.calendar-view {
  box-sizing: border-box;
  color: #000;
  font-size: 18px;
  font-weight: 500;
  .calendar-view-main {
    display: flex;
    overflow: auto;
    .calendar {
      box-sizing: border-box;
      flex-grow: 1;
      height: 100%;
      font-size: 20px;
      font-weight: 600;
    }
  }
}
</style>
