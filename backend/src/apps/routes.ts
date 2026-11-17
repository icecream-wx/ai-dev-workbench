/**
 * 应用 API（P1）
 *
 * - 应用 CRUD：创建时渲染 EOS 模板到 projects/<id>/，删除只删本地目录与登记
 * - 需求（文档模式）/设计（Studio）/开发（原生会话）挂载在 /:id/* 子路由
 * - 三阶段：requirements → design → development → completed
 *
 * 说明：R4b-2 起新应用固定文档模式；旧 structured 需求（workspace/modules/旧 P3 交接包）已移除。
 * 设计阶段“完成”在 DesignStudio 里生成设计交接包并进入开发（D5）。
 */
import { Router, type NextFunction, type Request, type Response } from 'express'
import fs from 'node:fs'
import { db, nowIso } from '../db'
import { appDirOf, removeAppDir, scaffoldApp, type AppSecretsInput } from './scaffold'
import { appPayload, type AppRow } from './payload'
import { resolveAppTemplates } from './template-resolution'
import { changeSetRoutes } from '../changesets/routes'
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
import { completeActiveChangeSet, deleteDesignHandoffData } from '../handoff/design-service'
import { devRoutes } from '../dev/routes'
import { deleteDevPhaseData } from '../dev/phases'
import { designRoutes } from '../design/routes'
import { deleteDesignData } from '../design/service'
import { confirmRequirementDoc } from '../requirements/doc'
import { requirementBundleRoutes, requirementDocRoutes, requirementModuleRoutes, requirementPrototypeRoutes } from '../requirements/routes'
import { RequirementDocError, getRequirementTemplateOrThrow } from '../requirements/templates'
import { getPrototypeTemplateOrThrow } from '../design/templates'

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

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const SECRET_FIELDS = ['eosSysKey', 'dbHost', 'dbPort', 'dbName', 'dbUser', 'dbPassword', 'mailHost', 'mailUsername', 'mailPassword'] as const

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

/** #7：可选的模板 ID；空字符串视为未提供（保存 null，读取时回退默认） */
function optionalTemplateId(raw: unknown): string | undefined {
  const value = asString(raw)?.trim()
  return value || undefined
}

/** 创建前校验模板可用；非法/不存在统一 400（不创建目录/登记） */
function validateTemplates(requirementTemplateId: string | undefined, prototypeTemplateId: string | undefined): void {
  if (requirementTemplateId) {
    try {
      getRequirementTemplateOrThrow(requirementTemplateId)
    } catch (error) {
      throw httpError(
        400,
        error instanceof Error ? error.message : `需求模板不存在或不可用：${requirementTemplateId}`
      )
    }
  }
  if (prototypeTemplateId) {
    try {
      getPrototypeTemplateOrThrow(prototypeTemplateId)
    } catch (error) {
      throw httpError(400, error instanceof Error ? error.message : `原型模板不存在或不可用：${prototypeTemplateId}`)
    }
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

function recordStageEvent(appId: string, stage: string, event: string, detail?: Record<string, unknown>): void {
  db.prepare('INSERT INTO app_stage_events (app_id, stage, event, detail, created_at) VALUES (?, ?, ?, ?, ?)').run(
    appId,
    stage,
    event,
    detail ? JSON.stringify(detail) : null,
    nowIso()
  )
}

// ---- 变更单（C1） ----
apps.use('/:id/change-sets', changeSetRoutes)

// ---- 开发会话 ----
apps.use('/:id/development', devRoutes)

// ---- 需求文档（R1，文档模式） ----
apps.use('/:id/requirements-doc', requirementDocRoutes)

// ---- 需求模块 + 需求聚合快照（M2，#6） ----
apps.use('/:id/requirements-modules', requirementModuleRoutes)
apps.use('/:id/requirements-bundle', requirementBundleRoutes)

// ---- 需求阶段只读原型预览（M7，#8；不写库/不产文件） ----
apps.use('/:id/requirements-prototype', requirementPrototypeRoutes)

// ---- 设计 Studio（D1—D4：实体 + 页面原型；交接包见 /design/handoff） ----
apps.use('/:id/design', designRoutes)

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
    const prototypeTemplateId = optionalTemplateId(body.prototypeTemplateId)

    // 模板校验先于 scaffold/写库：非法模板不创建目录、不登记
    validateTemplates(requirementTemplateId, prototypeTemplateId)

    if (db.prepare('SELECT 1 FROM apps WHERE id = ?').get(id)) throw httpError(409, `应用 ID 已存在：${id}`)
    if (fs.existsSync(appDirOf(id))) throw httpError(409, `应用目录已存在：projects/${id}`)

    scaffoldApp({ appId: id, appName: name, backendPort, secrets })
    const now = nowIso()
    try {
      db.prepare(
        `INSERT INTO apps
           (id, name, description, dir, backend_port, status, requirement_template_id, prototype_template_id,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'requirements', ?, ?, ?, ?)`
      ).run(
        id,
        name,
        description,
        id,
        backendPort,
        requirementTemplateId ?? null,
        prototypeTemplateId ?? null,
        now,
        now
      )
      recordStageEvent(id, 'requirements', 'created')
    } catch (error) {
      removeAppDir(id)
      throw error
    }
    res.status(201).json({ app: appPayload(appOrThrow(id)) })
  })
)

apps.get('/:id', (req, res) => {
  res.json({ app: appPayload(appOrThrow(req.params.id)) })
})

