/**
 * 设计一致性检查（应用级，D1；脚本 + 服务/API 语义）
 *
 * - 脚本 fixture：pass/warn/fail、无设计、--strict；
 * - 后端：正常、无应用、无设计、应用目录缺失；
 * - D2 保持 14 项（新增 api-design）；
 * - 临时目录；不启动 opencode、不调用模型。
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-dev-fidelity-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

const script = path.resolve(
  __dirname,
  '../../../templates/agent/skills/adw-frontend-implementation/scripts/check-fidelity.mjs'
)

interface Setup {
  db: typeof import('../db').db
  scaffold: typeof import('../apps/scaffold')
  fidelity: typeof import('./fidelity')
}

let setupPromise: Promise<Setup> | null = null

function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const dbModule = await import('../db')
    const scaffold = await import('../apps/scaffold')
    const fidelity = await import('./fidelity')
    return { db: dbModule.db, scaffold, fidelity }
  })()
  return setupPromise
}

after(async () => {
  if (setupPromise) {
    const { db } = await setupPromise
    db.close()
  }
  fs.rmSync(root, { recursive: true, force: true })
})

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function appRoot(name: string): string {
  const dir = path.join(root, 'fixtures', name)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

const DESIGN_SYSTEM = {
  schemaVersion: 1,
  pack: 'afcenter-app-templates-v1',
  packVersion: '1.0.0',
  applicationType: 'enterprise-application-platform',
  style: 'platform-blue',
  styleName: '平台蓝白',
  blueprintRoot: 'docs/design/template',
  templateDir: 'docs/design/template/enterprise-application-platform',
  styles: {
    shared: 'docs/design/template/styles/shared.css',
    style: 'docs/design/template/styles/platform-blue/style.css',
    styleId: 'platform-blue'
  },
  pages: [
    {
      id: 'organization',
      name: '组织与用户',
      recipe: 'tree-list',
      blueprint: 'docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue'
    },
    {
      id: 'application-form',
      name: '注册应用',
      recipe: 'wizard',
      blueprint: 'docs/design/template/enterprise-application-platform/pages/ApplicationForm.vue'
    }
  ]
}

const ENTITIES = {
  schemaVersion: 2,
  entities: [{ id: 'product', name: '商品', fields: [{ code: 'productName', name: '商品名称', type: 'string' }] }],
  relations: []
}

const PASS_PAGES = {
  schemaVersion: 2,
  pageSets: [
    {
      id: 'product',
      epic: 'EP-001',
      title: '商品管理',
      pages: [
        {
          id: 'product-list',
          name: '商品列表',
          type: 'list',
          recipe: 'list',
          entity: 'product',
          columns: ['productName'],
          rowActions: ['detail', 'edit', 'delete'],
          toolbarActions: ['create', 'export'],
          catalogRef: 'enterprise-application-platform/organization'
        },
        {
          id: 'product-form',
          name: '商品编辑',
          type: 'form',
          recipe: 'dialog-form',
          entity: 'product',
          blueprint: 'application-types/enterprise-application-platform/pages/ApplicationForm.vue'
        }
      ]
    }
  ]
}

function writeBlueprint(appDir: string, name: string): void {
  write(
    path.join(appDir, 'docs/design/template/enterprise-application-platform/pages', name),
    '<template><div /></template>\n'
  )
}

function designSystemFile(appDir: string, value: unknown = DESIGN_SYSTEM): void {
  write(path.join(appDir, 'docs/design/design-system.json'), json(value))
}

function designFiles(appDir: string, pages: unknown = PASS_PAGES, entities: unknown = ENTITIES): void {
  write(path.join(appDir, 'docs/design/entities.json'), json(entities))
  write(path.join(appDir, 'docs/design/pages.json'), json(pages))
}

function uiCheckFile(appDir: string, content?: string): void {
  write(
    path.join(appDir, 'docs/design/ui-check.md'),
    content ?? '# 页面对照表（应用级）\n\n## 实现前\n\n| 设计页 | 路由 |\n| --- | --- |\n| product-list | /product |\n'
  )
}

function skeletonUiCheckFile(appDir: string): void {
  const body = '# 页面对照表（应用级）\n\n## 实现前\n\n| 设计页 | 路由 |\n| --- | --- |\n| product-list | /product |\n'
  const hash = createHash('sha256').update(body).digest('hex')
  write(path.join(appDir, 'docs/design/ui-check.md'), `<!-- adw:ui-check:skeleton hash:${hash} -->\n${body}`)
}

/** 与 core/后端一致：sha256(entities + pages + design-system) */
function designHashOf(appDir: string): string {
  const hash = createHash('sha256')
  for (const relative of ['docs/design/entities.json', 'docs/design/pages.json', 'docs/design/design-system.json']) {
    const file = path.join(appDir, relative)
    hash.update(fs.existsSync(file) ? fs.readFileSync(file) : Buffer.alloc(0))
  }
  return hash.digest('hex')
}

