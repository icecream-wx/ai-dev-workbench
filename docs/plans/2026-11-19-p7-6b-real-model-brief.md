# P7-6b 实施单：真实模型闭环（设计 → 开发 → 一致性检查）（2026-11-19）

> 上游：P7-6a 一致性检查、P7-5b 开发链路、P7-3/4 设计模板与契约。
> 本轮只做 **P7-6b**：临时实例 + 真实 opencode/模型跑一轮闭环，记录证据、偏差、未验证项。
> **不**启停真实 3300；不读写真实 `data/`、`projects/`、`.env`；不做 git；不部署；不改产品代码（除非发现必须修复的 bug，先记录并单独处理）。

---

## 0. 环境

- 临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`（`fs.mkdtempSync`）；
- 独立端口（后端如 3441，opencode 如 4741/4441，避免 3300/4771）；
- 真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash`；
- 结束时停止临时后端/opencode；不碰真实进程。

## 1. 场景

新建临时应用 `p7-6b-e2e`：

- 设计系统：`afcenter-app-templates-v1 / enterprise-application-platform / platform-blue`；
- 需求模块：`MOD-001`（组织与人员），写一个精简需求文件（可用模板/手写 fixture，不必让模型先写需求）；
- 设计目标页：`org-list`（recipe `tree-list`，blueprint OrganizationUsers.vue）、`org-form`（recipe `dialog-form`）；
- 开发目标：实现 `frontend/src/views/OrganizationView.vue`，从蓝图复制/适配，使用 PageTemplates/pm-*/GlobalPreference，先填 ui-check。

## 2. 步骤

1. 启动临时后端（temp env/port），确认 `/api/health`、runtime ready。
2. `POST /api/apps` 创建应用（designPack/designApplicationType/designStyle）。
3. 写入 `docs/requirements/MOD-001-*.md`（frontmatter module/title/order/template；内容覆盖组织树/员工/账号的核心规则即可）。
4. 调用 `POST /api/apps/:id/chat`（view=design，module=MOD-001，model=deepseek-flash）：
   - prompt：按 `adw-design-artifacts` 生成/更新 `design.json`，写 `designSystem`/页面契约（recipe/catalogRef/blueprint/filters/columns/rowActions/toolbarActions/selection/pagination/form/tree/components）；写/更新 `design-brief.md` 页面契约与冲突决策；不要改蓝图/需求；运行 validate 自查；不要写前端代码。
   - 等待 SSE idle/完成；记录耗时/tool 轨迹/退出状态。
5. 检查产物：design.json 契约字段、blueprint 是否存在、design-brief、tokens/prototypes（如设计视图未开，PNG 可缺失，记录）。
6. 调用 `POST /api/apps/:id/chat`（view=development，module=MOD-001，model=deepseek-flash）：
   - prompt：先读取设计系统/design.json/brief/tokens/蓝图；先填写 `docs/design/MOD-001/ui-check.md` 对照表；从 `docs/design/template/enterprise-application-platform/pages/OrganizationUsers.vue` 复制/适配到 `frontend/src/views/OrganizationView.vue`；使用 PageTemplates/pm-*/GlobalPreference；保留结构/样式/组件；替换 mock/接口为占位；不要改需求/设计/受管资源；不要 npm install；不要 git；完成后汇报。
   - 等待完成；记录耗时/轨迹。
7. 运行 `POST /api/apps/:id/design-fidelity`（module=MOD-001）；记录 checks/summary。
8. 如 fail/warn 明显且可修复：用同一开发会话让 agent 先读报告再修复（只修代码/ui-check），再跑一次检查；最多 1 轮，避免无限循环。
9. 收集证据：
   - `design.json` 页面契约字段；
   - `ui-check.md` 是否填写；
   - `frontend/src/views/OrganizationView.vue` 是否存在、是否 import PageTemplates、是否含 pm-* 标签/`pm-form-dialog`/`v-auto-height`/GlobalPreference；
   - fidelity checks 摘要；
   - 模型耗时、工具调用数、失败/中断；
   - 未实现/偏差/风险。
10. 停止临时后端/opencode；确认无残留端口。

## 3. 验收口径

