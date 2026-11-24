/**
 * B5/B6 设计预览「交互预览层」动作 → 目标页解析（纯函数，便于 node --test）
 *
 * 规则（与页面契约/D2 解耦，只用 `pages.json` 适配后的页面/实体 id）：
 * - 显式优先：`page.actionTargets[action]` 指向**同一页面集**的页面时直接采用（B6）；
 *   目标不存在/跨页面集 → 忽略并回退启发式（返回 `invalidTarget` 供 UI 提示）；
 * - 启发式只在**同一页面集（pageSetId）且同一实体（entityId）**内找目标页；
 *   源页面未绑定实体时不跨页；
 * - `create` / `edit`：配方优先级 dialog-form > page-form > main-sub > wizard；
 *   `main-sub`（整页表单 + 子表）是合法表单目标；
 * - `detail`：只找 detail；detail 不做启发式新增/编辑目标（不把详情页当表单）；
 * - 同配方多页：优先 id/name 含关键词（create：新增/create/new/add；edit：编辑/edit/update/modify；
 *   detail：详情/detail/view），否则按数组顺序取第一个；
 * - 放宽兜底（仅源页面有实体、且无同实体候选时）：同页面集内唯一表单页 → 采用并标 `inferred`；
 *   多个 → 关键词优先，否则数组第一个；
 * - `delete` / `batchDelete` → confirm；`export` / `import` 等其它 → notify；
 * - 无目标 → none（调用方提示原因/候选，并打开临时表单；不伪造数据）。
 *
 * 返回 `{ kind: 'dialog'|'navigate'|'confirm'|'notify'|'none', page?, action, explicit?,
 *   inferred?, reason?, invalidTarget?, candidates? }`。
 */

const ACTION_KEYWORDS = {
  create: ['新增', 'create', 'new', 'add'],
  edit: ['编辑', 'edit', 'update', 'modify'],
  detail: ['详情', 'detail', 'view']
}

/** create/edit 可用的表单目标配方（B6：main-sub 也是合法表单目标） */
const FORM_RECIPES = ['dialog-form', 'page-form', 'main-sub', 'wizard']
const DETAIL_RECIPES = ['detail']
const CONFIRM_ACTIONS = ['delete', 'batchDelete']
const TARGET_LABELS = { create: '新增', edit: '编辑', detail: '详情' }

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

/** 页面 id/name 是否命中关键词（大小写不敏感） */
function matchesKeyword(page, keywords) {
  const haystack = `${text(page?.id)} ${text(page?.name) || text(page?.title)}`.toLowerCase()
  return keywords.some(keyword => haystack.includes(keyword.toLowerCase()))
}

function pageSetIdOf(page) {
  return text(page?.pageSetId) || text(page?.pageSet?.id)
}

function entityIdOf(page) {
  return text(page?.entityId) || text(page?.entity)
}

/** 同页面集 + 同实体的候选页（排除源页面自身；源页面无实体时不跨页） */
function candidatesFor(page, pages) {
  const entityId = entityIdOf(page)
  if (!entityId) return []
  const pageSetId = pageSetIdOf(page)
  return asArray(pages).filter(
    item =>
      item &&
      text(item.id) &&
      item.id !== page?.id &&
      entityIdOf(item) === entityId &&
      pageSetIdOf(item) === pageSetId
  )
}

/** 同页面集内的表单页（放宽兜底用；排除源页面自身） */
function formPagesInSet(page, pages) {
  const pageSetId = pageSetIdOf(page)
  return asArray(pages).filter(
    item =>
      item &&
      text(item.id) &&
      item.id !== page?.id &&
      pageSetIdOf(item) === pageSetId &&
      FORM_RECIPES.includes(text(item.recipe))
  )
}

/** 按配方优先级 + 关键词挑选目标页 */
function pickTarget(candidates, recipes, keywords) {
  for (const recipe of recipes) {
    const pool = candidates.filter(item => text(item.recipe) === recipe)
    if (!pool.length) continue
    const preferred = pool.find(item => matchesKeyword(item, keywords))
    return { recipe, page: preferred || pool[0] }
  }
  return null
}

function kindOfRecipe(recipe) {
  return recipe === 'dialog-form' ? 'dialog' : 'navigate'
}

