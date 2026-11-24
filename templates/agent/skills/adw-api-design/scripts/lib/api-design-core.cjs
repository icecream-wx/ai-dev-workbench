/**
 * 接口设计文档（api-design.md）共享校验核心（D2）
 *
 * 同一份规则供：
 * - `scripts/validate-api-design.mjs`（CLI，无外部依赖）；
 * - 后端 `backend/src/dev/api-design.ts`；
 * - `templates/agent/skills/adw-frontend-implementation/scripts/lib/fidelity-core.cjs`（第 14 项）。
 *
 * 只解析 Markdown 表格/章节，不执行文档内容、不写文件、不调用模型。
 * 返回 `{ok, interfaces, byEpic, errors, warnings, coverage}`；errors 阻断生成，warnings 只报告。
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const API_FILE = 'docs/design/api-design.md'
const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
const OPERATIONS = ['list', 'detail', 'create', 'update', 'delete', 'batchDelete', 'export', 'import', 'action', 'other']
const CRUD_OPERATIONS = ['list', 'detail', 'create', 'update', 'delete']
const REQUIRED_SECTIONS = [
  { key: 'meta', label: '0. 文档信息' },
  { key: 'conventions', label: '1. 接口规范' },
  { key: 'index', label: '2. 接口索引' },
  { key: 'coverage', label: '3. 覆盖矩阵' },
  { key: 'details', label: '5. 接口详情' }
]

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanCell(value) {
  return text(value).replace(/^`+|`+$/g, '').trim()
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function splitLines(markdown) {
  return String(markdown ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
}

function isTableLine(line) {
  return /^\s*\|.*\|\s*$/.test(line)
}

function isSeparator(line) {
  return /^\s*\|[\s:|-]+\|\s*$/.test(line) && line.includes('-')
}

function splitRow(line) {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return inner.split('|').map(cell => cell.trim())
}

function parseTables(lines) {
  const tables = []
  for (let index = 0; index < lines.length; index += 1) {
    if (!isTableLine(lines[index]) || !isSeparator(lines[index + 1] || '')) continue
    const header = splitRow(lines[index])
    const rows = []
    let cursor = index + 2
    while (cursor < lines.length && isTableLine(lines[cursor])) {
      const cells = splitRow(lines[cursor])
      if (cells.some(cell => text(cell))) rows.push(cells)
      cursor += 1
    }
    tables.push({ header, rows, start: index, end: cursor })
    index = cursor - 1
  }
  return tables
}

function columnIndex(header, names) {
  const wanted = names.map(name => name.toLowerCase())
  return header.findIndex(cell => wanted.includes(cleanCell(cell).toLowerCase()))
}

function cellAt(row, index) {
  return index >= 0 && index < row.length ? cleanCell(row[index]) : ''
}

/** 按 h2 切章节（含其下 h3/h4 内容） */
function h2Sections(lines) {
  const sections = []
  let current = null
  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line)
    if (match) {
      if (current) sections.push(current)
      current = { title: match[1], lines: [] }
      continue
    }
    if (current) current.lines.push(line)
  }
  if (current) sections.push(current)
  return sections
}

function findSection(sections, keyword) {
  return sections.find(section => section.title.includes(keyword)) || null
}

function normalizeMethod(value) {
  return cleanCell(value).toUpperCase()
}

function parseMethodPath(value) {
  const match = /^(GET|POST|PUT|DELETE|PATCH)\s+(\S+)\s*$/i.exec(cleanCell(value))
  return match ? { method: match[1].toUpperCase(), path: match[2] } : { method: '', path: '' }
}

function isBackground(row, detail) {
  const hay = `${row.name || ''} ${row.description || ''} ${detail?.note || ''}`.toLowerCase()
  return hay.includes('background') || hay.includes('后台接口') || row.operation === 'other'
}

function toPlainObject(rows) {
  const out = {}
  for (const cells of rows) {
    const key = cleanCell(cells[0])
    if (!key) continue
    out[key] = cleanCell(cells[1])
  }
  return out
}

