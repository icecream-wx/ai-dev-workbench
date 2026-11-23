/**
 * 模板工作室路径与会话安全（P7-7a）
 *
 * 工作室根：`<dataDir>/design-system/_workshop/`
 * - `catalog/`：派生只读知识库（P7-7a 生成 index/pages/components/styles/recipes + examples）
 * - `drafts/<packId>/`：草稿（draft.json / spec.json / pack / generation.json）
 *
 * 约束：
 * - pack id 只允许 `^[a-z0-9][a-z0-9-]{0,63}$`，且不能是保留目录名；
 * - 资产路径必须相对、禁止 `..`/绝对路径/盘符，只允许 `.css/.svg/.png/.jpg/.jpeg`；
 * - 写文件用 `.tmp` → rename 原子替换。
 */
import fs from 'node:fs'
import path from 'node:path'
import { customDesignSystemRoot } from '../design/pack'
import { DesignError } from '../design/errors'

export const STUDIO_DIR = '_workshop'
export const DRAFT_DIR = 'drafts'
export const DRAFT_PACK_DIR = 'pack'
export const CATALOG_DIR = 'catalog'

const PACK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const RESERVED_PACK_IDS = ['_workshop', '_draft', 'assets', 'styles', 'application-types']
const ASSET_EXTENSIONS = ['.css', '.svg', '.png', '.jpg', '.jpeg']

export function isAllowedAssetPath(value: string): boolean {
  const extension = path.posix.extname(String(value || '').toLowerCase())
  return ASSET_EXTENSIONS.includes(extension)
}

export function assertPackId(value: unknown, label = '模板 id'): string {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!id || !PACK_ID_PATTERN.test(id)) {
    throw new DesignError(400, `${label} 不合法（^[a-z0-9][a-z0-9-]{0,63}$）：${String(value)}`)
  }
  if (RESERVED_PACK_IDS.includes(id)) throw new DesignError(400, `${label} 不能使用保留名：${id}`)
  return id
}

export function studioRoot(): string {
  return path.join(customDesignSystemRoot(), STUDIO_DIR)
}

export function draftsRoot(): string {
  return path.join(studioRoot(), DRAFT_DIR)
}

export function catalogRoot(): string {
  return path.join(studioRoot(), CATALOG_DIR)
}

export function workshopFile(): string {
  return path.join(studioRoot(), 'workshop.json')
}

export function draftDir(packId: unknown): string {
  return path.join(draftsRoot(), assertPackId(packId))
}

export function draftPackDir(packId: unknown): string {
  return path.join(draftDir(packId), DRAFT_PACK_DIR)
}

export function draftJsonFile(packId: unknown): string {
  return path.join(draftDir(packId), 'draft.json')
}

export function draftSpecFile(packId: unknown): string {
  return path.join(draftDir(packId), 'spec.json')
}

export function draftGenerationFile(packId: unknown): string {
  return path.join(draftDir(packId), 'generation.json')
}

export function ensureStudioDirs(): void {
  fs.mkdirSync(draftsRoot(), { recursive: true })
  fs.mkdirSync(catalogRoot(), { recursive: true })
}

/**
 * 解析 root 内的相对资产路径（只读）。
 * - 非法（绝对路径/盘符/`..`/空段/扩展名不允许）→ 400；
 * - 不存在 → 404。
 */
export function resolveAssetFile(root: string, relative: unknown): string {
  const raw = typeof relative === 'string' ? relative.trim() : ''
  if (!raw) throw new DesignError(400, '缺少资产路径（path）')
  const normalized = raw.replace(/\\/g, '/')
  if (normalized.startsWith('/') || path.win32.isAbsolute(raw) || /^[a-zA-Z]:/.test(normalized)) {
    throw new DesignError(400, `资产路径不能是绝对路径：${raw}`)
  }
  const segments = normalized.split('/')
  if (segments.some(segment => segment === '..' || segment === '' || segment === '.')) {
    throw new DesignError(400, `资产路径不合法：${raw}`)
  }
  if (!isAllowedAssetPath(normalized)) {
    throw new DesignError(400, `资产扩展名不允许（只允许 ${ASSET_EXTENSIONS.join('/')}）：${raw}`)
  }
  const base = path.resolve(root)
  const full = path.resolve(base, normalized)
  const inside = path.relative(base, full)
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new DesignError(400, `资产路径越出模板目录：${raw}`)
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    throw new DesignError(404, `资产不存在：${raw}`)
  }
  return full
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function readJsonFile<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(stripBom(fs.readFileSync(file, 'utf8'))) as T
  } catch {
    return null
  }
}

export function writeFileAtomic(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.tmp-${process.pid}-${Date.now().toString(36)}`
  fs.writeFileSync(temp, content)
  fs.renameSync(temp, file)
}

export function writeJsonAtomic(file: string, value: unknown): void {
  writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`)
}

export function fileExists(file: string): boolean {
  return fs.existsSync(file) && fs.statSync(file).isFile()
}

export function dirExists(dir: string): boolean {
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory()
}

/** 列出草稿目录（有 draft.json 或 spec.json 才算草稿） */
export function listDraftIds(): string[] {
  const root = draftsRoot()
  if (!dirExists(root)) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => {
      if (!entry.isDirectory()) return false
      if (!PACK_ID_PATTERN.test(entry.name) || entry.name.startsWith('.')) return false
      return fileExists(path.join(root, entry.name, 'draft.json')) || fileExists(path.join(root, entry.name, 'spec.json'))
    })
    .map(entry => entry.name)
    .sort()
}

/** 列出已发布自定义 pack id（含 origin 或任意自定义目录） */
export function listCustomPackIds(): string[] {
  const root = customDesignSystemRoot()
  if (!dirExists(root)) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => {
      if (!entry.isDirectory()) return false
      if (!PACK_ID_PATTERN.test(entry.name) || entry.name.startsWith('.') || entry.name === STUDIO_DIR) return false
      return fileExists(path.join(root, entry.name, 'pack.json'))
    })
    .map(entry => entry.name)
    .sort()
}
