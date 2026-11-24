/**
 * 开发 prompt 的设计摘要（应用级，D1 去模块）
 *
 * 目标：让开发 agent 在不读整篇 JSON/大段原文的情况下，知道
 * 需求 Epic 摘要、全局实体、页面集/页面契约、设计系统、参考包与 ui-check 状态。
 *
 * - 只读工作区文件；缺失时给明确提示，不抛 500；
 * - 总长度约 6KB，超长截断并注明；
 * - 不替代 `entities.json` / `pages.json` / 蓝图本身（prompt 仍要求 agent 读源文件）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { appDirOf } from '../apps/scaffold'
import { resolveAppDesignSystem, type AppDesignSystem } from '../apps/design-system'
import { readDesignBrief, readDesignTokens, readPrototypeArtifact } from '../design/prototypes'
import { readRequirement } from '../workspace/artifacts'
import { readApiDesign } from './api-design'
import { ensureUiCheck, readUiCheck, type UiCheckInfo } from './ui-check'

export const DESIGN_DIGEST_LIMIT = 6000
const MAX_PAGE_SETS = 12
const MAX_PAGES_PER_SET = 8
const MAX_FIELDS = 10
const MAX_COLUMNS = 14
const MAX_ACTIONS = 10
const MAX_ENTITIES = 12

interface DesignSystemFilePage {
  id: string
  name: string
  recipe: string
  kind?: 'blueprint' | 'reference' | 'contract'
  blueprint?: string
  contractFile?: string
  source?: { pack?: string; applicationType?: string; pageId?: string }
}

interface DesignSystemFile {
  pack?: string
  packName?: string
  packVersion?: string
  origin?: { kind?: string; baseApplicationType?: string }
  applicationType?: string
  applicationTypeName?: string
  style?: string
  styleName?: string
  styleId?: string
  styles?: { shared?: string; style?: string }
  blueprintRoot?: string
  templateDir?: string
  pages: DesignSystemFilePage[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readJsonRecord(file: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch {
    return null
  }
}

function readDesignSystemFile(appDir: string): DesignSystemFile | null {
  const parsed = readJsonRecord(path.join(appDir, 'docs', 'design', 'design-system.json'))
  if (!parsed) return null
  const styles = asRecord(parsed.styles)
  const origin = asRecord(parsed.origin)
  return {
    pack: text(parsed.pack) || undefined,
    packName: text(parsed.packName) || undefined,
    packVersion: text(parsed.packVersion) || undefined,
    ...(origin
      ? {
          origin: {
            ...(text(origin.kind) ? { kind: text(origin.kind) } : {}),
            ...(text(origin.baseApplicationType) ? { baseApplicationType: text(origin.baseApplicationType) } : {})
          }
        }
      : {}),
    applicationType: text(parsed.applicationType) || undefined,
    applicationTypeName: text(parsed.applicationTypeName) || undefined,
    style: text(parsed.style) || undefined,
    styleName: text(parsed.styleName) || undefined,
    styleId: text(parsed.styleId) || text(parsed.style) || undefined,
    ...(styles
      ? {
          styles: {
            ...(text(styles.shared) ? { shared: text(styles.shared) } : {}),
            ...(text(styles.style) ? { style: text(styles.style) } : {})
          }
        }
      : {}),
    blueprintRoot: text(parsed.blueprintRoot) || undefined,
    templateDir: text(parsed.templateDir) || undefined,
    pages: asArray(parsed.pages)
      .map(item => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map(item => {
        const source = asRecord(item.source)
        const kindText = text(item.kind)
        return {
          id: text(item.id),
          name: text(item.name),
          recipe: text(item.recipe),
          ...(kindText === 'reference' || kindText === 'contract' || kindText === 'blueprint'
            ? { kind: kindText as 'blueprint' | 'reference' | 'contract' }
            : {}),
          blueprint: text(item.blueprint) || undefined,
          contractFile: text(item.contractFile) || undefined,
          ...(source
            ? {
                source: {
                  ...(text(source.pack) ? { pack: text(source.pack) } : {}),
                  ...(text(source.applicationType) ? { applicationType: text(source.applicationType) } : {}),
                  ...(text(source.pageId) ? { pageId: text(source.pageId) } : {})
                }
              }
            : {})
        }
      })
      .filter(item => item.id)
  }
}

function list(value: unknown, limit: number): string {
  const items = asArray(value)
    .map(item => {
      if (typeof item === 'string') return item.trim()
      const record = asRecord(item)
      return record ? text(record.name) || text(record.id) : ''
    })
    .filter(Boolean)
  if (!items.length) return ''
  const shown = items.slice(0, limit)
  return `${shown.join('/')}${items.length > shown.length ? ` …等 ${items.length} 项` : ''}`
}

function pageLayout(page: Record<string, unknown>): string {
  const parts: string[] = []
  const form = asRecord(page.form)
  if (form) {
    const columns = form.columns === 1 || form.columns === 2 ? `${form.columns} 列` : ''
    const width = typeof form.width === 'number' && Number.isFinite(form.width) ? `${form.width}px` : ''
    parts.push(`form=${text(form.presentation) || 'dialog'}${columns ? ` ${columns}` : ''}${width ? ` ${width}` : ''}`)
    const fields = list(form.fields, 8)
    if (fields) parts.push(`表单字段=${fields}`)
    const groups = asArray(form.groups)
      .map(group => asRecord(group))
      .filter((group): group is Record<string, unknown> => Boolean(group))
      .map(group => text(group.title))
      .filter(Boolean)
    if (groups.length) parts.push(`分组=${groups.join('、')}`)
  }
  const tree = asRecord(page.tree)
  if (tree) {
    const title = text(tree.titleField)
    const parent = text(tree.parentField)
    if (title || parent) parts.push(`tree=${[title && `标题 ${title}`, parent && `父级 ${parent}`].filter(Boolean).join(' ')}`)
  }
  const pagination = asRecord(page.pagination)
  if (pagination) {
    const layout = text(pagination.layout) || 'bar'
    const size = typeof pagination.pageSize === 'number' ? `/${pagination.pageSize}` : ''
    parts.push(`pagination=${layout}${size}`)
  }
  if (page.selection === true) parts.push('selection=多选')
  if (page.catalogRef) parts.push(`catalogRef=${text(page.catalogRef)}`)
  return parts.join('；')
}

function entitySummary(entity: Record<string, unknown>): string {
  const id = text(entity.id) || text(entity.name) || 'entity'
  const name = text(entity.name)
  const fields = asArray(entity.fields)
    .map(field => asRecord(field))
    .filter((field): field is Record<string, unknown> => Boolean(field))
    .map(field => {
      const code = text(field.code)
      const label = text(field.name)
      return code ? (label && label !== code ? `${code}（${label}）` : code) : ''
    })
    .filter(Boolean)
  const shown = fields.slice(0, MAX_FIELDS)
  const suffix = fields.length > shown.length ? ` …等 ${fields.length} 项` : ''
  return `${id}${name && name !== id ? `（${name}）` : ''}：${shown.join('/') || '无字段'}${suffix}`
}

/** contract 文件摘要（列/查询/操作/表单/树/分页/样例实体；只读） */
function contractDigest(appDir: string, contractFile: string): string {
  const record = readJsonRecord(path.join(appDir, contractFile))
  if (!record) return '契约文件缺失'
  const contract = asRecord(record.contract) ?? record
  const parts: string[] = []
  const columns = list(contract.columns, MAX_COLUMNS)
  if (columns) parts.push(`列=${columns}`)
  const filters = list(contract.filters, MAX_COLUMNS)
  if (filters) parts.push(`筛选=${filters}`)
  const rowActions = list(contract.rowActions, MAX_ACTIONS)
  const toolbarActions = list(contract.toolbarActions, MAX_ACTIONS)
  const actions = [rowActions && `行=${rowActions}`, toolbarActions && `工具栏=${toolbarActions}`].filter(Boolean)
  if (actions.length) parts.push(actions.join('；'))
  const form = asRecord(contract.form)
  if (form) {
    const presentation = text(form.presentation) || 'dialog'
    const columnText = form.columns === 1 || form.columns === 2 ? ` ${form.columns} 列` : ''
    const width = typeof form.width === 'number' && Number.isFinite(form.width) ? ` ${form.width}px` : ''
    const fields = list(form.fields, 8)
    parts.push(`表单=${presentation}${columnText}${width}${fields ? ` 字段=${fields}` : ''}`)
  }
  const pagination = asRecord(contract.pagination)
  if (pagination) {
    const size = typeof contract.pagination === 'object' && typeof pagination.pageSize === 'number' ? `/${pagination.pageSize}` : ''
    parts.push(`pagination=${text(pagination.layout) || 'bar'}${size}`)
  }
  if (contract.selection === true) parts.push('selection=多选')
  const subTables = asArray(contract.subTables)
  if (subTables.length) parts.push(`子表=${subTables.length}`)
  const sample = asRecord(record.sampleEntity)
  if (sample) {
    const sampleName = text(sample.id) || text(sample.name) || '样例'
    parts.push(`样例实体=${sampleName}（${asArray(sample.fields).length} 字段）`)
  }
  return parts.join('；') || '契约字段为空'
}

