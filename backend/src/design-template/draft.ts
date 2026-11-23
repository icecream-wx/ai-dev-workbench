/**
 * 设计模板草稿（P7-7a）
 *
 * 目录：`<studio>/drafts/<packId>/{draft.json,spec.json,notes.md,pack/,generation.json}`
 *
 * - `draftId = packId`（不可变）；一个模板一个草稿；
 * - agent 只写 `spec.json`（+ 可选 notes.md），pack 由生成器产出；
 * - `createdAt/updatedAt` 只存在 draft.json，不进入 pack.json；
 * - 发布后不删除草稿（继续编辑同一模板）。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { db, nowIso } from '../db'
import {
  defaultPackId,
  getApplicationType,
  getBuiltinPack,
  getPack,
  getStyle,
  isBuiltinPackId,
  validatePackDir,
  type DesignPack
} from '../design/pack'
import { DesignError } from '../design/errors'
import { normalizeDraftSpec } from './spec'
import type { SpecIssue } from './core'
import {
  assertPackId,
  dirExists,
  draftDir,
  draftGenerationFile,
  draftJsonFile,
  draftPackDir,
  draftSpecFile,
  ensureStudioDirs,
  fileExists,
  listCustomPackIds,
  listDraftIds,
  readJsonFile,
  stripBom,
  writeJsonAtomic
} from './paths'

export type DraftStatus = 'draft' | 'published'

export interface DraftJson {
  schemaVersion: 1
  id: string
  name: string
  style: string
  baseApplicationType: string
  status: DraftStatus
  createdAt: string
  updatedAt: string
  publishedVersion: string | null
  lastSpecHash: string | null
}

export interface DraftValidation {
  ok: boolean
  errors: SpecIssue[]
  warnings: SpecIssue[]
}

export interface DraftSummary {
  id: string
  name: string
  status: DraftStatus
  style: string
  baseApplicationType: string
  version: string | null
  publishedVersion: string | null
  createdAt: string
  updatedAt: string
  pageCount: number
  hasPack: boolean
  hasSpec: boolean
  validation: DraftValidation
  pack?: { id: string; version: string; revision: number; pageCount: number; pages: PackPageSummary[] }
}

export interface PackPageSummary {
  id: string
  name: string
  kind: string
  recipe: string
  source?: string
  blueprint?: string
}

export interface GenerationFile {
  generatedAt: string
  specHash: string
  pageCount: number
  pack: { id: string; name: string; version: string; revision: number; pageCount: number }
  sources: string[]
  css?: Record<string, unknown>
  warnings: SpecIssue[]
  errors: SpecIssue[]
}

export interface DraftDetail {
  draft: DraftJson
  spec: Record<string, unknown> | null
  specError: string | null
  packSummary: DraftSummary['pack'] | null
  /** 权威 pack（已生成且通过 `pack.ts#validatePackDir`；供工作室/模板预览读取页面契约） */
  pack: DesignPack | null
  generation: GenerationFile | null
  validation: DraftValidation
}

interface CreateDraftInput {
  name?: unknown
  id?: unknown
  style?: unknown
  baseApplicationType?: unknown
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function randomSuffix(): string {
  return crypto.randomBytes(2).toString('hex')
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40)
}

function readDraftJson(packId: string): DraftJson | null {
  return readJsonFile<DraftJson>(draftJsonFile(packId))
}

function writeDraftJson(draft: DraftJson): void {
  writeJsonAtomic(draftJsonFile(draft.id), draft)
}

export function packPageSummaries(pack: DesignPack): PackPageSummary[] {
  const pages: PackPageSummary[] = []
  for (const type of pack.applicationTypes) {
    for (const page of type.pages) {
      pages.push({
        id: page.id,
        name: page.name,
        kind: page.kind,
        recipe: page.recipe,
        ...(page.source ? { source: `${page.source.applicationType}/${page.source.pageId}` } : {}),
        ...(page.blueprint ? { blueprint: page.blueprint } : {})
      })
    }
  }
  return pages
}

