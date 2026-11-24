/**
 * 产物解析：`docs/` 是唯一事实源（D1，去模块）
 *
 * - 需求：`docs/requirements/requirements.md` → frontmatter（title/template）+ `##` 章节 + Epic/Story 大纲
 * - 实体集：`docs/design/entities.json` → schema 校验 + 实体/关系 + 错误/警告
 * - 页面集：`docs/design/pages.json` → schema 校验 + 页面集/页面契约 + 错误/警告
 * - 聚合：`{ appId, requirement, entities, pages, errors, hashes, designHash }`
 *
 * 校验错误**不抛 500**：作为 artifacts 的一部分返回，UI 显示“文件/字段/期望”。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { appDirOf } from '../apps/scaffold'
import { parseFrontmatter, splitMarkdownSections } from './frontmatter'
import { validateJsonSchema, type SchemaError } from './schema'
import { designContractWarnings } from './design-contract'
import { readDesignBrief, readDesignTokens, readPrototypeArtifact, type PrototypeArtifact } from '../design/prototypes'
import { readUiCheck, type UiCheckStatus } from '../dev/ui-check'
import { readApiDesign, type ApiDesignArtifact } from '../dev/api-design'
import { designHashOf } from '../design/hash'
import { REQUIREMENTS_RELATIVE, requirementsFilePath } from '../requirements/doc-file'

export interface ArtifactError {
  file: string
  path: string
  message: string
  expected?: string
}

export interface RequirementSection {
  key: string
  title: string
  level: number
  markdown: string
}

export interface RequirementEpicStory {
  id: string
  title: string
}

export interface RequirementEpic extends RequirementEpicStory {
  stories: RequirementEpicStory[]
}

export interface RequirementArtifact {
  exists: boolean
  file: string
  title: string
  template: string
  sections: RequirementSection[]
  /** 从章节大纲解析出的 Epic/Story（供设计页面集与前端 TOC 使用） */
  epics: RequirementEpic[]
  errors: ArtifactError[]
  warnings: string[]
}

export interface EntitiesArtifact {
  exists: boolean
  file: string
  schemaVersion?: number
  entities: unknown[]
  relations: unknown[]
  errors: ArtifactError[]
  warnings: string[]
  hash: string
}

export interface PagesArtifact {
  exists: boolean
  file: string
  schemaVersion?: number
  pageSets: unknown[]
  pages: unknown[]
  pageCount: number
  errors: ArtifactError[]
  warnings: string[]
  hash: string
}

export interface ArtifactsResponse {
  appId: string
  requirement: RequirementArtifact
  entities: EntitiesArtifact
  pages: PagesArtifact
  /** 支撑产物（只读；无 manifest 时省略） */
  prototypes?: PrototypeArtifact
  brief: { exists: boolean; file: string }
  tokens: { exists: boolean; styleId?: string }
  uiCheck: { exists: boolean; file: string; status: UiCheckStatus }
  /** D2：接口设计文档（无文件时 exists:false） */
  apiDesign: ApiDesignArtifact
  errors: ArtifactError[]
  hashes: Record<string, string>
  /** sha256(entities.json + pages.json + design-system.json) */
  designHash: string
}

const ENTITIES_RELATIVE = 'docs/design/entities.json'
const PAGES_RELATIVE = 'docs/design/pages.json'
const EPIC_PATTERN = /^(EP-\d{3,})\s*(.*)$/
const STORY_PATTERN = /^(US-\d{3,})\s*(.*)$/

function relative(appDir: string, file: string): string {
  return path.relative(appDir, file).replace(/\\/g, '/')
}

function listFiles(directory: string, out: string[] = []): string[] {
  if (!fs.existsSync(directory)) return out
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) listFiles(full, out)
    else if (entry.isFile()) out.push(full)
  }
  return out
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function sha256(file: string): string {
  try {
    return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  } catch {
    return ''
  }
}

/** docs/ 下所有文件的 hash（相对路径 → sha256） */
export function docsHashes(appDir: string): Record<string, string> {
  const hashes: Record<string, string> = {}
  for (const file of listFiles(path.join(appDir, 'docs')).sort()) {
    try {
      hashes[relative(appDir, file)] = createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    } catch {
      // 文件在扫描过程中被删除：忽略
    }
  }
  return hashes
}

/** 从章节大纲解析 Epic/Story（标题形如 `EP-001 商品管理` / `US-001 商品列表`） */
export function epicsFromSections(sections: RequirementSection[]): RequirementEpic[] {
  const epics: RequirementEpic[] = []
  let current: RequirementEpic | null = null
  for (const section of sections) {
    const epic = EPIC_PATTERN.exec(section.title)
    if (epic) {
      current = { id: epic[1], title: epic[2].trim(), stories: [] }
      epics.push(current)
      continue
    }
    const story = STORY_PATTERN.exec(section.title)
    if (story && current) current.stories.push({ id: story[1], title: story[2].trim() })
  }
  return epics
}

