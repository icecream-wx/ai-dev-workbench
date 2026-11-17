# 主会话/评审接续单（2026-11-11）

用途：当前会话已很长；D5 完成，进入新的评审/讨论周期。**建议新开主会话 + 评审会话**，用本文档接续；当前会话保留为历史归档。
原则：文档是事实来源；不依赖旧会话聊天记录。

---

## 1. 当前基线

- P0—P5 已完成；真实应用 `quarterly-reporting` 已完成（EOS/Vue3/MySQL）。
- 2026-11-09 修复：首页 opencode 自动探测、新建应用格式提示、模型默认跟随 CLI、协议 JSON 解析、设计 constraints 归一化。
- 2026-11-10 R1：需求阶段文档化（模板/章节/版本/模板中心/章节问 AI/确认需求/删除应用）。
- 2026-11-10 D1—D4：设计阶段实体设计 + 页面原型 + 原型模板 + Design Studio。
- 2026-11-11 H1—H4：需求 Scene/Epic/Story 结构化 + 稳定 ID；DesignInputBundle；requirementRefs；覆盖度；需求变更 diff/sync；重新编辑需求。
- **2026-11-11 D5 已完成并评审（主会话）**：设计→开发交接包 + Change Set #1 + 初次进入开发 + 开发会话 handoff 版本。主链路可验收，3 项 must-fix 已修复并复验（见 `docs/STATUS.md`「D5 评审」→「must-fix 修复」）。
- **2026-11-11 C1 已完成并评审（主会话）**：Change Set #2+#N、需求/设计 reopen 门禁、`05-CHANGES` 真实 diff、变更历史/取消（恢复基线）/仅设计→需求+设计升级、变更首条提示。后端 100 测试、前端 35 测试、typecheck/build、`smoke:change-set` 与回归冒烟、Playwright（API 预置）通过；见 `docs/STATUS.md`「C1a 完成」「C1b 完成」「C1 评审」。
- **2026-11-11 R2a 已完成**（AI 建议预览/勾选应用/忽略、模板复制编辑、P1 守卫；见 `docs/STATUS.md`「R2a 完成」）。
- **2026-11-11 R2b 已完成**（需求文档版本 checkpoint 化、手动保存版本、确认需求必产 confirm 版本、建议消息裁剪、R2a 两项 UX 修复；见 `docs/STATUS.md`「R2b 完成」）。
- **2026-11-11 I-10 已完成**（开发会话列表/查看/切换/重命名/归档/恢复、归档只读、按变更单分组、handoff 版本提示；后端 116 测试、前端 54 测试、`smoke:dev-sessions` + 4 项回归、Playwright（API 预置）通过；见 `docs/STATUS.md`「I-10 完成」）。
- **2026-11-11 I-09a 已完成（待评审）**（上下文健康度 chip/提示条：按模型 `limit.context` 百分比 60% 黄/85% 红；opencode 原生 compact；时间线 compaction 提示；后端 123 测试、前端 60 测试、`smoke:dev-health` + 5 项回归、Playwright（真实 opencode + 路由注入 warn/danger）通过；见 `docs/STATUS.md`「I-09a 完成」，偏差/待确认见该节与 `docs/plans/2026-11-11-i09a-implementation-brief.md` §7.4）。
- **2026-11-11 R2c 已完成（待评审）**（设计版本 checkpoint 化、确认设计必产 `confirm` 版本、`POST /design/versions` 手动保存版本、版本来源/变更单标签、回滚仅恢复规格不恢复截图、compact toast 文案；后端 126 测试、前端 63 测试、typecheck/build/check:vue、`smoke:design` 扩展 + 5 项回归、Playwright（API 预置）通过；见 `docs/STATUS.md`「R2c 完成」与 `docs/plans/2026-11-11-r2c-implementation-brief.md` §7）。
- **2026-11-11 R4a 已完成（待评审）**（`legacy/`、`DesignPending.vue`、`designErrorHandler`、零引用死导出清理；`DesignHandoffDialog` `props.mode` 修正；后端 126 测试、前端 63 测试、typecheck/build/check:vue、7 项冒烟回归通过；见 `docs/STATUS.md`「R4a 完成」与 `docs/plans/2026-11-11-r4a-implementation-brief.md` §5）。
- **2026-11-11 R4b-1 已完成（待评审）**（前端 shared 抽取 + 旧 structured UI 删除：`shared/`、`settings/`、`design/prototype/` 落地；删除整个 `requirements-grooming/`、`workbench/HandoffDialog.vue`、`e2e-flow.ts` 与 `ajv`/`monaco-editor`；`App/AppShell/HomeShell/api.ts` 收敛为 doc/design/dev 单模式；后端 126 测试（未改后端）、前端 63 测试、typecheck/build/check:vue、临时数据目录 Playwright（含设计原型 wireframe）0 console error / 0 意外 API>=400；见 `docs/STATUS.md`「R4b-1 完成」与 `docs/plans/2026-11-11-r4b1-implementation-brief.md` §8）。
- **2026-11-11 R4b-2 已完成（待评审）**（后端 structured 移除 + 旧应用/数据删除：旧 P3 交接包、`/api/workspace`、`/api/modules/*`、`/api/settings/*`、`/api/agents/*`、旧 agents/spec 对话、`requirements_mode` 列；drop `modules`/`module_docs`/`handoffs`；旧应用 `quarterly-reporting`/`app1` 备份到仓库外并删除；后端 113 测试、前端 63 测试、8 支冒烟（含真实 opencode/真实模型）+ Playwright 通过；真实 DB `apps`/`projects/` 为空；见 `docs/STATUS.md`「R4b-2 完成」与 `docs/plans/2026-11-11-r4b2-implementation-brief.md` §8）。
- **2026-11-11 R4c 已完成（待评审）**（收尾：MySQL demo 清理 SQL `docs/ops/cleanup-demo.sql`（工作台不连库、由用户执行）+ 依赖清理（`@element-plus/icons-vue`、`ai-dev-workbench: file:..`，根 `concurrently` 保留）+ 文档收尾；因 npm `install --prefix` 会把根包写成 `file:..`，安装脚本改为在各自包目录内执行；后端 113 测试、前端 63 测试、typecheck/build/check:vue、根 build、`smoke:requirements`/`smoke:design-handoff` 通过；`apps` 空、`projects/` 空、无旧表；见 `docs/STATUS.md`「R4c 完成」与 `docs/plans/2026-11-11-r4c-implementation-brief.md` §8）。
- **2026-11-11 视觉 V1 已完成（待评审）**（主题系统：语义 token + Element Plus 深色变量 + `color-scheme`；`setTheme/toggleTheme`（localStorage → `prefers-color-scheme` → light）；AppShell/HomeShell 顶栏主题按钮 + SettingsDialog「外观」；HomeShell/AppShell/NewAppDialog/SettingsDialog/ChangeSetStart/History/DesignHandoff/VersionHistory/DesignVersions/MarkdownView token 化 + 1280/1024/768 响应式；前端 63 测试、typecheck/build/check:vue、Playwright（浅/深 × 1440/1024/768，0 console error / 0 意外 API>=400 / 0 白底 / 0 横向溢出）通过；见 `docs/STATUS.md`「视觉 V1 完成」与 `docs/plans/2026-11-11-visual-polish-v1-brief.md` §8）。
- **2026-11-11 视觉 V2 已完成（待评审）**（需求文档 + 设计 Studio 的 token 化/深浅色/响应式：需求三栏 1024/768 折叠为对话+大纲抽屉、工具栏不溢出、章节卡/结构化 OutlineEditor/AI 建议卡 diff/气泡/模板中心/版本/只读横幅 token 化；设计 Studio 顶栏/Tab/实体表/ER SVG/页面原型/页面集树/覆盖度/同步/原型模板/交接包/版本 token 化，≤1024 设计对话与页面集树抽屉、≤768 实体列表抽屉与画布+规格纵向堆叠；原型线框保持“白纸”；`theme.css` 仅新增 `--rg-accent`/`--rg-accent-soft`；未改后端/接口/数据/版本/交接包；前端 63 测试、typecheck/build/check:vue、Playwright（浅/深 × 1440/1024/768 共 120 张，0 console error / 0 意外 API>=400 / 0 深色白底 / 0 横向溢出）通过；见 `docs/STATUS.md`「视觉 V2 完成」与 `docs/plans/2026-11-11-visual-polish-v2-brief.md` §8）。
- **2026-11-11 视觉 V3 已完成（待评审）**（开发页 `DevView`/`SessionList`/`StepCard`/`ToolCard`/`PermissionCard`/`FormCard`/`Composer`/健康度/右侧 aside 的 token 化 + 深浅色 + 响应式：顶栏 1024/768 换行不溢出、新增「会话信息」折叠按钮；≤1024 会话栏与 aside 折叠为抽屉（遮罩 + Esc + 互斥），≤768 单栏 + Composer 贴底；diff 行底色/终端输出/开关圆点新增 token，`dev/` 下无裸颜色；未改后端/接口/数据；前端 63 测试、typecheck/build/check:vue、全量截图 270 张（浅/深 × 1440/1280/1024/768 × 首页/新建应用/需求/设计/开发 12 态/交接包/变更历史/模型设置，0 console/page error / 0 意外 API>=400 / 0 深色白底 / 0 横向溢出）+ 真实 opencode 功能回归（建会话/列表/SSE/只读/恢复/主题持久化/1024 抽屉）通过；见 `docs/STATUS.md`「视觉 V3 完成」与 `docs/plans/2026-11-11-visual-polish-v3-brief.md` §7）。
- 下一步顺序：**I-09b-1（U6）、P1、P2、U7-1、U7-2、U7-3 均已完成/验证（2026-11-12）**；后续按用户真实体验反馈排优化/问题。**新主会话请用 `docs/plans/2026-11-12-main-review-handoff-u7-2.md`**。U7-1 后端已含安全 must-fix #1/#2；后端 145 测试、前端 78 测试；视觉 V1—V3 已完成并评审；MySQL demo 行由用户自行执行清理 SQL。

