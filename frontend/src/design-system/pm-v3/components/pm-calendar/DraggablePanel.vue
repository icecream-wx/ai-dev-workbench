<!-- 卡片记录面板 -->
<template>
  <div class="draggable-panel">
    <div class="day-wrap">
      <div 
        class="day-item noselect"
        :class="{
          'outside-curr-month': !day.widthinCurrMonth, 
          'single-day': dateListInner.length === 1,
          [`day-item-${index}`]: true
        }"
        v-for="(day, index) in dateListInner" 
        :key="day.id"
      >
        <!-- 日期序号 新增按钮 -->
        <div class="card-oper-row" key="card-end">
          <div class="card-oper noselect" :class="{'show-add-btn': showAddBtn}">
            <span class="card-date" :class="{'today': isSameDay(day)}">{{ dateFilter(day) }}</span>
            <span class="card-add" :class="{'today': isSameDay(day)}" @click="addCard(day)">+</span>
          </div>
        </div>
        
        <!-- day 拖拽卡片 -->
        <draggable
          v-model="day.cardList"
          animation="100"
          chosenClass="card-chosen-class"
          ghostClass="card-ghost-class"
          dragClass="card-drag-class"
          group="record-group"
          handle=".card-attr"
          :move="onMove"
          @add="onDragCard($event, day)"
          item-key="id"
        >
          <template #item="{ element: card }">
            <div
              :key="card[pkField]"
              class="card-item card-draggable"
              :class="`card-item-${card[pkField]}`"
              :style="styleCardItem(day, card)"
              @click="clickCard(card)"
              @mouseenter="mouseEnterCard($event, card)"
              @mouseleave="mouseLeaveCard($event, card)"
            >
              <div 
                v-if="!card.isPlaceholder && !(day.day === 1 && !card.isHead)"
                class="left-resize resize" 
                :style="{ backgroundColor: recordConfig.showBothEnds ? recordConfig.endBgColor : 'transparent' }"
              ></div>
              <div
                v-if="!card.isPlaceholder"
                class="right-resize resize"
                :style="{ backgroundColor: recordConfig.showBothEnds ? recordConfig.endBgColor : 'transparent' }"
              ></div>
              <div 
                v-if="enableRenderCard"
                class="card-attr" 
                :style="{ cursor: card.isPlaceholder ? 'auto' : 'pointer'}"
                @contextmenu.prevent="rightClickCard($event, card)"
              >
                <CustomCardTemplateComponent 
                  v-if="endConfig.dateField && recordConfig.optionTemplate.isEnable"
                  :card="card"
                  :field="recordConfig.field"
                />
                <div 
                  v-else 
                  class="card-attr-default"
                  :style="{ backgroundColor: colorConfig.bgColor, color: colorConfig.color }"
                >
                  <span class="card-attr-value">{{ cardValue(card) }}</span>
                </div>
              </div>
            </div>
          </template>
        </draggable>
      </div>
    </div>

    <!-- 卡片记录右键菜单 -->
    <CardMenu
      v-if="startField"
      ref="cardfMenuRef"
      v-model:cardMenuVisible="cardMenuVisible"
      :rowConfig="rowConfig"
      :formData="currRawCard"
      :mergeReadonly="mergeReadonly"
      @operRecord="operCard"
      @closeMenu="closeMenu"
    />
  </div>
</template>

<script>
import dayjs from "dayjs";
import { get, isPlainObject, isArray } from "lodash";
import draggable from "vuedraggable";
import { useDispatchProxy, useControllers } from '../../composables/useDispatchProxy'
import colorName from 'color-name';
import resizeMixin from "./resizeMixin";
import CardMenu from "./CardMenu.vue";

