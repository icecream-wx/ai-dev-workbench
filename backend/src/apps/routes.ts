/**
 * 应用 API
 *
 * - 应用 CRUD：创建时渲染 EOS 模板 + 生成共享工作区（skills/commands/docs）
 * - 模板解析：GET /:id/templates
 * - 产物：GET /:id/artifacts、GET /:id/events（SSE 变化）
 * - 需求单文档：GET/POST /:id/requirements-document（缺失时生成骨架，不覆盖）
 * - 对话：POST /:id/chat（统一入口，view/module/command）
 * - 上下文：POST /:id/compact
 * - 会话：挂载 /:id/development（开发视图沿用；需求/设计用 ?view=）
 */
import { Router, type NextFunction, type Request, type Response } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { db, nowIso } from '../db'
import { appDirOf, removeAppDir, scaffoldApp, type AppSecretsInput } from './scaffold'
import { appPayload, type AppRow } from './payload'
import { resolveAppTemplates } from './template-resolution'
import {
  designSelectionInputFromBody,
  resolveAppDesignSystem,
  resolveDesignSelection,
  updateAppDesignSelection,
  writeDesignSelection
} from './design-system'
import {
  agentForModelStage,
  handleAppChat,
  isModelStage,
  resolveFallbackModel,
  saveStoredModel,
  storedModel,
  type ModelRef,
  type ModelStage
} from '../chat/service'
import { opencode } from '../opencode/runtime'
import { devRoutes } from '../dev/routes'
import { compactDevSession } from '../dev/service'
import { runDesignFidelity } from '../dev/fidelity'
import { resolveAssetFile } from '../design-template/paths'
import { getRequirementTemplateOrThrow } from '../requirements/templates'
import { writePrototypePackage } from '../design/prototypes'
import { ensureRequirementDoc, RequirementDocError } from '../requirements/doc-file'
import { ensureWorkspaceAssets } from '../templates/distribution'
import { readArtifacts } from '../workspace/artifacts'
import { subscribeAppEvents } from '../workspace/hub'

export const apps = Router()

type AsyncHandler = (req: Request, res: Response) => Promise<void>

function asyncRoute(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next)
  }
}

function httpError(status: number, message: string, extra?: Record<string, unknown>): Error & { status?: number; extra?: Record<string, unknown> } {
  const error = new Error(message) as Error & { status?: number; extra?: Record<string, unknown> }
  error.status = status
  error.extra = extra
  return error
}