---

## 2. 必读文档

1. `AGENTS.md`
2. `docs/STATUS.md`
3. `docs/test-issues-2026-11-09.md`（I-01—I-15）
4. 需求阶段：
   - `docs/plans/2026-11-10-requirements-stage-doc-design.md`
   - `docs/plans/2026-11-10-requirements-r1-implementation-brief.md`
5. 设计阶段：
   - `docs/plans/2026-11-10-design-stage-entity-prototype.md`
   - `docs/plans/2026-11-10-design-stage-implementation-brief.md`
6. 需求→设计：
   - `docs/plans/2026-11-10-requirements-to-design-handoff.md`
   - `docs/plans/2026-11-10-requirements-to-design-handoff-implementation-brief.md`
7. 设计→开发：
   - `docs/plans/2026-11-11-design-to-development-handoff.md`
   - `docs/plans/2026-11-11-d5-implementation-brief.md`
8. 迭代/变更：
   - `docs/plans/2026-11-11-iterative-change-design.md`

---

## 3. D5 评审（已完成 2026-11-11，见 `docs/STATUS.md`「D5 评审」）

D5 已由实施会话完成，并由主会话独立评审：独立跑测试/构建/冒烟、独立渲染交接包、走查 D5 代码与安全边界。结论：主链路可验收；3 项 must-fix（重新生成文案、预览/历史 PNG URL、首包变更单状态）进入 C1 前修。

