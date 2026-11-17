/**
 * D-RMP 单测：设计阶段按 Epic 生成（实体合并 / 页面集 primary 替换 / 版本 / 确认重开 / 守卫 / fallback / HTTP）。
 *
 * 不调用真实模型：service 层通过 `options.generator` 注入；HTTP 层 stub `opencode.generateText`。
 * 临时 RG_DATA_DIR + RG_PROJECTS_DIR；不启动 opencode。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-design-epic-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')

interface Setup {
  db: typeof import('../db').db
  modules: typeof import('../requirements/modules')
  doc: typeof import('../requirements/doc')
  service: typeof import('./service')
  prompt: typeof import('./prompt')
  epic: typeof import('./epic-context')
  opencode: typeof import('../opencode/runtime').opencode
}

let setup: Setup
let server: Server | null = null
let base = ''

const TABLES = [
  'app_design_pages',
  'app_design_page_sets',
  'app_design_entities',
  'app_design_versions',
  'app_design_inputs',
  'app_design_projects',
  'app_requirement_doc_versions',
  'app_requirement_doc_sections',
  'app_requirement_docs',
  'app_requirement_bundles',
  'app_modules',
  'app_change_sets',
  'design_handoffs',
  'app_stage_events'
]

before(async () => {
  const dbModule = await import('../db')
  const modules = await import('../requirements/modules')
  const doc = await import('../requirements/doc')
  const service = await import('./service')
  const prompt = await import('./prompt')
  const epic = await import('./epic-context')
  const runtime = await import('../opencode/runtime')
  setup = { db: dbModule.db, modules, doc, service, prompt, epic, opencode: runtime.opencode }

  const express = (await import('express')).default
  const { apps, appsErrorHandler } = await import('../apps/routes')
  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/apps', apps)
  app.use('/api/apps', appsErrorHandler)
  server = app.listen(0)
  await new Promise<void>(resolve => server?.once('listening', () => resolve()))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
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

function newApp(id: string): void {
  for (const table of TABLES) {
    try {
      setup.db.prepare(`DELETE FROM ${table} WHERE app_id = ?`).run(id)
    } catch {
      // 表无 app_id 时忽略
    }
  }
  // 设计实体/页面集/页面 ID 全局唯一（跨应用）；用例之间清空，避免 raw id 被换成新 ID
  for (const table of [
    'app_design_pages',
    'app_design_page_sets',
    'app_design_entities',
    'app_design_versions',
    'app_design_inputs',
    'app_design_projects'
  ]) {
    setup.db.prepare(`DELETE FROM ${table}`).run()
  }
  setup.db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  const now = new Date().toISOString()
  setup.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 8081, 'requirements', ?, ?)`
    )
    .run(id, `应用 ${id}`, id, now, now)
  fs.mkdirSync(path.join(root, 'projects', id), { recursive: true })
}

function fillRequiredSections(appId: string, moduleId?: string): void {
  for (const section of setup.doc.ensureRequirementDoc(appId, undefined, moduleId).sections) {
    if (!section.required || section.markdown.trim()) continue
    setup.doc.saveDocSection(appId, section.sectionKey, { markdown: `内容-${section.title}` }, moduleId)
  }
}

/** Epics/Stories 结构化需求并确认（EPIC-001/002 + STORY-001..004） */
function seedStructuredRequirement(appId: string): string {
  newApp(appId)
  const module = setup.modules.ensureDefaultModule(appId)
  setup.doc.saveDocSection(appId, 'epics', {
    data: {
      scenes: [],
      epics: [
        { id: 'EPIC-001', title: '商品档案', goal: '维护商品主数据', priority: 'P0' },
        { id: 'EPIC-002', title: '订单管理', goal: '创建与查询订单', priority: 'P1' }
      ],
      stories: [
        {
          id: 'STORY-001',
          epicId: 'EPIC-001',
          title: '创建商品',
          description: '作为运营，我希望创建商品档案',
          acceptance: ['必填字段校验'],
          priority: 'P0'
        },
        {
          id: 'STORY-002',
          epicId: 'EPIC-001',
          title: '编辑商品',
          description: '作为运营，我希望修改商品',
          acceptance: ['保存后列表可见'],
          priority: 'P1'
        },
        {
          id: 'STORY-003',
          epicId: 'EPIC-002',
          title: '创建订单',
          description: '作为业务员，我希望创建订单',
          acceptance: ['校验库存'],
          priority: 'P0'
        },
        {
          id: 'STORY-004',
          epicId: 'EPIC-002',
          title: '查询订单',
          description: '作为主管，我希望按客户查询订单',
          acceptance: ['能按客户筛选'],
          priority: 'P1'
        }
      ]
    }
  })
  fillRequiredSections(appId)
  setup.doc.confirmRequirementDoc(appId)
  return module.id
}

