/**
 * 开发对照表 `docs/design/<MOD>/ui-check.md`（P7-5b，软门禁）
 *
 * - 只在开发 prompt 且模块明确时由后端生成骨架；
 * - 设计缺失 / 模块非法时跳过，不抛 500；
 * - 已存在不改写（agent 填写内容不被覆盖）；
 * - 软门禁：未填不阻断，只用于开发视图/汇报标记“流程未完成”。
 *
 * 骨架行来自 `design.json` 页面契约 + `docs/design/design-system.json` 的页面库
 * （blueprint / recipe 等）；不复制大段需求/设计原文。
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { appDirOf } from '../apps/scaffold'

export type UiCheckStatus = 'missing' | 'skeleton' | 'filled'

export interface UiCheckInfo {
  exists: boolean
  file: string
  status: UiCheckStatus
}

export interface UiCheckEnsureResult extends UiCheckInfo {
  created: boolean
  skipped: boolean
  reason?: 'design-missing' | 'invalid-module' | 'workspace-missing' | 'write-failed'
}

/** 模块 id 只允许安全字符，避免从请求体拼出越界路径 */
export const MODULE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,64}$/

const MARKER_PATTERN = /^<!-- adw:ui-check:skeleton hash:[a-f0-9]{64} -->\n/m

export function isSafeModuleId(module: string): boolean {
  return MODULE_ID_PATTERN.test(module)
}

