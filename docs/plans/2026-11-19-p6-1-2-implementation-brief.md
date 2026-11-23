# P6-1 + P6-2 实施交接单（2026-11-19）

> 上游：`docs/plans/2026-11-18-agent-first-workbench-p6-design.md`（§1 聊天/中文、§2 模板即 skill）。
> 本轮只做 **P6-1 + P6-2**；P6-3（设计参考包）与 P6-4（收尾）另开交接单。
> 当前基线：后端 77/77、前端 49/49、`e2e:p2/p3/p4` 104/67/83、`smoke:*` 通过。
> 真实 3300 不启停；真实 `data/`/`projects/`/`.env` 不读写；不做 git；不调真实模型。

---

## 0. 出口标准

### P6-1 聊天思考/loading + 中文

1. 需求/设计/开发三处对话：发送后**本地占位气泡**（spinner + “思考中…”），首个 delta/消息到达即替换。
2. **出错/中断**：占位替换为错误/“已中止”标记，不留在“思考中”；可继续输入。
3. assistant `reasoning` 以折叠块“思考”渲染；样式与 token 与 `DevView` 一致（抽公共样式或同 token 复制）。
4. 工具运行时显示一行当前工具（可选，取最后 step）；不影响既有时间线。
5. `CHINESE_INSTRUCTION` 注入：`buildViewPrompt` 三个视图 + 4 个 command 模板 + 应用 `AGENTS.md`。
6. 测试：前端占位状态纯函数单测；e2e p2/p3/p4 增加占位/失败/中断/reasoning 断言；后端 prompt 断言含中文要求。

### P6-2 模板即 skill（一个模板一个 skill）

7. 应用工作区生成**模板 skill**：
   - `adw-template-req-<id>/`：`SKILL.md` + `assets/template.md` + `_manifest.json`
   - `adw-template-proto-<id>/`：`SKILL.md` + `assets/template.json` + `assets/tokens.json` + `_manifest.json`
   - 只生成被选中的模板（应用默认 + 模块 frontmatter 引用的需求模板；应用默认原型模板）。
8. 方法 skill 改为按 id 加载：需求按模块 `template` → `adw-template-req-<id>`；设计与开发 → `adw-template-proto-<app 默认 id>`；找不到时回退/说明。
9. 全局模板保存 → 重新生成并同步所有引用应用；应用创建/打开/会话启动幂等对齐；模板删除 → 引用检查后移除对应 skill；清理不再引用的 `adw-template-*`（只按 manifest 白名单，不碰用户自建 skill）。
10. 同步后 `GET /api/skill` 校验实际加载（P0：坏 YAML 静默丢弃）；失败只告警并在 UI/日志可见。
11. 模板库 UI 显示同步结果（同步了哪些应用、失败提示）；不新增模板市场/版本。
12. 测试：分发/同步/清理/删除保护/多需求模板并存；`smoke:assets` 扩展为“方法 + 模板 skill 均已加载”；e2e 创建/更新/删除模板。

---

## 1. 不做

- P6-3 设计参考包（brief/tokens/PNG/自动导出/开发参考约束）。
- 版本/确认/变更单/交接包/门禁；真实 3300 启停；旧应用迁移。
- 模板市场、多版本、原型模板 CRUD UI（如已有 API 保持）。
- 真实模型调用（中文/效果由主会话 E2E 验证）。

## 2. P6-1 实施要点

### 2.1 前端（`AgentChatPanel.vue`，DevView 仅复用样式）

- 新增本地状态：`sending` → `awaiting`（占位）→ `streaming`（有正文）→ `done|failed|interrupted`。
- 占位触发：发送成功即置位（不依赖 `state.status` 翻转）；收到新的 assistant 消息/首个 delta、或状态进入 failed/interrupted 时清除。
- 失败/中断：占位替换为失败/中止条目（复用错误条/notice 样式），允许继续发送。
- reasoning：assistant 的 `message.reasoning` 渲染为折叠块“思考”；样式抽到 `shared/reasoning.css`（或同 token 复制），`DevView` 同步复用。
- 工具行：`state.status === running` 时显示最后 `step.items[0].name/target`（有则显示，无则不显示）。
- 断言用 `data-testid`：`chat-pending`、`chat-reasoning`、`chat-pending-failed`。

### 2.2 中文

- 后端新增共享常量（建议 `chat/prompts.ts` 或 `chat/service.ts` 导出）：
  > 所有面向用户的文字——回复、思考/进度说明、工具说明、汇报——一律使用中文；代码、命令、标识符、文件路径除外。
