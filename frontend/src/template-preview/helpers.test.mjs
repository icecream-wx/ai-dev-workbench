import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  contractPageType,
  draftDetailUrl,
  findPackPage,
  flattenContract,
  packPages,
  publishedPackUrl,
  referencePreviewUrl,
  resolveTemplatePreviewParams,
  shortTypeClassFor,
  structureCssUrl,
  syntheticDesign,
  templateAssetUrl,
  templatePreviewUrl
} from './helpers.js'

const pack = {
  id: 'supplier-hub',
  name: '供应商管理模板',
  defaultStyle: 'data-cyan',
  applicationTypes: [
    {
      id: 'supplier-hub',
      structure: 'application-types/supplier-hub/structure.css',
      pages: [
        {
          id: 'supplier-list',
          name: '供应商列表',
          type: 'list',
          recipe: 'list',
          kind: 'reference',
          source: { pack: 'afcenter-app-templates-v1', applicationType: 'operations-management', pageId: 'list' },
          components: ['pm-table']
        },
        {
          id: 'supplier-form',
          name: '供应商表单',
          type: 'form',
          recipe: 'dialog-form',
          kind: 'contract',
          contract: {
            form: { presentation: 'dialog', columns: 2, groups: [{ title: '基本信息', fields: ['name', 'status'] }] },
            toolbarActions: ['create'],
            components: { owner: 'pm-select-user' }
          },
          sampleEntity: {
            id: 'supplier',
            name: '供应商',
            fields: [
              { name: 'name', label: '供应商名称', type: 'string' },
              { name: 'status', label: '状态', type: 'enum', options: ['启用', '停用'] }
            ]
          }
        },
        {
          id: 'supplier-detail',
          name: '供应商详情',
          type: 'detail',
          recipe: 'detail',
          kind: 'contract',
          contract: { columns: ['name', 'status'], subTables: [{ entity: 'supplier-contact', title: '联系人' }] },
          sampleEntity: { id: 'supplier', name: '供应商', fields: [{ name: 'name', type: 'string' }] },
          sampleSubEntities: [{ id: 'supplier-contact', name: '联系人', fields: [{ name: 'contactName', type: 'string' }] }]
        },
        { id: 'legacy-page', name: '内置旧页', type: 'list', recipe: 'list', blueprint: 'pages/X.vue' }
      ]
    }
  ],
  styles: [{ id: 'data-cyan', className: 'visual-style-data-cyan' }]
}

test('URL 参数：draft/pack/page/embed（草稿优先；缺参不白屏）', () => {
  assert.deepEqual(resolveTemplatePreviewParams('?draft=supplier-hub&page=supplier-list&embed=1'), {
    mode: 'draft',
    packId: 'supplier-hub',
    pageId: 'supplier-list',
    embed: true
  })
  assert.deepEqual(resolveTemplatePreviewParams('?pack=supplier-hub'), {
    mode: 'pack',
    packId: 'supplier-hub',
    pageId: '',
    embed: false
  })
  assert.deepEqual(resolveTemplatePreviewParams('?pack=published&draft=draft-x&page=p'), {
    mode: 'draft',
    packId: 'draft-x',
    pageId: 'p',
    embed: false
  })
  assert.deepEqual(resolveTemplatePreviewParams(''), { mode: '', packId: '', pageId: '', embed: false })
})

test('数据接口：草稿详情 / structure.css / 已发布 pack（不读 pack.json 资产）', async () => {
  assert.equal(draftDetailUrl('supplier-hub'), '/api/design-templates/drafts/supplier-hub')
  assert.equal(publishedPackUrl('supplier-hub'), '/api/design-system/supplier-hub')
  assert.equal(
    structureCssUrl('draft', 'supplier-hub'),
    `/api/design-templates/drafts/supplier-hub/asset?path=${encodeURIComponent('application-types/supplier-hub/structure.css')}`
  )
  assert.equal(
    templateAssetUrl('', 'supplier-hub', 'styles/data-cyan/style.css'),
    `/api/design-system/supplier-hub/asset?path=${encodeURIComponent('styles/data-cyan/style.css')}`
  )
  assert.equal(templateAssetUrl('draft', '', 'pack.json'), '')
  assert.equal(templateAssetUrl('draft', 'supplier-hub', ''), '')
  // 后端资产接口只允许 css/svg/png/jpg/jpeg；前端不再提供 pack.json 入口
  assert.equal('packJsonUrl' in await import('./helpers.js'), false)
})

