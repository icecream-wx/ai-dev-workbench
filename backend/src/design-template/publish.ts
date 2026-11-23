/**
 * 自定义模板发布 / 删除（P7-7a）
 *
 * 发布（设计稿 §10.3）：
 * 1. `spec.json` 规范化哈希 == `generation.json.specHash`，否则 409 `spec-changed`；
 * 2. 草稿 pack 与发布暂存目录都走 `pack.ts#validatePackDir`（权威）；
 * 3. `origin.revision + 1`、`version = 1.0.<revision-1>`、`publishedAt`、`specHash`；
 * 4. 暂存 + 原子替换；失败保留旧 pack。
 *
 * 删除（§10.5）：内置 403；非自定义 404；被 `app_settings` 的 `app.<id>.design.pack` 引用 → 409 + 应用列表。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { db } from '../db'
import {
  clearDesignPackCache,
  customDesignSystemRoot,
  getBuiltinPack,
  isBuiltinPackId,
  validatePackDir,
  type DesignPack
} from '../design/pack'
import { DesignError } from '../design/errors'
import { normalizeDraftSpec } from './spec'
import type { SpecIssue } from './core'
import {
  dirExists,
  draftDir,
  draftGenerationFile,
  draftJsonFile,
  draftPackDir,
  draftSpecFile,
  fileExists,
  listCustomPackIds,
  readJsonFile,
  stripBom,
  writeJsonAtomic
} from './paths'
import { assertPackId } from './paths'
import { archiveStudioSessions, touchDraft } from './draft'
import type { GenerationFile } from './draft'

export interface PublishResult {
  ok: true
  pack: { id: string; version: string; revision: number }
  warnings: SpecIssue[]
}

export interface ReferencedApp {
  id: string
  name: string
}

const publishing = new Set<string>()

function appNameOf(appId: string): string {
  const row = db.prepare('SELECT name FROM apps WHERE id = ?').get(appId) as { name: string } | undefined
  return row?.name ?? appId
}

function settingValuePackId(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed === 'string') return parsed.trim()
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const pack = (parsed as Record<string, unknown>).pack
      if (typeof pack === 'string') return pack.trim()
    }
    return ''
  } catch {
    return raw.trim()
  }
}

/** 引用某个 pack 的应用（`app_settings.app.<id>.design.pack`，兼容 JSON 字符串/纯字符串） */
export function referencedAppsOf(packId: string): ReferencedApp[] {
  const rows = db
    .prepare("SELECT key, value FROM app_settings WHERE key LIKE 'app.%.design.pack'")
    .all() as Array<{ key: string; value: string }>
  const apps: ReferencedApp[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (settingValuePackId(row.value) !== packId) continue
    const match = /^app\.(.+)\.design\.pack$/.exec(row.key)
    if (!match) continue
    const appId = match[1]
    if (seen.has(appId)) continue
    seen.add(appId)
    apps.push({ id: appId, name: appNameOf(appId) })
  }
  apps.sort((a, b) => a.id.localeCompare(b.id))
  return apps
}

/** 引用映射（模板中心列表一次查询用） */
export function referencedAppsMap(): Map<string, ReferencedApp[]> {
  const map = new Map<string, ReferencedApp[]>()
  const rows = db
    .prepare("SELECT key, value FROM app_settings WHERE key LIKE 'app.%.design.pack'")
    .all() as Array<{ key: string; value: string }>
  for (const row of rows) {
    const packId = settingValuePackId(row.value)
    if (!packId) continue
    const match = /^app\.(.+)\.design\.pack$/.exec(row.key)
    if (!match) continue
    const appId = match[1]
    const list = map.get(packId) ?? []
    if (!list.some(item => item.id === appId)) list.push({ id: appId, name: appNameOf(appId) })
    map.set(packId, list)
  }
  for (const list of map.values()) list.sort((a, b) => a.id.localeCompare(b.id))
  return map
}

