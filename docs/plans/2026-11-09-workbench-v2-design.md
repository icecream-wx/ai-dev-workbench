# 智能开发工作台 v2 设计

日期：2026-11-09（北京时间）
状态：方向已确认（需求/设计 A、开发 B；其余按推荐默认）；P0—P5 已完成（真实应用 + MySQL 空/非空 E2E + 用户确认完成；遗留真实模型需求/设计重跑、Nacos/Redis/license、真实 401/403 权限、打磨）。验证记录见 `docs/STATUS.md`。
新项目目录：`E:\work_space_primeton\ai-dev-workbench`
代码来源：`E:\work_space_primeton\requirements-grooming`（已复制需求/设计部分）
参考实现：`E:\work_space_primeton\primeton-agent-capabilities\workbench-stub`（只复用 opencode 客户端与展示组件）
后端模板：用户提供的 `eos-demo.zip`，已脱敏放入 `templates/eos-app/`

> **历史说明（2026-11-11，R4b-2）**：本文档中 P3 旧交接包（`/api/apps/:id/handoff`、4 份 Markdown + `schema.sql`、`modules`/`handoffs` 表）与 P1 workspace/modules 接口已被文档模式需求（R1）、设计 Studio（D1—D4）与设计交接包（D5）取代，相关代码/表/旧应用已在 R4b-1/R4b-2 删除。当前实现以 `docs/STATUS.md` 与 `docs/plans/2026-11-11-design-to-development-handoff.md` 为准。

---

## 1. 结论摘要

1. **新工作台是一个三阶段应用**：创建应用 → 需求 → 设计 → 开发；前一阶段由用户确认后才能进入下一阶段。
2. **需求、设计、开发统一由 opencode 提供模型运行时**：
   - 需求/设计：使用 opencode 会话 + 自定义 `req`/`design` agent + 一次性 prompt + SSE 文本流；保留现有需求/设计的 prompt 与 `<<<SPEC_JSON>>>` 协议，只替换底层传输。
   - 开发：使用 opencode 原生 `build` agent + 原生会话、SSE、权限/表单、取消；不注入自定义 skill/提示词/固定骨架/批次/证据/Git 流程。
3. **需求/设计的唯一最终产出是“开发交接包”**：由 Spec 确定性生成 4 份 Markdown 文档（+ 可选参考 DDL；OpenAPI 在没有确定性契约时不生成），写入应用目录 `docs/handoff/`。
4. **开发阶段不做用户可见的“批次/需求选择”**：一个应用就是一次开发；设计确认时把该应用全部已确认需求/设计一次性生成交接包。
5. **应用 = 一个独立目录**：`projects/<app-id>/`，包含 `docs/handoff/`、`backend/`（EOS demo 模板）、`frontend/`（由 agent 创建）、最小 `AGENTS.md`。
6. **开发界面重新设计**，参考 Codex App / opencode-web 的个人 vibe coding 体验；不复用旧工作台三栏 UI，只复用时间线/工具卡/权限表单等低层组件。

---

## 2. 背景与目标

### 2.1 背景

- 旧方向：需求 Agent → 批次 → 固定 Vue3 + Spring Boot + Cloud 骨架 → dev Agent 按批次开发 → Git/证据/性能验收。已完成 `workbench-stub` 雏形，但流程义务重、默认路径慢、页面与个人 vibe coding 体验差距大。
- 新方向：把“需求/设计”做成人友好的结构化工作台，把“开发”交还给 opencode 原生 agent；工作台只控制需求输入和最终确认，不控制开发过程。

### 2.2 目标

- 用户进入工作台先创建应用，然后按“需求 → 设计 → 开发”渐进推进。
- 需求/设计阶段尽量复用 `requirements-grooming` 已有的场景/需求点/Spec/设计图谱/原型/测试用例能力。
- 需求/设计阶段结束后，一键生成开发所需全部材料，不需要用户再选需求、选批次。
- 开发阶段像个人 vibe coding：大对话区、工具调用、代码 diff、文件变化、权限询问、随时打断/追加、用户确认完成。
- 后端默认参考 EOS demo 的工程结构和最小 pom 依赖；前端只告知 Vue3，不强制结构。
- 尽可能轻：不做 Git 强制流程、不做交付证据门禁、不做固定业务骨架、不做自定义开发 agent。

### 2.3 非目标

- 不做多用户、容器调度、租户、权限系统（后续产品化再考虑）。
- 不做用户可见的批次/需求选择/需求版本对比。
- 不做独立的测试阶段与测试交接；测试用例只作为交接包的验收材料。
- 不做开发过程的自动验收门禁；是否完成由用户确认。
- 不强制 Git 提交、不强制推送、不强制证据文件。
- 不把旧工作台的批次/证据/Git 面板搬进新 UI。

---

