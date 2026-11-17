/**
 * M7-2 需求阶段 AI 参考原型（预览规格）：输入聚合 / prompt / 解析归一化 / 守卫 /
 * 只写 settings / GET 三态 + coverage / HTTP（含 res.on('close') abort 回归）。
 *
 * 用临时 RG_DATA_DIR/RG_PROJECTS_DIR + 真实 Express 挂载；模型一律 stub，
 * 不调真实 opencode，不触碰真实 data/projects。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import test, { after, before } from 'node:test'
import type { PrototypeSpec, PrototypeSpecPromptInput, SpecNormalizeContext } from './prototype-spec'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-proto-spec-'))
const dataDir = path.join(root, 'data')
const projectsDir = path.join(root, 'projects')
process.env.RG_DATA_DIR = dataDir
process.env.RG_PROJECTS_DIR = projectsDir

let db: typeof import('../db').db
let doc: typeof import('./doc')
let modules: typeof import('./modules')
let spec: typeof import('./prototype-spec')
let server: Server | null = null
let base = ''

before(async () => {
  const dbModule = await import('../db')
  db = dbModule.db
  doc = await import('./doc')
  modules = await import('./modules')
  spec = await import('./prototype-spec')

  const express = (await import('express')).default
  const { requirementPrototypeRoutes, requirementErrorHandler } = await import('./routes')
  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/apps/:id/requirements-prototype', requirementPrototypeRoutes)
  app.use(requirementErrorHandler)
  server = app.listen(0)
  await new Promise<void>(resolve => server?.once('listening', () => resolve()))
  const address = server.address() as AddressInfo
  base = `http://127.0.0.1:${address.port}`
})

after(() => {
  spec.setPrototypeSpecGeneratorForTests(null)
  server?.close()
  try {
    db?.close()
  } catch {
    // 已关闭
  }
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // Windows 上 SQLite 句柄释放可能滞后
  }
})

// ---------------------------------------------------------------- 测试夹具

function newApp(id: string, name: string): void {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>
  for (const table of tables) {
    const columns = db.prepare(`PRAGMA table_info(${table.name})`).all() as Array<{ name: string }>
    if (!columns.some(column => column.name === 'app_id')) continue
    try {
      db.prepare(`DELETE FROM ${table.name} WHERE app_id = ?`).run(id)
    } catch {
      // 忽略
    }
  }
  db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  db.prepare("DELETE FROM app_settings WHERE key LIKE ?").run(`app.${id}.%`)
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 8081, 'requirements', ?, ?)`
  ).run(id, name, id, now, now)
}

function withModule(appId: string): string {
  const module = modules.ensureDefaultModule(appId)
  doc.ensureRequirementDoc(appId, undefined, module.id)
  return module.id
}

function saveSection(appId: string, moduleId: string, key: string, markdown: string): void {
  doc.saveDocSection(appId, key, { markdown }, moduleId)
}

interface OutlineInput {
  epics: Array<{ id: string; title: string; goal?: string; priority?: string }>
  stories: Array<{ id: string; epicId: string | null; title: string; description?: string; priority?: string; acceptance?: string[] }>
}

function saveOutline(appId: string, moduleId: string, outline: OutlineInput): void {
  doc.saveDocSection(
    appId,
    'epics',
    {
      data: {
        scenes: [],
        epics: outline.epics.map((epic, index) => ({
          ...epic,
          goal: epic.goal ?? '',
          priority: epic.priority ?? 'P0',
          sceneId: null,
          position: index
        })),
        stories: outline.stories.map((story, index) => ({
          ...story,
          description: story.description ?? '',
          acceptance: story.acceptance ?? [],
          priority: story.priority ?? 'P0',
          position: index
        }))
      }
    },
    moduleId
  )
}

/** 模块业务内容（字段表 + 页面清单 + Epics/Stories） */
function seedApp(appId: string, name = '商品与订单'): string {
  newApp(appId, name)
  const moduleId = withModule(appId)
  saveSection(
    appId,
    moduleId,
    'rules',
    [
      '### 商品档案字段',
      '| 字段 | 类型 | 必填 | 说明 |',
      '| --- | --- | --- | --- |',
      '| 商品编码 | 文本 | 是 | 4—32 位，唯一 |',
      '| 商品名称 | 文本 | 是 | 2—60 字 |',
      '| 商品状态 | 枚举 | 是 | 上架 / 下架 |',
      '| 商品分类 | 引用 | 否 | 指向商品分类 |',
      '',
      '### 商品明细字段',
      '| 字段 | 类型 | 必填 | 说明 |',
      '| --- | --- | --- | --- |',
      '| 规格 | 文本 | 是 | 颜色/尺码 |',
      '| 库存 | 数字 | 是 | 整数 |',
      '',
      '> 待确认：库存归属在商品档案还是明细',
      '',
      '### 订单字段',
      '| 字段 | 类型 | 必填 |',
      '| --- | --- | --- |',
      '| 订单号 | 文本 | 是 |',
      '| 订单金额 | 金额 | 是 |'
    ].join('\n')
  )
  saveSection(
    appId,
    moduleId,
    'pages',
    ['1. 商品列表：筛选 + 列表 + 新增/编辑/删除；', '2. 商品详情：分区展示 + 编辑；', '3. 订单列表：查询 + 导出。'].join('\n')
  )
  saveOutline(appId, moduleId, {
    epics: [
      { id: 'EPIC-001', title: '商品档案维护', goal: '维护商品主数据', priority: 'P0' },
      { id: 'EPIC-002', title: '订单管理', goal: '下单与查询', priority: 'P1' }
    ],
    stories: [
      { id: 'STORY-001', epicId: 'EPIC-001', title: '商品列表', description: '查询商品' },
      { id: 'STORY-002', epicId: 'EPIC-001', title: '商品详情', description: '查看商品' },
      { id: 'STORY-003', epicId: 'EPIC-002', title: '订单列表', description: '查询订单' }
    ]
  })
  return moduleId
}

const FIXED_SPEC = {
  entities: [
    {
      name: '商品档案',
      description: '商品主数据',
      fields: [
        { label: '商品编码', type: 'string', required: true, unique: true, note: '4—32 位' },
        { label: '商品名称', type: 'string', required: true },
        { label: '商品状态', type: 'enum', required: true, options: ['上架', '下架'] },
        { label: '商品分类', type: 'ref', target: '商品分类' }
      ]
    },
    {
      name: '商品分类',
      fields: [{ label: '分类名称', type: 'string', required: true }]
    }
  ],
  pages: [
    {
      title: '商品列表',
      type: 'list',
      epicId: 'EPIC-001',
      storyIds: ['STORY-001', 'STORY-002'],
      entity: '商品档案',
      fields: ['商品编码', '商品名称', '商品状态'],
      actions: ['新增', '编辑', '删除']
    },
    {
      title: '商品详情',
      type: 'detail',
      epicId: 'EPIC-001',
      storyIds: ['STORY-002'],
      entity: '商品档案',
      fields: ['商品编码', '商品名称'],
      actions: ['编辑']
    },
    {
      title: '其他页面',
      type: 'custom',
      epicId: 'EPIC-999',
      storyIds: ['STORY-999'],
      entity: '不存在的实体',
      fields: ['不存在字段'],
      actions: ['查看']
    }
  ],
  notes: ['库存归属待确认']
}

