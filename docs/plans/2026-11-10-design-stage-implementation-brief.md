# 设计阶段（实体 + 页面原型）实施交接单

日期：2026-11-10
用途：**新开实现会话**使用；当前主会话保留为设计/评审。
状态：**D1—D4 已实施（2026-11-10）**；D5 待讨论。
上游方案：`docs/plans/2026-11-10-design-stage-entity-prototype.md`（已定稿）
相关：`docs/plans/2026-11-10-requirements-stage-doc-design.md`、`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md`、`docs/STATUS.md`、`AGENTS.md`
本轮范围：**D1—D4**；交接包/开发衔接（D5）后续再讨论。

---

## 1. 一句话目标

把设计阶段改成“左侧 AI 对话/构建活动 + 右侧 实体设计 / 页面原型”两个 Tab：
- 实体设计：应用级共享实体、字段、关系、ER 图；
- 页面原型：按场景/Epic 生成页面集（列表/创建/编辑/详情），用 HTML 原型渲染并截图成 PNG；
- 原型模板：全局库 + 应用选模板；模板决定 App Shell、页面模式、Token、页面集规则；
- 旧设计面板全部移除，不做兼容。

---

## 2. 必读顺序

1. `AGENTS.md`
2. `docs/plans/2026-11-10-design-stage-entity-prototype.md`（本任务唯一有效设计）
3. `docs/STATUS.md` 的 R1 完成/评审/后续
4. `docs/test-issues-2026-11-09.md` 的 I-08/I-12
5. 代码：
   - `backend/src/requirements/doc.ts`（读取已确认需求文档）
   - `backend/src/opencode/runtime.ts`、`backend/src/chat/service.ts`
   - `frontend/src/workbench/AppShell.vue`
   - `frontend/src/requirements-grooming/ui/prototype/PrototypeRenderer.vue`、`Wireframe*.vue`
   - `frontend/src/requirements-grooming/ui/EntityRelationGraph.vue`、`design/` 相关
   - `frontend/src/requirements/` 的 R1 页面/协议/模板中心（可参考模式）

---

## 3. 已定稿决策

- 设计阶段只保留两个用户可见产物：实体设计 + 页面原型。
- 原型：实时 HTML 原型 + PNG 截图；**不调用图片生成模型**。
- 原型模板：全局库 + 应用只保存 `prototype_template_id`；内置只读，复制后可编辑；首批内置“企业级专业管理（默认）”“简洁后台”，移动端后续。
- 模板内容：App Shell、页面模式、设计 Token、页面集规则、提示词；MVP 模板编辑器只做 Token/页面集规则/提示词，不做可视化布局编辑器。
- 页面集：按场景/Epic 默认生成列表/创建/编辑/详情；详情默认有但可删；用户可增删改、AI 整组或单页重新生成；页面集是主修改粒度。
- 实体：应用级共享实体 + 场景引用；字段/关系/ER；AI 生成/修改 + 手动编辑 + 确认。
- 旧设计面板全部移除，不做兼容；可复用底层组件，但不保留旧 UI。
- 原型编辑：MVP 用“AI 修改 + 结构化页面规格 + 重新渲染”，不做自由拖拽 WYSIWYG。
- 图片/HTML 存应用目录（`projects/<app>/docs/design/prototypes/`），DB 存路径/hash/版本。
- 设计完成条件：实体确认 + 页面集原型确认 + 无阻塞问题；交接包/开发衔接后续再定。
- 真实模型 `packycode-deepseek/deepseek-flash`；不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 4. 数据模型（建议）

```sql
prototype_templates (
  id, name, category, description,
  tokens_json, shell_json, patterns_json, page_set_rules_json,
  prompt, builtin, visibility, preview_path,
  created_at, updated_at
)

app_design_projects (
  app_id PRIMARY KEY,
  prototype_template_id,
  status,              -- draft | review | confirmed
  version,
  source_doc_version,  -- 需求文档版本
  created_at, updated_at, confirmed_at
)

app_design_entities (
  id, app_id, name, table_name, description,
  fields_json, relations_json, position,
  created_at, updated_at
)

app_design_page_sets (
  id, app_id, scene_key, title, status, position,
  created_at, updated_at
)

app_design_pages (
  id, page_set_id, page_key, title, type,
  entity_id, spec_json, layout_json, status, version,
  image_path, html_path, image_hash,
  created_at, updated_at
)

app_design_versions (
  id, app_id, version,
  entities_json, page_sets_json,
  source,              -- ai | manual | template-change
  created_at
)
```

- 实体/页面规格用 JSON 存储，便于编辑与版本快照；图片文件落应用目录。
- 设计项目一行/应用；需求文档版本记录来源。
- 原型模板 seed 在启动时写入；内置只读。

---

## 5. API（建议）

模板：
- `GET /api/prototype-templates?stage=design&category=&q=`
- `POST /api/prototype-templates`
- `PUT /api/prototype-templates/:id`
- `DELETE /api/prototype-templates/:id`
- `POST /api/prototype-templates/:id/duplicate`

