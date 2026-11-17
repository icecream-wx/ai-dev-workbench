/**
 * 设计阶段 prompt（D1—D4）
 *
 * - 设计对话使用 <<<DESIGN_JSON>>>，envelope = entities / pageSets / nextSteps / openIssues / actions；
 * - 实体生成/页面集生成使用“只输出 JSON”的一次性任务 prompt；
 * - 所有 prompt 都读取已确认需求文档 + 原型模板 + 当前实体/页面规格。
 */
import type { ChatMessageInput } from '../chat/service'
import { epicRefsOf, findEpicNode, pageSetBelongsToEpic, type DesignEpicNode } from './epic-context'
import type { DesignEntity, DesignPageSet, DesignProjectPayload, PrototypeTemplate } from './types'

export const DESIGN_DELIMITER = '<<<DESIGN_JSON>>>'

const MAX_DOC_CHARS = 60_000

function truncate(text: string, limit: number): string {
  const value = String(text ?? '')
  return value.length > limit ? `${value.slice(0, limit)}\n\n（内容过长已截断）` : value
}

function entitiesBrief(entities: DesignEntity[]): string {
  if (!entities.length) return '（暂无实体）'
  return entities
    .map(entity => {
      const fields = entity.fields.map(field => `${field.name}:${field.type}${field.required ? '!' : ''}`).join(', ')
      const relations = entity.relations
        .map(relation => `${relation.name}(${relation.type}→${relation.target})`)
        .join(', ')
      return `- ${entity.id}｜${entity.name}｜表 ${entity.tableName || '-'}｜${entity.status}｜需求 ${entity.requirementRefs.join('/') || '-'}｜字段: ${fields || '无'}${relations ? `｜关系: ${relations}` : ''}`
    })
    .join('\n')
}

function pageSetsBrief(pageSets: DesignPageSet[]): string {
  if (!pageSets.length) return '（暂无页面集）'
  return pageSets
    .map(set => {
      const pages = set.pages
        .map(page => `${page.id}:${page.pageKey}/${page.type}${page.spec.mode ? `:${page.spec.mode}` : ''}/${page.title}${page.entityId ? `→${page.entityId}` : ''}(${page.status})[${page.requirementRefs.join('/') || '-'}]`)
        .join('；')
      return `- ${set.id}｜${set.title}｜Epic ${set.epicId || '-'}｜Stories ${set.storyIds.join('/') || '-'}｜场景 ${set.sceneKey}｜${set.status}｜页面: ${pages || '无'}`
    })
    .join('\n')
}

function templateBrief(template: PrototypeTemplate): string {
  return [
    `名称：${template.name}（${template.category}${template.builtin ? '，内置' : '，我的模板'}）`,
    `模板提示词：${template.prompt}`,
    `Token：主色 ${template.tokens.primary}，辅助色 ${template.tokens.accent}，中性色 ${template.tokens.neutral}，圆角 ${template.tokens.radius}px，间距 ${template.tokens.spacing}px，密度 ${template.tokens.density}`,
    `App Shell：${template.shell.type}${template.shell.sidebarDark ? '（深色侧栏）' : '（浅色侧栏）'}`,
    `页面模式：列表筛选=${template.patterns.list.filters}，分页=${template.patterns.list.pagination}；表单=${template.patterns.form.presentation}，标签=${template.patterns.form.labelPosition}；详情分区=${template.patterns.detail.sections}`,
    `页面集规则：默认页面 ${template.pageSetRules.defaultPages.join('/')}；创建=${template.pageSetRules.createAs}，编辑=${template.pageSetRules.editAs}；默认分页 ${template.pageSetRules.defaultPageSize}；默认查询字段 ${template.pageSetRules.defaultSearchFields}`
  ].join('\n')
}

