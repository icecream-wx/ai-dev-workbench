/**
 * UI-3a 按钮 / 图标 / chip 原语证据截图（stub 后端，不调用模型）
 *
 * 前置：`npm run build --prefix frontend`（Express 静态托管 frontend/dist）。
 * 运行（backend 目录）：`npx tsx scripts/ui3a-shots.ts`
 *
 * - 临时 SQLite/projects + 独立端口 3436（stub opencode 4436）；`OPENCODE_AUTO_START=false`
 * - 复用 p2 harness：真实后端 + 前端 dist；不占用真实 3300 / 4771
 * - 覆盖 1440 首页/外壳/需求/设计/开发/聊天面板，1024 外壳/需求/开发，390 首页/外壳/需求/开发
 * - 每屏校验无整页横向溢出；并校验 shell 按钮 32 高、状态 chip 24 高
 * - 输出目录默认 `docs/plans/evidence/2026-11-23-ui3a/`（可用 UI3A_SHOTS_DIR 覆盖）
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'
import { writeDesignArtifacts, writeRequirementsDoc } from './ui-shots-fixtures'

const backendDir = path.resolve(__dirname, '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-ui3a-shots-'))
const stateFile = path.join(root, 'state.json')
const shotsDir =
  process.env.UI3A_SHOTS_DIR ||
  path.resolve(backendDir, '..', 'docs', 'plans', 'evidence', '2026-11-23-ui3a')
const port = 3436
const base = `http://127.0.0.1:${port}`
const appId = 'ui3a-app'

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
const failures: string[] = []

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
      P2_APP_NAME: 'UI-3a 原语'
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
      if (errors.length) failures.push(`页面出现错误：${errors.join(' | ')}`)
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
    failures.push(`${label} 出现整页横向溢出（doc=${overflow.doc} body=${overflow.body} inner=${overflow.inner}）`)
  }
  await page.screenshot({ path: path.join(shotsDir, name) })
  shots += 1
  console.log(`[ui3a-shots] ${name}  ${label}`)
}

/** 顶部外壳特写：只取应用栏 + 工具栏，聚焦原语（返回/模型/主题/更多/状态 chip/按钮） */
async function captureShell(page: Page, name: string, label: string): Promise<void> {
  const height = 320
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    inner: window.innerWidth
  }))
  overflowChecks += 1
  if (overflow.doc > overflow.inner + 1 || overflow.body > overflow.inner + 1) {
    failures.push(`${label} 出现整页横向溢出（doc=${overflow.doc} body=${overflow.body} inner=${overflow.inner}）`)
  }
  await page.screenshot({
    path: path.join(shotsDir, name),
    clip: { x: 0, y: 0, width: page.viewportSize()?.width ?? 1440, height }
  })
  shots += 1
  console.log(`[ui3a-shots] ${name}  ${label}`)
}

async function gotoAndWait(page: Page, hash: string, testId: string): Promise<void> {
  await page.goto(`${base}/${hash}`, { waitUntil: 'domcontentloaded' })
  await page.locator(`[data-testid=${testId}]`).waitFor({ state: 'visible', timeout: 20000 })
  await delay(300)
}

function seedDesign(harnessState: HarnessState): void {
  writeRequirementsDoc(harnessState.appDir)
  writeDesignArtifacts(
    harnessState.appDir,
    [
      {
        id: 'product',
        name: '商品',
        fields: [
          { code: 'productCode', name: '商品编码', type: 'string' },
          { code: 'productName', name: '商品名称', type: 'string' },
          {
            code: 'status',
            name: '状态',
            type: 'enum',
            options: [
              { value: 'ON_SALE', label: '上架' },
              { value: 'OFF_SALE', label: '下架' }
            ]
          }
        ]
      }
    ],
    [
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
            filters: ['productName', 'status'],
            columns: ['productCode', 'productName', 'status'],
            rowActions: ['detail', 'edit', 'delete'],
            toolbarActions: ['create'],
            selection: true,
            pagination: { layout: 'three-part', pageSize: 20 }
          }
        ]
      }
    ]
  )
}

