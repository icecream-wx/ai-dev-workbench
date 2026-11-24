/**
 * 设计产物（entities.json + pages.json）→ 渲染契约（D1）
 *
 * 输入可以是：
 * - `artifacts`（GET /api/apps/:id/artifacts）：用 `adaptArtifacts(artifacts)` 得到 design-like 后适配；
 * - 或直接一个 design-like 对象 `{ entities, relations, pages, pageSets?, designSystem? }`
 *   （模板工作室的 synthetic design 仍走这里）。
 *
 * 规则：
 * - `pages.json` 的 `pageSets[]` 是页面集（= Epic）；缺省时把 `pages[]` 当作一个匿名页面集（兼容 synthetic design）；
 * - 页面 `entity` 引用实体 id；未知实体 → entityId=null + warning；
 * - 字段 `code` 是渲染键、`name` 是中文显示名；旧数据（只有 name）按 name 当 code 兼容；
 * - 未知页面类型降级 `list` + warning；重复实体/页面 id 保留第一个 + warning；
 * - 纯函数，不依赖 Vue/DOM，便于 node --test。
 */

export const PAGE_TYPES = ['list', 'form', 'detail', 'dashboard', 'kanban', 'gantt', 'calendar']
/** P7 页面配方（来自设计模板包 pageRecipes） */
export const PAGE_RECIPES = ['list', 'tree-list', 'dialog-form', 'page-form', 'main-sub', 'detail', 'dashboard', 'wizard']
export const PAGINATION_LAYOUTS = ['bar', 'split', 'three-part']
export const FORM_PRESENTATIONS = ['dialog', 'page']
export const SUB_TABLE_MODES = ['tab', 'flow']
const RELATION_TYPES = ['1:1', '1:N', 'N:1', 'N:M']

/** er-layout 仍按旧类型名取基数字；这里做一次映射 */
const LEGACY_RELATION = {
  '1:1': 'one-to-one',
  '1:N': 'one-to-many',
  'N:1': 'many-to-one',
  'N:M': 'many-to-many'
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function stringList(value) {
  return asArray(value).map(item => String(item))
}

function positiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0
}

/** 应用级设计系统摘要：只保留 pack/applicationType/style；没有内容时返回 null */
function normalizeDesignSystem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const pack = text(raw.pack)
  const applicationType = text(raw.applicationType)
  const style = text(raw.style)
  if (!pack && !applicationType && !style) return null
  return {
    ...(pack ? { pack } : {}),
    ...(applicationType ? { applicationType } : {}),
    ...(style ? { style } : {})
  }
}

function normalizePagination(raw, pageId, warnings) {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push(`页面 ${pageId} 的 pagination 不是对象，已忽略`)
    return null
  }
  const layout = text(raw.layout)
  const validLayout = layout && PAGINATION_LAYOUTS.includes(layout) ? layout : ''
  if (layout && !validLayout) {
    warnings.push(`页面 ${pageId} 的分页形态 ${layout} 不受支持，已忽略`)
  }
  let pageSize = 0
  if (raw.pageSize !== undefined) {
    pageSize = positiveInteger(raw.pageSize)
    if (!pageSize) warnings.push(`页面 ${pageId} 的 pagination.pageSize 不是正整数，已忽略`)
  }
  if (!validLayout && !pageSize) return null
  return {
    ...(validLayout ? { layout: validLayout } : {}),
    ...(pageSize ? { pageSize } : {})
  }
}

