/**
 * 逐模块生成（RMP-1）：生成守卫/prompt/DOC_JSON 应用/失败继续/重试/取消。
 *
 * 全部用注入 generator（不调用真实模型/opencode）；opencode runtime 不被触达。
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
  generation: typeof import('./module-generation')
  settings: typeof import('../db')
}

let context: Context | null = null

before(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-module-generation-'))
  process.env.RG_DATA_DIR = path.join(root, 'data')
  process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
  process.env.OPENCODE_AUTO_START = 'false'
  const dbModule = await import('../db')
  const doc = await import('./doc')
  const modules = await import('./modules')
  const plan = await import('./module-plan')
  const generation = await import('./module-generation')
  context = { root, db: dbModule.db, doc, modules, plan, generation, settings: dbModule }
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

const PLAN_RAW = {
  kind: 'initial',
  modules: [
    { key: 'product', title: '商品管理', description: '商品与明细', scope: ['商品档案', '商品明细'], action: 'create', existingModuleId: null },
    { key: 'order', title: '订单管理', description: '选商品生成订单', scope: ['订单创建', '不涉及：支付'], action: 'create', existingModuleId: null }
  ],
  dependencies: [{ from: 'order', to: 'product', description: '订单引用商品 N:1' }],
  coverage: [{ requirement: '商品', moduleKey: 'product' }],
  unassigned: [],
  openIssues: [],
  warnings: []
}

async function newPlannedApp(id: string, name = '订单系统'): Promise<{
  ctx: Context
  modules: Array<{ id: string; title: string }>
}> {
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
       VALUES (?, ?, NULL, ?, 8081, 'requirements', ?, ?)`
    )
    .run(id, name, id, now, now)
  ctx.doc.ensureRequirementDoc(id)
  const applied = ctx.plan.applyModulePlan(id, PLAN_RAW, { source: '商品与订单需求：商品明细归商品管理，不做支付' })
  return { ctx, modules: applied.generation.map(item => ({ id: item.moduleId, title: item.title })) }
}

async function newEmptyApp(id: string, status = 'requirements'): Promise<Context> {
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
       VALUES (?, '空应用', NULL, ?, 8081, ?, ?, ?)`
    )
    .run(id, id, status, now, now)
  ctx.doc.ensureRequirementDoc(id)
  return ctx
}

/** 两个模块各生成一份完整 Markdown（标题与模板章节标题一致） */
function docMarkdown(title: string, tag: string): string {
  return [
    `# ${title}`,
    '',
    '## 问题与机会',
    `${tag} 的问题描述。`,
    '',
    '## 业务目标与成功指标',
    `${tag} 目标。`,
    '',
    '## 用户与角色',
    '- 业务员',
    '',
    '## 业务场景',
    '- 场景一：日常处理',
    '',
    '## Epics & User Stories',
    '- 作为业务员，我希望完成日常工作，以便提升效率',
    '',
    '## 业务规则与数据',
    `${tag} 规则说明。`,
    '',
    '## 页面与交互',
    '- 列表页',
    '',
    '## 非功能需求',
    '- 无特殊要求',
    '',
    '## 待澄清问题',
    '- 无',
    '',
    '## 术语表',
    '- 无',
    '',
    '## 验收标准',
    '- 验收通过'
  ].join('\n')
}

function structuredDoc(title: string, tag: string, epicId: string): string {
  return JSON.stringify({
    doc: docMarkdown(title, tag),
    sections: [
      {
        id: 'epics',
        data: {
          scenes: [],
          epics: [
            { id: epicId, title: `${tag}任务`, goal: `${tag}目标`, stories: [{ id: `${epicId}-S`, title: `${tag}故事`, acceptance: ['完成'] }] }
          ],
          stories: []
        }
      }
    ]
  })
}

