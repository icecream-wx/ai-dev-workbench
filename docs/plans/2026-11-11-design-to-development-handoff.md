# 设计 → 开发交接方案（D5，讨论稿）

日期：2026-11-11
状态：**方案已定稿（2026-11-11），D5 已实施（2026-11-11）**；迭代/变更集完整循环（C1）未实施，见 `docs/plans/2026-11-11-iterative-change-design.md`。上游：需求→设计 H1—H4、设计 D1—D4。
目标：把已确认的实体设计 + 页面原型 + 原型模板 + 需求输入，确定性生成开发交接包，写入 `projects/<app>/docs/handoff/`，并解锁开发阶段。

---

## 1. 核心原则

1. **确定性生成**：交接包由设计数据渲染，不调用 LLM；AI 只在设计阶段生成实体/页面。
2. **自包含**：开发 agent 只读 `docs/handoff/00-README.md` 就能开始，不需要回工作台或数据库。
3. **页面规格是契约，图片是视觉参考**：开发按 `03-PAGES.md` 实现；PNG 用于人看/对照；冲突时以页面规格为准。
4. **模板约束**：原型模板的 Token/Shell/页面模式进入交接包，开发按该模板风格实现；不强制 Vue 目录结构/UI 库。
5. **版本/可追溯**：交接包记录需求文档版本、DesignInput hash、设计项目版本、原型模板 id/版本、文件 hash。
6. **不生成虚构契约**：没有确定性 HTTP 路径/方法时，不生成 OpenAPI；接口由 agent 按页面动作/实体实现。
7. **不做 Git/证据/测试门禁**：开发完成仍由用户确认。

---

## 2. 交接包结构

```text
projects/<app-id>/docs/handoff/
  00-README.md
  01-REQUIREMENTS.md
  02-DATA-MODEL.md
  03-PAGES.md
  04-PLAN.md
  05-CHANGES.md                # 变更集增量（初始版本写“初始开发”）
  schema.sql                    # 参考 DDL
  prototype-template.json       # 原型模板 tokens/shell/patterns/规则
  manifest.json                 # 版本/哈希/文件清单/统计/changeSet
  prototypes/
    <pageSetKey>/
      <pageKey>.png             # 页面原型图片（截图）
      <pageKey>.html            # 可选：DOM 快照（非独立可运行）
```

> 迭代场景见 `docs/plans/2026-11-11-iterative-change-design.md`：每次 Change Set 生成全量交接包 + `05-CHANGES.md` 增量；首次开发也创建 Change Set #1。

### 2.1 `00-README.md`

- 应用名/ID、生成时间、版本信息：
  - 需求文档版本/hash
  - DesignInput id/hash
  - 设计项目版本
  - 原型模板 id/版本
- 一句话目标、范围/不做什么。
- 技术栈：
  - 后端 Java + EOS 9.0.0，`backend/` 是起点，pom 最小依赖；
  - 前端 Vue 3，结构/构建/UI 库由 agent 决定；
  - 数据库 MySQL；不提交真实凭据。
- 阅读顺序：`01 → 02 → 03 → 04`，先看 `prototype-template.json` 和 `prototypes/`。
- 关键约束：
  - `01-REQUIREMENTS.md` 是需求来源；
  - `02-DATA-MODEL.md` + `schema.sql` 是数据模型参考；
  - `03-PAGES.md` 是页面契约，PNG 是视觉参考；
  - 模板 Token/布局要遵守，但不强制具体组件库/目录。
- 完成定义：所有已确认页面/实体实现；构建通过；按 04 自测；输出实现摘要/关键文件/运行方式/自测结果/未解决事项。
- 不要修改交接包文档；不要只输出代码片段；直接实现。

### 2.2 `01-REQUIREMENTS.md`

- 直接使用已确认需求文档 `content_md`（加元数据头）。
- 保留场景/Epic/Story 稳定 ID、验收标准、开放问题。
- 这样开发能追溯到原始需求，而不是二次摘要。

### 2.3 `02-DATA-MODEL.md`

- 实体清单：表名、说明、字段（名称/标签/类型/长度/精度/必填/唯一/默认/选项/ref/备注）、关系。
- Mermaid ER 图。
- 数据约束/校验（字段级；复杂业务规则参见 01）。
- 表命名/类型映射说明。
- `schema.sql` 参考 DDL：
  - 表名使用实体 `tableName`；未填写时用 `t_<entityId sanitized>`；
  - 主键 `id`；不生成真实外键约束，关系以注释/文档表达；
  - 类型映射：string→VARCHAR(255)（有 length 用 length）、text→TEXT、number→DECIMAL/BIGINT（按 precision/scale）、date→DATE、datetime→DATETIME、time→TIME、boolean→TINYINT(1)、enum→VARCHAR(64)+注释选项、ref→VARCHAR(64)（目标主键类型可调整）；
  - 不写真实凭据；DDL 仅参考，开发可按 EOS/MySQL 实际调整。

