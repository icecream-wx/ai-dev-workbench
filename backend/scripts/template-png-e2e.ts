/**
 * P10/P10b 模板化 + 真实模板风格 PNG 验收（临时目录 + 端口 3447，stub opencode）
 *
 * 前置：`npm run build --prefix frontend`。
 * 运行：`npm run e2e:p10 --prefix backend`
 *
 * 覆盖：
 * - dashboard 模板：page-heading + metrics-grid/metric-card + panel + pm-echarts(canvas) + 最近记录 pm-table + data-cyan 主色；
 * - detail 模板：page-heading/title-line/status-chip + detail-hero + info-grid/info-item + timeline + 子表 pm-table；
 * - main-sub 模板（P10b）：表单分组 panel + 子表页签 + pm-table；
 * - wizard 模板（P10b）：pm-steps + 当前分组字段 + 上一步/下一步/提交；
 * - 未知类型 + 仅蓝图（P10b）：按 type 映射到模板通用页，不出现 wf-page；
 * - 自动导出：manifest 6 页（模板截图）；
 * - 读取 overview/product-detail/product-main-sub.png，浏览器 canvas 采样：宽>800、高>400、存在接近主色 rgb(20,95,186) 的像素；
 * - 设计视图只读状态「设计产物 · 模板风格」、无模式切换按钮、无 wf-page；0 console/pageerror/请求失败/外部请求。
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type FrameLocator, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const frontendDist = path.resolve(backendDir, '../frontend/dist')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p10-e2e-'))
const stateFile = path.join(root, 'state.json')
const shotsDir = process.env.P10_SHOTS_DIR || path.join(os.tmpdir(), 'workbench-p10-shots')
const port = 3447
const base = `http://127.0.0.1:${port}`
const appId = 'p10-e2e'
const moduleKey = 'MOD-001'
/** data-cyan 主色（templates/design-system pack tokens.primary = #145fba） */
const CYAN_PRIMARY = 'rgb(20, 95, 186)'
const CYAN_RGB = [20, 95, 186] as const

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

