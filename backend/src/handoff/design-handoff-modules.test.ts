/**
 * #6 M6a：应用级交接包模块化（多模块 00—05/manifest/prototypes/校验/变更 diff）。
 *
 * 覆盖：
 * - 两模块生成：文件齐全、模块标题、全局编号、原型路径 prototypes/<MOD>/<ps>/page、manifest modules/designModules/requirementsBundle/totals；
 * - 门禁：任一模块未确认/缺 PNG/stale → 400 + 模块前缀，不写盘；
 * - 跨模块 FK / 表名重复 / 模板不一致 → warning 不阻塞；
 * - 单模块旧行为回归（design-handoff.test.ts 仍保留）；
 * - Change Set #1 创建；#2 只选 A：05-CHANGES 只含 A、B“未变更”，manifest 模块版本映射；
 * - 读/预览/摘要带 modules；规模按全部模块汇总；删除应用清理交接包。
 *
 * 临时 RG_DATA_DIR/RG_PROJECTS_DIR；不调模型/不启动 opencode。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-m6a-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
const projectsDir = path.join(root, 'projects')

interface Setup {
  db: typeof import('../db').db
  doc: typeof import('../requirements/doc')
  modules: typeof import('../requirements/modules')
  design: typeof import('../design/service')
  changes: typeof import('../changesets/service')
  query: typeof import('../changesets/query')
  handoff: typeof import('../handoff/design-service')
  scaffold: typeof import('../apps/scaffold')
}

let setup: Setup

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
  'design_handoffs',
  'app_stage_events',
  'app_sessions',
  'app_dev_phases'
]

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03])

let setupReady: Promise<Setup> | null = null

async function ensureSetup(): Promise<Setup> {
  if (setupReady) return setupReady
  setupReady = (async () => {
    const dbModule = await import('../db')
    const doc = await import('../requirements/doc')
    const modules = await import('../requirements/modules')
    const design = await import('../design/service')
    const changes = await import('../changesets/service')
    const query = await import('../changesets/query')
    const handoff = await import('../handoff/design-service')
    const scaffold = await import('../apps/scaffold')
    setup = { db: dbModule.db, doc, modules, design, changes, query, handoff, scaffold }
    return setup
  })()
  return setupReady
}

after(() => {
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

function count(table: string, appId: string, extra = ''): number {
  const row = setup.db
    .prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE app_id = ?${extra}`)
    .get(appId) as { c: number }
  return row.c
}

function newApp(id: string): void {
  const now = new Date().toISOString()
  setup.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 8081, 'requirements', ?, ?)`
    )
    .run(id, `应用 ${id}`, id, now, now)
  fs.mkdirSync(path.join(projectsDir, id), { recursive: true })
}

function fillAndConfirmModule(appId: string, moduleId: string, tag: string, storyCount = 1): void {
  const payload = setup.doc.ensureRequirementDoc(appId, undefined, moduleId)
  const stories = Array.from({ length: storyCount }, (_, index) => ({
    title: `${tag} 功能 ${index + 1}`,
    description: `${tag} 功能 ${index + 1} 说明`,
    acceptance: [`${tag} 验收 ${index + 1}`],
    priority: 'P0'
  }))
  for (const section of payload.sections) {
    if (!section.required) continue
    if (section.kind === 'scenes') {
      setup.doc.saveDocSection(
        appId,
        'scenes',
        { data: { scenes: [{ title: `${tag} 场景`, description: `${tag} 场景说明` }], epics: [], stories: [] } },
        moduleId
      )
      continue
    }
    if (section.kind === 'epics') {
      setup.doc.saveDocSection(
        appId,
        'epics',
        {
          data: {
            scenes: [],
            epics: [{ title: `${tag} Epic`, goal: `${tag} 目标`, priority: 'P0' }],
            stories
          }
        },
        moduleId
      )
      continue
    }
    if (section.markdown.trim()) continue
    setup.doc.saveDocSection(appId, section.sectionKey, { markdown: `${tag}：${section.title}` }, moduleId)
  }
  setup.doc.confirmRequirementDoc(appId, moduleId)
}

interface DesignOptions {
  entityId: string
  name: string
  tableName: string
  storyLimit?: number
  relationTarget?: string
}

function buildConfirmedDesign(appId: string, moduleId: string, options: DesignOptions): void {
  const project = setup.design.getDesign(appId, moduleId)
  const stories = (project.input?.stories ?? [])
    .slice(0, options.storyLimit ?? 1)
    .map(story => story.id)
  setup.design.saveEntities(
    appId,
    [
      {
        id: options.entityId,
        name: options.name,
        tableName: options.tableName,
        fields: [
          { name: 'id', label: 'ID', type: 'string', unique: true },
          { name: `${options.name}名称`, label: '名称', type: 'string', required: true }
        ],
        relations: options.relationTarget
          ? [{ name: '引用目标', type: 'many-to-one', target: options.relationTarget }]
          : [],
        requirementRefs: stories,
        status: 'confirmed'
      }
    ],
    'manual',
    { moduleId }
  )
  setup.design.generateDefaultPageSets(appId, moduleId)
  const generated = setup.design.getDesign(appId, moduleId)
  for (const set of generated.pageSets) {
    for (const page of set.pages) {
      setup.design.savePageSnapshot(
        appId,
        page.id,
        {
          imageBase64: `data:image/png;base64,${PNG.toString('base64')}`,
          html: `<div>${page.title}</div>`
        },
        moduleId
      )
    }
  }
  const afterSnapshot = setup.design.getDesign(appId, moduleId)
  setup.design.savePageSets(
    appId,
    afterSnapshot.pageSets.map(set => ({
      ...set,
      status: 'confirmed' as const,
      pages: set.pages.map(page => ({ ...page, status: 'confirmed' as const }))
    })),
    'manual',
    { moduleId }
  )
  setup.design.confirmDesign(appId, moduleId)
}

interface ReadyApp {
  moduleA: string
  moduleB: string
}

/** 两模块（商品/订单）需求+设计已确认；A 的关系引用 B 实体（跨模块 FK） */
function readyTwoModuleApp(
  appId: string,
  options: { storyCount?: number; duplicateTable?: boolean } = {}
): ReadyApp {
  newApp(appId)
  const moduleA = setup.modules.ensureDefaultModule(appId).id
  setup.modules.updateModule(appId, moduleA, { title: '商品管理' })
  const moduleB = setup.modules.createModule(appId, { title: '订单管理' }).id
  fillAndConfirmModule(appId, moduleA, '商品', options.storyCount ?? 1)
  fillAndConfirmModule(appId, moduleB, '订单', options.storyCount ?? 1)
  setup.modules.confirmRequirementBundle(appId)
  const entityB = `${appId}-ent-b`
  buildConfirmedDesign(appId, moduleB, {
    entityId: entityB,
    name: '订单',
    tableName: options.duplicateTable ? 'biz_shared' : 'biz_order'
  })
  buildConfirmedDesign(appId, moduleA, {
    entityId: `${appId}-ent-a`,
    name: '商品',
    tableName: options.duplicateTable ? 'biz_shared' : 'biz_product',
    relationTarget: entityB
  })
  return { moduleA, moduleB }
}

