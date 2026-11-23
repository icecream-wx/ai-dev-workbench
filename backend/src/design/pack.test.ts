/**
 * 设计模板包加载/校验（P7-1）
 *
 * - 内置 pack：4 应用类型 / 4 风格 / 25 页面（5-8-8-4）；
 * - 所有 structure/blueprint/css/assets 路径存在；
 * - 路径安全（绝对路径、`..`、越界）与非法 pack（重复 id/缺字段/缺蓝图）报错；
 * - 自定义根只读 + 同样校验。
 *
 * 使用临时 RG_DATA_DIR；不读写真实 data/、projects/。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-design-pack-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_AUTO_START = 'false'

type PackModule = typeof import('./pack')
let packModule: PackModule

before(async () => {
  packModule = await import('./pack')
})

after(async () => {
  try {
    const dbModule = await import('../db')
    dbModule.db.close()
  } catch {
    // 数据库未打开
  }
  fs.rmSync(root, { recursive: true, force: true })
})

const BUILTIN_ID = 'afcenter-app-templates-v1'

function pageCounts(pack: import('./pack').DesignPack): number[] {
  return pack.applicationTypes.map(type => type.pages.length)
}

function minimalPack(id: string): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id,
    name: '测试模板包',
    version: '0.0.1',
    defaultApplicationType: 'demo-type',
    defaultStyle: 'demo-style',
    applicationTypes: [
      {
        id: 'demo-type',
        name: '演示类型',
        category: 'platform',
        description: '用于路径/字段校验的演示类型。',
        structure: 'type.css',
        defaultStyle: 'demo-style',
        pages: [
          {
            id: 'demo-page',
            name: '演示页面',
            type: 'list',
            recipe: 'list',
            preview: 'list',
            description: '演示页面。',
            blueprint: 'pages/Demo.vue',
            components: ['pm-input']
          }
        ]
      }
    ],
    styles: [
      {
        id: 'demo-style',
        name: '演示风格',
        className: 'visual-style-demo',
        css: 'styles/demo.css',
        description: '演示风格。',
        signature: '#123456',
        tokens: {
          primary: '#123456',
          accent: '#234567',
          neutral: '#345678',
          background: '#f5f5f5',
          radius: 8,
          density: 'compact'
        }
      }
    ],
    skills: ['demo-skill'],
    componentMap: { string: 'pm-input' },
    pageRecipes: { list: ['BusinessListPage'] },
    conformance: ['使用 PageTemplates']
  }
}

function writeCustomPack(id: string, pack: Record<string, unknown> = minimalPack(id)): string {
  const dir = path.join(packModule.customDesignSystemRoot(), id)
  fs.mkdirSync(path.join(dir, 'pages'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'styles'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify(pack, null, 2), 'utf8')
  fs.writeFileSync(path.join(dir, 'pages', 'Demo.vue'), '<template><div>demo</div></template>\n', 'utf8')
  fs.writeFileSync(path.join(dir, 'styles', 'demo.css'), '.demo { color: #123456; }\n', 'utf8')
  fs.writeFileSync(path.join(dir, 'type.css'), '.type { display: block; }\n', 'utf8')
  return dir
}

test('内置 pack：4 应用类型 / 4 风格 / 25 页面（5-8-8-4）', () => {
  const summaries = packModule.listPacks()
  const builtin = summaries.find(item => item.id === BUILTIN_ID)
  assert.ok(builtin, '应列出内置 pack')
  assert.equal(builtin.source, 'builtin')
  assert.equal(builtin.applicationTypes.length, 4)
  assert.equal(builtin.styles.length, 4)
  assert.equal(builtin.pageCount, 25)
  assert.deepEqual(
    builtin.applicationTypes.map(type => type.pageCount),
    [5, 8, 8, 4]
  )

  const pack = packModule.getPack(BUILTIN_ID)
  assert.equal(pack.schemaVersion, 1)
  assert.equal(pack.version, '1.0.0')
  assert.equal(pack.defaultApplicationType, 'enterprise-application-platform')
  assert.equal(pack.defaultStyle, 'platform-blue')
  assert.deepEqual(pageCounts(pack), [5, 8, 8, 4])
  assert.deepEqual(pack.skills, ['afcenter-page-generation', 'pm-components-usage'])
  assert.ok(pack.componentMap['ref:user'] === 'pm-select-user')
  assert.ok(pack.pageRecipes['tree-list'].includes('TreeListPage'))
  assert.ok(pack.conformance.length >= 5)
})

test('blueprint / structure / css / assets 路径存在且位于 pack 内', () => {
  const pack = packModule.getPack(BUILTIN_ID)
  const packRoot = path.join(packModule.builtinDesignSystemRoot(), BUILTIN_ID)
  let pages = 0
  for (const type of pack.applicationTypes) {
    assert.ok(fs.existsSync(path.join(packRoot, type.structure)), `缺少 ${type.structure}`)
    for (const asset of type.assets ?? []) {
      assert.ok(fs.existsSync(path.join(packRoot, asset)), `缺少 ${asset}`)
    }
    for (const page of type.pages) {
      pages += 1
      assert.ok(fs.existsSync(path.join(packRoot, page.blueprint)), `缺少 ${page.blueprint}`)
      assert.ok(page.components.length > 0, `${type.id}/${page.id} 缺少组件清单`)
      assert.ok(!page.blueprint.includes('..'), `${page.blueprint} 不应包含 ..`)
      assert.ok(!path.isAbsolute(page.blueprint), `${page.blueprint} 不应是绝对路径`)
    }
  }
  assert.equal(pages, 25)
  for (const style of pack.styles) {
    assert.ok(fs.existsSync(path.join(packRoot, style.css)), `缺少 ${style.css}`)
    assert.ok(style.tokens.primary.startsWith('#'))
    assert.ok(style.tokens.radius >= 0)
  }
  assert.ok(
    fs.existsSync(
      path.join(packRoot, 'application-types', 'operations-management', 'assets', 'ledger-workflow.svg')
    ),
    '缺少 ledger-workflow.svg'
  )
  assert.ok(fs.existsSync(path.join(packRoot, 'styles', 'shared.css')), '缺少 shared.css')
})

test('getApplicationType / getStyle / getPage；不存在时 404', () => {
  const pack = packModule.getPack(BUILTIN_ID)
  assert.equal(packModule.getApplicationType(pack, 'enterprise-application-platform').pages.length, 5)
  assert.equal(packModule.getStyle(pack, 'platform-blue').className, 'visual-style-platform-blue')
  assert.equal(packModule.getPage(pack, 'operations-management', 'issues').recipe, 'detail')
  assert.throws(
    () => packModule.getApplicationType(pack, 'missing-type'),
    (error: Error & { status?: number }) => error.status === 404
  )
  assert.throws(
    () => packModule.getStyle(pack, 'missing-style'),
    (error: Error & { status?: number }) => error.status === 404
  )
  assert.throws(
    () => packModule.getPage(pack, 'operations-management', 'missing-page'),
    (error: Error & { status?: number }) => error.status === 404
  )
})

test('路径安全：绝对路径 / 盘符 / `..` / 越界一律拒绝', () => {
  for (const bad of ['/etc/passwd', '../outside.vue', 'pages/../../outside.vue', 'C:\\Windows\\win.ini', '\\\\server\\share\\x']) {
    assert.throws(() => packModule.assertPackRelativePath(bad, 'blueprint'), undefined, `${bad} 应被拒绝`)
  }
  assert.equal(packModule.assertPackRelativePath('pages\\Demo.vue', 'blueprint'), 'pages/Demo.vue')
  assert.throws(() => packModule.resolvePackAsset(packModule.builtinDesignSystemRoot(), '../pack.json', '路径'))
  assert.throws(() => packModule.resolvePackAsset(packModule.builtinDesignSystemRoot(), '/pack.json', '路径'))

  const dir = writeCustomPack('custom-evil', minimalPack('custom-evil'))
  const evil = minimalPack('custom-evil')
  const evilType = (evil.applicationTypes as Array<Record<string, unknown>>)[0]
  const evilPages = evilType.pages as Array<Record<string, unknown>>
  evilPages[0].blueprint = '../outside.vue'
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify(evil, null, 2), 'utf8')
  assert.throws(
    () => packModule.getPack('custom-evil'),
    (error: Error & { status?: number }) => error.status === 400
  )
})

test('自定义 pack：合法可读；重复 id / 缺字段 / 缺蓝图 报 400', () => {
  writeCustomPack('custom-demo')
  const summaries = packModule.listPacks()
  const custom = summaries.find(item => item.id === 'custom-demo')
  assert.ok(custom, '应列出自定义 pack')
  assert.equal(custom.source, 'custom')
  assert.equal(custom.templateKind, 'custom')
  assert.equal(custom.origin, undefined, '无 origin 的旧自定义目录不带 origin')
  const loaded = packModule.getPack('custom-demo')
  assert.equal(loaded.applicationTypes[0].pages[0].id, 'demo-page')
  // 旧自定义目录页面缺省 kind → blueprint 兼容，且不要求 source
  assert.equal(loaded.applicationTypes[0].pages[0].kind, 'blueprint')

  const duplicate = minimalPack('custom-duplicate')
  const styles = duplicate.styles as Array<Record<string, unknown>>
  styles.push({ ...styles[0] })
  writeCustomPack('custom-duplicate', duplicate)
  assert.throws(
    () => packModule.getPack('custom-duplicate'),
    (error: Error & { message?: string; status?: number }) => error.status === 400 && /风格 id 重复/.test(String(error.message))
  )

  const missingField = minimalPack('custom-missing')
  delete (missingField.styles as Array<Record<string, unknown>>)[0].tokens
  writeCustomPack('custom-missing', missingField)
  assert.throws(
    () => packModule.getPack('custom-missing'),
    (error: Error & { status?: number }) => error.status === 400
  )

  const missingBlueprint = minimalPack('custom-noblueprint')
  const pages = (missingBlueprint.applicationTypes as Array<Record<string, unknown>>)[0].pages as Array<
    Record<string, unknown>
  >
  pages[0].blueprint = 'pages/Missing.vue'
  writeCustomPack('custom-noblueprint', missingBlueprint)
  assert.throws(
    () => packModule.getPack('custom-noblueprint'),
    (error: Error & { message?: string; status?: number }) => error.status === 400 && /文件不存在/.test(String(error.message))
  )
})

/* ------------------------------------------------------------------ *
 * P7-7a：kind / source / contract / sampleEntity / origin / validatePackDir
 * ------------------------------------------------------------------ */

