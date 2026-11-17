/**
 * M7（#8）需求阶段只读原型预览：派生规则 / 类型推断 / 空态 / 模板解析 / 只读 / HTTP。
 *
 * 关键约束（违反即视为缺陷）：
 * - 不建模块/文档/版本/设计项目/页面集/页面；不产 PNG/文件；
 * - 缺省 moduleId 不懒创建默认模块（0 模块应用必须模块行数不变）；
 * - 显式未知 moduleId → 404；归档模块允许只读。
 *
 * 用临时 RG_DATA_DIR/RG_PROJECTS_DIR + 真实 Express 挂载（不调模型、不启 opencode）。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import test, { after, before } from 'node:test'
import type {
  PrototypePreviewPageType,
  RequirementPrototypePreview
} from './prototype-preview'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-proto-preview-'))
const dataDir = path.join(root, 'data')
const projectsDir = path.join(root, 'projects')
process.env.RG_DATA_DIR = dataDir
process.env.RG_PROJECTS_DIR = projectsDir

interface Setup {
  db: typeof import('../db').db
  doc: typeof import('./doc')
  modules: typeof import('./modules')
  preview: typeof import('./prototype-preview')
  designTemplates: typeof import('../design/templates')
}

let setup: Setup
let server: Server | null = null
let base = ''

before(async () => {
  const dbModule = await import('../db')
  const doc = await import('./doc')
  const modules = await import('./modules')
  const preview = await import('./prototype-preview')
  const designTemplates = await import('../design/templates')
  setup = { db: dbModule.db, doc, modules, preview, designTemplates }

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
  server?.close()
  try {
    setup?.db.close()
  } catch {
    // 已关闭
  }
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // Windows 上 SQLite 句柄释放可能滞后
  }
})

/** 所有 app 级表（只读断言用） */
const APP_TABLES = [
  'app_modules',
  'app_requirement_docs',
  'app_requirement_doc_sections',
  'app_requirement_doc_versions',
  'app_requirement_bundles',
  'app_design_projects',
  'app_design_inputs',
  'app_design_entities',
  'app_design_page_sets',
  'app_design_pages',
  'app_design_versions',
  'design_handoffs'
]

function newApp(id: string, name: string): void {
  for (const table of APP_TABLES) {
    try {
      setup.db.prepare(`DELETE FROM ${table} WHERE app_id = ?`).run(id)
    } catch {
      // 表可能不存在（不影响）
    }
  }
  setup.db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  const now = new Date().toISOString()
  setup.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 8081, 'requirements', ?, ?)`
    )
    .run(id, name, id, now, now)
}

/** 建默认模块 + 空文档（走真实服务；仅测试 setup 使用） */
function withModule(appId: string): string {
  const module = setup.modules.ensureDefaultModule(appId)
  setup.doc.ensureRequirementDoc(appId, undefined, module.id)
  return module.id
}

interface OutlineInput {
  epics: Array<{ id: string; title: string; goal?: string; priority?: string; archived?: boolean }>
  stories: Array<{
    id: string
    epicId: string | null
    title: string
    description?: string
    priority?: string
    archived?: boolean
  }>
}

/** 走真实保存路径写 epics 章节（含 ID/顺序归一化） */
function saveOutline(appId: string, moduleId: string, outline: OutlineInput): void {
  setup.doc.saveDocSection(
    appId,
    'epics',
    {
      data: {
        scenes: [],
        epics: outline.epics.map((epic, index) => ({ ...epic, goal: epic.goal ?? '', priority: epic.priority ?? 'P0', sceneId: null, position: index })),
        stories: outline.stories.map((story, index) => ({
          ...story,
          description: story.description ?? '',
          acceptance: [],
          priority: story.priority ?? 'P0',
          position: index
        }))
      }
    },
    moduleId
  )
}

/** 直接写入 data_json（用于普通保存会归一化/丢弃的边界数据：空标题、指向已归档 Epic） */
function forceOutlineData(appId: string, moduleId: string, data: unknown): void {
  setup.db
    .prepare(
      "UPDATE app_requirement_doc_sections SET data_json = ? WHERE app_id = ? AND module_id = ? AND section_key = 'epics'"
    )
    .run(JSON.stringify(data), appId, moduleId)
}

function counts(appId: string): string {
  const result: Record<string, number> = {}
  for (const table of APP_TABLES) {
    const row = setup.db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE app_id = ?`).get(appId) as { c: number }
    result[table] = row.c
  }
  return JSON.stringify(result)
}

