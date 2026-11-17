/**
 * 需求/设计对话（A 方案）：短暂 opencode 会话 + prompt + SSE
 *
 * 浏览器 → POST /api/apps/:id/chat
 *   → 写入 req/design agent（若缺）
 *   → 创建短暂会话（location=应用目录，agent=req/design）
 *   → 把 messages 拼成一条 prompt
 *   → 订阅 /api/event，把 assistant 文本增量转发为 {type:'delta'}
 *   → 结束时 {type:'done'} 并删除会话
 *
 * 不使用 opencode 会话历史：每轮 prompt 都带最新需求文档/设计/历史，避免上下文漂移。
 *
 * R4b-2：只保留 doc（需求文档）与 design（设计）两种模式；旧 structured Spec 对话已删除。
 */
import type { Request, Response } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { config } from '../config'
import { db, readSetting, writeSetting } from '../db'
import { appDirOf, ensureAppAgents } from '../apps/scaffold'
import { opencode } from '../opencode/runtime'
import { redact } from '../opencode/redact'
import { loadDocChatContext } from '../requirements/doc'
import { buildDocChatPrompt } from './doc-prompt'
import { buildModulePlanChatPrompt } from './module-plan-prompt'
import { initialPlanEligibility } from '../requirements/module-plan'
import {
  buildModuleGuidance,
  detectModuleIntent,
  moduleGuidanceContext,
  type ModuleGuidance
} from '../requirements/module-intent'
import { getDesign } from '../design/service'
import { buildDesignChatPrompt } from '../design/prompt'

export type ChatStage = 'requirements' | 'design'
/** 模型可分别按需求/设计/开发保存 */
export type ModelStage = ChatStage | 'development'

export interface ModelRef {
  providerID: string
  id: string
  variant?: string | null
}

export interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatApp {
  id: string
  name: string
}

const MAX_PROMPT_CHARS = 200_000
const CHAT_TIMEOUT_MS = 600_000

export function isChatStage(value: unknown): value is ChatStage {
  return value === 'requirements' || value === 'design'
}

export function isModelStage(value: unknown): value is ModelStage {
  return value === 'requirements' || value === 'design' || value === 'development'
}

export function agentForStage(stage: ChatStage): string {
  return stage === 'design' ? 'design' : 'req'
}

export function agentForModelStage(stage: ModelStage): string {
  return stage === 'design' ? 'design' : stage === 'development' ? 'build' : 'req'
}

function modelLabel(model: ModelRef | null): string {
  return model ? `（当前模型 ${model.providerID}/${model.id}）` : ''
}

/** 把 opencode 的结构化执行失败转成可读提示，避免把整段 JSON/响应体抛给用户 */
export function formatExecutionFailure(data: unknown, model: ModelRef | null): string {
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const nested = raw.error && typeof raw.error === 'object' ? (raw.error as Record<string, unknown>) : {}
  const type = typeof nested.type === 'string' ? nested.type : typeof raw.type === 'string' ? raw.type : ''
  const message = typeof nested.message === 'string' ? nested.message : typeof raw.message === 'string' ? raw.message : ''
  const status = typeof nested.status === 'number' ? nested.status : typeof raw.status === 'number' ? raw.status : null
  const label = modelLabel(model)

  if (type === 'provider.free-limit' || /free usage limit/i.test(message)) {
    return `当前模型的免费额度已用尽${label}。请在右上角「模型」中切换到可用模型后重试。`
  }
  if (status === 429) {
    return `模型请求被限流（HTTP 429）${label}。请稍后重试，或在「模型」中切换其他模型。`
  }
  if (status === 401 || status === 403) {
    return `模型鉴权失败（HTTP ${status}）${label}。请检查 opencode 的 provider 配置或切换到其他模型。`
  }
  const detail = [type, message].filter(Boolean).join('：').slice(0, 500)
  return `模型执行失败${label}${detail ? `：${detail}` : ''}`
}

