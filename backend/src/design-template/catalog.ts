/**
 * 模板工作室 catalog（P7-7a）
 *
 * 从内置 pack + 蓝图扫描生成**派生只读**知识库：
 * `catalog/{index,pages,components,styles,recipes}.json` + `catalog/examples/*`。
 *
 * - 事实源仍是内置 pack + 蓝图；catalog 只是缓存（`index.generatedAt` 可写时间）；
 * - `readPath` / `structureReadPath` 口径已固定为 `catalog/builtin/<packId>/...`
 *   （镜像本身由 P7-7b `ensureStudioAssets` 落地；P7-7a 只定路径口径）；
 * - 组件控件映射读取共享 `templates/design-system/component-controls.json`（20 键 ∩ 39 = 13）；
 * - 确定性排序（应用类型 pack 顺序 → 页面顺序 → 组件名字典序），原子写。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { builtinDesignSystemRoot, getBuiltinPack, type DesignPack } from '../design/pack'
import { readComponentControls, scanComponents } from './spec'
import { catalogRoot, writeJsonAtomic } from './paths'

export interface CatalogPage {
  catalogRef: string
  pack: string
  packVersion: string
  applicationType: string
  applicationTypeName: string
  pageId: string
  name: string
  kind: 'blueprint'
  type: string
  recipe: string
  description: string
  blueprint: string
  readPath: string
  components: string[]
  structure: string
  structureReadPath: string
  assets: string[]
}

export interface CatalogComponent {
  name: string
  category: 'control' | 'container'
  tagReferences: number
  pageReferences: number
  pages: string[]
  contractControl: string | null
  contractSupported: boolean
  componentMapTypes: string[]
  mappingSource: string
  snippets: string[]
  notes: string
}

export interface CatalogStyle {
  id: string
  name: string
  className: string
  description: string
  signature: string
  css: string
  tokens: Record<string, unknown>
}

export interface CatalogRecipe {
  recipe: string
  label: string
  templateComponents: string[]
  contractPreviewSupported: boolean
  examplePage: string
}

export interface CatalogIndex {
  schemaVersion: 1
  generatedAt: string
  source: { pack: string; version: string }
  sourceHash: string
  counts: { applicationTypes: number; pages: number; components: number; styles: number; recipes: number }
  controls: { mappingSource: string; keys: number; mappable: number; components: number }
}

export interface CatalogData {
  index: CatalogIndex
  pages: CatalogPage[]
  components: CatalogComponent[]
  styles: CatalogStyle[]
  recipes: CatalogRecipe[]
}

const RECIPE_LABELS: Record<string, string> = {
  list: '列表台账',
  'tree-list': '树表台账',
  'dialog-form': '弹窗表单',
  'page-form': '页面表单',
  'main-sub': '主子表',
  detail: '详情页',
  dashboard: '驾驶舱',
  wizard: '分步表单'
}

export const MAPPING_SOURCE = 'templates/design-system/component-controls.json'

const CATALOG_FILES = ['index.json', 'pages.json', 'components.json', 'styles.json', 'recipes.json'] as const
const EXAMPLE_FILES = [
  'spec.example.json',
  'page-contract-list.json',
  'page-contract-tree-list.json',
  'page-contract-dialog-form.json',
  'page-contract-main-sub.json'
] as const

/** 示例实体/契约（deterministic；只用于 agent 参考与测试） */
const SAMPLE_ENTITY = {
  id: 'supplier',
  name: '供应商',
  fields: [
    { name: 'code', label: '供应商编码', type: 'string' },
    { name: 'name', label: '供应商名称', type: 'string' },
    { name: 'status', label: '状态', type: 'enum', options: ['启用', '停用', '草稿'] },
    { name: 'org', label: '所属机构', type: 'string' },
    { name: 'owner', label: '负责人', type: 'string' },
    { name: 'amount', label: '年度金额', type: 'decimal' },
    { name: 'enabled', label: '是否启用', type: 'boolean' },
    { name: 'remark', label: '备注', type: 'text' }
  ]
}

const SAMPLE_SUB_ENTITY = {
  id: 'supplier-contact',
  name: '联系人',
  fields: [
    { name: 'contactName', label: '联系人', type: 'string' },
    { name: 'phone', label: '电话', type: 'string' },
    { name: 'email', label: '邮箱', type: 'string' }
  ]
}

