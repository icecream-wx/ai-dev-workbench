/**
 * P4 开发视图 Playwright 验收（stub 后端，不调用模型）
 *
 * 前置：`npm run build --prefix frontend`。
 * 运行：`npm run e2e:p4 --prefix backend`
 *
 * 覆盖 brief 出口 7；浅/深 × 1440/1024/768 截图；
 * 全程断言：0 console/page error、0 意外 API≥400、0 横向溢出。
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p4-e2e-'))
const stateFile = path.join(root, 'state.json')
const shotsDir = process.env.P4_SHOTS_DIR || path.join(os.tmpdir(), 'workbench-p4-shots')
const port = 3425
const base = `http://127.0.0.1:${port}`
const appId = 'p4-app'

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

/** P7-5b：写入一个需求模块 + 设计契约，用于模块选择/ui-check/设计摘要断言 */
function seedP4Design(appDir: string): void {
  const requirements = path.join(appDir, 'docs', 'requirements')
  fs.mkdirSync(requirements, { recursive: true })
  fs.writeFileSync(
    path.join(requirements, 'MOD-001-商品管理.md'),
    '---\nmodule: MOD-001\ntitle: "商品管理"\norder: 1\ntemplate: builtin-prd-lite\n---\n\n# 商品管理\n\n## 1. 目标\n\n维护商品。\n',
    'utf8'
  )
  const designDir = path.join(appDir, 'docs', 'design', 'MOD-001')
  fs.mkdirSync(designDir, { recursive: true })
  fs.writeFileSync(
    path.join(designDir, 'design.json'),
    `${JSON.stringify(
      {
        module: 'MOD-001',
        title: '商品管理',
        designSystem: {
          pack: 'afcenter-app-templates-v1',
          applicationType: 'enterprise-application-platform',
          style: 'platform-blue'
        },
        entities: [
          {
            id: 'product',
            name: '商品',
            fields: [
              { name: '商品编码', type: 'string' },
              { name: '商品名称', type: 'string' },
              { name: '状态', type: 'enum', options: ['上架', '下架'] }
            ]
          }
        ],
        relations: [],
        pages: [
          {
            id: 'product-list',
            name: '商品列表',
            type: 'list',
            recipe: 'tree-list',
            catalogRef: 'enterprise-application-platform/organization',
            blueprint: 'application-types/enterprise-application-platform/pages/OrganizationUsers.vue',
            entity: 'product',
            filters: ['商品名称', '状态'],
            columns: ['商品编码', '商品名称', '状态'],
            rowActions: ['detail', 'edit', 'delete'],
            toolbarActions: ['create'],
            selection: true,
            pagination: { layout: 'three-part', pageSize: 20 },
            tree: { titleField: '商品名称', parentField: '所属分类' }
          }
        ]
      },
      null,
      2
    )}\n`,
    'utf8'
  )
}

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
    env: {
      ...process.env,
      P2_ROOT: root,
      P2_STATE_FILE: stateFile,
      P2_PORT: String(port),
      P2_APP_ID: appId,
      P2_APP_NAME: 'P4 开发视图'
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

async function confirmBox(page: Page, label: string): Promise<void> {
  const box = page.locator('.el-message-box')
  await box.waitFor({ state: 'visible', timeout: 6000 })
  await box.getByRole('button', { name: label, exact: true }).click()
  await box.waitFor({ state: 'hidden', timeout: 6000 }).catch(() => undefined)
}

async function sendMessage(page: Page, text: string): Promise<void> {
  const textarea = page.locator('.composer textarea')
  const send = page.locator('.composer').getByRole('button', { name: '发送', exact: true })
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await textarea.fill(text)
    try {
      await send.click({ force: true, timeout: 1500 })
    } catch {
      // 重渲染时按钮可能短暂 detach
    }
    await delay(250)
    if (!(await textarea.inputValue()).trim()) return
    await delay(200)
  }
  throw new Error(`消息未发送成功：${text}`)
}

