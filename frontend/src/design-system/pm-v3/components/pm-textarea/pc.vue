<template>
  <span v-if="!isInChildren" class="pm-textarea-root">
    <null-value
      v-if="!modelValue && ($attrs.disabled || $attrs.readonly)"
      type="textarea"
      v-bind="$attrs"
      placeholder=""
    />
    <el-tooltip v-else :disabled="tooltipDisabled" :content="String(modelValue || '')" placement="top">
      <div class="pm-textarea-tooltip-wrapper" @mouseenter="updateTooltip">
        <el-input
          ref="textareaRef"
          v-model="localValue"
          type="textarea"
          v-bind="$attrs"
          :autosize="false"
          :rows="rows"
          @input="adjustHeight"
        />
      </div>
    </el-tooltip>
  </span>
  <div class="body" v-else>
    <el-input
      @focus="showPopHover"
      v-model="localValue"
      :disabled="$attrs.disabled"
      :readonly="$attrs.readonly"
    />
  </div>
</template>

<script setup>
/**
 * 多行文本框组件
 * @example 基础用法 - <pm-textarea v-model="value" placeholder="请输入" />
 * @example 自动行数 - <pm-textarea v-model="value" :autosize="{ minRows: 2, maxRows: 6 }" />
 * @example 指定行数 - <pm-textarea v-model="value" :rows="5" />
 */
import { ref, computed, reactive, nextTick, onMounted, onBeforeUnmount, getCurrentInstance, watch } from 'vue'
import NullValue from '../../components/pm-null-value/pc.vue'
import calcTextareaHeight from './calcTextareaHeight.js'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: null,
  },
  isInChildren: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const instance = getCurrentInstance()
const textareaRef = ref(null)
const rows = ref(4)
const visible = ref(false)
const target = ref(null)
const hoverStyle = reactive({ left: '0px', top: '0px', width: '250px' })
const tooltipDisabled = ref(true)
let wrapperEl = null
let errorTipEl = null
const uid = Math.random().toString(36).slice(2)

const localValue = computed({
  get() {
    return props.modelValue ?? null
  },
  set(val) {
    emit('update:modelValue', val)
  },
})

const attrs = computed(() => instance?.proxy?.$attrs || {})

if (attrs.value?.autosize?.minRows) {
  rows.value = attrs.value.autosize.minRows
} else {
  rows.value = 4
}

const updateTooltip = () => {
  const textarea = textareaRef.value?.$refs?.textarea
  if (!textarea) {
    tooltipDisabled.value = true
    return
  }
  tooltipDisabled.value = !localValue.value || textarea.scrollHeight <= textarea.clientHeight
}

const adjustHeight = () => {
  const { minRows, maxRows } = attrs.value?.autosize || {}
  const textarea = textareaRef.value?.$refs?.textarea
  if (!textarea) return
  nextTick(() => {
    const { height } = calcTextareaHeight(textarea, minRows, maxRows)
    const lines = (height - 12) / 21
    const newRows = Math.min(Math.max(lines, minRows), maxRows)
    if (!isNaN(newRows)) rows.value = newRows
  })
}

const getErrorTip = () => {
  let parent = instance?.proxy?.$el?.parentNode
  while (parent && parent.tagName !== 'TD') {
    parent = parent.parentNode
  }
  if (parent) {
    const errorEl = parent?.children?.[1]
    if (!errorEl) return ''
    errorEl.style.display = 'none'
    return errorEl?.querySelector('.vxe-cell--valid-error-msg')?.innerHTML || ''
  }
  return ''
}

const updateHoverStyle = () => {
  const td = target.value?.parentNode?.closest('td')
  if (!td) return
  const { left, top, width } = td.getBoundingClientRect()
  hoverStyle.left = left + 'px'
  hoverStyle.top = top + 'px'
  hoverStyle.width = (width < 250 ? 250 : width) + 25 + 'px'
}

const wheelPreventDefault = (e) => {
  if (e.target.id !== 'textarea_input') {
    visible.value = false
  }
  e.preventDefault()
  e.stopPropagation()
}

