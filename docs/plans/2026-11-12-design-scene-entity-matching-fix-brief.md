# 设计页面集主实体匹配修复（P2）实施交接单

日期：2026-11-12
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已实施并评审（2026-11-12）**，见 §6。
上游：`docs/STATUS.md`「真实模型 E2E（2026-11-12）」观察项 1、`docs/STATUS.md`「未验证/已知限制」中的 P2 条目。
范围：只修**确定性默认页面集**的 Epic → 主实体选择（`deriveRequirementScenes` / `entityMatchScore`）。不改 AI 页面集、不改页面规格/UI/API/数据库；不重构设计阶段。

---

## 1. 问题（真实模型 E2E 发现）

真实模型生成 5 Epic / 15 Story / 10 实体后，按场景生成页面集：

- EPIC-001「图书档案管理」→ 页面全部是「借阅记录列表/创建/编辑/详情」（实体：借阅记录）。
- EPIC-005「逾期与罚款」→ 页面全部是「提醒记录列表/…」（实体：提醒记录）。
- 页面集标题/Epic 正确，但 `primary` 实体与页面标题/规格错位；交接包 `03-PAGES` / `04-PLAN` 因此指向错实体。

根因：`deriveRequirementScenes` 只用 `entityMatchScore(entity, epic.title) * 10 + entityMatchScore(entity, text)` 选主实体；当模型实体名（书目/罚款单）与 Epic 文案（图书/逾期）不完全一致时，故事正文里出现的其它实体名（借阅记录/提醒记录）得分更高。

**可用信号**：AI/用户保存的实体已有 `requirementRefs`（真实 E2E 中「书目」绑定 STORY-001 等），Epic 也有稳定 `stories[].id`；应先按交集选主实体。

---

## 2. 修复算法

在 `deriveRequirementScenes` 的 PRD/Epic 分支（`input.structure === 'prd' && input.epics.length`）中：

1. 对每个 Epic 计算引用命中：
   - `storyIds = new Set(epic.stories.map(story => story.id))`
   - `storyHits = entity.requirementRefs.filter(ref => storyIds.has(ref)).length`
   - `epicHit = entity.requirementRefs.includes(epic.id) ? 1 : 0`
   - `sceneHit = epic.sceneId && entity.requirementRefs.includes(epic.sceneId) ? 1 : 0`
2. 为每个实体计算文本分，并采用**严格字典序**排序（不是加权和）：
   ```ts
   const textScore =
     entityMatchScore(entity, epic.title) * 10 +
     entityMatchScore(entity, text)
   ```
   - 排序键：`storyHits` desc → `epicHit` desc → `sceneHit` desc → `textScore` desc → 实体顺序（稳定排序）。
   - 严格字典序保证“有 Story 引用的实体必然优先”，不会被超长实体名的高文本分压过。
   - `storyHits=0` 且无 Epic/Scene 引用时，排序键退化为 `textScore` desc，与现有逻辑完全一致（`titleScore*10 + textScore`），保证旧行为不回归。
3. `matched` 过滤条件为 `storyHits + epicHit + sceneHit + textScore > 0`（顺序按上述排序键）；`primary = matched[0] ?? first`。
4. 不改 `input.structure === 'prd' && input.scenes.length`（无 Epic）分支；不改非 PRD/fallback 分支。
5. 不要新增/修改 `DesignEntity` 字段、数据库列或 API；`requirementRefs` 已存在。

建议把单实体的匹配分量抽成纯函数（如返回 `{ entity, storyHits, epicHit, sceneHit, textScore }` 的 `entitySceneMatch`），再用比较器排序，便于单测；不要保留会误导的加权和。保持 `entityMatchScore` 语义不变。

---

## 3. 测试

在 `backend/src/design/service.test.ts` 或新增 `scene-entity-matching.test.ts`：

1. **复现真实错位**：
   - 结构化需求：EPIC-001「图书档案管理」STORY-001/002，故事正文出现「借阅记录」；EPIC-002「借阅办理」STORY-003。
   - 实体「书目」`requirementRefs: ['STORY-001']`；实体「借阅记录」`requirementRefs: ['STORY-003']`（名称出现在 EPIC-001 故事正文）。
   - `generateDefaultPageSets` 后，EPIC-001 页面集的 `entityIds`/页面 `entityId`/标题应为「书目」，不是「借阅记录」；EPIC-002 仍为「借阅记录」。
2. **多实体命中**：两个实体都引用同一 Story，标题匹配更准的优先；再相同则按实体顺序。
3. **无引用回退**：实体没有 `requirementRefs` 时，仍按现有标题/正文启发式（可用现有页面集用例覆盖，或新增断言）。
4. **Epic/Scene 引用**：实体只引用 Epic ID（或 Scene ID）时也能优先于纯文本命中；但 Story 命中权重更高。
5. **严格字典序回归**：构造超长实体名（如 `'借阅记录'.repeat(8)`，约 32 字符）且 Epic 标题/正文包含它（文本分 >1000），另一个实体仅通过 `requirementRefs` 命中 Story；断言 Story 引用实体仍为 primary（加权和会选长名称实体）。
6. 回归：`npm test --prefix backend`（131 基线）+ `smoke:design`、`smoke:handoff-input`、`smoke:design-handoff`。

前端不涉及；仍跑 `npm test --prefix frontend` / `typecheck` / `build` / `check:vue` 作为回归。

可选：用真实模型 E2E 的同一临时数据/规则复验页面标题；不要求重新调用模型。若重跑真实 E2E，记录耗时与结果。

---

## 4. 不做 / 边界

