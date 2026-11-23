# 设计文档索引

## 当前有效（2026-11-18 起；**第一阶段收尾 2026-11-20，进入细化/优化/打磨**；P6 完成，P7 实施中：P7-1～P7-6c + P7-4b + P8-1 + P8-2 + P9 + P10 + P10b + P11 + P12 已实施待评审；**P7-7 设计稿与 spike 证据已出（2026-11-21）；P7-7a、P7-7b-1（后端工作室）、P7-7b-2a（StudioView/template-preview/测试守卫）、P7-7b-2b（模板中心自定义入口/`e2e:p7-7b`/清理）、P7-7c-1（应用闭环 + `e2e:p7-7c`）、P7-7c-2（真实模型闭环，证据 `evidence/2026-11-21-p7-7-real-model/`）已实施（待评审）**；**2026-11-23：用户确认真实 3300 人工验收全部通过（P7-7 评审仍待定；验收明细待补）**）；打磨批 5（开发视图真实模型复跑，证据 `evidence/2026-11-23-dev-view-real-model/`）已实施（待评审）。

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

相关文档（不在本目录）：

- 汇报材料：`docs/report/ai-dev-workbench-overview.md|html|pdf`（当前版本）
- 真实实例切换清单：`docs/ops/switch-to-agent-first.md`
- 当前状态与基线：`docs/STATUS.md`

## 历史文档

**已删除**（2026-11-18）：`2026-11-04-*` 至 `2026-11-17-*` 的全部设计稿与交接单（共 64 个文件）。

- 原因：旧方向（模块确认 / 版本 / Change Set / 交接包 / U7 阶段 / M7-2 / 视觉 V1—V3）已被取代，保留会误导实现。
- 需要查阅时，从 GitHub 仓库历史恢复（`icecream-wx/ai-dev-workbench`）。
