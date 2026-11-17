/**
 * 清单驱动的通用资源 API（生成应用后端）
 * - app.manifest.json 是唯一契约：实体 → SQLite 表（node:sqlite 内置，零原生依赖），自动建表/补列
 * - 通用 CRUD：分页列表（检索/字段过滤/排序）/详情/新增/修改/删除/批量删除/统计（仪表盘图表用）
 * - ref 外键自动富化：列表与详情返回 <field>Label（目标实体 labelField 值）
 * - manifest 变更自动热加载（fs.watch 防抖），无需重启
 */
import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.API_PORT) || 3390
const MANIFEST_PATH = process.env.MANIFEST_PATH || path.resolve(__dirname, '../app.manifest.json')
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, './app.db')

let manifest = { entities: [], pages: [], app: {} }

function loadManifest() {
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    ensureSchema()
    console.log(`[app] manifest v${manifest.version} 已加载（实体 ${(manifest.entities ?? []).length}，页面 ${(manifest.pages ?? []).length}）`)
  } catch (err) {
    console.error('[app] manifest 加载失败:', err.message)
  }
}

function watchManifest() {
  try {
    let timer = null
    fs.watch(path.dirname(MANIFEST_PATH), (_event, filename) => {
      if (filename && filename !== 'app.manifest.json') return
      clearTimeout(timer)
      timer = setTimeout(loadManifest, 300)
    })
  } catch (err) {
    console.warn('[app] manifest 监听不可用（改动后需重启应用）:', err.message)
  }
}

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')

function ident(raw) {
  return '"' + String(raw).replace(/[^A-Za-z0-9_]/g, '_') + '"'
}

function sqlType(field) {
  return field.type === 'number' ? 'REAL' : field.type === 'boolean' ? 'INTEGER' : 'TEXT'
}

function ensureSchema() {
  for (const entity of manifest.entities ?? []) {
    const table = ident(entity.id)
    const defs = entity.fields.map(f => {
      const parts = [ident(f.name), sqlType(f)]
      if (f.pk) parts.push('PRIMARY KEY')
      else if (f.required) parts.push('NOT NULL')
      return parts.join(' ')
    })
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (${defs.join(', ')})`)
    for (const f of entity.fields) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${ident(f.name)} ${sqlType(f)}`)
      } catch {
        // 列已存在
      }
    }
  }
}

function entityOf(id) {
  return (manifest.entities ?? []).find(e => e.id === id) ?? null
}

function coerce(field, value, errors) {
  if (value === undefined || value === null || value === '') {
    if (field.required && !field.pk) errors.push(`${field.label || field.name} 不能为空`)
    return null
  }
  switch (field.type) {
    case 'number': {
      const n = Number(value)
      if (Number.isNaN(n)) {
        errors.push(`${field.label} 必须是数字`)
        return null
      }
      if (field.min !== undefined && n < field.min) errors.push(`${field.label} 不能小于 ${field.min}`)
      if (field.max !== undefined && n > field.max) errors.push(`${field.label} 不能大于 ${field.max}`)
      return n
    }
    case 'boolean':
      return value === true || value === 1 || value === 'true' ? 1 : 0
    case 'enum':
      if (field.options?.length && !field.options.includes(String(value))) errors.push(`${field.label} 取值须为：${field.options.join('/')}`)
      return String(value)
    default: {
      const s = String(value)
      if (field.pattern) {
        try {
          if (!new RegExp(field.pattern).test(s)) errors.push(`${field.label} 格式不正确`)
        } catch {
          // 非法正则忽略
        }
      }
      if (field.min !== undefined && s.length < field.min) errors.push(`${field.label} 至少 ${field.min} 个字符`)
      if (field.max !== undefined && s.length > field.max) errors.push(`${field.label} 最多 ${field.max} 个字符`)
      return s
    }
  }
}

