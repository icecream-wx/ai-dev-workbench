<template>
  <nav class="otree" aria-label="需求大纲">
    <header class="otree-head">
      <div class="otree-title">需求大纲</div>
      <div class="otree-sub">
        {{ modules.length }} 个模块
        <template v-if="completion.required"> · 当前模块 {{ completion.completed }}/{{ completion.required }} 必填</template>
      </div>
    </header>

    <div class="otree-scroll">
      <div v-if="!modules.length" class="otree-empty">
        还没有需求模块；确认需求前会按应用模板创建默认模块。
      </div>

      <div
        v-for="(module, index) in modules"
        :key="module.id"
        :class="['otree-module', { current: module.id === selectedModuleId }]"
        :data-module-id="module.id"
        data-testid="outline-module"
      >
        <div class="otree-module-row">
          <button
            type="button"
            class="otree-module-main"
            :aria-expanded="expandedModuleId === module.id"
            :aria-current="module.id === selectedModuleId ? 'true' : undefined"
            :title="moduleOutlineTooltip(module)"
            :data-testid="`outline-module-toggle-${module.id}`"
            @click="emit('toggle', module.id)"
          >
            <span class="otree-chevron" aria-hidden="true">{{ expandedModuleId === module.id ? '▾' : '▸' }}</span>
            <span class="otree-key">{{ module.moduleKey }}</span>
            <strong class="otree-module-title">{{ module.title }}</strong>
            <span v-for="chip in rowOf(module).chips" :key="chip" :class="['otree-chip', chip === '本次变更' ? 'scope' : 'req']">
              {{ chip }}
            </span>
          </button>
          <button
            type="button"
            class="otree-menu-btn"
            title="模块操作"
            aria-label="模块操作"
            aria-haspopup="menu"
            :aria-expanded="menu.open && menu.moduleId === module.id"
            :data-testid="`outline-module-menu-${module.id}`"
            @click="openMenu($event, module, false)"
          >
            ⋯
          </button>
        </div>
        <div class="otree-meta">
          <span :class="['otree-status', rowOf(module).statusClass]">{{ rowOf(module).statusLabel }}</span>
          <span class="otree-version">{{ rowOf(module).versionLabel }}</span>
          <span v-if="rowOf(module).ownerLabel" class="otree-owner" :title="rowOf(module).ownerLabel">
            {{ rowOf(module).ownerLabel }}
          </span>
          <span v-if="module.id === selectedModuleId && completion.required" class="otree-complete">
            {{ completion.completed }}/{{ completion.required }} 必填
          </span>
        </div>

        <ul v-if="expandedModuleId === module.id" class="otree-sections">
          <li v-for="(section, sectionIndex) in sections" :key="section.sectionKey">
            <button
              type="button"
              :class="[
                'otree-section',
                {
                  active: section.sectionKey === activeSectionKey,
                  focus: section.sectionKey === focusSectionKey,
                  missing: section.required && !section.markdown.trim()
                }
              ]"
              :aria-current="section.sectionKey === activeSectionKey ? 'true' : undefined"
              :data-section-key="section.sectionKey"
              data-testid="outline-section"
              @click="emit('jump', module.id, section.sectionKey)"
            >
              <span class="otree-section-index">{{ sectionIndex + 1 }}</span>
              <span class="otree-section-name">{{ section.title }}</span>
              <span v-if="section.required" class="otree-section-req">必填</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              :class="['otree-section', 'otree-prototype', { active: module.id === prototypeModuleId }]"
              :aria-current="module.id === prototypeModuleId ? 'true' : undefined"
              :data-testid="`outline-prototype-${module.id}`"
              title="按需求文档由 AI 生成参考原型（实体/字段/页面；只用于需求评审）"
              @click="emit('prototype', module.id)"
            >
              <span class="otree-section-index" aria-hidden="true">◇</span>
              <span class="otree-section-name">原型预览</span>
              <span class="otree-prototype-tag">AI</span>
            </button>
          </li>
        </ul>
      </div>

      <div class="otree-add">
        <button
          type="button"
          class="otree-add-btn"
          :disabled="!gate.allowed"
          :title="gate.hint || '新增需求模块'"
          data-testid="outline-add-module"
          @click="emit('create')"
        >
          + 新增模块
        </button>
        <p v-if="!gate.allowed" class="otree-gate-hint">{{ gate.hint }}</p>
      </div>

      <div v-if="archivedModules.length" class="otree-archived">
        <button
          type="button"
          class="otree-archived-toggle"
          :aria-expanded="archivedOpen"
          data-testid="outline-archived-toggle"
          @click="archivedOpen = !archivedOpen"
        >
          <span>已归档 {{ archivedModules.length }}</span>
          <span aria-hidden="true">{{ archivedOpen ? '▾' : '▸' }}</span>
        </button>
        <div v-if="archivedOpen" class="otree-archived-list" data-testid="outline-archived-list">
          <div
            v-for="module in archivedModules"
            :key="module.id"
            :class="['otree-module', 'archived', { current: module.id === selectedModuleId }]"
            :data-module-id="module.id"
            data-testid="outline-archived-module"
          >
            <div class="otree-module-row">
              <button
                type="button"
                class="otree-module-main"
                :aria-expanded="expandedModuleId === module.id"
                :aria-current="module.id === selectedModuleId ? 'true' : undefined"
                :title="moduleOutlineTooltip(module)"
                @click="emit('toggle', module.id)"
              >
                <span class="otree-chevron" aria-hidden="true">{{ expandedModuleId === module.id ? '▾' : '▸' }}</span>
                <span class="otree-key">{{ module.moduleKey }}</span>
                <strong class="otree-module-title">{{ module.title }}</strong>
              </button>
              <button
                type="button"
                class="otree-menu-btn"
                title="模块操作"
                aria-label="模块操作"
                aria-haspopup="menu"
                :aria-expanded="menu.open && menu.moduleId === module.id"
                :data-testid="`outline-archived-menu-${module.id}`"
                @click="openMenu($event, module, true)"
              >
                ⋯
              </button>
            </div>
            <div class="otree-meta">
              <span class="otree-status archived">已归档</span>
              <span class="otree-version">{{ moduleVersionLabel(module) }}</span>
              <span v-if="module.ownerLabel" class="otree-owner" :title="module.ownerLabel">{{ module.ownerLabel }}</span>
            </div>

            <ul v-if="expandedModuleId === module.id" class="otree-sections">
              <li v-for="(section, sectionIndex) in sections" :key="section.sectionKey">
                <button
                  type="button"
                  :class="[
                    'otree-section',
                    {
                      active: section.sectionKey === activeSectionKey,
                      focus: section.sectionKey === focusSectionKey,
                      missing: section.required && !section.markdown.trim()
                    }
                  ]"
                  :aria-current="section.sectionKey === activeSectionKey ? 'true' : undefined"
                  :data-section-key="section.sectionKey"
                  data-testid="outline-section"
                  @click="emit('jump', module.id, section.sectionKey)"
                >
                  <span class="otree-section-index">{{ sectionIndex + 1 }}</span>
                  <span class="otree-section-name">{{ section.title }}</span>
                  <span v-if="section.required" class="otree-section-req">必填</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  :class="['otree-section', 'otree-prototype', { active: module.id === prototypeModuleId }]"
                  :aria-current="module.id === prototypeModuleId ? 'true' : undefined"
                  :data-testid="`outline-prototype-${module.id}`"
                  title="按需求文档由 AI 生成参考原型（实体/字段/页面；只用于需求评审）"
                  @click="emit('prototype', module.id)"
                >
                  <span class="otree-section-index" aria-hidden="true">◇</span>
                  <span class="otree-section-name">原型预览</span>
                  <span class="otree-prototype-tag">AI</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <p class="otree-tip">点击模块切换；点章节定位。模块标题悬停可看描述。</p>
    </div>

    <Teleport to="body">
      <div
        v-if="menu.open"
        ref="menuRef"
        class="otree-menu"
        role="menu"
        :style="{ left: `${menu.left}px`, top: `${menu.top}px` }"
        data-testid="outline-module-menu"
        @keydown.esc.stop.prevent="closeMenu()"
      >
        <template v-if="!menu.archived">
          <button
            type="button"
            role="menuitem"
            class="otree-menu-item"
            :disabled="!canMutate"
            :title="canMutate ? '编辑模块信息' : '当前阶段只读，不能编辑模块信息'"
            data-testid="outline-menu-edit"
            @click="chooseAction('edit')"
          >
            编辑信息
          </button>
          <button
            type="button"
            role="menuitem"
            class="otree-menu-item"
            :disabled="!canMutate || moveUpDisabled"
            :title="moveUpTitle"
            data-testid="outline-menu-up"
            @click="chooseAction('up')"
          >
            上移
          </button>
          <button
            type="button"
            role="menuitem"
            class="otree-menu-item"
            :disabled="!canMutate || moveDownDisabled"
            :title="moveDownTitle"
            data-testid="outline-menu-down"
            @click="chooseAction('down')"
          >
            下移
          </button>
          <div class="otree-menu-sep" />
          <button
            type="button"
            role="menuitem"
            class="otree-menu-item danger"
            :disabled="Boolean(archiveReason)"
            :title="archiveReason || '归档模块（文档/版本保留，只读）'"
            data-testid="outline-menu-archive"
            @click="chooseAction('archive')"
          >
            归档
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            role="menuitem"
            class="otree-menu-item"
            :disabled="!canMutate"
            :title="canMutate ? '恢复归档模块' : '当前阶段只读，不能恢复模块'"
            data-testid="outline-menu-restore"
            @click="chooseAction('restore')"
          >
            恢复模块
          </button>
        </template>
      </div>
    </Teleport>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { RequirementDocSection, RequirementModule } from './api'
