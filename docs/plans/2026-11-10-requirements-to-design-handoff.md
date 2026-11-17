# 需求 → 设计交接方案

日期：2026-11-10
状态：**方案已定稿（2026-11-10）；H1—H4 已实施（2026-11-11），D5 仍未接**。上游：需求 R1（`docs/plans/2026-11-10-requirements-stage-doc-design.md`）、设计 D1—D4（`docs/plans/2026-11-10-design-stage-entity-prototype.md`）。实施与验证记录见 `docs/STATUS.md`「H1—H4 完成」。

### 定稿决策（2026-11-10）

- Epics/Stories、Scenes 做成结构化章节，保留 Markdown 渲染；稳定 ID。
- 页面集按 Epic 优先、无 Epic 用 Scene、都没有用章节/功能块。
- Story 覆盖只做警告，不硬阻塞；纯后端 Story 可无页面。
- 需求变更：显示 diff，用户选择“仅新增 / 重生成受影响项 / 暂不处理”，不静默覆盖。
- 稳定 ID 在文档中显示小标签，设计/交接包可追溯。
- 非 PRD 模板回退到 Scene/章节，并提示补充 Epics。
- R1 的“重新编辑需求”在 H4 前完成。
- 设计输入采用 DesignInputBundle 快照（版本 + hash），设计项目绑定来源。

---

## 1. 目标

让“已确认的需求文档”稳定、可追溯地变成设计阶段的输入：

- 需求文档里的场景 / Epics / User Stories / 角色 / 数据规则 / 页面要求 / NFR
- → 设计输入快照（DesignInputBundle，确定性）
- → AI 生成实体草稿
- → AI 按场景/Epic 生成页面集
- → 用户确认，进入后续交接包/开发。

核心原则：

1. **交接是确定性的，不靠 AI 每次重新理解 Markdown。**
2. **每个设计产物都能追溯到需求条目**（Epic/Story/section）。
3. **需求变更可感知**：设计项目记录来源版本/hash，需求变化时提示重新同步，不静默覆盖。
4. **AI 只做提案**：实体/页面由 AI 生成草稿，用户确认；不自动改已确认内容。

---

## 2. 当前缺口

- 需求文档目前主要是章节 Markdown；`Epics & User Stories` 也是 Markdown，没有稳定的 Epic/Story ID。
- 设计阶段只读取 `contentMd` + 文档版本；AI 每次从全文重新理解，结果可能漂移。
- 页面集虽然按场景/Epic 生成（D1—D4 已修），但没有“需求条目 → 页面集/实体”的正式映射。
- 需求变更后，设计项目不知道哪些实体/页面受影响。
- 没有“需求覆盖度”视图：哪个 Story 没有实体/页面，哪个页面没有需求依据。

---

## 3. 核心设计：DesignInputBundle

需求确认后，工作台生成一份**设计输入快照**（不调用 LLM，确定性）：

```json
{
  "appId": "app1",
  "docVersion": 10,
  "docHash": "sha256...",
  "templateId": "builtin-prd",
  "templateName": "工作台标准 PRD",
  "confirmedAt": "2026-11-10T...",
  "scenes": [
    { "id": "SCENE-001", "title": "订单管理", "description": "...", "sectionKey": "scenes" }
  ],
  "epics": [
    {
      "id": "EPIC-001",
      "title": "订单创建",
      "goal": "支持业务员创建订单",
      "priority": "P0",
      "sceneId": "SCENE-001",
      "stories": [
        {
          "id": "STORY-001",
          "title": "创建订单",
          "description": "作为业务员，我想...",
          "acceptance": ["必填校验...", "保存后列表可见..."],
          "priority": "P0"
        }
      ]
    }
  ],
  "roles": [{ "id": "ROLE-001", "name": "业务员", "description": "..." }],
  "dataRules": { "sectionKey": "rules", "markdown": "..." },
  "pageRequirements": { "sectionKey": "pages", "markdown": "..." },
  "nonFunctionals": { "sectionKey": "nfr", "markdown": "..." },
  "openQuestions": [{ "id": "Q-001", "question": "..." }],
  "glossary": [{ "term": "...", "definition": "..." }]
}
```

说明：

- `docVersion/docHash` 用于判断设计是否过期。
- `scenes/epics/stories/roles` 是结构化条目，带稳定 ID；`dataRules/pageRequirements/nfr` 保留 Markdown 原文供 AI 阅读。
- 不把整篇文档重新摘要，避免信息损失；AI prompt 同时拿到结构化清单和关键章节原文。

---

## 4. 需求文档需要结构化（关键决策）

### 4.1 推荐：Epics/Stories、Scenes 做成“结构化章节”

