# Agent-First 工作台 P4「开发视图收口」实施交接单（2026-11-18）

> 上游：`docs/plans/2026-11-18-agent-first-workbench-design.md` v3（§3 文件契约、§7 变化检测、§8 视图/会话）。
> P1—P3 已完成并通过评审（后端 73/73、前端 46/46、`e2e:p2` 104、`e2e:p3` 63、真实模型需求+设计+渲染通过）。
> 本单收口 **开发视图**：统一 prompt、去掉旧流程残留、补开发冒烟/Playwright、修 P3 遗留。
> 真实 3300 保持旧构建、不重建不重启；全部临时目录 + 独立端口；不调真实模型（主会话另跑）。

---

## 0. 出口标准

1. **统一 prompt**：`promptDevSession` 对 `requirements` / `design` / `development` 三个视图都用 `buildViewPrompt(view, text, module)`；development 不再走"原文直发"。
2. 开发首条提示/空态明确"先读 `AGENTS.md` + `docs/requirements/` + `docs/design/` + 现有代码，再动手"；不出现交接包（00-README/04-PLAN/manifest）、阶段条、变更单、确认等旧文案。
3. 开发会话列表保留完整能力：按 `view=development` 过滤、搜索、重命名、归档、恢复、归档只读、`?sessionId=` 只读。
4. 时间线/工具卡/diff/终端/权限卡/表单卡/Composer/停止/compact/健康度/文件变化可用（回归）。
5. **P3 遗留 should-fix**：`designs[].warnings` 合并进设计视图错误条；没有对应需求模块的"孤儿设计"要么作为只读项列出，要么给出明确警告（不再静默隐藏）。
6. 新增 `smoke:dev`（真实 opencode，**不调模型**）：建会话 → 状态 → 列表 → 重命名 → 归档 → 恢复/只读 → 视图过滤。
7. 新增 `e2e:p4`（stub）：开发视图空态/发送/流式/工具/权限/停止/会话列表/只读/compact/健康度/文件变化/响应式深浅色。
8. 回归全绿：后端 73+、前端 46+、`build`/`typecheck`/`check:vue`、`smoke:workspace`/`smoke:assets`、`e2e:p2`/`e2e:p3`。

## 1. 不做

- 交接包、版本、确认、变更单、阶段条、U7 分阶段、覆盖度、门禁。
- 需求/设计视图重写（已完成）；新增后端业务接口。
- 自定义 dev agent/skill/固定骨架/Git；不做回滚/并发兜底。
- `<768` 移动端。

## 2. 后端（最小改动）

1. `dev/service.ts#promptDevSession`：development 视图也使用 `buildViewPrompt('development', text, module)`；删除"原文直发"分支。
   - 保持 `command` 分支不变；空文本规则不变。
2. `dev/service.ts#DEFAULT_DEV_PROMPT`：确认文案为"先读 AGENTS.md 与 docs/ 下的需求/设计产物，再按用户目标开发；完成后汇报实现摘要/关键文件/运行方式/自测结果/未解决项"；去掉任何交接包/阶段措辞。
3. `dev/service.test.ts`：补 development 视图 prompt 含 `AGENTS.md`/`docs/requirements`/`docs/design` 的断言。
4. `smoke:dev`（新脚本 `backend/scripts/dev-smoke.ts`）：真实 opencode（`OPENCODE_AUTO_START=true`，独立端口），不调模型；覆盖出口 6。
5. 不改 `/chat` 与 `/development/*` 的响应形状（P2/P3 依赖）。

## 3. 前端（开发视图收口 + P3 遗留）

- `DevView.vue`：
  - 首条提示/空态/Composer 占位文案与新 prompt 一致（无交接包/阶段字样）；
  - 保留 SessionList（完整）、时间线、工具/diff/终端、权限/表单、停止、compact、健康度、文件变化；
  - 归档会话只读横幅与"切换为当前会话"沿用；
  - 清理残留样式/文案（如 `SessionList` 的 `.item-phase`、`phase` 命名若仅表示"执行阶段"则保留并注明）。
- `DesignView.vue`（P3 遗留）：
  - `warningLines` 合并 `designs[].warnings`（后端"设计模块没有对应需求模块文件"等）；
  - 孤儿设计：在模块列表末尾列出（`design-module-<MOD>`，标记"缺需求模块"）或至少在错误条首条提示；选中时仍可只读查看 ER/原型。
