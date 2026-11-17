# 需求阶段文档化重构方案（讨论稿）

日期：2026-11-10
状态：**需求阶段方案已定稿（2026-11-10），待实施 R1**。上游背景：`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md`、`docs/test-issues-2026-11-09.md` I-05/I-08/I-11。
参考：OmniFlow 需求文档页（左侧对话 + 构建活动/下一步，右侧模板化 PRD 文档，模板中心）；模板提示词来自 `C:\Users\icecream\Desktop\ai优化建议\` 下的 Generic PRD、Business Strategy、Generic QA/Test Plan。

### 定稿决策（2026-11-10）

- 文档/章节是需求阶段唯一事实来源；整篇 Markdown 是章节拼接快照。
- 章节化持久化：`app_requirement_doc_sections` + 版本快照；不使用卡片/场景树。
- 不做存量兼容；提供删除应用入口，旧应用由用户删除。
- 编辑器：Markdown 章节编辑器 + 预览/源码模式，不做 WYSIWYG。
- 模板：全局库 + 应用只保存模板 id；参考后重新设计，不照搬；先做需求阶段模板。
- 标准 PRD 采用 13 节；精简 PRD 一起设计；Business Strategy / QA Test Plan 作为后续阶段模板。
- 待澄清不硬阻塞；场景树移除，场景进入“业务场景与流程”章节。
- 每章节提供“问 AI”，对话焦点定位到章节，默认只改该章节。
- Epics & User Stories 作为设计阶段需求点来源。

---

## 1. 目标与非目标

### 1.1 目标

1. 需求阶段从“场景树 + 需求点卡片”改为“**对话 + 模板化需求文档**”：
   - 左侧保留 AI 对话，并增加“构建活动/接下来做什么”提示列表（I-05/I-08 的延续）。
   - 右侧展示一份可编辑的 Markdown 需求文档，按模板结构生成。
2. 首次描述需求后，AI 基于所选模板生成需求文档初稿；后续对话可让 AI 修改文档，也可以直接手动编辑。
3. 模板中心：内置模板（PRD、Business Strategy、QA/Test Plan 等）、搜索/分类、预览、复制并编辑、新建模板；修改后保存为新模板。
4. 需求完成条件从“卡片确认”改为“文档已生成 + 必填章节完整 + 用户确认”；完成后进入设计阶段。
5. 设计阶段继续使用结构化 Spec，但输入来自需求文档（而不是卡片/场景树）。

### 1.2 非目标（本期不做）

- 不做多人协作/实时协同编辑。
- 不做富文本 WYSIWYG 的完整能力（先做 Markdown 编辑器 + 预览 + 工具栏）。
- 不做模板市场/公开分享/审核；先做“内置 + 我的模板”。
- 不改变设计阶段的结构化 Spec 和开发阶段的原生 build 会话。
- 不把模板编辑做成完整的低代码 DSL；模板 = 章节结构 + 撰写提示词。

---

## 2. 目标体验

### 2.1 页面布局

```text
┌───────────────────────────────┬──────────────────────────────────────────┐
│ 左：AI 对话                    │ 右：需求文档                              │
│                               │                                          │
│ 对话历史                       │ [模板：Generic PRD ▾]  [已保存] [版本]    │
│                               │ [H1][B][I][列表][引用][AI 编辑]           │
│ ── 构建活动 ──                 │                                          │
│ ✓ 已收到请求                   │ # 产品需求文档 - 多级组织 CRM 系统        │
│ ✓ 已选择模板                   │ 产品：...  作者：...  日期：...           │
│ ● 需求文档已创建（待审核）      │                                          │
│ ○ 待确认需求                   │ ## 问题与机会                             │
│                               │ ...                                      │
│ ── 接下来做什么 ──             │ ## 目标用户与用户画像                      │
│ ▸ 细化权限模型                 │ ...                                      │
│ ▸ 补充非功能需求               │                                          │
│ ▸ 确认 Epics & 用户故事        │ [确认需求]  [生成设计 →]                  │
│                               │                                          │
│ [输入框]                       │ 大纲 / 版本历史 / 待澄清                   │
└───────────────────────────────┴──────────────────────────────────────────┘
```

- 场景树/批次/卡片不再作为需求阶段主界面；文档大纲取代场景树。
- 右侧文档是需求阶段的“唯一产出物”；对话只负责生成/修改它。
- 小屏：左侧对话可折叠，右侧文档全宽；文档大纲可抽屉。

### 2.2 首次进入与生成流程

1. 新应用进入需求阶段：
   - 若未选择模板，先弹出模板选择（默认 Generic PRD；可预览/切换）。
   - 显示空状态：“描述你要做的产品，AI 会按模板生成需求文档初稿。”
2. 用户首条需求描述（可以很粗）：
   - AI 返回：简短澄清 + 一份**完整文档初稿**（基于模板；信息不足处写“待确认”并进入待澄清列表）。
   - 右侧文档自动创建；左侧“构建活动”变为“需求文档已创建（待审核）”。
3. 后续每轮：
   - 用户说“把权限模型细化”“补充非功能需求”等，AI 返回**文档修改提案**；
   - 右侧显示 diff（应用/忽略），应用后文档版本 +1；
   - 用户也可以直接编辑 Markdown，自动保存。
4. 用户点击“确认需求”：
   - 校验必填章节非空 + 至少一个 Epics/User Story + 用户确认；
   - 待澄清问题作为警告，不硬性阻塞（可配置）；
   - 进入设计阶段。

### 2.3 左侧“构建活动”和“接下来做什么”

- 构建活动（确定性状态）：
  1. 已收到请求
  2. 已选择模板
  3. 需求文档已创建
  4. 文档待审核/已确认
  5. 可生成设计
- 接下来做什么（建议）：
  - 来源 A：模板中必填但为空的章节（如“目标与指标”“Epics & 用户故事”）。
  - 来源 B：文档中的“待确认/TODO”标记与 openIssues。
  - 来源 C：AI 返回的 `nextSteps`（1—4 条），每条带可发送的 prompt。
  - 点击项直接作为用户消息发送，或聚焦到对应章节。
- 与 I-05 的关系：需求阶段不再按场景显示待澄清，而是按“文档章节 + 待澄清问题”显示；如果保留场景/Epic 视图，作为文档大纲的一部分。

### 2.4 章节“问 AI”（本次新增）

每个大章节标题右侧提供 `问 AI`：

- 点击后把当前对话焦点设为该章节，composer 显示 `当前章节：问题与机会`，placeholder 变为 `针对「问题与机会」提问…`。
- 用户消息带上 `focusSectionKey`；后端构建 prompt 时注入：
  - 当前章节的标题、撰写提示、正文；
  - 文档标题/模板/其他章节标题（不注入全文，避免干扰）；
  - “默认只修改当前章节；如必须改其他章节，先说明原因”。
- AI 返回章节级修改提案（或全文 diff），用户应用后只更新该章节。
- 用户可以随时清除焦点，回到全文对话。
- 左侧“构建活动/接下来做什么”仍然可用；点击建议项也可以自动定位到对应章节。
- 对话消息记录 `focusSectionKey`，刷新后仍能看到“针对某章节”的标记。

焦点是“对话上下文”，不是权限：用户仍可以让 AI 跨章节修改，但 AI 必须显式说明。

---

## 3. 模板模型（重新设计，不照搬）

### 3.1 结论：参考后重新设计，不照搬

你给的三个模板是很好的参考，但不建议原样照搬：

- `Generic PRD Document` 覆盖了问题、用户、指标、Epics/Stories、架构，适合作为**产品级 PRD**；但缺少工作台后续设计需要的：范围/非目标、业务规则与数据要求、页面/交互、非功能需求、验收标准、待澄清问题。
- `Business Strategy` 是公司战略文档，不是可以直接进入设计的需求文档；可以作为“业务策略”类模板保留，但不应作为需求阶段默认模板。
- `Generic QA / Test Plan` 属于测试阶段模板，应该放在“QA/测试计划”分类，需求阶段不默认展示。

因此建议：**保留它们的结构和语气作为参考，由工作台设计自己的模板体系**。原因：

1. 工作台模板要有稳定章节 ID、必填标记、撰写提示，才能支持模板切换、章节“问 AI”、完成校验和设计映射。
2. 需求文档要能自然衔接到设计阶段（Epics/User Stories → 设计单元），而通用 PRD 的结构不足以直接约束设计。
3. 中英文模板的提示词要按团队习惯重写，避免直接复制带来的版权/风格问题。

### 3.2 模板分类

模板按阶段区分，模板中心先展示“需求阶段”：

| 阶段 | 模板 | 用途 | 本期 |
| --- | --- | --- | --- |
| 需求 | 工作台标准 PRD（默认） | 从想法到可设计的完整需求文档 | ✅ |
| 需求 | 精简 PRD | 小功能/MVP，章节更少 | ✅ |
| 需求 | 业务策略 | 产品方向/商业论证，不直接进设计 | ✅（可选） |
| 设计 | 技术设计 / 架构方案 | 设计阶段参考 | 后续 |
| 测试 | QA / Test Plan | 测试阶段 | 后续 |
| 开发 | Development Task Breakdown | 开发计划 | 后续 |

本期只实现“需求阶段”模板；其他阶段模板可以出现在模板中心但标注“后续/暂不可用”，避免和需求模板混在一起。

### 3.3 工作台标准 PRD（推荐默认）

目标：一页需求文档，既能给人看，也能被设计 agent 直接消费。

| # | 章节 | 类型 | 必填 | 内容提示 |
| --- | --- | --- | --- | --- |
| 1 | 文档信息 | meta | 是 | 产品名、作者、日期、版本、状态 |
| 2 | 问题与机会 | markdown | 是 | 背景、痛点、为什么现在做 |
| 3 | 目标与成功指标 | metrics | 是 | 业务目标、可量化指标、非目标 |
| 4 | 用户与角色 | roles | 是 | 角色、画像、业务权限/数据范围 |
| 5 | 范围与约束 | markdown | 是 | 本期做/不做、假设、依赖、限制 |
| 6 | 业务场景与流程 | scenes | 是 | 场景清单、用户旅程、关键状态 |
| 7 | Epics & User Stories | epics | 是 | 每个 Epic 下的故事、验收标准、优先级 |
| 8 | 业务规则与数据要求 | rules | 是 | 业务实体/字段（业务语言）、规则、校验、状态流转 |
| 9 | 页面与交互需求 | pages | 否 | 页面清单、动作、状态、空/错/加载 |
| 10 | 非功能需求 | nfr | 否 | 性能、安全、兼容性、可用性 |
| 11 | 待澄清问题 | issues | 否 | 未决问题；不阻塞确认，但进入设计前要可见 |
| 12 | 术语表 | glossary | 否 | 业务术语 |
| 13 | 验收标准 | acceptance | 是 | 整体验收清单，能对应到 Epics/Stories |

说明：

- **场景不再独立成树**，而是“业务场景与流程”章节下的 `### 场景`；场景的细化内容进入对应 Epic/Story。
- **Epics & User Stories 是设计阶段的需求点来源**；设计阶段按 Epic/Story 建立设计单元。
- 章节类型先支持 `markdown`、`metrics`、`roles`、`epics`、`rules`、`pages`、`nfr`、`issues`、`glossary`、`acceptance`；MVP 可先全部按 markdown 渲染 + 结构化编辑器逐步补齐。Epics 建议优先结构化，因为它是设计映射的关键。
- 精简 PRD：文档信息、问题与机会、目标与指标、用户与角色、Epics & Stories、验收标准（6 节），适合小应用。

