import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PREVIEW_PAGE,
  appendCustomCategory,
  buildCustomPickerCards,
  buildCustomTemplateItems,
  buildDesignPreviewUrl,
  buildPickerSelection,
  buildPreviewUrl,
  buildTemplatePreviewUrl,
  categoryOptions,
  countTypeComponents,
  customPageSummary,
  customPreviewUrl,
  customStudioHash,
  customTemplateActions,
  describeDesignSelection,
  describeNewAppDesignSelection,
  designTemplateLabel,
  filterApplicationTypes,
  filterCustomTemplates,
  groupPagesByType,
  pageKindCounts,
  pageKindLabel,
  pageSourceLabel,
  publishedCustomPacks,
  resolveDesignSelection
} from './design-template-helpers.js'
import { prototypeModeFor } from '../design-preview/contract-preview.js'

const PAGES = {
  enterprise: [
    {
      id: 'organization',
      name: '组织与用户',
      type: 'tree-list',
      description: '维护组织机构与账号',
      components: ['pm-input', 'pm-tree', 'pm-table']
    },
    {
      id: 'audit',
      name: '审计日志',
      type: 'list',
      description: '查询操作记录',
      components: ['pm-table', 'pm-pagination']
    }
  ],
  operations: [
    {
      id: 'list',
      name: '通知公告管理',
      type: 'list',
      description: '公告发布与上下线',
      components: ['pm-table']
    }
  ]
}

const PACK = {
  id: 'afcenter-app-templates-v1',
  name: 'AFCenter 应用页面模板',
  defaultApplicationType: 'enterprise-application-platform',
  defaultStyle: 'platform-blue',
  applicationTypes: [
    {
      id: 'enterprise-application-platform',
      name: '企业级应用管理平台',
      category: 'platform',
      description: '企业管理页面',
      defaultStyle: 'platform-blue',
      pages: PAGES.enterprise
    },
    {
      id: 'operations-management',
      name: '运营管理后台',
      category: 'operations',
      description: '运营页面',
      defaultStyle: 'classic-warm',
      pages: PAGES.operations
    }
  ],
  styles: [
    { id: 'platform-blue', name: '平台蓝白', signature: '#1F5EFF' },
    { id: 'classic-warm', name: '经典暖色', signature: '#C2542A' }
  ]
}

test('resolveDesignSelection：空选择回退 pack 默认', () => {
  assert.deepEqual(resolveDesignSelection(PACK, {}), {
    pack: 'afcenter-app-templates-v1',
    applicationType: 'enterprise-application-platform',
    style: 'platform-blue'
  })
})

test('resolveDesignSelection：非法类型/风格回退', () => {
  assert.deepEqual(resolveDesignSelection(PACK, { applicationType: 'nope', style: 'nope' }), {
    pack: 'afcenter-app-templates-v1',
    applicationType: 'enterprise-application-platform',
    style: 'platform-blue'
  })
  // 类型合法但风格不属于该类型默认时，仍允许跨类型风格（风格是 pack 级），非法风格回退类型默认
  assert.deepEqual(
    resolveDesignSelection(PACK, { applicationType: 'operations-management', style: 'missing' }),
    { pack: 'afcenter-app-templates-v1', applicationType: 'operations-management', style: 'classic-warm' }
  )
})

test('resolveDesignSelection：pack 缺失返回空选择', () => {
  assert.deepEqual(resolveDesignSelection(null, { applicationType: 'x' }), { pack: '', applicationType: '', style: '' })
  assert.deepEqual(resolveDesignSelection({ id: 'p', applicationTypes: [], styles: [] }, {}), {
    pack: 'p',
    applicationType: '',
    style: ''
  })
})

test('describeDesignSelection：生成展示标签', () => {
  const described = describeDesignSelection(PACK, { applicationType: 'operations-management', style: 'classic-warm' })
  assert.equal(described.applicationTypeName, '运营管理后台')
  assert.equal(described.styleName, '经典暖色')
  assert.equal(described.label, '运营管理后台 · 经典暖色')
  assert.equal(describeDesignSelection(null, {}), null)
})

