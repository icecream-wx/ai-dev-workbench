/**
 * 设计模板包（design pack）加载与校验（P7-1 / P7-7a）
 *
 * - 内置 pack：`templates/design-system/<pack-id>/pack.json`（仓库，只读）；
 * - 自定义 pack：`<dataDir>/design-system/<pack-id>/pack.json`（生成器/发布落地）；
 * - 所有文件引用必须是 pack 内相对路径（禁止绝对路径、`..`、越界）；
 * - 内置 pack 只从文件读取，不写入数据库。
 *
 * P7-7a 页面模型扩展（设计稿 §5）：
 * - `kind`：`blueprint`（内置 pack 页面）/ `reference`（自定义 pack 引用页）/ `contract`（自定义 pack 契约页）；
 * - 内置/非自定义 pack 页面缺省 `kind` + 有 `blueprint` → 按 `blueprint` 兼容，且不允许 `source`；
 * - 自定义 pack（`origin.kind=custom`）页面必须显式 kind（reference/contract），`contract` 页无蓝图；
 * - `origin` 可选；存在时校验 kind/draftId/baseApplicationType/style/revision/specHash。
 *
 * `validatePackDir(dir, expectedId?)` 是生成/发布/运行时校验的**唯一权威**；
 * 生成器暂存目录名为 `pack`，必须显式传入 expectedId（不套用 `id === basename`）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config'
import { designContractWarnings } from '../workspace/design-contract'
import { DesignError } from './errors'

export type DesignDensity = 'compact' | 'comfortable'
export type DesignPageKind = 'blueprint' | 'reference' | 'contract'

export interface DesignStyleTokens {
  primary: string
  accent: string
  neutral: string
  background: string
  radius: number
  density: DesignDensity
}

export interface DesignStyle {
  id: string
  name: string
  className: string
  css: string
  description: string
  signature: string
  tokens: DesignStyleTokens
}

export interface DesignSampleField {
  name: string
  label?: string
  type?: string
  required?: boolean
  unique?: boolean
  options?: string[]
  ref?: string
  note?: string
}

export interface DesignSampleEntity {
  id: string
  name: string
  fields: DesignSampleField[]
}

export interface DesignPageSource {
  pack: string
  applicationType: string
  pageId: string
  blueprint?: string
  sha256?: string
}

export interface DesignPageMeta {
  id: string
  name: string
  type: string
  recipe: string
  preview: string
  description: string
  /** 解析后的页面种类；内置 pack 页面缺省按 blueprint */
  kind: DesignPageKind
  /** blueprint/reference 必有；contract 页禁止 */
  blueprint?: string
  /** 仅 reference */
  source?: DesignPageSource
  /** 仅 contract：design.json 页面契约容器（原样保留） */
  contract?: Record<string, unknown>
  /** 仅 contract：模板预览用样例外键 */
  sampleEntity?: DesignSampleEntity
  sampleSubEntities?: DesignSampleEntity[]
  components: string[]
  blocks?: number
}

export interface DesignApplicationType {
  id: string
  name: string
  category: string
  description: string
  structure: string
  assets?: string[]
  defaultStyle: string
  pages: DesignPageMeta[]
}

export interface DesignPackOrigin {
  kind: 'custom'
  draftId: string
  builtFrom?: { pack: string; version: string }
  baseApplicationType: string
  style: string
  revision: number
  specHash?: string
  publishedAt?: string
}

export interface DesignPack {
  schemaVersion: 1
  id: string
  name: string
  version: string
  defaultApplicationType: string
  defaultStyle: string
  origin?: DesignPackOrigin
  applicationTypes: DesignApplicationType[]
  styles: DesignStyle[]
  skills: string[]
  componentMap: Record<string, string>
  pageRecipes: Record<string, string[]>
  conformance: string[]
}

export type DesignPackSource = 'builtin' | 'custom'

export interface DesignApplicationTypeSummary {
  id: string
  name: string
  category: string
  description: string
  structure: string
  defaultStyle: string
  pageCount: number
}

export interface DesignStyleSummary {
  id: string
  name: string
  className: string
  description: string
  signature: string
  css: string
  tokens: DesignStyleTokens
}

export interface DesignPackSummary {
  id: string
  name: string
  version: string
  defaultApplicationType: string
  defaultStyle: string
  /** 兼容字段：builtin/custom */
  source: DesignPackSource
  /** P7-7a：显式模板来源（同 source，供新客户端使用） */
  templateKind: DesignPackSource
  origin?: DesignPackOrigin
  pageCount: number
  applicationTypes: DesignApplicationTypeSummary[]
  styles: DesignStyleSummary[]
  skills: string[]
}

export interface PackValidationIssue {
  code: string
  path?: string
  message: string
}

