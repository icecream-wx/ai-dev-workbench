/**
 * C1 变更单（后端）单测：
 * - 发起变更：前置校验 / 基线捕获 / 状态切换 / 归档会话 / 只允许一个 active
 * - reopen 门禁（开发/完成阶段需先发起变更，scope 规则）
 * - 交接包绑定 active 变更单；无 active 且有交接包时生成 409、预览允许
 * - 05-CHANGES 真实 diff（需求+设计+模板+删除，不泄露内部 ID）
 * - 取消：门禁 + 恢复基线（文档/设计/应用/会话）+ 不物理删除版本
 * - 确认完成只关闭当前变更单；ensureChangeSet 不复用已完成/已取消单
 *
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
  design: typeof import('../design/service')
  handoff: typeof import('../handoff/design-service')
  changes: typeof import('./service')
  query: typeof import('./query')
  render: typeof import('../handoff/design-render')
}

let setupPromise: Promise<Setup> | null = null

async function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-changeset-'))
    const projects = path.join(root, 'projects')
    process.env.RG_DATA_DIR = path.join(root, 'data')
    process.env.RG_PROJECTS_DIR = projects
    const dbModule = await import('../db')
    const doc = await import('../requirements/doc')
    const design = await import('../design/service')
    const handoff = await import('../handoff/design-service')
    const changes = await import('./service')
    const query = await import('./query')
    const render = await import('../handoff/design-render')
    return { root, projects, db: dbModule.db, doc, design, handoff, changes, query, render }
  })()
  return setupPromise
}

after(async () => {
  if (!setupPromise) return
  const { root, db } = await setupPromise
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03])
const STORY_ACCEPTANCE = ['客户编号唯一', '客户名称必填']

interface RequirementIds {
  epicId: string
  story1: string
  story2: string
  story3: string
}

/**
 * 每个测试应用用不同的 Epic/Story 稳定 ID：
 * 页面集 id 由 Epic 派生（ps-hash(epicId)），同一 SQLite 里多个应用会主键冲突。
 */
function idsFor(id: string): RequirementIds {
  let seed = 0
  for (const char of id) seed = (seed * 31 + char.charCodeAt(0)) % 800
  const base = 100 + seed
  return { epicId: `EPIC-${base}`, story1: `STORY-${base}1`, story2: `STORY-${base}2`, story3: `STORY-${base}3` }
}

