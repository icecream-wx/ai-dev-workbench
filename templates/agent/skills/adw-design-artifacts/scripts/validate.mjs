#!/usr/bin/env node
/**
 * design.json 自查脚本（只做快速反馈；最终校验以后端 /api/apps/:id/artifacts 为准）。
 *
 * 用法：node scripts/validate.mjs [design.json ...]
 * 无参数时校验当前目录及 docs/design/* 下的 design.json。
 *
 * 校验规则来源：../references/design.schema.json（与后端共用同一份 schema）。
 * 输出：JSON {ok, files, errors:[{file, path, message, expected}], warnings:[...]}
 *
 * 设计系统/页面契约（P7）新增字段在 schema 里标记了 x-adw-warning：
 * 这些字段的类型/枚举问题只进入 warnings，不影响 ok 与退出码；旧字段仍按 errors 处理。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.resolve(here, '..', 'references', 'design.schema.json')

function typeOf(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

function matchesType(value, expected) {
  const actual = typeOf(value)
  if (expected === 'number') return actual === 'number' || actual === 'integer'
  if (expected === 'integer') return actual === 'integer'
  return actual === expected
}

function pushIssue(sink, currentPath, message, expected) {
  sink.push({
    path: currentPath || '$',
    message,
    ...(expected === undefined ? {} : { expected })
  })
}

/**
 * 支持 type/required/properties/items/enum/additionalProperties 的极简校验。
 * soft=true 时（schema 标记 x-adw-warning 的子树）问题写入 warnings，不阻断。
 */
function validate(schema, value, currentPath, errors, warnings, soft = false) {
  if (!schema || typeof schema !== 'object') return
  const isSoft = soft || schema['x-adw-warning'] === true
  const sink = isSoft ? warnings : errors
  if (schema.type && !matchesType(value, schema.type)) {
    pushIssue(sink, currentPath, `类型应为 ${schema.type}`, schema.type)
    return
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    pushIssue(sink, currentPath, `取值应为 ${schema.enum.join(' | ')}`, schema.enum)
    return
  }
  // P7-6c：推荐动作码 / 树形态：只告警，保留原值，不阻断旧 design.json
  if (Array.isArray(schema['x-adw-recommended']) && Array.isArray(value)) {
    const recommended = schema['x-adw-recommended'].map(String)
    for (const [index, item] of value.entries()) {
      if (typeof item !== 'string') continue
      const action = item.trim()
      if (!action || recommended.includes(action)) continue
      pushIssue(
        warnings,
        `${currentPath}[${index}]`,
        `动作码「${action}」不在推荐列表（${recommended.join('/')}）；保留原值`,
        recommended
      )
    }
  }
  if (Array.isArray(schema['x-adw-allowed']) && typeof value === 'string' && value.trim()) {
    const allowedList = schema['x-adw-allowed'].map(String)
    const current = value.trim()
    if (!allowedList.includes(current)) {
      pushIssue(warnings, currentPath, `取值「${current}」不是推荐值（${allowedList.join('/')}）；保留原值`, allowedList)
    }
  }
  if (schema.type === 'object' || (value && typeof value === 'object' && !Array.isArray(value))) {
    for (const key of schema.required ?? []) {
      if (!value || value[key] === undefined) {
        pushIssue(sink, `${currentPath}.${key}`, '缺少必填字段', key)
      }
    }
    const properties = schema.properties ?? {}
    for (const [key, child] of Object.entries(properties)) {
      if (!value || value[key] === undefined) continue
      validate(child, value[key], currentPath ? `${currentPath}.${key}` : key, errors, warnings, isSoft)
    }
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object' && value && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        if (Object.prototype.hasOwnProperty.call(properties, key)) continue
        validate(schema.additionalProperties, value[key], currentPath ? `${currentPath}.${key}` : key, errors, warnings, isSoft)
      }
    }
  }
  if (schema.type === 'array' && Array.isArray(value)) {
    const itemSchema = schema.items
    for (const [index, item] of value.entries()) {
      validate(itemSchema, item, `${currentPath}[${index}]`, errors, warnings, isSoft)
    }
  }
}

function collectTargets(args) {
  if (args.length) return args.map(item => path.resolve(item))
  const found = []
  const walk = directory => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name === 'design.json') found.push(full)
    }
  }
  if (fs.existsSync('docs/design')) {
    walk(path.resolve('docs/design'))
  } else {
    walk(process.cwd())
  }
  return found
}

const errors = []
const warnings = []
let schema = null
try {
  schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
} catch (error) {
  errors.push({ file: schemaPath, path: '$', message: `无法读取 schema：${error.message}`, expected: 'schema' })
}

const files = collectTargets(process.argv.slice(2))
if (schema && !files.length) {
  errors.push({ file: '(none)', path: '$', message: '没有找到 design.json', expected: 'design.json' })
}
for (const file of files) {
  let data = null
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    errors.push({ file, path: '$', message: `JSON 解析失败：${error.message}`, expected: 'valid json' })
    continue
  }
  const fileErrors = []
  const fileWarnings = []
  validate(schema, data, '', fileErrors, fileWarnings)
  for (const item of fileErrors) errors.push({ file, ...item })
  for (const item of fileWarnings) warnings.push({ file, ...item, severity: 'warning' })
}

const result = { ok: errors.length === 0, files: files.length, errors, warnings }
console.log(JSON.stringify(result, null, 2))
process.exit(result.ok ? 0 : 1)
