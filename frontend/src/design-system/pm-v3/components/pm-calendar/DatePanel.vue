<!-- 日历面板 -->
<template>
  <div class="date-panel">
    <!-- 日历控制区 -->
    <div class="date-area">
      <div class="date-oper">
        <div class="date-type ml-10">
          <!-- 回到今天 -->
          <span :class="{'hide-today-btn': currDate.includeToday}" class="btn mr-10 go-firstDate noselect" @click="goToday">今天</span>
          <!-- 月、周切换 -->
          <span
            v-for="dt in dateTypeSet"
            :key="dt.value"
            class="btn mr-10 noselect"
            :class="{ active: dt.value === currDate.type }"
            @click="changeDateType(dt.value)"
          >{{ dt.label }}</span
          >
        </div>
      </div>
      <div class="date-label">
        <i @click="goCycle('prev')" class="btn mr-10 el-icon-arrow-left noselect"></i>
        <span class="label">{{ dateLabel }}</span>
        <i @click="goCycle('next')" class="btn ml-10 el-icon-arrow-right noselect"></i>
      </div>
    </div>

    <!-- 星期显示区 -->
    <div class="week-area">
      <div v-if="currDate.type === 'day'" class="week-col single-col noselect">
        {{ dayFilter(currDate.startDate) }}
      </div>
      <div v-else class="week-col seven-col noselect" v-for="week in weekSet" :key="week.value">
        {{ week.label }}
      </div>
    </div>
  </div>
</template>

<script>
import dayjs from "dayjs";
import { weekSet, dateTypeSet } from "./constants"

