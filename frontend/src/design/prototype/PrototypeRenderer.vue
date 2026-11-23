<template>
  <div ref="pageRef" :class="['wf-page', { 'wf-mobile': mobile }]" data-wf-anchor="page" @dblclick.capture="onAnnotateDblclick">
    <span v-if="!mobile" class="wf-stamp">原型预览</span>
    <!-- 手机壳：钉钉/微信式导航栏 + 内容 + 底部标签栏 -->
    <template v-if="mobile">
      <div class="wf-m-nav" data-wf-anchor="header">
        <button v-if="page.type !== 'list'" class="wf-m-back" type="button" @click="emit('nav', 'back')">‹</button>
        <span class="wf-m-title">{{ page.title }}</span>
        <span class="wf-m-nav-actions">
          <span v-for="action in headerActions" :key="action" class="wf-m-nav-action" @click="emit('notify', action)">{{ action }}</span>
        </span>
      </div>
      <div class="wf-m-body">
        <WireframeBlocks v-if="topBlocks.length" :entries="topBlocks" :entity="entity" :rows="rows" :mobile="mobile" :module-id="moduleId" @notify="(a: string) => emit('notify', a)" />
        <WireframeForm v-if="page.type === 'form'" :page="page" :entity="entity" :layout="layout" :mobile="mobile" :rows="rows" :module-id="moduleId" :entities="entities" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
        <WireframeTable v-else-if="page.type === 'list'" :page="page" :entity="entity" :layout="layout" :rows="rows" :mobile="true" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
        <WireframeDetail v-else-if="page.type === 'detail'" :page="page" :entity="entity" :layout="layout" :row="rows[0]" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
        <WireframeDashboard v-else-if="page.type === 'dashboard'" :entity="entity" :layout="layout" :rows="rows" />
        <WireframeKanban v-else-if="page.type === 'kanban'" :page="page" :entity="entity" :layout="layout" :rows="rows" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
        <WireframeGantt v-else-if="page.type === 'gantt'" :page="page" :entity="entity" :layout="layout" :rows="rows" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
        <WireframeCalendar v-else-if="page.type === 'calendar'" :page="page" :entity="entity" :layout="layout" :rows="rows" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
        <template v-else-if="page.type === 'custom'">
          <WireframeBlocks v-if="customEntries.length" :entries="customEntries" :entity="entity" :rows="rows" :mobile="mobile" :module-id="moduleId" @notify="(a: string) => emit('notify', a)" />
          <div v-else class="wf-custom-page">
            <div class="wf-custom-badge">自定义页面 · 需 .vue 定制开发</div>
            <div class="wf-custom-title">{{ page.title }}</div>
            <ul class="wf-custom-list">
              <li v-for="(ac, i) in page.acceptanceCriteria ?? []" :key="i">{{ ac }}</li>
              <li v-if="!(page.acceptanceCriteria ?? []).length" class="ghost">暂无验收标准，请在页面编辑中补充</li>
            </ul>
          </div>
        </template>
        <div v-else class="wf-empty">暂不支持渲染该页面类型：{{ page.type }}</div>
        <WireframeBlocks v-if="bottomBlocks.length" :entries="bottomBlocks" :entity="entity" :rows="rows" :mobile="mobile" :module-id="moduleId" @notify="(a: string) => emit('notify', a)" />
      </div>
      <div class="wf-m-tabbar">
        <div
          v-for="tab in mobileTabs"
          :key="tab.id"
          :class="['wf-m-tab', { on: tab.id === page.id }]"
          @click="emit('nav-page', tab.id)"
        >
          <span class="wf-m-tab-icon" />
          <span class="wf-m-tab-label">{{ tab.title }}</span>
        </div>
      </div>
    </template>

    <!-- 桌面 / 平板：沿用桌面线框结构 -->
    <template v-else>
      <div class="wf-header" data-wf-anchor="header">
        <button v-if="page.type !== 'list'" class="wf-header-back" type="button" @click="emit('nav', 'back')">‹ 返回</button>
        <span class="wf-header-title">{{ page.title }}</span>
        <div class="wf-header-actions">
          <span v-for="action in headerActions" :key="action" class="wf-btn" @click="emit('notify', action)">{{ actionLabel(action) }}</span>
        </div>
      </div>
      <WireframeBlocks v-if="topBlocks.length" :entries="topBlocks" :entity="entity" :rows="rows" :module-id="moduleId" @notify="(a: string) => emit('notify', a)" />
      <WireframeForm v-if="page.type === 'form'" :page="page" :entity="entity" :layout="layout" :mobile="mobile" :rows="rows" :module-id="moduleId" :entities="entities" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
      <WireframeTable v-else-if="page.type === 'list'" :page="page" :entity="entity" :layout="layout" :rows="rows" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
      <WireframeDetail v-else-if="page.type === 'detail'" :page="page" :entity="entity" :layout="layout" :row="rows[0]" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
      <WireframeDashboard v-else-if="page.type === 'dashboard'" :entity="entity" :layout="layout" :rows="rows" />
      <WireframeKanban v-else-if="page.type === 'kanban'" :page="page" :entity="entity" :layout="layout" :rows="rows" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
      <WireframeGantt v-else-if="page.type === 'gantt'" :page="page" :entity="entity" :layout="layout" :rows="rows" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
      <WireframeCalendar v-else-if="page.type === 'calendar'" :page="page" :entity="entity" :layout="layout" :rows="rows" @nav="(kind, i) => emit('nav', kind, i)" @notify="(a: string) => emit('notify', a)" />
      <template v-else-if="page.type === 'custom'">
        <WireframeBlocks v-if="customEntries.length" :entries="customEntries" :entity="entity" :rows="rows" :module-id="moduleId" @notify="(a: string) => emit('notify', a)" />
        <div v-else class="wf-custom">
          <div class="wf-custom-badge">自定义页面 · 需 .vue 定制开发</div>
          <div class="wf-custom-title">{{ page.title }}</div>
          <ul class="wf-custom-list">
            <li v-for="(ac, i) in page.acceptanceCriteria ?? []" :key="i">{{ ac }}</li>
            <li v-if="!(page.acceptanceCriteria ?? []).length" class="ghost">暂无验收标准，请在页面编辑中补充</li>
          </ul>
          <div v-if="page.entity" class="wf-custom-entity">数据来源：{{ entity?.name || page.entity }}</div>
        </div>
      </template>
      <div v-else class="wf-empty">暂不支持渲染该页面类型：{{ page.type }}</div>
      <WireframeBlocks v-if="bottomBlocks.length" :entries="bottomBlocks" :entity="entity" :rows="rows" :module-id="moduleId" @notify="(a: string) => emit('notify', a)" />
    </template>

    <!-- 批注钉标层：编号钉标按锚点元素定位 -->
    <div class="wf-note-layer">
      <span
        v-for="pin in pins"
        :key="pin.note.id"
        :class="['wf-note-pin', { resolved: pin.note.resolved }]"
        :style="{ left: `${pin.x}px`, top: `${pin.y}px` }"
        :title="pin.note.text"
        @click.stop="openNote(pin.note)"
      >{{ pin.note.resolved ? '✓' : pin.seq }}</span>
    </div>

    <!-- 批注气泡：新建 / 编辑 / 查看（Teleport 到 body + fixed 置顶，避免被画布滚动裁剪或层叠遮挡） -->
    <Teleport to="body">
      <div
        v-if="notePop"
        class="wf-note-pop"
        :style="{ left: `${notePop.x}px`, top: `${notePop.y}px` }"
        @click.stop
      >
        <div class="wf-note-pop-head">
          <span class="wf-note-pop-title">{{ notePop.mode === 'view' ? '需求批注' : notePop.mode === 'create' ? '新增批注' : '编辑批注' }}</span>
          <span class="wf-note-pop-anchor">{{ anchorLabel(notePop.anchor, entity) }}</span>
        </div>
        <div v-if="notePop.mode === 'view'" class="wf-note-pop-text">{{ notePop.text }}</div>
        <div v-if="notePop.mode === 'view'" class="wf-note-pop-meta">{{ notePop.createdAt }}<template v-if="notePop.resolved"> · 已标记解决</template></div>
        <textarea
          v-if="notePop.mode !== 'view'"
          v-model="notePop.text"
          class="wf-note-input"
          rows="3"
          placeholder="输入针对该区域的需求描述，如：支持批量导入"
        />
        <div class="wf-note-pop-actions">
          <template v-if="notePop.mode === 'view'">
            <template v-if="!readonly">
              <button class="wf-btn" type="button" @click="toggleResolved">{{ notePop.resolved ? '取消解决' : '标记解决' }}</button>
              <button class="wf-btn" type="button" @click="startEdit">编辑</button>
              <button class="wf-btn danger" type="button" @click="removeNote">删除</button>
            </template>
            <button class="wf-btn" type="button" @click="closePop">关闭</button>
          </template>
          <template v-else>
            <button class="wf-btn" type="button" @click="closePop">取消</button>
            <button class="wf-btn wf-btn-primary" type="button" :disabled="!notePop.text.trim()" @click="saveNote">保存</button>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import './wireframe.css'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { MockRow } from './mock'
