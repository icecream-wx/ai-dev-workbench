/**
 * U7-1 开发阶段后端单测
 *
 * 不启动真实 opencode、不调用模型：
 * - opencode runtime 用内存 stub；
 * - 阶段摘要用注入的 summarize 覆盖（默认实现不会被调用）。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

interface Setup {
  root: string
  db: typeof import('../db').db
  service: typeof import('./service')
  phases: typeof import('./phases')
}

let setupPromise: Promise<Setup> | null = null

async function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-dev-phases-'))
    process.env.RG_DATA_DIR = path.join(root, 'data')
    process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
    const dbModule = await import('../db')
    const service = await import('./service')
    const phases = await import('./phases')
    return { root, db: dbModule.db, service, phases }
  })()
  return setupPromise
}

after(async () => {
  if (!setupPromise) return
  const { root, db } = await setupPromise
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

const NOW = '2026-11-12T00:00:00.000Z'

function insertApp(db: Setup['db'], id: string, status = 'development'): void {
  db.prepare(
    `INSERT INTO apps (id, name, description, dir, backend_port, status, design_confirmed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, `应用 ${id}`, null, id, 8081, status, NOW, NOW, NOW)
}

function writeHandoff(root: string, appId: string): void {
  const dir = path.join(root, 'projects', appId, 'docs', 'handoff')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '00-README.md'), '# 交接包\n', 'utf8')
}

function insertChangeSet(db: Setup['db'], appId: string, id: string): void {
  db.prepare(
    `INSERT INTO app_change_sets (id, app_id, seq, title, description, scope, status, created_at, updated_at)
     VALUES (?, ?, 1, '初始开发', '', 'requirements', 'development', ?, ?)`
  ).run(id, appId, NOW, NOW)
}

function insertModule(db: Setup['db'], appId: string, id: string, key: string, title: string, position: number): void {
  db.prepare(
    `INSERT INTO app_modules
       (id, app_id, module_key, title, description, owner_label, required, position, archived_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, NULL, 1, ?, NULL, ?, ?)`
  ).run(id, appId, key, title, position, NOW, NOW)
}

interface PhaseSpec {
  key: string
  kind: string
  title: string
  goal?: string
  storyIds?: string[]
  pageSetCodes?: string[]
  pageCodes?: string[]
  note?: string
  moduleId?: string
  moduleKey?: string
  parentKey?: string
}

function manifestOf(phases: PhaseSpec[], options: { suggested?: boolean } = {}): Record<string, unknown> {
  const suggested = options.suggested ?? true
  return {
    scale: {
      level: suggested ? 'large' : 'normal',
      suggested,
      counts: { scenes: 0, epics: 2, stories: 10, entities: 2, fields: 8, relations: 1, pageSets: 2, pages: 12, prototypes: 12 },
      textBytes: 204800,
      thresholds: { stories: 10, pages: 12, textBytes: 102400 },
      triggers: suggested ? [{ metric: 'stories', value: 10, threshold: 10 }] : [],
      phaseCount: suggested ? phases.length : 0,
      derivedFrom: suggested ? 'epics' : 'none'
    },
    ...(suggested ? { phases } : {})
  }
}

const THREE_PHASES: PhaseSpec[] = [
  { key: 'base', kind: 'base', title: '数据模型与基础框架', goal: '建表并打通应用壳', note: '参考 schema.sql' },
  {
    key: 'epic:EPIC-001',
    kind: 'epic',
    title: 'EPIC-001 客户管理',
    goal: '支持客户维护',
    storyIds: ['STORY-001', 'STORY-002'],
    pageSetCodes: ['PS-001'],
    pageCodes: ['PAGE-001', 'PAGE-002']
  },
  { key: 'epic:EPIC-002', kind: 'epic', title: 'EPIC-002 订单管理', goal: '支持订单创建', storyIds: ['STORY-003'] }
]

const MODULE_PHASES: PhaseSpec[] = [
  { key: 'base', kind: 'base', title: '数据模型与基础框架', goal: '建表并打通应用壳' },
  {
    key: 'module:MOD-001',
    kind: 'module',
    title: 'MOD-001 商品管理',
    goal: '模块里程碑',
    moduleId: 'm-a',
    moduleKey: 'MOD-001',
    storyIds: ['STORY-001', 'STORY-002', 'STORY-003'],
    pageSetCodes: ['PS-001', 'PS-002', 'PS-003']
  },
  {
    key: 'epic:EPIC-001',
    kind: 'epic',
    title: 'EPIC-001 商品档案',
    goal: '维护商品',
    moduleId: 'm-a',
    moduleKey: 'MOD-001',
    parentKey: 'MOD-001',
    storyIds: ['STORY-001', 'STORY-002'],
    pageSetCodes: ['PS-001'],
    pageCodes: ['PAGE-001']
  },
  {
    key: 'epic:EPIC-002',
    kind: 'epic',
    title: 'EPIC-002 库存',
    goal: '维护库存',
    moduleId: 'm-a',
    moduleKey: 'MOD-001',
    parentKey: 'MOD-001',
    storyIds: ['STORY-003'],
    pageSetCodes: ['PS-002'],
    pageCodes: ['PAGE-002']
  },
  {
    key: 'other:MOD-001',
    kind: 'other',
    title: 'MOD-001 其他页面与收尾',
    goal: '模块收尾',
    moduleId: 'm-a',
    moduleKey: 'MOD-001',
    parentKey: 'MOD-001',
    pageSetCodes: ['PS-003'],
    pageCodes: ['PAGE-003']
  },
  {
    key: 'module:MOD-002',
    kind: 'module',
    title: 'MOD-002 订单管理',
    goal: '模块里程碑',
    moduleId: 'm-b',
    moduleKey: 'MOD-002',
    storyIds: ['STORY-004'],
    pageSetCodes: ['PS-004']
  },
  {
    key: 'epic:EPIC-003',
    kind: 'epic',
    title: 'EPIC-003 订单',
    goal: '创建订单',
    moduleId: 'm-b',
    moduleKey: 'MOD-002',
    parentKey: 'MOD-002',
    storyIds: ['STORY-004'],
    pageSetCodes: ['PS-004'],
    pageCodes: ['PAGE-004']
  }
]

function insertHandoff(
  db: Setup['db'],
  appId: string,
  version: number,
  manifest: Record<string, unknown>,
  changeSetId: string | null = null
): void {
  db.prepare(
    `INSERT INTO design_handoffs
       (app_id, version, hash, docs_dir, files_json, change_set_id, baseline_handoff_version,
        source_design_json, source_requirements_json, manifest_json, created_at)
     VALUES (?, ?, ?, ?, '[]', ?, NULL, '{}', '{}', ?, ?)`
  ).run(appId, version, `hash-${version}`, 'docs/handoff', changeSetId, JSON.stringify(manifest), NOW)
}

interface OpencodeStub {
  created: Array<{ id: string; title?: string }>
  interrupted: string[]
  prompted: Array<{ id: string; text: string }>
  messages: { data: unknown[] }
  missing: Set<string>
  createdTitles: Array<string | null | undefined>
}

async function stubOpencode(): Promise<OpencodeStub> {
  const { opencode } = await import('../opencode/runtime')
  const target = opencode as unknown as Record<string, unknown>
  const created: Array<{ id: string; title?: string }> = []
  const interrupted: string[] = []
  const prompted: Array<{ id: string; text: string }> = []
  const messages = { data: [] as unknown[] }
  const missing = new Set<string>()
  const createdTitles: Array<string | null | undefined> = []
  target.status = () => ({
    ready: true,
    starting: false,
    installed: true,
    autoStart: false,
    autoStartAttempted: true,
    host: '127.0.0.1',
    port: 0,
    baseUrl: '',
    bin: null,
    version: null,
    passwordCaptured: false,
    streamState: 'idle',
    lastEventAt: null,
    lastError: null,
    installError: null,
    pendingSessions: 0
  })
  target.listSessions = async () => created
  target.listModels = async () => []
  target.listAgents = async () => [{ id: 'build' }]
  target.lastUsedModel = async () => null
  target.defaultModel = async () => null
  target.session = async (id: string) => (missing.has(id) ? null : { id, title: `opencode ${id}` })
  target.messages = async () => ({ data: messages.data })
  target.refreshPending = async () => undefined
  target.pendingFor = () => ({ permissions: [], forms: [] })
  target.interrupt = async (id: string) => {
    interrupted.push(id)
    return {}
  }
  target.prompt = async (id: string, text: string) => {
    prompted.push({ id, text })
    return {}
  }
  target.createSession = async (input: { title?: string }) => {
    const session = { id: `oc-${created.length + 1}`, title: input.title }
    created.push(session)
    createdTitles.push(input.title)
    return session
  }
  target.track = () => undefined
  target.generateText = async () => {
    throw new Error('单测不应调用真实模型（generateText）')
  }
  return { created, interrupted, prompted, messages, missing, createdTitles }
}

function phaseRows(db: Setup['db'], appId: string, version = 1): Array<Record<string, unknown>> {
  return db
    .prepare('SELECT * FROM app_dev_phases WHERE app_id = ? AND handoff_version = ? ORDER BY ord')
    .all(appId, version) as Array<Record<string, unknown>>
}

function seedLargeApp(db: Setup['db'], root: string, appId: string): void {
  insertApp(db, appId)
  writeHandoff(root, appId)
  insertChangeSet(db, appId, `cs-${appId}`)
  insertHandoff(db, appId, 1, manifestOf(THREE_PHASES), `cs-${appId}`)
}

/** M6b：两模块（商品/订单）+ 模块里程碑/Epic/other 的 large 交接包 */
function seedModuleApp(db: Setup['db'], root: string, appId: string): void {
  insertApp(db, appId)
  writeHandoff(root, appId)
  insertChangeSet(db, appId, `cs-${appId}`)
  const moduleAId = `${appId}-a`
  const moduleBId = `${appId}-b`
  insertModule(db, appId, moduleAId, 'MOD-001', '商品管理', 0)
  insertModule(db, appId, moduleBId, 'MOD-002', '订单管理', 1)
  const phases = MODULE_PHASES.map(phase => ({
    ...phase,
    ...(phase.moduleId === 'm-a' ? { moduleId: moduleAId } : phase.moduleId === 'm-b' ? { moduleId: moduleBId } : {})
  }))
  insertHandoff(db, appId, 1, manifestOf(phases), `cs-${appId}`)
}

