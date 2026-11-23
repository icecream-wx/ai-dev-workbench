/**
 * 预览 URL 参数解析（纯函数，便于单测）。
 *
 * ?type=<applicationType>&style=<styleId>&page=<pageId>
 * - 缺省：enterprise-application-platform / platform-blue / organization
 * - 非法值不白屏：回退到默认值，并返回可展示的提示
 * - 只给 type 时，风格/页面回退到该应用类型的默认风格与首页
 * - embed=1 仅供工作台 iframe 嵌入（隐藏风格切换器/角标，P8-2）
 */

export const DEFAULT_TYPE = 'enterprise-application-platform'
export const DEFAULT_STYLE = 'platform-blue'
export const DEFAULT_PAGE = 'organization'

function findType(meta, id) {
  return meta.applicationTypes.find((item) => item.id === id) || null
}

function findStyle(meta, id) {
  return meta.styles.find((item) => item.id === id) || null
}

function findPage(typeMeta, id) {
  return typeMeta.pages.find((item) => item.id === id) || null
}

function preferredPage(typeMeta) {
  return findPage(typeMeta, DEFAULT_PAGE) || typeMeta.pages[0] || null
}

/**
 * 结构样式覆盖（P7-7b-2a）：`structurePack=<packId>`（已发布）/`structureDraft=<packId>`（草稿）。
 *
 * reference 页仍是内置源类型页面，只把注入的 `structure.css` 换成自定义 pack 合并后的文件；
 * 两个参数同时给时以草稿优先（工作室内预览草稿优先）。
 * @returns {{mode:'draft'|'pack'|'', packId:string}}
 */
export function resolveStructureOverride(search) {
  const query = new URLSearchParams(search || '')
  const draftId = String(query.get('structureDraft') || '').trim()
  if (draftId) return { mode: 'draft', packId: draftId }
  const packId = String(query.get('structurePack') || '').trim()
  if (packId) return { mode: 'pack', packId }
  return { mode: '', packId: '' }
}

/** 结构样式资产 URL（path 固定 `application-types/<packId>/structure.css`） */
export function structureAssetUrl(override) {
  const packId = String(override?.packId || '').trim()
  if (!packId) return ''
  const assetPath = `application-types/${packId}/structure.css`
  const suffix = `asset?path=${encodeURIComponent(assetPath)}`
  if (override.mode === 'draft') {
    return `/api/design-templates/drafts/${encodeURIComponent(packId)}/${suffix}`
  }
  return `/api/design-system/${encodeURIComponent(packId)}/${suffix}`
}

/** 把结构覆盖参数写回 URLSearchParams（切换风格/页面后仍保留） */
export function applyStructureOverride(query, override) {
  if (!override?.packId) return query
  if (override.mode === 'draft') query.set('structureDraft', override.packId)
  else if (override.mode === 'pack') query.set('structurePack', override.packId)
  return query
}

/**
 * 嵌入模式（P8-2）：`embed=1` / `embed=true` 时为真，用于隐藏预览自带的
 * 底部风格切换器与 mock 角标；只影响展示，不改 type/style/page 语义。
 */
export function embedEnabled(search) {
  const value = new URLSearchParams(search || '').get('embed')
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

/**
 * @param {string} search window.location.search（或任意 query 串）
 * @param {{ applicationTypes: Array, styles: Array }} meta 预览模板元数据
 */
export function resolvePreviewParams(search, meta) {
  const query = new URLSearchParams(search || '')
  const warnings = []

  const requestedType = query.get('type') || ''
  let typeMeta = requestedType ? findType(meta, requestedType) : null
  if (requestedType && !typeMeta) {
    warnings.push(`未知应用类型 “${requestedType}”，已回退到 ${DEFAULT_TYPE}`)
  }
  if (!typeMeta) typeMeta = findType(meta, DEFAULT_TYPE) || meta.applicationTypes[0]

  const requestedStyle = query.get('style') || ''
  let styleMeta = requestedStyle ? findStyle(meta, requestedStyle) : null
  if (requestedStyle && !styleMeta) {
    warnings.push(`未知视觉风格 “${requestedStyle}”，已回退到 ${typeMeta.defaultStyle}`)
  }
  if (!styleMeta) styleMeta = findStyle(meta, typeMeta.defaultStyle) || findStyle(meta, DEFAULT_STYLE) || meta.styles[0]

  const requestedPage = query.get('page') || ''
  let pageMeta = requestedPage ? findPage(typeMeta, requestedPage) : null
  if (requestedPage && !pageMeta) {
    const fallback = preferredPage(typeMeta)
    warnings.push(
      `应用类型 “${typeMeta.id}” 下不存在页面 “${requestedPage}”，已回退到 ${fallback ? fallback.id : '（无页面）'}`
    )
  }
  if (!pageMeta) pageMeta = preferredPage(typeMeta)

  return {
    typeId: typeMeta.id,
    styleId: styleMeta.id,
    pageId: pageMeta ? pageMeta.id : '',
    typeMeta,
    styleMeta,
    pageMeta,
    warnings
  }
}
