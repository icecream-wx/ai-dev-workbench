# R2a 需求 AI 建议 / P1 收尾实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已完成（2026-11-11，实施会话）**；结果与偏差见文末 §9。
上游：`docs/plans/2026-11-10-requirements-stage-doc-design.md`（R1 方案）、R1 评审、H1—H4、C1、`docs/STATUS.md`。
范围：**R2a**——需求 AI 修改「先预览、章节勾选、应用/忽略」、R1 两个 P1（doc 路由 mode 守卫、模板删除保护）、模板复制编辑完善。**R2b（版本策略）单独一轮**；不做 R2b/I-09/I-10/R4。

---

## 1. 已确认决策

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | AI 修改交互 | **先预览后应用**：`<<<DOC_JSON>>>` 解析后不落库，显示“AI 建议”卡片；按章节勾选，点“应用选中”才写库；“忽略”不产生版本。 |
| 2 | 版本策略 | R2a **不改**自动保存/版本生成；R2b 单独做（自动保存不生成版本、关键节点生成 + 保留策略；先需求后设计）。 |
| 3 | 模板章节 key | **不可改**：key 是章节唯一标识；只允许改标题/层级/类型/必填/撰写提示/顺序；新增章节时确定 key。 |
| 4 | 拆分 | R2a 一轮（本单）+ R2b 版本策略单独一轮。 |

---

## 2. P1 收尾（先做，独立于 AI 卡片）

### 2.1 `requirements-doc` 路由 mode 守卫

- `backend/src/requirements/routes.ts` 的 `requirementDocRoutes` 增加 router 级中间件：
  - 查 `apps.requirements_mode`；应用不存在 → 404；非 `doc` → 409「该应用是旧 structured 需求模式，不支持需求文档；请新建应用或使用旧界面」。
  - 覆盖 `GET /`、`PUT /sections/:key`、`PUT /`、`PUT /template`、`POST /confirm`、`POST /outline/rebuild`、`POST /reopen`、`GET /versions`、`GET /versions/:v`、`POST /versions/:v/rollback`、`GET /export`、`GET/PUT /chat`、新增 `POST /preview`。
- `backend/src/chat/service.ts`：`body.mode === 'doc'` 时同样要求 `requirements_mode='doc'`，否则 409；`mode==='design'` 已由设计服务守卫，保持。
- 补测试：structured 应用的 doc GET/PUT/confirm/preview 与 doc 聊天均 409，且不会创建 `app_requirement_docs` 行。

### 2.2 需求模板删除保护

- `backend/src/requirements/templates.ts` `deleteTemplate`：
  - 内置模板只读（现有）；私有模板若被 `app_requirement_docs.template_id` 使用 → 400「模板正在被 N 个应用使用，不能删除」。
- 补测试：使用中删除 400；未使用可删；内置仍 400。
- 保留 `ensureRequirementDoc` 的默认模板回退作为防御（正常不应再触发）。

### 2.3 复核“确认后可重新编辑”

- 已由 H4 `reopenRequirementDoc` 解决；补一条聚焦回归：确认需求 → reopen → 编辑 → 再确认（文档/应用状态/版本正确）。不重复实现。

---

## 3. AI 建议：数据/API

### 3.1 预览接口（不写库）

`POST /api/apps/:id/requirements-doc/preview`

请求（二选一）：

```json
{ "contentMd": "..." }                    // AI 全文
{ "sections": [{ "id": "goals", "title": "...", "markdown": "...", "level": 2, "data": {} }], "title": "..." }
```

返回：

```json
{
  "title": "文档标题",
  "sections": [
    { "sectionKey": "goals", "title": "目标与成功指标", "level": 2, "kind": "markdown",
      "markdown": "...", "data": {}, "required": true,
      "change": "added|modified|unchanged" }
  ],
  "removed": [{ "sectionKey": "custom-x", "title": "旧章节", "required": false }],
  "warnings": []
}
```

- 复用 `requirements/doc.ts` 现有解析/映射：抽 `previewDoc(appId, input)`，与 `saveDoc` 同一套 `parseContentMd` / `mapParsedSections` / `applySectionUpdates`，**不调用 `persistDocContent`**。
- `removed` 只包含可删除的章节（非模板必填、非内置必填）；必填章节缺失放进 `warnings`（例如“必填章节「范围与约束」在本轮未出现，将保留原内容”）。
- 返回的 `markdown`/`data` 是**建议内容**，前端用于 diff；不落库、不产生版本。
- 守卫：doc mode（§2.1）；文档已确认只读时返回 409（与保存一致），避免对只读文档生成可应用建议。

