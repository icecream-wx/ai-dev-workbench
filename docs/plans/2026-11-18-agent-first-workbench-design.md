# Agent-First 工作台设计（2026-11-18，讨论稿 v3）

> 状态：**讨论稿，未实施**。本轮只做设计，不改代码、不动真实 `data/`/`projects/`。
> 上游讨论：2026-11-17 ~ 11-18 主会话与用户的多轮对齐（需求/设计/开发三阶段 + 原生扩展能力盘点）。
> v2（2026-11-18）：纳入用户确认的 6 项决策，见 §15「决策记录」。
> v3（2026-11-18）：**不做任何 git 操作**（不 init/不提交/不 revert）；不生成模块 README 索引；需求/设计历史会话用轻量下拉；**旧代码/旧测试/旧前端组件在 P1 一次性删除**，不留"以后再清"（避免误导本版规则）。前期开发阶段，不设计文件丢失/回滚/并发等兜底。

---

## 0. 一句话

> 工作台提供**共享工作空间 + 模板 + 会话 + 产物视图 + 执行过程**；agent 根据用户目标自主检索材料、判断范围、修改产物并检查结果。需求/设计/开发是**当前关注的工作视角**；澄清只来自任务歧义；产物格式服务于**人的阅读和界面展示**。

对应地，工作台从"流程引擎"退化为"工作区 + 三个视图 + 一个 agent"。

## 1. 保留 / 删除

### 保留（以"是否帮助人理解或操作成果、是否运行必需"为准）

| 能力 | 保留后的形态 |
| --- | --- |
| 模块 | 需求文档的**分组单位 + 大纲导航**；每模块一个文件；取消模块管理状态（确认/归档/范围/阶段） |
| 阶段条 | **视图导航**，无锁定、无推进条件、无 409 |
| 修改 diff | **过程展示**（改了哪些文件/章节），无"应用/忽略" |
| 设计文件格式 | 可渲染的结构（ER/原型），是**展示契约**，不是聊天协议 |
| 模板 | 全局库（DB）+ 应用内资源副本 |
| skills / commands | 承载"怎么做"和常用任务入口 |
| 会话、权限、compact、脱敏 | opencode 原生 + 现有 DevView 体验 |

### 删除

需求/设计确认状态、bundle confirm、Change Set（发起/范围/取消/diff）、强制交接包（00—05/manifest/PNG 校验）、版本历史与回滚、覆盖度、stale、G1 模块意图守卫、AI 建议卡与行级 diff 应用、`<<<DOC_JSON>>>`/`<<<DESIGN_JSON>>>` 协议、模块管理状态、U7 分阶段开发、M7-2 独立原型规格生成与存储。

## 2. 目标架构

```
┌──────────────────────────── 前端（三个视图） ────────────────────────────┐
│  需求视图：模块大纲 + 文档渲染 + 设计与原型只读查看 + 对话                │
│  设计视图：模块树 + ER + 原型 + 对话                                     │
│  开发视图：会话列表 + 时间线（工具/权限/表单/diff/终端）+ 文件变化         │
└───────────────▲───────────────────────────────▲─────────────────────────┘
                │ 产物解析 / 校验 / 变化事件      │ SSE（时间线）
┌───────────────┴───────────────┐   ┌───────────┴─────────────────────────┐
│ 工作台后端                     │   │ opencode 运行时（每应用一个 location）│
│ 应用 / 模板 / 会话 / 文件监听   │   │ 会话、工具执行、skills、commands、    │
│ 解析与校验 / 模板分发与同步     │   │ 权限、compact、事件流                 │
└───────────────▲───────────────┘   └───────────▲─────────────────────────┘
                │                               │
        ┌───────┴───────────────────────────────┴────────┐
        │ 应用工作区 projects/<app>/                      │
        │ docs/requirements/*.md · docs/design/* · 代码   │
        │ .opencode/{skills,commands,agents} · AGENTS.md  │
        └────────────────────────────────────────────────┘
```

## 3. 文件契约（单一事实源）

