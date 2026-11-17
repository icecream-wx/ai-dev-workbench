<template>
  <el-dialog
    :model-value="modelValue"
    title="模板中心"
    width="min(1020px, calc(100vw - 32px))"
    top="5vh"
    append-to-body
    class="tpl-dialog"
    @update:model-value="emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="tpl-layout">
      <aside class="tpl-side">
        <div class="tpl-toolbar">
          <el-input v-model="keyword" size="small" placeholder="搜索模板名称/描述" clearable />
          <el-button size="small" type="primary" plain @click="startCreate">新建模板</el-button>
        </div>

        <div class="tpl-tabs">
          <button type="button" :class="['tpl-tab', { on: tab === 'requirements' }]" @click="tab = 'requirements'">
            需求阶段
          </button>
          <button type="button" :class="['tpl-tab', { on: tab === 'later' }]" @click="tab = 'later'">
            后续阶段
          </button>
        </div>

        <div v-if="categories.length > 1" class="tpl-categories">
          <button type="button" :class="['tpl-cat', { on: !category }]" @click="category = ''">全部</button>
          <button
            v-for="item in categories"
            :key="item"
            type="button"
            :class="['tpl-cat', { on: category === item }]"
            @click="category = item"
          >
            {{ item }}
          </button>
        </div>

        <div v-loading="loading" class="tpl-list">
          <button
            v-for="item in filtered"
            :key="item.id"
            type="button"
            :class="['tpl-item', { on: selected?.id === item.id }]"
            @click="selected = item"
          >
            <span class="tpl-item-name">
              {{ item.name }}
              <span v-if="item.id === currentTemplateId" class="tpl-badge current">使用中</span>
              <span v-if="item.builtin" class="tpl-badge">内置</span>
              <span v-else class="tpl-badge private">我的</span>
            </span>
            <span class="tpl-item-meta">{{ item.category }} · {{ item.sections.length }} 节</span>
            <span class="tpl-item-desc">{{ item.description || '—' }}</span>
          </button>
          <p v-if="!filtered.length && !loading" class="tpl-empty">没有匹配的模板</p>
        </div>
      </aside>

      <section class="tpl-main">
        <template v-if="editor">
          <div class="tpl-editor-head">
            <div>
              <h3>{{ editor.id ? '编辑模板' : '新建模板' }}</h3>
              <p>模板 = 章节结构 + 撰写提示词；保存后作为“我的模板”。章节 key 保存后不可修改。</p>
            </div>
            <div class="tpl-actions">
              <el-button size="small" @click="closeEditor">返回预览</el-button>
              <el-button size="small" type="primary" :loading="saving" @click="saveEditor">保存</el-button>
            </div>
          </div>

          <p v-if="editorError" class="tpl-editor-error">{{ editorError }}</p>

          <div class="tpl-form">
            <label>
              <span>名称</span>
              <el-input v-model="editor.name" size="small" placeholder="模板名称" />
            </label>
            <label>
              <span>阶段</span>
              <el-select v-model="editor.stage" size="small">
                <el-option label="需求" value="requirements" />
                <el-option label="设计" value="design" />
                <el-option label="测试" value="test" />
                <el-option label="开发计划" value="dev-plan" />
              </el-select>
            </label>
            <label>
              <span>分类</span>
              <el-input v-model="editor.category" size="small" placeholder="如：产品需求" />
            </label>
            <label class="wide">
              <span>描述</span>
              <el-input v-model="editor.description" size="small" placeholder="一句话说明适用场景" />
            </label>
            <label class="wide">
              <span>模板提示词（给 AI 的总说明）</span>
              <el-input v-model="editor.prompt" type="textarea" :rows="4" placeholder="说明模板用途、写作原则、禁止事项" />
            </label>
          </div>

          <div class="tpl-sections-head">
            <strong>章节（{{ editor.sections.length }}）</strong>
            <el-button size="small" plain @click="addSection">新增章节</el-button>
          </div>
          <div class="tpl-sections">
            <div v-for="(section, index) in editor.sections" :key="`${section.id || 'new'}-${index}`" class="tpl-section-row">
              <div class="tpl-section-line">
                <el-input v-model="section.title" size="small" placeholder="章节标题" class="grow" />
                <el-select v-model="section.level" size="small" class="w-70">
                  <el-option label="二级" :value="2" />
                  <el-option label="三级" :value="3" />
                </el-select>
                <el-select v-model="section.kind" size="small" class="w-130">
                  <el-option v-for="(label, value) in SECTION_KIND_LABELS" :key="value" :label="label" :value="value" />
                </el-select>
                <el-checkbox v-model="section.required" size="small">必填</el-checkbox>
                <el-button size="small" text :disabled="index === 0" @click="moveSection(index, -1)">↑</el-button>
                <el-button size="small" text :disabled="index === editor.sections.length - 1" @click="moveSection(index, 1)">↓</el-button>
                <el-button size="small" text type="danger" @click="removeSection(index)">删除</el-button>
              </div>
              <el-input v-model="section.guidance" size="small" placeholder="撰写提示：这一节写什么" />
              <div v-if="savedKeys.has(section.id)" class="tpl-section-key">
                章节 key（不可修改）：<code>{{ section.id }}</code>
              </div>
              <div v-else class="tpl-section-key new">
                <el-input v-model="section.id" size="small" placeholder="章节 key，如 custom-notes" class="w-200" />
                <span class="tpl-key-hint">只能使用小写字母、数字、短横线；保存后不可修改</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="selected">
          <div class="tpl-preview-head">
            <div>
              <h3>
                {{ selected.name }}
                <span v-if="selected.builtin" class="tpl-badge">内置只读</span>
                <span v-else class="tpl-badge private">我的模板</span>
              </h3>
              <p>{{ selected.description || '—' }}</p>
              <div class="tpl-meta-row">
                <span>{{ stageLabel(selected.stage) }}阶段</span>
                <span>{{ selected.category }}</span>
                <span>{{ selected.sections.length }} 个章节</span>
                <span>更新于 {{ formatTime(selected.updatedAt) }}</span>
              </div>
              <p
                v-if="applyScope === 'app' && selected.stage === 'requirements' && (selected.id !== currentTemplateId || hasDivergentTemplates)"
                class="tpl-app-note"
              >
                {{
                  hasDivergentTemplates
                    ? '当前应用存在模板不一致的模块；应用此模板会把所有未归档模块对齐（先预览逐模块影响，再二次确认）。'
                    : '应用级切换：会同时改写当前应用所有未归档模块（先预览逐模块影响，再二次确认）。'
                }}
              </p>
            </div>
            <div class="tpl-actions">
              <el-button
                v-if="selected.stage === 'requirements'"
                size="small"
                type="primary"
                :disabled="selected.id === currentTemplateId && !hasDivergentTemplates"
                @click="emit('use', selected)"
              >
                {{ selected.id === currentTemplateId && !hasDivergentTemplates ? '使用中' : applyLabel }}
              </el-button>
              <el-button size="small" @click="duplicateSelected">复制并编辑</el-button>
              <el-button v-if="!selected.builtin" size="small" @click="startEdit(selected)">编辑</el-button>
              <el-button v-if="!selected.builtin" size="small" type="danger" plain @click="removeSelected">删除</el-button>
              <span v-if="selected.stage !== 'requirements'" class="tpl-note">该模板属于后续阶段，需求阶段不可选</span>
            </div>
          </div>

          <div class="tpl-prompt">
            <strong>模板提示词</strong>
            <pre>{{ selected.prompt }}</pre>
          </div>

          <div class="tpl-section-preview">
            <div v-for="(section, index) in selected.sections" :key="section.id" class="tpl-section-card">
              <div class="tpl-section-title">
                <span class="tpl-index">{{ index + 1 }}</span>
                <strong>{{ section.title }}</strong>
                <span class="tpl-kind">{{ SECTION_KIND_LABELS[section.kind] }}</span>
                <span :class="['tpl-required', { on: section.required }]">{{ section.required ? '必填' : '可选' }}</span>
                <code>{{ section.id }}</code>
              </div>
              <p>{{ section.guidance || '—' }}</p>
            </div>
          </div>
        </template>

        <div v-else class="tpl-empty-main">选择左侧模板查看详情</div>
      </section>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  SECTION_KIND_LABELS,
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  listTemplates,
  templateStageLabel,
  updateTemplate,
  type RequirementTemplate,
  type TemplateSectionDef
} from './api'

