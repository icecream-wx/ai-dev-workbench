/**
 * 首次模块规划（RMP-1）：协议解析/校验、首次守卫、建议卡应用。
 *
 * 用临时 RG_DATA_DIR 启动真实 src/db；每个用例独立 app id；不调用真实模型。
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
  settings: typeof import('../db')
}

let context: Context | null = null

before(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-module-plan-'))
  process.env.RG_DATA_DIR = path.join(root, 'data')
  process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
  const dbModule = await import('../db')
  const doc = await import('./doc')
  const modules = await import('./modules')
  const plan = await import('./module-plan')
  context = { root, db: dbModule.db, doc, modules, plan, settings: dbModule }
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
  'app_settings'
]

async function newApp(id: string, name = '订单系统', status = 'requirements'): Promise<Context> {
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

const PLAN_RAW = {
  kind: 'initial',
  modules: [
    {
      key: 'product',
      title: '商品管理',
      description: '商品与商品明细',
      scope: ['商品档案 CRUD', '商品明细 CRUD'],
      suggestedEpics: [{ title: '商品档案', stories: ['商品列表', '新增商品'] }],
      existingModuleId: null,
      action: 'create'
    },
    {
      key: 'order',
      title: '订单管理',
      description: '选商品生成订单，不做支付',
      scope: ['订单创建', '订单查询', '不涉及：支付'],
      suggestedEpics: [{ title: '订单创建', stories: ['选择商品生成订单'] }],
      existingModuleId: null,
      action: 'create'
    }
  ],
  dependencies: [{ from: 'order', to: 'product', description: '订单引用商品 N:1，不重复建商品实体' }],
  coverage: [
    { requirement: '商品 CRUD', moduleKey: 'product' },
    { requirement: '订单', moduleKey: 'order' }
  ],
  unassigned: [{ requirement: '订单状态机', reason: '需求未明确' }],
  openIssues: ['是否需要库存扣减？'],
  warnings: ['未生成支付模块（符合“不做支付”）']
}

test('splitModulePlanOutput：容错代码块/尾逗号并拆出回复与计划', () => {
  const ctx = context!
  const raw = [
    '建议拆成商品管理与订单管理两个业务域。',
    ctx.plan.MODULE_PLAN_DELIMITER,
    '```json',
    JSON.stringify(PLAN_RAW).replace('}]', '},]'),
    '```'
  ].join('\n')
  const parsed = ctx.plan.splitModulePlanOutput(raw)
  assert.equal(parsed.error, '')
  assert.match(parsed.reply, /商品管理与订单管理/)
  assert.equal(parsed.plan?.modules.length, 2)
  assert.equal(parsed.plan?.modules[0].title, '商品管理')
  assert.deepEqual(parsed.plan?.dependencies, PLAN_RAW.dependencies)
})

test('splitModulePlanOutput：无法解析/空 modules 返回可读错误且没有计划', () => {
  const ctx = context!
  const broken = ctx.plan.splitModulePlanOutput('随便说说，没有 JSON')
  assert.equal(broken.plan, null)
  assert.match(broken.error, /MODULE_PLAN_JSON/)
  const empty = ctx.plan.splitModulePlanOutput(`${ctx.plan.MODULE_PLAN_DELIMITER}\n{"kind":"initial","modules":[]}`)
  assert.equal(empty.plan, null)
  assert.match(empty.error, /modules/)
})

test('validateModulePlan：标题非空唯一、existingModuleId/action 固定、CRUD 标题与数量 warning', () => {
  const ctx = context!
  const base = ctx.plan.normalizeModulePlan(PLAN_RAW)
  assert.deepEqual(ctx.plan.validateModulePlan(base).errors, [])

  const dup = ctx.plan.normalizeModulePlan({
    modules: [
      { title: '商品管理', key: 'a' },
      { title: '商品管理', key: 'b' }
    ]
  })
  const dupResult = ctx.plan.validateModulePlan(dup)
  assert.ok(dupResult.errors.some(item => item.includes('重复')))

  const emptyTitle = ctx.plan.normalizeModulePlan({ modules: [{ key: 'a', title: '' }] })
  assert.ok(ctx.plan.validateModulePlan(emptyTitle).errors.some(item => item.includes('标题为空')))

  const noModules = ctx.plan.normalizeModulePlan({ modules: [] })
  assert.ok(ctx.plan.validateModulePlan(noModules).errors.some(item => item.includes('至少需要 1 个模块')))

  const tooMany = ctx.plan.normalizeModulePlan({
    modules: Array.from({ length: ctx.plan.MAX_PLAN_MODULES + 1 }, (_, index) => ({ key: `k${index}`, title: `模块${index}` }))
  })
  assert.ok(ctx.plan.validateModulePlan(tooMany).errors.some(item => item.includes('技术上限')))

  const replan = ctx.plan.normalizeModulePlan({
    modules: [{ key: 'a', title: '订单管理', existingModuleId: 'mod-1', action: 'rename' }]
  })
  const replanResult = ctx.plan.validateModulePlan(replan)
  assert.ok(replanResult.errors.some(item => item.includes('existingModuleId')))
  assert.ok(replanResult.errors.some(item => item.includes('action')))

  const crud = ctx.plan.normalizeModulePlan({ modules: [{ key: 'a', title: '新增商品' }] })
  assert.ok(ctx.plan.validateModulePlan(crud).warnings.some(item => item.includes('CRUD')))

  const many = ctx.plan.normalizeModulePlan({
    modules: Array.from({ length: 9 }, (_, index) => ({ key: `k${index}`, title: `业务域${index}` }))
  })
  assert.ok(ctx.plan.validateModulePlan(many).warnings.some(item => item.includes('耗时')))
})

test('模块规划 prompt：包含模板章节、拆分规则、分隔符与“只规划不写文档”', async () => {
  const ctx = context!
  const prompt = await import('../chat/module-plan-prompt')
  ctx.db.prepare('DELETE FROM apps WHERE id = ?').run('prompt-app')
  const now = new Date().toISOString()
  ctx.db
    .prepare(
      `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
       VALUES ('prompt-app', '订单系统', NULL, 'prompt-app', 8081, 'requirements', ?, ?)`
    )
    .run(now, now)
  const freshContext = ctx.doc.loadDocChatContext('prompt-app')
  const text = prompt.buildModulePlanChatPrompt(freshContext, [{ role: 'user', content: '做一个订单系统' }])
  assert.ok(text.includes(ctx.plan.MODULE_PLAN_DELIMITER))
  assert.ok(text.includes('只规划、不写文档'))
  assert.ok(text.includes('禁止按 CRUD'))
  assert.ok(text.includes('商品管理'))
  assert.ok(text.includes('当前模块'))
  assert.ok(text.includes('模板'))
})

test('首次守卫：空默认模块可规划；文档有内容/多模块/非需求阶段/变更中均不满足', async () => {
  const ctx = await newApp('plan-eligible')
  const eligibility = ctx.plan.initialPlanEligibility('plan-eligible')
  assert.equal(eligibility.eligible, true)
  assert.equal(eligibility.moduleTitle, '订单系统')

  ctx.doc.saveDocSection('plan-eligible', 'problem', { markdown: '已有内容' })
  const notEmpty = ctx.plan.initialPlanEligibility('plan-eligible')
  assert.equal(notEmpty.eligible, false)
  assert.equal(notEmpty.reason, 'doc-not-empty')

  await newApp('plan-multi')
  ctx.modules.createModule('plan-multi', { title: '第二个模块' })
  const multi = ctx.plan.initialPlanEligibility('plan-multi')
  assert.equal(multi.eligible, false)
  assert.equal(multi.reason, 'module-count')

  await newApp('plan-design', '设计应用', 'design')
  const design = ctx.plan.initialPlanEligibility('plan-design')
  assert.equal(design.eligible, false)
  assert.equal(design.reason, 'stage')

  await newApp('plan-change')
  const now = new Date().toISOString()
  ctx.db
    .prepare(
      `INSERT INTO app_change_sets (id, app_id, seq, title, description, scope, status, created_at, updated_at)
       VALUES ('cs-plan-change', 'plan-change', 2, '变更', NULL, 'requirements', 'requirements', ?, ?)`
    )
    .run(now, now)
  const changing = ctx.plan.initialPlanEligibility('plan-change')
  assert.equal(changing.eligible, false)
  assert.equal(changing.reason, 'change-set')
})

test('applyModulePlan：复用默认模块 + 新建其余；标题/position/key/文档标题/设置正确', async () => {
  const ctx = await newApp('plan-apply')
  const defaultRow = ctx.modules.defaultModule('plan-apply')!
  ctx.settings.writeSetting(`app.plan-apply.requirementsDocChat.${defaultRow.id}`, {
    messages: [
      { role: 'user', content: '做一个订单管理系统，商品明细归商品管理，不做支付' },
      { role: 'assistant', content: '建议拆成两个模块' }
    ]
  })

  const result = ctx.plan.applyModulePlan('plan-apply', PLAN_RAW)
  assert.equal(result.modules.length, 2)
  assert.equal(result.reused?.id, defaultRow.id)
  assert.equal(result.reused?.moduleKey, 'MOD-001')
  assert.equal(result.created.length, 1)
  assert.equal(result.created[0].moduleKey, 'MOD-002')
  assert.equal(result.created[0].position, 1)
  assert.deepEqual(
    result.generation.map(item => item.title),
    ['商品管理', '订单管理']
  )

  const list = ctx.modules.listModules('plan-apply')
  assert.deepEqual(
    list.map(item => [item.moduleKey, item.title, item.position]),
    [
      ['MOD-001', '商品管理', 0],
      ['MOD-002', '订单管理', 1]
    ]
  )
  const first = ctx.doc.ensureRequirementDoc('plan-apply', undefined, defaultRow.id)
  assert.equal(first.doc.title, '订单系统 · 商品管理 需求文档')
  assert.equal(first.doc.version, 1)
  assert.ok(first.sections.every(section => !section.markdown.trim()))
  assert.ok(first.doc.contentMd.includes('# 订单系统 · 商品管理 需求文档'))
  const second = ctx.doc.ensureRequirementDoc('plan-apply', undefined, result.created[0].id)
  assert.equal(second.doc.title, '订单系统 · 订单管理 需求文档')

  const applied = ctx.plan.readAppliedModulePlan('plan-apply')
  assert.ok(applied)
  assert.equal(applied?.modules.length, 2)
  assert.equal(applied?.modules[1].moduleId, result.created[0].id)
  assert.equal(applied?.modules[1].title, '订单管理')
  assert.equal(ctx.plan.readAppliedModulePlanSource('plan-apply'), '做一个订单管理系统，商品明细归商品管理，不做支付')

  // 初始对话仍在默认模块（apply 不删除/不改写）
  const chat = ctx.settings.readSetting<{ messages: Array<{ role: string; content: string }> }>(
    `app.plan-apply.requirementsDocChat.${defaultRow.id}`
  )
  assert.equal(chat?.messages.length, 2)

  const afterApply = ctx.plan.initialPlanEligibility('plan-apply')
  assert.equal(afterApply.eligible, false)
  assert.equal(afterApply.reason, 'module-count')

  assert.throws(() => ctx.plan.applyModulePlan('plan-apply', PLAN_RAW), (error: unknown) => {
    const typed = error as { status?: number }
    assert.equal(typed.status, 409)
    return true
  })
  assert.equal(ctx.modules.listModules('plan-apply').length, 2)
})

test('applyModulePlan：文档已有内容/非法计划返回错误且不写库', async () => {
  const ctx = await newApp('plan-guard')
  ctx.doc.saveDocSection('plan-guard', 'problem', { markdown: '手动内容' })
  const before = ctx.modules.listModules('plan-guard').length
  assert.throws(() => ctx.plan.applyModulePlan('plan-guard', PLAN_RAW), (error: unknown) => {
    const typed = error as { status?: number }
    assert.equal(typed.status, 409)
    return true
  })
  assert.equal(ctx.modules.listModules('plan-guard').length, before)

  await newApp('plan-invalid')
  assert.throws(
    () => ctx.plan.applyModulePlan('plan-invalid', { modules: [{ title: 'A' }, { title: 'A' }] }),
    (error: unknown) => {
      const typed = error as { status?: number }
      assert.equal(typed.status, 400)
      return true
    }
  )
  assert.equal(ctx.modules.listModules('plan-invalid').length, 1)
})

test('applyModulePlan：source 截断并可显式覆盖（生成 prompt 取用）', async () => {
  const ctx = await newApp('plan-source')
  const source = '需求'.repeat(40_000)
  ctx.plan.applyModulePlan('plan-source', PLAN_RAW, { source })
  const stored = ctx.plan.readAppliedModulePlanSource('plan-source')
  assert.ok(stored.length <= ctx.plan.MAX_PLAN_SOURCE_CHARS)
})

test('MF6：无原始需求（聊天未落盘/空 source）apply 409 且不写模块/settings/事件', async () => {
  const ctx = await newApp('plan-no-source')
  const docBefore = ctx.doc.ensureRequirementDoc('plan-no-source')
  const eventCount = (): number =>
    (
      ctx.db
        .prepare("SELECT COUNT(*) AS c FROM app_stage_events WHERE app_id = ? AND event = 'module-plan-applied'")
        .get('plan-no-source') as { c: number }
    ).c

  assert.throws(
    () => ctx.plan.applyModulePlan('plan-no-source', PLAN_RAW),
    (error: unknown) => {
      const typed = error as { status?: number; message?: string }
      assert.equal(typed.status, 409)
      assert.match(String(typed.message), /缺少原始需求记录/)
      return true
    }
  )
  // 空白 source 也视为空
  assert.throws(
    () => ctx.plan.applyModulePlan('plan-no-source', PLAN_RAW, { source: '   \n ' }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409)
      return true
    }
  )

  assert.equal(ctx.modules.listModules('plan-no-source').length, 1)
  assert.equal(
    (ctx.db.prepare('SELECT COUNT(*) AS c FROM app_modules WHERE app_id = ?').get('plan-no-source') as { c: number }).c,
    1
  )
  assert.equal(ctx.plan.readAppliedModulePlan('plan-no-source'), null)
  assert.equal(ctx.settings.readSetting('app.plan-no-source.modulePlanApplied'), null)
  assert.equal(ctx.settings.readSetting('app.plan-no-source.modulePlanSource'), null)
  assert.equal(eventCount(), 0)
  const docAfter = ctx.doc.ensureRequirementDoc('plan-no-source')
  assert.equal(docAfter.doc.version, docBefore.doc.version)
  assert.equal(docAfter.doc.contentMd, docBefore.doc.contentMd)
  assert.equal(docAfter.doc.title, docBefore.doc.title)

  // 有显式 source 时正常 apply（正常行为不变）
  const applied = ctx.plan.applyModulePlan('plan-no-source', PLAN_RAW, { source: '  用户需求：商品与订单  ' })
  assert.equal(applied.modules.length, 2)
  assert.equal(ctx.plan.readAppliedModulePlanSource('plan-no-source').trim(), '用户需求：商品与订单')
  assert.equal(eventCount(), 1)
})