function prototypesFresh(appDir: string): void {  write(
    path.join(appDir, 'docs/design/prototypes/_manifest.json'),
    json({
      designHash: designHashOf(appDir),
      styleId: 'platform-blue',
      exportedAt: '2026-11-19T00:00:00.000Z',
      pages: {
        'product-list': { file: 'product-list.png', hash: 'h', exportedAt: '2026-11-19T00:00:00.000Z', pageSet: 'product' }
      }
    })
  )
}

function frontend(appDir: string, options: { views?: boolean; routes?: number } = {}): void {
  const routes = options.routes ?? 2
  const routeLines = Array.from(
    { length: routes },
    (_, index) => `  { path: '/${index === 0 ? '' : `page-${index}`}', name: 'p${index}', component: AppIndex },`
  ).join('\n')
  write(
    path.join(appDir, 'frontend/src/router/index.js'),
    `import AppIndex from '@/views/AppIndex.vue'\nconst routes = [\n${routeLines}\n]\nexport default routes\n`
  )
  if (options.views === false) return
  write(
    path.join(appDir, 'frontend/src/views/product/ProductList.vue'),
    [
      '<template>',
      '  <BusinessListPage>',
      '    <QueryPanel />',
      '    <pm-table v-auto-height :table-data="rows" />',
      '  </BusinessListPage>',
      '</template>',
      '<script setup>',
      "import { BusinessListPage, QueryPanel } from '@/components/PageTemplates'",
      "import GlobalPreference from '@/preferences/GlobalPreference.js'",
      "import '@/styles/shared.css'",
      '</script>',
      ''
    ].join('\n')
  )
  write(
    path.join(appDir, 'frontend/src/views/product/ProductForm.vue'),
    [
      '<template>',
      '  <pm-form-dialog>',
      '    <FormSection />',
      '  </pm-form-dialog>',
      '</template>',
      '<script setup>',
      "import { FormSection } from '@/components/PageTemplates'",
      '</script>',
      ''
    ].join('\n')
  )
}

