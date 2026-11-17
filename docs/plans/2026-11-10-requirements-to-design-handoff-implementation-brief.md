# 需求 → 设计交接实施交接单（H1—H4）

日期：2026-11-10
用途：**新开实现会话**使用；当前主会话保留设计/评审。
状态：**H1—H4 已实施（2026-11-11）**，验证记录见 `docs/STATUS.md`「H1—H4 完成」。D5 仍未接。
上游方案：`docs/plans/2026-11-10-requirements-to-design-handoff.md`（已定稿）
相关：需求 R1、设计 D1—D4、`docs/STATUS.md`、`AGENTS.md`
范围：**H1—H4**；D5（设计→开发交接）后续讨论。

---

## 1. 一句话目标

把已确认需求文档确定性地转换为 `DesignInputBundle`（场景/Epic/Story/角色/规则/页面要求/NFR + 版本/hash），设计阶段只基于该快照生成实体/页面；实体/页面带 `requirementRefs`；需求变更可 diff、可重新同步；提供覆盖度视图。

---

## 2. 必读

1. `AGENTS.md`
2. `docs/plans/2026-11-10-requirements-to-design-handoff.md`（本任务唯一有效设计，已定稿）
3. `docs/plans/2026-11-10-requirements-stage-doc-design.md`（R1 文档/章节模型）
4. `docs/plans/2026-11-10-design-stage-entity-prototype.md`（D1—D4 实体/页面集）
5. `docs/STATUS.md` 的 R1 / D1—D4 / 评审 / R1 遗留修复排期
6. 代码：
   - `backend/src/requirements/doc.ts`、`types.ts`、`routes.ts`
   - `backend/src/design/service.ts`、`prompt.ts`、`routes.ts`、`types.ts`
   - `backend/src/chat/doc-prompt.ts`
   - `frontend/src/requirements/RequirementsDocView.vue`、`doc-protocol.js`
   - `frontend/src/design/DesignStudio.vue`、`DesignChatPanel.vue`、`EntityDesignTab.vue`、`PrototypeTab.vue`

---

## 3. 已定稿决策

- Scenes / Epics / Stories 做成**结构化章节**，保留 Markdown 渲染；稳定 ID `SCENE-001/EPIC-001/STORY-001`。
- 页面集按 **Epic 优先 → Scene → 章节/功能块** 组织，不按实体。
- 实体/页面保存 `requirementRefs`，并记录来源 section/epic/story。
- Story 覆盖只做**警告**，不硬阻塞；纯后端 Story 可以没有页面。
- 需求变更：显示 diff，用户选择“仅新增 / 重生成受影响项 / 暂不处理”，不静默覆盖。
- 稳定 ID 在文档中显示小标签；设计/交接包可追溯。
- 非 PRD 模板（Business Strategy）回退 Scene/章节，并提示补充 Epics。
- DesignInputBundle 是确定性快照；AI 只基于 bundle 生成实体/页面。
- R1 的“重新编辑需求”入口在 H4 前完成（确认后只读死胡同需解决）。

---

## 4. H1：需求结构化与稳定 ID

### 4.1 数据

- `app_requirement_doc_sections` 增加 `data_json TEXT`（迁移 + 默认 NULL）。
- 结构化类型：
  ```ts
  Scene { id, title, description, position }
  Epic { id, title, goal, priority, sceneId, position }
  Story { id, title, description, acceptance: string[], priority, status?, position }
  ```
- 结构数据是 `epics`/`scenes` 等章节的权威；`markdown` 仍用于渲染/导出。
- 分配器：按现有最大编号 +1；编辑标题不改 ID；删除可软删除/归档（加 `archived` 或保留记录）。

### 4.2 生成/编辑

- `DOC_JSON` 扩展：`sections` 条目可带 `data`（结构化章节）。首次生成应同时给 Markdown 和结构化数据。
- `RequirementsDocView`：
  - Epics/Stories 章节提供结构化编辑器（Epic 列表 → Story 行；验收标准列表；优先级/场景）。
  - Scenes 章节提供场景列表。
  - Markdown 预览由结构数据渲染；源码模式修改后解析或提示结构变化。
- 保存 API：`PUT /requirements-doc/sections/:key` 接受 `data`；返回文档 + 结构。
- `POST /requirements-doc/outline/rebuild`：对旧文档/纯 Markdown 重建结构（确定性解析 + 必要时 AI 辅助），结果需用户预览/确认。

### 4.3 确认校验

- `epics` 至少一个 Epic、一个 Story；Story 有标题 + 至少一条验收标准（或模板允许的等价内容）。
- 结构缺失时回退到旧 Markdown 校验，并提示“结构未建立”（不阻塞首次确认，但设计输入会标记 fallback）。

---

## 5. H2：DesignInputBundle 与引用

### 5.1 数据

```sql
app_design_inputs (
  id, app_id,
  doc_version, doc_hash, template_id,
  input_json, structure,     -- prd | fallback
  created_at
)

app_design_projects 增加：
  source_input_id, source_input_hash, source_doc_version

app_design_entities 增加：
  requirement_refs_json, source_sections_json

app_design_page_sets 增加：
  epic_id, story_ids_json

app_design_pages 增加：
  requirement_refs_json
```