const showPopHover = (e) => {
  target.value = e.target
  updateHoverStyle()
  visible.value = true
  window.addEventListener('resize', updateHoverStyle, { passive: false })
  nextTick(() => {
    if (wrapperEl) {
      const textareaInput = wrapperEl.querySelector('#textarea_input')
      if (textareaInput) textareaInput.focus()
    }
  })
}

watch(visible, (val) => {
  if (val) {
    wrapperEl = document.createElement('div')
    wrapperEl.className = 'table-cell-textarea-pophover'
    wrapperEl.style.zIndex = 4000
    wrapperEl.style.background = '#fff'
    wrapperEl.style.position = 'absolute'
    wrapperEl.style.boxShadow = 'inset 0 0 0 2px var(--tagBg)'
    wrapperEl.style.padding = '2px'
    wrapperEl.style.left = hoverStyle.left
    wrapperEl.style.top = hoverStyle.top
    wrapperEl.style.width = 'auto'
    wrapperEl.id = `textarea_${uid}`

    const textarea = document.createElement('textarea')
    textarea.rows = 5
    textarea.id = 'textarea_input'
    textarea.style.border = 'none'
    textarea.style.width = hoverStyle.width
    textarea.style.minWidth = hoverStyle.width
    textarea.style.minHeight = '50px'
    textarea.value = localValue.value || ''
    textarea.addEventListener('input', (e) => {
      localValue.value = e.target.value
    })
    textarea.addEventListener('mousedown', (e) => {
      e.stopPropagation()
    }, { capture: true })

    wrapperEl.appendChild(textarea)
    document.body.appendChild(wrapperEl)
    document.addEventListener('wheel', wheelPreventDefault, { passive: false })

    setTimeout(() => {
      const errorMsg = getErrorTip()
      if (errorMsg) {
        errorTipEl = document.createElement('div')
        errorTipEl.className = 'error-msg'
        errorTipEl.style.zIndex = 4000
        errorTipEl.style.background = 'var(--vxe-ui-table-validate-error-color)'
        errorTipEl.style.position = 'fixed'
        errorTipEl.style.padding = '5px'
        errorTipEl.style.color = '#fff'
        errorTipEl.style.borderRadius = '5px'
        errorTipEl.innerHTML = errorMsg
        wrapperEl?.appendChild(errorTipEl)
      }
    }, 20)
  } else {
    const el = document.getElementById(`textarea_${uid}`)
    if (el && el.parentNode) el.parentNode.removeChild(el)
    wrapperEl = null
    document.removeEventListener('wheel', wheelPreventDefault, { passive: false })
    window.removeEventListener('resize', updateHoverStyle, { passive: false })
  }
})

onMounted(() => {
  const textarea = instance?.proxy?.$el?.querySelector('textarea')
  if (!textarea) return
  textarea.style.height = 'auto'
  adjustHeight()
})

onBeforeUnmount(() => {
  const el = document.getElementById(`textarea_${uid}`)
  if (el && el.parentNode) el.parentNode.removeChild(el)
  document.removeEventListener('wheel', wheelPreventDefault, { passive: false })
  window.removeEventListener('resize', updateHoverStyle, { passive: false })
})

defineExpose({
  focus: () => textareaRef.value?.focus(),
  blur: () => textareaRef.value?.blur(),
})
</script>

<style lang="scss">
.table-cell-textarea-pophover {
  z-index: 1000;
  background: #fff;
  position: fixed;
  box-shadow: inset 0 0 0 2px var(--tagBg);
  padding: 2px;
  textarea {
    border: none;
    outline: none;
  }
}
</style>

<style lang="scss" scoped>
/* 预览接入：上游根节点是行内 span，放进 el-form-item 时会收缩成内容宽度；这里恢复块级满宽 */
.pm-textarea-root {
  display: block;
  width: 100%;
}
.pm-textarea-tooltip-wrapper {
  width: 100%;
}
.body {
  position: relative;
  background: #fff;
}
</style>
