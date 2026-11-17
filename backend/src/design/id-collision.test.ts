/**
 * 设计 ID 跨应用冲突回归（P1）
 *
 * 背景：app_design_entities / app_design_page_sets / app_design_pages 的 id 都是全局主键，
 * 两个应用使用相同 Epic ID（默认页面集）或相同 raw id（请求/AI）时会 UNIQUE 冲突；
 * writeEntities/writePageSets 先删后插，冲突会丢当前应用数据。
 *
 * 覆盖：默认页面集、raw 页面集/页面/实体 ID、关系 target 重写、写盘事务回滚。
 * 使用临时 SQLite + projects 目录；不调用模型、不启动 opencode。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

interface Setup {
  root: string
  projects: string
  db: typeof import('../db').db
  doc: typeof import('../requirements/doc')
  design: typeof import('./service')
}

let setupPromise: Promise<Setup> | null = null

async function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-design-id-'))
    const projects = path.join(root, 'projects')
    fs.mkdirSync(projects, { recursive: true })
    process.env.RG_DATA_DIR = path.join(root, 'data')
    process.env.RG_PROJECTS_DIR = projects
    const dbModule = await import('../db')
    const doc = await import('../requirements/doc')
    const design = await import('./service')
    return { root, projects, db: dbModule.db, doc, design }
  })()
  return setupPromise
}

after(async () => {
  if (!setupPromise) return
  const { root, db } = await setupPromise
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

/** 每个用例独立应用：插入 app + 已确认的结构化需求（所有应用共用 EPIC-001/STORY-001） */
async function prepareApp(appId: string): Promise<Setup> {
  const context = await setup()
  fs.mkdirSync(path.join(context.projects, appId), { recursive: true })
  const now = new Date().toISOString()
  context.db
    .prepare(`
      INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
      VALUES (?, ?, 'ID 冲突测试', ?, 8081, 'requirements', ?, ?)
    `)
    .run(appId, `ID 冲突测试 ${appId}`, appId, now, now)

  context.doc.ensureRequirementDoc(appId)
  try {
    context.doc.reopenRequirementDoc(appId)
  } catch {
    // 可能还没确认
  }
  context.doc.saveDocSection(appId, 'scenes', {
    data: {
      scenes: [{ title: '订单管理', description: '销售维护订单并跟踪状态' }],
      epics: [],
      stories: []
    }
  })
  context.doc.saveDocSection(appId, 'epics', {
    data: {
      scenes: [],
      epics: [{ id: 'EPIC-001', title: '订单创建', goal: '支持业务员创建订单', priority: 'P0' }],
      stories: [
        {
          id: 'STORY-001',
          epicId: 'EPIC-001',
          title: '创建订单',
          description: '作为业务员，我希望创建订单',
          acceptance: ['必填字段校验'],
          priority: 'P0'
        }
      ]
    }
  })
  for (const section of context.doc.ensureRequirementDoc(appId).sections) {
    if (!section.required || section.markdown.trim()) continue
    context.doc.saveDocSection(appId, section.sectionKey, { markdown: `内容-${section.title}` })
  }
  context.doc.confirmRequirementDoc(appId)
  context.design.getDesign(appId)
  return context
}

function entityInput(
  name: string,
  tableName: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    name,
    tableName,
    description: `${name}主表`,
    fields: [
      { name: 'id', label: '主键ID', type: 'string', required: true, unique: true },
      { name: 'name', label: '名称', type: 'string' }
    ],
    relations: [],
    ...overrides
  }
}

interface PageInput {
  id?: string
  pageKey: string
  title: string
  type?: string
}

function pageSetInput(
  id: string | undefined,
  sceneKey: string,
  title: string,
  pages: PageInput[]
): Record<string, unknown> {
  return {
    ...(id ? { id } : {}),
    sceneKey,
    title,
    description: `${title}页面集`,
    pages: pages.map(page => ({
      ...(page.id ? { id: page.id } : {}),
      pageKey: page.pageKey,
      title: page.title,
      type: page.type ?? 'list',
      entityId: '订单'
    }))
  }
}

function allPageIds(project: { pageSets: Array<{ pages: Array<{ id: string }> }> }): string[] {
  return project.pageSets.flatMap(set => set.pages.map(page => page.id))
}

