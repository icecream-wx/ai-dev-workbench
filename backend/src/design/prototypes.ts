/**
 * 设计参考包：原型 PNG / manifest / tokens
 *
 * 工作区：
 *   docs/design/<MOD>/
 *     design.json                 结构唯一来源（schema 校验）
 *     design-brief.md             设计 agent 维护（自由文本，不由工作台写）
 *     tokens.json                 工作台按应用设计系统风格确定性写入
 *     prototypes/_manifest.json   {designHash, styleId, exportedAt, pages:{id:{file,hash,exportedAt}}}
 *     prototypes/<page-id>.png    前端渲染后上传（不调用模型）
 *
 * 写入规则：
 * - 校验全部通过后才落盘（避免半成品）；
 * - designHash 必须等于当前 design.json 的 sha256（防过期写入）；
 * - styleId 必须属于应用设计系统模板包里的视觉风格；
 * - 只接受 data:image/png;base64 + PNG 魔数；单页/总量/页数有上限；
 * - 页面 id 白名单；删除 manifest 中不再存在的旧 PNG。
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { appDirOf } from '../apps/scaffold'
import { readDesignSelection } from '../apps/design-system'
import { defaultPackId, getPack, getStyle, type DesignStyle } from './pack'

const MODULE_PATTERN = /^MOD-\d{3,}$/
const PAGE_ID_PATTERN = /^[A-Za-z0-9._-]{1,80}$/
const MAX_PAGES = 80
const MAX_PAGE_BYTES = 5 * 1024 * 1024
const MAX_TOTAL_BYTES = 40 * 1024 * 1024
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export interface PrototypePageInput {
  id: string
  dataUrl: string
}

export interface PrototypePageManifestEntry {
  file: string
  hash: string
  exportedAt: string
}

export interface PrototypeManifest {
  designHash: string
  styleId: string
  exportedAt: string
  pages: Record<string, PrototypePageManifestEntry>
}

export interface PrototypeArtifact {
  designHash: string
  styleId: string
  exportedAt: string
  stale: boolean
  pages: Array<{ id: string; file: string; hash: string }>
}

function fail(status: number, message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number }
  error.status = status
  return error
}

function relative(appDir: string, file: string): string {
  return path.relative(appDir, file).replace(/\\/g, '/')
}

export function designDirOf(appDir: string, module: string): string {
  return path.join(appDir, 'docs', 'design', module)
}

export function designFileOf(appDir: string, module: string): string {
  return path.join(designDirOf(appDir, module), 'design.json')
}

export function tokensFileOf(appDir: string, module: string): string {
  return path.join(designDirOf(appDir, module), 'tokens.json')
}

export function briefFileOf(appDir: string, module: string): string {
  return path.join(designDirOf(appDir, module), 'design-brief.md')
}

export function prototypesDirOf(appDir: string, module: string): string {
  return path.join(designDirOf(appDir, module), 'prototypes')
}

export function prototypeManifestFileOf(appDir: string, module: string): string {
  return path.join(prototypesDirOf(appDir, module), '_manifest.json')
}

export function sha256File(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function normalizePageEntry(raw: unknown): PrototypePageManifestEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const file = typeof value.file === 'string' ? value.file : ''
  const hash = typeof value.hash === 'string' ? value.hash : ''
  if (!file || path.basename(file) !== file) return null
  return {
    file,
    hash,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : ''
  }
}

/** 读原型 manifest；不存在/损坏时返回 null（artifacts 只读，不抛 500） */
export function readPrototypeManifest(appDir: string, module: string): PrototypeManifest | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(prototypeManifestFileOf(appDir, module), 'utf8')) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null
    const rawPages = parsed.pages && typeof parsed.pages === 'object' ? (parsed.pages as Record<string, unknown>) : {}
    const pages: Record<string, PrototypePageManifestEntry> = {}
    for (const [id, entry] of Object.entries(rawPages)) {
      if (!PAGE_ID_PATTERN.test(id)) continue
      const normalized = normalizePageEntry(entry)
      if (normalized) pages[id] = normalized
    }
    return {
      designHash: typeof parsed.designHash === 'string' ? parsed.designHash : '',
      styleId: typeof parsed.styleId === 'string' ? parsed.styleId : '',
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      pages
    }
  } catch {
    return null
  }
}

/** 解码并校验 PNG dataURL（导出到单独函数，便于单测） */
export function decodePngDataUrl(dataUrl: unknown): Buffer {
  if (typeof dataUrl !== 'string') throw fail(400, 'pages[].dataUrl 必须是 data:image/png;base64 字符串')
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim())
  if (!match) throw fail(400, '只接受 data:image/png;base64 数据')
  const buffer = Buffer.from(match[1].replace(/\s+/g, ''), 'base64')
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw fail(400, 'PNG 魔数不正确')
  }
  if (buffer.length > MAX_PAGE_BYTES) {
    throw fail(400, `单页 PNG 超过上限（${MAX_PAGE_BYTES} 字节）`)
  }
  return buffer
}

export interface PrototypeWriteResult {
  ok: true
  manifest: PrototypeManifest
}

/** 校验 styleId 属于应用设计系统模板包（默认内置 pack）的视觉风格 */
function resolveStyleOrFail(appId: string, styleId: string): DesignStyle {
  let pack
  try {
    const selection = readDesignSelection(appId)
    pack = getPack(selection.pack ?? defaultPackId())
  } catch (error) {
    throw fail(400, error instanceof Error ? error.message : `设计模板包不可用，无法校验风格：${styleId}`)
  }
  try {
    return getStyle(pack, styleId)
  } catch {
    throw fail(400, `视觉风格不存在：${styleId}（模板包 ${pack.id}）`)
  }
}

