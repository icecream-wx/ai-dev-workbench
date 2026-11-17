# 测试问题清单（2026-11-09 会话）

本轮按 P5 流程实测时的问题与优化需求；2026-11-09 已修复 I-01—I-04、I-07；I-05/I-06/I-08/I-09/I-10/I-11 仍待评估/讨论。

状态图例：`待修复` / `修复中` / `已修复` / `待确认` / `不做`

## I-01 首页 opencode 运行时卡片未自动探测（已修复）

- 现象：启动工作台后打开首页，卡片显示“未启动 / 版本 —”，即使本机已安装 opencode。
- 根因：`ready` 只代表本工作台 spawn 的 serve 已就绪；首页只读状态，不探测 CLI、不自动启动。
- 修复：
  - `OpencodeRuntime.autoDetect()`：探测 CLI（`installed/bin/installError`），已安装且 serve 未就绪时自动启动一次；`OPENCODE_AUTO_START=false` 可关闭。
  - 后端启动与 `GET /api/opencode/health` 都会触发自动探测；状态新增 `starting/installed/autoStart/autoStartAttempted/installError`。
  - 首页轮询到“已连接/失败”为止，显示“启动中… / 未安装 / 启动失败”，并新增 CLI 行。
- 验证：重启工作台后 `/api/opencode/health` 为 `ready=true, installed=true, bin=opencode.exe, version=2.2.5`；首页 Playwright 显示“已连接”，无控制台错误。

## I-02 新建应用高级配置缺少格式提示（已修复）

- 现象：高级配置只有字段名和 `CHANGE_ME`，用户不知道 DB Host 填 `10.15.15.160` 还是 `jdbc:mysql://...`。
- 根因：模板渲染为 `jdbc:mysql://{{DB_HOST}}:{{DB_PORT}}/{{DB_NAME}}?...`，DB Host 只应填主机名/IP，但 UI 没有说明。
- 修复：每个字段增加 `<small>` 格式提示与示例；提交校验拒绝 `jdbc:`/`://` 的 DB/Mail Host、非数字/越界 DB Port。
- 验证：Playwright 展开高级配置，8 条高级提示均存在；填入 `jdbc:mysql://10.15.15.160` 时返回“只填主机名或 IP”，未创建应用；无页面错误。

## I-03 模型默认值跟随 opencode CLI（已修复/优化）

- 背景：新应用未选模型时首次需求对话报 `provider.free-limit` 429；`resolveChatModel()` 回退到 `opencode/iceman-free`。
- 根因：无应用级模型时直接使用 opencode 默认模型（免费额度已尽）。
- 修复：
  - 解析顺序改为：请求显式模型 → 应用当前阶段设置 → 同应用其他阶段设置 → `OPENCODE_DEFAULT_MODEL` → opencode CLI 最近会话使用的模型 → opencode 默认模型。
  - 新增 `OpencodeRuntime.lastUsedModel()`（读最近会话的 model/variant）；模型设置弹窗回退值使用同一解析口径。
  - 429/401/403 转成可读提示，不再直接抛原始 JSON。
- 验证：`GET /api/apps/app1/model?stage=design` 返回 fallback `packycode-deepseek/deepseek-flash (high)`，不再是 `iceman-free`；强制用 `iceman-free` 请求返回“当前模型的免费额度已用尽…请在「模型」中切换”，无原始 JSON。
- 待确认：`OPENCODE_DEFAULT_MODEL` 仍优先于 CLI 最近模型（作为显式覆盖）；新建应用表单暂未加模型选择，留作后续。

## I-04 需求对话提示“本轮输出未能解析”（已修复）

- 现象：需求澄清多轮后连续出现“本轮输出未能解析（未找到符合协议的 JSON 部分）”，卡片不落库，无法确认。
- 根因：模型输出在 JSON 后再次追加了 `<<<SPEC_JSON>>>`（真实 SSE 已复现：`...JSON...\n<<<SPEC_JSON>>>`）。旧解析把分隔符后的整段文本直接 `JSON.parse`，尾随分隔符导致失败；重试也失败。
- 修复：
  - `protocol-output.js`：分隔符后优先解析；失败时提取平衡 JSON 对象（忽略字符串内花括号），容忍尾随分隔符/说明/代码块/尾逗号；无分隔符时也从回复中提取并保留前文。
  - 接受 `{}` 作为“无结构化更新”，不再报错或生成空 diff。
  - 重试提示明确要求“JSON 后不要再输出分隔符/代码块/解释文字”。
