/**
 * P3 设计视图 Playwright 验收（stub 后端，不调用模型）
 *
 * 前置：`npm run build --prefix frontend`。
 * 运行：`npm run e2e:p3 --prefix backend`
 *
 * 覆盖 brief §9 的场景；浅/深 × 1440/1024/768 截图；
 * 全程断言：0 console/page error、0 意外 API≥400、0 横向溢出。
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p3-e2e-'))
const stateFile = path.join(root, 'state.json')
const shotsDir = process.env.P3_SHOTS_DIR || path.join(os.tmpdir(), 'workbench-p3-shots')
const port = 3423
const base = `http://127.0.0.1:${port}`
const appId = 'p3-app'

fs.mkdirSync(shotsDir, { recursive: true })

interface HarnessState {
  appId: string
  appDir: string
  projectsDir: string
  ready?: boolean
  commands: Array<{ name: string; text: string; sessionID: string }>
  prompts: Array<{ text: string; sessionID: string }>
  compactCount: number
  sessions: Array<{ id: string; view: string; title: string }>
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
      P2_APP_NAME: 'P3 设计视图'
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
  ignoredApiErrors: string[]
  ignoreConsole: boolean
}

function audit(page: Page): PageAudit {
  const result: PageAudit = {
    consoleErrors: [],
    pageErrors: [],
    apiErrors: [],
    ignoredApiErrors: [],
    ignoreConsole: false
  }
  page.on('console', message => {
    if (result.ignoreConsole) return
    if (message.type() !== 'error') return
    const text = message.text()
    if (/favicon/i.test(text)) return
    result.consoleErrors.push(text)
  })
  page.on('pageerror', error => result.pageErrors.push(error.message))
  page.on('response', response => {
    const url = response.url()
    if (!url.includes('/api/')) return
    if (response.status() >= 400 && !result.ignoredApiErrors.some(fragment => url.includes(fragment))) {
      result.apiErrors.push(`${response.status()} ${url}`)
    }
  })
  return result
}

async function gotoDesign(page: Page): Promise<void> {
  await page.goto(`${base}/#/apps/${appId}/design`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=design-view]').waitFor({ state: 'visible', timeout: 15000 })
}

async function chatSend(page: Page, text: string): Promise<void> {
  const textarea = page.locator('[data-testid=chat-composer] textarea')
  await textarea.fill(text)
  await page.locator('[data-testid=chat-panel]').getByRole('button', { name: '发送' }).click()
}

async function main(): Promise<void> {
  await startHarness()
  const state = await readState()
  const appDir = state.appDir
  const designDir = path.join(appDir, 'docs', 'design', 'MOD-001')
  const designPath = path.join(designDir, 'design.json')
  const prototypesDir = path.join(designDir, 'prototypes')
  const manifestFile = path.join(prototypesDir, '_manifest.json')
  const tokensFile = path.join(designDir, 'tokens.json')
  const briefFile = path.join(designDir, 'design-brief.md')
  const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex')

  // 准备两个需求模块（P3 复用 P2 的模块 API）
  const created = await request('POST', `/apps/${appId}/requirements-modules`, { title: '商品管理' })
  check(created.status === 201, '准备模块 MOD-001')
  const created2 = await request('POST', `/apps/${appId}/requirements-modules`, { title: '订单管理' })
  check(created2.status === 201, '准备模块 MOD-002')

  const browser: Browser = await chromium.launch()
  let context: BrowserContext | null = null
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const pageAudit = audit(page)

    // ---------- 1. 空态 ----------
    await gotoDesign(page)
    await page.locator('[data-testid=design-module-MOD-001]').waitFor({ state: 'visible' })
    check((await page.locator('[data-testid=design-module-list]').innerText()).includes('未生成'), '1.1 模块列表显示未生成')
    await page.locator('[data-testid=design-empty]').waitFor({ state: 'visible' })
    check((await page.locator('[data-testid=design-summary]').innerText()).includes('未生成设计'), '1.2 工具栏摘要')
    check(
      (await page.locator('[data-testid=design-template-badge]').innerText()).includes(' · '),
      '1.3 设计系统徽标（类型 · 风格）'
    )

    // ---------- 1b. AI 面板空态 + 示例只填不发（UI-2b） ----------
    const chatEmpty = page.locator('[data-testid=chat-empty]')
    await chatEmpty.waitFor({ state: 'visible', timeout: 10000 })
    check((await chatEmpty.innerText()).includes('开始与 AI 协作'), '1b.1 无会话空态标题')
    check((await page.locator('[data-testid=chat-context-view]').isVisible()) === true, '1b.2 上下文 pills 可见')
    check((await page.locator('[data-testid=chat-context-view]').innerText()).includes('设计'), '1b.3 上下文视图 pill')
    await page.locator('[data-testid=chat-example-1]').click()
    check(
      (await page.locator('[data-testid=chat-composer] textarea').inputValue()).includes('页面契约'),
      '1b.4 点击示例只填入输入框'
    )
    check((await page.locator('[data-testid=chat-status]').innerText()).includes('未开始'), '1b.5 点击示例不自动发送')
    await page.locator('[data-testid=chat-composer] textarea').fill('')

    // ---------- 2. 生成设计（命令）→ ER ----------
    await page.locator('[data-testid=design-empty-generate]').click()
    const commandDelay = await waitFor(
      async () => (await readState()).commands.some(item => item.name === 'generate-design'),
      10000,
      'generate-design 命令到达'
    )
    check(commandDelay <= 10000, '2.1 生成命令已发送')
    const command = (await readState()).commands.find(item => item.name === 'generate-design')
    check(command?.text === 'MOD-001', '2.2 命令参数为当前模块 key')
    const erDelay = await waitFor(async () => (await page.locator('[data-testid=er-panel]').count()) > 0, 5000, 'ER 面板出现')
    check(erDelay <= 1500, `2.3 ER ≤1.5s 刷新（实际 ${erDelay}ms）`)
    await waitFor(
      async () => (await page.locator('[data-testid=er-panel]').innerText()).includes('商品分类'),
      6000,
      'ER 实体渲染'
    )
    const erText = await page.locator('[data-testid=er-panel]').innerText()
    check(erText.includes('商品') && erText.includes('表 2'), '2.4 ER 表数量 2')
    check(erText.includes('关系 1') || erText.includes('N:1'), '2.5 ER 关系渲染')
    check((await page.locator('[data-testid=design-file]').innerText()).includes('design.json'), '2.6 设计文件路径')
    check(fs.existsSync(designPath), '2.7 design.json 已生成')
    const originalDesign = fs.readFileSync(designPath, 'utf8')

    // ---------- 2b. 自动导出设计参考包（真渲染 PNG + manifest/tokens） ----------
    await waitFor(() => fs.existsSync(manifestFile), 25000, '自动导出 prototypes/_manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as {
      designHash: string
      styleId: string
      exportedAt: string
      pages: Record<string, { file: string; hash: string; exportedAt: string }>
    }
    check(manifest.designHash === sha256(fs.readFileSync(designPath)), '2b.1 manifest designHash 与 design.json 一致')
    check(manifest.styleId === 'platform-blue', `2b.2 styleId（${manifest.styleId}）`)
    check(Boolean(manifest.pages['product-list']), '2b.3 manifest 包含 product-list')
    check(Boolean(manifest.pages['product-form']), '2b.4 manifest 包含 product-form')
    for (const page of Object.values(manifest.pages)) {
      const pngFile = path.join(prototypesDir, page.file)
      check(fs.existsSync(pngFile), `2b.5 PNG 已写入：${page.file}`)
      const png = fs.readFileSync(pngFile)
      check(sha256(png) === page.hash, `2b.6 PNG hash：${page.file}`)
      const width = png.readUInt32BE(16)
      const height = png.readUInt32BE(20)
      check(width > 500 && height > 200, `2b.6b PNG 真实渲染尺寸 ${page.file}：${width}x${height}`)
    }
    check(fs.existsSync(tokensFile), '2b.7 tokens.json 已生成')
    const tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8')) as {
      styleId: string
      name: string
      tokens: Record<string, unknown>
    }
    check(
      tokens.styleId === manifest.styleId && Boolean(tokens.tokens.primary) && !('shell' in tokens),
      '2b.8 tokens 内容正确（styleId + 风格 tokens，无 shell）'
    )
    await waitFor(
      async () => (await page.locator('[data-testid=design-tokens-status]').innerText()).includes('已生成'),
      8000,
      '工具栏 tokens 已生成'
    )
    check(true, '2b.9 工具栏 tokens 已生成')
    check((await page.locator('[data-testid=design-brief-status]').innerText()).includes('未生成'), '2b.10 brief 初始未生成')
    await waitFor(
      async () => (await page.locator('[data-testid=design-prototype-status]').innerText()).includes('2 页'),
      8000,
      '工具栏原型页数'
    )
    check(true, '2b.11 工具栏原型页数')
    fs.writeFileSync(briefFile, '# 设计参考\n\n- 概览：商品管理\n- 导航：侧栏\n', 'utf8')
    await waitFor(
      async () => (await page.locator('[data-testid=design-brief-status]').innerText()).includes('已生成'),
      8000,
      'brief 状态刷新'
    )
    check(true, '2b.12 brief 文件存在后状态刷新')

    // ---------- 3. 实体字段面板 ----------
    await page.locator('.er-node').first().click()
    const fieldsText = await page.locator('[data-testid=entity-fields]').innerText()
    check(fieldsText.includes('商品编码') && fieldsText.includes('商品名称'), '3.1 字段列表')
    check(fieldsText.includes('上架') && fieldsText.includes('下架'), '3.2 枚举取值')
    check(fieldsText.includes('唯一'), '3.3 唯一约束')

    // ---------- 4. 原型 Tab / 页面切换 ----------
    await page.locator('[data-testid=design-tab-prototype]').click()
    await page.locator('[data-testid=prototype-panel]').waitFor({ state: 'visible' })
    check((await page.locator('[data-testid=prototype-pages] .page-chip').count()) === 2, '4.1 页面 chips=2')
    await page.locator('[data-testid=page-chip-product-form]').click()
    await page.locator('[data-testid=prototype-paper]').waitFor({ state: 'visible', timeout: 6000 })
    await waitFor(
      async () => (await page.locator('[data-testid=prototype-paper]').innerText()).includes('保存'),
      6000,
      '表单页渲染'
    )
    const formText = await page.locator('[data-testid=prototype-paper]').innerText()
    check(formText.includes('保存') && formText.includes('取消'), '4.2 表单页动作渲染')
    await page.locator('[data-testid=page-chip-product-list]').click()
    await waitFor(
      async () => (await page.locator('[data-testid=prototype-paper]').innerText()).includes('商品编码'),
      6000,
      '列表页渲染'
    )
    const listText = await page.locator('[data-testid=prototype-paper]').innerText()
    check(listText.includes('商品编码'), '4.3 列表页列渲染')
    check(listText.includes('新增'), '4.4 列表页动作渲染')

    // ---------- 5. 缩放 ----------
    await page.locator('[data-testid=zoom-75]').click()
    await delay(200)
    check((await page.locator('[data-testid=prototype-paper]').getAttribute('style'))?.includes('0.75'), '5.1 缩放 75%')
    await page.locator('[data-testid=zoom-125]').click()
    await delay(200)
    check((await page.locator('[data-testid=prototype-paper]').getAttribute('style'))?.includes('1.25'), '5.2 缩放 125%')
    await page.locator('[data-testid=zoom-100]').click()
    await delay(200)
    check((await page.locator('[data-testid=prototype-paper]').getAttribute('style'))?.includes('scale(1)'), '5.3 缩放 100%')

    // ---------- 6. 导出 PNG（P10：整包导出，模板优先/线框兜底） ----------
    const manualPng = path.join(prototypesDir, 'product-list.png')
    const manualBefore = fs.existsSync(manualPng) ? fs.statSync(manualPng).mtimeMs : 0
    await page.locator('[data-testid=export-png-btn]').click()
    await waitFor(
      () => fs.existsSync(manualPng) && fs.statSync(manualPng).mtimeMs > manualBefore,
      90000,
      '整包导出重写 product-list.png'
    )
    const manualStatus = (await page.locator('[data-testid=design-prototype-status]').innerText()) || ''
    check(manualStatus.includes('2 页'), `6.1 整包导出状态为 2 页（${manualStatus.replace(/\s+/g, ' ')}）`)
    check(fs.existsSync(manualPng) && fs.statSync(manualPng).size > 2000, '6.2 导出 PNG 已写入且非空')

    // ---------- 7. 非法 design.json → 错误条 + 让 AI 修 ----------
    fs.writeFileSync(designPath, '{ "module": "MOD-001", ', 'utf8')
    const strip = page.locator('[data-testid=design-warning-strip]')
    const stripDelay = await waitFor(async () => (await strip.count()) > 0, 3000, '错误条出现')
    check(stripDelay <= 1500, `7.1 错误条 ≤1.5s（实际 ${stripDelay}ms）`)
    const stripText = await strip.innerText()
    check(stripText.includes('design.json'), '7.2 错误条含文件')
    check(stripText.includes('JSON') || stripText.includes('期望'), '7.3 错误条含原因/期望')
    await page.locator('[data-testid=design-fix-with-ai]').click()
    const composer = await page.locator('[data-testid=chat-composer] textarea').inputValue()
    check(composer.includes('design.json'), '7.4 让 AI 修填入 Composer')
    await page.locator('[data-testid=chat-composer] textarea').fill('')
    fs.writeFileSync(designPath, originalDesign, 'utf8')
    await waitFor(async () => (await strip.count()) === 0, 4000, '恢复后错误条消失')
    check(true, '7.5 恢复合法文件后错误条消失')

    // ---------- 8. 跨模块 / 未知实体 / 未知页面类型 warning ----------
    const crossDesign = JSON.parse(originalDesign) as Record<string, unknown>
    crossDesign.pages = [
      { id: 'order-list', name: '订单列表', type: 'list', entity: 'MOD-002/order' },
      { id: 'ghost-detail', name: '未知详情', type: 'detail', entity: 'ghost' }
    ]
    fs.writeFileSync(designPath, `${JSON.stringify(crossDesign, null, 2)}\n`, 'utf8')
    await waitFor(
      async () => ((await strip.count()) > 0 && (await strip.innerText()).includes('其它模块')),
      4000,
      '跨模块 warning 出现'
    )
    const crossText = await strip.innerText()
    check(crossText.includes('MOD-002/order') && crossText.includes('其它模块'), '8.1 跨模块引用 warning')
    check(crossText.includes('ghost'), '8.2 未知实体 warning')

    crossDesign.pages = [{ id: 'custom-page', name: '自定义页', type: 'timeline' }]
    fs.writeFileSync(designPath, `${JSON.stringify(crossDesign, null, 2)}\n`, 'utf8')
    await waitFor(async () => (await strip.innerText()).includes('timeline'), 4000, '未知页面类型 warning')
    check((await strip.innerText()).includes('timeline'), '8.3 未知页面类型 warning')
    fs.writeFileSync(designPath, originalDesign, 'utf8')
    await waitFor(async () => (await strip.count()) === 0, 4000, '跨模块 warning 恢复')

    // ---------- 8b. 孤儿设计（有 design 无需求模块）：末尾只读列出 + 警告 ----------
    console.log('[p3-e2e] step 8b orphan design')
    const orphanDir = path.join(appDir, 'docs', 'design', 'MOD-900')
    fs.mkdirSync(orphanDir, { recursive: true })
    fs.writeFileSync(
      path.join(orphanDir, 'design.json'),
      `${JSON.stringify(
        {
          module: 'MOD-900',
          title: '孤儿设计',
          entities: [{ id: 'legacy', name: '历史实体', fields: [{ name: '名称', type: 'string' }] }],
          relations: [],
          pages: [{ id: 'legacy-list', name: '历史列表', type: 'list', entity: 'legacy' }]
        },
        null,
        2
      )}\n`,
      'utf8'
    )
    await waitFor(
      async () => (await page.locator('[data-testid=design-module-MOD-900]').count()) === 1,
      4000,
      '孤儿设计出现在模块列表'
    )
    check((await page.locator('[data-testid=design-orphan-badge]').innerText()).includes('缺需求模块'), '8b.1 孤儿设计标记')
    await page.locator('[data-testid=design-module-MOD-900]').click()
    await page.locator('[data-testid=design-tab-er]').click()
    await waitFor(
      async () => (await page.locator('[data-testid=er-panel]').innerText()).includes('历史实体'),
      5000,
      '孤儿设计可只读查看'
    )
    check(true, '8b.2 孤儿设计只读渲染')
    check((await page.locator('[data-testid=design-generate-btn]').isDisabled()) === true, '8b.3 孤儿设计禁用生成')
    await waitFor(
      async () => (await strip.count()) > 0 && (await strip.innerText()).includes('没有对应需求模块'),
      4000,
      '孤儿设计 warning 进入错误条'
    )
    check(true, '8b.4 孤儿设计 warning 进入错误条')
    fs.rmSync(orphanDir, { recursive: true, force: true })
    await waitFor(
      async () => (await page.locator('[data-testid=design-module-MOD-900]').count()) === 0,
      4000,
      '孤儿设计移除'
    )
    await page.locator('[data-testid=design-module-MOD-001]').click()
    await delay(300)

    // ---------- 9. 外部改 design.json ≤1.5s ----------
    console.log('[p3-e2e] step 9 external edit')
    await page.locator('[data-testid=design-tab-er]').click()
    await page.locator('[data-testid=er-panel]').waitFor({ state: 'visible', timeout: 5000 })
    const grownDesign = JSON.parse(originalDesign) as Record<string, unknown>
    ;(grownDesign.entities as unknown[]).push({
      id: 'coupon',
      name: '优惠券',
      table: 'biz_coupon',
      fields: [{ name: '名称', type: 'string' }]
    })
    const externalDelay = await (async () => {
      const started = Date.now()
      fs.writeFileSync(designPath, `${JSON.stringify(grownDesign, null, 2)}\n`, 'utf8')
      await waitFor(
        async () => (await page.locator('[data-testid=er-panel]').innerText()).includes('表 3'),
        3000,
        '外部新增实体出现'
      )
      return Date.now() - started
    })()
    check(externalDelay <= 1500, `9.1 外部改 design.json ≤1.5s（实际 ${externalDelay}ms）`)
    fs.writeFileSync(designPath, originalDesign, 'utf8')
    await waitFor(
      async () => (await page.locator('[data-testid=er-panel]').innerText()).includes('表 2'),
      3000,
      '恢复为 2 实体'
    )
    check(true, '9.2 恢复设计后 ER 更新')

    // ---------- 9b. design.json 变化 → 过期黄条 → 手动重新导出 ----------
    const staleDesign = `${originalDesign.trimEnd()}\n\n`
    fs.writeFileSync(designPath, staleDesign, 'utf8')
    const staleHash = sha256(fs.readFileSync(designPath))
    await waitFor(
      async () => (await page.locator('[data-testid=design-prototype-stale]').count()) > 0,
      8000,
      '过期黄条出现'
    )
    check((await page.locator('[data-testid=design-prototype-stale]').innerText()).includes('已过期'), '9b.1 过期黄条文案')
    await page.locator('[data-testid=design-reexport-btn]').click()
    await waitFor(() => {
      try {
        return (JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as { designHash: string }).designHash === staleHash
      } catch {
        return false
      }
    }, 25000, '手动重导更新 manifest')
    check(true, '9b.2 手动重导成功')
    await waitFor(
      async () => (await page.locator('[data-testid=design-prototype-stale]').count()) === 0,
      8000,
      '过期黄条消失'
    )
    check(true, '9b.3 重导后黄条消失')
    const exportedAtBefore = (JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as { exportedAt: string }).exportedAt
    await page.locator('[data-testid=design-reexport-btn]').click()
    await waitFor(() => {
      try {
        return (JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as { exportedAt: string }).exportedAt !== exportedAtBefore
      } catch {
        return false
      }
    }, 25000, '手动重新导出（同 hash）')
    check(true, '9b.4 手动重新导出可用')

    // ---------- 9c. 导出失败提示（拦截接口；失败不阻塞视图） ----------
    const exportRoute = /\/api\/apps\/[^/]+\/design\/MOD-001\/prototypes$/
    pageAudit.ignoredApiErrors.push('/design/MOD-001/prototypes')
    pageAudit.ignoreConsole = true
    await page.route(exportRoute, route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '模拟导出失败' }) })
    )
    await page.locator('[data-testid=design-reexport-btn]').click()
    await page.locator('[data-testid=design-export-error]').waitFor({ state: 'visible', timeout: 20000 })
    check(
      (await page.locator('[data-testid=design-export-error]').innerText()).includes('模拟导出失败'),
      '9c.1 导出失败提示'
    )
    await page.unroute(exportRoute)
    pageAudit.ignoreConsole = false
    await page.locator('[data-testid=design-export-retry]').click()
    await page.locator('[data-testid=design-export-error]').waitFor({ state: 'hidden', timeout: 30000 })
    check(true, '9c.2 重试成功后错误消失')

    // ---------- 10. 需求视图「去设计」落到真实设计视图 ----------
    await page.goto(`${base}/#/apps/${appId}/requirements`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid=requirements-view]').waitFor({ state: 'visible' })
    await page.locator('[data-testid=go-design-btn]').click()
    await page.locator('[data-testid=design-view]').waitFor({ state: 'visible', timeout: 8000 })
    await waitFor(
      async () => (await page.locator('[data-testid=design-tab-er]').count()) === 1,
      8000,
      '设计视图渲染完成'
    )
    check(true, '10.1 去设计落到设计视图')

    // ---------- 10b. 对话占位 / 替换 ----------
    await chatSend(page, '流式占位：先占位再输出')
    await page.locator('[data-testid=chat-pending]').waitFor({ state: 'visible', timeout: 5000 })
    check(true, '10b.1 发送后出现占位')
    await page.locator('[data-testid=chat-pending]').waitFor({ state: 'detached', timeout: 8000 })
    await waitFor(
      async () => (await page.locator('[data-testid=chat-status]').innerText()).includes('本轮完成'),
      10000,
      '占位替换后完成'
    )
    check(true, '10b.2 首个内容替换占位')

    // ---------- 10c. reasoning 折叠块 ----------
    await chatSend(page, '思考过程：整理设计')
    const reasoning = page.locator('[data-testid=chat-reasoning]').last()
    await reasoning.waitFor({ state: 'visible', timeout: 8000 })
    const reasoningText = await reasoning.evaluate(element => element.textContent || '')
    check(reasoningText.includes('先读工作区产物'), '10c.1 reasoning 内容')
    check((await reasoning.locator('summary').innerText()).includes('思考'), '10c.2 reasoning 标题')
    await waitFor(
      async () => (await page.locator('[data-testid=chat-status]').innerText()).includes('本轮完成'),
      10000,
      'reasoning 轮次完成'
    )
    check(true, '10c.3 reasoning 轮次完成')

    // ---------- 10d. 失败：占位替换为失败标记 ----------
    await chatSend(page, '触发失败')
    const failed = page.locator('[data-testid=chat-pending-failed]')
    await failed.waitFor({ state: 'visible', timeout: 8000 })
    check((await failed.innerText()).includes('失败'), '10d.1 失败标记出现')

    // ---------- 10e. 模板库同步提示（模板 skill） ----------
    await page.goto(`${base}/#/apps/${appId}/requirements`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid=requirements-view]').waitFor({ state: 'visible', timeout: 8000 })
    await page.locator('[data-testid=template-library-btn]').click()
    const dialog = page.locator('.el-dialog:visible').last()
    await dialog.waitFor({ state: 'visible', timeout: 6000 })
    await dialog.locator('.list .item').first().click()
    await dialog.getByRole('button', { name: '同步到应用' }).click()
    await dialog.locator('.sync-message').waitFor({ state: 'visible', timeout: 8000 })
    check(
      (await dialog.locator('.sync-message').innerText()).includes('adw-template-req-'),
      '10e.1 同步提示模板 skill'
    )
    await dialog.locator('.el-dialog__headerbtn').click()
    await dialog.waitFor({ state: 'hidden', timeout: 6000 })

    check(pageAudit.consoleErrors.length === 0, `0 console error（${pageAudit.consoleErrors.join(' | ')}）`)
    check(pageAudit.pageErrors.length === 0, `0 page error（${pageAudit.pageErrors.join(' | ')}）`)
    check(pageAudit.apiErrors.length === 0, `0 意外 API≥400（${pageAudit.apiErrors.join(' | ')}）`)

    await context.close()
    context = null

    // ---------- 11. 响应式 / 主题矩阵 ----------
    const matrix = [
      { width: 1440, theme: 'light' },
      { width: 1440, theme: 'dark' },
      { width: 1024, theme: 'light' },
      { width: 1024, theme: 'dark' },
      { width: 768, theme: 'light' },
      { width: 768, theme: 'dark' }
    ] as const
    for (const item of matrix) {
      const matrixContext = await browser.newContext({ viewport: { width: item.width, height: 900 } })
      await matrixContext.addInitScript(theme => {
        try {
          window.localStorage.setItem('rg.theme', JSON.stringify(theme))
        } catch {
          // ignore
        }
      }, item.theme)
      const matrixPage = await matrixContext.newPage()
      const matrixAudit = audit(matrixPage)
      await gotoDesign(matrixPage)
      await delay(500)

      const overflow = await matrixPage.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        inner: window.innerWidth
      }))
      check(
        overflow.doc <= overflow.inner + 1 && overflow.body <= overflow.inner + 1,
        `${item.width}/${item.theme} 无横向溢出（${overflow.doc}/${overflow.body}/${overflow.inner}）`
      )
      check(
        (await matrixPage.evaluate(() => document.documentElement.classList.contains('dark'))) === (item.theme === 'dark'),
        `${item.width}/${item.theme} 主题生效`
      )

      if (item.width <= 1024) {
        const modulesBox = await matrixPage.locator('[data-testid=design-module-list]').boundingBox()
        check(modulesBox !== null && modulesBox.x < 0, `${item.width}/${item.theme} 初始模块抽屉收起`)
        await matrixPage.locator('[data-testid=design-outline-toggle]').click()
        await delay(300)
        const opened = await matrixPage.locator('[data-testid=design-module-list]').boundingBox()
        check(opened !== null && opened.x >= 0, `${item.width}/${item.theme} 模块抽屉展开`)
        await matrixPage.locator('[data-testid=design-chat-toggle]').click()
        await delay(300)
        const closed = await matrixPage.locator('[data-testid=design-module-list]').boundingBox()
        const chat = await matrixPage.locator('[data-testid=chat-panel]').boundingBox()
        check(closed !== null && closed.x < 0, `${item.width}/${item.theme} 抽屉互斥（模块收起）`)
        check(chat !== null && chat.x >= 0, `${item.width}/${item.theme} 对话抽屉展开`)
        await matrixPage.keyboard.press('Escape')
        await delay(300)
        const escaped = await matrixPage.locator('[data-testid=chat-panel]').boundingBox()
        check(escaped !== null && escaped.x >= item.width - 1, `${item.width}/${item.theme} Esc 关闭抽屉`)
      } else {
        const modulesBox = await matrixPage.locator('[data-testid=design-module-list]').boundingBox()
        const chatBox = await matrixPage.locator('[data-testid=chat-panel]').boundingBox()
        check(modulesBox !== null && modulesBox.x >= 0 && modulesBox.width > 180, `${item.width}/${item.theme} 三栏（模块）`)
        check(chatBox !== null && chatBox.x > 900, `${item.width}/${item.theme} 三栏（对话）`)
      }

      await matrixPage.screenshot({ path: path.join(shotsDir, `p3-${item.width}-${item.theme}.png`), fullPage: false })
      if (item.width === 1440 && item.theme === 'light') {
        await matrixPage.locator('[data-testid=design-tab-prototype]').click()
        await matrixPage.locator('[data-testid=prototype-paper]').waitFor({ state: 'visible', timeout: 6000 })
        await delay(400)
        await matrixPage.screenshot({ path: path.join(shotsDir, 'p3-1440-light-prototype.png'), fullPage: false })
      }
      if (item.width === 1440 && item.theme === 'dark') {
        await matrixPage.locator('[data-testid=design-tab-prototype]').click()
        await matrixPage.locator('[data-testid=prototype-paper]').waitFor({ state: 'visible', timeout: 6000 })
        await delay(400)
        const paperColor = await matrixPage.evaluate(() => {
          const paper = document.querySelector('[data-testid=prototype-paper]')
          return paper ? getComputedStyle(paper).backgroundColor : ''
        })
        check(paperColor === 'rgb(255, 255, 255)', `深色下原型纸面保持白色（${paperColor}）`)
        await matrixPage.screenshot({ path: path.join(shotsDir, 'p3-1440-dark-prototype.png'), fullPage: false })
      }
      check(matrixAudit.consoleErrors.length === 0, `${item.width}/${item.theme} 0 console error`)
      check(matrixAudit.pageErrors.length === 0, `${item.width}/${item.theme} 0 page error`)
      check(matrixAudit.apiErrors.length === 0, `${item.width}/${item.theme} 0 意外 API≥400`)
      await matrixContext.close()
    }
  } finally {
    await context?.close().catch(() => undefined)
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

  console.log(`\n[p3-e2e] 通过：${assertions} 条断言；截图目录 ${shotsDir}`)
}

main().catch(error => {
  console.error(`\n[p3-e2e] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