```
projects/<app>/
├─ AGENTS.md                       应用级约定（布局、技术栈、中文、一致性、汇报）
├─ README.md
├─ .opencode/
│  ├─ skills/                      受管（工作台写入，应用不改）
│  │  ├─ requirements-document/
│  │  │  ├─ SKILL.md
│  │  │  ├─ assets/templates/*.md  模板副本（来自全局库）
│  │  │  └─ _manifest.json         受管清单：sourceId + hash
│  │  └─ design-artifacts/
│  │     ├─ SKILL.md
│  │     ├─ references/design.schema.json
│  │     ├─ references/design-example.json
│  │     ├─ assets/templates/*.json 原型模板副本
│  │     └─ scripts/validate.mjs    读同一份 schema 的自查脚本
│  ├─ commands/                    任务模板（工作台与 TUI 共用）
│  │  ├─ update-requirements.md
│  │  ├─ generate-design.md
│  │  ├─ preview-app.md
│  │  └─ check-consistency.md
│  └─ agents/                     可选（首版为空；后续评审/调查子代理）
├─ docs/
│  ├─ requirements/
│  │  ├─ MOD-001-商品管理.md
│  │  └─ MOD-002-订单管理.md
│  └─ design/
│     ├─ MOD-001/design.json
│     └─ MOD-002/design.json
├─ backend/                        EOS 骨架（现有模板渲染）
└─ （原型 PNG、截图等按需）
```

### 3.1 需求模块文件

```md
---
module: MOD-001          # 稳定 key，全局唯一
title: 商品管理
order: 1
template: standard-prd   # 全局模板库中的 id
---

# 商品管理

## 1. 背景与目标
...
```

- 模块列表 = `docs/requirements/*.md`；**不生成 README 索引**（大纲本身就是索引，避免两份导航漂移）。
- 新建/改名/排序：UI 按钮直接操作文件（写 frontmatter + 序号），用户不必手写。
- **新增模块**（保留）：UI 按钮必须直接生成 `docs/requirements/MOD-XXX-标题.md`（frontmatter + 按应用默认模板展开的章节骨架），与文件契约对齐，不产生任何 DB 记录。
- **删除模块**：UI 不提供；要删除让用户在对话里告知 agent 删文件（skill 中写明 agent 可应要求删除模块文件）。
- 模板：应用默认（`apps.requirement_template_id`）+ 模块覆盖（frontmatter `template`）。

### 3.2 设计文件（渲染契约，草案）

`docs/design/<MOD>/design.json`：

```jsonc
{
  "module": "MOD-001",
  "title": "商品管理",
  "entities": [
    {
      "id": "product",
      "name": "商品",
      "table": "biz_product",
      "fields": [
        { "name": "商品编码", "type": "string", "required": true, "unique": true },
        { "name": "状态", "type": "enum", "options": ["上架", "下架"] }
      ]
    }
  ],
  "relations": [
    { "from": "product", "to": "category", "type": "N:1", "label": "所属分类" }
  ],
  "pages": [
    {
      "id": "product-list",
      "name": "商品列表",
      "type": "list",
      "entity": "product",
      "columns": ["商品编码", "商品名称", "状态"],
      "actions": ["新增", "编辑", "删除"]
    }
  ]
}
```

- 字段/页面结构以 `design.schema.json` 为准；**schema 是唯一源**，后端解析与 `scripts/validate.mjs` 共用。
- 跨模块引用：`"entity": "MOD-002/order"`；UI 聚合去重；同名重复定义 → 非阻塞告警。
- 页面 `type` 复用现有 `PAGE_TYPE_LABELS` / `PrototypeRenderer`（先做一层 adapter，不改渲染器）。
- 可选 `requirementRefs: ["#4.2 商品列表"]`，自由文本，不校验。

## 4. skills（2 个）

### 4.1 `requirements-document`

> **P0 实证补充**：skill 通过 `skill` 工具按 id 加载（progressive disclosure），返回内容带 **skill 目录绝对路径**——`assets/templates`、`references/`、`scripts/` 相对资源布局可行。frontmatter **必须有 `name` + `description`**（缺 description 等于废 skill；坏 YAML 会被**静默丢弃**）。项目级 skill 会**静默覆盖**同名内置/用户级 skill，且 opencode 同时扫描用户级目录（`~/.claude/skills` 等）——**skill 命名带项目前缀**（如 `adw-requirements-document`）防污染。分发后调 `GET /api/skill` 校验实际加载结果（见 §6.1）。