export function uiCheckRelativePath(module: string): string {
  return `docs/design/${module}/ui-check.md`
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

function list(value: unknown, limit = 12): string {
  const items = asArray(value)
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
  if (!items.length) return ''
  const shown = items.slice(0, limit)
  return `${shown.join('、')}${items.length > shown.length ? ` 等 ${items.length} 项` : ''}`
}

function cell(value: string): string {
  const clean = value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim()
  return clean || '待填'
}

interface DesignPageEntry {
  id: string
  name: string
  kind: 'blueprint' | 'reference' | 'contract'
  source: string
  blueprint: string
  contract: string
  columns: string
  actions: string
  layout: string
}

interface DesignSystemPageEntry {
  id: string
  name: string
  blueprint: string
  recipe: string
  kind?: 'blueprint' | 'reference' | 'contract'
  contractFile?: string
  source?: { pack?: string; applicationType?: string; pageId?: string }
}

interface DesignSystemFile {
  blueprintRoot?: string
  templateDir?: string
  pages: DesignSystemPageEntry[]
}

function readDesignSystemFile(appDir: string): DesignSystemFile | null {
  const file = path.join(appDir, 'docs', 'design', 'design-system.json')
  try {
    const parsed = asRecord(JSON.parse(fs.readFileSync(file, 'utf8')))
    if (!parsed) return null
    return {
      blueprintRoot: text(parsed.blueprintRoot) || undefined,
      templateDir: text(parsed.templateDir) || undefined,
      pages: asArray(parsed.pages)
        .map(item => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map(item => {
          const kindText = text(item.kind)
          const source = asRecord(item.source)
          return {
            id: text(item.id),
            name: text(item.name),
            blueprint: text(item.blueprint),
            recipe: text(item.recipe),
            ...(kindText === 'reference' || kindText === 'contract' || kindText === 'blueprint'
              ? { kind: kindText as 'blueprint' | 'reference' | 'contract' }
              : {}),
            ...(text(item.contractFile) ? { contractFile: text(item.contractFile) } : {}),
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
  } catch {
    return null
  }
}

function layoutSummary(page: Record<string, unknown>): string {
  const parts: string[] = []
  const recipe = text(page.recipe)
  if (recipe) parts.push(`recipe=${recipe}`)
  const form = asRecord(page.form)
  if (form) {
    const presentation = text(form.presentation) || 'dialog'
    const columns = form.columns === 1 || form.columns === 2 ? form.columns : null
    const width = typeof form.width === 'number' && Number.isFinite(form.width) ? form.width : null
    parts.push(
      `表单=${presentation}${columns ? ` ${columns} 列` : ''}${width ? ` ${width}px` : ''}${
        list(form.fields, 8) ? ` 字段=${list(form.fields, 8)}` : ''
      }`
    )
    const groups = asArray(form.groups)
      .map(group => asRecord(group))
      .filter((group): group is Record<string, unknown> => Boolean(group))
      .map(group => text(group.title))
      .filter(Boolean)
    if (groups.length) parts.push(`分组=${groups.join('、')}`)
  }
  const tree = asRecord(page.tree)
  if (tree) {
    const detail = [text(tree.titleField) && `标题=${text(tree.titleField)}`, text(tree.parentField) && `父级=${text(tree.parentField)}`]
      .filter(Boolean)
      .join(' ')
    if (detail) parts.push(`树=${detail}`)
  }
  const pagination = asRecord(page.pagination)
  if (pagination) {
    const pageSize = typeof pagination.pageSize === 'number' ? ` 每页 ${pagination.pageSize}` : ''
    parts.push(`分页=${text(pagination.layout) || '待填'}${pageSize}`)
  }
  if (page.selection === true) parts.push('多选=是')
  return parts.join('；')
}

function designPages(design: Record<string, unknown>, system: DesignSystemFile | null): DesignPageEntry[] {
  const systemById = new Map((system?.pages ?? []).map(page => [page.id, page]))
  return asArray(design.pages)
    .map(item => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map(page => {
      const id = text(page.id) || 'page'
      const catalogRef = text(page.catalogRef)
      const catalogId = catalogRef.includes('/') ? catalogRef.slice(catalogRef.lastIndexOf('/') + 1) : ''
      const fromSystem = systemById.get(catalogId) ?? systemById.get(id)
      const kind = fromSystem?.kind ?? 'blueprint'
      const contract = kind === 'contract' ? fromSystem?.contractFile ?? '' : ''
      const blueprint = kind === 'contract' ? '无（契约页）' : fromSystem?.blueprint || text(page.blueprint) || ''
      const source =
        kind === 'reference' && fromSystem?.source
          ? [fromSystem.source.pack, fromSystem.source.applicationType, fromSystem.source.pageId].filter(Boolean).join('/')
          : ''
      const rowActions = list(page.rowActions, 8)
      const toolbarActions = list(page.toolbarActions, 8)
      const actions = [rowActions && `行：${rowActions}`, toolbarActions && `工具栏：${toolbarActions}`].filter(Boolean).join('；')
      return {
        id,
        name: text(page.name) || id,
        kind,
        source,
        blueprint,
        contract,
        columns: list(page.columns, 12) || list(asRecord(page.form)?.fields, 12) || '待填',
        actions: actions || list(page.actions, 8) || '待填',
        layout: layoutSummary(page) || '待填'
      }
    })
}

/** 生成 ui-check 骨架文本（不写文件；导出便于单测） */
export function buildUiCheckSkeleton(module: string, design: Record<string, unknown>, system: DesignSystemFile | null): string {
  const title = text(design.title) || module
  const pages = designPages(design, system)
  const before = pages.length
    ? pages.map(page => {
        const kindCell = page.source ? `${page.kind} ← ${page.source}` : page.kind
        return `| \`${page.id}\` ${cell(page.name)} | ${cell(kindCell)} | ${cell(page.blueprint)} | ${cell(
          page.contract
        )} | ${cell(page.columns)} | ${cell(page.actions)} | ${cell(page.layout)} | 待填 |`
      })
    : ['| 待填 | 待填 | 待填 | 待填 | 待填 | 待填 | 待填 | 待填 |']
  const after = pages.length
    ? pages.map(page => `| \`${page.id}\` ${cell(page.name)} | 待填 | 待填 | 待填 | 待填 | 待填 |`)
    : ['| 待填 | 待填 | 待填 | 待填 | 待填 | 待填 |']
  const blueprintRoot = system?.blueprintRoot || 'docs/design/template'
  const body = [
    '',
    '> 工作台生成（软门禁）：实现前先填写对照表，再写代码；未填写不阻断，但完成汇报需标记“流程未完成”。',
    `> 设计事实：\`docs/design/${module}/design.json\` 与 \`${blueprintRoot}/\` 蓝图；契约页（无蓝图）读 \`contracts/<page>.json\` 按契约实现。`,
    '> PNG 是模板风格截图（无显式契约的旧设计为线框）。',
    '',
    '## 实现前',
    '',
    '| 设计页 | 类型/来源 | 蓝图 | 契约 | 字段/列 | 操作 | 布局/交互 | 差异/决策 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...before,
    '',
    '## 实现后',
    '',
    '| 设计页 | 实现文件 | 截图 | 一致项 | 差异 | 原因/处理 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...after,
    '',
    '## 未实现/待确认',
    '',
    `- ${title} 的页面/交互如有未实现项，在这里逐条列出并说明原因。`,
    ''
  ].join('\n')
  const head = `# 页面对照表（${module}）`
  const base = `${head}\n\n${body}`
  const hash = createHash('sha256').update(base).digest('hex')
  return `${head}\n\n<!-- adw:ui-check:skeleton hash:${hash} -->\n${body}`
}

/** 读取 ui-check 状态（只读；不创建） */
export function readUiCheck(appDir: string, module: string): UiCheckInfo {
  const file = uiCheckRelativePath(module)
  const full = path.join(appDir, file)
  if (!isSafeModuleId(module) || !fs.existsSync(full)) return { exists: false, file, status: 'missing' }
  try {
    const content = fs.readFileSync(full, 'utf8')
    const marker = MARKER_PATTERN.exec(content)
    if (!marker) return { exists: true, file, status: 'filled' }
    const expected = marker[0].match(/hash:([a-f0-9]{64})/)?.[1] ?? ''
    const withoutMarker = content.replace(MARKER_PATTERN, '')
    const actual = createHash('sha256').update(withoutMarker).digest('hex')
    return { exists: true, file, status: actual === expected ? 'skeleton' : 'filled' }
  } catch {
    return { exists: true, file, status: 'skeleton' }
  }
}

/**
 * 确保 ui-check 骨架存在：缺失时创建，已存在不改写。
 * 设计文件缺失/模块非法/应用目录缺失时返回 skipped（不抛错）。
 */
export function ensureUiCheck(appId: string, module: string, appDir: string = appDirOf(appId)): UiCheckEnsureResult {
  const existing = readUiCheck(appDir, module)
  if (!fs.existsSync(appDir)) {
    return { ...existing, created: false, skipped: true, reason: 'workspace-missing' }
  }
  if (!isSafeModuleId(module)) {
    return { exists: false, file: uiCheckRelativePath(module), status: 'missing', created: false, skipped: true, reason: 'invalid-module' }
  }
  if (existing.exists) return { ...existing, created: false, skipped: false }

  const designFile = path.join(appDir, 'docs', 'design', module, 'design.json')
  let design: Record<string, unknown> | null = null
  try {
    design = asRecord(JSON.parse(fs.readFileSync(designFile, 'utf8')))
  } catch {
    design = null
  }
  if (!design) {
    return { ...existing, created: false, skipped: true, reason: 'design-missing' }
  }

  const content = buildUiCheckSkeleton(module, design, readDesignSystemFile(appDir))
  try {
    fs.mkdirSync(path.dirname(path.join(appDir, existing.file)), { recursive: true })
    fs.writeFileSync(path.join(appDir, existing.file), content, 'utf8')
  } catch {
    return { ...existing, created: false, skipped: true, reason: 'write-failed' }
  }
  return { exists: true, file: existing.file, status: 'skeleton', created: true, skipped: false }
}