function prototypesDirOf(appId: string): string {
  return path.join(projectsDir, appId, 'prototypes')
}

function snapshotPrototypes(appId: string): string[] {
  const dir = prototypesDirOf(appId)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).sort()
}

interface ApiResult {
  status: number
  data: RequirementPrototypePreview & { error?: string }
}

async function get(query = '', appId = ''): Promise<ApiResult> {
  const res = await fetch(`${base}/api/apps/${encodeURIComponent(appId)}/requirements-prototype${query}`)
  const text = await res.text()
  return { status: res.status, data: (text ? JSON.parse(text) : {}) as ApiResult['data'] }
}

function pagesOf(preview: RequirementPrototypePreview, index: number): string[] {
  return preview.pageSets[index].pages.map(page => page.title)
}

test('inferPreviewPageType：8 类 + 并列优先级 + 空标题兜底', () => {
  const { inferPreviewPageType } = setup.preview
  const cases: Array<[string, PrototypePreviewPageType]> = [
    ['统计报表', 'dashboard'],
    ['任务看板', 'kanban'],
    ['编辑排期日历', 'calendar'],
    ['项目甘特图', 'gantt'],
    ['新增商品', 'form'],
    ['商品详情', 'detail'],
    ['商品列表', 'list'],
    ['随便看看', 'list'],
    ['', 'list'],
    ['   ', 'list'],
    ['查询商品详情', 'detail'],
    ['商品报表', 'dashboard']
  ]
  for (const [title, expected] of cases) assert.equal(inferPreviewPageType(title), expected, title)
  // 表顺序即优先级：'管理'（list）出现在 '配置'（form）之后 → form 胜出
  assert.equal(inferPreviewPageType('配置管理'), 'form')
})

test('Epic→页面集 / Story→页面：顺序与文档一致，键为预览期合成键', () => {
  const appId = 'pv-order'
  newApp(appId, '预览顺序')
  const moduleId = withModule(appId)
  saveOutline(appId, moduleId, {
    epics: [
      { id: 'EPIC-001', title: '商品档案维护', goal: '维护商品', priority: 'P0' },
      { id: 'EPIC-002', title: '商品分析', priority: 'P1' }
    ],
    stories: [
      { id: 'STORY-001', epicId: 'EPIC-001', title: '新增商品', description: '录入商品信息' },
      { id: 'STORY-002', epicId: 'EPIC-001', title: '商品列表' },
      { id: 'STORY-003', epicId: 'EPIC-002', title: '统计报表' },
      { id: 'STORY-004', epicId: 'EPIC-002', title: '商品详情' },
      { id: 'STORY-005', epicId: 'EPIC-002', title: '导出商品' }
    ]
  })

  const preview = setup.preview.buildRequirementPrototypePreview(appId, moduleId)
  assert.equal(preview.module?.hasDoc, true)
  assert.equal(preview.module?.docVersion, 1)
  assert.equal(preview.pageSets.length, 2)
  assert.deepEqual(pagesOf(preview, 0), ['新增商品', '商品列表'])
  assert.deepEqual(pagesOf(preview, 1), ['统计报表', '商品详情', '导出商品'])
  assert.deepEqual(
    preview.pageSets[1].pages.map(page => page.type),
    ['dashboard', 'detail', 'list']
  )
  assert.equal(preview.pageSets[0].key, `pv:MOD-001:EPIC-001`)
  assert.equal(preview.pageSets[0].pages[0].key, `pv:MOD-001:STORY-001`)
  assert.equal(preview.stats.epics, 2)
  assert.equal(preview.stats.stories, 5)
  assert.equal(preview.stats.pages, 5)
  assert.equal(preview.stats.unmappedStories, 0)
  assert.equal(preview.warnings.length, 0)
})

