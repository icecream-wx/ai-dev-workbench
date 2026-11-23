# UI-2a：统一空态/加载/错误 + 骨架（实施交接单）

> 日期：2026-11-23。方向沿用 UI-1a 已确认的 **A+B 混合、中等密度、轻量图标式空态**。本批只做 UI-2a（共享状态组件 + 四类表面替换 + 截图证据），不做 UI-3（表格/表单/聊天消息内部结构）、UI-4（模板中心/工作室内部）。

## 1. 范围与硬约束

**做**

- 新增 `frontend/src/shared/StatePanel.vue`（empty / error / loading）。
- 需求视图、设计视图、开发视图、首页统一空态/加载/错误与骨架。
- 新增 `backend/scripts/ui2a-shots.ts` 截图证据（stub、独立端口、临时目录）。
- 更新 `docs/STATUS.md`、`docs/plans/README.md`、`README.md` 与本文档。

**不做**

- 不改后端/DB/API/依赖/`templates/**`。
- 不改业务逻辑/数据流；保留所有 testid、按钮功能、URL/导航、会话/权限/表单/停止/compact 行为。
- 不改表格/表单/聊天消息 DOM 结构（UI-3）、Studio/模板中心内部（UI-4）、`design-preview`/`template-preview` 渲染。
- 不启停真实 3300/4771；不调真实模型；不读写真实 `data/`、`projects/`、`.env`；不做任何 git 操作。

## 2. StatePanel API

文件：`frontend/src/shared/StatePanel.vue`（单文件，无新增依赖）。

| 项 | 说明 |
| --- | --- |
| `variant` | `'empty' \| 'error' \| 'loading'`，默认 `empty` |
| `title` | 标题；empty/error 为 `<h3>`，loading 为加载文案 |
| `description` | 可读说明（结论/下一步） |
| `icon` | Element Plus 图标组件；缺省 empty=`Box`、error=`WarningFilled` |
| `testId` | 根 `data-testid`；缺省 `state-<variant>`（根另有 `data-state="<variant>"`） |
| `compact` | 紧凑尺寸（侧栏/小面板） |
| `loadingLines` | 骨架行数；缺省 list/timeline=3、doc=4 |
| `skeleton` | `'list' \| 'doc' \| 'canvas' \| 'timeline'`，默认 `list` |
| 插槽 | `default`（富文本说明，优先于 `description`）、`examples`、`actions`、`details` |

行为：

- empty：轻量图标 + 标题 + 说明 + 操作/示例；虚线边框、低对比底，不使用插画大图。
- error：标题 + 用户可读原因 + 重试 action；原始错误/技术细节只放在 `<details>`（默认折叠）；`role="alert"`。
- loading：`role="status"`、`aria-live="polite"`、`aria-busy="true"`；shimmer 动画在 `prefers-reduced-motion: reduce` 下关闭。
- 视觉只复用 UI-1 token（`--rg-space-*`、`--rg-radius*`、`--rg-surface*`、语义色），不新增全局 token。

## 3. 应用位置

| 表面 | 改动 | testid |
| --- | --- | --- |
| 需求视图文档区 | loading=doc 骨架；error=StatePanel + 重试 + 技术详情；empty=StatePanel（原 3 个示例 + 新建模块） | `requirements-loading`、`requirements-error`、`requirements-empty`（保留）、`empty-create-btn`（保留）、`example-prompt-*`（保留） |
| 需求大纲 | `RequirementsOutline` 新增 `loading` prop；无模块时 3 行列表骨架 | `module-outline-loading`；原 `module-item-*` 等不变 |
| 设计视图模块列表 | loading 3 行列表骨架；无模块提示不变 | `design-module-loading`；原 `design-module-*` 不变 |
| 设计视图主区 | loading=画布 + 实体列表双骨架；error=StatePanel + 重试；无模块/无设计=空态（原 CTA/示例） | `design-loading`、`design-loading-canvas`、`design-loading-fields`、`design-error`、`design-no-modules`（保留）、`design-empty`（保留）、`design-empty-generate`（保留）、`design-example-*`（保留） |
| 设计 ER/原型空态 | `DesignErPanel` / `DesignPrototypePanel` 内部改用 StatePanel（不改渲染器） | `er-empty`（保留）、`prototype-empty`（保留）；`design-no-prototype-template`（保留） |
| 开发会话列表 | loading 3 行列表骨架；空态统一 | `session-list-loading`、`session-list-empty` |
| 开发时间线 | loading=3 卡时间线骨架；error=StatePanel + 重试；无进行中会话=空态；会话已创建空态=StatePanel | `dev-loading`、`dev-error`、`dev-session-choice`、`dev-empty-timeline` |
| 开发开始卡 | 改为「任务清单 / 下一步」三步版式；保留 textarea、testid、首条提示与发送逻辑 | `dev-start-card`、`dev-start-prompt`、`dev-start-btn`（保留）、新增 `dev-start-checklist` |
| 开发 fidelity 空态 | 改用 StatePanel | `dev-fidelity-empty`（保留） |
| 首页应用列表 | loading/error/empty 统一 StatePanel；空态 3 步引导与 CTA 保留 | `home-loading`、`home-error`、`home-empty`（保留，`.steps li` 仍 3 条） |