- `AgentChatPanel` 不改行为（P2/P3 回归）。
- `AppShell` 不改路由。

## 4. 测试与验收

| 项 | 要求 |
| --- | --- |
| 后端单测 | development prompt 断言；既有 73 保持 |
| 前端单测 | 若抽纯函数（首条提示/孤儿设计合并）则加测试；既有 46 保持 |
| `smoke:dev` | 真实 opencode 2.2.5、独立端口（如 3424/4724）、`OPENCODE_AUTO_START=true`、**不调模型**；会话创建/状态/列表/重命名/归档/只读/视图过滤 |
| `e2e:p4` | 扩展 stub harness（`P4_*` 参数或复用 P2 harness + `view=development`），端口 3424/3425 避开 3422/3423；覆盖出口 7；浅/深 × 1440/1024/768；0 console/page error、0 意外 API≥400、0 横向溢出 |
| 回归 | `e2e:p2` 104、`e2e:p3` 63、后端 73+、前端 46+、build/typecheck/check:vue、`smoke:workspace`/`smoke:assets` |
| 真实模型 | 主会话另跑：临时应用 + 真实 opencode/模型，开发会话要求 agent 先读 `docs/requirements`+`docs/design` 再改一个仓库内小文件（如给 `backend/README.md` 补一节）；验证工具卡/文件变化/汇报 |

## 5. 交付与风险

- 完成后回填 `docs/STATUS.md` 与 P4 brief「实施结果」；主会话复核后再做 P5（收尾/报告/真实实例切换）。
- 风险：
  1. 给 development 套 `buildViewPrompt` 会让每条消息变长 → 可接受（远小于产物本身）；注意不要重复塞入整篇文档。
  2. 开发视图 `DevView` 体量大 → 只改文案与测试，不重构时间线归一化。
  3. 孤儿设计列表可能影响布局 → 末尾单项 + 只读标记，保持现有三栏。
  4. `smoke:dev` 使用真实 opencode 但不调模型：不要触发 `prompt`；只测会话生命周期与状态读取。
  5. e2e stub 的 development 事件需复用真实事件名（`session.text.delta`/`session.execution.*`/`permission.asked`）。

---

## 实施结果（2026-11-18，P4）

### 改动 / 新增文件

**后端**
- `src/dev/service.ts`：`promptDevSession` 三个视图统一 `buildViewPrompt`（development 不再原文直发）；`DEFAULT_DEV_PROMPT` 改为读 `AGENTS.md` + `docs/requirements/` + `docs/design/` + 现有代码。
- `src/chat/service.ts`：development 视图 prompt 文案补 `docs/requirements/`、`docs/design/`。
- `src/dev/service.test.ts`：development prompt 断言（AGENTS.md / docs 路径 / 模块 / 非原文）+ 默认提示断言。

**前端**
- `src/dev/DevView.vue`：空态/首条提示文案对齐；Composer 占位“会先读 AGENTS.md 与 docs/ 再执行”；补 e2e testid（`dev-view/dev-status/dev-start-card/dev-start-prompt/dev-start-btn/dev-timeline/dev-sessions/dev-file-changes/dev-readonly-bar/dev-sidebar-toggle/dev-aside-toggle/dev-mask`）；aside 工作区文案去掉“P2/P3 重写”。
- `src/dev/SessionList.vue`：删除无引用样式 `.item-phase`/`.group-chip`/`.group-version`；会话项/操作按钮补 testid。
- `src/design/design-adapter.js`：新增 `mergeModuleEntries`（需求模块 + 孤儿设计）与 `designWarningsOf`（设计文件 warnings → 错误条行）。
- `src/workbench/DesignView.vue`：错误条合并 `designs[].warnings`；孤儿设计在模块列表末尾列出（「缺需求模块」徽标），选中可只读渲染 ER/原型，生成按钮禁用。
- `src/design/design-adapter.test.mjs`：+2 用例（孤儿合并、design warnings）。

**测试脚本**
- 新增 `backend/scripts/dev-smoke.ts`（`smoke:dev`）。
- 新增 `backend/scripts/p4-e2e.ts`（`e2e:p4`）。
- `backend/scripts/p2-e2e-harness.ts`：通用 `用户消息：` 提取（支持 development 统一 prompt）；权限/表单不再重复消息；`interrupt` 幂等。
- `backend/scripts/p3-e2e.ts`：新增孤儿设计场景（8b）。
- `backend/package.json`：`smoke:dev`、`e2e:p4`。

