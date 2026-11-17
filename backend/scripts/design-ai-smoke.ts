/**
 * 设计阶段真实模型冒烟（D1—D4）
 *
 * 真实 Express + 临时 SQLite/projects + opencode serve + packycode-deepseek/deepseek-flash：
 * 创建应用 → 填写并确认需求文档（人工文本）→ AI 生成实体 → AI 生成页面集
 * → 设计对话（<<<DESIGN_JSON>>>）→ 输出摘要。
 *
 * 运行：
 *   $env:OPENCODE_DEFAULT_MODEL='packycode-deepseek/deepseek-flash'
 *   npm run smoke:design:ai --prefix backend
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-design-ai-'))
const port = Number(process.env.DESIGN_AI_PORT ?? 3411)
process.env.PORT = String(port)
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_PORT = String(port + 1000)
process.env.OPENCODE_AUTO_START = 'true'
process.env.OPENCODE_DEFAULT_MODEL = process.env.OPENCODE_DEFAULT_MODEL || 'packycode-deepseek/deepseek-flash'

const base = `http://127.0.0.1:${port}`
const appId = 'design-ai-smoke'

interface ApiResult {
  status: number
  data: unknown
}

async function request(method: string, apiPath: string, body?: unknown, timeoutMs = 900_000): Promise<ApiResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}/api${apiPath}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    })
    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { status: res.status, data }
  } finally {
    clearTimeout(timer)
  }
}

function assertOk(result: ApiResult, label: string): Record<string, unknown> {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${label} 失败（HTTP ${result.status}）：${JSON.stringify(result.data).slice(0, 1200)}`)
  }
  return (result.data ?? {}) as Record<string, unknown>
}

async function waitForHealth(): Promise<void> {
  for (let index = 0; index < 120; index += 1) {
    try {
      const res = await fetch(`${base}/api/health`)
      if (res.ok) {
        const data = (await res.json()) as { runtime?: { ready?: boolean } }
        if (data.runtime?.ready) return
      }
    } catch {
      // 尚未监听
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('后端/opencode 健康检查超时')
}

async function fillRequirement(): Promise<void> {
  const required: Record<string, string> = {
    meta: '- 产品：客户订单管理\n- 作者：产品组\n- 日期：2026-11-10\n- 版本：v1\n- 状态：草稿',
    problem:
      '中小销售团队目前用 Excel 维护客户和订单，客户资料分散、订单状态不可追踪，主管无法及时看到成交情况。',
    goals:
      '- 客户/订单信息集中管理，查询时间从 10 分钟降到 1 分钟\n- 订单状态可追踪，主管可查看团队订单\n- 客户重复率下降 50%',
    users:
      '- 销售：维护自己负责的客户，创建/编辑订单，只能看自己的客户与订单\n- 销售主管：查看全部客户与订单，按状态/日期筛选\n- 系统管理员：维护客户等级、订单状态字典',
    scope:
      '- 本期做：客户列表/创建/编辑/详情，订单列表/创建/编辑/详情，按客户/状态/日期查询\n- 不做：合同管理、财务对账、审批流',
    scenes:
      '### 客户管理\n销售创建客户（客户编号、名称、等级、联系人、电话、地址），在列表按名称/等级筛选，进入详情查看客户下的订单。\n### 订单管理\n销售选择客户创建订单（订单号、金额、状态、下单日期、备注），列表按客户/状态/日期筛选，详情查看明细。',
    epics:
      '### Epic 1：客户管理\n- 作为销售，我希望新增/编辑客户并查看客户详情，以便集中维护客户资料。\n- 验收：客户编号唯一；列表支持按客户名称/等级筛选；详情显示客户下订单。\n### Epic 2：订单管理\n- 作为销售，我希望为客户创建订单并跟踪状态，以便掌握成交进展。\n- 验收：订单号唯一；金额保留两位小数；状态为草稿/已提交/已完成；列表支持按客户/状态/日期筛选。',
    rules:
      '- 一个客户可以有多条订单，一条订单只属于一个客户\n- 客户编号、订单号唯一\n- 订单金额保留两位小数，必须大于 0\n- 订单状态：草稿 → 已提交 → 已完成\n- 客户等级：普通/重要/VIP\n- 销售只能看自己的客户与订单；主管看全部',
    pages: '- 客户列表、客户创建（弹窗）、客户编辑（弹窗）、客户详情\n- 订单列表、订单创建（弹窗）、订单编辑（弹窗）、订单详情',
    acceptance:
      '- 能新增客户并校验唯一客户编号\n- 能按名称/等级筛选客户\n- 能为客户创建订单并校验金额/唯一订单号\n- 订单列表能按客户/状态/日期筛选\n- 详情页能返回列表'
  }
  const initial = assertOk(await request('GET', `/apps/${appId}/requirements-doc`), '初始化需求文档')
  const sections = initial.sections as Array<{ sectionKey: string; required: boolean }>
  for (const section of sections) {
    if (!section.required) continue
    assertOk(
      await request('PUT', `/apps/${appId}/requirements-doc/sections/${section.sectionKey}`, {
        markdown: required[section.sectionKey] ?? '测试内容'
      }),
      `保存需求章节 ${section.sectionKey}`
    )
  }
  assertOk(await request('POST', `/apps/${appId}/requirements-doc/confirm`), '确认需求文档')
}

async function chatDesign(message: string): Promise<string> {
  const res = await fetch(`${base}/api/apps/${appId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: 'design', mode: 'design', messages: [{ role: 'user', content: message }] })
  })
  if (!res.ok || !res.body) throw new Error(`设计对话失败（HTTP ${res.status}）：${(await res.text()).slice(0, 600)}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let index: number
    while ((index = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      const line = raw.split('\n').find(item => item.startsWith('data:'))
      if (!line) continue
      try {
        const frame = JSON.parse(line.slice(5).trim()) as { type?: string; text?: string; message?: string }
        if (frame.type === 'delta' && frame.text) full += frame.text
        if (frame.type === 'done') return frame.text || full
        if (frame.type === 'error') throw new Error(frame.message || '设计对话失败')
      } catch (error) {
        if (error instanceof SyntaxError) continue
        throw error
      }
    }
  }
  return full
}

async function main(): Promise<void> {
  await import('../src/index')
  await waitForHealth()
  console.log('后端 + opencode 已就绪；默认模型：', process.env.OPENCODE_DEFAULT_MODEL)

  assertOk(
    await request('POST', '/apps', { id: appId, name: '客户订单管理（AI 冒烟）', description: 'D1—D4 真实模型', backendPort: 8100 }),
    '创建应用'
  )
  await fillRequirement()
  console.log('需求文档已确认')

  const design = assertOk(await request('GET', `/apps/${appId}/design`), '设计项目初始化')
  if ((design.requirement as { confirmed?: boolean } | null)?.confirmed !== true) throw new Error('设计项目未读取到已确认需求')

  console.log('AI 生成实体中…')
  const started = Date.now()
  const entityResult = assertOk(await request('POST', `/apps/${appId}/design/generate-entities`), 'AI 生成实体')
  const project = entityResult.project as { entities: Array<{ name: string; fields: unknown[]; relations: unknown[] }> }
  if (!project.entities.length) throw new Error('AI 未生成实体')
  console.log(`AI 实体：${project.entities.length} 个（${Math.round((Date.now() - started) / 1000)}s）`)
  for (const entity of project.entities) {
    console.log(`  - ${entity.name}：${entity.fields.length} 字段 / ${entity.relations.length} 关系`)
  }

  console.log('AI 生成页面集中…')
  const pageStarted = Date.now()
  const pageResult = assertOk(await request('POST', `/apps/${appId}/design/page-sets/generate`, { mode: 'ai' }), 'AI 生成页面集')
  const pageProject = pageResult.project as {
    pageSets: Array<{ title: string; pages: Array<{ type: string; title: string }> }>
  }
  if (!pageProject.pageSets.length) throw new Error('AI 未生成页面集')
  console.log(`AI 页面集：${pageProject.pageSets.length} 个（${Math.round((Date.now() - pageStarted) / 1000)}s）`)
  for (const set of pageProject.pageSets) {
    console.log(`  - ${set.title}：${set.pages.map(page => `${page.type}/${page.title}`).join('，')}`)
  }

  console.log('设计对话（DESIGN_JSON 协议）中…')
  const reply = await chatDesign('请简短说明当前实体与页面集是否覆盖需求中的客户管理和订单管理，并给出下一步。')
  console.log('设计对话回复：', reply.split('<<<DESIGN_JSON>>>')[0].trim().slice(0, 300))
  if (!reply.trim()) throw new Error('设计对话没有返回内容')

  console.log('\n真实模型设计冒烟通过')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n真实模型设计冒烟失败：', error)
    process.exit(1)
  })
