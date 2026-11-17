/**
 * 设计 → 开发交接包（D5）类型
 *
 * 与旧 P3 结构化交接包（handoff/types.ts）区分：
 * - 来源是已确认需求文档 + 设计项目（实体/页面原型）+ 原型模板 + 变更单；
 * - 对外只使用稳定编号（ENT/PS/PAGE/SCENE/EPIC/STORY），不暴露工作台内部 ID；
 * - 文件包含 Markdown/DDL/JSON 与 PNG（二进制）。
 */
import type {
  DesignCoverage,
  DesignField,
  DesignInputBundle,
  DesignPageLayout,
  DesignPageSpec,
  PrototypePageType,
  PrototypeTemplate
} from '../design/types'
import type { DesignChangeReport } from './design-changes'

export type DesignHandoffFileKind = 'text' | 'image' | 'html'

export interface DesignHandoffFileMeta {
  name: string
  size: number
  hash: string
  kind: DesignHandoffFileKind
  /** PNG 来源设计页面（预览用；不写入文档） */
  sourcePageId?: string
}

export interface DesignHandoffChangeSetModule {
  moduleId: string
  moduleKey: string
  title: string
  reqBaseVersion: number | null
  reqBaseHash: string | null
  reqCurrentVersion: number | null
  reqCurrentHash: string | null
  designBaseVersion: number | null
  designBaseHash: string | null
  designCurrentVersion: number | null
  designCurrentHash: string | null
  templateId: string | null
}

export interface DesignHandoffChangeSet {
  id: string
  seq: number
  title: string
  description: string
  scope: string
  status: string
  baselineHandoffVersion: number | null
  currentHandoffVersion: number | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  /** M6：变更单模块范围（#1 首次基线也写行；旧单可能为空数组） */
  modules?: DesignHandoffChangeSetModule[]
}

export interface DesignHandoffRelationView {
  name: string
  type: string
  targetCode: string
  targetName: string
  targetTable: string
  sourceField?: string
  targetField?: string
  description?: string
}

/** 实体视图：代码 + 展示信息（引用已解析为目标代码） */
export interface DesignHandoffEntity {
  code: string
  id: string
  name: string
  tableName: string
  description: string
  fields: DesignField[]
  relations: DesignHandoffRelationView[]
  requirementRefs: string[]
}

export interface DesignHandoffPage {
  code: string
  id: string
  title: string
  type: PrototypePageType
  mode: 'create' | 'edit' | 'both' | null
  entityCode: string | null
  entityName: string | null
  entityTable: string | null
  requirementRefs: string[]
  spec: DesignPageSpec
  layout: DesignPageLayout
  imagePath: string | null
  htmlPath: string | null
  imageHash: string | null
  /** 交接包内 PNG 相对路径（prototypes/...） */
  prototypePath: string | null
  prototypeHtmlPath: string | null
}

export interface DesignHandoffPageSet {
  code: string
  id: string
  title: string
  description: string
  epicId: string | null
  epicTitle: string | null
  storyIds: string[]
  storyTitles: string[]
  entityCodes: string[]
  pages: DesignHandoffPage[]
}

/** M6：交接包内的模块需求（每个模块一份完整 PRD + 设计输入） */
export interface DesignHandoffModuleRequirements {
  version: number
  docHash: string
  title: string
  templateId: string
  templateName: string
  confirmedAt: string | null
  contentMd: string
  input: DesignInputBundle
}

/** M6：交接包内的模块设计版本（模板按模块记录；不一致只 warning） */
export interface DesignHandoffModuleDesign {
  version: number
  status: string
  confirmedAt: string | null
  templateId: string
  templateHash: string
  /** designStateHash（M5）；直接构造 bundle 时可为空串 */
  hash: string
}

/** M6a：模块在本次变更中的状态（seq=1 时为 null） */
export type DesignHandoffModuleChangeState = 'added' | 'changed' | 'unchanged'

/** M6：交接包内的一个模块（实体/页面集已解析为全局稳定编号） */
export interface DesignHandoffModule {
  id: string
  key: string
  title: string
  position: number
  required: boolean
  requirements: DesignHandoffModuleRequirements
  design: DesignHandoffModuleDesign
  entities: DesignHandoffEntity[]
  pageSets: DesignHandoffPageSet[]
  coverage: DesignCoverage
  warnings: string[]
  /** M6a：该模块设计输入 stale（需求已变更未同步） */
  stale: boolean
  /** seq>1：选中且有 diff = changed；基线无 = added；未选 = unchanged */
  changeState: DesignHandoffModuleChangeState | null
  changeReport: DesignChangeReport | null
}

