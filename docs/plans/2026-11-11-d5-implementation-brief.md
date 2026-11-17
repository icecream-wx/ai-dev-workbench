# D5 设计 → 开发交接实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；当前主会话继续设计/评审。
状态：**D5 已实施（2026-11-11）**；实施结果见 `docs/plans/2026-11-11-design-to-development-handoff.md` §9 与 `docs/STATUS.md`「D5 完成」。
上游方案：`docs/plans/2026-11-11-design-to-development-handoff.md`（已定稿）、`docs/plans/2026-11-11-iterative-change-design.md`（已定稿）。
范围：**D5**（交接包 + Change Set #1 基础设施 + 初次开发进入）；完整变更循环（从已完成应用发起 Change Set #2、历史面板等）作为 **C1 后续**，不在本轮铺开。

---

## 1. 一句话目标

设计确认后，确定性生成开发交接包（需求/数据模型/页面原型/模板/计划/DDL/manifest），写入 `projects/<app>/docs/handoff/`，创建 Change Set #1，切换应用为 development，开发 agent 只读交接包即可开始。

---

## 2. 必读

1. `AGENTS.md`
2. `docs/STATUS.md`（R1/D1—D4/H1—H4 评审与遗留）
3. `docs/plans/2026-11-11-design-to-development-handoff.md`（已定稿）
4. `docs/plans/2026-11-11-iterative-change-design.md`（已定稿，Change Set 基础）
5. 代码：
   - `backend/src/design/service.ts`、`routes.ts`、`types.ts`
   - `backend/src/requirements/doc.ts`、`outline.ts`、`design/input.ts`
   - `backend/src/handoff/*`（旧 P3/P5 结构化交接包，仅参考）
   - `frontend/src/design/DesignStudio.vue`、`PrototypeTab.vue`
   - `frontend/src/workbench/AppShell.vue`、`frontend/src/dev/DevView.vue`

---

## 3. 已确认决策

- 交接包结构：`00-README / 01-REQUIREMENTS / 02-DATA-MODEL / 03-PAGES / 04-PLAN / 05-CHANGES / schema.sql / prototype-template.json / manifest.json / prototypes/`。
- PNG：每个页面必须有 PNG 才能生成交接包；缺图阻塞。
- HTML：可选放入 `prototypes/`，只作参考；页面规格为主。
- 模板：Token/Shell/页面模式强约束；Vue 目录/UI 库自由。
- DDL：`schema.sql` 参考 DDL；不生成真实外键；不生成 OpenAPI（接口由页面动作/实体推导）。
- 生成/进入开发：一个主按钮“生成交接包并进入开发”+ 预览弹窗；失败留在设计。
- 版本：开发会话固定 handoff version/hash；重新生成时提示，不静默打断。
- 图片消费：页面规格是契约，PNG 是视觉参考。
- 首次开发创建 Change Set #1，UI 显示“初始开发”；`05-CHANGES.md` 初始版写“初始开发（无基线差异）”。
- 删除项/完整变更循环（C1）本轮不实现；`05-CHANGES` 先支持初始版本。

---

## 4. 数据模型

### 4.1 Change Set（基础）

```sql
app_change_sets (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL,          -- requirements | design
  status TEXT NOT NULL,         -- requirements | design | development | completed | cancelled
  base_requirements_version INTEGER,
  base_design_version INTEGER,
  base_handoff_version INTEGER,
  base_input_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
)
```

- `apps.current_change_set_id`；初始 #1 在生成 handoff 时创建。
- 本轮只创建 #1、记录状态；完整发起变更/取消/历史面板留 C1。
- 预留 change_set_id 到需求版本/设计 input/设计版本/handoff/dev session；本轮至少 handoff/dev session 落地。

### 4.2 Handoff

新表 `design_handoffs`（不建议复用旧 `handoffs` 结构）：

```sql
app_id PRIMARY KEY,
version, hash, docs_dir, files_json,
change_set_id,
baseline_handoff_version,
source_design_json,          -- 设计快照
source_requirements_json,    -- 需求版本/input id/hash
manifest_json,
created_at
```

- 旧 `handoffs` 基于 modules/cards/Spec，不兼容；新表避免混淆。
- 需求/设计/交接包版本可追溯；文件 hash 写入。

---

## 5. 交接包渲染

新增 `backend/src/handoff/design-*`（或 `design/handoff/*`）：

- `design-bundle.ts`：汇总 requirements doc、DesignInput、entities、pageSets/pages、prototype template、change set。
- `design-render.ts`：确定性渲染 00—05 文档、schema、template、manifest。
- `design-service.ts`：校验、写盘、版本/hash、状态切换。

### 5.1 文件内容

