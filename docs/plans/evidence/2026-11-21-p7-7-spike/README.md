# P7-7 设计模板工作室 Spike 证据（2026-11-21）

> 对应设计稿：[`docs/plans/2026-11-21-p7-7-custom-design-template-agent-design.md`](../../2026-11-21-p7-7-custom-design-template-agent-design.md)。

## 目的

为 `docs/plans/2026-11-21-p7-7-custom-design-template-agent-design.md` 提供**不调模型**的技术验证：

- A. opencode 2.2.5 的 `permission.edit` / `bash` 是否能做目录/文件/命令白名单；
- B. 临时工作区里的 `.opencode/skills` + `.opencode/commands` 能否被加载；
- C. 从内置 pack + 蓝图生成 catalog 是否可行（页面/组件/用法片段/契约映射）；
- D. 4 套 `structure.css` 合并/去重/冲突规模；
- E. 直接用前端纯函数构造 contract 页面预览是否可行；
- F. 把会话/对话从 app 强绑定抽 `ChatTarget` 的影响面（只读评估）。

## 环境

| 项 | 值 |
| --- | --- |
| 仓库 | `E:\work_space_primeton\ai-dev-workbench` |
| 操作系统 | Windows（win32 x64） |
| Node | 20.20.1 |
| opencode | **2.2.5**（真实二进制，`@opencode/cli`） |
| 模型 | **未调用**（全部 spike 均不产生模型请求） |
| 临时目录 | `%TEMP%\workbench-p7-7-spike` |
| 独立端口 | 4783（B）、4785（B3）；未使用/未触碰 4771 |
| 真实数据 | 未读写 `data/`、`projects/`、`.env`；未启停 3300/4771 |

## 文件

| 文件 | 说明 |
| --- | --- |
| `spike-a-opencode-permission.md` | A 的结论与证据引用 |
| `extract-a-config.mjs` | 从 `opencode debug config` 输出中提取工作区文档（剔除全局 provider 配置） |
| `opencode-a1.json` / `opencode-a2.json` | V1 对象 / V2 数组配置样例 |
| `spike-a1-workspace-config.json` / `spike-a2-workspace-config.json` | `opencode debug config` 归一化后的工作区文档（已剔除全局 provider 配置） |
| `spike-b-skill-load.mjs` / `spike-b-result.txt` | B：临时工作区 skill/command 加载脚本与输出 |
| `spike-b3-location-isolation.mjs` / `spike-b3-result.txt` | B3：会话 location 为草稿子目录时**不继承**祖先 `.opencode` 的负结果 |
| `spike-c-catalog-scan.mjs` / `spike-c-result.txt` / `spike-c-catalog.json` | C：catalog 扫描脚本、摘要与完整 JSON |
| `spike-d-css-merge.mjs` / `spike-d-result.txt` / `spike-d-css.json` | D：CSS 合并/冲突脚本与结果 |
| `spike-e-contract-preview.mjs` / `spike-e-result.txt` / `spike-e-contract.json` | E：contract 预览纯函数验证（list/tree-list/dialog-form/dashboard/detail） |
| `spike-f-chat-target.md` | F：`ChatTarget` 抽取评估 |

> 所有脚本均位于 `%TEMP%`（不进入产品目录）；本目录中的副本仅作证据。
> `spike-b-serve.log` / `spike-b2-serve.log` 含 serve 临时密码，**未复制**。

> 说明：A 的证据里 shell 命令样例写作 `.mjs` 是 spike 当时的占位命名；设计稿最终采用 `.cjs`（语义相同）。

## 命令（可复跑）

> 复跑前把本目录的 `*.mjs` 脚本复制到 `%TEMP%\workbench-p7-7-spike`（脚本按该路径写临时工作区）；
> 结束时删除临时目录。

