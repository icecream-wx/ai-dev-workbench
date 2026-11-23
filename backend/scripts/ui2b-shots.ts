/**
 * UI-2b AI 面板空态/示例/加载/错误证据截图（stub 后端，不调用模型）
 *
 * 前置：`npm run build --prefix frontend`（Express 静态托管 frontend/dist）。
 * 运行（backend 目录）：`npx tsx scripts/ui2b-shots.ts`
 *
 * - 临时 SQLite/projects + 独立端口 3435（opencode 4435）；`OPENCODE_AUTO_START=false`，stub opencode
 * - 复用 p2 harness：真实后端 + 前端 dist；不占用真实 3300 / 4771
 * - 覆盖：需求/设计/工作室 AI 面板空态（1440 + 390）、会话加载骨架、错误条 + 重试
 * - 每屏校验无整页横向溢出
 * - 输出目录默认 `docs/plans/evidence/2026-11-23-ui2b/`（可用 UI2B_SHOTS_DIR 覆盖）
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-ui2b-shots-'))
const stateFile = path.join(root, 'state.json')
const shotsDir =
  process.env.UI2B_SHOTS_DIR ||
  path.resolve(backendDir, '..', 'docs', 'plans', 'evidence', '2026-11-23-ui2b')
const port = 3435
const base = `http://127.0.0.1:${port}`
const appId = 'ui2b-app'

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
      P2_APP_NAME: 'UI-2b AI 面板'
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

async function createPage(browser: Browser, width: number, height: number): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width, height } })
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
  console.log(`[ui2b-shots] ${name}  ${label}`)
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
  await page.locator(`[data-testid=${testId}]`).waitFor({ state: 'visible', timeout: 20000 })
  await delay(300)
}

/** 会话状态接口（`/development?view=...`，不含 `/sessions`） */
const chatStatePattern = new RegExp(`/api/apps/${appId}/development\\?`)

async function main(): Promise<void> {
  await startHarness()

  const browser: Browser = await chromium.launch()
  try {
    // ---- 需求视图（1440）：空态 / 加载 / 错误 ----
    const requirements = await createPage(browser, 1440, 900)
    try {
      await gotoAndWait(requirements.page, `#/apps/${appId}/requirements`, 'requirements-empty')
      await requirements.page.locator('[data-testid=chat-empty]').waitFor({ state: 'visible', timeout: 15000 })
      await capture(requirements.page, 'ui2b-requirements-empty-1440.png', '需求 · AI 面板空态（示例 + 上下文）')

      await withDelayedRoute(requirements.page, chatStatePattern, async () => {
        await requirements.page.reload({ waitUntil: 'domcontentloaded' })
        await requirements.page
          .locator('[data-testid=chat-loading]')
          .waitFor({ state: 'visible', timeout: 15000 })
        await delay(250)
        await capture(requirements.page, 'ui2b-chat-loading-1440.png', 'AI 面板 · 会话加载骨架')
      })

      await withErrorRoute(requirements.page, chatStatePattern, '模拟会话读取失败，请重试', async () => {
        await requirements.page.reload({ waitUntil: 'domcontentloaded' })
        await requirements.page
          .locator('[data-testid=chat-error-strip]')
          .waitFor({ state: 'visible', timeout: 15000 })
        await delay(250)
        await capture(requirements.page, 'ui2b-chat-error-1440.png', 'AI 面板 · 错误条 + 重试')
      })
    } finally {
      await requirements.close()
    }

    // 设计/工作室需要一个需求模块
    const created = await request('POST', `/apps/${appId}/requirements-modules`, { title: '空态示例' })
    if (created.status !== 201) throw new Error(`准备模块失败（HTTP ${created.status}）`)

    // ---- 设计视图（1440）：AI 面板空态 ----
    const design = await createPage(browser, 1440, 900)
    try {
      await gotoAndWait(design.page, `#/apps/${appId}/design`, 'design-empty')
      await design.page.locator('[data-testid=chat-empty]').waitFor({ state: 'visible', timeout: 15000 })
      await capture(design.page, 'ui2b-design-empty-1440.png', '设计 · AI 面板空态（模块 pill + 示例）')
    } finally {
      await design.close()
    }

    // ---- 模板工作室（1440 / 390）：AI 面板空态 ----
    const draft = await request('POST', '/design-templates/drafts', {
      name: 'UI-2b 空态示例模板',
      style: 'data-cyan',
      baseApplicationType: 'operations-management'
    })
    const packId: string = draft.data?.draft?.id ?? ''
    if (draft.status !== 201 || !packId) throw new Error(`准备工作室草稿失败（HTTP ${draft.status}）`)

    const studio = await createPage(browser, 1440, 900)
    try {
      await gotoAndWait(studio.page, `#/studio/${packId}`, 'studio-pane-chat')
      await studio.page.locator('[data-testid=chat-empty]').waitFor({ state: 'visible', timeout: 20000 })
      await capture(studio.page, 'ui2b-studio-empty-1440.png', '工作室 · AI 面板空态（pack pill + 示例）')
    } finally {
      await studio.close()
    }

    // ---- 390：需求对话抽屉空态 + 工作室对话面板空态 ----
    const mobile = await createPage(browser, 390, 844)
    try {
      await gotoAndWait(mobile.page, `#/apps/${appId}/requirements`, 'requirements-view')
      await mobile.page.locator('[data-testid=chat-toggle]').click()
      await mobile.page.locator('[data-testid=chat-empty]').waitFor({ state: 'visible', timeout: 15000 })
      await delay(250)
      await capture(mobile.page, 'ui2b-requirements-empty-390.png', '需求 390 · 对话抽屉 AI 面板空态')

      await gotoAndWait(mobile.page, `#/studio/${packId}`, 'studio-pane-chat')
      await mobile.page.locator('[data-testid=chat-empty]').waitFor({ state: 'visible', timeout: 20000 })
      await delay(250)
      await capture(mobile.page, 'ui2b-studio-empty-390.png', '工作室 390 · 对话面板 AI 面板空态')
    } finally {
      await mobile.close()
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

  console.log(`\n[ui2b-shots] 完成：${shots} 张截图，${overflowChecks} 次无溢出校验；目录 ${shotsDir}`)
}

main().catch(error => {
  console.error(`\n[ui2b-shots] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
