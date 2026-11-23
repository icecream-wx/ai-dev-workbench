# Agent-First 工作台 P5「收尾」实施交接单（2026-11-18）

> 上游：`docs/plans/2026-11-18-agent-first-workbench-design.md` v3。
> P1—P4 已完成并通过评审（后端 77/77、前端 48/48、`e2e:p2/p3/p4` 104/67/83、`smoke:*` 通过、真实模型需求/设计/开发链路已分别验证）。
> 本单做 **收尾**：汇报材料重写、一致性清理、真实实例切换清单、最终文档；**不改产品行为**。
> 真实 3300 保持旧构建、不重建不重启；全部临时目录 + 独立端口；不调真实模型。

---

## 0. 出口标准

1. `docs/report/` 全套按 **Agent-First 架构**重写并互相一致：
   - `ai-dev-workbench-overview.md`（完整说明）
   - `ai-dev-workbench-overview.html`（单文件离线：内联 CSS + 内联 SVG，无外链）
   - `ai-dev-workbench-overview.pdf`（A4，流程图完整不裁切，≤ 14 页）
   - `assets/flow-overview.svg`（可编辑矢量）、`assets/flow-overview.png`（PPT 用，≥ 2000px 宽）
   - 可选：`assets/` 下三视图截图（需求/设计/开发，来自临时实例示例数据）
2. 报告内容只描述当前架构：工作区文件为源、三视图、skills/commands、模板库分发、5 张表、SSE 变化、无门禁；不写版本/变更单/交接包/U7/M7-2 作为"现有能力"（可作为"已移除"一句）。
3. 一致性清理完成：
   - 未使用依赖移除（先确认确实零引用，如 `@antv/x6` 若 ErGraph 为自绘 SVG 则移除；`pinia`/`html2canvas`/`markdown-it` 若在用则保留）；
   - 未引用文件/导出清理（`grep` 核实后删）；
   - `package.json`：`install:all` 包含根依赖安装（`playwright`/`concurrently` 在根）；脚本与 README 一致；
   - `README.md` / `AGENTS.md` / `docs/STATUS.md` 最终校对（测试基线、命令、e2e/smoke 列表、目录）。
4. 新增 `docs/ops/switch-to-agent-first.md`：真实实例切换清单（备份 → 停 → 构建 → 启 → 验证 5 表/模板保留/`apps=0` → 新建应用跑一遍 → 回退方式 GitHub）。**只写步骤，不执行**。
5. 全量回归通过：后端 77+、前端 48+、`build`/`typecheck`/`check:vue`、`smoke:workspace`/`smoke:assets`/`smoke:dev`、`e2e:p2`/`p3`/`p4`。
6. 真实模型全链路 E2E 由主会话另跑（见 §4）；本单不调模型。

## 1. 不做

- 产品行为/接口/表结构变化；需求/设计/开发视图重写。
- 真实 3300 启停、真实 `data/`/`projects/`/`.env` 读写；任何 git 操作。
- 移动端 `<768`；MCP/插件/自定义 tool。

## 2. 报告要点（内容清单）

- 一页摘要：痛点 → 做法（工作台只做外部管理）→ 三个视图 → 适用/不适用 → 当前状态。
- 业务流程/数据流图：用户 → 三视图 → opencode agent → 工作区文件（requirements/design/code）→ 视图渲染；模板库 → 应用副本；`docs/` 变化 → SSE → 刷新。
- 工作区与文件契约：目录树、模块 frontmatter、`design.json` schema 摘要、`_manifest.json`。
- 扩展能力：2 skill（`adw-*`）+ 4 command + 应用级 `AGENTS.md` + `opencode.json` 权限；为什么不用版本/确认/交接包。
- 数据与接口：5 张表、主要 API（artifacts/events/chat/modules/templates/sessions）。
- 开发体验：会话模型（每视图活跃会话 + 历史）、时间线/工具/权限/表单、compact/健康度、文件变化。
- 演示脚本（3/10 分钟）与边界/未验证（真实 EOS 运行态、真实 401/403、PNG 非 headless 等）。
- 与旧版关系：一句话说明旧流程已移除，不展开。

