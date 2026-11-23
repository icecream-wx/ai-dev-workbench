import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyStructureOverride, embedEnabled, resolvePreviewParams, resolveStructureOverride, structureAssetUrl } from './preview-params.js'

const meta = {
  applicationTypes: [
    {
      id: 'enterprise-application-platform',
      defaultStyle: 'platform-blue',
      pages: [
        { id: 'overview' },
        { id: 'organization' }
      ]
    },
    {
      id: 'operations-management',
      defaultStyle: 'classic-warm',
      pages: [{ id: 'treeTable' }, { id: 'list' }]
    }
  ],
  styles: [
    { id: 'platform-blue' },
    { id: 'classic-warm' },
    { id: 'data-cyan' },
    { id: 'high-contrast-tool' }
  ]
}

test('缺省参数使用默认应用类型/风格/页面', () => {
  const res = resolvePreviewParams('', meta)
  assert.equal(res.typeId, 'enterprise-application-platform')
  assert.equal(res.styleId, 'platform-blue')
  assert.equal(res.pageId, 'organization')
  assert.deepEqual(res.warnings, [])
})

test('合法参数原样返回', () => {
  const res = resolvePreviewParams(
    '?type=operations-management&style=high-contrast-tool&page=list',
    meta
  )
  assert.equal(res.typeId, 'operations-management')
  assert.equal(res.styleId, 'high-contrast-tool')
  assert.equal(res.pageId, 'list')
  assert.deepEqual(res.warnings, [])
})

test('非法 type 回退默认类型并给出提示', () => {
  const res = resolvePreviewParams('?type=not-exist&page=overview', meta)
  assert.equal(res.typeId, 'enterprise-application-platform')
  assert.equal(res.pageId, 'overview')
  assert.equal(res.warnings.length, 1)
  assert.match(res.warnings[0], /未知应用类型/)
})

test('只给 type 时使用该应用类型的默认风格与首页', () => {
  const res = resolvePreviewParams('?type=operations-management', meta)
  assert.equal(res.styleId, 'classic-warm')
  assert.equal(res.pageId, 'treeTable')
  assert.deepEqual(res.warnings, [])
})

test('非法 style 回退到应用类型默认风格', () => {
  const res = resolvePreviewParams('?type=operations-management&style=not-exist', meta)
  assert.equal(res.styleId, 'classic-warm')
  assert.equal(res.warnings.length, 1)
  assert.match(res.warnings[0], /未知视觉风格/)
})

test('非法 page 回退到该类型首页并给出提示', () => {
  const res = resolvePreviewParams('?type=operations-management&page=organization', meta)
  assert.equal(res.pageId, 'treeTable')
  assert.equal(res.warnings.length, 1)
  assert.match(res.warnings[0], /不存在页面/)
})

test('页面 id 仅在所属应用类型内匹配（不跨类型串页）', () => {
  const res = resolvePreviewParams('?type=operations-management&page=overview', meta)
  assert.equal(res.pageId, 'treeTable')
  assert.equal(res.warnings.length, 1)
})

test('embed=1/true 视为嵌入模式，其余为否', () => {
  assert.equal(embedEnabled('?embed=1'), true)
  assert.equal(embedEnabled('?type=x&embed=true'), true)
  assert.equal(embedEnabled('?embed=0'), false)
  assert.equal(embedEnabled('?embed=false'), false)
  assert.equal(embedEnabled(''), false)
  assert.equal(embedEnabled('?type=operations-management'), false)
})

test('structurePack/structureDraft 解析：草稿优先，无参数为空', () => {
  assert.deepEqual(resolveStructureOverride(''), { mode: '', packId: '' })
  assert.deepEqual(resolveStructureOverride('?structurePack=supplier-hub'), { mode: 'pack', packId: 'supplier-hub' })
  assert.deepEqual(resolveStructureOverride('?structureDraft=supplier-hub'), { mode: 'draft', packId: 'supplier-hub' })
  assert.deepEqual(
    resolveStructureOverride('?structurePack=published-x&structureDraft=supplier-hub'),
    { mode: 'draft', packId: 'supplier-hub' }
  )
  assert.deepEqual(resolveStructureOverride('?structureDraft=%20%20'), { mode: '', packId: '' })
})

test('structure 资产 URL：草稿/已发布口径与固定路径', () => {
  assert.equal(structureAssetUrl({ mode: '', packId: '' }), '')
  assert.equal(
    structureAssetUrl({ mode: 'draft', packId: 'supplier-hub' }),
    `/api/design-templates/drafts/supplier-hub/asset?path=${encodeURIComponent('application-types/supplier-hub/structure.css')}`
  )
  assert.equal(
    structureAssetUrl({ mode: 'pack', packId: 'supplier-hub' }),
    `/api/design-system/supplier-hub/asset?path=${encodeURIComponent('application-types/supplier-hub/structure.css')}`
  )
})

test('updateLocation 保留结构覆盖参数（type/style/page/embed 语义不变）', () => {
  const query = new URLSearchParams('type=operations-management&style=data-cyan&page=list&embed=1')
  applyStructureOverride(query, { mode: 'draft', packId: 'supplier-hub' })
  assert.equal(query.get('type'), 'operations-management')
  assert.equal(query.get('style'), 'data-cyan')
  assert.equal(query.get('page'), 'list')
  assert.equal(query.get('embed'), '1')
  assert.equal(query.get('structureDraft'), 'supplier-hub')
  assert.equal(query.get('structurePack'), null)

  const published = new URLSearchParams('type=list')
  applyStructureOverride(published, { mode: 'pack', packId: 'supplier-hub' })
  assert.equal(published.get('structurePack'), 'supplier-hub')
  assert.equal(published.get('structureDraft'), null)

  const plain = new URLSearchParams('type=list&style=data-cyan&page=list')
  applyStructureOverride(plain, { mode: '', packId: '' })
  assert.equal(plain.get('structurePack'), null)
  assert.equal(plain.get('structureDraft'), null)
})
