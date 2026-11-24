/**
 * D2 接口设计：共享核心解析/errors/warnings/coverage + 后端 readApiDesign + CLI
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-api-design-'))
const appDir = path.join(root, 'api-app')
const example = path.resolve(
  __dirname,
  '../../../templates/agent/skills/adw-api-design/references/api-design-example.md'
)
const script = path.resolve(
  __dirname,
  '../../../templates/agent/skills/adw-api-design/scripts/validate-api-design.mjs'
)

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function seed(): void {
  write(
    path.join(appDir, 'docs/requirements/requirements.md'),
    '---\ntitle: 商品管理应用\ntemplate: builtin-prd\n---\n\n# 商品管理应用\n\n### EP-001 商品管理\n'
  )
  write(
    path.join(appDir, 'docs/design/entities.json'),
    json({
      schemaVersion: 2,
      entities: [
        {
          id: 'goods',
          name: '商品',
          fields: [
            { code: 'id', name: 'ID', type: 'string' },
            { code: 'goodsCode', name: '商品编码', type: 'string' },
            { code: 'name', name: '商品名称', type: 'string' },
            {
              code: 'status',
              name: '状态',
              type: 'enum',
              options: [
                { value: 'ON_SALE', label: '上架' },
                { value: 'OFF_SALE', label: '下架' }
              ]
            },
            { code: 'price', name: '售价', type: 'decimal' },
            { code: 'stock', name: '库存', type: 'number' }
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
          id: 'goods',
          epic: 'EP-001',
          title: '商品管理',
          primaryEntity: 'goods',
          pages: [
            {
              id: 'goods-list',
              name: '商品列表',
              type: 'list',
              entity: 'goods',
              rowActions: ['detail', 'edit', 'delete'],
              toolbarActions: ['create', 'batchDelete', 'export']
            },
            { id: 'goods-form', name: '商品表单', type: 'form', entity: 'goods' }
          ]
        }
      ]
    })
  )
  fs.copyFileSync(example, path.join(appDir, 'docs/design/api-design.md'))
}

function runCli(args: string[]): { status: number; stdout: string } {
  let stdout = ''
  let status = 0
  try {
    stdout = execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' })
  } catch (error) {
    const failure = error as { status?: number; stdout?: string | Buffer }
    status = failure.status ?? 1
    stdout = failure.stdout ? failure.stdout.toString() : ''
  }
  return { status, stdout }
}

after(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

test('示例文档：8 接口 / 页面动作/实体 CRUD 全覆盖 / 0 errors / 0 warnings', async () => {
  seed()
  const { readApiDesign } = await import('./api-design')
  const artifact = readApiDesign(appDir)
  assert.equal(artifact.exists, true)
  assert.equal(artifact.file, 'docs/design/api-design.md')
  assert.equal(artifact.interfaces.length, 8)
  assert.equal(artifact.byEpic.length, 1)
  assert.deepEqual(artifact.errors, [])
  assert.deepEqual(artifact.warnings, [])
  assert.equal(artifact.coverage.pageActions.length, 7)
  assert.equal(artifact.coverage.entities[0].missing.length, 0)
  assert.match(artifact.markdown, /## 2\. 接口索引/)

  const { buildDesignDigest } = await import('./digest')
  const digest = buildDesignDigest('api-app', appDir)
  assert.match(digest, /接口设计：docs\/design\/api-design\.md（8 个接口 · 1 个 Epic/)
  assert.match(digest, /goods\.list GET \/api\/goods（list）/)
})

test('文件缺失：exists:false，不产生错误', async () => {
  const { readApiDesign } = await import('./api-design')
  const emptyDir = path.join(root, 'empty-app')
  fs.mkdirSync(emptyDir, { recursive: true })
  const artifact = readApiDesign(emptyDir)
  assert.equal(artifact.exists, false)
  assert.deepEqual(artifact.interfaces, [])
  assert.deepEqual(artifact.errors, [])
})

test('errors：重复 ID / 非法 method/path / 缺章节 / 索引详情不一致 / 缺分页 / 字段 code 不存在', async () => {
  seed()
  const markdown = fs.readFileSync(path.join(appDir, 'docs/design/api-design.md'), 'utf8')
  const broken = markdown
    .replace('## 1. 接口规范', '## 1. 其它')
    .replace('| goods.list | GET | /api/goods |', '| goods.list | GET | /goods |')
    .replace('| goods.detail | GET | /api/goods/{id} |', '| goods.detail | FETCH | /api/goods/{id} |')
    .replace('| goods.create | POST | /api/goods |', '| goods.list | POST | /api/goods |')
    .replace('items[].goodsCode | string', 'items[].missingCode | string')
    .replace('| page | query | integer | 否 | 1 | 页码 |\n| size | query | integer | 否 | 20 | 每页 |\n', '')
  write(path.join(appDir, 'docs/design/api-design.md'), broken)
  const { readApiDesign } = await import('./api-design')
  const artifact = readApiDesign(appDir)
  const messages = artifact.errors.map(error => `${error.path} ${error.message}`).join('\n')
  assert.match(messages, /缺少必需章节「1\. 接口规范」/)
  assert.match(messages, /路径必须以 \/api 开头/)
  assert.match(messages, /方法不合法：FETCH/)
  assert.match(messages, /接口 ID 重复：goods\.list/)
  assert.match(messages, /详情有接口但索引缺失：goods\.create/)
  assert.match(messages, /字段 code 不存在：items\[\]\.missingCode/)
  assert.match(messages, /列表接口缺少分页请求参数/)
})

test('warnings：未覆盖页面动作/实体 CRUD、未引用接口、权限/示例缺失、Epic 标题不一致', async () => {
  seed()
  const markdown = fs.readFileSync(path.join(appDir, 'docs/design/api-design.md'), 'utf8')
  const weak = markdown
    .replace('| EP-001 商品管理 | goods-list | export | goods.export | |\n', '')
    .replace('| goods | goods.list | goods.detail | goods.create | goods.update | goods.delete | |', '| goods | goods.list | | | | | |')
    .replace('| goods.export | POST | /api/goods/export | 导出商品 | export | EP-001 商品管理 | goods-list | goods | goods:export |', '| goods.export | POST | /api/goods/export | 导出商品 | export | EP-001 商品管理 | goods-list | goods | |')
    .replace('**示例**\n\n```http\nGET /api/goods?keyword=笔记本&status=ON_SALE&page=1&size=20\n```', '**示例**\n')
  write(path.join(appDir, 'docs/design/api-design.md'), weak)
  write(
    path.join(appDir, 'docs/design/pages.json'),
    json({
      schemaVersion: 2,
      pageSets: [
        {
          id: 'goods',
          epic: 'EP-001',
          title: '商品中心',
          pages: [
            {
              id: 'goods-list',
              name: '商品列表',
              type: 'list',
              entity: 'goods',
              rowActions: ['detail', 'edit', 'delete'],
              toolbarActions: ['create', 'batchDelete', 'export']
            },
            { id: 'goods-form', name: '商品表单', type: 'form', entity: 'goods' }
          ]
        }
      ]
    })
  )
  const { readApiDesign } = await import('./api-design')
  const artifact = readApiDesign(appDir)
  const warnings = artifact.warnings.join('\n')
  assert.match(warnings, /页面动作未覆盖/)
  assert.match(warnings, /实体 goods 的 (detail|update|delete) 未在覆盖矩阵列出|实体 goods 缺少 (detail|update|delete)/)
  assert.match(warnings, /缺少权限/)
  assert.match(warnings, /缺少示例/)
  assert.match(warnings, /标题「商品管理」与页面集标题「商品中心」不一致/)
})

test('CLI：示例 exit 0；非法 exit 1；缺失文件 exit 0（不误报）', () => {
  seed()
  const good = runCli(['--app', appDir])
  assert.equal(good.status, 0)
  assert.equal(JSON.parse(good.stdout).interfaces.length, 8)

  const markdown = fs.readFileSync(path.join(appDir, 'docs/design/api-design.md'), 'utf8')
  write(path.join(appDir, 'docs/design/api-design.md'), markdown.replace('| goods.list | GET | /api/goods |', '| goods.list | GET | /goods |'))
  const bad = runCli(['--app', appDir])
  assert.equal(bad.status, 1)

  const emptyDir = path.join(root, 'cli-empty')
  fs.mkdirSync(emptyDir, { recursive: true })
  const missing = runCli(['--app', emptyDir])
  assert.equal(missing.status, 0)
  assert.equal(JSON.parse(missing.stdout).exists, false)
})
