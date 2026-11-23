/**
 * 设计模板包只读 API（P7-1 / P7-7a）
 *
 * - GET    /api/design-system              内置 + 自定义 pack 摘要（含 origin/templateKind）
 * - GET    /api/design-system/:packId      完整 pack（应用类型/页面库/风格/配方/组件映射）
 * - GET    /api/design-system/:packId/asset?path=  自定义 pack 资产（只读；内置 403）
 * - DELETE /api/design-system/:packId      删除自定义 pack（内置 403；被引用 409）
 *
 * 应用级设计系统在 `/api/apps/:id/design-system`（见 apps/routes.ts）；
 * 草稿/生成/发布在 `/api/design-templates`（design-template/routes.ts）。
 */
import path from 'node:path'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { DesignError } from './errors'
import { customDesignSystemRoot, getPack, getPackSource, listPacks } from './pack'
import { assertPackId, resolveAssetFile } from '../design-template/paths'
import { deleteCustomPack, referencedAppsMap } from '../design-template/publish'

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

export const designSystemRoutes = Router()

designSystemRoutes.get(
  '/',
  route((_req, res) => {
    // P7-7b-2b：模板中心自定义卡片需要引用应用数（自定义 pack；内置为空数组）
    const refs = referencedAppsMap()
    res.json({
      packs: listPacks().map(pack => ({
        ...pack,
        referencedApps: refs.get(pack.id) ?? []
      }))
    })
  })
)

designSystemRoutes.get(
  '/:packId/asset',
  route((req, res) => {
    const packId = assertPackId(req.params.packId)
    const source = getPackSource(packId)
    if (source === 'builtin') {
      throw new DesignError(403, `内置模板资产不通过该接口提供：${packId}`, { code: 'builtin-readonly' })
    }
    // 触发一次 pack 校验（坏 pack 400/404，而不是直接读碎片）
    getPack(packId)
    const file = resolveAssetFile(path.join(customDesignSystemRoot(), packId), req.query.path)
    res.type(contentTypeOf(file))
    res.setHeader('Cache-Control', 'no-store')
    res.sendFile(file)
  })
)

designSystemRoutes.get(
  '/:packId',
  route((req, res) => {
    const pack = getPack(req.params.packId)
    res.json({ pack, source: getPackSource(pack.id) })
  })
)

designSystemRoutes.delete(
  '/:packId',
  route((req, res) => {
    res.json(deleteCustomPack(req.params.packId))
  })
)

export function designSystemErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error)
    return
  }
  const status = error instanceof DesignError ? error.status : 500
  const payload: Record<string, unknown> = {
    error: error instanceof Error ? error.message : String(error)
  }
  if (error instanceof DesignError) {
    if (error.code) payload.code = error.code
    if (error.details !== undefined) payload.details = error.details
  }
  res.status(status).json(payload)
}
