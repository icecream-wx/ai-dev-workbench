/**
 * 产物解析（D1）：单需求文档 frontmatter/章节/Epic；entities.json + pages.json schema 校验；hash 聚合。
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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

function writeRequirementDoc(frontmatter: string, body: string): void {
  fs.mkdirSync(requirements, { recursive: true })
  fs.writeFileSync(path.join(requirements, 'requirements.md'), `---\n${frontmatter}\n---\n\n${body}`, 'utf8')
}

function writeEntities(content: unknown): void {
  fs.mkdirSync(designs, { recursive: true })
  fs.writeFileSync(path.join(designs, 'entities.json'), `${JSON.stringify(content, null, 2)}\n`, 'utf8')
}

function writePages(content: unknown): void {
  fs.mkdirSync(designs, { recursive: true })
  fs.writeFileSync(path.join(designs, 'pages.json'), `${JSON.stringify(content, null, 2)}\n`, 'utf8')
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

test('解析单需求文档 frontmatter + 章节 + Epic/Story', async () => {
  const { readArtifacts } = await import('./artifacts')
  writeRequirementDoc(
    'title: "商品管理应用"\ntemplate: builtin-prd',
    '# 商品管理应用\n\n## 1. 目标\n\n卖货。\n\n## 2. Epics\n\n### EP-001 商品管理\n\n#### US-001 商品列表\n\n- 验收。\n'
  )
  const artifacts = readArtifacts('art-app')
  const requirement = artifacts.requirement
  assert.equal(requirement.exists, true)
  assert.equal(requirement.title, '商品管理应用')
  assert.equal(requirement.template, 'builtin-prd')
  assert.equal(requirement.file, 'docs/requirements/requirements.md')
  assert.deepEqual(
    requirement.sections.map(section => section.title),
    ['1. 目标', '2. Epics', 'EP-001 商品管理', 'US-001 商品列表']
  )
  assert.match(requirement.sections[0].markdown, /卖货/)
  assert.equal(requirement.epics.length, 1)
  assert.equal(requirement.epics[0].id, 'EP-001')
  assert.equal(requirement.epics[0].stories[0].id, 'US-001')
  assert.deepEqual(artifacts.errors, [])
  assert.ok(Object.keys(artifacts.hashes).includes('docs/requirements/requirements.md'))
  assert.equal(artifacts.apiDesign.exists, false)
  assert.equal(artifacts.apiDesign.file, 'docs/design/api-design.md')
})

test('缺少 title / 不再使用 module/order → errors/warnings（不抛 500）', async () => {
  const { readRequirement } = await import('./artifacts')
  writeRequirementDoc('module: MOD-001\norder: 1\ntemplate: builtin-prd', '# x\n\n## 1. 目标\n')
  const requirement = readRequirement(appDir)
  assert.ok(requirement.errors.some(error => error.path === 'title'))
  assert.ok(requirement.warnings.some(message => /不再使用 module/.test(message)))
  assert.ok(requirement.warnings.some(message => /不再使用 order/.test(message)))
  assert.ok(requirement.warnings.some(message => /还没有 Epic/.test(message)))
})

test('entities.json：合法通过；非法返回文件/字段/期望；设计 hash 固定顺序', async () => {
  const { readArtifacts, readEntities, designSchemaPath } = await import('./artifacts')
  assert.match(String(designSchemaPath(appDir, 'entities.schema.json')), /entities\.schema\.json$/)
  assert.match(String(designSchemaPath(appDir, 'pages.schema.json')), /pages\.schema\.json$/)

  writeEntities({
    schemaVersion: 2,
    entities: [
      {
        id: 'goods',
        name: '商品',
        fields: [
          { code: 'goodsCode', name: '商品编码', type: 'string', required: true },
          {
            code: 'status',
            name: '状态',
            type: 'enum',
            options: [{ value: 'ON_SALE', label: '上架' }]
          }
        ]
      }
    ],
    relations: []
  })
  let artifacts = readArtifacts('art-app')
  assert.equal(artifacts.entities.exists, true)
  assert.deepEqual(artifacts.entities.errors, [])
  assert.equal(artifacts.entities.entities.length, 1)

  writeEntities({ schemaVersion: 2, entities: 'oops' })
  artifacts = readArtifacts('art-app')
  const errorPaths = artifacts.errors.filter(error => error.file.includes('entities.json')).map(error => error.path)
  assert.ok(errorPaths.includes('entities'), `应报告 entities 类型错误：${JSON.stringify(errorPaths)}`)

  writeEntities({
    schemaVersion: 2,
    entities: [{ id: 'goods', name: '商品', fields: [{ code: 'status', name: '状态', type: 'bad-type' }] }]
  })
  const entitiesResult = readEntities(appDir)
  assert.ok(entitiesResult.errors.some(error => error.path === 'entities[0].fields[0].type' && error.expected))

  // designHash = sha256(entities.json + pages.json + design-system.json)
  const hash = createHash('sha256')
  hash.update(fs.readFileSync(path.join(designs, 'entities.json')))
  hash.update(Buffer.alloc(0))
  hash.update(Buffer.alloc(0))
  writePages({ schemaVersion: 2, pageSets: [] })
  const noPagesHash = createHash('sha256')
  noPagesHash.update(fs.readFileSync(path.join(designs, 'entities.json')))
  noPagesHash.update(fs.readFileSync(path.join(designs, 'pages.json')))
  noPagesHash.update(Buffer.alloc(0))
  const withPages = readArtifacts('art-app')
  assert.equal(withPages.designHash, noPagesHash.digest('hex'))

  // JSON 语法错误
  fs.writeFileSync(path.join(designs, 'entities.json'), '{ not json', 'utf8')
  const broken = readEntities(appDir)
  assert.ok(broken.errors.some(error => /JSON 解析失败/.test(error.message)))
})

test('pages.json：页面集 = Epic；字段 code 引用不存在/页面 id 重复/actions → warning', async () => {
  const { readPages } = await import('./artifacts')
  writeRequirementDoc('title: "商品"\ntemplate: builtin-prd', '# 商品\n\n### EP-001 商品管理\n')
  writeEntities({
    schemaVersion: 2,
    entities: [{ id: 'goods', name: '商品', fields: [{ code: 'goodsCode', name: '商品编码', type: 'string' }] }]
  })
  writePages({
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
            columns: ['goodsCode', 'missingCode'],
            actions: ['新增']
          },
          { id: 'goods-list', name: '重复', type: 'list', entity: 'goods' }
        ]
      },
      { id: 'other', epic: 'EP-999', title: '不一致', pages: [] }
    ]
  })
  const requirement = (await import('./artifacts')).readRequirement(appDir)
  const pages = readPages(appDir, requirement)
  assert.deepEqual(pages.errors, [])
  assert.equal(pages.pageSets.length, 2)
  assert.equal(pages.pages.length, 1)
  const text = pages.warnings.join('\n')
  assert.match(text, /不存在的字段 code：missingCode/)
  assert.match(text, /页面 id 重复：goods-list/)
  assert.match(text, /不再写 actions/)
  assert.match(text, /EP-999 不在需求文档中/)
})