function textOf(files: Array<{ name: string; content?: string }>, name: string): string {
  return files.find(file => file.name === name)?.content ?? ''
}

function handoffDocsDir(appId: string): string {
  return path.join(projectsDir, appId, 'docs', 'handoff')
}

test('M6a-1 两模块生成：文件/模块标题/全局编号/原型路径/manifest 模块信息', async () => {
  await ensureSetup()
  const appId = 'm6a-two'
  readyTwoModuleApp(appId)

  const preview = setup.handoff.previewDesignHandoff(appId)
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
    assert.ok(names.includes(expected), `缺少文件：${expected}`)
  }
  assert.ok(names.some(name => /^prototypes\/MOD-001\/ps-001\/page-\d+\.png$/.test(name)), '缺少 A 模块 PNG')
  assert.ok(names.some(name => /^prototypes\/MOD-002\/ps-002\/page-\d+\.png$/.test(name)), '缺少 B 模块 PNG')
  assert.ok(preview.files.filter(file => file.kind === 'image').every(file => !file.url), '预览未写盘不应发 URL')

  assert.equal(preview.modules.length, 2)
  assert.deepEqual(preview.modules.map(module => module.key), ['MOD-001', 'MOD-002'])
  assert.deepEqual(preview.modules.map(module => module.title), ['商品管理', '订单管理'])
  assert.equal(preview.modules[0].counts.entities, 1)
  assert.equal(preview.modules[0].counts.pages, 4)
  assert.equal(preview.modules[1].counts.pages, 4)
  assert.ok(preview.requirementsBundle && preview.requirementsBundle.version >= 1)
  // MF-M6a-1：预览合成 #1 模块行（不写库）
  assert.equal(preview.changeSet.modules?.length, 2)
  assert.ok(preview.changeSet.modules?.every(module => module.reqBaseVersion === null))

  const requirements = textOf(preview.files, '01-REQUIREMENTS.md')
  assert.match(requirements, /## 模块：商品管理（MOD-001 · 需求 v\d+）/)
  assert.match(requirements, /## 模块：订单管理（MOD-002 · 需求 v\d+）/)
  assert.match(requirements, /STORY-\d+/)

  const dataModel = textOf(preview.files, '02-DATA-MODEL.md')
  assert.match(dataModel, /### 模块：商品管理（MOD-001/)
  assert.match(dataModel, /### 模块：订单管理（MOD-002/)
  assert.match(dataModel, /biz_product/)
  assert.match(dataModel, /biz_order/)

  const schema = textOf(preview.files, 'schema.sql')
  assert.match(schema, /-- ---- 模块 MOD-001 商品管理/)
  assert.match(schema, /-- ---- 模块 MOD-002 订单管理/)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS `biz_product`/)
  assert.match(schema, /CREATE TABLE IF NOT EXISTS `biz_order`/)

  const pages = textOf(preview.files, '03-PAGES.md')
  assert.match(pages, /### 模块：商品管理（MOD-001/)
  assert.match(pages, /### 模块：订单管理（MOD-002/)
  assert.match(pages, /prototypes\/MOD-001\/ps-001\/page-001\.png/)
  assert.match(pages, /prototypes\/MOD-002\/ps-002\/page-\d+\.png/)

  const plan = textOf(preview.files, '04-PLAN.md')
  assert.match(plan, /### 模块：商品管理（MOD-001/)
  assert.match(plan, /### 模块：订单管理（MOD-002/)
  assert.match(plan, /Epic：|模块目标：/)

  const readme = textOf(preview.files, '00-README.md')
  assert.match(readme, /## 2\. 模块索引/)
  assert.match(readme, /MOD-001/)
  assert.match(readme, /MOD-002/)
  assert.match(readme, /跨模块依赖/)
  assert.match(readme, /→ ENT-002「订单」/) // A 的实体关系指向 B

  const manifest = JSON.parse(textOf(preview.files, 'manifest.json')) as {
    version: number
    requirementsBundle: { version: number; hash: string } | null
    designModules: Array<{ key: string; version: number; hash: string; entityCount: number }>
    modules: Array<{ key: string; requirements: { version: number }; design: { version: number }; counts: { pages: number } }>
    totals: { moduleCount: number; entities: number; pages: number }
    scale: { counts: { stories: number; entities: number; pages: number } }
  }
  assert.equal(manifest.version, 1)
  assert.ok(manifest.requirementsBundle && manifest.requirementsBundle.version >= 1)
  assert.deepEqual(manifest.designModules.map(module => module.key), ['MOD-001', 'MOD-002'])
  assert.match(manifest.designModules[0].hash, /^[0-9a-f]{64}$/)
  assert.equal(manifest.designModules[0].entityCount, 1)
  assert.deepEqual(manifest.modules.map(module => module.key), ['MOD-001', 'MOD-002'])
  assert.equal(manifest.totals.moduleCount, 2)
  assert.equal(manifest.totals.entities, 2)
  assert.ok(manifest.totals.pages >= 8)
  assert.equal(manifest.scale.counts.stories, 2)
  assert.equal(manifest.scale.counts.entities, 2)
  assert.ok(manifest.scale.counts.pages >= 8)

  // 预览不写盘/不落库
  assert.equal(count('design_handoffs', appId), 0)
  assert.equal(count('app_change_sets', appId), 0)

  const generated = setup.handoff.generateDesignHandoff(appId)
  assert.equal(generated.handoff.version, 1)
  assert.equal(generated.changeSet.seq, 1)
  assert.equal(generated.changeSet.title, '初始开发')
  assert.equal(generated.developmentStarted, true)
  assert.equal(generated.handoff.modules.length, 2)
  assert.ok(generated.handoff.requirementsBundle)

  const docsDir = handoffDocsDir(appId)
  for (const file of generated.handoff.files) {
    assert.ok(fs.existsSync(path.join(docsDir, file.name)), `未写盘：${file.name}`)
  }
  const pngA = generated.handoff.files.find(file => /^prototypes\/MOD-001\/ps-001\/page-001\.png$/.test(file.name))
  const pngB = generated.handoff.files.find(file => /^prototypes\/MOD-002\/ps-002\/page-\d+\.png$/.test(file.name))
  assert.ok(pngA && pngB)
  assert.ok(fs.existsSync(path.join(docsDir, pngA.name)))
  assert.ok(fs.existsSync(path.join(docsDir, pngB.name)))
  const image = generated.files.find(file => file.kind === 'image')
  assert.ok(image?.url, '生成后 PNG 应有预览 URL')

  const changeSets = setup.db
    .prepare('SELECT seq, title, status FROM app_change_sets WHERE app_id = ?')
    .all(appId) as Array<{ seq: number; title: string; status: string }>
  assert.equal(changeSets.length, 1)
  assert.equal(changeSets[0].seq, 1)
  assert.equal(changeSets[0].title, '初始开发')

  // MF-M6a-1：Change Set #1 为全部未归档模块写模块行（base=null，current=当前）
  const changeSetRows = setup.db
    .prepare('SELECT * FROM app_change_set_modules WHERE change_set_id = ? ORDER BY module_id')
    .all(generated.changeSet.id) as Array<{
    module_id: string
    req_base_version: number | null
    req_base_hash: string | null
    req_current_version: number | null
    req_current_hash: string | null
    design_base_version: number | null
    design_base_hash: string | null
    design_base_template_id: string | null
    design_current_version: number | null
    design_current_hash: string | null
  }>
  assert.equal(changeSetRows.length, 2)
  for (const row of changeSetRows) {
    assert.equal(row.req_base_version, null)
    assert.equal(row.req_base_hash, null)
    assert.equal(row.design_base_version, null)
    assert.equal(row.design_base_hash, null)
    assert.equal(row.design_base_template_id, null)
    assert.ok(typeof row.req_current_version === 'number')
    assert.match(row.req_current_hash ?? '', /^[0-9a-f]{64}$/)
    assert.ok(typeof row.design_current_version === 'number')
    assert.match(row.design_current_hash ?? '', /^[0-9a-f]{64}$/)
  }
  const list = setup.changes.listChangeSets(appId)
  assert.equal(list.changeSets.length, 1)
  assert.equal(list.changeSets[0].seq, 1)
  assert.equal(list.changeSets[0].modules.length, 2)
  assert.deepEqual(
    list.changeSets[0].modules.map(module => module.moduleKey).sort(),
    ['MOD-001', 'MOD-002']
  )
  assert.ok(list.changeSets[0].modules.every(module => module.reqBaseVersion === null))
  assert.ok(
    list.changeSets[0].modules.every(
      module => typeof module.reqCurrentVersion === 'number' && typeof module.designCurrentVersion === 'number'
    )
  )
  assert.equal(generated.changeSet.modules?.length, 2)

  // 同单重新生成不重复插模块行
  const regenerated = setup.handoff.generateDesignHandoff(appId)
  assert.equal(regenerated.handoff.version, 2)
  assert.equal(regenerated.changeSet.id, generated.changeSet.id)
  assert.equal(
    (
      setup.db
        .prepare('SELECT COUNT(*) AS c FROM app_change_set_modules WHERE change_set_id = ?')
        .get(generated.changeSet.id) as { c: number }
    ).c,
    2
  )

  const sourceDesign = JSON.parse(
    (setup.db.prepare('SELECT source_design_json FROM design_handoffs WHERE app_id = ? AND version = 1').get(appId) as {
      source_design_json: string
    }).source_design_json
  ) as { modules: Array<{ moduleId: string; key?: string; entities: unknown[]; pageSets: unknown[] }> }
  assert.equal(sourceDesign.modules.length, 2)
  assert.ok(sourceDesign.modules.every(module => module.entities.length > 0 && module.pageSets.length > 0))

  const sourceRequirements = JSON.parse(
    (setup.db
      .prepare('SELECT source_requirements_json FROM design_handoffs WHERE app_id = ? AND version = 1')
      .get(appId) as { source_requirements_json: string }).source_requirements_json
  ) as { modules: Array<{ moduleId: string; docVersion: number; docHash: string; inputId: string }> }
  assert.equal(sourceRequirements.modules.length, 2)
  assert.ok(sourceRequirements.modules.every(module => module.docHash.length === 64 && module.inputId))

  const app = setup.db.prepare('SELECT status FROM apps WHERE id = ?').get(appId) as { status: string }
  assert.equal(app.status, 'development')
})

test('M6a-2 门禁：未确认/缺 PNG/stale 按模块阻塞且带模块前缀；不写盘', async () => {
  await ensureSetup()
  const appId = 'm6a-blocked'
  const ready = readyTwoModuleApp(appId)

  // 缺 PNG（B 模块删一个页面文件）
  const projectB = setup.design.getDesign(appId, ready.moduleB)
  const page = projectB.pageSets[0].pages[0]
  assert.ok(page.imagePath)
  fs.rmSync(path.join(projectsDir, appId, page.imagePath))
  assert.throws(
    () => setup.handoff.previewDesignHandoff(appId),
    (error: { status?: number; issues?: string[] }) => {
      assert.equal(error.status, 400)
      assert.ok(
        error.issues?.some(issue => issue.startsWith('[MOD-002 订单管理]') && issue.includes('原型 PNG 文件不存在')),
        JSON.stringify(error.issues)
      )
      return true
    }
  )
  assert.equal(count('design_handoffs', appId), 0)

  // 重新打开 B（draft）：先验证“设计未确认”，再补截图并确认
  setup.design.reopenDesign(appId, ready.moduleB)
  assert.throws(
    () => setup.handoff.previewDesignHandoff(appId),
    (error: { status?: number; issues?: string[] }) => {
      assert.equal(error.status, 400)
      assert.ok(
        error.issues?.some(issue => issue.startsWith('[MOD-002 订单管理]') && issue.includes('设计尚未确认')),
        JSON.stringify(error.issues)
      )
      return true
    }
  )

  // 补回 PNG 并重新确认 B，改为 B 需求 stale（重新编辑需求并改内容）
  setup.design.savePageSnapshot(
    appId,
    page.id,
    { imageBase64: `data:image/png;base64,${PNG.toString('base64')}` },
    ready.moduleB
  )
  setup.design.confirmDesign(appId, ready.moduleB)
  setup.doc.reopenRequirementDoc(appId, ready.moduleB)
  setup.doc.saveDocSection(appId, 'problem', { markdown: 'B 模块需求已变更' }, ready.moduleB)
  assert.throws(
    () => setup.handoff.previewDesignHandoff(appId),
    (error: { status?: number; issues?: string[] }) => {
      assert.equal(error.status, 400)
      assert.ok(
        error.issues?.some(issue => issue.startsWith('[MOD-002 订单管理]') && /需求文档已变更|尚未确认/.test(issue)),
        JSON.stringify(error.issues)
      )
      return true
    }
  )
  assert.equal(count('design_handoffs', appId), 0)
})

test('M6a-3 跨模块 FK/表名重复/模板不一致只 warning 不阻塞', async () => {
  await ensureSetup()
  const appId = 'm6a-warnings'
  const ready = readyTwoModuleApp(appId, { duplicateTable: true })
  setup.db
    .prepare(
      "UPDATE app_design_projects SET prototype_template_id = 'builtin-prototype-minimal' WHERE app_id = ? AND module_id = ?"
    )
    .run(appId, ready.moduleB)

  const validation = setup.handoff.validateDesignHandoff(appId, setup.handoff.loadHandoffModules(appId))
  assert.deepEqual(validation.issues, [])
  assert.ok(validation.warnings.some(warning => warning.includes('跨模块依赖')))
  assert.ok(validation.warnings.some(warning => warning.includes('表名「biz_shared」') && warning.includes('重复')))
  assert.ok(validation.warnings.some(warning => warning.includes('多模块原型模板不一致')))

  const preview = setup.handoff.previewDesignHandoff(appId)
  assert.equal(preview.modules.length, 2)
  const generated = setup.handoff.generateDesignHandoff(appId)
  assert.equal(generated.handoff.version, 1)
  assert.ok(generated.warnings.some(warning => warning.includes('多模块原型模板不一致')))
})

test('M6a-4 Change Set #2 只选 A：05-CHANGES 只含 A、B 未变更；manifest 模块映射', async () => {
  await ensureSetup()
  const appId = 'm6a-change2'
  const ready = readyTwoModuleApp(appId)
  setup.handoff.generateDesignHandoff(appId)
  setup.handoff.completeActiveChangeSet(appId)

  const versionB = setup.design.getDesign(appId, ready.moduleB).version
  const docB = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB).doc.version

  const started = setup.changes.startChangeSet(appId, { title: '只改商品', scope: 'design', moduleIds: [ready.moduleA] })
  assert.equal(started.changeSet.seq, 2)
  assert.equal(started.changeSet.modules.length, 1)

  // 修改 A 实体并重新确认（B 不动）
  const projectA = setup.design.getDesign(appId, ready.moduleA)
  const entities = projectA.entities.map(entity => ({
    ...entity,
    name: `${entity.name}（改）`,
    fields: [...entity.fields, { name: 'memo', label: '备注', type: 'string' as const }],
    status: 'confirmed' as const
  }))
  setup.design.saveEntities(appId, entities, 'manual', { moduleId: ready.moduleA })
  setup.design.confirmDesign(appId, ready.moduleA)

  const generated = setup.handoff.generateDesignHandoff(appId)
  assert.equal(generated.handoff.version, 2)
  assert.equal(generated.changeSet.seq, 2)
  assert.equal(generated.changeSet.baselineHandoffVersion, 1)

  const read = setup.handoff.readDesignHandoff(appId)
  const changes = textOf(read.files, '05-CHANGES.md')
  assert.match(changes, /增量变更（变更单 #2）/)
  assert.match(changes, /## 模块：商品管理（MOD-001）— 变更/)
  assert.match(changes, /新增字段：`memo`|修改字段/)
  assert.match(changes, /## 模块：订单管理（MOD-002）— 未变更/)
  assert.ok(!changes.includes('订单管理（MOD-002）— 变更'))

  const manifest = JSON.parse(textOf(read.files, 'manifest.json')) as {
    modules: Array<{ key: string; design: { version: number }; changeState: string | null }>
    changeSet: { seq: number; changes: { added: number; modified: number; total: number } }
    designModules: Array<{ key: string; version: number }>
  }
  assert.equal(manifest.changeSet.seq, 2)
  const moduleA = manifest.modules.find(module => module.key === 'MOD-001')
  const moduleB = manifest.modules.find(module => module.key === 'MOD-002')
  assert.equal(moduleA?.changeState, 'changed')
  assert.equal(moduleB?.changeState, 'unchanged')
  assert.ok(manifest.changeSet.changes.total > 0)
  assert.equal(moduleB?.design.version, versionB)

  // B 的需求/设计版本未变
  assert.equal(setup.design.getDesign(appId, ready.moduleB).version, versionB)
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB).doc.version, docB)
  assert.equal(setup.design.getDesign(appId, ready.moduleB).status, 'confirmed')

  // 读/摘要带 modules
  assert.equal(read.handoff?.modules.length, 2)
  assert.ok(read.handoff?.requirementsBundle)
  const summary = setup.handoff.designHandoffSummary(appId)
  assert.equal(summary?.version, 2)
  assert.equal(summary?.modules.length, 2)
  assert.ok(summary?.requirementsBundle)
  const manifestMeta = setup.handoff.designHandoffManifest(appId)
  const manifestModules = manifestMeta?.manifest?.modules as Array<{ key: string }>
  assert.deepEqual(manifestModules.map(module => module.key), ['MOD-001', 'MOD-002'])
})

test('M6a-7 #2 需求变更（A only）：确认需求 → bundle confirm → sync regenerate → 确认设计 → v2；B 不动', async () => {
  await ensureSetup()
  const appId = 'm6a-change2-req'
  const ready = readyTwoModuleApp(appId)
  const first = setup.handoff.generateDesignHandoff(appId)
  setup.handoff.completeActiveChangeSet(appId)

  const beforeA = setup.design.getDesign(appId, ready.moduleA)
  const beforeStories = beforeA.input?.stories ?? []
  const beforeEpics = beforeA.input?.epics ?? []
  const versionB = setup.design.getDesign(appId, ready.moduleB).version
  const docB = setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB).doc.version
  const firstModules = setup.changes.listChangeSets(appId).changeSets.find(item => item.id === first.changeSet.id)
  assert.equal(firstModules?.modules.length, 2)

  const started = setup.changes.startChangeSet(appId, {
    title: '只改商品需求',
    scope: 'requirements',
    moduleIds: [ready.moduleA]
  })
  assert.equal(started.changeSet.seq, 2)

  // 改 A 的 Story 标题（保留稳定 ID → 05-CHANGES 应显示“修改”）
  setup.doc.saveDocSection(
    appId,
    'epics',
    {
      data: {
        scenes: [],
        epics: beforeEpics.map(epic => ({
          id: epic.id,
          title: epic.title,
          goal: epic.goal,
          priority: epic.priority
        })),
        stories: beforeStories.map((story, index) => ({
          id: story.id,
          epicId: story.epicId,
          title: index === 0 ? `${story.title}（改）` : story.title,
          description: story.description,
          acceptance: story.acceptance,
          priority: story.priority
        }))
      }
    },
    ready.moduleA
  )
  setup.doc.confirmRequirementDoc(appId, ready.moduleA)
  setup.modules.confirmRequirementBundle(appId)
  assert.equal(
    (setup.db.prepare('SELECT status FROM apps WHERE id = ?').get(appId) as { status: string }).status,
    'design'
  )

  // 评审脚本路径：mode='regenerate'（不是 'both'）
  const synced = setup.design.syncDesignInput(appId, 'regenerate', ready.moduleA)
  assert.equal(synced.mode, 'regenerate')
  assert.equal(synced.stale.stale, false)

  // regenerate 会把受影响实体/页面置草稿：重新确认 A
  const afterSync = setup.design.getDesign(appId, ready.moduleA)
  setup.design.saveEntities(
    appId,
    afterSync.entities.map(entity => ({ ...entity, status: 'confirmed' as const })),
    'manual',
    { moduleId: ready.moduleA }
  )
  const afterEntities = setup.design.getDesign(appId, ready.moduleA)
  setup.design.savePageSets(
    appId,
    afterEntities.pageSets.map(set => ({
      ...set,
      status: 'confirmed' as const,
      pages: set.pages.map(page => ({ ...page, status: 'confirmed' as const }))
    })),
    'manual',
    { moduleId: ready.moduleA }
  )
  setup.design.confirmDesign(appId, ready.moduleA)

  const generated = setup.handoff.generateDesignHandoff(appId)
  assert.equal(generated.handoff.version, 2)
  assert.equal(generated.changeSet.seq, 2)
  assert.equal(generated.changeSet.baselineHandoffVersion, 1)

  const read = setup.handoff.readDesignHandoff(appId)
  const changes = textOf(read.files, '05-CHANGES.md')
  assert.match(changes, /## 模块：商品管理（MOD-001）— 变更/)
  assert.match(changes, /## 模块：订单管理（MOD-002）— 未变更/)
  assert.match(changes, /修改：/)
  assert.match(changes, /商品 功能 1（改）/)
  assert.ok(!changes.includes('订单管理（MOD-002）— 变更'))

  // #2 只包含 A；#1 仍保留 2 行
  const secondRows = setup.query.changeSetModuleRows(generated.changeSet.id)
  assert.equal(secondRows.length, 1)
  assert.equal(secondRows[0].module_id, ready.moduleA)
  const firstRows = setup.query.changeSetModuleRows(first.changeSet.id)
  assert.equal(firstRows.length, 2)

  // B 需求/设计版本不动
  assert.equal(setup.design.getDesign(appId, ready.moduleB).version, versionB)
  assert.equal(setup.doc.ensureRequirementDoc(appId, undefined, ready.moduleB).doc.version, docB)
  assert.equal(setup.design.getDesign(appId, ready.moduleB).status, 'confirmed')
})


test('M6a-5 规模按全部模块汇总（10 Story → large）；prototypes 目录按模块', async () => {
  await ensureSetup()
  const appId = 'm6a-scale'
  readyTwoModuleApp(appId, { storyCount: 5 })

  const preview = setup.handoff.previewDesignHandoff(appId)
  assert.equal(preview.scale.counts.stories, 10)
  assert.equal(preview.scale.counts.epics, 2)
  assert.equal(preview.scale.level, 'large')
  assert.equal(preview.scale.suggested, true)
  assert.equal(preview.scale.phaseCount, 3)
  assert.equal(preview.scale.modulePhaseCount, 2)

  const previewManifest = JSON.parse(textOf(preview.files, 'manifest.json')) as {
    phases?: Array<{
      key: string
      kind: string
      title: string
      moduleId?: string
      moduleKey?: string
      parentKey?: string
    }>
    scale?: { phaseCount?: number; modulePhaseCount?: number }
  }
  const phases = previewManifest.phases ?? []
  assert.deepEqual(phases.map(phase => phase.key), [
    'base',
    'module:MOD-001',
    'epic:EPIC-001',
    'module:MOD-002',
    'epic:EPIC-002'
  ])
  assert.deepEqual(phases.map(phase => phase.kind), ['base', 'module', 'epic', 'module', 'epic'])
  assert.equal(phases[1].moduleKey, 'MOD-001')
  assert.ok(phases[1].moduleId)
  assert.equal(phases[2].parentKey, 'MOD-001')
  assert.equal(phases[2].moduleKey, 'MOD-001')
  assert.equal(phases[4].parentKey, 'MOD-002')
  assert.equal(previewManifest.scale?.phaseCount, 3)
  assert.equal(previewManifest.scale?.modulePhaseCount, 2)

  const plan = textOf(preview.files, '04-PLAN.md')
  assert.match(plan, /## 0\. 建议分阶段开发（可选）/)
  assert.match(plan, /规模：10 Story/)
  assert.match(plan, /### 模块阶段 · MOD-001 商品管理/)
  assert.match(plan, /### 模块阶段 · MOD-002 订单管理/)
  assert.match(plan, /### 阶段 1 · 数据模型与基础框架/)
  assert.match(plan, /### 阶段 2 · EPIC-001/)
  assert.match(plan, /### 阶段 3 · EPIC-002/)
  assert.match(plan, /- 模块：`MOD-001`（分组\/里程碑，不单独开会话）/)
  assert.match(plan, /- 完成标准：模块阶段只作分组\/里程碑/)
  assert.match(plan, /- 模块阶段：`module:MOD-001`/)
  assert.match(plan, /- Epic 阶段：`epic:EPIC-001`（可执行，单独会话）/)

  const generated = setup.handoff.generateDesignHandoff(appId)
  assert.equal(generated.handoff.scale.level, 'large')
  const images = generated.handoff.files.filter(file => file.kind === 'image')
  assert.ok(images.length > 0)
  assert.ok(images.every(file => /^prototypes\/MOD-00\d\/ps-\d{3}\/page-\d{3}\.png$/.test(file.name)))
})

test('M6a-6 删除应用清理交接包/变更单/文件', async () => {
  await ensureSetup()
  const appId = 'm6a-delete'
  readyTwoModuleApp(appId)
  setup.handoff.generateDesignHandoff(appId)
  assert.ok(fs.existsSync(handoffDocsDir(appId)))

  setup.handoff.deleteDesignHandoffData(appId)
  assert.equal(count('design_handoffs', appId), 0)
  assert.equal(count('app_change_sets', appId), 0)
  assert.equal(
    (
      setup.db
        .prepare(
          'SELECT COUNT(*) AS c FROM app_change_set_modules WHERE change_set_id IN (SELECT id FROM app_change_sets WHERE app_id = ?)'
        )
        .get(appId) as { c: number }
    ).c,
    0
  )
  setup.scaffold.removeAppDir(appId, projectsDir)
  assert.ok(!fs.existsSync(path.join(projectsDir, appId)))
  for (const table of TABLES) {
    setup.db.prepare(`DELETE FROM ${table} WHERE app_id = ?`).run(appId)
  }
  setup.db.prepare('DELETE FROM apps WHERE id = ?').run(appId)
  assert.equal(
    (setup.db.prepare('SELECT COUNT(*) AS c FROM apps WHERE id = ?').get(appId) as { c: number }).c,
    0
  )
})
