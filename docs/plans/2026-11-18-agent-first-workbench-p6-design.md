# P6 设计：聊天思考细节 + 模板即 skill + 中文输出 + 设计参考包（2026-11-18）

> 状态：**已实施（P6-1/P6-2/P6-3/P6-4，2026-11-19）**。详见 `2026-11-19-p6-1-2-implementation-brief.md`、`2026-11-19-p6-3-design-reference-brief.md`、`2026-11-19-p6-4-final-brief.md`。
> 上游：`2026-11-18-agent-first-workbench-design.md` v3；P1—P5 已完成并通过评审（后端 77/77、前端 49/49、`e2e:p2/p3/p4` 104/67/83、全链路真实模型 E2E 通过）。
> 本稿只增加"让 agent 更好用、让设计成果被开发参考"的能力，不恢复版本/确认/变更单/交接包/门禁。

---

## 0. 四个问题与决策（用户已确认）

| # | 问题 | 决策 |
| --- | --- | --- |
| 1 | 需求/设计对话缺少"思考/加载"细节（开发页有 reasoning） | 发送后占位气泡 + reasoning 折叠块；**出错/中断时占位必须替换或标记失败**；样式/token 与 DevView 统一 |
| 2 | 模板没有变成应用下的 skill，全局模板更新机制不直观 | **方案 B：模板即 skill，一个模板一个 skill**；方法 skill 改成"先加载 `adw-template-*`" |
| 3 | 开发 agent 输出回到英文 | 统一 `CHINESE_INSTRUCTION` 注入三个视图每条 prompt + 4 个 command + 应用 `AGENTS.md` |
| 4 | 开发完全自由发挥，页面/风格与设计原型不符 | **设计参考包**：`design-brief.md` + `tokens.json` + `prototypes/*.png` + `_manifest.json`；开发 prompt/AGENTS 强制参考；check-consistency 只报告 |

补充决策（来自评审）：
- PNG 新鲜度是主要风险：`prototypes/_manifest.json` 记录每页对应的 `design.json` hash；**结构以 design.json 为准，风格/布局参考 PNG 与 tokens**；PNG 过期时 UI 提示，开发 prompt 也说明优先级。
- tokens 从原型模板确定性导出（不经模型），为"以后加更多设计模板"留扩展点；**EOS 后端不吃风格，tokens/brief 主要约束 Vue3 前端**，prompt 写清边界。
- `design-brief.md` 由设计 agent 自由撰写，不进 schema 校验。
- P6-3 出口硬指标：真实模型 E2E 验证"开发产物页面结构/风格与设计原型一致"（人工截图比对 + 关键字段断言）。

---

## 1. P6-1 聊天思考/loading + 中文

### 1.1 现状

- `AgentChatPanel` 只渲染 assistant `text`，不渲染 `reasoning`；`DevView` 有"思考"折叠块。
- 底部 spinner 仅在 `state.status === 'running'` 时出现；发送后到状态翻转之间没有占位，容易误以为没反应。
- `buildViewPrompt` 三个视图均未包含中文指令；`DEFAULT_DEV_PROMPT` 与 `AGENTS.md` 有，但后续消息丢失。

### 1.2 设计

**发送状态机（AgentChatPanel）**

```
idle → sending（本地占位：spinner + "思考中…"）
     → streaming（首个 delta/assistant 消息到达 → 移除占位，渲染正文；reasoning 折叠）
     → done / failed / interrupted（占位替换为正文或失败/中止标记）
```

- 占位是三视图共用的本地状态，不依赖 `state.status` 翻转。
- 出错：占位替换为错误气泡（保留错误条）；中断：占位标记"已中止"，可继续输入。
- 刷新后（历史消息）不显示占位，只渲染真实消息。

**reasoning**
- assistant 消息若含 `reasoning`，渲染折叠块，默认折叠；标题"思考"，样式与 `DevView` 的 `.reasoning` 一致（抽公共 class/token）。
- 工具运行中显示一行"当前工具"（可选，取 `steps` 最后一项）；没有 conversation 级占位时不强行插入假消息。

**中文**
- 新增共享常量（后端）`CHINESE_INSTRUCTION`：
  > 所有面向用户的文字——回复、思考/进度说明、工具说明、汇报——一律使用中文；代码、命令、标识符、文件路径除外。
- 注入：`buildViewPrompt` 三个视图、`templates/agent/commands/*.md` 四个命令、应用级 `AGENTS.md`（现有中文条目措辞加强）。
- 说明：指令层，不保证 100%；真实模型 E2E 验证（至少开发视图的回复/思考为中文）。

### 1.3 测试

- 前端：占位状态纯函数（sending/streaming/failed/interrupted 转移）；e2e 扩展现有 stub（首字前有占位、出错替换、中断标记、reasoning 折叠、三视图一致）。
- 后端：`buildViewPrompt` 三视图与 command 文本断言包含中文要求。
- 真实模型：开发/需求各一轮，人工确认中文。

---

## 2. P6-2 模板即 skill（一个模板一个 skill）

### 2.1 现状

