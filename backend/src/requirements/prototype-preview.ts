/**
 * 需求阶段只读原型预览（M7 / #8）
 *
 * 定位：把设计阶段“Epic → 页面集、Story → 页面”的产物**提前**到需求阶段做粗略预览。
 * 因此本模块**完全确定性、只读**：
 * - 不创建/更新设计项目、实体、页面集、页面、设计版本；
 * - 不写需求文档/版本、不懒创建模块（禁止 `ensureRequirementDoc` / `resolveModule`）；
 * - 不产 PNG/文件、不调模型/SSE；每次请求现算。
 *
 * 派生规则见 `docs/plans/2026-11-17-m7-requirements-prototype-preview-design.md` §2：
 * - Epic 顺序 = 文档 `epics` 章节 data.epics 顺序；Story 顺序 = data.stories 顺序；
 * - 过滤 `archived`；每个 Epic → 一个页面集，每个 Story → 一个页面（类型按标题关键词推断）；
 * - 未归属（epicId 为空/指向不存在或已归档 Epic）的 Story → 末尾虚拟页面集 `epicId:null`；
 * - 预览期合成键 `pv:<moduleKey>:<epicId|storyId|unassigned>`，不写入任何表、不占用 ID 空间。
 */
import { nowIso } from '../db'
import { appPrototypeTemplate, type PrototypeTemplateSource } from '../apps/template-resolution'
import type {
  PrototypePatterns,
  PrototypePageSetRules,
  PrototypeShell,
  PrototypeTemplateCategory,
  PrototypeTokens
} from '../design/types'
import { readRequirementDocIfExists } from './doc'
import { appRowOrThrow, defaultModule, moduleOrThrow, type ModuleRow } from './modules'
import type { RequirementDocStatus, RequirementEpic, RequirementOutlineData, RequirementStory } from './types'

export type PrototypePreviewPageType =
  | 'list'
  | 'form'
  | 'detail'
  | 'dashboard'
  | 'kanban'
  | 'calendar'
  | 'gantt'
  | 'custom'

export interface PrototypePreviewPage {
  /** 预览期合成键：`pv:<moduleKey>:<storyId>`（不写库） */
  key: string
  storyId: string
  title: string
  type: PrototypePreviewPageType
  priority: string
  /** Story description 去换行后截断 160 字（前端只作 tooltip） */
  summary: string
}

export interface PrototypePreviewPageSet {
  /** 预览期合成键：`pv:<moduleKey>:<epicId|unassigned>`（不写库） */
  key: string
  /** 未归属 Story 的虚拟页面集为 null */
  epicId: string | null
  title: string
  goal: string
  priority: string
  pages: PrototypePreviewPage[]
}

export type PrototypePreviewWarningCode =
  | 'no-module'
  | 'no-epics'
  | 'epic-without-story'
  | 'story-without-title'
  | 'unassigned-stories'

export interface PrototypePreviewWarning {
  code: PrototypePreviewWarningCode
  message: string
  epicId?: string
  storyId?: string
}

export interface PrototypePreviewModule {
  id: string
  /** 模块 key（MOD-001…）；预览合成键使用它 */
  key: string
  title: string
  archived: boolean
  hasDoc: boolean
  docVersion: number
  docStatus: RequirementDocStatus
  docUpdatedAt: string | null
}

/** 只返回渲染所需字段（不含 prompt / builtin / 时间戳等） */
export interface PrototypePreviewTemplate {
  id: string
  name: string
  category: PrototypeTemplateCategory
  source: PrototypeTemplateSource
  tokens: PrototypeTokens
  shell: PrototypeShell
  patterns: PrototypePatterns
  pageSetRules: PrototypePageSetRules
}

export interface PrototypePreviewStats {
  epics: number
  stories: number
  pages: number
  unmappedStories: number
}

export interface RequirementPrototypePreview {
  appId: string
  generatedAt: string
  module: PrototypePreviewModule | null
  template: PrototypePreviewTemplate | null
  pageSets: PrototypePreviewPageSet[]
  stats: PrototypePreviewStats
  warnings: PrototypePreviewWarning[]
}

/** 关键词表：按顺序首个命中（顺序即优先级；无命中兜底 list） */
const PAGE_TYPE_KEYWORDS: Array<{ type: PrototypePreviewPageType; keywords: string[] }> = [
  { type: 'dashboard', keywords: ['报表', '统计', '概览', '大盘', '分析', '指标'] },
  { type: 'kanban', keywords: ['看板', '泳道', '卡片墙', '拖拽'] },
  { type: 'calendar', keywords: ['日历', '排期', '日程'] },
  { type: 'gantt', keywords: ['甘特', '进度计划', '里程碑'] },
  { type: 'form', keywords: ['新增', '创建', '编辑', '录入', '提交', '维护', '配置', '设置', '导入'] },
  { type: 'detail', keywords: ['详情', '查看', '查阅', '回看', '预览'] },
  { type: 'list', keywords: ['查询', '列表', '检索', '筛选', '搜索', '管理', '台账'] }
]

const UNASSIGNED_TITLE = '未归属 Story'
const SUMMARY_LIMIT = 160

