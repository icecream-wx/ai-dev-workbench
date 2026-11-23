# P6-4 实施交接单：收尾（报告/回归/文档，2026-11-19）

> 上游：`2026-11-18-agent-first-workbench-p6-design.md`；P6-1/P6-2/P6-3 已完成并通过评审。
> 本轮只做 **P6-4 收尾**：汇报材料补 P6、全量回归、文档最终校对。**不改产品行为/接口/表/工作区契约**。
> 真实 3300 不启停；真实 `data/`/`projects/`/`.env` 不读写；不做 git；不调真实模型。

---

## 0. 出口标准

1. `docs/report/` 更新到 P6 现状：
   - md 增加：聊天占位/reasoning、中文指令、模板即 skill（`adw-template-*`）、设计参考包（brief/tokens/prototypes + 自动导出 + 过期）、开发参考与一致性检查。
   - HTML（单文件离线）/PDF 重新生成；流程图更新（模板库 → 模板 skill；设计 → PNG/tokens/brief → 开发）。
   - 截图更新：设计视图（brief/tokens/原型导出状态）、开发视图（时间线/工具）可选；使用临时示例数据，不截真实 `projects/`。
   - 数字基线更新：后端 88、前端 59、`e2e:p2/p3/p4` 116/126/97、`smoke:*`。
2. `docs/STATUS.md` 最终版：P6-1..P6-4 全部完成并通过评审；保留"真实实例切换待用户执行"。
3. `README.md` / `AGENTS.md` / `docs/plans/README.md` / `docs/ops/switch-to-agent-first.md` 校对：
   - 工作区新增 `adw-template-*`、`design-brief.md`、`tokens.json`、`prototypes/`；
   - 5 张表不变；启动/切换步骤不变；
   - 测试/命令/report 入口准确。
4. 全量回归通过：后端 88+、前端 59+、build/typecheck/check:vue、三个 smoke、e2e 116/126/97、`build:report`。
5. HTML 离线（0 外部请求/0 console error/1440·1024·768 无横向溢出）；PDF 页数合理、流程图不裁切。

## 1. 不做

- 产品代码/接口/表/工作区行为变更（除报告生成脚本内容）。
- 真实 3300 切换、EOS 运行态、真实 401/403、移动端 `<768`。
- 真实模型调用。

## 2. 报告更新要点

- **架构图**：工作区（docs/requirements、docs/design + brief/tokens/prototypes）、三个视图、opencode agent、模板库 → 模板 skill（方法 skill + `adw-template-*`）。
- **聊天体验**：占位（思考中/失败/中断）、reasoning 折叠、中文指令；说明"指令层不保证 reasoning 语言"。
- **模板即 skill**：一个模板一个 skill、方法 skill 按 id 加载、全局保存同步、`GET /api/skill` 校验。
- **设计参考包**：结构以 design.json 为准；风格参考 brief/tokens/PNG；manifest designHash 过期提示；开发 prompt/AGENTS 必读。
- **演示脚本**：加入"查看模板 skill / 设计参考包 / 打开设计视图自动导出 / 开发读取设计后实现"。
- **边界**：EOS 后端不吃 tokens；PNG 依赖设计视图打开时自动导出；reasoning 语言不保证。

## 3. 文档校对清单

- `STATUS.md`：顶部状态、P6-4 结果、基线、待用户执行项（真实实例切换）。
- `README.md`：目录（`adw-template-*`、`design-brief/tokens/prototypes`）、命令、报告入口、切换清单入口。
- `AGENTS.md`：当前方向 + 工作区布局 + "先读 P6 设计稿/交接单"；不写历史流水账。
- `docs/plans/README.md`：P6 设计稿 + P6-1/2、P6-3、P6-4 交接单状态。
- `docs/ops/switch-to-agent-first.md`：补"应用工作区新增模板 skill 与设计参考包；旧应用不兼容（当前 apps=0）"。
- `docs/report/README.md`：当前版本、再生成命令、P6 内容。

## 4. 测试与验收

