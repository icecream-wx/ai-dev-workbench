/**
 * 内置页面原型模板（D3）
 *
 * 与需求模板同思路：全局库 + 应用只保存 template id；内置只读，复制后可编辑。
 * 首批两套：企业级专业管理（默认）、简洁后台。移动端后续。
 */
import type { PrototypeTemplate } from './types'

const ENTERPRISE_PROMPT = `你是企业级后台系统的 UI 设计师，负责把需求转成可开发的页面原型与页面规格。
原则：
- 采用深色侧栏 + 白色内容区的经典管理后台结构；
- 列表页突出筛选区、紧凑表格、行操作、分页；
- 表单默认使用弹窗（创建/编辑），字段按业务分组，标签在输入框上方；
- 详情页用描述列表分区展示，突出关键字段；
- 主色沿用企业蓝，信息密度偏高，适合数据密集型业务。`

const MINIMAL_PROMPT = `你是简洁现代的后台系统设计师，负责把需求转成轻量的页面原型与页面规格。
原则：
- 浅色侧栏、留白充足、轻边框，不使用重装饰；
- 列表页保留必要筛选、简洁表格与分页；
- 表单使用独立页面，字段按业务分组，标签在左侧；
- 详情页用紧凑描述列表，优先展示主信息；
- 适合中小型业务系统与内部工具。`

export const BUILTIN_PROTOTYPE_TEMPLATES: PrototypeTemplate[] = [
  {
    id: 'builtin-prototype-enterprise',
    name: '企业级专业管理',
    category: 'enterprise',
    description: '深色侧栏、白色内容、紧凑表格、蓝色主色；默认后台管理系统模板。',
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
      list: { filters: true, rowActions: true, pagination: true, selection: true },
      form: { presentation: 'dialog', labelPosition: 'top', groups: true },
      detail: { sections: true, relatedLists: true }
    },
    pageSetRules: {
      defaultPages: ['list', 'form', 'detail'],
      formModes: ['create', 'edit'],
      createAs: 'dialog',
      editAs: 'dialog',
      defaultPageSize: 10,
      defaultSearchFields: 3
    },
    prompt: ENTERPRISE_PROMPT,
    builtin: true,
    visibility: 'builtin',
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'builtin-prototype-minimal',
    name: '简洁后台',
    category: 'minimal',
    description: '浅色侧栏、留白多、轻边框；适合中小型业务系统。',
    tokens: {
      primary: '#0f172a',
      accent: '#0d9488',
      neutral: '#64748b',
      background: '#ffffff',
      font: "-apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif",
      radius: 10,
      spacing: 18,
      density: 'comfortable'
    },
    shell: { type: 'sidebar', sidebarDark: false, contentWidth: 1180 },
    patterns: {
      list: { filters: true, rowActions: true, pagination: true, selection: false },
      form: { presentation: 'page', labelPosition: 'left', groups: true },
      detail: { sections: true, relatedLists: false }
    },
    pageSetRules: {
      defaultPages: ['list', 'form', 'detail'],
      formModes: ['create', 'edit'],
      createAs: 'page',
      editAs: 'page',
      defaultPageSize: 8,
      defaultSearchFields: 2
    },
    prompt: MINIMAL_PROMPT,
    builtin: true,
    visibility: 'builtin',
    createdAt: '',
    updatedAt: ''
  }
]

export const DEFAULT_PROTOTYPE_TEMPLATE_ID = 'builtin-prototype-enterprise'

export const PROTOTYPE_TEMPLATE_CATEGORIES = ['enterprise', 'minimal', 'mobile', 'custom'] as const
