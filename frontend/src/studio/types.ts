/**
 * 模板工作室（P7-7b-2a）前端类型：草稿详情 / 生成报告 / pack 页面 / 模型。
 *
 * 与后端 `backend/src/design-template/{draft,generator,studio}.ts` 对齐；
 * 不新增共享类型，避免影响应用三视图（`dev/types.ts` 只新增 SessionView）。
 */

export interface SpecIssue {
  code: string
  path: string
  message: string
}

export type DraftStatus = 'draft' | 'published'

export interface DraftJson {
  schemaVersion: 1
  id: string
  name: string
  style: string
  baseApplicationType: string
  status: DraftStatus
  createdAt: string
  updatedAt: string
  publishedVersion: string | null
  lastSpecHash: string | null
}

export interface DraftValidation {
  ok: boolean
  errors: SpecIssue[]
  warnings: SpecIssue[]
}

export interface PackPageSummary {
  id: string
  name: string
  kind: string
  recipe: string
  source?: string
  blueprint?: string
}

export interface DraftPackSummary {
  id: string
  version: string
  revision: number
  pageCount: number
  pages: PackPageSummary[]
}

export interface GenerationCssReport {
  sources?: string[]
  rules?: number
  deduped?: number
  conflicts?: string[]
}

export interface GenerationFile {
  generatedAt: string
  specHash: string
  pageCount?: number
  pack?: { id: string; name: string; version: string; revision: number; pageCount: number }
  sources?: string[]
  css?: GenerationCssReport
  warnings: SpecIssue[]
  errors: SpecIssue[]
}

export interface ReferencedApp {
  id: string
  name: string
}

/** 模板中心自定义列表项（`GET /api/design-templates/drafts`） */
export interface DraftSummary {
  id: string
  name: string
  status: DraftStatus
  style: string
  baseApplicationType: string
  version: string | null
  publishedVersion: string | null
  createdAt: string
  updatedAt: string
  pageCount: number
  hasPack: boolean
  hasSpec: boolean
  validation: DraftValidation
  pack?: DraftPackSummary
  referencedApps?: ReferencedApp[]
}

export interface CreateDraftInput {
  name: string
  style?: string
  baseApplicationType?: string
  id?: string
}

export interface DraftDetail {
  draft: DraftJson
  spec: Record<string, unknown> | null
  specError: string | null
  packSummary: DraftPackSummary | null
  /** 权威 pack（已生成；含 kind/source/contract/sampleEntity 页面元数据） */
  pack?: StudioPack | null
  generation: GenerationFile | null
  validation: DraftValidation
  referencedApps?: ReferencedApp[]
}

/** 生成/发布 4xx 响应里附带的 errors/warnings（`StudioApiError.payload`） */
export interface DraftFailurePayload {
  ok?: false
  error?: string
  code?: string
  errors?: SpecIssue[]
  warnings?: SpecIssue[]
  /** 兼容顶层 apps；后端 `pack-referenced` 实际放在 details.apps */
  apps?: ReferencedApp[]
  details?: { apps?: ReferencedApp[] } & Record<string, unknown>
}

export interface StudioModelRef {
  providerID: string
  id: string
  variant?: string | null
}

export interface StudioModelResponse {
  stage: 'template'
  agent: string
  model: StudioModelRef | null
  fallback: StudioModelRef | null
}

export interface OpencodeModel {
  id: string
  providerID: string
  modelID: string
  name: string
  variants?: string[]
}

export interface StudioSessionResponse {
  view: 'template'
  draft: DraftJson
  session: Record<string, unknown> | null
  sessions: Array<Record<string, unknown>>
  activeSessionId: string | null
  state: Record<string, unknown> | null
  defaultPrompt: string
  spec: Record<string, unknown> | null
  specError: string | null
  validation: DraftValidation
  readOnly: boolean
  staleSession?: boolean
}

/** 自定义 pack（`pack.json` 子集；用于工作室页面清单/预览） */
export interface StudioPackPage {
  id: string
  name: string
  type: string
  recipe: string
  kind?: string
  source?: { pack?: string; applicationType?: string; pageId?: string }
  blueprint?: string
  components?: string[]
}

export interface StudioPack {
  id: string
  name: string
  version: string
  defaultStyle: string
  origin?: { kind?: string; baseApplicationType?: string; revision?: number }
  applicationTypes: Array<{ id: string; name: string; structure: string; pages: StudioPackPage[] }>
  styles: Array<{ id: string; name: string }>
}
