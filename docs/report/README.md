# 汇报材料（Agent-First，2026-11-20）

当前版本对应 **P12 + 第一阶段功能收尾（2026-11-20）**：P1—P6-4 已评审；P7-1～P7-6c + P7-4b + P8-1 + P8-2 + P9 + P10 + P10b + P11 + P12 已实施（待评审）；用户已跑通主流程，进入**细化/优化/打磨**；P7-7 未做。
真实 3300/4771 当前**有监听**（PID **40704** `node`（工作台后端）/ **41744** `opencode serve`，启动 **2026-11-20 16:15:08**；非本会话启停）。`backend/dist` **16:14:38**、`frontend/dist` **16:15:07** 均为本次 restart 构建并由 Express 静态托管**即时生效**——设计视图「原型」只展示设计产物、不再有可点线框（无契约自动结构草图），PNG 为模板风格，刷新即可用。库为 4 表新结构，`apps>0` 正常，**当前无 fail-closed**（仅旧 5 表结构 + `apps>0` 触发）。`start` 每次构建前后端，`restart.cmd` / `restart.sh` = stop → build → start → 健康检查；重启/切换由用户按 `docs/ops/switch-to-agent-first.md` 执行。

## 文件

| 文件 | 用途 | 说明 |
| --- | --- | --- |
| `ai-dev-workbench-overview.md` | 完整说明（源文件） | P7 + P8 + P9 + P10 + P10b + P11 + P12 能力/契约/接口/开发流程/基线/证据/边界；含启动构建与一键 restart |
| `ai-dev-workbench-overview.html` | 单文件离线 HTML | 723.5 KB（740,866B）；内联 CSS + 内联 SVG + 截图 base64，无外链；1440/1024/768 无横向溢出 |
| `ai-dev-workbench-overview.pdf` | A4 PDF | 1,141.6 KB（1,168,964B）；约 15 页（守卫 ≤15）；流程图单独起页、不裁切（打印版心 688×499px） |
| `assets/flow-overview.svg` | 可编辑矢量 | 1280×880；P7 链路（模板 pack → 模板中心/preview → design-system/契约 → 开发提示/ui-check → MF remote/fidelity） |
| `assets/flow-overview.png` | PPT 用位图 | 2560×1760（1280×880 @2x），554.4 KB（567,720B） |
| `assets/view-requirements-light.png` | 需求视图截图 | 模块大纲/文档/设计摘要/对话 |
| `assets/view-design-light.png` | 设计视图截图 | 徽标「企业级应用管理平台 · 平台蓝白」/「模板页面库」、ER、brief/tokens/导出状态 |
| `assets/view-design-dark.png` | 设计视图深色截图 | 同一示例的深色主题 |
| `assets/view-design-template-center.png`（新） | 设计模板中心截图 | 4 应用类型切换、企业级详情、风格与页面集、组织与用户 iframe 预览 |
| `assets/view-development-light.png` | 开发视图截图 | 模块下拉、设计参考（ui-check 已填/蓝图根） |
| `assets/view-dev-fidelity.png`（新） | 开发视图一致性报告 | 设计参考完整可见 + 示例 stub：5 通过 / 7 警告 / 0 失败（非真实模型验收） |

> 截图来自**临时 stub 实例**（`report-app`，临时目录 + 端口 3433，stub opencode，不调模型）的示例数据，不含真实项目数据；报告/截图不代表真实 AFCenter 宿主、EOS 或真实模型验收结果。P7-4b/P8-1/P8-2/P9/P10/P11 未重截报告截图/流程图，沿用 P7-A 版本；树/弹窗视觉证据见 `workbench-p7-4b-shots`，P9 设计产物模板原生渲染证据见 `workbench-p9-shots`，P10 detail/dashboard 与模板风格 PNG 证据见 `workbench-p10-shots`（`p10-dashboard.png`/`p10-detail.png`/`p10-overview.png`/`p10-product-detail.png`，临时目录）；P11 为 UI 变更（无线框切换），由 `e2e:p7-4b/p9/p10` 断言覆盖。

## P7/P8/P9/P10/P11/P12 内容