### 2.4 `03-PAGES.md`

- 原型模板摘要：id/版本/名称、Token（主色/字体/圆角/密度）、Shell（侧栏/顶栏）、页面模式（列表/表单/详情）、页面集规则。
- 页面集清单：场景/Epic、覆盖 Story、涉及实体、页面数量。
- 每个页面：
  - pageKey、标题、类型（list/form/detail/...）、mode（create/edit/both）；
  - 绑定实体、路由建议（不强制）；
  - 列表：列、搜索字段、分页、行操作；
  - 表单：字段、分组、校验、提交动作；
  - 详情：分区/关联列表；
  - 状态：加载/空/错误/无权限；
  - 验收标准、requirementRefs；
  - 原型图片路径（`prototypes/...png`）。
- 页面导航（列表→创建/编辑/详情、返回）。
- 明确：PNG 是视觉参考；页面规格与图片冲突时以规格为准；模板 Token 必须遵守。

### 2.5 `04-PLAN.md`

- 建议实施顺序（不强制）：
  1. 数据模型/DDL → 后端实体 CRUD/服务；
  2. 按页面集实现列表/创建/编辑/详情；
  3. 权限/状态/错误处理；
  4. 自测/验收。
- 按 Epic/页面集的实施清单。
- 测试清单：来自需求 Story 验收标准 + 页面验收；没有单独测试用例时不硬造。
- 验收清单：逐条 Story/页面。
- 风险/开放问题/未覆盖警告。
- 交付格式：实现摘要、关键文件、运行方式、自测结果、未解决事项。

### 2.6 `prototype-template.json`

- 原型模板的 tokens/shell/patterns/pageSetRules/prompt。
- 供开发 agent 读取精确颜色/字体/圆角/密度/页面模式；不强制前端框架。
- 页面规格中引用模板 id/version；模板变更会生成新交接包版本。

### 2.7 `manifest.json`

```json
{
  "appId": "app1",
  "generatedAt": "...",
  "requirements": { "version": 11, "hash": "...", "inputId": "din-..." },
  "design": { "version": 5, "status": "confirmed" },
  "prototypeTemplate": { "id": "builtin-enterprise", "version": 1, "hash": "..." },
  "changeSet": { "id": "cs-2", "seq": 2, "title": "新增客户标签", "baselineHandoffVersion": 1, "currentHandoffVersion": 2 },
  "counts": { "entities": 4, "pageSets": 3, "pages": 12, "stories": 8 },
  "files": [{ "name": "00-README.md", "size": 1234, "hash": "..." }],
  "warnings": []
}
```

- 工作台/开发会话可读取 manifest 校验版本；记录 dev session 使用的 handoff version/hash。

---

## 3. 生成流程

```text
设计确认（或“生成交接包并进入开发”）
  → 校验 readiness + stale + 原型图片 + 引用
  → 渲染 5 份 Markdown + schema.sql + template.json + manifest
  → 复制 PNG（/HTML 可选）到 docs/handoff/prototypes/
  → 写 handoffs 表（version/hash/files/source_design snapshot）
  → 应用 status=development，design_confirmed_at/development_started_at
  → 记录阶段事件
  → 开发页可创建 build 会话；首条提示读 00-README
```

失败（校验/写盘）保持 design，列出 issues/warnings；不切换阶段。

### 3.1 校验（建议）

阻塞：

- 需求文档未确认，或 DesignInput 未绑定/过期（stale）。
- 设计项目未确认，或 readiness 有阻塞。
- 实体/页面集/页面未确认。
- 引用无效（requirementRefs/epicId/storyIds/entityId）。
- 原型模板缺失。
- 页面缺少 PNG 原型（建议阻塞；可讨论是否允许显式跳过）。

警告：

- Story 未覆盖、实体/页面无需求依据。
- 页面集无列表页。
- 没有测试用例（用验收标准替代）。
- HTML 快照非独立页面（如果包含）。
- 开放问题。

### 3.2 状态与版本

- 每次生成递增 handoff version；记录整体/单文件 hash。
- 每次生成绑定 active Change Set（首次创建 #1），并记录 `baseline_handoff_version`；`05-CHANGES.md` 输出相对基线的需求/设计差异。
- `source_design` 保存设计快照（entities/pageSets/pages/template/input id/hash），用于审计。
- 开发会话记录 `handoff_version/hash`；之后重新生成时提示“交接包已更新”，但不强制打断当前会话。
- 设计变更：开发阶段修改设计需要“重新打开设计”并提示开发可能过期；是否允许归档 dev session/重启，后续定。