/** 应用内设计模板资产的内容类型（扩展名白名单由 resolveAssetFile 保证） */
function designAssetContentType(file: string): string {
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

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const SECRET_FIELDS = ['eosSysKey', 'dbHost', 'dbPort', 'dbName', 'dbUser', 'dbPassword', 'mailHost', 'mailUsername', 'mailPassword'] as const
const VIEW_STATUS = new Set(['requirements', 'design', 'development', 'completed'])

export type { AppRow }

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function normalizeAppId(raw: unknown): string {
  const id = asString(raw)?.trim().toLowerCase() ?? ''
  if (!APP_ID_PATTERN.test(id)) {
    throw httpError(400, '应用 ID 只能包含小写字母、数字、短横线，且以字母或数字开头（最长 64 位）')
  }
  if (id === 'default') throw httpError(400, '应用 ID "default" 是保留值，请换一个')
  return id
}

function normalizePort(raw: unknown): number {
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw httpError(400, '后端端口需为 1024—65535 的整数')
  return port
}

function secretsFromBody(body: Record<string, unknown>): AppSecretsInput {
  const secrets: AppSecretsInput = {}
  for (const field of SECRET_FIELDS) {
    const value = asString(body[field])?.trim()
    if (value) secrets[field] = value
  }
  return secrets
}

function optionalTemplateId(raw: unknown): string | undefined {
  const value = asString(raw)?.trim()
  return value || undefined
}

function validateRequirementTemplate(requirementTemplateId: string | undefined): void {
  if (!requirementTemplateId) return
  try {
    getRequirementTemplateOrThrow(requirementTemplateId)
  } catch (error) {
    throw httpError(400, error instanceof Error ? error.message : `需求模板不存在或不可用：${requirementTemplateId}`)
  }
}

function appOrThrow(id: string): AppRow {
  const row = db.prepare('SELECT * FROM apps WHERE id = ?').get(id) as AppRow | undefined
  if (!row) throw httpError(404, `应用不存在：${id}`)
  return row
}

function appSettingKey(appId: string, name: string): string {
  return `app.${appId}.${name}`
}

/**
 * 创建后让 opencode 重新加载 location 配置。
 *
 * 注意（P1 实测）：opencode 的 location 是**惰性初始化**的——首次在该目录创建会话之前，
 * `GET /api/skill?location[directory]` 不包含项目级 skills（即使 reload 之后）。
 * 因此创建时只做 best-effort reload；真实的 skills/commands 加载校验在
 * 会话创建后执行（见 `chat/service.ts` 的 `verifyProjectAssets`）。
 */
async function warmLocations(): Promise<void> {
  if (!opencode.status().ready) return
  try {
    await opencode.reloadLocations()
  } catch (error) {
    console.warn(`[apps] reloadLocations 失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

// ---- 开发/需求/设计会话（view 过滤） ----
apps.use('/:id/development', devRoutes)

// ---- 应用 CRUD ----

apps.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM apps ORDER BY created_at DESC, rowid DESC').all() as AppRow[]
  res.json({ apps: rows.map(appPayload) })
})

apps.post(
  '/',
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const id = normalizeAppId(body.id)
    const name = asString(body.name)?.trim() || id
    const description = asString(body.description)?.trim() || null
    const backendPort = body.backendPort === undefined || body.backendPort === '' ? 8081 : normalizePort(body.backendPort)
    const secrets = secretsFromBody(body)
    const requirementTemplateId = optionalTemplateId(body.requirementTemplateId)
    // 设计系统：未传 → 默认 pack/应用类型/风格；非法 → 400（在落盘/建目录前校验）
    // 旧客户端可能仍带 prototypeTemplateId：忽略（不再有原型模板概念）
    const designSelection = resolveDesignSelection(designSelectionInputFromBody(body))

    validateRequirementTemplate(requirementTemplateId)

    if (db.prepare('SELECT 1 FROM apps WHERE id = ?').get(id)) throw httpError(409, `应用 ID 已存在：${id}`)
    if (fs.existsSync(appDirOf(id))) throw httpError(409, `应用目录已存在：projects/${id}`)

    const scaffolded = scaffoldApp({
      appId: id,
      appName: name,
      backendPort,
      secrets,
      requirementTemplateId: requirementTemplateId ?? null,
      designSystem: designSelection
    })
    const now = nowIso()
    try {
      db.transaction(() => {
        db.prepare(
          `INSERT INTO apps
             (id, name, description, dir, backend_port, status, requirement_template_id,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'requirements', ?, ?, ?)`
        ).run(id, name, description, id, backendPort, requirementTemplateId ?? null, now, now)
        writeDesignSelection(id, designSelection)
      })()
    } catch (error) {
      removeAppDir(id)
      throw error
    }
    await warmLocations()
    const warnings = scaffolded.warnings
    if (body.prototypeTemplateId !== undefined) {
      warnings.push('已忽略 prototypeTemplateId：设计模板统一由应用类型 × 视觉风格决定')
    }
    res.status(201).json({ app: appPayload(appOrThrow(id)), warnings })
  })
)

apps.get('/:id', (req, res) => {
  const row = appOrThrow(req.params.id)
  // 应用打开时做一次幂等对齐（覆盖式）；失败只记 warning，不影响读取
  const aligned = ensureWorkspaceAssets(row.id)
  if (aligned.warnings.length) console.warn(`[apps] 工作区对齐提示（${row.id}）：`, aligned.warnings.join('；'))
  res.json({ app: appPayload(row) })
})

apps.get('/:id/templates', (req, res) => {
  const row = appOrThrow(req.params.id)
  res.json(resolveAppTemplates(row.id))
})

/** 应用级设计系统：pack/应用类型/风格 + 页面库 */
apps.get('/:id/design-system', (req, res) => {
  const row = appOrThrow(req.params.id)
  res.json(resolveAppDesignSystem(row.id))
})

/**
 * P7-7c：应用内设计模板资产（只读）。
 * path 相对 `docs/design/template`，只允许 .css/.svg/.png/.jpg/.jpeg；路径安全由 resolveAssetFile 校验。
 */
apps.get('/:id/design-system/asset', (req, res) => {
  const row = appOrThrow(req.params.id)
  const root = path.join(appDirOf(row.id), 'docs', 'design', 'template')
  const file = resolveAssetFile(root, req.query.path)
  res.type(designAssetContentType(file))
  res.setHeader('Cache-Control', 'no-store')
  res.sendFile(file)
})

/** 更新应用级设计系统：body {pack?, applicationType?, style?}（也接受 designSystem 对象） */
apps.patch('/:id/design-system', (req, res, next) => {
  try {
    const row = appOrThrow(req.params.id)
    const body = (req.body ?? {}) as Record<string, unknown>
    const nested =
      body.designSystem && typeof body.designSystem === 'object' && !Array.isArray(body.designSystem)
        ? (body.designSystem as Record<string, unknown>)
        : undefined
    const selection = updateAppDesignSelection(row.id, {
      pack: body.pack ?? body.designPack ?? nested?.pack,
      applicationType: body.applicationType ?? body.designApplicationType ?? nested?.applicationType,
      style: body.style ?? body.designStyle ?? nested?.style
    })
    res.json({ designSystem: resolveAppDesignSystem(row.id), selection })
  } catch (error) {
    next(error)
  }
})

apps.delete('/:id', (req, res) => {
  const row = appOrThrow(req.params.id)
  if (req.query.confirm !== 'true') throw httpError(400, '删除应用需要确认：DELETE /api/apps/:id?confirm=true')

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM app_settings WHERE key LIKE ?').run(`${appSettingKey(row.id, '')}%`)
    db.prepare('DELETE FROM app_sessions WHERE app_id = ?').run(row.id)
    db.prepare('DELETE FROM apps WHERE id = ?').run(row.id)
  })
  tx()
  removeAppDir(row.id)
  res.json({ ok: true })
})

// ---- 产物 ----

apps.get('/:id/artifacts', (req, res) => {
  const row = appOrThrow(req.params.id)
  res.setHeader('Cache-Control', 'no-store')
  res.json(readArtifacts(row.id))
})

/**
 * P7-6a / D1：设计一致性静态检查（只读、只报告，应用级）
 * 无设计返回 200 + { empty: true, reason }，不 500。
 */
apps.post('/:id/design-fidelity', (req, res, next) => {
  try {
    const row = appOrThrow(req.params.id)
    const report = runDesignFidelity(row.id)
    res.setHeader('Cache-Control', 'no-store')
    res.json(report)
  } catch (error) {
    next(error)
  }
})

/** P6-3 / D1：原型 PNG + manifest + tokens 写入（应用级；校验全部通过才落盘） */
apps.post('/:id/design/prototypes', (req, res, next) => {
  try {
    const row = appOrThrow(req.params.id)
    res.json(writePrototypePackage(row.id, req.body))
  } catch (error) {
    next(error)
  }
})

/** 产物变化 SSE：docs/ 变化 → artifacts-changed {paths, hashes} */
apps.get('/:id/events', (req, res) => {
  const row = appOrThrow(req.params.id)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()

  const snapshot = readArtifacts(row.id)
  res.write(`data: ${JSON.stringify({ type: 'hello', appId: row.id, hashes: snapshot.hashes })}\n\n`)
  const subscription = subscribeAppEvents(row.id, res)
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n')
  }, 15000)
  heartbeat.unref?.()
  res.on('close', () => {
    clearInterval(heartbeat)
    subscription.close()
  })
})

// ---- 单需求文档（不写 DB；文件缺失时按默认模板生成骨架，已存在不覆盖） ----

apps.get('/:id/requirements-document', (req, res) => {
  const row = appOrThrow(req.params.id)
  const artifacts = readArtifacts(row.id)
  res.json({ requirement: artifacts.requirement })
})

apps.post('/:id/requirements-document', (req, res, next) => {
  try {
    const row = appOrThrow(req.params.id)
    const result = ensureRequirementDoc(row.id)
    const artifacts = readArtifacts(row.id)
    res.status(result.created ? 201 : 200).json({ ...result, requirement: artifacts.requirement })
  } catch (error) {
    next(error)
  }
})

// ---- 对话 / 上下文 ----

apps.post(
  '/:id/chat',
  asyncRoute(async (req, res) => {
    const app = appOrThrow(req.params.id)
    await handleAppChat({ id: app.id, name: app.name }, req, res)
  })
)

/** 按会话压缩上下文；body {view}（默认开发视图） */
apps.post(
  '/:id/compact',
  asyncRoute(async (req, res) => {
    const app = appOrThrow(req.params.id)
    const body = (req.body ?? {}) as { view?: unknown }
    res.json(await compactDevSession(app.id, { view: body.view }))
  })
)

function modelStageOf(raw: unknown): ModelStage {
  return isModelStage(raw) ? raw : 'requirements'
}

apps.get(
  '/:id/model',
  asyncRoute(async (req, res) => {
    const app = appOrThrow(req.params.id)
    const stage = modelStageOf(req.query.stage)
    let fallback: ModelRef | null = null
    if (opencode.status().ready) {
      fallback = await resolveFallbackModel(appDirOf(app.id))
    }
    res.json({ stage, agent: agentForModelStage(stage), model: storedModel(app.id, stage), fallback })
  })
)

apps.put(
  '/:id/model',
  asyncRoute(async (req, res) => {
    const app = appOrThrow(req.params.id)
    const body = (req.body ?? {}) as { stage?: unknown; model?: unknown }
    const stage = modelStageOf(body.stage)
    if (body.model === null) {
      saveStoredModel(app.id, stage, null)
      res.json({ ok: true, stage, model: null })
      return
    }
    if (!body.model || typeof body.model !== 'object') throw httpError(400, 'model 需要为 {providerID,id} 或 null')
    const provided = body.model as Record<string, unknown>
    if (typeof provided.providerID !== 'string' || typeof provided.id !== 'string') {
      throw httpError(400, 'model 需要 providerID 和 id')
    }
    const models = await opencode.listModels(appDirOf(app.id))
    const hit = models.find(
      model =>
        model.providerID === provided.providerID && (model.modelID === provided.id || model.id === provided.id)
    )
    if (!hit) throw httpError(400, `模型不存在或未启用：${provided.providerID}/${provided.id}`)
    const model: ModelRef = { providerID: hit.providerID, id: hit.modelID }
    saveStoredModel(app.id, stage, model)
    res.json({ ok: true, stage, model })
  })
)

/** 视图标签（无门禁语义）：PATCH /api/apps/:id/status {status} */
apps.patch('/:id/status', (req, res) => {
  const row = appOrThrow(req.params.id)
  const status = asString((req.body as Record<string, unknown>)?.status)?.trim() ?? ''
  if (!VIEW_STATUS.has(status)) throw httpError(400, 'status 只能是 requirements/design/development/completed')
  db.prepare('UPDATE apps SET status = ?, updated_at = ? WHERE id = ?').run(status, nowIso(), row.id)
  res.json({ app: appPayload(appOrThrow(row.id)) })
})

/** /api/apps/* 的统一错误出口 */
export function appsErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error)
    return
  }
  const typed = error as { status?: unknown; extra?: Record<string, unknown>; issues?: unknown; warnings?: unknown }
  const status =
    typeof typed?.status === 'number'
      ? typed.status
      : error instanceof RequirementDocError
        ? error.status
        : 500
  const message = error instanceof Error ? error.message : String(error)
  res.status(status).json({
    error: message,
    ...(typed?.extra ?? {}),
    ...(Array.isArray(typed?.issues) ? { issues: typed.issues } : {}),
    ...(Array.isArray(typed?.warnings) ? { warnings: typed.warnings } : {})
  })
}