/** 校验原语尺寸：按钮 32 高、chip 24 高（外壳可见元素） */
async function assertPrimitiveSizes(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => {
    const moreEl = document.querySelector('[data-testid=app-more]')
    const statusEl = document.querySelector('[data-testid=app-status]')
    return {
      more: moreEl ? Math.round(moreEl.getBoundingClientRect().height) : -1,
      status: statusEl ? Math.round(statusEl.getBoundingClientRect().height) : -1
    }
  })
  if (sizes.more !== 32) failures.push(`更多按钮应为 32 高（实际 ${sizes.more}）`)
  if (sizes.status !== 24) failures.push(`外壳状态 chip 应为 24 高（实际 ${sizes.status}）`)
  const modelButton = page.getByRole('button', { name: '模型' })
  if (await modelButton.count()) {
    const box = await modelButton.first().boundingBox()
    if (!box || Math.round(box.height) !== 32) failures.push(`模型按钮应为 32 高（实际 ${box?.height}）`)
  }
}

async function main(): Promise<void> {
  await startHarness()
  const harnessState = await readState()
  seedDesign(harnessState)

  const browser: Browser = await chromium.launch()
  try {
    // ---------- 1440 ----------
    const desktop = await createPage(browser, 1440, 900)
    try {
      await gotoAndWait(desktop.page, '#/', 'home-runtime')
      await capture(desktop.page, 'ui3a-home-1440.png', '首页（1440）')

      await gotoAndWait(desktop.page, `#/apps/${appId}/requirements`, 'requirements-view')
      await assertPrimitiveSizes(desktop.page)
      await captureShell(desktop.page, 'ui3a-shell-1440.png', '应用外壳 + 需求工具栏（1440）')
      await capture(desktop.page, 'ui3a-requirements-1440.png', '需求视图（1440）')
      await desktop.page.locator('[data-testid=chat-panel]').screenshot({ path: path.join(shotsDir, 'ui3a-chat-panel-1440.png') })
      shots += 1
      console.log('[ui3a-shots] ui3a-chat-panel-1440.png  AI 对话面板（1440）')

      await gotoAndWait(desktop.page, `#/apps/${appId}/design`, 'design-view')
      await delay(400)
      await capture(desktop.page, 'ui3a-design-1440.png', '设计视图（1440）')

      await gotoAndWait(desktop.page, `#/apps/${appId}/development`, 'dev-view')
      await delay(400)
      await capture(desktop.page, 'ui3a-dev-1440.png', '开发视图（1440）')
    } finally {
      await desktop.close()
    }

    // ---------- 1024 ----------
    const tablet = await createPage(browser, 1024, 768)
    try {
      await gotoAndWait(tablet.page, `#/apps/${appId}/requirements`, 'requirements-view')
      await captureShell(tablet.page, 'ui3a-shell-1024.png', '应用外壳 + 需求工具栏（1024）')
      await capture(tablet.page, 'ui3a-requirements-1024.png', '需求视图（1024）')

      await gotoAndWait(tablet.page, `#/apps/${appId}/development`, 'dev-view')
      await delay(400)
      await capture(tablet.page, 'ui3a-dev-1024.png', '开发视图（1024）')
    } finally {
      await tablet.close()
    }

    // ---------- 390 ----------
    const mobile = await createPage(browser, 390, 844)
    try {
      await gotoAndWait(mobile.page, '#/', 'home-runtime')
      await capture(mobile.page, 'ui3a-home-390.png', '首页（390）')

      await gotoAndWait(mobile.page, `#/apps/${appId}/requirements`, 'requirements-view')
      await captureShell(mobile.page, 'ui3a-shell-390.png', '应用外壳 + 需求工具栏（390）')
      await capture(mobile.page, 'ui3a-requirements-390.png', '需求视图（390）')

      await gotoAndWait(mobile.page, `#/apps/${appId}/development`, 'dev-view')
      await delay(400)
      await capture(mobile.page, 'ui3a-dev-390.png', '开发视图（390）')
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

  if (failures.length) {
    throw new Error(`\n- ${failures.join('\n- ')}`)
  }
  console.log(`\n[ui3a-shots] 完成：${shots} 张截图，${overflowChecks} 次无溢出校验；目录 ${shotsDir}`)
}

main().catch(error => {
  console.error(`\n[ui3a-shots] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
