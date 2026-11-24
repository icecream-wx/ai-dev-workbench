/**
 * pages.json 页面契约的“软枚举”推荐值（P7-6c / D1）
 *
 * 与 `templates/agent/skills/adw-design-artifacts/references/pages.schema.json`
 * 里的 `x-adw-recommended` / `x-adw-allowed` 注解保持一致：
 *
 * - `rowActions/toolbarActions`：推荐动作码；中文标签等自定义值**保留原值**，只告警；
 * - `tree.actionStyle`：header / footer / none；
 * - `tree.selectionStyle`：platform / dot / background。
 *
 * 后端 artifacts 与 `scripts/validate.mjs` 对同一份 pages.json 给出同口径 warning，
 * 不阻断旧 design.json，也不修改文件。
 */

export const RECOMMENDED_ACTIONS = Object.freeze([
  'create',
  'edit',
  'delete',
  'detail',
  'batchDelete',
  'import',
  'export',
  'submit',
  'cancel',
  'enable',
  'disable',
  'approve',
  'reject',
  'print',
  'copy'
])

export const TREE_ACTION_STYLES = Object.freeze(['header', 'footer', 'none'])
export const TREE_SELECTION_STYLES = Object.freeze(['platform', 'dot', 'background'])

/** create/edit 的合法表单目标配方（B6：main-sub 是整页表单 + 子表） */
export const FORM_TARGET_RECIPES = Object.freeze(['dialog-form', 'page-form', 'main-sub', 'wizard'])
const FORM_TARGET_ACTIONS = Object.freeze(['create', 'edit'])

export interface ContractWarning {
  path: string
  message: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function actionsWarning(value: unknown, path: string): ContractWarning[] {
  if (!Array.isArray(value)) return []
  const warnings: ContractWarning[] = []
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string') continue
    const action = item.trim()
    if (!action || RECOMMENDED_ACTIONS.includes(action)) continue
    warnings.push({
      path: `${path}[${index}]`,
      message: `动作码「${action}」不在推荐列表（${RECOMMENDED_ACTIONS.join('/')}）；保留原值，如需更规范的契约请改用动作码`
    })
  }
  return warnings
}

function allowedWarning(value: unknown, path: string, allowed: readonly string[], label: string): ContractWarning[] {
  const current = text(value)
  if (!current || allowed.includes(current)) return []
  return [
    {
      path,
      message: `${label}「${current}」不是推荐值（${allowed.join('/')}）；保留原值，未知值不阻断`
    }
  ]
}

/** 只返回软枚举 warning；类型/必填等结构问题仍由 JSON Schema 校验负责 */
export function designContractWarnings(data: unknown): ContractWarning[] {
  const root = asRecord(data)
  if (!root) return []
  const warnings: ContractWarning[] = []
  const pageSets = Array.isArray(root.pageSets) ? root.pageSets : []
  for (const [setIndex, rawSet] of pageSets.entries()) {
    const pageSet = asRecord(rawSet)
    if (!pageSet) continue
    const rawPages = Array.isArray(pageSet.pages) ? pageSet.pages : []
    const entries = rawPages
      .map((rawPage, index) => ({ page: asRecord(rawPage), index }))
      .filter((entry): entry is { page: Record<string, unknown>; index: number } => Boolean(entry.page))
    const base = `pageSets[${setIndex}]`
    warnings.push(...pageSetActionTargetWarnings(entries.map(entry => entry.page), base))
    for (const entry of entries) {
      warnings.push(...pageContractWarnings(entry.page, `${base}.pages[${entry.index}]`))
    }
  }
  // 兼容内部调用：单页契约数组 `{ pages: [...] }`（如 pack 校验）
  // 只做页面级软枚举；actionTargets 的页面集语义只在真实 pages.json（pageSets）上校验。
  if (!pageSets.length) {
    const pages = Array.isArray(root.pages) ? root.pages : []
    for (const [index, rawPage] of pages.entries()) {
      const page = asRecord(rawPage)
      if (!page) continue
      warnings.push(...pageContractWarnings(page, `pages[${index}]`))
    }
  }
  return warnings
}