function normalizeForm(raw, pageId, warnings) {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push(`页面 ${pageId} 的 form 不是对象，已忽略`)
    return null
  }
  const form = {}
  const presentation = text(raw.presentation)
  if (presentation && !FORM_PRESENTATIONS.includes(presentation)) {
    warnings.push(`页面 ${pageId} 的表单形态 ${presentation} 不受支持，已忽略`)
  } else if (presentation) {
    form.presentation = presentation
  }
  if (raw.columns !== undefined) {
    if (raw.columns === 1 || raw.columns === 2) form.columns = raw.columns
    else warnings.push(`页面 ${pageId} 的 form.columns 只能是 1 或 2，已忽略`)
  }
  if (raw.width !== undefined) {
    const width = positiveInteger(raw.width)
    if (width) form.width = width
    else warnings.push(`页面 ${pageId} 的 form.width 不是正整数，已忽略`)
  }
  const fields = stringList(raw.fields)
  if (fields.length) form.fields = fields
  const groups = []
  if (raw.groups !== undefined && !Array.isArray(raw.groups)) {
    warnings.push(`页面 ${pageId} 的 form.groups 不是数组，已忽略`)
  }
  for (const group of asArray(raw.groups)) {
    if (!group || typeof group !== 'object') {
      warnings.push(`页面 ${pageId} 的 form.groups 项不是对象，已跳过`)
      continue
    }
    const title = text(group.title)
    const groupFields = stringList(group.fields)
    if (!title && !groupFields.length) continue
    groups.push({ ...(title ? { title } : {}), ...(groupFields.length ? { fields: groupFields } : {}) })
  }
  if (groups.length) form.groups = groups
  return Object.keys(form).length ? form : null
}

function normalizeTree(raw, pageId, warnings) {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push(`页面 ${pageId} 的 tree 不是对象，已忽略`)
    return null
  }
  const tree = {}
  for (const key of ['titleField', 'parentField', 'actionStyle', 'selectionStyle']) {
    const value = text(raw[key])
    if (value) tree[key] = value
  }
  return Object.keys(tree).length ? tree : null
}

/** pages.json subTables（entity）→ 线框 PageLayout.subTables（target） */
function normalizeSubTables(raw, pageId, warnings) {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    warnings.push(`页面 ${pageId} 的 subTables 不是数组，已忽略`)
    return []
  }
  const subTables = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      warnings.push(`页面 ${pageId} 的 subTables 项不是对象，已跳过`)
      continue
    }
    const entity = text(item.entity)
    if (!entity) {
      warnings.push(`页面 ${pageId} 的 subTables 项缺少 entity，已跳过`)
      continue
    }
    const title = text(item.title)
    const columns = stringList(item.columns)
    const mode = text(item.mode)
    if (mode && !SUB_TABLE_MODES.includes(mode)) {
      warnings.push(`页面 ${pageId} 的子表 ${entity} 的 mode ${mode} 不受支持，已忽略`)
    }
    subTables.push({
      target: entity,
      ...(title ? { title } : {}),
      ...(columns.length ? { columns } : {}),
      ...(mode && SUB_TABLE_MODES.includes(mode) ? { mode } : {})
    })
  }
  return subTables
}

/** 页面级 actionTargets：动作码 → 同页面集目标页面 id（对象、键/值非空字符串；保留未知动作键） */
function normalizeActionTargets(raw, pageId, warnings) {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push(`页面 ${pageId} 的 actionTargets 不是对象，已忽略`)
    return null
  }
  const targets = {}
  for (const [key, value] of Object.entries(raw)) {
    const action = text(key)
    const target = text(value)
    if (!action || !target) {
      warnings.push(`页面 ${pageId} 的 actionTargets.${key || '(空)'} 不是非空字符串，已跳过`)
      continue
    }
    targets[action] = target
  }
  return Object.keys(targets).length ? targets : null
}

function normalizeComponents(raw, pageId, warnings) {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push(`页面 ${pageId} 的 components 不是对象，已忽略`)
    return null
  }
  const components = {}
  for (const [field, value] of Object.entries(raw)) {
    const component = text(value)
    if (!text(field) || !component) {
      warnings.push(`页面 ${pageId} 的 components.${field || '(空)'} 不是非空字符串，已跳过`)
      continue
    }
    components[text(field)] = component
  }
  return Object.keys(components).length ? components : null
}

/** 未提供 actions 时合并 toolbarActions + rowActions，供现有渲染器使用（去重保序） */
function mergeActions(toolbarActions, rowActions) {
  const merged = []
  for (const action of [...toolbarActions, ...rowActions]) {
    if (!merged.includes(action)) merged.push(action)
  }
  return merged
}

