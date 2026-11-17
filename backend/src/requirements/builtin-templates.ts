/**
 * 内置需求模板（R1）
 *
 * 参考 Generic PRD / Business Strategy / Generic QA Test Plan 的结构与语气后重新设计：
 * - 标准 PRD（13 节，默认）与精简 PRD（6 节）用于需求阶段；
 * - 业务策略属于需求阶段的可选模板，但不直接进入设计；
 * - QA / Test Plan 属于测试阶段，需求阶段不可选。
 *
 * 内置模板只读；用户复制后另存为“我的模板”。
 */
import type { RequirementTemplate, TemplateSectionDef } from './types'

function section(
  id: string,
  title: string,
  kind: TemplateSectionDef['kind'],
  guidance: string,
  required: boolean,
  level: 2 | 3 = 2
): TemplateSectionDef {
  return { id, title, level, kind, guidance, required }
}

const PRD_PROMPT = `你是资深产品经理，负责把用户的想法整理成可直接进入设计阶段的 PRD。
原则：
- 只写文档里能验证的事实；信息不足时写 \`> 待确认：...\`，不要编造业务规则。
- 业务语言优先，不写代码、不写表结构、不写接口路径（这些留给设计阶段）。
- Epics & User Stories 是设计阶段的需求点来源，每个 Epic 至少一个用户故事，故事要有验收标准。
- 保持章节结构与模板一致；不要新增或删除模板章节，除非用户明确要求。
- 默认只修改用户当前聚焦的章节；如必须改动其他章节，先说明原因。`

const PRD_LITE_PROMPT = `你是资深产品经理，负责把一个小功能/MVP 的想法整理成精简 PRD。
原则：
- 只保留必要章节：文档信息、问题与机会、目标与指标、用户与角色、Epics & Stories、验收标准。
- 信息不足写 \`> 待确认：...\`；不要编造。
- Epics & Stories 是设计阶段的需求点来源，每个故事写清验收标准。
- 默认只修改用户当前聚焦的章节。`

const STRATEGY_PROMPT = `你是产品战略顾问，负责整理业务策略文档（业务方向/商业论证），不直接产出可开发需求。
原则：
- 写清市场机会、目标客户、价值主张、商业模式、关键指标与路线图。
- 不写页面/接口/数据表；需要落地时提示用户改选标准 PRD。
- 信息不足写 \`> 待确认：...\`。`

const QA_PROMPT = `你是测试负责人，负责整理 QA / 测试计划。
原则：
- 写清测试范围、策略、环境、用例与风险；用例要可执行、可验证。
- 不修改需求/设计文档；发现需求缺口时列入风险与待确认。`