import {
  createModuleGate,
  moduleOutlineRow,
  moduleOutlineTooltip,
  moduleVersionLabel,
  outlineCompletion
} from './module-helpers.js'

const props = defineProps<{
  /** 未归档模块（按 position 顺序） */
  modules: RequirementModule[]
  archivedModules: RequirementModule[]
  selectedModuleId: string
  /** 手风琴：当前展开的模块 id（最多一个；空 = 全部收起） */
  expandedModuleId: string
  sections: RequirementDocSection[]
  activeSectionKey: string
  focusSectionKey: string
  appStatus: string
  /** 应用非需求阶段整页只读：禁用新增/编辑/排序/归档/恢复 */
  canMutate: boolean
  /** M5：本次变更包含的模块 id（显示“本次变更”标记） */
  changeScopeIds?: string[]
  /** M5：变更进行中禁止归档（范围已固定） */
  archiveBlocked?: boolean
  /** M7：当前正在预览的模块 id（大纲高亮该模块的「原型预览」节点） */
  prototypeModuleId?: string | null
}>()

const emit = defineEmits<{
  toggle: [string]
  jump: [string, string]
  create: []
  edit: [RequirementModule]
  move: [string, number]
  archive: [RequirementModule]
  restore: [RequirementModule]
  prototype: [string]
}>()

const archivedOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

// 当前模块被归档时自动展开“已归档”组，避免切到归档模块后大纲里看不到它
watch(
  () => props.selectedModuleId,
  id => {
    if (id && props.archivedModules.some(module => module.id === id)) archivedOpen.value = true
  },
  { immediate: true }
)
const menu = reactive({ open: false, moduleId: '', archived: false, left: 0, top: 0 })
let menuTrigger: HTMLElement | null = null

const completion = computed(() => outlineCompletion(props.sections))

const gate = computed(() => {
  const status = createModuleGate(props.appStatus)
  if (!props.canMutate) return { allowed: false, hint: status.hint || '当前为只读状态' }
  return status
})

const menuModule = computed(() => {
  const all = [...props.modules, ...props.archivedModules]
  return all.find(module => module.id === menu.moduleId) ?? null
})
const menuIndex = computed(() => props.modules.findIndex(module => module.id === menu.moduleId))
const moveUpDisabled = computed(() => menuIndex.value <= 0)
const moveDownDisabled = computed(
  () => menuIndex.value < 0 || menuIndex.value >= props.modules.length - 1
)
const moveUpTitle = computed(() =>
  !props.canMutate ? '当前阶段只读，不能调整模块顺序' : moveUpDisabled.value ? '已经是第一个模块' : '上移模块'
)
const moveDownTitle = computed(() =>
  !props.canMutate ? '当前阶段只读，不能调整模块顺序' : moveDownDisabled.value ? '已经是最后一个模块' : '下移模块'
)
const archiveReason = computed(() => {
  if (!props.canMutate) return '当前阶段只读，不能归档模块'
  if (props.archiveBlocked) return '变更进行中不能归档模块；请先完成或取消变更'
  if (props.modules.length <= 1) return '至少保留 1 个未归档模块'
  return ''
})