/** operations-management × data-cyan：dashboard / detail / list 三页（含详情子表） */
function designFixture(): Record<string, unknown> {
  const productFields = [
    { name: '商品编码', label: '商品编码', type: 'string', required: true, unique: true },
    { name: '商品名称', label: '商品名称', type: 'string', required: true },
    { name: '商品分类', label: '商品分类', type: 'string' },
    { name: '计量单位', label: '计量单位', type: 'string' },
    { name: '销售单价', label: '销售单价', type: 'decimal' },
    { name: '库存数量', label: '库存数量', type: 'number' },
    { name: '商品状态', label: '商品状态', type: 'enum', options: ['上架', '下架'] },
    { name: '创建时间', label: '创建时间', type: 'datetime' },
    { name: '更新时间', label: '更新时间', type: 'datetime' },
    { name: '商品描述', label: '商品描述', type: 'text' }
  ]
  const detailFields = [
    { name: '明细编号', label: '明细编号', type: 'string', required: true },
    { name: '规格型号', label: '规格型号', type: 'string' },
    { name: '包装方式', label: '包装方式', type: 'enum', options: ['袋', '盒', '罐', '箱'] },
    { name: '保质期（天）', label: '保质期（天）', type: 'number' }
  ]
  const supplierFields = [
    { name: '供应商编码', label: '供应商编码', type: 'string', required: true },
    { name: '供应商名称', label: '供应商名称', type: 'string' },
    { name: '合作状态', label: '合作状态', type: 'enum', options: ['合作中', '已终止'] },
    { name: '结算周期（天）', label: '结算周期（天）', type: 'number' }
  ]
  return {
    module: moduleKey,
    title: '商品运营',
    designSystem: {
      pack: 'afcenter-app-templates-v1',
      applicationType: 'operations-management',
      style: 'data-cyan'
    },
    entities: [
      { id: 'product', name: '商品', table: 'biz_product', fields: productFields },
      { id: 'productDetail', name: '商品明细', table: 'biz_product_detail', fields: detailFields },
      { id: 'productSupplier', name: '商品供应商', table: 'biz_product_supplier', fields: supplierFields }
    ],
    relations: [{ from: 'product', to: 'productDetail', type: '1:N', label: '商品包含明细' }],
    pages: [
      {
        id: 'overview',
        name: '运营概览',
        type: 'dashboard',
        recipe: 'dashboard',
        catalogRef: 'operations-management/dashboard',
        blueprint: 'application-types/operations-management/pages/OperationsDashboard.vue',
        entity: 'product',
        columns: ['商品编码', '商品名称', '商品分类', '库存数量', '商品状态'],
        toolbarActions: ['create', 'export'],
        pagination: { layout: 'three-part', pageSize: 5 }
      },
      {
        id: 'product-detail',
        name: '商品详情',
        type: 'detail',
        recipe: 'detail',
        catalogRef: 'operations-management/issues',
        entity: 'product',
        toolbarActions: ['edit', 'export'],
        subTables: [
          { entity: 'productDetail', title: '商品明细', columns: ['明细编号', '规格型号', '包装方式'], mode: 'tab' }
        ]
      },
      {
        id: 'product-list',
        name: '商品列表',
        type: 'list',
        recipe: 'list',
        catalogRef: 'operations-management/list',
        entity: 'product',
        filters: ['商品名称', '商品状态'],
        columns: ['商品编码', '商品名称', '商品分类', '销售单价', '库存数量', '商品状态'],
        rowActions: ['detail', 'edit'],
        toolbarActions: ['create', 'export'],
        pagination: { layout: 'three-part', pageSize: 5 }
      },
      {
        id: 'product-main-sub',
        name: '商品档案',
        type: 'form',
        recipe: 'main-sub',
        blueprint: 'application-types/operations-management/pages/OperationsForm.vue',
        entity: 'product',
        form: {
          columns: 2,
          fields: ['商品编码', '商品名称', '商品分类', '计量单位', '销售单价', '库存数量', '商品状态'],
          groups: [
            { title: '基本信息', fields: ['商品编码', '商品名称', '商品分类', '计量单位'] },
            { title: '价格与库存', fields: ['销售单价', '库存数量', '商品状态'] }
          ]
        },
        subTables: [
          { entity: 'productDetail', title: '商品明细', columns: ['明细编号', '规格型号', '包装方式'], mode: 'tab' },
          { entity: 'productSupplier', title: '供应商', columns: ['供应商编码', '供应商名称', '合作状态'], mode: 'tab' }
        ],
        toolbarActions: ['create', 'submit']
      },
      {
        id: 'product-wizard',
        name: '商品上架向导',
        type: 'form',
        recipe: 'wizard',
        blueprint: 'application-types/operations-management/pages/OperationsForm.vue',
        entity: 'product',
        form: {
          columns: 2,
          fields: ['商品编码', '商品名称', '商品分类', '销售单价', '库存数量', '商品状态', '商品描述'],
          groups: [
            { title: '基本信息', fields: ['商品编码', '商品名称', '商品分类'] },
            { title: '价格与库存', fields: ['销售单价', '库存数量'] },
            { title: '上架确认', fields: ['商品状态', '商品描述'] }
          ]
        }
      },
      {
        id: 'product-kanban',
        name: '商品看板',
        type: 'kanban',
        blueprint: 'application-types/operations-management/pages/OperationsIssues.vue',
        entity: 'product'
      }
    ]
  }
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
      P2_APP_NAME: 'P10 模板风格 PNG',
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
  exportWarnings: string[]
}

