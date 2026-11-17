/**
 * ER 图纯布局（不依赖 Vue/DOM，可在 node --test 中直接使用）
 *
 * 输入 DesignEntity[]，输出确定性的节点盒子 + 边路径：
 * - 实体卡片固定宽 240，高度随可见字段数增长（最多渲染 12 行 + “+N 更多字段”）
 * - 按无向关系拆连通分量，分量内按有向关系 BFS 分层；同层纵向堆叠、层间横向排列
 * - 无任何可解析关系时按 2 列网格排列
 * - 相邻层用三次贝塞尔；跨层走分量上方正交通道；同层优先上下锚点，穿过其他卡片时
 *   退化为层间竖向通道；自引用画右侧自环；所有坐标确定性、不重叠
 */

export const NODE_W = 240
export const HEADER_H = 44
export const ROW_H = 20
export const PAD = 24
export const LAYER_GAP = 96
export const ROW_GAP = 28
export const COMPONENT_GAP = 56
export const MAX_VISIBLE_FIELDS = 12

const CARD_BOTTOM = 8
const GRID_GAP_X = 56
const ROUTE_INSET = 48
const SELF_LOOP_OFFSET = 44
const TOP_CHANNEL_PAD = 20
const LABEL_LINE_H = 12

const CARDINALITY = {
  'one-to-one': '1:1',
  'one-to-many': '1:N',
  'many-to-one': 'N:1',
  'many-to-many': 'N:N'
}

const SQL_TYPE = {
  string: 'varchar',
  text: 'text',
  number: 'int',
  decimal: 'decimal',
  date: 'date',
  datetime: 'datetime',
  time: 'time',
  boolean: 'bool',
  enum: 'enum',
  ref: 'ref'
}

/** 关系类型 → 基数标签；未知类型回退 1:N */
export function relationCardinality(type) {
  return CARDINALITY[type] ?? '1:N'
}

function idOf(entity) {
  const raw = entity && entity.id !== undefined && entity.id !== null ? entity.id : entity && entity.name
  return String(raw ?? '')
}

function nameOf(entity) {
  return String((entity && entity.name) || '未命名实体')
}

function positionOf(entity) {
  const value = Number(entity && entity.position)
  return Number.isFinite(value) ? value : 0
}

function compareEntities(a, b) {
  const diff = positionOf(a) - positionOf(b)
  if (diff) return diff
  const nameA = nameOf(a)
  const nameB = nameOf(b)
  if (nameA < nameB) return -1
  if (nameA > nameB) return 1
  return idOf(a) < idOf(b) ? -1 : idOf(a) > idOf(b) ? 1 : 0
}

function compareNodes(a, b) {
  return compareEntities(a.entity, b.entity)
}

function isWideChar(char) {
  const code = char.codePointAt(0) ?? 0
  return code > 0x2e80
}

/** 按估算宽度截断（CJK 记 1.7 倍），用于 SVG 文本防溢出 */
function clipToWidth(text, maxWidth, unit) {
  const value = String(text ?? '')
  if (!value) return ''
  const ellipsisWidth = unit
  let used = 0
  let result = ''
  for (const char of value) {
    const width = isWideChar(char) ? unit * 1.7 : unit
    if (used + width > maxWidth - ellipsisWidth) return `${result}…`
    used += width
    result += char
  }
  return result
}

function sqlTypeOf(field) {
  return SQL_TYPE[field && field.type] ?? 'string'
}

function normalizeField(field) {
  return field && typeof field === 'object' ? field : {}
}

function relationTargetOf(relation) {
  if (!relation || typeof relation !== 'object') return ''
  return relation.target === undefined || relation.target === null ? '' : String(relation.target)
}

