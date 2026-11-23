<template>
  <div>
    <slot />
  </div>
</template>

<script setup>
import { provide, ref } from 'vue'

/**
 * 折叠面板组组件，管理多个折叠面板，支持手风琴互斥模式
 */
const props = defineProps({
  accordion: { type: Boolean, default: false },
})

const foldRefs = ref([])

function registerFold(foldApi) {
  if (foldApi && !foldRefs.value.includes(foldApi)) {
    foldRefs.value.push(foldApi)
  }
}

function closeOthers(me) {
  if (!props.accordion) return
  foldRefs.value.forEach(fold => {
    if (fold !== me) fold.close()
  })
}

provide('closeOthers', closeOthers)
provide('registerFold', registerFold)
</script>