### 3.4 模板数据结构

```ts
interface RequirementTemplate {
  id: string
  name: string
  stage: 'requirements' | 'design' | 'test' | 'dev-plan'
  category: string
  description: string
  prompt: string            // 模板提示词（给 AI 的总说明）
  sections: Array<{
    id: string               // 稳定 key，如 problem / goals / epics
    title: string
    level: 2 | 3
    kind: 'markdown' | 'meta' | 'metrics' | 'roles' | 'scenes' | 'epics' | 'rules' | 'pages' | 'nfr' | 'issues' | 'glossary' | 'acceptance'
    guidance: string         // 该章节写什么（给 AI 的提示）
    required: boolean
  }>
  builtin: boolean
  visibility: 'builtin' | 'private'
  createdAt: string
  updatedAt: string
}
```

- 模板编辑器：名称/阶段/分类/描述 + 章节列表（标题、层级、类型、撰写提示、是否必填、排序、删除）+ 提示词预览。
- 内置模板只读；“复制并编辑”生成我的模板，修改后保存为新模板。
- 模板中心按阶段/分类/搜索筛选；需求阶段只允许选择 `stage=requirements` 的模板。

### 3.5 模板选择与切换

- 新应用首次进入需求阶段选择模板；默认 Generic PRD。
- 文档已存在时切换模板：
  - 提示“切换模板会重新生成文档结构，当前内容可能被覆盖”；
  - 提供“保留当前内容并只换模板元数据”（不现实）或“生成新版本”（推荐）；
  - 推荐：切换后生成新文档版本，旧版本保留在历史中，可回滚。

