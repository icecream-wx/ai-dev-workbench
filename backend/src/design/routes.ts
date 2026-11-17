/**
 * 设计阶段 API（挂在 /api/apps/:id/design）
 *
 * M4（#6）：所有接口尾部可选 `moduleId`（GET query / POST/PUT body）；缺省 = 默认模块，
 * 未知 404，归档模块读允许、写 409。页面/页面集/版本/确认/输入/chat 均按模块隔离。
 *
 * GET    /                         设计项目 + 原型模板 + 实体 + 页面集 + 需求文档 + readiness + chat
 * PUT    /template                 切换原型模板（scope 缺省 = 当前模块；scope='app' = 全部未归档模块）
 * POST   /template/preview         应用级原型模板切换预览（只读）
 * POST   /generate-entities        AI 从需求文档生成实体初稿
 * POST   /generate-epic            D-RMP：按 Epic 生成实体（合并）+ 页面集（primary 替换）
 * PUT    /entities                 保存实体设计（整体）
 * POST   /page-sets/generate       生成页面集（mode=default 按模板规则；mode=ai 调模型）
 * PUT    /page-sets                保存全部页面集（AI 应用复用）
 * PUT    /page-sets/:id            保存单个页面集（页面数组/状态）
 * PUT    /pages/:id                保存单个页面规格/布局/绑定实体
 * POST   /pages/:id/snapshot       上传 PNG 快照（base64）+ HTML，写应用目录
 * GET    /pages/:id/image          读取 PNG
 * GET    /pages/:id/html           读取 HTML
 * POST   /confirm                  确认设计（实体 + 页面集 + 无阻塞；不切换开发阶段）
 * GET    /versions                 版本列表（来源/所属变更单）
 * POST   /versions                 手动保存版本（draft；confirmed 409）
 * GET    /versions/:v              版本详情
 * POST   /versions/:v/rollback     回滚版本
 * GET/PUT /chat                    设计对话持久化
 */
import fs from 'node:fs'
import path from 'node:path'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { appDirOf } from '../apps/scaffold'
import { resolveAppTemplates } from '../apps/template-resolution'
import { resolveChatModel } from '../chat/service'
import { designHandoffRoutes } from '../handoff/design-routes'
import {
  confirmDesign,
  createDesignVersion,
  designOverview,
  getDesign,
  getDesignVersion,
  listDesignVersions,
  pageHtmlFile,
  pageImageFile,
  previewAppProtoTemplateSwitch,
  readDesignChatWithMeta,
  reopenDesign,
  rollbackDesignVersion,
  saveDesignChat,
  saveEntities,
  savePage,
  savePageSet,
  savePageSets,
  savePageSnapshot,
  switchAppProtoTemplate,
  switchProtoTemplate,
  generateDefaultPageSets,
  generateEntitiesFromRequirement,
  generateEpicDesign,
  generatePageSetsFromRequirement,
  syncDesignInput
} from './service'
import {
  buildDesignInput,
  computeStale,
  latestDesignInput,
  listDesignInputs,
  readDesignInput,
  summaryOf
} from './input'
import { latestRequirementBundle } from '../requirements/modules'
import type { DesignVersionSource } from './types'

type AsyncHandler = (req: Request, res: Response) => Promise<void>

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next)
  }
}

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
  return String(req.params.id)
}

/** 模块 ID 解析（M4）：query 优先，其次 body；trim；空串视为缺省 */
function moduleIdOf(req: Request, body?: Record<string, unknown>): string | undefined {
  const fromQuery = typeof req.query.moduleId === 'string' ? req.query.moduleId : undefined
  if (fromQuery !== undefined) return fromQuery.trim()
  const fromBody = body && typeof body.moduleId === 'string' ? body.moduleId : undefined
  return fromBody === undefined ? undefined : fromBody.trim()
}

const VERSION_SOURCES: DesignVersionSource[] = [
  'ai',
  'manual',
  'template-change',
  'confirm',
  'sync',
  'rollback',
  'restore'
]

function sourceOf(value: unknown): DesignVersionSource {
  if (typeof value === 'string' && (VERSION_SOURCES as string[]).includes(value)) return value as DesignVersionSource
  return 'manual'
}

function snapshotOf(value: unknown): boolean {
  return value === true
}

export const designRoutes = Router({ mergeParams: true })

// 设计 → 开发交接包（D5）
designRoutes.use('/handoff', designHandoffRoutes)

