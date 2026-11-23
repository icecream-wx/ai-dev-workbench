/**
 * 应用级设计系统文件（P7-5a / P7-7c）
 *
 * 把应用选中的设计模板（pack / applicationType / style）落成工作区文件：
 *
 * - `docs/design/design-system.json`：应用级只读摘要（pack/type/style/蓝图/页面/skill；
 *   自定义 pack 额外写 `origin` / `preview`，页面写 `kind`/`source`/`contractFile`）；
 * - `docs/design/template/<applicationType>/pages/*.vue`（blueprint/reference 蓝图副本）；
 * - `docs/design/template/<applicationType>/contracts/<pageId>.json`（contract 页契约，无蓝图）；
 * - `docs/design/template/<applicationType>/structure.css`（合并后的结构样式，原样复制）；
 * - `docs/design/template/styles/shared.css` + `styles/<styleId>/style.css`（选中风格）。
 *
 * 约束：
 * - 只复制被选中的应用类型，不复制 4 套全部；
 * - 目标文件是**受管副本**（覆盖式、幂等），开发把页面复制到 `frontend/src/views/` 后修改；
 * - pack 的 web 路径来自 `pack.json` 相对路径，不做任何路径拼接以外的解释；
 * - contract 页不产生 `.vue`，只写 `contracts/<pageId>.json`；
 * - 校验失败抛 DesignError（调用方决定 4xx），不产生半成品目录。
 */
import fs from 'node:fs'
import path from 'node:path'
import { DesignError } from './errors'
import {
  getApplicationType,
  getPack,
  getStyle,
  packDirOf,
  pageKindOf,
  type DesignApplicationType,
  type DesignPack,
  type DesignPageKind,
  type DesignPageMeta,
  type DesignStyle
} from './pack'

export interface DesignSelectionInput {
  pack: string
  applicationType: string
  style: string
}

export interface DesignSystemPageSource {
  pack: string
  applicationType: string
  pageId: string
}

export interface DesignSystemPageSummary {
  id: string
  name: string
  type: string
  recipe: string
  description: string
  /** 页面种类：blueprint（内置）/ reference（自定义引用页）/ contract（自定义契约页） */
  kind: DesignPageKind
  /** 工作区蓝图路径（blueprint/reference 有；contract 省略） */
  blueprint?: string
  /** pack 内原始相对路径（仅 blueprint/reference，追溯用） */
  packBlueprint?: string
  /** 仅 reference：来源内置页面 */
  source?: DesignSystemPageSource
  /** 仅 contract：工作区契约文件 */
  contractFile?: string
  components: string[]
  blocks?: number
}

export interface DesignSystemPreview {
  kind: 'custom'
  /** 自定义页面的根类/结构样式基准应用类型（内置源类型） */
  baseApplicationType: string
  /** 工作区合并后的结构样式（相对应用目录） */
  structure: string
  /** 应用内只读资产接口（缺少 appId 时不写） */
  structureUrl?: string
  styleClassName: string
  packVersion: string
}

export interface DesignSystemOrigin {
  kind: 'custom'
  draftId: string
  baseApplicationType: string
}

export interface DesignSystemSummary {
  schemaVersion: 1
  pack: string
  packName: string
  packVersion: string
  /** 仅自定义 pack：来源信息（内置省略，保持旧应用可读） */
  origin?: DesignSystemOrigin
  applicationType: string
  applicationTypeName: string
  style: string
  styleName: string
  styleClassName: string
  /** 蓝图根（相对应用目录） */
  blueprintRoot: string
  /** 当前应用类型蓝图目录（相对应用目录） */
  templateDir: string
  /** 当前应用类型结构样式（相对应用目录） */
  structure: string
  styles: {
    /** pack 未提供 shared.css 时为 null */
    shared: string | null
    /** 选中风格样式：docs/design/template/styles/<styleId>/style.css */
    style: string
    /** 选中风格 id（与 pack 风格 id 一致；旧应用可能缺失） */
    styleId: string
  }
  /** 仅自定义 pack：设计预览映射（内置省略；读取方按 registry 兼容） */
  preview?: DesignSystemPreview
  pages: DesignSystemPageSummary[]
  skills: string[]
}