---

## 4. 需求文档模型

### 4.1 文档内容与持久化

结论：**文档按“章节”持久化，章节是唯一事实来源；整篇 Markdown 是章节的确定性拼接和快照**。

原因：

- 每个大章节要支持“问 AI”并定位到该章节；如果只存一整段 Markdown，手动改标题后很难稳定定位。
- 章节级 AI 修改、章节完整度、模板必填校验都需要稳定的 section key。
- 版本历史/交接包需要整篇快照；用章节拼装可以保证导出稳定。

章节结构：

```ts
interface RequirementDocSection {
  sectionKey: string       // 模板定义，如 problem / goals / epics；用户新增为 custom-xxx
  title: string
  level: 2 | 3
  kind: TemplateSectionKind
  markdown: string         // 本章节正文（GFM）
  required: boolean
  position: number
}
```

- 文档头（标题、产品名、作者、日期、模板名、版本）作为文档元数据，不占正文章节。
- 章节正文是 Markdown；Epics、角色、指标等类型可以有结构化编辑器，但最终都渲染为 Markdown。
- 整篇 `content_md` 由章节按 position 拼接生成，缓存到文档行，供导出/交接包/搜索；不是人工维护的第二份内容。
- 手动编辑按章节保存；高级“全文源码模式”可以把整篇 Markdown 解析回章节（按标题匹配模板 sectionKey），匹配失败的新标题作为 `custom-*` 章节。
- 待确认：用 `> 待确认：...` 标记，同时进入 `openIssues`；不阻塞确认。

