/**
 * G1：需求聊天“模块级操作意图”守卫 + 未知模块引用告警（确定性单测）
 *
 * 与其它后端用例一致：必须在 import `../db` 之前把 RG_DATA_DIR/RG_PROJECTS_DIR
 * 指向临时目录（db-guards 会对测试进程 fail-closed）。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

interface Setup {
  root: string
  db: typeof import('../db').db
  intent: typeof import('./module-intent')
  modules: typeof import('./modules')
}

let setupPromise: Promise<Setup> | null = null

async function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-module-intent-'))
    process.env.RG_DATA_DIR = path.join(root, 'data')
    process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
    const dbModule = await import('../db')
    const intent = await import('./module-intent')
    const modules = await import('./modules')
    return { root, db: dbModule.db, intent, modules }
  })()
  return setupPromise
}

after(async () => {
  if (!setupPromise) return
  const { root, db } = await setupPromise
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

// ------------------------------------------------------------ 意图识别

test('G1 意图识别：新增/创建/删除/改名/拆分/合并 + 模块 都命中', async () => {
  const { intent } = await setup()
  const cases: Array<[string, string]> = [
    ['帮我增加一个模块：订单客户管理，包含客户、联系人', 'create'],
    ['帮我新增一个模块', 'create'],
    ['请创建业务域：售后', 'create'],
    ['我想要新建模块「库存管理」', 'create'],
    ['添加模块：支付', 'create'],
    ['删除模块 MOD-003', 'delete'],
    ['请删掉这个子域', 'delete'],
    ['把模块移除掉', 'delete'],
    ['模块改名：商品中心', 'rename'],
    ['重命名模块为订单中心', 'rename'],
    ['把模块拆分成两个', 'split'],
    ['合并模块：商品与订单', 'merge']
  ]
  for (const [text, action] of cases) {
    const hit = intent.detectModuleIntent(text)
    assert.ok(hit, `应命中：${text}`)
    assert.equal(hit?.action, action, `动作不对：${text}`)
  }
})

test('G1 意图识别：主会话评审 17 条样例（3 漏报 + 2 误伤已修）', async () => {
  const { intent } = await setup()
  /** [话术, 期望动作 | null] */
  const cases: Array<[string, 'create' | 'delete' | 'rename' | 'split' | 'merge' | null]> = [
    // —— 评审发现的漏报（原来都是 null） ——
    ['我要新增两个模块', 'create'],
    ['增加 2 个模块', 'create'],
    ['合并两个模块', 'merge'],
    // —— 评审发现的误伤（原来都是 create） ——
    ['订单模块增加客户绑定', null],
    ['这个模块增加客户维度', null],
    // —— 已通过、不得回归：正例 ——
    ['帮我增加一个模块：订单客户管理，包含客户、联系人', 'create'],
    ['创建业务域', 'create'],
    ['帮我加个模块', 'create'],
    ['删除模块 订单管理', 'delete'],
    ['模块改名', 'rename'],
    ['把订单模块改名为客户管理', 'rename'],
    ['拆分模块', 'split'],
    // —— 已通过、不得回归：反例 ——
    ['在模块里新增一个字段', null],
    ['在 Epics 章节新增一个 Story', null],
    ['商品模块新增字段', null],
    ['模块内的页面需要调整', null],
    ['在商品模块里增加一个客户字段', null]
  ]
  assert.equal(cases.length, 17)
  for (const [text, expected] of cases) {
    const hit = intent.detectModuleIntent(text)
    assert.equal(hit?.action ?? null, expected, `话术「${text}」期望 ${String(expected)}，实际 ${String(hit?.action ?? null)}`)
  }
})

