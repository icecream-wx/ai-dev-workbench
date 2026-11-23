/**
 * P4 开发会话冒烟（真实 opencode 2.2.5，不调用模型）
 *
 * 覆盖：建应用 → 建开发会话 → 状态 → 列表 → 重命名 → 归档 → 只读 → 恢复 → 视图过滤。
 * 端口：后端 3424 / opencode 4724（避开真实 3300/4771 与既有 e2e 端口）。
 * 只做会话生命周期与状态读取；不调用 prompt（不触达模型）。
 *
 * 运行：npm run smoke:dev --prefix backend
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-dev-smoke-'))
const port = Number(process.env.DEV_SMOKE_PORT ?? 3424)
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1300)
process.env.OPENCODE_AUTO_START = 'true'

const base = `http://127.0.0.1:${port}`
const appId = 'dev-smoke'

interface ApiResult {
  status: number
  data: any
}

async function request(method: string, apiPath: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch(`${base}/api${apiPath}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertOk(result: ApiResult, label: string): Record<string, any> {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${label} 失败（HTTP ${result.status}）：${JSON.stringify(result.data)}`)
  }
  return (result.data ?? {}) as Record<string, any>
}

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs: number, label: string): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await check()) return
    await delay(200)
  }
  throw new Error(`等待超时：${label}`)
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitFor(async () => {
    try {
      return (await fetch(`${base}/api/health`)).ok
    } catch {
      return false
    }
  }, 15000, '后端健康检查')
  await waitFor(async () => {
    const health = await request('GET', '/health')
    return health.data?.runtime?.ready === true
  }, 90000, 'opencode serve 就绪')
  console.log('[smoke:dev] opencode 已就绪（未调用模型）')

  const appDir = path.join(process.env.RG_PROJECTS_DIR as string, appId)
  assertOk(await request('POST', '/apps', { id: appId, name: '开发会话冒烟', requirementTemplateId: 'builtin-prd-lite' }), '创建应用')

  // 1. 建开发会话
  const created = assertOk(await request('POST', `/apps/${appId}/development/session`, { view: 'development' }), '创建开发会话')
  const session = created.session as { id: string; opencodeSessionId: string; view: string }
  assert(session?.opencodeSessionId, '开发会话缺少 opencodeSessionId')
  assert(session.view === 'development', `view 应为 development，实际 ${session.view}`)
  assert(String(created.defaultPrompt).includes('AGENTS.md'), '默认提示应包含 AGENTS.md')
  assert(String(created.defaultPrompt).includes('docs/requirements/'), '默认提示应包含 docs/requirements/')
  assert(String(created.defaultPrompt).includes('docs/design/'), '默认提示应包含 docs/design/')
  assert(String(created.defaultPrompt).includes('交接包') === false, '默认提示不应包含交接包')
  console.log('[smoke:dev] 建会话 ok:', session.id)

  // 2. 状态（真实 opencode 会话可读，不发 prompt）
  const state = assertOk(await request('GET', `/apps/${appId}/development?view=development`), '读取开发状态')
  assert((state.session as { id: string } | null)?.id === session.id, '状态应返回活跃会话')
  assert(state.state !== null && state.state !== undefined, '状态应包含时间线数据')

  // 3. 列表 + 视图过滤
  const devList = assertOk(await request('GET', `/apps/${appId}/development/sessions?view=development`), '开发会话列表')
  assert((devList.sessions as unknown[]).length === 1, '开发视图应有 1 个会话')
  const reqListBefore = assertOk(
    await request('GET', `/apps/${appId}/development/sessions?view=requirements`),
    '需求会话列表（空）'
  )
  assert((reqListBefore.sessions as unknown[]).length === 0, '需求视图初始应为空')

  // 4. 重命名
  const renamed = assertOk(
    await request('PATCH', `/apps/${appId}/development/sessions/${session.id}`, { title: '改造开发会话' }),
    '重命名会话'
  )
  assert(renamed.title === '改造开发会话', '重命名未生效')

  // 5. 归档 → 无活跃会话
  assertOk(await request('POST', `/apps/${appId}/development/sessions/${session.id}/archive`), '归档会话')
  const archivedList = assertOk(await request('GET', `/apps/${appId}/development/sessions?view=development`), '归档后列表')
  const archived = (archivedList.sessions as Array<{ id: string; status: string }>).find(item => item.id === session.id)
  assert(archived?.status === 'archived', '归档状态不正确')
  const noActive = assertOk(await request('GET', `/apps/${appId}/development?view=development`), '归档后状态')
  assert(noActive.session === null, '归档后不应有活跃会话')

  // 6. 指定会话 → 只读
  const readOnlyState = assertOk(
    await request('GET', `/apps/${appId}/development?view=development&sessionId=${encodeURIComponent(session.id)}`),
    '读取归档会话'
  )
  assert(readOnlyState.readOnly === true, '归档会话应为只读')
  assert((readOnlyState.session as { status: string }).status === 'archived', '只读会话状态应为 archived')

  // 7. 恢复为当前会话
  const restored = assertOk(
    await request('POST', `/apps/${appId}/development/sessions/${session.id}/activate?view=development`),
    '恢复会话'
  )
  assert(restored.readOnly === false, '恢复后应为可写')
  assert((restored.session as { status: string }).status === 'active', '恢复后状态应为 active')

  // 8. 需求视图会话独立 + 过滤
  assertOk(await request('POST', `/apps/${appId}/development/session`, { view: 'requirements' }), '创建需求会话')
  const devList2 = assertOk(await request('GET', `/apps/${appId}/development/sessions?view=development`), '开发列表过滤')
  const reqList2 = assertOk(await request('GET', `/apps/${appId}/development/sessions?view=requirements`), '需求列表过滤')
  assert((devList2.sessions as unknown[]).length === 1, '开发视图仍应只有 1 个会话')
  assert((reqList2.sessions as unknown[]).length === 1, '需求视图应有 1 个会话')

  // 9. 清理
  assertOk(await request('DELETE', `/apps/${appId}?confirm=true`), '删除应用')
  assert(!fs.existsSync(appDir), '删除应用后目录应移除')
  console.log('[smoke:dev] 全部通过（未调用模型）')
}

async function cleanup(): Promise<void> {
  try {
    await fetch(`${base}/api/opencode/stop`, { method: 'POST' })
  } catch {
    // serve 未启动
  }
  try {
    const dbModule = await import('../src/db')
    dbModule.db.close()
  } catch {
    // 数据库未打开
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(root, { recursive: true, force: true })
      break
    } catch {
      await delay(200)
    }
  }
}

main()
  .then(async () => {
    await cleanup()
    process.exit(0)
  })
  .catch(async error => {
    console.error('[smoke:dev] 失败：', error instanceof Error ? error.message : error)
    await cleanup()
    process.exit(1)
  })
