/**
 * 需求模块化迁移（M2）：旧单文档需求表 → 带 module_id 的目标结构
 *
 * 背景（#6 / M2）：
 * - 需求文档从“一行/应用”升级为“一行/应用+模块”；
 * - `app_requirement_docs` / `app_requirement_doc_sections` / `app_requirement_doc_versions`
 *   必须重建主键/唯一索引（SQLite 无法直接改 PK）：新表 `*_new` → 显式 copy → 旧表改名
 *   `*_legacy`（**保留**）→ 新表改名接管 → 建新索引；
 * - 同时新建 `app_modules`（模块）与 `app_requirement_bundles`（模块需求聚合快照）。
 *
 * 约束：
 * - 本模块**不 import `../db`**（避免与 db.ts 循环依赖）；所有函数接收 better-sqlite3 的
 *   `Database` 实例，db.ts 在启动时调用一次，脚本 `scripts/module-migration.ts` 也直接复用；
 * - 幂等：`PRAGMA table_info(app_requirement_docs)` 含 `module_id` 即视为已迁移并直接返回，
 *   不会重复建模块/改名/插 bundle；
 * - 单事务（`database.transaction()`）：失败整批回滚并抛出带表名/阶段的信息，由调用方
 *   fail-closed（db.ts 抛错阻止启动）；
 * - 迁移范围只限三张需求表 + `app_modules` + `app_requirement_bundles`；
 *   不碰设计/交接包/变更单/会话/开发阶段表，也不写 `app_stage_events`；
 * - 旧索引名（`idx_requirement_doc_sections_app`、`idx_requirement_doc_versions_app_version`）
 *   不删除、不复用：SQLite 索引名全局唯一，表改名后它们仍归属 `*_legacy` 表，保留用于回滚；
 *   新索引统一换名（`idx_req_*`），因此无需 DROP 旧索引。
 *
 * 固定哈希算法（与 M5 的设计输入 docHash 语义不同，后续再对齐）：
 * - `docHash = sha256(content_md)`（hex 小写）；
 * - `bundleHash = sha256(JSON.stringify(entries))`，entries 按 (position, module_key) 排序，
 *   每条固定只取 `moduleId, moduleKey, docVersion, docHash, confirmed`（**不含 title**）。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type DatabaseType from 'better-sqlite3'

type SqliteDatabase = DatabaseType.Database

/** 模块需求 bundle 里的单模块条目（落库时含 title；参与 hash 时去掉 title） */
export interface RequirementBundleModuleEntry {
  moduleId: string
  moduleKey: string
  title: string
  docVersion: number
  docHash: string
  confirmed: boolean
}

export type RequirementBundleHashEntry = Omit<RequirementBundleModuleEntry, 'title'>

export function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

/** bundle 聚合 hash：字段固定、顺序即入参顺序（调用方需先按 position/module_key 排序） */
export function bundleHashOfModules(entries: RequirementBundleHashEntry[]): string {
  const normalized = entries.map(entry => ({
    moduleId: entry.moduleId,
    moduleKey: entry.moduleKey,
    docVersion: entry.docVersion,
    docHash: entry.docHash,
    confirmed: entry.confirmed
  }))
  return sha256Hex(JSON.stringify(normalized))
}

/**
 * 目标结构 DDL（db.ts 与迁移共用，保证新库/旧库结果一致）。
 * 注意：依赖 `module_id` 的索引单独导出，db.ts 在迁移之后创建（旧库迁移前还不存在该列）。
 */
export const MODULE_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS app_modules (
    id          TEXT PRIMARY KEY,
    app_id      TEXT NOT NULL,
    module_key  TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    owner_label TEXT,
    required    INTEGER NOT NULL DEFAULT 1,
    position    INTEGER NOT NULL,
    archived_at TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE(app_id, module_key)
  );
`

export const REQUIREMENT_BUNDLE_DDL = `
  CREATE TABLE IF NOT EXISTS app_requirement_bundles (
    id            TEXT PRIMARY KEY,
    app_id        TEXT NOT NULL,
    version       INTEGER NOT NULL,
    modules_json  TEXT NOT NULL,
    bundle_hash   TEXT NOT NULL,
    change_set_id TEXT,
    created_at    TEXT NOT NULL,
    UNIQUE(app_id, version)
  );