function fixedRaw(): string {
  return `参考原型如下。\n${spec.PREVIEW_SPEC_DELIMITER}\n${JSON.stringify(FIXED_SPEC)}`
}

function appTableCounts(appId: string): string {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>
  const result: Record<string, number> = {}
  for (const table of tables) {
    if (table.name === 'app_settings') continue
    const columns = db.prepare(`PRAGMA table_info(${table.name})`).all() as Array<{ name: string }>
    if (!columns.some(column => column.name === 'app_id')) continue
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table.name} WHERE app_id = ?`).get(appId) as { c: number }
    result[table.name] = row.c
  }
  return JSON.stringify(result)
}

function settingsKeys(appId: string): string[] {
  return (db.prepare('SELECT key FROM app_settings WHERE key LIKE ? ORDER BY key').all(`app.${appId}.%`) as Array<{
    key: string
  }>).map(row => row.key)
}

function treeOf(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name)
      out.push(path.relative(dir, full))
      if (entry.isDirectory()) walk(full)
    }
  }
  walk(dir)
  return out
}

function errorStatus(error: unknown): number | undefined {
  return (error as { status?: number }).status
}

async function generateWith(appId: string, moduleId: string, raw = fixedRaw(), model = 'stub/model'): Promise<PrototypeSpec> {
  const result = await spec.generatePrototypeSpec(appId, moduleId, {
    generator: async () => raw,
    model
  })
  return result.spec
}

interface ApiResult<T> {
  status: number
  data: T
}

async function getPreview(appId: string, query = ''): Promise<ApiResult<Record<string, unknown>>> {
  const res = await fetch(`${base}/api/apps/${encodeURIComponent(appId)}/requirements-prototype${query}`)
  const text = await res.text()
  return { status: res.status, data: (text ? JSON.parse(text) : {}) as Record<string, unknown> }
}

async function postSpec(appId: string, query = '', body?: unknown): Promise<ApiResult<Record<string, unknown>>> {
  const res = await fetch(`${base}/api/apps/${encodeURIComponent(appId)}/requirements-prototype/spec${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  })
  const text = await res.text()
  return { status: res.status, data: (text ? JSON.parse(text) : {}) as Record<string, unknown> }
}

// ---------------------------------------------------------------- 输入聚合 / prompt

test('输入聚合与 prompt：模块/章节/Epics/Stories/模板都在；不读设计实体数据', () => {
  const appId = 'spec-prompt'
  const moduleId = seedApp(appId)
  // 设计阶段实体：唯一名字，若被读进 prompt 就会被断言发现
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO app_design_entities
       (id, app_id, module_id, name, table_name, description, fields_json, relations_json, status, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '[]', '[]', 'draft', 0, ?, ?)`
  ).run('de-1', appId, moduleId, '设计独占实体', 'design_only', '设计阶段数据', now, now)

  const source = spec.collectPrototypeSpecSource(appId, moduleId)
  assert.equal(source.epics.length, 2)
  assert.equal(source.stories.length, 3)
  assert.ok(source.sections.some(section => section.sectionKey === 'rules'))
  assert.equal(source.input.appName, '商品与订单')
  assert.equal(source.input.module.title, '商品与订单')
  assert.ok(source.input.template.name.length > 0)
  assert.ok(source.input.template.patterns.list)
  assert.ok(source.input.template.pageSetRules.defaultPageSize >= 1)

  const prompt = source.input.prompt
  for (const expected of [
    '商品与订单',
    '商品编码',
    '商品明细字段',
    '商品列表：筛选',
    'EPIC-001',
    'STORY-002',
    source.input.template.name,
    spec.PREVIEW_SPEC_DELIMITER,
    'string|text|number|decimal|date|datetime|time|boolean|enum|ref'
  ]) {
    assert.ok(prompt.includes(expected), `prompt 缺少：${expected}`)
  }
  assert.ok(!prompt.includes('设计独占实体'), 'prompt 不应包含设计阶段实体')
  assert.ok(!prompt.includes('design_only'), 'prompt 不应包含设计表名')
})

test('输入截断：单章节 6KB、总量 40KB，超限写 note', () => {
  const appId = 'spec-truncate'
  newApp(appId, '截断测试')
  const moduleId = withModule(appId)
  saveSection(appId, moduleId, 'rules', '规'.repeat(9_000))
  for (const key of ['problem', 'goals', 'users', 'scope', 'pages', 'nfr', 'issues']) {
    saveSection(appId, moduleId, key, `${key}内容`.repeat(4_000))
  }

  const source = spec.collectPrototypeSpecSource(appId, moduleId)
  const rules = source.input.sections.find(section => section.kind === 'rules')
  assert.ok(rules)
  assert.ok(rules!.markdown.length <= spec.SPEC_SECTION_LIMIT + 40)
  assert.ok(rules!.markdown.includes('已截断'))
  assert.ok(source.notes.some(text => text.includes('单章节上限 6KB')))
  assert.ok(source.notes.some(text => text.includes('超过 40KB')))
  const total = source.input.sections.reduce((sum, section) => sum + section.markdown.length, 0)
  assert.ok(total <= spec.SPEC_TOTAL_LIMIT + 2_000, `总量应被限制在 40KB 附近，实际 ${total}`)
})

// ---------------------------------------------------------------- 解析 / 归一化

test('解析容错：回复正文 + 分隔符 + 代码块 + 尾逗号；无分隔符的纯 JSON 也接受', () => {
  const context = {
    epics: [{ id: 'EPIC-001', title: '商品', goal: '', priority: 'P0', sceneId: null, position: 0 }],
    stories: [
      { id: 'STORY-001', epicId: 'EPIC-001', title: '商品列表', description: '', acceptance: [], priority: 'P0', position: 0 }
    ],
    docVersion: 2,
    docUpdatedAt: '2026-11-17T00:00:00.000Z',
    model: 'stub/model'
  }
  const raw = `好的，先生成参考原型。\n${spec.PREVIEW_SPEC_DELIMITER}\n\`\`\`json\n{\n  "entities": [{"name": "商品", "fields": [{"label": "名称", "type": "string"},]}],\n  "pages": [{"title": "商品列表", "type": "list", "epicId": "EPIC-001", "entity": "商品", "fields": ["名称"], "actions": ["新增",],},],\n  "notes": ["待确认"],\n}\n\`\`\`\n`
  const parsed = spec.parsePrototypeSpecOutput(raw, context)
  assert.equal(parsed.entities.length, 1)
  assert.equal(parsed.pages.length, 1)
  assert.equal(parsed.pages[0].epicId, 'EPIC-001')
  assert.equal(parsed.generatedAt.length > 0, true)

  const noDelimiter = JSON.stringify({ entities: [{ name: '商品', fields: [{ label: '名称', type: 'string' }] }], pages: [{ title: '列表', type: 'list' }] })
  const parsed2 = spec.parsePrototypeSpecOutput(noDelimiter, context)
  assert.equal(parsed2.pages.length, 1)

  assert.throws(
    () => spec.parsePrototypeSpecOutput('完全不是 JSON 的回复', context),
    (error: unknown) => errorStatus(error) === 502
  )
  // 分隔符后 JSON 损坏 → 502（不是半成品）
  assert.throws(
    () => spec.parsePrototypeSpecOutput(`${spec.PREVIEW_SPEC_DELIMITER}\n{"entities": [`, context),
    (error: unknown) => errorStatus(error) === 502
  )
})