export default {
  name: "datePanel",
  components: {},
  props: {
    // 日期字段
    dateField: {
      type: Object,
      default: () => ({}),
    },
    // 日历记录列表
    cardList: {
      type: Array,
      default: () => [],
    },
    // 当前周期区间日期列表
    dateList: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      weekSet,
      dateTypeSet,
      // 当前周期区间对象
      currDate: {
        type: "month", // 日历类型 month/week/day
        startDate: null, // 开始日期
        endDate: null, // 结束日期
        includeToday: true, // 区间是否包含今天
      },
    };
  },
  computed: {
    startField() {
      return this.dateField.start;
    },
    endField() {
      return this.dateField.end || this.dateField.start;
    },
    dateLabel() {
      const start = this.currDate.startDate ? this.currDate.startDate.format("YYYY/MM/DD") : "";
      const end = this.currDate.endDate ? this.currDate.endDate.format("YYYY/MM/DD") : "";
      return end === start ? start : `${start} - ${end}`;
    },
    dateListInner: {
      get() {
        return this.dateList;
      },
      set(val) {
        this.$emit("update:dateList", val || []);
      },
    },
  },
  watch: {
    cardList: {
      deep: true,
      immediate: true,
      handler(val) {
        const { initCurrDate } = this;
        initCurrDate();
      },
    },
  },
  mounted() {},
  methods: {
    dayFilter(d) {
      const day = d.day();
      const targetDay = this.weekSet.find(({ value }) => value === day)
      return targetDay ? targetDay.label  : ''
    },
    // 切换到今天所在周期区间
    goToday() {
      const { initCurrDate } = this;
      this.currDate.includeToday = true
      initCurrDate()
    },
    // 切换到(前/后)一个周期区间
    goCycle(direction) {
      const { buildDateList, completeDateList } = this
      const { type, startDate } = this.currDate;
      const dayjsMethod = direction === 'prev' ? 'subtract' : 'add'; // dayjs 减去/增加时间的方法
      const today = dayjs();

      const newCycle = {}
      newCycle.startDate = startDate[dayjsMethod](1, type); // 新起始日取周期第一天
      if(type === 'month') {
        const daysInMonthNew = newCycle.startDate.daysInMonth();
        newCycle.endDate = newCycle.startDate.date(daysInMonthNew);
      }
      if (type === "week") newCycle.endDate = newCycle.startDate.add(6, "day");
      if (type === "day") newCycle.endDate = newCycle.startDate
      newCycle.includeToday = today.isSame(newCycle.startDate, type)

      this.currDate = {
        ...this.currDate,
        ...newCycle,
      }
      buildDateList();
      this.$nextTick(() => {
        completeDateList();
      })
    },
    // 初始化 currDate
    initCurrDate() {
      const { changeDateType } = this
      const { type } = this.currDate;
      changeDateType(type);
    },
    // 切换日期类型
    changeDateType(dateType) {
      const { updateCurrDate, buildDateList, completeDateList } = this
      this.currDate.type = dateType;
      updateCurrDate();
      buildDateList();
      this.$nextTick(() => {
        completeDateList();
      })
    },
    // 更新 currDate
    updateCurrDate() {
      const { type, startDate, includeToday } = this.currDate
      const today = dayjs();
      const anchorDate = includeToday ? today : startDate // 根据今日是否在当前周期区间内决定锚点日期
      if (type === "month") {
        this.currDate.startDate = anchorDate.date(1);
        this.currDate.endDate = this.currDate.startDate.date(anchorDate.daysInMonth());
      }
      if (type === "week") {
        this.currDate.startDate = anchorDate.subtract((anchorDate.day() || 7) - 1, "day"); // 周日的day属性为0,需要转为7方便计算
        this.currDate.endDate = this.currDate.startDate.add((6), "day");
      }
      if (type === "day") {
        this.currDate.startDate = anchorDate;
        this.currDate.endDate = anchorDate;
      }
    },
    // 生成当前周期内日期列表 dateList
    buildDateList() {
      const { type } = this.currDate
      const daysInWeek = 7;
      const listTotalMap = {
        month: 42,
        week: 7,
        day: 1,
      };
      this.dateListInner = Array.from({ length: listTotalMap[type] }).map((_, index) => {
        const dateItem = {
          id: index,
          number: index,
          day: (index + 1) % daysInWeek,
          date: null,
          dateString: '',
          cardList: [],
          widthinCurrMonth: true, // 是否日期在本月内
        };
        return dateItem;
      });
    },

    // 补全当前页的所有日期列表 dateList, 同时将 cardList 填入对应日期内
    completeDateList() {
      if (!this.dateListInner || !this.dateListInner.length) return;
      const { 
        fillEveryDateInsideRange,
        fillWithContinuousCardBeforeRange, 
        fillWithContinuousCardInsideRange, 
        fillEmptyWithPlaceholder,
      } = this
      fillEveryDateInsideRange()
      fillWithContinuousCardBeforeRange()
      fillWithContinuousCardInsideRange()
      fillEmptyWithPlaceholder()
    },
    // 遍历填入日期
    fillEveryDateInsideRange() {
      const daysInWeek = 7;
      const { startDate, type } = this.currDate; // [YYYY-MM-01, 'month']
      this.dateListInner.forEach((d, index) => {
        if (index === 0) {
          d.date = startDate.subtract(((startDate.day() + daysInWeek) - 1) % daysInWeek, "day"); // 锚定周期内第一天
        } else {
          d.date = this.dateListInner[index - 1].date.add(1, "day");
        }
        d.dateString = d.date.format("YYYY/MM/DD");
        if(type === 'month') {
          d.widthinCurrMonth = d.date.month() === startDate.month()
        }
      });
    },
    // 记录起始日<当前页第一天 且 记录结束日>=当前页第一天
    fillWithContinuousCardBeforeRange() {
      const { findFirstEmptyPos, startField, endField } = this
      if(!startField) return
      const firstDayIndex = 0
      const firstDayInCycle = this.dateListInner[firstDayIndex] // 暂存当前页第一天
      const prevCardMatchedSet = this.cardList.filter(({ 
        [startField]: start, 
        [endField]: end 
      }) => dayjs(start.value).isBefore(firstDayInCycle.date, 'day') 
        && (dayjs(end.value).isAfter(firstDayInCycle.date, 'day') || dayjs(end.value).isSame(firstDayInCycle.date, 'day'))
      )
      // console.log('prevCardMatchedSet :>> ', prevCardMatchedSet);
      prevCardMatchedSet.forEach((card) => {
        let cutOffPos = firstDayInCycle.date.diff(card[startField].value, 'day') // 记录起始日与当前页第一天相差天数
        let offset = cutOffPos
        const firstEmptyPos = findFirstEmptyPos(firstDayInCycle.cardList) // 找到card行在列表的位置
        while (offset < card.daysInTotal) {
          // console.log('offset :>> ', offset);
          const outOfCurrRange = firstDayIndex + (offset - cutOffPos) >= this.dateListInner.length  // 超出当前周期
          if(outOfCurrRange) break;
          const isHead = offset === 0 // 标记队头
          const isTail = offset + 1 === card.daysInTotal // 标记队尾
          const parentId = this.dateListInner[firstDayIndex + (offset - cutOffPos)].id
          const completeCard = {
            ...card,
            isHead,
            isTail,
            offset,
            parentId,
          }
          this.dateListInner[firstDayIndex + (offset - cutOffPos)].cardList[firstEmptyPos] = completeCard
          offset = offset + 1
        }
      })
    },
    // 根据单个记录的持续天数 daysInTotal, 将记录填入连续日期中列表的相同位置
    fillWithContinuousCardInsideRange() {
      const { isSameDate, findFirstEmptyPos, startField } = this
      if(!startField) return
      this.dateListInner.forEach((d, index) => {
        const cardMatchedSet = this.cardList.filter(({ [startField]: start }) => isSameDate(start, d.dateString)) // 起始日在当前天的记录
        cardMatchedSet.sort((a, b) => b.daysInTotal - a.daysInTotal) // 日期内卡片记录纵向排序, 依据持续天数从大到小
        // cardMatchedSet.sort((a, b) => a.daysInTotal - b.daysInTotal) // 从小到大
        cardMatchedSet.forEach((card) => {
          let offset = 0
          const firstEmptyPos = findFirstEmptyPos(d.cardList) // 找到card行在列表的位置
          while (offset < card.daysInTotal) {
            const outOfCurrRange = index + offset >= this.dateListInner.length  // 超出当前周期
            if(outOfCurrRange) break;
            const isHead = offset === 0
            const isTail = offset + 1 === card.daysInTotal
            const parentId = this.dateListInner[index + offset].id
            const completeCard = {
              ...card,
              isHead,
              isTail,
              offset,
              parentId,
            }
            this.dateListInner[index + offset].cardList[firstEmptyPos] = completeCard
            offset = offset + 1
          }
        })
      });
    },
    // 空位补填占位符
    fillEmptyWithPlaceholder() {
      this.dateListInner.forEach((d, index) => {
        for (let idx = 0; idx < d.cardList.length; idx++) {
          const card = d.cardList[idx]
          if(card) continue
          const cardEmpty = {
            id: 100000 + index * 1000 + idx,
            name: { label : '标题', value : '占位符' },
            isPlaceholder: true,
            isHead: false,
            isTail: false,
          }
          d.cardList[idx] = cardEmpty
        }
      })
    },
    // 找到当天空余的第一个位置
    findFirstEmptyPos(cardList) {
      let lens = cardList.length
      for(let pos = 0; pos < lens; pos++) {
        if(!cardList[pos]) return pos
      }
      return lens
    },
    // 是否同一天
    isSameDate(d1, d2) {
      if(!d1 || !d2 || !d1.value) return false;
      return dayjs(d1.value).isSame(dayjs(d2))
    },
  },
};
</script>