export interface PackValidation {
  ok: boolean
  pack?: DesignPack
  errors: PackValidationIssue[]
  warnings: PackValidationIssue[]
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const PAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const PAGE_KINDS: DesignPageKind[] = ['blueprint', 'reference', 'contract']

function fail(message: string): never {
  throw new DesignError(400, message)
}

function requireString(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} 必须是非空字符串`)
  const text = value.trim()
  if (text.length > max) fail(`${label} 过长（最多 ${max} 字符）`)
  return text
}

function optionalString(value: unknown, label: string, max = 500): string | undefined {
  if (value === undefined || value === null) return undefined
  return requireString(value, label, max)
}

function requirePackId(value: unknown, label: string): string {
  const id = requireString(value, label, 64)
  if (!ID_PATTERN.test(id)) fail(`${label} 只能包含小写字母、数字和短横线：${id}`)
  return id
}

function requirePageId(value: unknown, label: string): string {
  const id = requireString(value, label, 64)
  if (!PAGE_ID_PATTERN.test(id)) fail(`${label} 只能包含字母、数字、下划线和短横线：${id}`)
  return id
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} 必须是对象`)
  return value as Record<string, unknown>
}

function requireStringArray(value: unknown, label: string, allowEmpty = false): string[] {
  if (!Array.isArray(value)) fail(`${label} 必须是字符串数组`)
  const items = value.map((item, index) => requireString(item, `${label}[${index}]`, 200))
  if (!allowEmpty && !items.length) fail(`${label} 不能为空`)
  return items
}

function optionalBlocks(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined
  const blocks = Number(value)
  if (!Number.isInteger(blocks) || blocks < 0) fail(`${label} 必须是非负整数`)
  return blocks
}

/** 禁止绝对路径、盘符、`..`、NUL；统一为 `/` 分隔的相对路径 */
export function assertPackRelativePath(value: unknown, label: string): string {
  const raw = requireString(value, label, 500)
  if (raw.includes('\0')) fail(`${label} 含非法字符`)
  const normalized = raw.replace(/\\/g, '/')
  if (normalized.startsWith('/') || path.win32.isAbsolute(raw) || /^[a-zA-Z]:/.test(normalized)) {
    fail(`${label} 不能是绝对路径：${raw}`)
  }
  const segments = normalized.split('/')
  if (segments.some(segment => segment === '..')) fail(`${label} 不能包含 ".."：${raw}`)
  if (segments.some(segment => segment === '' || segment === '.')) fail(`${label} 路径不规范：${raw}`)
  return normalized
}

/** 解析 pack 内文件路径；存在性 + 越界校验 */
export function resolvePackAsset(rootDir: string, value: unknown, label: string): string {
  const relative = assertPackRelativePath(value, label)
  const root = path.resolve(rootDir)
  const full = path.resolve(root, relative)
  const inside = path.relative(root, full)
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) {
    fail(`${label} 越出模板目录：${relative}`)
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) fail(`${label} 文件不存在：${relative}`)
  return full
}

export function builtinDesignSystemRoot(): string {
  return path.resolve(__dirname, '../../../templates/design-system')
}

export function customDesignSystemRoot(): string {
  return path.join(config.dataDir, 'design-system')
}

interface CachedPack {
  mtimeMs: number
  pack: DesignPack
}

const packCache = new Map<string, CachedPack>()

export function clearDesignPackCache(): void {
  packCache.clear()
}

interface ParseContext {
  rootDir: string
  dirId: string
  source: DesignPackSource
  /** 由 origin.kind 判定（pack.json 已解析后设置） */
  isCustomOrigin?: boolean
  warnings: PackValidationIssue[]
}

function warning(ctx: ParseContext, code: string, pathValue: string, message: string): void {
  ctx.warnings.push({ code, path: pathValue, message })
}

function parseOrigin(raw: unknown): DesignPackOrigin | undefined {
  if (raw === undefined || raw === null) return undefined
  const input = requireObject(raw, 'origin')
  if (input.kind !== 'custom') fail('origin.kind 只能是 custom')
  const kind = 'custom' as const
  const revision = Number(input.revision)
  if (!Number.isInteger(revision) || revision < 0) fail('origin.revision 必须是非负整数')
  let builtFrom: DesignPackOrigin['builtFrom']
  if (input.builtFrom !== undefined) {
    const built = requireObject(input.builtFrom, 'origin.builtFrom')
    builtFrom = {
      pack: requireString(built.pack, 'origin.builtFrom.pack', 100),
      version: requireString(built.version, 'origin.builtFrom.version', 40)
    }
  }
  const specHash = optionalString(input.specHash, 'origin.specHash', 200)
  const publishedAt = optionalString(input.publishedAt, 'origin.publishedAt', 60)
  if (publishedAt && Number.isNaN(Date.parse(publishedAt))) fail('origin.publishedAt 必须是 ISO 时间字符串')
  return {
    kind,
    draftId: requirePackId(input.draftId, 'origin.draftId'),
    ...(builtFrom ? { builtFrom } : {}),
    baseApplicationType: requirePackId(input.baseApplicationType, 'origin.baseApplicationType'),
    style: requirePackId(input.style, 'origin.style'),
    revision,
    ...(specHash ? { specHash } : {}),
    ...(publishedAt ? { publishedAt } : {})
  }
}

