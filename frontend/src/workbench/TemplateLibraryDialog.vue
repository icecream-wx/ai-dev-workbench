<template>
  <el-dialog
    :model-value="modelValue"
    title="模板库（全局）"
    width="min(1020px, calc(100vw - 32px))"
    top="5vh"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="layout">
      <aside class="side">
        <div class="toolbar">
          <el-input v-model="keyword" size="small" placeholder="搜索模板名称/描述" clearable />
          <el-button size="small" type="primary" plain @click="startCreate">新建模板</el-button>
        </div>

        <div v-if="categories.length > 1" class="categories rg-tabs rg-tabs--wrap">
          <button type="button" :class="['rg-tab', { 'rg-tab--active': !category }]" @click="category = ''">全部</button>
          <button
            v-for="item in categories"
            :key="item"
            type="button"
            :class="['rg-tab', { 'rg-tab--active': category === item }]"
            @click="category = item"
          >
            {{ item }}
          </button>
        </div>

        <div v-loading="loading" class="list">
          <button
            v-for="item in filtered"
            :key="item.id"
            type="button"
            :class="['item', { on: selected?.id === item.id }]"
            @click="selected = item"
          >
            <span class="item-name">
              {{ item.name }}
              <span v-if="item.builtin" class="badge">内置</span>
              <span v-else class="badge mine">我的</span>
            </span>
            <span class="item-meta">{{ item.category }} · {{ item.sections.length }} 节</span>
            <span class="item-desc">{{ item.description || '—' }}</span>
          </button>
          <p v-if="!filtered.length && !loading" class="empty">没有匹配的模板</p>
        </div>

        <p class="side-note">
          模板库是全局唯一权威；应用内
          <code>.opencode/skills/adw-template-req-&lt;id&gt;/</code> 只是派生的模板 skill，保存后自动同步。
        </p>
      </aside>

      <section class="main">
        <template v-if="editor">
          <div class="editor-head">
            <div>
              <h3>{{ editor.id ? '编辑模板' : '新建模板' }}</h3>
              <p>模板 = 章节结构 + 撰写提示词；保存后成为“我的模板”并同步到携带该模板的应用。</p>
            </div>
            <div class="actions">
              <el-button size="small" @click="closeEditor">返回预览</el-button>
              <el-button size="small" type="primary" :loading="saving" @click="saveEditor">保存</el-button>
            </div>
          </div>

          <p v-if="editorError" class="editor-error">{{ editorError }}</p>

          <div class="form">
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
              <el-input v-model="editor.prompt" type="textarea" :rows="4" />
            </label>
          </div>

          <div class="sections-head">
            <strong>章节（{{ editor.sections.length }}）</strong>
            <el-button size="small" plain @click="addSection">新增章节</el-button>
          </div>
          <div class="sections">
            <div v-for="(section, index) in editor.sections" :key="`${section.id || 'new'}-${index}`" class="section-row">
              <div class="section-line">
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
              <div v-if="savedKeys.has(section.id)" class="section-key">
                章节 key（不可修改）：<code>{{ section.id }}</code>
              </div>
              <div v-else class="section-key new">
                <el-input v-model="section.id" size="small" placeholder="章节 key，如 custom-notes" class="w-200" />
                <span class="key-hint">只能使用字母、数字、下划线、短横线；保存后不可修改</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="selected">
          <div class="preview-head">
            <div>
              <h3>
                {{ selected.name }}
                <span v-if="selected.builtin" class="badge">内置只读</span>
                <span v-else class="badge mine">我的模板</span>
              </h3>
              <p>{{ selected.description || '—' }}</p>
              <div class="meta-row">
                <span>{{ templateStageLabel(selected.stage) }}阶段</span>
                <span>{{ selected.category }}</span>
                <span>{{ selected.sections.length }} 个章节</span>
                <span>更新于 {{ formatTime(selected.updatedAt) }}</span>
                <span data-testid="template-skill-hint">skill: <code>adw-template-req-{{ selected.id }}</code></span>
              </div>
            </div>
            <div class="actions">
              <el-button size="small" @click="syncSelected">同步到应用</el-button>
              <el-button size="small" @click="duplicateSelected">复制并编辑</el-button>
              <el-button v-if="!selected.builtin" size="small" @click="startEdit(selected)">编辑</el-button>
              <el-button v-if="!selected.builtin" size="small" type="danger" plain @click="removeSelected">删除</el-button>
            </div>
          </div>

          <p v-if="syncMessage" class="sync-message">{{ syncMessage }}</p>

          <div class="prompt">
            <strong>模板提示词</strong>
            <pre>{{ selected.prompt }}</pre>
          </div>

          <div class="section-preview">
            <div v-for="(section, index) in selected.sections" :key="section.id" class="section-card">
              <div class="section-title">
                <span class="index">{{ index + 1 }}</span>
                <strong>{{ section.title }}</strong>
                <span class="kind">{{ SECTION_KIND_LABELS[section.kind] ?? section.kind }}</span>
                <span :class="['required', { on: section.required }]">{{ section.required ? '必填' : '可选' }}</span>
                <code>{{ section.id }}</code>
              </div>
              <p>{{ section.guidance || '—' }}</p>
            </div>
          </div>
        </template>

        <div v-else class="empty-main">选择左侧模板查看详情</div>
      </section>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  SECTION_KIND_LABELS,
  TemplateApiError,
  createRequirementTemplate,
  deleteRequirementTemplate,
  duplicateRequirementTemplate,
  listRequirementTemplates,
  syncTemplate,
  templateStageLabel,
  updateRequirementTemplate,
  type RequirementTemplate,
  type TemplateSectionDef
} from '../shared/template-api'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; changed: [] }>()