- 注入 `buildViewPrompt` 三个视图（放 framing 最后一行）。
- `templates/agent/commands/*.md` 四个命令各加一条同样的中文要求。
- 应用 `AGENTS.md` 中文条目加强（与上面一致）。
- `DEFAULT_DEV_PROMPT` 复用同一常量，避免两份文案漂移。

## 3. P6-2 实施要点

### 3.1 生成器（`backend/src/templates/distribution.ts`）

- 新增 `templateSkillId(kind, id)`：`adw-template-req-` / `adw-template-proto-` + 安全化 id（与 `templateAssetName` 同规则）。
- 需求模板 skill：
  - `SKILL.md` frontmatter：`name`（模板名）、`description`（“需求模板：<name>；模块 template 指向 <id> 时加载，用于章节结构与写作要求”）。
  - 正文：模板 id/名称、章节清单（title/level/required/说明）、使用方式（替换 module/title/order；不改模板）。
  - `assets/template.md`：现有渲染骨架（MOD-XXX + 占位标题 + 示例注释）。
  - `_manifest.json`：`{managed, kind:'requirement', skill, sourceId, hash, templateName}`。
- 原型模板 skill：
  - `SKILL.md`：模板 id/名称、tokens/shell 摘要、何时加载（设计布局/开发风格）、边界（只约束 Vue3 前端，EOS 后端不吃风格）。
  - `assets/template.json`：完整模板 JSON；`assets/tokens.json`：`{templateId, tokens, shell}`。
  - `_manifest.json` 同上（kind:'prototype'）。
- 方法 skill：删除对 `assets/templates/*` 的说明，改为“先加载对应模板 skill”；需求方法 skill 写清选择规则（模块 template → 应用默认 → 缺失说明）。
- 清理：同步时删除 manifest 中不再存在的模板 skill 目录；**不删除** `adw-requirements-document`/`adw-design-artifacts` 或用户自建 skill。

### 3.2 同步与校验

- 现有 `syncTemplateToApps` / `syncAppTemplates` / `ensureWorkspaceAssets` 改为生成模板 skill（保留 hash/manifest、幂等）。
- 应用创建：写入默认需求 + 原型模板 skill；模块引用其它模板时按需补。
- 全局保存：重新生成并同步引用应用；删除保护逻辑保留（需求按模块 frontmatter；原型按 app 默认/manifest）。
- 校验：`chat/service.ts#verifyProjectAssets` 扩展为期望 `adw-*` 方法 skill + 当前模板 skill；`GET /api/skill` 缺失只告警。
- `smoke:assets`：临时应用 → 创建会话 → 校验方法 2 + 模板（需求默认 + 原型默认”）均在 `/api/skill`。

### 3.3 UI

- `TemplateLibraryDialog`：同步按钮结果展示（应用数/失败）；可显示“该模板会被复制为 `adw-template-req-<id>`”。
- 不做应用内模板编辑（沿用全局库）。

## 4. 测试与验收

| 项 | 要求 |
| --- | --- |
| 后端单测 | prompt 中文断言；模板 skill 生成/同步/清理/删除保护/多模板并存；manifest/hash；`smoke:assets` 脚本扩展 |
| 前端单测 | 占位状态转移（sending/awaiting/streaming/failed/interrupted）、reasoning 展示条件 |
| e2e | p2/p3/p4 增加：占位出现→替换、失败/中断替换、reasoning 折叠；p2/p3 模板库同步提示；不破坏现有 104/67/83 |
| 回归 | 后端 77+、前端 49+、build/typecheck/check:vue、`smoke:workspace`/`assets`/`dev` |
| 真实 opencode | `smoke:assets` 校验模板 skill 实际加载（不调模型） |
| 主会话另跑 | 真实模型中文验证（开发/需求各一轮）+ 模板 skill 加载确认 |

## 5. 风险

1. 占位与真实消息重复 → 以“消息 id/数量变化”作为替换条件，不能只看 status。
2. 模板 skill 数量/命名冲突 → 仅生成被引用模板；安全化 id；`adw-` 前缀；坏 YAML 用 `GET /api/skill` 兜底。
3. 同步删除误伤 → 只删 manifest 白名单里的 `adw-template-*`；不碰方法与用户 skill。
4. 旧副本残留 → 应用打开时按 manifest 清理；当前 `apps=0`，风险低。
5. 中文指令变长 → 每轮一行，成本可忽略；真实模型不保证 100%。
6. `GET /api/skill` location 惰性 → 会话创建后校验（P1 已有），失败只告警。