function publishedPack(packId: string): DesignPack | null {
  const dir = path.join(customDesignSystemRoot(), packId)
  if (!dirExists(dir)) return null
  const validation = validatePackDir(dir)
  return validation.ok && validation.pack ? validation.pack : null
}

function replacePublishedDir(staging: string, target: string): void {
  const backup = `${target}.publish-old-${crypto.randomBytes(4).toString('hex')}`
  const hadTarget = dirExists(target)
  if (hadTarget) fs.renameSync(target, backup)
  try {
    fs.renameSync(staging, target)
  } catch (error) {
    if (hadTarget && dirExists(backup)) fs.renameSync(backup, target)
    throw error
  }
  if (hadTarget) fs.rmSync(backup, { recursive: true, force: true })
}

/** 发布草稿（覆盖同名自定义 pack，版本 +1） */
export function publishDraft(packIdInput: unknown): PublishResult {
  const packId = assertPackId(packIdInput)
  const builtin = getBuiltinPack()
  if (isBuiltinPackId(packId)) {
    throw new DesignError(403, `内置模板不可发布/覆盖：${packId}`, { code: 'builtin-readonly' })
  }
  if (!fileExists(draftJsonFile(packId))) throw new DesignError(404, `设计模板草稿不存在：${packId}`)
  if (publishing.has(packId)) {
    throw new DesignError(409, `草稿正在发布：${packId}`, { code: 'publishing' })
  }
  publishing.add(packId)
  const stagingRoot = path.join(customDesignSystemRoot(), `.publish.tmp-${crypto.randomBytes(4).toString('hex')}`)
  try {
    if (!fileExists(draftSpecFile(packId))) {
      throw new DesignError(400, '草稿 spec.json 不存在，请先生成', { code: 'spec-missing' })
    }
    if (!fileExists(draftGenerationFile(packId))) {
      throw new DesignError(400, '草稿尚未生成（缺少 generation.json），请先生成预览', { code: 'pack-missing' })
    }
    if (!dirExists(draftPackDir(packId))) {
      throw new DesignError(400, '草稿 pack 不存在，请先生成预览', { code: 'pack-missing' })
    }
    const rawSpec = JSON.parse(stripBom(fs.readFileSync(draftSpecFile(packId), 'utf8'))) as unknown
    const normalized = normalizeDraftSpec(rawSpec, {
      packId,
      reservedIds: listCustomPackIds().filter(id => id !== packId)
    })
    if (!normalized.ok || !normalized.spec || !normalized.specHash) {
      throw new DesignError(400, 'spec 校验失败，先修正后再发布', {
        code: 'spec-invalid',
        details: { errors: normalized.errors, warnings: normalized.warnings }
      })
    }
    const generation = readJsonFile<GenerationFile>(draftGenerationFile(packId))
    if (!generation || generation.specHash !== normalized.specHash) {
      throw new DesignError(409, 'spec.json 已变化（与上次生成不一致），请重新生成后再发布', {
        code: 'spec-changed'
      })
    }
    const draftValidation = validatePackDir(draftPackDir(packId), packId)
    if (!draftValidation.ok) {
      throw new DesignError(400, '草稿 pack 未通过权威校验，请重新生成', {
        code: 'pack-invalid',
        details: { errors: draftValidation.errors }
      })
    }
    const existing = publishedPack(packId)
    if (dirExists(path.join(customDesignSystemRoot(), packId)) && (!existing || !existing.origin)) {
      throw new DesignError(409, `模板 id 已被占用（不是可覆盖的自定义模板）：${packId}`, {
        code: 'pack-id-exists'
      })
    }
    const previousRevision = existing?.origin?.revision ?? 0
    const revision = previousRevision + 1
    const version = `1.0.${revision - 1}`
    const publishedAt = new Date().toISOString()

    const staging = path.join(stagingRoot, packId)
    fs.mkdirSync(stagingRoot, { recursive: true })
    fs.cpSync(draftPackDir(packId), staging, { recursive: true })
    const packJson = JSON.parse(fs.readFileSync(path.join(staging, 'pack.json'), 'utf8')) as Record<string, unknown>
    packJson.version = version
    packJson.origin = {
      kind: 'custom',
      draftId: packId,
      builtFrom: { pack: builtin.id, version: builtin.version },
      baseApplicationType: normalized.spec.baseApplicationType,
      style: normalized.spec.style,
      revision,
      specHash: normalized.specHash,
      publishedAt
    }
    writeJsonAtomic(path.join(staging, 'pack.json'), packJson)

    const stagedValidation = validatePackDir(staging, packId)
    if (!stagedValidation.ok) {
      throw new DesignError(400, '发布暂存 pack 未通过权威校验', {
        code: 'pack-invalid',
        details: { errors: stagedValidation.errors }
      })
    }

    fs.mkdirSync(customDesignSystemRoot(), { recursive: true })
    replacePublishedDir(staging, path.join(customDesignSystemRoot(), packId))
    clearDesignPackCache()
    touchDraft(packId, {
      status: 'published',
      publishedVersion: version,
      lastSpecHash: normalized.specHash
    })

    const warnings: SpecIssue[] = []
    const css = generation.css as { conflicts?: unknown; conflictDetails?: unknown } | undefined
    if (Array.isArray(css?.conflictDetails)) {
      for (const conflict of css.conflictDetails as Array<Record<string, unknown>>) {
        const selector = typeof conflict.selector === 'string' ? conflict.selector : ''
        const sources = Array.isArray(conflict.sources) ? conflict.sources.map(String).join(' → ') : ''
        warnings.push({
          code: 'css-conflict',
          path: selector,
          message: `结构样式冲突：${selector}（${sources}）；后者生效`
        })
      }
    } else if (Array.isArray(css?.conflicts)) {
      for (const selector of css.conflicts as unknown[]) {
        warnings.push({ code: 'css-conflict', path: String(selector), message: `结构样式冲突：${String(selector)}` })
      }
    }
    for (const issue of stagedValidation.warnings) {
      if (!warnings.some(item => item.code === issue.code && item.message === issue.message)) {
        warnings.push({ code: issue.code, path: issue.path ?? 'pack', message: issue.message })
      }
    }
    warnings.push(...(generation.warnings ?? []))
    return { ok: true, pack: { id: packId, version, revision }, warnings }
  } finally {
    publishing.delete(packId)
    fs.rmSync(stagingRoot, { recursive: true, force: true })
  }
}

