/**
 * P9 设计产物模板风格原生渲染 Playwright 验收（临时目录 + 端口 3446，stub opencode）
 *
 * 前置：`npm run build --prefix frontend`。
 * 运行：`npm run e2e:p9 --prefix backend`
 *
 * 覆盖：设计视图默认「模板风格」iframe（design-preview.html 渲染 design.json 该页）、
 * 模板结构类（optimized-suite / template-stage / business-page / org-ledger-shell）、
 * pm 组件（pm-search/pm-toolbar/pm-table/pm-pagination/pm-tree/pm-form-dialog）、
 * tree-list/list/dialog-form 三种配方、风格主色（data-cyan）、无契约自动结构草图 + 提示（无模式切换按钮）、
 * 0 console/pageerror/请求失败/外部请求。
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type FrameLocator, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const frontendDist = path.resolve(backendDir, '../frontend/dist')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p9-e2e-'))
const stateFile = path.join(root, 'state.json')
const shotsDir = process.env.P9_SHOTS_DIR || path.join(os.tmpdir(), 'workbench-p9-shots')
const port = 3446
const base = `http://127.0.0.1:${port}`
const appId = 'p9-e2e'
const moduleKey = 'MOD-001'
/** data-cyan 主色（templates/design-system pack tokens.primary） */
const CYAN_PRIMARY = 'rgb(20, 95, 186)'

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