### 4.2 手动编辑

- 右侧文档编辑器默认“章节编辑”：
  - 左侧文档大纲（模板章节 + 完整度）；中间章节列表；每个章节一个 Markdown 编辑块/工具栏；
  - 顶部工具栏：标题、粗体、斜体、列表、引用、代码、链接、AI 编辑、保存状态；
  - 自动保存（debounce 800ms—1.5s），显示“已保存/保存中”；
  - 预览切换（编辑/分栏/预览）；
  - 版本历史：每次手动保存/AI 应用生成版本；可查看 diff/回滚。
- 高级“源码模式”：整篇 Markdown 编辑，保存时按标题解析回章节；解析失败时提示并允许保留为自由章节。
- 手动编辑不会触发 AI；用户可继续对话让 AI 修改。

### 4.3 AI 生成/修改

- 首次：AI 根据模板 + 用户描述生成完整文档。
- 后续：AI 返回修改提案（推荐全文 diff；后续可做章节级 patch）。
- 应用方式：
  - 右侧显示 diff（新增/删除/修改）；
  - 用户“应用修改/忽略/只应用本节”（先做应用全部/忽略）；
  - 应用后版本 +1，历史可回滚。
- 保护手动编辑：AI 修改基于当前文档生成，不直接覆盖；必须经过 diff 确认。
- AI 不能删除用户手动添加的章节/内容，除非用户明确要求；diff 中明确显示。

