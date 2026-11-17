/**
 * 需求文档化（R1）：模板 / 文档 / 章节 / 版本的数据契约
 *
 * 说明：章节表是需求阶段的唯一事实来源；整篇 Markdown 由章节确定性拼接。
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

export type RequirementDocStatus = 'draft' | 'review' | 'confirmed'

/**
 * 版本来源（R2b checkpoint 策略）：
 * - ai：AI 建议应用；manual：手动“保存版本”/显式保存；template-change：切换模板；
 * - confirm：确认需求（即使内容未变也会生成，供变更单基线/取消恢复）；
 * - rollback：版本回滚；restore：变更取消恢复。
 */
export type RequirementDocVersionSource = 'ai' | 'manual' | 'template-change' | 'confirm' | 'rollback' | 'restore'

/** 结构化需求条目（H1）：稳定 ID 不随标题编辑变化 */
export interface RequirementScene {
  id: string
  title: string
  description: string
  position: number
  archived?: boolean
}

export interface RequirementEpic {
  id: string
  title: string
  goal: string
  priority: string
  sceneId: string | null
  position: number
  archived?: boolean
}

export interface RequirementStory {
  id: string
  epicId: string | null
  title: string
  description: string
  acceptance: string[]
  priority: string
  status?: string
  position: number
  archived?: boolean
}

/** 章节级结构化数据：scenes 章节放 scenes，epics 章节放 epics + stories */
export interface RequirementOutlineData {
  scenes: RequirementScene[]
  epics: RequirementEpic[]
  stories: RequirementStory[]
}

export interface RequirementDocSection {
  sectionKey: string
  title: string
  level: 2 | 3
  kind: TemplateSectionKind
  markdown: string
  /** 结构化章节（scenes/epics）的权威数据；markdown 仅用于渲染/导出 */
  data?: RequirementOutlineData
  required: boolean
  position: number
  updatedAt: string
}

export interface RequirementDoc {
  appId: string
  /** M2：文档所属模块（默认模块 MOD-001 / 新模块） */
  moduleId: string
  moduleKey: string
  templateId: string
  title: string
  contentMd: string
  status: RequirementDocStatus
  version: number
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
}

export interface RequirementDocPayload {
  doc: RequirementDoc
  template: RequirementTemplate
  sections: RequirementDocSection[]
  /** 保存/重建时的非阻塞提示（如结构化解析提示） */
  warnings?: string[]
}

export interface RequirementDocVersionMeta {
  version: number
  source: RequirementDocVersionSource
  createdAt: string
  title: string
  size: number
  /** 版本生成时所处的变更单（无变更时 null） */
  changeSetId: string | null
  changeSetSeq: number | null
}

export interface RequirementDocVersionDetail extends RequirementDocVersionMeta {
  contentMd: string
  sections: RequirementDocSection[]
}

export interface RequirementDocIssue {
  sectionKey: string
  title: string
  message: string
}