test('buildPickerSelection：返回 picker 结果；无类型为 null', () => {
  assert.deepEqual(buildPickerSelection(PACK, { style: 'classic-warm' }), {
    pack: 'afcenter-app-templates-v1',
    applicationType: 'enterprise-application-platform',
    style: 'classic-warm',
    applicationTypeName: '企业级应用管理平台',
    styleName: '经典暖色'
  })
  assert.equal(buildPickerSelection(null, {}), null)
})

test('countTypeComponents：跨页面去重', () => {
  assert.equal(countTypeComponents(PACK.applicationTypes[0]), 4)
  assert.equal(countTypeComponents(PACK.applicationTypes[1]), 1)
  assert.equal(countTypeComponents(null), 0)
})

test('categoryOptions：全部 + 固定顺序 + 计数', () => {
  assert.deepEqual(categoryOptions(PACK.applicationTypes), [
    { value: '', label: '全部', count: 2 },
    { value: 'platform', label: '平台管理', count: 1 },
    { value: 'operations', label: '运营管理', count: 1 }
  ])
})

test('filterApplicationTypes：分类与关键词', () => {
  assert.equal(filterApplicationTypes(PACK.applicationTypes, { category: 'operations' }).length, 1)
  assert.equal(filterApplicationTypes(PACK.applicationTypes, { keyword: '组织' }).length, 1)
  assert.equal(filterApplicationTypes(PACK.applicationTypes, { keyword: '不存在' }).length, 0)
  assert.equal(filterApplicationTypes(PACK.applicationTypes, {}).length, 2)
})

test('groupPagesByType：保持首次出现顺序并合并同类型页面', () => {
  const groups = groupPagesByType(PAGES.enterprise)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].type, 'tree-list')
  assert.equal(groups[0].label, '树表页')
  assert.equal(groups[1].type, 'list')
  assert.equal(groups[1].pages.length, 1)
})

test('buildPreviewUrl：type/style/page 与默认页面', () => {
  assert.equal(
    buildPreviewUrl({ applicationType: 'enterprise-application-platform', style: 'platform-blue', page: 'organization' }),
    '/preview.html?type=enterprise-application-platform&style=platform-blue&page=organization'
  )
  assert.equal(
    buildPreviewUrl({ applicationType: 'data-governance-workbench', style: 'data-cyan' }),
    `/preview.html?type=data-governance-workbench&style=data-cyan&page=${DEFAULT_PREVIEW_PAGE}`
  )
  assert.equal(buildPreviewUrl({ style: 'platform-blue' }), '')
})

test('buildPreviewUrl：embed 可选（默认不带，true 时追加 embed=1）', () => {
  const base = buildPreviewUrl({
    applicationType: 'enterprise-application-platform',
    style: 'platform-blue',
    page: 'organization'
  })
  assert.equal(base.includes('embed'), false)
  assert.equal(
    buildPreviewUrl({
      applicationType: 'enterprise-application-platform',
      style: 'platform-blue',
      page: 'organization',
      embed: true
    }),
    '/preview.html?type=enterprise-application-platform&style=platform-blue&page=organization&embed=1'
  )
  // 显式 false 与缺省一致
  assert.equal(
    buildPreviewUrl({ applicationType: 'operations-management', style: 'classic-warm', page: 'list', embed: false }),
    '/preview.html?type=operations-management&style=classic-warm&page=list'
  )
})

test('buildDesignPreviewUrl：设计产物模板风格入口（app/page/type/style/v/embed）', () => {
  const url = buildDesignPreviewUrl({
    appId: 'app1',
    pageId: 'product-list',
    applicationType: 'operations-management',
    style: 'data-cyan',
    designHash: 'hash-123'
  })
  assert.equal(
    url,
    '/design-preview.html?app=app1&page=product-list&type=operations-management&style=data-cyan&v=hash-123&embed=1'
  )
})

test('buildDesignPreviewUrl：可选参数与缺参回退', () => {
  const base = buildDesignPreviewUrl({
    appId: 'a',
    pageId: 'p1',
    applicationType: 'operations-management',
    embed: false
  })
  assert.equal(base, '/design-preview.html?app=a&page=p1&type=operations-management')
  // 缺 app/page/type 任一 → 空串（父面板回退结构草图）
  assert.equal(buildDesignPreviewUrl({ appId: 'a', pageId: 'p1' }), '')
  assert.equal(buildDesignPreviewUrl({ appId: 'a', applicationType: 'operations-management' }), '')
  assert.equal(buildDesignPreviewUrl({ pageId: 'p1', applicationType: 'operations-management' }), '')
})

