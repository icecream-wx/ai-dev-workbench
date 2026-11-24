/**
 * 接口设计文档（D2）：读取/校验 `docs/design/api-design.md`
 *
 * 规则只有一份：`templates/agent/skills/adw-api-design/scripts/lib/api-design-core.cjs`
 * （应用内 `.opencode/skills/adw-api-design/scripts/lib/api-design-core.cjs` 是同一份分发副本）。
 *
 * - 只做 Markdown 文档校验，不生成后端代码/OpenAPI；
 * - 文件缺失返回 exists:false，不抛 500；
 * - errors 供 artifacts/UI/fidelity 使用；warnings 只报告。
 */
import fs from 'node:fs'
import path from 'node:path'

export interface ApiDesignInterface {
  id: string
  method: string
  path: string
  name?: string
  operation?: string
  epic?: string
  page?: string
  entity?: string
  permission?: string
}

export interface ApiDesignCoveragePageAction {
  pageSet: string
  epic?: string
  page: string
  action: string
  interface: string
  covered: boolean
}

export interface ApiDesignCoverageEntity {
  entity: string
  list: string
  detail: string
  create: string
  update: string
  delete: string
  missing: string[]
}

export interface ApiDesignArtifact {
  exists: boolean
  file: string
  schemaVersion?: number
  /** 原始 Markdown（设计视图渲染用） */
  markdown: string
  interfaces: ApiDesignInterface[]
  byEpic: Array<{ epic: string; count: number }>
  errors: Array<{ file: string; path: string; message: string; expected?: string }>
  warnings: string[]
  coverage: {
    pageActions: ApiDesignCoveragePageAction[]
    entities: ApiDesignCoverageEntity[]
  }
}

interface CoreResult {
  ok: boolean
  exists?: boolean
  file: string
  interfaces: ApiDesignInterface[]
  byEpic: Array<{ epic: string; count: number }>
  errors: Array<{ path: string; message: string; expected?: string }>
  warnings: Array<{ path: string; message: string }>
  coverage: {
    pageActions: ApiDesignCoveragePageAction[]
    entities: ApiDesignCoverageEntity[]
  }
}

interface ApiDesignCore {
  API_FILE: string
  runApiDesignCheckForApp: (appDir: string) => CoreResult
}

const REPO_CORE = path.resolve(__dirname, '../../../templates/agent/skills/adw-api-design/scripts/lib/api-design-core.cjs')

function appCoreOf(appDir: string): string {
  return path.join(appDir, '.opencode', 'skills', 'adw-api-design', 'scripts', 'lib', 'api-design-core.cjs')
}

let cachedCore: ApiDesignCore | null = null

function loadCore(appDir: string): ApiDesignCore {
  if (cachedCore) return cachedCore
  for (const file of [REPO_CORE, appCoreOf(appDir)]) {
    if (!fs.existsSync(file)) continue
    try {
      cachedCore = require(file) as ApiDesignCore
      return cachedCore
    } catch (error) {
      throw new Error(`接口设计校验脚本加载失败（${path.basename(file)}）：${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error('接口设计校验脚本缺失：templates/agent/skills/adw-api-design/scripts/lib/api-design-core.cjs')
}

const FILE = 'docs/design/api-design.md'

function emptyCoverage(): ApiDesignArtifact['coverage'] {
  return { pageActions: [], entities: [] }
}

/** 读取并校验应用接口设计；不抛文件缺失错误 */
export function readApiDesign(appDir: string): ApiDesignArtifact {
  const file = path.join(appDir, ...FILE.split('/'))
  if (!fs.existsSync(file)) {
    return {
      exists: false,
      file: FILE,
      markdown: '',
      interfaces: [],
      byEpic: [],
      errors: [],
      warnings: [],
      coverage: emptyCoverage()
    }
  }
  const core = loadCore(appDir)
  const result = core.runApiDesignCheckForApp(appDir)
  return {
    exists: result.exists !== false,
    file: result.file || FILE,
    markdown: fs.readFileSync(file, 'utf8'),
    interfaces: result.interfaces ?? [],
    byEpic: result.byEpic ?? [],
    errors: (result.errors ?? []).map(error => ({
      file: FILE,
      path: error.path || '$',
      message: error.message,
      ...(error.expected ? { expected: error.expected } : {})
    })),
    warnings: (result.warnings ?? []).map(warning => `${warning.path}：${warning.message}`),
    coverage: result.coverage ?? emptyCoverage()
  }
}

export function apiDesignFileOf(appDir: string): string {
  return path.join(appDir, ...FILE.split('/'))
}

export { FILE as API_DESIGN_RELATIVE }