/** 只有场景（无 Epic）的需求：用于 fallback 场景节点 */
function seedSceneRequirement(appId: string): string {
  newApp(appId)
  const module = setup.modules.ensureDefaultModule(appId)
  setup.doc.saveDocSection(appId, 'scenes', {
    data: {
      scenes: [{ title: '订单管理', description: '销售维护订单' }],
      epics: [],
      stories: []
    }
  })
  // 确认前给 Epics 章节一个合法 Story 行（仅用于通过确认校验；确认后再清空 → fallback）
  setup.db
    .prepare('UPDATE app_requirement_doc_sections SET markdown = ? WHERE app_id = ? AND section_key = ?')
    .run('- 作为运营，我希望按场景维护订单，以便跟踪状态', appId, 'epics')
  fillRequiredSections(appId)
  setup.doc.confirmRequirementDoc(appId)
  // 模拟“旧/空 Epics 结构”的已确认文档：确认后清空 Epics 章节内容（不再改动其它章节），
  // 让设计输入走 fallback（无 Epic）分支，用 SCENE-xxx 作为生成节点。
  setup.db
    .prepare('UPDATE app_requirement_doc_sections SET markdown = ?, data_json = NULL WHERE app_id = ? AND section_key = ?')
    .run('', appId, 'epics')
  return module.id
}

function entity(id: string, name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    name,
    tableName: `t_${id.replace(/-/g, '_')}`,
    description: '',
    fields: [
      { name: 'id', label: 'ID', type: 'string', unique: true },
      { name: 'name', label: '名称', type: 'string' }
    ],
    relations: [],
    requirementRefs: [],
    status: 'draft',
    ...overrides
  }
}

function pageSet(
  id: string,
  title: string,
  epicId: string | null,
  storyIds: string[],
  pages: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    sceneKey: epicId ?? 'SCENE-001',
    epicId,
    storyIds,
    title,
    description: '',
    status: 'draft',
    pages,
    ...extra
  }
}

function page(
  pageKey: string,
  title: string,
  entityId: string,
  type = 'list',
  refs: string[] = [],
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    pageKey,
    title,
    type,
    entityId,
    requirementRefs: refs,
    spec: { actions: ['create'], columns: ['id', 'name'], searchFields: ['name'] },
    ...extra
  }
}

/** 两次调用的 generator 桩：第一次实体、第二次页面集 */
function generatorOf(
  entities: unknown[],
  pageSets: unknown[]
): (system: string, user: string) => Promise<Record<string, unknown>> {
  let call = 0
  return async () => {
    call += 1
    if (call === 1) return { entities }
    return { pageSets }
  }
}

function designVersions(appId: string, moduleId: string): Array<{ version: number; source: string }> {
  return setup.service.listDesignVersions(appId, moduleId)
}

test('D-RMP mergeEntitiesForEpic：新增/更新合并，保留其它 Epic 与未提及字段/关系', async () => {
  const appId = 'epic-merge'
  seedStructuredRequirement(appId)
  const moduleId = setup.modules.ensureDefaultModule(appId).id
  setup.service.saveEntities(
    appId,
    [
      entity('ent-product', '商品', {
        requirementRefs: ['STORY-001'],
        status: 'confirmed',
        tableName: 'biz_product',
        description: '商品主表',
        fields: [
          { name: 'id', label: 'ID', type: 'string', unique: true },
          { name: 'name', label: '名称', type: 'string', required: true },
          { name: 'legacyCode', label: '旧编码', type: 'string' }
        ],
        relations: [{ name: '品牌', type: 'many-to-one', target: 'ent-brand' }]
      }),
      entity('ent-brand', '品牌', { requirementRefs: ['STORY-003'], status: 'confirmed' })
    ],
    'manual',
    { moduleId }
  )
  const existing = setup.service.getDesign(appId, moduleId).entities
  const result = setup.service.mergeEntitiesForEpic(existing, [
    {
      id: 'ent-product',
      name: '商品',
      description: '商品档案主表',
      requirementRefs: ['STORY-002'],
      fields: [
        { name: 'name', label: '商品名称', type: 'string', required: true },
        { name: 'price', label: '价格', type: 'decimal', precision: 2 }
      ],
      relations: [{ name: '分类', type: 'many-to-one', target: 'ent-brand' }]
    },
    {
      name: '商品明细',
      fields: [{ name: 'id', label: 'ID', type: 'string', unique: true }],
      requirementRefs: ['STORY-001']
    }
  ])
  assert.equal(result.added, 1)
  assert.equal(result.updated, 1)
  assert.equal(result.raw.length, 3)
  const product = result.raw.find(item => item.id === 'ent-product') as Record<string, unknown>
  const fields = product.fields as Array<{ name: string; label: string }>
  assert.deepEqual(
    fields.map(field => field.name),
    ['id', 'name', 'legacyCode', 'price'],
    '未提及字段保留，生成字段覆盖同名并追加新字段'
  )
  assert.equal(fields[1].label, '商品名称', '同名字段被生成内容覆盖')
  const relations = product.relations as Array<{ name: string }>
  assert.deepEqual(relations.map(relation => relation.name), ['品牌', '分类'], '未提及关系保留')
  assert.equal(product.description, '商品档案主表')
  assert.equal(product.status, 'draft', '被更新的实体退回 draft')
  assert.deepEqual((product.requirementRefs as string[]).sort(), ['STORY-001', 'STORY-002'], 'refs 取并集')
  const brand = result.raw.find(item => item.id === 'ent-brand') as Record<string, unknown>
  assert.equal(brand.status, 'confirmed', '其它 Epic 实体原样保留')
  assert.equal(brand.name, '品牌')
})