import type { PageAnnotation, PageLayout, SpecEntity, SpecPage } from './spec-types'
import { actionLabel, anchorLabel, blockEntriesOf } from './layout'
import WireframeForm from './WireframeForm.vue'
import WireframeTable from './WireframeTable.vue'
import WireframeDetail from './WireframeDetail.vue'
import WireframeDashboard from './WireframeDashboard.vue'
import WireframeKanban from './WireframeKanban.vue'
import WireframeGantt from './WireframeGantt.vue'
import WireframeCalendar from './WireframeCalendar.vue'
import WireframeBlocks from './WireframeBlocks.vue'

const props = defineProps<{
  page: SpecPage
  entity: SpecEntity | undefined
  layout: PageLayout | undefined
  rows: MockRow[]
  /** 当前页批注 */
  notes: PageAnnotation[]
  /** 需要定位高亮的批注 id（来自侧栏列表） */
  highlightNoteId?: string
  mobile?: boolean
  /** 全部页面（手机底部标签栏） */
  pages?: SpecPage[]
  /** 当前模块 id（子表格跨模块关系解析） */
  moduleId?: string
  /** 当前模块全部实体（设计视图解析子表目标；可选） */
  entities?: SpecEntity[]
  /** 只读模式（文档就地预览抽屉）：禁用双击批注与批注编辑动作，钉标点击仍可查看内容 */
  readonly?: boolean
}>()