test('归档过滤：归档 Epic/Story 不出现；被清空的 Epic 保留 + epic-without-story', () => {
  const appId = 'pv-archived'
  newApp(appId, '预览归档')
  const moduleId = withModule(appId)
  forceOutlineData(appId, moduleId, {
    scenes: [],
    epics: [
      { id: 'EPIC-001', title: '保留', goal: '', priority: 'P0', sceneId: null, position: 0 },
      { id: 'EPIC-002', title: '已归档 Epic', goal: '', priority: 'P0', sceneId: null, position: 1, archived: true },
      { id: 'EPIC-003', title: '空 Epic', goal: '', priority: 'P1', sceneId: null, position: 2 }
    ],
    stories: [
      { id: 'STORY-001', epicId: 'EPIC-001', title: '商品列表', description: '', acceptance: [], priority: 'P0', position: 0 },
      { id: 'STORY-002', epicId: 'EPIC-001', title: '已归档 Story', description: '', acceptance: [], priority: 'P0', position: 1, archived: true },
      { id: 'STORY-003', epicId: 'EPIC-002', title: '归档 Epic 下的 Story', description: '', acceptance: [], priority: 'P0', position: 2 }
    ]
  })

  const preview = setup.preview.buildRequirementPrototypePreview(appId, moduleId)
  // EPIC-002 已归档；其 Story 未被归档 → 未归属页面集
  assert.deepEqual(
    preview.pageSets.map(set => [set.epicId, set.title]),
    [
      ['EPIC-001', '保留'],
      ['EPIC-003', '空 Epic'],
      [null, '未归属 Story']
    ]
  )
  assert.deepEqual(pagesOf(preview, 0), ['商品列表'])
  assert.deepEqual(pagesOf(preview, 1), [])
  assert.deepEqual(pagesOf(preview, 2), ['归档 Epic 下的 Story'])
  assert.ok(preview.warnings.some(item => item.code === 'epic-without-story' && item.epicId === 'EPIC-003'))
  assert.ok(preview.warnings.some(item => item.code === 'unassigned-stories'))
  assert.equal(preview.stats.epics, 2)
  assert.equal(preview.stats.stories, 2)
  assert.equal(preview.stats.unmappedStories, 1)
})

test('未归属 Story：epicId=null / 指向不存在 Epic；空标题给 story-without-title', () => {
  const appId = 'pv-unassigned'
  newApp(appId, '预览未归属')
  const moduleId = withModule(appId)
  forceOutlineData(appId, moduleId, {
    scenes: [],
    epics: [{ id: 'EPIC-001', title: '商品维护', goal: '', priority: 'P0', sceneId: null, position: 0 }],
    stories: [
      { id: 'STORY-001', epicId: null, title: '孤立列表', description: '', acceptance: [], priority: 'P0', position: 0 },
      { id: 'STORY-002', epicId: 'EPIC-999', title: '错指 Epic', description: '', acceptance: [], priority: 'P0', position: 1 },
      { id: 'STORY-003', epicId: 'EPIC-001', title: '', description: '', acceptance: [], priority: 'P0', position: 2 }
    ]
  })

  const preview = setup.preview.buildRequirementPrototypePreview(appId, moduleId)
  assert.equal(preview.pageSets.length, 2)
  assert.equal(preview.pageSets[1].epicId, null)
  assert.equal(preview.pageSets[1].key, 'pv:MOD-001:unassigned')
  assert.deepEqual(pagesOf(preview, 1), ['孤立列表', '错指 Epic'])
  const emptyStory = preview.pageSets[0].pages[0]
  assert.equal(emptyStory.title, '')
  assert.equal(emptyStory.type, 'list')
  assert.ok(preview.warnings.some(item => item.code === 'story-without-title' && item.storyId === 'STORY-003'))
  assert.equal(preview.warnings.filter(item => item.code === 'unassigned-stories').length, 1)
})

test('summary 截断 160 字（去换行）；priority 透传', () => {
  const appId = 'pv-summary'
  newApp(appId, '预览摘要')
  const moduleId = withModule(appId)
  saveOutline(appId, moduleId, {
    epics: [{ id: 'EPIC-001', title: '摘要', priority: 'P0' }],
    stories: [{ id: 'STORY-001', epicId: 'EPIC-001', title: '商品列表', description: `第一行\n${'长'.repeat(200)}`, priority: 'P1' }]
  })
  const page = setup.preview.buildRequirementPrototypePreview(appId, moduleId).pageSets[0].pages[0]
  assert.ok(!page.summary.includes('\n'))
  assert.equal(page.summary.length, 161)
  assert.ok(page.summary.endsWith('…'))
  assert.equal(page.priority, 'P1')
})

