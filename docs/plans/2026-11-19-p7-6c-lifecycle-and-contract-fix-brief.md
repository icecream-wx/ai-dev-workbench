# P7-6c 实施单：SSE 生命周期 + 契约枚举/路径小修（2026-11-19）

> 上游：P7-6b 真实模型闭环发现的三个问题。
> 本轮只做小修：开发会话完成检测、动作/树枚举软校验、风格文件路径统一。
> **不**跑真实模型；不启停真实 3300；不读写真实 data/projects/.env；不做 git；不改需求模板中心。

---

## 0. 出口标准

1. 开发/对话 SSE 在模型完成但 `session.idle` 未到/丢失时，能通过可靠回退判定完成并发送 `done`、关闭流；不无限挂起。
2. 前端开发视图状态不再长期停在“运行中”（必要时由后端 done 驱动；前端事件层也容错）。
3. `rowActions/toolbarActions`、`tree.actionStyle/selectionStyle` 有推荐值/软校验；不阻断旧 design.json。
4. 新应用蓝图风格路径统一为 `docs/design/template/styles/<styleId>/style.css`；scaffold/skill/digest/fidelity/docs 同步；旧应用不受影响。
5. 现有 123/85、e2e 基线保持；新增针对性测试。

---

## 1. SSE 生命周期

文件：`backend/src/chat/service.ts`、`backend/src/opencode/runtime.ts`、必要时 `frontend/src/dev/DevView.vue`。

- 现象：P7-6b 开发会话模型已输出最终总结并写完文件，但会话/SSE 未结束；`session.idle`/`session.execution.succeeded` 未到达或丢失。
- 方案：
  - 记录 `lastEventAt`（任意 session 事件）与 `hasActivity`（delta/text/tool）。
  - 增加 watchdog（如每 2s）：若距最后事件超过阈值（如 10s）且已有 assistant 文本/工具活动，调用 `opencode.session(sessionID)` 或 `opencode.messages(sessionID)` 判断是否已 idle/completed；确认完成后 `finish()` 并写 done。
  - 仅在确认完成时收尾；避免在长工具/权限等待中误判。
  - 若 opencode 事件类型有 `session.status`/`session.updated` 等 idle 表达，补充处理；以实际事件为准。
  - 保留 20 分钟总超时；清理 heartbeat/watchdog/timer。
  - `finish()` 幂等；`done` 只写一次；客户端断开/中断路径不重复。
- 测试：
  - 纯 helper（如 `isSessionComplete`/`shouldFallbackFinish`）单测；
  - 模拟事件流：只发 delta/text 不发 idle → watchdog 回退 done；
  - 正常 idle → 原有行为；
  - 失败/中断/超时仍正确。
- 前端：开发视图 `connectDevEvents` 收到 done/状态更新后结束“运行中”；若后端 done 已发但事件层未收到，视图通过 `GET development` 刷新收敛（可加“完成后重新拉取”）。
- 不要求真实模型复测；如能用一个假 opencode 事件流测试即可。

## 2. 契约枚举软校验

文件：`templates/agent/skills/adw-design-artifacts/references/design.schema.json`、`scripts/validate.mjs`、`backend/src/workspace/schema.ts`（如需）、`frontend/src/design/design-adapter.js`（如需）。

- `rowActions/toolbarActions`：
  - 推荐动作码：`create/edit/delete/detail/batchDelete/import/export/submit/cancel/enable/disable/approve/reject/print/copy`（可扩展）；
  - 非推荐值（如中文标签）只出 warning，不阻断；保留原值。
- `tree.actionStyle`：允许 `header|footer|none`；
- `tree.selectionStyle`：允许 `platform|dot|background`；
  - 未知值 warning；不阻断。
- `validate.mjs` 与后端 artifacts 的 warning 行为一致；旧 design.json 继续通过。
- 测试：含中文动作/未知树枚举 → warning；合法值无 warning；旧设计不变。
- 设计/开发 skill 文案补充推荐值。

## 3. 风格路径统一

- Scaffold：选中风格复制到 `docs/design/template/styles/<styleId>/style.css`；`design-system.json.styles`：
  ```json
  { "shared": "docs/design/template/styles/shared.css",
    "style": "docs/design/template/styles/<styleId>/style.css",
    "styleId": "<styleId>" }
  ```
- 更新 `backend/src/apps/scaffold.ts`、`templates/distribution.ts`（模板 skill 文案）、`dev/digest.ts`、`dev/fidelity.ts`、`templates/afc-remote/README.md`、设计 skill/AGENTS 文案。
- 兼容：新应用使用新路径；已存在应用若仍是 `styles/style.css`，fidelity 同时接受旧路径（不迁移、不报 fail），只提示。
- 测试：scaffold 产物路径/JSON；fidelity 新旧路径均 pass；distribution 文案。
- 不修改 P7-6b 证据目录（保留真实结果）；如需可用临时 app 验证新路径。

## 4. 验证

- `npm run build/test --prefix backend`（123+）
- `npm run build/test/typecheck/check:vue --prefix frontend`（85+）
- `npm run smoke:workspace --prefix backend`
- 如时间允许：`e2e:p4` 128、`e2e:p7-6a` 15、`e2e:preview` 77、`e2e:p7-3b` 45
- 不跑真实模型；不启停真实 3300；不读写真实 data/projects/.env；不 git。

## 5. 收尾

- 更新 P7 设计稿 P7-6c 记录、docs/STATUS.md（SSE 修复/枚举/路径）。
- 回报：修改点、测试结果、偏差、未验证项、环境确认。

## 6. 实施结果（2026-11-19）

> 结论：**已完成（待评审）**；未跑真实模型，真实 3300 未启停，未读写真实 `data/projects/.env`，未 git，未改需求模板中心。

- SSE：新增 `backend/src/opencode/session-state.ts` 纯函数；`chat/service.ts` 加 2s watchdog（最后事件后 10s 查会话/消息，确认完成才 `done`）、20 分钟总超时、幂等收尾、断开/中断不重复；兼容 `session.status/session.updated/session.state` 显式 idle；`dev/timeline.ts` 用当前轮 idle/outcome 收敛状态；`DevView.vue` 非 running 后清“思考中”。
- 枚举：schema 增 `x-adw-recommended/x-adw-allowed`；`validate.mjs` 与后端 `workspace/design-contract.ts` 同口径 warning，保留原值；旧 design.json 继续通过。
- 路径：新应用复制到 `docs/design/template/styles/<styleId>/style.css`，`design-system.json.styles` 增 `styleId`；scaffold/AGENTS/distribution/digest/prompt/SKILL/afc-remote README/command 同步；fidelity 兼容旧 `styles/style.css`（pass + 提示）、缺失只 warn；不迁移已有应用、不删旧文件；P7-6b 证据目录未改。
- 测试：后端 **132/132**；前端 **85/85**；`build/typecheck/check:vue` 通过；`smoke:workspace` 通过；`smoke:assets` 通过（临时 opencode，不调模型）；`e2e:p4` **128**、`e2e:p7-6a` **15**、`e2e:preview` **77**、`e2e:p7-3b` **45** 通过。
- 偏差：后端既有软字段（recipe/form/pagination 等）仍按 errors 返回（本轮不改既有口径）；watchdog 不做猜测，busy 一直为真且无 idle/outcome 时仍由 20 分钟超时兜底。
- 未验证：真实模型 idle 事件丢失的端到端收尾、宿主/浏览器长时间收敛、生成物 install/build、EOS/真实 3300。
- 详细记录：P7 设计稿第 23 节、`docs/STATUS.md`。

