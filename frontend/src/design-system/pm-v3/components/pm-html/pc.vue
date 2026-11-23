<template>
  <div>
    <div v-if="styleType" :class="styleType" style="display:flex;align-items:center;">
      <pm-icon :value="icon" v-if="showIcon && styleType !== 'usual'" :style="{fontSize: iconSize, color: iconColor}" />
      <div v-html="html" style="margin-left: 10px"></div>
    </div>
    <div v-html="html" v-else></div>
  </div>
</template>

<script setup>
/**
 * HTML 渲染组件，将 HTML 字符串渲染为页面内容，支持脚本和样式处理
 */
defineProps({
  html: { default: '' },
  icon: { default: '' },
  showIcon: { default: '' },
  iconSize: { default: '' },
  iconColor: { default: '' },
  styleType: { default: '' },
})
</script>

<style lang="scss" scoped>
.primary {
  color: #409eff;
  padding: 5px;
}
.info {
  color: #6c6c6c;
  background: #DEECFF;
  padding: 5px;
}
.warning {
  background: #FFF5DE;
  border-radius: 5px;
  padding: 5px;
}
.danger {
  background: #FFDEDE;
  padding: 5px;
}
</style>
