/**
 * 变更单 API（C1，挂载在 /api/apps/:id/change-sets）
 *
 * GET  /                       变更单列表（新→旧）+ 当前 active
 * POST /                       发起变更（title/description/scope=requirements|design）
 * POST /:csId/cancel           取消变更（恢复基线；仅在未生成新交接包且存在已确认差异时允许）
 *
 * 错误统一走 appsErrorHandler（{error, issues?, warnings?}）。
 */
import { Router, type NextFunction, type Request, type Response } from 'express'
import { db } from '../db'
import { appPayload, type AppRow } from '../apps/payload'
import { cancelChangeSet, listChangeSets, startChangeSet, upgradeChangeSetScope } from './service'

export const changeSetRoutes = Router({ mergeParams: true })

type Handler = (req: Request, res: Response) => void

function route(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      handler(req, res)
    } catch (error) {
      next(error)
    }
  }
}

function appIdOf(req: Request): string {
  return String((req.params as Record<string, string | undefined>).id ?? '')
}

function appRowOrThrow(appId: string): AppRow {
  const row = db.prepare('SELECT * FROM apps WHERE id = ?').get(appId) as AppRow | undefined
  if (!row) {
    const error = new Error(`应用不存在：${appId}`) as Error & { status?: number }
    error.status = 404
    throw error
  }
  return row
}

changeSetRoutes.get(
  '/',
  route((req, res) => {
    const appId = appIdOf(req)
    appRowOrThrow(appId)
    res.json(listChangeSets(appId))
  })
)

changeSetRoutes.post(
  '/',
  route((req, res) => {
    const appId = appIdOf(req)
    appRowOrThrow(appId)
    const result = startChangeSet(appId, (req.body ?? {}) as Record<string, unknown>)
    res.status(201).json({ changeSet: result.changeSet, app: appPayload(appRowOrThrow(appId)) })
  })
)

changeSetRoutes.post(
  '/:csId/cancel',
  route((req, res) => {
    const appId = appIdOf(req)
    appRowOrThrow(appId)
    const result = cancelChangeSet(appId, req.params.csId)
    res.json({ ...result, app: appPayload(appRowOrThrow(appId)) })
  })
)

/** 仅设计变更 → 需求+设计（改需求前必须先升级范围） */
changeSetRoutes.post(
  '/:csId/scope',
  route((req, res) => {
    const appId = appIdOf(req)
    appRowOrThrow(appId)
    const body = (req.body ?? {}) as Record<string, unknown>
    const result = upgradeChangeSetScope(appId, req.params.csId, body.scope)
    res.json({ changeSet: result.changeSet, app: appPayload(appRowOrThrow(appId)) })
  })
)
