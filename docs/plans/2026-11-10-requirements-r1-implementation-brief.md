# 需求阶段文档化 R1 实施交接单

日期：2026-11-10
用途：**新开实现会话**使用；当前会话保留为设计/评审会话，不重复讨论已定方向。
上游方案：`docs/plans/2026-11-10-requirements-stage-doc-design.md`（已定稿）
相关记录：`docs/test-issues-2026-11-09.md` I-11；`docs/STATUS.md`
基线约定：`AGENTS.md`

---

## 1. 一句话目标

把需求阶段从“场景树 + 卡片”改成“左侧 AI 对话/构建活动 + 右侧模板化 Markdown 需求文档”，文档按章节持久化，支持模板中心、首次 AI 生成、手动编辑、章节“问 AI”、确认需求、删除应用。

本轮只做 **R1（MVP）**；R2/R3 另排。

---

## 2. 必读顺序

1. `AGENTS.md`
2. `docs/plans/2026-11-10-requirements-stage-doc-design.md`（本任务唯一有效设计）
3. `docs/STATUS.md` 的“测试问题修复”“未验证/已知限制”“后续”
4. `docs/test-issues-2026-11-09.md` 的 I-11（决策来源）
5. 代码入口：
   - `backend/src/db.ts`、`backend/src/apps/routes.ts`、`backend/src/apps/scaffold.ts`
   - `backend/src/chat/service.ts`、`backend/src/opencode/runtime.ts`
   - `frontend/src/workbench/AppShell.vue`、`frontend/src/requirements-grooming/ui/main-app.vue`
   - `frontend/src/requirements-grooming/ui/views/RequirementsView.vue`、`ui/doc-template-store.ts`、`ui/TemplateDialog.vue`
   - `frontend/src/requirements-grooming/conversation/protocol-output.js`、`protocol.ts`、`conversation/store.ts`

---

## 3. 已定稿决策（不要重新讨论）

- **文档/章节是需求阶段唯一事实来源**；整篇 Markdown 是章节拼接快照。
- **章节化持久化**：`app_requirement_doc_sections` 为核心表；`content_md` 为缓存；版本保存整篇 + 章节快照。
- **不做存量兼容**：卡片/场景树在文档模式下线；提供删除应用入口；旧应用由用户删除。
- **编辑器**：Markdown 章节编辑器 + 预览/源码模式，不做 WYSIWYG。
- **模板**：全局库 + 应用只保存模板 id；参考后重新设计，不照搬；内置只读，复制后保存为“我的模板”。
- **标准 PRD 13 节**；**精简 PRD 6 节**；Business Strategy / QA Test Plan 作为后续阶段模板（需求阶段不可选）。
- **待澄清不硬阻塞**；场景树移除，场景进入“业务场景与流程”章节。
- **每章节“问 AI”**：对话焦点定位到章节，默认只改该章节。
- **Epics & User Stories 作为设计阶段需求点来源**（R3 再打通设计/交接包；R1 至少支持文档 → `01-REQUIREMENTS.md` 只读导出）。
- 真实模型用 `packycode-deepseek/deepseek-flash`；不要读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 4. R1 范围

### 4.1 后端

1. `db.ts` 新表：
   - `requirement_templates`
   - `app_requirement_docs`
   - `app_requirement_doc_sections`
   - `app_requirement_doc_versions`
2. 内置模板 seed：
   - 工作台标准 PRD（13 节，默认）
   - 精简 PRD（6 节）
   - Business Strategy（stage=requirements，可选；不进设计）
   - Generic QA / Test Plan（stage=test，需求阶段不可选）
3. 模板 API：
   - `GET /api/requirement-templates?stage=requirements`
   - `POST /api/requirement-templates`
   - `PUT /api/requirement-templates/:id`
   - `DELETE /api/requirement-templates/:id`
   - `POST /api/requirement-templates/:id/duplicate`
4. 文档 API：
   - `GET /api/apps/:id/requirements-doc`（无则按默认模板创建空文档）
   - `PUT /api/apps/:id/requirements-doc/sections/:key`（自动保存单章节）
   - `PUT /api/apps/:id/requirements-doc`（高级全文保存，解析回章节）
   - `POST /api/apps/:id/requirements-doc/confirm`（必填章节校验 + 切阶段）
   - `GET /api/apps/:id/requirements-doc/versions`
   - `GET /api/apps/:id/requirements-doc/versions/:v`
   - `POST /api/apps/:id/requirements-doc/versions/:v/rollback`
5. 应用模型：
   - 新应用默认 `requirements_mode='doc'`；旧行默认 `structured`（仅过渡，R4 清理）。
   - 应用详情返回 `requirementsMode`。
6. 聊天：
   - `POST /api/apps/:id/chat` 增加 `mode:'doc'`、`templateId`、`focusSectionKey`。
   - doc 模式构建模板化 prompt，要求输出 `<<<DOC_JSON>>>`（完整 doc 或 sections + nextSteps + openIssues）。
   - 生成/修改仍走短暂 opencode 会话 + SSE。
7. 删除应用：
   - 后端已有 `DELETE /api/apps/:id?confirm=true`；确认会清理目录/登记/会话/交接包。
8. `01-REQUIREMENTS.md` 导出：
   - R1 至少提供一个只读导出（可以用现有 handoff preview 的接口扩展，或独立 `GET /api/apps/:id/requirements-doc/export`）；R3 再接交接包。