function insertApp(context: Setup, id: string): string {
  const now = new Date().toISOString()
  context.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 8081, 'requirements', ?, ?)`
    )
    .run(id, `应用 ${id}`, 'C1 测试', id, now, now)
  fs.mkdirSync(path.join(context.projects, id), { recursive: true })
  return id
}

interface RequirementOptions {
  stories?: Array<{ id: string; title: string; acceptance?: string[] }>
}

/** 结构化需求（SCENE/EPIC/STORY 稳定 ID）并确认 */
function prepareRequirement(context: Setup, id: string, options: RequirementOptions = {}): RequirementIds {
  const ids = idsFor(id)
  const stories = options.stories ?? [
    { id: ids.story1, title: '创建客户', acceptance: STORY_ACCEPTANCE },
    { id: ids.story2, title: '查询客户', acceptance: ['能按名称筛选'] }
  ]
  // 页面集 id 由 Epic 派生；不同测试应用用不同 Epic ID，避免跨应用主键冲突
  const sceneTitle = `客户管理（${id}）`
  context.doc.saveDocSection(id, 'scenes', {
    data: { scenes: [{ title: sceneTitle, description: '销售维护客户' }], epics: [], stories: [] }
  })
  context.doc.saveDocSection(id, 'epics', {
    data: {
      scenes: [],
      epics: [{ id: ids.epicId, title: '客户管理', goal: '维护客户信息', priority: 'P0' }],
      stories: stories.map((story, index) => ({
        id: story.id,
        epicId: ids.epicId,
        title: story.title,
        description: `作为销售，我希望${story.title}`,
        acceptance: story.acceptance ?? [],
        priority: index === 0 ? 'P0' : 'P1'
      }))
    }
  })
  for (const section of context.doc.ensureRequirementDoc(id).sections) {
    if (!section.required || section.markdown.trim()) continue
    context.doc.saveDocSection(id, section.sectionKey, { markdown: `内容-${section.title}` })
  }
  context.doc.saveDocSection(id, 'users', { markdown: '- 销售：维护客户' })
  context.doc.confirmRequirementDoc(id)
  return ids
}

/** 确认设计（实体 + 页面集 + 每页 PNG），不生成交接包 */
function prepareConfirmedDesign(context: Setup, id: string): { pageIds: string[]; ids: RequirementIds } {
  const ids = idsFor(id)
  let project = context.design.getDesign(id)
  project = context.design.saveEntities(
    id,
    [
      {
        name: '客户',
        tableName: 'biz_customer',
        description: '客户主表',
        requirementRefs: [ids.story1, ids.story2],
        fields: [
          { name: 'customerNo', label: '客户编号', type: 'string', length: 32, required: true, unique: true },
          { name: 'customerName', label: '客户名称', type: 'string', required: true },
          { name: 'level', label: '客户等级', type: 'enum', options: ['普通', 'VIP'] }
        ]
      }
    ],
    'manual'
  )
  project = context.design.generateDefaultPageSets(id)
  const pageIds: string[] = []
  for (const set of project.pageSets) {
    for (const page of set.pages) {
      pageIds.push(page.id)
      context.design.savePageSnapshot(id, page.id, {
        imageBase64: `data:image/png;base64,${PNG.toString('base64')}`,
        html: `<div>${page.title}</div>`
      })
    }
  }
  project = context.design.getDesign(id)
  context.design.saveEntities(
    id,
    project.entities.map(entity => ({ ...entity, status: 'confirmed' })),
    'manual'
  )
  for (const set of context.design.getDesign(id).pageSets) {
    context.design.savePageSet(id, set.id, { status: 'confirmed' })
  }
  context.design.confirmDesign(id)
  return { pageIds, ids }
}

function appRow(context: Setup, id: string): {
  status: string
  completed_at: string | null
  current_change_set_id: string | null
  requirements_confirmed_at: string | null
  design_confirmed_at: string | null
  updated_at: string
} {
  return context.db
    .prepare(
      'SELECT status, completed_at, current_change_set_id, requirements_confirmed_at, design_confirmed_at, updated_at FROM apps WHERE id = ?'
    )
    .get(id) as never
}

function insertActiveSession(context: Setup, id: string, sessionId: string): void {
  const now = new Date().toISOString()
  context.db
    .prepare(
      `INSERT INTO app_sessions (id, app_id, stage, opencode_session_id, provider_id, model_id, status, created_at, updated_at, last_active_at)
       VALUES (?, ?, 'development', ?, 'p', 'm', 'active', ?, ?, NULL)`
    )
    .run(sessionId, id, `oc-${sessionId}`, now, now)
}

function sessionStatus(context: Setup, sessionId: string): string | null {
  const row = context.db.prepare('SELECT status FROM app_sessions WHERE id = ?').get(sessionId) as
    | { status: string }
    | undefined
  return row?.status ?? null
}

/** 需求 + 设计确认 + 交接包 v1 + 已完成（含 active 会话） */
function readyCompletedApp(context: Setup, id: string): {
  pageIds: string[]
  ids: RequirementIds
  sessionId: string
  docVersion: number
  designVersion: number
} {
  insertApp(context, id)
  prepareRequirement(context, id)
  const { pageIds, ids } = prepareConfirmedDesign(context, id)
  context.handoff.generateDesignHandoff(id)
  const now = new Date().toISOString()
  context.db.prepare("UPDATE apps SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?").run(now, now, id)
  context.handoff.completeActiveChangeSet(id)
  const sessionId = `sess-${id}`
  insertActiveSession(context, id, sessionId)
  return {
    pageIds,
    ids,
    sessionId,
    docVersion: context.doc.ensureRequirementDoc(id).doc.version,
    designVersion: context.design.getDesign(id).version
  }
}

test('发起变更（需求+设计）：基线捕获、状态切换、归档会话、只允许一个 active', async () => {
  const context = await setup()
  const id = 'cs-start'
  const ready = readyCompletedApp(context, id)
  const before = appRow(context, id)
  const baseInputId = context.design.getDesign(id).sourceInputId
  assert.ok(baseInputId, '设计项目应已绑定需求输入')

  assert.throws(() => context.changes.startChangeSet(id, { title: '   ' }), /标题不能为空/)

  const { changeSet } = context.changes.startChangeSet(id, {
    title: '新增客户等级',
    description: '增加等级维度',
    scope: 'requirements'
  })
  assert.equal(changeSet.seq, 2)
  assert.equal(changeSet.status, 'requirements')
  assert.equal(changeSet.scope, 'requirements')
  assert.equal(changeSet.baseRequirementsVersion, ready.docVersion)
  assert.equal(changeSet.baseDesignVersion, ready.designVersion)
  assert.equal(changeSet.baseHandoffVersion, 1)
  assert.equal(changeSet.baseAppStatus, 'completed')
  assert.equal(changeSet.baseCompletedAt, before.completed_at)
  assert.equal(changeSet.active, true)

  const row = context.query.changeSetRowById(id, changeSet.id)
  assert.ok(row)
  assert.equal(row?.base_input_id, baseInputId)
  assert.equal(row?.base_session_id, ready.sessionId)

  const app = appRow(context, id)
  assert.equal(app.status, 'requirements')
  assert.equal(app.requirements_confirmed_at, null)
  assert.equal(app.current_change_set_id, changeSet.id)
  // 保留上一版完成时间，取消时可恢复
  assert.equal(app.completed_at, before.completed_at)

  assert.equal(context.doc.ensureRequirementDoc(id).doc.status, 'draft')
  assert.equal(context.design.designSummary(id)?.status, 'draft')
  // 旧开发会话归档（只读）
  assert.equal(sessionStatus(context, ready.sessionId), 'archived')

  assert.throws(() => context.changes.startChangeSet(id, { title: '第二个变更' }), /已有进行中的变更单/)

  // 没有交接包时不能发起变更
  const noHandoff = 'cs-no-handoff'
  insertApp(context, noHandoff)
  prepareRequirement(context, noHandoff)
  prepareConfirmedDesign(context, noHandoff)
  context.db.prepare("UPDATE apps SET status = 'development' WHERE id = ?").run(noHandoff)
  assert.throws(() => context.changes.startChangeSet(noHandoff, { title: '缺少交接包' }), /还没有生成交接包/)
})

test('scope=design：只重开设计；reopen 门禁按 active 变更单/scope 放行', async () => {
  const context = await setup()
  const id = 'cs-design-scope'
  readyCompletedApp(context, id)

  // 开发/完成阶段：没有 active 变更单 → 需求/设计 reopen 都被拒绝
  assert.throws(() => context.doc.reopenRequirementDoc(id), /发起变更/)
  assert.throws(() => context.design.reopenDesign(id), /发起变更/)

  const { changeSet } = context.changes.startChangeSet(id, { title: '只改设计', scope: 'design' })
  assert.equal(changeSet.seq, 2)
  assert.equal(changeSet.status, 'design')
  assert.equal(appRow(context, id).status, 'design')
  // 需求保持已确认
  assert.equal(context.doc.ensureRequirementDoc(id).doc.status, 'confirmed')
  assert.equal(context.design.designSummary(id)?.status, 'draft')

  // scope=design 不允许重开需求
  assert.throws(() => context.doc.reopenRequirementDoc(id), /仅设计/)

  // 设计重新确认后变更单保持 design，并更新当前设计版本
  context.design.confirmDesign(id)
  const row = context.query.changeSetRowById(id, changeSet.id)
  assert.equal(row?.status, 'design')
  assert.equal(row?.current_design_version, context.design.getDesign(id).version)
})

test('交接包：有 active 变更单时绑定该单（基线=单基线）；无 active 且有交接包时生成 409、预览允许', async () => {
  const context = await setup()
  const id = 'cs-handoff'
  const ready = readyCompletedApp(context, id)
  const ids = ready.ids

  const blockedPreview = context.handoff.previewDesignHandoff(id)
  assert.equal(blockedPreview.canGenerate, false)
  assert.equal(blockedPreview.changeSet.seq, 1)
  assert.ok(blockedPreview.warnings.some(warning => warning.includes('没有进行中的变更单')))
  assert.throws(() => context.handoff.generateDesignHandoff(id), /请先在应用头部“发起变更”/)

  // 发起需求变更 → 改需求 → 确认 → 同步设计输入 → 确认设计 → 生成 v2
  const { changeSet } = context.changes.startChangeSet(id, { title: '新增客户等级字典', scope: 'requirements' })
  assert.equal(context.doc.reopenRequirementDoc(id).doc.status, 'draft')
  context.doc.saveDocSection(id, 'epics', {
    data: {
      scenes: [],
      epics: [{ id: ids.epicId, title: '客户管理（改）', goal: '维护客户与等级', priority: 'P0' }],
      stories: [
        { id: ids.story1, epicId: ids.epicId, title: '创建客户', description: '创建客户并选择等级', acceptance: STORY_ACCEPTANCE.concat('等级必填'), priority: 'P0' },
        { id: ids.story2, epicId: ids.epicId, title: '查询客户', description: '按名称查询客户', acceptance: ['能按名称筛选'], priority: 'P1' },
        { id: ids.story3, epicId: ids.epicId, title: '维护客户等级', description: '维护等级字典', acceptance: ['能新增等级'], priority: 'P1' }
      ]
    }
  })
  context.doc.confirmRequirementDoc(id)
  assert.equal(context.query.changeSetRowById(id, changeSet.id)?.status, 'design')

  context.design.syncDesignInput(id, 'additions')
  context.design.confirmDesign(id)

  const generated = context.handoff.generateDesignHandoff(id)
  assert.equal(generated.handoff.version, 2)
  assert.equal(generated.changeSet.seq, 2)
  assert.equal(generated.changeSet.id, changeSet.id)
  assert.equal(generated.baselineHandoffVersion, 1)

  const handoffRow = context.db
    .prepare('SELECT change_set_id, baseline_handoff_version FROM design_handoffs WHERE app_id = ? AND version = 2')
    .get(id) as { change_set_id: string; baseline_handoff_version: number }
  assert.equal(handoffRow.change_set_id, changeSet.id)
  assert.equal(handoffRow.baseline_handoff_version, 1)

  const read = context.handoff.readDesignHandoff(id)
  const changesMd = read.files.find(file => file.name === '05-CHANGES.md')?.content ?? ''
  assert.match(changesMd, /增量变更（变更单 #2）/)
  assert.match(changesMd, /变更概览/)
  assert.ok(changesMd.includes(ids.story3), '05-CHANGES 应列出新增 Story')
  assert.match(changesMd, /客户管理（改）/)
  assert.doesNotMatch(changesMd, /这是应用的首次开发/)
  assert.match(read.files.find(file => file.name === '00-README.md')?.content ?? '', /变更 #2 · 基线：v1/)
  const manifest = read.handoff?.manifest as unknown as {
    changeSet: { changes: { total: number }; baselineHandoffVersion: number; currentHandoffVersion: number }
  }
  assert.equal(manifest.changeSet.baselineHandoffVersion, 1)
  assert.equal(manifest.changeSet.currentHandoffVersion, 2)
  assert.ok(manifest.changeSet.changes.total > 0)

  // 变更单状态/当前版本已更新，changes_md/summary_json 可读
  const row = context.query.changeSetRowById(id, changeSet.id)
  assert.equal(row?.status, 'development')
  assert.equal(row?.current_handoff_version, 2)
  assert.match(row?.changes_md ?? '', /增量变更（变更单 #2）/)
  assert.ok(row?.summary_json)

  // 完成后再次生成被拒绝（没有 active 变更单）
  const now = new Date().toISOString()
  context.db.prepare("UPDATE apps SET status = 'completed', completed_at = ? WHERE id = ?").run(now, id)
  context.handoff.completeActiveChangeSet(id)
  assert.throws(() => context.handoff.generateDesignHandoff(id), /请先在应用头部“发起变更”/)
})

test('05-CHANGES 真实 diff：需求/实体/字段/关系/页面/模板/删除，且不泄露内部 ID', async () => {
  const context = await setup()
  const { buildDesignChangeReport } = await import('../handoff/design-changes')

  const input = (stories: Array<{ id: string; title: string; acceptance: string[] }>, docVersion: number, docHash: string) => ({
    id: `din-${docVersion}`,
    appId: 'diff-app',
    docVersion,
    docHash,
    templateId: 'tpl',
    templateName: '企业级',
    confirmedAt: null,
    structure: 'prd' as const,
    scenes: [{ id: 'SCENE-001', title: '客户管理', description: '', position: 0 }],
    epics: [{ id: 'EPIC-001', title: '客户管理', goal: '', priority: 'P0', sceneId: 'SCENE-001', position: 0, stories: [] }],
    stories: stories.map((story, index) => ({
      id: story.id,
      epicId: 'EPIC-001',
      title: story.title,
      description: '',
      acceptance: story.acceptance,
      priority: 'P0',
      position: index
    })),
    roles: [],
    dataRules: { sectionKey: 'rules', markdown: '' },
    pageRequirements: { sectionKey: 'pages', markdown: '' },
    nonFunctionals: { sectionKey: 'nfr', markdown: '' },
    openQuestions: [],
    glossary: [],
    warnings: [],
    createdAt: ''
  })

  const entity = (overrides: Record<string, unknown>) => ({
    id: 'ent-1',
    name: '客户',
    tableName: 'biz_customer',
    description: '',
    fields: [],
    relations: [],
    requirementRefs: ['STORY-001'],
    sourceSections: [],
    status: 'confirmed' as const,
    position: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides
  })
  const pageSet = (overrides: Record<string, unknown>) => ({
    id: 'ps-1',
    sceneKey: 'scene-1',
    epicId: 'EPIC-001',
    storyIds: ['STORY-001'],
    title: '客户管理',
    description: '',
    status: 'confirmed' as const,
    position: 0,
    pages: [],
    entityIds: ['ent-1'],
    createdAt: '',
    updatedAt: '',
    ...overrides
  })
  const page = (overrides: Record<string, unknown>) => ({
    id: 'pg-1',
    pageSetId: 'ps-1',
    pageKey: 'list',
    title: '客户列表',
    type: 'list' as const,
    entityId: 'ent-1',
    requirementRefs: ['STORY-001'],
    spec: { columns: ['customerNo'] },
    layout: { table: { columns: ['customerNo'] } },
    status: 'confirmed' as const,
    version: 1,
    imagePath: null,
    htmlPath: null,
    imageHash: null,
    position: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides
  })

  const report = buildDesignChangeReport({
    changeSet: {
      seq: 2,
      title: '客户等级改造',
      scope: 'requirements',
      status: 'development',
      description: '新增等级、删除旧字段',
      baselineHandoffVersion: 1,
      currentHandoffVersion: 2
    },
    baseline: {
      requirements: input(
        [
          { id: 'STORY-001', title: '创建客户', acceptance: ['客户名称必填'] },
          { id: 'STORY-002', title: '查询客户', acceptance: ['能按名称筛选'] }
        ],
        5,
        'hash-a'
      ),
      docVersion: 5,
      docHash: 'hash-a',
      designVersion: 3,
      templateHash: 'template-a',
      entities: [
        entity({
          fields: [
            { name: 'customerNo', label: '客户编号', type: 'string' },
            { name: 'legacyFlag', label: '旧标记', type: 'boolean' }
          ]
        }),
        entity({ id: 'ent-0', name: '临时表', tableName: 'biz_tmp', requirementRefs: [] })
      ],
      pageSets: [
        pageSet({
          pages: [
            page({}),
            page({ id: 'pg-2', pageKey: 'detail', title: '客户详情', type: 'detail' })
          ]
        })
      ]
    },
    current: {
      requirements: input(
        [
          { id: 'STORY-001', title: '创建客户（改）', acceptance: ['客户名称必填', '等级必填'] },
          { id: 'STORY-003', title: '维护客户等级', acceptance: ['能新增等级'] }
        ],
        7,
        'hash-b'
      ),
      docVersion: 7,
      docHash: 'hash-b',
      designVersion: 5,
      templateHash: 'template-b',
      entities: [
        entity({
          fields: [
            { name: 'customerNo', label: '客户编号', type: 'string' },
            { name: 'level', label: '客户等级', type: 'enum', options: ['普通', 'VIP'] }
          ],
          relations: [{ name: '客户联系人', type: 'one-to-many', target: 'ent-2' }]
        }),
        entity({ id: 'ent-2', name: '客户联系人', tableName: 'biz_contact', fields: [], requirementRefs: ['STORY-003'] })
      ],
      pageSets: [
        pageSet({
          pages: [
            page({ spec: { columns: ['customerNo', 'level'] }, layout: { table: { columns: ['customerNo', 'level'] } } }),
            page({ id: 'pg-3', pageKey: 'create', title: '创建客户', type: 'form', spec: { mode: 'create' } })
          ]
        })
      ]
    }
  })

  const md = report.markdown
  assert.match(md, /## 1\. 变更概览/)
  assert.match(md, /## 2\. 需求变更/)
  assert.match(md, /## 3\. 设计变更/)
  assert.match(md, /## 4\. 影响提示/)
  assert.match(md, /## 5\. 删除与迁移/)
  assert.match(md, /## 6\. 实现要求/)
  assert.match(md, /STORY-001 创建客户（改）/)
  assert.match(md, /STORY-003 维护客户等级/)
  assert.match(md, /STORY-002 查询客户/)
  assert.match(md, /客户联系人/)
  assert.match(md, /biz_contact/)
  assert.match(md, /biz_tmp/)
  assert.match(md, /页面「客户详情」/)
  assert.match(md, /原型模板/)
  assert.match(md, /不要重写整个项目/)
  assert.match(md, /迁移 SQL/)
  assert.match(md, /影响提示/)
  assert.ok(report.counts.removed >= 3, `删除计数应覆盖需求/实体/页面，实际 ${report.counts.removed}`)
  assert.ok(report.counts.added >= 2)
  assert.ok(report.counts.modified >= 2)
  assert.equal(report.summary.design.templateChanged, true)
  assert.equal(report.summary.requirements.docHashChanged, true)
  // 不输出工作台内部 ID
  for (const internal of ['ent-1', 'ent-2', 'ent-0', 'ps-1', 'pg-1', 'pg-2', 'pg-3']) {
    assert.ok(!md.includes(internal), `05-CHANGES 泄露内部 ID：${internal}`)
  }
})

test('取消变更：仅在已确认差异且未生成交接包时允许；恢复基线文档/设计/应用/会话', async () => {
  const context = await setup()
  const id = 'cs-cancel'
  const ready = readyCompletedApp(context, id)
  const ids = ready.ids
  const baseText = context.doc.ensureRequirementDoc(id).doc.contentMd
  const baseDesignVersion = ready.designVersion
  const beforeCompletedAt = appRow(context, id).completed_at

  const { changeSet } = context.changes.startChangeSet(id, { title: '取消测试', scope: 'requirements' })

  // 只改了草稿（未确认）→ 不允许取消
  context.doc.saveDocSection(id, 'problem', { markdown: '改了一半' })
  assert.throws(() => context.changes.cancelChangeSet(id, changeSet.id), /还没有已确认/)

  // 确认需求后允许取消
  context.doc.saveDocSection(id, 'epics', {
    data: {
      scenes: [],
      epics: [{ id: ids.epicId, title: '客户管理', goal: '维护客户信息', priority: 'P0' }],
      stories: [
        { id: ids.story1, epicId: ids.epicId, title: '创建客户（改）', description: '创建客户', acceptance: STORY_ACCEPTANCE, priority: 'P0' },
        { id: ids.story2, epicId: ids.epicId, title: '查询客户', description: '查询客户', acceptance: ['能按名称筛选'], priority: 'P1' }
      ]
    }
  })
  context.doc.confirmRequirementDoc(id)
  const editedVersion = context.doc.ensureRequirementDoc(id).doc.version
  assert.notEqual(editedVersion, ready.docVersion)

  const cancelled = context.changes.cancelChangeSet(id, changeSet.id)
  assert.equal(cancelled.changeSet.status, 'cancelled')
  assert.equal(cancelled.restored.appStatus, 'completed')
  assert.equal(cancelled.restored.sessionRestored, false)

  // 需求恢复基线内容，并追加新版本（不物理删除变更中的版本）
  const restored = context.doc.ensureRequirementDoc(id)
  assert.equal(restored.doc.status, 'confirmed')
  assert.equal(restored.doc.contentMd, baseText)
  assert.ok(restored.doc.version > editedVersion)
  const versions = context.doc.listDocVersions(id).map(item => item.version)
  assert.ok(versions.includes(editedVersion), '变更中产生的版本应保留在历史')

  // 设计恢复基线并保持 confirmed
  const design = context.design.getDesign(id)
  assert.equal(design.status, 'confirmed')
  assert.ok(design.version > baseDesignVersion)

  // 应用回到基线状态/完成时间/上一变更单
  const app = appRow(context, id)
  assert.equal(app.status, 'completed')
  assert.equal(app.completed_at, beforeCompletedAt)
  const baseChangeSetId = (
    context.db.prepare('SELECT base_change_set_id FROM app_change_sets WHERE app_id = ? AND id = ?').get(id, changeSet.id) as {
      base_change_set_id: string | null
    }
  ).base_change_set_id
  assert.equal(app.current_change_set_id, baseChangeSetId)

  assert.throws(() => context.changes.cancelChangeSet(id, changeSet.id), /已取消/)
  // 取消后没有 active 变更单：交接包生成被拒绝（ensureChangeSet 不复用 cancelled）
  assert.throws(() => context.handoff.generateDesignHandoff(id), /请先在应用头部“发起变更”/)
})

test('取消：变更单已生成交接包时拒绝', async () => {
  const context = await setup()
  const id = 'cs-cancel-blocked'
  readyCompletedApp(context, id)
  const { changeSet } = context.changes.startChangeSet(id, { title: '已生成交接包', scope: 'design' })
  const now = new Date().toISOString()
  context.db
    .prepare(
      `INSERT INTO design_handoffs
        (app_id, version, hash, docs_dir, files_json, change_set_id, baseline_handoff_version,
         source_design_json, source_requirements_json, manifest_json, created_at)
       VALUES (?, 2, 'h', 'docs/handoff', '[]', ?, 1, '{}', '{}', '{}', ?)`
    )
    .run(id, changeSet.id, now)
  assert.throws(() => context.changes.cancelChangeSet(id, changeSet.id), /已生成交接包/)
})

test('确认完成只关闭当前变更单，历史单不受影响', async () => {
  const context = await setup()
  const id = 'cs-complete'
  readyCompletedApp(context, id)
  const { changeSet } = context.changes.startChangeSet(id, { title: '仅关闭当前', scope: 'design' })

  // 模拟历史遗留：另一条未完成的旧变更单（C1 之前的数据；seq 更小，不是当前 active）
  const now = new Date().toISOString()
  context.db
    .prepare(
      `INSERT INTO app_change_sets (id, app_id, seq, title, description, scope, status, created_at, updated_at)
       VALUES ('cs-legacy-open', ?, 0, '旧遗留单', '', 'design', 'design', ?, ?)`
    )
    .run(id, now, now)

  context.handoff.completeActiveChangeSet(id)
  const completed = context.query.changeSetRowById(id, changeSet.id)
  assert.equal(completed?.status, 'completed')
  const legacy = context.query.changeSetRowById(id, 'cs-legacy-open')
  assert.equal(legacy?.status, 'design', '旧遗留单不应被批量关闭')
  // 只关闭当前 active 单：遗留未完成单仍是“未关闭”，不会被本次完成顺手改状态
  assert.equal(context.changes.activeChangeSetView(id)?.id, 'cs-legacy-open')
})

test('服务端 canCancel：发起后无差异→不可取消；确认需求后可取消；生成交接包后不可取消', async () => {
  const context = await setup()
  const id = 'cs-cancelable'
  const ready = readyCompletedApp(context, id)

  const started = context.changes.startChangeSet(id, { title: '取消门禁', scope: 'requirements' }).changeSet
  assert.equal(started.canCancel, false)
  assert.match(started.cancelBlockedReason ?? '', /已确认的需求\/设计差异/)

  // 改一半（draft）仍不可取消
  context.doc.saveDocSection(id, 'problem', { markdown: '改了一半' })
  const listedDraft = context.changes.listChangeSets(id)
  assert.equal(listedDraft.active?.canCancel, false)

  context.doc.confirmRequirementDoc(id)
  const listedConfirmed = context.changes.listChangeSets(id)
  assert.equal(listedConfirmed.active?.canCancel, true)
  assert.equal(listedConfirmed.active?.cancelBlockedReason, null)
  assert.equal(context.changes.activeChangeSetView(id)?.canCancel, true)

  // 生成交接包后不可取消（同单）
  context.design.syncDesignInput(id, 'additions')
  context.design.confirmDesign(id)
  context.handoff.generateDesignHandoff(id)
  const afterHandoff = context.changes.activeChangeSetView(id)
  assert.equal(afterHandoff?.canCancel, false)
  assert.match(afterHandoff?.cancelBlockedReason ?? '', /已生成交接包/)
  void ready
})

test('取消恢复原型模板：变更中切换模板 → 取消回到基线模板', async () => {
  const context = await setup()
  const id = 'cs-cancel-template'
  readyCompletedApp(context, id)
  const baseTemplate = context.design.getDesign(id).template.id
  const { changeSet } = context.changes.startChangeSet(id, { title: '换模板后取消', scope: 'design' })

  context.design.switchProtoTemplate(id, 'builtin-prototype-minimal')
  context.design.confirmDesign(id)
  assert.equal(context.design.getDesign(id).template.id, 'builtin-prototype-minimal')

  const result = context.changes.cancelChangeSet(id, changeSet.id)
  assert.equal(result.restored.templateId, baseTemplate)
  const after = context.design.getDesign(id)
  assert.equal(after.template.id, baseTemplate, '取消后原型模板应回到基线')
  assert.equal(after.status, 'confirmed')
})

test('scope 升级：仅设计 → 需求+设计；非 design / 已生成交接包拒绝', async () => {
  const context = await setup()
  const id = 'cs-scope-upgrade'
  readyCompletedApp(context, id)
  const { changeSet } = context.changes.startChangeSet(id, { title: '先只改设计', scope: 'design' })
  assert.throws(() => context.changes.upgradeChangeSetScope(id, changeSet.id, 'design'), /只支持升级为 requirements/)

  const upgraded = context.changes.upgradeChangeSetScope(id, changeSet.id, 'requirements')
  assert.equal(upgraded.changeSet.scope, 'requirements')
  assert.equal(upgraded.changeSet.status, 'requirements')
  const app = appRow(context, id)
  assert.equal(app.status, 'requirements')
  assert.equal(app.requirements_confirmed_at, null)
  assert.equal(context.doc.ensureRequirementDoc(id).doc.status, 'draft')
  assert.equal(context.design.designSummary(id)?.status, 'draft')

  // 已经是 requirements：再次升级被拒绝
  assert.throws(() => context.changes.upgradeChangeSetScope(id, changeSet.id, 'requirements'), /只有“仅设计”变更/)

  // 非 design（用户一开始选需求+设计）
  const id2 = 'cs-scope-requirements'
  readyCompletedApp(context, id2)
  const second = context.changes.startChangeSet(id2, { title: '需求变更', scope: 'requirements' }).changeSet
  assert.throws(() => context.changes.upgradeChangeSetScope(id2, second.id, 'requirements'), /只有“仅设计”变更/)

  // 已生成交接包：拒绝
  const id3 = 'cs-scope-handoff'
  readyCompletedApp(context, id3)
  const third = context.changes.startChangeSet(id3, { title: '已生成交接包', scope: 'design' }).changeSet
  const now = new Date().toISOString()
  context.db
    .prepare(
      `INSERT INTO design_handoffs
        (app_id, version, hash, docs_dir, files_json, change_set_id, baseline_handoff_version,
         source_design_json, source_requirements_json, manifest_json, created_at)
       VALUES (?, 2, 'h', 'docs/handoff', '[]', ?, 1, '{}', '{}', '{}', ?)`
    )
    .run(id3, third.id, now)
  assert.throws(() => context.changes.upgradeChangeSetScope(id3, third.id, 'requirements'), /已生成交接包/)
})

test('完成后继续发消息：应用回 development，变更单保持 completed；可发起新变更、旧单不可再用', async () => {
  const context = await setup()
  const dev = await import('../dev/service')
  const id = 'cs-resume'
  readyCompletedApp(context, id)

  dev.resumeCompletedApp(id)
  const app = appRow(context, id)
  assert.equal(app.status, 'development')
  assert.equal(app.completed_at, null)
  const history = context.changes.listChangeSets(id)
  assert.equal(history.active, null)
  assert.equal(history.changeSets[0]?.seq, 1)
  assert.equal(history.changeSets[0]?.status, 'completed', '纯开发修复不应重新打开变更单')

  // 没有 active 变更单：交接包生成继续被拒绝（纯修复不需要新交接包）
  assert.throws(() => context.handoff.generateDesignHandoff(id), /请先在应用头部“发起变更”/)

  // 需要改需求/设计时可以正常发起新变更
  const started = context.changes.startChangeSet(id, { title: '修复后发起变更', scope: 'design' })
  assert.equal(started.changeSet.seq, 2)
  assert.equal(started.changeSet.status, 'design')
})
