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
  service: typeof import('./service')
  templates: typeof import('./templates')
}

let setupPromise: Promise<Setup> | null = null

async function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-design-'))
    const projects = path.join(root, 'projects')
    fs.mkdirSync(path.join(projects, 'design-app'), { recursive: true })
    process.env.RG_DATA_DIR = path.join(root, 'data')
    process.env.RG_PROJECTS_DIR = projects
    const dbModule = await import('../db')
    const doc = await import('../requirements/doc')
    const service = await import('./service')
    const templates = await import('./templates')
    const now = new Date().toISOString()
    dbModule.db.prepare(`
      INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
      VALUES ('design-app', '设计测试应用', '测试', 'design-app', 8081, 'requirements', ?, ?)
    `).run(now, now)
    return { root, projects, db: dbModule.db, doc, service, templates }
  })()
  return setupPromise
}

after(async () => {
  if (!setupPromise) return
  const { root, db } = await setupPromise
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

/** 每个用例：重置设计数据；需求文档保持已确认，应用回到 design */
async function freshDesign(): Promise<Setup> {
  const context = await setup()
  context.db.prepare('DELETE FROM app_design_pages').run()
  context.db.prepare('DELETE FROM app_design_page_sets').run()
  context.db.prepare('DELETE FROM app_design_entities').run()
  context.db.prepare('DELETE FROM app_design_versions').run()
  context.db.prepare('DELETE FROM app_design_projects').run()
  context.db.prepare("DELETE FROM app_change_sets WHERE app_id = 'design-app'").run()
  context.db.prepare("DELETE FROM app_settings WHERE key = 'app.design-app.designChat'").run()
  // #7：切换原型模板会同步应用默认模板；重置以免影响后续用例的项目初始化
  context.db
    .prepare('UPDATE apps SET requirement_template_id = NULL, prototype_template_id = NULL WHERE id = ?')
    .run('design-app')
  return context
}

async function confirmedRequirement(): Promise<Setup> {
  const context = await setup()
  const existing = context.db.prepare('SELECT status FROM apps WHERE id = ?').get('design-app') as { status: string }
  if (existing.status === 'design') return context
  const payload = context.doc.ensureRequirementDoc('design-app')
  for (const section of payload.sections) {
    if (!section.required) continue
    context.doc.saveDocSection('design-app', section.sectionKey, {
      markdown: section.sectionKey === 'epics' ? '- 作为运营，我希望维护订单，以便跟踪状态。' : `内容-${section.title}`
    })
  }
  context.doc.confirmRequirementDoc('design-app')
  return context
}

/** 结构化需求：Scene + 2 Epics + 3 Stories（H1/H2 用例共用） */
async function structuredRequirement(): Promise<Setup> {
  const context = await setup()
  try {
    context.doc.reopenRequirementDoc('design-app')
  } catch {
    // 可能还没确认
  }
  context.doc.saveDocSection('design-app', 'scenes', {
    data: {
      scenes: [{ title: '订单管理', description: '销售维护订单并跟踪状态' }],
      epics: [],
      stories: []
    }
  })
  context.doc.saveDocSection('design-app', 'epics', {
    data: {
      scenes: [],
      epics: [
        { id: 'EPIC-001', title: '订单创建', goal: '支持业务员创建订单', priority: 'P0' },
        { id: 'EPIC-002', title: '订单查询', goal: '支持按条件查询订单', priority: 'P1' }
      ],
      stories: [
        {
          id: 'STORY-001',
          epicId: 'EPIC-001',
          title: '创建订单',
          description: '作为业务员，我希望创建订单',
          acceptance: ['必填字段校验'],
          priority: 'P0'
        },
        {
          id: 'STORY-002',
          epicId: 'EPIC-001',
          title: '编辑订单',
          description: '作为业务员，我希望修改订单',
          acceptance: ['保存后列表可见'],
          priority: 'P1'
        },
        {
          id: 'STORY-003',
          epicId: 'EPIC-002',
          title: '查询订单',
          description: '作为主管，我希望按客户查询订单',
          acceptance: ['能按客户筛选'],
          priority: 'P1'
        }
      ]
    }
  })
  for (const section of context.doc.ensureRequirementDoc('design-app').sections) {
    if (!section.required || section.markdown.trim()) continue
    context.doc.saveDocSection('design-app', section.sectionKey, { markdown: `内容-${section.title}` })
  }
  context.doc.saveDocSection('design-app', 'users', {
    markdown: '- 业务员：创建和维护订单\n- 主管：查询全部订单'
  })
  context.doc.confirmRequirementDoc('design-app')
  return context
}

function entityInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: '订单',
    tableName: 'biz_order',
    description: '订单主表',
    fields: [
      { name: 'orderNo', label: '订单号', type: 'string', required: true, unique: true, length: 32 },
      { name: 'amount', label: '金额', type: 'decimal', precision: 2 },
      { name: 'status', label: '状态', type: 'enum', options: ['草稿', '已提交', '已完成'] },
      { name: 'orderDate', label: '下单日期', type: 'date' }
    ],
    relations: [],
    ...overrides
  }
}