test('D-RMP mergePageSetForEpic：primary 替换保留 id；其它页面集保留；无 primary 追加', async () => {
  const appId = 'epic-merge-sets'
  const moduleId = seedStructuredRequirement(appId)
  const saved = setup.service.savePageSets(
    appId,
    [
      pageSet('ps-epic1', '商品档案', 'EPIC-001', ['STORY-001'], [
        page('product-list', '商品列表', 'ent-product', 'list', ['STORY-001'])
      ]),
      pageSet('ps-epic1-manual', '商品档案补充', 'EPIC-001', ['STORY-002'], [
        page('product-detail', '商品详情', 'ent-product', 'detail', ['STORY-002'])
      ], { sceneKey: 'EPIC-001-manual' }),
      pageSet('ps-epic2', '订单管理', 'EPIC-002', ['STORY-003'], [
        page('order-list', '订单列表', 'ent-order', 'list', ['STORY-003'])
      ])
    ],
    'manual',
    { moduleId }
  )
  const node = {
    id: 'EPIC-001',
    title: '商品档案',
    goal: '',
    priority: '',
    sceneId: null,
    isScene: false,
    stories: [
      { id: 'STORY-001', epicId: 'EPIC-001', title: '创建商品', description: '', acceptance: [], priority: '', position: 0 },
      { id: 'STORY-002', epicId: 'EPIC-001', title: '编辑商品', description: '', acceptance: [], priority: '', position: 1 }
    ]
  }
  const merged = setup.service.mergePageSetForEpic(
    saved.pageSets,
    {
      title: '商品档案（重新生成）',
      storyIds: ['STORY-001'],
      pages: [page('product-list', '商品列表', 'ent-product', 'list', ['STORY-001'])]
    },
    node
  )
  assert.equal(merged.replaced, true)
  const primary = merged.raw.find(item => item.id === 'ps-epic1') as Record<string, unknown>
  assert.equal(primary.title, '商品档案（重新生成）')
  assert.equal(primary.status, 'draft')
  assert.deepEqual(primary.storyIds, ['STORY-001', 'STORY-002'], 'storyIds 强制为本 Epic 全部 Story')
  assert.equal(primary.epicId, 'EPIC-001')
  assert.equal((primary.pages as unknown[]).length, 1, 'primary 页面整体替换')
  assert.ok(merged.raw.some(item => item.id === 'ps-epic1-manual'), '同 Epic 手工额外页面集保留')
  assert.ok(merged.raw.some(item => item.id === 'ps-epic2'), '其它 Epic 页面集保留')

  // 新 Epic（无 primary）→ 追加
  const newNode = { ...node, id: 'EPIC-009', title: '新 Epic', stories: [] }
  const appended = setup.service.mergePageSetForEpic(
    saved.pageSets,
    { title: '新 Epic 页面', pages: [page('x', 'X', 'ent-product')] },
    newNode
  )
  assert.equal(appended.replaced, false)
  assert.equal(appended.raw.length, saved.pageSets.length + 1)
  const fresh = appended.raw[appended.raw.length - 1] as Record<string, unknown>
  assert.equal(fresh.epicId, 'EPIC-009')
  assert.equal(fresh.sceneKey, 'EPIC-009')
  assert.equal(fresh.position, saved.pageSets.length)
})

test('D-RMP prompt：实体/页面集 prompt 只聚焦当前 Epic；focusBrief 支持 epic 与 fallback 场景', async () => {
  const appId = 'epic-prompt'
  const moduleId = seedStructuredRequirement(appId)
  const project = setup.service.getDesign(appId, moduleId)
  const node = setup.epic.findEpicNode(project, 'EPIC-001')
  assert.ok(node)
  const entityPrompt = setup.prompt.buildEpicEntityGenerationPrompt(project, node)
  assert.match(entityPrompt.system, /按 Epic 生成/)
  assert.match(entityPrompt.user, /当前 Epic/)
  assert.match(entityPrompt.user, /EPIC-001/)
  assert.match(entityPrompt.user, /STORY-001/)
  assert.match(entityPrompt.user, /STORY-002/)
  const pagePrompt = setup.prompt.buildEpicPageSetGenerationPrompt(project, node, project.entities)
  assert.match(pagePrompt.system, /只输出一个页面集/)
  assert.match(pagePrompt.system, /STORY-001、STORY-002/, '页面集 prompt 约束本 Epic 全部 Story')
  const chatPrompt = setup.prompt.buildDesignChatPrompt(
    { project, focus: { kind: 'epic', id: 'EPIC-001' } },
    [{ role: 'user', content: '按当前 Epic 补全设计' }]
  )
  assert.match(chatPrompt, /当前聚焦 Epic\/场景/)
  assert.match(chatPrompt, /STORY-001/)
  assert.match(chatPrompt, /生成建议/)

  // fallback：设计输入无 Epic，SCENE-xxx 作为节点
  const sceneApp = 'epic-prompt-scene'
  const sceneModuleId = seedSceneRequirement(sceneApp)
  const sceneProject = setup.service.getDesign(sceneApp, sceneModuleId)
  assert.equal(sceneProject.input?.epics.length, 0)
  const sceneId = sceneProject.input?.scenes[0]?.id ?? ''
  assert.match(sceneId, /^SCENE-\d+$/)
  const sceneNode = setup.epic.findEpicNode(sceneProject, sceneId)
  assert.equal(sceneNode?.isScene, true)
  const sceneChat = setup.prompt.buildDesignChatPrompt(
    { project: sceneProject, focus: { kind: 'epic', id: sceneId } },
    [{ role: 'user', content: '补全页面' }]
  )
  assert.match(sceneChat, /fallback 场景/)
  assert.equal(setup.epic.findEpicNode(sceneProject, 'EPIC-001'), null)
})