- 验证：前端 `node --test` 9 项通过（含真实“JSON 后再次出现分隔符”用例）；真实模型会话（deepseek-flash）发送“账号名必填，增加上次登录时间字段”后卡片正常更新（goal/businessRules/acceptance/status），无解析失败提示。

## I-05 需求阶段缺少“还有哪些待澄清/未完成工作”的全局视图（待评估，未实现）

- 状态：待评估/待确认（先记录，用户仍在测试；不一定实现）
- 归属：工作台需求视图（`SceneTree.vue`、`RequirementsView.vue`、`AppShell.vue`；数据来自 `moduleCard.<id>` 与 `specOf(id).openIssues`）
- 现象与困惑：
  - 待澄清问题分散在各个需求点，左侧场景树没有标识，用户需要逐个场景点开才知道哪里还有问题；
  - 点击“完成需求”后立刻出现一批待澄清问题，但事先没有全局入口能一眼看到；
  - 用户不清楚需求阶段“什么时候算完成、何时可以点完成需求”，只能跟随对话提示逐步操作。
- 现状（已核对代码）：
  - 场景树行只显示场景名/需求点名；需求点行只有批次状态圆点，没有待澄清数、卡片状态或完成度标识。
  - 待澄清问题存于每个需求点的 `spec.openIssues`；`IssuePanel`/`ReviewPanel` 只展示“当前激活需求点”的问题，没有场景/全局汇总。
  - 顶部“确认率”= 卡片 `status==='confirmed'` 的需求点数 / 全部需求点，**不包含待澄清问题**；因此可能出现确认率 100% 但仍有待澄清。
  - 后端 `validateRequirements()` 的完成条件只有：至少 1 个需求点；每个点 `card.status==='confirmed'`、有目标、有角色、有验收要点。**待澄清问题目前不阻塞完成**。
  - 前端“完成需求”按钮始终可点；点击后弹确认框说明上述条件，服务端校验失败才用弹窗列出具体问题（`AppShell.handleApiError`）。所以用户事前看不到“还差什么”。
- 建议的 UX（按投入从低到高，先做只读标识）：
  1. 场景行：显示该场景下所有需求点的汇总徽标，例如 `待澄清 3`、`待确认 2`、`已确认 5`；有待澄清时用橙色/红色圆点或数字，全部需求点已确认且无待澄清时显示绿色“已完成”。
  2. 需求点行：显示卡片状态（未开始/讨论中/待复核/已确认）+ `待澄清 N`；缺目标/角色/验收要点时显示“缺 3 项”之类的提示。
  3. 顶部/场景树上方的“需求待办”汇总：列出全局未完成项，点击可跳转到对应场景/需求点；至少包含：
     - 未确认的需求点（N）
     - 缺目标/角色/验收要点的需求点（N）
     - 待澄清问题总数（N）
     - 可选：待复核（review）的需求点
  4. “完成需求”按钮：悬停/弹窗直接展示上述未完成项；全部满足时提示“可以完成”。没有未完成项时再允许进入完成确认。
  5. 术语统一：明确“确认率”只代表卡片确认；另加“待澄清 N”独立指标，避免 100% 误解。
- 产品化建议：
  - 第一阶段只做**只读标识 + 待办清单 + 跳转**，不改变后端完成条件；风险低、能解决“不知道还有哪些问题”。
  - 第二阶段再决定“待澄清是否阻塞完成”：建议默认作为**完成前提醒**而非硬阻塞（当前后端也不阻塞），避免用户被迫清空所有问题才能进入设计；如要硬阻塞，需要同时改 `validateRequirements()`、前端按钮状态和文档。
  - “全部处理完成”的定义建议：所有需求点卡片已确认 + 目标/角色/验收要点齐全 + 待澄清为 0；其中待澄清可作为“建议完成”而不是硬门槛。