export default {
  name: "draggablePanel",
  mixins: [ resizeMixin ],
  components: { 
    draggable,
    CardMenu,
  },
  props: {
    // 日期字段配置
    endConfig: {
      type: Object,
      default: () => ({}),
    },
    // 记录配置
    recordConfig: {
      type: Object,
      default: () => ({}),
    },
    // 颜色配置
    colorConfig: {
      type: Object,
      default: () => ({}),
    },
    // 日期字段对象
    dateField: {
      type: Object,
      default: () => ({}),
    },
    // 日期类型
    dateType: {
      type: String,
      default: 'month',
    },
    // 原始记录
    data: {
      type: Array,
      default: () => [],
    },
    // 当前周期内日期列表
    dateList: {
      type: Array,
      default: () => [],
    },
    // 行内配置
    rowConfig: {
      type: Object,
      default: () => ({}),
    },
    toolConfig: {
      type: Object,
      default: () => ({}),
    },
    // 视图配置
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
      cardMenuVisible: false, // 卡片右键菜单展示标志
      currCard: null, // 当前右键菜单选中的卡片
      currCardColor: '', // 用户设置的当前卡片颜色
      entityMap: {}, // 实体选项集合
      enableRenderCard: false, // 是否渲染卡片, 实体接口调用完毕后渲染
      currRawCard: null, // 当前原始卡片数据
    };
  },
  computed: {
    dispatchProxy() {
      const { dispatchProxy } = useDispatchProxy(this)
      return dispatchProxy
    },
    Controllers() {
      return useControllers(this)
    },
    startField() {
      return this.dateField.start;
    },
    endField() {
      return this.dateField.end || this.dateField.start;
    },
    dateListInner: {
      get() {
        return this.dateList;
      },
      set(val) {
        this.$emit("update:dateList", val || []);
      },
    },
    currCardColorHover() {
      if(!this.currCardColor) return ''
      const colorSet = colorName[this.currCardColor]
      if(!colorSet.length) return ''
      const [r,g,b] = [colorSet[0], colorSet[1], colorSet[2]]
      return `rgba(${r}, ${g}, ${b}, .5)`
    },
    showAddBtn() {
      if(!this.toolConfig.buttons || !this.toolConfig.buttons.length) return false
      const targetIndex = this.toolConfig.buttons.findIndex(({ id }) => id === 'create')
      return targetIndex > -1
    },
    propMap() {
      return get(this.options, 'propList2', {})
    },
  },
  watch: {
    propMap: {
      immediate: true,
      handler(val) {
        if(!Object.keys(val).length) return
        this.syncFuncCall(val)
      },
    },
  },
  created() {
    // 动态注册自定义卡片模板组件
    if(this.recordConfig.optionTemplate.isEnable) {
      const CustomCardTemplateComponent = {
        template: this.recordConfig.optionTemplate.template,
        props: {
          card: {
            type: Object,
            default: () => ({}),
          },
          field: {
            type: String,
            default: () => '',
          },
        },
        methods: {
          cardLabel: this.cardLabel,
          cardValue: this.cardValue,
        },
      }
      this.$options.components['CustomCardTemplateComponent'] = CustomCardTemplateComponent
    }
  },
  mounted() {},
  methods: {
    syncFuncCall(val) {
      const apiFuncs = Object.keys(val).map(prop => {
        if(val[prop].item && val[prop].item.type === 'entity') {
          return async () => await this.getEntity(val[prop].item.entity)
        } 
        return () => { return }
      })
      Promise.all(apiFuncs.map(func => func()))  
      .then(results => {  
        console.log('所有实体API调用已完成');  
        Object.keys(val).forEach((prop, index) => {
          if(results[index]) {
            this.entityMap[prop] = results[index]
          }
        })
        this.enableRenderCard = true
      })  
      .catch(error => {  
        console.error('实体API调用中发生了错误:', error);  
      });
    },
    cardLabel(card, attr = '') {
      const field = attr || this.recordConfig.field
      if(!field) return ''
      if(!card[field]) return ''
      return card[field].label || ''
    },
    cardValue(card, attr = '') {
      const fieldName = attr || this.recordConfig.field
      if(!fieldName) return ''
      const gainValue = (val) => {
        if(!val) return ''
        const datasource = this.propMap[fieldName]?.item
        if(datasource && datasource.type === 'entity') {
          const { valueField } = datasource
          if(isPlainObject(val.value)) return val.value[valueField] || ''
          if(isArray(val.value)) return val.value.map((item) => item[valueField]).join(',')
        }
        return val.value
      }
      let result = ''
      result = gainValue(card[fieldName])
      const datasource = this.propMap[fieldName]?.item
      if(datasource) {
        if(datasource.type === 'entity') { // 实体
          if(this.entityMap && this.entityMap[fieldName]) {
            const { labelField, valueField } = datasource
            const target = this.entityMap[fieldName].find((item) => item[valueField].toString() === result)
            if(target) {
              result = target[labelField] || target.name
            }
          }
        } else if(datasource.type === 'dict') { // 字典
          let extObj = card[`__${fieldName}Object`]
          if(extObj && extObj.name) result = extObj.name
        } else if(datasource.type === 'custom') { // 自定义变量
          let options = datasource.options // $$v_options_1721639203810$$
          let vOptions = options.substring(2, options.length - 2)
          let targetVariable = this.formProxy.data.find(v => v.name === vOptions)
          let customSet = JSON.parse(targetVariable.code)
          if(!customSet || !customSet.length) return result
          let target = customSet.find(({ code }) => code === result)
          if(target) result = target.name
        } else { // 上传附件、图片
          let extObj = card[`__${fieldName}Object`]
          if(extObj && extObj.fileId) result = extObj.fileName
        }
      } else {
        let extObj = card[`__${fieldName}Object`]
        if(extObj && extObj.name) result = extObj.name
        if(extObj && extObj.fileId) result = extObj.fileName
      }
      return result
    },
    styleCardItem(day, card) {
      const { isHead, isPlaceholder, offset } = card
      const isMonday = day.day === 1
      const visibility = (isHead || isMonday && !isPlaceholder) ? 'visible' : 'hidden'
      // const visibility = (isHead || isMonday || isPlaceholder) ? 'visible' : 'hidden' // 测试观察占位符card
      let width = `calc(${100 * card.daysInTotal}% - 8px + ${card.daysInTotal - 1}px)` // 宽度百分比未包含格子的右边框，需要补偿计算
      // 处理换行的记录
      if(isMonday && !isHead) { 
        width = `calc(${100 * (card.daysInTotal - offset)}% - 4px + ${card.daysInTotal - offset - 1}px)` 
      }
      // 控制卡片颜色
      const defaultBgColor = '#a3d6ff'
      const defaultHoverBgColor = `${defaultBgColor}80`
      // 测试观察全部card堆叠情况
      // return {
      //   visibility: 'visible',
      //   opacity: 1,
      //   '--card-bg-color': this.recordConfig.cardBgColor || defaultBgColor,
      //   '--card-hover-color': this.recordConfig.hoverBgColor || defaultHoverBgColor,
      // }
      return {
        visibility: visibility === 'hidden' && !isPlaceholder ? 'hidden' : 'visible',
        opacity: visibility === 'visible' ? 1 : 0,
        zIndex: visibility === 'visible'  ? 9 : 1, // 不可见的放在底层
        width,
        marginLeft: isHead ? '4px' : '0',
        'border-top-left-radius': isMonday && !isHead ? '0' : '4px',
        'border-bottom-left-radius': isMonday && !isHead ? '0' : '4px',
        '--card-bg-color': this.currCardColor || this.recordConfig.cardBgColor || defaultBgColor,
        '--card-hover-color': this.currCardColorHover || this.recordConfig.hoverBgColor || defaultHoverBgColor,
      }
    },
    // 给某天添加记录
    addCard(day) {
      const { startField, endField } = this
      if(!startField) {
        this.$notify.warning({
          title: '提示',
          message: '未设置开始日期字段，无法新增，请在日历视图配置中设置'
        });
        return
      }
      const partialCard = {
        [startField]: day.date.startOf('day').format("YYYY-MM-DD HH:mm:ss"),
      };
      if (endField) {
        partialCard[endField] = day.date.startOf('day').format("YYYY-MM-DD HH:mm:ss")
      }
      this.$emit('addCard', { partialCard })
    },
    // 移动卡片
    onDragCard(val, day) {
      this.$emit('moveCard', { day })
    },
    // 自定义控制事件
    onMove(e, originalEvent) {
      // 不允许拖拽（占位符、空白）
      const isNodata = !e.draggedContext.element
      const isPlaceholder = e.draggedContext.element && e.draggedContext.element.isPlaceholder
      if (isNodata || isPlaceholder) return false;

      // 不允许停靠（当前天内移动）
      const dragInSameDay = e.draggedContext.element 
                            && e.relatedContext.element 
                            && e.draggedContext.element.parentId === e.relatedContext.element.parentId
      if (dragInSameDay) return false; 
      return true;
    },
    clickCard(card) {
      this.$emit('operCard', { 
        card,
        action: 'view',
      })
    },
    mouseEnterCard(e, card) {
      const targetCardSet = document.querySelector('.day-wrap').querySelectorAll(`.card-item-${card[this.pkField]}`)
      if(!targetCardSet) return
      targetCardSet.forEach(targetCard => {
        targetCard.classList.add('hover')
      })
      this.currRawCard = this.data.find((item) => item[this.pkField] === card[this.pkField])
      this.cardMenuVisible = false
    },
    mouseLeaveCard(e, card) {
      const targetCardSet = document.querySelector('.day-wrap').querySelectorAll(`.card-item-${card[this.pkField]}`)
      if(!targetCardSet) return
      targetCardSet.forEach(targetCard => {
        targetCard.classList.remove('hover')
      })
    },
    rightClickCard(e, card) {
      e.preventDefault();
      let [top, left] = [e.clientY, e.clientX];
      const domCardMenu = this.$refs["cardfMenuRef"].$el;
      // 更新菜单出现位置
      domCardMenu.style.top = `${top-5}px`;
      domCardMenu.style.left = `${left-5}px`;
      this.currCard = card
      this.cardMenuVisible = true
    },
    operCard({ operType: action }) {
      this.$emit('operCard', { 
        card: this.currCard,
        action,
      })
    },
    closeMenu() {
      this.currCard = null
      this.cardMenuVisible = false
    },
    async getEntity(entityName) {
      const payload = {
        params: {
          entityName,
          pageIndex: 0,
          pageSize: -1,
        },
        payload: {
          condition: null
        },
      }
      const resp = await this.dispatchProxy(
        this.Controllers.LowcodeModelController.queryWithPage,
        payload
      )
      return resp.data.data
    },
    isSameDay(day) {
      return dayjs().isSame(day.dateString, 'day')
    },
    dateFilter(day) {
      return (day && day.date) ? day.date.date() : '';
    },
  },
};
</script>

