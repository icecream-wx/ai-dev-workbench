/**
 * P2 需求视图 Playwright 验收（stub 后端，不调用模型）
 *
 * 前置：`npm run build --prefix frontend`（harness 托管 frontend/dist）。
 * 运行：`npm run e2e:p2 --prefix backend`
 *
 * 覆盖 brief §8 的 14 个场景；浅/深 × 1440/1024/768 截图；
 * 全程断言：0 console/page error、0 意外 API≥400、0 横向溢出。
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
    // favicon / 静态资源 404 不算业务错误
    if (/favicon/i.test(text)) return
    result.consoleErrors.push(text)
  })
  page.on('pageerror', error => result.pageErrors.push(error.message))
  page.on('response', response => {
    const url = response.url()
    if (response.status() >= 400) {
      if (process.env.P2_DEBUG) {
        console.log('[http]', response.status(), url)
        void response
          .text()
          .then(text => console.log('[http-body]', text.slice(0, 400)))
          .catch(() => undefined)
      }
      if (url.includes('/api/')) result.apiErrors.push(`${response.status()} ${url}`)
    } else if (url.includes('/api/') && process.env.P2_DEBUG) {
      console.log('[api]', response.status(), url)
    }
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
  const requirementsDir = path.join(appDir, 'docs', 'requirements')
  const designDir = path.join(appDir, 'docs', 'design', 'MOD-001')

  const browser: Browser = await chromium.launch()
  let context: BrowserContext | null = null
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const pageAudit = audit(page)

    // ---------- 1. 空态 → 新建模块 ----------
    await gotoRequirements(page)
    await page.locator('[data-testid=requirements-empty]').waitFor({ state: 'visible' })
    check((await page.locator('[data-testid=module-outline] .item').count()) === 0, '1.1 初始无模块')
    await page.locator('[data-testid=empty-create-btn]').click()
    await page.locator('[data-testid=new-module-title]').fill('商品管理')
    await page.locator('[data-testid=new-module-confirm]').click()
    await page.locator('[data-testid=module-item-MOD-001]').waitFor({ state: 'visible', timeout: 8000 })
    check((await page.locator('[data-testid=doc-title]').innerText()).includes('商品管理'), '1.2 文档标题')
    const moduleFile = path.join(requirementsDir, 'MOD-001-商品管理.md')
    check(fs.existsSync(moduleFile), '1.3 模块文件存在')
    const moduleText = fs.readFileSync(moduleFile, 'utf8')
    check(/^---\nmodule: MOD-001\n/.test(moduleText), '1.4 frontmatter module')
    check(/^title: "商品管理"$/m.test(moduleText), '1.5 frontmatter title')
    check(/^order: 1$/m.test(moduleText), '1.6 frontmatter order')
    check(/^template: builtin-prd-lite$/m.test(moduleText), '1.7 frontmatter template')
    check((moduleText.match(/^## /gm) ?? []).length === 6, '1.8 6 个章节')

    // ---------- 2. 第二个模块 + 上移/下移 + 改名 ----------
    await page.locator('[data-testid=new-module-btn]').click()
    await page.locator('[data-testid=new-module-title]').fill('订单管理')
    await page.locator('[data-testid=new-module-confirm]').click()
    await page.locator('[data-testid=module-item-MOD-002]').waitFor({ state: 'visible' })
    await page.locator('[data-testid=module-item-MOD-002]').click()
    await page.locator('[data-testid=module-up-btn]').click()
    await waitFor(
      async () =>
        (await page.locator('[data-testid=module-outline] .item code').first().innerText()).trim() === 'MOD-002',
      6000,
      '上移后 MOD-002 置顶'
    )
    check(true, '2.1 上移生效')
    await page.locator('[data-testid=module-item-MOD-002]').click()
    await page.locator('[data-testid=module-down-btn]').click()
    await waitFor(
      async () =>
        (await page.locator('[data-testid=module-outline] .item code').first().innerText()).trim() === 'MOD-001',
      6000,
      '下移后 MOD-001 置顶'
    )
    check(true, '2.2 下移生效')
    const secondFile = path.join(requirementsDir, 'MOD-002-订单管理.md')
    check(fs.readFileSync(secondFile, 'utf8').includes('order: 2'), '2.3 下移后文件 order=2')

    await page.locator('[data-testid=module-item-MOD-002]').click()
    await page.locator('[data-testid=module-rename-btn]').click()
    await page.locator('[data-testid=rename-input]').fill('订单中心')
    await page.locator('[data-testid=rename-confirm]').click()
    const renamedFile = path.join(requirementsDir, 'MOD-002-订单中心.md')
    await waitFor(() => fs.existsSync(renamedFile), 6000, '改名后文件名同步')
    check(!fs.existsSync(secondFile), '2.4 旧文件名已移除')
    check(/^# 订单中心$/m.test(fs.readFileSync(renamedFile, 'utf8')), '2.5 H1 同步')

    // ---------- 3. 切模板 ----------
    await page.locator('[data-testid=module-item-MOD-002]').click()
    await page.locator('[data-testid=module-template-select]').selectOption('builtin-prd')
    await waitFor(() => /^template: builtin-prd$/m.test(fs.readFileSync(renamedFile, 'utf8')), 6000, '模板 frontmatter 变化')
    check(true, '3.1 template=builtin-prd')
    const templateSkill = path.join(
      appDir,
      '.opencode',
      'skills',
      'adw-template-req-builtin-prd',
      'SKILL.md'
    )
    await waitFor(() => fs.existsSync(templateSkill), 6000, '模板 skill 生成')
    check(fs.existsSync(templateSkill), '3.2 模板 skill 已生成')
    const templateManifest = path.join(appDir, '.opencode', 'skills', 'adw-template-req-builtin-prd', '_manifest.json')
    await waitFor(() => fs.existsSync(templateManifest), 6000, '模板 skill manifest 生成')
    check(fs.existsSync(templateManifest), '3.2b 模板 skill manifest 存在')
    await waitFor(
      async () => (await page.locator('[data-testid=doc-template-badge]').innerText()).includes('工作台标准 PRD'),
      6000,
      '文档头模板徽标更新'
    )
    check(true, '3.3 文档头模板徽标')

    // ---------- 4. TOC 定位 ----------
    await page.locator('[data-testid=module-item-MOD-001]').click()
    const tocItems = await page.locator('[data-testid=doc-toc] button').count()
    check(tocItems === 6, '4.1 TOC 条目数=6')
    await page.locator('[data-testid=toc-item-sec-1]').click()
    await page.waitForTimeout(350)
    check((await page.locator('#sec-1').count()) === 1, '4.2 章节锚点存在')
    const firstSectionTitle = await page.locator('#sec-1').innerText()
    check(firstSectionTitle.includes('文档信息'), '4.3 章节标题与 ## 一致')

    // ---------- 5. 错误条 + 让 AI 修 ----------
    fs.mkdirSync(designDir, { recursive: true })
    const designFile = path.join(designDir, 'design.json')
    fs.writeFileSync(designFile, JSON.stringify({ module: 'MOD-001', title: '商品管理', entities: 'oops' }), 'utf8')
    const strip = page.locator('[data-testid=artifact-warning-strip]')
    const stripDelay = await waitFor(async () => (await strip.count()) > 0, 3000, '错误条出现')
    check(stripDelay <= 1500, `5.1 错误条 ≤1.5s（实际 ${stripDelay}ms）`)
    const stripText = await strip.innerText()
    check(stripText.includes('design.json') && stripText.includes('期望'), '5.2 错误条含文件/期望')
    await page.locator('[data-testid=fix-with-ai-btn]').click()
    const composerValue = await page.locator('[data-testid=chat-composer] textarea').inputValue()
    check(composerValue.includes('design.json'), '5.3 让 AI 修填入 Composer')
    await page.locator('[data-testid=chat-composer] textarea').fill('')
    fs.rmSync(designFile, { force: true })
    await waitFor(async () => (await strip.count()) === 0, 3000, '清理后错误条消失')
    check(true, '5.4 删除非法文件后错误条消失')

    // ---------- 6. 对话：流式 + 工具卡 ----------
    await chatSend(page, '慢速输出一段需求说明')
    await page.locator('[data-testid=chat-panel] .msg.assistant').first().waitFor({ state: 'visible', timeout: 5000 })
    await delay(500)
    const partial = await page.locator('[data-testid=chat-panel] .msg.assistant').first().innerText()
    check(partial.trim().length > 0, '6.1 流式文本已出现')
    check(!partial.includes('后续段落会继续追加'), '6.2 首屏是部分文本（未一次性完成）')
    await waitFor(
      async () => (await page.locator('[data-testid=chat-status]').innerText()).includes('本轮完成'),
      10000,
      '对话完成'
    )
    const finalText = await page.locator('[data-testid=chat-panel] .msg.assistant').first().innerText()
    check(finalText.includes('后续段落会继续追加'), '6.3 完成后文本完整')
    check((await page.locator('[data-testid=chat-panel] .step-card').count()) > 0, '6.4 工具卡出现')

    // ---------- 7. 权限卡 ----------
    await chatSend(page, '需要写入权限')
    const permissionCard = page.locator('[data-testid=chat-panel] .pending-card').first()
    await permissionCard.waitFor({ state: 'visible', timeout: 6000 })
    check((await permissionCard.innerText()).includes('允许本次写入'), '7.1 权限卡出现')
    await permissionCard.getByRole('button', { name: '允许一次' }).click()
    await waitFor(async () => (await page.locator('[data-testid=chat-panel] .pending-card').count()) === 0, 8000, '权限卡消失')
    check(true, '7.2 权限卡消失')
    await waitFor(
      async () => (await page.locator('[data-testid=chat-panel]').innerText()).includes('已允许写入'),
      8000,
      '权限后继续文本'
    )
    check(true, '7.3 权限后继续文本')

    // ---------- 8. 表单卡 ----------
    await chatSend(page, '请给我表单')
    const formCard = page.locator('[data-testid=chat-panel] .pending-card').first()
    await formCard.waitFor({ state: 'visible', timeout: 6000 })
    check((await formCard.innerText()).includes('补充信息'), '8.1 表单卡出现')
    await formCard.locator('input').first().fill('全部范围')
    await formCard.getByRole('button', { name: '提交' }).click()
    await waitFor(
      async () => (await page.locator('[data-testid=chat-panel]').innerText()).includes('表单已收到'),
      8000,
      '表单提交后继续'
    )
    check(true, '8.2 表单提交后继续执行')

    // ---------- 9. 命令按钮 ----------
    await page.locator('[data-testid=module-item-MOD-001]').click()
    await page.locator('[data-testid=chat-command-update]').click()
    await waitFor(async () => (await readState()).commands.some(item => item.name === 'update-requirements'), 8000, '命令到达后端')
    const command = (await readState()).commands.find(item => item.name === 'update-requirements')
    check(command?.text === 'MOD-001', '9.1 命令参数为当前模块 key')
    await page.locator('[data-testid=chat-command-consistency]').click()
    await waitFor(async () => (await readState()).commands.some(item => item.name === 'check-consistency'), 8000, '一致性命令到达后端')
    check(true, '9.2 检查一致性命令')

    // ---------- 10. 停止：占位 → 中断 ----------
    await chatSend(page, '开始静默长任务')
    const pending = page.locator('[data-testid=chat-pending]')
    await pending.waitFor({ state: 'visible', timeout: 6000 })
    check((await pending.innerText()).includes('思考中'), '10.0 运行中显示本地占位')
    const stopButton = page.locator('[data-testid=chat-panel]').getByRole('button', { name: '停止' })
    await stopButton.waitFor({ state: 'visible', timeout: 6000 })
    await stopButton.click()
    await page.locator('[data-testid=chat-pending-interrupted]').waitFor({ state: 'visible', timeout: 8000 })
    await waitFor(
      async () => (await page.locator('[data-testid=chat-panel]').innerText()).includes('已中止'),
      8000,
      '停止后显示中止'
    )
    check(true, '10.1 停止生效')
    check((await page.locator('[data-testid=chat-composer] textarea').isEnabled()) === true, '10.2 停止后输入可用')

    // ---------- 10b. 占位 → 首个内容替换 ----------
    await chatSend(page, '流式占位：先占位再输出')
    await page.locator('[data-testid=chat-pending]').waitFor({ state: 'visible', timeout: 5000 })
    check(true, '10b.1 发送后立即出现占位')
    await page.locator('[data-testid=chat-pending]').waitFor({ state: 'detached', timeout: 8000 })
    await waitFor(
      async () => (await page.locator('[data-testid=chat-status]').innerText()).includes('本轮完成'),
      10000,
      '占位替换后完成'
    )
    check(true, '10b.2 首个内容替换占位')

    // ---------- 10c. reasoning 折叠块 ----------
    await chatSend(page, '思考过程：整理需求')
    const reasoning = page.locator('[data-testid=chat-reasoning]').last()
    await reasoning.waitFor({ state: 'visible', timeout: 8000 })
    const reasoningText = await reasoning.evaluate(element => element.textContent || '')
    check(reasoningText.includes('先读工作区产物'), '10c.1 reasoning 折叠块内容')
    check((await reasoning.locator('summary').innerText()).includes('思考'), '10c.2 reasoning 标题为“思考”')
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
    check((await page.locator('[data-testid=chat-composer] textarea').isEnabled()) === true, '10d.2 失败后可继续输入')

    // ---------- 11. 85% 上下文 ----------
    await chatSend(page, '上下文90 请继续')
    await page.locator('[data-testid=context-danger-banner]').waitFor({ state: 'visible', timeout: 8000 })
    check((await page.locator('[data-testid=context-chip]').innerText()).includes('90%'), '11.1 上下文 chip 90%')
    const compactBefore = (await readState()).compactCount
    await page.locator('[data-testid=compact-continue-btn]').click()
    await waitFor(async () => (await readState()).compactCount > compactBefore, 8000, 'compact 被调用')
    check(true, '11.2 压缩后继续调用 compact')
    const promptsBefore = (await readState()).prompts.length
    await page.locator('[data-testid=new-session-continue-btn]').click()
    await waitFor(
      async () => ((await page.locator('[data-testid=chat-composer] textarea').inputValue()) || '').includes('已归档'),
      8000,
      '衔接文案填入 Composer'
    )
    check(true, '11.3 开新会话继续填入衔接文案')
    await delay(600)
    check((await readState()).prompts.length === promptsBefore, '11.4 衔接文案未自动发送')

    // ---------- 12. 历史下拉 ----------
    await page.locator('[data-testid=chat-new-session-btn]').click()
    await waitFor(async () => (await page.locator('[data-testid=chat-history-select] option').count()) >= 2, 8000, '会话下拉 ≥2')
    check(true, '12.1 会话下拉列出历史')
    const optionValues = await page
      .locator('[data-testid=chat-history-select] option')
      .evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))
    check(optionValues.length >= 2, '12.2 下拉选项数 ≥2')
    await page.locator('[data-testid=chat-history-select]').selectOption(optionValues[optionValues.length - 1])
    await delay(500)
    check((await page.locator('[data-testid=chat-history-select]').inputValue()).length > 0, '12.3 切换后仍选中会话')

    // ---------- 13. 外部改文件 ≤1.5s ----------
    const externalFile = path.join(requirementsDir, 'MOD-900-外部新增.md')
    const externalDelay = await (async () => {
      const started = Date.now()
      fs.writeFileSync(
        externalFile,
        '---\nmodule: MOD-900\ntitle: "外部新增"\norder: 9\ntemplate: builtin-prd-lite\n---\n\n# 外部新增\n\n## 1. 文档信息\n',
        'utf8'
      )
      await waitFor(
        async () => (await page.locator('[data-testid=module-item-MOD-900]').count()) > 0,
        3000,
        '外部新增模块出现'
      )
      return Date.now() - started
    })()
    check(externalDelay <= 1500, `13.1 外部改文件 ≤1.5s（实际 ${externalDelay}ms）`)
    fs.rmSync(externalFile, { force: true })

    // ---------- 14. 模板库弹窗 ----------
    await page.locator('[data-testid=template-library-btn]').click()
    const dialog = page.locator('.el-dialog:visible').last()
    await dialog.waitFor({ state: 'visible', timeout: 6000 })
    await dialog.getByRole('button', { name: '新建模板' }).waitFor({ state: 'visible', timeout: 6000 })
    check(true, '14.1 模板库弹窗打开')
    await dialog.locator('.list .item').first().click()
    check(
      (await dialog.locator('[data-testid=template-skill-hint]').innerText()).includes('adw-template-req-'),
      '14.2 模板详情显示应用内 skill'
    )
    const syncButton = dialog.getByRole('button', { name: '同步到应用' })
    await syncButton.waitFor({ state: 'visible', timeout: 6000 })
    check(await syncButton.isEnabled(), '14.3 模板库同步按钮可用')
    await syncButton.click()
    await dialog.locator('.sync-message').waitFor({ state: 'visible', timeout: 8000 })
    const syncText = await dialog.locator('.sync-message').innerText()
    check(syncText.includes('adw-template-req-'), `14.4 同步结果提示模板 skill（${syncText}）`)
    check(!syncText.includes('告警：'), `14.5 同步无告警（${syncText}）`)
    await dialog.locator('.el-dialog__headerbtn').click()
    await dialog.waitFor({ state: 'hidden', timeout: 6000 })
    check(true, '14.3 模板库弹窗关闭')

    // 功能页最终审计
    check(pageAudit.consoleErrors.length === 0, `0 console error（${pageAudit.consoleErrors.join(' | ')}）`)
    check(pageAudit.pageErrors.length === 0, `0 page error（${pageAudit.pageErrors.join(' | ')}）`)
    check(pageAudit.apiErrors.length === 0, `0 意外 API≥400（${pageAudit.apiErrors.join(' | ')}）`)

    await context.close()
    context = null

    // ---------- 15. 响应式 / 主题矩阵（1440/1024/768 × 浅/深） ----------
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
        const outlineBox = await matrixPage.locator('[data-testid=module-outline]').boundingBox()
        check(outlineBox !== null && outlineBox.x < 0, `${item.width}/${item.theme} 初始大纲抽屉收起`)
        await matrixPage.locator('[data-testid=outline-toggle]').click()
        await delay(300)
        const openedOutline = await matrixPage.locator('[data-testid=module-outline]').boundingBox()
        check(openedOutline !== null && openedOutline.x >= 0, `${item.width}/${item.theme} 大纲抽屉展开`)
        await matrixPage.locator('[data-testid=chat-toggle]').click()
        await delay(300)
        const closedOutline = await matrixPage.locator('[data-testid=module-outline]').boundingBox()
        const openChat = await matrixPage.locator('[data-testid=chat-panel]').boundingBox()
        check(closedOutline !== null && closedOutline.x < 0, `${item.width}/${item.theme} 抽屉互斥（大纲收起）`)
        check(openChat !== null && openChat.x >= 0, `${item.width}/${item.theme} 对话抽屉展开`)
        await matrixPage.keyboard.press('Escape')
        await delay(300)
        const escapedChat = await matrixPage.locator('[data-testid=chat-panel]').boundingBox()
        check(
          escapedChat !== null && escapedChat.x >= item.width - 1,
          `${item.width}/${item.theme} Esc 关闭抽屉`
        )
      } else {
        const outlineBox = await matrixPage.locator('[data-testid=module-outline]').boundingBox()
        const chatBox = await matrixPage.locator('[data-testid=chat-panel]').boundingBox()
        check(outlineBox !== null && outlineBox.x >= 0 && outlineBox.width > 200, `${item.width}/${item.theme} 三栏（大纲）`)
        check(chatBox !== null && chatBox.x > 900, `${item.width}/${item.theme} 三栏（对话）`)
      }

      await matrixPage.screenshot({
        path: path.join(shotsDir, `p2-${item.width}-${item.theme}.png`),
        fullPage: false
      })
      check(matrixAudit.consoleErrors.length === 0, `${item.width}/${item.theme} 0 console error`)
      check(matrixAudit.pageErrors.length === 0, `${item.width}/${item.theme} 0 page error`)
      check(matrixAudit.apiErrors.length === 0, `${item.width}/${item.theme} 0 意外 API≥400`)
      await matrixContext.close()
    }
  } finally {
    await context?.close().catch(() => undefined)
    await browser.close().catch(() => undefined)
    stopHarness()
    // harness 持有 SQLite 句柄：等进程退出后再删（删不掉就留给临时目录）
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
