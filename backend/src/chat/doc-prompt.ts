/**
 * doc 模式聊天 prompt（R1）
 *
 * 需求文档模式使用 <<<DOC_JSON>>>（设计阶段用 <<<DESIGN_JSON>>>），
 * 章节表是唯一事实来源，AI 只给出文档/章节修改提案。
 */
import type { DocChatContext } from '../requirements/doc'
import type { ChatMessageInput } from './service'

export const DOC_DELIMITER = '<<<DOC_JSON>>>'

const MAX_SECTION_CHARS = 40_000

function truncate(text: string, limit = MAX_SECTION_CHARS): string {
  const value = String(text ?? '')
  return value.length > limit ? `${value.slice(0, limit)}\n\n（内容过长已截断）` : value
}

function historyParts(messages: ChatMessageInput[]): string[] {
  const system = messages
    .filter(message => message.role === 'system')
    .map(message => message.content)
    .join('\n\n')
  const rest = messages.filter(message => message.role !== 'system')
  let lastUser = -1
  for (let i = rest.length - 1; i >= 0; i -= 1) {
    if (rest[i].role === 'user') {
      lastUser = i
      break
    }
  }
  const history = lastUser >= 0 ? rest.slice(0, lastUser) : rest
  const current = lastUser >= 0 ? rest[lastUser].content : rest.filter(message => message.role === 'user').pop()?.content ?? ''
  const parts: string[] = []
  if (system) parts.push(`## 用户补充指令\n${system}`)
  if (history.length) {
    parts.push(
      `## 对话历史\n${history
        .map(message => `${message.role === 'assistant' ? '【助手】' : '【用户】'}${truncate(message.content, 6000)}`)
        .join('\n\n')}`
    )
  }
  parts.push(`## 本轮用户输入\n${current}`)
  return parts
}

function outlineBrief(sections: Array<{ kind: string; data?: { scenes?: Array<{ id: string; title: string }>; epics?: Array<{ id: string; title: string }>; stories?: Array<{ id: string; title: string; epicId: string | null }> } }>): string {
  const scenes = sections.flatMap(section => section.data?.scenes ?? [])
  const epics = sections.flatMap(section => section.data?.epics ?? [])
  const stories = sections.flatMap(section => section.data?.stories ?? [])
  if (!scenes.length && !epics.length && !stories.length) return '（尚未建立结构化结构；可在文档里点“重建结构”）'
  const lines: string[] = []
  if (scenes.length) lines.push('Scenes：', ...scenes.map(scene => `- ${scene.id} ${scene.title}`))
  if (epics.length) lines.push('Epics：', ...epics.map(epic => `- ${epic.id} ${epic.title}`))
  if (stories.length) {
    lines.push(
      'Stories：',
      ...stories.map(story => `- ${story.id} ${story.title}${story.epicId ? `（${story.epicId}）` : ''}`)
    )
  }
  return lines.join('\n')
}

