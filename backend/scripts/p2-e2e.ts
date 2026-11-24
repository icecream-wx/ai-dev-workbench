/**
 * P2 需求视图 Playwright 验收（D1 单文档；stub 后端，不调用模型）
 *
 * 前置：`npm run build --prefix frontend`（harness 托管 frontend/dist）。
 * 运行：`npm run e2e:p2 --prefix backend`
 */
import assert from 'node:assert/strict'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p2-e2e-'))
const stateFile = path.join(root, 'state.json')
const shotsDir = process.env.P2_SHOTS_DIR || path.join(os.tmpdir(), 'workbench-p2-shots')
const port = 3422
const base = `http://127.0.0.1:${port}`

fs.mkdirSync(shotsDir, { recursive: true })

interface HarnessState {
  appId: string
  appDir: string
  projectsDir: string
  commands: Array<{ name: string; text: string; sessionID: string }>
  prompts: Array<{ text: string; sessionID: string }>
  compactCount: number
  sessions: Array<{ id: string; view: string; title: string }>
}

let harness: ChildProcess | null = null
let assertions = 0
const failures: string[] = []

function check(condition: unknown, message: string): void {
  assertions += 1
  if (!condition) {
    failures.push(message)
    throw new Error(message)
  }
}

async function readState(): Promise<HarnessState> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8')) as HarnessState
    } catch {
      await delay(25)
    }
  }
  throw new Error(`无法读取 harness 状态文件：${stateFile}`)
}

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

async function waitFor(checkFn: () => boolean | Promise<boolean>, timeoutMs: number, label: string): Promise<number> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await checkFn()) return Date.now() - started
    await delay(60)
  }
  throw new Error(`等待超时（${timeoutMs}ms）：${label}`)
}

async function startHarness(): Promise<void> {
  harness = spawn('npx', ['tsx', 'scripts/p2-e2e-harness.ts'], {
    cwd: backendDir,
    shell: true,
    windowsHide: true,
    env: { ...process.env, P2_ROOT: root, P2_STATE_FILE: stateFile, P2_PORT: String(port) },
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
    if (response.status() >= 400 && url.includes('/api/')) result.apiErrors.push(`${response.status()} ${url}`)
  })
  return result
}

const appUrl = (view: string): string => `${base}/#/apps/p2-app/${view}`

