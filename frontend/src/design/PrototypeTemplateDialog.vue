<template>
  <el-dialog
    :model-value="modelValue"
    title="原型模板中心"
    width="min(1060px, calc(100vw - 32px))"
    top="5vh"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
    @open="load"
  >
    <div class="pt-layout">
      <aside class="pt-side">
        <div class="pt-toolbar">
          <el-input v-model="keyword" size="small" placeholder="搜索模板名称/描述" clearable />
          <el-button size="small" type="primary" plain @click="startCreate">新建模板</el-button>
        </div>
        <div class="pt-categories">
          <button type="button" :class="['pt-cat', { on: !category }]" @click="category = ''">全部</button>
          <button
            v-for="(label, value) in TEMPLATE_CATEGORY_LABELS"
            :key="value"
            type="button"
            :class="['pt-cat', { on: category === value }]"
            @click="category = value"
          >
            {{ label }}
          </button>
        </div>
        <div v-loading="loading" class="pt-list">
          <button
            v-for="item in filtered"
            :key="item.id"
            type="button"
            :class="['pt-item', { on: selected?.id === item.id }]"
            @click="select(item)"
          >
            <span class="pt-item-name">
              {{ item.name }}
              <span v-if="item.id === currentTemplateId" class="pt-badge current">使用中</span>
              <span v-if="item.builtin" class="pt-badge">内置</span>
              <span v-else class="pt-badge private">我的</span>
            </span>
            <span class="pt-item-meta">{{ TEMPLATE_CATEGORY_LABELS[item.category] }} · {{ item.pageSetRules.defaultPages.length }} 种页面</span>
            <span class="pt-item-desc">{{ item.description || '—' }}</span>
          </button>
          <p v-if="!filtered.length && !loading" class="pt-empty">没有匹配的模板</p>
        </div>
      </aside>

      <section class="pt-main">
        <template v-if="editor">
          <div class="pt-editor-head">
            <div>
              <h3>{{ editor.id ? '编辑原型模板' : '新建原型模板' }}</h3>
              <p>模板 = Token + App Shell + 页面模式 + 页面集规则 + 提示词；保存后作为“我的模板”。</p>
            </div>
            <div class="pt-actions">
              <el-button size="small" @click="editor = null">返回预览</el-button>
              <el-button size="small" type="primary" :loading="saving" @click="saveEditor">保存</el-button>
            </div>
          </div>

          <div class="pt-form">
            <label><span>名称</span><el-input v-model="editor.name" size="small" placeholder="模板名称" /></label>
            <label>
              <span>分类</span>
              <el-select v-model="editor.category" size="small">
                <el-option v-for="(label, value) in TEMPLATE_CATEGORY_LABELS" :key="value" :label="label" :value="value" />
              </el-select>
            </label>
            <label class="wide"><span>描述</span><el-input v-model="editor.description" size="small" placeholder="一句话说明适用场景" /></label>
            <label class="wide">
              <span>模板提示词（给 AI 的设计原则）</span>
              <el-input v-model="editor.prompt" type="textarea" :rows="4" />
            </label>
          </div>

          <div class="pt-block">
            <strong>设计 Token</strong>
            <div class="pt-grid">
              <label><span>主色</span><el-input v-model="editor.tokens.primary" size="small" /></label>
              <label><span>辅助色</span><el-input v-model="editor.tokens.accent" size="small" /></label>
              <label><span>中性色</span><el-input v-model="editor.tokens.neutral" size="small" /></label>
              <label><span>背景色</span><el-input v-model="editor.tokens.background" size="small" /></label>
              <label class="wide"><span>字体</span><el-input v-model="editor.tokens.font" size="small" /></label>
              <label><span>圆角 px</span><el-input-number v-model="editor.tokens.radius" size="small" :min="0" :max="24" /></label>
              <label><span>间距 px</span><el-input-number v-model="editor.tokens.spacing" size="small" :min="4" :max="32" /></label>
              <label>
                <span>密度</span>
                <el-select v-model="editor.tokens.density" size="small">
                  <el-option label="紧凑" value="compact" />
                  <el-option label="舒适" value="comfortable" />
                </el-select>
              </label>
            </div>
          </div>

          <div class="pt-block">
            <strong>App Shell</strong>
            <div class="pt-grid">
              <label>
                <span>外壳</span>
                <el-select v-model="editor.shell.type" size="small">
                  <el-option label="侧边栏" value="sidebar" />
                  <el-option label="顶栏" value="topbar" />
                </el-select>
              </label>
              <label><span>侧栏深色</span><el-switch v-model="editor.shell.sidebarDark" /></label>
              <label><span>内容宽度</span><el-input-number v-model="editor.shell.contentWidth" size="small" :min="720" :max="1920" /></label>
            </div>
          </div>

          <div class="pt-block">
            <strong>页面模式</strong>
            <div class="pt-grid">
              <label><span>列表筛选</span><el-switch v-model="editor.patterns.list.filters" /></label>
              <label><span>行操作</span><el-switch v-model="editor.patterns.list.rowActions" /></label>
              <label><span>分页</span><el-switch v-model="editor.patterns.list.pagination" /></label>
              <label><span>多选</span><el-switch v-model="editor.patterns.list.selection" /></label>
              <label>
                <span>表单形态</span>
                <el-select v-model="editor.patterns.form.presentation" size="small">
                  <el-option label="弹窗" value="dialog" />
                  <el-option label="独立页面" value="page" />
                </el-select>
              </label>
              <label>
                <span>标签位置</span>
                <el-select v-model="editor.patterns.form.labelPosition" size="small">
                  <el-option label="顶部" value="top" />
                  <el-option label="左侧" value="left" />
                </el-select>
              </label>
              <label><span>表单分组</span><el-switch v-model="editor.patterns.form.groups" /></label>
              <label><span>详情分区</span><el-switch v-model="editor.patterns.detail.sections" /></label>
            </div>
          </div>

          <div class="pt-block">
            <strong>页面集规则</strong>
            <div class="pt-grid">
              <label class="wide">
                <span>默认页面</span>
                <div class="pt-checks">
                  <el-checkbox
                    v-for="pageType in ALL_PAGE_TYPES"
                    :key="pageType"
                    :model-value="editor.pageSetRules.defaultPages.includes(pageType)"
                    @change="togglePageType(pageType)"
                  >
                    {{ PAGE_TYPE_LABELS[pageType] }}
                  </el-checkbox>
                </div>
              </label>
              <label class="wide">
                <span>表单页（创建/编辑分别生成页面）</span>
                <div class="pt-checks">
                  <el-checkbox
                    :model-value="editor.pageSetRules.formModes.includes('create')"
                    @change="toggleFormMode('create')"
                  >
                    创建表单
                  </el-checkbox>
                  <el-checkbox
                    :model-value="editor.pageSetRules.formModes.includes('edit')"
                    @change="toggleFormMode('edit')"
                  >
                    编辑表单
                  </el-checkbox>
                </div>
              </label>
              <label>
                <span>创建形态</span>
                <el-select v-model="editor.pageSetRules.createAs" size="small">
                  <el-option label="弹窗" value="dialog" />
                  <el-option label="独立页面" value="page" />
                </el-select>
              </label>
              <label>
                <span>编辑形态</span>
                <el-select v-model="editor.pageSetRules.editAs" size="small">
                  <el-option label="弹窗" value="dialog" />
                  <el-option label="独立页面" value="page" />
                </el-select>
              </label>
              <label><span>默认分页</span><el-input-number v-model="editor.pageSetRules.defaultPageSize" size="small" :min="5" :max="100" /></label>
              <label><span>默认查询字段</span><el-input-number v-model="editor.pageSetRules.defaultSearchFields" size="small" :min="0" :max="8" /></label>
            </div>
          </div>
        </template>

        <template v-else-if="selected">
          <div class="pt-preview-head">
            <div>
              <h3>
                {{ selected.name }}
                <span v-if="selected.builtin" class="pt-badge">内置只读</span>
                <span v-else class="pt-badge private">我的模板</span>
              </h3>
              <p>{{ selected.description || '—' }}</p>
              <div class="pt-meta-row">
                <span>{{ TEMPLATE_CATEGORY_LABELS[selected.category] }}</span>
                <span>{{ selected.shell.type === 'sidebar' ? '侧边栏' : '顶栏' }}</span>
                <span>{{ selected.pageSetRules.defaultPages.join(' / ') }}</span>
                <span>更新于 {{ formatTime(selected.updatedAt) }}</span>
              </div>
            </div>
            <div class="pt-actions">
              <el-button size="small" type="primary" :disabled="selected.id === currentTemplateId" @click="emit('use', selected)">
                {{ selected.id === currentTemplateId ? '使用中' : '使用此模板' }}
              </el-button>
              <el-button size="small" @click="duplicateSelected">复制并编辑</el-button>
              <el-button v-if="!selected.builtin" size="small" @click="startEdit(selected)">编辑</el-button>
              <el-button v-if="!selected.builtin" size="small" type="danger" plain @click="removeSelected">删除</el-button>
            </div>
          </div>

          <div class="pt-preview-grid">
            <div class="pt-preview-panel">
              <strong>设计 Token</strong>
              <div class="pt-token-row">
                <span class="pt-swatch" :style="{ background: selected.tokens.primary }" /> 主色 {{ selected.tokens.primary }}
              </div>
              <div class="pt-token-row">
                <span class="pt-swatch" :style="{ background: selected.tokens.accent }" /> 辅助 {{ selected.tokens.accent }}
              </div>
              <div class="pt-token-row">
                <span class="pt-swatch" :style="{ background: selected.tokens.background }" /> 背景 {{ selected.tokens.background }}
              </div>
              <div class="pt-token-row">圆角 {{ selected.tokens.radius }}px · 间距 {{ selected.tokens.spacing }}px · {{ selected.tokens.density === 'compact' ? '紧凑' : '舒适' }}</div>
            </div>
            <div class="pt-preview-panel">
              <strong>页面模式</strong>
              <div class="pt-token-row">列表：筛选 {{ selected.patterns.list.filters ? '✓' : '—' }} · 行操作 {{ selected.patterns.list.rowActions ? '✓' : '—' }} · 分页 {{ selected.patterns.list.pagination ? '✓' : '—' }}</div>
              <div class="pt-token-row">表单：{{ selected.patterns.form.presentation === 'dialog' ? '弹窗' : '独立页面' }} · 标签{{ selected.patterns.form.labelPosition === 'top' ? '顶部' : '左侧' }}</div>
              <div class="pt-token-row">详情：分区 {{ selected.patterns.detail.sections ? '✓' : '—' }}</div>
            </div>
          </div>

          <div class="pt-prompt">
            <strong>模板提示词</strong>
            <pre>{{ selected.prompt }}</pre>
          </div>
        </template>

        <div v-else class="pt-empty-main">选择左侧模板查看详情</div>
      </section>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createPrototypeTemplate,
  deletePrototypeTemplate,
  duplicatePrototypeTemplate,
  listPrototypeTemplates,
  updatePrototypeTemplate
} from './api'
import {
  PAGE_TYPE_LABELS,
  TEMPLATE_CATEGORY_LABELS,
  type PrototypePageType,
  type PrototypeTemplate
} from './types'

