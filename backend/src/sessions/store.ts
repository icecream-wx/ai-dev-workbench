/**
 * 应用会话登记（`app_sessions`）读写
 *
 * 每个视图（requirements / design / development）各自一个活跃会话 + 历史。
 * 会话是可丢弃的工作记忆：产物事实源是工作区文件。
 */
import { randomUUID } from 'node:crypto'
import { db, nowIso } from '../db'

export type AppView = 'requirements' | 'design' | 'development'

/**
 * 会话视图：应用三视图 + 模板工作室（P7-7b）。
 * - `AppView` 保持三值：应用 chat/model 路由继续用 `isAppView`（拒绝 template）；
 * - `app_sessions.view` 是 TEXT，`template` 只是新值，不改表/不迁移。
 */
export type SessionView = AppView | 'template'

export const APP_VIEWS: AppView[] = ['requirements', 'design', 'development']

export const SESSION_VIEWS: SessionView[] = ['requirements', 'design', 'development', 'template']

export function isAppView(value: unknown): value is AppView {
  return value === 'requirements' || value === 'design' || value === 'development'
}

export function isSessionView(value: unknown): value is SessionView {
  return isAppView(value) || value === 'template'
}

export interface AppSessionRow {
  id: string
  app_id: string
  stage: string | null
  view: string | null
  opencode_session_id: string | null
  provider_id: string | null
  model_id: string | null
  status: string
  title: string | null
  note: string | null
  created_at: string
  updated_at: string
  last_active_at: string | null
}

/** 会话所属视图（旧库未回填 view → 视为开发视图；template 返回自身） */
export function viewOf(row: AppSessionRow): SessionView {
  if (isSessionView(row.view)) return row.view
  return 'development'
}

/** 当前活跃会话（按视图；旧行 view 为 NULL 时按 development 处理） */
export function activeSessionRow(appId: string, view: SessionView): AppSessionRow | undefined {
  return db
    .prepare(
      `SELECT * FROM app_sessions
       WHERE app_id = ? AND status = 'active' AND (view = ? OR (view IS NULL AND ? = 'development'))
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(appId, view, view) as AppSessionRow | undefined
}

export function listSessionRows(appId: string, view?: SessionView): AppSessionRow[] {
  if (view) {
    return db
      .prepare(
        `SELECT * FROM app_sessions
         WHERE app_id = ? AND (view = ? OR (view IS NULL AND ? = 'development'))
         ORDER BY created_at DESC`
      )
      .all(appId, view, view) as AppSessionRow[]
  }
  return db.prepare('SELECT * FROM app_sessions WHERE app_id = ? ORDER BY created_at DESC').all(appId) as AppSessionRow[]
}

export function sessionRowById(id: string): AppSessionRow | undefined {
  return db.prepare('SELECT * FROM app_sessions WHERE id = ?').get(id) as AppSessionRow | undefined
}

export function sessionRowOrThrow(appId: string, sid: string): AppSessionRow {
  const row = db.prepare('SELECT * FROM app_sessions WHERE id = ? AND app_id = ?').get(sid, appId) as
    | AppSessionRow
    | undefined
  if (!row) {
    const error = new Error(`会话不存在：${sid}`) as Error & { status?: number }
    error.status = 404
    throw error
  }
  return row
}

export interface CreateSessionRowInput {
  appId: string
  view: SessionView
  opencodeSessionId: string | null
  title: string | null
  providerId: string | null
  modelId: string | null
  status?: string
}

export function createSessionRow(input: CreateSessionRowInput): AppSessionRow {
  const now = nowIso()
  const row: AppSessionRow = {
    id: randomUUID(),
    app_id: input.appId,
    stage: input.view,
    view: input.view,
    opencode_session_id: input.opencodeSessionId,
    provider_id: input.providerId,
    model_id: input.modelId,
    status: input.status ?? 'active',
    title: input.title,
    note: null,
    created_at: now,
    updated_at: now,
    last_active_at: null
  }
  db.prepare(`
    INSERT INTO app_sessions
      (id, app_id, stage, view, opencode_session_id, provider_id, model_id, status, title, note, created_at, updated_at, last_active_at)
    VALUES (@id, @app_id, @stage, @view, @opencode_session_id, @provider_id, @model_id, @status, @title, @note, @created_at, @updated_at, @last_active_at)
  `).run(row)
  return row
}

/** 归档同一视图下的其它活跃会话（切换/新建前调用；失败不阻塞调用方） */
export function archiveActiveSessions(appId: string, view: SessionView, exceptId?: string): void {
  db.prepare(
    `UPDATE app_sessions SET status = 'archived', updated_at = ?
     WHERE app_id = ? AND status = 'active' AND (view = ? OR (view IS NULL AND ? = 'development'))
       ${exceptId ? 'AND id <> ?' : ''}`
  ).run(...[nowIso(), appId, view, view, ...(exceptId ? [exceptId] : [])])
}

export function setSessionActive(id: string): void {
  db.prepare("UPDATE app_sessions SET status = 'active', updated_at = ? WHERE id = ?").run(nowIso(), id)
}

export function setSessionArchived(id: string): void {
  db.prepare("UPDATE app_sessions SET status = 'archived', updated_at = ? WHERE id = ?").run(nowIso(), id)
}

export function setSessionStale(id: string): void {
  db.prepare("UPDATE app_sessions SET status = 'stale', updated_at = ? WHERE id = ?").run(nowIso(), id)
}

export function touchSession(id: string): void {
  const now = nowIso()
  db.prepare('UPDATE app_sessions SET last_active_at = ?, updated_at = ? WHERE id = ?').run(now, now, id)
}
