/**
 * `05-CHANGES.md` 真实 diff（C1，确定性，不调用模型）
 *
 * 输入 = 变更单基线快照 + 当前设计/需求；输出 = 新增/修改/删除清单、影响提示、
 * 删除/迁移提示、增量实现要求（Markdown），以及给 manifest/summary_json 用的计数。
 *
 * 约束：
 * - 只输出业务名称/表名/页面标题与需求稳定 ID（SCENE/EPIC/STORY），
 *   **不输出工作台内部 ID**（实体/页面/页面集 id）；
 * - 删除项只给清单与迁移要求，不自动删代码/数据库（D5/迭代方案边界）。
 */
import { diffDesignInputs } from '../design/input'
import type {
  DesignEntity,
  DesignField,
  DesignInputBundle,
  DesignItemStatus,
  DesignPage,
  DesignPageSet,
  DesignRelation
} from '../design/types'

export interface DesignChangeBaseline {
  /** 基线需求输入（来自 app_design_inputs.input_json；缺失时为 null） */
  requirements: DesignInputBundle | null
  docVersion: number | null
  docHash: string | null
  designVersion: number | null
  templateHash: string | null
  entities: DesignEntity[]
  pageSets: DesignPageSet[]
}

export interface DesignChangeCurrent {
  requirements: DesignInputBundle
  docVersion: number
  docHash: string
  designVersion: number
  templateHash: string
  entities: DesignEntity[]
  pageSets: DesignPageSet[]
}

export interface DesignChangeInput {
  changeSet: {
    seq: number
    title: string
    scope: string
    status: string
    description: string
    baselineHandoffVersion: number | null
    currentHandoffVersion: number | null
  }
  baseline: DesignChangeBaseline
  current: DesignChangeCurrent
}

export interface DesignChangeCounts {
  added: number
  modified: number
  removed: number
  total: number
}

export interface DesignChangeSummary {
  requirements: {
    docVersionFrom: number | null
    docVersionTo: number
    docHashChanged: boolean
    scenes: { added: number; modified: number; removed: number }
    epics: { added: number; modified: number; removed: number }
    stories: { added: number; modified: number; removed: number }
  }
  design: {
    designVersionFrom: number | null
    designVersionTo: number
    entities: { added: number; modified: number; removed: number }
    fields: { added: number; modified: number; removed: number }
    relations: { added: number; modified: number; removed: number }
    pageSets: { added: number; modified: number; removed: number }
    pages: { added: number; modified: number; removed: number }
    templateChanged: boolean
    templateHashFrom: string | null
    templateHashTo: string
  }
  deleted: string[]
  counts: DesignChangeCounts
}

export interface DesignChangeReport {
  markdown: string
  counts: DesignChangeCounts
  summary: DesignChangeSummary
}

function shortHash(value: string | null | undefined): string {
  if (!value) return '—'
  return value.length > 12 ? `${value.slice(0, 12)}…` : value
}

function bullet(items: string[]): string {
  if (!items.length) return '（无）'
  return items.map(item => `- ${item}`).join('\n')
}

function normalizeValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function fieldSignature(field: DesignField): string {
  return [
    field.name,
    field.label,
    field.type,
    field.required ? '1' : '0',
    field.unique ? '1' : '0',
    normalizeValue(field.default),
    (field.options ?? []).join('/'),
    field.ref ?? '',
    normalizeValue(field.length),
    normalizeValue(field.precision),
    field.note ?? ''
  ].join('|')
}