`

/** 三张需求表的目标结构（无索引；索引见 REQUIREMENT_MODULE_INDEX_DDL） */
export const REQUIREMENT_DOC_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS app_requirement_docs (
    app_id       TEXT NOT NULL,
    module_id    TEXT NOT NULL,
    template_id  TEXT NOT NULL,
    title        TEXT NOT NULL,
    content_md   TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'draft',
    version      INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    confirmed_at TEXT,
    PRIMARY KEY (app_id, module_id)
  );

  CREATE TABLE IF NOT EXISTS app_requirement_doc_sections (
    app_id      TEXT NOT NULL,
    module_id   TEXT NOT NULL,
    section_key TEXT NOT NULL,
    title       TEXT NOT NULL,
    level       INTEGER NOT NULL DEFAULT 2,
    kind        TEXT NOT NULL,
    markdown    TEXT NOT NULL,
    data_json   TEXT,
    required    INTEGER NOT NULL DEFAULT 0,
    position    INTEGER NOT NULL,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (app_id, module_id, section_key)
  );

  CREATE TABLE IF NOT EXISTS app_requirement_doc_versions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id        TEXT NOT NULL,
    module_id     TEXT NOT NULL,
    version       INTEGER NOT NULL,
    template_id   TEXT NOT NULL,
    content_md    TEXT NOT NULL,
    sections_json TEXT NOT NULL,
    source        TEXT NOT NULL,
    change_set_id TEXT,
    created_at    TEXT NOT NULL
  );
`

/**
 * 迁移后创建的索引（新名字；不与 legacy 表上的旧索引名冲突）。
 * db.ts 在 `migrateRequirementModules` 之后执行一次。
 */
export const REQUIREMENT_MODULE_INDEX_DDL = `
  CREATE INDEX IF NOT EXISTS idx_modules_app ON app_modules(app_id, position);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_req_bundles_app_version ON app_requirement_bundles(app_id, version);
  CREATE INDEX IF NOT EXISTS idx_req_docs_app_module ON app_requirement_docs(app_id, module_id);
  CREATE INDEX IF NOT EXISTS idx_req_sections_app_module ON app_requirement_doc_sections(app_id, module_id, position);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_req_versions_app_module_version
    ON app_requirement_doc_versions(app_id, module_id, version);
`

const LEGACY_INDEX_NAMES = ['idx_requirement_doc_sections_app', 'idx_requirement_doc_versions_app_version'] as const
const LEGACY_TABLES = [
  'app_requirement_docs',
  'app_requirement_doc_sections',
  'app_requirement_doc_versions'
] as const

export interface ModuleMigrationStatus {
  /** 目标结构是否就绪（app_requirement_docs 有 module_id） */
  migrated: boolean
  tables: {
    modules: boolean
    bundles: boolean
    docs: boolean
    sections: boolean
    versions: boolean
    legacyDocs: boolean
    legacySections: boolean
    legacyVersions: boolean
  }
  /** 目标表行数（表不存在时为 0） */
  counts: {
    modules: number
    bundles: number
    docs: number
    sections: number
    versions: number
  }
  /** 旧表行数（未迁移时为 0；迁移后用于核对未丢数据） */
  legacyCounts: {
    docs: number
    sections: number
    versions: number
  }
  /** 旧索引名（迁移后应只出现在 legacy 表上，新表使用 idx_req_*） */
  legacyIndexes: string[]
  /** 目标表上的索引名 */
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
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.map(row => row.name)
}

function countOf(database: SqliteDatabase, table: string): number {
  if (!tableExists(database, table)) return 0
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }
  return row.count
}

function indexNamesOf(database: SqliteDatabase, table: string): string[] {
  if (!tableExists(database, table)) return []
  const rows = database.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string }>
  return rows.map(row => row.name)
}