test('默认页面集：两个应用同 EPIC-001 都成功，页面集/页面 ID 全局不同', async () => {
  const a = await prepareApp('collision-default-a')
  const b = await prepareApp('collision-default-b')
  a.design.saveEntities('collision-default-a', [entityInput('订单', 'biz_order')])
  b.design.saveEntities('collision-default-b', [entityInput('订单', 'biz_order')])

  const projectA = a.design.generateDefaultPageSets('collision-default-a')
  const projectB = b.design.generateDefaultPageSets('collision-default-b')

  assert.equal(projectA.pageSets.length, 1)
  assert.equal(projectB.pageSets.length, 1)
  assert.equal(projectA.pageSets[0].pages.length, projectB.pageSets[0].pages.length)
  assert.equal(projectA.pageSets[0].sceneKey, 'EPIC-001')
  assert.equal(projectB.pageSets[0].sceneKey, 'EPIC-001')
  assert.notEqual(projectA.pageSets[0].id, projectB.pageSets[0].id)

  const setIdsA = projectA.pageSets.map(set => set.id)
  const setIdsB = projectB.pageSets.map(set => set.id)
  for (const id of setIdsB) assert.ok(!setIdsA.includes(id), `页面集 ID 重复：${id}`)

  const pageIdsA = allPageIds(projectA)
  const pageIdsB = allPageIds(projectB)
  assert.ok(pageIdsA.length > 0 && pageIdsB.length > 0)
  for (const id of pageIdsB) assert.ok(!pageIdsA.includes(id), `页面 ID 重复：${id}`)

  // 两个应用真实落库：各自页面集数量正确
  assert.equal(a.design.getDesign('collision-default-a').pageSets.length, 1)
  assert.equal(b.design.getDesign('collision-default-b').pageSets.length, 1)
})

test('raw 页面集 ID 冲突：两边都成功、最终 ID 不同、B 的原有页面集不丢', async () => {
  const a = await prepareApp('collision-set-a')
  const b = await prepareApp('collision-set-b')
  a.design.saveEntities('collision-set-a', [entityInput('订单', 'biz_order')])
  b.design.saveEntities('collision-set-b', [entityInput('订单', 'biz_order')])

  const savedA = a.design.savePageSets('collision-set-a', [
    pageSetInput('ps-shared', 'scene-shared', '订单管理', [{ pageKey: 'order-list', title: '订单列表' }])
  ])
  assert.equal(savedA.pageSets.length, 1)
  assert.equal(savedA.pageSets[0].id, 'ps-shared', '全局未被占用时应保留 raw 页面集 ID')

  const firstB = b.design.savePageSets('collision-set-b', [
    pageSetInput('ps-b', 'scene-b', '订单查询', [{ pageKey: 'order-query', title: '订单查询' }])
  ])
  assert.equal(firstB.pageSets.length, 1)
  assert.equal(firstB.pageSets[0].id, 'ps-b')

  const secondB = b.design.savePageSets('collision-set-b', [
    pageSetInput('ps-b', 'scene-b', '订单查询', [{ pageKey: 'order-query', title: '订单查询' }]),
    pageSetInput('ps-shared', 'scene-customer', '客户档案', [{ pageKey: 'customer-list', title: '客户列表' }])
  ])
  assert.equal(secondB.pageSets.length, 2, 'B 的原有页面集不应因冲突被删除')
  const kept = secondB.pageSets.find(set => set.id === 'ps-b')
  assert.ok(kept, 'B 原有页面集 ps-b 应保留')
  assert.equal(kept?.pages.length, 1)
  const renamed = secondB.pageSets.find(set => set.id !== 'ps-b')
  assert.ok(renamed, '应生成新的页面集')
  assert.notEqual(renamed?.id, 'ps-shared', '被占用 raw ID 应换成新 ID')
  assert.ok(renamed?.id !== savedA.pageSets[0].id)
  assert.equal(a.design.getDesign('collision-set-a').pageSets[0].id, 'ps-shared')
})

test('raw 页面 ID 冲突：两边都成功、最终 ID 不同', async () => {
  const a = await prepareApp('collision-page-a')
  const b = await prepareApp('collision-page-b')
  a.design.saveEntities('collision-page-a', [entityInput('订单', 'biz_order')])
  b.design.saveEntities('collision-page-b', [entityInput('订单', 'biz_order')])

  const savedA = a.design.savePageSets('collision-page-a', [
    pageSetInput('ps-page-a', 'scene-a', '订单管理', [
      { id: 'pg-shared', pageKey: 'order-list', title: '订单列表' }
    ])
  ])
  assert.equal(savedA.pageSets[0].pages[0].id, 'pg-shared')

  const savedB = b.design.savePageSets('collision-page-b', [
    pageSetInput('ps-page-b', 'scene-b', '订单管理', [
      { id: 'pg-shared', pageKey: 'order-list', title: '订单列表' }
    ])
  ])
  assert.equal(savedB.pageSets[0].pages.length, 1)
  assert.notEqual(savedB.pageSets[0].pages[0].id, 'pg-shared', '被占用的 raw 页面 ID 应换新')
  assert.notEqual(savedB.pageSets[0].pages[0].id, savedA.pageSets[0].pages[0].id)
  assert.equal(a.design.getDesign('collision-page-a').pageSets[0].pages[0].id, 'pg-shared')
})