function rowToClient(entity, row) {
  if (!row) return row
  const out = { ...row }
  for (const f of entity.fields) {
    if (f.type === 'boolean' && f.name in out) out[f.name] = out[f.name] === 1 || out[f.name] === true
  }
  return out
}

/** ref 字段富化：<name>Label = 目标实体 labelField 值 */
function enrichRows(entity, rows) {
  if (!rows.length) return rows
  const out = rows.map(r => ({ ...r }))
  for (const f of entity.fields.filter(x => x.type === 'ref' && x.target)) {
    const target = entityOf(f.target)
    if (!target) continue
    const ids = [...new Set(out.map(r => r[f.name]).filter(v => v !== null && v !== undefined && v !== ''))].map(String)
    const map = new Map()
    if (ids.length) {
      try {
        const label = f.labelField ?? target.labelField
        const hits = db.prepare(`SELECT * FROM ${ident(target.id)} WHERE ${ident(target.pk)} IN (${ids.map(() => '?').join(',')})`).all(...ids)
        for (const h of hits) map.set(String(h[target.pk]), String(h[label] ?? h[target.pk]))
      } catch {
        // 目标表异常时留空
      }
    }
    for (const r of out) r[`${f.name}Label`] = map.get(String(r[f.name])) ?? ''
  }
  return out
}

