/**
 * UI-3b 卡片/面板 + dialog + tabs 证据截图（stub 后端，不调用模型）
 *
 * 前置：`npm run build --prefix frontend`（Express 静态托管 frontend/dist）。
 * 运行（backend 目录）：`npx tsx scripts/ui3b-shots.ts`
 *
 * - 临时 SQLite/projects + 独立端口 3438（stub opencode 4438）；`OPENCODE_AUTO_START=false`
 * - 复用 p2 harness：真实后端 + 前端 dist；不占用真实 3300 / 4771
 * - 覆盖 1440/1024/390：首页、外壳、需求、设计（ER/原型）、开发、聊天面板、
 *   新建应用 / 模板库 / 新建模块对话框、设计模板中心分类 tab、模板中心工作室 narrow tab
 * - 每屏校验无整页横向溢出；并测量卡片 padding/radius/shadow、tab 高度、对话框间距
 * - 输出目录默认 `docs/plans/evidence/2026-11-23-ui3b/`（可用 UI3B_SHOTS_DIR 覆盖）
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-ui3b-shots-'))
const stateFile = path.join(root, 'state.json')
const shotsDir =
  process.env.UI3B_SHOTS_DIR ||
  path.resolve(backendDir, '..', 'docs', 'plans', 'evidence', '2026-11-23-ui3b')
const port = 3438
const base = `http://127.0.0.1:${port}`
const appId = 'ui3b-app'

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
let metricChecks = 0
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
      P2_APP_NAME: 'UI-3b 卡片与对话框',
      P2_DESIGN_SYSTEM: JSON.stringify({
        pack: 'afcenter-app-templates-v1',
        applicationType: 'enterprise-application-platform',
        style: 'platform-blue'
      })
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
  console.log(`[ui3b-shots] ${name}  ${label}`)
}

/** 顶部外壳特写 */
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
  console.log(`[ui3b-shots] ${name}  ${label}`)
}

async function gotoAndWait(page: Page, hash: string, testId: string): Promise<void> {
  await page.goto(`${base}/${hash}`, { waitUntil: 'domcontentloaded' })
  await page.locator(`[data-testid=${testId}]`).waitFor({ state: 'visible', timeout: 20000 })
  await delay(300)
}

interface BoxMetrics {
  padding: number
  radius: number
  shadow: string
  height: number
}

async function measure(page: Page, selector: string): Promise<BoxMetrics | null> {
  const locator = page.locator(selector).first()
  if (!(await locator.count())) return null
  return locator.evaluate(el => {
    const style = getComputedStyle(el)
    return {
      padding: Number.parseFloat(style.paddingLeft || '0'),
      radius: Number.parseFloat(style.borderTopLeftRadius || '0'),
      shadow: style.boxShadow || 'none',
      height: Math.round(el.getBoundingClientRect().height)
    }
  })
}

/** 卡片口径：padding 16—20、radius 12、shadow-1（非 none） */
async function assertCard(page: Page, selector: string, label: string): Promise<void> {
  const metrics = await measure(page, selector)
  metricChecks += 1
  if (!metrics) {
    failures.push(`${label} 找不到卡片：${selector}`)
    return
  }
  if (metrics.padding < 15.5 || metrics.padding > 20.5) {
    failures.push(`${label} 卡片 padding 应为 16—20（实际 ${metrics.padding}）`)
  }
  if (Math.round(metrics.radius) !== 12) {
    failures.push(`${label} 卡片 radius 应为 12（实际 ${metrics.radius}）`)
  }
  if (!metrics.shadow || metrics.shadow === 'none') {
    failures.push(`${label} 卡片缺少 shadow-1（实际 ${metrics.shadow}）`)
  }
}

async function assertDocPanel(page: Page, selector: string, label: string): Promise<void> {
  const metrics = await measure(page, selector)
  metricChecks += 1
  if (!metrics) {
    failures.push(`${label} 找不到面板：${selector}`)
    return
  }
  if (Math.round(metrics.radius) !== 12) failures.push(`${label} 面板 radius 应为 12（实际 ${metrics.radius}）`)
  if (!metrics.shadow || metrics.shadow === 'none') failures.push(`${label} 面板缺少 shadow-1（实际 ${metrics.shadow}）`)
}

