/**
 * 设计模块化升级（M4，#6，无旧数据迁移）
 *
 * 目标：设计六表按模块归属（`module_id`）；设计项目主键 `(app_id, module_id)`。
 *
 * 政策（2026-11-13，用户确认）：开发前期不做旧应用数据兼容。
 * - 目标结构已就绪 → no-op；
 * - 旧结构且**无应用/无设计数据**（`apps` 为空且六表行数为 0）→ 单事务删旧表、建目标表；
 * - 旧结构且**存在应用或设计数据** → 抛错阻止启动（fail-closed），
 *   不建 `*_legacy`、不写行级回填、不做任何兼容迁移。
 *
 * 约束：
 * - 本模块**不 import `../db`**（避免与 db.ts 循环依赖）；函数接收 better-sqlite3 `Database`；
 * - DDL 常量同时供 `db.ts` 基础 schema 与升级使用，保证新库/升级结果一致；
 * - 不触碰需求/交接包/变更单/会话/开发阶段表。
 */
import type DatabaseType from 'better-sqlite3'

type SqliteDatabase = DatabaseType.Database

/** 设计六表的目标结构（无依赖 module_id 的索引；索引见 DESIGN_MODULE_INDEX_DDL） */
export const DESIGN_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS app_design_projects (
    app_id                TEXT NOT NULL,
    module_id             TEXT NOT NULL,
    prototype_template_id TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'draft',
    version               INTEGER NOT NULL DEFAULT 1,
    source_doc_version    INTEGER,
    source_input_id       TEXT,
    source_input_hash     TEXT,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    confirmed_at          TEXT,
    PRIMARY KEY (app_id, module_id)
  );

  CREATE TABLE IF NOT EXISTS app_design_inputs (
    id            TEXT PRIMARY KEY,
    app_id        TEXT NOT NULL,
    module_id     TEXT NOT NULL,
    doc_version   INTEGER NOT NULL,
    doc_hash      TEXT NOT NULL,
    template_id   TEXT NOT NULL,
    input_json    TEXT NOT NULL,
    structure     TEXT NOT NULL DEFAULT 'prd',
    change_set_id TEXT,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_design_entities (
    id                    TEXT PRIMARY KEY,
    app_id                TEXT NOT NULL,
    module_id             TEXT NOT NULL,
    name                  TEXT NOT NULL,
    table_name            TEXT,
    description           TEXT,
    fields_json           TEXT NOT NULL,
    relations_json        TEXT NOT NULL,
    requirement_refs_json TEXT,
    source_sections_json  TEXT,
    status                TEXT NOT NULL DEFAULT 'draft',
    position              INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_design_page_sets (
    id            TEXT PRIMARY KEY,
    app_id        TEXT NOT NULL,
    module_id     TEXT NOT NULL,
    scene_key     TEXT NOT NULL,
    epic_id       TEXT,
    story_ids_json TEXT,
    title         TEXT NOT NULL,
    description   TEXT,
    status        TEXT NOT NULL DEFAULT 'draft',
    position      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_design_pages (
    id                    TEXT PRIMARY KEY,
    app_id                TEXT NOT NULL,
    module_id             TEXT NOT NULL,
    page_set_id           TEXT NOT NULL REFERENCES app_design_page_sets(id) ON DELETE CASCADE,
    page_key              TEXT NOT NULL,
    title                 TEXT NOT NULL,
    type                  TEXT NOT NULL,
    entity_id             TEXT,
    requirement_refs_json TEXT,
    spec_json             TEXT NOT NULL,
    layout_json           TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'draft',
    version               INTEGER NOT NULL DEFAULT 1,
    image_path            TEXT,
    html_path             TEXT,
    image_hash            TEXT,
    position              INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_design_versions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id        TEXT NOT NULL,
    module_id     TEXT NOT NULL,
    version       INTEGER NOT NULL,
    entities_json TEXT NOT NULL,
    page_sets_json TEXT NOT NULL,
    source        TEXT NOT NULL,
    change_set_id TEXT,
    created_at    TEXT NOT NULL
  );
`

/** 目标索引（含 `module_id`；db.ts 在基础 DDL/升级之后执行一次） */
export const DESIGN_MODULE_INDEX_DDL = `
  CREATE INDEX IF NOT EXISTS idx_design_projects_app_module ON app_design_projects(app_id, module_id);
  CREATE INDEX IF NOT EXISTS idx_design_entities_app_module ON app_design_entities(app_id, module_id, position);
  CREATE INDEX IF NOT EXISTS idx_design_page_sets_app_module ON app_design_page_sets(app_id, module_id, position);
  CREATE INDEX IF NOT EXISTS idx_design_pages_app_module ON app_design_pages(app_id, module_id, position);
  CREATE INDEX IF NOT EXISTS idx_design_pages_set ON app_design_pages(page_set_id, position);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_design_versions_app_module_version
    ON app_design_versions(app_id, module_id, version);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_design_inputs_app_module_hash
    ON app_design_inputs(app_id, module_id, doc_hash);
`

/** 升级时按依赖顺序删除（页面先于页面集） */
const DESIGN_TABLES = [
  'app_design_pages',
  'app_design_page_sets',
  'app_design_entities',
  'app_design_versions',
  'app_design_inputs',
  'app_design_projects'
] as const

export interface DesignModuleSchemaStatus {
  /** 六表都已有 module_id（目标结构） */
  migrated: boolean
  tables: Record<(typeof DESIGN_TABLES)[number], boolean>
  /** 应用数（旧结构判定“是否允许空库重建”） */
  appCount: number
  /** 六表行数 */
  counts: Record<(typeof DESIGN_TABLES)[number], number>
  indexes: string[]
}

function tableExists(database: SqliteDatabase, table: string): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { name: string } | undefined
  return Boolean(row)
}

function tableColumns(database: SqliteDatabase, table: string): string[] {
  if (!tableExists(database, table)) return []
  return (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(row => row.name)
}

function countOf(database: SqliteDatabase, table: string): number {
  if (!tableExists(database, table)) return 0
  return (database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count
}

function indexNamesOf(database: SqliteDatabase): string[] {
  const rows = database
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_design_%' ORDER BY name`
    )
    .all() as Array<{ name: string }>
  return rows.map(row => row.name)
}

/** 只读状态检查（可对真实库/副本运行；不做任何写入） */
export function designModuleSchemaStatus(database: SqliteDatabase): DesignModuleSchemaStatus {
  const tables = Object.fromEntries(
    DESIGN_TABLES.map(table => [table, tableExists(database, table)])
  ) as Record<(typeof DESIGN_TABLES)[number], boolean>
  const counts = Object.fromEntries(
    DESIGN_TABLES.map(table => [table, countOf(database, table)])
  ) as Record<(typeof DESIGN_TABLES)[number], number>
  const migrated = DESIGN_TABLES.every(table => tableColumns(database, table).includes('module_id'))
  return {
    migrated,
    tables,
    appCount: countOf(database, 'apps'),
    counts,
    indexes: indexNamesOf(database)
  }
}

export type DesignModuleSchemaAction = 'noop' | 'created' | 'rebuilt-empty'

export interface DesignModuleSchemaResult extends DesignModuleSchemaStatus {
  action: DesignModuleSchemaAction
}

/**
 * 启动升级入口：幂等。
 *
 * 目标结构 → no-op；没有设计表（极旧/空库）→ 建目标结构；
 * 旧结构 + 无应用/无数据 → 重建空表；旧结构 + 有应用/数据 → fail-closed 抛错。
 */
export function ensureDesignModuleSchema(database: SqliteDatabase): DesignModuleSchemaResult {
  const status = designModuleSchemaStatus(database)
  if (status.migrated) return { ...status, action: 'noop' }

  const existing = DESIGN_TABLES.filter(table => status.tables[table])
  if (!existing.length) {
    database.exec(`${DESIGN_TABLE_DDL}${DESIGN_MODULE_INDEX_DDL}`)
    return { ...designModuleSchemaStatus(database), action: 'created' }
  }

  const hasData = status.appCount > 0 || DESIGN_TABLES.some(table => status.counts[table] > 0)
  if (hasData) {
    throw new Error(
      '检测到旧设计表且存在应用/设计数据；按当前政策不做数据迁移，请先删除应用或重置 data/requirements.db 后重启。'
    )
  }

  // 空库：删旧表（含旧索引）→ 建目标结构；单事务，失败整批回滚。
  const tx = database.transaction(() => {
    for (const table of DESIGN_TABLES) database.exec(`DROP TABLE IF EXISTS ${table}`)
    database.exec(`${DESIGN_TABLE_DDL}${DESIGN_MODULE_INDEX_DDL}`)
  })
  try {
    tx()
  } catch (error) {
    throw new Error(
      `设计表模块化升级失败（已回滚）：${error instanceof Error ? error.message : String(error)}`
    )
  }
  console.log('[db] 设计表已升级为模块化结构（空库）')
  return { ...designModuleSchemaStatus(database), action: 'rebuilt-empty' }
}
