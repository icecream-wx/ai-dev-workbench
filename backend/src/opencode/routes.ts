/**
 * /api/opencode/*：工作台对 opencode serve 的受控入口
 *
 * - 只暴露模型/agent/会话/事件，不暴露 serve 密码与 provider 密钥
 * - 目录参数必须位于 RG_PROJECTS_DIR 下，避免任意路径被当作 opencode 工作区
 */
import { Router, type NextFunction, type Request, type Response } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config'
import { opencode } from './runtime'
import { redact } from './redact'

export const opencodeRoutes = Router()

type AsyncHandler = (req: Request, res: Response) => Promise<void>

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next)
  }
}

function badRequest(message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number }
  error.status = 400
  return error
}

/** 把请求里的 directory 限制在应用根目录内（默认使用应用根） */
function projectDirectory(raw: unknown): string {
  const root = path.resolve(config.projectsDir)
  const directory = typeof raw === 'string' && raw.trim() ? path.resolve(raw.trim()) : root
  const relative = path.relative(root, directory)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw badRequest(`目录必须位于应用根目录内：${root}`)
  }
  if (!fs.existsSync(directory)) throw badRequest(`目录不存在：${directory}`)
  return directory
}

function sessionId(req: Request): string {
  const id = String(req.params.id ?? '').trim()
  if (!id) throw badRequest('缺少会话 ID')
  return id
}

function requestId(req: Request, name: 'rid' | 'fid'): string {
  const id = String(req.params[name] ?? '').trim()
  if (!id) throw badRequest(`缺少 ${name}`)
  return id
}

opencodeRoutes.get('/health', (_req, res) => {
  opencode.autoDetect()
  res.json(opencode.status())
})

opencodeRoutes.post(
  '/start',
  asyncRoute(async (_req, res) => {
    await opencode.ensureStarted()
    res.json(opencode.status())
  })
)

opencodeRoutes.post(
  '/stop',
  asyncRoute(async (_req, res) => {
    await opencode.stop()
    res.json(opencode.status())
  })
)

opencodeRoutes.get(
  '/models',
  asyncRoute(async (req, res) => {
    const directory = req.query.directory ? projectDirectory(req.query.directory) : undefined
    res.json({ models: await opencode.listModels(directory) })
  })
)

opencodeRoutes.get(
  '/default-model',
  asyncRoute(async (req, res) => {
    const directory = req.query.directory ? projectDirectory(req.query.directory) : undefined
    res.json({ model: await opencode.defaultModel(directory) })
  })
)

opencodeRoutes.get(
  '/agents',
  asyncRoute(async (req, res) => {
    const directory = req.query.directory ? projectDirectory(req.query.directory) : undefined
    res.json({ agents: await opencode.listAgents(directory) })
  })
)

/** 项目级 skills（P0：GET /api/skill；坏 YAML/缺 description 会被静默丢弃） */
opencodeRoutes.get(
  '/skills',
  asyncRoute(async (req, res) => {
    const directory = req.query.directory ? projectDirectory(req.query.directory) : undefined
    res.json({ skills: await opencode.listSkills(directory) })
  })
)

/** 项目级 commands（只返回 name/description，不含正文） */
opencodeRoutes.get(
  '/commands',
  asyncRoute(async (req, res) => {
    const directory = req.query.directory ? projectDirectory(req.query.directory) : undefined
    res.json({ commands: await opencode.listCommands(directory) })
  })
)

opencodeRoutes.post(
  '/sessions',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as {
      directory?: unknown
      title?: unknown
      agent?: unknown
      model?: { providerID?: unknown; id?: unknown; variant?: unknown } | null
    }
    const directory = projectDirectory(body.directory)
    const model =
      body.model && typeof body.model === 'object' && typeof body.model.providerID === 'string' && typeof body.model.id === 'string'
        ? {
            providerID: body.model.providerID,
            id: body.model.id,
            ...(typeof body.model.variant === 'string' && body.model.variant ? { variant: body.model.variant } : {})
          }
        : null
    const session = await opencode.createSession({
      directory,
      title: typeof body.title === 'string' ? body.title : undefined,
      agent: typeof body.agent === 'string' ? body.agent : undefined,
      model
    })
    res.status(201).json({ session })
  })
)