/**
 * #7：只读模板解析（供需求阶段原型预览等使用）。
 * - requirement：已有文档 → 文档模板；否则应用默认 → 全局默认
 * - prototype：设计项目 → 应用默认 → 全局默认
 * 不创建需求文档/设计项目。
 */
apps.get('/:id/templates', (req, res) => {
  const row = appOrThrow(req.params.id)
  const moduleId = typeof req.query.moduleId === 'string' ? req.query.moduleId.trim() : ''
  res.json(resolveAppTemplates(row.id, moduleId || undefined))
})

apps.delete('/:id', (req, res) => {
  const row = appOrThrow(req.params.id)
  if (req.query.confirm !== 'true') throw httpError(400, '删除应用需要确认：DELETE /api/apps/:id?confirm=true')

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM app_settings WHERE key LIKE ?').run(`${appSettingKey(row.id, '')}%`)
    db.prepare('DELETE FROM app_stage_events WHERE app_id = ?').run(row.id)
    db.prepare('DELETE FROM app_sessions WHERE app_id = ?').run(row.id)
    deleteDevPhaseData(row.id)
    db.prepare('DELETE FROM app_requirement_bundles WHERE app_id = ?').run(row.id)
    db.prepare('DELETE FROM app_requirement_doc_versions WHERE app_id = ?').run(row.id)
    db.prepare('DELETE FROM app_requirement_doc_sections WHERE app_id = ?').run(row.id)
    db.prepare('DELETE FROM app_requirement_docs WHERE app_id = ?').run(row.id)
    db.prepare('DELETE FROM app_modules WHERE app_id = ?').run(row.id)
    // M5：变更单模块范围（随变更单删除；放在 deleteDesignHandoffData 之前）
    db.prepare(
      'DELETE FROM app_change_set_modules WHERE change_set_id IN (SELECT id FROM app_change_sets WHERE app_id = ?)'
    ).run(row.id)
    deleteDesignHandoffData(row.id)
    deleteDesignData(row.id)
    db.prepare('DELETE FROM apps WHERE id = ?').run(row.id)
  })
  tx()
  removeAppDir(row.id)
  res.json({ ok: true })
})

// ---- 阶段 ----

apps.post('/:id/stage/confirm', (req, res) => {
  const row = appOrThrow(req.params.id)
  const stage = asString((req.body as Record<string, unknown>)?.stage)?.trim()
  if (stage !== 'requirements' && stage !== 'design') throw httpError(400, 'stage 只能是 requirements 或 design')
  const now = nowIso()

  if (stage === 'requirements') {
    if (row.requirements_confirmed_at) return res.json({ app: appPayload(row), alreadyConfirmed: true })
    if (row.status !== 'requirements') throw httpError(409, `当前阶段不是需求（${row.status}）`)
    // 文档模式：必填章节 + 至少一个用户故事；待澄清只做警告（M2：默认模块）
    try {
      const payload = confirmRequirementDoc(row.id)
      return res.json({
        app: appPayload(appOrThrow(row.id)),
        document: { version: payload.payload.doc.version },
        appConfirmed: payload.appConfirmed
      })
    } catch (error) {
      if (error instanceof RequirementDocError) {
        return res.status(error.status).json({ error: error.message, issues: error.issues, warnings: error.warnings })
      }
      throw error
    }
  }

  // design：在设计 Studio 中确认设计并生成交接包（D5）；顶栏不再重复确认设计
  throw httpError(
    409,
    '请在设计 Studio 中确认设计，并点击「生成交接包并进入开发」；顶栏不再重复确认设计。'
  )
})

apps.post('/:id/complete', (req, res) => {
  const row = appOrThrow(req.params.id)
  if (row.status === 'completed') return res.json({ app: appPayload(row), alreadyCompleted: true })
  if (row.status !== 'development') throw httpError(409, '只有开发阶段可以确认完成')
  const now = nowIso()
  const lastSession = db
    .prepare('SELECT opencode_session_id FROM app_sessions WHERE app_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(row.id) as { opencode_session_id: string | null } | undefined
  db.prepare(`UPDATE apps SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`).run(now, now, row.id)
  completeActiveChangeSet(row.id)
  recordStageEvent(row.id, 'development', 'completed', {
    lastSessionId: lastSession?.opencode_session_id ?? null
  })
  res.json({ app: appPayload(appOrThrow(row.id)) })
})

// ---- 需求/设计对话与模型 ----

apps.post(
  '/:id/chat',
  asyncRoute(async (req, res) => {
    const app = appOrThrow(req.params.id)
    await handleAppChat({ id: app.id, name: app.name }, req, res)
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
        model.providerID === provided.providerID &&
        (model.modelID === provided.id || model.id === provided.id)
    )
    if (!hit) throw httpError(400, `模型不存在或未启用：${provided.providerID}/${provided.id}`)
    const model: ModelRef = { providerID: hit.providerID, id: hit.modelID }
    saveStoredModel(app.id, stage, model)
    res.json({ ok: true, stage, model })
  })
)

/** /api/apps/* 的统一错误出口 */
export function appsErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error)
    return
  }
  const typed = error as { status?: unknown; extra?: Record<string, unknown>; issues?: unknown; warnings?: unknown }
  const status = typeof typed?.status === 'number' ? typed.status : 500
  const message = error instanceof Error ? error.message : String(error)
  res.status(status).json({
    error: message,
    ...(typed?.extra ?? {}),
    ...(Array.isArray(typed?.issues) ? { issues: typed.issues } : {}),
    ...(Array.isArray(typed?.warnings) ? { warnings: typed.warnings } : {})
  })
}
