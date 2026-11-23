/**
 * 应用级设计系统
 *
 * - 选择存 `app_settings` 的三个键：`app.<id>.design.pack|applicationType|style`（不改表）；
 * - 内置 pack 从文件读取；无三键的应用按默认 pack/应用类型/风格解析（global-default）；
 * - 读取容忍失效值（回退默认），写入严格校验（非法参数 4xx）。
 *
 * 设计阶段只走「设计模板 = 应用类型 × 视觉风格 + 页面库」，不再有旧原型模板/legacy 分支。
 */
import { db, readSetting, writeSetting } from '../db'
import { DesignError } from '../design/errors'
import {
  defaultPackId,
  getApplicationType,
  getPack,
  getPackSource,
  getStyle,
  type DesignApplicationType,
  type DesignPack,
  type DesignPackSource,
  type DesignPageMeta,
  type DesignStyle
} from '../design/pack'

export interface DesignSelection {
  pack: string
  applicationType: string
  style: string
}

export interface DesignSelectionInput {
  pack?: unknown
  applicationType?: unknown
  style?: unknown
}

export interface AppDesignSystemPage extends DesignPageMeta {
  /** 仅 contract 页：工作区契约文件（docs/design/template/<type>/contracts/<pageId>.json） */
  contractFile?: string
}

export interface AppDesignSystemOrigin {
  kind: 'custom'
  draftId: string
  baseApplicationType: string
}

export interface AppDesignSystemPreview {
  kind: 'custom'
  baseApplicationType: string
  structure: string
  structureUrl: string
  styleClassName: string
  packVersion: string
}

export interface AppDesignSystem {
  appId: string
  source: DesignPackSource | 'global-default' | 'app-default'
  pack: {
    id: string
    name: string
    version: string
    source: DesignPackSource
  } | null
  /** 仅自定义 pack：来源信息（内置为 null，旧应用可忽略） */
  origin: AppDesignSystemOrigin | null
  /** 仅自定义 pack：设计预览映射（内置为 null，走 preview registry） */
  preview: AppDesignSystemPreview | null
  applicationType: {
    id: string
    name: string
    category: string
    description: string
    structure: string
    defaultStyle: string
    pageCount: number
  } | null
  style: DesignStyle | null
  pages: AppDesignSystemPage[]
  skills: string[]
  componentMap: Record<string, string>
  pageRecipes: Record<string, string[]>
  conformance: string[]
  resolved: { pack: string; applicationType: string; style: string; pageCount: number } | null
}

interface AppDesignRow {
  id: string
  name: string
}

function settingKey(appId: string, name: string): string {
  return `app.${appId}.design.${name}`
}

