/**
 * P7-7c：应用设计系统文件（自定义 pack：reference 蓝图 + contract 契约 + 合并 structure + 风格 + preview/origin）
 *
 * - `buildDesignSystemSummary`：origin/preview/pages.kind/source/contractFile；contract 页无 blueprint；
 * - `writeDesignSystemWorkspace`：受管副本（幂等、覆盖）；contract 页只写 contracts/<page>.json；
 * - 自定义 structure 原样复制；styles/shared + styles/<styleId>/style.css。
 *
 * 临时目录；不启动 opencode、不调用模型。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-system-file-'))
const dataDir = path.join(root, 'data')
const packId = 'supplier-hub'
const PACK_ID_BUILTIN = 'afcenter-app-templates-v1'

process.env.RG_DATA_DIR = dataDir
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_AUTO_START = 'false'

function write(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

const packRoot = path.join(dataDir, 'design-system', packId)
const builtinRoot = path.resolve(__dirname, '../../../templates/design-system', PACK_ID_BUILTIN)

function seedCustomPack(): void {
  // 真实内置蓝图字节（reference 页快照）
  fs.mkdirSync(packRoot, { recursive: true })
  write(
    path.join(packRoot, 'application-types', packId, 'pages', 'supplier-list.vue'),
    fs.readFileSync(
      path.join(builtinRoot, 'application-types', 'operations-management', 'pages', 'OperationsList.vue')
    )
  )
  write(path.join(packRoot, 'application-types', packId, 'structure.css'), '.business-page { display: block; }\n.merged-marker { color: #145fba; }\n')
  write(path.join(packRoot, 'application-types', packId, 'assets', 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n')
  write(path.join(packRoot, 'styles', 'shared.css'), ':root { --shared: 1; }\n')
  write(path.join(packRoot, 'styles', 'data-cyan', 'style.css'), '.visual-style-data-cyan { color: #145fba; }\n')
  write(
    path.join(packRoot, 'pack.json'),
    json({
      schemaVersion: 1,
      id: packId,
      name: '供应商管理模板',
      version: '1.0.2',
      defaultApplicationType: packId,
      defaultStyle: 'data-cyan',
      origin: {
        kind: 'custom',
        draftId: packId,
        builtFrom: { pack: PACK_ID_BUILTIN, version: '1.0.0' },
        baseApplicationType: 'enterprise-application-platform',
        style: 'data-cyan',
        revision: 3
      },
      applicationTypes: [
        {
          id: packId,
          name: '供应商管理模板',
          category: 'custom',
          description: '供应商台账（引用运营列表）+ 弹窗表单（契约）',
          structure: `application-types/${packId}/structure.css`,
          assets: [`application-types/${packId}/assets/logo.svg`],
          defaultStyle: 'data-cyan',
          pages: [
            {
              id: 'supplier-list',
              name: '供应商列表',
              type: 'list',
              recipe: 'list',
              preview: 'list',
              description: '供应商台账',
              kind: 'reference',
              blueprint: `application-types/${packId}/pages/supplier-list.vue`,
              source: { pack: PACK_ID_BUILTIN, applicationType: 'operations-management', pageId: 'list' },
              components: ['pm-search', 'pm-table']
            },
            {
              id: 'supplier-form',
              name: '供应商表单',
              type: 'form',
              recipe: 'dialog-form',
              preview: 'form',
              description: '供应商弹窗表单',
              kind: 'contract',
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
                  { name: 'code', type: 'string' },
                  { name: 'name', type: 'string' },
                  { name: 'status', type: 'enum', options: ['启用', '停用'] }
                ]
              },
              components: ['pm-form-dialog']
            }
          ]
        }
      ],
      styles: [
        {
          id: 'data-cyan',
          name: '数据蓝青',
          className: 'visual-style-data-cyan',
          css: 'styles/data-cyan/style.css',
          description: '蓝青冷色',
          signature: '#145FBA',
          tokens: { primary: '#145fba', accent: '#07858d', neutral: '#66758a', background: '#f3f7fb', radius: 12, density: 'compact' }
        }
      ],
      skills: ['afcenter-page-generation', 'pm-components-usage'],
      componentMap: { 'ref:org': 'pm-select-org' },
      pageRecipes: { list: ['BusinessListPage'], 'dialog-form': ['StandardFormPage'] },
      conformance: ['页面使用 PageTemplates']
    })
  )
}

seedCustomPack()

const selection = { pack: packId, applicationType: packId, style: 'data-cyan' }

after(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

test('buildDesignSystemSummary：origin/preview/kind/source/contractFile；contract 页无 blueprint', async () => {
  const { buildDesignSystemSummary, contractFileContent } = await import('../design/system-file')
  const summary = buildDesignSystemSummary(selection, { appId: 'custom-app' })
  assert.equal(summary.schemaVersion, 1)
  assert.equal(summary.pack, packId)
  assert.equal(summary.packVersion, '1.0.2')
  assert.deepEqual(summary.origin, {
    kind: 'custom',
    draftId: packId,
    baseApplicationType: 'enterprise-application-platform'
  })
  assert.deepEqual(summary.preview, {
    kind: 'custom',
    baseApplicationType: 'enterprise-application-platform',
    structure: `docs/design/template/${packId}/structure.css`,
    structureUrl: `/api/apps/custom-app/design-system/asset?path=${encodeURIComponent(`${packId}/structure.css`)}`,
    styleClassName: 'visual-style-data-cyan',
    packVersion: '1.0.2'
  })
  assert.equal(summary.structure, `docs/design/template/${packId}/structure.css`)

  const list = summary.pages.find(page => page.id === 'supplier-list')!
  assert.equal(list.kind, 'reference')
  assert.equal(list.blueprint, `docs/design/template/${packId}/pages/supplier-list.vue`)
  assert.deepEqual(list.source, { pack: PACK_ID_BUILTIN, applicationType: 'operations-management', pageId: 'list' })
  assert.equal(list.contractFile, undefined)

  const form = summary.pages.find(page => page.id === 'supplier-form')!
  assert.equal(form.kind, 'contract')
  assert.equal(form.blueprint, undefined)
  assert.equal(form.packBlueprint, undefined)
  assert.equal(form.contractFile, `docs/design/template/${packId}/contracts/supplier-form.json`)

  const packModule = await import('../design/pack')
  const contractText = contractFileContent(packModule.getPage(packModule.getPack(packId), packId, 'supplier-form'))
  const contract = JSON.parse(contractText) as Record<string, unknown>
  assert.equal(contract.schemaVersion, 1)
  assert.equal(contract.pageId, 'supplier-form')
  assert.equal(contract.recipe, 'dialog-form')
  assert.ok(contract.contract)
  assert.equal((contract.sampleEntity as { id: string }).id, 'supplier')
})

test('writeDesignSystemWorkspace：输出 design-system.json/合并 structure/蓝图/契约/资产/风格；契约页无 .vue', async () => {
  const { writeDesignSystemWorkspace } = await import('../design/system-file')
  const appDir = path.join(root, 'apps', 'custom-app')
  fs.mkdirSync(appDir, { recursive: true })
  const summary = writeDesignSystemWorkspace(appDir, selection, { appId: 'custom-app' })

  const files = [
    'docs/design/design-system.json',
    `docs/design/template/${packId}/structure.css`,
    `docs/design/template/${packId}/pages/supplier-list.vue`,
    `docs/design/template/${packId}/contracts/supplier-form.json`,
    `docs/design/template/${packId}/assets/logo.svg`,
    'docs/design/template/styles/shared.css',
    'docs/design/template/styles/data-cyan/style.css'
  ]
  for (const relative of files) assert.ok(fs.existsSync(path.join(appDir, relative)), `缺少 ${relative}`)
  assert.equal(fs.existsSync(path.join(appDir, `docs/design/template/${packId}/pages/supplier-form.vue`)), false)

  // 合并 structure 原样复制
  assert.equal(
    fs.readFileSync(path.join(appDir, `docs/design/template/${packId}/structure.css`), 'utf8'),
    fs.readFileSync(path.join(packRoot, 'application-types', packId, 'structure.css'), 'utf8')
  )
  // 契约文件内容
  const contract = JSON.parse(
    fs.readFileSync(path.join(appDir, `docs/design/template/${packId}/contracts/supplier-form.json`), 'utf8')
  ) as Record<string, unknown>
  assert.equal(contract.pageId, 'supplier-form')
  assert.deepEqual((contract.sampleEntity as { fields: unknown[] }).fields.length, 3)
  // design-system.json
  const fileText = fs.readFileSync(path.join(appDir, 'docs/design/design-system.json'), 'utf8')
  const file = JSON.parse(fileText) as Record<string, unknown>
  assert.deepEqual(file.origin, summary.origin)
  assert.deepEqual(file.preview, summary.preview)
  assert.equal((file.pages as Array<{ kind: string }>)[1].kind, 'contract')
})

test('writeDesignSystemWorkspace：幂等（重复写入字节一致；受管文件删除后恢复）', async () => {
  const { writeDesignSystemWorkspace } = await import('../design/system-file')
  const appDir = path.join(root, 'apps', 'idempotent')
  fs.mkdirSync(appDir, { recursive: true })
  writeDesignSystemWorkspace(appDir, selection, { appId: 'idempotent' })
  const target = path.join(appDir, `docs/design/template/${packId}/contracts/supplier-form.json`)
  const before = fs.readFileSync(target)
  const summaryBefore = fs.readFileSync(path.join(appDir, 'docs/design/design-system.json'))
  writeDesignSystemWorkspace(appDir, selection, { appId: 'idempotent' })
  assert.equal(Buffer.compare(fs.readFileSync(target), before), 0)
  assert.equal(Buffer.compare(fs.readFileSync(path.join(appDir, 'docs/design/design-system.json')), summaryBefore), 0)

  fs.rmSync(path.join(appDir, 'docs/design/design-system.json'))
  fs.rmSync(target)
  writeDesignSystemWorkspace(appDir, selection, { appId: 'idempotent' })
  assert.ok(fs.existsSync(target))
  assert.ok(fs.existsSync(path.join(appDir, 'docs/design/design-system.json')))
})

test('buildDesignSystemSummary：preview.structureUrl 仅在提供 appId 时写入（skill 摘要兼容）', async () => {
  const { buildDesignSystemSummary } = await import('../design/system-file')
  const summary = buildDesignSystemSummary(selection)
  assert.ok(summary.preview)
  assert.equal(summary.preview?.structureUrl, undefined)
})
