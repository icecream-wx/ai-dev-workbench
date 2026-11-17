<template>
  <article class="pending-card">
    <header>
      <span class="badge warn">权限请求</span>
      <code>{{ permission.action }}</code>
    </header>
    <p v-if="permission.message" class="message">{{ permission.message }}</p>
    <div v-if="permission.resources?.length" class="resources">
      <code v-for="resource in permission.resources" :key="resource">{{ resource }}</code>
    </div>
    <div class="actions">
      <el-button size="small" type="primary" :loading="busy" :disabled="readonly" @click="emit('reply', 'once')">允许一次</el-button>
      <el-button size="small" :loading="busy" :disabled="readonly" @click="emit('reply', 'always')">始终允许</el-button>
      <el-button size="small" type="danger" plain :disabled="busy || readonly" @click="rejecting = !rejecting">拒绝</el-button>
      <span v-if="readonly" class="readonly-hint">只读查看，恢复为当前会话后可操作。</span>
    </div>
    <div v-if="rejecting && !readonly" class="reject-row">
      <el-input v-model="reason" size="small" placeholder="拒绝原因（可选）" @keyup.enter="submitReject" />
      <el-button size="small" type="danger" :loading="busy" @click="submitReject">确认拒绝</el-button>
      <el-button size="small" text @click="rejecting = false">取消</el-button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { PermissionRequest } from './types'

const props = defineProps<{ permission: PermissionRequest; busy?: boolean; readonly?: boolean }>()
const emit = defineEmits<{ reply: [decision: 'once' | 'always' | 'reject', message?: string] }>()
const rejecting = ref(false)
const reason = ref('')

function submitReject(): void {
  emit('reply', 'reject', reason.value.trim() || undefined)
  rejecting.value = false
}
</script>

<style scoped>
.pending-card {
  border: 1px solid var(--rg-warn-border, #f0dcae);
  background: var(--rg-warn-soft, #fdf4e3);
  border-radius: 10px;
  padding: 11px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  flex-wrap: wrap;
}
.badge {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 10.5px;
  background: var(--rg-surface, #fff);
  color: var(--rg-warn, #a05e03);
  border: 1px solid var(--rg-warn-border, #f0dcae);
}
code,
.resources code {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  background: var(--rg-code-bg, #f6f8fa);
  color: var(--rg-code-text, #333a45);
  border: 1px solid var(--rg-code-border, #e8ecf0);
  border-radius: 4px;
  padding: 1px 5px;
}
.message {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--rg-text-2, #4b5563);
  white-space: pre-wrap;
  word-break: break-word;
}
.resources {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.resources code {
  max-width: 100%;
  overflow-wrap: anywhere;
}
.actions,
.reject-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.reject-row {
  margin-top: 2px;
}
.readonly-hint {
  font-size: 10.5px;
  color: var(--rg-text-3, #8a93a3);
}
</style>
