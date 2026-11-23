/**
 * P7-4b 线框渲染器消费页面契约 Playwright 验收（临时目录 + 端口 3444，stub opencode）
 *
 * 前置：`npm run build --prefix frontend`。
 * 运行：`npm run e2e:p7-4b --prefix backend`
 *
 * 覆盖：树列表（左侧树 + 右表 / dot 选中 / 树头动作）、three-part 分页、批量条、
 * 行/工具栏操作、弹窗表单（720 宽 / 单列 / 两分组 / pm-switch / pm-select-user）、
 * 子表页签、两页 PNG 导出，0 console/pageerror/请求失败/外部请求。
 * P11 起用 `?prototype=wireframe` 调试参数强制结构草图（用户界面不再有线框切换）。
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const frontendDist = path.resolve(backendDir, '../frontend/dist')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p7-4b-e2e-'))
const stateFile = path.join(root, 'state.json')
const shotsDir = process.env.P7_4B_SHOTS_DIR || path.join(os.tmpdir(), 'workbench-p7-4b-shots')
const port = 3444
const base = `http://127.0.0.1:${port}`
const appId = 'p7-4b-e2e'
const moduleKey = 'MOD-001'

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
    await delay(80)
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

function designFixture(): Record<string, unknown> {
  const orgFields = [
    { name: '机构名称', label: '机构名称', type: 'string', required: true },
    { name: '机构编码', label: '机构编码', type: 'string', unique: true },
    { name: '上级机构', label: '上级机构', type: 'string' },
    { name: '负责人', label: '负责人', type: 'string' },
    { name: '状态', label: '状态', type: 'enum', options: ['启用', '停用'] },
    { name: '排序号', label: '排序号', type: 'number' }
  ]
  const employeeFields = [
    { name: '员工姓名', label: '员工姓名', type: 'string' },
    { name: '所属机构', label: '所属机构', type: 'ref' },
    { name: '在职状态', label: '在职状态', type: 'enum', options: ['在职', '离职'] }
  ]
  return {
    module: moduleKey,
    title: '组织与人员',
    designSystem: {
      pack: 'afcenter-app-templates-v1',
      applicationType: 'enterprise-application-platform',
      style: 'platform-blue'
    },
    entities: [
      { id: 'org', name: '机构', fields: orgFields },
      { id: 'employee', name: '员工', fields: employeeFields }
    ],
    relations: [
      { from: 'org', to: 'org', type: '1:N', label: '下级机构' },
      { from: 'employee', to: 'org', type: 'N:1', label: '所属机构' },
      { from: 'org', to: 'employee', type: '1:N', label: '员工' }
    ],
    pages: [
      {
        id: 'org-list',
        name: '组织与人员',
        type: 'list',
        entity: 'org',
        recipe: 'tree-list',
        catalogRef: 'enterprise-application-platform/organization',
        blueprint: 'application-types/enterprise-application-platform/pages/OrganizationUsers.vue',
        filters: ['机构名称', '机构编码', '状态'],
        columns: ['机构名称', '机构编码', '上级机构', '负责人', '状态'],
        rowActions: ['detail', 'edit', 'disable'],
        toolbarActions: ['create', 'import', 'batchDelete'],
        selection: true,
        pagination: { layout: 'three-part', pageSize: 5 },
        tree: { titleField: '机构名称', parentField: '上级机构', actionStyle: 'header', selectionStyle: 'dot' },
        components: { 状态: 'pm-select' }
      },
      {
        id: 'org-form',
        name: '新建/编辑机构',
        type: 'form',
        entity: 'org',
        recipe: 'dialog-form',
        form: {
          presentation: 'dialog',
          columns: 1,
          width: 720,
          fields: ['机构名称', '机构编码', '上级机构', '负责人', '状态', '排序号'],
          groups: [
            { title: '基本信息', fields: ['机构名称', '机构编码', '上级机构'] },
            { title: '其他信息', fields: ['负责人', '状态', '排序号'] }
          ]
        },
        subTables: [
          { entity: 'employee', title: '员工', columns: ['员工姓名', '所属机构', '在职状态'], mode: 'tab' },
          { entity: 'org', title: '下级机构', columns: ['机构名称', '机构编码', '状态'], mode: 'tab' }
        ],
        components: { 状态: 'pm-switch', 负责人: 'pm-select-user' }
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
      P2_APP_NAME: 'P7-4b 渲染器',
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

function pngSize(file: string): { width: number; height: number } {
  const buffer = fs.readFileSync(file)
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

async function exportPng(
  page: Page,
  filename: string,
  prototypesDir: string
): Promise<{ file: string; width: number; height: number }> {
  const pageId = filename.startsWith(`${moduleKey}-`) ? filename.slice(moduleKey.length + 1).replace(/\.png$/, '') : filename.replace(/\.png$/, '')
  const file = path.join(prototypesDir, `${pageId}.png`)
  const before = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0
  await page.locator('[data-testid=export-png-btn]').click()
  // P10：按钮改为整包导出（模板优先/线框兜底），通过 PNG 重写 + 状态文案断言
  await waitFor(() => fs.existsSync(file) && fs.statSync(file).mtimeMs > before, 90000, `整包导出重写 ${pageId}.png`)
  const status = (await page.locator('[data-testid=design-prototype-status]').innerText()) || ''
  check(status.includes('2 页'), `整包导出后状态为 2 页（${status.replace(/\s+/g, ' ')}）`)
  check(fs.existsSync(file) && fs.statSync(file).size > 2000, `PNG 已写入且非空：${pageId}.png`)
  return { file, ...pngSize(file) }
}

async function gotoDesign(page: Page): Promise<void> {
  // P11：线框只在无契约/调试出现；本脚本用查询参数强制结构草图（UI 不再提供「线框」切换）
  await page.goto(`${base}/?prototype=wireframe#/apps/${appId}/design`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=design-view]').waitFor({ state: 'visible', timeout: 20000 })
}

async function main(): Promise<void> {
  check(fs.existsSync(path.join(frontendDist, 'index.html')), 'frontend/dist/index.html 已构建')

  await startHarness()
  const harnessState = await readState()
  const designDir = path.join(harnessState.appDir, 'docs', 'design', moduleKey)

  const created = await request('POST', `/apps/${appId}/requirements-modules`, { title: '组织与人员' })
  check(created.status === 201, '准备需求模块 MOD-001')
  fs.mkdirSync(designDir, { recursive: true })
  fs.writeFileSync(
    path.join(designDir, 'design.json'),
    `${JSON.stringify(designFixture(), null, 2)}\n`,
    'utf8'
  )

  const browser: Browser = await chromium.launch()
  let context: BrowserContext | null = null
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()
    const pageAudit = audit(page)

    await gotoDesign(page)
    await page.locator('[data-testid=design-module-MOD-001]').waitFor({ state: 'visible', timeout: 20000 })
    await page.locator('[data-testid=design-module-MOD-001]').click()
    await page.locator('[data-testid=design-tab-prototype]').click()
    // P11：调试参数 `?prototype=wireframe` 持续强制结构草图，切页不再需要点「线框」
    await page.locator('[data-testid=prototype-paper]').waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('[data-testid=prototype-pages] .page-chip').first().waitFor({ state: 'visible', timeout: 8000 })

    // ---------- 1. 两页 chips + 树列表 ----------
    check(
      (await page.locator('[data-testid=prototype-pages] .page-chip').count()) === 2 &&
        (await page.locator('[data-testid^=prototype-mode-]').count()) === 0,
      '1.1 原型两页 chips 且无「模板风格/线框」切换按钮'
    )
    check(
      (await page.locator('[data-testid=page-chip-org-list]').count()) === 1 &&
        (await page.locator('[data-testid=prototype-render-mode]').innerText()) === '调试 · 结构草图',
      '1.2 树列表页 chip 存在；调试标识为「调试 · 结构草图」'
    )

    const tree = page.locator('[data-testid=wf-tree]')
    await tree.waitFor({ state: 'visible', timeout: 10000 })
    check(true, '2.1 左侧树面板 wf-tree 可见')
    const treeNodes = page.locator('[data-testid=wf-tree-node]')
    const nodeCount = await treeNodes.count()
    check(nodeCount >= 2, `2.2 树节点已渲染（${nodeCount}）`)
    const selectedNode = page.locator('[data-testid=wf-tree-node].is-selected')
    check((await selectedNode.count()) === 1, '2.3 树有且仅有一个选中节点')
    const selectedClass = (await selectedNode.getAttribute('class')) || ''
    check(selectedClass.includes('style-dot'), `2.4 选中样式类为 dot（${selectedClass}）`)
    check((await page.locator('[data-testid=wf-tree-action]').count()) >= 1, '2.5 树头动作存在')

    const paperText = await page.locator('[data-testid=prototype-paper]').innerText()
    check(paperText.includes('机构名称') && paperText.includes('负责人'), '3.1 右侧表格列渲染')
    const rowChecks = page.locator('[data-testid=wf-row-check]')
    check((await rowChecks.count()) === 5, `3.2 pagination.pageSize=5 生效（${await rowChecks.count()} 行）`)
    check((await page.locator('[data-testid=wf-row-actions]').first().innerText()).includes('停用'), '3.3 行操作含停用（disable）')
    const toolbarText = await page.locator('[data-wf-anchor=toolbar]').innerText()
    check(toolbarText.includes('新增') && toolbarText.includes('导入'), '3.4 工具栏含新增/导入')
    check((await page.locator('[data-wf-anchor=toolbar] .wf-btn-primary').innerText()).includes('新增'), '3.5 create 为主按钮')
    check((await page.locator('[data-testid=wf-batch-bar]').count()) === 0, '3.6 未选择时无批量条')

    const pager = page.locator('[data-wf-anchor=pager]')
    const pagerText = await pager.innerText()
    check(pagerText.includes('条/页'), `3.7 three-part 显示每页条数（${pagerText.replace(/\s+/g, ' ')}）`)
    check(pagerText.includes('共'), '3.8 three-part 显示总数')

    // ---------- 2. 选择 → 批量条 ----------
    await rowChecks.first().click()
    const batchBar = page.locator('[data-testid=wf-batch-bar]')
    await batchBar.waitFor({ state: 'visible', timeout: 5000 })
    check(true, '4.1 勾选后出现批量条')
    const batchText = await batchBar.innerText()
    check(batchText.includes('已选 1 项'), `4.2 批量条显示已选数量（${batchText.replace(/\s+/g, ' ')}）`)
    check(batchText.includes('批量删除'), '4.3 批量条含 batchDelete')
    check((await pager.innerText()).includes('已选 1 项'), '4.4 three-part 左侧已选数量')

    // ---------- 3. 树节点切换只改高亮，不改表格 ----------
    await treeNodes.nth(1).click()
    await delay(150)
    const newSelected = page.locator('[data-testid=wf-tree-node].is-selected')
    check((await newSelected.count()) === 1 && (await newSelected.getAttribute('class'))?.includes('style-dot'), '5.1 点击树节点切换选中')
    check((await page.locator('[data-testid=wf-row-check]').count()) === 5, '5.2 树节点点击不改变表格数据')

    // ---------- 4. 树页 PNG 导出 ----------
    await waitFor(
      async () => (await page.locator('[data-testid=design-prototype-status]').innerText()).includes('2 页'),
      30000,
      '自动导出两页完成'
    )
    check(true, '6.1 自动导出两页完成')
    const treePng = await exportPng(page, `${moduleKey}-org-list.png`, path.join(designDir, 'prototypes'))
    check(treePng.width > 500 && treePng.height > 200, `6.2 树页 PNG 尺寸 ${treePng.width}x${treePng.height}`)

    // ---------- 5. 弹窗表单 ----------
    await page.locator('[data-testid=page-chip-org-form]').click()
    const dialog = page.locator('[data-testid=wf-dialog]')
    await dialog.waitFor({ state: 'visible', timeout: 10000 })
    check(true, '7.1 弹窗表单 wf-dialog 可见')
    const dialogStyle = (await dialog.getAttribute('style')) || ''
    check(/width:\s*720px/.test(dialogStyle), `7.2 弹窗宽度 720（${dialogStyle}）`)
    check((await dialog.locator('.wf-dialog-title').innerText()).includes('新建/编辑机构'), '7.3 弹窗标题=页面标题')
    check((await dialog.locator('.wf-form-section-title').count()) === 2, '7.4 两个表单分组')
    const groupText = await dialog.locator('.wf-form-section-title').first().innerText()
    check(groupText.includes('基本信息'), '7.5 分组标题为基本信息')
    check((await dialog.locator('[data-wf-anchor="field:状态"] .wf-switch').count()) === 1, '7.6 pm-switch 映射为开关')
    check(
      (await dialog.locator('[data-wf-anchor="field:负责人"] .wf-select .wf-ctl-icon').count()) === 1,
      '7.7 pm-select-user 映射为人员选择控件'
    )
    const fieldStyles = await dialog.locator('.wf-field').evaluateAll(nodes =>
      nodes.map(node => (node as HTMLElement).getAttribute('style') || '')
    )
    check(fieldStyles.length === 6 && fieldStyles.every(style => style.includes('span 24')), `7.8 form.columns=1 单列（${fieldStyles.length} 字段）`)

    const subtabs = page.locator('[data-testid=wf-subtabs]')
    await subtabs.waitFor({ state: 'visible', timeout: 8000 })
    check((await page.locator('[data-testid^=wf-subtab-]').count()) === 2, '8.1 两个子表页签')
    const subtabText = await subtabs.innerText()
    check(subtabText.includes('员工') && subtabText.includes('下级机构'), `8.2 子表页签标题（${subtabText.replace(/\s+/g, ' ')}）`)
    await page.locator('[data-testid=wf-subtab-1]').click()
    await delay(150)
    check(((await page.locator('[data-testid=wf-subtab-1]').getAttribute('class')) || '').includes('on'), '8.3 页签切换选中态')
    check(await page.locator('[data-wf-anchor="subtable:1"]').isVisible(), '8.4 激活页签的子表可见')
    check(!(await page.locator('[data-wf-anchor="subtable:0"]').isVisible()), '8.5 未激活页签的子表隐藏')
    const footerText = await dialog.locator('[data-wf-anchor=footer]').innerText()
    check(footerText.includes('取消') && footerText.includes('提交'), '8.6 弹窗底部取消/提交')

    // ---------- 6. 弹窗页 PNG 导出 ----------
    const formPng = await exportPng(page, `${moduleKey}-org-form.png`, path.join(designDir, 'prototypes'))
    check(formPng.width > 500 && formPng.height > 200, `9.1 弹窗页 PNG 尺寸 ${formPng.width}x${formPng.height}`)

    // ---------- 7. 审计 ----------
    check(pageAudit.consoleErrors.length === 0, `10.1 0 console error（${pageAudit.consoleErrors.join(' | ')}）`)
    check(pageAudit.pageErrors.length === 0, `10.2 0 pageerror（${pageAudit.pageErrors.join(' | ')}）`)
    check(pageAudit.failedRequests.length === 0, `10.3 0 请求失败（${pageAudit.failedRequests.join(' | ')}）`)
    check(pageAudit.externalRequests.length === 0, `10.4 0 外部请求（${pageAudit.externalRequests.join(' | ')}）`)

    await page.screenshot({ path: path.join(shotsDir, 'p7-4b-dialog.png'), fullPage: false })
    await page.locator('[data-testid=page-chip-org-list]').click()
    // 调试参数持续生效：回到 org-list 仍是结构草图
    await page.locator('[data-testid=wf-tree]').waitFor({ state: 'visible', timeout: 8000 })
    await page.screenshot({ path: path.join(shotsDir, 'p7-4b-tree.png'), fullPage: false })

    await context.close()
    context = null
  } finally {
    await context?.close().catch(() => undefined)
    await browser.close().catch(() => undefined)
    stopHarness()
    const closed = await portClosed()
    if (!closed) console.warn(`[p7-4b-e2e] 警告：临时后端端口 ${port} 仍在监听`)
    else console.log(`[p7-4b-e2e] 临时后端端口 ${port} 已关闭`)
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        fs.rmSync(root, { recursive: true, force: true })
        break
      } catch {
        await delay(200)
      }
    }
  }

  console.log(`\n[p7-4b-e2e] 通过：${assertions} 条断言；截图目录 ${shotsDir}`)
}

main().catch(error => {
  console.error(`\n[p7-4b-e2e] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
