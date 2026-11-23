/**
 * 自定义模板预览纯函数（P7-7b-2a，`template-preview.html`）。
 *
 * - URL/资产地址：草稿（`/api/design-templates/drafts/:id`）与已发布（`/api/design-system/:id`）两套口径；
 * - pack 页面元数据 → reference（iframe `preview.html`）/ contract（synthetic design）；
 * - contract 展平：`page.contract` 的 filters/columns/rowActions/toolbarActions/selection/pagination/
 *   form/tree/subTables/components 展平为 design.json 页面字段（`components` 仍是 object）；
 * - 不依赖 Vue / DOM / 网络，便于 node --test。
 */

export const TEMPLATE_PREVIEW_ENTRY = '/template-preview.html'

/** 内置应用类型 → 短根类（与 design-preview 的 SHORT_TYPE_CLASS 对齐） */
export const SHORT_TYPE_CLASS = {
  'enterprise-application-platform': 'application-type-enterprise-platform',
  'operations-management': 'application-type-operations',
  'data-governance-workbench': 'application-type-data-governance',
  'incident-response-console': 'application-type-incident-response'
}

/** design-adapter 支持的页面类型（其余按配方/契约降级） */
const PAGE_TYPES = ['list', 'form', 'detail', 'dashboard', 'kanban', 'gantt', 'calendar']

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

/**
 * URL 参数：`?draft=<packId>&page=<pageId>&embed=1` 或 `?pack=<packId>&page=<pageId>&embed=1`。
 * 两个都给时草稿优先（工作室内默认预览草稿）。
 */
export function resolveTemplatePreviewParams(search) {
  const query = new URLSearchParams(search || '')
  const draftId = text(query.get('draft'))
  const packIdRaw = text(query.get('pack'))
  const embedRaw = text(query.get('embed')).toLowerCase()
  return {
    mode: draftId ? 'draft' : packIdRaw ? 'pack' : '',
    packId: draftId || packIdRaw,
    pageId: text(query.get('page')),
    embed: embedRaw === '1' || embedRaw === 'true'
  }
}

/** 草稿详情（spec/validation/generation/pack 摘要） */
export function draftDetailUrl(packId) {
  return `/api/design-templates/drafts/${encodeURIComponent(packId)}`
}

/** 已发布 pack（完整 pack.json，含 kind/source/contract/sampleEntity） */
export function publishedPackUrl(packId) {
  return `/api/design-system/${encodeURIComponent(packId)}`
}

/**
 * 草稿/已发布 pack 的只读资产 URL；`path` 相对 pack 根（如 `application-types/<packId>/structure.css`）。
 * 后端资产接口只允许 `.css/.svg/.png/.jpg/.jpeg`，`pack.json` 不通过该接口读取。
 */
export function templateAssetUrl(mode, packId, path) {
  const id = text(packId)
  const relative = text(path).replace(/^\/+/, '')
  if (!id || !relative) return ''
  const suffix = `asset?path=${encodeURIComponent(relative)}`
  if (mode === 'draft') return `/api/design-templates/drafts/${encodeURIComponent(id)}/${suffix}`
  return `/api/design-system/${encodeURIComponent(id)}/${suffix}`
}

/** 合并后的 structure.css 资产 URL */
export function structureCssUrl(mode, packId) {
  return templateAssetUrl(mode, packId, `application-types/${text(packId)}/structure.css`)
}

/** 页面 kind（老内置页缺省按 blueprint 兼容） */
export function pageKindOf(page) {
  const kind = text(page?.kind)
  if (kind === 'reference' || kind === 'contract' || kind === 'blueprint') return kind
  return 'blueprint'
}

export function pageKindLabel(kind) {
  if (kind === 'reference') return '引用页'
  if (kind === 'contract') return '契约页'
  return '蓝图页'
}

/** 展平 pack 所有页面（保留 applicationType/顺序） */
export function packPages(pack) {
  const out = []
  for (const type of asArray(pack?.applicationTypes)) {
    for (const page of asArray(type?.pages)) {
      out.push({
        ...page,
        id: text(page?.id),
        name: text(page?.name) || text(page?.id),
        applicationType: text(type?.id),
        kind: pageKindOf(page)
      })
    }
  }
  return out
}

export function findPackPage(pack, pageId) {
  const id = text(pageId)
  if (!id) return null
  return packPages(pack).find((page) => page.id === id) || null
}