test('D-RMP generateEpicDesign：实体合并 + 页面集替换 + 每 Epic 一个版本 + draft', async () => {
  const appId = 'epic-generate'
  const moduleId = seedStructuredRequirement(appId)
  // 其它 Epic 已有实体/页面集（confirmed），生成 EPIC-001 时不得丢
  setup.service.saveEntities(
    appId,
    [entity('ent-order', '订单', { requirementRefs: ['STORY-003'], status: 'confirmed' })],
    'manual',
    { moduleId }
  )
  setup.service.savePageSets(
    appId,
    [
      pageSet(
        'ps-order',
        '订单管理',
        'EPIC-002',
        ['STORY-003', 'STORY-004'],
        [page('order-list', '订单列表', 'ent-order', 'list', ['STORY-003'])],
        { status: 'confirmed' }
      )
    ],
    'manual',
    { moduleId }
  )
  const before = setup.service.getDesign(appId, moduleId)
  const beforeVersion = before.version

  const result = await setup.service.generateEpicDesign(appId, 'EPIC-001', {
    moduleId,
    generator: generatorOf(
      [
        {
          id: 'ent-product',
          name: '商品',
          tableName: 'biz_product',
          description: '商品主表',
          requirementRefs: ['STORY-001', 'STORY-002'],
          fields: [
            { name: 'id', label: 'ID', type: 'string', unique: true },
            { name: 'name', label: '商品名称', type: 'string', required: true },
            { name: 'price', label: '价格', type: 'decimal' }
          ],
          relations: []
        }
      ],
      [
        {
          sceneKey: 'EPIC-001',
          epicId: 'EPIC-001',
          storyIds: ['STORY-001', 'STORY-002'],
          title: '商品档案',
          pages: [
            page('product-list', '商品列表', 'ent-product', 'list', ['STORY-001']),
            {
              pageKey: 'product-create',
              title: '创建商品',
              type: 'form',
              entityId: 'ent-product',
              requirementRefs: ['STORY-001'],
              spec: { mode: 'create', fields: ['name', 'price'], actions: ['submit', 'cancel'] }
            },
            page('product-detail', '商品详情', 'ent-product', 'detail', ['STORY-002'])
          ]
        }
      ]
    )
  })

  assert.equal(result.epicId, 'EPIC-001')
  assert.equal(result.entitiesAdded, 1)
  assert.equal(result.pages, 3)
  assert.deepEqual(result.reopened, [])
  const project = result.project
  assert.equal(project.status, 'draft', '生成不自动确认')
  assert.equal(project.version, beforeVersion + 1, '每个 Epic 一个版本')
  const versions = designVersions(appId, moduleId)
  assert.equal(versions[0].version, project.version)
  assert.equal(versions[0].source, 'ai')
  const product = project.entities.find(item => item.name === '商品')
  assert.ok(product)
  assert.equal(product?.status, 'draft')
  assert.deepEqual(product?.requirementRefs.sort(), ['STORY-001', 'STORY-002'])
  const order = project.entities.find(item => item.name === '订单')
  assert.equal(order?.status, 'confirmed', '其它 Epic 实体保留')
  const set = project.pageSets.find(item => item.epicId === 'EPIC-001')
  assert.ok(set)
  assert.equal(set?.status, 'draft')
  assert.deepEqual(set?.pages.map(item => item.type), ['list', 'form', 'detail'])
  assert.deepEqual(
    set?.pages.map(item => item.requirementRefs).flat(),
    ['STORY-001', 'STORY-001', 'STORY-002'],
    '页面 requirementRefs 为 Story'
  )
  assert.equal(set?.pages.find(item => item.pageKey === 'product-create')?.spec.mode, 'create')
  assert.equal(set?.pages.every(item => item.entityId === 'ent-product'), true, '页面绑定生成实体')
  const other = project.pageSets.find(item => item.id === 'ps-order')
  assert.equal(other?.status, 'confirmed', '其它 Epic 页面集原样保留')
  assert.equal(result.pageSetId, set?.id)
})