1. 读 D5 方案/实施交接单/STATUS。
2. 独立跑：
   - `npm test --prefix backend`（报告 89/89）
   - `npm run build --prefix backend`
   - `npm test --prefix frontend`（报告 29/29）
   - `npm run typecheck --prefix frontend`
   - `npm run build --prefix frontend`
   - `npm run smoke:design-handoff --prefix backend`
   - 可选：`smoke:design`、`smoke:handoff-input`、`smoke:requirements`
3. 代码走查重点：
   - 交接包 00—05 + schema/template/manifest 是否自包含、无内部 ID/凭据；
   - 校验：需求确认、设计确认、input stale、refs、PNG 缺图、模板缺失；
   - Change Set #1 创建/复用、app status development、阶段事件；
   - 开发会话 handoff version/hash/change_set_id；
   - 文件接口安全（路径穿越、HTML sandbox/CSP、PNG 类型）；
   - 重新生成、历史版本、完成/继续的语义；
   - 已知限制：旧版本文件不保留、模板无 version 字段、PNG 需人工重截图、重新生成不新建会话（C1）。
4. 结论写入 `docs/STATUS.md`「D5 评审」，列出 must-fix / 可随 C1/R2。

---

## 4. 已确认的关键决策（避免重复讨论）

- 需求/设计：文档/章节/结构化 Scene/Epic/Story 是唯一事实来源；稳定 ID；不做旧数据兼容。
- 设计：实体设计 + 页面原型；HTML 原型 + PNG；原型模板全局库；旧设计面板移除。
- 需求→设计：DesignInputBundle + requirementRefs + 覆盖度；Story 覆盖只警告；变更 diff/用户选择。
- 设计→开发：确定性交接包；页面规格契约、PNG 视觉参考；PNG 缺图阻塞；模板 Token 强约束；无 OpenAPI/真实外键；一个主按钮生成并进入开发；开发会话固定 handoff 版本。
- 迭代：Change Set + 版本化；首次 Change Set #1；范围仅需求+设计/仅设计；纯开发修复不进 Change Set；每变更新会话；全量 + `05-CHANGES`；删除代码由开发 agent 执行（工作台不自动删，DB 迁移需确认）；取消仅在新 handoff 前；历史=应用头部变更历史面板 + 各阶段版本标签。

