/**
 * 应用级默认需求模板解析（只读）
 *
 * - 需求：应用默认（有效）→ 全局默认；
 *
 * 模板被删除/损坏时静默回退默认（不 500）；模块级模板覆盖以文件 frontmatter 为准
 * （见 `templates/distribution` 与 `workspace/artifacts`）。
 *
 * 设计阶段不再有“原型模板”：统一由应用设计系统（pack × 应用类型 × 风格）决定。
 */
import { db } from '../db'
import { defaultRequirementTemplate, getRequirementTemplateOrThrow } from '../requirements/templates'
import type { RequirementTemplate } from '../requirements/types'

export interface AppTemplateRef {
  id: string
  name: string
}

export interface AppTemplateResolution {
  requirement: AppTemplateRef
}

interface AppTemplateRow {
  requirement_template_id: string | null
}

function appRequirementTemplateId(appId: string): string | null {
  const row = db.prepare('SELECT requirement_template_id FROM apps WHERE id = ?').get(appId) as
    | AppTemplateRow
    | undefined
  if (!row) throw new Error(`应用不存在：${appId}`)
  return row.requirement_template_id
}

function requirementTemplateOrNull(id: string | null | undefined): RequirementTemplate | null {
  if (!id) return null
  try {
    return getRequirementTemplateOrThrow(id)
  } catch {
    return null
  }
}

/** 应用默认需求模板（有效）→ 全局默认 */
function requirementTemplateForApp(appId: string): RequirementTemplate {
  return requirementTemplateOrNull(appRequirementTemplateId(appId)) ?? defaultRequirementTemplate()
}

/** 只读模板解析（GET /api/apps/:id/templates 与 app payload 共用） */
export function resolveAppTemplates(appId: string): AppTemplateResolution {
  const requirement = requirementTemplateForApp(appId)
  return { requirement: { id: requirement.id, name: requirement.name } }
}
