/**
 * 设计模板中心纯函数（P7-3b）
 *
 * 只处理 pack 数据与选择结果的解析/分组/URL 构造，便于 node --test。
 * 不依赖 Vue / DOM；pack 结构见 `frontend/src/shared/design-system-api.ts`。
 */

export const DEFAULT_DESIGN_APPLICATION_TYPE = 'enterprise-application-platform'
export const DEFAULT_DESIGN_STYLE = 'platform-blue'
export const DEFAULT_PREVIEW_PAGE = 'organization'

/** 应用类型分类（与 pack.json 的 category 对应） */
export const DESIGN_CATEGORY_LABELS = {
  platform: '平台管理',
  operations: '运营管理',
  data: '数据分析',
  tool: '工具应用'
}

const DESIGN_CATEGORY_ORDER = ['platform', 'operations', 'data', 'tool']

/** 页面 type 的中文标签（仅用于分组标题） */
export const PAGE_TYPE_LABELS = {
  dashboard: '驾驶舱',
  list: '列表页',
  form: '表单页',
  'tree-list': '树表页',
  detail: '详情页',
  workspace: '工作台',
  layout: '布局页',
  advanced: '高级工作区',
  calendar: '日历排班'
}

export function categoryLabel(category) {
  return DESIGN_CATEGORY_LABELS[category] || category || '其他'
}

export function findApplicationType(pack, applicationTypeId) {
  if (!pack || !Array.isArray(pack.applicationTypes) || !applicationTypeId) return null
  return pack.applicationTypes.find((type) => type.id === applicationTypeId) || null
}

export function findDesignStyle(pack, styleId) {
  if (!pack || !Array.isArray(pack.styles) || !styleId) return null
  return pack.styles.find((style) => style.id === styleId) || null
}

/**
 * 解析选择：非法/缺失时按 pack 默认与类型默认逐级回退。
 * @returns {{pack: string, applicationType: string, style: string}}
 */
export function resolveDesignSelection(pack, selection = {}) {
  if (!pack) return { pack: '', applicationType: '', style: '' }
  const type =
    findApplicationType(pack, selection?.applicationType) ||
    findApplicationType(pack, pack.defaultApplicationType) ||
    (Array.isArray(pack.applicationTypes) ? pack.applicationTypes[0] : null)
  const style =
    findDesignStyle(pack, selection?.style) ||
    findDesignStyle(pack, type?.defaultStyle) ||
    findDesignStyle(pack, pack.defaultStyle) ||
    (Array.isArray(pack.styles) ? pack.styles[0] : null)
  return {
    pack: pack.id || '',
    applicationType: type?.id || '',
    style: style?.id || ''
  }
}

/**
 * 选择结果的展示描述；pack 缺失或无应用类型时返回 null。
 * @returns {{pack: string, applicationType: string, style: string, applicationTypeName: string, styleName: string, label: string} | null}
 */
export function describeDesignSelection(pack, selection = {}) {
  if (!pack) return null
  const resolved = resolveDesignSelection(pack, selection)
  const type = findApplicationType(pack, resolved.applicationType)
  if (!type) return null
  const style = findDesignStyle(pack, resolved.style)
  return {
    ...resolved,
    applicationTypeName: type.name,
    styleName: style?.name || '',
    label: style?.name ? `${type.name} · ${style.name}` : type.name
  }
}

/** picker 模式「使用此模板」的结果；无有效应用类型时为 null */
export function buildPickerSelection(pack, selection = {}) {
  const described = describeDesignSelection(pack, selection)
  if (!described) return null
  return {
    pack: described.pack,
    applicationType: described.applicationType,
    style: described.style,
    applicationTypeName: described.applicationTypeName,
    styleName: described.styleName
  }
}

/** 页面去重后的组件数（同一组件只计一次） */
export function countTypeComponents(applicationType) {
  const names = new Set()
  for (const page of applicationType?.pages || []) {
    for (const component of page.components || []) {
      if (component) names.add(component)
    }
  }
  return names.size
}