function exampleContracts() {
  return {
    'page-contract-list.json': {
      recipe: 'list',
      contract: {
        filters: ['name', 'status', 'org'],
        columns: ['code', 'name', 'status', 'owner', 'amount'],
        rowActions: ['detail', 'edit', 'delete'],
        toolbarActions: ['create', 'import', 'export', 'batchDelete'],
        selection: true,
        pagination: { layout: 'three-part', pageSize: 10 },
        components: { owner: 'pm-select-user', org: 'pm-select-org' }
      },
      sampleEntity: SAMPLE_ENTITY
    },
    'page-contract-tree-list.json': {
      recipe: 'tree-list',
      contract: {
        filters: ['name'],
        columns: ['code', 'name', 'status'],
        tree: { titleField: 'name', parentField: 'org', actionStyle: 'header', selectionStyle: 'platform' },
        selection: false,
        pagination: { layout: 'bar', pageSize: 10 },
        components: { status: 'pm-select' }
      },
      sampleEntity: SAMPLE_ENTITY
    },
    'page-contract-dialog-form.json': {
      recipe: 'dialog-form',
      contract: {
        form: {
          presentation: 'dialog',
          columns: 2,
          width: 900,
          groups: [
            { title: '基本信息', fields: ['code', 'name', 'status', 'org'] },
            { title: '扩展信息', fields: ['owner', 'amount', 'enabled', 'remark'] }
          ]
        },
        components: { owner: 'pm-select-user', org: 'pm-select-org', enabled: 'pm-switch', remark: 'pm-textarea' }
      },
      sampleEntity: SAMPLE_ENTITY
    },
    'page-contract-main-sub.json': {
      recipe: 'main-sub',
      contract: {
        form: {
          presentation: 'page',
          columns: 2,
          groups: [
            { title: '基本信息', fields: ['code', 'name', 'status'] },
            { title: '联系与备注', fields: ['owner', 'remark'] }
          ]
        },
        subTables: [
          { entity: 'supplier-contact', title: '联系人', columns: ['contactName', 'phone', 'email'], mode: 'tab' }
        ],
        components: { owner: 'pm-select-user' }
      },
      sampleEntity: SAMPLE_ENTITY,
      sampleSubEntities: [SAMPLE_SUB_ENTITY]
    }
  }
}

function sourceHashOf(pack: DesignPack): string {
  const packFile = path.join(builtinDesignSystemRoot(), pack.id, 'pack.json')
  const mtimeMs = fs.existsSync(packFile) ? fs.statSync(packFile).mtimeMs : 0
  return `sha256:${crypto.createHash('sha256').update(`${pack.id}|${pack.version}|${mtimeMs}`).digest('hex')}`
}

function buildPages(pack: DesignPack): CatalogPage[] {
  const pages: CatalogPage[] = []
  for (const type of pack.applicationTypes) {
    for (const page of type.pages) {
      const blueprint = page.blueprint
      if (!blueprint) continue
      pages.push({
        catalogRef: `${type.id}/${page.id}`,
        pack: pack.id,
        packVersion: pack.version,
        applicationType: type.id,
        applicationTypeName: type.name,
        pageId: page.id,
        name: page.name,
        kind: 'blueprint',
        type: page.type,
        recipe: page.recipe,
        description: page.description,
        blueprint,
        readPath: `catalog/builtin/${pack.id}/${blueprint}`,
        components: [...page.components],
        structure: type.structure,
        structureReadPath: `catalog/builtin/${pack.id}/${type.structure}`,
        assets: [...(type.assets ?? [])]
      })
    }
  }
  return pages
}

function buildComponents(pack: DesignPack): CatalogComponent[] {
  return scanComponents(pack).map(entry => ({
    name: entry.name,
    category: entry.category,
    tagReferences: entry.tagReferences,
    pageReferences: entry.pageReferences,
    pages: [...entry.pages],
    contractControl: entry.contractControl,
    contractSupported: entry.contractSupported,
    componentMapTypes: [...entry.componentMapTypes],
    mappingSource: MAPPING_SOURCE,
    snippets: [...entry.snippets],
    notes: entry.contractSupported
      ? `契约页可用 components.<字段>='${entry.name}' 指定`
      : '容器/展示组件：由 ContractPage 固定结构渲染，不可在契约中指定'
  }))
}

function buildStyles(pack: DesignPack): CatalogStyle[] {
  return pack.styles.map(style => ({
    id: style.id,
    name: style.name,
    className: style.className,
    description: style.description,
    signature: style.signature,
    css: style.css,
    tokens: { ...style.tokens }
  }))
}

function buildRecipes(pack: DesignPack, pages: CatalogPage[]): CatalogRecipe[] {
  return Object.entries(pack.pageRecipes).map(([recipe, components]) => {
    const example = pages.find(page => page.recipe === recipe)
    return {
      recipe,
      label: RECIPE_LABELS[recipe] ?? recipe,
      templateComponents: [...components],
      contractPreviewSupported: true,
      examplePage: example ? example.catalogRef : ''
    }
  })
}

