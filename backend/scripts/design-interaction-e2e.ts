/**
 * B5 设计预览「交互预览层」Playwright 验收（临时目录 + 端口 3451 / 4451，stub opencode）
 *
 * 前置：`npm run build --prefix frontend`。
 * 运行：`npm run e2e:design-interaction --prefix backend`
 *
 * 覆盖（单页原型 iframe，recipe 驱动、不写数据/不调接口）：
 * - 默认页面 + 交互提示角标（iframe 内 + 父层 chip）；
 * - create → 同页面集同实体 dialog-form → 弹出表单弹窗（取消/提交）；
 * - 行 edit → 弹窗预填；delete → 确认框（取消不变）；
 * - create → page-form → 父层切页面 Tab；
 * - create → main-sub（B6-0）→ 父层切页面 Tab；
 * - 显式 actionTargets 覆盖启发式（B6-1）→ 切到显式目标页（不弹窗）；
 * - create → 无表单页 → 临时表单弹窗（B6-2，标注「临时表单 · 未设计表单页」）+ 原因/候选提示；
 * - 0 console error / pageerror / 请求失败 / 外部请求。
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type FrameLocator, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const frontendDist = path.resolve(backendDir, '../frontend/dist')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-di-e2e-'))
const stateFile = path.join(root, 'state.json')
const shotsDir = process.env.DI_SHOTS_DIR || path.join(os.tmpdir(), 'workbench-design-interaction-shots')
const port = 3451
const base = `http://127.0.0.1:${port}`
const appId = 'di-e2e'

fs.mkdirSync(shotsDir, { recursive: true })

interface HarnessState {
  appId: string
  appDir: string
  projectsDir: string
  ready?: boolean
}

let harness: ChildProcess | null = null
let assertions = 0

function check(condition: unknown, message: string): void {
  assertions += 1
  if (!condition) throw new Error(`断言失败：${message}`)
}

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
    await delay(100)
  }
  throw new Error(`等待超时（${timeoutMs}ms）：${label}`)
}

/** 交互预览 fixture：1 页面集 / 5 实体 / 12 页（list、dialog-form、page-form、main-sub、detail、无表单页、显式 actionTargets） */
function designFixture(): { entities: Record<string, unknown>; pages: Record<string, unknown> } {
  const orderFields = [
    { code: 'orderCode', name: '订单编号', type: 'string', required: true, unique: true },
    { code: 'orderName', name: '订单名称', type: 'string', required: true },
    { code: 'amount', name: '订单金额', type: 'decimal' },
    {
      code: 'orderStatus',
      name: '订单状态',
      type: 'enum',
      options: [
        { value: 'PENDING', label: '待处理' },
        { value: 'SHIPPED', label: '已发货' }
      ]
    }
  ]
  const customerFields = [
    { code: 'customerCode', name: '客户编号', type: 'string', required: true, unique: true },
    { code: 'customerName', name: '客户名称', type: 'string', required: true }
  ]
  const reportFields = [{ code: 'reportName', name: '报表名称', type: 'string', required: true }]
  const invoiceFields = [
    { code: 'invoiceNo', name: '发票编号', type: 'string', required: true },
    { code: 'amount', name: '发票金额', type: 'decimal' },
    { code: 'remark', name: '备注', type: 'text' }
  ]
  const ticketFields = [
    { code: 'ticketNo', name: '工单编号', type: 'string', required: true },
    { code: 'title', name: '工单标题', type: 'string', required: true }
  ]
  const entities = {
    schemaVersion: 2,
    entities: [
      { id: 'order', name: '订单', table: 'biz_order', fields: orderFields },
      { id: 'customer', name: '客户', table: 'biz_customer', fields: customerFields },
      { id: 'report', name: '报表', table: 'biz_report', fields: reportFields },
      { id: 'invoice', name: '发票', table: 'biz_invoice', fields: invoiceFields },
      { id: 'ticket', name: '工单', table: 'biz_ticket', fields: ticketFields }
    ],
    relations: []
  }
  const orderForm = {
    presentation: 'dialog',
    columns: 2,
    width: 720,
    fields: ['orderCode', 'orderName', 'amount', 'orderStatus'],
    groups: [{ title: '订单信息', fields: ['orderCode', 'orderName', 'amount', 'orderStatus'] }]
  }
  const pages = {
    schemaVersion: 2,
    pageSets: [
      {
        id: 'sales',
        epic: 'EP-001',
        title: '销售管理',
        primaryEntity: 'order',
        pages: [
          {
            id: 'order-list',
            name: '订单列表',
            type: 'list',
            entity: 'order',
            recipe: 'list',
            columns: ['orderCode', 'orderName', 'amount', 'orderStatus'],
            filters: ['orderName'],
            rowActions: ['edit', 'delete', 'detail'],
            toolbarActions: ['create', 'export'],
            selection: true,
            pagination: { layout: 'three-part', pageSize: 10 },
            form: orderForm
          },
          {
            id: 'order-dialog-form',
            name: '订单新增/编辑',
            type: 'form',
            entity: 'order',
            recipe: 'dialog-form',
            form: orderForm
          },
          {
            id: 'customer-list',
            name: '客户列表',
            type: 'list',
            entity: 'customer',
            recipe: 'list',
            columns: ['customerCode', 'customerName'],
            rowActions: ['edit'],
            toolbarActions: ['create'],
            selection: true
          },
          {
            id: 'customer-page-form',
            name: '客户信息',
            type: 'form',
            entity: 'customer',
            recipe: 'page-form',
            toolbarActions: ['submit', 'cancel'],
            form: {
              columns: 1,
              fields: ['customerCode', 'customerName'],
              groups: [{ title: '客户信息', fields: ['customerCode', 'customerName'] }]
            }
          },
          {
            id: 'order-detail',
            name: '订单详情',
            type: 'detail',
            entity: 'order',
            recipe: 'detail'
          },
          {
            id: 'report-list',
            name: '报表列表',
            type: 'list',
            entity: 'report',
            recipe: 'list',
            columns: ['reportName'],
            toolbarActions: ['create'],
            selection: true
          },
          {
            id: 'report-view',
            name: '报表详情',
            type: 'detail',
            entity: 'report',
            recipe: 'detail'
          },
          {
            id: 'invoice-list',
            name: '发票列表',
            type: 'list',
            entity: 'invoice',
            recipe: 'list',
            columns: ['invoiceNo', 'amount', 'remark'],
            rowActions: ['edit'],
            toolbarActions: ['create'],
            selection: true
          },
          {
            id: 'invoice-form',
            name: '新建发票',
            type: 'form',
            entity: 'invoice',
            recipe: 'main-sub',
            form: {
              presentation: 'page',
              columns: 2,
              fields: ['invoiceNo', 'amount', 'remark'],
              groups: [{ title: '发票信息', fields: ['invoiceNo', 'amount', 'remark'] }]
            }
          },
          {
            id: 'ticket-list',
            name: '工单列表',
            type: 'list',
            entity: 'ticket',
            recipe: 'list',
            columns: ['ticketNo', 'title'],
            rowActions: ['edit'],
            toolbarActions: ['create'],
            selection: true,
            actionTargets: { create: 'ticket-page', edit: 'ticket-page' }
          },
          {
            id: 'ticket-dialog',
            name: '工单弹窗表单',
            type: 'form',
            entity: 'ticket',
            recipe: 'dialog-form',
            form: {
              presentation: 'dialog',
              columns: 2,
              fields: ['ticketNo', 'title'],
              groups: [{ title: '工单信息', fields: ['ticketNo', 'title'] }]
            }
          },
          {
            id: 'ticket-page',
            name: '工单整页表单',
            type: 'form',
            entity: 'ticket',
            recipe: 'page-form',
            form: {
              presentation: 'page',
              columns: 2,
              fields: ['ticketNo', 'title'],
              groups: [{ title: '工单信息', fields: ['ticketNo', 'title'] }]
            }
          }
        ]
      }
    ]
  }
  return { entities, pages }
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
      P2_APP_NAME: 'B5 设计预览交互',
      P2_DESIGN_SYSTEM: JSON.stringify({
        pack: 'afcenter-app-templates-v1',
        applicationType: 'operations-management',
        style: 'data-cyan'
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

async function portClosed(timeoutMs = 8000): Promise<boolean> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const open = await new Promise<boolean>(resolve => {
      const socket = net.connect({ host: '127.0.0.1', port })
      socket.once('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.once('error', () => resolve(false))
      setTimeout(() => {
        socket.destroy()
        resolve(false)
      }, 500)
    })
    if (!open) return true
    await delay(200)
  }
  return false
}

interface PageAudit {
  consoleErrors: string[]
  pageErrors: string[]
  failedRequests: string[]
  externalRequests: string[]
}

function audit(page: Page): PageAudit {
  const result: PageAudit = { consoleErrors: [], pageErrors: [], failedRequests: [], externalRequests: [] }
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (/favicon/i.test(text)) return
    result.consoleErrors.push(text)
  })
  page.on('pageerror', error => result.pageErrors.push(error.message))
  page.on('requestfailed', request => {
    const failure = request.failure()?.errorText || ''
    if (failure.includes('ERR_ABORTED')) return
    result.failedRequests.push(`${request.url()} ${failure}`)
  })
  page.on('request', request => {
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) result.externalRequests.push(request.url())
  })
  return result
}

