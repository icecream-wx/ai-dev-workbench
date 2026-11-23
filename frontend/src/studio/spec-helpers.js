/**
 * 模板工作室纯函数（P7-7b-2a）：页面清单 / 校验摘要 / 生成报告 / 模型与确认文案。
 *
 * 不依赖 Vue / DOM / 网络，便于 node --test。
 */

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

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

export function draftStatusLabel(status) {
  return status === 'published' ? '已发布' : '草稿'
}

/** 草稿版本：优先已发布版本；未发布显示草稿 */
export function draftVersionLabel(draft) {
  const version = text(draft?.publishedVersion) || text(draft?.version)
  if (version) return `v${version.replace(/^v/i, '')}`
  return draft?.status === 'published' ? '已发布' : '草稿'
}

/** spec 里的页面项补 kind/source 摘要（未生成时也能列页面） */
function specPageRow(page, index) {
  const id = text(page?.id) || `page-${index + 1}`
  const source = page?.source && typeof page.source === 'object' ? page.source : null
  const kind = text(page?.kind)
  return {
    id,
    name: text(page?.name) || id,
    kind: kind === 'reference' || kind === 'contract' ? kind : 'blueprint',
    recipe: text(page?.recipe) || text(page?.type),
    source: source ? [text(source.applicationType), text(source.pageId)].filter(Boolean).join('/') : '',
    generated: false
  }
}

/**
 * 页面清单：已生成时用 pack 的页面（真实 kind/recipe/source）；
 * 否则用 spec 页面（可能为空 → 「让 agent 先确定页面清单」）。
 */
export function draftPageRows(detail) {
  const packPages = asArray(detail?.packSummary?.pages)
  if (packPages.length) {
    return packPages.map((page, index) => ({
      id: text(page?.id) || `page-${index + 1}`,
      name: text(page?.name) || text(page?.id),
      kind: pageKindOf(page),
      recipe: text(page?.recipe),
      source: text(page?.source),
      generated: true
    }))
  }
  return asArray(detail?.spec?.pages).map(specPageRow)
}

/** spec 是否存在页面（空 pages 生成会报 page-count） */
export function specPageCount(detail) {
  return asArray(detail?.spec?.pages).length
}

/**
 * 校验摘要：spec 校验 + 生成报告 + 发布响应里的错误/警告。
 * @param detail 草稿详情（`DraftDetail`）
 * @param extra 可选的额外 errors/warnings（如生成 400 响应）
 */
export function validationItems(detail, extra = null) {
  const items = []
  const pushList = (list, kind, source) => {
    for (const issue of asArray(list)) {
      const code = text(issue?.code)
      const message = text(issue?.message)
      if (!code && !message) continue
      items.push({
        kind,
        source,
        code,
        path: text(issue?.path) || '$',
        message: message || code
      })
    }
  }
  pushList(detail?.validation?.errors, 'error', 'spec')
  pushList(detail?.validation?.warnings, 'warning', 'spec')
  pushList(detail?.generation?.errors, 'error', 'generation')
  pushList(detail?.generation?.warnings, 'warning', 'generation')
  if (extra) {
    pushList(extra.errors, 'error', 'generate')
    pushList(extra.warnings, 'warning', 'generate')
  }
  return items
}

export function validationSummary(items) {
  const errors = asArray(items).filter((item) => item.kind === 'error').length
  const warnings = asArray(items).filter((item) => item.kind === 'warning').length
  return { errors, warnings, ok: errors === 0 }
}

/** 生成报告里的 CSS 摘要（来源/规则/去重/冲突） */
export function cssSummary(generation) {
  const css = generation?.css && typeof generation.css === 'object' ? generation.css : {}
  const sources = asArray(css.sources ?? generation?.sources).map((item) => String(item))
  return {
    sources,
    rules: Number.isFinite(Number(css.rules)) ? Number(css.rules) : 0,
    deduped: Number.isFinite(Number(css.deduped)) ? Number(css.deduped) : 0,
    conflicts: asArray(css.conflicts).map((item) => String(item))
  }
}

/** 冲突展示：最多 limit 条 + 剩余数量 */
export function conflictPreview(conflicts, limit = 3) {
  const list = asArray(conflicts).map((item) => String(item))
  return { shown: list.slice(0, limit), more: Math.max(0, list.length - limit), total: list.length }
}

/** 时间显示（服务端 ISO → 本地 MM-DD HH:mm:ss；非法原样） */
export function formatDateTime(value) {
  const raw = text(value)
  if (!raw) return '—'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  const two = (num) => String(num).padStart(2, '0')
  return `${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`
}

/** 模型下拉 value（空串 = 默认/回退模型） */
export function modelKey(model) {
  if (!model || !text(model.providerID) || !text(model.id)) return ''
  return `${text(model.providerID)}/${text(model.id)}`
}

export function modelLabel(model) {
  if (!model) return ''
  const name = text(model.name) || text(model.modelID) || text(model.id)
  const provider = text(model.providerID) || text(model.providerId)
  return provider ? `${name}（${provider}）` : name
}

/** 从手选值拆回 {providerID,id}（PUT studio model） */
export function modelRefOf(value) {
  const raw = text(value)
  if (!raw || !raw.includes('/')) return null
  const index = raw.indexOf('/')
  const providerID = raw.slice(0, index)
  const id = raw.slice(index + 1)
  return providerID && id ? { providerID, id } : null
}

/** template-preview.html URL（工作室 iframe，草稿预览） */
export function previewUrlOf(packId, pageId) {
  const id = text(packId)
  if (!id) return ''
  const query = new URLSearchParams()
  query.set('draft', id)
  if (text(pageId)) query.set('page', text(pageId))
  query.set('embed', '1')
  return `/template-preview.html?${query.toString()}`
}

/** 发布二次确认文案（版本将 +1；应用下次打开同步） */
export function publishConfirmText(draft) {
  const name = text(draft?.name) || text(draft?.id) || '当前模板'
  const current = text(draft?.publishedVersion)
  const next = current ? `版本 ${current} → 下一个小版本` : '首次发布为 1.0.0'
  return `发布「${name}」？${next}。\n已引用该模板的应用下次打开时同步新版本；发布不会自动同步正在开发的会话。`
}

/** 丢弃/删除确认文案（已发布草稿只删工作副本，保留模板） */
export function discardConfirmText(draft) {
  const name = text(draft?.name) || text(draft?.id) || '当前模板'
  if (draft?.status === 'published') {
    return `丢弃「${name}」的草稿工作副本？已发布模板会保留，可稍后从模板重新编辑。`
  }
  return `丢弃「${name}」的草稿？草稿目录会被删除，不可恢复（不会影响已发布模板/应用）。`
}
