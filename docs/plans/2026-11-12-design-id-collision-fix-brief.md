# 设计 ID 跨应用冲突修复 + U6 变更单 caveat 实施交接单

日期：2026-11-12
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已完成并评审（2026-11-12）**，见 §7（含主会话复验）。
上游：`docs/STATUS.md`「评审发现：设计页面集 ID 跨应用冲突」、`docs/plans/2026-11-12-i09b1-implementation-brief.md` §8.3。
范围：
1. **P1**：修复设计实体/页面集/页面 ID 跨应用冲突，以及写盘先删后插导致的丢数据风险。
2. **U6 caveat**：`changeSet.seq > 1` 时在 `04-PLAN.md` / `00-README.md` 明确“阶段草案按全量交接包生成，实际范围以 `05-CHANGES.md` 增量为准”。

**不做**：不改数据库表结构、不改 API 形状、不迁移旧数据（当前 `apps=0`）、不做 U7、不调模型、不做 UI 重构。

---

## 1. 问题与复现（已确认）

### 1.1 跨应用页面集 ID 冲突

- `app_design_page_sets.id` 是**全局主键**；`generateDefaultPageSets` 用 `ps-${hashKey(scene.key)}` 生成 ID，两个应用都使用 `EPIC-001` 时会得到同一个 ID。
- `writePageSets` 先删除当前应用的页面集/页面，再逐条插入，**未包事务**；插入冲突时当前应用已有页面集已被删除。
- 最小复现（主会话临时脚本，未改仓库）：
  - 应用 A 保存 `ps-shared`；
  - 应用 B 先保存 `ps-b`，再保存 `ps-shared`；
  - 结果：`UNIQUE constraint failed: app_design_page_sets.id`；B 的页面集从 1 变 0。
- U6 E2E 通过“两个应用用不同 Epic ID”绕过；当前 `apps=0`，无存量冲突。

### 1.2 同类风险

- `app_design_pages.id`、`app_design_entities.id` 也是全局主键。
- `normalizeEntities` / `normalizePageSets` / `normalizePages` 会接受请求/AI 传入的 raw id（只检查本应用内未占用），跨应用可能重复。
- `writeEntities` 同样先删后插、未包事务。

---

## 2. 修复原则

**优先保留现有行为和 ID**，只在“全局已占用”时换 ID：

1. 已有对象（按 id/name/sceneKey/pageKey 匹配到本应用现有行）继续保留原 ID，保证编辑/版本/回滚/前端选择稳定。
2. 新对象的 raw id 只有在**全局未被占用**时才接受；否则生成新的全局唯一 ID。
3. 新对象没有 raw id 时直接生成全局唯一 ID。
4. 写盘函数必须事务化：删除 + 插入要么全部成功，要么全部回滚。
5. 不改变 API 形状；返回的 ID 仍由现有响应返回，前端继续使用响应中的 ID。
6. 不新增/修改表或列；`apps=0`，无需迁移。

---

## 3. 后端实现

### 3.1 全局 ID 辅助（`backend/src/design/service.ts`）

新增/改造内部辅助：

```ts
type DesignIdTable = 'app_design_entities' | 'app_design_page_sets' | 'app_design_pages'

function idExists(table: DesignIdTable, id: string): boolean
function idAvailable(table: DesignIdTable, id: string, used: Set<string>): boolean
function uniqueId(prefix: string, used: Set<string>, table: DesignIdTable): string
```

- `idExists` 用固定表名做参数化查询（不要拼接外部输入）。
- `uniqueId` 循环 `newId(prefix)`，直到 `!used.has(id) && !idExists(table,id)`，再 `used.add(id)`。
- `newId` 保留现有 `prefix-Date.now().toString(36)-random` 形式即可；关键是用 `idExists` 兜底。
- 现有 `uniqueId(prefix, used)` 的调用点统一改为带 table。

### 3.2 `normalizeEntities`

