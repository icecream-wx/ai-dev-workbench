# 迭代/变更场景方案（讨论稿）

日期：2026-11-11
状态：**方案已定稿（2026-11-11）。Change Set 基础（首次 #1、handoff/session 归属）随 D5 实施；C1a（后端变更循环）与 C1b（前端变更 UI）已完成，含评审 4 项收口（模板恢复/输入归属/纯修复不重开单/scope 升级）**。关联：需求 R1、设计 D1—D4、需求→设计 H1—H4、设计→开发 D5。
目标：支持“第一轮开发完成后，继续调整/新增需求、改设计、再开发”的反复迭代场景，而不是只能从零开始。

---

## 1. 核心结论

不建议每次变更复制一整套应用数据（完整 iteration clone），也不建议简单地把应用状态回滚到 requirements 后丢失历史。

推荐：**变更单（Change Set）+ 版本化文档/设计/交接包/会话**。

- 应用仍然只有一套“当前需求文档/当前设计项目/当前代码”。
- 每次变更创建一个 **Change Set**，记录本次变更的基线版本、范围、状态和产出（需求版本、设计版本、交接包版本、开发会话）。
- 版本历史保留：需求文档版本、DesignInput、设计版本、交接包版本、开发会话都带 `change_set_id`。
- 代码不复制；开发 agent 在现有代码上增量修改。

这样既保留历史，又不会让工作台变成多套应用的复制品。

---

## 2. 生命周期

```text
已完成/开发中
  → 发起变更（标题/说明/范围）
  → 创建 Change Set #N
     记录基线：requirements vX / design vY / handoff vZ
  → 需求阶段：重开需求文档（draft），编辑；旧开发会话只读
  → 需求确认
  → 设计输入同步（stale → diff → additions/regenerate）
  → 设计确认
  → 生成交接包 vZ+1（全量 + 05-CHANGES.md 增量）
  → 开发阶段：新会话（change set #N，handoff vZ+1），在现有代码上增量实现
  → 用户确认完成 → Change Set 关闭，应用回到 completed
```

变更范围（定稿）：

- `requirements`（默认）：需求 + 设计都要调整。
- `design`：需求不变，只改实体/页面/原型。
- 开发阶段的纯代码修复/优化**不属于 Change Set**，不需要新交接包；直接在开发阶段用当前/新开发会话处理。

> 已确认：不做 `scope=development` 的变更单。

---

## 2.1 首次开发创建 Change Set #1（已确认）

采用 **A**：首次生成交接包时自动创建 `seq=1`，UI 标为“初始开发”，不叫“变更中”；后续用户发起变更才是 #2、#3。

- 首次交接包/需求版本/设计版本/开发会话统一带 `change_set_id`，历史查询/会话分组不需要处理 null。
- `05-CHANGES.md` 初始版写“初始开发（无基线差异）”。
- 用户看到的是“初始开发”，不是“变更 #1”。

---

## 3. 需求变化怎么处理

### 3.1 稳定 ID 是基础

H1—H4 已有 `SCENE-001 / EPIC-001 / STORY-001`：

- 修改标题/描述/验收标准：ID 不变 → 可识别为“修改”；
- 新增：分配下一个 ID；
- 删除：归档，ID 保留 → 可识别为“删除”；
- 重排/改标题不影响 ID。

### 3.2 需求 diff

新需求文档确认后，生成新的 DesignInput，与基线 input 比：

- 新增/修改/删除的 Scene/Epic/Story；
- 章节文本变化（数据规则/页面要求/NFR）；
- 影响列表：哪些实体/页面引用了变更 ID。

这与 H4 的 diff 一致，只是需要挂到 Change Set 上。

### 3.3 需求阶段 UI

- 应用列表/详情显示 `变更中 #2 · 需求`。
- 需求文档头部：`变更 #2（基于 v11）`。
- 旧需求版本、旧设计、旧交接包仍可查看。
- 旧开发会话变为只读/归档，避免继续基于旧规格改代码。

---

## 4. 设计怎么处理

### 4.1 需求变更后的设计

- 设计输入标记 stale；旧设计项目保留。
- 用户选择：
  - **仅同步新增项**：保留现有实体/页面，新增需求对应的实体/页面后续补；
  - **同步并标记受影响项**：受影响的实体/页面/页面集置 draft，用户/AI 更新（当前 H4 regenerate 语义）；
  - **暂不处理**：设计保持 stale，不能确认/生成新交接包。
- 设计更新后重新确认；旧设计版本保留。

### 4.2 仅设计变更

- 需求不变，直接重开设计（Change Set scope=design）。
- 设计项目回 draft，修改实体/页面/原型。
- 生成新设计版本、新交接包。
- 需求文档不变，01-REQUIREMENTS 不变。

### 4.3 删除需求/设计项与代码删除