function tableUnderMarker(lines, marker) {
  const index = lines.findIndex(line => line.includes(marker))
  if (index < 0) return { found: false, table: null, lines: [] }
  const tail = lines.slice(index + 1)
  const tables = parseTables(tail)
  return { found: true, table: tables[0] || null, lines: tail }
}

/** 解析接口详情（h4 块） */
function parseDetails(section) {
  if (!section) return []
  const blocks = []
  let current = null
  for (const line of section.lines) {
    const match = /^####\s+(\S+)\s*(.*)$/.exec(line)
    if (match) {
      if (current) blocks.push(current)
      current = { id: match[1], name: match[2] || '', lines: [] }
      continue
    }
    if (current) current.lines.push(line)
  }
  if (current) blocks.push(current)

  return blocks.map(block => {
    const tables = parseTables(block.lines)
    const metaTable = tables.find(table => columnIndex(table.header, ['项', '值']) >= 0) || null
    const meta = metaTable ? toPlainObject(metaTable.rows) : {}
    const methodPath = parseMethodPath(meta['方法/路径'] || '')
    const request = tableUnderMarker(block.lines, '请求参数')
    const response = tableUnderMarker(block.lines, '响应')
    const errorsTable = tableUnderMarker(block.lines, '错误码')
    const exampleIndex = block.lines.findIndex(line => line.includes('示例'))
    const example = exampleIndex >= 0 && block.lines.slice(exampleIndex + 1).some(line => text(line) && !line.startsWith('**'))
    const requestParams = request.table ? request.table.rows.map(row => ({
      name: cellAt(row, columnIndex(request.table.header, ['参数'])),
      location: cellAt(row, columnIndex(request.table.header, ['位置'])),
      type: cellAt(row, columnIndex(request.table.header, ['类型'])),
      required: cellAt(row, columnIndex(request.table.header, ['必填'])),
      description: cellAt(row, columnIndex(request.table.header, ['说明']))
    })) : []
    const responseFields = response.table ? response.table.rows.map(row => ({
      field: cellAt(row, columnIndex(response.table.header, ['字段'])),
      type: cellAt(row, columnIndex(response.table.header, ['类型'])),
      source: cellAt(row, columnIndex(response.table.header, ['来源/说明', '来源', '说明']))
    })) : []
    const errorCodes = errorsTable.table ? errorsTable.table.rows.map(row => ({
      code: cellAt(row, columnIndex(errorsTable.table.header, ['code', '错误码'])),
      http: cellAt(row, columnIndex(errorsTable.table.header, ['http'])),
      description: cellAt(row, columnIndex(errorsTable.table.header, ['说明']))
    })) : []
    return {
      id: block.id,
      name: block.name,
      lines: block.lines,
      method: methodPath.method,
      path: methodPath.path,
      operation: cleanCell(meta['操作'] || ''),
      epic: cleanCell(meta['页面集'] || ''),
      page: cleanCell(meta['页面'] || ''),
      entity: cleanCell(meta['实体'] || ''),
      permission: cleanCell(meta['权限'] || ''),
      note: cleanCell(meta['说明'] || ''),
      hasMetaTable: Boolean(metaTable),
      hasRequest: request.found && (requestParams.length > 0 || request.lines.some(line => /无请求参数|无/.test(line))),
      hasResponse: response.found && (responseFields.length > 0 || response.lines.some(line => /无响应|无 data/i.test(line))),
      hasErrors: errorsTable.found && (errorCodes.length > 0 || errorsTable.lines.some(line => /无错误码|无/.test(line))),
      hasExample: example
    }
  })
}