function actionCodes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => text(item)).filter(Boolean)
    : []
}

/** 页面集级：actionTargets 目标校验 + create/edit 缺表单目标提示（B6） */
function pageSetActionTargetWarnings(pages: Record<string, unknown>[], setBase: string): ContractWarning[] {
  const warnings: ContractWarning[] = []
  const byId = new Map<string, Record<string, unknown>>()
  for (const page of pages) {
    const id = text(page.id)
    if (id && !byId.has(id)) byId.set(id, page)
  }
  for (const [index, page] of pages.entries()) {
    const base = `${setBase}.pages[${index}]`
    const targets = asRecord(page.actionTargets)
    if (targets) {
      for (const [action, rawTarget] of Object.entries(targets)) {
        const targetId = text(rawTarget)
        if (!targetId) continue
        const target = byId.get(targetId)
        if (!target) {
          warnings.push({
            path: `${base}.actionTargets.${action}`,
            message: `动作「${action}」的目标页「${targetId}」不存在或不在同一页面集；交互预览会忽略该映射并回退启发式`
          })
          continue
        }
        const recipe = text(target.recipe)
        if (FORM_TARGET_ACTIONS.includes(action) && recipe && !FORM_TARGET_RECIPES.includes(recipe)) {
          warnings.push({
            path: `${base}.actionTargets.${action}`,
            message: `动作「${action}」的目标页「${targetId}」配方 ${recipe} 不是表单配方（${FORM_TARGET_RECIPES.join('/')}）；显式映射仍采用，请确认`
          })
        }
        if (action === 'detail' && recipe && !['detail'].includes(recipe)) {
          warnings.push({
            path: `${base}.actionTargets.detail`,
            message: `详情目标页「${targetId}」配方 ${recipe} 不是 detail；显式映射仍采用，请确认`
          })
        }
      }
    }

    const declared = new Set([...actionCodes(page.rowActions), ...actionCodes(page.toolbarActions)])
    const entityId = text(page.entity)
    const selfIsForm =
      FORM_TARGET_RECIPES.includes(text(page.recipe)) || (!text(page.recipe) && text(page.type) === 'form')
    const missing = selfIsForm
      ? []
      : FORM_TARGET_ACTIONS.filter(action => {
          if (!declared.has(action)) return false
          if (targets && text(targets[action])) return false
          const hasFormPage =
            Boolean(entityId) &&
            pages.some(candidate => {
              if (candidate === page) return false
              if (!text(candidate.id) || text(candidate.entity) !== entityId) return false
              const candidateRecipe = text(candidate.recipe)
              // 旧设计可能没有 recipe，只有 type:"form"；同样视为表单页（避免误报）
              return (
                FORM_TARGET_RECIPES.includes(candidateRecipe) ||
                (!candidateRecipe && text(candidate.type) === 'form')
              )
            })
          return !hasFormPage
        })
    if (missing.length) {
      warnings.push({
        path: base,
        message: `页面声明了动作「${missing.join('/')}」，但既没有 actionTargets 映射，也没有同实体（${
          entityId || '未绑定实体'
        }）表单页；交互预览会打开临时表单，建议补表单页或 actionTargets`
      })
    }
  }
  return warnings
}

function pageContractWarnings(page: Record<string, unknown>, base: string): ContractWarning[] {
  const warnings: ContractWarning[] = []
  warnings.push(...actionsWarning(page.rowActions, `${base}.rowActions`))
  warnings.push(...actionsWarning(page.toolbarActions, `${base}.toolbarActions`))
  const tree = asRecord(page.tree)
  if (!tree) return warnings
  warnings.push(...allowedWarning(tree.actionStyle, `${base}.tree.actionStyle`, TREE_ACTION_STYLES, '树操作形态'))
  warnings.push(
    ...allowedWarning(tree.selectionStyle, `${base}.tree.selectionStyle`, TREE_SELECTION_STYLES, '树选中标记')
  )
  return warnings
}