### 5.2 Bundle 构建

- 从已确认需求文档 + 结构化章节构建：
  - scenes/epics/stories（稳定 ID）
  - roles（结构化或从章节文本）
  - dataRules/pageRequirements/NFR（Markdown 原文）
  - openQuestions/glossary
- `docHash = sha256(content_md + outline_json + docVersion)`。
- 设计项目首次进入/需求确认后创建 input；已有 input 且 hash 一致则复用。

### 5.3 API

- `GET /api/apps/:id/design/input`（最新/指定版本）
- `POST /api/apps/:id/design/input/sync`（H4：生成新 input + diff）
- `GET /api/apps/:id/design/coverage`（H3）
- `POST /design/generate-entities`、`/page-sets/generate` 使用 `inputId`（默认最新），prompt 使用 bundle，不再只传 contentMd。

### 5.4 Prompt/校验

- 实体生成：要求每个实体输出 `requirementRefs`（STORY-ID）与 `sourceSections`。
- 页面集生成：要求 `epicId/sceneKey/storyIds`、页面 `requirementRefs/entityId`；默认 list/create/edit/detail。
- 后端校验：
  - refs 必须存在于 input；
  - epic/scene/story/entity 必须存在；
  - 不存在的给 warnings，不静默丢；
  - 无 refs 的实体/页面给 warning（不阻塞）。

---

## 6. H3：UI（设计输入 / 覆盖度 / 结构编辑）

- 需求文档：Epics/Stories、Scenes 结构化编辑器 + 稳定 ID 小标签 + Markdown 预览。
- DesignStudio 顶部：
  - `需求输入 v10 · 4 场景 / 5 Epics / 12 Stories · 已确认`
  - `查看需求文档`、`重新同步`（H4）
- 左侧构建活动：需求已确认 → 设计输入已生成 → 实体草稿 → 页面集草稿 → 待确认。
- 设计待办/覆盖度：
  - 按 Epic/Story 显示对应实体、页面集、页面；
  - 未覆盖标警告；无需求依据的页面标“无需求依据”；
  - 点击跳转实体/页面。
- 实体/页面详情显示 `requirementRefs` 与来源章节。

---

## 7. H4：需求变更同步

- 设计项目记录 source input/doc version/hash；与最新需求文档比较，不同则 stale banner。
- `POST /design/input/sync`：
  - 生成新 input；
  - diff scenes/epics/stories（新增/删除/修改）；
  - 按 requirementRefs 找受影响实体/页面；
  - 返回 diff + 影响列表。
- 用户选择：
  - 仅同步新增项；
  - 重新生成受影响项（保留手动修改提示）；
  - 暂不处理（设计标记 stale）。
- 不静默覆盖；所有变更走版本快照。
- 依赖：R1 增加“重新编辑需求”（确认后回 draft）入口；否则需求无法变更。

---

## 8. 实施顺序

1. H1：章节 `data_json` + 结构化类型/ID + 解析/渲染 + 文档编辑器 + 确认校验。
2. H2：`app_design_inputs` + bundle 构建/API + 设计项目绑定 + 实体/页面 refs + prompt/校验。
3. H3：DesignStudio 输入 chip、覆盖度/待办、需求文档结构编辑 UI。
4. H4：stale/diff/sync + R1 重新编辑入口。
5. 测试/文档/STATUS。

---

## 9. 验证

- backend：`npm test --prefix backend`、`npm run build --prefix backend`
  - 新增：结构化解析/ID 稳定性/渲染、input hash、refs 校验、coverage、diff/stale、reopen。
- frontend：`npm test --prefix frontend`、`npm run typecheck --prefix frontend`、`npm run build --prefix frontend`
  - 新增：Epics/Scenes 编辑器、DOC_JSON data、input/coverage 展示。
- smoke：新增 `smoke:handoff-input`（或扩展现有 smoke）覆盖：需求结构化 → 确认 → input → AI/手动实体/页面 refs → coverage → 变更 diff。
- Playwright + 真实模型 `packycode-deepseek/deepseek-flash`：
  - 需求结构化 Epic/Story → 确认 → 设计输入 → 实体/页面带 refs → 覆盖度 → 修改需求 → 重新同步 → 影响提示。
- 不提交真实凭据；不打印 DB 密码。

---

## 10. 边界

- 不做 D5（设计→开发交接包/开发切换）。
- 不做旧数据兼容；旧文档可“重建结构”，旧应用可删除。
- 不硬阻塞 Story 覆盖；不静默覆盖设计。
- 不改 D1—D4 的原型模板/页面渲染主流程，除非为 refs/input 适配。
- 完成后更新 `docs/STATUS.md`，回传主会话评审。

---

## 11. 完成后提醒

H1—H4 完成后回到主会话讨论：
1. D5：设计 → 开发交接包（DDL、PNG/HTML/页面规格、模板 id/版本、开发 agent 消费方式）。
2. R2：需求 AI diff/应用/忽略、模板编辑、版本清理、R1 遗留 P1/P2。
3. 开发阶段：I-10 会话列表、I-09 长会话 compact/分阶段。
