/**
 * design.json 页面契约的“软枚举”推荐值（P7-6c）
 *
 * 与 `templates/agent/skills/adw-design-artifacts/references/design.schema.json`
 * 里的 `x-adw-recommended` / `x-adw-allowed` 注解保持一致：
 *
 * - `rowActions/toolbarActions`：推荐动作码；中文标签等自定义值**保留原值**，只告警；
 * - `tree.actionStyle`：header / footer / none；
 * - `tree.selectionStyle`：platform / dot / background。
 *
 * 后端 artifacts 与 `scripts/validate.mjs` 对同一份 design.json 给出同口径 warning，
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
  const pages = Array.isArray(root.pages) ? root.pages : []
  for (const [index, rawPage] of pages.entries()) {
    const page = asRecord(rawPage)
    if (!page) continue
    const base = `pages[${index}]`
    warnings.push(...actionsWarning(page.rowActions, `${base}.rowActions`))
    warnings.push(...actionsWarning(page.toolbarActions, `${base}.toolbarActions`))
    const tree = asRecord(page.tree)
    if (!tree) continue
    warnings.push(...allowedWarning(tree.actionStyle, `${base}.tree.actionStyle`, TREE_ACTION_STYLES, '树操作形态'))
    warnings.push(
      ...allowedWarning(tree.selectionStyle, `${base}.tree.selectionStyle`, TREE_SELECTION_STYLES, '树选中标记')
    )
  }
  return warnings
}
