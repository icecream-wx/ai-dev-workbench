/**
 * P7-7b-2b 模板中心自定义入口 + 模板工作室全链路 Playwright 验收（P7-7b）。
 *
 * 前置：`npm run build --prefix frontend`（harness 托管 frontend/dist）。
 * 运行：`npm run e2e:p7-7b --prefix backend`
 *
 * 覆盖：
 * 1. 首页 → 设计模板中心 → 自定义分类 → 新建对话框（名称/风格/base 应用类型）→ 创建草稿 → `#/studio/<packId>`；
 * 2. 工作室加载（stub opencode，无真实模型）：左页面/校验/首条提示；右侧空预览；
 * 3. 临时草稿目录写 reference + contract 的 spec.json → “生成预览” → 页面/校验/CSS 摘要；
 * 4. reference 预览 iframe（源页 + structureDraft）与 contract 预览（ContractPage dialog-form）；
 * 5. 发布 v1.0.0 → 返回模板中心看到已发布自定义模板；编辑入口可再次进入工作室；
 * 6. picker 列出已发布自定义 pack（草稿不列），内置 picker 行为不变；
 * 7. 删除保护：应用引用时 409 展示应用列表；解除引用后删除成功；
 * 8. 全程 0 console error / pageerror / 请求失败（忽略 iframe 重载 abort）/ 外部请求。
 *
 * 端口/目录：默认 **3429/4429** 起步（自动找空闲端口），数据落在 `%TEMP%/workbench-p7-7b-e2e-*`；
 * 不占用真实 3300/4771，不读写真实 data/projects/.env，不调模型。
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type FrameLocator, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const frontendDist = path.resolve(backendDir, '../frontend/dist')
const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p7-7b-e2e-'))
const stateFile = path.join(runtimeRoot, 'harness-state.json')
const shotsDir = process.env.P7_7B_SHOTS_DIR || path.join(os.tmpdir(), 'workbench-p77b2b-shots')
const appId = 'p77b-app'
const appName = 'P7-7B 引用应用'

fs.mkdirSync(shotsDir, { recursive: true })

let assertions = 0
let harness: ChildProcess | null = null
let browser: Browser | null = null

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

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

async function waitFor(checkFn: () => boolean | Promise<boolean>, timeoutMs: number, label: string): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await checkFn()) return
    await delay(80)
  }
  throw new Error(`等待超时（${timeoutMs}ms）：${label}`)
}

async function waitForText(
  locator: ReturnType<Page['locator']>,
  expected: string,
  label: string,
  timeoutMs = 20000
): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const text = (await locator.first().textContent().catch(() => ''))?.trim() || ''
    if (text.includes(expected)) return text
    await delay(150)
  }
  throw new Error(`等待超时（${timeoutMs}ms）：${label} 未包含“${expected}”`)
}

async function waitForFrameHeading(
  frame: FrameLocator,
  expected: string,
  label: string,
  timeoutMs = 25000
): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const text = (await frame.locator('h1').first().textContent().catch(() => ''))?.trim() || ''
    if (text.includes(expected)) return
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
  const audit: PageAudit = { consoleErrors: [], pageErrors: [], failedRequests: [], externalRequests: [] }
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (/favicon/i.test(text)) return
    // 删除保护的 409 是断言目标：浏览器会把非 2xx 资源记为 console error，这里只忽略这一条预期日志
    if (/Failed to load resource: the server responded with a status of 409 \(Conflict\)/.test(text)) return
    audit.consoleErrors.push(text)
  })
  page.on('pageerror', error => audit.pageErrors.push(error.message))
  page.on('requestfailed', request => {
    const failure = request.failure()?.errorText || ''
    if (failure.includes('ERR_ABORTED')) return
    audit.failedRequests.push(`${request.url()} ${failure}`)
  })
  page.on('request', request => {
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) audit.externalRequests.push(request.url())
  })
  page.on('response', response => {
    if (process.env.P7_7B_DEBUG && response.status() >= 400) {
      console.log('[http]', response.status(), response.url())
    }
  })
  return audit
}

function checkAudit(audit: PageAudit, label: string): void {
  checkEqual(
    audit.consoleErrors.length,
    0,
    `${label} 非预期 console error 为 0（已忽略预期 409 网络日志）${audit.consoleErrors[0] ? `（${audit.consoleErrors[0]}）` : ''}`
  )
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

function startHarness(port: number): void {
  harness = spawn('npx', ['tsx', 'scripts/p2-e2e-harness.ts'], {
    cwd: backendDir,
    shell: true,
    windowsHide: true,
    env: {
      ...process.env,
      P2_ROOT: runtimeRoot,
      P2_STATE_FILE: stateFile,
      P2_PORT: String(port),
      P2_APP_ID: appId,
      P2_APP_NAME: appName
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  harness.stdout?.on('data', chunk => process.stdout.write(`[harness] ${chunk}`))
  harness.stderr?.on('data', chunk => process.stderr.write(`[harness] ${chunk}`))
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

/** 测试 fixture：reference + contract（不经真实 agent） */
function fixtureSpec(packId: string): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: packId,
    name: '供应商管理模板 e2e',
    description: '供应商台账（引用运营列表）+ 弹窗表单（契约）',
    baseApplicationType: 'enterprise-application-platform',
    style: 'data-cyan',
    pages: [
      {
        id: 'supplier-list',
        name: '供应商列表',
        kind: 'reference',
        source: {
          pack: 'afcenter-app-templates-v1',
          applicationType: 'operations-management',
          pageId: 'list'
        }
      },
      {
        id: 'supplier-form',
        name: '供应商表单',
        kind: 'contract',
        type: 'form',
        recipe: 'dialog-form',
        contract: {
          form: {
            presentation: 'dialog',
            columns: 2,
            width: 900,
            groups: [{ title: '基本信息', fields: ['code', 'name', 'status'] }]
          },
          components: { owner: 'pm-select-user' }
        },
        sampleEntity: {
          id: 'supplier',
          name: '供应商',
          fields: [
            { name: 'code', label: '供应商编码', type: 'string' },
            { name: 'name', label: '供应商名称', type: 'string' },
            { name: 'status', label: '状态', type: 'enum', options: ['启用', '停用', '草稿'] },
            { name: 'owner', label: '负责人', type: 'string' }
          ]
        }
      }
    ]
  }
}

