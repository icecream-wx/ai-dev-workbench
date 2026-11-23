/**
 * 草稿生成（P7-7a）
 *
 * 流程（设计稿 §8.3）：
 * 1. 读 spec.json → 共享核心生成到 `drafts/<packId>/.pack.tmp-*`；
 * 2. 用 `pack.ts#validatePackDir` 做**权威**校验（直接读文件，不走 mtime 缓存）；
 * 3. 原子替换 `drafts/<packId>/pack`；写 `generation.json`；
 * 4. 失败删除暂存目录，**不覆盖旧 pack / generation.json**。
 *
 * 单飞锁：同一草稿同时只允许一个生成（409 `generating`）。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { builtinDesignSystemRoot, customDesignSystemRoot, getBuiltinPack, validatePackDir } from '../design/pack'
import { DesignError } from '../design/errors'
import { workshopCore, type GeneratorResult, type SpecIssue } from './core'
import { knownComponentsOf } from './spec'
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
import { touchDraft } from './draft'

export interface GenerateDraftResult extends GeneratorResult {
  status: number
}

const inFlight = new Set<string>()

function publishedRevisionOf(packId: string): number {
  const file = path.join(customDesignSystemRoot(), packId, 'pack.json')
  const raw = readJsonFile<Record<string, unknown>>(file)
  const origin = raw?.origin as Record<string, unknown> | undefined
  const revision = Number(origin?.revision)
  return Number.isInteger(revision) && revision > 0 ? revision : 0
}

function replacePackDir(staging: string, target: string): void {
  const backup = `${target}.old-${crypto.randomBytes(4).toString('hex')}`
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

function specErrors(error: unknown): SpecIssue[] {
  return [
    { code: 'spec-invalid', path: '$', message: `spec.json 解析失败：${error instanceof Error ? error.message : String(error)}` }
  ]
}

/** 生成草稿 pack（幂等；同一 spec 重跑 pack 字节一致） */
export function generateDraft(packIdInput: unknown): GenerateDraftResult {
  const packId = assertPackId(packIdInput)
  if (!fileExists(draftJsonFile(packId))) throw new DesignError(404, `设计模板草稿不存在：${packId}`)
  if (inFlight.has(packId)) {
    throw new DesignError(409, `草稿正在生成：${packId}`, { code: 'generating' })
  }
  inFlight.add(packId)
  try {
    const specFile = draftSpecFile(packId)
    if (!fileExists(specFile)) throw new DesignError(404, `草稿 spec.json 不存在：${packId}`)
    let rawSpec: unknown
    try {
      rawSpec = JSON.parse(stripBom(fs.readFileSync(specFile, 'utf8'))) as unknown
    } catch (error) {
      return { ok: false, status: 400, errors: specErrors(error), warnings: [] }
    }

    const builtin = getBuiltinPack()
    const builtinRoot = path.join(builtinDesignSystemRoot(), builtin.id)
    const staging = path.join(draftDir(packId), `.pack.tmp-${crypto.randomBytes(4).toString('hex')}`)
    const report = workshopCore().generator.generatePack({
      spec: rawSpec,
      builtin,
      builtinRoot,
      targetDir: staging,
      packId,
      reservedIds: listCustomPackIds().filter(id => id !== packId),
      knownComponents: knownComponentsOf(builtin),
      publishedRevision: publishedRevisionOf(packId)
    })
    if (!report.ok) {
      if (dirExists(staging)) fs.rmSync(staging, { recursive: true, force: true })
      return { ok: false, status: 400, errors: report.errors, warnings: report.warnings }
    }

    const validation = validatePackDir(staging, packId)
    if (!validation.ok) {
      fs.rmSync(staging, { recursive: true, force: true })
      return {
        ok: false,
        status: 400,
        errors: validation.errors.map(issue => ({
          code: issue.code,
          path: issue.path ?? 'pack',
          message: issue.message
        })),
        warnings: [...report.warnings, ...validation.warnings.map(issue => ({ ...issue, path: issue.path ?? 'pack' }))]
      }
    }

    replacePackDir(staging, draftPackDir(packId))
    const generation = {
      generatedAt: new Date().toISOString(),
      specHash: report.specHash,
      pageCount: report.pack?.pageCount ?? 0,
      pack: report.pack,
      sources: report.css?.sources ?? [],
      css: report.css,
      warnings: [...report.warnings, ...validation.warnings.map(issue => ({ ...issue, path: issue.path ?? 'pack' }))],
      errors: []
    }
    writeJsonAtomic(draftGenerationFile(packId), generation)
    touchDraft(packId)
    return {
      ...report,
      warnings: generation.warnings,
      status: 200
    }
  } finally {
    inFlight.delete(packId)
  }
}
