/**
 * 设计 → 开发交接包（D5）单测：渲染、DDL、manifest、校验、Change Set #1、写盘/版本
 *
 * 使用临时 SQLite + projects 目录；不调用模型、不启动 opencode。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import { buildDesignHandoffBundle } from './design-bundle'
import { assessHandoffScale } from './design-scale'
import { renderDesignHandoffText } from './design-render'

interface Setup {
  root: string
  projects: string
  db: typeof import('../db').db
  doc: typeof import('../requirements/doc')
  design: typeof import('../design/service')
  handoff: typeof import('./design-service')
}

let setupPromise: Promise<Setup> | null = null
const APP_ID = 'handoff-app'

async function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-handoff-d5-'))
    const projects = path.join(root, 'projects')
    fs.mkdirSync(path.join(projects, APP_ID), { recursive: true })
    process.env.RG_DATA_DIR = path.join(root, 'data')
    process.env.RG_PROJECTS_DIR = projects
    const dbModule = await import('../db')
    const doc = await import('../requirements/doc')
    const design = await import('../design/service')
    const handoff = await import('./design-service')
    const now = new Date().toISOString()
    dbModule.db.prepare(`
      INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
      VALUES (?, '交接测试应用', 'D5 测试', ?, 8081, 'requirements', ?, ?)
    `).run(APP_ID, APP_ID, now, now)
    return { root, projects, db: dbModule.db, doc, design, handoff }
  })()
  return setupPromise
}

after(async () => {
  if (!setupPromise) return
  const { root, db } = await setupPromise
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

function resetDesign(db: Setup['db']): void {
  db.prepare('DELETE FROM app_change_set_modules').run()
  db.prepare('DELETE FROM design_handoffs').run()
  db.prepare('DELETE FROM app_change_sets').run()
  db.prepare('DELETE FROM app_design_pages').run()
  db.prepare('DELETE FROM app_design_page_sets').run()
  db.prepare('DELETE FROM app_design_entities').run()
  db.prepare('DELETE FROM app_design_versions').run()
  db.prepare('DELETE FROM app_design_projects').run()
  db.prepare('DELETE FROM app_design_inputs').run()
  db.prepare("UPDATE apps SET current_change_set_id = NULL, status = 'requirements', design_confirmed_at = NULL, development_started_at = NULL, handoff_hash = NULL WHERE id = ?").run(APP_ID)
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03])

interface DesignSpec {
  scenes: Array<Record<string, unknown>>
  epics: Array<Record<string, unknown>>
  stories: Array<Record<string, unknown>>
  entities: Array<Record<string, unknown>>
}

const SMALL_SPEC: DesignSpec = {
  scenes: [{ title: '客户管理', description: '销售维护客户' }],
  epics: [{ id: 'EPIC-001', title: '客户管理', goal: '维护客户信息', priority: 'P0' }],
  stories: [
    {
      id: 'STORY-001',
      epicId: 'EPIC-001',
      title: '创建客户',
      description: '作为销售，我希望创建客户',
      acceptance: ['必填字段校验'],
      priority: 'P0'
    },
    {
      id: 'STORY-002',
      epicId: 'EPIC-001',
      title: '查询客户',
      description: '作为销售，我希望按名称查询客户',
      acceptance: ['能按名称筛选'],
      priority: 'P1'
    }
  ],
  entities: [
    {
      name: '客户',
      tableName: 'biz_customer',
      description: '客户主表',
      requirementRefs: ['STORY-001', 'STORY-002'],
      fields: [
        { name: 'customerNo', label: '客户编号', type: 'string', length: 32, required: true, unique: true },
        { name: 'customerName', label: '客户名称', type: 'string', required: true },
        { name: 'level', label: '客户等级', type: 'enum', options: ['普通', 'VIP'] },
        { name: 'active', label: '启用', type: 'boolean', default: true },
        { name: 'creditLimit', label: '授信额度', type: 'decimal', precision: 2 }
      ]
    }
  ]
}

/** 大交接包：3 Epic / 10 Story / 3 实体 → 3 页面集 × 4 页 = 12 页 */
const LARGE_SPEC: DesignSpec = {
  scenes: [
    { title: '客户管理', description: '销售维护客户' },
    { title: '订单管理', description: '销售下单' },
    { title: '商品管理', description: '维护商品' }
  ],
  epics: [
    { id: 'EPIC-001', title: '客户管理', goal: '维护客户信息', priority: 'P0' },
    { id: 'EPIC-002', title: '订单管理', goal: '管理销售订单', priority: 'P0' },
    { id: 'EPIC-003', title: '商品管理', goal: '维护商品目录', priority: 'P1' }
  ],
  stories: [
    { id: 'STORY-001', epicId: 'EPIC-001', title: '创建客户', description: '创建客户', acceptance: ['客户编号唯一'], priority: 'P0' },
    { id: 'STORY-002', epicId: 'EPIC-001', title: '编辑客户', description: '编辑客户', acceptance: ['保存后列表更新'], priority: 'P0' },
    { id: 'STORY-003', epicId: 'EPIC-001', title: '查询客户', description: '查询客户', acceptance: ['能按名称筛选'], priority: 'P0' },
    { id: 'STORY-004', epicId: 'EPIC-002', title: '创建订单', description: '创建订单', acceptance: ['订单号唯一'], priority: 'P0' },
    { id: 'STORY-005', epicId: 'EPIC-002', title: '编辑订单', description: '编辑订单', acceptance: ['保存后列表更新'], priority: 'P0' },
    { id: 'STORY-006', epicId: 'EPIC-002', title: '查询订单', description: '查询订单', acceptance: ['能按客户筛选'], priority: 'P0' },
    { id: 'STORY-007', epicId: 'EPIC-002', title: '订单详情', description: '查看订单', acceptance: ['字段完整'], priority: 'P1' },
    { id: 'STORY-008', epicId: 'EPIC-003', title: '创建商品', description: '创建商品', acceptance: ['编码唯一'], priority: 'P0' },
    { id: 'STORY-009', epicId: 'EPIC-003', title: '编辑商品', description: '编辑商品', acceptance: ['保存后列表更新'], priority: 'P0' },
    { id: 'STORY-010', epicId: 'EPIC-003', title: '查询商品', description: '查询商品', acceptance: ['能按名称筛选'], priority: 'P1' }
  ],
  entities: [
    {
      name: '客户',
      tableName: 'biz_customer',
      description: '客户主表',
      requirementRefs: ['STORY-001', 'STORY-002', 'STORY-003'],
      fields: [
        { name: 'customerNo', label: '客户编号', type: 'string', length: 32, required: true, unique: true },
        { name: 'customerName', label: '客户名称', type: 'string', required: true }
      ]
    },
    {
      name: '订单',
      tableName: 'biz_order',
      description: '销售订单',
      requirementRefs: ['STORY-004', 'STORY-005', 'STORY-006', 'STORY-007'],
      fields: [
        { name: 'orderNo', label: '订单号', type: 'string', length: 32, required: true, unique: true },
        { name: 'amount', label: '金额', type: 'decimal', precision: 2, required: true }
      ]
    },
    {
      name: '商品',
      tableName: 'biz_product',
      description: '商品目录',
      requirementRefs: ['STORY-008', 'STORY-009', 'STORY-010'],
      fields: [
        { name: 'productCode', label: '商品编码', type: 'string', length: 32, required: true, unique: true },
        { name: 'productName', label: '商品名称', type: 'string', required: true }
      ]
    }
  ]
}

