<template>
  <div style="width: 100%">
    <template v-if="currentDataList && currentDataList.length > 0">
      <template v-if="mode === 'edit'">
        <el-steps v-if="spaceSetting === 'space'" v-bind="$attrs" :active="active" :space="space ? `${space}px` : undefined" class="custom-steps" :direction="direction" :align-center="isAlignCenter" :simple="isSimple" :finish-status="finishStatus">
          <el-step v-for="(item, index) in currentDataList" :key="index" :title="item.label" :description="item.description" style="cursor: pointer" @click="clickFun(item, index)" />
        </el-steps>
        <el-steps v-else v-bind="$attrs" :active="active" :direction="direction" :align-center="isAlignCenter" :simple="isSimple" :finish-status="finishStatus">
          <el-step v-for="(item, index) in currentDataList" :key="index" :title="item.label" :description="item.description" style="cursor: pointer" @click="clickFun(item, index)" />
        </el-steps>
      </template>
      <div v-else></div>
    </template>
    <el-steps v-else :active="active" :direction="direction" :simple="isSimple" :align-center="isAlignCenter" :finish-status="finishStatus">
      <el-step title="步骤 1" />
      <el-step title="步骤 2" />
      <el-step title="步骤 3" />
    </el-steps>
  </div>
</template>

<script setup>
import { computed, watch, ref } from 'vue'

/**
 * 步骤条组件，引导用户按步骤完成流程，支持步骤状态和自定义内容
 */
const props = defineProps({
  modelValue: { default: null },
  mode: { default: 'edit' },
  readonly: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  direction: { default: 'horizontal' },
  isAlignCenter: { type: Boolean, default: false },
  isSimple: { type: Boolean, default: false },
  options: { type: Array, default: () => [] },
  finishStatus: { default: undefined },
  space: { default: undefined },
  spaceSetting: { type: String, default: 'default' },
})

const emit = defineEmits(['update:modelValue', 'clickStep'])

const currentDataList = ref([])

const active = computed({
  get() {
    if (props.modelValue || props.modelValue === 0) {
      const index = props.options.findIndex(item => item.value == props.modelValue)
      if (index > -1) return index + 1 + ''
      return props.modelValue
    }
    return null
  },
  set(val) {
    emit('update:modelValue', val)
  },
})

watch(() => props.options, (val) => {
  if (val && val.length) {
    currentDataList.value = val.map(item => ({
      value: item.value,
      label: item.label,
      description: item.description || '',
    }))
  }
}, { immediate: true, deep: true })

function clickFun(data, index) {
  // 预览适配（P7-9/F2）：点击步条同步 v-model；与上游 pm-steps 行为差异已知
  emit('update:modelValue', data?.value ?? index)
  emit('clickStep', data, index)
}
</script>

<style lang="scss" scoped>
.custom-steps { display: flex; flex-wrap: wrap; }
</style>