test('prepareModuleGeneration：initial 默认生成计划全部模块；single/retry/守卫错误', async () => {
  const { ctx, modules } = await newPlannedApp('gen-prepare')
  const prepared = ctx.generation.prepareModuleGeneration('gen-prepare', { reason: 'initial' })
  assert.deepEqual(
    prepared.modules.map(item => item.id),
    modules.map(item => item.id)
  )
  assert.ok(prepared.plan)
  assert.equal(prepared.source.includes('不做支付'), true)

  // MF1：已拆分（2 模块）不能再按“保持单模块”生成
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('gen-prepare', { reason: 'single', moduleIds: [modules[0].id] }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409)
      return true
    }
  )
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('gen-prepare', { reason: 'single' }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409)
      return true
    }
  )
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('gen-prepare', { reason: 'retry' }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 400)
      return true
    }
  )
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('gen-prepare', { reason: 'initial', moduleIds: ['missing-module'] }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 400)
      return true
    }
  )

  await newEmptyApp('gen-no-plan')
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('gen-no-plan', { reason: 'initial' }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409)
      return true
    }
  )
  await newEmptyApp('gen-design', 'design')
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('gen-design', { reason: 'single' }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409)
      return true
    }
  )
})

test('buildModuleGeneratePrompt：只聚焦当前模块，带依赖/范围/协议，不含其它模块功能正文', async () => {
  const { ctx, modules } = await newPlannedApp('gen-prompt')
  const prepared = ctx.generation.prepareModuleGeneration('gen-prompt', { reason: 'initial', moduleIds: [modules[1].id] })
  const payload = ctx.doc.ensureRequirementDoc('gen-prompt', undefined, modules[1].id)
  const text = ctx.generation.buildModuleGeneratePrompt({
    appName: prepared.appName,
    template: payload.template,
    source: prepared.source,
    plan: prepared.plan,
    modules: prepared.modules,
    module: prepared.modules[0]
  })
  assert.ok(text.includes('订单管理'))
  assert.ok(text.includes('商品管理')) // 作为边界/依赖出现
  assert.ok(text.includes('订单引用商品 N:1'))
  assert.ok(text.includes('只写这个模块'))
  assert.ok(text.includes('不涉及：支付'))
  assert.ok(text.includes('<<<DOC_JSON>>>'))
  assert.ok(text.includes('省略 ID'))
})

test('parseDocJsonOutput：容错代码块/尾逗号；没有 doc/sections 返回 null', async () => {
  const { ctx } = await newPlannedApp('gen-parse')
  const raw = ['说明', '<<<DOC_JSON>>>', '```json', '{"doc":"# 标题\\n\\n## 问题与机会\\n内容",}', '```'].join('\n')
  const parsed = ctx.generation.parseDocJsonOutput(raw)
  assert.ok(parsed?.doc?.startsWith('# 标题'))
  assert.equal(ctx.generation.parseDocJsonOutput('<<<DOC_JSON>>>\n{"title":"x"}'), null)
  assert.equal(ctx.generation.parseDocJsonOutput('没有协议'), null)
})