test('D-RMP generateEpicDesign：再次生成同一 Epic 保留 primary 页面集 id，其它页面集保留', async () => {
  const appId = 'epic-regenerate'
  const moduleId = seedStructuredRequirement(appId)
  const generator = generatorOf(
    [
      entity('ent-product', '商品', {
        requirementRefs: ['STORY-001'],
        fields: [
          { name: 'id', label: 'ID', type: 'string', unique: true },
          { name: 'name', label: '名称', type: 'string' }
        ]
      })
    ],
    [
      pageSet('ps-generated', '商品档案', 'EPIC-001', ['STORY-001'], [
        page('product-list', '商品列表', 'ent-product', 'list', ['STORY-001'])
      ])
    ]
  )
  const first = await setup.service.generateEpicDesign(appId, 'EPIC-001', { moduleId, generator })
  const firstSetId = first.pageSetId
  assert.ok(firstSetId)
  // 人工额外页面集（同 Epic，独立 sceneKey）
  const current = setup.service.getDesign(appId, moduleId)
  setup.service.savePageSets(
    appId,
    [
      ...current.pageSets,
      pageSet(
        'ps-manual',
        '商品手工页面集',
        'EPIC-001',
        ['STORY-002'],
        [page('manual-list', '手工列表', 'ent-product', 'list', ['STORY-002'])],
        { sceneKey: 'EPIC-001-manual' }
      )
    ],
    'manual',
    { moduleId }
  )
  const beforeVersion = setup.service.getDesign(appId, moduleId).version
  const second = await setup.service.generateEpicDesign(appId, 'EPIC-001', {
    moduleId,
    generator: generatorOf(
      [entity('ent-product', '商品', { requirementRefs: ['STORY-001'], description: '更新后的商品' })],
      [
        pageSet('', '商品档案 v2', 'EPIC-001', ['STORY-001'], [
          page('product-list', '商品列表', 'ent-product', 'list', ['STORY-001']),
          page('product-detail', '商品详情', 'ent-product', 'detail', ['STORY-002'])
        ])
      ]
    )
  })
  assert.equal(second.pageSetId, firstSetId, '重新生成替换 primary 并保留其 id')
  assert.equal(second.project.version, beforeVersion + 1)
  const set = second.project.pageSets.find(item => item.id === firstSetId)
  assert.equal(set?.title, '商品档案 v2')
  assert.equal(set?.pages.length, 2)
  assert.ok(second.project.pageSets.some(item => item.id === 'ps-manual'), '手工额外页面集保留')
  assert.equal(second.entitiesUpdated, 1, '已有实体按 Epic 更新')
  assert.equal(second.project.entities[0].description, '更新后的商品')
})

test('D-RMP generateEpicDesign：模型失败/空输出不写库、不产版本', async () => {
  const appId = 'epic-fail'
  const moduleId = seedStructuredRequirement(appId)
  const before = setup.service.getDesign(appId, moduleId)

  await assert.rejects(
    setup.service.generateEpicDesign(appId, 'EPIC-001', {
      moduleId,
      generator: async () => {
        throw new Error('模拟模型失败')
      }
    }),
    /模拟模型失败/
  )
  await assert.rejects(
    setup.service.generateEpicDesign(appId, 'EPIC-001', {
      moduleId,
      generator: async () => ({ entities: [] })
    }),
    /没有可复用的实体/
  )
  await assert.rejects(
    setup.service.generateEpicDesign(appId, 'EPIC-001', {
      moduleId,
      generator: generatorOf([entity('ent-product', '商品')], [])
    }),
    /pageSets/
  )
  await assert.rejects(
    setup.service.generateEpicDesign(appId, 'EPIC-001', {
      moduleId,
      generator: generatorOf([entity('ent-product', '商品')], [{ epicId: 'EPIC-001', title: '空', pages: [] }])
    }),
    /没有页面/
  )
  const after = setup.service.getDesign(appId, moduleId)
  assert.equal(after.entities.length, before.entities.length, '失败不写实体')
  assert.equal(after.pageSets.length, before.pageSets.length, '失败不写页面集')
  assert.equal(after.version, before.version, '失败不产版本')
})

