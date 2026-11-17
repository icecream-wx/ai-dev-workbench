/**
 * 设计默认页面集主实体匹配（P2）
 *
 * 背景：真实模型 E2E 中 EPIC-001「图书档案管理」的页面绑到了「借阅记录」，
 * EPIC-005「逾期与罚款」绑到了「提醒记录」——故事正文出现的实体名压过了
 * 实体自身 requirementRefs 与 Epic/Story 的引用交集。
 *
 * 覆盖：Story 引用优先、多实体同 Story 的决胜、无引用回退旧启发式、
 * Epic/Scene 引用优先于纯文本命中。使用临时 SQLite + projects 目录；
 * 不调用模型、不启动 opencode。
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

interface SceneFixture {
  id?: string
  title: string
  description?: string
}

interface EpicFixture {
  id: string
  title: string
  goal?: string
  sceneId?: string | null
}

interface StoryFixture {
  id: string
  epicId: string
  title: string
  description?: string
  acceptance?: string[]
}

let setupPromise: Promise<Setup> | null = null

async function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-scene-entity-'))
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

/** 每个用例独立应用 + 已确认的结构化需求 */
async function prepareApp(
  appId: string,
  fixture: { scenes: SceneFixture[]; epics: EpicFixture[]; stories: StoryFixture[] }
): Promise<Setup> {
  const context = await setup()
  fs.mkdirSync(path.join(context.projects, appId), { recursive: true })
  const now = new Date().toISOString()
  context.db
    .prepare(`
      INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
      VALUES (?, ?, '场景主实体匹配测试', ?, 8081, 'requirements', ?, ?)
    `)
    .run(appId, `场景匹配测试 ${appId}`, appId, now, now)

  context.doc.ensureRequirementDoc(appId)
  try {
    context.doc.reopenRequirementDoc(appId)
  } catch {
    // 可能还没确认
  }
  context.doc.saveDocSection(appId, 'scenes', {
    data: { scenes: fixture.scenes, epics: [], stories: [] }
  })
  context.doc.saveDocSection(appId, 'epics', {
    data: { scenes: [], epics: fixture.epics, stories: fixture.stories }
  })
  for (const section of context.doc.ensureRequirementDoc(appId).sections) {
    if (!section.required || section.markdown.trim()) continue
    context.doc.saveDocSection(appId, section.sectionKey, { markdown: `内容-${section.title}` })
  }
  context.doc.confirmRequirementDoc(appId)
  // 绑定已确认需求输入（页面集生成使用绑定输入）
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

function pageSetOf(project: { pageSets: Array<{ epicId: string | null; title: string; pages: Array<{ type: string; title: string; entityId: string | null }> }> }, epicId: string): {
  title: string
  pages: Array<{ type: string; title: string; entityId: string | null }>
} {
  const set = project.pageSets.find(item => item.epicId === epicId)
  assert.ok(set, `缺少 Epic ${epicId} 的页面集`)
  return set
}

function listPageOf(set: { pages: Array<{ type: string; title: string; entityId: string | null }> }): {
  type: string
  title: string
  entityId: string | null
} {
  const page = set.pages.find(item => item.type === 'list')
  assert.ok(page, `页面集「${set.pages[0]?.title ?? ''}」缺少列表页`)
  return page
}

test('真实错位复现：Epic 故事引用的实体优先于正文里出现的其它实体名', async () => {
  const appId = 'scene-match-book'
  const context = await prepareApp(appId, {
    scenes: [{ id: 'SCENE-001', title: '图书业务', description: '图书档案与借阅业务' }],
    epics: [
      { id: 'EPIC-001', title: '图书档案管理', goal: '维护图书档案', sceneId: 'SCENE-001' },
      { id: 'EPIC-002', title: '借阅办理', goal: '办理借阅并记录', sceneId: 'SCENE-001' }
    ],
    stories: [
      {
        id: 'STORY-001',
        epicId: 'EPIC-001',
        title: '登记书目',
        description: '录入书目基本信息；借阅记录在借阅办理中产生',
        acceptance: ['书目可新增']
      },
      {
        id: 'STORY-002',
        epicId: 'EPIC-001',
        title: '修改书目',
        description: '维护书目信息',
        acceptance: []
      },
      {
        id: 'STORY-003',
        epicId: 'EPIC-002',
        title: '借阅登记',
        description: '记录借阅记录并生成借阅记录明细',
        acceptance: []
      }
    ]
  })

  // 「借阅记录」放第一位且正文出现更多：旧逻辑会把它选为 EPIC-001 的主实体
  context.design.saveEntities(appId, [
    entityInput('借阅记录', 'biz_borrow_record', { requirementRefs: ['STORY-003'] }),
    entityInput('书目', 'biz_book', { requirementRefs: ['STORY-001'] })
  ])
  const project = context.design.generateDefaultPageSets(appId)
  const book = project.entities.find(entity => entity.name === '书目')
  const record = project.entities.find(entity => entity.name === '借阅记录')
  assert.ok(book && record)

  const archiveSet = pageSetOf(project, 'EPIC-001')
  assert.equal(archiveSet.title, '图书档案管理')
  assert.equal(listPageOf(archiveSet).title, '书目列表')
  assert.equal(listPageOf(archiveSet).entityId, book.id)
  assert.ok(archiveSet.pages.every(page => page.entityId === book.id))

  const borrowSet = pageSetOf(project, 'EPIC-002')
  assert.equal(listPageOf(borrowSet).title, '借阅记录列表')
  assert.equal(listPageOf(borrowSet).entityId, record.id)
})

test('多实体命中同一 Story：标题匹配更准者优先，分数相同按实体顺序', async () => {
  const appId = 'scene-match-story-tie'
  const context = await prepareApp(appId, {
    scenes: [{ id: 'SCENE-001', title: '罚款业务', description: '罚款与通知' }],
    epics: [{ id: 'EPIC-010', title: '罚款缴纳', goal: '处理罚款缴纳', sceneId: 'SCENE-001' }],
    stories: [
      {
        id: 'STORY-010',
        epicId: 'EPIC-010',
        title: '登记罚款',
        description: '登记罚款并发送通知',
        acceptance: ['罚款单可登记']
      }
    ]
  })

  context.design.saveEntities(appId, [
    entityInput('通知记录', 'biz_notice_record', { requirementRefs: ['STORY-010'] }),
    entityInput('罚款单', 'biz_fine', { requirementRefs: ['STORY-010'] })
  ])
  let project = context.design.generateDefaultPageSets(appId)
  const fine = project.entities.find(entity => entity.name === '罚款单')
  assert.ok(fine)
  assert.equal(listPageOf(pageSetOf(project, 'EPIC-010')).entityId, fine.id)

  // 两个实体引用相同且标题/正文都不匹配 → 同分，保持实体顺序
  const tiedApp = 'scene-match-order-tie'
  const tied = await prepareApp(tiedApp, {
    scenes: [{ id: 'SCENE-001', title: '台账业务', description: '台账维护' }],
    epics: [{ id: 'EPIC-011', title: '台账维护', goal: '维护台账', sceneId: 'SCENE-001' }],
    stories: [
      { id: 'STORY-011', epicId: 'EPIC-011', title: '登记台账', description: '登记台账明细', acceptance: ['台账可登记'] }
    ]
  })
  tied.design.saveEntities(tiedApp, [
    entityInput('甲记录', 'biz_first', { requirementRefs: ['STORY-011'] }),
    entityInput('乙记录', 'biz_second', { requirementRefs: ['STORY-011'] })
  ])
  project = tied.design.generateDefaultPageSets(tiedApp)
  const first = project.entities.find(entity => entity.name === '甲记录')
  assert.ok(first)
  assert.equal(listPageOf(pageSetOf(project, 'EPIC-011')).entityId, first.id)
})

test('无 requirementRefs 时保持旧启发式（标题 * 10 + 正文）', async () => {
  const appId = 'scene-match-fallback'
  const context = await prepareApp(appId, {
    scenes: [{ id: 'SCENE-001', title: '客户业务', description: '客户档案' }],
    epics: [{ id: 'EPIC-020', title: '客户档案管理', goal: '维护客户档案', sceneId: 'SCENE-001' }],
    stories: [
      {
        id: 'STORY-020',
        epicId: 'EPIC-020',
        title: '客户维护',
        description: '维护客户，关联订单记录',
        acceptance: ['客户可维护']
      }
    ]
  })

  // 订单记录在正文出现更多，但标题「客户档案管理」命中客户 → 旧逻辑选客户
  context.design.saveEntities(appId, [
    entityInput('订单记录', 'biz_order_record'),
    entityInput('客户', 'biz_customer')
  ])
  const project = context.design.generateDefaultPageSets(appId)
  const customer = project.entities.find(entity => entity.name === '客户')
  const order = project.entities.find(entity => entity.name === '订单记录')
  assert.ok(customer && order)
  assert.deepEqual(customer.requirementRefs, [])
  assert.deepEqual(order.requirementRefs, [])
  assert.equal(listPageOf(pageSetOf(project, 'EPIC-020')).entityId, customer.id)
  assert.equal(listPageOf(pageSetOf(project, 'EPIC-020')).title, '客户列表')
})

test('Story 引用 > Epic 引用 > Scene 引用 > 纯文本命中', async () => {
  const appId = 'scene-match-ref-priority'
  const context = await prepareApp(appId, {
    scenes: [{ id: 'SCENE-001', title: '资源管理', description: '维护资源档案' }],
    epics: [{ id: 'EPIC-001', title: '合作伙伴维护', goal: '维护合作伙伴关系', sceneId: 'SCENE-001' }],
    stories: [
      {
        id: 'STORY-001',
        epicId: 'EPIC-001',
        title: '登记合作伙伴',
        description: '录入合作伙伴信息',
        acceptance: ['合作伙伴可登记']
      }
    ]
  })

  context.design.saveEntities(appId, [
    entityInput('合作伙伴', 'biz_partner'),
    entityInput('资源档案', 'biz_resource', { requirementRefs: ['SCENE-001'] }),
    entityInput('往来单位', 'biz_counterparty', { requirementRefs: ['EPIC-001'] }),
    entityInput('履约台账', 'biz_ledger', { requirementRefs: ['STORY-001'] })
  ])
  let project = context.design.generateDefaultPageSets(appId)
  let primary = listPageOf(pageSetOf(project, 'EPIC-001')).entityId
  assert.equal(project.entities.find(entity => entity.id === primary)?.name, '履约台账')

  // 去掉 Story 引用的实体 → Epic 引用优先于 Scene 引用和纯文本命中
  project = context.design.saveEntities(
    appId,
    project.entities.filter(entity => entity.name !== '履约台账')
  )
  project = context.design.generateDefaultPageSets(appId)
  primary = listPageOf(pageSetOf(project, 'EPIC-001')).entityId
  assert.equal(project.entities.find(entity => entity.id === primary)?.name, '往来单位')

  // 去掉 Epic 引用的实体 → Scene 引用优先于纯文本命中
  project = context.design.saveEntities(
    appId,
    project.entities.filter(entity => entity.name !== '往来单位')
  )
  project = context.design.generateDefaultPageSets(appId)
  primary = listPageOf(pageSetOf(project, 'EPIC-001')).entityId
  assert.equal(project.entities.find(entity => entity.id === primary)?.name, '资源档案')

  // 去掉 Scene 引用的实体 → 回退纯文本启发式（标题命中的合作伙伴）
  project = context.design.saveEntities(
    appId,
    project.entities.filter(entity => entity.name !== '资源档案')
  )
  project = context.design.generateDefaultPageSets(appId)
  primary = listPageOf(pageSetOf(project, 'EPIC-001')).entityId
  assert.equal(project.entities.find(entity => entity.id === primary)?.name, '合作伙伴')
})

test('严格字典序：Story 引用实体优先于文本分 >1000 的超长实体名', async () => {
  const appId = 'scene-match-long-name'
  // 32 字符实体名；完整出现在 Epic 标题，仅标题分就 >1000（旧加权和会压过 Story 引用）
  const longName = '借阅记录'.repeat(8)
  const context = await prepareApp(appId, {
    scenes: [{ id: 'SCENE-001', title: '图书业务', description: '图书档案与借阅业务' }],
    epics: [
      { id: 'EPIC-001', title: `图书档案管理-${longName}`, goal: '维护图书档案', sceneId: 'SCENE-001' }
    ],
    stories: [
      {
        id: 'STORY-001',
        epicId: 'EPIC-001',
        title: '登记书目',
        description: '录入书目基本信息',
        acceptance: ['书目可新增']
      }
    ]
  })

  context.design.saveEntities(appId, [
    entityInput(longName, 'biz_long_record'),
    entityInput('书目', 'biz_book', { requirementRefs: ['STORY-001'] })
  ])
  let project = context.design.generateDefaultPageSets(appId)
  const book = project.entities.find(entity => entity.name === '书目')
  assert.ok(book)
  assert.equal(listPageOf(pageSetOf(project, 'EPIC-001')).entityId, book.id)
  assert.equal(listPageOf(pageSetOf(project, 'EPIC-001')).title, '书目列表')

  // 去掉 Story 引用实体后，纯文本分仍然生效（超长名称实体成为 primary）
  project = context.design.saveEntities(
    appId,
    project.entities.filter(entity => entity.name !== '书目')
  )
  project = context.design.generateDefaultPageSets(appId)
  const longEntity = project.entities.find(entity => entity.name === longName)
  assert.ok(longEntity)
  assert.equal(listPageOf(pageSetOf(project, 'EPIC-001')).entityId, longEntity.id)
})
