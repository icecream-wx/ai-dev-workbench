/**
 * 需求模块随时重新规划（RMP-2）：聚合 / prompt / 解析 / 校验 / apply / 确认重开 / 设置 / 生成。
 *
 * 全部使用临时 RG_DATA_DIR；模型通过注入 generator（不调 opencode/真实模型）。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'

interface Context {
  root: string
  db: typeof import('../db').db
  doc: typeof import('./doc')
  modules: typeof import('./modules')
  plan: typeof import('./module-plan')
  replan: typeof import('./module-replan')
  generation: typeof import('./module-generation')
  settings: typeof import('../db')
}

let context: Context | null = null

before(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-module-replan-'))
  process.env.RG_DATA_DIR = path.join(root, 'data')
  process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
  process.env.OPENCODE_AUTO_START = 'false'
  const dbModule = await import('../db')
  const doc = await import('./doc')
  const modules = await import('./modules')
  const plan = await import('./module-plan')
  const replan = await import('./module-replan')
  const generation = await import('./module-generation')
  context = { root, db: dbModule.db, doc, modules, plan, replan, generation, settings: dbModule }
})

after(() => {
  context?.db.close()
  if (context?.root) fs.rmSync(context.root, { recursive: true, force: true })
})

const TABLES = [
  'app_requirement_bundles',
  'app_requirement_doc_versions',
  'app_requirement_doc_sections',
  'app_requirement_docs',
  'app_modules',
  'app_stage_events',
  'app_change_sets',
  'app_design_projects',
  'app_settings'
]

function newApp(id: string, name = '订单系统', status = 'requirements'): Context {
  const ctx = context!
  for (const table of TABLES) {
    if (table === 'app_settings') ctx.db.prepare('DELETE FROM app_settings WHERE key LIKE ?').run(`app.${id}.%`)
    else ctx.db.prepare(`DELETE FROM ${table} WHERE app_id = ?`).run(id)
  }
  ctx.db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  const now = new Date().toISOString()
  ctx.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
       VALUES (?, ?, NULL, ?, 8081, ?, ?, ?)`
    )
    .run(id, name, id, status, now, now)
  ctx.doc.ensureRequirementDoc(id)
  return ctx
}

/** 用模板全部章节填满内容（确认/生成可用） */
function fillModule(appId: string, moduleId: string, tag: string): void {
  const ctx = context!
  const payload = ctx.doc.ensureRequirementDoc(appId, undefined, moduleId)
  const sections = payload.template.sections.map(section => ({
    id: section.id,
    markdown:
      section.kind === 'epics'
        ? `- 作为业务员，我希望${tag}可以正常使用，以便完成${tag}工作`
        : `${tag}：${section.title} 的内容说明。`
  }))
  ctx.doc.saveDoc(appId, { sections }, moduleId)
}

function addStructuredEpic(appId: string, moduleId: string, tag: string): void {
  const ctx = context!
  ctx.doc.saveDocSection(
    appId,
    'epics',
    {
      data: {
        scenes: [],
        epics: [
          {
            title: `${tag} Epic`,
            goal: `${tag} 目标`,
            stories: [{ title: `${tag} Story`, description: `${tag} 说明`, acceptance: ['完成'], priority: 'P0' }]
          }
        ],
        stories: []
      }
    },
    moduleId
  )
}

/** 两个业务域模块 + 已应用规划（含 scope，便于 keep/rename 范围校验） */
function seedTwoModules(appId: string, name = '订单系统'): {
  appId: string
  product: { id: string; title: string; version: number; content: string }
  order: { id: string; title: string; version: number; content: string }
} {
  const ctx = newApp(appId, name)
  const modules = ctx.modules.listModules(appId)
  const productId = modules[0].id
  fillModule(appId, productId, '商品')
  addStructuredEpic(appId, productId, '商品')
  const order = ctx.modules.createModule(appId, { title: '订单管理', description: '订单创建与查询' })
  fillModule(appId, order.id, '订单')
  addStructuredEpic(appId, order.id, '订单')
  ctx.settings.writeSetting(`app.${appId}.modulePlanApplied`, {
    kind: 'initial',
    modules: [
      {
        key: 'product',
        title: '商品管理',
        description: '商品档案与商品明细',
        scope: ['商品档案', '商品明细'],
        suggestedEpics: [],
        existingModuleId: null,
        action: 'create',
        moduleId: productId,
        moduleKey: 'MOD-001'
      },
      {
        key: 'order',
        title: '订单管理',
        description: '订单创建与查询',
        scope: ['订单创建', '订单查询'],
        suggestedEpics: [],
        existingModuleId: null,
        action: 'create',
        moduleId: order.id,
        moduleKey: 'MOD-002'
      }
    ],
    dependencies: [],
    coverage: [],
    unassigned: [],
    openIssues: [],
    warnings: []
  })
  ctx.settings.writeSetting(`app.${appId}.modulePlanSource`, '商品与订单需求')
  ctx.modules.updateModule(appId, productId, { title: '商品管理', description: '商品档案与商品明细' })
  const productDoc = ctx.doc.ensureRequirementDoc(appId, undefined, productId)
  const orderDoc = ctx.doc.ensureRequirementDoc(appId, undefined, order.id)
  return {
    appId,
    product: { id: productId, title: '商品管理', version: productDoc.doc.version, content: productDoc.doc.contentMd },
    order: { id: order.id, title: '订单管理', version: orderDoc.doc.version, content: orderDoc.doc.contentMd }
  }
}

