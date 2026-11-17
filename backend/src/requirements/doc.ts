/**
 * 需求文档服务（R1 / M2 模块化）
 *
 * 数据流：
 * - 章节表 app_requirement_doc_sections 是唯一事实来源（按 app_id + module_id 归属模块）；
 * - 整篇 content_md 由章节按 position 拼接（缓存/快照），供导出/交接包/搜索；
 * - 版本是 checkpoint（R2b）：自动保存只更新内容/updated_at，不产版本；
 *   关键节点（模板切换、AI 应用、确认需求、版本回滚、取消恢复、手动保存）生成版本快照。
 *
 * M2：所有读写都带模块维度；未传 moduleId 时落到默认模块（旧 API/旧前端行为不变）。
 * 写操作对已归档模块返回 409；读允许。
 *
 * 需求固定为文档模式（R4b-2 起不再有 structured 卡片/场景模式）。
 */
import { db, nowIso } from '../db'
import {
  activeChangeSetRow,
  assertAllModulesInActiveChangeSet,
  assertModuleInActiveChangeSet,
  touchChangeSetModule,
  updateActiveChangeSet
} from '../changesets/query'
import {
  RequirementDocError,
  defaultRequirementTemplate,
  getRequirementTemplateOrThrow,
  getTemplateOrThrow
} from './templates'
import { appRequirementTemplate, syncAppRequirementTemplate } from '../apps/template-resolution'
import {
  allRequiredModulesConfirmed,
  assertModuleWritable,
  collectAppOutlineIds,
  createRequirementBundleSnapshot,
  defaultModule,
  docTitleFor,
  listModules,
  moduleById,
  moduleOrThrow,
  pendingModuleIds,
  resolveModule,
  type ModuleRow,
  type RequirementModuleView
} from './modules'
import {
  emptyOutline,
  isStructuredKind,
  mergeOutline,
  normalizeOutlineSection,
  outlineKindOf,
  parseOutlineMarkdown,
  parseSectionData,
  rebuildOutlineSection,
  renderOutlineMarkdown
} from './outline'
import { sha256Hex } from './module-migration'
import { unknownModuleRefWarnings } from './module-intent'
import type {
  RequirementDoc,
  RequirementDocIssue,
  RequirementDocPayload,
  RequirementDocSection,
  RequirementDocStatus,
  RequirementDocVersionDetail,
  RequirementDocVersionMeta,
  RequirementDocVersionSource,
  RequirementOutlineData,
  RequirementTemplate,
  TemplateSectionKind
} from './types'

interface DocRow {
  app_id: string
  module_id: string
  template_id: string
  title: string
  content_md: string
  status: string
  version: number
  created_at: string
  updated_at: string
  confirmed_at: string | null
}

interface SectionRow {
  app_id: string
  module_id: string
  section_key: string
  title: string
  level: number
  kind: string
  markdown: string
  data_json: string | null
  required: number
  position: number
  updated_at: string
}

interface VersionRow {
  id: number
  app_id: string
  module_id: string
  version: number
  template_id: string
  content_md: string
  sections_json: string
  source: string
  change_set_id: string | null
  /** LEFT JOIN app_change_sets：所属变更单序号（无变更时 null） */
  change_set_seq: number | null
  created_at: string
}

const CUSTOM_PREFIX = 'custom-'
const SECTION_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/

function assertDocEditable(payload: RequirementDocPayload): void {
  if (payload.doc.status === 'confirmed') {
    throw new RequirementDocError(409, '需求文档已确认，当前为只读；请回滚版本或重新开启需求阶段后再修改')
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === 'true'
}

/** data_json → 结构化章节（实现见 outline.ts；此处保留导出以兼容旧引用） */
export { parseSectionData }

function appRowOrThrow(appId: string): { id: string; name: string; status: string; requirements_confirmed_at: string | null } {
  const row = db.prepare('SELECT id, name, status, requirements_confirmed_at FROM apps WHERE id = ?').get(appId) as
    | { id: string; name: string; status: string; requirements_confirmed_at: string | null }
    | undefined
  if (!row) throw new RequirementDocError(404, `应用不存在：${appId}`)
  return row
}

function recordStageEvent(appId: string, stage: string, event: string, detail?: Record<string, unknown>): void {
  db.prepare('INSERT INTO app_stage_events (app_id, stage, event, detail, created_at) VALUES (?, ?, ?, ?, ?)').run(
    appId,
    stage,
    event,
    detail ? JSON.stringify(detail) : null,
    nowIso()
  )
}

function docRowOf(appId: string, moduleId: string): DocRow | undefined {
  return db.prepare('SELECT * FROM app_requirement_docs WHERE app_id = ? AND module_id = ?').get(appId, moduleId) as
    | DocRow
    | undefined
}

function rowToDoc(row: DocRow, module?: Pick<ModuleRow, 'module_key'>): RequirementDoc {
  const status = row.status === 'confirmed' || row.status === 'review' ? row.status : 'draft'
  return {
    appId: row.app_id,
    moduleId: row.module_id,
    moduleKey: module?.module_key ?? '',
    templateId: row.template_id,
    title: row.title,
    contentMd: row.content_md,
    status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at
  }
}

function rowToSection(row: SectionRow): RequirementDocSection {
  const data = parseSectionData(row.data_json)
  return {
    sectionKey: row.section_key,
    title: row.title,
    level: row.level === 3 ? 3 : 2,
    kind: (row.kind as TemplateSectionKind) || 'markdown',
    markdown: row.markdown,
    ...(data ? { data } : {}),
    required: row.required === 1,
    position: row.position,
    updatedAt: row.updated_at
  }
}

function readSections(appId: string, moduleId: string): RequirementDocSection[] {
  const rows = db
    .prepare(
      'SELECT * FROM app_requirement_doc_sections WHERE app_id = ? AND module_id = ? ORDER BY position ASC, rowid ASC'
    )
    .all(appId, moduleId) as SectionRow[]
  return rows.map(rowToSection)
}

/**
 * 只读读取模块需求文档（供 #8 需求阶段原型预览使用）。
 *
 * **禁止写操作**：不建模块/文档、不产版本、不修模板；文档不存在时返回
 * `{ doc: null, sections: [] }`，由调用方决定空态。不要用 `ensureRequirementDoc`
 * 替代（它会懒创建模块/文档/版本）。
 */
export interface RequirementDocReadOnly {
  doc: RequirementDoc | null
  sections: RequirementDocSection[]
}

export function readRequirementDocIfExists(appId: string, moduleId: string): RequirementDocReadOnly {
  const row = docRowOf(appId, moduleId)
  if (!row) return { doc: null, sections: [] }
  return { doc: rowToDoc(row, moduleById(appId, row.module_id)), sections: readSections(appId, row.module_id) }
}

function writeSections(appId: string, moduleId: string, sections: RequirementDocSection[], now: string): void {
  db.prepare('DELETE FROM app_requirement_doc_sections WHERE app_id = ? AND module_id = ?').run(appId, moduleId)
  const insert = db.prepare(`
    INSERT INTO app_requirement_doc_sections
      (app_id, module_id, section_key, title, level, kind, markdown, data_json, required, position, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  sections.forEach((section, index) => {
    insert.run(
      appId,
      moduleId,
      section.sectionKey,
      section.title,
      section.level,
      section.kind,
      section.markdown,
      section.data ? JSON.stringify(section.data) : null,
      section.required ? 1 : 0,
      index,
      now
    )
  })
}

export function renderContentMd(title: string, sections: RequirementDocSection[]): string {
  const parts: string[] = [`# ${title}`]
  for (const section of sections) {
    parts.push(`${'#'.repeat(section.level)} ${section.title}`)
    const body = section.markdown.trim()
    if (body) parts.push(body)
  }
  return `${parts.join('\n\n')}\n`
}

/**
 * RMP-2：仅更新模块文档标题（重新规划 rename/regenerate；不产版本）。
 *
 * 调用方负责事务与阶段/归档守卫；文档不存在时静默跳过（生成流程会补建 v1）。
 */
export function updateRequirementDocTitle(appId: string, moduleId: string, title: string): void {
  const row = docRowOf(appId, moduleId)
  if (!row) return
  const sections = readSections(appId, moduleId)
  const contentMd = renderContentMd(title, sections)
  db.prepare('UPDATE app_requirement_docs SET title = ?, content_md = ?, updated_at = ? WHERE app_id = ? AND module_id = ?').run(
    title,
    contentMd,
    nowIso(),
    appId,
    moduleId
  )
}

function sectionsFromTemplate(template: RequirementTemplate, now: string): RequirementDocSection[] {
  return template.sections.map((section, index) => ({
    sectionKey: section.id,
    title: section.title,
    level: section.level,
    kind: section.kind,
    markdown: '',
    required: section.required,
    position: index,
    updatedAt: now
  }))
}

function snapshotVersion(
  appId: string,
  moduleId: string,
  version: number,
  templateId: string,
  contentMd: string,
  sections: RequirementDocSection[],
  source: RequirementDocVersionSource,
  createdAt: string
): void {
  const sectionsJson = JSON.stringify(
    sections.map(section => ({
      sectionKey: section.sectionKey,
      title: section.title,
      level: section.level,
      kind: section.kind,
      markdown: section.markdown,
      ...(section.data ? { data: section.data } : {}),
      required: section.required,
      position: section.position
    }))
  )
  // 变更中产生的版本标记变更单，历史面板/审计可按变更单归组（C1）
  const changeSetId = activeChangeSetRow(appId)?.id ?? null
  db.prepare(`
    INSERT INTO app_requirement_doc_versions
      (app_id, module_id, version, template_id, content_md, sections_json, source, change_set_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(appId, moduleId, version, templateId, contentMd, sectionsJson, source, changeSetId, createdAt)
  // M5：同步变更单模块 current 需求版本/hash（历史面板版本区间）
  if (changeSetId) {
    touchChangeSetModule(changeSetId, moduleId, {
      reqCurrentVersion: version,
      reqCurrentHash: sha256Hex(contentMd)
    })
  }
}

function readVersionSections(raw: string): RequirementDocSection[] {
  const now = nowIso()
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(item => item && typeof item === 'object')
      .map((item, index) => {
        const row = item as Record<string, unknown>
        return {
          sectionKey: asString(row.sectionKey) || `${CUSTOM_PREFIX}${index}`,
          title: asString(row.title) || `章节 ${index + 1}`,
          level: row.level === 3 ? 3 : 2,
          kind: (asString(row.kind) as TemplateSectionKind) || 'markdown',
          markdown: asString(row.markdown),
          ...(row.data && typeof row.data === 'object'
            ? { data: row.data as RequirementOutlineData }
            : {}),
          required: asBool(row.required),
          position: typeof row.position === 'number' ? row.position : index,
          updatedAt: now
        } satisfies RequirementDocSection
      })
      .sort((a, b) => a.position - b.position)
  } catch {
    return []
  }
}

/**
 * 无文档时按模板创建空文档；无章节时按模板补齐。
 *
 * M2：`moduleId` 是尾部可选参数（旧调用点不变）；缺省 → 默认模块（懒创建）。
 */
export function ensureRequirementDoc(appId: string, templateId?: string, moduleId?: string): RequirementDocPayload {
  const app = appRowOrThrow(appId)
  const module = resolveModule(appId, moduleId)
  const now = nowIso()
  let row = docRowOf(appId, module.id)

  if (!row) {
    // #7：显式 templateId（预览/测试）优先；否则应用默认模板，最后回退全局默认
    const template = templateId ? getRequirementTemplateOrThrow(templateId) : appRequirementTemplate(appId, module.id)
    const title = docTitleFor(app.name, module)
    const sections = sectionsFromTemplate(template, now)
    const contentMd = renderContentMd(title, sections)
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO app_requirement_docs
          (app_id, module_id, template_id, title, content_md, status, version, created_at, updated_at, confirmed_at)
        VALUES (?, ?, ?, ?, ?, 'draft', 1, ?, ?, NULL)
      `).run(appId, module.id, template.id, title, contentMd, now, now)
      writeSections(appId, module.id, sections, now)
      snapshotVersion(appId, module.id, 1, template.id, contentMd, sections, 'template-change', now)
    })
    tx()
    row = docRowOf(appId, module.id)
    if (!row) throw new RequirementDocError(500, '需求文档创建失败')
  }

  const doc = rowToDoc(row, module)
  let template: RequirementTemplate
  try {
    template = getTemplateOrThrow(doc.templateId)
  } catch {
    // 我的模板被删除时回退默认模板，避免文档不可读
    template = defaultRequirementTemplate()
    db.prepare('UPDATE app_requirement_docs SET template_id = ?, updated_at = ? WHERE app_id = ? AND module_id = ?').run(
      template.id,
      now,
      appId,
      module.id
    )
    doc.templateId = template.id
  }

  let sections = readSections(appId, module.id)
  if (!sections.length) {
    const tx = db.transaction(() => {
      sections = sectionsFromTemplate(template, now)
      writeSections(appId, module.id, sections, now)
      const contentMd = renderContentMd(doc.title, sections)
      db.prepare('UPDATE app_requirement_docs SET content_md = ?, updated_at = ? WHERE app_id = ? AND module_id = ?').run(
        contentMd,
        now,
        appId,
        module.id
      )
      doc.contentMd = contentMd
    })
    tx()
  }
  return { doc, template, sections: readSections(appId, module.id) }
}