test('U7-1 生成：manifest.phases → 阶段行；幂等；非 large/无 phases 409', async () => {
  const { db, root, phases } = await setup()
  const appId = 'phases-generate'
  seedLargeApp(db, root, appId)

  const before = phases.getDevPhases(appId)
  assert.equal(before.handoffVersion, 1)
  assert.equal(before.canGenerate, true)
  assert.equal(before.generated, false)
  assert.deepEqual(before.phases, [])
  assert.equal(before.changeSet?.seq, 1)

  const generated = phases.generateDevPhases(appId)
  assert.equal(generated.generated, true)
  assert.equal(generated.canGenerate, false)
  assert.equal(generated.phases.length, 3)
  assert.deepEqual(generated.phases.map(phase => phase.order), [1, 2, 3])
  assert.deepEqual(generated.phases.map(phase => phase.key), ['base', 'epic:EPIC-001', 'epic:EPIC-002'])
  assert.ok(generated.phases.every(phase => phase.status === 'not_started'))
  assert.ok(generated.phases.every(phase => /^[0-9a-f-]{36}$/.test(phase.id)), '阶段 ID 应为全局唯一 UUID')
  const rows = phaseRows(db, appId)
  assert.equal(rows.length, 3)
  assert.equal(rows[0].ord, 0)
  assert.equal(rows[1].goal, '支持客户维护')
  const scope = JSON.parse(String(rows[1].scope_json)) as Record<string, unknown>
  assert.equal(scope.kind, 'epic')
  assert.deepEqual(scope.storyIds, ['STORY-001', 'STORY-002'])
  assert.deepEqual(scope.pageSetCodes, ['PS-001'])
  assert.equal(rows[0].change_set_id, `cs-${appId}`)
  assert.equal(rows[0].handoff_version, 1)
  // 阶段行不暴露工作台内部 ID（只有对外稳定编号）
  const serialized = JSON.stringify(generated)
  assert.ok(!serialized.includes('ps-internal'))

  // 幂等：再次 generate 不新增
  const again = phases.generateDevPhases(appId)
  assert.deepEqual(
    again.phases.map(phase => phase.id),
    generated.phases.map(phase => phase.id)
  )

  // 非 large
  const normalId = 'phases-normal'
  insertApp(db, normalId)
  writeHandoff(root, normalId)
  insertHandoff(db, normalId, 1, manifestOf(THREE_PHASES, { suggested: false }))
  assert.throws(() => phases.generateDevPhases(normalId), (error: Error & { status?: number }) => {
    assert.equal(error.status, 409)
    assert.match(error.message, /缺少阶段数据/)
    return true
  })
  assert.equal(phases.getDevPhases(normalId).canGenerate, false)

  // 旧交接包没有 manifest.phases
  const legacyId = 'phases-legacy'
  insertApp(db, legacyId)
  writeHandoff(root, legacyId)
  insertHandoff(db, legacyId, 1, {
    scale: { level: 'large', suggested: true, counts: {}, textBytes: 1, thresholds: {}, triggers: [], phaseCount: 0, derivedFrom: 'epics' }
  })
  assert.throws(() => phases.generateDevPhases(legacyId), /重新生成交接包/)

  // 没有交接包
  const emptyId = 'phases-empty'
  insertApp(db, emptyId)
  writeHandoff(root, emptyId)
  assert.throws(() => phases.generateDevPhases(emptyId), (error: Error & { status?: number }) => {
    assert.equal(error.status, 409)
    assert.match(error.message, /交接包/)
    return true
  })
})