test('无文档模块：pageSets [] + no-epics + hasDoc:false，且不创建文档/章节', () => {
  const appId = 'pv-nodoc'
  newApp(appId, '预览无文档')
  const module = setup.modules.ensureDefaultModule(appId)
  // 不建文档，先删掉可能已有的
  setup.db.prepare('DELETE FROM app_requirement_doc_sections WHERE app_id = ?').run(appId)
  setup.db.prepare('DELETE FROM app_requirement_docs WHERE app_id = ?').run(appId)

  const before = counts(appId)
  const preview = setup.preview.buildRequirementPrototypePreview(appId, module.id)
  assert.equal(preview.module?.hasDoc, false)
  assert.equal(preview.module?.docVersion, 0)
  assert.deepEqual(preview.pageSets, [])
  assert.deepEqual(preview.warnings.map(item => item.code), ['no-epics'])
  assert.equal(preview.template?.id, 'builtin-prototype-enterprise')
  assert.equal(counts(appId), before)
})

test('0 模块应用：module:null + no-module，且不懒创建模块', () => {
  const appId = 'pv-nomodule'
  newApp(appId, '预览无模块')
  const before = counts(appId)
  assert.equal((setup.db.prepare('SELECT COUNT(*) AS c FROM app_modules WHERE app_id = ?').get(appId) as { c: number }).c, 0)

  const preview = setup.preview.buildRequirementPrototypePreview(appId)
  assert.equal(preview.module, null)
  assert.equal(preview.template, null)
  assert.deepEqual(preview.pageSets, [])
  assert.deepEqual(preview.warnings.map(item => item.code), ['no-module'])
  assert.equal(counts(appId), before)
  assert.equal((setup.db.prepare('SELECT COUNT(*) AS c FROM app_modules WHERE app_id = ?').get(appId) as { c: number }).c, 0)
})

test('归档模块允许只读；显式未知 moduleId 404', () => {
  const appId = 'pv-archived-module'
  newApp(appId, '预览归档模块')
  const moduleId = withModule(appId)
  saveOutline(appId, moduleId, {
    epics: [{ id: 'EPIC-001', title: '归档模块 Epics' }],
    stories: [{ id: 'STORY-001', epicId: 'EPIC-001', title: '商品列表' }]
  })
  setup.db.prepare('UPDATE app_modules SET archived_at = ? WHERE app_id = ? AND id = ?').run(new Date().toISOString(), appId, moduleId)
  const before = counts(appId)

  const preview = setup.preview.buildRequirementPrototypePreview(appId, moduleId)
  assert.equal(preview.module?.archived, true)
  assert.equal(preview.pageSets.length, 1)
  assert.equal(counts(appId), before)

  assert.throws(
    () => setup.preview.buildRequirementPrototypePreview(appId, 'MOD-999'),
    (error: unknown) => (error as { status?: number }).status === 404
  )
})