/** D2：为 fidelity pass fixture 生成可 0 warning 的接口设计文档（entity product 全 CRUD + 页面动作覆盖） */
function apiMarkdown(): string {
  const methods = {
    'product.list': ['GET', '/api/products', 'list', 'product-list'],
    'product.detail': ['GET', '/api/products/{id}', 'detail', 'product-list'],
    'product.create': ['POST', '/api/products', 'create', 'product-list'],
    'product.update': ['PUT', '/api/products/{id}', 'update', 'product-form'],
    'product.delete': ['DELETE', '/api/products/{id}', 'delete', 'product-list'],
    'product.export': ['POST', '/api/products/export', 'export', 'product-list']
  } as const
  const indexRows = Object.entries(methods)
    .map(([id, [method, apiPath, operation, page]]) => `| ${id} | ${method} | ${apiPath} | ${id} | ${operation} | EP-001 商品管理 | ${page} | product | product:read |`)
    .join('\n')
  const actionRows = [
    ['product-list', 'create', 'product.create'],
    ['product-list', 'detail', 'product.detail'],
    ['product-list', 'edit', 'product.update'],
    ['product-list', 'delete', 'product.delete'],
    ['product-list', 'export', 'product.export'],
    ['product-form', 'submit', 'product.update']
  ]
    .map(([page, action, id]) => `| EP-001 商品管理 | ${page} | ${action} | ${id} | |`)
    .join('\n')
  const details = Object.entries(methods)
    .map(([id, [method, apiPath, operation, page]]) => {
      const isList = operation === 'list'
      const request = isList
        ? '| page | query | integer | 否 | 1 | 页码 |\n| size | query | integer | 否 | 20 | 每页 |'
        : '| id | path | string | 否 | - | 主键 |'
      const response = isList
        ? '| total | integer | 总数 |\n| items[].productName | string | 实体 product.productName |'
        : '| productName | string | 实体 product.productName |'
      return [
        `#### ${id} ${id}`,
        '',
        '| 项 | 值 |',
        '| --- | --- |',
        `| 方法/路径 | \`${method} ${apiPath}\` |`,
        `| 操作 | \`${operation}\` |`,
        '| 页面集 | EP-001 商品管理 |',
        `| 页面 | ${page} |`,
        '| 实体 | product |',
        '| 权限 | product:read |',
        '| 说明 | 测试接口 |',
        '',
        '**请求参数**',
        '',
        '| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |',
        '| --- | --- | --- | --- | --- | --- |',
        request,
        '',
        '**响应 data**',
        '',
        '| 字段 | 类型 | 来源/说明 |',
        '| --- | --- | --- |',
        response,
        '',
        '**错误码**',
        '',
        '| code | http | 说明 |',
        '| --- | --- | --- |',
        '| AUTH_FORBIDDEN | 403 | 无权限 |',
        '',
        '**示例**',
        '',
        '```http',
        `${method} ${apiPath}`,
        '```',
        ''
      ].join('\n')
    })
    .join('\n')
  return [
    '# 商品管理应用 · 接口设计',
    '',
    '## 0. 文档信息',
    '| 项 | 值 |',
    '| --- | --- |',
    '| 版本 | 1.0 |',
    '| Base path | `/api` |',
    '',
    '## 1. 接口规范',
    '',
    '## 2. 接口索引',
    '| ID | 方法 | 路径 | 名称 | 操作 | Epic/页面集 | 页面 | 实体 | 权限 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    indexRows,
    '',
    '## 3. 覆盖矩阵',
    '### 3.1 页面动作覆盖',
    '| 页面集 | 页面 | 动作 | 接口 | 说明 |',
    '| --- | --- | --- | --- | --- |',
    actionRows,
    '### 3.2 实体 CRUD 覆盖',
    '| 实体 | list | detail | create | update | delete | 说明 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| product | product.list | product.detail | product.create | product.update | product.delete | |',
    '',
    '## 5. 接口详情',
    details
  ].join('\n')
}

function buildPassApp(name: string): string {
  const appDir = appRoot(name)
  designSystemFile(appDir)
  writeBlueprint(appDir, 'OrganizationUsers.vue')
  writeBlueprint(appDir, 'ApplicationForm.vue')
  write(path.join(appDir, 'docs/design/template/styles/shared.css'), '/* shared */\n')
  write(path.join(appDir, 'docs/design/template/styles/platform-blue/style.css'), '/* style */\n')
  designFiles(appDir)
  uiCheckFile(appDir)
  prototypesFresh(appDir)
  write(path.join(appDir, 'docs/design/api-design.md'), apiMarkdown())
  frontend(appDir, { routes: 2 })
  return appDir
}

function buildWarnApp(name: string): string {
  const appDir = appRoot(name)
  designSystemFile(appDir)
  writeBlueprint(appDir, 'OrganizationUsers.vue')
  write(path.join(appDir, 'docs/design/template/styles/shared.css'), '/* shared */\n')
  write(path.join(appDir, 'docs/design/template/styles/platform-blue/style.css'), '/* style */\n')
  designFiles(appDir, {
    schemaVersion: 2,
    pageSets: [
      {
        id: 'product',
        epic: 'EP-001',
        title: '商品管理',
        pages: [
          {
            id: 'product-list',
            name: '商品列表',
            type: 'list',
            recipe: 'list',
            entity: 'product',
            columns: ['productName'],
            catalogRef: 'enterprise-application-platform/organization'
          }
        ]
      }
    ]
  })
  frontend(appDir, { views: false, routes: 1 })
  return appDir
}