/** 保存章节后重算整篇并（可选）生成版本 */
function persistDocContent(
  appId: string,
  module: ModuleRow,
  doc: RequirementDoc,
  sections: RequirementDocSection[],
  source: RequirementDocVersionSource,
  snapshot: boolean
): RequirementDocPayload {
  const now = nowIso()
  const contentMd = renderContentMd(doc.title, sections)
  const nextVersion = snapshot ? doc.version + 1 : doc.version
  const tx = db.transaction(() => {
    writeSections(appId, module.id, sections, now)
    db.prepare(`
      UPDATE app_requirement_docs SET template_id = ?, title = ?, content_md = ?, version = ?, updated_at = ?
      WHERE app_id = ? AND module_id = ?
    `).run(doc.templateId, doc.title, contentMd, nextVersion, now, appId, module.id)
    if (snapshot) snapshotVersion(appId, module.id, nextVersion, doc.templateId, contentMd, sections, source, now)
  })
  tx()
  const row = docRowOf(appId, module.id)
  if (!row) throw new RequirementDocError(500, '需求文档保存失败')
  const template = getTemplateOrThrow(row.template_id)
  return { doc: rowToDoc(row, module), template, sections: readSections(appId, module.id) }
}

function normalizeSectionKey(raw: unknown): string {
  const key = asString(raw).trim()
  if (!SECTION_KEY_PATTERN.test(key)) {
    throw new RequirementDocError(400, `章节 key 不合法：${key || '(空)'}`)
  }
  return key
}

export interface SaveSectionInput {
  markdown?: unknown
  data?: unknown
  title?: unknown
  level?: unknown
  kind?: unknown
  snapshot?: unknown
}

/** 把结构化章节的 data 归一化并同步 Markdown；返回 warning（不阻塞保存） */
function applyOutlineData(
  target: RequirementDocSection,
  rawData: unknown,
  sections: RequirementDocSection[],
  reservedIds: Set<string>
): string[] {
  const kind = outlineKindOf(target.kind)
  if (!kind) throw new RequirementDocError(400, `章节「${target.title}」不是结构化章节，不能写入 data`)
  const global = outlineOfSections(sections.filter(section => section.sectionKey !== target.sectionKey))
  const result = normalizeOutlineSection(rawData, { kind, previous: target.data ?? null, global, reservedIds })
  target.data = result.data
  target.markdown = renderOutlineMarkdown(kind, result.data)
  return result.warnings.map(warning => warning.message)
}

/** 源码模式保存结构化章节：解析 Markdown 回结构；解析失败/为空时保留原结构 */
function syncOutlineFromMarkdown(
  target: RequirementDocSection,
  sections: RequirementDocSection[],
  reservedIds: Set<string>
): string[] {
  const kind = outlineKindOf(target.kind)
  if (!kind) return []
  const body = target.markdown.trim()
  if (!body) {
    target.data = emptyOutline()
    return []
  }
  const global = outlineOfSections(sections.filter(section => section.sectionKey !== target.sectionKey))
  const result = rebuildOutlineSection(kind, target.markdown, target.data ?? null, global, reservedIds)
  const parsedActive = kind === 'scenes' ? result.data.scenes.some(item => !item.archived) : result.data.epics.some(item => !item.archived)
  if (!parsedActive) {
    return ['结构化章节未能从 Markdown 解析出条目，已保留原结构']
  }
  target.data = result.data
  target.markdown = renderOutlineMarkdown(kind, result.data)
  return result.warnings.map(warning => warning.message)
}

/**
 * 保存单章节（自动保存；snapshot=true 时产版本）。
 *
 * M2：`moduleId` 尾部可选（缺省默认模块）；已归档模块写入 409。
 * 结构化章节的 ID 分配同时考虑本模块（global/previous）与全应用占用（reservedIds，§9.3）。
 */