function modelKey(appId: string, stage: ModelStage): string {
  return `app.${appId}.model.${stage}`
}

function normalizeModelRef(value: unknown): ModelRef | null {
  if (!value || typeof value !== 'object') return null
  const model = value as Record<string, unknown>
  if (typeof model.providerID !== 'string' || !model.providerID || typeof model.id !== 'string' || !model.id) return null
  return {
    providerID: model.providerID,
    id: model.id,
    ...(typeof model.variant === 'string' && model.variant ? { variant: model.variant } : {})
  }
}

export function storedModel(appId: string, stage: ModelStage): ModelRef | null {
  return normalizeModelRef(readSetting<unknown>(modelKey(appId, stage)))
}

/** 同一应用其他阶段已保存的模型：新阶段/新应用未选模型时优先继承，避免回退到免费模型 */
export function storedModelFromOtherStages(appId: string, stage: ModelStage): ModelRef | null {
  const stages: ModelStage[] = ['requirements', 'design', 'development']
  for (const other of stages) {
    if (other === stage) continue
    const model = storedModel(appId, other)
    if (model) return model
  }
  return null
}

/** 保存应用阶段模型；传 null 清除（回退 opencode 默认模型） */
export function saveStoredModel(appId: string, stage: ModelStage, model: ModelRef | null): void {
  if (!model) {
    db.prepare('DELETE FROM app_settings WHERE key = ?').run(modelKey(appId, stage))
    return
  }
  writeSetting(modelKey(appId, stage), model)
}

/**
 * 解析本轮模型：显式 → 应用阶段设置 → 同应用其他阶段 → 工作台配置默认 →
 * opencode CLI 最近使用 → opencode 默认。
 *
 * 这样新应用/新阶段不会默认落到额度可能已尽的免费模型上。
 */
export async function resolveChatModel(
  appId: string,
  stage: ModelStage,
  directory: string,
  explicit?: unknown
): Promise<ModelRef | null> {
  const direct = normalizeModelRef(explicit)
  if (direct) return direct
  const stored = storedModel(appId, stage) ?? storedModelFromOtherStages(appId, stage)
  if (stored) return stored
  return resolveFallbackModel(directory)
}

/** 未显式选择/未保存时使用的默认模型（模型设置弹窗与 chat 共用同一口径） */
export async function resolveFallbackModel(directory: string): Promise<ModelRef | null> {
  try {
    // OPENCODE_DEFAULT_MODEL 是工作台的显式覆盖，优先级最高
    if (config.opencode.defaultModel) {
      const configured = await opencode.defaultModel(directory)
      if (!configured) return null
      return { providerID: configured.providerID, id: configured.modelID }
    }
    const recent = await opencode.lastUsedModel(directory)
    if (recent) {
      return {
        providerID: recent.model.providerID,
        id: recent.model.modelID,
        ...(recent.variant ? { variant: recent.variant } : {})
      }
    }
    const fallback = await opencode.defaultModel(directory)
    if (!fallback) return null
    return { providerID: fallback.providerID, id: fallback.modelID }
  } catch {
    return null
  }
}

function normalizeMessages(raw: unknown): ChatMessageInput[] {
  if (!Array.isArray(raw)) return []
  const messages: ChatMessageInput[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content
    if ((role === 'system' || role === 'user' || role === 'assistant') && typeof content === 'string' && content.trim()) {
      messages.push({ role, content })
    }
  }
  return messages
}

function sseWrite(res: Response, frame: unknown, closed: () => boolean): void {
  if (closed() || res.writableEnded) return
  res.write(`data: ${JSON.stringify(frame)}\n\n`)
}

function appStatusOf(appId: string): string {
  const row = db.prepare('SELECT status FROM apps WHERE id = ?').get(appId) as { status: string } | undefined
  return row?.status ?? 'requirements'
}