const CUSTOM_SYSTEM = {
  schemaVersion: 1,
  pack: 'supplier-hub',
  packName: '供应商管理模板',
  packVersion: '1.0.0',
  origin: { kind: 'custom', draftId: 'supplier-hub', baseApplicationType: 'enterprise-application-platform' },
  applicationType: 'supplier-hub',
  applicationTypeName: '供应商管理模板',
  style: 'data-cyan',
  styleName: '数据蓝青',
  styleClassName: 'visual-style-data-cyan',
  blueprintRoot: 'docs/design/template',
  templateDir: 'docs/design/template/supplier-hub',
  structure: 'docs/design/template/supplier-hub/structure.css',
  styles: {
    shared: 'docs/design/template/styles/shared.css',
    style: 'docs/design/template/styles/data-cyan/style.css',
    styleId: 'data-cyan'
  },
  pages: [
    {
      id: 'supplier-list',
      name: '供应商列表',
      recipe: 'list',
      kind: 'reference',
      blueprint: 'docs/design/template/supplier-hub/pages/supplier-list.vue',
      source: { pack: 'afcenter-app-templates-v1', applicationType: 'operations-management', pageId: 'list' }
    },
    {
      id: 'supplier-form',
      name: '供应商表单',
      recipe: 'dialog-form',
      kind: 'contract',
      contractFile: 'docs/design/template/supplier-hub/contracts/supplier-form.json'
    }
  ]
}

const CUSTOM_PAGES = {
  schemaVersion: 2,
  pageSets: [
    {
      id: 'supplier',
      epic: 'EP-001',
      title: '供应商管理',
      pages: [
        { id: 'supplier-list', name: '供应商列表', type: 'list', recipe: 'list', catalogRef: 'supplier-hub/supplier-list' },
        { id: 'supplier-form', name: '供应商表单', type: 'form', recipe: 'dialog-form', catalogRef: 'supplier-hub/supplier-form' }
      ]
    }
  ]
}

function buildContractApp(name: string, withContract = true): string {
  const appDir = appRoot(name)
  designSystemFile(appDir, CUSTOM_SYSTEM)
  write(path.join(appDir, 'docs/design/template/supplier-hub/pages/supplier-list.vue'), '<template><div /></template>\n')
  write(path.join(appDir, 'docs/design/template/supplier-hub/structure.css'), '.business-page { display: block; }\n')
  write(path.join(appDir, 'docs/design/template/styles/shared.css'), ':root { --x: 1; }\n')
  write(path.join(appDir, 'docs/design/template/styles/data-cyan/style.css'), '.visual-style-data-cyan { color: #145fba; }\n')
  if (withContract) {
    write(
      path.join(appDir, 'docs/design/template/supplier-hub/contracts/supplier-form.json'),
      json({ schemaVersion: 1, pageId: 'supplier-form', name: '供应商表单', recipe: 'dialog-form', contract: {} })
    )
  }
  designFiles(appDir, CUSTOM_PAGES)
  return appDir
}

function runCli(appDir: string, extra: string[] = []): { report: Record<string, any>; stdout: string } {
  const stdout = execFileSync(process.execPath, [script, '--app', appDir, '--json', ...extra], {
    encoding: 'utf8'
  })
  return { report: JSON.parse(stdout) as Record<string, any>, stdout }
}

function checkStatuses(report: Record<string, any>): Record<string, string> {
  return Object.fromEntries((report.checks as Array<{ id: string; status: string }>).map(check => [check.id, check.status]))
}

function checkById(report: Record<string, any>, id: string): Record<string, any> {
  return (report.checks as Array<Record<string, any>>).find(check => check.id === id) ?? {}
}