/** 需求单文档解析（不改文件） */
export function readRequirement(appDir: string): RequirementArtifact {
  const file = REQUIREMENTS_RELATIVE
  const full = requirementsFilePath(appDir)
  const errors: ArtifactError[] = []
  const warnings: string[] = []
  if (!fs.existsSync(full)) {
    return { exists: false, file, title: '', template: '', sections: [], epics: [], errors, warnings }
  }
  let raw = ''
  try {
    raw = fs.readFileSync(full, 'utf8')
  } catch (error) {
    errors.push({ file, path: '$', message: `无法读取文件：${error instanceof Error ? error.message : String(error)}` })
    return { exists: true, file, title: '', template: '', sections: [], epics: [], errors, warnings }
  }

  const parsed = parseFrontmatter(raw)
  for (const message of parsed.errors) errors.push({ file, path: 'frontmatter', message })

  const title = (parsed.data.title ?? '').trim()
  if (!title) errors.push({ file, path: 'title', message: '缺少 title', expected: '文档标题' })
  const template = (parsed.data.template ?? '').trim()
  if (!template) warnings.push('frontmatter 缺少 template（应用默认需求模板仍可读取）')
  for (const key of ['module', 'order']) {
    if (parsed.data[key] !== undefined) warnings.push(`frontmatter 不再使用 ${key}（单需求文档只保留 title/template）`)
  }

  const sections = splitMarkdownSections(parsed.body).map(section => ({
    key: section.key,
    title: section.title,
    level: section.level,
    markdown: section.markdown.trim()
  }))
  const epics = epicsFromSections(sections)
  if (!sections.length) warnings.push('文档还没有章节：按需求模板补全')
  if (!epics.length) warnings.push('文档还没有 Epic（约定 `### EP-001 标题`）；设计页面集将无法引用')

  const seen = new Map<string, string>()
  for (const epic of epics) {
    const first = seen.get(epic.id)
    if (first) warnings.push(`Epic ID 重复：${epic.id}`)
    else seen.set(epic.id, epic.title)
  }

  return { exists: true, file, title, template, sections, epics, errors, warnings }
}

