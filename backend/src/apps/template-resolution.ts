/**
 * 应用级默认模板（#7）
 *
 * 背景：创建应用时可选择“需求模板 + 设计原型模板”，存为应用默认值；
 * 首次初始化需求文档/设计项目时使用，之后在需求/设计阶段切换模板时同步。
 *
 * 解析优先级：
 * - 需求：已有需求文档 → 文档当前模板；否则应用默认（有效）→ 全局默认。
 * - 原型：设计项目存在 → 项目模板；否则应用默认 → 全局默认。
 *
 * 模板被删除/损坏时静默回退默认（不抛 500）。本模块只读 DB，
 * 不创建需求文档/设计项目；使用方为 requirements/doc、design/service、apps/payload、
 * `GET /api/apps/:id/templates`。
 */
import { db } from '../db'
import { defaultRequirementTemplate, getRequirementTemplateOrThrow } from '../requirements/templates'
import { defaultPrototypeTemplate, getPrototypeTemplateOrThrow } from '../design/templates'
import type { RequirementTemplate } from '../requirements/types'
import type { PrototypeTemplate } from '../design/types'

export type PrototypeTemplateSource = 'design-project' | 'app-default' | 'global-default'

export interface AppTemplateRef {
  id: string
  name: string
}

export interface AppTemplateResolution {
  requirement: AppTemplateRef
  prototype: AppTemplateRef
  prototypeSource: PrototypeTemplateSource
}

interface AppTemplateRow {
  requirement_template_id: string | null
  prototype_template_id: string | null
}

function appTemplateRow(appId: string): AppTemplateRow {
  const row = db
    .prepare('SELECT requirement_template_id, prototype_template_id FROM apps WHERE id = ?')
    .get(appId) as AppTemplateRow | undefined
  if (!row) throw new Error(`应用不存在：${appId}`)
  return row
}

/** 有效需求阶段模板；不存在/已删除/阶段不符 → null */
function requirementTemplateOrNull(id: string | null | undefined): RequirementTemplate | null {
  if (!id) return null
  try {
    return getRequirementTemplateOrThrow(id)
  } catch {
    return null
  }
}

/** 有效原型模板；不存在/已删除 → null */
function prototypeTemplateOrNull(id: string | null | undefined): PrototypeTemplate | null {
  if (!id) return null
  try {
    return getPrototypeTemplateOrThrow(id)
  } catch {
    return null
  }
}

/** 新建设计项目时使用的模板：应用默认（有效）→ 全局默认 */
export function prototypeTemplateForNewProject(appId: string): PrototypeTemplate {
  const row = appTemplateRow(appId)
  return prototypeTemplateOrNull(row.prototype_template_id) ?? defaultPrototypeTemplate()
}

/**
 * 当前需求模板（M2：按模块）：
 * - 有该模块文档 → 以文档为准（避免与编辑中的文档不一致）；
 * - 否则应用默认（有效）→ 全局默认。
 * 只读：不创建模块/文档。
 */
export function appRequirementTemplate(appId: string, moduleId?: string): RequirementTemplate {
  const module = moduleId ? { id: moduleId } : defaultModuleForTemplate(appId)
  if (module) {
    const doc = db
      .prepare('SELECT template_id FROM app_requirement_docs WHERE app_id = ? AND module_id = ?')
      .get(appId, module.id) as { template_id: string } | undefined
    if (doc) {
      const current = requirementTemplateOrNull(doc.template_id)
      if (current) return current
    }
  }
  const row = appTemplateRow(appId)
  return requirementTemplateOrNull(row.requirement_template_id) ?? defaultRequirementTemplate()
}

/** 默认模块（不创建；供只读模板解析使用） */
function defaultModuleForTemplate(appId: string): { id: string } | undefined {
  return db
    .prepare('SELECT id FROM app_modules WHERE app_id = ? AND archived_at IS NULL ORDER BY position ASC, module_key ASC LIMIT 1')
    .get(appId) as { id: string } | undefined
}

/** 显式模块（不创建、不校验归档；不存在时按“无模块项目”回退应用默认） */
function moduleForTemplate(appId: string, moduleId?: string): { id: string } | undefined {
  const requested = typeof moduleId === 'string' ? moduleId.trim() : ''
  if (!requested) return defaultModuleForTemplate(appId)
  return db.prepare('SELECT id FROM app_modules WHERE app_id = ? AND id = ?').get(appId, requested) as
    | { id: string }
    | undefined
}

/** 当前原型模板（M4：按模块设计项目）→ 应用默认 → 全局默认 */
export function appPrototypeTemplate(
  appId: string,
  moduleId?: string
): { template: PrototypeTemplate; source: PrototypeTemplateSource } {
  const module = moduleForTemplate(appId, moduleId)
  if (module) {
    const project = db
      .prepare('SELECT prototype_template_id FROM app_design_projects WHERE app_id = ? AND module_id = ?')
      .get(appId, module.id) as { prototype_template_id: string } | undefined
    if (project) {
      const current = prototypeTemplateOrNull(project.prototype_template_id)
      if (current) return { template: current, source: 'design-project' }
    }
  }
  const row = appTemplateRow(appId)
  const appDefault = prototypeTemplateOrNull(row.prototype_template_id)
  if (appDefault) return { template: appDefault, source: 'app-default' }
  return { template: defaultPrototypeTemplate(), source: 'global-default' }
}

/** 只读模板解析（供 #8 需求阶段原型预览使用；不创建文档/设计项目） */
export function resolveAppTemplates(appId: string, moduleId?: string): AppTemplateResolution {
  const requirement = appRequirementTemplate(appId, moduleId)
  const prototype = appPrototypeTemplate(appId, moduleId)
  return {
    requirement: { id: requirement.id, name: requirement.name },
    prototype: { id: prototype.template.id, name: prototype.template.name },
    prototypeSource: prototype.source
  }
}

/** 需求模板切换后同步应用默认值 */
export function syncAppRequirementTemplate(appId: string, templateId: string): void {
  db.prepare('UPDATE apps SET requirement_template_id = ? WHERE id = ?').run(templateId, appId)
}

/** 原型模板切换后同步应用默认值 */
export function syncAppPrototypeTemplate(appId: string, templateId: string): void {
  db.prepare('UPDATE apps SET prototype_template_id = ? WHERE id = ?').run(templateId, appId)
}
