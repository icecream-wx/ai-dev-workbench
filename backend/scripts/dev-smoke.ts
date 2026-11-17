/**
 * 开发会话冒烟（P4）
 *
 * 使用临时 data/projects 启动工作台后端 + 真实 opencode serve + 真实模型：
 * 创建应用 → 需求/设计完成 → 选模型 → 创建 build 会话 → 首条提示 → 轮询状态/权限 → 完成/恢复/停止。
 *
 * 运行：npm run smoke:dev --prefix backend
 * 可选环境变量：
 * - DEV_SMOKE_PORT（默认 3402）
 * - DEV_SMOKE_PROVIDER / DEV_SMOKE_MODEL（默认 packycode-deepseek/deepseek-flash）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-dev-smoke-'))
const port = Number(process.env.DEV_SMOKE_PORT ?? 3402)
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)

const providerID = process.env.DEV_SMOKE_PROVIDER ?? 'packycode-deepseek'
const modelID = process.env.DEV_SMOKE_MODEL ?? 'deepseek-flash'
const base = `http://127.0.0.1:${port}`
const appId = 'dev-smoke'
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForHealth(): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) return
    } catch {
      // 尚未监听
    }
    await sleep(150)
  }
  throw new Error('后端健康检查超时')
}

async function fillRequirement(): Promise<void> {
  const markdown: Record<string, string> = {
    meta: '- 产品：开发会话冒烟\n- 作者：测试\n- 日期：2026-11-11\n- 版本：v1\n- 状态：已确认',
    problem: '需要验证开发会话与真实模型回复。',
    goals: '开发会话可创建、发送并恢复。',
    users: '- 开发者：使用开发会话',
    scope: '- 本期做：事项列表\n- 不做：其他页面',
    rules: '- 标题必填',
    pages: '- 事项列表',
    acceptance: '- 能创建开发会话并收到回复'
  }
  const initial = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '初始化需求文档')
  const sections = initial.sections as Array<{ sectionKey: string; required: boolean }>
  for (const section of sections) {
    if (section.sectionKey === 'scenes') {
      assertOk(
        await request('PUT', `/apps/${appId}/requirements-doc/sections/scenes`, {
          data: { scenes: [{ title: '事项管理', description: '维护事项' }], epics: [], stories: [] }
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
            epics: [{ id: 'EPIC-001', title: '事项管理', goal: '支持事项维护', priority: 'P0' }],
            stories: [
              { id: 'STORY-001', epicId: 'EPIC-001', title: '查看事项', description: '查看事项列表', acceptance: ['列表可查询'], priority: 'P0' }
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
  assertOk(
    await request('PUT', `/apps/${appId}/design/entities`, {
      entities: [
        {
          name: '事项',
          tableName: 'biz_item',
          description: '事项主表',
          requirementRefs: ['STORY-001'],
          fields: [
            { name: 'id', label: '主键', type: 'string', required: true, unique: true },
            { name: 'title', label: '标题', type: 'string', required: true }
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
}

async function seed(): Promise<void> {
  assertOk(await request('POST', '/apps', { id: appId, name: '开发会话冒烟', description: '验证 P4 开发会话', backendPort: 8098 }), '创建应用')
  await fillRequirement()
  await prepareConfirmedDesign()
  const design = assertOk(await request('POST', `/apps/${appId}/design/handoff/generate`), '生成交接包并进入开发')
  if ((design.developmentStarted as boolean) !== true) throw new Error('设计交接包未进入 development')
}

async function openEventsHello(): Promise<void> {
  const controller = new AbortController()
  const response = await fetch(`${base}/api/apps/${appId}/development/events`, { signal: controller.signal })
  if (!response.ok || !response.body) throw new Error(`开发事件流失败（HTTP ${response.status}）`)
  const reader = response.body.getReader()
  const first = await Promise.race([
    reader.read(),
    sleep(5000).then(() => null)
  ])
  controller.abort()
  if (!first || first.done) throw new Error('开发事件流未返回 hello')
  const text = new TextDecoder().decode(first.value)
  if (!text.includes('"type":"hello"')) throw new Error(`开发事件流首帧不是 hello：${text.slice(0, 200)}`)
}

async function pollRun(): Promise<Record<string, unknown>> {
  const replied = new Set<string>()
  let last: Record<string, unknown> = {}
  const deadline = Date.now() + 240000
  let sawActivity = false
  await sleep(1200)
  while (Date.now() < deadline) {
    const data = assertOk(await request('GET', `/apps/${appId}/development`), '读取开发会话')
    last = data
    const state = data.state as Record<string, unknown> | null
    if (!state) {
      await sleep(800)
      continue
    }
    const pending = state.pending as { permissions?: Array<{ id?: string }> } | undefined
    for (const permission of pending?.permissions ?? []) {
      const id = typeof permission.id === 'string' ? permission.id : ''
      if (!id || replied.has(id)) continue
      replied.add(id)
      assertOk(await request('POST', `/apps/${appId}/development/permission/${encodeURIComponent(id)}/reply`, { decision: 'once' }), '回复权限')
      console.log('权限：已允许一次', id)
    }
    const status = String(state.status ?? '')
    const messages = Array.isArray(state.messages) ? state.messages as Array<Record<string, unknown>> : []
    const steps = Array.isArray(state.steps) ? state.steps : []
    if (status === 'running' || messages.length > 0 || steps.length > 0) sawActivity = true
    const assistantText = messages
      .filter(message => message.type === 'assistant')
      .map(message => String(message.text ?? ''))
      .join('\n')
      .trim()
    if (sawActivity && status !== 'running' && assistantText) {
      console.log('会话：', status, '消息', messages.length, '步骤', steps.length, '工具', (state.stats as { toolTotal?: number } | undefined)?.toolTotal ?? 0)
      console.log('回复片段：', assistantText.slice(0, 200).replace(/\s+/g, ' '))
      return last
    }
    if (sawActivity && status !== 'running' && !assistantText) {
      const failed = messages.filter(message => message.type === 'assistant' && message.error)
      if (failed.length) throw new Error(`模型执行失败：${JSON.stringify(failed[0].error)}`)
    }
    await sleep(800)
  }
  console.error('最后一次状态：', JSON.stringify(last, null, 2).slice(0, 4000))
  throw new Error('开发会话等待超时（240s）')
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()
  await seed()
  console.log('应用与交接包：ready')

  const model = assertOk(
    await request('PUT', `/apps/${appId}/model`, {
      stage: 'development',
      model: { providerID, id: modelID }
    }),
    '设置开发模型'
  )
  console.log('开发模型：', `${providerID}/${modelID}`, (model as { model?: unknown }).model)

  const created = assertOk(await request('POST', `/apps/${appId}/development/session`), '创建开发会话')
  const session = created.session as { opencodeSessionId?: string; agent?: string } | null
  if (!session?.opencodeSessionId) throw new Error('创建会话未返回 opencodeSessionId')
  if (session.agent !== 'build') throw new Error(`开发 agent 应为 build，实际 ${session.agent}`)
  console.log('开发会话：', session.opencodeSessionId, 'agent=', session.agent)

  await openEventsHello()
  console.log('事件流：hello 正常')

  assertOk(
    await request('POST', `/apps/${appId}/development/prompt`, {
      text: '请先使用 read 工具读取 docs/handoff/00-README.md，然后只回复两个字：收到。不要创建或修改任何文件。'
    }),
    '发送首条提示'
  )
  await pollRun()

  // serve 重启后应能按 app_sessions 中的 opencodeSessionId 恢复同一会话
  assertOk(await request('POST', '/opencode/stop'), '停止 opencode serve')
  assertOk(await request('POST', '/opencode/start'), '重启 opencode serve')
  const recovered = assertOk(await request('GET', `/apps/${appId}/development`), '恢复开发会话')
  const recoveredSession = recovered.session as { opencodeSessionId?: string } | null
  if (!recoveredSession?.opencodeSessionId) throw new Error('serve 重启后未恢复开发会话')
  console.log('恢复：serve 重启后会话仍存在', recoveredSession.opencodeSessionId)

  // 完成 → 继续开发：发送消息应立即把状态改回 development
  assertOk(await request('POST', `/apps/${appId}/complete`), '确认开发完成')
  const completed = assertOk(await request('GET', `/apps/${appId}`), '读取完成状态')
  if ((completed.app as { status?: string }).status !== 'completed') throw new Error('确认完成后状态不是 completed')

  assertOk(await request('POST', `/apps/${appId}/development/prompt`, { text: '继续开发：只回复“继续”，不要修改文件。' }), '完成后继续发送')
  const resumed = assertOk(await request('GET', `/apps/${appId}`), '读取恢复状态')
  if ((resumed.app as { status?: string }).status !== 'development') throw new Error('完成后发送消息未恢复 development')
  console.log('完成/继续：completed → development')

  assertOk(await request('POST', `/apps/${appId}/development/interrupt`), '停止会话')
  console.log('停止：ok')

  assertOk(await request('DELETE', `/apps/${appId}?confirm=true`), '删除应用')
  console.log('清理：应用目录与登记已删除')
  console.log('开发会话冒烟通过。')
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
    process.exit(0)
  })
  .catch(async error => {
    console.error('开发会话冒烟失败：', error)
    await cleanup()
    process.exit(1)
  })