### 3.2 应用接口（扩展 `PUT /requirements-doc`）

- 在 `saveDoc` 输入增加可选 `removeSectionKeys?: string[]`：
  - 仅允许删除 `custom-*` 且非模板必填的章节；必填/模板章节出现则忽略并给 warning。
  - 与 `sections` 更新同一事务，生成一个版本（`source='ai'`，snapshot）。
- 前端“应用选中”只提交勾选的 `sections` + `removeSectionKeys`，避免把未勾选章节写回。
- `openIssues.add`：前端在建议卡片提供“同时写入待澄清问题”勾选项；勾选时把条目追加到 `issues` 章节（若当前文档没有该章节，则给出 warning 不强行创建），随应用一起保存。
- `nextSteps` 不写文档、不产版本，沿用现有对话消息持久化。

---

## 4. AI 建议：前端

- 新增 `frontend/src/requirements/doc-diff.js` + `doc-diff.test.mjs`（node --test）：
  - `diffDocSections(currentSections, previewSections, removed)` → 每节 `added/modified/unchanged/removed`、标题变化、行级 diff（LCS，输出 `+/-/ ` 行；大文本截断）。
  - `buildApplyPayload(selection, { title, includeIssues, issues })` → `{ title?, sections, removeSectionKeys }`。
  - 纯函数，不依赖 Vue/DOM。
- 新增 `frontend/src/requirements/AiSuggestionCard.vue`：
  - 头部：`AI 建议修改` + 计数（新增 X / 修改 Y / 删除 Z / 未变 N）；
  - 章节列表：复选框（默认勾选 added/modified；unchanged 不显示或禁用；removed 需确认且标注“可删除”/“必填不可删”）；
  - 展开行级 diff（旧/新对比，`+`/`-` 着色）；
  - 标题变更行；
  - `待澄清问题`/`下一步` 展示 + “同时写入待澄清问题”勾选；
  - 按钮：`应用选中`（主）、`全部应用`、`忽略`；`readonly`/`streaming` 禁用。
- `DocChatPanel.vue`：
  - 收到 `<<<DOC_JSON>>>` 后：`doc` → 调 `/preview`；`sections` → 本地 `mergeDocSections` 生成 proposal（同样走 `doc-diff`）。
  - **不自动调用保存**；push assistant 消息 + `suggestion` 负载；notice 改为“已生成 AI 建议，请选择要应用的章节”。
  - 应用：调 `saveDocFull`（带选中 sections/removeSectionKeys/title/source ai），成功 notice “已应用 AI 修改（vN，X 章节）”，emit `doc-changed`；失败保留建议卡可重试。
  - 忽略：notice “已忽略本轮 AI 建议”，不写库。
  - 建议卡随消息持久化（`PUT /chat`），刷新后仍可应用/忽略；建议内含 `baseVersion`（生成建议时的文档版本），应用前若文档版本已变化则提示“文档已更新，建议重新生成”并禁用应用。
  - 已确认/只读：卡片只读，应用/忽略禁用或忽略可用（不写库）。
- `doc-prompt.ts`：要求模型对已有章节返回原 `sectionKey`（`id` 不变）、只输出需要修改的章节、不要删除必填章节、`openIssues.add` 只放真正待澄清问题。
- `RequirementsDocView.vue`：不需要大改；确保 `doc-changed` 刷新文档、版本、大纲。

---

## 5. 模板复制编辑完善

- `TemplateCenterDialog.vue`：
  - 私有模板编辑：章节列表可上移/下移/新增/删除；编辑标题、层级（2/3）、类型（markdown / issues / scenes / epics 等）、必填、撰写提示；
  - `key`（section id）在新增时输入并校验（`^[a-z0-9-]+$` 且唯一），保存后只读显示“章节 key（不可修改）”；
  - 内置模板只读，复制后可编辑；
  - 保存前校验：至少 1 节、key 唯一、必填节存在；错误在弹窗内展示，不关闭。