const props = defineProps<{
  modelValue: boolean
  currentTemplateId?: string
  /** M3：需求模块视图默认“应用到全部模块”（先预览 + 二次确认）；module 保留单模块切换 */
  applyScope?: 'app' | 'module'
  /** M3 must-fix：存在未归档模块模板与当前不同，允许用当前模板“对齐全部模块” */
  hasDivergentTemplates?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; use: [RequirementTemplate]; changed: [] }>()

const applyLabel = computed(() => (props.applyScope === 'app' ? '应用到全部模块' : '使用此模板'))

const tab = ref<'requirements' | 'later'>('requirements')
const keyword = ref('')
const category = ref('')
const templates = ref<RequirementTemplate[]>([])
const selected = ref<RequirementTemplate | null>(null)
const loading = ref(false)
const saving = ref(false)
const editor = ref<RequirementTemplate | null>(null)
const editorError = ref('')
/** 已保存章节的 key：只读，不允许改名 */
const savedKeys = ref<Set<string>>(new Set())

const stageLabel = templateStageLabel

const scoped = computed(() => templates.value.filter(item => (tab.value === 'requirements' ? item.stage === 'requirements' : item.stage !== 'requirements')))
const categories = computed(() => Array.from(new Set(scoped.value.map(item => item.category))).sort())
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return scoped.value.filter(item => {
    if (category.value && item.category !== category.value) return false
    if (!kw) return true
    return `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(kw)
  })
})

async function load(): Promise<void> {
  loading.value = true
  try {
    templates.value = await listTemplates()
    if (selected.value) {
      selected.value = templates.value.find(item => item.id === selected.value?.id) ?? null
    }
    if (!selected.value) selected.value = templates.value.find(item => item.id === props.currentTemplateId) ?? filtered.value[0] ?? templates.value[0] ?? null
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    loading.value = false
  }
}

function onOpen(): void {
  editor.value = null
  editorError.value = ''
  savedKeys.value = new Set()
  tab.value = 'requirements'
  selectionReset()
  void load()
}

function selectionReset(): void {
  selected.value = null
  keyword.value = ''
  category.value = ''
}

watch(tab, () => {
  category.value = ''
  if (!filtered.value.length) selected.value = null
  else if (!selected.value || !filtered.value.some(item => item.id === selected.value?.id)) selected.value = filtered.value[0]
})

function formatTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function blankSection(): TemplateSectionDef {
  return {
    id: '',
    title: '',
    level: 2,
    kind: 'markdown',
    guidance: '',
    required: false
  }
}

function startCreate(): void {
  editorError.value = ''
  savedKeys.value = new Set()
  editor.value = {
    id: '',
    name: '我的需求模板',
    stage: 'requirements',
    category: '我的模板',
    description: '',
    prompt: '你是资深产品经理。按章节结构整理需求文档；信息不足写 “> 待确认：...”，不要编造。',
    sections: [blankSection()],
    builtin: false,
    visibility: 'private',
    createdAt: '',
    updatedAt: ''
  }
}

function startEdit(template: RequirementTemplate): void {
  editorError.value = ''
  savedKeys.value = new Set(template.sections.map(section => section.id))
  editor.value = JSON.parse(JSON.stringify(template)) as RequirementTemplate
}

function closeEditor(): void {
  editor.value = null
  editorError.value = ''
}

function addSection(): void {
  if (!editor.value) return
  editorError.value = ''
  editor.value.sections.push(blankSection())
}

function removeSection(index: number): void {
  if (!editor.value) return
  editor.value.sections.splice(index, 1)
  editorError.value = ''
}

function moveSection(index: number, delta: number): void {
  if (!editor.value) return
  const list = editor.value.sections
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
  editorError.value = ''
}

const SECTION_KEY_PATTERN = /^[a-z0-9-]+$/

/** 保存前校验：错误留在弹窗内，不关闭 */
function validateEditor(): string {
  const current = editor.value
  if (!current) return ''
  if (!current.name.trim()) return '模板名称不能为空'
  if (!current.prompt.trim()) return '模板提示词不能为空'
  if (!current.sections.length) return '模板至少需要 1 个章节'
  const seen = new Set<string>()
  let hasRequired = false
  for (const [index, section] of current.sections.entries()) {
    const key = section.id.trim()
    if (!key) return `第 ${index + 1} 个章节缺少 key（如 custom-notes）`
    if (!SECTION_KEY_PATTERN.test(key)) {
      return `章节 key「${key}」不合法：只能使用小写字母、数字、短横线`
    }
    if (seen.has(key)) return `章节 key 重复：${key}`
    seen.add(key)
    if (!section.title.trim()) return `章节 key「${key}」缺少标题`
    if (section.required) hasRequired = true
  }
  if (!hasRequired) return '至少需要 1 个必填章节'
  return ''
}

async function saveEditor(): Promise<void> {
  if (!editor.value) return
  editorError.value = validateEditor()
  if (editorError.value) return
  saving.value = true
  try {
    const payload = {
      name: editor.value.name.trim(),
      stage: editor.value.stage,
      category: editor.value.category.trim() || '我的模板',
      description: editor.value.description,
      prompt: editor.value.prompt,
      sections: editor.value.sections.map(section => ({
        ...section,
        id: section.id.trim(),
        title: section.title.trim()
      }))
    }
    const saved = editor.value.id ? await updateTemplate(editor.value.id, payload) : await createTemplate(payload)
    editor.value = null
    editorError.value = ''
    emit('changed')
    await load()
    selected.value = templates.value.find(item => item.id === saved.id) ?? null
    ElMessage.success('模板已保存')
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : String(error)
  } finally {
    saving.value = false
  }
}

async function duplicateSelected(): Promise<void> {
  if (!selected.value) return
  try {
    const copy = await duplicateTemplate(selected.value.id)
    emit('changed')
    await load()
    const found = templates.value.find(item => item.id === copy.id)
    if (found) {
      selected.value = found
      startEdit(found)
    }
    ElMessage.success('已复制为新模板，可继续编辑')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

async function removeSelected(): Promise<void> {
  if (!selected.value) return
  try {
    await ElMessageBox.confirm(
      `删除模板「${selected.value.name}」？使用中的模板不能删除；删除后不可恢复。`,
      '删除模板',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )
  } catch {
    return
  }
  try {
    await deleteTemplate(selected.value.id)
    emit('changed')
    selected.value = null
    await load()
    ElMessage.success('模板已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}
</script>

<style scoped>
.tpl-layout {
  display: flex;
  gap: 16px;
  /* 与全局 .el-dialog flex/body 滚动配合：高度不超出视口内的 body */
  height: min(68vh, calc(100vh - 230px));
  min-height: 360px;
  color: var(--rg-text);
}
.tpl-side {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.tpl-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tpl-toolbar :deep(.el-input) {
  flex: 1;
  min-width: 140px;
}
.tpl-tabs {
  display: flex;
  gap: 4px;
  background: var(--rg-fill);
  border-radius: 9px;
  padding: 3px;
}
.tpl-tab {
  flex: 1;
  border: none;
  background: transparent;
  border-radius: 7px;
  padding: 6px 8px;
  font-size: 12.5px;
  color: var(--rg-text-2);
  cursor: pointer;
}
.tpl-tab.on {
  background: var(--rg-surface);
  color: var(--rg-text);
  font-weight: 600;
  box-shadow: var(--rg-shadow-1);
}
.tpl-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tpl-cat {
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  cursor: pointer;
}
.tpl-cat:hover {
  border-color: var(--rg-border-strong);
  color: var(--rg-text);
}
.tpl-cat.on {
  border-color: var(--rg-ink);
  color: var(--rg-text);
  background: var(--rg-fill-2);
}
.tpl-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
}
.tpl-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  border-radius: 9px;
  padding: 9px 11px;
  cursor: pointer;
}
.tpl-item:hover {
  border-color: var(--rg-border-strong);
  background: var(--rg-hover);
}
.tpl-item.on {
  border-color: var(--rg-ink);
  background: var(--rg-surface-2);
}
.tpl-item-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--rg-text);
  flex-wrap: wrap;
}
.tpl-item-meta {
  font-size: 11px;
  color: var(--rg-text-3);
}
.tpl-item-desc {
  font-size: 11.5px;
  color: var(--rg-text-2);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tpl-badge {
  font-size: 10px;
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
  font-weight: 500;
  white-space: nowrap;
}
.tpl-badge.private {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.tpl-badge.current {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.tpl-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  padding: 16px;
  overflow-y: auto;
  background: var(--rg-surface);
}
.tpl-preview-head,
.tpl-editor-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.tpl-preview-head h3,
.tpl-editor-head h3 {
  margin: 0;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  color: var(--rg-text);
}
.tpl-preview-head p,
.tpl-editor-head p {
  margin: 5px 0 0;
  font-size: 12px;
  color: var(--rg-text-2);
  line-height: 1.6;
}
.tpl-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.tpl-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.tpl-note {
  font-size: 11px;
  color: var(--rg-warn);
}
.tpl-app-note {
  margin: 8px 0 0;
  font-size: 11.5px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border: 1px solid var(--rg-ai-border);
  border-radius: 8px;
  padding: 6px 10px;
  line-height: 1.6;
}
.tpl-prompt {
  margin-top: 14px;
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 10px 12px;
  background: var(--rg-surface-2);
}
.tpl-prompt strong {
  font-size: 12px;
  color: var(--rg-text-2);
}
.tpl-prompt pre {
  margin: 7px 0 0;
  white-space: pre-wrap;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--rg-code-text);
  background: var(--rg-code-bg);
  border: 1px solid var(--rg-code-border);
  border-radius: 7px;
  padding: 8px 10px;
  font-family: inherit;
  overflow-x: auto;
}
.tpl-section-preview {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tpl-section-card {
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 9px 11px;
}
.tpl-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  flex-wrap: wrap;
  color: var(--rg-text);
}
.tpl-index {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--rg-fill);
  color: var(--rg-text-2);
  font-size: 10.5px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.tpl-kind {
  font-size: 10.5px;
  color: var(--rg-text-2);
  background: var(--rg-fill);
  border-radius: 999px;
  padding: 1px 7px;
}
.tpl-required {
  font-size: 10.5px;
  color: var(--rg-text-3);
  background: var(--rg-fill);
  border-radius: 999px;
  padding: 1px 7px;
}
.tpl-required.on {
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
}
.tpl-section-card p {
  margin: 5px 0 0;
  font-size: 11.5px;
  color: var(--rg-text-2);
  line-height: 1.6;
}
.tpl-section-card code {
  font-size: 10.5px;
  color: var(--rg-code-text);
  background: var(--rg-code-bg);
  border: 1px solid var(--rg-code-border);
  border-radius: 4px;
  padding: 1px 5px;
}
.tpl-empty,
.tpl-empty-main {
  font-size: 12px;
  color: var(--rg-text-3);
  text-align: center;
  padding: 28px 0;
}
.tpl-form {
  display: grid;
  grid-template-columns: 1fr 140px 1fr;
  gap: 10px 12px;
  margin-top: 14px;
}
.tpl-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  min-width: 0;
}
.tpl-form label.wide {
  grid-column: 1 / -1;
}
.tpl-sections-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  font-size: 12.5px;
  color: var(--rg-text);
}
.tpl-sections {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tpl-section-row {
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tpl-section-line {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.tpl-section-line .grow {
  flex: 1;
  min-width: 160px;
}
.w-70 {
  width: 70px;
}
.w-130 {
  width: 130px;
}
.tpl-section-key {
  font-size: 10.5px;
  color: var(--rg-text-3);
}
.tpl-section-key code {
  font-size: 10.5px;
  color: var(--rg-code-text);
  background: var(--rg-code-bg);
  border: 1px solid var(--rg-code-border);
  border-radius: 4px;
  padding: 1px 5px;
}
.tpl-section-key.new {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tpl-key-hint {
  font-size: 10px;
  color: var(--rg-text-3);
}
.w-200 {
  width: 200px;
}
.tpl-editor-error {
  margin: 10px 0 0;
  border: 1px solid var(--rg-danger-border);
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 11.5px;
  line-height: 1.6;
}

@media (max-width: 1024px) {
  .tpl-side {
    width: 260px;
  }
  .tpl-form {
    grid-template-columns: 1fr 120px 1fr;
  }
}
@media (max-width: 820px) {
  .tpl-layout {
    flex-direction: column;
    height: auto;
    min-height: 0;
  }
  .tpl-side {
    width: auto;
    flex-shrink: 0;
  }
  .tpl-list {
    max-height: 168px;
  }
  .tpl-main {
    flex: 1;
    min-height: 240px;
    overflow-y: visible;
  }
  .tpl-form {
    grid-template-columns: 1fr;
  }
  .tpl-actions {
    justify-content: flex-start;
  }
}
</style>
