/**
 * P7-5b：开发设计摘要（digest）+ ui-check 软门禁
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

function designOf(module: string, title: string): Record<string, unknown> {
  return {
    module,
    title,
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
        toolbarActions: ['create', 'batchDelete'],
        selection: true,
        pagination: { layout: 'three-part', pageSize: 20 },
        tree: { titleField: '商品名称', parentField: '所属分类' }
      },
      {
        id: 'product-form',
        name: '商品编辑',
        type: 'form',
        recipe: 'dialog-form',
        form: {
          presentation: 'dialog',
          columns: 2,
          width: 800,
          fields: ['商品编码', '商品名称', '状态'],
          groups: [{ title: '基本信息', fields: ['商品编码', '商品名称'] }]
        }
      }
    ]
  }
}

function writeDesign(appDir: string, module: string, design: Record<string, unknown>): void {
  const dir = path.join(appDir, 'docs', 'design', module)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'design.json'), `${JSON.stringify(design, null, 2)}\n`, 'utf8')
}

async function makeApp(appId: string): Promise<string> {
  const { scaffold } = await setup()
  scaffold.scaffoldApp(
    {
      appId,
      appName: `P7-5b ${appId}`,
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

test('digest：设计系统 + 模块页面契约 + 字段/列/操作 + 参考包 + 蓝图根', async () => {
  const { digest } = await setup()
  const appDir = await makeApp('digest-app')
  writeDesign(appDir, 'MOD-001', designOf('MOD-001', '商品管理'))
  fs.writeFileSync(
    path.join(appDir, 'docs', 'design', 'MOD-001', 'design-brief.md'),
    '# 商品管理设计说明\n',
    'utf8'
  )
  fs.writeFileSync(
    path.join(appDir, 'docs', 'design', 'MOD-001', 'tokens.json'),
    `${JSON.stringify({ templateId: 'platform-blue', tokens: { primary: '#1f5eff' } })}\n`,
    'utf8'
  )
  const prototypesDir = path.join(appDir, 'docs', 'design', 'MOD-001', 'prototypes')
  fs.mkdirSync(prototypesDir, { recursive: true })
  fs.writeFileSync(path.join(prototypesDir, 'product-list.png'), 'png', 'utf8')
  fs.writeFileSync(
    path.join(prototypesDir, '_manifest.json'),
    `${JSON.stringify(
      {
        designHash: 'stale-hash',
        templateId: 'platform-blue',
        exportedAt: '2026-11-19T00:00:00.000Z',
        pages: { 'product-list': { file: 'product-list.png', hash: 'h', exportedAt: '2026-11-19T00:00:00.000Z' } }
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  const text = digest.buildDesignDigest('digest-app', 'MOD-001', appDir)
  assert.match(text, /【设计摘要】/)
  assert.match(text, /afcenter-app-templates-v1/)
  assert.match(text, /enterprise-application-platform/)
  assert.match(text, /platform-blue/)
  assert.match(text, /蓝图根：docs\/design\/template/)
  assert.match(text, /风格样式：docs\/design\/template\/styles\/platform-blue\/style\.css/)
  assert.match(text, /模块：MOD-001 · 商品管理/)
  assert.match(text, /product-list 商品列表/)
  assert.match(text, /recipe=tree-list/)
  assert.match(text, /OrganizationUsers\.vue/)
  assert.match(text, /列=商品编码\/商品名称\/状态/)
  assert.match(text, /筛选=商品名称\/状态/)
  assert.match(text, /行=detail\/edit\/delete/)
  assert.match(text, /工具栏=create\/batchDelete/)
  assert.match(text, /pagination=three-part\/20/)
  assert.match(text, /tree=标题 商品名称/)
  assert.match(text, /product-form 商品编辑/)
  assert.match(text, /form=dialog 2 列 800px/)
  assert.match(text, /design-brief\.md=已生成/)
  assert.match(text, /tokens\.json=已生成/)
  assert.match(text, /PNG=1 张（已过期/)
  assert.match(text, /ui-check：未生成/)
  assert.ok(text.length <= digest.DESIGN_DIGEST_LIMIT + 200, `digest 未限制长度：${text.length}`)
})

test('digest：未指定模块/模块设计缺失/超长截断都不抛错', async () => {
  const { digest } = await setup()
  const appDir = await makeApp('digest-missing')

  const noModule = digest.buildDesignDigest('digest-missing', undefined, appDir)
  assert.match(noModule, /本轮未指定模块/)
  assert.match(noModule, /afcenter-app-templates-v1/)

  const missing = digest.buildDesignDigest('digest-missing', 'MOD-404', appDir)
  assert.match(missing, /未找到 docs\/design\/MOD-404\/design\.json/)
  assert.match(missing, /ui-check：未生成/)

  const manyPages = Array.from({ length: 12 }, (_, index) => ({
    id: `page-${index}`,
    name: `页面 ${index} ${'长名称'.repeat(120)}`,
    type: 'list',
    recipe: 'list',
    columns: Array.from({ length: 20 }, (_, column) => `${'列'.repeat(40)}${column}`),
    rowActions: ['detail', 'edit', 'delete'],
    toolbarActions: ['create']
  }))
  writeDesign(appDir, 'MOD-002', { module: 'MOD-002', title: '大模块', entities: [], relations: [], pages: manyPages })
  const long = digest.buildDesignDigest('digest-missing', 'MOD-002', appDir)
  assert.match(long, /设计摘要超过 6000 字符，已截断/)
  assert.ok(long.length <= digest.DESIGN_DIGEST_LIMIT + 200, `截断后仍过长：${long.length}`)
})

test('ui-check：缺失时生成骨架（页面/字段/操作来自设计），已存在不覆盖', async () => {
  const { uiCheck } = await setup()
  const appDir = await makeApp('uicheck-app')
  writeDesign(appDir, 'MOD-001', designOf('MOD-001', '商品管理'))

  const first = uiCheck.ensureUiCheck('uicheck-app', 'MOD-001', appDir)
  assert.equal(first.created, true)
  assert.equal(first.status, 'skeleton')
  assert.equal(first.file, 'docs/design/MOD-001/ui-check.md')
  const content = fs.readFileSync(path.join(appDir, first.file), 'utf8')
  assert.match(content, /# 页面对照表（MOD-001）/)
  assert.match(content, /## 实现前/)
  assert.match(content, /## 实现后/)
  assert.match(content, /## 未实现\/待确认/)
  assert.match(content, /product-list/)
  assert.match(content, /商品编码、商品名称、状态/)
  assert.match(content, /行：detail、edit、delete/)
  assert.match(content, /OrganizationUsers\.vue/)
  assert.match(content, /分页=three-part 每页 20/)
  assert.match(content, /<!-- adw:ui-check:skeleton hash:[a-f0-9]{64} -->/)

  // 已存在：不覆盖
  fs.appendFileSync(path.join(appDir, first.file), '\n- agent 手写内容\n', 'utf8')
  const second = uiCheck.ensureUiCheck('uicheck-app', 'MOD-001', appDir)
  assert.equal(second.created, false)
  assert.equal(second.status, 'filled')
  assert.match(fs.readFileSync(path.join(appDir, first.file), 'utf8'), /agent 手写内容/)

  // 状态：未生成 → 已生成未填 → 已填
  const freshDir = path.join(root, 'projects', 'uicheck-fresh')
  fs.mkdirSync(path.join(freshDir, 'docs', 'design', 'MOD-009'), { recursive: true })
  assert.equal(uiCheck.readUiCheck(freshDir, 'MOD-009').status, 'missing')
  fs.writeFileSync(
    path.join(freshDir, 'docs', 'design', 'MOD-009', 'design.json'),
    JSON.stringify({ module: 'MOD-009', title: '对照表状态', entities: [], relations: [], pages: [] }),
    'utf8'
  )
  uiCheck.ensureUiCheck('ref', 'MOD-009', freshDir)
  assert.equal(uiCheck.readUiCheck(freshDir, 'MOD-009').status, 'skeleton')
  const file = path.join(freshDir, 'docs', 'design', 'MOD-009', 'ui-check.md')
  fs.writeFileSync(file, `${fs.readFileSync(file, 'utf8')}\n补充：已实现。\n`, 'utf8')
  assert.equal(uiCheck.readUiCheck(freshDir, 'MOD-009').status, 'filled')
})

test('ui-check：设计缺失/模块非法时跳过，不抛 500', async () => {
  const { uiCheck } = await setup()
  const appDir = await makeApp('uicheck-skip')

  const missing = uiCheck.ensureUiCheck('uicheck-skip', 'MOD-999', appDir)
  assert.equal(missing.created, false)
  assert.equal(missing.skipped, true)
  assert.equal(missing.reason, 'design-missing')
  assert.equal(fs.existsSync(path.join(appDir, 'docs', 'design', 'MOD-999', 'ui-check.md')), false)

  const invalid = uiCheck.ensureUiCheck('uicheck-skip', '../escape', appDir)
  assert.equal(invalid.skipped, true)
  assert.equal(invalid.reason, 'invalid-module')

  const noWorkspace = uiCheck.ensureUiCheck('nope', 'MOD-001', path.join(root, 'projects', 'nope'))
  assert.equal(noWorkspace.skipped, true)
  assert.equal(noWorkspace.reason, 'workspace-missing')
})

test('artifacts：design.uiCheck 暴露 missing/skeleton/filled（只读）', async () => {
  const { uiCheck } = await setup()
  const appDir = await makeApp('uicheck-artifacts')
  writeDesign(appDir, 'MOD-001', designOf('MOD-001', '商品管理'))
  const { readArtifacts } = (await import('../workspace/artifacts')) as typeof import('../workspace/artifacts')
  let artifacts = readArtifacts('uicheck-artifacts')
  assert.equal(artifacts.designs[0].uiCheck?.status, 'missing')

  uiCheck.ensureUiCheck('uicheck-artifacts', 'MOD-001', appDir)
  artifacts = readArtifacts('uicheck-artifacts')
  assert.equal(artifacts.designs[0].uiCheck?.status, 'skeleton')
  assert.equal(artifacts.designs[0].uiCheck?.file, 'docs/design/MOD-001/ui-check.md')
})
