/**
 * 工作室资产（P7-7b-1）：AGENTS/opencode.json/workshop.json、受管 skill/command/scripts、
 * catalog/builtin 只读镜像（36 文件）、catalog 可读、幂等与刷新。
 * 临时目录；不启动 opencode、不调模型。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-workshop-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_AUTO_START = 'false'

const PACK_ID = 'afcenter-app-templates-v1'

let workshop: typeof import('./workshop')
let studioRoot = ''
let db: typeof import('../db').db

before(async () => {
  // 先导入 db（config 初始化）；工作室资产本身不读写 app 表
  db = (await import('../db')).db
  workshop = await import('./workshop')
  const paths = await import('./paths')
  studioRoot = paths.studioRoot()
})

after(() => {
  db?.close()
  fs.rmSync(root, { recursive: true, force: true })
})

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
}

test('ensureStudioAssets：AGENTS/opencode.json/workshop.json + skill/command/scripts 齐全', async () => {
  const result = await workshop.ensureStudioAssets()
  assert.equal(result.changed, true)
  assert.equal(result.mirror.pack, PACK_ID)
  assert.equal(result.mirror.files, 36)
  assert.equal(result.mirror.rebuilt, true)
  assert.deepEqual(result.warnings, [])

  for (const relative of [
    'AGENTS.md',
    'opencode.json',
    'workshop.json',
    '.opencode/skills/adw-design-template-authoring/SKILL.md',
    '.opencode/skills/adw-design-template-authoring/references/spec.schema.json',
    '.opencode/skills/adw-design-template-authoring/references/contract-recipes.md',
    '.opencode/commands/generate-design-template.md',
    '.opencode/scripts/generate.cjs',
    '.opencode/scripts/validate.cjs',
    '.opencode/scripts/lib/spec.cjs',
    '.opencode/scripts/lib/css.cjs',
    '.opencode/scripts/lib/generator.cjs',
    'catalog/index.json',
    'catalog/pages.json',
    'catalog/components.json',
    'catalog/styles.json',
    'catalog/recipes.json',
    'catalog/component-controls.json'
  ]) {
    assert.equal(fs.existsSync(path.join(studioRoot, relative)), true, relative)
  }
  // skill 目录不重复复制 scripts（脚本统一在 .opencode/scripts）
  assert.equal(fs.existsSync(path.join(studioRoot, '.opencode/skills/adw-design-template-authoring/scripts')), false)

  const agents = fs.readFileSync(path.join(studioRoot, 'AGENTS.md'), 'utf8')
  assert.match(agents, /设计模板编写工作室/)
  assert.match(agents, /catalog\/index\.json/)
  assert.match(agents, /drafts\/<packId>\/spec\.json/)
  assert.match(agents, /不要拼仓库路径/)
  assert.match(agents, /不发布/)
  assert.match(agents, /中文/)

  const skill = fs.readFileSync(path.join(studioRoot, '.opencode/skills/adw-design-template-authoring/SKILL.md'), 'utf8')
  assert.match(skill, /^---\nname: adw-design-template-authoring\n/m)
  assert.match(skill, /reference.*contract/s)
  assert.match(skill, /sampleEntity/)
  assert.match(skill, /generate\.cjs --draft <packId>/)

  const command = fs.readFileSync(path.join(studioRoot, '.opencode/commands/generate-design-template.md'), 'utf8')
  assert.match(command, /^---\ndescription: 按当前草稿/m)
  assert.match(command, /不要发布/)
})

test('opencode.json：V2 permissions 形状/顺序（edit deny + spec/notes allow + shell 白名单 + external deny）', () => {
  const config = readJson(path.join(studioRoot, 'opencode.json'))
  assert.equal(config.$schema, 'https://opencode.ai/config.json')
  const permissions = config.permissions as Array<{ action: string; resource: string; effect: string }>
  assert.deepEqual(permissions, [
    { action: 'edit', resource: '*', effect: 'deny' },
    { action: 'edit', resource: '*drafts/*/spec.json', effect: 'allow' },
    { action: 'edit', resource: '*drafts/*/notes.md', effect: 'allow' },
    { action: 'read', resource: '*', effect: 'allow' },
    { action: 'shell', resource: '*', effect: 'deny' },
    { action: 'shell', resource: 'node .opencode/scripts/generate.cjs *', effect: 'allow' },
    { action: 'shell', resource: 'node .opencode/scripts/validate.cjs *', effect: 'allow' },
    { action: 'external_directory', resource: '*', effect: 'deny' }
  ])
})