test('D-RMP 已确认目标：无 reopenConfirmed → 409；勾选后仅目标退回 draft', async () => {
  const appId = 'epic-confirmed'
  const moduleId = seedStructuredRequirement(appId)
  setup.service.saveEntities(
    appId,
    [
      entity('ent-product', '商品', { requirementRefs: ['STORY-001'], status: 'confirmed' }),
      entity('ent-order', '订单', { requirementRefs: ['STORY-003'], status: 'confirmed' })
    ],
    'manual',
    { moduleId }
  )
  setup.service.savePageSets(
    appId,
    [
      pageSet(
        'ps-product',
        '商品档案',
        'EPIC-001',
        ['STORY-001'],
        [page('product-list', '商品列表', 'ent-product', 'list', ['STORY-001'], { status: 'confirmed' })],
        { status: 'confirmed' }
      )
    ],
    'manual',
    { moduleId }
  )
  const before = setup.service.getDesign(appId, moduleId)
  await assert.rejects(
    setup.service.generateEpicDesign(appId, 'EPIC-001', {
      moduleId,
      generator: generatorOf([entity('ent-product', '商品')], [])
    }),
    (error: unknown) => {
      assert.match(String((error as Error).message), /允许重新打开已确认项/)
      const issues = ((error as { issues?: string[] }).issues ?? []).join('\n')
      assert.match(issues, /实体「商品」已确认/)
      assert.match(issues, /页面集「商品档案」已确认/)
      assert.match(issues, /页面「商品列表」已确认/)
      return true
    }
  )
  assert.equal(setup.service.getDesign(appId, moduleId).version, before.version, '409 不产版本')

  const result = await setup.service.generateEpicDesign(appId, 'EPIC-001', {
    moduleId,
    reopenConfirmed: true,
    generator: generatorOf(
      [entity('ent-product', '商品', { requirementRefs: ['STORY-001'], description: '重开后的商品' })],
      [
        pageSet('', '商品档案', 'EPIC-001', ['STORY-001'], [
          page('product-list', '商品列表', 'ent-product', 'list', ['STORY-001'])
        ])
      ]
    )
  })
  assert.ok(result.reopened.includes('ent-product'))
  assert.ok(result.reopened.includes('ps-product'))
  const product = result.project.entities.find(item => item.name === '商品')
  assert.equal(product?.status, 'draft', '受影响实体退回 draft')
  const order = result.project.entities.find(item => item.name === '订单')
  assert.equal(order?.status, 'confirmed', '其它 confirmed 实体保留')
  const set = result.project.pageSets.find(item => item.id === 'ps-product')
  assert.equal(set?.status, 'draft')
  assert.equal(set?.pages.every(item => item.status === 'draft'), true)
})

test('D-RMP 误复用其它 Epic 已确认实体：默认 409，勾选 reopenConfirmed 后重开', async () => {
  const appId = 'epic-cross-confirmed'
  const moduleId = seedStructuredRequirement(appId)
  setup.service.saveEntities(
    appId,
    [entity('ent-order', '订单', { requirementRefs: ['STORY-003'], status: 'confirmed' })],
    'manual',
    { moduleId }
  )
  const before = setup.service.getDesign(appId, moduleId)
  let call = 0
  const stub = async (): Promise<Record<string, unknown>> => {
    call += 1
    if (call === 1) {
      return {
        entities: [
          entity('ent-product', '商品', { requirementRefs: ['STORY-001'] }),
          entity('ent-order', '订单', { requirementRefs: ['STORY-003'], description: '被复用的订单' })
        ]
      }
    }
    return {
      pageSets: [
        pageSet('', '商品档案', 'EPIC-001', ['STORY-001'], [
          page('product-list', '商品列表', 'ent-product', 'list', ['STORY-001'])
        ])
      ]
    }
  }
  await assert.rejects(
    setup.service.generateEpicDesign(appId, 'EPIC-001', { moduleId, generator: stub }),
    /其它已确认实体/
  )
  assert.equal(setup.service.getDesign(appId, moduleId).version, before.version, '默认不写库/不产版本')
  assert.equal(
    setup.service.getDesign(appId, moduleId).entities.find(item => item.name === '订单')?.status,
    'confirmed'
  )

  call = 0
  const result = await setup.service.generateEpicDesign(appId, 'EPIC-001', {
    moduleId,
    reopenConfirmed: true,
    generator: stub
  })
  assert.ok(result.reopened.includes('ent-order'))
  assert.equal(result.project.entities.find(item => item.name === '订单')?.status, 'draft')
  assert.equal(result.project.entities.find(item => item.name === '订单')?.description, '被复用的订单')
})