test('自定义模板：合并草稿 + 已发布 pack 去重（草稿优先、状态/预览/引用合并）', () => {
  const drafts = [
    {
      id: 'supplier-hub',
      name: '供应商管理模板',
      status: 'published',
      style: 'data-cyan',
      baseApplicationType: 'enterprise-application-platform',
      publishedVersion: '1.0.1',
      pageCount: 2,
      hasPack: true,
      updatedAt: '2026-11-21T10:00:00.000Z',
      referencedApps: [{ id: 'app-1', name: '应用一' }],
      pack: { pages: [{ id: 'supplier-list', kind: 'reference' }, { id: 'supplier-form', kind: 'contract' }] }
    },
    {
      id: 'draft-only',
      name: '草稿模板',
      status: 'draft',
      style: 'classic-warm',
      baseApplicationType: 'operations-management',
      publishedVersion: null,
      pageCount: 0,
      hasPack: false,
      updatedAt: '2026-11-21T11:00:00.000Z',
      referencedApps: [],
      pack: null
    }
  ]
  const packs = [
    {
      id: 'supplier-hub',
      name: '供应商管理模板',
      version: '1.0.1',
      source: 'custom',
      templateKind: 'custom',
      defaultStyle: 'data-cyan',
      pageCount: 2,
      referencedApps: [{ id: 'app-1', name: '应用一' }]
    },
    {
      id: 'published-only',
      name: '已发布模板',
      version: '1.0.0',
      source: 'custom',
      templateKind: 'custom',
      defaultStyle: 'platform-blue',
      pageCount: 1,
      origin: { baseApplicationType: 'enterprise-application-platform' },
      referencedApps: []
    },
    { id: 'afcenter-app-templates-v1', name: '内置', source: 'builtin', templateKind: 'builtin' }
  ]
  const details = {
    'published-only': {
      applicationTypes: [
        { id: 'published-only', pages: [{ id: 'only-contract', kind: 'contract' }] }
      ],
      styles: [{ id: 'platform-blue', name: '平台蓝白' }]
    }
  }
  const items = buildCustomTemplateItems({ drafts, packs, details })
  assert.equal(items.length, 3, '内置 pack 被排除，同一 id 只保留一条')
  assert.deepEqual(
    items.map((item) => item.id),
    ['draft-only', 'supplier-hub', 'published-only'],
    '草稿在前，其余按名称/id'
  )
  const supplier = items.find((item) => item.id === 'supplier-hub')
  assert.equal(supplier.status, 'published')
  assert.equal(supplier.version, '1.0.1')
  assert.deepEqual(supplier.pageKinds, { reference: 1, contract: 1, blueprint: 0 })
  assert.equal(supplier.referencedApps.length, 1)
  assert.equal(customPageSummary(supplier), '页面 2（reference 1 · contract 1）')

  const only = items.find((item) => item.id === 'published-only')
  assert.equal(only.hasDraft, false)
  assert.equal(only.pageCount, 1)
  assert.equal(only.firstPageId, 'only-contract')
  assert.equal(customPreviewUrl(only), '/template-preview.html?pack=published-only&page=only-contract&embed=0')

  const draft = items.find((item) => item.id === 'draft-only')
  assert.equal(draft.status, 'draft')
  assert.equal(customPreviewUrl(draft), '', '未生成草稿不可预览')
  assert.equal(customTemplateActions(draft).deleteMode, 'draft')
  assert.equal(customTemplateActions(supplier).deleteMode, 'pack')
})