function trimmed(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function appRow(appId: string): AppDesignRow {
  const row = db.prepare('SELECT id, name FROM apps WHERE id = ?').get(appId) as AppDesignRow | undefined
  if (!row) throw new DesignError(404, `应用不存在：${appId}`)
  return row
}

export function readDesignSelection(appId: string): Partial<DesignSelection> {
  const pack = readSetting<unknown>(settingKey(appId, 'pack'))
  const applicationType = readSetting<unknown>(settingKey(appId, 'applicationType'))
  const style = readSetting<unknown>(settingKey(appId, 'style'))
  return {
    ...(trimmed(pack) ? { pack: trimmed(pack) } : {}),
    ...(trimmed(applicationType) ? { applicationType: trimmed(applicationType) } : {}),
    ...(trimmed(style) ? { style: trimmed(style) } : {})
  }
}

export function writeDesignSelection(appId: string, selection: DesignSelection): void {
  writeSetting(settingKey(appId, 'pack'), selection.pack)
  writeSetting(settingKey(appId, 'applicationType'), selection.applicationType)
  writeSetting(settingKey(appId, 'style'), selection.style)
}

/** 请求体 → 设计系统输入；支持扁平字段或 designSystem 对象 */
export function designSelectionInputFromBody(body: Record<string, unknown>): DesignSelectionInput {
  const nested =
    body.designSystem && typeof body.designSystem === 'object' && !Array.isArray(body.designSystem)
      ? (body.designSystem as Record<string, unknown>)
      : undefined
  return {
    pack: body.designPack ?? nested?.pack,
    applicationType: body.designApplicationType ?? nested?.applicationType,
    style: body.designStyle ?? nested?.style
  }
}

function loadPackForSelection(packId: string): DesignPack {
  try {
    return getPack(packId)
  } catch (error) {
    if (error instanceof DesignError && error.status === 404) {
      throw new DesignError(400, `设计模板包不存在：${packId}`)
    }
    throw error
  }
}

function loadType(pack: DesignPack, typeId: string): DesignApplicationType {
  try {
    return getApplicationType(pack, typeId)
  } catch (error) {
    if (error instanceof DesignError && error.status === 404) {
      throw new DesignError(400, `应用类型不存在：${typeId}（模板包 ${pack.id}）`)
    }
    throw error
  }
}

function loadStyle(pack: DesignPack, styleId: string): DesignStyle {
  try {
    return getStyle(pack, styleId)
  } catch (error) {
    if (error instanceof DesignError && error.status === 404) {
      throw new DesignError(400, `视觉风格不存在：${styleId}（模板包 ${pack.id}）`)
    }
    throw error
  }
}

/** 严格校验并补默认：pack → applicationType → style */
export function resolveDesignSelection(input: DesignSelectionInput): DesignSelection {
  const packId = trimmed(input.pack) ?? defaultPackId()
  const pack = loadPackForSelection(packId)
  const typeId = trimmed(input.applicationType) ?? pack.defaultApplicationType
  const type = loadType(pack, typeId)
  const styleId = trimmed(input.style) ?? type.defaultStyle ?? pack.defaultStyle
  const style = loadStyle(pack, styleId)
  return { pack: pack.id, applicationType: type.id, style: style.id }
}

/** PATCH：未提供的字段沿用当前值；切换 pack 时失效的类型/风格回退新 pack 默认 */
export function updateAppDesignSelection(appId: string, input: DesignSelectionInput): DesignSelection {
  appRow(appId)
  const current = readDesignSelection(appId)
  const requestedPackId = trimmed(input.pack)
  let packId = requestedPackId ?? current.pack ?? defaultPackId()
  let pack: DesignPack
  if (requestedPackId) {
    pack = loadPackForSelection(packId)
  } else {
    try {
      pack = getPack(packId)
    } catch {
      // 已存的 pack 文件被移除：未显式指定时回退默认，不阻断 PATCH
      packId = defaultPackId()
      pack = getPack(packId)
    }
  }
  const currentPackId = current.pack ?? defaultPackId()
  const packChanged = packId !== currentPackId

  const requestedTypeId = trimmed(input.applicationType)
  const typeId =
    requestedTypeId ??
    (pack.applicationTypes.some(type => type.id === current.applicationType)
      ? (current.applicationType as string)
      : pack.defaultApplicationType)
  const type = loadType(pack, typeId)

  const requestedStyleId = trimmed(input.style)
  const currentStyleValid = pack.styles.some(style => style.id === current.style)
  const typeChanged = type.id !== current.applicationType
  const styleId =
    requestedStyleId ??
    (!packChanged && !typeChanged && currentStyleValid ? (current.style as string) : type.defaultStyle ?? pack.defaultStyle)
  const style = loadStyle(pack, styleId)

  const selection: DesignSelection = { pack: pack.id, applicationType: type.id, style: style.id }
  writeDesignSelection(appId, selection)
  return selection
}

function safePack(packId: string | undefined): { pack: DesignPack; source: DesignPackSource; usedDefault: boolean } {
  if (packId) {
    try {
      return { pack: getPack(packId), source: getPackSource(packId), usedDefault: false }
    } catch (error) {
      console.warn(`[design-system] 应用设计模板包失效，回退默认：${packId}（${error instanceof Error ? error.message : String(error)}）`)
    }
  }
  const fallback = getPack(defaultPackId())
  return { pack: fallback, source: 'builtin', usedDefault: true }
}

function safeType(pack: DesignPack, typeId: string | undefined): DesignApplicationType {
  const found = typeId ? pack.applicationTypes.find(type => type.id === typeId) : undefined
  return found ?? getApplicationType(pack, pack.defaultApplicationType)
}

function safeStyle(pack: DesignPack, type: DesignApplicationType, styleId: string | undefined): DesignStyle {
  const found = styleId ? pack.styles.find(style => style.id === styleId) : undefined
  return found ?? pack.styles.find(style => style.id === type.defaultStyle) ?? pack.styles[0]
}

/** GET /api/apps/:id/design-system：应用级解析（无三键 → 默认 pack/global-default） */
export function resolveAppDesignSystem(appId: string): AppDesignSystem {
  appRow(appId)
  const current = readDesignSelection(appId)
  const hasDesignSelection = Boolean(current.pack || current.applicationType || current.style)
  const { pack, source, usedDefault } = safePack(current.pack)
  const type = safeType(pack, current.applicationType)
  const style = safeStyle(pack, type, current.style)
  const custom = pack.origin?.kind === 'custom'
  const templateDir = `docs/design/template/${type.id}`
  const structure = `${templateDir}/structure.css`
  const origin: AppDesignSystemOrigin | null =
    custom && pack.origin
      ? {
          kind: 'custom',
          draftId: pack.origin.draftId,
          baseApplicationType: pack.origin.baseApplicationType
        }
      : null
  const preview: AppDesignSystemPreview | null =
    custom && pack.origin
      ? {
          kind: 'custom',
          baseApplicationType: pack.origin.baseApplicationType,
          structure,
          structureUrl: `/api/apps/${encodeURIComponent(appId)}/design-system/asset?path=${encodeURIComponent(
            `${type.id}/structure.css`
          )}`,
          styleClassName: style.className,
          packVersion: pack.version
        }
      : null
  const pages: AppDesignSystemPage[] = type.pages.map(page => ({
    ...page,
    ...(page.kind === 'contract'
      ? { contractFile: `${templateDir}/contracts/${page.id}.json` }
      : {})
  }))
  return {
    appId,
    source: hasDesignSelection && !usedDefault ? 'app-default' : 'global-default',
    pack: { id: pack.id, name: pack.name, version: pack.version, source },
    origin,
    preview,
    applicationType: {
      id: type.id,
      name: type.name,
      category: type.category,
      description: type.description,
      structure: type.structure,
      defaultStyle: type.defaultStyle,
      pageCount: type.pages.length
    },
    style,
    pages,
    skills: pack.skills,
    componentMap: pack.componentMap,
    pageRecipes: pack.pageRecipes,
    conformance: pack.conformance,
    resolved: { pack: pack.id, applicationType: type.id, style: style.id, pageCount: type.pages.length }
  }
}

/** 应用 payload 摘要（列表/详情共用；异常时返回 null，不影响应用读取） */
export function appDesignSystemPayload(appId: string): {
  designSystem: Record<string, unknown> | null
} {
  let resolved: AppDesignSystem
  try {
    resolved = resolveAppDesignSystem(appId)
  } catch (error) {
    console.warn(`[design-system] 应用设计系统解析失败：${appId}（${error instanceof Error ? error.message : String(error)}）`)
    return { designSystem: null }
  }
  return {
    designSystem: {
      pack: resolved.pack,
      origin: resolved.origin,
      applicationType: resolved.applicationType,
      style: resolved.style,
      pageCount: resolved.resolved?.pageCount ?? 0,
      source: resolved.source
    }
  }
}