/** app1 同构 fixture：operations-management × data-cyan（4 页 + 1 页无契约） */
function designFixture(): Record<string, unknown> {
  const productFields = [
    { name: '商品编码', label: '商品编码', type: 'string', required: true, unique: true },
    { name: '商品名称', label: '商品名称', type: 'string', required: true },
    { name: '商品分类', label: '商品分类', type: 'string' },
    { name: '计量单位', label: '计量单位', type: 'string', required: true },
    { name: '销售单价', label: '销售单价', type: 'decimal', required: true },
    { name: '库存数量', label: '库存数量', type: 'number', required: true },
    { name: '商品状态', label: '商品状态', type: 'enum', required: true, options: ['上架', '下架'] },
    { name: '商品描述', label: '商品描述', type: 'text' },
    { name: '创建时间', label: '创建时间', type: 'datetime' }
  ]
  const detailFields = [
    { name: '明细编号', label: '明细编号', type: 'string', required: true, unique: true },
    { name: '所属商品', label: '所属商品', type: 'ref', ref: 'product', required: true },
    { name: '规格型号', label: '规格型号', type: 'string', required: true },
    { name: '品牌', label: '品牌', type: 'string' },
    { name: '产地', label: '产地', type: 'string' },
    { name: '净含量', label: '净含量', type: 'string' },
    { name: '包装方式', label: '包装方式', type: 'enum', options: ['袋', '盒', '罐', '箱'] },
    { name: '保质期（天）', label: '保质期（天）', type: 'number' },
    { name: '明细说明', label: '明细说明', type: 'text' }
  ]
  return {
    module: moduleKey,
    title: '商品管理',
    designSystem: {
      pack: 'afcenter-app-templates-v1',
      applicationType: 'operations-management',
      style: 'data-cyan'
    },
    entities: [
      { id: 'product', name: '商品', table: 'biz_product', fields: productFields },
      { id: 'productDetail', name: '商品明细', table: 'biz_product_detail', fields: detailFields }
    ],
    relations: [{ from: 'product', to: 'productDetail', type: '1:1', label: '商品对应明细' }],
    pages: [
      {
        id: 'product-list',
        name: '商品列表',
        type: 'list',
        recipe: 'tree-list',
        catalogRef: 'operations-management/treeTable',
        blueprint: 'application-types/operations-management/pages/OperationsTreeTable.vue',
        entity: 'product',
        filters: ['商品名称', '商品编码', '商品状态'],
        columns: ['商品编码', '商品名称', '商品分类', '销售单价', '库存数量', '商品状态'],
        rowActions: ['detail', 'edit', 'delete'],
        toolbarActions: ['create', 'batchDelete'],
        selection: true,
        pagination: { layout: 'three-part', pageSize: 5 },
        tree: { titleField: '商品分类', actionStyle: 'none', selectionStyle: 'platform' },
        components: { 销售单价: 'pm-number', 库存数量: 'pm-number', 商品状态: 'pm-select' },
        actions: ['新增', '编辑', '删除', '批量删除']
      },
      {
        id: 'product-detail-list',
        name: '商品明细列表',
        type: 'list',
        recipe: 'list',
        catalogRef: 'operations-management/list',
        blueprint: 'application-types/operations-management/pages/OperationsList.vue',
        entity: 'productDetail',
        filters: ['明细编号', '所属商品', '包装方式'],
        columns: ['明细编号', '所属商品', '规格型号', '品牌', '产地', '包装方式'],
        rowActions: ['edit', 'delete'],
        toolbarActions: ['create', 'export'],
        selection: false,
        pagination: { layout: 'three-part', pageSize: 5 },
        components: { 所属商品: 'pm-select', 包装方式: 'pm-select', '保质期（天）': 'pm-number' },
        actions: ['新增', '编辑', '删除']
      },
      {
        id: 'product-form',
        name: '商品新增/编辑',
        type: 'form',
        recipe: 'dialog-form',
        entity: 'product',
        form: {
          presentation: 'dialog',
          columns: 2,
          width: 760,
          fields: ['商品编码', '商品名称', '商品分类', '计量单位', '销售单价', '库存数量', '商品状态', '商品描述'],
          groups: [
            { title: '基本信息', fields: ['商品编码', '商品名称', '商品分类', '计量单位'] },
            { title: '价格与库存', fields: ['销售单价', '库存数量', '商品状态', '商品描述'] }
          ]
        },
        components: {
          销售单价: 'pm-number',
          库存数量: 'pm-number',
          商品状态: 'pm-select',
          商品描述: 'pm-textarea'
        },
        actions: ['保存', '取消']
      },
      {
        id: 'product-detail-form',
        name: '商品明细新增/编辑',
        type: 'form',
        recipe: 'dialog-form',
        entity: 'productDetail',
        form: {
          presentation: 'dialog',
          columns: 2,
          width: 760,
          fields: ['明细编号', '所属商品', '规格型号', '品牌', '产地', '净含量', '包装方式', '保质期（天）', '明细说明'],
          groups: [
            { title: '基本信息', fields: ['明细编号', '所属商品', '规格型号', '品牌'] },
            { title: '包装与保质', fields: ['产地', '净含量', '包装方式', '保质期（天）', '明细说明'] }
          ]
        },
        components: { 包装方式: 'pm-select', '保质期（天）': 'pm-number', 明细说明: 'pm-textarea' },
        actions: ['保存', '取消']
      },
      {
        id: 'legacy-local',
        name: '本地列表（无契约）',
        type: 'list',
        entity: 'product',
        columns: ['商品编码', '商品名称', '商品状态']
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
      P2_APP_NAME: 'P9 设计产物模板渲染',
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
    // 切换页面 / 模式下 iframe 卸载，浏览器 abort 上一轮资源不算失败
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

async function main(): Promise<void> {
  check(fs.existsSync(path.join(frontendDist, 'index.html')), 'frontend/dist/index.html 已构建')
  check(fs.existsSync(path.join(frontendDist, 'design-preview.html')), 'frontend/dist/design-preview.html 已构建')

  let browser: Browser | null = null
  let context: BrowserContext | null = null
  try {
    await startHarness()
    const harnessState = await readState()
    const designDir = path.join(harnessState.appDir, 'docs', 'design', moduleKey)

    const created = await request('POST', `/apps/${appId}/requirements-modules`, { title: '商品管理' })
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

    // ---------- 1. 默认进入模板风格（tree-list） ----------
    const frameLocator = page.locator('[data-testid=prototype-preview-frame]')
    await frameLocator.waitFor({ state: 'visible', timeout: 20000 })
    check(true, '1.1 tree-list 页面默认渲染 design-preview.html iframe')
    check((await page.locator('[data-testid=prototype-pages] .page-chip').count()) === 5, '1.2 原型页面 chips=5')
    check(
      (await page.locator('[data-testid=prototype-render-mode]').innerText()) === '设计产物 · 模板风格',
      '1.3 只读状态为「设计产物 · 模板风格」'
    )
    check((await page.locator('[data-testid^=prototype-mode-]').count()) === 0, '1.3b 无「模板风格/线框」切换按钮')
    check(
      ((await page.locator('[data-testid=export-png-btn]').getAttribute('title')) || '').includes('模板风格'),
      '1.4 模板风格模式导出按钮文案为模板风格'
    )
    const exportHint = (await page.locator('[data-testid=prototype-export-hint]').innerText()) || ''
    check(
      exportHint.includes('设计产物') && exportHint.includes('按所选模板渲染'),
      `1.5 提示为设计产物（按所选模板渲染）（${exportHint.replace(/\s+/g, ' ')}）`
    )
    check(exportHint.includes('模板风格截图'), '1.6 提示 PNG 使用模板风格截图')

    const firstSrc = await waitFrameSrc(page, 'product-list')
    check(firstSrc.startsWith('/design-preview.html?'), `1.7 iframe 指向 /design-preview.html（${firstSrc}）`)
    check(firstSrc.includes(`app=${appId}`), '1.8 iframe 含 app 参数')
    check(firstSrc.includes(`module=${moduleKey}`), '1.9 iframe 含 module 参数')
    check(firstSrc.includes('type=operations-management'), '1.10 iframe 含 type=operations-management')
    check(firstSrc.includes('style=data-cyan'), '1.11 iframe 含 style=data-cyan')
    check(firstSrc.includes('embed=1'), '1.12 iframe 含 embed=1')
    check(firstSrc.includes(`v=${designHash}`), '1.13 iframe 含 v=<designHash>')

    // ---------- 2. iframe 内模板结构 / 组件 / 内容 ----------
    const treeFrame = await waitFrameReady(page, '商品列表')
    check(true, '2.1 iframe 渲染 design.json 页面标题「商品列表」')
    check((await treeFrame.locator('.design-preview-root.visual-style-data-cyan').count()) === 1, '2.2 根节点带 visual-style-data-cyan')
    check(
      (await treeFrame.locator('.optimized-suite.application-type-operations').count()) === 1,
      '2.3 根节点带 optimized-suite + application-type-operations'
    )
    check((await treeFrame.locator('.template-stage').count()) === 1, '2.4 模板结构类 template-stage')
    check((await treeFrame.locator('.business-page').count()) >= 1, '2.5 模板结构类 business-page')
    check((await treeFrame.locator('.org-ledger-shell').count()) === 1, '2.6 tree-list 使用 org-ledger-shell')
    check((await treeFrame.locator('.org-tree-panel').count()) === 1, '2.7 tree-list 使用 org-tree-panel')
    check((await treeFrame.locator('.pm-search-wrapper').count()) >= 1, '2.8 pm-search 渲染')
    check((await treeFrame.locator('.pm-toolbar').count()) >= 1, '2.9 pm-toolbar 渲染')
    check((await treeFrame.locator('.contract-table .el-table').count()) === 1, '2.10 pm-table 渲染')
    check((await treeFrame.locator('.el-pagination').count()) === 1, '2.11 pm-pagination 渲染')
    check((await treeFrame.locator('.pm-tree').count()) === 1, '2.12 pm-tree 渲染')
    const treeNodeCount = await treeFrame.locator('.pm-tree .el-tree-node').count()
    check(treeNodeCount >= 2, `2.13 树节点已生成（${treeNodeCount}）`)
    const treeNote = (await treeFrame.locator('[data-testid=contract-tree-note]').innerText()) || ''
    check(treeNote.includes('未配置 parentField'), `2.14 无 parentField 时提示扁平展示（${treeNote}）`)

    const frameText = (await treeFrame.locator('body').innerText()) || ''
    check(frameText.includes('商品编码') && frameText.includes('商品名称'), '2.15 列「商品编码/商品名称」可见')
    check(frameText.includes('销售单价') && frameText.includes('商品状态'), '2.16 列「销售单价/商品状态」可见')
    check(frameText.includes('新增'), '2.17 工具栏「新增」可见')
    check(frameText.includes('每页 5 条'), '2.18 分页显示契约 pageSize=5')
    check((await treeFrame.locator('.contract-table .el-table__row').count()) >= 1, '2.19 表格行来自确定性 mock')

    const primaryBg = await treeFrame
      .locator('.ledger-actions .el-button--primary:not(.is-plain)')
      .first()
      .evaluate(element => getComputedStyle(element).backgroundColor)
    check(primaryBg === CYAN_PRIMARY, `2.20 主按钮为 data-cyan 主色（实际 ${primaryBg}）`)

    await delay(400)
    await page.screenshot({ path: path.join(shotsDir, 'p9-tree-list.png') })

    // ---------- 3. 切到 list ----------
    await page.locator('[data-testid=page-chip-product-detail-list]').click()
    const listSrc = await waitFrameSrc(page, 'product-detail-list')
    check(listSrc.includes('page=product-detail-list'), '3.1 切页后 iframe 指向 product-detail-list')
    const listFrame = await waitFrameReady(page, '商品明细列表')
    check(true, '3.2 list 页面标题「商品明细列表」')
    check((await listFrame.locator('.pm-tree').count()) === 0, '3.3 list 配方无树面板')
    check((await listFrame.locator('.contract-table .el-table').count()) === 1, '3.4 list 配方有表格')
    check((await listFrame.locator('.page-heading').count()) === 1, '3.5 list 配方使用 page-heading')
    const listText = (await listFrame.locator('body').innerText()) || ''
    check(listText.includes('包装方式'), '3.6 list 列来自 design.json')
    await page.screenshot({ path: path.join(shotsDir, 'p9-list.png') })

    // ---------- 4. 切到 dialog-form ----------
    await page.locator('[data-testid=page-chip-product-form]').click()
    await waitFrameSrc(page, 'product-form')
    const formFrame = await waitFrameReady(page, '商品新增/编辑')
    const dialog = formFrame.locator('.el-dialog')
    await dialog.waitFor({ state: 'visible', timeout: 20000 })
    check(true, '4.1 dialog-form 渲染 pm-form-dialog（.el-dialog 可见）')
    const dialogText = (await dialog.innerText()) || ''
    check(dialogText.includes('商品新增/编辑'), '4.2 弹窗标题=页面标题')
    check(dialogText.includes('基本信息') && dialogText.includes('价格与库存'), '4.3 两个表单分组可见')
    check((await dialog.locator('.form-section').count()) === 2, '4.4 表单分组数量=2')
    check((await dialog.locator('.component_number_class').count()) >= 2, '4.5 字段使用 pm-number')
    check((await dialog.locator('.pm-select-base').count()) >= 1, '4.6 字段使用 pm-select')
    check((await dialog.locator('.pm-textarea-root').count()) >= 1, '4.7 字段使用 pm-textarea')
    check(dialogText.includes('商品编码') && dialogText.includes('销售单价'), '4.8 字段来自实体')
    const dialogWidth = await dialog.evaluate(element => parseFloat(getComputedStyle(element).width))
    check(Math.abs(dialogWidth - 760) <= 40, `4.9 弹窗宽度≈契约 760（实际 ${dialogWidth}）`)
    await delay(600)
    await page.screenshot({ path: path.join(shotsDir, 'p9-dialog-form.png') })

    // ---------- 5. 第二个弹窗页 ----------
    await page.locator('[data-testid=page-chip-product-detail-form]').click()
    await waitFrameSrc(page, 'product-detail-form')
    const detailFormFrame = await waitFrameReady(page, '商品明细新增/编辑')
    const detailDialogText = (await detailFormFrame.locator('.el-dialog').first().innerText()) || ''
    check(detailDialogText.includes('包装与保质'), '5.1 第二个弹窗页分组来自各自 design.json')
    check((await detailFormFrame.locator('.el-dialog .pm-select-base').count()) >= 1, '5.2 第二个弹窗页控件映射生效')

    // ---------- 6. 契约页不出现结构草图（无切换入口） ----------
    check((await page.locator('[data-testid=prototype-paper]').count()) === 0, '6.1 契约页不渲染结构草图')
    check((await page.locator('[data-testid=zoom-100]').count()) === 0, '6.2 模板模式不显示缩放组（缩放只属于结构草图）')

    // ---------- 7. 无契约页 → 自动结构草图 + 说明（不提供切换） ----------
    await page.locator('[data-testid=page-chip-legacy-local]').click()
    await page.locator('[data-testid=prototype-panel] [data-testid=prototype-paper]').waitFor({ state: 'visible', timeout: 15000 })
    check(true, '7.1 无 recipe/catalogRef/blueprint 的页面自动结构草图')
    const legacyHint = (await page.locator('[data-testid=prototype-page-hint]').innerText()) || ''
    check(
      legacyHint.includes('没有显式设计契约') && legacyHint.includes('补齐契约后自动套模板'),
      `7.2 提示缺少显式契约并说明补齐后自动套模板（${legacyHint.replace(/\s+/g, ' ')}）`
    )
    check((await page.locator('[data-testid^=prototype-mode-]').count()) === 0, '7.3 无契约页同样没有模式切换按钮')
    check(
      (await page.locator('[data-testid=prototype-render-mode]').innerText()) === '结构草图（无契约）',
      '7.4 无契约页只读状态为「结构草图（无契约）」'
    )
    check((await page.locator('[data-testid=prototype-preview-frame]').count()) === 0, '7.5 无契约页不渲染 iframe')
    check((await page.locator('[data-testid=zoom-100]').count()) === 1, '7.6 结构草图保留缩放组')

    // ---------- 8. 切回有契约页面 → 自动回到设计产物 ----------
    await page.locator('[data-testid=page-chip-product-list]').click()
    await frameLocator.waitFor({ state: 'visible', timeout: 15000 })
    await waitFrameSrc(page, 'product-list')
    check(
      (await page.locator('[data-testid=prototype-render-mode]').innerText()) === '设计产物 · 模板风格',
      '8.1 切回有契约页面自动显示设计产物'
    )
    check((await page.locator('[data-testid=prototype-page-hint]').count()) === 0, '8.2 模板模式不显示回退提示')
    check((await page.locator('[data-testid=prototype-paper]').count()) === 0, '8.3 模板模式无结构草图画布')

    // ---------- 9. 审计 ----------
    check(pageAudit.consoleErrors.length === 0, `9.1 0 console error（${pageAudit.consoleErrors.join(' | ')}）`)
    check(pageAudit.pageErrors.length === 0, `9.2 0 pageerror（${pageAudit.pageErrors.join(' | ')}）`)
    check(pageAudit.failedRequests.length === 0, `9.3 0 请求失败（${pageAudit.failedRequests.join(' | ')}）`)
    check(pageAudit.externalRequests.length === 0, `9.4 0 外部请求（${pageAudit.externalRequests.join(' | ')}）`)

    await context.close()
    context = null
  } finally {
    await context?.close().catch(() => undefined)
    await browser?.close().catch(() => undefined)
    stopHarness()
    const closed = await portClosed()
    if (!closed) console.warn(`[p9-e2e] 警告：临时后端端口 ${port} 仍在监听`)
    else console.log(`[p9-e2e] 临时后端端口 ${port} 已关闭`)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        fs.rmSync(root, { recursive: true, force: true })
        break
      } catch {
        await delay(200)
      }
    }
  }

  console.log(`\n[p9-e2e] 通过：${assertions} 条断言；截图目录 ${shotsDir}`)
}

main().catch(error => {
  console.error(`\n[p9-e2e] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