opencodeRoutes.get(
  '/sessions',
  asyncRoute(async (req, res) => {
    const directory = req.query.directory ? projectDirectory(req.query.directory) : undefined
    res.json({ sessions: await opencode.listSessions(directory) })
  })
)

opencodeRoutes.get(
  '/sessions/:id',
  asyncRoute(async (req, res) => {
    const session = await opencode.session(sessionId(req))
    if (!session) {
      res.status(404).json({ error: '会话不存在' })
      return
    }
    res.json({ session })
  })
)

opencodeRoutes.delete(
  '/sessions/:id',
  asyncRoute(async (req, res) => {
    await opencode.deleteSession(sessionId(req))
    res.json({ ok: true })
  })
)

opencodeRoutes.post(
  '/sessions/:id/prompt',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { text?: unknown; delivery?: unknown }
    if (typeof body.text !== 'string' || !body.text.trim()) throw badRequest('text 不能为空')
    const id = sessionId(req)
    opencode.track(id)
    const result = await opencode.prompt(id, body.text, typeof body.delivery === 'string' ? body.delivery : undefined)
    res.json({ ok: true, result })
  })
)

opencodeRoutes.get(
  '/sessions/:id/messages',
  asyncRoute(async (req, res) => {
    const limit = Number(req.query.limit)
    const order = req.query.order === 'desc' ? 'desc' : 'asc'
    res.json(
      await opencode.messages(sessionId(req), {
        ...(Number.isFinite(limit) && limit > 0 ? { limit } : {}),
        order
      })
    )
  })
)

opencodeRoutes.get(
  '/sessions/:id/pending',
  asyncRoute(async (req, res) => {
    const id = sessionId(req)
    await opencode.refreshPending(id)
    res.json(opencode.pendingFor(id))
  })
)

opencodeRoutes.post(
  '/sessions/:id/interrupt',
  asyncRoute(async (req, res) => {
    const resume = req.query.resume !== 'false'
    res.json({ ok: true, result: await opencode.interrupt(sessionId(req), resume) })
  })
)

opencodeRoutes.post(
  '/sessions/:id/permissions/:rid/reply',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { decision?: unknown; message?: unknown }
    if (typeof body.decision !== 'string' || !body.decision) throw badRequest('decision 不能为空')
    await opencode.replyPermission(
      sessionId(req),
      requestId(req, 'rid'),
      body.decision,
      typeof body.message === 'string' ? body.message : undefined
    )
    res.json({ ok: true })
  })
)

opencodeRoutes.post(
  '/sessions/:id/forms/:fid/reply',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { answer?: unknown }
    await opencode.replyForm(sessionId(req), requestId(req, 'fid'), body.answer)
    res.json({ ok: true })
  })
)

opencodeRoutes.get(
  '/events',
  asyncRoute(async (req, res) => {
    await opencode.ensureStarted()
    const filter = {
      ...(typeof req.query.sessionID === 'string' && req.query.sessionID ? { sessionID: req.query.sessionID } : {}),
      ...(typeof req.query.directory === 'string' && req.query.directory ? { directory: projectDirectory(req.query.directory) } : {})
    }
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    if (typeof res.flushHeaders === 'function') res.flushHeaders()

    res.write(`data: ${JSON.stringify({ type: 'hello', status: opencode.status() })}\n\n`)
    const unsubscribe = opencode.subscribe(filter, event => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    })
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000)
    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })
)

/** /api/opencode/* 的统一错误出口：不把内部堆栈和密码返回给浏览器 */
export function opencodeErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error)
    return
  }
  const status = typeof (error as { status?: unknown })?.status === 'number' ? Number((error as { status?: number }).status) : 502
  const message = redact(error instanceof Error ? error.message : String(error))
  res.status(status >= 400 && status < 600 ? status : 502).json({ error: message })
}