- 设计模板 = 应用类型 × 视觉风格 + 页面库：内置 pack 4 类型 × 4 风格 × 25 页；`preview.html?type=&style=&page=` 预览；设计模板中心/新建应用 picker/设计视图徽标与「模板页面库」；需求模板中心（「模板库」）不变。
- P8-1：旧版设计模板彻底删除（DB 5 表→4 表、无 `/api/prototype-templates`、无 legacy）；设计视图皮肤由所选风格 tokens 构造，`tokens.json`/manifest 用 `styleId`。
- P8-2（已被 P9 取代）：设计视图「原型」Tab 曾用 `catalogRef` 认领模板页面 iframe（`preview.html?...&embed=1`）；该模式与 `e2e:p8-2` 已删除。
- P9：设计视图「原型」默认用**所选设计模板原生渲染 `design.json` 该页**（`design-preview.html?app=&module=&page=&type=&style=&embed=1`）——模板结构类 + pm 组件 + `structure.css`/风格 CSS，契约驱动列/查询/操作/选择/分页/树/表单分组，确定性 mock；覆盖 list/tree-list/page-form/dialog-form。
- P10：模板渲染扩展到 **detail/dashboard**（dashboard = 指标卡 + `pm-echarts` + 最近记录；detail = 主信息 + 字段 + 状态 + 时间线 + 子表）；**PNG 改为模板风格真实截图**（`capture=1` + iframe 内 html2canvas 自截，自动/手动整包导出，无契约旧设计/失败回退线框；`e2e:p10` 54 条，含宽高 + data-cyan 主色像素采样）。
- P10b：**所有有显式契约（recipe/catalogRef/blueprint）的页面都模板风格**——**main-sub**（表单分组 + 子表页签 `pm-table`）、**wizard**（`pm-steps` + 当前分组 + 上一步/下一步/提交），未知配方按 `page.type` 映射到通用模板页；**无显式契约的旧设计用结构草图兜底**；PNG/开发 prompt/应用 AGENTS/skill 文案统一为“模板风格截图（无显式契约旧设计为线框）”；`e2e:p10` 扩展为 **78 条**（内含 main-sub/wizard/未知页、manifest 6 页、模板截图主色采样）。
- P11：**设计视图移除「模板风格/线框」切换，只保留设计产物**——有显式契约只显示 `design-preview` iframe；无契约自动显示「结构草图（无契约）」+ 补齐契约提示；头部只读状态 `prototype-render-mode`；调试入口仅 `?prototype=wireframe`；PNG 仍整包模板风格（无契约/失败线框）。`e2e:p7-4b` 用调试参数进入（48），`e2e:p9` 70、`e2e:p10` 79。
- P12：**启动脚本构建可见化 + 一键 restart**——`start.cmd`/`start.sh` 每次构建前后端（后端 tsc、前端 vite 两步，失败指明哪端）；新增 `restart.cmd`/`restart.sh` = stop → 构建 → start → 健康检查；已在运行时提示改用 `restart`。
- `design.json` 页面契约（designSystem + recipe/catalogRef/blueprint/filters/actions/form/tree/subTables/components），全部可选、旧设计兼容、问题只 warning。
- 设计视图线框渲染器消费契约（P7-4b）：树列表（左树右表/选中样式/树头脚动作）、弹窗表单（宽度/单列/分组）、分页三形态、多选批量条、行/工具栏动作、`pm-*` 控件映射、子表页签；旧 design.json 视觉不变。
- 设计 → 开发关联：新应用 MF remote（webpack + Module Federation + PageTemplates + GlobalPreference）；`design-system.json` + `template/` 蓝图/styles；团队 skill 与设计模板 skill。
- 开发 prompt/AGENTS/`adw-frontend-implementation`/design digest/模块上下文/ui-check 软门禁/开发视图设计参考。
- 一致性检查：共享 `fidelity-core.cjs` 12 项 + CLI + command + `POST /api/apps/:id/design-fidelity` + 开发视图只读报告；只报告、不阻断、无像素比对。

P6 内容（聊天占位/reasoning/中文、模板即 skill、设计参考包）仍然有效，摘要见报告正文。

## 重新生成

```bash
npm run build:report --prefix backend
```

依赖：根 `playwright`（已在 devDependencies）与 `frontend/node_modules/markdown-it`；不新增依赖。
脚本会：md → 单文件 HTML（内联 CSS/SVG/截图）→ A4 PDF；SVG → 2560px 宽 PNG；并检查 HTML 离线无外链、无 console error、三档宽度无横向溢出、打印版心流程图不跨页、PDF 页数不超 15 页（P9 新增一节后由 14 调整为 15）。

## 内容原则

- 只描述当前架构：工作区文件为源、三视图、3 个方法 skill + 2 个团队 skill + 需求/设计模板 skill、**5 个 command**、需求模板库分发、**4 张表**、SSE 变化、ui-check 软门禁、fidelity 只读报告、线框渲染器（P7-4b，仅无契约/调试）与模板风格原生渲染（P9/P10/P10b）消费页面契约；设计视图只展示设计产物（P11 起无「模板风格/线框」切换）；无门禁。
- 启动口径（P12）：`start` **每次启动都构建前后端**（tsc/vite 两步）；`restart` 一键 stop → build → start → 健康检查；前端 `dist` 静态托管刷新即生效，但源码改动与后端改动都应 `restart`。
- 旧流程（版本/确认/变更单/交接包/U7/M7-2）只以“已移除”出现，不作为现有能力；旧版设计模板（原型模板表/CRUD/legacy）同属已移除。
- 数字以 `docs/STATUS.md` 与代码为准（当前后端 **133**、前端 **142**、`e2e:p10/p9/preview/p7-3b/p7-4b/p7-6a` 79/70/83/38/48/15、`e2e:p2/p3/p4` 116/126/128）。
- “已实施（待评审）”不写成“已评审/已完成”；生成物 install/build、真实宿主 pm-*、EOS、401/403、<768、PNG 像素级模板比对均列为未验证。
