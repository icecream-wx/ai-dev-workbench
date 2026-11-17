/** 开发会话视图类型（与 backend/src/dev 对齐） */
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
  /** I-09a：compaction 等系统提示的种类（不当作 assistant 文本） */
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

/** I-09a：会话上下文健康度（按模型上下文上限的百分比） */
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

// ---- U7：开发阶段（与 backend/src/dev/phases.ts 对齐） ----

export type DevPhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export type DevPhaseKind = 'base' | 'module' | 'epic' | 'other' | 'pageSets' | 'all'

export type DevPhaseSummarySource = 'model' | 'fallback' | 'none'

/** 阶段轻量引用（会话/开发状态里展示；`order` 为可执行阶段 1-based） */
export interface DevPhaseRef {
  id: string
  key: string
  title: string
  order: number
  status: DevPhaseStatus
  /** M6b：kind / 模块归属 */
  kind: DevPhaseKind
  moduleId: string | null
  moduleKey: string | null
  moduleTitle: string | null
  /** M6b：父模块 key（模块内 Epic/other/pageSets/all）；应用级/模块行为 null */
  parentKey: string | null
}

export interface DevPhaseScope {
  kind: DevPhaseKind
  storyIds: string[]
  pageSetCodes: string[]
  pageCodes: string[]
  note?: string
}

/** 阶段对应会话摘要（active 优先，否则最新创建） */
export interface DevPhaseSessionSummary {
  id: string
  title: string | null
  displayTitle: string
  status: string
  createdAt: string
}

export interface DevPhaseView extends DevPhaseRef {
  goal: string
  scope: DevPhaseScope
  summary: string | null
  summarySource: DevPhaseSummarySource | null
  startedAt: string | null
  completedAt: string | null
  handoffVersion: number
  changeSetId: string | null
  createdAt: string
  updatedAt: string
  session: DevPhaseSessionSummary | null
  sessionCount: number
}

export interface DevPhasesResponse {
  handoffVersion: number | null
  changeSet: { id: string; seq: number; title: string; status: string } | null
  /** 最新交接包可生成阶段且尚未生成 */
  canGenerate: boolean
  generated: boolean
  phases: DevPhaseView[]
  /** M6b：模块里程碑分组 */
  modules: DevPhaseModuleSummary[]
  modulePhaseCount: number
}

/** M6b：模块里程碑汇总（状态由子阶段派生） */
export interface DevPhaseModuleSummary {
  id: string
  key: string
  moduleId: string | null
  title: string
  order: number
  status: DevPhaseStatus
  total: number
  completed: number
  skipped: number
  inProgress: number
}

export interface DevSessionInfo {
  id: string
  opencodeSessionId: string
  agent: string
  model: { providerID: string; id: string; variant?: string | null } | null
  status: string
  title: string | null
  note: string | null
  changeSetId: string | null
  handoffVersion: number | null
  handoffHash: string | null
  createdAt: string
  updatedAt: string
  lastActiveAt: string | null
  /** U7：阶段会话标签；旧会话为 null */
  phase: DevPhaseRef | null
}

/** I-10 左侧会话列表项 */
export interface DevSessionListItem {
  id: string
  opencodeSessionId: string
  title: string | null
  note: string | null
  displayTitle: string
  opencodeTitle: string | null
  status: string
  model: { providerID: string; id: string; variant?: string | null } | null
  createdAt: string
  updatedAt: string
  lastActiveAt: string | null
  changeSetId: string | null
  changeSetSeq: number | null
  changeSetTitle: string | null
  changeSetStatus: string | null
  handoffVersion: number | null
  handoffHash: string | null
  opencodeExists: boolean | null
  active: boolean
  /** U7：阶段会话标签（旧会话均为 null） */
  phaseId: string | null
  phaseKey: string | null
  phaseTitle: string | null
  phaseOrder: number | null
  phaseStatus: string | null
  /** M6b：阶段所属模块 */
  phaseKind: string | null
  phaseModuleId: string | null
  phaseModuleKey: string | null
  phaseModuleTitle: string | null
  phaseParentKey: string | null
}

export interface DevSessionListResponse {
  sessions: DevSessionListItem[]
  activeSessionId: string | null
  handoffVersion: number | null
}

export interface HandoffSummary {
  version: number
  hash: string
  createdAt: string
  changeSet?: { id: string; seq: number; title: string; status: string } | null
}

export interface DevStateResponse {
  app: {
    id: string
    name: string
    status: string
    completedAt: string | null
    handoff: HandoffSummary | null
  }
  session: DevSessionInfo | null
  state: DevSessionState | null
  defaultPrompt: string
  handoffReady: boolean
  readOnly: boolean
  staleSession?: boolean
  /** U7：最新交接包的阶段摘要（未生成时为空数组） */
  phases: DevPhaseRef[]
}

/** U7：开始阶段返回开发状态 + 顶层阶段详情 */
export type DevPhaseStartResponse = DevStateResponse & { phase: DevPhaseView }

/** U7：完成阶段返回阶段详情 + 非阻塞提示（摘要失败等） */
export interface DevPhaseCompleteResponse {
  phase: DevPhaseView
  warnings: string[]
}
