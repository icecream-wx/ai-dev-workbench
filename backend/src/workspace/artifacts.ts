/**
 * 产物解析：`docs/` 是唯一事实源
 *
 * - 需求：`docs/requirements/*.md`（排除 README.md）→ frontmatter + `##` 章节
 * - 设计：`docs/design/<MOD>/design.json` → schema 校验 + 结构化结果
 * - 聚合：模块列表 / 设计列表 / 错误 / 文件 hash（供 SSE 变化通知与前端增量重读）
 *
 * 校验错误**不抛 500**：作为 artifacts 的一部分返回，UI 显示“文件/字段/期望”。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { appDirOf } from '../apps/scaffold'
import { parseFrontmatter, splitMarkdownSections } from './frontmatter'
import { validateJsonSchema, type SchemaError } from './schema'
import { designContractWarnings } from './design-contract'
import {
  readDesignBrief,
  readDesignTokens,
  readPrototypeArtifact,
  type PrototypeArtifact
} from '../design/prototypes'
import { readUiCheck, type UiCheckStatus } from '../dev/ui-check'

export interface ArtifactError {
  file: string
  path: string
  message: string
  expected?: string
}

export interface RequirementSection {
  key: string
  title: string
  level: number
  markdown: string
}

export interface RequirementModuleArtifact {
  key: string
  title: string
  order: number
  template: string
  file: string
  sections: RequirementSection[]
  errors: ArtifactError[]
  warnings: string[]
}

export interface DesignArtifact {
  file: string
  module: string
  title: string
  entities: unknown[]
  relations: unknown[]
  pages: unknown[]
  errors: ArtifactError[]
  warnings: string[]
  /** P7-4a：design.json 顶层设计系统摘要（可选，原样透传；adapter 负责规范化） */
  designSystem?: { pack?: string; applicationType?: string; style?: string }
  /** P6-3：原型参考包（只读；无 manifest 时省略） */
  prototypes?: PrototypeArtifact
  brief?: { exists: boolean; file: string }
  tokens?: { exists: boolean; styleId?: string }
  /** P7-5b：开发对照表状态（只读；由开发 prompt 生成骨架） */
  uiCheck?: { exists: boolean; file: string; status: UiCheckStatus }
}

export interface ArtifactsResponse {
  appId: string
  modules: RequirementModuleArtifact[]
  designs: DesignArtifact[]
  errors: ArtifactError[]
  hashes: Record<string, string>
}

const MODULE_KEY_PATTERN = /^MOD-\d{3,}$/

function relative(appDir: string, file: string): string {
  return path.relative(appDir, file).replace(/\\/g, '/')
}

function listFiles(directory: string, out: string[] = []): string[] {
  if (!fs.existsSync(directory)) return out
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) listFiles(full, out)
    else if (entry.isFile()) out.push(full)
  }
  return out
}

/** docs/ 下所有文件的 hash（相对路径 → sha256） */
export function docsHashes(appDir: string): Record<string, string> {
  const hashes: Record<string, string> = {}
  for (const file of listFiles(path.join(appDir, 'docs')).sort()) {
    try {
      hashes[relative(appDir, file)] = createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    } catch {
      // 文件在扫描过程中被删除：忽略
    }
  }
  return hashes
}

/** 需求模块解析（不改文件） */
function readRequirementModules(appDir: string): { modules: RequirementModuleArtifact[]; errors: ArtifactError[] } {
  const directory = path.join(appDir, 'docs', 'requirements')
  const modules: RequirementModuleArtifact[] = []
  const errors: ArtifactError[] = []
  if (!fs.existsSync(directory)) return { modules, errors }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.toLowerCase() === 'readme.md') continue
    const file = path.join(directory, entry.name)
    const rel = relative(appDir, file)
    const moduleErrors: ArtifactError[] = []
    const warnings: string[] = []
    let text = ''
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch (error) {
      moduleErrors.push({ file: rel, path: '$', message: `无法读取文件：${error instanceof Error ? error.message : String(error)}` })
      modules.push({ key: '', title: entry.name, order: 0, template: '', file: rel, sections: [], errors: moduleErrors, warnings })
      errors.push(...moduleErrors)
      continue
    }

    const parsed = parseFrontmatter(text)
    for (const message of parsed.errors) moduleErrors.push({ file: rel, path: 'frontmatter', message })

    const rawKey = (parsed.data.module ?? '').trim()
    if (!rawKey) moduleErrors.push({ file: rel, path: 'module', message: '缺少 module', expected: 'MOD-xxx' })
    else if (!MODULE_KEY_PATTERN.test(rawKey)) {
      moduleErrors.push({ file: rel, path: 'module', message: 'module 格式不正确', expected: 'MOD-001' })
    }
    const title = (parsed.data.title ?? '').trim()
    if (!title) moduleErrors.push({ file: rel, path: 'title', message: '缺少 title', expected: '模块标题' })

    const orderRaw = Number(parsed.data.order)
    const order = Number.isFinite(orderRaw) && orderRaw > 0 ? Math.round(orderRaw) : 0
    if (parsed.data.order !== undefined && order === 0) {
      warnings.push(`order 不是正整数，已按 0 处理：${parsed.data.order}`)
    }

    const expectedPrefix = rawKey ? `${rawKey}-` : ''
    if (rawKey && !entry.name.startsWith(expectedPrefix)) {
      warnings.push(`文件名建议以 ${expectedPrefix} 开头（当前 ${entry.name}）`)
    }

    const sections = splitMarkdownSections(parsed.body).map(section => ({
      key: section.key,
      title: section.title,
      level: section.level,
      markdown: section.markdown.trim()
    }))

    modules.push({
      key: rawKey,
      title,
      order,
      template: (parsed.data.template ?? '').trim(),
      file: rel,
      sections,
      errors: moduleErrors,
      warnings
    })
    errors.push(...moduleErrors)
  }

  const seen = new Map<string, string>()
  for (const module of modules) {
    if (!module.key) continue
    const first = seen.get(module.key)
    if (first) {
      const error = { file: module.file, path: 'module', message: `module 重复：${module.key}（另见 ${first}）`, expected: module.key }
      module.errors.push(error)
      errors.push(error)
    } else {
      seen.set(module.key, module.file)
    }
  }

  modules.sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER) || a.file.localeCompare(b.file))
  return { modules, errors }
}