## 6. 收尾

- 更新 `docs/STATUS.md` 与 P6-1/2 实施结果；不更新 P6-3 相关（未做）。
- 回报：改动/新增/删除文件、测试与 e2e 数字、命令结果、偏差、未验证项、环境确认（未触碰真实环境/未 git/未调模型）。

---

## 7. 实施结果（2026-11-19）

### 7.1 改动文件

**P6-1 聊天占位 / reasoning / 中文**

- 新增 `backend/src/chat/prompts.ts`（`CHINESE_INSTRUCTION`）。
- `backend/src/chat/service.ts`：`buildViewPrompt` 注入中文；`verifyProjectAssets` 期望方法 + 模板 skill。
- `backend/src/dev/service.ts`：删除本地重复中文常量，`DEFAULT_DEV_PROMPT` 复用共享常量。
- `backend/src/apps/scaffold.ts`：`AGENTS.md` 使用共享中文常量；模板路径说明改为模板 skill。
- 新增 `frontend/src/workbench/chat-status.js` + `chat-status.test.mjs`；新增 `frontend/src/shared/reasoning.css`。
- `frontend/src/workbench/AgentChatPanel.vue`：占位、失败/中断替换、reasoning 折叠、运行中工具行。
- `frontend/src/dev/DevView.vue`：占位、失败/中断、共享 reasoning 样式、状态/消息 watcher。
- `frontend/package.json`：测试清单加入 `chat-status.test.mjs`。
- `templates/agent/commands/*.md`（4 个）：中文要求；需求/设计命令改为按 id 加载模板 skill。

**P6-2 模板即 skill**

- `backend/src/templates/distribution.ts` 重写：`templateSkillId`、模板 skill 生成/manifest/hash、`expectedSkillIds`、manifest 白名单清理、legacy 方法 skill 副本清理；`syncTemplatesInto` 返回 `templateSkills`；`syncTemplateToApps` 返回 `templateSkill/warnings`。
- `backend/src/apps/scaffold.ts`：创建应用生成模板 skill（注释与 AGENTS 路径同步）。
- `templates/agent/skills/adw-requirements-document/SKILL.md`：模板选择规则（模块 `template` → 应用默认 → 缺失说明）。
- `templates/agent/skills/adw-design-artifacts/SKILL.md`：先加载 `adw-template-proto-<id>`；边界说明。
- `frontend/src/shared/template-api.ts`：`syncTemplate` 返回 `templateSkill/warnings`。
- `frontend/src/workbench/TemplateLibraryDialog.vue`：显示模板 skill、同步应用数与告警。
- `frontend/src/workbench/NewAppDialog.vue`：文案改为模板 skill。

**测试 / e2e**

- `backend/src/templates/distribution.test.ts` 重写（生成/同步/清理/删除保护/多模板/manifest/hash/legacy/expectedSkillIds/原型删除）。
- `backend/src/chat/service.test.ts`：中文指令断言。
- `backend/src/apps/scaffold.test.ts`、`backend/src/apps/templates.test.ts`、`backend/src/requirements/module-files.test.ts`：模板 skill 路径/字段。
- `backend/scripts/workspace-smoke.ts`、`backend/scripts/verify-agent-assets.ts`：模板 skill 校验。
- `backend/scripts/p2-e2e-harness.ts`：reasoning、`触发失败`、`静默长任务`、`流式占位`。
- `backend/scripts/p2-e2e.ts`、`p3-e2e.ts`、`p4-e2e.ts`：占位→替换、失败/中断、reasoning、模板库同步提示。

### 7.2 验证

- 后端 **82/82**；前端 **54/54**；`build` / `typecheck` / `check:vue` 通过。
- `smoke:workspace` / `smoke:assets` / `smoke:dev` 通过；`smoke:assets` 确认 **2 方法 skill + 2 模板 skill + 4 command** 已加载（真实 opencode 2.2.5，不调模型）。
- `e2e:p2` **116**（原 104）、`e2e:p3` **104**（原 67）、`e2e:p4` **91**（原 83）全部通过。

### 7.3 偏差 / 未验证

- 偏差：`DevView` 也实现占位（brief 只要求复用样式）；`syncTemplateToApps` 额外返回 `templateSkill/warnings`；legacy 清理只按旧 manifest 白名单。
- 未验证：真实模型中文输出、真实 opencode 事件形状下的占位替换、真实 3300/EOS 运行态。
- 环境：未启停真实 3300；未读写真实 `data/`/`projects/`/`.env`；未执行 git；未调用真实模型。