test('归一化：实体/字段去重合并、type 白名单、enum/ref 降级、引用过滤、上限、id 与 name 服务端生成', () => {
  const context = {
    epics: [
      { id: 'EPIC-001', title: '商品', goal: '', priority: 'P0', sceneId: null, position: 0 },
      { id: 'EPIC-002', title: '订单', goal: '', priority: 'P0', sceneId: null, position: 1 }
    ],
    stories: [
      { id: 'STORY-001', epicId: 'EPIC-001', title: '商品列表', description: '', acceptance: [], priority: 'P0', position: 0 },
      { id: 'STORY-002', epicId: 'EPIC-002', title: '订单列表', description: '', acceptance: [], priority: 'P0', position: 1 }
    ],
    docVersion: 3,
    docUpdatedAt: null,
    model: null
  }
  const entities = [
    {
      id: 'MODEL-ENTITY-9',
      name: ' 商品档案 ',
      fields: [
        { id: 'm1', label: '商品编码', type: 'string', required: true },
        { label: '商品状态', type: 'enum', options: ['上架', '下架'] },
        { label: '商品分类', type: 'ref', target: '商品分类' },
        { label: '未知类型', type: 'currency' },
        { label: '无选项枚举', type: 'enum' },
        { label: '商品编码', type: 'text', unique: true, note: '重复 label 合并' }
      ]
    },
    {
      name: '商品分类',
      fields: [{ label: '分类名称', type: 'string' }, { label: '父级', type: 'ref', target: '不存在实体' }]
    },
    {
      name: '商品档案',
      description: '重复实体合并',
      fields: [{ label: '商品名称', type: 'string', required: true }]
    }
  ]
  // 上限：字段 41 个、actions 9 个、options 21 个
  const manyFields = Array.from({ length: 41 }, (_, index) => ({ label: `字段${index + 1}`, type: 'string' }))
  entities.push({ name: '超长实体', fields: manyFields })
  const raw = `${spec.PREVIEW_SPEC_DELIMITER}\n${JSON.stringify({
    entities,
    pages: [
      {
        id: 'P-99',
        title: '商品列表',
        type: 'list',
        epicId: 'EPIC-001',
        storyIds: ['STORY-001', 'STORY-999'],
        entity: '商品档案',
        fields: ['商品编码', '商品名称', '不存在'],
        actions: ['新增', '编辑', '删除', '导出', '导入', '打印', '复制', '审批', '驳回']
      },
      { title: '坏 Epic 页面', type: 'unknown-type', epicId: 'EPIC-404', entity: '不存在实体', actions: [] },
      { title: '  ', type: 'list' }
    ],
    notes: ['模型备注']
  })}`
  const parsed = spec.parsePrototypeSpecOutput(raw, context)

  // 实体去重 + 上限（30）
  assert.equal(parsed.entities[0].name, '商品档案')
  assert.equal(parsed.entities[0].description, '重复实体合并')
  assert.equal(parsed.entities.filter(entity => entity.name === '商品档案').length, 1)
  assert.equal(parsed.entities.length, 3)
  assert.equal(parsed.entities[2].fields.length, spec.SPEC_MAX_FIELDS)
  assert.equal(parsed.entities[0].id, 'PE-1')
  assert.ok(parsed.notes.some(text => text.includes('字段超过上限')))

  const fields = parsed.entities[0].fields
  const byLabel = new Map(fields.map(field => [field.label, field]))
  assert.equal(byLabel.get('商品编码')?.required, true)
  assert.equal(byLabel.get('商品编码')?.unique, true)
  assert.equal(byLabel.get('商品编码')?.note, '重复 label 合并')
  assert.deepEqual(byLabel.get('商品状态')?.options, ['上架', '下架'])
  assert.equal(byLabel.get('商品分类')?.type, 'ref')
  assert.equal(byLabel.get('商品分类')?.target, 'PE-2')
  assert.equal(byLabel.get('未知类型')?.type, 'string')
  assert.equal(byLabel.get('无选项枚举')?.type, 'string')
  assert.ok(parsed.notes.some(text => text.includes('currency')))
  assert.ok(parsed.notes.some(text => text.includes('缺少 options')))
  // 字段 name：中文 label → fieldN（稳定、非空、无中文）
  for (const field of fields) assert.match(field.name, /^[a-z][a-z0-9_]*$/)

  // 页面：id 服务端生成；epic/story/entity/fields 过滤；actions 上限
  assert.equal(parsed.pages.length, 2)
  assert.equal(parsed.pages[0].id, 'PP-1')
  assert.equal(parsed.pages[0].epicId, 'EPIC-001')
  assert.deepEqual(parsed.pages[0].storyIds, ['STORY-001'])
  assert.equal(parsed.pages[0].entityId, 'PE-1')
  assert.equal(parsed.pages[0].fields.length, 2)
  assert.deepEqual(
    parsed.pages[0].fields,
    fields.filter(field => ['商品编码', '商品名称'].includes(field.label)).map(field => field.name)
  )
  assert.equal(parsed.pages[0].actions.length, spec.SPEC_MAX_ACTIONS)
  assert.equal(parsed.pages[1].epicId, null)
  assert.equal(parsed.pages[1].entityId, null)
  assert.equal(parsed.pages[1].type, 'custom')
  assert.ok(parsed.notes.some(text => text.includes('EPIC-404')))
  assert.ok(parsed.notes.some(text => text.includes('不存在实体')))
  assert.equal(parsed.stats.pages, 2)
  assert.equal(parsed.stats.entities, 3)
  assert.equal(parsed.stats.fields, parsed.entities.reduce((sum, entity) => sum + entity.fields.length, 0))
  assert.ok(parsed.notes.includes('模型备注'))
  // ref 悬空降级
  assert.equal(parsed.entities[1].fields.find(field => field.label === '父级')?.type, 'string')
})