## 3. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│  浏览器：新工作台前端（Vue3 + Vite + Element Plus + Pinia）   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ 应用列表/创建 │  │ 需求 / 设计   │  │ 开发（vibe coding）│  │
│  └──────────────┘  └──────────────┘  └────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTP / SSE（工作台自己的 API）
┌───────────────────────────▼──────────────────────────────────┐
│  工作台后端（Express + SQLite）                               │
│  ├─ apps / stages / modules / module_docs / app_sessions      │
│  ├─ handoff：Spec → 开发交接包（确定性渲染 + 校验）           │
│  ├─ project：应用目录、EOS 模板渲染、docs 写入                │
│  └─ opencode runtime：serve 生命周期、会话、SSE、权限/表单    │
└───────────────────────────┬──────────────────────────────────┘
                            │ Basic Auth + /api/*
┌───────────────────────────▼──────────────────────────────────┐
│  opencode serve（固定 v2.2.5，一个进程服务多个项目目录）      │
│  ├─ 需求/设计：req/design agent + prompt + SSE（短暂会话）    │
│  └─ 开发：build agent + 原生会话 + 工具循环 + 权限/表单/取消  │
└──────────────────────────────────────────────────────────────┘
```

关键边界：

- 工作台不代理模型 API Key；模型/provider 由 opencode 自己的配置管理。
- 工作台不改变开发 agent 的推理、工具选择、计划、验证方式。
- 工作台只负责：应用与阶段、需求/设计数据、交接包、项目目录、opencode 会话 UI、用户确认。

---

## 4. 应用与阶段模型

### 4.1 应用

- 进入工作台先看到应用列表；点击“新建应用”创建。
- 一个应用对应一个独立目录：`projects/<app-id>/`。
- 应用有唯一 `app-id`（URL/目录安全）、名称、描述、后端端口、创建时间、状态。
- 应用状态：

```text
requirements → design → development → completed
```

- 阶段完成由用户确认；服务端做基本校验，不用模型判断“做完了没有”。

### 4.2 渐进式阶段

顶部固定三段进度：

```text
[需求 ✓] ── [设计 ●] ── [开发 🔒]
```

- 当前阶段可编辑；已完成阶段可回看；未解锁阶段不可点击。
- “完成本阶段”按钮：
  1. 弹窗说明本阶段将冻结/产出什么。
  2. 用户确认后服务端校验。
  3. 校验通过后更新状态，并弹窗询问“是否立即进入下一阶段？”：
     - 完成并进入下一阶段
     - 仅完成，稍后继续
     - 取消
- 需求阶段完成条件（建议）：
  - 至少 1 个需求点；每个需求点有目标、角色、验收要点；用户已确认。
- 设计阶段完成条件（建议）：
  - 交接包校验通过（引用完整、关键项已确认、无阻塞性开放问题）。
  - 生成交接包并写入应用目录。
- 开发阶段完成条件：
  - 由用户点击“确认完成”；记录完成时间与最后会话 ID。
  - 不要求 Git、证据、测试门禁。

### 4.3 关于“批次”

- 用户界面中**没有批次概念**：不显示批次条、不选择批次、不按批次过滤。
- 为降低改造风险，v1 可以在内部保留一个隐式“单批次”承载现有 requirements-grooming 的 Spec 结构；但所有批次 UI/操作/状态规则移除。
- 后续 P2 再把内部批次结构清理掉，统一为“应用级需求/设计”。

---

## 5. 数据模型（SQLite）

### 5.1 新增/调整

```sql
apps (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  description            TEXT,
  dir                    TEXT NOT NULL,
  backend_port           INTEGER NOT NULL DEFAULT 8081,
  status                 TEXT NOT NULL DEFAULT 'requirements',
  requirements_confirmed_at TEXT,
  design_confirmed_at    TEXT,
  development_started_at TEXT,
  completed_at           TEXT,
  handoff_hash           TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

-- 现有 modules 增加 app 归属；新库直接建列，旧库用迁移补列
ALTER TABLE modules ADD COLUMN app_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX idx_modules_app ON modules(app_id, created_at);

app_sessions (
  id                 TEXT PRIMARY KEY,
  app_id             TEXT NOT NULL,
  stage              TEXT NOT NULL,           -- requirements | design | development
  opencode_session_id TEXT,
  provider_id        TEXT,
  model_id           TEXT,
  status             TEXT NOT NULL DEFAULT 'idle',
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  last_active_at     TEXT
);

handoffs (
  app_id       TEXT PRIMARY KEY,
  version      INTEGER NOT NULL,
  hash         TEXT NOT NULL,
  docs_dir     TEXT NOT NULL,
  files_json   TEXT NOT NULL,
  source_spec  TEXT NOT NULL,                 -- 生成时的 Spec 快照
  created_at   TEXT NOT NULL
);

app_stage_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id    TEXT NOT NULL,
  stage     TEXT NOT NULL,
  event     TEXT NOT NULL,                    -- confirmed / generated / completed ...
  detail    TEXT,
  created_at TEXT NOT NULL
);
```

### 5.2 应用级设置键

现有 `app_settings` 是 key-value。把工作区设置改为应用级键：

- `app.<appId>.scenes`
- `app.<appId>.activeId`
- `app.<appId>.conversation`
- `app.<appId>.model`（需求/设计/开发分别可选：`app.<appId>.model.requirements` 等）
- 旧全局键保留只读兼容，不做迁移（新项目从空库开始）。

### 5.3 数据隔离取舍

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| 单库 + `app_id`（推荐） | 改动小；查询简单；一个 SQLite 文件备份 | 应用数据不随应用目录走 |
| 每应用一个 SQLite | 应用目录自包含；隔离彻底 | 需要重构现有 `db` 单例、连接管理、所有查询 |

v1 推荐单库 + `app_id`；应用目录只放代码和交接文档。若后续要求“应用目录自包含需求数据”，再迁移到每应用 SQLite。

---

## 6. 需求/设计 AI 统一到 opencode

### 6.1 现状

`requirements-grooming` 的 AI Chat：

- 前端 `streamChat()` → `POST /api/llm/chat`；
- 后端 `llm.ts` → OpenAI 兼容 `POST {baseURL}/chat/completions`；
- 配置来自 `.env` 或数据库设置 `{baseURL, apiKey, model}`；
- 需求/设计 prompt 与 `<<<SPEC_JSON>>>` 协议在 `conversation/prompt.ts` / `protocol.ts`；
- `agents/decompose.ts`、`testgen.ts` 也走同一套 OpenAI 兼容配置。

**结论：它只能配置 OpenAI 兼容地址，不能直接指向 opencode。** opencode serve 的 OpenAPI 中没有 `/v1/chat/completions`，只有会话/消息/生成类接口。因此需要替换传输层，而不是改一个 baseURL。

> 2026-11-09 P2 已完成替换：前端 `opencodeChat()` → `POST /api/apps/:id/chat`（短暂会话 + prompt + SSE）；`/api/llm`、`/api/settings/llm` 已删除。

### 6.2 统一方案（推荐）

用 **opencode 短暂会话 + prompt + SSE** 承载需求/设计对话：

```text
浏览器 → 工作台后端 /api/apps/:id/chat
  → 创建 opencode 会话（location = 应用目录，agent = req/design）
  → 发送一条 prompt（包含：当前应用上下文 + 当前 Spec + 最近对话 + 用户输入）
  → 订阅 /api/event，收集 assistant 文本增量
  → 工作台后端把文本增量以 SSE 转发给浏览器
  → 前端用现有 <<<SPEC_JSON>>> 协议解析并应用
  → 删除短暂会话
```

要点：

- 保留 `buildSystemPrompt` 与 `protocol.ts`，只把“LLM 调用”换成 opencode 会话调用。
- 每轮新建会话，天然无历史污染、无旧 Spec 上下文；与现有“每轮发送完整 system + history”的行为一致。
- 后端把前端传入的 `messages` 拼成一个 prompt：`[系统指令] ... [对话历史] ... [本轮用户输入] ...`；不依赖 opencode 会话历史。
- 使用自定义 `req` / `design` agent（primary，禁止 bash/edit/write；是否允许 read 待验证），避免模型在需求/设计聊天时改文件。
- 模型来自 opencode `/api/model`；默认来自 `/api/model/default`。P5 后续调整为：未显式选择时优先跟随 opencode CLI 最近会话使用的模型，其次才是 `/api/model/default`；`OPENCODE_DEFAULT_MODEL` 仍作为显式覆盖。工作台不再保存 LLM API Key。
- 设置面板从“API 地址/Key/模型”改为“选择 opencode 模型”。
- 工作台 SSE 帧建议：`{"type":"delta","text":"..."}`、`{"type":"done"}`、`{"type":"error","message":"..."}`；前端用新的 `opencodeChat()` 替换现有 `streamChat()` 的 OpenAI 帧解析。

### 6.3 为什么不用 `/generate`

本机 v2.2.5 有 `POST /api/session/{id}/generate`（“Generate transient text from the current session context without mutating session history”），听起来很适合需求/设计聊天。实测流程：

1. 创建会话；
2. `POST /synthetic {resume:false}` 写入上下文；
3. `POST /generate` 提问。

结果：`/context` 为空，`/generate` 返回 `Unknown`。说明 synthetic + `resume:false` 并不会直接进入 `/generate` 的可用上下文，至少当前版本不能按这个方式使用。

**决定：v1 不使用 `/generate` + synthetic 作为主路径；使用“短暂会话 + prompt + SSE”。** 若后续确认 `/generate` 的正确用法，可作为降低会话开销的优化。

### 6.4 自定义 req / design agent

在应用目录 `.opencode/agents/` 放置两个 agent（由工作台创建应用时生成）：

```markdown
---
description: 需求/设计对话 Agent，只输出文本 + 协议 JSON，不修改文件
mode: primary
tools:
  bash: false
  edit: false
  write: false
---
（简短说明：你只负责需求/设计对话；不要读取或修改项目文件；严格按用户消息中的协议输出。）
```

- 具体禁用哪些工具以 v2.2.5 实际 agent schema 为准；实现前先用 `/api/agent` 验证。
- 开发阶段不加载这两个 agent 作为主 agent；开发使用原生 `build`。

### 6.5 其他 LLM 调用

- `agents/decompose.ts`、`testgen.ts`、评审等所有 LLM 调用，统一改为调用同一个 `OpencodeRuntime.generateText()`（短暂会话 + prompt + 收集文本）。
- 这样需求、设计、任务拆解、测试用例生成都使用 opencode 的 provider/model，不再保留第二套 OpenAI 兼容配置。
- 如果某个任务需要 JSON 模式，继续在 prompt 里要求“只输出 JSON”，后端正则/解析重试。

### 6.6 需求/设计运行时的三种选择（已确认：A）

| 维度 | A. 短暂会话 + 专用 agent（推荐） | B. 原生 build 会话 | C. 原生会话 + 专用 agent（折中） |
| --- | --- | --- | --- |
| 产出质量 | 高：每轮注入最新 Spec + 严格协议 + 校验 + 重试 | 中/低：通用代码 agent，容易漂移、跑题、调用无关工具 | 中/高：专用 agent，但上下文管理更复杂 |
| 上下文新鲜度 | 每轮都是最新 Spec | 依赖会话历史，Spec 变化后容易旧 | 需要每轮注入/压缩，否则旧 |
| 工具噪音 | 无（req/design agent 禁用写/shell） | 有：build 会读文件、跑命令、请求权限 | 可禁用，但失去“原生会话”的部分意义 |
| 权限/表单 | 不需要；用现有 `openIssues` + actions 按钮更合适 | 原生支持，但多是文件/命令权限，与需求澄清无关 | 原生但通常用不上 |
| 流式/取消 | 支持 SSE + interrupt | 原生 | 原生 |
| 会话连续性 | 工作台自己持久化对话；用户看到连续会话 | opencode 原生会话 | opencode 原生会话 |
| 实现复杂度 | 中 | 低（复用开发） | 高 |
| 适用 | 需求/设计 v1 | 开发 | 团队坚持“会话为主”时 |

**2026-11-09 用户确认：需求/设计采用 A，开发采用 B。** 理由：

1. 需求/设计的核心是结构化收敛，每轮必须基于最新 Spec 产出严格 JSON；A 每轮注入最新 Spec，B 依赖长会话历史容易旧。
2. build agent 是代码执行导向，可能读仓库/跑命令/请求权限，把“需求讨论”变成“改代码”；权限/表单对需求澄清不是核心交互，现有 `openIssues` + actions 更合适。
3. A 在产品层仍是“会话为主”：工作台持久化对话/diff/actions/撤销，用户看到连续聊天；只是底层 opencode 会话短暂。
4. C 可作为“必须原生会话连续性”时的折中，但需要每轮注入/压缩上下文，复杂度高；建议 A 跑通后再评估。

实现上保留 `ConversationRuntime` 抽象：`structuredTurn()` 对应 A；以后要 C 再加 `sessionTurn()`，不推翻需求/设计 UI。

---

## 7. 开发交接包

### 7.1 目标

设计阶段完成时，把该应用**全部已确认**的需求/设计内容确定性生成一套文档，让开发 agent 只读这套文档就能开始开发，不需要再回工作台或数据库。

### 7.2 文件结构

写入 `projects/<app-id>/docs/handoff/`：

```text
docs/handoff/
  00-README.md
  01-REQUIREMENTS.md
  02-DESIGN.md
  03-PLAN.md
  openapi.yaml        # 可选
  schema.sql          # 可选
  prototype/          # 可选：设计阶段已有原型时导出
```

### 7.3 各文档内容

#### `00-README.md`

- 应用标识、名称、生成时间、来源 Spec 版本。
- 一句话目标。
- 范围 / 不做什么（防止 scope creep）。
- 技术栈与工程约束：
  - 后端：Java + EOS 9.0.0；`backend/` 是参考起点，pom 最小依赖见 `backend/pom.xml`。
  - 前端：Vue 3；结构由 agent 决定。
  - 不强制目录结构；不强制使用某个 UI 库。
  - 不提交 DB/Nacos/Redis/邮件等真实凭据。
- 阅读顺序：`01 → 02 → 03`。
- 完成定义：
  - P0/P1 需求点已实现；
  - 构建通过；
  - 关键接口/页面自测通过；
  - 输出实现摘要、关键文件、运行方式、自测结果、未解决事项。
- 交付方式：直接在项目里实现，不要只输出代码片段。

#### `01-REQUIREMENTS.md`

- 业务目标、背景、范围、不包含。
- 角色清单。
- 需求点清单：ID、标题、优先级、确认状态、验收摘要。
- 每个需求点：
  - 业务目标；
  - 参与角色；
  - 业务规则（自然语言）；
  - 验收标准（可验证，逐条）；
  - 边界/异常。
- 术语表。
- 开放问题：标明“未确认，不要自行决定”；如果影响实现，开发 agent 应先问用户。

#### `02-DESIGN.md`

- 数据模型：实体、字段、类型、必填、校验、唯一/范围/默认值、关系；附 Mermaid ER 图。
- 枚举/数据字典。
- 接口/服务：按资源/动作描述；可附 OpenAPI；不要求具体 Controller 类名。
- 页面/路由：页面类型、承载字段、动作、状态（加载/空/错误）、校验、交互。
- 业务流程：步骤、参与角色、分支条件。
- 角色与权限：功能权限 + 数据范围。
- 业务规则/触发器：公式、状态推导、系统自动行为。
- 外部集成。
- 非功能需求：性能、安全、兼容性、可用性。
- 设计约束/假设。

#### `03-PLAN.md`

- 建议实施顺序（不强制）。
- 测试清单：来自设计阶段测试用例；每条含前置条件、步骤、预期。
- 验收清单：逐条对应需求点。
- 风险/未决问题。
- 开发完成时的交付格式。

### 7.4 生成原则

1. **确定性渲染**：不在导出时调用 LLM；直接由 Spec 结构渲染，避免文档漂移。
2. **只导出已确认项**：`status=confirmed`；草稿/未确认项进入开放问题，不混入正式需求。
3. **自包含**：不出现工作台数据库 ID、页面路由、内部术语；使用业务语言 + 稳定编号（FEAT-001、API-001、PAGE-001）。
4. **验收可执行**：每个需求点至少一条可验证验收标准；没有的先回需求阶段补。
5. **不过度指定实现**：给数据/接口/页面/规则约束，不写 Java 类名、Vue 组件名；项目结构由 agent 决定。
6. **控制长度**：4 份文档合计建议 500—1000 行；避免旧工作台“读 70 个文件”的成本。
7. **可选机读产物**：只有设计阶段能确定性生成时才输出 OpenAPI/DDL/原型；否则不硬造。

### 7.5 校验

导出前做轻量校验：

- 至少 1 个已确认需求点；
- 每个需求点有目标 + 验收标准；
- 页面引用的实体存在；
- 权限引用的角色存在；
- 服务/规则引用的实体或字段存在；
- 未确认项/开放问题单独列出；
- 校验失败不生成，返回具体问题回需求/设计修改。

---

## 8. 应用目录与 EOS 模板

### 8.1 目录

```text
projects/<app-id>/
  docs/handoff/             # 设计确认后生成
  backend/                  # 由 templates/eos-app 渲染；EOS demo 结构
  frontend/                 # 不预置；由开发 agent 创建 Vue3
  .opencode/agents/         # req.md / design.md（需求/设计对话用）
  AGENTS.md                 # 可选：极简技术栈 + 文档入口 + 完成总结要求
  README.md                 # 可选：一句话入口
```

### 8.2 EOS demo 模板

`templates/eos-app/` 已从用户提供的 `eos-demo.zip` 复制并脱敏，保留：

- `pom.xml`：parent `com.primeton.eos:eos-pom:9.0.0`；
  - `spring-cloud-starter-alibaba-nacos-discovery`
  - `eos-dap-sdk-starter`（保留示例 exclusions）
  - `eos-server-starter`
  - `com.primeton.eos.foundation`
  - `com.primeton.gocom.afcenter.sdk`
  - `com.primeton.gocom.bfp.framework.starter`
  - `com.primeton.gocom.message.sdk`
  - `mysql-connector-java`
- `src/` 作为 Java 源码根（不是 `src/main/java`）；
- `src/META-INF/_srv/` 的 EOS 配置、handler、license；
- `src/application*.properties`、`src/bootstrap.properties`；
- Primeton Studio / Eclipse 元数据（可选保留）。

### 8.3 占位符与脱敏

模板使用占位符，应用创建时确定性渲染：

- `{{APP_ID}}`、`{{APP_NAME}}`、`{{PORT}}`、`{{EOS_SYS_KEY}}`
- `{{DB_HOST}}`、`{{DB_PORT}}`、`{{DB_NAME}}`、`{{DB_USER}}`、`{{DB_PASSWORD}}`
- `{{MAIL_HOST}}`、`{{MAIL_USERNAME}}`、`{{MAIL_PASSWORD}}`
- Nacos/Redis 使用 `${NACOS_ADDR:...}` / `${REDIS_HOST:...}` 环境变量占位。

已脱敏：

- 示例 DB 密码、Nacos 密码、Redis 地址、`eos.application.sys-key`；
- 邮件账号/密码；
- 示例 DB 驱动从 `com.mysql.jdbc.Driver` 改为 `com.mysql.cj.jdbc.Driver`（目标 MySQL 8.x，需真实环境验证）。

未脱敏/需团队处理：

- `src/META-INF/_srv/primetonlicense.xml` 是示例 license；正式使用前替换为团队 license。
- 内部 Maven 仓库、EOS 制品、Nacos/MySQL/Redis 环境是外部前提，工作台不内置。

### 8.4 前端与 AGENTS.md

- 不生成 `frontend/` 脚手架，只告知 Vue3；由 agent 决定 Vite/TS/UI 库/目录。
- `AGENTS.md` 建议极简（10—15 行）：
  - 技术栈：后端 Java + EOS（参考 `backend/`），前端 Vue3；
  - 先读 `docs/handoff/00-README.md`；
  - 完成后总结：实现摘要、关键文件、运行方式、自测结果、未解决事项；
  - 不要提交真实凭据。
- 如果团队希望完全不注入项目级提示，可把上述内容只放在首条 prompt，不生成 `AGENTS.md`。

---

## 9. 开发阶段 opencode 集成

### 9.1 会话

- 一个应用一个长期开发会话（可“新会话”重开）。
- 创建：

```json
POST /api/session
{
  "title": "<app-name> 开发",
  "agent": "build",
  "model": { "providerID": "...", "id": "..." },
  "location": { "directory": "<projects>/<app-id>" }
}
```

- 不创建 `.opencode/agents/dev.md`，不写自定义 `opencode.json` 权限规则。
- 使用 opencode 原生 `build` agent；模型默认取 `/api/model/default`，允许用户在 UI 选择。

### 9.2 首条提示

只指向交接包，不写开发流程：

```text
请阅读 docs/handoff/00-README.md，并按其中文档完成开发。完成后请总结：已实现需求、关键文件、如何运行、自测结果、未解决事项。
```

- 不再附加批次、证据、Git、测试次数、禁止 npm install 等流程性提示。
- 用户可以在 UI 里编辑首条提示（高级用法），默认使用上面这一句。

### 9.3 会话交互

工作台转发/消费 opencode 原生接口：

| 能力 | opencode API |
| --- | --- |
| 发送消息 | `POST /api/session/{id}/prompt` |
| 消息/时间线 | `GET /api/session/{id}/message` |
| 实时事件 | `GET /api/event`（SSE） |
| 权限询问 | `GET /api/session/{id}/permission` + `POST .../reply` |
| 表单询问 | `GET /api/session/{id}/form` + `POST .../reply` |
| 取消 | `POST /api/session/{id}/interrupt` |
| 模型/agent | `GET /api/model`、`GET /api/model/default`、`GET /api/agent` |

### 9.4 用户确认完成

- 开发页底部/顶部提供“确认完成”按钮。
- 点击后记录 `completed_at`，应用状态 `completed`。
- 不检查 Git、不检查证据、不跑测试门禁；只展示 agent 最后的总结与文件变化，由用户判断。
- 完成后仍可继续对话；再次发送消息可把状态改回 `development`（或提供“继续开发”按钮）。

### 9.5 不做的事

- 不做自定义 dev agent / skill / 固定提示词。
- 不做批次、证据、Git 同步/提交/推送自动化。
- 不做固定骨架/sample/verify 脚本。
- 不做阶段内工具调用次数/读取范围限制。
- 不做“开发完成”自动判定。

---

## 10. 前端信息架构与 UI

### 10.1 首页

- 应用列表：名称、app-id、状态、最后更新时间、当前阶段。
- “新建应用”对话框：
  - 基础：app-id、名称、描述、后端端口、模型。
  - 高级（可折叠）：EOS sys-key、DB/Nacos/Redis（也可留空，用环境变量/占位）。
- 空状态：引导创建第一个应用。

### 10.2 应用工作区

- 顶部：应用名 + 三段进度 `需求 → 设计 → 开发` + 设置/模型。
- 需求阶段：复用现有场景树、需求点卡片、对话面板；移除批次条/批次选择。
- 设计阶段：复用现有规格池、规格树、图谱、原型、评审、测试用例；移除批次条。
- 开发阶段：全新 vibe coding 界面（见下）。
- 右侧上下文面板可按阶段显示：
  - 需求/设计：Spec/评审/原型。
  - 开发：交接文档大纲、文件变化、会话信息（可折叠）。

### 10.3 开发界面（重点）

参考 Codex App / opencode-web 的个人体验，不复用旧工作台三栏：

- 全屏/近全屏对话时间线：用户消息、assistant 文本、工具卡、shell 输出、diff、错误。
- 紧凑的顶部状态条：模型、会话状态、token/耗时（可选）、停止按钮。
- 底部 Composer：多行输入、附件（后续）、发送/停止、`Ctrl+Enter`。
- 权限/表单卡片内联在时间线中，不弹全屏模态。
- 右侧可折叠：
  - “交接文档”大纲（点击跳转/预览）；
  - “文件变化”（按 mtime 或 diff 列表，不强制 Git）；
  - “运行/自测”结果（从 agent 输出提取，不做宿主校验）。
- 视觉：中性深色/浅色、等宽字体、细边框、低噪音；不要 Element Plus 默认后台外观。
- 不做旧工作台的批次/Git/证据三个 Tab。

### 10.4 需求/设计 UI 复用与重做

- v1 复用 `requirements-grooming` 的需求/设计组件与交互，统一换新设计 token/外壳。
- 移除 `BatchBar`、批次状态、批次过滤；把顶部空间让给应用/阶段。
- 设置对话框从 LLM API 配置改为 opencode 模型选择。
- 对话面板保留流式、diff 卡、撤销、actions 按钮；底层换 opencode。
- 后续如需彻底重做需求/设计界面，单独排期；v1 不做大改。

---

## 11. 后端 API（草案）

### 11.1 应用与阶段

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/apps` | 应用列表 |
| POST | `/api/apps` | 创建应用（目录 + EOS 模板 + 基础配置） |
| GET | `/api/apps/:id` | 应用详情 + 阶段状态 |
| DELETE | `/api/apps/:id` | 删除应用（confirm；仅本地目录/登记，不删远端） |
| GET | `/api/apps/:id/workspace` | 应用级场景/模块/activeId |
| PUT | `/api/apps/:id/workspace` | 保存应用级工作区 |
| GET/PUT | `/api/apps/:id/modules/:mid/doc` | 应用级 Spec 文档 |
| POST | `/api/apps/:id/stage/confirm` | `{stage}` 完成本阶段 + 校验 |
| POST | `/api/apps/:id/complete` | 用户确认开发完成 |

### 11.2 交接包

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/apps/:id/handoff/preview` | 生成预览（不写盘） |
| POST | `/api/apps/:id/handoff/generate` | 写入 `docs/handoff/` + 记录 hash |
| GET | `/api/apps/:id/handoff` | 文档列表/内容 |

### 11.3 需求/设计对话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/opencode/health` | serve 状态 |
| GET | `/api/opencode/models` | 可用模型 |
| GET | `/api/opencode/default-model` | 默认模型 |
| POST | `/api/apps/:id/chat` | `{stage, messages}`；短暂会话 + prompt + SSE 文本流 |

### 11.4 开发

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/apps/:id/development/session` | 创建 opencode 开发会话 |
| GET | `/api/apps/:id/development/session` | 会话信息 + 消息 |
| POST | `/api/apps/:id/development/prompt` | 发送消息 |
| POST | `/api/apps/:id/development/interrupt` | 取消 |
| GET | `/api/apps/:id/development/events` | SSE 代理 |
| POST | `/api/apps/:id/development/permission/:rid/reply` | 权限回复 |
| POST | `/api/apps/:id/development/form/:fid/reply` | 表单回复 |

---

## 12. 代码复用与改造清单

### 12.1 从 requirements-grooming 保留

- 需求视图：场景树、需求点卡片、对话、评审、版本/撤销。
- 设计视图：规格池/规格树、实体关系、页面/路由、原型、规则/权限/字典/服务/NFR 面板。
- Spec 类型、校验、Markdown 序列化、测试用例。
- 后端 SQLite/Express 基础、设置、工作区持久化。

### 12.2 从 requirements-grooming 删除/替换

- `backend/src/dev/` 整段旧开发引擎（`codegen.ts`、`runner.ts`、`agents/harness.ts`、`agents/opencode.ts`、`dev/routes.ts`）→ 替换为新的 `dev/`（项目目录、handoff、opencode 会话）。
- `frontend/src/requirements-grooming/ui/dev/` 旧开发页 → 新 vibe coding 页。
- `BatchBar`、批次选择、批次状态、批次自动流转 → 移除（或 v1 内部隐式单批次，UI 不出现）。
- 前端 LLM 设置（baseURL/apiKey）→ 改为 opencode 模型选择。
- `backend/src/llm.ts`、`agents/llm.ts` 的 OpenAI 兼容调用 → 改为 `OpencodeRuntime`。
- 旧 `dev_projects` / `dev_runs` 表 → 新 `apps` / `app_sessions` / `handoffs`。

### 12.3 从旧 workbench-stub 参考/移植

- `workbench-stub/src/opencode.js` → `backend/src/opencode/client.ts`：
  - serve 启动/停止/密码捕获/Basic Auth；
  - SSE 事件流；
  - 会话创建/消息/权限/表单/取消。
- `workbench-stub/src/progress.js` → `backend/src/opencode/progress.ts`（仅展示用，可选）。
- `workbench-stub/ui/src/components/` 中可复用（需重做视觉）：
  - `Timeline.vue`、`ToolCard.vue`、`DiffView.vue`、`ShellOutput.vue`、`StepGroup.vue`
  - `PermissionCard.vue`、`FormCard.vue`、`Composer.vue`、`MarkdownBlock.vue`
- **不要复用**：BatchPanel、BatchPreviewDialog、GitPanel、EvidencePanel、NewAppDialog、StartSessionPanel 的批次/Git/证据逻辑。

---

## 13. 实施阶段

### P0：新项目骨架与运行时

> 2026-11-09 已完成；验证命令与结果见 `docs/STATUS.md`。

- 新项目目录、依赖安装、TS/构建通过。
- 清理旧 dev 模块；保留需求/设计。
- `OpencodeRuntime`：serve 生命周期、健康检查、模型列表、SSE 客户端。
- 配置：`RG_PROJECTS_DIR`、`OPENCODE_BIN`、`OPENCODE_PORT`、模型默认值。
- 验收：启动工作台、健康检查、模型列表、一个空会话能创建/删除。

### P1：应用与阶段

> 2026-11-09 已完成；验证记录见 `docs/STATUS.md`。设计阶段“完成”当时只切换阶段；P3 已改为先校验/生成交接包再解锁开发。

- `apps` 表、应用列表/创建/详情、应用目录、EOS 模板渲染。
- 应用级 workspace（`app_id` 隔离）。
- 三阶段状态、完成校验、确认弹窗。
- 验收：创建应用 → 需求阶段可编辑 → 完成后解锁设计 → 完成后解锁开发。

### P2：需求/设计统一 opencode

> 2026-11-09 已完成；验证记录见 `docs/STATUS.md`。req/design agent 以 2.2.5 实测的 `tools: false` 方式禁用工具；聊天仍每轮注入最新 Spec，远端模型解析结果由前端 `<<<SPEC_JSON>>>` 协议落地。

- `POST /api/apps/:id/chat` + 短暂会话 + prompt + SSE。
- `req`/`design` agent 模板。
- 前端 `streamChat` 改为新端点；保留协议解析。
- 移除 LLM baseURL/apiKey 设置；模型选择。
- `decompose`/`testgen` 迁移到同一 runtime。
- 验收：需求/设计聊天流式、协议解析、Spec 更新、撤销正常。

### P3：交接包

> ✅ 2026-11-09 已完成；验证记录见 `docs/STATUS.md`。

- 后端 `handoff/`：bundle 加载、校验、4 份 Markdown 渲染、写盘、hash。
- 前端预览/生成/下载。
- 设计完成自动生成。
- 验收：生成文档完整、自包含、无未确认项误入；开发 agent 只读文档可理解需求。
- 实现补充：
  - `backend/src/handoff/bundle.ts` / `validate.ts` / `render.ts` / `service.ts` / `routes.ts`；
  - 只导出已确认需求点/设计项；未确认项单列；引用完整性阻塞生成；
  - 4 份 Markdown + 可选 `schema.sql`；不生成 OpenAPI（缺少确定性 HTTP 契约）；
  - `handoffs` 表记录版本/hash/文件清单/源 Spec 快照；
  - 设计完成先校验/生成，失败不解锁；前端 `HandoffDialog.vue` 支持预览/生成/下载。

### P4：开发界面与 opencode 会话

> ✅ 2026-11-09 已完成；验证记录见 `docs/STATUS.md`。P1 已提前完成 EOS 模板渲染，因此本节聚焦开发会话与开发页。

- `app_sessions` + 开发会话 API：创建/恢复/归档、发送、停止、SSE、权限/表单回复。
- opencode 原生 `build` agent；模型按开发阶段保存。
- 新开发页：时间线、工具卡、diff、shell 输出、权限/表单、Composer、停止、文件变化、文档大纲。
- 完成/继续开发：`/complete`；完成后发送消息自动恢复 `development`。
- 首条提示只指向 `docs/handoff/00-README.md`，可编辑。
- 验收：真实 opencode 会话能对话、serve 重启后恢复、停止可用、用户可确认完成。

### P5：端到端与打磨

> ✅ 2026-11-09 完成：真实应用 `quarterly-reporting` 已交付并确认完成（EOS + Vue3 + MySQL 配置）；后端 10 个 H2 测试/打包、前端构建、EOS + 真实 MySQL 空/非空接口/UI E2E 通过（2+2 条 demo 行）。遗留：真实模型需求/设计重跑、Nacos/Redis/license、真实 401/403 权限、打磨。

- 用一个真实小应用跑完整链路：创建 → 需求 → 设计 → 交接包 → 开发 → 用户确认。
- 验证 EOS H2/MySQL 数据源选择、真实构建/运行与外部环境（Nacos/MySQL/Redis/license）。
- 视觉打磨、空状态/错误状态、响应式、性能。
- 记录真实模型/真实 EOS 构建的验证结果；未验证项如实标注。
- 清理 `legacy/` 与批次残留。

---

## 14. 验收标准（v2）

1. 进入工作台可以创建应用；应用有独立目录；顶部三段渐进可用。
2. 需求阶段可多轮对话、沉淀需求点/验收标准；完成后解锁设计。
3. 设计阶段可编辑实体/页面/规则/权限等；完成后生成交接包，不需要选择批次/需求。
4. 交接包包含 4 份主文档（+ 可选机读产物），自包含、只含已确认内容。
5. 开发阶段点击“开始开发”创建 opencode 原生会话；首条提示只指向交接包。
6. 开发界面支持流式文本、工具卡、diff、权限/表单、停止、用户确认完成。
7. 开发阶段没有自定义 dev agent/skill/固定骨架/批次/证据/Git 流程。
8. 应用目录 `backend/` 保持 EOS demo 的结构和最小 pom 依赖；`frontend/` 由 agent 创建 Vue3。
9. 模板中没有真实 DB/Nacos/Redis/sys-key/邮件凭据。
10. 需求/设计/开发三个阶段的 AI 运行时都来自 opencode，没有第二套 OpenAI 兼容配置。

---

## 15. 风险与未验证

| 风险 | 说明 | 处理 |
| --- | --- | --- |
| EOS 构建环境 | eos-pom 9.0.0、EOS starter、license、内部 Maven 仓库、Nacos/MySQL/Redis 是外部前提 | P0/P4 在真实环境验证；未验证前不宣称可构建 |
| opencode 自定义 agent 工具禁用 | `tools`/`permission` 的准确 schema 需用 v2.2.5 验证 | P2 先用 `/api/agent` 核实；必要时用 `plan` agent 或只读约束 |
| 需求/设计流式 | 短暂会话 + prompt + SSE 需要验证文本增量事件与终态 | P2 真实模型验证 |
| `/generate` | 实测 synthetic + `resume:false` 上下文为空、返回 Unknown | 不作为主路径；后续再评估 |
| 模型可用性/成本 | 默认模型与团队模型不同；不同模型质量/速度差异 | UI 显示模型；默认取 opencode 配置 |
| 应用级数据改造 | 现有代码是全局 workspace + 批次；改 app 级涉及较多前端/后端 | P1 分步；v1 可保留隐式单批次 |
| UI 重做范围 | 需求/设计界面复杂，全量重做成本高 | v1 复用 + 换壳；开发页全新 |
| 旧 dev 代码残留 | 旧 manifest/codegen/runner 与新方向冲突 | 先停止使用，新流程跑通后删除 |
| 需求质量 | 文档质量决定开发质量 | 设计阶段校验 + 交接包评审；不做开发阶段门禁 |
| 安全 | 模板来自真实 demo，含凭据 | 已脱敏；后续创建应用时禁止写入真实凭据到仓库 |

---

## 16. 已确认决策与实施前核实

**2026-11-09 用户确认：需求/设计采用 A（短暂会话 + prompt + SSE），开发采用 B（原生 build 会话）；其余设计点按本设计的推荐默认执行，不再逐项等待确认。**

| # | 项目 | 结论 |
| --- | --- | --- |
| 1 | 项目名/路径 | 使用 `E:\work_space_primeton\ai-dev-workbench` |
| 2 | 应用数据隔离 | v1 单库 + `app_id`；应用目录只放代码/交接文档 |
| 3 | 需求/设计运行时 | **A：短暂会话 + 专用 req/design agent + prompt + SSE** |
| 4 | 开发运行时 | **B：原生 build agent + 原生会话 + 权限/表单/取消** |
| 5 | EOS 模板 | 使用脱敏 demo 作为 `backend/` 起点；包名/artifactId 在 P0 按应用参数化；MySQL 8 驱动先沿用 `com.mysql.cj.jdbc.Driver` |
| 6 | 最小 AGENTS.md | 允许 10—15 行：技术栈 + 文档入口 + 完成总结；不写开发流程 |
| 7 | 开发 UI | Codex App / opencode-web 风格；深色/浅色都支持，默认跟随系统 |
| 8 | 测试页签 | 隐藏顶层“测试”；测试用例保留在数据中并进入交接包 |
| 9 | Git/预览 | v1 默认不做；保留“文件变化”视图 |
| 10 | 旧 dev 模块 | 替换；旧代码先保留在仓库，新流程跑通后删除 |
| 11 | 多应用 | v1 应用列表 + 单应用工作区；多用户/容器后置 |

实施前仍需核实（不是设计决策）：

- 内部 Maven 仓库/EOS 制品/license 是否可用；
- opencode v2.2.5 自定义 `req`/`design` agent 的工具禁用 schema；
- 需求/设计短暂会话的 SSE 文本增量与取消行为；
- EOS 模板渲染后的真实构建/启动条件；
- 默认模型与团队模型是否一致。

---

## 17. 下一步

1. ~~用户确认第 16 节的关键决策。~~ 2026-11-09 已确认：需求/设计 A、开发 B；其余按推荐默认。
2. 进入 P0：新项目骨架、清理旧 dev 模块、`OpencodeRuntime`、配置/健康检查。
3. ~~P1—P2：应用/阶段模型、需求/设计统 opencode。~~ 已完成。
4. ~~P3：交接包 bundle/渲染/preview/generate/设计完成接入。~~ 已完成。
5. ~~P4：开发页与 opencode 原生 build 会话。~~ 已完成。
6. P5：真实小应用端到端、EOS H2/MySQL 运行态验证与打磨。
7. 未验证项在 STATUS 中如实标注。