| 项 | 要求 |
| --- | --- |
| 回归 | 后端 88+、前端 59+、build/typecheck/check:vue、`smoke:workspace/assets/dev`、`e2e:p2/p3/p4` |
| 报告 | `npm run build:report --prefix backend`：HTML 离线/三档无溢出/0 console error；PDF 页数与流程图完整；SVG/PNG 可打开 |
| 截图 | 如更新，使用临时 stub/示例应用（不截真实数据）；浅/深至少一张 |
| 文档 | 所有链接/命令/数字与实际一致；`grep` 无旧交接包/阶段作为"现有能力"的表述 |

## 5. 收尾

- 更新 `docs/STATUS.md` 与 P6-4 brief「实施结果」；在 `docs/plans/README.md` 标记 P6-4 完成。
- 回报：报告产物与大小/页数、改动文件、回归数字、偏差、未验证项、环境确认（未触碰真实环境/未 git/未调模型）。

---

## 6. 实施结果（2026-11-19）

### 6.1 报告产物

| 文件 | 结果 |
| --- | --- |
| `docs/report/ai-dev-workbench-overview.md` | 更新到 P6：聊天占位/reasoning/中文、模板即 skill、设计参考包（brief/tokens/prototypes + 自动导出/过期）、开发参考与一致性检查；基线 88/59/116/126/97 |
| `docs/report/ai-dev-workbench-overview.html` | 325,196B；单文件离线（1 个本地请求、0 console error）；1440/1024/768 无横向溢出 |
| `docs/report/ai-dev-workbench-overview.pdf` | 750,667B；11 页；流程图单独起页，打印版心 688×434px |
| `docs/report/assets/flow-overview.svg` | 更新架构图：方法 skill + `adw-template-*`、设计参考包/PNG 写入、模板库 → 模板 skill |
| `docs/report/assets/flow-overview.png` | 453,918B；2560px 宽（1280×760 @2x） |
| `docs/report/assets/view-requirements-light.png` | 临时 stub `report-app` 重新生成 |
| `docs/report/assets/view-design-light.png` | 临时 stub `report-app` 重新生成；含 brief/tokens/原型导出状态/导出时间 |
| `docs/report/assets/view-design-dark.png` | 临时 stub `report-app` 重新生成（深色） |
| `docs/report/assets/view-development-light.png` | 沿用既有空态示例截图（避免展示 stub 模型名） |

### 6.2 文档校对

- `README.md`：状态更新到 P1—P6-4、P6 设计/交接单入口、目录、后端 88/前端 59 基线。
- `AGENTS.md`：P6-4 完成、先读 P6 设计稿/P6-4 交接单、设计参考包与模板 skill 约定、P1—P6 交接单。
- `docs/plans/README.md`：P6-4 标记完成。
- `docs/ops/switch-to-agent-first.md`：切换到 2026-11-19 版本；验收基线 88/59/116/126/97；工作区新增模板 skill/设计参考包；旧应用不兼容（apps=0）；新建应用验收步骤补充自动导出与开发读取参考包。
- `docs/report/README.md`：P6 内容、11 页、基线 88/59/116/126/97。

### 6.3 回归（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **88 / 88** |
| `npm test --prefix frontend` | **59 / 59** |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace` | 通过 |
| `npm run smoke:assets` | 通过（真实 opencode 2.2.5 / 4719，不调模型） |
| `npm run smoke:dev` | 通过（真实 opencode 2.2.5 / 4724，不调模型） |
| `npm run e2e:p2` | **116** |
| `npm run e2e:p3` | **126** |
| `npm run e2e:p4` | **97** |
| `npm run build:report` | 通过：HTML 325,196B / PDF 750,667B / 11 页 / PNG 453,918B |

### 6.4 偏差 / 未验证

- 偏差：只改报告/文档/截图，未改产品代码；开发视图沿用既有示例截图；PDF 页数为脚本 `/Type /Page` 近似统计。
- 未验证：真实 3300 切换后的运行态、EOS 构建/运行态、真实 401/403、非 headless 截图/PNG 导出。
- 环境：未启停真实 3300；未读写真实 `data/`/`projects/`/`.env`；未执行 git；未调用真实模型；截图仅用临时 stub `report-app`。
