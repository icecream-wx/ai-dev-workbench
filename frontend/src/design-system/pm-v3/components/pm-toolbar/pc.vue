<template>
  <div class="pm-toolbar" :class="{ 'pm-toolbar--no-border': !bordered }">
    <div class="pm-toolbar__inner" :class="{ 'pm-toolbar__inner--group': buttons.length > 0 }">
      <template v-if="buttons.length > 0">
        <el-button v-for="btn in showButtons" :key="btn.label" :type="buttonType" size="small" @click="btn.click">
          <el-icon v-if="btn.icon" style="margin-right:4px"><component :is="btn.icon" /></el-icon>
          {{ btn.label }}
        </el-button>
        <el-dropdown v-if="hiddenButtons.length > 0" size="small" @command="(cmd) => cmd()">
          <el-button :type="buttonType" size="small" class="pm-toolbar__more">
            {{ moreText }}
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="btn in hiddenButtons" :key="btn.label" :command="btn.click">{{ btn.label }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'

/**
 * 工具栏组件，页面操作工具栏容器，用于组织和排列操作按钮
 */
const props = defineProps({
  buttonType: { type: String, default: 'default' },
  buttons: { type: Array, default: () => [] },
  showCount: { type: Number, default: 4 },
  moreText: { type: String, default: '更多' },
  bordered: { type: Boolean, default: true },
})

const showButtons = computed(() => props.buttons.slice(0, props.showCount))
const hiddenButtons = computed(() => props.buttons.slice(props.showCount))
</script>

<style lang="scss" scoped>
.pm-toolbar {
  &--no-border &__inner {
    border: none;
    border-radius: 0;
  }

  &--no-border &__inner :deep(.el-button + .el-button),
  &--no-border &__inner :deep(.el-dropdown .el-button) {
    border-left: none !important;
  }

  &__inner {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    overflow: hidden;

    // 仅 buttons 属性模式（连体按钮组）收敛间距与分隔线；
    // slot + PmToolbarItem 模式保持 el-button 默认间距（业务页面工具栏用法）
    &--group :deep(.el-button) {
      border-radius: 0 !important;
      border: none !important;
      margin-left: 0 !important;
      box-shadow: none !important;
    }

    &--group :deep(.el-button + .el-button) {
      border-left: 1px solid #dcdfe6 !important;
    }

    &--group :deep(.el-button:hover) {
      z-index: 1;
    }

    &--group :deep(.el-dropdown) {
      .el-button {
        border-left: 1px solid #dcdfe6 !important;
      }
    }
  }
}
</style>
