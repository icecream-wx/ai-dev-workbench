/**
 * 设计表模块化升级（M4）单测
 *
 * 政策（2026-11-13）：不做旧数据迁移。
 * - 目标结构 → no-op；
 * - 旧结构 + 0 应用/0 设计数据 → 单事务重建空表（无 *_legacy）；
 * - 旧结构 + 有应用/设计数据 → fail-closed 抛错且不改库。
 *
 * 直接使用 better-sqlite3（不 import ../db），与实现约定一致。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import Database from 'better-sqlite3'
import {
  DESIGN_MODULE_INDEX_DDL,
  DESIGN_TABLE_DDL,
  designModuleSchemaStatus,
  ensureDesignModuleSchema
} from './module-migration'

const roots: string[] = []

after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
})

function openDatabase(): { database: Database.Database; file: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'design-module-migration-'))
  roots.push(root)
  const file = path.join(root, 'requirements.db')
  const database = new Database(file)
  database.pragma('foreign_keys = ON')
  return { database, file }
}

/** 旧设计结构（无 module_id；projects PK=app_id；旧索引名） */
function createLegacyDesignSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE apps (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE app_design_projects (
      app_id                TEXT PRIMARY KEY,
      prototype_template_id TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'draft',
      version               INTEGER NOT NULL DEFAULT 1,
      source_doc_version    INTEGER,
      created_at            TEXT NOT NULL,
      updated_at            TEXT NOT NULL,
      confirmed_at          TEXT
    );
    CREATE TABLE app_design_inputs (
      id           TEXT PRIMARY KEY,
      app_id       TEXT NOT NULL,
      doc_version  INTEGER NOT NULL,
      doc_hash     TEXT NOT NULL,
      template_id  TEXT NOT NULL,
      input_json   TEXT NOT NULL,
      structure    TEXT NOT NULL DEFAULT 'prd',
      change_set_id TEXT,
      created_at   TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_design_inputs_app_hash ON app_design_inputs(app_id, doc_hash);
    CREATE TABLE app_design_entities (
      id          TEXT PRIMARY KEY,
      app_id      TEXT NOT NULL,
      name        TEXT NOT NULL,
      table_name  TEXT,
      description TEXT,
      fields_json TEXT NOT NULL,
      relations_json TEXT NOT NULL,
      requirement_refs_json TEXT,
      source_sections_json TEXT,
      status      TEXT NOT NULL DEFAULT 'draft',
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX idx_design_entities_app ON app_design_entities(app_id, position);
    CREATE TABLE app_design_page_sets (
      id          TEXT PRIMARY KEY,
      app_id      TEXT NOT NULL,
      scene_key   TEXT NOT NULL,
      epic_id     TEXT,
      story_ids_json TEXT,
      title       TEXT NOT NULL,
      description TEXT,
      status      TEXT NOT NULL DEFAULT 'draft',
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX idx_design_page_sets_app ON app_design_page_sets(app_id, position);
    CREATE TABLE app_design_pages (
      id          TEXT PRIMARY KEY,
      page_set_id TEXT NOT NULL REFERENCES app_design_page_sets(id) ON DELETE CASCADE,
      page_key    TEXT NOT NULL,
      title       TEXT NOT NULL,
      type        TEXT NOT NULL,
      entity_id   TEXT,
      requirement_refs_json TEXT,
      spec_json   TEXT NOT NULL,
      layout_json TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'draft',
      version     INTEGER NOT NULL DEFAULT 1,
      image_path  TEXT,
      html_path   TEXT,
      image_hash  TEXT,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX idx_design_pages_set ON app_design_pages(page_set_id, position);
    CREATE TABLE app_design_versions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id       TEXT NOT NULL,
      version      INTEGER NOT NULL,
      entities_json TEXT NOT NULL,
      page_sets_json TEXT NOT NULL,
      source       TEXT NOT NULL,
      change_set_id TEXT,
      created_at   TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_design_versions_app_version
      ON app_design_versions(app_id, version);
  `)
}

function columnsOf(database: Database.Database, table: string): string[] {
  return (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(row => row.name)
}

function tableNames(database: Database.Database): string[] {
  return (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map(
    row => row.name
  )
}

function countOf(database: Database.Database, table: string): number {
  return (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
}

test('旧设计结构 + 空库：重建为目标结构（空表、索引/PK 正确、无 *_legacy），再跑幂等', () => {
  const { database } = openDatabase()
  try {
    createLegacyDesignSchema(database)
    const before = designModuleSchemaStatus(database)
    assert.equal(before.migrated, false)

    const result = ensureDesignModuleSchema(database)
    assert.equal(result.action, 'rebuilt-empty')
    assert.equal(result.migrated, true)

    // 六表都存在且带 module_id；行数为 0
    for (const table of [
      'app_design_projects',
      'app_design_entities',
      'app_design_page_sets',
      'app_design_pages',
      'app_design_versions',
      'app_design_inputs'
    ]) {
      assert.ok(columnsOf(database, table).includes('module_id'), `${table} 缺少 module_id`)
      assert.equal(countOf(database, table), 0, `${table} 应为空`)
    }

    // 无 *_legacy
    const tables = tableNames(database)
    assert.equal(tables.filter(name => name.includes('_legacy')).length, 0)
    assert.equal(tables.filter(name => name.includes('_new')).length, 0)

    // projects 主键 (app_id, module_id)
    const projects = database.prepare('PRAGMA table_info(app_design_projects)').all() as Array<{
      name: string
      pk: number
    }>
    const pkColumns = projects.filter(column => column.pk > 0).sort((a, b) => a.pk - b.pk).map(column => column.name)
    assert.deepEqual(pkColumns, ['app_id', 'module_id'])

    // 新索引存在；旧索引名不再出现
    const indexes = (database.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{
      name: string
    }>).map(row => row.name)
    for (const expected of [
      'idx_design_projects_app_module',
      'idx_design_entities_app_module',
      'idx_design_page_sets_app_module',
      'idx_design_pages_app_module',
      'idx_design_versions_app_module_version',
      'idx_design_inputs_app_module_hash'
    ]) {
      assert.ok(indexes.includes(expected), `缺少索引 ${expected}`)
    }
    for (const legacy of [
      'idx_design_inputs_app_hash',
      'idx_design_entities_app',
      'idx_design_page_sets_app',
      'idx_design_versions_app_version'
    ]) {
      assert.ok(!indexes.includes(legacy), `旧索引仍存在 ${legacy}`)
    }

    // 幂等：第二次 no-op，不重建
    const again = ensureDesignModuleSchema(database)
    assert.equal(again.action, 'noop')
    assert.equal(again.migrated, true)
  } finally {
    database.close()
  }
})

test('旧结构 + 有应用：fail-closed 抛错且不改库（无 *_legacy）', () => {
  const { database } = openDatabase()
  try {
    createLegacyDesignSchema(database)
    database.prepare("INSERT INTO apps (id, name) VALUES ('app-a', '应用 A')").run()
    assert.throws(
      () => ensureDesignModuleSchema(database),
      /检测到旧设计表且存在应用\/设计数据；按当前政策不做数据迁移/
    )
    // 旧结构保留：projects 仍无 module_id；apps 仍有数据；无 legacy/new
    assert.ok(!columnsOf(database, 'app_design_projects').includes('module_id'))
    assert.equal(countOf(database, 'apps'), 1)
    const tables = tableNames(database)
    assert.equal(tables.filter(name => name.includes('_legacy')).length, 0)
    assert.equal(tables.filter(name => name.includes('_new')).length, 0)
  } finally {
    database.close()
  }
})

test('旧结构 + 无应用但有设计数据：同样 fail-closed', () => {
  const { database } = openDatabase()
  try {
    createLegacyDesignSchema(database)
    database
      .prepare(
        `INSERT INTO app_design_projects (app_id, prototype_template_id, status, version, created_at, updated_at)
         VALUES ('app-a', 'builtin-prototype-enterprise', 'confirmed', 4, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
      )
      .run()
    assert.throws(() => ensureDesignModuleSchema(database), /不做数据迁移/)
    assert.ok(!columnsOf(database, 'app_design_projects').includes('module_id'))
    assert.equal(countOf(database, 'app_design_projects'), 1)
  } finally {
    database.close()
  }
})

test('目标结构：no-op（不删数据/不重建）', () => {
  const { database } = openDatabase()
  try {
    database.exec(DESIGN_TABLE_DDL)
    database.exec(DESIGN_MODULE_INDEX_DDL)
    const now = '2026-01-01T00:00:00.000Z'
    database
      .prepare(
        `INSERT INTO app_design_projects (app_id, module_id, prototype_template_id, status, version, created_at, updated_at)
         VALUES ('app-a', 'mod-1', 'builtin-prototype-enterprise', 'confirmed', 3, ?, ?)`
      )
      .run(now, now)

    const before = designModuleSchemaStatus(database)
    assert.equal(before.migrated, true)
    const result = ensureDesignModuleSchema(database)
    assert.equal(result.action, 'noop')
    assert.equal(countOf(database, 'app_design_projects'), 1)
  } finally {
    database.close()
  }
})

test('没有任何设计表：创建目标结构', () => {
  const { database } = openDatabase()
  try {
    const result = ensureDesignModuleSchema(database)
    assert.equal(result.action, 'created')
    assert.equal(result.migrated, true)
    assert.equal(countOf(database, 'app_design_projects'), 0)
  } finally {
    database.close()
  }
})
