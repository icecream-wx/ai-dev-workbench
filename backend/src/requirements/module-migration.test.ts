/**
 * 需求模块化迁移（M2）单测：旧结构 fixture → 迁移后逐行一致 + 幂等 + 索引 + bundle
 *
 * 不 import `../db`（避免在测试里启动工作台 DDL 覆盖旧结构）：直接手写旧 DDL 建临时库，
 * 用真实 better-sqlite3 连接调用 `migrateRequirementModules`。
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import Database from 'better-sqlite3'
import {
  backupBeforeMigration,
  bundleHashOfModules,
  migrateRequirementModules,
  moduleMigrationStatus,
  sha256Hex
} from './module-migration'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-module-migration-'))
const dbPath = path.join(root, 'old.db')

const OLD_DDL = `
  CREATE TABLE apps (
    id                        TEXT PRIMARY KEY,
    name                      TEXT NOT NULL,
    description               TEXT,
    dir                       TEXT NOT NULL,
    backend_port              INTEGER NOT NULL DEFAULT 8081,
    status                    TEXT NOT NULL DEFAULT 'requirements',
    requirements_confirmed_at TEXT,
    design_confirmed_at       TEXT,
    development_started_at    TEXT,
    completed_at              TEXT,
    handoff_hash              TEXT,
    created_at                TEXT NOT NULL,
    updated_at                TEXT NOT NULL
  );

  CREATE TABLE app_requirement_docs (
    app_id       TEXT PRIMARY KEY,
    template_id  TEXT NOT NULL,
    title        TEXT NOT NULL,
    content_md   TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'draft',
    version      INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    confirmed_at TEXT
  );

  CREATE TABLE app_requirement_doc_sections (
    app_id      TEXT NOT NULL,
    section_key TEXT NOT NULL,
    title       TEXT NOT NULL,
    level       INTEGER NOT NULL DEFAULT 2,
    kind        TEXT NOT NULL,
    markdown    TEXT NOT NULL,
    data_json   TEXT,
    required    INTEGER NOT NULL DEFAULT 0,
    position    INTEGER NOT NULL,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (app_id, section_key)
  );

  CREATE INDEX idx_requirement_doc_sections_app ON app_requirement_doc_sections(app_id, position);

  CREATE TABLE app_requirement_doc_versions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id        TEXT NOT NULL,
    version       INTEGER NOT NULL,
    template_id   TEXT NOT NULL,
    content_md    TEXT NOT NULL,
    sections_json TEXT NOT NULL,
    source        TEXT NOT NULL,
    change_set_id TEXT,
    created_at    TEXT NOT NULL
  );

  CREATE UNIQUE INDEX idx_requirement_doc_versions_app_version
    ON app_requirement_doc_versions(app_id, version);

  CREATE TABLE app_design_projects (
    app_id                TEXT PRIMARY KEY,
    prototype_template_id TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'draft',
    version               INTEGER NOT NULL DEFAULT 1,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
  );
`

const NOW = '2026-11-13T02:00:00.000Z'
const LEGACY_SECTIONS = [
  {
    section_key: 'problem',
    title: '问题与机会',
    level: 2,
    kind: 'markdown',
    markdown: '旧库的问题章节',
    data_json: null,
    required: 1,
    position: 0,
    updated_at: NOW
  },
  {
    section_key: 'epics',
    title: 'Epics & User Stories',
    level: 2,
    kind: 'epics',
    markdown: '### EPIC-001 季度报表',
    data_json: JSON.stringify({ scenes: [], epics: [{ id: 'EPIC-001', title: '季度报表' }], stories: [] }),
    required: 1,
    position: 1,
    updated_at: NOW
  },
  {
    section_key: 'custom-note',
    title: '补充说明',
    level: 2,
    kind: 'markdown',
    markdown: '自定义章节',
    data_json: null,
    required: 0,
    position: 2,
    updated_at: NOW
  }
]

let database: Database.Database

function seedOldDatabase(): void {
  database = new Database(dbPath)
  database.pragma('journal_mode = WAL')
  database.exec(OLD_DDL)
  // 旧库可能还没有 #7 的模板列；这里显式补上以模拟 app1 现状
  database.exec('ALTER TABLE apps ADD COLUMN requirement_template_id TEXT')
  const app = database.prepare(`
    INSERT INTO apps (id, name, description, dir, backend_port, status, requirements_confirmed_at, created_at, updated_at,
      requirement_template_id)
    VALUES (?, ?, NULL, ?, 8081, ?, ?, ?, ?, NULL)
  `)
  app.run('app-a', '订单管理', 'app-a', 'development', NOW, NOW, NOW)
  app.run('app-c', '草稿应用', 'app-c', 'requirements', null, NOW, NOW)

  const doc = database.prepare(`
    INSERT INTO app_requirement_docs (app_id, template_id, title, content_md, status, version, created_at, updated_at, confirmed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  doc.run('app-a', 'builtin-prd', '订单管理 需求文档', '# 订单管理 需求文档\n\n## 问题与机会\n\n旧库的问题章节\n', 'confirmed', 24, NOW, NOW, NOW)
  doc.run('app-c', 'builtin-prd', '草稿应用 需求文档', '# 草稿应用 需求文档\n', 'draft', 1, NOW, NOW, null)

  const section = database.prepare(`
    INSERT INTO app_requirement_doc_sections
      (app_id, section_key, title, level, kind, markdown, data_json, required, position, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const item of LEGACY_SECTIONS) {
    section.run(
      'app-a',
      item.section_key,
      item.title,
      item.level,
      item.kind,
      item.markdown,
      item.data_json,
      item.required,
      item.position,
      item.updated_at
    )
  }

  const version = database.prepare(`
    INSERT INTO app_requirement_doc_versions
      (app_id, version, template_id, content_md, sections_json, source, change_set_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  version.run('app-a', 22, 'builtin-prd', '# v22', '[]', 'manual', null, NOW)
  version.run('app-a', 23, 'builtin-prd', '# v23', '[]', 'rollback', 'cs-1', NOW)
  version.run('app-a', 24, 'builtin-prd', '# v24', '[]', 'confirm', 'cs-2', NOW)
  version.run('app-c', 1, 'builtin-prd', '# v1', '[]', 'template-change', null, NOW)

  database
    .prepare('INSERT INTO app_design_projects (app_id, prototype_template_id, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('app-a', 'builtin-prototype-enterprise', 'confirmed', 4, NOW, NOW)
}

function rowsOf(table: string): Array<Record<string, unknown>> {
  return database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() as Array<Record<string, unknown>>
}

function indexNames(table: string): string[] {
  return (database.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string }>).map(row => row.name)
}

const before = {
  docs: [] as Array<Record<string, unknown>>,
  sections: [] as Array<Record<string, unknown>>,
  versions: [] as Array<Record<string, unknown>>,
  design: [] as Array<Record<string, unknown>>
}

test('旧库 fixture：模块化迁移保留 docs/sections/versions 全部内容与版本号', () => {
  seedOldDatabase()
  before.docs = rowsOf('app_requirement_docs')
  before.sections = rowsOf('app_requirement_doc_sections')
  before.versions = rowsOf('app_requirement_doc_versions')
  before.design = rowsOf('app_design_projects')
  assert.equal(before.docs.length, 2)
  assert.equal(before.sections.length, 3)
  assert.equal(before.versions.length, 4)
  assert.equal(before.design.length, 1)

  const status = moduleMigrationStatus(database)
  assert.equal(status.migrated, false)
  assert.equal(status.tables.modules, false)
  assert.equal(status.tables.bundles, false)
  assert.equal(status.counts.docs, 2)
  // 迁移前：旧索引名存在于旧表（尚未改名）；legacy 表还不存在
  assert.deepEqual(status.legacyIndexes, [
    'idx_requirement_doc_sections_app',
    'idx_requirement_doc_versions_app_version'
  ])
  assert.equal(status.tables.legacyDocs, false)

  const result = migrateRequirementModules(database)
  assert.equal(result.alreadyMigrated, false)
  assert.equal(result.appsMigrated, 2)
  assert.equal(result.bundleVersion, 1)
  assert.equal(result.migrated, true)
  assert.equal(result.bundleHashes.length, 2)
})

test('迁移后逐行一致：docs/sections/versions（显式保留 id/version/source/change_set_id/confirmed_at/data_json）', () => {
  const docs = rowsOf('app_requirement_docs')
  const sections = rowsOf('app_requirement_doc_sections')
  const versions = rowsOf('app_requirement_doc_versions')
  assert.equal(docs.length, before.docs.length)
  assert.equal(sections.length, before.sections.length)
  assert.equal(versions.length, before.versions.length)

  for (const old of before.docs) {
    const next = docs.find(row => row.app_id === old.app_id)
    assert.ok(next, `文档缺失：${String(old.app_id)}`)
    for (const key of ['template_id', 'title', 'content_md', 'status', 'version', 'created_at', 'updated_at', 'confirmed_at']) {
      assert.deepEqual(next?.[key], old[key], `docs.${key} 不一致`)
    }
    assert.ok(typeof next?.module_id === 'string' && String(next.module_id).length > 0, 'docs.module_id 缺失')
  }

  for (const old of before.sections) {
    const next = sections.find(row => row.app_id === old.app_id && row.section_key === old.section_key)
    assert.ok(next, `章节缺失：${String(old.section_key)}`)
    for (const key of ['title', 'level', 'kind', 'markdown', 'data_json', 'required', 'position', 'updated_at']) {
      assert.deepEqual(next?.[key], old[key], `sections.${key} 不一致`)
    }
  }

  for (const old of before.versions) {
    const next = versions.find(row => row.id === old.id)
    assert.ok(next, `版本缺失：id=${String(old.id)}`)
    for (const key of ['app_id', 'version', 'template_id', 'content_md', 'sections_json', 'source', 'change_set_id', 'created_at']) {
      assert.deepEqual(next?.[key], old[key], `versions.${key} 不一致`)
    }
    assert.ok(typeof next?.module_id === 'string' && String(next.module_id).length > 0, 'versions.module_id 缺失')
  }
})

test('旧表保留为 *_legacy；设计表未被改动；索引换名且新旧互不冲突', () => {
  const status = moduleMigrationStatus(database)
  assert.equal(status.tables.legacyDocs, true)
  assert.equal(status.tables.legacySections, true)
  assert.equal(status.tables.legacyVersions, true)
  assert.equal(status.legacyCounts.docs, 2)
  assert.equal(status.legacyCounts.sections, 3)
  assert.equal(status.legacyCounts.versions, 4)

  assert.deepEqual(rowsOf('app_design_projects'), before.design)

  // 新表使用新索引名
  assert.ok(indexNames('app_requirement_doc_sections').includes('idx_req_sections_app_module'))
  assert.ok(indexNames('app_requirement_doc_versions').includes('idx_req_versions_app_module_version'))
  assert.ok(indexNames('app_modules').includes('idx_modules_app'))
  assert.ok(indexNames('app_requirement_bundles').includes('idx_req_bundles_app_version'))
  assert.equal(indexNames('app_requirement_doc_versions').includes('idx_requirement_doc_versions_app_version'), false)
  // 旧索引仍留在 legacy 表上（保留回滚材料，不复用名字）
  assert.ok(indexNames('app_requirement_doc_sections_legacy').includes('idx_requirement_doc_sections_app'))
  assert.ok(indexNames('app_requirement_doc_versions_legacy').includes('idx_requirement_doc_versions_app_version'))
  assert.ok(status.legacyIndexes.includes('idx_requirement_doc_sections_app'))
  assert.ok(status.legacyIndexes.includes('idx_requirement_doc_versions_app_version'))
})

test('模块：每个有文档的应用一个默认模块 MOD-001（title=应用名）；无文档应用不建模块', () => {
  const modules = database.prepare('SELECT * FROM app_modules ORDER BY app_id').all() as Array<Record<string, unknown>>
  assert.equal(modules.length, 2)
  const appA = modules.find(row => row.app_id === 'app-a')
  const appC = modules.find(row => row.app_id === 'app-c')
  assert.equal(appA?.module_key, 'MOD-001')
  assert.equal(appA?.title, '订单管理')
  assert.equal(appA?.required, 1)
  assert.equal(appA?.position, 0)
  assert.equal(appC?.module_key, 'MOD-001')
  assert.equal(appC?.title, '草稿应用')
  assert.notEqual(appA?.id, appC?.id)
  // 应用间互不影响：文档分别绑定自己的默认模块
  const docs = database.prepare('SELECT app_id, module_id FROM app_requirement_docs').all() as Array<{
    app_id: string
    module_id: string
  }>
  assert.equal(docs.find(row => row.app_id === 'app-a')?.module_id, appA?.id)
  assert.equal(docs.find(row => row.app_id === 'app-c')?.module_id, appC?.id)
})

test('bundle v1：modules_json 字段/排序/hash 与固定算法一致（docHash=sha256(content_md)）', () => {
  const bundles = database
    .prepare('SELECT * FROM app_requirement_bundles ORDER BY app_id')
    .all() as Array<{ app_id: string; version: number; modules_json: string; bundle_hash: string; change_set_id: string | null }>
  assert.equal(bundles.length, 2)
  for (const bundle of bundles) {
    assert.equal(bundle.version, 1)
    assert.equal(bundle.change_set_id, null)
    const entries = JSON.parse(bundle.modules_json) as Array<{
      moduleId: string
      moduleKey: string
      title: string
      docVersion: number
      docHash: string
      confirmed: boolean
    }>
    assert.equal(entries.length, 1)
    const entry = entries[0]
    assert.equal(entry.moduleKey, 'MOD-001')
    const doc = database.prepare('SELECT content_md, version, status FROM app_requirement_docs WHERE app_id = ?').get(bundle.app_id) as {
      content_md: string
      version: number
      status: string
    }
    assert.equal(entry.docHash, crypto.createHash('sha256').update(doc.content_md).digest('hex'))
    assert.equal(entry.docVersion, doc.version)
    assert.equal(entry.confirmed, doc.status === 'confirmed')
    const expected = bundleHashOfModules(entries)
    assert.equal(bundle.bundle_hash, expected)
    assert.equal(expected, sha256Hex(JSON.stringify([
      { moduleId: entry.moduleId, moduleKey: entry.moduleKey, docVersion: entry.docVersion, docHash: entry.docHash, confirmed: entry.confirmed }
    ])))
  }
  const appA = bundles.find(bundle => bundle.app_id === 'app-a')
  assert.equal(JSON.parse(appA?.modules_json ?? '[]')[0].confirmed, true)
  const appC = bundles.find(bundle => bundle.app_id === 'app-c')
  assert.equal(JSON.parse(appC?.modules_json ?? '[]')[0].confirmed, false)
})

test('哈希稳定：同内容重复计算相同；内容变化 hash 变化', () => {
  const entry = { moduleId: 'm1', moduleKey: 'MOD-001', docVersion: 1, docHash: sha256Hex('内容 A'), confirmed: false }
  assert.equal(bundleHashOfModules([entry]), bundleHashOfModules([{ ...entry }]))
  const changed = bundleHashOfModules([{ ...entry, docHash: sha256Hex('内容 B') }])
  assert.notEqual(changed, bundleHashOfModules([entry]))
  const confirmedChanged = bundleHashOfModules([{ ...entry, confirmed: true }])
  assert.notEqual(confirmedChanged, bundleHashOfModules([entry]))
})

test('幂等：二次迁移直接返回，不重建表/不重复建模块/bundle；sqlite_sequence 继续推进', () => {
  const countsBefore = {
    modules: database.prepare('SELECT COUNT(*) AS c FROM app_modules').get() as { c: number },
    bundles: database.prepare('SELECT COUNT(*) AS c FROM app_requirement_bundles').get() as { c: number },
    docs: database.prepare('SELECT COUNT(*) AS c FROM app_requirement_docs').get() as { c: number },
    versions: database.prepare('SELECT COUNT(*) AS c FROM app_requirement_doc_versions').get() as { c: number }
  }
  const result = migrateRequirementModules(database)
  assert.equal(result.alreadyMigrated, true)
  assert.equal(result.appsMigrated, 0)
  assert.equal((database.prepare('SELECT COUNT(*) AS c FROM app_modules').get() as { c: number }).c, countsBefore.modules.c)
  assert.equal(
    (database.prepare('SELECT COUNT(*) AS c FROM app_requirement_bundles').get() as { c: number }).c,
    countsBefore.bundles.c
  )
  assert.equal((database.prepare('SELECT COUNT(*) AS c FROM app_requirement_docs').get() as { c: number }).c, countsBefore.docs.c)
  assert.equal(
    (database.prepare('SELECT COUNT(*) AS c FROM app_requirement_doc_versions').get() as { c: number }).c,
    countsBefore.versions.c
  )

  // 迁移后新增版本仍走 AUTOINCREMENT（max(id) 之后，不撞旧 id）
  const maxId = (database.prepare('SELECT MAX(id) AS id FROM app_requirement_doc_versions').get() as { id: number }).id
  const moduleId = (database.prepare("SELECT id FROM app_modules WHERE app_id = 'app-a'").get() as { id: string }).id
  const inserted = database
    .prepare(`
      INSERT INTO app_requirement_doc_versions
        (app_id, module_id, version, template_id, content_md, sections_json, source, change_set_id, created_at)
      VALUES ('app-a', ?, 25, 'builtin-prd', '# v25', '[]', 'manual', NULL, ?)
    `)
    .run(moduleId, NOW)
  assert.equal(Number(inserted.lastInsertRowid), maxId + 1)
})

// ---------------------------------------------------------------- MF1 / MF4

interface LegacyFixtureOptions {
  /** 旧库是否已有 sections.data_json（H1 前的老库没有） */
  dataJson?: boolean
  /** 旧库是否已有 versions.change_set_id（C1 前的老库没有） */
  changeSetId?: boolean
}

