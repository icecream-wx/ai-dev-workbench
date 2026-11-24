/**
 * 会话服务：无交接包门禁、按 view 过滤、创建/切换/归档、compact
 * opencode 运行时用内存 stub（不启动 serve、不调用模型）。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, beforeEach } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-dev-service-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

interface Setup {
  db: typeof import('../db').db
  service: typeof import('./service')
}

let setupPromise: Promise<Setup> | null = null

async function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const dbModule = await import('../db')
    return { db: dbModule.db, service: await import('./service') }
  })()
  return setupPromise
}

const runtimeState = {
  sessions: [] as Array<{ id: string; directory: string }>,
  prompts: [] as Array<{ sessionID: string; text: string }>,
  commands: [] as Array<{ sessionID: string; name: string; text: string }>,
  compacted: [] as string[]
}

async function stubRuntime(): Promise<void> {
  const runtime = await import('../opencode/runtime')
  const rt = runtime.opencode as unknown as Record<string, unknown>
  rt.status = () => ({ ready: false })
  rt.listAgents = async () => []
  rt.defaultModel = async () => null
  rt.lastUsedModel = async () => null
  rt.session = async (id: string) => (id.startsWith('oc-') ? { id, title: id } : null)
  rt.createSession = async (input: { directory: string }) => {
    const created = { id: `oc-${runtimeState.sessions.length + 1}`, directory: input.directory }
    runtimeState.sessions.push(created)
    return created
  }
  rt.track = () => undefined
  rt.messages = async () => ({ data: [] })
  rt.refreshPending = async () => undefined
  rt.pendingFor = () => ({ permissions: [], forms: [] })
  rt.prompt = async (sessionID: string, text: string) => {
    runtimeState.prompts.push({ sessionID, text })
  }
  rt.runCommand = async (sessionID: string, name: string, text: string) => {
    runtimeState.commands.push({ sessionID, name, text })
  }
  rt.interrupt = async () => undefined
  rt.compactSession = async (sessionID: string) => {
    runtimeState.compacted.push(sessionID)
  }
  rt.listSessions = async () => runtimeState.sessions
}

after(async () => {
  const { db } = await setup()
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

async function seedApp(id: string, withDir = true): Promise<void> {
  const { db } = await setup()
  const now = new Date().toISOString()
  db.prepare('DELETE FROM apps WHERE id = ?').run(id)
  db.prepare(
    `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 8093, 'development', ?, ?)`
  ).run(id, `应用 ${id}`, id, now, now)
  if (withDir) fs.mkdirSync(path.join(projects, id), { recursive: true })
}

beforeEach(async () => {
  const { db } = await setup()
  runtimeState.sessions = []
  runtimeState.prompts = []
  runtimeState.commands = []
  runtimeState.compacted = []
  db.prepare('DELETE FROM app_sessions').run()
  db.prepare('DELETE FROM apps').run()
  await stubRuntime()
})

test('缺少应用 → 404；缺少应用目录 → 409（无交接包门禁）', async () => {
  const { service } = await setup()
  await assert.rejects(() => service.getDevState('nope'), /应用不存在/)
  await seedApp('dev-no-dir', false)
  await assert.rejects(() => service.getDevState('dev-no-dir'), /应用目录不存在/)
})

test('创建会话：默认开发视图；可按 view 创建需求/设计会话', async () => {
  const { db, service } = await setup()
  await seedApp('dev-app')
  const development = await service.createDevSession('dev-app')
  assert.equal(development.view, 'development')
  assert.ok(development.session?.opencodeSessionId)
  assert.match(development.defaultPrompt, /AGENTS\.md/)
  assert.match(development.defaultPrompt, /docs\/requirements\//)
  assert.match(development.defaultPrompt, /docs\/design\//)
  assert.equal(development.defaultPrompt.includes('交接包'), false)

  const requirements = await service.createDevSession('dev-app', { view: 'requirements' })
  assert.equal(requirements.view, 'requirements')
  assert.equal(runtimeState.sessions.length, 2)

  const rows = db
    .prepare('SELECT view, status FROM app_sessions WHERE app_id = ? ORDER BY created_at ASC')
    .all('dev-app') as Array<{ view: string; status: string }>
  assert.deepEqual(
    rows.map(row => row.view),
    ['development', 'requirements']
  )
  assert.ok(rows.every(row => row.status === 'active'))
})

test('列表按视图过滤；改名/归档只影响该会话', async () => {
  const { service } = await setup()
  await seedApp('dev-list')
  const dev = await service.createDevSession('dev-list')
  const req = await service.createDevSession('dev-list', { view: 'requirements' })

  const devList = await service.listDevSessions('dev-list')
  assert.equal(devList.sessions.length, 1)
  assert.equal(devList.sessions[0].id, dev.session?.id)
  const reqList = await service.listDevSessions('dev-list', { view: 'requirements' })
  assert.equal(reqList.sessions.length, 1)
  assert.equal(reqList.sessions[0].id, req.session?.id)

  const renamed = await service.renameDevSession('dev-list', dev.session!.id, { title: '改造会话' })
  assert.equal(renamed.title, '改造会话')

  const archived = await service.archiveDevSessionById('dev-list', dev.session!.id)
  assert.equal(archived.status, 'archived')
  assert.equal((await service.listDevSessions('dev-list', { view: 'requirements' })).sessions[0].status, 'active')
})

test('发送消息/压缩：按视图取活跃会话；其它视图无会话 → 409', async () => {
  const { service } = await setup()
  await seedApp('dev-prompt')
  await service.createDevSession('dev-prompt', { view: 'requirements' })
  await service.promptDevSession('dev-prompt', '写需求', { view: 'requirements' })
  assert.equal(runtimeState.prompts.length, 1)
  assert.match(runtimeState.prompts[0].text, /用户消息：\n写需求/)

  const compact = await service.compactDevSession('dev-prompt', { view: 'requirements' })
  assert.match(compact.message, /压缩/)
  assert.equal(runtimeState.compacted[0], 'oc-1')

  await assert.rejects(
    () => service.compactDevSession('dev-prompt'),
    (error: Error & { status?: number }) => error.status === 409
  )
  await assert.rejects(
    () => service.promptDevSession('dev-prompt', 'hi'),
    (error: Error & { status?: number }) => error.status === 409
  )
})

test('三个视图都用 buildViewPrompt：requirements/design/development 均带视图与产物路径（无模块）', async () => {
  const { service } = await setup()
  await seedApp('dev-prompt-view')
  await service.createDevSession('dev-prompt-view', { view: 'requirements' })

  await service.promptDevSession('dev-prompt-view', '加一个字段', { view: 'requirements' })
  assert.equal(runtimeState.prompts.length, 1)
  const requirementsPrompt = runtimeState.prompts[0].text
  assert.match(requirementsPrompt, /当前视图：需求/)
  assert.match(requirementsPrompt, /docs\/requirements\/requirements\.md/)
  assert.match(requirementsPrompt, /EP-001/)
  assert.match(requirementsPrompt, /adw-requirements-document/)
  assert.match(requirementsPrompt, /用户消息：\n加一个字段/)
  assert.equal(requirementsPrompt.includes('本轮目标模块'), false)

  await service.createDevSession('dev-prompt-view', { view: 'design' })
  await service.promptDevSession('dev-prompt-view', '补一个页面', { view: 'design' })
  const designPrompt = runtimeState.prompts[1].text
  assert.match(designPrompt, /当前视图：设计/)
  assert.match(designPrompt, /docs\/design\/entities\.json/)
  assert.match(designPrompt, /docs\/design\/pages\.json/)
  assert.match(designPrompt, /adw-design-artifacts/)

  await service.createDevSession('dev-prompt-view', { view: 'development' })
  await service.promptDevSession('dev-prompt-view', '请实现列表页', { view: 'development' })
  const developmentPrompt = runtimeState.prompts[2].text
  assert.match(developmentPrompt, /当前视图：开发/)
  assert.match(developmentPrompt, /AGENTS\.md/)
  assert.match(developmentPrompt, /docs\/requirements\//)
  assert.match(developmentPrompt, /docs\/design\//)
  assert.match(developmentPrompt, /用户消息：\n请实现列表页/)
  assert.notEqual(developmentPrompt, '请实现列表页', 'development 不再原文直发')
})

test('开发视图：prompt 注入应用级设计摘要并生成 ui-check 骨架', async () => {
  const { service } = await setup()
  await seedApp('dev-linkage')
  const appDir = path.join(projects, 'dev-linkage')
  const designDir = path.join(appDir, 'docs', 'design')
  fs.mkdirSync(designDir, { recursive: true })
  fs.writeFileSync(
    path.join(designDir, 'design-system.json'),
    JSON.stringify({
      schemaVersion: 1,
      pack: 'afcenter-app-templates-v1',
      applicationType: 'enterprise-application-platform',
      applicationTypeName: '企业级应用管理平台',
      style: 'platform-blue',
      styleName: '平台蓝白',
      blueprintRoot: 'docs/design/template',
      templateDir: 'docs/design/template/enterprise-application-platform',
      pages: [
        {
          id: 'organization',
          name: '组织与用户',
          recipe: 'tree-list',
          blueprint: 'docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue'
        }
      ]
    }),
    'utf8'
  )
  fs.writeFileSync(
    path.join(designDir, 'entities.json'),
    JSON.stringify({
      schemaVersion: 2,
      entities: [{ id: 'product', name: '商品', fields: [{ code: 'productName', name: '商品名称', type: 'string' }] }],
      relations: []
    }),
    'utf8'
  )
  fs.writeFileSync(
    path.join(designDir, 'pages.json'),
    JSON.stringify({
      schemaVersion: 2,
      pageSets: [
        {
          id: 'product',
          epic: 'EP-001',
          title: '商品管理',
          pages: [
            {
              id: 'product-list',
              name: '商品列表',
              type: 'list',
              recipe: 'tree-list',
              entity: 'product',
              columns: ['productName', 'status'],
              rowActions: ['edit', 'delete'],
              blueprint: 'application-types/enterprise-application-platform/pages/OrganizationUsers.vue'
            }
          ]
        }
      ]
    }),
    'utf8'
  )

  const created = await service.createDevSession('dev-linkage', { view: 'development' })
  assert.equal(created.view, 'development')
  assert.match(created.defaultPrompt, /docs\/design\/design-system\.json/)
  assert.match(created.defaultPrompt, /docs\/design\/entities\.json/)
  assert.match(created.defaultPrompt, /docs\/design\/pages\.json/)
  assert.match(created.defaultPrompt, /ui-check\.md/)
  assert.doesNotMatch(created.defaultPrompt, /本轮目标模块/)

  await service.promptDevSession('dev-linkage', '实现列表页', { view: 'development' })
  const prompt = runtimeState.prompts[0].text
  assert.match(prompt, /设计摘要/)
  assert.match(prompt, /afcenter-app-templates-v1/)
  assert.match(prompt, /EP-001 商品管理/)
  assert.match(prompt, /product-list 商品列表/)
  assert.match(prompt, /列=productName\/status/)
  assert.match(prompt, /ui-check：已生成未填/)
  assert.match(prompt, /用户消息：\n实现列表页/)

  const uiCheckFile = path.join(designDir, 'ui-check.md')
  assert.equal(fs.existsSync(uiCheckFile), true)
  assert.match(fs.readFileSync(uiCheckFile, 'utf8'), /product-list/)

  // 已存在不覆盖
  fs.appendFileSync(uiCheckFile, '\n- 人工补充\n', 'utf8')
  await service.promptDevSession('dev-linkage', '继续', { view: 'development' })
  assert.match(fs.readFileSync(uiCheckFile, 'utf8'), /人工补充/)
  assert.match(runtimeState.prompts[1].text, /ui-check：已填/)
})

test('command 分支：走 runCommand（text 作为参数），不发普通 prompt', async () => {
  const { service } = await setup()
  await seedApp('dev-command')
  await service.createDevSession('dev-command', { view: 'requirements' })

  const result = await service.promptDevSession('dev-command', 'EP-001', {
    view: 'requirements',
    command: 'update-requirements'
  })
  assert.equal(result.ok, true)
  assert.equal(result.command, 'update-requirements')
  assert.equal(runtimeState.prompts.length, 0)
  assert.equal(runtimeState.commands.length, 1)
  assert.equal(runtimeState.commands[0].name, 'update-requirements')
  assert.equal(runtimeState.commands[0].text, 'EP-001')
  assert.equal(runtimeState.commands[0].sessionID, 'oc-1')

  // 空文本 + command 允许（例如无参命令）
  await service.promptDevSession('dev-command', '', { view: 'requirements', command: 'check-consistency' })
  assert.equal(runtimeState.commands.length, 2)
  assert.equal(runtimeState.commands[1].text, '')

  // 空文本 + 无 command → 400
  await assert.rejects(
    () => service.promptDevSession('dev-command', '   ', { view: 'requirements' }),
    (error: Error & { status?: number }) => error.status === 400
  )
})

test('extractSecrets 跳过占位符，提取非空密码/密钥', async () => {
  const { service } = await setup()
  const secrets = service.extractSecrets(
    'user-config.xml',
    '<config><configValue key="C3p0-Password">realpass</configValue><configValue key="Mail-Password">CHANGE_ME</configValue></config>'
  )
  assert.deepEqual(secrets, ['realpass'])
  assert.deepEqual(service.extractSecrets('application.properties', 'spring.datasource.password = s3cret\nserver.port=8080'), [
    's3cret'
  ])
})

test('未知会话 → 404', async () => {
  const { service } = await setup()
  await seedApp('dev-404')
  await assert.rejects(
    () => service.renameDevSession('dev-404', 'missing', { title: 'x' }),
    (error: Error & { status?: number }) => error.status === 404
  )
})
