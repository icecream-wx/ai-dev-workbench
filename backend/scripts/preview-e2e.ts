/**
 * P7-3a 预览宿主 Playwright 验收（临时端口 + 临时数据目录，不占用 3300）。
 *
 * 前置：`npm run build --prefix frontend`、`npm run build --prefix backend`。
 * 运行：`npm run e2e:preview --prefix backend`
 *
 * 覆盖：
 * 1. 后端静态托管 /preview.html 与 /assets（缺失时不回落 index.html）
 * 2. 4 个应用类型 × 代表页面
 * 3. 4 种视觉风格切换（不重建页面，输入态保留）
 * 4. pm-tree 仅当前节点高亮
 * 5. 非法参数回退提示
 * 6. 全程 0 console error / 0 pageerror / 0 外部请求
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const frontendDist = path.resolve(backendDir, '../frontend/dist')
const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-preview-e2e-'))
const shotsDir =
  process.env.P7_3A_SHOTS_DIR || 'C:\\Users\\icecream\\AppData\\Local\\Temp\\opencode'

fs.mkdirSync(shotsDir, { recursive: true })

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
    audit.failedRequests.push(`${request.url()} ${request.failure()?.errorText || ''}`)
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
  checkEqual(audit.consoleErrors.length, 0, `${label} console error 为 0`)
  checkEqual(audit.pageErrors.length, 0, `${label} pageerror 为 0`)
  checkEqual(audit.failedRequests.length, 0, `${label} 请求失败为 0`)
  checkEqual(audit.externalRequests.length, 0, `${label} 外部请求为 0`)
}

async function openPreview(
  context: BrowserContext,
  base: string,
  query: string
): Promise<{ page: Page; audit: PageAudit }> {
  const page = await context.newPage()
  const audit = auditPage(page)
  await page.goto(`${base}/preview.html?${query}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  return { page, audit }
}

async function main(): Promise<void> {
  check(fs.existsSync(path.join(frontendDist, 'preview.html')), 'frontend/dist/preview.html 已构建')
  check(fs.existsSync(path.join(backendDir, 'dist/index.js')), 'backend/dist/index.js 已构建')

  const port = await freePort(3428)
  const opencodePort = await freePort(4795)
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

  // ---- 1. 后端静态托管 ----
  const previewResp = await fetch(`${base}/preview.html`)
  checkEqual(previewResp.status, 200, '/preview.html 返回 200')
  const previewHtml = await previewResp.text()
  check(previewHtml.includes('id="app"'), '/preview.html 是预览入口（含 #app）')

  const assetsDir = path.join(frontendDist, 'assets')
  const firstAsset = fs.readdirSync(assetsDir).find(name => name.endsWith('.js'))
  check(Boolean(firstAsset), 'dist/assets 存在 js 产物')
  const assetResp = await fetch(`${base}/assets/${firstAsset}`)
  checkEqual(assetResp.status, 200, '/assets/* 由静态中间件托管')

  const previewFile = path.join(frontendDist, 'preview.html')
  const parked = `${previewFile}.e2e-bak`
  try {
    fs.renameSync(previewFile, parked)
    const missingResp = await fetch(`${base}/preview.html`)
    checkEqual(missingResp.status, 404, 'preview.html 缺失时返回 404')
    const missingBody = await missingResp.text()
    check(missingBody.includes('preview.html'), 'preview.html 缺失时返回清晰提示')
    check(!missingBody.includes('<!doctype html'), 'preview.html 缺失时不回落 index.html')
  } finally {
    fs.renameSync(parked, previewFile)
  }

  const previewAgain = await fetch(`${base}/preview.html`)
  checkEqual(previewAgain.status, 200, 'preview.html 恢复后仍可访问')

  const indexResp = await fetch(`${base}/`)
  checkEqual(indexResp.status, 200, '/ 仍返回工作台入口')
  const indexHtml = await indexResp.text()
  check(indexHtml.includes('智能开发工作台'), '/ 仍返回工作台 index.html')
  check(!indexHtml.includes('设计模板预览'), '/ 未被 preview.html 影响')

  browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })

  // ---- 2. 四个应用类型代表页面 ----
  const representatives = [
    {
      label: '企业级/组织与用户',
      query: 'type=enterprise-application-platform&style=platform-blue&page=organization',
      shot: 'p7-3a-organization-platform-blue.png',
      heading: '组织与用户',
      ready: '.af-panel'
    },
    {
      label: '运营/通知公告',
      query: 'type=operations-management&style=classic-warm&page=list',
      shot: 'p7-3a-operations-list-classic-warm.png',
      heading: '通知公告管理',
      ready: '.el-table'
    },
    {
      label: '数据/分析任务',
      query: 'type=data-governance-workbench&style=data-cyan&page=list',
      shot: 'p7-3a-data-task-list-data-cyan.png',
      heading: '分析任务',
      ready: '.el-table'
    },
    {
      label: '工具/异常事件',
      query: 'type=incident-response-console&style=high-contrast-tool&page=list',
      shot: 'p7-3a-incident-list-high-contrast-tool.png',
      heading: '异常事件指挥台',
      ready: '.el-table'
    }
  ]

  for (const item of representatives) {
    const { page, audit } = await openPreview(context, base, item.query)
    const heading = (await page.locator('h1').first().textContent())?.trim() || ''
    check(heading.includes(item.heading), `${item.label} 标题为“${item.heading}”`)
    checkEqual(await page.locator(item.ready).count() > 0, true, `${item.label} 关键区块可见`)
    checkEqual(await page.locator('.preview-badge').count(), 1, `${item.label} 保留 mock 数据角标`)
    checkEqual(await page.locator('body').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `${item.label} 无横向溢出`)
    await page.screenshot({ path: path.join(shotsDir, item.shot) })
    checkAudit(audit, item.label)
    await page.close()
  }

  // ---- 3. 风格切换：不重建页面（输入值保留），颜色即时变化 ----
  {
    const page = await context.newPage()
    const audit = auditPage(page)
    await page.goto(`${base}/preview.html?type=enterprise-application-platform&style=platform-blue&page=organization`, {
      waitUntil: 'networkidle'
    })
    await page.waitForTimeout(600)

    const searchInput = page.locator('.af-table-head input').first()
    await searchInput.fill('zhou')
    checkEqual(await searchInput.inputValue(), 'zhou', '风格切换前输入已写入')

    const root = page.locator('.preview-root')
    const readPrimary = () =>
      root.evaluate(el => getComputedStyle(el).getPropertyValue('--template-primary').trim())
    checkEqual(await readPrimary(), '#1f5eff', 'platform-blue 主色为 #1f5eff')

    const styleButtons = page.locator('.preview-style-switch button')
    checkEqual(await styleButtons.count(), 4, '风格切换器包含 4 种风格')
    const activeClasses: Record<string, string> = {
      '经典暖色': 'visual-style-classic-warm',
      '数据蓝青': 'visual-style-data-cyan',
      '高对比工具风': 'visual-style-high-contrast-tool'
    }
    for (const [name, className] of Object.entries(activeClasses)) {
      await page.locator('.preview-style-switch button', { hasText: name }).click()
      await page.waitForTimeout(250)
      const cls = (await root.getAttribute('class')) || ''
      check(cls.includes(className), `切换风格 ${name} 后根节点应用 ${className}`)
      checkEqual(await searchInput.inputValue(), 'zhou', `切换风格 ${name} 后页面输入态保留（未重建）`)
      await page.screenshot({ path: path.join(shotsDir, `p7-3a-organization-${className.replace('visual-style-', '')}.png`) })
    }
    checkEqual(await readPrimary(), '#f5c518', '高对比工具风主色为 #f5c518')
    checkEqual(
      await page.evaluate(() => new URLSearchParams(location.search).get('style')),
      'high-contrast-tool',
      '切换风格后 URL 同步 style 参数'
    )

    // ---- 4. pm-tree 高亮：仅当前节点 ----
    const treeColors = await page.evaluate(() => {
      const current = document.querySelector('.el-tree-node.is-current > .el-tree-node__content .pm-tree__node--custom .name')
      const other = document.querySelector('.el-tree-node:not(.is-current) > .el-tree-node__content .pm-tree__node--custom .name')
      const currentCount = document.querySelectorAll('.el-tree-node.is-current > .el-tree-node__content .pm-tree__node--custom .name').length
      const colored = [...document.querySelectorAll('.el-tree-node:not(.is-current) .pm-tree__node--custom .name')]
        .filter(el => {
          const color = getComputedStyle(el).color
          return color !== 'rgb(83, 98, 122)' && color !== 'rgb(189, 189, 189)'
        })
        .length
      return {
        current: current ? getComputedStyle(current).color : '',
        other: other ? getComputedStyle(other).color : '',
        currentCount,
        colored
      }
    })
    checkEqual(treeColors.currentCount, 1, '树中只有一个当前节点高亮')
    check(treeColors.current !== treeColors.other, '当前节点文字颜色与其它节点不同')
    checkEqual(treeColors.colored, 0, '非当前节点文字未被染色')

    checkAudit(audit, '风格切换与树高亮')
    await page.close()
  }

  // ---- 5. 非法参数回退提示 ----
  {
    const { page, audit } = await openPreview(
      context,
      base,
      'type=not-exist&style=not-exist&page=not-exist'
    )
    checkEqual(await page.locator('.preview-warning').count(), 1, '非法参数显示回退提示条')
    const warningText = (await page.locator('.preview-warning').innerText()) || ''
    check(warningText.includes('未知应用类型'), '提示包含未知应用类型')
    check(warningText.includes('未知视觉风格'), '提示包含未知视觉风格')
    const heading = (await page.locator('h1').first().textContent())?.trim() || ''
    check(heading.includes('组织与用户'), '非法参数回退到默认页 organization')
    await page.screenshot({ path: path.join(shotsDir, 'p7-3a-invalid-params.png') })
    checkAudit(audit, '非法参数回退')
    await page.close()
  }

  // ---- 6. 结构样式确实注入 ----
  {
    const page = await context.newPage()
    const audit = auditPage(page)
    await page.goto(`${base}/preview.html?type=operations-management&style=classic-warm&page=list`, {
      waitUntil: 'networkidle'
    })
    await page.waitForTimeout(500)
    const cssInfo = await page.evaluate(() => {
      const style = document.getElementById('preview-structure-css')
      return { exists: Boolean(style), length: style?.textContent?.length || 0 }
    })
    check(cssInfo.exists, '当前应用类型 structure.css 已注入')
    check(cssInfo.length > 1000, 'structure.css 内容非空')
    checkAudit(audit, '结构样式注入')
    await page.close()
  }

  // ---- 7. embed=1：工作台 iframe 嵌入时隐藏风格切换器与 mock 角标（P8-2） ----
  {
    const { page, audit } = await openPreview(
      context,
      base,
      'type=enterprise-application-platform&style=platform-blue&page=organization&embed=1'
    )
    const heading = (await page.locator('h1').first().textContent())?.trim() || ''
    check(heading.includes('组织与用户'), 'embed 模式页面内容仍正常渲染')
    checkEqual(
      (await page.locator('.preview-style-switch').count()) + (await page.locator('.preview-badge').count()),
      0,
      'embed 模式不渲染底部风格切换器与 mock 角标'
    )
    checkAudit(audit, 'embed 嵌入模式')
    await page.close()
  }

  // ---- 8. 模板页 pm-steps：点击步条同步 v-model（打磨批1/F2） ----
  // 选 enterprise-application-platform/application-form：步骤 value=1..3，点击步条直接切换分组；
  // 不走底部「下一步」是为了避开该页 next() 的必填校验（更稳定）。
  {
    const { page, audit } = await openPreview(
      context,
      base,
      'type=enterprise-application-platform&style=platform-blue&page=application-form'
    )
    const heading = (await page.locator('h1').first().textContent())?.trim() || ''
    check(heading.includes('注册应用'), '向导模板页标题为“注册应用”')
    const stepTitles = page.locator('.af-form .el-step__title')
    checkEqual(await stepTitles.count(), 3, 'pm-steps 渲染 3 个步骤')
    checkEqual(
      (await page.locator('.af-form-section h2').innerText()).trim(),
      '应用基本信息',
      '默认停在首步分组'
    )
    await stepTitles.nth(1).click()
    await page.waitForTimeout(200)
    checkEqual(
      (await page.locator('.af-form-section h2').innerText()).trim(),
      '技术与环境配置',
      '点击步条第 2 步后分组切换（v-model 同步）'
    )
    await stepTitles.nth(2).click()
    await page.waitForTimeout(200)
    checkEqual(
      (await page.locator('.af-form-section h2').innerText()).trim(),
      '权限与提交确认',
      '点击步条第 3 步后分组切换'
    )
    await stepTitles.nth(0).click()
    await page.waitForTimeout(200)
    checkEqual(
      (await page.locator('.af-form-section h2').innerText()).trim(),
      '应用基本信息',
      '点击步条第 1 步回到首组'
    )
    await page.screenshot({ path: path.join(shotsDir, 'p7-3a-pm-steps-click.png') })
    checkAudit(audit, 'pm-steps 点击步条')
    await page.close()
  }

  await context.close()
}

main()
  .then(() => {
    console.log(`P7-3a 预览验收通过：${assertions} 条断言`)
    console.log(`截图目录：${shotsDir}`)
    stopServer()
    void browser?.close()
    process.exit(0)
  })
  .catch(error => {
    console.error('P7-3a 预览验收失败：', error)
    stopServer()
    void browser?.close()
    process.exit(1)
  })