/** 生成实体卡片元数据（rows 只含前 N 个字段，其余用 moreCount 提示） */
function buildNode(entity, context) {
  const fields = Array.isArray(entity.fields) ? entity.fields : []
  const relations = Array.isArray(entity.relations) ? entity.relations : []
  const maxRows = context.maxVisibleFields
  const visible = fields.slice(0, maxRows).map(normalizeField)
  const moreCount = Math.max(0, fields.length - visible.length)

  const pkIndex = (() => {
    const idIndex = fields.findIndex(field => String(field && field.name ? field.name : '').toLowerCase() === 'id')
    if (idIndex >= 0) return idIndex
    return fields.findIndex(field => field && field.unique)
  })()

  const fieldRefs = new Map()
  for (const relation of relations) {
    if (!relation || !relation.sourceField) continue
    const target = context.resolveEntity(relationTargetOf(relation))
    if (target) fieldRefs.set(String(relation.sourceField), target)
  }

  const rows = visible.map((field, index) => {
    const fieldName = String(field.name || '')
    const refEntity = field.ref ? context.resolveEntity(String(field.ref)) : null
    const relationEntity = fieldRefs.get(fieldName) || null
    const targetEntity = refEntity || relationEntity
    const fk = Boolean(targetEntity) || field.type === 'ref'
    const type = String(field.type || 'string')
    return {
      index,
      name: fieldName,
      nameText: clipToWidth(fieldName, fk ? 78 : 116, 6.6),
      label: String(field.label || ''),
      type,
      sqlType: sqlTypeOf(field),
      typeText: clipToWidth(sqlTypeOf(field), 50, 5.4),
      required: Boolean(field.required),
      unique: Boolean(field.unique),
      pk: index === pkIndex,
      fk,
      refName: targetEntity ? nameOf(targetEntity) : '',
      refText: targetEntity ? clipToWidth(nameOf(targetEntity), 40, 6) : '',
      refTargetId: targetEntity ? idOf(targetEntity) : null
    }
  })

  const height = HEADER_H + visible.length * ROW_H + (moreCount > 0 ? ROW_H : 0) + CARD_BOTTOM

  return {
    id: idOf(entity),
    entity,
    x: 0,
    y: 0,
    width: NODE_W,
    height,
    headerHeight: HEADER_H,
    rows,
    hiddenFields: moreCount,
    moreCount,
    layer: 0,
    component: 0,
    nameText: clipToWidth(nameOf(entity), 150, 6.9),
    tableText: clipToWidth((entity && entity.tableName) || '未设表名', 158, 6.2),
    statusLabel: entity && entity.status === 'confirmed' ? '已确认' : '草稿'
  }
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
  }
}

function insideBox(point, node, margin) {
  return (
    point.x > node.x + margin &&
    point.x < node.x + node.width - margin &&
    point.y > node.y + margin &&
    point.y < node.y + node.height - margin
  )
}

/** 曲线是否穿过除 source/target 外的卡片（粗略采样） */
function curveHitsNode(p0, p1, p2, p3, nodes, sourceId, targetId) {
  for (let index = 1; index < 20; index += 1) {
    const point = cubicPoint(p0, p1, p2, p3, index / 20)
    for (const node of nodes) {
      if (node.id === sourceId || node.id === targetId) continue
      if (insideBox(point, node, 2)) return true
    }
  }
  return false
}

function labelBox(text, subtext) {
  const main = String(text || '')
  const sub = String(subtext || '')
  const mainWidth = main.length * 7.2
  const subWidth = [...sub].reduce((sum, char) => sum + (isWideChar(char) ? 8.2 : 5.2), 0)
  const width = Math.round(Math.max(30, mainWidth, subWidth) + 14)
  const height = sub ? LABEL_LINE_H * 2 + 2 : LABEL_LINE_H + 4
  return { labelWidth: width, labelHeight: height }
}

