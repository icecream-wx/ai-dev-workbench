/**
 * 工作台数据落库：SQLite
 *
 * 表结构：
 * - app_settings   应用设置（key-value：模型/需求文档对话/设计对话等）
 * - apps           应用登记与阶段状态
 * - app_stage_events 阶段事件
 * - app_sessions   开发阶段 opencode 会话登记（active/archived/stale）
 * - app_dev_phases 开发阶段（U7-1：按需生成；一阶段可多会话，标签在 app_sessions.dev_phase_id）
 * - requirement_templates           需求/设计/测试/开发计划模板（内置只读 + 我的模板）
 * - app_modules                     需求模块（M2：一个模块 = 一份完整 PRD；应用创建默认模块）
 * - app_requirement_docs            应用+模块需求文档（content_md 为章节拼接快照）
 * - app_requirement_doc_sections    需求文档章节（唯一事实来源，按 app+module）
 * - app_requirement_doc_versions    需求文档版本（整篇 + 章节快照，按 app+module）
 * - app_requirement_bundles         模块需求聚合快照（M2：模块版本/hash + changeSet）
 * - prototype_templates             页面原型模板（全局库；内置只读 + 我的模板）
 * - app_design_projects             设计项目（一行/应用+模块：原型模板/状态/版本/需求文档版本）
 * - app_design_entities             模块内实体（字段/关系 JSON；ID 全应用唯一）
 * - app_design_page_sets            模块内页面集（按场景/Epic）
 * - app_design_pages                页面规格/布局/确认/图片路径（module_id 与所属页面集一致）
 * - app_design_versions             模块设计版本（实体 + 页面集快照）
 * - app_change_sets                 变更单（D5 起：首次开发 #1）
 * - design_handoffs                 设计 → 开发交接包（版本/hash/文件清单/设计快照）
 *
 * 说明：需求/设计均为文档/结构化章节模式（R1/R4b-2）；旧 P1—P3 的 modules / module_docs /
 * handoffs（structured 需求卡片 + 旧交接包）表已删除。
 *
 * M2（#6）：需求域按模块归属（`module_id`）；旧库在启动时由
 * `requirements/module-migration.ts` 单事务重建三张需求表（旧表保留为 `*_legacy`），
 * 迁移失败会抛错阻止启动（fail-closed）。
 *
 * M4（#6）：设计域按模块归属（`module_id` + 设计项目 PK `(app_id, module_id)`）。
 * 按“不做旧应用数据兼容”政策：目标结构已存在 → no-op；旧结构 + 空库 → 重建空表；
 * 旧结构 + 有应用/设计数据 → 抛错阻止启动（由 `design/module-migration.ts` 处理）。
 *
 * 旧 dev_projects / dev_runs 已随旧开发模块停用并删除（R4a）；新应用/会话表在 P1 建立。
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config'
import {
  MODULE_TABLE_DDL,
  REQUIREMENT_BUNDLE_DDL,
  REQUIREMENT_DOC_TABLE_DDL,
  REQUIREMENT_MODULE_INDEX_DDL,
  backupBeforeMigration,
  migrateRequirementModules
} from './requirements/module-migration'
import {
  DESIGN_MODULE_INDEX_DDL,
  DESIGN_TABLE_DDL,
  ensureDesignModuleSchema
} from './design/module-migration'
import { assertTestDataDirIsolation } from './db-guards'

export const dataDir = config.dataDir

// MF2：测试进程必须在 import 本模块前把 RG_DATA_DIR 指向临时目录；否则直接抛错，
// 避免 `npm test` 打开仓库真实 data/requirements.db（M2 曾因此误迁移真实库）。
assertTestDataDirIsolation(process.env, dataDir)

fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(path.join(dataDir, 'requirements.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS apps (
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

  CREATE TABLE IF NOT EXISTS app_stage_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id     TEXT NOT NULL,
    stage      TEXT NOT NULL,
    event      TEXT NOT NULL,
    detail     TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_app_stage_events_app ON app_stage_events(app_id, created_at);

  CREATE TABLE IF NOT EXISTS app_sessions (
    id                  TEXT PRIMARY KEY,
    app_id              TEXT NOT NULL,
    stage               TEXT NOT NULL,
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

  -- M2：模块 + 需求聚合快照（DDL 与迁移共用，避免新旧库结构漂移）
  ${MODULE_TABLE_DDL}

  ${REQUIREMENT_BUNDLE_DDL}

  -- M2：三张需求表带 module_id（旧库由 module-migration 重建；索引在迁移后创建）
  ${REQUIREMENT_DOC_TABLE_DDL}

  CREATE TABLE IF NOT EXISTS prototype_templates (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    category           TEXT NOT NULL,
    description        TEXT,
    tokens_json        TEXT NOT NULL,
    shell_json         TEXT NOT NULL,
    patterns_json      TEXT NOT NULL,
    page_set_rules_json TEXT NOT NULL,
    prompt             TEXT NOT NULL,
    builtin            INTEGER NOT NULL DEFAULT 0,
    visibility         TEXT NOT NULL DEFAULT 'private',
    preview_path       TEXT,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_prototype_templates_category ON prototype_templates(category, builtin);

  -- M4：设计六表带 module_id（目标结构；旧库由 design/module-migration 处理）
  ${DESIGN_TABLE_DDL}

  CREATE TABLE IF NOT EXISTS app_change_sets (
    id                          TEXT PRIMARY KEY,
    app_id                      TEXT NOT NULL,
    seq                         INTEGER NOT NULL,
    title                       TEXT NOT NULL,
    description                 TEXT,
    scope                       TEXT NOT NULL,
    status                      TEXT NOT NULL,
    base_requirements_version   INTEGER,
    base_design_version         INTEGER,
    base_handoff_version        INTEGER,
    base_input_id               TEXT,
    current_requirements_version INTEGER,
    current_design_version      INTEGER,
    current_handoff_version     INTEGER,
    base_app_status             TEXT,
    base_completed_at           TEXT,
    base_change_set_id          TEXT,
    base_session_id             TEXT,
    changes_md                  TEXT,
    summary_json                TEXT,
    created_at                  TEXT NOT NULL,
    updated_at                  TEXT NOT NULL,
    completed_at                TEXT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_change_sets_app_seq ON app_change_sets(app_id, seq);
  CREATE INDEX IF NOT EXISTS idx_change_sets_app_status ON app_change_sets(app_id, status);

  -- M5：变更单模块范围（无迁移；旧库直接建表，旧变更单没有模块行）
  CREATE TABLE IF NOT EXISTS app_change_set_modules (
    change_set_id            TEXT NOT NULL,
    module_id                TEXT NOT NULL,
    req_base_version         INTEGER,
    req_base_hash            TEXT,
    req_current_version      INTEGER,
    req_current_hash         TEXT,
    design_base_version      INTEGER,
    design_base_hash         TEXT,
    design_base_template_id  TEXT,
    design_current_version   INTEGER,
    design_current_hash      TEXT,
    created_at               TEXT NOT NULL,
    updated_at               TEXT NOT NULL,
    PRIMARY KEY(change_set_id, module_id)
  );

  CREATE INDEX IF NOT EXISTS idx_cs_modules_change_set ON app_change_set_modules(change_set_id);

  CREATE TABLE IF NOT EXISTS design_handoffs (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id                   TEXT NOT NULL,
    version                  INTEGER NOT NULL,
    hash                     TEXT NOT NULL,
    docs_dir                 TEXT NOT NULL,
    files_json               TEXT NOT NULL,
    change_set_id            TEXT,
    baseline_handoff_version INTEGER,
    source_design_json       TEXT NOT NULL,
    source_requirements_json TEXT NOT NULL,
    manifest_json            TEXT NOT NULL,
    created_at               TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_design_handoffs_app_version
    ON design_handoffs(app_id, version);

  CREATE TABLE IF NOT EXISTS app_dev_phases (
    id              TEXT PRIMARY KEY,
    app_id          TEXT NOT NULL,
    change_set_id   TEXT,
    handoff_version INTEGER NOT NULL,
    phase_key       TEXT NOT NULL,
    title           TEXT NOT NULL,
    goal            TEXT,
    scope_json      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'not_started',
    summary         TEXT,
    summary_source  TEXT,
    started_at      TEXT,
    completed_at    TEXT,
    ord             INTEGER NOT NULL,
    module_id       TEXT,
    parent_key      TEXT,
    phase_kind      TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    UNIQUE(app_id, handoff_version, phase_key)
  );

  CREATE INDEX IF NOT EXISTS idx_dev_phases_app ON app_dev_phases(app_id, handoff_version, ord);
`)

// R4b-2：旧 structured 需求（modules/module_docs）与旧 P3 交接包（handoffs）已移除。
// 旧库升级时直接 drop；module_docs 先删（外键指向 modules）。
db.exec('DROP TABLE IF EXISTS module_docs')
db.exec('DROP TABLE IF EXISTS modules')
db.exec('DROP TABLE IF EXISTS handoffs')

/** 旧库补列（H1/H2）：列名来自代码内常量，不接受外部输入 */
function ensureColumn(table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (columns.some(item => item.name === column)) return
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  } catch (error) {
    if (!/duplicate column/i.test(error instanceof Error ? error.message : String(error))) throw error
  }
}

ensureColumn('app_requirement_doc_sections', 'data_json', 'TEXT')
ensureColumn('app_design_projects', 'source_input_id', 'TEXT')
ensureColumn('app_design_projects', 'source_input_hash', 'TEXT')
ensureColumn('app_design_entities', 'requirement_refs_json', 'TEXT')
ensureColumn('app_design_entities', 'source_sections_json', 'TEXT')
ensureColumn('app_design_page_sets', 'epic_id', 'TEXT')
ensureColumn('app_design_page_sets', 'story_ids_json', 'TEXT')
ensureColumn('app_design_pages', 'requirement_refs_json', 'TEXT')
// D5：交接包/变更单归属
ensureColumn('apps', 'current_change_set_id', 'TEXT')
ensureColumn('app_sessions', 'change_set_id', 'TEXT')
ensureColumn('app_sessions', 'handoff_version', 'INTEGER')
ensureColumn('app_sessions', 'handoff_hash', 'TEXT')
// I-10：工作台会话标题/备注
ensureColumn('app_sessions', 'title', 'TEXT')
ensureColumn('app_sessions', 'note', 'TEXT')
// #7：创建应用时选择的需求/设计原型模板（旧应用为 null，读取时回退默认）
ensureColumn('apps', 'requirement_template_id', 'TEXT')
ensureColumn('apps', 'prototype_template_id', 'TEXT')
// U7-1：会话所属开发阶段（旧会话为 null）
ensureColumn('app_sessions', 'dev_phase_id', 'TEXT')
db.exec('CREATE INDEX IF NOT EXISTS idx_app_sessions_phase ON app_sessions(dev_phase_id)')
// M6b：模块 + Epic 两层阶段（无回填；旧行 phase_kind=null 视为可执行原 kind）
ensureColumn('app_dev_phases', 'module_id', 'TEXT')
ensureColumn('app_dev_phases', 'parent_key', 'TEXT')
ensureColumn('app_dev_phases', 'phase_kind', 'TEXT')
// C1：变更单基线/摘要与版本归属
ensureColumn('app_change_sets', 'base_app_status', 'TEXT')
ensureColumn('app_change_sets', 'base_completed_at', 'TEXT')
ensureColumn('app_change_sets', 'base_change_set_id', 'TEXT')
ensureColumn('app_change_sets', 'base_session_id', 'TEXT')
ensureColumn('app_change_sets', 'changes_md', 'TEXT')
ensureColumn('app_change_sets', 'summary_json', 'TEXT')
ensureColumn('app_requirement_doc_versions', 'change_set_id', 'TEXT')
ensureColumn('app_design_inputs', 'change_set_id', 'TEXT')
ensureColumn('app_design_versions', 'change_set_id', 'TEXT')

