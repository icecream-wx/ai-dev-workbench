/**
 * I-09a 会话健康度 + 原生 compact 冒烟
 *
 * 真实 Express + 临时 SQLite/projects + 真实 opencode serve（不调用模型）：
 * 创建 doc 应用 → 需求/设计/交接包 v1 → 开发会话 → `GET /development` 带 context（limit = 模型 context）
 * → `POST /development/compact` 200 → 时间线出现 compaction 系统提示 → 归档后 compact 409 → 删除应用。
 *
 * 运行：npm run smoke:dev-health --prefix backend
 * 可选环境变量：
 * - DEV_HEALTH_SMOKE_PORT（默认 3417）
 * - DEV_HEALTH_SMOKE_OPENCODE=0（不启动 opencode；只验证 context 结构为 unknown）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-dev-health-smoke-'))
const port = Number(process.env.DEV_HEALTH_SMOKE_PORT ?? 3417)
const opencodeEnabled = process.env.DEV_HEALTH_SMOKE_OPENCODE !== '0'
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = opencodeEnabled ? 'true' : 'false'

const base = `http://127.0.0.1:${port}`
const appId = 'dev-health-smoke'
const appName = '会话健康度冒烟'
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
  for (let index = 0; index < 160; index += 1) {
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

interface ContextUsage {
  used: number
  limit: number | null
  percent: number | null
  level: string
}

interface DevState {
  session: { id: string; opencodeSessionId: string; model: { providerID: string; id: string } | null } | null
  state: {
    context: ContextUsage
    messages: Array<{ type: string; kind?: string; text?: string }>
    stats: { tokens: { input: number; output: number } }
  } | null
  readOnly: boolean
}

async function fillRequirement(): Promise<void> {
  const markdown: Record<string, string> = {
    meta: '- 产品：I-09a 会话健康度冒烟\n- 作者：测试\n- 日期：2026-11-11\n- 版本：v1\n- 状态：已确认',
    problem: '长会话上下文会超限，需要健康度提示与原生 compact。',
    goals: '按模型上下文百分比展示健康度，支持手动压缩上下文。',
    users: '- 开发者：查看健康度并手动压缩',
    scope: '- 本期做：健康度 chip / 提示条 / 原生 compact\n- 不做：分阶段会话',
    rules: '- 60% 黄色建议、85% 红色强烈建议\n- 压缩由用户手动触发',
    pages: '- 开发页顶部健康度',
    acceptance: '- 开发页显示上下文百分比\n- 压缩后时间线出现“上下文已压缩”'
  }
  const initial = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '初始化需求文档')
  const sections = initial.sections as Array<{ sectionKey: string; required: boolean }>
  for (const section of sections) {
    if (section.sectionKey === 'scenes') {
      assertOk(
        await request('PUT', `/apps/${appId}/requirements-doc/sections/scenes`, {
          data: { scenes: [{ title: '上下文健康度', description: '开发者关注上下文用量' }], epics: [], stories: [] }
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
            epics: [{ id: 'EPIC-001', title: '上下文健康度', goal: '支持健康度与压缩', priority: 'P0' }],
            stories: [
              { id: 'STORY-001', epicId: 'EPIC-001', title: '压缩上下文', description: '手动压缩', acceptance: ['出现压缩事件'], priority: 'P0' }
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
          name: '会话健康度',
          tableName: 'biz_dev_health',
          description: '健康度快照',
          requirementRefs: ['STORY-001'],
          fields: [
            { name: 'healthNo', label: '健康度编号', type: 'string', length: 32, required: true, unique: true },
            { name: 'usedTokens', label: '已用 token', type: 'number', required: true },
            { name: 'contextLimit', label: '上下文上限', type: 'number', required: true }
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

async function devState(): Promise<DevState> {
  return assertOk(await request('GET', `/apps/${appId}/development`), '读取开发状态') as unknown as DevState
}

function assertContext(context: ContextUsage | undefined, label: string): void {
  if (!context) throw new Error(`${label}：缺少 context 字段`)
  assert(typeof context.used === 'number' && context.used >= 0, `${label}：used 应为非负数字，实际 ${context.used}`)
  assert(
    ['ok', 'warn', 'danger', 'unknown'].includes(context.level),
    `${label}：level 非法 ${context.level}`
  )
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()

  assertOk(await request('POST', '/apps', { id: appId, name: appName, description: 'I-09a', backendPort: 8103 }), '创建应用')
  await fillRequirement()
  await prepareConfirmedDesign()
  assertOk(await request('POST', `/apps/${appId}/design/handoff/generate`), '生成交接包')
  console.log('准备：doc 应用 + 交接包 v1')

  if (!opencodeEnabled) {
    const offline = await devState()
    assert(offline.state === null || offline.state.context.level === 'unknown', 'opencode 关闭时 level 应为 unknown')
    console.log('opencode 关闭：无会话 → context 为空/unknown')
    assertOk(await request('DELETE', `/apps/${appId}?confirm=true`), '删除应用')
    return
  }

  const created = assertOk(await request('POST', `/apps/${appId}/development/session`), '创建开发会话')
  const session = created.session as { id: string; opencodeSessionId: string; model: { providerID: string; id: string } | null }
  const initial = await devState()
  assertContext(initial.state?.context, '新建会话')
  assert(initial.state?.context.used === 0, `新会话 used 应为 0，实际 ${initial.state?.context.used}`)
  console.log(`新建会话：context 存在（used=${initial.state?.context.used}, level=${initial.state?.context.level}）`)

  // context.limit 必须与模型元数据 limit.context 一致
  const modelKey = session.model ? `${session.model.providerID}/${session.model.id}` : null
  const models = assertOk(
    await request('GET', `/opencode/models?directory=${encodeURIComponent(path.join(root, 'projects', appId))}`),
    '读取模型列表'
  )
  const model = (models.models as Array<{ providerID: string; modelID: string; id: string; limit?: { context?: number } }>).find(
    item => (modelKey ? `${item.providerID}/${item.modelID}` === modelKey || `${item.providerID}/${item.id}` === modelKey : false)
  )
  const expectedLimit = typeof model?.limit?.context === 'number' ? Math.round(model.limit.context) : null
  assert(Boolean(modelKey), '会话没有记录模型')
  if (expectedLimit === null) {
    console.warn(`模型 ${modelKey} 没有 limit.context；跳过 limit 一致性断言`)
    assert(initial.state?.context.limit === null, 'limit 未知时应为 null')
  } else {
    assert(
      initial.state?.context.limit === expectedLimit,
      `context.limit 应为模型 context ${expectedLimit}，实际 ${initial.state?.context.limit}`
    )
    assert(initial.state?.context.percent === 0, `新会话 percent 应为 0，实际 ${initial.state?.context.percent}`)
  }
  console.log(`limit 一致：${initial.state?.context.limit}（模型 ${modelKey}）`)

  const compact = await request('POST', `/apps/${appId}/development/compact`)
  const compactBody = assertOk(compact, '压缩上下文')
  assert(compactBody.ok === true, 'compact 应返回 ok=true')
  assert(compactBody.message === '已请求压缩上下文，将在下一步生效', `compact 文案不正确：${compactBody.message}`)
  console.log('compact：200 ok=true')

  // 时间线：出现 compaction 系统提示（不是 assistant 文本）
  let compaction: { type: string; kind?: string; text?: string } | undefined
  for (let index = 0; index < 20; index += 1) {
    const after = await devState()
    compaction = after.state?.messages.find(message => message.type === 'compaction')
    if (compaction) break
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  assert(compaction, '压缩后时间线应出现 compaction 消息')
  assert(
    compaction.kind === 'compaction' || compaction.kind === 'compaction-failed',
    `compaction 消息应带 kind，实际 ${JSON.stringify(compaction)}`
  )
  assert(
    !(compaction as { tools?: unknown }).tools,
    'compaction 不应被当作 assistant 消息（不应带工具）'
  )
  // 空会话 compact：opencode 仍返回 200，但消息 status=failed → 时间线应显示“未执行”而不是谎报已压缩
  const compactKind = compaction.kind
  if (compactKind === 'compaction-failed') {
    assert(/上下文压缩未执行：/.test(compaction.text ?? ''), `失败提示文案不正确：${compaction.text}`)
    console.log(`时间线：compaction(failed) → ${compaction.text}`)
  } else {
    assert(compaction.text === '上下文已压缩', `compaction 文案不正确：${compaction.text}`)
    console.log('时间线：compaction → “上下文已压缩”')
  }

  // 无 active 会话 → compact 409
  assertOk(await request('POST', `/apps/${appId}/development/sessions/${session.id}/archive`), '归档 active 会话')
  const noActive = await request('POST', `/apps/${appId}/development/compact`)
  assertStatus(noActive, 409, '无 active 会话时 compact')
  assert(
    String((noActive.data as { error?: unknown } | null)?.error ?? '').includes('当前没有进行中的开发会话'),
    `409 文案不正确：${JSON.stringify(noActive.data)}`
  )
  console.log('无 active：compact 409 且文案可读')

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
    console.log('\n会话健康度冒烟通过')
    process.exit(0)
  })
  .catch(async error => {
    console.error('\n会话健康度冒烟失败：', error)
    await cleanup()
    process.exit(1)
  })