function previewFrame(page: Page): FrameLocator {
  return page.locator('[data-testid=prototype-preview-frame]').contentFrame()
}

async function iframeSrc(page: Page): Promise<string> {
  return (await page.locator('[data-testid=prototype-preview-frame]').getAttribute('src')) || ''
}

async function waitFramePage(page: Page, pageId: string): Promise<void> {
  await waitFor(async () => (await iframeSrc(page)).includes(`page=${pageId}`), 20000, `iframe src 含 page=${pageId}`)
}

async function waitFrameReady(page: Page, expectedText: string): Promise<FrameLocator> {
  const frame = previewFrame(page)
  await frame.locator('.design-preview-root').waitFor({ state: 'visible', timeout: 30000 })
  await waitFor(
    async () => ((await frame.locator('body').innerText().catch(() => '')) || '').includes(expectedText),
    25000,
    `iframe 内容包含「${expectedText}」`
  )
  return frame
}

async function openOrderList(page: Page): Promise<FrameLocator> {
  await page.locator('[data-testid=design-tab-prototype]').click()
  await page.locator('[data-testid=design-pageset-sales]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-testid=design-pageset-sales]').click()
  await page.locator('[data-testid=prototype-preview-frame]').waitFor({ state: 'visible', timeout: 20000 })
  await waitFramePage(page, 'order-list')
  return waitFrameReady(page, '订单列表')
}