- 后端 `PUT /requirement-templates/:id`：保持内置只读；校验 key 唯一/格式/必填；对已有 key 不做“改名”语义（前端不提供），若提交的 sections 缺少原 key 视为删除，正常允许。
- 删除保护见 §2.2。

---

## 6. 不做 / 边界

- 不做 R2b 版本策略：普通章节自动保存仍生成版本；版本保留/压缩留 R2b。
- 不做设计版本、交接包、页面规格、PNG 版本等改动（留 R2b/R4）。
- 不做逐字 diff 编辑器合并、在线协同、AI 直接删除必填章节。
- 不做 R2b、I-09、I-10、R4。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 7. 验证

后端：

- `npm run build --prefix backend`
- `npm test --prefix backend`（新增：doc mode 守卫、模板删除保护、preview 不写库/不产版本/removed/必填 warning、removeSectionKeys、确认后 reopen 回归、doc 聊天守卫）
- `npm run smoke:requirements` 扩展：structured 应用 doc 路由 409；preview → 应用选中 → 版本/内容正确；ignore 不产版本；模板使用中删除 400。
- 回归：`smoke:change-set`、`smoke:design-handoff`、`smoke:design`、`smoke:handoff-input`。

前端：

- `npm test --prefix frontend`（新增 doc-diff：新增/修改/删除/未变/行 diff/应用载荷/必填不可删）
- `npm run typecheck --prefix frontend`、`npm run build --prefix frontend`
- Playwright + 真实模型（`packycode-deepseek/deepseek-flash`）：需求对话返回建议卡 → **未点击前文档版本不变** → 取消勾选部分章节 → 应用选中 → 版本只更新选中章节 → 忽略不产版本；模板编辑 key 只读 + 使用中删除 400；0 console error / 0 非预期 API >=400。模型不可用时记录原因，并用前端单测 + mock 验证卡片逻辑。

文档：更新 `docs/STATUS.md`（R2a 完成/评审）、本交接单状态与实施结果、`docs/plans/2026-11-10-requirements-stage-doc-design.md`（AI diff 落地）、`2026-11-11-main-review-handoff.md`。

---

## 8. 完成后回传

列出：改动文件、命令/结果、真实模型验证与未验证项、与本文档偏差、需主会话决策的问题。主会话再评审。

---

## 9. 实施结果（2026-11-11，实施会话）

### 改动

后端：

- `requirements/routes.ts`：`requireDocMode` router 级中间件（应用不存在 404、非 doc 409）覆盖全部 doc 端点；新增 `POST /requirements-doc/preview`。
- `requirements/doc.ts`：新增 `previewDoc`（复用 `parseContentMd` / `mapParsedSections` / `applySectionUpdates` / `syncStructuredAfterFullSave`，**不写库、不产版本**；已确认 409；`removed` 仅自定义可选章节，必填/模板可选章节缺失只 warning）；`saveDoc` 支持 `removeSectionKeys`（仅 `custom-*` 且非必填，忽略并 warning，与 sections 同一版本）。
- `requirements/templates.ts`：`deleteTemplate` 查询 `app_requirement_docs.template_id`，使用中 400。
- `chat/service.ts`：`mode='doc'` 前置 `requirements_mode='doc'` 守卫（409），避免为 structured 应用创建文档。
- `chat/doc-prompt.ts`：要求已有章节返回原 `sectionKey`、只输出需修改章节、不删除必填章节、`openIssues.add` 只放真正待澄清问题；Markdown 标题不带 `[key]`/`（必填）` 前后缀（避免真实模型把提示格式抄进标题）。
- 测试：`requirements/doc.test.ts` 新增预览/removeSectionKeys/只读 409 共 4 项（`reopen` 回归沿用既有用例）；新增 `requirements/routes.test.ts`（6 项：structured 全端点 409 + 不建文档行、404、doc 对话 409、模板删除保护、预览/应用）；两文件纳入 `npm test`。

前端：