## 3. 一致性与清理

- 依赖：`rg`/`grep` 确认零引用后再删；`package-lock` 同步；保留 `playwright`（e2e）。
- 文件：删除零引用导出/样式/旧 testid（P4 已清一批，复查）。
- 脚本：`smoke:workspace`/`assets`/`dev`、`e2e:p2/p3/p4` 均可用；README 写清首次需要 `npx playwright install chromium`。
- `install:all`：根 `npm install` + backend + frontend（避免新机器缺 `concurrently`/`playwright`）。
- 文档：`docs/plans/README.md` 只列 2026-11-18 五份 + 标注 P5 状态；`docs/report/README.md` 说明当前版本。

## 4. 验证

| 项 | 要求 |
| --- | --- |
| 报告 | HTML 离线打开无外链；1440/1024/768 无横向溢出、0 console/page error；PDF 页数与流程图完整；SVG/PNG 可打开 |
| 截图 | 如做：临时实例（确定性示例数据）三视图截图，浅/深至少各一 |
| 回归 | 后端 77+、前端 48+、build/typecheck/check:vue、三个 smoke、三套 e2e |
| 清理 | 删除后 `npm install`/`build`/测试仍通过；`npm run install:all` 路径说明正确 |
| 主会话另跑 | 真实模型全链路：新建应用 → 需求 → 设计 → 开发改文件；临时实例，不碰真实环境 |

## 5. 交付与风险

- 完成后回填 `docs/STATUS.md`、P5 brief「实施结果」、`docs/plans/README.md`。
- 风险：
  1. 报告与实现漂移 → 所有数字/接口以代码与 `docs/STATUS.md` 为准，写完逐条核对。
  2. 删依赖误伤（如 `@antv/x6` 仍被某组件 import）→ 必须先 grep + build/typecheck 验证。
  3. PDF 流程图被裁切 → 单独一页、按图尺寸缩放；导出后逐页检查。
  4. 截图含真实数据 → 只用临时实例的示例应用，不截真实 `projects/`。
  5. `install:all` 递归/前缀问题 → 根目录直接 `npm install`，不要用 `--prefix` 装根依赖。

---

## 实施结果（2026-11-18，P5）

### 报告产物（`docs/report/`）

| 文件 | 结果 |
| --- | --- |
| `ai-dev-workbench-overview.md` | 重写为 Agent-First 完全说明（摘要 / 数据流 / 文件契约 / 2 skill + 4 command / 5 表与接口 / 开发体验 / 演示脚本 / 边界 / 与旧版关系） |
| `ai-dev-workbench-overview.html` | **320.1 KB** 单文件离线：内联 CSS + 内联 SVG + 截图 base64；无外链请求、无 console error；1440/1024/768 无横向溢出 |
| `ai-dev-workbench-overview.pdf` | **674.0 KB，约 9 页**（≤14）；A4；流程图单独起页，打印版心 688×434px 不裁切 |
| `assets/flow-overview.svg` | 可编辑矢量（1280×760） |
| `assets/flow-overview.png` | **2560px 宽**（1280×760 @2x，432.3 KB） |
| `assets/view-requirements-light.png` / `view-design-light.png` / `view-development-light.png` / `view-design-dark.png` | 三视图示例截图（浅 / 深），来自临时 stub 应用 `report-app`，不含真实项目数据 |
| `docs/report/README.md` | 当前版本、文件清单、再生成命令与内容原则 |

生成脚本：`backend/scripts/build-report.ts`（`npm run build:report --prefix backend`）；复用根 `playwright` 与 frontend `markdown-it`，**未新增依赖**。