export interface DesignSystemSummaryOptions {
  /** 应用 id：写入 preview.structureUrl（应用内资产接口） */
  appId?: string
}

const BLUEPRINT_ROOT = 'docs/design/template'

function pageTarget(applicationType: string, sourceBlueprint: string): string {
  return `${BLUEPRINT_ROOT}/${applicationType}/pages/${path.posix.basename(sourceBlueprint)}`
}

function contractTarget(applicationType: string, pageId: string): string {
  return `${BLUEPRINT_ROOT}/${applicationType}/contracts/${pageId}.json`
}

/** reference/blueprint 页必须有蓝图；contract 页不允许蓝图 */
function blueprintOf(page: DesignPageMeta): string {
  if (pageKindOf(page) === 'contract') {
    throw new DesignError(400, `契约页 ${page.id} 不应有蓝图`)
  }
  if (!page.blueprint) throw new DesignError(400, `模板页面 ${page.id} 缺少蓝图`)
  return page.blueprint
}

function pageSummaryOf(typeId: string, page: DesignPageMeta): DesignSystemPageSummary {
  const kind = pageKindOf(page)
  if (kind === 'contract') {
    return {
      id: page.id,
      name: page.name,
      type: page.type,
      recipe: page.recipe,
      description: page.description,
      kind,
      contractFile: contractTarget(typeId, page.id),
      components: [...page.components],
      ...(page.blocks === undefined ? {} : { blocks: page.blocks })
    }
  }
  const blueprint = blueprintOf(page)
  return {
    id: page.id,
    name: page.name,
    type: page.type,
    recipe: page.recipe,
    description: page.description,
    kind,
    blueprint: pageTarget(typeId, blueprint),
    packBlueprint: blueprint,
    ...(page.source
      ? {
          source: {
            pack: page.source.pack,
            applicationType: page.source.applicationType,
            pageId: page.source.pageId
          }
        }
      : {}),
    components: [...page.components],
    ...(page.blocks === undefined ? {} : { blocks: page.blocks })
  }
}

/** 构建摘要（校验 pack/type/style；不写文件） */
export function buildDesignSystemSummary(
  selection: DesignSelectionInput,
  options: DesignSystemSummaryOptions = {}
): DesignSystemSummary {
  const pack = getPack(selection.pack)
  const type = getApplicationType(pack, selection.applicationType)
  const style = getStyle(pack, selection.style)
  const packDir = packDirOf(pack.id)
  const sharedExists = fs.existsSync(path.join(packDir, 'styles', 'shared.css'))
  const templateDir = `${BLUEPRINT_ROOT}/${type.id}`
  const custom = pack.origin?.kind === 'custom'
  const appId = typeof options.appId === 'string' ? options.appId.trim() : ''
  const structure = `${templateDir}/structure.css`
  return {
    schemaVersion: 1,
    pack: pack.id,
    packName: pack.name,
    packVersion: pack.version,
    ...(custom && pack.origin
      ? {
          origin: {
            kind: 'custom' as const,
            draftId: pack.origin.draftId,
            baseApplicationType: pack.origin.baseApplicationType
          }
        }
      : {}),
    applicationType: type.id,
    applicationTypeName: type.name,
    style: style.id,
    styleName: style.name,
    styleClassName: style.className,
    blueprintRoot: BLUEPRINT_ROOT,
    templateDir,
    structure,
    styles: {
      shared: sharedExists ? `${BLUEPRINT_ROOT}/styles/shared.css` : null,
      style: `${BLUEPRINT_ROOT}/styles/${style.id}/style.css`,
      styleId: style.id
    },
    ...(custom && pack.origin
      ? {
          preview: {
            kind: 'custom' as const,
            baseApplicationType: pack.origin.baseApplicationType,
            structure,
            ...(appId
              ? {
                  structureUrl: `/api/apps/${encodeURIComponent(appId)}/design-system/asset?path=${encodeURIComponent(
                    `${type.id}/structure.css`
                  )}`
                }
              : {}),
            styleClassName: style.className,
            packVersion: pack.version
          }
        }
      : {}),
    pages: type.pages.map(page => pageSummaryOf(type.id, page)),
    skills: [...pack.skills]
  }
}