test('空页面 / 模型异常 / 取消：502、502、499', async () => {
  const appId = 'spec-errors'
  const moduleId = seedApp(appId)
  const emptyPages = `{"entities": [{"name": "商品", "fields": [{"label": "名称", "type": "string"}]}], "pages": []}`

  await assert.rejects(
    spec.generatePrototypeSpec(appId, moduleId, { generator: async () => emptyPages }),
    (error: unknown) => errorStatus(error) === 502 && String((error as Error).message).includes('没有产出可预览的页面')
  )

  const emptyEntities = `{"entities": [], "pages": [{"title": "看板", "type": "dashboard"}]}`
  await assert.rejects(
    spec.generatePrototypeSpec(appId, moduleId, { generator: async () => emptyEntities }),
    (error: unknown) => errorStatus(error) === 502 && String((error as Error).message).includes('没有产出可预览的实体')
  )

  await assert.rejects(
    spec.generatePrototypeSpec(appId, moduleId, {
      generator: async () => {
        throw new Error('provider 500 boom')
      }
    }),
    (error: unknown) => errorStatus(error) === 502
  )
  assert.equal(settingsKeys(appId).length, 0, '失败不得写规格')

  const controller = new AbortController()
  const pending = spec.generatePrototypeSpec(appId, moduleId, {
    signal: controller.signal,
    generator: () =>
      new Promise<string>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      })
  })
  controller.abort()
  await assert.rejects(pending, (error: unknown) => errorStatus(error) === 499)
  assert.equal(settingsKeys(appId).length, 0)
})

// ---------------------------------------------------------------- 守卫 / 并发

test('守卫：应用/模块 404、归档 409、无文档/空文档 409', async () => {
  await assert.rejects(
    spec.generatePrototypeSpec('spec-missing-app', undefined, { generator: async () => fixedRaw() }),
    (error: unknown) => errorStatus(error) === 404
  )

  const appId = 'spec-guards'
  newApp(appId, '守卫')
  // 无模块（不懒创建）
  await assert.rejects(
    spec.generatePrototypeSpec(appId, undefined, { generator: async () => fixedRaw() }),
    (error: unknown) => errorStatus(error) === 404
  )
  assert.equal((db.prepare('SELECT COUNT(*) AS c FROM app_modules WHERE app_id = ?').get(appId) as { c: number }).c, 0)

  const moduleId = seedApp(appId, '守卫2')
  await assert.rejects(
    spec.generatePrototypeSpec(appId, 'MOD-404', { generator: async () => fixedRaw() }),
    (error: unknown) => errorStatus(error) === 404
  )

  // 归档
  db.prepare('UPDATE app_modules SET archived_at = ? WHERE app_id = ? AND id = ?').run(new Date().toISOString(), appId, moduleId)
  await assert.rejects(
    spec.generatePrototypeSpec(appId, moduleId, { generator: async () => fixedRaw() }),
    (error: unknown) => errorStatus(error) === 409
  )
  db.prepare('UPDATE app_modules SET archived_at = NULL WHERE app_id = ? AND id = ?').run(appId, moduleId)

  // 无文档
  const noDocApp = 'spec-guards-nodoc'
  newApp(noDocApp, '守卫无文档')
  const noDocModule = modules.ensureDefaultModule(noDocApp)
  db.prepare('DELETE FROM app_requirement_doc_sections WHERE app_id = ?').run(noDocApp)
  db.prepare('DELETE FROM app_requirement_docs WHERE app_id = ?').run(noDocApp)
  await assert.rejects(
    spec.generatePrototypeSpec(noDocApp, noDocModule.id, { generator: async () => fixedRaw() }),
    (error: unknown) => errorStatus(error) === 409 && String((error as Error).message).includes('请先补全需求文档')
  )

  // 空文档
  doc.ensureRequirementDoc(noDocApp, undefined, noDocModule.id)
  await assert.rejects(
    spec.generatePrototypeSpec(noDocApp, noDocModule.id, { generator: async () => fixedRaw() }),
    (error: unknown) => errorStatus(error) === 409
  )
  assert.equal(settingsKeys(noDocApp).length, 0)
})

test('并发：同模块第二次生成 409，首次完成释放锁', async () => {
  const appId = 'spec-concurrent'
  const moduleId = seedApp(appId)
  let release: () => void = () => undefined
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  const first = spec.generatePrototypeSpec(appId, moduleId, {
    generator: async () => {
      await gate
      return fixedRaw()
    }
  })
  await assert.rejects(
    spec.generatePrototypeSpec(appId, moduleId, { generator: async () => fixedRaw() }),
    (error: unknown) => errorStatus(error) === 409 && String((error as Error).message).includes('正在生成原型参考')
  )
  release()
  const result = await first
  assert.equal(result.spec.pages.length, 3)
  // 锁已释放：再次生成成功
  const again = await generateWith(appId, moduleId)
  assert.equal(again.pages.length, 3)
})

// ---------------------------------------------------------------- 写入边界

test('唯一写入 app_settings：其它表行数与 projects 目录树不变；失败不覆盖旧规格', async () => {
  const appId = 'spec-write'
  const moduleId = seedApp(appId)
  const beforeApp = appTableCounts(appId)
  const beforeTree = treeOf(projectsDir)
  const beforeKeys = settingsKeys(appId)

  const first = await generateWith(appId, moduleId)
  assert.equal(first.stats.pages, 3)
  const keysAfter = settingsKeys(appId)
  assert.equal(keysAfter.length, 1)
  assert.equal(keysAfter[0], spec.prototypeSpecSettingKey(appId, moduleId))
  assert.equal(appTableCounts(appId), beforeApp)
  assert.deepEqual(treeOf(projectsDir), beforeTree)
  assert.ok(!fs.existsSync(path.join(projectsDir, appId, 'prototypes')))
  assert.deepEqual(beforeKeys, [])

  // 失败：模型抛错 → 旧规格保留
  await assert.rejects(
    spec.generatePrototypeSpec(appId, moduleId, {
      generator: async () => {
        throw new Error('boom')
      }
    }),
    (error: unknown) => errorStatus(error) === 502
  )
  const stored = spec.readStoredPrototypeSpec(appId, moduleId)
  assert.equal(stored?.generatedAt, first.generatedAt)
  assert.equal(stored?.pages.length, 3)

  // 空页面（解析成功但不可预览）→ 也不覆盖
  await assert.rejects(
    spec.generatePrototypeSpec(appId, moduleId, {
      generator: async () => JSON.stringify({ entities: [{ name: '商品', fields: [{ label: '名称', type: 'string' }] }], pages: [] })
    }),
    (error: unknown) => errorStatus(error) === 502
  )
  assert.equal(spec.readStoredPrototypeSpec(appId, moduleId)?.generatedAt, first.generatedAt)
  assert.equal(settingsKeys(appId).length, 1)
})