function replanRaw(modules: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'replan',
    instruction: '重新拆分',
    modules,
    dependencies: [],
    coverage: [{ requirement: '商品', moduleKey: 'product' }],
    unassigned: [],
    openIssues: [],
    warnings: [],
    ...extra
  }
}

function count(table: string, appId: string): number {
  return (context!.db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE app_id = ?`).get(appId) as { c: number }).c
}

function snapshot(appId: string): string {
  return JSON.stringify({
    modules: count('app_modules', appId),
    docs: count('app_requirement_docs', appId),
    sections: count('app_requirement_doc_sections', appId),
    versions: count('app_requirement_doc_versions', appId),
    events: count('app_stage_events', appId),
    applied: context!.settings.readSetting(`app.${appId}.modulePlanApplied`),
    source: context!.settings.readSetting(`app.${appId}.modulePlanSource`)
  })
}

test('collectReplanSource：按模块聚合章节/结构化 Epics、截断标记、不写库', () => {
  const ctx = context!
  const seeded = seedTwoModules('rs-source')
  const before = snapshot('rs-source')
  const source = ctx.replan.collectReplanSource('rs-source')
  assert.equal(source.modules.length, 2)
  assert.deepEqual(
    source.modules.map(module => module.moduleKey),
    ['MOD-001', 'MOD-002']
  )
  assert.equal(source.modules[0].title, '商品管理')
  assert.equal(source.modules[0].status, 'draft')
  assert.deepEqual(source.modules[0].scope, ['商品档案', '商品明细'])
  assert.equal(source.modules[0].epics.length, 1)
  assert.equal(source.modules[0].epics[0].title, '商品 Epic')
  assert.equal(source.modules[0].epics[0].stories[0].title, '商品 Story')
  assert.ok(source.text.includes('商品 Epic'))
  assert.ok(source.text.includes('订单：问题与机会') || source.text.includes('订单'))
  assert.ok(source.contentChars > 0)
  assert.equal(source.truncated, false)
  assert.equal(snapshot('rs-source'), before)
  assert.ok(seeded.product.id)

  // 超长章节 → 截断
  ctx.doc.saveDocSection('rs-source', 'problem', { markdown: '长'.repeat(5000) }, seeded.product.id)
  const truncated = ctx.replan.collectReplanSource('rs-source')
  const product = truncated.modules.find(module => module.id === seeded.product.id)!
  assert.equal(product.truncated, true)
  assert.equal(truncated.truncated, true)
  assert.ok(product.text.includes('章节内容过长已截断'))
})

test('buildModuleReplanPrompt：当前模块 moduleId/标题/状态/范围/Epics、指令、动作规则、分隔符、只规划', () => {
  const ctx = context!
  seedTwoModules('rs-prompt')
  const source = ctx.replan.collectReplanSource('rs-prompt')
  const prompt = ctx.replan.buildModuleReplanPrompt({
    appName: '订单系统',
    source,
    instruction: '把订单拆成订单和售后，商品不变'
  })
  assert.ok(prompt.includes(ctx.plan.MODULE_PLAN_DELIMITER))
  assert.ok(prompt.includes(source.modules[0].id))
  assert.ok(prompt.includes('MOD-001'))
  assert.ok(prompt.includes('商品管理'))
  assert.ok(prompt.includes('商品 Epic'))
  assert.ok(prompt.includes('范围：商品档案；商品明细'))
  assert.ok(prompt.includes('把订单拆成订单和售后'))
  assert.ok(prompt.includes('action="keep"'))
  assert.ok(prompt.includes('regenerate'))
  assert.ok(prompt.includes('create'))
  assert.ok(prompt.includes('只规划、不写文档'))
  assert.ok(prompt.includes('"kind": "replan"'))
  assert.ok(prompt.includes('旧模块未出现在列表里即视为归档'))
})

test('normalize/validate：keep→rename 归一化、范围变化错误、重复映射/标题/动作/新建映射/未知模块、数量警告', () => {
  const ctx = context!
  const seeded = seedTwoModules('rs-validate')
  const current = ctx.replan.collectReplanSource('rs-validate').modules.map(module => ({
    id: module.id,
    moduleKey: module.moduleKey,
    title: module.title,
    description: module.description,
    status: module.status,
    version: module.version,
    scope: module.scope,
    confirmed: module.confirmed
  }))

  const keepChanged = ctx.replan.normalizeReplanPlan(
    replanRaw([
      {
        key: 'product',
        title: '商品中心',
        description: '商品档案与商品明细',
        scope: ['商品档案', '商品明细'],
        existingModuleId: seeded.product.id,
        action: 'keep'
      }
    ]),
    current
  )
  assert.equal(keepChanged.modules[0].action, 'rename')

  const keepScopeChanged = ctx.replan.validateModuleReplan(
    ctx.replan.normalizeReplanPlan(
      replanRaw([
        {
          key: 'product',
          title: '商品管理',
          description: '商品档案与商品明细',
          scope: ['商品档案', '商品明细', '新增范围'],
          existingModuleId: seeded.product.id,
          action: 'keep'
        }
      ]),
      current
    ),
    current
  )
  assert.ok(keepScopeChanged.errors.some(error => error.includes('范围已变化')))

  const renameScopeChanged = ctx.replan.validateModuleReplan(
    ctx.replan.normalizeReplanPlan(
      replanRaw([
        {
          key: 'product',
          title: '商品中心',
          description: '商品档案与商品明细',
          scope: ['只保留商品档案'],
          existingModuleId: seeded.product.id,
          action: 'rename'
        }
      ]),
      current
    ),
    current
  )
  assert.ok(renameScopeChanged.errors.some(error => error.includes('范围已变化')))

  const duplicateMap = ctx.replan.validateModuleReplan(
    ctx.replan.normalizeReplanPlan(
      replanRaw([
        { key: 'a', title: '模块 A', existingModuleId: seeded.product.id, action: 'keep', scope: [] },
        { key: 'b', title: '模块 B', existingModuleId: seeded.product.id, action: 'regenerate', scope: ['新'] }
      ]),
      current
    ),
    current
  )
  assert.ok(duplicateMap.errors.some(error => error.includes('映射多次')))

  const createWithId = ctx.replan.validateModuleReplan(
    ctx.replan.normalizeReplanPlan(
      replanRaw([{ key: 'a', title: '新模块', existingModuleId: seeded.product.id, action: 'create', scope: [] }]),
      current
    ),
    current
  )
  assert.ok(createWithId.errors.some(error => error.includes('不能映射已有模块')))

  const unknown = ctx.replan.validateModuleReplan(
    ctx.replan.normalizeReplanPlan(
      replanRaw([{ key: 'a', title: '模块 A', existingModuleId: 'missing-module', action: 'keep', scope: [] }]),
      current
    ),
    current
  )
  assert.ok(unknown.errors.some(error => error.includes('不存在或已归档')))

  const dupTitles = ctx.replan.validateModuleReplan(
    ctx.replan.normalizeReplanPlan(
      replanRaw([
        { key: 'a', title: '同名模块', existingModuleId: null, action: 'create', scope: [] },
        { key: 'b', title: '同名模块', existingModuleId: null, action: 'create', scope: [] }
      ]),
      current
    ),
    current
  )
  assert.ok(dupTitles.errors.some(error => error.includes('标题重复')))

  const badAction = ctx.replan.validateModuleReplan(
    ctx.replan.normalizeReplanPlan(
      replanRaw([{ key: 'a', title: '模块 A', existingModuleId: null, action: 'merge', scope: [] }]),
      current
    ),
    current
  )
  assert.ok(badAction.errors.some(error => error.includes('动作不合法')))

  const many = ctx.replan.validateModuleReplan(
    ctx.replan.normalizeReplanPlan(
      replanRaw(
        Array.from({ length: 9 }, (_, index) => ({ key: `k${index}`, title: `业务域${index}`, existingModuleId: null, action: 'create', scope: [] }))
      ),
      current
    ),
    current
  )
  assert.ok(many.warnings.some(warning => warning.includes('耗时')))

  const tooMany = ctx.replan.validateModuleReplan(
    ctx.replan.normalizeReplanPlan(
      replanRaw(
        Array.from({ length: ctx.plan.MAX_PLAN_MODULES + 1 }, (_, index) => ({
          key: `k${index}`,
          title: `业务域${index}`,
          existingModuleId: null,
          action: 'create',
          scope: []
        }))
      ),
      current
    ),
    current
  )
  assert.ok(tooMany.errors.some(error => error.includes('技术上限')))

  // 未匹配旧模块 → 归档；确认状态 → 需要重开
  const archive = ctx.replan.validateModuleReplan(
    ctx.replan.normalizeReplanPlan(
      replanRaw([{ key: 'trade', title: '交易管理', existingModuleId: null, action: 'create', scope: [] }]),
      current
    ),
    current
  )
  assert.equal(archive.archiveModules.length, 2)
  assert.equal(archive.requiresReopenConfirmed, false)
})

test('splitModuleReplanOutput：容错代码块/尾逗号，非法/空返回可读错误', () => {
  const ctx = context!
  const seeded = seedTwoModules('rs-parse')
  const current = ctx.replan.collectReplanSource('rs-parse').modules
  const raw = [
    '建议保留商品管理并重新生成订单。',
    ctx.plan.MODULE_PLAN_DELIMITER,
    '```json',
    JSON.stringify(
      replanRaw([
        { key: 'product', title: '商品管理', existingModuleId: seeded.product.id, action: 'keep', scope: [] },
        { key: 'order', title: '订单中心', existingModuleId: seeded.order.id, action: 'regenerate', scope: ['订单创建'] }
      ])
    ).replace('}]', '},]'),
    '```'
  ].join('\n')
  const parsed = ctx.replan.splitModuleReplanOutput(raw, current)
  assert.equal(parsed.error, '')
  assert.match(parsed.reply, /重新生成订单/)
  assert.equal(parsed.plan?.kind, 'replan')
  assert.equal(parsed.plan?.modules.length, 2)

  const broken = ctx.replan.splitModuleReplanOutput('没有协议', current)
  assert.equal(broken.plan, null)
  assert.match(broken.error, /MODULE_PLAN_JSON/)
  const empty = ctx.replan.splitModuleReplanOutput(`${ctx.plan.MODULE_PLAN_DELIMITER}\n{"kind":"replan","modules":[]}`, current)
  assert.equal(empty.plan, null)
})

