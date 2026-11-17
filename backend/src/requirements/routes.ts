/**
 * 需求模板 + 需求文档 API（R1 / M2 模块化）
 *
 * 模板（挂载 /api/requirement-templates）：
 *   GET    /?stage=requirements&category=&q=&visibility=
 *   POST   /                       新建“我的模板”
 *   PUT    /:id                    保存“我的模板”（内置只读）
 *   DELETE /:id                    删除“我的模板”
 *   POST   /:id/duplicate          复制为新模板
 *
 * 文档（挂载 /api/apps/:id/requirements-doc，应用必须存在）：
 *   GET    /                       文档 + 模板 + 状态 + 版本 + 章节（无则按默认模板创建）
 *   POST   /preview                AI 建议预览（不写库、不产版本）
 *   PUT    /sections/:key          自动保存单章节
 *   PUT    /                       高级全文保存（contentMd）或章节更新（sections，AI 应用复用）
 *   PUT    /template               切换模板（scope=module 缺省：仅当前模块；scope=app：全部未归档模块，M3）
 *   POST   /template/preview       应用级切换预览（只读，M3）
 *   POST   /confirm                确认需求（按模块；单模块时进入设计）
 *   POST   /outline/rebuild        从 Markdown 重建结构化章节
 *   POST   /reopen                 重新编辑需求（模块回 draft）
 *   GET    /versions               版本列表（含变更单序号）
 *   POST   /versions               手动保存版本（source=manual）
 *   GET    /versions/:v            版本内容/章节快照
 *   POST   /versions/:v/rollback   回滚到版本（source=rollback）
 *   GET    /export                 只读导出 01-REQUIREMENTS.md
 *   GET/PUT /chat                  doc 模式对话（app_settings 持久化）
 *
 * 模块（挂载 /api/apps/:id/requirements-modules，M2）：
 *   GET    /?includeArchived=     模块列表 + 文档摘要 + defaultModuleId（只读）
 *   POST   /                      新增模块（复制应用需求模板，建空文档 v1；仅需求阶段）
 *   PATCH  /:moduleId             title/description/ownerLabel/required/position
 *   POST   /:moduleId/archive     归档（至少保留 1 个未归档）
 *   POST   /:moduleId/restore     恢复归档
 *   PUT    /order                 模块排序（moduleIds 必须等于全部未归档模块，M3）
 *
 * 需求 bundle（挂载 /api/apps/:id/requirements-bundle，M2）：
 *   GET    /                      只读聚合（模块版本/确认/聚合 hash；不建模块/文档/bundle）
 *   POST   /confirm               全部必选模块 confirmed → 生成 bundle + 应用确认 + 进入设计
 *
 * 原型预览（挂载 /api/apps/:id/requirements-prototype，M7 / M7-2）：
 *   GET    /?moduleId=            Epic→页面集、Story→页面 + `spec`/`specState`（只读，不写库/不产文件）
 *   POST   /spec?moduleId=        生成/重新生成预览规格（唯一写入 = settings 键；调需求阶段 agent）
 *
 * M2 兼容：所有文档接口都接受可选 `moduleId`（GET 走 query，POST/PUT/PATCH 走 body 或 query）；
 * 缺省/空串 → 默认模块（懒创建）；未知 ID → 404；已归档模块读允许、写 409。
 */
import { Router, type NextFunction, type Request, type Response } from 'express'
import { db, readSetting, writeSetting } from '../db'
import {
  confirmRequirementDoc,
  createManualDocVersion,
  ensureRequirementDoc,
  exportRequirementDoc,
  getDocVersion,
  listDocVersions,
  previewAppDocTemplate,
  previewDoc,
  rebuildRequirementOutline,
  reopenRequirementDoc,
  rollbackDocVersion,
  saveDoc,
  saveDocSection,
  switchDocTemplate,
  switchDocTemplateForApp
} from './doc'
import { RequirementDocError } from './templates'
import { createTemplate, deleteTemplate, duplicateTemplate, getTemplateOrThrow, listTemplates, updateTemplate } from './templates'
import {
  archiveModule,
  assertModuleWritable,
  confirmRequirementBundle,
  createModule,
  defaultModule,
  listModules,
  moduleById,
  reorderModules,
  requirementBundleView,
  resolveModule,
  restoreModule,
  updateModule
} from './modules'
import { applyModulePlan, readAppliedModulePlan } from './module-plan'
import { applyModuleReplan, previewModuleReplan } from './module-replan'
import { buildRequirementPrototypePreview } from './prototype-preview'
import { buildPrototypeSpecView, generatePrototypeSpec } from './prototype-spec'
import {
  prepareModuleGeneration,
  runModuleGeneration,
  type ModuleGenerationEvent
} from './module-generation'
import { redact } from '../opencode/redact'

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
    const templates = listTemplates({
      stage: req.query.stage,
      category: req.query.category,
      q: req.query.q,
      visibility: req.query.visibility
    })
    res.json({ templates })
  })
)