function pageOf(page: Record<string, unknown>, system: DesignSystemFile | null, appDir: string): string {
  const systemById = new Map((system?.pages ?? []).map(entry => [entry.id, entry]))
  const id = text(page.id) || 'page'
  const name = text(page.name)
  const type = text(page.type)
  const recipe = text(page.recipe)
  const catalogRef = text(page.catalogRef)
  const catalogId = catalogRef.includes('/') ? catalogRef.slice(catalogRef.lastIndexOf('/') + 1) : ''
  const fromSystem = systemById.get(catalogId) ?? systemById.get(id)
  const kind = fromSystem?.kind ?? (fromSystem === undefined && text(page.blueprint) ? 'blueprint' : '')
  const contractFile = kind === 'contract' ? fromSystem?.contractFile ?? '' : ''
  const blueprint = kind === 'contract' ? '' : fromSystem?.blueprint || text(page.blueprint) || ''
  const sourceText =
    kind === 'reference' && fromSystem?.source
      ? [fromSystem.source.pack, fromSystem.source.applicationType, fromSystem.source.pageId].filter(Boolean).join('/')
      : ''
  const columns = list(page.columns, MAX_COLUMNS)
  const filters = list(page.filters, MAX_COLUMNS)
  const rowActions = list(page.rowActions, MAX_ACTIONS)
  const toolbarActions = list(page.toolbarActions, MAX_ACTIONS)
  const actionParts = [rowActions && `行=${rowActions}`, toolbarActions && `工具栏=${toolbarActions}`].filter(Boolean)
  const layout = pageLayout(page)
  const head = `  - ${id}${name && name !== id ? ` ${name}` : ''}${type ? ` | type=${type}` : ''}${
    recipe ? ` | recipe=${recipe}` : ''
  }${kind ? ` | kind=${kind}` : ''}${blueprint ? ` | blueprint=${blueprint}` : ''}${
    contractFile ? ` | contract=${contractFile}` : ''
  }${sourceText ? ` | source=${sourceText}` : ''}`
  const details = [
    kind === 'contract' ? '无蓝图，按契约实现' : '',
    contractFile ? `契约：${contractDigest(appDir, contractFile)}` : '',
    columns && `列=${columns}`,
    filters && `筛选=${filters}`,
    actionParts.join('；'),
    layout
  ].filter(Boolean)
  return `${head}${details.length ? `\n    ${details.join(' | ')}` : ''}`
}