test('脚本：完整 fixture 全部通过（exit 0，14 项）', () => {
  const appDir = buildPassApp('pass')
  const { report } = runCli(appDir)
  assert.equal(report.empty, false)
  assert.equal(report.summary.total, 14)
  assert.equal(report.summary.fail, 0)
  assert.equal(report.summary.warn, 0)
  assert.equal(report.summary.status, 'pass')
  assert.equal(report.ok, true)
  assert.equal(report.designSystem.pack, 'afcenter-app-templates-v1')
  const statuses = checkStatuses(report)
  for (const id of [
    'design-system',
    'page-contract',
    'blueprint-files',
    'implementation',
    'page-templates',
    'pm-components',
    'form-dialog',
    'auto-height',
    'global-preference',
    'style-imports',
    'template-contract',
    'ui-check',
    'prototypes',
    'api-design'
  ]) {
    assert.equal(statuses[id], 'pass', `${id} 应通过：${JSON.stringify(statuses)}`)
  }
})

test('脚本：无视图/ui-check/PNG → warn 且 exit 0；--strict 不改退出码（无 fail）', () => {
  const appDir = buildWarnApp('warn')
  const { report, stdout } = runCli(appDir)
  assert.equal(report.summary.status, 'warn')
  assert.equal(report.summary.fail, 0)
  const statuses = checkStatuses(report)
  assert.equal(statuses.implementation, 'warn')
  assert.equal(statuses['page-templates'], 'warn')
  assert.equal(statuses['pm-components'], 'warn')
  assert.equal(statuses['auto-height'], 'warn')
  assert.equal(statuses['global-preference'], 'warn')
  assert.equal(statuses['style-imports'], 'warn')
  assert.equal(statuses['ui-check'], 'warn')
  assert.equal(statuses.prototypes, 'warn')

  const uiCheckWarn = checkById(report, 'ui-check')
  assert.match(String(uiCheckWarn.hint), /自动生成/, '缺失 hint 提示自动生成')
  assert.match(String(uiCheckWarn.evidence), /docs\/design\/ui-check\.md: 未生成/)

  const strict = spawnSync(process.execPath, [script, '--app', appDir, '--json', '--strict'], { encoding: 'utf8' })
  assert.equal(strict.status, 0, '无 fail 时 --strict 仍为 0')

  const human = execFileSync(process.execPath, [script, '--app', appDir], { encoding: 'utf8' })
  assert.match(human, /设计一致性检查（只读，应用级）/)
  assert.match(human, /总体：有警告/)
  assert.match(human, /--- JSON ---/)
  assert.ok(stdout.length > 0)
})

test('ui-check 警告 hint：骨架/缺失给出对应可操作提示（仍 14 项）', () => {
  const skeletonApp = buildWarnApp('ui-check-skeleton')
  skeletonUiCheckFile(skeletonApp)
  const skeletonReport = runCli(skeletonApp).report
  assert.equal(skeletonReport.summary.total, 14)
  const skeletonCheck = checkById(skeletonReport, 'ui-check')
  assert.equal(skeletonCheck.status, 'warn')
  assert.match(String(skeletonCheck.evidence), /已生成未填/)
  assert.match(String(skeletonCheck.hint), /实现前/)
  assert.doesNotMatch(String(skeletonCheck.hint), /自动生成/)

  const missingApp = buildWarnApp('ui-check-missing')
  const missingReport = runCli(missingApp).report
  const missingCheck = checkById(missingReport, 'ui-check')
  assert.match(String(missingCheck.hint), /自动生成/)
})

test('脚本：缺蓝图 → fail（默认 exit 0，--strict exit 1）', () => {
  const appDir = buildPassApp('fail')
  fs.rmSync(path.join(appDir, 'docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue'))
  const { report } = runCli(appDir)
  assert.equal(report.summary.status, 'fail')
  assert.equal(report.ok, false)
  assert.equal(checkStatuses(report)['blueprint-files'], 'fail')

  const plain = spawnSync(process.execPath, [script, '--app', appDir, '--json'], { encoding: 'utf8' })
  assert.equal(plain.status, 0, '默认只报告，fail 也 exit 0')
  const strict = spawnSync(process.execPath, [script, '--app', appDir, '--json', '--strict'], { encoding: 'utf8' })
  assert.equal(strict.status, 1, '--strict 且 fail 时 exit 1')

  const noFrontend = buildPassApp('fail-no-frontend')
  fs.rmSync(path.join(noFrontend, 'frontend'), { recursive: true, force: true })
  const noFrontendReport = runCli(noFrontend).report
  assert.equal(checkStatuses(noFrontendReport).implementation, 'fail')
  assert.match(JSON.stringify(noFrontendReport.checks), /frontend\/src/)
  assert.equal(noFrontendReport.summary.status, 'fail')
})

