/**
 * P7-7c：自定义模板的 design-preview 映射（纯函数）
 *
 * 输入 `GET /api/apps/:id/design-system` 的 summary；输出自定义预览所需的
 * base 应用类型 / 结构样式 URL / 风格类 / 类型显示名。
 * 内置 pack（无 preview）返回 null，调用方走 preview registry。
 */

/** 自定义模板页面根类短名（内置 4 类型；自定义只用 base） */
export const SHORT_TYPE_CLASS = {
  'enterprise-application-platform': 'application-type-enterprise-platform',
  'operations-management': 'application-type-operations',
  'data-governance-workbench': 'application-type-data-governance',
  'incident-response-console': 'application-type-incident-response'
}

export function shortTypeClassOf(baseApplicationType) {
  const id = String(baseApplicationType || '').trim()
  if (!id) return ''
  return SHORT_TYPE_CLASS[id] || `application-type-${id}`
}

/**
 * @param {object|null|undefined} designSystem
 * @param {{typeId?: string}} [options]
 * @returns {{kind:'custom', typeId:string, baseApplicationType:string, shortTypeClass:string, structureUrl:string, styleClassName:string, typeName:string} | null}
 */
export function resolveCustomPreview(designSystem, { typeId = '' } = {}) {
  const preview = designSystem?.preview
  if (!preview || preview.kind !== 'custom') return null
  const base = String(preview.baseApplicationType || '').trim()
  return {
    kind: 'custom',
    typeId: String(typeId || designSystem?.applicationType?.id || ''),
    baseApplicationType: base,
    shortTypeClass: shortTypeClassOf(base),
    structureUrl: String(preview.structureUrl || ''),
    styleClassName: String(preview.styleClassName || ''),
    typeName: String(designSystem?.applicationType?.name || '')
  }
}