### 4.4 文档状态

```text
draft（生成中/编辑中） → review（可审核） → confirmed（已确认）
```

- 生成初稿后为 `draft`；用户点“提交审核”或“确认需求”后 `review/confirmed`。
- 确认后仍可修改？建议：确认后进入设计阶段；如需修改，回到需求阶段（状态回 `draft`），设计阶段的 Spec 不受影响但交接包需重新生成。

---

## 5. AI 协议（文档模式）

新增文档模式，避免与设计阶段的 `patch/patches` 混用：

```text
<<<DOC_JSON>>>
{
  "doc": "完整 Markdown 文档",          // 首次生成或全文修改时
  "sections": [                          // 可选：章节级修改（后续优化）
    { "id": "problem", "markdown": "..." }
  ],
  "title": "产品需求文档 - ...",
  "nextSteps": [
    { "label": "细化权限模型", "prompt": "请细化系统管理员/组织管理员/HR 的权限模型" }
  ],
  "openIssues": { "add": [{ "question": "..." }], "resolve": [{ "id": "...", "answer": "..." }] },
  "actions": [{ "label": "应用修改" }, { "label": "忽略" }]
}
```

- 前端解析：`doc` 存在 → 生成全文 diff 提案；`sections` → 按章节合并；`nextSteps` → 左侧建议；`openIssues` → 待澄清。
- 首次生成必须返回 `doc`；后续可以只返回 `sections`/`nextSteps/openIssues`（无文档变化）。
- 请求增加 `focusSectionKey`：后端在 prompt 中注入该章节标题、撰写提示、正文，并要求“默认只修改当前章节”。
- 系统提示词包含：模板结构/提示词、当前文档（或当前章节 + 其他章节标题）、用户输入、对话历史、输出协议。
- 校验：Markdown 非空、必填章节存在、没有把整篇文档包在代码块里（或解析时剥离）。

---

## 6. 数据模型与 API

### 6.1 表

```sql
requirement_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stage TEXT NOT NULL,                   -- requirements | design | test | dev-plan
  category TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,                  -- 模板总提示词
  sections_json TEXT NOT NULL,           -- 章节 id/title/level/kind/guidance/required
  builtin INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

app_requirement_docs (
  app_id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content_md TEXT NOT NULL,              -- 章节拼接后的缓存/快照，不是人工维护的主数据
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | review | confirmed
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT
);

app_requirement_doc_sections (
  app_id TEXT NOT NULL,
  section_key TEXT NOT NULL,             -- 模板稳定 key；用户新增为 custom-xxx
  title TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 2,
  kind TEXT NOT NULL,                    -- markdown | meta | metrics | roles | scenes | epics | rules | pages | nfr | issues | glossary | acceptance
  markdown TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (app_id, section_key)
);

app_requirement_doc_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  template_id TEXT NOT NULL,
  content_md TEXT NOT NULL,              -- 整篇快照
  sections_json TEXT NOT NULL,           -- 章节快照（用于回滚/按章节 diff）
  source TEXT NOT NULL,                  -- ai | manual | template-change
  created_at TEXT NOT NULL
);
```

- 内置模板启动时 seed；`app_requirement_docs` 一行/应用。
- **章节表是唯一事实来源**；`content_md` 由章节拼接，供导出/交接包/搜索。
- 文档版本同时保存整篇和章节快照，支持整篇 diff 与章节回滚。
- 不再兼容旧卡片/场景数据：新应用只使用文档模式；旧应用删除即可（提供删除应用入口）。设计阶段可保留 `modules/module_docs` 作为“设计单元/结构化 Spec”存储，但不再使用 `moduleCard`/场景树。
- 应用删除：现有 `DELETE /api/apps/:id?confirm=true` 已有后端实现；补前端删除入口（列表/详情），删除前二次确认。

