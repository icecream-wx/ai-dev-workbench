/**
 * 需求模块文件（UI 新建/改名/排序）
 *
 * 模块 = 一个文件 `docs/requirements/MOD-xxx-<标题>.md`（frontmatter + 章节骨架）。
 * **不写数据库**；删除模块由用户在对话里让 agent 删文件（UI 不提供删除）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { appDirOf } from '../apps/scaffold'
import { db } from '../db'
import { renderModuleMarkdown } from '../templates/render'
import { syncAppTemplates } from '../templates/distribution'
import { parseFrontmatter } from '../workspace/frontmatter'
import type { RequirementTemplate } from '../requirements/types'

export class ModuleFileError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface AppRow {
  id: string
  requirement_template_id: string | null
}

function appOrThrow(appId: string): AppRow {
  const row = db.prepare('SELECT id, requirement_template_id FROM apps WHERE id = ?').get(appId) as AppRow | undefined
  if (!row) throw new ModuleFileError(404, `应用不存在：${appId}`)
  return row
}

function requirementsDir(appId: string): string {
  return path.join(appDirOf(appId), 'docs', 'requirements')
}

function templateOrThrow(templateId: string | undefined, app: AppRow): RequirementTemplate {
  const templates = require('../requirements/templates') as typeof import('../requirements/templates')
  if (templateId) return templates.getRequirementTemplateOrThrow(templateId)
  if (app.requirement_template_id) {
    try {
      return templates.getRequirementTemplateOrThrow(app.requirement_template_id)
    } catch {
      // 应用默认模板已删除：回退全局默认
    }
  }
  return templates.defaultRequirementTemplate()
}

interface ExistingModule {
  file: string
  key: string
  title: string
  order: number
  template: string
  text: string
}

function scanModules(appId: string): ExistingModule[] {
  const dir = requirementsDir(appId)
  if (!fs.existsSync(dir)) return []
  const out: ExistingModule[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.toLowerCase() === 'readme.md') continue
    const file = path.join(dir, entry.name)
    const text = fs.readFileSync(file, 'utf8')
    const parsed = parseFrontmatter(text)
    const orderRaw = Number(parsed.data.order)
    out.push({
      file,
      key: (parsed.data.module ?? '').trim(),
      title: (parsed.data.title ?? '').trim(),
      order: Number.isFinite(orderRaw) ? orderRaw : 0,
      template: (parsed.data.template ?? '').trim(),
      text
    })
  }
  return out
}

function nextModuleKey(modules: ExistingModule[]): string {
  let max = 0
  for (const module of modules) {
    const match = /^MOD-(\d+)$/.exec(module.key)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `MOD-${String(max + 1).padStart(3, '0')}`
}

/** 文件名里的标题：去掉路径分隔符与 Windows 保留字符 */
function sanitizeTitleForFilename(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  return cleaned || '未命名模块'
}

function fileNameOf(key: string, title: string): string {
  return `${key}-${sanitizeTitleForFilename(title)}.md`
}

function rewriteHeader(text: string, updates: { title: string; order: number; template: string }): string {
  const normalized = text.replace(/^\uFEFF/, '')
  const end = normalized.indexOf('\n---', 3)
  const body = end < 0 ? normalized : normalized.slice(end + 4).replace(/^\r?\n/, '')
  const parsed = parseFrontmatter(normalized)
  const keepKey = (parsed.data.module ?? '').trim()
  const lines = [
    '---',
    `module: ${keepKey}`,
    `title: ${JSON.stringify(updates.title)}`,
    `order: ${updates.order}`,
    `template: ${updates.template}`,
    '---',
    ''
  ]
  const bodyLines = body.split(/\r?\n/)
  const firstHeading = bodyLines.findIndex(line => /^#\s+/.test(line))
  if (firstHeading >= 0) bodyLines[firstHeading] = `# ${updates.title}`
  else bodyLines.unshift(`# ${updates.title}`, '')
  return `${lines.join('\n')}${bodyLines.join('\n').replace(/^\n+/, '')}`.replace(/\n+$/, '\n')
}

/** 新建模块文件（frontmatter + 应用默认/指定模板的章节骨架） */
export function createModuleFile(appId: string, input: { title?: unknown; templateId?: unknown }): {
  module: { key: string; title: string; order: number; template: string; file: string }
  warnings: string[]
} {
  const app = appOrThrow(appId)
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title) throw new ModuleFileError(400, 'title 不能为空')
  if (title.length > 80) throw new ModuleFileError(400, 'title 最多 80 字符')
  const templateId = typeof input.templateId === 'string' && input.templateId.trim() ? input.templateId.trim() : undefined
  const template = templateOrThrow(templateId, app)

  const dir = requirementsDir(appId)
  fs.mkdirSync(dir, { recursive: true })
  const modules = scanModules(appId)
  const key = nextModuleKey(modules)
  const order = modules.reduce((max, module) => Math.max(max, module.order || 0), 0) + 1
  const file = path.join(dir, fileNameOf(key, title))
  if (fs.existsSync(file)) throw new ModuleFileError(409, `模块文件已存在：${path.basename(file)}`)

  fs.writeFileSync(file, renderModuleMarkdown(template, { module: key, title, order, templateId: template.id }), 'utf8')
  const warnings = syncWarnings(appId)
  return {
    module: { key, title, order, template: template.id, file: path.relative(appDirOf(appId), file).replace(/\\/g, '/') },
    warnings
  }
}

function syncWarnings(appId: string): string[] {
  try {
    return syncAppTemplates(appId).warnings
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
}

/** 修改模块（title/order/template；不提供删除） */
export function updateModuleFile(
  appId: string,
  key: string,
  patch: { title?: unknown; order?: unknown; template?: unknown }
): { module: { key: string; title: string; order: number; template: string; file: string }; warnings: string[] } {
  const app = appOrThrow(appId)
  const target = scanModules(appId).find(module => module.key === key)
  if (!target) throw new ModuleFileError(404, `模块不存在：${key}`)

  const title = patch.title === undefined ? target.title : typeof patch.title === 'string' ? patch.title.trim() : ''
  if (!title) throw new ModuleFileError(400, 'title 不能为空')
  if (title.length > 80) throw new ModuleFileError(400, 'title 最多 80 字符')
  const order = patch.order === undefined ? target.order : Number(patch.order)
  if (!Number.isInteger(order) || order < 1) throw new ModuleFileError(400, 'order 需为正整数')
  const templateId = patch.template === undefined ? target.template || app.requirement_template_id || '' : String(patch.template).trim()
  const template = templateOrThrow(templateId || undefined, app)

  const nextText = rewriteHeader(target.text, { title, order, template: template.id })
  const nextFile = path.join(requirementsDir(appId), fileNameOf(key, title))
  fs.writeFileSync(target.file, nextText, 'utf8')
  if (path.resolve(nextFile) !== path.resolve(target.file)) {
    if (fs.existsSync(nextFile)) throw new ModuleFileError(409, `目标文件名已存在：${path.basename(nextFile)}`)
    fs.renameSync(target.file, nextFile)
  }
  return {
    module: {
      key,
      title,
      order,
      template: template.id,
      file: path.relative(appDirOf(appId), nextFile).replace(/\\/g, '/')
    },
    warnings: syncWarnings(appId)
  }
}
