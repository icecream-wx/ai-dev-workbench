<template>
  <el-dialog
    :model-value="modelValue"
    title="设计版本"
    width="min(820px, calc(100vw - 32px))"
    top="8vh"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @open="load"
  >
    <div class="ver-toolbar">
      <span class="ver-hint">
        {{
          readonly
            ? '设计已确认，确认版本已存在；如需新版本请先重新编辑设计。'
            : '自动保存不会生成版本；需要留档时点“保存版本”。'
        }}
      </span>
      <el-button size="small" type="primary" plain :loading="saving" :disabled="readonly || saving" @click="saveVersion">
        {{ saving ? '保存中…' : '保存版本' }}
      </el-button>
    </div>
    <div class="ver-body">
      <aside class="ver-list">
        <button
          v-for="item in versions"
          :key="item.version"
          type="button"
          :class="['ver-item', { on: item.version === activeVersion }]"
          @click="select(item.version)"
        >
          <span class="ver-no">v{{ item.version }}</span>
          <span class="ver-meta">{{ sourceLabel(item.source) }} · {{ formatTime(item.createdAt) }}</span>
          <span v-if="item.changeSetSeq" class="ver-cs" :title="item.changeSetTitle ?? ''">
            变更 #{{ item.changeSetSeq }}
          </span>
          <span class="ver-count">{{ item.entityCount }} 实体 / {{ item.pageSetCount }} 页面集</span>
        </button>
        <p v-if="!versions.length" class="ver-empty">还没有版本快照。</p>
      </aside>
      <section class="ver-detail">
        <div v-if="detail" class="ver-detail-head">
          <div>
            <strong>v{{ detail.version }}</strong>
            <span class="ver-meta">{{ sourceLabel(detail.source) }} · {{ formatTime(detail.createdAt) }}</span>
            <span v-if="detail.changeSetSeq" class="ver-cs" :title="detail.changeSetTitle ?? ''">
              变更 #{{ detail.changeSetSeq }}
            </span>
          </div>
          <el-button size="small" type="warning" plain :loading="rolling" :disabled="readonly" @click="rollback">
            回滚到此版本
          </el-button>
        </div>
        <div v-if="detail" class="ver-content">
          <div class="ver-section">
            <strong>实体（{{ detail.entities.length }}）</strong>
            <div v-for="entity in detail.entities" :key="entity.id" class="ver-line">
              {{ entity.name }} <span class="muted">· {{ entity.fields.length }} 字段</span>
            </div>
          </div>
          <div class="ver-section">
            <strong>页面集（{{ detail.pageSets.length }}）</strong>
            <div v-for="set in detail.pageSets" :key="set.id" class="ver-line">
              {{ set.title }} <span class="muted">· {{ set.pages.length }} 页面</span>
            </div>
          </div>
          <p class="ver-note">版本快照只包含实体与页面集规格，不包含原型截图（PNG/HTML）。</p>
        </div>
        <p v-else class="ver-empty">选择左侧版本查看内容。</p>
      </section>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createDesignVersion, getDesignVersion, listDesignVersions, rollbackDesignVersion } from './api'
import { designVersionSourceLabel } from './version-labels.js'
import type { DesignProjectPayload, DesignVersionDetail, DesignVersionMeta, DesignVersionSource } from './types'

const props = defineProps<{
  modelValue: boolean
  appId: string
  /** M4：按模块版本（空 = 默认模块） */
  moduleId?: string
  readonly?: boolean
  /** “保存版本”前先落盘未保存编辑（由实体/原型 Tab 提供） */
  beforeSave?: () => Promise<void>
}>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  restored: [DesignProjectPayload]
  saved: [DesignProjectPayload]
}>()

const versions = ref<DesignVersionMeta[]>([])
const activeVersion = ref(0)
const detail = ref<DesignVersionDetail | null>(null)
const rolling = ref(false)
const saving = ref(false)

function sourceLabel(source: DesignVersionSource | string): string {
  return designVersionSourceLabel(source)
}

function formatTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

async function load(): Promise<void> {
  versions.value = await listDesignVersions(props.appId, props.moduleId).catch(() => [])
  if (versions.value.length) await select(versions.value[0].version)
  else {
    activeVersion.value = 0
    detail.value = null
  }
}

async function select(version: number): Promise<void> {
  activeVersion.value = version
  detail.value = await getDesignVersion(props.appId, version, props.moduleId).catch(() => null)
}

/** 手动保存版本：先 flush 未保存编辑，再让后端快照当前实体/页面集 */
async function saveVersion(): Promise<void> {
  if (props.readonly || saving.value) return
  saving.value = true
  try {
    await props.beforeSave?.()
    const project = await createDesignVersion(props.appId, props.moduleId)
    emit('saved', project)
    ElMessage.success(`已保存设计版本 v${project.version}`)
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    saving.value = false
  }
}

async function rollback(): Promise<void> {
  if (!detail.value || props.readonly) return
  const version = detail.value.version
  try {
    await ElMessageBox.confirm(
      `回滚到 v${version}？当前实体/页面规格会被该版本覆盖，并生成一个新的版本（可再次回滚）。回滚只恢复实体/页面规格，不恢复原型截图。`,
      '回滚设计版本',
      { type: 'warning', confirmButtonText: '回滚', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  rolling.value = true
  try {
    const project = await rollbackDesignVersion(props.appId, version, props.moduleId)
    ElMessage.success(`已回滚到 v${version}，当前设计 v${project.version}`)
    emit('restored', project)
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
.ver-body {
  display: flex;
  gap: 14px;
  min-height: 360px;
  max-height: min(60vh, 560px);
}
.ver-list {
  width: 250px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid var(--rg-border);
  padding-right: 8px;
}
.ver-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 8px;
  padding: 7px 9px;
  cursor: pointer;
  margin-bottom: 4px;
  color: var(--rg-text-2);
}
.ver-item:hover {
  background: var(--rg-hover);
}
.ver-item.on {
  background: var(--rg-ai-soft);
  border-color: var(--rg-ai-border);
}
.ver-no {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rg-text);
}
.ver-meta,
.ver-count {
  font-size: 10.5px;
  color: var(--rg-text-3);
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
.ver-detail {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}
.ver-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--rg-border);
}
.ver-detail-head > div {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.ver-content {
  padding-top: 10px;
}
.ver-section {
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--rg-text-2);
}
.ver-line {
  padding: 3px 0;
  font-size: 12px;
  color: var(--rg-text);
}
.ver-note {
  margin: 8px 0 0;
  padding-top: 8px;
  border-top: 1px dashed var(--rg-border);
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.muted {
  color: var(--rg-text-3);
}
.ver-empty {
  padding: 20px 4px;
  color: var(--rg-text-3);
  font-size: 12px;
}
@media (max-width: 820px) {
  .ver-body {
    flex-direction: column;
    max-height: 62vh;
    min-height: 0;
  }
  .ver-list {
    width: auto;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: none;
    border-bottom: 1px solid var(--rg-border);
    padding: 0 0 8px;
  }
  .ver-item {
    flex-shrink: 0;
    width: 180px;
    margin-bottom: 0;
    border-color: var(--rg-border);
  }
  .ver-detail {
    min-height: 220px;
  }
}
</style>