designRoutes.get(
  '/',
  route((req, res) => {
    res.json(getDesign(appIdOf(req), moduleIdOf(req)))
  })
)

/** M4：设计页模板解析（模块设计项目 → 应用默认 → 全局默认；只读，不建项目） */
designRoutes.get(
  '/templates',
  route((req, res) => {
    const moduleId = moduleIdOf(req)
    res.json(resolveAppTemplates(appIdOf(req), moduleId || undefined))
  })
)

designRoutes.put(
  '/template',
  route((req, res) => {
    const appId = appIdOf(req)
    const body = (req.body ?? {}) as Record<string, unknown>
    // scope 缺省 = 只切当前模块（旧行为）；scope='app' = 全部未归档模块一起切换
    if (body.scope === 'app') {
      res.json(switchAppProtoTemplate(appId, body.templateId))
      return
    }
    res.json(switchProtoTemplate(appId, body.templateId, moduleIdOf(req, body)))
  })
)

designRoutes.post(
  '/template/preview',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(previewAppProtoTemplateSwitch(appIdOf(req), body.templateId))
  })
)

// ---- 设计输入 / 覆盖度 / 需求变更同步（H2—H4） ----

designRoutes.get(
  '/input',
  route((req, res) => {
    const appId = appIdOf(req)
    const moduleId = moduleIdOf(req)
    const project = getDesign(appId, moduleId)
    const scope = project.module.id
    const latest = latestRequirementBundle(appId)
    const bundle = latest ? { version: latest.version, hash: latest.hash } : null
    const inputId = typeof req.query.id === 'string' ? req.query.id.trim() : ''
    if (inputId) {
      const input = readDesignInput(appId, inputId, scope)
      if (!input) {
        res.status(404).json({ error: `设计输入不存在：${inputId}` })
        return
      }
      res.json({
        input,
        summary: summaryOf(input),
        stale: project.stale,
        bundle,
        bundleDrift: project.stale.bundleDrift
      })
      return
    }
    const docVersion = Number(req.query.docVersion)
    if (Number.isInteger(docVersion) && docVersion > 0) {
      const summary = listDesignInputs(appId, scope).find(item => item.docVersion === docVersion)
      const input = summary ? readDesignInput(appId, summary.id, scope) : null
      if (!input) {
        res.status(404).json({ error: `设计输入不存在：v${docVersion}` })
        return
      }
      res.json({
        input,
        summary: summaryOf(input),
        stale: project.stale,
        bundle,
        bundleDrift: project.stale.bundleDrift
      })
      return
    }
    const current = buildDesignInput(appId, scope)
    const latestInput = latestDesignInput(appId, scope)
    res.json({
      input: latestInput,
      summary: summaryOf(latestInput),
      bound: project.inputSummary,
      stale: computeStale(project.input, current, latestInput, current.bundleHash),
      bundle,
      bundleDrift: project.stale.bundleDrift,
      history: listDesignInputs(appId, scope)
    })
  })
)

/** M5：应用级设计总览（只读；不建项目/版本/输入） */
designRoutes.get(
  '/overview',
  route((req, res) => {
    res.json(designOverview(appIdOf(req)))
  })
)

designRoutes.get(
  '/coverage',
  route((req, res) => {
    const project = getDesign(appIdOf(req), moduleIdOf(req))
    res.json({ coverage: project.coverage, stale: project.stale })
  })
)

designRoutes.post(
  '/input/sync',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const result = syncDesignInput(appIdOf(req), body.mode, moduleIdOf(req, body))
    res.json(result)
  })
)

designRoutes.put(
  '/entities',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(
      saveEntities(appIdOf(req), body.entities, sourceOf(body.source), {
        snapshot: snapshotOf(body.snapshot),
        moduleId: moduleIdOf(req, body)
      })
    )
  })
)

designRoutes.post(
  '/generate-entities',
  asyncRoute(async (req, res) => {
    const appId = appIdOf(req)
    const body = (req.body ?? {}) as Record<string, unknown>
    const model = await resolveChatModel(appId, 'design', appDirOf(appId), body.model)
    const result = await generateEntitiesFromRequirement(appId, model, moduleIdOf(req, body))
    res.json({ project: result.project, warnings: result.warnings })
  })
)

designRoutes.post(
  '/page-sets/generate',
  asyncRoute(async (req, res) => {
    const appId = appIdOf(req)
    const body = (req.body ?? {}) as Record<string, unknown>
    const moduleId = moduleIdOf(req, body)
    if (body.mode === 'default') {
      res.json({ project: generateDefaultPageSets(appId, moduleId), warnings: [] })
      return
    }
    const model = await resolveChatModel(appId, 'design', appDirOf(appId), body.model)
    const result = await generatePageSetsFromRequirement(appId, model, moduleId)
    res.json({ project: result.project, warnings: result.warnings })
  })
)