- 匹配逻辑不变：`matched = byId.get(rawId) ?? byName.get(name)`。
- 新实体：
  - `rawId` 通过 `ID_PATTERN` 且 `idAvailable('app_design_entities', rawId, used)` → 保留 rawId；
  - 否则 `uniqueId('ent', used, 'app_design_entities')`；
  - 若 rawId 被替换，记录 `rawId -> newId` 到局部 `idRemap`。
- 在“名称 → id”解析**之前**，用 `idRemap` 重写：
  - `entity.fields[].ref`
  - `entity.relations[].target`
  - 然后再走现有 `idByName` 名称解析。
- 目标：同一 payload 内新实体之间的字段/关系引用不会因换 ID 失效；页面集绑定不在本函数范围（见 §3.5 偏差）。
- 新增测试覆盖：关系 target 指向新实体 raw id 时，保存后 target 等于实际新实体 id。

### 3.3 `normalizePageSets` / `normalizePages`

- 匹配逻辑不变（`byId`/`byScene`/`byTitle`、`byId`/`byKey`）。
- 新页面集：
  - raw id 全局可用 → 保留；
  - 否则 `uniqueId('ps', used, 'app_design_page_sets')`。
- 新页面：
  - raw id 全局可用 → 保留；
  - 否则 `uniqueId('pg', used, 'app_design_pages')`。
- 页面 `pageSetId` 仍由服务端传入的 set id 决定；页面 ID 无其他内部引用，不需要 remap。
- `used` 仍用于本应用当前集合/页面；跨应用由 `idExists` 兜底。

### 3.4 默认页面集生成 `generateDefaultPageSets`

- 新页面集 ID 不再使用 `ps-${hashKey(scene.key)}`：
  - `legacy?.id`（按 sceneKey/title/实体匹配到本应用现有页面集）保留；
  - 否则 `uniqueId('ps', used, 'app_design_page_sets')`。
- 页面 ID：
  - `old?.id` 保留；
  - 否则优先 `entityId-sceneHash-type`（实体 ID 已全局唯一），但插入前检查 `idExists('app_design_pages', preferred)`；若已存在则 `uniqueId('pg', usedPages, 'app_design_pages')`；
  - `usedPages` 需跨页面集共享（在 `generateDefaultPageSets` 内创建一次，传给 `buildDefaultPagesForScene`），避免同一批新页面内部重复。
- 若 `hashKey` 在改完后无引用，删除；不要保留零引用死代码。

### 3.5 写盘事务

- `writeEntities`：把 `DELETE` + 全部 `INSERT` 包进 `db.transaction(...)`；异常时回滚，旧实体保留。
- `writePageSets`：把 `DELETE pages` + `DELETE sets` + 全部 `INSERT` 包进 `db.transaction(...)`；异常时回滚，旧页面集/页面保留。
- 若函数被已有外层事务调用，使用 better-sqlite3 的嵌套事务/savepoint 语义；不要手工 `BEGIN/COMMIT` 造成嵌套错误。
- 建议同时把 `rollbackDesignVersion` / `restoreDesignVersionConfirmed` 的“实体 + 页面集 + 版本/应用状态”包进一个事务（若改动小）；至少保证单表写盘不会丢数据。若不做，在回传中说明。

### 3.6 U6 变更单 caveat

- `renderPlanPhaseSection`：当 `bundle.changeSet.seq > 1`，在规模行后增加：
  `> 本次为变更 #N：以下阶段按全量交接包生成；实际开发范围以 05-CHANGES.md 的增量与影响为准，不要按阶段重写未变更部分。`
- `renderReadme` 的规模提示（`scale.suggested`）在 `seq > 1` 时追加一句：
  `本次为变更 #N，增量范围以 05-CHANGES.md 为准。`
- `seq=1` 不出现该 caveat；`05-CHANGES` 本身不改。

---

## 4. 测试

### 4.1 后端单测（新增 `backend/src/design/id-collision.test.ts` 或并入 `service.test.ts`）

至少覆盖：

