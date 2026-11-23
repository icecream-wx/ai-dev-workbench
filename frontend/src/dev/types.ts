/** 会话视图类型（与 backend/src/dev、backend/src/sessions 对齐） */
export interface DevToolOutput {
  text: string
  truncated: boolean
  originalChars?: number
  keptChars?: number
  mode?: 'head' | 'tail'
  exit?: number | null
  status?: string | null
}

export interface DevToolDiff {
  mode: 'create' | 'replace'
  path?: string | null
  added: number
  removed: number
  text: string
  truncated: boolean
}

export interface DevToolItem {
  type: 'tool' | 'shell'
  id: string | null
  messageId: string | null
  name: string
  status: string
  target: string | null
  input: Record<string, unknown>
  output: DevToolOutput
  diff: DevToolDiff | null
  error: { type?: string; message?: string; status?: number | null } | null
  time: { created: number | null; ran: number | null; completed: number | null }
  durationMs: number | null
}

export interface DevStep {
  id: string
  title: string
  phase: string
  status: 'completed' | 'running' | 'failed'
  startedAt: number | null
  endedAt: number | null
  durationMs: number | null
  toolCount: number
  targets: string[]
  items: DevToolItem[]
}

export interface DevSessionMessage {
  id: string
  type: string
  created: number | null
  /** compaction 等系统提示的种类（不当作 assistant 文本） */
  kind?: 'compaction' | 'compaction-failed'
  text?: string
  reasoning?: string
  tools?: Array<{ id: string | null; name: string; status: string | null; title?: string | null; target: string | null; durationMs: number | null }>
  command?: string
  status?: string | null
  exit?: number | null
  output?: DevToolOutput
  outcome?: string | null
  error?: unknown
  agent?: string | null
  finish?: string | null
  cost?: number | null
}

export type DevContextLevel = 'ok' | 'warn' | 'danger' | 'unknown'

/** 会话上下文健康度（按模型上下文上限的百分比） */
export interface DevContextUsage {
  used: number
  limit: number | null
  percent: number | null
  level: DevContextLevel
}

export interface DevProgress {
  status: string
  startedAt: number | null
  endedAt: number | null
  elapsedMs: number | null
  context: DevContextUsage
  stats: {
    tokens: { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number }
    cost: number
    toolCounts: Record<string, number>
    toolTotal: number
    failedTools: number
    messageCount: number
    partial: boolean
    steps: number
    stepsTruncated: boolean
    droppedSteps: number
  }
  /** 本轮执行阶段文案（如“执行中”），与“开发阶段/PhaseBar”无关 */
  phase: { key: string; label: string; startedAt: number | null; history: Array<{ key: string; label: string; startedAt: number | null; endedAt: number | null }> }
  steps: DevStep[]
  messages: DevSessionMessage[]
}

export interface PermissionRequest {
  id: string
  sessionID?: string
  action: string
  resources?: string[]
  save?: string[]
  message?: string
  metadata?: Record<string, unknown>
  source?: Record<string, unknown>
}

export interface FormOption {
  value: string
  label: string
  description?: string
}

export type FormFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'multiselect' | 'external'

export interface FormField {
  key: string
  type: FormFieldType
  title?: string
  description?: string
  required?: boolean
  hidden?: boolean
  when?: Array<{ key: string; op: 'eq' | 'neq'; value: string | number | boolean }>
  format?: 'email' | 'uri' | 'date' | 'date-time'
  placeholder?: string
  default?: string | number | boolean | string[]
  options?: FormOption[]
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  url?: string
}

export interface FormInfo {
  id: string
  sessionID?: string
  title: string
  metadata?: Record<string, unknown>
  fields: FormField[]
}

export type FormValue = string | number | boolean | string[]

export interface DevPending {
  permissions: PermissionRequest[]
  forms: FormInfo[]
}

export interface DevSessionState extends DevProgress {
  pending: DevPending
}

/** 视图：需求 / 设计 / 开发（每视图一个活跃会话 + 历史） */
export type AppView = 'requirements' | 'design' | 'development'

/**
 * 会话视图：应用三视图 + 模板工作室（`template`）。
 *
 * - 应用 chat/model 路由仍只接受 `AppView`（三值）；
 * - 工作室（P7-7b）会话 `view='template'`，复用同一套会话/时间线；
 * - `view-helpers.js` 的 3 视图映射不受影响（应用侧仍按三视图渲染）。
 */
export type SessionView = AppView | 'template'

export interface DevSessionInfo {
  id: string
  opencodeSessionId: string
  agent: string
  model: { providerID: string; id: string; variant?: string | null } | null
  status: string
  title: string | null
  note: string | null
  view: SessionView
  createdAt: string
  updatedAt: string
  lastActiveAt: string | null
}

/** 左侧会话列表项 */
export interface DevSessionListItem {
  id: string
  opencodeSessionId: string
  title: string | null
  note: string | null
  displayTitle: string
  opencodeTitle: string | null
  status: string
  model: { providerID: string; id: string; variant?: string | null } | null
  view: SessionView
  createdAt: string
  updatedAt: string
  lastActiveAt: string | null
  opencodeExists: boolean | null
  active: boolean
}

export interface DevSessionListResponse {
  sessions: DevSessionListItem[]
  activeSessionId: string | null
  view: SessionView
}

export type FidelityStatus = 'pass' | 'warn' | 'fail'

export interface FidelityCheck {
  id: string
  label: string
  status: FidelityStatus
  evidence: string
  hint?: string
}

export interface FidelitySummary {
  pass: number
  warn: number
  fail: number
  total: number
  status: FidelityStatus
}

export interface FidelityDesignSystem {
  exists: boolean
  valid?: boolean
  pack?: string
  applicationType?: string
  style?: string
  styleName?: string
  pageCount: number
  blueprintRoot?: string
}

/** P7-6a：设计一致性静态检查报告（只读） */
export interface DesignFidelityReport {
  appId: string
  schemaVersion: number
  ok: boolean
  empty: boolean
  reason?: string
  generatedAt: string
  module: string | null
  modules: string[]
  designSystem: FidelityDesignSystem
  checks: FidelityCheck[]
  summary: FidelitySummary
}

export interface DevStateResponse {
  app: {
    id: string
    name: string
    status: string
    createdAt: string
  }
  session: DevSessionInfo | null
  state: DevSessionState | null
  defaultPrompt: string
  readOnly: boolean
  view: SessionView
  staleSession?: boolean
}