function inputBrief(project: DesignProjectPayload): string {
  const input = project.input
  if (!input) return requirementBrief(project)
  const sceneTitle = new Map(input.scenes.map(scene => [scene.id, scene.title]))
  const lines: string[] = [
    `需求输入：v${input.docVersion}（${input.structure === 'prd' ? 'PRD 结构' : 'fallback：缺少 Epic'}）；模板：${input.templateName}`,
    `场景 ${input.scenes.length} / Epics ${input.epics.length} / Stories ${input.stories.length} / 角色 ${input.roles.length}`,
    '### 场景（稳定 ID）',
    ...(input.scenes.length
      ? input.scenes.map(scene => `- ${scene.id} ${scene.title}${scene.description ? `：${scene.description}` : ''}`)
      : ['（无）']),
    '### Epics / Stories（稳定 ID；引用必须使用这些 ID）',
    ...(input.epics.length
      ? input.epics.flatMap(epic => [
          `- ${epic.id} ${epic.title}${epic.sceneId ? `（场景 ${epic.sceneId} ${sceneTitle.get(epic.sceneId) ?? ''}）` : ''}${epic.priority ? `｜优先级 ${epic.priority}` : ''}${epic.goal ? `｜目标：${epic.goal}` : ''}`,
          ...epic.stories.map(
            story =>
              `  - ${story.id} ${story.title}${story.priority ? `（${story.priority}）` : ''}${story.description ? `：${story.description}` : ''}${
                story.acceptance.length ? `｜验收：${story.acceptance.join('；')}` : ''
              }`
          )
        ])
      : ['（无 Epic）']),
    ...(input.stories.some(story => !story.epicId)
      ? ['### 未归属 Epic 的 Stories', ...input.stories.filter(story => !story.epicId).map(story => `- ${story.id} ${story.title}`)]
      : []),
    '### 角色',
    ...(input.roles.length ? input.roles.map(role => `- ${role.id} ${role.name}${role.description ? `：${role.description}` : ''}`) : ['（无）']),
    '### 业务规则与数据要求（章节原文）',
    truncate(input.dataRules.markdown, 12_000) || '（空）',
    '### 页面与交互需求（章节原文）',
    truncate(input.pageRequirements.markdown, 8_000) || '（空）',
    '### 非功能需求（章节原文）',
    truncate(input.nonFunctionals.markdown, 6_000) || '（空）'
  ]
  if (input.openQuestions.length) {
    lines.push('### 待澄清问题', ...input.openQuestions.map(item => `- ${item.id} ${item.question}`))
  }
  if (input.glossary.length) {
    lines.push('### 术语表', ...input.glossary.map(item => `- ${item.term}：${item.definition}`))
  }
  lines.push('### 需求文档正文（供交叉核对）', truncate(project.requirement?.contentMd ?? '', 30_000))
  return lines.join('\n')
}

function requirementBrief(project: DesignProjectPayload): string {
  const requirement = project.requirement
  if (!requirement) return '（需求文档不存在）'
  return [
    `标题：${requirement.title}`,
    `版本：v${requirement.version}；状态：${requirement.status}；模板：${requirement.templateName}`,
    '### 需求文档正文',
    truncate(requirement.contentMd, MAX_DOC_CHARS)
  ].join('\n')
}

export interface DesignChatContext {
  project: DesignProjectPayload
  focus?: { kind?: string; id?: string }
}