/** 旧库可能缺少后加的列（C1 的 change_set_id / H1 的 data_json）：先补列再 copy */
function ensureLegacyColumn(database: SqliteDatabase, table: string, column: string, definition: string): void {
  if (tableColumns(database, table).includes(column)) return
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

/** 只读状态检查（可对真实库/副本运行；不做任何写入） */
export function moduleMigrationStatus(database: SqliteDatabase): ModuleMigrationStatus {
  const tables = {
    modules: tableExists(database, 'app_modules'),
    bundles: tableExists(database, 'app_requirement_bundles'),
    docs: tableExists(database, 'app_requirement_docs'),
    sections: tableExists(database, 'app_requirement_doc_sections'),
    versions: tableExists(database, 'app_requirement_doc_versions'),
    legacyDocs: tableExists(database, 'app_requirement_docs_legacy'),
    legacySections: tableExists(database, 'app_requirement_doc_sections_legacy'),
    legacyVersions: tableExists(database, 'app_requirement_doc_versions_legacy')
  }
  const legacyIndexes = new Set<string>()
  for (const table of ['app_requirement_docs', 'app_requirement_doc_sections', 'app_requirement_doc_versions',
    'app_requirement_docs_legacy', 'app_requirement_doc_sections_legacy', 'app_requirement_doc_versions_legacy']) {
    for (const name of indexNamesOf(database, table)) {
      if ((LEGACY_INDEX_NAMES as readonly string[]).includes(name)) legacyIndexes.add(name)
    }
  }
  const indexes = new Set<string>()
  for (const table of ['app_modules', 'app_requirement_bundles', 'app_requirement_docs',
    'app_requirement_doc_sections', 'app_requirement_doc_versions']) {
    for (const name of indexNamesOf(database, table)) {
      if (!(LEGACY_INDEX_NAMES as readonly string[]).includes(name)) indexes.add(name)
    }
  }
  return {
    migrated: tableColumns(database, 'app_requirement_docs').includes('module_id'),
    tables,
    counts: {
      modules: countOf(database, 'app_modules'),
      bundles: countOf(database, 'app_requirement_bundles'),
      docs: countOf(database, 'app_requirement_docs'),
      sections: countOf(database, 'app_requirement_doc_sections'),
      versions: countOf(database, 'app_requirement_doc_versions')
    },
    legacyCounts: {
      docs: countOf(database, 'app_requirement_docs_legacy'),
      sections: countOf(database, 'app_requirement_doc_sections_legacy'),
      versions: countOf(database, 'app_requirement_doc_versions_legacy')
    },
    legacyIndexes: Array.from(legacyIndexes).sort(),
    indexes: Array.from(indexes).filter(name => !name.startsWith('sqlite_autoindex')).sort()
  }
}

export interface ModuleMigrationResult extends ModuleMigrationStatus {
  /** 本次调用是否发现“已迁移”而跳过（幂等） */
  alreadyMigrated: boolean
  /** 本次迁移涉及的应用数（有需求文档的应用） */
  appsMigrated: number
  /** 本次生成的 bundle 版本（无文档应用不生成） */
  bundleVersion: number | null
  /** 本次生成 bundle 的聚合 hash（无文档应用为 null） */
  bundleHashes: Array<{ appId: string; version: number; hash: string; moduleCount: number }>
}

export interface MigrationBackupOptions {
  /** 固定时间戳 `YYYYMMDD-HHmmss`（UTC；测试可注入，避免依赖当前时间） */
  timestamp?: string
  /** 固定文件名（测试可注入；优先级高于 timestamp；缺少 `.bak` 时自动补） */
  fileName?: string
}

export interface MigrationBackupResult {
  /** 备份文件绝对路径；跳过时为 null */
  path: string | null
  /** 跳过原因；执行备份时为 null */
  skipped: string | null
  /** 备份文件字节数；跳过时为 0 */
  bytes: number
}

/** 备份文件名时间戳：UTC（固定一种，避免时区差异导致同名判断不稳定） */
function backupTimestamp(date: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(
    date.getUTCHours()
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
}

/**
 * 迁移前自动备份（MF1）：任何旧库迁移都先有可回滚备份，失败不留半成品。
 *
 * - 已迁移（docs 有 `module_id`）/ 没有 `app_requirement_docs` 表 / 表为空 → `{ path: null, skipped }`，
 *   **不写文件**；
 * - 否则用同步 `VACUUM INTO` 生成 `requirements.db.pre-modules-<YYYYMMDD-HHmmss>.bak`
 *   （SQLite 3.27+；WAL 下取一致性快照，无需停写；不能放在事务内，因此必须在 `migrateRequirementModules`
 *   **之前**调用）；同名已存在时依次加 `-2`/`-3`，绝不覆盖；
 * - 生成后校验文件存在且 `size > 0`，否则抛错（由调用方 fail-closed，不得继续迁移）；
 * - 只使用文件系统与 SQL 计数，不读取/打印文档正文；本模块不 import `../db`。
 */
export function backupBeforeMigration(
  database: SqliteDatabase,
  dataDir: string,
  options: MigrationBackupOptions = {}
): MigrationBackupResult {
  if (tableColumns(database, 'app_requirement_docs').includes('module_id')) {
    return { path: null, skipped: '已迁移（app_requirement_docs 已有 module_id）', bytes: 0 }
  }
  if (!tableExists(database, 'app_requirement_docs')) {
    return { path: null, skipped: '没有 app_requirement_docs 表（新库/空库）', bytes: 0 }
  }
  if (countOf(database, 'app_requirement_docs') === 0) {
    return { path: null, skipped: 'app_requirement_docs 为空', bytes: 0 }
  }

  const directory = path.resolve(dataDir)
  fs.mkdirSync(directory, { recursive: true })
  const requested = options.fileName ?? `requirements.db.pre-modules-${options.timestamp ?? backupTimestamp()}.bak`
  const base = requested.toLowerCase().endsWith('.bak') ? requested : `${requested}.bak`
  const stem = base.slice(0, -'.bak'.length)
  let fileName = base
  let suffix = 2
  while (fs.existsSync(path.join(directory, fileName))) {
    fileName = `${stem}-${suffix}.bak`
    suffix += 1
  }

  const target = path.join(directory, fileName)
  // VACUUM INTO 的目标是 SQL 字符串字面量：单引号按 SQL 规则双写转义
  const escaped = target.replace(/'/g, "''")
  database.exec(`VACUUM INTO '${escaped}'`)
  const stat = fs.statSync(target)
  if (!stat.isFile() || stat.size <= 0) {
    throw new Error(`迁移前备份失败：备份文件为空或不存在：${target}`)
  }
  return { path: target, skipped: null, bytes: stat.size }
}

interface LegacyDocRow {
  app_id: string
  template_id: string
  title: string
  content_md: string
  status: string
  version: number
  created_at: string
  updated_at: string
  confirmed_at: string | null
}

interface AppRow {
  id: string
  name: string
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * 迁移入口（幂等、单事务）。
 *
 * 已迁移：直接返回状态（alreadyMigrated=true），不写库。
 * 未迁移且没有需求表（全新库由 db.ts 建表）：建目标结构后返回。
 */
export function migrateRequirementModules(database: SqliteDatabase): ModuleMigrationResult {
  if (tableColumns(database, 'app_requirement_docs').includes('module_id')) {
    return { ...moduleMigrationStatus(database), alreadyMigrated: true, appsMigrated: 0, bundleVersion: null, bundleHashes: [] }
  }

  const hasLegacyDocs = tableExists(database, 'app_requirement_docs')
  if (!hasLegacyDocs) {
    database.exec(`${MODULE_TABLE_DDL}${REQUIREMENT_BUNDLE_DDL}${REQUIREMENT_DOC_TABLE_DDL}${REQUIREMENT_MODULE_INDEX_DDL}`)
    return { ...moduleMigrationStatus(database), alreadyMigrated: false, appsMigrated: 0, bundleVersion: null, bundleHashes: [] }
  }

  for (const table of LEGACY_TABLES) {
    if (tableExists(database, `${table}_legacy`)) {
      throw new Error(`需求模块化迁移中止：${table}_legacy 已存在。请人工确认旧库状态（不要删除旧表），再重试。`)
    }
    if (tableExists(database, `${table}_new`)) {
      throw new Error(`需求模块化迁移中止：${table}_new 已存在（上次迁移可能未回滚干净），请人工确认后再重试。`)
    }
  }

  const appsMigratedIds: string[] = []
  const bundleHashes: Array<{ appId: string; version: number; hash: string; moduleCount: number }> = []

  const tx = database.transaction(() => {
    // 1) 模块/聚合表 + 目标结构新表
    database.exec(`${MODULE_TABLE_DDL}${REQUIREMENT_BUNDLE_DDL}${REQUIREMENT_DOC_TABLE_DDL}`)
    database.exec(`
      CREATE TABLE app_requirement_docs_new (
        app_id       TEXT NOT NULL,
        module_id    TEXT NOT NULL,
        template_id  TEXT NOT NULL,
        title        TEXT NOT NULL,
        content_md   TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'draft',
        version      INTEGER NOT NULL DEFAULT 1,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        confirmed_at TEXT,
        PRIMARY KEY (app_id, module_id)
      );
      CREATE TABLE app_requirement_doc_sections_new (
        app_id      TEXT NOT NULL,
        module_id   TEXT NOT NULL,
        section_key TEXT NOT NULL,
        title       TEXT NOT NULL,
        level       INTEGER NOT NULL DEFAULT 2,
        kind        TEXT NOT NULL,
        markdown    TEXT NOT NULL,
        data_json   TEXT,
        required    INTEGER NOT NULL DEFAULT 0,
        position    INTEGER NOT NULL,
        updated_at  TEXT NOT NULL,
        PRIMARY KEY (app_id, module_id, section_key)
      );
      CREATE TABLE app_requirement_doc_versions_new (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id        TEXT NOT NULL,
        module_id     TEXT NOT NULL,
        version       INTEGER NOT NULL,
        template_id   TEXT NOT NULL,
        content_md    TEXT NOT NULL,
        sections_json TEXT NOT NULL,
        source        TEXT NOT NULL,
        change_set_id TEXT,
        created_at    TEXT NOT NULL
      );
    `)

    ensureLegacyColumn(database, 'app_requirement_doc_sections', 'data_json', 'TEXT')
    ensureLegacyColumn(database, 'app_requirement_doc_versions', 'change_set_id', 'TEXT')

    // 2) 逐应用建默认模块 + copy（只给“已有需求文档行”的应用建默认模块）
    const appIds = (
      database.prepare('SELECT DISTINCT app_id FROM app_requirement_docs ORDER BY app_id').all() as Array<{ app_id: string }>
    ).map(row => row.app_id)
    const now = nowIso()

    for (const appId of appIds) {
      const app = database.prepare('SELECT id, name FROM apps WHERE id = ?').get(appId) as AppRow | undefined
      const appName = app?.name ?? appId
      const existing = database
        .prepare("SELECT id FROM app_modules WHERE app_id = ? AND module_key = 'MOD-001'")
        .get(appId) as { id: string } | undefined
      const moduleId = existing?.id ?? crypto.randomUUID()
      if (!existing) {
        database.prepare(`
          INSERT INTO app_modules
            (id, app_id, module_key, title, description, owner_label, required, position, archived_at, created_at, updated_at)
          VALUES (?, ?, 'MOD-001', ?, NULL, NULL, 1, 0, NULL, ?, ?)
        `).run(moduleId, appId, appName, now, now)
      }

      const insertedDocs = database.prepare(`
        INSERT INTO app_requirement_docs_new
          (app_id, module_id, template_id, title, content_md, status, version, created_at, updated_at, confirmed_at)
        SELECT app_id, ?, template_id, title, content_md, status, version, created_at, updated_at, confirmed_at
        FROM app_requirement_docs WHERE app_id = ?
      `).run(moduleId, appId)
      database.prepare(`
        INSERT INTO app_requirement_doc_sections_new
          (app_id, module_id, section_key, title, level, kind, markdown, data_json, required, position, updated_at)
        SELECT app_id, ?, section_key, title, level, kind, markdown, data_json, required, position, updated_at
        FROM app_requirement_doc_sections WHERE app_id = ?
      `).run(moduleId, appId)
      // 版本表显式保留 id（AUTOINCREMENT 主键）；sqlite_sequence 会随显式最大值推进
      database.prepare(`
        INSERT INTO app_requirement_doc_versions_new
          (id, app_id, module_id, version, template_id, content_md, sections_json, source, change_set_id, created_at)
        SELECT id, app_id, ?, version, template_id, content_md, sections_json, source, change_set_id, created_at
        FROM app_requirement_doc_versions WHERE app_id = ?
      `).run(moduleId, appId)

      appsMigratedIds.push(appId)
      if (insertedDocs.changes !== 1) {
        throw new Error(`需求模块化迁移失败：应用 ${appId} 的文档行数为 ${insertedDocs.changes}，期望 1（迁移不合并多行，请人工确认）`)
      }
    }

    // 3) 旧表改名保留 → 新表接管
    for (const table of LEGACY_TABLES) database.exec(`ALTER TABLE ${table} RENAME TO ${table}_legacy`)
    for (const table of LEGACY_TABLES) database.exec(`ALTER TABLE ${table}_new RENAME TO ${table}`)
    database.exec(REQUIREMENT_MODULE_INDEX_DDL)

    // 4) 每个应用生成需求 bundle v1（当前文档快照；change_set_id=NULL）
    for (const appId of appsMigratedIds) {
      const bundle = buildBundleSnapshot(database, appId)
      bundleHashes.push(bundle)
    }
  })

  try {
    tx()
  } catch (error) {
    throw new Error(
      `需求模块化迁移失败（已回滚，旧表未改动）：${error instanceof Error ? error.message : String(error)}`
    )
  }

  const status = moduleMigrationStatus(database)
  return {
    ...status,
    alreadyMigrated: false,
    appsMigrated: appsMigratedIds.length,
    bundleVersion: appsMigratedIds.length ? 1 : null,
    bundleHashes
  }
}

interface BundleModuleRow {
  id: string
  module_key: string
  title: string
  position: number
  doc_version: number | null
  content_md: string | null
  status: string | null
}

/**
 * 为一个应用生成 v1 bundle（迁移专用：只读当前非归档模块 + 文档，按 (position, module_key) 排序）。
 * 返回值只含版本/hash/模块数，供脚本输出（不打印正文）。
 */
function buildBundleSnapshot(
  database: SqliteDatabase,
  appId: string
): { appId: string; version: number; hash: string; moduleCount: number } {
  const rows = database
    .prepare(`
      SELECT m.id, m.module_key, m.title, m.position, d.version AS doc_version, d.content_md, d.status
      FROM app_modules m
      LEFT JOIN app_requirement_docs d ON d.app_id = m.app_id AND d.module_id = m.id
      WHERE m.app_id = ? AND m.archived_at IS NULL
      ORDER BY m.position ASC, m.module_key ASC
    `)
    .all(appId) as BundleModuleRow[]

  const entries: RequirementBundleModuleEntry[] = rows.map(row => ({
    moduleId: row.id,
    moduleKey: row.module_key,
    title: row.title,
    docVersion: row.doc_version ?? 0,
    docHash: row.content_md === null ? '' : sha256Hex(row.content_md),
    confirmed: row.status === 'confirmed'
  }))
  const hash = bundleHashOfModules(entries)
  const version = 1
  const existing = database
    .prepare('SELECT id FROM app_requirement_bundles WHERE app_id = ? AND version = ?')
    .get(appId, version) as { id: string } | undefined
  if (!existing) {
    database.prepare(`
      INSERT INTO app_requirement_bundles (id, app_id, version, modules_json, bundle_hash, change_set_id, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?)
    `).run(`reqb-${crypto.randomUUID()}`, appId, version, JSON.stringify(entries), hash, nowIso())
  }
  return { appId, version, hash, moduleCount: entries.length }
}