- 不要求“完美还原”；重点验证：
  1. 设计 agent 是否写出**页面契约**（而非只有列/动作）；
  2. 开发 agent 是否**先填 ui-check**、是否**从蓝图复制**、是否使用 PageTemplates/pm-*；
  3. fidelity 检查是否能给出有意义的 pass/warn/fail；
  4. 记录模型仍偏离的地方（供后续 prompt/契约/模型优化）。
- 不要求生成物 `npm install`/启动；MF remote 依赖宿主 pm-*，本轮不做页面截图。
- 不要求 PNG 自动导出（未开设计视图可缺失）；记录即可。

## 4. 证据与文档

- 新建 `docs/plans/2026-11-19-p7-6b-real-model-brief.md` 记录：
  - 环境/端口/模型/时间；
  - 步骤与耗时；
  - 设计契约摘要；
  - ui-check 状态；
  - 实现文件/导入/pm-* 命中；
  - fidelity 结果；
  - 偏差/未验证/下一步。
- 更新 `docs/STATUS.md` P7-6b 状态（通过/部分通过/未通过 + 证据）。
- 不把临时应用/凭据/模型密钥写入仓库；只写摘要与路径。

## 5. 边界

- 不启停真实 3300；不读写真实 data/projects/.env；不 git；不部署；不调用真实模型以外的外部服务；不保存凭据。
- 如模型调用失败/额度不足/超时：记录错误与已得证据，停止，不伪造成功。
- 如需修改产品代码：先记录问题与建议，不在本轮直接改（除非是阻断测试的明显 bug，且需最小修复并说明）。

---

## 6. 实施结果（2026-11-19）