/** 枚举选项：显示 labels（渲染用）与接口 values（mock 行键值仍用 label） */
function normalizeOptions(raw, warnings, entityId, fieldCode) {
  const options = []
  const optionValues = []
  for (const item of asArray(raw)) {
    if (item && typeof item === 'object') {
      const value = text(item.value)
      const label = text(item.label) || value
      if (!label) continue
      options.push(label)
      optionValues.push(value || label)
    } else if (typeof item === 'string' && item.trim()) {
      options.push(item.trim())
      optionValues.push(item.trim())
    }
  }
  if (!options.length && raw !== undefined) warnings.push(`实体 ${entityId} 的枚举字段 ${fieldCode} 的 options 为空，已忽略`)
  return { options, optionValues }
}

function normalizeFields(rawFields, entityId, warnings) {
  const fields = []
  const seen = new Set()
  for (const raw of asArray(rawFields)) {
    if (!raw || typeof raw !== 'object') {
      warnings.push(`实体 ${entityId} 的字段项不是对象，已跳过`)
      continue
    }
    const code = text(raw.code) || text(raw.name)
    const display = text(raw.label) || text(raw.name) || code
    if (!code) {
      warnings.push(`实体 ${entityId} 有字段缺少 code/name，已跳过`)
      continue
    }
    if (seen.has(code)) {
      warnings.push(`实体 ${entityId} 的字段 code 重复：${code}（保留第一个）`)
      continue
    }
    seen.add(code)
    const type = text(raw.type) || 'string'
    if (!text(raw.type)) warnings.push(`字段 ${entityId}.${code} 缺少 type，按 string 渲染`)
    const enumOptions = type === 'enum' ? normalizeOptions(raw.options, warnings, entityId, code) : { options: [], optionValues: [] }
    fields.push({
      code,
      /** 渲染键（各渲染器用 field.name；等于字段 code） */
      name: code,
      /** 中文显示名 */
      label: display,
      type,
      ...(raw.required === true ? { required: true } : {}),
      ...(raw.unique === true ? { unique: true } : {}),
      ...(enumOptions.options.length ? { options: enumOptions.options } : {}),
      ...(enumOptions.optionValues.length ? { optionValues: enumOptions.optionValues } : {}),
      ...(text(raw.ref) ? { ref: text(raw.ref) } : {}),
      ...(text(raw.note) ? { note: text(raw.note) } : {}),
      ...(raw.default !== undefined && raw.default !== null ? { default: raw.default } : {})
    })
  }
  return fields
}

/** 实体/关系（全局一张 ER） */
function normalizeEntities(rawEntities, warnings) {
  const entities = []
  const entityIds = new Set()
  for (const raw of asArray(rawEntities)) {
    if (!raw || typeof raw !== 'object') {
      warnings.push('实体项不是对象，已跳过')
      continue
    }
    const id = text(raw.id) || text(raw.name)
    if (!id) {
      warnings.push('实体缺少 id，已跳过')
      continue
    }
    if (entityIds.has(id)) {
      warnings.push(`实体 id 重复：${id}（保留第一个）`)
      continue
    }
    entityIds.add(id)
    entities.push({
      id,
      name: text(raw.name) || id,
      ...(text(raw.table) ? { table: text(raw.table), tableName: text(raw.table) } : {}),
      ...(text(raw.description) ? { description: text(raw.description) } : {}),
      fields: normalizeFields(raw.fields, id, warnings),
      status: 'confirmed',
      relations: []
    })
  }
  return { entities, entityIds }
}

function normalizeRelations(rawRelations, entityIds, warnings) {
  const relations = []
  const attached = new Map()
  for (const raw of asArray(rawRelations)) {
    if (!raw || typeof raw !== 'object') continue
    const from = text(raw.from)
    const to = text(raw.to)
    if (!from || !to) {
      warnings.push('关系缺少 from/to，已跳过')
      continue
    }
    if (!entityIds.has(from) || !entityIds.has(to)) {
      warnings.push(`关系 ${from} → ${to} 引用不存在的实体，当前不绘制`)
      continue
    }
    let type = text(raw.type)
    if (!RELATION_TYPES.includes(type)) {
      warnings.push(`关系 ${from} → ${to} 的类型 ${type || '(空)'} 不受支持，按 N:1 渲染`)
      type = 'N:1'
    }
    const label = text(raw.label)
    relations.push({ from, to, type, ...(label ? { label } : {}) })
    const list = attached.get(from) ?? []
    list.push({ target: to, type: LEGACY_RELATION[type], name: label })
    attached.set(from, list)
  }
  return { relations, attached }
}

