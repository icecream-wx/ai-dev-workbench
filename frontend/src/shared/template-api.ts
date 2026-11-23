/**
 * 全局模板库 API（需求模板）
 *
 * 模板唯一权威在 DB（`/api/requirement-templates`），应用内 `.opencode/skills/**` 只是派发副本。
 * 设计阶段不使用本库：设计模板 = 应用类型 × 视觉风格 + 页面库（见 design-system-api.ts）。
 */

export interface TemplateSectionDef {
  id: string
  title: string
  level: 2 | 3
  kind: string
  guidance: string
  required: boolean
}

export interface RequirementTemplate {
  id: string
  name: string
  stage: 'requirements' | 'design' | 'test' | 'dev-plan'
  category: string
  description: string
  prompt: string
  sections: TemplateSectionDef[]
  builtin: boolean
  visibility: 'builtin' | 'private'
  createdAt: string
  updatedAt: string
}

export type TemplateKind = 'requirement'

export interface TemplateUsage {
  kind: TemplateKind
  id: string
  apps: Array<{ appId: string; appName: string; modules: Array<{ module: string; file: string }> }>
}

export class TemplateApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
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

// ---- 需求模板 ----

export async function listRequirementTemplates(): Promise<RequirementTemplate[]> {
  const data = await request<{ templates?: RequirementTemplate[] }>('GET', '/requirement-templates')
  return Array.isArray(data.templates) ? data.templates : []
}

export async function createRequirementTemplate(payload: Record<string, unknown>): Promise<RequirementTemplate> {
  const data = await request<{ template: RequirementTemplate }>('POST', '/requirement-templates', payload)
  return data.template
}

export async function updateRequirementTemplate(id: string, payload: Record<string, unknown>): Promise<RequirementTemplate> {
  const data = await request<{ template: RequirementTemplate }>('PUT', `/requirement-templates/${encodeURIComponent(id)}`, payload)
  return data.template
}

export async function deleteRequirementTemplate(id: string): Promise<void> {
  await request('DELETE', `/requirement-templates/${encodeURIComponent(id)}`)
}

export async function duplicateRequirementTemplate(id: string, name?: string): Promise<RequirementTemplate> {
  const data = await request<{ template: RequirementTemplate }>(
    'POST',
    `/requirement-templates/${encodeURIComponent(id)}/duplicate`,
    name === undefined ? {} : { name }
  )
  return data.template
}

// ---- 同步 / 引用 ----

export interface SyncTemplateResult {
  apps: string[]
  /** 应用内生成的模板 skill（adw-template-req-<id> / adw-template-proto-<id>） */
  templateSkill: string
  /** 同步告警（例如模板 skill 未被 opencode 加载）；失败只提示，不阻塞 */
  warnings: string[]
}

export async function syncTemplate(kind: TemplateKind, id: string): Promise<SyncTemplateResult> {
  const data = await request<{ apps?: string[]; templateSkill?: string; warnings?: string[] }>(
    'POST',
    `/templates/${kind}/${encodeURIComponent(id)}/sync`
  )
  return {
    apps: Array.isArray(data.apps) ? data.apps : [],
    templateSkill: typeof data.templateSkill === 'string' ? data.templateSkill : '',
    warnings: Array.isArray(data.warnings) ? data.warnings.filter(item => typeof item === 'string') : []
  }
}

export async function templateUsage(kind: TemplateKind, id: string): Promise<TemplateUsage> {
  return request<TemplateUsage>('GET', `/templates/${kind}/${encodeURIComponent(id)}/usage`)
}

export const SECTION_KIND_LABELS: Record<string, string> = {
  markdown: '正文',
  meta: '文档信息',
  metrics: '指标',
  roles: '角色',
  scenes: '场景',
  epics: 'Epic/故事',
  rules: '规则',
  pages: '页面',
  nfr: '非功能',
  issues: '待澄清',
  glossary: '术语',
  acceptance: '验收'
}

export function templateStageLabel(stage: string): string {
  if (stage === 'requirements') return '需求'
  if (stage === 'design') return '设计'
  if (stage === 'test') return '测试'
  if (stage === 'dev-plan') return '开发计划'
  return stage
}
