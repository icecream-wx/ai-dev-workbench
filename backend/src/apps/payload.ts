/**
 * 应用详情负载（P1，供 apps/change-sets 等路由复用）
 *
 * 单独成模块，避免 changesets/routes 与 apps/routes 互相 import 形成循环依赖。
 *
 * R4b-2：需求固定文档模式，旧 structured（modules/stats/旧 P3 交接包）字段已移除。
 */
import { designHandoffSummary } from '../handoff/design-service'
import { designModulesState, designSummary } from '../design/service'
import { requirementDocSummary } from '../requirements/doc'
import { moduleSummaries } from '../requirements/modules'
import { activeChangeSetView } from '../changesets/service'
import { resolveAppTemplates } from './template-resolution'

export interface AppRow {
  id: string
  name: string
  description: string | null
  dir: string
  backend_port: number
  status: string
  requirements_confirmed_at: string | null
  design_confirmed_at: string | null
  development_started_at: string | null
  completed_at: string | null
  handoff_hash: string | null
  /** #7：应用级默认模板（旧应用为 null，解析时回退默认） */
  requirement_template_id: string | null
  prototype_template_id: string | null
  created_at: string
  updated_at: string
}

function stageStates(status: string): Record<'requirements' | 'design' | 'development', 'done' | 'current' | 'locked'> {
  if (status === 'completed') return { requirements: 'done', design: 'done', development: 'done' }
  if (status === 'development') return { requirements: 'done', design: 'done', development: 'current' }
  if (status === 'design') return { requirements: 'done', design: 'current', development: 'locked' }
  return { requirements: 'current', design: 'locked', development: 'locked' }
}

export function appPayload(row: AppRow): Record<string, unknown> {
  const handoff = designHandoffSummary(row.id)
  // #7：解析后的有效模板（模板删除/损坏时回退默认，不抛 500）
  const templates = resolveAppTemplates(row.id)
  // M4：应用级设计总览（只读；不建模块/项目/版本）
  const designModules = designModulesState(row.id)
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    dir: row.dir,
    backendPort: row.backend_port,
    status: row.status,
    stages: stageStates(row.status),
    requirementTemplateId: templates.requirement.id,
    requirementTemplateName: templates.requirement.name,
    prototypeTemplateId: templates.prototype.id,
    prototypeTemplateName: templates.prototype.name,
    prototypeTemplateSource: templates.prototypeSource,
    requirementDoc: requirementDocSummary(row.id),
    // M2：应用下需求模块摘要（只读；不建模块/文档/版本）
    requirementModules: moduleSummaries(row.id),
    designProject: designSummary(row.id),
    // M4：各模块设计摘要 + 应用级门禁（只读；不建项目/版本）
    designModules: designModules.modules,
    designModulesConfirmed: designModules.allModulesConfirmed,
    requirementsConfirmedAt: row.requirements_confirmed_at,
    designConfirmedAt: row.design_confirmed_at,
    developmentStartedAt: row.development_started_at,
    completedAt: row.completed_at,
    handoffHash: row.handoff_hash,
    handoff,
    // 来自最新交接包（保持 D5 语义）；activeChangeSet 是进行中的变更单（C1）
    changeSet: handoff?.changeSet ?? null,
    activeChangeSet: activeChangeSetView(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