test('内置原型模板 seed：企业级为默认，内置只读，复制后可编辑/删除', async () => {
  const { templates } = await setup()
  const list = templates.listPrototypeTemplates()
  assert.equal(list.length, 2)
  const enterprise = list.find(item => item.id === 'builtin-prototype-enterprise')
  assert.ok(enterprise)
  assert.equal(enterprise?.builtin, true)
  assert.equal(enterprise?.shell.sidebarDark, true)
  assert.deepEqual(enterprise?.pageSetRules.defaultPages, ['list', 'form', 'detail'])
  assert.equal(templates.defaultPrototypeTemplate().id, 'builtin-prototype-enterprise')
  assert.throws(() => templates.updatePrototypeTemplate('builtin-prototype-enterprise', { name: 'x' }), /只读/)
  const copy = templates.duplicatePrototypeTemplate('builtin-prototype-minimal')
  assert.equal(copy.builtin, false)
  assert.match(copy.name, /副本/)
  const updated = templates.updatePrototypeTemplate(copy.id, { ...copy, name: '我的简洁模板' })
  assert.equal(updated.name, '我的简洁模板')
  templates.deletePrototypeTemplate(copy.id)
  assert.throws(() => templates.getPrototypeTemplateOrThrow(copy.id), /不存在/)
})

test('设计项目初始化：默认模板 + 需求文档版本 + v1 快照', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  const project = context.service.getDesign('design-app')
  assert.equal(project.appName, '设计测试应用')
  assert.equal(project.template.id, 'builtin-prototype-enterprise')
  assert.equal(project.status, 'draft')
  assert.equal(project.version, 1)
  assert.equal(project.requirement?.confirmed, true)
  assert.ok((project.requirement?.contentMd ?? '').includes('Epics'))
  assert.equal(project.readiness.ok, false)
  assert.ok(project.readiness.issues.some(issue => /实体/.test(issue)))
  assert.equal(context.service.listDesignVersions('design-app').length, 1)
})

test('保存实体：名称→id 引用归一化、校验；自动保存不产版本（R2c）', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  const before = context.service.getDesign('design-app')
  let project = context.service.saveEntities('design-app', [
    entityInput(),
    entityInput({
      name: '订单明细',
      tableName: 'biz_order_item',
      fields: [
        { name: 'id', label: '主键ID', type: 'string', required: true, unique: true },
        { name: 'orderId', label: '订单', type: 'ref', ref: '订单' },
        { name: 'productName', label: '商品', type: 'string' }
      ],
      relations: [{ name: '所属订单', type: 'many-to-one', target: '订单' }]
    })
  ])
  assert.equal(project.entities.length, 2)
  const order = project.entities.find(item => item.name === '订单')
  const item = project.entities.find(item => item.name === '订单明细')
  assert.ok(order && item)
  assert.equal(item?.fields.find(field => field.name === 'orderId')?.ref, order?.id)
  assert.equal(item?.relations[0].target, order?.id)
  // 自动保存：版本不变、内容更新、updated_at 变化
  assert.equal(project.version, before.version)
  assert.ok(project.updatedAt >= before.updatedAt)
  assert.equal(context.service.listDesignVersions('design-app').length, 1)

  // 单个实体确认也是中间状态：不产版本
  const confirmed = context.service.saveEntities(
    'design-app',
    project.entities.map(entity => ({ ...entity, status: 'confirmed' }))
  )
  assert.equal(confirmed.version, before.version)
  assert.equal(context.service.listDesignVersions('design-app').length, 1)

  // 显式 snapshot:true（AI 生成/应用）才产版本
  const snapshotted = context.service.saveEntities(
    'design-app',
    project.entities,
    'ai',
    { snapshot: true }
  )
  assert.equal(snapshotted.version, before.version + 1)
  const versions = context.service.listDesignVersions('design-app')
  assert.equal(versions.length, 2)
  assert.equal(versions[0].source, 'ai')

  let issues: unknown[] = []
  try {
    context.service.saveEntities('design-app', [entityInput({ fields: [] })])
  } catch (error) {
    issues = (error as { issues?: unknown[] }).issues ?? []
  }
  assert.ok(issues.some(issue => /至少需要 1 个字段/.test(String(issue))))

  issues = []
  try {
    context.service.saveEntities('design-app', [
      entityInput({ fields: [{ name: 'name', label: '名称', type: 'string' }] })
    ])
  } catch (error) {
    issues = (error as { issues?: unknown[] }).issues ?? []
  }
  assert.ok(issues.some(issue => /缺少主键/.test(String(issue))))
})