```powershell
$root = Join-Path $env:TEMP 'workbench-p7-7-spike'
New-Item -ItemType Directory -Force -Path "$root\ws-a1", "$root\ws-a2" | Out-Null
Copy-Item .\opencode-a1.json "$root\ws-a1\opencode.json"
Copy-Item .\opencode-a2.json "$root\ws-a2\opencode.json"
Copy-Item .\spike-*.mjs, .\extract-a-config.mjs $root

# A：配置归一化（不启动 serve）
cd "$root\ws-a1"; opencode debug config > "$root\debug-config-A1.txt"
cd "$root\ws-a2"; opencode debug config > "$root\debug-config-A2.txt"
node "$root\extract-a-config.mjs" "$root\debug-config-A1.txt" "$root\spike-a1-workspace-config.json" ws-a1
node "$root\extract-a-config.mjs" "$root\debug-config-A2.txt" "$root\spike-a2-workspace-config.json" ws-a2

# B：起临时 serve（4783）→ 创建空会话 → 列 skills/commands → 杀进程
node "$root\spike-b-skill-load.mjs"

# B3：location 为 drafts/<id> 时是否继承祖先 .opencode（负结果）
node "$root\spike-b3-location-isolation.mjs"

# C / D / E
node "$root\spike-c-catalog-scan.mjs" --json-out "$root\spike-c-catalog.json"
node "$root\spike-d-css-merge.mjs" --json-out "$root\spike-d-css.json"
node "$root\spike-e-contract-preview.mjs" --json-out "$root\spike-e-contract.json"
```

## 结果摘要

### A. opencode 权限语义

- `permission.edit` 的对象键就是 glob pattern；2.2.5 会把它**归一化为有序 V2 `permissions` 数组**，
  顺序保留；
- `permission.bash` 归一化为 `action: "shell"`；
- 规则语义为 **last matching rule wins**，因此 `{"*":"deny","spec.json":"allow","drafts/**":"allow"}`
  可用（宽规则在前、白名单在后）；
- `external_directory`、`skill` 也属于 permission 动作，可显式 deny/allow；
- **未做真实工具调用**：只验证配置被接受/归一化，未验证模型触发写文件被拒。

### B. 临时工作区 skill/command 加载

- 临时目录 `.opencode/skills/adw-design-template-authoring/SKILL.md` + `.opencode/commands/generate-design-template.md`；
- 独立端口 4783 启动 `opencode serve`，从 stdout 捕获 Basic Auth 密码；
- **必须先创建一个空会话**（不发 prompt、不调模型）初始化 location，否则 `/api/skill` 只有内置 skill；
- 结果：location 初始化后 **约 500ms** 加载到项目级 skill `adw-design-template-authoring` 与 command
  `generate-design-template`（`/api/skill`、`/api/command` 均 200）；
- 同时可见全局/内置 skills（该机器上有 27 个），说明工作室若需要“只看工作室 skill”，应使用
  `skill` 权限或 UI 过滤（本 spike 未验证实际隐藏效果）。

### B3（负结果，影响架构选择）

- 把会话 location 设为 `studio/drafts/<id>`、而 `.opencode` 放在 `studio/` 根时，
  `/api/skill` / `/api/command` **没有加载祖先目录的 skill/command**（只有内置）；
- 结论：若采用“每草稿独立 location”，必须把 `.opencode` + `opencode.json` **复制进草稿目录**；
  本期设计选择 **location = 工作室根**（共享 `.opencode`/catalog），由权限 pattern + 草稿校验约束。

### C. catalog 可行性（内置 pack）

| 指标 | 数值 |
| --- | --- |
| 应用类型 | 4 |
| 页面 | **25**（企业 5 / 运营 8 / 数据 8 / 工具 4） |
| 风格 | 4 |
| 组件并集 | **39** |
| 契约渲染器可映射为控件的组件 | **13 / 39**（`COMPONENT_CONTROLS` 映射表共 **20 键**；设计目标为共享 `component-controls.json`，13/39 不变） |
| 未被映射的组件 | 26（多为容器/展示：pm-table/pm-search/pm-toolbar/pm-tree/pm-form-dialog/pm-echarts/pm-steps 等） |
| pack 声明的页面组件 vs 蓝图扫描 | **完全一致**（无 onlyDeclared / onlyScanned） |
| componentMap 条目 | 14 |
| pageRecipes | 8 |

高频组件（被页面引用数 / 标签引用数）：`pm-select` 24/97、`pm-input` 19/41、`pm-table` 18/21、
`pm-form-dialog` 14/17、`pm-search` 13/18、`pm-pagination` 12/15、`pm-textarea` 12/14、
`pm-toolbar-item` 9/52、`pm-toolbar` 9/21、`pm-switch` 8/16、`pm-datepicker` 7/7、`pm-echarts` 6/6、
`pm-steps` 6/6、`pm-tree` 4/4、`pm-dialog` 4/4。

真实用法片段可提取（示例）：

```html
<pm-auto-number size="default" v-model="form.code" readonly />
<pm-calendar :data="calendarData" :options="calendarOptions" pk-field="id" />
<pm-datepick-range size="default" v-model="form.activeStart" v-model:value2="form.activeEnd" type="date" value-format="YYYY-MM-DD" />
<pm-select v-model="form.category" ... />
```

结论：catalog 可以从 pack + 蓝图稳定生成；组件用法片段用“标签起始片段”即可满足 agent 参考，
不需要 Vue AST。页面/组件/引用次数/契约支持标注都可自动生成。

### D. CSS 合并/冲突（4 套 structure.css）

| 指标 | 数值 |
| --- | --- |
| 4 套规则总数 | **793** |
| 唯一（@media + 选择器）键 | **509** |
| 唯一（@media + 选择器 + 规则体）三元组 | **514** |
| 完全相同三元组可去重节省 | **279** 条 |
| 跨类型“同选择器 + 同规则体” | **131** 个选择器键 |
| 跨类型“同选择器 + 不同规则体”（真冲突） | **3** 个 |
| 同文件内重复选择器的合法级联变体 | 2 个（根类变量/主题重复声明） |

真冲突仅：

1. `.pm-upload-copy`（data 类型多 `align-items:center`）；
2. `.pm-search-main`（data 类型是 grid + 边框/阴影）；
3. `.pm-search-body`（data 类型有左侧色条/渐变背景）。

其余差异是各类型特有的前缀类（`.af-*`、`.ops-*`、`.dg-*`、`.ir-*`），不会互相命中。

推荐算法：按页面首次引用顺序拼接来源类型的 `structure.css`；以
`@media 条件 + 规范化选择器 + 规范化规则体` 三元组去重（保留首次出现）；同选择器不同规则体**全部保留且记录冲突**；
按来源类型分节加注释；不解析/重写规则体（只做空白规范化用于比较）。详见设计稿附录 D。

### E. contract 预览可行性

直接用 `node` import `frontend/src/design/design-adapter.js` + `frontend/src/design-preview/contract-preview.js`
（不改纯函数），构造一个 10 字段 sampleEntity + list / tree-list / dialog-form / dashboard / detail 契约：

- **18/18 检查通过**；
- list：`buildColumns` 6 列并跳过 `ghostColumn`；`buildFilters` 3 个查询并跳过 `unknownField`；
- dialog-form：`width=1200` 被 clamp 到 **900**；2 组、字段缺失 `missingField` 被跳过；
- tree-list：`buildTreeRows` 正常嵌套；
- dashboard：3 指标 + 饼图 series；
- detail：10 字段 + hero + 时间线。
- **发现既有小问题**：`buildTreeRows` 在“同一个子节点标签第二次出现”时会把已挂载的子节点再次 push 到
  `roots`（我们构造的 24 行重复 4 个机构时出现；每个机构只出现一次时正常）。本期不改 P9 纯函数，
  contract 页的 sampleEntity/预览数据应保证 `titleField` 唯一，并在 P7-7 设计稿风险中记录。

### F. `ChatTarget` 抽取评估

- 强绑定点不只在 `chat/service.ts`：**前端实际走 `dev/service.ts` 的 `/development/*`**（prompt/state/sessions/
  interrupt/compact/permission/form），所以工作室复用 `AgentChatPanel` 必须同时覆盖 `dev/service.ts`；
