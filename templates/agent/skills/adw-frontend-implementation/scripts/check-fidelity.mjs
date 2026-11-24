#!/usr/bin/env node
/**
 * 设计一致性静态检查（应用级，D1 去模块；只报告）
 *
 * 用法：
 *   node .opencode/skills/adw-frontend-implementation/scripts/check-fidelity.mjs \
 *     [--app <应用目录>] [--json] [--strict]
 *
 * - 默认检查当前目录（应用级，一次扫描全部页面集）；
 * - 读取 docs/design/design-system.json、docs/design/entities.json、docs/design/pages.json、
 *   docs/design/template/、frontend/src/、docs/design/ui-check.md 与 prototypes/_manifest.json；
 * - 只读，不执行代码、不写文件、不做截图比对；
 * - 退出码：默认 0（只报告）；`--strict` 且存在 fail 时为 1；参数/目录错误为 2。
 *
 * 规则与后端 POST /api/apps/:id/design-fidelity 共用 ./lib/fidelity-core.cjs（14 项）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import core from './lib/fidelity-core.cjs'

const here = path.dirname(fileURLToPath(import.meta.url))
void here
const { runFidelityCheck } = core

const STATUS_LABEL = { pass: '通过', warn: '警告', fail: '失败' }
const STATUS_ICON = { pass: '✓', warn: '!', fail: '✗' }
const SUMMARY_LABEL = { pass: '通过', warn: '有警告', fail: '有失败' }

function usage() {
  return [
    '用法：node check-fidelity.mjs [--app <应用目录>] [--json] [--strict]',
    '',
    '  --app <dir>      应用工作区根目录（默认当前目录）',
    '  --json           只输出 JSON（便于机器读取）',
    '  --strict         fail 时以退出码 1 结束（默认只报告，退出码 0）',
    '  -h, --help       显示帮助',
    '',
    '只读检查（应用级 14 项）：设计系统/页面契约/蓝图/实现视图/PageTemplates/pm-*/表单/列表/GlobalPreference/结构样式/模板契约页/ui-check/PNG stale/接口设计。'
  ].join('\n')
}

function parseArgs(argv) {
  const options = { app: process.cwd(), json: false, strict: false, help: false }
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
      options.json = true
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

function humanSummary(report, appDir) {
  const lines = []
  lines.push('设计一致性检查（只读，应用级）')
  lines.push(`应用目录：${appDir}`)
  lines.push(`总体：${SUMMARY_LABEL[report.summary.status]}（通过 ${report.summary.pass} · 警告 ${report.summary.warn} · 失败 ${report.summary.fail}）`)
  if (report.empty) {
    lines.push('无设计：docs/design/ 下没有 entities.json / pages.json；先在设计视图生成设计产物')
  }
  if (report.designSystem?.pack) {
    lines.push(
      `设计系统：${report.designSystem.pack}${report.designSystem.applicationType ? ` · ${report.designSystem.applicationType}` : ''}${
        report.designSystem.style ? ` · ${report.designSystem.style}` : ''
      } · ${report.designSystem.pageCount ?? 0} 页蓝图`
    )
  }
  lines.push('')
  for (const check of report.checks) {
    lines.push(`${STATUS_ICON[check.status] || '·'} [${STATUS_LABEL[check.status] || check.status}] ${check.label}`)
    if (check.evidence) lines.push(`    ${check.evidence}`)
    if (check.hint) lines.push(`    建议：${check.hint}`)
  }
  lines.push('')
  lines.push('说明：只报告，不阻断、不自动修改代码；PNG 是模板风格截图（无显式契约的旧设计为线框），过期时先说明再参考。')
  lines.push('')
  lines.push('--- JSON ---')
  return lines.join('\n')
}

function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`[check-fidelity] ${error instanceof Error ? error.message : String(error)}`)
    console.error(usage())
    process.exit(2)
  }
  if (options.help) {
    console.log(usage())
    return
  }

  const appDir = path.resolve(options.app)
  if (!fs.existsSync(appDir) || !fs.statSync(appDir).isDirectory()) {
    console.error(`[check-fidelity] 应用目录不存在或不是目录：${appDir}`)
    console.error(usage())
    process.exit(2)
  }

  let report
  try {
    report = runFidelityCheck({ appDir })
  } catch (error) {
    console.error(`[check-fidelity] 检查失败：${error instanceof Error ? error.message : String(error)}`)
    process.exit(2)
  }

  const json = JSON.stringify(report, null, 2)
  if (options.json) console.log(json)
  else {
    console.log(humanSummary(report, appDir))
    console.log(json)
  }

  if (options.strict && report.summary.status === 'fail') process.exit(1)
}

main()