test('页面集生成：按模板规则生成列表/创建/详情并绑定实体', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  context.service.saveEntities('design-app', [entityInput()])
  const project = context.service.generateDefaultPageSets('design-app')
  assert.equal(project.pageSets.length, 1)
  const set = project.pageSets[0]
  assert.equal(set.title, '订单管理')
  assert.equal(set.sceneKey.startsWith('scene:'), true)
  assert.deepEqual(set.pages.map(page => page.type), ['list', 'form', 'form', 'detail'])
  assert.deepEqual(
    set.pages.filter(page => page.type === 'form').map(page => page.spec.mode),
    ['create', 'edit']
  )
  assert.ok(set.pages.every(page => page.entityId))
  assert.deepEqual(set.entityIds, [project.entities[0].id])
  const list = set.pages.find(page => page.type === 'list')
  assert.deepEqual(list?.spec.columns?.slice(0, 2), ['orderNo', 'amount'])
  assert.equal(list?.spec.searchFields?.length, 3)
  const versions = context.service.listDesignVersions('design-app')
  assert.equal(versions.length, 2)
  assert.equal(versions[0].source, 'manual')
  assert.equal(versions[0].pageSetCount, 1)
})

test('readiness 警告：页面缺原型截图不阻塞确认，截图后提示消失（#5）', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  context.service.saveEntities('design-app', [entityInput()])
  context.service.generateDefaultPageSets('design-app')
  const before = context.service.getDesign('design-app').readiness
  assert.equal(before.pageCount, 4)
  assert.ok(before.warnings.some(warning => /还有 4 个页面没有原型截图/.test(warning)))
  assert.ok(!before.issues.some(issue => /没有原型截图/.test(issue)))

  const base64 = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString('base64')}`
  const pages = context.service.getDesign('design-app').pageSets.flatMap(set => set.pages)
  context.service.savePageSnapshot('design-app', pages[0].id, { imageBase64: base64 })
  const partial = context.service.getDesign('design-app').readiness
  assert.ok(partial.warnings.some(warning => /还有 3 个页面没有原型截图/.test(warning)))
  for (const page of pages.slice(1)) context.service.savePageSnapshot('design-app', page.id, { imageBase64: base64 })
  const after = context.service.getDesign('design-app').readiness
  assert.ok(!after.warnings.some(warning => /没有原型截图/.test(warning)))
})

test('确认设计：实体/页面集未确认时阻塞；确认后记录状态但不切换开发阶段', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  context.service.saveEntities('design-app', [entityInput()])
  context.service.generateDefaultPageSets('design-app')
  let issues: unknown[] = []
  try {
    context.service.confirmDesign('design-app')
  } catch (error) {
    issues = (error as { issues?: unknown[] }).issues ?? []
  }
  assert.ok(issues.some(issue => /未确认/.test(String(issue))))

  const project = context.service.getDesign('design-app')
  const entities = project.entities.map(entity => ({ ...entity, status: 'confirmed' }))
  context.service.saveEntities('design-app', entities)
  const pageSets = context.service.getDesign('design-app').pageSets.map(set => ({ ...set, status: 'confirmed' }))
  context.service.savePageSets('design-app', pageSets)
  const beforeConfirm = context.service.getDesign('design-app')
  const confirmed = context.service.confirmDesign('design-app')
  assert.equal(confirmed.project.status, 'confirmed')
  assert.ok(confirmed.project.confirmedAt)
  // R2c：确认设计总是 +1 并产 confirm 快照（即使内容未变）
  assert.equal(confirmed.project.version, beforeConfirm.version + 1)
  const versions = context.service.listDesignVersions('design-app')
  assert.equal(versions[0].version, confirmed.project.version)
  assert.equal(versions[0].source, 'confirm')
  const detail = context.service.getDesignVersion('design-app', confirmed.project.version)
  assert.equal(detail.entities.length, 1)
  assert.equal(detail.pageSets.length, 1)
  // 重复确认幂等：不再产版本
  const again = context.service.confirmDesign('design-app')
  assert.equal(again.alreadyConfirmed, true)
  assert.equal(again.project.version, confirmed.project.version)
  assert.equal(context.service.listDesignVersions('design-app').length, versions.length)
  const app = context.db.prepare('SELECT status FROM apps WHERE id = ?').get('design-app') as { status: string }
  assert.equal(app.status, 'design')
})

test('页面规格对象数组归一化：AI 常见的 [{name}] 列/动作转字符串', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  context.service.saveEntities('design-app', [entityInput()])
  const project = context.service.generateDefaultPageSets('design-app')
  const page = project.pageSets[0].pages[0]
  const saved = context.service.savePage(context.service.getDesign('design-app').appId, page.id, {
    spec: {
      actions: [{ name: 'create' }, { label: '编辑', name: 'edit' }, { label: '查看详情' }],
      columns: [{ name: 'orderNo' }, { field: 'amount' }, { label: '状态' }],
      searchFields: [{ fieldName: 'orderNo' }]
    },
    layout: {
      table: {
        columns: [{ name: 'orderNo' }, { value: 'status' }],
        searchFields: [{ name: 'orderNo' }]
      }
    }
  })
  const normalized = saved.pageSets[0].pages[0]
  assert.deepEqual(normalized.spec.actions, ['create', 'edit', 'detail'])
  assert.deepEqual(normalized.spec.columns, ['orderNo', 'amount', '状态'])
  assert.deepEqual(normalized.spec.searchFields, ['orderNo'])
  assert.deepEqual(normalized.layout.table?.columns, ['orderNo', 'status'])
})

test('PNG 快照：写应用目录、记录 hash/路径，可读取', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  context.service.saveEntities('design-app', [entityInput()])
  const project = context.service.generateDefaultPageSets('design-app')
  const page = project.pageSets[0].pages[0]
  const base64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]).toString('base64')
  let badMessage = ''
  try {
    context.service.savePageSnapshot('design-app', page.id, {
      imageBase64: Buffer.from('not-a-png').toString('base64')
    })
  } catch (error) {
    badMessage = error instanceof Error ? error.message : String(error)
  }
  assert.match(badMessage, /PNG/)
  const saved = context.service.savePageSnapshot('design-app', page.id, {
    imageBase64: `data:image/png;base64,${base64}`,
    html: '<div>prototype</div>'
  })
  assert.ok(saved.page.imagePath?.startsWith('docs/design/prototypes/'))
  assert.ok(saved.page.htmlPath?.endsWith('.html'))
  assert.ok(saved.page.imageHash)
  const image = context.service.pageImageFile('design-app', page.id)
  assert.ok(fs.existsSync(image.abs))
  assert.ok(image.abs.startsWith(path.join(context.projects, 'design-app')))
  const html = context.service.pageHtmlFile('design-app', page.id)
  assert.equal(fs.readFileSync(html.abs, 'utf8'), '<div>prototype</div>')
})

test('版本回滚与模板切换：保留 page id，生成 rollback/template-change 版本', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  // 显式留档实体（自动保存不产版本）
  const first = context.service.saveEntities('design-app', [entityInput()], 'manual', { snapshot: true })
  const id = first.entities[0].id
  const v2 = first.version
  assert.equal(v2, 2)
  const edited = context.service.saveEntities('design-app', [entityInput({ id, name: '订单（改）' })])
  assert.equal(edited.version, v2)
  const rolled = context.service.rollbackDesignVersion('design-app', v2)
  assert.equal(rolled.entities[0].name, '订单')
  assert.equal(rolled.version, v2 + 1)
  assert.equal(context.service.listDesignVersions('design-app')[0].source, 'rollback')

  const beforePages = context.service.generateDefaultPageSets('design-app')
  const pageId = beforePages.pageSets[0].pages[0].id
  const versionBeforeTemplate = beforePages.version
  const switched = context.service.switchProtoTemplate('design-app', 'builtin-prototype-minimal')
  assert.equal(switched.template.id, 'builtin-prototype-minimal')
  assert.equal(switched.pageSets[0].pages[0].id, pageId)
  assert.equal(switched.status, 'draft')
  assert.equal(switched.version, versionBeforeTemplate + 1)
  const versions = context.service.listDesignVersions('design-app')
  assert.equal(versions[0].source, 'template-change')
})

test('设计对话持久化', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  context.service.saveDesignChat('design-app', { messages: [{ role: 'user', content: '你好' }] })
  const chat = context.service.readDesignChat('design-app') as { messages: Array<{ content: string }> }
  assert.equal(chat.messages[0].content, '你好')
})

test('页面集按需求文档场景/Epic 派生，创建/编辑表单分开', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  context.db
    .prepare("UPDATE app_requirement_doc_sections SET markdown = ? WHERE app_id = 'design-app' AND section_key = 'scenes'")
    .run('### 客户管理\n销售维护客户，查看客户下的订单。\n### 订单管理\n销售为客户创建订单，跟踪订单状态。')
  context.db
    .prepare("UPDATE app_requirement_doc_sections SET markdown = ? WHERE app_id = 'design-app' AND section_key = 'epics'")
    .run(
      '### Epic 1：客户管理\n- 作为销售，我希望维护客户。\n### Epic 2：订单管理\n- 作为销售，我希望创建订单。'
    )
  const entities = context.service.saveEntities('design-app', [
    entityInput(),
    entityInput({
      name: '客户',
      tableName: 'biz_customer',
      fields: [
        { name: 'id', label: '主键ID', type: 'string', unique: true },
        { name: 'customerName', label: '客户名称', type: 'string' }
      ]
    })
  ]).entities
  const customer = entities.find(entity => entity.name === '客户')
  assert.ok(customer)
  const project = context.service.generateDefaultPageSets('design-app')
  assert.deepEqual(project.pageSets.map(set => set.title), ['客户管理', '订单管理'])
  assert.deepEqual(project.pageSets.map(set => set.epicId), ['EPIC-001', 'EPIC-002'])
  assert.deepEqual(project.pageSets.map(set => set.sceneKey), ['EPIC-001', 'EPIC-002'])
  for (const set of project.pageSets) {
    assert.deepEqual(set.pages.map(page => page.type), ['list', 'form', 'form', 'detail'])
    assert.deepEqual(
      set.pages.filter(page => page.type === 'form').map(page => page.spec.mode),
      ['create', 'edit']
    )
    assert.deepEqual(new Set(set.pages.flatMap(page => page.requirementRefs)), new Set([set.epicId]))
  }
  const customerSet = project.pageSets.find(set => set.title === '客户管理')
  assert.equal(customerSet?.pages[0].entityId, customer?.id)
})

test('设计确认后只读：保存被拒绝；重新编辑后恢复可写', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  context.service.saveEntities('design-app', [entityInput()])
  let project = context.service.generateDefaultPageSets('design-app')
  const entities = project.entities.map(entity => ({ ...entity, status: 'confirmed' }))
  context.service.saveEntities('design-app', entities)
  project = context.service.getDesign('design-app')
  context.service.savePageSets(
    'design-app',
    project.pageSets.map(set => ({ ...set, status: 'confirmed' }))
  )
  context.service.confirmDesign('design-app')

  let blocked = ''
  try {
    context.service.saveEntities('design-app', context.service.getDesign('design-app').entities)
  } catch (error) {
    blocked = error instanceof Error ? error.message : String(error)
  }
  assert.match(blocked, /只读|重新编辑/)
  const reopened = context.service.reopenDesign('design-app')
  assert.equal(reopened.status, 'draft')
  assert.equal(reopened.confirmedAt, null)
  const versionCountBeforeSave = context.service.listDesignVersions('design-app').length
  const saved = context.service.saveEntities('design-app', reopened.entities)
  assert.equal(saved.status, 'draft')
  // 自动保存不产版本；重新确认时才 +1（R2c）
  assert.equal(saved.version, reopened.version)
  assert.equal(context.service.listDesignVersions('design-app').length, versionCountBeforeSave)
})

test('设计输入：已确认结构化需求生成 bundle（稳定 ID/hash）并绑定设计项目', async () => {
  const context = await freshDesign()
  await structuredRequirement()
  const project = context.service.getDesign('design-app')
  assert.ok(project.input)
  assert.equal(project.input.structure, 'prd')
  assert.equal(project.input.docVersion, project.requirement?.version)
  assert.equal(project.input.scenes.length, 1)
  assert.equal(project.input.scenes[0].id, 'SCENE-001')
  assert.equal(project.input.epics.length, 2)
  assert.equal(project.input.stories.length, 3)
  assert.deepEqual(project.input.epics[0].stories.map(story => story.id), ['STORY-001', 'STORY-002'])
  assert.equal(project.input.docHash.length, 64)
  assert.equal(project.sourceInputId, project.input.id)
  assert.equal(project.inputSummary?.id, project.input.id)
  assert.equal(project.stale.stale, false)
  assert.equal(project.input.roles.length >= 1, true)
})

test('实体/页面 requirementRefs 落库，覆盖度按 Story 汇总并给非阻塞警告', async () => {
  const context = await freshDesign()
  await structuredRequirement()
  let project = context.service.saveEntities('design-app', [
    entityInput({ requirementRefs: ['STORY-001', 'STORY-002'], sourceSections: ['epics', 'rules'] }),
    entityInput({ name: '客户', tableName: 'biz_customer', requirementRefs: [] })
  ])
  const order = project.entities.find(entity => entity.name === '订单')
  assert.deepEqual(order?.requirementRefs, ['STORY-001', 'STORY-002'])
  assert.deepEqual(order?.sourceSections, ['epics', 'rules'])

  project = context.service.generateDefaultPageSets('design-app')
  assert.deepEqual(project.pageSets.map(set => set.epicId), ['EPIC-001', 'EPIC-002'])
  assert.deepEqual(project.pageSets[0].storyIds, ['STORY-001', 'STORY-002'])
  assert.deepEqual(project.pageSets[1].storyIds, ['STORY-003'])
  for (const set of project.pageSets) {
    for (const page of set.pages) assert.deepEqual(page.requirementRefs, set.storyIds)
  }
  // 重新读取仍保留引用
  const reread = context.db
    .prepare("SELECT requirement_refs_json FROM app_design_entities WHERE app_id = 'design-app' AND name = '订单'")
    .get() as { requirement_refs_json: string }
  assert.deepEqual(JSON.parse(reread.requirement_refs_json), ['STORY-001', 'STORY-002'])

  const coverage = context.service.getDesign('design-app').coverage
  assert.equal(coverage.stats.storyCount, 3)
  assert.equal(coverage.stats.coveredStoryCount, 3)
  assert.ok(coverage.unlinkedEntities.some(item => item.name === '客户'))
  assert.ok(coverage.warnings.some(warning => /客户.*没有需求依据/.test(warning)))
})

test('requirementRefs 校验：不存在的引用给 warning，不静默丢弃', async () => {
  const context = await freshDesign()
  await structuredRequirement()
  const project = context.service.saveEntities('design-app', [
    entityInput({ requirementRefs: ['STORY-001', 'STORY-999'] })
  ])
  assert.deepEqual(project.entities[0].requirementRefs, ['STORY-001', 'STORY-999'])
  assert.ok(project.warnings.some(warning => /STORY-999/.test(warning)))
  assert.equal(context.service.getDesign('design-app').readiness.ok, false)
})

test('需求变更：stale + diff + preview 不覆盖设计；additions 绑定输入', async () => {
  const context = await freshDesign()
  await structuredRequirement()
  context.service.saveEntities('design-app', [entityInput({ requirementRefs: ['STORY-001'] })])
  context.service.generateDefaultPageSets('design-app')
  const before = context.service.getDesign('design-app')
  assert.equal(before.stale.stale, false)

  // 重新编辑需求：改名 + 新增 Story
  context.doc.reopenRequirementDoc('design-app')
  const epicsSection = context.doc.ensureRequirementDoc('design-app').sections.find(section => section.sectionKey === 'epics')
  const data = JSON.parse(JSON.stringify(epicsSection?.data ?? { scenes: [], epics: [], stories: [] })) as {
    epics: Array<{ id: string; title: string }>
    stories: Array<{ id: string; title: string; epicId: string | null; description: string; acceptance: string[] }>
  }
  data.stories[0].title = '创建订单（改）'
  data.stories.push({
    id: '',
    title: '取消订单',
    epicId: 'EPIC-001',
    description: '作为主管，我希望取消订单',
    acceptance: ['取消后状态变更']
  })
  context.doc.saveDocSection('design-app', 'epics', { data })
  for (const section of context.doc.ensureRequirementDoc('design-app').sections) {
    if (!section.required || section.markdown.trim()) continue
    context.doc.saveDocSection('design-app', section.sectionKey, { markdown: `内容-${section.title}` })
  }
  context.doc.confirmRequirementDoc('design-app')

  const stale = context.service.getDesign('design-app')
  assert.equal(stale.stale.stale, true)
  assert.match(stale.stale.reason, /需求文档已更新/)

  const preview = context.service.syncDesignInput('design-app', 'preview')
  assert.equal(preview.mode, 'preview')
  assert.ok(preview.diff.stories.changed.some(item => item.id === 'STORY-001'))
  assert.ok(preview.diff.stories.added.some(item => item.title === '取消订单'))
  assert.ok(preview.affected.entities.some(item => item.name === '订单'))
  // preview 不覆盖设计，仍 stale
  assert.equal(preview.stale.stale, true)
  assert.equal(preview.project.stale.stale, true)

  const applied = context.service.syncDesignInput('design-app', 'additions')
  assert.equal(applied.stale.stale, false)
  assert.equal(applied.project.sourceInputId, applied.input.id)
  assert.equal(applied.project.entities.find(entity => entity.name === '订单')?.requirementRefs.join(','), 'STORY-001')
})

test('需求 reopen 后已确认设计退回 draft；stale 时 confirmDesign 拒绝并提示同步', async () => {
  const context = await freshDesign()
  await structuredRequirement()
  context.service.saveEntities('design-app', [entityInput({ requirementRefs: ['STORY-001'] })])
  let project = context.service.generateDefaultPageSets('design-app')
  context.service.saveEntities('design-app', project.entities.map(entity => ({ ...entity, status: 'confirmed' })))
  project = context.service.getDesign('design-app')
  context.service.savePageSets('design-app', project.pageSets.map(set => ({ ...set, status: 'confirmed' })))
  assert.equal(context.service.confirmDesign('design-app').project.status, 'confirmed')

  // 需求 reopen：已确认设计必须退回 draft，清 confirmed_at
  context.doc.reopenRequirementDoc('design-app')
  const reopenedDesign = context.service.getDesign('design-app')
  assert.equal(reopenedDesign.status, 'draft')
  assert.equal(reopenedDesign.confirmedAt, null)
  assert.equal(reopenedDesign.stale.stale, false) // 仅 reopen、未改内容：输入 hash 未变

  // 修改并重新确认需求
  const epicsSection = context.doc.ensureRequirementDoc('design-app').sections.find(section => section.sectionKey === 'epics')
  const data = JSON.parse(JSON.stringify(epicsSection?.data ?? { scenes: [], epics: [], stories: [] })) as {
    epics: Array<Record<string, unknown>>
    stories: Array<Record<string, unknown> & { id: string }>
  }
  data.stories[0].title = '创建订单（stale 测试）'
  context.doc.saveDocSection('design-app', 'epics', { data })
  for (const section of context.doc.ensureRequirementDoc('design-app').sections) {
    if (!section.required || section.markdown.trim()) continue
    context.doc.saveDocSection('design-app', section.sectionKey, { markdown: `内容-${section.title}` })
  }
  context.doc.confirmRequirementDoc('design-app')

  const staleProject = context.service.getDesign('design-app')
  assert.equal(staleProject.stale.stale, true)
  assert.equal(staleProject.readiness.ok, false)
  assert.ok(staleProject.readiness.issues.some(issue => /同步设计输入/.test(issue)))

  // 即便被手工标记 confirmed，也不能当作已确认设计返回
  context.db.prepare("UPDATE app_design_projects SET status = 'confirmed', confirmed_at = ? WHERE app_id = 'design-app'").run(new Date().toISOString())
  let blocked = ''
  let already = false
  try {
    already = context.service.confirmDesign('design-app').alreadyConfirmed
  } catch (error) {
    blocked = error instanceof Error ? error.message : String(error)
  }
  assert.match(blocked, /同步设计输入/)
  assert.equal(already, false)

  // 同步后 stale 消失，可再次确认（实体/页面集确认状态保留）
  context.service.syncDesignInput('design-app', 'additions')
  const confirmed = context.service.confirmDesign('design-app')
  assert.equal(confirmed.alreadyConfirmed, false)
  assert.equal(confirmed.project.status, 'confirmed')
  assert.equal(confirmed.project.stale.stale, false)
})

test('需求变更 regenerate：清理失效引用并把受影响实体/页面置为草稿', async () => {
  const context = await freshDesign()
  await structuredRequirement()
  context.service.saveEntities('design-app', [entityInput({ requirementRefs: ['STORY-001', 'STORY-002'] })])
  context.service.generateDefaultPageSets('design-app')

  // 删除 STORY-002（编辑订单）
  context.doc.reopenRequirementDoc('design-app')
  const epicsSection = context.doc.ensureRequirementDoc('design-app').sections.find(section => section.sectionKey === 'epics')
  const data = JSON.parse(JSON.stringify(epicsSection?.data ?? { scenes: [], epics: [], stories: [] })) as {
    epics: Array<Record<string, unknown>>
    stories: Array<Record<string, unknown> & { id: string }>
  }
  data.stories = data.stories.filter(story => story.id !== 'STORY-002')
  context.doc.saveDocSection('design-app', 'epics', { data })
  for (const section of context.doc.ensureRequirementDoc('design-app').sections) {
    if (!section.required || section.markdown.trim()) continue
    context.doc.saveDocSection('design-app', section.sectionKey, { markdown: `内容-${section.title}` })
  }
  context.doc.confirmRequirementDoc('design-app')

  const preview = context.service.syncDesignInput('design-app', 'preview')
  assert.ok(preview.diff.stories.removed.some(item => item.id === 'STORY-002'))

  const result = context.service.syncDesignInput('design-app', 'regenerate')
  assert.equal(result.stale.stale, false)
  const entity = result.project.entities.find(item => item.name === '订单')
  assert.deepEqual(entity?.requirementRefs, ['STORY-001'])
  assert.equal(entity?.status, 'draft')
  const set = result.project.pageSets.find(item => item.epicId === 'EPIC-001')
  assert.deepEqual(set?.storyIds, ['STORY-001'])
  for (const page of set?.pages ?? []) assert.deepEqual(page.requirementRefs, ['STORY-001'])
  assert.ok(result.warnings.some(warning => /草稿/.test(warning)))
})


test('手动保存版本：draft +1/manual，confirmed 409；重复保存正常递增', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  context.service.saveEntities('design-app', [entityInput()])
  let project = context.service.generateDefaultPageSets('design-app')
  const baseVersion = project.version

  const saved = context.service.createDesignVersion('design-app')
  assert.equal(saved.version, baseVersion + 1)
  assert.equal(saved.status, 'draft')
  let versions = context.service.listDesignVersions('design-app')
  assert.equal(versions[0].source, 'manual')
  assert.equal(versions[0].version, saved.version)
  assert.equal(versions[0].entityCount, 1)
  assert.equal(versions[0].pageSetCount, project.pageSets.length)

  // 再点一次也正常递增（不删除、不做幂等）
  const savedAgain = context.service.createDesignVersion('design-app')
  assert.equal(savedAgain.version, saved.version + 1)

  // 确认设计后可确认版本已存在，手动保存拒绝
  project = context.service.getDesign('design-app')
  context.service.saveEntities(
    'design-app',
    project.entities.map(entity => ({ ...entity, status: 'confirmed' }))
  )
  context.service.savePageSets(
    'design-app',
    project.pageSets.map(set => ({ ...set, status: 'confirmed' }))
  )
  const confirmed = context.service.confirmDesign('design-app').project
  let blocked = ''
  try {
    context.service.createDesignVersion('design-app')
  } catch (error) {
    blocked = error instanceof Error ? error.message : String(error)
  }
  assert.match(blocked, /设计已确认/)
  assert.match(blocked, /重新编辑设计/)
  assert.equal(context.service.getDesign('design-app').version, confirmed.version)
})

test('版本来源：sync / restore 且带变更单号', async () => {
  const context = await freshDesign()
  await structuredRequirement()
  context.service.saveEntities('design-app', [entityInput({ requirementRefs: ['STORY-001'] })])
  context.service.generateDefaultPageSets('design-app')

  const now = new Date().toISOString()
  const insertChangeSet = (): void => {
    context.db
      .prepare(`
        INSERT INTO app_change_sets (id, app_id, seq, title, description, scope, status, created_at, updated_at)
        VALUES ('cs-r2c-design', 'design-app', 5, 'R2c 设计变更', '测试', 'design', 'design', ?, ?)
      `)
      .run(now, now)
  }

  // 需求变更 → 同步设计输入（source=sync，带变更单）
  context.doc.reopenRequirementDoc('design-app')
  const epicsSection = context.doc
    .ensureRequirementDoc('design-app')
    .sections.find(section => section.sectionKey === 'epics')
  const data = JSON.parse(JSON.stringify(epicsSection?.data ?? { scenes: [], epics: [], stories: [] })) as {
    stories: Array<Record<string, unknown> & { id: string }>
  }
  data.stories[0].title = '创建订单（R2c）'
  context.doc.saveDocSection('design-app', 'epics', { data })
  for (const section of context.doc.ensureRequirementDoc('design-app').sections) {
    if (!section.required || section.markdown.trim()) continue
    context.doc.saveDocSection('design-app', section.sectionKey, { markdown: `内容-${section.title}` })
  }
  context.doc.confirmRequirementDoc('design-app')

  // 变更单在需求确认后插入：sync/restore 的版本应带变更单号
  insertChangeSet()

  const synced = context.service.syncDesignInput('design-app', 'additions')
  let latest = context.service.listDesignVersions('design-app')[0]
  assert.equal(latest.source, 'sync')
  assert.equal(latest.version, synced.project.version)
  assert.equal(latest.changeSetSeq, 5)
  assert.equal(latest.changeSetTitle, 'R2c 设计变更')
  assert.equal(latest.changeSetId, 'cs-r2c-design')

  // 取消恢复（source=restore，带变更单）
  const restored = context.service.restoreDesignVersionConfirmed('design-app', synced.project.version)
  latest = context.service.listDesignVersions('design-app')[0]
  assert.equal(restored.status, 'confirmed')
  assert.equal(latest.source, 'restore')
  assert.equal(latest.version, restored.version)
  assert.equal(latest.changeSetSeq, 5)
  // 详情也带变更单号
  const detail = context.service.getDesignVersion('design-app', latest.version)
  assert.equal(detail.changeSetSeq, 5)
  assert.equal(detail.changeSetTitle, 'R2c 设计变更')

  // 变更单删除后：change_set_id 仍保留列值，seq/title 为 null（LEFT JOIN）
  context.db.prepare("DELETE FROM app_change_sets WHERE id = 'cs-r2c-design'").run()
  const afterDelete = context.service.listDesignVersions('design-app').find(item => item.version === latest.version)
  assert.equal(afterDelete?.changeSetId, 'cs-r2c-design')
  assert.equal(afterDelete?.changeSetSeq, null)
  assert.equal(afterDelete?.changeSetTitle, null)
})

test('AI 生成/应用与 PNG 快照：AI 显式 snapshot 产 ai 版本，PNG 不产版本', async () => {
  const context = await freshDesign()
  await confirmedRequirement()
  context.service.saveEntities('design-app', [entityInput()], 'ai', { snapshot: true })
  let versions = context.service.listDesignVersions('design-app')
  assert.equal(versions[0].source, 'ai')
  assert.equal(versions.length, 2)

  let project = context.service.generateDefaultPageSets('design-app')
  const page = project.pageSets[0].pages[0]
  const beforePng = project.version
  const versionsBeforePng = context.service.listDesignVersions('design-app').length
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]).toString('base64')
  const saved = context.service.savePageSnapshot('design-app', page.id, {
    imageBase64: `data:image/png;base64,${png}`,
    html: '<div>prototype</div>'
  })
  assert.equal(saved.project.version, beforePng)
  assert.equal(context.service.listDesignVersions('design-app').length, versionsBeforePng)

  // 页面集 AI 应用：显式 snapshot 才产版本
  project = context.service.getDesign('design-app')
  const applied = context.service.savePageSets('design-app', project.pageSets, 'ai', { snapshot: true })
  assert.equal(applied.version, beforePng + 1)
  versions = context.service.listDesignVersions('design-app')
  assert.equal(versions[0].source, 'ai')
  assert.equal(versions[0].version, applied.version)
})
