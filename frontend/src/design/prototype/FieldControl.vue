<template>
  <!-- 手机：钉钉/微信式输入组件（白底描边框 + 示例值 / 开关 / 下拉箭头 / 选项组 / 上传 / 图片） -->
  <div v-if="mobile" :class="['wf-m-input', { 'as-textarea': control === 'textarea', 'as-boolean': control === 'boolean', 'as-upload': control === 'upload' }]">
    <span v-if="control === 'boolean'" :class="['wf-switch', { on: switchOn }]" />
    <template v-else-if="control === 'radio' || control === 'checkbox'">
      <span v-for="(opt, i) in sampleOptions" :key="opt" :class="['wf-m-option', { on: isChecked(i) }]">
        <i :class="[control === 'radio' ? 'wf-radio' : 'wf-check', { on: isChecked(i) }]" />
        <span>{{ opt }}</span>
      </span>
    </template>
    <template v-else-if="control === 'upload'">
      <svg class="wf-ctl-icon" viewBox="0 0 24 24"><path d="M12 15V5m0 0l-4 4m4-4l4 4" /><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg>
      <span class="wf-m-input-text ghost">上传附件</span>
    </template>
    <template v-else-if="control === 'image'">
      <svg class="wf-ctl-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M5 17l4.5-4.5 3.5 3.5 2.5-2.5 3.5 3.5" /></svg>
      <span class="wf-m-input-text ghost">{{ text || '图片' }}</span>
    </template>
    <template v-else>
      <svg v-if="control === 'select-user'" class="wf-ctl-icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" /></svg>
      <svg v-else-if="control === 'select-org'" class="wf-ctl-icon" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="1.5" /><path d="M9 9.5h2M13 9.5h2M9 13.5h2M13 13.5h2M10.5 20v-3h3v3" /></svg>
      <span :class="['wf-m-input-text', { ghost: !text }]">{{ text || placeholder }}</span>
      <span v-if="control === 'select' || control === 'select-user' || control === 'select-org'" class="wf-m-input-chev">▾</span>
      <span v-else-if="control === 'date' || control === 'datetime'" class="wf-cal-icon" />
    </template>
  </div>
  <!-- 桌面 / 平板：下拉框（选择盒 + 箭头）/ 开关（胶囊）/ 单选 / 多选 / 日期 / 上传 / 图片 / 其余线框骨架条 -->
  <template v-else>
    <div v-if="control === 'select-user' || control === 'select-org'" class="wf-input wf-select">
      <svg class="wf-ctl-icon" viewBox="0 0 24 24">
        <template v-if="control === 'select-user'"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" /></template>
        <template v-else><rect x="4" y="5" width="16" height="15" rx="1.5" /><path d="M9 9.5h2M13 9.5h2M9 13.5h2M13 13.5h2M10.5 20v-3h3v3" /></template>
      </svg>
      <span :class="['wf-input-text', { ghost: !text }]">{{ text || placeholder }}</span>
      <span class="wf-input-chev">▾</span>
    </div>
    <div v-else-if="control === 'select'" class="wf-input wf-select">
      <span :class="['wf-input-text', { ghost: !text }]">{{ text || placeholder }}</span>
      <span class="wf-input-chev">▾</span>
    </div>
    <span v-else-if="control === 'boolean'" :class="['wf-switch', { on: switchOn }]" />
    <div v-else-if="control === 'radio' || control === 'checkbox'" class="wf-option-row">
      <span v-for="(opt, i) in sampleOptions" :key="opt" :class="['wf-option', { on: isChecked(i) }]">
        <i :class="[control === 'radio' ? 'wf-radio' : 'wf-check', { on: isChecked(i) }]" />
        <span>{{ opt }}</span>
      </span>
    </div>
    <div v-else-if="control === 'date' || control === 'datetime'" class="wf-input wf-select wf-date">
      <span :class="['wf-input-text', { ghost: !text }]">{{ text || placeholder }}</span>
      <span class="wf-cal-icon" />
    </div>
    <div v-else-if="control === 'upload'" class="wf-upload">
      <svg class="wf-ctl-icon" viewBox="0 0 24 24"><path d="M12 15V5m0 0l-4 4m4-4l4 4" /><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg>
      <span class="wf-upload-text">点击或拖拽文件到此处上传</span>
      <span class="wf-upload-hint">支持常见文档 / 图片格式</span>
    </div>
    <div v-else-if="control === 'image'" class="wf-image">
      <svg class="wf-ctl-icon lg" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M5 17l4.5-4.5 3.5 3.5 2.5-2.5 3.5 3.5" /></svg>
      <span class="wf-image-hint">{{ text || '图片' }}</span>
    </div>
    <div v-else :class="['wf-input', `ctl-${control}`, control === 'textarea' ? 'tall' : '']" />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MockRow } from './mock'
import { displayValue } from './mock'
import type { PageLayout, SpecField } from './spec-types'
import { controlOf } from './layout'

const props = defineProps<{
  field: SpecField
  layout: PageLayout | undefined
  mobile?: boolean
  row?: MockRow
}>()

const control = computed(() => controlOf(props.field, props.layout))

const text = computed(() => {
  const value = props.row?.[props.field.name]
  const t = displayValue(props.field, value)
  return t === '-' ? '' : t
})

const placeholder = computed(() => {
  switch (control.value) {
    case 'select': return '请选择'
    case 'select-user': return '请选择人员'
    case 'select-org': return '请选择部门'
    case 'date':
    case 'datetime': return '请选择日期'
    case 'number': return '请输入数值'
    default: return '请输入'
  }
})

/** 开关状态：跟随示例值（无示例时视为关） */
const switchOn = computed(() => props.row?.[props.field.name] === true)

/** 单选/多选的示例选项：枚举字段取 options，其余给通用占位 */
const sampleOptions = computed<string[]>(() => {
  const opts = props.field.options?.length ? props.field.options : ['选项一', '选项二', '选项三']
  return opts.slice(0, 4)
})

/** 选中态：单选跟随示例值（缺省选中第一项），多选默认勾前两项 */
function isChecked(i: number): boolean {
  if (control.value === 'radio') {
    const v = props.row?.[props.field.name]
    const idx = sampleOptions.value.indexOf(String(v ?? ''))
    return (idx >= 0 ? idx : 0) === i
  }
  return i < 2
}
</script>
<!-- Modified by AI on 2026-09-21 17:25:32 -->
