#!/usr/bin/env node
/**
 * 设计产物自查脚本（只做快速反馈；最终校验以后端 /api/apps/:id/artifacts 为准）。
 *
 * 用法：node scripts/validate.mjs [entities.json pages.json ...]
 * 无参数时校验当前工作区 `docs/design/entities.json` 与 `docs/design/pages.json`。
 *
 * 校验规则来源（与后端共用同一份 schema）：
 * - `../references/entities.schema.json` → 实体/关系；
 * - `../references/pages.schema.json` → 页面集/页面契约。
 *
 * 输出：JSON {ok, files, errors:[{file, path, message, expected}], warnings:[...]}
 *
 * 页面契约（P7）新增字段在 schema 里标记了 x-adw-warning：类型/枚举问题只进入 warnings，
 * 不影响 ok 与退出码；结构/必填问题仍按 errors 处理。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SCHEMAS = {
  entities: path.resolve(here, '..', 'references', 'entities.schema.json'),
  pages: path.resolve(here, '..', 'references', 'pages.schema.json')
}

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

/** B6 页面集语义：actionTargets 目标 + create/edit 缺表单目标（只 warning，不阻断） */
const FORM_TARGET_RECIPES = ['dialog-form', 'page-form', 'main-sub', 'wizard']
const FORM_TARGET_ACTIONS = ['create', 'edit']

function textOf(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function actionCodes(value) {
  return Array.isArray(value) ? value.map(item => textOf(item)).filter(Boolean) : []
}

function pageSetSemanticWarnings(data) {
  const warnings = []
  if (!data || typeof data !== 'object' || !Array.isArray(data.pageSets)) return warnings
  for (const [setIndex, rawSet] of data.pageSets.entries()) {
    const pageSet = asRecord(rawSet)
    if (!pageSet) continue
    const entries = (Array.isArray(pageSet.pages) ? pageSet.pages : [])
      .map((rawPage, index) => ({ page: asRecord(rawPage), index }))
      .filter(entry => entry.page)
    const pages = entries.map(entry => entry.page)
    const byId = new Map()
    for (const page of pages) {
      const id = textOf(page.id)
      if (id && !byId.has(id)) byId.set(id, page)
    }
    for (const entry of entries) {
      const page = entry.page
      const base = `pageSets[${setIndex}].pages[${entry.index}]`
      const targets = asRecord(page.actionTargets)
      if (targets) {
        for (const [action, rawTarget] of Object.entries(targets)) {
          const targetId = textOf(rawTarget)
          if (!targetId) continue
          const target = byId.get(targetId)
          if (!target) {
            pushIssue(
              warnings,
              `${base}.actionTargets.${action}`,
              `动作「${action}」的目标页「${targetId}」不存在或不在同一页面集；交互预览会忽略该映射并回退启发式`
            )
            continue
          }
          const recipe = textOf(target.recipe)
          if (FORM_TARGET_ACTIONS.includes(action) && recipe && !FORM_TARGET_RECIPES.includes(recipe)) {
            pushIssue(
              warnings,
              `${base}.actionTargets.${action}`,
              `动作「${action}」的目标页「${targetId}」配方 ${recipe} 不是表单配方（${FORM_TARGET_RECIPES.join('/')}）；显式映射仍采用，请确认`
            )
          }
          if (action === 'detail' && recipe && recipe !== 'detail') {
            pushIssue(
              warnings,
              `${base}.actionTargets.detail`,
              `详情目标页「${targetId}」配方 ${recipe} 不是 detail；显式映射仍采用，请确认`
            )
          }
        }
      }
      const declared = new Set([...actionCodes(page.rowActions), ...actionCodes(page.toolbarActions)])
      const entityId = textOf(page.entity)
      const selfIsForm =
        FORM_TARGET_RECIPES.includes(textOf(page.recipe)) ||
        (!textOf(page.recipe) && textOf(page.type) === 'form')
      const missing = selfIsForm
        ? []
        : FORM_TARGET_ACTIONS.filter(action => {
            if (!declared.has(action)) return false
            if (targets && textOf(targets[action])) return false
            return !pages.some(candidate => {
              if (candidate === page) return false
              if (!textOf(candidate.id) || textOf(candidate.entity) !== entityId) return false
              const candidateRecipe = textOf(candidate.recipe)
              // 旧设计可能没有 recipe，只有 type:"form"；同样视为表单页（避免误报）
              return (
                FORM_TARGET_RECIPES.includes(candidateRecipe) ||
                (!candidateRecipe && textOf(candidate.type) === 'form')
              )
            })
          })
      if (missing.length) {
        pushIssue(
          warnings,
          base,
          `页面声明了动作「${missing.join('/')}」，但既没有 actionTargets 映射，也没有同实体（${
            entityId || '未绑定实体'
          }）表单页；交互预览会打开临时表单，建议补表单页或 actionTargets`
        )
      }
    }
  }
  return warnings
}

function kindOf(file) {
  const base = path.basename(file).toLowerCase()
  if (base === 'entities.json' || base === 'entities-example.json') return 'entities'
  if (base === 'pages.json' || base === 'pages-example.json') return 'pages'
  return ''
}

function collectTargets(args) {
  if (args.length) return args.map(item => path.resolve(item))
  const defaults = ['docs/design/entities.json', 'docs/design/pages.json'].map(item => path.resolve(item))
  return defaults.filter(file => fs.existsSync(file))
}

const schemas = {}
for (const [kind, file] of Object.entries(SCHEMAS)) {
  try {
    schemas[kind] = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    schemas[kind] = null
    void error
  }
}

const errors = []
const warnings = []
const files = collectTargets(process.argv.slice(2))
if (!files.length) {
  errors.push({ file: '(none)', path: '$', message: '没有找到 entities.json / pages.json', expected: 'entities.json + pages.json' })
}
for (const file of files) {
  const kind = kindOf(file)
  const schema = kind ? schemas[kind] : null
  if (!schema) {
    errors.push({ file, path: '$', message: `无法识别或读取 schema：${path.basename(file)}`, expected: 'entities.json / pages.json' })
    continue
  }
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
  if (kind === 'pages') {
    for (const item of pageSetSemanticWarnings(data)) fileWarnings.push(item)
  }
  for (const item of fileErrors) errors.push({ file, ...item })
  for (const item of fileWarnings) warnings.push({ file, ...item, severity: 'warning' })
}

const result = { ok: errors.length === 0, files: files.length, errors, warnings }
console.log(JSON.stringify(result, null, 2))
process.exit(result.ok ? 0 : 1)
