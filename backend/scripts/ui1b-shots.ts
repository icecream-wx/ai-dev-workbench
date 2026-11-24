/**
 * UI-1b 三视图排版/层级证据截图（stub 后端，不调用模型）
 *
 * 前置：`npm run build --prefix frontend`（Express 静态托管 frontend/dist）。
 * 运行（backend 目录）：`npx tsx scripts/ui1b-shots.ts`
 *
 * - 临时 SQLite/projects + 独立端口 3433；`OPENCODE_AUTO_START=false`，stub opencode
 * - 复用 p2 harness：真实后端 + 前端 dist；不占用真实 3300 / 4771
 * - 1440/1024/390 三视图截图（浅色）+ 1440 需求/设计深色；每屏校验无整页横向溢出
 * - 输出目录 `UI1B_SHOTS_DIR`（默认 %TEMP%\opencode\ui1b-shots）
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser } from 'playwright'
import { writeDesignArtifacts, writeRequirementsDoc } from './ui-shots-fixtures'

const backendDir = path.resolve(__dirname, '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-ui1b-shots-'))
const stateFile = path.join(root, 'state.json')
const shotsDir = process.env.UI1B_SHOTS_DIR || path.join(os.tmpdir(), 'opencode', 'ui1b-shots')
const port = 3433
const base = `http://127.0.0.1:${port}`
const appId = 'ui1b-app'

fs.mkdirSync(shotsDir, { recursive: true })

interface HarnessState {
  appId: string
  appDir: string
  projectsDir: string
  ready?: boolean
}

let harness: ChildProcess | null = null
let shots = 0
let overflowChecks = 0

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

async function readState(): Promise<HarnessState> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8')) as HarnessState
    } catch {
      await delay(25)
    }
  }
  throw new Error(`无法读取 harness 状态：${stateFile}`)
}

async function waitFor(checkFn: () => boolean | Promise<boolean>, timeoutMs: number, label: string): Promise<number> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await checkFn()) return Date.now() - started
    await delay(60)
  }
  throw new Error(`等待超时（${timeoutMs}ms）：${label}`)
}

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

async function startHarness(): Promise<void> {
  harness = spawn('npx', ['tsx', 'scripts/p2-e2e-harness.ts'], {
    cwd: backendDir,
    shell: true,
    windowsHide: true,
    env: {
      ...process.env,
      P2_ROOT: root,
      P2_STATE_FILE: stateFile,
      P2_PORT: String(port),
      P2_APP_ID: appId,
      P2_APP_NAME: 'UI-1b 三视图'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  harness.stdout?.on('data', chunk => process.stdout.write(`[harness] ${chunk}`))
  harness.stderr?.on('data', chunk => process.stderr.write(`[harness] ${chunk}`))
  await waitFor(() => fs.existsSync(stateFile) && fs.readFileSync(stateFile, 'utf8').includes('"appId"'), 60000, 'harness 状态文件')
  await waitFor(async () => {
    try {
      return (await fetch(`${base}/api/health`)).ok
    } catch {
      return false
    }
  }, 60000, 'harness /api/health')
  await waitFor(async () => {
    try {
      return (await readState()).ready === true
    } catch {
      return false
    }
  }, 60000, 'harness 应用就绪')
}

function stopHarness(): void {
  if (!harness?.pid) return
  try {
    execFileSync('taskkill', ['/PID', String(harness.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
  } catch {
    // 已退出
  }
  harness = null
}

/** 设计产物：2 实体 / 2 页面（让设计视图徽标与 ER 有内容） */
function seedDesign(appDir: string): void {
  const entities = [
    {
      id: 'product',
      name: '商品',
      table: 'biz_product',
      fields: [
        { code: 'productCode', name: '商品编码', type: 'string', required: true, unique: true },
        { code: 'productName', name: '商品名称', type: 'string', required: true },
        { code: 'categoryId', name: '商品分类', type: 'ref', ref: 'category' },
        { code: 'price', name: '销售单价', type: 'number' },
        { code: 'stock', name: '库存数量', type: 'number' },
        {
          code: 'status',
          name: '商品状态',
          type: 'enum',
          options: [
            { value: 'ON_SALE', label: '上架' },
            { value: 'OFF_SALE', label: '下架' }
          ]
        }
      ]
    },
    {
      id: 'category',
      name: '商品分类',
      table: 'biz_category',
      fields: [
        { code: 'categoryName', name: '分类名称', type: 'string', required: true },
        { code: 'parentId', name: '父分类', type: 'ref', ref: 'category' }
      ]
    }
  ]
  const pageSets = [
    {
      id: 'product',
      epic: 'EP-001',
      title: '商品管理',
      primaryEntity: 'product',
      pages: [
        {
          id: 'product-list',
          name: '商品列表',
          type: 'list',
          entity: 'product',
          columns: ['productCode', 'productName', 'categoryId', 'price', 'stock', 'status'],
          filters: ['productName', 'status'],
          rowActions: ['detail', 'edit', 'delete'],
          toolbarActions: ['create'],
          selection: true,
          pagination: { layout: 'three-part', pageSize: 20 },
          components: { price: 'pm-number', stock: 'pm-number', status: 'pm-select' }
        },
        {
          id: 'product-form',
          name: '商品编辑',
          type: 'form',
          entity: 'product',
          form: {
            columns: 2,
            width: 800,
            fields: ['productCode', 'productName', 'categoryId', 'price', 'stock', 'status'],
            groups: [{ title: '基本信息', fields: ['productCode', 'productName', 'categoryId'] }]
          }
        }
      ]
    }
  ]
  writeDesignArtifacts(appDir, entities, pageSets, [{ from: 'product', to: 'category', type: 'N:1', label: '所属分类' }])
}