function parseSampleField(raw: unknown, label: string): DesignSampleField {
  const input = requireObject(raw, label)
  const field: DesignSampleField = { name: requireString(input.name, `${label}.name`, 100) }
  const fieldLabel = optionalString(input.label, `${label}.label`, 100)
  if (fieldLabel) field.label = fieldLabel
  const type = optionalString(input.type, `${label}.type`, 40)
  if (type) field.type = type
  if (typeof input.required === 'boolean') field.required = input.required
  if (typeof input.unique === 'boolean') field.unique = input.unique
  if (input.options !== undefined) field.options = requireStringArray(input.options, `${label}.options`, true)
  const ref = optionalString(input.ref, `${label}.ref`, 100)
  if (ref) field.ref = ref
  const note = optionalString(input.note, `${label}.note`, 300)
  if (note) field.note = note
  return field
}

function parseSampleEntity(raw: unknown, label: string): DesignSampleEntity {
  const input = requireObject(raw, label)
  const id = requireString(input.id, `${label}.id`, 100)
  const fieldsRaw = input.fields
  if (!Array.isArray(fieldsRaw) || !fieldsRaw.length) fail(`${label}.fields 必须是非空数组`)
  const fields = fieldsRaw.map((item, index) => parseSampleField(item, `${label}.fields[${index}]`))
  const names = new Set<string>()
  for (const field of fields) {
    if (names.has(field.name)) fail(`${label}.fields 字段名重复：${field.name}`)
    names.add(field.name)
  }
  return { id, name: requireString(input.name, `${label}.name`, 100), fields }
}

function parseStyle(raw: unknown): DesignStyle {
  const input = requireObject(raw, 'styles[]')
  const id = requirePackId(input.id, '风格 id')
  const label = `风格 ${id}`
  const tokens = requireObject(input.tokens, `${label}.tokens`)
  const radius = Number(tokens.radius)
  if (!Number.isFinite(radius) || radius < 0 || radius > 64) fail(`${label}.tokens.radius 必须是 0—64 的数字`)
  const density = tokens.density === 'comfortable' ? 'comfortable' : tokens.density === 'compact' ? 'compact' : null
  if (!density) fail(`${label}.tokens.density 只能是 compact/comfortable`)
  return {
    id,
    name: requireString(input.name, `${label}.name`, 100),
    className: requireString(input.className, `${label}.className`, 100),
    css: assertPackRelativePath(input.css, `${label}.css`),
    description: requireString(input.description, `${label}.description`, 500),
    signature: requireString(input.signature, `${label}.signature`, 40),
    tokens: {
      primary: requireString(tokens.primary, `${label}.tokens.primary`, 40),
      accent: requireString(tokens.accent, `${label}.tokens.accent`, 40),
      neutral: requireString(tokens.neutral, `${label}.tokens.neutral`, 40),
      background: requireString(tokens.background, `${label}.tokens.background`, 40),
      radius,
      density
    }
  }
}

function parseSampleSubEntities(raw: unknown, label: string, mainId: string): DesignSampleEntity[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) fail(`${label} 必须是数组`)
  const list: DesignSampleEntity[] = []
  const ids = new Set<string>([mainId])
  for (const [index, item] of raw.entries()) {
    const entity = parseSampleEntity(item, `${label}[${index}]`)
    if (ids.has(entity.id)) fail(`${label}[${index}].id 重复：${entity.id}`)
    ids.add(entity.id)
    list.push(entity)
  }
  return list
}

function contractFieldRefs(contract: Record<string, unknown>): Array<{ name: string; path: string }> {
  const refs: Array<{ name: string; path: string }> = []
  const push = (value: unknown, pathValue: string) => {
    if (!Array.isArray(value)) return
    value.forEach((item, index) => {
      if (typeof item !== 'string' || !item.trim()) return
      refs.push({ name: item.trim(), path: `${pathValue}[${index}]` })
    })
  }
  push(contract.filters, 'filters')
  push(contract.columns, 'columns')
  const form = contract.form && typeof contract.form === 'object' && !Array.isArray(contract.form)
    ? (contract.form as Record<string, unknown>)
    : null
  if (form) {
    push(form.fields, 'form.fields')
    if (Array.isArray(form.groups)) {
      form.groups.forEach((group, index) => {
        if (!group || typeof group !== 'object' || Array.isArray(group)) return
        push((group as Record<string, unknown>).fields, `form.groups[${index}].fields`)
      })
    }
  }
  return refs
}

