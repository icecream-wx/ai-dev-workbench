# I-10 开发会话列表实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已完成（2026-11-11）**；实施结果/偏差见文末 §7。
上游：`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.4、`docs/STATUS.md`（C1/R2a/R2b）。
范围：**I-10**——开发页左侧会话列表 + 查看/切换/重命名/归档/恢复；**同一时间仍只有一个 active 会话**。不做 I-09（长会话 health/compact/分阶段）、R2c、R4；不做消息数/工具数。

---

## 1. 已确认决策

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 布局 | 开发页新增**左侧会话栏**（约 260px，可折叠），中间时间线，右侧现有会话信息/交接文档/文件变化。 |
| 2 | 计数 | 本期**不做**消息数/工具数；列表显示标题/时间/模型/状态/变更单/handoff 版本。 |
| 3 | 恢复 | 允许恢复归档会话；若会话 `handoffVersion` 与当前交接包不同，提示“基于旧交接包，建议新建会话”，确认后可恢复。 |
| 4 | 切换/归档 active | 先二次确认；后端 best-effort `interrupt` 当前 active opencode 会话后再切换/归档，避免两个会话同时写应用目录。 |
| 5 | 分组 | **按变更单分组**（最新 seq 在上）；组内按创建时间倒序；无 `change_set_id` 的旧会话归“早期会话”。组头显示变更单/状态/交接包版本。 |

---

## 2. 数据与后端

### 2.1 数据

`app_sessions` 增加（`ensureColumn`）：

```sql
title TEXT,
note  TEXT
```

- 不用新增计数列。
- `last_active_at` 已有，作为“最后活跃”。

### 2.2 会话列表

`GET /api/apps/:id/development/sessions`

- 应用存在校验；返回该应用全部 `app_sessions`（active/archived/stale），按 `created_at DESC`。
- 合并 `opencode.listSessions(directory, 100)`（best-effort）：
  - `opencodeTitle`（opencode 自动标题）；
  - `opencodeExists`：opencode 侧是否还存在（不存在时可标记 stale；opencode 不可用时该字段为 `null`，不要误判）。
- 每项返回：

```json
{
  "id": "session row id",
  "opencodeSessionId": "ses_...",
  "title": "工作台标题（可能 null）",
  "note": "备注",
  "displayTitle": "工作台标题 → opencode 标题 → 应用名 · 创建时间",
  "status": "active|archived|stale",
  "model": { "providerID": "...", "id": "..." } | null,
  "createdAt": "...",
  "updatedAt": "...",
  "lastActiveAt": "...",
  "changeSetId": "cs-...",
  "changeSetSeq": 2,
  "changeSetTitle": "新增客户等级",
  "changeSetStatus": "completed",
  "handoffVersion": 2,
  "handoffHash": "...",
  "opencodeExists": true,
  "active": false
}
```

- 分组由前端做（按 `changeSetSeq` 倒序；null 归“早期会话”）。

### 2.3 切换 active

`POST /api/apps/:id/development/sessions/:sid/activate`

- 应用必须 `development/completed`（复用 `assertDevReady` 的等价校验；若当前无 active 会话也可激活）。
- 会话必须属于该应用（否则 404）。
- 目标 opencode 会话不存在 → 标记该行 `stale`，返回 409「会话已失效，请新建会话」。
- 若当前有另一个 active：
  1. best-effort `opencode.interrupt(current.opencode_session_id, true)`（忽略错误；不阻塞）；
  2. 归档当前 active（`status='archived'`）；
  3. 目标置 `active`，更新 `updated_at`。
- 返回目标会话的开发状态（时间线/模型/pending），相当于 `GET /development?sessionId=<target>`。
- 阶段事件：`session-activated`。

### 2.4 重命名/备注

`PATCH /api/apps/:id/development/sessions/:sid`

- body `{ title?: string, note?: string }`。
- title trim 后 ≤120；空字符串表示清除（回退 `displayTitle`）；note ≤500。
- 允许 active/archived；只改工作台记录，不改 opencode 标题。
- 返回更新后的列表项。

### 2.5 归档

`POST /api/apps/:id/development/sessions/:sid/archive`

- 会话属于该应用；已是 archived 则幂等返回。
- 若是当前 active：先 best-effort interrupt，再置 `archived`；归档后应用可以没有 active 会话（前端显示“选择或新建会话”）。
- 不删除 opencode 会话/消息。
- 阶段事件：`session-archived`（已有事件名，可复用/补 detail）。

### 2.6 读取指定会话（只读）

`GET /api/apps/:id/development?sessionId=<sid>`

- 不传 `sessionId`：现有行为（active 会话）。
- 传 `sessionId`：读取该应用指定会话的时间线；非 active 时 `readOnly=true`。
- 响应增加：
  - `readOnly: boolean`；
  - `session.status`（已有）；
  - 归档会话的 `pending` 权限/表单仍可展示，但前端禁用回复（后端 `permission/form reply` 仍只允许 active，已满足）。
- 会话不存在/不属于该应用 → 404；opencode 会话不存在 → 标记 stale，返回 `session` + `state=null`（与现有 stale 行为一致）。

### 2.7 新建/提示

- `POST /development/session` 保持不变（新会话归档旧 active）。
- 新会话默认标题：`<应用名> 开发 · MM-DD HH:mm`（避免同名为空）；旧会话（title=null）前端显示 `应用名 · 创建时间`。
- 首条提示文案更新：`当前会话会归档，新会话不会自动接续旧上下文；旧会话保留在左侧列表，可随时查看/恢复。`（作为 UI 提示，不写进 prompt 协议）。

---

## 3. 前端

### 3.1 布局

`DevView.vue` 改为三栏：

```
[左侧会话栏 260px，可折叠] [中间时间线 + Composer] [右侧现有 aside]
```

- 窄屏（<1100px）：会话栏默认折叠，顶部按钮展开为抽屉/覆盖层。
- 保留现有右侧“会话信息 / 交接文档 / 文件变化”。

### 3.2 会话栏

新增 `frontend/src/dev/SessionList.vue`（+ `session-labels.js` 纯逻辑）：

- 顶部：`开发会话` + `新会话` 按钮 + 搜索框（标题/备注，忽略大小写）。
- 分组：按变更单 `seq` 倒序；组头 `初始开发` / `变更 #N · 标题` + 状态 + `交接包 vZ` + 会话数；组可折叠，默认展开 active 所在组（没有 active 时展开最新组）。
- 无 `changeSetSeq` → “早期会话”组。
- 列表项：
  - `displayTitle`、创建/最后活跃时间、模型简写、状态徽标（进行中/已归档/已失效）；
  - 组内显示 `handoff vZ`；active 高亮；
  - hover 操作：重命名、归档（active）/恢复（archived）；
  - 点击：active 直接保持；archived 加载只读时间线；stale 提示新建。
- 重命名：小弹窗/`ElMessageBox.prompt`，提交后刷新列表。
- 归档：确认文案说明“会先停止当前会话”；归档 active 后清空当前时间线，显示空状态“选择或新建会话”。
- 恢复：确认；若 `item.handoffVersion !== 当前交接包版本`，先提示“该会话基于交接包 vZ，当前 vN；继续可能使用旧上下文，建议新建会话”，确认后调用 activate。
- 搜索无结果空状态。

### 3.3 只读会话

- `DevView` 增加 `readOnly` 状态（来自 API）：
  - Composer 替换为横幅：`该会话已归档，只读查看；恢复为当前会话后可继续发送。` + “恢复为当前会话”按钮；
  - 权限/表单卡片保留展示，但操作按钮禁用（`PermissionCard`/`FormCard` 增加 `readonly` prop 或外层禁用）；
  - “停止”按钮隐藏/禁用；
  - 顶部标题显示“只读 · 已归档”。

### 3.4 新会话提示

- “新会话”确认文案更新为 §2.7 的文案；创建成功后刷新列表、选中新 active。

---

## 4. 测试与验证

后端：

- 单测/接口：列表（分组字段/displayTitle/opencodeExists null 不误判）、activate（归档当前 + 激活目标 + interrupt best-effort）、跨应用 404、stale 目标 409、rename 长度/清除、archive 幂等/active 归档后无 active、指定 sessionId 只读、`permission/form reply` 非 active 拒绝。
- `npm run build --prefix backend`、`npm test --prefix backend`。
- 新增/扩展 `smoke:dev-sessions`（或扩 `smoke:dev`）：创建 A → 新会话 B → 列表两组/标题/状态 → 重命名 A → 只读查看 A → 恢复 A（B 归档）→ 归档 A（无 active）→ 新建 C → 删除应用清理。需要 opencode 可用时可开真实 `CHANGE_SET_SMOKE_DEV` 类似开关；不强制真实模型。
- 回归：`smoke:dev`、`smoke:change-set`、`smoke:design-handoff`、`smoke:requirements`。