test('previewModuleReplan：只读、注入模型输出、返回 diff 信息；模型失败 502 且不写库', async () => {
  const ctx = context!
  const seeded = seedTwoModules('rs-preview')
  const before = snapshot('rs-preview')
  const generator = async (): Promise<string> =>
    [
      '把订单重新生成，并新增售后。',
      ctx.plan.MODULE_PLAN_DELIMITER,
      JSON.stringify(
        replanRaw([
          { key: 'product', title: '商品管理', existingModuleId: seeded.product.id, action: 'keep', scope: [] },
          { key: 'order', title: '订单中心', existingModuleId: seeded.order.id, action: 'regenerate', scope: ['订单创建', '订单查询', '订单状态'] },
          { key: 'aftersale', title: '售后管理', existingModuleId: null, action: 'create', scope: ['售后申请'] }
        ])
      )
    ].join('\n')
  const result = await ctx.replan.previewModuleReplan(
    'rs-preview',
    { instruction: '把订单拆成订单和售后' },
    { generator }
  )
  assert.equal(result.plan.kind, 'replan')
  assert.equal(result.plan.instruction, '把订单拆成订单和售后')
  assert.equal(result.plan.modules.length, 3)
  assert.equal(result.currentModules.length, 2)
  assert.equal(result.archiveModules.length, 0)
  assert.equal(result.requiresReopenConfirmed, false)
  assert.equal(result.errors.length, 0)
  assert.equal(result.sourceTruncated, false)
  assert.match(result.reply, /售后/)
  assert.equal(snapshot('rs-preview'), before)

  let threw = false
  try {
    await ctx.replan.previewModuleReplan('rs-preview', {}, {
      generator: async () => {
        throw new Error('模拟模型失败')
      }
    })
  } catch (error) {
    threw = true
    assert.equal((error as { status?: number }).status, 502)
    assert.match((error as Error).message, /模块重新规划失败/)
  }
  assert.equal(threw, true)
  assert.equal(snapshot('rs-preview'), before)

  // 非需求阶段 / 变更中 → 409（不进入模型）
  newApp('rs-preview-design', '设计应用', 'design')
  await assert.rejects(
    () => ctx.replan.previewModuleReplan('rs-preview-design', {}, { generator }),
    (error: unknown) => (error as { status?: number }).status === 409
  )
})