async function main(): Promise<void> {
  check(fs.existsSync(path.join(frontendDist, 'index.html')), 'frontend/dist/index.html 已构建')
  check(fs.existsSync(path.join(frontendDist, 'preview.html')), 'frontend/dist/preview.html 已构建')
  check(fs.existsSync(path.join(frontendDist, 'template-preview.html')), 'frontend/dist/template-preview.html 已构建')

  const port = await freePort(3429)
  const base = `http://127.0.0.1:${port}`

  startHarness(port)
  await waitFor(
    () => fs.existsSync(stateFile) && fs.readFileSync(stateFile, 'utf8').includes('"ready": true'),
    60000,
    'harness 就绪'
  )
  await waitFor(async () => {
    try {
      return (await fetch(`${base}/api/health`)).ok
    } catch {
      return false
    }
  }, 60000, 'harness /api/health')

  browser = await chromium.launch()
  const context: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()
  const audit = auditPage(page)

  // ---------- 1. 模板中心 → 新建自定义模板 ----------
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('h1'), '从一个应用开始', '首页标题')
  await page.getByTestId('home-design-templates').click()
  const center = page.getByTestId('design-template-center')
  await center.waitFor({ state: 'visible', timeout: 10000 })
  await center.getByTestId('design-template-custom-card').waitFor({ state: 'visible', timeout: 20000 })
  await center.getByTestId('design-template-custom-card').click()
  await waitForText(center.getByTestId('design-template-custom-empty'), '还没有自定义模板', '自定义空态')
  await page.screenshot({ path: path.join(shotsDir, 'p7-7b2b-center-empty.png') })

  await center.getByTestId('design-template-custom-new').click()
  const dialog = page.getByTestId('new-design-template-dialog')
  await dialog.waitFor({ state: 'visible', timeout: 8000 })
  checkEqual(await dialog.getByTestId(/^new-template-style-/).count(), 4, '新建对话框列出 4 套内置风格')
  checkEqual(await dialog.getByTestId('new-template-base-type').locator('option').count(), 4, '基础应用类型 4 个')
  await dialog.getByTestId('new-template-name').fill('供应商管理模板 e2e')
  await dialog.getByTestId('new-template-style-data-cyan').click()
  await dialog.getByTestId('new-template-base-type').selectOption('operations-management')
  await page.screenshot({ path: path.join(shotsDir, 'p7-7b2b-new-dialog.png') })
  await dialog.getByTestId('new-template-submit').click()

  await page.waitForURL(/#\/studio\/[a-z0-9-]+/, { timeout: 30000 })
  const packId = /#\/studio\/([a-z0-9-]+)/.exec(page.url())?.[1] || ''
  check(Boolean(packId), '创建草稿后跳转 #/studio/<packId>')
  const created = await request(base, 'GET', `/design-templates/drafts/${encodeURIComponent(packId)}`)
  checkEqual(created.status, 200, '新建草稿可读取')
  checkEqual(created.data?.draft?.style, 'data-cyan', '新建草稿记录所选风格')
  checkEqual(created.data?.draft?.baseApplicationType, 'operations-management', '新建草稿记录 base 应用类型')
  checkEqual(created.data?.draft?.status, 'draft', '新建草稿状态为 draft')

  // ---------- 2. 工作室加载（stub；无 pack） ----------
  await page.getByTestId('studio-view').waitFor({ state: 'visible', timeout: 20000 })
  await waitForText(page.getByTestId('studio-preview-empty'), '尚未生成预览', '工作室空预览')
  checkEqual(await page.locator('[data-testid="studio-page-item"]').count(), 0, '未写 spec 时页面清单为空')
  // 桌面 >1180：三栏同时可见，移动面板 tab 不出现（移动/窄屏布局不影响桌面）
  checkEqual(await page.getByTestId('studio-pane-tabs').isVisible(), false, '桌面 >1180 不显示移动面板 tab')
  check(
    (await page.locator('.studio-left').isVisible()) &&
      (await page.locator('.studio-chat').isVisible()) &&
      (await page.locator('.studio-preview').isVisible()),
    '桌面 >1180 三栏（页面/对话/预览）同时可见'
  )
  await waitForText(page.locator('.hint-block .prompt-preview'), '当前模板/草稿', '工作室首条提示')
  const validationText = (await page.getByTestId('studio-validation').innerText()).trim()
  check(validationText.includes('页面数'), '空 pages 的 spec 在工作室显示 page-count 校验错误')
  await page.screenshot({ path: path.join(shotsDir, 'p7-7b2b-studio-empty.png') })

  // ---------- 3. 测试夹具 spec → 生成预览 ----------
  const specFile = path.join(runtimeRoot, 'data', 'design-system', '_workshop', 'drafts', packId, 'spec.json')
  fs.writeFileSync(specFile, `${JSON.stringify(fixtureSpec(packId), null, 2)}\n`, 'utf8')
  await page.getByTestId('studio-generate').click()
  await waitFor(async () => (await page.locator('[data-testid="studio-page-item"]').count()) === 2, 40000, '生成后页面清单 2 页')
  const pageNames = await page.locator('[data-testid="studio-page-item"] .page-name').allInnerTexts()
  check(pageNames.join(' ').includes('供应商列表') && pageNames.join(' ').includes('供应商表单'), '页面清单显示 reference + contract')
  const footText = (await page.locator('.foot-summary').innerText()).trim()
  check(footText.includes('规则') && footText.includes('CSS 来源'), `生成后显示 CSS 摘要（实际：${footText}）`)
  const pageSelect = page.getByTestId('studio-preview-page')
  checkEqual(await pageSelect.locator('option').count(), 2, '预览页面下拉 2 项')
  await page.screenshot({ path: path.join(shotsDir, 'p7-7b2b-studio-generated.png') })

  // ---------- 4. reference / contract 预览 ----------
  const studioPreview = page.frameLocator('[data-testid="studio-preview-frame"]')
  await waitForFrameHeading(
    studioPreview.frameLocator('[data-testid="template-preview-frame"]'),
    '通知公告管理',
    'reference 预览'
  )
  const referenceSrc = await page.getByTestId('studio-preview-frame').getAttribute('src')
  check(
    Boolean(referenceSrc?.includes(`draft=${packId}`) && referenceSrc?.includes('page=supplier-list') && referenceSrc?.includes('embed=1')),
    `reference 预览 iframe 使用草稿 + 页面（实际：${referenceSrc}）`
  )
  const nestedSrc = (await studioPreview.getByTestId('template-preview-frame').getAttribute('src')) || ''
  check(
    Boolean(
      nestedSrc.includes('type=operations-management') &&
        nestedSrc.includes('page=list') &&
        nestedSrc.includes(`structureDraft=${packId}`)
    ),
    `reference 预览走 preview.html 且覆盖草稿 structure（实际：${nestedSrc}）`
  )

  await pageSelect.selectOption('supplier-form')
  await studioPreview.getByTestId('contract-page-dialog-form').waitFor({ state: 'visible', timeout: 30000 })
  checkEqual(await studioPreview.getByTestId('contract-dialog-backdrop').count(), 1, 'contract dialog-form 渲染背景列表')
  const styleSize = await studioPreview
    .locator('#template-preview-structure-css')
    .evaluate(el => (el.textContent || '').length)
    .catch(() => 0)
  check(styleSize > 100, `contract 预览注入合并 structure.css（长度 ${styleSize}）`)
  const contractRoot = studioPreview.locator('[data-kind="contract"]').first()
  checkEqual(await contractRoot.getAttribute('data-style'), 'data-cyan', 'contract 预览使用 data-cyan 风格')
  checkEqual(await contractRoot.getByTestId('template-preview-error').count(), 0, 'contract 预览无错误态')
  await page.screenshot({ path: path.join(shotsDir, 'p7-7b2b-studio-contract.png') })

  // ---------- 4b. 移动端（390×844）：工作室 页面/对话/预览 三块可达 + template-preview 外壳 ----------
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mobilePage = await mobileContext.newPage()
  const mobileAudit = auditPage(mobilePage)
  await mobilePage.goto(`${base}/#/studio/${encodeURIComponent(packId)}`, { waitUntil: 'domcontentloaded' })
  await mobilePage.getByTestId('studio-view').waitFor({ state: 'visible', timeout: 20000 })
  await mobilePage.getByTestId('studio-tab-chat').waitFor({ state: 'visible', timeout: 15000 })
  await waitFor(
    async () => (await mobilePage.locator('[data-testid="studio-page-item"]').count()) === 2,
    20000,
    '390×844 工作室页面清单 2 页'
  )
  checkEqual(
    await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
    false,
    '390×844 工作室无整页横向溢出'
  )
  // 默认对话；三个 tab 都在视口内可点
  check(await mobilePage.getByTestId('studio-pane-chat').isVisible(), '390×844 默认显示对话面板')
  checkEqual(await mobilePage.getByTestId('studio-pane-pages').isVisible(), false, '390×844 页面面板默认隐藏')
  checkEqual(await mobilePage.getByTestId('studio-pane-preview').isVisible(), false, '390×844 预览面板默认隐藏')
  for (const tab of ['studio-tab-pages', 'studio-tab-chat', 'studio-tab-preview']) {
    const box = await mobilePage.getByTestId(tab).boundingBox()
    check(
      Boolean(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844),
      `390×844 ${tab} 在视口内可点`
    )
  }
  // 页面 tab：页面清单可达，对话隐藏
  await mobilePage.getByTestId('studio-tab-pages').click()
  await mobilePage.getByTestId('studio-pane-pages').waitFor({ state: 'visible', timeout: 5000 })
  checkEqual(await mobilePage.getByTestId('studio-pane-chat').isVisible(), false, '390×844 页面 tab 切换后对话隐藏')
  checkEqual(
    await mobilePage.locator('[data-testid="studio-page-item"]').count(),
    2,
    '390×844 页面 tab 显示 2 页清单'
  )
  // 预览 tab：iframe 可达且无横向溢出
  await mobilePage.getByTestId('studio-tab-preview').click()
  await mobilePage.getByTestId('studio-preview-frame').waitFor({ state: 'visible', timeout: 15000 })
  checkEqual(await mobilePage.getByTestId('studio-pane-pages').isVisible(), false, '390×844 预览 tab 切换后页面隐藏')
  const mobileSelect = await mobilePage.getByTestId('studio-preview-page').boundingBox()
  check(Boolean(mobileSelect && mobileSelect.y >= 0 && mobileSelect.y + mobileSelect.height <= 844), '390×844 预览页下拉在视口内')
  const mobileStudioFrame = mobilePage.frameLocator('[data-testid="studio-preview-frame"]')
  await waitForFrameHeading(
    mobileStudioFrame.frameLocator('[data-testid="template-preview-frame"]'),
    '通知公告管理',
    '390×844 reference 预览'
  )
  checkEqual(
    await mobileStudioFrame.locator('html').first().evaluate(el => el.scrollWidth > el.clientWidth + 1),
    false,
    '390×844 工作室预览 iframe 无横向溢出'
  )
  const mobileGenerate = await mobilePage.getByTestId('studio-generate').boundingBox()
  check(Boolean(mobileGenerate && mobileGenerate.y >= 0 && mobileGenerate.y + mobileGenerate.height <= 844), '390×844 生成预览按钮在视口内可点')
  await mobilePage.getByTestId('studio-tab-chat').click()
  check(await mobilePage.getByTestId('studio-pane-chat').isVisible(), '390×844 对话 tab 可切回对话')
  await mobilePage.screenshot({ path: path.join(shotsDir, 'p7-7b2b-studio-mobile.png') })
  // template-preview 外壳（自定义 contract）：embed=1/0 均无整页横向溢出
  for (const embed of [1, 0]) {
    await mobilePage.goto(`${base}/template-preview.html?draft=${encodeURIComponent(packId)}&page=supplier-form&embed=${embed}`, {
      waitUntil: 'domcontentloaded'
    })
    await mobilePage.locator('[data-kind="contract"]').first().waitFor({ state: 'visible', timeout: 30000 })
    checkEqual(
      await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
      false,
      `390×844 template-preview embed=${embed} 无整页横向溢出`
    )
  }
  await mobileContext.close()
  checkAudit(mobileAudit, 'P7-7B 移动端 390×844')

  // ---------- 5. 发布 + 模板中心可见/编辑 ----------
  await page.getByTestId('studio-publish').click()
  const publishBox = page.locator('.el-message-box').last()
  await publishBox.waitFor({ state: 'visible', timeout: 8000 })
  await publishBox.getByRole('button', { name: '发布' }).click()
  await waitForText(page.getByTestId('studio-draft-status'), '已发布', '发布后状态')
  const published = await request(base, 'GET', `/design-templates/drafts/${encodeURIComponent(packId)}`)
  checkEqual(published.data?.draft?.publishedVersion, '1.0.0', '首次发布版本 1.0.0')
  const publishedPack = await request(base, 'GET', `/design-system/${encodeURIComponent(packId)}`)
  checkEqual(publishedPack.status, 200, '已发布 pack 可读取')
  checkEqual(publishedPack.data?.source, 'custom', '已发布 pack 来源为 custom')
  checkEqual(publishedPack.data?.pack?.origin?.baseApplicationType, 'enterprise-application-platform', 'pack origin 记录 spec 的 base 应用类型')
  await page.screenshot({ path: path.join(shotsDir, 'p7-7b2b-studio-published.png') })

  await page.getByTestId('studio-home').click()
  await page.getByTestId('home-design-templates').click()
  const center2 = page.getByTestId('design-template-center')
  await center2.waitFor({ state: 'visible', timeout: 10000 })
  await center2.getByTestId('design-template-custom-card').waitFor({ state: 'visible', timeout: 20000 })
  await center2.getByTestId('design-template-custom-card').click()
  const customItem = center2.getByTestId(`design-template-custom-item-${packId}`)
  await customItem.waitFor({ state: 'visible', timeout: 20000 })
  const itemText = (await customItem.innerText()).trim()
  check(itemText.includes('已发布') && itemText.includes('v1.0.0'), `自定义卡片显示已发布 v1.0.0（实际：${itemText}）`)
  check(itemText.includes('数据蓝青') && itemText.includes('reference 1') && itemText.includes('contract 1'), '自定义卡片显示风格与页面 kind 计数')
  check(itemText.includes('0 个应用引用'), '自定义卡片显示引用应用数')
  checkEqual(
    await center2.getByTestId(`design-template-custom-preview-${packId}`).isDisabled(),
    false,
    '已发布自定义模板可打开页面预览'
  )
  await page.screenshot({ path: path.join(shotsDir, 'p7-7b2b-center-published.png') })

  await center2.getByTestId(`design-template-custom-open-${packId}`).click()
  await page.getByTestId('studio-view').waitFor({ state: 'visible', timeout: 20000 })
  await waitForText(page.getByTestId('studio-draft-status'), '已发布', '草稿存在时编辑入口直接进入工作室')
  await page.getByTestId('studio-home').click()
  // 等工作室卸载/在途会话请求结束，再删除草稿（避免旧请求落到已删草稿上）
  await waitForText(page.locator('h1'), '从一个应用开始', '返回首页')
  await delay(500)

  // 已发布但草稿被丢弃：编辑入口应由已发布 pack 反写草稿
  const dropped = await request(base, 'DELETE', `/design-templates/drafts/${encodeURIComponent(packId)}`)
  checkEqual(dropped.status, 200, '丢弃已发布草稿')
  checkEqual(dropped.data?.packKept, true, '丢弃草稿保留已发布模板')
  await page.getByTestId('home-design-templates').click()
  const center4 = page.getByTestId('design-template-center')
  await center4.waitFor({ state: 'visible', timeout: 10000 })
  await center4.getByTestId('design-template-custom-card').waitFor({ state: 'visible', timeout: 20000 })
  await center4.getByTestId('design-template-custom-card').click()
  await center4.getByTestId(`design-template-custom-item-${packId}`).waitFor({ state: 'visible', timeout: 20000 })
  await center4.getByTestId(`design-template-custom-open-${packId}`).click()
  await page.getByTestId('studio-view').waitFor({ state: 'visible', timeout: 20000 })
  await waitForText(page.getByTestId('studio-draft-status'), '已发布', '无草稿时由已发布 pack 反写并进入工作室')
  const recreated = await request(base, 'GET', `/design-templates/drafts/${encodeURIComponent(packId)}`)
  checkEqual(recreated.status, 200, '反写草稿成功')
  checkEqual(recreated.data?.draft?.status, 'published', '反写草稿状态为 published')
  await page.getByTestId('studio-home').click()

  // ---------- 6. picker 仍只列内置 pack ----------
  await page.getByRole('button', { name: '新建应用' }).first().click()
  const newAppDialog = page.locator('.dialog[role="dialog"]').last()
  await newAppDialog.waitFor({ state: 'visible', timeout: 10000 })
  await newAppDialog.getByTestId('new-app-design-picker').click()
  const picker = page.getByTestId('design-template-center')
  await picker.waitFor({ state: 'visible', timeout: 10000 })
  await waitForText(picker.locator('.detail-side h3'), '企业级应用管理平台', 'picker 定位当前内置类型')
  await picker.getByTestId('design-template-back').click()
  await picker.getByTestId('design-template-card-enterprise-application-platform').waitFor({ state: 'visible', timeout: 20000 })
  checkEqual(await picker.getByTestId('design-template-custom-card').count(), 0, 'picker 不显示自定义模板中心入口')
  checkEqual(await picker.getByTestId('design-template-category-custom').count(), 0, 'picker 不显示自定义分类')
  // P7-7c：picker 列出已发布自定义 pack（草稿不列）
  const customPick = picker.getByTestId(`design-template-custom-pick-${packId}`)
  await customPick.waitFor({ state: 'visible', timeout: 20000 })
  const customPickText = (await customPick.innerText()).trim()
  check(customPickText.includes('供应商管理模板') && customPickText.includes('数据蓝青'), 'picker 列出已发布自定义 pack 与风格')
  checkEqual(
    await picker.locator('[data-testid^="design-template-custom-pick-"]').count(),
    1,
    'picker 自定义分组只按已发布 pack 去重（草稿不列）'
  )
  checkEqual(await picker.locator('[data-testid^="design-template-card-"]').count(), 4, 'picker 仍只有 4 个内置应用类型')
  checkEqual(await picker.locator('[data-testid^="design-template-category-"]').count(), 5, 'picker 分类仍为全部 + 4 类')
  await picker.getByTestId('design-template-close').click()
  await picker.waitFor({ state: 'hidden', timeout: 8000 })
  await newAppDialog.getByRole('button', { name: '取消' }).click()
  await newAppDialog.waitFor({ state: 'hidden', timeout: 8000 })

  // ---------- 7. 删除保护（409 展示应用列表）→ 解除引用后删除 ----------
  const ref = await request(base, 'PATCH', `/apps/${appId}/design-system`, {
    pack: packId,
    applicationType: packId,
    style: 'data-cyan'
  })
  checkEqual(ref.status, 200, '应用切换到自定义模板（构造引用）')
  checkEqual(ref.data?.selection?.pack, packId, '应用引用指向自定义 pack')

  await page.getByTestId('home-design-templates').click()
  const center3 = page.getByTestId('design-template-center')
  await center3.waitFor({ state: 'visible', timeout: 10000 })
  await center3.getByTestId('design-template-custom-card').waitFor({ state: 'visible', timeout: 20000 })
  await center3.getByTestId('design-template-custom-card').click()
  const item3 = center3.getByTestId(`design-template-custom-item-${packId}`)
  await item3.waitFor({ state: 'visible', timeout: 20000 })
  check((await item3.innerText()).includes('1 个应用引用'), '引用应用数在模板中心更新')

  await center3.getByTestId(`design-template-custom-delete-${packId}`).click()
  const deleteConfirm = center3.getByTestId('design-template-delete-confirm')
  await deleteConfirm.waitFor({ state: 'visible', timeout: 8000 })
  check((await deleteConfirm.innerText()).includes('删除模板'), '删除前二次确认')
  await deleteConfirm.getByTestId('design-template-delete-confirm-ok').click()
  const conflict = center3.getByTestId('design-template-delete-conflict')
  await conflict.waitFor({ state: 'visible', timeout: 10000 })
  const conflictText = (await conflict.innerText()).trim()
  check(conflictText.includes('P7-7B 引用应用') && conflictText.includes(appId), '409 展示引用应用列表')
  checkEqual(await center3.getByTestId(`design-template-custom-item-${packId}`).count(), 1, '409 后模板未被删除')
  await page.screenshot({ path: path.join(shotsDir, 'p7-7b2b-delete-409.png') })

  const unref = await request(base, 'PATCH', `/apps/${appId}/design-system`, {
    pack: 'afcenter-app-templates-v1',
    applicationType: 'enterprise-application-platform',
    style: 'platform-blue'
  })
  checkEqual(unref.status, 200, '解除应用对自定义模板的引用')
  await conflict.getByRole('button', { name: '知道了' }).click()
  await center3.getByTestId(`design-template-custom-delete-${packId}`).click()
  const deleteConfirm2 = center3.getByTestId('design-template-delete-confirm')
  await deleteConfirm2.waitFor({ state: 'visible', timeout: 8000 })
  await deleteConfirm2.getByTestId('design-template-delete-confirm-ok').click()
  await waitFor(
    async () => (await center3.getByTestId(`design-template-custom-item-${packId}`).count()) === 0,
    20000,
    '删除后自定义卡片消失'
  )
  const gone = await request(base, 'GET', `/design-system/${encodeURIComponent(packId)}`)
  checkEqual(gone.status, 404, '删除后 pack 返回 404')
  await waitForText(center3.getByTestId('design-template-custom-empty'), '还没有自定义模板', '删除后回到空态')
  await page.screenshot({ path: path.join(shotsDir, 'p7-7b2b-deleted.png') })

  checkAudit(audit, 'P7-7B 模板中心 + 工作室流程')

  console.log(`\n[p7-7b-e2e] 通过：${assertions} 条断言`)
  console.log(`[p7-7b-e2e] 截图目录：${shotsDir}`)
  console.log(`[p7-7b-e2e] 临时数据：${runtimeRoot}`)
}

main()
  .catch(error => {
    console.error(`\n[p7-7b-e2e] 失败：${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await browser?.close()
    } catch {
      // ignore
    }
    stopHarness()
    try {
      fs.rmSync(runtimeRoot, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })
