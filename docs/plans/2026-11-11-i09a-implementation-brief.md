# I-09a 会话健康度 + 原生 compact 实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已完成（2026-11-11，待主会话评审）**——按本单实施 I-09a，结果/偏差见 §7。
上游：`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.1/4.3.5、`docs/STATUS.md`「I-10 完成」「I-10 评审」。
范围：**I-09a**——按模型上下文百分比的健康度 + opencode 原生 compact + 时间线压缩事件。**I-09b（分阶段）本轮不做**；不做 R2c、R4。

---

## 1. 已确认决策

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 阈值 | **按所选模型上下文百分比**：≥60% 黄色“建议压缩”，≥85% 红色“强烈建议”。 |
| 2 | 辅助阈值 | **不设**时长/消息/工具阈值；只展示，不提示。 |
| 3 | 模型上限 | 用 `GET /api/model` 的 `limit.context`（opencode 2.2.5 已实测 61/62 模型有值）。 |
| 4 | 压缩 | 用 opencode 原生 `POST /api/session/{id}/compact`；用户手动触发，不自动。 |
| 5 | 分阶段 | I-09b 后续再做（R2c/R4 之后评估）。 |

---

## 2. 后端

### 2.1 上下文用量

- **模型上限**：按会话的 `provider_id/model_id` 查 `opencode.listModels(directory)` 的 `limit.context`；结果做短 TTL 缓存（如 60s，按 directory+model），避免每轮都拉模型列表。查不到 → `limit=null`。
- **当前用量**（近似值，UI 标“约”）：
  - 取**最新一条 assistant 消息**的 `tokens`：`used = input + cache.read + cache.write`（opencode/AI SDK 口径；无 cache 时即 input）。
  - 没有 assistant 消息 → `used = 0`。
  - 不要用会话聚合 `info.tokens` 作为上下文用量（会超 100%）；聚合值仍保留在 stats 里展示总量。
- 计算：
  - `percent = limit ? used / limit : null`；
  - `level = percent === null ? 'unknown' : percent >= 0.85 ? 'danger' : percent >= 0.6 ? 'warn' : 'ok'`。
- 返回结构（`DevProgress` 增加）：

```ts
context: {
  used: number            // 最新 assistant 上下文 token（近似）
  limit: number | null    // 模型 limit.context
  percent: number | null  // 0..1
  level: 'ok' | 'warn' | 'danger' | 'unknown'
}
```

- `buildProgress` 只负责从 messages 算 `used`；`dev/service.stateFor` 查模型 limit 后补齐 `limit/percent/level`（archived 只读会话同样适用）。
- 模型未提供 limit：`percent=null`、`level='unknown'`，UI 只显示 token 数。

### 2.2 compact

- `OpencodeRuntime.compactSession(sessionId)`：

```ts
async compactSession(sessionId: string): Promise<unknown> {
  await this.ensureStarted()
  const result = await this.client.request('POST', `/api/session/${encodeURIComponent(sessionId)}/compact`, { body: {} })
  if (!result.ok) throw this.httpError('压缩上下文', result.status, result.text)
  return result.data
}
```

- `POST /api/apps/:id/development/compact`：
  - `appOrThrow` + `assertDevReady`；
  - 必须存在 active 会话（否则 409「当前没有进行中的开发会话」）；
  - 调用 `opencode.compactSession`；阶段事件 `context-compacted`；
  - 返回 `{ ok: true, message: '已请求压缩上下文，将在下一步生效' }`；
  - opencode 报错 → 透传可读错误（不 500 裸抛）。

### 2.3 时间线 compaction 事件

- opencode compact 会写入一条 `type: 'compaction'` 的消息（已实测）。
- `timeline.ts` 的 `normalizeMessages` 识别并输出一个轻量事件消息（建议 `role: 'notice'` 或新增 `kind: 'compaction'`），文本“上下文已压缩”，带时间；不要当普通 assistant 文本。
- 前端时间线渲染为一条系统提示/小卡片。

---

## 3. 前端

### 3.1 健康条

- `DevView` 顶部（agent/model/连接状态附近）增加：
  - 上下文 chip：`上下文 62% (65k / 1.05M)`；`level` 决定颜色（ok 灰/绿、warn 黄、danger 红）；
  - `percent=null` 时显示 `上下文 65k`（不显示百分比）；
  - 旁边 `压缩上下文` 按钮：仅 active 且非只读显示；`warn/danger` 时高亮。
- `warn/danger` 时在时间线上方显示一条提示条：
  - warn：`上下文使用 62%，建议压缩上下文（可能丢失细节，由你确认）`
  - danger：`上下文使用 88%，强烈建议压缩上下文`
  - 带“压缩上下文”按钮。
- 右侧“会话”卡补充：上下文 used/limit/percent、时长、消息数、工具数（已有部分保留）。
- 只读/归档会话：不显示压缩按钮；健康条仍可显示（只读查看）。

### 3.2 压缩交互

- 点击“压缩上下文” → 二次确认：`压缩会用总结替换较早上下文，可能丢失细节；当前会话与代码不会中断。继续？`
- 调用 API → 成功 `ElMessage.success('已请求压缩，将在下一步生效')`，刷新状态/列表；失败显示可读错误。
- 刷新后时间线出现“上下文已压缩”事件；健康度应在新 assistant 消息后回落（不强制立即变化）。
- `actionBusy` 增加 `'compact'`，期间禁用按钮。

### 3.3 纯逻辑

- `frontend/src/dev/dev-health.js`（或并入 `session-labels.js`）：
  - `formatTokenCount(n)` → `65k` / `1.05M`；
  - `contextLevel(percent)` → ok/warn/danger/unknown；
  - `contextLabel(context)` → `上下文 62% (65k / 1.05M)` / `上下文 65k` / `上下文 —`；
  - 单测覆盖边界（0、59.9%、60%、85%、100%、limit null）。

---

## 4. 测试与验证

后端：

- 单测：
  - `buildProgress` 用合成 messages 验证 `used` 取最新 assistant（input+cache）、无 assistant 为 0；
  - limit 查找/补齐 percent/level（ok/warn/danger/unknown）；
  - `compactDevSession`：无 active 409、调用成功、opencode 错误透传；
  - timeline `compaction` 消息归一化；
  - 模型 limit 缓存（可选）。
- `npm run build --prefix backend`、`npm test --prefix backend`。
- `smoke:dev-sessions` 扩展或新增 `smoke:dev-health`：真实 opencode 创建会话 → `GET /development` 有 `context` 字段（limit 为模型上下文、used 数字）→ `POST /development/compact` 200 → 刷新时间线出现 compaction/notice → 无 active 时 compact 409 → 删除。
- 回归：`smoke:dev-sessions`、`smoke:dev`、`smoke:change-set`、`smoke:design-handoff`、`smoke:requirements`。

前端：

- `npm test --prefix frontend`（新增 format/level 单测）、`npm run typecheck --prefix frontend`、`npm run build --prefix frontend`、`node check-vue-imports.cjs`。
- Playwright（真实 opencode，不必真实模型；可用新建会话 + 0% 场景 + mock 路由注入 warn/danger）：
  - 顶部 chip 显示 `上下文 0%`/`上下文 …`；右侧卡数值；
  - 点击“压缩上下文”→ 确认 → API 200 → notice；
  - mock `context.percent=0.62` 显示黄色提示条和按钮；`0.88` 显示红色；
  - 只读会话不显示压缩按钮；
  - 0 console error / 0 非预期 API >=400。

---

## 5. 不做 / 边界

- 不做 I-09b（分阶段/交接包规模/03-PLAN 建议）。
- 不做自动 compact、不做时长/消息/工具阈值提示（只展示）。
- 不改会话列表/切换/归档语义（I-10 已完成）。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 6. 文档

更新 `docs/STATUS.md`（「I-09a 完成」+ 摘要表 + 总状态 + 未验证）、本交接单状态/实施结果、`docs/plans/2026-11-11-main-review-handoff.md`（下一步 R2c，I-09b 后续）、`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md`（I-09a 落地记录）。

完成后回传主会话：改动文件、命令/结果、未验证项、偏差、需决策问题。主会话再评审。

---

## 7. 实施结果（2026-11-11，实施会话）

### 7.1 后端

- `backend/src/opencode/runtime.ts`：新增 `compactSession(sessionId)` → `POST /api/session/{id}/compact` body `{}`；非 2xx 走 `httpError('压缩上下文', …)`（4xx 原样、5xx→502，文本脱敏）。
- `backend/src/dev/timeline.ts`：
  - `DevContextUsage`（`used/limit/percent/level`）+ `DevProgress.context`；
  - `contextUsedTokens()`：从**最新** assistant 消息取 `input + cache.read + cache.write`（无 tokens 时回退更早的 assistant；无 assistant 为 0），**不用** `info.tokens` 聚合值；
  - `normalizeMessages()` 识别 `type:'compaction'` → `kind:'compaction'` + 文本“上下文已压缩”（不当 assistant 文本）；`status:'failed'`（空会话 compact）→ `kind:'compaction-failed'` + “上下文压缩未执行：<原因>”；
  - `buildSteps()` 把 compaction 当作步骤边界（flush）。
- `backend/src/dev/service.ts`：
  - `modelContextLimit(dir, provider, model)`：按 `directory+provider/model` 60s TTL 缓存；opencode 未就绪时**不启动**、返回 null（不缓存）；查不到 `limit.context` → null；
  - `contextWithLimit(used, limit)`：`percent = used/limit`，`level` ≥0.85 danger / ≥0.6 warn / 否则 ok，limit 未知 → percent null + unknown；
  - `stateFor()` 补齐 `context.limit/percent/level`（archived 只读会话同样补齐）；
  - `compactDevSession(appId)`：`assertDevReady` + active 会话（无 active 409「当前没有进行中的开发会话」）→ `opencode.compactSession` → 事件 `context-compacted` → `{ok:true,message:'已请求压缩上下文，将在下一步生效'}`；opencode 错误原样透传（带 status，不裸抛 500）。
- `backend/src/dev/routes.ts`：`POST /api/apps/:id/development/compact`。

### 7.2 前端

- `frontend/src/dev/dev-health.js`（纯逻辑）：`formatTokenCount`（65k/1.05M）、`contextLevel`（0.6/0.85 边界）、`contextPercent`、`contextLabel`（`上下文 62% (65k / 1.05M)` / `上下文 65k` / `上下文 —`）、`contextDetail`、`contextTitle`、`contextHint`、`contextNeedsCompact`；`dev-health.test.mjs` 6 项。
- `frontend/src/dev/DevView.vue`：
  - 顶部 chip（`data-testid="context-chip"`，ok 灰 / warn 黄 / danger 红；tooltip 说明“约”）；
  - 顶部 `压缩上下文` 按钮（仅 active 非只读；warn/danger 高亮；`actionBusy='compact'` 期间禁用）；
  - warn/danger 提示条（`data-testid="context-hint"`）+ 条内压缩按钮；只读会话不显示提示条/按钮；
  - 时间线 compaction 轻量提示（`data-testid="timeline-compaction"`；失败为红色“未执行”）；
  - 右侧会话卡补充“消息/上下文”（耗时/工具/Token 保留）；
  - 二次确认文案：`压缩会用总结替换较早上下文，可能丢失细节；当前会话与代码不会中断。继续？`；成功提示 `已请求压缩，将在下一步生效`。
- `frontend/src/dev/api.ts` / `types.ts`：`compactDevSession`、`DevContextUsage`、`DevSessionMessage.kind`。

### 7.3 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 123/123（新增 7：context used/level、compaction 归一化、compact 路由 409/成功/错误透传） |
| `npm run smoke:dev-health --prefix backend` | ✅ 真实 opencode 2.2.5：新建会话 context（used=0、limit=1048576 与模型一致）→ compact 200 → 时间线 compaction 提示 → 无 active compact 409 → 删除 |
| `npm run smoke:dev-sessions` / `smoke:dev` / `smoke:change-set` / `smoke:design-handoff` / `smoke:requirements` | ✅ 全部 exit=0（`smoke:dev` 含真实模型回复） |
| `npm test --prefix frontend` | ✅ 60/60（新增 dev-health 6 项） |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `node check-vue-imports.cjs` | ✅ 全部 SFC 导入完整 |
| Playwright（真实 opencode，不调用模型；warn/danger 用路由注入） | ✅ 真实 0% chip / warn 62% 黄 chip+提示条+高亮按钮 / danger 88% 红 / compact 200+成功提示+时间线提示 / 只读会话 chip 仍在、无按钮与提示条；0 console error / 0 非预期 API >=400 |

E2E 脚本/截图（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\i09a-e2e`）：`01-context-ok.png`、`02-context-warn.png`、`03-context-danger.png`、`04-compacted.png`、`05-readonly-no-compact.png`。

