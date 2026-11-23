<template>
  <div v-if="cardType === 'div'">
    <slot />
  </div>
  <el-card v-bind="$attrs" v-else>
    <template #header>
      <slot name="header" />
    </template>
    <slot />
  </el-card>
</template>

<script setup>
/**
 * 卡片组件，带标题和内容的卡片容器，支持自定义头部和主体插槽
 */
defineProps({
  cardType: { default: 'normal' },
})
</script>

<style lang="scss" scoped>
:deep(.el-card__header) {
  font-weight: bold;
  font-size: 20px;
}
</style>
