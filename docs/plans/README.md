# 设计文档索引

## 当前有效（2026-11-18 起；**第一阶段收尾 2026-11-20，进入细化/优化/打磨**；P6 完成，P7 实施中：P7-1～P7-6c + P7-4b + P8-1 + P8-2 + P9 + P10 + P10b + P11 + P12 已实施待评审；**P7-7 设计稿与 spike 证据已出（2026-11-21）；P7-7a、P7-7b-1（后端工作室）、P7-7b-2a（StudioView/template-preview/测试守卫）、P7-7b-2b（模板中心自定义入口/`e2e:p7-7b`/清理）、P7-7c-1（应用闭环 + `e2e:p7-7c`）、P7-7c-2（真实模型闭环，证据 `evidence/2026-11-21-p7-7-real-model/`）已实施（待评审）**；**2026-11-23：用户确认真实 3300 人工验收全部通过（P7-7 评审仍待定；验收明细待补）**）；打磨批 5（开发视图真实模型复跑，证据 `evidence/2026-11-23-dev-view-real-model/`）已实施（待评审）；UI-1a/UI-1b/UI-2a/UI-2b/UI-3a（按钮/图标/chip 原语）/UI-3b（卡片/面板 + dialog + tabs）已实施（待评审，2026-11-23）；**2026-11-23（晚）去模块 + 三份设计产物 + 接口设计的 D0 设计稿已出（待评审）；D1（单需求文档 + entities/pages + 去模块底座）、D2（`api-design.md` 固定模板/校验 + 设计视图接口 Tab + 开发引用 + fidelity 14 项）、D3（残留命名清理 + 历史 UI 截图脚本更新 + 全量回归 + 文档/汇报）、O1—O3（左对话布局 + 可拖拽分隔条 + 接口同轮生成 + 回归）、O4（设计中栏移除 + 页面集/页面 Tabs + 页面集总览 PNG 下载）已实施（待评审）**，见下表。

