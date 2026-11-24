/**
 * 统一对话入口：`POST /api/apps/:id/chat`（SSE）
 *
 * - body `{ view, text, module?, command?, model? }`
 * - 按 `view` 选择活跃会话（`app_sessions.view`）；没有则创建，已归档则新建
 * - `command` 存在时走 opencode `POST /api/session/:id/command {name, text}`
 * - 其余走普通 prompt；prompt 只给“当前视图 + 去读哪些产物”，
 *   具体做法交给 skill（工作台不拼选项/不推进阶段）
 *
 * 会话是持久会话（不是每轮临时会话）：每视图一个活跃会话 + 历史列表。
 */
import type { Request, Response } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config'
import { db, readSetting, writeSetting } from '../db'
import { appDirOf } from '../apps/scaffold'
import { opencode } from '../opencode/runtime'
import { redact, redactDeep } from '../opencode/redact'
import { eventCompletion, isExplicitFinishEvent, sessionCompletion, shouldFallbackFinish } from '../opencode/session-state'
import { ensureWorkspaceAssets, expectedSkillIds } from '../templates/distribution'
import { developmentDigestForPrompt } from '../dev/digest'
import { CHINESE_INSTRUCTION } from './prompts'
import {
  activeSessionRow,
  createSessionRow,
  isAppView,
  listSessionRows,
  setSessionArchived,
  setSessionStale,
  touchSession,
  type AppSessionRow,
  type AppView,
  type SessionView
} from '../sessions/store'
import { APP_VIEWS, viewOf } from '../sessions/store'

/** 模型按会话视图分别保存（应用三视图 + 工作室 template） */
export type ModelStage = SessionView

export interface ModelRef {
  providerID: string
  id: string
  variant?: string | null
}

export interface ChatApp {
  id: string
  name: string
}

/**
 * 会话目标（P7-7b-1）：应用三视图与模板工作室共用同一套 SSE/会话逻辑。
 * - 应用：`appChatTarget(app, view)`（`handleAppChat` 的等价包装）；
 * - 工作室：`design-template/studio.ts#targetForDraft`。
 */
export interface ChatTarget {
  /** 应用 id 或 `__template__:<packId>`；会话表 app_id 直接使用 */
  id: string
  name: string
  /** opencode location / 工作目录 */
  directory: string
  view: SessionView
  /** 会话标题；缺省 `<name> · <视图>`（工作室用 `<模板名> · 模板工作室`） */
  sessionTitle?(): string
  /** 每轮/建会话前的幂等准备（应用：ensureWorkspaceAssets；工作室：ensureStudioAssets） */
  beforeSession?(): { warnings: string[] } | Promise<{ warnings: string[] }>
  /** 期望加载的 skill/command（替代写死的应用清单） */
  expectedSkills(): string[]
  expectedCommands(): string[]
  /** 本轮 prompt（应用三视图 / 工作室各自提供） */
  buildPrompt(text: string, options: { digest?: string }): string
  /** 开发视图/工作室摘要；不需要时返回 undefined */
  digest?(): string | undefined
}

/** 单轮对话总超时（20 分钟；长任务也不无限挂起） */
export const CHAT_TIMEOUT_MS = 20 * 60 * 1000
/** P7-6c：事件缺失时的 fallback 检测间隔与“最后事件后多久开始检查” */
export const CHAT_WATCHDOG_INTERVAL_MS = 2000
export const CHAT_WATCHDOG_IDLE_MS = 10_000
const MAX_TEXT_CHARS = 200_000

/** 测试可缩短定时；默认值见上方常量 */
function chatTimings(): { timeoutMs: number; watchdogIntervalMs: number; watchdogIdleMs: number } {
  const positive = (name: string, fallback: number): number => {
    const parsed = Number(process.env[name])
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }
  return {
    timeoutMs: positive('RG_CHAT_TIMEOUT_MS', CHAT_TIMEOUT_MS),
    watchdogIntervalMs: positive('RG_CHAT_WATCHDOG_INTERVAL_MS', CHAT_WATCHDOG_INTERVAL_MS),
    watchdogIdleMs: positive('RG_CHAT_WATCHDOG_IDLE_MS', CHAT_WATCHDOG_IDLE_MS)
  }
}
/** 应用内 command 期望值（与 templates/agent/commands 一致；工作室 command 不随应用分发） */
const APP_EXPECTED_COMMANDS = [
  'update-requirements',
  'generate-design',
  'generate-api-design',
  'preview-app',
  'check-consistency',
  'check-design-fidelity'
]
/** 每个目标（应用/工作室）进程内只校验一次实际加载结果（坏 YAML 会被 opencode 静默丢弃） */
const verifiedAssets = new Set<string>()