- 影响文件（预估）：`frontend/src/requirements-grooming/ui/SceneTree.vue`、`RequirementsView.vue`、`workbench/AppShell.vue`、`spec/store.ts`（只读汇总）；如改阻塞条件还需 `backend/src/apps/routes.ts`。
- 验证要求（实现时）：场景/需求点徽标在切换、确认、归档待澄清后实时更新；待办清单点击可定位；Playwright 覆盖“有待澄清/无待澄清/部分确认/全部完成”；后端测试覆盖完成校验（若改阻塞策略）。

## I-06 需求聊天出现“进入开发”，完成需求后设计页空白（已记录；空白的直接原因已由 I-07 修复，阶段隔离/引导仍待评估）

- 状态：待评估/待确认（用户要求先走完全部流程，暂不修改）
- 归属：需求/设计阶段衔接 + 模型协议行为（工作台前端/后端 + req/design agent 提示），不是 opencode/EOS/MySQL 故障
- 现场快照（`app1`）：
  - 应用状态 `design`，`requirementsConfirmedAt=2026-11-09T13:58:10Z`，`designConfirmedAt=null`；
  - 4 个需求点卡片均已确认（4/4），但四个需求点的 Spec **全部为空**：`entities/pages/roles` 均为 0；
  - 设计页显示“当前批次还没有规格 / 0% 0/0 项”，与数据一致；
  - 需求对话最后一条 assistant 消息带 actions：`进入开发 | 还有细节要调整`；用户点击“进入开发”只是发送了一条用户消息，并不会切阶段；真正切阶段是随后点击顶部“完成需求”。
- 根因梳理：
  1. **设计页空白不是渲染 bug，而是 Spec 数据为空**。需求阶段完成校验只检查卡片（至少 1 个需求点、每个点已确认、有目标/角色/验收要点），不要求也不生成设计 Spec；Spec 本应在设计阶段拆解。
  2. **需求聊天里的“拆解”没有产出结构化 patch**。对话中模型多次声称“已把四个需求点骨架统一为已确认（实体、页面、角色权限、业务规则）”，但四份 Spec 的 `entities/pages/roles` 全是 0，也没有出现“未找到需求点/未解析”提示。说明模型只输出了正文（可能含 card/openIssues/actions），没有输出可落库的 `patch/patches`。前端只信任结构化 JSON，正文声明不会落库。
  3. **阶段职责混淆**：需求阶段应只维护需求卡片；拆解应在设计阶段由 design agent 完成。当前 req agent 的提示里既写了“日常业务讨论只更新 card、需求视角禁止输出 patch”，又保留“用户说拆解就走意图 C 产出 patches”，模型在需求阶段被引导到拆解语义，结果只“说”不“做”。
  4. **actions 缺少阶段校验**：模型在需求阶段生成了“进入开发”这种不可执行的动作；actions 只是把文本发回对话，不是阶段按钮，但用户会误以为是入口。开发阶段此时还是 locked。
  5. **设计空状态缺少引导**：进入设计后只显示“当前批次还没有规格 / 0%”，没有说明“需求已确认，下一步需要点击开始拆解/对 design agent 说开始拆解”，用户不知道空白是正常起点。
- 产品化建议（实现时再定）：
  1. **阶段隔离**：需求阶段禁止 patch/patches；用户说“拆解/进入开发”时，提示“请先完成需求并进入设计阶段”，或给一个真实动作“完成需求并进入设计”。
  2. **设计阶段入口引导**：需求确认后进入设计，空状态显示“需求已确认，尚未拆解”，提供主按钮“开始拆解当前批次”（发送明确的 design agent 提示），并显示预计拆解范围（4 个已确认需求点）。
  3. **actions 校验**：按阶段过滤/改写信模型 actions；需求阶段不显示“进入开发”；若保留，必须绑定真实阶段 API 且仅在解锁时可用。
  4. **结构化结果自检**：当模型正文声称“已拆解/已确认规格”但 envelope 没有 patch/patches 时，提示“本轮没有可落库的结构化规格，请重试”，避免用户误以为已完成；不要仅靠正文判断成功。
  5. **完成条件展示**：结合 I-05，在完成需求弹窗/待办清单中明确“需求完成 ≠ 设计已完成”；设计阶段的完成条件是交接包校验通过。
  6. **数据修复**：`app1` 目前 Spec 为空，后续测试需要重新在设计阶段拆解；若需要保留本轮对话，可增加“重新拆解”入口，但不建议自动补数据。