const CUSTOM_RECIPES: Record<string, string[]> = {
  list: ['BusinessListPage', 'QueryPanel'],
  'tree-list': ['TreeListPage', 'TreePanel'],
  'dialog-form': ['pm-form-dialog', 'FormSection'],
  'page-form': ['StandardFormPage', 'FormSection'],
  'main-sub': ['StandardFormPage', 'FormSection'],
  detail: ['detail sections'],
  dashboard: ['metric cards'],
  wizard: ['pm-steps', 'FormSection']
}

function demoStyle(): Record<string, unknown> {
  return {
    id: 'demo-style',
    name: '演示风格',
    className: 'visual-style-demo',
    css: 'styles/demo.css',
    description: '演示风格。',
    signature: '#123456',
    tokens: {
      primary: '#123456',
      accent: '#234567',
      neutral: '#345678',
      background: '#f5f5f5',
      radius: 8,
      density: 'compact'
    }
  }
}

function referencePage(id: string): Record<string, unknown> {
  return {
    id: 'demo-ref',
    name: '引用页',
    type: 'list',
    recipe: 'list',
    preview: 'list',
    description: '引用内置运营管理页面。',
    kind: 'reference',
    blueprint: `application-types/${id}/pages/DemoRef.vue`,
    source: {
      pack: BUILTIN_ID,
      applicationType: 'operations-management',
      pageId: 'list',
      blueprint: 'application-types/operations-management/pages/OperationsList.vue',
      sha256: 'a'.repeat(64)
    },
    components: ['pm-search', 'pm-table'],
    blocks: 3
  }
}

