<template>
  <div class="pm-fold">
    <div class="pm-fold__bar">
      <div style="display:flex;align-items:center">
        <div v-if="contrlType === 'checkbox'" style="width:35px">
          <el-checkbox v-model="myfold" :id="foldId" />
        </div>
        <div style="flex:1;cursor:pointer" @click="myfold = !myfold">
          <label :for="contrlType === 'checkbox' ? foldId : undefined" class="fs-16 font-bold">
            <el-icon v-if="contrlType === 'arrow' && arrowPosition === 'left'" style="margin-right:4px">
              <component :is="myfold ? ArrowDown : ArrowLeft" />
            </el-icon>
            <slot v-if="$slots.title" name="title" />
            <template v-else>{{ title }}</template>
            <el-icon v-if="contrlType === 'arrow' && arrowPosition === 'right'" style="margin-left:6px">
              <component :is="myfold ? ArrowDown : ArrowRight" />
            </el-icon>
          </label>
          <slot name="extend" />
        </div>
      </div>
    </div>
    <transition name="fade">
      <div v-show="myfold" :class="['pm-fold__body', bodyBorder ? 'pm-fold__body--border' : '']">
        <slot />
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, getCurrentInstance, inject, onMounted } from 'vue'
import { ArrowDown, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

/**
 * 折叠面板组件，可折叠/展开内容区域，支持手风琴模式，可自定义标题和图标
 */
const props = defineProps({
  title: { type: String, default: '' },
  subTitle: { type: String, default: '' },
  contrlType: { type: String, default: 'arrow' },
  arrowPosition: { type: String, default: 'right' },
  isFold: { type: Boolean, default: true },
  bodyBorder: { type: Boolean, default: false },
})

const emit = defineEmits(['update:isFold'])

const instance = getCurrentInstance()
const foldId = `pm-fold__${instance.uid}`

const myfold = ref(props.isFold)

const closeOthers = inject('closeOthers', () => {})
const registerFold = inject('registerFold', () => {})

const foldApi = {
  open() { myfold.value = true },
  close() { myfold.value = false },
}

onMounted(() => {
  registerFold(foldApi)
})

watch(myfold, (val) => {
  emit('update:isFold', val)
  if (val) closeOthers(foldApi)
})

defineExpose(foldApi)
</script>

<style lang="scss" scoped>
.pm-fold {
  &__bar {
    padding-left: 10px;
    background: #f8f8f8;
    border-bottom: 1px solid #f0f0f0;
    line-height: 28px;
    cursor: pointer;
  }
  &__body {
    &--border {
      border: 1px solid #f0f0f0;
      border-top: none;
      padding: 10px;
    }
  }
}
</style>