export function saveDocSection(
  appId: string,
  rawKey: unknown,
  input: SaveSectionInput,
  moduleId?: string
): RequirementDocPayload {
  const key = normalizeSectionKey(rawKey)
  const module = resolveModule(appId, moduleId)
  assertModuleWritable(module)
  assertModuleInActiveChangeSet(appId, module.id)
  const payload = ensureRequirementDoc(appId, undefined, module.id)
  assertDocEditable(payload)
  const reservedIds = collectAppOutlineIds(appId)
  const sections = payload.sections
  const now = nowIso()
  let target = sections.find(section => section.sectionKey === key)

  if (!target) {
    if (!key.startsWith(CUSTOM_PREFIX)) {
      throw new RequirementDocError(404, `章节不存在：${key}`)
    }
    target = {
      sectionKey: key,
      title: asString(input.title).trim() || '自定义章节',
      level: input.level === 3 ? 3 : 2,
      kind: 'markdown',
      markdown: '',
      required: false,
      position: sections.length,
      updatedAt: now
    }
    sections.push(target)
  }

  if (typeof input.title === 'string' && input.title.trim()) target.title = input.title.trim()
  if (input.level === 2 || input.level === 3) target.level = input.level
  if (typeof input.kind === 'string' && input.kind) target.kind = input.kind as TemplateSectionKind
  if (typeof input.markdown === 'string') target.markdown = input.markdown

  let warnings: string[] = []
  if (input.data !== undefined) {
    warnings = applyOutlineData(target, input.data, sections, reservedIds)
  } else if (typeof input.markdown === 'string' && isStructuredKind(target.kind) && target.data) {
    warnings = syncOutlineFromMarkdown(target, sections, reservedIds)
  }
  target.updatedAt = now

  const snapshot = input.snapshot === undefined ? false : asBool(input.snapshot)
  const saved = persistDocContent(appId, module, payload.doc, sections, 'manual', snapshot)
  // G1：文档引用了不存在的模块编号（非阻塞；同一 key 去重）
  warnings.push(...unknownModuleRefWarnings(appId, saved.sections.map(section => section.markdown)))
  return warnings.length ? { ...saved, warnings } : saved
}

export interface SaveDocInput {
  contentMd?: unknown
  sections?: unknown
  title?: unknown
  source?: unknown
  snapshot?: unknown
  /** AI 建议应用时允许删除的自定义章节（仅 custom-* 且非必填） */
  removeSectionKeys?: unknown
}

/** AI 建议预览：章节相对当前文档的变化状态（added/modified/unchanged） */
export type DocPreviewChange = 'added' | 'modified' | 'unchanged'

export interface DocPreviewSection {
  sectionKey: string
  title: string
  level: 2 | 3
  kind: TemplateSectionKind
  markdown: string
  data?: RequirementOutlineData
  required: boolean
  change: DocPreviewChange
}

export interface DocPreviewRemoved {
  sectionKey: string
  title: string
  required: boolean
}

export interface DocPreviewResult {
  title: string
  sections: DocPreviewSection[]
  removed: DocPreviewRemoved[]
  warnings: string[]
  /** 生成建议时的文档版本；应用前用它判断建议是否过期 */
  baseVersion: number
  docStatus: RequirementDocStatus
}

interface ParsedSection {
  title: string
  level: 2 | 3
  markdown: string
}

/** 解析整篇 Markdown：`# ` 为文档标题，`## ` 为章节；`### ` 仅在匹配已知三级章节时单独成节，否则保留在正文中 */
export function parseContentMd(
  content: string,
  known: Array<{ title: string; level: 2 | 3 }> = []
): { title: string; sections: ParsedSection[] } {
  const knownLevel3 = new Set(known.filter(item => item.level === 3).map(item => normalizeTitleKey(item.title)))
  const lines = String(content ?? '').replace(/\r\n/g, '\n').split('\n')
  let title = ''
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null
  let buffer: string[] = []
  let inFence = false

  const flush = (): void => {
    if (!current) return
    current.markdown = buffer.join('\n').trim()
    sections.push(current)
    buffer = []
  }

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence
    if (!inFence) {
      const h1 = /^#\s+(.*)$/.exec(line)
      if (h1 && !title && !current && !sections.length) {
        title = h1[1].trim()
        continue
      }
      const heading = /^(##|###)\s+(.*)$/.exec(line)
      if (heading) {
        const level: 2 | 3 = heading[1] === '###' ? 3 : 2
        const headingTitle = heading[2].trim()
        if (level === 2 || knownLevel3.has(normalizeTitleKey(headingTitle))) {
          flush()
          current = { title: headingTitle, level, markdown: '' }
          continue
        }
      }
    }
    if (current) buffer.push(line)
  }
  flush()
  return { title, sections }
}

function hashText(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0
  return hash.toString(36)
}

