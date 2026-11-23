/**
 * 设计模板包 / 应用级设计系统 API 客户端（P7-1）
 *
 * 只做类型与请求；模板中心 UI、预览、新建应用选择在 P7-3 接入。
 * 内置 pack 由后端从 `templates/design-system/` 读取，不写入数据库。
 */
import { TemplateApiError } from './template-api'

export type DesignDensity = 'compact' | 'comfortable'

export interface DesignStyleTokens {
  primary: string
  accent: string
  neutral: string
  background: string
  radius: number
  density: DesignDensity
}

export interface DesignStyle {
  id: string
  name: string
  className: string
  css: string
  description: string
  signature: string
  tokens: DesignStyleTokens
}

export type DesignPageKind = 'blueprint' | 'reference' | 'contract'

export interface DesignPageSource {
  pack: string
  applicationType: string
  pageId: string
  blueprint?: string
  sha256?: string
}

export interface DesignSampleField {
  name: string
  label?: string
  type?: string
  required?: boolean
  unique?: boolean
  options?: string[]
  ref?: string
  note?: string
}

export interface DesignSampleEntity {
  id: string
  name: string
  fields: DesignSampleField[]
}

export interface DesignPackOrigin {
  kind: 'custom'
  draftId: string
  builtFrom?: { pack: string; version: string }
  baseApplicationType: string
  style: string
  revision: number
  specHash?: string
  publishedAt?: string
}

export interface DesignPageMeta {
  id: string
  name: string
  type: string
  recipe: string
  preview: string
  description: string
  /** 页面种类：blueprint（内置）/ reference（自定义引用页）/ contract（自定义契约页） */
  kind?: DesignPageKind
  /** blueprint/reference 有；contract 省略 */
  blueprint?: string
  /** 仅 reference */
  source?: DesignPageSource
  /** 仅 contract：页面契约容器 */
  contract?: Record<string, unknown>
  /** 仅 contract：模板预览样例实体 */
  sampleEntity?: DesignSampleEntity
  sampleSubEntities?: DesignSampleEntity[]
  /** 仅 contract（应用级摘要）：工作区契约文件 */
  contractFile?: string
  components: string[]
  blocks?: number
}

export interface DesignApplicationType {
  id: string
  name: string
  category: string
  description: string
  structure: string
  assets?: string[]
  defaultStyle: string
  pages: DesignPageMeta[]
}

export interface DesignPack {
  schemaVersion: 1
  id: string
  name: string
  version: string
  defaultApplicationType: string
  defaultStyle: string
  origin?: DesignPackOrigin
  applicationTypes: DesignApplicationType[]
  styles: DesignStyle[]
  skills: string[]
  componentMap: Record<string, string>
  pageRecipes: Record<string, string[]>
  conformance: string[]
}

export type DesignPackSource = 'builtin' | 'custom'

export interface DesignApplicationTypeSummary {
  id: string
  name: string
  category: string
  description: string
  structure: string
  defaultStyle: string
  pageCount: number
}

export interface DesignStyleSummary {
  id: string
  name: string
  className: string
  description: string
  signature: string
  css: string
  tokens: DesignStyleTokens
}

export interface DesignPackSummary {
  id: string
  name: string
  version: string
  defaultApplicationType: string
  defaultStyle: string
  source: DesignPackSource
  /** P7-7a：显式模板来源（与 source 相同） */
  templateKind?: DesignPackSource
  /** 自定义 pack 的来源（内置为空/缺省） */
  origin?: DesignPackOrigin
  /** P7-7b-2b：自定义 pack 被应用引用（内置为空/缺省） */
  referencedApps?: Array<{ id: string; name: string }>
  pageCount: number
  applicationTypes: DesignApplicationTypeSummary[]
  styles: DesignStyleSummary[]
  skills: string[]
}

export interface AppDesignSystemSelection {
  pack?: string
  applicationType?: string
  style?: string
}

export interface AppDesignSystemOrigin {
  kind: 'custom'
  draftId: string
  baseApplicationType: string
}

export interface AppDesignSystemPreview {
  kind: 'custom'
  baseApplicationType: string
  structure: string
  structureUrl: string
  styleClassName: string
  packVersion: string
}

export interface AppDesignSystem {
  appId: string
  source: DesignPackSource | 'global-default' | 'app-default'
  pack: { id: string; name: string; version: string; source: DesignPackSource } | null
  /** 仅自定义 pack：来源信息 */
  origin?: AppDesignSystemOrigin | null
  /** 仅自定义 pack：设计预览映射（内置为 null，走 preview registry） */
  preview?: AppDesignSystemPreview | null
  applicationType: DesignApplicationTypeSummary | null
  style: DesignStyle | null
  pages: DesignPageMeta[]
  skills: string[]
  componentMap: Record<string, string>
  pageRecipes: Record<string, string[]>
  conformance: string[]
  resolved: { pack: string; applicationType: string; style: string; pageCount: number } | null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const message = (data as { error?: unknown } | null)?.error
    throw new TemplateApiError(res.status, typeof message === 'string' ? message : `请求失败（HTTP ${res.status}）`)
  }
  return data as T
}

export async function listDesignPacks(): Promise<DesignPackSummary[]> {
  const data = await request<{ packs?: DesignPackSummary[] }>('GET', '/design-system')
  return Array.isArray(data.packs) ? data.packs : []
}

export async function getDesignPack(packId: string): Promise<DesignPack> {
  const data = await request<{ pack: DesignPack }>('GET', `/design-system/${encodeURIComponent(packId)}`)
  return data.pack
}

export async function getAppDesignSystem(appId: string): Promise<AppDesignSystem> {
  return request<AppDesignSystem>('GET', `/apps/${encodeURIComponent(appId)}/design-system`)
}

export async function updateAppDesignSystem(
  appId: string,
  selection: AppDesignSystemSelection
): Promise<AppDesignSystem> {
  const data = await request<{ designSystem: AppDesignSystem }>(
    'PATCH',
    `/apps/${encodeURIComponent(appId)}/design-system`,
    selection
  )
  return data.designSystem
}