/** pages.json 页面 → DesignPageRender（含页面集） */
function adaptPage(raw, pageSetId, epic, entityIds, warnings, pageIds) {
  let id = text(raw.id)
  if (!id) {
    id = `page-${pageIds.size + 1}`
    warnings.push(`页面缺少 id，已按 ${id} 渲染`)
  }
  if (pageIds.has(id)) {
    warnings.push(`页面 id 重复：${id}（保留第一个）`)
    return null
  }
  pageIds.add(id)
  const name = text(raw.name) || id
  const rawType = text(raw.type)
  let type = rawType
  if (!PAGE_TYPES.includes(type)) {
    warnings.push(`页面 ${id} 的类型 ${rawType || '(空)'} 不受支持，降级为 list`)
    type = 'list'
  }
  const entityRef = text(raw.entity)
  let entityId = null
  if (entityRef) {
    if (entityIds.has(entityRef)) entityId = entityRef
    else warnings.push(`页面 ${id} 引用的实体不存在：${entityRef}`)
  }
  const columns = asArray(raw.columns).map(item => String(item))
  if (raw.actions !== undefined) warnings.push(`页面 ${id} 不再使用 actions；已按 toolbarActions + rowActions 派生`)
  const filters = stringList(raw.filters)
  const rowActions = stringList(raw.rowActions)
  const toolbarActions = stringList(raw.toolbarActions)
  const selection = raw.selection === true ? true : raw.selection === false ? false : undefined
  const pagination = normalizePagination(raw.pagination, id, warnings)
  const form = normalizeForm(raw.form, id, warnings)
  const tree = normalizeTree(raw.tree, id, warnings)
  const subTables = normalizeSubTables(raw.subTables, id, warnings)
  const components = normalizeComponents(raw.components, id, warnings)
  const actionTargets = normalizeActionTargets(raw.actionTargets, id, warnings)
  const recipe = text(raw.recipe)
  if (recipe && !PAGE_RECIPES.includes(recipe)) {
    warnings.push(`页面 ${id} 的页面配方 ${recipe} 不受支持，已忽略`)
  }
  const catalogRef = text(raw.catalogRef)
  const blueprint = text(raw.blueprint)
  const actions = mergeActions(toolbarActions, rowActions)
  const table = {
    ...(columns.length ? { columns } : {}),
    ...(filters.length ? { searchFields: filters } : {}),
    ...(pagination?.pageSize ? { pageSize: pagination.pageSize } : {})
  }
  const page = {
    id,
    type,
    title: name,
    pageSetId,
    ...(epic ? { epic } : {}),
    entityId,
    ...(recipe && PAGE_RECIPES.includes(recipe) ? { recipe } : {}),
    ...(actionTargets ? { actionTargets } : {}),
    ...(catalogRef ? { catalogRef } : {}),
    ...(blueprint ? { blueprint } : {}),
    spec: {
      columns,
      actions,
      ...(filters.length ? { filters } : {}),
      ...(selection !== undefined ? { selection } : {}),
      ...(form?.fields?.length ? { fields: form.fields } : {}),
      ...(components ? { components } : {})
    },
    layout: {
      ...(Object.keys(table).length ? { table } : {}),
      ...(actions.length ? { toolbar: { actions } } : {}),
      ...(pagination ? { pagination } : {}),
      ...(selection !== undefined ? { selection } : {}),
      ...(rowActions.length ? { rowActions } : {}),
      ...(toolbarActions.length ? { toolbarActions } : {}),
      ...(form ? { form } : {}),
      ...(form?.groups?.length
        ? { groups: form.groups.map(group => ({ title: group.title ?? '', fields: [...(group.fields ?? [])] })) }
        : {}),
      ...(tree ? { tree } : {}),
      ...(subTables.length ? { subTables } : {}),
      ...(components ? { components } : {})
    }
  }
  const original = {
    id,
    name,
    type,
    ...(entityRef ? { entity: entityRef } : {}),
    ...(columns.length ? { columns } : {}),
    ...(actions.length ? { actions } : {}),
    ...(recipe && PAGE_RECIPES.includes(recipe) ? { recipe } : {}),
    ...(actionTargets ? { actionTargets } : {}),
    ...(catalogRef ? { catalogRef } : {}),
    ...(blueprint ? { blueprint } : {})
  }
  return { page, original }
}