test('applyModuleReplan（拆分/重生成/新建）：keep 不变、regenerate 改标题不产版本、create 空 v1、settings kind=replan、不生成文档', () => {
  const ctx = context!
  const seeded = seedTwoModules('rs-apply-split')
  const before = snapshot('rs-apply-split')
  const orderDocBefore = ctx.doc.ensureRequirementDoc('rs-apply-split', undefined, seeded.order.id)

  const result = ctx.replan.applyModuleReplan('rs-apply-split', {
    plan: replanRaw([
      { key: 'product', title: '商品管理', description: '商品档案与商品明细', scope: ['商品档案', '商品明细'], existingModuleId: seeded.product.id, action: 'keep' },
      {
        key: 'order',
        title: '订单中心',
        description: '下单、查询与状态',
        scope: ['订单创建', '订单查询', '订单状态'],
        existingModuleId: seeded.order.id,
        action: 'regenerate'
      },
      { key: 'aftersale', title: '售后管理', description: '售后工单', scope: ['售后申请'], existingModuleId: null, action: 'create' }
    ]),
    reopenConfirmed: false
  })

  assert.equal(result.modules.length, 3)
  assert.deepEqual(result.kept.map(item => item.title), ['商品管理'])
  assert.deepEqual(result.renamed, [])
  assert.deepEqual(result.regenerated.map(item => item.title), ['订单中心'])
  assert.deepEqual(result.created.map(item => item.title), ['售后管理'])
  assert.deepEqual(result.archived, [])
  assert.deepEqual(
    result.generation.map(item => item.title),
    ['订单中心', '售后管理']
  )

  // keep：文档/版本/标题/内容都不变（默认模块历史标题保持原样）
  const productDoc = ctx.doc.ensureRequirementDoc('rs-apply-split', undefined, seeded.product.id)
  assert.equal(productDoc.doc.version, seeded.product.version)
  assert.equal(productDoc.doc.title, '订单系统 需求文档')
  assert.equal(productDoc.doc.contentMd, seeded.product.content)
  assert.equal(productDoc.doc.status, 'draft')

  // regenerate：标题/说明/文档标题更新，版本与正文不变（生成稍后）
  const orderDoc = ctx.doc.ensureRequirementDoc('rs-apply-split', undefined, seeded.order.id)
  assert.equal(orderDoc.doc.version, orderDocBefore.doc.version)
  assert.equal(orderDoc.doc.title, '订单系统 · 订单中心 需求文档')
  assert.equal(
    orderDoc.doc.contentMd.replace(/^# .*$/m, '# title'),
    orderDocBefore.doc.contentMd.replace(/^# .*$/m, '# title')
  )
  assert.notEqual(orderDoc.doc.contentMd, orderDocBefore.doc.contentMd)
  assert.equal(ctx.modules.listModules('rs-apply-split', true).find(module => module.id === seeded.order.id)?.title, '订单中心')

  // create：空 v1
  const created = ctx.modules.listModules('rs-apply-split').find(module => module.title === '售后管理')!
  const createdDoc = ctx.doc.ensureRequirementDoc('rs-apply-split', undefined, created.id)
  assert.equal(createdDoc.doc.version, 1)
  assert.equal(createdDoc.doc.status, 'draft')
  assert.equal(createdDoc.doc.title, '订单系统 · 售后管理 需求文档')
  assert.ok(createdDoc.sections.every(section => !section.markdown.trim()))

  // settings：kind=replan + 映射 + action；source 来自旧内容
  const applied = ctx.plan.readAppliedModulePlan('rs-apply-split')!
  assert.equal(applied.kind, 'replan')
  assert.equal(applied.instruction, '重新拆分')
  assert.equal(applied.modules.length, 3)
  assert.deepEqual(
    applied.modules.map(item => [item.title, item.action]),
    [
      ['商品管理', 'keep'],
      ['订单中心', 'regenerate'],
      ['售后管理', 'create']
    ]
  )
  const source = ctx.plan.readAppliedModulePlanSource('rs-apply-split')
  assert.ok(source.includes('商品'))
  assert.ok(source.includes('订单'))
  assert.ok(source.length <= 60000) // modulePlanSource 上限（生成 prompt 重新规划 60k）
  assert.notEqual(snapshot('rs-apply-split'), before)
  assert.equal(
    (ctx.db.prepare("SELECT COUNT(*) AS c FROM app_stage_events WHERE app_id = ? AND event = 'module-replan-applied'").get('rs-apply-split') as { c: number }).c,
    1
  )

  // apply 不生成文档：create 仍空（生成由 /generate 负责）
  const generated = ctx.db
    .prepare('SELECT version, source FROM app_requirement_doc_versions WHERE app_id = ? AND module_id = ? ORDER BY version')
    .all('rs-apply-split', created.id) as Array<{ version: number; source: string }>
  assert.deepEqual(generated.map(row => row.version), [1])
  assert.equal(generated[0].source, 'template-change')
})

test('applyModuleReplan（合并）：create 交易管理、旧模块归档；内容/版本保留、可恢复', () => {
  const ctx = context!
  const seeded = seedTwoModules('rs-apply-merge')
  const result = ctx.replan.applyModuleReplan('rs-apply-merge', {
    plan: replanRaw([
      { key: 'trade', title: '交易管理', description: '商品与订单合并', scope: ['商品', '订单'], existingModuleId: null, action: 'create' }
    ]),
    reopenConfirmed: false
  })
  assert.deepEqual(result.created.map(item => item.title), ['交易管理'])
  assert.deepEqual(result.archived.map(item => item.title).sort(), ['商品管理', '订单管理'].sort())
  assert.equal(result.modules.length, 1)
  assert.equal(result.generation.length, 1)

  const all = ctx.modules.listModules('rs-apply-merge', true)
  const product = all.find(module => module.id === seeded.product.id)!
  const order = all.find(module => module.id === seeded.order.id)!
  assert.equal(product.archived, true)
  assert.equal(order.archived, true)
  const productDoc = ctx.doc.ensureRequirementDoc('rs-apply-merge', undefined, seeded.product.id)
  assert.equal(productDoc.doc.version, seeded.product.version)
  assert.equal(productDoc.doc.contentMd, seeded.product.content)

  const trade = result.created[0]
  const tradeDoc = ctx.doc.ensureRequirementDoc('rs-apply-merge', undefined, trade.id)
  assert.equal(tradeDoc.doc.version, 1)
  const source = ctx.plan.readAppliedModulePlanSource('rs-apply-merge')
  assert.ok(source.includes('商品档案'))
  assert.ok(source.includes('订单创建'))

  // 可恢复
  ctx.modules.restoreModule('rs-apply-merge', seeded.product.id)
  assert.equal(ctx.modules.listModules('rs-apply-merge').length, 2)
})

test('applyModuleReplan（改名）：改标题/文档标题、不产版本、无生成；已确认需显式重开（清应用确认 + 设计退回 draft）', () => {
  const ctx = context!
  const seeded = seedTwoModules('rs-apply-rename')
  // 两个模块都确认（多模块确认不推进应用阶段）
  ctx.doc.confirmRequirementDoc('rs-apply-rename', seeded.product.id)
  ctx.doc.confirmRequirementDoc('rs-apply-rename', seeded.order.id)
  assert.equal(ctx.doc.ensureRequirementDoc('rs-apply-rename', undefined, seeded.product.id).doc.status, 'confirmed')
  const productBefore = ctx.doc.ensureRequirementDoc('rs-apply-rename', undefined, seeded.product.id)
  // 同模块已确认设计（验证重开）
  const now = new Date().toISOString()
  ctx.db
    .prepare(`
      INSERT INTO app_design_projects
        (app_id, module_id, prototype_template_id, status, version, source_doc_version,
         source_input_id, source_input_hash, created_at, updated_at, confirmed_at)
      VALUES (?, ?, 'proto-default', 'confirmed', 1, ?, NULL, NULL, ?, ?, ?)
    `)
    .run('rs-apply-rename', seeded.product.id, productBefore.doc.version, now, now, now)

  const plan = replanRaw([
    {
      key: 'product',
      title: '商品中心',
      description: '商品档案与商品明细',
      scope: ['商品档案', '商品明细'],
      existingModuleId: seeded.product.id,
      action: 'rename'
    },
    {
      key: 'order',
      title: '订单管理',
      description: '订单创建与查询',
      scope: ['订单创建', '订单查询'],
      existingModuleId: seeded.order.id,
      action: 'keep'
    }
  ])

  // 无 reopenConfirmed → 409 且不写
  const before = snapshot('rs-apply-rename')
  assert.throws(
    () => ctx.replan.applyModuleReplan('rs-apply-rename', { plan }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409)
      assert.match((error as Error).message, /允许重新打开已确认模块/)
      return true
    }
  )
  assert.equal(snapshot('rs-apply-rename'), before)
  assert.equal(ctx.doc.ensureRequirementDoc('rs-apply-rename', undefined, seeded.product.id).doc.status, 'confirmed')

  const result = ctx.replan.applyModuleReplan('rs-apply-rename', { plan, reopenConfirmed: true })
  assert.deepEqual(result.renamed.map(item => item.title), ['商品中心'])
  assert.deepEqual(result.kept.map(item => item.title), ['订单管理'])
  assert.deepEqual(result.reopened.map(item => item.title), ['商品管理'])
  assert.deepEqual(result.generation, [])

  const productAfter = ctx.doc.ensureRequirementDoc('rs-apply-rename', undefined, seeded.product.id)
  assert.equal(productAfter.doc.title, '订单系统 · 商品中心 需求文档')
  assert.equal(productAfter.doc.version, productBefore.doc.version) // rename 不产版本
  assert.equal(productAfter.doc.status, 'draft')
  assert.equal(productAfter.doc.confirmedAt, null)
  const orderAfter = ctx.doc.ensureRequirementDoc('rs-apply-rename', undefined, seeded.order.id)
  assert.equal(orderAfter.doc.status, 'confirmed') // keep 保留确认
  const app = ctx.db.prepare('SELECT status, requirements_confirmed_at FROM apps WHERE id = ?').get('rs-apply-rename') as {
    status: string
    requirements_confirmed_at: string | null
  }
  assert.equal(app.status, 'requirements')
  assert.equal(app.requirements_confirmed_at, null)
  const design = ctx.db
    .prepare('SELECT status, confirmed_at FROM app_design_projects WHERE app_id = ? AND module_id = ?')
    .get('rs-apply-rename', seeded.product.id) as { status: string; confirmed_at: string | null }
  assert.equal(design.status, 'draft')
  assert.equal(design.confirmed_at, null)
})

test('applyModuleReplan：keep 已确认模块保持 confirmed；全 keep 无生成直接完成', () => {
  const ctx = context!
  const seeded = seedTwoModules('rs-keep-confirmed')
  ctx.doc.confirmRequirementDoc('rs-keep-confirmed', seeded.product.id)
  ctx.doc.confirmRequirementDoc('rs-keep-confirmed', seeded.order.id)
  const before = ctx.doc.ensureRequirementDoc('rs-keep-confirmed', undefined, seeded.product.id)

  const result = ctx.replan.applyModuleReplan('rs-keep-confirmed', {
    plan: replanRaw([
      {
        key: 'product',
        title: '商品管理',
        description: '商品档案与商品明细',
        scope: ['商品档案', '商品明细'],
        existingModuleId: seeded.product.id,
        action: 'keep'
      },
      {
        key: 'order',
        title: '订单管理',
        description: '订单创建与查询',
        scope: ['订单创建', '订单查询'],
        existingModuleId: seeded.order.id,
        action: 'keep'
      }
    ])
  })
  assert.deepEqual(result.reopened, [])
  assert.deepEqual(result.generation, [])
  const after = ctx.doc.ensureRequirementDoc('rs-keep-confirmed', undefined, seeded.product.id)
  assert.equal(after.doc.status, 'confirmed')
  assert.equal(after.doc.version, before.doc.version)
  assert.equal(after.doc.contentMd, before.doc.contentMd)
})

test('守卫：设计/开发阶段、active Change Set、应用级最终确认、无模块 → 409；非法计划 400 且不写', () => {
  const ctx = context!
  newApp('rs-guard-design', '设计应用', 'design')
  assert.throws(
    () => ctx.replan.applyModuleReplan('rs-guard-design', { plan: replanRaw([{ key: 'a', title: 'A', existingModuleId: null, action: 'create', scope: [] }]) }),
    (error: unknown) => (error as { status?: number }).status === 409
  )
  assert.equal(ctx.replan.replanEligibility('rs-guard-design').reason, 'stage')

  newApp('rs-guard-dev', '开发应用', 'development')
  assert.equal(ctx.replan.replanEligibility('rs-guard-dev').reason, 'stage')

  newApp('rs-guard-cs')
  const now = new Date().toISOString()
  ctx.db
    .prepare(
      `INSERT INTO app_change_sets (id, app_id, seq, title, description, scope, status, created_at, updated_at)
       VALUES ('cs-rs-guard', 'rs-guard-cs', 2, '变更', NULL, 'requirements', 'requirements', ?, ?)`
    )
    .run(now, now)
  assert.equal(ctx.replan.replanEligibility('rs-guard-cs').reason, 'change-set')

  newApp('rs-guard-final')
  ctx.db.prepare('UPDATE apps SET requirements_confirmed_at = ? WHERE id = ?').run(now, 'rs-guard-final')
  assert.equal(ctx.replan.replanEligibility('rs-guard-final').reason, 'confirmed')

  newApp('rs-guard-nomodule')
  ctx.db.prepare('DELETE FROM app_modules WHERE app_id = ?').run('rs-guard-nomodule')
  assert.equal(ctx.replan.replanEligibility('rs-guard-nomodule').reason, 'no-module')

  const seeded = seedTwoModules('rs-guard-invalid')
  const before = snapshot('rs-guard-invalid')
  assert.throws(
    () =>
      ctx.replan.applyModuleReplan('rs-guard-invalid', {
        plan: replanRaw([
          { key: 'a', title: '同名', existingModuleId: null, action: 'create', scope: [] },
          { key: 'b', title: '同名', existingModuleId: null, action: 'create', scope: [] }
        ])
      }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 400)
      return true
    }
  )
  assert.equal(snapshot('rs-guard-invalid'), before)
  assert.ok(seeded.product.id)

  // 需求全空 + 需要生成 → fail-closed 409，不建模块/不写设置
  newApp('rs-guard-empty')
  const emptyBefore = snapshot('rs-guard-empty')
  assert.throws(
    () =>
      ctx.replan.applyModuleReplan('rs-guard-empty', {
        plan: replanRaw([{ key: 'a', title: '新模块', existingModuleId: null, action: 'create', scope: [] }])
      }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409)
      assert.match((error as Error).message, /需求内容为空/)
      return true
    }
  )
  assert.equal(snapshot('rs-guard-empty'), emptyBefore)
})