/**
 * D-RMP：按 Epic 生成（实体合并 + 页面集 primary 替换；每 Epic 一个 ai 版本；不自动确认）
 * body：{ epicId, moduleId?, reopenConfirmed?, model? }
 */
designRoutes.post(
  '/generate-epic',
  asyncRoute(async (req, res) => {
    const appId = appIdOf(req)
    const body = (req.body ?? {}) as Record<string, unknown>
    const epicId = typeof body.epicId === 'string' ? body.epicId.trim() : ''
    if (!epicId) {
      res.status(400).json({ error: '缺少 epicId' })
      return
    }
    const model = await resolveChatModel(appId, 'design', appDirOf(appId), body.model)
    const result = await generateEpicDesign(appId, epicId, {
      moduleId: moduleIdOf(req, body),
      reopenConfirmed: body.reopenConfirmed === true,
      model
    })
    res.json(result)
  })
)

designRoutes.put(
  '/page-sets',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(
      savePageSets(appIdOf(req), body.pageSets, sourceOf(body.source), {
        snapshot: snapshotOf(body.snapshot),
        moduleId: moduleIdOf(req, body)
      })
    )
  })
)

designRoutes.put(
  '/page-sets/:pageSetId',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(savePageSet(appIdOf(req), req.params.pageSetId, body, moduleIdOf(req, body)))
  })
)

designRoutes.put(
  '/pages/:pageId',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(savePage(appIdOf(req), req.params.pageId, body, moduleIdOf(req, body)))
  })
)

designRoutes.post(
  '/pages/:pageId/snapshot',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(savePageSnapshot(appIdOf(req), req.params.pageId, body, moduleIdOf(req, body)))
  })
)

designRoutes.get(
  '/pages/:pageId/image',
  route((req, res) => {
    const file = pageImageFile(appIdOf(req), req.params.pageId, moduleIdOf(req))
    res.type('png')
    res.setHeader('Cache-Control', 'private, max-age=60')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    fs.createReadStream(file.abs).pipe(res)
  })
)

designRoutes.get(
  '/pages/:pageId/html',
  route((req, res) => {
    const file = pageHtmlFile(appIdOf(req), req.params.pageId, moduleIdOf(req))
    const filename = path.basename(file.abs)
    // 快照 HTML 来自浏览器 DOM，绝不能作为同源可执行页面打开
    res.type('text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'")
    res.setHeader('X-Content-Type-Options', 'nosniff')
    fs.createReadStream(file.abs).pipe(res)
  })
)

designRoutes.post(
  '/confirm',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const result = confirmDesign(appIdOf(req), moduleIdOf(req, body))
    res.json({
      project: result.project,
      alreadyConfirmed: result.alreadyConfirmed,
      appConfirmed: result.appConfirmed,
      pendingModuleIds: result.pendingModuleIds,
      module: { id: result.moduleId, key: result.moduleKey }
    })
  })
)

designRoutes.post(
  '/reopen',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json({ project: reopenDesign(appIdOf(req), moduleIdOf(req, body)) })
  })
)

designRoutes.get(
  '/versions',
  route((req, res) => {
    res.json({ versions: listDesignVersions(appIdOf(req), moduleIdOf(req)) })
  })
)

designRoutes.post(
  '/versions',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(createDesignVersion(appIdOf(req), moduleIdOf(req, body)))
  })
)

designRoutes.get(
  '/versions/:v',
  route((req, res) => {
    res.json({ version: getDesignVersion(appIdOf(req), req.params.v, moduleIdOf(req)) })
  })
)

designRoutes.post(
  '/versions/:v/rollback',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(rollbackDesignVersion(appIdOf(req), req.params.v, moduleIdOf(req, body)))
  })
)

designRoutes.get(
  '/chat',
  route((req, res) => {
    const result = readDesignChatWithMeta(appIdOf(req), moduleIdOf(req))
    res.json({ ...(result.chat as Record<string, unknown>), legacyFallback: result.legacyFallback })
  })
)

designRoutes.put(
  '/chat',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const saved = saveDesignChat(appIdOf(req), body, moduleIdOf(req, body))
    res.json({ ok: true, moduleId: saved.moduleId })
  })
)