### 6.2 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/requirement-templates?stage=requirements` | 模板列表（阶段/分类/搜索/内置/我的） |
| POST | `/api/requirement-templates` | 新建模板 |
| PUT | `/api/requirement-templates/:id` | 保存我的模板 |
| DELETE | `/api/requirement-templates/:id` | 删除我的模板（内置不可删） |
| POST | `/api/requirement-templates/:id/duplicate` | 复制为新模板 |
| GET | `/api/apps/:id/requirements-doc` | 文档 + 模板 + 状态 + 版本 + 章节 |
| PUT | `/api/apps/:id/requirements-doc/sections/:key` | 手动保存单章节（自动保存复用） |
| PUT | `/api/apps/:id/requirements-doc` | 高级全文保存（解析回章节） |
| POST | `/api/apps/:id/requirements-doc/generate` | 生成初稿（模板 + 描述，SSE 或普通） |
| POST | `/api/apps/:id/chat` | 增加 `mode:'doc'`、`templateId`、`focusSectionKey`；走短暂会话 + SSE |
| POST | `/api/apps/:id/requirements-doc/confirm` | 确认需求（校验必填章节） |
| GET | `/api/apps/:id/requirements-doc/versions` | 版本列表 |
| GET | `/api/apps/:id/requirements-doc/versions/:v` | 版本内容/diff |
| POST | `/api/apps/:id/requirements-doc/versions/:v/rollback` | 回滚到版本 |
| DELETE | `/api/apps/:id?confirm=true` | 删除应用（已有后端，补前端入口） |

- 生成/修改仍走现有短暂 opencode 会话 + SSE；文档模式使用 `<<<DOC_JSON>>>`。
- 自动保存用章节 PUT；AI 应用修改也落章节 PUT + source=ai。
- 确认校验：必填章节非空、至少一个 Epics/User Story（PRD）或模板定义的等价内容；openIssues 作为 warnings。

---

## 7. 与设计阶段/交接包的衔接

### 7.1 设计阶段输入与设计单元

- 文档模式下，设计阶段读取：
  - 文档标题、模板、章节列表；
  - 重点章节：Epics & User Stories、用户与角色、业务规则与数据要求、页面与交互、非功能需求；
  - 待澄清问题（作为设计提示，不阻塞）。
- 不再读卡片/场景。设计阶段把文档中的 Epic/User Story（或章节）转成“设计单元”：
  - 复用现有 `modules`/`module_docs` 作为设计单元的 Spec 存储（去掉 `moduleCard`/场景树语义，增加 `doc_section_key`/`epic_key`）；
  - 设计单元名称/编码来自 Epic/Story；没有 Epics 的模板按章节/功能块生成设计单元；
  - 设计待办按设计单元显示“未拆解/拆解中/已拆解/无需拆解”。
- 设计 agent 的 prompt 增加文档章节内容 + Epic/Story 清单，要求“按文档拆解，不自行扩展范围”。
- 拆解结果仍按现有 `patch/patches` 结构化协议落 Spec。

### 7.2 交接包

- `01-REQUIREMENTS.md`：直接使用已确认的需求文档（可加生成元数据/章节索引），不再从卡片重新拼装。
- `00-README.md`：范围/完成定义从文档提取。
- `02-DESIGN.md` / `03-PLAN.md`：仍由设计 Spec 确定性生成。
- 交接包校验：
  - 文档模式：必填章节 + 确认状态；设计 Spec 引用完整性仍按原规则。
  - 不再保留旧结构化模式的完成校验；旧应用直接删除。
- 设计完成仍要求交接包校验通过；待澄清作为警告。

### 7.3 设计待办（承接 I-08）

- 设计页按文档中的 Epic/User Story 或需求点显示：
  - 未拆解 / 拆解中 / 已拆解 / 无需拆解；
  - 规格计数/确认率；
  - 操作：开始拆解/继续/查看。
- 设计完成前展示交接包 readiness（阻塞错误 vs 警告）。
- 这是 I-08 的延续；文档模式只改变“需求点来源”，不改变设计 Spec 结构。

---

## 8. 迁移与兼容（不做存量兼容）

### 8.1 新应用

- 只使用文档模式：进入需求阶段先选模板，再生成文档；场景树/卡片 UI 不再显示。
- 文档大纲 + Epics/Stories 取代场景树；场景是“业务场景与流程”章节的子标题。