/** schema 来源：优先应用内副本（agent 读到的同一份），否则仓库资产 */
export function designSchemaPath(appDir: string): string | null {
  const candidates = [
    path.join(appDir, '.opencode', 'skills', 'adw-design-artifacts', 'references', 'design.schema.json'),
    path.resolve(__dirname, '../../../templates/agent/skills/adw-design-artifacts/references/design.schema.json')
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/** 设计产物解析 + schema 校验（不改文件） */
export function readDesigns(appDir: string): { designs: DesignArtifact[]; errors: ArtifactError[] } {
  const directory = path.join(appDir, 'docs', 'design')
  const designs: DesignArtifact[] = []
  const errors: ArtifactError[] = []
  if (!fs.existsSync(directory)) return { designs, errors }

  let schema: Record<string, unknown> | null = null
  const schemaFile = designSchemaPath(appDir)
  if (schemaFile) {
    try {
      schema = JSON.parse(fs.readFileSync(schemaFile, 'utf8')) as Record<string, unknown>
    } catch {
      schema = null
    }
  }
  if (!schema) {
    errors.push({ file: relative(appDir, directory), path: '$', message: '缺少 design.schema.json，无法校验设计文件', expected: 'schema' })
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = path.join(directory, entry.name, 'design.json')
    if (!fs.existsSync(file)) continue
    const rel = relative(appDir, file)
    const designErrors: ArtifactError[] = []
    const warnings: string[] = []
    let data: Record<string, unknown> = {}
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
    } catch (error) {
      designErrors.push({
        file: rel,
        path: '$',
        message: `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`,
        expected: 'valid json'
      })
      designs.push({ file: rel, module: entry.name, title: entry.name, entities: [], relations: [], pages: [], errors: designErrors, warnings })
      errors.push(...designErrors)
      continue
    }

    for (const error of validateJsonSchema(schema, data) as SchemaError[]) {
      designErrors.push({ file: rel, path: error.path, message: error.message, ...(error.expected ? { expected: error.expected } : {}) })
    }

    // P7-6c：推荐动作码 / 树形态只 warning（保留原值，不阻断旧设计）
    for (const warning of designContractWarnings(data)) {
      warnings.push(`${warning.path}：${warning.message}`)
    }

    const module = typeof data.module === 'string' ? data.module.trim() : ''
    if (!module) designErrors.push({ file: rel, path: 'module', message: '缺少 module', expected: 'MOD-xxx' })
    else if (entry.name !== module) warnings.push(`目录名 ${entry.name} 与 module ${module} 不一致`)

    const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
    const designSystem =
      data.designSystem && typeof data.designSystem === 'object' && !Array.isArray(data.designSystem)
        ? (data.designSystem as Record<string, unknown>)
        : null
    const prototypes = readPrototypeArtifact(appDir, entry.name)
    designs.push({
      file: rel,
      module: module || entry.name,
      title: typeof data.title === 'string' ? data.title : entry.name,
      entities: asArray(data.entities),
      relations: asArray(data.relations),
      pages: asArray(data.pages),
      errors: designErrors,
      warnings,
      ...(designSystem ? { designSystem } : {}),
      brief: readDesignBrief(appDir, entry.name),
      tokens: readDesignTokens(appDir, entry.name),
      uiCheck: readUiCheck(appDir, entry.name),
      ...(prototypes ? { prototypes } : {})
    })
    errors.push(...designErrors)
  }

  designs.sort((a, b) => a.module.localeCompare(b.module))
  return { designs, errors }
}

/** 聚合：模块 + 设计 + 错误 + hash（GET /api/apps/:id/artifacts） */
export function readArtifacts(appId: string): ArtifactsResponse {
  const appDir = appDirOf(appId)
  if (!fs.existsSync(appDir)) {
    return {
      appId,
      modules: [],
      designs: [],
      errors: [{ file: '', path: '$', message: `应用目录不存在：${appDir}` }],
      hashes: {}
    }
  }
  const modules = readRequirementModules(appDir)
  const designs = readDesigns(appDir)
  const errors = [...modules.errors, ...designs.errors]
  const known = new Set(modules.modules.map(module => module.key).filter(Boolean))
  for (const design of designs.designs) {
    if (known.size && !known.has(design.module)) {
      design.warnings.push(`设计模块 ${design.module} 没有对应需求模块文件`)
    }
  }
  return {
    appId,
    modules: modules.modules,
    designs: designs.designs,
    errors,
    hashes: docsHashes(appDir)
  }
}