/** tab：高度 32—36；active 有 2px 墨色下划线 */
async function assertTabs(page: Page, selector: string, label: string): Promise<void> {
  const metrics = await measure(page, selector)
  metricChecks += 1
  if (!metrics) {
    failures.push(`${label} 找不到 tab：${selector}`)
    return
  }
  if (metrics.height < 32 || metrics.height > 36) {
    failures.push(`${label} tab 高度应为 32—36（实际 ${metrics.height}）`)
  }
  const activeLine = await page
    .locator(`${selector}.rg-tab--active`)
    .first()
    .evaluate(el => getComputedStyle(el, '::after').backgroundColor)
    .catch(() => '')
  if (!activeLine || activeLine === 'transparent' || /rgba\(0, 0, 0, 0\)/.test(activeLine)) {
    failures.push(`${label} active tab 缺少下划线（实际 ${activeLine || '无'}）`)
  }
}

async function closeElDialog(page: Page): Promise<void> {
  const dialog = page.locator('.el-dialog:visible').last()
  await dialog.locator('.el-dialog__headerbtn').click()
  await dialog.waitFor({ state: 'hidden', timeout: 10000 })
  await delay(250)
}

function seedDesign(harnessState: HarnessState): void {
  const designDir = path.join(harnessState.appDir, 'docs', 'design', 'MOD-001')
  fs.mkdirSync(designDir, { recursive: true })
  fs.writeFileSync(
    path.join(designDir, 'design.json'),
    `${JSON.stringify(
      {
        module: 'MOD-001',
        title: '商品管理',
        designSystem: {
          pack: 'afcenter-app-templates-v1',
          applicationType: 'enterprise-application-platform',
          style: 'platform-blue'
        },
        entities: [
          {
            id: 'product',
            name: '商品',
            fields: [
              { name: '商品编码', type: 'string' },
              { name: '商品名称', type: 'string' },
              { name: '状态', type: 'enum', options: ['上架', '下架'] }
            ]
          },
          {
            id: 'category',
            name: '分类',
            fields: [
              { name: '分类编码', type: 'string' },
              { name: '分类名称', type: 'string' }
            ]
          }
        ],
        relations: [{ from: 'product', to: 'category', type: 'n1', name: '所属分类' }],
        pages: [
          {
            id: 'product-list',
            name: '商品列表',
            type: 'list',
            recipe: 'tree-list',
            catalogRef: 'enterprise-application-platform/organization',
            blueprint: 'application-types/enterprise-application-platform/pages/OrganizationUsers.vue',
            entity: 'product',
            filters: ['商品名称', '状态'],
            columns: ['商品编码', '商品名称', '状态'],
            rowActions: ['detail', 'edit', 'delete'],
            toolbarActions: ['create'],
            selection: true,
            pagination: { layout: 'three-part', pageSize: 20 }
          },
          {
            id: 'product-form',
            name: '商品表单',
            type: 'dialog-form',
            recipe: 'dialog-form',
            catalogRef: 'enterprise-application-platform/application-form',
            entity: 'product',
            form: { fields: ['商品编码', '商品名称', '状态'] }
          }
        ]
      },
      null,
      2
    )}\n`,
    'utf8'
  )
}

async function openHome(page: Page): Promise<void> {
  await gotoAndWait(page, '#/', 'home-runtime')
}

async function captureHomeCards(page: Page, label: string): Promise<void> {
  await assertCard(page, '.apps-card', `${label} · 最近应用卡`)
  await assertCard(page, '.quick-card', `${label} · 快捷开始卡`)
  await assertCard(page, '.runtime-card', `${label} · 运行状态卡`)
  if (await page.locator('.app-item').count()) {
    await assertCard(page, '.app-item', `${label} · 应用列表卡`)
  }
}