### 8.2 存量应用

- 不兼容旧卡片/场景数据。提供删除应用入口：
  - 现有 `DELETE /api/apps/:id?confirm=true` 后端已实现；
  - 前端在首页/应用详情补“删除应用”按钮，二次确认后删除本地目录/登记/会话/交接包；
  - 用户可自行删除存量应用，或由工作台提供一键清理。
- 旧 `modules/moduleCard/scene` 相关 UI/逻辑在文档模式中下线；设计阶段只用 `modules/module_docs` 存设计单元 Spec。

### 8.3 旧模板系统

- 现有 `docTemplates`（Spec 章节模板）不再作为需求模板；新需求模板中心独立。
- 旧模板数据可保留但不再展示；后续清理。
- 设计/测试/开发阶段模板后续另做，不与需求模板混用。

---

## 9. 实施拆分（建议）

| 阶段 | 内容 | 说明 |
| --- | --- | --- |
| R1 | 需求文档 MVP：模板表/文档表/章节表/API；模板中心；章节 Markdown 编辑器；首次 AI 生成；自动保存；确认需求；删除应用入口 | 新应用可用；至少支持“文档 → 01-REQUIREMENTS”只读导出 |
| R2 | 章节“问 AI”焦点 + AI 修改 diff/版本 + 左侧构建活动/下一步 + 模板复制编辑 | 核心体验完整 |
| R3 | 设计阶段读取文档/Epics；设计单元/待办；交接包 `01-REQUIREMENTS` 改用文档 | 打通下游 |
| R4 | 清理旧场景/卡片/旧模板 UI 与代码；删除/归档测试数据 | 不做存量迁移 |

建议先做 R1+R2 验证需求阶段体验，再打通 R3。R1 至少要支持“文档 → 01-REQUIREMENTS”的只读导出，避免设计阶段仍依赖旧卡片。

---

## 10. 验收标准

- 新应用进入需求阶段可以选择/预览模板；模板中心可搜索、分类、复制编辑、新建。
- 首次描述需求后生成完整 Markdown 文档，结构符合模板；右侧可编辑、自动保存。
- 用户可通过对话让 AI 修改文档，修改以 diff 呈现，应用/忽略可控；手动编辑不被静默覆盖。
- 左侧显示构建活动状态和“接下来做什么”建议，点击可继续对话。
- 文档版本历史可查看/回滚。
- 必填章节缺失时“确认需求”给出明确提示；确认后进入设计。
- 每个章节可“问 AI”定位，焦点清晰；AI 修改以 diff 呈现，手动编辑不被静默覆盖。
- 设计阶段能读取文档并拆解；交接包 `01-REQUIREMENTS.md` 与文档一致。
- 首页/应用详情可删除应用（二次确认），删除后目录/登记/会话/交接包清理。
- 无真实凭据写入文档；Markdown 渲染禁用原始 HTML。

---

## 11. 已确认 / 待确认

### 11.1 已确认（2026-11-10）

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 文档是否唯一事实来源 | **是**。章节表是唯一事实来源；整篇 Markdown 是拼接/快照；卡片/场景树下线。 |
| 2 | 存量数据兼容 | **不做**。旧应用删除（提供删除应用入口），不迁移卡片/场景。 |
| 3 | 编辑器 | **Markdown 章节编辑器 + 预览 + 源码模式**，不做 WYSIWYG。 |
| 4 | 模板范围 | **全局模板库 + 应用只保存模板 id**。 |
| 5 | 待澄清是否阻塞 | **不硬阻塞**，作为警告/待办。 |
| 6 | 场景树 | **移除**；场景变成“业务场景与流程”章节下的子标题。 |
| 7 | 模板来源 | **参考后重新设计，不照搬**；按阶段分类，先做需求阶段模板。 |
| 8 | 章节“问 AI” | **做**；点击后对话焦点定位到该章节，默认只改该章节。 |

### 11.2 需要你确认的模板内容