前端：

- `session-labels.js` 单测：分组排序、displayTitle 回退、状态标签、搜索、handoff 版本差异判断。
- `npm test --prefix frontend`、`npm run typecheck --prefix frontend`、`npm run build --prefix frontend`、`node check-vue-imports.cjs`。
- Playwright（API/真实 opencode 预置会话，不强制模型）：
  - 两个会话分组显示；active 高亮；重命名；归档会话只读（Composer 隐藏、权限按钮禁用）；恢复（含 handoff 版本提示）；归档 active 后空状态；新会话；
  - 变更单分组：初始开发 / 变更 #2 各一组，版本标签正确；
  - 0 console error / 0 非预期 API >=400。

---

## 5. 不做 / 边界

- 不做消息数/工具数统计。
- 不做 I-09（长会话健康度/compact/分阶段）、R2c、R4。
- 不做跨应用会话混排、不做删除 opencode 会话（仅归档）。
- 不改交接包/需求/设计版本语义。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 6. 文档

更新 `docs/STATUS.md`（「I-10 完成」/摘要表/总状态/未验证）、本交接单状态与实施结果、`docs/plans/2026-11-11-main-review-handoff.md`（下一步 I-09，R2c 之后）、`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md`（I-10 落地记录）。

完成后回传主会话：改动文件、命令/结果、未验证项、偏差、需决策问题。主会话再评审。

---

## 7. 实施结果（2026-11-11）

### 7.1 已落地

- **数据**：`app_sessions.title/note`（建表 + `ensureColumn`）。
- **后端 API**：
  - `GET /api/apps/:id/development/sessions`：全部会话 + best-effort opencode 合并（未运行时不启动，`opencodeExists=null`）；返回 `displayTitle/opencodeTitle/changeSetSeq/changeSetTitle/changeSetStatus/handoffVersion/opencodeExists/active`。
  - `POST /development/sessions/:sid/activate`：归属 404；目标 stale → 409；当前 active 先 `interrupt`（best-effort）再归档；目标 active；事件 `session-activated`。
  - `PATCH /development/sessions/:sid`：title ≤120/note ≤500；空 title 清除；不改 opencode 标题。
  - `POST /development/sessions/:sid/archive`：幂等；active 先 interrupt 再归档；可无 active。
  - `GET /development?sessionId=`：指定会话；非 active `readOnly=true`；stale 标记并返回 session + `state=null`。
  - 新会话默认标题 `<应用名> 开发 · MM-DD HH:mm`；新会话提示文案更新。
- **前端**：`SessionList.vue` + `session-labels.js`；`DevView` 三栏/窄屏折叠、变更单分组/版本标签、搜索、重命名、归档/恢复、归档只读（Composer 替换为横幅、权限/表单禁用、停止隐藏）、归档 active 空状态、旧交接包恢复提示；`PermissionCard/FormCard` `readonly`。
- **测试**：后端 116/116；前端 54/54；`smoke:dev-sessions`（真实 opencode，不调用模型）；`smoke:dev`/`smoke:change-set`/`smoke:design-handoff`/`smoke:requirements` 回归；Playwright（API 预置）0 console error / 0 非预期 API >=400。

### 7.2 偏差/补充

1. `GET /development/sessions` 不主动启动 opencode：仅在已运行时合并标题/存在性，否则 `opencodeExists=null`。打开开发页会先 `GET /development` 恢复会话，随后列表刷新即可补齐。
2. 列表只合并 opencode 最近 100 个会话；列表不据此自动标 stale，只有显式读取/切换目标时标记。
3. 点击归档会话只读查看不弹确认；恢复/归档/新会话前确认。恢复（activate）是服务端“切换 active”的实际入口。
4. `smoke:dev` 原脚本依赖旧 structured 应用完成需求；R1 后新应用默认 doc 模式，脚本已改为 doc 需求/设计/交接包种子（验证内容不变）。
5. 未做消息数/工具数、I-09、R2c、R4；未删除 opencode 会话。

### 7.3 未验证/限制

- 权限/表单“只读禁用”由 Playwright 注入 pending 验证；真实归档会话若没有 pending 则不显示卡片。
- 窄屏抽屉只做 CSS/默认折叠，未单独跑窄屏截图用例。
- 恢复旧交接包会话只提示，不自动迁移上下文（按设计）。