test('M6b 两层阶段生成：module/epic/parentKey/module_id/phase_kind + modules 汇总/顺序；模块操作 409', async () => {
  const { db, root, phases } = await setup()
  const appId = 'phases-modules'
  seedModuleApp(db, root, appId)

  const generated = phases.generateDevPhases(appId)
  assert.equal(generated.phases.length, MODULE_PHASES.length)
  assert.equal(generated.modulePhaseCount, 2)
  assert.equal(generated.modules.length, 2)
  assert.deepEqual(generated.modules.map(module => module.key), ['MOD-001', 'MOD-002'])
  assert.ok(generated.modules.every(module => module.status === 'not_started'))
  assert.equal(generated.modules[0].total, 3)
  assert.equal(generated.modules[1].total, 1)

  const rows = phaseRows(db, appId)
  const rowByKey = new Map(rows.map(row => [row.phase_key as string, row]))
  const moduleA = rowByKey.get('module:MOD-001')
  assert.equal(moduleA?.phase_kind, 'module')
  assert.equal(moduleA?.module_id, `${appId}-a`)
  assert.equal(moduleA?.parent_key, null)
  const epicA1 = rowByKey.get('epic:EPIC-001')
  assert.equal(epicA1?.phase_kind, 'epic')
  assert.equal(epicA1?.module_id, `${appId}-a`)
  assert.equal(epicA1?.parent_key, 'MOD-001')
  assert.equal(rowByKey.get('other:MOD-001')?.parent_key, 'MOD-001')

  const byKey = new Map(generated.phases.map(phase => [phase.key, phase]))
  assert.equal(byKey.get('base')?.order, 1)
  assert.equal(byKey.get('epic:EPIC-001')?.order, 2)
  assert.equal(byKey.get('epic:EPIC-002')?.order, 3)
  assert.equal(byKey.get('other:MOD-001')?.order, 4)
  assert.equal(byKey.get('epic:EPIC-003')?.order, 5)
  assert.equal(byKey.get('epic:EPIC-001')?.kind, 'epic')
  assert.equal(byKey.get('epic:EPIC-001')?.moduleKey, 'MOD-001')
  assert.equal(byKey.get('module:MOD-001')?.kind, 'module')
  assert.equal(byKey.get('module:MOD-001')?.parentKey, null)
  assert.equal(byKey.get('base')?.parentKey, null)
  assert.equal(byKey.get('epic:EPIC-001')?.parentKey, 'MOD-001')
  assert.equal(byKey.get('other:MOD-001')?.parentKey, 'MOD-001')
  assert.equal(byKey.get('epic:EPIC-003')?.parentKey, 'MOD-002')
  assert.equal(phases.phaseRefById(byKey.get('epic:EPIC-001')?.id ?? null)?.parentKey, 'MOD-001')

  for (const action of ['start', 'complete', 'skip', 'reopen'] as const) {
    const id = moduleA?.id as string
    const error = await (action === 'start'
      ? phases.startDevPhase(appId, id)
      : Promise.resolve().then(() =>
          action === 'complete'
            ? phases.completeDevPhase(appId, id)
            : action === 'skip'
              ? phases.skipDevPhase(appId, id)
              : phases.reopenDevPhase(appId, id)
        )
    ).catch((err: { status?: number; message?: string }) => err)
    assert.equal((error as { status?: number }).status, 409, `${action} 模块阶段应 409`)
    assert.match(String((error as { message?: string }).message), /模块阶段只作分组/)
  }
})