/** 结构化需求 + 已确认设计 + 每页 PNG；返回设计项目 */
async function prepareDesign(
  context: Setup,
  spec: DesignSpec
): Promise<{
  project: ReturnType<Setup['design']['getDesign']>
  pageIds: string[]
}> {
  resetDesign(context.db)
  try {
    context.doc.reopenRequirementDoc(APP_ID)
  } catch {
    // 可能还没确认
  }
  context.doc.saveDocSection(APP_ID, 'scenes', {
    data: {
      scenes: spec.scenes,
      epics: [],
      stories: []
    }
  })
  context.doc.saveDocSection(APP_ID, 'epics', {
    data: {
      scenes: [],
      epics: spec.epics,
      stories: spec.stories
    }
  })
  for (const section of context.doc.ensureRequirementDoc(APP_ID).sections) {
    if (!section.required || section.markdown.trim()) continue
    context.doc.saveDocSection(APP_ID, section.sectionKey, { markdown: `内容-${section.title}` })
  }
  context.doc.saveDocSection(APP_ID, 'users', { markdown: '- 销售：维护客户' })
  context.doc.confirmRequirementDoc(APP_ID)
  context.db.prepare("UPDATE apps SET status = 'design' WHERE id = ?").run(APP_ID)

  const project = context.design.getDesign(APP_ID)
  assert.equal(project.requirement?.confirmed, true)

  let saved = context.design.saveEntities(APP_ID, spec.entities, 'manual')
  saved = context.design.generateDefaultPageSets(APP_ID)
  const pageIds: string[] = []
  for (const set of saved.pageSets) {
    for (const page of set.pages) {
      pageIds.push(page.id)
      context.design.savePageSnapshot(APP_ID, page.id, {
        imageBase64: `data:image/png;base64,${PNG.toString('base64')}`,
        html: `<div>${page.title}</div>`
      })
    }
  }
  saved = context.design.getDesign(APP_ID)
  context.design.saveEntities(
    APP_ID,
    saved.entities.map(entity => ({ ...entity, status: 'confirmed' })),
    'manual'
  )
  for (const set of context.design.getDesign(APP_ID).pageSets) {
    context.design.savePageSet(APP_ID, set.id, { status: 'confirmed' })
  }
  context.design.confirmDesign(APP_ID)
  return { project: context.design.getDesign(APP_ID), pageIds }
}