test('脚本：风格样式新/旧路径都接受，缺失只 warn 不 fail', () => {
  const appDir = buildPassApp('style-path')
  const stylesDir = path.join(appDir, 'docs/design/template/styles')
  write(path.join(stylesDir, 'shared.css'), '/* shared */\n')
  write(path.join(stylesDir, 'platform-blue/style.css'), '/* style */\n')

  const fresh = runCli(appDir)
  assert.equal(fresh.report.summary.total, 14, '检查项总数固定为 14')
  assert.equal(checkStatuses(fresh.report)['design-system'], 'pass')

  fs.rmSync(path.join(stylesDir, 'platform-blue'), { recursive: true, force: true })
  write(path.join(stylesDir, 'style.css'), '/* legacy style */\n')
  const system = JSON.parse(JSON.stringify(DESIGN_SYSTEM)) as Record<string, any>
  system.styles = { shared: 'docs/design/template/styles/shared.css', style: 'docs/design/template/styles/style.css' }
  designSystemFile(appDir, system)
  const legacy = runCli(appDir)
  assert.equal(checkStatuses(legacy.report)['design-system'], 'pass')
  const legacyCheck = (legacy.report.checks as Array<{ id: string; evidence: string }>).find(item => item.id === 'design-system')
  assert.match(String(legacyCheck?.evidence), /旧路径/)

  fs.rmSync(path.join(stylesDir, 'style.css'))
  const missing = runCli(appDir)
  assert.equal(checkStatuses(missing.report)['design-system'], 'warn')
  assert.equal(missing.report.summary.fail, 0)
})

test('脚本：自定义模板契约页 → 跳过蓝图、校验契约文件；缺契约只 warn', () => {
  const okDir = buildContractApp('contract-ok')
  const ok = runCli(okDir)
  assert.equal(ok.report.summary.total, 14)
  const okStatuses = checkStatuses(ok.report)
  assert.equal(okStatuses['design-system'], 'pass')
  assert.equal(okStatuses['page-contract'], 'pass')
  assert.equal(okStatuses['blueprint-files'], 'pass')
  assert.equal(okStatuses['template-contract'], 'pass')
  const blueprintCheck = (ok.report.checks as Array<{ id: string; evidence: string }>).find(
    item => item.id === 'blueprint-files'
  )
  assert.match(String(blueprintCheck?.evidence), /契约页/)

  const brokenDir = buildContractApp('contract-missing', false)
  const broken = runCli(brokenDir)
  const brokenStatuses = checkStatuses(broken.report)
  assert.equal(brokenStatuses['blueprint-files'], 'warn', '缺契约文件只 warn')
  assert.equal(brokenStatuses['template-contract'], 'warn', 'template-contract 只报告')
  const contractCheck = (broken.report.checks as Array<{ id: string; evidence: string; hint?: string }>).find(
    item => item.id === 'template-contract'
  )
  assert.match(String(contractCheck?.evidence), /supplier-form/)
  assert.match(String(contractCheck?.hint), /只报告|不阻断/)
})

test('脚本：无设计 → empty/no-design（2 项）', () => {
  const emptyDir = appRoot('no-design')
  fs.mkdirSync(path.join(emptyDir, 'docs/design'), { recursive: true })
  const empty = runCli(emptyDir).report
  assert.equal(empty.empty, true)
  assert.equal(empty.reason, 'no-design')
  assert.equal(empty.summary.status, 'warn')
  assert.equal(empty.checks.length, 2)
})