function rowOf(module: RequirementModule) {
  return moduleOutlineRow(module, {
    current: module.id === props.selectedModuleId,
    inChangeScope: Boolean(props.changeScopeIds?.includes(module.id))
  })
}

function openMenu(event: MouseEvent, module: RequirementModule, archived: boolean): void {
  event.stopPropagation()
  const trigger = event.currentTarget as HTMLElement
  if (menu.open && menu.moduleId === module.id) {
    closeMenu()
    return
  }
  menuTrigger = trigger
  const rect = trigger.getBoundingClientRect()
  const width = 168
  const height = archived ? 56 : 178
  const left = Math.min(Math.max(8, rect.right - width), Math.max(8, window.innerWidth - width - 8))
  const top = rect.bottom + 4 + height > window.innerHeight - 8
    ? Math.max(8, rect.top - height - 4)
    : rect.bottom + 4
  menu.left = left
  menu.top = top
  menu.moduleId = module.id
  menu.archived = archived
  menu.open = true
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onDocumentKeydown, true)
  void nextTick(() => {
    menuRef.value?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
  })
}

function closeMenu(refocus = true): void {
  const trigger = menuTrigger
  menu.open = false
  menu.moduleId = ''
  menu.archived = false
  menuTrigger = null
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown, true)
  if (refocus) trigger?.focus()
}

function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target as Node | null
  if (target && menuRef.value?.contains(target)) return
  if (target && menuTrigger?.contains(target)) return
  // 点击外部关闭：焦点先回到触发按钮；若点到其它可聚焦元素，浏览器随后把焦点交给它
  closeMenu(true)
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  closeMenu()
}

function chooseAction(action: 'edit' | 'up' | 'down' | 'archive' | 'restore'): void {
  const module = menuModule.value
  if (!module) {
    closeMenu(false)
    return
  }
  closeMenu(false)
  if (action === 'edit') emit('edit', module)
  else if (action === 'up') emit('move', module.id, -1)
  else if (action === 'down') emit('move', module.id, 1)
  else if (action === 'archive') emit('archive', module)
  else emit('restore', module)
}

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown, true)
})
</script>