/** pack 主风格 id（自定义 pack 复制内置风格） */
export function packStyleId(pack) {
  return text(asArray(pack?.styles)[0]?.id) || text(pack?.defaultStyle)
}

/** 自定义类型根类：用 baseApplicationType 的短类，自定义 pack id 不参与类名 */
export function shortTypeClassFor(baseApplicationType) {
  const id = text(baseApplicationType) || 'enterprise-application-platform'
  return SHORT_TYPE_CLASS[id] || `application-type-${id}`
}

/**
 * contract 页在 synthetic design 里的 `type`：优先合法值，否则按配方/契约降级
 * （tree-list → list、dialog-form/page-form/wizard → form、其余 → detail）。
 */
export function contractPageType(page) {
  const raw = text(page?.type)
  if (PAGE_TYPES.includes(raw)) return raw
  if (raw === 'tree-list') return 'list'
  const recipe = text(page?.recipe)
  if (recipe === 'list' || recipe === 'tree-list') return 'list'
  if (recipe === 'dialog-form' || recipe === 'page-form' || recipe === 'wizard') return 'form'
  if (recipe === 'dashboard') return 'dashboard'
  return 'detail'
}

/**
 * 把 `page.contract` 展平为 design.json 页面字段。
 * `components` 取自 `contract.components`（object：字段 → pm 组件）；缺失字段直接省略。
 */
export function flattenContract(page) {
  const contract = page?.contract && typeof page.contract === 'object' && !Array.isArray(page.contract)
    ? page.contract
    : {}
  const flattened = {
    id: text(page?.id),
    name: text(page?.name) || text(page?.id),
    title: text(page?.name) || text(page?.id),
    type: contractPageType(page),
    ...(text(page?.recipe) ? { recipe: text(page.recipe) } : {})
  }
  const entityId = text(page?.sampleEntity?.id)
  if (entityId) flattened.entity = entityId
  for (const key of ['filters', 'columns', 'rowActions', 'toolbarActions', 'selection', 'pagination', 'form', 'tree', 'subTables']) {
    if (contract[key] !== undefined && contract[key] !== null) flattened[key] = contract[key]
  }
  if (contract.components && typeof contract.components === 'object' && !Array.isArray(contract.components)) {
    flattened.components = contract.components
  }
  return flattened
}

/** synthetic design：`{designSystem,entities:[sampleEntity,...sampleSubEntities],pages:[flattenContract]}` */
export function syntheticDesign(pack, page) {
  const sampleEntity = page?.sampleEntity
  const entities = [sampleEntity, ...asArray(page?.sampleSubEntities)]
    .filter((entity) => entity && typeof entity === 'object' && text(entity.id))
    .map((entity) => ({ ...entity }))
  const typeId = text(pack?.id)
  return {
    designSystem: {
      pack: typeId,
      applicationType: typeId,
      ...(packStyleId(pack) ? { style: packStyleId(pack) } : {})
    },
    entities,
    pages: [flattenContract(page)]
  }
}

/**
 * reference 页 iframe URL：内置 `preview.html` 渲染内置源页，
 * 结构样式用合并后的 `structure.css` 覆盖（草稿 structureDraft / 已发布 structurePack）。
 */
export function referencePreviewUrl({ mode = 'draft', packId = '', page = null, styleId = '', embed = true } = {}) {
  const source = page?.source
  const sourceType = text(source?.applicationType)
  const sourcePage = text(source?.pageId)
  if (!sourceType || !sourcePage) return ''
  const query = new URLSearchParams()
  query.set('type', sourceType)
  if (text(styleId)) query.set('style', text(styleId))
  query.set('page', sourcePage)
  if (embed) query.set('embed', '1')
  if (mode === 'draft' && text(packId)) query.set('structureDraft', text(packId))
  else if (mode === 'pack' && text(packId)) query.set('structurePack', text(packId))
  return `/preview.html?${query.toString()}`
}

/** 本入口 URL（工作室 iframe 用） */
export function templatePreviewUrl({ mode = 'draft', packId = '', pageId = '', embed = true } = {}) {
  const id = text(packId)
  if (!id) return ''
  const query = new URLSearchParams()
  query.set(mode === 'pack' ? 'pack' : 'draft', id)
  if (text(pageId)) query.set('page', text(pageId))
  if (embed) query.set('embed', '1')
  return `${TEMPLATE_PREVIEW_ENTRY}?${query.toString()}`
}
