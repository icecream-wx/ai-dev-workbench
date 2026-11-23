<template>
  <div ref="outerWrapper" :class="wrapperClasses">
    <div v-if="isHorizontal" :class="`${prefix}-horizontal`">
      <template v-if="onlyShow === 'left'">
        <slot name="left" />
      </template>
      <template v-else-if="onlyShow === 'right'">
        <slot name="right" />
      </template>
      <template v-else>
        <div v-show="(showLeftFold && !isFold) || !showLeftFold" :style="{right: `${anotherOffset}%`}" class="left-pane" :class="paneClasses">
          <slot name="left" />
        </div>
        <div :class="`${prefix}-trigger-con`" :style="{left: `${offset}%`}" @mousedown="handleMousedown">
          <slot name="trigger">
            <trigger mode="vertical" />
          </slot>
          <i v-if="showLeftFold" class="icon-fold" :class="`el-icon-s-${isFold ? 'unfold' : 'fold'}`" @click="handleClick" />
        </div>
        <div :style="{left: onlyShow !== 'right' ? `${offset}%`:'0'}" class="right-pane" :class="paneClasses">
          <slot name="right" />
        </div>
      </template>
    </div>
    <div v-else :class="`${prefix}-vertical`">
      <div :style="{bottom: `${anotherOffset}%`}" class="top-pane" :class="paneClasses">
        <slot name="top" />
      </div>
      <div :class="`${prefix}-trigger-con`" :style="{top: `${offset}%`}" @mousedown="handleMousedown">
        <slot name="trigger">
          <trigger mode="horizontal" />
        </slot>
      </div>
      <div :style="{top: `${offset}%`}" class="bottom-pane" :class="paneClasses">
        <slot name="bottom" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Trigger from './trigger.vue'
import { on, off } from '../../common/dom'
import './split.scss'

/**
 * 分割面板组件，可拖拽调整左右/上下面板的宽度比例
 */
const props = defineProps({
  modelValue: { type: [Number, String], default: 0.5 },
  mode: { default: 'horizontal' },
  min: { type: [Number, String], default: 0 },
  max: { type: [Number, String], default: 0.9 },
  onlyShow: { type: String, default: null },
  showLeftFold: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'on-moving', 'on-move-end', 'on-move-start'])

const prefix = 'pm-split'
const outerWrapper = ref(null)
const offset = ref(0)
const oldOffset = ref(0)
const isMoving = ref(false)
const currentValue = ref(0.5)
const isFold = ref(false)
const computedMin = ref(0)
const computedMax = ref(0)
let initOffset = 0

const wrapperClasses = computed(() => [
  `${prefix}-wrapper`,
  isMoving.value ? 'no-select' : '',
])

const paneClasses = computed(() => [
  `${prefix}-pane`,
  { [`${prefix}-pane-moving`]: isMoving.value },
])

const isHorizontal = computed(() => props.mode === 'horizontal')
const anotherOffset = computed(() => 100 - offset.value)
const valueIsPx = computed(() => typeof props.modelValue === 'string')
const offsetSize = computed(() => isHorizontal.value ? 'offsetWidth' : 'offsetHeight')

watch(() => props.modelValue, (val) => {
  if (val !== currentValue.value) {
    currentValue.value = val
    computeOffset()
  }
})

function px2percent(numerator, denominator) {
  return parseFloat(numerator) / parseFloat(denominator)
}

function getComputedThresholdValue(type) {
  const size = outerWrapper.value[offsetSize.value]
  if (valueIsPx.value) return typeof props[type] === 'string' ? props[type] : size * props[type]
  else return typeof props[type] === 'string' ? px2percent(props[type], size) : props[type]
}

function getMin(value1, value2) {
  if (valueIsPx.value) return `${Math.min(parseFloat(value1), parseFloat(value2))}px`
  else return Math.min(value1, value2)
}

function getMax(value1, value2) {
  if (valueIsPx.value) return `${Math.max(parseFloat(value1), parseFloat(value2))}px`
  else return Math.max(value1, value2)
}

function getAnotherOffset(value) {
  if (valueIsPx.value) return `${outerWrapper.value[offsetSize.value] - parseFloat(value)}px`
  else return 1 - value
}

function handleMove(e) {
  const pageOffset = isHorizontal.value ? e.pageX : e.pageY
  const offsetVal = pageOffset - initOffset
  const outerWidth = outerWrapper.value[offsetSize.value]

  let value = valueIsPx.value ? `${parseFloat(oldOffset.value) + offsetVal}px` : px2percent(outerWidth * oldOffset.value + offsetVal, outerWidth)
  const anotherValue = getAnotherOffset(value)
  if (parseFloat(value) <= parseFloat(computedMin.value)) value = getMax(value, computedMin.value)
  if (parseFloat(anotherValue) <= parseFloat(computedMax.value)) value = getAnotherOffset(getMax(anotherValue, computedMax.value))
  e.atMin = props.modelValue === computedMin.value
  e.atMax = valueIsPx.value ? getAnotherOffset(props.modelValue) === computedMax.value : getAnotherOffset(props.modelValue).toFixed(5) === computedMax.value.toFixed(5)
  emit('update:modelValue', value)
  emit('on-moving', e)
}

function handleUp() {
  isMoving.value = false
  off(document, 'mousemove', handleMove)
  off(document, 'mouseup', handleUp)
  emit('on-move-end')
}

function handleMousedown(e) {
  if (props.showLeftFold && isFold.value) return
  initOffset = isHorizontal.value ? e.pageX : e.pageY
  oldOffset.value = props.modelValue
  isMoving.value = true
  on(document, 'mousemove', handleMove)
  on(document, 'mouseup', handleUp)
  emit('on-move-start')
}

function computeOffset() {
  nextTick(() => {
    let value = valueIsPx.value ? px2percent(props.modelValue, outerWrapper.value[offsetSize.value]) : props.modelValue
    if (value >= props.max) value = props.max
    if (value <= props.min) value = props.min
    offset.value = value * 10000 / 100
    currentValue.value = value
    emit('update:modelValue', value)
  })
}

function handleClick() {
  isFold.value = !isFold.value
  if (isFold.value) {
    offset.value = 0
  } else {
    computeOffset()
  }
}

onMounted(() => {
  nextTick(() => {
    computeOffset()
  })
  on(window, 'resize', computeOffset)
})

onBeforeUnmount(() => {
  off(window, 'resize', computeOffset)
})
</script>

<style lang="scss" scoped>
.icon-fold {
  position: absolute;
  bottom: 5px;
  left: inherit;
  margin-left: -20px;
  cursor: pointer;
}
</style>