async function main(): Promise<void> {
  await startHarness()
  const harnessState = await readState()

  const created = await request('POST', `/apps/${appId}/requirements-modules`, { title: '商品管理' })
  if (created.status !== 201) throw new Error(`准备需求模块失败（HTTP ${created.status}）`)
  seedDesign(harnessState)

  const draft = await request('POST', '/design-templates/drafts', {
    name: 'UI-3b 卡片示例模板',
    style: 'data-cyan',
    baseApplicationType: 'operations-management'
  })
  const packId: string = draft.data?.draft?.id ?? ''
  if (draft.status !== 201 || !packId) throw new Error(`准备工作室草稿失败（HTTP ${draft.status}）`)

  const browser: Browser = await chromium.launch()
  try {
    // ---------------- 1440 ----------------
    const desktop = await createPage(browser, 1440, 900)
    try {
      await openHome(desktop.page)
      await captureHomeCards(desktop.page, '首页（1440）')
      await capture(desktop.page, 'ui3b-home-1440.png', '首页 · 卡片（1440）')

      // 新建应用（自定义壳）
      await desktop.page.locator('[data-testid=home-new-app]').click()
      await desktop.page.locator('.dialog').waitFor({ state: 'visible', timeout: 15000 })
      await delay(400)
      await capture(desktop.page, 'ui3b-new-app-dialog-1440.png', '新建应用对话框（1440）')
      metricChecks += 1
      const dialogShell = await measure(desktop.page, '.dialog')
      if (!dialogShell || Math.round(dialogShell.radius) !== 14) {
        failures.push(`新建应用对话框 radius 应为 14（实际 ${dialogShell?.radius}）`)
      }
      const dialogHeadPadding = await desktop.page
        .locator('.dialog .head')
        .evaluate(el => Number.parseFloat(getComputedStyle(el).paddingLeft || '0'))
      if (dialogHeadPadding !== 20) failures.push(`新建应用对话框 header 左内边距应为 20（实际 ${dialogHeadPadding}）`)
      await desktop.page.locator('.dialog [aria-label=关闭]').click()
      await desktop.page.locator('.dialog').waitFor({ state: 'hidden', timeout: 10000 })

      // 模板库（Element Plus 对话框 + 分类 tabs）
      await desktop.page.locator('[data-testid=home-template-library]').click()
      const library = desktop.page.locator('.el-dialog:visible').last()
      await library.waitFor({ state: 'visible', timeout: 15000 })
      await library.locator('.el-dialog__title').waitFor({ state: 'visible', timeout: 10000 })
      await delay(400)
      await capture(desktop.page, 'ui3b-template-library-1440.png', '模板库对话框 · 分类 tabs（1440）')
      metricChecks += 1
      const libraryHead = await library.locator('.el-dialog__header').evaluate(el => ({
        left: Number.parseFloat(getComputedStyle(el).paddingLeft || '0'),
        top: Number.parseFloat(getComputedStyle(el).paddingTop || '0')
      }))
      if (libraryHead.left !== 20 || libraryHead.top !== 18) {
        failures.push(`模板库对话框 header 间距应为 18/20（实际 ${libraryHead.top}/${libraryHead.left}）`)
      }
      await assertTabs(desktop.page, '.el-dialog .rg-tab', '模板库分类')
      await closeElDialog(desktop.page)

      // 设计模板中心（分类 tabs）
      await desktop.page.locator('[data-testid=home-design-templates]').click()
      await desktop.page.locator('[data-testid=design-template-center]').waitFor({ state: 'visible', timeout: 15000 })
      await desktop.page.locator('[data-testid=design-template-category-all]').waitFor({ state: 'visible', timeout: 15000 })
      await delay(400)
      await capture(desktop.page, 'ui3b-design-template-center-1440.png', '设计模板中心 · 分类 tabs（1440）')
      await assertTabs(desktop.page, '.dtc .rg-tab', '模板中心分类')
      await desktop.page.locator('[data-testid=design-template-close]').click()
      await desktop.page.locator('[data-testid=design-template-center]').waitFor({ state: 'hidden', timeout: 10000 })

      // 需求视图（外壳、文档卡、模块卡、对话框、聊天面板）
      await gotoAndWait(desktop.page, `#/apps/${appId}/requirements`, 'requirements-view')
      await desktop.page.locator('[data-testid=module-item-MOD-001]').waitFor({ state: 'visible', timeout: 15000 })
      await delay(300)
      await captureShell(desktop.page, 'ui3b-shell-1440.png', '应用外壳 + 需求工具栏（1440）')
      await capture(desktop.page, 'ui3b-requirements-1440.png', '需求视图 · 文档卡 + 模块卡（1440）')
      await assertDocPanel(desktop.page, '.col-doc .doc', '需求文档面板')
      await assertCard(desktop.page, '[data-testid=module-item-MOD-001]', '需求模块卡')
      await desktop.page.locator('[data-testid=chat-panel]').screenshot({ path: path.join(shotsDir, 'ui3b-chat-panel-1440.png') })
      shots += 1
      console.log('[ui3b-shots] ui3b-chat-panel-1440.png  AI 对话面板（1440）')

      // 新建模块（Element Plus 对话框 + footer）
      await desktop.page.locator('[data-testid=new-module-btn]').click()
      const moduleDialog = desktop.page.locator('.el-dialog:visible').last()
      await moduleDialog.waitFor({ state: 'visible', timeout: 15000 })
      await delay(300)
      await capture(desktop.page, 'ui3b-requirements-dialog-1440.png', '新建模块对话框 · header/footer（1440）')
      metricChecks += 1
      const footer = await moduleDialog.locator('.el-dialog__footer').evaluate(el => ({
        border: getComputedStyle(el).borderTopWidth,
        top: Number.parseFloat(getComputedStyle(el).paddingTop || '0'),
        gap: getComputedStyle(el).gap
      }))
      if (footer.border !== '1px' || footer.top !== 14) {
        failures.push(`el-dialog footer 应为 1px 上边框 + 14 顶内边距（实际 ${footer.border}/${footer.top}）`)
      }
      if (footer.gap !== '8px') failures.push(`el-dialog footer 按钮间距应为 8px（实际 ${footer.gap}）`)
      await closeElDialog(desktop.page)

      // 设计视图（ER / 原型 tabs）
      await gotoAndWait(desktop.page, `#/apps/${appId}/design`, 'design-view')
      await desktop.page.locator('[data-testid=design-module-MOD-001]').waitFor({ state: 'visible', timeout: 15000 })
      await delay(500)
      await capture(desktop.page, 'ui3b-design-er-1440.png', '设计视图 · ER 画布 + 实体表（1440）')
      await assertCard(desktop.page, '.er-canvas', '设计视图 ER 画布卡')
      await assertCard(desktop.page, '.field-panel', '设计视图实体表卡')
      await assertTabs(desktop.page, '[data-testid=design-tab-er]', '设计 ER 图 tab')
      await desktop.page.locator('[data-testid=design-tab-prototype]').click()
      await desktop.page
        .locator('[data-testid=prototype-preview-frame]')
        .waitFor({ state: 'visible', timeout: 20000 })
        .catch(() => failures.push('设计视图原型未出现 iframe 预览'))
      await delay(600)
      await capture(desktop.page, 'ui3b-design-prototype-1440.png', '设计视图 · 原型面板卡（1440）')
      await assertDocPanel(desktop.page, '.proto-panel', '设计原型面板')

      // 开发视图（start card、侧栏分组卡）
      await gotoAndWait(desktop.page, `#/apps/${appId}/development`, 'dev-view')
      await delay(500)
      await capture(desktop.page, 'ui3b-dev-1440.png', '开发视图 · 开始卡 + 侧栏分组（1440）')
      await assertCard(desktop.page, '.start-card', '开发开始卡')
      await assertCard(desktop.page, '.dev-side > section', '开发侧栏分组卡')
    } finally {
      await desktop.close()
    }

    // ---------------- 1024 ----------------
    const tablet = await createPage(browser, 1024, 768)
    try {
      await openHome(tablet.page)
      await captureHomeCards(tablet.page, '首页（1024）')
      await capture(tablet.page, 'ui3b-home-1024.png', '首页 · 卡片（1024）')

      await gotoAndWait(tablet.page, `#/apps/${appId}/requirements`, 'requirements-view')
      await delay(300)
      await capture(tablet.page, 'ui3b-requirements-1024.png', '需求视图（1024）')

      await gotoAndWait(tablet.page, `#/apps/${appId}/design`, 'design-view')
      await tablet.page.locator('[data-testid=design-module-MOD-001]').waitFor({ state: 'visible', timeout: 15000 })
      await capture(tablet.page, 'ui3b-design-1024.png', '设计视图 · ER（1024）')

      await gotoAndWait(tablet.page, `#/apps/${appId}/development`, 'dev-view')
      await delay(500)
      await capture(tablet.page, 'ui3b-dev-1024.png', '开发视图（1024）')
    } finally {
      await tablet.close()
    }

    // ---------------- 390 ----------------
    const mobile = await createPage(browser, 390, 844)
    try {
      await openHome(mobile.page)
      await captureHomeCards(mobile.page, '首页（390）')
      await capture(mobile.page, 'ui3b-home-390.png', '首页 · 卡片（390）')

      // 新建应用（390）
      await mobile.page.locator('[data-testid=home-new-app]').click()
      await mobile.page.locator('.dialog').waitFor({ state: 'visible', timeout: 15000 })
      await delay(400)
      await capture(mobile.page, 'ui3b-new-app-dialog-390.png', '新建应用对话框（390）')
      await mobile.page.locator('.dialog [aria-label=关闭]').click()
      await mobile.page.locator('.dialog').waitFor({ state: 'hidden', timeout: 10000 })

      // 模板库（390）
      await mobile.page.locator('[data-testid=home-template-library]').click()
      const mobileLibrary = mobile.page.locator('.el-dialog:visible').last()
      await mobileLibrary.waitFor({ state: 'visible', timeout: 15000 })
      await delay(400)
      await capture(mobile.page, 'ui3b-template-library-390.png', '模板库对话框 · 分类 tabs（390）')
      await assertTabs(mobile.page, '.el-dialog .rg-tab', '模板库分类（390）')
      await closeElDialog(mobile.page)

      // 设计模板中心（390）
      await mobile.page.locator('[data-testid=home-design-templates]').click()
      await mobile.page.locator('[data-testid=design-template-center]').waitFor({ state: 'visible', timeout: 15000 })
      await delay(400)
      await capture(mobile.page, 'ui3b-design-template-center-390.png', '设计模板中心 · 分类 tabs（390）')
      await assertTabs(mobile.page, '.dtc .rg-tab', '模板中心分类（390）')
      await mobile.page.locator('[data-testid=design-template-close]').click()
      await mobile.page.locator('[data-testid=design-template-center]').waitFor({ state: 'hidden', timeout: 10000 })

      // 需求 + 对话抽屉（390）
      await gotoAndWait(mobile.page, `#/apps/${appId}/requirements`, 'requirements-view')
      await delay(300)
      await capture(mobile.page, 'ui3b-requirements-390.png', '需求视图（390）')
      await mobile.page.locator('[data-testid=chat-toggle]').click()
      await mobile.page.locator('[data-testid=chat-panel]').waitFor({ state: 'visible', timeout: 15000 })
      await delay(300)
      await capture(mobile.page, 'ui3b-chat-panel-390.png', '需求视图 · 对话抽屉（390）')

      // 设计原型（390）
      await gotoAndWait(mobile.page, `#/apps/${appId}/design`, 'design-view')
      await mobile.page.locator('[data-testid=design-module-MOD-001]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => undefined)
      await mobile.page.locator('[data-testid=design-tab-prototype]').click()
      await mobile.page
        .locator('[data-testid=prototype-preview-frame]')
        .waitFor({ state: 'visible', timeout: 20000 })
        .catch(() => failures.push('设计视图原型（390）未出现 iframe 预览'))
      await delay(600)
      await capture(mobile.page, 'ui3b-design-prototype-390.png', '设计视图 · 原型面板（390）')

      // 开发（390）
      await gotoAndWait(mobile.page, `#/apps/${appId}/development`, 'dev-view')
      await delay(400)
      await capture(mobile.page, 'ui3b-dev-390.png', '开发视图（390）')

      // 工作室 narrow tabs（390）
      await gotoAndWait(mobile.page, `#/studio/${packId}`, 'studio-tab-chat')
      await delay(400)
      await capture(mobile.page, 'ui3b-studio-tabs-390.png', '模板工作室 · 页面/对话/预览 tabs（390）')
      await assertTabs(mobile.page, '[data-testid=studio-tab-chat]', '工作室 narrow tab')
      const studioTabCount = await mobile.page.locator('[data-testid=studio-pane-tabs] .rg-tab').count()
      metricChecks += 1
      if (studioTabCount !== 3) failures.push(`工作室 narrow tabs 应为 3（实际 ${studioTabCount}）`)
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
  console.log(
    `\n[ui3b-shots] 完成：${shots} 张截图，${overflowChecks} 次无溢出校验，${metricChecks} 次口径测量；目录 ${shotsDir}`
  )
}

main().catch(error => {
  console.error(`\n[ui3b-shots] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
