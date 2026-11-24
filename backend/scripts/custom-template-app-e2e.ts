/**
 * P7-7c-1 自定义设计模板应用闭环 Playwright 验收（stub opencode，不调用模型）
 *
 * 前置：`npm run build --prefix frontend`；`npm run build --prefix backend`（harness 用 tsx，不强制）。
 * 运行：`npm run e2e:p7-7c --prefix backend`
 *
 * 覆盖：
 * 1. 通过 API 创建草稿 → 写 fixture spec（reference 运营 list + contract dialog-form）→ 生成 → 发布 1.0.0；
 * 2. 新建应用选择自定义 pack（API + UI picker：已发布可见、未发布草稿不列）；
 * 3. 工作区：design-system.json（origin/preview/kind/contractFile）、reference 蓝图、contract JSON、
 *    合并 structure、styles、设计模板 skill（kind/契约段/manifest）；受管副本删除后对齐恢复；
 * 4. 应用内资产接口（css 200 / json 400 / .. 400 / 缺失 404）；
 * 5. 设计视图「原型」：design-preview 使用自定义 structure + base 短类 + data-cyan 风格；contract dialog-form；
 *    模板风格 PNG 导出（宽高 + 主色像素）；
 * 6. 开发视图：digest 识别契约页（prompt）、ui-check 页面表/状态、fidelity 14 项（template-contract + api-design）；
 * 7. 全程 0 console error / pageerror / 请求失败（忽略 iframe abort）/ 外部请求。
 *
 * 端口/目录：默认 **3430/4430** 起（自动找空闲端口）；数据落在 `%TEMP%/workbench-p7-7c-e2e-*`；
 * 不占用真实 3300/4771，不读写真实 data/projects/.env，不调模型。
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type FrameLocator, type Page } from 'playwright'

const backendDir = path.resolve(__dirname, '..')
const frontendDist = path.resolve(backendDir, '../frontend/dist')
const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p7-7c-e2e-'))
const stateFile = path.join(runtimeRoot, 'harness-state.json')
const shotsDir = process.env.P7_7C_SHOTS_DIR || path.join(os.tmpdir(), 'workbench-p77c-shots')
const defaultAppId = 'p77c-bootstrap'
const customAppId = 'p77c-custom'
const customAppName = 'P7-7C 自定义模板应用'
const packId = 'supplier-hub'
const draftOnlyName = '未发布草稿模板'

fs.mkdirSync(shotsDir, { recursive: true })

let assertions = 0
let harness: ChildProcess | null = null
let browser: Browser | null = null

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

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

async function waitFor(checkFn: () => boolean | Promise<boolean>, timeoutMs: number, label: string): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await checkFn()) return
    await delay(100)
  }
  throw new Error(`等待超时（${timeoutMs}ms）：${label}`)
}

async function waitForText(
  locator: ReturnType<Page['locator']>,
  expected: string,
  label: string,
  timeoutMs = 20000
): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const text = (await locator.first().textContent().catch(() => ''))?.trim() || ''
    if (text.includes(expected)) return text
    await delay(150)
  }
  throw new Error(`等待超时（${timeoutMs}ms）：${label} 未包含“${expected}”`)
}

interface PageAudit {
  consoleErrors: string[]
  pageErrors: string[]
  failedRequests: string[]
  externalRequests: string[]
}

function auditPage(page: Page): PageAudit {
  const audit: PageAudit = { consoleErrors: [], pageErrors: [], failedRequests: [], externalRequests: [] }
  page.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (/favicon/i.test(text)) return
    audit.consoleErrors.push(text)
  })
  page.on('pageerror', error => audit.pageErrors.push(error.message))
  page.on('requestfailed', request => {
    const failure = request.failure()?.errorText || ''
    if (failure.includes('ERR_ABORTED')) return
    audit.failedRequests.push(`${request.url()} ${failure}`)
  })
  page.on('request', request => {
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) audit.externalRequests.push(request.url())
  })
  return audit
}

function checkAudit(audit: PageAudit, label: string): void {
  checkEqual(audit.consoleErrors.length, 0, `${label} console error 为 0${audit.consoleErrors[0] ? `（${audit.consoleErrors[0]}）` : ''}`)
  checkEqual(audit.pageErrors.length, 0, `${label} pageerror 为 0`)
  checkEqual(audit.failedRequests.length, 0, `${label} 请求失败为 0`)
  checkEqual(audit.externalRequests.length, 0, `${label} 外部请求为 0`)
}

async function request(
  base: string,
  method: string,
  apiPath: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
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

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

interface HarnessStateFile {
  ready?: boolean
  prompts?: Array<{ text: string }>
}

/** harness 状态文件由进程内非原子写入：读取失败（半截 JSON）时返回 null，由 waitFor 重试 */
function readHarnessState(): HarnessStateFile | null {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8')) as HarnessStateFile
  } catch {
    return null
  }
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function startHarness(port: number): void {
  harness = spawn('npx', ['tsx', 'scripts/p2-e2e-harness.ts'], {
    cwd: backendDir,
    shell: true,
    windowsHide: true,
    env: {
      ...process.env,
      P2_ROOT: runtimeRoot,
      P2_STATE_FILE: stateFile,
      P2_PORT: String(port),
      P2_APP_ID: defaultAppId,
      P2_APP_NAME: 'P7-7C bootstrap'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  harness.stdout?.on('data', chunk => process.stdout.write(`[harness] ${chunk}`))
  harness.stderr?.on('data', chunk => process.stderr.write(`[harness] ${chunk}`))
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

/** 测试 fixture：reference + contract（不经真实 agent） */
function fixtureSpec(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: packId,
    name: '供应商管理模板',
    description: '供应商台账（引用运营列表）+ 弹窗表单（契约）',
    baseApplicationType: 'enterprise-application-platform',
    style: 'data-cyan',
    pages: [
      {
        id: 'supplier-list',
        name: '供应商列表',
        kind: 'reference',
        source: { pack: 'afcenter-app-templates-v1', applicationType: 'operations-management', pageId: 'list' }
      },
      {
        id: 'supplier-form',
        name: '供应商表单',
        kind: 'contract',
        type: 'form',
        recipe: 'dialog-form',
        contract: {
          form: {
            presentation: 'dialog',
            columns: 2,
            width: 900,
            groups: [{ title: '基本信息', fields: ['code', 'name', 'status'] }]
          }
        },
        sampleEntity: {
          id: 'supplier',
          name: '供应商',
          fields: [
            { name: 'code', label: '供应商编码', type: 'string' },
            { name: 'name', label: '供应商名称', type: 'string' },
            { name: 'status', label: '状态', type: 'enum', options: ['启用', '停用', '草稿'] }
          ]
        }
      }
    ]
  }
}

/** 应用工作区 fixture：单需求文档 + 实体/页面集（引用自定义模板两页） */
function seedAppWorkspace(appDir: string): void {
  write(
    path.join(appDir, 'docs/requirements/requirements.md'),
    '---\ntitle: "供应商管理"\ntemplate: builtin-prd-lite\n---\n\n# 供应商管理\n\n## 1. 目标\n\n维护供应商台账。\n\n### EP-001 供应商管理\n'
  )
  write(
    path.join(appDir, 'docs/design/entities.json'),
    json({
      schemaVersion: 2,
      entities: [
        {
          id: 'supplier',
          name: '供应商',
          fields: [
            { code: 'code', name: '供应商编码', type: 'string' },
            { code: 'name', name: '供应商名称', type: 'string' },
            {
              code: 'status',
              name: '状态',
              type: 'enum',
              options: [
                { value: 'ENABLED', label: '启用' },
                { value: 'DISABLED', label: '停用' },
                { value: 'DRAFT', label: '草稿' }
              ]
            }
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
          id: 'supplier',
          epic: 'EP-001',
          title: '供应商管理',
          primaryEntity: 'supplier',
          pages: [
            {
              id: 'supplier-list',
              name: '供应商列表',
              type: 'list',
              recipe: 'list',
              catalogRef: `${packId}/supplier-list`,
              entity: 'supplier',
              columns: ['code', 'name', 'status'],
              filters: ['name'],
              rowActions: ['edit', 'delete'],
              toolbarActions: ['create'],
              pagination: { layout: 'three-part', pageSize: 20 }
            },
            {
              id: 'supplier-form',
              name: '供应商表单',
              type: 'form',
              recipe: 'dialog-form',
              catalogRef: `${packId}/supplier-form`,
              entity: 'supplier',
              form: {
                presentation: 'dialog',
                columns: 2,
                width: 900,
                groups: [{ title: '基本信息', fields: ['code', 'name', 'status'] }]
              }
            }
          ]
        }
      ]
    })
  )
}

interface PngSample {
  width: number
  height: number
  primaryMatches: number
}

/** 读取 PNG → base64 → 浏览器 Image+canvas 采样（容差 ±14；data-cyan #145fba） */
async function samplePng(page: Page, file: string): Promise<PngSample> {
  const dataUrl = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
  return page.evaluate(
    async ({ dataUrl }: { dataUrl: string }) => {
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
      if (!ctx) return { width, height, primaryMatches: 0 }
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, width, height).data
      let primaryMatches = 0
      for (let index = 0; index < data.length; index += 4) {
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        if (Math.abs(r - 20) <= 14 && Math.abs(g - 95) <= 14 && Math.abs(b - 186) <= 14) primaryMatches += 1
      }
      return { width, height, primaryMatches }
    },
    { dataUrl }
  )
}

function frameOf(page: Page): FrameLocator {
  return page.frameLocator('[data-testid=prototype-preview-frame]')
}

async function main(): Promise<void> {
  check(fs.existsSync(path.join(frontendDist, 'index.html')), 'frontend/dist/index.html 已构建')
  check(fs.existsSync(path.join(frontendDist, 'preview.html')), 'frontend/dist/preview.html 已构建')
  check(fs.existsSync(path.join(frontendDist, 'design-preview.html')), 'frontend/dist/design-preview.html 已构建')
  check(fs.existsSync(path.join(frontendDist, 'template-preview.html')), 'frontend/dist/template-preview.html 已构建')

  const port = await freePort(3430)
  const base = `http://127.0.0.1:${port}`
  const dataRoot = path.join(runtimeRoot, 'data')
  const projectsRoot = path.join(runtimeRoot, 'projects')

  startHarness(port)
  await waitFor(
    () => fs.existsSync(stateFile) && fs.readFileSync(stateFile, 'utf8').includes('"ready": true'),
    60000,
    'harness 就绪'
  )
  await waitFor(async () => {
    try {
      return (await fetch(`${base}/api/health`)).ok
    } catch {
      return false
    }
  }, 60000, 'harness /api/health')

  // ---------- 1. API 创建/生成/发布自定义 pack ----------
  const created = await request(base, 'POST', '/design-templates/drafts', {
    id: packId,
    name: '供应商管理模板',
    style: 'data-cyan',
    baseApplicationType: 'enterprise-application-platform'
  })
  checkEqual(created.status, 201, '创建自定义模板草稿')
  checkEqual(created.data?.draft?.id, packId, '草稿 id 为 supplier-hub')
  const specFile = path.join(dataRoot, 'design-system', '_workshop', 'drafts', packId, 'spec.json')
  check(fs.existsSync(specFile), 'starter spec.json 已生成')
  write(specFile, json(fixtureSpec()))
  const generated = await request(base, 'POST', `/design-templates/drafts/${packId}/generate`)
  checkEqual(generated.status, 200, '生成草稿 pack')
  checkEqual(generated.data?.ok, true, '生成无错误')
  const published = await request(base, 'POST', `/design-templates/drafts/${packId}/publish`)
  checkEqual(published.status, 200, '发布自定义模板')
  checkEqual(published.data?.pack?.version, '1.0.0', '首次发布版本 1.0.0')

  const packs = await request(base, 'GET', '/design-system')
  const customSummary = (packs.data?.packs as Array<Record<string, unknown>>).find(item => item.id === packId)
  check(Boolean(customSummary), 'GET /api/design-system 可见自定义 pack')
  checkEqual(customSummary?.templateKind, 'custom', '自定义 pack templateKind=custom')

  // 未发布草稿（只创建，不生成/发布）
  const draftOnly = await request(base, 'POST', '/design-templates/drafts', {
    name: draftOnlyName,
    style: 'data-cyan',
    baseApplicationType: 'enterprise-application-platform'
  })
  checkEqual(draftOnly.status, 201, '创建未发布草稿')
  const draftOnlyId = String(draftOnly.data?.draft?.id || '')
  check(Boolean(draftOnlyId) && draftOnlyId !== packId, '未发布草稿 id 与已发布不同')

  // ---------- 2. 新建应用选择自定义 pack（API） ----------
  const appCreated = await request(base, 'POST', '/apps', {
    id: customAppId,
    name: customAppName,
    designSystem: { pack: packId, applicationType: packId, style: 'data-cyan' }
  })
  checkEqual(appCreated.status, 201, '新建应用选择自定义模板')
  const customApp = appCreated.data?.app as Record<string, unknown>
  const appDesign = customApp?.designSystem as Record<string, unknown>
  checkEqual((appDesign?.pack as Record<string, unknown>)?.source, 'custom', '应用设计系统来源 custom')
  checkEqual((appDesign?.origin as Record<string, unknown>)?.baseApplicationType, 'enterprise-application-platform', '应用摘要记录 base 类型')

  // ---------- 3. 工作区文件 ----------
  const appDir = path.join(projectsRoot, customAppId)
  const designSystemFile = path.join(appDir, 'docs/design/design-system.json')
  check(fs.existsSync(designSystemFile), 'docs/design/design-system.json 已生成')
  fs.copyFileSync(designSystemFile, path.join(shotsDir, 'p7-7c-design-system.json'))
  const summary = JSON.parse(fs.readFileSync(designSystemFile, 'utf8')) as Record<string, any>
  checkEqual(summary.schemaVersion, 1, 'design-system schemaVersion=1')
  checkEqual(summary.origin?.kind, 'custom', 'design-system origin.kind=custom')
  checkEqual(summary.origin?.baseApplicationType, 'enterprise-application-platform', 'origin.baseApplicationType')
  checkEqual(summary.preview?.kind, 'custom', 'design-system preview.kind=custom')
  checkEqual(summary.preview?.baseApplicationType, 'enterprise-application-platform', 'preview.baseApplicationType')
  checkEqual(summary.preview?.styleClassName, 'visual-style-data-cyan', 'preview.styleClassName')
  check(
    String(summary.preview?.structureUrl).includes(`/api/apps/${customAppId}/design-system/asset?path=`),
    `preview.structureUrl 指向应用内资产接口（${summary.preview?.structureUrl}）`
  )
  const pageList = summary.pages.find((page: any) => page.id === 'supplier-list')
  const pageForm = summary.pages.find((page: any) => page.id === 'supplier-form')
  checkEqual(pageList?.kind, 'reference', 'reference 页 kind')
  check(Boolean(pageList?.blueprint) && fs.existsSync(path.join(appDir, pageList.blueprint)), 'reference 蓝图副本存在')
  checkEqual(pageList?.source?.applicationType, 'operations-management', 'reference source 记录来源类型')
  checkEqual(pageForm?.kind, 'contract', 'contract 页 kind')
  checkEqual(pageForm?.blueprint, undefined, 'contract 页不写 blueprint')
  checkEqual(pageForm?.contractFile, `docs/design/template/${packId}/contracts/supplier-form.json`, 'contractFile 路径')
  check(fs.existsSync(path.join(appDir, pageForm.contractFile)), 'contract 文件存在')
  check(!fs.existsSync(path.join(appDir, `docs/design/template/${packId}/pages/supplier-form.vue`)), 'contract 页不产生 .vue')
  const contract = JSON.parse(fs.readFileSync(path.join(appDir, pageForm.contractFile), 'utf8')) as Record<string, any>
  checkEqual(contract.schemaVersion, 1, '契约文件 schemaVersion=1')
  checkEqual(contract.pageId, 'supplier-form', '契约文件 pageId')
  checkEqual(contract.recipe, 'dialog-form', '契约文件 recipe')
  checkEqual(contract.sampleEntity?.id, 'supplier', '契约文件 sampleEntity')

  const structureFile = path.join(appDir, `docs/design/template/${packId}/structure.css`)
  check(fs.existsSync(structureFile), '合并 structure.css 已复制')
  const structureText = fs.readFileSync(structureFile, 'utf8')
  check(structureText.includes('application-type-operations'), '合并 structure 含 reference 来源类型规则')
  check(structureText.length > 1000, `合并 structure 体量（${structureText.length} 字符）`)
  check(fs.existsSync(path.join(appDir, 'docs/design/template/styles/shared.css')), 'styles/shared.css 已复制')
  check(fs.existsSync(path.join(appDir, 'docs/design/template/styles/data-cyan/style.css')), 'styles/data-cyan/style.css 已复制')

  const skillDir = path.join(appDir, '.opencode', 'skills', `adw-template-proto-${packId}`)
  const skillMd = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')
  check(skillMd.includes('| 页面 id | 名称 | 种类 | 配方 | 蓝图/契约 | 主要组件 |'), '设计模板 skill 页面表含 kind 列')
  check(skillMd.includes('reference') && skillMd.includes('contract'), '设计模板 skill 标注 reference/contract')
  check(skillMd.includes('契约（无蓝图）'), '设计模板 skill 契约页标注无蓝图')
  check(skillMd.includes('## 契约页实现（无蓝图）'), '设计模板 skill 含契约页实现段')
  const skillManifest = JSON.parse(fs.readFileSync(path.join(skillDir, '_manifest.json'), 'utf8')) as Record<string, any>
  checkEqual(skillManifest.kind, 'design-system', 'skill manifest kind')
  checkEqual(skillManifest.templateKind, 'custom', 'skill manifest templateKind=custom')
  checkEqual(skillManifest.packVersion, '1.0.0', 'skill manifest packVersion')

  // 受管副本删除 → 打开应用对齐恢复
  fs.rmSync(path.join(appDir, pageForm.contractFile))
  const reopened = await request(base, 'GET', `/apps/${customAppId}`)
  checkEqual(reopened.status, 200, '重新打开应用（对齐受管副本）')
  check(fs.existsSync(path.join(appDir, pageForm.contractFile)), '契约文件对齐恢复')

  // ---------- 4. 应用内资产接口 ----------
  const assetOk = await fetch(
    `${base}/api/apps/${customAppId}/design-system/asset?path=${encodeURIComponent(`${packId}/structure.css`)}`
  )
  checkEqual(assetOk.status, 200, '应用资产接口返回 structure.css')
  check(/text\/css/.test(String(assetOk.headers.get('content-type'))), '资产 Content-Type 为 text/css')
  check((await assetOk.text()).includes('application-type-operations'), '资产内容为合并 structure')
  const assetJson = await fetch(
    `${base}/api/apps/${customAppId}/design-system/asset?path=${encodeURIComponent(`${packId}/contracts/supplier-form.json`)}`
  )
  checkEqual(assetJson.status, 400, '资产接口拒绝 .json')
  const assetTraversal = await fetch(
    `${base}/api/apps/${customAppId}/design-system/asset?path=${encodeURIComponent('../requirements/requirements-x.md')}`
  )
  checkEqual(assetTraversal.status, 400, '资产接口拒绝 .. 路径')
  const assetMissing = await fetch(
    `${base}/api/apps/${customAppId}/design-system/asset?path=${encodeURIComponent(`${packId}/missing.css`)}`
  )
  checkEqual(assetMissing.status, 404, '资产接口缺失返回 404')

  // 应用工作区设计 fixture
  seedAppWorkspace(appDir)

  browser = await chromium.launch()
  const context: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()
  const audit = auditPage(page)

  // ---------- 5. picker：已发布自定义可见、未发布草稿不列 ----------
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await waitForText(page.locator('h1'), '从一个应用开始', '首页标题')
  await page.getByRole('button', { name: '新建应用' }).first().click()
  const newAppDialog = page.locator('.dialog[role="dialog"]').last()
  await newAppDialog.waitFor({ state: 'visible', timeout: 10000 })
  await newAppDialog.getByTestId('new-app-design-picker').click()
  const picker = page.getByTestId('design-template-center')
  await picker.waitFor({ state: 'visible', timeout: 10000 })
  await picker.getByTestId('design-template-back').waitFor({ state: 'visible', timeout: 20000 })
  await picker.getByTestId('design-template-back').click()
  const customPick = picker.getByTestId(`design-template-custom-pick-${packId}`)
  await customPick.waitFor({ state: 'visible', timeout: 20000 })
  check((await customPick.innerText()).includes('供应商管理模板'), 'picker 显示已发布自定义模板')
  check((await customPick.innerText()).includes('数据蓝青'), 'picker 卡片显示风格')
  check((await customPick.innerText()).includes('自定义'), 'picker 卡片标注自定义')
  checkEqual(
    await picker.locator('[data-testid^="design-template-custom-pick-"]').count(),
    1,
    'picker 只列出 1 个已发布自定义模板'
  )
  checkEqual(
    await picker.locator(`[data-testid="design-template-custom-pick-${draftOnlyId}"]`).count(),
    0,
    '未发布草稿不出现在 picker'
  )
  checkEqual(await picker.locator('[data-testid^="design-template-card-"]').count(), 4, 'picker 仍保留 4 个内置应用类型')
  await page.screenshot({ path: path.join(shotsDir, 'p7-7c-picker.png') })

  await customPick.click()
  await waitForText(picker.locator('.detail-side h3'), '供应商管理模板', 'picker 自定义详情')
  checkEqual(await picker.getByTestId('design-template-style-data-cyan').count(), 1, '自定义详情显示风格')
  await waitFor(
    async () => (await picker.locator('.pages-grid .page-card').count()) === 2,
    15000,
    '自定义页面库 2 页'
  )
  const customPageText = (await picker.locator('.pages-grid').innerText()).trim()
  check(customPageText.includes('引用页') && customPageText.includes('契约页'), '页面库显示 kind 标签')
  check(customPageText.includes('afcenter-app-templates-v1/operations-management/list'), '页面库显示 reference 来源')
  await picker.getByTestId('design-template-use').click()
  await picker.waitFor({ state: 'hidden', timeout: 8000 })
  // 详情是异步加载的：先等摘要出现自定义模板名/标签，再断言（避免读到内置回退摘要）
  const summaryLocator = newAppDialog.getByTestId('new-app-design-summary')
  await waitForText(summaryLocator, '供应商管理模板', 'picker 回填自定义模板名')
  await waitForText(summaryLocator, '自定义模板', 'picker 回填自定义模板标签')
  const summaryText = (await summaryLocator.innerText()).trim()
  check(summaryText.includes('供应商管理模板') && summaryText.includes('数据蓝青'), `picker 回填自定义模板与风格（${summaryText}）`)
  check(summaryText.includes('自定义模板'), 'picker 回填标注自定义模板')
  await newAppDialog.getByRole('button', { name: '取消' }).click()
  await newAppDialog.waitFor({ state: 'hidden', timeout: 8000 })

  // ---------- 6. 设计视图：自定义 structure + base 类 + contract 页 + PNG ----------
  await page.goto(`${base}/#/apps/${customAppId}/design`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=design-view]').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('design-tab-prototype').click()
  await page.getByTestId('design-pageset-supplier').waitFor({ state: 'visible', timeout: 15000 })
  const frameLocator = page.locator('[data-testid=prototype-preview-frame]')
  await frameLocator.waitFor({ state: 'visible', timeout: 30000 })
  const src = (await frameLocator.getAttribute('src')) || ''
  check(src.startsWith('/design-preview.html?'), `原型 iframe 指向 design-preview（${src}）`)
  check(src.includes(`type=${packId}`), 'iframe type 为自定义 pack id')
  check(src.includes('style=data-cyan'), 'iframe style 为 data-cyan')

  const frame = frameOf(page)
  await frame.locator('.design-preview-root').waitFor({ state: 'visible', timeout: 30000 })
  checkEqual(await frame.locator('.design-preview-root.visual-style-data-cyan').count(), 1, '自定义预览使用 data-cyan 风格类')
  checkEqual(
    await frame.locator('.optimized-suite.application-type-enterprise-platform').count(),
    1,
    '自定义预览根类使用 base 短类（enterprise-platform）'
  )
  checkEqual(await frame.locator('[data-template-kind=custom]').count(), 1, '自定义预览标记 template-kind=custom')
  const injectedSize = await frame
    .locator('#design-preview-structure-css')
    .evaluate(el => (el.textContent || '').length)
    .catch(() => 0)
  check(injectedSize > 1000, `design-preview 注入自定义合并 structure（${injectedSize} 字符）`)
  const injected = await frame.locator('#design-preview-structure-css').evaluate(el => el.textContent || '')
  check(injected.includes('application-type-operations'), '注入的 structure 含 reference 来源类型规则')
  await frame.locator('[data-testid=contract-list-panel]').waitFor({ state: 'visible', timeout: 20000 })
  check((await frame.locator('.contract-table .el-table').count()) === 1, '列表契约渲染 pm-table（.contract-table .el-table）')
  await page.screenshot({ path: path.join(shotsDir, 'p7-7c-design-list.png') })

  await page.getByTestId('page-chip-supplier-form').click()
  await frame.locator('[data-testid=contract-page-dialog-form]').waitFor({ state: 'visible', timeout: 20000 })
  checkEqual(await frame.locator('[data-testid=contract-dialog-backdrop]').count(), 1, 'contract dialog-form 渲染背景列表')
  const dialog = frame.locator('.el-dialog').first()
  await dialog.waitFor({ state: 'visible', timeout: 20000 })
  const dialogText = (await dialog.innerText()).trim()
  check(dialogText.includes('供应商表单'), 'dialog-form 标题=页面标题')
  check(dialogText.includes('供应商编码') && dialogText.includes('供应商名称') && dialogText.includes('状态'), 'dialog-form 字段来自契约/实体')
  check((await dialog.locator('.form-section').count()) >= 1, 'dialog-form 使用 FormSection 分组')
  await dialog.scrollIntoViewIfNeeded().catch(() => undefined)
  await page.screenshot({ path: path.join(shotsDir, 'p7-7c-design-form.png') })

  // PNG：自动导出或手动触发；等待 manifest 与 png
  const prototypesDir = path.join(appDir, 'docs/design/prototypes')
  if (!fs.existsSync(path.join(prototypesDir, '_manifest.json'))) {
    await page.getByTestId('design-reexport-btn').click().catch(() => undefined)
  }
  await waitFor(() => fs.existsSync(path.join(prototypesDir, '_manifest.json')), 90000, 'prototypes manifest')
  const manifest = JSON.parse(fs.readFileSync(path.join(prototypesDir, '_manifest.json'), 'utf8')) as Record<string, any>
  check(Object.keys(manifest.pages || {}).length >= 2, 'PNG manifest 含 2 页')
  const listPng = path.join(prototypesDir, 'supplier-list.png')
  check(fs.existsSync(listPng), 'supplier-list.png 已导出')
  fs.copyFileSync(listPng, path.join(shotsDir, 'p7-7c-supplier-list.png'))
  const sample = await samplePng(page, listPng)
  check(sample.width > 800, `PNG 宽 > 800（实际 ${sample.width}）`)
  check(sample.height > 400, `PNG 高 > 400（实际 ${sample.height}）`)
  check(sample.primaryMatches > 0, `PNG 存在 data-cyan 主色像素（${sample.primaryMatches}）`)

  // ---------- 7. 开发视图：digest / ui-check / fidelity 14 项 ----------
  await page.goto(`${base}/#/apps/${customAppId}/development`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid=dev-view]').waitFor({ state: 'visible', timeout: 20000 })
  check((await page.locator('[data-testid=dev-module-select]').count()) === 0, '开发视图无模块下拉')

  // 触发开发会话（首条提示；后端注入应用级设计摘要并生成 ui-check 骨架）
  await page.locator('[data-testid=dev-start-card]').waitFor({ state: 'visible', timeout: 12000 })
  const startPromptInput = page.locator('[data-testid=dev-start-prompt]')
  await waitFor(
    async () => (await startPromptInput.inputValue()).includes('AGENTS.md'),
    10000,
    '开发首条提示已载入'
  )
  const firstPrompt = await startPromptInput.inputValue()
  check(firstPrompt.includes('AGENTS.md'), '开发首条提示包含 AGENTS.md（开发上下文）')
  await page.locator('[data-testid=dev-start-btn]').click()
  await waitFor(
    () => {
      const current = readHarnessState()
      return (current?.prompts ?? []).some(prompt => prompt.text.includes('【设计摘要】'))
    },
    30000,
    '开发 prompt 携带设计摘要'
  )
  const state = readHarnessState() ?? { prompts: [] }
  const digestPrompt = [...(state.prompts ?? [])].reverse().find(prompt => prompt.text.includes('【设计摘要】'))?.text || ''
  check(digestPrompt.includes('自定义模板（base=enterprise-application-platform）'), 'digest 标注自定义模板/base 类型')
  check(digestPrompt.includes('kind=reference'), 'digest 标注 reference 页 kind')
  check(digestPrompt.includes('kind=contract'), 'digest 标注 contract 页 kind')
  check(digestPrompt.includes('无蓝图，按契约实现'), 'digest 契约页提示无蓝图')
  check(
    digestPrompt.includes(`contract=docs/design/template/${packId}/contracts/supplier-form.json`),
    'digest 给出契约文件路径'
  )
  check(digestPrompt.includes('契约：') && digestPrompt.includes('表单=dialog 2 列 900px'), 'digest 汇总契约表单')

  const uiCheckFile = path.join(appDir, 'docs/design/ui-check.md')
  check(fs.existsSync(uiCheckFile), 'ui-check 骨架已生成')
  const uiCheckText = fs.readFileSync(uiCheckFile, 'utf8')
  check(uiCheckText.includes('| 设计页 | 类型/来源 | 蓝图 | 契约 |'), 'ui-check 页面表含类型/来源/契约')
  check(uiCheckText.includes('reference ← afcenter-app-templates-v1/operations-management/list'), 'ui-check 显示 reference 来源')
  check(uiCheckText.includes('无（契约页）'), 'ui-check 契约页蓝图写“无（契约页）”')
  check(uiCheckText.includes(`contracts/supplier-form.json`), 'ui-check 给出契约文件')
  fs.copyFileSync(uiCheckFile, path.join(shotsDir, 'p7-7c-ui-check.md'))
  await waitForText(page.getByTestId('dev-ui-check-status'), '已生成', '开发视图 ui-check 状态')

  await page.getByTestId('dev-fidelity-check').click()
  const report = page.getByTestId('dev-fidelity-report')
  await report.waitFor({ state: 'visible', timeout: 20000 })
  checkEqual(await report.locator('.fidelity-item').count(), 14, 'fidelity 报告 14 项')
  const apiDesignItem = page.getByTestId('dev-fidelity-check-api-design')
  await apiDesignItem.waitFor({ state: 'visible', timeout: 8000 })
  check((await apiDesignItem.innerText()).includes('警告'), 'fidelity api-design 缺失时为警告')
  const contractItem = page.getByTestId('dev-fidelity-check-template-contract')
  await contractItem.waitFor({ state: 'visible', timeout: 8000 })
  check((await contractItem.innerText()).includes('模板契约页'), 'fidelity 含模板契约页检查项')
  check((await contractItem.innerText()).includes('通过'), '模板契约页检查通过（文件存在/recipe 一致）')
  const blueprintItem = page.getByTestId('dev-fidelity-check-blueprint-files')
  check((await blueprintItem.innerText()).includes('契约页'), '蓝图检查提及契约页（无蓝图）')
  const reportText = await report.innerText()
  check(reportText.includes('只读报告'), 'fidelity 报告标注只读')
  await page.screenshot({ path: path.join(shotsDir, 'p7-7c-development.png') })

  // ---------- 8. 移动端（390×844）：设计视图原型 iframe 可见、整页无横向溢出 ----------
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mobilePage = await mobileContext.newPage()
  const mobileAudit = auditPage(mobilePage)
  await mobilePage.goto(`${base}/#/apps/${customAppId}/design`, { waitUntil: 'domcontentloaded' })
  await mobilePage.locator('[data-testid=design-view]').waitFor({ state: 'visible', timeout: 20000 })
  await mobilePage.getByTestId('design-tab-prototype').click()
  await mobilePage.getByTestId('design-pageset-supplier').waitFor({ state: 'visible', timeout: 15000 })
  await mobilePage.locator('[data-testid=prototype-preview-frame]').waitFor({ state: 'visible', timeout: 30000 })
  checkEqual(
    await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
    false,
    '390×844 设计视图无整页横向溢出'
  )
  const mobileProtoFrame = mobilePage.frameLocator('[data-testid=prototype-preview-frame]')
  await mobileProtoFrame.locator('.design-preview-root').waitFor({ state: 'visible', timeout: 30000 })
  checkEqual(
    await mobileProtoFrame.locator('html').first().evaluate(el => el.scrollWidth > el.clientWidth + 1),
    false,
    '390×844 原型 iframe 无横向溢出（iframe 内允许容器横向滚动）'
  )
  const mobileExportBox = await mobilePage.getByTestId('export-png-btn').boundingBox()
  check(Boolean(mobileExportBox && mobileExportBox.x >= 0 && mobileExportBox.y >= 0 && mobileExportBox.x + mobileExportBox.width <= 390), '390×844 导出 PNG 按钮在视口内可点')
  await mobilePage.screenshot({ path: path.join(shotsDir, 'p7-7c-design-mobile.png') })

  await mobilePage.getByTestId('page-chip-supplier-form').click()
  await mobileProtoFrame.locator('[data-testid=contract-page-dialog-form]').waitFor({ state: 'visible', timeout: 20000 })
  checkEqual(
    await mobileProtoFrame.locator('html').first().evaluate(el => el.scrollWidth > el.clientWidth + 1),
    false,
    '390×844 契约页 iframe 无横向溢出'
  )
  await mobilePage.screenshot({ path: path.join(shotsDir, 'p7-7c-design-form-mobile.png') })
  await mobileContext.close()
  checkAudit(mobileAudit, 'P7-7C 移动端 390×844')

  checkAudit(audit, 'P7-7C 应用闭环')

  console.log(`\n[p7-7c-e2e] 通过：${assertions} 条断言`)
  console.log(`[p7-7c-e2e] 截图目录：${shotsDir}`)
  console.log(`[p7-7c-e2e] 临时数据：${runtimeRoot}`)
}

main()
  .catch(error => {
    console.error(`\n[p7-7c-e2e] 失败：${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await browser?.close()
    } catch {
      // ignore
    }
    stopHarness()
    try {
      fs.rmSync(runtimeRoot, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })
