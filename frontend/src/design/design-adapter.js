/**
 * design.json → 渲染契约（P3/P4）
 *
 * 输入 `artifacts.designs[]` 的一项（已通过后端 schema 校验的错误会同时给出），
 * 输出 ErGraph / PrototypeCanvas 需要的实体、关系、页面集与页面渲染结构。
 *
 * 规则（brief §3）：
 * - `page.entity` 为本模块实体 → entityId；`MOD-xxx/entity` 或未知 → entityId=null + warning；
 * - 未知页面类型降级 `list` + warning；重复实体/页面 id 保留第一个 + warning；
 * - ER 只画本模块实体；跨模块关系只警告，不做聚合布局；
 * - 纯函数，不依赖 Vue/DOM，便于 node --test。
 */
import { sortModules } from '../workbench/requirements-helpers.js'

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

/** design.json subTables（entity）→ 线框 PageLayout.subTables（target） */
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

function moduleTitleOf(moduleKey, modules) {
  const found = asArray(modules).find(item => text(item?.key) === moduleKey)
  return found ? text(found.title) : ''
}

function normalizeFields(rawFields, entityId, warnings) {
  const fields = []
  for (const raw of asArray(rawFields)) {
    if (!raw || typeof raw !== 'object') {
      warnings.push(`实体 ${entityId} 的字段项不是对象，已跳过`)
      continue
    }
    const name = text(raw.name)
    if (!name) {
      warnings.push(`实体 ${entityId} 有字段缺少 name，已跳过`)
      continue
    }
    const type = text(raw.type) || 'string'
    if (!text(raw.type)) warnings.push(`字段 ${entityId}.${name} 缺少 type，按 string 渲染`)
    fields.push({
      name,
      label: text(raw.label) || name,
      type,
      ...(text(raw.label) ? { label: text(raw.label) } : {}),
      ...(raw.required === true ? { required: true } : {}),
      ...(raw.unique === true ? { unique: true } : {}),
      ...(asArray(raw.options).length ? { options: asArray(raw.options).map(item => String(item)) } : {}),
      ...(text(raw.ref) ? { ref: text(raw.ref) } : {}),
      ...(text(raw.note) ? { note: text(raw.note) } : {}),
      ...(raw.default !== undefined && raw.default !== null ? { default: raw.default } : {})
    })
  }
  return fields
}

/** 模块列表徽标用：设计状态摘要 */
export function designSummaryOf(design) {
  if (!design) return { hasDesign: false, entityCount: 0, pageCount: 0, errorCount: 0 }
  return {
    hasDesign: true,
    entityCount: asArray(design.entities).length,
    pageCount: asArray(design.pages).length,
    errorCount: asArray(design.errors).length
  }
}