function designSystemLine(appId: string, system: DesignSystemFile | null): { line: string; blueprintRoot: string; pageCount: number; styleId?: string } {
  if (system) {
    const pack = [system.pack, system.packVersion ? `v${system.packVersion}` : '', system.packName ? `（${system.packName}）` : '']
      .filter(Boolean)
      .join(' ')
    const custom = system.origin?.kind === 'custom'
    const base = custom && system.origin?.baseApplicationType ? `，自定义模板（base=${system.origin.baseApplicationType}）` : ''
    return {
      line: `- 应用设计系统：${pack || 'pack 未记录'}；应用类型=${system.applicationType || '未记录'}${
        system.applicationTypeName ? `（${system.applicationTypeName}）` : ''
      }；风格=${system.style || '未记录'}${system.styleName ? `（${system.styleName}）` : ''}${base}`,
      blueprintRoot: system.blueprintRoot || 'docs/design/template',
      pageCount: system.pages.length,
      styleId: system.styleId || system.style
    }
  }
  let resolved: AppDesignSystem | null = null
  try {
    resolved = resolveAppDesignSystem(appId)
  } catch {
    resolved = null
  }
  if (!resolved) return { line: '- 应用设计系统：未解析（缺少 design-system.json / 设计系统设置）', blueprintRoot: 'docs/design/template', pageCount: 0 }
  return {
    line: `- 应用设计系统：${resolved.pack?.id ?? '未知'} v${resolved.pack?.version ?? '?'}；应用类型=${resolved.applicationType?.id ?? '未知'}${
      resolved.applicationType?.name ? `（${resolved.applicationType.name}）` : ''
    }；风格=${resolved.style?.id ?? '未知'}${resolved.style?.name ? `（${resolved.style.name}）` : ''}`,
    blueprintRoot: 'docs/design/template',
    pageCount: resolved.pages.length,
    styleId: resolved.style?.id
  }
}