---

## 4. 开发 agent 如何消费

- 首条提示维持：
  > 请阅读 `docs/handoff/00-README.md`，并按其中文档完成开发。完成后总结...
- **后续变更**的首条提示：
  > 这是第 N 次变更（变更单：...）。请先读 `docs/handoff/05-CHANGES.md`，再读 `00-README.md` 和相关章节；在现有代码上增量实现，保留未变更部分，不要重写整个项目。完成后总结变更点、影响文件、自测结果、未解决事项。
- `00-README` 明确：
  - `01` 是需求来源；
  - `02` + `schema.sql` 是数据模型；
  - `03` + `prototypes/` 是页面契约/视觉参考；
  - `04` 是实施顺序/验收；
  - `prototype-template.json` 是视觉/布局约束。
- **不要让 agent 只依赖 PNG 图片**：图片可能是给人类看的，模型读图能力不保证；页面规格/字段/动作/验收才是可执行契约。
- HTTP 接口：不生成 OpenAPI；agent 按页面动作和实体 CRUD 实现，接口路径/方法由 agent 决定，但需满足页面需求。
- 前端结构/组件库自由；模板 Token/布局模式作为视觉约束。
- 后端沿用 EOS 9.0.0 `backend/`；数据库 MySQL；不提交真实凭据。

---

## 5. 数据/API/UI

### 5.1 数据

- 新表 `design_handoffs`（或不兼容旧 handoffs，直接替换）：
  ```sql
  app_id PRIMARY KEY,
  version, hash, docs_dir, files_json,
  source_design_json,      -- 设计快照
  source_requirements_json,-- 需求版本/input id/hash
  manifest_json,
  created_at
  ```
- 或扩展现有 `handoffs` 增加 `source_design`/`kind`；建议新表避免旧结构混淆（不做存量兼容）。
- 开发会话 `app_sessions` 增加 `handoff_version`/`handoff_hash`（可选）。

### 5.2 API

- `POST /api/apps/:id/design/handoff/preview`：校验 + 渲染，不写盘，返回 files/warnings/issues。
- `POST /api/apps/:id/design/handoff/generate`：写盘 + 版本 + 切开发。
- `GET /api/apps/:id/design/handoff`：最新/指定版本、文件内容/下载。
- `POST /api/apps/:id/design/handoff/regenerate`（后续）：开发阶段重新生成，提示会话过期。
- 复用/替换现有 `/api/apps/:id/handoff/*`；旧 structured 应用不做兼容。
- 开发建会话仍用 `docs/handoff/00-README.md` 存在性校验。

### 5.3 UI

- DesignStudio 顶部：
  - `交接包`（预览/生成/下载）
  - `生成交接包并进入开发`（主按钮；确认弹窗展示 readiness、图片缺失、warnings）
- 交接包对话框：
  - 版本/hash/时间、文件列表、Markdown/JSON 预览、PNG 缩略图/下载；
  - 阻塞 issues/warnings 分区。
- 成功后跳转开发页；开发页右侧显示 handoff 版本/原型缩略图（可选）。
- AppShell 对 doc/design 应用恢复交接包入口（D5 前隐藏）。

---

## 6. 与当前代码的差异

- 现有 `backend/src/handoff/*` 基于 modules/cards/Spec（P3/P5）；D5 需要新的 design bundle/render。
- 建议新增 `backend/src/handoff/design-bundle.ts` / `design-render.ts` / `design-service.ts`，旧代码保留未挂载，R4 清理。
- `01-REQUIREMENTS.md` 改为需求文档；`02-DATA-MODEL.md`/`03-PAGES.md` 来自设计项目；`schema.sql` 来自实体。
- 旧 `02-DESIGN.md` 不再使用；文件列表变化，HandoffDialog/DevView 需适配。
- 开发首条提示不变。

---

## 7. 实施拆分（建议）

| 阶段 | 内容 |
| --- | --- |
| D5-1 | design handoff bundle/render：00/01/02/03/04/05 + schema + template + manifest；validation；单测 |
| D5-2 | Change Set #1/#N + 写盘/版本/hash/source_design；API preview/generate/get |
| D5-3 | DesignStudio 交接包 UI + 生成并进入开发；HandoffDialog 适配；AppShell 入口 |
| D5-4 | 开发状态切换/阶段事件/DevView handoff 版本；开发会话创建验证；初次/变更首条提示 |
| D5-5 | 真实模型/Playwright E2E；文档/STATUS |

