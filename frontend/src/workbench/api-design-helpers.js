/**
 * 接口设计面板纯逻辑（D2）：摘要、覆盖、校验文案与「让 AI 修」文本。
 * 不依赖 Vue/DOM，便于 node --test。
 */

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** 接口/Epic/覆盖/校验摘要；无文档时 exists:false 且计数为 0 */
export function apiDesignSummary(apiDesign) {
  const exists = Boolean(apiDesign?.exists)
  const interfaces = asArray(apiDesign?.interfaces)
  const byEpic = asArray(apiDesign?.byEpic)
  const pageActions = asArray(apiDesign?.coverage?.pageActions)
  const covered = pageActions.filter(item => item?.covered)
  const entities = asArray(apiDesign?.coverage?.entities)
  const entitiesCovered = entities.filter(item => asArray(item?.missing).length === 0)
  return {
    exists,
    interfaceCount: interfaces.length,
    epicCount: byEpic.length,
    errorCount: asArray(apiDesign?.errors).length,
    warningCount: asArray(apiDesign?.warnings).length,
    pageActionTotal: pageActions.length,
    pageActionCovered: covered.length,
    entityTotal: entities.length,
    entityCovered: entitiesCovered.length
  }
}

/** 顶部一行摘要（人话） */
export function apiDesignSummaryText(apiDesign) {
  const summary = apiDesignSummary(apiDesign)
  if (!summary.exists) return '接口设计未生成'
  const coverage =
    summary.pageActionTotal > 0
      ? `页面动作覆盖 ${summary.pageActionCovered}/${summary.pageActionTotal}`
      : '页面动作覆盖 0/0'
  const issues = summary.errorCount || summary.warningCount ? ` · 校验 ${summary.errorCount} 错 / ${summary.warningCount} 警` : ' · 校验通过'
  return `接口 ${summary.interfaceCount} · Epic ${summary.epicCount} · ${coverage}${issues}`
}

/** 未覆盖页面动作（最多 limit 条） */
export function apiDesignUncoveredActions(apiDesign, limit = 8) {
  return asArray(apiDesign?.coverage?.pageActions)
    .filter(item => item && item.covered === false)
    .slice(0, limit)
    .map(item => ({ page: text(item.page), action: text(item.action), pageSet: text(item.pageSet) }))
}

/** 实体 CRUD 缺口（最多 limit 条） */
export function apiDesignEntityGaps(apiDesign, limit = 8) {
  return asArray(apiDesign?.coverage?.entities)
    .filter(item => item && asArray(item.missing).length)
    .slice(0, limit)
    .map(item => ({ entity: text(item.entity), missing: asArray(item.missing).map(String) }))
}

/** 错误/警告 → 展示行（去重） */
export function apiDesignIssueLines(apiDesign) {
  const lines = []
  const seen = new Set()
  const push = line => {
    const value = text(line)
    if (!value || seen.has(value)) return
    seen.add(value)
    lines.push(value)
  }
  for (const error of asArray(apiDesign?.errors)) {
    push(`${text(error?.file) || 'api-design.md'} · ${text(error?.path) || '$'} · ${text(error?.message)}${
      text(error?.expected) ? `（期望：${text(error.expected)}）` : ''
    }`)
  }
  for (const warning of asArray(apiDesign?.warnings)) push(`api-design.md · 警告 · ${text(warning)}`)
  return lines
}

/** 「让 AI 修」填入 Composer 的文本（自动发送）；过长截断 */
export function apiDesignFixText(apiDesign, maxChars = 800) {
  const issues = apiDesignIssueLines(apiDesign)
  if (!issues.length) return ''
  const textValue = `修复接口设计 docs/design/api-design.md 的以下问题：${issues.join('；')}`
  return textValue.length <= maxChars ? textValue : `${textValue.slice(0, maxChars)}…`
}

function fixCounts(value) {
  if (!value) return { errorCount: 0, warningCount: 0 }
  if (typeof value.errorCount === 'number' || typeof value.warningCount === 'number') {
    return {
      errorCount: Number(value.errorCount) || 0,
      warningCount: Number(value.warningCount) || 0
    }
  }
  return { errorCount: asArray(value.errors).length, warningCount: asArray(value.warnings).length }
}

/**
 * B7 接口设计修复状态摘要（before/after 可为 artifact 或 { errorCount, warningCount }）。
 *
 * - 仍有错误：`修复结束，仍有 N 个错误`；
 * - 问题清零：`修复完成：问题已清零（原 N 个）` / `修复完成：校验通过`；
 * - 警告减少且无错误：`修复完成：警告 6 → 2`；
 * - 其余：`修复结束，仍有 N 个警告`。
 */
export function apiDesignFixSummary(before, after) {
  const previous = fixCounts(before)
  const next = fixCounts(after)
  const previousTotal = previous.errorCount + previous.warningCount
  const nextTotal = next.errorCount + next.warningCount
  if (next.errorCount > 0) {
    const tail = next.warningCount ? `、${next.warningCount} 个警告` : ''
    return `修复结束，仍有 ${next.errorCount} 个错误${tail}`
  }
  if (nextTotal === 0) {
    return previousTotal > 0 ? `修复完成：问题已清零（原 ${previousTotal} 个）` : '修复完成：校验通过'
  }
  if (nextTotal < previousTotal) {
    if (previous.errorCount === next.errorCount) return `修复完成：警告 ${previous.warningCount} → ${next.warningCount}`
    return `修复完成：问题 ${previousTotal} → ${nextTotal}`
  }
  return `修复结束，仍有 ${next.warningCount} 个警告`
}