export function buildCatalog(pack: DesignPack, generatedAt = new Date().toISOString()): CatalogData {
  const pages = buildPages(pack)
  const components = buildComponents(pack)
  const styles = buildStyles(pack)
  const recipes = buildRecipes(pack, pages)
  const controls = readComponentControls()
  const mappable = components.filter(component => component.contractSupported).length
  const index: CatalogIndex = {
    schemaVersion: 1,
    generatedAt,
    source: { pack: pack.id, version: pack.version },
    sourceHash: sourceHashOf(pack),
    counts: {
      applicationTypes: pack.applicationTypes.length,
      pages: pages.length,
      components: components.length,
      styles: styles.length,
      recipes: recipes.length
    },
    controls: {
      mappingSource: MAPPING_SOURCE,
      keys: Object.keys(controls).length,
      mappable,
      components: components.length
    }
  }
  return { index, pages, components, styles, recipes }
}

function exampleSpec(pack: DesignPack): Record<string, unknown> {
  const listPage =
    pack.applicationTypes.flatMap(type => type.pages.map(page => ({ type, page }))).find(
      item => item.page.id === 'list' && item.page.recipe === 'list'
    ) ?? pack.applicationTypes.flatMap(type => type.pages.map(page => ({ type, page }))).find(item => item.page.recipe === 'list')
  const contracts = exampleContracts()
  const dialog = contracts['page-contract-dialog-form.json']
  return {
    schemaVersion: 1,
    id: 'supplier-hub-7f3a',
    name: '供应商管理模板',
    description: '供应商台账 + 弹窗表单（示例 spec，可复制修改）',
    baseApplicationType: pack.defaultApplicationType,
    style: pack.styles.some(style => style.id === 'data-cyan') ? 'data-cyan' : pack.defaultStyle,
    pages: [
      ...(listPage
        ? [
            {
              id: 'supplier-list',
              name: '供应商列表',
              kind: 'reference',
              source: {
                pack: pack.id,
                applicationType: listPage.type.id,
                pageId: listPage.page.id
              }
            }
          ]
        : []),
      {
        id: 'supplier-form',
        name: '供应商表单',
        kind: 'contract',
        type: 'form',
        recipe: 'dialog-form',
        contract: dialog.contract,
        sampleEntity: dialog.sampleEntity
      }
    ]
  }
}

export function writeCatalog(data: CatalogData, pack: DesignPack, root = catalogRoot()): void {
  fs.mkdirSync(path.join(root, 'examples'), { recursive: true })
  writeJsonAtomic(path.join(root, 'index.json'), data.index)
  writeJsonAtomic(path.join(root, 'pages.json'), data.pages)
  writeJsonAtomic(path.join(root, 'components.json'), data.components)
  writeJsonAtomic(path.join(root, 'styles.json'), data.styles)
  writeJsonAtomic(path.join(root, 'recipes.json'), data.recipes)
  writeJsonAtomic(path.join(root, 'examples', 'spec.example.json'), exampleSpec(pack))
  for (const [name, value] of Object.entries(exampleContracts())) {
    writeJsonAtomic(path.join(root, 'examples', name), value)
  }
}

function catalogFilesExist(root: string): boolean {
  if (!fs.existsSync(path.join(root, 'index.json'))) return false
  for (const file of [...CATALOG_FILES, ...EXAMPLE_FILES.map(name => path.join('examples', name))]) {
    if (!fs.existsSync(path.join(root, file))) return false
  }
  return true
}

export function readCatalog(root = catalogRoot()): CatalogData {
  const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as T
  return {
    index: read<CatalogIndex>('index.json'),
    pages: read<CatalogPage[]>('pages.json'),
    components: read<CatalogComponent[]>('components.json'),
    styles: read<CatalogStyle[]>('styles.json'),
    recipes: read<CatalogRecipe[]>('recipes.json')
  }
}

let cached: { sourceHash: string; data: CatalogData } | null = null

/** 确保 catalog 与内置 pack 版本/mtime 一致；变化则重建（原子写） */
export function ensureCatalog(options: { force?: boolean } = {}): CatalogData {
  const pack = getBuiltinPack()
  const expectedHash = sourceHashOf(pack)
  if (!options.force && cached && cached.sourceHash === expectedHash) return cached.data
  const root = catalogRoot()
  if (!options.force && catalogFilesExist(root)) {
    try {
      const existing = readCatalog(root)
      if (existing.index.sourceHash === expectedHash) {
        cached = { sourceHash: expectedHash, data: existing }
        return existing
      }
    } catch {
      // 损坏的 catalog：重建
    }
  }
  const data = buildCatalog(pack)
  writeCatalog(data, pack, root)
  cached = { sourceHash: expectedHash, data }
  return data
}

/** 测试用：清内存缓存（不影响磁盘文件） */
export function clearCatalogCache(): void {
  cached = null
}

export { MAPPING_SOURCE as COMPONENT_MAPPING_SOURCE }
