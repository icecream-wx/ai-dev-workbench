/**
 * 页面契约 → 线框渲染模型（P7-4b）
 *
 * 纯函数（不依赖 Vue/DOM），便于 node --test：
 * - `components` 的 pm-* → ControlType
 * - selection / rowActions / toolbarActions 缺省规则（必须等于 P7-4a 前的视觉）
 * - pagination / tree / form / subTables 渲染模型
 *
 * 所有契约字段均可选；没有字段时返回旧行为。
 */

/**
 * pm-* 组件 → 线框控件（未知组件返回 undefined，由类型/命名推断兜底）
 *
 * 单一来源：`templates/design-system/component-controls.json`
 * （后端 catalog 生成器读取同一文件，不再解析本 JS）。
 */
import COMPONENT_CONTROLS_JSON from '../../../../templates/design-system/component-controls.json' with { type: 'json' }

export const COMPONENT_CONTROLS = Object.freeze({ ...COMPONENT_CONTROLS_JSON })

const PAGINATION_LAYOUTS = ['bar', 'split', 'three-part']
const TREE_ACTION_STYLES = ['header', 'footer', 'none']
const TREE_SELECTION_STYLES = ['platform', 'dot', 'background']
/** 行级/流程动作不进工具栏 */
const NON_TOOLBAR_ACTIONS = ['create', 'edit', 'delete', 'detail', 'submit', 'cancel', 'view']
const LIST_TOOLBAR_DEFAULTS = ['batchDelete', 'import', 'export']

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function controlFromComponent(name) {
  return COMPONENT_CONTROLS[text(name)] ?? undefined
}

/** 按字段名/标签推断图片、上传类控件（与 P7-4a 前的 layout.ts 同规则） */
function inferMediaControl(field) {
  const source = `${field?.label ?? ''}${field?.name ?? ''}`
  if (/图片|图像|头像|照片|封面|logo/i.test(source)) return 'image'
  if (/附件|文件|上传|材料/.test(source)) return 'upload'
  return undefined
}

/** 按字段名/标签推断人员、组织类选择控件（与 P7-4a 前的 layout.ts 同规则） */
function inferUserOrgControl(field) {
  const source = `${field?.label ?? ''}${field?.name ?? ''}`
  if (/负责人|经办人|处理人|审批人|人员|员工|销售员|归属|owner|assignee|handler/i.test(source)) return 'select-user'
  if (/部门|机构|组织|org|department/i.test(source)) return 'select-org'
  return undefined
}

/** 类型/命名推断（旧行为；无契约时完全一致） */
export function inferControlType(field) {
  const media = inferMediaControl(field)
  if (media) return media
  const userOrg = inferUserOrgControl(field)
  if (userOrg) return userOrg
  switch (field?.type) {
    case 'text': return 'textarea'
    case 'number': return 'number'
    case 'date': return 'date'
    case 'datetime': return 'datetime'
    case 'boolean': return 'boolean'
    case 'enum':
      if (field.options && field.options.length >= 2 && field.options.length <= 4) return 'radio'
      return 'select'
    case 'ref': return 'select'
    default: return 'input'
  }
}

/** 控件优先级：fieldOverrides.control > components > 类型/命名推断 */
export function resolveControl(field, layout) {
  const override = layout?.fieldOverrides?.[field?.name]?.control
  if (override) return override
  const fromComponent = controlFromComponent(layout?.components?.[field?.name])
  if (fromComponent) return fromComponent
  return inferControlType(field)
}

export function resolveSelection(layout) {
  return layout?.selection === false ? false : true
}

/** 行操作：layout.rowActions 优先；否则沿用「详情 + 编辑/删除（依 page.actions）」 */
export function resolveRowActions(page, layout) {
  if (Array.isArray(layout?.rowActions)) return [...layout.rowActions]
  const actions = asArray(page?.actions)
  const canEdit = !actions.length || actions.includes('edit')
  const canDelete = !actions.length || actions.includes('delete')
  const list = ['detail']
  if (canEdit) list.push('edit')
  if (canDelete) list.push('delete')
  return list
}

/** 工具栏动作：layout.toolbarActions 优先；否则 toolbar.actions / page.actions / 默认组合 */
export function resolveToolbarActions(page, layout) {
  if (Array.isArray(layout?.toolbarActions)) return [...layout.toolbarActions]
  const override = layout?.toolbar?.actions
  if (override?.length) return override.filter(action => !NON_TOOLBAR_ACTIONS.includes(action))
  const extra = asArray(page?.actions).filter(action => !NON_TOOLBAR_ACTIONS.includes(action))
  return extra.length ? extra : [...LIST_TOOLBAR_DEFAULTS]
}

/** 三段分页左侧统计：多选开启时显示已选，关闭时退化为总数（selection=false 无多选语义） */
export function pagerSelectionText(selectionEnabled, selectedCount, total = 0) {
  const count = Number.isFinite(Number(selectedCount)) ? Math.max(0, Math.floor(Number(selectedCount))) : 0
  if (selectionEnabled === false) {
    const totalCount = Number.isFinite(Number(total)) ? Math.max(0, Math.floor(Number(total))) : 0
    return `共 ${totalCount} 条`
  }
  return `已选 ${count} 项`
}

