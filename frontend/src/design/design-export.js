/**
 * 设计参考包导出纯函数（应用级，D1 去模块；不依赖 Vue/DOM）
 *
 * - 页面 id 安全化（后端只接受 [A-Za-z0-9._-]{1,80}）
 * - 构造 POST /apps/:id/design/prototypes 的 payload
 * - designHash 由后端 artifacts.designHash 提供（entities + pages + design-system）
 * - 解析 prototypes manifest / 判断 stale
 */

const PAGE_ID_PATTERN = /[^A-Za-z0-9._-]/g

export function safePageId(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.replace(PAGE_ID_PATTERN, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

/** 保序、安全化、去重；空 id 用 page-<n> */
export function normalizeExportPages(pages) {
  const list = Array.isArray(pages) ? pages : []
  const used = new Set()
  return list
    .filter(page => page && typeof page.dataUrl === 'string' && page.dataUrl.startsWith('data:image/png;base64,'))
    .map((page, index) => {
      const base = safePageId(page.id) || `page-${index + 1}`
      let id = base
      let suffix = 2
      while (used.has(id)) {
        const tail = `-${suffix}`
        id = `${base.slice(0, Math.max(1, 80 - tail.length))}${tail}`
        suffix += 1
      }
      used.add(id)
      return {
        id,
        dataUrl: page.dataUrl,
        ...(typeof page.pageSet === 'string' && page.pageSet.trim() ? { pageSet: page.pageSet.trim() } : {})
      }
    })
}

/** 无有效页面/缺少 hash/styleId → null（调用方不导出） */
export function buildPrototypePayload(input = {}) {
  const designHash = typeof input.designHash === 'string' ? input.designHash.trim() : ''
  const styleId = typeof input.styleId === 'string' ? input.styleId.trim() : ''
  const pages = normalizeExportPages(input.pages)
  if (!designHash || !styleId || !pages.length) return null
  return { designHash, styleId, pages }
}

/** 兼容旧调用：currentDesignHash 直接来自 artifacts.designHash */
export function designHashOf(artifactsOrHash) {
  if (typeof artifactsOrHash === 'string') return artifactsOrHash.trim()
  const value = artifactsOrHash && typeof artifactsOrHash === 'object' ? artifactsOrHash.designHash : ''
  return typeof value === 'string' ? value : ''
}

/** 接受 artifacts.prototypes（对象）或原始 manifest（pages 对象） */
export function parsePrototypeArtifact(raw) {
  if (!raw || typeof raw !== 'object') return null
  const nested = raw.prototypes && typeof raw.prototypes === 'object' ? raw.prototypes : raw
  const designHash = typeof nested.designHash === 'string' ? nested.designHash : ''
  const styleId = typeof nested.styleId === 'string' ? nested.styleId : ''
  const exportedAt = typeof nested.exportedAt === 'string' ? nested.exportedAt : ''
  const pages = []
  const source = nested.pages
  if (Array.isArray(source)) {
    for (const page of source) {
      if (!page || typeof page !== 'object') continue
      const id = typeof page.id === 'string' ? page.id : ''
      if (!id) continue
      pages.push({
        id,
        file: typeof page.file === 'string' ? page.file : '',
        hash: typeof page.hash === 'string' ? page.hash : '',
        ...(typeof page.pageSet === 'string' && page.pageSet ? { pageSet: page.pageSet } : {})
      })
    }
  } else if (source && typeof source === 'object') {
    for (const [id, page] of Object.entries(source)) {
      if (!page || typeof page !== 'object') continue
      pages.push({
        id,
        file: typeof page.file === 'string' ? page.file : '',
        hash: typeof page.hash === 'string' ? page.hash : '',
        ...(typeof page.pageSet === 'string' && page.pageSet ? { pageSet: page.pageSet } : {})
      })
    }
  }
  pages.sort((left, right) => left.id.localeCompare(right.id))
  return { designHash, styleId, exportedAt, pages }
}

/** 没有 manifest、没有页面、hash 不一致或后端标记 stale → 需要导出 */
export function needsPrototypeExport(prototypes, currentHash) {
  const artifact = parsePrototypeArtifact(prototypes)
  if (!artifact || !artifact.pages.length) return true
  if (!currentHash) return true
  return artifact.designHash !== currentHash
}

export function isPrototypeStale(prototypes, currentHash) {
  const artifact = parsePrototypeArtifact(prototypes)
  if (!artifact || !artifact.pages.length) return false
  return artifact.designHash !== currentHash
}

/** “N 页 · 导出时间”摘要；无导出返回空串 */
export function prototypeSummary(prototypes) {
  const artifact = parsePrototypeArtifact(prototypes)
  if (!artifact || !artifact.pages.length) return ''
  return `${artifact.pages.length} 页 · 导出于 ${artifact.exportedAt || '—'}`
}
