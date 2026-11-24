/**
 * 单需求文档 `docs/requirements/requirements.md`（D1，去模块）
 *
 * - 每个应用一份需求文档（不再有 `MOD-xxx-*.md`）；
 * - frontmatter 只 `title` / `template`；
 * - 新建应用时按所选需求模板渲染骨架（不调模型、不生成内容）；
 * - 仅文件缺失时创建，已存在不覆盖；不写数据库。
 */
import fs from 'node:fs'
import path from 'node:path'
import { appDirOf } from '../apps/scaffold'
import { db } from '../db'
import { renderRequirementsMarkdown } from '../templates/render'
import { syncAppTemplates } from '../templates/distribution'
import type { RequirementTemplate } from './types'

export const REQUIREMENTS_RELATIVE = 'docs/requirements/requirements.md'

export class RequirementDocError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface AppRow {
  id: string
  name: string
  requirement_template_id: string | null
}

export function requirementsFilePath(appDir: string): string {
  return path.join(appDir, ...REQUIREMENTS_RELATIVE.split('/'))
}

function appOrThrow(appId: string): AppRow {
  const row = db.prepare('SELECT id, name, requirement_template_id FROM apps WHERE id = ?').get(appId) as AppRow | undefined
  if (!row) throw new RequirementDocError(404, `应用不存在：${appId}`)
  return row
}

function templateFor(app: AppRow): RequirementTemplate {
  // 延迟 require：templates.ts 也会 import distribution，避免循环依赖初始化问题
  const templates = require('./templates') as typeof import('./templates')
  if (app.requirement_template_id) {
    try {
      return templates.getRequirementTemplateOrThrow(app.requirement_template_id)
    } catch {
      // 应用默认模板已删除：回退全局默认
    }
  }
  return templates.defaultRequirementTemplate()
}

export interface EnsureRequirementDocResult {
  created: boolean
  skipped: boolean
  file: string
  reason?: 'exists' | 'workspace-missing' | 'write-failed'
  warnings: string[]
}

/**
 * 确保 `docs/requirements/requirements.md` 存在：缺失时按应用默认需求模板写骨架，
 * 已存在不覆盖（agent 填写内容不被覆盖）。
 */
export function ensureRequirementDoc(appId: string, appDir: string = appDirOf(appId)): EnsureRequirementDocResult {
  const file = REQUIREMENTS_RELATIVE
  if (!fs.existsSync(appDir)) {
    return { created: false, skipped: true, file, reason: 'workspace-missing', warnings: [] }
  }
  const full = requirementsFilePath(appDir)
  if (fs.existsSync(full)) {
    return { created: false, skipped: true, file, reason: 'exists', warnings: [] }
  }
  const app = appOrThrow(appId)
  const template = templateFor(app)
  try {
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, renderRequirementsMarkdown(template, { title: app.name, templateId: template.id }), 'utf8')
  } catch {
    return { created: false, skipped: true, file, reason: 'write-failed', warnings: [] }
  }
  let warnings: string[] = []
  try {
    warnings = syncAppTemplates(appId).warnings
  } catch (error) {
    warnings = [error instanceof Error ? error.message : String(error)]
  }
  return { created: true, skipped: false, file, warnings }
}

/** 读取单文档 frontmatter 的 template（用于模板使用/删除保护；文件缺失返回空串） */
export function requirementDocTemplateOf(appDir: string): string {
  const full = requirementsFilePath(appDir)
  try {
    const text = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '')
    const end = text.indexOf('\n---', 3)
    if (!text.startsWith('---') || end < 0) return ''
    const block = text.slice(3, end)
    const match = /^template\s*:\s*(.+)$/m.exec(block)
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : ''
  } catch {
    return ''
  }
}