test('脚本：未知参数 → exit 2；目录不存在 → exit 2', () => {
  const missing = spawnSync(process.execPath, [script, '--app', path.join(root, 'nope'), '--json'], {
    encoding: 'utf8'
  })
  assert.equal(missing.status, 2)

  const appDir = buildPassApp('bad-arg')
  const invalid = spawnSync(process.execPath, [script, '--app', appDir, '--module', 'MOD-001', '--json'], {
    encoding: 'utf8'
  })
  assert.equal(invalid.status, 2)
})

// ---- 后端服务/API 语义 ----

async function registerApp(appId: string): Promise<string> {
  const { scaffold, db } = await setup()
  scaffold.scaffoldApp(
    {
      appId,
      appName: `D1 ${appId}`,
      backendPort: 18126,
      designSystem: {
        pack: 'afcenter-app-templates-v1',
        applicationType: 'enterprise-application-platform',
        style: 'platform-blue'
      }
    },
    projects
  )
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(appId, appId, null, appId, 18126, 'requirements', now, now)
  return scaffold.appDirOf(appId, projects)
}

async function seedServiceDesign(appDir: string): Promise<void> {
  write(path.join(appDir, 'docs/design/entities.json'), json(ENTITIES))
  write(path.join(appDir, 'docs/design/pages.json'), json(PASS_PAGES))
  uiCheckFile(appDir)
  prototypesFresh(appDir)
  write(
    path.join(appDir, 'frontend/src/views/product/ProductList.vue'),
    [
      '<template><BusinessListPage><pm-table v-auto-height /></BusinessListPage></template>',
      '<script setup>',
      "import { BusinessListPage } from '@/components/PageTemplates'",
      "import GlobalPreference from '@/preferences/GlobalPreference.js'",
      "import '@/styles/shared.css'",
      '</script>',
      ''
    ].join('\n')
  )
  write(
    path.join(appDir, 'frontend/src/views/product/ProductForm.vue'),
    '<template><pm-form-dialog><FormSection /></pm-form-dialog></template>\n'
  )
  write(
    path.join(appDir, 'frontend/src/router/index.js'),
    "const routes = [{ path: '/', name: 'a' }, { path: '/product', name: 'b' }]\nexport default routes\n"
  )
}

test('后端：正常检查返回 14 项/摘要/设计系统（规则与脚本一致）', async () => {
  const { fidelity } = await setup()
  const appDir = await registerApp('fid-ok')
  await seedServiceDesign(appDir)

  const report = fidelity.runDesignFidelity('fid-ok')
  assert.equal(report.appId, 'fid-ok')
  assert.equal(report.checks.length, 14)
  assert.equal(report.summary.total, 14)
  assert.equal(report.designSystem.pack, 'afcenter-app-templates-v1')
  assert.ok(!Number.isNaN(Date.parse(report.generatedAt)))
  const statuses = Object.fromEntries(report.checks.map(check => [check.id, check.status]))
  assert.equal(statuses['design-system'], 'pass')
  assert.equal(statuses['blueprint-files'], 'pass')
  assert.equal(statuses['template-contract'], 'pass')
  assert.equal(statuses['ui-check'], 'pass')
  assert.equal(statuses['api-design'], 'warn')
  assert.equal('module' in report, false)
  assert.equal('modules' in report, false)
})

test('后端：无应用 404 / 目录缺失 409 / 无设计 empty', async () => {
  const { fidelity, db } = await setup()

  assert.throws(
    () => fidelity.runDesignFidelity('no-such-app'),
    (error: unknown) => (error as { status?: number }).status === 404
  )

  const appDir = await registerApp('fid-empty')
  const empty = fidelity.runDesignFidelity('fid-empty')
  assert.equal(empty.empty, true)
  assert.equal(empty.reason, 'no-design')
  assert.equal(empty.summary.status, 'warn')
  assert.equal(empty.checks.length, 2)

  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO apps (id, name, description, dir, backend_port, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('fid-no-dir', 'fid-no-dir', null, 'fid-no-dir', 18126, 'requirements', now, now)
  assert.throws(
    () => fidelity.runDesignFidelity('fid-no-dir'),
    (error: unknown) => (error as { status?: number }).status === 409
  )
  assert.equal(fs.existsSync(appDir), true)
})