- 建议 **`AppView` 保持三值**，新增 `SessionView = AppView | 'template'` 与 `isSessionView`；
  应用路由仍用 `isAppView`（拒绝 template），工作室用 `isSessionView`；`app_sessions.view` 是 TEXT，无迁移；
  合成 `app_id = __template__:<packId>`（无 FK）；
- 建议保留 `handleAppChat(app,...)` 作为 `handleChat(target,...)` 的等价包装，`dev/service.ts` 内部改 target、
  对外签名不变；
- 影响测试：`chat/service.test.ts`（12 条）、`dev/service.test.ts`（9 条）为主；`e2e:p2/p3/p4` 使用前端 stub，
  理论断言不变但必须回归（p4 覆盖 sessions/rename/archive/compact）；
- 详细清单见 `spike-f-chat-target.md`。

## 总体结论

1. **方案可行**：权限（A）、临时工作区技能加载（B）、catalog（C）、CSS 合并（D）、contract 预览（E）均有实证。
2. **架构选择**：工作室使用共享 location（studio 根）+ V2 `permissions` 白名单；每草稿独立 location 需要复制
   `.opencode`，本期不采用。
3. **最大未验证项**：真实模型是否按 skill 写 spec、真实工具调用是否被权限正确拒绝（留给 P7-7c，本轮不跑）。

## 限制

- A：只验证配置归一化，未触发真实工具调用；`skill` deny 的实际隐藏效果未验证。
- B/B3：空会话初始化 location，**未发送 prompt、未调用模型**；不代表模型回合中 skill 内容一定被采纳。
- C：组件“契约支持”仅按 `contract-view.js#COMPONENT_CONTROLS`（设计目标为共享 `component-controls.json`，20 键）
  与 39 组件并集的 13 个交集判断；容器组件由 `ContractPage` 固定结构渲染，不等于“可任意配置属性”。
- D：只解析模式化 CSS（一行/多行规则 + @media）；模板 CSS 当前无 `url(...)`，
  若未来引入资源 URL 需要扩展资产复制。
- E：纯函数验证，不代表浏览器真实渲染；树重复问题是既有行为，未在本轮修复。
- F：只读评估，未改代码、未跑抽取后的回归。

## 评审补充（2026-11-21）

评审确认后发现若干**结论/口径补充**（不修改上面的原始 spike 结果）：

1. **权限路径口径**：spike A 只验证了配置被接受并归一化为有序 `permissions`，**没有真实工具调用**，
   因此无法确认 edit 的 `resource` 是 location 相对路径还是绝对路径。设计稿采用
   `*drafts/*/spec.json` / `*drafts/*/notes.md`（前导 `*` 覆盖绝对/相对两种形式），并在 P7-7b 用真实工具调用复核；
   生成/发布 API 仍会二次校验当前草稿，权限误放行不能绕过发布校验。
2. **内置蓝图可读性**：设计稿增加 `_workshop/catalog/builtin/` 只读镜像（36 文件、约 580KB），
   catalog 的 `readPath` 指向镜像；工作室保留 `external_directory: deny`。本目录的 C 结果（25 页/39 组件/13 个
   可映射控件）来自仓库内置 pack，镜像不改变这些数字。
3. **校验权威**：设计稿写死后端 `pack.ts#validatePackDir` 为发布/运行时权威；本目录生成/校验脚本只作预检，
   不能替代发布校验。这与上层“共享核心单一实现”的表述不冲突：核心负责生成，权威校验仍在 pack.ts。
4. **组件控件映射**：C 的原始脚本按 `contract-view.js#COMPONENT_CONTROLS` 统计（20 键 ∩ 39 = 13）；
   设计稿改为共享 `templates/design-system/component-controls.json`，前端/后端都消费它，**13/39 数字不变**，
   后端不再解析前端 JS。

以上补充不改变 A—F 的原始输出文件；原始脚本/结果保持原样。