async function main(): Promise<void> {
  await startHarness()
  const harnessState = await readState()
  seedP4Design(harnessState.appDir)

  const browser: Browser = await chromium.launch()
  let context: BrowserContext | null = null
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const pageAudit = audit(page)

    // ---------- 1. 空态 + 首条提示 ----------
    await gotoDev(page)
    await delay(600)
    if (process.env.P4_DEBUG) {
      console.log('[p4-debug] view=', (await page.locator('[data-testid=dev-view]').innerText()).slice(0, 500))
      console.log('[p4-debug] api=', JSON.stringify(pageAudit.apiErrors))
    }
    await page.locator('[data-testid=dev-start-card]').waitFor({ state: 'visible', timeout: 10000 })
    const startCardText = await page.locator('[data-testid=dev-start-card]').innerText()
    check(startCardText.includes('AGENTS.md'), '1.1 空态提到 AGENTS.md')
    check(startCardText.includes('docs/requirements/'), '1.2 空态提到 docs/requirements/')
    check(startCardText.includes('docs/design/'), '1.3 空态提到 docs/design/')
    check(!startCardText.includes('交接包'), '1.4 空态无交接包字样')
    const firstPrompt = await page.locator('[data-testid=dev-start-prompt]').inputValue()
    check(firstPrompt.includes('AGENTS.md'), '1.5 首条提示含 AGENTS.md')
    check(firstPrompt.includes('docs/requirements/'), '1.6 首条提示含 docs/requirements/')
    check(firstPrompt.includes('docs/design/'), '1.7 首条提示含 docs/design/')
    check(!firstPrompt.includes('交接包'), '1.8 首条提示无交接包字样')
    check(firstPrompt.includes('design-system.json'), '1.9 首条提示含 design-system.json')
    check(firstPrompt.includes('ui-check.md'), '1.10 首条提示含 ui-check.md')
    check(firstPrompt.includes('PageTemplates'), '1.11 首条提示含 PageTemplates')
    check(firstPrompt.includes('EOS 后端不吃风格'), '1.12 首条提示含 EOS 边界')

    // ---------- 1b. 模块选择 + 设计参考（P7-5b） ----------
    const moduleSelect = page.locator('[data-testid=dev-module-select]')
    await moduleSelect.waitFor({ state: 'visible', timeout: 8000 })
    check((await moduleSelect.inputValue()) === 'MOD-001', '1b.1 单模块自动选中 MOD-001')
    const designRefText = await page.locator('[data-testid=dev-design-ref]').innerText()
    check(designRefText.includes('企业级应用管理平台'), '1b.2 设计参考含应用类型')
    check(designRefText.includes('平台蓝白'), '1b.3 设计参考含视觉风格')
    check(designRefText.includes('5 页'), '1b.4 设计参考含页面库数量')
    check(designRefText.includes('docs/design/template'), '1b.5 设计参考含蓝图根')
    check((await page.locator('[data-testid=dev-ui-check-status]').innerText()) === '未生成', '1b.6 ui-check 初始未生成')
    const uiCheckPendingInitial = await page.locator('[data-testid=dev-ui-check-pending]').innerText()
    check(uiCheckPendingInitial.includes('自动生成'), `1b.6b 未生成时提示发送首条消息自动生成（${uiCheckPendingInitial}）`)

    await page.locator('[data-testid=dev-open-templates]').click()
    await page.locator('[data-testid=design-template-center]').waitFor({ state: 'visible', timeout: 10000 })
    check(
      (await page.locator('[data-testid=design-template-center]').innerText()).includes('设计模板'),
      '1b.7 打开模板中心'
    )
    await page.locator('[data-testid=design-template-close]').click()
    await page.locator('[data-testid=design-template-center]').waitFor({ state: 'hidden', timeout: 6000 })

    // ---------- 2. 开始开发 → 流式/工具/文件变化 ----------
    await page.locator('[data-testid=dev-start-btn]').click()
    await waitFor(
      async () => (await page.locator('[data-testid=dev-timeline] .assistant-message').count()) > 0,
      10000,
      '开始开发后出现助手文本'
    )
    await waitFor(
      async () => (await page.locator('[data-testid=dev-timeline]').innerText()).includes('已更新需求文档'),
      12000,
      '首轮回复完成'
    )
    check((await page.locator('[data-testid=dev-timeline] .step-card').count()) > 0, '2.1 工具卡出现')
    const firstUserBubble = await page.locator('[data-testid=dev-timeline] .user-message pre').first().innerText()
    check(firstUserBubble.includes('请先阅读 AGENTS.md'), '2.2 用户气泡显示首条提示原文')
    check(!firstUserBubble.includes('当前视图：'), '2.3 用户气泡不含视图框架')
    check(!firstUserBubble.includes('用户消息：'), '2.4 用户气泡不含 framing marker')
    check(firstUserBubble.trim() === firstPrompt.trim(), '2.5 用户气泡与输入一致')
    const fileChanges = await page.locator('[data-testid=dev-file-changes]').innerText()
    check(fileChanges.includes('docs/requirements/'), '2.6 文件变化列出写入文件')
    await waitFor(
      async () => (await page.locator('[data-testid=dev-status]').innerText()).includes('本轮完成'),
      10000,
      '状态变为本轮完成'
    )
    check(true, '2.3 状态：本轮完成')

    // ---------- 2b. 开发 prompt 包含设计系统/契约/蓝图/团队 skill/ui-check/digest ----------
    const startedState = await readState()
    const devPrompt = startedState.prompts[0]?.text ?? ''
    check(devPrompt.includes('docs/design/<MOD>/design.json'), '2b.1 prompt 含 design.json')
    check(devPrompt.includes('design-brief.md'), '2b.2 prompt 含 design-brief.md')
    check(devPrompt.includes('tokens.json'), '2b.3 prompt 含 tokens.json')
    check(devPrompt.includes('prototypes/*.png'), '2b.4 prompt 含 prototypes/*.png')
    check(devPrompt.includes('需求 > design-system/design.json 契约 > 蓝图'), '2b.5 prompt 含优先级')
    check(devPrompt.includes('EOS 后端不吃风格'), '2b.6 prompt 含 EOS 边界')
    check(devPrompt.includes('docs/design/design-system.json'), '2b.7 prompt 含 design-system.json')
    check(devPrompt.includes('docs/design/template/'), '2b.8 prompt 含蓝图根')
    check(devPrompt.includes('afcenter-page-generation'), '2b.9 prompt 含团队页面 skill')
    check(devPrompt.includes('pm-components-usage'), '2b.10 prompt 含 pm 组件 skill')
    check(devPrompt.includes('adw-frontend-implementation'), '2b.11 prompt 含开发方法 skill')
    check(devPrompt.includes('ui-check.md'), '2b.12 prompt 含 ui-check 软门禁')
    check(devPrompt.includes('PageTemplates'), '2b.13 prompt 含 PageTemplates')
    check(devPrompt.includes('pm-form-dialog'), '2b.14 prompt 含 pm-form-dialog')
    check(devPrompt.includes('GlobalPreference'), '2b.15 prompt 含 GlobalPreference')
    check(devPrompt.includes('冲突先报告'), '2b.16 prompt 含冲突上报')
    check(devPrompt.includes('【设计摘要】'), '2b.17 prompt 注入设计摘要')
    check(devPrompt.includes('MOD-001'), '2b.18 digest 含模块')
    check(devPrompt.includes('product-list 商品列表'), '2b.19 digest 含页面')
    check(devPrompt.includes('列=商品编码/商品名称/状态'), '2b.20 digest 含列')
    check(devPrompt.includes('ui-check：已生成未填'), '2b.21 digest 含 ui-check 状态')

    const uiCheckFile = path.join(harnessState.appDir, 'docs', 'design', 'MOD-001', 'ui-check.md')
    check(fs.existsSync(uiCheckFile), '2b.22 开发 prompt 生成 ui-check.md')
    const uiCheckContent = fs.readFileSync(uiCheckFile, 'utf8')
    check(uiCheckContent.includes('product-list'), '2b.23 ui-check 含设计页面')
    check(uiCheckContent.includes('商品编码、商品名称、状态'), '2b.24 ui-check 含字段/列')
    check(uiCheckContent.includes('## 实现前') && uiCheckContent.includes('## 实现后'), '2b.25 ui-check 含前后对照表')
    await waitFor(
      async () => (await page.locator('[data-testid=dev-ui-check-status]').innerText()) === '已生成未填',
      8000,
      'ui-check 状态变为已生成未填'
    )
    check(true, '2b.26 开发视图显示 ui-check 状态')
    const uiCheckPendingSkeleton = await page.locator('[data-testid=dev-ui-check-pending]').innerText()
    check(uiCheckPendingSkeleton.includes('实现前'), `2b.27 已生成未填时提示先填对照表（${uiCheckPendingSkeleton}）`)

    // ---------- 3. 慢速流式 ----------
    await sendMessage(page, '慢速输出开发说明')
    await waitFor(
      async () =>
        (await page.locator('[data-testid=dev-timeline] .user-message pre').last().innerText()).trim() === '慢速输出开发说明',
      8000,
      '用户气泡只显示原文'
    )
    check(true, '3.1 发送消息的用户气泡不含框架')
    await waitFor(
      async () => (await page.locator('[data-testid=dev-timeline]').innerText()).includes('第一段'),
      10000,
      '流式第一段出现'
    )
    const partialLength = (await page.locator('[data-testid=dev-timeline]').innerText()).length
    await waitFor(
      async () => (await page.locator('[data-testid=dev-timeline]').innerText()).includes('后续段落会继续追加'),
      15000,
      '流式完成'
    )
    const finalLength = (await page.locator('[data-testid=dev-timeline]').innerText()).length
    check(finalLength > partialLength, '3.1 文本逐步增长（流式）')
    await waitFor(
      async () => (await page.locator('[data-testid=dev-status]').innerText()).includes('本轮完成'),
      10000,
      '慢速轮次完成'
    )

    // ---------- 3b. 占位 → 首个内容替换 ----------
    await sendMessage(page, '流式占位：先占位再输出')
    await page.locator('[data-testid=dev-pending]').waitFor({ state: 'visible', timeout: 5000 })
    check(true, '3b.1 发送后出现占位')
    await page.locator('[data-testid=dev-pending]').waitFor({ state: 'detached', timeout: 8000 })
    await waitFor(
      async () => (await page.locator('[data-testid=dev-status]').innerText()).includes('本轮完成'),
      10000,
      '占位替换后完成'
    )
    check(true, '3b.2 首个内容替换占位')

    // ---------- 3c. reasoning 折叠块 ----------
    await sendMessage(page, '思考过程：整理开发计划')
    const reasoning = page.locator('[data-testid=dev-reasoning]').last()
    await reasoning.waitFor({ state: 'visible', timeout: 8000 })
    const reasoningText = await reasoning.evaluate(element => element.textContent || '')
    check(reasoningText.includes('先读工作区产物'), '3c.1 reasoning 内容')
    check((await reasoning.locator('summary').innerText()).includes('思考'), '3c.2 reasoning 标题')
    await waitFor(
      async () => (await page.locator('[data-testid=dev-status]').innerText()).includes('本轮完成'),
      10000,
      'reasoning 轮次完成'
    )
    check(true, '3c.3 reasoning 轮次完成')

    // ---------- 3d. 失败：占位替换为失败标记 ----------
    await sendMessage(page, '触发失败')
    const failed = page.locator('[data-testid=dev-pending-failed]')
    await failed.waitFor({ state: 'visible', timeout: 8000 })
    check((await failed.innerText()).includes('失败'), '3d.1 失败标记出现')
    check((await page.locator('.composer textarea').isEnabled()) === true, '3d.2 失败后可继续输入')

    // ---------- 4. 权限卡 ----------
    await sendMessage(page, '需要写入权限')
    const permissionCard = page.locator('.pending-card').first()
    await permissionCard.waitFor({ state: 'visible', timeout: 8000 })
    check((await permissionCard.innerText()).includes('允许本次写入'), '4.1 权限卡出现')
    await permissionCard.getByRole('button', { name: '允许一次', exact: true }).click()
    await waitFor(async () => (await page.locator('.pending-card').count()) === 0, 8000, '权限卡消失')
    await waitFor(
      async () => (await page.locator('[data-testid=dev-timeline]').innerText()).includes('已允许写入'),
      8000,
      '权限后继续'
    )
    await waitFor(
      async () => (await page.locator('[data-testid=dev-status]').innerText()).includes('本轮完成'),
      8000,
      '权限后回到完成状态'
    )
    check(true, '4.2 权限后继续执行')

    // ---------- 5. 停止：占位 → 中断 ----------
    await sendMessage(page, '开始静默长任务')
    await waitFor(
      async () => (await readState()).prompts.some(item => item.text.includes('开始静默长任务')),
      8000,
      '静默长任务 prompt 到达'
    )
    await page.locator('[data-testid=dev-pending]').waitFor({ state: 'visible', timeout: 8000 })
    check(true, '5.0 运行中显示本地占位')
    const stopLabel = page.locator('.composer').getByRole('button', { name: '停止', exact: true })
    await stopLabel.waitFor({ state: 'visible', timeout: 8000 })
    await waitFor(
      async () => {
        try {
          await stopLabel.click({ force: true, timeout: 1500 })
        } catch {
          // 重渲染时按钮可能短暂 detach，下一轮重试
        }
        return (await page.locator('[data-testid=dev-status]').innerText()).includes('已停止')
      },
      15000,
      '停止生效'
    )
    await page.locator('[data-testid=dev-pending-interrupted]').waitFor({ state: 'visible', timeout: 10000 })
    await waitFor(
      async () => (await page.locator('[data-testid=dev-timeline]').innerText()).includes('已中止'),
      10000,
      '停止后显示中止'
    )
    check((await page.locator('.composer textarea').isEnabled()) === true, '5.1 停止后输入可用')

    // ---------- 6. 重命名 ----------
    await page.locator('[data-testid=session-rename]').first().click()
    const promptInput = page.locator('.el-message-box__input input')
    await promptInput.waitFor({ state: 'visible', timeout: 6000 })
    await promptInput.fill('改造会话标题')
    await confirmBox(page, '保存')
    await waitFor(
      async () => (await page.locator('[data-testid=session-item]').first().innerText()).includes('改造会话标题'),
      8000,
      '重命名生效'
    )
    check(true, '6.1 重命名生效')

    // ---------- 7. 归档 → 无活跃 → 只读查看 ----------
    await page.locator('[data-testid=session-archive]').first().click()
    await confirmBox(page, '归档')
    await waitFor(async () => (await page.locator('[data-testid=session-item] .status-chip').first().innerText()).includes('已归档'), 8000, '归档状态')
    check(
      (await page.locator('[data-testid=dev-timeline]').innerText()).includes('选择或新建会话') ||
        (await page.locator('[data-testid=dev-readonly-bar]').count()) > 0,
      '7.1 归档后无活跃会话'
    )
    await page.locator('[data-testid=session-item]').first().click()
    await page.locator('[data-testid=dev-readonly-bar]').waitFor({ state: 'visible', timeout: 8000 })
    check((await page.locator('[data-testid=dev-readonly-bar]').innerText()).includes('只读'), '7.2 归档会话只读')

    // ---------- 8. 恢复为当前会话 ----------
    await page.locator('[data-testid=dev-readonly-bar]').getByRole('button', { name: '恢复为当前会话', exact: true }).click()
    await confirmBox(page, '恢复')
    await waitFor(async () => (await page.locator('[data-testid=dev-readonly-bar]').count()) === 0, 8000, '恢复后可写')
    check((await page.locator('[data-testid=dev-status]').innerText()).length > 0, '8.1 恢复后状态可用')

    // ---------- 9. compact ----------
    const compactBefore = (await readState()).compactCount
    await page.locator('[data-testid=compact-btn]').click()
    await confirmBox(page, '压缩')
    await waitFor(async () => (await readState()).compactCount > compactBefore, 8000, 'compact 被调用')
    check(true, '9.1 compact 生效')

    // ---------- 10. 上下文健康度 90% ----------
    await sendMessage(page, '上下文90 请继续')
    await waitFor(
      async () => (await page.locator('[data-testid=context-chip]').innerText()).includes('90%'),
      10000,
      '上下文 chip 90%'
    )
    await page.locator('[data-testid=context-hint]').waitFor({ state: 'visible', timeout: 8000 })
    check(
      (await page.locator('[data-testid=context-hint]').innerText()).includes('压缩'),
      '10.1 上下文提示条出现'
    )

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
      await gotoDev(matrixPage)
      await delay(600)

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
        const sessionsBox = await matrixPage.locator('[data-testid=dev-sessions]').boundingBox()
        check(sessionsBox !== null && sessionsBox.x < 0, `${item.width}/${item.theme} 初始会话抽屉收起`)
        await matrixPage.locator('[data-testid=dev-sidebar-toggle]').click()
        await delay(300)
        const opened = await matrixPage.locator('[data-testid=dev-sessions]').boundingBox()
        check(opened !== null && opened.x >= 0, `${item.width}/${item.theme} 会话抽屉展开`)
        await matrixPage.locator('[data-testid=dev-aside-toggle]').click()
        await delay(300)
        const closed = await matrixPage.locator('[data-testid=dev-sessions]').boundingBox()
        const aside = await matrixPage.locator('.dev-side').boundingBox()
        check(closed !== null && closed.x < 0, `${item.width}/${item.theme} 抽屉互斥（会话收起）`)
        check(
          aside !== null && aside.x > item.width / 2 && aside.x + aside.width <= item.width + 1,
          `${item.width}/${item.theme} 信息抽屉展开位置`
        )
        await matrixPage.keyboard.press('Escape')
        await delay(300)
        const escaped = await matrixPage.locator('.dev-side').boundingBox()
        check(escaped !== null && escaped.x >= item.width - 1, `${item.width}/${item.theme} Esc 关闭抽屉`)
      } else {
        const sessionsBox = await matrixPage.locator('[data-testid=dev-sessions]').boundingBox()
        const aside = await matrixPage.locator('.dev-side').boundingBox()
        check(sessionsBox !== null && sessionsBox.x >= 0 && sessionsBox.width > 200, `${item.width}/${item.theme} 三栏（会话）`)
        check(aside !== null && aside.x > 1000, `${item.width}/${item.theme} 三栏（信息）`)
      }

      await matrixPage.screenshot({ path: path.join(shotsDir, `p4-${item.width}-${item.theme}.png`), fullPage: false })
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

  console.log(`\n[p4-e2e] 通过：${assertions} 条断言；截图目录 ${shotsDir}`)
}

main().catch(error => {
  console.error(`\n[p4-e2e] 失败：${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
