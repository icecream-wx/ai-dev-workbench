/**
 * 工作台数据落库：SQLite
 *
 * 只保留 4 张表（应用 / 设置 / 会话 / 需求模板），
 * 产物（需求文档、设计、代码）全部是工作区文件，不进数据库。
 *
 * 启动升级见 `db-migrate.ts`：新结构 no-op；旧结构 + 无应用 → 重建；
 * 旧结构 + 有应用 → fail-closed（抛错阻止启动，不做旧数据兼容）。
 */
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config'
import { assertTestDataDirIsolation } from './db-guards'
import { migrateDatabase } from './db-migrate'

export const dataDir = config.dataDir

// MF2：测试进程必须在 import 本模块前把 RG_DATA_DIR 指向临时目录；否则直接抛错，
// 避免 `npm test` 打开仓库真实 data/requirements.db。
assertTestDataDirIsolation(process.env, dataDir)

fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(path.join(dataDir, 'requirements.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const migration = migrateDatabase(db)
if (migration.action === 'rebuilt') {
  console.log(`[db] 旧结构 + 空应用库：已重建为 4 表（删除旧表 ${migration.dropped.length} 张）`)
}

/** 旧版设置键（已无读写方）与旧 LLM 配置（可能含 Key）在启动时清理 */
const LEGACY_SETTING_KEYS = [
  'activeId',
  'scenes',
  'batches',
  'conversation',
  'docTemplate',
  'docTemplates',
  'ui',
  'llm'
]
for (const key of LEGACY_SETTING_KEYS) {
  db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
}
db.prepare(
  "DELETE FROM app_settings WHERE key LIKE 'moduleScene.%' OR key LIKE 'moduleCard.%' OR key LIKE 'moduleBatch.%' OR key LIKE 'moduleVersion.%'"
).run()

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