<style scoped lang="scss">
.draggable-panel {
  box-sizing: border-box;
  position: relative;
  min-width: 850px;
  height: calc(100vh - 200px);
  color: #000;
  font-size: 18px;
  font-weight: 500;
  .day-wrap {
    box-sizing: border-box;
    display: flex;
    align-items: stretch;
    flex-wrap: wrap;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    border-top: 1px solid #ccc;
    border-left: 1px solid #ccc;
    .day-item {
      box-sizing: border-box;
      position: relative;
      width: 14.285%;
      min-width: 120px;
      min-height: 80px;
      background-color: #fff;
      color: #000;
      border-bottom: 1px solid #ccc;
      border-right: 1px solid #ccc;
      &.outside-curr-month {
        color: #999;
        background-color: #f3f3f3;
      }
      &.single-day {
        width: 100%;
      }
      & > div:nth-of-type(2) {
        height: calc(100% - 26px);
        .draggable-span-card {
          position: relative;
          display: inline-block;
          width: 100%;
          height: 100%;
          vertical-align: top;
          .nodata {
            height: 100%;
            text-align: center;
            display: flex;
            justify-content: center;
            align-items: center;
            .nodata-label {
              position: relative;
              top: -13px;
              color: #bbb;
            }
          }
        }
      }
      .card-oper-row {
        text-align: right;
        .card-oper {
          display: inline-block;
          width: 26px;
          height: 26px;
          padding: 2px;
          cursor: pointer;
          text-align: center;
          font-size: 14px;
          &.show-add-btn:hover {
            .card-date {
              display: none;
            }
            .card-add {
              display: inline-block;
            }
          }
          .card-date, .card-add {
            display: inline-block;
            width: 22px;
            height: 22px;
            line-height: 22px;
            &.today {
              background-color: #409eff;
              border-radius: 50%;
              color: #fff;
            }
          }
          .card-add {
            display: none;
          }
        }
      }
      .card-item {
        box-sizing: border-box;;
        position: relative;
        z-index: 9;
        margin-bottom: 4px;
        border-radius: 4px;
        font-size: 14px;
        line-height: 16px;
        font-weight: 400;
        background-color: var(--card-bg-color);
        padding: 0 10px;
        &.hover {
          background-color: var(--card-hover-color);
        }
        .resize {
          user-select: none;
          position: absolute;
          top: 0px;
          z-index: 9;
          height: 100%;
          width: 12px;
          cursor: col-resize;
          &.left-resize {
            left: 0px;
            border-radius: 4px 0 0 4px;
          }
          &.right-resize {
            right: 0px;
            border-radius: 0 4px 4px 0;
          }
        }
        .card-attr {
          padding: 2px 4px;
          cursor: pointer;
          font-weight: 400;
          .card-attr-default {
            display: inline-block;
            padding: 2px 4px;
          }
        }
      }
      // card 选中
      .card {
        &-chosen-class {
          // background-color: pink;
          visibility: hidden;
        }
        &-ghost-class {
          // background-color: pink;
          visibility: hidden;
        }
        &-drag-class {
          opacity: 0.3;
        }
      }
    }
  }
  .color-switch {
    position: absolute;
    top: -68px;
    left: 0px;
    z-index: 9;
    display: inline-block;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: #fff;
    border: 1px solid #ccc;;
    cursor:pointer;
  }
}  
</style>