---

## 5. 下一步讨论顺序

1. **C1 完整变更循环**（✅ 2026-11-11 已完成并评审）：
   - Change Set #2+#N、需求/设计 reopen、旧会话只读。
   - H4 sync/diff 接入 Change Set；`05-CHANGES` 真实 diff。
   - 变更历史面板、取消变更、仅设计→需求+设计范围升级。
   - 删除代码/DB 迁移仍由开发 agent 执行（工作台只给清单/要求）。
2. **R2b 需求版本策略**（✅ 2026-11-11 已完成，见 `docs/STATUS.md`「R2b 完成」）：
   - 自动保存不生成版本；模板切换/AI 应用/确认需求/回滚/取消恢复/手动保存生成来源化版本；
   - 确认需求必产 `confirm` 版本（变更单基线/取消恢复）；
   - 版本弹窗来源标签/`变更 #N`/手动保存；建议消息裁剪（持久化去 lineDiff、加载 hydrate）；
   - R2a 两项 UX 修复（stale 可忽略、应用前先判版本）；不删除/压缩版本。
3. **I-09 长会话**（I-09a ✅ 2026-11-11 已完成并评审；I-09b 已拆分）：
   - I-10 已完成：左侧会话列表、切换/重命名/归档/恢复、归档只读、按变更单分组（见 `docs/STATUS.md`「I-10 完成」）。
   - **I-09a 已完成**：按模型上下文百分比的健康度（60% 黄/85% 红）+ 原生 compact + 时间线压缩提示（见 `docs/STATUS.md`「I-09a 完成」）。
   - **I-09b 已拆分（2026-11-12）**：U6（规模识别 + `04-PLAN` 建议 + 提示）已完成并评审（2026-11-12），见 `docs/plans/2026-11-12-i09b1-implementation-brief.md`；U7-1 后端已完成并评审（`manifest.phases` + `app_dev_phases` + 阶段 API/brief/摘要 + `smoke:dev-phases`；摘要全链路脱敏 + 只读 agent 安全 must-fix 已修），见 `docs/plans/2026-11-12-u7-1-implementation-brief.md` §8；U7-2 前端已完成并评审（入口/阶段条/弹窗/完成-跳过-重新打开/会话 chip/只读 + 响应式），见 `docs/plans/2026-11-12-u7-2-implementation-brief.md` §8。不新建第二套会话模型。
   - 评审关注（I-09a）：空会话 compact 返回 200 但时间线“未执行”的口径是否接受；真实长会话压缩成功路径尚未实机验证。
4. **R2c 设计版本策略**（✅ 2026-11-11 已完成，待评审，见 `docs/STATUS.md`「R2c 完成」）：
   - 自动保存不产版本；确认设计/模板切换/AI 生成/同步设计输入/版本回滚/变更取消恢复/手动保存生成来源化版本；
   - 确认设计必产 `confirm` 版本（C1 基线/取消恢复）；版本弹窗来源标签/`变更 #N`/保存版本；不改交接包版本语义。
