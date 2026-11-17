/**
 * 设计输入快照（H2）：已确认需求文档 → DesignInputBundle（确定性）
 *
 * - 直接从章节结构化数据（H1）+ 关键章节 Markdown 构建，不调用模型、不重新摘要；
 * - docVersion + docHash 用于判断设计输入是否过期；
 * - 同一应用 + 同一 hash 只保存一份，历史版本保留用于审计/比对；
 * - 覆盖度与 requirementRefs 校验都在这里做纯函数计算。
 */
import crypto from 'node:crypto'
import { db, nowIso } from '../db'
import { activeChangeSetRow } from '../changesets/query'
import { ensureRequirementDoc, outlineOfSections } from '../requirements/doc'
import { defaultModule, latestRequirementBundle, moduleOrThrow, resolveModule, type ModuleRow } from '../requirements/modules'
import {
  emptyOutline,
  mergeOutline,
  rebuildOutlineSection
} from '../requirements/outline'
import type {
  RequirementDocPayload,
  RequirementDocSection,
  RequirementOutlineData
} from '../requirements/types'
import type {
  DesignCoverage,
  DesignCoverageItem,
  DesignEntity,
  DesignInputBundle,
  DesignInputDiff,
  DesignInputDiffEntry,
  DesignInputDiffGroup,
  DesignInputEpic,
  DesignInputGlossaryItem,
  DesignInputQuestion,
  DesignInputRole,
  DesignInputScene,
  DesignInputStory,
  DesignInputStructure,
  DesignInputSummary,
  DesignPageSet,
  DesignStaleState
} from './types'

interface InputRow {
  id: string
  app_id: string
  module_id: string
  doc_version: number
  doc_hash: string
  template_id: string
  input_json: string
  structure: string
  created_at: string
}

/** 显式 moduleId → 必须存在（404）；缺省 → 默认模块（懒创建，设计写入需要） */
function moduleForInput(appId: string, moduleId?: string): ModuleRow {
  return resolveModule(appId, moduleId)
}