```markdown
---
name: 需求文档编写与维护
description: 在应用工作区中按用户选定模板编写/维护需求文档，结合现有材料并保持与设计一致
---
```

正文要点（控制在 ~100 行内）：

- 结合用户目标，**按需**调查工作区：`docs/requirements/`、`docs/design/`、代码、截图；先读已有产物再决定看什么。
- 使用任务消息里给出的模板路径；不要自行改模板文件。
- 需求写**目标与验收**；业务字段/枚举/约束可写；Controller 类名、内部表结构不写。
- 修改需求时判断设计是否需要同步；两边必须一致。
- 冲突或显著歧义 → 提出**具体问题**；其余自主推进。
- 完成后汇报：关键判断、改了哪些文件/章节、待确认项。

### 4.2 `design-artifacts`

```markdown
---
name: 设计产物编写与维护
description: 基于需求文档与设计模板生成/更新实体、页面与原型数据，保证可渲染且与需求一致
---
```

正文要点：

- 先读 `docs/requirements/*.md` 与 `references/design.schema.json`，再写 `docs/design/<MOD>/design.json`。
- 跨模块共享实体用 `MOD-xxx/entity` 引用，不重复定义。
- 写完可运行 `scripts/validate.mjs` 自查；**最终校验以后端读取结果为准**。
- 需求与设计不一致时，优先按用户最新意图调整，并说明改了哪边。

> 不按"一份模板一个 skill"拆分；只有**工作方法**明显不同才拆新 skill。

## 5. commands（任务模板）

| 命令 | 用途 | UI 入口 |
| --- | --- | --- |
| `/update-requirements` | 按当前模板更新需求（`$ARGUMENTS` 可带模块/范围） | 需求视图按钮 |
| `/generate-design` | 按需求 + 设计模板生成/更新设计 | 设计视图按钮 |
| `/preview-app` | 启动应用、检查关键路径、截图 | 开发/设计视图按钮 |
| `/check-consistency` | 检查需求/设计/代码之间的一致性，输出具体差异 | 两个视图的"检查一致性" |

- 工作台按钮**读取 command 文件**拿描述与模板，发送展开后的文本；TUI 也能直接用。
- 避免"UI 一套 prompt、后端一套 prompt"。

> **P0 实证补充（比预期更好）**：`.opencode/commands/`（复数）与 `.opencode/command/`（单数）均被识别且**热加载**（秒级，无需重启）。UI 按钮可直接 **`POST /api/session/:id/command {name, text}`** 触发——服务端展开 `$ARGUMENTS`（`text` 即参数）、frontmatter `agent` 生效；"读文件自行展开后发普通消息"降级为备用退路。注意 `GET /api/command` 只返回 `{name, description}`（不含正文/agent），UI 若展示模板内容需自己读文件（本来就是工作台资产）。command frontmatter 的 `model` 字段与子代理执行未验证，P1 用到再补。

## 6. 模板库与分发

| 内容 | 位置 | 性质 |
| --- | --- | --- |
| 模板定义（章节结构、皮肤） | **全局库（DB，沿用现有 `requirement_templates` / `prototype_templates` + CRUD UI）** | **唯一权威** |
| 应用内 `assets/templates/*` | 工作区 | **派生副本**（只允许 全局 → 应用） |
| `_manifest.json` | 工作区 | 受管记录：`sourceId` + `hash` |

### 6.1 同步规则（**全局为准**）

- **应用不改 skill**：不提供应用内模板编辑、不做冲突态、不做"另存为"。
- 全局模板保存 → **立即同步所有已携带该模板的应用**（覆盖副本）。
- 应用打开 / 会话启动时做一次幂等对齐（覆盖式），兜底目录被手改或同步失败。
- 模板删除：仍被模块 frontmatter 引用 → 拒绝并提示引用位置；未被引用 → 从各应用移除资源。
- 同步只改 `assets/templates/*` 与 `_manifest.json`；**不改需求/设计正文**。
- 是否需要"按新模板重写文档"由用户对 agent 明说。
- **同步后校验**（P0 实证）：skills/commands 均热加载（秒级），同步完成即调 `GET /api/skill` 核对 id/description 实际加载（坏 YAML 会被静默丢弃，必须靠校验兜底）。

