/**
 * studio service（P7-7b-1）：target/prompt/expected/state/sessions/prompt/compact/interrupt/
 * permission/form/model + 4xx；opencode 内存 stub，不启动 serve、不调模型。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before, beforeEach } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-studio-service-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_AUTO_START = 'false'

const PACK_ID = 'studio-demo'

let db: typeof import('../db').db
let studio: typeof import('./studio')
let draftModule: typeof import('./draft')
let service: typeof import('../chat/service')

interface RuntimeState {
  sessions: Array<{ id: string; directory: string; title?: string }>
  prompts: Array<{ sessionID: string; text: string }>
  commands: Array<{ sessionID: string; name: string; text: string }>
  compacted: string[]
  interrupted: string[]
  permissions: Array<{ sessionID: string; rid: string; decision: string; message?: string }>
  forms: Array<{ sessionID: string; fid: string; answer: unknown }>
}

const runtime: RuntimeState = {
  sessions: [],
  prompts: [],
  commands: [],
  compacted: [],
  interrupted: [],
  permissions: [],
  forms: []
}

function resetRuntime(): void {
  runtime.sessions = []
  runtime.prompts = []
  runtime.commands = []
  runtime.compacted = []
  runtime.interrupted = []
  runtime.permissions = []
  runtime.forms = []
}

async function stubRuntime(): Promise<void> {
  const runtimeModule = await import('../opencode/runtime')
  const rt = runtimeModule.opencode as unknown as Record<string, unknown>
  rt.status = () => ({ ready: false, starting: false })
  rt.listAgents = async () => []
  rt.defaultModel = async () => null
  rt.lastUsedModel = async () => null
  rt.createSession = async (input: { directory: string; title?: string }) => {
    const created = { id: `oc-${runtime.sessions.length + 1}`, directory: input.directory, title: input.title }
    runtime.sessions.push(created)
    return created
  }
  rt.session = async (id: string) => (runtime.sessions.some(session => session.id === id) ? { id, title: id } : null)
  rt.messages = async () => ({ data: [] })
  rt.refreshPending = async () => undefined
  rt.pendingFor = () => ({ permissions: [], forms: [] })
  rt.prompt = async (sessionID: string, text: string) => {
    runtime.prompts.push({ sessionID, text })
  }
  rt.runCommand = async (sessionID: string, name: string, text: string) => {
    runtime.commands.push({ sessionID, name, text })
  }
  rt.interrupt = async (sessionID: string) => {
    runtime.interrupted.push(sessionID)
  }
  rt.compactSession = async (sessionID: string) => {
    runtime.compacted.push(sessionID)
  }
  rt.listSessions = async () => runtime.sessions
  rt.listModels = async () => [{ providerID: 'demo', modelID: 'model-a', id: 'model-a', name: 'Model A', variants: [] }]
  rt.track = () => undefined
  rt.subscribe = () => () => undefined
  rt.replyPermission = async (sessionID: string, rid: string, decision: string, message?: string) => {
    runtime.permissions.push({ sessionID, rid, decision, message })
  }
  rt.replyForm = async (sessionID: string, fid: string, answer: unknown) => {
    runtime.forms.push({ sessionID, fid, answer })
  }
}

before(async () => {
  db = (await import('../db')).db
  service = await import('../chat/service')
  draftModule = await import('./draft')
  studio = await import('./studio')
})

after(() => {
  db?.close()
  try {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
  } catch {
    // Windows 上临时目录偶尔被占用；失败不影响测试结论
  }
})

beforeEach(async () => {
  db.prepare('DELETE FROM app_sessions').run()
  db.prepare('DELETE FROM app_settings').run()
  resetRuntime()
  await stubRuntime()
  if (!draftModule.listDrafts().some(item => item.id === PACK_ID)) {
    draftModule.createDraft({ name: '工作室演示模板', id: PACK_ID, style: 'data-cyan' })
  }
})

test('targetForDraft：id/view/directory/prompt/expected/model key（template 独立）', async () => {
  const target = await studio.targetForDraft(PACK_ID)
  assert.equal(target.id, '__template__:studio-demo')
  assert.equal(target.view, 'template')
  assert.equal(target.allowModule, false)
  assert.equal(target.directory, path.join(root, 'data', 'design-system', '_workshop'))
  assert.equal(target.sessionTitle?.(), '工作室演示模板 · 模板工作室')
  assert.deepEqual(target.expectedSkills(), ['adw-design-template-authoring'])
  assert.deepEqual(target.expectedCommands(), ['generate-design-template'])

  const prompt = target.buildPrompt('做一个供应商列表', {})
  assert.match(prompt, /当前工作室：设计模板编写/)
  assert.match(prompt, /当前模板\/草稿：studio-demo/)
  assert.match(prompt, /只允许写 drafts\/studio-demo\/spec\.json/)
  assert.match(prompt, /catalog（index\/pages\/components\/styles\/recipes）/)
  assert.match(prompt, /generate\.cjs --draft studio-demo/)
  assert.match(prompt, /不要发布/)
  assert.match(prompt, /用户消息：\n做一个供应商列表/)
  assert.equal(studio.studioModelSettingKey(PACK_ID), 'app.__template__:studio-demo.model.template')

  const missing = await studio.targetForDraft('no-such-draft').catch(error => error as Error & { status?: number })
  assert.equal((missing as { status?: number }).status, 404)

  const badId = await studio.targetForDraft('Bad Id').catch(error => error as Error & { status?: number })
  assert.equal((badId as { status?: number }).status, 400)
})

test('无会话：state 为空；prompt/compact/interrupt/permission/form → 409', async () => {
  const state = await studio.studioState(PACK_ID)
  assert.equal(state.view, 'template')
  assert.equal(state.session, null)
  assert.equal(state.state, null)
  assert.equal(state.activeSessionId, null)
  assert.match(state.defaultPrompt, /studio-demo/)
  assert.equal(state.draft.id, PACK_ID)
  assert.equal('pages' in (state.spec ?? {}), true)

  for (const call of [
    () => studio.promptStudioSession(PACK_ID, 'hi'),
    () => studio.interruptStudioSession(PACK_ID),
    () => studio.compactStudioSession(PACK_ID),
    () => studio.replyStudioPermission(PACK_ID, 'r1', 'once'),
    () => studio.replyStudioForm(PACK_ID, 'f1', { ok: true })
  ]) {
    await assert.rejects(call, (error: Error & { status?: number }) => error.status === 409)
  }
  assert.equal(await studio.activeStudioOpencodeSession(PACK_ID), null)
})

test('创建会话：view=template、标题、state/sessions；再建新会话归档旧的', async () => {
  const created = await studio.createStudioSession(PACK_ID)
  assert.equal(created.view, 'template')
  assert.equal(created.session?.view, 'template')
  assert.equal(created.session?.title, '工作室演示模板 · 模板工作室')
  assert.equal(created.state?.pending.permissions.length, 0)
  assert.equal(created.sessions.length, 1)
  assert.equal(created.sessions[0].active, true)
  assert.deepEqual(
    (db.prepare('SELECT app_id, view, title FROM app_sessions').all() as Array<Record<string, unknown>>)[0],
    { app_id: '__template__:studio-demo', view: 'template', title: '工作室演示模板 · 模板工作室' }
  )

  const reused = await studio.createStudioSession(PACK_ID)
  assert.equal(reused.session?.id, created.session?.id, 'new=false 复用活跃会话')

  const second = await studio.createStudioSession(PACK_ID, { new: true })
  assert.notEqual(second.session?.id, created.session?.id)
  const rows = db.prepare('SELECT id, status FROM app_sessions ORDER BY created_at ASC').all() as Array<{
    id: string
    status: string
  }>
  assert.equal(rows.length, 2)
  assert.equal(rows.find(row => row.id === created.session?.id)?.status, 'archived')
  assert.equal(rows.find(row => row.id === second.session?.id)?.status, 'active')
  assert.equal(await studio.activeStudioOpencodeSession(PACK_ID), 'oc-2')
})

test('prompt/command：走 opencode prompt/runCommand，prompt 为工作室框架；无 module', async () => {
  await studio.createStudioSession(PACK_ID)
  const result = await studio.promptStudioSession(PACK_ID, '做供应商列表')
  assert.equal(result.ok, true)
  assert.equal(runtime.prompts.length, 1)
  assert.match(runtime.prompts[0].text, /当前工作室：设计模板编写/)
  assert.match(runtime.prompts[0].text, /用户消息：\n做供应商列表/)

  const command = await studio.promptStudioSession(PACK_ID, PACK_ID, { command: 'generate-design-template' })
  assert.equal(command.command, 'generate-design-template')
  assert.equal(runtime.commands.length, 1)
  assert.equal(runtime.commands[0].name, 'generate-design-template')
  assert.equal(runtime.commands[0].text, PACK_ID)

  await assert.rejects(
    () => studio.promptStudioSession(PACK_ID, '   '),
    (error: Error & { status?: number }) => error.status === 400
  )
})

test('interrupt/compact/permission/form：成功路径 + 参数校验', async () => {
  await studio.createStudioSession(PACK_ID)
  await studio.interruptStudioSession(PACK_ID)
  assert.deepEqual(runtime.interrupted, ['oc-1'])

  const compact = await studio.compactStudioSession(PACK_ID)
  assert.match(compact.message, /压缩/)
  assert.deepEqual(runtime.compacted, ['oc-1'])

  await assert.rejects(
    () => studio.replyStudioPermission(PACK_ID, 'r1', 'nope'),
    (error: Error & { status?: number }) => error.status === 400
  )
  await studio.replyStudioPermission(PACK_ID, 'r1', 'once', 'ok')
  assert.deepEqual(runtime.permissions, [{ sessionID: 'oc-1', rid: 'r1', decision: 'once', message: 'ok' }])

  await studio.replyStudioForm(PACK_ID, 'f1', { answer: 42 })
  assert.deepEqual(runtime.forms, [{ sessionID: 'oc-1', fid: 'f1', answer: { answer: 42 } }])
})

test('rename/activate/archive：只影响 template 会话', async () => {
  const first = await studio.createStudioSession(PACK_ID)
  const second = await studio.createStudioSession(PACK_ID, { new: true })

  const renamed = await studio.renameStudioSession(PACK_ID, first.session!.id, { title: '旧会话', note: '备注' })
  assert.equal(renamed.title, '旧会话')
  assert.equal(renamed.note, '备注')
  await assert.rejects(
    () => studio.renameStudioSession(PACK_ID, first.session!.id, {}),
    (error: Error & { status?: number }) => error.status === 400
  )
  await assert.rejects(
    () => studio.renameStudioSession(PACK_ID, first.session!.id, { title: 'x'.repeat(121) }),
    (error: Error & { status?: number }) => error.status === 400
  )

  const activated = await studio.activateStudioSession(PACK_ID, first.session!.id)
  assert.equal(activated.session?.id, first.session?.id)
  assert.deepEqual(runtime.interrupted, ['oc-2'], '切换会停止当前会话')

  const archived = await studio.archiveStudioSessionById(PACK_ID, second.session!.id)
  assert.deepEqual(archived, { ok: true, sessionId: second.session!.id, status: 'archived' })

  await assert.rejects(
    () => studio.activateStudioSession(PACK_ID, 'missing'),
    (error: Error & { status?: number }) => error.status === 404
  )
})

test('model：stage=template 独立键；不继承应用模型；非法模型 400', async () => {
  const initial = await studio.getStudioModel(PACK_ID)
  assert.equal(initial.stage, 'template')
  assert.equal(initial.agent, 'build')
  assert.equal(initial.model, null)

  // 同一合成 id 的 requirements 模型不应被 template 继承
  service.saveStoredModel('__template__:studio-demo', 'requirements', { providerID: 'demo', id: 'app-model' })
  assert.equal((await studio.getStudioModel(PACK_ID)).model, null)

  const saved = await studio.saveStudioModel(PACK_ID, { providerID: 'demo', id: 'model-a' })
  assert.deepEqual(saved, { ok: true, stage: 'template', model: { providerID: 'demo', id: 'model-a' } })
  assert.deepEqual((await studio.getStudioModel(PACK_ID)).model, { providerID: 'demo', id: 'model-a' })
  const keys = db.prepare('SELECT key FROM app_settings ORDER BY key').all() as Array<{ key: string }>
  assert.deepEqual(
    keys.map(row => row.key),
    ['app.__template__:studio-demo.model.requirements', 'app.__template__:studio-demo.model.template']
  )

  const cleared = await studio.saveStudioModel(PACK_ID, null)
  assert.deepEqual(cleared, { ok: true, stage: 'template', model: null })
  assert.equal((await studio.getStudioModel(PACK_ID)).model, null)

  await assert.rejects(
    () => studio.saveStudioModel(PACK_ID, { providerID: 'demo', id: 'missing' }),
    (error: Error & { status?: number }) => error.status === 400
  )
  await assert.rejects(
    () => studio.saveStudioModel(PACK_ID, { providerID: 'demo' }),
    (error: Error & { status?: number }) => error.status === 400
  )
})
