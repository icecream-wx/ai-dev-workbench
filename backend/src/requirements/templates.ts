/**
 * 需求模板服务（R1）
 *
 * - 内置模板启动时 seed（模块加载即 seed，幂等）
 * - 内置模板只读；复制后生成“我的模板”
 * - 章节结构统一校验，非法输入返回 400
 */
import { db, nowIso } from '../db'
import { BUILTIN_TEMPLATES, DEFAULT_TEMPLATE_ID } from './builtin-templates'
import { removeTemplateAssets, syncTemplateToApps, templateUsage } from '../templates/distribution'
import {
  TEMPLATE_SECTION_KINDS,
  TEMPLATE_STAGES,
  type RequirementTemplate,
  type TemplateSectionDef,
  type TemplateSectionKind,
  type TemplateStage
} from './types'

export class RequirementDocError extends Error {
  readonly status: number
  readonly issues: unknown[]
  readonly warnings: string[]
  readonly extra: Record<string, unknown>
  /** 可选的诊断片段（502 等错误透出给前端，例如模型原始输出片段） */
  readonly detail?: string

  constructor(status: number, message: string, issues: unknown[] = [], warnings: string[] = [], detail?: string) {
    super(message)
    this.status = status
    this.issues = issues
    this.warnings = warnings
    this.detail = typeof detail === 'string' && detail.trim() ? detail : undefined
    this.extra = {
      ...(issues.length ? { issues } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...(this.detail ? { detail: this.detail } : {})
    }
  }
}

interface TemplateRow {
  id: string
  name: string
  stage: string
  category: string
  description: string | null
  prompt: string
  sections_json: string
  builtin: number
  visibility: string
  created_at: string
  updated_at: string
}

const SECTION_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/

function isTemplateStage(value: unknown): value is TemplateStage {
  return typeof value === 'string' && (TEMPLATE_STAGES as string[]).includes(value)
}

function isSectionKind(value: unknown): value is TemplateSectionKind {
  return typeof value === 'string' && (TEMPLATE_SECTION_KINDS as string[]).includes(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSections(raw: unknown): TemplateSectionDef[] {
  if (!Array.isArray(raw)) throw new RequirementDocError(400, '模板章节需要是数组')
  const sections: TemplateSectionDef[] = []
  const seen = new Set<string>()
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== 'object') throw new RequirementDocError(400, `第 ${index + 1} 个章节格式不正确`)
    const input = item as Record<string, unknown>
    const id = asString(input.id ?? input.sectionKey)
    if (!SECTION_KEY_PATTERN.test(id)) {
      throw new RequirementDocError(400, `章节 key 不合法：${id || '(空)'}，只能包含字母、数字、下划线和短横线`)
    }
    if (seen.has(id)) throw new RequirementDocError(400, `章节 key 重复：${id}`)
    seen.add(id)
    const title = asString(input.title)
    if (!title) throw new RequirementDocError(400, `章节 ${id} 缺少标题`)
    const level = input.level === 3 ? 3 : 2
    const kind = isSectionKind(input.kind) ? input.kind : 'markdown'
    const guidance = asString(input.guidance)
    sections.push({ id, title, level, kind, guidance, required: Boolean(input.required) })
  }
  if (!sections.length) throw new RequirementDocError(400, '模板至少需要 1 个章节')
  return sections
}

function rowToTemplate(row: TemplateRow): RequirementTemplate {
  let sections: TemplateSectionDef[] = []
  try {
    const parsed = JSON.parse(row.sections_json)
    sections = normalizeSections(parsed)
  } catch {
    sections = []
  }
  return {
    id: row.id,
    name: row.name,
    stage: row.stage as TemplateStage,
    category: row.category,
    description: row.description ?? '',
    prompt: row.prompt,
    sections,
    builtin: row.builtin === 1,
    visibility: row.visibility === 'builtin' ? 'builtin' : 'private',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/** 内置模板 seed：存在则更新结构/提示词（内置只读，不会覆盖用户模板） */
function seedBuiltinTemplates(): void {
  const now = nowIso()
  const upsert = db.prepare(`
    INSERT INTO requirement_templates
      (id, name, stage, category, description, prompt, sections_json, builtin, visibility, created_at, updated_at)
    VALUES (@id, @name, @stage, @category, @description, @prompt, @sections_json, 1, 'builtin', @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      stage = excluded.stage,
      category = excluded.category,
      description = excluded.description,
      prompt = excluded.prompt,
      sections_json = excluded.sections_json,
      builtin = 1,
      visibility = 'builtin',
      updated_at = excluded.updated_at
  `)
  const tx = db.transaction(() => {
    for (const template of BUILTIN_TEMPLATES) {
      upsert.run({
        id: template.id,
        name: template.name,
        stage: template.stage,
        category: template.category,
        description: template.description,
        prompt: template.prompt,
        sections_json: JSON.stringify(template.sections),
        created_at: template.createdAt || now,
        updated_at: now
      })
    }
  })
  tx()
}

seedBuiltinTemplates()

export interface ListTemplateQuery {
  stage?: unknown
  category?: unknown
  q?: unknown
  visibility?: unknown
}

export function listTemplates(query: ListTemplateQuery = {}): RequirementTemplate[] {
  const clauses: string[] = []
  const values: unknown[] = []
  if (isTemplateStage(query.stage)) {
    clauses.push('stage = ?')
    values.push(query.stage)
  }
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
    .prepare(`SELECT * FROM requirement_templates ${where} ORDER BY builtin DESC, stage ASC, category ASC, created_at ASC`)
    .all(...values) as TemplateRow[]
  return rows.map(rowToTemplate)
}

export function getTemplateOrThrow(id: string): RequirementTemplate {
  const row = db.prepare('SELECT * FROM requirement_templates WHERE id = ?').get(id) as TemplateRow | undefined
  if (!row) throw new RequirementDocError(404, `模板不存在：${id}`)
  const template = rowToTemplate(row)
  if (!template.sections.length) throw new RequirementDocError(500, `模板章节损坏：${id}`)
  return template
}

/** 需求阶段只可使用 stage=requirements 的模板 */
export function getRequirementTemplateOrThrow(id: string): RequirementTemplate {
  const template = getTemplateOrThrow(id)
  if (template.stage !== 'requirements') {
    throw new RequirementDocError(400, `模板「${template.name}」属于 ${template.stage} 阶段，不能用于需求文档`)
  }
  return template
}

export function defaultRequirementTemplate(): RequirementTemplate {
  const row = db.prepare('SELECT * FROM requirement_templates WHERE id = ?').get(DEFAULT_TEMPLATE_ID) as TemplateRow | undefined
  if (row) return rowToTemplate(row)
  const rows = db
    .prepare("SELECT * FROM requirement_templates WHERE stage = 'requirements' ORDER BY builtin DESC, created_at ASC LIMIT 1")
    .get() as TemplateRow | undefined
  if (!rows) throw new RequirementDocError(500, '缺少内置需求模板，请重启工作台以完成 seed')
  return rowToTemplate(rows)
}

function normalizeTemplateInput(body: Record<string, unknown>): Omit<RequirementTemplate, 'id' | 'builtin' | 'visibility' | 'createdAt' | 'updatedAt'> {
  const name = asString(body.name)
  if (!name) throw new RequirementDocError(400, '模板名称不能为空')
  const stage = isTemplateStage(body.stage) ? body.stage : 'requirements'
  const category = asString(body.category) || '我的模板'
  const description = asString(body.description)
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) throw new RequirementDocError(400, '模板提示词不能为空')
  const sections = normalizeSections(body.sections)
  return { name, stage, category, description, prompt, sections }
}

function newTemplateId(): string {
  return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createTemplate(body: Record<string, unknown>): RequirementTemplate {
  const input = normalizeTemplateInput(body)
  const id = newTemplateId()
  const now = nowIso()
  db.prepare(`
    INSERT INTO requirement_templates
      (id, name, stage, category, description, prompt, sections_json, builtin, visibility, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'private', ?, ?)
  `).run(id, input.name, input.stage, input.category, input.description, input.prompt, JSON.stringify(input.sections), now, now)
  syncTemplateToApps('requirement', id)
  return getTemplateOrThrow(id)
}

function requirePrivateTemplate(id: string): RequirementTemplate {
  const template = getTemplateOrThrow(id)
  if (template.builtin) throw new RequirementDocError(400, '内置模板只读，请先复制为“我的模板”再修改')
  return template
}

export function updateTemplate(id: string, body: Record<string, unknown>): RequirementTemplate {
  requirePrivateTemplate(id)
  const input = normalizeTemplateInput(body)
  db.prepare(`
    UPDATE requirement_templates
    SET name = ?, stage = ?, category = ?, description = ?, prompt = ?, sections_json = ?, updated_at = ?
    WHERE id = ?
  `).run(input.name, input.stage, input.category, input.description, input.prompt, JSON.stringify(input.sections), nowIso(), id)
  syncTemplateToApps('requirement', id)
  return getTemplateOrThrow(id)
}

export function deleteTemplate(id: string): void {
  requirePrivateTemplate(id)
  // 全局删除保护：仍被模块 frontmatter 引用 → 409 并列出引用位置
  const usage = templateUsage('requirement', id)
  if (usage.apps.length) {
    const where = usage.apps
      .map(app => `${app.appName}（${app.modules.map(module => `${module.module || '未命名'} @ ${module.file}`).join('、')}）`)
      .join('；')
    throw new RequirementDocError(409, `模板仍被 ${usage.apps.length} 个应用的模块引用：${where}。请先在对话中让 agent 改掉这些模块的 template`)
  }
  db.prepare('DELETE FROM requirement_templates WHERE id = ?').run(id)
  removeTemplateAssets('requirement', id)
}

export function duplicateTemplate(id: string, name?: unknown): RequirementTemplate {
  const source = getTemplateOrThrow(id)
  const nextName = asString(name) || `${source.name}（副本）`
  const now = nowIso()
  const nextId = newTemplateId()
  db.prepare(`
    INSERT INTO requirement_templates
      (id, name, stage, category, description, prompt, sections_json, builtin, visibility, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'private', ?, ?)
  `).run(nextId, nextName, source.stage, source.category, source.description, source.prompt, JSON.stringify(source.sections), now, now)
  return getTemplateOrThrow(nextId)
}