/**
 * G1：模块级操作意图守卫的 SSE 响应。
 *
 * 只发 meta（带 `moduleAction='guidance'`）/ delta / done 三帧：**不调用模型、不解析 DOC_JSON、不产版本**。
 * 前端据 meta 渲染指引卡并随消息持久化 metadata（刷新后可恢复）。
 */
function writeModuleGuidanceResponse(res: Response, guidance: ModuleGuidance): void {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
  res.write(`data: ${JSON.stringify({ type: 'meta', mode: 'doc', ...guidance.metadata })}\n\n`)
  res.write(`data: ${JSON.stringify({ type: 'delta', text: guidance.content })}\n\n`)
  res.write(`data: ${JSON.stringify({ type: 'done', text: guidance.content })}\n\n`)
  res.end()
}

/** Express 路由入口：SSE 已由本函数负责；出错时在未发头的情况下抛给统一错误处理 */
export async function handleAppChat(app: ChatApp, req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as {
    stage?: unknown
    messages?: unknown
    model?: unknown
    mode?: unknown
    templateId?: unknown
    focusSectionKey?: unknown
    focus?: unknown
    moduleId?: unknown
  }
  const planMode = body.mode === 'doc-plan'
  const docMode = body.mode === 'doc' || planMode
  const designMode = body.mode === 'design'
  const stage: ChatStage = designMode ? 'design' : planMode ? 'requirements' : isChatStage(body.stage) ? body.stage : 'requirements'
  // R4b-2：需求固定文档模式；RMP-1 增加首次模块规划（doc-plan）
  if (!docMode && !designMode) {
    res.status(400).json({ error: 'mode 只能是 doc（需求文档）、doc-plan（首次模块规划）或 design（设计）' })
    return
  }
  // 首次模块规划只允许在 requirements 阶段、满足首次条件时使用；否则按普通 doc 流程
  if (planMode) {
    const eligibility = initialPlanEligibility(app.id)
    if (!eligibility.eligible) {
      res.status(409).json({ error: eligibility.message })
      return
    }
  }
  const messages = normalizeMessages(body.messages)
  if (!messages.length) {
    res.status(400).json({ error: 'messages 不能为空' })
    return
  }
  // G1：模块级操作意图守卫（仅需求 doc 模式；doc-plan 由 RMP-1 自己处理）
  // 命中即用指引文案回复：不调模型、不产版本、不返回 DOC_JSON。
  if (!designMode && !planMode) {
    const lastUser = [...messages].reverse().find(message => message.role === 'user')
    const intent = lastUser ? detectModuleIntent(lastUser.content) : null
    if (intent) {
      const guidance = buildModuleGuidance(
        intent,
        moduleGuidanceContext(app.id, appStatusOf(app.id), typeof body.moduleId === 'string' ? body.moduleId : undefined)
      )
      writeModuleGuidanceResponse(res, guidance)
      return
    }
  }
  const prompt = designMode
    ? buildDesignChatPrompt(
        {
          project: getDesign(app.id, typeof body.moduleId === 'string' ? body.moduleId : undefined),
          focus:
            body.focus && typeof body.focus === 'object'
              ? {
                  kind: typeof (body.focus as Record<string, unknown>).kind === 'string' ? String((body.focus as Record<string, unknown>).kind) : '',
                  id: typeof (body.focus as Record<string, unknown>).id === 'string' ? String((body.focus as Record<string, unknown>).id) : ''
                }
              : undefined
        },
        messages
      )
    : planMode
      ? buildModulePlanChatPrompt(
          loadDocChatContext(
            app.id,
            typeof body.templateId === 'string' ? body.templateId : undefined,
            undefined,
            typeof body.moduleId === 'string' ? body.moduleId : undefined
          ),
          messages
        )
      : buildDocChatPrompt(
          loadDocChatContext(
            app.id,
            typeof body.templateId === 'string' ? body.templateId : undefined,
            typeof body.focusSectionKey === 'string' ? body.focusSectionKey : undefined,
            typeof body.moduleId === 'string' ? body.moduleId : undefined
          ),
          messages
        )
  if (!messages.length || !prompt.trim()) {
    res.status(400).json({ error: 'messages 不能为空' })
    return
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    res.status(413).json({ error: `对话上下文过长（${prompt.length} 字符），请新建对话或缩短输入` })
    return
  }

  const directory = appDirOf(app.id)
  if (!fs.existsSync(directory)) {
    res.status(409).json({ error: `应用目录不存在：${path.relative(config.projectsDir, directory)}` })
    return
  }
  ensureAppAgents(app.id)
  const agent = agentForStage(stage)
  await opencode.ensureAgent(directory, agent)
  const model = await resolveChatModel(app.id, stage, directory, body.model)
  const session = await opencode.createSession({
    directory,
    title: `${app.name} · ${stage} chat`,
    agent,
    model
  })

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()

  let closed = false
  let settled = false
  let unsubscribe: () => void = () => undefined
  let timer: NodeJS.Timeout | null = null
  let resolveOutcome: (() => void) | null = null
  let rejectOutcome: ((error: Error) => void) | null = null
  const chunks: string[] = []
  let finalText = ''

  const isClosed = (): boolean => closed
  const outcome = new Promise<void>((resolve, reject) => {
    resolveOutcome = resolve
    rejectOutcome = reject
  })
  // 事件可能在 prompt 的 await 返回前就失败；先挂一个空 catch，避免 Node 把未处理的 reject 当致命错误
  void outcome.catch(() => undefined)

  const cleanup = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
    unsubscribe()
    res.removeListener('close', onClose)
  }

  const finish = (error?: Error): void => {
    if (settled) return
    settled = true
    cleanup()
    if (error) rejectOutcome?.(error)
    else resolveOutcome?.()
  }

  const onClose = (): void => {
    if (res.writableEnded) return
    closed = true
    finish(new Error('客户端已断开'))
    void opencode.interrupt(session.id, false).catch(() => undefined)
  }

  sseWrite(res, { type: 'meta', sessionID: session.id, agent, model, mode: planMode ? 'doc-plan' : designMode ? 'design' : 'doc' }, isClosed)
  res.on('close', onClose)

  unsubscribe = opencode.subscribe({ sessionID: session.id }, event => {
    const type = event.type
    if (type === 'session.text.delta') {
      const delta = String(event.data?.delta ?? '')
      if (!delta) return
      chunks.push(delta)
      sseWrite(res, { type: 'delta', text: delta }, isClosed)
      return
    }
    if (type === 'session.text.ended') {
      finalText = String(event.data?.text ?? '')
      return
    }
    if (type === 'session.execution.succeeded' || type === 'session.idle') {
      finish()
      return
    }
    if (type === 'session.execution.failed') {
      finish(new Error(formatExecutionFailure(event.data, model)))
      return
    }
    if (type === 'session.execution.interrupted') {
      finish(new Error('AI 生成已中止'))
    }
  })

  const heartbeat = setInterval(() => {
    if (!closed && !res.writableEnded) res.write(': ping\n\n')
  }, 15000)
  heartbeat.unref?.()

  timer = setTimeout(() => {
    void opencode.interrupt(session.id, false).catch(() => undefined)
    finish(new Error(`AI 生成超时（${Math.round(CHAT_TIMEOUT_MS / 1000)} 秒）`))
  }, CHAT_TIMEOUT_MS)
  timer.unref?.()

  try {
    await opencode.prompt(session.id, prompt)
    await outcome
    sseWrite(res, { type: 'done', text: finalText || chunks.join('') }, isClosed)
  } catch (error) {
    if (!closed) {
      const message = redact(error instanceof Error ? error.message : String(error))
      sseWrite(res, { type: 'error', message }, isClosed)
    }
  } finally {
    clearInterval(heartbeat)
    cleanup()
    await opencode.deleteSession(session.id).catch(() => undefined)
    if (!closed && !res.writableEnded) res.end()
  }
}