requirementTemplateRoutes.post(
  '/',
  route((req, res) => {
    const template = createTemplate((req.body ?? {}) as Record<string, unknown>)
    res.status(201).json({ template })
  })
)

requirementTemplateRoutes.put(
  '/:id',
  route((req, res) => {
    const template = updateTemplate(req.params.id, (req.body ?? {}) as Record<string, unknown>)
    res.json({ template })
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
    const template = duplicateTemplate(req.params.id, body.name)
    res.status(201).json({ template })
  })
)

requirementTemplateRoutes.get(
  '/:id',
  route((req, res) => {
    res.json({ template: getTemplateOrThrow(req.params.id) })
  })
)

/** /api/requirement-templates 统一错误出口 */
export function requirementErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error)
    return
  }
  const typed = error as { status?: unknown; issues?: unknown; warnings?: unknown; detail?: unknown }
  const status = typeof typed?.status === 'number' ? typed.status : 500
  const message = error instanceof Error ? error.message : String(error)
  res.status(status).json({
    error: message,
    ...(Array.isArray(typed?.issues) ? { issues: typed.issues } : {}),
    ...(Array.isArray(typed?.warnings) ? { warnings: typed.warnings } : {}),
    ...(typeof typed?.detail === 'string' && typed.detail ? { detail: typed.detail } : {})
  })
}

function chatSettingKey(appId: string, moduleId?: string): string {
  // M3 §3.3：按模块拆分；旧应用级 key 保留（只读回退，不删除/覆盖）
  return moduleId ? `app.${appId}.requirementsDocChat.${moduleId}` : `app.${appId}.requirementsDocChat`
}

/** 模块 ID 解析（M2 §9.4.1）：query 优先，其次 body；trim；空串视为缺省 */
function moduleIdOf(req: Request, body?: Record<string, unknown>): string | undefined {
  const fromQuery = typeof req.query.moduleId === 'string' ? req.query.moduleId : undefined
  if (fromQuery !== undefined) return fromQuery.trim()
  const fromBody = body && typeof body.moduleId === 'string' ? body.moduleId : undefined
  return fromBody === undefined ? undefined : fromBody.trim()
}

export const requirementDocRoutes = Router({ mergeParams: true })

/** 应用存在性守卫（R4b-2：应用固定文档模式，不再有 structured 分支） */
function requireApp(req: Request, _res: Response, next: NextFunction): void {
  const appId = String(req.params.id)
  const row = db.prepare('SELECT id FROM apps WHERE id = ?').get(appId) as { id: string } | undefined
  if (!row) {
    next(new RequirementDocError(404, `应用不存在：${appId}`))
    return
  }
  next()
}

requirementDocRoutes.use(requireApp)

requirementDocRoutes.get(
  '/',
  route((req, res) => {
    const appId = String(req.params.id)
    const templateId = typeof req.query.templateId === 'string' ? req.query.templateId : undefined
    res.json(ensureRequirementDoc(appId, templateId, moduleIdOf(req)))
  })
)