/** POST /api/apps/:id/design/:module/prototypes */
export function writePrototypePackage(appId: string, moduleRaw: string, body: unknown): PrototypeWriteResult {
  const module = String(moduleRaw ?? '').trim()
  if (!MODULE_PATTERN.test(module)) throw fail(400, `模块 key 格式不正确：${module || '(空)'}`)
  const appDir = appDirOf(appId)
  const designFile = designFileOf(appDir, module)
  if (!fs.existsSync(designFile)) throw fail(404, `设计文件不存在：docs/design/${module}/design.json`)

  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const designHash = typeof payload.designHash === 'string' ? payload.designHash.trim() : ''
  if (!designHash) throw fail(400, 'designHash 不能为空')
  const currentHash = sha256File(designFile)
  if (designHash !== currentHash) {
    throw fail(409, 'designHash 与当前 design.json 不一致（可能已过期，请刷新后重新导出）')
  }

  const styleId = typeof payload.styleId === 'string' ? payload.styleId.trim() : ''
  if (!styleId) throw fail(400, 'styleId 不能为空')
  const style = resolveStyleOrFail(appId, styleId)

  const rawPages = Array.isArray(payload.pages) ? payload.pages : []
  if (rawPages.length < 1) throw fail(400, 'pages 至少 1 页')
  if (rawPages.length > MAX_PAGES) throw fail(400, `pages 最多 ${MAX_PAGES} 页`)

  const pages: Array<{ id: string; bytes: Buffer }> = []
  const seen = new Set<string>()
  let totalBytes = 0
  for (const raw of rawPages) {
    if (!raw || typeof raw !== 'object') throw fail(400, 'pages[] 必须是对象')
    const item = raw as Record<string, unknown>
    const id = typeof item.id === 'string' ? item.id.trim() : ''
    if (!PAGE_ID_PATTERN.test(id)) throw fail(400, `页面 id 不合法：${id || '(空)'}`)
    if (seen.has(id)) throw fail(400, `页面 id 重复：${id}`)
    seen.add(id)
    const bytes = decodePngDataUrl(item.dataUrl)
    totalBytes += bytes.length
    if (totalBytes > MAX_TOTAL_BYTES) throw fail(400, `PNG 总量超过上限（${MAX_TOTAL_BYTES} 字节）`)
    pages.push({ id, bytes })
  }

  const dir = prototypesDirOf(appDir, module)
  const manifestFile = prototypeManifestFileOf(appDir, module)
  const previous = readPrototypeManifest(appDir, module)
  fs.mkdirSync(dir, { recursive: true })

  const now = new Date().toISOString()
  const manifestPages: Record<string, PrototypePageManifestEntry> = {}
  for (const page of pages) {
    const file = `${page.id}.png`
    fs.writeFileSync(path.join(dir, file), page.bytes)
    manifestPages[page.id] = {
      file,
      hash: createHash('sha256').update(page.bytes).digest('hex'),
      exportedAt: now
    }
  }

  // 删除本次未包含的旧 PNG（旧 manifest 白名单 + 目录里残留的 png）
  const keep = new Set(pages.map(page => `${page.id}.png`))
  if (previous) {
    for (const entry of Object.values(previous.pages)) {
      if (keep.has(entry.file)) continue
      const target = path.resolve(dir, entry.file)
      if (path.dirname(target) !== path.resolve(dir)) continue
      try {
        fs.rmSync(target, { force: true })
      } catch {
        // 旧 PNG 已不存在
      }
    }
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.png')) continue
    if (keep.has(entry.name)) continue
    try {
      fs.rmSync(path.join(dir, entry.name), { force: true })
    } catch {
      // 忽略
    }
  }

  const manifest: PrototypeManifest = {
    designHash,
    styleId: style.id,
    exportedAt: now,
    pages: Object.fromEntries(Object.keys(manifestPages).sort().map(id => [id, manifestPages[id]]))
  }
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  fs.writeFileSync(
    tokensFileOf(appDir, module),
    `${JSON.stringify({ styleId: style.id, name: style.name, tokens: style.tokens }, null, 2)}\n`,
    'utf8'
  )
  return { ok: true, manifest }
}

/** artifacts 只读：manifest + 当前 design.json hash → stale/pages */
export function readPrototypeArtifact(appDir: string, module: string): PrototypeArtifact | null {
  const manifest = readPrototypeManifest(appDir, module)
  if (!manifest) return null
  const designFile = designFileOf(appDir, module)
  let currentHash = ''
  try {
    currentHash = sha256File(designFile)
  } catch {
    currentHash = ''
  }
  const dir = prototypesDirOf(appDir, module)
  const pages = Object.keys(manifest.pages)
    .sort()
    .map(id => {
      const entry = manifest.pages[id]
      return { id, file: relative(appDir, path.join(dir, entry.file)), hash: entry.hash }
    })
  return {
    designHash: manifest.designHash,
    styleId: manifest.styleId,
    exportedAt: manifest.exportedAt,
    stale: !currentHash || manifest.designHash !== currentHash,
    pages
  }
}

/** artifacts 只读：brief 是否存在 */
export function readDesignBrief(appDir: string, module: string): { exists: boolean; file: string } {
  const file = briefFileOf(appDir, module)
  return { exists: fs.existsSync(file), file: relative(appDir, file) }
}

/** artifacts 只读：tokens.json 是否存在及其 styleId */
export function readDesignTokens(appDir: string, module: string): { exists: boolean; styleId?: string } {
  const file = tokensFileOf(appDir, module)
  if (!fs.existsSync(file)) return { exists: false }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
    return {
      exists: true,
      ...(typeof parsed.styleId === 'string' && parsed.styleId ? { styleId: parsed.styleId } : {})
    }
  } catch {
    return { exists: true }
  }
}