export const BUILTIN_TEMPLATES: RequirementTemplate[] = [
  {
    id: 'builtin-prd',
    name: '工作台标准 PRD',
    stage: 'requirements',
    category: '产品需求',
    description: '从想法到可设计的完整需求文档，13 个章节，适合大多数业务系统。',
    prompt: PRD_PROMPT,
    builtin: true,
    visibility: 'builtin',
    createdAt: '',
    updatedAt: '',
    sections: [
      section('meta', '文档信息', 'meta', '产品名、作者、日期、版本、状态；用列表或表格写清。', true),
      section('problem', '问题与机会', 'markdown', '背景、用户痛点、为什么现在做、不做的后果。', true),
      section('goals', '目标与成功指标', 'metrics', '业务目标、可量化指标（含口径/目标值）、非目标。', true),
      section('users', '用户与角色', 'roles', '角色清单、用户画像、业务权限与数据范围。', true),
      section('scope', '范围与约束', 'markdown', '本期做/不做、假设、依赖、限制（合规/预算/时间）。', true),
      section('scenes', '业务场景与流程', 'scenes', '场景清单、用户旅程、关键状态与异常分支；场景作为本节的子标题。', true),
      section('epics', 'Epics & User Stories', 'epics', '每个 Epic 下的用户故事、验收标准、优先级；这是设计阶段的需求点来源。Epic 目标只写 1—3 句业务目标，不要把 Story 列表塞进目标。', true),
      section('rules', '业务规则与数据要求', 'rules', '业务实体/字段（业务语言）、规则、校验、状态流转。', true),
      section('pages', '页面与交互需求', 'pages', '页面清单、主要动作、状态、空/错/加载。', false),
      section('nfr', '非功能需求', 'nfr', '性能、安全、兼容性、可用性、可维护性。', false),
      section('issues', '待澄清问题', 'issues', '未决问题；不阻塞确认，但设计前应可见。用 `- 待确认：...` 记录。', false),
      section('glossary', '术语表', 'glossary', '业务术语与定义，避免歧义。', false),
      section('acceptance', '验收标准', 'acceptance', '整体验收清单，能对应到 Epics/Stories。', true)
    ]
  },
  {
    id: 'builtin-prd-lite',
    name: '精简 PRD',
    stage: 'requirements',
    category: '产品需求',
    description: '小功能/MVP 用的 6 节需求文档，保留设计阶段必需信息。',
    prompt: PRD_LITE_PROMPT,
    builtin: true,
    visibility: 'builtin',
    createdAt: '',
    updatedAt: '',
    sections: [
      section('meta', '文档信息', 'meta', '产品名、作者、日期、版本、状态。', true),
      section('problem', '问题与机会', 'markdown', '背景、痛点、为什么现在做。', true),
      section('goals', '目标与指标', 'metrics', '业务目标与可量化指标。', true),
      section('users', '用户与角色', 'roles', '角色与权限范围。', true),
      section('epics', 'Epics & Stories', 'epics', 'Epic、用户故事、验收标准、优先级。Epic 目标只写 1—3 句业务目标，不要把 Story 列表塞进目标。', true),
      section('acceptance', '验收标准', 'acceptance', '整体验收清单。', true)
    ]
  },
  {
    id: 'builtin-business-strategy',
    name: '业务策略',
    stage: 'requirements',
    category: '业务策略',
    description: '产品方向/商业论证，不直接进入设计；需要开发时请改用标准 PRD。',
    prompt: STRATEGY_PROMPT,
    builtin: true,
    visibility: 'builtin',
    createdAt: '',
    updatedAt: '',
    sections: [
      section('meta', '文档信息', 'meta', '文档名称、作者、日期、版本。', true),
      section('summary', '执行摘要', 'markdown', '一段话说明方向、目标客户与预期结果。', true),
      section('market', '市场与机会', 'markdown', '市场趋势、目标客户、竞争格局、机会点。', true),
      section('value', '价值主张与商业模式', 'markdown', '解决什么问题、为什么是我们、如何创造价值。', true),
      section('metrics', '关键指标', 'metrics', '阶段性指标与口径。', true),
      section('roadmap', '路线图', 'markdown', '阶段目标、里程碑、依赖。', false),
      section('risks', '风险与假设', 'markdown', '关键假设、风险与应对。', false)
    ]
  },
  {
    id: 'builtin-qa-test-plan',
    name: 'QA / 测试计划',
    stage: 'test',
    category: '测试计划',
    description: '测试范围、策略、环境、用例与风险；需求阶段不可选。',
    prompt: QA_PROMPT,
    builtin: true,
    visibility: 'builtin',
    createdAt: '',
    updatedAt: '',
    sections: [
      section('meta', '文档信息', 'meta', '被测版本、作者、日期、环境。', true),
      section('scope', '测试范围', 'markdown', '被测功能/不测范围、进入与退出条件。', true),
      section('strategy', '测试策略', 'markdown', '测试类型、优先级、自动化策略。', true),
      section('cases', '测试用例', 'markdown', '按功能列用例：前置条件、步骤、预期结果。', true),
      section('environments', '测试环境与数据', 'markdown', '环境、账号、测试数据准备。', false),
      section('risks', '风险与待确认', 'issues', '风险、阻塞项、需要产品确认的问题。', false)
    ]
  }
]

export const DEFAULT_TEMPLATE_ID = 'builtin-prd'