- 影响文件（预估）：`backend/src/apps/scaffold.ts`（req/design agent 文案）、`frontend/src/requirements-grooming/conversation/prompt.ts` / `store.ts`（阶段化协议与 actions 校验）、`frontend/src/requirements-grooming/ui/SceneTree.vue` / design 空状态、`frontend/src/workbench/AppShell.vue`（阶段入口）。
- 验证要求（实现时）：需求阶段说“开始拆解”不再产生 patch；设计阶段“开始拆解当前批次”能落库实体/页面/角色；正文声称成功但无 patch 时有明确提示；actions 不出现未解锁阶段；Playwright 覆盖“需求完成 → 设计空状态 → 开始拆解 → 规格树有数据”。

## I-07 设计阶段结构化输出被校验拒绝，导致设计页一直空白（已修复）

- 现象：设计阶段对 design agent 说“开始拆解”，对话有长篇正文，但规格树始终“当前批次还没有规格”，无法编辑/确认。
- 现场复现：真实 `design` 会话返回 `patches[0].patch.entities[...].fields[...]`，其中两个字段把 `constraints` 写成了**字符串**（如 `"constraints": "长度不超过 20 字"`、`"constraints": "系统字典:性别"`）。`replyEnvelopeSchema` 要求 `constraints` 是字符串数组，`validateEnvelopeData()` 返回：
  - `/patches/0/patch/entities/0/fields/1/constraints must be array`
  - `/patches/0/patch/entities/0/fields/3/constraints must be array`
  校验失败后整轮 patch 被丢弃，重试仍可能输出同样形状，于是设计页一直空。
- 根因：提示词写“在字段 constraints 写 `系统字典:<中文名>`”，模型可理解为字符串；Schema/下游代码按字符串数组处理，形状不一致就整轮拒绝。
- 修复：
  - `protocol-output.js` 新增 `normalizeEnvelope()`：`field.constraints` 为字符串 → `[字符串]`；为对象 → `["key:value"]`；为数组保持；空值删除。解析后统一归一化，再交给 AJV 校验。
  - 提示词明确 `constraints` 必须是字符串数组，并给出 `["系统字典:性别"]` 示例。
  - 新增前端单测覆盖字符串/对象/布尔/数组四种形状和真实设计输出。
- 验证：
  - 前端单测 11/11、`vue-tsc --noEmit`、`vite build` 通过；
  - 真实 design 会话重新拆解 A-1 成功：`mod-fty3vz`（A-1 员工信息维护）落库 `entities=1、pages=3、roles=3`，设计页规格树显示实体/页面/业务流程/角色/规则/触发器/字典/服务/非功能需求，确认率 94%（16/17），可进入条目详情与确认。
  - 说明：本轮只验证了 A-1；A-2/A-3/B-1 仍需用户在设计阶段继续拆解。

## I-08 需求/设计阶段操作体验与“还缺什么”视图（方案讨论中）

- 状态：待讨论（方案见 `docs/plans/2026-11-09-stage-ux-and-dev-session-design.md`）
- 现象：用户不清楚当前阶段目标；不知道需求完成后还要拆解；设计页无规格时纯空白；A-2 未拆解没有全局提示；交接包 warnings/errors 没有分开展示；UI 仍残留“批次规格确认率”等旧概念。
- 当前数据（`app1`）：
  - A-1 已拆解（实体 1/页面 3/规则 3，确认率约 94%，1 个待澄清）；
  - A-2 员工账号关联未拆解（0 设计项）；
  - A-3、B-1 已拆解；
  - `POST /handoff/preview` 当前可通过，返回 5 个文件 + warnings：A-2/FEAT-003 无设计项、无测试用例、1 个开放问题；没有阻塞 issues。
- 方案要点：阶段目标提示；需求待办（I-05）；设计待办按需求点显示“未拆解/拆解中/已拆解/无需拆解”；设计页空状态“开始拆解”；交接包 readiness 区分阻塞错误与警告；“生成交接包”与“完成设计”拆成两步；去掉批次文案；阶段切换引导。
- 待确认：待澄清/未拆解是否阻塞完成；是否允许“无需拆解”标记；设计页默认按需求点还是类型树。

## I-09 开发阶段长会话与分阶段策略（方案讨论中）