/** 只读查询：缺省默认模块（不创建）；无模块返回 undefined */
function readOnlyModule(appId: string, moduleId?: string): ModuleRow | undefined {
  const requested = typeof moduleId === 'string' ? moduleId.trim() : ''
  if (requested) return moduleOrThrow(appId, requested)
  return defaultModule(appId)
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function sectionOfKind(payload: RequirementDocPayload, kind: string): RequirementDocSection | undefined {
  return payload.sections.find(section => section.kind === kind)
}

/** 旧文档/空结构：用确定性解析补出 Scene/Epic/Story（不写回数据库） */
function fallbackOutline(sections: RequirementDocSection[]): { outline: RequirementOutlineData; warnings: string[] } {
  const warnings: string[] = []
  let outline = outlineOfSections(sections)
  const epicsSection = sections.find(section => section.kind === 'epics')
  const scenesSection = sections.find(section => section.kind === 'scenes')

  // 部分结构化（例如只建了 Epics）：缺失的一侧仍可从 Markdown 确定性解析
  if (!outline.scenes.length && scenesSection?.markdown.trim()) {
    const rebuilt = rebuildOutlineSection('scenes', scenesSection.markdown, null, outline)
    outline = mergeOutline([outline, rebuilt.data])
  }
  if (!outline.epics.length && epicsSection?.markdown.trim()) {
    const rebuilt = rebuildOutlineSection('epics', epicsSection.markdown, null, outline)
    outline = mergeOutline([outline, rebuilt.data])
  }

  if (!outline.epics.length && !outline.scenes.length) {
    // 非 PRD 模板：用页面/目标/问题章节的标题/列表项作为设计单元
    for (const kind of ['pages', 'goals', 'problem'] as const) {
      const section = sections.find(item => item.kind === kind && item.markdown.trim())
      if (!section) continue
      const rebuilt = rebuildOutlineSection('scenes', section.markdown, null, outline)
      const scenes = rebuilt.data.scenes.filter(scene => !scene.archived)
      if (scenes.length) {
        outline = mergeOutline([outline, { scenes, epics: [], stories: [] }])
        break
      }
    }
  }
  return { outline, warnings }
}

const ROLE_LINE = /^\s*(?:[-*+]|\d+\.)\s+\**([^*：:|]{1,40})\**\s*[：:|]\s*(.*)$/
const QUESTION_LINE = /^\s*(?:[-*+]|\d+\.)\s+(.+)$/

/** 角色：`- 销售：维护客户` / `| 销售 | 维护客户 |` */
function parseRoles(markdown: string): DesignInputRole[] {
  const roles: DesignInputRole[] = []
  const seen = new Set<string>()
  const push = (name: string, description: string): void => {
    const clean = name.replace(/[*`]/g, '').trim()
    if (!clean || clean.length > 40 || seen.has(clean)) return
    seen.add(clean)
    roles.push({ id: `ROLE-${String(roles.length + 1).padStart(3, '0')}`, name: clean, description: description.trim() })
  }
  for (const line of String(markdown ?? '').split('\n')) {
    const bullet = ROLE_LINE.exec(line)
    if (bullet) {
      push(bullet[1], bullet[2])
      continue
    }
    const table = /^\s*\|([^|]+)\|([^|]+)\|/.exec(line)
    if (table && !/^\s*\|?\s*-{2,}/.test(line)) push(table[1], table[2])
    const heading = /^#{3,4}\s+(.+)$/.exec(line)
    if (heading) push(heading[1], '')
  }
  return roles
}

function parseQuestions(markdown: string): DesignInputQuestion[] {
  const questions: DesignInputQuestion[] = []
  for (const line of String(markdown ?? '').split('\n')) {
    const bullet = QUESTION_LINE.exec(line)
    if (!bullet) continue
    const text = bullet[1]
      .replace(/^(?:待确认|待澄清|TODO)\s*[：:]\s*/i, '')
      .replace(/^\[[ xX]\]\s*/, '')
      .trim()
    if (!text) continue
    questions.push({ id: `Q-${String(questions.length + 1).padStart(3, '0')}`, question: text.slice(0, 300) })
  }
  return questions
}

function parseGlossary(markdown: string): DesignInputGlossaryItem[] {
  const items: DesignInputGlossaryItem[] = []
  const seen = new Set<string>()
  const push = (term: string, definition: string): void => {
    const clean = term.replace(/[*`]/g, '').trim()
    if (!clean || seen.has(clean)) return
    seen.add(clean)
    items.push({ term: clean.slice(0, 60), definition: definition.trim().slice(0, 300) })
  }
  for (const line of String(markdown ?? '').split('\n')) {
    const bullet = ROLE_LINE.exec(line)
    if (bullet) {
      push(bullet[1], bullet[2])
      continue
    }
    const table = /^\s*\|([^|]+)\|([^|]+)\|/.exec(line)
    if (table && !/^\s*\|?\s*-{2,}/.test(line)) push(table[1], table[2])
  }
  return items
}

/** 构建 DesignInputBundle：确定性、不调用 LLM（按模块只读该模块需求文档） */
export function buildDesignInput(appId: string, moduleId?: string): DesignInputBundle {
  const module = moduleForInput(appId, moduleId)
  const payload = ensureRequirementDoc(appId, undefined, module.id)
  const fallback = fallbackOutline(payload.sections)
  const outline = fallback.outline
  const warnings = [...fallback.warnings]

  const scenes: DesignInputScene[] = outline.scenes
    .filter(item => !item.archived)
    .map((scene, index) => ({
      id: scene.id,
      title: scene.title,
      description: scene.description,
      position: index
    }))

  const stories: DesignInputStory[] = outline.stories
    .filter(item => !item.archived)
    .map((story, index) => ({
      id: story.id,
      epicId: story.epicId,
      title: story.title,
      description: story.description,
      acceptance: story.acceptance,
      priority: story.priority,
      position: index
    }))

  const epics: DesignInputEpic[] = outline.epics
    .filter(item => !item.archived)
    .map((epic, index) => ({
      id: epic.id,
      title: epic.title,
      goal: epic.goal,
      priority: epic.priority,
      sceneId: epic.sceneId,
      position: index,
      stories: stories.filter(story => story.epicId === epic.id)
    }))

  const usersSection = sectionOfKind(payload, 'roles')
  const roles = parseRoles(usersSection?.markdown ?? '')
  const rulesSection = sectionOfKind(payload, 'rules')
  const pagesSection = sectionOfKind(payload, 'pages')
  const nfrSection = sectionOfKind(payload, 'nfr')
  const issuesSection = sectionOfKind(payload, 'issues')
  const glossarySection = sectionOfKind(payload, 'glossary')

  const openQuestions = parseQuestions(issuesSection?.markdown ?? '')
  const glossary = parseGlossary(glossarySection?.markdown ?? '')
  const scenesSection = sectionOfKind(payload, 'scenes')
  const hasEpicHeadings = /^###\s+\S/m.test(sectionOfKind(payload, 'epics')?.markdown ?? '')
  const hasSceneHeadings =
    /^###\s+\S/m.test(scenesSection?.markdown ?? '') || /^\s*[-*+]\s+\*\*\S/m.test(scenesSection?.markdown ?? '')
  const explicitStructure = outlineOfSections(payload.sections)
  const structure: DesignInputStructure =
    explicitStructure.scenes.length > 0 || explicitStructure.epics.length > 0 || hasEpicHeadings || hasSceneHeadings
      ? 'prd'
      : 'fallback'
  if (structure === 'fallback') {
    if (outline.epics.length || outline.scenes.length) {
      warnings.push('需求文档不是标准 PRD 结构：设计输入已回退到 Scene/章节；建议补充 Epics/Stories')
    } else {
      warnings.push('需求文档没有可用于设计的场景/Epic/章节，请补充 Epics & User Stories')
    }
  }

  const docHash = sha256(
    [
      String(payload.doc.version),
      payload.doc.contentMd,
      JSON.stringify({ scenes, epics, stories, roles, openQuestions, glossary })
    ].join('\n')
  )
  // M5 设计输入 v2：引用最近一次落库的需求聚合 bundle（只读；没有快照时为 null）
  const bundle = latestRequirementBundle(appId)

  return {
    id: `din-${sha256(appId).slice(0, 6)}-${module.module_key}-${payload.doc.version}-${docHash.slice(0, 10)}`,
    appId,
    moduleId: module.id,
    moduleKey: module.module_key,
    moduleTitle: module.title,
    docVersion: payload.doc.version,
    docHash,
    bundleVersion: bundle?.version ?? null,
    bundleHash: bundle?.hash ?? null,
    templateId: payload.template.id,
    templateName: payload.template.name,
    confirmedAt: payload.doc.confirmedAt,
    structure,
    scenes,
    epics,
    stories,
    roles,
    dataRules: { sectionKey: rulesSection?.sectionKey ?? '', markdown: rulesSection?.markdown ?? '' },
    pageRequirements: { sectionKey: pagesSection?.sectionKey ?? '', markdown: pagesSection?.markdown ?? '' },
    nonFunctionals: { sectionKey: nfrSection?.sectionKey ?? '', markdown: nfrSection?.markdown ?? '' },
    openQuestions,
    glossary,
    warnings,
    createdAt: nowIso()
  }
}

function rowToBundle(row: InputRow): DesignInputBundle {
  const parsed = JSON.parse(row.input_json) as DesignInputBundle
  return {
    ...parsed,
    id: row.id,
    appId: row.app_id,
    moduleId: row.module_id,
    moduleKey: parsed.moduleKey ?? '',
    moduleTitle: parsed.moduleTitle ?? '',
    docVersion: row.doc_version,
    docHash: row.doc_hash,
    bundleVersion: typeof parsed.bundleVersion === 'number' ? parsed.bundleVersion : null,
    bundleHash: typeof parsed.bundleHash === 'string' ? parsed.bundleHash : null,
    templateId: row.template_id,
    structure: row.structure === 'fallback' ? 'fallback' : 'prd',
    createdAt: row.created_at
  }
}

/** 保存（同模块 + 同 hash 复用）并返回设计输入；复用时同步 bundle 字段与变更单归属 */
export function persistDesignInput(appId: string, bundle: DesignInputBundle, moduleId?: string): DesignInputBundle {
  const targetModuleId = typeof moduleId === 'string' && moduleId.trim() ? moduleId.trim() : bundle.moduleId
  if (!targetModuleId) throw new Error('设计输入缺少 moduleId')
  const existing = db
    .prepare('SELECT * FROM app_design_inputs WHERE app_id = ? AND module_id = ? AND doc_hash = ?')
    .get(appId, targetModuleId, bundle.docHash) as InputRow | undefined
  const changeSetId = activeChangeSetRow(appId)?.id ?? null
  if (existing) {
    // M5：文档内容未变时复用输入行（保留 id/docVersion），只把 bundle 元信息与变更单归属更新到最新
    const parsed = JSON.parse(existing.input_json) as DesignInputBundle
    const nextJson = JSON.stringify({
      ...parsed,
      moduleId: targetModuleId,
      bundleVersion: bundle.bundleVersion,
      bundleHash: bundle.bundleHash
    })
    db.prepare('UPDATE app_design_inputs SET input_json = ?, change_set_id = ? WHERE id = ?').run(
      nextJson,
      changeSetId,
      existing.id
    )
    const row = db.prepare('SELECT * FROM app_design_inputs WHERE id = ?').get(existing.id) as InputRow | undefined
    return row ? rowToBundle(row) : { ...bundle, moduleId: targetModuleId }
  }
  db.prepare(`
    INSERT INTO app_design_inputs (id, app_id, module_id, doc_version, doc_hash, template_id, input_json, structure, change_set_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bundle.id,
    appId,
    targetModuleId,
    bundle.docVersion,
    bundle.docHash,
    bundle.templateId,
    JSON.stringify({ ...bundle, moduleId: targetModuleId }),
    bundle.structure,
    changeSetId,
    bundle.createdAt
  )
  const row = db.prepare('SELECT * FROM app_design_inputs WHERE id = ?').get(bundle.id) as InputRow | undefined
  return row ? rowToBundle(row) : { ...bundle, moduleId: targetModuleId }
}

/** 生成/复用当前模块需求文档对应的设计输入 */
export function latestDesignInput(appId: string, moduleId?: string): DesignInputBundle {
  const module = moduleForInput(appId, moduleId)
  return persistDesignInput(appId, buildDesignInput(appId, module.id), module.id)
}

export function readDesignInput(appId: string, inputId: string, moduleId?: string): DesignInputBundle | null {
  const module = readOnlyModule(appId, moduleId)
  if (!module) return null
  const row = db
    .prepare('SELECT * FROM app_design_inputs WHERE app_id = ? AND module_id = ? AND id = ?')
    .get(appId, module.id, inputId) as InputRow | undefined
  return row ? rowToBundle(row) : null
}

export function listDesignInputs(appId: string, moduleId?: string): DesignInputSummary[] {
  const module = readOnlyModule(appId, moduleId)
  if (!module) return []
  const rows = db
    .prepare(
      'SELECT * FROM app_design_inputs WHERE app_id = ? AND module_id = ? ORDER BY doc_version DESC, created_at DESC'
    )
    .all(appId, module.id) as InputRow[]
  return rows.map(row => summaryOf(rowToBundle(row)))
}

export function summaryOf(bundle: DesignInputBundle): DesignInputSummary {
  return {
    id: bundle.id,
    docVersion: bundle.docVersion,
    docHash: bundle.docHash,
    structure: bundle.structure,
    sceneCount: bundle.scenes.length,
    epicCount: bundle.epics.length,
    storyCount: bundle.stories.length,
    createdAt: bundle.createdAt
  }
}

export function computeStale(
  input: DesignInputBundle | null,
  current: DesignInputBundle,
  latest: DesignInputBundle,
  latestBundleHash?: string | null
): DesignStaleState {
  const bundleDrift = Boolean(input && latestBundleHash && input.bundleHash !== latestBundleHash)
  if (!input) {
    return {
      stale: false,
      designDocVersion: null,
      latestDocVersion: current.docVersion,
      latestInputId: latest.id,
      reason: '设计项目还没有绑定需求输入',
      bundleDrift
    }
  }
  // M5：stale 只比**同模块**需求文档 hash；bundle 变化只提示（bundleDrift），不让设计过期
  const stale = input.docHash !== current.docHash
  return {
    stale,
    designDocVersion: input.docVersion,
    latestDocVersion: current.docVersion,
    latestInputId: latest.id,
    reason: stale ? `需求文档已更新（v${input.docVersion} → v${current.docVersion}），设计输入需要同步` : '',
    bundleDrift
  }
}

/** 需求条目有效引用集合 */
export function validRefsOf(input: DesignInputBundle | null): Set<string> {
  const refs = new Set<string>()
  if (!input) return refs
  for (const scene of input.scenes) refs.add(scene.id)
  for (const epic of input.epics) refs.add(epic.id)
  for (const story of input.stories) refs.add(story.id)
  for (const role of input.roles) refs.add(role.id)
  for (const question of input.openQuestions) refs.add(question.id)
  return refs
}

/** requirementRefs / epicId / storyIds 校验：返回 warnings，不静默丢弃 */
export function requirementRefWarnings(
  input: DesignInputBundle | null,
  entities: DesignEntity[],
  pageSets: DesignPageSet[]
): string[] {
  if (!input) return entities.length || pageSets.length ? ['设计输入不存在，实体/页面无法追溯需求条目'] : []
  const refs = validRefsOf(input)
  const warnings: string[] = []
  for (const entity of entities) {
    for (const ref of entity.requirementRefs) {
      if (!refs.has(ref)) warnings.push(`实体「${entity.name}」引用了不存在的需求条目：${ref}`)
    }
  }
  for (const set of pageSets) {
    if (set.epicId && !refs.has(set.epicId)) warnings.push(`页面集「${set.title}」引用了不存在的 Epic：${set.epicId}`)
    for (const storyId of set.storyIds) {
      if (!refs.has(storyId)) warnings.push(`页面集「${set.title}」引用了不存在的 Story：${storyId}`)
    }
    for (const page of set.pages) {
      for (const ref of page.requirementRefs) {
        if (!refs.has(ref)) warnings.push(`页面「${page.title}」引用了不存在的需求条目：${ref}`)
      }
    }
  }
  return warnings
}

function itemRefsMatch(item: { requirementRefs: string[] }, id: string): boolean {
  return item.requirementRefs.includes(id)
}

/** 覆盖度：Story/Epic/Scene → 实体/页面集/页面；只警告，不阻塞 */
export function computeCoverage(
  input: DesignInputBundle | null,
  entities: DesignEntity[],
  pageSets: DesignPageSet[]
): DesignCoverage {
  const emptyStats = { sceneCount: 0, epicCount: 0, storyCount: 0, coveredStoryCount: 0 }
  if (!input) {
    return {
      inputId: null,
      docVersion: null,
      structure: 'fallback',
      scenes: [],
      epics: [],
      stories: [],
      unlinkedEntities: entities.map(entity => ({ id: entity.id, name: entity.name })),
      unlinkedPages: pageSets.flatMap(set => set.pages.map(page => ({ id: page.id, title: page.title, pageSetId: set.id }))),
      warnings: ['还没有设计输入，无法计算需求覆盖度'],
      stats: emptyStats
    }
  }

  const pages = pageSets.flatMap(set => set.pages.map(page => ({ page, set })))
  const entityIdsForRef = (id: string): string[] =>
    entities.filter(entity => itemRefsMatch(entity, id)).map(entity => entity.id)
  const pageEntriesForRef = (id: string): Array<{ pageId: string; pageSetId: string }> =>
    pages
      .filter(({ page, set }) => itemRefsMatch(page, id) || set.epicId === id || set.storyIds.includes(id))
      .map(({ page, set }) => ({ pageId: page.id, pageSetId: set.id }))

  const buildItem = (kind: DesignCoverageItem['kind'], id: string, title: string, parentId: string | null): DesignCoverageItem => {
    const pageEntries = pageEntriesForRef(id)
    const entityIds = entityIdsForRef(id)
    return {
      kind,
      id,
      title,
      parentId,
      entityIds,
      pageSetIds: Array.from(new Set(pageEntries.map(item => item.pageSetId))),
      pageIds: Array.from(new Set(pageEntries.map(item => item.pageId))),
      covered: entityIds.length > 0 || pageEntries.length > 0
    }
  }

  const stories = input.stories.map(story => buildItem('story', story.id, story.title, story.epicId))
  const epics = input.epics.map(epic => {
    const storyItems = stories.filter(story => story.parentId === epic.id)
    const own = buildItem('epic', epic.id, epic.title, epic.sceneId)
    return {
      ...own,
      entityIds: Array.from(new Set([...own.entityIds, ...storyItems.flatMap(item => item.entityIds)])),
      pageSetIds: Array.from(new Set([...own.pageSetIds, ...storyItems.flatMap(item => item.pageSetIds)])),
      pageIds: Array.from(new Set([...own.pageIds, ...storyItems.flatMap(item => item.pageIds)])),
      covered: own.covered || storyItems.some(item => item.covered)
    }
  })
  const scenes = input.scenes.map(scene => {
    const epicItems = epics.filter(epic => epic.parentId === scene.id)
    const own = buildItem('scene', scene.id, scene.title, null)
    return {
      ...own,
      entityIds: Array.from(new Set([...own.entityIds, ...epicItems.flatMap(item => item.entityIds)])),
      pageSetIds: Array.from(new Set([...own.pageSetIds, ...epicItems.flatMap(item => item.pageSetIds)])),
      pageIds: Array.from(new Set([...own.pageIds, ...epicItems.flatMap(item => item.pageIds)])),
      covered: own.covered || epicItems.some(item => item.covered)
    }
  })

  const unlinkedEntities = entities
    .filter(entity => !entity.requirementRefs.length)
    .map(entity => ({ id: entity.id, name: entity.name }))
  const unlinkedPages = pages
    .filter(({ page }) => !page.requirementRefs.length)
    .map(({ page, set }) => ({ id: page.id, title: page.title, pageSetId: set.id }))

  const warnings: string[] = []
  for (const story of stories) {
    if (!story.covered) warnings.push(`${story.id}「${story.title}」没有对应实体或页面`)
  }
  for (const entity of unlinkedEntities) warnings.push(`实体「${entity.name}」没有需求依据（requirementRefs 为空）`)
  for (const page of unlinkedPages) warnings.push(`页面「${page.title}」没有需求依据（requirementRefs 为空）`)

  return {
    inputId: input.id,
    docVersion: input.docVersion,
    structure: input.structure,
    scenes,
    epics,
    stories,
    unlinkedEntities,
    unlinkedPages,
    warnings,
    stats: {
      sceneCount: scenes.length,
      epicCount: epics.length,
      storyCount: stories.length,
      coveredStoryCount: stories.filter(story => story.covered).length
    }
  }
}

function entryOf(id: string, title: string, changes: string[] = []): DesignInputDiffEntry {
  return { id, title, changes }
}

function diffGroup(
  prev: Array<{ id: string; title: string }>,
  next: Array<{ id: string; title: string }>,
  changesOf: (id: string) => string[]
): DesignInputDiffGroup {
  const prevMap = new Map(prev.map(item => [item.id, item]))
  const nextMap = new Map(next.map(item => [item.id, item]))
  const added: DesignInputDiffEntry[] = []
  const removed: DesignInputDiffEntry[] = []
  const changed: DesignInputDiffEntry[] = []
  for (const item of next) {
    if (!prevMap.has(item.id)) added.push(entryOf(item.id, item.title))
    else {
      const changes = changesOf(item.id)
      if (changes.length) changed.push(entryOf(item.id, item.title, changes))
    }
  }
  for (const item of prev) if (!nextMap.has(item.id)) removed.push(entryOf(item.id, item.title))
  return { added, removed, changed }
}

function storyChanges(prev: DesignInputStory, next: DesignInputStory): string[] {
  const changes: string[] = []
  if (prev.title !== next.title) changes.push('标题')
  if (prev.description !== next.description) changes.push('描述')
  if (prev.priority !== next.priority) changes.push('优先级')
  if (prev.epicId !== next.epicId) changes.push('所属 Epic')
  if (prev.acceptance.join('\n') !== next.acceptance.join('\n')) changes.push('验收标准')
  return changes
}

/** 两个设计输入之间的确定性 diff（新增/删除/修改） */
export function diffDesignInputs(prev: DesignInputBundle, next: DesignInputBundle): DesignInputDiff {
  const prevEpicMap = new Map(prev.epics.map(item => [item.id, item]))
  const nextEpicMap = new Map(next.epics.map(item => [item.id, item]))
  const prevStoryMap = new Map(prev.stories.map(item => [item.id, item]))
  const nextStoryMap = new Map(next.stories.map(item => [item.id, item]))

  const scenes = diffGroup(prev.scenes, next.scenes, id => {
    const before = prev.scenes.find(item => item.id === id)
    const after = next.scenes.find(item => item.id === id)
    if (!before || !after) return []
    const changes: string[] = []
    if (before.title !== after.title) changes.push('标题')
    if (before.description !== after.description) changes.push('描述')
    return changes
  })
  const epics = diffGroup(prev.epics, next.epics, id => {
    const before = prevEpicMap.get(id)
    const after = nextEpicMap.get(id)
    if (!before || !after) return []
    const changes: string[] = []
    if (before.title !== after.title) changes.push('标题')
    if (before.goal !== after.goal) changes.push('目标')
    if (before.priority !== after.priority) changes.push('优先级')
    if (before.sceneId !== after.sceneId) changes.push('所属场景')
    return changes
  })
  const stories = diffGroup(prev.stories, next.stories, id => {
    const before = prevStoryMap.get(id)
    const after = nextStoryMap.get(id)
    return before && after ? storyChanges(before, after) : []
  })

  return {
    scenes,
    epics,
    stories,
    totals: {
      added: scenes.added.length + epics.added.length + stories.added.length,
      removed: scenes.removed.length + epics.removed.length + stories.removed.length,
      changed: scenes.changed.length + epics.changed.length + stories.changed.length
    }
  }
}

/** 引用失效：从集合里剔除未知 ID（保留合法引用） */
export function filterRefs(refs: string[], valid: Set<string>): string[] {
  return refs.filter(ref => valid.has(ref))
}