export interface DeletePackResult {
  ok: true
  removedDraft: boolean
}

/** 删除自定义 pack（内置 403；被引用 409；同时删除草稿并归档工作室会话） */
export function deleteCustomPack(packIdInput: unknown): DeletePackResult {
  const packId = assertPackId(packIdInput)
  if (isBuiltinPackId(packId)) {
    throw new DesignError(403, `内置模板不可删除：${packId}`, { code: 'builtin-readonly' })
  }
  const target = path.join(customDesignSystemRoot(), packId)
  if (!dirExists(target)) throw new DesignError(404, `设计模板包不存在：${packId}`)
  const validation = validatePackDir(target)
  if (!validation.ok || !validation.pack || !validation.pack.origin || validation.pack.origin.kind !== 'custom') {
    throw new DesignError(404, `不是可删除的自定义模板包：${packId}`)
  }
  const apps = referencedAppsOf(packId)
  if (apps.length) {
    throw new DesignError(409, `模板仍被 ${apps.length} 个应用引用`, {
      code: 'pack-referenced',
      details: { apps }
    })
  }
  fs.rmSync(target, { recursive: true, force: true })
  const removedDraft = dirExists(draftDir(packId))
  if (removedDraft) fs.rmSync(draftDir(packId), { recursive: true, force: true })
  archiveStudioSessions(packId)
  clearDesignPackCache()
  return { ok: true, removedDraft }
}