/** 字段差异（按 name 匹配，忽略顺序） */
function diffFields(
  before: DesignField[],
  after: DesignField[]
): { added: DesignField[]; removed: DesignField[]; modified: Array<{ field: DesignField; changes: string[] }> } {
  const beforeMap = new Map(before.map(field => [field.name, field]))
  const afterMap = new Map(after.map(field => [field.name, field]))
  const added = after.filter(field => !beforeMap.has(field.name))
  const removed = before.filter(field => !afterMap.has(field.name))
  const modified: Array<{ field: DesignField; changes: string[] }> = []
  for (const field of after) {
    const old = beforeMap.get(field.name)
    if (!old) continue
    if (fieldSignature(old) === fieldSignature(field)) continue
    const changes: string[] = []
    if (old.label !== field.label) changes.push('标签')
    if (old.type !== field.type) changes.push('类型')
    if (Boolean(old.required) !== Boolean(field.required)) changes.push('必填')
    if (Boolean(old.unique) !== Boolean(field.unique)) changes.push('唯一')
    if (normalizeValue(old.default) !== normalizeValue(field.default)) changes.push('默认值')
    if ((old.options ?? []).join('/') !== (field.options ?? []).join('/')) changes.push('枚举选项')
    if ((old.ref ?? '') !== (field.ref ?? '')) changes.push('引用')
    if (normalizeValue(old.length) !== normalizeValue(field.length)) changes.push('长度')
    if (normalizeValue(old.precision) !== normalizeValue(field.precision)) changes.push('精度')
    if ((old.note ?? '') !== (field.note ?? '')) changes.push('备注')
    if (!changes.length) changes.push('定义')
    modified.push({ field, changes })
  }
  return { added, removed, modified }
}

function relationSignature(relation: DesignRelation): string {
  return [
    relation.name,
    relation.type,
    relation.target,
    relation.sourceField ?? '',
    relation.targetField ?? '',
    relation.description ?? ''
  ].join('|')
}

function diffRelations(
  before: DesignRelation[],
  after: DesignRelation[]
): { added: DesignRelation[]; removed: DesignRelation[]; modified: DesignRelation[] } {
  const keyOf = (relation: DesignRelation): string => `${relation.name}::${relation.target}`
  const beforeMap = new Map(before.map(relation => [keyOf(relation), relation]))
  const afterMap = new Map(after.map(relation => [keyOf(relation), relation]))
  const added = after.filter(relation => !beforeMap.has(keyOf(relation)))
  const removed = before.filter(relation => !afterMap.has(keyOf(relation)))
  const modified = after.filter(relation => {
    const old = beforeMap.get(keyOf(relation))
    return old ? relationSignature(old) !== relationSignature(relation) : false
  })
  return { added, removed, modified }
}

interface MatchedEntity {
  before?: DesignEntity
  after?: DesignEntity
}

function matchEntities(baseline: DesignEntity[], current: DesignEntity[]): MatchedEntity[] {
  const beforeById = new Map(baseline.map(entity => [entity.id, entity]))
  const beforeByTable = new Map(baseline.map(entity => [entity.tableName, entity]))
  const matched: MatchedEntity[] = []
  const usedBefore = new Set<string>()
  for (const after of current) {
    const before = beforeById.get(after.id) ?? beforeByTable.get(after.tableName)
    if (before) usedBefore.add(before.id)
    matched.push({ before, after })
  }
  for (const before of baseline) {
    if (usedBefore.has(before.id)) continue
    matched.push({ before })
  }
  return matched
}

interface MatchedPageSet {
  before?: DesignPageSet
  after?: DesignPageSet
}

function matchPageSets(baseline: DesignPageSet[], current: DesignPageSet[]): MatchedPageSet[] {
  const beforeById = new Map(baseline.map(set => [set.id, set]))
  const beforeByTitle = new Map(baseline.map(set => [set.title, set]))
  const matched: MatchedPageSet[] = []
  const usedBefore = new Set<string>()
  for (const after of current) {
    const before = beforeById.get(after.id) ?? beforeByTitle.get(after.title)
    if (before) usedBefore.add(before.id)
    matched.push({ before, after })
  }
  for (const before of baseline) {
    if (usedBefore.has(before.id)) continue
    matched.push({ before })
  }
  return matched
}

function pageSignature(page: DesignPage): string {
  return JSON.stringify({
    title: page.title,
    type: page.type,
    requirementRefs: [...page.requirementRefs].sort(),
    spec: page.spec,
    layout: {
      table: page.layout.table ?? null,
      toolbar: page.layout.toolbar ?? null,
      detail: page.layout.detail ?? null,
      groupMode: page.layout.groupMode ?? null
    }
  })
}

function pageKey(page: DesignPage): string {
  return `${page.title}::${page.type}`
}

function pageTypeLabel(page: DesignPage): string {
  if (page.type === 'form') {
    if (page.spec.mode === 'create') return '创建表单'
    if (page.spec.mode === 'edit') return '编辑表单'
    return '表单'
  }
  if (page.type === 'list') return '列表'
  if (page.type === 'detail') return '详情'
  return page.type
}