function parseCoverage(section) {
  const tables = section ? parseTables(section.lines) : []
  const pageActions = []
  const crudRows = []
  let pageTableSeen = false
  let crudTableSeen = false
  for (const table of tables) {
    const pageActionIndex = columnIndex(table.header, ['页面集'])
    const pageIndex = columnIndex(table.header, ['页面'])
    const actionIndex = columnIndex(table.header, ['动作'])
    const interfaceIndex = columnIndex(table.header, ['接口'])
    if (pageActionIndex >= 0 && pageIndex >= 0 && actionIndex >= 0) {
      pageTableSeen = true
      for (const row of table.rows) {
        const action = cellAt(row, actionIndex)
        if (!action) continue
        pageActions.push({
          pageSet: cellAt(row, pageActionIndex),
          page: cellAt(row, pageIndex),
          action,
          interface: cellAt(row, interfaceIndex)
        })
      }
      continue
    }
    const entityIndex = columnIndex(table.header, ['实体'])
    const listIndex = columnIndex(table.header, ['list'])
    const detailIndex = columnIndex(table.header, ['detail'])
    if (entityIndex >= 0 && listIndex >= 0 && detailIndex >= 0) {
      crudTableSeen = true
      for (const row of table.rows) {
        const entity = cellAt(row, entityIndex)
        if (!entity) continue
        crudRows.push({
          entity,
          list: cellAt(row, listIndex),
          detail: cellAt(row, detailIndex),
          create: cellAt(row, columnIndex(table.header, ['create'])),
          update: cellAt(row, columnIndex(table.header, ['update'])),
          delete: cellAt(row, columnIndex(table.header, ['delete']))
        })
      }
    }
  }
  return { pageActions, crudRows, pageTableSeen, crudTableSeen }
}

function entityFieldCodes(entity) {
  return new Set(asArray(entity?.fields).map(field => text(field?.code)).filter(Boolean))
}

function sameSet(left, right) {
  if (left.size !== right.size) return false
  for (const item of left) if (!right.has(item)) return false
  return true
}

/**
 * 运行接口设计校验。
 * @param {{ markdown: string, entities?: any, pages?: any, requirement?: any, file?: string }} input
 */