test('M6b 模块内 Epic 会话：标题/brief 带模块、状态派生、previous summary 只取同模块', async () => {
  const { db, root, phases, service } = await setup()
  const stub = await stubOpencode()
  const appId = 'phases-modules-start'
  seedModuleApp(db, root, appId)
  phases.generateDevPhases(appId)
  const rows = phaseRows(db, appId)
  const rowByKey = new Map(rows.map(row => [row.phase_key as string, row]))
  const epicA1 = rowByKey.get('epic:EPIC-001') as { id: string }
  const epicA2 = rowByKey.get('epic:EPIC-002') as { id: string }
  const epicB1 = rowByKey.get('epic:EPIC-003') as { id: string }

  const started = await phases.startDevPhase(appId, epicA1.id)
  assert.match(started.session?.title ?? '', /MOD-001 商品管理/)
  assert.match(started.defaultPrompt, /模块：MOD-001 商品管理/)
  assert.match(started.defaultPrompt, /你现在在阶段 2\/5/)
  assert.equal(started.session?.phase?.kind, 'epic')
  assert.equal(started.session?.phase?.moduleKey, 'MOD-001')
  let state = phases.getDevPhases(appId)
  assert.equal(state.modules.find(module => module.key === 'MOD-001')?.status, 'in_progress')
  assert.equal(state.modules.find(module => module.key === 'MOD-002')?.status, 'not_started')
  const sessions = await service.listDevSessions(appId)
  const session = sessions.sessions.find(item => item.id === started.session?.id)
  assert.equal(session?.phaseModuleKey, 'MOD-001')
  assert.equal(session?.phaseKind, 'epic')
  assert.equal(session?.phaseParentKey, 'MOD-001')

  // 同模块 previous summary
  db.prepare('UPDATE app_dev_phases SET summary = ? WHERE id = ?').run('模块 A 第一段摘要', epicA1.id)
  const started2 = await phases.startDevPhase(appId, epicA2.id)
  assert.match(started2.defaultPrompt, /模块 A 第一段摘要/)
  assert.match(started2.defaultPrompt, /阶段 3\/5/)

  // 另一模块第一个 Epic：不取模块 A 摘要
  const startedB = await phases.startDevPhase(appId, epicB1.id)
  assert.match(startedB.defaultPrompt, /无上一阶段摘要/)
  assert.match(startedB.session?.title ?? '', /MOD-002 订单管理/)
  assert.equal(stub.created.length >= 2, true)

  // MF-M6b-2：完成 1/3 子阶段 → 模块 in_progress（不是 not_started）
  db.prepare(
    `UPDATE app_dev_phases SET status = CASE
       WHEN phase_key = 'epic:EPIC-001' THEN 'completed'
       ELSE 'not_started'
     END WHERE app_id = ? AND module_id = ?`
  ).run(appId, `${appId}-a`)
  state = phases.getDevPhases(appId)
  assert.equal(state.modules.find(module => module.key === 'MOD-001')?.status, 'in_progress')
  assert.deepEqual(phases.moduleStatusOf([
    { status: 'completed' },
    { status: 'not_started' },
    { status: 'not_started' }
  ]), 'in_progress')
  assert.deepEqual(phases.moduleStatusOf([
    { status: 'completed' },
    { status: 'skipped' }
  ]), 'completed')
  assert.deepEqual(phases.moduleStatusOf([
    { status: 'skipped' },
    { status: 'skipped' }
  ]), 'skipped')
  assert.deepEqual(phases.moduleStatusOf([
    { status: 'not_started' },
    { status: 'not_started' }
  ]), 'not_started')
  assert.deepEqual(phases.moduleStatusOf([]), 'not_started')

  // 模块状态派生：completed（有 completed）/ skipped（全 skipped）/ in_progress
  db.prepare(
    `UPDATE app_dev_phases SET status = 'completed' WHERE app_id = ? AND module_id = ? AND phase_key IN ('epic:EPIC-001','epic:EPIC-002')`
  ).run(appId, `${appId}-a`)
  db.prepare("UPDATE app_dev_phases SET status = 'skipped' WHERE app_id = ? AND phase_key = 'other:MOD-001'").run(appId)
  state = phases.getDevPhases(appId)
  assert.equal(state.modules.find(module => module.key === 'MOD-001')?.status, 'completed')
  db.prepare("UPDATE app_dev_phases SET status = 'skipped' WHERE app_id = ? AND module_id = ?").run(appId, `${appId}-a`)
  state = phases.getDevPhases(appId)
  assert.equal(state.modules.find(module => module.key === 'MOD-001')?.status, 'skipped')
  db.prepare("UPDATE app_dev_phases SET status = 'in_progress' WHERE app_id = ? AND phase_key = 'epic:EPIC-003'").run(appId)
  state = phases.getDevPhases(appId)
  assert.equal(state.modules.find(module => module.key === 'MOD-002')?.status, 'in_progress')
})