错误文案统一为「用户可读结论 + 下一步」；路径/技术详情进入 `details` 或 tooltip。

## 4. 截图证据

脚本：`backend/scripts/ui2a-shots.ts`。前置 `npm run build --prefix frontend`；运行（backend 目录）：

```bash
npx tsx scripts/ui2a-shots.ts
```

- 复用 `p2-e2e-harness.ts`：真实后端 + 临时 SQLite/projects + `OPENCODE_AUTO_START=false` + stub opencode；端口 **3434**（opencode 4434），不占用真实 3300/4771。
- 通过 Playwright route 延迟 `/api/apps/:id/artifacts`、`/api/apps`、开发 state 请求制造 loading；用 500 响应制造 error。
- 每屏校验 `documentElement.scrollWidth` / `body.scrollWidth` 不超过视口宽度。
- 输出：`docs/plans/evidence/2026-11-23-ui2a/`（可用 `UI2A_SHOTS_DIR` 覆盖）。

| 截图 | 状态 |
| --- | --- |
| `ui2a-home-empty.png` | 首页 · 应用列表空态（3 步引导） |
| `ui2a-home-loading.png` | 首页 · 应用列表加载骨架 |
| `ui2a-home-error.png` | 首页 · 应用列表错误 + 重试 |
| `ui2a-requirements-empty.png` | 需求 · 无模块空态 |
| `ui2a-requirements-loading.png` | 需求 · 大纲 + 文档骨架 |
| `ui2a-requirements-error.png` | 需求 · 文档错误 + 重试 |
| `ui2a-design-empty.png` | 设计 · 模块未生成设计空态 |
| `ui2a-design-loading.png` | 设计 · 模块 + 画布 + 实体骨架 |
| `ui2a-dev-start.png` | 开发 · 任务清单/下一步空态 |
| `ui2a-dev-loading.png` | 开发 · 会话列表 + 时间线骨架 |

## 5. 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **183 / 183** |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 成功（exit 0） |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |
| `npm run e2e:p2 --prefix backend` | **116** 条断言，通过 |
| `npm run e2e:p3 --prefix backend` | **126** 条断言，通过 |
| `npm run e2e:p4 --prefix backend` | **130** 条断言，通过 |
| `npm run e2e:p7-3b --prefix backend` | **77** 条断言，通过 |
| `npm run e2e:p7-7c --prefix backend` | **116** 条断言，通过 |
| `npx tsx scripts/ui2a-shots.ts`（backend） | **10 张截图 + 10 次无溢出校验**，通过 |

结束核对：测试相关端口（3422/3423/3425/3430/3434 及 4422/4423/4425/4430/4434）无残留监听；真实 3300/4771 未启停。

## 6. 偏差与未验证

- **raw error**：不再作为唯一正文；主文案为「结论 + 下一步」，原始信息只进 `<details>`（默认折叠）。
- **empty 顺序**：需求/设计空态统一为「说明 → 示例 → CTA」（原需求为 CTA → 示例）；内容、testid、按钮行为不变。
- **设计 loading**：采用「画布骨架 + 实体列表骨架」两个 StatePanel 在同一栅格（≤1024 单列），不是单个混合骨架。
- **开发开始卡**：正文改成三步任务清单，保留 `AGENTS.md` / `docs/requirements/` / `docs/design/` 文案与原首条提示逻辑。
- **未验证**：真实 3300/4771 重启后的视觉效果需用户 `restart.cmd` / `restart.sh` 后复核；未做像素级视觉回归；未跑 `e2e:p7-7b`/`p9`/`p10`（未改 Studio/模板中心/设计预览渲染）；未改 `backend/src`，未跑后端单测。