const app = express()
app.use(express.json({ limit: '20mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, manifestVersion: manifest.version ?? 0 }))

app.get('/api/manifest', (_req, res) => res.json(manifest))

app.use('/api/res/:entity', (req, res, next) => {
  const entity = entityOf(req.params.entity)
  if (!entity) return res.status(404).json({ error: `实体不存在：${req.params.entity}` })
  req.entity = entity
  next()
})

/** 统计：?metric=__count|字段名&dimension=字段名 → [{ label, value }]（仪表盘图表）
 *  必须注册在 /:id 之前，否则 'stats' 会被当作记录 id 匹配 */
app.get('/api/res/:entity/stats', (req, res) => {
  const entity = req.entity
  const dimension = entity.fields.find(f => f.name === req.query.dimension)
  if (!dimension) return res.status(400).json({ error: 'dimension 字段不存在' })
  const metricName = String(req.query.metric ?? '__count')
  const metricField = entity.fields.find(f => f.name === metricName && f.type === 'number')
  const metricExpr = metricField ? `SUM(${ident(metricField.name)})` : 'COUNT(*)'
  try {
    const rows = db
      .prepare(`SELECT ${ident(dimension.name)} AS dim, ${metricExpr} AS val FROM ${ident(entity.id)} GROUP BY ${ident(dimension.name)} ORDER BY 2 DESC LIMIT 20`)
      .all()
    res.json(rows.map(r => ({ label: String(r.dim ?? '空'), value: Number(r.val ?? 0) })))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.get('/api/res/:entity', (req, res) => {
  const entity = req.entity
  const where = []
  const params = []
  const search = String(req.query.search ?? '').trim()
  if (search) {
    const textFields = entity.fields.filter(f => !f.pk && ['string', 'text', 'enum'].includes(f.type)).slice(0, 4)
    if (textFields.length) {
      where.push(`(${textFields.map(f => `${ident(f.name)} LIKE ?`).join(' OR ')})`)
      for (const _f of textFields) params.push(`%${search}%`)
    }
  }
  for (const f of entity.fields) {
    const raw = req.query[f.name]
    if (raw === undefined || raw === '') continue
    where.push(`${ident(f.name)} = ?`)
    params.push(f.type === 'number' ? Number(raw) : f.type === 'boolean' ? (raw === 'true' ? 1 : 0) : String(raw))
  }
  const sortable = entity.fields.some(f => f.name === req.query.sort && String(req.query.sort))
  const orderField = sortable ? ident(String(req.query.sort)) : null
  const order = String(req.query.order ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : ''
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 20))
  const total = db.prepare(`SELECT COUNT(*) AS n FROM ${ident(entity.id)}${whereSql}`).get(...params)
  const rows = db
    .prepare(`SELECT * FROM ${ident(entity.id)}${whereSql} ORDER BY ${orderField ?? 'rowid'} ${orderField ? order : 'DESC'} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize)
  res.json({ total: Number(total?.n ?? 0), rows: enrichRows(entity, rows) })
})

app.get('/api/res/:entity/:id', (req, res) => {
  const entity = req.entity
  const row = db.prepare(`SELECT * FROM ${ident(entity.id)} WHERE ${ident(entity.pk)} = ?`).get(String(req.params.id))
  if (!row) return res.status(404).json({ error: '记录不存在' })
  res.json(enrichRows(entity, [row])[0])
})

app.post('/api/res/:entity', (req, res) => {
  const entity = req.entity
  const errors = []
  const cols = []
  const values = []
  for (const f of entity.fields) {
    if (f.pk) continue
    const v = coerce(f, req.body?.[f.name], errors)
    cols.push(f.name)
    values.push(v)
  }
  if (errors.length) return res.status(400).json({ error: errors.join('；') })
  const pkField = entity.fields.find(f => f.pk) ?? { name: 'id' }
  const id = req.body?.[pkField.name] ? String(req.body[pkField.name]) : crypto.randomUUID()
  cols.push(pkField.name)
  values.push(id)
  try {
    db.prepare(`INSERT INTO ${ident(entity.id)} (${cols.map(ident).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...values)
    const row = db.prepare(`SELECT * FROM ${ident(entity.id)} WHERE ${ident(pkField.name)} = ?`).get(id)
    res.json(enrichRows(entity, [row])[0])
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.put('/api/res/:entity/:id', (req, res) => {
  const entity = req.entity
  const errors = []
  const sets = []
  const values = []
  for (const f of entity.fields) {
    if (f.pk || !(f.name in (req.body ?? {}))) continue
    const v = coerce(f, req.body[f.name], errors)
    sets.push(`${ident(f.name)} = ?`)
    values.push(v)
  }
  if (errors.length) return res.status(400).json({ error: errors.join('；') })
  if (!sets.length) return res.status(400).json({ error: '没有可更新字段' })
  try {
    const info = db.prepare(`UPDATE ${ident(entity.id)} SET ${sets.join(', ')} WHERE ${ident(entity.pk)} = ?`).run(...values, String(req.params.id))
    if (!Number(info.changes)) return res.status(404).json({ error: '记录不存在' })
    const row = db.prepare(`SELECT * FROM ${ident(entity.id)} WHERE ${ident(entity.pk)} = ?`).get(String(req.params.id))
    res.json(enrichRows(entity, [row])[0])
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.delete('/api/res/:entity/:id', (req, res) => {
  const entity = req.entity
  const del = db.prepare(`DELETE FROM ${ident(entity.id)} WHERE ${ident(entity.pk)} = ?`).run(String(req.params.id))
  if (!Number(del.changes)) return res.status(404).json({ error: '记录不存在' })
  res.json({ ok: true })
})

app.post('/api/res/:entity/batch-delete', (req, res) => {
  const entity = req.entity
  const ids = (req.body?.ids ?? []).map(String).filter(Boolean)
  if (!ids.length) return res.status(400).json({ error: 'ids 不能为空' })
  const del = db.prepare(`DELETE FROM ${ident(entity.id)} WHERE ${ident(entity.pk)} IN (${ids.map(() => '?').join(',')})`).run(...ids)
  res.json({ ok: true, deleted: Number(del.changes) })
})

app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: '请求体不是合法 JSON' })
  console.error('[app] 未处理错误:', err)
  res.status(500).json({ error: '服务器内部错误' })
})

loadManifest()
watchManifest()

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[app] API 已启动: http://127.0.0.1:${PORT}（manifest v${manifest.version ?? 0}）`)
})
