<template>
  <div v-if="visibleActions.length" class="pt-row-actions">
    <PmToolbar :bordered="false">
      <template v-for="action in directActions" :key="action.key">
        <el-tooltip v-if="mode === 'icon'" :content="action.label" placement="top">
          <span class="pt-row-action-icon" tabindex="0" :aria-label="action.label">
            <PmToolbarItem type="text" :disabled="action.disabled" :aria-label="action.label"
              @click="invoke(action)">
              <el-icon :size="16"><component :is="action.icon || MoreFilled" /></el-icon>
            </PmToolbarItem>
          </span>
        </el-tooltip>
        <PmToolbarItem v-else type="text" :disabled="action.disabled" @click="invoke(action)">
          {{ action.label }}
        </PmToolbarItem>
      </template>
      <el-dropdown v-if="overflowActions.length" trigger="click" @command="handleCommand">
        <el-button link type="primary" aria-label="更多操作">
          更多<el-icon><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="action in overflowActions" :key="action.key"
              :command="action.key" :disabled="action.disabled">{{ action.label }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </PmToolbar>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElIcon, ElTooltip } from 'element-plus'
import { ArrowDown, MoreFilled } from '@element-plus/icons-vue'

const props = defineProps({
  actions: { type: Array, default: () => [] },
  row: { type: Object, required: true },
  mode: { type: String, default: 'text', validator: value => ['text', 'icon', 'more'].includes(value) }
})
const emit = defineEmits(['action'])
const visibleActions = computed(() => props.actions.filter(action => action.visible !== false))
const directActions = computed(() => props.mode === 'more' ? visibleActions.value.slice(0, 2) : visibleActions.value)
const overflowActions = computed(() => props.mode === 'more' ? visibleActions.value.slice(2) : [])

function invoke(action) {
  if (!action || action.disabled || action.visible === false) return
  emit('action', action.key, props.row)
}
function handleCommand(key) {
  invoke(visibleActions.value.find(action => action.key === key))
}
</script>

<style scoped>
.pt-row-actions { display: inline-flex; align-items: center; }
.pt-row-action-icon { display: inline-flex; }
.pt-row-action-icon :deep(.el-button) { border: none !important; padding: 4px; margin: 0; background: transparent; }
.pt-row-actions :deep(.pm-toolbar__inner) { align-items: center; }
</style>
<!-- Modified by AI on 2026-11-08 12:21:55 -->