- 需求删除：Story 归档；设计 sync 时对应实体/页面标 draft/归档。
- 设计删除：实体/页面归档，不物理删除历史。
- 交接包 `05-CHANGES.md` 明确列出“删除/废弃”清单，包括实体/表、字段、页面。
- **代码删除由开发 agent 在变更会话里执行**，不要求工作台自动删文件：
  - 工作台不知道代码文件与需求/页面/实体的映射，直接删文件容易误删共享代码；
  - 交接文档要求 agent 做影响分析，删除对应 Controller/Service/Vue 页面/路由/测试，并列出删除文件；
  - 数据库删表/删列属于高风险操作，必须先生成迁移 SQL/影响说明，用户确认后再执行；工作台不自动 drop。
- 用户确认完成时，变更总结应列出已删除文件/表/字段。


---

## 5. 设计 → 开发交接（D5 增量）

每次变更仍然生成**全量交接包**（保证 agent 有完整上下文），额外生成：

```text
05-CHANGES.md        # 本次变更集：新增/修改/删除、影响范围、增量实现提示
manifest.json        # 增加 changeSet: { seq, title, baselineHandoffVersion, currentHandoffVersion }
```

`05-CHANGES.md` 内容：

- 变更单编号/标题/说明/范围；
- 需求：新增/修改/删除的 Scene/Epic/Story（ID + 标题）；
- 设计：新增/修改/删除的实体/表/字段/关系、页面集/页面/原型；
- 原型模板是否变化；
- 影响提示：涉及的表/页面/功能；
- 实现要求：
  - 在现有代码上增量修改；
  - 保留未变更功能；
  - 不重写整个项目；
  - 删除项谨慎处理，先说明影响；
  - 完成后总结变更点/影响文件/自测/未解决事项。

开发首条提示（后续变更版）：

> 这是第 N 次变更（变更单：...），基线交接包 vZ，当前交接包 vZ+1。请先读 `docs/handoff/05-CHANGES.md`，再读 `00-README.md` 和相关章节；在现有代码上增量实现，保留未变更部分，不要重写整个项目。完成后总结变更点、影响文件、自测结果、未解决事项。

---

## 6. 开发会话策略

- 默认：**每个 Change Set 新开一个开发会话**，旧会话归档/只读。
- 原因：上下文干净、交接包版本明确、会话列表可按变更分组（I-10）。
- 可选：允许“在当前会话继续”（适合小改动），但必须提示 handoff 版本变化。
- 开发页显示：`第 2 次变更 · handoff v4`；会话列表按变更单分组。
- 开发会话记录 `change_set_id` + `handoff_version/hash`。
- 旧的代码保留；新会话首条提示强调“现有代码基线，增量修改”。

---

## 7. 状态与 Change Set

### 7.1 应用状态

建议不新增 `change` 状态，继续复用 `requirements → design → development → completed`，用 Change Set 标签表达“变更中”：

- `completed` 应用发起变更 → 应用状态回到 `requirements`，但保留 `completed_at` 作为“上一版完成时间”；
- UI 显示 `变更中 #2 · 需求`，而不是“应用未完成”；
- 变更完成后 `completed_at` 更新为本次完成时间；
- 变更取消 → 回到上一版状态/完成时间。

### 7.2 Change Set 状态

`requirements | design | development | completed | cancelled`

### 7.3 基线

- Change Set 记录：
  - base requirements version
  - base design version
  - base handoff version
  - base design input id/hash
- 当前产出：
  - current requirements version
  - current design version
  - current handoff version
- 开发会话归属 change set。

---

## 8. 数据模型（建议）

```sql
app_change_sets (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL,          -- requirements | design | development
  status TEXT NOT NULL,         -- requirements | design | development | completed | cancelled
  base_requirements_version INTEGER,
  base_design_version INTEGER,
  base_handoff_version INTEGER,
  base_input_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
)

apps 增加：current_change_set_id
app_requirement_doc_versions 增加：change_set_id
app_design_inputs 增加：change_set_id
app_design_versions 增加：change_set_id
handoffs/design_handoffs 增加：change_set_id, base_handoff_version
app_sessions 增加：change_set_id, handoff_version, handoff_hash
```

- 初始开发：创建 Change Set #1（或 `seq=1`，scope=requirements），后续 #2、#3。
- 不做完整 iteration clone；只有版本和会话归属。

---

## 9. API/UI

API：

- `POST /api/apps/:id/change-sets`（发起变更：title/description/scope）
- `GET /api/apps/:id/change-sets`（历史）
- `POST /api/apps/:id/change-sets/:id/cancel`
- 需求 reopen、设计 reopen、handoff generate、dev session create 都要求 active change set（初始 #1 除外）。
- `GET /api/apps/:id/design/handoff` 返回 change set 信息/baseline。

UI：

