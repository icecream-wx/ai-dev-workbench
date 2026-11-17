<template>
  <el-dialog
    :model-value="modelValue"
    :title="moduleTitle ? `需求文档版本历史 · ${moduleTitle}` : '需求文档版本历史'"
    width="min(900px, calc(100vw - 32px))"
    top="6vh"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @open="load"
  >
    <div class="ver-toolbar">
      <span class="ver-hint">
        {{ readonly ? '文档已确认，确认版本已存在；如需新版本请先重新编辑需求。' : '自动保存不会生成版本；需要留档时点“保存版本”。' }}
      </span>
      <el-button size="small" type="primary" plain :loading="saving" :disabled="readonly" @click="saveVersion">
        {{ saving ? '保存中…' : '保存版本' }}
      </el-button>
    </div>
    <div class="ver-layout">
      <aside class="ver-list">
        <div v-if="loadingList" class="ver-loading">加载中…</div>
        <button
          v-for="item in versions"
          :key="item.version"
          type="button"
          :class="['ver-item', { on: current?.version === item.version }]"
          @click="select(item.version)"
        >
          <span class="ver-no">v{{ item.version }}</span>
          <span class="ver-meta">{{ sourceLabel(item.source) }} · {{ formatTime(item.createdAt) }}</span>
          <span v-if="item.changeSetSeq" class="ver-cs">变更 #{{ item.changeSetSeq }}</span>
          <span class="ver-size">{{ formatSize(item.size) }}</span>
        </button>
        <p v-if="!versions.length && !loadingList" class="ver-empty">还没有版本</p>
      </aside>

      <section class="ver-main">
        <div v-if="loadingDetail" class="ver-loading">加载版本内容…</div>
        <template v-else-if="current">
          <div class="ver-head">
            <div>
              <h3>
                v{{ current.version }} · {{ sourceLabel(current.source) }}
                <span v-if="current.changeSetSeq" class="ver-cs">变更 #{{ current.changeSetSeq }}</span>
              </h3>
              <p>{{ formatTime(current.createdAt) }} · {{ formatSize(current.size) }}</p>
            </div>
            <el-button size="small" type="warning" plain :loading="rolling" :disabled="readonly" @click="rollback">回滚到此版本</el-button>
          </div>
          <div class="ver-tabs">
            <button type="button" :class="['ver-tab', { on: mode === 'preview' }]" @click="mode = 'preview'">预览</button>
            <button type="button" :class="['ver-tab', { on: mode === 'source' }]" @click="mode = 'source'">源码</button>
          </div>
          <div class="ver-body">
            <MarkdownView v-if="mode === 'preview'" :markdown="current.contentMd" />
            <pre v-else class="ver-source">{{ current.contentMd }}</pre>
          </div>
        </template>
        <div v-else class="ver-empty">选择左侧版本查看内容</div>
      </section>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MarkdownView from './MarkdownView.vue'
import {
  createDocVersion,
  getDocVersion,
  listDocVersions,
  rollbackDocVersion,
  type DocVersionDetail,
  type DocVersionMeta,
  type RequirementDocPayload
} from './api'

const props = defineProps<{
  modelValue: boolean
  appId: string
  /** M3：版本按模块独立；父组件切模块时用 :key 重挂载 */
  moduleId?: string
  moduleTitle?: string
  readonly?: boolean
  /** “保存版本”前先落盘未保存编辑（由文档页提供） */
  beforeSave?: () => Promise<void>
}>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  restored: [RequirementDocPayload]
  saved: [RequirementDocPayload]
}>()

const versions = ref<DocVersionMeta[]>([])
const current = ref<DocVersionDetail | null>(null)
const loadingList = ref(false)
const loadingDetail = ref(false)
const rolling = ref(false)
const saving = ref(false)
const mode = ref<'preview' | 'source'>('preview')

const SOURCE_LABELS: Record<string, string> = {
  confirm: '确认需求',
  ai: 'AI 应用',
  'template-change': '模板切换',
  rollback: '版本回滚',
  restore: '变更取消恢复',
  manual: '手动保存'
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? '手动保存'
}

function formatTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function formatSize(size: number): string {
  if (!size) return '0 B'
  return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`
}

async function load(): Promise<void> {
  loadingList.value = true
  current.value = null
  try {
    versions.value = await listDocVersions(props.appId, props.moduleId)
    if (versions.value.length) await select(versions.value[0].version)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    loadingList.value = false
  }
}

async function select(version: number): Promise<void> {
  loadingDetail.value = true
  try {
    current.value = await getDocVersion(props.appId, version, props.moduleId)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    loadingDetail.value = false
  }
}

/** 手动保存版本：先落盘未保存编辑，再让后端把当前内容快照为 manual 版本 */
async function saveVersion(): Promise<void> {
  if (props.readonly || saving.value) return
  saving.value = true
  try {
    await props.beforeSave?.()
    const payload = await createDocVersion(props.appId, props.moduleId)
    emit('saved', payload)
    ElMessage.success(`已保存版本 v${payload.doc.version}`)
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    saving.value = false
  }
}

async function rollback(): Promise<void> {
  if (!current.value || props.readonly) return
  const version = current.value.version
  try {
    await ElMessageBox.confirm(
      `回滚到 v${version}？当前章节内容会被该版本覆盖，并生成一个新的版本（可再次回滚）。`,
      '回滚版本',
      { type: 'warning', confirmButtonText: '回滚', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  rolling.value = true
  try {
    const payload = await rollbackDocVersion(props.appId, version, props.moduleId)
    emit('restored', payload)
    ElMessage.success(`已回滚到 v${version}，当前版本 v${payload.doc.version}`)
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    rolling.value = false
  }
}
</script>

<style scoped>
.ver-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 10px;
}
.ver-hint {
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.ver-layout {
  display: flex;
  gap: 14px;
  height: min(62vh, 560px);
  min-height: 360px;
}
.ver-list {
  width: 260px;
  flex-shrink: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
}
.ver-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  border-radius: 9px;
  padding: 8px 10px;
  cursor: pointer;
}
.ver-item:hover {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.ver-item.on {
  border-color: var(--rg-ink);
  background: var(--rg-surface-2);
}
.ver-no {
  font-size: 13px;
  font-weight: 600;
  color: var(--rg-text);
}
.ver-meta {
  font-size: 11px;
  color: var(--rg-text-2);
}
.ver-cs {
  display: inline-block;
  width: fit-content;
  font-size: 10px;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.ver-size {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.ver-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  padding: 14px;
  min-height: 0;
}
.ver-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.ver-head h3 {
  margin: 0;
  font-size: 15px;
}
.ver-head p {
  margin: 4px 0 0;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.ver-tabs {
  display: flex;
  gap: 4px;
  margin: 10px 0 8px;
  background: var(--rg-fill);
  border-radius: 8px;
  padding: 3px;
  width: fit-content;
}
.ver-tab {
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--rg-text-2);
  cursor: pointer;
}
.ver-tab.on {
  background: var(--rg-surface);
  color: var(--rg-text);
  font-weight: 600;
  box-shadow: var(--rg-shadow-1);
}
.ver-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-top: 1px solid var(--rg-border);
  padding-top: 10px;
}
.ver-source {
  margin: 0;
  white-space: pre-wrap;
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
  color: var(--rg-code-text);
  background: var(--rg-code-bg);
  border: 1px solid var(--rg-code-border);
  border-radius: 8px;
  padding: 10px 12px;
}
.ver-loading,
.ver-empty {
  font-size: 12px;
  color: var(--rg-text-3);
  padding: 20px 0;
  text-align: center;
}
@media (max-width: 820px) {
  .ver-layout {
    flex-direction: column;
    height: auto;
    max-height: 62vh;
    min-height: 0;
  }
  .ver-list {
    width: auto;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 6px;
  }
  .ver-item {
    flex-shrink: 0;
    width: 180px;
  }
  .ver-main {
    min-height: 300px;
  }
}
</style>