function makeEdge(spec, nodesById, components, collisionNodes, index) {
  const source = nodesById.get(spec.sourceId)
  const target = nodesById.get(spec.targetId)
  if (!source || !target) return null
  const relation = spec.relation || {}
  const cardinality = relationCardinality(relation.type)
  const relationName = String(relation.name || '')
  const base = {
    key: spec.key,
    sourceId: source.id,
    targetId: target.id,
    relation,
    cardinality,
    label: cardinality,
    labelSubtext: clipToWidth(relationName, 112, 5.4),
    title: `${nameOf(source.entity)} → ${nameOf(target.entity)}${relationName ? ` · ${relationName}` : ''}（${cardinality}）`
  }
  const labels = labelBox(cardinality, base.labelSubtext)

  // 自引用：右侧自环
  if (source.id === target.id) {
    const sx = source.x + source.width
    const sy = source.y + HEADER_H + 20
    const path = `M ${sx} ${sy} C ${sx + SELF_LOOP_OFFSET} ${sy - 26}, ${sx + SELF_LOOP_OFFSET} ${sy + 30}, ${sx} ${sy + 24}`
    return {
      ...base,
      ...labels,
      path,
      labelX: sx + SELF_LOOP_OFFSET + 12,
      labelY: sy + 2,
      route: 'self',
      maxX: sx + SELF_LOOP_OFFSET + labels.labelWidth / 2
    }
  }

  const sourceCenterY = source.y + source.height / 2
  const targetCenterY = target.y + target.height / 2

  // 相邻层：源/目标侧边中点，三次贝塞尔；曲线完全落在层间通道内
  if (Math.abs(source.layer - target.layer) === 1) {
    const forward = target.layer > source.layer
    const p0 = { x: forward ? source.x + source.width : source.x, y: sourceCenterY }
    const p3 = { x: forward ? target.x : target.x + target.width, y: targetCenterY }
    const dx = Math.max(24, Math.min(48, Math.abs(p3.x - p0.x) / 2))
    const p1 = { x: p0.x + (forward ? dx : -dx), y: p0.y }
    const p2 = { x: p3.x + (forward ? -dx : dx), y: p3.y }
    const mid = cubicPoint(p0, p1, p2, p3, 0.5)
    return {
      ...base,
      ...labels,
      path: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`,
      labelX: mid.x,
      labelY: mid.y,
      route: 'bezier',
      maxX: Math.max(p0.x, p3.x, mid.x + labels.labelWidth / 2)
    }
  }

  // 同层：优先上下锚点（符合 ER 常规），穿过其他卡片时退化为层间竖向通道
  if (source.layer === target.layer) {
    const down = target.y >= source.y
    const p0 = { x: source.x + source.width / 2, y: down ? source.y + source.height : source.y }
    const p3 = { x: target.x + target.width / 2, y: down ? target.y : target.y + target.height }
    const dy = Math.max(24, Math.min(72, Math.abs(p3.y - p0.y) / 2))
    const p1 = { x: p0.x, y: p0.y + (down ? dy : -dy) }
    const p2 = { x: p3.x, y: p3.y + (down ? -dy : dy) }
    if (!curveHitsNode(p0, p1, p2, p3, collisionNodes, source.id, target.id)) {
      const mid = cubicPoint(p0, p1, p2, p3, 0.5)
      return {
        ...base,
        ...labels,
        path: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`,
        labelX: mid.x,
        labelY: mid.y,
        route: 'bezier-vertical',
        maxX: Math.max(p0.x, p3.x, mid.x + labels.labelWidth / 2)
      }
    }
    const component = components[source.component]
    const useRight = !component || component.maxLayer === 0 || source.layer < component.maxLayer
    const channelX = useRight ? source.x + source.width + ROUTE_INSET : source.x - ROUTE_INSET
    const startX = useRight ? source.x + source.width : source.x
    const endX = useRight ? target.x + target.width : target.x
    const path = `M ${startX} ${sourceCenterY} L ${channelX} ${sourceCenterY} L ${channelX} ${targetCenterY} L ${endX} ${targetCenterY}`
    return {
      ...base,
      ...labels,
      path,
      labelX: channelX,
      labelY: (sourceCenterY + targetCenterY) / 2,
      route: 'side',
      maxX: channelX + labels.labelWidth / 2
    }
  }

  // 跨多层：右/左侧边 → 层间通道 → 分量上方水平通道 → 层间通道 → 目标侧边
  const forward = target.layer > source.layer
  const startX = forward ? source.x + source.width : source.x
  const endX = forward ? target.x : target.x + target.width
  const gapX1 = forward ? source.x + source.width + ROUTE_INSET : source.x - ROUTE_INSET
  const gapX2 = forward ? target.x - ROUTE_INSET : target.x + target.width + ROUTE_INSET
  const component = components[source.component]
  const top = component ? component.top : PAD
  const channelY = top - 12 - (index % 2) * 4
  const path = `M ${startX} ${sourceCenterY} L ${gapX1} ${sourceCenterY} L ${gapX1} ${channelY} L ${gapX2} ${channelY} L ${gapX2} ${targetCenterY} L ${endX} ${targetCenterY}`
  return {
    ...base,
    ...labels,
    path,
    labelX: (gapX1 + gapX2) / 2,
    labelY: channelY,
    route: 'cross',
    maxX: Math.max(startX, endX, gapX1, gapX2, (gapX1 + gapX2) / 2 + labels.labelWidth / 2)
  }
}

