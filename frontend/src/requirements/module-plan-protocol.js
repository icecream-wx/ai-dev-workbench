/**
 * 首次模块规划协议（RMP-1，纯 JS 便于 Node 单测）
 *
 * 与 DOC_JSON / DESIGN_JSON 并列：`<<<MODULE_PLAN_JSON>>>`。
 * 只解析/归一化/校验模块拆分建议；不写文档、不建模块。
 */
import { extractJsonCandidates, repairJson, stripCodeFence } from '../shared/protocol-output.js'

export const MODULE_PLAN_DELIMITER = '<<<MODULE_PLAN_JSON>>>'
/** 后端技术保护（超过 400） */
export const MAX_PLAN_MODULES = 50

const CRUD_TITLE = /^(列表|新增|修改|删除|查询|详情|导入|导出|查看)/

function asString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringList(value, limit = 40) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => asString(item))
    .filter(Boolean)
    .slice(0, limit)
}

function normalizeEpics(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map(item => ({ title: asString(item.title), stories: asStringList(item.stories, 30) }))
    .filter(item => item.title)
    .slice(0, 20)
}

function normalizeModuleItem(value, index) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    key: asString(raw.key) || `m${index + 1}`,
    title: asString(raw.title),
    description: asString(raw.description),
    scope: asStringList(raw.scope, 40),
    suggestedEpics: normalizeEpics(raw.suggestedEpics),
    existingModuleId: asString(raw.existingModuleId) || null,
    action: asString(raw.action) || 'create'
  }
}

/** 容错归一化（字段缺失降级；校验走 validateModulePlan） */
export function normalizeModulePlan(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const modules = Array.isArray(source.modules) ? source.modules.map((item, index) => normalizeModuleItem(item, index)) : []
  const used = new Set()
  modules.forEach((item, index) => {
    let key = item.key
    if (!key || used.has(key)) key = `${item.key || 'm'}${index + 1}`
    while (used.has(key)) key = `${key}_`
    item.key = key
    used.add(key)
  })
  const keys = new Set(modules.map(item => item.key))
  const dependencies = Array.isArray(source.dependencies)
    ? source.dependencies
        .filter(item => item && typeof item === 'object')
        .map(item => ({ from: asString(item.from), to: asString(item.to), description: asString(item.description) }))
        .filter(item => item.from && item.to && keys.has(item.from) && keys.has(item.to))
        .slice(0, 60)
    : []
  const coverage = Array.isArray(source.coverage)
    ? source.coverage
        .filter(item => item && typeof item === 'object')
        .map(item => ({ requirement: asString(item.requirement), moduleKey: asString(item.moduleKey) }))
        .filter(item => item.requirement)
        .slice(0, 80)
    : []
  const unassigned = Array.isArray(source.unassigned)
    ? source.unassigned
        .filter(item => item && typeof item === 'object')
        .map(item => ({ requirement: asString(item.requirement), reason: asString(item.reason) }))
        .filter(item => item.requirement)
        .slice(0, 40)
    : []
  return {
    kind: 'initial',
    modules,
    dependencies,
    coverage,
    unassigned,
    openIssues: asStringList(source.openIssues, 40),
    warnings: asStringList(source.warnings, 40)
  }
}

/** 校验（与后端同口径）：错误阻塞应用，warning 只提示 */
export function validateModulePlan(plan) {
  const errors = []
  const warnings = []
  const modules = Array.isArray(plan?.modules) ? plan.modules : []
  if (!modules.length) errors.push('至少需要 1 个模块')
  if (modules.length > MAX_PLAN_MODULES) errors.push(`模块数量不能超过 ${MAX_PLAN_MODULES} 个`)
  const seen = new Set()
  modules.forEach((item, index) => {
    const label = `第 ${index + 1} 个模块`
    const title = asString(item?.title)
    if (!title) {
      errors.push(`${label}标题为空`)
      return
    }
    if (title.length > 120) errors.push(`${label}标题超过 120 字`)
    const normalized = title.toLowerCase()
    if (seen.has(normalized)) errors.push(`模块标题重复：${title}`)
    seen.add(normalized)
    if (item.existingModuleId) errors.push(`模块「${title}」不能匹配已有模块（当前版本只支持首次拆分）`)
    if ((item.action || 'create') !== 'create') errors.push(`模块「${title}」只能新建（当前版本只支持首次拆分）`)
    if (CRUD_TITLE.test(title) || /(列表|新增|修改|删除|查询)模块$/.test(title)) {
      warnings.push(`「${title}」看起来像 CRUD 功能而不是业务域，建议并入所属业务域模块`)
    }
  })
  if (modules.length > 8) warnings.push(`共 ${modules.length} 个模块，逐模块生成耗时较长；建议合并同业务域的模块`)
  if (!Array.isArray(plan?.coverage) || !plan.coverage.length) warnings.push('未提供需求覆盖说明，请确认没有遗漏')
  if (Array.isArray(plan?.unassigned) && plan.unassigned.length) {
    warnings.push(`${plan.unassigned.length} 条需求未分配，请确认是否需要补充模块`)
  }
  return { errors, warnings }
}

function looksLikePlan(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.modules))
}

function parsePlanJson(text) {
  const trimmed = stripCodeFence(text)
  if (!trimmed) return null
  for (const candidate of [trimmed, repairJson(trimmed)]) {
    try {
      const parsed = JSON.parse(candidate)
      if (looksLikePlan(parsed)) return parsed
    } catch {
      // 继续提取
    }
  }
  for (const candidate of extractJsonCandidates(trimmed)) {
    for (const fixed of [candidate, repairJson(candidate)]) {
      try {
        const parsed = JSON.parse(fixed)
        if (looksLikePlan(parsed)) return parsed
      } catch {
        // 下一个候选
      }
    }
  }
  return null
}

/**
 * 拆分模型输出：分隔符前为回复，后为 MODULE_PLAN_JSON。
 * 无法解析 → plan=null + 可读错误（前端展示重试，不写库）。
 * 计划结构存在但校验失败 → plan 返回（供展示）+ error。
 * @param {string} raw
 * @returns {{ reply: string, plan: ReturnType<typeof normalizeModulePlan> | null, error: string }}
 */
export function splitModulePlanOutput(raw) {
  const text = String(raw ?? '').trim()
  const index = text.indexOf(MODULE_PLAN_DELIMITER)
  const reply = index >= 0 ? text.slice(0, index).trim() : ''
  const tail = index >= 0 ? text.slice(index + MODULE_PLAN_DELIMITER.length) : text
  const parsed = parsePlanJson(tail)
  if (!parsed) {
    return {
      reply: index >= 0 ? reply : text,
      plan: null,
      error: '模型输出里没有可解析的模块拆分建议（MODULE_PLAN_JSON），请重试或补充需求'
    }
  }
  const plan = normalizeModulePlan(parsed)
  if (!plan.modules.length) {
    return { reply, plan: null, error: '模块拆分建议为空（modules 缺失），请重试' }
  }
  const validation = validateModulePlan(plan)
  return {
    reply,
    plan,
    error: validation.errors.length ? validation.errors.join('；') : ''
  }
}