test('G1 意图识别：为/成/掉 类动词形态（拆成两个模块 / 合并为订单模块 / 把模块删掉吧）', async () => {
  const { intent } = await setup()
  const cases: Array<[string, 'create' | 'delete' | 'rename' | 'split' | 'merge' | null]> = [
    ['拆成两个模块', 'split'],
    ['拆分为订单模块和客户模块', 'split'],
    ['合并为订单模块', 'merge'],
    ['合并成交易模块', 'merge'],
    ['把模块移除掉', 'delete'],
    ['把订单模块删除吧', 'delete'],
    ['模块删除吧', 'delete'],
    ['模块改名：商品中心', 'rename'],
    ['业务域拆分', 'split'],
    ['合并模块：商品与订单', 'merge'],
    ['删除模块 订单模块', 'delete'],
    // 内容修改，不是模块级操作
    ['把模块里的客户字段改一下', null],
    ['这个模块增加客户维度', null]
  ]
  for (const [text, expected] of cases) {
    const hit = intent.detectModuleIntent(text)
    assert.equal(hit?.action ?? null, expected, `话术「${text}」期望 ${String(expected)}，实际 ${String(hit?.action ?? null)}`)
  }
})

test('G1 意图识别：模块里新增字段 / Epics 新增 Story / 模块页面 不命中', async () => {
  const { intent } = await setup()
  const cases = [
    '在模块里新增一个字段：客户等级',
    '在 Epics 章节新增一个 Story',
    '模块内的页面需要支持筛选',
    '当前模块的页面列表补一列',
    '新增一个模块的字段说明',
    '模块新增字段：备注',
    '这个模块里加一个校验规则',
    '帮我改一下当前模块的必填项'
  ]
  for (const text of cases) {
    assert.equal(intent.detectModuleIntent(text), null, `不应命中：${text}`)
  }
  assert.equal(intent.detectModuleIntent(''), null)
  assert.equal(intent.detectModuleIntent(null), null)
})

// ------------------------------------------------------------ 指引文案 / 建议动作

const CREATE_INTENT = { action: 'create' as const, matched: '新增一个模块' }

test('G1 指引：需求阶段无变更单 → 新增模块 + AI 规划模块', async () => {
  const { intent } = await setup()
  const guidance = intent.buildModuleGuidance(CREATE_INTENT, { appStatus: 'requirements', changeSet: null, moduleLabel: 'MOD-001 商品管理' })
  assert.deepEqual(guidance.metadata.suggestions.map(item => item.action), ['create-module', 'open-replan'])
  assert.equal(guidance.metadata.stage, 'requirements')
  assert.equal(guidance.metadata.changeSet, null)
  assert.match(guidance.content, /\+ 新增模块/)
  assert.match(guidance.content, /AI 规划模块/)
  assert.match(guidance.content, /只用来修改当前模块/)
  assert.equal(guidance.content.includes('<<<DOC_JSON>>>'), false)
})