async function gotoRequirements(page: Page): Promise<void> {
  await page.goto(appUrl('requirements'), { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=requirements-view]').waitFor({ state: 'visible', timeout: 15000 })
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
  const requirementsFile = path.join(appDir, 'docs', 'requirements', 'requirements.md')
  const designDir = path.join(appDir, 'docs', 'design')

  const browser: Browser = await chromium.launch()
  let context: BrowserContext | null = null
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const pageAudit = audit(page)

    // ---------- 1. 单需求文档：骨架 / 空态生成 ----------
    await gotoRequirements(page)
    // scaffold 已生成骨架 → 删除后验证空态与「生成文档骨架」
    fs.rmSync(requirementsFile, { force: true })
    await page.locator('[data-testid=refresh-btn]').click()
    await page.locator('[data-testid=requirements-empty]').waitFor({ state: 'visible', timeout: 10000 })
    check((await page.locator('[data-testid=requirements-view]').innerText()).includes('从需求文档开始'), '1.1 空态文案')
    await page.locator('[data-testid=empty-create-btn]').click()
    await waitFor(() => fs.existsSync(requirementsFile), 8000, '需求文档骨架生成')
    const docText = fs.readFileSync(requirementsFile, 'utf8')
    check(/^---\ntitle: ".*"\n/.test(docText), '1.2 frontmatter title')
    check(/^template: builtin-prd-lite$/m.test(docText), '1.3 frontmatter template（应用默认模板）')
    check(!/^module:/m.test(docText), '1.4 不再有 module')
    check(!/^order:/m.test(docText), '1.5 不再有 order')
    check(docText.includes('### EP-001'), '1.6 骨架含 Epic 约定')
    await page.locator('[data-testid=requirements-document]').waitFor({ state: 'visible', timeout: 8000 })
    check((await page.locator('[data-testid=doc-file]').innerText()).includes('requirements.md'), '1.7 文档路径')

    // 1b. AI 面板空态 + 示例只填不发
    const chatEmpty = page.locator('[data-testid=chat-empty]')
    await chatEmpty.waitFor({ state: 'visible', timeout: 10000 })
    check((await chatEmpty.innerText()).includes('开始与 AI 协作'), '1b.1 无会话空态标题')
    check((await page.locator('[data-testid^="chat-example-"]').count()) === 3, '1b.2 空态示例 3 条')
    await page.locator('[data-testid=chat-example-1]').click()
    const exampleValue = await page.locator('[data-testid=chat-composer] textarea').inputValue()
    check(exampleValue.includes('还缺哪些 Epic'), '1b.3 点击示例只填入输入框')
    check((await page.locator('[data-testid=chat-status]').innerText()).includes('未开始'), '1b.4 点击示例不自动发送')
    await page.locator('[data-testid=chat-composer] textarea').fill('')

    // ---------- 2. 单文档 + 文档自带 TOC（无左侧大纲） ----------
    fs.writeFileSync(
      requirementsFile,
      '---\ntitle: "商品管理应用"\ntemplate: builtin-prd\n---\n\n# 商品管理应用\n\n## 1. 目标\n\n卖货。\n\n## 2. Epics\n\n### EP-001 商品管理\n\n**目标**：维护商品。\n\n#### US-001 商品列表\n\n- 验收：能查询。\n\n### EP-002 订单管理\n\n#### US-002 订单列表\n\n- 验收：能下单。\n',
      'utf8'
    )
    await waitFor(
      async () => (await page.locator('[data-testid=requirements-document]').innerText()).includes('EP-002'),
      8000,
      '外部 Epic 出现在文档'
    )
    check((await page.locator('[data-testid=requirements-document]').innerText()).includes('US-001'), '2.1 文档含 Story ID')
    check((await page.locator('[data-testid=requirements-outline]').count()) === 0, '2.2 已删除左侧章节大纲')
    const tocItems = await page.locator('[data-testid=doc-toc] button').count()
    check(tocItems >= 4, `2.3 文档 TOC 条目 ≥4（实际 ${tocItems}）`)
    await page.locator('[data-testid=toc-item-sec-3]').click()
    await page.waitForTimeout(350)
    check((await page.locator('#sec-3').count()) === 1, '2.4 章节锚点存在')
    check((await page.locator('#sec-3').innerText()).includes('EP-001'), '2.5 章节标题与 ## 一致')
    check((await page.locator('[data-testid=artifact-summary]').innerText()).includes('2 个 Epic'), '2.6 摘要显示 Epic 数')
    check((await page.getByText('新建模块').count()) === 0, '2.7 无新建模块入口（单文档）')

    // 2b. 桌面布局：左对话 + 分隔条 + 右文档；拖拽/双击复位
    const chatBox = await page.locator('[data-testid=chat-panel]').boundingBox()
    const docBox = await page.locator('[data-testid=requirements-document]').boundingBox()
    check(Boolean(chatBox && docBox && chatBox.x < docBox.x), '2.8 对话在文档左侧')
    const split = page.locator('[data-testid=requirements-chat-split]')
    check((await split.count()) === 1, '2.9 对话分隔条存在')
    const beforeWidth = chatBox?.width ?? 0
    await split.hover()
    await page.mouse.down()
    await page.mouse.move((chatBox?.x ?? 0) + beforeWidth + 70, (chatBox?.y ?? 0) + 160, { steps: 5 })
    await page.mouse.up()
    await delay(200)
    const afterWidth = (await page.locator('[data-testid=chat-panel]').boundingBox())?.width ?? 0
    check(afterWidth > beforeWidth + 30, `2.10 拖拽变宽（${beforeWidth}→${afterWidth}）`)
    await split.dblclick()
    await delay(200)
    const resetWidth = (await page.locator('[data-testid=chat-panel]').boundingBox())?.width ?? 0
    check(Math.abs(resetWidth - beforeWidth) <= 2, `2.11 双击复位（${resetWidth}）`)

    // ---------- 3. 错误条 + 让 AI 修 ----------
    fs.mkdirSync(designDir, { recursive: true })
    const entitiesFile = path.join(designDir, 'entities.json')
    fs.writeFileSync(entitiesFile, JSON.stringify({ schemaVersion: 2, entities: 'oops' }), 'utf8')
    const strip = page.locator('[data-testid=artifact-warning-strip]')
    const stripDelay = await waitFor(async () => (await strip.count()) > 0, 3000, '错误条出现')
    check(stripDelay <= 1500, `3.1 错误条 ≤1.5s（实际 ${stripDelay}ms）`)
    const stripText = await strip.innerText()
    check(stripText.includes('entities.json') && stripText.includes('期望'), '3.2 错误条含文件/期望')
    await page.locator('[data-testid=fix-with-ai-btn]').click()
    check((await page.locator('[data-testid=chat-composer] textarea').inputValue()).includes('entities.json'), '3.3 让 AI 修填入 Composer')
    await page.locator('[data-testid=chat-composer] textarea').fill('')
    fs.rmSync(entitiesFile, { force: true })
    await waitFor(async () => (await strip.count()) === 0, 3000, '清理后错误条消失')
    check(true, '3.4 删除非法文件后错误条消失')

    // ---------- 4. 对话：流式 + 工具卡 ----------
    await chatSend(page, '慢速输出一段需求说明')
    await page.locator('[data-testid=chat-panel] .msg.assistant').first().waitFor({ state: 'visible', timeout: 5000 })
    await delay(500)
    const partial = await page.locator('[data-testid=chat-panel] .msg.assistant').first().innerText()
    check(partial.trim().length > 0, '4.1 流式文本已出现')
    check(!partial.includes('后续段落会继续追加'), '4.2 首屏是部分文本')
    await waitFor(
      async () => (await page.locator('[data-testid=chat-status]').innerText()).includes('本轮完成'),
      10000,
      '对话完成'
    )
    check((await page.locator('[data-testid=chat-panel] .msg.assistant').first().innerText()).includes('后续段落会继续追加'), '4.3 完成后文本完整')
    check((await page.locator('[data-testid=chat-panel] .step-card').count()) > 0, '4.4 工具卡出现')

    // ---------- 5. 权限卡 ----------
    await chatSend(page, '需要写入权限')
    const permissionCard = page.locator('[data-testid=chat-panel] .pending-card').first()
    await permissionCard.waitFor({ state: 'visible', timeout: 6000 })
    check((await permissionCard.innerText()).includes('允许本次写入'), '5.1 权限卡出现')
    await permissionCard.getByRole('button', { name: '允许一次' }).click()
    await waitFor(async () => (await page.locator('[data-testid=chat-panel] .pending-card').count()) === 0, 8000, '权限卡消失')
    await waitFor(async () => (await page.locator('[data-testid=chat-panel]').innerText()).includes('已允许写入'), 8000, '权限后继续文本')
    check(true, '5.2 权限卡消失并继续')

    // ---------- 6. 表单卡 ----------
    await chatSend(page, '请给我表单')
    const formCard = page.locator('[data-testid=chat-panel] .pending-card').first()
    await formCard.waitFor({ state: 'visible', timeout: 6000 })
    check((await formCard.innerText()).includes('补充信息'), '6.1 表单卡出现')
    await formCard.locator('input').first().fill('全部范围')
    await formCard.getByRole('button', { name: '提交' }).click()
    await waitFor(async () => (await page.locator('[data-testid=chat-panel]').innerText()).includes('表单已收到'), 8000, '表单提交后继续')
    check(true, '6.2 表单提交后继续执行')

    // ---------- 7. 命令按钮（无模块参数） ----------
    await page.locator('[data-testid=chat-command-update]').click()
    await waitFor(async () => (await readState()).commands.some(item => item.name === 'update-requirements'), 8000, '命令到达后端')
    const command = (await readState()).commands.find(item => item.name === 'update-requirements')
    check(command?.text === '', `7.1 命令参数为空（实际 ${JSON.stringify(command?.text)}）`)
    await page.locator('[data-testid=chat-command-consistency]').click()
    await waitFor(async () => (await readState()).commands.some(item => item.name === 'check-consistency'), 8000, '一致性命令到达后端')
    check(true, '7.2 检查一致性命令')

    // ---------- 8. 停止：占位 → 中断 ----------
    await chatSend(page, '开始静默长任务')
    await page.locator('[data-testid=chat-pending]').waitFor({ state: 'visible', timeout: 6000 })
    check((await page.locator('[data-testid=chat-pending]').innerText()).includes('思考中'), '8.0 运行中显示本地占位')
    const stopButton = page.locator('[data-testid=chat-panel]').getByRole('button', { name: '停止' })
    await stopButton.waitFor({ state: 'visible', timeout: 6000 })
    await stopButton.click()
    await page.locator('[data-testid=chat-pending-interrupted]').waitFor({ state: 'visible', timeout: 8000 })
    await waitFor(async () => (await page.locator('[data-testid=chat-panel]').innerText()).includes('已中止'), 8000, '停止后显示中止')
    check((await page.locator('[data-testid=chat-composer] textarea').isEnabled()) === true, '8.1 停止后输入可用')

    // ---------- 9. reasoning + 失败 ----------
    await chatSend(page, '思考过程：整理需求')
    const reasoning = page.locator('[data-testid=chat-reasoning]').last()
    await reasoning.waitFor({ state: 'visible', timeout: 8000 })
    check((await reasoning.evaluate(element => element.textContent || '')).includes('先读工作区产物'), '9.1 reasoning 折叠块内容')
    await waitFor(async () => (await page.locator('[data-testid=chat-status]').innerText()).includes('本轮完成'), 10000, 'reasoning 轮次完成')
    await chatSend(page, '触发失败')
    const failed = page.locator('[data-testid=chat-pending-failed]')
    await failed.waitFor({ state: 'visible', timeout: 8000 })
    check((await failed.innerText()).includes('失败'), '9.2 失败标记出现')

    // ---------- 10. 85% 上下文 ----------
    await chatSend(page, '上下文90 请继续')
    await page.locator('[data-testid=context-danger-banner]').waitFor({ state: 'visible', timeout: 8000 })
    check((await page.locator('[data-testid=context-chip]').innerText()).includes('90%'), '10.1 上下文 chip 90%')
    const compactBefore = (await readState()).compactCount
    await page.locator('[data-testid=compact-continue-btn]').click()
    await waitFor(async () => (await readState()).compactCount > compactBefore, 8000, 'compact 被调用')
    const promptsBefore = (await readState()).prompts.length
    await page.locator('[data-testid=new-session-continue-btn]').click()
    await waitFor(
      async () => ((await page.locator('[data-testid=chat-composer] textarea').inputValue()) || '').includes('已归档'),
      8000,
      '衔接文案填入 Composer'
    )
    await delay(600)
    check((await readState()).prompts.length === promptsBefore, '10.2 衔接文案未自动发送')

    // ---------- 11. 历史下拉 ----------
    await page.locator('[data-testid=chat-new-session-btn]').click()
    await waitFor(async () => (await page.locator('[data-testid=chat-history-select] option').count()) >= 2, 8000, '会话下拉 ≥2')
    check(true, '11.1 会话下拉列出历史')

    // ---------- 12. 外部改文件 ≤1.5s ----------
    const externalDelay = await (async () => {
      const started = Date.now()
      fs.appendFileSync(requirementsFile, '\n## 3. 验收\n\n- 能查询。\n', 'utf8')
      await waitFor(
        async () => (await page.locator('[data-testid=requirements-document]').innerText()).includes('3. 验收'),
        3000,
        '外部新增章节出现'
      )
      return Date.now() - started
    })()
    check(externalDelay <= 1500, `12.1 外部改文件 ≤1.5s（实际 ${externalDelay}ms）`)

    // ---------- 12b. 章节「问 AI」+ 隐藏章节上下文（方案 A；放在对话断言之后，避免影响首条 assistant 断言） ----------
    const askCount = await page.locator('[data-testid^="section-ask-ai-"]').count()
    check(askCount >= 1, `12b.1 h2/h3 注入「问 AI」（实际 ${askCount}）`)
    check((await page.locator('[data-testid=section-ask-ai-sec-4]').count()) === 0, '12b.2 h4 Story 不注入「问 AI」')
    const promptsBeforeAsk = (await readState()).prompts.length
    await page.locator('[data-testid=section-ask-ai-sec-1]').click()
    const askValue = await page.locator('[data-testid=chat-composer] textarea').inputValue()
    check(askValue.includes('目标'), '12b.3 点击 h2「问 AI」预填章节提问')
    check((await page.locator('[data-testid=chat-section-focus]').isVisible()) === true, '12b.4 对话区显示定位章节 chip')
    check((await page.locator('[data-testid=chat-section-focus]').innerText()).includes('定位章节'), '12b.5 chip 文案')
    await delay(300)
    check((await readState()).prompts.length === promptsBeforeAsk, '12b.6 点击「问 AI」不自动发送')
    await page.locator('[data-testid=chat-composer]').getByRole('button', { name: '发送', exact: true }).click()
    await waitFor(async () => (await readState()).prompts.length > promptsBeforeAsk, 8000, '章节提问到达后端')
    const focusPrompt = (await readState()).prompts.at(-1)?.text ?? ''
    check(focusPrompt.includes('本轮聚焦章节'), '12b.7 后端 prompt 含隐藏章节上下文')
    check(focusPrompt.includes('目标'), '12b.8 隐藏上下文含章节标题')
    check(
      focusPrompt.indexOf('本轮聚焦章节') < focusPrompt.indexOf('用户消息：'),
      '12b.9 章节上下文在用户消息之前'
    )
    await page.locator('[data-testid=chat-section-focus-clear]').click()
    check((await page.locator('[data-testid=chat-section-focus]').count()) === 0, '12b.10 移除后 chip 消失')

    // ---------- 13. 模板库弹窗 ----------
    await page.locator('[data-testid=template-library-btn]').click()
    const dialog = page.locator('.el-dialog:visible').last()
    await dialog.waitFor({ state: 'visible', timeout: 6000 })
    await dialog.getByRole('button', { name: '新建模板' }).waitFor({ state: 'visible', timeout: 6000 })
    check(true, '13.1 模板库弹窗打开')
    await dialog.locator('.list .item').first().click()
    check(
      (await dialog.locator('[data-testid=template-skill-hint]').innerText()).includes('adw-template-req-'),
      '13.2 模板详情显示应用内 skill'
    )
    const syncButton = dialog.getByRole('button', { name: '同步到应用' })
    await syncButton.waitFor({ state: 'visible', timeout: 6000 })
    await syncButton.click()
    await dialog.locator('.sync-message').waitFor({ state: 'visible', timeout: 8000 })
    check((await dialog.locator('.sync-message').innerText()).includes('adw-template-req-'), '13.3 同步结果提示模板 skill')
    await dialog.locator('.el-dialog__headerbtn').click()
    await dialog.waitFor({ state: 'hidden', timeout: 6000 })
    check(true, '13.4 模板库弹窗关闭')

    // 功能页最终审计
    check(pageAudit.consoleErrors.length === 0, `0 console error（${pageAudit.consoleErrors.join(' | ')}）`)
    check(pageAudit.pageErrors.length === 0, `0 page error（${pageAudit.pageErrors.join(' | ')}）`)
    check(pageAudit.apiErrors.length === 0, `0 意外 API≥400（${pageAudit.apiErrors.join(' | ')}）`)

    await context.close()
    context = null

    // ---------- 14. 响应式 / 主题矩阵 ----------
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
      await gotoRequirements(matrixPage)
      await delay(400)

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
        const chatClosed = await matrixPage.locator('[data-testid=chat-panel]').boundingBox()
        check(chatClosed !== null && chatClosed.x < 0, `${item.width}/${item.theme} 初始对话抽屉收起`)
        await matrixPage.locator('[data-testid=chat-toggle]').click()
        await delay(300)
        const openChat = await matrixPage.locator('[data-testid=chat-panel]').boundingBox()
        check(openChat !== null && openChat.x >= 0, `${item.width}/${item.theme} 对话左抽屉展开`)
        await matrixPage.keyboard.press('Escape')
        await delay(300)
        const escapedChat = await matrixPage.locator('[data-testid=chat-panel]').boundingBox()
        check(escapedChat !== null && escapedChat.x < 0, `${item.width}/${item.theme} Esc 关闭对话抽屉`)
      } else {
        const chatBox = await matrixPage.locator('[data-testid=chat-panel]').boundingBox()
        const docBox = await matrixPage.locator('[data-testid=requirements-document]').boundingBox()
        check(
          Boolean(chatBox && docBox && chatBox.x < docBox.x && chatBox.width >= 290),
          `${item.width}/${item.theme} 两栏（对话左 / 文档右）`
        )
      }

      await matrixPage.screenshot({ path: path.join(shotsDir, `p2-${item.width}-${item.theme}.png`), fullPage: false })
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

  if (failures.length) throw new Error(`失败 ${failures.length} 项：${failures.join('；')}`)
  console.log(`\n[p2-e2e] 通过：${assertions} 条断言；截图目录 ${shotsDir}`)
}

main().catch(error => {
  console.error(`\n[p2-e2e] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
