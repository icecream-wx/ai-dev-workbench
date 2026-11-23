<template>
  <div style="width: 100%" class="image">
    <el-image :key="resolvedUrl" :style="imgStyle" :src="resolvedUrl" :fit="fit">
      <template #error>
        <div class="image-slot">
          <el-icon :size="30"><i class="el-icon-picture-outline" /></el-icon>
        </div>
      </template>
    </el-image>
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * 图片组件，支持图片预览、加载失败占位、懒加载和自定义预览列表
 */
const props = defineProps({
  modelValue: { default: '' },
  fit: { type: String, default: 'contain' },
  imgWidth: { type: [Number, String], default: null },
  imgHeight: { type: [Number, String], default: null },
  fileSize: { type: [Number, String], default: 2 },
  imgUrl: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  mode: { default: 'edit' },
  isInChildren: { type: Boolean, default: false },
  datasourceIsUpload: { type: Boolean, default: false },
})

// 预览接入：上游只监听 modelValue，页面用 :img-url 直接传地址时会空白；这里同时支持 imgUrl
const resolvedUrl = computed(() => props.modelValue || props.imgUrl || '')

const imgStyle = computed(() => ({
  width: props.isInChildren ? '50px' : (isCorrect(props.imgWidth) ? props.imgWidth : props.imgWidth + 'px'),
  height: props.isInChildren ? '50px' : (isCorrect(props.imgHeight) ? props.imgHeight : props.imgHeight + 'px'),
  'object-fit': props.fit,
}))

function isCorrect(data) {
  return (data + '').indexOf('px') !== -1 || (data + '').indexOf('%') !== -1
}
</script>

<style scoped>
.image-slot { display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; background: #f5f7fa; color: #909399; }
</style>
