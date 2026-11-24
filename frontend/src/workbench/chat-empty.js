/**
 * AI 面板空态/示例/上下文纯逻辑（UI-2b）：视图标签、示例 prompts、空态标题与 CTA、上下文 pills。
 * 不依赖 Vue/DOM，便于 node --test 单测；`AgentChatPanel` 只在未传 props 时取默认值。
 */

const VIEW_LABELS = {
  requirements: '需求视图',
  design: '设计视图',
  development: '开发视图',
  template: '模板工作室'
}

const VIEW_SUBJECTS = {
  requirements: '需求',
  design: '设计',
  development: '开发',
  template: '模板工作室'
}

/** 空态示例 prompts（按 view；未知 view 走开发兜底）
 *  requirements 用 AI 专属问法，与需求视图中央空态的 3 个示例刻意不重复（避免同屏重复）。
 */
const EMPTY_EXAMPLES = {
  requirements: [
    '帮我梳理这个应用还缺哪些 Epic 与用户故事。',
    '按需求模板补全需求文档的章节骨架。',
    '检查需求文档里缺失的验收标准。'
  ],
  design: [
    '按需求一次生成实体/关系、页面集与接口设计，并补齐页面契约。',
    '检查页面契约与实体字段（code/name）是否一致，并同步接口设计。',
    '补/更新接口设计，补齐页面动作与实体 CRUD 覆盖。'
  ],
  template: [
    '先读 catalog，给出 3 个页面清单与字段建议。',
    '写 spec 并生成模板，报告 errors/warnings。',
    '检查 spec 与 contract 是否一致。'
  ],
  development: [
    '先读 AGENTS 与设计参考再实现。',
    '按 Epic/页面集检查完成度。',
    '列出下一步建议。'
  ]
}

/** 空态说明（未传 emptyHint 时的按视图默认文案） */
const EMPTY_HINTS = {
  requirements: '需求对话：说明目标、要补的章节或要改的 Epic；下面的示例可直接填入输入框（不会自动发送）。',
  design: '设计对话：说明实体、页面集或页面契约要改什么；下面的示例可直接填入输入框（不会自动发送）。',
  template: '模板工作室：描述业务目标，agent 会先读 catalog，再写 spec.json；下面的示例可直接填入输入框。',
  development: '开发对话：先让 agent 读 AGENTS 与设计参考，再开始实现；下面的示例可直接填入输入框。'
}

export function viewLabelOf(view) {
  return VIEW_LABELS[String(view ?? '')] ?? VIEW_LABELS.development
}

export function emptyExamplesFor(view) {
  const list = EMPTY_EXAMPLES[String(view ?? '')] ?? EMPTY_EXAMPLES.development
  return [...list]
}

export function emptyHintFor(view) {
  return EMPTY_HINTS[String(view ?? '')] ?? EMPTY_HINTS.development
}

/** 输入框占位（未传 composerPlaceholder 时的按视图默认文案） */
export function composerPlaceholderFor(view) {
  const subject = VIEW_SUBJECTS[String(view ?? '')] ?? VIEW_SUBJECTS.development
  return `给${subject} agent 发消息…  Enter 发送 · Shift+Enter 换行`
}

/**
 * 空态标题/CTA：
 * - 无会话 →「开始与 AI 协作」+ 新会话（调用 newSession）
 * - 有会话无消息 →「发送第一条消息」+ 聚焦输入框
 */
export function emptyCopyFor({ hasSession } = {}) {
  return hasSession
    ? { title: '发送第一条消息', cta: '发送第一条消息', action: 'focus' }
    : { title: '开始与 AI 协作', cta: '新会话', action: 'new-session' }
}

/**
 * 上下文 pills：视图（需求/设计/工作室/开发）、工作室 packId（view=template）。
 * 不返回模块/模板风格 chip（模块已移除；顶部外壳已有模板风格摘要）。
 */
export function contextPillsFor({ view, packId } = {}) {
  const pills = [{ key: 'view', label: viewLabelOf(view), title: `当前视图：${viewLabelOf(view)}` }]
  const pack = String(packId ?? '').trim()
  if (String(view ?? '') === 'template' && pack) {
    pills.push({ key: 'pack', label: `pack ${pack}`, title: `当前模板 pack：${pack}` })
  }
  return pills
}
