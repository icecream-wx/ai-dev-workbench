/**
 * 首次模块规划聊天 prompt（RMP-1）
 *
 * 与 doc 模式不同：本轮**只产出模块拆分建议**（`<<<MODULE_PLAN_JSON>>>`），
 * 不写文档、不输出 DOC_JSON、不建模块；应用建议由用户在建议卡确认后单独调用 apply。
 */
import type { DocChatContext } from '../requirements/doc'
import { MODULE_PLAN_DELIMITER } from '../requirements/module-plan'
import type { ChatMessageInput } from './service'

const MAX_TEXT = 12_000

function truncate(text: string, limit = MAX_TEXT): string {
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
      `## 对话历史（含上一版模块建议）\n${history
        .map(message => `${message.role === 'assistant' ? '【助手】' : '【用户】'}${truncate(message.content, 8000)}`)
        .join('\n\n')}`
    )
  }
  parts.push(`## 本轮用户输入\n${current}`)
  return parts
}

/** 首次模块规划 prompt：模板结构 + 拆分规则 + 协议 */
export function buildModulePlanChatPrompt(context: DocChatContext, messages: ChatMessageInput[]): string {
  const { appName, template, doc } = context
  const parts: string[] = [
    '以下是一次**需求模块规划**请求。你是需求模块规划 Agent：把用户的完整业务需求拆成若干**业务域模块**，每个模块后续会各自生成一份完整模板需求文档（PRD）。',
    '本轮**只规划、不写文档**：不要输出 DOC_JSON，不要生成任何章节正文，不要创建/修改文件或执行命令。'
  ]

  parts.push(
    [
      '## 应用与模板',
      `应用：${appName}`,
      `需求模板：${template.name}（${template.category}）`,
      '每个模块都会按下面**全部章节**生成独立 PRD：',
      ...template.sections.map(
        (section, index) =>
          `${index + 1}. ${section.title}（${section.required ? '必填' : '可选'}；类型 ${section.kind}）${section.guidance ? `：${section.guidance}` : ''}`
      ),
      `当前模块：${doc.title}（仅 1 个空默认模块；应用建议后它会被复用为第一个业务域模块）`,
      '当前文档为空：本轮不写文档。'
    ].join('\n')
  )

  parts.push(
    [
      '## 拆分规则（必须遵守）',
      '1. 模块 = 业务域 / 团队协作边界；模块内部再用场景/Epic/Story 细分。',
      '2. **禁止按 CRUD 或单个实体拆模块**：不要出现「商品列表模块」「新增商品模块」「删除订单模块」这类标题；也不要因为一个实体有列表/新增/修改/删除就单独建模块。',
      '3. 同一业务域的实体与其明细归同一个模块：例如「商品 + 商品明细」→「商品管理」；「订单 + 订单明细」→「订单管理」。',
      '4. 明确排除项不生成模块：用户说“不做支付”就不要出现支付模块；可在 scope/coverage 里说明已排除。',
      '5. 模块数量由内容决定，通常 1—6 个；不设业务硬上限，但过多会拉长生成时间（>8 个会给用户 warning）。',
      '6. 模块标题用业务域名词（商品管理/订单管理/售后管理），非空且唯一，最多 120 字。',
      '7. `scope` 写清边界与排除项；`suggestedEpics` 只用于预览（每个 Epic 至少 1 个 Story）。',
      '8. 跨模块关系写进 `dependencies`（from → to，例如订单引用商品：from=order,to=product），并说明“不重复建实体”。',
      '9. `coverage` 列出用户每条需求归属哪个模块；确实无法归属或需用户确认的放 `unassigned`（不阻塞应用）。',
      '10. `openIssues` 放真正需要用户确认的问题；`warnings` 放拆分提醒（例如已按“不做支付”排除支付）。',
      '11. `kind` 固定为 "initial"；所有模块 `existingModuleId` 为 null、`action` 为 "create"（本轮固定）。',
      '12. 如果用户补充“再加售后模块/把订单拆开”等，基于上一版建议输出**更新后的完整计划**（不是补丁）。'
    ].join('\n')
  )

  parts.push(...historyParts(messages))

  parts.push(
    [
      '## 输出协议',
      '先输出 1—4 句简短中文回复（说明拆分思路），再单独一行输出',
      MODULE_PLAN_DELIMITER,
      '最后输出一个合法 JSON 对象（JSON 之后不要再输出分隔符、代码块或解释）：',
      '{',
      '  "kind": "initial",',
      '  "modules": [',
      '    {',
      '      "key": "product",',
      '      "title": "商品管理",',
      '      "description": "商品与商品明细的档案维护",',
      '      "scope": ["商品档案 CRUD", "商品明细 CRUD", "商品与明细 1:1"],',
      '      "suggestedEpics": [',
      '        { "title": "商品档案", "stories": ["商品列表", "新增商品", "修改商品", "删除商品"] },',
      '        { "title": "商品明细", "stories": ["明细列表", "新增明细", "修改明细", "删除明细"] }',
      '      ],',
      '      "existingModuleId": null,',
      '      "action": "create"',
      '    },',
      '    {',
      '      "key": "order",',
      '      "title": "订单管理",',
      '      "description": "选择商品生成订单，不做支付",',
      '      "scope": ["订单创建", "订单查询", "订单状态（待确认）", "不涉及：支付"],',
      '      "suggestedEpics": [',
      '        { "title": "订单创建", "stories": ["选择商品生成订单", "订单列表/详情"] }',
      '      ],',
      '      "existingModuleId": null,',
      '      "action": "create"',
      '    }',
      '  ],',
      '  "dependencies": [',
      '    { "from": "order", "to": "product", "description": "订单引用商品，N:1；订单模块不重复建商品实体" }',
      '  ],',
      '  "coverage": [',
      '    { "requirement": "商品 CRUD", "moduleKey": "product" },',
      '    { "requirement": "商品明细 CRUD", "moduleKey": "product" },',
      '    { "requirement": "订单创建/查询", "moduleKey": "order" }',
      '  ],',
      '  "unassigned": [',
      '    { "requirement": "订单状态流转", "reason": "需求未明确状态机，作为待确认" }',
      '  ],',
      '  "openIssues": ["订单是否需要库存扣减？"],',
      '  "warnings": ["未发现支付模块（符合“不做支付”）"]',
      '}',
      '注意：',
      '- 只输出模块计划，不要输出任何章节正文/DOC_JSON；',
      '- 标题必须是业务域名词，不能是 CRUD 功能名；',
      '- 用户明确说“不做”的功能不得生成模块；',
      '- JSON 必须是合法 JSON（不要尾逗号、不要注释、不要 markdown 围栏）。'
    ].join('\n')
  )

  return parts.join('\n\n')
}
