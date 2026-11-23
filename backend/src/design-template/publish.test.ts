/**
 * P7-7a 草稿 / 生成 / 发布 / 删除（后端模块）
 *
 * - 首次发布 1.0.0（revision 1），重复发布 1.0.1；
 * - spec 变化未重新生成 → 409 spec-changed；
 * - id 冲突 / 内置 id / 引用应用删除保护；
 * - 发布失败保留旧 pack；发布后 clearDesignPackCache 可重新加载；
 * - 由已发布 pack 反写草稿 spec。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after, before } from 'node:test'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-p77a-publish-'))
process.env.RG_DATA_DIR = path.join(root, 'data')
process.env.RG_PROJECTS_DIR = path.join(root, 'projects')
process.env.OPENCODE_AUTO_START = 'false'

type DraftModule = typeof import('./draft')
type GeneratorModule = typeof import('./generator')
type PublishModule = typeof import('./publish')
type PathsModule = typeof import('./paths')
type PackModule = typeof import('../design/pack')
type DbModule = typeof import('../db')

let draftModule: DraftModule
let generatorModule: GeneratorModule
let publishModule: PublishModule
let paths: PathsModule
let packModule: PackModule
let db: DbModule['db']

const PACK_ID = 'supplier-hub'
const BUILTIN_ID = 'afcenter-app-templates-v1'

function validSpec(id = PACK_ID): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id,
    name: '供应商管理模板',
    description: '供应商台账 + 表单',
    baseApplicationType: 'enterprise-application-platform',
    style: 'data-cyan',
    pages: [
      {
        id: 'supplier-list',
        name: '供应商列表',
        kind: 'reference',
        source: { pack: BUILTIN_ID, applicationType: 'operations-management', pageId: 'list' }
      },
      {
        id: 'supplier-form',
        name: '供应商表单',
        kind: 'contract',
        type: 'form',
        recipe: 'dialog-form',
        contract: { form: { presentation: 'dialog', columns: 2, groups: [{ title: '基本信息', fields: ['name'] }] } },
        sampleEntity: { id: 'supplier', name: '供应商', fields: [{ name: 'name', label: '名称', type: 'string' }] }
      }
    ]
  }
}

function writeSpec(id: string, spec: unknown): void {
  fs.writeFileSync(paths.draftSpecFile(id), `${JSON.stringify(spec, null, 2)}\n`, 'utf8')
}

function insertApp(id: string, packId?: string): void {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO apps (id, name, description, dir, backend_port, status, requirement_template_id, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, 'requirements', NULL, ?, ?)`
  ).run(id, `应用 ${id}`, id, 18080, now, now)
  if (packId) {
    db.prepare('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      `app.${id}.design.pack`,
      JSON.stringify(packId),
      now
    )
  }
}

function publishedDir(id = PACK_ID): string {
  return path.join(String(process.env.RG_DATA_DIR), 'design-system', id)
}

function stagingLeftovers(): string[] {
  const rootDir = path.join(String(process.env.RG_DATA_DIR), 'design-system')
  return fs.existsSync(rootDir) ? fs.readdirSync(rootDir).filter(name => name.startsWith('.')) : []
}

before(async () => {
  db = (await import('../db')).db
  draftModule = await import('./draft')
  generatorModule = await import('./generator')
  publishModule = await import('./publish')
  paths = await import('./paths')
  packModule = await import('../design/pack')
})

after(() => {
  db.close()
  fs.rmSync(root, { recursive: true, force: true })
})

test('创建草稿：id = pack id；重复/保留/内置 id 409/400；starter spec 为空 pages', () => {
  const created = draftModule.createDraft({ name: '供应商管理模板', id: PACK_ID, style: 'data-cyan' })
  assert.equal(created.id, PACK_ID)
  assert.equal(created.status, 'draft')
  assert.equal(created.style, 'data-cyan')
  assert.equal(created.hasSpec, true)
  assert.equal(created.hasPack, false)
  const spec = JSON.parse(fs.readFileSync(paths.draftSpecFile(PACK_ID), 'utf8')) as Record<string, unknown>
  assert.deepEqual(spec.pages, [])
  assert.equal(spec.id, PACK_ID)

  assert.throws(
    () => draftModule.createDraft({ name: '重复', id: PACK_ID }),
    (error: Error & { status?: number; code?: string }) => error.status === 409 && error.code === 'pack-id-exists'
  )
  assert.throws(
    () => draftModule.createDraft({ name: '保留', id: '_workshop' }),
    (error: Error & { status?: number }) => error.status === 400
  )
  assert.throws(
    () => draftModule.createDraft({ name: '内置', id: BUILTIN_ID }),
    (error: Error & { status?: number }) => error.status === 400
  )
  assert.throws(
    () => draftModule.createDraft({ name: '坏风格', style: 'nope' }),
    (error: Error & { status?: number }) => error.status === 400
  )

  const unnamed = draftModule.createDraft({ name: 'Supplier Hub' })
  assert.match(unnamed.id, /^supplier-hub-[0-9a-f]{4}$/)
  const drafts = draftModule.listDrafts()
  assert.equal(drafts.length, 2)
})

test('生成：非法 spec 400 不落 pack；合法 spec 生成 pack + generation.json', () => {
  const invalid = generatorModule.generateDraft(PACK_ID)
  assert.equal(invalid.ok, false)
  assert.equal(invalid.status, 400)
  assert.ok(invalid.errors.some(issue => issue.code === 'page-count'))
  assert.equal(fs.existsSync(paths.draftPackDir(PACK_ID)), false)

  writeSpec(PACK_ID, validSpec())
  const result = generatorModule.generateDraft(PACK_ID)
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.equal(result.status, 200)
  assert.equal(result.pack?.pageCount, 2)
  assert.equal(fs.existsSync(path.join(paths.draftPackDir(PACK_ID), 'pack.json')), true)
  const generation = draftModule.getDraftDetail(PACK_ID).generation!
  assert.ok(generation.specHash.startsWith('sha256:'))
  assert.equal(generation.pageCount, 2)
  assert.deepEqual(generation.sources, ['operations-management', 'enterprise-application-platform'])
})

test('发布：首次 1.0.0（revision 1）；重复生成+发布 1.0.1；缓存清理后可重新加载', () => {
  const first = publishModule.publishDraft(PACK_ID)
  assert.deepEqual(first.pack, { id: PACK_ID, version: '1.0.0', revision: 1 })
  assert.equal(fs.existsSync(path.join(publishedDir(), 'pack.json')), true)
  const pack1 = packModule.getPack(PACK_ID)
  assert.equal(pack1.version, '1.0.0')
  assert.equal(pack1.origin?.revision, 1)
  assert.ok(pack1.origin?.publishedAt)
  assert.equal(pack1.origin?.specHash, draftModule.getDraftDetail(PACK_ID).generation?.specHash)
  const summary = packModule.listPacks().find(item => item.id === PACK_ID)!
  assert.equal(summary.templateKind, 'custom')
  assert.equal(summary.origin?.publishedAt, pack1.origin?.publishedAt)

  const draft = draftModule.getDraftDetail(PACK_ID).draft
  assert.equal(draft.status, 'published')
  assert.equal(draft.publishedVersion, '1.0.0')
  assert.ok(draft.lastSpecHash)

  assert.equal(generatorModule.generateDraft(PACK_ID).ok, true)
  const second = publishModule.publishDraft(PACK_ID)
  assert.deepEqual(second.pack, { id: PACK_ID, version: '1.0.1', revision: 2 })
  assert.equal(packModule.getPack(PACK_ID).version, '1.0.1')
  assert.deepEqual(stagingLeftovers(), [], '发布后不应残留 .publish.tmp-*')
})

test('发布：spec 变化但未重新生成 → 409 spec-changed（旧 pack 不变）', () => {
  const spec = validSpec()
  spec.description = '改过描述但没有重新生成'
  writeSpec(PACK_ID, spec)
  assert.throws(
    () => publishModule.publishDraft(PACK_ID),
    (error: Error & { status?: number; code?: string }) => error.status === 409 && error.code === 'spec-changed'
  )
  assert.equal(packModule.getPack(PACK_ID).version, '1.0.1')
})

test('发布：权威校验失败（暂存 pack 被破坏）→ 400，旧 pack 保留', () => {
  // 先恢复生成，保证 specHash 一致
  writeSpec(PACK_ID, validSpec())
  assert.equal(generatorModule.generateDraft(PACK_ID).ok, true)
  // 破坏草稿 pack（recipe 不在 pageRecipes）
  const packFile = path.join(paths.draftPackDir(PACK_ID), 'pack.json')
  const pack = JSON.parse(fs.readFileSync(packFile, 'utf8')) as Record<string, unknown>
  const type = (pack.applicationTypes as Array<Record<string, unknown>>)[0]
  ;(type.pages as Array<Record<string, unknown>>)[0].recipe = 'matrix'
  fs.writeFileSync(packFile, JSON.stringify(pack, null, 2), 'utf8')

  assert.throws(
    () => publishModule.publishDraft(PACK_ID),
    (error: Error & { status?: number; code?: string }) => error.status === 400 && error.code === 'pack-invalid'
  )
  assert.equal(packModule.getPack(PACK_ID).version, '1.0.1', '失败不能破坏已发布 pack')
  assert.deepEqual(stagingLeftovers(), [])
})

test('删除保护：内置 403；引用应用 409 + 应用列表；解除引用后删除并移除草稿', () => {
  assert.throws(
    () => publishModule.publishDraft(BUILTIN_ID),
    (error: Error & { status?: number; code?: string }) => error.status === 403 && error.code === 'builtin-readonly'
  )
  assert.throws(
    () => publishModule.deleteCustomPack(BUILTIN_ID),
    (error: Error & { status?: number; code?: string }) => error.status === 403 && error.code === 'builtin-readonly'
  )
  insertApp('app-ref', PACK_ID)
  assert.throws(
    () => publishModule.deleteCustomPack(PACK_ID),
    (error: Error & { status?: number; code?: string; details?: { apps: Array<{ id: string; name: string }> } }) =>
      error.status === 409 &&
      error.code === 'pack-referenced' &&
      error.details?.apps.length === 1 &&
      error.details.apps[0].id === 'app-ref'
  )
  assert.equal(packModule.listPacks().some(item => item.id === PACK_ID), true)

  db.prepare('DELETE FROM app_settings WHERE key = ?').run('app.app-ref.design.pack')
  const removed = publishModule.deleteCustomPack(PACK_ID)
  assert.deepEqual(removed, { ok: true, removedDraft: true })
  assert.equal(fs.existsSync(publishedDir()), false)
  assert.equal(fs.existsSync(paths.draftDir(PACK_ID)), false)
  assert.equal(packModule.listPacks().some(item => item.id === PACK_ID), false)
})

test('由已发布 pack 反写草稿；未发布草稿删除 packKept=false，已发布删除 packKept=true', () => {
  // 重建并发布一个模板
  draftModule.createDraft({ name: '供应商管理模板', id: PACK_ID, style: 'data-cyan' })
  writeSpec(PACK_ID, validSpec())
  assert.equal(generatorModule.generateDraft(PACK_ID).ok, true)
  publishModule.publishDraft(PACK_ID)

  // 已发布：丢草稿保留 pack
  const kept = draftModule.deleteDraft(PACK_ID)
  assert.deepEqual(kept, { ok: true, packKept: true })
  assert.equal(fs.existsSync(publishedDir()), true)

  // 反写 spec：kind/source/contract/sampleEntity/base/style
  const draft = draftModule.ensureDraftFromPublished(PACK_ID)
  assert.equal(draft.status, 'published')
  assert.equal(draft.publishedVersion, '1.0.0')
  const spec = JSON.parse(fs.readFileSync(paths.draftSpecFile(PACK_ID), 'utf8')) as Record<string, unknown>
  assert.equal(spec.baseApplicationType, 'enterprise-application-platform')
  assert.equal(spec.style, 'data-cyan')
  const pages = spec.pages as Array<Record<string, unknown>>
  assert.equal(pages[0].kind, 'reference')
  assert.deepEqual(pages[0].source, {
    pack: BUILTIN_ID,
    applicationType: 'operations-management',
    pageId: 'list'
  })
  assert.equal(pages[1].kind, 'contract')
  assert.equal((pages[1].contract as Record<string, unknown>).form !== undefined, true)
  assert.equal((pages[1].sampleEntity as Record<string, unknown>).id, 'supplier')

  // 反写后的草稿可直接再次生成+发布（版本继续 +1）
  assert.equal(generatorModule.generateDraft(PACK_ID).ok, true)
  const republished = publishModule.publishDraft(PACK_ID)
  assert.equal(republished.pack.version, '1.0.1')

  // 未发布草稿：删除 packKept=false
  const detached = draftModule.createDraft({ name: '未发布模板', id: 'unpublished-demo' })
  assert.equal(detached.id, 'unpublished-demo')
  assert.deepEqual(draftModule.deleteDraft('unpublished-demo'), { ok: true, packKept: false })
})