test('自定义模板：动作可用性、工作室 hash、预览 URL、过滤与分类 tab', () => {
  const item = {
    id: 'supplier-hub',
    name: '供应商管理模板',
    style: 'data-cyan',
    baseApplicationType: 'enterprise-application-platform',
    status: 'published',
    hasPreview: true,
    previewMode: 'draft',
    firstPageId: 'supplier-list',
    pageKinds: { reference: 1, contract: 0 }
  }
  assert.deepEqual(customTemplateActions(item), {
    canEnterStudio: true,
    canEdit: true,
    canPreview: true,
    canDelete: true,
    deleteMode: 'pack'
  })
  assert.equal(customPreviewUrl(item), '/template-preview.html?draft=supplier-hub&page=supplier-list&embed=0')
  assert.equal(customPreviewUrl({ ...item, firstPageId: '' }), '')
  assert.equal(customStudioHash('supplier-hub'), '#/studio/supplier-hub')
  assert.equal(customStudioHash(''), '#/')
  assert.equal(filterCustomTemplates([item], '供应商').length, 1)
  assert.equal(filterCustomTemplates([item], 'data-cyan').length, 1)
  assert.equal(filterCustomTemplates([item], '不存在').length, 0)
  assert.deepEqual(appendCustomCategory(categoryOptions(PACK.applicationTypes), 2).at(-1), {
    value: 'custom',
    label: '自定义',
    count: 2
  })
  assert.deepEqual(pageKindCounts([]), { reference: 0, contract: 0, blueprint: 0 })
  assert.deepEqual(pageKindCounts([{ kind: 'reference' }, { kind: 'unknown' }]), {
    reference: 1,
    contract: 0,
    blueprint: 1
  })
})

test('默认模式判定：有显式契约走模板风格，否则线框', () => {
  const templatePages = [{ id: 'treeTable', recipe: 'tree-list' }]
  assert.equal(prototypeModeFor({ recipe: 'tree-list' }, templatePages), 'template')
  assert.equal(prototypeModeFor({ catalogRef: 'operations-management/treeTable' }, templatePages), 'template')
  assert.equal(prototypeModeFor({ recipe: 'dashboard' }, templatePages), 'template')
  assert.equal(prototypeModeFor({ recipe: 'main-sub' }, templatePages), 'template')
  assert.equal(prototypeModeFor({ recipe: 'wizard' }, templatePages), 'template')
  assert.equal(prototypeModeFor({ blueprint: 'application-types/x/pages/Page.vue' }, templatePages), 'template')
  assert.equal(prototypeModeFor({ id: 'legacy', type: 'list' }, templatePages), 'wireframe')
})

test('P7-7c picker：只列已发布自定义 pack（草稿不在列表）+ 卡片/URL/徽标纯函数', () => {
  const packs = [
    {
      id: 'afcenter-app-templates-v1',
      name: '内置',
      version: '1.0.0',
      source: 'builtin',
      templateKind: 'builtin',
      pageCount: 25,
      styles: [{ id: 'platform-blue', name: '平台蓝白' }],
      applicationTypes: [{ id: 'enterprise-application-platform', name: '企业级应用管理平台', defaultStyle: 'platform-blue' }]
    },
    {
      id: 'supplier-hub',
      name: '供应商管理模板',
      version: '1.0.2',
      source: 'custom',
      templateKind: 'custom',
      origin: { baseApplicationType: 'enterprise-application-platform' },
      defaultStyle: 'data-cyan',
      pageCount: 2,
      styles: [{ id: 'data-cyan', name: '数据蓝青' }],
      applicationTypes: [{ id: 'supplier-hub', name: '供应商管理模板', defaultStyle: 'data-cyan' }]
    }
  ]
  assert.deepEqual(
    publishedCustomPacks(packs).map((pack) => pack.id),
    ['supplier-hub']
  )
  assert.deepEqual(buildCustomPickerCards(packs), [
    {
      id: 'supplier-hub',
      name: '供应商管理模板',
      style: 'data-cyan',
      styleName: '数据蓝青',
      version: '1.0.2',
      pageCount: 2,
      baseApplicationType: 'enterprise-application-platform'
    }
  ])
  // 未发布草稿：只有 drafts 列表，不在 pack summaries 中 → picker 不列
  assert.deepEqual(buildCustomPickerCards([packs[0]]), [])

  assert.equal(
    buildTemplatePreviewUrl({ packId: 'supplier-hub', pageId: 'supplier-form', embed: true }),
    '/template-preview.html?pack=supplier-hub&page=supplier-form&embed=1'
  )
  assert.equal(buildTemplatePreviewUrl({ packId: '', pageId: 'x' }), '')

  assert.equal(pageKindLabel('reference'), '引用页')
  assert.equal(pageKindLabel('contract'), '契约页')
  assert.equal(pageKindLabel(undefined), '蓝图页')
  assert.equal(
    pageSourceLabel({
      kind: 'reference',
      source: { pack: 'afcenter-app-templates-v1', applicationType: 'operations-management', pageId: 'list' }
    }),
    'afcenter-app-templates-v1/operations-management/list'
  )
  assert.equal(pageSourceLabel({ kind: 'contract', contractFile: 'docs/design/template/x/contracts/a.json' }), '契约（无蓝图）')

  // 内置徽标保持 P7-3b 现状；自定义带版本
  const builtinSystem = {
    pack: { id: 'afcenter-app-templates-v1', version: '1.0.0', source: 'builtin' },
    applicationType: packs[0].applicationTypes[0],
    style: { id: 'platform-blue', name: '平台蓝白' }
  }
  assert.equal(designTemplateLabel(builtinSystem), '企业级应用管理平台 · 平台蓝白')
  const customSystem = {
    pack: { id: 'supplier-hub', version: '1.0.2', source: 'custom' },
    origin: { kind: 'custom' },
    applicationType: packs[1].applicationTypes[0],
    style: { id: 'data-cyan', name: '数据蓝青' }
  }
  assert.equal(designTemplateLabel(customSystem), '供应商管理模板 v1.0.2 · 数据蓝青')
  assert.equal(designTemplateLabel({ applicationType: null, style: null }), '')
})