function statusLabel(status: DesignItemStatus): string {
  return status === 'confirmed' ? '已确认' : '草稿'
}

function entityLabel(entity: DesignEntity): string {
  const table = entity.tableName ? `（表 \`${entity.tableName}\`）` : ''
  return `「${entity.name}」${table}`
}

function pageSetLabel(set: DesignPageSet): string {
  return `「${set.title}」`
}

function isArchivedRef(id: string, input: DesignInputBundle | null): boolean {
  if (!input) return false
  const match =
    input.scenes.find(scene => scene.id === id) ??
    input.epics.find(epic => epic.id === id) ??
    input.stories.find(story => story.id === id)
  const archived = (match as { archived?: boolean } | undefined)?.archived
  return archived === true
}

/** 受影响提示：引用被改/删需求条目的实体与页面（用名称/标题，不输出内部 ID） */
function impactedItems(
  changedIds: Set<string>,
  entities: DesignEntity[],
  pageSets: DesignPageSet[]
): { entities: string[]; pages: string[] } {
  if (!changedIds.size) return { entities: [], pages: [] }
  const entityHits = entities
    .filter(entity => entity.requirementRefs.some(ref => changedIds.has(ref)))
    .map(entity => `实体「${entity.name}」引用了 ${entity.requirementRefs.filter(ref => changedIds.has(ref)).join('、')}`)
  const pageHits: string[] = []
  for (const set of pageSets) {
    const setRefs = [set.epicId, ...set.storyIds].filter((ref): ref is string => Boolean(ref))
    for (const page of set.pages) {
      const refs = Array.from(new Set([...page.requirementRefs, ...setRefs])).filter(ref => changedIds.has(ref))
      if (!refs.length) continue
      pageHits.push(`页面「${page.title}」（页面集「${set.title}」）引用了 ${refs.join('、')}`)
    }
  }
  return { entities: entityHits, pages: pageHits }
}

/**
 * 生成变更差异报告（05-CHANGES 的“本次变更”正文 + manifest 计数）。
 * 仅在变更单 seq>1 时调用；seq=1 的初始/同单重新生成文案由 design-render 处理。
 */