const emit = defineEmits<{
  nav: [kind: 'create' | 'detail' | 'back', rowIndex?: number]
  notify: [action: string]
  'nav-page': [pageId: string]
  'add-note': [anchor: string, text: string]
  'update-note': [noteId: string, patch: { text?: string; resolved?: boolean }]
  'delete-note': [noteId: string]
}>()

// 手机底部标签栏：取前 4 个页面
const mobileTabs = computed(() => (props.pages ?? []).slice(0, 4))

// ---- 自由区块（PageLayout.blocks）：内置页面 top/bottom 包裹主体；custom 页 blocks 按序渲染为主体 ----
const topBlocks = computed(() => (props.page.type === 'custom' ? [] : blockEntriesOf(props.layout, 'top')))
const bottomBlocks = computed(() => (props.page.type === 'custom' ? [] : blockEntriesOf(props.layout, 'bottom')))
const customEntries = computed(() => (props.page.type === 'custom' ? blockEntriesOf(props.layout) : []))

// 页头动作：form/detail 无页头动作；list 页动作由表格工具栏承载（避免重复）；其余视图页头放非增删改动作
const headerActions = computed(() => {
  if (props.page.type === 'form' || props.page.type === 'detail' || props.page.type === 'list') return []
  return (props.page.actions ?? []).filter(a => !['create', 'edit', 'delete', 'detail', 'submit', 'cancel', 'view'].includes(a))
})