test('U7-1 阶段开始：新建（归档旧 active/tag/brief）、已有 active、恢复归档、跨应用/历史/completed', async () => {
  const { db, root, phases, service } = await setup()
  const stub = await stubOpencode()
  const appId = 'phases-start'
  seedLargeApp(db, root, appId)
  const generated = phases.generateDevPhases(appId)
  const [base, epic1, epic2] = generated.phases

  const first = await phases.startDevPhase(appId, base.id)
  assert.equal(stub.created.length, 1)
  assert.equal(first.session?.phase?.id, base.id)
  assert.equal((first.session as unknown as Record<string, unknown>).dev_phase_id, undefined, 'DevSessionInfo 不暴露 DB 列名')
  assert.equal(first.session?.phase?.order, 1)
  assert.match(first.session?.title ?? '', /开发 · 阶段 1 数据模型与基础框架$/)
  assert.equal(stub.createdTitles[0], first.session?.title)
  assert.match(first.defaultPrompt, /你现在在阶段 1\/3：数据模型与基础框架。/)
  assert.match(first.defaultPrompt, /目标：建表并打通应用壳/)
  assert.match(first.defaultPrompt, /范围：按 `04-PLAN\.md` 阶段章节/)
  assert.match(first.defaultPrompt, /说明：参考 schema\.sql/)
  assert.match(first.defaultPrompt, /交接包：docs\/handoff\/00-README\.md、04-PLAN\.md/)
  assert.match(first.defaultPrompt, /上一阶段摘要：\n无上一阶段摘要/)
  assert.ok(!/批次|证据|Git 门禁/.test(first.defaultPrompt), 'brief 不注入批次/证据/Git')
  assert.equal(first.phase.status, 'in_progress')
  assert.ok(first.phase.startedAt)
  const baseRow = phaseRows(db, appId).find(row => row.id === base.id) as Record<string, unknown>
  assert.equal(baseRow.status, 'in_progress')
  const sessionRow = db.prepare('SELECT dev_phase_id FROM app_sessions WHERE id = ?').get(first.session?.id as string) as {
    dev_phase_id: string | null
  }
  assert.equal(sessionRow.dev_phase_id, base.id)

  // 已有 active：直接返回，不新建
  const again = await phases.startDevPhase(appId, base.id)
  assert.equal(stub.created.length, 1)
  assert.equal(again.session?.id, first.session?.id)

  // 开始下一阶段：旧 active 的 opencode 会话 interrupt + 归档
  const second = await phases.startDevPhase(appId, epic1.id)
  assert.equal(stub.created.length, 2)
  assert.deepEqual(stub.interrupted, ['oc-1'])
  assert.equal(second.phase.status, 'in_progress')
  assert.match(second.defaultPrompt, /你现在在阶段 2\/3：EPIC-001 客户管理。/)
  assert.match(second.defaultPrompt, /范围：Story STORY-001、STORY-002；页面集 PS-001；页面 PAGE-001、PAGE-002/)
  const previousSession = db.prepare('SELECT status FROM app_sessions WHERE id = ?').get(first.session?.id as string) as {
    status: string
  }
  assert.equal(previousSession.status, 'archived')
  assert.equal(service.activeSessionRow(appId)?.id, second.session?.id)

  // 上一阶段 summary 进入下一阶段 brief
  db.prepare(`UPDATE app_dev_phases SET summary = '客户管理阶段已完成' WHERE id = ?`).run(epic1.id)
  const third = await phases.startDevPhase(appId, epic2.id)
  assert.match(third.defaultPrompt, /上一阶段摘要：\n客户管理阶段已完成/)

  // 归档后再次开始同一阶段：复用 I-10 activate（不新建）
  await service.archiveDevSessionById(appId, third.session?.id as string)
  const resumed = await phases.startDevPhase(appId, epic2.id)
  assert.equal(stub.created.length, 3)
  assert.equal(resumed.session?.id, third.session?.id)
  assert.equal(resumed.session?.status, 'active')
  assert.equal(resumed.phase.status, 'in_progress')

  // 跨应用 404
  const otherId = 'phases-start-other'
  seedLargeApp(db, root, otherId)
  await assert.rejects(() => phases.startDevPhase(otherId, base.id), (error: Error & { status?: number }) => {
    assert.equal(error.status, 404)
    return true
  })

  // 历史交接包阶段 → 409
  insertHandoff(db, appId, 2, manifestOf(THREE_PHASES), `cs-${appId}`)
  await assert.rejects(() => phases.startDevPhase(appId, base.id), (error: Error & { status?: number }) => {
    assert.equal(error.status, 409)
    assert.match(error.message, /历史交接包版本/)
    return true
  })

  // completed 阶段开始 → 409（先用最新版本阶段验证）
  const latest = phases.getDevPhases(appId)
  assert.equal(latest.handoffVersion, 2)
  assert.equal(latest.phases.length, 0)
  assert.equal(latest.canGenerate, true)
  const regenerated = phases.generateDevPhases(appId)
  const latestBase = regenerated.phases[0]
  db.prepare(`UPDATE app_dev_phases SET status = 'completed' WHERE id = ?`).run(latestBase.id)
  await assert.rejects(() => phases.startDevPhase(appId, latestBase.id), /阶段已完成/)
})

test('U7-1 完成/跳过/重新打开：不归档；prompt 自动 in_progress；摘要 none/model/fallback', async () => {
  const { db, root, phases, service } = await setup()
  const stub = await stubOpencode()
  const appId = 'phases-complete'
  seedLargeApp(db, root, appId)
  const generated = phases.generateDevPhases(appId)
  const [base, epic1] = generated.phases

  const started = await phases.startDevPhase(appId, base.id)
  const sessionId = started.session?.id as string

  // 无 assistant：summary_source=none，不调模型；不归档会话
  const none = await phases.completeDevPhase(appId, base.id, {
    summarize: async () => {
      throw new Error('无 assistant 时不应调用摘要')
    }
  })
  assert.equal(none.phase.status, 'completed')
  assert.ok(none.phase.completedAt)
  assert.equal(none.phase.summarySource, 'none')
  assert.equal(none.phase.summary, null)
  assert.deepEqual(none.warnings, [])
  assert.equal(service.activeSessionRow(appId)?.id, sessionId, '完成阶段不归档会话')

  // 完成后发消息 → 阶段自动重新打开（响应 warning）
  const prompted = await service.promptDevSession(appId, '继续补充')
  assert.equal(prompted.ok, true)
  assert.equal(prompted.phase?.id, base.id)
  assert.equal(prompted.phase?.status, 'in_progress')
  assert.match(prompted.warning ?? '', /已重新打开/)
  assert.equal(phaseRows(db, appId).find(row => row.id === base.id)?.status, 'in_progress')
  assert.equal(phaseRows(db, appId).find(row => row.id === base.id)?.completed_at, null)

  // 有 assistant + 注入摘要：model
  stub.messages.data = [
    { id: 'u1', type: 'user', text: '开始阶段', time: { created: 1 } },
    { id: 'a1', type: 'assistant', content: [{ type: 'text', text: '已建表并完成基础框架' }], time: { created: 2 } }
  ]
  let summarizeCalls = 0
  let capturedPrompt = ''
  const modeled = await phases.completeDevPhase(appId, base.id, {
    summarize: async input => {
      summarizeCalls += 1
      capturedPrompt = input.prompt
      assert.equal(input.lastAssistantText, '已建表并完成基础框架')
      assert.equal(input.order, 1)
      assert.equal(input.total, 3)
      return '已实现：基础表与应用壳\n关键文件：01.sql\n未完成：无\n下一阶段注意：先确认字典'
    }
  })
  assert.equal(summarizeCalls, 1)
  assert.equal(modeled.phase.summarySource, 'model')
  assert.match(modeled.phase.summary ?? '', /已实现：基础表与应用壳/)
  assert.match(capturedPrompt, /第 1\/3 阶段 · 数据模型与基础框架/)
  assert.match(capturedPrompt, /5—10 行中文摘要/)
  assert.ok(!/批次|证据|Git/.test(capturedPrompt), '摘要 prompt 不注入批次/证据/Git')

  // 重复完成：幂等，不重复调模型
  const repeat = await phases.completeDevPhase(appId, base.id, {
    summarize: async () => {
      summarizeCalls += 1
      return '不应调用'
    }
  })
  assert.equal(summarizeCalls, 1)
  assert.equal(repeat.phase.status, 'completed')

  // 跳过：不摘要；reopen 保留 summary
  const skipped = phases.skipDevPhase(appId, epic1.id)
  assert.equal(skipped.status, 'skipped')
  assert.ok(skipped.completedAt)
  const reopened = phases.reopenDevPhase(appId, base.id)
  assert.equal(reopened.status, 'in_progress')
  assert.equal(reopened.completedAt, null)
  assert.match(reopened.summary ?? '', /已实现：基础表与应用壳/, 'reopen 保留 summary')
})

