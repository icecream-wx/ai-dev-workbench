/**
 * 设计 → 开发交接包：把已确认需求文档/设计输入/实体/页面集/原型模板/变更单
 * 汇总成确定性视图（不调用模型）。
 *
 * M6：交接包是**一个应用级包**，内部按模块组织；实体/页面集/页面使用全局连续编号，
 * 跨模块引用（实体关系/页面绑定）用全局稳定编号表达。
 *
 * 编号规则（稳定、可在文档中交叉引用）：
 * - 实体 ENT-001… 按模块顺序 + 模块内实体 position
 * - 页面集 PS-001… 按模块顺序 + 模块内页面集 position
 * - 页面 PAGE-001… 按“模块顺序 + 页面集顺序 + 页面顺序”连续编号
 * - 原型 PNG：prototypes/<MOD-KEY>/<ps-XXX>/page-XXX.png
 */
import crypto from 'node:crypto'
import type {
  DesignCoverage,
  DesignEntity,
  DesignInputBundle,
  DesignPage,
  DesignProjectPayload
} from '../design/types'
import type {
  DesignHandoffBundle,
  DesignHandoffChangeSet,
  DesignHandoffEntity,
  DesignHandoffModule,
  DesignHandoffModuleChangeState,
  DesignHandoffModuleCounts,
  DesignHandoffModuleSummary,
  DesignHandoffPage,
  DesignHandoffPageSet,
  DesignHandoffRelationView
} from './design-types'
import type { DesignChangeReport } from './design-changes'

const SAFE_TABLE = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/

function pad(index: number, width = 3): string {
  return String(index + 1).padStart(width, '0')
}

/** 表名：优先实体配置；未填写/不合法时用 t_entity_<n>（不使用内部 ID） */
export function handoffTableName(entity: DesignEntity, index: number): string {
  const configured = entity.tableName.trim()
  if (SAFE_TABLE.test(configured)) return configured
  return `t_entity_${index + 1}`
}

/** 模板哈希：用于 manifest 追溯（模板表本身没有 version 字段） */
export function prototypeTemplateHash(template: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(template)).digest('hex')
}

export function changeSetView(row: {
  id: string
  seq: number
  title: string
  description: string | null
  scope: string
  status: string
  base_handoff_version: number | null
  current_handoff_version: number | null
  created_at: string
  updated_at: string
  completed_at: string | null
}): DesignHandoffChangeSet {
  return {
    id: row.id,
    seq: row.seq,
    title: row.title,
    description: row.description ?? '',
    scope: row.scope,
    status: row.status,
    baselineHandoffVersion: row.base_handoff_version,
    currentHandoffVersion: row.current_handoff_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  }
}

// ---- 模块输入 ----

export interface BundleModuleRef {
  id: string
  key: string
  title: string
  position: number
  required: boolean
}

export interface BuildBundleModuleInput {
  module: BundleModuleRef
  project: DesignProjectPayload
  /** designStateHash（M5）；用于 manifest.designModules.hash */
  designHash?: string
  /** seq>1：added / changed / unchanged；seq=1 为 null */
  changeState?: DesignHandoffModuleChangeState | null
  changeReport?: DesignChangeReport | null
}

/** 全局编号/表名映射（跨模块引用解析用） */
interface CodeMaps {
  codeById: Map<string, string>
  indexById: Map<string, number>
  tableById: Map<string, string>
  nameById: Map<string, string>
  setCodeById: Map<string, string>
  pageCodeById: Map<string, string>
}

