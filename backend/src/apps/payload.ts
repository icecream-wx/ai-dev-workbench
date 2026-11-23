/**
 * 应用详情负载
 *
 * DB 只存应用登记与需求模板默认值；需求/设计产物在文件里（见 /artifacts）。
 * `status` 退化为"当前所在视图"标签，**无门禁语义**。
 *
 * 设计系统摘要（pack × 应用类型 × 风格）始终解析；不再返回旧原型模板字段。
 */
import { resolveAppTemplates } from './template-resolution'
import { appDesignSystemPayload } from './design-system'

export interface AppRow {
  id: string
  name: string
  description: string | null
  dir: string
  backend_port: number
  status: string
  requirement_template_id: string | null
  created_at: string
  updated_at: string
}

export function appPayload(row: AppRow): Record<string, unknown> {
  const templates = resolveAppTemplates(row.id)
  const design = appDesignSystemPayload(row.id)
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    dir: row.dir,
    backendPort: row.backend_port,
    status: row.status,
    requirementTemplateId: templates.requirement.id,
    requirementTemplateName: templates.requirement.name,
    designSystem: design.designSystem,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