// ---------------------------------------------------------------- GET 三态 / coverage

test('readStoredPrototypeSpec 容错：损坏 JSON/旧 schema 返回 null；setting 键稳定', () => {
  const appId = 'spec-stored'
  const moduleId = seedApp(appId)
  const key = spec.prototypeSpecSettingKey(appId, moduleId)
  assert.equal(key, `app.${appId}.requirementsPrototype.${moduleId}`)

  assert.equal(spec.readStoredPrototypeSpec(appId, moduleId), null)
  db.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, '{not json', new Date().toISOString())
  assert.equal(spec.readStoredPrototypeSpec(appId, moduleId), null)
  db.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run(JSON.stringify({ schema: 'old/0', entities: [], pages: [], notes: [] }), key)
  assert.equal(spec.readStoredPrototypeSpec(appId, moduleId), null)
  db.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run(
    JSON.stringify({
      schema: spec.PREVIEW_SPEC_SCHEMA,
      generatedAt: '2026-11-17T00:00:00.000Z',
      model: null,
      base: { docVersion: 1, docUpdatedAt: null },
      entities: [],
      pages: [],
      notes: [],
      stats: { entities: 0, fields: 0, pages: 0 }
    }),
    key
  )
  assert.equal(spec.readStoredPrototypeSpec(appId, moduleId)?.schema, spec.PREVIEW_SPEC_SCHEMA)
})

test('coverageOf / specStateOf：无规格、重复引用、无效 storyId、过期边界', () => {
  const stories = [
    { id: 'STORY-001', epicId: 'EPIC-001', title: 'A', description: '', acceptance: [], priority: 'P0', position: 0 },
    { id: 'STORY-002', epicId: 'EPIC-001', title: 'B', description: '', acceptance: [], priority: 'P0', position: 1 }
  ]
  const none = spec.coverageOf(null, stories)
  assert.deepEqual(none, { stories: 2, coveredStories: 0, uncoveredStoryIds: ['STORY-001', 'STORY-002'] })

  const fake = {
    schema: spec.PREVIEW_SPEC_SCHEMA,
    generatedAt: '2026-11-17T00:00:00.000Z',
    model: null,
    base: { docVersion: 4, docUpdatedAt: '2026-11-17T00:00:00.000Z' },
    entities: [],
    pages: [
      { id: 'PP-1', title: 'A', type: 'list' as const, epicId: null, storyIds: ['STORY-001', 'STORY-001', 'STORY-404'], entityId: null, fields: [], actions: [] }
    ],
    notes: [],
    stats: { entities: 0, fields: 0, pages: 1 }
  }
  assert.deepEqual(spec.coverageOf(fake, stories), {
    stories: 2,
    coveredStories: 1,
    uncoveredStoryIds: ['STORY-002']
  })

  assert.deepEqual(spec.specStateOf('a', 'm', { docVersion: 4, docUpdatedAt: '2026-11-17T00:00:00.000Z' }, fake), {
    status: 'ready',
    staleReason: null
  })
  assert.deepEqual(spec.specStateOf('a', 'm', { docVersion: 4, docUpdatedAt: '2026-11-18T00:00:00.000Z' }, fake), {
    status: 'stale',
    staleReason: 'doc-changed'
  })
  assert.deepEqual(spec.specStateOf('a', 'm', { docVersion: 5, docUpdatedAt: '2026-11-17T00:00:00.000Z' }, fake), {
    status: 'stale',
    staleReason: 'doc-changed'
  })
  assert.deepEqual(spec.specStateOf('a', 'm', { docVersion: 0, docUpdatedAt: null }, null), {
    status: 'missing',
    staleReason: null
  })
})

test('GET specState：missing → ready → stale（docVersion/docUpdatedAt 变化）+ coverage + 未生成不写库', async () => {
  const appId = 'spec-state'
  const moduleId = seedApp(appId)

  const beforeKeys = settingsKeys(appId)
  const missing = spec.buildPrototypeSpecView(appId, moduleId)
  assert.equal(missing.spec, null)
  assert.equal(missing.specState.status, 'missing')
  assert.equal(missing.specState.staleReason, null)
  assert.deepEqual(missing.specState.coverage, {
    stories: 3,
    coveredStories: 0,
    uncoveredStoryIds: ['STORY-001', 'STORY-002', 'STORY-003']
  })
  assert.deepEqual(settingsKeys(appId), beforeKeys)

  await generateWith(appId, moduleId)
  const ready = spec.buildPrototypeSpecView(appId, moduleId)
  assert.equal(ready.specState.status, 'ready')
  assert.equal(ready.specState.staleReason, null)
  assert.deepEqual(ready.specState.coverage, {
    stories: 3,
    coveredStories: 2,
    uncoveredStoryIds: ['STORY-003']
  })
  assert.equal(ready.spec?.base.docVersion, 1)
  assert.equal(ready.spec?.model, 'stub/model')

  // 保存章节 → 文档 updatedAt/可能版本变化 → stale
  saveSection(appId, moduleId, 'problem', '补充背景')
  const stale = spec.buildPrototypeSpecView(appId, moduleId)
  assert.equal(stale.specState.status, 'stale')
  assert.equal(stale.specState.staleReason, 'doc-changed')
  assert.equal(stale.spec?.pages.length, 3, '过期仍可查看旧规格')

  // 重新生成后恢复 ready（并更新 base）
  await generateWith(appId, moduleId)
  const refreshed = spec.buildPrototypeSpecView(appId, moduleId)
  assert.equal(refreshed.specState.status, 'ready')
  assert.equal(refreshed.specState.staleReason, null)
  assert.ok((refreshed.spec?.base.docVersion ?? 0) >= 1)
  // unknown moduleId 由 M7 预览抛 404（此处直接校验服务层 404）
  assert.throws(
    () => spec.collectPrototypeSpecSource(appId, 'MOD-404'),
    (error: unknown) => errorStatus(error) === 404
  )
})