/** contract 页软校验：字段/子表/树 + 动作枚举（复用 design-contract 口径，只 warning） */
function contractWarnings(ctx: ParseContext, label: string, page: DesignPageMeta): void {
  const contract = page.contract && typeof page.contract === 'object' ? page.contract : null
  if (!contract) return
  const sample = page.sampleEntity
  const fieldNames = new Set((sample?.fields ?? []).map(field => field.name))
  for (const ref of contractFieldRefs(contract)) {
    if (!fieldNames.has(ref.name)) {
      warning(
        ctx,
        'page-field-unknown',
        `${label}.contract.${ref.path}`,
        `字段「${ref.name}」不在 sampleEntity.fields（预览会跳过）`
      )
    }
  }
  const pool = new Map<string, DesignSampleEntity>()
  if (sample) pool.set(sample.id, sample)
  for (const sub of page.sampleSubEntities ?? []) pool.set(sub.id, sub)
  const subTables = Array.isArray(contract.subTables) ? contract.subTables : []
  subTables.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return
    const record = item as Record<string, unknown>
    const entity = typeof record.entity === 'string' ? record.entity.trim() : ''
    const target = typeof record.target === 'string' ? record.target.trim() : ''
    const name = entity || target
    const targetEntity = name ? pool.get(name) : undefined
    if (!targetEntity) {
      warning(
        ctx,
        'sample-sub-entity-missing',
        `${label}.contract.subTables[${index}].${entity ? 'entity' : 'target'}`,
        `子表实体「${name || '未指定'}」不在 sampleEntity + sampleSubEntities 池（预览会跳过该子表）`
      )
      return
    }
    const targetNames = new Set(targetEntity.fields.map(field => field.name))
    const columns = Array.isArray(record.columns) ? record.columns : []
    columns.forEach((column, columnIndex) => {
      if (typeof column !== 'string' || !column.trim() || targetNames.has(column.trim())) return
      warning(
        ctx,
        'page-field-unknown',
        `${label}.contract.subTables[${index}].columns[${columnIndex}]`,
        `字段「${column.trim()}」不在子实体 ${name}.fields（预览会跳过）`
      )
    })
  })
  if (page.recipe === 'tree-list') {
    const tree = contract.tree && typeof contract.tree === 'object' && !Array.isArray(contract.tree)
      ? (contract.tree as Record<string, unknown>)
      : null
    const parentField = tree && typeof tree.parentField === 'string' ? tree.parentField.trim() : ''
    const titleField = tree && typeof tree.titleField === 'string' ? tree.titleField.trim() : ''
    if (!parentField) {
      warning(ctx, 'tree-parent-missing', `${label}.contract.tree.parentField`, '未配置 tree.parentField，树面板会扁平平铺')
    } else if (!fieldNames.has(parentField)) {
      warning(
        ctx,
        'tree-parent-missing',
        `${label}.contract.tree.parentField`,
        `parentField「${parentField}」不在 sampleEntity.fields，树面板会扁平展示`
      )
    }
    if (titleField && !fieldNames.has(titleField)) {
      warning(ctx, 'page-field-unknown', `${label}.contract.tree.titleField`, `字段「${titleField}」不在 sampleEntity.fields（树面板无节点）`)
    }
  }
  // 动作码 / 树枚举：复用 design.json 的软枚举口径
  for (const item of designContractWarnings({ pages: [{ ...contract }] })) {
    warning(ctx, 'contract-soft', `${label}.contract.${item.path.replace(/^pages\[0\]\./, '')}`, item.message)
  }
}

