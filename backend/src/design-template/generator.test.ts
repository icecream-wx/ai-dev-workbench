/**
 * P7-7a spec → pack 生成器（共享核心 `lib/generator.cjs`）
 *
 * - reference 复制内置蓝图字节 + sha256；contract 不写 .vue；
 * - styles/shared.css + 选中风格；structure.css 合并（来源顺序）；
 * - pack.json 确定性（同 spec 重跑字节一致、无时间戳）；publishedRevision → 版本；
 * - 错误不落半成品；资产复制/冲突/蓝图 import 缺失；
 * - contract.components 与 pack 页面顶层 components 命名空间不互相覆盖。
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'

import { builtinDesignSystemRoot, getBuiltinPack } from '../design/pack'
import { workshopCore } from '../design-template/core'

const generator = workshopCore().generator
const builtin = getBuiltinPack()
const BUILTIN_ROOT = path.join(builtinDesignSystemRoot(), builtin.id)
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p77a-generator-'))

after(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function target(name: string): string {
  return path.join(root, name)
}

function walk(dir: string, base = ''): Array<{ relative: string; bytes: Buffer }> {
  const files: Array<{ relative: string; bytes: Buffer }> = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...walk(path.join(dir, entry.name), relative))
    else files.push({ relative, bytes: fs.readFileSync(path.join(dir, entry.name)) })
  }
  return files.sort((a, b) => a.relative.localeCompare(b.relative))
}

function fixtureSpec(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'supplier-hub',
    name: '供应商管理模板',
    description: '供应商台账 + 表单 + 详情',
    baseApplicationType: 'enterprise-application-platform',
    style: 'data-cyan',
    pages: [
      {
        id: 'supplier-list',
        name: '供应商列表',
        kind: 'reference',
        source: { pack: builtin.id, applicationType: 'operations-management', pageId: 'list' }
      },
      {
        id: 'supplier-form',
        name: '供应商表单',
        kind: 'contract',
        type: 'form',
        recipe: 'dialog-form',
        description: '新建/编辑供应商',
        contract: {
          form: { presentation: 'dialog', columns: 2, width: 900, groups: [{ title: '基本信息', fields: ['name', 'status', 'ghost'] }] },
          components: { owner: 'pm-select-user', bad: 'pm-not-exist' }
        },
        sampleEntity: {
          id: 'supplier',
          name: '供应商',
          fields: [
            { name: 'name', label: '供应商名称', type: 'string' },
            { name: 'status', label: '状态', type: 'enum', options: ['启用', '停用'] },
            { name: 'owner', label: '负责人', type: 'string' }
          ]
        }
      },
      {
        id: 'supplier-detail',
        name: '供应商详情',
        kind: 'contract',
        type: 'detail',
        recipe: 'detail',
        contract: {
          columns: ['name', 'status'],
          subTables: [{ entity: 'supplier-contact', title: '联系人', columns: ['contactName'], mode: 'tab' }]
        },
        sampleEntity: {
          id: 'supplier',
          name: '供应商',
          fields: [
            { name: 'name', label: '供应商名称', type: 'string' },
            { name: 'status', label: '状态', type: 'enum', options: ['启用', '停用'] }
          ]
        },
        sampleSubEntities: [
          { id: 'supplier-contact', name: '联系人', fields: [{ name: 'contactName', label: '联系人', type: 'string' }] }
        ]
      }
    ]
  }
}

function generate(name: string, spec: unknown, extra: Record<string, unknown> = {}) {
  return generator.generatePack({
    spec,
    builtin,
    builtinRoot: BUILTIN_ROOT,
    targetDir: target(name),
    packId: 'supplier-hub',
    knownComponents: ['pm-select-user', 'pm-input'],
    ...extra
  })
}

test('生成 reference + contract：结构/字节/sha256/样式/资产', () => {
  const dir = target('repack')
  const result = generate('repack', fixtureSpec())
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.equal(result.pack?.id, 'supplier-hub')
  assert.equal(result.pack?.version, '1.0.0')
  assert.equal(result.pack?.revision, 0)
  assert.equal(result.pack?.pageCount, 3)

  const packFile = path.join(dir, 'pack.json')
  const rawText = fs.readFileSync(packFile, 'utf8')
  assert.ok(rawText.endsWith('\n'))
  const pack = JSON.parse(rawText) as Record<string, unknown>
  assert.equal(pack.version, '1.0.0')
  assert.equal(pack.defaultApplicationType, 'supplier-hub')
  assert.equal(pack.defaultStyle, 'data-cyan')
  assert.equal((pack.applicationTypes as unknown[]).length, 1)
  assert.equal((pack.styles as unknown[]).length, 1)
  const origin = pack.origin as Record<string, unknown>
  assert.equal(origin.kind, 'custom')
  assert.equal(origin.draftId, 'supplier-hub')
  assert.equal(origin.revision, 0)
  assert.ok(String(origin.specHash).startsWith('sha256:'))
  assert.equal('createdAt' in pack, false, 'pack 不写时间戳')
  assert.equal('publishedAt' in origin, false, '生成阶段不写 publishedAt')

  const type = (pack.applicationTypes as Array<Record<string, unknown>>)[0]
  assert.equal(type.id, 'supplier-hub')
  assert.equal(type.category, 'custom')
  assert.equal(type.structure, 'application-types/supplier-hub/structure.css')
  assert.ok(fs.existsSync(path.join(dir, 'application-types', 'supplier-hub', 'structure.css')))
  assert.ok(fs.existsSync(path.join(dir, 'styles', 'shared.css')))
  assert.ok(fs.existsSync(path.join(dir, 'styles', 'data-cyan', 'style.css')))
  assert.ok(fs.existsSync(path.join(dir, 'application-types', 'supplier-hub', 'assets', 'ledger-workflow.svg')))

  const pages = type.pages as Array<Record<string, unknown>>
  const ref = pages[0]
  assert.equal(ref.kind, 'reference')
  assert.equal(ref.blueprint, 'application-types/supplier-hub/pages/supplier-list.vue')
  const refBlueprint = path.join(dir, String(ref.blueprint))
  assert.ok(fs.existsSync(refBlueprint))
  const sourceBlueprint = path.join(BUILTIN_ROOT, 'application-types/operations-management/pages/OperationsList.vue')
  assert.equal(Buffer.compare(fs.readFileSync(refBlueprint), fs.readFileSync(sourceBlueprint)), 0, '蓝图必须是字节快照')
  const sourcePage = builtin.applicationTypes
    .find(item => item.id === 'operations-management')!
    .pages.find(item => item.id === 'list')!
  assert.deepEqual(ref.source, {
    pack: builtin.id,
    applicationType: 'operations-management',
    pageId: 'list',
    blueprint: sourcePage.blueprint,
    sha256: sha256File(sourceBlueprint)
  })
  assert.deepEqual(ref.components, sourcePage.components)
  assert.equal(ref.blocks, sourcePage.blocks)

  const form = pages[1]
  assert.equal(form.kind, 'contract')
  assert.equal(form.blueprint, undefined)
  assert.equal(fs.existsSync(path.join(dir, 'application-types', 'supplier-hub', 'pages', 'supplier-form.vue')), false)
  assert.deepEqual(form.contract, (fixtureSpec().pages as Array<Record<string, unknown>>)[1].contract)
  // contract.components(object) 不覆盖 pack 页面顶层 components(string[])；后者 = 覆盖值 + 配方默认组件
  assert.deepEqual(form.components, ['pm-select-user', 'pm-not-exist', 'pm-form-dialog', 'FormSection'])
  assert.equal((form.sampleEntity as Record<string, unknown>).id, 'supplier')

  const detail = pages[2]
  assert.deepEqual((detail.sampleSubEntities as Array<Record<string, unknown>>).map(entity => entity.id), ['supplier-contact'])

  // CSS 报告：来源顺序 = reference 来源类型（首次出现）+ baseApplicationType
  assert.deepEqual(result.css?.sources, ['operations-management', 'enterprise-application-platform'])
  assert.ok((result.css?.totalRules ?? 0) > 0)
  assert.ok((result.css?.rules ?? 0) > 0)

  const codes = (result.warnings ?? []).map(item => item.code)
  assert.ok(codes.includes('page-field-unknown'), codes.join(','))
  assert.ok(codes.includes('component-unknown'), codes.join(','))
})

test('同 spec 重跑：pack/页面/样式字节一致', () => {
  const first = generate('det-1', fixtureSpec())
  const second = generate('det-2', fixtureSpec())
  assert.equal(first.ok, true, JSON.stringify(first.errors))
  assert.equal(second.ok, true, JSON.stringify(second.errors))
  assert.deepEqual(walk(target('det-1')), walk(target('det-2')))
  assert.equal(first.specHash, second.specHash)
})

test('publishedRevision → version 1.0.N 且 origin.revision 同步', () => {
  const result = generate('revision', fixtureSpec(), { publishedRevision: 3 })
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  const pack = JSON.parse(fs.readFileSync(path.join(target('revision'), 'pack.json'), 'utf8')) as Record<string, unknown>
  assert.equal(pack.version, '1.0.3')
  assert.equal((pack.origin as Record<string, unknown>).revision, 3)
})

test('错误不落半成品：非法 spec / 非法 recipe', () => {
  const bad = fixtureSpec()
  ;(bad.pages as Array<Record<string, unknown>>)[1].recipe = 'matrix'
  const result = generate('broken', bad)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some(item => item.code === 'contract-recipe-unsupported'))
  assert.equal(fs.existsSync(target('broken')), false, '失败必须清理暂存目录')
})

test('contract-only spec：只合并 baseApplicationType 结构，不写 pages/*.vue', () => {
  const spec = {
    schemaVersion: 1,
    id: 'contract-only',
    name: '纯契约模板',
    style: 'data-cyan',
    pages: [
      {
        id: 'only-form',
        name: '表单',
        kind: 'contract',
        type: 'form',
        recipe: 'page-form',
        contract: { form: { groups: [{ title: '基本信息', fields: ['a'] }] } },
        sampleEntity: { id: 'e', name: '实体', fields: [{ name: 'a', label: 'A', type: 'string' }] }
      }
    ]
  }
  const result = generator.generatePack({
    spec,
    builtin,
    builtinRoot: BUILTIN_ROOT,
    targetDir: target('contract-only'),
    packId: 'contract-only'
  })
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.deepEqual(result.css?.sources, [builtin.defaultApplicationType])
  const pagesDir = path.join(target('contract-only'), 'application-types', 'contract-only', 'pages')
  assert.equal(fs.existsSync(pagesDir), true)
  assert.deepEqual(fs.readdirSync(pagesDir), [])
  const pack = JSON.parse(fs.readFileSync(path.join(target('contract-only'), 'pack.json'), 'utf8')) as Record<string, unknown>
  assert.equal(((pack.applicationTypes as Array<Record<string, unknown>>)[0].pages as unknown[]).length, 1)
})

/* ------------------------------------------------------------------ *
 * 资产：复制 / 冲突 / 蓝图 import 缺失（临时内置 pack fixture）
 * ------------------------------------------------------------------ */