5. **R4 清理（R4a ✅ 2026-11-11 已完成，待评审；R4b-1 ✅ 已完成，待评审；R4b-2 ✅ 已完成，待评审；R4c ✅ 已完成，待评审）**：
   - R4a（已完成）：`legacy/`、`DesignPending.vue`、`designErrorHandler`、零引用死导出；`props.mode` 修正。
   - R4b-1（已完成）：前端 shared 抽取（`shared/`/`settings/`/`design/prototype/`）+ 删除旧 structured UI/旧 handoff 弹窗/旧 structured 流程脚本；前端只剩 doc/design/dev/change-set/settings/shared。
   - R4b-2（已完成）：后端 structured 兼容（旧 P3 交接包、`/api/workspace`、`/api/modules/*`、`/api/settings/*`、`/api/agents/*`、旧 agents/spec 对话、`requirements_mode`）、drop `modules`/`module_docs`/`handoffs`、旧应用登记与目录（备份在仓库外）。
   - R4c（已完成）：MySQL demo 清理 SQL `docs/ops/cleanup-demo.sql`（A 方案：只生成 SQL，用户自行执行；工作台不连库）；移除 `@element-plus/icons-vue` 直接依赖与 `ai-dev-workbench: file:..`（含 lock/junction，根 `concurrently` 保留）；安装脚本改为在各自包目录内执行；文档收尾与最终状态校验。详见 `docs/plans/2026-11-11-r4c-implementation-brief.md` §8。
6. **视觉/响应式/深浅色打磨（V1 ✅ 2026-11-11 已完成，待评审；V2 ✅ 已完成，待评审；V3 ✅ 已完成，待评审）**：
   - V1（已完成）：主题系统（语义 token + Element Plus 深色变量 + `color-scheme`）、`setTheme/toggleTheme`、AppShell/HomeShell 主题按钮 + 设置「外观」、首页/外壳/设置/通用弹窗 token 化 + 1280/1024/768 响应式。见 `docs/STATUS.md`「视觉 V1 完成」与 `docs/plans/2026-11-11-visual-polish-v1-brief.md` §8。
   - V2（已完成，待评审）：需求文档（三栏→1024/768 对话+大纲抽屉、工具栏不溢出、章节卡/结构化大纲/AI 建议卡 diff/气泡/模板中心/版本/只读）+ 设计 Studio（顶栏/Tab/实体表/ER SVG/页面原型/页面集树/覆盖度/同步/原型模板/交接包/版本）token 化与深浅色；原型线框保持白纸；见 `docs/STATUS.md`「视觉 V2 完成」与 `docs/plans/2026-11-11-visual-polish-v2-brief.md` §8。评审关注：抽屉 overlay 是否符合预期、768 实体表/页面规格横向滚动、线框白纸例外口径。
   - V3（已完成，待评审）：开发页（顶栏/会话列表/时间线/工具卡 diff·shell/权限/表单/Composer/健康度/右侧 aside）+ 全量截图回归 270 张；≤1024 会话栏与 aside 抽屉、≤768 单栏；`theme.css` 仅新增终端/diff/开关圆点 token；见 `docs/STATUS.md`「视觉 V3 完成」与 `docs/plans/2026-11-11-visual-polish-v3-brief.md` §7。评审关注：mock 数据口径（开发页丰富内容不来自真实模型）、抽屉互斥与断点重置、深色开关圆点自定义、`el-switch`/`el-table` 深色实机再确认。