function buildCodeMaps(sources: BuildBundleModuleInput[]): CodeMaps {
  const maps: CodeMaps = {
    codeById: new Map(),
    indexById: new Map(),
    tableById: new Map(),
    nameById: new Map(),
    setCodeById: new Map(),
    pageCodeById: new Map()
  }
  let entityIndex = 0
  let setIndex = 0
  let pageIndex = 0
  for (const source of sources) {
    for (const entity of source.project.entities) {
      maps.indexById.set(entity.id, entityIndex)
      maps.codeById.set(entity.id, `ENT-${pad(entityIndex)}`)
      maps.tableById.set(entity.id, handoffTableName(entity, entityIndex))
      maps.nameById.set(entity.id, entity.name)
      entityIndex += 1
    }
    for (const set of source.project.pageSets) {
      maps.setCodeById.set(set.id, `PS-${pad(setIndex)}`)
      setIndex += 1
      for (const page of set.pages) {
        maps.pageCodeById.set(page.id, `PAGE-${pad(pageIndex)}`)
        pageIndex += 1
      }
    }
  }
  return maps
}

function mapEntities(project: DesignProjectPayload, maps: CodeMaps): DesignHandoffEntity[] {
  return project.entities.map((entity, localIndex) => {
    const index = maps.indexById.get(entity.id) ?? localIndex
    const code = maps.codeById.get(entity.id) ?? `ENT-${pad(index)}`
    const tableName = maps.tableById.get(entity.id) ?? handoffTableName(entity, index)
    const relations: DesignHandoffRelationView[] = entity.relations.map(relation => ({
      name: relation.name,
      type: relation.type,
      targetCode: maps.codeById.get(relation.target) ?? '',
      targetName: maps.nameById.get(relation.target) ?? relation.target,
      targetTable: maps.tableById.get(relation.target) ?? '',
      ...(relation.sourceField ? { sourceField: relation.sourceField } : {}),
      ...(relation.targetField ? { targetField: relation.targetField } : {}),
      ...(relation.description ? { description: relation.description } : {})
    }))
    return {
      code,
      id: entity.id,
      name: entity.name,
      tableName,
      description: entity.description,
      // 字段的 ref 同样解析为实体代码，避免文档里出现内部 ID
      fields: entity.fields.map(field =>
        field.ref
          ? { ...field, ref: maps.codeById.get(field.ref) ?? field.ref }
          : { ...field }
      ),
      relations,
      requirementRefs: [...entity.requirementRefs]
    }
  })
}

function pageView(
  page: DesignPage,
  info: {
    code: string
    setCode: string
    moduleKey: string
    entityCode: string | null
    entityName: string | null
    entityTable: string | null
  }
): DesignHandoffPage {
  const mode = page.spec.mode ?? null
  const prefix = `prototypes/${info.moduleKey}/${info.setCode.toLowerCase()}/${info.code.toLowerCase()}`
  return {
    code: info.code,
    id: page.id,
    title: page.title,
    type: page.type,
    mode,
    entityCode: info.entityCode,
    entityName: info.entityName,
    entityTable: info.entityTable,
    requirementRefs: [...page.requirementRefs],
    spec: page.spec,
    layout: page.layout,
    imagePath: page.imagePath,
    htmlPath: page.htmlPath,
    imageHash: page.imageHash,
    prototypePath: page.imagePath ? `${prefix}.png` : null,
    prototypeHtmlPath: page.htmlPath ? `${prefix}.html` : null
  }
}

function mapPageSets(
  project: DesignProjectPayload,
  maps: CodeMaps,
  moduleKey: string
): DesignHandoffPageSet[] {
  const epicById = new Map((project.input?.epics ?? []).map(epic => [epic.id, epic.title]))
  const storyById = new Map((project.input?.stories ?? []).map(story => [story.id, story.title]))
  return project.pageSets.map((set, localIndex) => {
    const code = maps.setCodeById.get(set.id) ?? `PS-${pad(localIndex)}`
    const pages = set.pages.map(page => {
      const entityId = page.entityId ?? null
      return pageView(page, {
        code: maps.pageCodeById.get(page.id) ?? 'PAGE-000',
        setCode: code,
        moduleKey,
        entityCode: entityId ? maps.codeById.get(entityId) ?? null : null,
        entityName: entityId ? maps.nameById.get(entityId) ?? null : null,
        entityTable: entityId ? maps.tableById.get(entityId) ?? null : null
      })
    })
    return {
      code,
      id: set.id,
      title: set.title,
      description: set.description,
      epicId: set.epicId,
      epicTitle: set.epicId ? epicById.get(set.epicId) ?? null : null,
      storyIds: [...set.storyIds],
      storyTitles: set.storyIds.map(id => storyById.get(id) ?? id),
      entityCodes: Array.from(
        new Set(pages.map(page => page.entityCode).filter((value): value is string => Boolean(value)))
      ),
      pages
    }
  })
}

