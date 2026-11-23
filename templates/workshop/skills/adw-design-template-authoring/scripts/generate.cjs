#!/usr/bin/env node
/**
 * P7-7a 设计模板生成 CLI（薄入口，agent 在工作室里可执行）
 *
 *   node .opencode/scripts/generate.cjs --draft <packId> [--data-dir <dir>] [--url <baseUrl>] [--quiet]
 *
 * 1. 读 `<studio>/workshop.json`（cwd 或 --data-dir 推导）→ builtinRoot/customRoot/draftRoot/workbenchPort；
 * 2. 读 `drafts/<packId>/spec.json` 与内置 pack.json；
 * 3. 调共享核心 `lib/generator.cjs` 生成到草稿暂存目录，原子替换 `drafts/<packId>/pack`；
 * 4. 调后端 `POST /api/design-templates/drafts/:id/validate` 做**预检**（权威仍是发布 API）。
 *
 * 本 CLI 只服务 agent 快速反馈，**不发布**；发布只能由用户在 UI 确认。
 */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { generatePack } = require('./lib/generator.cjs')

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name)
  if (index > 0 && process.argv[index + 1]) return process.argv[index + 1]
  return fallback
}

function fail(message, code = 2) {
  const payload = { ok: false, errors: [{ code: 'cli-error', path: '$', message }], warnings: [] }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
  process.exit(code)
}

function readJson(file) {
  const text = fs.readFileSync(file, 'utf8')
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
}

function findStudio(dataDir) {
  const candidates = []
  if (dataDir) candidates.push(path.join(path.resolve(dataDir), 'design-system', '_workshop'))
  candidates.push(process.cwd())
  for (const candidate of candidates) {
    const file = path.join(candidate, 'workshop.json')
    if (fs.existsSync(file)) return { studio: candidate, workshop: readJson(file) }
  }
  return null
}

function defaultBuiltinPack(builtinRoot) {
  if (!fs.existsSync(builtinRoot)) return null
  const ids = fs
    .readdirSync(builtinRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(builtinRoot, entry.name, 'pack.json')))
    .map(entry => entry.name)
    .sort()
  return ids[0] || null
}

function replaceDir(staging, target) {
  const backup = `${target}.old-${crypto.randomBytes(4).toString('hex')}`
  const hadTarget = fs.existsSync(target)
  if (hadTarget) fs.renameSync(target, backup)
  try {
    fs.renameSync(staging, target)
  } catch (error) {
    if (hadTarget && fs.existsSync(backup)) fs.renameSync(backup, target)
    throw error
  }
  if (hadTarget) fs.rmSync(backup, { recursive: true, force: true })
}

async function backendValidate(baseUrl, packId) {
  if (!baseUrl) return { ok: false, skipped: true, error: '未配置工作台地址' }
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/design-templates/drafts/${encodeURIComponent(packId)}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(20000)
    })
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }
    return { ok: response.ok, status: response.status, result: data }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function main() {
  const draftId = argValue('--draft')
  if (!draftId) fail('缺少 --draft <packId>')
  const dataDir = argValue('--data-dir')
  const found = findStudio(dataDir)
  if (!found) fail('找不到工作室配置 workshop.json（请在工作室根执行，或传 --data-dir）')
  const workshop = found.workshop || {}
  const draftRoot = path.resolve(String(workshop.draftRoot || path.join(found.studio, 'drafts')))
  const builtinRoot = path.resolve(String(workshop.builtinRoot || ''))
  const customRoot = path.resolve(String(workshop.customRoot || ''))
  const draftDir = path.join(draftRoot, draftId)
  const specFile = path.join(draftDir, 'spec.json')
  if (!fs.existsSync(specFile)) fail(`草稿 spec.json 不存在：${specFile}`)
  const builtinId = String(workshop.builtinPack || defaultBuiltinPack(builtinRoot) || '')
  const builtinPackFile = path.join(builtinRoot, builtinId, 'pack.json')
  if (!fs.existsSync(builtinPackFile)) fail(`内置 pack.json 不存在：${builtinPackFile}`)
  const builtin = readJson(builtinPackFile)

  const publishedFile = path.join(customRoot, draftId, 'pack.json')
  let publishedRevision = 0
  if (fs.existsSync(publishedFile)) {
    try {
      const published = readJson(publishedFile)
      publishedRevision = Number(published?.origin?.revision) || 0
    } catch {
      publishedRevision = 0
    }
  }

  const reservedIds = []
  if (fs.existsSync(customRoot)) {
    for (const entry of fs.readdirSync(customRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== draftId && fs.existsSync(path.join(customRoot, entry.name, 'pack.json'))) {
        reservedIds.push(entry.name)
      }
    }
  }

  const staging = path.join(draftDir, `.pack.tmp-${crypto.randomBytes(4).toString('hex')}`)
  const report = generatePack({
    spec: readJson(specFile),
    builtin,
    builtinRoot: path.join(builtinRoot, builtinId),
    targetDir: staging,
    packId: draftId,
    reservedIds,
    publishedRevision
  })
  if (!report.ok) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    process.exit(1)
  }

  replaceDir(staging, path.join(draftDir, 'pack'))
  const generation = {
    generatedAt: new Date().toISOString(),
    specHash: report.specHash,
    pageCount: report.pack.pageCount,
    pack: report.pack,
    sources: report.css.sources,
    css: report.css,
    warnings: report.warnings,
    errors: []
  }
  fs.writeFileSync(path.join(draftDir, 'generation.json'), `${JSON.stringify(generation, null, 2)}\n`, 'utf8')

  const port = Number(workshop.workbenchPort) || 3300
  const baseUrl = argValue('--url', `http://127.0.0.1:${port}`)
  const backend = await backendValidate(baseUrl, draftId)
  const output = {
    ...report,
    backendValidate: backend.skipped
      ? { ok: false, skipped: true, message: '未调用后端校验（仅本地生成结果；发布仍以后端为准）' }
      : backend
  }
  if (!backend.ok) {
    output.warnings = [
      ...report.warnings,
      {
        code: 'backend-validate-unavailable',
        path: '$',
        message: `后端权威校验未通过/不可用：${backend.error || `HTTP ${backend.status}`}（发布前必须重新生成并由后端校验）`
      }
    ]
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)))