### 一致性清理（依据：grep 零引用 + build/typecheck/测试验证）

| 项 | 处理 | 依据 |
| --- | --- | --- |
| 前端依赖 `@antv/x6` | 移除（`frontend/package.json` + lock 同步） | ErGraph 为自绘 SVG，源码 0 引用 |
| `hashesChanged` | 移除（view-helpers + 测试断言） | 无引用 |
| `artifactErrorLine` | 保留并改为被 `mergeArtifactLines` 复用 | 消除“仅测试引用” |
| `ChatStage` / `isChatStage`、`deleteSessionsOfApp`、`syncAppRequirementTemplate`、`clearDevModelLimitCache`、`activeSessionRowOf`、`watcherMode`、`removeKey` | 移除 | 零引用/死代码 |
| `DEFAULT_DEV_PROMPT`、`dateTimeLabel`、`contextLimitOf`、`contextWithLimit`、`normalize*`、`seed*`、`ensureColumn`、`readRequirementModules`、`moduleTemplateRefs`、`agentSkillDir/agentManifestPath`、`inferControl`、`isExternalRef`、`VIEW_COMMANDS`、`DevApiError`、`RELATION_TYPES` 等 | 去掉不必要的 `export`（保留同模块使用） | 零外部引用 |
| 根 `install:all` | `npm install && cd backend && npm install && cd ../frontend && npm install` | 新机器需要根 `concurrently`/`playwright` |
| README / AGENTS / STATUS / plans README / report README | 校对当前状态、命令、目录、报告与切换入口 | 与代码一致 |

### 切换清单

新增 `docs/ops/switch-to-agent-first.md`：前提检查 → 备份（data/projects/.env/当前提交）→ 停止旧实例 → `install:all` + `build` → 启动 → 验证 5 表 / 模板保留 / `apps=0` / fail-closed 说明 → 新建应用人工验收 → 观察项 → 回退（备份 + git 历史）→ 常见问题。**只写步骤，未执行任何切换命令。**

### 验证命令与结果（最终实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时目录） | **77 / 77** |
| `npm test --prefix frontend` | **49 / 49**（P5 +1：order 重复交换） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（3416） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode / 4719，不调模型） |
| `npm run smoke:dev --prefix backend` | 通过（真实 opencode / 4724，不调模型） |
| `npm run e2e:p2 --prefix backend` | 通过：104 条断言 |
| `npm run e2e:p3 --prefix backend` | 通过：67 条断言 |
| `npm run e2e:p4 --prefix backend` | 通过：83 条断言 |
| `npm run build:report --prefix backend` | 通过：HTML 320.1 KB / PDF 9 页 / PNG 2560px；离线与三档宽度检查通过 |

### 偏差

1. 截图来自临时 stub 示例应用（非真实模型/项目）；开发视图用空态截图，避免显示 stub 模型名。
2. PDF 页数为脚本按 `/Type /Page` 近似统计（9 页），未逐页人工点检；流程图已用打印媒体断言单页（688×434px）。
3. 清理范围限定“零引用”的依赖/函数/导出；`er-layout`/`timeline` 等模块内部常量仍保留导出（同模块使用，便于阅读/调试）。
4. `npm run install:all` 会安装根 `playwright`（体积较大）；运行工作台不需要浏览器，只有 e2e 需要 `npx playwright install chromium`。
5. 真实 3300 未切换；切换清单只写步骤。

### 未验证项

- 真实模型全链路 E2E（主会话另跑）。
- 真实 3300 切换后的运行态、EOS 应用构建/运行态。
- 非 headless 浏览器打开 HTML/PDF 的视觉差异。

### 环境确认

- 未启停/未重启真实 3300；未读写真实 `data/`/`projects/`/`.env`；全部使用临时目录与 3416/3419/4724/4719/3422/3423/3425/3426 端口。
- 未执行任何 git 操作；未调用真实模型。