// ---- 聚合 ----

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

/** 多模块设计输入合并（规模统计/计划/README 用；01 渲染仍用各模块原文） */
export function mergeDesignInputs(modules: DesignHandoffModule[]): DesignInputBundle {
  const primary = modules[0]
  if (!primary) throw new Error('交接包缺少模块')
  const inputs = modules.map(module => module.requirements.input)
  const base = inputs[0]
  const docHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(modules.map(module => [module.id, module.requirements.docHash])))
    .digest('hex')
  return {
    ...base,
    id: base.id,
    moduleId: primary.id,
    moduleKey: primary.key,
    moduleTitle: primary.title,
    docVersion: Math.max(...modules.map(module => module.requirements.version)),
    docHash,
    bundleVersion: inputs.reduce<number | null>(
      (max, input) => (input.bundleVersion === null ? max : Math.max(max ?? 0, input.bundleVersion)),
      null
    ),
    bundleHash: inputs.find(input => input.bundleHash)?.bundleHash ?? null,
    templateId: primary.requirements.templateId,
    templateName: primary.requirements.templateName,
    confirmedAt: primary.requirements.confirmedAt,
    scenes: modules.flatMap(module => module.requirements.input.scenes),
    epics: modules.flatMap(module => module.requirements.input.epics),
    stories: modules.flatMap(module => module.requirements.input.stories),
    roles: modules.flatMap(module => module.requirements.input.roles),
    openQuestions: modules.flatMap(module => module.requirements.input.openQuestions),
    glossary: modules.flatMap(module => module.requirements.input.glossary),
    warnings: unique(modules.flatMap(module => module.requirements.input.warnings))
  }
}

/** 多模块覆盖度合并（汇总统计 + 拼接明细） */
export function mergeCoverage(modules: DesignHandoffModule[]): DesignCoverage {
  const primary = modules[0]?.coverage
  const stats = modules.reduce(
    (sum, module) => ({
      sceneCount: sum.sceneCount + module.coverage.stats.sceneCount,
      epicCount: sum.epicCount + module.coverage.stats.epicCount,
      storyCount: sum.storyCount + module.coverage.stats.storyCount,
      coveredStoryCount: sum.coveredStoryCount + module.coverage.stats.coveredStoryCount
    }),
    { sceneCount: 0, epicCount: 0, storyCount: 0, coveredStoryCount: 0 }
  )
  return {
    inputId: primary?.inputId ?? null,
    docVersion: primary?.docVersion ?? null,
    structure: modules.some(module => module.coverage.structure === 'fallback') ? 'fallback' : 'prd',
    scenes: modules.flatMap(module => module.coverage.scenes),
    epics: modules.flatMap(module => module.coverage.epics),
    stories: modules.flatMap(module => module.coverage.stories),
    unlinkedEntities: modules.flatMap(module => module.coverage.unlinkedEntities),
    unlinkedPages: modules.flatMap(module => module.coverage.unlinkedPages),
    warnings: unique(modules.flatMap(module => module.coverage.warnings)),
    stats
  }
}