1. **两个应用同 Epic ID 生成默认页面集**：两个应用（相同 `EPIC-001`/实体名）分别 `generateDefaultPageSets`，都成功；页面集 ID、页面 ID 不同；各自页面数量正确。
2. **raw 页面集 ID 冲突**：应用 A `savePageSets` 用 `ps-shared`；应用 B 用同一个 raw id；两边都成功且最终 ID 不同；B 的原有页面集不被删除。
3. **raw 页面 ID 冲突**：两个应用页面都用 `pg-shared`；都成功且 ID 不同。
4. **raw 实体 ID 冲突**：两个应用实体都用 `ent-shared`；都成功且 ID 不同；第二个应用的关系 target 指向它自己的新实体 ID。
5. **事务回滚**：临时创建 `BEFORE INSERT` trigger `RAISE(ABORT)`，调用 `savePageSets` / `saveEntities` 抛错后，应用原有页面集/实体仍在（数量、内容不变）；删除 trigger 后再保存成功。
6. 回归：现有 122 测试全部通过。

### 4.2 U6 caveat 单测

- 大交接包 + `changeSet.seq=2`：`04-PLAN.md` 含“本次为变更 #2…以 `05-CHANGES.md` 为准”；`00-README.md` 含增量提示。
- `changeSet.seq=1`：不出现该 caveat。
- 可构造最小 bundle 调 `renderDesignHandoffText`；或在现有 change-set 流程中覆盖。不要只做代码走查。

### 4.3 命令

- `npm run build --prefix backend`
- `npm test --prefix backend`
- `npm run smoke:design --prefix backend`
- `npm run smoke:design-handoff --prefix backend`
- `npm run smoke:change-set --prefix backend`
- `npm run smoke:handoff-input --prefix backend`
- `npm run smoke:requirements --prefix backend`
- `npm test --prefix frontend` / `npm run typecheck --prefix frontend` / `npm run build --prefix frontend` / `npm run check:vue --prefix frontend`（本项预计不改前端；仍跑回归）
- 可选：用临时 SQLite/两个应用做 API 级验证（同 Epic ID 生成页面集成功）；不需要真实 opencode/模型。

---

## 5. 不做 / 边界

- 不改数据库表结构/主键，不迁移数据；`apps=0`，无存量。
- 不改 API 请求/响应形状；ID 仍是字符串，前端继续用响应值。
- 不引入新的 ID 前缀规则给用户；不把内部 ID 写进交接包文档。
- 不改需求/设计/交接包/Change Set 版本语义；U6 caveat 只加文案。
- 不做 U7 阶段模型/阶段会话；不调模型；不做视觉重构。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 6. 文档与回传

实施完成后：

- 更新本交接单 §7（改动文件、命令/结果、偏差、未验证）。
- 更新 `docs/STATUS.md`：
  - 「评审发现：设计页面集 ID 跨应用冲突」改为**已修复**，写明修复方式/测试；
  - 摘要表对应行改为已修复；
  - 未验证/已知限制同步；
  - I-09b-1 的“变更单 caveat”观察项改为已补。
- 更新 `docs/plans/2026-11-12-i09b1-implementation-brief.md` §8.3（caveat 已补、P1 已修）。
- 更新 `docs/plans/2026-11-11-main-review-handoff.md`（下一步）。
- 回传主会话：改动文件、命令/结果、未验证项、偏差、需决策问题。主会话独立验证后评审。

---

## 7. 实施结果（2026-11-12，已完成，待主会话评审）

### 7.1 改动文件

后端：

