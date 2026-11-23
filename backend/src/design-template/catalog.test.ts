/**
 * P7-7a catalog（内置 pack + 蓝图扫描）
 *
 * - 25 页 / 39 组件并集 / 4 风格 / 8 配方；共享映射 20 键 ∩ 39 = 13 个可映射控件；
 * - `readPath` / `structureReadPath` 指向 `catalog/builtin/<packId>/...`；
 * - 组件引用次数与 spike C 一致（pm-select 97/24、pm-table 21/18、pm-toolbar-item 52/9）；
 * - 确定性排序 + 原子写 + examples。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p77a-catalog-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_AUTO_START = 'false'

type CatalogModule = typeof import('./catalog')
type SpecModule = typeof import('./spec')
type PackModule = typeof import('../design/pack')
let catalogModule: CatalogModule
let specModule: SpecModule
let packModule: PackModule

before(async () => {
  catalogModule = await import('./catalog')
  specModule = await import('./spec')
  packModule = await import('../design/pack')
})

after(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

const FIXED = '2026-11-21T00:00:00.000Z'

test('catalog：25 页 / 39 组件 / 4 风格 / 8 配方；13/39 可映射控件', () => {
  const pack = packModule.getBuiltinPack()
  const data = catalogModule.buildCatalog(pack, FIXED)
  assert.deepEqual(data.index.counts, {
    applicationTypes: 4,
    pages: 25,
    components: 39,
    styles: 4,
    recipes: 8
  })
  assert.equal(data.index.source.pack, pack.id)
  assert.equal(data.index.source.version, '1.0.0')
  assert.equal(data.index.controls.mappingSource, 'templates/design-system/component-controls.json')

  const controls = specModule.readComponentControls()
  assert.equal(Object.keys(controls).length, 20, '共享映射必须是 20 键')
  assert.equal(data.index.controls.keys, 20)
  assert.equal(data.index.controls.components, 39)
  const mappable = data.components.filter(component => component.contractSupported)
  assert.equal(mappable.length, 13)
  assert.equal(data.index.controls.mappable, 13)
  // 可映射组件 = 20 键 ∩ 39 组件
  const expected = data.components
    .filter(component => component.name in controls)
    .map(component => component.name)
    .sort()
  assert.deepEqual(mappable.map(component => component.name).sort(), expected)
  for (const component of data.components) {
    assert.equal(component.contractControl, controls[component.name] ?? null)
    assert.equal(component.mappingSource, 'templates/design-system/component-controls.json')
  }
})

test('catalog：readPath/structureReadPath 口径 + 页面顺序 + 全部 blueprint', () => {
  const pack = packModule.getBuiltinPack()
  const data = catalogModule.buildCatalog(pack, FIXED)
  const expectedOrder = pack.applicationTypes.flatMap(type => type.pages.map(page => `${type.id}/${page.id}`))
  assert.deepEqual(data.pages.map(page => page.catalogRef), expectedOrder)
  for (const page of data.pages) {
    assert.equal(page.kind, 'blueprint')
    assert.equal(page.pack, pack.id)
    assert.ok(page.readPath.startsWith(`catalog/builtin/${pack.id}/`), page.readPath)
    assert.ok(page.structureReadPath.startsWith(`catalog/builtin/${pack.id}/`), page.structureReadPath)
    assert.equal(page.readPath, `catalog/builtin/${pack.id}/${page.blueprint}`)
    assert.ok(page.assets.every(asset => typeof asset === 'string'))
  }
  const org = data.pages.find(page => page.catalogRef === 'enterprise-application-platform/organization')!
  assert.equal(org.recipe, 'tree-list')
  assert.ok(org.components.includes('pm-tree'))
})

test('catalog：组件引用次数与 spike C 一致（pm-select/pm-table/pm-toolbar-item）', () => {
  const data = catalogModule.buildCatalog(packModule.getBuiltinPack(), FIXED)
  const byName = new Map(data.components.map(component => [component.name, component]))
  const select = byName.get('pm-select')!
  assert.equal(select.tagReferences, 97)
  assert.equal(select.pageReferences, 24)
  assert.equal(select.category, 'control')
  assert.equal(select.contractControl, 'select')
  assert.ok(select.componentMapTypes.includes('enum'))
  assert.ok(select.snippets.length > 0)
  assert.ok(select.snippets.length <= 3)
  assert.ok(select.snippets.every(snippet => snippet.startsWith('<pm-select')))
  assert.ok(select.snippets.every(snippet => snippet.length <= 260))

  const table = byName.get('pm-table')!
  assert.equal(table.tagReferences, 21)
  assert.equal(table.pageReferences, 18)
  assert.equal(table.category, 'container')
  assert.equal(table.contractControl, null)

  const toolbarItem = byName.get('pm-toolbar-item')!
  assert.equal(toolbarItem.tagReferences, 52)
  assert.equal(toolbarItem.pageReferences, 9)

  // 组件名合并后按字典序
  const names = data.components.map(component => component.name)
  assert.deepEqual(names, [...names].sort())
})

test('catalog：确定性（同输入两次 deepEqual）', () => {
  const pack = packModule.getBuiltinPack()
  const first = catalogModule.buildCatalog(pack, FIXED)
  const second = catalogModule.buildCatalog(pack, FIXED)
  assert.deepEqual(first, second)
})

test('catalog：recipes 8 项带中文标签与示例页面；styles 4 套含 tokens', () => {
  const data = catalogModule.buildCatalog(packModule.getBuiltinPack(), FIXED)
  assert.equal(data.recipes.length, 8)
  assert.deepEqual(
    data.recipes.map(recipe => recipe.recipe),
    ['list', 'tree-list', 'dialog-form', 'page-form', 'main-sub', 'detail', 'dashboard', 'wizard']
  )
  const list = data.recipes.find(recipe => recipe.recipe === 'list')!
  assert.equal(list.label, '列表台账')
  assert.deepEqual(list.templateComponents, ['BusinessListPage', 'QueryPanel', 'RowActions', 'ThreePartPagination'])
  assert.ok(list.examplePage)
  assert.ok(list.contractPreviewSupported)
  assert.equal(data.styles.length, 4)
  for (const style of data.styles) {
    assert.ok(style.css.startsWith('styles/'))
    assert.ok(style.tokens.primary.startsWith('#'))
    assert.equal(typeof style.className, 'string')
  }
})

test('ensureCatalog：原子写 5 个 JSON + 5 个 examples；重复调用读缓存；force 重建', () => {
  const data = catalogModule.ensureCatalog()
  const studioCatalog = path.join(root, 'data', 'design-system', '_workshop', 'catalog')
  for (const file of ['index.json', 'pages.json', 'components.json', 'styles.json', 'recipes.json']) {
    assert.ok(fs.existsSync(path.join(studioCatalog, file)), `缺少 ${file}`)
  }
  for (const file of [
    'spec.example.json',
    'page-contract-list.json',
    'page-contract-tree-list.json',
    'page-contract-dialog-form.json',
    'page-contract-main-sub.json'
  ]) {
    assert.ok(fs.existsSync(path.join(studioCatalog, 'examples', file)), `缺少 examples/${file}`)
  }
  const spec = JSON.parse(fs.readFileSync(path.join(studioCatalog, 'examples', 'spec.example.json'), 'utf8')) as Record<
    string,
    unknown
  >
  assert.equal(spec.schemaVersion, 1)
  const pages = spec.pages as Array<Record<string, unknown>>
  assert.ok(pages.some(page => page.kind === 'reference'))
  assert.ok(pages.some(page => page.kind === 'contract'))
  const source = (pages.find(page => page.kind === 'reference')!.source as Record<string, unknown>)
  assert.equal(source.pack, data.index.source.pack)
  // 示例 spec 必须能通过 spec 校验（未被生成器直接使用，但必须合法）
  const normalized = specModule.normalizeDraftSpec(spec, { packId: String(spec.id) })
  assert.equal(normalized.ok, true, JSON.stringify(normalized.errors))

  const again = catalogModule.ensureCatalog()
  assert.equal(again.index.sourceHash, data.index.sourceHash)
  assert.equal(again.index.generatedAt, data.index.generatedAt, '未变化时不重写')

  const forced = catalogModule.ensureCatalog({ force: true })
  assert.equal(forced.index.sourceHash, data.index.sourceHash)
  assert.notEqual(forced.index.generatedAt, data.index.generatedAt)
})