/**
 * 分类 tabs：全部 + pack 中实际出现的分类（固定顺序，未知分类追加）。
 * @returns {Array<{value: string, label: string, count: number}>}
 */
export function categoryOptions(applicationTypes = []) {
  const counts = new Map()
  for (const type of applicationTypes) {
    const key = type.category || 'other'
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const ordered = [...DESIGN_CATEGORY_ORDER, ...[...counts.keys()].filter((key) => !DESIGN_CATEGORY_ORDER.includes(key))]
  const tabs = [{ value: '', label: '全部', count: applicationTypes.length }]
  for (const key of ordered) {
    if (!counts.has(key)) continue
    tabs.push({ value: key, label: categoryLabel(key), count: counts.get(key) })
  }
  return tabs
}

/** 分类 + 关键词过滤（名称/描述/页面名/页面描述） */
export function filterApplicationTypes(applicationTypes = [], { category = '', keyword = '' } = {}) {
  const query = String(keyword || '').trim().toLowerCase()
  return applicationTypes.filter((type) => {
    if (category && type.category !== category) return false
    if (!query) return true
    const haystack = [
      type.name,
      type.description,
      ...(type.pages || []).flatMap((page) => [page.name, page.description])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
}

/** 页面按 type 分组；保持页面在 pack 中的出现顺序 */
export function groupPagesByType(pages = []) {
  const groups = []
  const index = new Map()
  for (const page of pages) {
    const key = page.type || 'other'
    let group = index.get(key)
    if (!group) {
      group = { type: key, label: PAGE_TYPE_LABELS[key] || key, pages: [] }
      index.set(key, group)
      groups.push(group)
    }
    group.pages.push(page)
  }
  return groups
}

/* ------------------------------------------------------------------ *
 * P7-7b-2b：模板中心「自定义模板」
 * ------------------------------------------------------------------ */

export const CUSTOM_DESIGN_CATEGORY = 'custom'
export const CUSTOM_STATUS_LABELS = { draft: '草稿', published: '已发布' }

/** 在「全部 + 应用类型分类」后追加「自定义」tab（picker 不调用） */
export function appendCustomCategory(tabs = [], count = 0) {
  return [...tabs, { value: CUSTOM_DESIGN_CATEGORY, label: '自定义', count }]
}

function pagesOfDetail(detail) {
  const out = []
  for (const type of Array.isArray(detail?.applicationTypes) ? detail.applicationTypes : []) {
    for (const page of Array.isArray(type?.pages) ? type.pages : []) out.push(page)
  }
  return out
}

/** 汇总页面 kind（reference/contract/blueprint） */
export function pageKindCounts(pages = []) {
  const counts = { reference: 0, contract: 0, blueprint: 0 }
  for (const page of Array.isArray(pages) ? pages : []) {
    const kind = page?.kind === 'reference' || page?.kind === 'contract' ? page.kind : 'blueprint'
    counts[kind] += 1
  }
  return counts
}

/** `页面 N（reference a · contract b）`；无 kind 时退回总页数 */
export function customPageSummary(item) {
  const kinds = item?.pageKinds ?? {}
  const reference = Number(kinds.reference) || 0
  const contract = Number(kinds.contract) || 0
  if (!reference && !contract) return `${Number(item?.pageCount) || 0} 页`
  return `页面 ${reference + contract}（reference ${reference} · contract ${contract}）`
}

/**
 * 合并草稿 + 已发布自定义 pack（按 id 去重；草稿优先更新名称/校验/时间）。
 *
 * @param {{drafts?: Array<object>, packs?: Array<object>, details?: Record<string, object>}} input
 *   drafts = `GET /api/design-templates/drafts#drafts`；packs = `GET /api/design-system#packs`；
 *   details = 已发布 pack 的完整详情（可选，用于 reference/contract 计数）。
 * @returns {Array<object>} 稳定排序：草稿在前，再按名称/id
 */
export function buildCustomTemplateItems({ drafts = [], packs = [], details = {} } = {}) {
  const byId = new Map()

  for (const draft of Array.isArray(drafts) ? drafts : []) {
    const id = String(draft?.id ?? '').trim()
    if (!id) continue
    const packSummary = draft?.pack && typeof draft.pack === 'object' ? draft.pack : null
    const detail = details[id]
    const pages = Array.isArray(packSummary?.pages) ? packSummary.pages : pagesOfDetail(detail)
    byId.set(id, {
      id,
      name: String(draft?.name ?? '') || id,
      style: String(draft?.style ?? ''),
      baseApplicationType: String(draft?.baseApplicationType ?? ''),
      status: draft?.publishedVersion ? 'published' : 'draft',
      version: String(draft?.publishedVersion ?? ''),
      pageCount: Number(draft?.pageCount ?? pages.length) || 0,
      pageKinds: pageKindCounts(pages),
      referencedApps: Array.isArray(draft?.referencedApps) ? draft.referencedApps : [],
      hasDraft: true,
      hasDraftPack: Boolean(draft?.hasPack),
      hasPublishedPack: Boolean(draft?.publishedVersion),
      hasPreview: Boolean(draft?.hasPack) || Boolean(draft?.publishedVersion),
      previewMode: draft?.hasPack ? 'draft' : 'pack',
      firstPageId: String(pages[0]?.id ?? ''),
      updatedAt: String(draft?.updatedAt ?? '')
    })
  }

  for (const pack of Array.isArray(packs) ? packs : []) {
    const kind = pack?.templateKind || pack?.source
    if (kind !== 'custom') continue
    const id = String(pack?.id ?? '').trim()
    if (!id) continue
    const detail = details[id]
    const pages = pagesOfDetail(detail)
    const existing = byId.get(id)
    const referencedApps = Array.isArray(pack?.referencedApps) ? pack.referencedApps : []
    if (existing) {
      existing.status = 'published'
      existing.hasPublishedPack = true
      existing.hasPreview = existing.hasPreview || pages.length > 0
      existing.version = String(pack?.version ?? existing.version)
      existing.name = existing.name || String(pack?.name ?? '') || id
      existing.style = existing.style || String(pack?.defaultStyle ?? '')
      if (pages.length) {
        existing.pageCount = pages.length
        existing.pageKinds = pageKindCounts(pages)
        existing.firstPageId = existing.firstPageId || String(pages[0]?.id ?? '')
      } else {
        existing.pageCount = existing.pageCount || Number(pack?.pageCount ?? 0) || 0
      }
      if (!existing.referencedApps.length && referencedApps.length) existing.referencedApps = referencedApps
      continue
    }
    byId.set(id, {
      id,
      name: String(pack?.name ?? '') || id,
      style: String(pack?.defaultStyle ?? ''),
      baseApplicationType: String(pack?.origin?.baseApplicationType ?? ''),
      status: 'published',
      version: String(pack?.version ?? ''),
      pageCount: pages.length || Number(pack?.pageCount ?? 0) || 0,
      pageKinds: pageKindCounts(pages),
      referencedApps,
      hasDraft: false,
      hasDraftPack: false,
      hasPublishedPack: true,
      hasPreview: pages.length > 0,
      previewMode: 'pack',
      firstPageId: String(pages[0]?.id ?? ''),
      updatedAt: ''
    })
  }

  return [...byId.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'draft' ? -1 : 1
    return String(a.name).localeCompare(String(b.name)) || a.id.localeCompare(b.id)
  })
}

/** 自定义模板卡片动作可用性（与 UI 按钮 disabled 一致） */
export function customTemplateActions(item) {
  const id = String(item?.id ?? '')
  return {
    canEnterStudio: Boolean(id),
    canEdit: Boolean(id),
    canPreview: Boolean(id && item?.hasPreview && item?.firstPageId),
    canDelete: Boolean(id),
    deleteMode: item?.status === 'published' ? 'pack' : 'draft'
  }
}

/** 自定义模板预览 URL（新窗口 embed=0；草稿优先 draft，已发布无草稿用 pack） */
export function customPreviewUrl(item) {
  const id = String(item?.id ?? '')
  const page = String(item?.firstPageId ?? '')
  if (!id || !page || !item?.hasPreview) return ''
  const query = new URLSearchParams()
  query.set(item?.previewMode === 'pack' ? 'pack' : 'draft', id)
  query.set('page', page)
  query.set('embed', '0')
  return `/template-preview.html?${query.toString()}`
}

/** 工作室 hash 路由 */
export function customStudioHash(id) {
  const value = String(id ?? '').trim()
  return value ? `#/studio/${value}` : '#/'
}

/** 关键词过滤自定义模板（名称/风格/id/base 应用类型） */
export function filterCustomTemplates(items = [], keyword = '') {
  const query = String(keyword || '').trim().toLowerCase()
  if (!query) return Array.isArray(items) ? items : []
  return (Array.isArray(items) ? items : []).filter((item) =>
    [item.name, item.style, item.id, item.baseApplicationType]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  )
}

/* ------------------------------------------------------------------ *
 * P7-7c：已发布自定义 pack 进入新建应用 picker
 * ------------------------------------------------------------------ */

/** 仅已发布自定义 pack（草稿不在 listDesignPacks 中；再按模板来源过滤一次） */
export function publishedCustomPacks(packs = []) {
  return (Array.isArray(packs) ? packs : []).filter((pack) => {
    const kind = pack?.templateKind || pack?.source
    return kind === 'custom' && Boolean(pack?.id)
  })
}

/**
 * picker 自定义分组卡片（摘要数据；点击后再取详情）。
 * @returns {Array<{id:string,name:string,style:string,styleName:string,version:string,pageCount:number,baseApplicationType:string}>}
 */
export function buildCustomPickerCards(packs = []) {
  return publishedCustomPacks(packs).map((pack) => {
    const styleId = String(pack.defaultStyle || '')
    const style = (Array.isArray(pack.styles) ? pack.styles : []).find((item) => item.id === styleId)
    return {
      id: String(pack.id),
      name: String(pack.name || pack.id),
      style: styleId,
      styleName: String(style?.name || styleId),
      version: String(pack.version || ''),
      pageCount: Number(pack.pageCount) || 0,
      baseApplicationType: String(pack.origin?.baseApplicationType || '')
    }
  })
}

/** 自定义模板页面预览 URL（template-preview.html；仅 reference/contract 页） */
export function buildTemplatePreviewUrl({ packId = '', pageId = '', embed = true } = {}) {
  if (!packId || !pageId) return ''
  const query = new URLSearchParams()
  query.set('pack', packId)
  query.set('page', pageId)
  query.set('embed', embed ? '1' : '0')
  return `/template-preview.html?${query.toString()}`
}

/** 页面 kind 中文标签（模板页面库/提示用） */
export function pageKindLabel(kind) {
  if (kind === 'reference') return '引用页'
  if (kind === 'contract') return '契约页'
  return '蓝图页'
}

/** 页面来源描述（reference：pack/type/page；contract：契约文件） */
export function pageSourceLabel(page) {
  if (!page) return ''
  if (page.kind === 'contract') return page.contractFile ? '契约（无蓝图）' : '契约（无蓝图）'
  if (page.kind === 'reference' && page.source) {
    return [page.source.pack, page.source.applicationType, page.source.pageId].filter(Boolean).join('/')
  }
  return ''
}

/**
 * 设计模板徽标/摘要文案：
 * - 内置：`<应用类型> · <风格>`（与 P7-3b/P8-1 一致）；
 * - 自定义：`<模板名> v<版本> · <风格>`（设计稿 §14.3）。
 */
export function designTemplateLabel(designSystem, { separator = ' · ' } = {}) {
  const type = designSystem?.applicationType
  const style = designSystem?.style
  if (!type || !style) return ''
  const custom =
    designSystem?.origin?.kind === 'custom' ||
    designSystem?.pack?.source === 'custom' ||
    designSystem?.preview?.kind === 'custom'
  const typeName = String(type.name || type.id || '')
  const styleName = String(style.name || style.id || '')
  const version = custom ? String(designSystem?.pack?.version || designSystem?.preview?.packVersion || '') : ''
  return [version ? `${typeName} v${version}` : typeName, styleName].filter(Boolean).join(separator)
}

/**
 * 新建应用「设计模板摘要」状态（P7-7c 修复）：选择 pack 后详情异步加载期间
 * 不得用旧 pack（内置）回退摘要，而应显示“加载中…”。
 *
 * @param {{packId?: string, designPack?: object|null, selection?: object, loading?: boolean, notice?: string}} input
 * @returns {{state: 'ready'|'loading'|'failed'|'default', label: string, detail: string, pending: boolean}}
 */
export function describeNewAppDesignSelection({ packId = '', designPack = null, selection = {}, loading = false, notice = '' } = {}) {
  // 已选 pack 与当前详情不一致（切换中/旧详情）：不得用旧 pack 回退摘要
  const packMismatch = Boolean(packId) && Boolean(designPack) && String(designPack.id) !== String(packId)
  if (designPack && !packMismatch) {
    const described = describeDesignSelection(designPack, selection)
    if (described) {
      return {
        state: 'ready',
        label: described.label,
        detail: designPack.name || described.applicationTypeName,
        pending: false
      }
    }
  }
  if (loading) {
    return {
      state: 'loading',
      label: '加载中…',
      detail: notice || '正在加载模板详情',
      pending: true
    }
  }
  if (packId) {
    return {
      state: 'failed',
      label: '已选择（详情未加载）',
      detail: notice || '模板详情加载失败，创建时由后端校验',
      pending: false
    }
  }
  return {
    state: 'default',
    label: '默认（由后端选择）',
    detail: notice || '应用类型 + 视觉风格',
    pending: false
  }
}

/**
 * 预览 URL：/preview.html?type=&style=&page=（工作台同源 iframe）
 *
 * `embed: true` 时追加 `embed=1`（P8-2 语义：隐藏预览自带的风格切换器与 mock 角标，
 * 由工作台自己提供风格切换）；默认 false，保持既有调用行为不变。
 */
export function buildPreviewUrl({ applicationType = '', style = '', page = '', embed = false } = {}) {
  if (!applicationType) return ''
  const query = new URLSearchParams()
  query.set('type', applicationType)
  if (style) query.set('style', style)
  query.set('page', page || DEFAULT_PREVIEW_PAGE)
  if (embed) query.set('embed', '1')
  return `/preview.html?${query.toString()}`
}

/**
 * 设计产物模板风格预览 URL（D1）：`/design-preview.html?app=&page=&type=&style=&v=&embed=1`
 *
 * 以 `pages.json` 该页为渲染输入（不是模板自带页面），`v` 传 designHash 用于缓存失效。
 * 缺少 app/page/type 时返回空串（父面板回退结构草图）。
 */
export function buildDesignPreviewUrl({
  appId = '',
  pageId = '',
  applicationType = '',
  style = '',
  designHash = '',
  embed = true
} = {}) {
  if (!appId || !pageId || !applicationType) return ''
  const query = new URLSearchParams()
  query.set('app', appId)
  query.set('page', pageId)
  query.set('type', applicationType)
  if (style) query.set('style', style)
  if (designHash) query.set('v', designHash)
  if (embed) query.set('embed', '1')
  return `/design-preview.html?${query.toString()}`
}
