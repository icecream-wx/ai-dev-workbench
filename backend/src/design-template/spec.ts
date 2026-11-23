/**
 * spec / 组件扫描的 TS 包装（P7-7a）
 *
 * - 生成核心只负责 spec/css/生成写入；这里提供内置 pack 索引、组件扫描（含共享映射）与
 *   `normalizeDraftSpec` / `specHashOf` / `buildSyntheticDesign` 的后端入口；
 * - 组件控件映射唯一来源：`templates/design-system/component-controls.json`
 *   （前端 `contract-view.js` import 同一文件；后端不解析前端 JS）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { builtinDesignSystemRoot, getBuiltinPack, listBuiltinPackIds, type DesignPack } from '../design/pack'
import { workshopCore, type NormalizeResult } from './core'

export interface ComponentScanEntry {
  name: string
  category: 'control' | 'container'
  tagReferences: number
  pageReferences: number
  pages: string[]
  contractControl: string | null
  contractSupported: boolean
  componentMapTypes: string[]
  snippets: string[]
}

const TAG_PATTERN = /<(pm-[a-z0-9-]+)/g
const MAX_SNIPPET = 260

/** 内置 pack 目录（`templates/design-system/<packId>`） */
export function builtinPackRoot(packId: string): string {
  return path.join(builtinDesignSystemRoot(), packId)
}

/** 共享映射 `templates/design-system/component-controls.json`（20 键 pm-* → 控件） */
export function componentControlsFile(): string {
  return path.join(builtinDesignSystemRoot(), 'component-controls.json')
}

let controlsCache: { mtimeMs: number; controls: Record<string, string> } | null = null

export function readComponentControls(): Record<string, string> {
  const file = componentControlsFile()
  const mtimeMs = fs.statSync(file).mtimeMs
  if (controlsCache && controlsCache.mtimeMs === mtimeMs) return controlsCache.controls
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  const controls: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string' || !value.trim()) continue
    controls[key] = value.trim()
  }
  controlsCache = { mtimeMs, controls }
  return controls
}

/** 从蓝图文本提取标签用法片段（最多 3 行 / 260 字符，去重，最多 3 条） */
export function snippetsOf(text: string, name?: string, limit = 3): string[] {
  const snippets: string[] = []
  const pattern = new RegExp(TAG_PATTERN.source, 'g')
  let match = pattern.exec(text)
  while (match) {
    if (name && match[1] !== name) {
      match = pattern.exec(text)
      continue
    }
    const start = match.index
    const end = text.indexOf('>', start)
    const raw = end >= 0 ? text.slice(start, end + 1) : text.slice(start, start + MAX_SNIPPET)
    const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET)
    if (snippet && !snippets.includes(snippet)) snippets.push(snippet)
    if (snippets.length >= limit) break
    match = pattern.exec(text)
  }
  return snippets
}

interface ScanCache {
  version: string
  entries: ComponentScanEntry[]
}

const scanCache = new Map<string, ScanCache>()

/**
 * 扫描内置 pack 的全部蓝图：
 * - 标签引用次数 / 页面引用次数；
 * - contractControl 来自共享映射（20 键）；
 * - 用法片段 + componentMap 类型。
 */
export function scanComponents(pack: DesignPack, root = builtinPackRoot(pack.id)): ComponentScanEntry[] {
  const cacheKey = `${pack.id}:${pack.version}:${root}`
  const cached = scanCache.get(cacheKey)
  if (cached && cached.version === pack.version) return cached.entries

  const controls = readComponentControls()
  const byName = new Map<string, ComponentScanEntry>()
  const pageRefs = new Map<string, string[]>()
  const snippets = new Map<string, string[]>()
  const tagCounts = new Map<string, number>()

  const ensure = (name: string) => {
    let entry = byName.get(name)
    if (!entry) {
      entry = {
        name,
        category: controls[name] ? 'control' : 'container',
        tagReferences: 0,
        pageReferences: 0,
        pages: [],
        contractControl: controls[name] ?? null,
        contractSupported: Boolean(controls[name]),
        componentMapTypes: [],
        snippets: []
      }
      byName.set(name, entry)
    }
    return entry
  }

  for (const type of pack.applicationTypes) {
    for (const page of type.pages) {
      const catalogRef = `${type.id}/${page.id}`
      const blueprint = page.blueprint
      if (!blueprint) continue
      const file = path.join(root, blueprint)
      if (!fs.existsSync(file)) continue
      const text = fs.readFileSync(file, 'utf8')
      const tag = new RegExp(TAG_PATTERN.source, 'g')
      let match = tag.exec(text)
      while (match) {
        const name = match[1]
        ensure(name)
        tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1)
        const pages = pageRefs.get(name) ?? []
        if (!pages.includes(catalogRef)) pages.push(catalogRef)
        pageRefs.set(name, pages)
        snippets.set(name, snippetsOf(text, name))
        match = tag.exec(text)
      }
    }
  }

  const entries = [...byName.values()].map(entry => {
    const componentMapTypes = Object.entries(pack.componentMap)
      .filter(([, component]) => component === entry.name)
      .map(([type]) => type)
    return {
      ...entry,
      tagReferences: tagCounts.get(entry.name) ?? 0,
      pageReferences: (pageRefs.get(entry.name) ?? []).length,
      pages: pageRefs.get(entry.name) ?? [],
      componentMapTypes,
      snippets: snippets.get(entry.name) ?? []
    }
  })
  entries.sort((a, b) => a.name.localeCompare(b.name))
  scanCache.set(cacheKey, { version: pack.version, entries })
  return entries
}

/** 内置 pack 的组件名并集（供生成器做 component-unknown 软校验） */
export function knownComponentsOf(pack: DesignPack): string[] {
  return scanComponents(pack).map(entry => entry.name)
}

/** 内置 pack（默认第一个） */
export function builtinPack(packId?: string): DesignPack {
  return getBuiltinPack(packId)
}

export function normalizeDraftSpec(
  raw: unknown,
  options: { packId?: string; reservedIds?: string[]; builtin?: DesignPack }
): NormalizeResult {
  const pack = options.builtin ?? builtinPack()
  // 保留 id：所有内置 pack id（含应用类型 id，由核心另加）+ 其它自定义模板 id
  const builtinReserved = listBuiltinPackIds().filter(id => id !== pack.id)
  return workshopCore().spec.normalizeSpec(raw, {
    packId: options.packId,
    builtin: pack,
    reservedIds: [...builtinReserved, ...(options.reservedIds ?? [])],
    knownComponents: knownComponentsOf(pack)
  })
}

export function specHashOf(spec: unknown): string {
  return workshopCore().spec.specHash(spec)
}

export function buildSyntheticDesign(spec: unknown, pageId: string): Record<string, unknown> | null {
  return workshopCore().spec.buildSyntheticDesign(spec, pageId)
}

export function flattenContractPage(contract: unknown): Record<string, unknown> {
  return workshopCore().spec.flattenContract(contract)
}

export function previewForRecipe(recipe: string): string {
  return workshopCore().spec.previewForRecipe(recipe)
}