function parsePage(raw: unknown, typeLabel: string, recipes: Record<string, string[]>, ctx: ParseContext): DesignPageMeta {
  const input = requireObject(raw, `${typeLabel}.pages[]`)
  const id = requirePageId(input.id, `${typeLabel} 页面 id`)
  const label = `${typeLabel}/${id}`
  const recipe = requireString(input.recipe, `${label}.recipe`, 40)
  if (!recipes[recipe]) fail(`${label}.recipe 不在 pageRecipes 内：${recipe}`)

  const custom = ctx.source === 'custom' && ctx.isCustomOrigin
  const rawKind = input.kind === undefined ? '' : requireString(input.kind, `${label}.kind`, 20)
  let kind: DesignPageKind
  if (!rawKind) {
    if (custom) fail(`${label}.kind 必填（自定义模板页面必须是 reference 或 contract）`)
    kind = 'blueprint'
  } else if ((PAGE_KINDS as string[]).includes(rawKind)) {
    kind = rawKind as DesignPageKind
  } else {
    fail(`${label}.kind 未知：${rawKind}`)
  }
  if (!custom && kind !== 'blueprint') fail(`${label}.kind 只能是 blueprint（非自定义模板包）`)
  if (custom && kind === 'blueprint') fail(`${label}.kind 不能是 blueprint（自定义模板包只允许 reference/contract）`)

  const page: DesignPageMeta = {
    id,
    name: requireString(input.name, `${label}.name`, 100),
    type: requireString(input.type, `${label}.type`, 40),
    recipe,
    preview: requireString(input.preview, `${label}.preview`, 40),
    description: requireString(input.description, `${label}.description`, 500),
    kind,
    components: requireStringArray(input.components, `${label}.components`, true)
  }
  const blocks = optionalBlocks(input.blocks, `${label}.blocks`)
  if (blocks !== undefined) page.blocks = blocks

  if (input.contract !== undefined && kind !== 'contract') {
    fail(`${label}.contract 只允许 contract 页`)
  }
  if (input.sampleEntity !== undefined && kind !== 'contract') {
    fail(`${label}.sampleEntity 只允许 contract 页`)
  }
  if (input.sampleSubEntities !== undefined && kind !== 'contract') {
    fail(`${label}.sampleSubEntities 只允许 contract 页`)
  }

  if (input.source !== undefined) {
    if (kind !== 'reference') fail(`${label}.source 只允许 reference 页`)
    const sourceInput = requireObject(input.source, `${label}.source`)
    const sourcePack = requirePackId(sourceInput.pack, `${label}.source.pack`)
    const sourceType = requirePackId(sourceInput.applicationType, `${label}.source.applicationType`)
    const sourcePageId = requirePageId(sourceInput.pageId, `${label}.source.pageId`)
    const sourceBlueprint = sourceInput.blueprint === undefined
      ? undefined
      : assertPackRelativePath(sourceInput.blueprint, `${label}.source.blueprint`)
    const sha = optionalString(sourceInput.sha256, `${label}.source.sha256`, 128)
    // source 只允许内置 pack 的真实页面
    const sourcePackDir = path.join(builtinDesignSystemRoot(), sourcePack)
    if (!fs.existsSync(path.join(sourcePackDir, 'pack.json'))) {
      fail(`${label}.source.pack 不是内置模板包：${sourcePack}`)
    }
    const originPack = readPackFile(sourcePackDir, 'builtin')
    const originType = originPack.applicationTypes.find(type => type.id === sourceType)
    if (!originType) fail(`${label}.source.applicationType 不存在：${sourceType}`)
    const originPage = originType.pages.find(item => item.id === sourcePageId)
    if (!originPage) fail(`${label}.source.pageId 不存在：${sourceType}/${sourcePageId}`)
    if (sourceBlueprint && originPage.blueprint !== sourceBlueprint) {
      warning(
        ctx,
        'source-blueprint-mismatch',
        `${label}.source.blueprint`,
        `source.blueprint 与内置页蓝图不一致（内置 ${originPage.blueprint}）`
      )
    }
    page.source = {
      pack: sourcePack,
      applicationType: sourceType,
      pageId: sourcePageId,
      ...(sourceBlueprint ? { blueprint: sourceBlueprint } : {}),
      ...(sha ? { sha256: sha } : {})
    }
  }

  if (kind === 'contract') {
    if (input.blueprint !== undefined) fail(`${label}.blueprint 不允许出现在 contract 页（避免两条事实源）`)
    page.contract = requireObject(input.contract, `${label}.contract`)
    if (input.sampleEntity === undefined) fail(`${label}.sampleEntity 必填（contract 页需要模板预览样例实体）`)
    page.sampleEntity = parseSampleEntity(input.sampleEntity, `${label}.sampleEntity`)
    const subs = parseSampleSubEntities(input.sampleSubEntities, `${label}.sampleSubEntities`, page.sampleEntity.id)
    if (subs.length) page.sampleSubEntities = subs
    contractWarnings(ctx, label, page)
    return page
  }

  if (input.blueprint === undefined) fail(`${label}.blueprint 必填`)
  page.blueprint = assertPackRelativePath(input.blueprint, `${label}.blueprint`)
  resolvePackAsset(ctx.rootDir, page.blueprint, `${label}.blueprint`)
  if (kind === 'reference' && !page.source) fail(`${label}.source 必填（reference 页必须溯源内置页面）`)
  if (kind === 'blueprint' && page.source) fail(`${label}.source 不允许出现在 blueprint 页`)
  return page
}

