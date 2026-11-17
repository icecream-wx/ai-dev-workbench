/**
 * G1：需求聊天的“模块级操作意图”守卫 + 未知模块引用告警（确定性，不调模型）
 *
 * 背景（真实事故）：用户在需求聊天里说“帮我增加一个模块：订单客户管理…”，
 * 聊天没有创建模块的能力，模型把内容写进了当前模块的章节并自造 `MOD-003`；
 * 内容落库了，但落在错误模块上。这里把“模块管理”从聊天编辑里剥离出来：
 *
 * - `detectModuleIntent`：强规则识别模块级操作（新增/删除/改名/拆分/合并 + 模块），
 *   命中后聊天服务**不调模型、不产版本、不返回 DOC_JSON**，只回指引文案；
 * - `buildModuleGuidance`：按应用阶段/变更单给文案与可用动作（服务端判定）；
 * - `unknownModuleRefWarnings`：扫描文档里引用了不存在的 `MOD-xxx`，作为非阻塞警告。
 *
 * 反例（不得命中）：`在模块里新增一个字段`、`在 Epics 章节新增一个 Story`、`模块内的页面…`
 * —— 要求“模块/业务域/子域”是动作的**宾语**，而不是地点/限定语。
 */
import { db } from '../db'
import { activeChangeSetRow } from '../changesets/query'
import { defaultModule, moduleById } from './modules'

export type ModuleIntentAction = 'create' | 'delete' | 'rename' | 'split' | 'merge'

export interface ModuleIntent {
  action: ModuleIntentAction
  /** 命中的原文片段（便于日志/测试，不返回给用户） */
  matched: string
}