- 模板是方法 skill 的资源：`adw-requirements-document/assets/templates/<id>.md`、`adw-design-artifacts/assets/templates/<proto>.json`；有 `_manifest.json`（sourceId + sha256）。
- 全局保存会同步、应用打开会幂等对齐——**机制存在**；问题是模板**不可被 agent 发现/加载**，设计/开发 prompt 也没引用原型模板。

### 2.2 目标布局

```
.opencode/skills/
├─ adw-requirements-document/SKILL.md         # 方法：先按模块 frontmatter 加载 adw-template-req-<id>
├─ adw-design-artifacts/SKILL.md              # 方法：先加载 adw-template-proto-<app 默认 id>
├─ adw-template-req-<template-id>/
│  ├─ SKILL.md                                # name/description/结构说明/何时加载
│  ├─ assets/template.md                      # 模板副本（渲染骨架/章节定义）
│  └─ _manifest.json                          # {managed,kind,sourceId,hash,templateName}
└─ adw-template-proto-<prototype-id>/
   ├─ SKILL.md                                # 风格/布局/组件规则；何时加载（设计、开发）
   ├─ assets/template.json                    # 原型模板原文
   ├─ assets/tokens.json                      # 色板/字体/圆角/间距/shell（确定性）
   └─ _manifest.json
```

- **命名**：`adw-template-req-<id>` / `adw-template-proto-<id>`；id 做安全化（保留 `[a-z0-9._-]`）。
- **一个应用可有多个需求模板 skill**（模块 frontmatter 覆盖），方法 skill 里写清选择规则：
  1. 读模块 frontmatter `template` → 加载对应 `adw-template-req-<id>`；
  2. 找不到 → 应用默认模板 skill；
  3. 再找不到 → 无模板时按现有 SKILL.md 的通用要求写，并说明缺少模板。
- 原型模板 skill 由应用默认原型模板生成；设计/开发先加载它。
- **同步**：
  - 全局模板保存 → 重新生成对应模板 skill 并同步所有引用应用；
  - 应用创建/打开/会话启动 → 幂等对齐（保留 `_manifest.json` 校验）；
  - 删除模板 → 引用检查（需求模板按模块 frontmatter，原型按 app 默认/manifest）→ 移除对应 skill 目录；
  - 清理不再引用的 `adw-template-*`（按 manifest 白名单，不碰用户自建 skill）。
- **校验**：每次分发/同步后调用 `GET /api/skill`（P0：坏 YAML 静默丢弃），失败只告警并在 UI 显示"资源未加载"。
- 方法 skill 移除对 `assets/templates/*` 的依赖；保留 `references/design.schema.json`、`scripts/validate.mjs` 在 `adw-design-artifacts`。

### 2.3 UI

- 模板库：选择/编辑后显示"同步到 N 个应用"结果；应用内可选显示"已加载模板 skill"（只读）。
- 不做模板市场/多版本。

### 2.4 测试

- 后端：生成/同步/清理/删除保护；多需求模板并存；manifest/hash；`GET /api/skill` 校验失败告警；旧资源清理。
- Playwright：新建应用 → skills 列表含方法 2 个 + 模板 2 个；改全局模板 → 应用目录与 skill 内容更新；删模板 → 409/移除。
- 真实 opencode：`smoke:assets` 扩展为"方法 + 模板 skill 均已加载"。

---

## 3. P6-3 设计参考包（让开发真正参考设计）

### 3.1 工作区结构

```
docs/design/<MOD>/
├─ design.json                 # 结构唯一来源（schema 校验）
├─ design-brief.md             # 设计 agent 写的开发参考（自由文本，不进 schema）
├─ tokens.json                 # 从原型模板确定性导出（色板/字体/圆角/间距/shell/templateId）
└─ prototypes/
   ├─ _manifest.json           # {designHash, templateId, exportedAt, pages:{id:{file,hash,exportedAt}}}
   └─ <page-id>.png
```

### 3.2 生成与新鲜度

- **tokens.json**：导出/同步时由工作台写入（读原型模板 tokens/shell），不经模型。
- **design-brief.md**：设计 skill 要求 agent 在写/改 design.json 后维护；建议固定小标题（概览/导航/页面/组件/风格），但不做 schema 校验。
- **PNG 自动导出**：设计视图打开且 `design.json` hash 变化 → 防抖（1s）→ 逐页离屏渲染（复用 `PrototypeCanvas` + `captureElementPng`）→ 后端写入 + 更新 manifest；手动「重新导出」兜底。
- **后端接口**（新增，仅此一个）：
  - `POST /api/apps/:id/design/:module/prototypes`，body `{designHash, templateId, pages:[{id, dataUrl}]}`
  - 校验：module 存在、`designHash` 与当前 `design.json` 一致（防过期写入）、PNG 魔数/大小限制、页数上限；写入 `prototypes/` + manifest。
  - 失败不阻塞设计视图；显示错误提示。
- **过期策略**：manifest 的 `designHash` ≠ 当前 artifacts hash → UI 黄条"原型图已过期，请重新导出"；开发 prompt 明确：
  > 结构以 `design.json` 为准；风格/布局参考 `prototypes/*.png` 与 `tokens.json`；如果 PNG 过期（manifest hash 不匹配），先说明，不要盲从旧图。