test('runModuleGeneration：顺序生成两个模块，版本 ai、draft、不确认，ID 全局分配', async () => {
  const { ctx, modules } = await newPlannedApp('gen-run')
  const prepared = ctx.generation.prepareModuleGeneration('gen-run', { reason: 'initial' })
  const events: Array<{ type: string; moduleId?: string; index?: number; total?: number; version?: number }> = []
  const prompts: string[] = []
  const result = await ctx.generation.runModuleGeneration(prepared, {
    onEvent: event => events.push(event),
    generator: async input => {
      prompts.push(input.prompt)
      const tag = input.module.title === '商品管理' ? '商品' : '订单'
      // 两个模块都故意返回同一个 EPIC-001：第二个必须被后端改分配
      return structuredDoc(input.module.title, tag, 'EPIC-001')
    }
  })
  assert.equal(result.ok, true)
  assert.equal(result.failed.length, 0)
  assert.deepEqual(
    events.map(event => event.type),
    ['module-start', 'module-done', 'module-start', 'module-done', 'all-done']
  )
  assert.equal(events[1].version, 2)
  assert.equal(events[3].version, 2)
  assert.equal(prompts.length, 2)
  assert.ok(prompts[0].includes('商品管理'))
  assert.ok(prompts[1].includes('订单管理'))

  const first = ctx.doc.ensureRequirementDoc('gen-run', undefined, modules[0].id)
  const second = ctx.doc.ensureRequirementDoc('gen-run', undefined, modules[1].id)
  assert.equal(first.doc.version, 2)
  assert.equal(second.doc.version, 2)
  assert.equal(first.doc.status, 'draft')
  assert.equal(second.doc.status, 'draft')
  assert.equal(first.doc.confirmedAt, null)

  const versions = ctx.db
    .prepare('SELECT module_id, version, source FROM app_requirement_doc_versions WHERE app_id = ? ORDER BY version, module_id')
    .all('gen-run') as Array<{ module_id: string; version: number; source: string }>
  assert.ok(versions.some(row => row.module_id === modules[0].id && row.version === 2 && row.source === 'ai'))
  assert.ok(versions.some(row => row.module_id === modules[1].id && row.version === 2 && row.source === 'ai'))

  const epicIds = [first, second].map(payload => {
    const epics = payload.sections.find(section => section.kind === 'epics')?.data?.epics ?? []
    return epics[0]?.id
  })
  assert.ok(epicIds.every(id => typeof id === 'string' && /^EPIC-\d+$/.test(id)))
  assert.notEqual(epicIds[0], epicIds[1])

  // 只写各自模块（互不污染）
  assert.ok(first.doc.contentMd.includes('商品'))
  assert.equal(first.doc.contentMd.includes('订单规则'), false)
})

test('runModuleGeneration：单模块失败不中断其它模块；all-done ok=false，可重试失败模块', async () => {
  const { ctx, modules } = await newPlannedApp('gen-fail')
  const prepared = ctx.generation.prepareModuleGeneration('gen-fail', { reason: 'initial' })
  const events: Array<{ type: string; moduleId?: string; error?: string }> = []
  let attempt = 0
  const result = await ctx.generation.runModuleGeneration(prepared, {
    onEvent: event => events.push(event),
    generator: async input => {
      attempt += 1
      if (attempt === 1) throw new Error('模拟模型失败')
      return JSON.stringify({ doc: docMarkdown(input.module.title, '订单') })
    }
  })
  assert.equal(result.ok, false)
  assert.equal(result.failed.length, 1)
  assert.deepEqual(
    events.map(event => event.type),
    ['module-start', 'module-error', 'module-start', 'module-done', 'all-done']
  )
  assert.equal(events.filter(event => event.type === 'all-done')[0].cancelled, false)
  const first = ctx.doc.ensureRequirementDoc('gen-fail', undefined, modules[0].id)
  const second = ctx.doc.ensureRequirementDoc('gen-fail', undefined, modules[1].id)
  assert.equal(first.doc.version, 1)
  assert.equal(second.doc.version, 2)

  const retry = ctx.generation.prepareModuleGeneration('gen-fail', { reason: 'retry', moduleIds: [modules[0].id] })
  const retryEvents: Array<{ type: string; moduleId?: string }> = []
  const retryResult = await ctx.generation.runModuleGeneration(retry, {
    onEvent: event => retryEvents.push(event),
    generator: async input => JSON.stringify({ doc: docMarkdown(input.module.title, '商品') })
  })
  assert.equal(retryResult.ok, true)
  assert.deepEqual(
    retryEvents.map(event => event.type),
    ['module-start', 'module-done', 'all-done']
  )
  assert.equal(ctx.doc.ensureRequirementDoc('gen-fail', undefined, modules[0].id).doc.version, 2)
})

