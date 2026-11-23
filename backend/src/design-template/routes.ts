/**
 * 模板工作室 API（P7-7a）：`/api/design-templates`
 *
 * - catalog：内置 pack + 蓝图扫描的派生知识库（catalog/{index,pages,components,styles,recipes}）；
 * - drafts：草稿 CRUD / 生成 / 校验 / 发布 / 资产；不含工作室会话（P7-7b）；
 * - 错误响应统一 `{ error, code?, details? }`；不返回堆栈/敏感绝对路径。
 */
import path from 'node:path'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { validatePackDir } from '../design/pack'
import { DesignError } from '../design/errors'
import { ensureCatalog } from './catalog'
import { createDraft, deleteDraft, draftSummary, ensureDraftFromPublished, getDraftDetail, listDrafts } from './draft'
import { generateDraft } from './generator'
import { draftPackDir, resolveAssetFile } from './paths'
import { publishDraft, referencedAppsMap } from './publish'
import { studioRoutes } from './studio-routes'

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

function contentTypeOf(file: string): string {
  switch (path.extname(file).toLowerCase()) {
    case '.css':
      return 'text/css; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    default:
      return 'application/octet-stream'
  }
}

export const designTemplateRoutes = Router()

designTemplateRoutes.get(
  '/catalog',
  route((_req, res) => {
    res.json(ensureCatalog())
  })
)

designTemplateRoutes.get(
  '/drafts',
  route((_req, res) => {
    const refs = referencedAppsMap()
    const drafts = listDrafts().map(draft => ({
      ...draft,
      referencedApps: refs.get(draft.id) ?? []
    }))
    res.json({ drafts })
  })
)

designTemplateRoutes.post(
  '/drafts',
  route((req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const draft = createDraft(body as Record<string, unknown>)
    res.status(201).json({ draft: { ...draft, referencedApps: [] } })
  })
)

designTemplateRoutes.use('/drafts/:id/studio', studioRoutes)

designTemplateRoutes.get(
  '/drafts/:id',
  route((req, res) => {
    const refs = referencedAppsMap()
    const detail = getDraftDetail(req.params.id)
    res.json({ ...detail, referencedApps: refs.get(detail.draft.id) ?? [] })
  })
)

designTemplateRoutes.get(
  '/drafts/:id/asset',
  route((req, res) => {
    // 先确认草稿存在（404 草稿 vs 404 资产语义分开）
    draftSummary(req.params.id)
    const file = resolveAssetFile(draftPackDir(req.params.id), req.query.path)
    res.type(contentTypeOf(file))
    res.setHeader('Cache-Control', 'no-store')
    res.sendFile(file)
  })
)

designTemplateRoutes.post(
  '/drafts/:id/generate',
  route((req, res) => {
    const result = generateDraft(req.params.id)
    if (!result.ok) {
      res.status(result.status).json({
        ok: false,
        errors: result.errors,
        warnings: result.warnings
      })
      return
    }
    const { status: _status, ...payload } = result
    res.json(payload)
  })
)

designTemplateRoutes.post(
  '/drafts/:id/validate',
  route((req, res) => {
    const summary = draftSummary(req.params.id)
    if (!summary.hasPack) {
      throw new DesignError(404, '草稿尚未生成（缺少 pack）', { code: 'pack-missing' })
    }
    const validation = validatePackDir(draftPackDir(req.params.id), summary.id)
    const dedupe = <T extends { code: string; message: string }>(list: T[]): T[] =>
      list.filter((issue, index) => list.findIndex(item => item.code === issue.code && item.message === issue.message) === index)
    const errors = dedupe([...summary.validation.errors, ...validation.errors])
    const warnings = dedupe([...summary.validation.warnings, ...validation.warnings])
    res.json({
      ok: errors.length === 0,
      errors,
      warnings,
      ...(validation.pack
        ? {
            pack: {
              id: validation.pack.id,
              version: validation.pack.version,
              revision: validation.pack.origin?.revision ?? 0,
              pageCount: validation.pack.applicationTypes.reduce((total, type) => total + type.pages.length, 0)
            }
          }
        : {})
    })
  })
)

designTemplateRoutes.post(
  '/drafts/:id/publish',
  route((req, res) => {
    const result = publishDraft(req.params.id)
    res.json(result)
  })
)

designTemplateRoutes.post(
  '/packs/:packId/draft',
  route((req, res) => {
    const draft = ensureDraftFromPublished(req.params.packId)
    res.json({ draft })
  })
)

designTemplateRoutes.delete(
  '/drafts/:id',
  route((req, res) => {
    const result = deleteDraft(req.params.id)
    res.json(result)
  })
)

export function designTemplateErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error)
    return
  }
  const status =
    error instanceof DesignError
      ? error.status
      : typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
  const payload: Record<string, unknown> = {
    error: error instanceof Error ? error.message : String(error)
  }
  if (error instanceof DesignError) {
    if (error.code) payload.code = error.code
    if (error.details !== undefined) payload.details = error.details
  }
  if (status >= 500) {
    console.error('[design-template]', error instanceof Error ? error.stack ?? error.message : String(error))
  }
  res.status(status).json(payload)
}