/** 只看 Story 标题，按设计稿 §2.3 表顺序首个命中；空标题兜底 list */
export function inferPreviewPageType(title: string): PrototypePreviewPageType {
  const text = typeof title === 'string' ? title.trim() : ''
  if (!text) return 'list'
  for (const rule of PAGE_TYPE_KEYWORDS) {
    if (rule.keywords.some(keyword => text.includes(keyword))) return rule.type
  }
  return 'list'
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** description → 单行 + 截断 160 字（超出加省略号，供 tooltip） */
function summaryOf(description: unknown): string {
  const text = asString(description).replace(/\s+/g, ' ').trim()
  if (text.length <= SUMMARY_LIMIT) return text
  return `${text.slice(0, SUMMARY_LIMIT)}…`
}

function pageOf(moduleKey: string, story: RequirementStory): PrototypePreviewPage {
  const title = asString(story.title)
  return {
    key: `pv:${moduleKey}:${story.id}`,
    storyId: story.id,
    title,
    type: inferPreviewPageType(title),
    priority: asString(story.priority),
    summary: summaryOf(story.description)
  }
}

function outlineOf(sections: Array<{ sectionKey: string; data?: RequirementOutlineData }>): RequirementOutlineData {
  const epicsSection = sections.find(section => section.sectionKey === 'epics')
  return epicsSection?.data ?? { scenes: [], epics: [], stories: [] }
}

function activeEpics(data: RequirementOutlineData): RequirementEpic[] {
  return (Array.isArray(data.epics) ? data.epics : []).filter(epic => !epic.archived)
}

function activeStories(data: RequirementOutlineData): RequirementStory[] {
  return (Array.isArray(data.stories) ? data.stories : []).filter(story => !story.archived)
}

function moduleView(module: ModuleRow, doc: ReturnType<typeof readRequirementDocIfExists>['doc']): PrototypePreviewModule {
  return {
    id: module.id,
    key: module.module_key,
    title: module.title,
    archived: Boolean(module.archived_at),
    hasDoc: Boolean(doc),
    docVersion: doc?.version ?? 0,
    docStatus: doc?.status ?? 'draft',
    docUpdatedAt: doc?.updatedAt ?? null
  }
}

/**
 * 构建只读原型预览（确定性；每次调用现算）。
 *
 * 模块解析：显式 moduleId → `moduleOrThrow`（未知 404、已归档允许只读）；
 * 缺省 → `defaultModule`（**不懒创建**）；应用无未归档模块 → `module:null` + `no-module`。
 */
export function buildRequirementPrototypePreview(appId: string, moduleId?: string): RequirementPrototypePreview {
  appRowOrThrow(appId)
  const explicit = typeof moduleId === 'string' ? moduleId.trim() : ''
  const module = explicit ? moduleOrThrow(appId, explicit) : defaultModule(appId)
  const generatedAt = nowIso()

  if (!module) {
    return {
      appId,
      generatedAt,
      module: null,
      template: null,
      pageSets: [],
      stats: { epics: 0, stories: 0, pages: 0, unmappedStories: 0 },
      warnings: [{ code: 'no-module', message: '应用还没有未归档的需求模块' }]
    }
  }

  const read = readRequirementDocIfExists(appId, module.id)
  const resolved = appPrototypeTemplate(appId, module.id)
  const template: PrototypePreviewTemplate = {
    id: resolved.template.id,
    name: resolved.template.name,
    category: resolved.template.category,
    source: resolved.source,
    tokens: resolved.template.tokens,
    shell: resolved.template.shell,
    patterns: resolved.template.patterns,
    pageSetRules: resolved.template.pageSetRules
  }

  const moduleKey = module.module_key
  const warnings: PrototypePreviewWarning[] = []
  const data = outlineOf(read.sections)
  const epics = activeEpics(data)
  const stories = activeStories(data)
  const epicIds = new Set(epics.map(epic => epic.id))
  const pageSets: PrototypePreviewPageSet[] = []

  if (!read.doc) warnings.push({ code: 'no-epics', message: '该模块还没有需求文档，无法预览页面集' })
  else if (!epics.length) warnings.push({ code: 'no-epics', message: '该模块还没有 Epic，无法预览页面集' })

  for (const epic of epics) {
    const pages = stories.filter(story => story.epicId === epic.id).map(story => pageOf(moduleKey, story))
    pageSets.push({
      key: `pv:${moduleKey}:${epic.id}`,
      epicId: epic.id,
      title: asString(epic.title),
      goal: asString(epic.goal),
      priority: asString(epic.priority),
      pages
    })
    if (!pages.length) {
      warnings.push({
        code: 'epic-without-story',
        message: `${epic.id}「${asString(epic.title)}」还没有 Story`,
        epicId: epic.id
      })
    }
  }

  const unassigned = stories.filter(story => !story.epicId || !epicIds.has(story.epicId))
  if (unassigned.length) {
    pageSets.push({
      key: `pv:${moduleKey}:unassigned`,
      epicId: null,
      title: UNASSIGNED_TITLE,
      goal: '',
      priority: '',
      pages: unassigned.map(story => pageOf(moduleKey, story))
    })
    warnings.push({
      code: 'unassigned-stories',
      message: `${unassigned.length} 个 Story 未归属到 Epic，已放入「${UNASSIGNED_TITLE}」`
    })
  }

  for (const story of stories) {
    if (asString(story.title).trim()) continue
    warnings.push({
      code: 'story-without-title',
      message: `${story.id} 标题为空，已按「列表」类型预览`,
      storyId: story.id
    })
  }

  return {
    appId,
    generatedAt,
    module: moduleView(module, read.doc),
    template,
    pageSets,
    stats: {
      epics: epics.length,
      stories: stories.length,
      pages: stories.length,
      unmappedStories: unassigned.length
    },
    warnings
  }
}