### 4.2 前端

1. 需求文档模式：
   - `AppShell` / `MainApp` 根据 `requirementsMode` 渲染新的 `RequirementsDocView`。
   - 文档模式不渲染场景树/批次/卡片。
2. 右侧文档：
   - 模板 badge + 章节大纲 + 章节 Markdown 编辑块 + 工具栏 + 保存状态 + 预览/源码切换 + 版本历史。
   - 自动保存章节；确认需求按钮。
3. 左侧：
   - AI 对话（可复用现有 ChatPanel 的流式/消息样式，但用 doc 协议）。
   - 构建活动：已收到请求 / 已选择模板 / 文档已创建 / 待审核 / 可生成设计。
   - 接下来做什么：必填章节缺失、待澄清、AI nextSteps；点击可发送/定位。
   - 章节“问 AI”：点击设置 `focusSectionKey`，composer 显示当前章节 chip。
4. 模板中心：
   - 列表/分类/搜索/预览/使用中；内置只读；复制并编辑/新建；保存为我的模板。
5. 首页/应用详情：
   - 删除应用按钮（二次确认）。
6. 初始生成：
   - 新应用进入需求阶段先选模板（默认标准 PRD）；首条需求描述后生成初稿。
   - R1 可先自动应用全文并生成版本；diff/应用/忽略可放 R2。

---

## 5. 数据/协议要点

- 章节 key 来自模板；用户新增章节用 `custom-*`。
- 文档状态：`draft → review → confirmed`。
- 确认校验：必填章节 Markdown 非空；至少一个 Epics/User Story（PRD）；待澄清只做 warnings。
- `<<<DOC_JSON>>>` 示例：

```json
{
  "doc": "完整 Markdown",
  "sections": [{ "id": "problem", "markdown": "..." }],
  "nextSteps": [{ "label": "细化权限模型", "prompt": "请细化..." }],
  "openIssues": { "add": [{ "question": "..." }] }
}
```

- `focusSectionKey` 请求参数：后端注入当前章节正文 + 其他章节标题，要求默认只改当前章节。
- Markdown 渲染禁用原始 HTML（沿用现有 MarkdownIt 配置）。

---

## 6. 验证要求

- `npm test --prefix backend`、`npm run build --prefix backend`
- `npm test --prefix frontend`、`npm run typecheck --prefix frontend`、`npm run build --prefix frontend`
- 新增后端单测：模板 seed/文档章节保存/确认校验/版本回滚。
- 新增前端单测：DOC_JSON 解析、章节合并、必填校验。
- Playwright/真实模型：
  - 新应用选择模板 → 首条需求 → 生成文档初稿 → 手动编辑章节 → 保存；
  - 章节“问 AI” → 焦点 chip → AI 修改只影响该章节；
  - 确认需求 → 状态/阶段正确；
  - 删除应用 → 目录/登记/会话/交接包清理；
  - 0 console error、0 意外 API >=400。
- 真实模型使用 `packycode-deepseek/deepseek-flash`。

---

## 7. 实施顺序建议

1. 后端表 + seed + 模板 API（先跑单测）。
2. 文档 API + 章节保存 + 确认 + 版本。
3. 应用 `requirements_mode` + 删除应用前端入口。
4. 前端文档页骨架（模板选择 + 章节编辑器 + 手动保存）。
5. 聊天 doc 模式 + 初始生成 + 构建活动/下一步。
6. 章节“问 AI” + 焦点。
7. 端到端验证 + 更新 `docs/STATUS.md`。

---

## 8. 边界

- 不在 R1 重构设计阶段/交接包（R3 再做）；但需求确认后设计阶段不能悄悄读旧卡片，需给出明确的“R3 未接通”提示或临时只读导出。
- 不继续扩展旧场景树/卡片/批次逻辑。
- 不引入 WYSIWYG、多人协作、模板市场。
- 不提交真实凭据；不打印 DB 密码。
- 实现完成后把问题、根因、改动、验证命令/结果、未验证项写入 `docs/STATUS.md`，并回传当前会话评审。

---

## 9. R1 完成后必须提醒用户

R1 完成并回传评审后，主动提醒进入下一轮讨论，不要直接继续铺开：

1. **设计阶段优化**（承接 I-06/I-08）
   - 设计待办：按需求文档的 Epics/Stories 显示未拆解/拆解中/已拆解/无需拆解。
   - 交接包 readiness：阻塞错误 vs 警告，完成设计前检查。
   - 模板：设计阶段模板（技术设计/架构方案）与需求模板分开。
   - 设计阶段如何读取文档、如何生成设计单元。
2. **开发阶段优化**（承接 I-09/I-10）
   - 左侧会话列表（Codex 风格）：查看/切换/重命名/归档/恢复全部会话。
   - 长会话：会话健康度 + opencode 原生 compact；交接包大时可选分阶段、一阶段一会话。
   - 开发阶段模板/计划：Task Breakdown 模板、阶段 brief。
3. **R2/R3 收尾**
   - R2：章节“问 AI” diff、模板复制编辑、构建活动/下一步完善。
   - R3：设计阶段读取文档/Epics、交接包 `01-REQUIREMENTS` 改用文档、设计待办。
4. **旧数据清理**
   - 删除测试应用、清理旧场景/卡片/旧模板 UI 与代码（R4）。

