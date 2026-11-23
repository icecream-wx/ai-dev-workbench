/**
 * UI-2a 空态/加载/错误 + 骨架屏证据截图（stub 后端，不调用模型）
 *
 * 前置：`npm run build --prefix frontend`（Express 静态托管 frontend/dist）。
 * 运行（backend 目录）：`npx tsx scripts/ui2a-shots.ts`
 *
 * - 临时 SQLite/projects + 独立端口 3434；`OPENCODE_AUTO_START=false`，stub opencode
 * - 复用 p2 harness：真实后端 + 前端 dist；不占用真实 3300 / 4771
 * - 覆盖：首页 empty/loading/error、需求 empty/loading/error、设计 empty/loading、
 *   开发 start/loading；每屏校验无整页横向溢出
 * - 输出目录默认 `docs/plans/evidence/2026-11-23-ui2a/`（可用 UI2A_SHOTS_DIR 覆盖）
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-ui2a-shots-'))
const stateFile = path.join(root, 'state.json')
const shotsDir =
  process.env.UI2A_SHOTS_DIR ||
  path.resolve(backendDir, '..', 'docs', 'plans', 'evidence', '2026-11-23-ui2a')
const port = 3434
const base = `http://127.0.0.1:${port}`
const appId = 'ui2a-app'

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
      P2_APP_NAME: 'UI-2a 空态骨架'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  harness.stdout?.on('data', chunk => process.stdout.write(`[harness] ${chunk}`))
  harness.stderr?.on('data', chunk => process.stderr.write(`[harness] ${chunk}`))
  await waitFor(
    () => fs.existsSync(stateFile) && fs.readFileSync(stateFile, 'utf8').includes('"appId"'),
    60000,
    'harness 状态文件'
  )
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

async function createPage(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('rg.theme', JSON.stringify('light'))
    } catch {
      // ignore
    }
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error' && !/favicon|Failed to load resource/i.test(message.text())) {
      errors.push(`console: ${message.text()}`)
    }
  })
  return {
    page,
    close: async () => {
      if (errors.length) throw new Error(`页面出现错误：${errors.join(' | ')}`)
      await context.close()
    }
  }
}

/** 截图 + 无整页横向溢出校验 */
async function capture(page: Page, name: string, label: string): Promise<void> {
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    inner: window.innerWidth
  }))
  overflowChecks += 1
  if (overflow.doc > overflow.inner + 1 || overflow.body > overflow.inner + 1) {
    throw new Error(
      `${label} 出现整页横向溢出（doc=${overflow.doc} body=${overflow.body} inner=${overflow.inner}）`
    )
  }
  await page.screenshot({ path: path.join(shotsDir, name) })
  shots += 1
  console.log(`[ui2a-shots] ${name}  ${label}`)
}

/** 挂起匹配请求，让页面停留在 loading 态；截图后释放 */
async function withDelayedRoute(page: Page, pattern: RegExp, task: () => Promise<void>): Promise<void> {
  let release: () => void = () => undefined
  const gate = new Promise<void>(resolve => {
    release = resolve
  })
  await page.route(pattern, async route => {
    await gate
    try {
      await route.continue()
    } catch {
      // 页面已导航/关闭
    }
  })
  try {
    await task()
  } finally {
    release()
    await page.unroute(pattern).catch(() => undefined)
  }
}

async function withErrorRoute(
  page: Page,
  pattern: RegExp,
  message: string,
  task: () => Promise<void>
): Promise<void> {
  await page.route(pattern, route =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: message })
    })
  )
  try {
    await task()
  } finally {
    await page.unroute(pattern).catch(() => undefined)
  }
}

async function gotoAndWait(page: Page, hash: string, testId: string): Promise<void> {
  await page.goto(`${base}/${hash}`, { waitUntil: 'domcontentloaded' })
  await page.locator(`[data-testid=${testId}]`).waitFor({ state: 'visible', timeout: 15000 })
  await delay(300)
}

