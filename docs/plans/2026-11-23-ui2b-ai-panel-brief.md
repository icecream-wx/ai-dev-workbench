# UI-2b：AI 面板空态/头部/加载/错误（实施交接单）

> 日期：2026-11-23。沿用 UI-2a 的共享 `StatePanel` 与 UI-1a/1b 的 **A+B 混合、中等密度、轻量图标式**。本批只做 `AgentChatPanel`（AI 面板）的空态/示例/头部/加载/错误，不做 UI-3（消息/工具/权限/表单卡片 DOM 与逻辑）、不改 DevView 时间线（独立实现）。

## 1. 范围与硬约束

**做**

- `frontend/src/workbench/AgentChatPanel.vue`：空态（StatePanel empty + 上下文 pills + 按视图示例 + CTA）、头部两行、会话加载时间线骨架、错误条 `role=alert` + 重试。
- `frontend/src/shared/StatePanel.vue`：新增可选 `#meta` 插槽（说明与示例之间）。
- `frontend/src/workbench/chat-empty.js` + `chat-empty.test.mjs`：空态/示例/上下文/占位的纯逻辑与单测。
- `frontend/src/studio/StudioView.vue`：仅多传 `:pack-id="packId"`（不改布局/commands=[] 行为）。
- `backend/scripts/ui2b-shots.ts`（新）+ `p2-e2e.ts`/`p3-e2e.ts` 断言 + 文档（STATUS/plans README/README）。

**不做**

- 不改后端/DB/API/依赖/`templates/**`；不改 `Composer`。
- 不改消息/工具/权限/表单卡片 DOM 结构与逻辑；不改 SSE/停止/compact/只读条/命令按钮语义；保留全部 testid 的既有含义。
- 不改 `RequirementsView`/`DesignView` 结构（继续只传 `view`/`moduleKey`）；不改 Studio 布局。
- 不启停真实 3300/4771；不调真实模型；不读写真实 `data/`/`projects/`/`.env`；不做任何 git 操作。

## 2. `AgentChatPanel` 行为

| 场景 | 实现 |
| --- | --- |
| 无会话空态 | `chat-empty`（StatePanel empty，**顶部对齐**：滚动区 12px + 卡片 16px ≈ 距头部 28px）：标题「开始与 AI 协作」、说明（`emptyHint` 或按视图默认）、上下文 pills、3 条示例、CTA「新会话」（调用现有 `newSession`） |
| 有会话无消息 | 同容器，标题/CTA 改「发送第一条消息」（CTA 聚焦 composer）；`readOnly` 会话不显示示例与 CTA |
| 上下文 pills | 视图（需求视图/设计视图/模板工作室/开发视图）+ 模块 key（`模块 MOD-001`）+ 工作室 `pack <id>`（`view=template` 且传 `packId`）；不重复顶部模板/风格 chip；testid `chat-context-view`/`chat-context-module`/`chat-context-pack` |
| 示例 prompts | `chat-empty.js#emptyExamplesFor(view)`：requirements **AI 专属、与需求视图中央空态（`RequirementsView` 的 3 个 `example-prompt-*`）刻意不重复**——「帮我梳理这个应用还缺哪些模块。/ 根据当前需求生成下一个模块的文档骨架。/ 检查需求文档里缺失的验收标准。」；design「生成或更新当前模块设计并补齐页面契约 / 检查契约与实体字段一致 / 对照需求检查设计差异」；template「先读 catalog 给 3 个页面清单与字段建议 / 写 spec 并生成模板并报告 errors/warnings / 检查 spec 与 contract 是否一致」；development/未知兜底「先读 AGENTS 与设计参考再实现 / 检查当前模块完成度 / 列出下一步建议」；中央需求空态示例保持不变 |
| 示例点击 | `setComposer(text)`：只填输入框 + `nextTick` 聚焦，**不自动发送**、不建会话；testid `chat-example-1..3` |
| 头部 | 两行：①「AI 对话」+ 状态 chip；②会话下拉 + 上下文 chip + 压缩 + 新会话（`flex-wrap`，窄屏换行）；`chat-history-select`/`context-chip`/`compact-btn`/`chat-new-session-btn` 保留；无会话仍显示「暂无会话」 |
| 加载 | `chat-loading`（StatePanel loading，`skeleton="timeline"` 3 行，`role=status` + `aria-live=polite`）；`chat-timeline` 容器与滚动逻辑不变 |
| 错误 | `chat-error-strip` 保留「关闭」，加 `role="alert"`、换行与 `title`，新增 `chat-error-retry`（重新 `loadState` + `loadSessions`，不新增接口）；`errorText` 是服务端短句/固定中文提示，未做 details 折叠 |

新增可选 props：`emptyTitle`、`emptyExamples`、`packId`；`emptyHint`/`composerPlaceholder`/`api`/`commands` 语义不变（未传时按 view 默认，见 `chat-empty.js`）。

## 3. `StatePanel` 微调