const keyword = ref('')
const category = ref('')
const templates = ref<RequirementTemplate[]>([])
const selected = ref<RequirementTemplate | null>(null)
const loading = ref(false)
const saving = ref(false)
const editor = ref<RequirementTemplate | null>(null)
const editorError = ref('')
const syncMessage = ref('')
const savedKeys = ref<Set<string>>(new Set())

const categories = computed(() => Array.from(new Set(templates.value.map(item => item.category))).sort())
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return templates.value.filter(item => {
    if (category.value && item.category !== category.value) return false
    if (!kw) return true
    return `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(kw)
  })
})

async function load(): Promise<void> {
  loading.value = true
  try {
    templates.value = await listRequirementTemplates()
    if (selected.value) selected.value = templates.value.find(item => item.id === selected.value?.id) ?? null
    if (!selected.value) selected.value = filtered.value[0] ?? templates.value[0] ?? null
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    loading.value = false
  }
}

function onOpen(): void {
  editor.value = null
  editorError.value = ''
  syncMessage.value = ''
  savedKeys.value = new Set()
  keyword.value = ''
  category.value = ''
  selected.value = null
  void load()
}

function formatTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function blankSection(): TemplateSectionDef {
  return { id: '', title: '', level: 2, kind: 'markdown', guidance: '', required: false }
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
  editor.value?.sections.push(blankSection())
}

function removeSection(index: number): void {
  editor.value?.sections.splice(index, 1)
}

function moveSection(index: number, delta: number): void {
  if (!editor.value) return
  const list = editor.value.sections
  const target = index + delta
  if (target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
}

const SECTION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

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
    if (!SECTION_KEY_PATTERN.test(key)) return `章节 key「${key}」不合法：只能包含字母、数字、下划线和短横线`
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
    const saved = editor.value.id
      ? await updateRequirementTemplate(editor.value.id, payload)
      : await createRequirementTemplate(payload)
    editor.value = null
    emit('changed')
    await load()
    selected.value = templates.value.find(item => item.id === saved.id) ?? null
    ElMessage.success('模板已保存并同步到携带它的应用')
  } catch (error) {
    editorError.value = error instanceof Error ? error.message : String(error)
  } finally {
    saving.value = false
  }
}

async function duplicateSelected(): Promise<void> {
  if (!selected.value) return
  try {
    const copy = await duplicateRequirementTemplate(selected.value.id)
    emit('changed')
    await load()
    const found = templates.value.find(item => item.id === copy.id)
    if (found) {
      selected.value = found
      startEdit(found)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

async function syncSelected(): Promise<void> {
  if (!selected.value) return
  try {
    const result = await syncTemplate('requirement', selected.value.id)
    const parts: string[] = []
    parts.push(
      result.apps.length
        ? `已同步到 ${result.apps.length} 个应用：${result.apps.join('、')}`
        : '没有应用携带该模板（可作为应用默认模板后再同步）'
    )
    const skill = result.templateSkill || `adw-template-req-${selected.value.id}`
    parts.push(`应用内 skill：${skill}`)
    if (result.warnings.length) parts.push(`告警：${result.warnings.join('；')}`)
    syncMessage.value = parts.join('；')
  } catch (error) {
    syncMessage.value = error instanceof Error ? error.message : String(error)
  }
}

async function removeSelected(): Promise<void> {
  if (!selected.value) return
  try {
    await ElMessageBox.confirm(
      `删除模板「${selected.value.name}」？仍被模块 frontmatter 引用时会被拒绝（会列出引用位置）。`,
      '删除模板',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await deleteRequirementTemplate(selected.value.id)
    emit('changed')
    selected.value = null
    await load()
    ElMessage.success('模板已删除')
  } catch (error) {
    if (error instanceof TemplateApiError && error.status === 409) {
      ElMessage.error(error.message)
      return
    }
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}
</script>

<style scoped>
.layout {
  display: flex;
  gap: 16px;
  height: min(68vh, calc(100vh - 230px));
  min-height: 360px;
  color: var(--rg-text);
}
.side {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.toolbar :deep(.el-input) {
  flex: 1;
  min-width: 140px;
}
.categories {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.item {
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
.item.on {
  border-color: var(--rg-ink);
  background: var(--rg-surface-2);
}
.item-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  flex-wrap: wrap;
}
.item-meta {
  font-size: 11px;
  color: var(--rg-text-3);
}
.item-desc {
  font-size: 11.5px;
  color: var(--rg-text-2);
  line-height: 1.5;
}
.badge {
  font-size: 10px;
  border-radius: 999px;
  padding: 1px 7px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
  font-weight: 500;
}
.badge.mine {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.side-note {
  margin: 0;
  font-size: 10.5px;
  color: var(--rg-text-3);
  line-height: 1.6;
}
.main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--rg-border);
  border-radius: var(--rg-radius);
  padding: 16px;
  overflow-y: auto;
  background: var(--rg-surface);
}
.preview-head,
.editor-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.preview-head h3,
.editor-head h3 {
  margin: 0;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
.preview-head p,
.editor-head p {
  margin: 5px 0 0;
  font-size: 12px;
  color: var(--rg-text-2);
  line-height: 1.6;
}
.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.sync-message {
  margin: 10px 0 0;
  font-size: 11.5px;
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
  border: 1px solid var(--rg-ai-border);
  border-radius: 8px;
  padding: 6px 10px;
}
.prompt {
  margin-top: 14px;
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 10px 12px;
  background: var(--rg-surface-2);
}
.prompt strong {
  font-size: 12px;
  color: var(--rg-text-2);
}
.prompt pre {
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
.section-preview {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.section-card {
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 9px 11px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  flex-wrap: wrap;
}
.index {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--rg-fill);
  color: var(--rg-text-2);
  font-size: 10.5px;
  display: grid;
  place-items: center;
}
.kind,
.required {
  font-size: 10.5px;
  color: var(--rg-text-2);
  background: var(--rg-fill);
  border-radius: 999px;
  padding: 1px 7px;
}
.required.on {
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
}
.section-card p {
  margin: 5px 0 0;
  font-size: 11.5px;
  color: var(--rg-text-2);
  line-height: 1.6;
}
.section-card code,
.section-key code,
code {
  font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  font-size: 10.5px;
  color: var(--rg-code-text);
  background: var(--rg-code-bg);
  border: 1px solid var(--rg-code-border);
  border-radius: 4px;
  padding: 1px 5px;
}
.empty,
.empty-main {
  font-size: 12px;
  color: var(--rg-text-3);
  text-align: center;
  padding: 28px 0;
}
.form {
  display: grid;
  grid-template-columns: 1fr 140px 1fr;
  gap: 10px 12px;
  margin-top: 14px;
}
.form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11.5px;
  color: var(--rg-text-2);
  min-width: 0;
}
.form label.wide {
  grid-column: 1 / -1;
}
.sections-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18px;
  font-size: 12.5px;
}
.sections {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.section-row {
  border: 1px solid var(--rg-border);
  border-radius: 9px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.section-line {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.section-line .grow {
  flex: 1;
  min-width: 160px;
}
.w-70 {
  width: 70px;
}
.w-130 {
  width: 130px;
}
.w-200 {
  width: 200px;
}
.section-key {
  font-size: 10.5px;
  color: var(--rg-text-3);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.key-hint {
  font-size: 10px;
  color: var(--rg-text-3);
}
.editor-error {
  margin: 10px 0 0;
  border: 1px solid var(--rg-danger-border);
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 11.5px;
  line-height: 1.6;
}
@media (max-width: 820px) {
  .layout {
    flex-direction: column;
    height: auto;
    min-height: 0;
  }
  .side {
    width: auto;
  }
  .list {
    max-height: 168px;
  }
  .form {
    grid-template-columns: 1fr;
  }
}
</style>