async function prepareArtifacts(): Promise<string> {
  const state = await readState()
  writeRequirementsDoc(state.appDir, {
    epics: [
      { id: 'EP-001', title: '商品管理', stories: [{ id: 'US-001', title: '商品台账' }] },
      { id: 'EP-002', title: '订单管理', stories: [{ id: 'US-002', title: '订单查询' }] }
    ]
  })
  seedDesign(state.appDir)

  // 开发视图：建会话 + 走 stub 的一轮（不调用真实模型）
  const session = await request('POST', `/apps/${appId}/development/session`, { view: 'development' })
  if (session.status !== 200) throw new Error(`准备开发会话失败（HTTP ${session.status}）`)
  const prompt = await request('POST', `/apps/${appId}/development/prompt`, {
    text: '开始开发：先读 AGENTS.md 与 docs/，再按设计实现商品列表页。',
    view: 'development'
  })
  if (prompt.status !== 200) throw new Error(`准备开发时间线失败（HTTP ${prompt.status}）`)
  await delay(2200)
  return state.appDir
}

const VIEWS = [
  { key: 'requirements', testId: 'requirements-view', title: '需求' },
  { key: 'design', testId: 'design-view', title: '设计' },
  { key: 'development', testId: 'dev-view', title: '开发' }
] as const

const MATRIX = [
  { width: 1440, height: 900 },
  { width: 1024, height: 900 },
  { width: 390, height: 844 }
] as const

async function main(): Promise<void> {
  await startHarness()
  await prepareArtifacts()

  const browser: Browser = await chromium.launch()
  try {
    for (const item of MATRIX) {
      const context = await browser.newContext({ viewport: { width: item.width, height: item.height } })
      await context.addInitScript(() => {
        try {
          window.localStorage.setItem('rg.theme', JSON.stringify('light'))
        } catch {
          // ignore
        }
      })
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => {
        if (message.type() === 'error' && !/favicon/i.test(message.text())) errors.push(message.text())
      })
      for (const view of VIEWS) {
        await page.goto(`${base}/#/apps/${appId}/${view.key}`, { waitUntil: 'domcontentloaded' })
        await page.locator(`[data-testid=${view.testId}]`).waitFor({ state: 'visible', timeout: 15000 })
        await delay(900)
        const overflow = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          inner: window.innerWidth
        }))
        overflowChecks += 1
        if (overflow.doc > overflow.inner + 1 || overflow.body > overflow.inner + 1) {
          throw new Error(`${view.title}/${item.width} 出现整页横向溢出（${overflow.doc}/${overflow.body}/${overflow.inner}）`)
        }
        await page.screenshot({ path: path.join(shotsDir, `ui1b-${view.key}-${item.width}.png`) })
        shots += 1
      }
      if (errors.length) throw new Error(`${item.width} 出现 console/page error：${errors.join(' | ')}`)
      await context.close()
    }

    // 1440 深色：需求 / 设计（开发视图在 p4 已有深浅矩阵，不重复）
    for (const key of ['requirements', 'design'] as const) {
      const view = VIEWS.find(item => item.key === key)!
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await context.addInitScript(() => {
        try {
          window.localStorage.setItem('rg.theme', JSON.stringify('dark'))
        } catch {
          // ignore
        }
      })
      const page = await context.newPage()
      await page.goto(`${base}/#/apps/${appId}/${key}`, { waitUntil: 'domcontentloaded' })
      await page.locator(`[data-testid=${view.testId}]`).waitFor({ state: 'visible', timeout: 15000 })
      await delay(900)
      await page.screenshot({ path: path.join(shotsDir, `ui1b-${key}-1440-dark.png`) })
      shots += 1
      await context.close()
    }
  } finally {
    await browser.close().catch(() => undefined)
    stopHarness()
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        fs.rmSync(root, { recursive: true, force: true })
        break
      } catch {
        await delay(200)
      }
    }
  }

  console.log(`\n[ui1b-shots] 完成：${shots} 张截图，${overflowChecks} 次无溢出校验；目录 ${shotsDir}`)
}

main().catch(error => {
  console.error(`\n[ui1b-shots] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
