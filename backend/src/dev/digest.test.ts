/**
 * P7-7c：开发 digest / ui-check 对自定义模板契约页的识别
 *
 * - digest：页面摘要带 kind/source/contractFile；契约页给“无蓝图，按契约实现”+ 契约摘要；
 * - ui-check：页面表含类型/来源/契约；契约页“蓝图：无（契约页）”；
 * - 缺失生成、已存在不覆盖（软门禁）。
 *
 * 临时目录；不启动 opencode、不调用模型。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-dev-digest-'))
const appDir = path.join(root, 'projects', 'digest-app')

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

const DESIGN_SYSTEM = {
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

const DESIGN = {
  module: 'MOD-001',
  title: '供应商管理',
  entities: [
    {
      id: 'supplier',
      name: '供应商',
      fields: [
        { name: 'code', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'status', type: 'enum', options: ['启用', '停用'] }
      ]
    }
  ],
  relations: [],
  pages: [
    {
      id: 'supplier-list',
      name: '供应商列表',
      type: 'list',
      recipe: 'list',
      catalogRef: 'supplier-hub/supplier-list',
      entity: 'supplier',
      columns: ['code', 'name', 'status'],
      filters: ['name'],
      rowActions: ['edit', 'delete'],
      toolbarActions: ['create']
    },
    {
      id: 'supplier-form',
      name: '供应商表单',
      type: 'form',
      recipe: 'dialog-form',
      catalogRef: 'supplier-hub/supplier-form',
      entity: 'supplier',
      form: { presentation: 'dialog', columns: 2, width: 900, groups: [{ title: '基本信息', fields: ['code', 'name', 'status'] }] }
    }
  ]
}

function seedWorkspace(): void {
  write(path.join(appDir, 'docs/design/design-system.json'), json(DESIGN_SYSTEM))
  write(path.join(appDir, 'docs/design/MOD-001/design.json'), json(DESIGN))
  write(
    path.join(appDir, 'docs/design/template/supplier-hub/contracts/supplier-form.json'),
    json({
      schemaVersion: 1,
      pageId: 'supplier-form',
      name: '供应商表单',
      recipe: 'dialog-form',
      contract: {
        columns: ['code', 'name'],
        filters: ['name'],
        rowActions: ['edit'],
        form: { presentation: 'dialog', columns: 2, width: 900, groups: [{ title: '基本信息', fields: ['code', 'name', 'status'] }] }
      },
      sampleEntity: {
        id: 'supplier',
        name: '供应商',
        fields: [
          { name: 'code', type: 'string' },
          { name: 'name', type: 'string' },
          { name: 'status', type: 'enum', options: ['启用', '停用'] }
        ]
      }
    })
  )
  write(path.join(appDir, 'docs/design/template/supplier-hub/pages/supplier-list.vue'), '<template><div /></template>\n')
  write(path.join(appDir, 'docs/design/template/supplier-hub/structure.css'), '.business-page { display: block; }\n')
  write(path.join(appDir, 'docs/design/template/styles/shared.css'), ':root { --x: 1; }\n')
  write(path.join(appDir, 'docs/design/template/styles/data-cyan/style.css'), '.visual-style-data-cyan { color: #145fba; }\n')
}

seedWorkspace()

test('digest：契约页标注无蓝图 + 契约摘要；reference 带来源；自定义模板标记', async () => {
  const { buildDesignDigest } = await import('./digest')
  const digest = buildDesignDigest('digest-app', 'MOD-001', appDir)
  assert.match(digest, /【设计摘要】/)
  assert.match(digest, /自定义模板（base=enterprise-application-platform）/)
  assert.match(digest, /kind=reference/)
  assert.match(digest, /source=afcenter-app-templates-v1\/operations-management\/list/)
  assert.match(digest, /kind=contract/)
  assert.match(digest, /contract=docs\/design\/template\/supplier-hub\/contracts\/supplier-form\.json/)
  assert.match(digest, /无蓝图，按契约实现/)
  assert.match(digest, /契约：.*表单=dialog 2 列 900px/)
  assert.match(digest, /样例实体=supplier/)
  assert.ok(digest.length <= 6000 + 200, `摘要长度应受控（实际 ${digest.length}）`)
})

test('digest：契约文件缺失时仍可读（提示缺失，不抛错）', async () => {
  const { buildDesignDigest } = await import('./digest')
  const missingDir = path.join(root, 'projects', 'digest-missing')
  fs.cpSync(appDir, missingDir, { recursive: true })
  fs.rmSync(path.join(missingDir, 'docs/design/template/supplier-hub/contracts/supplier-form.json'))
  const digest = buildDesignDigest('digest-missing', 'MOD-001', missingDir)
  assert.match(digest, /契约文件缺失/)
  assert.match(digest, /无蓝图，按契约实现/)
})

test('ui-check：页面表含类型/来源/契约；契约页蓝图写“无（契约页）”', async () => {
  const { buildUiCheckSkeleton } = await import('./ui-check')
  const skeleton = buildUiCheckSkeleton('MOD-001', DESIGN, DESIGN_SYSTEM)
  assert.match(skeleton, /\| 设计页 \| 类型\/来源 \| 蓝图 \| 契约 \| 字段\/列 \| 操作 \| 布局\/交互 \| 差异\/决策 \|/)
  assert.match(skeleton, /reference ← afcenter-app-templates-v1\/operations-management\/list/)
  assert.match(skeleton, /\| contract \| 无（契约页） \| docs\/design\/template\/supplier-hub\/contracts\/supplier-form\.json \|/)
  assert.match(skeleton, /契约页（无蓝图）读 `contracts\/<page>\.json` 按契约实现/)
})

test('ui-check：缺失生成、已存在不覆盖（软门禁只读状态）', async () => {
  const { ensureUiCheck, readUiCheck } = await import('./ui-check')
  assert.equal(readUiCheck(appDir, 'MOD-001').status, 'missing')
  const created = ensureUiCheck('digest-app', 'MOD-001', appDir)
  assert.equal(created.created, true)
  assert.equal(created.status, 'skeleton')

  const file = path.join(appDir, 'docs/design/MOD-001/ui-check.md')
  fs.appendFileSync(file, '\n已填内容\n', 'utf8')
  const filled = readUiCheck(appDir, 'MOD-001')
  assert.equal(filled.status, 'filled')
  const again = ensureUiCheck('digest-app', 'MOD-001', appDir)
  assert.equal(again.created, false)
  assert.match(fs.readFileSync(file, 'utf8'), /已填内容/)
})

after(() => {
  fs.rmSync(root, { recursive: true, force: true })
})