- `requirements/doc-diff.js` + `doc-diff.test.mjs`（9 项）：章节 diff（added/modified/unchanged/removed、标题变化）、行级 LCS diff（大文本截断）、`buildApplyPayload`（勾选/必填不可删/待澄清写入/标题）、`allApplicableSelected`。
- `requirements/AiSuggestionCard.vue`：计数、章节勾选、行级 diff、标题变更、待澄清勾选、应用选中/全部应用/忽略；readonly/streaming/过期（`baseVersion` 变化）/已处理禁用。
- `requirements/DocChatPanel.vue`：`doc` → `/preview`，`sections` → 本地 `mergeDocSections` 生成建议；**不再自动保存**；建议随消息持久化（含 `baseVersion`/applied/ignored）；应用调用 `saveDocFull`（sections + removeSectionKeys + title + source=ai）；忽略不写库；失败保留卡片。
- `requirements/api.ts`：预览 API 类型、`removeSectionKeys`、`DocSuggestion`。
- `requirements/RequirementsDocView.vue`：向对话面板传 `docTitle`（标题 diff 基准）。
- `requirements/TemplateCenterDialog.vue`：章节增删/上下移/标题/层级/类型/必填/提示；新增章节输入 key（`^[a-z0-9-]+$` 唯一），已保存 key 只读；内置只读；保存校验错误留在弹窗；删除提示改为“使用中不能删除”。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 110/110（新增 doc 预览/removeSectionKeys/只读、路由守卫/模板删除保护） |
| `npm run smoke:requirements --prefix backend` | ✅ 扩展：structured 守卫（409/不建文档）、preview 不写库/不产版本、忽略不产版本、应用选中只改勾选章节 + 必填不可删、模板删除保护（400/未使用可删/内置只读） |
| 回归 `smoke:change-set` / `smoke:design-handoff` / `smoke:design` / `smoke:handoff-input` | ✅ 全部通过 |
| `npm test --prefix frontend` | ✅ 44/44（新增 `doc-diff` 9 项） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整 |
| Playwright + 真实模型 `packycode-deepseek/deepseek-flash` | ✅ 建议卡出现且未点击前文档版本不变（v1）；取消勾选仅应用「文档信息」→ v2 且只该章节（+待澄清问题）有内容；第二轮建议忽略 → 版本保持 v2；复制模板 13 个 key 只读；使用中删除 400 提示；切回标准 PRD；0 非预期 API >=400、0 console error（仅故意删除 400 的浏览器网络日志） |

E2E 脚本与截图（临时目录）：`C:\Users\icecream\AppData\Local\Temp\opencode\r2a-e2e\run.mjs`、`shots\01-ai-suggestion.png`…`07-back-to-standard.png`。

### 与交接单的澄清/偏差

1. **`preview` 不创建文档**：交接单要求“不写库”，因此预览不复用 `ensureRequirementDoc`（它会在无文档时建行）；改用只读基线（无文档时按模板构造，`baseVersion=0`，前端回退用当前版本）。正常流程文档已存在，行为一致。
2. **`removed` 口径收紧**：只包含 `custom-*` 且非必填章节（与 `removeSectionKeys` 可应用范围一致）；模板可选章节在全文建议中缺失时给 warning“保留原内容”，不进入 `removed`，避免应用时删除模板章节。
3. **`sections` 模式不产生 removed**：章节更新只合并，不删除；删除仅通过全文 `doc` 的 `removed` + `removeSectionKeys` 显式确认。
4. **`title` 变更需显式勾选**：建议卡默认勾选“同时更新标题”；未勾选时只应用章节。
5. **待澄清写入**：勾选且文档存在 `issues` 章节时随应用写入；没有该章节只 warning，不强行创建。
6. **只读/过期**：文档已确认时 `preview` 409（与保存一致），卡片在只读时禁用；文档版本变化后卡片禁用并提示重新生成。

### 未验证 / 已知限制

- R2b 版本策略未做：普通章节自动保存仍每次生成版本；版本压缩/清理留 R2b。
- 建议卡持久化包含 diff 文本，超长文档消息体积会变大（当前未单独裁剪持久化内容，仅行 diff 展示截断）。
- 全文建议中标题被模型改写（不是原 sectionKey）会落为 `custom-*` 新增章节 + 原章节缺失 warning，而不是“重命名”；需用户在建议卡中确认取舍（确定性映射优先）。
- E2E 只覆盖 1 个真实模型产品；模型未返回 DOC_JSON 时仍走“本轮未解析”提示，由既有单测/mock 覆盖卡片逻辑。
- 设计/交接包/版本策略未改动。