> 结论：**部分通过（带偏差）**。
> 设计 → 开发 → 一致性检查闭环已用真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash` 跑通：
> 设计写出完整页面契约，开发先填 ui-check、复制/适配蓝图并使用 PageTemplates/pm-*/GlobalPreference；
> fidelity **11 pass / 1 warn / 0 fail**（唯一警告为预期内的 PNG 未导出）。
> 偏差：开发会话在最后一次自查命令执行时被**另一个会话**调用 `/development/interrupt` 中止，
> 因而没有产出开发 agent 的最终文字汇报；中断前产物已落盘，已独立复核语法与一致性检查。
> 因开发会话未正常收尾、PNG/视觉/宿主/EOS 未验证，本轮记**部分通过**。

### 6.1 环境与时间

| 项 | 值 |
| --- | --- |
| 时间 | 2026-11-19 17:29:57 — 17:35:55（本地，约 5 分 58 秒） |
| 临时根 | `C:\Users\icecream\AppData\Local\Temp\workbench-p7-6b-RsoJCm`（`fs.mkdtempSync`） |
| 数据/应用目录 | `<临时根>\data`、`<临时根>\projects`（未碰真实 `data/`、`projects/`、`.env`） |
| 后端端口 | **3441**（临时） |
| opencode | 真实 2.2.5，serve 端口 **4741**（临时）；启动约 1.5s，`passwordCaptured=true` |
| 模型 | `packycode-deepseek/deepseek-flash`（显式传入 chat body，两个视图一致） |
| 应用 | `p7-6b-e2e`（临时）；设计系统 `afcenter-app-templates-v1 / enterprise-application-platform / platform-blue` |
| 真实实例 | 3300 / 4771 全程保持监听（PID 8100 / 11488），未启停、未请求、未读写 |
| 证据文件 | `<临时根>\evidence.json`、`backend.log`、`messages-<session>.json`、`artifacts-design/`、`trace-summary.json` |
| 驱动脚本 | `C:\Users\icecream\AppData\Local\Temp\opencode\p7-6b-driver.mjs`（临时，不进仓库） |

### 6.2 步骤与耗时

| 步骤 | 结果 | 耗时 |
| --- | --- | --- |
| 临时后端 `/api/health` | 通过 | 1.57s |
| opencode serve 就绪 | `runtime.ready=true`，v2.2.5，port 4741 | 启动后 4ms 即就绪（总启动约 1.5s） |
| 创建应用 + 设计系统 | HTTP 201，`appWarnings=[]`，5 页蓝图 | 196ms |
| 写入需求 fixture | `docs/requirements/MOD-001-组织与人员.md`，2,133B（组织树/员工/账号规则） | <10ms |
| 设计会话 | 完成（`done=true`），无权限/表单询问 | **90.47s** |
| 设计产物检查 + validate | `design.json` + `design-brief.md`；validate `ok=true`，0 errors / 0 warnings | ~100ms |
| 开发会话 | 产物完成；末尾被外部 interrupt（见 6.6） | **265.20s** |
| 开发产物检查 | ui-check=filled；`OrganizationView.vue` 18,141B / 497 行 | <10ms |
| fidelity 第 1 次 | 11 pass / 1 warn / 0 fail；无修复轮（仅预期 PNG warn） | 11ms |
| 清理 | `/api/opencode/stop` + 进程树结束；3441/4741 无残留监听 | <1s |

### 6.3 模型轨迹 / 工具数（来自 opencode messages）

| 会话 | messages | tool 调用 | 失败 tool | reasoning 段 | input / output / reasoning tokens | cache read |
| --- | --- | --- | --- | --- | --- | --- |
| 设计 | 13 | 20 | 0 | 11 | 37,372 / 7,079 / 7,837 | 330,368 |
| 开发 | 37 | 82 | 2（1 个路径读错 + 1 个被中断的 shell） | 35 | 87,808 / 16,506 / 30,259 | 3,226,368 |

- SSE 帧：设计 41 delta / 84 tool 事件；开发 19 delta / 341 tool 事件（part 级更新）；权限/表单事件均为 0。
- 设计轨迹：加载 `adw-design-artifacts` → 读需求/design-system/schema/example/蓝图 → 写 `design.json` → 写 `design-brief.md` → 运行 `validate.mjs` → 回读并修正两文件 → 再次 validate 通过。
- 开发轨迹：加载 `adw-frontend-implementation` → 读 AGENTS/design-system/design.json/brief/ui-check/需求/蓝图/structure/shared/style → glob + 读全量 `PageTemplates` 与团队/开发 skill → 先 `edit ui-check.md`（17:33:01）→ 复制 CSS（17:33:08）→ `write OrganizationView.vue`（17:33:11）→ 注册 `/organizations` → 接入 styles → 反复运行 `check-fidelity.mjs` 并修正 → 补「实现后」表。**先填 ui-check、后写页面**的顺序成立。

### 6.4 设计契约摘要（`docs/design/MOD-001/design.json`，5,077B）

- `designSystem`：`afcenter-app-templates-v1 / enterprise-application-platform / platform-blue`。
- 实体 3 个、关系 3 条：`org`（机构名称/编码/上级机构/负责人/状态/排序号，自关联 1:N）、`employee`（员工姓名/工号/所属机构/岗位/手机号/邮箱/在职状态，N:1 机构）、`account`（登录账号/所属员工/角色/状态/锁定状态/最近登录，N:1 员工）。
- `org-list`（type=list，recipe=tree-list）：`catalogRef=enterprise-application-platform/organization`，`blueprint=application-types/.../OrganizationUsers.vue`；filters 3、columns 8、rowActions 3（编辑/启用/禁用）、toolbarActions 3（新建账号/批量导入/批量分配角色）、`selection=true`、`pagination={three-part,10}`、`tree={机构名称/上级机构/none/background}`、`components={"状态":"pm-select"}`。
- `org-form`（type=form，recipe=dialog-form）：同页内嵌 `pm-form-dialog`，`form={dialog,2 列,560px,6 字段,2 分组}`，`components` 逐字段映射 `pm-input/pm-select/pm-switch`。
- `design-brief.md` 13,079B：含概览/导航/实体与关系/页面、**页面契约表**、**冲突与决策（11 条）**、未认领页面、组件与风格；与 design.json 一致。

### 6.5 ui-check / 实现 / 导入命中

| 检查 | 结果 |
| --- | --- |
| `docs/design/MOD-001/ui-check.md` | **filled**（骨架标记哈希不匹配＝已编辑）；5,884B；「实现前」「实现后」两表均无“待填”；含差异/决策与未实现项 |
| 实现文件 | `frontend/src/views/OrganizationView.vue`，18,141B / 497 行；结构与蓝图 `af-page-header` + `af-split` + `af-tree-panel` + `af-table-head` + `af-table-footer` 一致 |
| PageTemplates | `TreePanel`、`FormSection`、`RowActions`、`ThreePartPagination`（自 `@/components/PageTemplates`） |
| pm-* | `pm-input`、`pm-tree`、`pm-select`、`pm-table`、`pm-form-dialog`、`pm-switch`（6 种） |
| 列表指令 | `pm-table` 上 `v-auto-height`（1 处）；`pm-table` 是否透传该指令需宿主联调确认 |
| GlobalPreference | 已导入，`...GlobalPreference` + `templates.list/form` 在页面 computed 合并；未改全局单例 |
| 样式 | `frontend/src/styles/{structure,shared,style}.css` 三份与 `docs/design/template/**` 原件 SHA256 完全一致；页面与 bootstrap 均引入 |
| 路由 | `/organizations` → `OrganizationView.vue`；`@/views/OrganizationView.vue` 导入 |
| 语法 | 抽取 `<script setup>` 后 `node --check` 通过（中断后的最终文件） |
| 受管/源文件 | 开发阶段未改写需求（17:29:59）、design.json（17:31:18）、design-brief（17:31:21）、design-system.json、`docs/design/template/**` |

### 6.6 一致性检查（`POST /api/apps/p7-6b-e2e/design-fidelity`，module=MOD-001）

| # | 检查 | 状态 | 证据摘要 |
| --- | --- | --- | --- |
| 1 | 应用设计系统 | pass | pack v1.0.0 · 类型 · 风格 · 5 页蓝图 |
| 2 | 页面契约 | pass | 2 页均含 recipe 与 blueprint/catalogRef |
| 3 | 蓝图文件 | pass | 2 个蓝图文件均存在 |
| 4 | 实现视图/路由 | pass | 视图匹配 2/2；路由 2 条；两页均→OrganizationView.vue |
| 5 | PageTemplates | pass | FormSection、RowActions、ThreePartPagination |
| 6 | pm-* 组件 | pass | 6 个 |
| 7 | 表单弹窗/FormSection | pass | 1 个表单页使用 pm-form-dialog/FormSection |
| 8 | 列表 v-auto-height | pass | 1 个列表页使用 |
| 9 | GlobalPreference | pass | views/OrganizationView.vue |
| 10 | 结构/风格导入 | pass | bootstrap.js、OrganizationView.vue（含 visual-style-*） |
| 11 | ui-check 对照表 | pass | MOD-001: 已填 |
| 12 | PNG 原型 | warn | MOD-001 未导出（预期；未开设计视图/未截图） |

`summary = {pass: 11, warn: 1, fail: 0, total: 12, status: "warn"}`。中断后再次用应用内 CLI 独立复跑，结果一致（exit 0）。
因只有 1 个预期警告，**未触发修复轮**（brief 允许最多 1 轮）。

### 6.7 偏差 / 风险

1. **开发会话被外部中止**：17:35:54.725，另一个工作台会话（cwd=仓库根）调用 `POST http://localhost:3441/api/apps/p7-6b-e2e/development/interrupt`，导致最后一个 shell 自查工具 `aborted`、会话 `outcome=interrupted`，因此没有开发 agent 的最终文字汇报。证据：`messages-...json` 最后一条 `idle/interrupted`；本机 `opencode.log` 记录了该 interrupt 命令。**不是产品/模型失败**；产物与 fidelity 已独立复核。
2. **PNG/tokens 未生成**：本轮未打开设计视图、未做浏览器导出；fidelity 的 `prototypes` 警告属预期。未做截图与像素比对。
3. **未 install/build/运行生成物**：遵守 brief 未 `npm install`、未启动 MF remote；`pm-*` 由宿主提供，`v-auto-height` 在 `pm-table` 上是否生效、页面真实视觉均未验证。
4. **未实现项（开发 agent 已写入 ui-check）**：批量导入弹窗、批量分配角色弹窗、员工档案独立页、机构维护动作、员工选择器（`所属员工` 暂用 `pm-input`）。均为需求/模板未给出明确交互的待确认项，未伪造。
5. **驱动 prompt 路径笔误**：开发 prompt 写了 `docs/design/template/styles/platform-blue/style.css`，工作区实际是 `docs/design/template/styles/style.css`（`design-system.json` 也指向后者）；agent 先 read 失败，随后 glob 找到正确文件，未影响结果。属临时驱动脚本文案问题，不是产品 bug。
6. **契约 components 粒度**：`org-list.components` 只显式写“状态→pm-select”；树/表格/分页为页面级组件，由 brief 说明；`org-form.components` 完整。
7. **实现匹配仍是启发式**：`org-form` 因同页内嵌弹窗被匹配到 `OrganizationView.vue`，与合同一致，但检查器无法区分“同页弹窗”与“独立表单页”。
8. **动作/树枚举没有规范约束**：模型把 `rowActions/toolbarActions` 写成中文标签（编辑/新建账号/批量分配角色等），`tree.actionStyle=none`、`selectionStyle=background` 也不在团队约定（header/footer、platform/dot）内；fidelity 不校验这些枚举，属于契约规范/校验缺口，需后续统一。

### 6.8 未验证 / 后续

- 未验证：生成物 `frontend/` 的 `npm install` / `dev` / `build:prod`、真实 AFCenter 宿主与 `pm-*` 运行态、页面截图/像素比对、PNG 导出、EOS 构建与真实 3300。
- 后续建议：在宿主环境跑一次页面并补截图；确认批量导入/批量分配角色/员工选择器交互；修正开发 prompt/文档中风格 CSS 的路径写法（统一 `docs/design/template/styles/style.css`）；补 `rowActions/toolbarActions/tree` 枚举规范与 fidelity 校验；重跑一轮正常收尾的 P7-6b（避免外部 interrupt）以取得开发 agent 的最终汇报。

### 6.9 清理 / 环境确认

- 已调用 `POST /api/opencode/stop` 并结束临时后端进程树；清理后 3441/4741 **均无监听**，无残留 opencode serve。
- 真实 3300 / 4771 全程未动（仍在监听，PID 不变）；未读写真实 `data/`、`projects/`、`.env`；未执行任何 git 操作；未写入凭据/模型密钥。
- 临时目录保留用于复核：`C:\Users\icecream\AppData\Local\Temp\workbench-p7-6b-RsoJCm`（含 evidence/messages/产物副本）。
- 仓库内证据副本：`docs/plans/evidence/2026-11-19-p7-6b/`（design.json / design-brief.md / ui-check.md / OrganizationView.vue / evidence.json / driver.log）。

---

## 7. P7-6b 复跑（2026-11-20，通过）

> 目的：验证 P7-6c 的 SSE 自动收尾修复；同一驱动脚本、全新临时目录/端口、真实模型。

| 项 | 结果 |
| --- | --- |
| 临时根目录 | `C:\Users\icecream\AppData\Local\Temp\workbench-p7-6b-MBbEuZ` |
| 环境 | 后端 3441 / opencode 4741；`packycode-deepseek/deepseek-flash`；未碰真实 3300/4771 |
| 设计会话 | **93,327ms**；无 error；design.json 2 页面 + designSystem；design-brief 落盘 |
| 开发会话 | **234,491ms**；无 error；`done=true`；finalText 2,409 字符；**未人工 interrupt** |
| ui-check | `filled` |
| 实现 | `OrganizationView.vue` 17,931B/532 行；PageTemplates（FormSection/RowActions/ThreePartPagination）；pm-*（pm-input/pm-tree/pm-select/pm-table/pm-form-dialog/pm-switch）；v-auto-height 2；GlobalPreference；路由 `/organizations` |
| fidelity | **11 pass / 1 warn / 0 fail**；warn 仍为 PNG 未导出；无需 fix round |
| 软校验 | validate 捕获 1 条 warning：`toolbarActions[2]="batchAssignRole"` 不在推荐动作码；保留原值、不阻断 |
| 风格路径 | 新应用 `design-system.json.styles.style = docs/design/template/styles/platform-blue/style.css`，`styleId=platform-blue`，文件存在 |
| 清理 | 临时后端/opencode 已停止；3441/4741 无监听；真实 3300 未动；未 git |

结论：

- **P7-6c 的 SSE 修复有效**：本轮开发会话在模型完成后自动收尾，`done=true`，无需人工 interrupt；P7-6b 从“部分通过”提升为**通过（工具链/产物/收尾）**。
- 软枚举校验生效：`batchAssignRole` 被标 warning，模型动作码口径问题可被看见。
- 风格路径已统一为 `<styleId>/style.css`，fidelity 通过。
- 仍保留的未验证：生成物 `npm install`/`build`/页面截图、真实 AFCenter 宿主 pm-*、EOS 运行态、PNG 导出；视觉“截图 vs 蓝图”仍待宿主环境。
- 复跑证据：`docs/plans/evidence/2026-11-20-p7-6b-rerun/`。


