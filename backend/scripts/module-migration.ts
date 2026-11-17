/**
 * 需求模块化迁移脚本（M2，#6）
 *
 * 用法：
 *   npx tsx scripts/module-migration.ts --db <path> [--dry-run|--apply] [--allow-live]
 *
 * - 默认 `--dry-run`（只读打开 + 只输出状态，不写库）；
 * - `--apply` 才执行迁移（单事务；失败整批回滚）；
 * - 默认拒绝作用在仓库内真实库 `<repo>/data/requirements.db`；确需真实库时必须显式
 *   同时给 `--allow-live --apply`（真实迁移优先“停服后重启由 db.ts 触发”，本脚本主要用于副本比对）；
 * - 本脚本**不 import** `src/db` / `src/config`，直接用 better-sqlite3 打开指定文件；
 * - 输出只含表名/计数/长度/hash/模块摘要，不打印文档正文、不打印 `.env`/凭据。
 */
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { migrateRequirementModules, moduleMigrationStatus } from '../src/requirements/module-migration'

interface Args {
  db: string | null
  apply: boolean
  allowLive: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { db: null, apply: false, allowLive: false }
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === '--db') {
      args.db = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (current.startsWith('--db=')) {
      args.db = current.slice('--db='.length)
      continue
    }
    if (current === '--apply') {
      args.apply = true
      continue
    }
    if (current === '--dry-run') {
      args.apply = false
      continue
    }
    if (current === '--allow-live') {
      args.allowLive = true
      continue
    }
    if (current === '--help' || current === '-h') {
      printUsage()
      process.exit(0)
    }
    throw new Error(`未知参数：${current}`)
  }
  return args
}

function printUsage(): void {
  console.log('用法：npx tsx scripts/module-migration.ts --db <path> [--dry-run|--apply] [--allow-live]')
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as
    | { name: string }
    | undefined
  return Boolean(row)
}

function countOf(db: Database.Database, table: string): number {
  if (!tableExists(db, table)) return 0
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }
  return row.count
}

/** 只输出计数/长度（不打印业务内容） */
function summary(db: Database.Database): Record<string, unknown> {
  const status = moduleMigrationStatus(db)
  const modules = tableExists(db, 'app_modules')
    ? (db
        .prepare(
          'SELECT module_key, title, required, position, archived_at FROM app_modules ORDER BY app_id, position, module_key'
        )
        .all() as Array<{ module_key: string; title: string; required: number; position: number; archived_at: string | null }>)
    : []
  const bundles = tableExists(db, 'app_requirement_bundles')
    ? (db
        .prepare('SELECT version, bundle_hash, created_at FROM app_requirement_bundles ORDER BY app_id, version')
        .all() as Array<{ version: number; bundle_hash: string; created_at: string }>)
    : []
  return {
    db: {
      status,
      // 设计/交接包/变更单/会话：迁移不应改动（只读计数，供副本比对）
      untouched: {
        designProjects: countOf(db, 'app_design_projects'),
        designEntities: countOf(db, 'app_design_entities'),
        designPageSets: countOf(db, 'app_design_page_sets'),
        designPages: countOf(db, 'app_design_pages'),
        designVersions: countOf(db, 'app_design_versions'),
        designHandoffs: countOf(db, 'design_handoffs'),
        changeSets: countOf(db, 'app_change_sets'),
        appSessions: countOf(db, 'app_sessions')
      },
      apps: countOf(db, 'apps'),
      modules: modules.map(module => ({
        moduleKey: module.module_key,
        titleLength: module.title.length,
        required: module.required === 1,
        position: module.position,
        archived: Boolean(module.archived_at)
      })),
      bundles: bundles.map(bundle => ({
        version: bundle.version,
        hash: bundle.bundle_hash,
        createdAt: bundle.created_at
      }))
    }
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (!args.db) {
    printUsage()
    process.exit(1)
    return
  }
  const dbPath = path.resolve(args.db)
  if (!fs.existsSync(dbPath)) throw new Error(`数据库文件不存在：${dbPath}`)

  const repoDbPath = path.resolve(__dirname, '../../data/requirements.db')
  if (dbPath === repoDbPath && !(args.allowLive && args.apply)) {
    throw new Error(
      '拒绝直接操作仓库内真实数据库 data/requirements.db；请先复制/备份，或显式同时给 --allow-live --apply'
    )
  }

  const readonly = !args.apply
  const database = new Database(dbPath, { readonly, fileMustExist: true })
  try {
    database.pragma('foreign_keys = ON')
    console.log(JSON.stringify({ mode: args.apply ? 'apply' : 'dry-run', before: summary(database) }, null, 2))
    if (!args.apply) {
      console.log(JSON.stringify({ result: { applied: false, reason: 'dry-run（加 --apply 才执行迁移）' } }, null, 2))
      return
    }
    if (moduleMigrationStatus(database).migrated) {
      console.log(JSON.stringify({ result: { applied: false, alreadyMigrated: true } }, null, 2))
      return
    }
    const result = migrateRequirementModules(database)
    console.log(
      JSON.stringify(
        {
          result: {
            applied: true,
            alreadyMigrated: result.alreadyMigrated,
            appsMigrated: result.appsMigrated,
            bundleVersion: result.bundleVersion,
            bundleHashes: result.bundleHashes
          },
          after: summary(database)
        },
        null,
        2
      )
    )
  } finally {
    database.close()
  }
}

try {
  main()
} catch (error) {
  console.error('模块化迁移脚本失败：', error instanceof Error ? error.message : String(error))
  process.exit(1)
}
