/**
 * P7-4a design.json 页面契约：schema 向后兼容、非法字段不阻断、validate.mjs 自查
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
const moduleKey = 'MOD-001'
const designDir = path.join(projects, appId, 'docs', 'design', moduleKey)
const designFile = path.join(designDir, 'design.json')
const repoRoot = path.resolve(__dirname, '../../..')
const skillDir = path.join(repoRoot, 'templates', 'agent', 'skills', 'adw-design-artifacts')
const validateScript = path.join(skillDir, 'scripts', 'validate.mjs')
const exampleFile = path.join(skillDir, 'references', 'design-example.json')

const LEGACY_DESIGN = {
  module: moduleKey,
  title: '商品管理',
  entities: [
    {
      id: 'product',
      name: '商品',
      fields: [
        { name: '商品编码', type: 'string', required: true },
        { name: '状态', type: 'enum', options: ['上架', '下架'] }
      ]
    }
  ],
  relations: [],
  pages: [
    { id: 'product-list', name: '商品列表', type: 'list', entity: 'product', columns: ['商品编码'], actions: ['新增'] },
    { id: 'product-form', name: '商品编辑', type: 'form', entity: 'product', actions: ['保存'] }
  ]
}

const CONTRACT_DESIGN = {
  ...LEGACY_DESIGN,
  designSystem: {
    pack: 'afcenter-app-templates-v1',
    applicationType: 'enterprise-application-platform',
    style: 'platform-blue'
  },
  pages: [
    {
      id: 'org-list',
      name: '组织架构',
      type: 'list',
      entity: 'product',
      recipe: 'tree-list',
      catalogRef: 'enterprise-application-platform/organization',
      blueprint: 'application-types/enterprise-application-platform/pages/OrganizationUsers.vue',
      filters: ['商品编码', '状态'],
      columns: ['商品编码', '状态'],
      rowActions: ['detail', 'edit', 'delete'],
      toolbarActions: ['create', 'batchDelete'],
      selection: true,
      pagination: { layout: 'three-part', pageSize: 20 },
      tree: { titleField: '商品编码', parentField: '状态', actionStyle: 'header', selectionStyle: 'dot' },
      subTables: [{ entity: 'product', title: '子商品', columns: ['商品编码'], mode: 'tab' }],
      components: { 状态: 'pm-select' }
    },
    {
      id: 'org-form',
      name: '组织编辑',
      type: 'form',
      entity: 'product',
      recipe: 'dialog-form',
      form: {
        presentation: 'dialog',
        columns: 2,
        width: 800,
        fields: ['商品编码', '状态'],
        groups: [{ title: '基本信息', fields: ['商品编码', '状态'] }]
      },
      components: { 状态: 'pm-select' }
    }
  ]
}

function writeDesign(content: unknown): void {
  fs.mkdirSync(designDir, { recursive: true })
  fs.writeFileSync(designFile, `${JSON.stringify(content, null, 2)}\n`, 'utf8')
}

function runValidate(file: string): { status: number; json: any } {
  let stdout = ''
  let status = 0
  try {
    stdout = execFileSync(process.execPath, [validateScript, file], { encoding: 'utf8' })
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

test('含 P7 页面契约字段的 design.json 通过后端 schema 校验', async () => {
  const { readDesigns, designSchemaPath } = await import('../workspace/artifacts')
  assert.match(String(designSchemaPath(path.join(projects, appId))), /design\.schema\.json$/)
  writeDesign(CONTRACT_DESIGN)
  const result = readDesigns(path.join(projects, appId))
  assert.equal(result.designs.length, 1)
  assert.deepEqual(result.errors, [])
  assert.equal((result.designs[0].pages as unknown[]).length, 2)
  assert.deepEqual((result.designs[0] as { designSystem?: unknown }).designSystem, CONTRACT_DESIGN.designSystem)
})

test('旧 design.json 保持通过、页面结构不变', async () => {
  const { readDesigns } = await import('../workspace/artifacts')
  writeDesign(LEGACY_DESIGN)
  const result = readDesigns(path.join(projects, appId))
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.designs[0].pages, LEGACY_DESIGN.pages)
  assert.equal((result.designs[0] as { designSystem?: unknown }).designSystem, undefined)
})

test('非法新字段 → 结构化错误列出但不阻断（设计仍返回）', async () => {
  const { readArtifacts } = await import('../workspace/artifacts')
  writeDesign({
    ...CONTRACT_DESIGN,
    designSystem: { pack: 42 },
    pages: [
      {
        ...CONTRACT_DESIGN.pages[0],
        recipe: 'timeline',
        pagination: { layout: 'grid', pageSize: 'many' },
        subTables: [{ entity: 'product', mode: 'grid' }],
        components: { 状态: 123 }
      },
      {
        ...CONTRACT_DESIGN.pages[1],
        form: { presentation: 'modal', columns: 3, width: -1 }
      }
    ]
  })
  const artifacts = readArtifacts(appId)
  const design = artifacts.designs.find(item => item.module === moduleKey)
  assert.ok(design, '设计应仍被解析返回')
  assert.equal((design?.pages as unknown[]).length, 2, '页面仍返回，不阻断')
  assert.equal(design?.title, '商品管理')

  const paths = artifacts.errors.filter(error => error.file.includes('design.json')).map(error => error.path)
  for (const expected of [
    'designSystem.pack',
    'pages[0].recipe',
    'pages[0].pagination.layout',
    'pages[0].pagination.pageSize',
    'pages[0].subTables[0].mode',
    'pages[0].components.状态',
    'pages[1].form.presentation',
    'pages[1].form.columns'
  ]) {
    assert.ok(paths.includes(expected), `应报告 ${expected}；实际 ${JSON.stringify(paths)}`)
  }
})

test('validate.mjs：新字段问题只出 warning 且不阻断；旧字段问题仍报错', () => {
  // 旧 design.json 不写新字段 → 无 errors / warnings
  writeDesign(LEGACY_DESIGN)
  const legacy = runValidate(designFile)
  assert.equal(legacy.status, 0)
  assert.equal(legacy.json.ok, true)
  assert.deepEqual(legacy.json.errors, [])
  assert.deepEqual(legacy.json.warnings, [])

  writeDesign(CONTRACT_DESIGN)
  const valid = runValidate(designFile)
  assert.equal(valid.status, 0)
  assert.equal(valid.json.ok, true)
  assert.deepEqual(valid.json.errors, [])
  assert.deepEqual(valid.json.warnings, [])

  writeDesign({
    ...CONTRACT_DESIGN,
    designSystem: { pack: 42 },
    pages: [
      {
        ...CONTRACT_DESIGN.pages[0],
        recipe: 'timeline',
        pagination: { layout: 'grid' },
        components: { 状态: 123 }
      }
    ]
  })
  const soft = runValidate(designFile)
  assert.equal(soft.status, 0, '新字段问题不阻断退出码')
  assert.equal(soft.json.ok, true)
  assert.deepEqual(soft.json.errors, [])
  assert.ok(soft.json.warnings.length >= 4, JSON.stringify(soft.json.warnings))
  assert.ok(soft.json.warnings.every((item: { severity?: string }) => item.severity === 'warning'))

  // 旧字段类型/必填错误仍然是 errors（退出码 1）
  writeDesign({ module: moduleKey, title: '商品管理', entities: 'oops', pages: [] })
  const broken = runValidate(designFile)
  assert.equal(broken.status, 1)
  assert.equal(broken.json.ok, false)
  assert.ok(broken.json.errors.some((item: { path: string }) => item.path === 'entities'))
})

test('软枚举：中文动作码/未知树形态只 warning，原值保留、不阻断', async () => {
  const { readDesigns } = await import('../workspace/artifacts')
  const softDesign = {
    ...CONTRACT_DESIGN,
    pages: [
      {
        ...CONTRACT_DESIGN.pages[0],
        rowActions: ['编辑', 'delete'],
        toolbarActions: ['新建账号'],
        tree: { titleField: '商品编码', parentField: '状态', actionStyle: 'inline', selectionStyle: 'flashy' }
      },
      CONTRACT_DESIGN.pages[1]
    ]
  }
  writeDesign(softDesign)
  const result = readDesigns(path.join(projects, appId))
  assert.deepEqual(result.errors, [])
  const design = result.designs[0]
  const warningText = design.warnings.join('\n')
  assert.match(warningText, /pages\[0\]\.rowActions\[0\].*编辑.*推荐/)
  assert.match(warningText, /pages\[0\]\.toolbarActions\[0\].*新建账号.*推荐/)
  assert.match(warningText, /pages\[0\]\.tree\.actionStyle.*inline.*推荐/)
  assert.match(warningText, /pages\[0\]\.tree\.selectionStyle.*flashy.*推荐/)

  const page = (design.pages as Array<Record<string, unknown>>)[0]
  assert.deepEqual(page.rowActions, ['编辑', 'delete'])
  assert.deepEqual(page.toolbarActions, ['新建账号'])
  assert.deepEqual(page.tree, { titleField: '商品编码', parentField: '状态', actionStyle: 'inline', selectionStyle: 'flashy' })

  const soft = runValidate(designFile)
  assert.equal(soft.status, 0, '软枚举不应阻断退出码')
  assert.equal(soft.json.ok, true)
  assert.deepEqual(soft.json.errors, [])
  const paths = (soft.json.warnings as Array<{ path: string; severity?: string }>).map(item => item.path)
  for (const expected of [
    'pages[0].rowActions[0]',
    'pages[0].toolbarActions[0]',
    'pages[0].tree.actionStyle',
    'pages[0].tree.selectionStyle'
  ]) {
    assert.ok(paths.includes(expected), `应报告 ${expected}；实际 ${JSON.stringify(paths)}`)
  }
  assert.ok(soft.json.warnings.every((item: { severity?: string }) => item.severity === 'warning'))
})

test('软枚举：合法动作码/树形态无 warning', () => {
  writeDesign(CONTRACT_DESIGN)
  const result = runValidate(designFile)
  assert.equal(result.status, 0)
  assert.deepEqual(result.json.warnings, [])
})

test('design-example.json（tree-list + dialog-form）通过 validate.mjs', () => {
  const result = runValidate(exampleFile)
  assert.equal(result.status, 0)
  assert.equal(result.json.ok, true)
  assert.deepEqual(result.json.errors, [])
  assert.deepEqual(result.json.warnings, [])
})