7. **I-09b（2026-11-12 已拆分）**：
   - **I-09b-1（U6，已完成并评审 2026-11-12）**：交接包规模识别（Story ≥10 / 页面 ≥12 / 文本 ≥100KB）→ `manifest.scale` + `04-PLAN.md`「0. 建议分阶段开发」+ `00-README` 提示 + 交接包弹窗/开发页提示；preview/generate 同一套、preview 不写盘、旧 manifest 无 scale → null；未新增表/API 路由/阶段会话、未调模型。后端 122 测试、前端 69 测试、typecheck/build/check:vue、`smoke:design-handoff` + 4 项回归、Playwright（API 预置，大/小 × 浅/深 × 1440/768）通过；见 `docs/STATUS.md`「I-09b-1 完成」与交接单 §8。
   - **P1 设计 ID 跨应用冲突 + U6 变更单 caveat（已完成并评审 2026-11-12）**：实体/页面集/页面 ID 改为“已有保留；raw id 仅全局未占用时接受，否则生成全局唯一 ID”，每次确定 ID 后无条件登记 used（重复 raw id 换新），默认页面集不再用 `ps-<hash(sceneKey)>`；`writeEntities`/`writePageSets`（含回滚/取消恢复）事务化；`changeSet.seq>1` 的 `04-PLAN`/`00-README` 明确以 `05-CHANGES.md` 增量范围为准。后端 131 测试（+8 冲突 / +1 caveat）、5 支冒烟、前端 69 测试回归通过；见 `docs/STATUS.md`「设计 ID 跨应用冲突修复完成」与 `docs/plans/2026-11-12-design-id-collision-fix-brief.md` §7。
   - **I-09b-2（U7，U7-1 后端 ✅ 2026-11-12 完成并评审；U7-2 前端 ✅ 2026-11-12 完成并评审）**：按 Epic 派生阶段 + 新表 `app_dev_phases` + 会话阶段标签 + phase brief + 模型摘要/fallback（只读 agent + 全链路脱敏）；`manifest.phases` 稳定 key、阶段 start/complete/skip/reopen、会话/状态/列表 phase 字段；前端按阶段开发入口/阶段条/弹窗/完成-跳过-重新打开/会话 chip/只读；`smoke:dev-phases`（真实 opencode，不调模型）。交接单 `docs/plans/2026-11-12-u7-1-implementation-brief.md` §8、`docs/plans/2026-11-12-u7-2-implementation-brief.md` §8；设计 §4.3.3。
8. **P2 页面集主实体匹配（✅ 2026-11-12 完成并评审）**：
   - `deriveRequirementScenes` 的 PRD/Epic 分支改用 `entitySceneMatch` 分量 + 严格字典序：`storyHits` → `epicHit` → `sceneHit` → `textScore`（title×10 + text）→ 实体顺序（稳定排序）；不再用加权和，Story 引用必然优先、不受实体名长度影响；无引用时退化为 `textScore`，与旧逻辑完全一致。
   - 真实错位「EPIC-001 图书档案管理 → 借阅记录」纠正为「书目」；新增 `backend/src/design/scene-entity-matching.test.ts` 5 项（含 32 字符长名称 + 文本分 >1000 的字典序回归）；后端 136 测试、5 支冒烟、前端 69 测试/typecheck/build/check:vue 通过。
   - 边界：不改 AI 页面集/页面规格/UI/API/DB；不迁移已生成页面集（需重新生成；当前 `apps=0`）。见 `docs/STATUS.md`「页面集主实体匹配修复完成」与交接单 §6。

---

## 6. 会话分工

- 新主会话：设计/评审/决策；不直接改代码。
- 实施会话：按交接单实现；完成后更新 `docs/STATUS.md`，回传主会话评审。
- 同一时间只让一个会话改文件；主会话不并行改代码。
- 如果实施中需要改设计决策，先回主会话确认。

---

## 7. 新主会话开场提示（可直接粘贴）

> 在 `E:\work_space_primeton\ai-dev-workbench` 继续，作为主会话/评审。先读 `docs/plans/2026-11-11-main-review-handoff.md`，再按其中必读文档和评审清单工作。
> 当前 D5/C1/R2a/R2b/I-10/I-09a/R2c/R4a/R4b-1/R4b-2/R4c 已完成并评审；视觉 V1/V2/V3 已完成并评审；I-09b-1（U6）、P1 设计 ID 跨应用冲突修复 + U6 变更单 caveat、P2 页面集主实体匹配均已完成并评审（2026-11-12）。
> I-09b 已拆分：U6 交接包规模识别 + 04-PLAN 建议分阶段已完成并评审（`docs/STATUS.md`「I-09b-1 完成」）；P1 与 caveat 见 `docs/STATUS.md`「设计 ID 跨应用冲突修复完成」；P2 见「页面集主实体匹配修复完成」；U7-1 后端已完成并评审（2026-11-12，含摘要脱敏/只读 agent must-fix，见「U7-1 完成」），U7-2 前端已完成并评审（见「U7-2 完成」/`docs/plans/2026-11-12-u7-2-implementation-brief.md` §8），U7-3 真实模型全链路已验证（见「U7-3 真实模型全链路验证」/`docs/plans/2026-11-12-u7-3-real-model-e2e-brief.md` §8）。
> MySQL demo 行由用户自行执行 `docs/ops/cleanup-demo.sql`；不要在本轮实现后续项，除非用户明确同意。
> 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。