/** 显式 actionTargets：目标必须存在且在同一页面集 */
function resolveExplicit(page, code, pages) {
  const raw = page?.actionTargets
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const targetId = text(raw[code])
  if (!targetId) return null
  const pageSetId = pageSetIdOf(page)
  const target = asArray(pages).find(item => item && text(item.id) === targetId)
  if (!target || pageSetIdOf(target) !== pageSetId) return { invalidTarget: targetId }
  return { page: target, explicit: true }
}

function candidateSummary(candidates) {
  return candidates
    .map(item => `${text(item.id)}(${text(item.recipe) || text(item.type) || '未标注'})`)
    .join('、')
}

/**
 * @param {{ action?: string, page?: any, pages?: any[] }} input
 */
export function resolveActionTarget({ action, page, pages } = {}) {
  const code = text(action)
  if (CONFIRM_ACTIONS.includes(code)) return { kind: 'confirm', action: code }
  if (!code) return { kind: 'notify', action: code }

  const candidates = candidatesFor(page, pages)
  const extras = candidates.length ? { candidates } : {}

  // 1. 显式优先（actionTargets）：不限定动作码是否已知，显式目标存在即采用
  const explicit = resolveExplicit(page, code, pages)
  if (explicit?.page) {
    return {
      kind: kindOfRecipe(text(explicit.page.recipe)),
      page: explicit.page,
      action: code,
      explicit: true,
      ...extras
    }
  }
  const invalid = explicit?.invalidTarget ? { invalidTarget: explicit.invalidTarget } : {}

  // 2. 已知动作码（create/edit/detail）才进入启发式
  const intent = code in ACTION_KEYWORDS ? code : ''
  if (!intent) return { kind: 'notify', action: code, ...invalid }

  // 3. 同页面集 + 同实体启发式
  const recipes = intent === 'detail' ? DETAIL_RECIPES : FORM_RECIPES
  const target = pickTarget(candidates, recipes, ACTION_KEYWORDS[intent])
  if (target) {
    return {
      kind: kindOfRecipe(target.recipe),
      page: target.page,
      action: code,
      ...invalid,
      ...extras
    }
  }

  // 4. 放宽兜底：仅 create/edit、源页面有实体、且无同实体候选（避免把别的实体表单当默认目标）
  if (intent !== 'detail' && entityIdOf(page) && candidates.length === 0) {
    const pool = formPagesInSet(page, pages)
    if (pool.length) {
      const preferred = pool.find(item => matchesKeyword(item, ACTION_KEYWORDS[intent]))
      const formPage = preferred || pool[0]
      return {
        kind: kindOfRecipe(text(formPage.recipe)),
        page: formPage,
        action: code,
        inferred: true,
        ...invalid,
        ...extras
      }
    }
  }

  // 5. 无目标：给出原因 + 候选（UI 打开临时表单或只提示）
  const entityId = entityIdOf(page)
  const label = TARGET_LABELS[intent]
  const candidateText = candidateSummary(candidates)
  const reason = [
    `该页面集未设计${label}页`,
    entityId ? `没有同实体 ${entityId} 的可用${intent === 'detail' ? '详情' : '表单'}页` : '源页面未绑定实体',
    candidateText ? `现有：${candidateText}` : '',
    invalid.invalidTarget ? `显式目标 ${invalid.invalidTarget} 不存在或不在同一页面集（已回退启发式）` : ''
  ]
    .filter(Boolean)
    .join('；')
  return { kind: 'none', action: code, reason, ...invalid, ...extras }
}

/**
 * B6-2 临时表单：页面契约没有可用表单页时的交互预览兜底（不写文件、不调接口）。
 *
 * 用实体字段（code/name）生成一个 `dialog-form` 形态的临时页面对象，
 * 宿主用 `ContractActionDialog` 渲染并标注「临时表单 · 未设计表单页」。
 * 实体无字段 → null（UI 只提示，不伪造空表单）。
 */
export function buildTemporaryFormPage(sourcePage, entity) {
  const fields = asArray(entity?.fields)
    .map(field => text(field?.code) || text(field?.name))
    .filter(Boolean)
  if (!fields.length) return null
  return {
    id: `temporary-form-${text(sourcePage?.id) || 'page'}`,
    title: '临时表单',
    type: 'form',
    recipe: 'dialog-form',
    pageSetId: pageSetIdOf(sourcePage),
    entityId: entityIdOf(sourcePage),
    spec: { fields: [...fields] },
    layout: {
      form: { presentation: 'dialog', columns: 2, width: 720, fields: [...fields] },
      groups: [{ title: '基本信息', fields: [...fields] }]
    }
  }
}