/** 校验目标级 skills/commands 实际加载（失败只告警；未就绪不主动启动 serve） */
export async function verifyTargetAssets(target: ChatTarget): Promise<void> {
  if (verifiedAssets.has(target.id)) return
  // 测试/未就绪时不主动启动 serve（校验不是关键路径）
  if (!opencode.status().ready) return
  try {
    const skills = await opencode.listSkills(target.directory)
    // location 惰性初始化：会话创建后仍为空说明 serve 侧尚未加载，等下一轮再校验
    if (!skills.length) return
    const commands = await opencode.listCommands(target.directory)
    const missing = [
      ...target
        .expectedSkills()
        .filter(id => !skills.some(skill => skill.id === id))
        .map(id => `skill:${id}`),
      ...target
        .expectedCommands()
        .filter(name => !commands.some(command => command.name === name))
        .map(name => `command:${name}`)
    ]
    if (missing.length) {
      console.warn(`[chat] opencode 未加载工作台资源（${target.id}）：${missing.join('、')}；请检查 SKILL.md frontmatter`)
      return
    }
    verifiedAssets.add(target.id)
  } catch (error) {
    console.warn(`[chat] 校验 skills/commands 失败（${target.id}）：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 应用 model 路由只接受三视图（template 不是合法 AppView；工作室用 stage='template' 直接读写） */
export function isModelStage(value: unknown): value is AppView {
  return isAppView(value)
}

/** 单 agent（opencode 原生 build）；应用三视图与工作室共用 */
export function agentForModelStage(_stage: ModelStage): string {
  return 'build'
}

export function agentForView(_view: AppView): string {
  return 'build'
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

/** 同一应用其他视图已保存的模型：新视图/新应用未选模型时优先继承（工作室 template 不继承） */
function storedModelFromOtherStages(appId: string, stage: ModelStage): ModelRef | null {
  if (stage === 'template') return null
  for (const other of APP_VIEWS) {
    if (other === stage) continue
    const model = storedModel(appId, other)
    if (model) return model
  }
  return null
}

/** 保存应用视图模型；传 null 清除（回退 opencode 默认模型） */
export function saveStoredModel(appId: string, stage: ModelStage, model: ModelRef | null): void {
  if (!model) {
    db.prepare('DELETE FROM app_settings WHERE key = ?').run(modelKey(appId, stage))
    return
  }
  writeSetting(modelKey(appId, stage), model)
}

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

/** 需求文档章节「问 AI」的隐藏上下文（由前端随 prompt 传入；仅需求视图生效） */
export interface RequirementSectionFocus {
  anchor: string
  title: string
  level: number
  key?: string
  kind?: string
}

/** 清洗章节上下文文本：单行、去控制空白、限长 */
function focusLineText(value: unknown, maxChars: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
}

/** requirements 视图的「本轮聚焦章节」提示（缺失/非法则返回空串，不改变既有输出） */
function requirementFocusLine(focus?: RequirementSectionFocus): string {
  if (!focus || typeof focus !== 'object') return ''
  const title = focusLineText(focus.title, 120)
  const anchor = focusLineText(focus.anchor, 80)
  const level = Number(focus.level)
  if (!title || !anchor || !Number.isFinite(level)) return ''
  return `本轮聚焦章节：docs/requirements/requirements.md 的「${title}」（锚点 #${anchor}，层级 ${level}）。请优先基于该章节内容回答/修改；需要跨章节一致性时再检查相关 Epic 与设计产物。`
}

/** 视图提示：告诉 agent 去哪里读、写哪里；不规定步骤（D1 去模块） */
export function buildViewPrompt(
  view: AppView,
  text: string,
  context?: { digest?: string; focus?: RequirementSectionFocus }
): string {
  const framing: Record<AppView, string[]> = {
    requirements: [
      '当前视图：需求。',
      '需求产物：docs/requirements/requirements.md（单文档；frontmatter 只 title/template）。',
      'Epic 使用 EP-001、Story 使用 US-001 稳定 ID，设计页面集按 Epic 引用。',
      '设计产物（docs/design/entities.json、pages.json、api-design.md）可能尚未生成；需求阶段不要主动读取不存在的设计文件。',
      '只有用户明确要求同步设计且文件存在时才读取设计文件；不存在是正常的，不要报错、不要创建空设计文件。',
      '先按 skill adw-requirements-document 的要求读取工作区现有产物，再修改文件；不要输出任何结构化聊天协议。'
    ],
    design: [
      '当前视图：设计。',
      '需求产物：docs/requirements/requirements.md（单文档）。',
      '设计产物：docs/design/entities.json（实体/关系，全局一张 ER 图）、docs/design/pages.json（页面集 = Epic；页面契约）、docs/design/api-design.md（接口设计，固定模板）。',
      '同一轮生成：不要只生成 entities/pages，api-design.md 必须同轮生成；页面动作/实体 CRUD 覆盖要写全。',
      '页面动作目标：列表/树表页面声明 create/edit 时，要有同页面集同实体的表单页，并写 actionTargets（显式优先）；create/edit 目标用 dialog-form/page-form/main-sub/wizard（main-sub 是整页表单 + 子表，合法），detail 只做详情目标。',
      '设计方法 skill：adw-design-artifacts（references/entities.schema.json、pages.schema.json）。',
      '接口设计 skill：adw-api-design（references/api-conventions.md、api-design-template.md、api-design-example.md；scripts/validate-api-design.mjs 自查）。',
      '设计参考：docs/design/design-brief.md（写完/改完设计产物后维护）；tokens.json 与 prototypes/*.png 由工作台生成，不要手改。',
      '先按 design-artifacts 读取需求与 schema，再修改文件；完成后同时运行 scripts/validate.mjs 与 scripts/validate-api-design.mjs 自查。'
    ],
    development: [
      '当前视图：开发。',
      '需求产物：docs/requirements/requirements.md（单文档；先读需求，再按设计实现；需求与设计冲突先报告）。',
      '应用设计系统：docs/design/design-system.json（pack/应用类型/风格/页面库）；页面蓝图：docs/design/template/<applicationType>/pages/*.vue + structure.css，风格：docs/design/template/styles/shared.css + docs/design/template/styles/<styleId>/style.css（以 design-system.json 的 styles 为准）。',
      '设计产物：docs/design/entities.json（实体/关系）、docs/design/pages.json（页面集 = Epic；页面契约）、docs/design/api-design.md（接口设计）、design-brief.md（概览/页面/组件/风格）、tokens.json（色板/字体/圆角/间距）、prototypes/*.png（模板风格截图；无显式契约的旧设计为线框）。',
      '必读顺序：AGENTS.md → design-system.json → entities.json / pages.json / design-brief.md / tokens.json / prototypes → 蓝图 → frontend 现有代码；不要跳过现有代码直接重写。',
      '团队 skill：afcenter-page-generation（PageTemplates/页面配方/偏好）、pm-components-usage（pm-* 用法）；开发方法 skill：adw-frontend-implementation；页面库/蓝图也可通过设计模板 skill adw-template-proto-<applicationType> 定位。',
      '优先级：需求 > design-system/pages.json 契约 > entities.json / api-design.md > 蓝图（布局/组件） > design-brief/tokens（视觉变量） > prototypes/*.png（模板风格截图；无显式契约的旧设计为线框）。任何冲突先报告（附文件/字段证据），不要静默取舍。',
      '实现方式：从 docs/design/template/<applicationType>/pages/*.vue 复制页面到 frontend/src/views/，保留结构/样式/组件，替换 mock/接口；使用 PageTemplates（BusinessListPage/TreeListPage/StandardFormPage/FormSection/QueryPanel/RowActions/ThreePartPagination）、宿主 pm-* 与 src/preferences/GlobalPreference.js。',
      '组件规范：pm-* 由 AFCenter 宿主全局提供，不重复注册/打包；新增/编辑默认 pm-form-dialog；el-table 统一 v-auto-height；业务字段 > 8 用双列；批量操作放 batch-actions；树节点菜单用 MoreFilled；禁止自造一套表格/表单样式替代模板。',
      '软门禁（不阻断）：先填写 docs/design/ui-check.md 的「实现前」对照表（按 Epic/页面集分节；页面/路由/蓝图/字段/列/操作/布局/差异），再写代码；实现后补「实现后」表。未填写不阻断，但完成汇报必须标记“流程未完成”。',
      'MF remote 边界：生成物是独立 Module Federation remote（frontend/），pm-* 由宿主提供；token/PNG/蓝图只约束 Vue3 前端，EOS 后端不吃风格，不要为样式改后端结构。PNG 是模板风格截图（无显式契约的旧设计为线框），蓝图/预览是视觉事实；prototypes/_manifest.json 的 designHash 与当前设计产物不一致视为过期，先说明再参考。',
      '完成后汇报：实现摘要、改动文件、页面与蓝图/契约对照结果、偏离与原因、未实现项、如何运行/自测结果；没有证据不要声称“已还原”。'
    ]
  }
  const parts = [...framing[view]]
  if (view === 'development' && context?.digest) {
    parts.push(`以下是工作台注入的设计摘要（只读；细节仍以 entities.json / pages.json、蓝图与现有代码为准）：\n${context.digest}`)
  }
  // 需求章节上下文：必须在「用户消息：」之前（p2 harness 取最后一个标记之后的文本）
  const focusLine = view === 'requirements' ? requirementFocusLine(context?.focus) : ''
  return `${parts.join('\n')}\n${CHINESE_INSTRUCTION}\n${focusLine ? `\n${focusLine}\n\n` : '\n'}用户消息：\n${text}`
}

function sseWrite(res: Response, frame: unknown, closed: () => boolean): void {
  if (closed() || res.writableEnded) return
  res.write(`data: ${JSON.stringify(frame)}\n\n`)
}

interface EnsureSessionResult {
  row: AppSessionRow
  opencodeSessionId: string
}

/**
 * 取目标视图的活跃对话会话；没有就创建 opencode 会话 + 登记行。
 * opencode 侧会话丢失时把旧行标 stale 并新建。
 */
export async function ensureTargetSession(target: ChatTarget, model: ModelRef | null): Promise<EnsureSessionResult> {
  const existing = activeSessionRow(target.id, target.view)
  if (existing?.opencode_session_id) {
    const info = await opencode.session(existing.opencode_session_id).catch(() => null)
    if (info) return { row: existing, opencodeSessionId: existing.opencode_session_id }
    setSessionStale(existing.id)
  } else if (existing) {
    setSessionArchived(existing.id)
  }

  const title = target.sessionTitle?.() ?? `${target.name} · ${viewLabel(target.view)}`
  const session = await opencode.createSession({
    directory: target.directory,
    title,
    agent: agentForModelStage(target.view),
    model
  })
  const row = createSessionRow({
    appId: target.id,
    view: target.view,
    opencodeSessionId: session.id,
    title,
    providerId: model?.providerID ?? null,
    modelId: model?.id ?? null
  })
  opencode.track(session.id)
  // 会话创建后 location 已初始化：校验目标级 skills/commands 实际加载（失败只告警）
  await verifyTargetAssets(target)
  return { row, opencodeSessionId: session.id }
}

/** 兼容包装：应用视图会话（保持原签名与行为） */
export async function ensureViewSession(
  app: ChatApp,
  view: AppView,
  directory: string,
  model: ModelRef | null
): Promise<EnsureSessionResult> {
  const target: ChatTarget = { ...appChatTarget(app, view), directory }
  return ensureTargetSession(target, model)
}

export function viewLabel(view: SessionView): string {
  if (view === 'requirements') return '需求'
  if (view === 'design') return '设计'
  if (view === 'template') return '模板'
  return '开发'
}

/** 应用三视图目标（应用 × 视图；无模块层级） */
export function appChatTarget(app: ChatApp, view: AppView): ChatTarget {
  return {
    id: app.id,
    name: app.name,
    directory: appDirOf(app.id),
    view,
    beforeSession: () => {
      // 应用打开/会话启动做一次幂等对齐（覆盖式）；失败只记 warning，不阻塞对话
      const aligned = ensureWorkspaceAssets(app.id)
      return { warnings: aligned.warnings }
    },
    expectedSkills: () => expectedSkillIds(app.id),
    expectedCommands: () => [...APP_EXPECTED_COMMANDS],
    buildPrompt: (text, options) => buildViewPrompt(view, text, { digest: options.digest }),
    digest: () => (view === 'development' ? developmentDigestForPrompt(app.id, appDirOf(app.id)) : undefined)
  }
}

interface ChatBody {
  view?: unknown
  text?: unknown
  command?: unknown
  model?: unknown
}

/** Express 路由入口：SSE 已由本函数负责；出错时在未发头的情况下抛给统一错误处理 */
export async function handleChat(target: ChatTarget, req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as ChatBody
  const view = target.view
  const text = typeof body.text === 'string' ? body.text : ''
  const command = typeof body.command === 'string' ? body.command.trim() : ''
  if (!text.trim() && !command) {
    res.status(400).json({ error: 'text 不能为空（command 模式可只给参数）' })
    return
  }
  if (text.length > MAX_TEXT_CHARS) {
    res.status(413).json({ error: `消息过长（${text.length} 字符）` })
    return
  }

  if (!fs.existsSync(target.directory)) {
    const detail =
      view === 'template'
        ? path.relative(config.dataDir, target.directory)
        : path.relative(config.projectsDir, target.directory)
    res.status(409).json({ error: `${view === 'template' ? '工作室目录' : '应用目录'}不存在：${detail}` })
    return
  }
  // 幂等准备（应用：工作区对齐；工作室：工作室资产）；失败只记 warning，不阻塞对话
  const prepared = (await target.beforeSession?.()) ?? { warnings: [] }
  if (prepared.warnings.length) console.warn(`[chat] 工作区对齐提示（${target.id}）：`, prepared.warnings.join('；'))
  // 开发视图/工作室摘要（失败只降级，不阻断）
  const digest = target.digest?.()
  const promptContext = digest ? { digest } : undefined

  const model = await resolveChatModel(target.id, view, target.directory, body.model)
  let ensured: EnsureSessionResult
  try {
    ensured = await ensureTargetSession(target, model)
  } catch (error) {
    res.status(502).json({ error: redact(error instanceof Error ? error.message : String(error)) })
    return
  }
  const sessionID = ensured.opencodeSessionId

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
  let watchdog: NodeJS.Timeout | null = null
  let resolveOutcome: (() => void) | null = null
  let rejectOutcome: ((error: Error) => void) | null = null
  const chunks: string[] = []
  let finalText = ''
  const timings = chatTimings()
  /** P7-6c：最后事件时间与“是否已有 assistant 文本/工具活动”，供 fallback 判定 */
  let lastEventAt = Date.now()
  let hasActivity = false
  let checkingFallback = false

  const outcome = new Promise<void>((resolve, reject) => {
    resolveOutcome = resolve
    rejectOutcome = reject
  })
  void outcome.catch(() => undefined)

  const cleanup = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
    if (watchdog) clearInterval(watchdog)
    watchdog = null
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
    void opencode.interrupt(sessionID, false).catch(() => undefined)
  }

  const isClosed = (): boolean => closed
  sseWrite(
    res,
    {
      type: 'meta',
      sessionID,
      sessionRowId: ensured.row.id,
      appId: target.id,
      view,
      command: command || null,
      agent: agentForModelStage(view),
      model
    },
    isClosed
  )
  res.on('close', onClose)

  unsubscribe = opencode.subscribe({ sessionID }, event => {
    const type = event.type
    lastEventAt = Date.now()
    if (
      type === 'session.text.delta' ||
      type === 'session.text.ended' ||
      type === 'session.execution.started' ||
      type.startsWith('session.tool') ||
      type === 'session.message.part.updated' ||
      type === 'permission.asked' ||
      type.startsWith('form.')
    ) {
      hasActivity = true
    }
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
    if (type === 'permission.asked' || type === 'permission.replied') {
      sseWrite(res, { type: 'permission', event: redactDeep(event) }, isClosed)
      return
    }
    if (type.startsWith('form.')) {
      sseWrite(res, { type: 'form', event: redactDeep(event) }, isClosed)
      return
    }
    if (type.startsWith('session.tool') || type === 'session.message.part.updated') {
      sseWrite(res, { type: 'tool', event: redactDeep(event) }, isClosed)
      return
    }
    const signal = eventCompletion(event)
    if (!signal) return
    if (!isExplicitFinishEvent(type) && !hasActivity) return
    if (signal === 'complete') {
      finish()
      return
    }
    if (signal === 'failed') {
      finish(new Error(formatExecutionFailure(event.data, model)))
      return
    }
    finish(new Error('AI 生成已中止'))
  })

  const heartbeat = setInterval(() => {
    if (!closed && !res.writableEnded) res.write(': ping\n\n')
  }, 15000)
  heartbeat.unref?.()

  /**
   * P7-6c：事件流可能丢 `session.idle`。最后事件后静默超过阈值时，
   * 主动读一次 opencode 会话/消息，确认已收尾才 finish（不猜测）。
   */
  const runFallbackCheck = async (): Promise<void> => {
    if (settled || closed || checkingFallback) return
    if (!shouldFallbackFinish({ now: Date.now(), lastEventAt, hasActivity, idleAfterMs: timings.watchdogIdleMs })) return
    const pendingNow = opencode.pendingFor(sessionID)
    // 权限/表单等待中不算完成，避免把“等人”误判为收尾
    if (pendingNow.permissions.length || pendingNow.forms.length) return
    checkingFallback = true
    try {
      const info = await opencode.session(sessionID).catch(() => null)
      if (!info) return
      const messages = await opencode.messages(sessionID, { limit: 10, order: 'desc' }).catch(() => null)
      const latestFirst = Array.isArray(messages?.data) ? [...messages.data].reverse() : []
      const signal = sessionCompletion(info, latestFirst)
      if (signal === 'complete') {
        finish()
      } else if (signal === 'failed') {
        finish(new Error('模型执行失败（未收到完成事件；请查看工具错误后重试）'))
      } else if (signal === 'interrupted') {
        finish(new Error('AI 生成已中止'))
      }
    } finally {
      checkingFallback = false
    }
  }

  watchdog = setInterval(() => {
    void runFallbackCheck()
  }, timings.watchdogIntervalMs)
  watchdog.unref?.()

  timer = setTimeout(() => {
    void opencode.interrupt(sessionID, false).catch(() => undefined)
    finish(new Error(`AI 生成超时（${Math.round(timings.timeoutMs / 1000)} 秒）`))
  }, timings.timeoutMs)
  timer.unref?.()

  try {
    if (command) {
      await opencode.runCommand(sessionID, command, text)
    } else {
      await opencode.prompt(sessionID, target.buildPrompt(text, { digest: promptContext?.digest }))
    }
    await outcome
    touchSession(ensured.row.id)
    sseWrite(res, { type: 'done', text: finalText || chunks.join(''), sessionID }, isClosed)
  } catch (error) {
    if (!closed) {
      const message = redact(error instanceof Error ? error.message : String(error))
      sseWrite(res, { type: 'error', message }, isClosed)
    }
  } finally {
    clearInterval(heartbeat)
    cleanup()
    if (!closed && !res.writableEnded) res.end()
  }
}

/** 应用对话入口（等价包装：保留原签名与行为） */
export async function handleAppChat(app: ChatApp, req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as ChatBody
  const view: AppView = isAppView(body.view) ? body.view : 'requirements'
  await handleChat(appChatTarget(app, view), req, res)
}

/** 会话列表按视图过滤（供 /development/sessions?view= 复用） */
export function sessionsForView(appId: string, view: SessionView): AppSessionRow[] {
  return listSessionRows(appId, view)
}

export { viewOf }