function parsePack(raw: unknown, ctx: ParseContext): DesignPack {
  const input = requireObject(raw, 'pack.json')
  if (Number(input.schemaVersion) !== 1) fail('pack.json 的 schemaVersion 必须为 1')
  const id = requirePackId(input.id, '模板包 id')
  if (id !== ctx.dirId) fail(`模板包 id 与目录名不一致：${id} != ${ctx.dirId}`)
  const origin = parseOrigin(input.origin)
  ctx.isCustomOrigin = origin?.kind === 'custom'
  if (ctx.source === 'builtin' && origin) fail('内置模板包不应带 origin')
  if (origin && ctx.source === 'custom' && origin.draftId !== id) {
    fail(`origin.draftId 必须等于模板包 id：${origin.draftId} != ${id}`)
  }

  const recipesRaw = requireObject(input.pageRecipes, 'pageRecipes')
  const pageRecipes: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(recipesRaw)) {
    if (!/^[a-z][a-z0-9-]*$/.test(key)) fail(`pageRecipes 键不合法：${key}`)
    pageRecipes[key] = requireStringArray(value, `pageRecipes.${key}`)
  }
  if (!Object.keys(pageRecipes).length) fail('pageRecipes 不能为空')

  const stylesRaw = input.styles
  if (!Array.isArray(stylesRaw) || !stylesRaw.length) fail('styles 必须是非空数组')
  const styles = stylesRaw.map(parseStyle)
  const styleIds = new Set<string>()
  for (const style of styles) {
    if (styleIds.has(style.id)) fail(`风格 id 重复：${style.id}`)
    styleIds.add(style.id)
    resolvePackAsset(ctx.rootDir, style.css, `风格 ${style.id}.css`)
  }

  const typesRaw = input.applicationTypes
  if (!Array.isArray(typesRaw) || !typesRaw.length) fail('applicationTypes 必须是非空数组')
  const applicationTypes: DesignApplicationType[] = []
  const typeIds = new Set<string>()
  for (const rawType of typesRaw) {
    const typeInput = requireObject(rawType, 'applicationTypes[]')
    const typeId = requirePackId(typeInput.id, '应用类型 id')
    if (typeIds.has(typeId)) fail(`应用类型 id 重复：${typeId}`)
    typeIds.add(typeId)
    const label = `应用类型 ${typeId}`
    resolvePackAsset(ctx.rootDir, typeInput.structure, `${label}.structure`)
    const assets = typeInput.assets === undefined ? undefined : requireStringArray(typeInput.assets, `${label}.assets`)
    if (assets) for (const asset of assets) resolvePackAsset(ctx.rootDir, asset, `${label}.assets`)
    const defaultStyle = requirePackId(typeInput.defaultStyle, `${label}.defaultStyle`)
    if (!styleIds.has(defaultStyle)) fail(`${label}.defaultStyle 不存在：${defaultStyle}`)

    const pagesRaw = typeInput.pages
    if (!Array.isArray(pagesRaw) || !pagesRaw.length) fail(`${label}.pages 必须是非空数组`)
    const pages = pagesRaw.map(pageRaw => parsePage(pageRaw, label, pageRecipes, ctx))
    const pageIds = new Set<string>()
    for (const page of pages) {
      if (pageIds.has(page.id)) fail(`${label} 页面 id 重复：${page.id}`)
      pageIds.add(page.id)
    }
    applicationTypes.push({
      id: typeId,
      name: requireString(typeInput.name, `${label}.name`, 100),
      category: requireString(typeInput.category, `${label}.category`, 40),
      description: requireString(typeInput.description, `${label}.description`, 500),
      structure: assertPackRelativePath(typeInput.structure, `${label}.structure`),
      ...(assets ? { assets } : {}),
      defaultStyle,
      pages
    })
  }

  const defaultApplicationType = requirePackId(input.defaultApplicationType, 'defaultApplicationType')
  if (!typeIds.has(defaultApplicationType)) fail(`defaultApplicationType 不存在：${defaultApplicationType}`)
  const defaultStyle = requirePackId(input.defaultStyle, 'defaultStyle')
  if (!styleIds.has(defaultStyle)) fail(`defaultStyle 不存在：${defaultStyle}`)

  if (ctx.isCustomOrigin) {
    if (applicationTypes.length !== 1) fail('自定义模板包只能包含 1 个 applicationType')
    if (applicationTypes[0].id !== id) fail(`自定义模板包的 applicationType id 必须等于 pack id：${applicationTypes[0].id} != ${id}`)
    if (defaultApplicationType !== id) fail(`自定义模板包的 defaultApplicationType 必须等于 pack id：${defaultApplicationType}`)
    const typeDefaultStyle = applicationTypes[0].defaultStyle
    if (typeDefaultStyle !== defaultStyle) fail(`自定义模板包的风格必须与 defaultStyle 一致：${typeDefaultStyle} != ${defaultStyle}`)
  }

  const componentMapRaw = requireObject(input.componentMap, 'componentMap')
  const componentMap: Record<string, string> = {}
  for (const [key, value] of Object.entries(componentMapRaw)) {
    componentMap[key] = requireString(value, `componentMap.${key}`, 100)
  }

  return {
    schemaVersion: 1,
    id,
    name: requireString(input.name, '模板包 name', 100),
    version: requireString(input.version, '模板包 version', 40),
    defaultApplicationType,
    defaultStyle,
    ...(origin ? { origin } : {}),
    applicationTypes,
    styles,
    skills: requireStringArray(input.skills, 'skills'),
    componentMap,
    pageRecipes,
    conformance: requireStringArray(input.conformance, 'conformance')
  }
}