/** 合并各模块 diff（manifest/summary 的聚合兼容字段；05 用模块级报告） */
export function mergeChangeReports(reports: Array<DesignChangeReport | null>): DesignChangeReport | null {
  const list = reports.filter((report): report is DesignChangeReport => Boolean(report))
  if (!list.length) return null
  const counts = list.reduce(
    (sum, report) => ({
      added: sum.added + report.counts.added,
      modified: sum.modified + report.counts.modified,
      removed: sum.removed + report.counts.removed,
      total: sum.total + report.counts.total
    }),
    { added: 0, modified: 0, removed: 0, total: 0 }
  )
  const base = list[0].summary
  const summary = {
    requirements: {
      docVersionFrom: base.requirements.docVersionFrom,
      docVersionTo: base.requirements.docVersionTo,
      docHashChanged: list.some(report => report.summary.requirements.docHashChanged),
      scenes: sumTriples(list.map(report => report.summary.requirements.scenes)),
      epics: sumTriples(list.map(report => report.summary.requirements.epics)),
      stories: sumTriples(list.map(report => report.summary.requirements.stories))
    },
    design: {
      designVersionFrom: base.design.designVersionFrom,
      designVersionTo: base.design.designVersionTo,
      entities: sumTriples(list.map(report => report.summary.design.entities)),
      fields: sumTriples(list.map(report => report.summary.design.fields)),
      relations: sumTriples(list.map(report => report.summary.design.relations)),
      pageSets: sumTriples(list.map(report => report.summary.design.pageSets)),
      pages: sumTriples(list.map(report => report.summary.design.pages)),
      templateChanged: list.some(report => report.summary.design.templateChanged),
      templateHashFrom: base.design.templateHashFrom,
      templateHashTo: base.design.templateHashTo
    },
    deleted: unique(list.flatMap(report => report.summary.deleted)),
    counts
  }
  return {
    markdown: list.map(report => report.markdown.trim()).join('\n\n'),
    counts,
    summary
  }
}

function sumTriples(items: Array<{ added: number; modified: number; removed: number }>): {
  added: number
  modified: number
  removed: number
} {
  return items.reduce(
    (sum, item) => ({
      added: sum.added + item.added,
      modified: sum.modified + item.modified,
      removed: sum.removed + item.removed
    }),
    { added: 0, modified: 0, removed: 0 }
  )
}

/** 模块规模计数（manifest / 前端模块表） */
export function handoffModuleCounts(module: DesignHandoffModule): DesignHandoffModuleCounts {
  const pages = module.pageSets.reduce((sum, set) => sum + set.pages.length, 0)
  return {
    scenes: module.requirements.input.scenes.length,
    epics: module.requirements.input.epics.length,
    stories: module.requirements.input.stories.length,
    entities: module.entities.length,
    fields: module.entities.reduce((sum, entity) => sum + entity.fields.length, 0),
    relations: module.entities.reduce((sum, entity) => sum + entity.relations.length, 0),
    pageSets: module.pageSets.length,
    pages,
    prototypes: module.pageSets.reduce(
      (sum, set) => sum + set.pages.filter(page => Boolean(page.prototypePath)).length,
      0
    )
  }
}

/** 模块摘要（read/preview/meta/manifest 共用） */
export function moduleSummariesOf(bundle: DesignHandoffBundle): DesignHandoffModuleSummary[] {
  return bundle.modules.map(module => {
    const counts = handoffModuleCounts(module)
    const missingImages = module.pageSets.reduce(
      (sum, set) => sum + set.pages.filter(page => !page.prototypePath).length,
      0
    )
    return {
      id: module.id,
      key: module.key,
      title: module.title,
      position: module.position,
      required: module.required,
      requirements: {
        version: module.requirements.version,
        docHash: module.requirements.docHash,
        title: module.requirements.title,
        templateId: module.requirements.templateId,
        templateName: module.requirements.templateName,
        confirmed: Boolean(module.requirements.confirmedAt),
        confirmedAt: module.requirements.confirmedAt
      },
      design: {
        version: module.design.version,
        status: module.design.status,
        confirmedAt: module.design.confirmedAt,
        templateId: module.design.templateId,
        templateHash: module.design.templateHash,
        hash: module.design.hash
      },
      counts,
      coverageRate: counts.stories ? module.coverage.stats.coveredStoryCount / counts.stories : 1,
      missingImages,
      stale: module.stale,
      warnings: [...module.warnings],
      changeState: module.changeState
    }
  })
}

// ---- 构建 ----