- `backend/src/design/service.ts`
  - 新增 `DesignIdTable`（`app_design_entities | app_design_page_sets | app_design_pages`）+ `idExists(table,id)` / `idAvailable(table,id,used)` / `uniqueId(prefix,used,table)`；表名是固定白名单，参数化查询 `WHERE id = ?`。
  - `normalizeEntities`：新实体 raw id 仅当 `ID_PATTERN` + `idAvailable('app_design_entities', ...)` 时保留，否则 `uniqueId('ent', used, 'app_design_entities')`；**每次确定 id 后无条件 `used.add(id)`**（matched / 接受 raw / 新生成三种情况），保证同一 payload 内重复 raw id 的后续对象换新 ID；换 ID 时记录局部 `idRemap`，在“名称 → id”解析前重写 `fields[].ref` / `relations[].target`；同一 rawId 已有映射时不覆盖。
  - `normalizePageSets` / `normalizePages`：新页面集/页面 raw id 同样做全局可用检查，冲突时 `uniqueId('ps'|'pg', used, 'app_design_page_sets'|'app_design_pages')`，并同样**无条件 `used.add(id)`**；`pageSetId` 仍由服务端决定，页面 ID 无内部引用、不 remap。
  - `generateDefaultPageSets`：页面集不再用 `ps-${hashKey(scene.key)}`；`legacy?.id` 保留，否则 `uniqueId('ps', usedSets, 'app_design_page_sets')`。页面 ID 保留 `old?.id`；新页面优先 `entityId-sceneHash-type`，但先 `idAvailable('app_design_pages', preferred, usedPages)`，冲突则 `uniqueId('pg', usedPages, 'app_design_pages')`；`usedPages` 在整次生成内共享（`buildDefaultPagesForScene` 新增 `usedPages` 参数）。
  - `writeEntities` / `writePageSets`：`DELETE` + 全部 `INSERT` 包进 `db.transaction(...)`（better-sqlite3 savepoint 语义，不手工 BEGIN/COMMIT）；失败回滚，旧实体/页面集/页面保留。
  - `rollbackDesignVersion` / `restoreDesignVersionConfirmed`：实体 + 页面集 + 版本/项目/应用状态写盘包进一个事务。
  - `hashKey` 保留：仍用于无结构化需求时的 fallback scene key（`scene:<hash(title)>`），不是死代码。
- `backend/src/design/id-collision.test.ts`（新增，8 项；真实临时 SQLite + 两个应用、同 `EPIC-001`）：
  1. 两个应用分别 `generateDefaultPageSets` 均成功；页面集/页面 ID 全局不同、页面数量一致、各自落库 1 个页面集。
  2. 应用 A `savePageSets` 用 `ps-shared` 保留 raw ID；B 先保存 `ps-b`，再保存 `[ps-b, ps-shared]` 成功，B 仍有 2 个页面集（`ps-b` 与页面未丢），`ps-shared` 换成新 ID 且与 A 不同。
  3. 两个应用页面都用 raw `pg-shared` 均成功；A 保留，B 换新且两者不同。
  4. 两个应用实体都用 `ent-shared` / `ent-shared-item` 均成功；A 保留 raw；B 换新；B 的 `relations[].target` 与 `fields[].ref` 指向 B 自己的新实体 ID（不是 raw ID，也不是 A 的 ID）。
  5. 事务回滚：`CREATE TRIGGER ... BEFORE INSERT ... RAISE(ABORT)` 让 `savePageSets` / `saveEntities` 抛错后，原有页面集（ID/页面/key）与实体（数量/内容）保持不变；`DROP TRIGGER` 后同一批数据保存成功。
  6. 同一 `saveEntities` 两个实体同 raw `ent-dup`：保存成功、两个 ID 不同、DB 中两条都在；关系 `target` 指向保留 rawId 的实体（不是被换 ID 的第二个）。
  7. 同一 `savePageSets` 两个页面集同 raw `ps-dup`：保存成功、两个页面集 ID 不同、DB 两条都在。
  8. 同一 `savePageSets` 一个页面集内两个页面同 raw `pg-dup`：保存成功、两个页面 ID 不同、DB 两条都在。
- `backend/src/handoff/design-render.ts`（U6 caveat）
  - `renderPlanPhaseSection`：`changeSet.seq > 1` 时在规模行后增加 `> 本次为变更 #N：以下阶段按全量交接包生成；实际开发范围以 \`05-CHANGES.md\` 的增量与影响为准，不要按阶段重写未变更部分。`
  - `renderReadme`：`scale.suggested` 且 `seq > 1` 时，规模提示后追加 `本次为变更 #N，增量范围以 \`05-CHANGES.md\` 为准。`；`seq=1` 不出现；`05-CHANGES.md` 渲染逻辑未改。
