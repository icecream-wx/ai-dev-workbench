/**
 * 设计产物页面契约（D1）：entities/pages schema、软枚举 warning、validate.mjs 自查
 *
 * 使用临时目录直接运行仓库内的 skill 资产；不启动服务、不调用模型、不读写真实 data/projects。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-design-contract-'))
const projects = path.join(root, 'projects')
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = projects
process.env.OPENCODE_AUTO_START = 'false'

const appId = 'contract-app'
const designDir = path.join(projects, appId, 'docs', 'design')
const entitiesFile = path.join(designDir, 'entities.json')
const pagesFile = path.join(designDir, 'pages.json')
const repoRoot = path.resolve(__dirname, '../../..')
const skillDir = path.join(repoRoot, 'templates', 'agent', 'skills', 'adw-design-artifacts')
const validateScript = path.join(skillDir, 'scripts', 'validate.mjs')
const entitiesExample = path.join(skillDir, 'references', 'entities-example.json')
const pagesExample = path.join(skillDir, 'references', 'pages-example.json')

const ENTITIES = {
  schemaVersion: 2,
  entities: [
    {
      id: 'product',
      name: '商品',
      fields: [
        { code: 'productCode', name: '商品编码', type: 'string', required: true },
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
          id: 'org-list',
          name: '商品列表',
          type: 'list',
          entity: 'product',
          recipe: 'tree-list',
          catalogRef: 'enterprise-application-platform/organization',
          blueprint: 'application-types/enterprise-application-platform/pages/OrganizationUsers.vue',
          filters: ['productCode', 'status'],
          columns: ['productCode', 'status'],
          rowActions: ['detail', 'edit', 'delete'],
          toolbarActions: ['create', 'batchDelete'],
          selection: true,
          pagination: { layout: 'three-part', pageSize: 20 },
          tree: { titleField: 'productCode', parentField: 'status', actionStyle: 'header', selectionStyle: 'dot' },
          subTables: [{ entity: 'product', title: '子商品', columns: ['productCode'], mode: 'tab' }],
          components: { status: 'pm-select' }
        },
        {
          id: 'org-form',
          name: '商品编辑',
          type: 'form',
          entity: 'product',
          recipe: 'dialog-form',
          form: {
            presentation: 'dialog',
            columns: 2,
            width: 800,
            fields: ['productCode', 'status'],
            groups: [{ title: '基本信息', fields: ['productCode', 'status'] }]
          },
          components: { status: 'pm-select' }
        }
      ]
    }
  ]
}

function writeDesign(entities: unknown = ENTITIES, pages: unknown = PAGES): void {
  fs.mkdirSync(designDir, { recursive: true })
  fs.writeFileSync(entitiesFile, `${JSON.stringify(entities, null, 2)}\n`, 'utf8')
  fs.writeFileSync(pagesFile, `${JSON.stringify(pages, null, 2)}\n`, 'utf8')
}

function runValidate(files: string[]): { status: number; json: any } {
  let stdout = ''
  let status = 0
  try {
    stdout = execFileSync(process.execPath, [validateScript, ...files], { encoding: 'utf8' })
  } catch (error) {
    const failure = error as { status?: number; stdout?: string | Buffer }
    status = failure.status ?? 1
    stdout = failure.stdout ? failure.stdout.toString() : ''
  }
  return { status, json: JSON.parse(stdout) }
}

after(async () => {
  try {
    const dbModule = await import('../db')
    dbModule.db.close()
  } catch {
    // 数据库未打开
  }
  fs.rmSync(root, { recursive: true, force: true })
})

test('含页面契约字段的 entities/pages 通过后端 schema 校验', async () => {
  const { readArtifacts } = await import('../workspace/artifacts')
  writeDesign()
  const result = readArtifacts(appId)
  assert.deepEqual(result.entities.errors, [])
  assert.deepEqual(result.pages.errors, [])
  assert.equal(result.pages.pageSets.length, 1)
  assert.equal(result.pages.pages.length, 2)
  assert.equal(result.entities.entities.length, 1)
})

test('非法新字段 → 结构化错误列出但不阻断（设计仍返回）', async () => {
  const { readArtifacts } = await import('../workspace/artifacts')
  writeDesign(ENTITIES, {
    ...PAGES,
    pageSets: [
      {
        id: 'product',
        epic: 'EP-001',
        title: '商品管理',
        pages: [
          {
            ...PAGES.pageSets[0].pages[0],
            recipe: 'timeline',
            pagination: { layout: 'grid', pageSize: 'many' },
            subTables: [{ entity: 'product', mode: 'grid' }],
            components: { status: 123 }
          },
          { ...PAGES.pageSets[0].pages[1], form: { presentation: 'modal', columns: 3, width: -1 } }
        ]
      }
    ]
  })
  const artifacts = readArtifacts(appId)
  assert.equal(artifacts.pages.pages.length, 2, '页面仍返回，不阻断')
  const paths = artifacts.errors.filter(error => error.file.includes('pages.json')).map(error => error.path)
  for (const expected of [
    'pageSets[0].pages[0].recipe',
    'pageSets[0].pages[0].pagination.layout',
    'pageSets[0].pages[0].pagination.pageSize',
    'pageSets[0].pages[0].subTables[0].mode',
    'pageSets[0].pages[0].components.status',
    'pageSets[0].pages[1].form.presentation',
    'pageSets[0].pages[1].form.columns'
  ]) {
    assert.ok(paths.includes(expected), `应报告 ${expected}；实际 ${JSON.stringify(paths)}`)
  }
})

test('validate.mjs：新字段问题只出 warning 且不阻断；结构问题仍报错', () => {
  writeDesign()
  const valid = runValidate([entitiesFile, pagesFile])
  assert.equal(valid.status, 0)
  assert.equal(valid.json.ok, true)
  assert.deepEqual(valid.json.errors, [])
  assert.deepEqual(valid.json.warnings, [])

  writeDesign(ENTITIES, {
    ...PAGES,
    pageSets: [
      {
        id: 'product',
        epic: 'EP-001',
        title: '商品管理',
        pages: [
          { ...PAGES.pageSets[0].pages[0], recipe: 'timeline', pagination: { layout: 'grid' }, components: { status: 123 } }
        ]
      }
    ]
  })
  const soft = runValidate([entitiesFile, pagesFile])
  assert.equal(soft.status, 0, '新字段问题不阻断退出码')
  assert.equal(soft.json.ok, true)
  assert.deepEqual(soft.json.errors, [])
  assert.ok(soft.json.warnings.length >= 3, JSON.stringify(soft.json.warnings))
  assert.ok(soft.json.warnings.every((item: { severity?: string }) => item.severity === 'warning'))

  // 结构/必填错误仍然是 errors（退出码 1）
  fs.writeFileSync(entitiesFile, JSON.stringify({ schemaVersion: 2, entities: 'oops' }), 'utf8')
  const broken = runValidate([entitiesFile, pagesFile])
  assert.equal(broken.status, 1)
  assert.equal(broken.json.ok, false)
  assert.ok(broken.json.errors.some((item: { path: string }) => item.path === 'entities'))
})

test('软枚举：中文动作码/未知树形态只 warning，原值保留、不阻断', async () => {
  const { readArtifacts } = await import('../workspace/artifacts')
  writeDesign(ENTITIES, {
    ...PAGES,
    pageSets: [
      {
        ...PAGES.pageSets[0],
        pages: [
          {
            ...PAGES.pageSets[0].pages[0],
            rowActions: ['编辑', 'delete'],
            toolbarActions: ['新建账号'],
            tree: { titleField: 'productCode', parentField: 'status', actionStyle: 'inline', selectionStyle: 'flashy' }
          },
          PAGES.pageSets[0].pages[1]
        ]
      }
    ]
  })
  const result = readArtifacts(appId)
  assert.deepEqual(result.pages.errors, [])
  const warningText = result.pages.warnings.join('\n')
  assert.match(warningText, /pageSets\[0\]\.pages\[0\]\.rowActions\[0\].*编辑.*推荐/)
  assert.match(warningText, /pageSets\[0\]\.pages\[0\]\.toolbarActions\[0\].*新建账号.*推荐/)
  assert.match(warningText, /pageSets\[0\]\.pages\[0\]\.tree\.actionStyle.*inline.*推荐/)
  assert.match(warningText, /pageSets\[0\]\.pages\[0\]\.tree\.selectionStyle.*flashy.*推荐/)

  const page = (result.pages.pages as Array<Record<string, unknown>>)[0]
  assert.deepEqual(page.rowActions, ['编辑', 'delete'])
  assert.deepEqual(page.toolbarActions, ['新建账号'])
  assert.deepEqual(page.tree, {
    titleField: 'productCode',
    parentField: 'status',
    actionStyle: 'inline',
    selectionStyle: 'flashy'
  })

  const soft = runValidate([entitiesFile, pagesFile])
  assert.equal(soft.status, 0, '软枚举不应阻断退出码')
  assert.equal(soft.json.ok, true)
  assert.deepEqual(soft.json.errors, [])
  const paths = (soft.json.warnings as Array<{ path: string; severity?: string }>).map(item => item.path)
  for (const expected of [
    'pageSets[0].pages[0].rowActions[0]',
    'pageSets[0].pages[0].toolbarActions[0]',
    'pageSets[0].pages[0].tree.actionStyle',
    'pageSets[0].pages[0].tree.selectionStyle'
  ]) {
    assert.ok(paths.includes(expected), `应报告 ${expected}；实际 ${JSON.stringify(paths)}`)
  }
  assert.ok(soft.json.warnings.every((item: { severity?: string }) => item.severity === 'warning'))
})

test('软枚举：合法动作码/树形态无 warning', () => {
  writeDesign()
  const result = runValidate([entitiesFile, pagesFile])
  assert.equal(result.status, 0)
  assert.deepEqual(result.json.warnings, [])
})

test('entities-example.json + pages-example.json 通过 validate.mjs', () => {
  const result = runValidate([entitiesExample, pagesExample])
  assert.equal(result.status, 0)
  assert.equal(result.json.ok, true)
  assert.deepEqual(result.json.errors, [])
  assert.deepEqual(result.json.warnings, [])
})

test('B6-1 actionTargets：目标不存在/跨页面集 → warning，不阻断', async () => {
  const { designContractWarnings } = await import('../workspace/design-contract')
  writeDesign()
  const data = {
    schemaVersion: 2,
    pageSets: [
      {
        id: 'goods',
        epic: 'EP-001',
        title: '商品管理',
        pages: [
          {
            id: 'goods-list',
            name: '商品列表',
            type: 'list',
            entity: 'goods',
            rowActions: ['edit'],
            toolbarActions: ['create'],
            actionTargets: { create: 'missing-form', edit: 'other-form' }
          },
          { id: 'goods-form', name: '商品表单', type: 'form', entity: 'goods', recipe: 'dialog-form' }
        ]
      },
      {
        id: 'other',
        epic: 'EP-002',
        title: '其它',
        pages: [{ id: 'other-form', name: '其它表单', type: 'form', entity: 'goods', recipe: 'dialog-form' }]
      }
    ]
  }
  const warnings = designContractWarnings(data)
  const paths = warnings.map(item => item.path)
  assert.ok(paths.includes('pageSets[0].pages[0].actionTargets.create'), JSON.stringify(paths))
  assert.ok(paths.includes('pageSets[0].pages[0].actionTargets.edit'), JSON.stringify(paths))
  assert.match(warnings.find(item => item.path.endsWith('.create'))?.message ?? '', /不存在或不在同一页面集/)

  const validateFile = pagesFile
  fs.writeFileSync(validateFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  const run = runValidate([entitiesFile, validateFile])
  assert.equal(run.status, 0)
  assert.equal(run.json.ok, true)
  assert.deepEqual(run.json.errors, [])
  const softPaths = (run.json.warnings as Array<{ path: string }>).map(item => item.path)
  assert.ok(softPaths.includes('pageSets[0].pages[0].actionTargets.create'), JSON.stringify(softPaths))
  assert.ok(softPaths.includes('pageSets[0].pages[0].actionTargets.edit'), JSON.stringify(softPaths))
  writeDesign()
})

test('B6-1 actionTargets：配方不匹配（create/edit 非表单、detail 非 detail）→ warning', async () => {
  const { designContractWarnings } = await import('../workspace/design-contract')
  const data = {
    schemaVersion: 2,
    pageSets: [
      {
        id: 'goods',
        epic: 'EP-001',
        title: '商品管理',
        pages: [
          {
            id: 'goods-list',
            name: '商品列表',
            type: 'list',
            entity: 'goods',
            rowActions: ['detail'],
            toolbarActions: ['create'],
            actionTargets: { create: 'goods-detail', detail: 'goods-form' }
          },
          { id: 'goods-detail', name: '商品详情', type: 'detail', entity: 'goods', recipe: 'detail' },
          { id: 'goods-form', name: '商品表单', type: 'form', entity: 'goods', recipe: 'dialog-form' }
        ]
      }
    ]
  }
  const warnings = designContractWarnings(data)
  assert.ok(warnings.some(item => item.path === 'pageSets[0].pages[0].actionTargets.create' && /不是表单配方/.test(item.message)))
  assert.ok(warnings.some(item => item.path === 'pageSets[0].pages[0].actionTargets.detail' && /不是 detail/.test(item.message)))
})

test('B6-1 actionTargets：create/edit 无映射且无同实体表单页 → warning；显式映射则不报', async () => {
  const { designContractWarnings } = await import('../workspace/design-contract')
  const pagesOf = (withTargets: boolean) => ({
    schemaVersion: 2,
    pageSets: [
      {
        id: 'goods',
        epic: 'EP-001',
        title: '商品管理',
        pages: [
          {
            id: 'goods-list',
            name: '商品列表',
            type: 'list',
            entity: 'goods',
            rowActions: ['edit', 'detail'],
            toolbarActions: ['create'],
            ...(withTargets ? { actionTargets: { create: 'goods-detail', edit: 'goods-detail' } } : {})
          },
          { id: 'goods-detail', name: '商品详情', type: 'detail', entity: 'goods', recipe: 'detail' }
        ]
      }
    ]
  })
  const missing = designContractWarnings(pagesOf(false))
  assert.ok(
    missing.some(item => item.path === 'pageSets[0].pages[0]' && /动作「create\/edit」/.test(item.message)),
    JSON.stringify(missing)
  )
  const declared = designContractWarnings(pagesOf(true))
  assert.ok(!declared.some(item => item.path === 'pageSets[0].pages[0]' && /动作「/.test(item.message)), JSON.stringify(declared))
})

test('B6-1 actionTargets：表单页自身声明 create 不报“缺表单页”（app1 order-create 形状）', async () => {
  const { designContractWarnings } = await import('../workspace/design-contract')
  const data = {
    schemaVersion: 2,
    pageSets: [
      {
        id: 'order',
        epic: 'EP-002',
        title: '订单',
        pages: [
          {
            id: 'order-list',
            name: '订单列表',
            type: 'list',
            entity: 'order',
            toolbarActions: ['create']
          },
          {
            id: 'order-create',
            name: '新建订单',
            type: 'form',
            entity: 'order',
            recipe: 'main-sub',
            toolbarActions: ['create']
          }
        ]
      }
    ]
  }
  const warnings = designContractWarnings(data)
  assert.ok(
    !warnings.some(item => item.message.includes('没有同实体') || item.message.includes('动作「')),
    JSON.stringify(warnings)
  )
})

test('B6-1 actionTargets：单页契约（pack 兼容路径）不做页面集语义 warning', async () => {
  const { designContractWarnings } = await import('../workspace/design-contract')
  const warnings = designContractWarnings({
    pages: [
      {
        id: 'contract-page',
        name: '契约页',
        type: 'list',
        entity: 'goods',
        rowActions: ['edit'],
        toolbarActions: ['create'],
        actionTargets: { create: 'missing-form' }
      }
    ]
  })
  assert.deepEqual(warnings, [])
})
