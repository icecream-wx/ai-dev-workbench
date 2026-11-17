/**
 * 页面原型模板 API（全局库）
 *
 * GET    /api/prototype-templates?category=&q=&visibility=
 * POST   /api/prototype-templates
 * PUT    /api/prototype-templates/:id
 * DELETE /api/prototype-templates/:id
 * POST   /api/prototype-templates/:id/duplicate
 */
import { Router, type NextFunction, type Request, type Response } from 'express'
import { DesignError } from './errors'
import {
  createPrototypeTemplate,
  deletePrototypeTemplate,
  duplicatePrototypeTemplate,
  getPrototypeTemplateOrThrow,
  listPrototypeTemplates,
  updatePrototypeTemplate
} from './templates'

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

export const prototypeTemplateRoutes = Router()

prototypeTemplateRoutes.get(
  '/',
  route((req, res) => {
    res.json({
      templates: listPrototypeTemplates({ category: req.query.category, q: req.query.q, visibility: req.query.visibility })
    })
  })
)

prototypeTemplateRoutes.post(
  '/',
  route((req, res) => {
    res.status(201).json({ template: createPrototypeTemplate((req.body ?? {}) as Record<string, unknown>) })
  })
)

prototypeTemplateRoutes.put(
  '/:id',
  route((req, res) => {
    res.json({ template: updatePrototypeTemplate(req.params.id, (req.body ?? {}) as Record<string, unknown>) })
  })
)

prototypeTemplateRoutes.delete(
  '/:id',
  route((req, res) => {
    deletePrototypeTemplate(req.params.id)
    res.json({ ok: true })
  })
)

prototypeTemplateRoutes.post(
  '/:id/duplicate',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.status(201).json({ template: duplicatePrototypeTemplate(req.params.id, body.name) })
  })
)

prototypeTemplateRoutes.get(
  '/:id',
  route((req, res) => {
    res.json({ template: getPrototypeTemplateOrThrow(req.params.id) })
  })
)

export function prototypeErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error)
    return
  }
  const typed = error as { status?: unknown; issues?: unknown; warnings?: unknown }
  const status = typeof typed?.status === 'number' ? typed.status : error instanceof DesignError ? error.status : 500
  const message = error instanceof Error ? error.message : String(error)
  res.status(status).json({
    error: message,
    ...(Array.isArray(typed?.issues) ? { issues: typed.issues } : {}),
    ...(Array.isArray(typed?.warnings) ? { warnings: typed.warnings } : {})
  })
}