- 首页/应用详情：`已完成` / `变更中 #2 · 设计`；变更历史列表。
- 发起变更弹窗：标题、说明、范围（需求+设计 / 仅设计）。
- 需求文档：`变更 #2（基于 v11）`。
- 设计：`变更 #2 · 基线 design v5`。
- 交接包：显示 baseline/current、`05-CHANGES` 预览。
- 开发页：按变更单分组的会话列表；当前 handoff 版本。
- 变更取消：仅在尚未生成新交接包时允许；恢复基线状态。

### 9.1 历史展示（待讨论）

这里“历史展示”建议分四层，不必一次全做：

1. **首页应用行**：只显示当前状态（`已完成` / `变更中 #2 · 设计`），不展开历史。
2. **应用头部**：
   - 当前变更单 chip（`初始开发` / `变更 #2`）；
   - `变更历史` 按钮，打开面板/页面。
3. **变更历史面板**（建议）：
   - 每行一个 Change Set：编号/标题/状态/开始-完成时间；
   - 关联版本：需求 vX、设计 vY、交接包 vZ、开发会话数；
   - 点击展开：变更摘要、需求/设计 diff、`05-CHANGES`、会话列表；
   - 旧版本只读；可“查看该版本交接包/需求文档”。
4. **各阶段内部**：
   - 需求文档版本历史：标出属于哪个 Change Set；
   - 设计版本历史：同上；
   - 交接包历史：版本 + baseline + change set；
   - 开发会话列表：按 Change Set 分组（I-10）。

我倾向：**应用头部的“变更历史”面板 + 各阶段版本历史带 change set 标签**，不做独立顶级导航。需要确认你希望历史展示到什么程度。

---


## 10. 边界/风险

- **不做完整 iteration 克隆**：避免复制表/目录/数据；版本+变更单足够。
- **代码删除由开发 agent 执行**：工作台不自动删文件；删除项进入 `05-CHANGES`，agent 做影响分析并删除对应代码/测试；数据库删表/删列需先生成迁移 SQL/影响说明并经用户确认。
- **取消变更**：生成新交接包后不建议取消；保留历史，后续再改。
- **并发变更**：一个应用同时只允许一个 active change set。
- **旧会话**：变更中旧开发会话只读，避免继续用旧规格改代码。
- **部署状态**：工作台不追踪生产部署；“completed”只是用户确认，不宣称线上状态。
- **首次开发**：D5 应从第一天就带 Change Set #1 和 `05-CHANGES.md`（初始版本），避免后续 retrofit。

---

## 11. 与 D5 方案的关系

- D5 的交接包结构增加 `05-CHANGES.md`；manifest 增加 changeSet 信息。
- D5 生成交接包时同时生成 Change Set #1（初次）或绑定 active Change Set。
- D5 的“生成交接包并进入开发”在后续变更时变成“生成变更交接包并进入开发”。
- D5 的开发首条提示区分初次/变更。
- I-10 会话列表按 Change Set 分组；I-09 长会话/分阶段可结合。

---

## 12. 已确认

1. 采用 **Change Set + 版本化**，不做完整 Iteration 克隆。
2. 变更范围只有：**需求+设计（默认）**、**仅设计**；纯开发修复/优化不属于 Change Set，开发阶段自己解决。
3. 需求变更后**必须重新走设计**（同步设计输入并确认）。
4. 应用状态复用 requirements/design/development + “变更中 #N”标签，不新增 `change` 状态。
5. 默认每个 Change Set 新开开发会话，允许小改动继续当前会话。
6. 交接包 = **全量 + `05-CHANGES.md` 增量**。
7. 删除需求/设计项：代码由开发 agent 在变更会话中删除；工作台不自动删文件；数据库删表/删列需先生成迁移 SQL/影响说明并经用户确认。
8. 取消变更只在生成新交接包前允许；生成新交接包后再变更 = 发起新的 Change Set。
9. 纯开发修复不生成新交接包，只新建/继续开发会话。
10. **首次开发创建 Change Set #1**，UI 显示“初始开发”。
11. **历史展示**：应用头部“变更历史”面板 + 各阶段版本历史带 Change Set 标签；不做独立顶级导航（后续可扩展）。
12. 开发阶段发现需求要改：必须发起 Change Set，旧开发会话只读；新交接包生成后新会话增量实现。
13. **取消变更（2026-11-11 补充）**：只有本次变更已产生“已确认”差异（需求或设计已确认且与基线不同）且尚未生成新交接包时，才显示/允许取消；改一半（draft 未确认）没有取消逻辑。取消 = 恢复基线（需求/设计/应用状态回到变更前已确认版本与上一版交接包），变更单标记 `cancelled`，变更中产生的新版本保留在版本历史。详细落地见 `docs/plans/2026-11-11-c1-implementation-brief.md`。


