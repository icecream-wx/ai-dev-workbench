/**
 * 共享生成核心加载（P7-7a）
 *
 * 生成实现只有一份：`templates/workshop/skills/adw-design-template-authoring/scripts/lib/*.cjs`
 * （工作室 `.opencode/scripts/lib` 是同一份受管副本）。与 `dev/fidelity.ts` 一样，
 * 后端按仓库路径 `require` 这份核心，不依赖 tsc 复制 `.cjs`。
 *
 * 这里只提供 TS 类型壳与加载；权威校验仍是 `design/pack.ts#validatePackDir`。
 */
import fs from 'node:fs'
import path from 'node:path'

export interface SpecIssue {
  code: string
  path: string
  message: string
}

export interface NormalizedSpecPage {
  id: string
  name: string
  kind: 'reference' | 'contract'
  type: string
  recipe: string
  preview: string
  description: string
  source?: { pack: string; applicationType: string; pageId: string }
  contract?: Record<string, unknown>
  sampleEntity?: unknown
  sampleSubEntities?: unknown[]
}

export interface NormalizedSpec {
  schemaVersion: number
  id: string
  name: string
  description: string
  baseApplicationType: string
  style: string
  pages: NormalizedSpecPage[]
}

export interface NormalizeResult {
  ok: boolean
  spec: NormalizedSpec | null
  errors: SpecIssue[]
  warnings: SpecIssue[]
  specHash?: string
}

export interface CssRule {
  media: string
  selector: string
  body: string
}

export interface CssMergeConflict {
  selector: string
  media: string
  sources: string[]
  effect: string
}

export interface CssMergeResult {
  css: string
  sources: string[]
  totalRules: number
  rules: number
  uniqueTriples: number
  deduped: number
  atRules: number
  conflicts: CssMergeConflict[]
  warnings: SpecIssue[]
}

export interface GeneratorPageReport {
  id: string
  name: string
  kind: 'reference' | 'contract'
  recipe: string
  source?: string
  blueprint?: string
}

export interface GeneratorCssReport {
  sources: string[]
  totalRules: number
  rules: number
  deduped: number
  atRules: number
  conflicts: string[]
  conflictDetails: CssMergeConflict[]
}

export interface GeneratorResult {
  ok: boolean
  spec?: NormalizedSpec
  specHash?: string
  pack?: { id: string; name: string; version: string; revision: number; pageCount: number }
  pages?: GeneratorPageReport[]
  css?: GeneratorCssReport
  assets?: string[]
  warnings: SpecIssue[]
  errors: SpecIssue[]
}

export interface GeneratorInput {
  spec: unknown
  builtin: unknown
  builtinRoot: string
  targetDir: string
  packId?: string
  reservedIds?: string[]
  knownComponents?: string[]
  publishedRevision?: number
}

interface SpecCore {
  normalizeSpec: (
    raw: unknown,
    options: { packId?: string; builtin: unknown; reservedIds?: string[]; knownComponents?: string[] }
  ) => NormalizeResult
  specHash: (spec: unknown) => string
  slugifyPackId: (name: string) => string
  isValidPackId: (value: unknown) => boolean
  flattenContract: (contract: unknown) => Record<string, unknown>
  buildSyntheticDesign: (spec: unknown, pageId: string) => Record<string, unknown> | null
  previewForRecipe: (recipe: string) => string
  RECIPES: string[]
  PAGE_TYPES: string[]
}

interface CssCore {
  mergeStructureCss: (sources: Array<{ type: string; css: string }>) => CssMergeResult
  parseStructureCss: (css: string) => { rules: CssRule[]; atRules: string[]; warnings: SpecIssue[] }
}

interface GeneratorCore {
  generatePack: (input: GeneratorInput) => GeneratorResult
}

export interface WorkshopCore {
  spec: SpecCore
  css: CssCore
  generator: GeneratorCore
}

/** 仓库内共享核心目录 */
export function workshopScriptsRoot(): string {
  return path.resolve(__dirname, '../../../templates/workshop/skills/adw-design-template-authoring/scripts')
}

let cached: WorkshopCore | null = null

function requireCore<T>(file: string): T {
  if (!fs.existsSync(file)) {
    throw new Error(`设计模板生成核心缺失：${file}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(file) as T
}

export function workshopCore(): WorkshopCore {
  if (cached) return cached
  const root = workshopScriptsRoot()
  cached = {
    spec: requireCore<SpecCore>(path.join(root, 'lib', 'spec.cjs')),
    css: requireCore<CssCore>(path.join(root, 'lib', 'css.cjs')),
    generator: requireCore<GeneratorCore>(path.join(root, 'lib', 'generator.cjs'))
  }
  return cached
}