test('U7-1 从 skipped 重新开始：清 completedAt，随后 complete 正常', async () => {
  const { db, root, phases } = await setup()
  const stub = await stubOpencode()
  const appId = 'phases-skip-restart'
  seedLargeApp(db, root, appId)
  const generated = phases.generateDevPhases(appId)
  const epic1 = generated.phases[1]

  // 跳过（尚无会话）→ completed_at 非空
  const skipped = phases.skipDevPhase(appId, epic1.id)
  assert.equal(skipped.status, 'skipped')
  assert.ok(skipped.completedAt)

  // 从 skipped 开始（无会话分支：新建会话）→ in_progress 且 completedAt=null
  const restarted = await phases.startDevPhase(appId, epic1.id)
  assert.ok(restarted.session)
  assert.equal(restarted.phase.status, 'in_progress')
  assert.equal(restarted.phase.completedAt, null)
  const restartedRow = phaseRows(db, appId).find(row => row.id === epic1.id) as Record<string, unknown>
  assert.equal(restartedRow.status, 'in_progress')
  assert.equal(restartedRow.completed_at, null)
  assert.ok(restartedRow.started_at, 'started_at 应保留/补齐')

  // 重新开始后 complete 正常（无 assistant → none，不调模型）
  stub.messages.data = []
  const completed = await phases.completeDevPhase(appId, epic1.id, {
    summarize: async () => {
      throw new Error('无 assistant 时不应调用摘要')
    }
  })
  assert.equal(completed.phase.status, 'completed')
  assert.ok(completed.phase.completedAt)
  assert.equal(completed.phase.summarySource, 'none')

  // 再 skip → 再 start（已有 active 会话分支）同样清 completedAt
  const skippedAgain = phases.skipDevPhase(appId, epic1.id)
  assert.equal(skippedAgain.status, 'skipped')
  assert.ok(skippedAgain.completedAt)
  const resumed = await phases.startDevPhase(appId, epic1.id)
  assert.equal(resumed.phase.status, 'in_progress')
  assert.equal(resumed.phase.completedAt, null)
  assert.equal(resumed.session?.status, 'active')
})

test('U7-1 摘要 fallback：失败/空 → 最后 assistant 800 字；无会话 none；输入截断 4000', async () => {
  const { db, root, phases } = await setup()
  const stub = await stubOpencode()
  const appId = 'phases-fallback'
  seedLargeApp(db, root, appId)
  const generated = phases.generateDevPhases(appId)
  const [base, epic1, epic2] = generated.phases

  const started = await phases.startDevPhase(appId, base.id)
  assert.ok(started.session)
  const longText = `开头${'长'.repeat(5000)}结尾`
  stub.messages.data = [
    { id: 'a0', type: 'assistant', content: [{ type: 'text', text: '第一条' }] },
    { id: 'a1', type: 'assistant', content: [{ type: 'text', text: longText }] }
  ]

  // 失败 → fallback 最后 assistant（800 字）
  const failed = await phases.completeDevPhase(appId, base.id, {
    summarize: async () => {
      throw new Error('模型超时')
    }
  })
  assert.equal(failed.phase.summarySource, 'fallback')
  assert.equal(failed.phase.summary?.length, 800)
  assert.ok(failed.phase.summary?.startsWith('开头'))
  assert.equal(failed.warnings.length, 1)
  assert.match(failed.warnings[0], /模型超时/)

  // 空摘要 → fallback
  const reopened = phases.reopenDevPhase(appId, base.id)
  assert.equal(reopened.status, 'in_progress')
  const empty = await phases.completeDevPhase(appId, base.id, { summarize: async () => '   ' })
  assert.equal(empty.phase.summarySource, 'fallback')
  assert.equal(empty.phase.summary?.length, 800)

  // 输入截断 4000
  phases.reopenDevPhase(appId, base.id)
  let promptLength = 0
  let lastLength = 0
  const truncated = await phases.completeDevPhase(appId, base.id, {
    summarize: async input => {
      promptLength = input.prompt.length
      lastLength = input.lastAssistantText.length
      return '摘要'
    }
  })
  assert.equal(truncated.phase.summarySource, 'model')
  assert.equal(lastLength, longText.length)
  assert.ok(promptLength < lastLength, 'prompt 中的最后回复应截断到 4000 字符')

  // 只有 user 消息 → none
  stub.messages.data = [{ id: 'u1', type: 'user', text: '开始' }]
  const epic1Start = await phases.startDevPhase(appId, epic1.id)
  assert.ok(epic1Start.session)
  const noAssistant = await phases.completeDevPhase(appId, epic1.id, {
    summarize: async () => {
      throw new Error('不应调用')
    }
  })
  assert.equal(noAssistant.phase.summarySource, 'none')

  // 无会话阶段 → none
  const noSession = await phases.completeDevPhase(appId, epic2.id, {
    summarize: async () => {
      throw new Error('不应调用')
    }
  })
  assert.equal(noSession.phase.summarySource, 'none')
  assert.equal(noSession.phase.summary, null)
})

