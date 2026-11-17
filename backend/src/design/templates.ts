/** 页面原型模板服务（D3）：seed、列表、只读内置、复制/编辑/删除我的模板 */
import { db, nowIso } from '../db'
import { BUILTIN_PROTOTYPE_TEMPLATES, DEFAULT_PROTOTYPE_TEMPLATE_ID, PROTOTYPE_TEMPLATE_CATEGORIES } from './builtin-templates'
import { DesignError } from './errors'
import type {
  PrototypeDensity,
  PrototypePageMode,
  PrototypePageSetRules,
  PrototypePageType,
  PrototypePatterns,
  PrototypeShell,
  PrototypeShellType,
  PrototypeTemplate,
  PrototypeTemplateCategory,
  PrototypeTokens
} from './types'

interface TemplateRow {
  id: string
  name: string
  category: string
  description: string | null
  tokens_json: string
  shell_json: string
  patterns_json: string
  page_set_rules_json: string
  prompt: string
  builtin: number
  visibility: string
  preview_path: string | null
  created_at: string
  updated_at: string
}

const PAGE_TYPES: PrototypePageType[] = ['list', 'form', 'detail', 'dashboard', 'kanban', 'gantt', 'calendar']
const PAGE_MODES: PrototypePageMode[] = ['dialog', 'page']

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (value === true || value === 1 || value === 'true') return true
  if (value === false || value === 0 || value === 'false') return false
  return fallback
}

function asCategory(value: unknown): PrototypeTemplateCategory {
  return typeof value === 'string' && (PROTOTYPE_TEMPLATE_CATEGORIES as readonly string[]).includes(value)
    ? (value as PrototypeTemplateCategory)
    : 'custom'
}

export function normalizeTokens(raw: unknown): PrototypeTokens {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const density: PrototypeDensity = input.density === 'comfortable' ? 'comfortable' : 'compact'
  return {
    primary: asString(input.primary) || '#2563eb',
    accent: asString(input.accent) || '#0f766e',
    neutral: asString(input.neutral) || '#475569',
    background: asString(input.background) || '#f8fafc',
    font: asString(input.font) || "-apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif",
    radius: Math.min(Math.max(asNumber(input.radius, 6), 0), 24),
    spacing: Math.min(Math.max(asNumber(input.spacing, 12), 4), 32),
    density
  }
}

export function normalizeShell(raw: unknown): PrototypeShell {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const type: PrototypeShellType = input.type === 'topbar' ? 'topbar' : 'sidebar'
  const contentWidth = asNumber(input.contentWidth, 0)
  return {
    type,
    sidebarDark: asBoolean(input.sidebarDark, type === 'sidebar'),
    ...(contentWidth > 0 ? { contentWidth: Math.min(Math.max(contentWidth, 720), 1920) } : {})
  }
}

export function normalizePatterns(raw: unknown): PrototypePatterns {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const list = input.list && typeof input.list === 'object' ? (input.list as Record<string, unknown>) : {}
  const form = input.form && typeof input.form === 'object' ? (input.form as Record<string, unknown>) : {}
  const detail = input.detail && typeof input.detail === 'object' ? (input.detail as Record<string, unknown>) : {}
  return {
    list: {
      filters: asBoolean(list.filters, true),
      rowActions: asBoolean(list.rowActions, true),
      pagination: asBoolean(list.pagination, true),
      selection: asBoolean(list.selection, false)
    },
    form: {
      presentation: form.presentation === 'page' ? 'page' : 'dialog',
      labelPosition: form.labelPosition === 'left' ? 'left' : 'top',
      groups: asBoolean(form.groups, true)
    },
    detail: { sections: asBoolean(detail.sections, true), relatedLists: asBoolean(detail.relatedLists, false) }
  }
}

export function normalizePageSetRules(raw: unknown): PrototypePageSetRules {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const rawPages = Array.isArray(input.defaultPages) ? input.defaultPages : []
  const defaultPages = rawPages.filter((item): item is PrototypePageType => typeof item === 'string' && (PAGE_TYPES as string[]).includes(item))
  const rawFormModes = Array.isArray(input.formModes) ? input.formModes : []
  const formModes = rawFormModes.filter((item): item is 'create' | 'edit' => item === 'create' || item === 'edit')
  return {
    defaultPages: defaultPages.length ? Array.from(new Set(defaultPages)) : ['list', 'form', 'detail'],
    formModes: formModes.length ? Array.from(new Set(formModes)) : ['create', 'edit'],
    createAs: PAGE_MODES.includes(input.createAs as PrototypePageMode) ? (input.createAs as PrototypePageMode) : 'dialog',
    editAs: PAGE_MODES.includes(input.editAs as PrototypePageMode) ? (input.editAs as PrototypePageMode) : 'dialog',
    defaultPageSize: Math.min(Math.max(asNumber(input.defaultPageSize, 10), 5), 100),
    defaultSearchFields: Math.min(Math.max(asNumber(input.defaultSearchFields, 3), 0), 8)
  }
}