function sourceOfDir(dir: string): DesignPackSource {
  const resolved = path.resolve(dir)
  const builtinRoot = builtinDesignSystemRoot()
  const customRoot = path.resolve(customDesignSystemRoot())
  if (resolved === builtinRoot || resolved.startsWith(`${builtinRoot}${path.sep}`)) return 'builtin'
  if (resolved === customRoot || resolved.startsWith(`${customRoot}${path.sep}`)) return 'custom'
  // 暂存/草稿目录：按自定义处理（发布前校验）
  return 'custom'
}

function parseJsonText(text: string): unknown {
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
}

function readPackFile(packDir: string, source: DesignPackSource): DesignPack {
  const packFile = path.join(packDir, 'pack.json')
  if (!fs.existsSync(packFile)) throw new DesignError(404, `设计模板包不存在：${path.basename(packDir)}`)
  const mtimeMs = fs.statSync(packFile).mtimeMs
  const cached = packCache.get(packFile)
  if (cached && cached.mtimeMs === mtimeMs) return cached.pack
  let raw: unknown
  try {
    raw = parseJsonText(fs.readFileSync(packFile, 'utf8'))
  } catch (error) {
    fail(`pack.json 解析失败：${error instanceof Error ? error.message : String(error)}`)
  }
  const pack = parsePack(raw, {
    rootDir: packDir,
    dirId: path.basename(packDir),
    source,
    warnings: []
  })
  packCache.set(packFile, { mtimeMs, pack })
  return pack
}

function packDirUnder(root: string, packId: string): string {
  if (!ID_PATTERN.test(packId)) fail(`设计模板包 id 不合法：${packId}`)
  return path.join(root, packId)
}

function findPackDir(packId: string): { dir: string; source: DesignPackSource } {
  const builtin = packDirUnder(builtinDesignSystemRoot(), packId)
  if (fs.existsSync(path.join(builtin, 'pack.json'))) return { dir: builtin, source: 'builtin' }
  const custom = packDirUnder(customDesignSystemRoot(), packId)
  if (fs.existsSync(path.join(custom, 'pack.json'))) return { dir: custom, source: 'custom' }
  throw new DesignError(404, `设计模板包不存在：${packId}`)
}

function listPackDirs(root: string): string[] {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'pack.json')))
    .map(entry => entry.name)
    .sort()
}

export function summarizePack(pack: DesignPack, source: DesignPackSource): DesignPackSummary {
  return {
    id: pack.id,
    name: pack.name,
    version: pack.version,
    defaultApplicationType: pack.defaultApplicationType,
    defaultStyle: pack.defaultStyle,
    source,
    templateKind: source,
    ...(pack.origin ? { origin: pack.origin } : {}),
    pageCount: pack.applicationTypes.reduce((total, type) => total + type.pages.length, 0),
    applicationTypes: pack.applicationTypes.map(type => ({
      id: type.id,
      name: type.name,
      category: type.category,
      description: type.description,
      structure: type.structure,
      defaultStyle: type.defaultStyle,
      pageCount: type.pages.length
    })),
    styles: pack.styles.map(style => ({
      id: style.id,
      name: style.name,
      className: style.className,
      description: style.description,
      signature: style.signature,
      css: style.css,
      tokens: style.tokens
    })),
    skills: pack.skills
  }
}