export function buildDesignChangeReport(input: DesignChangeInput): DesignChangeReport {
  const { baseline, current, changeSet } = input
  const lines: string[] = []
  const deleted: string[] = []

  const requirementDiff = baseline.requirements ? diffDesignInputs(baseline.requirements, current.requirements) : null
  const changedRequirementIds = new Set<string>()
  if (requirementDiff) {
    for (const group of [requirementDiff.scenes, requirementDiff.epics, requirementDiff.stories]) {
      for (const item of [...group.added, ...group.removed, ...group.changed]) changedRequirementIds.add(item.id)
    }
  }
  // archived=true 的条目视为删除（即便仍在快照里）
  for (const story of current.requirements.stories) {
    if (isArchivedRef(story.id, current.requirements)) changedRequirementIds.add(story.id)
  }

  const docHashChanged = Boolean(baseline.docHash && baseline.docHash !== current.docHash)
  const templateChanged = Boolean(baseline.templateHash && baseline.templateHash !== current.templateHash)

  // ---- 需求差异 ----
  const requirementAdded: string[] = []
  const requirementModified: string[] = []
  const requirementRemoved: string[] = []
  if (requirementDiff) {
    const pushEntries = (
      group: { added: Array<{ id: string; title: string }>; removed: Array<{ id: string; title: string }>; changed: Array<{ id: string; title: string; changes: string[] }> },
      label: string
    ): void => {
      for (const item of group.added) requirementAdded.push(`${label} ${item.id} ${item.title}`)
      for (const item of group.changed) requirementModified.push(`${label} ${item.id} ${item.title}（修改：${item.changes.join('、')}）`)
      for (const item of group.removed) requirementRemoved.push(`${label} ${item.id} ${item.title}`)
    }
    pushEntries(requirementDiff.scenes, 'Scene')
    pushEntries(requirementDiff.epics, 'Epic')
    pushEntries(requirementDiff.stories, 'Story')
    for (const item of requirementDiff.scenes.removed) deleted.push(`需求 Scene ${item.id} ${item.title}`)
    for (const item of requirementDiff.epics.removed) deleted.push(`需求 Epic ${item.id} ${item.title}`)
    for (const item of requirementDiff.stories.removed) deleted.push(`需求 Story ${item.id} ${item.title}`)
  }

  // ---- 设计：实体/字段/关系 ----
  const entityAdded: string[] = []
  const entityModified: string[] = []
  const entityRemoved: string[] = []
  let fieldsAdded = 0
  let fieldsRemoved = 0
  let fieldsModified = 0
  let relationsAdded = 0
  let relationsRemoved = 0
  let relationsModified = 0

  const entityNameById = new Map(baseline.entities.map(entity => [entity.id, entity.name]))
  const currentEntityNameById = new Map(current.entities.map(entity => [entity.id, entity.name]))

  for (const pair of matchEntities(baseline.entities, current.entities)) {
    if (!pair.before && pair.after) {
      entityAdded.push(`${entityLabel(pair.after)}`)
      fieldsAdded += pair.after.fields.length
      continue
    }
    if (pair.before && !pair.after) {
      entityRemoved.push(`${entityLabel(pair.before)}`)
      deleted.push(`实体「${pair.before.name}」${pair.before.tableName ? `（表 \`${pair.before.tableName}\`）` : ''}`)
      for (const field of pair.before.fields) {
        deleted.push(`字段 \`${pair.before.tableName || pair.before.name}.${field.name}\``)
      }
      continue
    }
    if (!pair.before || !pair.after) continue
    const before = pair.before
    const after = pair.after
    const changes: string[] = []
    if (before.name !== after.name) changes.push(`名称：${before.name} → ${after.name}`)
    if (before.tableName !== after.tableName) {
      changes.push(`表名：\`${before.tableName}\` → \`${after.tableName}\``)
      deleted.push(`表 \`${before.tableName}\`（实体改名为 \`${after.tableName}\`，需迁移数据）`)
    }
    if (before.description !== after.description) changes.push('说明')
    if (before.status !== after.status) changes.push(`状态：${statusLabel(before.status)} → ${statusLabel(after.status)}`)

    const fields = diffFields(before.fields, after.fields)
    fieldsAdded += fields.added.length
    fieldsRemoved += fields.removed.length
    fieldsModified += fields.modified.length
    if (fields.added.length) changes.push(`新增字段：${fields.added.map(field => `\`${field.name}\``).join('、')}`)
    if (fields.removed.length) {
      changes.push(`删除字段：${fields.removed.map(field => `\`${field.name}\``).join('、')}`)
      for (const field of fields.removed) deleted.push(`字段 \`${after.tableName || after.name}.${field.name}\``)
    }
    if (fields.modified.length) {
      changes.push(`修改字段：${fields.modified.map(item => `\`${item.field.name}\`（${item.changes.join('/')}）`).join('、')}`)
    }

    const relations = diffRelations(before.relations, after.relations)
    relationsAdded += relations.added.length
    relationsRemoved += relations.removed.length
    relationsModified += relations.modified.length
    const relationLabel = (relation: DesignRelation): string => {
      const targetName =
        currentEntityNameById.get(relation.target) ?? entityNameById.get(relation.target) ?? '（已删除实体）'
      return `${relation.name} → ${targetName}（${relation.type}）`
    }
    if (relations.added.length) changes.push(`新增关系：${relations.added.map(relationLabel).join('、')}`)
    if (relations.removed.length) changes.push(`删除关系：${relations.removed.map(relationLabel).join('、')}`)
    if (relations.modified.length) changes.push(`修改关系：${relations.modified.map(relationLabel).join('、')}`)

    if (changes.length) entityModified.push(`${entityLabel(after)}：${changes.join('；')}`)
  }

  // ---- 设计：页面集/页面 ----
  const pageSetAdded: string[] = []
  const pageSetModified: string[] = []
  const pageSetRemoved: string[] = []
  const pageAdded: string[] = []
  const pageModified: string[] = []
  const pageRemoved: string[] = []

  for (const pair of matchPageSets(baseline.pageSets, current.pageSets)) {
    if (!pair.before && pair.after) {
      pageSetAdded.push(`${pageSetLabel(pair.after)}${pair.after.description ? `：${pair.after.description}` : ''}`)
      for (const page of pair.after.pages) pageAdded.push(`${pageTypeLabel(page)}「${page.title}」（页面集${pageSetLabel(pair.after)}）`)
      continue
    }
    if (pair.before && !pair.after) {
      pageSetRemoved.push(pageSetLabel(pair.before))
      deleted.push(`页面集「${pair.before.title}」`)
      for (const page of pair.before.pages) {
        pageRemoved.push(`${pageTypeLabel(page)}「${page.title}」（页面集${pageSetLabel(pair.before)}）`)
        deleted.push(`页面「${page.title}」（页面集「${pair.before.title}」）`)
      }
      continue
    }
    if (!pair.before || !pair.after) continue
    const before = pair.before
    const after = pair.after
    const setChanges: string[] = []
    if (before.title !== after.title) setChanges.push(`标题：${before.title} → ${after.title}`)
    if (before.description !== after.description) setChanges.push('说明')
    if ((before.epicId ?? '') !== (after.epicId ?? '')) setChanges.push(`Epic：${before.epicId ?? '—'} → ${after.epicId ?? '—'}`)
    if (before.storyIds.join(',') !== after.storyIds.join(',')) setChanges.push('覆盖 Story')
    if (before.status !== after.status) setChanges.push(`状态：${statusLabel(before.status)} → ${statusLabel(after.status)}`)
    if (setChanges.length) pageSetModified.push(`${pageSetLabel(after)}：${setChanges.join('；')}`)

    const beforePages = new Map(before.pages.map(page => [page.id, page]))
    const beforePagesByKey = new Map(before.pages.map(page => [pageKey(page), page]))
    const usedBefore = new Set<string>()
    const afterById = new Map(after.pages.map(page => [page.id, page]))
    for (const page of after.pages) {
      const old = beforePages.get(page.id) ?? beforePagesByKey.get(pageKey(page))
      if (old) usedBefore.add(old.id)
      if (!old) {
        pageAdded.push(`${pageTypeLabel(page)}「${page.title}」（页面集${pageSetLabel(after)}）`)
        continue
      }
      if (pageSignature(old) === pageSignature(page)) continue
      const changes: string[] = []
      if (old.title !== page.title) changes.push(`标题：${old.title} → ${page.title}`)
      if (old.type !== page.type) changes.push(`类型：${old.type} → ${page.type}`)
      if ((old.spec.mode ?? '') !== (page.spec.mode ?? '')) changes.push(`表单模式：${old.spec.mode ?? '—'} → ${page.spec.mode ?? '—'}`)
      if (old.requirementRefs.join(',') !== page.requirementRefs.join(',')) changes.push('需求依据')
      if (JSON.stringify(old.spec) !== JSON.stringify(page.spec)) changes.push('页面规格')
      if (JSON.stringify(old.layout) !== JSON.stringify(page.layout)) changes.push('布局')
      if (old.status !== page.status) changes.push(`状态：${statusLabel(old.status)} → ${statusLabel(page.status)}`)
      pageModified.push(`${pageTypeLabel(page)}「${page.title}」（页面集${pageSetLabel(after)}）：${changes.join('；') || '规格调整'}`)
    }
    for (const old of before.pages) {
      if (usedBefore.has(old.id) || afterById.has(old.id)) continue
      pageRemoved.push(`${pageTypeLabel(old)}「${old.title}」（页面集${pageSetLabel(before)}）`)
      deleted.push(`页面「${old.title}」（页面集「${before.title}」）`)
    }
  }

  // ---- 影响提示 ----
  const impacted = impactedItems(changedRequirementIds, current.entities, current.pageSets)

  // ---- Markdown ----
  lines.push('## 1. 变更概览', '')
  lines.push(`- 变更单：#${changeSet.seq} ${changeSet.title}（scope=${changeSet.scope}，status=${changeSet.status}）`)
  if (changeSet.description) lines.push(`- 说明：${changeSet.description}`)
  lines.push(
    `- 基线交接包：${changeSet.baselineHandoffVersion ? `v${changeSet.baselineHandoffVersion}` : '—'} → 当前：v${
      changeSet.currentHandoffVersion ?? '—'
    }`
  )
  lines.push(
    `- 需求文档：${baseline.docVersion ? `v${baseline.docVersion}` : '—'} → v${current.docVersion}${
      docHashChanged ? '（正文有变化）' : '（正文 hash 未变）'
    }`
  )
  lines.push(
    `- 设计：${baseline.designVersion ? `v${baseline.designVersion}` : '—'} → v${current.designVersion}`
  )
  lines.push(
    `- 原型模板：${templateChanged ? '有变化' : '无变化'}（${shortHash(baseline.templateHash)} → ${shortHash(current.templateHash)}）`
  )
  lines.push('')

  lines.push('## 2. 需求变更', '')
  if (!baseline.requirements) {
    lines.push('> 基线需求快照缺失（无法逐条比对）；请以 `01-REQUIREMENTS.md` 全量内容为准。', '')
  }
  lines.push('### 2.1 新增', '', bullet(requirementAdded), '')
  lines.push('### 2.2 修改', '', bullet(requirementModified), '')
  lines.push('### 2.3 删除', '', bullet(requirementRemoved), '')
  if (requirementDiff && !changedRequirementIds.size && docHashChanged) {
    lines.push('需求文档其他章节有更新，请查看 `01-REQUIREMENTS.md`。', '')
  }
  if (requirementDiff && !changedRequirementIds.size && !docHashChanged) {
    lines.push('需求条目与正文均无变化。', '')
  }

  lines.push('## 3. 设计变更', '')
  lines.push('### 3.1 实体', '')
  lines.push(`- 新增：${entityAdded.length ? '' : '（无）'}`)
  for (const item of entityAdded) lines.push(`  - ${item}`)
  lines.push(`- 修改：${entityModified.length ? '' : '（无）'}`)
  for (const item of entityModified) lines.push(`  - ${item}`)
  lines.push(`- 删除：${entityRemoved.length ? '' : '（无）'}`)
  for (const item of entityRemoved) lines.push(`  - ${item}`)
  lines.push('')

  lines.push('### 3.2 表与字段', '')
  if (!fieldsAdded && !fieldsRemoved && !fieldsModified) {
    lines.push('（字段无变化）', '')
  } else {
    lines.push(`- 字段新增 ${fieldsAdded} / 修改 ${fieldsModified} / 删除 ${fieldsRemoved}`)
    lines.push('- 字段级明细见 3.1「修改」与 `02-DATA-MODEL.md`。')
    lines.push('')
  }

  lines.push('### 3.3 关系', '')
  if (!relationsAdded && !relationsRemoved && !relationsModified) {
    lines.push('（关系无变化）', '')
  } else {
    lines.push(`- 关系新增 ${relationsAdded} / 修改 ${relationsModified} / 删除 ${relationsRemoved}`)
    lines.push('')
  }

  lines.push('### 3.4 页面集与页面', '')
  lines.push(`- 页面集新增：${pageSetAdded.length ? '' : '（无）'}`)
  for (const item of pageSetAdded) lines.push(`  - ${item}`)
  lines.push(`- 页面集修改：${pageSetModified.length ? '' : '（无）'}`)
  for (const item of pageSetModified) lines.push(`  - ${item}`)
  lines.push(`- 页面集删除：${pageSetRemoved.length ? '' : '（无）'}`)
  for (const item of pageSetRemoved) lines.push(`  - ${item}`)
  lines.push(`- 页面新增：${pageAdded.length ? '' : '（无）'}`)
  for (const item of pageAdded) lines.push(`  - ${item}`)
  lines.push(`- 页面修改：${pageModified.length ? '' : '（无）'}`)
  for (const item of pageModified) lines.push(`  - ${item}`)
  lines.push(`- 页面删除：${pageRemoved.length ? '' : '（无）'}`)
  for (const item of pageRemoved) lines.push(`  - ${item}`)
  lines.push('')

  lines.push('### 3.5 原型模板', '')
  lines.push(
    templateChanged
      ? `- 模板有变化：hash \`${shortHash(baseline.templateHash)}\` → \`${shortHash(current.templateHash)}\`；请按 \`prototype-template.json\` 更新视觉 Token/Shell/页面模式，并补截受影响的页面原型。`
      : '- 模板无变化；沿用现有视觉实现。'
  )
  lines.push('')

  lines.push('## 4. 影响提示', '')
  if (!impacted.entities.length && !impacted.pages.length) {
    lines.push('（无引用被改/删需求条目的实体或页面）', '')
  } else {
    for (const item of impacted.entities) lines.push(`- ${item}`)
    for (const item of impacted.pages) lines.push(`- ${item}`)
    lines.push('')
  }

  lines.push('## 5. 删除与迁移', '')
  if (!deleted.length) {
    lines.push('（本次没有删除项）', '')
  } else {
    lines.push('以下内容已从需求/设计中删除或改名，请按影响分析处理：', '')
    for (const item of deleted) lines.push(`- ${item}`)
    lines.push('')
    lines.push('处理要求：')
    lines.push('- 先做代码影响分析（Controller/Service/DAO/Vue 页面/路由/测试），再删除对应实现，并在完成总结中列出删除的文件。')
    lines.push('- **数据库删表/删列/改表名属于高风险操作**：必须先生成迁移 SQL 与影响说明，等待用户确认后再执行；不要直接 DROP。')
    lines.push('- 历史数据如需保留，先备份或建新表双写，再切换。')
    lines.push('')
  }

  lines.push('## 6. 实现要求', '')
  lines.push('- 在现有代码上增量修改，保留未变更的功能、接口、页面与测试；**不要重写整个项目**。')
  lines.push('- 先对照本文件与上一版实现确认差异，再动代码；未列出的功能默认保持现状。')
  lines.push('- 删除项先说明影响再改；数据库迁移需用户确认。')
  lines.push('- 完成后总结：变更点、影响文件、自测结果、未解决事项（含已删除文件/表/字段）。')
  lines.push('')

  const requirementCounts = {
    added: (requirementDiff?.scenes.added.length ?? 0) + (requirementDiff?.epics.added.length ?? 0) + (requirementDiff?.stories.added.length ?? 0),
    modified:
      (requirementDiff?.scenes.changed.length ?? 0) +
      (requirementDiff?.epics.changed.length ?? 0) +
      (requirementDiff?.stories.changed.length ?? 0),
    removed:
      (requirementDiff?.scenes.removed.length ?? 0) +
      (requirementDiff?.epics.removed.length ?? 0) +
      (requirementDiff?.stories.removed.length ?? 0)
  }
  const designCounts = {
    added: entityAdded.length + pageSetAdded.length + pageAdded.length,
    modified: entityModified.length + pageSetModified.length + pageModified.length,
    removed: entityRemoved.length + pageSetRemoved.length + pageRemoved.length
  }
  const counts: DesignChangeCounts = {
    added: requirementCounts.added + designCounts.added,
    modified: requirementCounts.modified + designCounts.modified,
    removed: requirementCounts.removed + designCounts.removed,
    total: 0
  }
  counts.total = counts.added + counts.modified + counts.removed

  const summary: DesignChangeSummary = {
    requirements: {
      docVersionFrom: baseline.docVersion,
      docVersionTo: current.docVersion,
      docHashChanged,
      scenes: {
        added: requirementDiff?.scenes.added.length ?? 0,
        modified: requirementDiff?.scenes.changed.length ?? 0,
        removed: requirementDiff?.scenes.removed.length ?? 0
      },
      epics: {
        added: requirementDiff?.epics.added.length ?? 0,
        modified: requirementDiff?.epics.changed.length ?? 0,
        removed: requirementDiff?.epics.removed.length ?? 0
      },
      stories: {
        added: requirementDiff?.stories.added.length ?? 0,
        modified: requirementDiff?.stories.changed.length ?? 0,
        removed: requirementDiff?.stories.removed.length ?? 0
      }
    },
    design: {
      designVersionFrom: baseline.designVersion,
      designVersionTo: current.designVersion,
      entities: { added: entityAdded.length, modified: entityModified.length, removed: entityRemoved.length },
      fields: { added: fieldsAdded, modified: fieldsModified, removed: fieldsRemoved },
      relations: { added: relationsAdded, modified: relationsModified, removed: relationsRemoved },
      pageSets: { added: pageSetAdded.length, modified: pageSetModified.length, removed: pageSetRemoved.length },
      pages: { added: pageAdded.length, modified: pageModified.length, removed: pageRemoved.length },
      templateChanged,
      templateHashFrom: baseline.templateHash,
      templateHashTo: current.templateHash
    },
    deleted,
    counts
  }

  return { markdown: lines.join('\n'), counts, summary }
}
