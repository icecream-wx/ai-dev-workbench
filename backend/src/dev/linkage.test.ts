/**
 * 开发设计摘要（digest）+ ui-check 软门禁（应用级，D1）
 *
 * 临时目录 + 真实 pack/scaffold 文件；不启动 opencode、不调用模型。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-dev-linkage-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

interface Setup {
  scaffold: typeof import('../apps/scaffold')
  digest: typeof import('./digest')
  uiCheck: typeof import('./ui-check')
  db: typeof import('../db').db
}

let setupPromise: Promise<Setup> | null = null

function setup(): Promise<Setup> {
  if (setupPromise) return setupPromise
  setupPromise = (async () => {
    const scaffold = await import('../apps/scaffold')
    const digest = await import('./digest')
    const uiCheck = await import('./ui-check')
    const dbModule = await import('../db')
    return { scaffold, digest, uiCheck, db: dbModule.db }
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

const ENTITIES = {
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
}

const PAGES = {
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
          blueprint: 'application-types/enterprise-application-platform/pages/OrganizationUsers.vue',
          entity: 'product',
          filters: ['productName', 'status'],
          columns: ['productCode', 'productName', 'status'],
          rowActions: ['detail', 'edit', 'delete'],
          toolbarActions: ['create', 'batchDelete'],
          selection: true,
          pagination: { layout: 'three-part', pageSize: 20 },
          tree: { titleField: 'productName', parentField: 'categoryName' }
        },
        {
          id: 'product-form',
          name: '商品编辑',
          type: 'form',
          recipe: 'dialog-form',
          entity: 'product',
          form: {
            presentation: 'dialog',
            columns: 2,
            width: 800,
            fields: ['productCode', 'productName', 'status'],
            groups: [{ title: '基本信息', fields: ['productCode', 'productName'] }]
          }
        }
      ]
    }
  ]
}

function writeDesign(appDir: string): void {
  const dir = path.join(appDir, 'docs', 'design')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'entities.json'), `${JSON.stringify(ENTITIES, null, 2)}\n`, 'utf8')
  fs.writeFileSync(path.join(dir, 'pages.json'), `${JSON.stringify(PAGES, null, 2)}\n`, 'utf8')
}

async function makeApp(appId: string): Promise<string> {
  const { scaffold } = await setup()
  scaffold.scaffoldApp(
    {
      appId,
      appName: `D1 ${appId}`,
      backendPort: 18123,
      designSystem: {
        pack: 'afcenter-app-templates-v1',
        applicationType: 'enterprise-application-platform',
        style: 'platform-blue'
      }
    },
    projects
  )
  return scaffold.appDirOf(appId, projects)
}

test('digest：设计系统 + 页面集/页面契约 + 字段/列/操作 + 参考包 + 蓝图根', async () => {
  const { digest } = await setup()
  const appDir = await makeApp('digest-app')
  writeDesign(appDir)
  fs.writeFileSync(path.join(appDir, 'docs', 'design', 'design-brief.md'), '# 商品管理设计说明\n', 'utf8')
  fs.writeFileSync(
    path.join(appDir, 'docs', 'design', 'tokens.json'),
    `${JSON.stringify({ styleId: 'platform-blue', tokens: { primary: '#1f5eff' } })}\n`,
    'utf8'
  )
  const prototypesDir = path.join(appDir, 'docs', 'design', 'prototypes')
  fs.mkdirSync(prototypesDir, { recursive: true })
  fs.writeFileSync(path.join(prototypesDir, 'product-list.png'), 'png', 'utf8')
  fs.writeFileSync(
    path.join(prototypesDir, '_manifest.json'),
    `${JSON.stringify(
      {
        designHash: 'stale-hash',
        styleId: 'platform-blue',
        exportedAt: '2026-11-19T00:00:00.000Z',
        pages: { 'product-list': { file: 'product-list.png', hash: 'h', exportedAt: '2026-11-19T00:00:00.000Z', pageSet: 'product' } }
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  const text = digest.buildDesignDigest('digest-app', appDir)
  assert.match(text, /【设计摘要】/)
  assert.match(text, /afcenter-app-templates-v1/)
  assert.match(text, /enterprise-application-platform/)
  assert.match(text, /platform-blue/)
  assert.match(text, /蓝图根：docs\/design\/template/)
  assert.match(text, /风格样式：docs\/design\/template\/styles\/platform-blue\/style\.css/)
  assert.match(text, /EP-001 商品管理（页面集 product，2 页）/)
  assert.match(text, /实体（1）/)
  assert.match(text, /product-list 商品列表/)
  assert.match(text, /recipe=tree-list/)
  assert.match(text, /OrganizationUsers\.vue/)
  assert.match(text, /列=productCode\/productName\/status/)
  assert.match(text, /筛选=productName\/status/)
  assert.match(text, /行=detail\/edit\/delete/)
  assert.match(text, /工具栏=create\/batchDelete/)
  assert.match(text, /pagination=three-part\/20/)
  assert.match(text, /tree=标题 productName/)
  assert.match(text, /product-form 商品编辑/)
  assert.match(text, /form=dialog 2 列 800px/)
  assert.match(text, /design-brief\.md=已生成/)
  assert.match(text, /tokens\.json=已生成/)
  assert.match(text, /PNG=1 张（已过期/)
  assert.match(text, /ui-check：未生成/)
  assert.ok(text.length <= digest.DESIGN_DIGEST_LIMIT + 200, `digest 未限制长度：${text.length}`)
})

test('digest：无设计/超长截断都不抛错', async () => {
  const { digest } = await setup()
  const appDir = await makeApp('digest-missing')

  const empty = digest.buildDesignDigest('digest-missing', appDir)
  assert.match(empty, /实体：entities\.json 未定义/)
  assert.match(empty, /页面：pages\.json 未定义/)
  assert.match(empty, /afcenter-app-templates-v1/)

  const manyPages = Array.from({ length: 12 }, (_, index) => ({
    id: `page-${index}`,
    name: `页面 ${index} ${'长名称'.repeat(120)}`,
    type: 'list',
    recipe: 'list',
    columns: Array.from({ length: 20 }, (_, column) => `${'列'.repeat(40)}${column}`),
    rowActions: ['detail', 'edit', 'delete'],
    toolbarActions: ['create']
  }))
  fs.mkdirSync(path.join(appDir, 'docs', 'design'), { recursive: true })
  fs.writeFileSync(
    path.join(appDir, 'docs', 'design', 'pages.json'),
    `${JSON.stringify({ schemaVersion: 2, pageSets: [{ id: 'big', epic: 'EP-001', title: '大页面集', pages: manyPages }] }, null, 2)}\n`,
    'utf8'
  )
  const long = digest.buildDesignDigest('digest-missing', appDir)
  assert.match(long, /设计摘要超过 6000 字符，已截断/)
  assert.ok(long.length <= digest.DESIGN_DIGEST_LIMIT + 200, `截断后仍过长：${long.length}`)
})

test('ui-check：缺失时生成骨架（页面/字段/操作来自设计），已存在不覆盖', async () => {
  const { uiCheck } = await setup()
  const appDir = await makeApp('uicheck-app')
  writeDesign(appDir)

  const first = uiCheck.ensureUiCheck('uicheck-app', appDir)
  assert.equal(first.created, true)
  assert.equal(first.status, 'skeleton')
  assert.equal(first.file, 'docs/design/ui-check.md')
  const content = fs.readFileSync(path.join(appDir, first.file), 'utf8')
  assert.match(content, /# 页面对照表（应用级）/)
  assert.match(content, /### EP-001 商品管理/)
  assert.match(content, /## 实现前/)
  assert.match(content, /## 实现后/)
  assert.match(content, /## 未实现\/待确认/)
  assert.match(content, /product-list/)
  assert.match(content, /productCode、productName、status/)
  assert.match(content, /行：detail、edit、delete/)
  assert.match(content, /OrganizationUsers\.vue/)
  assert.match(content, /分页=three-part 每页 20/)
  assert.match(content, /<!-- adw:ui-check:skeleton hash:[a-f0-9]{64} -->/)

  // 已存在：不覆盖
  fs.appendFileSync(path.join(appDir, first.file), '\n- agent 手写内容\n', 'utf8')
  const second = uiCheck.ensureUiCheck('uicheck-app', appDir)
  assert.equal(second.created, false)
  assert.equal(second.status, 'filled')
  assert.match(fs.readFileSync(path.join(appDir, first.file), 'utf8'), /agent 手写内容/)

  // 状态：未生成 → 已生成未填 → 已填
  const freshDir = path.join(root, 'projects', 'uicheck-fresh')
  fs.mkdirSync(path.join(freshDir, 'docs', 'design'), { recursive: true })
  assert.equal(uiCheck.readUiCheck(freshDir).status, 'missing')
  fs.writeFileSync(
    path.join(freshDir, 'docs', 'design', 'pages.json'),
    JSON.stringify({ schemaVersion: 2, pageSets: [{ id: 's', epic: 'EP-001', title: '对照表状态', pages: [] }] }),
    'utf8'
  )
  uiCheck.ensureUiCheck('ref', freshDir)
  assert.equal(uiCheck.readUiCheck(freshDir).status, 'skeleton')
  const file = path.join(freshDir, 'docs', 'design', 'ui-check.md')
  fs.writeFileSync(file, `${fs.readFileSync(file, 'utf8')}\n补充：已实现。\n`, 'utf8')
  assert.equal(uiCheck.readUiCheck(freshDir).status, 'filled')
})

test('ui-check：设计缺失/工作区缺失时跳过，不抛 500', async () => {
  const { uiCheck } = await setup()
  const appDir = await makeApp('uicheck-skip')

  const missing = uiCheck.ensureUiCheck('uicheck-skip', appDir)
  assert.equal(missing.created, false)
  assert.equal(missing.skipped, true)
  assert.equal(missing.reason, 'design-missing')
  assert.equal(fs.existsSync(path.join(appDir, 'docs', 'design', 'ui-check.md')), false)

  const noWorkspace = uiCheck.ensureUiCheck('nope', path.join(root, 'projects', 'nope'))
  assert.equal(noWorkspace.skipped, true)
  assert.equal(noWorkspace.reason, 'workspace-missing')
})

test('artifacts.uiCheck 暴露 missing/skeleton/filled（只读）', async () => {
  const { uiCheck } = await setup()
  const appDir = await makeApp('uicheck-artifacts')
  writeDesign(appDir)
  const { readArtifacts } = (await import('../workspace/artifacts')) as typeof import('../workspace/artifacts')
  let artifacts = readArtifacts('uicheck-artifacts')
  assert.equal(artifacts.uiCheck.status, 'missing')

  uiCheck.ensureUiCheck('uicheck-artifacts', appDir)
  artifacts = readArtifacts('uicheck-artifacts')
  assert.equal(artifacts.uiCheck.status, 'skeleton')
  assert.equal(artifacts.uiCheck.file, 'docs/design/ui-check.md')
})