function audit(page: Page): PageAudit {
  const result: PageAudit = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    externalRequests: [],
    exportWarnings: []
  }
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (/favicon/i.test(text)) return
    result.consoleErrors.push(text)
  })
  page.on('console', message => {
    if (message.type() !== 'warning') return
    const text = message.text()
    result.exportWarnings.push(text)
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

async function waitFrameSrc(page: Page, pageId: string): Promise<string> {
  await waitFor(
    async () =>
      (((await page.locator('[data-testid=prototype-preview-frame]').getAttribute('src')) || '').includes(
        `page=${pageId}`
      ) || false),
    20000,
    `iframe src 含 page=${pageId}`
  )
  return (await page.locator('[data-testid=prototype-preview-frame]').getAttribute('src')) || ''
}

async function waitFrameReady(page: Page, expectedText?: string): Promise<FrameLocator> {
  const frame = previewFrame(page)
  await frame.locator('.design-preview-root').waitFor({ state: 'visible', timeout: 30000 })
  if (expectedText) {
    try {
      await waitFor(
        async () => ((await frame.locator('body').innerText().catch(() => '')) || '').includes(expectedText),
        25000,
        `iframe 内容包含「${expectedText}」`
      )
    } catch (error) {
      const body = (await frame.locator('body').innerText().catch(() => '')) || ''
      throw new Error(`${(error as Error).message}；iframe 内容：${body.replace(/\s+/g, ' ').slice(0, 400)}`)
    }
  }
  return frame
}

async function openDesignPrototype(page: Page): Promise<void> {
  await page.goto(`${base}/#/apps/${appId}/design`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=design-view]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-testid=design-module-MOD-001]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-testid=design-module-MOD-001]').click()
  await page.locator('[data-testid=design-tab-prototype]').click()
}

interface PngSample {
  width: number
  height: number
  primaryMatches: number
}

/** 读取 PNG → base64 → 浏览器 Image+canvas 采样（不要求精确相等，容差 ±14） */
async function samplePng(page: Page, file: string): Promise<PngSample> {
  const dataUrl = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
  return page.evaluate(
    async ({ dataUrl, target }) => {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('PNG 解码失败'))
        img.src = dataUrl
      })
      const width = img.naturalWidth
      const height = img.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas 2d 不可用')
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, width, height).data
      let primaryMatches = 0
      const [tr, tg, tb] = target
      const stride = 3
      for (let i = 0; i < data.length; i += 4 * stride) {
        const alpha = data[i + 3]
        if (alpha < 200) continue
        if (
          Math.abs(data[i] - tr) <= 14 &&
          Math.abs(data[i + 1] - tg) <= 14 &&
          Math.abs(data[i + 2] - tb) <= 14
        ) {
          primaryMatches += 1
        }
      }
      return { width, height, primaryMatches }
    },
    { dataUrl, target: [...CYAN_RGB] }
  )
}

