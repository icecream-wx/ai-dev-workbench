#!/usr/bin/env node
/**
 * 接口设计文档自查（只做快速反馈；最终以后端 /api/apps/:id/artifacts 为准）。
 *
 * 用法：
 *   node validate-api-design.mjs [--app <应用目录>] [--json] [--strict]
 *
 * - 读取 <app>/docs/design/api-design.md + entities.json + pages.json + 需求文档；
 * - 规则与后端/fidelity 共用 ../lib/api-design-core.cjs；
 * - 输出 {ok, file, interfaces, byEpic, errors, warnings, coverage}；
 * - 退出码：errors → 1；`--strict` 且有 warnings → 1；参数错误 → 2。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const core = require('./lib/api-design-core.cjs')

function usage() {
  return [
    '用法：node validate-api-design.mjs [--app <应用目录>] [--json] [--strict]',
    '',
    '  --app <dir>   应用工作区根目录（默认当前目录）',
    '  --json        只输出 JSON（默认也输出 JSON）',
    '  --strict      warnings 也以退出码 1 结束',
    '  -h, --help    显示帮助'
  ].join('\n')
}

function parseArgs(argv) {
  const options = { app: process.cwd(), strict: false, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--app') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) throw new Error('--app 缺少目录参数')
      options.app = value
      index += 1
    } else if (arg.startsWith('--app=')) {
      options.app = arg.slice('--app='.length)
    } else if (arg === '--json') {
      // 始终 JSON
    } else if (arg === '--strict') {
      options.strict = true
    } else if (arg === '-h' || arg === '--help') {
      options.help = true
    } else {
      throw new Error(`未知参数：${arg}`)
    }
  }
  return options
}

let options
try {
  options = parseArgs(process.argv.slice(2))
} catch (error) {
  console.error(`[validate-api-design] ${error instanceof Error ? error.message : String(error)}`)
  console.error(usage())
  process.exit(2)
}
if (options.help) {
  console.log(usage())
  process.exit(0)
}

const appDir = path.resolve(options.app)
if (!fs.existsSync(appDir) || !fs.statSync(appDir).isDirectory()) {
  console.error(`[validate-api-design] 应用目录不存在或不是目录：${appDir}`)
  console.error(usage())
  process.exit(2)
}

let result
try {
  result = core.runApiDesignCheckForApp(appDir)
} catch (error) {
  console.error(`[validate-api-design] 校验失败：${error instanceof Error ? error.message : String(error)}`)
  process.exit(2)
}

console.log(JSON.stringify(result, null, 2))
if (result.errors.length) process.exit(1)
if (options.strict && result.warnings.length) process.exit(1)