- 新增 `#meta` 插槽（渲染在说明与示例之间）+ `.sp-meta` 样式；其余 variant/骨架/`role`/testid 行为不变。
- 空态卡片在对话区**顶部对齐**（`.chat-empty { margin-top: 16px }`，总距头部约 28px），示例列表为轻量行按钮（非大卡片），无插画/渐变。

## 4. e2e 断言

| 脚本 | 新增 | 断言数 |
| --- | --- | --- |
| `p2-e2e.ts` | 1b.1 空态标题「开始与 AI 协作」、1b.2 示例 3 条、1b.3 点击示例填入输入框（AI 专属示例含「还缺哪些模块」）、1b.4 未自动发送 | **116 → 120** |
| `p3-e2e.ts` | 1b.1 空态标题、1b.2 上下文 pills 可见、1b.3 视图 pill「设计」、1b.4 点击示例填入「页面契约」、1b.5 未自动发送 | **126 → 131** |
| `p4-e2e.ts` / `design-template-e2e.ts` / `design-template-studio-e2e.ts` / `custom-template-app-e2e.ts` | 未新增（回归） | 130 / 77 / 73 / 116 保持 |

## 5. 截图证据

脚本：`backend/scripts/ui2b-shots.ts`。前置 `npm run build --prefix frontend`；运行（backend 目录）：

```bash
npx tsx scripts/ui2b-shots.ts
```

- 复用 `p2-e2e-harness.ts`（真实后端 + 临时 SQLite/projects + `OPENCODE_AUTO_START=false` + stub opencode）；端口 **3435**（opencode 4435），不占用真实 3300/4771。
- 加载态用 Playwright route 挂起 `/api/apps/:id/development?`（不含 `/sessions`）；错误态用 500 响应。
- 每屏校验 `documentElement.scrollWidth`/`body.scrollWidth` 不超视口。
- 输出 `docs/plans/evidence/2026-11-23-ui2b/`（可用 `UI2B_SHOTS_DIR` 覆盖）。

| 截图 | 状态 |
| --- | --- |
| `ui2b-requirements-empty-1440.png` | 需求视图 + AI 面板空态（上下文 pills + 示例） |
| `ui2b-chat-loading-1440.png` | AI 面板会话加载骨架（3 行时间线骨架） |
| `ui2b-chat-error-1440.png` | AI 面板错误条 + 重试 |
| `ui2b-design-empty-1440.png` | 设计视图 + AI 面板空态（模块 pill） |
| `ui2b-studio-empty-1440.png` | 模板工作室 + AI 面板空态（pack pill） |
| `ui2b-requirements-empty-390.png` | 390 需求视图对话抽屉（空态可用、无横向溢出） |
| `ui2b-studio-empty-390.png` | 390 工作室「对话」面板空态 |

## 6. 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **189 / 189**（原 183，+6） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |
| `npm run build --prefix frontend` | 成功（exit 0） |
| `npm run e2e:p2 --prefix backend` | **120** 条断言，通过 |
| `npm run e2e:p3 --prefix backend` | **131** 条断言，通过 |
| `npm run e2e:p4 --prefix backend` | **130** 条断言，通过 |
| `npm run e2e:p7-3b --prefix backend` | **77** 条断言，通过（`StatePanel` 改动回归） |
| `npm run e2e:p7-7b --prefix backend` | **73** 条断言，通过（工作室空态/会话） |
| `npm run e2e:p7-7c --prefix backend` | **116** 条断言，通过（开发视图/自定义模板回归） |
| `npx tsx scripts/ui2b-shots.ts`（backend） | **7 张截图 + 7 次无溢出校验**，通过 |

结束核对：测试端口（3400—3500 / 4400—4900）无残留监听；真实 3300（PID 23668）/4771（PID 9092）未启停（只读观察）。未跑后端单测（未改 `backend/src`）。

## 7. 偏差与未验证

- **需求示例去重（收口微调）**：AI 面板需求视图示例改为 AI 专属 3 条（与 `RequirementsView` 中央空态示例不重复）；中央空态不变；单测新增「两处不重复」断言，`e2e:p2` 1b.3 断言随之改为含「还缺哪些模块」。
- **空态顶部对齐（收口微调）**：`chat-empty`/`chat-loading` 不再 `margin: auto 0`，改为 `margin-top: 16px`（总距头部约 28px）；1440/390 截图已重跑，仍无横向溢出。
- **pills 位置**：放在新增 `#meta` 插槽（说明与示例之间），而不是最后的操作行；避免看起来像按钮标签。
- **示例 testid**：`chat-example-1..3`（1 起，与既有 `example-prompt-*` 一致），未用 0 起。
- **未做**：会话数/最近会话摘要（下拉已含最近 5 个 + 当前/归档，未新增接口）；错误条 details 折叠（`errorText` 已是可读短句）；空态不做自动建议发送。
- **未验证**：真实 3300/4771 重启后的视觉效果需用户 `restart.cmd`/`restart.sh` 后复核（本轮 `frontend/dist` 已重建，静态托管即时生效）；未做像素级视觉回归；DevView 时间线（UI-2a 已改开始卡/空态）不在本批范围。