test('workshop.json：绝对路径 + workbenchPort；不含凭据', () => {
  const text = fs.readFileSync(path.join(studioRoot, 'workshop.json'), 'utf8')
  const config = JSON.parse(text) as Record<string, unknown>
  assert.deepEqual(Object.keys(config).sort(), ['builtinRoot', 'customRoot', 'draftRoot', 'workbenchPort'].sort())
  for (const key of ['builtinRoot', 'customRoot', 'draftRoot']) {
    const value = String(config[key])
    assert.equal(path.isAbsolute(value), true, `${key} 必须是绝对路径`)
  }
  assert.equal(path.basename(String(config.builtinRoot)), 'design-system')
  assert.equal(String(config.draftRoot).endsWith(`${path.sep}drafts`), true)
  assert.equal(typeof config.workbenchPort, 'number')
  assert.equal(/password|secret|token|apikey|api[_-]?key/i.test(text), false)
})

test('catalog/builtin 镜像：36 文件；catalog readPath/structureReadPath 可读', async () => {
  const catalog = await import('./catalog')
  const data = catalog.readCatalog()
  assert.equal(data.index.counts.pages, 25)
  assert.equal(data.pages.length, 25)
  assert.equal(data.pages.every(page => page.kind === 'blueprint'), true)

  const mirrorRoot = path.join(studioRoot, 'catalog', 'builtin', PACK_ID)
  const files: string[] = []
  const walk = (dir: string, prefix = ''): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(path.join(dir, entry.name), relative)
      else files.push(relative)
    }
  }
  walk(mirrorRoot)
  files.sort()
  assert.equal(files.length, 36)
  assert.ok(files.includes('pack.json'))
  assert.ok(files.some(file => file.endsWith('structure.css')))
  assert.ok(files.some(file => file.endsWith('.vue')))
  assert.ok(files.some(file => file.startsWith('styles/')))

  for (const page of data.pages) {
    assert.equal(fs.existsSync(path.join(studioRoot, path.posix.join(page.readPath))), true, page.readPath)
    assert.equal(
      fs.existsSync(path.join(studioRoot, path.posix.join(page.structureReadPath))),
      true,
      page.structureReadPath
    )
  }
})

test('幂等：第二次运行 changed=false，文件内容不变', async () => {
  const before = fs.readFileSync(path.join(studioRoot, 'AGENTS.md'), 'utf8')
  const result = await workshop.ensureStudioAssets()
  assert.equal(result.changed, false)
  assert.equal(result.mirror.rebuilt, false)
  assert.deepEqual(result.warnings, [])
  assert.equal(fs.readFileSync(path.join(studioRoot, 'AGENTS.md'), 'utf8'), before)
})

test('镜像失效（删文件）→ 自动重建并恢复；catalog 仍可读', async () => {
  const target = path.join(studioRoot, 'catalog', 'builtin', PACK_ID, 'pack.json')
  fs.rmSync(target)
  const result = await workshop.ensureStudioAssets()
  assert.equal(result.changed, true)
  assert.equal(result.mirror.rebuilt, true)
  assert.equal(fs.existsSync(target), true)
  const catalog = await import('./catalog')
  assert.equal(catalog.readCatalog().index.counts.pages, 25)
})