1. **工作台标准 PRD 的章节**（13 节）是否合适？是否要精简为 10 节以内？
2. **Epics & User Stories 是否作为设计需求点来源**？建议是。
3. **“业务场景与流程”作为章节**是否满足你对“场景”的预期？场景不再有独立树。
4. **精简 PRD** 是否本期一起做，还是只做标准 PRD？
5. **Business Strategy / QA Test Plan** 是否先作为“后续阶段模板”展示，不可在需求阶段选择？

### 11.3 待确认（实现细节）

1. 章节级 AI 修改的 diff 粒度：只显示当前章节 diff，还是整篇 diff？建议默认当前章节，全文兜底。
2. `modules/module_docs` 作为设计单元存储是否可接受，还是新建 `design_units`？
3. 文档确认后回到需求阶段修改时，设计阶段 Spec 是否保留？建议保留，但交接包需重新生成。
4. 是否支持从文档直接生成测试用例/测试计划？（后续）

---

## 12. R2a 落地记录（2026-11-11）

R2a 已完成（见 `docs/plans/2026-11-11-r2a-implementation-brief.md`、`docs/STATUS.md`「R2a 完成」）：

- AI 修改改为“先预览后应用”：`POST /api/apps/:id/requirements-doc/preview` 复用保存解析但不写库/不产版本；章节级勾选 + 行级 diff + 应用/忽略；建议随对话消息持久化并带 `baseVersion`。
- `PUT /api/apps/:id/requirements-doc` 支持 `removeSectionKeys`：仅删除 `custom-*` 且非必填章节，必填/模板章节忽略并 warning，与章节更新同一版本。
- `requirements-doc` 全部端点与 `chat mode='doc'` 增加 `requirements_mode='doc'` 守卫（旧 structured 应用 409，不创建文档行）。
- 使用中的需求模板禁止删除（400）；模板编辑器支持章节增删/排序/类型/必填/提示，key 新增时输入、保存后只读。
- R2b 已在下一轮完成（自动保存不产版本、来源化 checkpoint、手动保存版本、建议消息裁剪），见本文 §13 与 `docs/STATUS.md`「R2b 完成」。

---

## 13. R2b 落地记录（2026-11-11）：需求文档版本策略

R2b 已完成（见 `docs/plans/2026-11-11-r2b-implementation-brief.md`、`docs/STATUS.md`「R2b 完成」）：

- **版本 = checkpoint**：章节自动保存（含结构化章节）只更新内容/`updated_at`，不产版本；模板切换、AI 建议应用、确认需求、版本回滚、变更取消恢复、手动“保存版本”生成来源化版本。`saveDocSection` 的 `snapshot` 默认 false，显式 `true` 仍可强制快照；全文保存/AI 应用默认 snapshot true。
- **确认需求必产 `confirm` 版本**（即使内容未变）：`startChangeSet` 的 `base_requirements_version` 因此指向已确认内容，取消变更可按基线快照恢复；重复确认幂等。
- **手动“保存版本”**：`POST /api/apps/:id/requirements-doc/versions` 把当前服务器内容快照为 `manual` 版本（+1）；前端先 flush 未保存编辑；已确认文档 409（确认版本已存在，需先重新编辑）。
- **版本可追溯**：版本列表/详情返回 `changeSetId/changeSetSeq`（LEFT JOIN `app_change_sets`），UI 显示 `变更 #N`；来源标签：确认需求 / AI 应用 / 模板切换 / 版本回滚 / 变更取消恢复 / 手动保存。
- **保留策略**：本期不删除任何版本；真实使用观察后再评估裁剪/压缩。
- **建议消息裁剪**：AI 建议随对话消息持久化前删除行级 `lineDiff`（保留 `markdownBefore`/`markdown`/applied/ignored），加载后按 `markdownBefore`/`markdown` 重算 modified 的 diff；应用载荷不变。
- **R2a UX 修复**：stale/只读建议允许“忽略”（仅 streaming/applied/ignored 禁用）；应用建议前先比较 `baseVersion`，一致后再 flush，flush 后再校验一次，变化则提示重新生成，不静默应用。
- 设计版本/交接包版本、`base_design_version`/取消恢复语义未改，留 **R2c**（排在 I-10 之后）。