### 6.2 与 SKILL.md 的关系

- `SKILL.md` 是**工作台资产**，随工作台版本在会话启动时自动对齐，与模板同步互不影响。
- 插件/依赖升级是运维动作，不随模板同步发生。

## 7. 变化检测与格式诊断

1. **监听范围**：只监听 `docs/`（需求与设计），不监听整个工作区（避免代码噪声与性能问题）。
2. **事件**：后端 watcher → SSE `artifacts-changed { paths, hash }` → 前端增量重读。
3. **兜底触发**：手动刷新、窗口聚焦、聊天轮次结束。
4. **格式错误**：读取时校验 schema → 显示"文件/字段/期望"横幅 + 「让 AI 修」；ER/原型保留上次成功渲染并标"已过期"，不白屏。
5. **过程展示**：需求/设计视图也展示"本次改了哪些文件/章节"（只读 diff），不做应用/忽略。

## 8. 视图行为

- **需求视图**：模块大纲 + 文档渲染 + 对话；「原型」节点只读展示 `docs/design/` 已有产物（无则引导去设计）。
- **设计视图**：模块树 + ER + 原型 + 对话；生成/更新走 `/generate-design`。
- **开发视图**：会话列表 + 时间线 + 文件变化；无交接包、无阶段条门禁。
- 阶段条：只切换视图；点击执行按钮或发送消息才发起任务。
- 移除所有阶段门禁 409；并发/文件写失败/格式错误照常 4xx/5xx。
- `apps.status`：退化为"当前所在视图"标签（首页/头部展示用），**无门禁语义**，不影响任何写操作。

### 8.1 会话模型（每视图一个活跃会话）

- **每视图一个活跃会话 + 历史列表**：需求/设计/开发各自独立的持久会话（`app_sessions` 加视图标签）；开发视图沿用现有 SessionList（多会话/搜索/重命名/归档），需求/设计视图提供**轻量下拉**（最近 5 个 + 新建会话）。
- 会话是**可丢弃的工作记忆**：产物单一事实源是工作区文件，skill 要求 agent 每次任务先读工作区，新会话重新调查成本低。
- `POST /chat` 统一入口：body 带 `view`/`module`/`command`，按视图路由到对应活跃会话。

### 8.2 上下文策略（提醒 + 用户一键，不自动切换）

- 沿用 I-09a 健康度机器并推广到三个视图：按模型 `limit.context` 的百分比 chip（60% 黄 / 85% 红）。
- 85% 红线 → 视图内**常驻非阻塞横幅**：「当前会话上下文接近上限」+ 两个一键动作：
  - **[压缩后继续]**：opencode 原生 compact（现有 `POST /development/compact` 推广为按会话）。
  - **[开新会话继续]**：归档当前会话 + 新建会话 + 自动塞一条**确定性衔接消息**（不调模型），如「上一会话因上下文接近上限已归档；工作区 `docs/` 内为最新产物，请先阅读相关产物后继续」。
- **不做**：自动无感切换、自动压缩、模型生成的跨会话摘要（文件即记忆；以后真需要再加）。

## 9. 数据与接口收敛

### 9.1 保留表（5）

`apps`（含模板默认值）、`app_settings`、`app_sessions`、`requirement_templates`、`prototype_templates`。

删除：`app_modules`、`app_requirement_bundles`、`app_requirement_docs(_sections/_versions)`、`app_design_projects/inputs/entities/page_sets/pages/versions`、`app_change_sets`、`app_change_set_modules`、`design_handoffs`、`app_dev_phases`、`app_stage_events`。

> 按 2026-11-13 政策：**不做旧数据兼容**；有应用数据的库 fail-closed，提示删除应用或重置。

### 9.2 接口（约 20）

- 应用：`GET/POST /api/apps`、`GET/DELETE /api/apps/:id`、`GET /api/apps/:id/templates`
- 模板库：`GET/POST/PUT/DELETE /api/requirement-templates`、`/api/prototype-templates`、`POST /api/templates/:kind/:id/sync`、`GET /api/templates/:kind/:id/usage`
- 产物：`GET /api/apps/:id/artifacts`（模块 + 文档 + 设计解析结果 + 校验状态）、`GET /api/apps/:id/events`（SSE 变化）
- 对话：`POST /api/apps/:id/chat`（统一；body 带 `view`/`module`/`command`）
- 开发：保留现有会话列表/消息/权限/表单/compact/中断等
- 删除：`requirements-doc/*`（除模板）、`requirements-modules/*`、`requirements-bundle/*`、`requirements-prototype/*`、`design/*`（除模板）、`handoff/*`、`change-sets/*`、`development/phases`