/** 旧结构 DDL（可选缺列，模拟更老的库），只含迁移需要的表 */
function legacyDdl(options: LegacyFixtureOptions = {}): string {
  const dataJson = options.dataJson !== false
  const changeSetId = options.changeSetId !== false
  return `
    CREATE TABLE apps (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE app_requirement_docs (
      app_id       TEXT PRIMARY KEY,
      template_id  TEXT NOT NULL,
      title        TEXT NOT NULL,
      content_md   TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'draft',
      version      INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      confirmed_at TEXT
    );

    CREATE TABLE app_requirement_doc_sections (
      app_id      TEXT NOT NULL,
      section_key TEXT NOT NULL,
      title       TEXT NOT NULL,
      level       INTEGER NOT NULL DEFAULT 2,
      kind        TEXT NOT NULL,
      markdown    TEXT NOT NULL,
      ${dataJson ? 'data_json   TEXT,' : ''}
      required    INTEGER NOT NULL DEFAULT 0,
      position    INTEGER NOT NULL,
      updated_at  TEXT NOT NULL,
      PRIMARY KEY (app_id, section_key)
    );

    CREATE INDEX idx_requirement_doc_sections_app ON app_requirement_doc_sections(app_id, position);

    CREATE TABLE app_requirement_doc_versions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id        TEXT NOT NULL,
      version       INTEGER NOT NULL,
      template_id   TEXT NOT NULL,
      content_md    TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      source        TEXT NOT NULL,
      ${changeSetId ? 'change_set_id TEXT,' : ''}
      created_at    TEXT NOT NULL
    );

    CREATE UNIQUE INDEX idx_requirement_doc_versions_app_version
      ON app_requirement_doc_versions(app_id, version);
  `
}