async function readyDesign(context: Setup): Promise<{
  project: ReturnType<Setup['design']['getDesign']>
  pageIds: string[]
}> {
  return prepareDesign(context, SMALL_SPEC)
}

async function readyLargeDesign(context: Setup): Promise<{
  project: ReturnType<Setup['design']['getDesign']>
  pageIds: string[]
}> {
  return prepareDesign(context, LARGE_SPEC)
}

test('交接包渲染：00—05 + schema + template + manifest + prototypes，且不泄露内部 ID', async () => {
  const context = await setup()
  const { project, pageIds } = await readyDesign(context)

  const validation = context.handoff.validateDesignHandoff(APP_ID, project)
  assert.deepEqual(validation.issues, [])

  const preview = context.handoff.previewDesignHandoff(APP_ID)
  const names = preview.files.map(file => file.name)
  for (const expected of [
    '00-README.md',
    '01-REQUIREMENTS.md',
    '02-DATA-MODEL.md',
    '03-PAGES.md',
    '04-PLAN.md',
    '05-CHANGES.md',
    'schema.sql',
    'prototype-template.json',
    'manifest.json'
  ]) {
    assert.ok(names.includes(expected), `缺少 ${expected}`)
  }
  assert.ok(names.some(name => name.startsWith('prototypes/MOD-001/ps-001/')), '缺少页面 PNG')
  assert.equal((preview.changeSet.seq), 1)
  assert.equal(preview.changeSet.title, '初始开发')
  assert.equal(preview.changeSet.baselineHandoffVersion, null)
  // 预览反映“生成后”的目标状态，而不是生成前的 design
  assert.equal(preview.changeSet.status, 'development')
  // MF-M6a-1：预览也合成 #1 模块行（不写库）
  assert.equal(preview.changeSet.modules?.length, 1)
  assert.equal(preview.changeSet.modules?.[0].moduleKey, 'MOD-001')
  assert.equal(preview.changeSet.modules?.[0].reqBaseVersion, null)
  assert.equal(preview.changeSet.modules?.[0].reqCurrentVersion, project.requirement?.version)
  assert.equal(preview.changeSet.modules?.[0].designBaseVersion, null)
  assert.equal(preview.changeSet.modules?.[0].designCurrentVersion, project.version)
  const previewImage = preview.files.find(file => file.kind === 'image')
  assert.ok(previewImage, '预览应包含页面 PNG')
  assert.equal(previewImage.url, undefined, '预览未写盘时不应发 PNG URL')
  // 预览不写库
  const count = context.db.prepare('SELECT COUNT(*) AS count FROM design_handoffs').get() as { count: number }
  assert.equal(count.count, 0)
  const changeSets = context.db.prepare('SELECT COUNT(*) AS count FROM app_change_sets').get() as { count: number }
  assert.equal(changeSets.count, 0)

  const content = (name: string): string => preview.files.find(file => file.name === name)?.content ?? ''
  const readme = content('00-README.md')
  assert.match(readme, /初始开发/)
  assert.match(readme, /status=development/)
  assert.match(readme, /页面规格是契约/)
  assert.match(readme, /不生成 OpenAPI/)
  const changes = content('05-CHANGES.md')
  assert.match(changes, /初始开发（无基线差异）/)
  assert.match(changes, /状态：development/)
  assert.match(content('01-REQUIREMENTS.md'), /STORY-001/)
  assert.match(content('03-PAGES.md'), /ENT-001/)
  assert.match(content('03-PAGES.md'), /PAGE-00\d/)
  assert.match(content('03-PAGES.md'), /prototypes\/MOD-001\/ps-001\/page-001\.png/)
  assert.match(content('04-PLAN.md'), /STORY-001/)

  const schema = content('schema.sql')
  assert.match(schema, /CREATE TABLE IF NOT EXISTS `biz_customer`/)
  assert.match(schema, /`customerNo` VARCHAR\(32\) NOT NULL COMMENT '客户编号；主键'/)
  assert.match(schema, /PRIMARY KEY \(`customerNo`\)/)
  assert.match(schema, /`creditLimit` DECIMAL\(18, 2\)/)
  assert.match(schema, /`active` TINYINT\(1\).*DEFAULT 1/)
  assert.match(schema, /选项：普通\/VIP/)
  assert.ok(!/FOREIGN KEY/i.test(schema), 'schema.sql 不应生成真实外键')

  const manifest = JSON.parse(content('manifest.json')) as {
    changeSet: { seq: number; title: string; status: string; baselineHandoffVersion: number | null; currentHandoffVersion: number }
    requirements: { version: number; hash: string; inputId: string }
    counts: { entities: number; pageSets: number; pages: number; stories: number }
    scale: {
      level: string
      suggested: boolean
      phaseCount: number
      derivedFrom: string
      counts: { stories: number; pages: number }
      triggers: Array<{ metric: string }>
    }
    files: Array<{ name: string; hash: string; kind: string }>
    phases?: unknown
  }
  assert.equal(manifest.changeSet.seq, 1)
  assert.equal(manifest.changeSet.title, '初始开发')
  assert.equal(manifest.changeSet.status, 'development')
  assert.equal(manifest.changeSet.baselineHandoffVersion, null)
  assert.equal(manifest.changeSet.currentHandoffVersion, preview.version)
  assert.equal(manifest.counts.entities, 1)
  assert.equal(manifest.counts.stories, 2)
  assert.ok(manifest.counts.pages >= 4)
  assert.ok(manifest.files.some(file => file.name === 'manifest.json') === false, 'manifest 不列出自身，避免自引用')
  assert.equal(manifest.requirements.version, project.requirement?.version)

  // I-09b-1（U6）：小交接包 normal——04-PLAN/README 保持原内容，manifest 记录 scale
  assert.equal(preview.scale.level, 'normal')
  assert.equal(preview.scale.suggested, false)
  assert.equal(manifest.scale.level, 'normal')
  assert.equal(manifest.scale.suggested, false)
  assert.equal(manifest.scale.phaseCount, 0)
  assert.equal(manifest.scale.derivedFrom, 'none')
  assert.deepEqual(manifest.scale.triggers, [])
  // U7-1：normal 交接包不写 phases（旧/小交接包调用 phases/generate → 409）
  assert.equal(manifest.phases, undefined)
  assert.ok(!content('04-PLAN.md').includes('建议分阶段开发'), '小交接包不应出现建议分阶段章节')
  assert.ok(!content('00-README.md').includes('本交接包较大'), '小交接包 README 不应出现规模提示')

  // 文档不包含工作台内部 ID（页面/实体/页面集 id）
  const internalIds = [
    ...project.entities.map(entity => entity.id),
    ...project.pageSets.map(set => set.id),
    ...project.pageSets.flatMap(set => set.pages.map(page => page.id))
  ]
  const textDocs = preview.files.filter(file => file.kind === 'text').map(file => file.content ?? '').join('\n')
  for (const id of internalIds) {
    assert.ok(!textDocs.includes(id), `文档泄露内部 ID：${id}`)
  }
  assert.deepEqual(new Set(pageIds).size, pageIds.length)
})