test('生成扩展：replan 需要 plan+source+moduleIds、只生成 create/regenerate、keep/rename 拒绝；生成后 draft/ai，retry 可用', async () => {
  const ctx = context!
  const seeded = seedTwoModules('rs-gen')
  const applied = ctx.replan.applyModuleReplan('rs-gen', {
    plan: replanRaw([
      { key: 'product', title: '商品管理', description: '商品档案与商品明细', scope: ['商品档案', '商品明细'], existingModuleId: seeded.product.id, action: 'keep' },
      {
        key: 'order',
        title: '订单中心',
        description: '下单与查询',
        scope: ['订单创建', '订单查询'],
        existingModuleId: seeded.order.id,
        action: 'regenerate'
      },
      { key: 'aftersale', title: '售后管理', description: '售后', scope: ['售后申请'], existingModuleId: null, action: 'create' }
    ])
  })
  const orderId = applied.regenerated[0].id
  const aftersaleId = applied.created[0].id

  // 缺 moduleIds → 400
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('rs-gen', { reason: 'replan' }),
    (error: unknown) => (error as { status?: number }).status === 400
  )
  // initial 在 replan 后 → 409
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('rs-gen', { reason: 'initial' }),
    (error: unknown) => (error as { status?: number }).status === 409
  )
  // keep 模块不能生成
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('rs-gen', { reason: 'replan', moduleIds: [seeded.product.id] }),
    (error: unknown) => (error as { status?: number }).status === 400
  )
  // 未知模块 → 400
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('rs-gen', { reason: 'replan', moduleIds: ['missing'] }),
    (error: unknown) => (error as { status?: number }).status === 400
  )

  const prepared = ctx.generation.prepareModuleGeneration('rs-gen', { reason: 'replan', moduleIds: [orderId, aftersaleId] })
  assert.equal(prepared.reason, 'replan')
  assert.equal(prepared.plan?.kind, 'replan')
  assert.equal(prepared.modules.length, 2)
  assert.ok(prepared.source.includes('商品档案'))

  const prompt = ctx.generation.buildModuleGeneratePrompt({
    appName: prepared.appName,
    template: ctx.doc.ensureRequirementDoc('rs-gen', undefined, orderId).template,
    source: prepared.source,
    plan: prepared.plan,
    modules: prepared.modules,
    module: prepared.modules[0]
  })
  assert.ok(prompt.includes('当前全部需求（重新规划聚合摘要）'))
  assert.ok(prompt.includes('订单中心'))
  assert.ok(prompt.includes('售后管理'))
  assert.ok(prompt.includes('只写这个模块'))

  const failedRun = await ctx.generation.runModuleGeneration(prepared, {
    generator: async input => {
      if (input.module.id === aftersaleId) throw new Error('售后生成失败')
      return JSON.stringify({ sections: [{ id: 'problem', markdown: `${input.module.title} 生成内容` }] })
    }
  })
  assert.equal(failedRun.ok, false)
  assert.equal(failedRun.failed.length, 1)
  assert.equal(failedRun.failed[0].moduleId, aftersaleId)
  const orderDoc = ctx.doc.ensureRequirementDoc('rs-gen', undefined, orderId)
  assert.equal(orderDoc.doc.version, seeded.order.version + 1)
  assert.equal(orderDoc.doc.status, 'draft')
  const orderVersion = ctx.db
    .prepare('SELECT source FROM app_requirement_doc_versions WHERE app_id = ? AND module_id = ? AND version = ?')
    .get('rs-gen', orderId, orderDoc.doc.version) as { source: string }
  assert.equal(orderVersion.source, 'ai')

  // 重试失败模块（replan 后 retry 只能用于 create/regenerate）
  const failedId = failedRun.failed[0].moduleId
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('rs-gen', { reason: 'retry', moduleIds: [seeded.product.id] }),
    (error: unknown) => (error as { status?: number }).status === 400
  )
  const retry = ctx.generation.prepareModuleGeneration('rs-gen', { reason: 'retry', moduleIds: [failedId] })
  const retried = await ctx.generation.runModuleGeneration(retry, {
    generator: async input => (input.module.id === aftersaleId
      ? JSON.stringify({ sections: [{ id: 'problem', markdown: '售后 重试内容' }] })
      : JSON.stringify({ sections: [{ id: 'problem', markdown: 'unexpected' }] }))
  })
  assert.equal(retried.ok, true)
  const aftersaleDoc = ctx.doc.ensureRequirementDoc('rs-gen', undefined, aftersaleId)
  assert.equal(aftersaleDoc.doc.version, 2)
  assert.ok(aftersaleDoc.doc.contentMd.includes('售后 重试内容'))

  // keep 模块仍没有生成（v1 空）
  const productDoc = ctx.doc.ensureRequirementDoc('rs-gen', undefined, seeded.product.id)
  assert.equal(productDoc.doc.version, seeded.product.version)
})