<style scoped>
.otree {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  color: var(--rg-text);
}
.otree-head {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 10px 6px;
}
.otree-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--rg-text-2);
}
.otree-sub {
  font-size: 10px;
  color: var(--rg-text-3);
  line-height: 1.5;
}
.otree-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 8px 10px;
}
.otree-empty {
  margin: 6px 2px 10px;
  font-size: 10.5px;
  color: var(--rg-text-3);
  line-height: 1.6;
}
.otree-module {
  border: 1px solid transparent;
  border-radius: 9px;
  margin-bottom: 4px;
  background: transparent;
  min-width: 0;
}
.otree-module:hover {
  border-color: var(--rg-border);
}
.otree-module.current {
  border-color: var(--rg-ai-border);
  background: var(--rg-ai-soft);
}
.otree-module.archived {
  opacity: 0.92;
}
.otree-module-row {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.otree-module-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 6px;
  text-align: left;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.otree-module-main:hover {
  background: var(--rg-hover);
}
.otree-module.current .otree-module-main:hover {
  background: var(--rg-ai-soft);
}
.otree-chevron {
  width: 10px;
  flex-shrink: 0;
  font-size: 10px;
  color: var(--rg-text-3);
  line-height: 1;
}
.otree-key {
  flex-shrink: 0;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 9.5px;
  color: var(--rg-text-3);
}
.otree-module-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--rg-text);
}
.otree-chip {
  flex-shrink: 0;
  font-size: 9px;
  border-radius: 999px;
  padding: 0 5px;
  line-height: 14px;
}
.otree-chip.req {
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
}
.otree-chip.scope {
  color: var(--rg-ai);
  background: var(--rg-fill);
}
.otree-menu-btn {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--rg-text-3);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s;
}
.otree-module:hover .otree-menu-btn,
.otree-module.current .otree-menu-btn,
.otree-menu-btn:focus-visible,
.otree-menu-btn[aria-expanded='true'] {
  opacity: 1;
}
.otree-menu-btn:hover {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.otree-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
  padding: 0 8px 5px 21px;
  font-size: 10px;
  color: var(--rg-text-3);
}
.otree-status {
  border-radius: 999px;
  padding: 0 6px;
  background: var(--rg-fill);
  color: var(--rg-text-2);
  flex-shrink: 0;
}
.otree-status.confirmed {
  background: var(--rg-ok-soft);
  color: var(--rg-ok);
}
.otree-status.review {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.otree-status.archived {
  background: var(--rg-fill-2);
  color: var(--rg-text-3);
}
.otree-version {
  flex-shrink: 0;
}
.otree-owner {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.otree-complete {
  flex-shrink: 0;
  color: var(--rg-text-2);
}
.otree-sections {
  list-style: none;
  margin: 2px 4px 6px 9px;
  padding: 2px 0 2px 7px;
  border-left: 1px solid var(--rg-border);
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.otree-section {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  min-width: 0;
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 3px 6px;
  text-align: left;
  font-size: 11.5px;
  color: var(--rg-text-2);
  cursor: pointer;
}
.otree-section:hover {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.otree-section.active {
  background: var(--rg-surface);
  color: var(--rg-ai);
  font-weight: 600;
  box-shadow: inset 2px 0 0 var(--rg-ai);
}
.otree-section.focus {
  box-shadow: inset 0 0 0 1px var(--rg-ai-border);
}
.otree-section.active.focus {
  box-shadow: inset 2px 0 0 var(--rg-ai), inset 0 0 0 1px var(--rg-ai-border);
}
.otree-section-index {
  width: 15px;
  flex-shrink: 0;
  text-align: right;
  font-size: 10px;
  color: var(--rg-text-3);
}
.otree-section-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.otree-section.missing .otree-section-name {
  color: var(--rg-warn);
}
.otree-section.active .otree-section-name {
  color: var(--rg-ai);
}
.otree-section-req {
  flex-shrink: 0;
  font-size: 9px;
  color: var(--rg-warn);
  background: var(--rg-warn-soft);
  border-radius: 999px;
  padding: 0 5px;
}
.otree-prototype .otree-section-index {
  color: var(--rg-ai);
}
.otree-prototype-tag {
  flex-shrink: 0;
  font-size: 9px;
  color: var(--rg-text-3);
  background: var(--rg-fill-2);
  border-radius: 999px;
  padding: 0 5px;
}
.otree-prototype.active .otree-prototype-tag {
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
}
.otree-add {
  padding: 6px 2px 2px;
}
.otree-add-btn {
  width: 100%;
  min-height: 28px;
  border: 1px dashed var(--rg-border-strong);
  background: var(--rg-surface);
  color: var(--rg-text-2);
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
}
.otree-add-btn:hover:not(:disabled) {
  border-color: var(--rg-ai-border);
  color: var(--rg-ai);
  background: var(--rg-ai-soft);
}
.otree-add-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.otree-gate-hint {
  margin: 5px 2px 0;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--rg-warn);
}
.otree-archived {
  border-top: 1px solid var(--rg-border);
  margin-top: 6px;
  padding-top: 6px;
}
.otree-archived-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: none;
  background: transparent;
  color: var(--rg-text-3);
  font-size: 10.5px;
  padding: 3px 4px;
  cursor: pointer;
}
.otree-archived-toggle:hover {
  color: var(--rg-text-2);
}
.otree-archived-list {
  margin-top: 3px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.otree-tip {
  margin: 10px 2px 0;
  font-size: 10.5px;
  color: var(--rg-text-3);
  line-height: 1.6;
}
.otree-menu {
  position: fixed;
  z-index: 3000;
  width: 168px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px;
  border: 1px solid var(--rg-border-strong);
  border-radius: 9px;
  background: var(--rg-surface);
  box-shadow: var(--rg-shadow-2);
}
.otree-menu-item {
  text-align: left;
  border: none;
  background: transparent;
  color: var(--rg-text-2);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
}
.otree-menu-item:hover:not(:disabled) {
  background: var(--rg-hover);
  color: var(--rg-text);
}
.otree-menu-item.danger:hover:not(:disabled) {
  background: var(--rg-danger-soft);
  color: var(--rg-danger);
}
.otree-menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.otree-menu-sep {
  height: 1px;
  background: var(--rg-border);
  margin: 3px 2px;
}
@media (max-width: 1024px) {
  .otree-menu-btn {
    opacity: 1;
  }
}
@media (max-width: 768px) {
  .otree-add-btn {
    min-height: 32px;
  }
}
</style>
