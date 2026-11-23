/**
 * 产物解析：需求模块 frontmatter/章节、设计 JSON schema 校验、hash 聚合
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-artifacts-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')

const appDir = path.join(root, 'projects', 'art-app')
const requirements = path.join(appDir, 'docs', 'requirements')
const designs = path.join(appDir, 'docs', 'design')

function writeRequirement(name: string, frontmatter: string, body: string): void {
  fs.mkdirSync(requirements, { recursive: true })
  fs.writeFileSync(path.join(requirements, name), `---\n${frontmatter}\n---\n\n${body}`, 'utf8')
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

test('解析模块 frontmatter + 按 ## 切章节', async () => {
  const { readArtifacts } = await import('./artifacts')
  writeRequirement(
    'MOD-001-商品管理.md',
    'module: MOD-001\ntitle: "商品管理"\norder: 1\ntemplate: builtin-prd',
    '# 商品管理\n\n## 1. 目标\n\n卖货。\n\n## 2. 验收\n\n- 能下单。\n'
  )
  const artifacts = readArtifacts('art-app')
  const module = artifacts.modules.find(item => item.key === 'MOD-001')
  assert.ok(module)
  assert.equal(module.title, '商品管理')
  assert.equal(module.order, 1)
  assert.equal(module.template, 'builtin-prd')
  assert.equal(module.file, 'docs/requirements/MOD-001-商品管理.md')
  assert.deepEqual(
    module.sections.map(section => section.title),
    ['1. 目标', '2. 验收']
  )
  assert.match(module.sections[0].markdown, /卖货/)
  assert.deepEqual(artifacts.errors, [])
  assert.ok(Object.keys(artifacts.hashes).includes('docs/requirements/MOD-001-商品管理.md'))
})

test('缺失 module / 重复 module → 结构化错误（不抛 500）', async () => {
  const { readArtifacts } = await import('./artifacts')
  writeRequirement('MOD-002-缺 key.md', 'title: "缺 key"\norder: 2', '# 缺 key\n\n## 1. 目标\n')
  writeRequirement('MOD-003-重复一.md', 'module: MOD-003\ntitle: "重复一"\norder: 3', '# 重复一\n')
  writeRequirement('MOD-003-重复二.md', 'module: MOD-003\ntitle: "重复二"\norder: 4', '# 重复二\n')
  const artifacts = readArtifacts('art-app')
  assert.ok(artifacts.errors.some(error => error.file.endsWith('MOD-002-缺 key.md') && error.path === 'module'))
  assert.ok(artifacts.errors.some(error => /module 重复/.test(error.message)))
})

test('设计 JSON：合法通过；非法返回文件/字段/期望', async () => {
  const { readArtifacts, readDesigns, designSchemaPath } = await import('./artifacts')
  // 应用内没有 .opencode 副本时回退仓库资产（同一份 schema）
  assert.match(String(designSchemaPath(appDir)), /design\.schema\.json$/)

  const designsDir = path.join(appDir, 'docs', 'design')
  fs.mkdirSync(path.join(designsDir, 'MOD-001'), { recursive: true })
  const file = path.join(designsDir, 'MOD-001', 'design.json')
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        module: 'MOD-001',
        title: '商品管理',
        entities: [{ id: 'product', name: '商品', fields: [{ name: '名称', type: 'string' }] }],
        relations: [],
        pages: [{ id: 'product-list', name: '商品列表', type: 'list', entity: 'product' }]
      },
      null,
      2
    ),
    'utf8'
  )
  let artifacts = readArtifacts('art-app')
  assert.equal(artifacts.designs.length, 1)
  assert.deepEqual(artifacts.designs[0].errors, [])
  assert.equal(artifacts.designs[0].entities.length, 1)

  fs.writeFileSync(file, JSON.stringify({ module: 'MOD-001', title: '商品管理', entities: 'oops' }), 'utf8')
  artifacts = readArtifacts('art-app')
  const errorPaths = artifacts.errors.filter(error => error.file.includes('design.json')).map(error => error.path)
  assert.ok(errorPaths.includes('entities'), `应报告 entities 类型错误：${JSON.stringify(errorPaths)}`)
  assert.ok(errorPaths.includes('pages'), '应报告缺少 pages')

  // 单字段枚举错误
  fs.writeFileSync(
    file,
    JSON.stringify({
      module: 'MOD-001',
      title: '商品管理',
      entities: [{ id: 'product', name: '商品', fields: [{ name: '状态', type: 'bad-type' }] }],
      relations: [],
      pages: []
    }),
    'utf8'
  )
  const designsResult = readDesigns(appDir)
  assert.ok(designsResult.errors.some(error => error.path === 'entities[0].fields[0].type' && error.expected))

  // JSON 语法错误
  fs.writeFileSync(file, '{ not json', 'utf8')
  const broken = readDesigns(appDir)
  assert.ok(broken.errors.some(error => /JSON 解析失败/.test(error.message)))
})
