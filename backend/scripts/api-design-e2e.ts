/**
 * D2 接口设计 Tab Playwright 验收（stub opencode + 临时目录/独立端口 3449）
 *
 * 覆盖：API Tab、Markdown 渲染、索引/覆盖摘要、错误提示与「让 AI 修」只填不发、
 * 无文档空态、非法文档错误态、0 console/pageerror/请求失败/外部请求。
 */
import assert from 'node:assert/strict'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-api-design-e2e-'))
const stateFile = path.join(root, 'state.json')
const shotsDir = process.env.API_DESIGN_SHOTS_DIR || path.join(os.tmpdir(), 'workbench-api-design-shots')
const port = 3449
const base = `http://127.0.0.1:${port}`
const appId = 'api-design-e2e'
const example = path.resolve(
  backendDir,
  '../templates/agent/skills/adw-api-design/references/api-design-example.md'
)

fs.mkdirSync(shotsDir, { recursive: true })

interface HarnessState {
  appId: string
  appDir: string
  projectsDir: string
  ready?: boolean
  prompts: Array<{ text: string }>
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

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
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
      P2_APP_NAME: 'D2 接口设计',
      P2_API_DESIGN_FIX_FILE: example,
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
  await waitFor(() => fs.existsSync(stateFile) && fs.readFileSync(stateFile, 'utf8').includes('"appId"'), 60000, 'harness 状态文件')
  await waitFor(async () => {
    try {
      return (await fetch(`${base}/api/health`)).ok
    } catch {
      return false
    }
  }, 60000, 'harness /api/health')
  await waitFor(async () => (await readState()).ready === true, 60000, 'harness 应用就绪')
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

function seed(appDir: string): void {
  write(
    path.join(appDir, 'docs/requirements/requirements.md'),
    '---\ntitle: 商品管理应用\ntemplate: builtin-prd\n---\n\n# 商品管理应用\n\n### EP-001 商品管理\n'
  )
  write(
    path.join(appDir, 'docs/design/entities.json'),
    json({
      schemaVersion: 2,
      entities: [
        {
          id: 'goods',
          name: '商品',
          fields: [
            { code: 'id', name: 'ID', type: 'string' },
            { code: 'goodsCode', name: '商品编码', type: 'string' },
            { code: 'name', name: '商品名称', type: 'string' },
            {
              code: 'status',
              name: '状态',
              type: 'enum',
              options: [
                { value: 'ON_SALE', label: '上架' },
                { value: 'OFF_SALE', label: '下架' }
              ]
            },
            { code: 'price', name: '售价', type: 'decimal' },
            { code: 'stock', name: '库存', type: 'number' }
          ]
        }
      ],
      relations: []
    })
  )
  write(
    path.join(appDir, 'docs/design/pages.json'),
    json({
      schemaVersion: 2,
      pageSets: [
        {
          id: 'goods',
          epic: 'EP-001',
          title: '商品管理',
          primaryEntity: 'goods',
          pages: [
            {
              id: 'goods-list',
              name: '商品列表',
              type: 'list',
              entity: 'goods',
              rowActions: ['detail', 'edit', 'delete'],
              toolbarActions: ['create', 'batchDelete', 'export']
            },
            { id: 'goods-form', name: '商品表单', type: 'form', entity: 'goods' }
          ]
        }
      ]
    })
  )
  fs.copyFileSync(example, path.join(appDir, 'docs/design/api-design.md'))
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

async function gotoApiTab(page: Page): Promise<void> {
  await page.goto(`${base}/#/apps/${appId}/design`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=design-view]').waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('[data-testid=design-tab-api]').click()
}

async function main(): Promise<void> {
  const browser: Browser = await chromium.launch()
  try {
    await startHarness()
    const state = await readState()
    seed(state.appDir)

    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()
    const pageAudit = audit(page)
    await gotoApiTab(page)

    // 1. 文档渲染 + 摘要
    await page.locator('[data-testid=api-design-panel]').waitFor({ state: 'visible', timeout: 15000 })
    const summary = await page.locator('[data-testid=api-design-summary]').innerText()
    check(summary.includes('接口 8') && summary.includes('Epic 1'), `1.1 摘要接口/Epic（${summary}）`)
    check(summary.includes('页面动作覆盖 7/7'), `1.2 摘要页面动作覆盖（${summary}）`)
    check(summary.includes('校验通过'), `1.3 摘要校验通过（${summary}）`)
    const doc = page.locator('[data-testid=api-design-doc]')
    await doc.waitFor({ state: 'visible', timeout: 10000 })
    const docText = await doc.innerText()
    check(docText.includes('商品管理应用 · 接口设计'), '1.4 Markdown 渲染标题')
    check(docText.includes('goods.list'), '1.5 渲染接口索引')
    check(docText.includes('接口详情'), '1.6 渲染接口详情')
    check((await page.locator('[data-testid=api-design-issues]').count()) === 0, '1.7 无错误/警告时不显示问题条')
    fs.copyFileSync(path.join(state.appDir, 'docs/design/api-design.md'), path.join(shotsDir, 'api-design.md'))
    await page.screenshot({ path: path.join(shotsDir, 'api-design-tab.png') })
    await context.close()

    // 2. 非法文档：错误提示 + 让 AI 修一键发送 + 修复状态
    const badContext = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const badPage = await badContext.newPage()
    const badAudit = audit(badPage)
    const file = path.join(state.appDir, 'docs/design/api-design.md')
    const original = fs.readFileSync(file, 'utf8')
    write(file, original.replace('| goods.list | GET | /api/goods |', '| goods.list | GET | /goods |'))
    await gotoApiTab(badPage)
    await badPage.locator('[data-testid=api-design-issues]').waitFor({ state: 'visible', timeout: 10000 })
    const issueText = await badPage.locator('[data-testid=api-design-issues]').innerText()
    check(issueText.includes('路径必须以 /api 开头'), `2.1 显示校验错误（${issueText.replace(/\s+/g, ' ')}）`)
    check((await badPage.locator('[data-testid=api-design-doc]').count()) === 1, '2.2 有错误时仍渲染 Markdown（不白屏）')
    const promptsBefore = (await readState()).prompts.length
    await badPage.locator('[data-testid=api-design-fix]').click()
    await waitFor(async () => (await readState()).prompts.length > promptsBefore, 15000, '让 AI 修自动发送 prompt')
    const fixPrompt = (await readState()).prompts[(await readState()).prompts.length - 1]?.text ?? ''
    check(
      fixPrompt.includes('api-design.md') && fixPrompt.includes('路径必须以 /api 开头'),
      `2.3 自动发送的 prompt 含文档与错误原因（${fixPrompt.slice(0, 120)}）`
    )
    await waitFor(
      async () =>
        ((await badPage.locator('[data-testid=api-design-fix-status]').innerText().catch(() => '')) || '').includes(
          '正在修复'
        ),
      10000,
      '接口修复状态条显示正在修复'
    )
    check(true, '2.4 修复中状态条可见')
    await waitFor(
      async () => ((await badPage.locator('[data-testid=chat-status]').innerText().catch(() => '')) || '').includes('运行中'),
      10000,
      '左侧对话显示运行中'
    )
    check(true, '2.5 左侧对话显示运行中')
    await waitFor(
      async () =>
        ((await badPage.locator('[data-testid=api-design-fix-status]').innerText().catch(() => '')) || '').includes(
          '修复完成'
        ),
      20000,
      '修复完成状态'
    )
    const fixedSummary = await badPage.locator('[data-testid=api-design-fix-status]').innerText()
    check(fixedSummary.includes('修复完成'), `2.6 修复完成摘要（${fixedSummary.replace(/\s+/g, ' ')}）`)
    await waitFor(
      async () => (await badPage.locator('[data-testid=api-design-issues]').count()) === 0,
      10000,
      '修复后问题条消失'
    )
    check(true, '2.7 修复后问题条消失（剩余 0 警告）')
    await badAuditCheck(badAudit)
    await badContext.close()

    // 3. 无文档空态
    const emptyContext = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const emptyPage = await emptyContext.newPage()
    const emptyAudit = audit(emptyPage)
    fs.rmSync(file, { force: true })
    await gotoApiTab(emptyPage)
    await emptyPage.locator('[data-testid=api-design-empty]').waitFor({ state: 'visible', timeout: 10000 })
    check((await emptyPage.locator('[data-testid=api-design-summary]').innerText()).includes('接口设计未生成'), '3.1 空态摘要')
    check((await emptyPage.locator('[data-testid=api-design-empty-generate]').count()) === 1, '3.2 空态可生成接口设计')
    await pageScreenshot(emptyPage, 'api-design-empty.png')
    await auditCheck(emptyAudit)
    await emptyContext.close()

    await auditCheck(pageAudit)
    console.log(`\n[api-design-e2e] 通过：${assertions} 条断言；截图目录 ${shotsDir}`)
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
}

async function pageScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(shotsDir, name), fullPage: false })
}

function auditCheck(result: PageAudit): void {
  check(result.consoleErrors.length === 0, `0 console error（${result.consoleErrors.join(' | ')}）`)
  check(result.pageErrors.length === 0, `0 page error（${result.pageErrors.join(' | ')}）`)
  check(result.failedRequests.length === 0, `0 请求失败（${result.failedRequests.join(' | ')}）`)
  check(result.externalRequests.length === 0, `0 外部请求（${result.externalRequests.join(' | ')}）`)
}

async function badAuditCheck(result: PageAudit): Promise<void> {
  auditCheck(result)
}

main().catch(error => {
  console.error(`\n[api-design-e2e] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
