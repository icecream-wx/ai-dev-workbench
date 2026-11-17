# 当前状态与交接

更新日期：2026-11-12（北京时间）
状态：**P0—P5、R1、设计阶段 D1—D4、需求→设计交接 H1—H4、设计→开发交接 D5 已完成**——真实应用 `quarterly-reporting` 由 opencode build agent 实现，后端 10 个 H2 测试/打包、前端构建、EOS + 真实 MySQL 空/非空接口/UI E2E 通过，用户已确认开发完成。2026-11-09 后续按测试反馈修复 4 项：首页 opencode 自动探测、创建应用配置格式提示、模型默认跟随 opencode CLI、协议 JSON 解析（见 `docs/test-issues-2026-11-09.md`）。2026-11-10 按 `docs/plans/2026-11-10-requirements-stage-doc-design.md` 完成 R1：模板表/文档章节表/版本表、内置模板 seed、模板 API、文档 API、chat doc 模式、模板中心/章节编辑器/构建活动/章节问 AI/确认需求/删除应用；59 个后端测试、20 个前端测试、typecheck/build、真实 opencode + `packycode-deepseek/deepseek-flash` Playwright E2E 通过。2026-11-10 按 `docs/plans/2026-11-10-design-stage-entity-prototype.md` 完成设计阶段 D1—D4：原型模板全局库/应用选模板、设计项目/实体/页面集/页面/版本表与 API、AI 生成实体/页面集 + `<<<DESIGN_JSON>>>` 设计对话、实体编辑/ER/确认、页面规格/Wireframe 渲染/模板切换/PNG 截图/版本回滚、设计 Studio 外壳；并按 D1—D4 评审修复：页面集改为按需求场景/Epic 派生、创建/编辑表单分开、确认后只读+重新编辑、HTML 快照附件化、PNG 魔数校验、旧 structured 应用入口守卫；后端 71 个测试、前端 27 个测试、typecheck/build、design 冒烟、真实模型 design AI 冒烟、Playwright UI E2E 通过。2026-11-11 按 `docs/plans/2026-11-10-requirements-to-design-handoff.md` 完成 H1—H4：需求 Scene/Epic/Story 结构化章节 + 稳定 ID、DesignInputBundle（版本 + hash）与设计项目绑定、实体/页面 requirementRefs + Epic/Story 映射、覆盖度视图、需求变更 diff/重新同步 + 重新编辑需求；后端 86 个测试、前端 29 个测试、typecheck/build、H1—H4 冒烟、真实模型 Playwright E2E 通过。评审后修复 P1 stale 漏洞：需求 reopen 时已确认设计自动退回 draft，readiness/confirmDesign 检测 stale 时拒绝确认。2026-11-11 按 `docs/plans/2026-11-11-design-to-development-handoff.md` 完成 D5：确定性交接包 00—05 + schema/template/manifest + prototypes、Change Set #1、preview/generate、DesignStudio 生成并进入开发、开发会话 handoff 版本；后端 89 个测试、前端 29 个测试、typecheck/build、`smoke:design-handoff`、真实模型 Playwright E2E 通过。遗留未验证项：C1 完整变更循环、Nacos/Redis/团队 license、真实 401/403 权限接入。需求/设计采用 A（短暂会话 + prompt + SSE），开发采用 B（原生 build 会话）。

## 当前有效摘要

| 项 | 状态 |
| --- | --- |
| 新项目 | `E:\work_space_primeton\ai-dev-workbench` |
| 设计稿 | `docs/plans/2026-11-09-workbench-v2-design.md` |
| 阶段体验/开发会话方案（讨论稿） | `docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` |
| 需求阶段文档化方案（讨论稿） | `docs/plans/2026-11-10-requirements-stage-doc-design.md` |
| 需求 R1 实施交接单 | `docs/plans/2026-11-10-requirements-r1-implementation-brief.md` |
| 设计阶段实体/原型方案（已定稿；D1—D4 已实施） | `docs/plans/2026-11-10-design-stage-entity-prototype.md` |
| 设计阶段实施交接单（D1—D4 已实施；D5 见新方案） | `docs/plans/2026-11-10-design-stage-implementation-brief.md` |
| 需求→设计交接方案（已定稿，H1—H4 已实施） | `docs/plans/2026-11-10-requirements-to-design-handoff.md` |
| 需求→设计交接实施交接单（H1—H4 已实施） | `docs/plans/2026-11-10-requirements-to-design-handoff-implementation-brief.md` |
| 设计→开发交接方案（已定稿，D5 已实施） | `docs/plans/2026-11-11-design-to-development-handoff.md` |
| D5 实施交接单（已实施） | `docs/plans/2026-11-11-d5-implementation-brief.md` |
| 主会话/评审接续单（2026-11-11） | `docs/plans/2026-11-11-main-review-handoff.md` |
| 迭代/变更场景方案（已定稿，D5 基础已实施；C1a/C1b 已完成） | `docs/plans/2026-11-11-iterative-change-design.md` |
| C1 实施交接单（C1a 已完成并收口，C1b 已完成） | `docs/plans/2026-11-11-c1-implementation-brief.md` |
| R2a 实施交接单（已完成 2026-11-11：AI 建议预览/应用/忽略 + P1 + 模板编辑） | `docs/plans/2026-11-11-r2a-implementation-brief.md` |
| R2b 实施交接单（已完成 2026-11-11：版本 checkpoint/手动保存版本/建议消息裁剪 + R2a UX 修复） | `docs/plans/2026-11-11-r2b-implementation-brief.md` |
| I-10 实施交接单（已完成 2026-11-11：开发会话列表/切换/重命名/归档/恢复；按变更单分组） | `docs/plans/2026-11-11-i10-implementation-brief.md` |
| I-09a 实施交接单（已完成并评审 2026-11-11：上下文健康度 chip/提示条 + 原生 compact + 时间线压缩提示） | `docs/plans/2026-11-11-i09a-implementation-brief.md` |
| R2c 实施交接单（已完成 2026-11-11：设计版本 checkpoint/确认设计留档/手动保存版本/来源与变更单标签） | `docs/plans/2026-11-11-r2c-implementation-brief.md` |
| R4a 安全清理（已完成 2026-11-11：删 `legacy/`、`DesignPending.vue`、`designErrorHandler`、零引用死导出；修 `props.mode`） | `docs/plans/2026-11-11-r4a-implementation-brief.md` |
| R4b-1 实施交接单（已完成 2026-11-11：前端 shared 抽取 + 旧 structured UI 删除） | `docs/plans/2026-11-11-r4b1-implementation-brief.md` |
| R4b-2 实施交接单（已完成 2026-11-11：后端 structured 移除 + 旧应用/数据删除） | `docs/plans/2026-11-11-r4b2-implementation-brief.md` |
| R4c 实施交接单（已完成 2026-11-11：MySQL 清理 SQL/依赖清理/文档收尾） | `docs/plans/2026-11-11-r4c-implementation-brief.md` |
| 视觉打磨 V1 交接单（已完成并评审 2026-11-11：主题 token/深浅色切换 + 外壳/首页/设置/通用弹窗视觉与响应式） | `docs/plans/2026-11-11-visual-polish-v1-brief.md` |
| 视觉打磨 V2 交接单（已完成并评审 2026-11-11：需求文档 + 设计 Studio 的 token/深浅色/响应式） | `docs/plans/2026-11-11-visual-polish-v2-brief.md` |
| 视觉打磨 V3 交接单（已完成 2026-11-11：开发页 + 全量截图回归；待评审） | `docs/plans/2026-11-11-visual-polish-v3-brief.md` |
| 任务清单 | `docs/plans/2026-11-09-implementation-tasks.md` |
| P0 | ✅ 旧 dev 停用、骨架、`OpencodeRuntime`、配置/密钥边界 |
| P1 | ✅ 应用表/API、EOS 模板渲染、应用级 workspace、三阶段、首页创建 |
| P2 | ✅ req/design agent、短暂会话 chat + SSE、模型选择、decompose/testgen 迁移 |
| P3 | ✅ 交接包 bundle 校验、4 份 Markdown + 可选 DDL、preview/generate/read、设计完成接入、UI 预览/生成/下载 |
| P4 | ✅ 开发会话 API、原生 build 会话、时间线/工具卡/diff/权限/表单、Composer、文档大纲/文件变化、完成与恢复 |
| P5 | ✅ 真实应用 `quarterly-reporting` 已交付并确认完成；H2 测试/打包/前端构建、EOS + 真实 MySQL 空/非空 E2E、真实开发页/脱敏修复通过；遗留真实模型需求/设计、Nacos/Redis/license 未验证 |
| R1 需求文档化 | ✅ 2026-11-10 完成：模板/文档/章节/版本表 + 模板 API + 文档 API + chat doc 模式 + 模板中心/章节编辑器/构建活动/章节问 AI/确认需求/删除应用；59 后端测试、20 前端测试、typecheck/build、真实模型 Playwright E2E 通过 |
| 设计阶段 D1—D4 | ✅ 2026-11-10 完成：原型模板全局库/应用选模板、实体设计/ER/确认、页面集/页面规格/Wireframe/模板切换/PNG 截图/版本、`<<<DESIGN_JSON>>>` 设计对话、Design Studio 外壳；评审修复：场景页面集、创建/编辑表单拆分、确认后只读+重新编辑、HTML/PNG/模式守卫；71 后端测试、27 前端测试、typecheck/build、design 冒烟、真实模型 AI 冒烟、Playwright UI E2E 通过；D5 见下一行 |
| 需求→设计交接 H1—H4 | ✅ 2026-11-11 完成：结构化 Scene/Epic/Story + 稳定 ID、DesignInputBundle（版本/hash/历史）、设计项目绑定、requirementRefs（实体/页面/页面集）、需求覆盖度、需求变更 diff/重新同步/重新编辑需求；评审后修复 P1 stale 漏洞；86 后端测试、29 前端测试、typecheck/build、`smoke:handoff-input`、真实模型 Playwright E2E 通过 |
| 设计阶段 D5 | ✅ 2026-11-11 完成：设计 → 开发交接包 00—05 + schema/template/manifest + prototypes、Change Set #1、preview/generate、DesignStudio 生成并进入开发、开发会话 handoff 版本；后端 89 测试、前端 29 测试、typecheck/build、`smoke:design-handoff`、真实模型 Playwright E2E 通过；主会话评审见「D5 评审」，3 项 must-fix 已修复并复验 |
| C1a 变更单后端 | ✅ 2026-11-11 完成：变更单表增量列/API（发起/历史/取消）、基线捕获、阶段推进、reopen 门禁、交接包绑定 active 单、`05-CHANGES` 真实 diff、manifest/README 变更信息、开发首条提示；后端 96 测试、`smoke:change-set`（含真实 opencode 会话）、4 项既有冒烟回归通过；主会话评审 4 项收口已修（模板恢复/输入归属/纯修复不重开单/scope 升级 + `canCancel`） |
| C1b 变更前端 | ✅ 2026-11-11 完成：应用头部 chip、发起变更弹窗、变更历史弹窗（差异/取消/不可取消原因）、DesignStudio `变更 #N` + 仅设计升级提示条、设计交接包 `canGenerate` 门禁、需求页变更标识、首页 `变更中 #N · 阶段`；前端 35 测试、typecheck/build、`check:vue`、Playwright（API 预置）通过，0 console error / 0 非预期 API >=400；主会话评审见「C1 评审」（C1 可验收，观察项随 R2/I-10） |
| R2a 需求 AI 建议 | ✅ 2026-11-11 完成：AI 建议先预览（不写库/不产版本）→ 章节勾选/行级 diff/应用/忽略；`removeSectionKeys` 仅删自定义可选章节；doc 路由与 doc 对话 mode 守卫；使用中模板禁止删除；模板章节增删/排序/key 新增后只读；后端 110 测试、前端 44 测试、typecheck/build、`smoke:requirements` 扩展与 4 项回归、真实模型 Playwright 通过；主会话评审见「R2a 评审」（可验收，观察项 1/2/3 已由 R2b 关闭） |
| R2b 需求版本策略 | ✅ 2026-11-11 完成：版本 checkpoint 化（自动保存不产版本；模板切换/AI 应用/确认需求/回滚/取消恢复/手动保存为来源化版本）；`POST /requirements-doc/versions` 手动保存版本；确认需求必产 `confirm` 版本供变更单基线/取消恢复；版本列表/详情返回 `changeSetId/changeSetSeq`；版本弹窗来源标签/变更单号/保存版本；AI 建议消息裁剪（持久化去 `lineDiff`、加载 hydrate）；stale 建议可忽略、应用前先判 `baseVersion`；后端 115 测试、前端 46 测试、typecheck/build、`smoke:requirements` 扩展与 4 项回归、Playwright（API 预置）通过；主会话评审见「R2b 评审」（可验收） |
| I-10 开发会话列表 | ✅ 2026-11-11 完成：左侧会话栏（按变更单分组/搜索/重命名/归档/恢复/归档只读）、`app_sessions.title/note`、会话列表/切换/归档 API、`?sessionId=` 只读时间线、切换/归档前 best-effort interrupt；后端 116 测试、前端 54 测试、typecheck/build/check:vue、`smoke:dev-sessions`（真实 opencode）+ 4 项回归冒烟、Playwright（API 预置）通过；主会话评审见「I-10 评审」（可验收，观察项不阻塞） |
| I-09a 会话健康度 + 原生 compact | ✅ 2026-11-11 完成：按模型 `limit.context` 的上下文百分比（60% 黄/85% 红）、`DevProgress.context`（used 取最新 assistant 的 input+cache，不用聚合 tokens）、模型 limit 60s 缓存、`POST /development/compact`（无 active 409、错误透传、事件 `context-compacted`）、时间线 compaction 提示（空会话 failed 如实显示“未执行”）、顶部 chip/提示条/压缩按钮/右侧卡、`dev-health.js` 纯逻辑；后端 123 测试、前端 60 测试、typecheck/build/check:vue、`smoke:dev-health`（真实 opencode）+ 5 项回归、Playwright（真实 opencode + 路由注入 warn/danger）通过；主会话评审见「I-09a 评审」（可验收） |
| I-09b-1 交接包规模识别（U6） | ✅ 2026-11-12 完成并评审：Story ≥10 / 页面 ≥12 / 文本 ≥100KB → `manifest.scale` + `04-PLAN.md`「0. 建议分阶段开发（可选）」+ `00-README` 提示 + 交接包弹窗/开发页规模与入口；preview 与 generate 同一套、preview 不写盘、旧 manifest 无 scale 返回 null；不建表、不改会话/首条提示、不调模型。后端 122 测试（基线 113）、前端 69 测试（基线 63）、typecheck/build/check:vue、`smoke:design-handoff` + 4 项回归、Playwright（API 预置，大/小 × 浅/深 × 1440/768）通过；见「I-09b-1 完成」。U7-1 后端已完成（2026-11-12，见「U7-1 完成」），U7-2 前端已完成并评审（2026-11-12，见「U7-2 完成」） |
| 评审发现：页面集 ID 跨应用冲突 | ✅ 2026-11-12 **已修复并评审**：实体/页面集/页面 ID 改为“已有保留；raw id 仅全局未占用时接受，否则生成全局唯一 ID”，并每次确定 ID 后无条件登记 used（同一 payload 重复 raw id 的后续对象换新）；默认页面集不再用 `ps-<hash(sceneKey)>`；`writeEntities`/`writePageSets`（含回滚/取消恢复）事务化；U6 变更单 caveat 已补。新增 8 项冲突测试 + 1 项 caveat 测试；后端 131/131（基线 122）、冒烟 5 支、前端 69/69 回归通过。见「设计 ID 跨应用冲突修复完成」 |
| 真实模型 E2E（2026-11-12） | ✅ 临时 data/projects + 真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash`：需求 5 场景/5 Epic/15 Story、实体 10、页面集 5/页面 20、交接包 **large**（stories/pages/textBytes 三阈值全命中，6 阶段）、开发会话 v1（模型读 00-README/04-PLAN 后回复）；0 console/API 错误。观察：确定性页面集主实体匹配偏差（P2）已于 2026-11-12 修复并加测（见 P2 行） |
| P2 页面集主实体匹配 | ✅ 2026-11-12 **已修复并评审**：Epic → 主实体按**严格字典序**——`storyHits` desc → `epicHit` desc → `sceneHit` desc → `textScore`（title×10 + text）desc → 实体顺序（稳定排序）；不再用加权和，Story 引用必然优先且不受实体名长度影响；无引用时排序键退化为 `textScore`，与旧逻辑完全一致；不改 AI 页面集/页面规格/UI/API/DB。真实错位（EPIC-001「图书档案管理」→ 借阅记录）纠正为「书目」；新增 5 项测试（含 32 字符长名称 + 文本分 >1000 的字典序回归）；后端 136/136（基线 131）、5 支冒烟、前端 69/69/typecheck/build/check:vue 通过；**真实数据回放通过（不调模型）**：EPIC-001 书目 / EPIC-002 读者 / EPIC-003·004 借阅记录 / EPIC-005 罚款单。见「页面集主实体匹配修复完成」 |
| U7 分阶段开发（U7-1 后端） | ✅ 2026-11-12 完成并评审：按需生成阶段（`app_dev_phases` + `app_sessions.dev_phase_id` + `manifest.phases` key/kind/title/goal/scope）、`GET/POST /development/phases`（generate/start/complete/skip/reopen）、phase brief、模型摘要 + fallback（只读 `design`/`req` agent，全链路 `scrubText` 脱敏；可注入；单测不调模型）、会话/开发状态/会话列表 phase 字段、prompt 自动 in_progress、删除应用清理；后端 145 测试（基线 136）、`smoke:dev-phases`（真实 opencode 2.2.5，不调模型）+ 7 支回归冒烟、前端 69/69/typecheck/build/check:vue 通过；不做门禁/不自动发送/不自动完成。设计 `docs/plans/2026-11-12-u7-phased-development-design.md`；交接单 `docs/plans/2026-11-12-u7-1-implementation-brief.md` |
| U7 分阶段开发（U7-2 前端） | ✅ 2026-11-12 完成并评审：`phase-labels.js` 纯逻辑 + 单测 9 项；`DevPhase*` 类型/API、`PhaseBar.vue`/`PhaseDialog.vue`、DevView“按阶段开发”入口/开始卡片阶段快捷列表/阶段条/弹窗/开始-完成-跳过-重新打开（二次确认、409 提示、不自动发送/不自动完成）、右侧“阶段”行、`SessionList` 阶段 chip、只读/历史只读禁用 + 原因；`--rg-*` token、1024/768 换行、≤820 弹窗堆叠 + 内部滚动。前端 78/78（基线 69，+9）、typecheck/build/check:vue、后端 145/145（未改后端）；Playwright 临时目录 + 真实 opencode 2.2.5（不调模型）功能流程 + 浅/深 × 1440/1024/768 **73 张截图，0 console/page error、0 意外 API>=400、0 深色白底、0 横向溢出**。U7-3 已于 2026-11-12 验证通过（见「U7-3 真实模型全链路验证」）；见「U7-2 完成」与 `docs/plans/2026-11-12-u7-2-implementation-brief.md` §8 |
| 需求/原型阻塞修复（#4/#5/#1.1/#1.2/#2） | ✅ 2026-11-12 完成（待评审）：原型截图/导出统一 `captureFromAnyView`（图片视图临时切 html、等画布可用后截图再恢复视图），空状态/顶部/导出三路均可用且失败有明确提示；`readinessOf` 缺原型截图 warning + 原型 Tab 常驻提示条（截图后减少/消失，不放松交接包 PNG 校验）；Epic 目标 textarea（2—6 行）；prompt/归一化/校验新增 goal 与顶层 stories 规则、Epic 内嵌 stories 展开 + 去重（标题按 Epic 范围、raw id 全局）+ `epic-no-story` warning + 行内提示；场景与 Epic 非 1:1 说明。后端 149 测试（基线 145，含复核修复）、前端 79（基线 78）、typecheck/build/check:vue、Playwright 临时数据（4 截图场景 + 提示条 + 交接包 preview 无 PNG issue + 多行目标 + 浅/深×1440/1024/768 共 20 张，0 console/page/API 错误、0 横向溢出、0 深色白底）通过；**UX 补充（2026-11-13）**：设计变更同步弹窗新增“同步 ≠ 确认设计”引导、按钮改「同步输入（保留设计）/同步并重置受影响项」、成功提示引导点「确认设计」，临时 Playwright 复核（stale→同步→确认设计，0 错误，前端 87/87）通过；见「需求/原型阻塞修复」 |
| ER 图专业化改造（#3） | ✅ 2026-11-12 完成（待评审）：新增 `er-layout.js` 纯布局（表卡片 240 宽/动态高度/字段 ≤12 + `+N`；连通分量 + BFS 分层 + 循环/自引用/多组件/无关系网格；相邻层贝塞尔、同层上下锚点+穿卡退化、跨层顶部正交通道、自环）；重写 `ErGraph.vue` 为专业表卡片图（表名/实体名/状态、PK/FK/*/U、SQL 类型、FK 目标、基数+关系名标签、图例、缩放 75/100/125、点击/Enter/Space、空状态、`--rg-*` token/深浅色/1024/768 内部滚动）；新增 8 项纯逻辑测试；前端 **87/87**（基线 79）、typecheck/build/check:vue、后端 build + **149/149**（未改后端）；Playwright 临时数据（5 实体/5 关系含 1:1/1:N/N:1/自引用/15 字段）66 断言 + **13 张截图**，0 console/page/API 错误、0 横向溢出、0 深色白底。见「ER 图专业化改造（#3）完成」与 `docs/plans/2026-11-12-er-graph-redesign-brief.md` §6 |
| U7-3 真实模型全链路 | ✅ 2026-11-12 验证通过（临时数据；`packycode-deepseek/deepseek-flash` + 真实 opencode 2.2.5）：需求真实模型 7 场景/5 Epic/17 Story（无确定性补齐）→ 实体 8（真实模型）→ 页面集 5/页面 22/PNG 22 → 交接包 **large**（三阈值全命中，118212B，6 阶段）→ 生成 6 阶段 → 阶段 1 完成 **`summarySource='model'`**（486 字/7 行/5.1s，会话不归档）→ 阶段 2 开始（阶段 1 归档、brief 带上一阶段摘要）→ 移走 design/req + 重启 opencode 后完成阶段 2 **`summarySource='fallback'`** + warning（摘要=最后 assistant，仍 completed、不归档）→ 跳过 3/重开 1/归档只读/恢复；应用保持 `development`；**0 console/page error、0 意外 API>=400**；23 张截图 + `summary.json`/`p2.json`。见「U7-3 真实模型全链路验证」 |
| R2c 设计版本策略 | ✅ 2026-11-11 完成：自动保存不产版本；确认设计/模板切换/AI 生成/同步设计输入/版本回滚/变更取消恢复/手动保存为来源化版本；确认设计必产 `confirm` 版本供 C1 基线/取消恢复；`POST /design/versions` 手动保存（confirmed 409）；版本列表/详情 `changeSetSeq/changeSetTitle`；版本弹窗来源标签/变更单号/保存版本/截图提示；compact toast 文案修正；后端 126 测试、前端 63 测试、typecheck/build/check:vue、`smoke:design` 扩展 + 5 项回归、Playwright（API 预置）通过；主会话评审见「R2c 评审」（可验收，观察项不阻塞） |
| R4a 安全清理 | ✅ 2026-11-11 完成：删除 `legacy/`（`backend-dev/`、`frontend-dev-ui/`）、未挂载的 `frontend/src/requirements/DesignPending.vue`、未注册的 `design/routes.ts#designErrorHandler`、零引用死导出（apps/changesets/design/handoff/requirements）；修正 `DesignHandoffDialog` 的 `props.mode` “初始开发” chip；无行为/接口/数据库/交接包变更；后端 126 测试、前端 63 测试、typecheck/build/check:vue、`smoke:design`/`design-handoff`/`handoff-input`/`change-set`/`requirements`/`dev-sessions`/`dev-health` 回归通过；主会话评审见「R4a 评审」（可验收） |
| R4b-1 前端 shared 抽取 | ✅ 2026-11-11 完成：`theme.css`/`pinia`/`storage`/`app-context`/`protocol-output` → `src/shared/`；模型设置 → `src/settings/`；原型线框 + `spec/types` → `src/design/prototype/`（含渲染所需类型裁剪）；删除整个 `src/requirements-grooming/`、`workbench/HandoffDialog.vue`（旧 P3）、`e2e-flow.ts`，以及未用的 `ajv`/`monaco-editor` 依赖与 monaco 构建 chunk；`App.vue`/`AppShell`/`HomeShell`/`workbench/api.ts` 收敛为 doc/design/dev 单模式（移除 `MainApp`/`docMode`/`ui.activeView`/structured 统计与旧 Handoff 类型）；未改后端/接口/数据库/应用登记；后端 126 测试（基线）、前端 63 测试、typecheck/build/check:vue、临时数据目录 Playwright（首页/需求文档/设计原型 wireframe/开发页/变更历史/模型设置，0 console error / 0 意外 API>=400）通过；主会话评审见「R4b-1 评审」（可验收） |
| R4b-2 后端 structured 移除 | ✅ 2026-11-11 完成：删除旧 P3 交接包/`smoke:handoff`、`/api/workspace`、`/api/modules/*`、`/api/settings/*`、`/api/agents/*`、旧 agents/spec 对话、`requirements_mode` 全部分支与列；drop `modules`/`module_docs`/`handoffs` + 清理旧全局设置键；apps 创建/详情/删除收敛为文档模式；旧应用 `quarterly-reporting`/`app1` 已备份到仓库外并删除（MySQL demo 行未动，R4c）。后端 113 测试、前端 63 测试、typecheck/build/check:vue、8 支冒烟（含真实 opencode）+ 临时目录 Playwright 通过；真实 DB `apps` 空、无旧表、`projects/` 空；主会话评审见「R4b-2 评审」（可验收） |
| 测试修复 | ✅ I-01 首页 opencode 自动探测；I-02 创建应用格式提示；I-03 模型默认跟随 CLI；I-04 协议 JSON 尾随分隔符解析；I-07 设计阶段 constraints 形状归一化（详见 `docs/test-issues-2026-11-09.md`） |
| R4c 收尾（MySQL SQL/依赖/文档） | ✅ 2026-11-11 完成：`docs/ops/cleanup-demo.sql`（4 行 demo 清理，工作台不连库、由用户执行）；移除 `@element-plus/icons-vue`（前端直接依赖）与 `ai-dev-workbench: file:..`（backend/frontend 的 package.json + lock + junction），根 `concurrently` 保留；安装脚本改为在各自包目录内执行（本机 npm `install --prefix` 会把根包写成 `file:..`）；后端 113 测试、前端 63 测试、typecheck/build/check:vue、根 build、`smoke:requirements`/`smoke:design-handoff` 通过；`apps` 空、`projects/` 空、无旧表；主会话评审见「R4c 评审」（可验收） |
| 视觉 V1（主题/深浅色/响应式） | ✅ 2026-11-11 完成：语义 token（surface-2/overlay/code/focus/scrollbar 等）+ Element Plus 深色变量 + `color-scheme`；`setTheme/toggleTheme`（localStorage → `prefers-color-scheme` → light）；AppShell/HomeShell 顶栏主题按钮 + SettingsDialog「外观」分段控件；HomeShell/AppShell/NewAppDialog/SettingsDialog/ChangeSetStart/History/DesignHandoff/VersionHistory/DesignVersions/MarkdownView token 化 + 1280/1024/768 响应式 + 弹窗内部滚动；前端 63 测试、typecheck/build/check:vue、Playwright（浅/深 × 1440/1024/768，0 console error / 0 意外 API>=400 / 0 白底 / 0 横向溢出）通过；主会话评审见「视觉 V1 评审」（可验收，V2/V3 后续） |
| 视觉 V2（需求文档 + 设计 Studio） | ✅ 2026-11-11 完成：需求文档（三栏→1024/768 对话+大纲抽屉、工具栏不溢出、章节卡/结构化大纲/气泡/建议卡/模板中心/版本/只读横幅）与设计 Studio（顶栏/Tab/实体表/ER SVG/页面原型/页面集树/覆盖度/同步/原型模板/交接包/版本）token 化 + 深浅色 + 响应式；原型线框保持“白纸”；前端 63 测试、typecheck/build/check:vue、Playwright（浅/深 × 1440/1024/768，共 120 张，0 console error / 0 意外 API>=400 / 0 深色白底 / 0 横向溢出）通过；主会话评审见「视觉 V2 评审」（可验收） |
| 视觉 V3（开发页 + 全量截图） | ✅ 2026-11-11 完成：开发页（DevView/SessionList/StepCard/ToolCard/PermissionCard/FormCard/Composer/健康度/右侧 aside）token 化 + 深浅色 + 1440/1280/1024/768 响应式（≤1024 会话栏与 aside 抽屉 + 遮罩 + Esc；≤768 单栏 + 顶栏两行 + Composer 贴底）；`theme.css` 新增 `--rg-terminal-*`/`--rg-diff-add-bg`/`--rg-diff-del-bg` + 深色开关圆点；前端 63 测试、typecheck/build/check:vue、全量截图 270 张（浅/深 × 1440/1280/1024/768，0 console/page error / 0 意外 API>=400 / 0 深色白底 / 0 横向溢出 / 弹窗均在视口内）+ 真实 opencode 功能回归通过；主会话评审见「视觉 V3 评审」（可验收，视觉 V1—V3 完成） |
| 依赖 | backend / frontend 已安装；前端含 `html2canvas`（原型 PNG 截图）；R4c 移除未用的 `@element-plus/icons-vue`（直接依赖）与 `ai-dev-workbench: file:..`，根 `concurrently` 保留 |
| 启动/停止脚本 | ✅ `start.cmd` / `stop.cmd`（Windows）、`start.sh` / `stop.sh`（Linux）：缺依赖自动安装、构建、后台启动、健康检查、按 PID/端口停止 |
| 开发/需求 UX 小改批（#1/#2/#4/#5） | ✅ 2026-11-13 完成（待评审，含主会话 must-fix）：开发 Composer 移入 timeline 并与 `.timeline-content` 对齐（1440/1280/1024/768 实测 0px）；Enter 发送 / Shift+Enter 换行 / Ctrl+Enter 兼容 + 输入法保护；开发首条提示（初次/重新生成/变更单/阶段 brief/新应用 `AGENTS.md`）加中文要求；需求阶段按 active 变更单预填标题/说明（**有历史也预填一次**、已有草稿不覆盖、同一变更单只预填一次、不自动发送）。#3 按用户确认不做，未改阶段条。后端 150/150、前端 96/96、typecheck/build/check:vue、临时 Playwright（10 张截图，0 console/page/API 错误、0 横向溢出）通过；真实 app1/data 未触碰。见「开发/需求 UX 小改批完成」 |
| 创建应用选模板 + 模板解析（#7） | ✅ 2026-11-13 完成（待评审）：`apps` 新列 `requirement_template_id`/`prototype_template_id`（ensureColumn，不建表不迁移）；`POST /apps` 可选两个模板（scaffold 前校验，非法/QA/不存在 400 且不建目录/登记）；首次需求文档/设计项目用应用默认（显式 > 应用默认 > 全局默认，已有对象保持，无效回退）；切换需求/原型模板同步应用默认；只读 `GET /api/apps/:id/templates`（文档 > 应用默认 > 全局默认；原型 设计项目 > 应用默认 > 全局默认；不创建文档/项目）；payload 返回解析后的模板 id/name/source（删除回退不 500）；NewAppDialog 两个下拉（默认内置、描述、联动提示、加载失败不阻塞）；后端 **157/157**（基线 150，+7）、前端 96/96、typecheck/build/check:vue、临时 Playwright（10+1 张截图，非默认/默认/切换/加载失败，0 console/page/API 错误、0 溢出、0 深色纯白）通过；真实 app1/3300 未触碰。见「创建应用选模板 + 模板解析（#7）完成」 |
| 模块化需求 + 设计（#6）设计稿 | ✅ 2026-11-13 已定稿（M2—M6 已完成并评审）：模块 = 完整 PRD + 完整设计（实体/页面原型），需求与设计模块一一对应；`app_modules`、需求/设计表 module_id、需求 bundle、应用级聚合交接包、Change Set 模块版本、模块阶段 + 模块内 Epic 阶段、按模块 stale、跨模块 FK 提示；M2 交接单 `docs/plans/2026-11-13-module-m2-implementation-brief.md` |
| RMP-1 首次模块规划 + 逐模块生成 | ✅ 2026-11-16 完成，主会话复核 must-fix 已修（MF1—MF7）：新应用首条实质需求走 `mode='doc-plan'` 只返回 `<<<MODULE_PLAN_JSON>>>` 建议；建议卡可编辑/增删/排序/suggestedEpics/依赖/覆盖/未分配/warnings/openIssues；应用后复用空默认模块（保留 ID/对话，更新标题/文档标题）+ 新建其余，逐模块 SSE 生成完整模板 PRD（draft/`ai` 版本，不自动确认，失败重试/取消）；「保持单模块」兜底；计划消息持久化/刷新恢复；刷新后可用「重新生成全部模块」恢复生成入口；生成中禁用 Composer；取消后部分完成时进度/卡片显示 `done/total` 与已取消，不误报“全部完成”；apply 在无原始需求时 fail-closed 409，不写半应用状态；生成 SSE 改用 `res.on('close')`，避免真实 Node/Express 下请求体完成后被误判断连。后端 **244/244**（基线 224 + 20）、前端 **138/138**（基线 128 + 10）、typecheck/build/check:vue、Playwright **80/80（本轮复验脚本）**（mock 规划/生成，临时数据/端口，0 console/page error、0 意外 API≥400、0 横向溢出，浅/深 × 1440/1280/1024/768）。**主会话真实模型 E2E 通过（临时应用，已删除）**：规划商品管理/订单管理 + order→product；逐模块生成两文档 13/13 节（6 场景/2 Epic/10 Story 与 5/2/6）、draft v2、无支付模块，8/8 断言。见「RMP-1 完成」及「RMP-1 复核 must-fix」 |
| RMP-2 随时 AI 重新规划模块 | ✅ 2026-11-16 完成并评审（含真实模型 E2E 通过）：需求文档头部「AI 规划模块」入口（仅 requirements、无 active Change Set、最终未确认；设计/开发/变更中禁用 + 路径提示）；`ModuleReplanDialog` 两步（指令 → 预览 diff/编辑/应用）；聚合当前全部未归档模块文档/Epics/Stories/scope（单章节 4k/模块 16k/总 80k 截断），`POST /requirements-modules/replan/preview` 只读（模型失败 502、客户端断开 abort、不写库）；`/replan/apply` 单事务 keep/rename/regenerate/create + 未匹配归档（内容/版本/对话保留、可恢复）+ confirmed 显式 `reopenConfirmed` 重开（文档 draft、清应用确认、同模块设计 draft）；`modulePlanApplied`(kind=replan)/`modulePlanSource` 复用 app_settings，不新增表；apply 不生成文档，前端只对 create/regenerate 调 `/generate`（`reason='replan'`，复用进度/重试/取消）；RMP-1 首次规划/生成主链路不变。后端 **256/256**（基线 244 + 12）、前端 **148/148**（基线 138 + 10）、typecheck/build/check:vue、Playwright **133/133 断言（含复核 must-fix MF-RMP2-1—4）**（真实临时 backend + mock 模型；入口门禁/预览 diff/映射/确认重开/keep·rename·regenerate·create·archive·恢复/失败重试/取消/旧建议卡 kind/首次规划门禁/服务端 errors/浅深×1440·1280·1024·768，0 console/page error、0 意外 API≥400、0 横向溢出）。**主会话真实模型 E2E 通过（临时应用，已删除）**：RMP-1 seed 商品/订单 v2 → AI 重规划 商品 keep / 订单 regenerate / 售后 create → 商品 v2 不变、订单 v3、售后首次解析失败→重试 v2（13/13、7 Story）；planKind=replan、3 模块、应用保持 requirements。见「RMP-2 完成」 |
| D-RMP 设计阶段模块树 + 按 Epic 生成 | ✅ 2026-11-16 完成并评审（含真实模型 E2E 通过）：设计页删除 `DesignModuleRail`，改为设计大纲树（模块根/当前模块展开；数据集共享实体 + Epics 页面集/Story 覆盖/状态 + 未归属）；点 Epic 过滤实体/页面集并聚焦设计对话；`POST /design/generate-epic` 每 Epic 两次模型调用（实体合并进模块共享池 + 页面集 primary 替换 + 页面按 Story），其它 Epic 数据不丢，每 Epic 一个 `ai` 版本，draft 不自动确认；模块根批量（勾选/进度/失败继续/重试/停止）；confirmed 目标显式 `reopenConfirmed` 重开，项目 confirmed/stale/out-of-scope 阻止；整模块生成/按场景生成保留为兜底。后端 **268/268**（基线 256 + 12）、前端 **155/155**（基线 148 + 7）、typecheck/build/check:vue、Playwright **138/138 断言（含 MF-DRMP-1—5）**（mock 模型；树/过滤/焦点/单批生成/重开/守卫/交接包/响应式深浅色，0 console/page/API 错误）。**主会话真实模型 E2E 通过（临时应用，已删除）**：需求商品/订单 2 模块确认进设计 → 商品 2 个 Epic → 2 实体/2 页面集/8 页（v3）；订单 1 个 Epic → 2 实体/1 页面集/5 页（v2）；共享实体合并、每 Epic 页面集、模块隔离、全 draft，15/15 断言。见「D-RMP 完成」 |

## 开发/需求 UX 小改批完成（2026-11-13）

交接单：`docs/plans/2026-11-13-dev-ux-batch-brief.md` §7。范围 #1/#2/#4/#5；**#3 按用户确认不做**，未改阶段条/阶段布局。

- **#1 Composer 对齐**：`Composer` 与 `readonly-bar` 移入 `main.timeline`；`Composer.vue` 新增 `.composer-inner`（`min(880px,100%)` 居中、横向 padding 与 `.timeline-scroll` 一致），与 `.timeline-content` 对齐；新增 `.timeline-main` 包裹滚动区与“回到最新”，避免按钮压住输入框。
- **#2 Enter 发送**：Enter 发送、Shift+Enter 换行、Ctrl/Cmd+Enter 兼容；`isComposing` / `keyCode 229` 不发送；空内容不发送；placeholder/hint 改为 `Enter 发送 · Shift+Enter 换行`。
- **#4 中文提示**：`DEFAULT_DEV_PROMPT`、`REGENERATED_DEV_PROMPT`、变更单 prompt、`buildPhasePrompt` 统一加 `请全程使用中文回复；思考/进度说明也使用中文。`；新应用 `AGENTS.md` 加 `- 所有回复与思考/进度说明使用中文。`（不改模型/agent 配置，不改已有 app1 文件）。
- **#5 变更单预填（主会话 must-fix 已修）**：`RequirementsDocView` 由 `activeChangeSet` 生成 `initialPrompt` + `prefillKey`（appId + 变更单 ID）；`DocChatPanel` 加载后按“非只读 + 草稿为空 + 未标记”预填，**已有历史对话也预填一次**；真正预填后才写 localStorage 标记（刷新/重挂载不重复）；已有非空草稿不覆盖且不标记（之后草稿为空仍可预填）；绝不自动发送；无 active / 初始开发 #1 不预填；设计阶段本批不预填。

验证：后端 **150/150**（基线 149，+1；must-fix 未改后端）、前端 **96/96**（基线 87，+9）、typecheck/build/check:vue、backend build 通过；临时目录 Playwright（`C:\Users\icecream\AppData\Local\Temp\opencode\dev-ux-batch\`，端口 3463 已释放）：#1/#2 路由 mock 下 1440/1280/1024/768 对齐误差 **0.00px**、无横向溢出，Enter/Shift+Enter/Ctrl+Enter/输入法/空白均符合预期，只读条在 timeline 内；#5 真实后端临时应用覆盖“无历史预填 / 有历史仍预填（must-fix 回归）/ 刷新不重复 / 草稿不覆盖且清空后可预填 / 无变更单不预填”，全部通过；**0 console/page/API 错误**，10 张截图。未调用真实模型；真实 app1/3300 未触碰。

## 创建应用选模板 + 模板解析（#7）完成（2026-11-13）

交接单：`docs/plans/2026-11-13-app-templates-brief.md` §7。范围：创建应用选需求/设计原型模板 + 应用级默认 + 模板解析；**不做 #8 原型预览、不做 #6 模块化**，未改需求/设计/交接包/Change Set 语义。

- **数据**：`apps.requirement_template_id` / `apps.prototype_template_id`（`ensureColumn`，旧应用 null；无新表/迁移）。
- **创建**：`POST /api/apps` 可选 `requirementTemplateId`（stage=requirements）/`prototypeTemplateId`（存在）；scaffold/写库前校验，非法/QA/不存在 → 400 且不创建目录/登记；未提供存 null。INSERT 写两列。
- **初始化**：`ensureRequirementDoc` 新文档显式 `templateId` > `apps.requirement_template_id`（有效）> 全局默认；已有文档保持 `doc.template_id`；`ensureDesignProject` 新项目用应用默认（无效回退默认），已有项目保持。`previewBaseline`（新建文档 AI 预览）同规则。
- **切换同步**：`switchDocTemplate` → `apps.requirement_template_id`；`switchProtoTemplate` → `apps.prototype_template_id`；原“切换回草稿/生成 template-change 版本”语义不变。
- **解析**：新增只读 `GET /api/apps/:id/templates` → `{ requirement, prototype, prototypeSource }`；需求：已有文档 → 文档模板 → 应用默认 → 全局默认；原型：设计项目 → 应用默认 → 全局默认；**不创建文档/设计项目**。payload 增加 `requirementTemplateId/Name`、`prototypeTemplateId/Name`、`prototypeTemplateSource`；模板删除/损坏回退默认、不 500。
- **前端**：`NewAppDialog` 打开时并行加载需求阶段模板 + 原型模板；两个下拉默认 `builtin-prd` / `builtin-prototype-enterprise`（不存在取第一项），显示名称/分类/描述；提示“设计原型模板也会用于需求阶段的粗略原型预览……同步更新”；加载失败提示“模板列表加载失败，将使用默认模板”且不阻塞创建；创建请求带所选 ID；token 防止关闭/重开竞态；`AppInfo`/`CreateAppInput` 类型补齐。
- **测试隔离**：`doc.test.ts`/`design/service.test.ts` 的 fresh 辅助重置新列（切换模板现在会同步应用默认，避免用例间耦合；非产品行为变更）。

验证：后端 **157/157**（基线 150，+7，`backend/src/apps/templates.test.ts` 覆盖创建写入/payload、默认/null、非默认初始化、非法/QA 400 不建目录、切换同步、解析优先级（含不创建文档/项目）、删除回退）；前端 96/96、typecheck/build/check:vue 通过。临时目录 Playwright（`C:\Users\icecream\AppData\Local\Temp\opencode\app-templates\`，端口 3464/4799 已释放，`OPENCODE_AUTO_START=false`，不调模型）：非默认内置模板（精简 PRD + 简洁后台）UI 创建 → payload/需求 badge/设计项目/解析来源一致；切到企业级后设计 header/解析/payload 跟随；默认选中与 API 未带模板（global-default）均覆盖；解析不创建文档/项目；模板列表 500 时提示且创建回退默认；**10+1 张截图，0 console/page/API 错误、0 横向溢出、0 深色纯白背景**。真实工作台 3300 仍运行、`projects/app1` 未修改。

未验证：真实 app1 旧行（null）在真实工作台中的 UI 表现（仅临时目录/单测覆盖 global-default）；私有模板删除后的 UI 完整流程；多标签页并发切换的“最后写入者”语义。见交接单 §7。

## 一键启动/停止脚本（2026-11-10）

- 新增根目录 `start.cmd`、`stop.cmd`（Windows 本地）与 `start.sh`、`stop.sh`（Linux 线上）。
- 启动流程：检查 node/npm → `node_modules` 缺失/不完整时自动安装（Linux 用 `npm ci --include=dev`）→ `npm run build` → 后台启动 `backend/dist/index.js`（由后端托管 `frontend/dist`）→ 轮询 `/api/health` 确认成功。
- 停止流程：按 `data/workbench.pid` 结束进程树（含 opencode serve）；PID 文件缺失/过期时按端口兜底。Linux 先 SIGTERM，10 秒未退出再强制结束；Windows 直接 `taskkill /T /F`。
- 端口读取 `backend/.env` 的 `PORT`（默认 3300）；日志 `data/logs/workbench.log`、`data/logs/workbench.error.log`；PID `data/workbench.pid`（均在 gitignore 的 `data/` 下）。
- `.cmd` 提示信息使用 ASCII，避免 Windows 控制台代码页把 UTF-8 批处理解析错位；`.sh` 保持 LF 换行。
- 修复过程中的两个坑：
  - `for /f` 捕获 PowerShell 启动命令的输出会让 cmd 一直等待（子进程继承管道），改为由 PowerShell 直接写 PID 文件。
  - `exit /b 1` 写在带后续命令的括号块里会丢失退出码，改为 `goto :exit1` 在块外退出。
- 验证（2026-11-10，本机 Windows / WSL）：
  - 删除 `frontend/node_modules` 后 `npm run build` 复现 `'vite' 不是内部或外部命令`；重新安装后构建通过（`vite v6.4.5`，24s）。
  - `start.cmd`：自动检查、构建、后台启动、`/api/health` 200、首页 200；PID 文件写入正确；重复执行返回 1 并提示已在运行。
  - `stop.cmd`：按 PID 结束进程树成功，端口释放、PID 文件删除；PID 文件缺失时按端口兜底成功；无进程时提示且返回 0。
  - `start.sh` / `stop.sh`：`bash -n` 通过；WSL Ubuntu 22.04 下 `stop.sh` 空跑正常。Linux 端到端（安装/构建/启动）未执行，首次上线需先确认 Node 20+、npm registry 与 `better-sqlite3` 预编译包/编译工具链。

### 2026-11-12 修复：PORT 读取/优先级（B1）+ 停止身份校验（B2）

- 只改脚本：`start.cmd`、`stop.cmd`、`stop.sh`，README 补一句端口优先级；未改后端/前端/接口/表/测试。
- **B1**：`.cmd` 读 `backend/.env` 改为 `for /f "usebackq ..."`（原缺 `usebackq` 导致 Windows 永远读不到 `PORT`）；优先级与 dotenv 一致——进程环境变量 `PORT` > `backend/.env` 的 `PORT` > `3300`（不再无条件 `set PORT=3300`）；去掉值两端空格与成对引号、支持 `export`/内联 `#` 注释、key 大小写敏感；端口必须为 1—65535 整数（拒绝前导零），`start.cmd` 在构建前报错退出 1，`stop.cmd` 只告警并禁用端口兜底、仍按 PID 文件停止。
- **B2**：`stop.cmd` 用 `Get-CimInstance Win32_Process` 校验 `node.exe` + 命令行含 `dist\index.js`；`stop.sh` 校验 `/proc/<pid>/cmdline` 含 `dist/index.js` 且 `readlink cwd` 为 `$ROOT/backend`（cwd 不可读则拒绝）。PID 文件路径与端口兜底都校验：PID 文件不符 → 告警 + 删过期 PID、不杀、继续兜底；端口兜底不符 → 告警 + `exit 1`、不杀。正常停止行为不变（Windows 整树 `taskkill /T /F`、Linux 先 TERM 后 KILL，opencode serve 一并退出）。
- 实测（Windows，最终脚本）：默认启动 0 / 健康 200 + 首页 200 + opencode 2.2.5 / 重复启动 1 / 停止 0 + 3300/4771 释放 + PID 删除 / 再次停止 0；`.env` `PORT=3459` → 打印并监听 3459、健康 200；`PORT=3460` 环境变量 → 3460；`.env`=3459 + 环境变量=3460 → 3460（环境变量优先）；`.env` `PORT=abc` → 启动 1（0.1s，未构建）且 `stop.cmd` 仍能按 PID 停止；dummy 占用 3462 → `stop.cmd` 1、提示非本工作台、dummy 存活；本工作台 3462 删掉 PID 文件后 `stop.cmd` 0（兜底可识别）；无关 node/非 node 进程写入 PID 文件 → 告警、不杀、PID 文件删除。
- Linux（WSL 22.04）：`bash -n` 均 0、`.sh` 仍 LF；`stop.sh` 拒绝 `sleep`/`python3 http.server`（rc=0/1、进程存活），对 `node ... dist/index.js` + `backend` cwd 的 stub 正常停止（rc=0）。**真实 Linux 工作台启停未执行**；M1/M2/M3/M4/O1/O3 未修。
- 详见 `docs/plans/2026-11-12-start-stop-script-verification.md`「9. 修复结果（2026-11-12）」。

## P0 完成内容（2026-11-09）

- 旧开发模块移入 `legacy/backend-dev/`、`legacy/frontend-dev-ui/`（R4a 已删除），不再挂载 `/api/dev`、旧 dev server 代理与 WebSocket 透传；前端移除“开发”页签。
- `backend/src/config.ts`：`PORT`、`RG_DATA_DIR`、`RG_PROJECTS_DIR`、`OPENCODE_BIN`、`OPENCODE_PORT`、默认模型/超时/事件缓冲。
- `OpencodeRuntime`（`backend/src/opencode/`）：serve 生命周期、模型/agent、会话、prompt、消息、中断、权限/表单、SSE 过滤、密码捕获、脱敏。
- `/api/health`、`/api/apps`、`/api/opencode/*`；前端首页骨架 + `#/workspace`（P1 起改为应用工作区）。
- serve 子进程不继承 `RG_*` / `LLM_*` / `WORKBENCH_*` / `WB_*` / `PORT`；模型响应剔除 `settings.apiKey`。
- Windows 下把 `opencode.cmd` shim 解析为真实 `opencode.exe`；pid 文件清理残留 serve，不误杀另一个工作台实例。

P0 详细验证记录保留在本文件“验证记录”与下文中。

## P1 完成内容（2026-11-09）

### P1-1 应用表与 API

- `apps`、`app_stage_events` 表；`modules.app_id` 迁移（旧库自动补列 + 索引）。
- API：
  - `GET /api/apps`、`POST /api/apps`、`GET /api/apps/:id`
  - `DELETE /api/apps/:id?confirm=true`（只删本地目录/登记，不处理远端）
- 应用 ID 规则：小写字母/数字/短横线，保留值 `default` 拒绝。
- 创建成功后目录、DB 行、阶段事件一致；失败会清理半成品目录。

### P1-2 应用目录与 EOS 模板渲染

- `backend/src/apps/scaffold.ts`：
  - `templates/eos-app` → `projects/<app-id>/backend/`；
  - 生成 `docs/handoff/`、`.opencode/agents/`、`AGENTS.md`、`README.md`；
  - 替换 `{{APP_ID}}`、`{{APP_NAME}}`、`{{PORT}}`、`{{EOS_SYS_KEY}}`、DB/邮件占位符；
  - 未提供的敏感项写显式 `CHANGE_ME`；
  - 按字节替换以兼容 GBK 模板，渲染后把 Markdown 转 UTF-8；XML 文件的值做实体转义（`&` → `&amp;` 等）；
  - 模板 README 的“占位符”章节替换为“创建时已完成渲染”，避免残留 `{{...}}`。
- 高级配置（EOS sys-key/DB/邮件）只用于渲染文件，**不写入工作台数据库**；`projects/` 已 gitignore。

### P1-3 应用级 workspace

- API：
  - `GET/PUT /api/apps/:id/workspace`
  - `GET/PUT /api/apps/:id/modules/:mid/doc`
  - `DELETE /api/apps/:id/modules/:mid`
  - `GET/PUT /api/apps/:id/conversation`
- 模块按 `app_id` 隔离；场景/激活指针/批次存 `app.<id>.scenes|activeId|batches`；会话存 `app.<id>.conversation`。
- 文档 PUT 校验模块归属；模块 ID 被其他应用占用时返回 409。
- 前端 `workspace-persist.ts` 在加载前设置 `activeAppId`，所有 workspace/doc 请求自动带 `/apps/:id` 前缀；切换应用强制整页刷新，避免内存数据串应用。
- 旧全局 `/api/workspace`、`/api/modules/*` 只读写 `app_id='default'`，不会再删除/读取其他应用的数据。
- 模块已存在但文档未写入时返回 `200 {}`，避免前端水合出现 404 噪音。

### P1-4 三阶段与确认

- 状态：`requirements → design → development → completed`。
- `POST /api/apps/:id/stage/confirm {stage}`：
  - 需求：至少 1 个需求点；每个点已确认，且有目标/角色/验收要点；返回具体 issues。
  - 设计：要求需求已完成；P1 当时只切换阶段，P3 已改为先校验/生成交接包再解锁开发。
  - 幂等：已确认阶段再次提交返回当前应用。
- `POST /api/apps/:id/complete`：仅开发阶段可确认完成；记录 `completed_at`。
- 前端 `AppShell.vue`：
  - 顶部阶段栏（完成/当前/锁定）；
  - 完成前确认弹窗，完成后询问“进入下一阶段 / 稍后”；
  - 锁定阶段点击提示；开发阶段占位页说明 P3/P4 接入点；
  - `MainApp` 支持 `embedded`：隐藏旧顶栏/批次栏/状态栏，由应用阶段栏控制需求/设计视图。

### P1-5 首页与应用创建

- `HomeShell.vue`：应用列表（名称/ID/状态/需求点统计/更新时间）、空状态、运行时状态。
- `NewAppDialog.vue`：应用 ID、名称、描述、端口；高级折叠（EOS sys-key、DB、邮件）；错误提示。
- 创建成功直接进入 `#/apps/<id>/requirements`。
- 应用路由：`#/apps/<id>/requirements|design|development`；`#/` 为应用列表。

## P2 完成内容（2026-11-09）

### P2-1 req / design agent

- 应用创建时写入 `projects/<id>/.opencode/agents/req.md`、`design.md`（已存在不覆盖，允许用户自定义）。
- 2.2.5 schema 实测：`mode: primary` + `tools: { bash/edit/write/read/grep/glob/list/patch/webfetch/websearch/todowrite/task/question/skill: false }` 会生成 deny 权限。
- 实测 `/api/opencode/agents`：req/design 均为 primary，deny 覆盖 shell/edit/read/grep/glob/list/webfetch/websearch/todowrite/subagent/question/skill/browser。
- `OpencodeRuntime.ensureAgent(dir, agent)`：首次对话前确认 agent 已加载；未加载时调用 `/api/location/reload` 后重试一次。

### P2-2 短暂会话聊天 API

- `POST /api/apps/:id/chat`：`{ stage, messages }` → 短暂 opencode 会话 + prompt + SSE。
  - agent：requirements → `req`，design → `design`。
  - prompt：系统指令 + 历史 + 本轮输入；每轮重新注入最新 Spec 上下文。
  - SSE：`{type:'meta'}`（sessionID/agent/model）、`{type:'delta'}`、`{type:'done'}`、`{type:'error'}`。
  - 客户端断开 → interrupt + 删除会话；结束/失败也删除会话；5 分钟心跳；10 分钟超时。
- 模型解析：请求显式模型 → `app.<id>.model.<stage>` → opencode 默认模型。
- `GET/PUT /api/apps/:id/model`：读取/保存当前阶段模型（PUT 校验模型存在于 `/api/opencode/models`）。
- `OpencodeRuntime.generateText()`：短暂会话 + prompt + 收集文本 + 删除会话，供任务类调用。

### P2-3 前端聊天与模型选择

- `llm/client.ts`：新增 `opencodeChat()`；保留 `streamChat()` 作为兼容入口，全部调用方（对话、testgen、layout、卡片补全等）自动切到 opencode。
- 按 hash 判断阶段：`#/apps/<id>/design` → design agent，其余 → req agent。
- 保留 `<<<SPEC_JSON>>>` 解析、diff 卡、撤销、actions、重试逻辑（未改协议层）。
- `SettingsDialog.vue` 改为“模型设置”：列出 opencode 模型、按“应用 + 阶段”保存；不再有 API 地址/Key。
- `AppShell` 顶栏增加“模型”入口；阶段切换会刷新应用状态（避免状态栏滞后）。

### P2-4 任务迁移与移除第二套 LLM 配置

- `agents/llm.ts`：`chatJson()` 改为 `OpencodeRuntime.generateText()`；JSON 提取/重试逻辑保留。
- `agents/decompose.ts`：按 `appId` 读取应用模块/场景/批次，使用应用目录 + req agent + 应用模型。
- 前端任务提交携带 `appId`；testgen/layout 通过 `streamChat` 自动走 opencode。
- 删除 `backend/src/llm.ts`、`/api/llm` 路由、`/api/settings/llm` 与 `app_settings.llm`（启动时清理旧配置，可能含旧 Key）。
- `backend/.env.example` 移除 `LLM_*`。

## P3 完成内容（2026-11-09）

### P3-1 交接包 bundle 加载与校验

- `backend/src/handoff/bundle.ts`：
  - 按 appId 读取 `apps`、`modules`、`module_docs`、`app_settings` 中的场景/需求点卡片/Spec/测试用例；
  - 只导出已确认需求点卡片 + 已确认设计项；草稿/未确认项进入 `openRequirements`、`openDesignItems`、`unconfirmedTestCases`，不混入正式文档；
  - 稳定编号：`FEAT/ENT/PAGE/API/FLOW/RULE/TRIGGER/DICT/INT/FN/NFR/NAV/TC`，按场景与创建顺序生成；
  - 支持 `moduleId:entityId` 跨需求点引用；所有引用解析为业务名称/稳定编号，不把内部 ID 写进文档；
  - 汇总未澄清问题、已澄清问题、术语表、生成提示。
- `backend/src/handoff/validate.ts`：
  - 至少 1 个已确认需求点；每个已导出需求点必须有业务目标 + 验收标准；
  - 页面→实体/字段、实体关系/`ref` 字段、权限→角色、服务→实体、规则→实体/字段、页面导航→页面的引用完整性；
  - 已确认测试用例必须有步骤 + 预期结果；
  - 校验失败返回具体 `issues`，不生成。
- 说明：未确认项本身不阻塞生成（按设计单列）；但“已确认项引用未确认/不存在目标”会阻塞，避免交接包自相矛盾。

### P3-2 4 份 Markdown + 可选 DDL

- `backend/src/handoff/render.ts`：确定性渲染，不调用模型。
  - `00-README.md`：目标、范围/不做什么、技术栈、文件清单、阅读顺序、完成定义、开发前注意；
  - `01-REQUIREMENTS.md`：业务目标、角色、需求点清单/详情、验收标准、术语表、待澄清/未确认/已澄清问题；
  - `02-DESIGN.md`：实体字段/关系 + Mermaid ER、字典、服务、页面、页面导航、流程、角色权限、规则/触发器、集成、前端函数、NFR、未确认设计项、设计约束；
  - `03-PLAN.md`：建议顺序、分需求点实施清单、测试清单、验收清单、风险、交付格式；
  - `schema.sql`：仅当存在已确认实体时生成；表/列使用稳定编号，关系以注释表达，不生成虚构外键。
- 不生成 OpenAPI：Spec 没有确定性的 HTTP 路径/方法信息，避免虚构契约；`02-DESIGN.md` 已注明以服务/页面需求为准。
- 文档内不出现工作台内部 ID；单测扫描 `mod-a`、页面/角色/服务内部 ID、`tc-*` 等均不存在。

### P3-3 preview / generate / read 与写盘

- `backend/src/handoff/service.ts` / `routes.ts`：
  - `POST /api/apps/:id/handoff/preview`：校验 + 渲染，不写盘；
  - `POST /api/apps/:id/handoff/generate`：写 `projects/<app>/docs/handoff/`，版本递增，SHA-256 记录整体/单文件 hash；
  - `GET /api/apps/:id/handoff`：返回版本/hash/目录/文件清单 + 内容；文件被外部删除时返回 `missing:true`；
  - 重新生成时清理上次产生但本次不再产生的可选文件（如无实体后的 `schema.sql`）。
- `db.ts` 新增 `handoffs` 表：`app_id` 主键、`version`、`hash`、`docs_dir`、`files_json`、`source_spec`、`created_at`；`apps.handoff_hash` 同步更新。
- `source_spec` 保存生成时的需求点卡片/场景/Spec 快照，便于审计。
- 应用详情返回 `handoff` 摘要；应用删除同时清理 `handoffs` 行（修复重建同名应用读到旧交接包的问题）。

### P3-4 设计完成接入与 UI

- `POST /api/apps/:id/stage/confirm {stage:'design'}`：
  - 先校验/生成交接包；失败返回 400 + `issues`/`warnings`，**不切换阶段**；
  - 成功后写盘、记录版本/hash，再切换 `development` 并记录阶段事件；
  - 幂等：已确认设计再次调用返回当前应用与交接包摘要。
- 前端 `HandoffDialog.vue`：版本/hash/生成时间/目录、预览（不写盘）、生成、文件列表、内容预览、单文件下载、校验问题/提示展示；预览状态明确标记未写盘。
- `AppShell.vue`：需求完成后顶栏显示“交接包”；完成设计文案改为“先校验并生成交接包，再解锁开发”；开发占位页展示交接包版本/hash/时间。
- 修复弹窗层级：交接包弹窗 `z-index` 低于 Element Plus 弹层，生成确认框可正常点击。
- 修复 `:disabled` 绑定空字符串被 Vue 当作 true 导致按钮一直禁用的问题（改为 `busy !== ''`）。

## P4 完成内容（2026-11-09）

### P4-1 开发会话 API

- `backend/src/db.ts`：新增 `app_sessions`（active/archived/stale、opencode 会话 ID、provider/model、时间戳）；应用删除同步清理。
- `backend/src/dev/service.ts`：
  - 一个应用一个 active 开发会话；`POST /development/session` 创建/恢复，`{new:true}` 归档旧会话并新建；
  - 要求设计已确认且 `docs/handoff/00-README.md` 存在，否则 409；
  - 使用 opencode 原生 `build` agent；模型取 `app.<id>.model.development` → opencode 默认；
  - `GET /development` 返回会话元数据 + 归一化时间线 + pending 权限/表单；
  - `POST prompt` 发送；应用 completed 时先恢复 `development` 再发送；
  - `POST interrupt`、权限/表单回复、`DELETE session` 归档；
  - opencode serve 重启、工作台后端重启后均按 `opencode_session_id` 恢复同一会话（P4/P5 已实测）。
- `backend/src/dev/timeline.ts`：
  - 把 opencode 消息归一化为用户/assistant 文本、工具卡、按阶段聚合的步骤；
  - 输出裁剪/脱敏（文本、目标、输入、diff、shell 输出），限制消息/步骤/字符数；
  - 工具 diff（write/edit）、shell exit、错误、耗时、token/tool 统计。
- `backend/src/dev/routes.ts`：
  - `GET /api/apps/:id/development`；
  - `POST /api/apps/:id/development/session`、`DELETE .../session`；
  - `POST .../prompt`、`.../interrupt`；
  - `GET .../events`（SSE，按 opencode sessionID 过滤）；
  - `POST .../permission/:rid/reply`、`.../form/:fid/reply`。
- 模型接口扩展 `development` 阶段（`GET/PUT /api/apps/:id/model?stage=development`），agent 映射为 `build`。
- `POST /api/apps/:id/complete` 记录最后 opencode 会话 ID（阶段事件 detail）。

### P4-2 新开发页

- `frontend/src/dev/DevView.vue`：
  - 顶部：agent/model、连接状态、运行状态、新会话、交接包、确认完成；
  - 中间：用户/assistant 消息、阶段步骤、工具卡、diff、shell 输出、执行中状态、回到最新；
  - 右侧：会话信息、交接文档文件列表（点击定位预览）、文件变化（从工具事件提取）；
  - 底部 Composer：多行输入、Ctrl+Enter 发送、停止。
- `frontend/src/dev/ToolCard.vue` / `StepCard.vue`：工具目标/状态/耗时、diff 增删、shell 输出/exit、参数折叠。
- `frontend/src/dev/PermissionCard.vue` / `FormCard.vue`：内联权限/表单卡片，支持允许一次/始终允许/拒绝、表单字段与校验。
- `frontend/src/dev/Composer.vue`：发送/停止/快捷键。
- `frontend/src/dev/api.ts` / `types.ts`：开发 API 客户端、SSE 订阅、类型契约。
- `AppShell.vue`：开发阶段渲染 `DevView`；交接包入口支持指定文件；开发中生成交接包/完成后静默刷新应用状态，不卸载开发会话。
- `HandoffDialog.vue`：支持 `initialFile`，从开发页点击交接文档直接定位。
- `SettingsDialog` / 设置 store：模型阶段增加“开发”。

### P4-3 首条提示与完成

- 默认首条提示：`请阅读 docs/handoff/00-README.md，并按其中文档完成开发。完成后请总结：已实现需求、关键文件、如何运行、自测结果、未解决事项。`
- 开始开发时可编辑后发送；不注入批次/证据/Git/固定骨架等流程提示。
- 确认完成调用 `POST /api/apps/:id/complete`；完成后继续发送消息会把状态恢复为 `development`。

## P5 完成（2026-11-09）

### 真实应用

- 应用：`projects/quarterly-reporting/`（应用 ID `quarterly-reporting`），名称“季度经营报表”。
- 创建时使用用户提供的 MySQL 配置（host/port/db/user/password 只渲染到 `projects/`，未写入工作台数据库、未写入 tracked 文档）。
- 生成配置核对：
  - `backend/src/application.properties`：`server.port=8081`、`spring.application.name=quarterly-reporting`、`eos.application.sys-code=quarterly-reporting`；
  - `backend/src/META-INF/_srv/config/user-config.xml`：`Database-Type=MySql`、`DriverClass=com.mysql.cj.jdbc.Driver`（模板与 connector 8 使用 cj；用户配置中的旧 `com.mysql.jdbc.Driver` 未采用）、URL/用户名/密码已按用户提供值渲染（具体值不写入文档）；
  - 项目目录无 `{{...}}` 占位符残留。
- 需求/设计：基于现有 `quarterly_reporting_date`、`quarterly_reporting_business_atm` 表，写入一个已确认需求点“季度经营报表”和只读设计（季度列表、ATM 列表、ATM 详情、查询服务、权限、NFR、2 条测试用例）；已生成交接包 v1。
  - 说明：本轮需求/设计 Spec 是人工按现有表结构整理并确认的，没有重跑真实模型需求/设计聊天；真实 AI 协作已在 P2 验证。
- 开发：opencode 原生 `build` agent 真实会话完成实现，最终会话记录 119 条消息、29 个步骤、177 个工具调用；产物包括：
  - EOS 后端：`ReportingController`、`ReportQueryService`、`ReportingJdbcDao`、统一响应/异常、只读分页查询；
  - 前端：Vue3 + TypeScript + Vite，季度列表、ATM 指标列表、ATM 指标详情、状态面板、分页、指标卡；
  - 交接包映射：API-001/API-002、PAGE-001/002/003、FLOW-001、RULE-001、ENT-001/002。
- 后端测试：新增 `backend/test/java/.../ReportQueryServiceTest.java`，H2 MySQL 模式覆盖 SQL/字段映射/排序/分页/400/404/NULL；`mvn -o -B test` 10/10。
- 后端打包：`mvn -o -B package` BUILD SUCCESS。
- 前端：`npm run build`（vue-tsc + vite）通过。
- UI（mock API）Playwright：季度列表 → ATM 列表 → 详情 → 返回 → 空状态，全部通过；0 console error、0 API >=400。
- EOS 运行态（真实 MySQL）：
  - 首轮尝试因 MySQL 网络超时未监听；网络恢复后重试；
  - 本地启动参数：`SPRING_PROFILES_ACTIVE=none`、关闭 Nacos discovery/config、`EUREKA_CLIENT_ENABLED=false`、`SPRING_CLOUD_SERVICE_REGISTRY_AUTO_REGISTRATION_ENABLED=false`、`EOS_CACHE_MODE=map`、`SERVER_PORT=18081`；
  - EOS 已加载 license、EOS system service、MySQL datasource（c3p0 密码掩码）；
  - 真实接口：`/quarters`、`/atm-metrics` 返回 200；`pageNum=0`、`pageSize=500` 返回 400；不存在 ID 返回 404；
  - 前端 Vite（`VITE_API_TARGET=http://127.0.0.1:18081`）真实 MySQL 空状态 E2E：季度/ATM 空状态、详情 404 状态通过；0 意外 console/API 错误。
- MySQL 连通与数据：
  - `VERSION=5.7.38-log`，表包含 `eos_*`、`quarterly_reporting_*`；
  - `EOS_UNIQUE_TABLE` 存在且有 4 行；
  - 经用户确认，向 `quarterly_reporting_date` 写入 2 条 demo 季度行，向 `quarterly_reporting_business_atm` 写入 2 条 demo ATM 行（ID 前缀 `*-demo-*`）；未改表结构、未写其他表；
  - 真实非空接口：季度列表 2 条；ATM 列表 2 条；`dateId` 筛选 1 条；详情字段完整；
  - 真实非空前端 E2E：季度列表 → ATM 列表 → 详情 → 返回 → 季度筛选 → Q4 详情；0 console error、0 API >=400。
- 安全修正（P5 发现）：
  - 开发 agent 读取应用 `user-config.xml` 后，工具输出/推理里带出了真实 DB 密码；工作台 API/SSE 原本只做通用脱敏，未识别应用配置中的密码。
  - 已增加 `registerAppSecrets()`：从应用 `user-config.xml` / `application*.properties` / `bootstrap.properties` / `.env` 提取非占位密码/密钥（跳过注释、`CHANGE_ME`、`${...}`），只在内存注册到脱敏器；
  - 工具输出、工具输入、write/edit diff、assistant reasoning、消息 error、SSE 事件统一脱敏；
  - 新增 XML `<configValue key="...Password">`、`<password>`、properties/JSON `password=` 等模式；
  - 重新拉取开发会话 API 后，配置中的真实 DB 密码不再出现；真实开发页 body 检查也确认不泄露；
  - 单测覆盖 XML/properties 提取与 diff 脱敏。
- 真实开发页验证：工作台 DevView 打开运行中的真实会话（119 消息、29 步骤、177 工具），时间线/工具卡/步骤/文件变化/交接文档定位均正常；0 console error、0 API >=400；页面无 DB 密码。
- 用户确认完成：调用 `POST /api/apps/quarterly-reporting/complete`，状态 `completed`，`completedAt=2026-11-09T11:59:02.847Z`；阶段事件记录 `lastSessionId=ses_e403a9f19ffefewEw4f5h4M1Ia`；交接包仍为 v1（hash `5fa9a2e3…`）。

## R1 完成（2026-11-10）：需求阶段文档化

上游设计：`docs/plans/2026-11-10-requirements-stage-doc-design.md`（已定稿）、`docs/plans/2026-11-10-requirements-r1-implementation-brief.md`。本轮只做 R1 MVP；R2/R3 未做。

### R1-1 后端：表、模板与文档 API

- `backend/src/db.ts` 新增：
  - `requirement_templates`（模板，内置只读 + 我的模板）；
  - `app_requirement_docs`（一行/应用；`content_md` 为章节拼接快照）；
  - `app_requirement_doc_sections`（章节，唯一事实来源）；
  - `app_requirement_doc_versions`（整篇 + 章节版本快照）。
  - `apps.requirements_mode`：旧行迁移默认 `structured`，新应用写入 `doc`；应用详情返回 `requirementsMode` 与 `requirementDoc` 摘要。
- `backend/src/requirements/builtin-templates.ts` + `templates.ts`：
  - seed 4 个内置模板：工作台标准 PRD（13 节，默认）、精简 PRD（6 节）、业务策略（需求阶段可选）、QA/Test Plan（`stage=test`，需求阶段不可选）；
  - 内置模板只读（改/删返回 400）；复制生成“我的模板”，可编辑/删除；
  - 章节 key/标题/层级/类型/撰写提示/必填统一校验。
- 模板 API：`GET /api/requirement-templates?stage=&category=&q=&visibility=`、`GET/:id`、`POST`、`PUT/:id`、`DELETE/:id`、`POST/:id/duplicate`。
- `backend/src/requirements/doc.ts`：
  - 无文档时按模板创建空文档（13/6 节）并生成 v1 `template-change` 快照；
  - 章节保存、自动拼接 `content_md`、版本递增 + 快照；
  - 全文保存：`#` 为标题、`##` 为章节；`###` 仅在匹配已有三级章节时单独成节，否则留在正文；新标题生成 `custom-*`；
  - AI 应用复用 `PUT /requirements-doc` 的 `sections` 合并（`source=ai`）；
  - 切换模板按 key/标题保留内容，生成新版本，旧版本可回滚；
  - 确认校验：必填章节非空、至少 1 个 Epics/User Story；`待确认/待澄清/TODO` 只做 warnings；成功后文档 `confirmed`、应用切到 `design`；
  - 确认后文档只读：章节/全文/切换模板/回滚均 409；
  - 版本列表/详情/回滚、`01-REQUIREMENTS.md` 只读导出、doc 对话持久化。
- 文档 API（挂 `/api/apps/:id/requirements-doc`）：`GET /`、`PUT /sections/:key`、`PUT /`、`PUT /template`、`POST /confirm`、`GET /versions`、`GET /versions/:v`、`POST /versions/:v/rollback`、`GET /export`、`GET/PUT /chat`。
- chat doc 模式：`POST /api/apps/:id/chat` 支持 `mode:'doc'`、`templateId`、`focusSectionKey`；`backend/src/chat/doc-prompt.ts` 注入模板结构/撰写提示、当前文档（或聚焦章节 + 其他章节标题）、对话历史与 `<<<DOC_JSON>>>` 协议；仍走短暂 opencode 会话 + SSE。
- 阶段与删除：
  - `POST /api/apps/:id/stage/confirm {stage:'requirements'}` 在 doc 模式委托文档确认（返回 issues/warnings）；
  - doc 模式 `stage:'design'` 返回 409，明确“R3 未接入”，不会静默读旧卡片或生成交接包；
  - `DELETE /api/apps/:id?confirm=true` 增加清理需求文档/章节/版本。

### R1-2 前端：文档页、模板中心与删除入口

- `frontend/src/requirements/` 新增：
  - `api.ts`：模板/文档/版本/导出/doc 对话与 SSE 客户端；
  - `doc-protocol.js` + `doc-protocol.test.mjs`：`<<<DOC_JSON>>>` 解析（尾随分隔符/代码块/尾逗号）、章节合并、确认校验（纯 JS 单测）；
  - `RequirementsDocView.vue`：左侧对话，右侧模板 badge + 文档大纲 + 章节 Markdown 编辑器 + 工具栏 + 自动保存 + 预览/全文源码 + 版本 + 导出 + 确认需求；
  - `DocChatPanel.vue`：构建活动（已收到请求/已选择模板/文档已创建/待审核/可生成设计）、“接下来做什么”（缺失必填章节 + AI nextSteps）、章节焦点 chip、流式消息与停止；
  - `TemplateCenterDialog.vue`：需求/后续阶段分栏、搜索/分类、预览、使用模板、复制并编辑、新建/编辑/删除我的模板；
  - `VersionHistoryDialog.vue`：版本列表、预览/源码、回滚（确认后只读时禁用）；
  - `MarkdownView.vue`：markdown-it 渲染，禁用原始 HTML；
  - `DesignPending.vue`：doc 模式进入设计阶段时显示 R3 未接入说明 + 需求文档只读预览/导出。
- `AppShell.vue`：按 `requirementsMode` 渲染文档视图/设计待接入页；doc 模式隐藏顶栏重复确认与交接包入口；新增“删除应用”（二次确认）；文档确认后刷新并询问进入设计。
- `HomeShell.vue`：应用列表显示文档版本/状态/模板；新增删除应用入口（二次确认，删除后刷新列表）。
- `workbench/api.ts`：`requirementsMode`/`requirementDoc` 类型与 `deleteApp`。
- DOC_JSON 应用：R1 自动应用全文或章节合并并生成版本，显示“已应用 AI 修改（vX）”；`nextSteps` 落对话持久化，`openIssues.add` 追加到“待澄清问题”章节；AI diff/应用/忽略放 R2。

### R1-3 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 59/59（新增模板 seed/只读/复制、文档初始化/章节保存/确认校验/阶段切换/全文解析/AI 合并/模板切换/版本回滚/只读/导出/doc prompt） |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm test --prefix frontend` | ✅ 20/20（DOC_JSON 解析/尾随分隔符/归一化/章节合并/确认校验 + 既有协议 11 项） |
| `npm run smoke:requirements --prefix backend` | ✅ 真实 Express + 临时 SQLite/目录：模板 seed → 创建 doc 应用 → 文档初始化 → 章节/版本/回滚 → 模板切换 → 确认校验 400+issues → 导出 → 确认需求(design) → 设计 409(R3) → doc 对话 → 删除清理 |
| Playwright + 真实 opencode/模型 | ✅ 见下表 |

### R1-4 真实模型 / UI E2E（2026-11-10）

环境：临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`、端口 3406、独立 opencode serve 4792、`OPENCODE_DEFAULT_MODEL=packycode-deepseek/deepseek-flash`；前端由后端托管构建产物。测试应用 `r1-e2e`，真实模型生成后删除。

| 检查 | 结果 |
| --- | --- |
| 默认文档 | ✅ 进入需求阶段显示“工作台标准 PRD”、13 节大纲、草稿/v1 |
| 模板中心 | ✅ 切到“精简 PRD”(6 节) 再切回标准 PRD(13 节)，内容按标题保留、生成新版本 |
| 手动编辑 | ✅ 章节编辑器修改后自动保存，API 读回一致 |
| 首次真实模型生成 | ✅ `deepseek-flash` 返回 `DOC_JSON`，自动应用为文档 v5；13/13 章节有内容（`###` 子标题保留在章节正文，不再膨胀为顶层章节） |
| 章节“问 AI” | ✅ 焦点 chip 显示“目标与成功指标”，只改该章节（373→509 字符）；未出现解析失败/请求失败 |
| 确认需求 | ✅ 必填校验通过，文档 `confirmed`、应用进入 `design`；设计页显示 R3 未接入；交接包入口隐藏 |
| 删除应用 | ✅ 顶栏二次确认删除；首页无残留、`GET /api/apps/r1-e2e` 404 |
| 控制台/网络 | ✅ 0 console error、0 个 `/api` >=400 |
| 截图 | `C:\Users\icecream\AppData\Local\Temp\opencode\r1-e2e\01-doc-initial.png`、`02-design-pending.png`（临时目录） |

## D1—D4 评审（2026-11-10，主会话）

独立验证（未改代码）：

| 检查 | 结果 |
| --- | --- |
| `npm test --prefix backend` | ✅ 68/68（评审时；修复后 71/71） |
| `npm test --prefix frontend` | ✅ 27/27 |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ |
| `npm run smoke:design --prefix backend` | ✅ 模板/实体/页面集/快照/确认/模板切换/版本/删除全链路 |
| `npm run smoke:requirements --prefix backend` | ✅ R1 回归通过（实施会话已跑；本次未重复） |
| 真实模型 `smoke:design:ai` / Playwright E2E | 未重复跑；实施会话报告通过 |

评审发现（建议在 D5 前修复）：

1. **页面集按实体生成，不是按场景/Epic 生成（与共识不一致）**
   - `generateDefaultPageSets()` 用 `entities.map`，`sceneKey = entity:<id>`，页面集标题=实体名；
   - 用户要的是“订单管理 → 订单列表/创建/编辑/详情”这种场景/业务流程页面集；
   - AI 生成 prompt 写了场景/Epic，但默认路径仍是实体；建议改为从需求文档的 scenes/Epics 派生页面集，实体只作为页面绑定。
2. **页面集只含 list/form/detail，没有区分创建/编辑**
   - 模板有 `createAs/editAs`，但默认页面集只有单个 form；创建弹窗与编辑表单没有独立原型/页面规格；
   - 建议 form 页增加 `mode: create|edit|both`，或页面集默认生成 create-form/edit-form 两个页面（可配置）。
3. **设计确认后仍可编辑，状态会静默回 draft**
   - 前端确认后按钮未禁用；`saveEntities/savePage...` 会 `bumpVersion` 把 project.status 改回 draft；
   - 建议确认后只读，提供“重新编辑设计”二次确认；或明确提示“修改将取消确认”。
4. **HTML 快照按 text/html 同源提供，存在 XSS 风险**
   - `GET /api/apps/:id/design/pages/:pageId/html` 直接 `res.type('html')` 返回保存的 DOM outerHTML；
   - 建议加 `Content-Security-Policy: sandbox`、`X-Content-Type-Options: nosniff`，或改为 `text/plain`/附件下载，不作为可执行页面打开。
5. **PNG 快照未校验 PNG 魔数**
   - `savePageSnapshot` 只检查 base64/大小；任意字节可写成 `.png`；建议校验 PNG 签名。
6. **设计路由未校验应用阶段/模式**
   - 旧 structured 应用也能创建设计项目；虽然不做兼容，但建议 router 入口守卫，避免旧应用误用。
7. 已知限制：HTML 快照非独立可运行页面、版本增长快、AI 自动应用无 diff、模板编辑器不含可视化布局；与实施报告一致。

> 结论：D1—D4 可以作为阶段验收；但第 1、2 条直接影响“按场景/业务流程生成原型”的产品目标，建议在 D5/下一轮优先修。

### D1—D4 评审修复（2026-11-10，实施会话）

已按评审意见修复 1—6：

1. **页面集改为按场景/Epic 派生**
   - `generateDefaultPageSets()` 从已确认需求文档的 `scenes`（业务场景与流程）与 `epics` 章节提取 `###` 标题/加粗列表项，生成场景页面集；标题使用场景/Epic 名称，`sceneKey=scene:<hash>`。
   - 实体匹配按“标题权重优先 + 描述/表名辅助”选择主实体；页面集 `entityIds` 由页面绑定实体汇总，页面集可包含多个实体页面。
   - 找不到场景时回退为“实体名管理”页面集；旧 `entity:<id>` 页面集在生成时会按主实体迁移并保留 page id。
   - 创建/编辑表单是独立页面；内置模板新增 `pageSetRules.formModes=['create','edit']`，可在模板编辑器勾选创建/编辑表单。
2. **创建/编辑拆分**
   - `DesignPageSpec.mode` 支持 `create` / `edit` / `both`；默认页面集生成 `列表 / 创建表单 / 编辑表单 / 详情` 4 页，创建/编辑各自确认。
   - 页面规格编辑器新增“表单模式”；AI prompt 与 `DESIGN_JSON` 示例要求 form 页带 `mode`。
3. **确认后只读 + 重新编辑**
   - 新增 `POST /api/apps/:id/design/reopen`，把 `confirmed` 退回 `draft` 并记录阶段事件；
   - `saveEntities/savePageSets/savePage/template switch/generate/snapshot/rollback` 在 confirmed 时返回 409；
   - 前端确认后显示只读横幅、禁用编辑/确认/截图/模板切换/对话发送；顶栏按钮变为“重新编辑设计”，二次确认后恢复可写。
4. **HTML 快照 XSS 防护**
   - `GET /pages/:id/html` 改为 `text/plain; charset=utf-8` + `Content-Disposition: attachment` + `Content-Security-Policy: sandbox` + `X-Content-Type-Options: nosniff`，不再作为同源可执行页面打开。
5. **PNG 魔数校验**
   - `savePageSnapshot` 校验 PNG 8 字节签名，非 PNG 返回 400；空/超 16MB 仍拒绝。
6. **旧 structured 应用入口守卫**
   - 设计服务 `appOrThrow` 要求 `requirements_mode='doc'`，旧 structured 应用访问 `/design` 返回 409，不再创建/保存设计项目。

验证更新：
- 后端测试 71/71（新增场景派生、创建/编辑拆分、确认只读/重新编辑、旧 structured 守卫、PNG 魔数）；前端 27/27；typecheck/build 通过。
- `smoke:design` 更新为场景页面集 2 个 × 4 页、PNG 魔数、HTML 附件头、确认后 409、重新编辑后模板切换；通过。
- Playwright UI E2E 增加“确认后只读 → 重新编辑 → 再次确认”，通过；0 console error / 0 API >=400。
- 真实模型 `smoke:design:ai` 未在修复后重跑（上一轮已通过）；同一真实模型生成路径由本轮 Playwright UI E2E 覆盖（AI 生成实体/页面集）。



## D1—D4 完成（2026-11-10）：设计阶段实体 + 页面原型

上游方案：`docs/plans/2026-11-10-design-stage-entity-prototype.md`（已定稿并更新实施结果）、`docs/plans/2026-11-10-design-stage-implementation-brief.md`（D1—D4）。本轮不接交接包/开发（D5），不做旧设计面板兼容，不做图片生成模型、不自由拖拽。

### D1—D4 后端

- `backend/src/db.ts` 新增：
  - `prototype_templates`（原型模板全局库，内置只读 + 我的模板）；
  - `app_design_projects`（一行/应用：模板 id、draft/review/confirmed、version、来源需求文档版本）；
  - `app_design_entities`（应用级共享实体，字段/关系 JSON、状态、排序）；
  - `app_design_page_sets` / `app_design_pages`（页面集/页面规格/布局/确认/图片路径/hash/版本）；
  - `app_design_versions`（实体 + 页面集快照，支持回滚）。
- `backend/src/design/builtin-templates.ts` + `templates.ts`：
  - 内置“企业级专业管理（默认）”“简洁后台”两套模板，含 tokens/shell/patterns/页面集规则/提示词；
  - 全局库列表/新建/编辑/删除/复制；内置只读；被应用使用中的模板禁止删除。
- `backend/src/design/service.ts`：
  - 设计项目初始化（默认模板、读取已确认需求文档版本、v1 快照）；
  - 实体保存/校验：名称/表名/字段名唯一、类型合法、枚举选项、ref/关系目标存在、主键（id 或唯一字段）；名称→id 引用归一化；AI 常见 `[{name}]` 数组/中文动作标签归一化为字符串/标准动作；
  - 页面集：从需求文档场景/Epic 派生（无场景时按实体兜底），按模板规则生成列表/创建表单/编辑表单/详情；页面集/页面确认；切换模板保留 page id；按保存生成版本；页面集可引用多个实体（`entityIds`）；
  - AI 生成实体/页面集（`chatJson` + design agent + 应用模型）；设计确认 readiness（需求文档已确认 + 实体确认 + 页面集/页面确认 + 无阻塞）；确认只记录 `app_design_projects.status=confirmed` 与阶段事件，**不切换开发阶段**；
  - PNG 快照：base64 解码后写 `projects/<app>/docs/design/prototypes/*.png`，可选写 `.html`；DB 记录相对路径/hash；提供图片/HTML 读取；
  - 版本列表/详情/回滚；删除应用清理设计数据。
- `backend/src/design/prompt.ts`：设计对话 `<<<DESIGN_JSON>>>` 协议（entities/pageSets/nextSteps/openIssues/actions），注入需求文档、原型模板、当前实体/页面/焦点；实体/页面集一次性生成 prompt。
- `backend/src/design/routes.ts` / `template-routes.ts`：
  - 模板：`GET/POST/PUT/DELETE /api/prototype-templates`、`/:id/duplicate`；
  - 设计：`GET /api/apps/:id/design`、`PUT /template`、`PUT /entities`、`POST /generate-entities`、`POST /page-sets/generate`（default/ai）、`PUT /page-sets`、`PUT /page-sets/:id`、`PUT /pages/:id`、`POST /pages/:id/snapshot`、`GET /pages/:id/image|html`（HTML 以 text/plain 附件返回）、`POST /confirm`、`POST /reopen`、`GET /versions`、`GET /versions/:v`、`POST /versions/:v/rollback`、`GET/PUT /chat`。
- `backend/src/chat/service.ts`：`POST /api/apps/:id/chat` 支持 `mode:'design'` + `focus:{kind,id}`，SSE meta 标记 `mode:'design'`；设计 prompt 读取需求文档与当前设计。
- `backend/src/apps/routes.ts` / `db.ts` / `index.ts`：挂载设计路由和模板路由；应用详情返回 `designProject` 摘要；删除应用清理设计数据；doc 模式 `stage/confirm design` 返回 409，引导到 Design Studio。
- 冒烟脚本：`backend/scripts/design-smoke.ts`（`npm run smoke:design`）、`backend/scripts/design-ai-smoke.ts`（`npm run smoke:design:ai`）。
- 新增设计测试 `backend/src/design/service.test.ts`（12 项，含场景派生/创建编辑拆分/只读重开/结构化守卫/PNG 魔数）并纳入 `npm test --prefix backend`。

### D1—D4 前端

- `frontend/src/design/`：
  - `DesignStudio.vue`：左侧对话/构建活动，右侧“实体设计 / 页面原型”Tab；需求文档抽屉；设计状态/版本/阻塞提示；确认设计后只读，“重新编辑设计”二次确认；
  - `DesignChatPanel.vue`：流式对话、焦点 chip、构建活动、接下来做什么、`DESIGN_JSON` 应用/失败提示、对话持久化、确认后只读；
  - `EntityDesignTab.vue`：实体列表/字段表格/关系编辑/逐实体与全部确认/自动保存/AI 生成、确认后只读；
  - `ErGraph.vue`：SVG ER 图（实体节点 + 关系连线 + 选中高亮）；
  - `PrototypeTab.vue`：场景页面集/页面树、页面规格编辑器（含表单 mode）、模板中心入口、缩放、原型/图片视图、截图存档/导出 PNG、页面集确认、新增/删除页面、确认后只读；
  - `PrototypeCanvas.vue`：复用 `PrototypeRenderer`/`Wireframe*`，按模板 tokens/shell 注入皮肤，渲染 App Shell + 页面原型；
  - `PrototypeTemplateDialog.vue`：全局模板库、预览、使用中标记、使用/复制编辑/新建/编辑/删除，MVP 编辑器改 Token/Shell/页面模式/页面集规则（含创建/编辑表单）/提示词；
  - `DesignVersionsDialog.vue`：版本列表/详情/回滚；
  - `design-protocol.js` + `design-protocol.test.mjs`：`DESIGN_JSON` 解析、尾随分隔符/代码块/尾逗号、实体/页面集合并；
  - `design-skin.css`：企业级/简洁两套皮肤；
  - `snapshot.ts`：`html2canvas` 截图与下载。
- `AppShell.vue`：设计阶段统一挂载 `DesignStudio`，不再挂载旧设计面板/`DesignPending`；设计确认不在顶栏重复；交接包入口只在开发/完成阶段保留（doc 模式仍隐藏）。
- `workbench/api.ts`：`designProject` 类型。
- `frontend/package.json`：新增 `html2canvas` 依赖；前端测试脚本纳入 `design-protocol.test.mjs`。

### D1—D4 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 71/71（设计模板/项目/实体/页面集/场景派生/创建编辑拆分/只读重开/结构化守卫/对象数组归一化/PNG 魔数/快照/版本/确认/对话 12 项） |
| `npm test --prefix frontend` | ✅ 27/27（新增 DESIGN_JSON 解析/合并 7 项） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过（含 html2canvas） |
| `npm run smoke:design --prefix backend` | ✅ 真实 Express + 临时 SQLite：模板 seed → 创建应用 → 确认需求 → 设计初始化 → 保存实体 → 按场景生成页面集（列表/创建/编辑/详情）→ 页面规格 → PNG 魔数/快照/读取/HTML 附件头 → 设计确认 400/200（应用仍 design）→ 确认后 409 → 重新编辑 → 模板切换保留 page id → 版本 → 删除清理 |
| `npm run smoke:requirements --prefix backend` | ✅ R1 回归：文档/版本/模板/确认/旧 stage design 409（引导 Design Studio）/doc 对话/删除清理 |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整 |
| `npm run smoke:design:ai --prefix backend` | ✅（评审修复前上一轮）真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash`：AI 生成 2 实体、2 页面集、设计对话返回；本轮未重跑，AI 路径由 Playwright 真实模型 E2E 覆盖 |
| Playwright UI E2E（真实模型） | ✅ AI 生成实体 2 个 → AI 生成页面集 8 页 → 切换“简洁后台” → 截图存档显示图片 → 确认 2 个页面集 → 确认设计 → 确认后只读 → 重新编辑 → 再次确认；`design.status=confirmed`、`app.status=design`；0 console error、0 API >=400 |
| Playwright 补充 | ✅ ER 图 2 节点/2 连线；版本弹窗可查看 v7 详情；设计对话真实模型回复、openIssues 提示、对话持久化 3 条；0 console error / 0 API >=400 |

截图（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\d4-e2e`）：`01-design-studio.png`、`02-entities.png`、`03-prototypes.png`、`04-template-minimal.png`、`05-snapshot.png`、`06-pagesets-confirmed.png`、`07-design-confirmed.png`、`07b-reopen-confirmed.png`、`08-er-graph.png`、`09-versions.png`、`10-design-chat.png`。

### D1—D4 未验证 / 已知限制

- **D5 未接（历史）**：设计确认不生成交接包、不切换开发阶段；App 仍停留在 `design`，不能从本链路进入开发。**2026-11-11 D5 已补**，见「D5 完成」。
- **旧设计不兼容**：设计阶段统一进入新 Studio；旧 structured 应用被后端入口守卫拒绝（`requirements_mode='doc'` 才可访问），旧设计面板代码保留但不再挂载（R4 清理）。
- **原型模板编辑器 MVP**：只支持 Token/App Shell/页面模式/页面集规则（含创建/编辑表单）/提示词，不做可视化布局编辑器；移动端模板未内置（分类保留，后续）。
- **图片/HTML**：PNG 由浏览器 `html2canvas` 生成并校验 PNG 魔数；HTML 快照是 DOM `outerHTML`，未内联 CSS/资源，作为参考而非独立可运行页面；已改为 text/plain 附件下载 + sandbox CSP，不作为同源页面执行；未做服务端 Playwright 截图。
- **AI 产出质量**：真实模型可能生成英文实体名、只给部分动作/页面；后端已归一化对象数组与中文动作标签（新增/编辑/查看详情→create/edit/detail），但页面集结构仍建议人工复核。设计对话与 R1 一样是“自动应用”，无 diff/应用/忽略。
- **版本策略**：实体/页面保存会生成版本快照，版本数增长快，暂无压缩/清理；模板切换会保留 page id 与页面规格并回到 draft，但已确认的页面/页面集状态不会自动重置，需要人工复核后再次确认。
- **确认状态**：`app_design_projects.status=confirmed` 只记录设计确认；确认后设计只读，修改前必须走 `POST /design/reopen`（前端“重新编辑设计”）；`apps.status` 不变，`apps.design_confirmed_at`/交接包由 D5 生成交接包时写入。
- **页面规格**：字段/动作/列/查询/验收/批注/表单 mode 可编辑；未做自由拖拽 WYSIWYG、页面内元素级编辑；批注为页面级文本，不是 R1 文档批注锚点。
- **真实模型**：本轮使用 `packycode-deepseek/deepseek-flash`；opencode 默认免费模型仍可能 429。设计 AI 生成耗时实测约 9—14 秒/步（受模型与网络影响）。
- **环境**：UI E2E 使用临时 data/projects、端口 3412 + opencode 4412；未改真实 `Quarterly-reporting` 应用或真实 MySQL。

## H1—H4 完成（2026-11-11）：需求 → 设计交接

上游方案：`docs/plans/2026-11-10-requirements-to-design-handoff.md`（已定稿）、`docs/plans/2026-11-10-requirements-to-design-handoff-implementation-brief.md`。本轮只做 H1—H4；**不做 D5**、不做旧数据兼容、不硬阻塞 Story 覆盖。

### H1 需求结构化与稳定 ID

- `app_requirement_doc_sections.data_json`（旧库自动补列）：`scenes` 章节存 Scene、`epics` 章节存 Epic + Story；结构化数据是该章节权威，Markdown 由结构确定性渲染/导出。
- `backend/src/requirements/outline.ts`：
  - 类型：Scene / Epic / Story（标题、目标/描述、优先级、场景/Epic 归属、验收标准、archived）；
  - 稳定 ID：`SCENE-001 / EPIC-001 / STORY-001`；编辑标题不改 ID，新增按现有最大编号 +1，删除标记 archived（保留 ID 记录，不渲染/不进入交接）；
  - 渲染：`### SCENE-001 标题`、`### EPIC-001 标题`、`#### STORY-001 标题` + 验收标准；
  - 解析：旧 Markdown `###`/`####`/粗体列表项 → 结构（确定性；无标题时列表项兜底为 Epic + Story），用于“重建结构”与全文保存；
  - 归一化：引用不存在 → 置空 + warning；同一次提交重复 ID 会自动分配新 ID。
- 文档 API：
  - `PUT /requirements-doc/sections/:key` 接受 `data`（scenes/epics），保存后自动渲染 Markdown；
  - 结构化章节保存 Markdown 时自动解析回结构（解析失败保留原结构并给 warning）；
  - `POST /requirements-doc/outline/rebuild` 从 Markdown 重建（可指定 `sectionKey`）；
  - `POST /requirements-doc/reopen` 重新编辑需求（H4 入口）；确认后只读死胡同已解决。
- 确认校验：有结构化数据时要求至少 1 Epic + 1 Story；全部 Story 无验收标准时阻塞（单条缺失只警告）；无结构时沿用旧 Markdown 校验并提示“结构未建立”（不阻塞首次确认）。
- 前端 `OutlineEditor.vue`：Scene 列表；Epic → Story 列表（标题/目标/优先级/所属场景/验收标准），稳定 ID 小标签、增删、自动保存；“结构 / Markdown”切换与“重建结构”。
- `<<<DOC_JSON>>>` 支持 `sections[].data`；doc prompt 注入结构化清单与协议示例，要求修改已有条目保留 ID。

### H2 DesignInputBundle 与引用

- 新表 `app_design_inputs`（id/app/doc_version/doc_hash/template_id/input_json/structure/created_at；app + hash 唯一）。
- 设计项目/实体/页面集/页面补列：
  - `app_design_projects.source_input_id / source_input_hash / source_doc_version`；
  - `app_design_entities.requirement_refs_json / source_sections_json`；
  - `app_design_page_sets.epic_id / story_ids_json`；
  - `app_design_pages.requirement_refs_json`。
- `backend/src/design/input.ts`：
  - 确定性构建 `DesignInputBundle`：scenes / epics（含 stories）/ 扁平 stories / roles / dataRules / pageRequirements / nonFunctionals / openQuestions / glossary；`structure=prd|fallback`；`docHash = sha256(docVersion + content_md + 结构化清单)`；
  - 同一 hash 复用，历史输入保留；`GET /design/input`（最新 / `?id=` / `?docVersion=` / history）；
  - 校验 `requirementRefs`、`epicId`、`storyIds` 必须存在，未知引用给 warnings 不静默丢弃；
  - 覆盖度计算（Story/Epic/Scene → 实体/页面集/页面；无需求依据的实体/页面）。
- 设计项目进入时自动生成/绑定设计输入；实体/页面集/页面保存 `requirementRefs`；页面集按 Epic 组织（`epicId/storyIds`），页面集生成优先使用**已绑定的** bundle（Epic → Scene → 旧 Markdown/实体兜底），设计输入过期时不会静默采用未同步的新需求。
- 实体/页面集 AI prompt 改为注入 bundle（稳定 ID + 关键章节原文），要求实体 `requirementRefs/sourceSections`、页面集 `epicId/storyIds`、页面 `requirementRefs`；生成结果返回 refs/覆盖度 warning。

### H3 UI：设计输入 / 覆盖度

- Design Studio 顶部：`需求输入 v11 · 1 场景 / 2 Epics / 3 Stories · 已确认`（点击打开需求文档抽屉）、fallback 标记、`重新同步需求`。
- 构建活动：需求已确认 → 设计输入已生成（含版本/Story 数）→ 实体 → 页面集 → 待确认。
- 新增“需求覆盖”Tab：按 Scene / Epic / Story 显示对应实体、页面集、页面，已覆盖/未覆盖、无需求依据实体/页面、覆盖提示；点击无需求依据实体/页可跳转到实体/页面编辑。
- 实体编辑显示/编辑 `requirementRefs`（来自 bundle 的 Story/Epic/场景）与来源章节；页面规格显示/编辑 `requirementRefs`，页面集展示 Epic/Stories。

### H4 需求变更 diff / 同步

- Design Studio stale banner：需求文档版本变化时显示“需求文档已更新（v11 → v13），设计输入需要同步”；提供 `查看 diff 并同步`、`去修改需求`。
- `POST /design/input/sync`：
  - `preview`：生成/复用最新输入，返回 Scene/Epic/Story 新增/删除/修改 diff 与受影响实体/页面集/页面（按 requirementRefs），**不绑定、不覆盖**；
  - `additions`：绑定新输入（保留现有实体/页面内容），设计回 draft 并要求重新确认；
  - `regenerate`：绑定新输入 + 受影响实体/页面置草稿、剔除失效引用、页面集 storyIds 按新 Epic 重算；不自动覆盖内容（AI 重新生成需用户触发）；
  - `defer`：只记录“暂不处理”，设计保持 stale。
- `POST /requirements-doc/reopen`：需求回 draft、应用回 requirements；设计/原型保留，重新确认需求后由 stale/sync 处理。开发/完成阶段不允许回退。
- 版本快照保留 structured data；同步写入 `app_stage_events`（input-synced / input-sync-deferred / reopened）。

### 评审修复：stale 确认漏洞（2026-11-11，P1）

评审指出：设计已 confirmed → 需求 reopen 并重新确认 → `app_design_projects.status` 仍为 confirmed → `confirmDesign` 直接返回 alreadyConfirmed，D5 会使用过期设计。已同时修复两层：

- **需求 reopen 时**（`reopenRequirementDoc`）：
  - 若设计项目为 `confirmed`，同步置为 `draft`、清空 `confirmed_at`，记录 `design-reopened`（reason=`requirements-reopened`）；
  - 不再出现“需求已回退但设计仍确认”的状态。
- **确认设计时**（`getDesign` readiness + `confirmDesign`）：
  - stale 时 readiness 增加阻塞项“需求文档已变更，请先同步设计输入后再确认设计”，`readiness.ok=false`；
  - `POST /design/confirm` 在 `alreadyConfirmed` 判断之前检查 stale，返回 409，绝不把过期设计当作已确认；
  - 同步（additions/regenerate）后再确认即可恢复正常。
- **前端**：stale 时主按钮显示“同步需求”，点击直接打开同步弹窗；`confirmDesign` 同样拦截并提示先同步。
- 验证：
  - 后端新增回归测试：设计确认 → 需求 reopen → 设计 draft/confirmedAt 清空 → 改需求并重新确认 → readiness 阻塞 + `confirmDesign` 409（即使手工把项目改成 confirmed）→ sync additions → 再次确认成功；
  - `smoke:handoff-input` 增加同一链路：确认设计 → reopen → 设计 draft → stale 确认 409 → additions → 再次确认成功 → 第二次变更 regenerate；
  - 本轮 P1 修复后**未重跑**真实模型 Playwright E2E（该 E2E 未覆盖“设计先确认再 reopen”路径）；由上述单测 + smoke 覆盖。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 86/86（新增结构化渲染/解析/稳定 ID/归档/确认校验/重建/重新编辑、DesignInputBundle/引用持久化/覆盖度/stale/diff/sync regenerate、已确认设计 reopen 后退回 draft + stale 拒绝确认） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `npm test --prefix frontend` | ✅ 29/29（新增 DOC_JSON data 解析/合并/结构化校验、DESIGN_JSON refs/epicId/storyIds 合并） |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整 |
| `npm run smoke:handoff-input --prefix backend` | ✅ 真实 Express + 临时 SQLite：结构化需求 → 确认 → bundle（v/hash/计数/绑定）→ 实体/页面 refs → 覆盖度 → 确认设计 → 需求 reopen（设计退回 draft）→ stale 确认 409 → 重新编辑需求 → diff（+1/−1/修改 1）→ additions → 再次确认设计 → 第二次变更 regenerate（清理引用/置草稿）→ 删除清理 |
| `npm run smoke:design --prefix backend` | ✅ 回归通过（页面集按 Epic 组织、确认/只读/模板切换/版本） |
| `npm run smoke:requirements --prefix backend` | ✅ 回归通过（文档/版本/模板/确认/409/doc 对话/删除） |
| Playwright + 真实 opencode/模型 | ✅ `packycode-deepseek/deepseek-flash`：结构化 Story UI 编辑自动保存 → 确认需求 → 设计输入 chip → AI 生成 2 个实体（2 个带 requirementRefs）→ 按 Epic 生成 2 个页面集（页面带 refs）→ 覆盖度 3/3 → 去修改需求（改名 + 新增 STORY-004）→ 确认 → stale banner → diff（修改 1 / 新增 1）→ 仅同步新增项 → stale 消失；0 console error、0 API >=400 |

E2E 截图（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\h4-e2e3`）：`01-requirements-structured.png`、`02-story-edited.png`、`03-design-input.png`、`04-entities-ai.png`、`05-pagesets-refs.png`、`06-coverage.png`、`07-requirement-changed.png`、`08-stale-banner.png`、`09-diff-dialog.png`、`10-synced.png`。

### 未做 / 已知限制

- **D5 未接（历史）**：设计确认仍只记录状态，不生成开发交接包、不解锁开发。**2026-11-11 D5 已补**，见「D5 完成」。
- **不硬阻塞覆盖**：Story 未覆盖、实体/页面无需求依据只给 warning；设计 readiness 不因覆盖度阻塞。
- **AI 产出质量**：真实模型可能只引用部分 Story/Epic，或生成英文实体名；后端保留引用并给 warnings，需人工复核。
- **同步不自动 AI 重生成**：`regenerate` 只清理失效引用/置草稿，AI 重新生成仍由用户在实体/页面页触发，避免静默覆盖。
- **旧数据不兼容**：旧 structured 应用仍被设计入口拒绝；旧文档可用“重建结构”补结构（启发式结果需复核）。
- **版本增长**：结构化保存/同步会生成新版本；暂无压缩/清理。
- **非 PRD 模板**：bundle 标记 `fallback` 并提示补充 Epics；页面集回退到场景/旧 Markdown/实体。

## H1—H4 评审（2026-11-11，主会话）

独立验证（未改代码）：

| 检查 | 结果 |
| --- | --- |
| `npm test --prefix backend` | ✅ 85/85 |
| `npm test --prefix frontend` | ✅ 29/29 |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ |
| `npm run smoke:handoff-input --prefix backend` | ✅ 结构化 → 确认 → bundle → refs → 覆盖度 → diff → additions → regenerate |
| 真实模型 Playwright E2E | 未重复跑；采用实施会话报告 |

评审结论（对你列的 6 点）：

1. **regenerate 语义**：当前“绑定新输入 + 清理失效引用 + 受影响项置草稿，不自动调 AI”是**安全且正确的默认**；不建议自动重生成，避免静默覆盖。但按钮“重生成受影响项”容易被理解为自动调 AI，建议改名为“同步并标记受影响项”，或另加一个明确的“AI 重新生成受影响项”按钮。
2. **重新编辑需求的阶段影响**：应用回 requirements、设计锁定、设计/原型保留、开发/完成阶段拒绝回退，方向正确。但发现一个 **stale 状态漏洞**：如果设计已 confirmed，需求 reopen/reconfirm 后 `app_design_projects.status` 仍是 `confirmed`，`confirmDesign()` 会直接返回 alreadyConfirmed，readiness 也不检查 stale；建议在 reopen 或 stale 检测时把设计项目置为 `draft`/`stale` 并清 confirmed_at，或让 confirmDesign/readiness 拒绝 stale。
3. **Markdown 重建启发式**：作为旧文档兜底可以接受；建议重建结果先预览/diff 再保存，并标记 `fallback`/需复核。现有测试覆盖了规范结构与遗留 `###`/列表解析，基本 OK。
4. **覆盖度不阻塞**：符合已定稿决策；Story 未覆盖/无需求依据只警告，纯后端 Story 可无页面。
5. **旧数据不兼容**：旧 structured 应用被设计入口拒绝，符合方向；旧文档可重建结构。
6. **D5 未做**：符合本轮边界；设计确认仍只记录状态，不生成交接包/不切开发。

其他小问题：

- `syncDesignInput` 在 preview/defer 时也会持久化新的输入快照；如果需求文档还是 draft，会产生一些“未确认输入”历史，建议 preview 不落库或标记。
- regenerate 时页面 requirementRefs 失效会回退到页面集的所有 storyIds，可能让覆盖度看起来“已覆盖”；建议改为留空 + warning，或明确提示“回退引用”。
- 设计输入/版本历史暂无清理策略，和 R1/D1—D4 的版本增长问题一致，随 R2 处理。

> 结论：H1—H4 可以阶段验收；**stale confirmed 设计**需要在 D5 前修，否则交接包可能基于过期的已确认设计生成。

## D5 完成（2026-11-11）：设计 → 开发交接

上游方案：`docs/plans/2026-11-11-design-to-development-handoff.md`（已定稿并补实施结果）、`docs/plans/2026-11-11-d5-implementation-brief.md`、`docs/plans/2026-11-11-iterative-change-design.md`（Change Set 基础）。本轮只做 D5：交接包 + Change Set #1 + 首次进入开发；**不做 C1**（Change Set #2/reopen/历史面板/删除代码）。

### D5 后端

- 新增 `backend/src/handoff/design-types.ts` / `design-bundle.ts` / `design-render.ts` / `design-service.ts` / `design-routes.ts`：
  - **bundle**：从已确认需求文档 + 绑定的 DesignInput + 实体 + 页面集/页面 + 原型模板 + 变更单构建确定性视图；稳定编号 `ENT-001 / PS-001 / PAGE-001`（文档、DDL、原型路径均不使用工作台内部 ID）；原型路径 `prototypes/ps-00N/page-00N.png`。
  - **render**：`00-README`（版本/来源/范围/技术栈/阅读顺序/完成定义/关键约束）、`01-REQUIREMENTS`（已确认文档原文 + 开放问题/术语）、`02-DATA-MODEL`（字段/关系/ER/约束/类型映射）、`03-PAGES`（模板摘要/页面集/每页字段动作状态验收/PNG 路径/导航/契约优先级）、`04-PLAN`（实施顺序/Epic 页面集清单/Story 页面验收/风险/交付格式）、`05-CHANGES`（初始开发无基线差异）、`schema.sql`（参考 DDL，无真实外键/凭据）、`prototype-template.json`（Token/Shell/模式 + hash）、`manifest.json`（版本/hash/文件清单/统计/变更单/警告）。
  - **validation**：需求文档未确认、设计未确认、DesignInput 未绑定/stale、readiness issues、requirementRefs/epicId/storyIds 未知、页面绑定实体不存在、任一页面缺 PNG/文件不存在/非 PNG → 阻塞；Story 未覆盖/无需求依据、页面集无列表页、无测试用例、开放问题、HTML 非独立页面 → 提示。失败不写盘、不切阶段。
  - **service**：preview（不写盘、不创建变更单）；generate（写 `projects/<app>/docs/handoff/`、复制 PNG/可选 HTML、版本递增、整体/单文件 hash、`design_handoffs`、应用 `design → development`、阶段事件）；GET（最新/指定版本元数据 + 文本内容 + PNG URL，历史版本标记文件已覆盖）；`GET /design/handoff/files/*`（PNG `image/png`、HTML text/plain 附件 + sandbox CSP、路径穿越 400）；应用删除清理。
- 数据：
  - 新表 `app_change_sets`（seq/title/scope/status/base_*/current_*）与 `design_handoffs`（每次生成一行，版本/hash/files/change_set_id/baseline/source_design/source_requirements/manifest）；
  - `apps.current_change_set_id`；`app_sessions.change_set_id/handoff_version/handoff_hash`。
- 阶段/会话：
  - 设计确认仍只记录 `app_design_projects.status=confirmed`；生成交接包时才 `apps.status=development` 并写 `design_confirmed_at/development_started_at/handoff_hash`；
  - 开发/完成阶段重新生成：版本递增、复用当前变更单、不打断会话；确认完成关闭当前变更单；完成后继续发消息把最近变更单恢复为 development；
  - 开发会话创建时记录 handoff version/hash/change_set_id，`GET /development` 返回；`requirementsMode=doc` 时开发页读取设计交接包摘要/文件。

### D5 前端

- `frontend/src/design/DesignHandoffDialog.vue`：版本/hash/变更单/基线/目录；预览（不写盘）、生成并进入开发/重新生成；阻塞与提示分区；文件列表（TEXT/PNG/HTML）+ 文本预览 + PNG 预览；成功后 emit 给 DesignStudio/AppShell。
- `DesignStudio.vue`：顶部“交接包”入口；确认设计后主按钮变为“生成交接包并进入开发”；“重新编辑设计”独立按钮；生成成功自动进入开发页；设计确认文案更新（D5 已接通）。
- `AppShell.vue`：doc 模式开发/完成阶段恢复“交接包”入口（设计交接包弹窗）；设计 Studio 生成成功后刷新并跳转开发；旧 structured 应用仍用旧交接包弹窗。
- `DevView.vue`：显示 `交接包 vN · 初始开发/变更 #N`、会话交接包版本；交接文档列表按 doc/structured 选择设计/旧交接包；开发页可查看 PNG。
- `design/api.ts` / `dev/types.ts` / `workbench/api.ts`：交接包类型、API 与 changeSet/handoff 字段。

### D5 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 89/89（新增 3 项：渲染/DDL/manifest/内部 ID、生成写盘/版本/Change Set #1/重新生成、缺 PNG/设计未确认/旧应用/路径穿越阻塞） |
| `npm test --prefix frontend` | ✅ 29/29 |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `npm run smoke:design-handoff --prefix backend` | ✅ 真实 Express + 临时 SQLite：结构化需求 → 确认 → 实体/页面集/每页 PNG → 确认设计 → preview（不写盘/无变更单）→ generate（v1/Change Set #1/development/原型复制）→ 读取/PNG/路径穿越 → 重新生成 v2（复用变更单）→ 历史版本标记 → 缺 PNG 400+issues → 完成关闭变更单 → 删除清理 |
| `npm run smoke:design` / `smoke:handoff-input` | ✅ 回归通过（设计确认仍不直接切阶段；H1—H4 stale/diff/sync 不受影响） |
| `npm run smoke:requirements` | ✅ 回归通过（旧 stage/confirm design 仍 409，提示改用设计 Studio 生成交接包） |
| Playwright + 真实 opencode/模型 | ✅ `packycode-deepseek/deepseek-flash`：真实模型 AI 生成实体 → 按场景生成 4 页 → 每页截图存档 → 确认页面集/设计 → 交接包预览（17 文件）→ 生成并进入开发 → 开发页交接包文件/PNG 预览 → 开始开发（build agent 读取 `docs/handoff/00-README.md`）；`app=development`、`handoff v1`、`changeSet #1`、`session.handoffVersion=1`；0 console error / 0 API >=400 |

E2E 截图（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\d5-e2e`）：`01-entities-ai.png`、`02-prototypes-snapshots.png`、`03-pageset-confirmed.png`、`04-design-confirmed.png`、`05-handoff-preview.png`、`06-development.png`、`07-handoff-png.png`、`08-dev-session.png`。

### D5 未做 / 已知限制

- **C1 未做**：发起 Change Set #2、需求/设计 reopen 后的变更流程、变更历史面板、`05-CHANGES` diff、删除代码/数据库迁移确认均未实现；当前 `05-CHANGES` 只输出“初始开发（无基线差异）”。
- **历史文件不保留**：`design_handoffs` 保留每次版本元数据/hash/manifest，但磁盘只保留最新 `docs/handoff/` 文件；旧版本 `filesAvailable=false`。
- **模板版本**：`prototype-template.json` 用 hash + updatedAt 追溯（模板表无 version 字段）。
- **PNG 强约束**：每个页面必须截图后才能生成；编辑页面规格后不会自动重新截图（图片可能是旧版本），需人工重新截图。
- **重新生成**：开发阶段重新生成只递增版本并提示，不自动归档/新建开发会话（C1）。
- **确认完成 → 继续消息**：会把最近变更单恢复为 development，但不创建新变更单（纯开发修复场景）。
- **旧 structured 应用**：仍使用 P3 旧交接包；R4 清理。

## D5 评审（2026-11-11，主会话）

独立验证（未改代码）：

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ |
| `npm test --prefix backend` | ✅ 89/89 |
| `npm test --prefix frontend` | ✅ 29/29 |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ |
| `npm run smoke:design-handoff --prefix backend` | ✅ preview 不写盘 → v1/CS#1/development/PNG → 读取/路径穿越 → v2 复用 CS → 历史版本 → 缺 PNG 400 → 完成关闭 CS → 删除 |
| `DESIGN_HANDOFF_SMOKE_DEV=1`（真实 opencode 2.2.5 serve） | ✅ 开发会话记录 `handoff v2` / `Change Set #1` |
| `smoke:design` / `smoke:handoff-input` / `smoke:requirements` | ✅ 回归通过 |
| 独立渲染交接包（临时 SQLite/projects，非仓库文件） | ✅ 17 文件（9 文本 + 4 PNG + 4 HTML）；无 ENT/PS/PAGE 内部 ID 泄露；无 `FOREIGN KEY`/`password`/`jdbc:`/DB 凭据；schema/ER/验收/导航/计划自包含 |
| 真实模型 Playwright E2E | 未重复跑；采用实施会话报告（`d5-e2e`） |

结论：**D5 主链路可以验收**（设计确认 → 确定性交接包 → Change Set #1 → `development` → 开发会话绑定 handoff 版本）。以下 3 项判为 **must-fix**（均为小改动，进入 C1 前修），不阻塞本轮方向讨论。

### must-fix

1. **同一变更单内重新生成（v2+）仍自称“首次开发”**
   - `design-render.ts` `renderChanges` 用 `change.seq === 1 || baselineHandoffVersion === null` 判断初始版；D5 的 CS 永远是 #1 且基线为 null，所以 v2/v3 仍输出“初始开发（无基线差异）/ 这是应用的首次开发”，而 `00-README` 还写“不要重写整个项目（首次开发除外）”。
   - 开发阶段点“重新生成交接包”后再开新会话，agent 可能按“首次开发”重写整个项目，违反“增量实现、保留未变更部分”。
   - 实测：v2 的 `docs/handoff/05-CHANGES.md` 仍为“初始开发（无基线差异）/ 这是应用的首次开发”。
   - 建议：`version > 1` 时输出“同一变更单内重新生成”，明确“应用目录可能已有代码，请增量修改，不要重写”；smoke 增加 v2 的 `05-CHANGES.md` 断言。

2. **预览/历史版本的 PNG URL 指向不存在或最新的文件**
   - `previewDesignHandoff` 不写盘，但仍给图片条目生成 `url`；预览弹窗点 PNG 会请求尚未写盘的文件 → 404 + 破图（该路径未被本次 E2E 覆盖）。
   - `readDesignHandoff(version)` 对历史版本图片仍给 `url`（`missing:true`），而 `designHandoffFile` 只服务最新文件 → 历史版本会显示最新版本的 PNG，元数据版本与图片不符。
   - `DesignHandoffDialog` 先判 `kind === 'image'` 再判 `missing`，放大了上述问题。
   - 实测：`readDesignHandoff(app, 1).files` 图片条目 `missing:true` 且 `url` 指向最新 PNG；磁盘上确为 v2 图片。
   - 建议：预览/历史版本不返回图片 `url`；对话框先判 `missing`/无 `url`，提示“预览不写盘，生成后可查看 PNG / 该版本文件已被覆盖”。

3. **首个交接包的变更单状态陈旧**
   - `generateDesignHandoff` 在写库事务前构建 bundle，因此 `05-CHANGES.md` / `manifest.json` / `00-README.md` 记录 `changeSet.status=design`；事务后应用与变更单已是 `development`（v2 才变成 `development`）。
   - 建议：把生成后的目标状态传入 bundle，保证首包自描述与落库一致。

### must-fix 修复（2026-11-11，实施会话）

1. **同变更单重新生成不再自称“首次开发”**
   - `renderChanges` 改为 `change.seq===1 && bundle.version===1` 才是初始开发；v2+ 输出“同一变更单 #1 内重新生成”，明确“应用目录可能已有代码、请增量修改、不要重写整个项目”。
   - `00-README` 版本说明：v1“基线：无，首次开发”；v2+“同一变更单 #1 内重新生成；开发目录可能已有代码”。
   - 单测/冒烟覆盖 v2 文案（不得出现“这是应用的首次开发”）。
2. **预览/历史版本 PNG URL**
   - `previewDesignHandoff` 不写盘时不再返回 PNG `url`；前端在图片无 URL 时提示“预览不包含图片文件”。
   - `readDesignHandoff(?version=历史)` 仅最新版本且文件存在时返回 `url`；历史版本 `missing=true` 且无 URL。
   - `DesignHandoffDialog` 先判 `missing` 再判 `kind==='image'`。
3. **首包变更单状态**
   - 生成前计算目标状态（design → development；completed → completed）并传入 bundle；`05-CHANGES`/`manifest`/`00-README` 首包即记录 `status=development`。
   - 预览也按生成后目标状态渲染。

验证：后端 89/89（新增上述断言）、`smoke:design-handoff` 通过、前端 typecheck/build 通过、真实模型 Playwright E2E 重跑通过。

主会话复验（2026-11-11，未改代码）：`npm test --prefix backend` 89/89；`npm run smoke:design-handoff` 通过（输出含“同变更单重新生成/增量修改”“历史 PNG 不再发 URL”）；`npm run typecheck --prefix frontend`、`npm run build --prefix frontend` 通过；走查 `design-render.ts`（v2 文案）、`design-service.ts`（预览不发图片 URL、历史版本仅最新且存在才发 URL、目标状态传入 bundle）、`DesignHandoffDialog.vue`（先判 missing）确认 3 项均已落地。**must-fix 关闭。**

### 可随 C1 / R2（不阻塞 D5 验收）

- **创建/编辑表单契约包含主键 `id`**：`03-PAGES.md` 的 form 页“字段/列表列/查询字段”直接取实体全部字段，`id` 会出现在创建/编辑表单里，agent 可能渲染可编辑主键。建议页面规格生成时排除主键/系统字段或标注只读（随 R2 页面规格）。
- **未知 requirementRefs 硬阻塞**：符合交接单 §6（自包含优先）；但 H4 `additions` 同步保留失效引用，用户可能被卡在“设计已确认只读 + 交接包无法生成”。建议 C1 提供“清理失效引用”一键操作，或 `additions` 同步时清空失效引用并给 warning。错误文案已带条目名，可接受。
- **PNG 时效**：截图不绑定页面版本，改页面规格后仍用旧图。建议页面快照记录 `pageVersion`，交接包在版本不一致时给 warning（不阻塞；页面规格仍是契约）。
- **模板版本**：`prototype-template.json` 用 hash + updatedAt 追溯，可接受；C1 变更集建议记录模板 hash 以判断模板是否变化。
- **模板缺失自愈**：`templateForProject` 在模板缺失时静默回退默认模板并改项目绑定，`03-PAGES` 可能不是用户选的模板。建议改为阻塞/提示（使用中模板禁止删除已挡住大部分场景）。
- **`preview` 非纯读**：`getDesign` 在输入未绑定时会 `persistDesignInput`（并可能回退模板），“预览不写盘”目前只指不写 `docs/handoff/`；文档口径需写清。
- **~~`designErrorHandler` 未注册~~**（`design/routes.ts` 导出但未使用；实际由 `appsErrorHandler` 处理）——**R4a 已删除**。
- **~~`DesignHandoffDialog` 的 `mode === 'view'` 判断无效~~**（模板内 `mode` 是本地 ref `current|preview`，不是 props）→“初始开发”chip 永不显示（`changeSetLabel` 已兜底，纯装饰）——**R4a 已改为 `props.mode`**。
- **`appPayload` 重复查询** `designHandoffSummary` 两次，可合并（微优化）。
- **文案级**：`schema.sql` 字段标签“主键”+ `isPrimary` 再拼“主键”出现“主键；主键”；`01-REQUIREMENTS.md` 文档正文自带 H1 导致双重标题。
- **C1 相关语义（C1a 已修）**：`completeActiveChangeSet` 现在只关闭当前 active 单；`ensureChangeSet` 不再复用 completed/cancelled 单；历史版本文件仍不保留（`filesAvailable=false`，D5 既有）。
- **安全**：文件读取按 DB 文件清单精确匹配 + 路径穿越 400；HTML 走 `text/plain` 附件 + `sandbox` CSP + nosniff；PNG 为 `image/png` + nosniff；`schema`/文档无凭据。未做 `realpath` 防符号链接（应用目录本身对开发 agent 可写，风险低）。

## C1a 完成（2026-11-11）：变更单后端

上游：`docs/plans/2026-11-11-c1-implementation-brief.md`（§3—§6、§8）、`docs/plans/2026-11-11-iterative-change-design.md`（§2—§9、§12，含第 13 条取消语义）。本轮只做后端（C1a）；**C1b 前端（头部 chip/发起变更/变更历史/取消按钮）未做**。

### 数据与 API

- `backend/src/db.ts`：`app_change_sets` 增加 `base_app_status/base_completed_at/base_change_set_id/base_session_id/changes_md/summary_json`；`app_requirement_doc_versions/app_design_inputs/app_design_versions` 增加 `change_set_id`（建表 + `ensureColumn` 双写，旧库自动补列）。版本/设计输入写入时自动标记当前 active 变更单。
- 新增 `backend/src/changesets/`：
  - `query.ts`：仅依赖 `db` 的 active/latest/byId/list/nextSeq/update/`markChangeSetGenerated`，避免与需求/设计/交接包循环 import；
  - `service.ts`：`startChangeSet` / `cancelChangeSet` / `listChangeSets` / `activeChangeSetView`；
  - `routes.ts`：`GET/POST /api/apps/:id/change-sets`、`POST /api/apps/:id/change-sets/:csId/cancel`。
- 应用详情：抽出 `backend/src/apps/payload.ts`（`appPayload` 供 apps/change-sets 路由复用，避免循环 import），新增 `activeChangeSet`；`handoff`/`changeSet` 字段语义不变（顺手合并 D5 重复查询）。

### 生命周期

- 发起变更（§4.1）：`requirements_mode=doc`、应用 `development|completed`、无 active 单、需求+设计已确认、已有交接包；记录基线（需求版本、设计版本、交接包版本、input id、应用状态/完成时间/上一变更单/active 会话）；`scope=requirements` 需求+设计回 draft、应用回 requirements，`scope=design` 仅设计回 draft、应用进 design；归档 active 开发会话；建单（`max(seq)+1`）+ `apps.current_change_set_id` + 保留 `completed_at`；事件 `change-set-started`。
- 阶段推进（§4.2）：需求确认 → 变更单 `design`；设计确认 → 保持/置 `design`；生成交接包 → `development` + `current_*` + `changes_md/summary_json`；`completeActiveChangeSet` 只关当前 active 单；完成后继续发消息只恢复最近一单。
- reopen 门禁（§4.4）：开发/完成阶段无 active 单 → 409「请先发起变更」；需求 reopen 额外要求 `scope=requirements`（仅设计变更中不允许改需求）。
- 取消（§4.3）：必须 active、未生成该单交接包、且存在已确认基线差异（草稿不算）；恢复需求/设计到基线内容并追加新版本（`source=restore`）+ 保持 confirmed；恢复应用状态/`completed_at`/`current_change_set_id`；`base_app_status=development` 时恢复基线会话为 active；变更单 `cancelled` + 事件 `change-set-cancelled`；不物理删除版本。恢复后重新绑定等价设计输入，避免 docVersion 递增导致 stale。
- 交接包（§4.5）：有 active 单 → 绑定该单（baseline=该单 `base_handoff_version`、version=最新+1、写 `change_set_id`）；无 active 且无交接包 → 首次 #1；无 active 但已有交接包 → `generate` 409（纯代码修复请直接在开发会话进行）、`preview` 允许 + `canGenerate=false` + warning；`ensureChangeSet` 不再复用 completed/cancelled。

### `05-CHANGES` 真实 diff

- 新增 `backend/src/handoff/design-changes.ts`（确定性，不调模型）：基线需求=`base_input_id`→`app_design_inputs.input_json`，基线设计=`base_handoff_version`→`design_handoffs.source_design_json`，模板=基线 manifest `prototypeTemplate.hash`；输出需求（Scene/Epic/Story）、实体/表/字段/关系、页面集/页面、模板的新增/修改/删除 + 影响提示（引用被改/删条目的实体与页面）+ 删除/迁移要求 + 增量实现要求。
- 不输出实体/页面/页面集内部 ID（输出名称/表名/标题/稳定需求 ID）；`seq=1` 沿用“初始开发/同一变更单内重新生成”文案；`seq>1` 走真实 diff。
- `manifest.changeSet` 增加 `changes` 计数与 baseline/current；`00-README` 显示「变更 #N · 基线 vZ」；`05-CHANGES` 在变更时置顶“先读本文件”。

### 开发首条提示

- `DEFAULT_DEV_PROMPT` 保留初次文案；新增 `buildDevPrompt`：同单重新生成（v2+）要求增量修改；变更 #N 提示“先读 05-CHANGES.md、基线 vZ、增量实现、不要重写”。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 96/96（新增 `changesets/service.test.ts` 7 项：发起变更/scope=design + reopen 门禁/交接包绑定与 409/05-CHANGES diff（无内部 ID）/取消恢复/已生成交接包拒绝取消/完成只关当前单） |
| `npm run smoke:change-set --prefix backend` | ✅ Express + 临时 SQLite：创建应用 → 需求/设计/交接包 v1 → 完成 → #2（需求+设计）→ 改需求+设计 → 确认 → 预览/生成 v2（基线 v1、绑定 CS#2）→ 05-CHANGES 增量（STORY-003/levelNote，无 ent-/ps-/pg-）→ manifest 计数 → 完成 #2 → #3（仅设计）→ 取消（恢复基线、设计 v7→v9、应用 completed、CS#3 cancelled）→ 生成 409/预览允许 → 删除清理 |
| `CHANGE_SET_SMOKE_DEV=1 npm run smoke:change-set` | ✅ 真实 opencode 2.2.5：开发会话记录 handoff v2 / CS#2，首条提示为“第 2 次变更” |
| `npm run smoke:design-handoff` / `smoke:design` / `smoke:handoff-input` / `smoke:requirements` | ✅ 回归通过 |

### 未验证 / 已知限制

- **C1b 已完成**（见下文「C1b 完成」）：应用头部 chip、发起变更弹窗、变更历史弹窗、取消按钮、DesignStudio/DevView/HomeShell 文案均已在 C1b 接入。
- 前端 `npm test`/`typecheck`/`build` 与 Playwright 已在 C1b 补跑（本轮 C1a 主体无前端改动）。
- 基线需求 `docHash` 未单独建列，通过 `base_input_id` 的 input 快照追溯；取消门禁用版本号判断确认差异。
- 取消是“恢复基线 + 追加恢复版本”，不是物理删除；历史版本仍增长（版本压缩留 R2）。
- `05-CHANGES` 只给删除/迁移要求；不自动删文件、不执行 DDL（D5/迭代方案边界保持不变）。
- 旧 structured 应用不支持变更单（409）。

### C1a 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run build --prefix backend` ✅；`npm test --prefix backend` ✅ 96/96；`npm run smoke:change-set` ✅（v1→完成→#2 需求+设计→diff v2→完成→#3 仅设计→取消恢复→删除）。代码走查确认：变更单查询与业务编排分层、`ensureChangeSet` 不复用封闭单、无 active 单时生成 409/预览允许、`completeActiveChangeSet` 只关当前、`05-CHANGES` 不输出实体/页面/页面集内部 ID、取消用内部 `restore*` 绕过只读守卫。

必须收口（进入 C1b 前修）：

1. **取消没有恢复原型模板**：`cancelChangeSet` 只恢复实体/页面集，未恢复 `app_design_projects.prototype_template_id`。若变更中切换过模板，取消后设计会保留新模板，与“恢复基线”不一致。建议从基线交接包 `source_design_json.templateId`（或 manifest `prototypeTemplate.id`）恢复，并补测试。
2. **取消会误清基线设计输入的变更单归属**：`cancelChangeSet` 中 `UPDATE app_design_inputs SET change_set_id = NULL WHERE id = ?` 未限定条件；若恢复后 hash 命中“上一变更单”创建的输入，会把它的归属也清掉。建议加 `AND change_set_id = <被取消单 id>`。
3. **纯开发修复会重新打开已完成的变更单**：`promptDevSession` 在 completed 后把最近 completed 单改回 `development`。C1 下这会让该单变成 active，随后“发起变更”被拒；此时点“重新生成交接包”还会用该单旧基线生成一份语义错误的 diff。建议：纯开发修复只把 `apps.status` 改回 `development`，**变更单保持 completed**（符合“纯开发修复不属于 Change Set”）；补测试（完成→继续消息→可发起变更、生成仍 409）。
4. **scope=design 改需求无出路**：仅设计变更中需求被锁，且取消需要“已确认差异”；若用户刚发起仅设计变更就想改需求，会卡死。建议新增 `POST /api/apps/:id/change-sets/:csId/scope`（仅 active、scope=design、未生成交接包时可升级为 requirements：置 CS scope/status=requirements、应用回 requirements、需求回 draft），C1b 在变更提示条提供“改为需求+设计变更”。

可随 C1b / R2：

- 无 active 单时 `preview` 仍会带出“最新一单”（可能是 cancelled）的元数据；面板/预览需明确“无进行中变更单”。C1b 用 `canGenerate` 控制按钮即可，元数据文案可再收口。
- `startChangeSet` 不拦截“开发会话正在运行”，C1b 发起弹窗需明确提示“会归档当前会话”；必要时后续再做 interrupt。
- `startChangeSet` 未校验 `base_input_id` 非空（正常已确认设计都有）；异常数据下 `05-CHANGES` 会走“基线缺失”提示。

### C1a 收口修复（2026-11-11，实施会话）

主会话评审 4 项已修：

1. **取消恢复原型模板**：`cancelChangeSet` 从基线交接包 `source_design_json.templateId`（回退 `manifest.prototypeTemplate.id`）读取基线模板；若模板仍存在则写回 `app_design_projects.prototype_template_id`，返回 `restored.templateId`，事件记录 `restoredTemplateId`。新增单测“变更中 `PUT /design/template` 切换模板 → 取消 → 模板回到基线”。
2. **不误清基线设计输入归属**：清理语句改为 `UPDATE app_design_inputs SET change_set_id = NULL WHERE id = ? AND change_set_id = ?`（仅当前被取消单）。
3. **纯开发修复不重开变更单**：抽出 `dev/service.resumeCompletedApp()`：完成后继续发消息只把 `apps.status` 改回 `development`、清空 `completed_at`，**变更单保持 completed**。新增单测：resume 后可发起新变更、`generate` 仍 409、历史单状态不变。
4. **scope=design 可升级**：新增 `POST /api/apps/:id/change-sets/:csId/scope`（`{scope:'requirements'}`），仅 active、原 `scope=design`、未生成该单交接包时允许；事务内 CS `scope/status=requirements`、应用回 requirements、`requirements_confirmed_at=NULL`、需求文档 draft、设计项目 draft，事件 `change-set-scope-upgraded`。单测覆盖成功 + 非 design/已生成交接包/非法目标拒绝；`smoke:change-set` 覆盖升级后改需求→确认→取消。

另：`ChangeSetView` 增加服务端计算的 `canCancel`/`cancelBlockedReason`（复用 `cancelabilityOf` 门禁），`listChangeSets` 与 `activeChangeSet` 均返回；取消接口复用同一门禁，避免前后端判断不一致。

验证：后端 `npm run build` ✅、`npm test` ✅ 100/100、`npm run smoke:change-set` ✅（含模板切换取消恢复、scope 升级）、4 项既有冒烟回归 ✅。

## C1b 完成（2026-11-11）：变更前端

范围：按交接单 §7 做前端；未做 R2、I-09/I-10、R4，未改 `templates/eos-app`、`projects/`、`data/`、`.env`。

### 前端改动

- 类型/API：`frontend/src/workbench/api.ts` 新增 `ChangeSetInfo`（含 `canCancel/cancelBlockedReason/changesMd/summary/基线-当前版本`）与 `AppInfo.activeChangeSet`；新增 `frontend/src/changesets/api.ts`（`listChangeSets/startChangeSet/cancelChangeSet/upgradeChangeSetScope`）。
- 纯逻辑 helper：`frontend/src/changesets/labels.js` + `labels.test.mjs`（chip/首页状态/发起与生成门禁/版本范围/计数/基线标识），沿用 `*.test.mjs`（node --test）。
- `AppShell.vue`：头部 chip（`初始开发 · 开发中` / `变更 #N · 需求|设计|开发` / `已完成` / `开发中`）；`发起变更`（development/completed 且无 active）；`变更历史`（doc 模式且有交接包）；接入发起/历史弹窗；发起成功按 scope 跳需求/设计；取消成功刷新并回开发页；交接包弹窗按 `canGenerate` 控制生成入口。
- 新增 `ChangeSetStartDialog.vue`：标题（必填）、说明、范围（需求+设计/仅设计）、基线摘要（需求 vX/设计 vY/交接包 vZ）、归档会话提示。
- 新增 `ChangeSetHistoryDialog.vue`：变更单列表（编号/标题/状态/范围/版本范围/计数/时间）、展开 `changesMd`（MarkdownView）、`active && canCancel` 才显示取消按钮，否则展示 `cancelBlockedReason`。
- `DesignHandoffDialog.vue`：新增 `canGenerate`（默认 true，避免 Vue Boolean prop 缺省变 false）与 `activeChangeSet`；无 active 单且已有交接包时隐藏生成按钮并提示“请先发起变更；纯代码修复请直接在开发会话进行”，`generate()` 同门禁；变更中主按钮文案“生成变更交接包并进入开发”。
- `DesignStudio.vue`：顶部 `变更 #N（基于 需求 vX / 设计 vY）`；`scope=design` 时显示提示条 + “改为需求+设计变更”（确认后调 scope 升级并回需求阶段）；确认设计后主按钮在变更中为“生成变更交接包并进入开发”。
- `RequirementsDocView.vue`：doc 模式且有 active 变更单时显示 `变更 #N（基于 vX）`，编辑/确认逻辑未改。
- `HomeShell.vue`：应用行显示 `变更中 #N · 阶段` / `已完成` / `开发中`。
- `DevView.vue`：沿用 `handoff.changeSet` 显示 `交接包 vN · 变更 #N`；交接包弹窗的“重新生成”入口由 `AppShell` 的 `canGenerate` 统一控制（纯开发修复时不显示）。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | ✅ 35/35（新增 `changesets/labels.test.mjs` 6 项） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整 |
| Playwright E2E（API 预置 completed 应用，非真实模型） | ✅ 首页/应用头部 `已完成` → 发起 #2（需求+设计，弹窗基线 v1）→ 需求页 `变更 #2（基于 vX）` → API 改需求/同步/确认设计 → 设计页 `变更 #2` + 主按钮“生成变更交接包并进入开发” → 预览/生成 v2 → 开发页 `交接包 v2 · 变更 #2` → 05-CHANGES 含增量与 STORY-003、无“首次开发” → 变更历史列表/差异/生成后不可取消原因 → 完成 #2 → 发起 #3（仅设计）显示升级提示条 → 升级为需求+设计并回需求页 → 改需求确认 → 变更历史取消 #3 → 恢复 `已完成` → 取消后无 active 单、交接包生成按钮隐藏、预览允许；0 console error、0 非预期 API >=400 |

E2E 截图（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\c1b-e2e\shots`）：`01-home.png`、`02-completed-chip.png`、`03-start-dialog.png`、`04-after-start.png`、`05-design-change.png`、`06-handoff-preview.png`、`07-development.png`、`08-changes-md.png`、`09-history.png`、`10-scope-banner.png`、`11-upgraded.png`、`12-cancelled.png`、`13-preview-blocked.png`。

### 未验证 / 已知限制

- E2E 使用 API 预置/修改需求与设计内容（避免真实模型），UI 覆盖 chip/弹窗/按钮/门禁/导航/取消/升级；未跑真实模型需求/设计聊天 E2E（沿用 R1/H4 记录）。
- 变更历史未做逐版本全文并排 diff（C1/R2 边界），只展示 `changesMd` 摘要。
- 开发会话仍单 active；“在当前会话继续”未做（I-10）。
- 页面版本/交接包历史文件只保留最新一份（D5 既有）。


## C1 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run build --prefix backend` ✅；`npm test --prefix backend` ✅ 100/100；`npm run smoke:change-set` ✅（含模板切换后取消恢复、scope 升级、取消后生成 409/预览允许）；`smoke:design-handoff` / `smoke:handoff-input` / `smoke:requirements` ✅ 回归；`npm test --prefix frontend` ✅ 35/35；`npm run typecheck --prefix frontend` ✅；`npm run build --prefix frontend` ✅。走查确认：

- C1a 4 项收口均已落地：取消从基线交接包恢复原型模板；`app_design_inputs` 只清被取消单的归属；纯开发修复不再重开变更单；scope 升级接口与事务状态正确。
- 取消门禁 `cancelabilityOf` 与 `cancelChangeSet` 复用同一判断，`canCancel/cancelBlockedReason` 由服务端返回，前端不再自猜。
- `05-CHANGES` 只输出业务名称/表名/标题/稳定需求 ID；`manifest.changeSet` 计数与基线/当前版本正确；`00-README` 变更标识正确。
- 前端：头部 chip/发起变更/变更历史/取消/仅设计升级提示/交接包 `canGenerate` 门禁/首页状态均接通；`labels.test.mjs` 覆盖纯逻辑；E2E 截图 13 张存在。
- 安全边界未退化：文件读取路径穿越 400、HTML `text/plain` 附件 + sandbox CSP、PNG 魔数、文档无凭据。

结论：**C1 可以验收**（需求/设计变更 → 新 Change Set → `05-CHANGES` → 新交接包 → 新会话增量实现 → 完成/取消）。以下为不阻塞验收的观察项：

1. 取消恢复模板时若基线模板已被删除会静默跳过（使用中模板禁止删除已挡住主路径）；可接受。
2. 无 active 变更单时 `preview` 仍会带出“最新一单”（可能 cancelled）的元数据；C1b 已用 `canGenerate=false` 隐藏生成入口，文案可再收口。
3. `startChangeSet` 不拦截“开发会话正在执行”；发起弹窗已提示会归档会话，建议后续在 I-10/开发页补 interrupt 或运行中确认。
4. E2E 用 API 预置/修改需求与设计（避免真实模型），UI 覆盖变更流程；真实模型需求/设计聊天 E2E 仍是既有未验证项。
5. 变更历史只展示 `changesMd` 摘要，无逐版本并排 diff（R2 边界）。

## R2a 完成（2026-11-11）：需求 AI 建议 + P1 收尾

上游：`docs/plans/2026-11-11-r2a-implementation-brief.md`（§2—§5）。本轮只做 R2a；**R2b 版本策略未做**（自动保存/版本生成保持不变），设计/交接包/I-09/I-10/R4 未改动。

### 后端

- `requirements/routes.ts`：
  - `requireDocMode` router 级中间件覆盖全部 doc 端点（应用不存在 404、非 `doc` 409「旧 structured 需求模式」）；不会为 structured 应用创建 `app_requirement_docs` 行；
  - 新增 `POST /api/apps/:id/requirements-doc/preview`。
- `requirements/doc.ts`：
  - `previewDoc`：复用保存的解析/映射（`parseContentMd` / `mapParsedSections` / `applySectionUpdates` / `syncStructuredAfterFullSave`），**不写库、不产版本**；已确认只读返回 409；
  - 每节返回 `change=added|modified|unchanged`；`removed` 只含 `custom-*` 且非必填章节；必填章节缺失给 warning“将保留原内容”，模板可选章节缺失同样保留并 warning；
  - `saveDoc` 支持 `removeSectionKeys`：仅删除 `custom-*` 且非必填章节，必填/模板章节忽略并 warning；与 `sections` 更新同一事务、同一版本（`source='ai'` 照常快照）。
- `requirements/templates.ts`：删除私有模板前检查 `app_requirement_docs.template_id`，使用中 400（内置仍只读）。
- `chat/service.ts`：`mode:'doc'` 增加 `requirements_mode='doc'` 守卫（409），守卫先于 prompt 构建，不会创建文档。
- `chat/doc-prompt.ts`：要求已有章节返回原 `sectionKey`、只输出需要修改的章节、不删除必填章节、`openIssues.add` 只放真正待澄清问题；Markdown 标题不带 `[key]`/`（必填）` 前后缀（真实模型曾把提示格式抄进标题）。

### 前端

- `requirements/doc-diff.js` + `doc-diff.test.mjs`（纯函数）：章节 diff、标题变化、行级 LCS diff（大文本截断）、`buildApplyPayload`（勾选/必填不可删/待澄清写入/标题）、`allApplicableSelected`。
- `requirements/AiSuggestionCard.vue`：计数、章节勾选、行级 diff、标题变更、待澄清勾选、应用选中/全部应用/忽略；readonly/streaming/已处理/过期禁用。
- `requirements/DocChatPanel.vue`：
  - `doc` → `/preview`；`sections` → 本地 `mergeDocSections` 生成建议；**不再自动保存**；
  - 建议随消息持久化（`baseVersion`、applied、ignored），刷新后仍可应用/忽略；文档版本变化后提示“建议已过期”并禁用；
  - 应用：`saveDocFull`（选中 sections + removeSectionKeys + 可选 title + `source='ai'`）→ notice“已应用 AI 修改（vN，X 章节）”→ `doc-changed`；失败保留卡片可重试；
  - 忽略：只标记 `ignored` + notice，不写库、不产版本。
- `requirements/RequirementsDocView.vue`：向对话面板传 `docTitle`（标题 diff 基准）；`doc-changed` 沿用现有刷新。
- `requirements/TemplateCenterDialog.vue`：章节增删/上移下移/标题/层级/类型/必填/撰写提示；新增章节输入 key（`^[a-z0-9-]+$` 且唯一），已保存 key 只读；内置只读；保存校验错误留在弹窗；删除提示改为“使用中不能删除”。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 110/110（新增 doc 预览/removeSectionKeys/只读 409 4 项；新增 routes 守卫/模板删除保护/预览应用 6 项；`reopen` 回归沿用既有用例） |
| `npm run smoke:requirements --prefix backend` | ✅ 扩展：structured doc 端点/对话 409 且不建文档行；preview 不改版本/不产版本；忽略不产版本；应用选中只更新勾选章节 + 必填不可删 warning；模板使用中 400/未使用可删/内置只读 |
| `npm run smoke:change-set` / `smoke:design-handoff` / `smoke:design` / `smoke:handoff-input` | ✅ 回归通过 |
| `npm test --prefix frontend` | ✅ 44/44（新增 doc-diff 9 项） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整 |
| Playwright + 真实模型 `packycode-deepseek/deepseek-flash` | ✅ 建议卡出现且**未点击前文档版本不变**（v1）；取消勾选仅应用「文档信息」→ v2 且只有该章节（+勾选的待澄清）有内容；第二轮建议忽略 → 版本保持 v2；复制模板 13 个已保存 key 只读；使用中模板删除 400 提示；切回标准 PRD；0 非预期 API >=400、0 console error（仅故意删除 400 的浏览器网络日志） |

E2E 脚本/截图（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\r2a-e2e`）：`01-ai-suggestion.png`、`02-applied-selected.png`、`03-second-suggestion.png`、`04-ignored.png`、`05-template-editor-keys.png`、`06-template-delete-blocked.png`、`07-back-to-standard.png`。

### 与交接单的澄清/偏差

1. **preview 不创建文档**：交接单要求“不写库”，因此预览不复用 `ensureRequirementDoc`；无文档时按模板构造只读基线（`baseVersion=0`，前端回退当前版本），正常流程文档已存在。
2. **removed 口径收紧**：只含 `custom-*` 且非必填（与 `removeSectionKeys` 可应用范围一致）；模板可选章节缺失不进入 `removed`，只 warning 保留原内容。
3. **sections 模式不产生 removed**：章节更新只合并；删除必须走全文 `doc` 的 `removed` + 显式勾选。
4. **标题变更需显式勾选**：建议卡默认勾选“同时更新标题”。
5. **待澄清写入**：只有文档存在 `issues` 章节时才随应用写入，否则 warning 不强行创建。

### 未验证 / 已知限制

- **R2b 已完成（2026-11-11）**：自动保存不再产版本，改为手动/关键节点 checkpoint；见「R2b 完成」。
- 建议卡随消息持久化包含 diff 文本，超长文档会使对话消息体积变大（展示侧已截断行 diff）。
- 全文建议里模型改写标题（未沿用原 sectionKey）会落为 `custom-*` 新增 + 原章节缺失 warning，不是“重命名”；确定性映射优先。
- E2E 只覆盖 1 个真实模型产品；模型未返回 DOC_JSON 时仍走“本轮未解析”提示；卡片逻辑由单测覆盖。
- 设计/交接包/页面版本未改动。

## R2a 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run build --prefix backend` ✅；`npm test --prefix backend` ✅ 110/110；`npm run smoke:requirements` ✅（structured 409/不建文档、preview 不产版本、忽略不产版本、应用选中仅改勾选、必填不可删、模板删除保护）；`smoke:change-set` / `smoke:design-handoff` / `smoke:design` / `smoke:handoff-input` ✅ 回归；`npm test --prefix frontend` ✅ 44/44；`typecheck` / `build` ✅。走查确认：

- `requirementDocRoutes` 的 `requireDocMode` 覆盖全部 doc 端点；`chat mode='doc'` 同样守卫，不会为 structured 应用建文档。
- `previewDoc` 复用保存解析但不落库/不产版本；`docStatus` 只读与保存一致；`removed` 仅 `custom-*` 非必填，必填/模板章节缺失只 warning。
- `removeSectionKeys` 与 sections 更新同一版本，仅删自定义可选章节；`source='ai'` + snapshot。
- AI 建议卡：默认勾选新增/修改，unchanged 只计数不展示，removed 必填禁用；行级 LCS diff 有 400 行/40k 字符截断；建议随消息持久化并带 `baseVersion`，版本变化后禁用应用。
- 模板编辑器：已保存 key 只读、新增 key 校验格式/唯一、内置只读、使用中删除 400。

结论：**R2a 可以验收**。不阻塞验收的观察项（随 R2b/收尾）：

1. 建议卡 `stale` 时“忽略”也被禁用（`ignoreDisabled = disabled`）；建议允许 stale 时忽略以收起卡片。
2. 应用建议前先 `beforeSend` 落盘未保存编辑，若因此文档版本变化会提示重新生成；行为安全但可优化为“先判断版本再落盘”。
3. 建议随消息持久化包含 diff 文本，超长文档会让对话消息变大；R2b 可裁剪 diff 只留章节摘要。
4. 模板新增 key 的格式/重复校验只有代码走查，未单独自动化；后端有 key 校验，建议 R2b 补一条前端/接口测试。
5. `preview` 无文档时 `baseVersion=0`、前端回退当前版本，属边界（正常流程文档已存在）。

## R2b 完成（2026-11-11）：需求文档版本策略

上游：`docs/plans/2026-11-11-r2b-implementation-brief.md`（§1—§4）。本轮只做需求文档版本策略 + 建议消息裁剪 + R2a 两个 UX 修复；**设计/交接包版本、`base_design_version`/取消恢复语义未改**（R2c）；I-09/I-10/R4 未做。

### 后端

- `requirements/types.ts`：`RequirementDocVersionSource` 扩展为 `ai | manual | template-change | confirm | rollback | restore`；`RequirementDocVersionMeta/Detail` 增加 `changeSetId`/`changeSetSeq`。
- `requirements/doc.ts`：
  - 版本 checkpoint 化：`saveDocSection` 的 `snapshot` 默认 **false**（显式 `snapshot:true` 仍生成 `manual` 版本）；`saveDoc`（全文/章节/AI 应用）默认 snapshot true；
  - `confirmRequirementDoc` 确认时**总是生成 `confirm` 版本**（内容未变也 +1，重算 `content_md` 后快照），`startChangeSet` 的 `base_requirements_version` 因此指向已确认内容；重复确认幂等、不重复产版本；
  - `rollbackDocVersion` 来源改为 `rollback`；`switchDocTemplate` 保持 `template-change`；`restoreRequirementDocVersionConfirmed` 保持 `restore`；`reopenRequirementDoc` 不产版本；
  - 新增 `createManualDocVersion`：draft 时把当前服务器内容快照为 `manual` 版本（+1），confirmed 返回 409「文档已确认；确认版本已存在，如需新版本请先重新编辑需求」；
  - `listDocVersions`/`getDocVersion` LEFT JOIN `app_change_sets` 返回 `changeSetSeq`（变更单内版本显示 `变更 #N`；变更单删除后为 null）。
- `requirements/routes.ts`：新增 `POST /api/apps/:id/requirements-doc/versions`（手动保存版本），沿用 doc mode 守卫；路由注释更新。

### 前端

- `requirements/api.ts`：版本来源类型、`changeSetId/changeSetSeq`、`createDocVersion`。
- `requirements/RequirementsDocView.vue`：章节自动保存与结构化章节保存显式 `snapshot:false`；版本弹窗传 `before-save`（先 flush）；`saved` 事件更新文档版本。
- `requirements/VersionHistoryDialog.vue`：来源标签（确认需求/AI 应用/模板切换/版本回滚/变更取消恢复/手动保存）、`变更 #N`、顶部“保存版本”按钮（先 flush 再 POST；confirmed 禁用并提示）。
- `requirements/doc-diff.js` + `doc-diff.test.mjs`：新增 `trimSuggestion`（持久化前删除 `lineDiff`，保留 `markdownBefore`/`markdown`/applied/ignored）与 `hydrateSuggestion`（加载后按 `markdownBefore`/`markdown` 重算 modified 的 `lineDiff`）。
- `requirements/DocChatPanel.vue`：持久化前 `trimSuggestion`、加载后 `hydrateSuggestion`（建议卡展示不变）；`onApplySuggestion` 先判 `baseVersion` → flush → 再判一次，变化则提示重新生成，不静默应用。
- `requirements/AiSuggestionCard.vue`：`ignoreDisabled` 不再因 stale/readonly 禁用（仅 streaming/applied/ignored），只读/过期建议也可忽略收起。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 115/115（更新“章节保存递增版本”为自动保存不产版本；新增 confirm 版本、手动保存 + 409、rollback/restore 来源、changeSetSeq、路由手动保存） |
| `npm run smoke:requirements --prefix backend` | ✅ 扩展：自动保存不产版本、手动保存 v2/manual、变更中版本 `changeSetSeq=7`、回滚 rollback、确认 confirm 版本、确认后手动保存 409 |
| 回归 `smoke:change-set` / `smoke:design-handoff` / `smoke:design` / `smoke:handoff-input` | ✅ 全部通过 |
| `npm test --prefix frontend` | ✅ 46/46（新增 trim/hydrate 各 1 项） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整 |
| Playwright（API 预置，不依赖真实模型） | ✅ 多次编辑章节版本不变（v1）；手动保存 v2「手动保存」；确认需求生成 v3「确认需求」；变更中手动保存 v4 显示「变更 #1」；回滚生成 rollback 版本；建议消息持久化无 `lineDiff`、刷新后 diff 可展开；stale 建议「忽略」可点击；0 console error / 0 非预期 API >=400 |

E2E 脚本/截图（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\r2b-e2e`）：`01-versions-before.png`、`02-manual-version.png`、`03-confirmed-design.png`、`04-version-changeset.png`、`05-rolled-back.png`、`06-stale-suggestion.png`、`07-suggestion-after-reload.png`。

### 与交接单的澄清/偏差

1. **确认版本位置**：`confirmRequirementDoc` 在确认事务内生成 `confirm` 版本并重算 `content_md`；确认前的手动编辑仍由前端 flush（自动保存），不额外产版本。
2. **手动保存返回完整 payload**（与现有保存接口一致，含 `doc/sections/template`），前端用 `doc.version` 刷新版本号；后端未单独返回 `{version,createdAt,source}`。
3. **`changeSetSeq` 口径**：版本写入时记录 active 变更单 id；列表/详情按 id LEFT JOIN 当前变更单表，变更单被物理删除时为 null（不会报错）。
4. **“保存版本”只 flush 不校验内容**：空草稿也允许留档（不删除任何版本是本期明确策略）。
5. **建议裁剪只作用于对话持久化**：内存/UI 仍保留 `lineDiff`；加载时对 modified 且缺 diff 的条目重算，旧消息同样受益。

### 未验证 / 已知限制

- 未删除/压缩任何版本；真实使用后是否需要保留策略留后续评估。
- 设计版本、交接包版本、`base_design_version`/取消恢复语义未改（R2c）。
- Playwright 未走真实模型生成建议（R2a 已用真实模型验证建议生成；本轮用 API 预置建议验证裁剪/hydrate/stale 忽略）。
- 并发/重复点击“保存版本”会正常递增，不做幂等。

## R2b 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run build --prefix backend` ✅；`npm test --prefix backend` ✅ 115/115；`npm run smoke:requirements` ✅（自动保存不产版本、手动保存 v2/manual、变更中 `changeSetSeq=7`、回滚 rollback、确认 confirm 版本、确认后手动保存 409）；回归 `smoke:change-set` / `smoke:design-handoff` / `smoke:design` / `smoke:handoff-input` ✅；`npm test --prefix frontend` ✅ 46/46；typecheck/build ✅。走查确认：

- 自动保存（章节/结构化）显式 `snapshot:false`；`saveDoc` 全文保存仍为显式 checkpoint；确认需求必产 `confirm` 版本（保证 C1 基线与取消恢复）；手动保存 draft-only、confirmed 409。
- 版本来源完整（`confirm/rollback` 新增）；版本列表 LEFT JOIN 变更单返回 `changeSetSeq`；前端来源标签与“保存版本”按钮接好。
- `trimSuggestion`/`hydrateSuggestion` 为纯函数，持久化只裁剪副本，内存/UI 仍保留 diff；加载后 modified 条目重算。
- R2a 两个 UX 修复落地：stale/只读可“忽略”；应用建议先判 `baseVersion` → flush → 再判，变化不静默应用。

结论：**R2b 可以验收**。观察项（不阻塞）：

1. 确认需求总会生成 `confirm` 版本（内容未变也 +1），版本列表可能出现内容相同的“确认需求”版本；这是为保证变更基线/取消恢复完整性，接受。
2. 全文源码“保存全文”仍每次生成版本（显式动作），可接受；若后续觉得多，可改成显式选择。
3. 版本弹窗“当前 vN”是 checkpoint 版本，自动保存后的内容可能更新；已有“自动保存不会生成版本”提示，后续可加“有未保存版本变化”标识。
4. 空草稿允许手动保存版本（本期策略），后续如需可限制。
5. 未做版本保留/裁剪（本期明确不做）。

## I-10 完成（2026-11-11）：开发会话列表

上游：`docs/plans/2026-11-11-i10-implementation-brief.md`、`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.4。本轮只做 I-10；**不做**消息数/工具数、I-09（compact/分阶段）、R2c、R4；不改交接包/需求/设计版本语义。

### 数据与后端

- `app_sessions` 新增 `title`/`note`（建表 + `ensureColumn` 旧库补列）。
- `backend/src/dev/service.ts`：
  - `listDevSessions`：应用全部会话（按 `created_at DESC`），best-effort 合并 `opencode.listSessions(directory,100)`；opencode 未运行时**不强行启动**，`opencodeExists=null`（不误判 stale）；返回 `title/note/displayTitle/opencodeTitle/status/model/changeSetSeq/changeSetTitle/changeSetStatus/handoffVersion/handoffHash/opencodeExists/active`。
  - `displayTitle` 回退：工作台标题 → opencode 标题 → `<应用名> · <创建时间>`。
  - 新会话默认标题：`<应用名> 开发 · MM-DD HH:mm`；opencode 会话标题仍为 `<应用名> 开发`。
  - `activateDevSession`：归属校验（跨应用 404）；目标 opencode 不存在 → 标记 `stale` + 409；当前 active 先 best-effort `interrupt` 再归档，目标置 active；返回目标开发状态；事件 `session-activated`。
  - `renameDevSession`：`title` trim ≤120/`note` ≤500；空 title 清除回退；只改工作台记录。
  - `archiveDevSessionById`：幂等；active 先 best-effort `interrupt` 再归档；归档后允许无 active；不删除 opencode 数据。
  - `getDevState(appId,{sessionId})`：指定会话读取；非 active `readOnly=true`；opencode 不存在标记 stale + `session + state=null`；不传 sessionId 保持原行为。
- `backend/src/dev/routes.ts`：
  - `GET /development?sessionId=`；
  - `GET /development/sessions`；
  - `POST /development/sessions/:sid/activate`；
  - `PATCH /development/sessions/:sid`；
  - `POST /development/sessions/:sid/archive`。
- 新建/首条提示文案更新为“当前会话会归档，新会话不会自动接续旧上下文；旧会话保留在左侧列表，可随时查看/恢复”。

### 前端

- `frontend/src/dev/session-labels.js` + `session-labels.test.mjs`（纯逻辑）：变更单分组/排序、组标题、displayTitle 回退、状态标签、搜索、时间/模型简写、交接包版本差异。
- `frontend/src/dev/SessionList.vue`：约 260px 会话栏；顶部“开发会话 + 新会话 + 搜索”；按 `changeSetSeq` 倒序分组（`初始开发` / `变更 #N · 标题` / `早期会话`），组头状态 + `交接包 vZ` + 数量，默认展开 active 组；列表项标题/时间/模型/状态/handoff 版本，active 高亮；hover 重命名/归档/恢复；搜索无结果空状态。
- `frontend/src/dev/DevView.vue`：三栏布局（左会话栏 + 中时间线 + 右 aside），窄屏（<1100px）默认折叠、展开为覆盖层；归档会话只读（Composer 替换为只读横幅 + “恢复为当前会话”，顶部“只读 · 已归档”，停止隐藏）；权限/表单卡片只展示并禁用操作；归档 active 后清空时间线并显示“选择或新建会话”；恢复时若 handoff 版本不同提示“基于旧交接包，建议新建会话”；新会话提示文案更新。
- `PermissionCard.vue` / `FormCard.vue` 增加 `readonly` prop，禁用操作/提交。
- `api.ts` / `types.ts`：会话列表/切换/重命名/归档 API；`readOnly`、`DevSessionListItem` 类型。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 116/116（新增 I-10：列表/opencodeExists=null、displayTitle、activate interrupt+归档、rename 长度/清除、archive 幂等/无 active、只读、stale 409、跨应用 404、非 active 回复拒绝） |
| `npm run smoke:dev-sessions --prefix backend` | ✅ 真实 Express + 临时 SQLite/projects + 真实 opencode 2.2.5（不调用模型）：doc 应用 → 交接包 v1 → 会话 A → 新会话 B（A 归档）→ 列表字段/Change Set #1/opencodeExists → 重命名/超长 400 → 只读 A → 恢复 A（B 归档）→ 归档 A（无 active）→ 新建 C → 失效目标 stale+409 → 删除清理 |
| `npm run smoke:dev --prefix backend` | ✅ 真实 opencode + `packycode-deepseek/deepseek-flash`：交接包 → 建会话 → 真实模型回复「收到」→ serve 重启恢复 → 完成/继续 → 停止 → 删除 |
| `npm run smoke:change-set` / `smoke:design-handoff` / `smoke:requirements` | ✅ 回归通过 |
| `npm test --prefix frontend` | ✅ 54/54（新增 session-labels 8 项） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整 |
| Playwright（API/真实 opencode 预置，不调用模型） | ✅ 变更单分组（初始开发 / 变更 #2 + 交接包版本）、active 高亮、重命名、搜索、归档只读（Composer 隐藏、只读横幅、权限/表单按钮禁用）、旧交接包恢复提示、恢复后 active 切换、归档 active 空状态、新建会话；0 console error / 0 非预期 API >=400 |

E2E 脚本/截图（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\i10-e2e`）：`01-groups-active.png`、`02-renamed.png`、`03-archived-readonly.png`、`04-restore-warning.png`、`05-restored-active.png`、`06-archived-empty.png`、`07-new-session.png`。

### 偏差 / 未验证 / 已知限制

- **`smoke:dev` 适配 doc 模式**：原脚本用旧 structured 应用（写 workspace/模块）完成需求，R1 起新应用默认 doc 模式，`stage/confirm requirements` 走文档确认会 400。本轮把该冒烟改为 doc 需求/设计/交接包种子，验证内容不变（建会话/真实模型/恢复/完成/停止）。这是测试脚本适配，不是产品行为变更。
- **列表不启动 opencode**：`GET /development/sessions` 只在 opencode 已运行时合并标题/存在性；未运行时 `opencodeExists=null`，避免列表页把服务拉起或误判失效。打开开发页时 `GET /development` 会启动/恢复会话，随后列表刷新即可补齐。
- **列表最多合并 100 个 opencode 会话**：更早的会话可能 `opencodeExists=false`，但列表**不会**据此自动改 `stale`；只有显式读取/切换目标时才标记 stale。
- **切换确认**：点击归档会话只读查看不弹确认（不改变 active）；恢复/归档/新会话前二次确认；切换 active 的实际入口是恢复，服务端先 interrupt 再归档。
- **未做消息数/工具数、会话摘要、跨应用混排、删除 opencode 会话、按日期分组、I-09 compact/分阶段**（按交接单边界）。
- **权限/表单只读禁用**由 Playwright 路由注入 pending 验证；真实归档会话若没有 pending 则不显示卡片。
- 旧 structured 应用仍可用会话列表；没有 `change_set_id` 的旧会话归“早期会话”。

## I-10 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run build --prefix backend` ✅；`npm test --prefix backend` ✅ 116/116；`npm run smoke:dev-sessions` ✅（真实 opencode 2.2.5：列表/Change Set #1/opencodeExists/重命名/只读/恢复/归档 active 无 active/新建/失效 409/删除）；`smoke:change-set` / `smoke:design-handoff` / `smoke:requirements` ✅ 回归；`npm test --prefix frontend` ✅ 54/54；typecheck/build ✅。走查确认：

- 会话归属校验完整（跨应用 404）；`?sessionId=` 只读；归档会话 Composer/权限/表单只读。
- 切换/归档 active 前 best-effort `interrupt`，不会出现两个会话同时写目录；目标 opencode 不存在时标 stale + 409。
- 按变更单分组（seq 倒序、无归属归“早期会话”）；active 高亮；旧交接包恢复提示；`opencodeExists=null` 不误判 stale。
- 新会话默认标题唯一（应用名 · 时间），旧会话回退创建时间；搜索标题/备注。

结论：**I-10 可以验收**。观察项（不阻塞）：

1. 旧会话（title=null、opencode 标题为通用“应用名 开发”）会显示相同标题，靠时间区分；可后续给旧标题加创建时间后缀。
2. stale 会话目前只能重命名，没有“归档”清理入口；可后续补。
3. 备注 `note` API 支持但列表没有编辑入口（只读展示）；按需补。
4. `listDevSessions` 不主动启动 opencode（有意）；首次打开开发页后列表刷新才补齐 `opencodeExists`。
5. `smoke:dev` 改为 doc 模式种子（测试脚本适配，产品行为未变）。

## I-09a 完成（2026-11-11）：会话健康度 + 原生 compact

上游：`docs/plans/2026-11-11-i09a-implementation-brief.md`、`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.1/§4.3.5。本轮只做 **I-09a**；**不做** I-09b（分阶段/交接包规模/03-PLAN 建议）、自动 compact、时长/消息/工具阈值提示、R2c、R4；未改 I-10 会话列表/切换/归档语义。

### 后端

- `OpencodeRuntime.compactSession(id)`：`POST /api/session/{id}/compact` body `{}`；非 2xx 转可读错误（4xx 原样、5xx→502、文本脱敏）。
- `dev/timeline.ts`：
  - `DevProgress.context = { used, limit, percent, level }`；`used` 取**最新** assistant 消息的 `input + cache.read + cache.write`（无 tokens 回退更早 assistant；无 assistant 为 0）；**不用**会话聚合 `info.tokens`（聚合值仍在 `stats.tokens`）。
  - `normalizeMessages` 识别 `type:'compaction'` → `kind:'compaction'` + “上下文已压缩”（不当 assistant 文本）；`status:'failed'`（空会话 compact）→ `kind:'compaction-failed'` + “上下文压缩未执行：<原因>”。
  - `buildSteps` 把 compaction 当作步骤边界。
- `dev/service.ts`：
  - `modelContextLimit(dir, provider, model)`：按 `directory+provider/model` 60s TTL 缓存；opencode 未就绪**不启动**、返回 null（不缓存）；查不到 `limit.context` → null。
  - `contextWithLimit(used, limit)`：`percent = used/limit`；`level` ≥0.85 danger / ≥0.6 warn / 否则 ok；limit 未知 → `percent=null, level='unknown'`。
  - `stateFor()` 补齐 `context.limit/percent/level`（archived 只读会话同样补齐）。
  - `compactDevSession(appId)`：`assertDevReady` + active 会话（无 active → 409「当前没有进行中的开发会话」）→ 原生 compact → 事件 `context-compacted` → `{ ok:true, message:'已请求压缩上下文，将在下一步生效' }`；opencode 错误带 status 透传。
- `dev/routes.ts`：`POST /api/apps/:id/development/compact`。

### 前端

- `frontend/src/dev/dev-health.js` + `dev-health.test.mjs`（纯逻辑）：`formatTokenCount`（`65k`/`1.05M`）、`contextLevel`（0/59.9/60/85/100/null）、`contextPercent`、`contextLabel`（`上下文 62% (65k / 1.05M)` / `上下文 65k` / `上下文 —`）、`contextDetail`、`contextTitle`、`contextHint`、`contextNeedsCompact`。
- `DevView.vue`：
  - 顶部上下文 chip（ok 灰 / warn 黄 / danger 红，`title` 标注“约”）；
  - `压缩上下文` 按钮：仅 active 非只读，warn/danger 高亮，`actionBusy='compact'` 期间禁用；
  - warn/danger 提示条（时间线上方）+ 条内压缩按钮；只读会话不显示提示条/按钮，chip 仍显示；
  - 时间线 compaction 轻量提示（失败为红色“未执行”）；右侧会话卡补充“消息/上下文”（耗时/工具/Token 保留）；
  - 二次确认：`压缩会用总结替换较早上下文，可能丢失细节；当前会话与代码不会中断。继续？`；成功提示 `已请求压缩，将在下一步生效`。
- `api.ts` / `types.ts`：`compactDevSession`、`DevContextUsage`、`DevSessionMessage.kind`。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 123/123（新增 7：context used/无 assistant 为 0、compaction 归一化/failed、contextWithLimit 边界、limit 补齐/归档只读/无 limit/opencode 未就绪、compact 409/成功/错误透传） |
| `npm run smoke:dev-health --prefix backend` | ✅ 真实 opencode 2.2.5（不调用模型）：doc 应用 + 交接包 → 新建会话 context（used=0、limit=1048576 与 `/api/opencode/models` 的 `limit.context` 一致）→ compact 200 → 时间线 compaction 提示 → 无 active compact 409 → 删除 |
| `npm run smoke:dev-sessions` / `smoke:dev` / `smoke:change-set` / `smoke:design-handoff` / `smoke:requirements` | ✅ 全部 exit=0（`smoke:dev` 含真实模型回复） |
| `npm test --prefix frontend` | ✅ 60/60（新增 dev-health 6 项） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整 |
| Playwright（真实 opencode，不调用模型；warn/danger 用路由注入） | ✅ 真实 0% chip / warn 62%（黄 chip + 提示条 + 高亮按钮 + 右侧卡 62% · 65k / 1.05M）/ danger 88%（红）/ 点击压缩 → 二次确认 → `POST /development/compact` 200 + 成功提示 + 时间线提示 / 只读归档会话 chip 仍在且无按钮与提示条；0 console error / 0 非预期 API >=400 |

E2E 脚本/截图（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\i09a-e2e`）：`01-context-ok.png`、`02-context-warn.png`、`03-context-danger.png`、`04-compacted.png`、`05-readonly-no-compact.png`。

### 偏差 / 未验证 / 已知限制

- **空会话 compact 仍返回 200，但时间线如实提示“未执行”**（实测 opencode 2.2.5：`{type:'compaction', status:'failed', error:{type:'compaction.unavailable', message:'Nothing to compact yet'}}`）。API 契约仍按交接单返回 `{ok:true, message:'已请求压缩上下文，将在下一步生效'}`（“已请求”）；时间线按 `status` 区分成功/失败文案。**待主会话确认**该口径是否可接受，或后续把 compact 结果回传到 API。
- **真实压缩成功路径未验证**：冒烟/E2E 不调用模型，只覆盖“空会话 failed 提示 + 请求 200”；`status:'completed'` 的“上下文已压缩”由单测（合成消息）覆盖，建议在有真实长会话时补一次人工验证。
- `used` 是近似值（最新一轮 assistant 的 input+cache），chip tooltip 已标注“约”；压缩后需新 assistant 消息才回落（不强制即时变化）。
- 模型 limit 60s 缓存：切换模型后最长 60s 内可能仍显示旧 limit；opencode 未就绪时不缓存、不启动。
- 未做：I-09b 分阶段、自动 compact、时长/消息/工具阈值提示（只展示）。

## I-09a 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run build --prefix backend` ✅；`npm test --prefix backend` ✅ 123/123；`npm run smoke:dev-health` ✅（真实 opencode 2.2.5：新会话 context used=0/limit=1048576（与模型 limit.context 一致）→ compact 200 → 时间线 compaction → 无 active compact 409 → 删除）；回归 `smoke:dev-sessions` / `smoke:change-set` / `smoke:design-handoff` / `smoke:requirements` ✅；`npm test --prefix frontend` ✅ 60/60；typecheck/build ✅。走查确认：

- 上下文用量取**最新 assistant** 的 `input + cache.read + cache.write`，不用会话聚合；无 assistant 为 0；limit 来自模型 `limit.context`（60s 缓存，opencode 未就绪不启动）。
- 阈值 60% 黄 / 85% 红；limit 缺失显示 token 数、level unknown；chip/提示条/右侧卡/只读行为符合交接单。
- `compactSession` 调 `POST /api/session/{id}/compact {}`；仅 active、无 active 409、事件 `context-compacted`；`type:'compaction'` 归一化为轻量系统提示，失败按 status 区分并脱敏原因。
- 前端压缩按钮仅 active 非只读；二次确认；warn/danger 高亮；只读不显示提示条/按钮。

结论：**I-09a 可以验收**。接受实施会话的偏差 1（空会话 compact 由 opencode 返回 200 + 时间线如实提示“没有可压缩的上下文”），但建议把成功 toast 从“将在下一步生效”改为“已提交压缩请求，结果见时间线”，避免与时间线矛盾；作为小修随 R2c/R4 处理。

其他观察项（不阻塞）：

1. `used` 为近似值（最新一轮 assistant input+cache），chip 已有“约”说明；压缩后需新一轮 assistant 才回落。
2. 模型 limit 缓存 60s，切模型后最多 60s 内可能显示旧 limit。
3. `percent` 不封顶（used > limit 时可能显示 >100%）；可后续显示上限或标注“约”。
4. 真实长会话压缩后的 `completed` 路径只由合成消息单测覆盖；建议有真实长会话时人工压缩一次。

## R2c 完成（2026-11-11）：设计版本策略

上游：`docs/plans/2026-11-11-r2c-implementation-brief.md`（§1—§4）。本轮只做设计版本 checkpoint 化、确认设计留档、手动“保存版本”、版本来源/变更单标签；顺手修 I-09a compact toast 文案。**不做** I-09b、R4；不改需求版本策略、交接包版本语义。

### 后端

- `design/types.ts`：`DesignVersionSource` 扩展为 `ai | manual | template-change | confirm | sync | rollback | restore`；版本 Meta 增加 `changeSetId/changeSetSeq/changeSetTitle`。
- `design/service.ts`：
  - 自动保存 checkpoint 化：`saveEntities`/`savePageSets`/`savePageSet`/`savePage` 默认只更新内容 + `updated_at`，不递增版本；内部 `{ snapshot:true }` 供 AI 生成/应用显式产版本。
  - `bumpVersion` 拆为 `appendVersion`（关键节点 +1 并写快照）与 `touchProject`；关键节点来源：`confirm`（确认设计，总是 +1，重复确认幂等）、`template-change`、`sync`、`rollback`、`restore`、`manual`（手动保存/默认页面集生成）、`ai`（生成/应用）。
  - `confirmDesign` 在确认事务内写 `confirm` 快照并用新版本号更新 active 变更单（C1 `base_design_version`/取消恢复指向已确认快照）。
  - 新增 `createDesignVersion`：draft 快照为 `manual`（+1）；confirmed 409「设计已确认；确认版本已存在，如需新版本请先重新编辑设计」。
  - `listDesignVersions`/`getDesignVersion` LEFT JOIN `app_change_sets` 返回 `changeSetSeq/changeSetTitle`；`savePageSnapshot` 保持不产版本。
- `design/routes.ts`：新增 `POST /api/apps/:id/design/versions`；保存接口接受 `snapshot:true`。

### 前端

- `DesignVersionsDialog.vue`：来源标签（确认设计/AI 生成/模板切换/同步设计输入/版本回滚/变更取消恢复/手动保存）、`变更 #N`、顶部“保存版本”（先 flush；confirmed 禁用并提示）、“自动保存不会生成版本”、回滚文案补“不恢复原型截图”、版本快照不含 PNG/HTML 说明。
- `PrototypeTab.vue` / `DesignStudio.vue`：版本弹窗复用 `flushSave`；切 Tab 先落盘当前编辑；`DesignChatPanel` AI 应用显式 `snapshot:true`。
- `version-labels.js` + 单测；`EntityDesignTab` 保存提示去掉版本号。
- `DevView.vue`：compact 成功提示改为“已提交压缩请求，结果见时间线”。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 126/126（新增自动保存不产版本、单实体确认、confirm 总是 +1/source、AI snapshot、sync/restore、手动保存 + 409、changeSetSeq、PNG 不产版本） |
| `npm run smoke:design --prefix backend` | ✅ 自动保存/页面规格/PNG/单实体确认不产版本；确认设计 confirm v3；重复确认不产版本；确认后手动保存 409；手动保存 v5/v6；模板切换来源 |
| 回归 `smoke:design-handoff` / `smoke:handoff-input` / `smoke:change-set` / `smoke:requirements` / `smoke:dev-health` | ✅ 全部通过（dev-health 真实 opencode 2.2.5） |
| `npm test --prefix frontend` | ✅ 63/63（新增版本来源/变更单标签 3 项） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整 |
| Playwright（API 预置，不依赖模型） | ✅ 编辑实体/页面多次版本不变（v2）；手动保存 v3「手动保存」+ 变更 #2；确认实体/页面集不产版本；确认设计 v4「确认设计」；确认后保存禁用；重新编辑后手动保存 v5、回滚 v6「版本回滚」；回滚提示“不恢复原型截图”；compact toast 文案；0 console error / 0 非预期 API >=400 |

E2E 脚本/截图（临时目录 `C:\Users\icecream\AppData\Local\Temp\opencode\r2c-e2e`）：`00-design-studio.png`、`01-draft-versions.png`、`02-manual-version.png`、`03-confirmed-versions.png`、`04-rollback-confirm.png`、`05-reopened-manual.png`、`06-rolled-back.png`、`07-compact-toast.png`。

### 与交接单的澄清/偏差

1. 默认页面集生成保持 `manual` checkpoint（交接单 §2.3），UI 来源显示“手动保存”。
2. `POST /design/versions` 返回完整 `DesignProjectPayload`。
3. `changeSetSeq/changeSetTitle` 按写入时 active 变更单 id LEFT JOIN；变更单删除后为 null，`changeSetId` 仍保留历史列值。
4. 版本弹窗由页面原型 Tab 承载；切换 Tab 时先 flush，避免保存版本读到未落盘编辑。
5. 快照只存实体/页面集 JSON，不含 PNG/HTML 文件内容；页面对象保留 `imagePath/htmlPath` 引用（与 D5 现状一致，避免取消恢复后交接包缺图），回滚不会重写或重截截图文件。
6. AI 生成真实模型路径未在 R2c 重跑（`snapshot:true` 单测覆盖；真实模型生成已在 D1—D4/R2a 验证）。

### 未验证 / 已知限制

- 未删除/压缩任何设计版本（明确不做）。
- 旧数据（R2c 之前已确认的设计）没有 `confirm` 快照；其 `base_design_version` 指向最近一次保存版本，取消恢复仍可用但不保证“已确认态快照”。重新编辑并确认一次即可补齐，未做数据回填。
- 真实长会话 compact 成功路径仍只由单测/route mock 覆盖（I-09a 既有未验证项）。
- Playwright 的 compact 用路由注入 mock，不启动 opencode。

## R2c 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run build --prefix backend` ✅；`npm test --prefix backend` ✅ 126/126；`npm run smoke:design` ✅（自动保存/页面规格/PNG/单实体确认不产版本；确认设计 confirm v3；确认后手动保存 409；手动保存 v5/v6；模板切换）；回归 `smoke:design-handoff` / `smoke:handoff-input` / `smoke:change-set` / `smoke:requirements` / `smoke:dev-health` ✅；`npm test --prefix frontend` ✅ 63/63；typecheck/build ✅。走查确认：

- `saveEntities`/`savePageSets`/`savePageSet`/`savePage` 默认 `touchProject`，不递增/不写快照；AI 生成显式 `{snapshot:true}`；模板切换/同步/回滚/恢复走 `appendVersion`。
- `confirmDesign` 在事务内 +1 并写 `confirm` 快照，`updateActiveChangeSet` 用新版本；C1 `base_design_version`/取消恢复指向已确认快照。
- 手动保存 draft-only、confirmed 409；版本列表/详情返回 `changeSetSeq/changeSetTitle`；PNG 快照不产版本。
- 前端版本弹窗来源标签/变更单/保存版本（先 flush）、回滚文案“不恢复原型截图”；I-09a compact toast 已改。

结论：**R2c 可以验收**。观察项（不阻塞）：

1. 默认页面集生成来源仍是 `manual`，UI 显示“手动保存”；如需区分可后续加 `generate` 来源。
2. R2c 之前已确认的旧设计没有 `confirm` 快照；`base_design_version` 指向最近一次保存版本，取消恢复可用但不保证“已确认态”快照；重新编辑并确认一次即可补齐，未做回填。
3. 快照保留页面的 `imagePath/htmlPath` 引用但不含图片文件；回滚/取消恢复不会重写截图；若之后重截同名文件，旧版本会显示新图（D5 既有边界）。
4. 空设计也允许手动保存版本；确认设计总是 +1（重复 reopen→confirm 会增加版本）；接受。
5. 版本不删除/不裁剪（本期明确不做）。

## R4a 完成（2026-11-11）：安全清理

上游：`docs/plans/2026-11-11-r4a-implementation-brief.md`（§1—§4）。本轮只做**无行为变更**的死代码/legacy 清理；**未动** structured 兼容路径（旧场景/卡片/批次/旧设计面板 UI）、应用登记与目录、数据库数据、交接包内容与接口，属 R4b/R4c。

### 删除/修改

| 项 | 处理 |
| --- | --- |
| `legacy/`（`backend-dev/`、`frontend-dev-ui/`，10 个文件） | 删除；`package.json`/`tsconfig`/构建脚本/冒烟脚本无引用；README 目录树、`db.ts`/`index.ts` 注释同步 |
| `frontend/src/requirements/DesignPending.vue` | 删除；无 import/挂载（设计阶段由 `DesignStudio` 承载） |
| `backend/src/design/routes.ts#designErrorHandler` | 删除（从未注册；实际由 `appsErrorHandler` 处理），并移除随之无用的 `DesignError` import |
| `frontend/src/design/DesignHandoffDialog.vue` | `v-if="mode === 'view'"` 改为 `props.mode === 'view'`（原条件被本地 ref 遮蔽，永不成立） |
| `backend/src/apps/routes.ts#templateDirExists` | 删除（零引用诊断函数），移除无用 `node:path` import |
| `backend/src/changesets/query.ts` | 删除零引用 `CLOSED_CHANGE_SET_STATUSES`、`ChangeSetStatus` |
| `backend/src/changesets/service.ts` | 删除零引用 `completeActiveChangeSetRow`、`latestChangeSetView`，移除无用 `latestChangeSetRow` import |
| `backend/src/design/input.ts` | 删除零引用 `requirementFingerprint`、`emptyDiff` |
| `backend/src/design/prompt.ts` | 删除零引用 `clipDesignJson` 与 `MAX_JSON_CHARS` |
| `backend/src/design/types.ts` | 删除零引用 `DesignProjectSummary` |
| `backend/src/handoff/design-types.ts` | 删除零引用 `DesignHandoffPrototypeFile` |
| `backend/src/requirements/builtin-templates.ts` | 删除零引用 `REQUIREMENTS_TEMPLATES` |
| `backend/src/requirements/doc.ts` | 删除零引用 `confirmRequirementDocForStage`、`assertSections`，移除无用 import |
| `backend/src/requirements/outline.ts` | 删除零引用 `outlineSummary` |

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 126/126（无删除测试；计数与 R2c 一致） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `npm test --prefix frontend` | ✅ 63/63 |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整 |
| `npm run smoke:design` | ✅ 自动保存/页面规格/PNG/确认设计 confirm/手动保存/模板切换通过 |
| `npm run smoke:design-handoff` | ✅ 预览/生成 v1/v2、PNG 缺失阻塞、完成关闭 CS #1 通过 |
| `npm run smoke:handoff-input` | ✅ 设计输入/覆盖度/stale/reopen/diff/sync/regenerate 通过 |
| `npm run smoke:change-set` | ✅ CS #2/#3、取消恢复、scope 升级通过 |
| `npm run smoke:requirements` | ✅ 模板/自动保存/版本/建议/确认/structured 守卫通过 |
| `npm run smoke:dev-sessions` | ✅ 真实 opencode 2.2.5：列表/重命名/归档只读/切换/失效通过 |
| `npm run smoke:dev-health` | ✅ 真实 opencode 2.2.5：context/limit/compact/时间线提示/无 active 409 通过 |
| 全局搜索 | ✅ 无 `legacy/`、`DesignPending`、`designErrorHandler` 代码引用（`docs/` 历史记录保留） |

### 偏差 / 留给 R4b

1. `frontend/src/requirements-grooming/` 下仍有多处**零引用**旧 UI（`agent/store.ts`、`ui/design/DataModelPanel|NavGraph|PageRoutePanel|PointSpecGraph`、`ui/doc/DocMetaSection|FreeSectionBlock`、`ui/ModuleDialog`、`ui/TemplateDialog`、`ui/panels/IssuePanel|ValidationPanel`、`ui/shared/HistoryDrawer`）。它们属于 structured/旧需求-设计 UI 兼容面，按交接单**保留给 R4b**。
2. `backend/src/agents/{prompts,queue,types}.ts` 仍有零引用导出（`REVIEW_SYSTEM`、`decomposeBrief`、`updateTask`、`TaskStatus`、`TaskEmitter`）与未挂载的前端 `useAgentTasksStore`；同属 structured 需求分析兼容面，**保留给 R4b** 一并判断。
3. 未改任何接口、数据库、交接包内容、版本语义；未删应用登记/目录/数据库数据。
4. 历史文档（`docs/plans/2026-11-04-*`、`docs/plans/2026-11-09-implementation-tasks.md` 等）中的 `legacy/` 描述按“历史记录”保留。

## R4a 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run build --prefix backend` ✅；`npm test --prefix backend` ✅ 126/126；`npm test --prefix frontend` ✅ 63/63；typecheck/build ✅；`legacy/`、`DesignPending.vue`、`designErrorHandler` 已无残留；`DesignHandoffDialog` 的 `props.mode` 条件已修正。

代码走查确认：删除项均为零引用/未挂载；`legacy/`、`DesignPending` 无引用；`templateDirExists`/旧 query 常量/旧导出删除后 build 通过；未改接口/数据库/交接包/版本语义。实施会话保留的 `requirements-grooming/` 旧 UI 与 `agents` 零引用导出属 structured 兼容面，正确留给 R4b。

结论：**R4a 可以验收**。下一步 R4b（拆 R4b-1 前端 shared 抽取 + 旧 UI 删除；R4b-2 后端 structured 删除 + 旧应用登记/目录删除）。

## R4b-1 完成（2026-11-11）：前端 shared 抽取 + 旧 structured UI 删除

上游：`docs/plans/2026-11-11-r4b1-implementation-brief.md`。本轮只动前端：抽取 doc/design 仍依赖的 shared 模块后删除旧 structured UI；**未改后端、接口、数据库、应用登记与目录**（R4b-2/R4c）。

### 抽取映射

| 从 | 到 | 说明 |
| --- | --- | --- |
| `requirements-grooming/styles/theme.css` | `frontend/src/shared/theme.css` | 全局 token/Element Plus 覆盖；`App.vue` 引入 |
| `requirements-grooming/pinia-setup.ts` | `frontend/src/shared/pinia.ts` | Pinia 环境兜底（`main.ts` 已建 pinia，保留 MF 兜底） |
| `requirements-grooming/storage/local.ts` | `frontend/src/shared/storage.ts` | `loadJson/saveJson/removeKey` |
| `storage/workspace-persist.ts` 的 activeAppId | `frontend/src/shared/app-context.ts` | 仅 `setActiveAppId/getActiveAppId`；workspace 水合/wsReady/落库全部删除 |
| `requirements-grooming/settings/store.ts` | `frontend/src/settings/store.ts` | 依赖改 `shared/storage` + `shared/app-context`；删除无人使用的 `setTheme/toggleTheme/isConfigured`（主题读取/应用保留） |
| `requirements-grooming/ui/SettingsDialog.vue` | `frontend/src/settings/SettingsDialog.vue` | 模型设置弹窗 |
| `conversation/protocol-output.js` + 单测 | `frontend/src/shared/protocol-output.js` + `.test.mjs` | `requirements/doc-protocol.js`、`design/design-protocol.js` 引用更新 |
| `ui/prototype/`（除 `PrototypePanel.vue`）+ `spec/types.ts` | `frontend/src/design/prototype/`（`spec-types.ts`/`refs.ts` + 13 个线框组件/CSS） | `PrototypeCanvas.vue` import 更新；渲染行为不变 |

`design/prototype/spec-types.ts` 只保留线框渲染实际使用的类型（实体/字段/页面/布局/批注等）；`refs.ts` 保留纯解析（`parseEntityRef`）与 `findEntityInModule`（设计阶段无模块工作区，恒为空，与抽取前一致），不再依赖旧 workspace store。同时删除抽取后零引用的 `resolvePageEntity`、`sanitizeBlocks`。

### 删除

| 项 | 处理 |
| --- | --- |
| `frontend/src/requirements-grooming/`（整个目录） | 删除（MainApp、场景树、卡片、批次、diff/undo/actions、spec 对话/llm、旧模板/旧设计面板、TestView/DesignView、workspace/spec/conversation/test/agent store 等） |
| `frontend/src/workbench/HandoffDialog.vue` | 删除（旧 P3 structured 交接包弹窗） |
| `frontend/e2e-flow.ts` | 删除（旧 structured 全流程驱动脚本，非 package.json 命令、不在 tsconfig） |
| `frontend` 依赖 `ajv`、`monaco-editor`；`vite.config.ts` monaco chunk | 删除（仅旧 requirements-grooming 使用；`package-lock.json` 同步） |

### 简化

- `App.vue`：只保留路由 + `AppShell`/`HomeShell`；引入 `shared/theme.css`、`shared/pinia`；进入应用时 `setActiveAppId` + `settings.init()`；移除 workspace/wsReady/doc-template/conversation/ui store 水合与 boot 遮罩，渲染不再等待 ready。
- `AppShell.vue`：移除 `MainApp`、`HandoffDialog`、`docMode` 分支与 `ui.activeView`；需求文档/设计 Studio/开发页为唯一渲染路径；顶栏只保留“确认完成开发”（需求/设计确认由文档视图与 DesignStudio 负责）。
- `HomeShell.vue`：移除 structured 统计（`需求点/已确认`），统一显示需求文档版本/状态/模板。
- `workbench/api.ts`：移除 `RequirementsMode`、`AppInfo.stats/requirementsMode`、旧 `HandoffMeta/HandoffFile*`/预览/生成/读取类型与 `previewHandoff/generateHandoff/getHandoff/confirmStage`、`AppIssue`；`ApiError` 收敛为 `{status,message}`。
- `dev/DevView.vue` 交接包读取固定走设计交接包（原 `requirementsMode === 'doc'` 分支），`dev/types.ts` 去掉 `requirementsMode`。
- `check-vue-imports.cjs`：改为扫描整个 `src/`，移除已删除 store 的导入清单；`package.json` test 路径指向 `src/shared/protocol-output.test.mjs`。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过（无 monaco 空 chunk） |
| `npm test --prefix frontend` | ✅ 63/63 |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整（扫描整个 src） |
| `npm test --prefix backend` | ✅ 126/126（本批未改后端，基线不变） |
| 全局搜索 | ✅ `frontend/` 无 `requirements-grooming`/`wsReady`/`useConversationStore`/`useDocTemplateStore`/`useUiStore`/`useSpecStore`/`useWorkspaceStore`/旧 `HandoffDialog.vue` 残留（`DesignHandoffDialog` 属现役组件） |
| Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3400，`OPENCODE_AUTO_START=false`） | ✅ 首页/需求文档（确认后只读）/设计 Studio（页面原型 wireframe 实际渲染）/开发页/变更历史弹窗/模型设置弹窗均可打开；0 console error、0 page error、0 意外 API >=400；截图在临时目录 `r4b1-e2e/shots` |

Playwright 预置（仅临时数据目录）：创建 doc 应用 → 补全必需章节并确认需求 → `PUT /design/entities` + `POST /design/page-sets/generate {mode:'default'}` → 临时写入一条 `design_handoffs` 摘要与 `docs/handoff/00-README.md` 并把应用推进到开发阶段（为打开开发页 UI；不代表真实设计确认）。模型设置使用真实 opencode（弹出时显示“已连接 2.2.5”，模型 `packycode-deepseek/deepseek-flash`）。

### 偏差 / 需 R4b-2 处理

1. **后端未改**：`backend/src/apps/payload.ts` 仍返回 `requirementsMode/stats`，`/api/workspace`、`/api/modules/*`、`/api/agents`、旧 `handoffs` 表/接口仍在；`backend/src/index.ts` 注释仍写“沿用 requirements-grooming”。前端已忽略这些字段/接口，删除留 R4b-2。
2. 现有真实 DB 里 2 个 structured 应用在本批后前端不可打开（`appPayload` 仍把它们标成 `structured`，但前端只剩 doc 路径；需求阶段会落到 `RequirementsDocView` 并因 409 不可用）。按交接单属预期，旧应用登记/目录与 demo 数据由 R4b-2/R4c 删除。
3. `frontend/package.json` 仍保留 `@element-plus/icons-vue`（未在 src 直接 import，属 Element Plus 生态可选依赖）与 `ai-dev-workbench: file:..`（本地文件依赖）；未在本批处理。
4. 原型跨模块引用（`moduleId:entityId`）与关系子表在设计阶段仍不解析（与抽取前一致：旧实现查 `module 'design'` 同样为空），如需支持应作为设计阶段功能，不在清理范围。
5. 未做视觉/响应式打磨；未跑后端冒烟脚本（本批未改后端，已用 126 测试做基线；真实 opencode 相关冒烟留待评审会话按需复跑）。

## R4b-1 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run typecheck --prefix frontend` ✅；`npm run build --prefix frontend` ✅（bundle 从 ~1.17MB 降到 647KB，monaco/ajv 移除）；`npm test --prefix frontend` ✅ 63/63；`npm test --prefix backend` ✅ 126/126（未改后端）。`requirements-grooming/`、`workbench/HandoffDialog.vue` 已删除；`shared/`、`settings/`、`design/prototype/`（16 文件）已抽取；`App.vue`/`AppShell`/`HomeShell` 已收敛为 doc/design/dev 单模式（无 `MainApp`/`docMode`/`ui.activeView`/structured stats）。

结论：**R4b-1 可以验收**。实施会话的抽取/裁剪（`spec-types` 只保留渲染所需类型、`layout.ts` 零引用导出、`settings` 未用方法、`ApiError` 收敛）合理；Playwright 临时数据验证了需求/设计原型/开发/变更历史/模型设置，0 console error/0 意外 API >=400。

观察项（不阻塞）：

1. `@element-plus/icons-vue`、`ai-dev-workbench: file:..` 依赖未处理（R4c/后续清理）。
2. 原型跨模块引用/关系子表仍未解析（与抽取前一致，非本批回归）。
3. 真实 DB 两个 structured 应用本批后前端不可打开（预期，R4b-2 删除）。

## R4b-2 完成（2026-11-11）：后端 structured 移除 + 旧应用/数据删除

上游：`docs/plans/2026-11-11-r4b2-implementation-brief.md`。本轮删除本地旧 structured 应用登记/目录、后端 structured 兼容（旧 P3 交接包、workspace/modules、旧 agents/spec 对话、`requirements_mode`），drop 旧表。**未动 MySQL demo 行**（R4c，等用户选 A/B/C）。

### 备份与旧数据删除

| 项 | 结果 |
| --- | --- |
| 备份 | `C:\Users\icecream\AppData\Local\Temp\opencode\r4b2-backup-20261111-155329\projects.zip`（226 项，含 `application.properties`/`bootstrap*.properties`/`user-config.xml`；**排除** `backend/target`、`frontend/node_modules`、`dist` 构建产物，压缩后 0.9MB；未打印/提交任何密码） |
| 删除旧应用 | 临时端口 3499 + 真实 `data/`/`projects/`（`OPENCODE_AUTO_START=false`）调用 `DELETE /api/apps/quarterly-reporting?confirm=true`、`DELETE /api/apps/app1?confirm=true`，均 200 |
| 真实 DB 校验 | `apps` 空；`app_sessions`/`app_stage_events`/`app_requirement_docs*`/`app_design*`/`app_change_sets`/`design_handoffs`/`handoffs`/`modules` 均 0 行；`projects/` 空；旧 `module*` 全局设置键已清理 |
| MySQL demo 行 | **未动**（`quarterly_reporting_date` 2 行 + `quarterly_reporting_business_atm` 2 行仍在；清理方案待 R4c 用户选择） |

### 后端删除/收敛

| 项 | 处理 |
| --- | --- |
| 旧 P3 交接包 | 删除 `backend/src/handoff/{bundle,render,service,validate,routes,types}.ts`、`bundle.test.ts`、`service.test.ts`、`backend/scripts/handoff-smoke.ts`、`package.json` 的 `smoke:handoff` 与 test 条目 |
| 旧 workspace/modules | 删除 `backend/src/routes.ts`（`/api/workspace`、`/api/modules/*`、`/api/settings/*`）与 `index.ts` 挂载 |
| 旧 agents | 删除 `backend/src/agents/{decompose,prompts,queue,routes,types}.ts` 与 `index.ts` 的 `/api/agents` 挂载；**保留** `agents/llm.ts`（设计 `chatJson` 使用）与 `llm.test.ts` |
| 旧 spec 对话 | `chat/service.ts` 删除 `buildChatPrompt` 与 `<<<SPEC_JSON>>>`；只保留 `mode:'doc'`（需求文档）/`mode:'design'`，其他 mode 返回 400 |
| `requirements_mode` | 移除 apps 创建/payload、dev service、changesets service（3 处 409）、requirements doc 路由守卫、chat doc 守卫、design 服务、design-handoff `appRow` 全部分支；`db.ts` 迁移 `ALTER TABLE apps DROP COLUMN requirements_mode`（失败时保留列 + 警告，不阻塞启动）；真实库已确认列不存在 |
| 表结构 | `db.ts` 删除 `modules`/`module_docs`/`handoffs` 建表与 `modules.app_id` 迁移；旧库 `DROP TABLE IF EXISTS module_docs/modules/handoffs`；删除 `ModuleRow/ModuleDocRow` 类型；清理旧全局设置键（`activeId`/`scenes`/`batches`/`conversation`/`docTemplate(s)`/`ui`/`module*`） |
| `apps/routes.ts` | 创建只写文档模式；`stage/confirm` 需求走文档确认、设计固定 409（引导 DesignStudio）；删除 `validateRequirements`、workspace/module doc、旧 `/conversation`、旧 `/handoff` 挂载；删除应用只清 `app.*` 设置/阶段事件/会话/需求文档/设计/交接包/变更单 |
| `apps/payload.ts` | 去掉 `requirementsMode`/`stats`/旧 handoff；保留 `requirementDoc`/`designProject`/`handoff`（设计交接包）/`activeChangeSet` |
| 提示词/注释 | `scaffold.ts` 的 req/design agent 提示词改为 `<<<DOC_JSON>>>`/`<<<DESIGN_JSON>>>`；`doc-prompt.ts`、`requirements/doc.ts`、`index.ts`、`apps/*` 注释同步 |
| 测试/脚本 | 删除 `bundle`/`service` 单测与 structured 守卫用例；`design-handoff.test.ts` 去掉 legacy-app；`requirements-smoke.ts` 的 structured 守卫改为“已登记 200 / 未登记 404”；其余测试/脚本去掉 `requirements_mode` 列 |

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 113/113（较上轮 126 减少 13：旧 P3 交接包 2 个测试文件 + structured 守卫用例） |
| `npm run typecheck --prefix frontend` / `npm run build --prefix frontend` | ✅ 通过（bundle 647KB 不变） |
| `npm test --prefix frontend` / `node check-vue-imports.cjs` | ✅ 63/63；SFC 导入完整 |
| `smoke:requirements` | ✅ 模板/文档/版本/AI 建议/确认/删除；新守卫“已登记 200 / 未登记 404” |
| `smoke:design` / `smoke:design-handoff` / `smoke:handoff-input` / `smoke:change-set` | ✅ 全链路回归（设计 Studio、交接包 v1/v2、设计输入 diff/sync、变更 #2+#3/取消/范围升级） |
| `smoke:dev-sessions` / `smoke:dev-health` / `smoke:dev` | ✅ 真实 opencode 2.2.5：会话列表/切换/重命名/归档、上下文健康度 + 原生 compact、真实模型创建会话→提示→恢复→完成/继续→停止 |
| 真实 DB | ✅ `apps` 空；`sqlite_master` 无 `modules`/`module_docs`/`handoffs`；`apps` 列无 `requirements_mode`；`projects/` 空；全部关联表 0 行 |
| 已删除接口 | ✅ `/api/workspace`、`/api/modules/x/doc`、`/api/agents/tasks`、`/api/settings/theme`、`/api/apps/:id/handoff` 均 404 |
| 真实后端 doc 应用 | ✅ 创建 `r4b2-check`（201）→ `GET requirements-doc` 200（13 章节）→ `GET design` 200（自动建项目）→ 删除 200 → `GET /apps` 空 |
| Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3400，`OPENCODE_AUTO_START=false`） | ✅ 首页/需求文档/设计 Studio（wireframe 实际渲染）/开发页/变更历史弹窗/删除后首页空状态；0 console error、0 page error、0 意外 API >=400；截图在临时目录 `r4b2-e2e/shots` |

### 偏差 / 待确认

1. **备份内容裁剪**：`projects/` 两个应用合计约 1.4GB（`backend/target` 606MB ×2、`frontend/node_modules`），首次 `Compress-Archive` 超时；改为只备份源码/配置/文档（排除 `target`/`node_modules`/`dist`/`.git`），仍包含 R4c 需要的 MySQL 连接配置。若 R4c 需要运行态产物，需另行说明。
2. **`requirements_mode` 删除方式**：按交接单允许的兜底，`DROP COLUMN` 失败时保留列并打印警告；本机 SQLite 支持，真实库已确认删除。代码中仅 `db.ts` 迁移守卫还提到该列名。
3. **实施过程事故（已修复）**：一次 PowerShell 文件重写把 `backend/src/dev/service.ts` 的中文字符串/注释按 GBK 误解码导致损坏；已按原文恢复（逐处校对中文文案），并用 build/113 测试/真实 opencode 冒烟 + Playwright 复验。最终文件无替换字符残留，行为与文案一致。
4. **`/api/settings/*` 一并删除**：交接单点名 workspace/module 路由；`/api/settings/:key`（theme/ui/docTemplate/conversation）在前端 R4b-1 后已无调用方，随 `routes.ts` 一并删除，并清理对应全局设置行。
5. **`DELETE /api/apps/:id` 不再清理 `handoffs`/`modules`**：表已 drop；设计交接包/变更单/会话/需求文档清理保留。
6. **真实模型需求/设计聊天未重跑**：旧应用目录已删除，若要复核需新建应用（不在本批范围）。

## R4b-2 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run build --prefix backend` ✅；`npm test --prefix backend` ✅ 113/113；`npm test --prefix frontend` ✅ 63/63；typecheck/build ✅；`smoke:requirements` / `smoke:design` / `smoke:design-handoff` / `smoke:change-set` / `smoke:dev-health` / `smoke:dev-sessions` / `smoke:handoff-input` ✅ 通过；真实 DB 校验：`apps` 0 行、无 `modules`/`module_docs`/`handoffs`、`apps` 无 `requirements_mode` 列、`app_settings` 0 行、`projects/` 空；备份 zip `C:\Users\icecream\AppData\Local\Temp\opencode\r4b2-backup-20261111-155329\projects.zip`（951KB）存在；`legacy/` 与 `requirements-grooming/` 不存在；`dev/service.ts` 无 U+FFFD 替换字符（过程编码事故已恢复）。

代码走查确认：旧 P3 handoff 文件/测试/`smoke:handoff` 已删，仅保留 `handoff/design-*`；旧 agents 仅保留 `llm.ts`（design `chatJson`）；`/api/workspace`、`/api/modules/*`、`/api/settings/*`、`/api/agents/*` 已移除；`modules`/`module_docs`/`handoffs` 表已 drop；`requirements_mode` 仅剩迁移守卫；apps 创建/详情/删除收敛为 doc；前端模型设置走 `/api/apps/:id/model` 未受影响（Playwright 验证）。

结论：**R4b-2 可以验收**。观察项：

1. 备份排除了 `target`/`node_modules`/`dist`（源码+配置完整，MySQL 配置保留在 zip）；如需完整构建产物请说明。
2. 真实模型需求/设计聊天未重跑（旧应用目录已删）；后续新建应用再验证。
3. `@element-plus/icons-vue`、`ai-dev-workbench: file:..` 依赖未处理（R4c）。
4. MySQL 2+2 demo 行未动，等 R4c 选 A/B/C。

## R4c 完成（2026-11-11，实施会话）

上游：`docs/plans/2026-11-11-r4c-implementation-brief.md`（§8 为详细结果）。范围：MySQL demo 清理 SQL（只核对，**不连接数据库**）、依赖清理、最终文档收尾与验证。**不做**视觉/响应式/深浅色打磨、I-09b、真实模型需求/设计重跑。

### MySQL 清理 SQL（未连接、未执行）

| 项 | 结果 |
| --- | --- |
| 文件 | `docs/ops/cleanup-demo.sql`：预览段（两表 `id LIKE '%-demo-%'`）→ 事务内先删 `quarterly_reporting_business_atm` 再删 `quarterly_reporting_date` → `COMMIT`（可 `ROLLBACK`） |
| 核对 | 表/列名与备份 DAO 一致（`id`、`year`、`quarter`、`dateId`）；无凭据（仅表名 + LIKE） |
| 执行 | **用户自行执行**；工作台与本轮会话未连接 MySQL、未执行 SQL；真实 schema 一致性由用户用预览段确认 |
| demo 行 | 仍存在（`quarterly_reporting_date` 2 行 + `quarterly_reporting_business_atm` 2 行），未动 |

### 依赖清理

| 项 | 结果 |
| --- | --- |
| `frontend/package.json` `@element-plus/icons-vue` | 移除直接依赖（代码无 import）；仍作为 `element-plus@2.14.7` 的传递依赖安装，运行时不受影响 |
| `backend`/`frontend` `ai-dev-workbench: file:..` | 移除（package.json + `package-lock.json` + `node_modules` junction） |
| 根 `concurrently` | 保留（`npm run dev` 使用） |
| lock 变化 | backend 129 → 127 包（0 vulnerabilities）；frontend 97 → 95 包（既有 3 moderate：`vue-tsc → minimatch`，修复需破坏性升级，未处理） |
| engine/peer | 仅既有 `@vueuse/*@15.0.0` Node>=22 警告（本机 Node 20.20.1），无新增错误 |
| 安装脚本（偏差） | 本机 npm 10.8.2 下在仓库根执行 `npm install --prefix backend|frontend` 会把根包写成目标包的 `file:..` 依赖并建 junction（已用空包复现）；故 `install:all`、`start.cmd`、`start.sh` 改为在各自包目录内 `npm install`/`npm ci`。`npm run build/test --prefix` 不受影响 |

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 113/113 |
| `npm test --prefix frontend` / `typecheck` / `build` / `check-vue-imports.cjs` | ✅ 63/63；typecheck 通过；1832 modules，`index-*.js` 647.10 kB、`element-plus-*.js` 1025.09 kB；SFC 导入完整 |
| 根 `npm run build` | ✅ 退出码 0 |
| `smoke:requirements` / `smoke:design-handoff` | ✅ 需求文档（v1—v10、AI 预览/忽略、确认、删除）；交接包（前提校验→预览→v1 + Change Set #1→读取→v2→PNG 缺失阻塞→完成→删除） |
| `npm run install:all` | ✅ 退出码 0；执行后 backend/frontend `package.json` 无 `file:..`、无 junction |

### 最终本地状态

| 项 | 结果 |
| --- | --- |
| `projects/` | 空（0 项） |
| `data/workbench.pid` | 不存在；无 node 进程监听 3300/4771 |
| `data/requirements.db` | `apps` 0 行；`app_*`/`design_handoffs` 全部 0 行；无 `modules`/`module_docs`/`handoffs`；仅内置模板（需求 4 / 原型 2） |
| 运行时残留 | `data/opencode-serve-4771.json`（2026-11-10 旧 serve pid，进程已不在，启动时自动清理）；未改动 `data/` |
| 仓库根遗留 zip | `ai-dev-workbench.zip`（19,759,156 字节，2026-11-10 11:23）是 R4a/R4b 之前的整仓快照（含 `legacy/`、`data/requirements.db`，**无** `projects/`/`.env`，检查只读文件名未解压）；未被 `.gitignore` 覆盖，建议用户自行删除或移出仓库（本轮未动） |
| 凭据 | 仓库内只有占位符与测试夹具（`s3&cret`、`real-secret` 等），`docs/ops/cleanup-demo.sql` 无凭据；`projects/`、`data/`、`.env` 未提交 |
| 备份 zip | `C:\Users\icecream\AppData\Local\Temp\opencode\r4b2-backup-20261111-155329\projects.zip`（951,520 字节）仍存在，**含应用配置，用后建议删除**（未解压/未打印） |

### 偏差 / 遗留

1. 安装脚本改用“进入包目录安装”（见上），行为（缺依赖时安装 → 构建 → 启动）不变，需评审确认。
2. `@element-plus/icons-vue` 仅删直接依赖，仍随 `element-plus` 安装。
3. MySQL demo 行待用户执行 `docs/ops/cleanup-demo.sql`。
4. 前端 3 个 moderate 审计告警为既有 dev 依赖，未处理。
5. 未做：视觉/响应式/深浅色打磨、I-09b、真实模型需求/设计重跑、Nacos/Redis/license、真实 401/403。

## R4c 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run build --prefix backend` ✅；`npm test --prefix backend` ✅ 113/113；`npm test --prefix frontend` ✅ 63/63；typecheck/build ✅；`backend/package.json`/`frontend/package.json` 已无 `ai-dev-workbench: file:..` 与 `@element-plus/icons-vue` 直接依赖；`start.sh`/`stop.sh`/`start.cmd`/`README`/`AGENTS`/`STATUS`/`cleanup-demo.sql` 无 U+FFFD 替换字符；`docs/ops/cleanup-demo.sql` 仅表名/`LIKE '%-demo-%'`，无凭据；`apps` 空、`projects/` 空、旧表不存在。

代码/脚本走查确认：`install:all` 改为进入子包安装；`start.sh` 用子 shell `cd`、`start.cmd` 用 `pushd/popd`，规避 npm 10.8.2 把根包写成子包 `file:..` 的问题；`concurrently` 保留。

结论：**R4c 可以验收**。观察项：

1. 仓库根仍有 `ai-dev-workbench.zip`（19.7MB，2026-11-10 旧快照，含 `legacy/`、`data/requirements.db`，无 `projects/`/`.env`）；建议删除（未在 R4c 动，需用户确认）。
2. `r4b2-backup-.../projects.zip` 含应用配置（含 DB 密码），用后删除；不要解压/提交。
3. 前端 3 个 moderate 审计告警来自 dev 依赖（`vue-tsc → minimatch`），未处理。
4. MySQL demo 行待用户按 SQL 执行；未连接数据库。

## 视觉 V1 完成（2026-11-11，实施会话）

上游：`docs/plans/2026-11-11-visual-polish-v1-brief.md`（§8 为实施结果）。范围：主题系统 + 深浅色切换 + 应用外壳/首页/设置/通用弹窗的视觉与响应式；**未改后端/接口/数据**，未做需求文档、设计 Studio、开发页深度改造（V2/V3），未做视觉重构/换设计语言。

### 主题与 token

| 项 | 结果 |
| --- | --- |
| 语义 token（`frontend/src/shared/theme.css`） | 新增/补齐 `--rg-surface-2`、`--rg-hover`、`--rg-link`、`--rg-ink-active`、`--rg-ink-contrast`、`--rg-*-border`、`--rg-overlay`、`--rg-code-bg/text/border`、`--rg-focus-ring`、`--rg-scrollbar(-hover)`；浅色/深色各一套；原有 token 名保留 |
| Element Plus 映射 | `--el-bg-color(-page/-overlay)`、`--el-fill-color-*`、`--el-border-color-*`、`--el-text-color-*`、`--el-mask-color`、`--el-disabled-bg-color`、`--el-input-*`、`--el-dialog-bg-color` 全部指向语义 token；深色下弹窗/下拉/表格/输入/复选框/消息框无白底 |
| 机制 | `html { color-scheme: light }` / `html.dark { color-scheme: dark }`；`index.html` 首屏前套用 localStorage/系统偏好（避免深色闪白）；滚动条随主题（webkit + `scrollbar-color`）；`button/a/[role=button]` 统一 `:focus-visible` ring |
| 状态管理（`frontend/src/settings/store.ts`） | 新增 `setTheme(mode)`/`toggleTheme()`；初始值 `localStorage(rg.theme)` → `prefers-color-scheme` → `light`；持久化沿用 `rg.theme`；`App.vue` 首屏创建 store 让首页也立即套用 |
| 切换入口 | `AppShell` 顶栏太阳/月亮按钮（`aria-label`/`title`，深色为太阳=切浅色）；`HomeShell` 顶栏同款按钮（便于首页直接切换）；`SettingsDialog` 新增「外观」分段控件（`aria-pressed`），与顶栏双向同步 |

### 组件（token 化 + 响应式）

| 组件 | 结果 |
| --- | --- |
| `HomeShell` | 背景/卡片/状态徽标/空状态/按钮/错误提示 token 化；应用列表改为 `repeat(auto-fill, minmax(min(100%, 320px), 1fr))` 卡片网格，768 单列；顶栏 flex-wrap 不溢出；应用项可键盘聚焦（Enter/Space 打开）、删除按钮 hover/focus/768 常显 |
| `AppShell` | 顶栏/阶段栏/按钮/chip token 化；1280 隐藏状态文案、1024 换行且阶段栏第二行横向滚动、768 隐藏 app-id；操作按钮不换出、可换行；主体 `min-height:0` |
| `NewAppDialog` | 宽度 `min(720px, calc(100vw - 32px))`、`max-height: calc(100vh - 48px)` + body 滚动 + sticky 操作区；900/768 单列；输入/占位/错误/高级折叠 token 化；关闭按钮 `aria-label`/`title` |
| `SettingsDialog` | 宽度 `min(560px, calc(100vw - 32px))`；「外观」区块；运行态/提示/错误 token 化；窄屏分段控件等宽 |
| `ChangeSetStartDialog` / `ChangeSetHistoryDialog` | 宽度 `min(560/860px, calc(100vw - 32px))`；基准条/范围卡/状态 chip/差异 Markdown token 化；768 行内元信息换行；`csh-body` 高度 `min(64vh, calc(100vh - 240px))` |
| `DesignHandoffDialog` | 全部 token 化（含文件列表/预览头/代码块/PNG 纸面例外）；宽度/高度自适应视口；≤820 文件列表与预览纵向堆叠 |
| `VersionHistoryDialog` / `DesignVersionsDialog` | 宽度自适应；版本列表/主区/标签/源码块 token 化；≤820 版本列表横向滚动、详情纵向；源码 `<pre>` 使用 code token |
| `MarkdownView` | 标题/正文/引用/表格/代码/链接 token 化；表格隔行底色 + 深色可读；代码块深色背景/文字对比度足够 |
| 通用弹窗 | 全局 `.el-dialog` `max-height: calc(100vh - 96px)` + `display:flex`，body 内部滚动、header/footer 固定；≤768 宽度 `calc(100vw - 24px)`（`!important` 覆盖内联 `--el-dialog-width`） |

### 验证

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck --prefix frontend` | ✅ 通过 |
| `npm run build --prefix frontend` | ✅ 1832 modules；CSS 523.22 kB、`index-*.js` 650.28 kB、`element-plus-*.js` 1,025.09 kB |
| `npm test --prefix frontend` | ✅ 63/63（未改测试） |
| `node check-vue-imports.cjs` | ✅ 全部 SFC 导入完整 |
| `npm test --prefix backend` | 本轮未改后端（基线 113）；未重跑 |
| Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3400，`OPENCODE_AUTO_START=false`） | ✅ 浅/深 × 1440/1024/768 各 7 页（首页/应用外壳/设置/新建应用/变更历史/交接包/版本）共 42 张 + 3 张补充；0 console error、0 page error、0 意外 API≥400、0 深色白底、0 横向溢出；主题按钮/设置分段控件双向同步 + 刷新保持；`prefers-color-scheme: dark` 无存储时初始深色；ElMessageBox/下拉深色无白底 |

截图：`C:\Users\icecream\AppData\Local\Temp\opencode\visual-v1\shots\`（`{light|dark}-{1440|1024|768}-{home|app-shell|settings|new-app|versions|change-history|handoff}.png`，另有 `dark-1440-home-after-toggle.png`、`dark-1440-confirm-box.png`、`dark-1440-select-dropdown.png`）。E2E 预置/脚本：同目录 `setup.cjs`、`e2e.cjs`、`extras.cjs`。

### 偏差 / 遗留

1. 应用外壳的深色截图是“深色外壳 + 浅色需求文档正文”：需求文档/设计 Studio/开发页仍为浅色硬编码，按 V1 范围留给 V2/V3；深色下这些页面的输入/表格暂未验证白底。
2. `.el-table` 深色变量已映射但当前 V1 页面没有表格实例，未实机验证（V2 模板中心会覆盖）。
3. 未做 `prefers-color-scheme` 实时变化监听（仅在首次加载读取；用户显式选择后以 `rg.theme` 为准）。
4. 移动端 <768 不在本轮断点范围；768 已满足单列/不溢出。
5. 未改后端、未重跑 `npm test --prefix backend`（113 基线）、未跑冒烟（不涉及后端链路）。
6. 未做真实模型对话回归（本轮不依赖模型）。

## 视觉 V1 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run typecheck --prefix frontend` ✅；`npm run build --prefix frontend` ✅；`npm test --prefix frontend` ✅ 63/63；`node check-vue-imports.cjs` ✅。抽查截图（`visual-v1/shots` 45 张）：深色首页、应用外壳、模型设置、新建应用、交接包、版本/变更历史在 1440/1024/768 均无白底弹层/输入/表格，窄屏无横向溢出；主题按钮与设置「外观」双向同步；`index.html` 首屏主题脚本避免闪白。

结论：**V1 可以验收**。观察项：

1. 应用外壳深色时，需求文档/设计/开发正文仍是浅色（V2/V3 范围）；这是预期的分阶段。
2. 768 下需求文档三栏仍并列，正文较窄但未溢出；V2 需要把聊天/大纲/编辑在窄屏折叠或抽屉。
3. 全局 `.el-dialog` 改为 flex + body 滚动，会作用于 V2 未改造弹窗；V2 建议收敛为 `rg-dialog` 类或逐个验证。
4. `prefers-color-scheme` 只在首次加载读取，未实时监听；可接受。
5. <768 移动端未纳入本轮。

## 视觉 V2 完成（2026-11-11，实施会话）

上游：`docs/plans/2026-11-11-visual-polish-v2-brief.md`。范围：**需求文档 + 设计 Studio** 的 token 化/深浅色/响应式；**未改业务逻辑/接口/数据库/版本/交接包语义**，未做开发页（V3），未做视觉重构。原型线框（`design/prototype/*` + `design-skin.css`）保持“白纸”语义，只有外围工具栏/侧栏/页面集/规格面板随主题。

### 摘要

| 项 | 结果 |
| --- | --- |
| token 增量（`shared/theme.css`） | 新增 `--rg-accent` / `--rg-accent-soft`（Story、页面等分类标识，只做标识不做主操作色），浅/深各一套；其余全部复用 V1 token，V2 组件内已无硬编码颜色（线框白纸、PNG 纸面、模板颜色 Token 数据除外） |
| 需求文档布局（`RequirementsDocView`） | 1280 保持对话 336 + 大纲 168 + 编辑区；≤1024 对话/大纲折叠为左侧抽屉（顶部「对话」「大纲」按钮 + 遮罩 + 关闭按钮 + Esc），编辑区全宽；≤768 头部两行、按钮 ≥32px、`source-editor` 50vh |
| 需求文档头部 | 模板 badge/状态 chip/版本/变更 chip/保存态/只读横幅/重新编辑/导出/确认需求全部 token 化；`doc-chip`、`section-*`、`outline-*`、工具栏、空/错状态统一 surface/border/text 三级 |
| `DocChatPanel` | 头部/AI badge（渐变改墨色实心）/构建活动/接下来做什么/章节焦点 chip/消息气泡（user=墨色、assistant=surface、notice=fill）/流式态/停止按钮/Composer token 化；`title`+`aria-label` 补齐（回到底部、清除焦点、发送/停止） |
| `AiSuggestionCard` | 卡片/计数/状态 chip（applied/ignored/stale）token 化；行级 diff `+/-/上下文` 用 `ok/danger/text-2` 软底，深浅色均通过；diff 块改 code token 底；stale 用 warn 软底 |
| `OutlineEditor` | Scene/Epic/Story 卡片、稳定 ID chip（Epic=ai、Story=accent）、输入/文本域/优先级/场景归属/验收标准、归档删除、空态 token 化；≤768 元信息单列、按钮与删除按钮 ≥30px |
| `TemplateCenterDialog` | 列表/搜索/分类/预览/私有模板编辑器（章节行、key 只读、上下移/删除/新增）token 化；宽度 `min(1020px, calc(100vw - 32px))`；高度 `min(68vh, calc(100vh - 230px))`，≤820 纵向堆叠 + 列表限高 + 弹窗内部滚动 |
| 需求版本弹窗（`VersionHistoryDialog`） | V1 已 token 化；V2 在需求页深色/窄屏复核通过（无白底、列表横滚、源码 code 底） |
| `MarkdownView` | V1 已 token 化；V2 复核表格/引用/代码块深色可读，新增 `overflow-x:auto` 避免窄屏表格撑破文档 |
| 设计 Studio 外壳（`DesignStudio`） | 顶栏（标题/状态/版本/需求输入 chip/模板 chip/交接包/同步/重新编辑/主按钮）、Tab、stale/scope 横幅、readiness 条 token 化；≤1024 设计对话折叠为左侧抽屉（Tab 行「对话」按钮），≤768 头部两行、按钮 ≥32px |
| `DesignChatPanel` | 与需求对话同构 token 化（蓝底渐变改墨色 badge、发送键改 AI 紫软底 + `ink-contrast` 文字）；深色/空态/只读态通过 |
| `EntityDesignTab` | 实体列表/字段表（原生 table，深色表头 + 行 hover）/关系编辑/确认与全部确认/AI 生成 token 化；字段表 `min-width:880px` 横向滚动（1024/768 不撑破页面）；≤768 实体列表折叠为抽屉；实体头 `.field.wide` 跨列 |
| `ErGraph` | SVG 节点 fill/stroke、文字、连线、箭头 marker 全部走 token（`surface`/`border-strong`/`text`/`ai`）；选中高亮 `ai` + `ai-soft`；节点可键盘聚焦（`role=button` + `tabindex` + Enter/Space） |
| `PrototypeTab` | 顶栏/缩放/原型-图片切换/截图存档/导出 PNG/确认页面集 token 化；≤1024 页面集树折叠为抽屉；≤768 画布与规格面板纵向堆叠；画布底色 `--rg-canvas` |
| `PrototypeCanvas` / 线框 | **保持白纸**（`wireframe.css`、`design-skin.css`、`.proto-paper`、`.proto-image`、PNG 纸面均不改深色）；仅外围容器/截图提示（`capture-mask` 墨色实心）随主题 |
| `RequirementCoveragePanel` | 场景/Epic/Story 行、id chip（Story=accent）、覆盖/未覆盖 badge、无需求依据跳转、覆盖提示 token 化；≤768 名称换行、关联信息换行 |
| `DesignSyncDialog` | 差异统计/三列 diff/受影响项/警告/说明 token 化；宽 `min(820px, calc(100vw - 32px))`；≤820 三列改单列 + `sync-body` 内部滚动 |
| `PrototypeTemplateDialog` | 模板库/分类/预览/Token 预览 swatch/编辑器（表单、页面模式、页面集规则）token 化；宽 `min(1060px, calc(100vw - 32px))`；≤900 纵向堆叠 + 内部滚动 |
| `DesignHandoffDialog` / `DesignVersionsDialog` | V1 已 token 化；V2 在 Studio 内深色/窄屏复跑无回归（交接包文件树/代码预览、版本列表横滚 + 详情） |
| `.el-dialog` 收敛 | 逐个验证并以 `min(Xpx, calc(100vw - 32px))` + `calc(100vh - …)` 收口（模板中心/原型模板/需求同步/版本）；模板中心与原型模板的高度改为 `min(72vh, calc(100vh - …))`，768×760 实测 body 内部滚动、不超出视口 |

### 验证

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck --prefix frontend` | ✅ 通过 |
| `npm run build --prefix frontend` | ✅ 1832 modules；CSS 546.17 kB、`index-*.js` 653.34 kB、`element-plus-*.js` 1,025.09 kB |
| `npm test --prefix frontend` | ✅ 63/63（未改测试） |
| `node check-vue-imports.cjs`（`frontend`） | ✅ 全部 SFC 导入完整 |
| 后端 | 本轮未改后端，未重跑 `npm test --prefix backend`（基线 113）与冒烟 |
| Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3410，`OPENCODE_AUTO_START=false`，API 预置，不依赖模型） | ✅ 浅/深 × 1440/1024/768 全页面截图；**0 console error、0 page error、0 意外 API≥400、0 深色白底、0 横向溢出（document/body/工具栏）**；弹窗包围盒均在视口内；768×760 模板中心 body 内部滚动 |
| 功能回归（API 预置） | ✅ 创建 doc 应用 → 编辑器写入 9 个必填章节 + 结构化 Scene/Epic/Story → 保存版本 → 确认需求 → 设计实体/页面集生成/版本/同步/确认设计 → 每页 PNG → 交接包生成（25 文件）全链路 200 |

截图：`C:\Users\icecream\AppData\Local\Temp\opencode\visual-v2\shots\`（120 张，`{light|dark}-{1440|1024|768}-{req-edit|req-preview|req-preview-table|req-source|req-templates|req-versions|req-readonly|req-outline-drawer|req-chat-drawer|design-entities|design-entity-drawer|design-er|design-prototype|design-coverage|design-doc-drawer|design-sync|design-proto-templates|design-versions|design-chat-drawer|design-pageset-drawer|design-confirmed|design-handoff}.png`）。预置/E2E 脚本与日志：同目录 `setup.cjs`、`e2e.cjs`、`e2e.log`、`probe.cjs`。

### 偏差 / 遗留

1. 抽屉为 overlay（绝对定位 + 遮罩）而非重排，宽屏保持原三栏/双栏；抽屉宽度 `min(360px, calc(100vw - 48px))`，≤768 接近全宽。
2. 原型线框白纸是产品语义：深色截图中线框仍是浅色纸张（评审文档），深色白底检查已把 `.proto-skin/.proto-paper/.proto-image/.pt-swatch` 列为例外。
3. 实体字段表与页面规格表在 1024/768 依赖容器内横向滚动（未改列定义/交互），与 V1 评审“实体表格横向滚动”一致。
4. ER 图连线标签在节点密集时可能被节点遮挡（既有布局算法，未改）。
5. 深色下 Element Plus `el-table` 未在 V2 页面出现（模板中心/实体表用自定义结构），沿用 V1 深色变量兜底，未实机验证；`el-input-number`/`el-select` 下拉已在同步/规格面板深色下实机确认无白底。
6. 未验证真实模型对话（本轮不依赖模型，建议 V3 全量截图时重跑真实模型需求/设计）。
7. 移动端 <768 不在本轮断点范围；768 已满足单列/抽屉/不溢出。

## 视觉 V2 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run typecheck --prefix frontend` ✅；`npm run build --prefix frontend` ✅；`npm test --prefix frontend` ✅ 63/63；`node check-vue-imports.cjs`（frontend）✅。抽查截图（`visual-v2/shots` 120 张）：深色需求编辑/AI 建议卡/大纲抽屉、设计实体表/ER/原型/覆盖度/同步、浅深 × 1440/1024/768 均无白底弹层/输入/表格，窄屏抽屉/单列无横向溢出；原型线框保持白纸语义、外围 toolbar/树随主题。

结论：**V2 可以验收**。观察项：

1. 1024/768 的对话/大纲/页面集/实体列表是 overlay 抽屉（非重排），符合“折叠而不硬挤”的目标。
2. 实体字段表/页面规格在窄屏依赖容器内横滚；列定义未改，可接受。
3. ER 连线标签在节点密集时可能被遮挡（既有布局算法，未回归）。
4. 深色 `el-table` 在 V2 页面无实例；模板中心等表格类需在 V3 全量截图时再确认。
5. 未跑真实模型对话；<768 移动端不在范围。

## 视觉 V3 完成（2026-11-11，实施会话）

上游：`docs/plans/2026-11-11-visual-polish-v3-brief.md`（§7 为实施结果）。范围：**开发页**（`DevView`/`SessionList`/`StepCard`/`ToolCard`/`PermissionCard`/`FormCard`/`Composer`/健康度 chip/提示条/右侧会话信息+交接文档+文件变化）+ **全量浅深/响应式截图回归**；**未改后端/接口/数据库/会话与交接包语义**，未新增业务行为；不做 <768 移动端、不做视觉重构。

### token 增量（`shared/theme.css`）

| 项 | 结果 |
| --- | --- |
| 新增 token | 浅/深各一套：`--rg-terminal-bg`/`--rg-terminal-text`（shell 输出保持“黑终端”语义，深色再压暗一档）、`--rg-diff-add-bg`/`--rg-diff-del-bg`（工具卡 diff 行底色，深色半透明）；其余全部复用 V1/V2 token |
| 深色控件修正 | `html.dark .el-switch__action`（圆点）改墨色、选中态用 `ink-contrast`，避免深色下纯白圆点；Element Plus 全局映射未改 |
| 硬编码清理 | `dev/` 下已无裸颜色（`PermissionCard` 的 `#fff`/`#f5d9a6`/`rgba(255,255,255,.7)`、`FormCard` 的 `#cfd8ff`/`#f3f5ff`/`#fff`、`ToolCard` 的 `#1d2129`/`#d7dae2`、`btn.primary` 的 `color:#fff`、`SessionList` 选中边框 `#d9d9f7` 等全部改 token） |

### 组件

| 组件 | 结果 |
| --- | --- |
| `DevView` | 顶栏改 `min-height` + `flex-wrap`（1440/1280 单行、1024/768 两行不溢出）：agent/model、交接包+变更单、只读 chip、上下文 chip、压缩按钮（warn/danger 高亮）、连接/运行状态、新会话/交接包/确认完成；新增「会话信息」折叠按钮（`aria-expanded`/`aria-label`/`title`）；横幅（只读/已完成/失败/上下文 warn·danger）token 化；时间线 user（墨色气泡）/assistant/reasoning/compaction 成功·失败/流式“正在执行”行/空态/加载/错误卡片 token 化；右侧 aside（会话信息 dl、交接文档、文件变化、空态）token 化，`dd` 超长省略补 `title`；只读底栏与 `Composer` 贴底 |
| 会话栏抽屉（≤1024） | 会话栏与右侧 aside 改为绝对定位抽屉（`min(320px, 86vw)`）+ 遮罩 + Esc 关闭 + 点击遮罩关闭；开一个自动收另一个；进入窄屏重置为全部收起，回宽屏恢复三栏；选中会话后自动收起会话抽屉 |
| `SessionList` | 分组头（初始开发/变更 #N/早期会话）+ 状态 chip + 交接包版本 + 计数、active 选中（`--rg-ai-border`）、hover（`--rg-hover`）、搜索框 focus ring（`--rg-ai-soft`）、`focus-within` 显示行内操作、空/加载态 token 化；主按钮改 `ink-contrast` |
| `StepCard` / `ToolCard` | 步骤标记/标题/工具数/耗时/目标省略；工具头 hover + `summary:focus-visible`；diff（`+`/`-` 行底色走 `--rg-diff-*`，深色对比度足够）、shell 输出（`--rg-terminal-*`）+ exit 0/1 + 失败错误条、参数折叠（code 底 `--rg-code-*`）、状态 chip（running/completed/failed）、`min-width:0`/`overflow:hidden` 防溢出 |
| `PermissionCard` / `FormCard` | 权限卡（warn 软底 + 边框）、表单卡（ai 软底 + 边框）全部 token 化；`code`/资源 chip 用 code token 并在窄屏换行；字段、必填红点、说明、错误、只读提示 token 化；`header`/`actions` 允许换行 |
| `Composer` | 深色输入（surface-2 底 + strong 边框）、focus 环 `--rg-ai-soft`、disabled 态、`aria-label`、快捷键提示；`flex-shrink:0` 贴底，≤768 收紧内边距/最小高度 |
| 健康度 | chip（ok/warn/danger/unknown）与提示条沿用 V1 token，仅在开发页内复核深色/窄屏对比度；`dev-health.js` 纯逻辑未改 |
| 可访问性 | 会话栏/aside 折叠按钮 `aria-label`+`title`+`aria-expanded`；Composer `aria-label`；遮罩 `aria-hidden`；`summary`/`doc-link`/行内 `mini` 按钮补 `:focus-visible`；只读态禁用按钮沿用 Element Plus disabled 语义与只读提示 |

### 验证

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck --prefix frontend` | ✅ 通过 |
| `npm run build --prefix frontend` | ✅ 1832 modules；CSS 551.55 kB、`index-*.js` 654.50 kB、`element-plus-*.js` 1,025.09 kB |
| `npm test --prefix frontend` | ✅ 63/63（未改测试） |
| `node check-vue-imports.cjs`（`frontend`） | ✅ 全部 SFC 导入完整 |
| 后端 | 本轮未改后端，未重跑 `npm test --prefix backend`（基线 113） |
| 全量截图回归（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3420，`OPENCODE_AUTO_START=false`；开发页用 Playwright 路由注入 mock `GET /development`） | ✅ 浅/深 × 1440/1280/1024/768 = 270 张；**0 console error、0 page error、0 意外 API≥400、0 深色白底、0 横向溢出**；弹窗/抽屉包围盒均在视口内；768×760 模板中心 body 内部滚动 |
| 功能回归（真实 opencode 2.2.5，不调用模型） | ✅ 创建开发会话 → 真实会话列表/空时间线/交接文档 25 个文件/SSE「实时」→ 主题切换深色并刷新保持 → 1024 会话抽屉与 aside 抽屉（遮罩 + Esc）→ 归档后只读（无 Composer、只读横幅/底栏）→ 恢复为当前会话；0 console/page error、0 API≥400 |

### 截图与脚本

- 目录：`C:\Users\icecream\AppData\Local\Temp\opencode\visual-v3\`；`shots/` 270 张矩阵 + 4 张深色下拉 + 7 张真实功能回归；`summary.json`（每张：page/theme/width/白底数/溢出数/错误数；`totals` 全 0）。
- 覆盖：首页、新建应用、需求（编辑/预览/表格/源码/模板中心/版本/大纲抽屉/对话抽屉/只读）、设计（实体/ER/实体抽屉/原型/覆盖度/需求抽屉/同步/原型模板/版本/对话抽屉/页面集抽屉/已确认/交接包）、变更历史、模型设置、开发页 12 态（时间线/会话列表或抽屉/工具 diff/shell/权限/表单/已完成/只读/开始开发/错误态/aside 抽屉/深色下拉）。
- 脚本：`setup.cjs`（API 预置 3 个应用，含交接包）、`dev-mock.cjs`（开发页 mock 状态：live/completed/readonly/empty/error）、`e2e.cjs`（截图 + 检查 + `summary.json`）、`functional.cjs`（真实 opencode 功能回归）、`probe-dev.cjs`（单页探针）。

### 偏差 / 遗留

1. 开发页时间线/工具卡/权限/表单/只读/错误态是 **Playwright 路由注入的 mock 状态**（不依赖模型），与真实耗时/工具输出内容不同；真实会话仅覆盖建会话/列表/SSE/只读/恢复，未真实调用模型跑工具。
2. 会话栏/aside 在 ≤1024 是 overlay 抽屉（非重排），符合“折叠而不硬挤”。
3. 深色下 `el-switch` 圆点改为墨色（自定义），与 Element Plus 原生白点不同；其余 EP 组件沿用 V1/V2 映射。
4. 768 断点已满足单栏/抽屉/不溢出；<768 移动端不在范围。
5. 开发页 5 秒轮询在截图时被 mock 稳定响应覆盖，未验证超长会话的自动滚动/“回到最新”在真实长流中的表现。
6. 未改后端、未重跑 `npm test --prefix backend`（113 基线）与后端冒烟（仅前端/视觉变更）。

## 视觉 V3 评审（2026-11-11，主会话）

独立验证（未改代码）：`npm run typecheck --prefix frontend` ✅；`npm run build --prefix frontend` ✅；`npm test --prefix frontend` ✅ 63/63；`summary.json` totals：270 张截图，`whiteSurfaces/overflows/consoleErrors/pageErrors/apiErrors` 全 0。抽查截图（`visual-v3/shots`）：深色开发页时间线（上下文 92% danger chip/提示条、会话栏分组、工具卡/状态、右侧 aside）、浅色工具 diff（+/- 行底色）、深色 768 权限/表单卡、1024 会话抽屉/互斥遮罩均正常；深色无白底、窄屏无溢出。

代码走查确认：仅样式/响应式/可访问性；`theme.css` 新增终端/diff token；`DevView` 抽屉/断点/顶栏换行、`SessionList` 分组/hover/搜索、`ToolCard` diff/shell、`PermissionCard`/`FormCard`/`Composer` token 化；未改业务逻辑/接口/数据/会话/交接包语义。

结论：**V3 可以验收，视觉 V1—V3 完成**。观察项：

1. 开发页丰富内容（时间线/工具 diff/shell/权限/表单/只读/错误）来自路由注入 mock；真实 opencode 只验证到建会话/列表/SSE/只读/恢复，未调用模型。
2. ≤1024 会话栏与右侧 aside 是 overlay 抽屉（互斥、断点重置），非重排；符合目标。
3. 深色 `el-switch` 圆点为自定义墨色；其余 Element Plus 组件沿用 V1/V2 映射。
4. <768 移动端、真实长会话滚动/对比度复测、`el-table` 深色实机仍为非阻塞后续。

## I-09b-1 完成（2026-11-12，实施会话；已评审）：交接包规模识别（U6）

上游：`docs/plans/2026-11-12-i09b1-implementation-brief.md`、`docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.2。范围：只做 U6；**不做 U7**（无阶段表/阶段会话/phaseKey/首条提示变更），不新增 API 路由、不新增/修改数据库表或列、不调模型。

### 后端

- 新增 `backend/src/handoff/design-scale.ts`（纯函数）：
  - `HANDOFF_SCALE_THRESHOLDS = { stories: 10, pages: 12, textBytes: 102400 }`；
  - `assessHandoffScale(bundle, textBytes)` → `{ scale, phases }`；`scale` 含 `level/suggested/counts/textBytes/thresholds/triggers/phaseCount/derivedFrom`；
  - 阶段派生：固定 `数据模型与基础框架`；有 Epic 时每 Epic 一阶段（按顺序），Epic 无页面集时注明“按 Story 实现接口/后端能力”；未归属 Epic 的页面集进 `其他页面与收尾`；无 Epic 时按页面集每 3 个一组（`PS-001 标题等 N 个页面集`）；无 Epic/无页面集只给 `全量实现`；只用 EPIC/STORY/PS/PAGE 稳定编号；
  - normal 不派生（`phaseCount=0, derivedFrom='none'`）。
- `design-render.ts`：`renderDesignHandoffText(bundle, scale?, phases?)`；`renderPlan` 命中最前插 `## 0. 建议分阶段开发（可选）`（规模/命中项、不强制不门禁、每阶段目标/Story/页面集/页面/完成标准、Epic 给建议会话标题、使用方式）；`renderReadme` 命中最加“本交接包较大…也可单会话完成”；`renderManifest` 增加 `scale`（normal 也记录）；未命中时 04-PLAN/README 原内容不变。
- `design-service.ts`：两遍渲染（先测量、再决定是否插建议章节，避免循环）；`RenderedHandoff.scale`；preview 结果、generate meta/`handoff`、read meta 均返回 `scale`；read 从 `manifest_json.scale` 解析，旧 manifest 无 scale 或形状不合法 → `null`（前端隐藏提示、不报错）。`designHandoffSummary` 不变。
- 类型：`design-types.ts` 增加 `DesignHandoffScaleMetric/Trigger/Counts/Scale` 与 `DesignHandoffMeta.scale: DesignHandoffScale | null`。
- 测试：新增 `design-scale.test.ts`（7 项：阈值边界 9/10 Story、11/12 页面、99KB/100KB，counts，三种派生，确定性/无内部 ID，标签辅助）；`design-handoff.test.ts` 扩展 2 项（大交接包 10 Story/12 页面 → 04-PLAN 章节/README/manifest/read 一致/05-CHANGES 不受影响/不泄露内部 ID/preview 不写盘；旧 manifest 无 scale → null），并在小交接包预览断言 normal 不出现建议章节/规模提示。
- `smoke:design-handoff` 扩展：`preview.scale`/`manifest.scale`/`read scale` 均为 normal、不出现建议章节；既有关卡（预览不写盘、v2、缺 PNG、路径穿越）保持。

### 前端

- 新增 `frontend/src/design/handoff-scale.js` + `.test.mjs`：`scaleCountsLabel`（KB 向上取整、缺字段回退）、`scaleTriggerLabels`（未知 metric 忽略）、`scaleBadge`（仅 `suggested`）、`scaleHint`（normal 空串）。
- `design/api.ts`：`DesignHandoffScale*` 类型；`DesignHandoffMeta.scale?`、`DesignHandoffPreviewResult.scale?`（向后兼容）。
- `DesignHandoffDialog.vue`：meta 下方规模行（`规模：N Story / M 页面 / X KB`）；`suggested` 时 `建议分阶段` chip + 触发行 + “查看 04-PLAN.md 的分阶段建议”（选中文件）；预览模式同样显示并提示“生成后可在 04-PLAN.md 查看”；normal 只显示规模；旧数据 `scale=null` 整行隐藏；token 样式 + 768 不溢出。
- `DevView.vue`：右侧“交接文档”在 `scale.suggested` 时显示规模/触发行 + “查看 04-PLAN.md”（复用 `openHandoff('04-PLAN.md')`）；normal/旧交接包不显示；未改顶部按钮/Composer/会话行为。
- `frontend/package.json`：`handoff-scale.test.mjs` 加入 test 列表。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 122/122（基线 113；+7 `design-scale`，+2 `design-handoff`） |
| `npm run smoke:design-handoff --prefix backend` | ✅ 预览/生成/读取 normal、不出现建议章节、manifest.scale 存在；既有流程通过 |
| `npm run smoke:change-set --prefix backend` | ✅ C1 变更循环冒烟通过 |
| `npm run smoke:design --prefix backend` | ✅ 设计阶段冒烟通过 |
| `npm run smoke:handoff-input --prefix backend` | ✅ 需求→设计交接冒烟通过 |
| `npm run smoke:requirements --prefix backend` | ✅ 需求文档冒烟通过 |
| `npm test --prefix frontend` | ✅ 69/69（基线 63；+6 `handoff-scale`） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `npm run check:vue --prefix frontend` | ✅ 全部 SFC 导入完整 |
| Playwright（API 预置大/小交接包，临时 SQLite/projects，端口 3441） | ✅ 9 张截图：大交接包 1440 浅/深、768 浅/深（开发页入口 + 弹窗规模行/chip/触发行 + 04-PLAN 定位）、预览模式规模行、小交接包 1440 浅/768 深（无 chip/无开发页入口、04-PLAN 无建议章节）；0 console/page error、0 意外 API>=400、深色无白底、无横向溢出 |

截图目录（临时）：`C:\Users\icecream\AppData\Local\Temp\opencode\i09b1-e2e\shots`（01—09）。

### 偏差 / 说明

- 无 Epic 时页面集分组取“每 3 个一组”（交接单允许 2—3）；未归属 Epic 的页面集同时包含 `epicId=null` 与引用不存在 Epic 的页面集。
- `manifest.scale` 在 normal 也存在（交接单 §2.3 预期）；只有 04-PLAN/README 在未命中时保持原样。
- **变更单 caveat 已补（2026-11-12）**：`changeSet.seq > 1` 时 `04-PLAN.md` 建议章节在规模行后写明“以下阶段按全量交接包生成；实际开发范围以 `05-CHANGES.md` 的增量与影响为准，不要按阶段重写未变更部分”，`00-README` 规模提示追加“本次为变更 #N，增量范围以 `05-CHANGES.md` 为准”；seq=1 不出现。见 `docs/plans/2026-11-12-design-id-collision-fix-brief.md` §7。
- `scale` 在 normal 也记录（仅 04-PLAN/README 未命中时保持原样）。
- 前端 `scale` 类型可选、后端 read 旧数据返回 `null`，避免旧交接包报错。
- E2E 预置曾用不同 Epic ID 绕过页面集 ID 跨应用冲突；该 P1 已于 2026-11-12 修复（见「设计 ID 跨应用冲突修复完成」），现在两个应用可用同一 Epic ID。
- 未新增 API 路由、未改表/列、未改 Change Set/需求/设计/交接包版本/05-CHANGES 语义、未改首条开发提示。

### 未验证

- 真实长需求生成的真实大交接包（本轮大包为 10 Story / 3 Epic / 12 页面合成数据）；真实模型未调用（U6 不调模型）。
- <768 移动端专项、真实长会话滚动复测（非本轮范围）。
- 旧交接包 `scale=null` 的前端隐藏仅有单测 + 代码走查，未在 Playwright 中注入旧 manifest。

## 设计 ID 跨应用冲突修复完成（2026-11-12，实施会话；原 P1，已修复，已评审）

原问题（P1）：`app_design_entities` / `app_design_page_sets` / `app_design_pages` 的 `id` 是**全局主键**；默认页面集 ID 为 `ps-<hash(sceneKey)>`，两个应用使用相同 Epic ID（如 `EPIC-001`）会生成相同 ID；`normalize*` 接受请求/AI 的 raw id 只检查本应用；`writeEntities` / `writePageSets` 先删后插且未包事务，插入冲突会丢当前应用已有数据。最小复现（A 存 `ps-shared`；B 先存 `ps-b` 再存 `ps-shared`）会 `UNIQUE constraint failed: app_design_page_sets.id`，B 页面集从 1 变 0。

修复（`docs/plans/2026-11-12-design-id-collision-fix-brief.md` §7）：

- **ID 生成/接受规则**（`backend/src/design/service.ts`）：已有对象（id/name/sceneKey/pageKey 匹配到本应用现有行）保留原 ID；新对象 raw id 仅当 `ID_PATTERN` + 本应用 used 未占用 + 目标表 `idExists=false` 时保留，否则 `newId + idExists` 兜底生成全局唯一 ID；无 raw id 直接生成。**每次确定 ID 后无条件 `used.add(id)`**，同一 payload 内重复 raw id 的后续对象换新 ID；表名走固定白名单（`DesignIdTable`），参数化查询。
- **实体引用重写**：raw id 被替换时记录 `rawId → newId`，在名称解析前重写同一 payload 的 `fields[].ref` 与 `relations[].target`；raw id 若命中本应用已有行或本次已保留的行则不改写，避免误伤现有/已指向保留 rawId 的引用；同一 rawId 只在第一次换 ID 时登记，不覆盖。
- **默认页面集**：不再用 `ps-${hashKey(scene.key)}`；legacy 命中保留，否则全局唯一生成；页面 ID 保留 `old?.id`，否则优先 `entityId-sceneHash-type` 并做全局检查，冲突则生成唯一 ID；`usedPages` 跨页面集共享（`buildDefaultPagesForScene` 新增参数）。
- **写盘事务**：`writeEntities` / `writePageSets` 的删除 + 插入包进 `db.transaction`（better-sqlite3 嵌套 savepoint 语义，不手工 BEGIN/COMMIT）；`rollbackDesignVersion` / `restoreDesignVersionConfirmed` 的实体 + 页面集 + 版本/项目/应用状态恢复也包进事务。
- **U6 caveat**：`changeSet.seq > 1` 时 `04-PLAN.md` 建议章节加“本次为变更 #N：以下阶段按全量交接包生成；实际开发范围以 `05-CHANGES.md` 的增量与影响为准，不要按阶段重写未变更部分。”；`00-README.md` 规模提示追加“本次为变更 #N，增量范围以 `05-CHANGES.md` 为准。”；seq=1 不出现。
- 未改表/列、未改 API 形状、未迁移数据（`apps=0`）、未做 U7、未调模型。

验证：新增 `backend/src/design/id-collision.test.ts`（8 项：两应用同 Epic 默认页面集、raw 页面集/页面/实体 ID 冲突、关系/字段引用重写、trigger 强制失败后事务回滚且旧数据保留、去 trigger 后保存成功，以及同一 payload 内重复 raw 实体/页面集/页面 ID 均换新且 DB 落库两条）；`design-handoff.test.ts` 新增 seq=1/2 caveat 单测。`npm run build --prefix backend` ✅、`npm test --prefix backend` ✅ **131/131**（基线 122，+9）；`smoke:design` / `design-handoff` / `change-set` / `handoff-input` / `requirements` ✅；前端 69/69、typecheck/build/check:vue ✅（未改前端）。未验证：真实模型/opencode（不需要）、Playwright（本轮无前端改动）、多进程并发写、`apps>0` 存量迁移（无需）。

### 主会话复验（2026-11-12，未改代码）

- 后端 `npm run build` + `npm test` ✅ **131/131**；前端 `npm test` ✅ **69/69**、`typecheck`、`check:vue` ✅；5 支冒烟（design / design-handoff / change-set / handoff-input / requirements）✅。
- 独立最小复现：
  - A/B 两个应用同 `ps-shared`：修复前 B 报 `UNIQUE constraint failed` 且页面集 1→0；修复后两边都成功，B 原有页面集保留。
  - 同一 payload 两个实体同 `ent-dup` / 一个页面集内两个页面同 `pg-dup`：修复前主键冲突；修复后保存成功、ID 不同、DB 两条都在。
- 代码走查：ID 全局检查（三张表白名单 + 参数化）、每次确定 ID 后 `used.add`、实体 `idRemap`（fields.ref/relations.target）、默认页面集去 hash、页面 ID 全局检查、`writeEntities`/`writePageSets` 事务、`rollbackDesignVersion`/`restoreDesignVersionConfirmed` 整体事务、caveat 仅 `seq>1`。
- 结论：**P1 与 U6 caveat 可以验收**。
- 观察项（不阻塞）：多进程并发写未压测（当前单进程串行）；`apps>0` 存量冲突迁移未做（当前 `apps=0`）；同一 `sceneKey`/`pageKey` 匹配到同一已有对象导致的重复输入仍可能被事务拒绝（既有边界，不丢数据）；raw 实体 ID 冲突时同一 AI envelope 的页面绑定可能回退（罕见冲突路径，正常全局未占用时保留原 ID）。

## 评审发现记录：设计页面集 ID 跨应用冲突（2026-11-12，主会话；已由上节修复）

- 现象与复现：`app_design_page_sets.id` 全局主键 + `ps-<hash(sceneKey)>`；A 存 `ps-shared`、B 先存 `ps-b` 再存 `ps-shared` → `UNIQUE constraint failed`，B 页面集从 1 变 0（`writePageSets` 先删后插、未包事务）。
- 同类风险：`app_design_pages` / `app_design_entities` 全局主键；`normalize*` 只检查本应用 used。
- 处置：已按 `docs/plans/2026-11-12-design-id-collision-fix-brief.md` 修复（见「设计 ID 跨应用冲突修复完成」）；当前 `apps=0`，无存量冲突数据。

## 真实模型 E2E（2026-11-12，主会话验证；通过）

环境：临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`（`C:\Users\icecream\AppData\Local\Temp\opencode\i09b-real-e2e`），后端 3450/3452，opencode 2.2.5（4450/4452），模型 `packycode-deepseek/deepseek-flash`；**未触碰真实 `data/`、`projects/`、MySQL**。

链路：

1. **需求（真实模型）**：doc chat 生成 AI 建议并“全部应用”；文档 v3；结构化 **5 场景 / 5 Epic / 15 Story**（模型直接产出结构化 data，未触发重建/补齐）。
2. **设计（真实模型 + 确定性页面集）**：`AI 生成实体` 得到 **10 个实体**（未走兜底）；按场景生成 **5 页面集 / 20 页面**；每页真实 `html2canvas` PNG；设计确认（v4）。
3. **交接包（U6）**：preview / generate 均为 **large**；`counts = 5 scenes / 5 epics / 15 stories / 10 entities / 103 fields / 17 relations / 5 pageSets / 20 pages / 20 prototypes`；`textBytes=121101`（119KB）；**stories、pages、textBytes 三个阈值全部命中**；`phaseCount=6`（基础 + 5 Epic）；49 个文件；v1 / Change Set #1 / 应用 development。
4. **开发会话（真实 opencode build agent + 真实模型）**：首条提示读取交接包；模型实际 `glob`/`read` 了 `00-README.md`、`04-PLAN.md`，最终回复“已阅读交接包，结束。”；会话 handoff v1；0 console error / 0 意外 API>=400。

截图：`C:\Users\icecream\AppData\Local\Temp\opencode\i09b-real-e2e\shots`（`01-requirements-suggestion`、`02-requirements-applied`、`03-entities`、`05-prototypes-snapshots`、`06-design-confirmed`、`07-handoff-preview-scale`、`08-development-scale`、`09-dev-session`、`10-dev-session-final`）。结构化结果：`preview.json`、`requirements.json`、`summary.json`。

### 观察项（不阻塞 U6/P1；建议单独立项）

1. **页面集主实体匹配错误（设计质量，P2；✅ 2026-11-12 已修复并评审）**：确定性页面集按 Epic 组织正确，但主实体/页面标题不匹配 Epic 语义：
   - EPIC-001「图书档案管理」→ 页面全部为「借阅记录列表/创建/编辑/详情」（实体：借阅记录）；
   - EPIC-005「逾期与罚款」→ 页面全部为「提醒记录列表/…」（实体：提醒记录）；
   - 其余 EPIC 也有类似但较轻的偏差。
   根因在既有 `deriveRequirementScenes`/`entityMatchScore` 启发式（模型实体名“书目/罚款单”与 Epic 文案“图书/逾期”不完全一致，故事正文里的“借阅记录/提醒记录”权重更高）。
   修复（`docs/plans/2026-11-12-design-scene-entity-matching-fix-brief.md`）：PRD/Epic 分支改用 `entitySceneMatch` 分量 + 严格字典序比较（`storyHits` → `epicHit` → `sceneHit` → `textScore`，稳定排序），Story 引用必然优先、不受实体名长度影响；无引用时退化为 `textScore`（title×10 + text），与旧逻辑完全一致。新增 `backend/src/design/scene-entity-matching.test.ts` 5 项（含本条真实错位复现：EPIC-001 页面由「借阅记录列表」纠正为「书目列表」；含 32 字符长名称 + 文本分 >1000 的字典序回归）；后端 136 测试。**真实数据回放通过（不调模型）**：用本 E2E 临时库的需求/实体新建 `i09b-p2-replay`，重新生成页面集 → EPIC-001 书目、EPIC-002 读者、EPIC-003/004 借阅记录、EPIC-005 罚款单；结果见 `i09b-real-e2e/p2-replay.json`。已存在的错误页面集需重新生成，未做迁移（当前 `apps=0`）。
2. **真实模型文档含 6 个开放问题**（Q-001…），交接包按设计只给提示、不阻塞；确认设计 warnings 可接受。
3. 本次页面集使用**确定性生成**（非 AI 页面集）；AI 页面集是否能改善主实体绑定未在本次验证。
4. U7 数据点：真实大交接包（15 Story / 20 页面 / 119KB / 6 阶段）确实会触发“建议分阶段”，说明 U7 有真实场景；但页面/实体质量应先于 U7 处理。

## 页面集主实体匹配修复完成（P2，2026-11-12，已评审）

依据 `docs/plans/2026-11-12-design-scene-entity-matching-fix-brief.md`。

改动：

- `backend/src/design/service.ts`：新增 `entitySceneMatch(entity, epic, text)` 返回分量 `{ entity, storyHits, epicHit, sceneHit, textScore }`；`deriveRequirementScenes` 的 PRD/Epic 分支改用**严格字典序**比较器：
  - `storyHits = entity.requirementRefs ∩ epic.stories[].id` 数量；
  - `epicHit`（refs 含 `epic.id`）0/1；`sceneHit`（refs 含 `epic.sceneId`）0/1；
  - `textScore = entityMatchScore(title) × 10 + entityMatchScore(text)`，`entityMatchScore` 语义未改；
  - 排序键：`storyHits` desc → `epicHit` desc → `sceneHit` desc → `textScore` desc → 实体顺序（稳定排序）。**不再使用加权和**，Story 引用必然优先，不受实体名长度影响。
  - 无引用时排序键退化为 `textScore`，与旧逻辑完全一致。`matched` 过滤 `storyHits + epicHit + sceneHit + textScore > 0`；`primary = matched[0] ?? first`。
- 未改 scenes-only/fallback 分支、AI 页面集、页面规格/UI/API/数据库、版本/交接包语义。
- 新增 `backend/src/design/scene-entity-matching.test.ts`（5 项）并注册到 `backend/package.json` 测试列表：
  1. 真实错位复现：EPIC-001「图书档案管理」故事正文出现「借阅记录」、书目 refs STORY-001、借阅记录 refs STORY-003 → EPIC-001 列表页「书目列表」/实体书目，EPIC-002 仍为「借阅记录列表」；
  2. 多实体命中同一 Story：标题更准者优先；同分按实体顺序；
  3. 无 `requirementRefs`：保持旧启发式（标题命中优先于正文出现更多）；
  4. Story 引用 > Epic 引用 > Scene 引用 > 纯文本命中（逐步移除实体复验）；
  5. 严格字典序：32 字符长名称实体（标题文本分 >1000）不敌仅 refs 命中 STORY-001 的「书目」；去掉书目后长名称实体按文本分成为 primary。

验证：

| 命令 | 结果 |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` / `npm run build --prefix backend` | ✅ |
| `npm test --prefix backend` | ✅ 136/136（基线 131，+5）；旧公式下测试 1 失败、加权和下测试 5 失败，确认覆盖有效 |
| `npm run smoke:design` | ✅ |
| `npm run smoke:handoff-input` | ✅ |
| `npm run smoke:design-handoff` | ✅ |
| `npm run smoke:change-set` | ✅ |
| `npm run smoke:requirements` | ✅ |
| `npm test --prefix frontend` | ✅ 69/69 |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ |
| `npm run check:vue --prefix frontend` | ✅ |

### 主会话复验（2026-11-12，未改代码）

- `npm run build --prefix backend` + `npm test --prefix backend` ✅ **136/136**；前端 `npm test` ✅ **69/69**、`typecheck`、`check:vue` ✅；`smoke:design` / `design-handoff` / `handoff-input` / `change-set` / `requirements` ✅。
- 代码走查：`entitySceneMatch` 返回分量，`compareEntitySceneMatch` 严格按 `storyHits → epicHit → sceneHit → textScore`；无引用时只剩 `textScore`，与旧逻辑一致；`matched` 过滤与 `primary` 回退正确；未改 AI 页面集/页面规格/UI/API/DB。
- 测试覆盖：真实错位、同 Story 多实体、无引用回退、引用优先级、32 字符长名称 + 文本分 >1000 的严格字典序回归；实施会话反向验证旧公式/加权和会失败，覆盖有效。
- **真实数据回放（不调模型）**：把 `i09b-real-e2e` 临时库中真实模型生成的需求（5 Epic/15 Story）与实体（10 个，带源 ID/requirementRefs）复制到新应用 `i09b-p2-replay`，重新生成默认页面集：
  - EPIC-001「图书档案管理」→ **书目**（原错位：借阅记录）；
  - EPIC-002 读者管理 → 读者；
  - EPIC-003 借阅办理 → 借阅记录；
  - EPIC-004 归还与续借 → 借阅记录；
  - EPIC-005 逾期与罚款 → **罚款单**（原错位：提醒记录）。
  结果写入 `C:\Users\icecream\AppData\Local\Temp\opencode\i09b-real-e2e\p2-replay.json`；同时验证源实体 ID 跨应用冲突被重映射、关系/引用仍可用。
- 结论：**P2 可以验收**。观察项：旧页面集需重新生成才生效（当前 `apps=0`）；AI 页面集路径未改。

未验证 / 偏差：

- 未重跑真实模型 E2E（按要求不重新调模型）；真实错位用同一规则的确定性 fixture 复现并纠正。
- 未迁移已生成的错误页面集；已有应用需重新生成页面集。当前 `apps=0`，真实 E2E 为临时数据。
- AI 页面集生成路径保持不变，AI 是否能改善主实体绑定仍未验证。
- 仅 PRD + Epic 分支生效；scenes-only 与 fallback 分支维持原状。
- 主会话复核 must-fix 已处理：评分从加权和改为严格字典序，Story 引用必然优先。

## U7-1 完成（2026-11-12，实施会话；已评审）：开发阶段后端

范围：只做 U7-1 后端（按需生成阶段 + 阶段会话 + phase brief + 摘要）；不做 U7-2 前端；不改需求/设计/交接包版本/Change Set/`05-CHANGES`。

- 数据：新表 `app_dev_phases`（`id/app_id/change_set_id/handoff_version/phase_key/title/goal/scope_json/status/summary/summary_source/started_at/completed_at/ord/timestamps`，`UNIQUE(app_id, handoff_version, phase_key)`）+ 索引；`app_sessions.dev_phase_id`（ensureColumn，旧会话 null）+ 索引；阶段 ID 用 `randomUUID()`；删除应用清理阶段。
- manifest：`DesignHandoffPhaseDraft` 增加稳定 `key`（`base` / `epic:<EPIC-ID>` / `other` / `pageSets:<PS-CODE>` / `all`）；`manifest.json` 在 `scale.suggested` 时写 `phases`（key/kind/title/goal/storyIds/pageSetCodes/pageCodes/note），preview/generate 同源；`04-PLAN`/README 文案不变；normal/旧交接包无 `phases`。
- API：`GET /development/phases?handoffVersion=`（阶段 + 当前/最新会话摘要 + `handoffVersion/changeSet/canGenerate`）、`POST /development/phases/generate`（幂等；非 large/无 phases 409）、`POST /development/phases/:id/start|complete|skip|reopen`；`GET /development` 返回 `session.phase`（id/key/title/order/status）+ `phases` 摘要；`GET /development/sessions` 增加 `phaseId/phaseKey/phaseTitle/phaseOrder/phaseStatus`；`POST /development/prompt` 对 completed/skipped 阶段自动 in_progress 并返回 warning。
- 行为：start 无会话时 best-effort interrupt/归档当前 active → 创建 build 会话（tag/handoff/CS/标题/brief）→ 阶段 in_progress，**不自动发送**；已有会话 active 直接返回、archived 复用 I-10 activate；历史交接包阶段只读（409）；completed 阶段 start 409。complete **不归档**，`summary_source=none|model|fallback`（60s 超时/失败回退最后 assistant 800 字）；skip 不摘要；reopen 保留 summary。
- 安全（主会话复核 must-fix）：摘要读取消息前 `registerAppSecrets`，最后 assistant/摘要 prompt/模型返回/fallback/warnings 全部 `scrubText`（`password=`/`Authorization`/注册密钥等）；`DevPhaseView.summary`、`previousSummaryOf`、`buildPhasePrompt` previousSummary、`buildSummaryPrompt` 输入再做 defense-in-depth；默认摘要 agent 改为只读 `design`（兜底 `req`），**不用 `build`**。
- 复核 must-fix #2：`markInProgress` 同时清 `completed_at`（保留 `started_at = COALESCE`），从 `skipped` 重新开始时不再出现“进行中 + 旧完成时间”；create 会话与 resume/activate 两个分支共用。
- 测试：`backend/src/dev/phases.test.ts` 9 项（生成/幂等/409、start 新建/active/恢复/跨应用/历史/completed、complete/skip/reopen/prompt 自动重开、摘要 none/model/fallback/截断、**摘要脱敏 + `pickSummaryAgent` 只读 agent**、**skipped→start 清 completedAt + 再 complete**、phase 字段/旧会话 null、brief、删除清理含 `DELETE /api/apps/:id`）；`design-scale.test.ts` 增加 key 断言；大交接包 `design-handoff.test.ts` 增加 `manifest.phases` 断言（normal 无 phases）。
- 冒烟：新增 `backend/scripts/dev-phases-smoke.ts` + `smoke:dev-phases`（真实 opencode 2.2.5，**不调模型**）：3 Epic/10 Story/12 页面 large → `manifest.phases` 4 → generate（幂等）→ 阶段 1/2 start（阶段 1 归档、阶段 2 active）→ 阶段 1 会话只读/恢复 → complete（无 assistant，none）/skip/reopen → 会话列表 + 状态 phase 字段 → 历史版本可查 → 删除清理。
- 命令/结果：`npm run build --prefix backend` 通过；`npm test --prefix backend` **145/145**（基线 136 + 新增 9）；`smoke:dev-phases`、`smoke:requirements`/`design`/`design-handoff`/`change-set`/`handoff-input`/`dev-sessions`/`dev-health` 通过；前端 `npm test` **69/69**、typecheck/build/check:vue 通过（本批未改前端）。
- 偏差：`start` 允许从 skipped 重新开始（置 in_progress）；历史交接包阶段 start/complete/skip/reopen 统一 409（只读）；`complete` 对已 completed 幂等（不重复调模型）。无接口/数据库之外的行为偏差。
- 未验证：阶段摘要的真实模型调用未在冒烟中执行（按交接单用注入 stub，避免额外成本）；真实 `design`/`req` 只读 agent 的 transient 摘要与 60s 超时 fallback 未实机验证（应用目录缺 agent 时走 fallback）；真实模型摘要质量、阶段 brief 对真实大项目的引导效果待 U7-3/真实使用验证；U7-2 前端未做。（**后续**：U7-2 已于 2026-11-12 完成并评审；U7-3 已于 2026-11-12 验证 model + fallback，见「U7-3 真实模型全链路验证」。）

### 主会话复验（2026-11-12，未改代码）

- `npm run build --prefix backend` + `npm test --prefix backend` ✅ **145/145**；`smoke:dev-phases`（真实 opencode 2.2.5，不调模型）✅；`smoke:dev-sessions`/`dev-health`/`requirements`/`design-handoff`/`design`/`change-set`/`handoff-input` ✅；前端 69/69/typecheck/check:vue ✅（本批未改前端）。
- 代码走查：`manifest.phases` key/scope 与 U6 草案一致；`app_dev_phases`/`dev_phase_id` 建表/补列/索引/删除清理；`generate` 幂等与 409；start 的 active/archived/无会话分支与“只有一个 active”；complete 不归档；skip/reopen；prompt 自动 in_progress；session/state/list phase 字段；摘要 fallback/截断/只读 agent/全链路 `scrubText`；`markInProgress` 清 `completed_at`。
- 两个 must-fix 已修并复验：①摘要读取/模型返回/fallback/warnings/API/brief 脱敏，摘要 agent 不用 build（design→req→失败 fallback）；②从 skipped 重新 start 清 `completed_at`，并补测试。
- 结论：**U7-1 可以验收**。接受实施偏差：`skipped` 允许重新 start；历史交接包阶段所有状态操作统一 409 只读；`complete` 对已 completed 幂等。观察项（不阻塞）：真实模型摘要未实机调用（仅 stub）；U7-2 可考虑“摘要失败重试”入口（当前 reopen→complete 可重生成）；真实 `design`/`req` agent 缺失时摘要走 fallback。

## U7-2 完成并评审（2026-11-12）：开发阶段前端

范围：只做前端（阶段类型/API、按阶段开发入口、阶段条/弹窗、开始/完成/跳过/重新打开、会话 chip、只读/历史只读、响应式/深浅色、纯逻辑单测、Playwright）；不改后端/接口/表/manifest/冒烟；不做 U7-3 真实模型摘要验证。

- 类型/API：`frontend/src/dev/types.ts` 增加 `DevPhaseStatus/DevPhaseKind/DevPhaseSummarySource/DevPhaseRef/DevPhaseScope/DevPhaseSessionSummary/DevPhaseView/DevPhasesResponse/DevPhaseStartResponse/DevPhaseCompleteResponse`；`DevSessionInfo.phase`、`DevSessionListItem.phaseId/phaseKey/phaseTitle/phaseOrder/phaseStatus`、`DevStateResponse.phases`、`prompt` 返回 `phase/warning`；`api.ts` 增加 `getDevPhases/generateDevPhases/startDevPhase/completeDevPhase/skipDevPhase/reopenDevPhase`（沿用 `request()`/`DevApiError`，409 原样提示）。
- 纯逻辑：新增 `frontend/src/dev/phase-labels.js`（状态文案/class、阶段序号、ref/chip 标签、范围数量/明细、进度、全部完成提示、`phaseActionState` 矩阵、生成/开始二次确认文案、摘要来源标签）+ `phase-labels.test.mjs` **9 项**，加入 `frontend/package.json` 测试列表。
- 组件：新增 `PhaseBar.vue`（时间线上方 `阶段 N/M · 标题` + 状态 + `已完成 x/y`；选择阶段/查看范围/完成/跳过/重新打开；全部处理提示；只读/历史交接包按钮禁用 + 原因）与 `PhaseDialog.vue`（左列表 + 右详情：goal/范围/状态/起止/摘要+来源/会话/handoff/变更单；操作按钮；只读原因；`min(1000px)/min(760px)` + 内部滚动；≤820 上下堆叠；Esc/遮罩关闭）。
- `DevView.vue`：未生成时顶栏与开始卡片“按阶段开发”（二次确认含阶段数/不门禁/单会话/不自动发送）；生成后阶段条 + 开始卡片阶段快捷列表 + 折叠“普通会话（不关联阶段）”；开始阶段不自动发送（阶段 brief 进 Composer 并 focus）、完成/跳过/重新打开二次确认、409 原样提示并刷新阶段；`phaseWarnings` 提示条；发送触发后端自动重开时 toast warning + 刷新；右侧会话卡新增“阶段”行；`appId` 切换清空阶段状态。
- `SessionList.vue`：会话项增加阶段 chip（`phaseChipLabel`，`title` 完整标签，`--rg-ai-soft/--rg-ai`）；搜索仍只按标题/备注。
- 样式/响应式：全部 `--rg-*` token；阶段条 ≤1024 按钮换行、≤768 两行；深色无白底；无新增一级导航、三栏结构不变。
- 单测/静态：`npm test --prefix frontend` **78/78（基线 69，+9）**；`npm run typecheck/build/check:vue --prefix frontend` 通过；后端 `npm run build` + `npm test` **145/145**（未改后端）。
- Playwright（临时 `C:\Users\icecream\AppData\Local\Temp\opencode\u7-2`；真实后端 3431 + 真实 opencode 2.2.5，**不调模型**；API 预置 large 交接包 4 阶段 + normal 小交接包）：功能流程生成阶段→开始阶段 1/2（阶段 2 提示归档）→完成 1/2/4→跳过 3→全部处理提示→重新打开 1→归档会话只读（阶段操作禁用 + 原因）→恢复；截图矩阵浅/深 × 1440/1024/768 覆盖未生成入口、开始卡片阶段列表、阶段条（进行中/全部处理）、阶段弹窗（摘要/历史只读）、会话 chip（1024 抽屉）、只读会话、普通交接包无阶段。**73 张截图，0 console/page error、0 意外 API>=400、0 深色白底、0 横向溢出、0 failures**（`summary.json` 在临时目录）。
- 偏差：开始卡片的第二入口用 `phase-generate-card-btn`（与顶栏 `phase-generate-btn` 同时可见，避免重复 testid）；阶段条“查看范围”额外带 `phase-bar-scope`；补 `phaseSummarySourceLabel` 供弹窗摘要来源展示；开始阶段 emit `app-changed`（刷新外壳状态），完成/跳过/重新打开不改应用状态、不 emit；无历史版本切换入口（UI 只展示最新交接包阶段，历史只读由路由注入验证）。
- 复核修复（2026-11-12，主会话 must-fix，仅前端）：`loadPhases()` 由“加载中丢弃并发请求”改为请求序号（`phasesSeq`，只应用最新响应），删除 `phasesLoading`；`appId` 切换递增序号，避免上一应用挂起响应覆盖；修复完成/跳过/重新打开或 prompt 自动重开后阶段条/弹窗因轮询并发而刷新丢失的问题。复验前端 78/78、typecheck/build/check:vue、后端 145/145、Playwright 73 张 0 错误/0 溢出/0 白底。见交接单 §8.5。
- 未验证：U7-3 真实 opencode 功能回归（本轮真实 opencode 已建阶段会话，但未重跑 `smoke:dev-phases`/7 支回归）；真实模型摘要质量与 60s 超时 fallback（按交接单不调模型）；<768 移动端；真实 `GET phases?handoffVersion=` 历史版本选择入口（当前 UI 无该入口，符合交接单）。
- 需决策：无阻塞。可选后续：摘要失败重试入口（当前 reopen→complete 可重生成）；全部完成时是否在阶段条再加“确认完成开发”快捷入口（当前仅提示，主按钮在顶栏）。
- **主会话评审结论（2026-11-12）：U7-2 可以验收。** 独立复核：前端 **78/78**、`typecheck`/`build`/`check:vue`、后端 **145/145** + `build`；`smoke:dev-phases`/`smoke:dev-sessions`/`smoke:dev-health`（真实 opencode 2.2.5，不调模型）通过；临时目录真实后端 3431 + 真实 opencode 2.2.5 重跑 Playwright：**73 张截图，0 console/page error、0 意外 API>=400、0 深色白底、0 横向溢出、0 failures**。阶段条/弹窗布局、深浅色、1024/768 折行、历史只读注入、普通交接包无阶段 UI、开始阶段不自动发送均符合交接单；后端零改动、真实 `data`/`projects` 未污染（`apps=0`、`projects/` 空）。评审发现 1 项 must-fix（并发轮询下 `loadPhases` 丢弃新请求导致阶段状态短暂陈旧）已在评审期间修复并复验（见上「复核修复」与交接单 §8.5）。接受实施偏差（双 testid、`phase-bar-scope`、无历史版本切换入口）；观察项不阻塞：长会话摘要/60s 边界、<768 移动端、摘要失败重试/阶段条“确认完成”快捷入口可选。U7-3 已于 2026-11-12 验证通过（真实 model 摘要 + fallback + P2）。

## U7-3 真实模型全链路验证（2026-11-12，验证会话；通过）

依据 `docs/plans/2026-11-12-u7-3-real-model-e2e-brief.md`；**只验证，未改产品代码/表/接口/模板/冒烟/测试**。

环境：临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` = `C:\Users\icecream\AppData\Local\Temp\opencode\u7-3-real-e2e`；后端 **3451**、opencode **4451**（真实 opencode **2.2.5**），模型 **`packycode-deepseek/deepseek-flash`**；应用 `u73-real-e2e`。结束后停止 serve/后端，端口释放；仓库真实 `data/requirements.db` mtime 未变、`apps=0`、`app_sessions=0`、`app_dev_phases=0`、`projects/` 空（`repo-check.json`）。未重跑后端 145/145、前端 78/78 与 8 支冒烟（主会话已完成）。

链路与结果：

1. **需求（真实模型，UI）**：doc chat **91s** 出建议 → “全部应用” → 文档 **v3**；模型结构化 **7 场景**（scenes 章节）/ **5 Epic** / **17 Story**（epics 章节）；脚本向 epics 章节补场景未持久化（章节 kind 限制），**无确定性补齐**（`modelSupplemented=false`）。确认需求成功。
2. **设计 + P2**：`AI 生成实体`（真实模型，26.2s）→ **8 实体**（图书分类/书目/副本/读者类型/读者/借阅证/借阅记录/罚款单，未兜底）；“按场景生成页面集”（确定性）→ **5 集 / 22 页面 / 22 张真实 PNG**；P2 映射 **EPIC-001 书目·副本、002 读者·借阅证、003/004 借阅记录、005 罚款单（无提醒记录）**，每个页面集都有 `epicId`；设计确认。
3. **交接包**：preview/generate 均 **large**，`counts = 7 scenes / 5 epics / 17 stories / 8 entities / 90 fields / 15 relations / 5 pageSets / 22 pages / 22 prototypes`，`textBytes=118212`（115.5KB），**stories/pages/textBytes 三阈值全命中**，`phaseCount=6`、`derivedFrom=epics`；`04-PLAN` 含“建议分阶段开发”、`00-README` 含规模提示；UI 生成进入开发（v1 / Change Set #1 / 53 文件）；`manifest.phases` = `base` + `epic:EPIC-001…005`。
4. **阶段生成/开始（UI）**：二次确认（6 阶段/不门禁/单会话/不自动发送）→ 6 阶段全部 `not_started`；阶段 1 开始后 brief **270 字**进 Composer、**未发送**（时间线 0 消息）；最小提示 **1s** 回复、工具 0。
5. **真实模型摘要**：UI 完成阶段 1（6.3s，摘要 **5.1s**）→ `status=completed`、**`summarySource='model'`**、摘要 **486 字 / 7 行**；会话**未归档**。阶段 2 开始（2s）→ 阶段 1 会话 archived、阶段 2 active（唯一 active）；brief **827 字**含上一阶段摘要片段。见 `summary.json`。
6. **真实 fallback**：临时移走应用目录 `design.md`/`req.md`，opencode 仍返回缓存 agent → 停止/启动 opencode（未改全局配置）后 agent 列表无 design/req；UI 完成阶段 2（3.7s，摘要 1s）→ **`summarySource='fallback'`** + warning `阶段摘要生成失败，已改用最后一条回复：没有可用的只读摘要 agent（design/req）`；摘要 = 最后 assistant 文本（13 字）；阶段仍 completed、会话未归档；随后恢复 agent 文件。
7. **跳过/重开/只读**：阶段 3 跳过（`skipped`）；阶段 1 重开（`in_progress`、`completedAt=null`、摘要保留）；阶段 1 归档会话只读（只读横幅、无 Composer、阶段操作禁用 + “会话只读”）；“恢复为当前会话”成功、阶段条回到 `阶段 1/6`；最终仅 1 个 active；应用状态全程 `development`（未自动完成/未改变）。
8. **错误**：**0 console error / 0 page error / 0 意外 API>=400**。脚本层 3 处重试（均非产品缺陷）：页面截图循环重复遍历 DOM 页（110 次，实际 22 页）；Playwright 点击归档会话被 `.timeline-scroll` 命中拦截 → `dispatchEvent('click')`；恢复会话需二次确认弹窗，首版漏点后补点。

证据：临时根 `C:\Users\icecream\AppData\Local\Temp\opencode\u7-3-real-e2e`（`summary.json`、`p2.json`、`preview.json`、`stage1-3.json`、`repo-check.json`、`stage1.mjs`—`stage4b.mjs`、**23 张截图** `shots/`）。详细执行记录见交接单 §8。

**主会话复核（2026-11-12）**：独立重启临时后端（`OPENCODE_AUTO_START=false`）读取持久化结果——应用 `development` / handoff v1；6 阶段 `base=in_progress(summary=model,486 字)`、`epic:EPIC-001=completed(fallback,13 字)`、`epic:EPIC-002=skipped`、其余 `not_started`；恰好 1 个 active（阶段 1）+ 1 个 archived（阶段 2）；页面集实体映射与 `p2.json` 一致。证据链与 `summary.json` 相符，**可以验收**。补充说明：fallback 脚本的阶段 2 最小提示文本误写为“读者管理”（脚本硬编码，非产品 brief 错误；截图 `15-phase2-started-brief.png` 的 brief 标题为 EPIC-001 图书档案管理），fallback 摘要=该最后 assistant 文本属预期；页面截图循环 110 次为脚本重复遍历，实际 22 页不影响结果。主会话已确认仓库 `backend/src`/`frontend/src` 近 90 分钟无改动、真实数据 `apps=0`/`projects/` 空、3451/4451 已释放。

未验证/需决策（不阻塞）：真实摘要仅两段短会话（5.1s/1s），长会话质量与 60s 超时边界未实测；fallback 依赖 opencode 重新加载/重启生效（若需“删 agent 后即时 fallback”，可考虑摘要前 reload location，属产品决策）；<768 移动端、EOS 构建/运行态、MySQL/Nacos/Redis/license、真实 401/403 不在本轮范围。

## 需求/原型阻塞修复（#4/#5/#1.1/#1.2/#2，2026-11-12，实施会话；待评审）

上游：`docs/plans/2026-11-12-requirements-design-fixes-brief.md`（§7 实施结果）。范围：原型截图/导出在“图片”视图失效（#4）、交接包前置提示（#5）、Epic 目标多行（#1.1）、Story 写进 goal / 缺 stories[] 兜底与提示（#1.2）、场景与 Epic 关系说明（#2）。**不做** ER 美化（#3）、不改交接包 PNG 硬校验、不放宽设计/需求确认门禁、不改数据结构/页面集派生逻辑。真实工作台（3300，app1）全程未操作、未改真实 `data/`/`projects/app1`。

### 改动

| 文件 | 改动 |
| --- | --- |
| `frontend/src/design/PrototypeTab.vue` | 新增 `captureFromAnyView()`：记录 `view` → 非 html 时临时切 html + `nextTick` → 轮询 `paperRef`（存在/`isConnected`/宽高 > 0，`requestAnimationFrame` 最多 ~1.5s）→ `document.fonts.ready`（忽略失败）→ `capturing` + 截图 → 恢复原视图；`snapshot()`/`exportPng()` 统一走它；超时提示“原型画布渲染超时，请切回「原型」后重试”；新增未截图页面常驻提示条（`missingImageCount`，截图后实时减少/消失）；`data-testid`：`proto-snapshot`/`proto-export`/`proto-empty-snapshot`/`prototype-missing-images` |
| `frontend/src/design/PrototypeCanvas.vue` | `paperRef` 外层加 `data-testid="prototype-paper"`（仅验证用，无行为变化） |
| `backend/src/design/service.ts` | `readinessOf` 新增**警告**（不阻塞）：`还有 N 个页面没有原型截图；生成交接包前需在设计 Studio 中截图存档`；`ok`/issues 不变 |
| `frontend/src/requirements/OutlineEditor.vue` | Epic「目标」改 `type="textarea" :autosize="{ minRows: 2, maxRows: 6 }"`；`所属场景（可选）` + 非 1:1 说明；顶部提示补“场景可选，一个场景可包含多个 Epic”；每个无 Story 的 Epic 行内提示“该 Epic 还没有 Story；设计阶段不会为它生成页面集。”（保留“＋ 在此 Epic 下新增 Story”） |
| `backend/src/requirements/outline.ts` | Epic 内嵌 `stories`/`userStories`/`user_stories` 展开为顶层 Story（`epicId` 缺省为所属 Epic）；顶层 `stories[]` 优先，按 raw id / 标题去重；`goal` 支持字符串数组（join 换行）/非字符串忽略；归一化后对未归档 Epic 检查 Story，缺失加 `code='epic-no-story'` warning（不抛错）；`flushEpicBody` 支持多行目标回环 |
| `backend/src/requirements/doc.ts` | `validateRequirementDoc` 结构化分支对每个 Epic 增加同样的 `epic-no-story` 文案 warning（不阻塞；全无 Story/验收仍按既有 error 阻塞） |
| `backend/src/chat/doc-prompt.ts` | 协议规则新增：`epic.goal` 只写 1—3 句业务目标、不要把 Story/验收/STORY-xxx 写进 goal；每个 Epic 至少 1 个 Story 且 Story 放顶层 `stories[]`（`epicId` 指向 Epic，内嵌仅兜底）；首次生成必须同时返回 `epics` 与 `stories` |
| `backend/src/requirements/builtin-templates.ts` | 两个内置模板的 epics guidance 补一句 goal 与 stories 的区别 |
| `frontend/src/requirements/doc-protocol.js` | `validateDocSections` 结构化分支增加 `epic-no-story` warning（AI 建议预览/确认弹窗可见） |
| `frontend/package.json` | 未新增测试文件，test 列表不变 |
| 测试 | `backend/src/requirements/doc.test.ts`（内嵌 stories 展开/epicId/去重/多行 goal、Epic 无 Story warning 且确认仍阻塞、prompt 断言）；`backend/src/design/service.test.ts`（缺图 warning 2→1→0 且不进 issues）；`frontend/src/requirements/doc-protocol.test.mjs`（Epic 无 Story warning，不误报有 Story 的 Epic） |

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm test --prefix backend` | ✅ **149/149**（基线 145，+4：2 需求 + 1 设计 + 1 复核修复） |
| `npm test --prefix frontend` | ✅ **79/79**（基线 78，+1） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过（`index-*.js` 681.38 kB、`element-plus-*.js` 1,025.09 kB） |
| `npm run check:vue --prefix frontend` | ✅ 全部 SFC 导入完整 |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3461，`OPENCODE_AUTO_START=false`，不调模型、不启动 opencode） | ✅ 20 张截图 + 1 个下载；**0 console error / 0 page error / 0 意外 API>=400 / 0 横向溢出 / 0 深色白底**（浅/深 × 1440/1024/768，页面原型图片/原型 + 需求结构编辑器） |

Playwright 预置与场景（临时应用 `reqfix-e2e`）：
- 需求：1 场景 / 2 Epic（EPIC-001 三行长目标；EPIC-002 无 Story）/ 1 Story（带验收）→ 确认需求（warnings=1，不阻塞）。
- 设计：1 实体（已确认）+ 1 页面集 / 2 页面（列表 + 详情，已确认，NO PNG），设计保持 draft。
- **#4 A**：页面原型 → 选页面 → 切「图片」（无图）→ 空状态「截图并存档」→ 成功提示 + 图片显示 + API `imagePath=docs/design/prototypes/…png`；
- **#4 B**：选第 2 页（仍在图片视图）→ 顶部「截图存档」→ 成功 + `imagePath` 写入；
- **#4 C**：图片视图「导出 PNG」→ Playwright `download` 事件（`order-detail.png`，99,800B）+ 成功提示；
- **#4 D**：切回「原型」→「截图存档」→ 成功（html 视图回归）；
- **#5**：提示条初始“还有 2 个页面没有原型截图” → 截图 1 张后“还有 1 个” → 截图齐备后消失；设计确认（UI 确认框）通过、`readiness.warnings` 含缺图提示且不阻塞；交接包「预览（不写盘）」0 issue、API preview `issues=0`（无“缺少原型 PNG”）；
- **#1.1**：`#doc-sec-epics` 目标为 `TEXTAREA`（3 行/高 118px），追加一行后自动保存成功、API `goal` 保留换行（4 行）；
- **#1.2/#2**：仅 EPIC-002 显示行内“该 Epic 还没有 Story”提示（1 个）；「所属场景（可选）」与“场景可选，一个场景可包含多个 Epic”文案可见。

产物（临时目录，未提交）：`C:\Users\icecream\AppData\Local\Temp\opencode\req-design-fixes\`（`e2e.cjs`、`report.json`、`backend.log`、`shots/` 20 张含 `export-order-detail.png`）。验证结束已停止临时后端，3461/4461 无监听；真实 3300 工作台与 `projects/app1` 未变（`GET /api/apps` 仍为 `app1=design`），临时应用未落入真实 `projects/`。

### 偏差 / 未验证

1. `goalText` 对字符串数组按换行 join（brief 允许）；同时扩展 `flushEpicBody` 解析多行目标，避免“目标多行 → Markdown 源码模式 → 重建结构”丢续行。
2. 内嵌 stories 展开时**顶层 `stories[]` 优先**；raw id 全局去重、归一化标题只在**同一 Epic 内**去重（同标题 Story 可合法出现在不同 Epic；复核修复见下）。
3. 缺图 warning 统计全文档所有页面，只读/已确认设计下提示条仍显示（信息性；截图需重新编辑设计）。
4. 截图超时提示统一为“原型画布渲染超时，请切回「原型」后重试”，替换原“尚未渲染完成”文案。
5. 未运行 `smoke:*` 脚本（本批不涉及交接包生成/开发/opencode 运行时；按 brief 只跑测试/build/Playwright）。
6. 未调真实模型：新 prompt 规则与归一化兜底由单测覆盖；真实模型是否稳定输出顶层 `stories[]` 待下一次真实 E2E 观察（不阻塞）。
7. 未改 ER（#3）、未改 `<768` 移动端、未在真实 app1 上执行截图/确认/生成（按约束禁止）。

### 复核修复（主会话 must-fix，2026-11-12）：同标题 Story 按 Epic 去重

`outline.ts` 标题去重键改为 Epic 范围（`title:${effectiveEpic}:${normalizeTitle}`，`effectiveEpic = item.epicId || defaultEpicId || ''`），raw id 去重保持全局；两个 Epic 各有同名内嵌 Story（如都叫「查看列表」）时不再静默丢弃第二个。新增 `doc.test.ts` 用例（两个 Epic 各一条同名 Story → 2 条 active、`epicId` 分别正确；顶层 + 同 Epic 内嵌重复仍去重，原有用例保持通过）。`npm run build --prefix backend` ✅、`npm test --prefix backend` **149/149**；前端 79/79、typecheck、check:vue 未变（无前端改动）。

### UX 补充（2026-11-13，待评审）：设计变更同步弹窗区分“同步”与“确认设计”

问题：需求+设计变更时设计 stale，头部主按钮为「同步需求」；同步弹窗只有「仅同步新增项 / 重生成受影响项」，用户不清楚“同步”就是同步动作、同步后还需再点「确认设计」。

仅改 `frontend/src/design/DesignSyncDialog.vue`（不改后端/sync mode/确认逻辑）：

| 项 | 结果 |
| --- | --- |
| 顶部引导 | token 信息框（`--rg-ai-soft`/`--rg-ai-border`，非 warning）：“同步 ≠ 确认设计：选择下面任一同步方式后，设计输入会绑定到最新需求并回到草稿；关闭弹窗后请点击右上角「确认设计」完成确认。”（`data-testid="sync-guide"`） |
| 按钮 | `仅同步新增项` → **`同步输入（保留设计）`**；`重生成受影响项` → **`同步并重置受影响项`**（mode 仍 `additions`/`regenerate`）；`去修改需求`/`暂不处理` 不变；`data-testid="sync-apply-additions"`/`sync-apply-regenerate` |
| 确认框/说明/提示 | 确认框标题同新按钮，正文明确“同步后设计会回到草稿，需要重新点击「确认设计」完成确认”；说明段落结尾“两种同步都不会替你确认设计”；成功提示 `需求输入已同步；设计已回到草稿，请点击右上角「确认设计」`（仍 stale 时保留原提示）；关闭弹窗 + emit applied、不自动确认 |
| 验证 | Playwright 临时应用（PORT=3462，不调模型）：需求确认 v2 → 实体/页面集/页面确认（设计 draft、input v2）→ reopen 需求 + 新增 1 Story → 再确认 v3（设计 stale、`需求文档已变更` 阻塞）→ UI 主按钮「同步需求」→ 同步弹窗（引导/新按钮/旧按钮消失）→「同步输入（保留设计）」→ 确认框 → 成功提示 → 主按钮变「确认设计」、stale 横幅消失、API `stale=false`/`readiness.ok=true` → 「确认设计」→ 设计 confirmed；**0 console/page/API 错误**，2 张截图 |
| 命令 | `npm test --prefix frontend` ✅ **87/87**；`typecheck`/`build`/`check:vue` ✅；后端未改（149/149 未重跑） |

## ER 图专业化改造（#3）完成（2026-11-12，实施会话；待评审）

上游：`docs/plans/2026-11-12-er-graph-redesign-brief.md`（§6 实施结果）。范围仅 ER 图前端（`ErGraph.vue` + 纯布局 + 测试/样式）；未改实体/关系数据模型、API、后端、页面原型、需求结构、实体编辑器表单。真实工作台（3300，app1）全程未停止、未改真实 `data/`/`projects/app1`。

### 改动

| 文件 | 改动 |
| --- | --- |
| `frontend/src/design/er-layout.js` | 新增纯布局：表卡片 240 宽/header 44/行 20；字段高度动态、≤12 行 + `moreCount`/`hiddenFields`；无向连通分量 + 有向 BFS 分层（循环/无根/自引用不死循环）、同层 position/名称稳定排序、组件纵向堆叠；无关系 2 列网格；相邻层三次贝塞尔、同层上下锚点（穿卡退化为层间通道）、跨层顶部正交通道、自环；边带 `path/cardinality/label/labelX/labelY/labelSubtext`；宽高覆盖边标签 |
| `frontend/src/design/ErGraph.vue` | 重写为专业表卡片图：工具条（表/关系计数、PK/FK/*/U 图例、缩放 75/100/125、关系维护提示）、边先于节点绘制（箭头/基数/关系名/标签底）、header（实体名/表名/已确认/草稿）、字段行（PK/FK/*/U、字段名、SQL 类型、FK → 目标实体）、`+N 更多字段`、点击/Enter/Space、`aria-label`、空状态、点阵画布、内部滚动、`--rg-*` token、深浅色、1024/768 工具条换行与无页面横向溢出 |
| `frontend/src/design/er-layout.test.mjs` | 新增 8 项：无关系网格/稳定顺序、A→B→C 分层与基数、循环、自引用、多组件、字段高度/省略行、`relationCardinality` 4 类 + 未知回退、字段行 PK/FK/必填/唯一/FK 目标 |
| `frontend/package.json` | `test` 列表加入 `src/design/er-layout.test.mjs` |

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | ✅ **87/87**（基线 79，+8） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `npm run check:vue --prefix frontend` | ✅ 全部 SFC 导入完整 |
| `npm run build --prefix backend` | ✅ `tsc` 通过（未改后端） |
| `npm test --prefix backend` | ✅ **149/149**（未改后端） |
| Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3462/OPENCODE_PORT=4462，`OPENCODE_AUTO_START=false`，不调模型） | ✅ 66 断言全通过；**13 张截图**；**0 console error / 0 page error / 0 意外 API>=400 / 0 页面级横向溢出 / 0 深色白底**（浅/深 × 1440/1024/768 + 空状态） |

Playwright 场景：
- 新应用 `er-graph-e2e` 确认需求（2 Epic）→ 5 实体（客户 6 字段/客户档案 4/订单 15/订单明细 7/商品 5）；关系 1:1、1:N、N:1、自引用（订单→父订单），含 required/unique/FK；设计 draft。
- 断言：节点 5、表名/实体名、`表 5 · 关系 5`、图例、边 5、基数 `1:1/1:N/N:1`、关系名、PK 5/FK 5、`*`/`U`、`+3 更多字段`、点击/Enter/Space 选中、缩放 75/125、空状态（`er-graph-empty`：无节点、`表 0 · 关系 0`、提示文案）。
- 1024/768 ER 画布内部横向滚动生效；截图人工确认关系线未穿过卡片。

产物（临时目录，未提交）：`C:\Users\icecream\AppData\Local\Temp\opencode\er-graph\`（`seed.mjs`、`run-e2e.cjs`、`results.json`、`backend.log`、`shots/` 13 张）。验证结束已停止临时后端，3462/4462 已释放；真实 3300 工作台与真实数据未变。

### 偏差 / 未验证

1. 类型列用紧凑 SQL 类型（`varchar/decimal/datetime/...`），完整字段名/类型/FK 目标在行 `<title>`；字段名按 FK 与否动态裁剪。
2. 跨层边走分量上方正交通道（保证不穿卡片），顶部额外预留 20px 标签空间（`PAD` 常量未改）；同层边优先上下贝塞尔，穿卡时退化为层间竖向通道。
3. PK = `id` 字段或首个 unique；FK = `ref`（可解析）或关系 `sourceField` 匹配；仅展示推断，不改数据。
4. 自环标签偏移到右侧上方，避免与相邻边标签重叠。
5. 未引入 X6/新依赖；无拖拽/手工布局/缩放持久化。
6. 重建了 `frontend/dist`（3300 实例静态文件）；未停止真实实例、未改真实数据。
7. 未验证 >5 实体大图、N:N 与多层跳过边视觉（单测覆盖循环/多组件/自引用/无关系）；未验证 `<768` 移动端与打印/导出。

## 测试问题修复（2026-11-09 后续，I-01—I-04）

详细问题记录见 `docs/test-issues-2026-11-09.md`。

### I-01 首页 opencode 自动探测

- 问题：首页运行时卡片显示“未启动”，需手动点“启动 opencode”。
- 根因：`ready` 只代表本工作台 spawn 的 serve；首页不探测 CLI、不自动启动。
- 改动：`OpencodeRuntime.autoDetect()` 探测 CLI 并自动拉起一次 serve（`OPENCODE_AUTO_START=false` 可关闭）；后端启动/健康检查触发；状态新增 `starting/installed/autoStart/autoStartAttempted/installError`；首页轮询到“已连接/失败”，区分“启动中 / 未安装 / 启动失败”，并显示 CLI。
- 验证：重启工作台后 health `ready=true, installed=true, bin=opencode.exe, version=2.2.5`；首页 Playwright 显示“已连接”。

### I-02 新建应用配置格式提示

- 问题：DB Host 等字段没有格式说明，不知道填 IP 还是 JDBC URL。
- 根因：模板渲染为 `jdbc:mysql://{{DB_HOST}}:{{DB_PORT}}/{{DB_NAME}}?...`，DB Host 只需主机名/IP，但 UI 未说明。
- 改动：所有基础/高级字段增加 `<small>` 提示和示例；提交校验拒绝 `jdbc:`/`://` 的 DB/Mail Host、非数字/越界 DB Port。
- 验证：Playwright 展开高级配置，8 条提示均存在；填 `jdbc:mysql://10.15.15.160` 返回明确错误且未创建应用。

### I-03 模型默认跟随 opencode CLI

- 问题：新应用未选模型时回退 `opencode/iceman-free`，免费额度用尽报 429。
- 根因：`resolveChatModel()` 直接回退 opencode 默认模型。
- 改动：解析顺序改为“显式 → 应用当前阶段 → 同应用其他阶段 → `OPENCODE_DEFAULT_MODEL` → opencode CLI 最近会话模型 → opencode 默认”；新增 `lastUsedModel()`；429/401/403 转可读提示，不抛原始 JSON。
- 验证：`GET /api/apps/app1/model?stage=design` fallback 为 `packycode-deepseek/deepseek-flash (high)`；强制 `iceman-free` 返回“免费额度已用尽…请在「模型」中切换”。
- 说明：`OPENCODE_DEFAULT_MODEL` 仍作为显式覆盖优先；新建应用表单暂未加模型选择。

### I-04 需求对话协议 JSON 解析

- 问题：多轮澄清后连续提示“本轮输出未能解析（未找到符合协议的 JSON 部分）”，卡片不落库。
- 根因：真实 SSE 中模型在 JSON 后再次输出 `<<<SPEC_JSON>>>`；旧解析对分隔符后整段文本直接 `JSON.parse`，尾随分隔符导致失败。
- 改动：新增 `protocol-output.js`：分隔符后优先解析，失败时提取平衡 JSON 对象，容忍尾随分隔符/说明/代码块/尾逗号；无分隔符时提取 JSON 并保留前文；接受 `{}` 无更新；重试提示要求 JSON 后不要再输出分隔符。
- 验证：前端 9 项单测通过（含复现用例）；真实模型对话更新卡片成功且无解析失败提示。

### I-07 设计阶段 constraints 形状归一化（阻断修复）

- 问题：设计阶段说“开始拆解”后只有正文，规格树一直为空，无法编辑/确认。
- 根因：真实 design 输出把字段 `constraints` 写成字符串（如 `"系统字典:性别"`），而 schema 要求字符串数组，`validateEnvelopeData()` 整轮拒绝 patch；重试仍可能同样形状，设计数据永远不落库。
- 改动：`protocol-output.js` 新增 `normalizeEnvelope()`，把 `constraints` 字符串/对象归一化为字符串数组；提示词明确 `constraints` 必须是数组并给示例；新增单测。
- 验证：前端 11/11、typecheck、build 通过；真实 design 会话拆解 A-1 成功，`entities=1/pages=3/roles=3`，设计页显示规格树与 94%（16/17）确认率，可进入条目详情/确认。A-2/A-3/B-1 仍需继续拆解。

## R1 评审（2026-11-10，主会话）

独立验证（未改代码）：

| 检查 | 结果 |
| --- | --- |
| `npm test --prefix backend` | ✅ 59/59 |
| `npm test --prefix frontend` | ✅ 20/20 |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ |
| `npm run smoke:requirements --prefix backend` | ✅ 全链路通过（模板 seed/文档/版本/回滚/确认/R3 409/删除） |

评审发现（建议在 R2/下一轮修复，不阻塞 R1 验收）：

1. **已确认文档是只读死胡同**：确认后章节保存/换模板/回滚均 409；`assertDocEditable` 文案说“请回滚版本或重新开启需求阶段后再修改”，但回滚也被 409、且没有重新开启入口。建议二选一：允许确认后回滚/重新编辑（带二次确认），或把文案改为“已确认文档只读；如需修改请删除/重建应用”，并明确后续入口。
2. **requirements-doc 路由未校验 `requirements_mode='doc'`**：structured 旧应用也能创建/确认需求文档，可能绕过原卡片校验；建议在 doc 路由入口守卫，或只对 doc 应用挂载。
3. **DocChatPanel 构建活动状态**：`review` 会被显示为“文档已确认”（当前 R1 没有 review 流程，低优先级）。
4. **删除使用中的模板**：UI 提示“已使用该模板的文档不受影响”，实际 `ensureRequirementDoc` 会在模板缺失时回退默认模板并改 `template_id`；建议禁止删除使用中模板或明确提示。
5. **自动保存版本增长快**：章节 1s debounce 每次生成版本；R2 需要版本合并/清理策略。
6. **DesignPending “查看需求阶段”** 指向只读文档；建议标注“只读查看”或提供重新编辑入口。

未独立复跑真实模型 Playwright E2E（实施会话已跑）；本次评审覆盖静态检查、单元/冒烟与代码走查。

## 验证记录（2026-11-09）

> 2026-11-10 R1 的完整验证见上文「R1-3 验证」「R1-4 真实模型 / UI E2E」；设计 D1—D4 验证见「D1—D4 验证」。当前全量：后端 71/71、前端 27/27，`npm run build`（backend tsc + frontend vite）、`npm run typecheck --prefix frontend` 通过。下表为 2026-11-09 的历史记录。

### 依赖安装

- `npm install --prefix frontend`：成功；`@vueuse/core@15` 有 Node >=22 引擎警告（当前 Node 20，typecheck/build 通过）。
- `npm install --prefix backend`：首次失败——`better-sqlite3` prebuild 下载超时、node-gyp 缺 VS C++ 工具链。
- 处置：`npm install --prefix backend --ignore-scripts` 后，用 npmmirror 的 Node 20 (ABI 115) 预编译包补齐 `backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node`；内存库建表/读写验证通过。
- 该处置是环境 workaround，不是项目代码；新机器需装 VS Build Tools 或重复此步骤。

### 静态检查与单元测试

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 46/46（原有 43 项 + execution failure 2 项 + sessionModelRef 1 项） |
| `npm test --prefix frontend` | ✅ 11/11（协议 JSON 提取/尾随分隔符/代码块/尾逗号/无分隔符/空对象 + constraints 形状归一化） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` 通过 |
| `npm run build`（root，backend + frontend） | ✅ |

### P1 后端 API（真实 SQLite + 模板）

| 检查 | 结果 |
| --- | --- |
| 创建应用 | ✅ 201；目录、`apps` 行、阶段事件生成 |
| EOS 渲染 | ✅ `pom.xml` artifactId、`server.port`、`spring.application.name`、`sys-code/sys-key` 正确 |
| 占位符残留 | ✅ 递归扫描项目目录无 `{{...}}`（README 已整理） |
| 凭据 | ✅ 未提供项为 `CHANGE_ME`；无示例真实凭据 |
| workspace 隔离 | ✅ 应用 A 2 个点、应用 B 1 个点，互不串联；跨应用 doc 404 |
| 旧接口隔离 | ✅ legacy `PUT /api/workspace` 空列表不删除应用模块；legacy doc 跨应用 404 |
| 需求完成校验 | ✅ 卡片未确认/缺目标/角色/验收时 400 + issues；补全后 200 进入设计 |
| 设计确认（P1 历史） | ✅ 200 进入开发；P3 起改为先校验/生成交接包再切换阶段 |
| 确认完成 | ✅ 200 状态 completed；重复调用幂等 |
| 删除 | ✅ 无 confirm 400；confirm 后目录/登记删除，再查 404 |
| 保留 ID | ✅ 创建 `default` 返回 400 |

### P1 前端（Playwright headless Chromium）

| 检查 | 结果 |
| --- | --- |
| 首页 | ✅ 应用列表/空状态/运行时卡片 |
| 新建应用 | ✅ 表单创建后跳转 `#/apps/p1-ui-test/requirements` |
| 应用工作区 | ✅ 阶段栏、应用名/ID、嵌入需求视图；旧批次栏/开发页签隐藏 |
| 已完成阶段 | ✅ 需求完成后 `✓ 需求`，可进入设计 |
| 阶段流转 | ✅ 需求 → 设计 → 开发 → 确认完成；完成状态刷新后保持 |
| 锁定阶段 | ✅ 未完成前一阶段时按钮禁用/提示 |
| 双应用隔离 | ✅ 第二个应用 workspace 为空；首页分别展示统计 |
| 控制台/网络 | ✅ 0 console error、0 个 >=400 响应 |

### P2 opencode 聊天 / agent / 任务

| 检查 | 结果 |
| --- | --- |
| req/design agent 文件 | ✅ 应用创建时生成；存在自定义不覆盖 |
| agent 权限 | ✅ req/design 均 primary；shell/edit/read/grep/glob/list/webfetch/websearch/todowrite/question/skill 等 deny |
| chat requirements | ✅ meta.agent=req；delta → done；收到「收到」 |
| chat design | ✅ meta.agent=design；模型 packycode-deepseek/deepseek-flash；收到文本 |
| 会话清理 | ✅ 每次 chat 结束/失败后会话 GET 返回 404；客户端 abort 后 2s 会话也返回 404 |
| SSE 断开/错误 | ✅ 客户端断开触发 interrupt + 删除；模型失败返回 `{type:'error'}`，服务不崩溃 |
| 文件副作用 | ✅ 对话前后应用目录文件列表无新增/删除 |
| 模型接口 | ✅ GET 返回 stored/fallback；PUT 校验后保存；PUT null 清除 |
| `generateText` | ✅ 独立端口 4789 真实模型返回「生成」，会话数 0（已删除） |
| decompose 任务 | ✅ 应用 + batch + 已确认卡片 → 任务 done，结果含 1 个 patch（约 2 分钟） |
| 旧 LLM 入口 | ✅ `/api/llm/chat`、`/api/settings/llm` 已移除；启动清理旧 `llm` 设置 |
| 默认免费模型 | ⚠️ `opencode/iceman-free` 命中免费额度 429；本次真实聊天改用 `packycode-deepseek/deepseek-flash` |

### P2 前端（Playwright headless Chromium）

| 检查 | 结果 |
| --- | --- |
| 需求聊天 | ✅ 发送“只回复两个字：收到” → 流式显示「收到」 |
| 聊天持久化 | ✅ 刷新后消息仍在（应用级 conversation） |
| 设计聊天 | ✅ 进入设计阶段后使用 design agent；阶段栏显示 `✓ 需求 / 2 设计` |
| 模型设置 | ✅ 打开“模型”弹窗：运行时就绪、当前阶段=设计、当前模型=deepseek-flash，可选择/保存 |
| 控制台/网络 | ✅ 0 console error、0 个 >=400 响应 |
| AI 文件副作用 | ✅ 0 个新增文件 |

### P3 交接包（单元测试）

| 检查 | 结果 |
| --- | --- |
| 只导出已确认项 | ✅ 确认需求/实体/页面/服务/测试用例进入文档；草稿需求点/实体/角色/测试用例进入开放问题 |
| 跨需求点引用 | ✅ `mod-b:order` 解析为 `ENT-002`，页面绑定正确 |
| 编号稳定 | ✅ FEAT-001、ENT-001、PAGE-001/002、API-001、FLOW-001、RULE-001、TRIGGER-001、DICT-001、INT-001、FN-001、NFR-001、NAV-001、TC-001 |
| 校验失败 | ✅ 缺目标/验收标准、页面→实体/字段、权限→角色、实体关系、规则字段的悬空引用均返回 issues |
| 渲染完整 | ✅ 4 份 Markdown + schema.sql；含 Mermaid ER、验收清单、测试清单、开放问题 |
| 自包含/无内部 ID | ✅ 扫描无 `{{...}}`、`mod-a/mod-b`、`customer-list/customer-form`、`role-admin/svc-1/flow-1/rule-1`、`tc-*` |
| 稳定性 | ✅ 相同 Bundle 两次渲染内容完全一致 |
| 写盘/hash | ✅ 写入文件、版本递增、整体/单文件 hash 记录；内容变化 hash 变化；文件顺序无关 |
| 可选文件清理 | ✅ 去掉实体重新生成后 `schema.sql` 被清理 |
| 外部删除容错 | ✅ 文件被删除时 GET 返回 `missing:true`，不抛错 |

### P3 交接包 API（真实 Express + 临时 SQLite/目录）

`npm run smoke:handoff --prefix backend`：

| 检查 | 结果 |
| --- | --- |
| 创建应用 → 写入场景/卡片/Spec/测试用例 | ✅ 真实 `templates/eos-app` 渲染 + 应用级 workspace/doc |
| 需求完成 | ✅ `requirements → design` |
| `POST /handoff/preview` | ✅ 5 个文件；`02-DESIGN.md` 含 ENT-001；未写盘 |
| `POST /handoff/generate` | ✅ v1；5 个文件落 `docs/handoff/`；返回 hash/文件清单 |
| `GET /handoff` | ✅ v1；`01-REQUIREMENTS.md` 含 `FEAT-001-AC1` |
| 设计完成 | ✅ 重新生成 v2；状态 `development`；`handoff_hash` 写入 |
| 删除应用 | ✅ 目录/登记/交接包行清理 |

### P3 前端（Playwright 1.59.0 headless Chromium）

| 检查 | 结果 |
| --- | --- |
| 交接包入口 | ✅ 设计阶段顶栏显示“交接包”；空状态提示未生成 |
| 预览 | ✅ 生成 5 个文件视图；`02-DESIGN.md` 含 ENT-001；标记“尚未写入”；文件系统确认未写盘 |
| 生成 | ✅ Element Plus 确认框可点击；生成 v1；`docs/handoff/02-DESIGN.md` 存在 |
| 下载 | ✅ 下载 `00-README.md` |
| 完成设计 | ✅ 弹窗说明“校验交接包”；成功后重新生成 v2、解锁开发 |
| 开发入口 | ✅ 立即进入开发；显示“确认完成开发” |
| 重新打开交接包 | ✅ 显示 v2 与 `docs/handoff` 目录 |
| 控制台/网络 | ✅ 0 console error、0 个 `/api` >=400 响应 |

### P4 开发会话（单元测试）

| 检查 | 结果 |
| --- | --- |
| 时间线归一化 | ✅ 用户/assistant 文本、read/write/shell 工具、阶段步骤、diff、exit、token 统计 |
| 脱敏/裁剪 | ✅ Authorization/TOKEN 等不泄露；输出/diff 有上限 |
| 开发服务校验 | ✅ 缺交接包、阶段不对、无会话时给出明确 409/错误 |
| app_sessions | ✅ 可写入/查询/清理；`activeSessionRow` 正常 |

### P4 开发会话 API（真实 opencode + 真实模型）

`npm run smoke:dev --prefix backend`：

| 检查 | 结果 |
| --- | --- |
| 应用/交接包 | ✅ 创建应用 → 需求完成 → 设计完成 → `docs/handoff/` |
| 开发模型 | ✅ `PUT /model?stage=development` 保存 `packycode-deepseek/deepseek-flash` |
| 创建会话 | ✅ `agent=build`，返回 opencode sessionID |
| SSE | ✅ `/development/events` 首帧 `hello` |
| 首条提示 | ✅ 使用交接包提示；真实模型返回「收到」；4 条消息、1 个步骤、1 个工具 |
| serve 重启恢复 | ✅ 停止/重启 opencode serve 后同一 sessionID 仍可读取 |
| 完成/继续 | ✅ `completed` 后发送消息恢复 `development` |
| 停止 | ✅ `/development/interrupt` 200 |
| 清理 | ✅ 删除应用后目录/登记/会话清理 |

### P4 前端（Playwright 1.59.0 headless Chromium，API mock）

| 检查 | 结果 |
| --- | --- |
| 时间线 | ✅ 用户消息、assistant 回复、阶段步骤渲染 |
| 工具卡 | ✅ write 工具展开显示 diff；shell 展开显示 `tests passed` |
| 文件变化 | ✅ 右侧显示 `frontend/src/CustomerList.vue` |
| 权限/表单 | ✅ 权限请求/表单卡渲染；“允许一次”请求发送 |
| 交接文档 | ✅ 点击 `02-DESIGN.md` 打开交接包并定位到该文件 |
| Composer | ✅ Ctrl+Enter 发送；请求体内容正确 |
| 控制台/网络 | ✅ 0 console error、0 个 `/api` >=400 响应 |

### P5 真实应用（完成）

| 检查 | 结果 |
| --- | --- |
| 应用目录/配置 | ✅ `projects/quarterly-reporting/`；MySQL URL/库/用户/池参数写入 `user-config.xml`；无 `{{...}}` 残留 |
| 交接包 | ✅ v1；只读季度/ATM 列表与详情、服务、权限、NFR、2 条测试用例 |
| 后端测试 | ✅ `mvn -o -B test` 10/10（H2 MySQL 模式） |
| 后端打包 | ✅ `mvn -o -B package` BUILD SUCCESS |
| 前端构建 | ✅ `npm run build`（vue-tsc + vite） |
| UI mock E2E | ✅ 季度列表 → ATM 列表 → 详情 → 返回 → 空状态；0 console error、0 API >=400 |
| 真实开发页 | ✅ 真实会话 119 消息/29 步骤/177 工具；时间线/工具卡/文件变化/交接文档正常；0 console error、0 API >=400 |
| 脱敏 | ✅ 真实 DB 密码从未修复的 API 暴露 → 修复后 API/UI/SSE/工具输出/diff 不再出现；43 项测试含脱敏用例 |
| EOS 启动 | ✅ 已加载 license/EOS system/MySQL datasource；监听 18081 |
| 真实接口 | ✅ `/quarters`、`/atm-metrics` 200；空/非空分页、筛选、详情；400/404 校验正确 |
| 真实 MySQL UI | ✅ 空状态 E2E 通过（季度/ATM/详情 404）；0 意外 console/API 错误 |
| 非空数据 | ✅ 经确认写入 2+2 条 demo 行；真实季度/ATM/详情/筛选 E2E 通过 |
| 用户确认完成 | ✅ `POST /complete` → `completed`；记录 completedAt 与 lastSessionId |

### P0 opencode 运行时（回归）

| 检查 | 结果 |
| --- | --- |
| `npm run smoke:opencode --prefix backend` | ✅ 真实 serve + 真实模型：创建会话 → prompt → SSE「收到」→ 删除 → 停止（端口 4788） |
| `/api/opencode/start|stop` | ✅ 端口释放、pid 文件清理 |
| 模型列表 | ✅ 61 个模型；无 `apiKey` / `settings` |

### EOS 模板（Maven）

临时渲染 `{{APP_ID}}` 后：

| 命令 | 结果 |
| --- | --- |
| `mvn -o -B -f <tmp>/pom.xml validate` | ✅ BUILD SUCCESS |
| `mvn -o -B -f <tmp>/pom.xml dependency:resolve` | ✅ BUILD SUCCESS（本地仓库已有全部依赖） |
| `mvn -o -B -f <tmp>/pom.xml compile` | ✅ BUILD SUCCESS |

说明：以上为 offline 验证（本机 `~/.m2` 已有 `com.primeton.eos:*:9.0.0`）；未测试在线 Nexus，未启动 Nacos/MySQL/Redis，未验证 license 运行态。

## M2 完成（2026-11-13，实施会话 + 主会话评审）：需求模块数据底座 + 默认模块迁移 + 模块 API

范围：`docs/plans/2026-11-13-module-m2-implementation-brief.md` §1—§9（只做 M2；不改前端 UI/设计表/交接包/Change Set/`app_dev_phases`/#8）。详细实施记录见该交接单 **§8 实施结果**。

### 做了什么

- **表**：新增 `app_modules`、`app_requirement_bundles`；`app_requirement_docs` PK 改 `(app_id, module_id)`；`app_requirement_doc_sections` PK 改 `(app_id, module_id, section_key)`；`app_requirement_doc_versions` 加 `module_id` + 唯一 `(app_id, module_id, version)`（`id` 保留 AUTOINCREMENT）。新索引统一 `idx_req_*`/`idx_modules_app`，旧索引名留在 `*_legacy`。
- **迁移**：`requirements/module-migration.ts`（不 import db.ts；单事务、幂等、fail-closed）。有文档的应用建默认模块 `MOD-001`（title=应用名，required=1，position=0），显式列 copy docs/sections/versions（versions 保留 `id`），旧表改名 `*_legacy` 保留，生成 bundle v1；无文档应用不建模块，`ensureRequirementDoc` 懒创建。
- **服务/API**：需求文档全部接口尾部可选 `moduleId`（缺省=默认模块；未知 404；归档读允许写 409）；新增 `/api/apps/:id/requirements-modules`（列表/新增/更新/归档/恢复）与 `/api/apps/:id/requirements-bundle`（只读聚合/confirm）；`GET /apps/:id` 增加只读 `requirementModules`；删除应用清理 `app_modules`/bundle。
- **确认语义**：单模块应用确认模块 = 旧行为（design + `requirements_confirmed_at` + bundle v1 + updateActiveChangeSet，`appConfirmed=true`）；多模块只确认本模块（`appConfirmed=false` + `pendingModuleIds`），由 `POST /requirements-bundle/confirm` 推进应用级。
- **ID 全局唯一**：`global` 保持本模块；新增 `reservedIds`（全应用含归档）只做占用集合；显式 raw id 属于其它模块 → 换新号（§9.3 三条用例单测覆盖）。
- **脚本**：`migrate:modules`（默认 dry-run、默认拒绝真实库、只输出计数/hash/表名）；`smoke:modules`（端口 3419，不调模型）。

### 验证（实际执行）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **178/178**（M2 实施时 172；主会话 must-fix 后 +6：`db-guards` 3 + MF1/MF4 2 + MF3 1） |
| `npm run smoke:requirements` / `smoke:modules` / `smoke:change-set` / `smoke:design-handoff` / `smoke:design` | 全部通过 |
| `npm test --prefix frontend` | 96/96 |
| `npm run typecheck` / `build` / `check:vue`（frontend） | 全部通过 |

### 真实 app1 迁移（已由主会话处置并验收，见下）

- **意外越界**：既有 `src/chat/service.test.ts` 静态 import `./service` → 传递 import `../db` 且未设置 `RG_DATA_DIR`，`npm test` 会打开真实 `data/requirements.db`。M2 在 `db.ts` 加启动迁移后，第一次 `npm test` 于 **2026-11-13T07:20:24Z** 对真实库执行了迁移（**未按计划先停写/备份**）。已修复该测试的隔离（临时 `RG_DATA_DIR` + 动态 import，未改断言），此后 `npm test` 不再写真实库（WAL mtime 未变）。
- **内容无丢失**（只读快照副本逐行比对，真实库未再做任何写入）：docs 1（`builtin-prd`/confirmed/v24）、sections 13、versions 24（v1..v24，latest confirm/v24）、设计 1/5/3/11（confirmed v7）、交接包 2、变更单 2、会话 6；`*_legacy` 与目标表 **docs/sections/versions 逐行完全一致**；模块 `MOD-001`、bundle v1 `hash=aafe2ee8…071e`、`docHash=33fab8da…7f94`。旧 API（无 `moduleId`）读取一致（文档 hash 与迁移前一致，版本列表 24，bundle latest v1，设计 confirmed v7，变更单 2）；已确认文档 rollback 仍 409（既有只读语义），同副本新建应用 rollback 通过。
- **回滚材料**：`*_legacy` 表 + 旧索引保留；未执行回滚写入（遵守“不得写真实库”）。快照在 `C:\Users\icecream\AppData\Local\Temp\opencode\m2-app1-verify\snapshot.db`（评审后可删）。
- **真实实例（历史，已被正式验收取代）**：事故后一段时间 3300 仍运行旧 `dist`，旧代码对需求文档**写**路径会因 `module_id NOT NULL` 失败；主会话随后按“停写 → 备份 → 新 dist 重启 → 验收”处理，见下「正式验收」。

### 未验证 / 已知限制（M2）

- 真实库的“停写 + 备份 + 迁移”标准流程未按计划执行（被 07:20Z 的意外迁移取代）；用户已决定接受已迁移状态，主会话已完成补备份 + 重启 + 逐项验收（见下）。
- 多模块真实模型 E2E、多模块 + Change Set + 交接包组合（M5/M6）未验证。
- 前端模块 UI（M3）未实现；`requirementModules` 暂无消费方。
- 设计仍应用级（默认模块）：设计项目/实体/页面集/版本/设计输入、交接包、Change Set、覆盖度均未按模块（M4/M5/M6）；`reopen` 仍沿用“单设计项目退回 draft”。
- 模板切换只改当前模块文档并同步应用默认模板，**不传播到其它模块**（M3 待定）；需求 doc 对话历史仍应用级（`moduleId` 只影响 prompt 上下文）。
- 多模块应用不传 `moduleId` 的写请求落到默认模块（旧 API 兼容），M3 UI 必须显式传。
- 未做 >50 模块的 `collectAppOutlineIds` 全表扫描性能评估；SQLite 版本下限按 ≥3.25 假设（`ALTER TABLE RENAME`）。
- 实施中曾因 PowerShell 重写破坏 `doc.ts` 编码，已用构建产物逐字核对中文运行字符串并整文件复原；tsc/172 测试/全部冒烟通过。

### 主会话评审（2026-11-13）：通过 + must-fix 已修

主会话独立复跑 `npm run build/test --prefix backend`（当时 172/172）、前端 96/96 + typecheck/build/check:vue、5 支冒烟全过，并用 canary 确认 `npm test` 不再改真实 `data/requirements.db`。评审结论：架构/迁移/ID 范围/确认语义/路由符合交接单。must-fix 已全部完成（详见交接单 §8.11），**最终 `npm test --prefix backend` = 178/178**（+6 测试），前端 96/96，`smoke:requirements`/`smoke:modules`/`smoke:change-set`/`smoke:design-handoff`/`smoke:design` 复跑通过：

- **MF1 迁移前自动备份**：`backupBeforeMigration` → `VACUUM INTO` 生成 `requirements.db.pre-modules-<UTC>.bak`（同名 `-2/-3`，不覆盖；已迁移/空库跳过不写文件）；`db.ts` 在迁移前调用，成功打印路径，失败 fail-closed。实测：首次 36864 B、同秒 `-2.bak` 36864 B、迁移后跳过并返回原因。
- **MF2 测试隔离硬保护**：新增 `db-guards.ts`；测试进程（`NODE_TEST_CONTEXT`）未设置 `RG_DATA_DIR` → 打开 DB 前直接抛错；`db-guards.test.ts` 3 项。
- **MF3 取消变更恢复**：多模块只恢复单模块时不再误置 `apps.requirements_confirmed_at`（仅全部必选模块 confirmed 才置位）；单模块行为不变。
- **MF4 老库缺列**：`sections.data_json` / `versions.change_set_id` 缺失的旧库迁移自动补列、数据/版本保留、幂等。
- **收尾 A**：`createModule` 非需求阶段 409 文案改为如实说明（设计/开发阶段的模块变更入口在 M3/M5 后续接入）。
- **收尾 B**：交接单 §8.11 + 本段；未改 `AGENTS.md` 与 `2026-11-13-main-review-handoff-module-m2.md`。

**真实库状态（用户已决定）**：接受“已迁移”现状并补正式验收（主会话执行：`.bak` 备份 + 重启 3300 + app1 需求/版本/设计/交接包/变更单逐项验收 + 可回滚）。M2 之后的旧库迁移默认先自动备份（MF1），不再无备份迁移。

### 正式验收（2026-11-13，主会话执行，已完成）

1. **停写**：`stop.cmd` 停止工作台（PID 39132）+ opencode serve；确认 3300/4771 释放、`data/workbench.pid` 移除；确认当时唯一 active 开发会话处于空闲（最后活动 03:16Z，早于停服）。
2. **备份**（仓库外 + 本地各一份，`VACUUM INTO` 一致性快照，含 WAL 内容）：
   - `C:\Users\icecream\AppData\Local\Temp\opencode\m2-accept-backup-20261113154721\requirements.db`（4521984 B）
   - `data/requirements.db.pre-modules-accepted-20261113154721.bak`（同大小，本地回滚用）
   - 备份自检：`integrity_check=ok`；已迁移结构；docs 1 / sections 13 / versions 24 / 设计 1/5/3/11 / 交接包 2 / 变更单 2 / 会话 6；`content_md` sha256=`33fab8da…7f94`。
3. **重启新代码**：`start.cmd` → 3300（新 PID）+ opencode 4771 ready（2.2.5）；`/api/health` ok；`GET /` 200。
4. **app1 验收（新 dist，真实库）**：

   | 检查 | 结果 |
   | --- | --- |
   | `GET /apps/app1` | status=`development`；`requirementModules` 1 个 `MOD-001`（required/position 0，docStatus=confirmed/docVersion=24）；`requirementDoc` v24/confirmed/`builtin-prd`；handoff v2（CS #2）；`activeChangeSet=null` |
   | `GET requirements-doc`（无 `moduleId`） | 默认模块 `MOD-001`；13 章节（`meta…acceptance` 顺序不变）；v24/confirmed；`contentMd` 长度 11941、sha256=`33fab8da…7f94`（与迁移前一致） |
   | `GET requirements-doc/versions` | 24 条（v1 template-change … v24 confirm，`changeSetSeq=2`） |
   | `GET versions/24` | content hash 与当前一致；来源 confirm；变更单 #2 |
   | `GET requirements-modules?includeArchived=true` | 1 个模块 + `defaultModuleId` 一致 |
   | `GET requirements-bundle` | latest v1 `aafe2ee8…071e`；实时聚合 hash 相同（无漂移）；`allRequiredConfirmed=true`；pending 0 |
   | `GET design` | 200；5 实体 / 3 页面集（DB 11 页面）；confirmed |
   | `GET change-sets` | 2 条（#2/#1，均 completed） |
   | `GET development/sessions` | 6 条（5 归档 + 1 active），未破坏 |
   | `GET design/handoff` | 200，文件清单可读 |

5. **库完整性**：`integrity_check=ok`、`foreign_key_check` 0 行；`*_legacy` 1/13/24 保留；重启后未新增模块/bundle（仍 1/1）；`app_dev_phases` 4、会话 6 不变；`data/` 无 MF1 自动备份（已迁移 → 按设计跳过）。
6. **回滚**：`*_legacy` 三表 + 上述 `.bak` 可直接恢复；未执行回滚写入。

**M3 已确认决策（2026-11-13 用户确认，进入 M3 交接单 `docs/plans/2026-11-13-module-m3-implementation-brief.md`）**：

1. **模块新增只在需求阶段**：设计阶段不直接新增；需要新增时先回到需求阶段（设计阶段用“重新编辑需求”，开发/完成走 Change Set，模块选择 M5），再 需求 → 设计 → 开发。
2. **需求模板切换应用级**：切换后当前应用所有未归档模块一起跟随（每模块 `template-change` 版本 + 二次确认 + 逐模块影响预览）；有已确认模块时拒绝切换（409 列出）；归档模块不参与。
3. **doc 对话历史按模块拆分**：每模块独立 settings key；旧应用级历史作为默认模块只读回退，首次写入落到模块 key，不删除旧数据。

M3 实施交接单已写好（待实施）：`docs/plans/2026-11-13-module-m3-implementation-brief.md`（含后端小改：应用级模板切换 + 预览、模块排序、按模块 chat、门禁文案；前端模块 rail/总览/模板切换/只读与响应式）。

## M3 完成（2026-11-13，实施会话 + 主会话评审）：需求模块 UI + 应用级模板切换 + 按模块对话历史

范围：`docs/plans/2026-11-13-module-m3-implementation-brief.md` §1—§9（只做 M3；**未改数据库表结构**，未改设计/交接包/Change Set/`app_dev_phases`）。详细实施记录见该交接单 **§8 实施结果**。

### 做了什么

- **模块 rail + 总览**：需求页改为“模块 rail | 对话 | 文档”，顶部 strip + `RequirementOverview` 弹窗显示必选进度、bundle latest 版本/短 hash、实时 hash 漂移、pending 与“完成需求阶段”；模块新增/编辑（标题/描述/负责人/必选）/上移下移/归档/恢复/切换；已归档折叠、只读。
- **应用级模板切换（决策 2）**：`POST /requirements-doc/template/preview`（只读、逐模块 from→to/kept/dropped/added/blocked）+ `PUT /requirements-doc/template` `scope='app'`（单事务遍历全部未归档模块，每模块 `version+1`、`source=template-change`、同步应用默认模板；任一模块已确认 → 409 + issues 且不写任何模块；归档模块不动）。`scope='module'`/不传 = 旧行为。
- **模块排序**：`PUT /requirements-modules/order`，`moduleIds` 必须与全部未归档模块集合完全一致（否则 400 不改库），事务写 `position=0..n-1`。
- **按模块 doc 对话（决策 3）**：settings key `app.<appId>.requirementsDocChat.<moduleId>`；默认模块无模块 key 时回退旧 `app.<appId>.requirementsDocChat` 并返回 `legacyFallback:true`；PUT 只写模块 key，**旧 key 不删除/不改写**；前端聊天头部显示模块名、切模块重挂载历史。
- **确认/阶段语义**：模块确认 = 只确认当前模块（多模块 `appConfirmed=false` + pending，仍停留需求页并自动跳下一个待确认模块）；全部必选确认后“完成需求阶段”走 bundle confirm，成功后才进入设计；设计/开发阶段需求页整页只读 + 新增模块禁用提示；设计阶段“重新编辑需求”仍可用（回到需求后可新增），开发阶段提示走变更单。
- **模块新增门禁**：`createModule` 非需求阶段 409 文案改为“设计阶段先重新编辑需求；开发/完成阶段先发起需求+设计变更”。
- **前端基建**：`module-helpers.js`（初始选择/回退/进度/排序/归档回退/门禁/preview 可用性）、`api-query.js`（moduleId query）、所有文档/版本/导出/聊天/AI preview+apply 调用显式传 `moduleId`；未新增依赖、未新增 Pinia store、未新增主题 token。

### 验证（实际执行）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **187/187**（基线 178，+9：`requirements/module-ui-support.test.ts` 8 项 + must-fix chat 守卫 1 项） |
| `npm run smoke:requirements` / `smoke:modules` / `smoke:change-set` / `smoke:design-handoff` / `smoke:design` | 全部通过（`smoke:modules` 已扩展 M3：排序/preview+apply/blocked/按模块 chat） |
| `npm test --prefix frontend` | **107/107**（基线 96，+11：module-helpers 9 + api-query 2） |
| `npm run typecheck` / `build` / `check:vue`（frontend） | 全部通过 |

- **Playwright（临时 data/projects，端口 3421；`OPENCODE_AUTO_START=false`；不调模型）**：43 项断言通过、**48 张截图**（浅/深 × 1440/1024/768：需求页、总览、模板预览、设计/开发只读、1024/768 模块/对话/大纲抽屉）；**0 console error / 0 pageerror / 0 非预期 API≥400 / 0 横向溢出 / 0 深色白底块**。另做一次性校验：设计阶段模板入口被拦截、新增模块禁用+提示，0 console/API 错误。截图与 `summary.json` 在 `C:\Users\icecream\AppData\Local\Temp\opencode\m3-e2e\`（临时）。
- 场景：UI 新建应用 → 默认 MOD-001；新增模块；同一章节两模块互不影响；版本按模块独立（模块一 v2、模块二 v1）；模板预览 13→6 → 应用后两模块 6 节/version+1/template-change/应用默认模板同步；模块 1 确认仍 requirements + pending；已确认模块阻塞切换（按钮 disabled）；总览 1/2；模块 2 确认 → 完成需求阶段 → design + 只读；重新编辑回 requirement 且可新增；排序/编辑负责人/归档回退只读/恢复；按模块 chat 头部与空态。

### 主会话评审 must-fix（2026-11-13，已修）

主会话评审结论：主路径通过（独立复跑 186/186、106/106、5 支冒烟与自有 Playwright）；3 项 must-fix 已修：

1. **MF-M3-1 模板切换前 flush**：`useTemplate` 改 async，只读/同模板（且无差异模块）不写库；否则先 `flushAll()`，失败中止并提示，避免防抖未落盘时被服务端重写丢弃。Playwright 用“阻断 1000ms 定时器”确定性复现，切换后 `problem` 内容保留、最新版本 `template-change`、网络顺序章节保存先于模板切换。
2. **MF-M3-2 chat 未知 moduleId 404**：GET 显式 moduleId 用 `moduleById` 校验，不存在 404；缺省仍默认模块、归档读允许；新增后端测试覆盖未知 GET/PUT 404、归档读/写（187）。
3. **MF-M3-3 同模板对齐全部模块**：新增 `hasDivergentTemplates`（前端 helper + 单测）与 `TemplateCenterDialog.hasDivergentTemplates`，同模板按钮在存在不一致模块时可用；`useTemplate` early-return 随之放宽。Playwright：模块 B 单独切精简 PRD 后，用标准 PRD 对齐 → A/B 都 13 节、都 `builtin-prd`、最新版本 `template-change`；再次打开恢复“使用中”禁用。

must-fix Playwright：**18 项断言 / 4 张截图 / 0 console/pageerror / 0 非预期 API≥400**（`C:\Users\icecream\AppData\Local\Temp\opencode\m3-mf\shots\`）。最终数字：**后端 187、前端 107**；`smoke:requirements`/`smoke:modules`、typecheck/build/check:vue 全部通过。

### 主会话独立复核（2026-11-13）

- 独立复跑：后端 187/187、前端 107/107、5 支冒烟、typecheck/build/check:vue 全过；真实库 canary 不变（仍 docs 1 / sections 13 / versions 24 / legacy 1/13/24 / 模块 1 / bundle v1 / app1 development confirmed v24）。
- 独立 Playwright 两套（临时 data/projects、端口 3423/3424、`OPENCODE_AUTO_START=false`）：
  1. 主路径：默认模块懒创建 → UI 新增模块 → 两模块同章节隔离 + 切回保留 → 模板中心逐模块预览（2 卡）→ 应用级切精简 PRD（两模块 6 节、v2）→ 多模块确认不推进 → bundle confirm 进入 design → 新增模块禁用 + 只读提示 → 1024 无横向溢出 + rail 折叠/抽屉打开；0 console / 0 意外 API≥400。
  2. must-fix 回归：未知 moduleId chat GET/PUT 均 404；模块 B 单独切精简后，用标准 PRD“对齐全部模块”成功（A/B 均 13 节 `builtin-prd`），全一致后按钮恢复禁用；`#doc-sec-problem` 输入后**立即**应用级切换，内容被 flush 保留、最新版本 `template-change`、两模块 6 节；0 console / 0 意外 API≥400。
- 结论：M3 通过，可与 M2 一起作为后续 M4 的基线。

**运行态**：评审期间前端 `dist` 已由 M3 重建，而 3300 后端进程仍是 M2（15:47 启动），曾出现“前端 M3 / 后端 M2”不一致。用户确认后已执行 `stop.cmd → start.cmd` 重启（新 PID 30248，opencode 4771 ready），并只读验证 app1：需求 v24/confirmed（13 章节、hash `33fab8da…`）、模块 1、bundle v1 `aafe2ee8…` 无漂移、设计 5 实体/3 页面集、变更单 2、会话 6、库 1/13/24 + legacy 1/13/24 均未变；`POST /requirements-doc/template/preview` 返回 200 且 `canApply=false`、`blockedModules=1`（app1 已确认，符合只读语义），证明 M3 后端已生效；错误日志 0。

### 未验证 / 已知限制（M3）

- 未在真实 3300/app1 验证（未停/未改真实实例，真实库未写入）；真实 app1 的单模块行为在本批代码路径上保持旧语义（单模块确认仍直接进入设计）。
- 未用真实模型跑多模块 doc 聊天（只验证历史 API/UI 空态）；未验证 >50 模块（无虚拟列表，rail 内部滚动）、多人并发编辑同一模块、<768 移动端。
- 应用非需求阶段整页只读（含模块信息编辑/排序/归档/恢复）：设计阶段先「重新编辑需求」，开发阶段走 Change Set；模块选择/设计模块化/交接包模块化在 M4/M5/M6。
- AppShell 顶栏状态文字仍按默认模块文档摘要（M2 既有）；多模块明细在需求页总览。
- 预览 `dropped` 列出所有被移除章节（空章节也列，只有有内容时才 warning）；需求聚合版本仍只在单模块确认/bundle confirm 时落库。
- 负责人/必选只是标签/进度语义，不是权限；归档模块文档/版本永久保留、只读，无物理删除入口。

## 2026-11-13 政策：开发前期不做旧应用数据兼容；app1 已删除（用户确认）

工作台仍处于开发前期、尚未定版：**大框架调整默认删除旧应用，不做数据迁移/兼容**；只有用户明确要求兼容旧数据时才写迁移。记录在 `AGENTS.md`，实施会话不得再为“旧应用数据”设计迁移/legacy/回填。

按此政策处理 app1（M2/M3 段落中的 app1 验收为历史记录，应用已不存在）：

1. 停掉 app1 自身进程（前端 5173 / 后端 8081），未动 VS Code 编辑器。
2. 备份 `projects/app1` 到仓库外（含真实配置/凭据），删除应用后按用户要求**已删除该备份及所有 app1 临时截图/检查脚本**；当前无 app1 数据残留。
3. `DELETE /api/apps/app1?confirm=true` → 200；`projects/app1` 已移除。
4. 清理 `data/requirements.db` 的三张 `*_legacy`（M2 迁移遗留的 app1 副本）与旧的 app1 DB 快照/备份。
5. 验证：`apps=0`；modules/bundles/docs/sections/versions/design 各表 0；handoffs/change_sets/sessions/dev_phases/stage_events 0；`app.*` settings 0；模板保留（需求 4 / 原型 2）；`integrity_check=ok`；`legacyTables=[]`。

后续约定：

- M4 起的设计表升级只面向“**无应用数据**”的库：目标结构已存在 → no-op；旧结构 + 0 应用 → 重建空表；旧结构 + 有应用/设计数据 → **fail-closed** 提示删除应用或重置 DB，不写数据迁移。
- 真实 E2E：M4 完成后再用真实模型跑“新建应用 → 多模块需求 → 多模块设计 → 交接包”全链路（临时应用，跑完删除）；通过后由用户重新创建应用跑全程。
- 原 M2 迁移前自动备份（MF1）保留为通用安全网；不再需要为 app1 回滚保留任何 `*_legacy`/`.bak`。

## 未验证 / 已知限制

- 设计阶段边界（2026-11-11 更新）：D1—D4 已接通需求文档 → 实体/页面原型；D5 已接通设计确认 → 确定性交接包（00—05 + schema/template/manifest/prototypes）→ Change Set #1 → 开发阶段。设计确认本身仍不切阶段，必须点击“生成交接包并进入开发”。C1 已完成（变更 #2/reopen/历史面板/`05-CHANGES` diff/取消/范围升级）；旧 structured 应用/后端兼容已于 R4b-1/R4b-2 删除。
- ~~设计页面集主实体匹配可能偏差（P2，2026-11-12 真实模型 E2E 发现）~~ **已修复并评审（2026-11-12）**：确定性默认页面集的 Epic → 主实体按严格字典序（`storyHits` desc → `epicHit` desc → `sceneHit` desc → `textScore` desc → 实体顺序），Story/Epic/Scene 引用优先于文本启发式；无引用时退化为 `textScore`，与旧逻辑完全一致。真实错位的「图书档案管理 → 借阅记录」已纠正为「书目」，并有 32 字符长名称 + 文本分 >1000 的字典序回归测试。**未做迁移**：已生成的错误页面集需重新生成页面集才生效（当前 `apps=0`）；AI 页面集生成路径未改。见「页面集主实体匹配修复完成」与 `docs/plans/2026-11-12-design-scene-entity-matching-fix-brief.md` §6。
- R1 未做 R2：~~AI 修改目前自动应用~~ **R2a 已改为“先预览 → 章节勾选/行级 diff → 应用选中/忽略”**（`docs/STATUS.md`「R2a 完成」）；**R2b 已完成**：自动保存不产版本、关键节点/手动保存生成来源化版本、建议消息裁剪（`docs/STATUS.md`「R2b 完成」）；**R2c 已完成**：设计版本 checkpoint 化、确认设计留档、手动保存版本、来源/变更单标签（`docs/STATUS.md`「R2c 完成」）。
- R1 模板范围：只实现需求阶段模板可用；业务策略虽然 `stage=requirements`，但定位为可选、不直接进设计；设计/测试/开发计划模板在模板中心只读展示（后续阶段不可选）。
- R1 文档解析：全文保存以 `##` 为章节边界，`###` 仅在匹配已有三级章节时单独成节，否则保留在正文；从全文源码新增三级章节需要先在模板/章节表中存在对应 key。
- R1 版本：R2b 起章节自动保存（1s debounce）不再生成版本；版本只在模板切换、AI 应用、确认需求、版本回滚、取消恢复、手动保存时生成；暂不删除/压缩任何版本，保留策略待真实使用观察。
- R1 不做存量兼容：旧应用 `requirements_mode='structured'`/旧 structured UI 已于 R4b-1/R4b-2 删除，旧应用登记与目录也已清理；当前只保留文档模式需求。
- R1 删除应用只清本地登记/目录/需求文档/章节/版本/对话/交接包/会话，不处理远端 MySQL 数据或已部署服务。
- 运行中的旧工作台实例（例如 3300）需要重启后才会加载新后端路由；本机验证使用独立临时实例（3406/4792）和临时 data/projects。
- 首页 opencode 自动探测默认开启（`OPENCODE_AUTO_START=false` 可关闭）；进程内只自动尝试一次，手动停止后再次打开首页不会无限重试，可点“启动 opencode”。
- 模型默认值中的“opencode CLI 最近会话模型”取自 opencode 最近 8 个会话中第一个可用模型；若最近会话来自其他项目/已删除 provider，会继续向后找，仍找不到才回退 opencode 默认模型。
- 协议解析已容忍尾随分隔符/代码块/尾逗号；若模型两次都输出不可解析的 JSON，仍会提示“本轮输出未能解析”，结构化变更不会落库。
- 需求阶段缺少“全局待澄清/未完成工作”视图（I-05，已记录待评估）：场景树暂无待澄清徽标；顶部“确认率”只统计卡片确认，不含待澄清；后端完成校验也不要求待澄清清零。
- 需求对话可能声称“已拆解规格”但未输出结构化 patch（I-06，已记录待评估）：`app1` 四个 Spec 的 entities/pages/roles 均为 0，完成需求后设计页为空；需求阶段还出现了不可执行的“进入开发”action。设计页空白的直接原因已由 I-07（constraints 形状归一化）修复；阶段隔离、设计空状态引导和 actions 校验仍待统一处理。`app1` 目前仅 A-1 已拆解，A-2/A-3/B-1 仍为空。
- `app1` 现场记录为历史（应用已于 R4b-2 删除）：A-2（员工账号关联）当时为 0 设计项；如需复核请新建应用。

- P5 真实应用的需求/设计 Spec 是按现有表结构人工整理并确认的，没有重跑真实模型需求/设计聊天；真实 AI 协作已在 P2 验证。
- MySQL 已可连（5.7.38，EOS_UNIQUE_TABLE=4）；P5 验证时写入的 2 条季度 + 2 条 ATM demo 行仍在（应用目录/登记已随 R4b-2 删除）；清理 SQL 见 `docs/ops/cleanup-demo.sql`，**由用户自行连接数据库执行**（工作台不连库），执行前先跑预览段。
- 本机无 Nacos/Redis；EOS 启动使用 `SPRING_PROFILES_ACTIVE=none`、关闭 Nacos、`EUREKA_CLIENT_ENABLED=false`、关闭服务注册、`EOS_CACHE_MODE=map`。正式环境需 Nacos/Redis 与团队 license；模板 license 为示例。
- 生成应用使用 `com.mysql.cj.jdbc.Driver`（connector 8）；用户提供的旧 `com.mysql.jdbc.Driver` 未采用。
- 应用未接登录/角色权限；401/403 仅由前端状态页展示，实际权限由 EOS 访问控制决定。
- 目标应用目前独立运行（backend 8081 + frontend 5173），尚未在开发页内嵌“启动/预览应用”。
- opencode 原始会话存储可能包含 agent 读取到的配置文件内容；工作台 API/SSE/开发页已脱敏，但不要直接导出/分享 opencode 原始会话数据。
- 交接包仍用 API 预置 Spec 验证；开发会话用真实模型验证了“建会话 → 读交接包 → 回复”，但尚未跑“真实模型聊天产出需求/设计 → 交接包 → 开发 agent 实现完整小应用”的端到端。
- P4 前端时间线用 mock API 验证；P5 已用真实 119 消息/177 工具会话验证开发页渲染。真实权限/表单询问仍未在真实会话触发（P4 UI 用 mock 验证）。
- 开发模型在**创建会话时**确定；会话中通过设置切换模型不会热切换当前 opencode 会话，需要新会话。
- 开发会话已支持左侧列表：查看/切换/重命名/归档/恢复，归档会话只读；同一时间仍只有一个 active 会话（I-10）。I-09a 会话健康度/原生 compact 已完成；I-09b-1（U6）交接包规模识别 + 04-PLAN 建议分阶段已完成（仅建议，不强制）；U7-1 后端阶段模型/阶段会话已完成（2026-11-12，已评审）；U7-2 前端已完成并评审（2026-11-12；见「U7-2 完成」）。
- I-09b-1 未验证：真实长需求生成的真实大交接包（本轮大包为 10 Story / 3 Epic / 12 页面合成数据）；旧交接包 `scale=null` 的前端隐藏仅有单测/代码走查（未注入旧 manifest 跑 Playwright）；<768 移动端未专项验证。
- “文件变化”从工具事件提取，不是文件系统 watcher/Git；shell 直接写文件不会出现在该列表。
- 已在 P5 多次重启工作台后端与 opencode serve，均能按 `app_sessions` 恢复同一会话。
- 未生成 OpenAPI；`schema.sql` 是参考 DDL，未在真实 MySQL 执行；EOS 运行态（Nacos/MySQL/Redis/license/在线 Nexus）仍未验证。
- 开放问题/未确认项按设计不阻塞生成，只单列；交接包质量取决于需求/设计数据质量。
- 生成时间写入文档，因此即使 Spec 未变，重新生成 hash 也可能变化（版本必然递增）。
- DDL 类型映射较粗（`number → DECIMAL(18,4)`、`boolean → TINYINT(1)` 等），真实表结构需开发时调整。
- 跨需求点引用按 `moduleId:entityId` 解析；其他引用约定会被校验拒绝。
- 交接包下载为单文件下载，未打包 zip。
- 需求/设计真实产出质量：简单聊天可能只返回文本、没有 `<<<SPEC_JSON>>>` envelope，前端会按既有逻辑重试并提示“本轮输出未能解析”；需在真实需求场景持续观察。
- 测试用例生成入口（TestView）当前隐藏，未单独跑 UI；`testgen` 与聊天共用 `streamChat`，传输层已切换。
- opencode 默认免费模型可能命中额度限制（本次 429）；开发会话测试使用 `packycode-deepseek/deepseek-flash`。
- `@vueuse/core@15` 的 Node >=22 引擎要求。
- `better-sqlite3` 新环境需装 VS Build Tools 或按上述 workaround 安装。
- 旧 `legacy/` 代码不参与构建；已于 R4a 删除。
- requirements-grooming 的批量/批次 UI 已于 R4b-1 随 `frontend/src/requirements-grooming/` 删除，应用工作区不再有批次概念。

## R1 遗留修复排期（2026-11-10）

决策：R1 遗留问题**不阻塞当前设计阶段与 D5 讨论**，统一放进 R2 批次；但首次“需求 → 设计 → 开发”端到端演示前，至少修 P1。

- **P1（端到端前，R2a 已修）**
  - 确认后的需求文档无法重新编辑/回滚：已由 H4 `reopen` 解决，R2a 回归覆盖。
  - requirements-doc 路由未校验 `requirements_mode='doc'`：R2a 已加 router 级守卫 + chat doc 守卫。
  - 删除“使用中”的需求模板未阻止：R2a 已禁止（400）。
- **P2（R2b，2026-11-11 已收口）**
  - DocChatPanel 构建活动把 `review` 显示成“文档已确认”（当前无 review 流程，低优先级；未改，仍记观察）。
  - ~~章节自动保存版本增长快；版本合并/清理策略留 R2b。~~ R2b 已改为自动保存不产版本 + 手动/关键节点 checkpoint；不删除版本。
  - 旧 `DesignPending.vue` 已不再挂载（设计阶段改为 DesignStudio）；其“只读链接”问题失效，**R4a 已删除文件**。
- **已随设计阶段修复/覆盖**
  - 设计阶段已替代 DesignPending；R1 的“设计页空白/R3 未接入”提示不再走旧页面。
  - 需求文档确认后进入设计，设计阶段能读取文档生成实体/页面原型（D1—D4）。

## 后续（P5 之外）

> **D5/C1/R2a/R2b/I-10/I-09a/R2c/R4a/R4b-1/R4b-2/R4c 已完成提醒（2026-11-11）**：设计 → 开发交接、Change Set #1、开发会话 handoff 版本、C1 完整变更循环、R2a（需求 AI 建议预览/应用/忽略、模板复制编辑、P1 守卫）、R2b（需求文档版本 checkpoint/手动保存版本/建议消息裁剪/R2a UX 修复）、I-10（开发会话列表/切换/重命名/归档/恢复、归档只读、按变更单分组）、I-09a（上下文健康度 chip/提示条 + 原生 compact + 时间线压缩提示）、R2c（设计版本 checkpoint/确认设计留档/手动保存版本/来源与变更单标签 + compact toast 文案）、R4a（`legacy/`/`DesignPending.vue`/`designErrorHandler`/零引用死导出清理 + `props.mode` 修正）、R4b-1（前端 shared 抽取 + 旧 structured UI/旧 handoff 弹窗删除）、R4b-2（后端 structured 兼容/旧表/旧应用登记与目录删除）、R4c（MySQL 清理 SQL + 依赖清理 + 文档收尾）已接通；下一步①视觉/响应式/深浅色打磨（单独一轮）②I-09b（分阶段，后续评估）。详见 `docs/plans/2026-11-11-iterative-change-design.md`、`docs/plans/2026-11-11-i10-implementation-brief.md`、`docs/plans/2026-11-11-i09a-implementation-brief.md`、`docs/plans/2026-11-11-r2c-implementation-brief.md`、`docs/plans/2026-11-11-r4a-implementation-brief.md`、`docs/plans/2026-11-11-r4b1-implementation-brief.md`、`docs/plans/2026-11-11-r4b2-implementation-brief.md`、`docs/plans/2026-11-11-r4c-implementation-brief.md`、`docs/STATUS.md`「C1 评审」「R2a 完成」「R2b 完成」「I-10 完成」「I-09a 完成」「R2c 完成」「R4a 完成」「R4b-1 完成」「R4b-2 完成」「R4c 完成」。

1. 如需完整验证 P5-1 的“真实模型需求/设计”，用新应用再跑一次需求/设计聊天并重新生成交接包（旧 `quarterly-reporting` 目录已随 R4b-2 删除）。
2. 视环境补齐 Nacos/Redis/团队 license；当前本地使用 profiles off + map cache + Eureka off。
3. 接入真实登录/角色权限，验证 401/403 页面与 EOS 访问控制。
4. 视觉/响应式/深浅色打磨；记录真实模型耗时/工具数。
5. MySQL demo 数据已定 **A（只生成 SQL，用户自行执行）**：`docs/ops/cleanup-demo.sql`（`quarterly_reporting_date` 2 行 + `quarterly_reporting_business_atm` 2 行）；工作台不连接数据库、未执行；旧 structured 面板（R4b-1）、后端 structured 兼容与旧应用登记/目录（R4b-2）、依赖清理与文档收尾（R4c）均已清理。
6. I-05：需求阶段全局待澄清/完成度视图（场景徽标、待办清单、完成条件提示）；先做只读标识，待澄清是否阻塞完成待定。
7. I-06：需求/设计阶段隔离与设计空状态引导（需求阶段禁止拆解 patch、design 阶段“开始拆解当前批次”、actions 按阶段校验、正文声称成功但无 patch 时提示）。
8. I-08：需求/设计阶段体验整体优化（阶段目标、需求/设计待办、交接包 readiness、去掉批次残留）；方案见 `docs/plans/2026-11-09-stage-ux-and-dev-session-design.md`，待讨论后实施。
9. I-09：开发长会话策略。**I-09a 已完成（2026-11-11）**：按模型上下文百分比的健康度（60% 黄/85% 红）+ opencode 原生 compact + 时间线压缩提示（见 `docs/STATUS.md`「I-09a 完成」）；**I-09b-1（U6）已完成并评审（2026-11-12）**：交接包规模识别（Story ≥10 / 页面 ≥12 / 文本 ≥100KB）+ `04-PLAN` 建议分阶段 + README/弹窗/开发页提示（交接单 `docs/plans/2026-11-12-i09b1-implementation-brief.md`）；**I-09b-2（U7）U7-1 后端已完成并评审（2026-11-12）**：Epic 派生阶段 + `app_dev_phases` + 一阶段一会话 + phase brief + 模型摘要/fallback + `manifest.phases` + 阶段 API；**U7-2 前端已完成并评审（2026-11-12）**：入口/阶段条/弹窗/完成-跳过-重新打开/会话 chip/只读；**U7-3 真实模型全链路已验证（2026-11-12）**：真实 model 摘要 + fallback + P2 + 6 阶段（交接单 `docs/plans/2026-11-12-u7-3-real-model-e2e-brief.md`）。
10. I-10：开发会话列表（Codex 风格左侧栏，查看/切换/重命名/归档/恢复全部会话）；**2026-11-11 已完成**，见 `docs/STATUS.md`「I-10 完成」；I-09a 在其基础上加健康度/compact。
11. I-11 / R1：需求阶段“对话 + 模板化 Markdown 文档”**已完成 R1**（模板表/文档章节表/版本表、内置模板 seed、模板 API、文档 API、chat doc 模式、模板中心、章节编辑器、构建活动/下一步、章节问 AI、确认需求、删除应用）。**设计阶段读取已确认需求文档已完成（D1—D4，2026-11-10）**；**R2a 已完成（2026-11-11）：AI 修改先预览/章节勾选/应用/忽略、模板复制编辑、doc 路由与模板删除守卫**；**R2b 已完成（2026-11-11）：自动保存不产版本、确认/手动/回滚/恢复/模板切换来源化 checkpoint、建议消息裁剪、stale 可忽略**；**R2c 已完成（2026-11-11）：设计版本 checkpoint 化、确认设计必产 `confirm` 版本、手动保存版本、来源/变更单标签**；R3 剩余：设计单元/待办、交接包 `01-REQUIREMENTS` 改用文档；R4a 已完成（2026-11-11）：`legacy/`、`DesignPending.vue`、`designErrorHandler`、零引用死导出删除，`props.mode` 修正；R4b-1 已完成（2026-11-11）：前端 shared 抽取 + 旧 structured UI/旧 handoff 弹窗删除（前端只剩 doc/design/dev/change-set/settings/shared）；R4b-2 已完成（2026-11-11）：后端 structured 兼容、旧表、旧 agents/spec 对话、`requirements_mode` 与旧应用登记/目录删除；R4c 已完成（2026-11-11）：MySQL 清理 SQL（`docs/ops/cleanup-demo.sql`，用户自行执行）+ 依赖清理 + 文档收尾。方案见 `docs/plans/2026-11-10-requirements-stage-doc-design.md`、`docs/plans/2026-11-10-design-stage-entity-prototype.md`。
12. I-12：设计阶段简化为“实体设计 + 页面原型”；**D1—D4 已实施（2026-11-10）**：原型模板全局库/应用选模板、实体/字段/关系/ER/确认、页面集/页面规格/Wireframe/模板切换/PNG 截图/版本、`<<<DESIGN_JSON>>>` 设计对话、Design Studio 外壳。**D5 待讨论**：设计完成 readiness/交接包（PNG + HTML + 页面规格 + DDL）与开发衔接。方案见 `docs/plans/2026-11-10-design-stage-entity-prototype.md`，实施交接单见 `docs/plans/2026-11-10-design-stage-implementation-brief.md`。
13. I-13：需求 → 设计交接（DesignInputBundle、结构化 Epic/Story/Scene 稳定 ID、实体/页面 requirementRefs、需求变更 diff/覆盖度）；**H1—H4 已实施（2026-11-11）**，评审发现 stale confirmed 设计需在 D5 前修。方案见 `docs/plans/2026-11-10-requirements-to-design-handoff.md`，实施交接单见 `docs/plans/2026-11-10-requirements-to-design-handoff-implementation-brief.md`。
14. I-14：设计 → 开发交接（D5；实体/页面原型/模板/需求/计划 → `docs/handoff/`；确定性渲染、PNG 视觉参考、页面规格契约、DDL/模板/manifest）。**D5 已实施（2026-11-11）**：交接包含 `00/01/02/03/04/05 + schema + template + manifest + prototypes/`；PNG 缺图阻塞；HTML 可选；模板 Token 强约束；不生成 OpenAPI/真实外键；一个主按钮生成并进入开发；首次 Change Set #1；开发会话记录 handoff 版本/hash。**C1 待实施**：Change Set #2、reopen、历史面板、`05-CHANGES` diff、删除代码。方案见 `docs/plans/2026-11-11-design-to-development-handoff.md` §9，实施交接单见 `docs/plans/2026-11-11-d5-implementation-brief.md`。
15. I-15：迭代/变更场景（Change Set + 版本化文档/设计/交接包/会话；需求/设计变更 → 新 handoff 全量+`05-CHANGES.md` → 新开发会话在现有代码上增量实现）。**方案已定稿**：范围仅需求+设计/仅设计，纯开发修复不进 Change Set；需求变更必须重走设计；复用 stage+变更中标签；默认每变更新会话；全量+delta；删除代码由开发 agent 执行（工作台不自动删，DB 迁移需确认）；取消仅在新交接包前；首次创建 Change Set #1（显示“初始开发”）；历史展示=应用头部变更历史面板+各阶段版本标签。方案见 `docs/plans/2026-11-11-iterative-change-design.md`，待实施。

## 数据库决策（2026-11-09）

- 工作台自身继续使用 **SQLite 文件库**（`data/requirements.db`）：应用、需求/设计 Spec、聊天、阶段、交接包、P4 会话都存这里，不引入 MySQL。
- 需求/设计阶段不连接、不启动 MySQL；应用创建表单里的 DB 信息只渲染到 `projects/<app>/backend/`，不写入工作台数据库。
- 生成的目标 EOS 应用是否改用 H2 开发配置，留到 P5 真实应用时验证；P4 不修改 `templates/eos-app` 数据源。
- H2 是 JVM 数据库，不能直接替换 Node 工作台的 SQLite；如后续要把工作台迁到 Java，再评估 H2/MySQL。

## 约束

- 不提交真实凭据；`projects/`、`data/`、`.env` 已忽略。
- 应用创建时提供的 DB/邮件/sys-key 只写入 `projects/<id>/`，不写入工作台数据库。
- 不继续扩展 `legacy/` 旧 dev 代码（`legacy/` 已于 R4a 删除）。
- 不以未验证的 EOS 运行态/真实模型结果宣称完成。
- 旧项目 `primeton-agent-capabilities` 已冻结、只读参考；新成果落本目录。

## 接续话术（新会话：测试问题与优化）

> 在 `E:\work_space_primeton\ai-dev-workbench` 继续。先读 `AGENTS.md`、`docs/STATUS.md`、`docs/plans/2026-11-09-workbench-v2-design.md`、`docs/plans/2026-11-09-implementation-tasks.md`。当前会话专门处理我按 P5 流程测试时遇到的问题和优化；不要重做已完成阶段，不要一次铺开所有遗留项。
>
> 方向已确认：需求/设计 A（短暂 opencode 会话 + 专用 req/design agent + prompt + SSE），开发 B（原生 build agent + 原生会话/权限/表单/取消）；不要重复讨论 A/B。
>
> **当前基线**：P0—P5、R1、D1—D4、H1—H4、D5、C1、R2a/R2b/R2c、I-10、I-09a、I-09b-1（U6）、R4a、R4b-1、R4b-2、R4c、P1/P2、U7-1/2/3、需求/原型修复（#1.1/#1.2/#2/#4/#5）、ER 图专业化（#3）、开发/需求 UX 小改批（#1/#2/#4/#5，2026-11-13，含 must-fix）、创建应用选模板 + 模板解析（#7，2026-11-13）已完成并评审；当前全量：后端 157 测试、前端 96 测试、typecheck/build/check:vue、8 支冒烟（含真实 opencode/真实模型）。需求固定文档模式（模板/章节/版本），设计为 Studio（实体/页面原型/需求覆盖/设计输入同步），设计确认后确定性生成交接包并创建 Change Set；开发使用 opencode 原生 build 会话。**R4b-2（2026-11-11）已删除后端 structured 兼容（旧 P3 交接包、workspace/modules、agents、spec 对话、`requirements_mode`）与旧表 `modules`/`module_docs`/`handoffs`；当前真实 DB 有用户应用 `app1`（开发中，`projects/app1`，勿删/勿改）**。**R4c（2026-11-11）已生成 MySQL demo 清理 SQL（`docs/ops/cleanup-demo.sql`，由用户自行执行）+ 移除未用依赖（`@element-plus/icons-vue`、`ai-dev-workbench: file:..`）+ 文档收尾**。真实应用 P5 交付记录保留为历史（目录已删除；MySQL 2+2 条 demo 行待用户按 SQL 清理）。工作台自身用 SQLite，生成应用用 MySQL；凭据只在 `projects/`，不要读取/打印/提交真实密码。
>
> 已知遗留/未验证：U7（U6/U7-1/U7-2/U7-3）已完成并评审/验证（2026-11-12）、R3 剩余（设计单元/待办，需重新评估是否仍需要）、真实模型需求/设计聊天已在 U7-3 新应用重跑、Nacos/Redis/团队 license、真实 401/403 权限、真实开发会话中的权限/表单回复、真实 write/edit/shell 极端路径、MySQL demo 行待用户执行 SQL。遇到再处理，不要主动全做。
>
> 工作方式：
> 1. 我先给测试问题、控制台/网络日志、命令、截图或复现步骤；你先判断属于工作台、目标应用、MySQL/Nacos/Redis/license、opencode/model 还是环境问题。
> 2. 能复现就先写最小复现/测试，再改；修复后跑相关 `npm test --prefix backend`、`npm run build`、应用 `mvn test/package`、前端 `npm run build` 或 Playwright。
> 3. 不扩大范围，不顺手重构，不改设计方向；行为变更先说明。
> 4. 修复后更新 `docs/STATUS.md`：问题、根因、改动、验证命令/结果、未验证项。
> 5. 不提交真实凭据；不要输出 DB 密码；`projects/`、`data/`、`.env` 不提交；不扩展 `legacy/`。
> 6. 真实模型用 `packycode-deepseek/deepseek-flash`（默认免费模型可能 429）；MySQL 以实际 JDBC/API 结果为准，`Test-NetConnection` 曾误报。
> 7. 启动：工作台 `npm start`（3300）或 `npm run dev`（5180）；应用后端/前端命令与本地无 Nacos/Redis 的环境变量见 `templates/eos-app/README.md`（旧 `projects/quarterly-reporting/` 已随 R4b-2 删除）。当前测试服务已停止。
>
> 请先回复：已读 STATUS，并确认当前基线与启动方式；然后等我给第一个测试问题/日志，不要先改代码。

## M4 完成（2026-11-13，实施会话 + 主会话评审）：设计表/设计 UI 模块化

范围：`docs/plans/2026-11-13-module-m4-implementation-brief.md` §2—§6（只做 M4；**无旧数据迁移**）。详细实施/偏差见该交接单 **§10 实施结果**。本次未启动 3300、未触碰真实 `data/`/`projects/`、未读 `.env`、未调真实模型。

### 做了什么

- **设计六表按模块**：`app_design_projects` PK `(app_id, module_id)`；entities/page_sets/pages/versions/inputs 加 `module_id`；唯一 `(app,module,version)`、`(app,module,doc_hash)`；新索引 `idx_design_*_app_module`。目标 DDL 直接进 `db.ts`。
- **启动升级（fail-closed）**：新增 `design/module-migration.ts`。目标结构 no-op；旧结构 + 0 应用/0 设计数据 → 单事务重建空表；旧结构 + 有应用/设计数据 → 抛错阻止启动；不建 `*_legacy`、不写回填。
- **设计服务/路由按模块**：全部设计接口尾部可选 `moduleId`（query 优先、body 其次），缺省默认模块、未知 404、归档读允许/写 409。项目/实体/页面集/页面/版本/确认/reopen/设计输入/覆盖度/chat 严格按模块隔离；版本号、confirm 版本、回滚、输入 stale、`(app,module,docHash)` 唯一均按模块；`deleteDesignData` 仍按 app 清理。
- **跨模块**：实体关系与页面 `entityId` 允许引用全应用任一模事实体（只 warning 不阻塞）；表名跨模块重复只 warning；页面集/页面写入必须属于当前模块（跨模块 ID → 404）。页面 `module_id` 与页面集一致。
- **需求 reopen**：只把**同模块**设计项目退回 draft，其它模块设计确认/版本不动。
- **应用级模板切换**：`POST /design/template/preview`（只读逐模块 + blocked + canApply）；`PUT /design/template {scope:'app'}` 单事务切全部未归档模块（各自 version+1 + `template-change` 快照 + 退回 draft），任一未归档模块已确认 → 409 + issues 且不写任何模块；归档不参与；同步应用默认模板。`scope` 缺省/`module` = 旧单模块行为。尚无设计项目的模块不预建项目（懒创建时用新应用默认模板）。
- **模块级确认门禁**：`POST /design/confirm` 只校验/确认当前模块，返回 `appConfirmed`（全部必选未归档模块设计 confirmed）与 `pendingModuleIds`；`apps.design_confirmed_at` 仍由应用级交接包生成写入（单模块旧行为）。
- **多模块下游门禁**：未归档模块 > 1 时 `POST /design/handoff/preview|generate` → 409「多模块交接包在 M6 接入…」；`POST /change-sets` → 409「多模块变更在 M5 接入」；单模块旧路径不回归（5 支冒烟通过）。
- **appPayload**：`designProject` 仍为默认模块摘要（旧字段不变）；新增只读 `designModules`（各模块 status/version/实体/页面集/页面/缺图/confirmedAt）与 `designModulesConfirmed`；不建项目/版本。
- **chat**：settings key `app.<appId>.designChat.<moduleId>`；旧应用级 key 只读回退（默认模块、返回 `legacyFallback`），不删/不改；未知 404、归档读允许/写 409；设计流式对话按模块 prompt。
- **设计 UI**：新增模块 rail（复用 `/requirements-modules` + `appPayload.designModules`，不提供增删/归档）、设计总览弹窗（2/2、pending、缺图、M6 提示）、原型模板应用级切换弹窗（逐模块 preview/二次确认/blocked）；DesignStudio 切模块前 flush（chat/实体/页面集/页面，失败中止）、切模块重置 focus/弹窗、按模块确认/重新编辑、多模块禁用交接包并提示 M6、development/completed 只读横幅与禁用；实体关系目标列出其它模块实体（分组/跨模块提示）；版本/输入同步/原型/截图/图片 URL/聊天全部带 `moduleId`。响应式 1024/768 模块 rail 与对话抽屉互斥，沿用 V1—V3 token（未新增裸色值）。

### 主会话独立复核（2026-11-13）

- 独立复跑：后端 **204/204**、前端 **114/114**、5 支冒烟、`typecheck/build/check:vue` 全过。
- 独立 Playwright（临时 data/projects，端口 3428，`OPENCODE_AUTO_START=false`）：**25 项断言全过**，覆盖：两模块设计隔离（A 订单 / B 客户）、模块级版本、`appPayload.designModules` 2/2 confirmed、多模块 `handoff/preview|generate` 409、模板 preview 在已确认时 `canApply=false/blocked=2`、UI 设计总览“全部已确认”、交接包按钮 M6 门禁、UI 重新编辑 B 后 A 仍 confirmed、UI 模板切换被阻止、解除确认后应用级模板切换两模块 `version+1`/`template-change`/draft、1024 rail 抽屉与无横向溢出、0 console/0 意外 API≥400。
- **真实库升级路径实测**：复制真实 DB（旧设计表、apps=0）→ M4 启动 → 设计六表变目标结构、`PRIMARY KEY (app_id,module_id)`、索引齐全、templates 4/2、无 `*_legacy`、`integrity_check=ok`。
- **fail-closed 实测**：构造“旧设计表 + 1 个应用”的临时库启动 → 退出码 1，报“按当前政策不做数据迁移，请先删除应用或重置 data/requirements.db”，旧表未被修改。
- **真实 3300 重启升级**：`stop.cmd → start.cmd`（新 PID 29860）→ 设计表已升级为目标结构、apps=0、templates 4/2、无 legacy、`integrity_check=ok`、`foreign_key_check=0`、opencode ready、错误日志 0。
- 结论：M4 通过；真实库为“空库 + M4 结构”，等待用户新建应用；M5/M6 未开始。

### 升级影响（真实库）

真实库当前 `apps=0`。3300 已重启并完成“空库重建”分支（无数据迁移）；若未来旧库仍有应用/设计数据，启动会直接 fail-closed 提示删除应用或重置 DB。

### 验证（实际执行）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **204/204 通过**（基线 187 + `design/module-migration.test.ts` 5 + `design/module-design.test.ts` 12） |
| `npm run smoke:requirements` / `smoke:modules` / `smoke:change-set` / `smoke:design-handoff` / `smoke:design` | 全部通过 |
| `npm test --prefix frontend` | **114/114 通过**（基线 107 + `design/design-module-helpers.test.mjs` 7） |
| `npm run typecheck` / `build` / `check:vue`（frontend） | 全部通过 |

- **Playwright（临时 data/projects，端口 3425，`OPENCODE_AUTO_START=false`）**：**46 项断言全过、12 张截图、0 console error / 0 pageerror / 0 非预期 API≥400**。覆盖：两模块设计确认 A（只读）→ 切 B（0 页面集）→ 确认 B → 总览 2/2 → 交接包禁用 + M6 提示；A/B 版本弹窗与 API 数量一致；B 跨模块关系指向 A（提示可见、保存成功、A 不改写）；模板 preview 在 A confirmed 时 blocked，解除后应用级切换两模块 template-change/版本 +1/应用默认模板同步；需求 reopen A 仅 A draft、B confirmed，确认+同步+重确认后回设计；单模块 development 只读且交接包弹窗可开；1024 rail 抽屉+遮罩+对话互斥；768 抽屉；深色无白底；旧 API 不传 moduleId 仍为默认模块。截图与 `summary.json`：`C:\Users\icecream\AppData\Local\Temp\m4-e2e-v0B909\`（临时）。

### 偏差 / 未验证

- `GET /api/apps/:id/design/templates?moduleId=` 与 #7 的 `GET /api/apps/:id/templates` 使用同一解析（均支持可选 moduleId）；只读解析对未知 moduleId 回退应用默认（不 404）。
- 应用级模板切换对“尚无设计项目”的模块不预建项目；预览显示 version 0 / `fromTemplateId=null`。
- `GET /design/coverage` 仍只返回模块内覆盖度；应用级汇总通过 `appPayload.designModules`/设计总览提供。
- 设计 rail 只列未归档模块（归档设计仍可按 moduleId 读取，但设计页无入口）。
- 未验证：<768 移动端、真实长对话滚动/对比度、多人并发；真实模型 E2E（由主会话在 M5/M6 后统一跑全链路）。

## M5 完成（2026-11-16，实施会话 + 主会话评审）：设计输入 v2 + 需求 bundle + 覆盖度 + Change Set 模块选择

范围：`docs/plans/2026-11-16-module-m5-implementation-brief.md` §2—§6（只做 M5；**不做旧数据迁移**，不建 legacy/不回填；不启停 3300、不触碰真实 `data/`/`projects/`、不读 `.env`、不调真实模型）。详细实施/偏差见该交接单 **§10 实施结果**。

### 做了什么

- **新表 `app_change_set_modules`**（`CREATE TABLE IF NOT EXISTS`，无迁移）：每行记录选中模块的需求/设计基线/当前版本 + hash + 基线原型模板；`apps` 删除时按变更单子查询清理。
- **Change Set 模块选择**：`POST /change-sets` 新增 `moduleIds`（缺省=全部未归档模块；显式数组必须非空/无重复/全部未归档，否则 400）；移除 M4“多模块 409”；单事务写变更单 + 模块行（base=当前已确认版本/hash/template，current=base），只把**选中模块**需求/设计置 draft，未选模块文档/设计/版本/确认/设计输入/会话逐行不动；事件带 `moduleIds/moduleKeys`。
- **编辑门禁**：active 变更单存在时只有选中模块可写（需求写路径、设计写路径、模块级模板/同步/版本/确认），未选模块 409「本次变更未包含模块…」；应用级需求/原型模板整体切换在范围不完整时 409；模块新增在需求阶段自动加入本次范围（base=null、current=v1）；变更中禁止归档；非需求阶段 update/order/archive/restore 409。
- **取消按模块**：`cancelabilityOf` 改为按模块行判断（任一选中模块需求/设计 confirmed 且版本≠该模块基线；旧单无行回退老逻辑）；逐个选中模块恢复需求/设计/原型模板/设计输入（未选不动），恢复 app/会话，并在**同一事务**内重新生成需求 bundle（失败整单回滚）；返回 `restored.modules` 与 `bundleVersion`。
- **scope 升级**：只对选中模块重开需求+设计并写模块 current，其它模块不动。
- **历史视图**：`ChangeSetView.modules` 返回各模块 moduleKey/title、需求/设计 base→current 版本与 hash、基线模板 id；单模块旧字段保留。
- **设计输入 v2**：`DesignInputBundle` 增加 `bundleVersion/bundleHash`（构建时取最新需求 bundle）；同 `(app,module,docHash)` 复用输入行并 UPDATE bundle 字段/change_set_id；`stale` 仍只比**同模块** `docHash`，新增 `bundleDrift`（仅提示，不阻塞、不让其它模块过期）；`GET /design/input` 返回最新 bundle + bundleDrift。
- **设计总览**：新增只读 `GET /api/apps/:id/design/overview`（逐模块覆盖率/未覆盖 Story/缺图/状态/版本 + 应用汇总 + bundle）；不建项目/版本/输入；`/design/coverage` 保持模块内旧字段。
- **前端**：发起变更弹窗模块多选（默认全选/至少 1 个/显示需求/设计版本与状态）；需求页/设计页范围条 + 未选模块整页只读 + rail“本次变更/未包含”标记；变更中归档禁用；应用级模板切换在范围不全时禁用（设计改为当前模块级切换）；设计总览改用新接口（覆盖率/未覆盖/缺图/汇总/bundle）；历史弹窗显示模块数与各模块版本区间，取消确认文案列出恢复模块；chip 多模块补“N 模块”。
- **测试**：新增 `changesets/module-scope.test.ts` 10 项（模块范围/取消/输入 v2/overview/清理）与前端 `changesets/module-scope.test.mjs` 4 项、coverage 标签 1 项；M4 旧“多模块变更 409”用例改为 M5 语义。

### 验证（实际执行）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **215/215 通过**（基线 204 + `changesets/module-scope.test.ts` 11） |
| `npm run smoke:requirements` / `smoke:modules` / `smoke:change-set` / `smoke:design-handoff` / `smoke:design` | 全部通过（`smoke:modules` 按 M5 阶段门禁调整归档/更新前置状态，不改断言目标） |
| `npm test --prefix frontend` | **120/120 通过**（基线 114 + module-scope 5 + coverage 标签 1） |
| `npm run typecheck` / `build` / `check:vue`（frontend） | 全部通过 |

- **Playwright（临时 `RG_DATA_DIR/RG_PROJECTS_DIR`，端口 3429，`OPENCODE_AUTO_START=false`，生产构建 + DB fixture：2 可用模块 + 1 归档 + fake handoff v1 + #1）**：**17 张截图**（浅/深、1440/1024/768，含发起变更全选/取消勾选、需求范围条、未选模块只读、设计范围/总览/只读、历史模块行、取消确认/取消后、回 development）。**0 pageerror**；控制台/网络仅 2 次 `409 GET /api/apps/m5pw/development`（发起变更后 DevView 在途轮询在阶段切换瞬间返回，非 M5 接口/操作；M4 起既有）。断言含：默认全选 2、提交后范围条仅 1 模块、未选需求只读、选中确认→完成需求→设计范围、总览 2 行与汇总、未选设计只读、同步+确认、历史 `需求 v2→v3 · 设计 v3→v5`、取消确认列出恢复模块、取消后 app development / 无 active / bundle 版本递增且 hash 变化 / overview 2 模块 2 confirmed。截图与 `result.json`：`C:\Users\icecream\AppData\Local\Temp\opencode\m5pw\shots\`（临时）。

### 偏差 / 未验证

- `appPayload.designModules` **未**新增 `coverageRate`；覆盖率统一由 `GET /design/overview` 提供（交接单允许二选一，固定一种）。
- 设计状态 hash 取稳定字段（去掉 `createdAt/updatedAt`）后 `sha256(JSON.stringify({entities,pageSets}))`，实体/页面集/页面按 position 排序（已注释并测试）；与需求 `docHash=sha256(content_md)` 语义一致。
- 变更中新增模块（base=null）取消时**自动归档**（内容/版本/设计数据保留），`restored.modules` 标 `archived:true`；归档后无未归档模块 → 409 整体回滚（MF-M5-1，已修）。
- 变更范围只含部分模块时，原型模板只允许模块级切换；应用级切换前后端均 409/提示。
- 多模块交接包仍 409（M6）；Playwright“已开发”状态为临时 DB fixture（fake handoff 行 + apps.status），生产门禁未改。
- 未验证：真实模型全链路（M6 后主会话执行）；多模块 + 交接包 + 分阶段组合；<768 移动端。

### must-fix MF-M5-1（2026-11-16 已修）

主会话评审发现：取消变更时“变更中新增模块”（base=null）原实现 409 卡死（变更中又禁止归档），流程无法退出。修复：

- 取消时无基线模块（`req_base_version` 或 `design_base_version` 为 null）**自动归档**（`archived_at=now`，文档/章节/版本/设计数据全部保留），不恢复版本；`restored.modules` 增加 `archived:true`；归档后无未归档模块 → 409 整体回滚；有基线模块逻辑不变，bundle 仍在本事务重新生成且自动排除归档模块。
- 前端历史模块行显示“变更中新增”；取消文案补“变更中新增的模块将被归档（内容保留，可之后恢复）”；取消成功提示归档数量；若当前选中（需求/设计 localStorage）模块被归档，复用既有 helper 回退默认模块并提示。
- 测试：后端新增 M5-11（新增模块归档/内容保留/bundle 排除），前端新增变更中新增模块版本区间/取消文案用例。
- 验证：后端 **215/215**、前端 **120/120**、`smoke:change-set`/`smoke:requirements`/`smoke:modules` 通过；Playwright 5 张截图（临时 3429），覆盖历史“变更中新增”、取消归档提示、取消后 C archived/内容保留/bundle 仅 A/B/app development、localStorage 选中 C 时回退默认模块；0 pageerror、0 意外 API≥400（仅既有 1 次 `409 GET /development` 阶段切换竞态）。证据：`C:\Users\icecream\AppData\Local\Temp\opencode\m5pw\shots-mf1\`。

### 主会话独立复核（2026-11-16）

- 独立复跑：后端 **215/215**、前端 **120/120**、5 支冒烟、`typecheck/build/check:vue` 全过。
- 独立 Playwright/API（临时 data/projects，端口 3430，fixture 到 development）：**28 项断言**——UI 发起变更取消勾选 B（模块行 1 个）、基线 req/design hash 记录、A 需求/设计 draft 且 B confirmed、B 文档/设计/版本/设计输入逐行不变、未选模块需求/设计写 409、选中可写、部分范围应用级模板 409、需求范围条/未选只读、选中确认→bundle confirm、设计范围/未选只读、总览覆盖率+需求聚合、历史模块行、1024 无溢出、overview 连续调用不建项目/版本/输入、取消后 A 恢复 confirmed/B 完全不动/bundle v2→v3、输入 v2 bundle 字段匹配、未选模块 `stale=false` 仅 `bundleDrift=true`。
- 另独立复验 MF-M5-1（**11 项断言**）：变更中新增 C 自动入范围（base=null）→ 确认 C/A → 取消 200；C 自动归档且 docs/sections/versions 保留；B 逐行不变；bundle 仅 A/B；app 回 development。
- **已知观察（非 M5 阻塞）**：发起变更后 DevView 在途轮询会返回 1—2 次 `409 GET /development`，浏览器控制台记为资源错误（M4 起既有阶段切换竞态，非 M5 接口）；M6 后可顺手加卸载/Abort 或软返回。
- 结论：M5 通过；多模块交接包仍待 M6。

## M6a 完成（2026-11-16，实施会话 + 主会话评审通过）：应用级交接包模块化

范围：`docs/plans/2026-11-16-module-m6-implementation-brief.md` §M6a（只做 M6a，**不做 M6b**）。无表结构变化、无迁移/legacy/回填；未启停 3300、未触碰真实 `data/`/`projects/`、未读 `.env`、未调真实模型。详细实施/偏差见该交接单 **§M6a 实施结果**。

### 做了什么

- **交接包内部按模块**：`DesignHandoffBundle.modules[]`（模块需求+设计输入+实体/页面集+覆盖度+警告+变更状态/diff）；保留旧聚合字段（第一个模块 + 全部拼接 + 汇总覆盖度）供读/摘要/旧前端路径。
- **全局稳定编号**：ENT/PS/PAGE 按模块顺序连续编号、表名 fallback 用全局序号；跨模块实体关系/页面绑定解析为全局编号，只 warning。
- **渲染按模块**：`00-README` 模块索引 + 跨模块依赖；`01` 每模块完整 PRD；`02` 每模块实体/DDL + 跨模块引用；`03` 每模块页面集/页面；`04` 每模块目标/Epic/页面集清单；`05` 选中模块 diff、未选“未变更”、基线无模块“新增模块”；`schema.sql` 汇总全部模块；`prototype-template.json` 应用级 + 模块模板映射。
- **原型路径**：`prototypes/<MOD-KEY>/<ps-XXX>/page-XXX.png`（+ `.html`）；读写路径继续 `appDirSafeJoin` 防穿越。
- **manifest**：`app/version/requirementsBundle/designModules/modules/totals/scale/changeSet/phases/files`；`scale` 按全部模块汇总；`phases` M6a 仍为现有全局草案（M6b 两层）。
- **门禁按模块**：全部必选未归档模块需求/设计 confirmed、设计输入绑定且非 stale、readiness/引用/每页 PNG 齐全；失败 400 + issues `[MOD-xxx 标题]` 前缀；跨模块 FK/表名重复/模板不一致只 warning。
- **Change Set / 基线**：`source_design_json/source_requirements_json` 保存模块快照（同时保留单模块兼容字段）；#2+ 按 `app_change_set_modules` 选中模块 diff，未选模块“未变更”，新模块“新增”；旧包 `{entities,pageSets}` 视为默认模块。
- **API/读/摘要**：preview/generate 移除多模块 409，返回 `modules/requirementsBundle`；read/summary/manifest 带 modules；生成记录模块需求/设计版本最大值（旧字段兼容），应用进入 development / Change Set #1 逻辑不变。
- **前端**：交接包弹窗新增模块表（key/标题/需求 v/设计 v/实体/页面集/页面/缺图/状态/变更状态）、聚合规模、未就绪原因、stale 提示；`enter` 模式全部必选模块就绪才可生成；设计页移除 M6 禁用/提示并传入模块状态；无新依赖/主题 token。

### 验证（实际执行）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **222/222 通过**（基线 215 + 新 `handoff/design-handoff-modules.test.ts` 7；M4 两项多模块 409 用例改为 M6a 语义；含 MF-M6a-1 与 #2 需求变更 sync regenerate） |
| `npm run smoke:requirements` / `smoke:modules` / `smoke:change-set` / `smoke:design-handoff` / `smoke:design` | 全部通过（`smoke:design-handoff` 仅把单模块原型路径断言改为 `prototypes/MOD-001/...`） |
| `npm test --prefix frontend` | **120/120 通过** |
| `npm run typecheck` / `build` / `check:vue`（frontend） | 全部通过 |

- **Playwright（临时 data/projects，端口 3432/5199，`OPENCODE_AUTO_START=false`，生产构建 + API 预置两模块/PNG）**：两模块全部确认 → 弹窗模块表 2 行/全部已确认/聚合规模 → 生成进入开发 → 开发页重开交接包 v1、模块表 2 行、文件列表含 `prototypes/MOD-001|MOD-002/ps-*/page-*.png`、完整 scale `2 Story / 8 页面 / 29 KB`；阻塞应用（B 草稿 + 缺 4 图）1 个未就绪行、生成按钮禁用、原因提示；1440/1024/768 无页面级横向溢出；#1 变更历史显示“2 模块”，展开模块行 MOD-001/002“首次基线”；**0 console error / 0 pageerror / 0 意外 API≥400**。截图：`C:\Users\icecream\AppData\Local\Temp\opencode\m6a-e2e\shots\`（01—08，临时）。

### must-fix MF-M6a-1（2026-11-16 已修）：Change Set #1 写模块行

- `ensureChangeSet` 在 `persist=true` 时与 `app_change_sets` 插入同一事务为全部未归档模块写 `app_change_set_modules`：base 全 null（首次基线），current 记录当前需求版本/hash（`sha256(contentMd)`）、设计版本/hash（`designStateHash`），复用 `insertChangeSetModule`；preview（`persist=false`）不写库但返回合成模块行视图。
- `bindingOfRow` 附加 `changeSetModulesView`，`preview/generate/GET /change-sets` 的 #1 都能看到模块；`deleteDesignHandoffData` 同步清理模块行。旧 #1 无模块行仍可读（`modules=[]`），不回填。
- 前端 `ChangeSetHistoryDialog`：#1 模块行显示“需求 vN · 设计 vM（首次基线）”，不再误显示“变更中新增”；#2+ 无基线模块仍显示“变更中新增”。
- 测试：单模块 #1 1 行、两模块 #1 2 行（base null/current hash/templateId null）、`listChangeSets` #1 modules=2、预览合成、同单重新生成不重复插行、删除清理；新增 M6a-7 覆盖“#2 只选 A → 改 A 需求 → 确认 → bundle confirm → `syncDesignInput(mode='regenerate')` → 确认设计 → v2”，05 A 有“修改”、B“未变更”，B 需求/设计版本不变，#1 2 行/#2 1 行。
- 说明：模块行表无 current template 列，#1 按交接单固定 `design_base_template_id=null`，故 `templateId` 为 null（当前模板在 design project/manifest）。

最终：后端 **222/222**、前端 **120/120**、5 支冒烟、typecheck/build/check:vue；Playwright 增验 #1 历史“2 模块”与 MOD-001/002 首次基线模块行（截图 `08-history-modules.png`），0 console/0 意外 API≥400。

### 偏差 / 未验证

- 单模块新生成包的原型路径改为 `prototypes/MOD-001/...`（模块化契约；旧包仍按 DB 文件元数据可读），已同步更新测试与冒烟断言。
- 单模块校验/文案不加模块前缀（旧行为零回归）；多模块才加。
- 生成前弹窗规模仅模块/实体/页面集/页面计数；Story/文本等完整 scale 需“预览”或生成后（后端两遍测量）。生成前无法从 appPayload 预读 stale；stale 在预览/生成后模块表与后端 400 issues 中显示。
- `00-README` 模块索引用 Epic/Story 数，暂不列“每模块阶段数”；`04-PLAN` 仍是全局建议阶段 + 新增每模块目标/Epic/页面集清单。
- `manifest.phases` M6a 仍全局（M6b 加 moduleId/parentKey/两层阶段）。
- 未验证：<768 移动端；真实模型全链路（M6b 后主会话执行）；M6a 无表结构变化，无需真实库升级。

## M6b 完成（2026-11-16，实施会话 + 主会话评审）：U7 模块 + Epic 两层阶段

范围：`docs/plans/2026-11-16-module-m6-implementation-brief.md` §M6b。无旧数据迁移/legacy/回填；未启停 3300、未触碰真实 `data/`/`projects/`、未读 `.env`、未调真实模型。**单模块保持 U7 平铺阶段（零回归），多模块才生成模块 + Epic 两层。** 详细实施/偏差见交接单 **§M6b 实施结果**。

### 做了什么

- **manifest phases 两层**：多模块时 `base` → 每模块 `module:<MOD-KEY>`（kind=module，聚合模块 Story/页面集/页面）→ 模块内 `epic:<EPIC-ID>`（parentKey=MOD-KEY）→ `other:<MOD-KEY>`；无 Epic 时 `pageSets:<MOD-KEY>:<PS>`/`all:<MOD-KEY>`；`phaseCount` 只统计可执行阶段，新增 `modulePhaseCount`；单模块仍走原平铺 key/kind。
- **DB/API**：`app_dev_phases` 加 `module_id/parent_key/phase_kind`（`ensureColumn`，无回填；旧行 null 视为可执行原 kind）；生成写全；`phases[]` 返回 `kind/moduleId/moduleKey/moduleTitle/parentKey` 语义 + `modules[]` 汇总（状态按子阶段派生：全 skipped→skipped；全 completed/skipped 且至少 1 completed→completed；有 in_progress→in_progress；否则 not_started）+ `modulePhaseCount`；会话列表/开发状态带模块字段。
- **模块里程碑只读**：start/complete/skip/reopen 模块阶段 → 409；不建会话、不调模型摘要；可执行 order/total 排除模块行；Epic 会话标题/brief 带模块；`previousSummary` 只取同模块前一个可执行阶段（跨模块不串）。
- **04-PLAN**：模块里程碑标题不占“阶段 N”；模块章节补“模块阶段:`module:<KEY>`”“Epic 阶段:`epic:<ID>`（可执行，单独会话）”和“模块阶段只作分组/里程碑”完成标准。
- **前端**：PhaseBar 可执行进度 + 模块 chip 行（状态/完成数，点击查看模块）；PhaseDialog 按模块分组/折叠（模块状态/子阶段进度、Epic 缩进、当前高亮），模块里程碑详情无开始/完成/跳过/重新打开；DevView 可执行阶段列表/计数、当前阶段排除模块、chip/侧栏/会话列表显示 `MOD-xxx 模块名`；生成确认显示可执行阶段 + 模块里程碑数；沿用 theme token，1024/768 不溢出，深浅色正常。
- **测试**：后端新增 `dev/phases.test.ts` 2 项（两层生成字段/汇总/顺序 + 模块 409；模块内 Epic 会话/标题/brief/状态派生/同模块摘要）与 `handoff/design-handoff-modules.test.ts` manifest/`04-PLAN` 断言；`smoke:dev-phases` 保留单模块回归并追加两模块 fixture；前端新增分组/状态汇总/可执行/模块操作/文案 1 项。

### 验证（实际执行）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | **224/224 通过**（基线 222 + `dev/phases.test.ts` 新增 2） |
| `npm run smoke:dev-phases` | 通过（单模块 U7 平铺 + 两模块 manifest/phases/模块 409/Epic 会话/摘要/清理） |
| `npm run smoke:design-handoff` / `smoke:change-set` | 全部通过 |
| `npm test --prefix frontend` | **121/121 通过**（基线 120 + `phase-labels` 分组/模块 1 项） |
| `npm run typecheck` / `build` / `check:vue`（frontend） | 全部通过 |

- **Playwright（临时 data/projects，端口 3436/5199，`OPENCODE_AUTO_START=true`，真实 opencode 但不调模型）**：2 模块 / 10 Story / 8 页面 large 交接包 → 阶段生成、启动 MOD-001 Epic；PhaseBar 模块 chip 2 个、当前 `MOD-001 商品管理 · 阶段 2 · EPIC-001`、已完成 0/3；阶段弹窗模块分组 2、可执行 item 3、MOD-001 折叠/展开 3↔2、模块里程碑无开始/完成按钮、MOD-002 Epic 开始按钮可用；右侧阶段 chip 与会话列表带模块；1440/1024/768 无页面级横向溢出；深色生效；**0 console error / 0 pageerror / 0 意外 API≥400**。截图：`C:\Users\icecream\AppData\Local\Temp\opencode\m6b-e2e\shots\`（01—07，临时）。

### must-fix MF-M6b-1（2026-11-16 已修）：阶段视图补 `parentKey`

- `DevPhaseRef` 增加 `parentKey`（模块行/app base 为 null），`refOf` 取 `row.parent_key`；`phaseRefById/phaseRefsByIds/latestPhaseRefs/withPhase` 同步返回；会话列表项增加 `phaseParentKey`。
- 前端 `DevPhaseRef`/`DevSessionListItem` 类型同步；`groupPhasesByModule` 优先用 `parentKey`（缺失回退 `moduleKey`，现有分组行为不变）。
- 测试：GET phases 模块行 parentKey=null、Epic parentKey=MOD-001/002、`phaseRefById` 与会话列表带 parentKey；smoke 也断言。
- 复验使用独立 `DEV_PHASES_SMOKE_PORT=3795` + **`OPENCODE_PORT=4795` + `OPENCODE_AUTO_START=true`**（避开 3300 的 4771）：单模块 + 两模块全流程通过，含多模块 Epic start/complete（无 assistant → summary none、会话不归档）、模块状态 completed、标题/brief 模块信息、同模块摘要/跨模块不串。

最终：后端 **224/224**、前端 **121/121**、3 支相关冒烟、typecheck/build/check:vue 通过。

### 主会话独立复核（2026-11-16）

- 独立复跑：后端 **224/224**、前端 **121/121**、`smoke:dev-phases`（单模块 + 两模块）通过。
- 独立两模块 fixture（临时 data，端口 3437 + 独立 `OPENCODE_PORT=4795` + 真实 opencode 不调模型）：
  - manifest phases 顺序 `base → module:MOD-001 → epic:EPIC-001 → module:MOD-002 → epic:EPIC-002`；模块行 `moduleId/moduleKey` 齐全、`parentKey=null`；Epic 行 `parentKey=MOD-001/002`；`phaseCount=3`（只计可执行）、`modulePhaseCount=2`；`04-PLAN` 含模块/Epic 阶段。
  - 生成阶段：模块行 2、Epic 行 2；模块 start → 409；Epic start → 200，阶段 in_progress；会话 `phaseKind=epic`、`phaseModuleKey=MOD-001`、`phaseParentKey=MOD-001`，标题含模块；完成后阶段 completed、模块 MOD-001 派生 completed、MOD-002 not_started。
- 结论：M6 通过；M7（#8 预览）为非阻塞后续。下一步由主会话跑真实模型全链路 E2E（临时应用，跑完删除），再交用户新建应用。

### must-fix MF-M6b-2（2026-11-16 已修）：模块状态派生部分完成 → in_progress

- 真实 E2E：MOD-001 的 3 个可执行子阶段完成 1 个、其余 not_started，`modules[].status` 原为 not_started。
- `moduleStatusOf` 改为：无 children→not_started；全部 completed/skipped 且至少 1 completed→completed；全 skipped→skipped；只要有 in_progress/completed/skipped（已开始/有进度）→in_progress；否则 not_started。仍读取时派生，不回写 status。
- 前端 `phase-labels.js` 同名派生同步修改（PhaseBar/PhaseDialog 使用），`in_progress` 文案“进行中”已有。
- 测试：后端直接断言 1 completed + 2 not_started → in_progress、1 skipped + 2 not_started → in_progress、全 completed/skipped→completed、全 skipped→skipped、全 not_started→not_started；getDevPhases 验证 MOD-001 完成 1/3 子阶段后 in_progress。`smoke:dev-phases` 多模块 fixture 扩为 MOD-001 3 Epic，完成 1/3 后断言 in_progress/completed=1/total=3。
- 复验：`DEV_PHASES_SMOKE_PORT=3795` + 独立 `OPENCODE_PORT=4795` + `OPENCODE_AUTO_START=true`；后端 224/224、前端 121/121、`smoke:dev-phases` 通过。

### 真实模型全链路 E2E（2026-11-16，主会话执行，通过）

环境：3300（M6 构建）+ 真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash`；临时应用 `e2e-m6-*`（跑完删除）。

| 阶段 | 结果 |
| --- | --- |
| 应用/模块 | 新建应用 + 2 模块（库存管理/订单管理），需求/设计/开发 stage 均绑定真实模型 |
| 需求（真实模型） | 两模块各一次 doc chat → 解析 `<<<DOC_JSON>>>` 并应用；模块 A 8 Story、模块 B 9 Story；章节/必填补齐；两模块确认 + bundle confirm |
| 设计（真实模型） | 两模块 AI 生成实体与页面集；实体确认、每页 PNG（临时测试图）存档；两模块设计确认 |
| 交接包 | large：8 场景 / 6 Epic / **17 Story** / 7 实体 / 52 字段 / 13 关系 / 6 页面集 / **30 页面/30 PNG**；`modules=2`、`designModules=2`、`prototypes/MOD-001|002`；Change Set #1 模块行 2 |
| 开发阶段 | 生成 **2 模块阶段 + 6 Epic 阶段**；启动 MOD-001 Epic（会话标题/brief 带模块）；完成 1/3 子阶段后模块状态 `in_progress`；Epic complete 200 |
| 单模块变更 | 完成应用 → Change Set #2（只选 MOD-001）→ 改需求/同步/改实体/确认 → 交接包 v2；manifest `MOD-001=changed`、`MOD-002=unchanged`；05-CHANGES 含两模块 |
| 清理 | `DELETE /apps/:id?confirm=true` 200；`apps=0`、`projects/` 无残留 |

模型耗时（实测）：需求 37.4s / 55.6s；设计实体 15.1s / 19.9s；页面集 33.3s / 27.9s；总计 E2E 约 **191s**。断言 **31/31 通过**；临时脚本已删除，未提交日志。

### 偏差 / 未验证

- 单模块保持 U7 平铺（manifest key/kind、`04-PLAN`、前端布局不变），两层阶段只在多模块启用；旧阶段行 `phase_kind=null` 按 scope.kind 视为可执行，不迁移。
- `app_dev_phases` 无 `module_key` 列：模块行的 moduleKey 取 `module:<KEY>` 前缀、子阶段取 `parent_key`；`moduleTitle` 读取 `app_modules.title`（模块归档/删除时 null）。
- 模块行 `order` 不代表“阶段 N”（可执行 order/total 已排除模块行）；前端使用 `modules[]`/`parentKey` 分组。
- 无 Epic 模块扩展 `pageSets:<MOD-KEY>:<PS>`/`all:<MOD-KEY>`（交接单只列 module/epic/other）。
- 模块状态读取时派生，不写回状态列；模块阶段不生成摘要。
- 未验证：<768 移动端；旧库 `phase_kind=null` 存量阶段（真实库 apps=0，仅单测兼容）；真实模型全链路已在本段 E2E 验证。

## 需求大纲模块化（2026-11-16，实施会话完成 + 主会话 must-fix 已修并复评）

交接单：`docs/plans/2026-11-16-requirements-outline-modules-brief.md`（§9 已回填）。范围：**只改需求阶段前端布局/导航**，后端/API/表/交接包/Change Set/U7/设计阶段 `DesignModuleRail` 不动。

### 改了什么

- 删除最左侧独立“需求模块” rail：`frontend/src/requirements/RequirementModuleRail.vue` 已删除（grep 零引用），需求页只剩“对话 + 文档”，文档内部为“需求大纲 + 正文”；窄屏不再有“模块”抽屉（只保留对话/大纲）。
- 新增 `frontend/src/requirements/RequirementOutlineTree.vue`：模块成为“需求大纲”根节点（手风琴：最多一个展开，默认展开当前模块；当前模块高亮、显示 `x/y 必填`；必选/本次变更/状态/vN/负责人；描述改为标题 tooltip）；底部 `+ 新增模块` 与“已归档 N”折叠组；行内 `⋯` 菜单（编辑信息/上移/下移/归档；归档行恢复）使用 Teleport + fixed 定位不被大纲滚动裁切，Esc/外部点击关闭、Esc 回焦触发按钮；`aria-expanded/aria-current`、原生按钮键盘可达；0 模块空态。
- `RequirementsDocView.vue`：移除 `moduleOpen`/rail/模块 toggle；大纲宽度 248px（≤1280 220px），≤1024 抽屉 `min(320px, 100vw - 56px)`、≤768 `100vw - 24px`；`switchModule` 保留 flush→切换（失败中止并提示）；手风琴由 `selectedModuleId` 驱动；新增 `activeSectionKey`/`pendingScrollKey`/`outlineExpandedId`；`.doc-scroll` 滚动监听（`requestAnimationFrame` 节流、仅 `mode='edit'`、`onBeforeUnmount` 清理），滚动高亮取最后一个 `top <= 容器顶 + 24px`，滚到底取最后一节；跨模块章节走 pending → 切模块 → `nextTick` 定位，目标不存在回退第一节并提示；点“问 AI”同时高亮焦点章节（短暂抑制 scroll spy，不自动发送）；切模块/加载/AI 应用/版本回滚/模板变化/全文保存后重算。
- `module-helpers.js`（+ `.test.mjs`）：新增 `moduleStatusClass`、`moduleOutlineRow`、`moduleOutlineTooltip`、`outlineCompletion`、`activeSectionFromTops`、`resolveSectionTarget`、`scrollAtBottom`；原有 `resolveInitialModule`/`progressOf`/`moveModuleIds`/`nextModuleAfterArchive`/`createModuleGate` 等行为不变。
- 样式只用 `shared/theme.css` 的 `--rg-*` token；未新增依赖；未改 `requirements/api.ts`。

### 主会话 must-fix 修复（2026-11-16）

- **MF1 短文档 scroll spy 误判**：新增 `scrollAtBottom(metrics, threshold=4)`（`scrollHeight <= clientHeight + threshold` 视为不可滚动 → false；可滚动且距底 <= threshold → true），`computeActiveSection` 改用该函数；单测覆盖不可滚动/刚好等于阈值/中间/到底/阈值边界/非法输入。
- **MF2 加载后不再自动滚到第一节**：`afterDocLoaded` 仅在 `pendingScrollKey`（跨模块跳转/回退）非空时 `scrollSectionIntoView`；普通加载/切模块保持 `resetDocView` 的 `scrollTop=0`，只初始化 active=第一节。Playwright 断言：初始加载（已确认只读横幅）`scrollTop=0`、横幅可见、第一节高亮；切模块/切回同样 `scrollTop=0`、横幅可见。
- **MF3 模块操作前 flush**：`saveModule` 创建分支、`archiveModuleById`（仅归档当前模块）、`restoreModuleById` 在写库/切换前 `await flushAll()`；失败时分别提示“已取消新增模块/归档/恢复；请先处理保存失败”并中止（不创建/不归档/不恢复、不切模块；创建失败保持弹窗打开、`moduleSaving` 正常复位）。成功路径与文案不变。Playwright 用 PUT 500 注入覆盖三条失败路径（操作取消、仍停留原模块、编辑内容仍在），并覆盖成功路径“内容先落盘（API 复核）再切换”。
- **小修**：`askAi` 同时 `outlineExpandedId = selectedModuleId`（当前模块折叠时点“问 AI”也会展开大纲并高亮焦点章节，不自动打开窄屏抽屉）；≤1024 CSS 注释改为“对话/大纲折叠为抽屉”。

### 验证（2026-11-16，实施会话）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过（未改后端） |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **224/224**（基线 224） |
| `npm test --prefix frontend` | **128/128**（基线 121，+7 个测试块：`moduleStatusClass`/`moduleOutlineRow`/`moduleOutlineTooltip`/`outlineCompletion`/`activeSectionFromTops`/`resolveSectionTarget`/`scrollAtBottom`） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |

- Playwright（临时数据，未启停 3300、不调模型）：后端 `dist` 3450 + 临时静态服务/代理 5199，`RG_DATA_DIR`/`RG_PROJECTS_DIR` 临时目录，`OPENCODE_AUTO_START=false`；API 预置 3 模块（A 已确认 / B 草稿 / C 已归档），**127/127 断言通过**，0 console error / 0 pageerror / 0 意外 API≥400 / 0 横向溢出。覆盖：无 rail/模块抽屉；大纲标题/2 根节点/手风琴折叠-展开；当前模块高亮、必选/状态/版本/负责人/x-y 必填/描述 tooltip；初始加载 `scrollTop=0`/只读横幅可见/第一节高亮；超高视口下短文档不可滚动时 scroll spy 不高亮最后一节；切模块/切回 `scrollTop=0`、横幅可见、第一节高亮；切模块（正文标题/状态/版本、按模块 chat 历史、上下模块收起展开）；同模块章节定位；scroll spy 顶/底；预览/全文源码章节树仍在、点章节只高亮不切换、切模块恢复编辑；问 AI（含当前模块折叠）展开大纲并高亮焦点章节、不发送；flush 成功（API 复核落盘）与失败注入（提示并停留原模块）；行内菜单不裁切/禁用态/编辑弹窗/上移下移恢复/Esc 回焦；归档 B（回退 A）→ 已归档组展开 2 → 打开归档模块只读 → 恢复 B；已确认模块只读 + 重新编辑入口；+新增模块弹窗；创建/归档当前/恢复在 PUT 500 下均取消且保留编辑，成功路径内容先落盘再切换（API 复核）；1280 大纲 220；1024 仅“对话/大纲”抽屉（Esc、切模块/点章节关闭）；768 抽屉宽度与遮罩；浅/深色（大纲/Teleport 菜单非白底）。
- 截图（临时目录，未提交）：`C:\Users\icecream\AppData\Local\Temp\rg-outline-e2e-fNtsnW\shots`（`1440-light-initial`、`1440-light-module-ops`、`1280-light`、`1024-light-outline-drawer`、`768-light-outline-drawer`、`1440-dark-menu`、`1024-dark-outline-drawer`、`1440-light-flush-failure`）。

### 主会话复评（2026-11-16，未改代码）

- 独立复跑：前端 **128/128**、`typecheck`、`check:vue` 通过；后端 **224/224**（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`）。未启停 3300、未触碰真实 `data/`/`projects/`。
- 走查：`RequirementModuleRail` 零引用；手风琴由 `selectedModuleId` 驱动；行内菜单 Teleport/fixed 不裁切；`afterDocLoaded` 仅在 pending 时滚动（横幅不被顶掉）；短文档 `scrollAtBottom` 不再误判最后一节；新增/恢复/归档当前模块前 `flushAll` 失败即中止；点“问 AI”展开当前模块并同步高亮。
- 关键截图复核：1440 初始（只读横幅可见、第一节高亮、2 模块 + 已归档 1）、1024/768 大纲抽屉、深色大纲 + Teleport 菜单、flush 失败（保存失败、仍停留原模块、内容保留）。
- 结论：**自动化与截图复核通过，可进入真实应用体验验收**。已接受偏差：跨模块章节点击不可达（手风琴只渲染当前模块章节，按决策 1 点其它模块即切换）；当前归档模块自动展开“已归档”组；切模块后归档组折叠态重置；change set 范围/0 模块/门禁提示未做 UI 断言；`<768` 未验证。
- 说明：实施会话重建了 `frontend/dist`；3300 进程与后端未重启/未改，刷新浏览器即可加载新需求页。

### 偏差 / 未验证

- **跨模块章节点击不可达**：决策 1 的手风琴只渲染当前模块章节，点击其它模块根节点即切换，因此用户无法点到“其它模块的章节”。`jump(moduleId, sectionKey)` 的 pendingScroll + 目标不存在回退仍按交接单实现（`resolveSectionTarget` 单测），同模块跳转与切模块已由 Playwright 覆盖；交接单 §3.2 与 §1 决策 1 的此点按执行澄清处理，未为测试另造入口。
- 当前模块为**已归档**时自动展开“已归档 N”组（切模块时 `doc-body` 会重挂载、树内部折叠态重置；不自动展开会导致当前归档模块在大纲里不可见）；其余情况默认收起。
- `+ 新增模块` 的“非需求阶段禁用/门禁提示”、0 模块空态、变更中归档禁用：需求页只在 `requirements` 阶段渲染（设计/开发走 `DesignStudio`/`DevView`），变更单需 development + 交接包，故 Playwright 无法从 UI 触发这些分支；`createModuleGate`/归档最少 1 个逻辑沿用原实现与单测，未在 UI 断言。
- 模块描述不再常驻（保留在标题 tooltip 与编辑弹窗，按交接单有意紧凑化）。
- 未验证：<768 移动端（沿用既有范围）、真实长会话/长模块列表（5—8 模块）实机压测。
- 未触碰 3300、真实 `data/`/`projects/`/`.env`，未调用真实模型。

## RMP-1 完成（2026-11-16，含复核 must-fix MF1—MF7 + 真实模型 E2E 通过）：首次模块规划 + 逐模块生成

交接单：`docs/plans/2026-11-16-rmp1-implementation-brief.md`（§10 已回填）；设计稿：`docs/plans/2026-11-16-requirements-module-planning-design.md`。范围：**只做 RMP-1**；不做 RMP-2（随时重规划/keep-rename-regenerate-archive diff）、不做 Change Set 内重规划；不改设计阶段 `DesignModuleRail`、交接包、U7；**不新增数据库表**（规划草稿/原始需求写入 `app_settings`）。

### 目标与流程

- 新应用仅一个空默认模块、requirements、无 active Change Set、未最终确认时，首条实质需求走 `mode='doc-plan'`：AI 只输出 `<<<MODULE_PLAN_JSON>>>` 模块拆分建议，**不写文档/不建模块**；聊天中展示可编辑「模块拆分建议」卡（模块名/说明/scope/排序/增删、建议 Epics、依赖、覆盖/未分配/warnings/openIssues）。
- 用户点「应用拆分并生成」：再次校验首次条件（不满足 409、不覆盖内容）→ 复用空默认模块（保留 ID/文档/版本/对话，更新模块标题、`required`、position，文档标题显式改为 `${appName} · ${title} 需求文档`，覆盖 `MOD-001` 旧特例）→ 其余模块按顺序新建 `MOD-002…`（各空文档 v1）→ 写 `app.<id>.modulePlanApplied`（含 moduleId 映射）/`modulePlanSource`（默认模块 chat 的 user 消息，截断 60k）→ 逐模块 SSE 生成完整模板 PRD。
- 「保持单模块」：不 apply 结构，只生成当前默认模块。
- 生成：每模块独立短暂 opencode 会话（需求阶段 agent/model，不写模块聊天历史）；解析容错 `<<<DOC_JSON>>>`；复用 `saveDoc(source='ai', snapshot)` 只写当前模块（全文按模板标题映射为 sections 更新，避免漏写章节被全文保存丢弃）；全局 ID 后端分配；生成后仍 `draft`，不自动确认；失败继续其它模块、已完成保留；客户端断开/取消 → abort 当前 opencode 会话。
- 计划消息随聊天持久化（metadata `modulePlan`），刷新/重进恢复建议卡；已应用/已保持单模块由运行态或模块/文档状态推导展示。

### 后端改动

| 文件 | 内容 |
| --- | --- |
| `backend/src/chat/module-plan-prompt.ts`（新） | `buildModulePlanChatPrompt`：模板全部章节/guidance + 拆分规则（业务域、禁止按 CRUD/实体拆、同域实体与明细归一个模块、排除项不生成模块、通常 1—6、标题唯一、依赖/覆盖/unassigned/openIssues/warnings、只规划不写文档）；上一版计划随历史回传支持多轮 refinement |
| `backend/src/chat/service.ts` | 新增 `mode='doc-plan'`（仅 requirements）；先 `initialPlanEligibility` 守卫（不满足 409，不进入 SSE）；SSE `meta/delta/done/error` 与消息持久化沿用；meta.mode=`doc-plan`；不写文档 |
| `backend/src/requirements/module-plan.ts`（新） | `MODULE_PLAN_JSON` 分隔符/容错解析、归一化、校验（≥1、≤50、标题非空唯一、`existingModuleId=null`、`action=create`；>8/CRUD 标题/缺覆盖/unassigned 为 warning）；`initialPlanEligibility`（阶段/变更单/最终确认/恰好 1 个未归档模块/doc draft 且全空）；`applyModulePlan` 单事务复用默认 + 新建 + 文档标题 + settings（`readAppliedModulePlan/Source` 供生成） |
| `backend/src/requirements/modules.ts` | 抽取 `createModuleWithEmptyDoc`（与 `createModule` 共用空文档 v1/版本/事件），`createModuleRow` 支持显式 position；行为不变 |
| `backend/src/requirements/module-generation.ts`（新） | `prepareModuleGeneration`（requirements、无 active Change Set、模块属于应用且未归档；initial/retry 需要已应用计划+原始需求，single 只允许 1 个模块；retry 必须指定 moduleIds）；`buildModuleGeneratePrompt`（模板/原始需求/全部模块边界/依赖/当前模块/排除项/`DOC_JSON` 协议）；`parseDocJsonOutput` 容错；`applyGeneratedDoc`（复用 saveDoc、只写该模块、`ai` 版本、必填缺失 warning）；`runModuleGeneration`（顺序生成、注入 generator、事件 module-start/module-done/module-error/all-done、失败继续、取消保留已完成、全局 ID 后端分配） |
| `backend/src/requirements/routes.ts` | `POST /requirements-modules/plan/apply`；`POST /requirements-modules/generate`（SSE；守卫在写头之前，普通 HTTP 错误；客户端断开 abort） |
| `backend/src/requirements/module-plan.test.ts`、`module-generation.test.ts`（新） | 15 项：解析/校验/守卫/apply 复用与新建/标题/position/key/settings/source 截断/文档已有内容 409/非法 400；生成 prompt、prepare 守卫（无计划/single/retry/归档）、DOC_JSON 应用/版本 ai/draft/不确认/全局 ID、失败继续+重试、取消、只写当前模块 |
| `backend/src/requirements/routes.test.ts`、`module-ui-support.test.ts` | 新增规划聊天 409（无模块/设计阶段）、plan/apply HTTP（400/200/重复 409）、生成守卫（非需求阶段 409、无规划 409） |

### 前端改动

| 文件 | 内容 |
| --- | --- |
| `frontend/src/requirements/module-plan-protocol.js`（新）+ `.test.mjs` | `MODULE_PLAN_JSON` 解析/归一化/校验（与后端同口径），容错代码块/尾逗号/无分隔符；5 项单测 |
| `frontend/src/requirements/module-plan-helpers.js`（新）+ `.test.mjs` | 首次资格预判、计划草稿克隆/上移下移/增删/scope 行编辑/转 API、生成进度状态机（start/done/error/all-done、取消）、摘要/失败模块；5 项单测 |
| `frontend/src/requirements/ModulePlanCard.vue`（新） | 可编辑建议卡：标题/说明/scope、上移下移/删除/新增、建议 Epics 折叠、依赖/覆盖/未分配/warnings/openIssues、校验错误、应用/保持单模块、已应用/已保持/生成中/已生成、内嵌进度与重试/取消；`--rg-*` token、窄屏自适应 |
| `frontend/src/requirements/ModuleGenerationProgress.vue`（新） | 模块列表与状态（等待/生成中/已生成/失败/取消）、版本、失败原因、重试失败模块、取消剩余、0 console |
| `frontend/src/requirements/DocChatPanel.vue` | `planMode`/`planState`/`planOutcome` props 与 `apply-plan/keep-single/retry-generation/cancel-generation` 事件；`doc-plan` 请求/解析/消息 metadata；历史恢复计划卡（兼容旧 content 含分隔符）；apply/keep-single 前强制落盘聊天（保证后端读到原始需求）；多轮 refinement 回传上一版计划；可见流剔除计划分隔符；规划提示/占位文案/首次空态 |
| `frontend/src/requirements/RequirementsDocView.vue` | `planEligible/planMode/planOutcome`；`onApplyPlan`（flush → apply → 刷新模块/文档/bundle → 生成）、`onKeepSingle`、`onRetryGeneration`、`onCancelGeneration`；`runModuleGeneration` SSE 状态归并、序列号防旧请求、完成后刷新并选中第一个生成模块；有失败/取消时**不切换模块**（保留建议卡与重试入口）；卸载 abort |
| `frontend/src/requirements/api.ts` | `ModulePlan*`/`AppliedModulePlan`/apply 结果/生成事件/UI 状态类型；`applyRequirementModulePlan`；`streamModuleGeneration`（SSE，遇 all-done 返回）；`streamDocChat` 支持 `mode:'doc'|'doc-plan'`；`DocChatMessage.modulePlan` |

### 验证（实际数字）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **244/244 通过**（基线 224 + 新增 20；含 MF1、MF6、MF7） |
| `npm test --prefix frontend` | **138/138 通过**（基线 128 + 新增 10） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | OK（全部 SFC 导入完整） |

- Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 端口 3401，`OPENCODE_AUTO_START=false`，mock 规划/生成 SSE，**不调真实模型**）：**80/80 断言通过**（本轮复验脚本；断言粒度与上一版 98 项不同，覆盖不减少并新增取消后部分完成显示 6 项）；0 console error / 0 pageerror / 0 意外 API≥400；0 横向溢出。
- 覆盖：新应用空默认模块 → 首条消息走 doc-plan（断言请求 mode）→ 2 模块建议卡（商品管理/订单管理、依赖 订单→商品、覆盖/未分配/openIssues/warnings、无支付模块）→ 改写标题/scope、增删/上下移 → 应用（复用默认模块 ID、MOD-001/002、编辑后的标题、两文档 draft v2 `ai`、文档标题带模块名、大纲 2 根节点、当前模块、已应用状态、规划提示消失）；保持单模块（1 模块、默认 ID 不变、draft v2、大纲 1 根）；非法计划（无卡/不建模块）→ 重试有效计划 → 刷新恢复计划卡 → 应用 → 生成失败（失败标记/空文档保留/其它模块成功）→ 重试成功 → 刷新已应用/多模块不再规划/重复 apply 409；手动编辑文档后不再进入规划（新消息走 doc 模式）；生成中取消（已取消、模块保留、两个重试按钮）→ 取消后重试成功；单模块失败 → 无 plan retry 成功；刷新后「重新生成全部模块」（取消不发请求 / 确认后 v3 且旧版本保留）；生成中 Composer 禁用、完成后恢复；规划卡 1440/1280/1024/768 × 浅/深 截图。
- 截图（临时目录，未提交）：`C:\Users\icecream\AppData\Local\Temp\opencode\rmp1-pw\screens`（`a-happy-1440-light`、`b-keep-single-1280-dark`、`c-regenerate-1024-dark`、`d-guard-768-light`、`e-generating-composer-1024-light`、`e-partial-cancelled-1024-light`、`e-cancel-retry-complete-1024-light`、`f-plan-{1440,1280,1024,768}-{light,dark}` 等）。

### RMP-1 复核 must-fix（2026-11-16，主会话发现，已修并复验）

| # | 问题 | 修复 |
| --- | --- | --- |
| MF1 | “保持单模块”失败后前端 retry（`reason='retry'`）因无 `modulePlanApplied` 一律 409 | `prepareModuleGeneration`：`single` 要求未归档模块**恰好 1 个**（moduleIds 若传必须是它；已拆分 >1 → 409 提示用已应用规划）；无 plan 的 `retry` 在 moduleIds 恰好 1 个且与唯一未归档模块匹配时按单模块重试（plan=null、source 读 settings/chat），否则维持 409。新增后端测试：单模块失败→retry 成功、拆分后 single 409、无 plan 多模块 retry 409 |
| MF2 | 取消（cancelled）/跳过（skipped）模块没有重试入口 | `ModuleGenerationProgress.vue`：error/cancelled/skipped 在生成结束且非只读时都显示「重试」；取消文案改为“可对未完成模块点‘重试’”；重试沿用现有 retry（MF1 保证 single 也可重试）。Playwright：取消后 2 个重试按钮 + 重试成功 |
| MF3 | 拆分 apply 后刷新，`planState` 丢失、建议卡 frozen、无继续生成入口 | `ModulePlanCard` 在已应用、无运行态 generation、非 busy 时显示「重新生成全部模块」+ 说明（刷新后进度不保留；会生成新 AI 版本、旧版本保留）；`RequirementsDocView.onRegenerateAll` 二次确认后按 activeModules 调 `runModuleGeneration`（1 个→single，多个→retry），不自动触发。Playwright：取消确认不请求、确认后进度 2/2、两模块 v3、旧版本保留 |
| MF4 | 生成中仍可在 Composer 并发对话 | `DocChatPanel` 新增 `generationRunning`：textarea/发送/next-step 禁用，placeholder/hint 显示“模块生成中，完成后可继续对话”；不影响聊天流式停止按钮；`RequirementsDocView` 传 `Boolean(planState.generation?.running)`。Playwright：生成中 disabled、取消后 enabled |
| MF5 | 取消后重试一个模块时，其它模块仍 `cancelled`，但头部/底部/卡片误报“已完成/已生成 N 个模块” | `ModuleGenerationProgress`：头部按 running → `cancelled \|\| cancelled>0`（`N 个已取消`）→ 失败 → 已完成；底部按 running → 未完成可重试 → 失败 → 已生成。`ModulePlanCard`：有 generation 且 `done<total` 时显示 `已应用 · done/total 模块`（单模块 `已保持单模块 · 未完成`），全部 done 才显示“已生成 N 个模块”。另：定向 `retry` 成功后不再切换模块（保持建议卡/进度可见）。Playwright：取消→重试 1 个后头部“1 个已取消”、底部提示重试、卡片 `1/2`、不出现“已完成”；再重试第二个后头部已完成、底部/卡片“已生成 2 个模块” |
| MF6 | `POST /plan/apply` 在 `modulePlanSource` 为空时先建/复用模块、写 settings，生成接口才 409，留下半应用状态 | `applyModulePlan` 在事务前计算 source；`source.trim()` 为空 → `RequirementDocError(409, '缺少原始需求记录，无法应用模块拆分；请先发送需求后重试')`，不写模块/文档/settings/stage event；显式 `options.source` 空白同样视为空；正常 apply 不变。后端新增 1 项测试（无聊天/空白 source 409 + 模块/settings/文档/事件不变；显式 source 正常 2 模块）+ HTTP 路由测试补无 source → 409 且仍 1 模块，补聊天后 apply 成功 |
| MF7 | 真实 Node/Express 下生成 SSE 在客户端收到 `module-start` 后立即 terminated、无 all-done，生成未执行 | 根因 `req.on('close')` 在请求体完成后即触发，误判客户端断开并 abort。改为 `res.on('close')`/`res.removeListener('close')`（与聊天 SSE 同口径；onClose 保留 `if (res.writableEnded) return`），不改其它 SSE 路由。新增真实 HTTP 回归测试：stub opencode 生成器，POST generate 完整收到 module-start/module-done/all-done + `ok:true`，文档 v2；已确认旧 `req.on` 下该测试失败。真实服务器 E2E 由主会话在保留临时应用上复跑 |

复验（must-fix 后）：后端 **244/244**（基线 224 + 20）、前端 **138/138**（基线 128 + 10）、`typecheck`/`build`/`check:vue` 通过；Playwright **80/80（本轮复验脚本）**（MF6/MF7 为纯后端，无需重跑 Playwright；含 MF1—MF5 与原有回归），0 console/page error、0 意外 API≥400、0 横向溢出。截图目录同上（`c-regenerate-1024-dark`、`e-generating-composer-1024-light`、`e-partial-cancelled-1024-light`、`e-cancel-retry-complete-1024-light` 为复核新增）。

### 主会话真实模型 E2E（2026-11-16，通过）

环境：临时 backend（3453）+ 独立 opencode 2.2.5（4798）+ 当前 opencode 默认模型；临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`；**未启停/未触碰真实 3300**、真实 `data/`/`projects/`/.env；不打印凭据。

| 项 | 实测 |
| --- | --- |
| 规划 | 用户样例 → **商品管理 / 订单管理** 两个模块；`order → product` 依赖；覆盖 5 条需求；无支付模块；商品明细未单独成模块；openIssues 合理 |
| 应用 | 复用 MOD-001=商品管理（ID/对话保留）+ 新建 MOD-002=订单管理；文档标题带模块名 |
| 生成 | 商品管理 **13/13 节**、6 场景/2 Epic/10 Story；订单管理 **13/13 节**、5 场景/2 Epic/6 Story；两模块 draft **v2**、`ai` 版本；必填缺失 0 |
| 归属 | 商品文档含商品明细；订单文档引用商品、不重复建商品实体；无支付模块/流程 |
| 断言 | **8/8 通过**（plan 2 模块/商品/订单/无明细模块/无支付模块/order→product、模块 2、MOD-001、draft、非空、必填、Story、商品含明细、订单引用商品） |
| 清理 | 临时应用 `DELETE` 成功；临时 backend/opencode 已停止；临时 `summary` 在 `C:\Users\icecream\AppData\Local\Temp\opencode\rmp1-real-e2e2-20261116-152258\`（未提交）；真实库 `apps=0` |

- 真实 E2E 首次暴露 **MF7（`req.on('close')` 误判 SSE 断连）**；改为 `res.on('close')` 后重跑通过；MF6 也由 E2E 暴露（apply 无 source 半应用）。
- **注意**：真实 3300 后端进程仍是 RMP-1 之前的构建（本轮未启停）；`frontend/dist` 已是新构建。**需用户确认后执行 `stop.cmd` → `start.cmd` 重启后端**，才能使用 RMP-1 的 `doc-plan`/plan apply/generate 接口；重启后真实库 `apps=0`，可直接新建应用。

### 偏差 / 未验证

- 生成 SSOT：`applyGeneratedDoc` 先把 `doc` 按模板标题映射成 sections 更新、结构化 data 取 `sections[].data`，再复用 `saveDoc`（而全文 `contentMd` 会丢弃漏写的模板章节）；协议仍是 `<<<DOC_JSON>>>`，与交接单“复用 saveDoc”一致。
- 生成失败/取消时保留当前模块（不自动切到“第一个已生成模块”），否则建议卡/重试入口会因切模块从聊天中消失；全部成功才切到第一个生成模块。
- `planOutcome` 刷新后按“未归档模块 >1 → 已拆分；文档有内容 → 已保持单模块”推导展示；无法区分“手动编辑过的空计划卡”，此时卡片显示已保持单模块、不再提供 apply（后端 apply 仍会 409）。
- 规划模式只在需求阶段、首次条件满足时启用；设计/开发阶段不提供本入口（RMP-2 才做重规划入口与门禁提示）。
- 不支持在 Change Set 内重规划；未新增数据库表；未改设计阶段/交接包/U7。
- 未验证：<768 移动端；5—8 模块长列表与逐模块生成耗时压测；真实 opencode 的取消/interrupt 实测仅由 mock SSE + 注入生成器覆盖。真实模型规划与逐模块生成已在上方 E2E 通过。
- 真实 3300、真实 `data/`/`projects/`/.env 未触碰；真实模型仅在临时实例调用（临时应用已删除）。

## RMP-2 完成（2026-11-16，主会话复核 must-fix MF-RMP2-1—4 已修 + 真实模型 E2E 通过）：需求阶段随时 AI 重新规划模块

交接单：`docs/plans/2026-11-16-rmp2-implementation-brief.md`（§10 已回填）；设计稿：`docs/plans/2026-11-16-requirements-module-planning-design.md`。范围：**只做 RMP-2**；不改 RMP-1 首次 `doc-plan`/plan apply/生成主链路；不做 Change Set 内重规划；不做章节/Epic 跨模块搬运；**不新增数据库表**（规划结果/聚合需求写入 `app_settings`）；不改设计阶段/交接包/U7。

### 目标与流程

- 需求阶段、最终“完成需求阶段”之前，文档头部新增 **「AI 规划模块」**：读取当前**全部未归档模块**的文档/Epics/Stories/scope，按用户指令（默认“根据当前全部需求内容重新拆分模块”）让 AI 重新给出模块边界。
- 预览 diff → 可编辑标题/说明/范围、增删/排序、映射现有模块或新建、动作 keep/rename/regenerate/create；显示将归档列表（可点“保留”映射回来）、依赖/覆盖/未分配/warnings/openIssues、`sourceTruncated`。
- 已确认模块：预览明确列出受影响模块并提示重开；**必须勾选“允许重新打开已确认模块”** 才能应用（后端未传 `reopenConfirmed=true` → 409 且不写）。
- 应用：单事务 keep（只改 position）/rename（改标题/说明/文档标题，不产版本）/regenerate（保留 ID/对话/版本，改标题/说明/文档标题）/create（新建空 v1）；未匹配旧模块**归档**（内容/版本/对话保留，可恢复）；先建新模块再归档；apply 不生成文档；前端只对 create/regenerate 调 `/requirements-modules/generate`（`reason='replan'`，复用 `ModuleGenerationProgress` 进度/重试/取消）。
- 入口门禁：`app.status==='requirements'` + 无 active Change Set + `apps.requirements_confirmed_at` 为空 + 至少 1 个未归档模块；设计/开发/完成/变更中入口禁用并提示路径，API 409。

### 后端改动

| 文件 | 内容 |
| --- | --- |
| `backend/src/requirements/module-replan.ts`（新） | `collectReplanSource`（只读聚合：模块顺序/状态/版本/scope/章节/结构化 Epics+Stories；单章节 4k / 单模块 16k / 总 80k 截断 + `contentChars`）；`buildModuleReplanPrompt`（当前模块 moduleId/key/title/status/version/scope + 全部需求 + 指令 + keep/rename/regenerate/create 规则 + `MODULE_PLAN_JSON` kind=replan + 只规划不写文档）；`normalizeReplanPlan`（keep 标题/说明变化自动→rename；key 去重）；`validateModuleReplan`（动作/映射唯一/未知模块/create 映射/标题唯一/范围变化/技术上限 50/>8/归档/confirmed 重开/覆盖/未分配/依赖）；`splitModuleReplanOutput`（容错代码块/尾逗号）；`replanEligibility`；`previewModuleReplan`（只读、注入 generator、模型失败 502、abort 499）；`applyModuleReplan`（单事务：先聚合 source → 重开受影响 confirmed（doc draft、清 apps.requirements_confirmed_at、同模块设计 draft、事件）→ 按动作处理 → 归档未匹配 → 写 `modulePlanApplied`(kind=replan)/`modulePlanSource`(≤60k) → `module-replan-applied` 事件；返回 kept/renamed/regenerated/created/archived/reopened/generation） |
| `backend/src/requirements/module-plan.ts` | `ModulePlan.kind` 扩展为 `initial | replan`（+ `instruction?`）；`readAppliedModulePlan` 读取存储 kind（旧数据仍 initial）；RMP-1 initial 校验/apply 行为不变 |
| `backend/src/requirements/module-generation.ts` | `reason` 增加 `replan`：必须有 `modulePlanApplied`(kind=replan) + `modulePlanSource` + 非空 `moduleIds`，且只能生成 action=create/regenerate 的模块（keep/rename 拒绝）；replan 后 `initial` 409；`retry` 仅重试 create/regenerate；replan 的 source 截断上限 60k（RMP-1 仍 30k），prompt 标题改为“当前全部需求（重新规划聚合摘要）” |
| `backend/src/requirements/doc.ts` | 新增 `updateRequirementDocTitle`（仅改标题/content_md/updated_at，不产版本；RMP-2 rename/regenerate 使用） |
| `backend/src/requirements/routes.ts` | `POST /requirements-modules/replan/preview`（JSON、只读、`res.on('close')` abort、错误走普通 HTTP）；`POST /requirements-modules/replan/apply` |
| 测试 | 新增 `module-replan.test.ts`（11 项：source/截断/prompt/归一化/校验/解析/preview 只读/502/apply 拆分·合并/rename+confirmed 重开/keep 保留确认/守卫/空需求 fail-closed/生成 replan+retry）；`module-ui-support.test.ts` 新增 RMP-2 HTTP 1 项（preview 只读/设计 409/非法 apply 400/apply 200/generate 守卫/真实 HTTP SSE replan 生成） |

### 前端改动

| 文件 | 内容 |
| --- | --- |
| `frontend/src/requirements/ModuleReplanDialog.vue`（新） | 两步弹窗：① 当前模块概览 + 指令（loading/可取消/失败重试）；② 可编辑建议（标题/说明/范围、映射 select、动作 select、建议 Epics、归档列表 + 保留、依赖/覆盖/未分配/warnings/openIssues、校验错误）+ confirmed 警告与必选勾选 + 应用；③ 已应用摘要 + `ModuleGenerationProgress`（reason replan/retry、重试/取消）；token/深浅色/内部滚动/1440·1280·1024·768；关闭不写库，生成中禁止关闭/再次规划 |
| `frontend/src/requirements/module-replan-protocol.js`（新）+ `.test.mjs` | 防御性 plan 归一化、动作标签、keep→rename 展示、范围比较、编辑后校验（空/重复标题、重复映射、create 映射、范围变化、动作非法、>8/>50、CRUD warning）；4 项单测 |
| `frontend/src/requirements/module-replan-helpers.js`（新）+ `.test.mjs` | 建议→草稿（clientId）、增删/排序/scope、映射 options/applyMapping、归档计算/恢复、受影响 confirmed/生成列表/摘要、草稿→API（keep→rename）、apply 摘要/选中目标；6 项单测 |
| `frontend/src/requirements/api.ts` | `ModulePlan.kind` union；`ModuleReplan*` 类型；`previewModuleReplan`（可 abort）/`applyModuleReplan`；`ModuleGenerationReason` 增加 `replan`；`request` 支持 signal |
| `frontend/src/requirements/RequirementsDocView.vue` | 文档头部「AI 规划模块」入口 + 门禁提示；`ModuleReplanDialog` 接线；apply 后刷新模块/bundle 并选中生成/保留模块；生成结束后刷新文档/大纲/bundle、选中第一个生成模块并提示“已保留 X、改名 Y、重新生成 Z、新建 N、归档 M”；`replanBusy` 禁用 Composer/入口 |

### 验证（实际数字）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **256/256 通过**（基线 244 + 12） |
| `npm test --prefix frontend` | **148/148 通过**（基线 138 + 10） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | OK（全部 SFC 导入完整） |

- Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 端口 3417；真实临时 backend + **mock 模型**，不调真实模型）：**133/133 断言通过**（含复核 must-fix MF-RMP2-1—4）；0 console/page error（仅规划失败场景一次预期 502 资源错误被过滤）、0 意外 API≥400、0 横向溢出。
- 覆盖：入口（requirements 可用；design/development/active Change Set 禁用 + 路径提示；首次规划未完成禁用）、默认指令/预览 loading、split diff（keep/regenerate/create）、增删行、apply → 2 模块生成、keep 内容/版本/标题不变、regenerate 文档标题/版本+1/ai 内容、create v2、settings kind=replan、大纲 3 根；confirmed 警告 + 未勾选禁用 + 勾选后 rename 重开/keep 保持 confirmed；merge 归档 2 旧模块 + “保留”恢复行 + apply 后 1 活跃/2 归档/内容保留/归档只读/恢复；范围变化/空标题/映射缺失校验且不写库；生成失败→重试 2/2、取消剩余→重试部分/全部（结果页不误报）；规划失败 502 → 重试成功 → 关闭不写库；旧 RMP-1 建议卡按 `planKind` 区分（replan 隐藏“重新生成全部模块”、initial 保留）；preview `errors[]` 服务端提示可见且编辑后可应用；浅/深 × 1440/1280/1024/768 截图与无横向溢出。
- 截图（临时目录，未提交）：`C:\Users\icecream\AppData\Local\Temp\rmp2-pw-1794820456290\screens`。
- RMP-1 回归：后端 `module-plan.test.ts`/`module-generation.test.ts`/`module-ui-support.test.ts`（含 plan apply + 真实 HTTP generate）与前端 RMP-1 protocol/helpers 测试全部在 256/148 内通过；RMP-1 主链路代码仅增加 kind 读取与 replan 分支，initial 行为不变。

### 偏差 / 已知风险 / 未验证

- 偏差 1：**范围变化校验的基线**取 `modulePlanApplied` 中该模块的 scope（RMP-1/RMP-2 应用时记录）；没有已应用规划（纯手工模块）时 scope 未知，前端/后端不因“范围不同”阻塞 keep/rename（空 scope 也视为“未指定/不变”），避免误报。已在 §10 记录。
- 偏差 2：replan preview 的**语义校验错误以 200 + `errors[]` 返回**（便于前端展示并继续编辑）；只有模型失败/JSON 不可解析返回 502。交接单原 §5.2 未列 `errors`，属向后兼容的超集。
- 偏差 3：apply 时 `regenerate`/`create` 且当前全部需求内容为空 → 409 fail-closed（不进入半应用状态），与 RMP-1 MF6 同口径；仅 keep/rename/归档时允许空内容 apply。
- 偏差 4：RMP-2 不做“刷新后恢复规划运行态”；若生成中关闭或刷新，结构已应用、文档可按模块重试/重新规划（弹窗重新打开会重新预览）。不在本批做全局恢复入口。
- 偏差 5：replan 后 `retry` 只允许 create/regenerate 模块（keep/rename 不生成）；RMP-1 的“重新生成全部模块”仅在 `planKind !== 'replan'`（initial/null）下显示（MF-RMP2-1）。
- 未验证：<768 移动端；真实模型“合并/归档”场景（split 已真实验证，merge/archive 由单测 + Playwright mock 覆盖）；Change Set 内重规划（明确不做）；真实生成取消/interrupt 实测（mock/单测覆盖）。
- 真实模型 E2E 观察：AI 预览可能把 scope 有微调的模块误标 `rename`（预览校验会拦截，用户可改 regenerate 或恢复 scope）；生成偶尔返回不可解析 DOC_JSON（售后首次），重试成功；属模型质量波动，UI 路径已验证。
- **真实 3300、真实 `data/`/`projects/`/`.env` 未触碰**；真实模型只在临时实例调用（临时应用已删除、临时服务已停止）；真实库当前有用户应用（未读写）。
- **注意**：真实 3300 后端进程仍是 RMP-2 之前的构建（本轮未启停）；`frontend/dist` 已更新。需用户确认后 `stop.cmd` → `start.cmd` 重启后端，才能使用 `/requirements-modules/replan/*` 接口。

### 主会话复核 must-fix（2026-11-16，已修并复验）

| # | 问题 | 修复 |
| --- | --- | --- |
| MF-RMP2-1 | RMP-1 旧建议卡的“重新生成全部模块”在 replan 后仍显示，点击会用 keep/rename 走 retry 被 400 | 后端 `GET /requirements-modules` 增加只读 `planKind`（`readAppliedModulePlan(appId)?.kind ?? null`）；前端 API/`RequirementsDocView.appliedPlanKind`/`DocChatPanel.plan-kind`/`ModulePlanCard.planKind` 透传，`canRegenerate` 要求 `planKind !== 'replan'`（initial/null 保持原行为） |
| MF-RMP2-2 | 首次模块规划未完成（空默认模块/首启建议卡 pending）时可打开“AI 规划模块” | `replanAvailable` 增加 `!planEligible`、`planState.status !== 'applying'`、`!planState.generation?.running`；`replanHint` 增加首次未完成/生成中提示 |
| MF-RMP2-3 | 结果页在取消后仅重试部分模块时误报“已生成 N 个” | 结果页改用 `generationSummary`：仅 `finished && done===total && failed===0 && cancelled===0 && !globalError && !state.cancelled` 才显示“已生成 N 个（草稿）”；否则显示“部分模块未完成…” |
| MF-RMP2-4 | preview 返回的服务端 `errors[]` 未展示 | 弹窗新增“服务端校验提示（可继续编辑）”区块（每条前缀“服务端：”），不进入客户端 errors/不阻塞；编辑后仍按客户端校验 + apply 后端 400 兜底 |
| 文案 | 设计/开发阶段应优先 Change Set；busy 文案不限于生成 | `replanHint` 与后端 `replanEligibility`：设计阶段“需求变更请发起‘需求+设计’变更（或先重新编辑需求回到需求阶段）”，开发/完成“请发起‘需求+设计’变更”；`beforeClose` busy 改为“正在处理或生成，请先取消或等待完成” |

复核验证：后端 **256/256**、前端 **148/148**、typecheck/build/check:vue 通过；Playwright **133/133 断言**（新增 MF-RMP2-1 旧卡 kind/重新生成按钮 7 项、MF-RMP2-2 首启门禁 2 项、MF-RMP2-3 部分完成/全部完成净增 4 项、MF-RMP2-4 服务端 errors + 编辑后应用 9 项；原 111 项全回归），0 console/page error、0 意外 API≥400、0 横向溢出；截图目录同上。

### 主会话真实模型 E2E（2026-11-16，通过）

环境：临时 backend 3454 + 独立 opencode 2.2.5（4799）+ 当前默认模型；临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`；真实 3300/data/projects 未触碰；不打印凭据。

| 项 | 实测 |
| --- | --- |
| 初始 | RMP-1 真实模型生成 **商品管理 v2（9318 字） / 订单管理 v2（7431 字）**，planKind=initial |
| 重规划指令 | “把订单管理拆成订单管理和售后管理，商品管理完全保持原样（标题、说明、范围都不变），商品明细仍归商品管理” |
| 预览 | **商品管理 keep / 订单管理 regenerate / 售后管理 create**；无 errors；archive 空；无 confirmed |
| 应用 | kept 商品管理、regenerated 订单管理、created 售后管理；无归档；apply 不生成文档 |
| 生成 | 订单管理 **v3 13/13、6 Story、8680 字**；售后管理首次模型输出不可解析 DOC_JSON → 重试 **v2 13/13、7 Story、9172 字**；商品管理 **v2 9318 字未变** |
| 最终 | `planKind=replan`、3 个未归档模块、应用保持 requirements；7/7 断言通过 |
| 清理 | 临时应用 DELETE 成功；临时 backend/opencode 已停止；真实库 apps=1（用户应用，未读写） |

- 第一次预览曾把“商品管理”的 scope 微调误标 `rename`，预览 `errors[]` 拦截；第二版明确“商品完全保持原样”后干净通过。说明预览校验/编辑路径有效；AI 动作标签存在波动。
- 售后首次生成不可解析、重试成功：生成的失败/重试路径真实有效；模型偶发输出质量波动。
- **注意**：真实 3300 后端仍是 RMP-2 之前构建，需用户确认后 `stop.cmd` → `start.cmd` 重启，才能使用 `/requirements-modules/replan/*`。用户真实应用/数据未触碰。

## D-RMP 完成（2026-11-16，主会话复核 must-fix MF-DRMP-1—5 已修 + 真实模型 E2E 通过）：设计阶段模块树 + 按 Epic 生成

交接单：`docs/plans/2026-11-16-design-epic-generation-brief.md`（§9 已回填）；设计稿：`docs/plans/2026-11-16-design-stage-module-epic-alignment-design.md`。范围：**只改设计阶段**（设计大纲树 + 按 Epic 生成 + merge/版本/确认重开 + 批量进度）；不改需求阶段/RMP-1/RMP-2/设计确认门禁/交接包/Change Set/U7；**无新表/列**、无旧设计数据迁移/兼容。

### 后端改动

| 文件 | 内容 |
| --- | --- |
| `backend/src/design/epic-context.ts`（新增） | `DesignEpicNode`；`findEpicNode`（Epic 优先；完全 fallback 用 SCENE，未归属 Story 归场景）；`epicRefsOf`；`pageSetBelongsToEpic`（Epic 用 epicId；fallback 用 epicId=null + sceneKey） |
| `backend/src/design/prompt.ts` | `buildEpicEntityGenerationPrompt`（只聚焦当前 Epic/Stories；复用已有实体、不删其它 Epic/未提及字段关系）；`buildEpicPageSetGenerationPrompt`（只输出一个页面集；storyIds 为本 Epic 全部 Story；页面绑定 mergedEntities）；`focusBrief` 支持 `focus.kind='epic'`（当前 Epic/Stories/相关实体/页面集/生成建议）；模块级 prompt 不变 |
| `backend/src/design/service.ts` | `mergeEntitiesForEpic`（id→name 匹配；字段 name/关系 name 合并；refs/sections 并集；未提及实体/字段/关系保留；更新项 draft）；`mergePageSetForEpic`（每 Epic primary=position 最小；保留 id 替换 title/storyIds/pages；其它页面集原样）；`epicGenerationImpact`；`generateEpicDesign`（两次模型调用→内存合并→校验→一次写入 + 一个 `ai` 版本；失败/空输出不写库；stale/项目 confirmed/out-of-scope/archived 守卫；目标 confirmed 需 `reopenConfirmed`，仅受影响项退回 draft；模型按名称误复用其它 Epic 已确认实体也需重开；模型异常 502） |
| `backend/src/design/routes.ts` | `POST /api/apps/:id/design/generate-epic`（`{epicId,moduleId?,reopenConfirmed?,model?}`；错误走 `appsErrorHandler`）；现有 `generate-entities`/`page-sets/generate` 保持整模块兜底 |
| `backend/src/design/types.ts` | `DesignEpicImpact`、`DesignEpicGenerationResult` |
| `backend/src/design/epic-generation.test.ts`（新增）+ `backend/package.json` | 12 项：merge 实体/页面集、prompt/focusBrief/fallback、生成结果与版本/draft、primary 保留、失败不写库/不产版本、confirmed 409/重开、误复用其它 Epic 已确认实体 409/重开、draft 页面集内已确认 page / 仅页面绑定实体 409/重开、守卫（项目 confirmed/stale/归档/未知 Epic/缺 epicId）、fallback SCENE、HTTP 成功/400/409 + 旧接口回归 |

### 前端改动

| 文件 | 内容 |
| --- | --- |
| `frontend/src/design/design-epic-helpers.js`（新增）`.test.mjs` | Epic 节点/refs、实体/页面集过滤、primary、状态（未生成/草稿/已确认/需同步，**Epic 自身确认不再依赖模块项目状态**）、Story 覆盖、缺图、Outline（数据集/未归属，**页面绑定的共享实体也算相关**）、默认批量选择、受影响 confirmed（**含 draft 页面集内已确认 page、仅页面绑定实体**）、批量状态机（创建/推进/停止/重试/汇总）；7 项单测 |
| `frontend/src/design/DesignOutlineTree.vue`（新增） | 模块根（状态/版本/缺图/必选/本次变更/本次未包含）+ 当前模块手风琴展开：数据集（共享实体）、Epics（页面集/页面/Story 覆盖/缺图/状态/生成此 Epic、展开页面集与相关实体）、未归属 Epic/场景；设计总览/原型模板入口；`data-testid` 覆盖；260/220、≤1024 抽屉、≤768 单栏、内部滚动 |
| `frontend/src/design/DesignEpicGenerationProgress.vue`（新增） | 批量进度条：Epic/状态（等待/生成中/成功/失败/跳过）/实体+页面计数/重开数/失败原因、停止剩余、重试失败、重试单个、关闭；token/深浅色/窄屏 |
| `frontend/src/design/DesignStudio.vue` | 删除 `DesignModuleRail`，画布内改“设计大纲 + Tabs”；`selectedEpicId` 与对话 `focus=epic`；树点实体/页面集切 Tab 并选中；Epic 过滤 chip 清除；单 Epic/批量确认弹窗（勾选 Epic、受影响 confirmed 列表、`允许重新打开已确认项`、页面集替换说明）；生成中禁止切模块；生成成功同步 `project`/模块摘要/交接包摘要，选中第一个成功 Epic；顶栏“模块”改“大纲”；大纲抽屉/遮罩/Esc |
| `frontend/src/design/EntityDesignTab.vue` | `focusEpicId/title/refs` 过滤（仅显示列表/ER；保存始终用完整 `draft`）；过滤 chip + 清除；过滤状态保存单测由 Playwright 覆盖；整模块 AI 收进“更多 → 整模块生成实体（兜底）”；被动选中不覆盖 Epic 对话焦点 |
| `frontend/src/design/PrototypeTab.vue` | `focusEpicId/title/refs/isScene` 过滤页面集（epicId/storyIds；保存仍用完整集合）；过滤 chip + 清除；暴露 `selectSetById`；按场景/AI 生成收进“更多（整模块兜底）”；被动选中不覆盖 Epic 对话焦点 |
| `frontend/src/design/DesignChatPanel.vue` | focus 类型加 `epic`；Epic 标题标签；聚焦 Epic 时新增快捷提示与“按 Epic 补全设计”下一步 |
| `frontend/src/design/api.ts`、`types.ts` | `generateDesignEpic`；`DesignEpicGenerationResult`；流式对话 focus 类型加 `epic`；`DesignChatMessage.focusKind` 加 `epic` |
| `frontend/src/design/DesignModuleRail.vue` | **删除**（grep 零引用后） |

### 验证（实际数字）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **268/268 通过**（基线 256 + 新增 12） |
| `npm test --prefix frontend` | **155/155 通过**（基线 148 + 新增 7） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | OK（全 SFC 导入完整） |

- Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 端口 3431、真实临时 backend + stub `opencode.generateText`，**不调真实模型**）：**138/138 断言通过**，0 console error / 0 pageerror / 0 意外 API≥400（仅“故意模型失败/保存失败”窗口的 502/500 被排除）/ 0 横向溢出。
- 覆盖：无模块 rail；2 模块根/只手风琴展开；Epic 过滤 chip/对话 focus/清除/再次选中；批量失败继续→重试失败→停止剩余（跳过）；结果 draft/每 Epic 一个版本/实体共享池/页面按 Story/Story 覆盖；过滤下保存仍提交完整实体集合；树点实体/页面集切 Tab 选中；切模块 flush 改名持久化；单 Epic 重生成保留 primary 页面集 id、其它 Epic 保留；全确认后无 `reopenConfirmed` 禁止、勾选后仅目标退回 draft/其它 confirmed 保留；整模块实体/页面集兜底仍可用；stale/项目已确认/变更外守卫与原因提示；交接包弹窗回归；1440/1280/1024/768 × 浅/深截图（大纲抽屉）。
- 复核 must-fix 场景（详见下节）：编辑实体/页面规格后立即生成先保存且内容不丢、保存失败不发起生成/对话框保留错误、生成中冻结编辑与确认/模板/刷新/交接包/同步、draft 页面集内已确认 page + 仅页面绑定实体纳入重开、Epic 自身全确认但模块 draft 显示已确认、仅页面绑定实体进入过滤/相关实体。
- 截图（临时目录，未提交）：`C:\Users\icecream\AppData\Local\Temp\drmp-pw-1794824297773\screens`（14 张：`a-tree-1440-light`、`b-batch-1440-light`、`c-design-{1440,1280,1024,768}-{light,dark}`、`c-outline-{1024,768}-{light,dark}`）。
- 真实 3300 / 真实 `data/`/`projects/`/`.env` 未触碰；未调真实模型；真实库用户应用未读写。

### 复核 must-fix（2026-11-16，主会话发现，已修并复验）

| # | 问题 | 修复 |
| --- | --- | --- |
| MF-DRMP-1 | 生成前未 flush 手动编辑，生成返回的 project 覆盖 draft | `submitEpicGeneration` 先 `flushAll()`：失败 → 不关闭对话框、不开始生成、`epicError` 提示且 `epicDialogBusy` 复位；`EntityDesignTab`/`PrototypeTab` 的 `flushSave` 改为失败抛错并等待在途保存（超时抛错）。Playwright：编辑实体/页面规格后立即生成 → `PUT → POST generate` 顺序且内容保留；注入 500 → 不发起生成、对话框仍开、错误可见、未写库 |
| MF-DRMP-2 | 生成中仍可编辑/确认/切换模板/刷新/交接包/同步，与逐 Epic 写入冲突 | 新增 `pageReadonly = readonly \|\| epicRunning` 传给实体/原型/对话；头部确认设计/重新编辑设计/重新同步需求/刷新/交接包禁用；`onPrimaryAction`/`reopenDesign`/`editRequirements`/`openHandoff`/`openTemplateSwitch`/`openSync`/`confirmDesign`/`upgradeScope`/`refreshDesign` 加生成中 guard；大纲原型模板入口禁用并提示；生成结束恢复。Playwright：运行中控件 disabled、未触发确认请求；结束/停止后恢复 |
| MF-DRMP-3 | draft 页面集内已确认 page 未纳入重开，生成会静默覆盖 | 后端 `epicGenerationImpact` 与前端 `affectedConfirmedForEpic` 的 `pages` 改为 primary 存在即列出所有 confirmed page（不再要求页面集 confirmed）；`pageSets` 仍只列 confirmed。单测 + Playwright 覆盖：draft 页面集 + 已确认 page → 提示/409；勾选后仅实际被替换项重开，其它 confirmed 保留 |
| MF-DRMP-4 | Epic 自身已确认但模块仍 draft 时显示草稿 | `epicStatsOf` 的 confirmed 只由本 Epic primary 页面集/页面/相关实体 confirmed 决定（stale 优先）；模块根仍用模块项目状态。单测（draft/confirmed/stale）+ Playwright UI 断言 |
| MF-DRMP-5 | 共享实体仅被页面绑定、无 Epic refs 时过滤/确认提示漏 | 前端 `epicStatsOf` 相关实体 = refs 命中 ∪ 本 Epic 匹配页面集的 `page.entityId`；`epicOutlineOf`/树相关实体同步；`EntityDesignTab` 新增 `focusEpicEntityIds` 过滤；后端 impact 实体 = refs 命中 ∪ primary 页面绑定。单测 + Playwright（仅绑定实体出现在过滤/相关实体与确认提示） |

### 主会话真实模型 E2E（2026-11-16，通过）

环境：临时 backend 3456 + 独立 opencode 2.2.5（4801）+ 当前默认模型；临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`；真实 3300/data/projects 未触碰；不打印凭据。

| 项 | 实测 |
| --- | --- |
| 需求 | RMP-1 真实模型生成商品管理/订单管理 v2；逐模块确认 + bundle confirm → 应用进入 **design** |
| 设计输入 | 商品：EPIC-001 商品档案维护（4 Story）、EPIC-002 商品明细维护（4）；订单：EPIC-003/004/005（3/2/2） |
| 商品按 Epic | EPIC-001 → +2 实体/4 页；EPIC-002 → +0 新实体/~1 更新/4 页；最终 **v3、2 实体、2 页面集、8 页**；EPIC-001 页面集保留 |
| 订单按 Epic | EPIC-003 → +2 实体/5 页；**v2、2 实体、1 页面集、5 页** |
| 隔离/状态 | 两模块实体/页面集不串；每 Epic 生成页面集（epicId）；所有生成实体/页面集/页面 draft；页面 requirementRefs 非空 |
| 断言 | **15/15 通过** |
| 清理 | 临时应用 DELETE 成功；临时 backend/opencode 已停止；真实库 apps=1（用户应用，未读写） |

- 真实 E2E 未覆盖：真实模型 confirmed 项目/页面集重开、stop/retry 实机、merge/归档；这些由后端单测 + Playwright mock 覆盖。
- **注意**：真实 3300 后端仍是 D-RMP 之前构建，需用户确认后 `stop.cmd` → `start.cmd` 重启，才能使用 `/design/generate-epic` 与新版设计页。（**已过期**：2026-11-17 08:55 用户已重建 dist 并重启，见文末「2026-11-17 真实实例更新 + 新设计阶段全流程实机验收」）

### 偏差 / 已知风险 / 未验证

- 偏差 1：`EntityDesignTab`/`PrototypeTab` 过滤 props 用 `focusEpicId` + `focusEpicTitle` + `focusEpicRefs`（+`focusEpicIsScene`；实体侧另有 `focusEpicEntityIds`），而非单传 `focusEpicId`——过滤需要本 Epic 的 Story 引用与页面绑定实体；保存语义仍按交接单（完整集合）。
- 偏差 2：`mergeRelationsForEpic` 优先按关系 `name` 合并（同名覆盖）；仅在重名关系时用 `name|target` 区分。原因：已有关系 target 是实体 id、模型输出多为实体 name，按 `name+target` 会重复；已在代码注释说明。
- 偏差 3：新增可选 `options.generator`（service 层）用于单测注入模型输出（HTTP 层仍 stub `opencode.generateText`）；生产路由不暴露 generator。
- 偏差 4：模型调用失败/异常统一映射为 502（`AI 生成实体失败/页面集失败`），未新增 SSE/后台队列。
- 已知：批量生成中会冻结编辑/确认/模板/刷新/交接包/同步等写操作（查看、停止剩余、进度可用），结束后恢复；刷新不保留运行态（设计数据已写库，可重新生成/重试）；fallback 场景节点仅当设计输入完全没有 Epic 时可用（避免 SCENE 被当成 EPIC 替代）。
- 未验证：<768 移动端；变更单内选择部分模块批量生成的完整 UI 路径（后端 out-of-scope 守卫与 Playwright 只读阻止已覆盖）；真实模型 confirmed 重开/stop-retry/merge 归档（单测 + Playwright mock 覆盖）。真实模型按 Epic 生成已在上方 E2E 通过。
- **真实 3300 后端进程仍是 D-RMP 之前的构建**；需用户确认后 `stop.cmd` → `start.cmd` 重启才能使用 `/design/generate-epic` 与新版设计页。真实库 apps=1（用户应用）未读写。（**已过期**：2026-11-17 已重启，见文末）

## 2026-11-17 真实实例更新 + 新设计阶段全流程实机验收（用户执行）

**只读核对（主会话，2026-11-17）**：

- 真实 3300 **正在监听**（PID 40516，启动 `2026-11-17 08:55:52`）。
- `backend/dist/index.js` mtime **2026-11-17 08:55:43**；`frontend/dist/index.html` **08:55:52**。即用户在重启前重新构建了两端。
- dist 内已含新路由：`dist/design/routes.js` → `generate-epic`；`dist/requirements/routes.js` → `replan/preview`、`plan/apply`。
- `backend/src`、`frontend/src` 无晚于 dist 的文件 → 构建与源码一致，无未落盘改动。
- 因此 RMP-1 / RMP-2 / D-RMP 段中"真实 3300 仍是旧构建、需重启"的提示**已失效**（历史记录保留并标注）。

**实机验收（用户自述）**：

- 用户在新构建的真实实例上跑完**新设计阶段全流程**（需求模块规划/确认 → 设计大纲树 → 按 Epic 生成），**未发现问题**；用户确认没有需要记录的遗留小问题。
- 本轮**未**在真实实例复验：应用级交接包生成、开发阶段（U7 阶段条/会话）、Change Set #2+；也未用真实模型重跑全链路 E2E。这些沿用 2026-11-16 的临时实例验证结论。
- 主会话未启停实例、未读写真实 `data/`/`projects/`/`.env`，未调用真实模型。

**基线不变**：后端 268/268、前端 155/155、`typecheck`/`build`/`check:vue` 通过；D-RMP Playwright mock 138/138；真实模型 E2E RMP-1 8/8、RMP-2 7/7、D-RMP 15/15。本轮为文档更新，未改代码、未跑测试。

## M7 完成（2026-11-17，待评审）：需求阶段只读原型预览（模块节点 + Epic/Story 派生 + 骨架线框）

上游：`docs/plans/2026-11-17-m7-requirements-prototype-preview-design.md`（§0 决策/§2 派生/§3 API/§4 UI/§6 测试）、`docs/plans/2026-11-17-m7-implementation-brief.md`（§8 已回填）。**只做 M7（#8）**：需求大纲树每模块「原型预览」节点 + 只读骨架面板；Epic→页面集、Story→页面确定性派生。

### 范围与口径（沿用用户决策，未改）

- 节点在模块展开列表**最后**（模板章节之后）；**不做**导出/打印；页面 chips **不显示** Story 摘要（仅 tooltip）；**不做**"全部模块"聚合视图；线框为**纯骨架**，不合成任何真实字段名。
- 完全只读：不建模块/文档/版本、不建设计项目/实体/页面集/页面、不产 PNG/文件、不调模型/SSE；请求前后所有 app 级表行数与 `projects/<app>/prototypes/` 均已断言不变。

### 改动文件

| 端 | 文件 | 改动 |
| --- | --- | --- |
| 后端 | `src/requirements/prototype-preview.ts`（新） | `inferPreviewPageType`（§2.3 关键词表顺序首个命中，空标题→list）；`buildRequirementPrototypePreview`（模块解析、归档过滤、未归属 Story 虚拟页面集、warning、stats、模板只返回 tokens/shell/patterns/pageSetRules+source） |
| 后端 | `src/requirements/doc.ts` | 新增只读 `readRequirementDocIfExists(appId, moduleId)`（无文档 → `{doc:null, sections:[]}`；不调 `ensureRequirementDoc`） |
| 后端 | `src/requirements/routes.ts` | 新增 `requirementPrototypeRoutes` GET `/`（复用 `requireApp`/`route`/`requirementErrorHandler`，`Cache-Control: no-store`） |
| 后端 | `src/apps/routes.ts` | 挂载 `apps.use('/:id/requirements-prototype', ...)` |
| 后端 | `src/requirements/prototype-preview.test.ts`（新）+ `package.json` | 12 项：派生/顺序/归档/未归属/空标题/摘要截断/无文档/0 模块/404/归档可读/模板三档与删除回退/只读行数/HTTP 200·404 |
| 前端 | `src/requirements/prototype-helpers.js` + `.test.mjs`（新）+ `package.json` | `pageSetsOf/pagesOf/typeLabel/pageTitleOf/findPageSet/findPage/ensureSelection/emptyReason/fitScale/warningText/statsLabel/templateSourceLabel`；8 项单测 |
| 前端 | `src/requirements/PrototypeSkeleton.vue`（新） | 8 种骨架（`.pv-sk-*`）：list（`defaultSearchFields`/`defaultPageSize`/rowActions/pagination/selection）、form（`labelPosition`/groups）、detail（sections/relatedLists）、dashboard、kanban、calendar、gantt、custom；底部固定「粗略预览 · 字段与交互在设计阶段按实体生成」 |
| 前端 | `src/requirements/RequirementsPrototypePreview.vue`（新） | 头部（模块/模板来源徽标/vN/统计/刷新/查看文档）+ 说明条 + warning chips + 页面集/页面 chips + `.proto-skin` 画布（侧栏=页面集/顶栏=页面类型/白纸=骨架）+ ResizeObserver `fitScale`（0.5—1，画布内部滚动）+ loading/error/empty + AbortController 请求；只 import `design-skin.css`/`prototype/wireframe.css` |
| 前端 | `src/requirements/api.ts` | `RequirementsPrototypePreview` 等类型 + `getRequirementsPrototype(appId, moduleId?, signal?)` |
| 前端 | `src/requirements/RequirementOutlineTree.vue` | 每模块（含归档）章节列表末尾「原型预览」节点（`data-testid="outline-prototype-<moduleId>"` + `aria-current` + 骨架 tag）+ prop `prototypeModuleId` + emit `prototype` |
| 前端 | `src/requirements/RequirementsDocView.vue` | `view:'doc'|'prototype'`；预览下隐藏 mode-tabs/模板中心/版本/导出 `.md`/AI 规划模块，显示「原型预览」chip +「返回文档」，保留确认/完成需求；章节点击/切模块回文档；`refreshKey=doc.updatedAt|doc.version|maxSectionUpdatedAt|手动刷新序号`；切模块 flush 失败保持原状；滚动高亮在预览下停用 |

未新增表/列/迁移/依赖；未改 `frontend/src/design/` 任何既有文件；未改设计阶段、交接包、Change Set、U7、阶段门禁。

### 验证（命令/实际数字）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过（**重新生成了 `backend/dist`；真实 3300 进程未重启，新端点待用户重启后生效**） |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | ✅ **280/280**（基线 268 + 新增 12） |
| `npm test --prefix frontend` | ✅ **163/163**（基线 155 + 新增 8） |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `npm run check:vue --prefix frontend` | ✅ 全部 SFC 导入完整 |
| `smoke:requirements` | ✅ 需求文档冒烟通过 |
| `smoke:modules` | ✅ 需求模块冒烟通过 |
| `smoke:design` | ✅ 设计阶段冒烟通过 |
| `smoke:design-handoff` | ✅ 设计→开发交接包冒烟通过 |
| `smoke:change-set` | ✅ C1 变更循环冒烟通过 |
| Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 端口 3440/4440 + `OPENCODE_AUTO_START=false` + stub `opencode.generateText` 直接抛错） | ✅ **70/70 断言**，8 张截图（1440/1280/1024/768 × 浅/深），0 console error / 0 pageerror / 0 意外 API≥400 / 0 页面级横向溢出 |

Playwright 覆盖（对应设计稿 §6 前端 1—8）：
- 每模块「原型预览」节点、点击切模块、节点 `aria-current`、预览下 mode-tabs/模板中心/版本/导出/AI 规划隐藏、「原型预览」chip +「返回文档」。
- 模块 A 2 页面集（EPIC-001/2 页、EPIC-002/3 页）与 5 个 Story 标题一致；类型标签 表单/列表/仪表盘/详情/看板 正确。
- 骨架随页面类型切换（form→list→dashboard→detail→kanban）；含「粗略预览」；断言预览文本**不含**真实字段名「商品名称/价格/库存」。
- 模板来源三档：应用默认（简洁后台 skin-minimal）→ 设计项目模板（enterprise 覆盖）→ 全局默认；应用默认指向已删除私有模板 → 回退全局默认（不 500）。
- 模块 B（订单管理）1 页面集/2 页面；模块切换与高亮互斥。
- 只读网络断言：预览期间所有 `/api/` 请求均为 **GET**（0 PUT/POST）。
- 空态：无 Epics 模块 → 空态 + 「去补充需求」→ 回到章节编辑并高亮定位 `epics`。
- 刷新：Story 标题在章节编辑器保存后进入预览即为最新；外部保存后「刷新」拉到最新标题。
- 章节点击退出预览：回到章节编辑（mode-tabs 恢复、章节卡片渲染）。
- 响应式/主题：1440/1280/1024/768 × 浅/深 无页面级横向溢出，预览面板均可见。

临时产物（未提交）：脚本 `C:\Users\icecream\AppData\Local\Temp\opencode\m7-pw\`（`harness.mts`、`run.mjs`、`summary.json`、`run.log`）；本轮最后一次结果与截图在 `C:\Users\icecream\AppData\Local\Temp\m7-pw-2026-11-17T01-27-37\`（`screens/` 8 张 + `data/`、`projects/`）。

### 偏差 / 说明

1. `readRequirementDocIfExists` 通过 `moduleById`（只读 SELECT）取 `module_key`，避免 `ensureRequirementDoc` 的懒创建。
2. `summary` 截断 160 字后加 `…`（最长 161 字符）；只在 tooltip 展示，页面 chips 不显示摘要。
3. 空标题 Story 原样保留 `title=''`（后端 `story-without-title` warning），前端展示兜底「未命名 Story」；类型按兜底 list。
4. `ensureSelection`：页面集 key 不存在 → 回退第一页面集；若原页面 key 恰在新集合则保留，否则回退新集合第一页（集合无页面 → `pageKey=''`，画布显示“该页面集还没有 Story”）。
5. 手动刷新由父组件递增 `prototypeNonce` 并入 `refreshKey`（组件内不重复发请求）；刷新前 best-effort `flushAll()`。
6. 预览下隐藏新手引导，但「变更范围/只读/已确认/已归档」横幅按设计保留在预览面板上方。
7. ≥1024 时左侧 AI 对话栏保持可见（设计只要求大纲保留作为模块入口），预览面板占 `.doc-scroll` 剩余空间并内部滚动。
8. 后端 `npm run build` 已重写 `backend/dist`；**未重启真实 3300**，运行中的进程仍是旧内存代码，`GET /api/apps/:id/requirements-prototype` 在重启后才可用。
9. stub 模型下未触发任何 AI 调用；Playwright 的“外部保存”用 Node fetch 直接调 API，不计入页面只读网络断言。
10. `custom` 页面类型当前不会由关键词推断产生（设计稿 §2.3 无 custom 关键词），骨架组件仍支持，便于后续人工覆盖。

### 未验证

- <768 移动端（沿用既有范围）。
- 归档模块的「原型预览」节点/只读查看、已确认/变更外只读横幅下的预览未在 Playwright 专项覆盖（后端 200/归档可读有单测，节点与文档共用现有渲染逻辑）。
- 真实 3300 / 真实 `data/` / `projects/` / `.env` **未触碰**；未调真实模型、未启 SSE；未重启/停止真实实例（3300 仍在监听，PID 40516）。
- 真实库 `data/requirements.db` mtime 保持 2026-11-16 15:54:37（本批无写入）；本批未修改需求/设计/交接包/Change Set/U7 既有链路，相关真实数据未复核。

### 主会话评审（2026-11-17，独立复核通过，无 must-fix）

- 独立复跑（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`）：后端 **280/280**、前端 **163/163**、`typecheck`/`build`/`check:vue` 通过（评审期间再次执行 `build`，`dist` 与源码一致）。
- 独立 Playwright（**主会话自写脚本**，未复用实施脚本；临时数据目录 + 端口 3451 + `OPENCODE_AUTO_START=false` + stub 模型抛错）：**80/80 断言**、8 张截图（1440/1280/1024/768 × 浅/深）、0 console error / 0 pageerror；端口已释放。临时目录（未提交）：`C:\Users\icecream\AppData\Local\Temp\m7-review-2026-11-17T01-35-07\`。
- 独立覆盖（构造与实施脚本不同）：0 模块应用请求预览 → `module:null` + `no-module` 且 `app_modules` 行数不变（未懒创建）；3 Epic / 8 Story（含空 Epic、`epicId=null` 未归属）→ 4 页面集、页数与顺序；并列关键词优先级（`查询商品详情`→detail、`统计报表`→dashboard）与 8 类推断；`stats` 与 warning；连续多次预览后 **17 张表行数与 `projects/<app>/` 目录树完全不变**；未知模块/应用 404；模板 `app-default` → `design-project` 覆盖；UI 入口/隐藏 mode-tabs/chips 数量/骨架类型（form、dashboard）/纸面不含 Story 标题/模板徽标；预览期间全部 API 为 GET；文档保存后预览自动重新拉取；外部改名 + 手动刷新可见；空模块空态 →「去补充需求」回章节编辑并可见 `epics` 节点；4 档宽度 × 深浅色 0 页面级横向溢出。
- 结论：**通过，无 must-fix**。
- 非阻塞观察：① 画布缩放 0.5—1，1440 下纸面约 0.5、白纸留白偏多（后续可加 100%/横向滚动或高度自适应）；② 预览头部重复展示模块名/`MOD-xxx`（文档头已有），纯装饰；③ 前端 `PAGE_TYPE_LABELS` 与设计阶段标签表重复，可后续抽公共；④ 模块 id 是 UUID、`MOD-001` 是 `module_key`（写脚本/排查时注意）。
- 运行态：评审期间重新执行了后端/前端 `build`，`backend/dist`、`frontend/dist` 已含 M7；**真实 3300 进程仍运行旧内存代码**，需用户确认后 `stop.cmd` → `start.cmd` 重启，才能使用 `GET /api/apps/:id/requirements-prototype` 与新前端（真实 `data/`/`projects/` 未读写）。

## M7-2 完成（2026-11-17，待评审）：需求阶段 AI 参考原型（PRD → 预览规格 → 真实字段渲染）

上游：`docs/plans/2026-11-17-m7-2-ai-prototype-spec-design.md`（§0 决策/§2 数据模型/§3 生成/§4 接口/§5 渲染/§6 UI/§8 测试）、`docs/plans/2026-11-17-m7-2-implementation-brief.md`（§8 已回填）。用户反馈 M7 纯骨架“看不出实际意义、没有评审价值”，要求按已确认实体/字段生成；并明确**需求阶段原型预览不作为设计阶段页面集来源**。**只做 M7-2**：M7 大纲入口/模板解析/Epic 范围统计沿用，呈现从“骨架”替换为 AI 视图。

### 范围与口径

- 显式「生成原型参考 / 重新生成」：从模块 PRD（章节 + 活跃 Epic/Story + 模板形态 + 应用名）生成预览规格（实体/字段/页面），用设计阶段 `PrototypeRenderer` + `mockRows(...,8)` 渲染真实字段与示例数据。
- **唯一写入 = `app_settings` 的 `app.<appId>.requirementsPrototype.<moduleId>`**；不写需求文档/章节/版本/bundle、设计项目/实体/页面集/页面/版本、交接包/Change Set/阶段/会话/PNG。测试断言其它 app 表行数、settings 键集合与 `projects/` 目录树不变（失败/取消不覆盖旧规格）。
- 过期：规格存 `base.docVersion/docUpdatedAt`；与当前文档不一致 → `specState.status='stale'` + 黄条（可继续看旧规格），重新生成后消失。
- 覆盖度：沿用 M7 确定性 Story 列表，统计页面 `storyIds` 覆盖（GET 返回 `coverage{stories,coveredStories,uncoveredStoryIds}`）。

### 改动文件

| 端 | 文件 | 改动 |
| --- | --- | --- |
| 后端 | `src/requirements/prototype-spec.ts`（新） | 输入聚合（单章节 6KB/总量 40KB + note）、`buildPrototypeSpecPrompt`（`<<<PREVIEW_SPEC_JSON>>>` + 规则）、`parsePrototypeSpecOutput`（代码块/尾逗号/噪声容错；实体/字段去重合并；type 白名单；enum 无 options / ref 悬空 → string + note；epicId/storyIds/entity/fields 过滤；上限 entities 30/fields 40/pages 80/actions 8/options 20；字符串 200/note 300；`PE-n`/`PP-n`；label→稳定 ASCII `name`；空实体/空页面 502）、`readStoredPrototypeSpec`/`specStateOf`/`coverageOf`/`buildPrototypeSpecView`、`generatePrototypeSpec`（应用/模块 404、归档/无文档/空文档/并发 409、`res` 断开 abort、失败 502/取消 499、成功才写 settings）、`setPrototypeSpecGeneratorForTests`（仅测试） |
| 后端 | `src/requirements/routes.ts` | GET 增量 `spec/specState`（M7 字段不变）；新增 `POST /spec`（`res.on('close')` + `writableEnded` 守卫，禁止 `req.on('close')`） |
| 后端 | `src/requirements/prototype-spec.test.ts`（新）+ `package.json` | 15 项：输入/prompt 不读设计数据、截断/note、解析容错与 502、归一化全量、空实体/空页面/模型异常/取消、守卫、并发、唯一写入与失败不覆盖、`readStored` 容错、coverage/state 边界、GET 三态、HTTP GET/POST 200·404·409·502、真实 HTTP 断开 abort + 锁释放、归档 GET 200 / 未知 404 |
| 前端 | `src/requirements/prototype-spec-helpers.js` + `.test.mjs`（新）+ `package.json` | `toSpecEntity`（decimal→number、ref target、enum options、status draft）、`toSpecPage`、`groupPagesByEpic`（按 M7 页面集顺序；无 epicId/未知 epic →「其他页面」最后；空 Epic 保留）、`ensureSpecSelection`、统计/覆盖/状态/空态/时间文案；10 项单测 |
| 前端 | `src/requirements/api.ts` | 预览规格/状态/覆盖度类型；`RequirementsPrototypePreview.spec/specState`；`generateRequirementsPrototypeSpec(appId, moduleId?, signal?)`（POST） |
| 前端 | `src/requirements/RequirementsPrototypePreview.vue`（重写） | 空态（范围统计 + 生成）、生成占位/取消、成功渲染（列表/表单/详情/看板等按页面类型）、顶部模型/时间/基vN/统计/覆盖度、notes 折叠、重新生成二次确认、stale 黄条、错误卡 + 重试、归档禁用 + 提示、常驻「AI 参考原型 · 仅用于需求评审，不进入设计阶段/交接包」、Epic chips + 页面 chips + 「其他页面」、白纸缩放/响应式；`data-testid` 覆盖生成/重生成/空态/生成中/错误/stale/归档 |
| 前端 | `src/requirements/PrototypeSkeleton.vue`（删除） | grep 零引用后删除（M7 骨架不再使用） |
| 前端 | `src/requirements/prototype-helpers.js` + `.test.mjs` | 只保留仍在用的 `PAGE_TYPE_LABELS`/`TEMPLATE_SOURCE_LABELS`/`typeLabel`/`templateSourceLabel`/`fitScale`/`warningText`；测试 8→3 |
| 前端 | `src/requirements/RequirementOutlineTree.vue`、`RequirementsDocView.vue` | 原型节点 tag「骨架」→「AI」，tooltip/注释改为 AI 参考原型；入口/切换/flush/只读语义不变 |

未新增表/列/迁移/依赖；未改 `frontend/src/design/` 既有文件（仅 import `design-skin.css`/`wireframe.css`/`PrototypeRenderer`/`mockRows`/类型）；未改设计阶段/交接包/Change Set/U7/阶段门禁。

### 验证（命令/实际数字）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过（重写 `backend/dist`；**未重启真实 3300**） |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | ✅ **295/295**（基线 280 + 新增 15） |
| `npm test --prefix frontend` | ✅ **165/165**（新增 10 项 spec-helpers；prototype-helpers 8→3，净 +2） |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `npm run check:vue --prefix frontend` | ✅ 全部 SFC 导入完整 |
| `smoke:requirements` / `smoke:modules` / `smoke:design` / `smoke:design-handoff` / `smoke:change-set` | ✅ 全部通过（各自临时目录/端口） |
| Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 端口 3442/4442 + `OPENCODE_AUTO_START=false` + harness 固定 spec，生产构建由后端托管） | ✅ **71/71 断言**，9 张截图（1440/1280/1024/768 × 浅/深 + 归档），0 console error / 0 pageerror / 0 意外 API≥400 / 0 页面级横向溢出 |

Playwright 覆盖：
- 空态（说明 + 范围 `2 Epic · 3 Story · 3 页` + `Story 覆盖 —` + 模板徽标 + 常驻声明）→ 生成 → **仅 1 次 POST**；
- 真实字段：列表列（商品编码/商品名称/商品状态）、表单（商品编码/商品分类）、详情、订单列表（订单号/订单金额）；页面集/页面 chips 与「其他页面」；
- 顶部信息：模型 `packycode-deepseek/deepseek-flash`、生成时间、`基v1`、`3 实体 · 8 字段 · 4 页面`、`Story 覆盖 2/3`；
- 重新生成二次确认（取消 → 不发请求；确认 → 统计更新为 9 字段/5 页面、覆盖 3/3、新页面出现）；
- stale：API 改文档 → 刷新 → 黄条 + 旧规格仍可见 → 重新生成后消失；
- 失败：stub 抛错 → 502 错误卡且旧规格未覆盖 → 重试成功；
- 生成中：按钮禁用、重复点击不发第二次请求、取消后旧规格保留；
- 归档模块：提示可见、重新生成禁用、后端 POST 409；GET 仍可读；
- 渲染/切页无写请求（仅生成 1 次 POST）；4 档宽度 × 浅/深无横向溢出。

临时产物（未提交）：脚本 `C:\Users\icecream\AppData\Local\Temp\opencode\m72-pw\`（`harness.mts`、`review.mjs`）；最后一次结果/截图：`C:\Users\icecream\AppData\Local\Temp\opencode\m72-e2e-2026-11-17T02-09-36\`（`summary.json` + `screens/` 9 张）。

### 偏差 / 说明

1. 「无分隔符但为合法 JSON」按容错接受（与 `module-generation`/`module-replan` 同口径）；只有不可解析才 502。
2. 增加 `entities` 为空 → 502「模型没有产出可预览的实体，请重试」（设计稿 §2 约束 entities 1—30）；`pages` 为空仍 502。
3. 测试注入：service 层 `options.generator` + 模块级 `setPrototypeSpecGeneratorForTests`（生产路由不暴露）；HTTP 单测/Playwright 用后者。
4. stale 横幅的「重新生成」与成功态按钮共用二次确认（有旧规格时统一确认覆盖）。
5. 顶部第二行展示模型/时间/基vN/统计/覆盖度；notes 折叠展示（含截断/降级/待确认说明）。
6. `ref` 目标按实体名称解析为本模块 `PE-n`；模型未按契约给 `target` 时接受 `target/ref/entity` 作为实体名。
7. 渲染器 `moduleId='requirements-preview'`、`readonly`、`notes=[]`、`layout=undefined`、`pages=[]`；不触发批注/跳转。
8. `groupPagesByEpic` 无 spec 返回空；spec 存在但无页面不会出现（后端已 502）。

### 未验证

- 真实模型 E2E（按交接单由主会话另跑临时应用）；真实 PRD 的字段抽取质量/耗时未在本批验证。
- `<768` 移动端（沿用既有范围）；多实例部署的并发锁（本批为进程内 Map）。
- 真实 3300 / 真实 `data/` / `projects/` / `.env` **未触碰**（smoke/Playwright 全部临时目录；未调真实模型；唯一写入为临时库的 `app_settings`）。本轮 `build` 重写了 `backend/dist`、`frontend/dist`；真实 3300 进程仍是旧内存代码，需用户确认后 `stop.cmd` → `start.cmd` 才能使用 `POST /requirements-prototype/spec`。

### 主会话评审（2026-11-17，独立复核通过，无 must-fix）

- 独立复跑（临时目录）：后端 **295/295**、前端 **165/165**、`typecheck`/`build`/`check:vue` 通过（评审期间再次 `build`，`dist` 与源码一致）。
- 独立 Playwright + API（**主会话自写脚本**，端口 3452，stub 生成器由控制文件驱动，未复用实施脚本）：**72 项断言，仅 1 项为脚本自身预期偏差**——"故意失败"用例产生的 `502` 资源错误被计入 console error（属预期，非产品缺陷）；其余全部通过、0 pageerror。
- 独立覆盖：GET 未生成 → `spec:null` + `status:missing` + `coverage 3/0`，且 M7 的 `pageSets` 仍返回（2）；生成后归一化正确（非法 type `photo`→`string`、`ref`→`PE-n`、未知页面字段丢弃、未知 epic/实体 → null、notes 保留、`stats 2/8/4`、`base.docVersion=1`、`coverage 1/3`）；**只写 `app_settings`**（其余 17 张表与 `projects/<app>/` 目录树不变）；实际 prompt 含需求字段文本 / 真实 `EPIC-001`/`STORY-001` / 模板名 / 输出分隔符；改文档 → `stale` + 旧规格仍可读；stub 抛错 → 502 且旧规格未被覆盖；并发 → 200/409 且最终为后一次规格；归档模块 POST 409（文案含"归档"）而 GET 200；空文档 409；未知模块/应用 404。
- 独立 UI：`ready` 状态 + 模型 id/生成时间/基版本/统计/覆盖度 + 常驻隔离声明；列表页渲染**真实字段列**（商品编码/名称/状态），无骨架文案；表单页渲染真实字段；「重新生成」二次确认且仅 1 次 POST；失败错误卡 + 旧规格保留 → 重试成功；归档模块提示 + 生成按钮禁用；渲染期无写请求；4 档宽度 × 浅/深 0 页面级横向溢出（截图 `C:\Users\icecream\AppData\Local\Temp\m72-review-2026-11-17T02-15-08\screens\`，未提交）。
- 结论：**通过，无 must-fix**。
- 非阻塞观察：① 1440 下纸面仍按 0.5—1 缩放，字段文字偏小（可后续加 100% 缩放/横向滚动）；② 列表/表格的示例值是 `mockRows` 生成的通用值，与字段业务语义无关（评审够用，后续可让 AI 给少量示例值）；③ 未做真实模型质量验证（下一条）。
- 真实模型质量验证：**未在本轮执行**（需要独立 opencode 端口与临时应用；主会话可另跑，不碰 app1）。

### M7-2 真实模型质量验证（2026-11-17，主会话执行，通过）

环境：临时 backend 3453 + 独立 opencode 4798（`OPENCODE_AUTO_START=true`）+ 临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`；从真实 3300 **只读复制 app1「商品管理」MOD-001（v8，13 章节）** 到临时应用，模型 `packycode-deepseek/deepseek-flash`（requirements stage）；**未读写 app1**、未改真实 `data/`/`projects/`；跑完删除临时应用、停临时服务。

| 项 | 实测 |
| --- | --- |
| 生成耗时 | **15.3s**（一次调用） |
| 规格 | **2 实体 / 25 字段 / 6 页面**（商品档案 15 字段、商品明细 10 字段） |
| 字段保真 | PRD 字段表 22 行 → 16 行**精确同名**命中；其余为命名差异（`销售单价（元）`→`销售单价`、`净重（kg）`→`净重`、`保质期（天）`→`保质期`）与一行合并系统字段拆成 创建人/创建时间/最后修改时间 |
| 类型 | `商品状态`→enum（上架/下架）、金额→decimal、库存→number、`所属商品`→ref→PE-1、时间→datetime；`required/unique/note` 与文档规则一致 |
| 页面 | 商品列表 / 商品新增·编辑 / 商品详情 / 商品明细列表 / 明细新增·编辑 / 删除确认（对齐 PRD 5 行页面清单，明细拆列表+表单） |
| Story 覆盖 | **8/8** |
| notes | 15—16 条真实待确认，含**文档自相矛盾**（「验收标准」默认下架 vs「业务规则」默认上架）、库存归属/扣减时机、名称唯一口径、分类多级、图片字段、订单快照范围跨模块等 |
| 渲染 | 列表页渲染真实列（商品编码/名称/分类/计量单位/销售单价/库存数量/商品状态/创建时间）+ 行操作；表单页渲染真实字段（含必填标记、状态单选、两列布局）；0 console/page error |

- 截图（临时，未提交）：`C:\Users\icecream\AppData\Local\Temp\opencode\m72-real\real-spec-1440-light.png`、`real-spec-form-1440-light.png`、`real-spec-768-light.png`；报告 `real-report.json`（含完整规格 JSON 与质量核对）。
- 测试替身说明（非产品缺陷）：复核时若把"已归一化的 spec"直接再喂给归一化器（页面只有 `entityId`、没有 `entity` 名称），实体绑定会丢失——真实模型输出走 `entity` 名称契约，正常绑定；仅提醒后续若做"导入/复用旧规格"需接受 `entityId`。
- 结论：字段抽取与页面划分达到"需求评审可用"水平，notes 本身就是需求澄清清单；建议用户重启 3300 后在 app1 上生成。生产环境一次生成约 15—40s，成本按一次模型调用计。

### M7-2 真实实例验收 + 首次生成偶发失败（2026-11-17，用户执行 + 主会话只读核对）

- 用户在重启后的真实 3300 上生成：**首次点击失败**（`原型生成失败 / 原型生成结果无法解析，请重试`），**重试后两个模块均成功**。
- 主会话只读核对（`GET /api/apps/app1/requirements-prototype`）：
  - MOD-001 商品管理：`ready`，模型 `packycode-deepseek/deepseek-flash`，基 v8，**2 实体（商品档案 14 字段 / 商品明细 10）/ 24 字段 / 6 页面**，Story 覆盖 **8/8**，notes 12 条（含「默认上架 vs 下架」矛盾）。
  - MOD-002 订单管理：`ready`，基 v5，**2 实体（订单 7 / 订单商品行 6）/ 13 字段 / 4 页面**，Story 覆盖 **5/5**，notes 16 条（库存扣减/回补、状态扩展、快照字段等待确认）。
  - 两个模块的页面均绑定实体（无「未绑定实体」），`specState.staleReason=null`。
- 首次失败定位：临时会话生成、结束即删除，opencode 日志无正文/错误 → 无法取证原始输出；主会话用 app1 真实 PRD + 同模型（含 `variant=high`）在临时实例复现 3 次全部成功 → 判定为**模型偶发输出不符合 JSON 契约**（当前实现一次不过即 502，且报错无片段）。
- 后续（待用户决定）：`docs/plans/2026-11-17-m7-2b-parse-robustness-brief.md` —— 提示词只输出 JSON、解析候选扫描/未转义换行/围栏/BOM、**失败自动重试一次**、502 带 `detail`（脱敏 300 字）+ 前端可展开「模型输出片段」。本批**尚未实施**。
- 真实数据库：本轮仅新增 `app_settings` 的两条预览规格键；未改需求/设计/交接包/Change Set/阶段/会话（用户手动点击产生，主会话未写入）。

## M7-2b 完成（2026-11-17，待评审）：原型规格解析容错 + 自动重试 + 可诊断报错

范围：只做 M7-2 生成链路健壮性；不改数据模型/接口语义（仅增 `detail`）/生成交互/过期/归档/设计阶段/交接包/Change Set/U7。

- 后端 `backend/src/requirements/prototype-spec.ts`：
  - **提示词**：只输出一个合法 JSON 对象（首个非空字符 `{`、最后一个非空字符 `}`，JSON 之后无文字），不允许围栏/注释/尾逗号，字符串内换行写 `\n`；保留 `<<<PREVIEW_SPEC_JSON>>>`（可选、便于调试，不再要求寒暄）。
  - **解析容错**：预处理 BOM / 任意位置 ```json 围栏 / `\r\n`→`\n`；按字符串状态扫描平衡括号，收集**顶层完整** `{…}` 候选，**从后往前**逐个解析（分隔符之后的候选优先）；每个候选取「原样 → 去尾逗号 → 字符串内裸换行/制表符转义 → 全角引号兜底（仅最后手段）」；截断 JSON 不补括号；归一化/结构校验不变。
  - **解析边界修复（评审后补）**：在顶层候选之外，再对每个**字符串外** `{` 起点（只看最靠后的 60 个，单候选 >200KB 跳过）单独做深度匹配作为**后缀候选**，合并后去掉被其它候选包含的嵌套对象——这样「分隔符后先是**未闭合残片**、再是完整 JSON」仍能解析成功（残片起点匹配不到 `}` 被跳过）；同时只有**顶层完整对象**可作为「非规格对象」的解析回退，截断残片里的内层对象不再冒充规格（截断且无完整对象仍 → `null`/502，不补括号）。
  - **自动重试**：输出为空 / 解析失败 / 归一化后无实体或无页面 → 同一 prompt 再调一次（`options.retry?: boolean`，默认 true）；中止（499）与模型调用抛错不重试；两次失败 → 502。
  - **诊断**：502 带 `detail` = 最后一次原始输出 `redact()` 后截断 300 字（头 150 + `…` + 尾 150）；`console.warn('[requirements-prototype] …')` 记录 `moduleId/attempt/rawLen/head(120)`（脱敏，不含完整文档）。
- 错误出口：`RequirementDocError` 新增可选 `detail`（第 5 参），`requirementErrorHandler` 输出 `{ error, detail? }`；其它错误响应不变。
- 前端 `frontend/src/requirements/api.ts`：`DocApiError` 透出 `detail`（`request()` 读 `payload.detail`，无则空串）。
- 前端 `frontend/src/requirements/prototype-spec-helpers.js`：新增 `specErrorOf(err)`（→ `{ message, detail }`；无/空/非字符串 detail → 空串；超长头 150 + `…` + 尾 150）与 `SPEC_ERROR_DETAIL_LIMIT`。
- 前端 `frontend/src/requirements/RequirementsPrototypePreview.vue`：错误卡下新增可折叠「模型输出片段（前 300 字）」`<details>` + `<pre data-testid="prototype-spec-error-detail">`（等宽、自动换行、最长 240px 内部滚动）；无 `detail` 不渲染；切换模块/重新生成时清空。

命令与数字（全部临时目录/端口；未启停真实 3300）：

| 项 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过（`dist` 已重写） |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **310/310**（基线 295，新增 15，其中解析边界修复 +2） |
| `npm test --prefix frontend` | **167/167**（基线 165，新增 2） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |
| `smoke:requirements` / `smoke:modules` / `smoke:design` / `smoke:design-handoff` / `smoke:change-set` | 全部通过（各自临时目录/端口） |
| Playwright（临时 data/projects + 端口 3443/4443 + `OPENCODE_AUTO_START=false` + stub 生成器） | **45/45 断言**（解析边界修复后复跑仍 45/45）；0 console error / 0 page error / 0 意外 API≥400（2 次预期 502 已剔除）/ 0 页面级横向溢出 |

Playwright 覆盖（脚本 `C:\Users\icecream\AppData\Local\Temp\opencode\m72b-pw\review.mjs`，harness 同目录）：
- ① `first-bad`（第 1 次垃圾、第 2 次合法）→ 前端仅 1 次 POST 且 200、无错误卡/诊断块、`3 实体 · 8 字段 · 4 页面`、画布显示真实字段。
- ② `both-bad`（两次超长非 JSON）→ 502、文案「原型生成结果无法解析，请重试（已自动重试 1 次）」、旧规格不被覆盖；诊断块默认折叠，展开后文本以「开头片段标记」开始、「结尾片段标记」结束、含 `…`、长度 ≤ 301、`max-height:240px` + `overflow:auto` + `white-space:pre-wrap`。
- ②-b 错误卡「重试」→ 200，错误卡与诊断块消失。
- ③ 回归：重新生成（二次确认取消不发请求；确认后 9 字段/5 页面）、stale（改文档 → 刷新横幅 → 横幅内重新生成后消失）、生成中按钮禁用 + 重复点击不发第二次请求 + 取消保留旧规格、1440/1024/768 无页面级横向溢出。
- 截图（临时，未提交）：`C:\Users\icecream\AppData\Local\Temp\opencode\m72b-e2e-2026-11-17T03-06-21\screens\`（6 张）+ `summary.json`。

偏差：
1. 两次失败的错误文案沿用**最后一次语义文案**再追加「（已自动重试 1 次）」（如「模型没有产出可预览的页面，请重试（已自动重试 1 次）」），而非一律替换为「原型生成结果无法解析…」；解析失败场景与交接单文案完全一致，`retry:false` 时不追加该后缀。
2. 候选解析增加「顶层对象优先」：从后往前时优先返回含 `entities`/`pages` 键的对象（避免噪声 `{…}` 抢先）；都不含这两键时退回最后一个**顶层完整**可解析对象（保持既有「没有产出可预览的实体」文案；截断残片里的内层对象不作为回退）。

未验证：
- 真实模型 E2E（按交接单由主会话另跑）；本轮**未调真实模型**，未触碰真实 3300 / `data/` / `projects/` / `.env` / app1。
- 真实 3300 仍是旧进程：`backend/dist`、`frontend/dist` 已重写，需用户确认后 `stop.cmd` → `start.cmd` 才生效。
- `<768` 移动端、多实例部署的并发锁（仍是进程内 Map）沿用既有范围。

### 主会话评审（2026-11-17，独立复核通过；含 1 项评审发现已修）

- 独立复跑（临时目录）：后端 **310/310**、前端 **167/167**、`typecheck`/`check:vue` 通过。
- 独立对抗性解析用例（主会话自写，不调模型）：**13/13 通过** —— 前导说明 + 分隔符 + 字符串内含 `{}`、**未闭合残片 + 完整 JSON**、字符串内裸换行、全角引号、BOM+围栏、截断不补括号、噪声对象不抢先、修复后归一化并绑定实体、`detail` 截断 301 含 `…`、空输出 detail 为空、围栏预处理。
- **评审发现（已修并复验）**：`balancedObjectCandidates` 原实现把"未闭合残片 + 随后完整 JSON"视为一个未闭合对象 → **0 候选 / 502**。实施会话补了"字符串外每个 `{` 起点的后缀候选（后 60 个、单候选 ≤200KB）+ 去嵌套 + 回退仅顶层完整对象"；复验该用例从 `candidates=0 / parsed=null` 变为 `candidates≥1 / parsed=yes`，且"只有残片"仍返回 null（不补括号）。
- 已知限制（非阻塞）：若前置残片**截断在字符串内部**（引号未闭合），其后完整的 `{` 会被判为字符串内而漏扫；属极端形态，暂不处理。
- 结论：**通过，无 must-fix**；其余语义（自动重试一次、499/抛错不重试、detail 脱敏、只写 `app_settings`）与既有回归一致。
- 运行态：`dist` 已含 M7-2b，真实 3300 仍是旧内存代码；需用户确认后重启生效。
- 运行态更新（2026-11-17 11:14，用户重启）：**M7-2b 已生效**（PID 42936，`dist/index.js`）；app1 仍为 `development`，MOD-001/MOD-002 `specState=ready` 未过期；用户正在跑全流程（已进入开发阶段）。

## 汇报/演示文档（2026-11-17，主会话派子会话产出并评审）

- 产物目录 `docs/report/`（新增，不含任何真实应用数据/凭据）：
  - `ai-dev-workbench-overview.md`（38.5 KB，含 Mermaid 流程图与全部章节）
  - `ai-dev-workbench-overview.html`（72.1 KB，单文件离线演示版：内联 CSS + 内联 SVG，无外链；1440/1024/900/768 无横向溢出、0 console/page error）
  - `ai-dev-workbench-overview.pdf`（**11 页 / 732 KB**，A4；流程图独占第 3 页不裁切）
  - `assets/flow-overview.svg`（可编辑矢量流程图）、`assets/flow-overview.png`（2360×3680，贴 PPT 用）
- 内容：一页摘要（痛点→做法/卖点/适用与不适用/当前状态）→ 业务流程图（用户/AI/系统三色 + 门禁 + 阶段产物 + 右侧变更回流）→ 三阶段说明 → 阶段间交接逻辑（需求→设计、设计→开发与交接包校验、开发→变更、两层阶段）→ 关键机制 → 角色与 3/10 分钟演示脚本 → 边界与未验证 → 术语表。
- 主会话评审：纠正 4 处不一致（QA 模板不属需求阶段可选、需求页导出不是 `01-REQUIREMENTS.md`、历史交接包文件不可回读的口径、模块数量限制只约束 AI 规划）；核实 2 处行为（完成后再发消息会恢复为开发中、重新生成交接包需 active 变更单否则 409）；HTML/PDF 复核通过。

## G1 完成（2026-11-17，待评审）：需求聊天模块意图守卫 + 未知模块引用告警

上游交接单：`docs/plans/2026-11-17-g1-module-intent-guard-brief.md`（§7 实施结果）。背景：真实 app1 在「变更 #2（需求+设计）」里给需求聊天发“帮我增加一个模块：订单客户管理…”，聊天没有建模块能力，模型把内容写进 MOD-001 的多个章节并自造 `MOD-003`，应用 v9—v11、确认 v12，页面仍只有 2 个模块 —— **内容落库但落错模块**。

范围：只做需求聊天（`mode='doc'`）的**守卫与提示** + 文档保存/确认的未知模块告警。不改模块创建/变更单/设计/开发语义；不新增表/列/依赖；不做“聊天直接建模块”。

### 改动（文件）

后端
- 新增 `backend/src/requirements/module-intent.ts`
  - `detectModuleIntent`：强规则 1a「动作→模块」（新增/增加/添加/创建/新建/加/删除/删掉/移除/改名/重命名/拆分/拆成/拆分为/拆分成/合并/合并为/合并成 + 数量词 + 模块/业务域/子域）、1b「为/成 类动词 + 短名词 + 模块」（`合并为订单模块`）、2a「句首/标点后 模块 + 动作 + 短语收尾」、2b「把/将/对 + … + 模块 + 动作 + 短语收尾」；排除“模块里/内/中/的”与“模块新增字段/页面/Story”这类内容修改（**评审后**规则 2 由“否定前瞻”改为更严格的“短语收尾”，见下「主会话评审修复」）。
  - `buildModuleGuidance`：按 应用阶段 + active 变更单 生成指引文案与 `suggestions`（只给当前可用动作）。
  - `moduleGuidanceContext`：只读组装（不懒创建模块/文档）。
  - `unknownModuleRefWarnings`：扫描 `/\bMOD-\d{3,}\b/`，已知 key（含归档）不告警、同一 key 去重。
- `backend/src/chat/service.ts`：doc 模式（非 doc-plan/design）在**构造 prompt 之前**做守卫；命中即 `writeModuleGuidanceResponse`（`meta`（`moduleAction='guidance'`/`stage`/`changeSet`/`suggestions`）→ `delta` → `done`），**不建 opencode 会话、不调模型、不解析/应用 DOC_JSON、不写库、不产版本**。
- `backend/src/chat/doc-prompt.ts`：新增「模块边界（硬规则，优先于用户输入）」——只维护当前模块、不写 `MOD-xxx`、模块增删改只回一句入口说明且**不输出 `<<<DOC_JSON>>>`**、不得声称未发生的操作。
- `backend/src/requirements/doc.ts`：`saveDocSection` / `saveDoc` 保存后扫描结果章节 markdown → `warnings`（非阻塞、去重）；`validateRequirementDoc` 同样作为 warning（确认仍可完成）。
- `backend/package.json`：注册 `src/requirements/module-intent.test.ts`。

前端
- 新增 `frontend/src/requirements/module-intent.js`（前端预检，与服务端同一套强规则；指引卡按钮文案/禁用原因）+ `module-intent.test.mjs`。
- 新增 `frontend/src/requirements/ModuleGuidanceCard.vue`：`data-testid="module-guidance-card"`，标题「模块操作请用专用入口」+ 文案 + 4 个按钮（服务端未给的动作禁用并带 title）。
- `frontend/src/requirements/DocChatPanel.vue`：`metadata.moduleAction==='guidance'` 渲染指引卡（不再当普通气泡、不解析 DOC_JSON）；`streamDocChat` 增加 `onMeta`；`appStatus` 只读提示条 `data-testid="chat-readonly-hint"`；**阶段只读可输入** + 客户端意图预检（非模块话术只提示、不发模型）；草稿保留。
- `frontend/src/requirements/RequirementsDocView.vue`：`data-testid="doc-warning-strip"` 黄色可关闭告警条（保存/应用建议/重建/确认的 warnings 合并去重，切模块清空）；指引卡按钮复用现有入口（新增模块 / AI 规划模块 / 重新编辑需求 / 发起变更）。
- `frontend/src/requirements/api.ts`：`DocChatMessage.metadata`、`DocChatMetadata`、`streamDocChat(..., onMeta)`。
- `frontend/src/workbench/AppShell.vue`：需求页 `@open-change-set` → 打开现有「发起变更」弹窗。
- `frontend/package.json`：注册 `src/requirements/module-intent.test.mjs`。

### 验证（实际数字；全部临时目录/端口，未启停真实 3300、未调真实模型）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过（`dist` 已重写） |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **328/328**（基线 310，**新增 18**：`module-intent.test.ts` 11 + `doc.test.ts` 3 + `chat/service.test.ts` 4） |
| `npm test --prefix frontend` | **172/172**（基线 167，**新增 5**） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过（`dist` 已重写） |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |
| `smoke:requirements` / `smoke:modules` / `smoke:design` / `smoke:design-handoff` / `smoke:change-set` | 全部通过 |
| Playwright（`C:\Users\icecream\AppData\Local\Temp\opencode\g1-pw`，真实后端 + 临时 data/projects + 端口 3450 + 内存 stub 模型） | **46/46 断言、0 failures、0 console error、0 page error、0 意外 API>=400、0 横向溢出**；15 张截图；全程模型会话仅 2 次（普通对话 + doc-plan），守卫轮次 **0 次** |

Playwright 场景（3 个临时应用）：
1. **事故复现**（需求阶段、文档非空）：输入「帮我增加一个模块：订单客户管理…」→ 指引卡（新增模块 / AI 规划模块 可用，发起变更禁用）→ **无新版本、文档内容不变、无 DOC_JSON、模型会话数不变**；刷新后指引卡从持久化消息恢复；点「+ 新增模块」打开现有弹窗。
2. **设计阶段**（确认后进入 design 再打开需求页）：灰色只读提示条（`chat-readonly-hint`）+ 输入同样话术 → 指引卡只给「重新编辑需求」；不调模型、不产生修改；点按钮打开现有“重新编辑需求”确认弹窗（取消）；非模块话术被客户端拦截、不发模型。
3. **未知模块告警**：章节写入 `MOD-999` → 自动保存后 `doc-warning-strip` 列出“不存在的模块 MOD-999”（可关闭、再次保存重现、不产版本）→ 确认仍成功（应用进入 design），确认结果弹窗与页面告警条都含 MOD-999。
4. **回归**：普通对话照常调模型并生成 AI 建议卡 →「全部应用」文档 `v1 → v2` 且内容落库；RMP-1 `doc-plan` 仍返回模块拆分建议卡；浅/深色 1440/768 无横向溢出。

### 偏差

1. `suggestions` 严格按“当前可用”：**设计阶段只给 `reopen-requirements`**（应用头部“发起变更”只在开发/完成阶段提供）；卡片仍渲染「发起变更」按钮但禁用 + title 说明。开发/完成给 `open-change-set`；需求+设计变更中给 `reopen-requirements`；仅设计变更不给动作。
2. 为满足交接单 §5.2（设计阶段输入同样话术得到指引卡），**“阶段只读”（设计/开发）时聊天输入区保持可输入**：前端先用同一套强规则预检，非模块话术只提示入口（不发模型）；文档级只读（已确认/归档/不在变更范围）仍是原来的禁用行为。
3. 意图规则在交接单基础上补 `添加` 动词、`这个/那个` 量词，并给规则 2 加否定前瞻（`字段/属性/页面/故事/Story/Epic/接口/表/数据/功能`），避免“给模块加内容”误伤。
4. 告警条复用同一位置展示所有非阻塞 warning（含确认返回的“Epics 还是纯 Markdown 结构”等），不只 `MOD-xxx`。

### 主会话评审修复（2026-11-17）：意图规则 3 漏报 + 2 误伤

主会话用独立脚本跑了 17 条意图样例，发现 5 个问题，已全部修正（**只改 `detectModuleIntent` 规则 + 测试**，未改守卫文案/前端交互）：

| 话术 | 修复前 | 修复后 |
| --- | --- | --- |
| 我要新增两个模块 | null（漏报） | **create** |
| 增加 2 个模块 | null（漏报） | **create** |
| 合并两个模块 | null（漏报） | **merge** |
| 订单模块增加客户绑定 | create（误伤） | **null** |
| 这个模块增加客户维度 | create（误伤） | **null** |

- 规则 1 增加数量词：`(?:[一二两三四五六七八九十百0-9]+\s*)?(?:个|一条|新的|这个|那个)?`（覆盖 `两个` / `2 个` / `个` / `这个`）。
- 规则 2 收紧为两种形态（删掉“模块 + 新增/增加 + 任意名词”的宽泛命中）：① 句首/标点后 `模块|业务域|子域` + 动作 + **短语收尾**（`为/成/掉/吧/吗/句读/冒号/句末`）；② `把|将|对` + ≤10 非标点字符 + 模块 + 动作 + 同一套短语收尾。
- 动词补充 `拆成/拆分为/拆分成`（split）、`合并为/合并成`（merge）；「为/成」类动词允许“模块”前一个 ≤10 字短名词（`合并为订单模块`），普通动词不加修饰，避免“新增客户字段并更新模块信息”这类句子误伤。
- 测试：17 条样例写成参数化用例（`cases.length === 17`：3 漏报 + 2 误伤 + 7 正例 + 5 反例）+ 13 条 为/成/把字句形态；前端 `module-intent.js` 同步同一套规则并加 20 条对齐用例。
- 复跑：后端 **328/328**（+2）、前端 **172/172**（+1）、`build`/`typecheck`/`check:vue`、Playwright **46/46**（0 console/page error、0 意外 API≥400）全部通过；已知取舍：`删除订单模块` 这类“动词 + 名词 + 模块”仍不命中（评审未要求，优先保证不误伤内容修改）。

### 未验证

- 未调用真实模型（全部 stub）；未触碰/重启真实 3300（PID 42936）、真实 `data/`/`projects/`/`.env`。
- `backend/dist`、`frontend/dist` 已重建，**需要重启 3300 才生效（本轮未重启）**。
- 真实 app1 的 v9—v11 历史内容未回滚/清理（按交接单不做数据修复；可用版本回滚或「AI 规划模块」自行整理）。

### 主会话独立复核（2026-11-17，通过）

- 独立复跑（临时目录）：后端 **328/328**、前端 **172/172**、`typecheck`/`check:vue` 通过。
- 独立意图样例（主会话脚本，17 条）：**17/17** 符合期望（含 3 漏报 / 2 误伤修复后的复验；`帮我增加一个模块…` → create、`在模块里新增一个字段` → null、`订单模块增加客户绑定` → null 等）。
- 独立 **HTTP/SSE 守卫**验证（临时实例 + stub 模型，端口 3457）：
  - `POST /api/apps/:id/chat`（doc，需求阶段）发「帮我增加一个模块：订单客户管理…」→ 200 SSE，`meta.moduleAction='guidance'`、`suggestions` 含 `create-module`、含 `done`、**不含 `<<<DOC_JSON>>>`**；随后 GET 文档 **版本不变**（证明未建会话/未调模型/未产版本）。
  - 反例「在模块里新增一个字段」**不触发守卫**（进入正常模型路径，stub/额度错误走 SSE error），说明规则未误伤内容修改。
  - 未知模块告警：保存含 `MOD-003` + `MOD-999` + `MOD-001` 的章节 → 200，`warnings` 仅含 `MOD-003`/`MOD-999`（各 1 条、去重）、`MOD-001` 不告警；`confirm` 返回 400（必填缺失，属正常）且 `warnings` 仍含 `MOD-003`，**未作为阻塞 issue**。
- 结论：**通过，无 must-fix**。已知取舍：`删除订单模块`（动词+名词+模块）不命中，优先保证不误伤；守卫不覆盖 `doc-plan`（RMP-1 自身有结构确认）。
- 运行态：`dist` 已含 G1，真实 3300 仍是旧内存代码；app1 的污染数据尚未恢复（用户选择方案 A：取消变更 #2 → 重新发起变更 → 用「+ 新增模块」）。