function fakeBuiltin(): { pack: Record<string, unknown>; root: string } {
  const fakeRoot = path.join(root, 'fake-builtin')
  const pack = {
    schemaVersion: 1,
    id: 'fake-pack',
    name: '假内置模板',
    version: '1.0.0',
    defaultApplicationType: 'type-a',
    defaultStyle: 'demo',
    applicationTypes: [
      {
        id: 'type-a',
        name: 'A 类型',
        category: 'platform',
        description: 'A',
        structure: 'application-types/type-a/structure.css',
        assets: ['application-types/type-a/assets/logo.svg'],
        defaultStyle: 'demo',
        pages: [
          {
            id: 'list',
            name: 'A 列表',
            type: 'list',
            recipe: 'list',
            preview: 'list',
            description: 'A 列表',
            blueprint: 'application-types/type-a/pages/AList.vue',
            components: ['pm-table']
          }
        ]
      },
      {
        id: 'type-b',
        name: 'B 类型',
        category: 'platform',
        description: 'B',
        structure: 'application-types/type-b/structure.css',
        assets: ['application-types/type-b/assets/logo.svg'],
        defaultStyle: 'demo',
        pages: [
          {
            id: 'list',
            name: 'B 列表',
            type: 'list',
            recipe: 'list',
            preview: 'list',
            description: 'B 列表',
            blueprint: 'application-types/type-b/pages/BList.vue',
            components: ['pm-table']
          }
        ]
      }
    ],
    styles: [
      {
        id: 'demo',
        name: '演示',
        className: 'visual-style-demo',
        css: 'styles/demo/style.css',
        description: '演示',
        signature: '#123456',
        tokens: { primary: '#123456', accent: '#234567', neutral: '#345678', background: '#f5f5f5', radius: 8, density: 'compact' }
      }
    ],
    skills: ['afcenter-page-generation'],
    componentMap: { string: 'pm-input' },
    pageRecipes: { list: ['BusinessListPage'] },
    conformance: ['使用 PageTemplates']
  }
  const write = (relative: string, content: string) => {
    const file = path.join(fakeRoot, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content, 'utf8')
  }
  write('application-types/type-a/structure.css', '.a { color: red; }\n')
  write('application-types/type-b/structure.css', '.b { color: blue; }\n')
  write('application-types/type-a/pages/AList.vue', '<template><div class="a">A</div></template>\n')
  write('application-types/type-b/pages/BList.vue', '<template><div class="b">B</div></template>\n')
  write('application-types/type-a/assets/logo.svg', '<svg>a</svg>\n')
  write('application-types/type-b/assets/logo.svg', '<svg>b</svg>\n')
  write('styles/demo/style.css', '.demo { color: #123456; }\n')
  return { pack, root: fakeRoot }
}