test('runModuleGeneration：取消中止当前生成，已完成保留、未开始不产生事件', async () => {
  const { ctx, modules } = await newPlannedApp('gen-cancel')
  const prepared = ctx.generation.prepareModuleGeneration('gen-cancel', { reason: 'initial' })
  const controller = new AbortController()
  const events: Array<{ type: string; cancelled?: boolean }> = []
  const result = await ctx.generation.runModuleGeneration(prepared, {
    signal: controller.signal,
    onEvent: event => events.push(event),
    generator: async () => {
      controller.abort()
      throw new Error('AI 生成已中止')
    }
  })
  assert.equal(result.cancelled, true)
  assert.equal(result.failed.length, 0)
  assert.deepEqual(
    events.map(event => event.type),
    ['module-start', 'all-done']
  )
  assert.equal(events[1].cancelled, true)
  assert.equal(ctx.doc.ensureRequirementDoc('gen-cancel', undefined, modules[0].id).doc.version, 1)
  assert.equal(ctx.doc.ensureRequirementDoc('gen-cancel', undefined, modules[1].id).doc.version, 1)
})

test('prepareModuleGeneration：归档模块 409', async () => {
  const { ctx, modules } = await newPlannedApp('gen-guard')
  ctx.modules.archiveModule('gen-guard', modules[0].id)
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('gen-guard', { reason: 'retry', moduleIds: [modules[0].id] }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409)
      return true
    }
  )
})

test('MF1：单模块失败后 retry 成功（无 plan）；拆分后 single 409；无 plan 多模块 retry 409', async () => {
  const ctx = await newEmptyApp('mf1-single')
  const module = ctx.modules.listModules('mf1-single')[0]
  const prepared = ctx.generation.prepareModuleGeneration('mf1-single', { reason: 'single', moduleIds: [module.id] })
  assert.equal(prepared.plan, null)
  assert.equal(prepared.modules.length, 1)
  assert.equal(prepared.modules[0].id, module.id)

  const failed = await ctx.generation.runModuleGeneration(prepared, {
    generator: async () => {
      throw new Error('模拟单模块失败')
    }
  })
  assert.equal(failed.ok, false)
  assert.equal(ctx.doc.ensureRequirementDoc('mf1-single', undefined, module.id).doc.version, 1)

  // 无规划的单模块 retry（保持单模块失败后重试）
  const retry = ctx.generation.prepareModuleGeneration('mf1-single', { reason: 'retry', moduleIds: [module.id] })
  assert.equal(retry.plan, null)
  assert.equal(retry.modules[0].id, module.id)
  const retried = await ctx.generation.runModuleGeneration(retry, {
    generator: async input => JSON.stringify({ sections: [{ id: 'problem', markdown: `${input.module.title} 重试内容` }] })
  })
  assert.equal(retried.ok, true)
  assert.equal(ctx.doc.ensureRequirementDoc('mf1-single', undefined, module.id).doc.version, 2)

  // 已拆分（2 模块）不能再按 single 生成
  const { ctx: splitCtx, modules } = await newPlannedApp('mf1-split')
  assert.throws(
    () => splitCtx.generation.prepareModuleGeneration('mf1-split', { reason: 'single', moduleIds: [modules[0].id] }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409)
      return true
    }
  )
  assert.throws(
    () => splitCtx.generation.prepareModuleGeneration('mf1-split', { reason: 'single' }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409)
      return true
    }
  )

  // 无 plan + 多模块 + retry 单模块 → 409
  await newEmptyApp('mf1-multi')
  ctx.modules.ensureDefaultModule('mf1-multi')
  ctx.modules.createModule('mf1-multi', { title: '第二模块' })
  const multi = ctx.modules.listModules('mf1-multi')
  assert.equal(multi.length, 2)
  assert.throws(
    () => ctx.generation.prepareModuleGeneration('mf1-multi', { reason: 'retry', moduleIds: [multi[0].id] }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409)
      return true
    }
  )
})