const ACTION_BY_VERB: Record<string, ModuleIntentAction> = {
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

/** 长动词优先（拆分为 → 拆分、合并成 → 合并），避免短动词抢先匹配后“为/成”无处可去 */
const VERB_PATTERN =
  '(拆分为|拆分成|拆成|合并为|合并成|新增|增加|添加|创建|新建|加|删除|删掉|移除|改名|重命名|拆分|合并)'
const OBJECT_PATTERN = '(模块|业务域|子域)'
/** 可选主语（“帮我新增一个模块”“我想新建模块”） */
const PREFIX_PATTERN = '(?:帮我|请|我要|我想|需要|希望|能否)?'
/**
 * 数量词：一/二/两/…/十/百/0-9 + 个（可带空格），兼容“一条/新的/这个/那个”。
 * 例如“新增两个模块”“增加 2 个模块”“加个模块”“删掉这个子域”。
 */
const QUANTITY_PATTERN = '(?:[一二两三四五六七八九十百0-9]+\\s*)?(?:个|一条|新的|这个|那个)?'
/**
 * 动词与“模块”之间的短修饰只用于「为/成」类动词
 * （“合并为订单模块”“拆分为订单模块和客户模块”）；不跨标点/空白、最多 10 字。
 * 普通动词不加修饰，避免“新增客户字段并更新模块信息”这类句子误伤。
 */
const MODIFIER_PATTERN = '[^，。；、,;！!？?：:\\s]{0,10}'
/** 规则 2 的动作必须结束一个短语：为/成/掉/吧/吗/句读/冒号/句末 */
const CLAUSE_END = '(?=\\s*(?:为|成|掉|吧|吗|。|，|,|！|!|？|\\?|：|:)|\\s*$)'
/** 句首或句读之后（“模块改名”“。 业务域拆分”） */
const CLAUSE_START = '(?:^|[。；;，,！!？?\\n])'
/** “为/成”类动词（需要允许多一个短名词修饰才能落到“模块”） */
const FORM_VERB_PATTERN = '(拆分为|拆分成|拆成|合并为|合并成)'

/**
 * 强规则 1a：动作 → 模块（“新增一个模块”“创建业务域”“合并两个模块”）。
 * “模块”必须是动作宾语；后面紧跟“里/内/中/的”说明它是地点/限定（新增一个模块的字段），不算。
 */
function ruleObject(): RegExp {
  return new RegExp(`${PREFIX_PATTERN}\\s*${VERB_PATTERN}\\s*${QUANTITY_PATTERN}\\s*${OBJECT_PATTERN}`, 'g')
}

/** 强规则 1b：为/成 类动词 + 短名词 + 模块（“合并为订单模块”“拆成两个模块”） */
function ruleObjectForm(): RegExp {
  return new RegExp(
    `${PREFIX_PATTERN}\\s*${FORM_VERB_PATTERN}\\s*${QUANTITY_PATTERN}\\s*${MODIFIER_PATTERN}${OBJECT_PATTERN}`,
    'g'
  )
}

/**
 * 强规则 2a：句首/标点后「模块|业务域|子域」+ 动作 + 短语收尾（“模块改名”“业务域拆分”“模块删除吧”）。
 *
 * 收紧原因：“订单模块增加客户绑定”“这个模块增加客户维度”是改内容，不是模块级操作；
 * 所以不再允许“任意字符 + 模块 + 新增/增加 + 任意名词”的宽泛命中。
 */
function ruleClauseStart(): RegExp {
  return new RegExp(`${CLAUSE_START}\\s*${OBJECT_PATTERN}\\s*${VERB_PATTERN}${CLAUSE_END}`, 'g')
}

/**
 * 强规则 2b：「把|将|对」+ 最多 10 个非标点字符 + 模块 + 动作 + 短语收尾
 * （“把订单模块删除吧”“把订单模块改名为客户管理”“把模块移除掉”）。
 */
function ruleBaZi(): RegExp {
  return new RegExp(`(?:把|将|对)\\s*[^，。；、,;！!？?：:\\n]{0,10}?${OBJECT_PATTERN}\\s*${VERB_PATTERN}${CLAUSE_END}`, 'g')
}

/** 命中后紧跟这些字 → “模块”是地点/限定，不是模块级操作 */
const LOCATION_SUFFIX = /^\s*(?:里|内|中|的)/

/**
 * 识别最新一条用户消息里的模块级操作意图。
 *
 * 返回最先出现的强规则命中；没有任何命中返回 null（正常聊天流程）。
 */
export function detectModuleIntent(rawText: unknown): ModuleIntent | null {
  const text = typeof rawText === 'string' ? rawText : ''
  if (!text.trim()) return null

  const best: { index: number; action: ModuleIntentAction | null; matched: string } = {
    index: Number.POSITIVE_INFINITY,
    action: null,
    matched: ''
  }
  const consider = (match: RegExpMatchArray, verbGroup: number, skipLocationSuffix: boolean): void => {
    const index = typeof match.index === 'number' ? match.index : 0
    // 规则 1 命中后紧跟“里/内/中/的”说明“模块”是地点/限定（“新增一个模块的字段”）
    if (skipLocationSuffix && LOCATION_SUFFIX.test(text.slice(index + match[0].length))) return
    const action = ACTION_BY_VERB[match[verbGroup] ?? '']
    if (!action) return
    if (index < best.index) {
      best.index = index
      best.action = action
      best.matched = match[0]
    }
  }
  // 规则 1（动作 → 模块）：第 1 组是动词
  for (const match of text.matchAll(ruleObject())) consider(match, 1, true)
  for (const match of text.matchAll(ruleObjectForm())) consider(match, 1, true)
  // 规则 2a（句首/标点后 模块 → 动作）与 2b（把/将/对 … 模块 → 动作）：第 2 组是动词（第 1 组是“模块”）
  for (const match of text.matchAll(ruleClauseStart())) consider(match, 2, false)
  for (const match of text.matchAll(ruleBaZi())) consider(match, 2, false)
  return best.action ? { action: best.action, matched: best.matched } : null
}

// ------------------------------------------------------------- 指引文案

export type ModuleGuidanceAction = 'create-module' | 'open-replan' | 'reopen-requirements' | 'open-change-set'

export interface ModuleGuidanceMetadata {
  moduleAction: 'guidance'
  stage: 'requirements' | 'design' | 'development'
  changeSet: { seq: number; scope: string } | null
  suggestions: Array<{ action: ModuleGuidanceAction }>
}

export interface ModuleGuidance {
  content: string
  metadata: ModuleGuidanceMetadata
}

export interface ModuleGuidanceContext {
  /** `apps.status`（requirements / design / development / completed） */
  appStatus: string
  /** 进行中的变更单（seq/scope）；没有则 null */
  changeSet: { seq: number; scope: string } | null
  /** 当前模块显示名（`MOD-001 商品管理`），用于说明聊天只改这个模块 */
  moduleLabel?: string
}

export function guidanceStage(appStatus: string): ModuleGuidanceMetadata['stage'] {
  if (appStatus === 'requirements') return 'requirements'
  if (appStatus === 'design') return 'design'
  return 'development'
}

const ACTION_HINT: Record<ModuleIntentAction, string> = {
  create: '新增模块请用文档左侧的「+ 新增模块」。',
  delete: '删除模块请用模块菜单里的「归档」（归档后内容保留，可随时恢复）。',
  rename: '模块改名请用模块菜单里的「编辑模块」。',
  split: '拆分模块请用文档头部的「AI 规划模块」。',
  merge: '合并模块请用文档头部的「AI 规划模块」。'
}

/**
 * 生成指引文案 + 元数据。
 *
 * `suggestions` 只包含**当前状态可用**的动作（服务端判定），前端据此启用按钮：
 * - 需求阶段 + 无变更单：新增模块 + AI 规划模块；
 * - 需求阶段 + 有变更单：只能新增模块（变更中不支持 AI 重新规划）；
 * - 设计：只能“重新编辑需求”（“仅设计”变更中两者都不可用，需先取消变更）；
 * - 开发/完成：发起变更（“需求+设计”变更中可先重新编辑需求）。
 */
export function buildModuleGuidance(intent: ModuleIntent, context: ModuleGuidanceContext): ModuleGuidance {
  const stage = guidanceStage(context.appStatus)
  const changeSet = context.changeSet ? { seq: context.changeSet.seq, scope: context.changeSet.scope } : null
  const suggestions: ModuleGuidanceAction[] = []
  let entry = ''

  if (stage === 'requirements') {
    if (changeSet) {
      entry = `当前正在变更 #${changeSet.seq} 中：新增模块请用左侧「+ 新增模块」（变更中新增的模块会自动纳入本次变更范围）；变更中不支持「AI 规划模块」，拆分/合并/改名请先完成或取消本次变更。`
      suggestions.push('create-module')
    } else {
      entry = '需求阶段的模块调整请用专用入口：新增模块用左侧「+ 新增模块」；拆分/合并/改名请用文档头部的「AI 规划模块」，也可以在模块菜单里改名或归档。'
      suggestions.push('create-module', 'open-replan')
    }
  } else if (stage === 'design') {
    if (changeSet && changeSet.scope === 'requirements') {
      entry = `当前正在变更 #${changeSet.seq} 中，需求可以修改：请先「重新编辑需求」回到需求阶段，再用左侧「+ 新增模块」新增。`
      suggestions.push('reopen-requirements')
    } else if (changeSet) {
      entry = `当前是“仅设计”变更（#${changeSet.seq}），不能修改需求；如需新增模块请先取消本次变更，再发起“需求+设计”变更。`
    } else {
      entry = '需求已进入设计阶段，聊天不能修改需求：请先「重新编辑需求」回到需求阶段，再用左侧「+ 新增模块」新增。'
      suggestions.push('reopen-requirements')
    }
  } else if (changeSet && changeSet.scope === 'requirements') {
    entry = `当前正在变更 #${changeSet.seq} 中：请先「重新编辑需求」回到需求阶段，再用左侧「+ 新增模块」新增。`
    suggestions.push('reopen-requirements')
  } else if (changeSet) {
    entry = `当前是“仅设计”变更（#${changeSet.seq}），不能修改需求；如需新增模块请先取消本次变更，再发起“需求+设计”变更。`
  } else {
    entry = '应用已进入开发阶段，需求只读；如需新增模块请先在应用头部「发起变更」（范围：需求+设计）。'
    suggestions.push('open-change-set')
  }

  const lines = ['这是模块级操作：需求聊天只用来修改当前模块的文档内容，不能创建、删除、改名、拆分或合并模块。']
  if (context.moduleLabel) lines.push(`聊天只会修改当前模块「${context.moduleLabel}」的文档内容。`)
  lines.push(entry, ACTION_HINT[intent.action], '本条消息没有修改任何文档，也没有产生新的版本。')

  return {
    content: lines.join('\n'),
    metadata: {
      moduleAction: 'guidance',
      stage,
      changeSet,
      suggestions: suggestions.map(action => ({ action }))
    }
  }
}

/** 当前模块显示名（只读，不懒创建模块） */
export function moduleLabelOf(appId: string, moduleId?: string): string {
  const trimmed = typeof moduleId === 'string' ? moduleId.trim() : ''
  const row = trimmed ? moduleById(appId, trimmed) : defaultModule(appId)
  return row ? `${row.module_key} ${row.title}`.trim() : ''
}

/** 由应用状态 + active 变更单组装指引上下文（只读） */
export function moduleGuidanceContext(appId: string, appStatus: string, moduleId?: string): ModuleGuidanceContext {
  const active = activeChangeSetRow(appId)
  return {
    appStatus,
    changeSet: active ? { seq: active.seq, scope: active.scope } : null,
    moduleLabel: moduleLabelOf(appId, moduleId)
  }
}

// ------------------------------------------------------- 未知模块引用告警

/** `MOD-003` 之类的模块编号（至少 3 位数字） */
const MODULE_REF_PATTERN = /\bMOD-\d{3,}\b/g

/**
 * 扫描文档文本里引用了**不存在**的模块编号（含归档模块视为存在）。
 *
 * 返回去重后的非阻塞 warning（同一 key 只出现一次），供保存/确认接口透出。
 */
export function unknownModuleRefWarnings(appId: string, texts: Array<string | null | undefined>): string[] {
  const rows = db.prepare('SELECT module_key FROM app_modules WHERE app_id = ?').all(appId) as Array<{ module_key: string }>
  const known = new Set(rows.map(row => row.module_key))
  const seen = new Set<string>()
  const warnings: string[] = []
  for (const text of texts) {
    if (typeof text !== 'string' || !text) continue
    for (const match of text.matchAll(MODULE_REF_PATTERN)) {
      const key = match[0]
      if (known.has(key) || seen.has(key)) continue
      seen.add(key)
      warnings.push(`文档引用了不存在的模块 ${key}（新增模块请用左侧「+ 新增模块」）`)
    }
  }
  return warnings
}