function customKeyFor(title: string, used: Set<string>): string {
  const base = `${CUSTOM_PREFIX}${hashText(title)}`
  if (!used.has(base)) return base
  let index = 2
  while (used.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

function normalizeTitleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** 把解析出的章节映射回现有章节：标题/顺序优先，找不到时生成 custom-* */
function mapParsedSections(parsed: ParsedSection[], existing: RequirementDocSection[], now: string): RequirementDocSection[] {
  const used = new Set<string>()
  const byTitle = new Map<string, RequirementDocSection>()
  for (const section of existing) {
    const key = normalizeTitleKey(section.title)
    if (!byTitle.has(key)) byTitle.set(key, section)
  }
  return parsed.map((item, index) => {
    const match = byTitle.get(normalizeTitleKey(item.title))
    const sectionKey = match && !used.has(match.sectionKey) ? match.sectionKey : customKeyFor(item.title, used)
    used.add(sectionKey)
    return {
      sectionKey,
      title: item.title,
      level: item.level,
      kind: match?.kind ?? 'markdown',
      markdown: item.markdown,
      ...(match?.data ? { data: match.data } : {}),
      required: match?.required ?? false,
      position: index,
      updatedAt: now
    }
  })
}

function applySectionUpdates(
  existing: RequirementDocSection[],
  updates: unknown,
  now: string,
  reservedIds: Set<string>
): { sections: RequirementDocSection[]; warnings: string[] } {
  if (!Array.isArray(updates)) throw new RequirementDocError(400, 'sections 需要是数组')
  const next = existing.map(section => ({ ...section }))
  const used = new Set(next.map(section => section.sectionKey))
  const warnings: string[] = []
  for (const item of updates) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const key = asString(raw.id ?? raw.sectionKey).trim()
    const title = asString(raw.title).trim()
    const markdown = typeof raw.markdown === 'string' ? raw.markdown : undefined
    let target = key ? next.find(section => section.sectionKey === key) : undefined
    if (!target && title) target = next.find(section => normalizeTitleKey(section.title) === normalizeTitleKey(title))
    if (!target) {
      const desiredKey = key && KEY_PATTERN_OK(key) ? key : customKeyFor(title || `章节 ${next.length + 1}`, used)
      target = {
        sectionKey: desiredKey,
        title: title || '自定义章节',
        level: raw.level === 3 ? 3 : 2,
        kind: (asString(raw.kind) as TemplateSectionKind) || 'markdown',
        markdown: '',
        required: asBool(raw.required),
        position: next.length,
        updatedAt: now
      }
      next.push(target)
      used.add(desiredKey)
    }
    if (markdown !== undefined) target.markdown = markdown
    if (title) target.title = title
    if (raw.level === 2 || raw.level === 3) target.level = raw.level
    if (typeof raw.kind === 'string' && raw.kind) target.kind = raw.kind as TemplateSectionKind
    if (raw.data !== undefined && isStructuredKind(target.kind)) {
      warnings.push(...applyOutlineData(target, raw.data, next, reservedIds))
    }
    target.updatedAt = now
  }
  return { sections: next.map((section, index) => ({ ...section, position: index })), warnings }
}

function KEY_PATTERN_OK(key: string): boolean {
  return SECTION_KEY_PATTERN.test(key)
}

/** 全文保存后：结构化章节从 Markdown 重建结构（沿用稳定 ID） */
function syncStructuredAfterFullSave(
  sections: RequirementDocSection[],
  existing: RequirementDocSection[],
  reservedIds: Set<string>
): string[] {
  const warnings: string[] = []
  const global = outlineOfSections(existing)
  for (const section of sections) {
    const kind = outlineKindOf(section.kind)
    if (!kind) continue
    const previous = existing.find(item => item.sectionKey === section.sectionKey)?.data ?? null
    const result = rebuildOutlineSection(kind, section.markdown, previous, global, reservedIds)
    const active =
      kind === 'scenes'
        ? result.data.scenes.some(item => !item.archived)
        : result.data.epics.some(item => !item.archived)
    if (!active) continue
    section.data = result.data
    section.markdown = renderOutlineMarkdown(kind, result.data)
    warnings.push(...result.warnings.map(warning => warning.message))
  }
  return warnings
}

/** 高级全文保存：contentMd 解析回章节，或直接提交章节更新（AI 应用复用） */
export function saveDoc(appId: string, input: SaveDocInput, moduleId?: string): RequirementDocPayload {
  const module = resolveModule(appId, moduleId)
  assertModuleWritable(module)
  assertModuleInActiveChangeSet(appId, module.id)
  const payload = ensureRequirementDoc(appId, undefined, module.id)
  assertDocEditable(payload)
  const reservedIds = collectAppOutlineIds(appId)
  const now = nowIso()
  const explicitTitle = asString(input.title).trim()
  let title = explicitTitle
  let sections: RequirementDocSection[]
  let warnings: string[] = []

  if (typeof input.contentMd === 'string') {
    const parsed = parseContentMd(input.contentMd, payload.sections)
    if (!parsed.sections.length) {
      throw new RequirementDocError(400, '全文保存失败：未识别到任何章节标题（请使用 ## / ### 标题）')
    }
    sections = mapParsedSections(parsed.sections, payload.sections, now)
    warnings = syncStructuredAfterFullSave(sections, payload.sections, reservedIds)
    if (!title) title = parsed.title || payload.doc.title
  } else if (Array.isArray(input.sections)) {
    const applied = applySectionUpdates(payload.sections, input.sections, now, reservedIds)
    sections = applied.sections
    warnings = applied.warnings
    if (!title) title = payload.doc.title
  } else {
    throw new RequirementDocError(400, '需要 contentMd 或 sections')
  }

  // AI 建议应用：只允许删除 custom-* 且非必填章节；与 sections 更新同一版本
  const removeKeys = Array.isArray(input.removeSectionKeys)
    ? (input.removeSectionKeys as unknown[]).map(item => asString(item).trim()).filter(Boolean)
    : []
  if (removeKeys.length) {
    const removable = new Set<string>()
    for (const key of removeKeys) {
      const target = sections.find(section => section.sectionKey === key)
      if (!target) {
        warnings.push(`章节不存在，已跳过删除：${key}`)
        continue
      }
      if (!key.startsWith(CUSTOM_PREFIX)) {
        warnings.push(`模板章节「${target.title}」不可删除，已保留`)
        continue
      }
      if (target.required) {
        warnings.push(`必填章节「${target.title}」不可删除，已保留`)
        continue
      }
      removable.add(key)
    }
    if (removable.size) {
      sections = sections
        .filter(section => !removable.has(section.sectionKey))
        .map((section, index) => ({ ...section, position: index }))
    }
  }

  payload.doc.title = title
  const source: RequirementDocVersionSource = input.source === 'ai' ? 'ai' : 'manual'
  const snapshot = input.snapshot === undefined ? true : asBool(input.snapshot)
  const saved = persistDocContent(appId, module, payload.doc, sections, source, snapshot)
  // G1：文档引用了不存在的模块编号（非阻塞；同一 key 去重）
  warnings.push(...unknownModuleRefWarnings(appId, saved.sections.map(section => section.markdown)))
  return warnings.length ? { ...saved, warnings } : saved
}

/**
 * 预览基线：读取现有文档；文档不存在时按模板构造只读基线（不写库）。
 * 预览接口必须“不写库、不产版本”，因此不能调用 ensureRequirementDoc（也不懒建模块）。
 */
function previewBaseline(appId: string, templateId?: string, moduleId?: string): {
  doc: RequirementDoc
  template: RequirementTemplate
  sections: RequirementDocSection[]
} {
  const app = appRowOrThrow(appId)
  const now = nowIso()
  const explicitModuleId = asString(moduleId).trim()
  const module: ModuleRow | undefined = explicitModuleId
    ? moduleOrThrow(appId, explicitModuleId)
    : defaultModule(appId)
  const row = module ? docRowOf(appId, module.id) : undefined
  if (!row) {
    const template = templateId
      ? getRequirementTemplateOrThrow(asString(templateId))
      : appRequirementTemplate(appId, module?.id)
    const title = module ? docTitleFor(app.name, module) : `${app.name} 需求文档`
    return {
      doc: {
        appId,
        moduleId: module?.id ?? '',
        moduleKey: module?.module_key ?? '',
        templateId: template.id,
        title,
        contentMd: '',
        status: 'draft' as RequirementDocStatus,
        version: 0,
        createdAt: now,
        updatedAt: now,
        confirmedAt: null
      },
      template,
      sections: sectionsFromTemplate(template, now)
    }
  }
  const doc = rowToDoc(row, module)
  let template: RequirementTemplate
  try {
    template = getTemplateOrThrow(doc.templateId)
  } catch {
    template = defaultRequirementTemplate()
  }
  const existing = readSections(appId, row.module_id)
  return {
    doc,
    template,
    sections: existing.length ? existing : sectionsFromTemplate(template, now)
  }
}

function sameOutlineData(left?: RequirementOutlineData, right?: RequirementOutlineData): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function changeOf(
  before: RequirementDocSection | undefined,
  after: { title: string; level: 2 | 3; kind: TemplateSectionKind; markdown: string; data?: RequirementOutlineData }
): DocPreviewChange {
  if (!before) return 'added'
  if (
    before.title !== after.title ||
    before.level !== after.level ||
    before.kind !== after.kind ||
    before.markdown !== after.markdown ||
    !sameOutlineData(before.data, after.data)
  ) {
    return 'modified'
  }
  return 'unchanged'
}

/**
 * AI 建议预览（R2a）：复用 saveDoc 的解析/映射，但不写库、不产版本。
 *
 * - contentMd（全文）：与全文保存同一套解析，未出现在建议里的可删除章节进入 removed；
 *   必填章节缺失只给 warning（保留原内容），模板可选章节缺失也只 warning。
 * - sections（章节更新）：只合并更新，不产生 removed。
 * - 文档已确认只读时与保存一致返回 409，避免给出不可应用的建议。
 */
export function previewDoc(appId: string, input: SaveDocInput, moduleId?: string): DocPreviewResult {
  const baseline = previewBaseline(appId, undefined, moduleId)
  assertDocEditable({ doc: baseline.doc, template: baseline.template, sections: baseline.sections })
  const reservedIds = collectAppOutlineIds(appId)
  const now = nowIso()
  const explicitTitle = asString(input.title).trim()
  let title = explicitTitle
  const warnings: string[] = []
  let proposed: RequirementDocSection[]

  if (typeof input.contentMd === 'string') {
    const parsed = parseContentMd(input.contentMd, baseline.sections)
    if (!parsed.sections.length) {
      throw new RequirementDocError(400, '预览失败：未识别到任何章节标题（请使用 ## / ### 标题）')
    }
    proposed = mapParsedSections(parsed.sections, baseline.sections, now)
    warnings.push(...syncStructuredAfterFullSave(proposed, baseline.sections, reservedIds))
    if (!title) title = parsed.title || baseline.doc.title
  } else if (Array.isArray(input.sections)) {
    const applied = applySectionUpdates(baseline.sections, input.sections, now, reservedIds)
    proposed = applied.sections
    warnings.push(...applied.warnings)
    if (!title) title = baseline.doc.title
  } else {
    throw new RequirementDocError(400, '需要 contentMd 或 sections')
  }

  const proposedKeys = new Set(proposed.map(section => section.sectionKey))
  const removed: DocPreviewRemoved[] = []
  if (typeof input.contentMd === 'string') {
    for (const section of baseline.sections) {
      if (proposedKeys.has(section.sectionKey)) continue
      if (section.required) {
        warnings.push(`必填章节「${section.title}」在本轮未出现，将保留原内容`)
      } else if (section.sectionKey.startsWith(CUSTOM_PREFIX)) {
        removed.push({ sectionKey: section.sectionKey, title: section.title, required: false })
      } else {
        warnings.push(`模板章节「${section.title}」在本轮未出现，将保留原内容`)
      }
    }
  }

  const beforeByKey = new Map(baseline.sections.map(section => [section.sectionKey, section]))
  const sections: DocPreviewSection[] = proposed.map(section => ({
    sectionKey: section.sectionKey,
    title: section.title,
    level: section.level,
    kind: section.kind,
    markdown: section.markdown,
    ...(section.data ? { data: section.data } : {}),
    required: section.required,
    change: changeOf(beforeByKey.get(section.sectionKey), section)
  }))

  return {
    title,
    sections,
    removed,
    warnings,
    baseVersion: baseline.doc.version,
    docStatus: baseline.doc.status
  }
}

interface TemplateSectionRef {
  sectionKey: string
  title: string
}

interface TemplateMapping {
  sections: RequirementDocSection[]
  /** 命中旧章节（按 key 或标题）的数量 */
  kept: number
  /** 新模板里没有、将被移出文档的章节 */
  dropped: TemplateSectionRef[]
  /** 旧文档里没有、新模板新增的章节 */
  added: TemplateSectionRef[]
}

/**
 * 把已有章节按“section key → 标题”映射到目标模板：
 * 同 key 或同标题保留 markdown；结构化 data 只在 kind 一致时保留；required 取新模板。
 */
function mapSectionsToTemplate(existing: RequirementDocSection[], template: RequirementTemplate, now: string): TemplateMapping {
  const byKey = new Map(existing.map(section => [section.sectionKey, section]))
  const byTitle = new Map<string, RequirementDocSection>()
  for (const section of existing) {
    const key = normalizeTitleKey(section.title)
    if (!byTitle.has(key)) byTitle.set(key, section)
  }
  const matched = new Set<string>()
  const added: TemplateSectionRef[] = []
  let kept = 0
  const sections = template.sections.map((definition, index) => {
    const match = byKey.get(definition.id) ?? byTitle.get(normalizeTitleKey(definition.title))
    if (match) {
      matched.add(match.sectionKey)
      kept += 1
    } else {
      added.push({ sectionKey: definition.id, title: definition.title })
    }
    return {
      sectionKey: definition.id,
      title: definition.title,
      level: definition.level,
      kind: definition.kind,
      markdown: match?.markdown ?? '',
      ...(match?.data && isStructuredKind(definition.kind) && match.kind === definition.kind ? { data: match.data } : {}),
      required: definition.required,
      position: index,
      updatedAt: now
    }
  })
  return {
    sections,
    kept,
    dropped: existing
      .filter(section => !matched.has(section.sectionKey))
      .map(section => ({ sectionKey: section.sectionKey, title: section.title })),
    added
  }
}

/** 切换模板：按 key/标题保留已有内容，生成新版本（旧版本保留可回滚） */
export function switchDocTemplate(appId: string, templateId: unknown, moduleId?: string): RequirementDocPayload {
  const module = resolveModule(appId, moduleId)
  assertModuleWritable(module)
  assertModuleInActiveChangeSet(appId, module.id)
  const payload = ensureRequirementDoc(appId, undefined, module.id)
  assertDocEditable(payload)
  const template = getRequirementTemplateOrThrow(asString(templateId))
  const mapping = mapSectionsToTemplate(payload.sections, template, nowIso())

  payload.doc.templateId = template.id
  const next = persistDocContent(appId, module, payload.doc, mapping.sections, 'template-change', true)
  // #7：切换后同步应用默认模板（首次初始化/后续解析使用；M3 应用级切换走 switchDocTemplateForApp）
  syncAppRequirementTemplate(appId, template.id)
  return next
}

// ------------------------------------------------- 应用级模板切换（M3）

export interface AppTemplateModuleImpact {
  moduleId: string
  moduleKey: string
  title: string
  docStatus: RequirementDocStatus
  docVersion: number
  fromSections: number
  toSections: number
  kept: number
  dropped: TemplateSectionRef[]
  added: TemplateSectionRef[]
  warnings: string[]
}

export interface AppTemplateBlockedModule {
  moduleId: string
  moduleKey: string
  title: string
  reason: 'confirmed'
}

export interface AppTemplatePreview {
  template: { id: string; name: string }
  scope: 'app'
  modules: AppTemplateModuleImpact[]
  blockedModules: AppTemplateBlockedModule[]
  canApply: boolean
  warnings: string[]
}

export interface AppTemplateSwitchModuleResult extends AppTemplateModuleImpact {
  version: number
  sectionCount: number
}

export interface AppTemplateSwitchResult {
  appId: string
  template: { id: string; name: string }
  scope: 'app'
  modules: AppTemplateSwitchModuleResult[]
}

function branchStatus(raw: string | null | undefined): RequirementDocStatus {
  return raw === 'confirmed' || raw === 'review' ? raw : 'draft'
}

/** 未归档模块（按 position）；模板切换只作用于它们，归档模块保持历史模板 */
function activeModuleRows(appId: string): ModuleRow[] {
  return listModules(appId, false).map(view => moduleOrThrow(appId, view.id))
}

/**
 * 应用级模板切换预览（M3 §3.1）：**只读**，不写库、不产版本、不建文档。
 *
 * - 未归档模块全部列出；归档模块不参与（保留历史模板，恢复后再切换对齐）；
 * - 任一未归档模块已确认 → 进 blockedModules，canApply=false（预览仍正常返回）。
 */
export function previewAppDocTemplate(appId: string, templateId: unknown): AppTemplatePreview {
  appRowOrThrow(appId)
  const template = getRequirementTemplateOrThrow(asString(templateId))
  const now = nowIso()
  const modules: AppTemplateModuleImpact[] = []
  const blockedModules: AppTemplateBlockedModule[] = []
  const warnings: string[] = []

  for (const module of activeModuleRows(appId)) {
    const row = docRowOf(appId, module.id)
    const existing = row ? readSections(appId, module.id) : []
    const mapping = mapSectionsToTemplate(existing, template, now)
    const status = branchStatus(row?.status)
    const moduleWarnings: string[] = []
    if (!row) {
      moduleWarnings.push('该模块还没有需求文档，切换后将按模板创建 v1')
      warnings.push(`「${module.title}」没有需求文档，切换后将按模板创建 v1`)
    }
    if (status === 'confirmed') {
      blockedModules.push({ moduleId: module.id, moduleKey: module.module_key, title: module.title, reason: 'confirmed' })
      moduleWarnings.push('模块需求已确认，不能参与应用级切换；请先「重新编辑需求」')
    }
    const droppedWithContent = mapping.dropped.filter(item => {
      const section = existing.find(current => current.sectionKey === item.sectionKey)
      return Boolean(section && (section.markdown.trim() || (section.data && isStructuredKind(section.kind))))
    })
    if (droppedWithContent.length) {
      const names = droppedWithContent.map(item => `「${item.title}」`).join('、')
      moduleWarnings.push(`切换后 ${names} 不再出现在新模板中（内容仍保留在旧版本，可回滚）`)
    }
    modules.push({
      moduleId: module.id,
      moduleKey: module.module_key,
      title: module.title,
      docStatus: status,
      docVersion: row?.version ?? 0,
      fromSections: existing.length,
      toSections: template.sections.length,
      kept: mapping.kept,
      dropped: mapping.dropped,
      added: mapping.added,
      warnings: moduleWarnings
    })
  }

  if (!modules.length) warnings.push('应用还没有未归档的需求模块')
  if (blockedModules.length) {
    warnings.push(`${blockedModules.length} 个模块的需求已确认，应用级切换被阻止；请先「重新编辑需求」`)
  }
  return {
    template: { id: template.id, name: template.name },
    scope: 'app',
    modules,
    blockedModules,
    canApply: modules.length > 0 && blockedModules.length === 0,
    warnings
  }
}

/**
 * 应用级模板切换（M3 §3.1）：单事务重写**所有未归档模块**，每模块 version+1 且
 * `source='template-change'`；任一未归档模块已确认 → 409 + issues 且不写任何模块。
 * 归档模块不动。同步应用默认模板。
 */
export function switchDocTemplateForApp(appId: string, templateId: unknown): AppTemplateSwitchResult {
  appRowOrThrow(appId)
  assertAllModulesInActiveChangeSet(appId)
  const template = getRequirementTemplateOrThrow(asString(templateId))
  const modules = activeModuleRows(appId)
  if (!modules.length) throw new RequirementDocError(400, '应用还没有未归档的需求模块，无法切换模板')

  const confirmed = modules.filter(module => branchStatus(docRowOf(appId, module.id)?.status) === 'confirmed')
  if (confirmed.length) {
    throw new RequirementDocError(
      409,
      `有 ${confirmed.length} 个模块的需求已确认，不能应用级切换模板；请先「重新编辑需求」后再切换`,
      confirmed.map(module => ({ moduleId: module.id, moduleKey: module.module_key, title: module.title }))
    )
  }

  const now = nowIso()
  const results: AppTemplateSwitchModuleResult[] = []
  const tx = db.transaction(() => {
    for (const module of modules) {
      const row = docRowOf(appId, module.id)
      if (!row) {
        // 理论不该出现（模块创建时即建空文档）；按模板补建 v1，避免应用级切换漏模块
        const created = ensureRequirementDoc(appId, template.id, module.id)
        results.push({
          moduleId: module.id,
          moduleKey: module.module_key,
          title: module.title,
          docStatus: created.doc.status,
          docVersion: created.doc.version,
          fromSections: 0,
          toSections: created.sections.length,
          kept: 0,
          dropped: [],
          added: created.sections.map(section => ({ sectionKey: section.sectionKey, title: section.title })),
          warnings: ['该模块还没有需求文档，已按模板创建 v1'],
          version: created.doc.version,
          sectionCount: created.sections.length
        })
        continue
      }
      const existing = readSections(appId, module.id)
      const mapping = mapSectionsToTemplate(existing, template, now)
      const doc: RequirementDoc = { ...rowToDoc(row, module), templateId: template.id }
      const saved = persistDocContent(appId, module, doc, mapping.sections, 'template-change', true)
      const warnings: string[] = []
      const droppedWithContent = mapping.dropped.filter(item => {
        const section = existing.find(current => current.sectionKey === item.sectionKey)
        return Boolean(section && (section.markdown.trim() || (section.data && isStructuredKind(section.kind))))
      })
      if (droppedWithContent.length) {
        warnings.push(`${droppedWithContent.length} 个章节不再出现在新模板中（旧版本可回滚）`)
      }
      results.push({
        moduleId: module.id,
        moduleKey: module.module_key,
        title: module.title,
        docStatus: saved.doc.status,
        docVersion: saved.doc.version,
        fromSections: existing.length,
        toSections: saved.sections.length,
        kept: mapping.kept,
        dropped: mapping.dropped,
        added: mapping.added,
        warnings,
        version: saved.doc.version,
        sectionCount: saved.sections.length
      })
    }
    // #7：应用默认模板跟随（新建模块/首次解析使用）
    syncAppRequirementTemplate(appId, template.id)
  })
  tx()
  return { appId, template: { id: template.id, name: template.name }, scope: 'app', modules: results }
}

/** 只读导出：文档 → 01-REQUIREMENTS.md（R3 再接入交接包） */
export function exportRequirementDoc(
  appId: string,
  moduleId?: string
): { filename: string; content: string; version: number; status: RequirementDocStatus } {
  const payload = ensureRequirementDoc(appId, undefined, moduleId)
  return {
    filename: '01-REQUIREMENTS.md',
    content: payload.doc.contentMd,
    version: payload.doc.version,
    status: payload.doc.status
  }
}

const STORY_LINE = /^\s*(?:[-*+]|\d+\.)\s+\S|^\s*#{2,4}\s+\S|作为[^\n]{0,40}(?:我|用户|角色)/m

function storyItemCount(markdown: string): number {
  return String(markdown ?? '')
    .split('\n')
    .filter(line => /^\s*(?:[-*+]|\d+\.)\s+\S/.test(line)).length
}

/** 文档内结构化数据（仅未归档） */
export function outlineOfSections(sections: RequirementDocSection[]): RequirementOutlineData {
  return mergeOutline(
    sections
      .filter(section => isStructuredKind(section.kind))
      .map(section => section.data)
  )
}

export function outlineOfPayload(payload: RequirementDocPayload): RequirementOutlineData {
  return outlineOfSections(payload.sections)
}

export function validateRequirementDoc(payload: RequirementDocPayload): { errors: RequirementDocIssue[]; warnings: string[] } {
  const errors: RequirementDocIssue[] = []
  const warnings: string[] = []
  const outline = outlineOfPayload(payload)
  const epicsSection = payload.sections.find(section => section.kind === 'epics')
  const epicsData = epicsSection?.data
  const structuredEpics = Boolean(epicsData && (epicsData.epics.some(item => !item.archived) || epicsData.stories.some(item => !item.archived)))

  for (const section of payload.sections) {
    const body = section.markdown.trim()
    const structuredHasContent =
      isStructuredKind(section.kind) &&
      (section.kind === 'scenes'
        ? Boolean(section.data?.scenes.some(item => !item.archived))
        : Boolean(section.data?.epics.some(item => !item.archived) || section.data?.stories.some(item => !item.archived)))
    if (section.required && !body && !structuredHasContent) {
      errors.push({
        sectionKey: section.sectionKey,
        title: section.title,
        message: section.kind === 'epics' ? '至少需要 1 个 Epic / User Story' : '必填章节内容为空'
      })
    }
    if (body && /(待确认|待澄清|TODO)/i.test(body)) {
      warnings.push(`「${section.title}」仍有待确认/待澄清内容`)
    }
    if (section.kind === 'epics' && body && !structuredHasContent) {
      const count = storyItemCount(body)
      if (count < 1 && !STORY_LINE.test(body)) {
        errors.push({ sectionKey: section.sectionKey, title: section.title, message: '至少需要 1 个用户故事（列表项或故事标题）' })
      }
    }
  }

  if (structuredEpics) {
    if (!outline.epics.length) {
      errors.push({ sectionKey: epicsSection?.sectionKey ?? 'epics', title: epicsSection?.title ?? 'Epics & User Stories', message: '结构化数据里至少需要 1 个 Epic' })
    }
    if (!outline.stories.length) {
      errors.push({ sectionKey: epicsSection?.sectionKey ?? 'epics', title: epicsSection?.title ?? 'Epics & User Stories', message: '结构化数据里至少需要 1 个 Story' })
    }
    const accepted = outline.stories.filter(story => story.acceptance.length > 0).length
    if (outline.stories.length && !accepted) {
      errors.push({
        sectionKey: epicsSection?.sectionKey ?? 'epics',
        title: epicsSection?.title ?? 'Epics & User Stories',
        message: '至少需要 1 个 Story 带验收标准'
      })
    }
    for (const story of outline.stories) {
      if (!story.acceptance.length) warnings.push(`${story.id}「${story.title}」缺少验收标准`)
    }
    // #1.2 提示（不阻塞）：Epic 没有 Story 时设计阶段不会为它生成页面集
    for (const epic of outline.epics) {
      if (!outline.stories.some(story => story.epicId === epic.id)) {
        warnings.push(`${epic.id}「${epic.title}」没有 Story；请补充或让 AI 重新生成`)
      }
    }
  } else if (epicsSection) {
    warnings.push('Epics & User Stories 还是纯 Markdown 结构；建议用结构编辑器或“重建结构”建立稳定 ID（设计输入会标记 fallback）')
  }

  if (!structuredEpics && epicsSection && !epicsSection.markdown.trim()) {
    if (!errors.some(error => error.sectionKey === epicsSection.sectionKey)) {
      errors.push({ sectionKey: epicsSection.sectionKey, title: epicsSection.title, message: '至少需要 1 个 Epic / User Story' })
    }
  }
  // G1：引用了不存在的模块编号 → 非阻塞 warning（确认仍可完成）
  warnings.push(...unknownModuleRefWarnings(payload.doc.appId, payload.sections.map(section => section.markdown)))
  return { errors, warnings }
}

/**
 * 确认需求（M2：按模块）。
 *
 * - 只校验/确认该模块（必填章节非空 + 至少一个用户故事；待澄清只做警告）；
 * - R2b：确认时总会生成一个 `confirm` 版本（即使内容与上一版相同），
 *   保证 `startChangeSet` 的 `base_requirements_version` 指向已确认内容、取消变更可恢复；
 * - 单模块应用（仅 1 个未归档模块）→ 与旧行为完全一致：应用进入 design、
 *   `requirements_confirmed_at`、`updateActiveChangeSet`、生成需求 bundle v1；
 * - 多模块 → 只置该模块 confirmed，不改应用阶段（由 `POST /requirements-bundle/confirm` 推进）。
 */
export interface ConfirmDocResult {
  payload: RequirementDocPayload
  warnings: string[]
  alreadyConfirmed: boolean
  /** 应用级是否已确认（单模块确认 / bundle confirm 后为 true） */
  appConfirmed: boolean
  /** 仍未确认的必选模块（多模块场景） */
  pendingModuleIds: string[]
  module: RequirementModuleView | null
  /** 单模块确认时生成的 bundle 版本 */
  bundleVersion?: number
}

export function confirmRequirementDoc(appId: string, moduleId?: string): ConfirmDocResult {
  const app = appRowOrThrow(appId)
  const module = resolveModule(appId, moduleId)
  assertModuleInActiveChangeSet(appId, module.id)
  const payload = ensureRequirementDoc(appId, undefined, module.id)
  const pending = pendingModuleIds(appId)

  if (payload.doc.status === 'confirmed' || app.requirements_confirmed_at) {
    return {
      payload,
      warnings: [],
      alreadyConfirmed: true,
      appConfirmed: Boolean(app.requirements_confirmed_at),
      pendingModuleIds: pending,
      module: null
    }
  }
  if (app.status !== 'requirements') {
    throw new RequirementDocError(409, `当前阶段不是需求（${app.status}）`)
  }
  assertModuleWritable(module)

  const validation = validateRequirementDoc(payload)
  if (validation.errors.length) {
    throw new RequirementDocError(400, '需求文档尚未满足确认条件', validation.errors, validation.warnings)
  }

  const now = nowIso()
  const contentMd = renderContentMd(payload.doc.title, payload.sections)
  const nextVersion = payload.doc.version + 1
  const activeModules = db
    .prepare('SELECT COUNT(*) AS count FROM app_modules WHERE app_id = ? AND archived_at IS NULL')
    .get(appId) as { count: number }
  const singleModule = activeModules.count <= 1
  let bundleVersion: number | null = null
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE app_requirement_docs SET status = ?, confirmed_at = ?, content_md = ?, version = ?, updated_at = ?
      WHERE app_id = ? AND module_id = ?
    `).run('confirmed', now, contentMd, nextVersion, now, appId, module.id)
    snapshotVersion(appId, module.id, nextVersion, payload.doc.templateId, contentMd, payload.sections, 'confirm', now)
    recordStageEvent(appId, 'requirements', 'module-confirmed', {
      moduleId: module.id,
      moduleKey: module.module_key,
      version: nextVersion,
      templateId: payload.doc.templateId
    })
    if (singleModule) {
      db.prepare('UPDATE apps SET status = ?, requirements_confirmed_at = ?, updated_at = ? WHERE id = ?').run(
        'design',
        now,
        now,
        appId
      )
      recordStageEvent(appId, 'requirements', 'confirmed', {
        source: 'document',
        version: nextVersion,
        templateId: payload.doc.templateId,
        moduleId: module.id
      })
      // 单模块：需求确认即生成 bundle v1（M2：应用级快照）
      bundleVersion = createRequirementBundleSnapshot(appId, { requireConfirmed: true }).version
    }
  })
  tx()
  if (singleModule) {
    // 变更单阶段推进：需求确认后进入设计（C1 §4.2）；没有 active 变更单时静默跳过
    updateActiveChangeSet(appId, { status: 'design', requirementsVersion: nextVersion })
  }
  const next = ensureRequirementDoc(appId, undefined, module.id)
  const view = listModules(appId, true).find(item => item.id === module.id) ?? null
  return {
    payload: next,
    warnings: validation.warnings,
    alreadyConfirmed: false,
    appConfirmed: singleModule,
    pendingModuleIds: pendingModuleIds(appId),
    module: view,
    ...(bundleVersion ? { bundleVersion } : {})
  }
}

/** 版本列表：附带所属变更单序号（LEFT JOIN，历史面板显示“变更 #N”）；M2 按模块过滤 */
export function listDocVersions(appId: string, moduleId?: string): RequirementDocVersionMeta[] {
  const module = resolveModule(appId, moduleId)
  ensureRequirementDoc(appId, undefined, module.id)
  const rows = db
    .prepare(`
      SELECT v.version, v.source, v.created_at, v.content_md, v.change_set_id, cs.seq AS change_set_seq
      FROM app_requirement_doc_versions v
      LEFT JOIN app_change_sets cs ON cs.id = v.change_set_id AND cs.app_id = v.app_id
      WHERE v.app_id = ? AND v.module_id = ?
      ORDER BY v.version DESC
    `)
    .all(appId, module.id) as Array<
    Pick<VersionRow, 'version' | 'source' | 'created_at' | 'content_md' | 'change_set_id' | 'change_set_seq'>
  >
  return rows.map(row => ({
    version: row.version,
    source: (row.source as RequirementDocVersionSource) || 'manual',
    createdAt: row.created_at,
    title: '',
    size: Buffer.byteLength(row.content_md ?? '', 'utf8'),
    changeSetId: row.change_set_id ?? null,
    changeSetSeq: row.change_set_seq ?? null
  }))
}

export function getDocVersion(appId: string, version: unknown, moduleId?: string): RequirementDocVersionDetail {
  const module = resolveModule(appId, moduleId)
  ensureRequirementDoc(appId, undefined, module.id)
  const value = Number(version)
  if (!Number.isInteger(value) || value < 1) throw new RequirementDocError(400, '版本号不合法')
  const row = db
    .prepare(`
      SELECT v.*, cs.seq AS change_set_seq
      FROM app_requirement_doc_versions v
      LEFT JOIN app_change_sets cs ON cs.id = v.change_set_id AND cs.app_id = v.app_id
      WHERE v.app_id = ? AND v.module_id = ? AND v.version = ?
    `)
    .get(appId, module.id, value) as VersionRow | undefined
  if (!row) throw new RequirementDocError(404, `版本不存在：v${value}`)
  const sections = readVersionSections(row.sections_json)
  return {
    version: row.version,
    source: (row.source as RequirementDocVersionSource) || 'manual',
    createdAt: row.created_at,
    title: '',
    size: Buffer.byteLength(row.content_md ?? '', 'utf8'),
    changeSetId: row.change_set_id ?? null,
    changeSetSeq: row.change_set_seq ?? null,
    contentMd: row.content_md,
    sections
  }
}

export function rollbackDocVersion(appId: string, version: unknown, moduleId?: string): RequirementDocPayload {
  const module = resolveModule(appId, moduleId)
  assertModuleWritable(module)
  assertModuleInActiveChangeSet(appId, module.id)
  const detail = getDocVersion(appId, version, module.id)
  const payload = ensureRequirementDoc(appId, undefined, module.id)
  assertDocEditable(payload)
  const now = nowIso()
  const sections = detail.sections.map((section, index) => ({ ...section, position: index, updatedAt: now }))
  if (!sections.length) throw new RequirementDocError(400, '该版本没有章节快照，无法回滚')
  const next = persistDocContent(appId, module, payload.doc, sections, 'rollback', true)
  if (next.doc.status === 'confirmed') {
    db.prepare("UPDATE app_requirement_docs SET status = 'draft', confirmed_at = NULL WHERE app_id = ? AND module_id = ?").run(
      appId,
      module.id
    )
    return ensureRequirementDoc(appId, undefined, module.id)
  }
  return next
}

/**
 * 手动“保存版本”（R2b）：把当前服务器内容快照为新版本（source `manual`）。
 *
 * 自动保存不再产版本，用户需要显式打 checkpoint；前端调用前会先 flush 未保存编辑。
 * 文档已确认（只读）时返回 409：确认版本已存在，如需新版本请先重新编辑需求。
 */
export function createManualDocVersion(appId: string, moduleId?: string): RequirementDocPayload {
  const module = resolveModule(appId, moduleId)
  assertModuleWritable(module)
  assertModuleInActiveChangeSet(appId, module.id)
  const payload = ensureRequirementDoc(appId, undefined, module.id)
  if (payload.doc.status === 'confirmed') {
    throw new RequirementDocError(409, '文档已确认；确认版本已存在，如需新版本请先重新编辑需求')
  }
  const now = nowIso()
  const contentMd = renderContentMd(payload.doc.title, payload.sections)
  const nextVersion = payload.doc.version + 1
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE app_requirement_docs SET content_md = ?, version = ?, updated_at = ? WHERE app_id = ? AND module_id = ?
    `).run(contentMd, nextVersion, now, appId, module.id)
    snapshotVersion(appId, module.id, nextVersion, payload.doc.templateId, contentMd, payload.sections, 'manual', now)
  })
  tx()
  return ensureRequirementDoc(appId, undefined, module.id)
}