- 自动导出只在设计视图打开时发生；未打开时不静默失败，UI 打开后立即比对并补导。

### 3.3 开发如何参考

- 应用 `AGENTS.md` 增加"设计参考"段：路径、优先级（需求 > design.json 结构 > brief/tokens/PNG 风格）、EOS 后端不吃风格、Vue3 前端按 tokens。
- `buildViewPrompt('development')` 明确：
  - 必读 `docs/requirements/`、`docs/design/<MOD>/design.json`、`design-brief.md`、`tokens.json`、`prototypes/*.png`；
  - 页面结构/字段/交互/导航/风格按设计；偏离要说明；
  - 先读现有代码，不要推倒重写。
- `adw-design-artifacts` 增补：修改设计后同步 brief/tokens；页面变化时提示重新导出 PNG。
- `check-consistency` 增加只读"设计页面 vs 代码页面"差异清单（缺失页面/字段、明显风格不一致），**只报告不门禁**。

### 3.4 验收（P6-3 硬指标）

- 真实模型 E2E（临时实例）：
  1. 需求 → 设计（含 PNG/brief/tokens）→ 开发；
  2. 断言：开发产物包含设计页面中的关键字段/路由（如商品编码/名称/状态列）；
  3. 人工截图比对：实现页面与原型在布局/导航/主色/间距上"可辨认一致"；
  4. 记录差异与原因（模型能力边界），不引入硬门禁。

---

## 4. 影响面

| 层 | 改动 |
| --- | --- |
| 后端 | `templates/distribution.ts` 改为模板 skill 生成器；模板 CRUD 保存/删除同步；`chat/service.ts` 中文 + 设计参考路径；新增 `POST /design/:module/prototypes`；artifacts 增加原型 manifest/brief/tokens 状态（只读） |
| 前端 | `AgentChatPanel` 占位/reasoning；设计视图自动导出 + 过期提示 + 手动重导；模板库同步状态 |
| 工作区 | `adw-template-req-*` / `adw-template-proto-*`、`design-brief.md`、`tokens.json`、`prototypes/*.png` + manifest；`AGENTS.md` 设计参考段 |
| 表 | 不加表；不迁移旧应用（当前 `apps=0`） |
| 接口 | 新增 1 个 PNG 写入接口；artifacts 只读扩展；其余沿用 |
| 测试 | 后端分发/同步/校验 + PNG 接口；前端占位/reasoning + 导出；e2e p2/p3/p4 扩展 + 新 p6；真实模型 E2E |

---

## 5. 实施拆分（明天开始）

| 阶段 | 内容 | 出口 |
| --- | --- | --- |
| **P6-1** | 聊天占位/reasoning/失败与中止替换；中文指令（三视图 + 4 command + AGENTS） | 前端单测 + e2e 三视图；真实模型一轮中文确认 |
| **P6-2** | 模板即 skill（生成/同步/清理/校验）；方法 skill 改为按 id 加载；模板库同步状态 | 后端测试 + `smoke:assets` + e2e 创建/更新/删除模板 |
| **P6-3** | `design-brief.md`/`tokens.json`/`prototypes` + 自动导出/过期提示/手动重导；开发 prompt/AGENTS；check-consistency 差异清单 | e2e 导出/过期；真实模型"结构/风格一致"验收（人工截图 + 字段断言） |
| **P6-4** | 全量回归、e2e 更新、报告/STATUS/文档 | 后端/前端全绿，报告补 P6 能力 |

---

## 6. 风险与对策

1. **PNG 过期比没有更误导** → manifest hash + UI 黄条 + 开发 prompt 明确"结构以 design.json 为准"；自动导出 + 手动兜底。
2. **自动导出依赖视图打开** → 打开时先比对 hash 并补导；导出失败保留旧图并明确提示。
3. **模板 skill 数量/上下文** → 只生成被选中的模板（每应用 1—2 个），description 精简；方法 skill 只提示 id。
4. **skill 命名冲突/覆盖** → `adw-` 前缀 + 模板 id 安全化；项目级覆盖全局的既有行为保留。
5. **坏 YAML 静默失效** → 分发后 `GET /api/skill` 校验；失败 UI 告警。
6. **中文不保证 100%** → 指令层 + 真实模型验证；代码/命令允许英文。
7. **PNG 上传体积/安全** → 只接受 `data:image/png;base64`、魔数校验、单页/总大小上限、路径白名单。
8. **EOS 后端不吃风格** → prompt/AGENTS 写清 tokens 只约束前端；不承诺后端主题。
9. **旧应用资源清理** → 按 manifest 白名单移除 `adw-template-*`，不碰用户自建 skill；当前 `apps=0`，风险低。

---

## 7. 待明天实施时的第一件事

- 核对当前 `templates/agent/skills` 与 `distribution.ts`，按本稿生成模板 skill；
- 先做 P6-1（独立、低风险），再做 P6-2（布局变化），最后 P6-3（依赖 P6-2 的 tokens 路径）。