function focusBrief(project: DesignProjectPayload, focus?: { kind?: string; id?: string }): string {
  if (!focus?.id) return ''
  if (focus.kind === 'entity') {
    const entity = project.entities.find(item => item.id === focus.id)
    if (!entity) return ''
    return [
      '## 当前聚焦实体',
      `- id：${entity.id}`,
      `- 名称：${entity.name}；表名：${entity.tableName || '-'}；状态：${entity.status}`,
      `- 描述：${entity.description || '无'}`,
      '### 字段',
      ...entity.fields.map(
        field =>
          `- ${field.name}（${field.label}）：${field.type}${field.required ? '，必填' : ''}${field.unique ? '，唯一' : ''}${
            field.options?.length ? `，枚举 ${field.options.join('/')}` : ''
          }${field.ref ? `，引用 ${field.ref}` : ''}${field.note ? `；${field.note}` : ''}`
      ),
      '### 关系',
      ...(entity.relations.length
        ? entity.relations.map(relation => `- ${relation.name}：${relation.type} → ${relation.target}`)
        : ['（无）'])
    ].join('\n')
  }
  if (focus.kind === 'epic') {
    const node = findEpicNode(project, focus.id)
    if (!node) return ''
    const refs = new Set(epicRefsOf(node))
    const relatedEntities = project.entities.filter(entity => entity.requirementRefs.some(ref => refs.has(ref)))
    const relatedSets = project.pageSets.filter(set => pageSetBelongsToEpic(set, node))
    return [
      '## 当前聚焦 Epic/场景',
      `- id：${node.id}；标题：${node.title}${node.isScene ? '（fallback 场景）' : ''}`,
      ...(node.goal ? [`- 目标：${node.goal}`] : []),
      ...(node.priority ? [`- 优先级：${node.priority}`] : []),
      '### 当前 Epic 的 Stories（requirementRefs 只能引用这些）',
      ...(node.stories.length
        ? node.stories.map(
            story =>
              `- ${story.id} ${story.title}${story.description ? `：${story.description}` : ''}${
                story.acceptance.length ? `｜验收：${story.acceptance.join('；')}` : ''
              }`
          )
        : ['（无 Story）']),
      '### 相关实体（模块共享实体池）',
      ...(relatedEntities.length
        ? relatedEntities.map(entity => `- ${entity.id}｜${entity.name}｜${entity.status}`)
        : ['（暂无）']),
      '### 相关页面集',
      ...(relatedSets.length
        ? relatedSets.map(set => `- ${set.id}｜${set.title}｜${set.status}｜页面 ${set.pages.length}`)
        : ['（暂无）']),
      '### 生成建议',
      '- 可按当前 Epic 生成/补充实体（合并进模块实体池）与一个页面集（页面按 Story）；不要删除其它 Epic 的设计。',
      '- 对话里修改时只输出当前 Epic 相关实体/页面集，并保留未改对象。'
    ].join('\n')
  }
  if (focus.kind === 'pageSet' || focus.kind === 'page') {
    const set =
      focus.kind === 'page'
        ? project.pageSets.find(item => item.pages.some(page => page.id === focus.id))
        : project.pageSets.find(item => item.id === focus.id)
    if (!set) return ''
    const page = focus.kind === 'page' ? set.pages.find(item => item.id === focus.id) : undefined
    return [
      '## 当前聚焦页面集',
      `- id：${set.id}；标题：${set.title}；场景：${set.sceneKey}；状态：${set.status}`,
      '### 页面',
      ...set.pages.map(
        item =>
          `- ${item.id}｜${item.pageKey}｜${item.type}｜${item.title}｜实体 ${item.entityId || '-'}｜状态 ${item.status}｜动作 ${
            item.spec.actions?.join('/') || '-'
          }`
      ),
      ...(page
        ? [
            '## 当前聚焦页面',
            `- id：${page.id}；标题：${page.title}；类型：${page.type}；实体：${page.entityId || '-'}`,
            `- 页面规格：${JSON.stringify(page.spec).slice(0, 4000)}`
          ]
        : [])
    ].join('\n')
  }
  return ''
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

/** 设计对话：需求文档 + 模板 + 当前实体/页面 + 聚焦对象 + DESIGN_JSON 协议 */
export function buildDesignChatPrompt(context: DesignChatContext, messages: ChatMessageInput[]): string {
  const { project } = context
  const parts: string[] = [
    '以下是一次设计阶段协作请求。你是设计 Agent，负责把已确认需求转成“应用级实体设计 + 页面原型规格”。',
    '只输出给用户的简短中文回复与协议 JSON；不要读取/创建/修改文件，不要执行命令。',
    '产出只包含两个用户可见产物：实体设计、页面原型；不要输出服务/流程/权限/字典/NFR 等其他设计面板。'
  ]

  parts.push(['## 需求来源（已确认需求 + 设计输入快照）', inputBrief(project)].join('\n'))
  parts.push(['## 原型模板（决定页面集/布局/风格）', templateBrief(project.template)].join('\n'))
  parts.push(
    ['## 当前实体设计（应用级共享）', entitiesBrief(project.entities), '## 当前页面集', pageSetsBrief(project.pageSets)].join('\n')
  )

  const focus = focusBrief(project, context.focus)
  if (focus) parts.push(focus)

  parts.push(...historyParts(messages))

  parts.push(
    [
      '## 输出协议',
      '先输出给用户的简短中文回复（1—4 句），再单独一行输出',
      DESIGN_DELIMITER,
      '最后输出一个合法 JSON 对象（JSON 之后不要再输出分隔符、代码块或解释）：',
      '{',
      '  "entities": [{',
      '    "id": "ent-xxx（可省略；修改已有实体时必须保留原 id）",',
      '    "name": "订单", "tableName": "biz_order", "description": "订单主表",',
      '    "requirementRefs": ["STORY-001"], "sourceSections": ["epics", "rules"],',
      '    "fields": [{ "name": "orderNo", "label": "订单号", "type": "string", "required": true, "unique": true, "length": 32 }],',
      '    "relations": [{ "name": "订单明细", "type": "one-to-many", "target": "ent-yyy" }]',
      '  }],',
      '  "pageSets": [{',
      '    "id": "ps-xxx（可省略；修改已有页面集时必须保留原 id）",',
      '    "sceneKey": "EPIC-001（没有 Epic 时用 SCENE-001）", "epicId": "EPIC-001", "storyIds": ["STORY-001", "STORY-002"], "title": "订单管理",',
      '    "pages": [{',
      '      "id": "pg-xxx（可省略；修改已有页面时必须保留原 id）",',
      '      "pageKey": "order-list", "title": "订单列表", "type": "list", "entityId": "ent-xxx",',
      '      "requirementRefs": ["STORY-001"],',
      '      "spec": { "actions": ["create","edit","delete","detail"], "columns": ["orderNo"], "searchFields": ["orderNo"], "acceptance": ["能按条件查询订单"] }',
      '    }, {',
      '      "pageKey": "order-create", "title": "创建订单", "type": "form", "entityId": "ent-xxx",',
      '      "requirementRefs": ["STORY-001"],',
      '      "spec": { "mode": "create", "fields": ["orderNo"], "actions": ["submit","cancel"] }',
      '    }, {',
      '      "pageKey": "order-edit", "title": "编辑订单", "type": "form", "entityId": "ent-xxx",',
      '      "requirementRefs": ["STORY-001"],',
      '      "spec": { "mode": "edit", "fields": ["orderNo"], "actions": ["submit","cancel"] }',
      '    }]',
      '  }],',
      '  "nextSteps": [{ "label": "补充订单字段", "prompt": "请补充订单实体的金额、状态、下单时间字段" }],',
      '  "openIssues": { "add": [{ "question": "..." }] },',
      '  "actions": [{ "label": "生成页面集" }]',
      '}',
      '规则：',
      '- 实体是应用级共享的；新增/修改实体时输出完整 entities 数组（不要只给被改的那个），并保留未改实体的 id；',
      '- 每个实体必须带 requirementRefs（只能引用设计输入里的 SCENE-/EPIC-/STORY- 稳定 ID）与 sourceSections（如 epics/rules）；找不到依据时写 openIssues，不要编造；',
      '- 实体 name 用业务中文名（如 订单），tableName 用英文表名（如 biz_order）；',
      '- 页面集按 Epic 组织：epicId/sceneKey 使用 EPIC-xxx（没有 Epic 时用 SCENE-xxx），title 用 Epic/场景名称；不要用 entity:<id>；',
      '- 一个页面集可以包含多个实体页面（例如订单管理场景同时有订单页面和订单明细页面），实体只作为页面的数据来源；',
      '- 每个页面集必须带 storyIds（该 Epic 下的 STORY-xxx）；每个页面必须带 requirementRefs（STORY-xxx），不能为空；',
      '- 每个场景默认包含列表/创建表单/编辑表单/详情；表单页 spec.mode 必须写 create 或 edit；',
      '- 修改页面集时输出完整 pageSets 数组并保留未改 id；',
      '- 字段类型只能是 string/text/number/decimal/date/datetime/time/boolean/enum/ref；ref 字段用 ref 指向实体 id；',
      '- 页面类型只能是 list/form/detail/dashboard/kanban/gantt/calendar；页面必须绑定 entityId（页面集里引用的实体必须存在）；',
      '- spec 中的 fields/actions/columns/searchFields 必须是字符串数组（如 ["orderNo"]），不要输出 [{name:...}] 对象数组；',
      '- 只输出有实际修改的顶层键；没有修改时只返回 nextSteps/openIssues；',
      '- 信息不足处写入 openIssues，不要编造业务规则；',
      '- nextSteps 给 1—4 条可执行下一步，每条带一句可直接发送的 prompt。'
    ].join('\n')
  )

  return parts.join('\n\n')
}

/** 实体初稿生成（一次性 JSON 任务） */
export function buildEntityGenerationPrompt(project: DesignProjectPayload): { system: string; user: string } {
  const system = [
    '你是设计阶段的实体建模助手。只输出一个合法 JSON 对象，不要 markdown 围栏、不要解释。',
    '任务：从已确认需求（设计输入快照，含 Scene/Epic/Story 稳定 ID）中抽取应用级共享实体（表/字段/关系），供页面原型和后续开发使用。',
    '输出结构：{ "entities": [{ "name": "...", "tableName": "...", "description": "...", "requirementRefs": ["STORY-001"], "sourceSections": ["epics","rules"], "fields": [{ "name": "...", "label": "...", "type": "string", "required": true, "unique": false, "options": [], "ref": "", "note": "" }], "relations": [{ "name": "...", "type": "one-to-many", "target": "实体 name 或 id" }] }] }',
    '规则：',
    '- requirementRefs 只能使用设计输入里出现的 STORY-/EPIC-/SCENE- 稳定 ID；没有依据的实体可以留空数组，但需在 description 或 openIssues 说明待确认；',
    '- sourceSections 使用需求章节 key（如 epics、rules、pages）；',
    '- 字段类型只能是 string/text/number/decimal/date/datetime/time/boolean/enum/ref；',
    '- 实体 name 用业务中文名（如 订单），tableName 用英文表名（如 biz_order）；',
    '- 每个实体至少 3 个业务字段，包含主键语义字段（如 id 或业务编号）；',
    '- 关系目标使用实体 name（后续由系统解析为 id）；',
    '- 不要输出与实体无关的服务/页面/权限/NFR；',
    '- 需求信息不足时保留最小实体并写 description 说明待确认。'
  ].join('\n')
  const user = [
    inputBrief(project),
    '## 原型模板',
    templateBrief(project.template),
    '## 已有实体（如需保留请沿用）',
    entitiesBrief(project.entities),
    '请输出完整实体设计 JSON。'
  ].join('\n\n')
  return { system, user }
}

/** 页面集生成（一次性 JSON 任务） */
export function buildPageSetGenerationPrompt(project: DesignProjectPayload): { system: string; user: string } {  const system = [
    '你是设计阶段的页面原型助手。只输出一个合法 JSON 对象，不要 markdown 围栏、不要解释。',
    '任务：按 Epic 生成页面集与页面规格，默认包含列表/创建表单/编辑表单/详情；页面必须绑定已有实体。',
    '输出结构：{ "pageSets": [{ "sceneKey": "EPIC-001", "epicId": "EPIC-001", "storyIds": ["STORY-001"], "title": "订单管理", "pages": [{ "pageKey": "...", "title": "...", "type": "list|form|detail", "entityId": "ent-xxx", "requirementRefs": ["STORY-001"], "spec": { "mode": "create|edit（仅 form）", "actions": [], "columns": [], "searchFields": [], "acceptance": [], "notes": "" } }] }] }',
    '规则：',
    '- 页面集按 Epic 组织：epicId/sceneKey 必须来自设计输入的 EPIC-xxx（没有 Epic 时用 SCENE-xxx），title 用 Epic/场景名称；不要按实体建页面集；',
    '- 一个页面集可以引用多个实体；storyIds 必须是该 Epic 下的 STORY-xxx；',
    '- 每个页面必须带 requirementRefs（STORY-xxx），不能为空；',
    '- 每个页面集至少包含一个 list 页面；创建表单和编辑表单是两个 form 页面，spec.mode 分别为 create/edit；',
    '- 页面字段只能引用绑定实体的字段 name；',
    '- 实体 name 用业务中文名，tableName 用英文表名；spec 中的 fields/actions/columns/searchFields 必须是字符串数组，不要输出对象数组；',
    '- 列表页需要 searchFields 和 columns；表单页需要 actions ["submit","cancel"]；详情页需要 actions ["edit","back"]；',
    '- 页面规格中的文字用业务语言，不要写代码/接口；',
    '- 严格遵循原型模板的页面集规则与风格提示。'
  ].join('\n')
  const user = [
    inputBrief(project),
    '## 原型模板',
    templateBrief(project.template),
    '## 应用级实体（页面必须绑定这些实体）',
    entitiesBrief(project.entities),
    '## 已有页面集（如需保留请沿用 id）',
    pageSetsBrief(project.pageSets),
    '请输出完整页面集 JSON。'
  ].join('\n\n')
  return { system, user }
}

/** D-RMP：当前 Epic/场景上下文（prompt 共用，只含本节点 + Stories） */
function epicBrief(node: DesignEpicNode, project: DesignProjectPayload): string {
  const scene =
    !node.isScene && node.sceneId ? project.input?.scenes.find(item => item.id === node.sceneId) : undefined
  return [
    `## 当前 ${node.isScene ? '场景（fallback，无 Epic）' : 'Epic'}`,
    `- id：${node.id}`,
    `- 标题：${node.title}`,
    ...(node.goal ? [`- 目标：${node.goal}`] : []),
    ...(node.priority ? [`- 优先级：${node.priority}`] : []),
    ...(scene ? [`- 归属场景：${scene.id} ${scene.title}`] : []),
    `### 当前 ${node.isScene ? '场景' : 'Epic'} 的 Stories（requirementRefs 只能引用这些）`,
    ...(node.stories.length
      ? node.stories.map(
          story =>
            `- ${story.id} ${story.title}${story.description ? `：${story.description}` : ''}${
              story.acceptance.length ? `｜验收：${story.acceptance.join('；')}` : ''
            }`
        )
      : ['（无 Story；如果信息不足请保留最小实体/页面并说明待确认）'])
  ].join('\n')
}

/** D-RMP：按 Epic 生成实体（只输出本 Epic 需要新增/变更的实体，后端合并进模块实体池） */
export function buildEpicEntityGenerationPrompt(
  project: DesignProjectPayload,
  node: DesignEpicNode
): { system: string; user: string } {
  const system = [
    '你是设计阶段的实体建模助手（按 Epic 生成）。只输出一个合法 JSON 对象，不要 markdown 围栏、不要解释。',
    '任务：只为“当前 Epic/场景”补充/更新模块共享实体（表/字段/关系）；复用模块已有实体，不要按 Epic 重复建表。',
    '输出结构：{ "entities": [{ "id": "已有实体 id（更新时必须保留）", "name": "...", "tableName": "...", "description": "...", "requirementRefs": ["STORY-001"], "sourceSections": ["epics","rules"], "fields": [{ "name": "...", "label": "...", "type": "string", "required": true, "unique": false, "options": [], "ref": "", "note": "" }], "relations": [{ "name": "...", "type": "one-to-many", "target": "已有实体 id 或实体 name" }] }] }',
    '规则：',
    '- 只输出当前 Epic/场景需要新增或变更的实体；不要输出与当前 Epic 无关的实体、服务、页面、权限、NFR；',
    '- 复用已有实体时保留原 id 与 name；更新时给出该实体的完整字段/关系（后端会与已有字段/关系按名称合并，未提及的不删除）；',
    '- 不要输出删除指令；不要指望删除其它 Epic 的实体；',
    '- requirementRefs 只能引用当前 Epic/场景及其 Stories 的稳定 ID；',
    '- sourceSections 使用需求章节 key（如 epics、rules、pages）；',
    '- 字段类型只能是 string/text/number/decimal/date/datetime/time/boolean/enum/ref；',
    '- 实体 name 用业务中文名（如 订单），tableName 用英文表名（如 biz_order）；',
    '- 关系目标优先用已有实体 id，或使用实体 name（后端会解析）；',
    '- 每个新增实体至少 3 个业务字段，包含主键语义字段（如 id 或业务编号）；',
    '- 需求信息不足时保留最小实体并写 description 说明待确认。'
  ].join('\n')
  const user = [
    epicBrief(node, project),
    '## 设计输入（模块上下文；其它 Epic/Stories 仅用于复用实体与关系判断，不要为它们输出实体）',
    inputBrief(project),
    '## 原型模板（仅参考风格，不要输出页面）',
    templateBrief(project.template),
    `## 模块现有实体（复用请保留 id/name；共 ${project.entities.length} 个）`,
    entitiesBrief(project.entities),
    '请输出本 Epic 需要新增/变更的实体 JSON。'
  ].join('\n\n')
  return { system, user }
}

/** D-RMP：按 Epic 生成一个页面集（页面按 Story；页面只能绑定 mergedEntities 里的实体） */
export function buildEpicPageSetGenerationPrompt(
  project: DesignProjectPayload,
  node: DesignEpicNode,
  mergedEntities: DesignEntity[]
): { system: string; user: string } {
  const epicKey = node.isScene ? '' : node.id
  const sceneKey = node.id
  const existingPrimary = project.pageSets.find(set => pageSetBelongsToEpic(set, node))
  const system = [
    '你是设计阶段的页面原型助手（按 Epic 生成）。只输出一个合法 JSON 对象，不要 markdown 围栏、不要解释。',
    '任务：只为“当前 Epic/场景”生成一个页面集与页面规格，页面覆盖当前 Epic 的 Stories；页面必须绑定下面列出的模块实体。',
    `输出结构：{ "pageSets": [{ "sceneKey": "${sceneKey}", "epicId": ${epicKey ? `"${epicKey}"` : 'null'}, "storyIds": ["STORY-001"], "title": "...", "description": "...", "pages": [{ "pageKey": "...", "title": "...", "type": "list|form|detail", "entityId": "ent-xxx", "requirementRefs": ["STORY-001"], "spec": { "mode": "create|edit（仅 form）", "actions": [], "columns": [], "searchFields": [], "fields": [], "acceptance": [], "notes": "" } }] }] }`,
    '规则：',
    `- 只输出一个页面集；sceneKey 必须是 ${sceneKey}${epicKey ? `、epicId 必须是 ${epicKey}` : '、epicId 必须是 null（fallback 场景）'}；不要输出其它 Epic 的页面集；`,
    ...(node.stories.length
      ? [`- storyIds 必须包含当前 Epic 下全部 Story：${node.stories.map(story => story.id).join('、')}；`]
      : ['- 没有 Story 时 storyIds 输出空数组，页面 requirementRefs 输出空数组；']),
    '- 每个页面必须绑定页面上方列出的实体（entityId 用实体 id）；页面字段只能引用绑定实体的字段 name；',
    '- 每个页面集至少包含一个 list 页面；创建表单和编辑表单是两个 form 页面，spec.mode 分别为 create/edit；',
    '- 列表页需要 searchFields 和 columns；表单页需要 actions ["submit","cancel"]；详情页需要 actions ["edit","back"]；',
    '- 页面 requirementRefs 使用当前 Epic 的 STORY-xxx；不要引用其它 Epic 的 Story；',
    '- spec 中的 fields/actions/columns/searchFields 必须是字符串数组，不要输出对象数组；',
    '- 页面规格中的文字用业务语言，不要写代码/接口；',
    '- 严格遵循原型模板的页面集规则与风格提示。'
  ].join('\n')
  const user = [
    epicBrief(node, project),
    '## 原型模板',
    templateBrief(project.template),
    '## 可绑定实体（页面只能使用这些实体）',
    entitiesBrief(mergedEntities),
    ...(existingPrimary
      ? [
          '## 该 Epic 当前页面集（本次会整体替换其页面；页面集 id 由后端保留）',
          pageSetsBrief([existingPrimary])
        ]
      : []),
    '请输出当前 Epic 的页面集 JSON（只一个页面集）。'
  ].join('\n\n')
  return { system, user }
}
