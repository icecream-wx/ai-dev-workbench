/**
 * P7-6a 开发视图「检查一致性」Playwright 验收（stub 后端，不调用模型）
 *
 * 前置：`npm run build --prefix frontend`。
 * 运行：`npm run e2e:p7-6a --prefix backend`
 *
 * 覆盖：设计参考按钮、API 调用、只读报告（状态/检查项/ui-check）、0 console/page/API error。
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p7-6a-e2e-'))
const stateFile = path.join(root, 'state.json')
const shotsDir = process.env.P7_6A_SHOTS_DIR || path.join(os.tmpdir(), 'workbench-p7-6a-shots')
const port = 3427
const base = `http://127.0.0.1:${port}`
const appId = 'p7-6a-app'

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
  if (!condition) throw new Error(message)
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

async function waitFor(checkFn: () => boolean | Promise<boolean>, timeoutMs: number, label: string): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await checkFn()) return
    await delay(60)
  }
  throw new Error(`等待超时（${timeoutMs}ms）：${label}`)
}

function seedDesign(appDir: string): void {
  const requirements = path.join(appDir, 'docs', 'requirements')
  fs.mkdirSync(requirements, { recursive: true })
  fs.writeFileSync(
    path.join(requirements, 'requirements.md'),
    '---\ntitle: "商品管理"\ntemplate: builtin-prd-lite\n---\n\n# 商品管理\n\n## 1. 目标\n\n维护商品。\n\n### EP-001 商品管理\n',
    'utf8'
  )
  const designDir = path.join(appDir, 'docs', 'design')
  fs.mkdirSync(designDir, { recursive: true })
  fs.writeFileSync(
    path.join(designDir, 'entities.json'),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        entities: [
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
                  { value: 'ON', label: '上架' },
                  { value: 'OFF', label: '下架' }
                ]
              }
            ]
          }
        ],
        relations: []
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  fs.writeFileSync(
    path.join(designDir, 'pages.json'),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        pageSets: [
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
                recipe: 'tree-list',
                catalogRef: 'enterprise-application-platform/organization',
                entity: 'product',
                columns: ['productCode', 'productName', 'status'],
                filters: ['productName', 'status'],
                rowActions: ['detail', 'edit', 'delete'],
                toolbarActions: ['create'],
                selection: true,
                pagination: { layout: 'three-part', pageSize: 20 }
              },
              {
                id: 'product-form',
                name: '商品编辑',
                type: 'form',
                recipe: 'dialog-form',
                blueprint: 'application-types/enterprise-application-platform/pages/ApplicationForm.vue',
                entity: 'product',
                form: {
                  presentation: 'dialog',
                  columns: 2,
                  width: 800,
                  fields: ['productCode', 'productName', 'status']
                }
              }
            ]
          }
        ]
      },
      null,
      2
    )}\n`,
    'utf8'
  )
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
      P2_APP_NAME: 'P7-6a 一致性检查',
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

interface PageAudit {
  consoleErrors: string[]
  pageErrors: string[]
  apiErrors: string[]
}

function audit(page: Page): PageAudit {
  const result: PageAudit = { consoleErrors: [], pageErrors: [], apiErrors: [] }
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (/favicon/i.test(text)) return
    result.consoleErrors.push(text)
  })
  page.on('pageerror', error => result.pageErrors.push(error.message))
  page.on('response', response => {
    const url = response.url()
    if (!url.includes('/api/')) return
    if (response.status() >= 400) result.apiErrors.push(`${response.status()} ${url}`)
  })
  return result
}

async function gotoDev(page: Page): Promise<void> {
  await page.goto(`${base}/#/apps/${appId}/development`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=dev-view]').waitFor({ state: 'visible', timeout: 15000 })
}

async function main(): Promise<void> {
  await startHarness()
  const harnessState = await readState()
  seedDesign(harnessState.appDir)

  const browser: Browser = await chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const pageAudit = audit(page)
    await gotoDev(page)

    check((await page.locator('[data-testid=dev-module-select]').count()) === 0, '1.1 无模块下拉')

    const button = page.locator('[data-testid=dev-fidelity-check]')
    await button.waitFor({ state: 'visible', timeout: 8000 })
    check((await button.innerText()).includes('检查一致性'), '1.2 设计参考面板显示检查按钮')

    await button.click()
    const report = page.locator('[data-testid=dev-fidelity-report]')
    await report.waitFor({ state: 'visible', timeout: 15000 })
    check(true, '2.1 点击后出现一致性报告')

    const statusText = (await page.locator('[data-testid=dev-fidelity-status]').innerText()).trim()
    check(['通过', '有警告', '有失败'].includes(statusText), `2.2 总体状态可读（${statusText}）`)
    const summaryText = await page.locator('[data-testid=dev-fidelity-summary]').innerText()
    check(summaryText.includes('通过') && summaryText.includes('警告'), `2.3 摘要含通过/警告（${summaryText}）`)
    const metaText = await page.locator('[data-testid=dev-fidelity-meta]').innerText()
    check(metaText.includes('应用级'), `2.4 报告标明应用级（${metaText}）`)
    check((await page.locator('[data-testid=dev-fidelity-empty]').count()) === 0, '2.5 有设计时不显示空态')

    const uiCheckItem = page.locator('[data-testid=dev-fidelity-check-ui-check]')
    await uiCheckItem.waitFor({ state: 'visible', timeout: 8000 })
    const uiCheckText = await uiCheckItem.innerText()
    check(uiCheckText.includes('ui-check'), `2.6 报告含 ui-check 项（${uiCheckText}）`)
    check(uiCheckText.includes('警告'), `2.7 ui-check 缺失显示警告（${uiCheckText}）`)
    check(
      uiCheckText.includes('自动生成') || uiCheckText.includes('未生成'),
      `2.7b ui-check 缺失 hint 提示自动生成（${uiCheckText}）`
    )

    const blueprintItem = page.locator('[data-testid=dev-fidelity-check-blueprint-files]')
    await blueprintItem.waitFor({ state: 'visible', timeout: 8000 })
    check((await blueprintItem.innerText()).includes('蓝图文件'), '2.8 报告含蓝图检查项')

    const templateContractItem = page.locator('[data-testid=dev-fidelity-check-template-contract]')
    await templateContractItem.waitFor({ state: 'visible', timeout: 8000 })
    const templateContractText = await templateContractItem.innerText()
    check(templateContractText.includes('模板契约页'), `2.11 报告含模板契约页检查项（${templateContractText}）`)
    check(templateContractText.includes('通过'), `2.12 无契约页引用时模板契约检查通过（${templateContractText}）`)
    check((await report.locator('.fidelity-item').count()) === 14, '2.13 一致性检查共 14 项')

    const apiDesignItem = page.locator('[data-testid=dev-fidelity-check-api-design]')
    await apiDesignItem.waitFor({ state: 'visible', timeout: 8000 })
    const apiDesignText = await apiDesignItem.innerText()
    check(apiDesignText.includes('接口设计'), `2.14 报告含接口设计检查项（${apiDesignText}）`)
    check(apiDesignText.includes('警告') && apiDesignText.includes('未生成'), '2.15 无接口文档时 api-design 为警告')

    const reportText = await report.innerText()
    check(reportText.includes('只读报告'), '2.9 报告标注只读、不自动改代码')
    check(reportText.includes('建议'), '2.10 警告项给出修复建议')

    check(pageAudit.consoleErrors.length === 0, `0 console error（${pageAudit.consoleErrors.join(' | ')}）`)
    check(pageAudit.pageErrors.length === 0, `0 page error（${pageAudit.pageErrors.join(' | ')}）`)
    check(pageAudit.apiErrors.length === 0, `0 意外 API≥400（${pageAudit.apiErrors.join(' | ')}）`)

    await page.screenshot({ path: path.join(shotsDir, 'p7-6a-fidelity.png'), fullPage: false })
    await context.close()
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

  console.log(`\n[p7-6a-e2e] 通过：${assertions} 条断言；截图目录 ${shotsDir}`)
}

main().catch(error => {
  console.error(`\n[p7-6a-e2e] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
