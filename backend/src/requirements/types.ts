/**
 * 需求模板库的数据契约（模板是全局权威，应用内只是副本）
 */

export type TemplateStage = 'requirements' | 'design' | 'test' | 'dev-plan'

export type TemplateSectionKind =
  | 'markdown'
  | 'meta'
  | 'metrics'
  | 'roles'
  | 'scenes'
  | 'epics'
  | 'rules'
  | 'pages'
  | 'nfr'
  | 'issues'
  | 'glossary'
  | 'acceptance'

export const TEMPLATE_STAGES: TemplateStage[] = ['requirements', 'design', 'test', 'dev-plan']

export const TEMPLATE_SECTION_KINDS: TemplateSectionKind[] = [
  'markdown',
  'meta',
  'metrics',
  'roles',
  'scenes',
  'epics',
  'rules',
  'pages',
  'nfr',
  'issues',
  'glossary',
  'acceptance'
]

export interface TemplateSectionDef {
  /** 稳定 key：模板内唯一，如 problem / goals / epics；用户新增为 custom-xxx */
  id: string
  title: string
  level: 2 | 3
  kind: TemplateSectionKind
  /** 该章节写什么（给 AI 的撰写提示） */
  guidance: string
  required: boolean
}

export interface RequirementTemplate {
  id: string
  name: string
  stage: TemplateStage
  category: string
  description: string
  /** 模板总提示词 */
  prompt: string
  sections: TemplateSectionDef[]
  builtin: boolean
  visibility: 'builtin' | 'private'
  createdAt: string
  updatedAt: string
}