/** 从章节 Markdown 重建结构化数据（确定性解析；结果由用户复核） */
export function rebuildRequirementOutline(appId: string, sectionKey?: string, moduleId?: string): RequirementDocPayload {
  const module = resolveModule(appId, moduleId)
  assertModuleWritable(module)
  assertModuleInActiveChangeSet(appId, module.id)
  const payload = ensureRequirementDoc(appId, undefined, module.id)
  assertDocEditable(payload)
  const reservedIds = collectAppOutlineIds(appId)
  const sections = payload.sections
  const targetKey = asString(sectionKey).trim()
  const targets = sections.filter(section => {
    if (!isStructuredKind(section.kind)) return false
    return targetKey ? section.sectionKey === targetKey : true
  })
  if (targetKey && !targets.length) throw new RequirementDocError(400, `章节不是结构化章节：${targetKey}`)
  if (!targets.length) throw new RequirementDocError(400, '当前模板没有 scenes / epics 结构化章节')

  const warnings: string[] = []
  for (const target of targets) {
    const kind = outlineKindOf(target.kind)
    if (!kind) continue
    const global = outlineOfSections(sections.filter(section => section.sectionKey !== target.sectionKey))
    const result = rebuildOutlineSection(kind, target.markdown, target.data ?? null, global, reservedIds)
    const active =
      kind === 'scenes'
        ? result.data.scenes.some(item => !item.archived)
        : result.data.epics.some(item => !item.archived)
    if (!active && target.markdown.trim()) {
      warnings.push(`「${target.title}」未能从 Markdown 解析出条目，已跳过`)
      continue
    }
    target.data = result.data
    target.markdown = renderOutlineMarkdown(kind, result.data)
    target.updatedAt = nowIso()
    warnings.push(...result.warnings.map(warning => warning.message))
  }
  const saved = persistDocContent(appId, module, payload.doc, sections, 'manual', true)
  return { ...saved, ...(warnings.length ? { warnings } : {}) }
}

/**
 * 重新编辑需求：模块文档回到 draft、应用回到需求阶段。
 *
 * M2 限制：沿用“单设计项目退回 draft”的应用级行为（设计模块化在 M4）；
 * 清 `apps.requirements_confirmed_at` 后需要重新走模块确认 + bundle confirm。
 */
export function reopenRequirementDoc(appId: string, moduleId?: string): RequirementDocPayload {
  const app = appRowOrThrow(appId)
  const module = resolveModule(appId, moduleId)
  assertModuleWritable(module)
  assertModuleInActiveChangeSet(appId, module.id)
  const payload = ensureRequirementDoc(appId, undefined, module.id)
  if (payload.doc.status !== 'confirmed') return payload
  // C1 门禁：变更中按 scope 限制；开发/完成阶段必须先发起变更（scope=requirements）
  const active = activeChangeSetRow(appId)
  if (active && active.scope !== 'requirements') {
    throw new RequirementDocError(409, '本次变更范围是“仅设计”，不能修改需求；如需改需求请先取消本次变更，再发起“需求+设计”变更')
  }
  if (!active && (app.status === 'development' || app.status === 'completed')) {
    throw new RequirementDocError(
      409,
      '应用已进入开发阶段；如需修改需求，请先在应用头部“发起变更”（范围：需求+设计）；纯代码修复请直接在开发会话进行'
    )
  }
  const now = nowIso()
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE app_requirement_docs SET status = ?, confirmed_at = NULL, updated_at = ? WHERE app_id = ? AND module_id = ?
    `).run('draft', now, appId, module.id)
    db.prepare('UPDATE apps SET status = ?, requirements_confirmed_at = NULL, updated_at = ? WHERE id = ?').run(
      'requirements',
      now,
      appId
    )
    // 需求已变更：**同模块**已确认设计必须退回 draft（M4 模块隔离），避免“设计已确认但需求过期”进入 D5 交接包
    const design = db
      .prepare('SELECT status FROM app_design_projects WHERE app_id = ? AND module_id = ?')
      .get(appId, module.id) as { status: string } | undefined
    if (design?.status === 'confirmed') {
      db.prepare(
        'UPDATE app_design_projects SET status = ?, confirmed_at = NULL, updated_at = ? WHERE app_id = ? AND module_id = ?'
      ).run('draft', now, appId, module.id)
      recordStageEvent(appId, 'design', 'design-reopened', { reason: 'requirements-reopened', moduleId: module.id })
    }
    recordStageEvent(appId, 'requirements', 'reopened', { version: payload.doc.version, moduleId: module.id })
  })
  tx()
  return ensureRequirementDoc(appId, undefined, module.id)
}

/**
 * 取消变更：把需求文档恢复为基线版本的已确认快照（内部方法，C1 §4.3）。
 *
 * 与 rollbackDocVersion 的区别：后者受“已确认只读”守卫限制，且恢复后回到 draft；
 * 这里按变更取消语义恢复内容并保持 confirmed，追加一个新版本（不物理删除变更中产生的版本）。
 */
export function restoreRequirementDocVersionConfirmed(appId: string, version: unknown, moduleId?: string): RequirementDocPayload {
  appRowOrThrow(appId)
  const module = resolveModule(appId, moduleId)
  ensureRequirementDoc(appId, undefined, module.id)
  const value = Number(version)
  if (!Number.isInteger(value) || value < 1) throw new RequirementDocError(409, '基线需求版本不合法，无法恢复')
  const row = db
    .prepare('SELECT * FROM app_requirement_doc_versions WHERE app_id = ? AND module_id = ? AND version = ?')
    .get(appId, module.id, value) as VersionRow | undefined
  if (!row) throw new RequirementDocError(409, `基线需求版本 v${value} 不存在，无法取消变更`)
  const sections = readVersionSections(row.sections_json)
  if (!sections.length) throw new RequirementDocError(409, `基线需求版本 v${value} 没有章节快照，无法取消变更`)

  const now = nowIso()
  const current = docRowOf(appId, module.id)
  if (!current) throw new RequirementDocError(409, '需求文档不存在，无法取消变更')
  const nextVersion = current.version + 1
  const restored = sections.map((section, index) => ({ ...section, position: index, updatedAt: now }))
  const contentMd = renderContentMd(current.title, restored)
  const tx = db.transaction(() => {
    writeSections(appId, module.id, restored, now)
    db.prepare(`
      UPDATE app_requirement_docs SET template_id = ?, content_md = ?, status = 'confirmed',
        confirmed_at = ?, version = ?, updated_at = ? WHERE app_id = ? AND module_id = ?
    `).run(row.template_id, contentMd, now, nextVersion, now, appId, module.id)
    snapshotVersion(appId, module.id, nextVersion, row.template_id, contentMd, restored, 'restore', now)
    // MF3：只有全部必选未归档模块都确认时才把应用标成“需求已确认”；
    // 多模块下恢复单个模块时，其它模块仍 draft，应用保持未确认（与 bundle 门禁一致）。
    if (allRequiredModulesConfirmed(appId)) {
      db.prepare('UPDATE apps SET requirements_confirmed_at = ?, updated_at = ? WHERE id = ?').run(now, now, appId)
    } else {
      db.prepare('UPDATE apps SET requirements_confirmed_at = NULL, updated_at = ? WHERE id = ?').run(now, appId)
    }
    recordStageEvent(appId, 'requirements', 'restored', {
      reason: 'change-set-cancelled',
      baseVersion: value,
      version: nextVersion,
      moduleId: module.id
    })
  })
  tx()
  return ensureRequirementDoc(appId, undefined, module.id)
}

/** 应用详情/首页摘要（M2：默认模块摘要；无模块/文档返回 null，不创建） */
export function requirementDocSummary(appId: string): {
  status: RequirementDocStatus
  version: number
  templateId: string
  templateName: string
  title: string
  updatedAt: string
  moduleId?: string
  moduleKey?: string
} | null {
  const module = defaultModule(appId)
  if (!module) return null
  const row = docRowOf(appId, module.id)
  if (!row) return null
  let templateName = row.template_id
  try {
    templateName = getTemplateOrThrow(row.template_id).name
  } catch {
    // 模板被删除时保留 id
  }
  return {
    status: rowToDoc(row, module).status,
    version: row.version,
    templateId: row.template_id,
    templateName,
    title: row.title,
    updatedAt: row.updated_at,
    moduleId: module.id,
    moduleKey: module.module_key
  }
}

/** 供 chat doc 模式构造 prompt 的上下文 */
export interface DocChatContext {
  doc: RequirementDoc
  template: RequirementTemplate
  sections: RequirementDocSection[]
  focusSectionKey: string
  appName: string
}

export function loadDocChatContext(appId: string, templateId?: string, focusSectionKey?: string, moduleId?: string): DocChatContext {
  const payload = ensureRequirementDoc(appId, templateId, moduleId)
  const app = appRowOrThrow(appId)
  const focus = asString(focusSectionKey).trim()
  return {
    doc: payload.doc,
    template: payload.template,
    sections: payload.sections,
    focusSectionKey: payload.sections.some(section => section.sectionKey === focus) ? focus : '',
    appName: app.name
  }
}
