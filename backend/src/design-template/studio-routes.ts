/**
 * 模板工作室会话 API（P7-7b-1）
 *
 * 挂载：`/api/design-templates/drafts/:id/studio/*`（与 P7-7a 草稿 API 同一 router）。
 * 镜像 `/api/apps/:id/development/*` 的会话/时间线/权限/表单语义，但：
 * - 会话 view=`template`，app_id=`__template__:<packId>`；
 * - 模型 stage=`template`（不继承应用三视图模型）；
 * - 目录/资产固定为工作室根（`<dataDir>/design-system/_workshop`）。
 *
 * 错误：404 草稿/会话；409 无活跃会话；400 参数；502 opencode 未就绪。
 */
import { Router, type NextFunction, type Request, type Response } from 'express'
import { opencode } from '../opencode/runtime'
import { redact, redactDeep } from '../opencode/redact'
import { httpError } from '../dev/session-support'
import {
  activateStudioSession,
  activeStudioOpencodeSession,
  archiveStudioSessionById,
  compactStudioSession,
  createStudioSession,
  getStudioModel,
  interruptStudioSession,
  listStudioSessions,
  promptStudioSession,
  renameStudioSession,
  replyStudioForm,
  replyStudioPermission,
  saveStudioModel,
  studioState
} from './studio'

type AsyncHandler = (req: Request, res: Response) => Promise<void>

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next)
  }
}

function draftIdOf(req: Request): string {
  return String((req.params as Record<string, string | undefined>).id ?? '')
}

function badRequest(message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number }
  error.status = 400
  return error
}

export const studioRoutes = Router({ mergeParams: true })

studioRoutes.get(
  '/',
  asyncRoute(async (req, res) => {
    const raw = req.query.sessionId
    if (raw !== undefined && typeof raw !== 'string') throw badRequest('sessionId 必须为字符串')
    res.json(await studioState(draftIdOf(req), raw ? { sessionId: raw } : {}))
  })
)

studioRoutes.get(
  '/sessions',
  asyncRoute(async (req, res) => {
    res.json(await listStudioSessions(draftIdOf(req)))
  })
)

studioRoutes.post(
  '/session',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { new?: unknown }
    res.json(await createStudioSession(draftIdOf(req), { new: body.new === true }))
  })
)

studioRoutes.post(
  '/sessions/:sid/activate',
  asyncRoute(async (req, res) => {
    res.json(await activateStudioSession(draftIdOf(req), String(req.params.sid ?? '')))
  })
)

studioRoutes.patch(
  '/sessions/:sid',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const patch: { title?: unknown; note?: unknown } = {}
    if (Object.prototype.hasOwnProperty.call(body, 'title')) patch.title = body.title
    if (Object.prototype.hasOwnProperty.call(body, 'note')) patch.note = body.note
    res.json(await renameStudioSession(draftIdOf(req), String(req.params.sid ?? ''), patch))
  })
)

studioRoutes.post(
  '/sessions/:sid/archive',
  asyncRoute(async (req, res) => {
    res.json(await archiveStudioSessionById(draftIdOf(req), String(req.params.sid ?? '')))
  })
)

studioRoutes.post(
  '/prompt',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { text?: unknown; command?: unknown }
    if (typeof body.text !== 'string') throw badRequest('text 必须为字符串')
    res.json(await promptStudioSession(draftIdOf(req), body.text, { command: body.command }))
  })
)

studioRoutes.post(
  '/interrupt',
  asyncRoute(async (req, res) => {
    res.json(await interruptStudioSession(draftIdOf(req)))
  })
)

studioRoutes.post(
  '/compact',
  asyncRoute(async (req, res) => {
    res.json(await compactStudioSession(draftIdOf(req)))
  })
)

studioRoutes.post(
  '/permission/:rid/reply',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { decision?: unknown; message?: unknown }
    if (typeof body.decision !== 'string' || !body.decision) throw badRequest('decision 不能为空')
    res.json(
      await replyStudioPermission(
        draftIdOf(req),
        String(req.params.rid ?? ''),
        body.decision,
        typeof body.message === 'string' ? body.message : undefined
      )
    )
  })
)

studioRoutes.post(
  '/form/:fid/reply',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { answer?: unknown }
    res.json(await replyStudioForm(draftIdOf(req), String(req.params.fid ?? ''), body.answer))
  })
)

studioRoutes.get(
  '/model',
  asyncRoute(async (req, res) => {
    res.json(await getStudioModel(draftIdOf(req)))
  })
)

studioRoutes.put(
  '/model',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    if (!Object.prototype.hasOwnProperty.call(body, 'model')) throw badRequest('缺少 model（可为 null）')
    res.json(await saveStudioModel(draftIdOf(req), body.model))
  })
)

studioRoutes.get(
  '/events',
  asyncRoute(async (req, res) => {
    const draftId = draftIdOf(req)
    try {
      await opencode.ensureStarted()
    } catch (error) {
      throw httpError(502, `opencode 未就绪：${redact(error instanceof Error ? error.message : String(error))}`)
    }
    const sessionID = await activeStudioOpencodeSession(draftId)
    if (!sessionID) {
      res.status(409).json({ error: '当前没有活跃的模板工作室会话，请先开始' })
      return
    }
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    if (typeof res.flushHeaders === 'function') res.flushHeaders()

    res.write(
      `data: ${JSON.stringify({ type: 'hello', sessionID, draftId, view: 'template', status: opencode.status() })}\n\n`
    )
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