function uiCheckLine(info: UiCheckInfo): string {
  if (!info.exists) return `- ui-check：未生成（${info.file}）；首次开发 prompt 时工作台会生成骨架`
  return `- ui-check：${info.status === 'skeleton' ? '已生成未填' : '已填'}（${info.file}）`
}

function truncateDigest(textValue: string): string {
  if (textValue.length <= DESIGN_DIGEST_LIMIT) return textValue
  const keep = Math.max(0, DESIGN_DIGEST_LIMIT - 120)
  return `${textValue.slice(0, keep)}\n…（设计摘要超过 ${DESIGN_DIGEST_LIMIT} 字符，已截断；完整内容以 entities.json / pages.json / 蓝图为准）`
}

/**
 * 生成开发 prompt 用的设计摘要。
 * 不抛错：应用目录/设计产物缺失都返回可读提示。
 */
export function buildDesignDigest(appId: string, appDir: string = appDirOf(appId)): string {
  const lines: string[] = ['【设计摘要】']
  if (!fs.existsSync(appDir)) {
    return '【设计摘要】\n- 应用工作区不存在，无法读取设计参考；请先在共享工作区创建应用与设计。'
  }
  const system = readDesignSystemFile(appDir)
  const systemInfo = designSystemLine(appId, system)
  lines.push(systemInfo.line)
  lines.push(`- 蓝图根：${systemInfo.blueprintRoot}；模板页面库 ${systemInfo.pageCount} 页`)
  const preferredStyle =
    system?.styles?.style ||
    (systemInfo.styleId ? `${systemInfo.blueprintRoot}/styles/${systemInfo.styleId}/style.css` : '')
  const legacyStyle = `${systemInfo.blueprintRoot}/styles/style.css`
  const styleCandidates = [preferredStyle, legacyStyle].filter(Boolean)
  const styleFile = styleCandidates.find(item => fs.existsSync(path.join(appDir, item))) || preferredStyle
  if (styleFile) {
    const shared = system?.styles?.shared || `${systemInfo.blueprintRoot}/styles/shared.css`
    lines.push(`- 风格样式：${styleFile}（共享 ${shared}）`)
  }
  lines.push('- 团队 skill：afcenter-page-generation、pm-components-usage；开发方法 skill：adw-frontend-implementation')

  // 需求：只给 Epic/Story 摘要，不注入整篇
  const requirement = readRequirement(appDir)
  if (!requirement.exists) {
    lines.push('- 需求文档：未生成（docs/requirements/requirements.md）；按用户目标判断，先补齐需求再实现。')
  } else {
    const epicCount = requirement.epics.length
    const storyCount = requirement.epics.reduce((total, epic) => total + epic.stories.length, 0)
    lines.push(`- 需求文档：docs/requirements/requirements.md（${epicCount} 个 Epic · ${storyCount} 个 Story；按需读原文，不要整篇复制）`)
    for (const epic of requirement.epics.slice(0, MAX_PAGE_SETS)) {
      const stories = epic.stories.map(story => `${story.id} ${story.title}`.trim()).join('、') || '无 Story'
      lines.push(`  - ${epic.id} ${epic.title}：${stories}`)
    }
  }

  const entitiesDoc = readJsonRecord(path.join(appDir, 'docs', 'design', 'entities.json'))
  const entities = asArray(entitiesDoc?.entities)
    .map(item => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
  if (entities.length) {
    lines.push(`- 实体（${entities.length}）：`)
    for (const entity of entities.slice(0, MAX_ENTITIES)) lines.push(`  - ${entitySummary(entity)}`)
    if (entities.length > MAX_ENTITIES) lines.push(`  - …其余 ${entities.length - MAX_ENTITIES} 个实体见 entities.json`)
    const relations = asArray(entitiesDoc?.relations).length
    if (relations) lines.push(`- 关系：${relations} 条（全局 ER，见 entities.json）`)
  } else {
    lines.push('- 实体：entities.json 未定义')
  }

  const pagesDoc = readJsonRecord(path.join(appDir, 'docs', 'design', 'pages.json'))
  const pageSets = asArray(pagesDoc?.pageSets)
    .map(item => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
  if (pageSets.length) {
    const total = pageSets.reduce((count, set) => count + asArray(set.pages).length, 0)
    lines.push(`- 页面集（${pageSets.length}）· 页面（${total}）：`)
    pageSets.slice(0, MAX_PAGE_SETS).forEach(set => {
      const setId = text(set.id) || 'page-set'
      const epic = text(set.epic)
      const title = text(set.title) || setId
      const pages = asArray(set.pages)
      lines.push(`  - ${epic ? `${epic} ` : ''}${title}（页面集 ${setId}，${pages.length} 页）`)
      pages.slice(0, MAX_PAGES_PER_SET).forEach(raw => {
        const page = asRecord(raw)
        if (page) lines.push(pageOf(page, system, appDir))
      })
      if (pages.length > MAX_PAGES_PER_SET) lines.push(`    …其余 ${pages.length - MAX_PAGES_PER_SET} 页见 pages.json`)
    })
    if (pageSets.length > MAX_PAGE_SETS) lines.push(`- …其余 ${pageSets.length - MAX_PAGE_SETS} 个页面集未展开（见 pages.json）`)
  } else {
    lines.push('- 页面：pages.json 未定义页面集，无法施工；请先补页面契约。')
  }

  const brief = readDesignBrief(appDir)
  const tokens = readDesignTokens(appDir)
  const prototypes = readPrototypeArtifact(appDir)
  const apiDesign = readApiDesign(appDir)
  if (apiDesign.exists) {
    const errorCount = apiDesign.errors.length
    const warningCount = apiDesign.warnings.length
    lines.push(
      `- 接口设计：docs/design/api-design.md（${apiDesign.interfaces.length} 个接口 · ${apiDesign.byEpic.length} 个 Epic；校验 errors ${errorCount} / warnings ${warningCount}）`
    )
    for (const item of apiDesign.interfaces.slice(0, 8)) {
      lines.push(`  - ${item.id} ${item.method} ${item.path}${item.operation ? `（${item.operation}）` : ''}`)
    }
    if (apiDesign.interfaces.length > 8) lines.push(`  - …其余 ${apiDesign.interfaces.length - 8} 个接口见 api-design.md`)
  } else {
    lines.push('- 接口设计：未生成（docs/design/api-design.md；按 adw-api-design skill 生成）')
  }
  const refs = [
    `design-brief.md=${brief.exists ? '已生成' : '未生成'}`,
    `tokens.json=${tokens.exists ? '已生成' : '未生成'}`,
    prototypes
      ? `PNG=${prototypes.pages.length} 张${prototypes.stale ? '（已过期：designHash 与当前设计产物不一致，先说明再参考）' : '（未过期）'}`
      : 'PNG=未导出'
  ]
  lines.push(`- 参考包：${refs.join('；')}`)
  lines.push(uiCheckLine(readUiCheck(appDir)))
  return truncateDigest(lines.join('\n'))
}

/** 只读：判断 ui-check 文件是否已填（供摘要/汇报复用） */
export function uiCheckFilled(appDir: string): boolean {
  return readUiCheck(appDir).status === 'filled'
}

/**
 * 开发 prompt 入口：设计产物存在时先生成 ui-check 骨架，再返回设计摘要。
 * 任何失败都只降级为提示文本，不影响消息发送。
 */
export function developmentDigestForPrompt(appId: string, appDir: string = appDirOf(appId)): string {
  try {
    ensureUiCheck(appId, appDir)
  } catch (error) {
    console.warn(`[dev-digest] 生成 ui-check 失败（${appId}）：${error instanceof Error ? error.message : String(error)}`)
  }
  try {
    return buildDesignDigest(appId, appDir)
  } catch (error) {
    console.warn(`[dev-digest] 设计摘要失败（${appId}）：${error instanceof Error ? error.message : String(error)}`)
    return '【设计摘要】\n- 读取设计参考失败；请直接阅读 AGENTS.md、docs/design/ 与现有代码。'
  }
}

/** 供测试/调试：设计产物是否存在 */
export function designFilesExist(appDir: string): boolean {
  return Boolean(
    readJsonRecord(path.join(appDir, 'docs', 'design', 'entities.json')) &&
      readJsonRecord(path.join(appDir, 'docs', 'design', 'pages.json'))
  )
}