/** M6：模块规模计数（manifest.modules / 前端模块表共用） */
export interface DesignHandoffModuleCounts {
  scenes: number
  epics: number
  stories: number
  entities: number
  fields: number
  relations: number
  pageSets: number
  pages: number
  prototypes: number
}

/** M6：模块摘要（read/preview/摘要/manifest 共用，不含正文） */
export interface DesignHandoffModuleSummary {
  id: string
  key: string
  title: string
  position: number
  required: boolean
  requirements: {
    version: number
    docHash: string
    title: string
    templateId: string
    templateName: string
    confirmed: boolean
    confirmedAt: string | null
  }
  design: {
    version: number
    status: string
    confirmedAt: string | null
    templateId: string
    templateHash: string
    hash: string
  }
  counts: DesignHandoffModuleCounts
  coverageRate: number
  missingImages: number
  stale: boolean
  warnings: string[]
  changeState: DesignHandoffModuleChangeState | null
}

export interface DesignHandoffBundle {
  app: { id: string; name: string; description: string; backendPort: number }
  generatedAt: string
  /** M6：应用级交接包按模块组织（至少一个） */
  modules: DesignHandoffModule[]
  /** M6：生成时最新的需求聚合快照；无快照为 null */
  requirementsBundle: { version: number; hash: string } | null
  /**
   * 聚合兼容字段（单模块 = 该模块；多模块 = 第一个模块的元信息）：
   * 读/摘要/旧前端路径继续可用；新渲染以 `modules` 为准。
   */
  requirements: {
    version: number
    docHash: string
    title: string
    templateId: string
    templateName: string
    confirmedAt: string | null
    contentMd: string
    input: DesignInputBundle
  }
  design: {
    version: number
    status: string
    confirmedAt: string | null
  }
  entities: DesignHandoffEntity[]
  pageSets: DesignHandoffPageSet[]
  template: PrototypeTemplate
  templateHash: string
  changeSet: DesignHandoffChangeSet
  /** 生成前的交接包版本（首次为 null） */
  baselineHandoffVersion: number | null
  /** 本次生成的交接包版本 */
  version: number
  /** C1：变更单 #2+ 的真实 diff（seq=1 或基线缺失时为 null；多模块为聚合） */
  changeReport: DesignChangeReport | null
  warnings: string[]
  coverage: DesignCoverage
}

export interface DesignHandoffTextFile {
  name: string
  content: string
}

export interface DesignHandoffValidation {
  issues: string[]
  warnings: string[]
}

// ---- I-09b-1 / U6：交接包规模（确定性，不调模型） ----

export type DesignHandoffScaleMetric = 'stories' | 'pages' | 'textBytes'

export interface DesignHandoffScaleTrigger {
  metric: DesignHandoffScaleMetric
  value: number
  threshold: number
}

export interface DesignHandoffScaleCounts {
  scenes: number
  epics: number
  stories: number
  entities: number
  fields: number
  relations: number
  pageSets: number
  pages: number
  prototypes: number
}

export interface DesignHandoffScale {
  level: 'normal' | 'large'
  suggested: boolean
  counts: DesignHandoffScaleCounts
  textBytes: number
  thresholds: { stories: number; pages: number; textBytes: number }
  triggers: DesignHandoffScaleTrigger[]
  phaseCount: number
  /** M6b：模块里程碑阶段数（不计入 phaseCount） */
  modulePhaseCount?: number
  derivedFrom: 'epics' | 'pageSets' | 'none'
}

export interface DesignHandoffMeta {
  version: number
  hash: string
  docsDir: string
  createdAt: string
  changeSet: DesignHandoffChangeSet | null
  baselineHandoffVersion: number | null
  files: DesignHandoffFileMeta[]
  manifest: Record<string, unknown> | null
  template: { id: string; name: string; hash: string } | null
  /** 规模与建议分阶段；旧交接包没有该字段时为 null */
  scale: DesignHandoffScale | null
  /** M6：模块摘要（旧交接包由 manifest 推导；缺失时为空数组） */
  modules: DesignHandoffModuleSummary[]
  /** M6：生成时最新的需求聚合快照 */
  requirementsBundle: { version: number; hash: string } | null
}

export interface DesignHandoffFileContent {
  name: string
  size: number
  hash: string
  kind: DesignHandoffFileKind
  content: string
  missing: boolean
  sourcePageId?: string
  url?: string
}

export interface DesignHandoffReadResult {
  handoff: DesignHandoffMeta | null
  changeSet: DesignHandoffChangeSet | null
  files: DesignHandoffFileContent[]
  /** 请求的历史版本文件是否已被覆盖（只有最新版本文件在磁盘上） */
  filesAvailable: boolean
}