const props = defineProps<{ modelValue: boolean; currentTemplateId?: string }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; use: [PrototypeTemplate] }>()

const ALL_PAGE_TYPES: PrototypePageType[] = ['list', 'form', 'detail', 'dashboard', 'kanban', 'gantt', 'calendar']

const templates = ref<PrototypeTemplate[]>([])
const keyword = ref('')
const category = ref('')
const selected = ref<PrototypeTemplate | null>(null)
const loading = ref(false)
const saving = ref(false)
const editor = ref<(PrototypeTemplate & { id: string }) | null>(null)

const filtered = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  return templates.value.filter(item => {
    if (category.value && item.category !== category.value) return false
    if (!key) return true
    return `${item.name}${item.description}${item.category}`.toLowerCase().includes(key)
  })
})

function formatTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

async function load(): Promise<void> {
  loading.value = true
  try {
    templates.value = await listPrototypeTemplates()
    if (!selected.value || !templates.value.some(item => item.id === selected.value?.id)) {
      selected.value = templates.value.find(item => item.id === props.currentTemplateId) ?? templates.value[0] ?? null
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    loading.value = false
  }
}

function select(item: PrototypeTemplate): void {
  selected.value = item
  editor.value = null
}

function blankTemplate(): PrototypeTemplate {
  return {
    id: '',
    name: '我的原型模板',
    category: 'custom',
    description: '',
    tokens: {
      primary: '#2563eb',
      accent: '#0f766e',
      neutral: '#475569',
      background: '#f8fafc',
      font: "-apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif",
      radius: 6,
      spacing: 12,
      density: 'compact'
    },
    shell: { type: 'sidebar', sidebarDark: true, contentWidth: 1280 },
    patterns: {
      list: { filters: true, rowActions: true, pagination: true, selection: false },
      form: { presentation: 'dialog', labelPosition: 'top', groups: true },
      detail: { sections: true, relatedLists: false }
    },
    pageSetRules: { defaultPages: ['list', 'form', 'detail'], formModes: ['create', 'edit'], createAs: 'dialog', editAs: 'dialog', defaultPageSize: 10, defaultSearchFields: 3 },
    prompt: '你是设计阶段的页面原型助手，请根据需求生成列表、表单、详情页面规格。',
    builtin: false,
    visibility: 'private',
    createdAt: '',
    updatedAt: ''
  }
}

function startCreate(): void {
  editor.value = { ...blankTemplate() }
}

function startEdit(item: PrototypeTemplate): void {
  editor.value = JSON.parse(JSON.stringify(item)) as PrototypeTemplate & { id: string }
}

function togglePageType(pageType: PrototypePageType): void {
  if (!editor.value) return
  const list = editor.value.pageSetRules.defaultPages
  const index = list.indexOf(pageType)
  if (index >= 0) list.splice(index, 1)
  else list.push(pageType)
  if (!list.length) list.push('list')
}

function toggleFormMode(mode: 'create' | 'edit'): void {
  if (!editor.value) return
  const list = editor.value.pageSetRules.formModes
  const index = list.indexOf(mode)
  if (index >= 0) list.splice(index, 1)
  else list.push(mode)
  if (!list.length) list.push('create', 'edit')
}

async function saveEditor(): Promise<void> {
  if (!editor.value) return
  saving.value = true
  try {
    const input = { ...editor.value }
    const saved = editor.value.id
      ? await updatePrototypeTemplate(editor.value.id, input)
      : await createPrototypeTemplate(input)
    editor.value = null
    await load()
    selected.value = templates.value.find(item => item.id === saved.id) ?? saved
    ElMessage.success('模板已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  } finally {
    saving.value = false
  }
}

async function duplicateSelected(): Promise<void> {
  if (!selected.value) return
  try {
    const copy = await duplicatePrototypeTemplate(selected.value.id)
    await load()
    selected.value = templates.value.find(item => item.id === copy.id) ?? copy
    startEdit(selected.value)
    ElMessage.success('已复制为新模板')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}

async function removeSelected(): Promise<void> {
  if (!selected.value) return
  try {
    await ElMessageBox.confirm(`删除模板「${selected.value.name}」？`, '删除模板', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  try {
    await deletePrototypeTemplate(selected.value.id)
    selected.value = null
    await load()
    ElMessage.success('模板已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}
</script>

<style scoped>
.pt-layout {
  display: flex;
  gap: 14px;
  /* 与全局 .el-dialog flex/body 滚动配合：不超出视口内可用高度 */
  height: min(72vh, calc(100vh - 210px));
  min-height: 400px;
  color: var(--rg-text);
}
.pt-side {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--rg-border);
  padding-right: 10px;
  min-height: 0;
}
.pt-toolbar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.pt-toolbar :deep(.el-input) {
  flex: 1;
  min-width: 140px;
}
.pt-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 0;
}
.pt-cat {
  border: 1px solid var(--rg-border);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 11px;
  cursor: pointer;
}
.pt-cat:hover {
  border-color: var(--rg-border-strong);
  color: var(--rg-text);
}
.pt-cat.on {
  background: var(--rg-ink);
  border-color: var(--rg-ink);
  color: var(--rg-ink-contrast);
}
.pt-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.pt-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 8px;
  padding: 8px 9px;
  cursor: pointer;
  margin-bottom: 4px;
}
.pt-item:hover {
  background: var(--rg-hover);
}
.pt-item.on {
  background: var(--rg-ai-soft);
  border-color: var(--rg-ai-border);
}
.pt-item-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--rg-text);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.pt-item-meta,
.pt-item-desc {
  font-size: 10.5px;
  color: var(--rg-text-3);
  line-height: 1.4;
}
.pt-badge {
  font-size: 9.5px;
  font-weight: 400;
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
  margin-left: 4px;
}
.pt-badge.current {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.pt-badge.private {
  background: var(--rg-ai-soft);
  color: var(--rg-ai);
}
.pt-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-right: 4px;
}
.pt-editor-head,
.pt-preview-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.pt-editor-head h3,
.pt-preview-head h3 {
  margin: 0 0 4px;
  font-size: 15px;
  color: var(--rg-text);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.pt-editor-head p,
.pt-preview-head p {
  margin: 0;
  font-size: 11.5px;
  color: var(--rg-text-3);
}
.pt-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.pt-form,
.pt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
  margin-top: 12px;
}
.pt-form label,
.pt-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--rg-text-2);
  min-width: 0;
}
.pt-form .wide,
.pt-grid .wide {
  grid-column: 1 / -1;
}
.pt-block {
  margin-top: 14px;
  border-top: 1px solid var(--rg-border);
  padding-top: 10px;
}
.pt-block strong {
  font-size: 12.5px;
  color: var(--rg-text-2);
}
.pt-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.pt-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--rg-text-3);
}
.pt-preview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 14px;
}
.pt-preview-panel {
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--rg-surface-2);
  min-width: 0;
}
.pt-preview-panel strong {
  color: var(--rg-text);
}
.pt-token-row {
  font-size: 11.5px;
  color: var(--rg-text-2);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.pt-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid var(--rg-border-strong);
  display: inline-block;
  flex-shrink: 0;
}
.pt-prompt {
  margin-top: 14px;
  border: 1px solid var(--rg-border);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--rg-surface-2);
}
.pt-prompt strong {
  color: var(--rg-text-2);
}
.pt-prompt pre {
  margin: 8px 0 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 11.5px;
  color: var(--rg-code-text);
  background: var(--rg-code-bg);
  border: 1px solid var(--rg-code-border);
  border-radius: 7px;
  padding: 8px 10px;
  line-height: 1.7;
  overflow-x: auto;
}
.pt-empty,
.pt-empty-main {
  padding: 24px 8px;
  color: var(--rg-text-3);
  font-size: 12px;
}
.pt-empty-main {
  display: grid;
  place-items: center;
  min-height: 300px;
}

@media (max-width: 900px) {
  .pt-layout {
    flex-direction: column;
    height: auto;
    min-height: 0;
  }
  .pt-side {
    width: auto;
    border-right: none;
    border-bottom: 1px solid var(--rg-border);
    padding-right: 0;
    padding-bottom: 8px;
  }
  .pt-list {
    max-height: 160px;
  }
  .pt-main {
    flex: 1;
    min-height: 240px;
    overflow-y: visible;
    padding-right: 0;
  }
  .pt-form,
  .pt-grid,
  .pt-preview-grid {
    grid-template-columns: 1fr;
  }
  .pt-actions {
    justify-content: flex-start;
  }
}
</style>
