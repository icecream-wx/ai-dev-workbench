/**
 * 开发视图：模块选择与设计参考（P7-5b 纯函数）
 *
 * - 模块来自 artifacts（需求模块 + 设计模块）；设计模块带 ui-check 状态；
 * - 单模块自动选中；保存的选择优先；
 * - 设计参考摘要只读（应用类型/风格/页面数/蓝图根）。
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
    return '未生成：在开发视图选中模块并发送首条开发消息后自动生成；实现前先填。'
  }
  if (status === 'skeleton') {
    return '已生成未填：先填「实现前」对照表再写代码；未填不阻断。'
  }
  return ''
}

/**
 * @param {{ modules?: Array<{key?: string,title?: string,order?: number,file?: string}>, designs?: Array<{module?: string,title?: string,uiCheck?: {status?: string}}> }} artifacts
 */
export function buildModuleOptions(artifacts) {
  const designs = new Map()
  for (const design of Array.isArray(artifacts?.designs) ? artifacts.designs : []) {
    const key = String(design?.module ?? '').trim()
    if (!key) continue
    designs.set(key, design)
  }
  const seen = new Set()
  const options = []
  for (const module of Array.isArray(artifacts?.modules) ? artifacts.modules : []) {
    const key = String(module?.key ?? '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    const design = designs.get(key)
    options.push({
      key,
      title: String(module?.title ?? design?.title ?? key),
      order: Number(module?.order) || 0,
      hasDesign: Boolean(design),
      file: String(module?.file ?? ''),
      uiCheckStatus: design?.uiCheck?.status ?? 'missing',
      uiCheckFile: design?.uiCheck?.file ?? ''
    })
  }
  for (const [key, design] of designs) {
    if (seen.has(key)) continue
    seen.add(key)
    options.push({
      key,
      title: String(design?.title ?? key),
      order: 0,
      hasDesign: true,
      file: '',
      uiCheckStatus: design?.uiCheck?.status ?? 'missing',
      uiCheckFile: design?.uiCheck?.file ?? ''
    })
  }
  return options
}

/**
 * 选择模块：已保存 → 上次选择 → 唯一有设计模块 → 唯一模块 → 空
 * @param {ReturnType<typeof buildModuleOptions>} options
 */
export function pickModuleKey(options, savedKey, previousKey) {
  const keys = new Set(options.map(option => option.key))
  const saved = String(savedKey ?? '').trim()
  if (saved && keys.has(saved)) return saved
  const previous = String(previousKey ?? '').trim()
  if (previous && keys.has(previous)) return previous
  const designed = options.filter(option => option.hasDesign)
  if (designed.length === 1) return designed[0].key
  if (options.length === 1) return options[0].key
  return ''
}

export function moduleOptionOf(options, key) {
  return options.find(option => option.key === key) ?? null
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

/** 开发视图模块/设计状态提示 */
export function designRefHint(options) {
  if (!options.length) return '暂无模块：请先在设计视图生成 design.json 页面设计。'
  if (!options.some(option => option.hasDesign)) return '有需求模块但还没有设计：请先在设计视图生成 design.json。'
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

/** 空报告说明（无设计/指定模块无设计） */
export function fidelityEmptyText(report) {
  if (!report?.empty) return ''
  if (report.reason === 'design-missing') {
    return `未找到 ${report.module || '指定模块'} 的设计（design.json）`
  }
  return '暂无设计：先在设计视图生成 design.json 页面设计。'
}

/** 报告摘要：空报告给原因，否则通过/警告/失败计数 */
export function fidelitySummaryText(report) {
  if (!report) return ''
  if (report.empty) return fidelityEmptyText(report)
  const summary = report.summary
  if (!summary) return ''
  return `通过 ${summary.pass || 0} · 警告 ${summary.warn || 0} · 失败 ${summary.fail || 0}`
}