### 7.4 偏差 / 未验证 / 待决策

1. **偏差（新增失败提示，超出交接单原文）**：实测空会话调用 `POST /compact` 时 **HTTP 仍 200**，opencode 写入的消息是 `{type:'compaction', status:'failed', error:{type:'compaction.unavailable', message:'Nothing to compact yet'}}`。为避免“谎报已压缩”，时间线按 `status` 区分：`failed` → 红色“上下文压缩未执行：没有可压缩的上下文”（其他原因保留脱敏截断文本），`compaction` → “上下文已压缩”。API 契约仍按交接单返回 200 `{ok:true,message:'已请求压缩上下文，将在下一步生效'}`（文案是“已请求”）。**需主会话确认**是否接受“API 200 + 时间线如实提示”的口径，或后续把 compact 结果也回传到 API（需等待/轮询 compaction 消息）。
2. **未验证（真实压缩成功路径）**：冒烟/E2E 均未调用模型，因此只覆盖“空会话 → failed 提示”与“请求 200”；真实长会话 `status:'completed'` 的“上下文已压缩”由单测（合成消息）覆盖，未用真实模型压缩一次。建议主会话在有真实会话时补一次人工验证。
3. **`used` 是近似值**：按最新 assistant 的 `input+cache.read+cache.write` 估算，chip tooltip 已标注“约”；压缩后需等新 assistant 消息才会回落（交接单已说明，不强制立即变化）。
4. **模型 limit 缓存 60s**：切换模型后最长 60s 内仍可能显示旧 limit；opencode 未就绪时不缓存、不启动。
5. **未做**：I-09b（分阶段/交接包规模/03-PLAN 建议）、自动 compact、时长/消息/工具阈值提示、R2c、R4；未改 I-10 会话列表语义。

