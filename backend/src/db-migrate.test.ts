/**
 * 启动升级三态（只测纯迁移函数，不 import ../db）
 *
 * 1. 新库 → created（4 表）
 * 2. 新结构再跑一次 → noop
 * 3. 旧结构 + apps 为空 → rebuilt（旧应用域表/原型模板表删除，**需求模板库保留**）
 * 4. 旧结构 + apps 非空 → fail-closed 抛错（不删数据、不迁移）
 * 5. 旧版 5 表（含 prototype_templates）→ 重建为 4 表
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { LEGACY_TABLES, NEW_TABLES, OBSOLETE_TABLES, PRESERVED_TABLES, migrateDatabase } from './db-migrate'

function tables(db: Database.Database): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>).map(
    row => row.name
  )
}

interface LegacyOptions {
  /** 建旧模板表并写 1 条自定义需求模板行（模拟用户自建模板） */
  withTemplates?: boolean
}

function legacyDb(appCount: number, options: LegacyOptions = {}): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE apps (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE app_sessions (id TEXT PRIMARY KEY, app_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'idle',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE app_modules (id TEXT PRIMARY KEY, app_id TEXT NOT NULL);
    CREATE TABLE app_requirement_docs (id TEXT PRIMARY KEY, app_id TEXT NOT NULL);
    CREATE TABLE app_design_projects (id TEXT PRIMARY KEY, app_id TEXT NOT NULL);
    CREATE TABLE app_change_sets (id TEXT PRIMARY KEY, app_id TEXT NOT NULL);
    CREATE TABLE design_handoffs (id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL);
    CREATE TABLE app_dev_phases (id TEXT PRIMARY KEY, app_id TEXT NOT NULL);
    CREATE TABLE app_stage_events (id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL);
  `)
  if (options.withTemplates) {
    db.exec(`
      CREATE TABLE requirement_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, stage TEXT NOT NULL,
        category TEXT NOT NULL, description TEXT, prompt TEXT NOT NULL, sections_json TEXT NOT NULL,
        builtin INTEGER NOT NULL DEFAULT 0, visibility TEXT NOT NULL DEFAULT 'private',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO requirement_templates
        (id, name, stage, category, description, prompt, sections_json, builtin, visibility, created_at, updated_at)
      VALUES ('my-req-template', '我的需求模板', 'requirements', '我的模板', '', '写需求',
        '[{"id":"goals","title":"目标","level":2,"kind":"markdown","guidance":"","required":true}]', 0, 'private',
        '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z');
    `)
  }
  for (let index = 0; index < appCount; index += 1) {
    db.prepare('INSERT INTO apps (id, name, status) VALUES (?, ?, ?)').run(`app-${index}`, `应用 ${index}`, 'requirements')
  }
  return db
}

/** 上一版 5 表结构（含 prototype_templates 与 apps.prototype_template_id） */
function fiveTableDb(appCount: number, withTemplates = false): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE apps (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, dir TEXT NOT NULL,
      backend_port INTEGER NOT NULL DEFAULT 8081, status TEXT NOT NULL DEFAULT 'requirements',
      requirement_template_id TEXT, prototype_template_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE app_sessions (id TEXT PRIMARY KEY, app_id TEXT NOT NULL, stage TEXT, view TEXT,
      opencode_session_id TEXT, provider_id TEXT, model_id TEXT, status TEXT NOT NULL DEFAULT 'idle',
      title TEXT, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_active_at TEXT);
    CREATE TABLE requirement_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, stage TEXT NOT NULL,
      category TEXT NOT NULL, description TEXT, prompt TEXT NOT NULL, sections_json TEXT NOT NULL,
      builtin INTEGER NOT NULL DEFAULT 0, visibility TEXT NOT NULL DEFAULT 'private',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE prototype_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
      description TEXT, tokens_json TEXT NOT NULL, shell_json TEXT NOT NULL, patterns_json TEXT NOT NULL,
      page_set_rules_json TEXT NOT NULL, prompt TEXT NOT NULL, builtin INTEGER NOT NULL DEFAULT 0,
      visibility TEXT NOT NULL DEFAULT 'private', preview_path TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  `)
  if (withTemplates) {
    db.exec(`
      INSERT INTO requirement_templates
        (id, name, stage, category, description, prompt, sections_json, builtin, visibility, created_at, updated_at)
      VALUES ('my-req-template', '我的需求模板', 'requirements', '我的模板', '', '写需求', '[]', 0, 'private',
        '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z');
      INSERT INTO prototype_templates
        (id, name, category, description, tokens_json, shell_json, patterns_json, page_set_rules_json, prompt,
         builtin, visibility, preview_path, created_at, updated_at)
      VALUES ('builtin-prototype-enterprise', '企业级专业管理', 'enterprise', '', '{}', '{}', '{}', '{}', '原型提示',
        1, 'builtin', NULL, '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z');
    `)
  }
  for (let index = 0; index < appCount; index += 1) {
    db.prepare(
      `INSERT INTO apps (id, name, dir, status, created_at, updated_at) VALUES (?, ?, ?, 'requirements', ?, ?)`
    ).run(`app-${index}`, `应用 ${index}`, `app-${index}`, '2026-11-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z')
  }
  return db
}

test('新库 → created，只建 4 张表', () => {
  const db = new Database(':memory:')
  const result = migrateDatabase(db)
  assert.equal(result.action, 'created')
  assert.deepEqual(tables(db).sort(), [...NEW_TABLES].sort())
  assert.equal(tables(db).includes('prototype_templates'), false, '不应再建 prototype_templates')
  db.close()
})