<style scoped lang="scss">
.date-panel {
  box-sizing: border-box;
  color: #000;
  font-size: 18px;
  font-weight: 600;
  .date-area {
    position: relative;
    height: 50px;
    line-height: 50px;
    .date-oper {
      position: absolute;
      top: 0;
      right: 0;
      .btn {
        cursor: pointer;
        &:hover {
          color: #409eff;
        }
      }
      .hide-today-btn {
        visibility: hidden;
      }
      .date-type {
        display: inline-block;
        .btn {
          &.active {
            color: #409eff;
          }
        }
      }
    }
    .date-label {
      font-size: 24px;
      text-align: center;
      .btn {
        cursor: pointer;
        &:hover {
          color: #409eff;
        }
      }
    }
  }
  .week-area {
    display: flex;
    align-items: center;
    background-color: #efefef;
    // background-color: #e3e3e3;
    // background-color: blanchedalmond;
    .week-col {
      box-sizing: border-box;
      height: 30px;
      line-height: 28px;
      font-size: 18px;
      font-weight: 400;
      text-align: center;
      border-top: 1px solid #ccc;
      &:first-of-type {
        border-left: 1px solid #ccc;
      }
      &:last-of-type {
        border-right: 1px solid #ccc;
      }
      &.single-col {
        width: 100%;
      }
      &.seven-col {
        width: 14.285%;
        min-width: 120px;
      }
    }
  }
}
</style>