- 状态：待讨论（方案见 `docs/plans/2026-11-09-stage-ux-and-dev-session-design.md`）
- 现象：复杂应用开发 30+ 分钟仍在同一会话；没有会话健康度/压缩/分阶段引导；归档会话无入口。
- 现状：一个应用一个 active 开发会话；opencode 2.2.5 原生支持 `POST /api/session/{id}/compact`；模型上下文约 1M，但长会话仍有成本/焦点/上下文压力。
- 方案建议：默认“单会话 + 原生 compact + 健康度提示”；交接包较大时（FEAT>4 / 设计项>40 / >80KB / 估算 token>100k）在 03-PLAN 加“建议分阶段”，开发页提供可选的“按阶段开发”；每个阶段一个会话，首条提示带阶段范围/交接包路径/上一阶段摘要；用户可随时回到单会话；阶段不是批次，不做门禁。
- 待确认：默认单会话还是分阶段；阈值；阶段数据落 settings 还是新表；阶段完成是否归档会话。

## I-10 开发会话列表（Codex 风格左侧栏，I-09 的补充）

- 状态：待讨论（已并入 `docs/plans/2026-11-09-stage-ux-and-dev-session-design.md` §4.3.4）
- 现象：开发完成后点“新会话”，弹窗提示“新会话会归档当前会话……旧会话暂不在界面中展示”；用户只能看到当前 active 会话，无法查看/切换历史会话。
- 期望：开发页左侧有会话列表，像 Codex 一样按应用展示全部会话；每项显示标题/摘要/时间/模型/状态，可切换、重命名、归档、恢复；超长项目可用多个会话推进，所有会话信息都能看到。
- 现状：`app_sessions` 已保存 active/archived/stale 多行与 `opencode_session_id`；`dev/service.ts` 新会话会归档旧会话；前端只渲染 active 会话。数据基础已有，缺列表 API + 左侧 UI + 切换逻辑。
- 建议：
  - 左侧可折叠会话栏（约 260px）+ 搜索 + 新会话；当前 active 高亮；按日期/阶段分组；归档会话只读查看，可恢复为当前会话。
  - 同一时间仅一个 active 会话（避免并发写同一目录）；SSE/权限/表单仍绑定 active。
  - API：`GET /api/apps/:id/development/sessions`、`POST .../sessions/:sid/activate`、`PATCH .../sessions/:sid`（重命名）、`DELETE .../sessions/:sid`（归档）。
  - 新会话弹窗文案改为“旧会话保留在左侧列表，可随时查看/恢复”，不再说“不在界面中展示”。
- 可行性：高；`app_sessions` 已有数据，主要是 API + UI + 切换 active 的状态管理；建议排在 U5（先于阶段模型 U7）。

## I-11 需求阶段改为“对话 + 模板化 Markdown 文档”（2026-11-10 团队共识）

- 状态：方案讨论中（详见 `docs/plans/2026-11-10-requirements-stage-doc-design.md`）
- 背景：团队演示后共识——需求阶段左侧 AI 对话保留；右侧从“场景树/需求点卡片”改为“模板化 Markdown 需求文档”；需支持模板中心、模板自定义保存为新模板、文档手动编辑和 AI 修改。
- 参考：OmniFlow 需求文档页（左侧对话 + 构建活动/接下来构建什么，右侧 PRD 文档、模板中心）；模板提示词来自 `Generic PRD Document.txt`、`Business Strategy.md`、`Generic QA  Test Plan.txt`。
- 方案要点：
  - 需求文档为唯一产出物：首次描述后按模板生成 Markdown 初稿；后续 AI 修改以 diff 呈现，手动编辑自动保存；版本历史/回滚。
  - 持久化：**按章节存**（`app_requirement_doc_sections` 为唯一事实来源；`content_md` 由章节拼接缓存；版本保存整篇+章节快照）。
  - 左侧增加“构建活动”状态和“接下来做什么”建议（必填章节缺失/待澄清/AI nextSteps）。
  - 每个章节提供“问 AI”：点击后对话焦点定位到该章节，默认只改该章节。
  - 模板中心：全局库 + 应用只保存模板 id；参考后重新设计模板，不照搬；按阶段分类，先做需求阶段模板；内置只读，复制后保存为新模板。
  - 需求完成条件：必填章节完整 + 用户确认；待澄清作为警告；完成后进入设计。
  - 下游：设计阶段读取需求文档/Epics 生成 Spec；交接包 `01-REQUIREMENTS.md` 使用已确认文档。
  - **不做存量兼容**：卡片/场景树在文档模式下线；提供删除应用入口（现有 DELETE API + 前端按钮），旧应用由用户删除。