/** 列出内置 + 自定义 pack 摘要；自定义 pack 损坏时跳过并告警，不阻塞内置列表 */
export function listPacks(): DesignPackSummary[] {
  const summaries: DesignPackSummary[] = []
  for (const id of listPackDirs(builtinDesignSystemRoot())) {
    summaries.push(summarizePack(readPackFile(path.join(builtinDesignSystemRoot(), id), 'builtin'), 'builtin'))
  }
  for (const id of listPackDirs(customDesignSystemRoot())) {
    try {
      summaries.push(summarizePack(readPackFile(path.join(customDesignSystemRoot(), id), 'custom'), 'custom'))
    } catch (error) {
      console.warn(`[design-pack] 跳过无效自定义模板包 ${id}：${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return summaries
}

export function getPack(packId: string): DesignPack {
  const { dir, source } = findPackDir(packId)
  const pack = readPackFile(dir, source)
  if (pack.id !== packId) fail(`模板包 id 与请求不一致：${pack.id} != ${packId}`)
  return pack
}

export function getPackSource(packId: string): DesignPackSource {
  return findPackDir(packId).source
}

/** pack 目录（内置或自定义）；用于把 blueprint/structure/css 复制到应用工作区 */
export function packDirOf(packId: string): string {
  return findPackDir(packId).dir
}

/**
 * 权威 pack 校验（生成 / 发布 / 运行时唯一权威）。
 *
 * - 直接读文件，不走 mtime 缓存；
 * - 草稿暂存目录名为 `pack` 时传 `expectedId`（不套用 `id === basename`）；
 * - 只返回结果，不抛错。
 */
export function validatePackDir(dir: string, expectedId?: string): PackValidation {
  const warnings: PackValidationIssue[] = []
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return {
      ok: false,
      errors: [{ code: 'pack-invalid', path: dir, message: `设计模板包目录不存在：${dir}` }],
      warnings
    }
  }
  const packFile = path.join(dir, 'pack.json')
  if (!fs.existsSync(packFile)) {
    return {
      ok: false,
      errors: [{ code: 'pack-invalid', path: dir, message: `缺少 pack.json：${dir}` }],
      warnings
    }
  }
  let raw: unknown
  try {
    raw = parseJsonText(fs.readFileSync(packFile, 'utf8'))
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          code: 'pack-invalid',
          path: 'pack.json',
          message: `pack.json 解析失败：${error instanceof Error ? error.message : String(error)}`
        }
      ],
      warnings
    }
  }
  try {
    const pack = parsePack(raw, {
      rootDir: dir,
      dirId: expectedId || path.basename(dir),
      source: sourceOfDir(dir),
      warnings
    })
    if (expectedId && pack.id !== expectedId) {
      return {
        ok: false,
        errors: [{ code: 'pack-invalid', path: 'id', message: `模板包 id 必须是 ${expectedId}：${pack.id}` }],
        warnings
      }
    }
    return { ok: true, pack, errors: [], warnings }
  } catch (error) {
    if (error instanceof DesignError) {
      return {
        ok: false,
        errors: [{ code: 'pack-invalid', path: 'pack.json', message: error.message }],
        warnings
      }
    }
    return {
      ok: false,
      errors: [
        {
          code: 'pack-invalid',
          path: 'pack.json',
          message: error instanceof Error ? error.message : String(error)
        }
      ],
      warnings
    }
  }
}

/** 列出内置 pack id（`templates/design-system/<id>/pack.json`） */
export function listBuiltinPackIds(): string[] {
  return listPackDirs(builtinDesignSystemRoot())
}

/** 是否为内置 pack id（路径安全：只接受合法 id；用于发布/删除/新建草稿的保留 id 边界） */
export function isBuiltinPackId(packId: unknown): boolean {
  const id = typeof packId === 'string' ? packId.trim() : ''
  if (!ID_PATTERN.test(id)) return false
  return fs.existsSync(path.join(builtinDesignSystemRoot(), id, 'pack.json'))
}

/** 默认 pack：内置根下排序后的第一个（当前即 afcenter-app-templates-v1） */
export function defaultPackId(): string {
  const [first] = listPackDirs(builtinDesignSystemRoot())
  if (!first) throw new DesignError(500, '缺少内置设计模板包（templates/design-system）')
  return first
}

export function defaultPack(): DesignPack {
  return getPack(defaultPackId())
}

export function getApplicationType(pack: DesignPack, id: string): DesignApplicationType {
  const found = pack.applicationTypes.find(type => type.id === id)
  if (!found) throw new DesignError(404, `应用类型不存在：${id}（模板包 ${pack.id}）`)
  return found
}

export function getStyle(pack: DesignPack, id: string): DesignStyle {
  const found = pack.styles.find(style => style.id === id)
  if (!found) throw new DesignError(404, `视觉风格不存在：${id}（模板包 ${pack.id}）`)
  return found
}

export function getPage(pack: DesignPack, applicationTypeId: string, pageId: string): DesignPageMeta {
  const type = getApplicationType(pack, applicationTypeId)
  const found = type.pages.find(page => page.id === pageId)
  if (!found) throw new DesignError(404, `模板页面不存在：${applicationTypeId}/${pageId}`)
  return found
}

/** 页面种类（缺省按 blueprint 兼容旧数据） */
export function pageKindOf(page: Pick<DesignPageMeta, 'kind'> | null | undefined): DesignPageKind {
  return page && page.kind ? page.kind : 'blueprint'
}

/** 读取内置 pack（供生成器/catalog/发布校验使用） */
export function getBuiltinPack(packId?: string): DesignPack {
  const id = packId || defaultPackId()
  return readPackFile(path.join(builtinDesignSystemRoot(), id), 'builtin')
}