// ---- 批注 ----
const pageRef = ref<HTMLElement | null>(null)

interface NotePop {
  mode: 'create' | 'edit' | 'view'
  anchor: string
  noteId?: string
  /** 视口坐标（气泡 Teleport 到 body，position: fixed） */
  x: number
  y: number
  text: string
  createdAt?: string
  resolved?: boolean
}

const notePop = ref<NotePop | null>(null)
const pinPos = reactive<Record<string, { x: number; y: number }>>({})

/** 双击元素：锚定最近的可批注元素，弹出批注气泡（无需切换模式，随时可用） */
function onAnnotateDblclick(e: MouseEvent): void {
  if (props.readonly) return
  const target = e.target as HTMLElement
  // 钉标与批注气泡自身的点击始终放行（无论气泡是否已打开）
  if (target.closest('.wf-note-pop') || target.closest('.wf-note-pin')) return
  const anchorEl = target.closest('[data-wf-anchor]') as HTMLElement | null
  e.preventDefault()
  e.stopPropagation()
  if (!anchorEl) {
    closePop()
    return
  }
  const anchor = anchorEl.getAttribute('data-wf-anchor') ?? ''
  // 气泡挂在 body（fixed）：直接用点击点视口坐标，先大致就位，后续 positionPop 会贴齐锚点
  const x = clamp(e.clientX - 132, 8, window.innerWidth - 272)
  const y = clamp(e.clientY + 14, 8, window.innerHeight - 200)
  notePop.value = { mode: 'create', anchor, x, y, text: '' }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), Math.max(min, max))
}

function openNote(note: PageAnnotation): void {
  notePop.value = { mode: 'view', anchor: note.anchor, noteId: note.id, x: 0, y: 0, text: note.text, createdAt: note.createdAt, resolved: note.resolved }
  positionPop()
}

/** 气泡置顶后的定位：按钉标/锚点的视口坐标放置，贴右翻转、上下限位，保证完整可见 */
function positionPop(): void {
  const pop = notePop.value
  const pageEl = pageRef.value
  if (!pop || !pageEl) return
  const pageRect = pageEl.getBoundingClientRect()
  let ax: number
  let ay: number
  if (pop.noteId) {
    const pos = pinPos[pop.noteId]
    if (!pos) return
    ax = pageRect.left + pos.x
    ay = pageRect.top + pos.y
  } else {
    const anchorEl = pop.anchor === 'page' ? pageEl : (pageEl.querySelector(`[data-wf-anchor="${CSS.escape(pop.anchor)}"]`) as HTMLElement | null)
    if (!anchorEl) return
    const r = anchorEl.getBoundingClientRect()
    ax = r.right
    ay = r.top + (pop.anchor === 'page' ? 40 : 0)
  }
  const POP_W = 276
  const POP_H = 320
  pop.x = clamp(ax + 14 + POP_W > window.innerWidth - 8 ? ax - POP_W - 14 : ax + 14, 8, window.innerWidth - POP_W - 8)
  pop.y = clamp(ay - 10, 8, window.innerHeight - POP_H - 8)
}

function startEdit(): void {
  if (!notePop.value || !notePop.value.noteId) return
  notePop.value = { ...notePop.value, mode: 'edit' }
}

function toggleResolved(): void {
  const pop = notePop.value
  if (!pop || !pop.noteId) return
  emit('update-note', pop.noteId, { resolved: !pop.resolved })
  pop.resolved = !pop.resolved
}

function removeNote(): void {
  const pop = notePop.value
  if (!pop || !pop.noteId) return
  emit('delete-note', pop.noteId)
  closePop()
}