/**
 * design-like 对象 → 渲染契约。
 * @param {{entities?: unknown[], relations?: unknown[], pages?: unknown[], pageSets?: unknown[], designSystem?: unknown}} design
 */
export function adaptDesign(design, options = {}) {
  const warnings = []
  const { entities, entityIds } = normalizeEntities(design?.entities, warnings)
  if (options.modules) warnings.push('模块模型已移除：entities/pages 为应用级，忽略 modules 选项')
  const { relations, attached } = normalizeRelations(design?.relations, entityIds, warnings)
  for (const entity of entities) entity.relations = attached.get(entity.id) ?? []

  const rawPageSets = asArray(design?.pageSets)
  const fallbackPages = asArray(design?.pages)
  const pageSets = []
  const pages = []
  const pageIds = new Set()

  const addSet = (rawSet, index) => {
    const id = text(rawSet?.id) || `page-set-${index + 1}`
    const epic = text(rawSet?.epic)
    const title = text(rawSet?.title) || id
    const originals = []
    for (const raw of asArray(rawSet?.pages)) {
      if (!raw || typeof raw !== 'object') {
        warnings.push('页面项不是对象，已跳过')
        continue
      }
      const adapted = adaptPage(raw, id, epic, entityIds, warnings, pageIds)
      if (!adapted) continue
      pages.push(adapted.page)
      originals.push(adapted.original)
    }
    pageSets.push({ id, ...(epic ? { epic } : {}), title, pages: originals })
  }

  if (rawPageSets.length) {
    rawPageSets.forEach((rawSet, index) => {
      if (!rawSet || typeof rawSet !== 'object') {
        warnings.push('页面集项不是对象，已跳过')
        return
      }
      addSet(rawSet, index)
    })
  } else {
    addSet({ id: 'app', title: text(design?.title) || '页面', pages: fallbackPages }, 0)
  }

  return {
    title: text(design?.title) || '应用设计',
    designSystem: normalizeDesignSystem(design?.designSystem),
    entities,
    relations,
    pageSets,
    pages,
    warnings
  }
}

/** GET /api/apps/:id/artifacts → adaptDesign 的 design-like 输入 */
export function designLikeOf(artifacts) {
  return {
    entities: asArray(artifacts?.entities?.entities),
    relations: asArray(artifacts?.entities?.relations),
    pageSets: asArray(artifacts?.pages?.pageSets),
    ...(artifacts?.designSystem ? { designSystem: artifacts.designSystem } : {})
  }
}

/** 设计产物计数摘要 */
export function designSummaryOf(artifacts) {
  if (!artifacts) return { hasDesign: false, entityCount: 0, pageCount: 0, errorCount: 0, pageSetCount: 0 }
  const entityCount = asArray(artifacts.entities?.entities).length
  const pageCount = asArray(artifacts.pages?.pages).length
  const pageSetCount = asArray(artifacts.pages?.pageSets).length
  const errorCount = asArray(artifacts.errors).length
  return { hasDesign: entityCount > 0 || pageCount > 0 || pageSetCount > 0, entityCount, pageCount, pageSetCount, errorCount }
}

/** 设计产物错误/警告 → 错误条行 */
export function designWarningsOf(artifacts) {
  const lines = []
  const push = message => {
    const value = String(message ?? '').trim()
    if (value) lines.push(value)
  }
  for (const warning of asArray(artifacts?.entities?.warnings)) push(`entities.json · 警告 · ${warning}`)
  for (const warning of asArray(artifacts?.pages?.warnings)) push(`pages.json · 警告 · ${warning}`)
  for (const warning of asArray(artifacts?.requirement?.warnings)) push(`requirements.md · 警告 · ${warning}`)
  return [...new Set(lines)]
}