**文档**：`docs/STATUS.md`、本 brief、`README.md`（Playwright 命令与浏览器安装说明）。

### 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时目录） | **77 / 77**（must-fix 后 +4） |
| `npm test --prefix frontend` | **48 / 48**（adapter 12 + view-commands 4 + 既有） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过 |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode / 4719，不调模型） |
| `npm run smoke:dev --prefix backend` | 通过（真实 opencode 2.2.5 / 4724，不调模型）：建会话/状态/列表/重命名/归档/只读/恢复/视图过滤 |
| `npm run e2e:p2 --prefix backend` | 通过：104 条断言 |
| `npm run e2e:p3 --prefix backend` | 通过：**67** 条断言（含孤儿设计） |
| `npm run e2e:p4 --prefix backend` | 通过：**83** 条断言（含用户气泡归一化）；浅/深 × 1440/1024/768；0 console/page error、0 意外 API≥400、0 横向溢出 |

### must-fix（2026-11-18 复核后，已修）

- **问题**：时间线把 `buildViewPrompt` 的“视图框架”当用户原文显示。
- **修复**：`backend/src/dev/timeline.ts` 新增导出纯函数 `displayUserText(text)`（仅 `当前视图：` 开头时取第一个 `\n用户消息：\n` 之后的内容；否则原样），`normalizeMessages` **只对 user 消息**使用，`system` 与 `scrubText` 不变；`buildViewPrompt` 未改。
- **测试**：`timeline.test.ts` +4（framed / 非 framed / system 含 marker 不裁剪 / 换行与特殊字符完整保留）→ 后端 77/77；stub harness 改为保存完整 prompt（与真实 opencode 一致），`e2e:p4` 增加用户气泡断言（=输入、无 `当前视图：`/`用户消息：`）→ 83 条断言。

### e2e:p4 覆盖

空态与首条提示（AGENTS.md/docs 路径）→ 开始开发 → 回复/工具卡/文件变化 → 慢速流式（文本逐步增长）→ 权限卡（允许后继续）→ 停止（状态「已停止」+ 时间线「已中止」）→ 重命名 → 归档 → 只读横幅 → 恢复 → compact → 90% 上下文 chip + 提示条 → 1440/1024/768 深浅色矩阵（抽屉互斥 + Esc）→ 0 错误审计。

### 偏差

1. `e2e:p4` 复用扩展后的 P2 stub harness（参数化 app id、通用用户消息提取、权限/表单去重、interrupt 幂等），端口 3425；未新建第二套后端。
2. `smoke:dev` 只做会话生命周期与状态读取，**不发送 prompt**，因此不会调用模型；结束时 stop 自己临时启动的 serve。
3. `e2e:p3` 由 63 → 67 条断言（新增孤儿设计只读 + warning 错误条场景）。
4. 开发视图健康度沿用既有 chip + 上下文提示条（未新增 85% 专属横幅）。
5. 孤儿设计选中时生成按钮禁用（无需求模块）；ER/原型仍可只读。
6. 设计错误条合并顺序为 designs warnings → errors/adapter warnings，条内展示前 3 条。
7. 未重构 `DevView` 时间线归一化；仅改文案/testid/样式清理与既有节流刷新。
8. **must-fix 后 stub harness 改为像真实 opencode 一样保存完整 prompt**（此前手工提取 `用户消息：` 掩盖了真实行为）；用户气泡断言改为验证后端归一化结果，未依赖旧行为。

### 未验证项

- 真实模型 E2E（主会话另跑）：开发会话先读 docs 再改仓库内小文件，验证工具卡/文件变化/汇报。
- 真实 opencode 事件形状下的开发对话流式/权限/表单。
- 真实 3300（旧构建，未重启）与 EOS 运行态。
- 非 headless 浏览器截图/交互。

### 环境确认

- 未启停/未重启真实 3300；未读写真实 `data/`/`projects/`/`.env`；全部使用临时目录与 3424/3425/3422/3423/3416/3419/4719/4724 端口。
- 未执行任何 git 操作；未调用真实模型（e2e 为 stub，smoke:dev 只做会话生命周期）。