const SAMPLE_ENTITY = {
  id: 'supplier',
  name: '供应商',
  fields: [
    { name: 'name', label: '供应商名称', type: 'string' },
    { name: 'status', label: '状态', type: 'enum', options: ['启用', '停用'] },
    { name: 'parent', label: '上级', type: 'string' }
  ]
}

function contractPage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-form',
    name: '契约页',
    type: 'form',
    recipe: 'dialog-form',
    preview: 'form',
    description: '按页面契约实现。',
    kind: 'contract',
    contract: {
      form: { presentation: 'dialog', columns: 2, groups: [{ title: '基本信息', fields: ['name', 'ghost'] }] },
      components: { status: 'pm-select' }
    },
    sampleEntity: SAMPLE_ENTITY,
    components: ['pm-form-dialog', 'pm-select'],
    blocks: 0,
    ...overrides
  }
}

function customOriginPack(id: string, pages: Array<Record<string, unknown>>, originOverrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id,
    name: '供应商管理模板',
    version: '1.0.0',
    defaultApplicationType: id,
    defaultStyle: 'demo-style',
    origin: {
      kind: 'custom',
      draftId: id,
      builtFrom: { pack: BUILTIN_ID, version: '1.0.0' },
      baseApplicationType: 'enterprise-application-platform',
      style: 'demo-style',
      revision: 1,
      specHash: 'sha256:' + 'b'.repeat(64),
      ...originOverrides
    },
    applicationTypes: [
      {
        id,
        name: '供应商管理模板',
        category: 'custom',
        description: '自定义模板。',
        structure: 'type.css',
        defaultStyle: 'demo-style',
        pages
      }
    ],
    styles: [demoStyle()],
    skills: ['afcenter-page-generation', 'pm-components-usage'],
    componentMap: { string: 'pm-input' },
    pageRecipes: CUSTOM_RECIPES,
    conformance: ['使用 PageTemplates']
  }
}