test('生成交接包：写盘/版本/hash、Change Set #1、切换到 development、重新生成 v2', async () => {
  const context = await setup()
  await readyDesign(context)

  const first = context.handoff.generateDesignHandoff(APP_ID)
  assert.equal(first.developmentStarted, true)
  assert.equal(first.handoff.version, 1)
  assert.equal(first.changeSet.seq, 1)
  assert.equal(first.handoff.scale.level, 'normal')
  // MF-M6a-1：Change Set #1 写模块行（base=null，current=当前版本）
  assert.equal(first.changeSet.modules?.length, 1)
  assert.equal(first.changeSet.modules?.[0].moduleKey, 'MOD-001')
  assert.equal(first.changeSet.modules?.[0].reqBaseVersion, null)
  assert.equal(first.changeSet.modules?.[0].designBaseVersion, null)
  assert.equal(first.changeSet.modules?.[0].templateId, null)
  const moduleRows = context.db
    .prepare('SELECT * FROM app_change_set_modules WHERE change_set_id = ?')
    .all(first.changeSet.id) as Array<{
    module_id: string
    req_base_version: number | null
    req_current_version: number | null
    req_current_hash: string | null
    design_base_version: number | null
    design_current_version: number | null
    design_current_hash: string | null
  }>
  assert.equal(moduleRows.length, 1)
  assert.equal(moduleRows[0].req_base_version, null)
  assert.equal(moduleRows[0].design_base_version, null)
  assert.equal(moduleRows[0].req_current_version, first.changeSet.modules?.[0].reqCurrentVersion)
  assert.equal(moduleRows[0].design_current_version, first.changeSet.modules?.[0].designCurrentVersion)
  assert.match(moduleRows[0].req_current_hash ?? '', /^[0-9a-f]{64}$/)
  assert.match(moduleRows[0].design_current_hash ?? '', /^[0-9a-f]{64}$/)
  const app = context.db.prepare('SELECT status, design_confirmed_at, development_started_at, handoff_hash, current_change_set_id FROM apps WHERE id = ?').get(APP_ID) as {
    status: string
    design_confirmed_at: string | null
    development_started_at: string | null
    handoff_hash: string | null
    current_change_set_id: string | null
  }
  assert.equal(app.status, 'development')
  assert.ok(app.design_confirmed_at)
  assert.ok(app.development_started_at)
  assert.equal(app.handoff_hash, first.handoff.hash)
  assert.ok(app.current_change_set_id)

  const docsDir = path.join(context.projects, APP_ID, 'docs', 'handoff')
  for (const file of first.handoff.files) {
    assert.ok(fs.existsSync(path.join(docsDir, file.name)), `文件未写盘：${file.name}`)
  }
  assert.ok(fs.existsSync(path.join(docsDir, 'prototypes', 'MOD-001', 'ps-001', 'page-001.png')))
  assert.ok(fs.statSync(path.join(docsDir, 'prototypes', 'MOD-001', 'ps-001', 'page-001.png')).size > 0)

  const read = context.handoff.readDesignHandoff(APP_ID)
  assert.equal(read.handoff?.version, 1)
  assert.equal(read.filesAvailable, true)
  assert.deepEqual(read.handoff?.scale, first.handoff.scale)
  assert.ok(read.files.some(file => file.kind === 'image' && file.url))
  assert.equal(read.changeSet?.title, '初始开发')
  assert.equal(read.changeSet?.status, 'development')
  const firstChanges = read.files.find(file => file.name === '05-CHANGES.md')?.content ?? ''
  assert.match(firstChanges, /初始开发（无基线差异）/)
  assert.match(firstChanges, /状态：development/)

  // 已在开发阶段重新生成：版本递增，不重复创建变更单
  const second = context.handoff.generateDesignHandoff(APP_ID)
  assert.equal(second.handoff.version, 2)
  assert.equal(second.changeSet.id, first.changeSet.id)
  assert.equal(second.developmentStarted, false)
  const appAfter = context.db.prepare('SELECT status, current_change_set_id FROM apps WHERE id = ?').get(APP_ID) as {
    status: string
    current_change_set_id: string
  }
  assert.equal(appAfter.status, 'development')
  assert.equal(appAfter.current_change_set_id, first.changeSet.id)
  const changeSets = context.db.prepare('SELECT COUNT(*) AS count FROM app_change_sets WHERE app_id = ?').get(APP_ID) as { count: number }
  assert.equal(changeSets.count, 1)
  const moduleRowsAfter = context.db
    .prepare('SELECT COUNT(*) AS count FROM app_change_set_modules WHERE change_set_id = ?')
    .get(first.changeSet.id) as { count: number }
  assert.equal(moduleRowsAfter.count, 1, '同一变更单重新生成不应重复插模块行')

  // v2 不能继续自称“首次开发”，必须要求增量修改
  const latestRead = context.handoff.readDesignHandoff(APP_ID)
  const latestChanges = latestRead.files.find(file => file.name === '05-CHANGES.md')?.content ?? ''
  const latestReadme = latestRead.files.find(file => file.name === '00-README.md')?.content ?? ''
  assert.match(latestChanges, /同一变更单 #1 内重新生成/)
  assert.match(latestChanges, /不要重写整个项目/)
  assert.ok(!latestChanges.includes('这是应用的首次开发'))
  assert.match(latestReadme, /同一变更单 #1 内重新生成/)

  const oldRead = context.handoff.readDesignHandoff(APP_ID, 1)
  assert.equal(oldRead.filesAvailable, false)
  assert.ok(oldRead.files.every(file => file.missing))
  const oldImage = oldRead.files.find(file => file.kind === 'image')
  assert.ok(oldImage?.missing)
  assert.equal(oldImage?.url, undefined, '历史版本不应发可能指向最新文件的 PNG URL')

  const summary = context.handoff.designHandoffSummary(APP_ID)
  assert.equal(summary?.version, 2)
  assert.equal(summary?.changeSet?.seq, 1)

  context.handoff.completeActiveChangeSet(APP_ID)
  const completed = context.db.prepare('SELECT status, completed_at FROM app_change_sets WHERE app_id = ?').get(APP_ID) as {
    status: string
    completed_at: string | null
  }
  assert.equal(completed.status, 'completed')
  assert.ok(completed.completed_at)
})

test('校验阻塞：缺 PNG、设计未确认', async () => {
  const context = await setup()
  const { project } = await readyDesign(context)

  // 删掉一个页面的 PNG 文件 → 阻塞
  const page = project.pageSets[0].pages[0]
  assert.ok(page.imagePath)
  const abs = path.join(context.projects, APP_ID, page.imagePath)
  fs.rmSync(abs)
  assert.throws(
    () => context.handoff.previewDesignHandoff(APP_ID),
    (error: unknown) => {
      const typed = error as { status?: number; issues?: string[] }
      assert.equal(typed.status, 400)
      assert.ok(typed.issues?.some(issue => issue.includes('原型 PNG 文件不存在')))
      return true
    }
  )

  // 设计回到 draft → 阻塞
  context.design.reopenDesign(APP_ID)
  assert.throws(
    () => context.handoff.previewDesignHandoff(APP_ID),
    (error: unknown) => {
      const typed = error as { status?: number; issues?: string[] }
      assert.equal(typed.status, 400)
      assert.ok(typed.issues?.some(issue => issue.includes('设计尚未确认')))
      return true
    }
  )

  // 文件读取拒绝路径穿越
  assert.throws(
    () => context.handoff.designHandoffFile(APP_ID, '../user-config.xml'),
    (error: unknown) => {
      const typed = error as { status?: number }
      assert.equal(typed.status, 400)
      return true
    }
  )
})

test('大交接包：04-PLAN 建议分阶段 + README 提示 + manifest.scale；preview 不写盘', async () => {
  const context = await setup()
  const { project } = await readyLargeDesign(context)

  const preview = context.handoff.previewDesignHandoff(APP_ID)
  const content = (name: string): string => preview.files.find(file => file.name === name)?.content ?? ''

  assert.equal(preview.scale.level, 'large')
  assert.equal(preview.scale.suggested, true)
  assert.equal(preview.scale.counts.stories, 10)
  assert.equal(preview.scale.counts.pages, 12)
  assert.equal(preview.scale.counts.epics, 3)
  assert.equal(preview.scale.counts.pageSets, 3)
  assert.equal(preview.scale.derivedFrom, 'epics')
  assert.equal(preview.scale.phaseCount, 4)
  assert.deepEqual(preview.scale.triggers.map(trigger => trigger.metric), ['stories', 'pages'])

  const plan = content('04-PLAN.md')
  assert.match(plan, /## 0\. 建议分阶段开发（可选）/)
  assert.match(plan, /规模：10 Story \/ 12 页面 \/ \d+ KB/)
  assert.match(plan, /只是建议，不强制、不做门禁/)
  assert.match(plan, /### 阶段 1 · 数据模型与基础框架/)
  assert.match(plan, /### 阶段 2 · EPIC-001 客户管理/)
  assert.match(plan, /### 阶段 3 · EPIC-002 订单管理/)
  assert.match(plan, /### 阶段 4 · EPIC-003 商品管理/)
  assert.match(plan, /Story：STORY-001 创建客户/)
  assert.match(plan, /页面集：PS-001/)
  assert.match(plan, /页面：PAGE-001/)
  assert.match(plan, /建议会话标题：`EPIC-001 客户管理`/)
  assert.match(plan, /### 使用方式/)
  // 建议章节插入在最前，原有 1—6 节保持
  assert.ok(plan.indexOf('## 0. 建议分阶段开发') < plan.indexOf('## 1. 建议顺序'))
  assert.match(plan, /## 6\. 交付格式/)

  const readme = content('00-README.md')
  assert.match(readme, /本交接包较大（10 Story \/ 12 页面 \/ \d+ KB）/)
  assert.match(readme, /04-PLAN\.md/)
  assert.match(readme, /也可单会话完成/)

  const manifest = JSON.parse(content('manifest.json')) as {
    scale: {
      level: string
      suggested: boolean
      phaseCount: number
      derivedFrom: string
      counts: { stories: number; pages: number; fields: number }
      triggers: Array<{ metric: string; value: number; threshold: number }>
    }
    phases?: Array<{
      key: string
      kind: string
      title: string
      goal: string
      storyIds: string[]
      pageSetCodes: string[]
      pageCodes: string[]
      note?: string
    }>
  }
  assert.equal(manifest.scale.level, 'large')
  assert.equal(manifest.scale.suggested, true)
  assert.equal(manifest.scale.phaseCount, 4)
  assert.equal(manifest.scale.derivedFrom, 'epics')
  assert.equal(manifest.scale.counts.stories, 10)
  assert.equal(manifest.scale.counts.pages, 12)
  assert.deepEqual(manifest.scale.triggers, preview.scale.triggers)

  // U7-1：大交接包 manifest.phases（U7 phases/generate 的唯一来源；04-PLAN 文案不变）
  assert.ok(Array.isArray(manifest.phases), 'manifest 缺少 phases')
  assert.deepEqual(manifest.phases?.map(phase => phase.key), ['base', 'epic:EPIC-001', 'epic:EPIC-002', 'epic:EPIC-003'])
  assert.deepEqual(manifest.phases?.map(phase => phase.kind), ['base', 'epic', 'epic', 'epic'])
  assert.equal(manifest.phases?.[0]?.title, '数据模型与基础框架')
  assert.deepEqual(manifest.phases?.[0]?.storyIds, [])
  assert.equal(manifest.phases?.[1]?.title, 'EPIC-001 客户管理')
  assert.match(manifest.phases?.[1]?.goal ?? '', /客户/)
  assert.deepEqual(manifest.phases?.[1]?.pageSetCodes, ['PS-001'])
  assert.ok((manifest.phases?.[1]?.pageCodes.length ?? 0) > 0)
  const manifestPhaseText = JSON.stringify(manifest.phases)
  for (const internal of [
    ...project.entities.map(entity => entity.id),
    ...project.pageSets.map(set => set.id),
    ...project.pageSets.flatMap(set => set.pages.map(page => page.id))
  ]) {
    assert.ok(!manifestPhaseText.includes(internal), `manifest.phases 泄露内部 ID：${internal}`)
  }

  // 05-CHANGES 语义不受影响
  assert.ok(!content('05-CHANGES.md').includes('建议分阶段'))

  // 文档不泄露内部 ID（页面/实体/页面集 id）
  const internalIds = [
    ...project.entities.map(entity => entity.id),
    ...project.pageSets.map(set => set.id),
    ...project.pageSets.flatMap(set => set.pages.map(page => page.id))
  ]
  for (const id of internalIds) {
    assert.ok(!plan.includes(id), `04-PLAN 泄露内部 ID：${id}`)
    assert.ok(!readme.includes(id), `00-README 泄露内部 ID：${id}`)
  }

  // 预览不写盘/不落库
  const count = context.db.prepare('SELECT COUNT(*) AS count FROM design_handoffs').get() as { count: number }
  assert.equal(count.count, 0)
  const changeSets = context.db.prepare('SELECT COUNT(*) AS count FROM app_change_sets').get() as { count: number }
  assert.equal(changeSets.count, 0)

  // 生成后 meta/manifest/read 一致
  const generated = context.handoff.generateDesignHandoff(APP_ID)
  assert.equal(generated.handoff.scale.level, 'large')
  assert.deepEqual(generated.handoff.scale, preview.scale)
  const read = context.handoff.readDesignHandoff(APP_ID)
  assert.deepEqual(read.handoff?.scale, generated.handoff.scale)
  const onDiskPlan = read.files.find(file => file.name === '04-PLAN.md')?.content ?? ''
  assert.match(onDiskPlan, /## 0\. 建议分阶段开发（可选）/)
  const onDiskManifest = JSON.parse(read.files.find(file => file.name === 'manifest.json')?.content ?? '{}') as {
    scale: { level: string }
    phases?: Array<{ key: string }>
  }
  assert.equal(onDiskManifest.scale.level, 'large')
  assert.deepEqual(onDiskManifest.phases?.map(phase => phase.key), ['base', 'epic:EPIC-001', 'epic:EPIC-002', 'epic:EPIC-003'])
})

test('变更单 caveat：seq>1 的 04-PLAN 明确“按全量生成、以 05-CHANGES 增量范围为准”，seq=1 不出现', async () => {
  const context = await setup()
  const { project } = await readyLargeDesign(context)

  const changeSetView = (seq: number) => {
    const now = new Date().toISOString()
    return {
      id: `cs-caveat-${seq}`,
      seq,
      title: seq === 1 ? '初始开发' : `变更 #${seq}`,
      description: '',
      scope: 'requirements',
      status: 'development',
      baselineHandoffVersion: seq > 1 ? 1 : null,
      currentHandoffVersion: seq > 1 ? 2 : 1,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    }
  }
  const filesFor = (seq: number): { plan: string; readme: string; changes: string } => {
    const bundle = buildDesignHandoffBundle({
      app: { id: APP_ID, name: '交接测试应用', description: 'D5 测试', backendPort: 8081 },
      project,
      changeSet: changeSetView(seq),
      version: seq > 1 ? 2 : 1,
      baselineHandoffVersion: seq > 1 ? 1 : null,
      changeReport: null,
      warnings: []
    })
    const scale = assessHandoffScale(bundle, 0)
    // 大交接包命中 Story/页面阈值，必然出现建议章节
    assert.equal(scale.scale.suggested, true)
    const files = renderDesignHandoffText(bundle, scale.scale, scale.phases)
    const content = (name: string): string => files.find(file => file.name === name)?.content ?? ''
    return { plan: content('04-PLAN.md'), readme: content('00-README.md'), changes: content('05-CHANGES.md') }
  }

  const second = filesFor(2)
  assert.match(second.plan, /本次为变更 #2：以下阶段按全量交接包生成/)
  assert.match(second.plan, /实际开发范围以 `05-CHANGES\.md` 的增量与影响为准/)
  assert.match(second.plan, /不要按阶段重写未变更部分/)
  // caveat 只加在规模行之后，建议章节本身仍保留
  assert.ok(second.plan.indexOf('## 0. 建议分阶段开发') < second.plan.indexOf('规模：'))
  assert.ok(second.plan.indexOf('规模：') < second.plan.indexOf('本次为变更 #2'))
  assert.match(second.readme, /本次为变更 #2，增量范围以 `05-CHANGES\.md` 为准/)

  const first = filesFor(1)
  assert.ok(!first.plan.includes('本次为变更'), 'seq=1 不应出现变更 caveat')
  assert.ok(!first.readme.includes('本次为变更'), 'seq=1 README 不应出现变更 caveat')
  assert.match(first.plan, /## 0\. 建议分阶段开发（可选）/)
  assert.match(first.readme, /本交接包较大/)

  // 05-CHANGES 自身语义不变（不因 caveat 改写）
  assert.match(second.changes, /增量变更（变更单 #2）/)
  assert.ok(!second.changes.includes('以下阶段按全量交接包生成'))
})

test('旧交接包 manifest 无 scale：read 返回 scale=null（前端隐藏提示）', async () => {
  const context = await setup()
  await readyDesign(context)
  context.handoff.generateDesignHandoff(APP_ID)

  const row = context.db
    .prepare('SELECT version, manifest_json FROM design_handoffs WHERE app_id = ? ORDER BY version DESC LIMIT 1')
    .get(APP_ID) as { version: number; manifest_json: string }
  const manifest = JSON.parse(row.manifest_json) as Record<string, unknown>
  delete manifest.scale
  context.db
    .prepare('UPDATE design_handoffs SET manifest_json = ? WHERE app_id = ? AND version = ?')
    .run(JSON.stringify(manifest), APP_ID, row.version)

  const read = context.handoff.readDesignHandoff(APP_ID)
  assert.equal(read.handoff?.version, 1)
  assert.equal(read.handoff?.scale, null)
  assert.match(read.files.find(file => file.name === '04-PLAN.md')?.content ?? '', /## 1\. 建议顺序/)
})