test('D-RMP 草稿页面集内已确认页面 / 仅页面绑定的实体也需重开（MF-DRMP-3/5）', async () => {
  const appId = 'epic-draft-set'
  const moduleId = seedStructuredRequirement(appId)
  setup.service.saveEntities(
    appId,
    [
      // 无 Epic/Story refs，只被 primary 页面绑定
      entity('ent-product', '商品', { requirementRefs: [], status: 'confirmed' }),
      entity('ent-order', '订单', { requirementRefs: ['STORY-003'], status: 'confirmed' })
    ],
    'manual',
    { moduleId }
  )
  setup.service.savePageSets(
    appId,
    [
      pageSet('ps-product', '商品档案', 'EPIC-001', ['STORY-001'], [
        page('product-list', '商品列表', 'ent-product', 'list', ['STORY-001'], { status: 'confirmed' }),
        page('product-detail', '商品详情', 'ent-product', 'detail', ['STORY-002'])
      ], { status: 'draft' }),
      pageSet('ps-order', '订单管理', 'EPIC-002', ['STORY-003'], [
        page('order-list', '订单列表', 'ent-order', 'list', ['STORY-003'], { status: 'confirmed' })
      ], { status: 'confirmed' })
    ],
    'manual',
    { moduleId }
  )
  const project = setup.service.getDesign(appId, moduleId)
  const node = setup.epic.findEpicNode(project, 'EPIC-001')
  assert.ok(node)
  const confirmedPageId =
    project.pageSets.find(item => item.id === 'ps-product')?.pages.find(item => item.pageKey === 'product-list')?.id ?? ''
  assert.ok(confirmedPageId)
  const impact = setup.service.epicGenerationImpact(project, node)
  assert.deepEqual(impact.pageSets, [], '页面集本身是 draft，不列入 pageSets')
  assert.deepEqual(impact.pages.map(item => item.id), [confirmedPageId], 'draft 页面集里的已确认 page 必须列入')
  assert.deepEqual(impact.entities.map(item => item.id), ['ent-product'], '无 refs 但被 primary 页面绑定的已确认实体也列入')

  const before = project.version
  await assert.rejects(
    setup.service.generateEpicDesign(appId, 'EPIC-001', {
      moduleId,
      generator: generatorOf([entity('ent-product', '商品')], [])
    }),
    (error: unknown) => {
      const issues = ((error as { issues?: string[] }).issues ?? []).join('\n')
      assert.match(String((error as Error).message), /允许重新打开已确认项/)
      assert.match(issues, /页面「商品列表」已确认/)
      assert.match(issues, /实体「商品」已确认/)
      return true
    }
  )
  assert.equal(setup.service.getDesign(appId, moduleId).version, before, '409 不写库/不产版本')

  const result = await setup.service.generateEpicDesign(appId, 'EPIC-001', {
    moduleId,
    reopenConfirmed: true,
    generator: generatorOf(
      [entity('ent-product', '商品', { requirementRefs: ['STORY-001'], description: '重开后的商品' })],
      [
        pageSet('', '商品档案', 'EPIC-001', ['STORY-001'], [
          page('product-list', '商品列表', 'ent-product', 'list', ['STORY-001'])
        ])
      ]
    )
  })
  assert.ok(result.reopened.includes(confirmedPageId), '被替换的已确认 page 记录在 reopened')
  assert.ok(result.reopened.includes('ent-product'), '仅页面绑定的已确认实体记录在 reopened')
  assert.equal(result.project.entities.find(item => item.name === '商品')?.status, 'draft')
  assert.equal(result.project.entities.find(item => item.name === '订单')?.status, 'confirmed', '其它 confirmed 实体保留')
  assert.equal(result.project.pageSets.find(item => item.id === 'ps-order')?.status, 'confirmed', '其它 confirmed 页面集保留')
  const replaced = result.project.pageSets.find(item => item.epicId === 'EPIC-001')
  assert.equal(replaced?.status, 'draft')
  assert.equal(replaced?.pages.every(item => item.status === 'draft'), true)
})

test('D-RMP 守卫：项目已确认/需求 stale/归档模块/未知 Epic/项目不可写', async () => {
  const appId = 'epic-guards'
  const moduleId = seedStructuredRequirement(appId)
  setup.service.saveEntities(
    appId,
    [entity('ent-product', '商品', { requirementRefs: ['STORY-001'], status: 'confirmed' })],
    'manual',
    { moduleId }
  )
  setup.service.savePageSets(
    appId,
    [
      pageSet(
        'ps-product',
        '商品档案',
        'EPIC-001',
        ['STORY-001'],
        [page('product-list', '商品列表', 'ent-product', 'list', ['STORY-001'], { status: 'confirmed' })],
        { status: 'confirmed' }
      )
    ],
    'manual',
    { moduleId }
  )
  setup.service.confirmDesign(appId, moduleId)
  await assert.rejects(
    setup.service.generateEpicDesign(appId, 'EPIC-001', { moduleId, generator: async () => ({}) }),
    /重新编辑设计/
  )

  // 需求 stale：重新打开需求 → 改背景章节 → 再确认（docVersion+1；保留结构化 Epics）
  setup.doc.reopenRequirementDoc(appId, moduleId)
  setup.doc.saveDocSection(appId, 'problem', { markdown: '需求变更后的背景说明' }, moduleId)
  setup.doc.confirmRequirementDoc(appId, moduleId)
  const staleProject = setup.service.getDesign(appId, moduleId)
  assert.equal(staleProject.stale.stale, true)
  await assert.rejects(
    setup.service.generateEpicDesign(appId, 'EPIC-001', { moduleId, generator: async () => ({}) }),
    /同步设计输入/
  )

  // 同步后：未知 Epic / 缺 epicId
  setup.service.syncDesignInput(appId, 'additions', moduleId)
  await assert.rejects(
    setup.service.generateEpicDesign(appId, 'EPIC-999', { moduleId, generator: async () => ({}) }),
    /没有该 Epic/
  )
  await assert.rejects(setup.service.generateEpicDesign(appId, '', { moduleId }), /缺少 epicId/)

  // 归档模块 → 409（设计阶段不允许 UI 归档，直接改库模拟历史数据）
  const now = new Date().toISOString()
  setup.db
    .prepare('UPDATE app_modules SET archived_at = ?, updated_at = ? WHERE app_id = ? AND id = ?')
    .run(now, now, appId, moduleId)
  await assert.rejects(
    setup.service.generateEpicDesign(appId, 'EPIC-001', { moduleId, generator: async () => ({}) }),
    /归档/
  )
})