test('pack 页面：kind 兼容、查找、根类用 baseApplicationType', () => {
  const pages = packPages(pack)
  assert.deepEqual(
    pages.map((page) => [page.id, page.kind]),
    [
      ['supplier-list', 'reference'],
      ['supplier-form', 'contract'],
      ['supplier-detail', 'contract'],
      ['legacy-page', 'blueprint']
    ]
  )
  assert.equal(findPackPage(pack, 'supplier-form')?.name, '供应商表单')
  assert.equal(findPackPage(pack, 'missing'), null)
  assert.equal(shortTypeClassFor('operations-management'), 'application-type-operations')
  assert.equal(shortTypeClassFor('supplier-hub'), 'application-type-supplier-hub')
})

test('contract 展平：字段容器展平，components 仍为 object，title=name', () => {
  const page = findPackPage(pack, 'supplier-form')
  const flattened = flattenContract(page)
  assert.equal(flattened.title, '供应商表单')
  assert.equal(flattened.entity, 'supplier')
  assert.equal(flattened.type, 'form')
  assert.equal(flattened.recipe, 'dialog-form')
  assert.deepEqual(flattened.toolbarActions, ['create'])
  assert.equal(flattened.form.presentation, 'dialog')
  assert.deepEqual(flattened.components, { owner: 'pm-select-user' })
  // contract 容器本身不再出现在页面字段里
  assert.equal(flattened.contract, undefined)
})

test('contract 页面类型降级：tree-list/未支持类型', () => {
  assert.equal(contractPageType({ type: 'list' }), 'list')
  assert.equal(contractPageType({ type: 'tree-list' }), 'list')
  assert.equal(contractPageType({ type: 'form' }), 'form')
  assert.equal(contractPageType({ type: 'workspace', recipe: 'dashboard' }), 'dashboard')
  assert.equal(contractPageType({ recipe: 'wizard' }), 'form')
  assert.equal(contractPageType({ type: 'unknown', recipe: 'detail' }), 'detail')
})

test('synthetic design：entities = sampleEntity + sampleSubEntities，page.entity 指向主实体', () => {
  const page = findPackPage(pack, 'supplier-detail')
  const design = syntheticDesign(pack, page)
  assert.equal(design.designSystem.pack, 'supplier-hub')
  assert.equal(design.designSystem.applicationType, 'supplier-hub')
  assert.equal(design.designSystem.style, 'data-cyan')
  assert.deepEqual(design.entities.map((entity) => entity.id), ['supplier', 'supplier-contact'])
  assert.equal(design.pages.length, 1)
  assert.equal(design.pages[0].entity, 'supplier')
  assert.deepEqual(design.pages[0].subTables, [{ entity: 'supplier-contact', title: '联系人' }])
})

test('synthetic design：无 sampleEntity 时 entities 为空（预览给空态）', () => {
  const design = syntheticDesign(pack, { id: 'x', name: 'X', type: 'detail', recipe: 'detail', contract: {} })
  assert.deepEqual(design.entities, [])
  assert.equal(design.pages[0].entity, undefined)
})

test('reference iframe URL：源页参数 + 结构覆盖（draft/pack）', () => {
  const page = findPackPage(pack, 'supplier-list')
  const draftUrl = referencePreviewUrl({ mode: 'draft', packId: 'supplier-hub', page, styleId: 'data-cyan' })
  const draftQuery = new URLSearchParams(draftUrl.split('?')[1])
  assert.ok(draftUrl.startsWith('/preview.html?'))
  assert.equal(draftQuery.get('type'), 'operations-management')
  assert.equal(draftQuery.get('page'), 'list')
  assert.equal(draftQuery.get('style'), 'data-cyan')
  assert.equal(draftQuery.get('embed'), '1')
  assert.equal(draftQuery.get('structureDraft'), 'supplier-hub')
  assert.equal(draftQuery.get('structurePack'), null)

  const publishedUrl = referencePreviewUrl({ mode: 'pack', packId: 'supplier-hub', page, styleId: 'data-cyan' })
  const publishedQuery = new URLSearchParams(publishedUrl.split('?')[1])
  assert.equal(publishedQuery.get('structurePack'), 'supplier-hub')
  assert.equal(publishedQuery.get('structureDraft'), null)
})

test('reference iframe URL：缺少 source 时返回空串（防御）', () => {
  assert.equal(referencePreviewUrl({ mode: 'draft', packId: 'p', page: { id: 'x' } }), '')
  assert.equal(templatePreviewUrl({ mode: 'draft', packId: '', pageId: 'x' }), '')
})

test('本入口 URL：draft/pack 两种口径', () => {
  assert.equal(
    templatePreviewUrl({ mode: 'draft', packId: 'supplier-hub', pageId: 'supplier-form' }),
    '/template-preview.html?draft=supplier-hub&page=supplier-form&embed=1'
  )
  const published = templatePreviewUrl({ mode: 'pack', packId: 'supplier-hub', pageId: 'supplier-form', embed: false })
  assert.equal(published, '/template-preview.html?pack=supplier-hub&page=supplier-form')
})
