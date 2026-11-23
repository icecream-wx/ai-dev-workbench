/**
 * P7-3b 设计模板中心 Playwright 验收（临时端口 + 临时数据目录，不占用 3300）。
 *
 * 前置：`npm run build --prefix frontend`、`npm run build --prefix backend`。
 * 运行：`npm run e2e:p7-3b --prefix backend`
 *
 * 覆盖：
 * 1. 首页「模板库」（需求模板中心）保持不变；新增「设计模板」入口
 * 2. 设计模板中心：4 应用类型卡片 / 搜索 / 分类 / 自定义“即将支持”
 * 3. 企业级详情：4 风格切换 + 页面集 + iframe 加载 organization / audit
 * 4. 新建应用：需求模板 select 仍在；picker 选择运营 + 经典暖色；创建透传设计字段
 * 5. 设计视图：新应用徽标（类型 · 风格）+「模板页面库」；旧应用仍显示旧原型模板
 * 6. 全程 0 console error / 0 pageerror / 0 请求失败（忽略导航 abort）/ 0 外部请求
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const frontendDist = path.resolve(backendDir, '../frontend/dist')
const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p7-3b-e2e-'))
const shotsDir =
  process.env.P7_3B_SHOTS_DIR || 'C:\\Users\\icecream\\AppData\\Local\\Temp\\opencode'

fs.mkdirSync(shotsDir, { recursive: true })

const APPLICATION_TYPES = [
  'enterprise-application-platform',
  'operations-management',
  'data-governance-workbench',
  'incident-response-console'
]
const STYLES = ['platform-blue', 'classic-warm', 'data-cyan', 'high-contrast-tool']

let assertions = 0
let server: ChildProcess | null = null
let browser: Browser | null = null

function check(condition: unknown, message: string): void {
  assertions += 1
  if (!condition) throw new Error(`断言失败：${message}`)
}

function checkEqual<T>(actual: T, expected: T, message: string): void {
  assertions += 1
  if (actual !== expected) {
    throw new Error(`断言失败：${message}（期望 ${String(expected)}，实际 ${String(actual)}）`)
  }
}

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

async function freePort(start: number): Promise<number> {
  for (let port = start; port < start + 40; port += 1) {
    const available = await new Promise<boolean>(resolve => {
      const probe = net.createServer()
      probe.once('error', () => resolve(false))
      probe.once('listening', () => probe.close(() => resolve(true)))
      probe.listen(port, '127.0.0.1')
    })
    if (available) return port
  }
  throw new Error('找不到可用端口')
}

function stopServer(): void {
  if (!server?.pid) return
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore'
      })
    } else {
      server.kill('SIGTERM')
    }
  } catch {
    // 已退出
  }
}

async function waitForHealth(base: string): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const resp = await fetch(`${base}/api/health`)
      if (resp.ok) return
    } catch {
      // 还没起来
    }
    await delay(100)
  }
  throw new Error('后端未在 12s 内就绪')
}

async function waitForText(
  locator: Locator,
  expected: string,
  label: string,
  timeoutMs = 15000
): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const text = (await locator.first().textContent().catch(() => ''))?.trim() || ''
    if (text.includes(expected)) return text
    await delay(150)
  }
  throw new Error(`等待超时（${timeoutMs}ms）：${label} 未包含“${expected}”`)
}

async function waitForIframeHeading(
  frame: ReturnType<Page['frameLocator']>,
  expected: string,
  label: string,
  timeoutMs = 20000,
  selector = 'h1'
): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const text = (await frame.locator(selector).first().textContent().catch(() => ''))?.trim() || ''
    if (text.includes(expected)) return text
    await delay(200)
  }
  throw new Error(`等待超时（${timeoutMs}ms）：${label} iframe 标题未包含“${expected}”`)
}

interface PageAudit {
  consoleErrors: string[]
  pageErrors: string[]
  failedRequests: string[]
  externalRequests: string[]
}

function auditPage(page: Page): PageAudit {
  const audit: PageAudit = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    externalRequests: []
  }
  page.on('console', msg => {
    if (msg.type() === 'error') audit.consoleErrors.push(msg.text())
  })
  page.on('pageerror', error => audit.pageErrors.push(error.message))
  page.on('requestfailed', request => {
    const failure = request.failure()?.errorText || ''
    // 切换风格/页面时 iframe 重载会 abort 上一轮资源，不算失败
    if (failure.includes('ERR_ABORTED')) return
    audit.failedRequests.push(`${request.url()} ${failure}`)
  })
  page.on('request', request => {
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      audit.externalRequests.push(request.url())
    }
  })
  return audit
}

function checkAudit(audit: PageAudit, label: string): void {
  checkEqual(audit.consoleErrors.length, 0, `${label} console error 为 0${audit.consoleErrors[0] ? `（${audit.consoleErrors[0]}）` : ''}`)
  checkEqual(audit.pageErrors.length, 0, `${label} pageerror 为 0`)
  checkEqual(audit.failedRequests.length, 0, `${label} 请求失败为 0`)
  checkEqual(audit.externalRequests.length, 0, `${label} 外部请求为 0`)
}

async function request(
  base: string,
  method: string,
  apiPath: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
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

async function main(): Promise<void> {
  check(fs.existsSync(path.join(frontendDist, 'preview.html')), 'frontend/dist/preview.html 已构建')
  check(fs.existsSync(path.join(frontendDist, 'index.html')), 'frontend/dist/index.html 已构建')
  check(fs.existsSync(path.join(backendDir, 'dist/index.js')), 'backend/dist/index.js 已构建')

  const port = await freePort(3431)
  const opencodePort = await freePort(4815)
  const base = `http://127.0.0.1:${port}`

  server = spawn('node', ['dist/index.js'], {
    cwd: backendDir,
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(port),
      RG_DATA_DIR: path.join(runtimeRoot, 'data'),
      RG_PROJECTS_DIR: path.join(runtimeRoot, 'projects'),
      OPENCODE_AUTO_START: 'false',
      OPENCODE_PORT: String(opencodePort)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  server.stdout?.resume()
  server.stderr?.resume()

  await waitForHealth(base)

  browser = await chromium.launch()
  const context: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()
  const audit = auditPage(page)

  // ---- 1. 首页入口；需求模板中心不变 ----
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('h1'), '从一个应用开始', '首页标题')
  checkEqual(await page.getByTestId('home-template-library').count(), 1, '首页保留「模板库」入口')
  checkEqual(await page.getByTestId('home-design-templates').count(), 1, '首页新增「设计模板」入口')

  await page.getByTestId('home-template-library').click()
  const requirementDialog = page.locator('.el-dialog:visible').last()
  await requirementDialog.waitFor({ state: 'visible', timeout: 8000 })
  const requirementTitle = (await requirementDialog.locator('.el-dialog__title').innerText()).trim()
  check(requirementTitle.includes('模板库'), `需求模板中心仍是「模板库」（实际：${requirementTitle}）`)
  await requirementDialog.locator('.el-dialog__headerbtn').click()
  await requirementDialog.waitFor({ state: 'hidden', timeout: 8000 })

  // ---- 2. 设计模板中心列表 ----
  await page.getByTestId('home-design-templates').click()
  const center = page.getByTestId('design-template-center')
  await center.waitFor({ state: 'visible', timeout: 8000 })
  await waitForText(center.locator('h2'), '设计模板中心', '设计模板中心标题')
  await center
    .getByTestId('design-template-card-enterprise-application-platform')
    .waitFor({ state: 'visible', timeout: 15000 })

  for (const typeId of APPLICATION_TYPES) {
    checkEqual(await center.getByTestId(`design-template-card-${typeId}`).count(), 1, `应用类型卡片存在：${typeId}`)
  }
  checkEqual(await center.locator('[data-testid^="design-template-card-"]').count(), 4, '应用类型卡片共 4 个')
  const customCard = center.getByTestId('design-template-custom-card')
  const customText = (await customCard.innerText()).trim()
  check(customText.includes('自定义模板') && customText.includes('进入'), '自定义模板卡片已启用并显示入口')
  checkEqual(await customCard.isDisabled(), false, '自定义模板卡片不再禁用')
  checkEqual(await center.locator('[data-testid^="design-template-category-"]').count(), 6, '分类 tabs：全部 + 4 类 + 自定义')

  // 自定义分类：空态 + 新建入口（P7-7b-2b）
  await customCard.click()
  await waitForText(center.getByTestId('design-template-custom-empty'), '还没有自定义模板', '自定义模板空态')
  checkEqual(await center.getByTestId('design-template-custom-new').count(), 1, '自定义空态提供「新建自定义模板」')
  await center.getByTestId('design-template-category-all').click()
  await center.getByTestId('design-template-card-enterprise-application-platform').waitFor({ state: 'visible', timeout: 8000 })

  await center.getByTestId('design-template-search').fill('运营')
  checkEqual(await center.locator('[data-testid^="design-template-card-"]').count(), 1, '搜索“运营”命中运营管理类型')
  checkEqual(await center.getByTestId('design-template-card-operations-management').count(), 1, '搜索结果包含运营管理卡片')
  await center.getByTestId('design-template-search').fill('')
  await page.screenshot({ path: path.join(shotsDir, 'p7-3b-gallery.png') })

  // ---- 3. 企业级：4 风格 + 页面集 + iframe ----
  await center.getByTestId('design-template-card-enterprise-application-platform').click()
  await waitForText(center.locator('.detail-side h3'), '企业级应用管理平台', '企业级详情')
  for (const styleId of STYLES) {
    checkEqual(await center.getByTestId(`design-template-style-${styleId}`).count(), 1, `风格按钮存在：${styleId}`)
  }
  checkEqual(await center.locator('[data-testid^="design-template-page-"]').count(), 5, '企业级页面集 5 张卡片')

  await center.getByTestId('design-template-page-organization').click()
  const frame = center.frameLocator('[data-testid="design-template-preview-frame"]')
  await waitForIframeHeading(frame, '组织与用户', 'organization 预览')
  const iframeSrc = await center.getByTestId('design-template-preview-frame').getAttribute('src')
  check(
    Boolean(
      iframeSrc?.includes('type=enterprise-application-platform') &&
        iframeSrc?.includes('style=platform-blue') &&
        iframeSrc?.includes('page=organization')
    ),
    `iframe 使用 organization 预览 URL（实际：${iframeSrc}）`
  )
  // F1（打磨批1）：内置模板预览也走 embed=1，隐藏预览自带风格切换器/角标（工作台自己的切换保留）
  check(Boolean(iframeSrc?.includes('embed=1')), `内置预览 iframe 带 embed=1（实际：${iframeSrc}）`)
  checkEqual(
    await frame.locator('.preview-style-switch').count(),
    0,
    '内置预览 iframe 不渲染预览自带风格切换器'
  )
  checkEqual(await frame.locator('.preview-badge').count(), 0, '内置预览 iframe 不渲染 mock 角标')
  await page.screenshot({ path: path.join(shotsDir, 'p7-3b-enterprise-detail.png') })

  // 切换风格 → iframe 重载，页面仍为 organization
  await center.getByTestId('design-template-style-classic-warm').click()
  await delay(400)
  await waitForIframeHeading(frame, '组织与用户', 'classic-warm 预览')
  const styledSrc = await center.getByTestId('design-template-preview-frame').getAttribute('src')
  check(Boolean(styledSrc?.includes('style=classic-warm')), `切换风格后 iframe URL 为 classic-warm（实际：${styledSrc}）`)
  const styleClassCount = await frame.locator('.visual-style-classic-warm').count()
  check(styleClassCount > 0, '预览根节点应用 classic-warm 风格类')

  // 切换页面 → iframe 加载 audit
  await center.getByTestId('design-template-page-audit').click()
  await waitForIframeHeading(frame, '审计日志', 'audit 预览')
  const auditSrc = await center.getByTestId('design-template-preview-frame').getAttribute('src')
  check(Boolean(auditSrc?.includes('page=audit')), `切换页面后 iframe URL 为 audit（实际：${auditSrc}）`)
  await page.screenshot({ path: path.join(shotsDir, 'p7-3b-enterprise-audit.png') })

  await center.getByTestId('design-template-close').click()
  await center.waitFor({ state: 'hidden', timeout: 8000 })

  // ---- 4. 新建应用：需求模板保留 + picker 选择 ----
  await page.getByRole('button', { name: '新建应用' }).first().click()
  const newAppDialog = page.locator('.dialog[role="dialog"]').last()
  await newAppDialog.waitFor({ state: 'visible', timeout: 8000 })
  const requirementField = newAppDialog.locator('label.field').filter({ hasText: '需求模板' }).first()
  checkEqual(await requirementField.locator('select').count(), 1, '新建应用仍保留「需求模板」下拉')
  checkEqual(await newAppDialog.getByTestId('new-app-legacy-templates').count(), 0, '不再有「旧版兼容」入口')
  await waitForText(newAppDialog.getByTestId('new-app-design-summary'), '企业级应用管理平台', '新建应用默认设计模板')

  await newAppDialog.getByTestId('new-app-design-picker').click()
  const picker = page.getByTestId('design-template-center')
  await picker.waitFor({ state: 'visible', timeout: 8000 })
  await waitForText(picker.locator('h2'), '选择设计模板', 'picker 标题')
  // 带选择打开时定位到当前应用类型详情
  await waitForText(picker.locator('.detail-side h3'), '企业级应用管理平台', 'picker 定位当前类型')
  await picker.getByTestId('design-template-back').click()
  const operationsCard = picker.getByTestId('design-template-card-operations-management')
  await operationsCard.waitFor({ state: 'visible', timeout: 8000 })
  await operationsCard.click()
  await waitForText(picker.locator('.detail-side h3'), '运营管理后台', 'picker 切换到运营')
  await picker.getByTestId('design-template-style-classic-warm').click()
  await waitForIframeHeading(
    picker.frameLocator('[data-testid="design-template-preview-frame"]'),
    '岗位台账',
    'picker 预览',
    20000,
    'h2'
  )
  await page.screenshot({ path: path.join(shotsDir, 'p7-3b-picker.png') })
  await picker.getByTestId('design-template-use').click()
  await picker.waitFor({ state: 'hidden', timeout: 8000 })
  await waitForText(newAppDialog.getByTestId('new-app-design-summary'), '运营管理后台 · 经典暖色', 'picker 回填摘要')

  await newAppDialog.getByPlaceholder('leave-demo').fill('p73b-new')
  await newAppDialog.getByPlaceholder('请假管理').fill('P7-3B 新应用')
  await page.screenshot({ path: path.join(shotsDir, 'p7-3b-new-app-form.png') })
  await newAppDialog.getByRole('button', { name: '创建应用' }).click()

  await page.waitForURL(/#\/apps\/p73b-new\/requirements/, { timeout: 30000 })
  const created = await request(base, 'GET', '/apps/p73b-new/design-system')
  checkEqual(created.status, 200, '新应用设计系统可读取')
  checkEqual(created.data?.resolved?.applicationType, 'operations-management', '创建应用透传 designApplicationType')
  checkEqual(created.data?.resolved?.style, 'classic-warm', '创建应用透传 designStyle')
  checkEqual(created.data?.resolved?.pack, 'afcenter-app-templates-v1', '创建应用透传 designPack')

  // ---- 5. 首页应用摘要显示设计系统 ----
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  const homeSummary = page.getByTestId('home-app-templates').first()
  await waitForText(homeSummary, '设计模板：运营管理后台 · 经典暖色', '首页应用摘要')
  await page.screenshot({ path: path.join(shotsDir, 'p7-3b-home-app-summary.png') })

  // ---- 6. 设计视图徽标 / 模板页面库 ----
  await page.goto(`${base}/#/apps/p73b-new/design`, { waitUntil: 'networkidle' })
  await page.getByTestId('design-view').waitFor({ state: 'visible', timeout: 15000 })
  const badge = page.getByTestId('design-template-badge')
  await badge.waitFor({ state: 'visible', timeout: 15000 })
  const badgeText = (await badge.innerText()).trim()
  check(badgeText.includes('运营管理后台') && badgeText.includes('经典暖色'), `新应用徽标为“类型 · 风格”（实际：${badgeText}）`)
  checkEqual(await page.getByTestId('design-template-library').count(), 1, '设计视图提供「模板页面库」入口')
  await page.screenshot({ path: path.join(shotsDir, 'p7-3b-design-view.png') })

  await badge.click()
  const located = page.getByTestId('design-template-center')
  await located.waitFor({ state: 'visible', timeout: 8000 })
  await waitForText(located.locator('.detail-side h3'), '运营管理后台', '设计视图定位当前类型')
  checkEqual(
    await located.getByTestId('design-template-style-classic-warm').evaluate(el => el.classList.contains('on')),
    true,
    '模板页面库定位当前风格'
  )
  await located.getByTestId('design-template-close').click()
  await located.waitFor({ state: 'hidden', timeout: 8000 })

  // ---- 7. 移动端（390×844）：模板中心/picker 无整页横向溢出、关键按钮可点 ----
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mobilePage = await mobileContext.newPage()
  const mobileAudit = auditPage(mobilePage)
  const noPageOverflow = async (): Promise<boolean> =>
    mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

  await mobilePage.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
  await mobilePage.getByTestId('home-design-templates').click()
  const mobileCenter = mobilePage.getByTestId('design-template-center')
  await mobileCenter.waitFor({ state: 'visible', timeout: 10000 })
  await mobileCenter.getByTestId('design-template-card-enterprise-application-platform').waitFor({ state: 'visible', timeout: 20000 })
  checkEqual(await noPageOverflow(), false, '390×844 模板中心无整页横向溢出')
  const mobileCenterHead = await mobileCenter
    .locator('.dtc-head .head-title')
    .evaluate(el => Math.round(el.getBoundingClientRect().width))
  check(mobileCenterHead > 200, `390×844 模板中心标题列宽 > 200（实际 ${mobileCenterHead}）`)
  const mobileCloseBox = await mobileCenter.getByTestId('design-template-close').boundingBox()
  check(Boolean(mobileCloseBox && mobileCloseBox.x >= 0 && mobileCloseBox.y >= 0 && mobileCloseBox.x + mobileCloseBox.width <= 390), '390×844 模板中心关闭按钮在视口内可点')
  check(await mobileCenter.getByTestId('design-template-search').isVisible(), '390×844 模板中心搜索框可见')

  await mobileCenter.getByTestId('design-template-close').click()
  await mobileCenter.waitFor({ state: 'hidden', timeout: 8000 })
  await mobilePage.getByRole('button', { name: '新建应用' }).first().click()
  const mobileNewApp = mobilePage.locator('.dialog[role="dialog"]').last()
  await mobileNewApp.waitFor({ state: 'visible', timeout: 10000 })
  checkEqual(await noPageOverflow(), false, '390×844 新建应用对话框无整页横向溢出')
  await mobileNewApp.getByTestId('new-app-design-picker').click()
  const mobilePicker = mobilePage.getByTestId('design-template-center')
  await mobilePicker.waitFor({ state: 'visible', timeout: 10000 })
  await waitForText(mobilePicker.locator('.detail-side h3'), '企业级应用管理平台', '390×844 picker 定位当前类型')
  checkEqual(await noPageOverflow(), false, '390×844 picker 无整页横向溢出')
  const mobilePickerHead = await mobilePicker
    .locator('.dtc-head .head-title')
    .evaluate(el => Math.round(el.getBoundingClientRect().width))
  check(mobilePickerHead > 200, `390×844 picker 标题列宽 > 200（实际 ${mobilePickerHead}）`)
  const mobileUse = mobilePicker.getByTestId('design-template-use')
  const mobileUseBox = await mobileUse.boundingBox()
  check(
    Boolean(mobileUseBox && mobileUseBox.x >= 0 && mobileUseBox.y >= 0 && mobileUseBox.x + mobileUseBox.width <= 390 && mobileUseBox.y + mobileUseBox.height <= 844),
    '390×844 picker「使用此模板」在视口内'
  )
  checkEqual(await mobileUse.isEnabled(), true, '390×844 picker「使用此模板」可点')
  await mobilePage.screenshot({ path: path.join(shotsDir, 'p7-3b-mobile-picker.png') })
  await mobilePicker.getByTestId('design-template-close').click()
  await mobilePicker.waitFor({ state: 'hidden', timeout: 8000 })
  await mobileNewApp.getByRole('button', { name: '取消' }).click()
  await mobileNewApp.waitFor({ state: 'hidden', timeout: 8000 })
  await mobileContext.close()
  checkAudit(mobileAudit, 'P7-3B 移动端 390×844')

  checkAudit(audit, 'P7-3B 设计模板中心流程')

  console.log(`\n[p7-3b-e2e] 通过：${assertions} 条断言`)
  console.log(`[p7-3b-e2e] 截图目录：${shotsDir}`)
  console.log(`[p7-3b-e2e] 临时数据：${runtimeRoot}`)
}

main()
  .catch(error => {
    console.error(`\n[p7-3b-e2e] 失败：${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await browser?.close()
    } catch {
      // ignore
    }
    stopServer()
    try {
      fs.rmSync(runtimeRoot, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })
