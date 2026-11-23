/**
 * 全局模板库 API（唯一权威在 DB；应用内是派生副本）
 *
 * GET/POST/PUT/DELETE /api/requirement-templates[/:id]，POST /:id/duplicate
 * POST /api/templates/requirement/:id/sync    幂等同步所有携带应用
 * GET  /api/templates/requirement/:id/usage   删除保护/引用位置
 *
 * 设计模板不在此库：设计阶段统一用「应用类型 × 视觉风格 + 页面库」（`/api/design-system`）。
 */
import { Router, type NextFunction, type Request, type Response } from 'express'
import { DesignError } from '../design/errors'
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getTemplateOrThrow,
  listTemplates,
  updateTemplate
} from '../requirements/templates'
import { syncTemplateToApps, templateUsage, type TemplateKind } from './distribution'

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

export const requirementTemplateRoutes = Router()

requirementTemplateRoutes.get(
  '/',
  route((req, res) => {
    res.json({
      templates: listTemplates({
        stage: req.query.stage,
        category: req.query.category,
        q: req.query.q,
        visibility: req.query.visibility
      })
    })
  })
)

requirementTemplateRoutes.post(
  '/',
  route((req, res) => {
    res.status(201).json({ template: createTemplate((req.body ?? {}) as Record<string, unknown>) })
  })
)

requirementTemplateRoutes.get(
  '/:id',
  route((req, res) => {
    res.json({ template: getTemplateOrThrow(req.params.id) })
  })
)

requirementTemplateRoutes.put(
  '/:id',
  route((req, res) => {
    res.json({ template: updateTemplate(req.params.id, (req.body ?? {}) as Record<string, unknown>) })
  })
)

requirementTemplateRoutes.delete(
  '/:id',
  route((req, res) => {
    deleteTemplate(req.params.id)
    res.json({ ok: true })
  })
)

requirementTemplateRoutes.post(
  '/:id/duplicate',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.status(201).json({ template: duplicateTemplate(req.params.id, body.name) })
  })
)

function kindOf(raw: unknown): TemplateKind {
  if (raw === 'requirement' || raw === 'requirements') return 'requirement'
  const error = new Error(`模板类型只能是 requirement：${String(raw)}`) as Error & { status?: number }
  error.status = 400
  throw error
}

export const templateRoutes = Router()

/** 幂等同步：可重复调用；返回被同步的应用 id */
templateRoutes.post(
  '/:kind/:id/sync',
  route((req, res) => {
    const kind = kindOf(req.params.kind)
    getTemplateOrThrow(req.params.id)
    res.json({ ...syncTemplateToApps(kind, req.params.id), ok: true })
  })
)

templateRoutes.get(
  '/:kind/:id/usage',
  route((req, res) => {
    const kind = kindOf(req.params.kind)
    res.json(templateUsage(kind, req.params.id))
  })
)

export function templateErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error)
    return
  }
  const typed = error as { status?: unknown; issues?: unknown; warnings?: unknown; detail?: unknown }
  const status =
    typeof typed?.status === 'number' ? typed.status : error instanceof DesignError ? error.status : 500
  const message = error instanceof Error ? error.message : String(error)
  res.status(status).json({
    error: message,
    ...(Array.isArray(typed?.issues) ? { issues: typed.issues } : {}),
    ...(Array.isArray(typed?.warnings) ? { warnings: typed.warnings } : {}),
    ...(typeof typed?.detail === 'string' && typed.detail ? { detail: typed.detail } : {})
  })
}