当前 `epics` 章节是纯 Markdown。建议把它升级为结构化块（仍然渲染成 Markdown 给人看）：

- Epic：标题、目标、优先级、所属场景。
- Story：标题、描述（As a / I want / So that 可选）、验收标准列表、优先级。
- 场景：标题、描述、包含的 Epic/Story。

存储：

- 在 `app_requirement_doc_sections` 增加 `data_json`（或单独 `app_requirement_outline` 表）保存结构化数据；
- 渲染时把结构化数据写成 Markdown（保持 R1 文档体验）；
- 用户仍可在文档里编辑 Markdown，但“源码模式”修改后需要重新解析或提示结构变化。

### 4.2 稳定 ID

- `SCENE-001`、`EPIC-001`、`STORY-001`、`ROLE-001`、`Q-001`。
- 生成后固定；编辑标题不改 ID；新增条目分配下一个 ID；删除条目保留 ID 记录（可标记归档）。
- 文档中可显示小标签（如 `STORY-001`），也可以隐藏但在设计视图/交接包中可见。

### 4.3 为什么不用 AI 每次解析 Markdown

- 结果不稳定：同一文档两次解析可能不同；
- 无法稳定引用：设计页面无法可靠指向 Story；
- 变更无法 diff：不知道哪个 Story 改了；
- 交接包/开发无法追溯。

如果模板没有 Epics（如 Business Strategy），则：

- 从 `scenes` 章节/功能块派生“设计单元”；
- 在 DesignInput 中标记 `structure: 'fallback'`；
- 设计页面提示“该文档不是 PRD 结构，建议补充 Epics”。

---

## 5. 交接流程

```text
需求文档 confirmed
  → 生成 DesignInputBundle（确定性，v1 + hash）
  → 设计项目绑定 inputId/hash
  → 设计阶段读取 bundle
  → AI 生成实体草稿（带 requirementRefs）
  → 用户确认实体
  → AI 按 Epic/Scene 生成页面集（带 requirementRefs/entityId）
  → 用户确认页面/原型
  → 设计确认（D5 再生成交接包）
```

触发方式建议：

- 进入设计阶段时自动生成/读取最新 DesignInput；
- 提供“重新同步需求”按钮；
- 需求文档未确认时不能生成设计输入/实体/页面集。

---

## 6. 映射规则

### 6.1 需求 → 实体

- AI 输入：Epics/Stories + `dataRules` + `pageRequirements` + 角色。
- 每个实体保存：
  - `requirementRefs: ['STORY-001', ...]`
  - `sourceSections: ['rules', 'epics']`
- 实体字段/关系应能对应业务规则；无法确定时进入 openQuestions，不编造。
- 同一实体被多个 Story 引用时只建一次（应用级共享实体）。

### 6.2 需求 → 页面集

- **页面集按 Scene/Epic 组织**，不是按实体。
- 默认页面：列表、创建、编辑、详情（模板可配置；详情可删）。
- 页面保存：
  - `sceneKey/epicId/storyIds`
  - `entityId`
  - `requirementRefs`
- 一个页面集可以引用多个实体（订单 + 订单明细）。
- 没有 Epic 时按 Scene；都没有时按功能块/章节。

### 6.3 覆盖度

设计视图增加“需求覆盖”：

- 每个 Epic/Story：对应实体、页面集、页面；未覆盖项标红/警告。
- 每个实体/页面：来源 Story；无来源的标“无需求依据”。
- 默认是警告，不硬阻塞；可在设计确认 readiness 中显示。

建议规则：

- 每个 Story 至少应有一个页面或实体（警告，不阻塞）；
- 每个页面应绑定至少一个 Story/Epic（警告）；
- 纯后端 Story 可以只对应实体/服务，不需要页面。

---

## 7. AI Prompt 与输出

### 7.1 实体生成

Prompt 包含：

- DesignInput 的 Epics/Stories/roles/dataRules/pageRequirements；
- 当前实体（再生成时）；
- 要求：每个实体带 `requirementRefs`；字段/关系来自业务规则；不确定处提问。

输出：

```json
{
  "entities": [
    {
      "id": "ent-order",
      "name": "订单",
      "tableName": "biz_order",
      "requirementRefs": ["STORY-001"],
      "fields": [...],
      "relations": [...]
    }
  ]
}
```

### 7.2 页面集生成

Prompt 包含：

- 当前 Epic/Scene + 其 Stories/验收；
- 相关实体/字段；
- 原型模板的页面集规则/Token；
- 要求：页面集 `sceneKey/epicId/storyIds`；页面 `requirementRefs/entityId`；列表/创建/编辑/详情。

输出：