function writeFileIfChanged(file: string, content: Buffer | string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
  if (fs.existsSync(file)) {
    try {
      if (fs.readFileSync(file).equals(buffer)) return
    } catch {
      // 读取失败按需要重写
    }
  }
  fs.writeFileSync(file, buffer)
}

function copyIfChanged(source: string, target: string): void {
  writeFileIfChanged(target, fs.readFileSync(source))
}

/** 契约文件内容（设计稿附录 F；不写时间戳，幂等） */
export function contractFileContent(page: DesignPageMeta): string {
  const payload: Record<string, unknown> = {
    schemaVersion: 1,
    pageId: page.id,
    name: page.name,
    recipe: page.recipe,
    contract: page.contract ?? {}
  }
  if (page.sampleEntity) payload.sampleEntity = page.sampleEntity
  if (page.sampleSubEntities?.length) payload.sampleSubEntities = page.sampleSubEntities
  return `${JSON.stringify(payload, null, 2)}\n`
}

function copyTypeFiles(appDir: string, pack: DesignPack, type: DesignApplicationType, style: DesignStyle): void {
  const packDir = packDirOf(pack.id)
  const targetDir = path.join(appDir, BLUEPRINT_ROOT, type.id)

  // 合并后的 structure.css 原样复制（自定义 pack 已把来源类型合并）
  copyIfChanged(path.join(packDir, type.structure), path.join(appDir, BLUEPRINT_ROOT, type.id, 'structure.css'))

  const names = new Set<string>()
  for (const page of type.pages) {
    if (pageKindOf(page) === 'contract') {
      // 契约页：只写 contracts/<pageId>.json，不复制任何源蓝图
      writeFileIfChanged(path.join(appDir, contractTarget(type.id, page.id)), contractFileContent(page))
      continue
    }
    const blueprint = blueprintOf(page)
    const base = path.posix.basename(blueprint)
    if (names.has(base)) {
      throw new Error(`应用类型 ${type.id} 存在同名蓝图文件：${base}`)
    }
    names.add(base)
    copyIfChanged(path.join(packDir, blueprint), path.join(targetDir, 'pages', base))
  }

  for (const asset of type.assets ?? []) {
    copyIfChanged(path.join(packDir, asset), path.join(targetDir, 'assets', path.posix.basename(asset)))
  }

  const sharedSource = path.join(packDir, 'styles', 'shared.css')
  if (fs.existsSync(sharedSource)) {
    copyIfChanged(sharedSource, path.join(appDir, BLUEPRINT_ROOT, 'styles', 'shared.css'))
  }
  copyIfChanged(path.join(packDir, style.css), path.join(appDir, BLUEPRINT_ROOT, 'styles', style.id, 'style.css'))
}

/** 写 design-system.json（覆盖式、幂等；受管资源） */
export function writeDesignSystemJson(appDir: string, summary: DesignSystemSummary): void {
  writeFileIfChanged(
    path.join(appDir, 'docs', 'design', 'design-system.json'),
    `${JSON.stringify(summary, null, 2)}\n`
  )
}

/**
 * 写入应用设计系统文件（摘要 + 蓝图/契约 + 样式）；返回本次使用的摘要。
 * 调用前应先确认应用目录存在（scaffold 在复制后端后调用）。
 */
export function writeDesignSystemWorkspace(
  appDir: string,
  selection: DesignSelectionInput,
  options: DesignSystemSummaryOptions = {}
): DesignSystemSummary {
  const summary = buildDesignSystemSummary(selection, options)
  const pack = getPack(summary.pack)
  const type = getApplicationType(pack, summary.applicationType)
  const style = getStyle(pack, summary.style)
  copyTypeFiles(appDir, pack, type, style)
  writeDesignSystemJson(appDir, summary)
  return summary
}