/** 批量动作（显式 toolbarActions 时只出现在批量条） */
export function isBatchAction(action) {
  const code = text(action)
  return code === 'batchDelete' || code.startsWith('batch')
}

export function paginationModel(layout, options = {}) {
  const raw = layout?.pagination ?? {}
  const requested = text(raw.layout)
  const paginationLayout = PAGINATION_LAYOUTS.includes(requested) ? requested : 'bar'
  const rawPageSize = Number(raw.pageSize ?? layout?.table?.pageSize ?? options.pageSize)
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.floor(rawPageSize) : 10
  const total = Number.isFinite(Number(options.total)) ? Math.max(0, Math.floor(Number(options.total))) : 0
  const selectedCount = Number.isFinite(Number(options.selectedCount)) ? Math.max(0, Math.floor(Number(options.selectedCount))) : 0
  return { layout: paginationLayout, total, selectedCount, pageSize }
}

/**
 * 树模型：确定性节点列表（不改变表格数据）。
 * parentField 能匹配到其它节点则嵌套，否则首行作根、其余作子节点；最多 maxNodes 个。
 */
export function treeModel(rows, tree, options = {}) {
  const list = asArray(rows)
  const titleField = text(tree?.titleField) || text(options.titleField)
  const parentField = text(tree?.parentField)
  const rawMax = Number(options.maxNodes)
  const maxNodes = Number.isInteger(rawMax) && rawMax > 0 ? rawMax : 12
  const labels = list.slice(0, maxNodes).map((row, index) => {
    const rawTitle = titleField ? row?.[titleField] : undefined
    const label = rawTitle === undefined || rawTitle === null || String(rawTitle).trim() === ''
      ? `节点 ${index + 1}`
      : String(rawTitle).trim()
    const rawParent = parentField ? row?.[parentField] : undefined
    return { label, parent: rawParent === undefined || rawParent === null ? '' : String(rawParent).trim() }
  })
  const indexByLabel = new Map()
  labels.forEach((item, index) => {
    if (!indexByLabel.has(item.label)) indexByLabel.set(item.label, index)
  })
  const depths = new Array(labels.length).fill(-1)
  function depthOf(index, visiting) {
    if (index < 0 || index >= labels.length) return 0
    if (depths[index] >= 0) return depths[index]
    if (visiting.has(index)) return 1
    visiting.add(index)
    const item = labels[index]
    let depth
    if (!item.parent) {
      depth = index === 0 ? 0 : 1
    } else {
      const parentIndex = indexByLabel.get(item.parent)
      depth = parentIndex === undefined || parentIndex === index
        ? (index === 0 ? 0 : 1)
        : Math.min(depthOf(parentIndex, visiting) + 1, 8)
    }
    visiting.delete(index)
    depths[index] = depth
    return depth
  }
  const nodes = labels.map((item, index) => ({ label: item.label, depth: depthOf(index, new Set()) }))
  const requestedAction = text(tree?.actionStyle)
  const requestedSelection = text(tree?.selectionStyle)
  return {
    title: '目录树',
    nodes,
    actionStyle: TREE_ACTION_STYLES.includes(requestedAction) ? requestedAction : 'header',
    selectionStyle: TREE_SELECTION_STYLES.includes(requestedSelection) ? requestedSelection : 'platform'
  }
}

function normalizeGroups(raw) {
  const groups = []
  for (const group of asArray(raw)) {
    if (!group || typeof group !== 'object') continue
    const title = text(group.title)
    const fields = asArray(group.fields).map(item => String(item)).filter(Boolean)
    if (!title && !fields.length) continue
    groups.push({ title, fields })
  }
  return groups
}

/** 表单渲染模型：弹窗/列数/宽度（clamp 360–900，缺省 560）/分组 */
export function formView(layout, page) {
  const form = layout?.form ?? {}
  const dialog = form.presentation === 'dialog' || page?.recipe === 'dialog-form'
  const columns = form.columns === 1 ? 1 : 2
  const rawWidth = Number(form.width)
  const width = Number.isFinite(rawWidth) && rawWidth > 0 ? Math.min(Math.max(Math.round(rawWidth), 360), 900) : 560
  const groups = normalizeGroups(form.groups?.length ? form.groups : layout?.groups)
  return { dialog, columns, width, groups }
}

/** 子表形态：多个子表且声明 mode=tab → 页签；否则堆叠 */
export function subTableView(layout) {
  const list = asArray(layout?.subTables).filter(item => item && !item.hidden)
  const tabs = list.length > 1 && list.some(item => item.mode === 'tab')
  return { tabs, flow: !tabs }
}

/** form.columns=1 → 字段独占整行；否则沿用 fieldSpan（fieldOverrides.span > textarea 24 > 12） */
export function computeFieldSpan(field, layout, respectColumns = true) {
  if (respectColumns && layout?.form?.columns === 1) return 24
  const override = layout?.fieldOverrides?.[field?.name]?.span
  if (override) return override
  return resolveControl(field, layout) === 'textarea' ? 24 : 12
}

export function fieldSpanWithColumns(field, layout) {
  return computeFieldSpan(field, layout, true)
}