test('G1 指引：需求阶段 + 变更中 → 只能新增模块（含自动纳入范围说明）', async () => {
  const { intent } = await setup()
  const guidance = intent.buildModuleGuidance(CREATE_INTENT, {
    appStatus: 'requirements',
    changeSet: { seq: 2, scope: 'requirements' }
  })
  assert.deepEqual(guidance.metadata.suggestions.map(item => item.action), ['create-module'])
  assert.deepEqual(guidance.metadata.changeSet, { seq: 2, scope: 'requirements' })
  assert.match(guidance.content, /变更 #2/)
  assert.match(guidance.content, /自动纳入本次变更范围/)
  assert.match(guidance.content, /不支持「AI 规划模块」/)
})

test('G1 指引：设计阶段 → 重新编辑需求；仅设计变更时不给动作', async () => {
  const { intent } = await setup()
  const design = intent.buildModuleGuidance(CREATE_INTENT, { appStatus: 'design', changeSet: null })
  assert.deepEqual(design.metadata.suggestions.map(item => item.action), ['reopen-requirements'])
  assert.equal(design.metadata.stage, 'design')
  assert.match(design.content, /重新编辑需求/)

  const scoped = intent.buildModuleGuidance(CREATE_INTENT, { appStatus: 'design', changeSet: { seq: 3, scope: 'design' } })
  assert.deepEqual(scoped.metadata.suggestions, [])
  assert.match(scoped.content, /仅设计/)
})

test('G1 指引：开发/完成 → 发起变更；需求+设计变更中 → 重新编辑需求', async () => {
  const { intent } = await setup()
  const development = intent.buildModuleGuidance(CREATE_INTENT, { appStatus: 'development', changeSet: null })
  assert.deepEqual(development.metadata.suggestions.map(item => item.action), ['open-change-set'])
  assert.equal(development.metadata.stage, 'development')
  assert.match(development.content, /发起变更/)

  const completed = intent.buildModuleGuidance(CREATE_INTENT, { appStatus: 'completed', changeSet: null })
  assert.deepEqual(completed.metadata.suggestions.map(item => item.action), ['open-change-set'])

  const inChange = intent.buildModuleGuidance(CREATE_INTENT, {
    appStatus: 'development',
    changeSet: { seq: 4, scope: 'requirements' }
  })
  assert.deepEqual(inChange.metadata.suggestions.map(item => item.action), ['reopen-requirements'])
})

test('G1 指引：删除/改名/拆分/合并各给对应入口说明', async () => {
  const { intent } = await setup()
  const context = { appStatus: 'requirements', changeSet: null }
  assert.match(intent.buildModuleGuidance({ action: 'delete', matched: '' }, context).content, /归档/)
  assert.match(intent.buildModuleGuidance({ action: 'rename', matched: '' }, context).content, /编辑模块/)
  assert.match(intent.buildModuleGuidance({ action: 'split', matched: '' }, context).content, /AI 规划模块/)
  assert.match(intent.buildModuleGuidance({ action: 'merge', matched: '' }, context).content, /AI 规划模块/)
})

// ------------------------------------------------------------ 未知模块引用告警

test('G1 未知模块告警：已存在（含归档）的 key 不告警；未知 key 去重', async () => {
  const { db, intent, modules } = await setup()
  const appId = 'g1-intent-app'
  const now = new Date().toISOString()
  db.prepare('DELETE FROM apps WHERE id = ?').run(appId)
  db.prepare(`
    INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
    VALUES (?, 'G1 应用', NULL, ?, 8091, 'requirements', ?, ?)
  `).run(appId, appId, now, now)
  modules.ensureDefaultModule(appId)
  const second = modules.createModule(appId, { title: '订单管理' })
  assert.equal(second.moduleKey, 'MOD-002')
  const warnings = intent.unknownModuleRefWarnings(appId, [
    '参见 MOD-001 与 MOD-002。',
    '又见 MOD-001、MOD-999、MOD-999。',
    null,
    undefined
  ])
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /MOD-999/)
  assert.match(warnings[0], /不存在/)

  // 归档模块仍算“存在”（历史文档可以引用）
  modules.createModule(appId, { title: '库存管理' })
  modules.archiveModule(appId, second.id)
  const afterArchive = intent.unknownModuleRefWarnings(appId, ['见 MOD-002'])
  assert.deepEqual(afterArchive, [])
})

test('G1 指引上下文：从应用状态 + active 变更单只读组装（不建模块/文档）', async () => {
  const { db, intent } = await setup()
  const appId = 'g1-intent-context'
  const now = new Date().toISOString()
  db.prepare('DELETE FROM apps WHERE id = ?').run(appId)
  db.prepare(`
    INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
    VALUES (?, 'G1 上下文应用', NULL, ?, 8092, 'requirements', ?, ?)
  `).run(appId, appId, now, now)
  const context = intent.moduleGuidanceContext(appId, 'requirements')
  assert.equal(context.appStatus, 'requirements')
  assert.equal(context.changeSet, null)
  // 只读：不会懒创建模块/文档
  assert.equal(context.moduleLabel, '')
  const modules = db.prepare('SELECT COUNT(*) AS count FROM app_modules WHERE app_id = ?').get(appId) as { count: number }
  assert.equal(modules.count, 0)
  const docs = db.prepare('SELECT COUNT(*) AS count FROM app_requirement_docs WHERE app_id = ?').get(appId) as { count: number }
  assert.equal(docs.count, 0)
})
