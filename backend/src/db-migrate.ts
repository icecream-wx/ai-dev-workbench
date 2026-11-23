/**
 * SQLite 结构：4 张表 + 三态启动升级
 *
 * 保留表：
 * - apps                 应用登记（需求模板默认值）
 * - app_settings         应用设置（模型/会话设置/设计系统选择等 key-value）
 * - app_sessions         应用会话（按 view：requirements/design/development）
 * - requirement_templates 需求模板库（全局，唯一权威）
 *
 * 升级口径（不做旧数据兼容）：
 * - 新结构 → no-op；
 * - 旧结构 + apps 为空 → 删除旧应用域表并重建；**需求模板库保留**（模板是全局权威，
 *   不属于“旧应用数据”），旧的 `prototype_templates` 表与 `apps.prototype_template_id` 列不再存在；
 * - 旧结构 + apps 非空 → fail-closed 抛错（不迁移、不删数据）。
 */
import type Database from 'better-sqlite3'

/** 本版淘汰的旧表（P1 一次性清理，不提供迁移） */
export const LEGACY_TABLES = [
  'app_stage_events',
  'app_modules',
  'app_requirement_bundles',
  'app_requirement_docs',
  'app_requirement_doc_sections',
  'app_requirement_doc_versions',
  'app_design_projects',
  'app_design_inputs',
  'app_design_entities',
  'app_design_page_sets',
  'app_design_pages',
  'app_design_versions',
  'app_change_sets',
  'app_change_set_modules',
  'design_handoffs',
  'app_dev_phases',
  // R4b-2 更早的旧表（若仍存在）
  'modules',
  'module_docs',
  'handoffs'
] as const

/** P8-1 删除的旧原型模板表（旧库出现即触发重建/拒绝） */
export const OBSOLETE_TABLES = ['prototype_templates'] as const

/** P8-1 删除的旧列（旧库出现即触发重建/拒绝） */
const OBSOLETE_APP_COLUMNS = ['prototype_template_id'] as const

export const NEW_TABLES = ['apps', 'app_settings', 'app_sessions', 'requirement_templates'] as const

/** 重建时必须保留的表：需求模板库是唯一权威，不属于“旧应用数据”。 */
export const PRESERVED_TABLES = ['requirement_templates'] as const

const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS apps (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    description             TEXT,
    dir                     TEXT NOT NULL,
    backend_port            INTEGER NOT NULL DEFAULT 8081,
    status                  TEXT NOT NULL DEFAULT 'requirements',
    requirement_template_id TEXT,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_sessions (
    id                  TEXT PRIMARY KEY,
    app_id              TEXT NOT NULL,
    stage               TEXT,
    view                TEXT,
    opencode_session_id TEXT,
    provider_id         TEXT,
    model_id            TEXT,
    status              TEXT NOT NULL DEFAULT 'idle',
    title               TEXT,
    note                TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    last_active_at      TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_app_sessions_app ON app_sessions(app_id, created_at);

  CREATE TABLE IF NOT EXISTS requirement_templates (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    stage         TEXT NOT NULL,
    category      TEXT NOT NULL,
    description   TEXT,
    prompt        TEXT NOT NULL,
    sections_json TEXT NOT NULL,
    builtin       INTEGER NOT NULL DEFAULT 0,
    visibility    TEXT NOT NULL DEFAULT 'private',
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_requirement_templates_stage ON requirement_templates(stage, category);
`

export type MigrationAction = 'created' | 'noop' | 'rebuilt'

export interface MigrationResult {
  action: MigrationAction
  dropped: string[]
}

function tableNames(db: Database.Database): string[] {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as Array<{
    name: string
  }>
  return rows.map(row => row.name)
}

function tableColumns(db: Database.Database, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.map(row => row.name)
}

/** 旧库补列（列名/定义来自代码常量，不接受外部输入） */
function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = tableColumns(db, table)
  if (columns.some(item => item === column)) return
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  } catch (error) {
    if (!/duplicate column/i.test(error instanceof Error ? error.message : String(error))) throw error
  }
}

function createSchema(db: Database.Database): void {
  db.exec(SCHEMA_DDL)
  // 旧版（但已是 4 表）库可能缺 view 列；新库 DDL 已含该列，这里是幂等兜底
  ensureColumn(db, 'app_sessions', 'view', 'TEXT')
  // 依赖 view 列的索引必须在补列之后创建
  db.exec('CREATE INDEX IF NOT EXISTS idx_app_sessions_view ON app_sessions(app_id, view, status)')
  // 保留表（需求模板库）可能来自更早版本：补历史增列，避免重建后读表失败
  ensureColumn(db, 'requirement_templates', 'builtin', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'requirement_templates', 'visibility', "TEXT NOT NULL DEFAULT 'private'")
}

/** 旧结构判定：旧应用域表 / 已删除的原型模板表 / 已删除的应用列 */
function hasLegacyShape(db: Database.Database, existing: string[]): boolean {
  if (LEGACY_TABLES.some(table => existing.includes(table))) return true
  if (OBSOLETE_TABLES.some(table => existing.includes(table))) return true
  if (!existing.includes('apps')) return false
  const columns = tableColumns(db, 'apps')
  return OBSOLETE_APP_COLUMNS.some(column => columns.includes(column))
}

function dropAll(db: Database.Database, tables: string[]): string[] {
  const dropped: string[] = []
  db.pragma('foreign_keys = OFF')
  try {
    for (const table of tables) {
      db.exec(`DROP TABLE IF EXISTS ${table}`)
      dropped.push(table)
    }
  } finally {
    db.pragma('foreign_keys = ON')
  }
  return dropped
}

/**
 * 启动升级（幂等）。
 *
 * @throws 旧结构且 apps 非空时抛错（调用方应让进程退出，不做静默迁移）
 */
export function migrateDatabase(db: Database.Database): MigrationResult {
  const existing = tableNames(db)
  const hasLegacy = hasLegacyShape(db, existing)

  if (!hasLegacy) {
    const existed = NEW_TABLES.some(table => existing.includes(table))
    createSchema(db)
    return { action: existed ? 'noop' : 'created', dropped: [] }
  }

  let appCount = 0
  if (existing.includes('apps')) {
    const row = db.prepare('SELECT COUNT(*) AS count FROM apps').get() as { count: number } | undefined
    appCount = row?.count ?? 0
  }
  if (appCount > 0) {
    throw new Error(
      `检测到旧版数据库（${appCount} 个应用），本版不做旧数据兼容。` +
        '请删除应用或重置数据库（删除数据目录下的 requirements.db 等文件）后重启。'
    )
  }

  // 重建：只删除非保留表；需求模板库（PRESERVED_TABLES）原样保留
  const preserved = new Set<string>(PRESERVED_TABLES)
  const toDrop = [...new Set([...existing, ...NEW_TABLES])]
    .filter(name => !name.startsWith('sqlite_'))
    .filter(name => !preserved.has(name))
    .sort()
  const dropped = dropAll(db, toDrop)
  createSchema(db)
  return { action: 'rebuilt', dropped }
}