- 已确认：文档唯一事实来源；不做存量兼容；Markdown 章节编辑器（非 WYSIWYG）；全局模板库；待澄清不硬阻塞；场景树移除；章节“问 AI”要做；模板参考后重新设计。
- 待确认：工作台标准 PRD 章节是否 13 节、精简 PRD 是否本期做、Business Strategy/QA 是否先作为后续阶段模板、设计单元复用 modules 还是新表。

## I-12 设计阶段简化为“实体设计 + 页面原型”（2026-11-10 讨论，方案已确认方向）

- 状态：**D1—D4 已实施（2026-11-10）**，并按主会话评审修复页面集按场景/Epic、创建/编辑表单拆分、确认后只读+重新编辑、HTML/PNG/旧应用守卫；D5（交接包/开发衔接）待讨论。详见 `docs/plans/2026-11-10-design-stage-entity-prototype.md`、`docs/plans/2026-11-10-design-stage-implementation-brief.md`、`docs/STATUS.md` 的“D1—D4 完成 / 评审修复”。
- 共识：新设计阶段只做两件事：①实体设计（表/字段/关系/ER）；②页面原型（按场景/业务流程生成列表、创建弹窗、编辑、详情等原型图片）。
- 推荐技术路线：不调用图片生成模型，用现有 `PrototypeRenderer`/Wireframe 组件渲染 HTML 原型，再截图成 PNG；图片背后保留结构化页面规格（字段/动作/状态/验收），避免文字画错、图片不可编辑。
- 原型模板（新增）：和需求模板同思路；全局库 + 应用只保存模板 id；内置“企业级专业管理/简洁后台/移动端（后续）”；模板决定 App Shell、页面模式、设计 Token、页面集规则；内置只读，复制后编辑。
- 页面集：默认按场景/Epic 生成列表/创建/编辑/详情；用户可增删改、让 AI 整组或单页重新生成；页面集是主要修改粒度。
- 实体：应用级共享实体 + 场景引用；字段类型/必填/唯一/默认/枚举/ref；关系 1:1/1:N/N:1/N:N；ER 图；AI 生成/修改 + 手动编辑 + 确认。
- 原型：场景/Epic → 页面集；风格/缩放/批注/确认/版本；PNG + HTML + 页面规格进入后续交接包。
- 设计待办：按场景显示实体/页面/原型确认状态（承接 I-08）。
- 已确认：原型 HTML+PNG；原型模板；默认生成页面集；旧设计面板全部移除、不做兼容；AI 修改 + 结构化页面规格、不做自由拖拽；应用级共享实体；图片存应用目录。
- 待细化：首批内置模板、模板编辑器范围、页面集是否默认含详情、截图实现（前端/后端）、设计完成条件、交接包格式。

## I-13 需求 → 设计交接（2026-11-10 讨论）

- 状态：**H1—H4 已实施（2026-11-11）**，主会话评审发现 stale confirmed 设计需在 D5 前修；详见 `docs/STATUS.md`「H1—H4 评审」。
- 核心：需求确认后生成**确定性的 DesignInputBundle**（场景/Epic/Story/角色/数据规则/页面要求/NFR + 版本/hash），设计项目绑定 inputId/hash；AI 只基于 bundle 生成实体/页面草稿，实体/页面带 `requirementRefs`。
- 关键建议：把 Epics/Stories、Scenes 做成**结构化章节**（稳定 ID SCENE/EPIC/STORY/ROLE），渲染仍为 Markdown；否则每次 AI 解析 Markdown，ID/变更不可追溯。
- 映射：实体 = Epics/Stories + dataRules + pageRequirements；页面集 = 按 Epic/Scene（不是实体），页面绑定 entityId + requirementRefs；默认列表/创建/编辑/详情。
- 变更：设计项目记录 source_doc_version/input hash；需求变更显示 stale，diff 后用户选择“仅新增/重生成受影响项/暂不处理”；不静默覆盖。
- 覆盖度：Story→实体/页面覆盖视图；默认警告不硬阻塞，纯后端 Story 可无页面。
- 待讨论：是否结构化 Epics/Scenes；页面集按 Epic 还是 Scene；Story 覆盖是否阻塞；变更同步策略；ID 是否显示；非 PRD 模板回退；input 历史；R1 重新编辑入口。