/** 写一个 pack 目录（dir 可以是任意路径；用于 validatePackDir 的暂存目录） */
function writePackAt(dir: string, pack: Record<string, unknown>, extraFiles: Record<string, string> = {}): string {
  fs.mkdirSync(path.join(dir, 'styles'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify(pack, null, 2), 'utf8')
  fs.writeFileSync(path.join(dir, 'type.css'), '.type { display: block; }\n', 'utf8')
  fs.writeFileSync(path.join(dir, 'styles', 'demo.css'), '.demo { color: #123456; }\n', 'utf8')
  for (const [relative, content] of Object.entries(extraFiles)) {
    const file = path.join(dir, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content, 'utf8')
  }
  return dir
}

function writeCustomOriginPack(id: string, pages: Array<Record<string, unknown>>, originOverrides = {}): string {
  const dir = path.join(packModule.customDesignSystemRoot(), id)
  const files: Record<string, string> = {}
  for (const page of pages) {
    if (typeof page.blueprint === 'string') files[page.blueprint] = '<template><div>page</div></template>\n'
  }
  return writePackAt(dir, customOriginPack(id, pages, originOverrides), files)
}

function expect400(fn: () => unknown, pattern?: RegExp): void {
  assert.throws(
    fn,
    (error: Error & { status?: number; message?: string }) =>
      error.status === 400 && (!pattern || pattern.test(String(error.message)))
  )
}

test('P7-7a 内置页：kind=blueprint、无 source；25 页全部兼容', () => {
  const pack = packModule.getPack(BUILTIN_ID)
  let pages = 0
  for (const type of pack.applicationTypes) {
    for (const page of type.pages) {
      pages += 1
      assert.equal(page.kind, 'blueprint', `${type.id}/${page.id} 缺省 kind 应为 blueprint`)
      assert.equal(page.source, undefined)
      assert.ok(page.blueprint, '内置页仍应有蓝图')
    }
  }
  assert.equal(pages, 25)
  const summary = packModule.listPacks().find(item => item.id === BUILTIN_ID)!
  assert.equal(summary.templateKind, 'builtin')
  assert.equal(summary.origin, undefined)
})

test('P7-7a 非自定义 pack 的页面带 source → 400', () => {
  const id = 'legacy-source'
  const pack = minimalPack(id)
  const pages = (pack.applicationTypes as Array<Record<string, unknown>>)[0].pages as Array<Record<string, unknown>>
  pages[0].source = { pack: BUILTIN_ID, applicationType: 'operations-management', pageId: 'list' }
  writeCustomPack(id, pack)
  expect400(() => packModule.getPack(id), /source/)
})

test('P7-7a 自定义 pack：reference + contract 可读；contract 无蓝图、source/sample 保留', () => {
  const id = 'custom-origin-demo'
  writeCustomOriginPack(id, [referencePage(id), contractPage()])
  const pack = packModule.getPack(id)
  assert.equal(pack.origin?.kind, 'custom')
  assert.equal(pack.origin?.revision, 1)
  assert.equal(pack.applicationTypes.length, 1)
  const [ref, form] = pack.applicationTypes[0].pages
  assert.equal(ref.kind, 'reference')
  assert.equal(ref.source?.pack, BUILTIN_ID)
  assert.equal(ref.source?.applicationType, 'operations-management')
  assert.equal(ref.source?.pageId, 'list')
  assert.equal(ref.blueprint, `application-types/${id}/pages/DemoRef.vue`)
  assert.equal(form.kind, 'contract')
  assert.equal(form.blueprint, undefined)
  assert.ok(form.contract && typeof form.contract === 'object')
  assert.equal(form.sampleEntity?.id, 'supplier')
  assert.deepEqual(form.components, ['pm-form-dialog', 'pm-select'])

  const summary = packModule.listPacks().find(item => item.id === id)!
  assert.equal(summary.templateKind, 'custom')
  assert.equal(summary.origin?.draftId, id)
  assert.equal(packModule.getPage(pack, id, 'demo-form').kind, 'contract')
})

test('P7-7a 自定义 pack 页面缺省 kind → 400（kind-required）', () => {
  const id = 'custom-kind-required'
  const page = referencePage(id)
  delete page.kind
  writeCustomOriginPack(id, [page])
  expect400(() => packModule.getPack(id), /kind/)
})

test('P7-7a contract 页带 blueprint → 400；缺 sampleEntity → 400；缺 contract → 400', () => {
  const withBlueprint = 'custom-contract-blueprint'
  writeCustomOriginPack(withBlueprint, [contractPage({ blueprint: `application-types/${withBlueprint}/pages/X.vue` })])
  expect400(() => packModule.getPack(withBlueprint), /blueprint/)

  const withoutSample = 'custom-contract-nosample'
  const page = contractPage()
  delete page.sampleEntity
  writeCustomOriginPack(withoutSample, [page])
  expect400(() => packModule.getPack(withoutSample), /sampleEntity/)

  const withoutContract = 'custom-contract-nocontract'
  const page2 = contractPage()
  delete page2.contract
  writeCustomOriginPack(withoutContract, [page2])
  expect400(() => packModule.getPack(withoutContract), /contract/)
})

test('P7-7a reference：缺 source / 源页面不存在 / 源 pack 非内置 → 400', () => {
  const missing = 'custom-ref-missing'
  const page = referencePage(missing)
  delete page.source
  writeCustomOriginPack(missing, [page])
  expect400(() => packModule.getPack(missing), /source/)

  const badPage = 'custom-ref-badpage'
  const page2 = referencePage(badPage)
  ;(page2.source as Record<string, unknown>).pageId = 'no-such-page'
  writeCustomOriginPack(badPage, [page2])
  expect400(() => packModule.getPack(badPage), /不存在/)

  const badPack = 'custom-ref-badpack'
  const page3 = referencePage(badPack)
  ;(page3.source as Record<string, unknown>).pack = 'not-a-pack'
  writeCustomOriginPack(badPack, [page3])
  expect400(() => packModule.getPack(badPack), /内置/)
})

test('P7-7a sampleSubEntities：id/fields 校验与读取', () => {
  const okId = 'custom-sub-ok'
  const okPage = contractPage({
    sampleSubEntities: [
      {
        id: 'supplier-contact',
        name: '联系人',
        fields: [{ name: 'contactName', label: '联系人', type: 'string' }]
      }
    ]
  })
  writeCustomOriginPack(okId, [okPage])
  const loaded = packModule.getPack(okId).applicationTypes[0].pages[0]
  assert.equal(loaded.sampleSubEntities?.length, 1)
  assert.equal(loaded.sampleSubEntities?.[0].id, 'supplier-contact')

  const dupId = 'custom-sub-dup'
  writeCustomOriginPack(dupId, [
    contractPage({
      sampleSubEntities: [
        { id: 'supplier', name: '重复主实体', fields: [{ name: 'x', label: 'x', type: 'string' }] }
      ]
    })
  ])
  expect400(() => packModule.getPack(dupId), /重复/)

  const emptyFields = 'custom-sub-empty'
  writeCustomOriginPack(emptyFields, [
    contractPage({ sampleSubEntities: [{ id: 'sub', name: '空字段', fields: [] }] })
  ])
  expect400(() => packModule.getPack(emptyFields), /fields/)
})

test('P7-7a origin 校验：kind / revision / draftId / 自定义单类型单风格', () => {
  const badKind = 'custom-origin-kind'
  writeCustomOriginPack(badKind, [contractPage()], { kind: 'builtin' })
  expect400(() => packModule.getPack(badKind), /origin\.kind/)

  const badRevision = 'custom-origin-revision'
  writeCustomOriginPack(badRevision, [contractPage()], { revision: -1 })
  expect400(() => packModule.getPack(badRevision), /revision/)

  const badDraft = 'custom-origin-draft'
  writeCustomOriginPack(badDraft, [contractPage()], { draftId: 'other-id' })
  expect400(() => packModule.getPack(badDraft), /draftId/)

  const twoTypes = 'custom-origin-multitype'
  const pack = customOriginPack(twoTypes, [contractPage()])
  const types = pack.applicationTypes as Array<Record<string, unknown>>
  types.push({ ...types[0], id: 'second-type' })
  writePackAt(path.join(packModule.customDesignSystemRoot(), twoTypes), pack)
  expect400(() => packModule.getPack(twoTypes), /1 个 applicationType|applicationType/)
})

test('P7-7a validatePackDir：expectedId 支持暂存目录 pack；错误返回不抛', () => {
  const id = 'custom-validate-dir'
  const stagingRoot = fs.mkdtempSync(path.join(root, 'staging-'))
  const staging = path.join(stagingRoot, 'pack')
  writePackAt(staging, customOriginPack(id, [contractPage()]))

  const withoutExpected = packModule.validatePackDir(staging)
  assert.equal(withoutExpected.ok, false)
  assert.match(withoutExpected.errors[0].message, /目录名/)

  const withExpected = packModule.validatePackDir(staging, id)
  assert.equal(withExpected.ok, true)
  assert.equal(withExpected.pack?.id, id)
  assert.equal(withExpected.pack?.applicationTypes[0].pages[0].kind, 'contract')

  const missing = packModule.validatePackDir(path.join(stagingRoot, 'nope'), id)
  assert.equal(missing.ok, false)
  assert.equal(missing.errors[0].code, 'pack-invalid')
})

test('P7-7a validatePackDir：contract 软校验 warning（字段/子表/树）', () => {
  const id = 'custom-soft-warnings'
  const page = contractPage({
    recipe: 'tree-list',
    type: 'list',
    contract: {
      columns: ['name', 'ghostColumn'],
      rowActions: ['detail', '中文动作'],
      tree: { titleField: 'name', parentField: 'missingParent' },
      subTables: [{ entity: 'missing-sub', columns: ['x'] }]
    }
  })
  writeCustomOriginPack(id, [page])
  const validation = packModule.validatePackDir(path.join(packModule.customDesignSystemRoot(), id), id)
  assert.equal(validation.ok, true)
  const codes = validation.warnings.map(issue => issue.code)
  assert.ok(codes.includes('page-field-unknown'), `应提示未知字段：${codes.join(',')}`)
  assert.ok(codes.includes('sample-sub-entity-missing'), `应提示子表实体缺失：${codes.join(',')}`)
  assert.ok(codes.includes('tree-parent-missing'), `应提示树父字段：${codes.join(',')}`)
  assert.ok(codes.includes('contract-soft'), `应复用动作枚举软校验：${codes.join(',')}`)
})