- `00-README.md`：版本信息、技术栈、阅读顺序、完成定义、限制（PNG 视觉参考、页面规格契约、模板约束、无 OpenAPI、无真实凭据）。
- `01-REQUIREMENTS.md`：已确认需求文档 `content_md` + 元数据/ID。
- `02-DATA-MODEL.md`：实体/字段/关系/ER/约束 + 类型映射说明。
- `03-PAGES.md`：模板摘要、页面集、每页字段/动作/状态/验收/requirementRefs、PNG 路径、导航。
- `04-PLAN.md`：实施顺序、按 Epic/页面集清单、测试/验收、风险/开放问题、交付格式。
- `05-CHANGES.md`：初始版“初始开发（无基线差异）”；后续 C1 再做 diff。
- `schema.sql`：参考 DDL；表名 `tableName` 或 `t_<entityId>`；主键 id；不生成真实外键。
- `prototype-template.json`：tokens/shell/patterns/pageSetRules。
- `manifest.json`：版本/hash/文件/统计/changeSet（#1）。
- `prototypes/<pageSet>/<page>.png`：复制设计快照；HTML 可选。

### 5.2 DDL 映射

- string → VARCHAR(length/255)
- text → TEXT
- number → DECIMAL/BIGINT（按 precision/scale）
- date/datetime/time → DATE/DATETIME/TIME
- boolean → TINYINT(1)
- enum → VARCHAR(64) + 注释选项
- ref → VARCHAR(64)（目标主键类型可调整）
- 不生成真实外键；不写真实凭据。

---

## 6. 校验

阻塞：

- 需求文档未确认；DesignInput 未绑定或 stale。
- 设计项目未 confirmed / readiness 有 issues。
- 实体/页面集/页面未确认。
- requirementRefs/epicId/storyIds/entityId 引用无效。
- 原型模板缺失。
- 任一页面缺少 PNG 快照。

警告：

- Story 未覆盖、实体/页面无需求依据；
- 页面集无列表页；
- 无测试用例（用验收标准）；
- 开放问题；
- HTML 非独立页面（如包含）。

失败保持 design，返回 issues/warnings，不切换阶段。

---

## 7. 流程

```text
设计确认 / 生成交接包并进入开发
  → 校验
  → 创建/复用 Change Set #1
  → 渲染 + 写盘 + hash + design_handoffs
  → app.status=development, design_confirmed_at/development_started_at
  → stage event
  → 开发页新会话；handoff version/hash 写入 session
```

开发首条提示：

- 初次：`请阅读 docs/handoff/00-README.md...`
- 本轮只做初次；后续变更提示在 C1。

---

## 8. API/UI

API：

- `POST /api/apps/:id/design/handoff/preview`（校验/渲染，不写盘）
- `POST /api/apps/:id/design/handoff/generate`（写盘/版本/切开发）
- `GET /api/apps/:id/design/handoff`（最新/指定版本/文件内容）
- `GET /api/apps/:id/design/handoff/files/:name`（可选）
- `POST /api/apps/:id/development/session`：创建时记录 handoff_version/hash/change_set_id（字段可先加，UI 显示）。

UI：

- DesignStudio 顶部：`交接包`（预览/生成/下载）、`生成交接包并进入开发` 主按钮。
- 预览弹窗：版本/hash/时间、文件列表、Markdown/JSON 预览、PNG 缩略图、阻塞/警告分区、缺图提示。
- 成功后跳转开发；AppShell 恢复 doc/design 应用交接包入口。
- 开发页/右侧显示 handoff 版本（可选）。

---

## 9. 实施顺序

1. 数据表：`app_change_sets`、`design_handoffs`、change_set 字段；初始 #1 创建。
2. design bundle/render：00—05 + schema/template/manifest；单测。
3. 校验 + preview/generate API + 写盘/hash/版本。
4. 状态切换/阶段事件/开发会话 handoff 字段。
5. DesignStudio 交接包 UI + 生成并进入开发；AppShell/DevView 适配。
6. 验证/文档/STATUS。

---

## 10. 验证

- backend：`npm test --prefix backend`、`npm run build --prefix backend`；新增 handoff render/DDL/manifest/validation/change set #1 测试。
- frontend：`npm test --prefix frontend`、`npm run typecheck --prefix frontend`、`npm run build --prefix frontend`。
- smoke：新增/扩展 `smoke:design-handoff`：需求→设计→实体/页面/PNG→preview→generate→文件/hash/版本→app status development→dev session 创建。
- Playwright：DesignStudio 生成交接包并进入开发；文件列表/PNG 缩略图；0 console error/0 API >=400。
- 真实模型可选：开发会话读 00-README 并回复；不要求实现完整应用。
- 不提交真实凭据；不打印 DB 密码。

---

## 11. 边界

- 本轮不做 C1：发起 Change Set #2、需求/设计 reopen、变更历史面板、`05-CHANGES` diff、删除代码；只做 Change Set #1 基础和初次交接。
- 不做 OpenAPI/真实外键。
- 不做旧 structured 应用兼容；旧 handoff 代码不挂载，R4 清理。
- 不强制 Git/证据/测试门禁。
- 完成后更新 `docs/STATUS.md`，回传主会话评审。

---

## 12. 完成后提醒

D5 完成后回主会话讨论：
1. C1：完整迭代/变更流程（Change Set #2、reopen、sync、新 handoff、新会话、历史面板、删除代码）。
2. R2：需求 AI diff/应用/忽略、模板编辑、版本清理、R1 遗留。
3. 开发阶段：I-10 会话列表、I-09 长会话 compact/分阶段。