requirementDocRoutes.post(
  '/preview',
  route((req, res) => {
    const appId = String(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(previewDoc(appId, body, moduleIdOf(req, body)))
  })
)

requirementDocRoutes.put(
  '/sections/:key',
  route((req, res) => {
    const appId = String(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>
    const payload = saveDocSection(appId, req.params.key, body, moduleIdOf(req, body))
    res.json(payload)
  })
)

requirementDocRoutes.put(
  '/',
  route((req, res) => {
    const appId = String(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>
    const payload = saveDoc(appId, body, moduleIdOf(req, body))
    res.json(payload)
  })
)

requirementDocRoutes.post(
  '/template/preview',
  route((req, res) => {
    const appId = String(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>
    // M3 UI 固定应用级预览；scope 缺省 = app（只读，不写库/不产版本）
    const templateId = body.templateId
    res.json(previewAppDocTemplate(appId, templateId))
  })
)

requirementDocRoutes.put(
  '/template',
  route((req, res) => {
    const appId = String(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>
    // 旧行为：不传 scope（或 scope=module）= 只切当前模块；scope=app = 应用级（M3）
    if (body.scope === 'app') {
      res.json(switchDocTemplateForApp(appId, body.templateId))
      return
    }
    const payload = switchDocTemplate(appId, body.templateId, moduleIdOf(req, body))
    res.json(payload)
  })
)

requirementDocRoutes.post(
  '/confirm',
  route((req, res) => {
    const appId = String(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>
    const result = confirmRequirementDoc(appId, moduleIdOf(req, body))
    res.json({
      ...result.payload,
      warnings: result.warnings,
      alreadyConfirmed: result.alreadyConfirmed,
      appConfirmed: result.appConfirmed,
      pendingModuleIds: result.pendingModuleIds,
      module: result.module,
      ...(result.bundleVersion ? { bundleVersion: result.bundleVersion } : {})
    })
  })
)

requirementDocRoutes.post(
  '/outline/rebuild',
  route((req, res) => {
    const appId = String(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>
    const payload = rebuildRequirementOutline(
      appId,
      typeof body.sectionKey === 'string' ? body.sectionKey : undefined,
      moduleIdOf(req, body)
    )
    res.json(payload)
  })
)

requirementDocRoutes.post(
  '/reopen',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(reopenRequirementDoc(String(req.params.id), moduleIdOf(req, body)))
  })
)

requirementDocRoutes.get(
  '/versions',
  route((req, res) => {
    res.json({ versions: listDocVersions(String(req.params.id), moduleIdOf(req)) })
  })
)

requirementDocRoutes.post(
  '/versions',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const payload = createManualDocVersion(String(req.params.id), moduleIdOf(req, body))
    res.json(payload)
  })
)

requirementDocRoutes.get(
  '/versions/:v',
  route((req, res) => {
    res.json({ version: getDocVersion(String(req.params.id), req.params.v, moduleIdOf(req)) })
  })
)

requirementDocRoutes.post(
  '/versions/:v/rollback',
  route((req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const payload = rollbackDocVersion(String(req.params.id), req.params.v, moduleIdOf(req, body))
    res.json(payload)
  })
)

requirementDocRoutes.get(
  '/export',
  route((req, res) => {
    res.json(exportRequirementDoc(String(req.params.id), moduleIdOf(req)))
  })
)

requirementDocRoutes.get(
  '/chat',
  route((req, res) => {
    const appId = String(req.params.id)
    const app = db.prepare('SELECT id FROM apps WHERE id = ?').get(appId)
    if (!app) throw new RequirementDocError(404, `应用不存在：${appId}`)
    const requested = moduleIdOf(req)
    const defaultRow = defaultModule(appId)
    // 显式 moduleId 必须存在（读允许归档）；未知模块 404，避免被误判为“无历史”
    if (requested && !moduleById(appId, requested)) {
      throw new RequirementDocError(404, `模块不存在：${requested}`)
    }
    if (!defaultRow) {
      // 没有模块（旧应用尚未创建文档）：保持旧行为，直接读应用级 key
      res.json(readSetting<{ messages?: unknown[] }>(chatSettingKey(appId)) ?? { messages: [] })
      return
    }
    const isDefault = !requested || requested === defaultRow.id
    const targetId = requested || defaultRow.id
    const moduleValue = readSetting<{ messages?: unknown[]; legacyFallback?: boolean }>(chatSettingKey(appId, targetId))
    if (moduleValue) {
      res.json(moduleValue)
      return
    }
    if (isDefault) {
      const legacy = readSetting<{ messages?: unknown[] }>(chatSettingKey(appId))
      if (legacy) {
        // 旧应用级历史只读回退到默认模块（不删除/不改写旧 key）
        res.json({ ...legacy, legacyFallback: true })
        return
      }
    }
    res.json({ messages: [] })
  })
)

requirementDocRoutes.put(
  '/chat',
  route((req, res) => {
    const appId = String(req.params.id)
    const app = db.prepare('SELECT id FROM apps WHERE id = ?').get(appId)
    if (!app) throw new RequirementDocError(404, `应用不存在：${appId}`)
    const body = (req.body ?? {}) as { messages?: unknown[] }
    const messages = Array.isArray(body.messages) ? body.messages : []
    const requested = moduleIdOf(req, body as Record<string, unknown>)
    // M2 兼容：没有模块（旧应用尚未创建文档）且未显式指定 moduleId → 仍写旧应用级 key
    if (!requested && !defaultModule(appId)) {
      writeSetting(chatSettingKey(appId), { messages })
      res.json({ ok: true, legacy: true })
      return
    }
    const module = resolveModule(appId, requested)
    assertModuleWritable(module)
    // 只写模块 key；旧应用级 key 保留不动
    writeSetting(chatSettingKey(appId, module.id), { messages })
    res.json({ ok: true, moduleId: module.id })
  })
)

/**
 * M7（#8）+ M7-2：需求阶段参考原型预览。
 *
 * GET：M7 确定性 Epic→页面集/Story→页面（只读）+ `spec`/`specState` 增量（预览规格）；
 * POST /spec：按模块 PRD 由需求阶段 agent 生成预览规格（唯一写入 = settings 键）。
 * 不写设计/交接包/Change Set/阶段/会话；归档模块 GET 允许、POST 409。
 */
export const requirementPrototypeRoutes = Router({ mergeParams: true })
requirementPrototypeRoutes.use(requireApp)

requirementPrototypeRoutes.get(
  '/',
  route((req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const preview = buildRequirementPrototypePreview(String(req.params.id), moduleIdOf(req))
    const specView = buildPrototypeSpecView(String(req.params.id), preview.module?.id ?? null)
    res.json({ ...preview, ...specView })
  })
)

/**
 * M7-2：生成/重新生成预览规格（非 SSE）。
 *
 * 客户端断开时 abort 当前模型生成；必须监听 `res.on('close')`（`req.on('close')`
 * 在请求体读取完成后就可能触发，会误杀生成）。
 */
requirementPrototypeRoutes.post('/spec', (req: Request, res: Response, next: NextFunction) => {
  const appId = String(req.params.id)
  const controller = new AbortController()
  const onClose = (): void => {
    if (res.writableEnded) return
    controller.abort()
  }
  res.on('close', onClose)
  void generatePrototypeSpec(appId, moduleIdOf(req), { signal: controller.signal })
    .then(result => {
      if (res.writableEnded) return
      const view = buildPrototypeSpecView(appId, result.moduleId)
      res.json({ spec: result.spec, specState: view.specState })
    })
    .catch(error => {
      if (!res.writableEnded) next(error)
    })
    .finally(() => {
      res.removeListener('close', onClose)
    })
})

/** /api/apps/:id/requirements-modules（M2） */
export const requirementModuleRoutes = Router({ mergeParams: true })
requirementModuleRoutes.use(requireApp)

requirementModuleRoutes.get(
  '/',
  route((req, res) => {
    const appId = String(req.params.id)
    const includeArchived = req.query.includeArchived === 'true' || req.query.includeArchived === '1'
    const defaultRow = defaultModule(appId)
    res.json({
      modules: listModules(appId, includeArchived),
      defaultModuleId: defaultRow?.id ?? null,
      planKind: readAppliedModulePlan(appId)?.kind ?? null
    })
  })
)

requirementModuleRoutes.post(
  '/',
  route((req, res) => {
    const appId = String(req.params.id)
    const module = createModule(appId, (req.body ?? {}) as Record<string, unknown>)
    res.status(201).json({ module })
  })
)

/** RMP-1：应用首次模块拆分建议（复用默认模块 + 新建其余；不生成文档） */
requirementModuleRoutes.post(
  '/plan/apply',
  route((req, res) => {
    const appId = String(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(applyModulePlan(appId, body.plan))
  })
)

/**
 * RMP-2：基于当前全部需求重新规划（只读预览）。
 *
 * 普通 JSON（非 SSE）；守卫/模型失败按普通 HTTP 错误返回，不写库。
 * 客户端断开时 abort 当前模型生成（与聊天/生成 SSE 同口径：res.on('close')）。
 */
requirementModuleRoutes.post('/replan/preview', (req: Request, res: Response, next: NextFunction) => {
  const appId = String(req.params.id)
  const body = (req.body ?? {}) as Record<string, unknown>
  const controller = new AbortController()
  const onClose = (): void => {
    if (res.writableEnded) return
    controller.abort()
  }
  res.on('close', onClose)
  void previewModuleReplan(appId, body, { signal: controller.signal })
    .then(result => {
      if (!res.writableEnded) res.json(result)
    })
    .catch(error => {
      if (!res.writableEnded) next(error)
    })
    .finally(() => {
      res.removeListener('close', onClose)
    })
})

/** RMP-2：应用重新规划结构（单事务；不生成文档，生成由前端接着调 /generate） */
requirementModuleRoutes.post(
  '/replan/apply',
  route((req, res) => {
    const appId = String(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json(applyModuleReplan(appId, body))
  })
)

/**
 * RMP-1：逐模块生成完整 PRD（SSE）。
 * 校验在写 SSE 头之前完成（阶段/规划/模块守卫），失败按普通 HTTP 错误返回。
 */
requirementModuleRoutes.post('/generate', (req: Request, res: Response, next: NextFunction) => {
  const appId = String(req.params.id)
  const body = (req.body ?? {}) as Record<string, unknown>
  let prepared: ReturnType<typeof prepareModuleGeneration>
  try {
    prepared = prepareModuleGeneration(appId, body)
  } catch (error) {
    next(error)
    return
  }

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()

  let closed = false
  const controller = new AbortController()
  const write = (event: ModuleGenerationEvent): void => {
    if (closed || res.writableEnded) return
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }
  const heartbeat = setInterval(() => {
    if (!closed && !res.writableEnded) res.write(': ping\n\n')
  }, 15000)
  heartbeat.unref?.()

  const onClose = (): void => {
    if (res.writableEnded) return
    closed = true
    controller.abort()
  }
  // 本路由必须监听 res：Node/Express 下 req 的 close 在请求体完成后就可能触发（不代表客户端断开），
  // 会导致生成刚开始就被 abort。聊天 SSE 同样使用 res.on('close')。
  res.on('close', onClose)

  void runModuleGeneration(prepared, { signal: controller.signal, onEvent: write })
    .catch(error => {
      const message = redact(error instanceof Error ? error.message : String(error))
      write({ type: 'module-error', error: message })
    })
    .finally(() => {
      clearInterval(heartbeat)
      res.removeListener('close', onClose)
      if (!closed && !res.writableEnded) res.end()
    })
})

requirementModuleRoutes.put(
  '/order',
  route((req, res) => {
    const appId = String(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>
    res.json({ modules: reorderModules(appId, body.moduleIds) })
  })
)

requirementModuleRoutes.patch(
  '/:moduleId',
  route((req, res) => {
    const appId = String(req.params.id)
    const module = updateModule(appId, req.params.moduleId, (req.body ?? {}) as Record<string, unknown>)
    res.json({ module })
  })
)

requirementModuleRoutes.post(
  '/:moduleId/archive',
  route((req, res) => {
    res.json({ module: archiveModule(String(req.params.id), req.params.moduleId) })
  })
)

requirementModuleRoutes.post(
  '/:moduleId/restore',
  route((req, res) => {
    res.json({ module: restoreModule(String(req.params.id), req.params.moduleId) })
  })
)

/** /api/apps/:id/requirements-bundle（M2） */
export const requirementBundleRoutes = Router({ mergeParams: true })
requirementBundleRoutes.use(requireApp)

requirementBundleRoutes.get(
  '/',
  route((req, res) => {
    res.json({ bundle: requirementBundleView(String(req.params.id)) })
  })
)

requirementBundleRoutes.post(
  '/confirm',
  route((req, res) => {
    const appId = String(req.params.id)
    const result = confirmRequirementBundle(appId)
    const app = db.prepare('SELECT status, requirements_confirmed_at FROM apps WHERE id = ?').get(appId) as
      | { status: string; requirements_confirmed_at: string | null }
      | undefined
    res.json({
      bundle: result.bundle,
      appConfirmed: result.appConfirmed,
      alreadyConfirmed: result.alreadyConfirmed,
      pendingModuleIds: result.pendingModuleIds,
      appStatus: app?.status ?? null,
      requirementsConfirmedAt: app?.requirements_confirmed_at ?? null
    })
  })
)
