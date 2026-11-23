#!/usr/bin/env node
/**
 * P7-7a 草稿预检 CLI（**仅预检**，不替代发布校验）
 *
 *   node .opencode/scripts/validate.cjs --draft <packId> [--data-dir <dir>] [--url <baseUrl>]
 *
 * 调用后端 `POST /api/design-templates/drafts/:id/validate`（`pack.ts#validatePackDir` 权威结果）。
 * 后端不可达时退出码 2，避免把“没校验”当成“校验通过”。
 */
const fs = require('node:fs')
const path = require('node:path')

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name)
  if (index > 0 && process.argv[index + 1]) return process.argv[index + 1]
  return fallback
}

function out(payload, code) {
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
    if (fs.existsSync(file)) return readJson(file)
  }
  return null
}

async function main() {
  const draftId = argValue('--draft')
  if (!draftId) out({ ok: false, errors: [{ code: 'cli-error', message: '缺少 --draft <packId>' }] }, 2)
  const workshop = findStudio(argValue('--data-dir'))
  const port = Number((workshop && workshop.workbenchPort) || 3300)
  const baseUrl = argValue('--url', `http://127.0.0.1:${port}`)
  let response
  try {
    response = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/api/design-templates/drafts/${encodeURIComponent(draftId)}/validate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(20000)
      }
    )
  } catch (error) {
    out(
      {
        ok: false,
        errors: [
          {
            code: 'backend-unavailable',
            message: `工作台后端不可达（${baseUrl}）：${error instanceof Error ? error.message : String(error)}；请先启动工作台`
          }
        ]
      },
      2
    )
  }
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  out(data, response.ok ? 0 : 1)
}

main().catch(error => out({ ok: false, errors: [{ code: 'cli-error', message: String(error) }] }, 2))