- 不改 AI 页面集生成（`generatePageSetsFromRequirement`）。
- 不改页面规格、Wireframe、页面集 UI；不新增“主实体选择”UI（可后续）。
- 不改数据库表/列、API 形状、版本/交接包语义。
- 不迁移已生成的错误页面集；当前 `apps=0`，真实 E2E 为临时数据。已存在应用需重新生成页面集才生效。
- 不调模型、不做 U7、不做视觉重构。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 5. 文档与回传

实施完成后：

- 更新本交接单 §6（改动、命令/结果、偏差、未验证）。
- 更新 `docs/STATUS.md`：
  - 「真实模型 E2E」观察项 1 改为“已修复（P2）”并写测试；
  - 「未验证/已知限制」P2 条目同步；
  - 摘要表加/改一行；总状态/测试数更新。
- 更新 `AGENTS.md`、`docs/plans/2026-11-11-main-review-handoff.md`（下一步）。
- 回传主会话：改动文件、命令/结果、未验证项、偏差、需决策问题。

---

## 6. 实施结果（2026-11-12，实施会话）

状态：**已实施，待主会话评审**。

### 6.1 改动文件

- `backend/src/design/service.ts`
  - 新增 `entitySceneMatch(entity, epic, text)` 返回分量 `{ entity, storyHits, epicHit, sceneHit, textScore }`（`storyIds` 用 `Set` 判交集；`epic.sceneId` 为空时 `sceneHit=0`；`textScore = entityMatchScore(title)*10 + entityMatchScore(text)`）。
  - 新增 `compareEntitySceneMatch` 严格字典序：`storyHits` desc → `epicHit` desc → `sceneHit` desc → `textScore` desc → 实体顺序（稳定排序）；不再使用加权和。
  - `deriveRequirementScenes` 的 PRD/Epic 分支改用上述分量 + 比较器；`matched` 过滤 `storyHits + epicHit + sceneHit + textScore > 0`；`primary = matched[0] ?? first`。
  - `entityMatchScore` 未改；无引用时排序键退化为 `textScore`，与旧逻辑完全一致。scenes-only、fallback、AI 页面集、页面规格/UI/API/DB 均未改。
- `backend/src/design/scene-entity-matching.test.ts`（新增，5 项）：临时 SQLite/projects、每个用例独立应用、已确认结构化需求。
  1. 真实错位复现：EPIC-001「图书档案管理」故事正文出现「借阅记录」；书目 refs STORY-001、借阅记录 refs STORY-003（且借阅记录排在第一位）→ EPIC-001 列表页「书目列表」/实体书目，EPIC-002 仍「借阅记录列表」。
  2. 多实体命中同一 Story：罚款单与通知记录均 refs STORY-010，罚款单标题更匹配 → 罚款单胜；甲乙记录同分 → 按实体顺序取甲。
  3. 无 `requirementRefs`：正文出现更多的「订单记录」不敌标题命中的「客户」→ 保持旧启发式。
  4. 引用权重阶梯：Story 引用 > Epic 引用 > Scene 引用 > 纯文本命中（逐步移除实体复验）。
  5. 严格字典序：超长实体名（`'借阅记录'.repeat(8)`，32 字符，标题文本分 >1000）不敌仅 refs 命中 STORY-001 的「书目」；去掉书目后长名称实体按文本分成为 primary。
- `backend/package.json`：测试列表注册新测试文件。

### 6.2 命令 / 结果

| 命令 | 结果 |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | ✅ |
| `npm run build --prefix backend` | ✅ |
| `npm test --prefix backend` | ✅ **136/136**（基线 131，+5） |
| `npm run smoke:design --prefix backend` | ✅ |
| `npm run smoke:handoff-input --prefix backend` | ✅ |
| `npm run smoke:design-handoff --prefix backend` | ✅ |
| `npm run smoke:change-set --prefix backend` | ✅ |
| `npm run smoke:requirements --prefix backend` | ✅ |
| `npm test --prefix frontend` | ✅ 69/69 |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ |
| `npm run check:vue --prefix frontend` | ✅ |

反向验证：
- 临时退回旧公式 `title*10 + text`：测试 1 失败（实际 `借阅记录列表` vs 期望 `书目列表`），确认新测试能复现真实错位。
- 临时改回加权和比较器：测试 5 失败（长名称实体被选为 primary），确认严格字典序修复有效。

### 6.3 偏差 / 未验证

- **主会话真实数据回放（不调模型，2026-11-12）**：用 `i09b-real-e2e` 临时库中真实模型生成的需求（5 Epic/15 Story）与实体（10 个，带源 ID/requirementRefs）新建 `i09b-p2-replay`，复制需求/实体后重新生成默认页面集：EPIC-001 → **书目**、EPIC-002 → 读者、EPIC-003/004 → 借阅记录、EPIC-005 → **罚款单**；旧的「借阅记录/提醒记录」错位消失。结果 `C:\Users\icecream\AppData\Local\Temp\opencode\i09b-real-e2e\p2-replay.json`。回放中源实体 ID 与源应用冲突，也验证了 P1 全局唯一/引用重写。
- 未重新调用真实模型（不需要）；用真实模型产出的数据做确定性回放。
- 未迁移已生成的错误页面集：已有应用需重新生成页面集；当前 `apps=0`、真实 E2E 为临时数据。
- AI 页面集生成路径未改，AI 是否能改善主实体绑定仍未验证。
- 仅 PRD + Epic 分支生效；scenes-only/fallback 保持原样。
- 主会话复核 must-fix 已处理：评分从加权和改为严格字典序，Story 引用必然优先，不受实体名长度影响。
- 未新增/修改实体字段、数据库列、API；未新增“主实体人工选择”UI。