test('U7-1 会话/状态 phase 字段：旧会话 null；列表与开发状态返回阶段', async () => {
  const { db, root, phases, service } = await setup()
  const stub = await stubOpencode()
  const appId = 'phases-fields'
  seedLargeApp(db, root, appId)
  const generated = phases.generateDevPhases(appId)
  const [base, epic1] = generated.phases

  // 旧会话（无 dev_phase_id）
  db.prepare(
    `INSERT INTO app_sessions (id, app_id, stage, opencode_session_id, provider_id, model_id, status, created_at, updated_at)
     VALUES ('old-session', ?, 'development', 'oc-old', NULL, NULL, 'archived', ?, ?)`
  ).run(appId, NOW, NOW)
  stub.created.push({ id: 'oc-old', title: '旧会话' })

  const started = await phases.startDevPhase(appId, base.id)
  assert.ok(started.session)
  // phase1 会话 active；旧会话仍在列表但无阶段
  await phases.startDevPhase(appId, epic1.id)

  const list = await service.listDevSessions(appId)
  const oldItem = list.sessions.find(item => item.id === 'old-session')
  assert.ok(oldItem)
  assert.equal(oldItem.phaseId, null)
  assert.equal(oldItem.phaseKey, null)
  assert.equal(oldItem.phaseOrder, null)
  const phaseItem = list.sessions.find(item => item.id !== 'old-session')
  assert.ok(phaseItem)
  assert.equal(phaseItem.phaseId, epic1.id)
  assert.equal(phaseItem.phaseKey, 'epic:EPIC-001')
  assert.equal(phaseItem.phaseTitle, 'EPIC-001 客户管理')
  assert.equal(phaseItem.phaseOrder, 2)
  assert.equal(phaseItem.phaseStatus, 'in_progress')

  const state = await service.getDevState(appId)
  assert.equal(state.session?.phase?.id, epic1.id)
  assert.equal(state.session?.phase?.order, 2)
  assert.equal(state.session?.phase?.status, 'in_progress')
  assert.deepEqual(
    state.phases.map(phase => [phase.key, phase.order, phase.status]),
    [
      ['base', 1, 'in_progress'],
      ['epic:EPIC-001', 2, 'in_progress'],
      ['epic:EPIC-002', 3, 'not_started']
    ]
  )

  // 只读查看旧会话：phase=null
  const oldState = await service.getDevState(appId, { sessionId: 'old-session' })
  assert.equal(oldState.session?.phase, null)

  // 历史交接包版本的阶段（GET ?handoffVersion=）
  insertHandoff(db, appId, 2, manifestOf(THREE_PHASES))
  const historical = phases.getDevPhases(appId, { handoffVersion: 1 })
  assert.equal(historical.handoffVersion, 1)
  assert.equal(historical.phases.length, 3)
  assert.equal(historical.canGenerate, true, '最新交接包 v2 尚未生成阶段')
  const latest = phases.getDevPhases(appId)
  assert.equal(latest.handoffVersion, 2)
  assert.equal(latest.phases.length, 0)
  assert.throws(() => phases.getDevPhases(appId, { handoffVersion: 9 }), /交接包版本不存在/)

  // 历史阶段只读：skip/reopen/complete 均 409
  assert.throws(() => phases.skipDevPhase(appId, base.id), /历史交接包版本/)
  assert.throws(() => phases.reopenDevPhase(appId, base.id), /历史交接包版本/)
  await assert.rejects(() => phases.completeDevPhase(appId, base.id), /历史交接包版本/)
})

test('U7-1 phase brief 范围与摘要文案；parseManifestPhases 过滤非法项', async () => {
  const { phases } = await setup()
  const brief = phases.buildPhasePrompt({
    order: 2,
    total: 6,
    title: 'EPIC-003 借阅管理',
    goal: '支持借阅与归还',
    scope: {
      kind: 'epic',
      storyIds: ['STORY-005'],
      pageSetCodes: ['PS-003'],
      pageCodes: ['PAGE-011'],
      note: '先做列表'
    },
    previousSummary: '基础阶段已完成'
  })
  assert.match(brief, /你现在在阶段 2\/6：EPIC-003 借阅管理。/)
  assert.match(brief, /目标：支持借阅与归还/)
  assert.match(brief, /范围：Story STORY-005；页面集 PS-003；页面 PAGE-011/)
  assert.match(brief, /交接包：docs\/handoff\/00-README\.md、04-PLAN\.md（阶段章节）、相关 03-PAGES\/02-DATA-MODEL。/)
  assert.match(brief, /只做本阶段范围；不要扩展\/重写其它阶段/)
  assert.match(brief, /语言：请全程使用中文回复；思考\/进度说明也使用中文。/)
  assert.match(brief, /上一阶段摘要：\n基础阶段已完成/)
  assert.ok(!brief.includes('批次'), 'brief 不出现批次')

  const noSummary = phases.buildPhasePrompt({
    order: 1,
    total: 1,
    title: '全量实现',
    goal: '',
    scope: { kind: 'all', storyIds: [], pageSetCodes: [], pageCodes: [] }
  })
  assert.match(noSummary, /目标：全量实现/)
  assert.match(noSummary, /范围：按 `04-PLAN\.md` 阶段章节/)
  assert.match(noSummary, /上一阶段摘要：\n无上一阶段摘要/)

  assert.deepEqual(phases.parseManifestPhases(null), [])
  assert.deepEqual(phases.parseManifestPhases({ phases: 'x' } as unknown as Record<string, unknown>), [])
  const parsed = phases.parseManifestPhases({
    phases: [
      { key: 'base', kind: 'base', title: '基础', goal: '' },
      { key: 'base', kind: 'base', title: '重复 key' },
      { key: 'epic:EPIC-001', kind: 'epic', title: '客户', goal: '  ', storyIds: ['STORY-001', 2, null], pageSetCodes: ['PS-001'] },
      { key: '', kind: 'epic', title: '无 key' },
      { key: 'bad', kind: 'unknown', title: '未知 kind' },
      'invalid'
    ]
  })
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].goal, '基础', '空 goal 回退 title')
  assert.deepEqual(parsed[1].storyIds, ['STORY-001'])
  assert.deepEqual(parsed[1].pageSetCodes, ['PS-001'])
  assert.equal(parsed[1].goal, '客户')

  // lastAssistantText：取最后一条非空 assistant（忽略 user/空 assistant）
  assert.equal(
    phases.lastAssistantText([
      { type: 'user', text: 'u' },
      { type: 'assistant', content: [{ type: 'text', text: '第一' }] },
      { type: 'assistant', content: [{ type: 'text', text: '  ' }] },
      { type: 'assistant', content: [{ type: 'text', text: '第二' }] }
    ]),
    '第二'
  )
  assert.equal(phases.lastAssistantText([{ type: 'user', text: 'u' }]), '')
})

