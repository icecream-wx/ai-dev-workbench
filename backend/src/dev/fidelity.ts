/**
 * 设计一致性静态检查（P7-6a，只读）
 *
 * 规则只有一份：`templates/agent/skills/adw-frontend-implementation/scripts/lib/fidelity-core.cjs`
 * （应用内 `.opencode/skills/.../scripts/lib/fidelity-core.cjs` 是同一份分发副本）。
 * 后端 API 与 CLI 输出字段一致：checks / summary / generatedAt / module / designSystem。
 *
 * - 应用不存在 → 404；应用目录缺失 → 409；
 * - 模块 id 非法 → 400；
 * - 无设计 → 200 + `{ empty: true, reason }`（不 500）；
 * - 文件缺失/JSON 损坏由核心降级为 warn/fail。
 */
import fs from 'node:fs'
import path from 'node:path'
import { db } from '../db'
import { appDirOf } from '../apps/scaffold'
import { isSafeModuleId } from './ui-check'

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

type CoreReport = Omit<DesignFidelityReport, 'appId'>

interface FidelityCore {
  runFidelityCheck: (input: { appDir: string; module?: string }) => CoreReport
}

const REPO_CORE = path.resolve(
  __dirname,
  '../../../templates/agent/skills/adw-frontend-implementation/scripts/lib/fidelity-core.cjs'
)

function appCoreOf(appDir: string): string {
  return path.join(appDir, '.opencode', 'skills', 'adw-frontend-implementation', 'scripts', 'lib', 'fidelity-core.cjs')
}

function httpError(status: number, message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number }
  error.status = status
  return error
}

let cachedCore: FidelityCore | null = null

/** 优先使用工作台内置规则，保证 API 与仓库脚本同版本；缺失时回退应用内分发副本 */
function loadCore(appDir: string): FidelityCore {
  if (cachedCore) return cachedCore
  const candidates = [REPO_CORE, appCoreOf(appDir)]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    try {
      cachedCore = require(file) as FidelityCore
      return cachedCore
    } catch (error) {
      throw httpError(
        500,
        `一致性检查脚本加载失败（${path.basename(file)}）：${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  throw httpError(500, '一致性检查脚本缺失：templates/agent/skills/adw-frontend-implementation/scripts/lib/fidelity-core.cjs')
}

export interface DesignFidelityOptions {
  /** 只检查一个设计模块；缺省检查 docs/design/ 下全部模块 */
  module?: unknown
  /** 测试可注入应用目录；默认 projects/<appId> */
  appDir?: string
}

/**
 * 运行一致性检查。只读，不写文件、不启动 opencode、不调用模型。
 */
export function runDesignFidelity(appId: string, options: DesignFidelityOptions = {}): DesignFidelityReport {
  const row = db.prepare('SELECT id FROM apps WHERE id = ?').get(appId) as { id: string } | undefined
  if (!row) throw httpError(404, `应用不存在：${appId}`)

  let moduleKey = ''
  if (options.module !== undefined && options.module !== null && options.module !== '') {
    if (typeof options.module !== 'string') throw httpError(400, 'module 必须为字符串')
    moduleKey = options.module.trim()
    if (!isSafeModuleId(moduleKey)) {
      throw httpError(400, `模块 id 非法：${moduleKey}（只允许字母/数字/_/-，2-65 字符）`)
    }
  }

  const appDir = options.appDir ?? appDirOf(appId)
  if (!fs.existsSync(appDir)) throw httpError(409, `应用目录不存在：${appDir}`)

  const core = loadCore(appDir)
  const report = core.runFidelityCheck({ appDir, ...(moduleKey ? { module: moduleKey } : {}) })
  return { appId, ...report }
}