// M2（#6）：需求域按模块归属。旧库在这里单事务重建三张需求表（旧表保留为 *_legacy）；
// 已迁移/新库为幂等空操作。失败必须抛错阻止启动（fail-closed，不静默降级）。
// MF1：旧库迁移前先做可回滚备份（VACUUM INTO，WAL 下一致）；失败同样阻止启动。
const migrationBackup = backupBeforeMigration(db, dataDir)
if (migrationBackup.path) {
  console.log('[db] 迁移前已备份需求库：', migrationBackup.path)
}
migrateRequirementModules(db)
// 依赖 module_id 的索引在迁移之后创建（旧库迁移前还没有该列）
db.exec(REQUIREMENT_MODULE_INDEX_DDL)

// M4（#6）：设计域按模块归属（无旧数据迁移）。目标结构 no-op；旧结构 + 空库重建；
// 旧结构 + 有应用/设计数据直接抛错阻止启动（fail-closed，不建 *_legacy、不写回填）。
ensureDesignModuleSchema(db)
db.exec(DESIGN_MODULE_INDEX_DDL)

// R4b-2：应用固定为文档模式，移除旧的 requirements_mode 列。
// SQLite 3.35+ 支持 DROP COLUMN；失败时保留列但代码不再引用（不阻塞启动）。
const appColumns = db.prepare('PRAGMA table_info(apps)').all() as Array<{ name: string }>
if (appColumns.some(column => column.name === 'requirements_mode')) {
  try {
    db.exec('ALTER TABLE apps DROP COLUMN requirements_mode')
  } catch (error) {
    console.warn('[db] 无法删除 apps.requirements_mode 列（SQLite 版本过低？），列会被保留但不再使用：', (error as Error).message)
  }
}

// R4b-2：旧全局/模块级设置键（workspace/modules/settings 路由已删除）不再有读写方，直接清理
const LEGACY_SETTING_KEYS = ['activeId', 'scenes', 'batches', 'conversation', 'docTemplate', 'docTemplates', 'ui']
for (const key of LEGACY_SETTING_KEYS) {
  db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
}
db.prepare("DELETE FROM app_settings WHERE key LIKE 'moduleScene.%' OR key LIKE 'moduleCard.%' OR key LIKE 'moduleBatch.%' OR key LIKE 'moduleVersion.%'").run()

// P2：需求/设计/任务统一走 opencode，不再保留旧的 OpenAI 兼容 LLM 配置（可能含 Key）
db.prepare("DELETE FROM app_settings WHERE key = 'llm'").run()

export function nowIso(): string {
  return new Date().toISOString()
}

export function readSetting<T>(key: string): T | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.value) as T
  } catch {
    return null
  }
}

export function writeSetting(key: string, value: unknown): void {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value ?? null), nowIso())
}