function runApiDesignCheck(input) {
  const file = text(input?.file) || API_FILE
  const markdown = String(input?.markdown ?? '')
  const lines = splitLines(markdown)
  const sections = h2Sections(lines)
  const errors = []
  const warnings = []
  const pushError = (at, message, expected) => errors.push({ path: at, message, ...(expected ? { expected } : {}) })
  const pushWarning = (at, message) => warnings.push({ path: at, message })

  for (const required of REQUIRED_SECTIONS) {
    if (!findSection(sections, required.label.replace(/^\d+\.\s*/, '').replace(/^接口规范$/, '接口规范'))) {
      pushError(`$`, `缺少必需章节「${required.label}」`, required.label)
    }
  }

  const indexSection = findSection(sections, '接口索引')
  const indexTables = indexSection ? parseTables(indexSection.lines) : []
  const indexTable = indexTables[0] || null
  const interfaces = []
  if (!indexTable) {
    pushError('接口索引', '缺少接口索引表', '| ID | 方法 | 路径 | 名称 | 操作 | Epic/页面集 | 页面 | 实体 | 权限 |')
  } else {
    const idIndex = columnIndex(indexTable.header, ['ID'])
    const methodIndex = columnIndex(indexTable.header, ['方法'])
    const pathIndex = columnIndex(indexTable.header, ['路径'])
    const nameIndex = columnIndex(indexTable.header, ['名称'])
    const operationIndex = columnIndex(indexTable.header, ['操作'])
    const epicIndex = columnIndex(indexTable.header, ['Epic/页面集', '页面集', 'Epic'])
    const pageIndex = columnIndex(indexTable.header, ['页面'])
    const entityIndex = columnIndex(indexTable.header, ['实体'])
    const permissionIndex = columnIndex(indexTable.header, ['权限'])
    if (idIndex < 0 || methodIndex < 0 || pathIndex < 0) {
      pushError('接口索引', '索引表缺少 ID/方法/路径 列')
    }
    for (const [rowIndex, row] of indexTable.rows.entries()) {
      const at = `接口索引[${rowIndex}]`
      const id = cellAt(row, idIndex)
      if (!id) continue
      interfaces.push({
        id,
        method: normalizeMethod(cellAt(row, methodIndex)),
        path: cellAt(row, pathIndex),
        name: cellAt(row, nameIndex),
        operation: cellAt(row, operationIndex),
        epic: cellAt(row, epicIndex),
        page: cellAt(row, pageIndex),
        entity: cellAt(row, entityIndex),
        permission: cellAt(row, permissionIndex),
        rowIndex
      })
    }
  }

  const detailsSection = findSection(sections, '接口详情')
  const details = parseDetails(detailsSection)
  const detailById = new Map(details.map(detail => [detail.id, detail]))

  // 基本校验
  const ids = new Set()
  const methodPaths = new Map()
  for (const item of interfaces) {
    const at = `接口索引[${item.rowIndex}]`
    if (ids.has(item.id)) pushError(at, `接口 ID 重复：${item.id}`, '唯一 ID')
    ids.add(item.id)
    if (!METHODS.includes(item.method)) pushError(at, `方法不合法：${item.method || '(空)'}`, METHODS.join('|'))
    if (!item.path.startsWith('/api')) pushError(at, `路径必须以 /api 开头：${item.path || '(空)'}`, '/api/...')
    const key = `${item.method} ${item.path}`
    if (methodPaths.has(key)) pushError(at, `method+path 重复：${key}`)
    methodPaths.set(key, item.id)
    if (item.operation && !OPERATIONS.includes(item.operation)) {
      pushError(at, `操作不合法：${item.operation}`, OPERATIONS.join('|'))
    }
    if (!item.operation) pushWarning(at, '缺少“操作”字段（无法校验页面/实体覆盖）')
  }

  // 索引与详情一致性
  const indexIds = new Set(interfaces.map(item => item.id))
  for (const item of interfaces) {
    if (!detailById.has(item.id)) pushError(`接口索引[${item.rowIndex}]`, `索引有接口但缺少详情：${item.id}`)
  }
  for (const detail of details) {
    if (!indexIds.has(detail.id)) pushError('接口详情', `详情有接口但索引缺失：${detail.id}`)
    if (!detail.hasMetaTable) pushError(`接口详情.${detail.id}`, '缺少详情元信息表（方法/路径/操作/页面集/页面/实体/权限）')
    if (!detail.method || !detail.path) pushError(`接口详情.${detail.id}`, '缺少方法或路径')
    else if (!detail.path.startsWith('/api')) pushError(`接口详情.${detail.id}`, `路径必须以 /api 开头：${detail.path}`, '/api/...')
    if (detail.operation && !OPERATIONS.includes(detail.operation)) {
      pushError(`接口详情.${detail.id}`, `操作不合法：${detail.operation}`, OPERATIONS.join('|'))
    }
    if (!detail.hasRequest) pushError(`接口详情.${detail.id}`, '缺少请求参数（或写明“无请求参数”）')
    if (!detail.hasResponse) pushError(`接口详情.${detail.id}`, '缺少响应 data')
    if (!detail.hasErrors) pushError(`接口详情.${detail.id}`, '缺少错误码（或写明“无错误码”）')
    if (detail.hasExample === false) pushWarning(`接口详情.${detail.id}`, '缺少示例')
    const indexed = interfaces.find(item => item.id === detail.id)
    if (indexed) {
      if (indexed.method !== detail.method || indexed.path !== detail.path) {
        pushError(`接口详情.${detail.id}`, '索引与详情的方法/路径不一致', `${indexed.method} ${indexed.path}`)
      }
      if (indexed.page && detail.page && indexed.page !== detail.page) {
        pushWarning(`接口详情.${detail.id}`, '索引与详情的页面不一致')
      }
      if (indexed.operation && detail.operation && indexed.operation !== detail.operation) {
        pushWarning(`接口详情.${detail.id}`, '索引与详情的操作不一致')
      }
    }
  }

  // 引用校验
  const entitiesInput = input?.entities && Array.isArray(input.entities.entities) ? input.entities.entities : asArray(input?.entities)
  const pagesInput = input?.pages && Array.isArray(input.pages.pageSets) ? input.pages.pageSets : asArray(input?.pages?.pageSets ?? input?.pages)
  const requirement = input?.requirement || {}
  const entityMap = new Map(asArray(entitiesInput).map(entity => [text(entity?.id), entity]).filter(([id]) => id))
  const pageMap = new Map()
  const pageSetMap = new Map()
  for (const pageSet of asArray(pagesInput)) {
    const setId = text(pageSet?.id)
    const epic = text(pageSet?.epic)
    const title = text(pageSet?.title)
    if (setId) pageSetMap.set(setId, pageSet)
    if (epic) pageSetMap.set(epic, pageSet)
    if (title) pageSetMap.set(title, pageSet)
    for (const page of asArray(pageSet?.pages)) {
      const pageId = text(page?.id)
      if (pageId) pageMap.set(pageId, { ...page, pageSetId: setId, epic, pageSetTitle: title })
    }
  }
  const epicTitles = new Map(asArray(requirement?.epics).map(epic => [text(epic?.id), text(epic?.title)]))
  const normalizeEpicRef = value => cleanCell(value).split(/\s+/)[0]

  for (const item of interfaces) {
    const at = `接口索引[${item.rowIndex}]`
    if (item.page) {
      const pageRef = cleanCell(item.page)
      const page = pageMap.get(pageRef)
      if (!page) pushError(at, `页面不存在：${pageRef}`, 'pages.json 页面 id')
      else if (item.epic) {
        const epicRef = normalizeEpicRef(item.epic)
        if (page.epic && epicRef && epicRef !== page.epic && !pageSetMap.has(cleanCell(item.epic))) {
          pushWarning(at, `页面 ${pageRef} 与页面集 ${item.epic} 不一致`)
        }
      }
    }
    const epicRef = normalizeEpicRef(item.epic)
    if (!pageSetMap.has(cleanCell(item.epic)) && !pageSetMap.has(epicRef) && !epicTitles.has(epicRef)) {
      pushError(at, `页面集/Epic 不存在：${item.epic}`, 'pages.json pageSets[].epic 或 id')
    }
    if (item.entity && !entityMap.has(cleanCell(item.entity))) {
      pushError(at, `实体不存在：${item.entity}`, 'entities.json entities[].id')
    }
    if (!item.permission) pushWarning(at, '缺少权限（无权限控制写 public）')
  }

  // 列表接口分页 + 响应字段 code
  for (const detail of details) {
    const indexed = interfaces.find(item => item.id === detail.id)
    const entityId = cleanCell(detail.entity || indexed?.entity || '')
    const entity = entityMap.get(entityId)
    const codes = entity ? entityFieldCodes(entity) : new Set()
    const operation = detail.operation || indexed?.operation || ''
    if (operation === 'list') {
      const params = parseTables(detail.lines).find(table => columnIndex(table.header, ['参数']) >= 0)
      const names = params ? params.rows.map(row => cleanCell(row[0]).toLowerCase()) : []
      if (!names.includes('page') || !names.includes('size')) {
        pushError(`接口详情.${detail.id}`, '列表接口缺少分页请求参数（page/size）')
      }
      const responseTable = tableUnderMarker(detail.lines, '响应').table
      const fields = responseTable ? responseTable.rows.map(row => cleanCell(row[0])) : []
      if (!fields.includes('total') || !fields.some(field => field.startsWith('items'))) {
        pushError(`接口详情.${detail.id}`, '列表接口缺少分页响应（total/items）')
      }
    }
    const responseTable = tableUnderMarker(detail.lines, '响应').table
    if (responseTable && entity) {
      const fieldIndex = columnIndex(responseTable.header, ['字段'])
      const sourceIndex = columnIndex(responseTable.header, ['来源/说明', '来源', '说明'])
      for (const [rowIndex, row] of responseTable.rows.entries()) {
        const field = cellAt(row, fieldIndex)
        if (!field) continue
        const last = field.includes('.') ? field.slice(field.lastIndexOf('.') + 1) : ''
        const code = last.replace(/\[\]$/, '')
        if (code && !['total', 'items', 'data'].includes(code) && !codes.has(code)) {
          pushError(`接口详情.${detail.id}.响应[${rowIndex}]`, `字段 code 不存在：${field}`, 'entities.json 字段 code')
        }
        if (sourceIndex < 0 || !cellAt(row, sourceIndex)) {
          pushWarning(`接口详情.${detail.id}.响应[${rowIndex}]`, '响应字段未标注来源')
        }
      }
    }
    if (detail.hasErrors) {
      const table = tableUnderMarker(detail.lines, '错误码').table
      const codes = table ? table.rows.map(row => cleanCell(row[0])).filter(Boolean) : []
      if (!codes.length && !detail.lines.some(line => /无错误码/.test(line))) {
        pushWarning(`接口详情.${detail.id}`, '错误码表为空')
      }
    }
  }

  // 覆盖矩阵
  const coverageSection = findSection(sections, '覆盖矩阵')
  const parsedCoverage = parseCoverage(coverageSection)
  if (!parsedCoverage.pageTableSeen) pushError('覆盖矩阵', '缺少页面动作覆盖表（3.1）')
  if (!parsedCoverage.crudTableSeen) pushError('覆盖矩阵', '缺少实体 CRUD 覆盖表（3.2）')
  const coveredActions = new Map()
  for (const item of parsedCoverage.pageActions) {
    coveredActions.set(`${cleanCell(item.page)}::${cleanCell(item.action)}`, item.interface)
  }
  const pageActions = []
  for (const pageSet of asArray(pagesInput)) {
    const setId = text(pageSet?.id)
    const epic = text(pageSet?.epic)
    const setTitle = text(pageSet?.title) || setId
    for (const page of asArray(pageSet?.pages)) {
      const pageId = text(page?.id)
      if (!pageId) continue
      const actions = []
      for (const action of [...asArray(page?.rowActions), ...asArray(page?.toolbarActions)]) {
        const code = text(action)
        if (code && !actions.includes(code)) actions.push(code)
      }
      if (text(page?.type) === 'form' && !actions.includes('submit')) actions.push('submit')
      for (const action of actions) {
        const interfaceId = coveredActions.get(`${pageId}::${action}`) || ''
        pageActions.push({ pageSet: epic || setId, epic, page: pageId, action, interface: interfaceId, covered: Boolean(interfaceId) })
        if (!interfaceId) pushWarning('覆盖矩阵.3.1', `页面动作未覆盖：${pageId} / ${action}`)
      }
    }
  }

  const crudByEntity = new Map()
  for (const item of interfaces) {
    const entityId = cleanCell(item.entity)
    if (!entityId) continue
    const entry = crudByEntity.get(entityId) || {}
    if (item.operation) entry[item.operation] = item.id
    crudByEntity.set(entityId, entry)
  }
  const coverageEntities = []
  for (const entityId of entityMap.keys()) {
    const entry = crudByEntity.get(entityId) || {}
    const missing = CRUD_OPERATIONS.filter(operation => !entry[operation])
    coverageEntities.push({
      entity: entityId,
      list: entry.list || '',
      detail: entry.detail || '',
      create: entry.create || '',
      update: entry.update || '',
      delete: entry.delete || '',
      missing
    })
    for (const operation of missing) pushWarning('覆盖矩阵.3.2', `实体 ${entityId} 缺少 ${operation} 接口`)
    const crudRow = parsedCoverage.crudRows.find(row => cleanCell(row.entity) === entityId)
    if (crudRow) {
      for (const operation of CRUD_OPERATIONS) {
        if (entry[operation] && !cleanCell(crudRow[operation])) {
          pushWarning('覆盖矩阵.3.2', `实体 ${entityId} 的 ${operation} 未在覆盖矩阵列出（索引为 ${entry[operation]}）`)
        }
      }
    }
  }

  for (const item of interfaces) {
    if (item.page) continue
    const detail = detailById.get(item.id)
    if (isBackground(item, detail)) continue
    pushWarning(`接口索引[${item.rowIndex}]`, '接口未被页面引用且未标记 background')
  }

  // Epic 标题与页面集标题不一致
  for (const pageSet of asArray(pagesInput)) {
    const epic = text(pageSet?.epic)
    const title = text(pageSet?.title)
    if (!epic || !title) continue
    const requirementTitle = epicTitles.get(epic)
    if (requirementTitle && requirementTitle !== title) {
      pushWarning('页面集', `Epic ${epic} 标题「${requirementTitle}」与页面集标题「${title}」不一致`)
    }
  }

  const byEpicMap = new Map()
  for (const item of interfaces) {
    const key = cleanCell(item.epic) || '未分组'
    const entry = byEpicMap.get(key) || { epic: key, count: 0 }
    entry.count += 1
    byEpicMap.set(key, entry)
  }

  return {
    ok: errors.length === 0,
    file,
    interfaces,
    byEpic: [...byEpicMap.values()],
    errors,
    warnings,
    coverage: { pageActions, entities: coverageEntities }
  }
}

