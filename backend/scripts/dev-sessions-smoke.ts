/**
 * I-10 开发会话列表 API 冒烟
 *
 * 真实 Express + 临时 SQLite/projects + 真实 opencode serve（不调用模型）：
 * 创建 doc 应用 → 需求/设计/交接包 v1 → 会话 A → 新会话 B（A 归档）
 * → 列表（分组字段/标题/状态/opencodeExists）→ 重命名 A → 只读查看 A
 * → 恢复 A（B 归档）→ 归档 A（无 active）→ 新建 C → 失效目标 409 → 删除应用。
 *
 * 运行：npm run smoke:dev-sessions --prefix backend
 * 可选环境变量：
 * - DEV_SESSIONS_SMOKE_PORT（默认 3416）
 * - DEV_SESSIONS_SMOKE_OPENCODE=0（不启动 opencode；会跳过创建会话相关断言）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-dev-sessions-smoke-'))
const port = Number(process.env.DEV_SESSIONS_SMOKE_PORT ?? 3416)
const opencodeEnabled = process.env.DEV_SESSIONS_SMOKE_OPENCODE !== '0'
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = opencodeEnabled ? 'true' : 'false'

const base = `http://127.0.0.1:${port}`
const appId = 'dev-sessions-smoke'
const appName = '开发会话列表冒烟'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03])

interface ApiResult {
  status: number
  data: unknown
}

async function request(method: string, apiPath: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch(`${base}/api${apiPath}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

function assertOk(result: ApiResult, label: string): Record<string, unknown> {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${label} 失败（HTTP ${result.status}）：${JSON.stringify(result.data)}`)
  }
  return (result.data ?? {}) as Record<string, unknown>
}

function assertStatus(result: ApiResult, status: number, label: string): void {
  if (result.status !== status) throw new Error(`${label} 应返回 ${status}，实际 ${result.status}：${JSON.stringify(result.data)}`)
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

async function waitForHealth(): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return
    } catch {
      // 尚未监听
    }
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error('后端健康检查超时')
}

interface SessionItem {
  id: string
  opencodeSessionId: string
  title: string | null
  displayTitle: string
  status: string
  changeSetSeq: number | null
  handoffVersion: number | null
  opencodeExists: boolean | null
  active: boolean
}

interface SessionList {
  sessions: SessionItem[]
  activeSessionId: string | null
  handoffVersion: number | null
}

async function fillRequirement(): Promise<void> {
  const markdown: Record<string, string> = {
    meta: '- 产品：I-10 会话列表冒烟\n- 作者：测试\n- 日期：2026-11-11\n- 版本：v1\n- 状态：已确认',
    problem: '多轮开发需要在多个会话之间切换。',
    goals: '能查看/切换/重命名/归档/恢复开发会话。',
    users: '- 开发者：管理开发会话',
    scope: '- 本期做：会话列表与历史会话只读查看\n- 不做：跨应用混排',
    rules: '- 同一时间只有一个 active 会话',
    pages: '- 客户列表、创建客户',
    acceptance: '- 能切换历史会话并只读查看\n- 能恢复归档会话'
  }
  const initial = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '初始化需求文档')
  const sections = initial.sections as Array<{ sectionKey: string; required: boolean }>
  for (const section of sections) {
    if (section.sectionKey === 'scenes') {
      assertOk(
        await request('PUT', `/apps/${appId}/requirements-doc/sections/scenes`, {
          data: { scenes: [{ title: '客户管理', description: '开发者维护客户' }], epics: [], stories: [] }
        }),
        '保存场景'
      )
      continue
    }
    if (section.sectionKey === 'epics') {
      assertOk(
        await request('PUT', `/apps/${appId}/requirements-doc/sections/epics`, {
          data: {
            scenes: [],
            epics: [{ id: 'EPIC-001', title: '客户管理', goal: '支持客户维护', priority: 'P0' }],
            stories: [
              { id: 'STORY-001', epicId: 'EPIC-001', title: '创建客户', description: '创建客户', acceptance: ['名称必填'], priority: 'P0' }
            ]
          }
        }),
        '保存 Epic/Story'
      )
      continue
    }
    if (!section.required) continue
    assertOk(
      await request('PUT', `/apps/${appId}/requirements-doc/sections/${section.sectionKey}`, {
        markdown: markdown[section.sectionKey] ?? '冒烟内容'
      }),
      `保存需求章节 ${section.sectionKey}`
    )
  }
  assertOk(await request('POST', `/apps/${appId}/requirements-doc/confirm`), '确认需求文档')
}

async function prepareConfirmedDesign(): Promise<void> {
  assertOk(await request('GET', `/apps/${appId}/design`), '设计项目初始化')
  const saved = assertOk(
    await request('PUT', `/apps/${appId}/design/entities`, {
      entities: [
        {
          name: '客户',
          tableName: 'biz_customer',
          description: '客户主表',
          requirementRefs: ['STORY-001'],
          fields: [
            { name: 'customerNo', label: '客户编号', type: 'string', length: 32, required: true, unique: true },
            { name: 'customerName', label: '客户名称', type: 'string', required: true }
          ]
        }
      ]
    }),
    '保存实体'
  )
  const generated = assertOk(await request('POST', `/apps/${appId}/design/page-sets/generate`, { mode: 'default' }), '生成页面集')
  const pageSets = (generated.project as { pageSets: Array<{ pages: Array<{ id: string; title: string }> }> }).pageSets
  for (const set of pageSets) {
    for (const page of set.pages) {
      assertOk(
        await request('POST', `/apps/${appId}/design/pages/${page.id}/snapshot`, {
          imageBase64: `data:image/png;base64,${PNG.toString('base64')}`,
          html: `<div class="prototype">${page.title}</div>`
        }),
        `上传页面 PNG：${page.title}`
      )
    }
  }
  const current = assertOk(await request('GET', `/apps/${appId}/design`), '读取页面集')
  const entities = (current.entities as Array<Record<string, unknown>>).map(entity => ({ ...entity, status: 'confirmed' }))
  assertOk(await request('PUT', `/apps/${appId}/design/entities`, { entities }), '确认实体')
  for (const set of current.pageSets as Array<{ id: string }>) {
    assertOk(await request('PUT', `/apps/${appId}/design/page-sets/${set.id}`, { status: 'confirmed' }), '确认页面集')
  }
  assertOk(await request('POST', `/apps/${appId}/design/confirm`), '确认设计')
  assert(saved.ok !== false, '实体保存返回异常')
}

async function createSession(reset = false): Promise<Record<string, unknown>> {
  return assertOk(await request('POST', `/apps/${appId}/development/session`, reset ? { new: true } : {}), reset ? '新建会话' : '创建会话')
}

async function listSessions(): Promise<SessionList> {
  return assertOk(await request('GET', `/apps/${appId}/development/sessions`), '读取会话列表') as unknown as SessionList
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()

  assertOk(await request('POST', '/apps', { id: appId, name: appName, description: 'I-10', backendPort: 8101 }), '创建应用')
  await fillRequirement()
  await prepareConfirmedDesign()
  assertOk(await request('POST', `/apps/${appId}/design/handoff/generate`), '生成交接包')
  console.log('准备：doc 应用 + 交接包 v1 + Change Set #1')

  if (!opencodeEnabled) {
    const empty = await listSessions()
    assert(empty.sessions.length === 0, '无会话时列表应为空')
    const created = await request('POST', `/apps/${appId}/development/session`)
    assert(created.status >= 400, 'opencode 关闭时创建会话应失败')
    console.log('opencode 关闭：列表空、创建失败（DEV_SESSIONS_SMOKE_OPENCODE=0）')
    assertOk(await request('DELETE', `/apps/${appId}?confirm=true`), '删除应用')
    return
  }

  const first = await createSession()
  const firstSession = first.session as { id: string; title: string | null; changeSetId: string | null; handoffVersion: number | null; opencodeSessionId: string }
  assert(/开发 · \d{2}-\d{2} \d{2}:\d{2}$/.test(firstSession.title ?? ''), `默认标题不正确：${firstSession.title}`)
  assert(Boolean(firstSession.changeSetId), '会话未记录变更单')
  if (firstSession.handoffVersion !== 1) throw new Error(`会话交接包版本应为 1，实际 ${firstSession.handoffVersion}`)
  console.log('会话 A：默认标题/交接包 v1/变更单 #1')

  const second = await createSession(true)
  const secondSession = second.session as { id: string; opencodeSessionId: string }
  const afterSecond = await listSessions()
  assert(afterSecond.sessions.length === 2, `会话数应为 2，实际 ${afterSecond.sessions.length}`)
  assert(afterSecond.activeSessionId === secondSession.id, '新会话应为 active')
  assert(afterSecond.sessions.find(item => item.id === firstSession.id)?.status === 'archived', '旧会话应归档')
  assert(afterSecond.sessions.every(item => item.changeSetSeq === 1), '会话应归入 Change Set #1')
  assert(afterSecond.sessions.every(item => item.opencodeExists === true), 'opencode 运行时存在性应为 true')
  console.log('列表：2 个会话 / Change Set #1 / active 高亮 / opencodeExists=true')

  const renamed = assertOk(
    await request('PATCH', `/apps/${appId}/development/sessions/${firstSession.id}`, { title: '历史会话 A', note: '第一轮实现' }),
    '重命名会话'
  )
  assert(renamed.displayTitle === '历史会话 A', '重命名后标题不正确')
  assert(renamed.note === '第一轮实现', '备注未保存')
  const longTitle = await request('PATCH', `/apps/${appId}/development/sessions/${firstSession.id}`, { title: 'x'.repeat(121) })
  assertStatus(longTitle, 400, '超长标题')
  console.log('重命名：title/note 生效，超长 title 400')

  const readOnly = assertOk(await request('GET', `/apps/${appId}/development?sessionId=${encodeURIComponent(firstSession.id)}`), '只读查看归档会话')
  assert(readOnly.readOnly === true, '归档会话应只读')
  assert((readOnly.session as { status: string }).status === 'archived', '归档会话状态应为 archived')
  console.log('只读：归档会话 readOnly=true')

  const activated = assertOk(
    await request('POST', `/apps/${appId}/development/sessions/${firstSession.id}/activate`),
    '恢复/切换会话'
  )
  assert(activated.readOnly === false, '恢复后应可写')
  assert((activated.session as { id: string }).id === firstSession.id, '恢复后 active 不是目标会话')
  const afterActivate = await listSessions()
  assert(afterActivate.sessions.find(item => item.id === secondSession.id)?.status === 'archived', '切换后旧 active 应归档')
  console.log('切换：A active / B archived')

  assertOk(await request('POST', `/apps/${appId}/development/sessions/${firstSession.id}/archive`), '归档 active 会话')
  const emptyState = assertOk(await request('GET', `/apps/${appId}/development`), '归档 active 后读取状态')
  assert((emptyState.session as unknown) === null, '归档 active 后应无 active 会话')
  assert(emptyState.readOnly === false, '无会话时 readOnly=false')
  const afterArchive = await listSessions()
  assert(afterArchive.activeSessionId === null, '列表中不应有 active 会话')
  assert(afterArchive.sessions.every(item => item.status === 'archived'), '会话应全部归档')
  console.log('归档 active：无 active，列表保留历史会话')

  const third = await createSession()
  const thirdSession = third.session as { id: string }
  assert((await listSessions()).activeSessionId === thirdSession.id, '新建会话应为 active')
  const missing = await request('POST', `/apps/${appId}/development/sessions/not-exist/activate`)
  assertStatus(missing, 404, '不存在的会话')
  console.log('新建 C：active；不存在会话 404')

  // 失效目标：删掉 opencode 会话后恢复 → 标记 stale + 409
  const { opencode } = await import('../src/opencode/runtime')
  await opencode.deleteSession(firstSession.opencodeSessionId)
  const stale = await request('POST', `/apps/${appId}/development/sessions/${firstSession.id}/activate`)
  assertStatus(stale, 409, '失效会话恢复')
  const staleList = await listSessions()
  assert(staleList.sessions.find(item => item.id === firstSession.id)?.status === 'stale', '失效会话应标记 stale')
  console.log('失效：opencode 会话不存在 → stale + 409')

  assertOk(await request('DELETE', `/apps/${appId}?confirm=true`), '删除应用')
  const gone = await request('GET', `/apps/${appId}`)
  assertStatus(gone, 404, '删除后应用')
  console.log('清理：应用目录/登记/会话已删除')
}

async function cleanup(): Promise<void> {
  try {
    const { opencode } = await import('../src/opencode/runtime')
    await opencode.stop()
  } catch {
    // 忽略
  }
  try {
    const { db } = await import('../src/db')
    db.close()
  } catch {
    // 忽略
  }
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // Windows 句柄释放滞后时留给系统清理
  }
}

main()
  .then(async () => {
    await cleanup()
    console.log('\n开发会话列表冒烟通过')
    process.exit(0)
  })
  .catch(async error => {
    console.error('\n开发会话列表冒烟失败：', error)
    await cleanup()
    process.exit(1)
  })