---

## 8. 已确认（2026-11-11）

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 交接包结构 | `00-README / 01-REQUIREMENTS / 02-DATA-MODEL / 03-PAGES / 04-PLAN / 05-CHANGES / schema.sql / prototype-template.json / manifest.json / prototypes/` |
| 2 | PNG | 每个页面必须有 PNG 才能生成交接包；缺图阻塞。 |
| 3 | HTML | 可选放入 `prototypes/`，只作参考；页面规格为主。 |
| 4 | 模板约束 | Token/Shell/页面模式强约束；Vue 目录/UI 库自由。 |
| 5 | DDL/接口 | `schema.sql` 参考 DDL，不生成真实外键；不生成 OpenAPI，接口由页面动作/实体推导。 |
| 6 | 生成/进入开发 | 一个主按钮“生成交接包并进入开发”+ 预览弹窗；失败留在设计。 |
| 7 | 版本 | 开发会话固定 handoff version/hash；重新生成时提示，不静默打断。 |
| 8 | 图片消费 | 页面规格是契约，PNG 是视觉参考；不让 agent 只靠图片猜。 |
| 9 | 迭代 | 首次创建 Change Set #1；后续变更全量 + `05-CHANGES`；每次变更新会话，旧会话只读；详见迭代方案。 |
| 10 | 删除项 | 开发 agent 按 `05-CHANGES` 删除代码/测试；DB 迁移需确认；工作台不直接删文件。 |

---

## 9. 实施结果（D5，2026-11-11）

已按本方案实施，只做 Change Set #1 与首次交接；C1（#2/reopen/历史面板/删除代码）未做。

- 后端新增 `backend/src/handoff/design-{types,bundle,render,service,routes}.ts`：
  - `design-bundle.ts`：稳定编号 `ENT/PS/PAGE`（文档不出现工作台内部 ID），原型路径 `prototypes/ps-00N/page-00N.png`；
  - `design-render.ts`：确定性渲染 00—05 + `schema.sql` + `prototype-template.json` + `manifest.json`（DDL 类型映射、无真实外键/凭据）；
  - `design-service.ts`：校验（需求确认/设计确认/输入未过期/引用有效/每页 PNG 存在且签名有效）、预览（不写盘/不建变更单）、生成（写盘/版本/hash/原型复制）、读取（最新 + 历史元数据）、重新生成、应用删除清理；
  - `design-routes.ts`：`POST /design/handoff/preview|generate`、`GET /design/handoff`、`GET /design/handoff/files/*`（PNG `image/png`，HTML 以 text/plain 附件，路径穿越 400）。
- 数据：
  - `app_change_sets`（seq/title/scope/status/base_*/current_*，首次 `seq=1 · 初始开发`）；
  - `design_handoffs`（每次生成一行：version/hash/files/change_set_id/baseline/source_design/source_requirements/manifest）；
  - `apps.current_change_set_id`；`app_sessions.change_set_id/handoff_version/handoff_hash`。
- 状态/阶段：
  - 生成成功后 `apps.status` 从 `design → development`，写 `design_confirmed_at`/`development_started_at`/`handoff_hash`；
  - 已在开发/完成阶段重新生成只递增版本、复用当前变更单，不切换阶段、不打断会话；
  - 确认完成时关闭当前变更单；完成后继续发送消息会把最近变更单恢复为 `development`。
- 开发会话：创建时记录 handoff 版本/hash/change_set_id，开发页显示 `交接包 vN · 初始开发`；交接文档列表读写设计交接包（PNG 可预览）。
- UI：
  - DesignStudio 顶部新增“交接包”与主按钮“生成交接包并进入开发”；确认设计后主按钮切换；预览弹窗按阻塞/提示分区，文件列表支持 Markdown/JSON/SQL 文本与 PNG 预览；成功后自动进入开发页；
  - AppShell 对 doc 模式开发/完成阶段恢复“交接包”入口（打开设计交接包弹窗）；
  - 旧 structured 应用仍使用旧 P3 交接包弹窗，互不影响。
- 已知限制：
  - 磁盘只保留最新版本的 `docs/handoff/` 文件；历史版本可查元数据/文件清单/manifest，但文件已被覆盖（`filesAvailable=false`，不返回 PNG URL）；预览（未写盘）也不返回 PNG URL；
  - `prototype-template.json` 没有模板 version 字段，用模板 hash + updatedAt 追溯；
  - 需求开放问题/Story 未覆盖/无需求依据只作为提示，不阻塞；
  - 每次生成都写生成时间，Spec 不变也会产生新版本/hash。