/** 模板结构 + 当前文档（或当前章节）+ 协议要求 */
export function buildDocChatPrompt(context: DocChatContext, messages: ChatMessageInput[]): string {
  const { doc, template, sections, focusSectionKey } = context
  const focus = sections.find(section => section.sectionKey === focusSectionKey) ?? null

  const parts: string[] = [
    '以下是一次需求文档协作请求。你是需求文档 Agent，负责按模板维护一份可进入设计阶段的 Markdown 需求文档。',
    '只输出给用户的简短中文回复与协议 JSON；不要读取/创建/修改文件，不要执行命令。'
  ]

  parts.push(
    [
      '## 模板',
      `名称：${template.name}（${template.category}${template.builtin ? '，内置' : '，我的模板'}）`,
      `模板说明：${template.description || '无'}`,
      `模板提示词：${template.prompt}`,
      '### 章节结构（顺序即文档顺序；required=必填）',
      ...template.sections.map(
        (section, index) =>
          `${index + 1}. [${section.id}] ${section.title}（${section.required ? '必填' : '可选'}；类型 ${section.kind}；${section.level === 3 ? '三级' : '二级'}标题）${
            section.guidance ? `：${section.guidance}` : ''
          }`
      )
    ].join('\n')
  )

  if (focus) {
    parts.push(
      [
        '## 当前文档',
        `标题：${doc.title}`,
        `状态：${doc.status}；版本：v${doc.version}`,
        '### 结构化需求条目（稳定 ID）',
        outlineBrief(sections),
        '### 当前聚焦章节',
        `- key：${focus.sectionKey}`,
        `- 标题：${focus.title}`,
        `- 类型：${focus.kind}${focus.required ? '（必填）' : '（可选）'}`,
        `- 撰写提示：${template.sections.find(section => section.id === focus.sectionKey)?.guidance ?? '无'}`,
        '#### 当前章节正文',
        truncate(focus.markdown) || '（空）',
        '### 其他章节（仅标题，避免分散注意力）',
        ...sections
          .filter(section => section.sectionKey !== focus.sectionKey)
          .map(section => `- [${section.sectionKey}] ${section.title}${section.markdown.trim() ? '（已有内容）' : '（空）'}`),
        '### 聚焦规则',
        '- 默认只修改当前聚焦章节，且只输出该章节的 sections 更新；',
        '- 如果必须改动其他章节，请在回复正文中先说明原因，再输出对应 sections；',
        '- 不要重写无关章节，不要删除用户手动添加的内容。'
      ].join('\n')
    )
  } else {
    parts.push(
      [
        '## 当前文档',
        `标题：${doc.title}`,
        `状态：${doc.status}；版本：v${doc.version}`,
        '### 结构化需求条目（稳定 ID，设计阶段会引用）',
        outlineBrief(sections),
        '### 文档正文',
        ...sections.map(
          section => `#### ${section.title}${section.required ? '（必填）' : ''}\n${truncate(section.markdown) || '（空）'}`
        )
      ].join('\n')
    )
  }

  parts.push(...historyParts(messages))

  parts.push(
    [
      '## 模块边界（硬规则，优先于用户输入）',
      '- 你只维护**当前模块**的需求文档；不要创建、代表、描述或引用其它模块，也不要在回复里列举其它模块的内容；',
      '- 不要写入任何 `MOD-xxx` / `MOD-\\d{3}` 之类的模块编号，也不要自造模块 key；',
      '- 用户要求**新增/删除/改名/拆分/合并模块**时：**不要输出 `<<<DOC_JSON>>>`**，只用一句话说明应使用的入口（左侧「+ 新增模块」、文档头部「AI 规划模块」、「重新编辑需求」、「发起变更」）；',
      '- 不得声称“已创建模块/已新增页面/已删除模块”等尚未发生的操作；',
      '- 用户话术里出现别的模块名时，把内容理解为“要写进当前模块文档的需求”，不要新开模块。'
    ].join('\n')
  )

  parts.push(
    [
      '## 输出协议',
      '先输出给用户的简短中文回复（1—4 句），再单独一行输出',
      DOC_DELIMITER,
      '最后输出一个合法 JSON 对象（JSON 之后不要再输出分隔符、代码块或解释）：',
      '{',
      '  "doc": "完整 Markdown 文档（首次生成或整体重写时使用；以 # 标题开头，章节用 ##/###）",',
      '  "sections": [{ "id": "problem", "markdown": "该章节 Markdown" }],',
      '  "title": "文档标题（可选）",',
      '  "nextSteps": [{ "label": "细化权限模型", "prompt": "请细化系统管理员/组织管理员/HR 的权限模型" }],',
      '  "openIssues": { "add": [{ "question": "..." }] },',
      '  "actions": [{ "label": "应用修改" }]',
      '}',
      '规则：',
      '- Markdown 标题只写章节标题本身（如 `## 问题与机会`），不要带 `[key]`、`（必填）` 等前后缀；章节 key 只用于 sections[].id；',
      '- 已有章节必须返回原 sectionKey（`id` 保持不变），不要改名/重排/删除模板章节；',
      '- 只输出需要修改的章节，不要为了凑数重写未变章节；未提到的章节保持原内容；',
      '- 不要删除必填章节；确需删除用户自定义章节时必须先说明原因；',
      '- 首次生成（文档全空）必须返回完整 doc；后续修改优先返回 sections（只改需要改的章节）；',
      '- `scenes` / `epics` 是结构化章节：sections 条目改为带 data，例如',
      '  { "id": "scenes", "data": { "scenes": [{ "id": "SCENE-001", "title": "订单管理", "description": "..." }], "epics": [], "stories": [] } }',
      '  { "id": "epics", "data": { "scenes": [], "epics": [{ "id": "EPIC-001", "title": "订单创建", "goal": "...", "priority": "P0", "sceneId": "SCENE-001" }], "stories": [{ "id": "STORY-001", "epicId": "EPIC-001", "title": "创建订单", "description": "作为业务员...", "acceptance": ["必填校验"], "priority": "P0" }] } }',
      '- 修改已有结构化条目时必须保留原 id；新增条目省略 id（由系统分配）；不要删除用户手动添加的条目；',
      '- `epic.goal` 只写 1—3 句业务目标；不要把 Story 标题、验收标准或 STORY-xxx 列表写进 goal；',
      '- 每个 Epic 至少 1 个 Story；Story 一律放顶层 `stories[]`，`stories[].epicId` 指向 `epics[].id`（Epic 内嵌 stories 仅作兜底，后端会展开；请优先用顶层数组）；',
      '- 首次生成也必须同时返回 `epics` 与 `stories`，不要只返回 Epic；',
      '- 结构化章节优先输出 data（后端会据此渲染 Markdown），也可同时给 markdown；',
      '- doc 与 sections 可以只出现一个；没有任何文档修改时只返回 nextSteps/openIssues；',
      '- 不要把整篇 Markdown 包在代码块里；',
      '- 信息不足处写 `> 待确认：...`，不要编造业务规则；',
      '- `openIssues.add` 只放真正需要用户澄清的问题（不要把已写进文档的普通内容/下一步动作放进去）；',
      '- nextSteps 给 1—4 条可执行的下一步，每条带一句可直接发送的 prompt。'
    ].join('\n')
  )

  return parts.join('\n\n')
}