/**
 * 计算 ER 图布局。
 *
 * @param {Array} entities DesignEntity[]
 * @param {{ maxVisibleFields?: number }} [options]
 * @returns {{ width: number, height: number, nodes: Array, edges: Array }}
 */
export function buildErLayout(entities, options = {}) {
  const list = (Array.isArray(entities) ? entities : []).filter(entity => entity && typeof entity === 'object')
  const sorted = [...list].sort(compareEntities)
  const maxVisibleFields =
    Number.isInteger(options.maxVisibleFields) && options.maxVisibleFields > 0
      ? options.maxVisibleFields
      : MAX_VISIBLE_FIELDS

  const byId = new Map(sorted.map(entity => [idOf(entity), entity]))
  const byName = new Map(sorted.map(entity => [nameOf(entity), entity]))
  const byNameLower = new Map(sorted.map(entity => [nameOf(entity).toLowerCase(), entity]))
  const resolveEntity = value => {
    const key = String(value ?? '')
    return byId.get(key) || byName.get(key) || byNameLower.get(key.toLowerCase()) || null
  }

  const context = { maxVisibleFields, resolveEntity }
  const nodes = sorted.map(entity => buildNode(entity, context))
  const nodesById = new Map(nodes.map(node => [node.id, node]))

  const edgeSpecs = []
  sorted.forEach(entity => {
    const sourceId = idOf(entity)
    const relations = Array.isArray(entity.relations) ? entity.relations : []
    relations.forEach((relation, relationIndex) => {
      const target = resolveEntity(relationTargetOf(relation))
      if (!target) return
      const targetId = idOf(target)
      edgeSpecs.push({
        key: `${sourceId}->${targetId}#${relationIndex}`,
        sourceId,
        targetId,
        relation
      })
    })
  })

  // 无关系：按 position 的 2 列网格
  if (!edgeSpecs.length) {
    const columns = Math.max(1, Math.min(2, nodes.length))
    const rowHeights = []
    nodes.forEach((node, index) => {
      const row = Math.floor(index / columns)
      rowHeights[row] = Math.max(rowHeights[row] || 0, node.height)
    })
    let cursorY = PAD
    rowHeights.forEach((rowHeight, row) => {
      nodes.forEach((node, index) => {
        if (Math.floor(index / columns) !== row) return
        node.x = PAD + (index % columns) * (NODE_W + GRID_GAP_X)
        node.y = cursorY
        node.layer = index % columns
        node.component = 0
      })
      cursorY += rowHeight + ROW_GAP
    })
    const width = PAD * 2 + columns * NODE_W + (columns - 1) * GRID_GAP_X
    const height = nodes.length ? cursorY - ROW_GAP + PAD : 200
    return { width: Math.max(width, PAD * 2 + NODE_W), height, nodes, edges: [] }
  }

  // 无向连通分量
  const neighbors = new Map(nodes.map(node => [node.id, new Set()]))
  for (const spec of edgeSpecs) {
    if (spec.sourceId === spec.targetId) continue
    neighbors.get(spec.sourceId)?.add(spec.targetId)
    neighbors.get(spec.targetId)?.add(spec.sourceId)
  }
  const visited = new Set()
  const components = []
  for (const node of nodes) {
    if (visited.has(node.id)) continue
    const queue = [node.id]
    const members = []
    visited.add(node.id)
    while (queue.length) {
      const id = queue.shift()
      const member = nodesById.get(id)
      if (!member) continue
      members.push(member)
      for (const neighbor of neighbors.get(id) || []) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
    members.sort(compareNodes)
    components.push({ nodes: members, index: components.length })
  }

  const directedOut = new Map(nodes.map(node => [node.id, []]))
  const incoming = new Map(nodes.map(node => [node.id, 0]))
  for (const spec of edgeSpecs) {
    if (spec.sourceId === spec.targetId) continue
    directedOut.get(spec.sourceId)?.push(spec)
    incoming.set(spec.targetId, (incoming.get(spec.targetId) || 0) + 1)
  }

  const topPad = PAD + TOP_CHANNEL_PAD
  let cursorY = topPad
  let contentWidth = 0

  for (const component of components) {
    const memberIds = new Set(component.nodes.map(node => node.id))
    const layerOf = new Map()
    const roots = component.nodes.filter(node => (incoming.get(node.id) || 0) === 0)
    const startNodes = roots.length ? roots : component.nodes.slice(0, 1)
    const queue = []
    for (const root of startNodes) {
      layerOf.set(root.id, 0)
      queue.push(root)
    }
    while (queue.length) {
      const current = queue.shift()
      const currentLayer = layerOf.get(current.id) || 0
      for (const spec of directedOut.get(current.id) || []) {
        if (!memberIds.has(spec.targetId)) continue
        if (layerOf.has(spec.targetId)) continue
        layerOf.set(spec.targetId, currentLayer + 1)
        queue.push(nodesById.get(spec.targetId))
      }
    }
    let maxLayer = 0
    for (const layer of layerOf.values()) maxLayer = Math.max(maxLayer, layer)
    for (const node of component.nodes) {
      if (!layerOf.has(node.id)) layerOf.set(node.id, maxLayer + 1)
    }
    const layerValues = [...new Set(component.nodes.map(node => layerOf.get(node.id)))].sort((a, b) => a - b)
    const layerIndex = new Map(layerValues.map((value, index) => [value, index]))
    const layers = layerValues.map(() => [])
    for (const node of component.nodes) {
      const layer = layerIndex.get(layerOf.get(node.id))
      node.layer = layer
      node.component = component.index
      layers[layer].push(node)
    }
    for (const layer of layers) layer.sort(compareNodes)

    const layerHeights = layers.map(
      layer => layer.reduce((sum, node) => sum + node.height, 0) + Math.max(0, layer.length - 1) * ROW_GAP
    )
    const componentHeight = layerHeights.length ? Math.max(...layerHeights) : 0
    const componentWidth = layers.length * NODE_W + Math.max(0, layers.length - 1) * LAYER_GAP
    component.top = cursorY
    component.bottom = cursorY + componentHeight
    component.maxLayer = layers.length - 1
    component.width = componentWidth
    layers.forEach((layer, layerIdx) => {
      let y = cursorY + Math.round((componentHeight - layerHeights[layerIdx]) / 2)
      const x = PAD + layerIdx * (NODE_W + LAYER_GAP)
      for (const node of layer) {
        node.x = x
        node.y = y
        y += node.height + ROW_GAP
      }
    })
    contentWidth = Math.max(contentWidth, componentWidth)
    cursorY += componentHeight + COMPONENT_GAP
  }

  let width = PAD * 2 + contentWidth
  const height = cursorY - COMPONENT_GAP + PAD

  // 边（在节点坐标确定后路由）
  const edges = []
  let maxRight = width
  edgeSpecs.forEach((spec, index) => {
    const edge = makeEdge(spec, nodesById, components, nodes, index)
    if (!edge) return
    edges.push(edge)
    maxRight = Math.max(maxRight, edge.maxX)
  })
  width = Math.max(width, Math.ceil(maxRight + PAD))

  return {
    width,
    height: Math.max(height, topPad + 200),
    nodes,
    edges
  }
}