/** 校验草稿 spec + 已生成 pack（spec 只 warning 不阻断生成不了时也给出） */
export function validateDraft(packId: string): DraftValidation {
  const errors: SpecIssue[] = []
  const warnings: SpecIssue[] = []
  const reservedIds = listCustomPackIds().filter(id => id !== packId)
  const specFile = draftSpecFile(packId)
  if (fileExists(specFile)) {
    try {
      const raw = JSON.parse(stripBom(fs.readFileSync(specFile, 'utf8'))) as unknown
      const normalized = normalizeDraftSpec(raw, { packId, reservedIds })
      errors.push(...normalized.errors)
      warnings.push(...normalized.warnings)
    } catch (error) {
      errors.push({
        code: 'spec-invalid',
        path: '$',
        message: `spec.json 解析失败：${error instanceof Error ? error.message : String(error)}`
      })
    }
  } else {
    errors.push({ code: 'spec-invalid', path: '$', message: 'spec.json 不存在' })
  }
  const packDir = draftPackDir(packId)
  if (dirExists(packDir)) {
    const packValidation = validatePackDir(packDir, packId)
    for (const issue of packValidation.errors) {
      errors.push({ code: issue.code, path: issue.path ?? 'pack', message: issue.message })
    }
    for (const issue of packValidation.warnings) {
      if (!warnings.some(item => item.code === issue.code && item.message === issue.message)) {
        warnings.push({ code: issue.code, path: issue.path ?? 'pack', message: issue.message })
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings }
}

function packSummaryOf(packId: string): DraftSummary['pack'] | null {
  const packDir = draftPackDir(packId)
  if (!dirExists(packDir)) return null
  const validation = validatePackDir(packDir, packId)
  if (!validation.ok || !validation.pack) return null
  const pack = validation.pack
  return {
    id: pack.id,
    version: pack.version,
    revision: pack.origin?.revision ?? 0,
    pageCount: pack.applicationTypes.reduce((total, type) => total + type.pages.length, 0),
    pages: packPageSummaries(pack)
  }
}

export function draftExists(packId: string): boolean {
  return fileExists(draftJsonFile(packId))
}

export function draftSummary(packId: string): DraftSummary {
  const id = assertPackId(packId)
  if (!draftExists(id)) throw new DesignError(404, `设计模板草稿不存在：${id}`)
  const draft = readDraftJson(id) as DraftJson
  const pack = packSummaryOf(id)
  return {
    id: draft.id,
    name: draft.name,
    status: draft.status,
    style: draft.style,
    baseApplicationType: draft.baseApplicationType,
    version: draft.publishedVersion,
    publishedVersion: draft.publishedVersion,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    pageCount: pack?.pageCount ?? 0,
    hasPack: Boolean(pack),
    hasSpec: fileExists(draftSpecFile(id)),
    validation: validateDraft(id),
    ...(pack ? { pack } : {})
  }
}

export function listDrafts(): DraftSummary[] {
  return listDraftIds().map(id => {
    try {
      return draftSummary(id)
    } catch (error) {
      console.warn(`[design-template] 跳过无效草稿 ${id}：${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }).filter((item): item is DraftSummary => Boolean(item))
}

export function getDraftDetail(packId: string): DraftDetail {
  const summary = draftSummary(packId)
  const draft = readDraftJson(summary.id) as DraftJson
  const specFile = draftSpecFile(summary.id)
  let spec: Record<string, unknown> | null = null
  let specError: string | null = null
  if (fileExists(specFile)) {
    try {
      const raw = JSON.parse(stripBom(fs.readFileSync(specFile, 'utf8'))) as unknown
      spec = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
      if (!spec) specError = 'spec.json 必须是 JSON 对象'
    } catch (error) {
      specError = `spec.json 解析失败：${error instanceof Error ? error.message : String(error)}`
    }
  }
  return {
    draft,
    spec,
    specError,
    packSummary: summary.pack ?? null,
    pack: summary.pack ? validatePackDir(draftPackDir(summary.id), summary.id).pack ?? null : null,
    generation: readJsonFile<GenerationFile>(draftGenerationFile(summary.id)),
    validation: summary.validation
  }
}

/** 新建草稿：id = pack id（不可变），首次即为空 pages 的 starter spec */
export function createDraft(input: CreateDraftInput): DraftSummary {
  ensureStudioDirs()
  const builtin = getBuiltinPack(defaultPackId())
  const name = text(input.name) || '未命名设计模板'
  if (name.length > 100) throw new DesignError(400, '模板名称过长（最多 100 字符）')
  const styleId = text(input.style) || builtin.defaultStyle
  const baseTypeId = text(input.baseApplicationType) || builtin.defaultApplicationType
  try {
    getStyle(builtin, styleId)
  } catch {
    throw new DesignError(400, `视觉风格不存在：${styleId}`)
  }
  try {
    getApplicationType(builtin, baseTypeId)
  } catch {
    throw new DesignError(400, `应用类型不存在：${baseTypeId}`)
  }

  const builtinIds = builtin.applicationTypes.map(type => type.id)
  const customIds = new Set(listCustomPackIds())
  const requestedId = text(input.id)
  let packId = ''
  if (requestedId) {
    packId = assertPackId(requestedId)
    if (isBuiltinPackId(packId) || builtinIds.includes(packId)) {
      throw new DesignError(400, `不能使用内置模板 id / 内置应用类型 id：${packId}`)
    }
    if (customIds.has(packId) || dirExists(draftDir(packId))) {
      throw new DesignError(409, `模板 id 已存在：${packId}`, { code: 'pack-id-exists' })
    }
  } else {
    const slug = slugify(name) || 'custom'
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `${slug}-${randomSuffix()}`.slice(0, 64)
      if (!customIds.has(candidate) && !dirExists(draftDir(candidate))) {
        packId = candidate
        break
      }
    }
    if (!packId) throw new DesignError(409, '无法生成唯一模板 id，请显式提供 id', { code: 'pack-id-exists' })
  }

  const now = nowIso()
  const draft: DraftJson = {
    schemaVersion: 1,
    id: packId,
    name,
    style: styleId,
    baseApplicationType: baseTypeId,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    publishedVersion: null,
    lastSpecHash: null
  }
  const dir = draftDir(packId)
  fs.mkdirSync(dir, { recursive: true })
  writeDraftJson(draft)
  writeJsonAtomic(draftSpecFile(packId), {
    schemaVersion: 1,
    id: packId,
    name,
    description: '',
    baseApplicationType: baseTypeId,
    style: styleId,
    pages: []
  })
  return draftSummary(packId)
}

export function touchDraft(packId: string, patch: Partial<DraftJson> = {}): DraftJson {
  const current = readDraftJson(packId)
  if (!current) throw new DesignError(404, `设计模板草稿不存在：${packId}`)
  const next: DraftJson = { ...current, ...patch, updatedAt: nowIso() }
  writeDraftJson(next)
  return next
}

/** 由已发布 pack 反写草稿（编辑已发布模板）；不复制 pack，生成时再产出 */
export function ensureDraftFromPublished(packId: string): DraftSummary {
  const id = assertPackId(packId)
  if (draftExists(id)) return draftSummary(id)
  let pack: DesignPack
  try {
    pack = getPack(id)
  } catch {
    throw new DesignError(404, `设计模板包不存在：${id}`)
  }
  if (!pack.origin || pack.origin.kind !== 'custom') {
    throw new DesignError(400, `模板包缺少 origin（不能作为自定义模板编辑）：${id}`, { code: 'pack-invalid' })
  }
  ensureStudioDirs()
  const pages = pack.applicationTypes.flatMap(type =>
    type.pages.map(page => {
      if (page.kind === 'reference') {
        return {
          id: page.id,
          name: page.name,
          kind: 'reference',
          source: page.source
            ? { pack: page.source.pack, applicationType: page.source.applicationType, pageId: page.source.pageId }
            : undefined,
          description: page.description
        }
      }
      return {
        id: page.id,
        name: page.name,
        kind: 'contract',
        type: page.type,
        recipe: page.recipe,
        description: page.description,
        contract: page.contract ?? {},
        ...(page.sampleEntity ? { sampleEntity: page.sampleEntity } : {}),
        ...(page.sampleSubEntities ? { sampleSubEntities: page.sampleSubEntities } : {})
      }
    })
  )
  const now = nowIso()
  const draft: DraftJson = {
    schemaVersion: 1,
    id,
    name: pack.name,
    style: pack.origin.style,
    baseApplicationType: pack.origin.baseApplicationType,
    status: 'published',
    createdAt: now,
    updatedAt: now,
    publishedVersion: pack.version,
    lastSpecHash: pack.origin.specHash ?? null
  }
  fs.mkdirSync(draftDir(id), { recursive: true })
  writeDraftJson(draft)
  writeJsonAtomic(draftSpecFile(id), {
    schemaVersion: 1,
    id,
    name: pack.name,
    description: pack.applicationTypes[0]?.description ?? '',
    baseApplicationType: draft.baseApplicationType,
    style: draft.style,
    pages
  })
  return draftSummary(id)
}

/** 删除草稿目录；已发布的 pack 保留（packKept=true） */
export function deleteDraft(packId: string): { ok: true; packKept: boolean } {
  const id = assertPackId(packId)
  if (!dirExists(draftDir(id))) throw new DesignError(404, `设计模板草稿不存在：${id}`)
  const packKept = (() => {
    try {
      const pack = getPack(id)
      return Boolean(pack.origin && pack.origin.kind === 'custom')
    } catch {
      return false
    }
  })()
  fs.rmSync(draftDir(id), { recursive: true, force: true })
  return { ok: true, packKept }
}

/** 删除模板时归档工作室会话（P7-7b 使用；P7-7a 无会话行也安全） */
export function archiveStudioSessions(packId: string): void {
  try {
    db.prepare(
      "UPDATE app_sessions SET status = 'archived', updated_at = ? WHERE app_id = ? AND status <> 'archived'"
    ).run(nowIso(), `__template__:${packId}`)
  } catch {
    // 表/状态值差异不影响删除模板
  }
}

/** 模板中心里与 pack 关联的草稿状态（未创建草稿时 null） */
export function draftStatusOf(packId: string): DraftStatus | null {
  const draft = readDraftJson(packId)
  return draft ? draft.status : null
}

export function draftDirOf(packId: string): string {
  return draftDir(packId)
}

export function draftPackDirOf(packId: string): string {
  return draftPackDir(packId)
}

export function draftSpecFilePath(packId: string): string {
  return draftSpecFile(packId)
}

export function draftGenerationFilePath(packId: string): string {
  return draftGenerationFile(packId)
}

export function readDraftSpec(packId: string): unknown | null {
  const file = draftSpecFile(packId)
  if (!fileExists(file)) return null
  return JSON.parse(stripBom(fs.readFileSync(file, 'utf8'))) as unknown
}

export function packForSelection(packId: string): DesignPack {
  return getPack(packId)
}

export function draftPathLabel(packId: string): string {
  return path.join('drafts', packId)
}