| 文档 | 用途 |
| --- | --- |
| `2026-11-18-agent-first-workbench-design.md` | **唯一有效设计**：Agent-First 工作台（文件为源 + 三个视图 + skill/command） |
| `2026-11-18-agent-first-workbench-p1-brief.md` | P1 底座 + 全量清理（已完成并评审） |
| `2026-11-18-agent-first-workbench-p2-brief.md` | P2 需求视图（已完成并评审） |
| `2026-11-18-agent-first-workbench-p3-brief.md` | P3 设计视图（已完成并评审） |
| `2026-11-18-agent-first-workbench-p4-brief.md` | P4 开发视图收口（已完成并评审） |
| `2026-11-18-agent-first-workbench-p5-brief.md` | P5 收尾（报告重写/一致性清理/切换清单；已完成并评审） |
| `2026-11-18-agent-first-workbench-p6-design.md` | P6 设计稿（聊天思考/中文、模板即 skill、设计参考包） |
| `2026-11-19-p6-1-2-implementation-brief.md` | P6-1 聊天/中文 + P6-2 模板即 skill（已完成并评审） |
| `2026-11-19-p6-3-design-reference-brief.md` | P6-3 设计参考包（已完成并评审） |
| `2026-11-19-p6-4-final-brief.md` | P6-4 收尾（报告/回归/文档；已完成并评审） |
| `2026-11-19-design-template-and-dev-linkage-p7-design.md` | **P7 设计稿（实施中）**：设计模板中心（应用类型 × 视觉风格 + 页面库/蓝图）+ 设计→开发强关联；需求模板中心保持不动；P7-1/P7-2/P7-3a/P7-3b/P7-4a/P7-4b/P7-5a/P7-5b/P7-6a/P7-6c 已实施（待评审）、P7-6b 复跑通过（见第 14—25 节）；P8-1 见第 26 节、P8-2 见第 27 节、P9 见第 28 节、P10 见第 29 节、P10b 见第 30 节、P11 见第 31 节 |
| `2026-11-19-p7-1-pack-and-design-system-brief.md` | P7-1 实施单：内置设计模板包 + pack loader + 只读 API + 应用级设计系统解析（已实施，待评审） |
| `2026-11-19-p7-3-preview-and-template-center-brief.md` | P7-3a 全量预览宿主（25 页 × 4 风格；已实施，待评审） |
| `2026-11-19-p7-3b-template-center-brief.md` | P7-3b 设计模板中心 UI + 新建应用/设计视图集成（已实施，待评审） |
| `2026-11-19-p7-4a-design-contract-brief.md` | P7-4a design.json 页面契约：schema/adapter/design skill（已实施，待评审） |
| `2026-11-20-p7-4b-renderer-tree-dialog-brief.md` | P7-4b 线框渲染器消费页面契约：树/弹窗/分页/操作/控件/子表（已实施，待评审；见 P7 设计稿第 25 节） |
| `2026-11-19-p7-5a-mf-scaffold-brief.md` | P7-5a 独立 MF remote 脚手架 + 设计系统/蓝图/团队 skill 分发（已实施，待评审） |
| `2026-11-19-p7-5b-dev-linkage-brief.md` | P7-5b 开发提示/方法 skill/digest/模块上下文/ui-check 软门禁（已实施，待评审） |
| `2026-11-19-p7-6a-fidelity-check-brief.md` | P7-6a 设计一致性检查：脚本/command/API/开发视图（已实施，待评审；见 P7 设计稿第 21 节） |
| `2026-11-19-p7-6b-real-model-brief.md` | P7-6b 真实模型闭环：设计→开发→一致性检查（首跑部分通过；2026-11-20 复跑通过；证据 `evidence/2026-11-19-p7-6b/`、`evidence/2026-11-20-p7-6b-rerun/`） |
| `2026-11-19-p7-6c-lifecycle-and-contract-fix-brief.md` | P7-6c SSE 生命周期 + 契约枚举/风格路径小修（已实施，待评审；记录见 P7 设计稿 23 节） |
| `2026-11-20-p7-report-and-docs-consistency-brief.md` | P7-A 汇报材料 + 文档口径收口（2026-11-20；只改文档/报告/截图；已实施，待评审） |
| `2026-11-20-p8-1-remove-legacy-design-template-brief.md` | P8-1 彻底移除旧版设计模板（DB 5 表→4 表、原型皮肤改由设计系统风格；已实施，待评审；记录见 P7 设计稿第 26 节） |
| `2026-11-20-p8-2-real-template-preview-brief.md` | P8-2 设计视图原型真实模板预览（`catalogRef` → `preview.html?embed=1` iframe + 线框双视图；已实施，待评审；**已被 P9 取代**；记录见 P7 设计稿第 27 节） |
| `2026-11-20-p9-contract-template-render-brief.md` | P9 设计产物模板原生真实渲染（Y2 一期）：`design-preview.html` 用所选模板结构/组件渲染 design.json 的 list/tree-list/page-form/dialog-form；已实施，待评审；记录见 P7 设计稿第 28 节 |
| `2026-11-20-p10-detail-dashboard-and-real-png-brief.md` | P10 detail/dashboard 配方模板化 + 设计参考包 PNG 改为模板风格真实截图（iframe 内 html2canvas 自截；旧设计线框兜底）；已实施，待评审；记录见 P7 设计稿第 29 节 |
| `2026-11-20-p10b-all-contract-template-fallback-brief.md` | P10b 所有显式契约（recipe/catalogRef/blueprint）页面模板风格兜底（main-sub/wizard/未知配方）+ PNG/开发 prompt/AGENTS/skill 文案同步；已实施，待评审；记录见 P7 设计稿第 30 节 |
| `2026-11-20-p11-remove-wireframe-toggle-brief.md` | P11 设计视图移除「线框」切换（只保留设计产物；无契约自动结构草图；调试 `?prototype=wireframe`）；已实施，待评审；记录见 P7 设计稿第 31 节 |
| `2026-11-20-p12-start-scripts-build-restart-brief.md` | P12 启动脚本构建可见化（start 拆后端 tsc / 前端 vite 两步并明确失败）+ 新增 `restart.cmd`/`restart.sh`（stop → 构建 → start → 健康检查）+ README/STATUS；已实施，待评审 |
| `2026-11-20-phase1-handover-and-next-session-prompt.md` | **第一阶段收尾交接（2026-11-20）**：结论/已实施范围/当前基线/关键能力/运行态/未完成与风险/约束/下一阶段建议 + **可直接复制的新会话话术**（只读交接单） |
| `2026-11-21-p7-7-custom-design-template-agent-design.md` | **P7-7 设计稿（待评审）**：模板中心 = 模板工作室；agent 读 catalog、只写 `spec.json`，生成器产出 pack；reference/contract 页面混用、单风格、草稿+发布、应用闭环；含 API/UI/分批（P7-7a/b/c）/真实模型验证计划；spike 证据见 `evidence/2026-11-21-p7-7-spike/`；**P7-7a、P7-7b-1（后端工作室）、P7-7b-2a（StudioView/template-preview/preview 结构覆盖/测试守卫）、P7-7b-2b（模板中心自定义入口/`e2e:p7-7b`/清理）、P7-7c-1（应用闭环 + `e2e:p7-7c`）、P7-7c-2（真实模型闭环，证据 `evidence/2026-11-21-p7-7-real-model/`）已实施（待评审，2026-11-21，见文末实施记录）** |
| `2026-11-23-polish-batch1-a-f1-f2-brief.md` | 打磨批 1：mock 枚举多样性（A）+ 模板中心内置预览 embed（F1）+ pm-steps 点击步条同步 v-model（F2）；已实施（待评审） |
| `2026-11-23-polish-batch2-c1-ui-check-brief.md` | 打磨批 2 · C1：ui-check 文案/状态区分（开发视图 pending 提示 + fidelity hint 按 missing/skeleton 区分）；已实施（待评审） |
| `2026-11-23-polish-batch3-mobile-brief.md` | 打磨批 3 · E：移动端 <768 审计与修复（390/414/768 实测；Studio ≤1180 单栏 页面/对话/预览 tab、模板中心/picker ≤560 头部响应式；p7-3b/p7-7b/p7-7c 移动断言）；已实施（待评审） |
| `2026-11-23-dev-view-real-model-brief.md` | 打磨批 5 · B：开发视图真实模型复跑（临时 3488/4788 + 真实 `deepseek-flash`；自定义模板→应用→agent 实现→ui-check/fidelity 13 项/Playwright；自动收尾 8m34s、fidelity 12 pass/1 warn/0 fail）；证据 `evidence/2026-11-23-dev-view-real-model/`；已实施（待评审） |
| `2026-11-23-ui1a-shell-home-brief.md` | **UI-1a**：设计 token（type scale/spacing）+ 应用外壳（56px 三区、更多菜单收纳删除）+ 首页（概览式两栏、运行状态 compact）；p7-3b 55→77；证据 `evidence/2026-11-23-ui1a/`；已实施（待评审） |
| `2026-11-23-ui1b-views-typography-brief.md` | **UI-1b**：三视图排版/层级（字号/间距）+ 去重复 chip + 技术摘要人话化（`X 个模块 · Y 个设计` / `N 处待处理`）+ 状态文案统一（需求中/设计中/开发中/已完成）；p2/p3/p4/p7-3b/p7-7b 断言数保持；证据 `evidence/2026-11-23-ui1b/`；已实施（待评审） |
| `2026-11-23-ui2a-states-skeleton-brief.md` | **UI-2a**：统一空态/加载/错误 + 骨架——共享 `StatePanel`（empty/error/loading；list/doc/canvas/timeline 骨架；`role=alert/status`；raw error 折叠）+ 需求大纲/文档、设计模块/画布/实体、开发会话/时间线、首页应用列表替换点 + 开发开始卡任务清单版式；`e2e:p2/p3/p4/p7-3b/p7-7c` 保持 **116/126/130/77/116**；证据 `evidence/2026-11-23-ui2a/`；已实施（待评审） |
| `2026-11-23-ui2b-ai-panel-brief.md` | **UI-2b**：AI 面板空态/示例/头部/加载/错误——`AgentChatPanel` 空态用 `StatePanel`（无会话「开始与 AI 协作」/有会话「发送第一条消息」+ 上下文 pills：视图/模块/工作室 pack + 按视图 3 条示例，点击只填不发 + CTA）、头部压成两行、会话加载时间线骨架（`chat-loading`）、错误条 `role=alert` + 重试；`StatePanel` 增 `#meta` 插槽；`e2e:p2` **116→120**、`e2e:p3` **126→131**（p4/p7-3b/p7-7b/p7-7c 保持 130/77/73/116）；证据 `evidence/2026-11-23-ui2b/`；已实施（待评审） |
| `2026-11-23-ui3a-primitives-brief.md` | **UI-3a**：按钮/图标/chip 原语——`RgButton`（variant/size 28·32·36/icon/iconOnly/loading）、`RgChip`（tone/size 22·24/dot）、`ui.css`（`.el-button` 32/8/13 全局 + 暗色主按钮浅墨）；顶层替换 AppShell/HomeShell/Requirements(View/Outline)/DesignView/DevView/AgentChatPanel/SessionList；`←`→ArrowLeft、`⋯`→MoreFilled、`☰/▤`→Fold/Expand+Memo、`›`→ArrowRight；`e2e:p2/p3/p4/p7-3b/p7-7b/p7-7c` = **120/131/130/77/73/116**；证据 `evidence/2026-11-23-ui3a/`；已实施（待评审） |
| `2026-11-23-ui3b-cards-dialog-tabs-brief.md` | **UI-3b**：卡片/面板 + dialog + tabs 统一——`ui.css` 新增 `.rg-card`/`.rg-panel`（padding 16—20/radius 12/shadow-1，hover 只对可点击卡片）与 `.rg-tabs`/`.rg-tab`（34 高/active 2px 墨色下划线/计数 chip），统一 EP `.el-dialog`/`.el-message-box`/`.el-drawer` 间距与关闭按钮；顶层替换首页/需求/设计/开发/会话/AI 面板 + 自定义对话框壳 + 模板中心/模板库/工作室 tabs；`e2e:p2/p3/p4/p7-3b/p7-7b/p7-7c` = **120/131/130/77/73/116**；24 截图 + 23 次无溢出 + 29 次口径测量，证据 `evidence/2026-11-23-ui3b/`；已实施（待评审） |
| `2026-11-23-app-model-without-modules-and-api-design.md` | **去模块设计稿（D0，待评审）**：需求单文档 + 设计三文件（`entities.json`/`pages.json`/`api-design.md`）；页面集 = Epic；字段 `code`/`name` 标准化；接口设计为 Markdown 固定模板 + 内置规范/示例/校验（只做文档，不生成后端）；支撑产物应用级；会话 = 应用 × 视图；旧数据硬切不兼容；含 D1/D2/D3 分批与测试计划；**D1（去模块底座）、D2（接口设计文档）、D3（testid/CSS 清理 + UI 截图脚本更新 + 全量回归 + 文档/汇报）已实施（待评审，2026-11-23，见文末实施记录）** |
| `2026-11-23-layout-and-api-generation-polish-brief.md` | **O1—O3（待评审）**：需求=左对话（可拖拽）+右文档（删除大纲、保留 doc-toc）；设计=左对话+中页面集/实体+右主区；≤1024 抽屉互斥；`generate-design` 同轮生成 entities/pages/api-design（`generate-api-design` 仅补/更新）；回归/截图/文档记录 |
| `2026-11-24-design-pageset-tabs-and-overview-brief.md` | **O4（待评审）**：删除设计中栏「页面集/实体」；设计=左对话+右主区；页面集 Tabs + 页面 Tabs（总览+页面）；总览 2 列卡片 + 总览 PNG 下载（先下载、不持久化）；ER 完整一张图；p3 151 等回归记录 |
| `2026-11-24-requirements-ask-ai-er-zoom-overview-canvas-brief.md` | **B1—B3（待评审，2026-11-24）**：需求 h2/h3「问 AI」+ 可移除「定位章节」chip + 隐藏章节上下文；ER 去页面集 chips、字段面板上下分栏、Ctrl/⌘+滚轮/捏合缩放 + 适应窗口；页面集总览改为在线画布（缩放/平移/适应窗口），导出仍 2 列拼图 |
| `2026-11-24-er-inspector-and-design-preview-interaction-brief.md` | **B4—B5（待评审，2026-11-24）**：ER 默认不选中、右上浮层 inspector（收起胶囊/点空白与 Esc 收起/关闭清除）、缩放右下角悬浮、图例折叠、首次自动适应一次；设计预览交互层（recipe 驱动：dialog-form 弹窗、page-form/wizard/detail 切页、delete 确认、无目标提示；「交互预览 · 不保存」不写数据）；新增 `e2e:design-interaction` **24**；后端 238 / 前端 213、p3 **177** |
| `2026-11-24-action-targets-and-api-fix-state-brief.md` | **B6—B7（待评审，2026-11-24）**：动作目标 `actionTargets`（显式优先、同页面集、design-adapter/schema/example/validate/后端 warning/设计 prompt）+ `main-sub` 纳入 create/edit 表单目标 + 无表单页临时表单（明确标注 + 原因/候选）；接口「让 AI 修」一键发送 + 修复状态；后端 **243** / 前端 **230**、`e2e:design-interaction` **30** / `e2e:api-design` **28** |
| `2026-11-24-capability-packs-and-code-layout-c0-design.md` | **C0 设计稿（待评审，2026-11-24）**：能力包 + 技术基座 + `code/` 布局——应用目录统一 `code/backend|code/frontend`；新 EOS 基座替换旧模板（清理 demo/业务、参数化敏感值、合并 PageTemplates/GlobalPreference）；`eos-dev-kit` 高内聚能力包（6 skills + 2 plugins + scripts/docs/tests/e2e，默认启用）；base/capability manifest、注册表、受信运行资产、安装/同步/清理、`docs/capabilities.json` + `app_settings` 镜像、AGENTS 受管区块、prompt 能力目录、Spring Boot `runtime` 迁移位；能力版本暂不设计；`skill-test` 为工作台自测评工具；分批 C1a/C1b/C2—C6 |
| `2026-11-23-next-design-optimization-backlog.md` | **设计阶段后续优化（原始目标/候选方案）**：① 去掉中栏页面集/实体，页面集移到页面区域；② 页面集全局预览/总览；**A/B 已由 O4 实施（待评审），总览已升级为在线画布（本轮 B3）** |

相关文档（不在本目录）：

- 汇报材料：`docs/report/ai-dev-workbench-overview.md|html|pdf`（当前版本）
- 真实实例切换清单：`docs/ops/switch-to-agent-first.md`
- 当前状态与基线：`docs/STATUS.md`

## 历史文档

**已删除**（2026-11-18）：`2026-11-04-*` 至 `2026-11-17-*` 的全部设计稿与交接单（共 64 个文件）。

- 原因：旧方向（模块确认 / 版本 / Change Set / 交接包 / U7 阶段 / M7-2 / 视觉 V1—V3）已被取代，保留会误导实现。
- 需要查阅时，从 GitHub 仓库历史恢复（`icecream-wx/ai-dev-workbench`）。