test('D-RMP fallback：无 Epic 时用 SCENE-xxx，页面集 epicId=null + sceneKey', async () => {
  const appId = 'epic-fallback'
  const moduleId = seedSceneRequirement(appId)
  const project = setup.service.getDesign(appId, moduleId)
  const sceneId = project.input?.scenes[0]?.id ?? ''
  const result = await setup.service.generateEpicDesign(appId, sceneId, {
    moduleId,
    generator: generatorOf(
      [entity('ent-order', '订单', { requirementRefs: [sceneId] })],
      [pageSet('', '订单管理', null, [], [page('order-list', '订单列表', 'ent-order', 'list', [])])]
    )
  })
  assert.equal(result.epicId, sceneId)
  const set = result.project.pageSets[0]
  assert.equal(set.epicId, null)
  assert.equal(set.sceneKey, sceneId)
  assert.equal(set.pages.length, 1)
  assert.equal(result.pages, 1)
})

test('D-RMP HTTP：generate-epic 成功/缺 epicId/409，旧接口回归', async () => {
  const appId = 'epic-http'
  const moduleId = seedStructuredRequirement(appId)
  const target = setup.opencode as unknown as Record<string, unknown>
  const original = target.generateText
  target.generateText = async (input: unknown) => {
    const prompt = String((input as { prompt?: string }).prompt ?? '')
    if (prompt.includes('实体建模助手（按 Epic 生成）')) {
      return JSON.stringify({
        entities: [
          {
            id: 'ent-product',
            name: '商品',
            tableName: 'biz_product',
            requirementRefs: ['STORY-001'],
            fields: [
              { name: 'id', label: 'ID', type: 'string', unique: true },
              { name: 'name', label: '名称', type: 'string' }
            ]
          }
        ]
      })
    }
    return JSON.stringify({
      pageSets: [
        {
          sceneKey: 'EPIC-001',
          epicId: 'EPIC-001',
          storyIds: ['STORY-001', 'STORY-002'],
          title: '商品档案',
          pages: [
            {
              pageKey: 'product-list',
              title: '商品列表',
              type: 'list',
              entityId: 'ent-product',
              requirementRefs: ['STORY-001'],
              spec: { columns: ['name'], searchFields: ['name'], actions: ['create'] }
            }
          ]
        }
      ]
    })
  }
  try {
    const missing = await fetch(`${base}/api/apps/${appId}/design/generate-epic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, model: { providerID: 'mock', id: 'mock-model' } })
    })
    assert.equal(missing.status, 400)
    assert.match(String(((await missing.json()) as { error?: string }).error), /epicId/)

    const ok = await fetch(`${base}/api/apps/${appId}/design/generate-epic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleId,
        epicId: 'EPIC-001',
        reopenConfirmed: false,
        model: { providerID: 'mock', id: 'mock-model' }
      })
    })
    assert.equal(ok.status, 200)
    const body = (await ok.json()) as {
      epicId: string
      entitiesAdded: number
      pages: number
      project: { version: number; status: string; entities: unknown[]; pageSets: Array<{ pages: unknown[] }> }
    }
    assert.equal(body.epicId, 'EPIC-001')
    assert.equal(body.entitiesAdded, 1)
    assert.equal(body.pages, 1)
    assert.equal(body.project.status, 'draft')
    assert.equal(body.project.entities.length, 1)

    // 先全确认，验证 HTTP 409 + issues
    const project = setup.service.getDesign(appId, moduleId)
    const entities = project.entities.map(item => ({ ...item, status: 'confirmed' }))
    setup.service.saveEntities(appId, entities, 'manual', { moduleId })
    const pageSets = project.pageSets.map(item => ({
      ...item,
      status: 'confirmed',
      pages: item.pages.map(pageItem => ({ ...pageItem, status: 'confirmed' }))
    }))
    setup.service.savePageSets(appId, pageSets, 'manual', { moduleId })
    const conflict = await fetch(`${base}/api/apps/${appId}/design/generate-epic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleId,
        epicId: 'EPIC-001',
        model: { providerID: 'mock', id: 'mock-model' }
      })
    })
    assert.equal(conflict.status, 409)
    const conflictBody = (await conflict.json()) as { error?: string; issues?: string[] }
    assert.match(String(conflictBody.error), /允许重新打开已确认项/)
    assert.ok((conflictBody.issues ?? []).length >= 1)

    // 旧整模块接口回归：page-sets/generate default 仍可用
    const legacy = await fetch(`${base}/api/apps/${appId}/design/page-sets/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, mode: 'default' })
    })
    assert.equal(legacy.status, 200)
  } finally {
    target.generateText = original
  }
})