### 9.3 代码删除估算

- 后端：`changesets/*`(3)、`handoff/*`(9)、`requirements/` 的 `doc/modules/module-*/outline/prototype-*/types/module-migration`(~10)、`design/` 的 `service/input/prompt/epic-context/module-migration/types`(~6)。
- 前端：`changesets/*`(7)、版本/交接/同步/覆盖度/模块规划/AI 建议/原型规格等组件（~25）。
- 测试：后端 328 → 预计 130—160；前端 172 同比例下降。**这是最大隐性成本**。

## 10. 非目标

- 不做 skill 市场 / 插件管理平台 / 版本系统 / 变更单 / 交接包 / 覆盖度 / 阶段门禁。
- 不做旧应用数据迁移。
- 不在首版引入 MCP、插件、自定义工具、subagent 链。
- 不规定 agent 的执行步骤与产物数量。

## 11. 迁移与数据处置

- 新库结构 + 工作区布局；旧库有应用数据 → fail-closed。
- 真实 `app1`（用户演示应用）：**由用户手动删除**（2026-11-18 决策；主会话/实施会话均不执行）。P1 升级前须确认真实库 `apps=0`。
- `docs/report/` 中交接包/变更单相关章节需在实施后更新。

## 12. 测试与验收

| 层 | 内容 |
| --- | --- |
| 后端单测 | 文件解析（frontmatter/design.json）、schema 校验、模板分发与同步、artifacts API、watcher 事件、fail-closed 升级 |
| 前端单测 | 产物解析/适配、模块列表、错误提示、视图切换 |
| 冒烟 | 新建应用 → 模板副本/命令/skill 就位 → 写 PRD → 写 design → 解析渲染 → 开发会话 |
| Playwright | 浅/深 × 1440/1024/768；文件变化 → 视图刷新；格式错误 → 横幅 + 让 AI 修；模板修改 → 全局同步 |
| 真实模型 E2E | 新建应用 → 需求对话改文档 → 设计生成/调整 → 开发会话；临时实例，跑完删除 |

## 13. 实施拆分

| 阶段 | 内容 | 出口 |
| --- | --- | --- |
| **P0 spike** | ~~临时实例验证 opencode 2.2.5：应用内 `.opencode/skills` 发现与 reload；commands；按 agent 的 skill/edit 权限；读图；git 行为~~ **✅ 已完成（2026-11-18），7 项通过（git 仅事实记录、本版不用），见 §13.1** | 结论已回填 |
| **P1 底座 + 清理** | 5 表 schema + fail-closed 升级；工作区布局；`AGENTS.md`；skills 种子 + 模板分发；commands 种子；单 agent（退役 req/design agent）；统一 chat + 会话模型；**一次性删除旧后端模块/旧路由/旧表/旧测试/旧前端组件与旧冒烟（不留半套）** | 新建应用可跑通"模板→PRD.md"，仓库内无旧功能残留 |
| **P2 需求视图** | 模块文件解析/渲染/大纲/新建改名排序；统一 chat；artifacts + SSE；只读原型查看 | Playwright + 真实模型一次需求对话 |
| **P3 设计视图** | `/generate-design` 任务；design.json 解析/校验/adapter/ER/原型；错误横幅 + 让 AI 修 | ER/原型截图 + 改文件后刷新 |
| **P4 开发视图** | 删交接包/阶段条/U7；首条提示改为读工作区；保留会话/权限/compact/文件变化 | 真实 opencode 建会话/SSE/恢复 |
| **P5 收尾** | 全量回归；真实模型全链路；更新 `docs/report/`、STATUS 与 AGENTS.md | 全部通过 |

### 13.1 P0 spike 结论（2026-11-18，opencode 2.2.5 实证）