function rowToTemplate(row: TemplateRow): PrototypeTemplate {
  return {
    id: row.id,
    name: row.name,
    category: asCategory(row.category),
    description: row.description ?? '',
    tokens: normalizeTokens(parseJson(row.tokens_json)),
    shell: normalizeShell(parseJson(row.shell_json)),
    patterns: normalizePatterns(parseJson(row.patterns_json)),
    pageSetRules: normalizePageSetRules(parseJson(row.page_set_rules_json)),
    prompt: row.prompt,
    builtin: row.builtin === 1,
    visibility: row.visibility === 'builtin' ? 'builtin' : 'private',
    ...(row.preview_path ? { previewPath: row.preview_path } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** 启动时 seed 内置模板；存在则更新结构（内置只读，不覆盖我的模板） */
export function seedBuiltinPrototypeTemplates(): void {
  const now = nowIso()
  const upsert = db.prepare(`
    INSERT INTO prototype_templates
      (id, name, category, description, tokens_json, shell_json, patterns_json, page_set_rules_json,
       prompt, builtin, visibility, preview_path, created_at, updated_at)
    VALUES (@id, @name, @category, @description, @tokens_json, @shell_json, @patterns_json, @page_set_rules_json,
       @prompt, 1, 'builtin', NULL, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      description = excluded.description,
      tokens_json = excluded.tokens_json,
      shell_json = excluded.shell_json,
      patterns_json = excluded.patterns_json,
      page_set_rules_json = excluded.page_set_rules_json,
      prompt = excluded.prompt,
      builtin = 1,
      visibility = 'builtin',
      updated_at = excluded.updated_at
  `)
  const tx = db.transaction(() => {
    for (const template of BUILTIN_PROTOTYPE_TEMPLATES) {
      upsert.run({
        id: template.id,
        name: template.name,
        category: template.category,
        description: template.description,
        tokens_json: JSON.stringify(template.tokens),
        shell_json: JSON.stringify(template.shell),
        patterns_json: JSON.stringify(template.patterns),
        page_set_rules_json: JSON.stringify(template.pageSetRules),
        prompt: template.prompt,
        created_at: template.createdAt || now,
        updated_at: now
      })
    }
  })
  tx()
}

seedBuiltinPrototypeTemplates()

export function listPrototypeTemplates(query: { category?: unknown; q?: unknown; visibility?: unknown } = {}): PrototypeTemplate[] {
  const clauses: string[] = []
  const values: unknown[] = []
  if (typeof query.category === 'string' && query.category.trim()) {
    clauses.push('category = ?')
    values.push(query.category.trim())
  }
  if (query.visibility === 'builtin' || query.visibility === 'private') {
    clauses.push('visibility = ?')
    values.push(query.visibility)
  }
  const keyword = typeof query.q === 'string' ? query.q.trim() : ''
  if (keyword) {
    clauses.push('(name LIKE ? OR description LIKE ? OR category LIKE ?)')
    const like = `%${keyword}%`
    values.push(like, like, like)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db
    .prepare(`SELECT * FROM prototype_templates ${where} ORDER BY builtin DESC, category ASC, created_at ASC`)
    .all(...values) as TemplateRow[]
  return rows.map(rowToTemplate)
}

export function getPrototypeTemplateOrThrow(id: string): PrototypeTemplate {
  const row = db.prepare('SELECT * FROM prototype_templates WHERE id = ?').get(id) as TemplateRow | undefined
  if (!row) throw new DesignError(404, `原型模板不存在：${id}`)
  return rowToTemplate(row)
}

export function defaultPrototypeTemplate(): PrototypeTemplate {
  const row = db.prepare('SELECT * FROM prototype_templates WHERE id = ?').get(DEFAULT_PROTOTYPE_TEMPLATE_ID) as TemplateRow | undefined
  if (row) return rowToTemplate(row)
  const first = db
    .prepare("SELECT * FROM prototype_templates WHERE visibility = 'builtin' ORDER BY created_at ASC LIMIT 1")
    .get() as TemplateRow | undefined
  if (!first) throw new DesignError(500, '缺少内置原型模板，请重启工作台以完成 seed')
  return rowToTemplate(first)
}

interface TemplateInput {
  name: string
  category: PrototypeTemplateCategory
  description: string
  tokens: PrototypeTokens
  shell: PrototypeShell
  patterns: PrototypePatterns
  pageSetRules: PrototypePageSetRules
  prompt: string
}

function normalizeTemplateInput(body: Record<string, unknown>): TemplateInput {
  const name = asString(body.name)
  if (!name) throw new DesignError(400, '模板名称不能为空')
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) throw new DesignError(400, '模板提示词不能为空')
  return {
    name,
    category: asCategory(body.category),
    description: asString(body.description),
    tokens: normalizeTokens(body.tokens),
    shell: normalizeShell(body.shell),
    patterns: normalizePatterns(body.patterns),
    pageSetRules: normalizePageSetRules(body.pageSetRules),
    prompt
  }
}

function newTemplateId(): string {
  return `proto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createPrototypeTemplate(body: Record<string, unknown>): PrototypeTemplate {
  const input = normalizeTemplateInput(body)
  const id = newTemplateId()
  const now = nowIso()
  db.prepare(`
    INSERT INTO prototype_templates
      (id, name, category, description, tokens_json, shell_json, patterns_json, page_set_rules_json,
       prompt, builtin, visibility, preview_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'private', NULL, ?, ?)
  `).run(
    id,
    input.name,
    input.category,
    input.description,
    JSON.stringify(input.tokens),
    JSON.stringify(input.shell),
    JSON.stringify(input.patterns),
    JSON.stringify(input.pageSetRules),
    input.prompt,
    now,
    now
  )
  return getPrototypeTemplateOrThrow(id)
}

function requirePrivateTemplate(id: string): PrototypeTemplate {
  const template = getPrototypeTemplateOrThrow(id)
  if (template.builtin) throw new DesignError(400, '内置原型模板只读，请先复制为“我的模板”再修改')
  return template
}

export function updatePrototypeTemplate(id: string, body: Record<string, unknown>): PrototypeTemplate {
  requirePrivateTemplate(id)
  const input = normalizeTemplateInput(body)
  db.prepare(`
    UPDATE prototype_templates SET
      name = ?, category = ?, description = ?, tokens_json = ?, shell_json = ?, patterns_json = ?,
      page_set_rules_json = ?, prompt = ?, updated_at = ?
    WHERE id = ?
  `).run(
    input.name,
    input.category,
    input.description,
    JSON.stringify(input.tokens),
    JSON.stringify(input.shell),
    JSON.stringify(input.patterns),
    JSON.stringify(input.pageSetRules),
    input.prompt,
    nowIso(),
    id
  )
  return getPrototypeTemplateOrThrow(id)
}

export function deletePrototypeTemplate(id: string): void {
  requirePrivateTemplate(id)
  const used = db.prepare('SELECT COUNT(*) AS count FROM app_design_projects WHERE prototype_template_id = ?').get(id) as {
    count: number
  }
  if (used.count > 0) throw new DesignError(400, '该模板正被应用使用，请先切换这些应用的原型模板再删除')
  db.prepare('DELETE FROM prototype_templates WHERE id = ?').run(id)
}

export function duplicatePrototypeTemplate(id: string, name?: unknown): PrototypeTemplate {
  const source = getPrototypeTemplateOrThrow(id)
  const nextName = asString(name) || `${source.name}（副本）`
  const now = nowIso()
  const nextId = newTemplateId()
  db.prepare(`
    INSERT INTO prototype_templates
      (id, name, category, description, tokens_json, shell_json, patterns_json, page_set_rules_json,
       prompt, builtin, visibility, preview_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'private', NULL, ?, ?)
  `).run(
    nextId,
    nextName,
    source.category,
    source.description,
    JSON.stringify(source.tokens),
    JSON.stringify(source.shell),
    JSON.stringify(source.patterns),
    JSON.stringify(source.pageSetRules),
    source.prompt,
    now,
    now
  )
  return getPrototypeTemplateOrThrow(nextId)
}