## I-14 设计 → 开发交接（D5，2026-11-11 讨论）

- 状态：**方案已定稿（2026-11-11），待实施 D5**（详见 `docs/plans/2026-11-11-design-to-development-handoff.md`）；迭代部分见 `docs/plans/2026-11-11-iterative-change-design.md`。
- 目标：设计确认后确定性生成开发交接包（实体/页面原型/模板/需求/计划），写入 `docs/handoff/`，切开发阶段；开发 agent 只读交接包即可开始。
- 建议结构：`00-README.md`、`01-REQUIREMENTS.md`、`02-DATA-MODEL.md`、`03-PAGES.md`、`04-PLAN.md`、`schema.sql`、`prototype-template.json`、`manifest.json`、`prototypes/*.png`（可选 HTML）。
- 原则：确定性生成；页面规格是契约、PNG 是视觉参考；模板 Token/布局约束；不生成虚构 OpenAPI；不做 Git/证据门禁。
- 校验：需求确认 + DesignInput 已绑定且不 stale + 设计确认 + 引用完整 + 模板存在 + 页面 PNG（建议阻塞）；Story 覆盖/无依据/无测试用例为警告。
- 流程：设计确认/“生成交接包并进入开发” → 校验 → 渲染/写盘/hash → `design_handoffs` → app status development → 开发会话读 00-README。
- 待讨论：文件结构；PNG 是否阻塞；HTML 是否入包；模板约束强度；DDL 映射/外键；是否生成 OpenAPI；生成/进入开发是否一步；handoff 版本与 dev session；开发阶段改设计；图片消费方式。

## I-15 迭代/变更场景（2026-11-11 讨论）

- 状态：**方案已定稿（2026-11-11），待实施**（详见 `docs/plans/2026-11-11-iterative-change-design.md`）
- 场景：首轮需求→设计→开发完成后，继续调整/新增需求、改设计、再开发；开发通常反复多次。
- 建议：**Change Set（变更单）+ 版本化文档/设计/交接包/会话**，不做完整 iteration clone。应用只有一套当前文档/设计/代码，每次变更记录基线与产出。
- 生命周期：已完成/开发中 → 发起变更（范围）→ 需求 re-open/确认 → 设计 input sync/确认 → 新 handoff（全量 + 05-CHANGES.md 增量）→ 新开发会话在现有代码上增量实现 → 完成关闭变更。
- 范围：需求+设计（默认）、仅设计、仅开发修复（仅后者可不生成新 handoff，只新会话+说明，待定）。
- 交接：全量交接包 + `05-CHANGES.md`（需求/设计新增修改删除、影响、增量实现提示）；manifest 记录 changeSet/baseline/current。
- 会话：默认每个 Change Set 新会话；旧会话只读；会话列表按变更分组（I-10）。
- 状态：复用 requirements/design/development + “变更中 #N”标签，不新增 change 状态；初始创建 Change Set #1。
- 删除项：归档 + 变更文档说明，不自动删代码/表。
- 待讨论：Change Set vs 完整迭代；首次 #1；三种范围；需求变更必须重走设计；状态；新会话 vs 继续；全量+delta；删除；取消；仅开发修复；开发中改需求；历史展示。
- 已确认：Change Set + 版本化；范围仅“需求+设计/仅设计”，纯开发修复不属 Change Set；需求变更必须重走设计；复用 stage + 变更中标签；默认每变更新会话、可继续；全量+05-CHANGES；删除代码由开发 agent 执行（工作台不自动删，DB 迁移需确认）；取消仅在新交接包前；纯开发修复不生成 handoff。
- 待定：首次是否创建 Change Set #1（建议是，用户文案“初始开发”）；历史展示层级（建议应用头部变更历史面板 + 各阶段版本标签）；开发中改需求是否必须 Change Set/旧会话只读。