设计项目：
- `GET /api/apps/:id/design`
- `PUT /api/apps/:id/design/template`
- `POST /api/apps/:id/design/generate-entities`（AI）
- `PUT /api/apps/:id/design/entities`（整体保存/章节更新）
- `POST /api/apps/:id/design/page-sets/generate`（AI 页面集）
- `PUT /api/apps/:id/design/page-sets/:id`
- `PUT /api/apps/:id/design/pages/:id`
- `POST /api/apps/:id/design/pages/:id/snapshot`（前端上传 PNG base64，后端写文件）
- `POST /api/apps/:id/design/confirm`
- `GET /api/apps/:id/design/versions` / `POST .../rollback`

AI：
- `POST /api/apps/:id/chat` 增加 `mode:'design'`、`focus:{kind:'entity'|'pageSet'|'page', id}`、`prototypeTemplateId`；
- 输出 `<<<DESIGN_JSON>>>`，包含 entities / pageSets / pages / nextSteps / openIssues；
- 设计 prompt 读取已确认需求文档 + 当前实体/页面规格 + 原型模板。

---

## 6. 前端

- `DesignStudio.vue`：左对话/构建活动/下一步；右 `实体设计 | 页面原型` Tab。
- `EntityDesignTab.vue`：实体列表/字段表格/ER 图/问 AI/确认。
- `PrototypeTab.vue`：场景/Epic → 页面集 → 页面；原型画布、模板 badge、风格/缩放、PNG 导出、确认。
- `PrototypeTemplateDialog.vue`：模板中心（需求模板对话框可参考）。
- `DesignChatPanel.vue`：流式对话、焦点 chip、构建活动、缺失提示。
- `PrototypeCanvas.vue`：基于现有 `PrototypeRenderer`/`Wireframe*`，传入 template tokens/shell；先做“企业级专业管理”皮肤。
- 旧设计视图不再挂载；`AppShell` 设计阶段改为新 `DesignStudio`（doc 应用；旧 structured 应用按“无兼容”处理）。
- 设计待办：按场景显示实体/页面集/确认状态；设计完成 readiness。

---

## 7. 实施顺序

1. 原型模板表/seed/API + 两套内置模板。
2. 设计项目表/实体表/页面集/页面/版本 + 基础 API。
3. 读需求文档 → 生成实体初稿（AI/prompt）；实体编辑/ER/确认。
4. 页面集生成 + PrototypeCanvas 渲染（先实时 HTML，后 PNG）。
5. 设计 Studio 外壳 + 左对话/构建活动 + 右 Tabs。
6. 模板中心/切换/版本；设计确认 readiness。
7. 单测/构建/真实模型 E2E + 更新 STATUS。

---

## 8. 验证

- backend：`npm test --prefix backend`、`npm run build --prefix backend`；新增模板/设计项目/实体/页面集/确认/版本测试。
- frontend：`npm test --prefix frontend`、`npm run typecheck --prefix frontend`、`npm run build --prefix frontend`。
- 真实模型：`packycode-deepseek/deepseek-flash`；需求文档 → 实体初稿 → 页面集 → 原型渲染 → 确认。
- Playwright：模板切换、实体编辑、页面集生成、原型缩放/导出、确认、0 console error/0 意外 API >=400。
- 不提交真实凭据；不打印 DB 密码。

---

## 9. 边界

- 本轮不接交接包/开发（D5 后续讨论）；设计确认只记录状态，不宣称可开发。
- 不做旧设计面板兼容；旧代码可暂时保留但不再挂载，R4 清理。
- 不做自由拖拽 WYSIWYG；不做图片生成模型。
- 不扩展需求 R2 的 diff/模板编辑，除非为设计阶段复用。
- 完成后更新 `docs/STATUS.md`，并回传主会话评审。

---

## 10. 完成后提醒

设计阶段主体（D1—D4）完成后，回到主会话讨论：
1. 需求 → 设计交接（文档/Epics → 实体/页面集）。
2. 设计 → 开发交接（实体 DDL、PNG/HTML/页面规格 → 交接包；开发 agent 如何消费）。
3. R2 需求收尾（AI diff/应用/忽略、模板编辑、版本清理）。
4. 开发阶段会话列表/长会话/分阶段（I-09/I-10）。

---

## 11. 实施结果（D1—D4，2026-11-10）

- 已完成：原型模板表/seed/API + 两套内置模板；设计项目/实体/页面集/页面/版本表与 API；AI 生成实体/页面集 + `<<<DESIGN_JSON>>>` 设计对话；实体编辑/ER/确认；页面集/页面规格/Wireframe 渲染/模板切换/PNG 截图/版本回滚；设计 Studio 外壳与 AppShell 接入。
- 评审修复：页面集按需求场景/Epic 派生；创建/编辑表单拆分（`mode`/`formModes`）；确认后只读 + `POST /design/reopen`；HTML 快照 text/plain 附件 + CSP；PNG 魔数校验；旧 structured 应用入口守卫。
- 未做：D5（交接包、开发衔接、设计 readiness 到开发解锁）；不做旧设计面板兼容；不做自由拖拽/图片生成模型。
- 验证记录见 `docs/STATUS.md` 的“D1—D4 完成 / D1—D4 评审修复”章节；设计稿同步更新了实施结果。

