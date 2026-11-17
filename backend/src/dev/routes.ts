/**
 * 开发会话 API（P4）
 *
 * GET    /api/apps/:id/development           当前/指定会话 + 时间线 + 待处理询问（?sessionId= 只读）
 * GET    /api/apps/:id/development/sessions  应用全部开发会话（含归档/失效）
 * POST   /api/apps/:id/development/sessions/:sid/activate 切换 active（先停止并归档当前会话）
 * PATCH  /api/apps/:id/development/sessions/:sid          重命名/备注
 * POST   /api/apps/:id/development/sessions/:sid/archive  归档（幂等）
 * POST   /api/apps/:id/development/session   创建/恢复会话（{new:true} 重开）
 * DELETE /api/apps/:id/development/session   归档当前会话
 * POST   /api/apps/:id/development/prompt    发送消息（completion 后自动恢复 development）
 * POST   /api/apps/:id/development/interrupt 停止
 * POST   /api/apps/:id/development/compact   压缩上下文（opencode 原生 compact）
 * GET    /api/apps/:id/development/phases    开发阶段列表（?handoffVersion= 历史只读）
 * POST   /api/apps/:id/development/phases/generate  按需生成阶段（大交接包）
 * POST   /api/apps/:id/development/phases/:phaseId/start|complete|skip|reopen
 * GET    /api/apps/:id/development/events    SSE（按 opencode 会话过滤）
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
import {
  completeDevPhase,
  generateDevPhases,
  getDevPhases,
  reopenDevPhase,
  skipDevPhase,
  startDevPhase
} from './phases'

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

devRoutes.get(
  '/',
  asyncRoute(async (req, res) => {
    const raw = req.query.sessionId
    if (raw !== undefined && typeof raw !== 'string') throw badRequest('sessionId 必须为字符串')
    res.json(await getDevState(appIdOf(req), raw ? { sessionId: raw } : {}))
  })
)

devRoutes.get(
  '/sessions',
  asyncRoute(async (req, res) => {
    res.json(await listDevSessions(appIdOf(req)))
  })
)

devRoutes.post(
  '/sessions/:sid/activate',
  asyncRoute(async (req, res) => {
    res.json(await activateDevSession(appIdOf(req), String(req.params.sid ?? '')))
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
    const body = (req.body ?? {}) as { new?: unknown }
    res.json(await createDevSession(appIdOf(req), { new: body.new === true }))
  })
)

devRoutes.delete(
  '/session',
  asyncRoute(async (req, res) => {
    res.json(await archiveDevSession(appIdOf(req)))
  })
)

devRoutes.post(
  '/prompt',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { text?: unknown }
    if (typeof body.text !== 'string') throw badRequest('text 必须为字符串')
    res.json(await promptDevSession(appIdOf(req), body.text))
  })
)

devRoutes.post(
  '/interrupt',
  asyncRoute(async (req, res) => {
    res.json(await interruptDevSession(appIdOf(req)))
  })
)

devRoutes.post(
  '/compact',
  asyncRoute(async (req, res) => {
    res.json(await compactDevSession(appIdOf(req)))
  })
)

// ---- U7-1：开发阶段（按需生成，不做门禁） ----

devRoutes.get(
  '/phases',
  asyncRoute(async (req, res) => {
    const raw = req.query.handoffVersion
    if (raw !== undefined && typeof raw !== 'string') throw badRequest('handoffVersion 必须为字符串')
    if (raw !== undefined && raw !== '' && !/^\d+$/.test(raw)) throw badRequest('handoffVersion 必须为正整数')
    const handoffVersion = raw === undefined || raw === '' ? undefined : Number(raw)
    if (handoffVersion !== undefined && handoffVersion <= 0) throw badRequest('handoffVersion 必须为正整数')
    res.json(getDevPhases(appIdOf(req), { handoffVersion }))
  })
)

devRoutes.post(
  '/phases/generate',
  asyncRoute(async (req, res) => {
    res.json(generateDevPhases(appIdOf(req)))
  })
)

devRoutes.post(
  '/phases/:phaseId/start',
  asyncRoute(async (req, res) => {
    res.json(await startDevPhase(appIdOf(req), String(req.params.phaseId ?? '')))
  })
)

devRoutes.post(
  '/phases/:phaseId/complete',
  asyncRoute(async (req, res) => {
    res.json(await completeDevPhase(appIdOf(req), String(req.params.phaseId ?? '')))
  })
)

devRoutes.post(
  '/phases/:phaseId/skip',
  asyncRoute(async (req, res) => {
    res.json(skipDevPhase(appIdOf(req), String(req.params.phaseId ?? '')))
  })
)

devRoutes.post(
  '/phases/:phaseId/reopen',
  asyncRoute(async (req, res) => {
    res.json(reopenDevPhase(appIdOf(req), String(req.params.phaseId ?? '')))
  })
)

devRoutes.post(
  '/permission/:rid/reply',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { decision?: unknown; message?: unknown }
    if (typeof body.decision !== 'string' || !body.decision) throw badRequest('decision 不能为空')
    res.json(
      await replyDevPermission(
        appIdOf(req),
        String(req.params.rid ?? ''),
        body.decision,
        typeof body.message === 'string' ? body.message : undefined
      )
    )
  })
)

devRoutes.post(
  '/form/:fid/reply',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { answer?: unknown }
    res.json(await replyDevForm(appIdOf(req), String(req.params.fid ?? ''), body.answer))
  })
)

devRoutes.get(
  '/events',
  asyncRoute(async (req, res) => {
    const appId = appIdOf(req)
    await opencode.ensureStarted()
    const sessionID = activeOpencodeSessionId(appId)
    if (!sessionID) {
      res.status(409).json({ error: '当前没有开发会话，请先开始开发' })
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