| # | 验证项 | 结论 |
| --- | --- | --- |
| 1 | 项目级 skills 发现 | ✅ `.opencode/skills/<name>/SKILL.md` 被发现（`GET /api/skill`），`skill` 工具按 id 加载并带目录绝对路径；项目级覆盖同名内置；坏 YAML/缺 description 静默失效 |
| 2 | skills/commands reload | ✅ 运行中新增约 2s 生效，无需重启（另有 `POST /api/location/reload`） |
| 3 | commands | ✅ 单复数目录都识别；**HTTP 可触发** `POST /api/session/:id/command {name,text}`；`$ARGUMENTS` 展开、frontmatter `agent` 生效；`/api/command` 列表不含正文 |
| 4 | 路径级 edit 权限 | ✅ `permission.edit` glob 映射 + 按 agent 覆盖；deny 实测硬拒绝 |
| 5 | 读图 | ✅ `read` 工具对 PNG 返回 base64 文件内容，视觉模型可直接描述（格式/大小上限未测） |
| 6 | git revert | ⚠️ 部分支持：内置 message 级 revert（stage→commit），**仅当工作区在会话启动前已是 git 仓库**；非 git 零跟踪。**本版明确不用（不做任何 git 操作）** |
| 7 | serve API | ✅ 工作台现有用法兼容。注意：serve 需 Basic auth（启动打印 password）；`prompt` 体为 `{text}`（`parts` 会 400）；**prompt 体内 `model` 字段被忽略**，模型切换走 `/api/model/default`（与"会话创建时定模型"的既有做法一致）；无公开 OpenAPI 端点 |

临时产物：`C:\Users\icecream\AppData\Local\Temp\opencode\p0-spike-20261118\`（e1/e2/e3 实验工作区 + JSON 证据），可由用户决定保留备查或删除。

**P0 未验证、P1 用到再补**：command frontmatter `model` 字段与子代理执行；读图格式/大小上限；`ask` 权限在 serve 无头模式的流转（工作台已有 permission reply 链路）；`bash` action 的命令 glob。

## 14. 风险

1. 设计 JSON 由 agent 自由写，可能不合 schema → 校验 + 错误横幅 + 让 AI 修；保留上次成功渲染。
2. 测试面大面积重写（含删除旧用例）→ 一次性完成，P1 交付时测试必须全绿。
3. 上下文成本 → SKILL.md 精简、只监听 `docs/`、compact；会话模型与上下文策略见 §8.1/§8.2。
4. 模板自动同步覆盖手工修改 → 由"应用不改 skill"约束 + UI 只读 + 规则兜底；P0 已证实 `permission.edit` 可对 `.opencode/skills/**` 做 deny（硬拒绝）。
5. **前期开发不设计兜底**：不做文件丢失/回滚/并发控制/多实例锁；误改由用户或 agent 直接修正。

## 15. 决策记录（2026-11-18，用户确认）与待确认

### 已确认

| # | 决策 |
| --- | --- |
| D-会话 | 会话模型 **B：每视图一个活跃会话 + 历史列表**；上下文策略 = **提醒 + 用户一键**（85% 横幅 + [压缩后继续]/[开新会话继续]；新会话带确定性衔接消息，不调模型；不自动切换/不自动压缩/不做跨会话模型摘要），见 §8.1/§8.2 |
| D-历史入口 | 需求/设计用**轻量下拉**（最近 5 个 + 新建）；开发保留完整 SessionList |
| D-回滚 | **不做回滚安全网，也不做任何 git 操作**（init/commit/revert 均不做）；前期开发不设计文件丢失、并发等兜底 |
| D-模块 | UI **不提供删除模块**（删除走对话告知 agent）；**保留「新增模块」**，手动新增必须直接生成模块文件（frontmatter + 模板骨架），见 §3.1 |
| D-索引 | **不生成**模块 `README.md` 索引（大纲即索引） |
| D-状态 | `apps.status` 保留为"当前视图"标签，**无门禁语义** |
| D-app1 | 真实 `app1` **已由用户手动删除**；P1 不在真实库执行升级 |
| D-清理 | 旧代码/旧测试/旧前端组件/旧冒烟在 **P1 一次性删除**，不留半套；旧设计文档归档并标注被取代 |
| D-skill | 应用内 skill 只读、模板只改全局库 |

### 待确认

无（P2 前不再有阻塞项）。