async function main(): Promise<void> {
  check(fs.existsSync(path.join(frontendDist, 'index.html')), 'frontend/dist/index.html 已构建')
  check(fs.existsSync(path.join(frontendDist, 'design-preview.html')), 'frontend/dist/design-preview.html 已构建')

  let browser: Browser | null = null
  let context: BrowserContext | null = null
  try {
    await startHarness()
    const harnessState = await readState()
    const designDir = path.join(harnessState.appDir, 'docs', 'design', moduleKey)
    const prototypesDir = path.join(designDir, 'prototypes')

    const created = await request('POST', `/apps/${appId}/requirements-modules`, { title: '商品运营' })
    check(created.status === 201, '准备需求模块 MOD-001')
    fs.mkdirSync(designDir, { recursive: true })
    fs.writeFileSync(path.join(designDir, 'design.json'), `${JSON.stringify(designFixture(), null, 2)}\n`, 'utf8')

    const artifacts = await request('GET', `/apps/${appId}/artifacts`)
    const designHash = artifacts.data?.hashes?.[`docs/design/${moduleKey}/design.json`] || ''
    check(Boolean(designHash), `artifacts 返回 designHash（${designHash}）`)

    browser = await chromium.launch()
    context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()
    const pageAudit = audit(page)

    await openDesignPrototype(page)

    // ---------- 1. dashboard 默认模板风格 ----------
    await page.locator('[data-testid=prototype-preview-frame]').waitFor({ state: 'visible', timeout: 20000 })
    check((await page.locator('[data-testid=prototype-pages] .page-chip').count()) === 6, '1.1 原型页面 chips=6')
    check(
      (await page.locator('[data-testid=prototype-render-mode]').innerText()) === '设计产物 · 模板风格',
      '1.2 dashboard 只读状态为「设计产物 · 模板风格」'
    )
    check((await page.locator('[data-testid^=prototype-mode-]').count()) === 0, '1.2b 无「模板风格/线框」切换按钮')
    check(!(await page.locator('[data-testid=export-png-btn]').isDisabled()), '1.3 模板模式允许导出 PNG')
    const exportHint = (await page.locator('[data-testid=prototype-export-hint]').innerText()) || ''
    check(exportHint.includes('模板风格截图'), '1.4 导出提示为模板风格截图')
    const dashSrc = await waitFrameSrc(page, 'overview')
    check(dashSrc.includes('/design-preview.html?') && dashSrc.includes('embed=1'), '1.5 iframe 指向 design-preview.html')

    const dashFrame = await waitFrameReady(page, '运营概览')
    check((await dashFrame.locator('.design-preview-root.visual-style-data-cyan').count()) === 1, '2.1 根节点带 visual-style-data-cyan')
    check(
      (await dashFrame.locator('.optimized-suite.application-type-operations').count()) === 1,
      '2.2 根节点带 optimized-suite + application-type-operations'
    )
    check((await dashFrame.locator('[data-testid=contract-page-dashboard]').count()) === 1, '2.3 dashboard 配方渲染')
    check((await dashFrame.locator('.page-heading h1').first().innerText()).includes('运营概览'), '2.4 页面标题来自 design.json')
    check((await dashFrame.locator('.metrics-grid').count()) === 1, '2.5 metrics-grid 模板结构')
    check((await dashFrame.locator('.metric-card').count()) >= 3, `2.6 metric-card ≥3（${await dashFrame.locator('.metric-card').count()}）`)
    check((await dashFrame.locator('.panel').count()) >= 2, '2.7 至少两个 panel')
    check((await dashFrame.locator('[data-testid=contract-dashboard-chart] canvas').count()) >= 1, '2.8 pm-echarts 渲染 canvas')
    check((await dashFrame.locator('[data-testid=contract-dashboard-table] .el-table').count()) === 1, '2.9 最近记录 pm-table')
    const dashText = (await dashFrame.locator('body').innerText()) || ''
    check(dashText.includes('记录总数'), '2.10 指标卡含记录总数')
    check(dashText.includes('最近记录'), '2.11 最近记录分区可见')
    const metricBorder = await dashFrame
      .locator('.metric-card')
      .first()
      .evaluate(element => getComputedStyle(element).borderTopColor)
    check(metricBorder === CYAN_PRIMARY, `2.12 metric-card 顶部主色为 data-cyan（实际 ${metricBorder}）`)
    await delay(300)
    await page.screenshot({ path: path.join(shotsDir, 'p10-dashboard.png') })

    // ---------- 2. detail 模板风格 ----------
    await page.locator('[data-testid=page-chip-product-detail]').click()
    const detailSrc = await waitFrameSrc(page, 'product-detail')
    check(detailSrc.includes('page=product-detail'), '3.1 切页后 iframe 指向 product-detail')
    const detailFrame = await waitFrameReady(page, '商品详情')
    check((await detailFrame.locator('[data-testid=contract-page-detail]').count()) === 1, '3.2 detail 配方渲染')
    check((await detailFrame.locator('.page-heading').count()) === 1, '3.3 使用 page-heading')
    check((await detailFrame.locator('.title-line').count()) === 1, '3.4 使用 title-line')
    check((await detailFrame.locator('.status-chip').count()) >= 1, '3.5 状态标签 status-chip')
    check((await detailFrame.locator('.detail-hero').count()) === 1, '3.6 detail-hero')
    check((await detailFrame.locator('.info-grid').count()) === 1, '3.7 info-grid')
    check((await detailFrame.locator('.info-item').count()) >= 4, `3.8 info-item ≥4（${await detailFrame.locator('.info-item').count()}）`)
    check((await detailFrame.locator('.timeline li').count()) >= 1, '3.9 timeline 至少一条动态')
    check((await detailFrame.locator('.panel').count()) >= 2, '3.10 详情至少两个 panel')
    check((await detailFrame.locator('[data-testid=contract-subtable-0] .el-table').count()) === 1, '3.11 子表 pm-table')
    const detailText = (await detailFrame.locator('body').innerText()) || ''
    check(detailText.includes('商品编码') && detailText.includes('商品名称'), '3.12 字段来自实体')
    check(detailText.includes('记录创建') || detailText.includes('最近更新'), '3.13 时间线来自创建/更新时间')
    await page.screenshot({ path: path.join(shotsDir, 'p10-detail.png') })

    // ---------- 3. list 仍走模板（回归） ----------
    await page.locator('[data-testid=page-chip-product-list]').click()
    await waitFrameSrc(page, 'product-list')
    const listFrame = await waitFrameReady(page, '商品列表')
    check((await listFrame.locator('.page-heading').count()) === 1, '4.1 list 仍使用 page-heading')
    check((await listFrame.locator('.contract-table .el-table').count()) === 1, '4.2 list 仍渲染 pm-table')

    // ---------- 3b. main-sub 模板（P10b：表单分组 + 子表页签） ----------
    await page.locator('[data-testid=page-chip-product-main-sub]').click()
    const mainSubSrc = await waitFrameSrc(page, 'product-main-sub')
    check(mainSubSrc.includes('page=product-main-sub'), '4b.1 main-sub iframe 指向 product-main-sub')
    const mainSubFrame = await waitFrameReady(page, '商品档案')
    check((await mainSubFrame.locator('[data-testid=contract-page-main-sub]').count()) === 1, '4b.2 main-sub 配方渲染')
    check((await mainSubFrame.locator('.page-heading').count()) === 1, '4b.3 main-sub 使用 page-heading')
    check(
      (await mainSubFrame.locator('[data-testid=contract-main-sub-form] .form-section').count()) === 2,
      `4b.4 主表表单分组=2（${await mainSubFrame.locator('[data-testid=contract-main-sub-form] .form-section').count()}）`
    )
    check(
      (await mainSubFrame.locator('[data-testid=contract-main-sub-subtables] .el-table').count()) === 1,
      '4b.5 子表渲染 pm-table'
    )
    check(
      (await mainSubFrame.locator('[data-testid=contract-main-sub-tab-0]').count()) === 1 &&
        (await mainSubFrame.locator('[data-testid=contract-main-sub-tab-1]').count()) === 1,
      '4b.6 两个子表显示页签'
    )
    await mainSubFrame.locator('[data-testid=contract-main-sub-tab-1]').click()
    await mainSubFrame.locator('[data-testid=contract-main-sub-table-1] .el-table').waitFor({ state: 'visible', timeout: 10000 })
    const mainSubText = (await mainSubFrame.locator('[data-testid=contract-main-sub-table-1]').innerText()) || ''
    check(mainSubText.includes('供应商编码') && mainSubText.includes('合作状态'), '4b.7 第二个子表列来自实体')

    // ---------- 3c. wizard 模板（P10b：pm-steps + 当前分组 + 上一步/下一步/提交） ----------
    await page.locator('[data-testid=page-chip-product-wizard]').click()
    await waitFrameSrc(page, 'product-wizard')
    const wizardFrame = await waitFrameReady(page, '商品上架向导')
    check((await wizardFrame.locator('[data-testid=contract-page-wizard]').count()) === 1, '4c.1 wizard 配方渲染')
    check((await wizardFrame.locator('[data-testid=contract-wizard-steps] .el-steps').count()) === 1, '4c.2 使用 pm-steps（el-steps）')
    check((await wizardFrame.locator('[data-testid=contract-wizard-steps] .el-step').count()) === 3, '4c.3 步骤数=3（来自 form.groups）')
    const firstStepTitle = (await wizardFrame.locator('[data-testid=contract-wizard-steps] .el-step__title').first().innerText()) || ''
    check(firstStepTitle.includes('基本信息'), `4c.4 步骤标题来自分组（${firstStepTitle.trim()}）`)
    const wizardText = (await wizardFrame.locator('[data-testid=contract-wizard-panel]').innerText()) || ''
    check(wizardText.includes('商品编码') && !wizardText.includes('上架确认'), '4c.5 只渲染当前步骤分组字段')
    check((await wizardFrame.locator('[data-testid=contract-wizard-next]').count()) === 1, '4c.6 首步显示「下一步」')
    // F2（打磨批1）：点击步条第 2 步应同步 v-model（不依赖底部「下一步」）
    await wizardFrame.locator('[data-testid=contract-wizard-steps] .el-step__title').nth(1).click()
    await delay(200)
    const wizardTextByStep = (await wizardFrame.locator('[data-testid=contract-wizard-panel]').innerText()) || ''
    check(
      wizardTextByStep.includes('销售单价') && !wizardTextByStep.includes('商品编码'),
      '4c.6a 点击步条第 2 步切到第二组字段（v-model 同步）'
    )
    check(
      (await wizardFrame.locator('[data-testid=contract-wizard-prev]').count()) === 1,
      '4c.6b 点击步条第 2 步后出现「上一步」'
    )
    // 点回第 1 步验证反向同步，再继续底部按钮流程
    await wizardFrame.locator('[data-testid=contract-wizard-steps] .el-step__title').nth(0).click()
    await delay(200)
    const wizardTextBack = (await wizardFrame.locator('[data-testid=contract-wizard-panel]').innerText()) || ''
    check(
      wizardTextBack.includes('商品编码') && !wizardTextBack.includes('销售单价'),
      '4c.6c 点击步条第 1 步回到首组字段'
    )
    await wizardFrame.locator('[data-testid=contract-wizard-next]').click()
    await delay(200)
    const wizardText2 = (await wizardFrame.locator('[data-testid=contract-wizard-panel]').innerText()) || ''
    check(wizardText2.includes('销售单价') && !wizardText2.includes('商品编码'), '4c.7 点「下一步」切到第二组字段')
    check((await wizardFrame.locator('[data-testid=contract-wizard-prev]').count()) === 1, '4c.8 非首步出现「上一步」')
    await wizardFrame.locator('[data-testid=contract-wizard-next]').click()
    await delay(200)
    check((await wizardFrame.locator('[data-testid=contract-wizard-submit]').count()) === 1, '4c.9 末步显示「提交」')
    await page.screenshot({ path: path.join(shotsDir, 'p10b-wizard.png') })

    // ---------- 3d. 未知类型 + 仅蓝图 → 模板通用兜底（不出现灰阶线框） ----------
    await page.locator('[data-testid=page-chip-product-kanban]').click()
    const genericSrc = await waitFrameSrc(page, 'product-kanban')
    check(genericSrc.includes('page=product-kanban'), '4d.1 未知类型页 iframe 指向 product-kanban')
    const genericFrame = await waitFrameReady(page, '商品看板')
    check((await genericFrame.locator('[data-testid=contract-page-detail]').count()) === 1, '4d.2 按 type 映射到模板详情结构')
    check((await genericFrame.locator('.page-heading').count()) === 1, '4d.3 通用兜底使用 page-heading')
    check((await genericFrame.locator('[data-testid=contract-generic-panel], [data-testid=contract-detail-info]').count()) >= 1, '4d.4 通用兜底渲染 panel/info-grid')
    check((await genericFrame.locator('.wf-page').count()) === 0, '4d.5 不出现 wf-page 灰阶线框')

    // ---------- 4. 自动导出 manifest（3 页） ----------
    const manifestFile = path.join(prototypesDir, '_manifest.json')
    await waitFor(() => fs.existsSync(manifestFile), 90000, '自动导出 prototypes/_manifest.json')
    check(true, '5.1 自动导出 manifest 已写入')
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as {
      designHash: string
      styleId: string
      pages: Record<string, unknown>
    }
    check(manifest.designHash === designHash, '5.2 manifest designHash 与 design.json 一致')
    check(manifest.styleId === 'data-cyan', `5.3 manifest styleId=data-cyan（${manifest.styleId}）`)
    const manifestPages = Object.keys(manifest.pages || {})
    check(manifestPages.length === 6, `5.4 manifest 页数=6（${manifestPages.join(',')}）`)
    check(
      ['overview', 'product-detail', 'product-list', 'product-main-sub', 'product-wizard', 'product-kanban'].every(
        pageId => manifestPages.includes(pageId)
      ),
      '5.5 manifest 含 dashboard/detail/list/main-sub/wizard/未知类型六页'
    )

    // ---------- 5. PNG 真实模板截图（宽高 + 主色像素） ----------
    if (pageAudit.exportWarnings.length) {
      console.log(`[p10-e2e] console warnings：${pageAudit.exportWarnings.join(' | ')}`)
    }
    const overviewPng = path.join(prototypesDir, 'overview.png')
    const detailPng = path.join(prototypesDir, 'product-detail.png')
    const mainSubPng = path.join(prototypesDir, 'product-main-sub.png')
    // 证据：复制到截图目录（临时项目目录结束后会删除）
    fs.copyFileSync(overviewPng, path.join(shotsDir, 'p10-overview.png'))
    fs.copyFileSync(detailPng, path.join(shotsDir, 'p10-product-detail.png'))
    fs.copyFileSync(mainSubPng, path.join(shotsDir, 'p10b-product-main-sub.png'))
    const overviewSample = await samplePng(page, overviewPng)
    console.log(
      `[p10-e2e] overview sample ${overviewSample.width}x${overviewSample.height} cyan=${overviewSample.primaryMatches}`
    )
    check(overviewSample.width > 800, `6.1 overview.png 宽 > 800（实际 ${overviewSample.width}）`)
    check(overviewSample.height > 400, `6.2 overview.png 高 > 400（实际 ${overviewSample.height}）`)
    check(overviewSample.primaryMatches > 0, `6.3 overview.png 存在 data-cyan 主色像素（${overviewSample.primaryMatches}）`)
    const detailSample = await samplePng(page, detailPng)
    check(detailSample.width > 800, `6.4 product-detail.png 宽 > 800（实际 ${detailSample.width}）`)
    check(detailSample.height > 400, `6.5 product-detail.png 高 > 400（实际 ${detailSample.height}）`)
    check(detailSample.primaryMatches > 0, `6.6 product-detail.png 存在 data-cyan 主色像素（${detailSample.primaryMatches}）`)
    const mainSubSample = await samplePng(page, mainSubPng)
    console.log(
      `[p10-e2e] main-sub sample ${mainSubSample.width}x${mainSubSample.height} cyan=${mainSubSample.primaryMatches}`
    )
    check(mainSubSample.width > 800, `6.7 main-sub.png 宽 > 800（实际 ${mainSubSample.width}）`)
    check(mainSubSample.height > 400, `6.8 main-sub.png 高 > 400（实际 ${mainSubSample.height}）`)
    check(mainSubSample.primaryMatches > 0, `6.9 main-sub.png 存在 data-cyan 主色像素（${mainSubSample.primaryMatches}）`)

    // ---------- 6. 契约页不出现结构草图（无切换入口） ----------
    check(
      (await page.locator('[data-testid=prototype-render-mode]').innerText()) === '设计产物 · 模板风格',
      '7.1 契约页始终为设计产物 · 模板风格'
    )
    check((await page.locator('[data-testid=prototype-paper]').count()) === 0, '7.2 契约页不渲染结构草图')
    check((await page.locator('[data-testid^=prototype-mode-]').count()) === 0, '7.3 页面内无模式切换按钮')

    // ---------- 7. 审计 ----------
    if (pageAudit.exportWarnings.length) {
      console.log(`[p10-e2e] 导出警告：${pageAudit.exportWarnings.join(' | ')}`)
    }
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
    if (!closed) console.warn(`[p10-e2e] 警告：临时后端端口 ${port} 仍在监听`)
    else console.log(`[p10-e2e] 临时后端端口 ${port} 已关闭`)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        fs.rmSync(root, { recursive: true, force: true })
        break
      } catch {
        await delay(200)
      }
    }
  }

  console.log(`\n[p10-e2e] 通过：${assertions} 条断言；截图目录 ${shotsDir}`)}

main().catch(error => {
  console.error(`\n[p10-e2e] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