test('资产冲突：不同来源类型同名资产内容不同 → asset-collision（失败清理）', () => {
  const fake = fakeBuiltin()
  const spec = {
    schemaVersion: 1,
    id: 'asset-collision',
    name: '资产冲突',
    baseApplicationType: 'type-a',
    style: 'demo',
    pages: [
      { id: 'a-list', name: 'A 列表', kind: 'reference', source: { pack: 'fake-pack', applicationType: 'type-a', pageId: 'list' } },
      { id: 'b-list', name: 'B 列表', kind: 'reference', source: { pack: 'fake-pack', applicationType: 'type-b', pageId: 'list' } }
    ]
  }
  const result = generator.generatePack({
    spec,
    builtin: fake.pack,
    builtinRoot: fake.root,
    targetDir: target('asset-collision'),
    packId: 'asset-collision'
  })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some(item => item.code === 'asset-collision'), JSON.stringify(result.errors))
  assert.equal(fs.existsSync(target('asset-collision')), false)
})

test('蓝图 import 缺失 → asset-import-missing warning（其余资产照常复制）', () => {
  const fake = fakeBuiltin()
  fs.writeFileSync(
    path.join(fake.root, 'application-types/type-a/pages/AList.vue'),
    `<template><div><img src="../assets/logo.svg" /></div></template>\n<script setup lang="ts">\nimport icon from '../assets/missing.svg'\n</script>\n`,
    'utf8'
  )
  const spec = {
    schemaVersion: 1,
    id: 'asset-missing',
    name: '资产缺失',
    baseApplicationType: 'type-a',
    style: 'demo',
    pages: [
      { id: 'a-list', name: 'A 列表', kind: 'reference', source: { pack: 'fake-pack', applicationType: 'type-a', pageId: 'list' } }
    ]
  }
  const result = generator.generatePack({
    spec,
    builtin: fake.pack,
    builtinRoot: fake.root,
    targetDir: target('asset-missing'),
    packId: 'asset-missing'
  })
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.ok((result.warnings ?? []).some(item => item.code === 'asset-import-missing'))
  assert.ok(fs.existsSync(path.join(target('asset-missing'), 'application-types/asset-missing/assets/logo.svg')))
  const pack = JSON.parse(fs.readFileSync(path.join(target('asset-missing'), 'pack.json'), 'utf8')) as Record<string, unknown>
  const assets = (pack.applicationTypes as Array<Record<string, unknown>>)[0].assets as string[]
  assert.deepEqual(assets, ['application-types/asset-missing/assets/logo.svg'])
})
