/**
 * 开发视图：设计参考摘要（应用级，D1 去模块纯函数）
 *
 * - 设计参考计数来自 artifacts（requirement/entities/pages/uiCheck）；
 * - ui-check 状态应用级；fidelity 报告应用级。
 */

/** 'missing' | 'skeleton' | 'filled' */
export function uiCheckLabel(status) {
  if (status === 'skeleton') return '已生成未填'
  if (status === 'filled') return '已填'
  return '未生成'
}

export function uiCheckTone(status) {
  if (status === 'filled') return 'ok'
  if (status === 'skeleton') return 'warn'
  return 'muted'
}

/** ui-check 流程未完成的下一步提示（可操作；已填为空串） */
export function uiCheckHint(status) {
  if (status === 'missing') {
    return '未生成：发送首条开发消息后自动生成；实现前先填。'
  }
  if (status === 'skeleton') {
    return '已生成未填：先填「实现前」对照表再写代码；未填不阻断。'
  }
  return ''
}

/** 设计参考计数（应用级）：Epic / 页面集 / 页面 / 实体 / 接口（接口 D2 再加） */
export function designRefCounts(artifacts) {
  const requirement = artifacts?.requirement ?? null
  const pageSets = Array.isArray(artifacts?.pages?.pageSets) ? artifacts.pages.pageSets : []
  const pages = Array.isArray(artifacts?.pages?.pages) ? artifacts.pages.pages : []
  const entities = Array.isArray(artifacts?.entities?.entities) ? artifacts.entities.entities : []
  return {
    epicCount: Array.isArray(requirement?.epics) ? requirement.epics.length : 0,
    pageSetCount: pageSets.length,
    pageCount: pages.length,
    entityCount: entities.length,
    apiInterfaceCount: Array.isArray(artifacts?.apiDesign?.interfaces) ? artifacts.apiDesign.interfaces.length : 0,
    apiExists: Boolean(artifacts?.apiDesign?.exists),
    uiCheckStatus: artifacts?.uiCheck?.status ?? 'missing',
    uiCheckFile: artifacts?.uiCheck?.file ?? 'docs/design/ui-check.md'
  }
}

/** 设计参考摘要（后端 AppDesignSystem；未解析时给出回退） */
export function designRefSummary(designSystem) {
  return {
    hasDesignSystem: Boolean(designSystem?.applicationType && designSystem?.style),
    applicationTypeName: String(designSystem?.applicationType?.name ?? designSystem?.applicationType?.id ?? ''),
    styleName: String(designSystem?.style?.name ?? designSystem?.style?.id ?? ''),
    pageCount: Array.isArray(designSystem?.pages) ? designSystem.pages.length : 0,
    blueprintRoot: 'docs/design/template'
  }
}

/** 开发视图设计产物提示 */
export function designRefHint(artifacts) {
  const counts = designRefCounts(artifacts)
  if (!counts.pageSetCount && !counts.entityCount) {
    return '暂无设计产物：请先在设计视图生成 entities.json 与 pages.json（页面集 = Epic）。'
  }
  if (!counts.pageCount) return '有页面集但还没有页面：请先在设计视图补页面契约。'
  return ''
}

/** 一致性报告总体状态（pass/warn/fail；未检查为空） */
export function fidelityStatusLabel(status) {
  if (status === 'pass') return '通过'
  if (status === 'warn') return '有警告'
  if (status === 'fail') return '有失败'
  return '未检查'
}

export function fidelityStatusTone(status) {
  if (status === 'pass') return 'ok'
  if (status === 'warn') return 'warn'
  if (status === 'fail') return 'fail'
  return 'muted'
}

/** 单项检查状态文案（pass/warn/fail） */
export function fidelityCheckLabel(status) {
  if (status === 'pass') return '通过'
  if (status === 'warn') return '警告'
  if (status === 'fail') return '失败'
  return '未知'
}

/** 空报告说明（无设计） */
export function fidelityEmptyText(report) {
  if (!report?.empty) return ''
  return '暂无设计：先在设计视图生成 entities.json / pages.json。'
}

/** 报告摘要：空报告给原因，否则通过/警告/失败计数 */
export function fidelitySummaryText(report) {
  if (!report) return ''
  if (report.empty) return fidelityEmptyText(report)
  const summary = report.summary
  if (!summary) return ''
  return `通过 ${summary.pass || 0} · 警告 ${summary.warn || 0} · 失败 ${summary.fail || 0}`
}