// ---------------------------------------------------------------- HTTP

test('HTTP：GET 200 含 spec/specState；POST 200 生成；再次 GET ready；未授权 body 被忽略', async () => {
  const appId = 'spec-http'
  const moduleId = seedApp(appId)

  const empty = await getPreview(appId)
  assert.equal(empty.status, 200)
  assert.equal(empty.data.spec, null)
  assert.equal((empty.data.specState as { status: string }).status, 'missing')
  assert.equal(empty.data.pageSets ? (empty.data.pageSets as unknown[]).length : -1, 2, 'M7 字段保持')
  assert.equal((empty.data.module as { id: string }).id, moduleId)

  spec.setPrototypeSpecGeneratorForTests({ generate: async () => fixedRaw(), model: 'stub/http-model' })
  const created = await postSpec(appId, '', { regenerate: true, moduleId })
  assert.equal(created.status, 200)
  const createdSpec = created.data.spec as PrototypeSpec
  assert.equal(createdSpec.stats.pages, 3)
  assert.equal(createdSpec.model, 'stub/http-model')
  assert.equal((created.data.specState as { status: string }).status, 'ready')

  const ready = await getPreview(appId, `?moduleId=${encodeURIComponent(moduleId)}`)
  assert.equal(ready.status, 200)
  assert.equal((ready.data.spec as PrototypeSpec).pages.length, 3)
  assert.deepEqual((ready.data.specState as { coverage: unknown }).coverage, {
    stories: 3,
    coveredStories: 2,
    uncoveredStoryIds: ['STORY-003']
  })
  spec.setPrototypeSpecGeneratorForTests(null)
})

test('HTTP：POST 守卫 404/409/502；错误码与文案', async () => {
  spec.setPrototypeSpecGeneratorForTests({ generate: async () => fixedRaw(), model: 'stub/http-model' })

  const missingApp = await postSpec('spec-http-missing')
  assert.equal(missingApp.status, 404)

  const appId = 'spec-http-guards'
  newApp(appId, 'HTTP 守卫')
  const noModule = await postSpec(appId)
  assert.equal(noModule.status, 404)

  const moduleId = seedApp(appId, 'HTTP 守卫2')
  db.prepare('UPDATE app_modules SET archived_at = ? WHERE app_id = ? AND id = ?').run(new Date().toISOString(), appId, moduleId)
  const archived = await postSpec(appId, `?moduleId=${encodeURIComponent(moduleId)}`)
  assert.equal(archived.status, 409)
  db.prepare('UPDATE app_modules SET archived_at = NULL WHERE app_id = ? AND id = ?').run(appId, moduleId)

  spec.setPrototypeSpecGeneratorForTests({
    generate: async () => {
      throw new Error('model down')
    }
  })
  const failed = await postSpec(appId, `?moduleId=${encodeURIComponent(moduleId)}`)
  assert.equal(failed.status, 502)
  assert.match(String(failed.data.error), /原型生成失败/)
  assert.equal(spec.readStoredPrototypeSpec(appId, moduleId), null)

  spec.setPrototypeSpecGeneratorForTests({
    generate: async () => JSON.stringify({ entities: [{ name: '商品', fields: [{ label: '名称', type: 'string' }] }], pages: [] })
  })
  const noPages = await postSpec(appId, `?moduleId=${encodeURIComponent(moduleId)}`)
  assert.equal(noPages.status, 502)
  assert.match(String(noPages.data.error), /没有产出可预览的页面/)
  spec.setPrototypeSpecGeneratorForTests(null)
})