test('模板来源三档：design-project > app-default > global-default；模板删除回退不 500', () => {
  const appId = 'pv-template'
  newApp(appId, '预览模板')
  const moduleId = withModule(appId)

  // 1) 全局默认
  const globalDefault = setup.preview.buildRequirementPrototypePreview(appId, moduleId)
  assert.equal(globalDefault.template?.source, 'global-default')
  assert.equal(globalDefault.template?.id, 'builtin-prototype-enterprise')
  assert.equal(globalDefault.template?.category, 'enterprise')
  assert.ok(globalDefault.template?.pageSetRules.defaultPageSize)
  assert.equal((globalDefault.template as unknown as { prompt?: unknown }).prompt, undefined)

  // 2) 应用默认
  setup.db.prepare('UPDATE apps SET prototype_template_id = ? WHERE id = ?').run('builtin-prototype-minimal', appId)
  const appDefault = setup.preview.buildRequirementPrototypePreview(appId, moduleId)
  assert.equal(appDefault.template?.source, 'app-default')
  assert.equal(appDefault.template?.id, 'builtin-prototype-minimal')

  // 3) 设计项目覆盖
  const now = new Date().toISOString()
  setup.db
    .prepare(
      `INSERT INTO app_design_projects
         (app_id, module_id, prototype_template_id, status, version, created_at, updated_at)
       VALUES (?, ?, 'builtin-prototype-enterprise', 'draft', 1, ?, ?)`
    )
    .run(appId, moduleId, now, now)
  const project = setup.preview.buildRequirementPrototypePreview(appId, moduleId)
  assert.equal(project.template?.source, 'design-project')
  assert.equal(project.template?.id, 'builtin-prototype-enterprise')

  // 4) 模板被删除：应用默认指向已删除模板 → 回退全局默认，不抛错
  setup.db.prepare('DELETE FROM app_design_projects WHERE app_id = ?').run(appId)
  const created = setup.designTemplates.createPrototypeTemplate({ name: '临时模板', category: 'custom', prompt: 'x' })
  setup.db.prepare('UPDATE apps SET prototype_template_id = ? WHERE id = ?').run(created.id, appId)
  assert.equal(setup.preview.buildRequirementPrototypePreview(appId, moduleId).template?.source, 'app-default')
  setup.designTemplates.deletePrototypeTemplate(created.id)
  const fallback = setup.preview.buildRequirementPrototypePreview(appId, moduleId)
  assert.equal(fallback.template?.source, 'global-default')
  assert.equal(fallback.template?.id, 'builtin-prototype-enterprise')
})

test('只读：请求前后所有 app 级表行数不变，且 projects/<app>/prototypes 无新增', () => {
  const appId = 'pv-readonly'
  newApp(appId, '预览只读')
  const moduleId = withModule(appId)
  saveOutline(appId, moduleId, {
    epics: [{ id: 'EPIC-001', title: '商品维护' }],
    stories: [{ id: 'STORY-001', epicId: 'EPIC-001', title: '商品列表' }]
  })
  const beforeCounts = counts(appId)
  const beforeFiles = snapshotPrototypes(appId)

  for (let index = 0; index < 3; index += 1) setup.preview.buildRequirementPrototypePreview(appId, moduleId)

  assert.equal(counts(appId), beforeCounts)
  assert.deepEqual(snapshotPrototypes(appId), beforeFiles)
  assert.equal(fs.existsSync(prototypesDirOf(appId)), false)
})

test('HTTP：200 结构完整；缺省 moduleId = 默认模块；未知查询参数忽略；404 应用/模块', async () => {
  const appId = 'pv-http'
  newApp(appId, '预览 HTTP')
  const moduleId = withModule(appId)
  saveOutline(appId, moduleId, {
    epics: [{ id: 'EPIC-001', title: '商品维护', priority: 'P0' }],
    stories: [{ id: 'STORY-001', epicId: 'EPIC-001', title: '商品详情', description: '查看详情' }]
  })

  const ok = await get('', appId)
  assert.equal(ok.status, 200)
  assert.equal(ok.data.appId, appId)
  assert.equal(typeof ok.data.generatedAt, 'string')
  assert.equal(ok.data.module?.key, 'MOD-001')
  assert.equal(ok.data.module?.docVersion, 1)
  assert.equal(ok.data.template?.source, 'global-default')
  assert.equal(ok.data.pageSets.length, 1)
  assert.equal(ok.data.pageSets[0].pages[0].type, 'detail')
  assert.equal(ok.data.stats.pages, 1)
  assert.deepEqual(ok.data.warnings, [])

  const defaults = await get('?moduleId=&unknown=1', appId)
  assert.equal(defaults.status, 200)
  assert.equal(defaults.data.module?.id, moduleId)

  const missingModule = await get('?moduleId=MOD-404', appId)
  assert.equal(missingModule.status, 404)

  const missingApp = await get('', 'app-does-not-exist')
  assert.equal(missingApp.status, 404)
})

test('HTTP：0 模块应用返回 200 空态（不是 404）', async () => {
  const appId = 'pv-http-nomodule'
  newApp(appId, '预览 HTTP 无模块')
  const before = counts(appId)
  const res = await get('', appId)
  assert.equal(res.status, 200)
  assert.equal(res.data.module, null)
  assert.deepEqual(res.data.pageSets, [])
  assert.deepEqual((res.data.warnings ?? []).map(item => item.code), ['no-module'])
  assert.equal(counts(appId), before)
})