test('raw 实体 ID 冲突：两边都成功、第二个应用关系/字段引用指向自己的新实体 ID', async () => {
  const a = await prepareApp('collision-entity-a')
  const b = await prepareApp('collision-entity-b')
  const payload = (): Record<string, unknown>[] => [
    entityInput('订单', 'biz_order', {
      id: 'ent-shared',
      fields: [
        { name: 'id', label: '主键ID', type: 'string', required: true, unique: true },
        { name: 'itemRef', label: '明细引用', type: 'ref', ref: 'ent-shared-item' }
      ],
      relations: [{ name: '包含明细', type: 'one-to-many', target: 'ent-shared-item' }]
    }),
    entityInput('订单明细', 'biz_order_item', { id: 'ent-shared-item' })
  ]

  const savedA = a.design.saveEntities('collision-entity-a', payload())
  const savedB = b.design.saveEntities('collision-entity-b', payload())
  assert.deepEqual(
    savedA.entities.map(entity => entity.id).sort(),
    ['ent-shared', 'ent-shared-item'],
    '全局未被占用时保留 raw 实体 ID'
  )

  const idsB = savedB.entities.map(entity => entity.id)
  assert.equal(new Set(idsB).size, 2)
  assert.ok(!idsB.includes('ent-shared'), '与 A 冲突的实体 ID 应换新')
  assert.ok(!idsB.includes('ent-shared-item'), '与 A 冲突的实体 ID 应换新')
  for (const id of savedA.entities.map(entity => entity.id)) {
    assert.ok(!idsB.includes(id), `实体 ID 跨应用重复：${id}`)
  }

  const orderB = savedB.entities.find(entity => entity.name === '订单')
  const itemB = savedB.entities.find(entity => entity.name === '订单明细')
  assert.ok(orderB && itemB)
  assert.equal(orderB?.relations[0].target, itemB?.id, '关系 target 应指向本应用新实体 ID')
  assert.equal(orderB?.fields.find(field => field.name === 'itemRef')?.ref, itemB?.id, '字段 ref 应指向本应用新实体 ID')

  const orderA = savedA.entities.find(entity => entity.name === '订单')
  assert.equal(orderA?.relations[0].target, 'ent-shared-item')
})

test('同一 payload 重复 raw 实体 ID：保存成功、两个 ID 不同、引用指向保留 rawId 的实体', async () => {
  const context = await prepareApp('collision-dup-entities')
  const appId = 'collision-dup-entities'
  const saved = context.design.saveEntities(appId, [
    entityInput('订单', 'biz_order', { id: 'ent-dup' }),
    entityInput('订单明细', 'biz_order_item', {
      id: 'ent-dup',
      relations: [{ name: '所属订单', type: 'many-to-one', target: 'ent-dup' }]
    })
  ])

  assert.equal(saved.entities.length, 2)
  const ids = saved.entities.map(entity => entity.id)
  assert.equal(new Set(ids).size, 2, '重复 raw ID 的第二个实体应换新 ID')
  assert.equal(ids.filter(id => id === 'ent-dup').length, 1, '只应有一个实体保留 raw ID')

  const order = saved.entities.find(entity => entity.name === '订单')
  const item = saved.entities.find(entity => entity.name === '订单明细')
  assert.equal(order?.id, 'ent-dup')
  assert.notEqual(item?.id, 'ent-dup')
  assert.equal(item?.relations[0].target, 'ent-dup', '重复 rawId 的关系应指向保留 rawId 的实体')

  const rows = context.db
    .prepare('SELECT id FROM app_design_entities WHERE app_id = ? ORDER BY position ASC')
    .all(appId) as Array<{ id: string }>
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(row => row.id), ids)
})

