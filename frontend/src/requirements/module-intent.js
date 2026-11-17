/**
 * G1：需求聊天“模块级操作意图”的前端预检（纯函数，不依赖 Vue/DOM）
 *
 * 服务端守卫是权威（`backend/src/requirements/module-intent.ts`）：命中即返回指引卡、
 * 不调模型、不产版本。这里只做两件事：
 * - 非需求阶段（设计/开发）聊天输入区仍然可输入时，先用同一套强规则判断是否值得发给服务端；
 *   不是模块级操作就直接提示“需求只读”，避免无谓的模型调用；
 * - 指引卡按钮的文案/禁用原因。
 *
 * 规则必须与后端保持一致（新增/删除/改名/拆分/合并 + 模块/业务域/子域作为动作宾语）。
 */

const ACTION_BY_VERB = {
  新增: 'create',
  增加: 'create',
  添加: 'create',
  创建: 'create',
  新建: 'create',
  加: 'create',
  删除: 'delete',
  删掉: 'delete',
  移除: 'delete',
  改名: 'rename',
  重命名: 'rename',
  拆分: 'split',
  拆成: 'split',
  拆分为: 'split',
  拆分成: 'split',
  合并: 'merge',
  合并为: 'merge',
  合并成: 'merge'
}

/** 长动词优先（拆分为 → 拆分、合并成 → 合并） */
const VERB_PATTERN =
  '(拆分为|拆分成|拆成|合并为|合并成|新增|增加|添加|创建|新建|加|删除|删掉|移除|改名|重命名|拆分|合并)'
const OBJECT_PATTERN = '(模块|业务域|子域)'
const PREFIX_PATTERN = '(?:帮我|请|我要|我想|需要|希望|能否)?'
/** 数量词：一/二/两/…/十/百/0-9 + 个（可带空格），兼容“一条/新的/这个/那个” */
const QUANTITY_PATTERN = '(?:[一二两三四五六七八九十百0-9]+\\s*)?(?:个|一条|新的|这个|那个)?'
/** 为/成 类动词与“模块”之间的短修饰（不跨标点/空白、≤10 字） */
const MODIFIER_PATTERN = '[^，。；、,;！!？?：:\\s]{0,10}'
/** 规则 2 的动作必须结束短语：为/成/掉/吧/吗/句读/冒号/句末 */
const CLAUSE_END = '(?=\\s*(?:为|成|掉|吧|吗|。|，|,|！|!|？|\\?|：|:)|\\s*$)'
const CLAUSE_START = '(?:^|[。；;，,！!？?\\n])'
const FORM_VERB_PATTERN = '(拆分为|拆分成|拆成|合并为|合并成)'

/** 动作 → 模块（“新增一个模块”“合并两个模块”） */
const RULE_OBJECT = new RegExp(`${PREFIX_PATTERN}\\s*${VERB_PATTERN}\\s*${QUANTITY_PATTERN}\\s*${OBJECT_PATTERN}`, 'g')
/** 为/成 类动词 + 短名词 + 模块（“合并为订单模块”） */
const RULE_OBJECT_FORM = new RegExp(
  `${PREFIX_PATTERN}\\s*${FORM_VERB_PATTERN}\\s*${QUANTITY_PATTERN}\\s*${MODIFIER_PATTERN}${OBJECT_PATTERN}`,
  'g'
)
/** 规则 2a：句首/标点后 模块 + 动作 + 短语收尾（“模块改名”“业务域拆分”） */
const RULE_CLAUSE_START = new RegExp(`${CLAUSE_START}\\s*${OBJECT_PATTERN}\\s*${VERB_PATTERN}${CLAUSE_END}`, 'g')
/** 规则 2b：把/将/对 + ≤10 非标点字符 + 模块 + 动作 + 短语收尾（“把订单模块改名为客户管理”） */
const RULE_BA_ZI = new RegExp(
  `(?:把|将|对)\\s*[^，。；、,;！!？?：:\\n]{0,10}?${OBJECT_PATTERN}\\s*${VERB_PATTERN}${CLAUSE_END}`,
  'g'
)
const LOCATION_SUFFIX = /^\s*(?:里|内|中|的)/

/**
 * 识别模块级操作意图。
 * @param {unknown} text
 * @returns {'create'|'delete'|'rename'|'split'|'merge'|null}
 */
export function detectModuleIntent(text) {
  const value = typeof text === 'string' ? text : ''
  if (!value.trim()) return null
  let best = null
  const consider = (match, verbGroup, skipLocationSuffix) => {
    const index = typeof match.index === 'number' ? match.index : 0
    if (skipLocationSuffix && LOCATION_SUFFIX.test(value.slice(index + match[0].length))) return
    const action = ACTION_BY_VERB[match[verbGroup] ?? '']
    if (!action) return
    if (!best || index < best.index) best = { index, action }
  }
  // 规则 1a/1b：第 1 组是动词；规则 2a/2b：第 2 组是动词（第 1 组是“模块”）
  for (const match of value.matchAll(RULE_OBJECT)) consider(match, 1, true)
  for (const match of value.matchAll(RULE_OBJECT_FORM)) consider(match, 1, true)
  for (const match of value.matchAll(RULE_CLAUSE_START)) consider(match, 2, false)
  for (const match of value.matchAll(RULE_BA_ZI)) consider(match, 2, false)
  return best ? best.action : null
}

/** 指引卡按钮（顺序固定；服务端只给当前可用的 action） */
export const MODULE_GUIDANCE_ACTIONS = [
  { action: 'create-module', label: '＋ 新增模块' },
  { action: 'open-replan', label: 'AI 规划模块' },
  { action: 'reopen-requirements', label: '重新编辑需求' },
  { action: 'open-change-set', label: '发起变更' }
]

/** 不可用原因（title；disabled 按钮也给出解释） */
export const MODULE_GUIDANCE_REASONS = {
  'create-module': '只有需求阶段可以新增模块；设计/开发阶段请先「重新编辑需求」或发起“需求+设计”变更',
  'open-replan': '变更进行中或非需求阶段不支持「AI 规划模块」',
  'reopen-requirements': '当前状态不能重新编辑需求（例如“仅设计”变更中，请先取消本次变更）',
  'open-change-set': '只有开发/完成阶段且没有进行中的变更时才能发起变更'
}

/**
 * 服务端 suggestions → 按钮可用状态。
 * @param {Array<{ action: string }>|null|undefined} suggestions
 */
export function guidanceButtonState(suggestions) {
  const allowed = new Set((Array.isArray(suggestions) ? suggestions : []).map(item => item && item.action))
  return MODULE_GUIDANCE_ACTIONS.map(item => ({
    ...item,
    enabled: allowed.has(item.action),
    title: allowed.has(item.action) ? item.label : MODULE_GUIDANCE_REASONS[item.action] ?? '当前状态不可用'
  }))
}
