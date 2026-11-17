/**
 * 设计 → 开发交接包 API（D5，挂载在 /api/apps/:id/design/handoff）
 *
 * POST /preview          校验 + 渲染，不写盘、不创建变更单
 * POST /generate         写 docs/handoff/、记录版本/hash、创建 Change Set #1、切到 development
 * GET  /                 最新（或 ?version=）交接包元数据 + 文件内容
 * GET  /files/*          读取交接包文件（PNG/HTML/Markdown/JSON/SQL）
 */
import fs from 'node:fs'
import { Router, type NextFunction, type Request, type Response } from 'express'
import {
  designHandoffFile,
  generateDesignHandoff,
  previewDesignHandoff,
  readDesignHandoff
} from './design-service'

export const designHandoffRoutes = Router({ mergeParams: true })

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

designHandoffRoutes.post(
  '/preview',
  route((req, res) => {
    res.json(previewDesignHandoff(appIdOf(req)))
  })
)

designHandoffRoutes.post(
  '/generate',
  route((req, res) => {
    res.json(generateDesignHandoff(appIdOf(req)))
  })
)

designHandoffRoutes.get(
  '/',
  route((req, res) => {
    res.json(readDesignHandoff(appIdOf(req), req.query.version))
  })
)

designHandoffRoutes.get(
  '/files/*',
  route((req, res) => {
    const file = designHandoffFile(appIdOf(req), req.params[0] ?? '')
    if (file.kind === 'image') {
      res.type('png')
      res.setHeader('Cache-Control', 'private, max-age=60')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      fs.createReadStream(file.abs).pipe(res)
      return
    }
    if (file.kind === 'html') {
      // HTML 快照来自浏览器 DOM，不能作为同源可执行页面打开
      res.type('text/plain; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment')
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'")
      res.setHeader('X-Content-Type-Options', 'nosniff')
      fs.createReadStream(file.abs).pipe(res)
      return
    }
    res.type('text/plain; charset=utf-8')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    fs.createReadStream(file.abs).pipe(res)
  })
)