test('HTTP：客户端断开触发 res.on(\'close\') abort，不写规格且释放并发锁', async () => {
  const appId = 'spec-http-abort'
  const moduleId = seedApp(appId)
  let started = false
  spec.setPrototypeSpecGeneratorForTests({
    generate: async () => {
      started = true
      await new Promise(resolve => setTimeout(resolve, 250))
      return fixedRaw()
    }
  })

  const controller = new AbortController()
  const request = fetch(`${base}/api/apps/${encodeURIComponent(appId)}/requirements-prototype/spec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: controller.signal
  })
  // 等请求到达服务器（stub 开始执行）后断开
  for (let index = 0; index < 50 && !started; index += 1) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.equal(started, true)
  controller.abort()
  await assert.rejects(request)
  await new Promise(resolve => setTimeout(resolve, 350))

  assert.equal(spec.readStoredPrototypeSpec(appId, moduleId), null, '客户端断开后不得写入规格')

  // 锁已释放：后续生成成功
  spec.setPrototypeSpecGeneratorForTests({ generate: async () => fixedRaw(), model: 'stub/http-model' })
  const retry = await postSpec(appId)
  assert.equal(retry.status, 200)
  assert.equal((retry.data.spec as PrototypeSpec).pages.length, 3)
  spec.setPrototypeSpecGeneratorForTests(null)
})

test('HTTP GET：归档模块允许只读（specState/stale 不影响），未知模块 404', async () => {
  const appId = 'spec-http-archived'
  const moduleId = seedApp(appId)
  await generateWith(appId, moduleId)
  db.prepare('UPDATE app_modules SET archived_at = ? WHERE app_id = ? AND id = ?').run(new Date().toISOString(), appId, moduleId)

  const res = await getPreview(appId, `?moduleId=${encodeURIComponent(moduleId)}`)
  assert.equal(res.status, 200)
  assert.equal((res.data.module as { archived: boolean }).archived, true)
  assert.equal((res.data.spec as PrototypeSpec).pages.length, 3)

  const unknown = await getPreview(appId, '?moduleId=MOD-404')
  assert.equal(unknown.status, 404)
})

// ---------------------------------------------------------------- M7-2b：解析容错 / 自动重试 / 诊断

function parseContext(): SpecNormalizeContext {
  return {
    epics: [{ id: 'EPIC-001', title: '商品', goal: '', priority: 'P0', sceneId: null, position: 0 }],
    stories: [
      { id: 'STORY-001', epicId: 'EPIC-001', title: '商品列表', description: '', acceptance: [], priority: 'P0', position: 0 }
    ],
    docVersion: 1,
    docUpdatedAt: null,
    model: 'stub/model'
  }
}

function detailOf(error: unknown): string {
  return String((error as { detail?: unknown }).detail ?? '')
}

test('解析容错（M7-2b）：分隔符后多个 JSON → 取最靠后；前后噪声', () => {
  const first = JSON.stringify({
    entities: [{ name: '旧实体', fields: [{ label: '旧字段', type: 'string' }] }],
    pages: [{ title: '旧页面', type: 'list' }]
  })
  const last = JSON.stringify({
    entities: [{ name: '新实体', fields: [{ label: '新字段', type: 'string' }] }],
    pages: [{ title: '新页面', type: 'list', epicId: 'EPIC-001', entity: '新实体', fields: ['新字段'] }]
  })
  const raw = `说明文字，还夹着一个 { "noise": 1 } 对象。\n${spec.PREVIEW_SPEC_DELIMITER}\n${first}\n中间又说了两句\n${last}\n结束语。`
  const parsed = spec.parsePrototypeSpecOutput(raw, parseContext())
  assert.equal(parsed.entities[0].name, '新实体')
  assert.equal(parsed.pages[0].title, '新页面')
  assert.equal(parsed.pages[0].epicId, 'EPIC-001')
})

test('解析容错（M7-2b）：BOM / ```json 围栏 / CRLF / 尾逗号', () => {
  const raw =
    '\uFEFF好的，规格如下：\r\n' +
    `${spec.PREVIEW_SPEC_DELIMITER}\r\n` +
    '```json\r\n' +
    '{\r\n' +
    '  "entities": [{"name": "商品", "fields": [{"label": "名称", "type": "string"},],},],\r\n' +
    '  "pages": [{"title": "商品列表", "type": "list", "entity": "商品", "fields": ["名称"],},],\r\n' +
    '  "notes": ["待确认"],\r\n' +
    '}\r\n' +
    '```\r\n' +
    '以上。'
  const parsed = spec.parsePrototypeSpecOutput(raw, parseContext())
  assert.equal(parsed.entities.length, 1)
  assert.equal(parsed.entities[0].name, '商品')
  assert.equal(parsed.pages.length, 1)
  assert.ok(parsed.notes.includes('待确认'))
})

test('解析容错（M7-2b）：字符串内未转义换行 → 转义后再解析', () => {
  const raw =
    `${spec.PREVIEW_SPEC_DELIMITER}\n` +
    '{"entities": [{"name": "商品", "description": "第一行\n第二行", "fields": [{"label": "名称", "type": "string"}]}], ' +
    '"pages": [{"title": "商品列表", "type": "list", "entity": "商品", "fields": ["名称"]}]}'
  const parsed = spec.parsePrototypeSpecOutput(raw, parseContext())
  assert.equal(parsed.entities[0].description.includes('第一行'), true)
  assert.equal(parsed.entities[0].description.includes('第二行'), true)
  assert.equal(parsed.pages.length, 1)
})

test('解析容错（M7-2b）：全角引号兜底（仅前述失败后）', () => {
  const raw =
    `${spec.PREVIEW_SPEC_DELIMITER}\n` +
    '{“entities”: [{“name”: “商品”, “fields”: [{“label”: “名称”, “type”: “string”}]}], ' +
    '“pages”: [{“title”: “商品列表”, “type”: “list”, “entity”: “商品”, “fields”: [“名称”]}]}'
  const parsed = spec.parsePrototypeSpecOutput(raw, parseContext())
  assert.equal(parsed.entities[0].name, '商品')
  assert.equal(parsed.pages[0].title, '商品列表')
})

test('解析容错（M7-2b）：嵌套对象只取顶层；截断 JSON 不补括号 → 502', () => {
  const nested =
    `${spec.PREVIEW_SPEC_DELIMITER}\n` +
    '{"meta": {"entities": ["假实体"], "pages": ["假页面"]}, ' +
    '"entities": [{"name": "商品", "fields": [{"label": "名称", "type": "string"}]}], ' +
    '"pages": [{"title": "商品列表", "type": "list"}]}'
  const parsed = spec.parsePrototypeSpecOutput(nested, parseContext())
  assert.equal(parsed.entities[0].name, '商品')
  assert.equal(parsed.pages[0].title, '商品列表')

  assert.throws(
    () => spec.parsePrototypeSpecOutput(`${spec.PREVIEW_SPEC_DELIMITER}\n{"entities": [{"name": "商品"}], "pages": [`, parseContext()),
    (error: unknown) => errorStatus(error) === 502 && String((error as Error).message).includes('无法解析')
  )
  // 围栏未闭合 + 截断：同样不补括号
  assert.throws(
    () => spec.parsePrototypeSpecOutput('```json\n{"entities": [{"name": "商品"}\n```', parseContext()),
    (error: unknown) => errorStatus(error) === 502
  )
})

test('解析容错（M7-2b 边界）：未闭合残片 + 完整 JSON → 仍能解析后面的完整对象', () => {
  // 分隔符后先是一段截断的残片（括号未闭合），再是一个完整规格对象
  const fragment = '{"entities":[{"name":"残片实体","fields":[{"label":"x","type":"string"}]}],"pages":[],"notes":[]'
  const complete = JSON.stringify({
    entities: [
      {
        name: '商品档案',
        description: '商品主数据',
        fields: [
          { label: '商品编码', type: 'string', required: true, unique: true },
          { label: '商品状态', type: 'enum', required: true, options: ['上架', '下架'] }
        ]
      },
      { name: '商品分类', fields: [{ label: '分类名称', type: 'string' }] }
    ],
    pages: [
      { title: '商品列表', type: 'list', epicId: 'EPIC-001', entity: '商品档案', fields: ['商品编码', '商品状态'], actions: ['新增'] },
      { title: '商品详情', type: 'detail', entity: '商品档案', fields: ['商品编码'], actions: ['编辑'] }
    ],
    notes: ['库存归属待确认']
  })
  const raw = `${spec.PREVIEW_SPEC_DELIMITER}\n${fragment}\n${complete}`

  const candidates = spec.balancedObjectCandidates(spec.preprocessSpecOutput(raw).slice(spec.PREVIEW_SPEC_DELIMITER.length))
  assert.ok(candidates.length >= 2, `候选中应同时含残片内对象与完整对象（实际 ${candidates.length}）`)
  const parsed = spec.parsePrototypeSpecOutput(raw, parseContext())
  assert.equal(parsed.entities.length, 2)
  assert.equal(parsed.pages.length, 2)
  assert.equal(parsed.entities[0].name, '商品档案')
  assert.equal(parsed.pages[0].title, '商品列表')
  assert.ok(parsed.notes.includes('库存归属待确认'))
})

test('解析容错（M7-2b 边界）：未闭合残片 + 无完整 JSON → null（不补括号）', () => {
  const single = `${spec.PREVIEW_SPEC_DELIMITER}\n{"entities":[{"name":"商品","fields":[{"label":"名称"`
  assert.equal(spec.parseSpecObject(single), null)
  assert.throws(
    () => spec.parsePrototypeSpecOutput(single, parseContext()),
    (error: unknown) => errorStatus(error) === 502 && String((error as Error).message).includes('无法解析')
  )

  // 两段残片（都没有闭合对象）→ 仍为 null
  const twoFragments = `${spec.PREVIEW_SPEC_DELIMITER}\n{"entities":[{"name":"A"\n{"notes":["未闭合"`
  assert.equal(spec.parseSpecObject(twoFragments), null)
  // 顶层候选 + 后缀候选均为空
  assert.deepEqual(spec.balancedObjectCandidates(spec.preprocessSpecOutput(twoFragments).slice(spec.PREVIEW_SPEC_DELIMITER.length)), [])
})

test('自动重试（M7-2b）：第一次垃圾、第二次合法 → 成功且只多调用一次', async () => {
  const appId = 'spec-retry-ok'
  const moduleId = seedApp(appId)
  let calls = 0
  const result = await spec.generatePrototypeSpec(appId, moduleId, {
    generator: async () => {
      calls += 1
      return calls === 1 ? '抱歉，我需要先确认一下库存规则，暂时给不出规格。' : fixedRaw()
    },
    model: 'stub/retry'
  })
  assert.equal(calls, 2)
  assert.equal(result.spec.pages.length, 3)
  assert.equal(spec.readStoredPrototypeSpec(appId, moduleId)?.stats.pages, 3)
  assert.equal(settingsKeys(appId).length, 1)
})

test('自动重试（M7-2b）：两次垃圾 → 502 + detail（300 字头尾截断）', async () => {
  const appId = 'spec-retry-fail'
  const moduleId = seedApp(appId)
  const garbage = `开头标记${'x'.repeat(500)}结尾标记`
  let calls = 0
  await assert.rejects(
    spec.generatePrototypeSpec(appId, moduleId, {
      generator: async () => {
        calls += 1
        return garbage
      }
    }),
    (error: unknown) => {
      assert.equal(errorStatus(error), 502)
      assert.match(String((error as Error).message), /原型生成结果无法解析/)
      assert.match(String((error as Error).message), /已自动重试 1 次/)
      const detail = detailOf(error)
      assert.ok(detail.startsWith('开头标记'), `detail 应以开头片段开始：${detail.slice(0, 20)}`)
      assert.ok(detail.endsWith('结尾标记'), 'detail 应保留结尾片段')
      assert.ok(detail.includes('…'), 'detail 中间应为 …')
      assert.ok(detail.length <= spec.SPEC_ERROR_DETAIL_LIMIT + 1, `detail 长度 ${detail.length}`)
      return true
    }
  )
  assert.equal(calls, 2)
  assert.equal(settingsKeys(appId).length, 0, '两次失败不得写规格')
})

test('自动重试（M7-2b）：retry:false 只调用一次，文案不带重试提示', async () => {
  const appId = 'spec-retry-off'
  const moduleId = seedApp(appId)
  let calls = 0
  await assert.rejects(
    spec.generatePrototypeSpec(appId, moduleId, {
      generator: async () => {
        calls += 1
        return '不是 JSON，只是解释文字'
      },
      retry: false
    }),
    (error: unknown) => {
      assert.equal(errorStatus(error), 502)
      assert.ok(!String((error as Error).message).includes('已自动重试'))
      assert.equal(detailOf(error), '不是 JSON，只是解释文字')
      return true
    }
  )
  assert.equal(calls, 1)
})

test('自动重试（M7-2b）：第一次空输出、第二次合法 → 成功', async () => {
  const appId = 'spec-retry-empty'
  const moduleId = seedApp(appId)
  let calls = 0
  const result = await spec.generatePrototypeSpec(appId, moduleId, {
    generator: async () => {
      calls += 1
      return calls === 1 ? '   \n ' : fixedRaw()
    }
  })
  assert.equal(calls, 2)
  assert.equal(result.spec.pages.length, 3)
})

test('自动重试（M7-2b）：第一次归一化后无实体、第二次合法 → 成功', async () => {
  const appId = 'spec-retry-no-entity'
  const moduleId = seedApp(appId)
  let calls = 0
  const result = await spec.generatePrototypeSpec(appId, moduleId, {
    generator: async () => {
      calls += 1
      return calls === 1
        ? JSON.stringify({ entities: [], pages: [{ title: '看板', type: 'dashboard' }] })
        : fixedRaw()
    }
  })
  assert.equal(calls, 2)
  assert.equal(result.spec.entities.length, 2)
})

test('自动重试（M7-2b）：第一次生成期间 abort → 499 且不重试', async () => {
  const appId = 'spec-retry-abort'
  const moduleId = seedApp(appId)
  const controller = new AbortController()
  let calls = 0
  const pending = spec.generatePrototypeSpec(appId, moduleId, {
    signal: controller.signal,
    generator: () => {
      calls += 1
      return new Promise<string>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      })
    }
  })
  controller.abort()
  await assert.rejects(pending, (error: unknown) => errorStatus(error) === 499)
  assert.equal(calls, 1)
  assert.equal(settingsKeys(appId).length, 0)
})