export interface BuildBundleInput {
  app: { id: string; name: string; description: string; backendPort: number }
  /** 单模块旧入口（兼容测试/旧调用）；与 modules 二选一 */
  project?: DesignProjectPayload
  /** M6：按模块顺序 */
  modules?: BuildBundleModuleInput[]
  changeSet: DesignHandoffChangeSet
  version: number
  baselineHandoffVersion: number | null
  changeReport?: DesignChangeReport | null
  warnings: string[]
  generatedAt?: string
  requirementsBundle?: { version: number; hash: string } | null
}

function normalizeModules(input: BuildBundleInput): BuildBundleModuleInput[] {
  if (input.modules?.length) return input.modules
  if (!input.project) throw new Error('设计交接包缺少模块')
  return [
    {
      module: {
        id: input.project.module.id,
        key: input.project.module.key,
        title: input.project.module.title,
        position: 0,
        required: true
      },
      project: input.project
    }
  ]
}

export function buildDesignHandoffBundle(input: BuildBundleInput): DesignHandoffBundle {
  const sources = normalizeModules(input)
  const maps = buildCodeMaps(sources)

  const modules: DesignHandoffModule[] = sources.map(source => {
    const project = source.project
    const requirement = project.requirement
    const inputDoc = project.input
    if (!requirement || !inputDoc) {
      // 调用方已校验；这里只防御编程错误
      throw new Error('设计交接包缺少已确认需求文档/设计输入')
    }
    return {
      id: source.module.id,
      key: source.module.key,
      title: source.module.title,
      position: source.module.position,
      required: source.module.required,
      requirements: {
        version: requirement.version,
        docHash: inputDoc.docHash,
        title: requirement.title,
        templateId: requirement.templateId,
        templateName: requirement.templateName,
        confirmedAt: inputDoc.confirmedAt,
        contentMd: requirement.contentMd,
        input: inputDoc
      },
      design: {
        version: project.version,
        status: project.status,
        confirmedAt: project.confirmedAt,
        templateId: project.template.id,
        templateHash: prototypeTemplateHash(project.template),
        hash: source.designHash ?? ''
      },
      entities: mapEntities(project, maps),
      pageSets: mapPageSets(project, maps, source.module.key),
      coverage: project.coverage,
      warnings: [...project.warnings],
      stale: project.stale.stale,
      changeState: source.changeState ?? null,
      changeReport: source.changeReport ?? null
    }
  })

  const primary = modules[0]
  if (!primary) throw new Error('设计交接包缺少模块')
  const mergedInput = mergeDesignInputs(modules)
  const designVersions = modules.map(module => module.design.version)
  const confirmedAt = modules
    .map(module => module.design.confirmedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop() ?? null
  const allConfirmed = modules.every(module => module.design.status === 'confirmed')
  const changeReport =
    input.changeReport !== undefined
      ? input.changeReport
      : mergeChangeReports(modules.map(module => module.changeReport))

  return {
    app: { ...input.app },
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    modules,
    requirementsBundle: input.requirementsBundle ?? null,
    requirements: {
      version: primary.requirements.version,
      docHash: primary.requirements.docHash,
      title: primary.requirements.title,
      templateId: primary.requirements.templateId,
      templateName: primary.requirements.templateName,
      confirmedAt: primary.requirements.confirmedAt,
      contentMd: primary.requirements.contentMd,
      input: mergedInput
    },
    design: {
      version: designVersions.length ? Math.max(...designVersions) : 0,
      status: allConfirmed ? 'confirmed' : 'draft',
      confirmedAt
    },
    entities: modules.flatMap(module => module.entities),
    pageSets: modules.flatMap(module => module.pageSets),
    template: sources[0].project.template,
    templateHash: prototypeTemplateHash(sources[0].project.template),
    changeSet: input.changeSet,
    baselineHandoffVersion: input.baselineHandoffVersion,
    version: input.version,
    changeReport,
    warnings: unique([...input.warnings, ...modules.flatMap(module => module.warnings)]),
    coverage: mergeCoverage(modules)
  }
}