function readRequirementSummary(appDir) {
  const file = path.join(appDir, 'docs', 'requirements', 'requirements.md')
  try {
    const textValue = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    const end = textValue.indexOf('\n---', 3)
    const frontmatter = textValue.startsWith('---') && end > 0 ? textValue.slice(3, end) : ''
    const titleMatch = /^title\s*:\s*(.+)$/m.exec(frontmatter)
    const title = titleMatch ? titleMatch[1].trim().replace(/^["']|["']$/g, '') : ''
    const epics = []
    for (const line of textValue.split(/\r?\n/)) {
      const match = /^###\s+(EP-\d{3,})\s*(.*)$/.exec(line)
      if (match) epics.push({ id: match[1], title: match[2].trim() })
    }
    return { title, epics }
  } catch {
    return { title: '', epics: [] }
  }
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** 从应用目录读取所需文件（CLI / 后端 / fidelity 共用） */
function readAppInputs(appDir) {
  const root = path.resolve(appDir)
  const apiFile = path.join(root, API_FILE)
  const markdown = fs.existsSync(apiFile) ? fs.readFileSync(apiFile, 'utf8') : ''
  return {
    file: API_FILE,
    exists: fs.existsSync(apiFile),
    markdown,
    requirement: readRequirementSummary(root),
    entities: readJsonSafe(path.join(root, 'docs', 'design', 'entities.json')) || { entities: [], relations: [] },
    pages: readJsonSafe(path.join(root, 'docs', 'design', 'pages.json')) || { pageSets: [] }
  }
}

/** 直接按应用目录校验（返回 exists:false 时不产生 errors） */
function runApiDesignCheckForApp(appDir) {
  const inputs = readAppInputs(appDir)
  if (!inputs.exists) {
    return {
      ok: true,
      exists: false,
      file: inputs.file,
      interfaces: [],
      byEpic: [],
      errors: [],
      warnings: [],
      coverage: { pageActions: [], entities: [] }
    }
  }
  return { exists: true, ...runApiDesignCheck(inputs) }
}

module.exports = {
  API_FILE,
  METHODS,
  OPERATIONS,
  CRUD_OPERATIONS,
  REQUIRED_SECTIONS,
  runApiDesignCheck,
  runApiDesignCheckForApp,
  readAppInputs
}