- `backend/src/handoff/design-handoff.test.ts`：新增 caveat 单测（同一大交接包分别构造 seq=1/seq=2 bundle 调 `renderDesignHandoffText`：seq=2 的 04-PLAN 含 caveat、README 含增量提示、05-CHANGES 不含 caveat；seq=1 两者都不出现，建议章节仍在）。
- `backend/package.json`：`test` 列表加入 `src/design/id-collision.test.ts`。

未改前端、未改数据库表/列、未改 API 请求/响应形状、未迁移数据、未做 U7、未调模型。

### 7.2 命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 131/131（基线 122；+8 `id-collision`，+1 caveat） |
| `npm run smoke:design --prefix backend` | ✅ 设计阶段冒烟通过 |
| `npm run smoke:design-handoff --prefix backend` | ✅ 交接包冒烟通过 |
| `npm run smoke:change-set --prefix backend` | ✅ C1 变更循环冒烟通过 |
| `npm run smoke:handoff-input --prefix backend` | ✅ 需求→设计交接冒烟通过 |
| `npm run smoke:requirements --prefix backend` | ✅ 需求文档冒烟通过 |
| `npm test --prefix frontend` | ✅ 69/69 |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `npm run check:vue --prefix frontend` | ✅ 全部 SFC 导入完整 |

### 7.3 偏差 / 说明

- `idRemap` 有两条保护：raw id 若命中本应用已有行或本次已保留的行（`used`），不改写引用，避免把现有/已指向保留 rawId 的引用误改；同一 rawId 只在第一次换 ID 时登记映射，后续同 rawId 不覆盖。
- `rollbackDesignVersion` / `restoreDesignVersionConfirmed` 也一并包了事务（交接单为“若容易”）。
- 页面集/页面/实体 ID 前缀仍为 `ps` / `pg` / `ent`，只是页面集不再用 `hash(sceneKey)` 作为 ID；生成的成功路径仍是“能保留就保留”，编辑/版本/回滚的 ID 稳定性不变。
- caveat 文案用反引号包裹 `05-CHANGES.md`（交接单写纯文本），与交接包其它文档引用一致；测试按 `05-CHANGES.md` 断言。
- 两应用同 `EPIC-001` 的验证在服务层（真实临时 SQLite、真实两个 `apps` 行）完成；未单独再做 HTTP/API 级脚本（可选，未做）。

### 7.4 评审 must-fix 复核（2026-11-12，主会话独立验证后）

主会话发现：`normalizeEntities` / `normalizePageSets` / `normalizePages` 只在 `matched` 时 `used.add(id)`；新对象接受 raw id 后未登记，同一 payload 内两个新对象使用同一 raw id 时会都认为可用，最终 `UNIQUE constraint failed`（虽然事务回滚、但保存失败）。

修复：

- 三个 normalizer 在每次确定 id 后**无条件 `used.add(id)`**（matched / 接受 raw / `uniqueId` 生成；`uniqueId` 内部已 add 也无害）。
- `idRemap` 复核：同一 rawId 只在**第一次需要换 ID**时登记（`!idRemap.has(rawId)`），后续同 rawId 不再覆盖；若第一个对象已接受/保留该 rawId，`used` 命中后不登记 remap，字段/关系引用继续指向保留 rawId 的对象。
- 新增 3 项回归测试（见 §7.1 第 6/7/8 项）：重复 raw 实体 ID（含关系 target 指向保留 rawId 的实体）、重复 raw 页面集 ID、一个页面集内重复 raw 页面 ID；均断言保存成功、ID 不同、DB 两条都在。
- 复跑：`npm run build --prefix backend` ✅、`npm test --prefix backend` ✅ 131/131（+3）、`smoke:design` ✅、`smoke:design-handoff` ✅。未改其它范围。

### 7.5 未验证

- 未调用真实模型/opencode（本修复不需要）；未跑 Playwright（本轮无前端改动，交接单未要求）。
- 未做多进程并发写同一 SQLite 文件的压力测试（写盘正确性依赖 SQLite 事务/锁；本轮为单进程串行验证）。
- 未验证 `apps>0` 的存量冲突数据修复（当前 `apps=0`，无需迁移）。