test('自动重试（M7-2b）：模型调用抛错 → 502 原文案，不重试', async () => {
  const appId = 'spec-retry-throw'
  const moduleId = seedApp(appId)
  let calls = 0
  await assert.rejects(
    spec.generatePrototypeSpec(appId, moduleId, {
      generator: async () => {
        calls += 1
        throw new Error('provider 502 boom')
      }
    }),
    (error: unknown) =>
      errorStatus(error) === 502 &&
      String((error as Error).message).includes('原型生成失败') &&
      String((error as Error).message).includes('provider 502 boom')
  )
  assert.equal(calls, 1)
})

test('HTTP（M7-2b）：502 响应含 detail；成功响应结构不变', async () => {
  const appId = 'spec-http-detail'
  const moduleId = seedApp(appId)
  spec.setPrototypeSpecGeneratorForTests({ generate: async () => '模型只说了两句话，没有 JSON', model: 'stub/http-detail' })

  const failed = await postSpec(appId, `?moduleId=${encodeURIComponent(moduleId)}`)
  assert.equal(failed.status, 502)
  assert.match(String(failed.data.error), /无法解析/)
  assert.match(String(failed.data.error), /已自动重试 1 次/)
  assert.equal(failed.data.detail, '模型只说了两句话，没有 JSON')

  spec.setPrototypeSpecGeneratorForTests({ generate: async () => fixedRaw(), model: 'stub/http-detail' })
  const created = await postSpec(appId, `?moduleId=${encodeURIComponent(moduleId)}`)
  assert.equal(created.status, 200)
  assert.deepEqual(Object.keys(created.data).sort(), ['spec', 'specState'])
  assert.equal((created.data.spec as PrototypeSpec).pages.length, 3)
  spec.setPrototypeSpecGeneratorForTests(null)
})
