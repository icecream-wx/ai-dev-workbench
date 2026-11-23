/**
 * 会话 API（开发视图沿用；需求/设计视图复用同一套接口，用 `view` 区分）
 *
 * GET    /api/apps/:id/development?view=&sessionId=   当前/指定会话 + 时间线 + 待处理询问
 * GET    /api/apps/:id/development/sessions?view=     会话列表（按视图过滤）
 * POST   /api/apps/:id/development/sessions/:sid/activate
 * PATCH  /api/apps/:id/development/sessions/:sid      重命名/备注
 * POST   /api/apps/:id/development/sessions/:sid/archive
 * POST   /api/apps/:id/development/session            创建/恢复会话（{new:true, view}）
 * DELETE /api/apps/:id/development/session            归档当前会话（view）
 * POST   /api/apps/:id/development/prompt             发送消息
 * POST   /api/apps/:id/development/interrupt          停止
 * POST   /api/apps/:id/development/compact            压缩上下文
 * GET    /api/apps/:id/development/events             SSE（按 opencode 会话过滤）
 * POST   /api/apps/:id/development/permission/:rid/reply
 * POST   /api/apps/:id/development/form/:fid/reply
 */
import { Router, type NextFunction, type Request, type Response } from 'express'
import { opencode } from '../opencode/runtime'
import { appDirOf } from '../apps/scaffold'
import { redactDeep } from '../opencode/redact'
import {
  activateDevSession,
  activeOpencodeSessionId,
  archiveDevSession,
  archiveDevSessionById,
  compactDevSession,
  createDevSession,
  getDevState,
  interruptDevSession,
  listDevSessions,
  promptDevSession,
  registerAppSecrets,
  renameDevSession,
  replyDevForm,
  replyDevPermission
} from './service'

export const devRoutes = Router({ mergeParams: true })

type AsyncHandler = (req: Request, res: Response) => Promise<void>

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next)
  }
}

function appIdOf(req: Request): string {
  return String((req.params as Record<string, string | undefined>).id ?? '')
}

function badRequest(message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number }
  error.status = 400
  return error
}

/** view 来自 query 或 body；非法值交给 service 回退默认（development） */
function viewOf(req: Request, body?: Record<string, unknown>): { view?: unknown } {
  if (body && body.view !== undefined) return { view: body.view }
  return req.query.view === undefined ? {} : { view: req.query.view }
}

devRoutes.get(
  '/',
  asyncRoute(async (req, res) => {
    const raw = req.query.sessionId
    if (raw !== undefined && typeof raw !== 'string') throw badRequest('sessionId 必须为字符串')
    res.json(await getDevState(appIdOf(req), { ...(raw ? { sessionId: raw } : {}), ...viewOf(req) }))
  })
)

devRoutes.get(
  '/sessions',
  asyncRoute(async (req, res) => {
    res.json(await listDevSessions(appIdOf(req), viewOf(req)))
  })
)

devRoutes.post(
  '/sessions/:sid/activate',
  asyncRoute(async (req, res) => {
    res.json(await activateDevSession(appIdOf(req), String(req.params.sid ?? ''), viewOf(req)))
  })
)

devRoutes.patch(
  '/sessions/:sid',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const patch: { title?: unknown; note?: unknown } = {}
    if (Object.prototype.hasOwnProperty.call(body, 'title')) patch.title = body.title
    if (Object.prototype.hasOwnProperty.call(body, 'note')) patch.note = body.note
    res.json(await renameDevSession(appIdOf(req), String(req.params.sid ?? ''), patch))
  })
)

devRoutes.post(
  '/sessions/:sid/archive',
  asyncRoute(async (req, res) => {
    res.json(await archiveDevSessionById(appIdOf(req), String(req.params.sid ?? '')))
  })
)

devRoutes.post(
  '/session',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { new?: unknown; view?: unknown; module?: unknown }
    res.json(
      await createDevSession(appIdOf(req), {
        new: body.new === true,
        view: body.view ?? req.query.view,
        module: body.module
      })
    )
  })
)

devRoutes.delete(
  '/session',
  asyncRoute(async (req, res) => {
    res.json(await archiveDevSession(appIdOf(req), viewOf(req)))
  })
)

devRoutes.post(
  '/prompt',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { text?: unknown; view?: unknown; module?: unknown; command?: unknown }
    if (typeof body.text !== 'string') throw badRequest('text 必须为字符串')
    res.json(
      await promptDevSession(appIdOf(req), body.text, {
        view: body.view ?? req.query.view,
        module: body.module,
        command: body.command
      })
    )
  })
)

devRoutes.post(
  '/interrupt',
  asyncRoute(async (req, res) => {
    res.json(await interruptDevSession(appIdOf(req), viewOf(req, (req.body ?? {}) as Record<string, unknown>)))
  })
)

devRoutes.post(
  '/compact',
  asyncRoute(async (req, res) => {
    res.json(await compactDevSession(appIdOf(req), viewOf(req, (req.body ?? {}) as Record<string, unknown>)))
  })
)

devRoutes.post(
  '/permission/:rid/reply',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { decision?: unknown; message?: unknown; view?: unknown }
    if (typeof body.decision !== 'string' || !body.decision) throw badRequest('decision 不能为空')
    res.json(
      await replyDevPermission(
        appIdOf(req),
        String(req.params.rid ?? ''),
        body.decision,
        typeof body.message === 'string' ? body.message : undefined,
        viewOf(req, body as Record<string, unknown>)
      )
    )
  })
)

devRoutes.post(
  '/form/:fid/reply',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { answer?: unknown; view?: unknown }
    res.json(
      await replyDevForm(appIdOf(req), String(req.params.fid ?? ''), body.answer, viewOf(req, body as Record<string, unknown>))
    )
  })
)

devRoutes.get(
  '/events',
  asyncRoute(async (req, res) => {
    const appId = appIdOf(req)
    await opencode.ensureStarted()
    const sessionID = activeOpencodeSessionId(appId, viewOf(req))
    if (!sessionID) {
      res.status(409).json({ error: '当前没有活跃会话，请先开始' })
      return
    }
    registerAppSecrets(appId, appDirOf(appId))
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    if (typeof res.flushHeaders === 'function') res.flushHeaders()

    res.write(`data: ${JSON.stringify({ type: 'hello', sessionID, appId, status: opencode.status() })}\n\n`)
    const unsubscribe = opencode.subscribe({ sessionID }, event => {
      res.write(`data: ${JSON.stringify(redactDeep(event))}\n\n`)
    })
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000)
    heartbeat.unref?.()
    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })
)