test('P7-7c 新建应用摘要：切换 pack 异步加载期间显示“加载中…”，不回退旧 pack', () => {
  const builtinPack = {
    id: 'afcenter-app-templates-v1',
    name: 'AFCenter 应用页面模板',
    defaultApplicationType: 'enterprise-application-platform',
    defaultStyle: 'platform-blue',
    applicationTypes: [{ id: 'enterprise-application-platform', name: '企业级应用管理平台', defaultStyle: 'platform-blue' }],
    styles: [{ id: 'platform-blue', name: '平台蓝白' }]
  }
  const customPack = {
    id: 'supplier-hub',
    name: '供应商管理模板',
    defaultApplicationType: 'supplier-hub',
    defaultStyle: 'data-cyan',
    applicationTypes: [{ id: 'supplier-hub', name: '供应商管理模板', defaultStyle: 'data-cyan' }],
    styles: [{ id: 'data-cyan', name: '数据蓝青' }]
  }
  const selection = { applicationType: 'supplier-hub', style: 'data-cyan' }

  // 已选自定义、详情未回：旧内置 pack 不得参与摘要
  const loading = describeNewAppDesignSelection({
    packId: 'supplier-hub',
    designPack: builtinPack,
    selection,
    loading: true
  })
  assert.equal(loading.state, 'loading')
  assert.equal(loading.label, '加载中…')
  assert.equal(loading.pending, true)

  // 加载失败：不回退内置摘要
  const failed = describeNewAppDesignSelection({
    packId: 'supplier-hub',
    designPack: null,
    selection,
    loading: false,
    notice: '加载失败'
  })
  assert.equal(failed.state, 'failed')
  assert.equal(failed.label, '已选择（详情未加载）')
  assert.equal(failed.detail, '加载失败')

  // 加载完成：自定义摘要
  const ready = describeNewAppDesignSelection({ packId: 'supplier-hub', designPack: customPack, selection })
  assert.equal(ready.state, 'ready')
  assert.equal(ready.label, '供应商管理模板 · 数据蓝青')
  assert.equal(ready.detail, '供应商管理模板')

  // 内置快速路径/默认态不变
  const builtin = describeNewAppDesignSelection({
    packId: 'afcenter-app-templates-v1',
    designPack: builtinPack,
    selection: { applicationType: 'enterprise-application-platform', style: 'platform-blue' }
  })
  assert.equal(builtin.label, '企业级应用管理平台 · 平台蓝白')
  const empty = describeNewAppDesignSelection({})
  assert.equal(empty.state, 'default')
  assert.equal(empty.label, '默认（由后端选择）')
})