function openLegacyFixture(targetPath: string, options: LegacyFixtureOptions = {}): Database.Database {
  const fixture = new Database(targetPath)
  fixture.pragma('journal_mode = WAL')
  fixture.exec(legacyDdl(options))
  fixture.prepare('INSERT INTO apps (id, name) VALUES (?, ?)').run('legacy-app', '旧库应用')
  fixture
    .prepare(`
      INSERT INTO app_requirement_docs
        (app_id, template_id, title, content_md, status, version, created_at, updated_at, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      'legacy-app',
      'builtin-prd',
      '旧库应用 需求文档',
      '# 旧库应用 需求文档\n\n## 问题与机会\n\n旧库内容\n',
      'confirmed',
      6,
      NOW,
      NOW,
      NOW
    )
  const sectionInsert = options.dataJson === false
    ? fixture.prepare(`
        INSERT INTO app_requirement_doc_sections
          (app_id, section_key, title, level, kind, markdown, required, position, updated_at)
        VALUES (?, ?, ?, 2, ?, ?, ?, ?, ?)
      `)
    : fixture.prepare(`
        INSERT INTO app_requirement_doc_sections
          (app_id, section_key, title, level, kind, markdown, data_json, required, position, updated_at)
        VALUES (?, ?, ?, 2, ?, ?, ?, ?, ?, ?)
      `)
  if (options.dataJson === false) {
    sectionInsert.run('legacy-app', 'problem', '问题与机会', 'markdown', '旧库问题', 1, 0, NOW)
    sectionInsert.run('legacy-app', 'epics', 'Epics & User Stories', 'epics', '### EPIC-001 旧库', 1, 1, NOW)
  } else {
    sectionInsert.run(
      'legacy-app',
      'problem',
      '问题与机会',
      'markdown',
      '旧库问题',
      null,
      1,
      0,
      NOW
    )
    sectionInsert.run(
      'legacy-app',
      'epics',
      'Epics & User Stories',
      'epics',
      '### EPIC-001 旧库',
      JSON.stringify({ scenes: [], epics: [{ id: 'EPIC-001', title: '旧库' }], stories: [] }),
      1,
      1,
      NOW
    )
  }
  const versionInsert = options.changeSetId === false
    ? fixture.prepare(`
        INSERT INTO app_requirement_doc_versions
          (app_id, version, template_id, content_md, sections_json, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
    : fixture.prepare(`
        INSERT INTO app_requirement_doc_versions
          (app_id, version, template_id, content_md, sections_json, source, change_set_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
  if (options.changeSetId === false) {
    versionInsert.run('legacy-app', 5, 'builtin-prd', '# v5', '[]', 'manual', NOW)
    versionInsert.run('legacy-app', 6, 'builtin-prd', '# v6', '[]', 'confirm', NOW)
  } else {
    versionInsert.run('legacy-app', 5, 'builtin-prd', '# v5', '[]', 'manual', 'cs-x', NOW)
    versionInsert.run('legacy-app', 6, 'builtin-prd', '# v6', '[]', 'confirm', null, NOW)
  }
  return fixture
}

function columnNames(database: Database.Database, table: string): string[] {
  return (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(row => row.name)
}

function countRows(database: Database.Database, table: string): number {
  return (database.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c
}

test('MF1 迁移前备份：生成 requirements.db.pre-modules-*.bak（可只读打开、计数/内容一致）；已迁移/空库跳过；同名不覆盖', () => {
  const dir = path.join(root, 'mf1-backup')
  fs.mkdirSync(dir, { recursive: true })
  const target = path.join(dir, 'requirements.db')
  const fixture = openLegacyFixture(target)
  fixture.close()

  const source = new Database(target)
  const before = {
    docs: countRows(source, 'app_requirement_docs'),
    sections: countRows(source, 'app_requirement_doc_sections'),
    versions: countRows(source, 'app_requirement_doc_versions'),
    contentHash: sha256Hex(
      (source.prepare("SELECT content_md FROM app_requirement_docs WHERE app_id = 'legacy-app'").get() as {
        content_md: string
      }).content_md
    )
  }

  const first = backupBeforeMigration(source, dir, { timestamp: '20260101-010203' })
  assert.ok(first.path, '旧库应生成备份')
  assert.equal(path.basename(String(first.path)), 'requirements.db.pre-modules-20260101-010203.bak')
  assert.ok((first.bytes ?? 0) > 0, '备份文件应有内容')
  assert.equal(first.skipped, null)

  // 备份可只读打开：仍是迁移前结构、计数与源库一致、内容可查
  const backupDb = new Database(String(first.path), { readonly: true, fileMustExist: true })
  try {
    assert.equal(columnNames(backupDb, 'app_requirement_docs').includes('module_id'), false)
    assert.equal(countRows(backupDb, 'app_requirement_docs'), before.docs)
    assert.equal(countRows(backupDb, 'app_requirement_doc_sections'), before.sections)
    assert.equal(countRows(backupDb, 'app_requirement_doc_versions'), before.versions)
    const backupContent = (backupDb.prepare("SELECT content_md FROM app_requirement_docs WHERE app_id = 'legacy-app'").get() as {
      content_md: string
    }).content_md
    assert.equal(sha256Hex(backupContent), before.contentHash)
    assert.equal(
      (backupDb.prepare("SELECT COUNT(*) AS c FROM app_requirement_doc_versions WHERE source = 'confirm'").get() as {
        c: number
      }).c,
      1
    )
  } finally {
    backupDb.close()
  }

  // 同名时间戳再次备份 → 新文件加 -2，不覆盖已有备份
  const second = backupBeforeMigration(source, dir, { timestamp: '20260101-010203' })
  assert.ok(second.path)
  assert.equal(path.basename(String(second.path)), 'requirements.db.pre-modules-20260101-010203-2.bak')
  assert.equal(fs.statSync(String(first.path)).size, first.bytes)

  // 迁移后再次调用 → 跳过（path=null）且不新建 .bak
  migrateRequirementModules(source)
  const backupsBefore = fs.readdirSync(dir).filter(name => name.endsWith('.bak')).length
  const afterMigration = backupBeforeMigration(source, dir, { timestamp: '20270101-000000' })
  assert.equal(afterMigration.path, null)
  assert.match(String(afterMigration.skipped), /已迁移/)
  assert.equal(afterMigration.bytes, 0)
  assert.equal(fs.readdirSync(dir).filter(name => name.endsWith('.bak')).length, backupsBefore)
  source.close()

  // 空库（有表但无文档行）→ 跳过且不写文件
  const emptyDir = path.join(root, 'mf1-empty')
  fs.mkdirSync(emptyDir, { recursive: true })
  const empty = new Database(path.join(emptyDir, 'requirements.db'))
  empty.exec(legacyDdl())
  try {
    const emptyResult = backupBeforeMigration(empty, emptyDir, { timestamp: '20260101-000000' })
    assert.equal(emptyResult.path, null)
    assert.match(String(emptyResult.skipped), /为空/)
    assert.equal(fs.readdirSync(emptyDir).filter(name => name.endsWith('.bak')).length, 0)
  } finally {
    empty.close()
  }

  // 没有需求表的新库 → 跳过
  const freshDir = path.join(root, 'mf1-fresh')
  fs.mkdirSync(freshDir, { recursive: true })
  const fresh = new Database(path.join(freshDir, 'requirements.db'))
  try {
    const freshResult = backupBeforeMigration(fresh, freshDir)
    assert.equal(freshResult.path, null)
    assert.match(String(freshResult.skipped), /没有 app_requirement_docs 表/)
  } finally {
    fresh.close()
  }
})

test('MF4 老库缺列（sections.data_json / versions.change_set_id）：迁移自动补列、行数/版本/内容保留、幂等', () => {
  const dir = path.join(root, 'mf4-missing-columns')
  fs.mkdirSync(dir, { recursive: true })
  const target = path.join(dir, 'requirements.db')
  const fixture = openLegacyFixture(target, { dataJson: false, changeSetId: false })
  fixture.close()

  const legacy = new Database(target)
  try {
    assert.equal(columnNames(legacy, 'app_requirement_doc_sections').includes('data_json'), false)
    assert.equal(columnNames(legacy, 'app_requirement_doc_versions').includes('change_set_id'), false)
    const versionsBefore = legacy
      .prepare('SELECT id, version, source, content_md FROM app_requirement_doc_versions ORDER BY id')
      .all() as Array<{ id: number; version: number; source: string; content_md: string }>

    const result = migrateRequirementModules(legacy)
    assert.equal(result.alreadyMigrated, false)
    assert.equal(result.appsMigrated, 1)

    // 列已补齐；data_json 为 NULL（旧库没有该数据）
    assert.ok(columnNames(legacy, 'app_requirement_doc_sections').includes('data_json'))
    assert.ok(columnNames(legacy, 'app_requirement_doc_versions').includes('change_set_id'))
    const dataJsonRows = legacy
      .prepare('SELECT data_json FROM app_requirement_doc_sections ORDER BY position')
      .all() as Array<{ data_json: string | null }>
    assert.equal(dataJsonRows.length, 2)
    assert.ok(dataJsonRows.every(row => row.data_json === null))
    assert.ok(
      (legacy.prepare('SELECT change_set_id FROM app_requirement_doc_versions').all() as Array<{
        change_set_id: string | null
      }>).every(row => row.change_set_id === null)
    )

    // 行数/版本号/来源/内容保留
    assert.equal(countRows(legacy, 'app_requirement_docs'), 1)
    assert.equal(countRows(legacy, 'app_requirement_doc_sections'), 2)
    assert.equal(countRows(legacy, 'app_requirement_doc_versions'), 2)
    const versionsAfter = legacy
      .prepare('SELECT id, version, source, content_md FROM app_requirement_doc_versions ORDER BY id')
      .all() as Array<{ id: number; version: number; source: string; content_md: string }>
    assert.deepEqual(versionsAfter, versionsBefore)
    assert.equal(
      (legacy.prepare("SELECT status FROM app_requirement_docs WHERE app_id = 'legacy-app'").get() as {
        status: string
      }).status,
      'confirmed'
    )
    assert.equal((legacy.prepare('SELECT version FROM app_requirement_docs').get() as { version: number }).version, 6)
    // 默认模块与 bundle 正常生成
    assert.equal((legacy.prepare("SELECT module_key FROM app_modules WHERE app_id = 'legacy-app'").get() as {
      module_key: string
    }).module_key, 'MOD-001')
    assert.equal(countRows(legacy, 'app_requirement_bundles'), 1)

    // 幂等：再跑不重复建模块/bundle，不改行数
    const second = migrateRequirementModules(legacy)
    assert.equal(second.alreadyMigrated, true)
    assert.equal(countRows(legacy, 'app_modules'), 1)
    assert.equal(countRows(legacy, 'app_requirement_bundles'), 1)
    assert.equal(countRows(legacy, 'app_requirement_docs'), 1)
    assert.equal(countRows(legacy, 'app_requirement_doc_versions'), 2)
  } finally {
    legacy.close()
  }
})

after(() => {
  try {
    database?.close()
  } catch {
    // 已关闭
  }
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {
    // Windows 上 SQLite 句柄释放可能滞后
  }
})
