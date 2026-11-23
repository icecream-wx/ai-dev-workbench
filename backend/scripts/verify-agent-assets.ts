/**
 * 一次性验证：真实 opencode serve 下项目级 skills/commands 的加载结果（P1 出口 3）
 *
 * 不调用模型：只启动 serve、创建应用、读取 /api/opencode/{skills,commands}、删除应用。
 * 端口使用 3419 / 4719（避开真实 3300 / 4771）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-assets-verify-'))
const port = 3419
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = '4719'
process.env.OPENCODE_AUTO_START = 'true'

const base = `http://127.0.0.1:${port}`

async function request(method: string, apiPath: string, body?: unknown): Promise<{ status: number; data: any }> {
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

async function waitReady(timeoutMs = 90000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { data } = await request('GET', '/health')
    if (data?.runtime?.ready) return
    if (data?.runtime?.lastError) throw new Error(`opencode 未就绪：${data.runtime.lastError}`)
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`opencode 未在 ${timeoutMs}ms 内就绪`)
}

async function main(): Promise<void> {
  await import('../src/index')
  for (let index = 0; index < 100; index += 1) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) break
    } catch {
      // 等待监听
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  await waitReady()

  const created = await request('POST', '/apps', { id: 'assets-verify', name: 'assets verify' })
  if (created.status !== 201) throw new Error(`创建应用失败：${JSON.stringify(created.data)}`)
  if ((created.data.warnings ?? []).length) throw new Error(`创建告警：${JSON.stringify(created.data.warnings)}`)

  const dir = path.join(process.env.RG_PROJECTS_DIR as string, 'assets-verify')
  // opencode 的 location 惰性初始化：首次在该目录创建会话后才加载项目级 skills/commands
  const session = await request('POST', '/apps/assets-verify/development/session', { view: 'development' })
  if (session.status !== 200) throw new Error(`创建开发会话失败：${JSON.stringify(session.data)}`)
  await new Promise(resolve => setTimeout(resolve, 1500))

  const skills = await request('GET', `/opencode/skills?directory=${encodeURIComponent(dir)}`)
  const commands = await request('GET', `/opencode/commands?directory=${encodeURIComponent(dir)}`)
  const skillIds = (skills.data?.skills ?? []).map((item: any) => item.id)
  const commandNames = (commands.data?.commands ?? []).map((item: any) => item.name)
  console.log('[verify] skills =', JSON.stringify(skillIds))
  console.log('[verify] commands =', JSON.stringify(commandNames))

  const expectedSkills = [
    'adw-requirements-document',
    'adw-design-artifacts',
    'adw-frontend-implementation',
    'afcenter-page-generation',
    'pm-components-usage',
    'adw-template-req-builtin-prd',
    'adw-template-proto-enterprise-application-platform'
  ]
  const expectedCommands = [
    'update-requirements',
    'generate-design',
    'preview-app',
    'check-consistency',
    'check-design-fidelity'
  ]
  for (const id of expectedSkills) {
    if (!skillIds.includes(id)) throw new Error(`缺少 skill：${id}`)
  }
  for (const name of expectedCommands) {
    if (!commandNames.includes(name)) throw new Error(`缺少 command：${name}`)
  }
  console.log('[verify] 通过：2 个方法 skill + 开发方法 skill + 2 个团队 skill + 设计模板 skill + 需求模板 skill + 5 个 command 已被 opencode 加载')
}

main()
  .then(async () => {
    try {
      await request('DELETE', '/apps/assets-verify?confirm=true')
    } catch {
      // 清理失败不影响结论
    }
    process.exit(0)
  })
  .catch(error => {
    console.error('[verify] 失败：', error instanceof Error ? error.message : error)
    process.exit(1)
  })