function saveNote(): void {
  const pop = notePop.value
  if (!pop || !pop.text.trim()) return
  if (pop.mode === 'create') emit('add-note', pop.anchor, pop.text.trim())
  else if (pop.mode === 'edit' && pop.noteId) emit('update-note', pop.noteId, { text: pop.text.trim() })
  closePop()
}

function closePop(): void {
  notePop.value = null
}

function onDocClick(e: MouseEvent): void {
  if (!notePop.value) return
  const t = e.target as HTMLElement
  if (t.closest('.wf-note-pop') || t.closest('.wf-note-pin')) return
  closePop()
}

function onPopKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closePop()
}

// 钉标定位：跟随锚点元素（内容/布局/宽度变化时重算）
const pins = computed(() => {
  return props.notes.map((note, i) => ({
    note,
    seq: i + 1,
    x: pinPos[note.id]?.x ?? -999,
    y: pinPos[note.id]?.y ?? -999
  }))
})

function layoutPins(): void {
  const pageEl = pageRef.value
  if (!pageEl) return
  const pageRect = pageEl.getBoundingClientRect()
  for (const note of props.notes) {
    const sameAnchor = props.notes.filter(n => n.anchor === note.anchor)
    const stack = sameAnchor.indexOf(note)
    // 页面整体批注：钉标固定在纸面右上角（桌面避开「原型预览」角标，手机避开顶部导航栏）
    if (note.anchor === 'page') {
      pinPos[note.id] = { x: Math.max(pageRect.width - 26, 26), y: (props.mobile ? 52 : 40) - stack * 16 }
      continue
    }
    const anchorEl = pageEl.querySelector(`[data-wf-anchor="${CSS.escape(note.anchor)}"]`) as HTMLElement | null
    if (!anchorEl) continue
    const rect = anchorEl.getBoundingClientRect()
    pinPos[note.id] = {
      x: Math.min(Math.max(rect.right - pageRect.left, 14), pageRect.width - 14),
      y: Math.max(rect.top - pageRect.top - 4, 6) - stack * 16
    }
  }
  // 气泡已打开时跟随钉标/锚点（画布滚动、布局变化都会走到这里）
  positionPop()
}

let resizeObserver: ResizeObserver | undefined
let scrollRaf = 0

function onScrollCapture(): void {
  // 表格/看板等内部滚动会改变锚点元素视口位置，钉标需跟随
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    layoutPins()
  })
}

onMounted(() => {
  document.addEventListener('scroll', onScrollCapture, true)
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onPopKeydown)
  if (pageRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => layoutPins())
    resizeObserver.observe(pageRef.value)
  }
  nextTick(layoutPins)
})

onUnmounted(() => {
  document.removeEventListener('scroll', onScrollCapture, true)
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onPopKeydown)
  resizeObserver?.disconnect()
})

watch([() => props.notes, () => props.page, () => props.rows, () => props.layout, () => props.mobile], () => nextTick(layoutPins), { deep: true })

// 侧栏定位：滚动到锚点元素并短暂高亮
let flashTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => props.highlightNoteId,
  id => {
    if (!id) return
    const note = props.notes.find(n => n.id === id)
    const isPage = note?.anchor === 'page'
    const el = isPage ? pageRef.value : (note && pageRef.value?.querySelector(`[data-wf-anchor="${CSS.escape(note.anchor)}"]`)) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ block: isPage ? 'nearest' : 'center', behavior: 'smooth' })
    if (!isPage) {
      el.classList.remove('wf-anchor-flash')
      void el.offsetWidth
      el.classList.add('wf-anchor-flash')
      clearTimeout(flashTimer)
      flashTimer = setTimeout(() => el.classList.remove('wf-anchor-flash'), 1800)
    }
    layoutPins()
  }
)
</script>
<!-- Modified by AI on 2026-10-20 14:39:20 -->