test('U7-1 摘要脱敏：assistant/模型摘要/fallback/brief/GET 均不含明文；摘要 agent 不用 build', async () => {
  const { db, root, phases } = await setup()
  const stub = await stubOpencode()
  const appId = 'phases-scrub'
  seedLargeApp(db, root, appId)
  const generated = phases.generateDevPhases(appId)
  const [base, epic1] = generated.phases

  await phases.startDevPhase(appId, base.id)
  stub.messages.data = [
    {
      type: 'assistant',
      content: [
        {
          type: 'text',
          text: '已完成\nDB password=supersecret\nAuthorization: Bearer abc123token\nredis_password=redissecret'
        }
      ]
    }
  ]

  // 模型摘要里也复述 secret → 落库/返回前必须脱敏
  let capturedPrompt = ''
  let capturedInput = ''
  const modeled = await phases.completeDevPhase(appId, base.id, {
    summarize: async input => {
      capturedPrompt = input.prompt
      capturedInput = input.lastAssistantText
      return '模型摘要 token=leakedtoken\n已完成基础框架'
    }
  })
  assert.equal(modeled.phase.summarySource, 'model')
  assert.match(modeled.phase.summary ?? '', /token=\*\*\*/)
  for (const secret of ['supersecret', 'abc123token', 'redissecret', 'leakedtoken']) {
    assert.ok(!(modeled.phase.summary ?? '').includes(secret), `阶段摘要泄露明文：${secret}`)
    assert.ok(!capturedPrompt.includes(secret), `摘要 prompt 泄露明文：${secret}`)
    assert.ok(!capturedInput.includes(secret), `摘要输入泄露明文：${secret}`)
  }

  // GET /phases（service 层）同样不返回明文
  const listed = JSON.stringify(phases.getDevPhases(appId))
  for (const secret of ['supersecret', 'abc123token', 'redissecret', 'leakedtoken']) {
    assert.ok(!listed.includes(secret), `GET phases 泄露明文：${secret}`)
  }

  // 下一阶段 brief 的“上一阶段摘要”脱敏
  const second = await phases.startDevPhase(appId, epic1.id)
  for (const secret of ['supersecret', 'abc123token', 'redissecret', 'leakedtoken']) {
    assert.ok(!second.defaultPrompt.includes(secret), `phase brief 泄露明文：${secret}`)
  }
  assert.match(second.defaultPrompt, /token=\*\*\*/)

  // fallback 与 warnings 同样脱敏
  phases.reopenDevPhase(appId, base.id)
  stub.messages.data = [
    { type: 'assistant', content: [{ type: 'text', text: '最后回复 password=fallbacksecret' }] }
  ]
  const failed = await phases.completeDevPhase(appId, base.id, {
    summarize: async () => {
      throw new Error('摘要超时 token=errsecret')
    }
  })
  assert.equal(failed.phase.summarySource, 'fallback')
  assert.ok(!(failed.phase.summary ?? '').includes('fallbacksecret'), 'fallback 摘要泄露明文')
  assert.ok(!failed.warnings.join('\n').includes('errsecret'), 'warnings 泄露明文')
  const afterFallback = JSON.stringify(phases.getDevPhases(appId))
  assert.ok(!afterFallback.includes('fallbacksecret'))
  assert.ok(!afterFallback.includes('errsecret'))

  // 旧数据/直接 DB 写入：DevPhaseView 返回前脱敏
  db.prepare('UPDATE app_dev_phases SET summary = ? WHERE id = ?').run('旧数据 password=oldsecret', base.id)
  const oldView = phases.getDevPhases(appId).phases.find(phase => phase.id === base.id)
  assert.ok(!(oldView?.summary ?? '').includes('oldsecret'), '旧 DB 摘要未脱敏')
  // buildPhasePrompt 对 previousSummary 的 defense-in-depth 脱敏
  const brief = phases.buildPhasePrompt({
    order: 2,
    total: 3,
    title: 'EPIC-001 客户管理',
    goal: '支持客户维护',
    scope: { kind: 'epic', storyIds: [], pageSetCodes: [], pageCodes: [] },
    previousSummary: '旧摘要 password=oldsecret'
  })
  assert.ok(!brief.includes('oldsecret'), 'brief previousSummary 未脱敏')

  // 默认摘要器只用无工具 agent：design 优先、req 兜底、绝不 build
  assert.equal(phases.pickSummaryAgent(['design', 'req', 'build']), 'design')
  assert.equal(phases.pickSummaryAgent(['req', 'build']), 'req')
  assert.equal(phases.pickSummaryAgent(['build']), null)
  assert.equal(phases.pickSummaryAgent([]), null)
})

test('U7-1 删除应用清理：deleteDevPhaseData 与 DELETE /api/apps/:id', async () => {
  const { db, root, phases } = await setup()
  const appId = 'phases-delete'
  seedLargeApp(db, root, appId)
  phases.generateDevPhases(appId)
  assert.equal(phaseRows(db, appId).length, 3)

  // 直接清理（apps 删除事务内调用）
  phases.deleteDevPhaseData(appId)
  assert.equal(phaseRows(db, appId).length, 0)

  // 通过 DELETE API 清理（真实 Express + 删除链）
  phases.generateDevPhases(appId)
  assert.equal(phaseRows(db, appId).length, 3)
  const express = (await import('express')).default
  const { apps } = await import('../apps/routes')
  const server = express()
  server.use(express.json())
  server.use('/api/apps', apps)
  server.use((error: Error & { status?: number }, _req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }, _next: unknown) => {
    res.status(error.status ?? 500).json({ error: error.message })
  })
  const started = server.listen(0)
  await new Promise<void>(resolve => started.once('listening', () => resolve()))
  const address = started.address()
  const port = typeof address === 'object' && address ? address.port : 0
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/apps/${appId}?confirm=true`, { method: 'DELETE' })
    assert.equal(response.status, 200)
    assert.equal(phaseRows(db, appId).length, 0)
    const sessionCount = db.prepare('SELECT COUNT(*) AS count FROM app_sessions WHERE app_id = ?').get(appId) as {
      count: number
    }
    assert.equal(sessionCount.count, 0)
    const appCount = db.prepare('SELECT COUNT(*) AS count FROM apps WHERE id = ?').get(appId) as { count: number }
    assert.equal(appCount.count, 0)
  } finally {
    await new Promise<void>(resolve => started.close(() => resolve()))
  }
})
