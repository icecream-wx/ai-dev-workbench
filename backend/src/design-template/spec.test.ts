/**
 * P7-7a spec 解析/规范化/校验（共享核心 `lib/spec.cjs`）
 *
 * - 合法 spec：reference + contract、默认 base/style、type/recipe 推断、specHash 稳定；
 * - 错误码与设计稿 §8.2 / 附录 G 一致；
 * - warning：page-field-unknown / sample-sub-entity-missing / component-unknown / tree-parent-missing；
 * - synthetic design：entities = sampleEntity + sampleSubEntities，contract 展平为页面顶层字段，
 *   并符合 `templates/agent/skills/adw-design-artifacts/references/pages.schema.json`。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { getBuiltinPack } from '../design/pack'
import { validateJsonSchema } from '../workspace/schema'
import { workshopCore } from '../design-template/core'

const core = workshopCore()
const builtin = getBuiltinPack()
const BUILTIN_ID = builtin.id

function baseSpec(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'supplier-hub',
    name: '供应商管理模板',
    description: '供应商台账 + 表单',
    baseApplicationType: 'enterprise-application-platform',
    style: 'data-cyan',
    pages: [
      {
        id: 'supplier-list',
        name: '供应商列表',
        kind: 'reference',
        source: { pack: BUILTIN_ID, applicationType: 'operations-management', pageId: 'list' }
      },
      {
        id: 'supplier-form',
        name: '供应商表单',
        kind: 'contract',
        type: 'form',
        recipe: 'dialog-form',
        contract: {
          form: { presentation: 'dialog', columns: 2, width: 900, groups: [{ title: '基本信息', fields: ['name', 'status'] }] },
          components: { owner: 'pm-select-user' }
        },
        sampleEntity: {
          id: 'supplier',
          name: '供应商',
          fields: [
            { name: 'name', label: '供应商名称', type: 'string' },
            { name: 'status', label: '状态', type: 'enum', options: ['启用', '停用'] },
            { name: 'owner', label: '负责人', type: 'string' }
          ]
        }
      }
    ],
    ...overrides
  }
}

function normalize(raw: unknown, extra: Record<string, unknown> = {}) {
  return core.spec.normalizeSpec(raw, { packId: 'supplier-hub', builtin, ...extra })
}

function codesOf(issues: Array<{ code: string }>): string[] {
  return issues.map(issue => issue.code)
}

test('spec：合法 reference + contract → ok，type/recipe/preview 推断，specHash 稳定', () => {
  const result = normalize(baseSpec())
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.equal(result.errors.length, 0)
  const spec = result.spec!
  assert.equal(spec.id, 'supplier-hub')
  assert.equal(spec.baseApplicationType, 'enterprise-application-platform')
  assert.equal(spec.style, 'data-cyan')
  const [ref, form] = spec.pages
  assert.equal(ref.kind, 'reference')
  assert.equal(ref.type, 'list')
  assert.equal(ref.recipe, 'list')
  assert.equal(ref.source?.applicationType, 'operations-management')
  assert.equal(form.kind, 'contract')
  assert.equal(form.type, 'form')
  assert.equal(form.recipe, 'dialog-form')
  assert.equal(form.preview, 'form')
  assert.ok(result.specHash?.startsWith('sha256:'))
  assert.equal(core.spec.specHash(spec), result.specHash)
  assert.equal(normalize(baseSpec()).specHash, result.specHash, '同 spec 重跑 hash 一致')
})

test('spec：base/style 缺省（第一个 reference 来源类型 + 内置默认风格）', () => {
  const raw = baseSpec()
  delete raw.baseApplicationType
  delete raw.style
  const result = normalize(raw)
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.equal(result.spec?.baseApplicationType, 'operations-management')
  assert.equal(result.spec?.style, builtin.defaultStyle)
})

test('spec：无 reference 时 base 取内置默认类型', () => {
  const raw = baseSpec()
  raw.pages = [
    {
      id: 'only-form',
      name: '表单',
      kind: 'contract',
      type: 'form',
      recipe: 'page-form',
      contract: {},
      sampleEntity: { id: 'e', name: '实体', fields: [{ name: 'a', label: 'A', type: 'string' }] }
    }
  ]
  delete raw.baseApplicationType
  const result = normalize(raw)
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.equal(result.spec?.baseApplicationType, builtin.defaultApplicationType)
})

test('spec：基础错误码（schemaVersion/name/pages/id/page id）', () => {
  assert.ok(codesOf(normalize({ ...baseSpec(), schemaVersion: 2 }).errors).includes('spec-version'))
  assert.ok(codesOf(normalize({ ...baseSpec(), name: '' }).errors).includes('spec-invalid'))
  const noPages = baseSpec()
  delete noPages.pages
  assert.ok(codesOf(normalize(noPages).errors).includes('page-count'))
  assert.ok(codesOf(normalize({ ...baseSpec(), pages: [] }).errors).includes('page-count'))
  const tooMany = baseSpec()
  tooMany.pages = Array.from({ length: 41 }, (_, index) => ({
    id: `page-${index}`,
    name: `页面 ${index}`,
    kind: 'contract',
    recipe: 'detail',
    contract: {},
    sampleEntity: { id: 'e', name: '实体', fields: [{ name: 'a', label: 'A', type: 'string' }] }
  }))
  assert.ok(codesOf(normalize(tooMany).errors).includes('page-count'))

  assert.ok(codesOf(normalize({ ...baseSpec(), id: 'Bad Id' }).errors).includes('pack-id-invalid'))
  assert.ok(codesOf(normalize({ ...baseSpec(), id: '_workshop' }).errors).includes('pack-id-invalid'))
  assert.ok(codesOf(normalize({ ...baseSpec(), id: BUILTIN_ID }).errors).includes('pack-id-invalid'))
  // spec.id 与草稿 id 不一致（id 不可变）
  assert.ok(codesOf(normalize({ ...baseSpec(), id: 'other-id' }).errors).includes('pack-id-invalid'))

  const dupPages = baseSpec()
  ;(dupPages.pages as Array<Record<string, unknown>>)[1].id = 'supplier-list'
  assert.ok(codesOf(normalize(dupPages).errors).includes('page-id-invalid'))
  const badPageId = baseSpec()
  ;(badPageId.pages as Array<Record<string, unknown>>)[0].id = '-bad-'
  assert.ok(codesOf(normalize(badPageId).errors).includes('page-id-invalid'))
})

test('spec：kind 错误（缺省/blueprint/未知），spec 不允许 blueprint', () => {
  const make = (kind: unknown, id = 'p1') => {
    const page: Record<string, unknown> = {
      id,
      name: '页面',
      kind,
      contract: {},
      sampleEntity: { id: 'e', name: '实体', fields: [{ name: 'a', label: 'A', type: 'string' }] }
    }
    return baseSpec({ pages: [page] })
  }
  assert.ok(codesOf(normalize(make(undefined)).errors).includes('kind-required'))
  assert.ok(codesOf(normalize(make('blueprint')).errors).includes('kind-invalid'))
  assert.ok(codesOf(normalize(make('matrix')).errors).includes('kind-invalid'))
})

test('spec：blueprint 不允许出现在 spec 页面（contract → blueprint-on-contract）', () => {
  const raw = baseSpec()
  ;(raw.pages as Array<Record<string, unknown>>)[1].blueprint = 'x/Page.vue'
  const codes = codesOf(normalize(raw).errors)
  assert.ok(codes.includes('blueprint-on-contract'), codes.join(','))
})

test('spec：reference source 缺失/不存在/非内置 → source-missing / source-page-missing', () => {
  const missing = baseSpec()
  delete (missing.pages as Array<Record<string, unknown>>)[0].source
  assert.ok(codesOf(normalize(missing).errors).includes('source-missing'))

  const badPack = baseSpec()
  ;((badPack.pages as Array<Record<string, unknown>>)[0].source as Record<string, unknown>).pack = 'other-pack'
  assert.ok(codesOf(normalize(badPack).errors).includes('source-missing'))

  const badPage = baseSpec()
  ;((badPage.pages as Array<Record<string, unknown>>)[0].source as Record<string, unknown>).pageId = 'no-page'
  assert.ok(codesOf(normalize(badPage).errors).includes('source-page-missing'))
})

test('spec：contract 缺 contract / sampleEntity / sampleSubEntities 非法', () => {
  const noContract = baseSpec()
  delete (noContract.pages as Array<Record<string, unknown>>)[1].contract
  assert.ok(codesOf(normalize(noContract).errors).includes('contract-missing'))

  const noSample = baseSpec()
  delete (noSample.pages as Array<Record<string, unknown>>)[1].sampleEntity
  assert.ok(codesOf(normalize(noSample).errors).includes('sample-entity-missing'))

  const emptyFields = baseSpec()
  ;((emptyFields.pages as Array<Record<string, unknown>>)[1].sampleEntity as Record<string, unknown>).fields = []
  assert.ok(codesOf(normalize(emptyFields).errors).includes('sample-entity-missing'))

  const dupSub = baseSpec()
  ;(dupSub.pages as Array<Record<string, unknown>>)[1].sampleSubEntities = [
    { id: 'supplier', name: '重复主实体', fields: [{ name: 'x', label: 'x', type: 'string' }] }
  ]
  assert.ok(codesOf(normalize(dupSub).errors).includes('sample-sub-entity-invalid'))

  const badSub = baseSpec()
  ;(badSub.pages as Array<Record<string, unknown>>)[1].sampleSubEntities = [{ id: 'sub', name: '空', fields: [] }]
  assert.ok(codesOf(normalize(badSub).errors).includes('sample-sub-entity-invalid'))
})

test('spec：contract recipe 不在 8 配方 → contract-recipe-unsupported；缺省按 type 推断', () => {
  const bad = baseSpec()
  ;(bad.pages as Array<Record<string, unknown>>)[1].recipe = 'matrix'
  assert.ok(codesOf(normalize(bad).errors).includes('contract-recipe-unsupported'))

  const inferred = baseSpec()
  const page = (inferred.pages as Array<Record<string, unknown>>)[1]
  delete page.recipe
  delete page.type
  page.contract = { form: { presentation: 'dialog' } }
  const result = normalize(inferred)
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.equal(result.spec?.pages[1].recipe, 'dialog-form')
  assert.equal(result.spec?.pages[1].type, 'form')
})

test('spec：style / baseApplicationType 不存在 → style-missing / base-type-missing', () => {
  assert.ok(codesOf(normalize({ ...baseSpec(), style: 'nope' }).errors).includes('style-missing'))
  assert.ok(codesOf(normalize({ ...baseSpec(), baseApplicationType: 'nope' }).errors).includes('base-type-missing'))
})

test('spec：保留 id 边界（草稿 id = 内置应用类型 id / 内置 pack id 也拒绝）', () => {
  const asTypeId = normalize({ ...baseSpec(), id: 'operations-management' }, { packId: 'operations-management' })
  assert.ok(codesOf(asTypeId.errors).includes('pack-id-invalid'), JSON.stringify(asTypeId.errors))
  const asBuiltinPack = normalize({ ...baseSpec(), id: BUILTIN_ID }, { packId: BUILTIN_ID })
  assert.ok(codesOf(asBuiltinPack.errors).includes('pack-id-invalid'), JSON.stringify(asBuiltinPack.errors))
  // 普通自定义 id 不受影响（正常草稿流程）
  const normal = normalize(baseSpec())
  assert.equal(normal.ok, true, JSON.stringify(normal.errors))
})

test('spec warning：未在 sampleEntity 的列/表单字段、子表实体缺失、组件未知、树父字段', () => {
  const raw = baseSpec()
  const page = (raw.pages as Array<Record<string, unknown>>)[1]
  page.recipe = 'tree-list'
  page.type = 'list'
  page.contract = {
    columns: ['name', 'ghostColumn'],
    form: { groups: [{ title: '分组', fields: ['name', 'ghostField'] }] },
    tree: { titleField: 'name', parentField: 'missingParent' },
    subTables: [{ entity: 'missing-sub', columns: ['x'] }],
    components: { owner: 'pm-select-user', other: 'pm-not-exist' }
  }
  const result = normalize(raw, { knownComponents: ['pm-select-user', 'pm-select'] })
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  const codes = codesOf(result.warnings)
  assert.ok(codes.includes('page-field-unknown'), codes.join(','))
  assert.ok(codes.includes('sample-sub-entity-missing'), codes.join(','))
  assert.ok(codes.includes('component-unknown'), codes.join(','))
  assert.ok(codes.includes('tree-parent-missing'), codes.join(','))
  const paths = result.warnings.map(item => item.path)
  assert.ok(paths.includes('pages[1].contract.columns[1]'))
  assert.ok(paths.includes('pages[1].contract.form.groups[0].fields[1]'))
  assert.ok(paths.includes('pages[1].contract.subTables[0].entity'))
})

test('spec：未知顶层/页面字段 → spec-invalid（保留 errors[].path 定位）', () => {
  const top = normalize({ ...baseSpec(), extra: 1 })
  assert.ok(top.errors.some(item => item.code === 'spec-invalid' && item.path === 'extra'))
  const raw = baseSpec()
  ;(raw.pages as Array<Record<string, unknown>>)[1].blueprint = 'x.vue'
  assert.ok(raw)
  const withUnknown = baseSpec()
  ;(withUnknown.pages as Array<Record<string, unknown>>)[1].foo = 'bar'
  const result = normalize(withUnknown)
  assert.ok(result.errors.some(item => item.code === 'spec-invalid' && item.path === 'pages[1].foo'))
})

test('synthetic design：sampleEntity + sampleSubEntities、contract 展平、符合 pages.schema.json', () => {
  const raw = baseSpec()
  const detail: Record<string, unknown> = {
    id: 'supplier-detail',
    name: '供应商详情',
    kind: 'contract',
    type: 'detail',
    recipe: 'detail',
    contract: {
      columns: ['name', 'status'],
      subTables: [{ entity: 'supplier-contact', title: '联系人', columns: ['contactName'], mode: 'tab' }],
      components: { owner: 'pm-select-user' }
    },
    sampleEntity: {
      id: 'supplier',
      name: '供应商',
      fields: [
        { name: 'name', label: '供应商名称', type: 'string' },
        { name: 'status', label: '状态', type: 'enum', options: ['启用', '停用'] }
      ]
    },
    sampleSubEntities: [
      {
        id: 'supplier-contact',
        name: '联系人',
        fields: [{ name: 'contactName', label: '联系人', type: 'string' }]
      }
    ]
  }
  ;(raw.pages as Array<Record<string, unknown>>).push(detail)
  const result = normalize(raw)
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  const design = core.spec.buildSyntheticDesign(result.spec, 'supplier-detail') as Record<string, unknown>
  assert.ok(design)
  assert.equal((design.entities as unknown[]).length, 2)
  assert.deepEqual(
    (design.entities as Array<{ id: string }>).map(entity => entity.id),
    ['supplier', 'supplier-contact']
  )
  const page = (design.pages as Array<Record<string, unknown>>)[0]
  assert.equal(page.entity, 'supplier')
  assert.equal(page.recipe, 'detail')
  // contract 展平为页面顶层字段；components 是字段覆盖对象
  assert.deepEqual(page.columns, ['name', 'status'])
  assert.deepEqual(page.components, { owner: 'pm-select-user' })
  assert.deepEqual(page.subTables, [{ entity: 'supplier-contact', title: '联系人', columns: ['contactName'], mode: 'tab' }])
  assert.equal(core.spec.buildSyntheticDesign(result.spec, 'not-exists'), null)

  const schemaFile = path.resolve(
    __dirname,
    '../../../templates/agent/skills/adw-design-artifacts/references/pages.schema.json'
  )
  const schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8')) as Record<string, unknown>
  const schemaErrors = validateJsonSchema(schema, {
    schemaVersion: 2,
    pageSets: [{ id: 'synthetic', epic: 'EP-001', title: 'synthetic', pages: design.pages }]
  })
  assert.deepEqual(schemaErrors, [], JSON.stringify(schemaErrors))
})

test('synthetic design：subTables target 命中/缺失（warning 不阻断）', () => {
  const raw = baseSpec()
  const page = (raw.pages as Array<Record<string, unknown>>)[1]
  page.recipe = 'detail'
  page.type = 'detail'
  page.contract = {
    subTables: [
      { entity: 'supplier-contact', title: '联系人', columns: ['contactName'] },
      { entity: 'missing-sub', title: '缺失', columns: ['x'] }
    ]
  }
  page.sampleSubEntities = [
    { id: 'supplier-contact', name: '联系人', fields: [{ name: 'contactName', label: '联系人', type: 'string' }] }
  ]
  const result = normalize(raw)
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  const codes = codesOf(result.warnings)
  assert.equal(codes.filter(code => code === 'sample-sub-entity-missing').length, 1)
  const design = core.spec.buildSyntheticDesign(result.spec, 'supplier-form') as Record<string, unknown>
  assert.deepEqual(
    (design.entities as Array<{ id: string }>).map(entity => entity.id),
    ['supplier', 'supplier-contact']
  )
})

test('slugifyPackId：ASCII 名称转 id，中文名由草稿 id 兜底', () => {
  assert.equal(core.spec.slugifyPackId('Supplier Hub 2026'), 'supplier-hub-2026')
  assert.equal(core.spec.slugifyPackId('供应商管理'), '')
  assert.equal(core.spec.isValidPackId('supplier-hub-7f3a'), true)
  assert.equal(core.spec.isValidPackId('_workshop'), false)
  assert.equal(core.spec.slugifyPackId('  --A--B--  '), 'a-b')
})