test('新结构再跑 → noop（幂等）', () => {
  const db = new Database(':memory:')
  migrateDatabase(db)
  const again = migrateDatabase(db)
  assert.equal(again.action, 'noop')
  assert.deepEqual(again.dropped, [])
  assert.deepEqual(tables(db).sort(), [...NEW_TABLES].sort())
  db.close()
})

test('旧结构 + apps 为空 → rebuilt（旧应用域表删除，需求模板库保留）', () => {
  const db = legacyDb(0)
  const result = migrateDatabase(db)
  assert.equal(result.action, 'rebuilt')
  const remaining = tables(db)
  for (const legacy of LEGACY_TABLES) assert.equal(remaining.includes(legacy), false, `旧表未删除：${legacy}`)
  for (const preserved of PRESERVED_TABLES) {
    assert.equal(remaining.includes(preserved), true, `保留表不应被删除：${preserved}`)
    assert.equal(result.dropped.includes(preserved), false, `dropped 不应包含保留表：${preserved}`)
  }
  assert.deepEqual(remaining.sort(), [...NEW_TABLES].sort())
  db.close()
})

test('旧结构 + apps 为空 + 自定义需求模板 → rebuilt 后模板行仍在（不丢全局模板库）', () => {
  const db = legacyDb(0, { withTemplates: true })
  const result = migrateDatabase(db)
  assert.equal(result.action, 'rebuilt')
  assert.equal(result.dropped.includes('requirement_templates'), false)

  const reqCount = db.prepare('SELECT COUNT(*) AS count FROM requirement_templates').get() as { count: number }
  assert.equal(reqCount.count, 1)

  // 行内容与索引仍可用
  const row = db
    .prepare('SELECT id, name, builtin, visibility FROM requirement_templates WHERE id = ?')
    .get('my-req-template') as { id: string; name: string; builtin: number; visibility: string }
  assert.equal(row.name, '我的需求模板')
  assert.equal(row.builtin, 0)
  assert.equal(row.visibility, 'private')

  // 旧应用域表已删除，新 apps 表为空
  assert.equal(tables(db).includes('app_modules'), false)
  assert.equal(tables(db).includes('app_stage_events'), false)
  const apps = db.prepare('SELECT COUNT(*) AS count FROM apps').get() as { count: number }
  assert.equal(apps.count, 0)
  const sessions = db.prepare('SELECT COUNT(*) AS count FROM app_sessions').get() as { count: number }
  assert.equal(sessions.count, 0)
  db.close()
})

test('上一版 5 表（含 prototype_templates、apps 为空）→ 重建为 4 表，需求模板保留', () => {
  const db = fiveTableDb(0, true)
  const result = migrateDatabase(db)
  assert.equal(result.action, 'rebuilt')
  assert.ok(result.dropped.includes('prototype_templates'), 'prototype_templates 应被删除')
  const remaining = tables(db)
  for (const obsolete of OBSOLETE_TABLES) assert.equal(remaining.includes(obsolete), false, `旧表未删除：${obsolete}`)
  assert.deepEqual(remaining.sort(), [...NEW_TABLES].sort())
  const columns = (db.prepare('PRAGMA table_info(apps)').all() as Array<{ name: string }>).map(item => item.name)
  assert.equal(columns.includes('prototype_template_id'), false, 'apps 不应再有 prototype_template_id 列')

  const row = db.prepare('SELECT name FROM requirement_templates WHERE id = ?').get('my-req-template') as
    | { name: string }
    | undefined
  assert.equal(row?.name, '我的需求模板')
  db.close()
})

test('旧结构 + apps 非空 → fail-closed（抛错且不删数据）', () => {
  const db = legacyDb(1)
  assert.throws(() => migrateDatabase(db), /不做旧数据兼容/)
  // 数据与旧表都还在
  assert.equal(tables(db).includes('app_modules'), true)
  const count = db.prepare('SELECT COUNT(*) AS count FROM apps').get() as { count: number }
  assert.equal(count.count, 1)
  db.close()
})

test('上一版 5 表 + apps 非空 → fail-closed（含 prototype_templates 也不迁移）', () => {
  const db = fiveTableDb(1, true)
  assert.throws(() => migrateDatabase(db), /不做旧数据兼容/)
  assert.equal(tables(db).includes('prototype_templates'), true)
  db.close()
})

test('app_sessions 缺 view 列时补列（不回填）', () => {
  const db = new Database(':memory:')
  // 4 表结构已存在、但 app_sessions 缺 view（旧版本创建的表）
  db.exec(`
    CREATE TABLE apps (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, dir TEXT NOT NULL,
      backend_port INTEGER NOT NULL DEFAULT 8081, status TEXT NOT NULL DEFAULT 'requirements',
      requirement_template_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE app_sessions (id TEXT PRIMARY KEY, app_id TEXT NOT NULL, stage TEXT, opencode_session_id TEXT,
      provider_id TEXT, model_id TEXT, status TEXT NOT NULL DEFAULT 'idle', title TEXT, note TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_active_at TEXT);
    CREATE TABLE requirement_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, stage TEXT NOT NULL, category TEXT NOT NULL,
      description TEXT, prompt TEXT NOT NULL, sections_json TEXT NOT NULL, builtin INTEGER NOT NULL DEFAULT 0,
      visibility TEXT NOT NULL DEFAULT 'private', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  `)
  const result = migrateDatabase(db)
  assert.equal(result.action, 'noop')
  const columns = (db.prepare('PRAGMA table_info(app_sessions)').all() as Array<{ name: string }>).map(row => row.name)
  assert.equal(columns.includes('view'), true)
  db.close()
})