async function main(): Promise<void> {
  await startHarness()

  const browser: Browser = await chromium.launch()
  try {
    // ---- 首页：empty / loading / error（拦截 /api/apps） ----
    const home = await createPage(browser)
    try {
      await home.page.route(/\/api\/apps$/, route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ apps: [] }) })
      )
      await gotoAndWait(home.page, '', 'home-empty')
      await capture(home.page, 'ui2a-home-empty.png', '首页 · 无应用空态')
      await home.page.unroute(/\/api\/apps$/).catch(() => undefined)

      await withDelayedRoute(home.page, /\/api\/apps$/, async () => {
        await home.page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
        await home.page.locator('[data-testid=home-loading]').waitFor({ state: 'visible', timeout: 10000 })
        await delay(250)
        await capture(home.page, 'ui2a-home-loading.png', '首页 · 应用列表加载骨架')
      })

      await withErrorRoute(home.page, /\/api\/apps$/, '模拟应用列表读取失败', async () => {
        await home.page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
        await home.page.locator('[data-testid=home-error]').waitFor({ state: 'visible', timeout: 10000 })
        await delay(250)
        await capture(home.page, 'ui2a-home-error.png', '首页 · 应用列表错误 + 重试')
      })
    } finally {
      await home.close()
    }

    // ---- 需求视图：empty / loading / error ----
    const requirements = await createPage(browser)
    try {
      await gotoAndWait(requirements.page, `#/apps/${appId}/requirements`, 'requirements-empty')
      await capture(requirements.page, 'ui2a-requirements-empty.png', '需求 · 无模块空态')

      const artifactsPattern = new RegExp(`/api/apps/${appId}/artifacts$`)
      await withDelayedRoute(requirements.page, artifactsPattern, async () => {
        await requirements.page.reload({ waitUntil: 'domcontentloaded' })
        await requirements.page
          .locator('[data-testid=requirements-loading]')
          .waitFor({ state: 'visible', timeout: 10000 })
        await requirements.page
          .locator('[data-testid=module-outline-loading]')
          .waitFor({ state: 'visible', timeout: 10000 })
        await delay(250)
        await capture(requirements.page, 'ui2a-requirements-loading.png', '需求 · 文档/大纲加载骨架')
      })

      await withErrorRoute(requirements.page, artifactsPattern, '模拟需求文档读取失败', async () => {
        await requirements.page.reload({ waitUntil: 'domcontentloaded' })
        await requirements.page
          .locator('[data-testid=requirements-error]')
          .waitFor({ state: 'visible', timeout: 10000 })
        await delay(250)
        await capture(requirements.page, 'ui2a-requirements-error.png', '需求 · 文档错误 + 重试')
      })
    } finally {
      await requirements.close()
    }

    // 设计/开发需要一个需求模块
    const created = await request('POST', `/apps/${appId}/requirements-modules`, { title: '空态示例' })
    if (created.status !== 201) throw new Error(`准备模块失败（HTTP ${created.status}）`)

    // ---- 设计视图：empty / loading ----
    const design = await createPage(browser)
    try {
      await gotoAndWait(design.page, `#/apps/${appId}/design`, 'design-empty')
      await capture(design.page, 'ui2a-design-empty.png', '设计 · 模块未生成设计空态')

      const artifactsPattern = new RegExp(`/api/apps/${appId}/artifacts$`)
      await withDelayedRoute(design.page, artifactsPattern, async () => {
        await design.page.reload({ waitUntil: 'domcontentloaded' })
        await design.page.locator('[data-testid=design-loading]').waitFor({ state: 'visible', timeout: 10000 })
        await design.page
          .locator('[data-testid=design-module-loading]')
          .waitFor({ state: 'visible', timeout: 10000 })
        await delay(250)
        await capture(design.page, 'ui2a-design-loading.png', '设计 · 模块/画布/实体骨架')
      })
    } finally {
      await design.close()
    }

    // ---- 开发视图：start / loading ----
    const development = await createPage(browser)
    try {
      await gotoAndWait(development.page, `#/apps/${appId}/development`, 'dev-start-card')
      await development.page
        .locator('[data-testid=dev-start-checklist]')
        .waitFor({ state: 'visible', timeout: 10000 })
      await capture(development.page, 'ui2a-dev-start.png', '开发 · 任务清单/下一步空态')

      const devStatePattern = new RegExp(`/api/apps/${appId}/development(\\?|$)`)
      await withDelayedRoute(development.page, devStatePattern, async () => {
        await development.page.reload({ waitUntil: 'domcontentloaded' })
        await development.page.locator('[data-testid=dev-loading]').waitFor({ state: 'visible', timeout: 10000 })
        await development.page
          .locator('[data-testid=session-list-loading]')
          .waitFor({ state: 'visible', timeout: 10000 })
        await delay(250)
        await capture(development.page, 'ui2a-dev-loading.png', '开发 · 会话列表/时间线骨架')
      })
    } finally {
      await development.close()
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

  console.log(`\n[ui2a-shots] 完成：${shots} 张截图，${overflowChecks} 次无溢出校验；目录 ${shotsDir}`)
}

main().catch(error => {
  console.error(`\n[ui2a-shots] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