```json
{
  "pageSets": [
    {
      "id": "ps-order",
      "sceneKey": "SCENE-001",
      "epicId": "EPIC-001",
      "storyIds": ["STORY-001", "STORY-002"],
      "title": "订单管理",
      "pages": [
        { "pageKey": "order-list", "type": "list", "entityId": "ent-order", "requirementRefs": ["STORY-001"] },
        { "pageKey": "order-create", "type": "form", "mode": "create", ... },
        { "pageKey": "order-edit", "type": "form", "mode": "edit", ... },
        { "pageKey": "order-detail", "type": "detail", ... }
      ]
    }
  ]
}
```

后端校验：

- `requirementRefs` 必须存在于 DesignInput；
- `sceneKey/epicId/storyIds` 必须存在；
- `entityId` 必须存在；
- 缺失/多余给 warnings，不静默吞掉。

---

## 8. 需求变更与同步

设计项目记录：

- `source_input_id` / `source_doc_version` / `source_hash`。

需求文档变更（需先重新编辑需求）：

- 设计视图显示“需求已变更”；
- 点击“重新同步” → 生成新 DesignInput → diff：
  - 新增/删除/修改的 Scene/Epic/Story；
  - 受影响的实体/页面（按 requirementRefs）；
- 用户选择：
  - 仅同步新增项（保留现有设计）；
  - 重新生成受影响项（保留手动修改提示）；
  - 暂不处理（设计标记 stale）。
- 绝不在用户不知情时覆盖实体/页面。

R1 的“确认后文档只读”需要配套“重新编辑需求”入口，否则无法触发同步（见 STATUS R1 遗留 P1）。

---

## 9. 数据模型/API 建议

```sql
app_requirement_outline (
  app_id, doc_version, outline_json, created_at
)

app_design_inputs (
  id, app_id,
  doc_version, doc_hash, template_id,
  input_json, structure,       -- prd | fallback
  created_at
)

app_design_projects (
  ...,
  source_input_id, source_input_hash, source_doc_version
)
```

实体/页面增加：

- entities: `requirement_refs_json`, `source_sections_json`
- page_sets: `scene_key`, `epic_id`, `story_ids_json`
- pages: `requirement_refs_json`

API：

- `POST /api/apps/:id/requirements-doc/outline/rebuild`（结构化 Epic/Story 重建）
- `GET /api/apps/:id/design/input`（最新/指定版本）
- `POST /api/apps/:id/design/input/sync`（生成新 input + diff）
- `GET /api/apps/:id/design/coverage`（Story→实体/页面覆盖）
- `POST /api/apps/:id/design/generate-entities` / `page-sets/generate` 使用 inputId

---

## 10. UI

- 需求文档：Epics/Stories 结构化编辑器（列表/表格），Markdown 预览；稳定 ID 小标签。
- 设计 Studio 顶部：`需求输入 v10 · 4 场景 / 5 Epics / 12 Stories · 已确认` + `查看需求文档` / `重新同步`。
- 左侧构建活动增加：需求已确认 → 设计输入已生成 → 实体草稿 → 页面集草稿 → 待确认。
- 设计待办/覆盖度：按 Epic/Story 列出实体/页面覆盖，点击跳转。
- 需求变更时 banner：`需求文档已更新，设计输入过期`。

---

## 11. 实施拆分

| 阶段 | 内容 |
| --- | --- |
| H1 | 需求文档结构化 Epics/Scenes + 稳定 ID + `data_json`；DesignInputBundle 确定性生成/API |
| H2 | 设计项目绑定 inputId/hash；实体/页面生成使用 bundle；requirementRefs 落库 |
| H3 | 设计 UI 顶部输入 chip、覆盖度/待办；AI 输出引用校验 |
| H4 | 需求变更 diff/重新同步；stale 提示；保留手动修改 |
| H5 | 与 D5 交接包/开发衔接（后续） |

---

## 12. 需要讨论

1. **是否把 Epics/Stories、Scenes 做成结构化章节？** 我强烈建议是；否则没有稳定 ID 和 diff。
2. **页面集按 Epic 还是 Scene？** 有 Epic 时按 Epic；没有 Epic 用 Scene；都没有用章节/功能块。
3. **Story 覆盖是否硬阻塞设计完成？** 建议警告，不阻塞；纯后端 Story 允许无页面。
4. **需求变更同步策略**：仅新增 / 受影响重生成 / 手动选择；建议默认“显示 diff，用户选择”。
5. **稳定 ID 是否在需求文档中显示？** 建议小标签显示，方便设计/交接追溯。
6. **非 PRD 模板（Business Strategy）**：回退到 Scene/章节，提示补充 Epics，是否接受？
7. 设计输入快照是否保留全部历史版本？建议保留，用于审计/回滚。
8. 需求重新编辑入口（R1 P1）何时做？建议在 H4 前完成，否则无法同步变更。
