import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

interface Setup {
  root: string
  db: typeof import('../db').db
  service: typeof import('./service')
}

let setupPromise: Promise<Setup> | null = null

async function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-dev-'))
    process.env.RG_DATA_DIR = path.join(root, 'data')
    process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
    const dbModule = await import('../db')
    const service = await import('./service')
    return { root, db: dbModule.db, service }
  })()
  return setupPromise
}

after(async () => {
  if (!setupPromise) return
  const { root, db } = await setupPromise
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

function insertApp(
  db: Setup['db'],
  id: string,
  status: string,
  options: { designConfirmed?: boolean } = {}
): void {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO apps (id, name, description, dir, backend_port, status, design_confirmed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, `应用 ${id}`, null, id, 8081, status, options.designConfirmed ? now : null, now, now)
  fs.mkdirSync(path.join(process.env.RG_PROJECTS_DIR as string, id, 'docs', 'handoff'), { recursive: true })
}

test('getDevState 在缺少交接包或阶段不对时给出明确错误', async () => {
  const { db, service } = await setup()
  insertApp(db, 'dev-no-handoff', 'development', { designConfirmed: true })
  await assert.rejects(() => service.getDevState('dev-no-handoff'), (error: Error) => {
    assert.match(error.message, /交接包不存在/)
    return true
  })

  insertApp(db, 'dev-design', 'design')
  await assert.rejects(() => service.getDevState('dev-design'), (error: Error) => {
    assert.match(error.message, /请先完成设计阶段/)
    return true
  })
})

test('没有会话时返回默认提示，且 prompt 给出明确错误', async () => {
  const { db, root, service } = await setup()
  insertApp(db, 'dev-ready', 'development', { designConfirmed: true })
  fs.writeFileSync(
    path.join(root, 'projects', 'dev-ready', 'docs', 'handoff', '00-README.md'),
    '# 交接包\n',
    'utf8'
  )
  const state = await service.getDevState('dev-ready')
  assert.equal(state.session, null)
  assert.equal(state.state, null)
  assert.equal(state.handoffReady, true)
  assert.match(state.defaultPrompt, /docs\/handoff\/00-README\.md/)

  await assert.rejects(() => service.promptDevSession('dev-ready', '开始'), (error: Error) => {
    assert.match(error.message, /没有开发会话/)
    return true
  })
  assert.deepEqual(await service.archiveDevSession('dev-ready'), { ok: true })
})

test('#3 开发首条提示都包含中文要求（初次/重新生成/变更单）', async () => {
  const { service } = await setup()
  const phrase = /请全程使用中文回复；思考\/进度说明也使用中文。/
  const initial = service.buildDevPrompt(null)
  assert.match(initial, /docs\/handoff\/00-README\.md/)
  assert.match(initial, phrase)
  const regenerated = service.buildDevPrompt({
    version: 2,
    changeSet: { id: 'cs-1', seq: 1, title: '初始开发', status: 'development' }
  })
  assert.match(regenerated, /05-CHANGES\.md/)
  assert.match(regenerated, phrase)
  const changed = service.buildDevPrompt({
    version: 3,
    baselineHandoffVersion: 1,
    changeSet: { id: 'cs-2', seq: 2, title: '批量导入', status: 'requirements' }
  })
  assert.match(changed, /这是第 2 次变更/)
  assert.match(changed, phrase)
})

test('extractSecrets 只提取非占位密码/密钥', async () => {
  const { service } = await setup()
  const xml = [
    '<application>',
    '<!-- <configValue key="C3p0-Password">example</configValue> -->',
    '<configValue key="C3p0-Password">real-secret</configValue>',
    '<configValue key="C3p0-UserName">root</configValue>',
    '</application>'
  ].join('\n')
  assert.deepEqual(service.extractSecrets('user-config.xml', xml), ['real-secret'])

  const properties = [
    'spring.datasource.password=real-secret',
    '# spring.data.redis.password=commented',
    'eos.application.sys-key=CHANGE_ME',
    'nacos.password=${NACOS_PASSWORD:}'
  ].join('\n')
  assert.deepEqual(service.extractSecrets('application.properties', properties), ['real-secret'])
})

test('app_sessions 表可写入/查询/清理', async () => {
  const { db, service } = await setup()
  insertApp(db, 'dev-session-row', 'development', { designConfirmed: true })
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO app_sessions (id, app_id, stage, opencode_session_id, provider_id, model_id, status, created_at, updated_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('row-1', 'dev-session-row', 'development', 'oc-1', 'p', 'm', 'active', now, now, null)
  assert.equal(service.activeSessionRow('dev-session-row')?.opencode_session_id, 'oc-1')
  db.prepare('DELETE FROM app_sessions WHERE app_id = ?').run('dev-session-row')
  assert.equal(service.activeSessionRow('dev-session-row'), undefined)
})

/** I-10：用内存 stub 替换 opencode runtime，避免单测启动真实 serve */
async function stubOpencode(
  options: {
    missing?: string[]
    ready?: boolean
    // I-09a
    models?: Array<{ providerID: string; modelID: string; id: string; limit?: unknown }>
    messages?: unknown[]
    compactError?: Error
  } = {}
): Promise<{
  interrupted: string[]
  compacted: string[]
  sessions: Array<{ id: string; title?: string }>
  missing: Set<string>
  ready: { value: boolean }
  messages: { data: unknown[] }
  models: Array<{ providerID: string; modelID: string; id: string; limit?: unknown }>
  compactError: { value: Error | null }
}> {
  const { opencode } = await import('../opencode/runtime')
  const target = opencode as unknown as Record<string, unknown>
  const interrupted: string[] = []
  const compacted: string[] = []
  const sessions: Array<{ id: string; title?: string }> = []
  const missing = new Set(options.missing ?? [])
  const ready = { value: options.ready ?? true }
  const messages = { data: options.messages ?? [] }
  const models = options.models ?? []
  const compactError: { value: Error | null } = { value: options.compactError ?? null }
  target.status = () => ({
    ready: ready.value,
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
  target.listSessions = async () => sessions
  target.listModels = async () => models
  target.session = async (id: string) => (missing.has(id) ? null : { id, title: `opencode ${id}` })
  target.messages = async () => ({ data: messages.data })
  target.refreshPending = async () => undefined
  target.pendingFor = () => ({ permissions: [], forms: [] })
  target.interrupt = async (id: string) => {
    interrupted.push(id)
    return {}
  }
  target.compactSession = async (id: string) => {
    if (compactError.value) throw compactError.value
    compacted.push(id)
    return { ok: true }
  }
  return { interrupted, compacted, sessions, missing, ready, messages, models, compactError }
}

function insertSession(
  db: Setup['db'],
  appId: string,
  id: string,
  opencodeId: string,
  status: string,
  createdAt: string,
  extra: { title?: string; note?: string; changeSetId?: string; handoffVersion?: number } = {}
): void {
  db.prepare(
    `INSERT INTO app_sessions
       (id, app_id, stage, opencode_session_id, provider_id, model_id, status,
        change_set_id, handoff_version, handoff_hash, title, note, created_at, updated_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    appId,
    'development',
    opencodeId,
    'packycode-deepseek',
    'deepseek-flash',
    status,
    extra.changeSetId ?? null,
    extra.handoffVersion ?? 1,
    'hash-1',
    extra.title ?? null,
    extra.note ?? null,
    createdAt,
    createdAt,
    null
  )
}

function writeHandoff(root: string, appId: string): void {
  fs.mkdirSync(path.join(root, 'projects', appId, 'docs', 'handoff'), { recursive: true })
  fs.writeFileSync(path.join(root, 'projects', appId, 'docs', 'handoff', '00-README.md'), '# 交接包\n', 'utf8')
}

test('I-10：会话列表/切换/重命名/归档/只读/失效/跨应用', async () => {
  const { db, root, service } = await setup()
  const stub = await stubOpencode()
  const appId = 'dev-sessions'
  insertApp(db, appId, 'development', { designConfirmed: true })
  writeHandoff(root, appId)
  insertSession(db, appId, 'row-a', 'oc-a', 'active', '2026-11-11T01:00:00.000Z', { title: null })
  insertSession(db, appId, 'row-b', 'oc-b', 'archived', '2026-11-11T02:00:00.000Z', { note: '第二会话' })
  stub.sessions.push({ id: 'oc-a', title: 'opencode 自动标题 A' }, { id: 'oc-b' })

  // opencode 未运行：opencodeExists=null，不误判 stale；标题回退到 opencode/应用名
  stub.ready.value = false
  const offline = await service.listDevSessions(appId)
  assert.equal(offline.sessions.length, 2)
  assert.equal(offline.sessions[0].id, 'row-b')
  assert.equal(offline.sessions[0].displayTitle, `应用 ${appId} · ${service.dateTimeLabel(offline.sessions[0].createdAt)}`)
  assert.equal(offline.sessions[0].note, '第二会话')
  assert.equal(offline.sessions[0].opencodeExists, null)
  assert.equal(offline.activeSessionId, 'row-a')

  // opencode 可用：合并标题与存在性
  stub.ready.value = true
  const listed = await service.listDevSessions(appId)
  assert.equal(listed.sessions.find(item => item.id === 'row-a')?.displayTitle, 'opencode 自动标题 A')
  assert.equal(listed.sessions.find(item => item.id === 'row-a')?.opencodeExists, true)
  assert.equal(listed.sessions.find(item => item.id === 'row-b')?.status, 'archived')

  // 只读查看归档会话
  const archived = await service.getDevState(appId, { sessionId: 'row-b' })
  assert.equal(archived.readOnly, true)
  assert.equal(archived.session?.status, 'archived')
  assert.equal(archived.state?.status, 'idle')

  // 重命名：长度校验、空 title 清除、备注
  await assert.rejects(() => service.renameDevSession(appId, 'row-a', { title: 'x'.repeat(121) }), /title 最多 120/)
  const renamed = await service.renameDevSession(appId, 'row-a', { title: '  会话 A  ', note: '备注 A' })
  assert.equal(renamed.title, '会话 A')
  assert.equal(renamed.displayTitle, '会话 A')
  assert.equal(renamed.note, '备注 A')
  const cleared = await service.renameDevSession(appId, 'row-a', { title: '   ' })
  assert.equal(cleared.title, null)
  assert.equal(cleared.displayTitle, 'opencode 自动标题 A')

  // 切换：当前 active 先 interrupt，再归档；目标置 active
  const activated = await service.activateDevSession(appId, 'row-b')
  assert.deepEqual(stub.interrupted, ['oc-a'])
  assert.equal(activated.session?.id, 'row-b')
  assert.equal(activated.readOnly, false)
  assert.equal(service.activeSessionRow(appId)?.id, 'row-b')
  const previous = db.prepare('SELECT status FROM app_sessions WHERE id = ?').get('row-a') as { status: string }
  assert.equal(previous.status, 'archived')

  // 归档 active：interrupt 后无 active；随后回复权限只允许 active
  const archivedActive = await service.archiveDevSessionById(appId, 'row-b')
  assert.equal(archivedActive.status, 'archived')
  assert.deepEqual(stub.interrupted, ['oc-a', 'oc-b'])
  assert.equal(service.activeSessionRow(appId), undefined)
  const empty = await service.getDevState(appId)
  assert.equal(empty.session, null)
  assert.equal(empty.readOnly, false)
  await assert.rejects(() => service.replyDevPermission(appId, 'rid', 'once'), /没有开发会话/)
  // 归档幂等
  assert.equal((await service.archiveDevSessionById(appId, 'row-b')).status, 'archived')

  // 目标 opencode 会话已不存在 → 标记 stale + 409
  stub.missing.add('oc-b')
  await assert.rejects(() => service.activateDevSession(appId, 'row-b'), (error: Error & { status?: number }) => {
    assert.equal(error.status, 409)
    assert.match(error.message, /会话已失效/)
    return true
  })
  const stale = await service.getDevState(appId, { sessionId: 'row-b' })
  assert.equal(stale.readOnly, true)
  assert.equal(stale.session?.status, 'stale')
  assert.equal(stale.state, null)

  // 跨应用 404
  insertApp(db, 'dev-sessions-other', 'development', { designConfirmed: true })
  writeHandoff(root, 'dev-sessions-other')
  await assert.rejects(() => service.activateDevSession('dev-sessions-other', 'row-a'), (error: Error & { status?: number }) => {
    assert.equal(error.status, 404)
    return true
  })
  await assert.rejects(() => service.renameDevSession('dev-sessions-other', 'row-a', { title: 'x' }), /会话不存在/)
})

test('I-09a：contextWithLimit 阈值 60% 黄 / 85% 红 / limit 未知', async () => {
  const { service } = await setup()
  assert.deepEqual(service.contextWithLimit(0, 1000), { used: 0, limit: 1000, percent: 0, level: 'ok' })
  assert.equal(service.contextWithLimit(599, 1000).level, 'ok')
  assert.equal(service.contextWithLimit(600, 1000).level, 'warn')
  assert.equal(service.contextWithLimit(849, 1000).level, 'warn')
  assert.equal(service.contextWithLimit(850, 1000).level, 'danger')
  assert.equal(service.contextWithLimit(1000, 1000).level, 'danger')
  assert.equal(service.contextWithLimit(1000, 1000).percent, 1)
  assert.deepEqual(service.contextWithLimit(65, null), { used: 65, limit: null, percent: null, level: 'unknown' })
  assert.equal(service.contextWithLimit(-1, 1000).used, 0)
  // limit.context 提取
  assert.equal(service.contextLimitOf({ context: 1048576, output: 32768 }), 1048576)
  assert.equal(service.contextLimitOf({ output: 32768 }), null)
  assert.equal(service.contextLimitOf(undefined), null)
})

test('I-09a：开发状态按模型 limit 补齐 context（含归档只读会话），无 limit 为 unknown', async () => {
  const { db, root, service } = await setup()
  const stub = await stubOpencode({
    models: [
      { providerID: 'packycode-deepseek', modelID: 'deepseek-flash', id: 'deepseek-flash', limit: { context: 1000, output: 100 } },
      // 另一个模型元数据缺失 limit
      { providerID: 'packycode-deepseek', modelID: 'no-limit', id: 'no-limit' }
    ],
    messages: [
      { id: 'u1', type: 'user', text: '开始', time: { created: 1 } },
      {
        id: 'a1',
        type: 'assistant',
        content: [{ type: 'text', text: '好' }],
        tokens: { input: 600, output: 10, cache: { read: 200, write: 0 } },
        time: { created: 2 }
      }
    ]
  })
  service.clearDevModelLimitCache()
  const appId = 'dev-health'
  insertApp(db, appId, 'development', { designConfirmed: true })
  writeHandoff(root, appId)
  insertSession(db, appId, 'row-active', 'oc-active', 'active', '2026-11-11T01:00:00.000Z')
  insertSession(db, appId, 'row-archived', 'oc-archived', 'archived', '2026-11-11T02:00:00.000Z')

  const state = await service.getDevState(appId)
  assert.equal(state.state?.context.used, 800)
  assert.equal(state.state?.context.limit, 1000)
  assert.equal(state.state?.context.percent, 0.8)
  assert.equal(state.state?.context.level, 'warn')
  // 聚合 tokens 不参与上下文
  assert.equal(state.state?.stats.tokens.input, 0)

  // 归档只读会话同样带 context
  const archived = await service.getDevState(appId, { sessionId: 'row-archived' })
  assert.equal(archived.readOnly, true)
  assert.equal(archived.state?.context.limit, 1000)
  assert.equal(archived.state?.context.level, 'warn')

  // 模型没有 limit → percent=null / level=unknown
  service.clearDevModelLimitCache()
  db.prepare(`UPDATE app_sessions SET model_id = 'no-limit' WHERE id = 'row-active'`).run()
  const unknown = await service.getDevState(appId)
  assert.equal(unknown.state?.context.limit, null)
  assert.equal(unknown.state?.context.percent, null)
  assert.equal(unknown.state?.context.level, 'unknown')

  // opencode 未就绪 → 不启动、按未知返回（used 仍可用）
  service.clearDevModelLimitCache()
  stub.ready.value = false
  const offline = await service.getDevState(appId)
  assert.equal(offline.state?.context.used, 800)
  assert.equal(offline.state?.context.limit, null)
  assert.equal(offline.state?.context.level, 'unknown')
  stub.ready.value = true
})

test('I-09a：compact 需要 active 会话；成功记录 context-compacted；opencode 错误透传', async () => {
  const { db, root, service } = await setup()
  const stub = await stubOpencode()
  const appId = 'dev-compact'
  insertApp(db, appId, 'development', { designConfirmed: true })
  writeHandoff(root, appId)

  // 无 active → 409
  await assert.rejects(() => service.compactDevSession(appId), (error: Error & { status?: number }) => {
    assert.equal(error.status, 409)
    assert.match(error.message, /当前没有进行中的开发会话/)
    return true
  })
  assert.deepEqual(stub.compacted, [])

  insertSession(db, appId, 'row-compact', 'oc-compact', 'active', '2026-11-11T01:00:00.000Z')
  const result = await service.compactDevSession(appId)
  assert.deepEqual(result, { ok: true, message: '已请求压缩上下文，将在下一步生效' })
  assert.deepEqual(stub.compacted, ['oc-compact'])
  const event = db
    .prepare(`SELECT event, detail FROM app_stage_events WHERE app_id = ? ORDER BY rowid DESC LIMIT 1`)
    .get(appId) as { event: string; detail: string | null }
  assert.equal(event.event, 'context-compacted')
  assert.match(event.detail ?? '', /oc-compact/)

  // opencode 报错 → 原样透传（可读、带 status），不变成 500
  stub.compactError.value = Object.assign(new Error('压缩上下文失败（HTTP 400）：busy'), { status: 400 })
  await assert.rejects(() => service.compactDevSession(appId), (error: Error & { status?: number }) => {
    assert.equal(error.status, 400)
    assert.match(error.message, /压缩上下文失败/)
    return true
  })
  stub.compactError.value = null

  // 归档会话不能触发 compact（只认 active）
  await service.archiveDevSessionById(appId, 'row-compact')
  await assert.rejects(() => service.compactDevSession(appId), /当前没有进行中的开发会话/)
})