export function adaptDesign(design, options = {}) {
  const warnings = []
  const moduleKey = text(design?.module)
  const title = text(design?.title) || moduleTitleOf(moduleKey, options.modules) || moduleKey || '未命名设计'
  const file = text(design?.file)
  const entities = []
  const entityIds = new Set()

  for (const raw of asArray(design?.entities)) {
    if (!raw || typeof raw !== 'object') {
      warnings.push('实体项不是对象，已跳过')
      continue
    }
    const id = text(raw.id)
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

  const relations = []
  const attached = new Map()
  for (const raw of asArray(design?.relations)) {
    if (!raw || typeof raw !== 'object') continue
    const from = text(raw.from)
    const to = text(raw.to)
    if (!from || !to) {
      warnings.push('关系缺少 from/to，已跳过')
      continue
    }
    if (!entityIds.has(from) || !entityIds.has(to)) {
      warnings.push(`关系 ${from} → ${to} 引用外部/未知实体，当前不绘制`)
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
  for (const entity of entities) entity.relations = attached.get(entity.id) ?? []

  const pageSetId = `${moduleKey || 'MOD'}-main`
  const pages = []
  const originals = []
  const pageIds = new Set()
  for (const raw of asArray(design?.pages)) {
    if (!raw || typeof raw !== 'object') {
      warnings.push('页面项不是对象，已跳过')
      continue
    }
    let id = text(raw.id)
    if (!id) {
      id = `page-${pages.length + 1}`
      warnings.push(`页面缺少 id，已按 ${id} 渲染`)
    }
    if (pageIds.has(id)) {
      warnings.push(`页面 id 重复：${id}（保留第一个）`)
      continue
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
      else if (/^MOD-[^/]+\//.test(entityRef)) warnings.push(`页面 ${id} 引用其它模块实体 ${entityRef}，当前仅占位`)
      else warnings.push(`页面 ${id} 引用的实体不存在：${entityRef}`)
    }
    const columns = asArray(raw.columns).map(item => String(item))
    const rawActions = asArray(raw.actions).map(item => String(item))
    const filters = stringList(raw.filters)
    const rowActions = stringList(raw.rowActions)
    const toolbarActions = stringList(raw.toolbarActions)
    const selection = raw.selection === true ? true : raw.selection === false ? false : undefined
    const pagination = normalizePagination(raw.pagination, id, warnings)
    const form = normalizeForm(raw.form, id, warnings)
    const tree = normalizeTree(raw.tree, id, warnings)
    const subTables = normalizeSubTables(raw.subTables, id, warnings)
    const components = normalizeComponents(raw.components, id, warnings)
    const recipe = text(raw.recipe)
    if (recipe && !PAGE_RECIPES.includes(recipe)) {
      warnings.push(`页面 ${id} 的页面配方 ${recipe} 不受支持，已忽略`)
    }
    const catalogRef = text(raw.catalogRef)
    const blueprint = text(raw.blueprint)
    const actions = rawActions.length ? rawActions : mergeActions(toolbarActions, rowActions)
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
      entityId,
      ...(recipe && PAGE_RECIPES.includes(recipe) ? { recipe } : {}),
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
    pages.push(page)
    originals.push({
      id,
      name,
      type,
      ...(entityRef ? { entity: entityRef } : {}),
      ...(columns.length ? { columns } : {}),
      ...(actions.length ? { actions } : {}),
      ...(recipe && PAGE_RECIPES.includes(recipe) ? { recipe } : {}),
      ...(catalogRef ? { catalogRef } : {}),
      ...(blueprint ? { blueprint } : {})
    })
  }

  return {
    module: moduleKey,
    title,
    file,
    designSystem: normalizeDesignSystem(design?.designSystem),
    entities,
    relations,
    pageSet: { id: pageSetId, title, pages: originals },
    pages,
    warnings
  }
}

/**
 * 模块列表条目 = 需求模块 + 孤儿设计（有 design 但没有对应需求模块文件，P3 遗留）。
 * 孤儿设计只读展示，不能生成设计。
 */
export function mergeModuleEntries(modules, designs) {
  const entries = sortModules(modules).map(module => ({
    key: text(module?.key),
    title: text(module?.title) || text(module?.key),
    order: Number(module?.order) || 0,
    orphan: false
  }))
  const known = new Set(entries.map(entry => entry.key))
  const orphans = asArray(designs)
    .map(design => ({ key: text(design?.module), title: text(design?.title) || text(design?.module) }))
    .filter(item => item.key && !known.has(item.key))
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(item => ({ ...item, order: Number.MAX_SAFE_INTEGER, orphan: true }))
  return [...entries, ...orphans]
}

/** 设计文件级 warnings（如“设计模块没有对应需求模块文件”）→ 错误条行 */
export function designWarningsOf(designs) {
  const lines = []
  for (const design of asArray(designs)) {
    const file = text(design?.file) || text(design?.module)
    for (const warning of asArray(design?.warnings)) {
      const message = String(warning ?? '').trim()
      if (message) lines.push(`${file || '设计'} · 警告 · ${message}`)
    }
  }
  return lines
}