async function main(): Promise<void> {
  check(fs.existsSync(path.join(frontendDist, 'index.html')), 'frontend/dist/index.html 已构建')
  check(fs.existsSync(path.join(frontendDist, 'design-preview.html')), 'frontend/dist/design-preview.html 已构建')

  let browser: Browser | null = null
  let context: BrowserContext | null = null
  try {
    await startHarness()
    const harnessState = await readState()
    const designDir = path.join(harnessState.appDir, 'docs', 'design')
    const fixture = designFixture()
    fs.mkdirSync(designDir, { recursive: true })
    fs.writeFileSync(path.join(designDir, 'entities.json'), `${JSON.stringify(fixture.entities, null, 2)}\n`, 'utf8')
    fs.writeFileSync(path.join(designDir, 'pages.json'), `${JSON.stringify(fixture.pages, null, 2)}\n`, 'utf8')

    browser = await chromium.launch()
    context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()
    const pageAudit = audit(page)

    // ---------- 1. 打开设计视图 → 页面集 → order-list ----------
    await page.goto(`${base}/#/apps/${appId}/design`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid=design-view]').waitFor({ state: 'visible', timeout: 20000 })
    const orderFrame = await openOrderList(page)
    check(true, '1.1 默认渲染 order-list 的设计产物 iframe')
    check((await page.locator('[data-testid=prototype-pages] .page-chip').count()) === 12, '1.2 页面 chips=12')
    check(
      (await page.locator('[data-testid=prototype-interaction-hint]').innerText()).includes('不保存'),
      '1.3 父层显示「交互预览 · 不保存」'
    )
    check(
      (await orderFrame.locator('[data-testid=design-preview-interactive-badge]').innerText()).includes('不保存'),
      '1.4 iframe 内显示「交互预览 · 不保存」'
    )
    await page.screenshot({ path: path.join(shotsDir, 'di-order-list.png') })

    // ---------- 2. create → dialog-form 弹窗 → 取消关闭 ----------
    await orderFrame.getByRole('button', { name: '新增' }).first().click()
    const actionDialog = orderFrame.locator('[data-testid=contract-action-dialog]')
    await actionDialog.waitFor({ state: 'visible', timeout: 15000 })
    check(true, '2.1 新增 → 弹出表单弹窗')
    const dialogText = (await actionDialog.innerText()) || ''
    check(dialogText.includes('订单编号') && dialogText.includes('订单名称'), '2.2 弹窗包含目标表单字段')
    check((await actionDialog.locator('.el-input').count()) >= 1, '2.3 弹窗渲染 pm 表单控件')
    check((await actionDialog.locator('input').first().inputValue()) === '', '2.4 新增弹窗表单为空（不伪造数据）')
    await orderFrame.locator('[data-testid=contract-action-cancel]').click()
    await actionDialog.waitFor({ state: 'hidden', timeout: 10000 })
    check(true, '2.5 取消后弹窗关闭')

    // ---------- 3. create → 提交关闭 + 成功提示 ----------
    await orderFrame.getByRole('button', { name: '新增' }).first().click()
    await actionDialog.waitFor({ state: 'visible', timeout: 15000 })
    await orderFrame.locator('[data-testid=contract-action-submit]').click()
    await actionDialog.waitFor({ state: 'hidden', timeout: 10000 })
    await waitFor(
      async () => ((await orderFrame.locator('.el-message--success').first().innerText().catch(() => '')) || '').includes('已提交'),
      10000,
      '提交成功提示'
    )
    check(true, '3.1 提交后关闭并提示「已提交（预览）」')

    // ---------- 4. 行 edit → 弹窗预填 ----------
    await orderFrame.locator('button.link-button:visible', { hasText: '编辑' }).first().click()
    await actionDialog.waitFor({ state: 'visible', timeout: 15000 })
    const prefilled = await actionDialog.locator('input').first().inputValue()
    check(Boolean(prefilled) && prefilled !== '', `4.1 编辑弹窗字段已预填（${prefilled}）`)
    await orderFrame.locator('[data-testid=contract-action-cancel]').click()
    await actionDialog.waitFor({ state: 'hidden', timeout: 10000 })
    check(true, '4.2 编辑弹窗可取消关闭')

    // ---------- 5. 行 delete → 确认框（取消不变） ----------
    const rowCountBefore = await orderFrame.locator('.contract-table .el-table__row').count()
    await orderFrame.locator('button.link-button:visible', { hasText: '删除' }).first().click()
    const messageBox = orderFrame.locator('.el-message-box')
    await messageBox.waitFor({ state: 'visible', timeout: 10000 })
    check(true, '5.1 删除出现确认框')
    await messageBox.locator('.el-message-box__btns button').first().click()
    await messageBox.waitFor({ state: 'hidden', timeout: 10000 })
    check((await orderFrame.locator('.contract-table .el-table__row').count()) === rowCountBefore, '5.2 取消删除后行数不变')

    // ---------- 6. customer-list create → 父层切到 page-form Tab ----------
    await page.locator('[data-testid=page-chip-customer-list]').click()
    await waitFramePage(page, 'customer-list')
    const customerFrame = await waitFrameReady(page, '客户列表')
    await customerFrame.getByRole('button', { name: '新增' }).first().click()
    await waitFramePage(page, 'customer-page-form')
    await waitFor(
      async () =>
        (await page.locator('[data-testid=page-chip-customer-page-form]').getAttribute('class'))?.includes(
          'rg-tab--active'
        ) || false,
      15000,
      'customer-page-form Tab 激活'
    )
    check(true, '6.1 page-form 目标 → 父层切换到目标页面 Tab')
    await waitFrameReady(page, '客户信息')

    // ---------- 6b. invoice-list create → main-sub 表单页（B6-0） ----------
    await page.locator('[data-testid=page-chip-invoice-list]').click()
    await waitFramePage(page, 'invoice-list')
    const invoiceFrame = await waitFrameReady(page, '发票列表')
    await invoiceFrame.getByRole('button', { name: '新增' }).first().click()
    await waitFramePage(page, 'invoice-form')
    await waitFor(
      async () =>
        (await page.locator('[data-testid=page-chip-invoice-form]').getAttribute('class'))?.includes('rg-tab--active') ||
        false,
      15000,
      'invoice-form Tab 激活'
    )
    check(true, '6b.1 main-sub 表单目标 → 父层切换到目标页面 Tab（不提示未设计）')
    await waitFrameReady(page, '新建发票')

    // ---------- 6c. ticket-list 显式 actionTargets 覆盖启发式（B6-1） ----------
    // 同实体同时有 dialog-form（启发式优先）与 page-form；显式指向 page-form，应切页而不是弹窗。
    await page.locator('[data-testid=page-chip-ticket-list]').click()
    await waitFramePage(page, 'ticket-list')
    const ticketFrame = await waitFrameReady(page, '工单列表')
    await ticketFrame.getByRole('button', { name: '新增' }).first().click()
    await waitFramePage(page, 'ticket-page')
    await waitFor(
      async () =>
        (await page.locator('[data-testid=page-chip-ticket-page]').getAttribute('class'))?.includes('rg-tab--active') ||
        false,
      15000,
      'ticket-page Tab 激活'
    )
    check(true, '6c.1 显式 actionTargets 覆盖启发式 → 切到 page-form 目标页')
    check(
      (await previewFrame(page).locator('[data-testid=contract-action-dialog]').count()) === 0,
      '6c.2 显式目标不是弹窗（不打开 dialog-form）'
    )
    await waitFrameReady(page, '工单整页表单')

    // ---------- 7. report-list create → 临时表单（B6-2：同实体只有 detail，不伪造正式表单） ----------
    await page.locator('[data-testid=page-chip-report-list]').click()
    await waitFramePage(page, 'report-list')
    const reportFrame = await waitFrameReady(page, '报表列表')
    await reportFrame.getByRole('button', { name: '新增' }).first().click()
    const tempDialog = reportFrame.locator('[data-testid=contract-action-dialog]')
    await tempDialog.waitFor({ state: 'visible', timeout: 15000 })
    check(true, '7.1 无表单页 → 打开临时表单弹窗（不是只 toast）')
    const tempText = (await tempDialog.innerText()) || ''
    check(
      tempText.includes('临时表单') && tempText.includes('未设计表单页'),
      `7.2 弹窗标注「临时表单 · 未设计表单页」（${tempText.replace(/\s+/g, ' ').slice(0, 160)}）`
    )
    check(tempText.includes('报表名称'), '7.3 临时表单使用实体字段，不伪造空表单')
    await waitFor(
      async () =>
        ((await reportFrame.locator('.el-message--warning').first().innerText().catch(() => '')) || '').includes('未设计新增'),
      10000,
      '临时表单原因提示'
    )
    const tempWarning = await reportFrame.locator('.el-message--warning').first().innerText()
    check(tempWarning.includes('report-view(detail)'), `7.4 提示原因与同实体候选（${tempWarning.replace(/\s+/g, ' ')}）`)
    check((await iframeSrc(page)).includes('page=report-list'), '7.5 不发生切页')
    await reportFrame.locator('[data-testid=contract-action-cancel]').click()
    await tempDialog.waitFor({ state: 'hidden', timeout: 10000 })
    check(true, '7.6 临时表单可取消关闭')
    await page.screenshot({ path: path.join(shotsDir, 'di-report-temporary-form.png') })

    // ---------- 8. 审计 ----------
    check(pageAudit.consoleErrors.length === 0, `8.1 0 console error（${pageAudit.consoleErrors.join(' | ')}）`)
    check(pageAudit.pageErrors.length === 0, `8.2 0 pageerror（${pageAudit.pageErrors.join(' | ')}）`)
    check(pageAudit.failedRequests.length === 0, `8.3 0 请求失败（${pageAudit.failedRequests.join(' | ')}）`)
    check(pageAudit.externalRequests.length === 0, `8.4 0 外部请求（${pageAudit.externalRequests.join(' | ')}）`)

    await context.close()
    context = null
  } finally {
    await context?.close().catch(() => undefined)
    await browser?.close().catch(() => undefined)
    stopHarness()
    const closed = await portClosed()
    if (!closed) console.warn(`[di-e2e] 警告：临时后端端口 ${port} 仍在监听`)
    else console.log(`[di-e2e] 临时后端端口 ${port} 已关闭`)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        fs.rmSync(root, { recursive: true, force: true })
        break
      } catch {
        await delay(200)
      }
    }
  }

  console.log(`\n[di-e2e] 通过：${assertions} 条断言；截图目录 ${shotsDir}`)
}

main().catch(error => {
  console.error(`\n[di-e2e] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