/** schema 来源：优先应用内副本（agent 读到的同一份），否则仓库资产 */
export function designSchemaPath(appDir: string, name: 'entities.schema.json' | 'pages.schema.json'): string | null {
  const candidates = [
    path.join(appDir, '.opencode', 'skills', 'adw-design-artifacts', 'references', name),
    path.resolve(__dirname, '../../../templates/agent/skills/adw-design-artifacts/references', name)
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function loadSchema(appDir: string, name: 'entities.schema.json' | 'pages.schema.json'): Record<string, unknown> | null {
  const file = designSchemaPath(appDir, name)
  if (!file) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function schemaErrors(schema: Record<string, unknown> | null, data: unknown, file: string): ArtifactError[] {
  if (!schema) return [{ file, path: '$', message: '缺少设计 schema，无法校验', expected: 'schema' }]
  return (validateJsonSchema(schema, data) as SchemaError[]).map(error => ({
    file,
    path: error.path,
    message: error.message,
    ...(error.expected ? { expected: error.expected } : {})
  }))
}

/** 实体字段 code 集合（页面字段引用校验用） */
function entityFieldCodes(entity: Record<string, unknown>): Set<string> {
  const codes = new Set<string>()
  for (const raw of asArray(entity.fields)) {
    const field = asRecord(raw)
    const code = text(field?.code)
    if (code) codes.add(code)
  }
  return codes
}

function checkFieldRefs(page: Record<string, unknown>, id: string, codes: Set<string>, warnings: string[], entityId: string): void {
  const groups: Array<[string, unknown]> = [
    ['columns', page.columns],
    ['filters', page.filters],
    ['form.fields', asRecord(page.form)?.fields],
    ['tree.titleField', asRecord(page.tree)?.titleField],
    ['tree.parentField', asRecord(page.tree)?.parentField]
  ]
  for (const [label, value] of groups) {
    const values = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
    for (const item of values) {
      const code = text(item)
      if (code && !codes.has(code)) warnings.push(`页面 ${id} 的 ${label} 引用了实体 ${entityId} 不存在的字段 code：${code}`)
    }
    if (label === 'form.fields') {
      for (const raw of asArray(asRecord(page.form)?.groups)) {
        const group = asRecord(raw)
        for (const item of asArray(group?.fields)) {
          const code = text(item)
          if (code && !codes.has(code)) {
            warnings.push(`页面 ${id} 的 form.groups 引用了实体 ${entityId} 不存在的字段 code：${code}`)
          }
        }
        void group
      }
    }
  }
}

/** 实体集解析 + schema 校验（不改文件） */
export function readEntities(appDir: string): EntitiesArtifact {
  const file = ENTITIES_RELATIVE
  const full = path.join(appDir, 'docs', 'design', 'entities.json')
  const errors: ArtifactError[] = []
  const warnings: string[] = []
  const hash = sha256(full)
  if (!fs.existsSync(full)) {
    return { exists: false, file, entities: [], relations: [], errors, warnings, hash }
  }
  let data: Record<string, unknown>
  try {
    data = JSON.parse(fs.readFileSync(full, 'utf8')) as Record<string, unknown>
  } catch (error) {
    errors.push({
      file,
      path: '$',
      message: `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`,
      expected: 'valid json'
    })
    return { exists: true, file, entities: [], relations: [], errors, warnings, hash }
  }
  const schema = loadSchema(appDir, 'entities.schema.json')
  errors.push(...schemaErrors(schema, data, file))

  const entities = asArray(data.entities)
  const relations = asArray(data.relations)
  const entityIds = new Set<string>()
  for (const raw of entities) {
    const entity = asRecord(raw)
    const id = text(entity?.id)
    if (!id) continue
    if (entityIds.has(id)) warnings.push(`实体 id 重复：${id}（保留全部，ER 只渲染一次）`)
    entityIds.add(id)
    const codes = new Set<string>()
    for (const rawField of asArray(entity?.fields)) {
      const field = asRecord(rawField)
      const code = text(field?.code)
      if (!code) continue
      if (codes.has(code)) warnings.push(`实体 ${id} 的字段 code 重复：${code}`)
      codes.add(code)
      if (text(field?.type) === 'enum' && !asArray(field?.options).length) {
        warnings.push(`实体 ${id} 的枚举字段 ${code} 缺少 options（value/label）`)
      }
    }
  }
  for (const raw of relations) {
    const relation = asRecord(raw)
    const from = text(relation?.from)
    const to = text(relation?.to)
    if (from && !entityIds.has(from)) warnings.push(`关系 from 引用不存在的实体：${from}`)
    if (to && !entityIds.has(to)) warnings.push(`关系 to 引用不存在的实体：${to}`)
  }
  const schemaVersion = typeof data.schemaVersion === 'number' ? data.schemaVersion : undefined
  return {
    exists: true,
    file,
    ...(schemaVersion === undefined ? {} : { schemaVersion }),
    entities,
    relations,
    errors,
    warnings,
    hash
  }
}

/** 页面集解析 + schema 校验（不改文件） */
export function readPages(appDir: string, requirement?: RequirementArtifact): PagesArtifact {
  const file = PAGES_RELATIVE
  const full = path.join(appDir, 'docs', 'design', 'pages.json')
  const errors: ArtifactError[] = []
  const warnings: string[] = []
  const hash = sha256(full)
  if (!fs.existsSync(full)) {
    return { exists: false, file, pageSets: [], pages: [], pageCount: 0, errors, warnings, hash }
  }
  let data: Record<string, unknown>
  try {
    data = JSON.parse(fs.readFileSync(full, 'utf8')) as Record<string, unknown>
  } catch (error) {
    errors.push({
      file,
      path: '$',
      message: `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`,
      expected: 'valid json'
    })
    return { exists: true, file, pageSets: [], pages: [], pageCount: 0, errors, warnings, hash }
  }
  const schema = loadSchema(appDir, 'pages.schema.json')
  errors.push(...schemaErrors(schema, data, file))
  for (const warning of designContractWarnings(data)) warnings.push(`${warning.path}：${warning.message}`)

  const entitiesArtifact = readEntities(appDir)
  const entities = new Map<string, Record<string, unknown>>()
  for (const raw of entitiesArtifact.entities) {
    const entity = asRecord(raw)
    const id = text(entity?.id)
    if (id) entities.set(id, entity ?? {})
  }
  const epicTitles = new Map((requirement?.epics ?? []).map(epic => [epic.id, epic.title]))
  const pageSets = asArray(data.pageSets)
  const pages: unknown[] = []
  const seenPages = new Set<string>()
  const seenSets = new Set<string>()
  for (const raw of pageSets) {
    const pageSet = asRecord(raw)
    const setId = text(pageSet?.id)
    if (setId) {
      if (seenSets.has(setId)) warnings.push(`页面集 id 重复：${setId}`)
      seenSets.add(setId)
    }
    const epic = text(pageSet?.epic)
    const setTitle = text(pageSet?.title)
    if (epic && requirement?.exists) {
      if (!epicTitles.has(epic)) warnings.push(`页面集 ${setId || '(未命名)'} 的 epic ${epic} 不在需求文档中`)
      else if (setTitle && epicTitles.get(epic) && epicTitles.get(epic) !== setTitle) {
        warnings.push(`页面集 ${setId} 的标题「${setTitle}」与 Epic ${epic} 标题「${epicTitles.get(epic)}」不一致`)
      }
    }
    const primary = text(pageSet?.primaryEntity)
    if (primary && !entities.has(primary)) warnings.push(`页面集 ${setId} 的 primaryEntity 不存在：${primary}`)
    for (const rawPage of asArray(pageSet?.pages)) {
      const page = asRecord(rawPage)
      if (!page) continue
      const id = text(page.id)
      if (id) {
        if (seenPages.has(id)) {
          warnings.push(`页面 id 重复：${id}（应用内唯一；保留第一个）`)
          continue
        }
        seenPages.add(id)
      }
      if (page.actions !== undefined) warnings.push(`页面 ${id} 不再写 actions；渲染器从 rowActions/toolbarActions 派生`)
      const entityId = text(page.entity)
      if (entityId && !entities.has(entityId)) warnings.push(`页面 ${id} 引用的实体不存在：${entityId}`)
      if (entityId && entities.has(entityId)) {
        checkFieldRefs(page, id, entityFieldCodes(entities.get(entityId) ?? {}), warnings, entityId)
      }
      for (const rawSub of asArray(page.subTables)) {
        const sub = asRecord(rawSub)
        const subEntity = text(sub?.entity)
        if (!subEntity) continue
        if (!entities.has(subEntity)) {
          warnings.push(`页面 ${id} 的子表实体不存在：${subEntity}`)
          continue
        }
        const codes = entityFieldCodes(entities.get(subEntity) ?? {})
        for (const item of asArray(sub?.columns)) {
          const code = text(item)
          if (code && !codes.has(code)) warnings.push(`页面 ${id} 的子表 ${subEntity} 引用了不存在的字段 code：${code}`)
        }
      }
      pages.push(page)
    }
  }
  const schemaVersion = typeof data.schemaVersion === 'number' ? data.schemaVersion : undefined
  return {
    exists: true,
    file,
    ...(schemaVersion === undefined ? {} : { schemaVersion }),
    pageSets,
    pages,
    pageCount: pages.length,
    errors,
    warnings,
    hash
  }
}

/** 聚合：需求 + 实体集 + 页面集 + 支撑产物 + 错误 + hash（GET /api/apps/:id/artifacts） */
export function readArtifacts(appId: string): ArtifactsResponse {
  const appDir = appDirOf(appId)
  if (!fs.existsSync(appDir)) {
    return {
      appId,
      requirement: {
        exists: false,
        file: REQUIREMENTS_RELATIVE,
        title: '',
        template: '',
        sections: [],
        epics: [],
        errors: [{ file: '', path: '$', message: `应用目录不存在：${appDir}` }],
        warnings: []
      },
      entities: { exists: false, file: ENTITIES_RELATIVE, entities: [], relations: [], errors: [], warnings: [], hash: '' },
      pages: { exists: false, file: PAGES_RELATIVE, pageSets: [], pages: [], pageCount: 0, errors: [], warnings: [], hash: '' },
      brief: { exists: false, file: 'docs/design/design-brief.md' },
      tokens: { exists: false },
      uiCheck: { exists: false, file: 'docs/design/ui-check.md', status: 'missing' },
      apiDesign: {
        exists: false,
        file: 'docs/design/api-design.md',
        markdown: '',
        interfaces: [],
        byEpic: [],
        errors: [],
        warnings: [],
        coverage: { pageActions: [], entities: [] }
      },
      errors: [{ file: '', path: '$', message: `应用目录不存在：${appDir}` }],
      hashes: {},
      designHash: ''
    }
  }
  const requirement = readRequirement(appDir)
  const entities = readEntities(appDir)
  const pages = readPages(appDir, requirement)
  const prototypes = readPrototypeArtifact(appDir)
  const apiDesign = readApiDesign(appDir)
  const errors = [...requirement.errors, ...entities.errors, ...pages.errors, ...apiDesign.errors]
  return {
    appId,
    requirement,
    entities,
    pages,
    ...(prototypes ? { prototypes } : {}),
    brief: readDesignBrief(appDir),
    tokens: readDesignTokens(appDir),
    uiCheck: readUiCheck(appDir),
    apiDesign,
    errors,
    hashes: docsHashes(appDir),
    designHash: designHashOf(appDir)
  }
}