test('同一 payload 重复 raw 页面集 ID：保存成功、两个页面集 ID 不同', async () => {
  const context = await prepareApp('collision-dup-sets')
  const appId = 'collision-dup-sets'
  context.design.saveEntities(appId, [entityInput('订单', 'biz_order')])
  const saved = context.design.savePageSets(appId, [
    pageSetInput('ps-dup', 'scene-dup-1', '订单管理', [{ pageKey: 'order-list', title: '订单列表' }]),
    pageSetInput('ps-dup', 'scene-dup-2', '订单查询', [{ pageKey: 'order-query', title: '订单查询' }])
  ])

  assert.equal(saved.pageSets.length, 2)
  const ids = saved.pageSets.map(set => set.id)
  assert.equal(new Set(ids).size, 2, '重复 raw ID 的第二个页面集应换新 ID')
  assert.equal(ids.filter(id => id === 'ps-dup').length, 1)

  const rows = context.db
    .prepare('SELECT id FROM app_design_page_sets WHERE app_id = ? ORDER BY position ASC')
    .all(appId) as Array<{ id: string }>
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(row => row.id), ids)
})

test('同一 payload 一个页面集内重复 raw 页面 ID：保存成功、两个页面 ID 不同', async () => {
  const context = await prepareApp('collision-dup-pages')
  const appId = 'collision-dup-pages'
  context.design.saveEntities(appId, [entityInput('订单', 'biz_order')])
  const saved = context.design.savePageSets(appId, [
    pageSetInput('ps-dup-pages', 'scene-dup-pages', '订单管理', [
      { id: 'pg-dup', pageKey: 'order-list', title: '订单列表' },
      { id: 'pg-dup', pageKey: 'order-form', title: '订单表单', type: 'form' }
    ])
  ])

  assert.equal(saved.pageSets.length, 1)
  const pages = saved.pageSets[0].pages
  assert.equal(pages.length, 2)
  const ids = pages.map(page => page.id)
  assert.equal(new Set(ids).size, 2, '重复 raw ID 的第二个页面应换新 ID')
  assert.equal(ids.filter(id => id === 'pg-dup').length, 1)

  const rows = context.db
    .prepare('SELECT id FROM app_design_pages WHERE page_set_id = ? ORDER BY position ASC')
    .all(saved.pageSets[0].id) as Array<{ id: string }>
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(row => row.id), ids)
})

test('写盘事务：插入失败回滚，原有页面集/实体保留；去掉 trigger 后成功', async () => {
  const context = await prepareApp('collision-tx')
  const appId = 'collision-tx'
  context.design.saveEntities(appId, [entityInput('订单', 'biz_order')])
  const before = context.design.savePageSets(appId, [
    pageSetInput('ps-tx', 'scene-tx', '订单管理', [{ pageKey: 'order-list', title: '订单列表' }])
  ])
  assert.equal(before.pageSets.length, 1)
  assert.equal(before.pageSets[0].id, 'ps-tx')

  context.db.exec(
    "CREATE TRIGGER fail_design_pages BEFORE INSERT ON app_design_pages BEGIN SELECT RAISE(ABORT, 'boom pages'); END"
  )
  try {
    assert.throws(
      () =>
        context.design.savePageSets(appId, [
          pageSetInput('ps-tx-2', 'scene-tx-2', '客户档案', [{ pageKey: 'customer-list', title: '客户列表' }])
        ]),
      /boom pages/
    )
  } finally {
    context.db.exec('DROP TRIGGER fail_design_pages')
  }
  const afterPageFail = context.design.getDesign(appId)
  assert.equal(afterPageFail.pageSets.length, 1, '失败后旧页面集应保留')
  assert.equal(afterPageFail.pageSets[0].id, 'ps-tx')
  assert.equal(afterPageFail.pageSets[0].pages.length, 1)
  assert.equal(afterPageFail.pageSets[0].pages[0].pageKey, 'order-list')

  context.db.exec(
    "CREATE TRIGGER fail_design_entities BEFORE INSERT ON app_design_entities BEGIN SELECT RAISE(ABORT, 'boom entities'); END"
  )
  try {
    assert.throws(
      () => context.design.saveEntities(appId, [entityInput('订单', 'biz_order', { description: '改名后' })]),
      /boom entities/
    )
  } finally {
    context.db.exec('DROP TRIGGER fail_design_entities')
  }
  const afterEntityFail = context.design.getDesign(appId)
  assert.equal(afterEntityFail.entities.length, 1, '失败后旧实体应保留')
  assert.equal(afterEntityFail.entities[0].description, '订单主表')

  // 去掉 trigger 后同一批数据可以正常写入
  const saved = context.design.savePageSets(appId, [
    pageSetInput('ps-tx-2', 'scene-tx-2', '客户档案', [{ pageKey: 'customer-list', title: '客户列表' }])
  ])
  assert.equal(saved.pageSets.length, 1)
  assert.equal(saved.pageSets[0].id, 'ps-tx-2')
})
