# Spike A：opencode 2.2.5 权限语义（不调模型）

## 目的

确认 P7-7 模板工作室能否用 opencode 配置把 agent 的写权限限制在“草稿 spec.json / notes.md”，
并把 shell 限制在生成/校验脚本；同时确认现有应用 `opencode.json` 的 V1 写法是否仍然有效。

## 环境

| 项 | 值 |
| --- | --- |
| 操作系统 | Windows（win32 x64） |
| opencode | **2.2.5**（`opencode --version`） |
| 二进制 | `E:\applications\nodejs20\node_global\node_modules\@opencode\cli\bin\opencode.exe` |
| 配置 schema | `https://opencode.ai/config.json`（与 2.2.5 对应；本机 `opencode debug config` 接受并归一化）；**未**在 259MB 单文件二进制中检索内嵌 schema |
| 临时目录 | `%TEMP%\workbench-p7-7-spike\ws-a1`、`ws-a2` |
| 模型 | **未调用**（只做 `opencode debug config` 配置归一化） |

## 配置样例

- `opencode-a1.json`：V1 对象写法（与现有应用 scaffold 相同）
  ```json
  {
    "$schema": "https://opencode.ai/config.json",
    "permission": {
      "edit": { "*": "deny", "spec.json": "allow", "drafts/**": "allow" },
      "bash": { "*": "ask", "node .opencode/scripts/generate.mjs *": "allow" }
    }
  }
  ```
- `opencode-a2.json`：V2 数组写法（推荐）
  ```json
  {
    "$schema": "https://opencode.ai/config.json",
    "permissions": [
      { "action": "edit", "resource": "*", "effect": "deny" },
      { "action": "edit", "resource": "drafts/**/spec.json", "effect": "allow" },
      { "action": "edit", "resource": "drafts/**/notes.md", "effect": "allow" },
      { "action": "read", "resource": "*", "effect": "allow" },
      { "action": "shell", "resource": "*", "effect": "ask" },
      { "action": "shell", "resource": "node .opencode/scripts/*", "effect": "allow" },
      { "action": "external_directory", "resource": "*", "effect": "deny" },
      { "action": "skill", "resource": "*", "effect": "deny" },
      { "action": "skill", "resource": "adw-design-template-authoring", "effect": "allow" }
    ]
  }
  ```

## 命令

```powershell
# 在临时工作区内执行（只读本机配置，不启动服务、不调用模型）
cd %TEMP%\workbench-p7-7-spike\ws-a1
opencode debug config > ..\debug-config-A1.txt

cd %TEMP%\workbench-p7-7-spike\ws-a2
opencode debug config > ..\debug-config-A2.txt

# 只提取工作区文档，避免把全局 provider 配置带入证据
node ..\extract-a-config.mjs ..\debug-config-A1.txt ..\spike-a1-workspace-config.json ws-a1
node ..\extract-a-config.mjs ..\debug-config-A2.txt ..\spike-a2-workspace-config.json ws-a2
```

## 结果

### 1. schema 同时接受 V1 `permission` 与 V2 `permissions`

`https://opencode.ai/config.json`（2.2.5 对应版本）中：

- `permission`（**deprecated**）→ `#/$defs/PermissionConfig`：
  `read / edit / glob / grep / list / bash / task / external_directory / todowrite / question / webfetch / websearch / lsp / doom_loop / skill`；
  每个值可以是 `"allow" | "deny" | "ask"`，或 `{ "<pattern>": "allow|deny|ask" }` 对象。
- `permissions`（V2）→ `#/$defs/Permission.Ruleset`：有序规则数组
  `{ action: string, resource: string, effect: "allow" | "deny" | "ask" }`。

官方 V2 文档说明：**最后匹配的规则生效**（last matching rule wins）；配置加载顺序为
低优先级在前、全局规则在后、agent 规则最后追加。

### 2. V1 对象写法会被 opencode 归一化成有序 V2 规则（关键证据）

`spike-a1-workspace-config.json`（`opencode debug config` 的工作区文档）实际输出：

```json
{
  "permissions": [
    { "action": "edit", "resource": "*", "effect": "deny" },
    { "action": "edit", "resource": "spec.json", "effect": "allow" },
    { "action": "edit", "resource": "drafts/**", "effect": "allow" },
    { "action": "shell", "resource": "*", "effect": "ask" },
    { "action": "shell", "resource": "node .opencode/scripts/generate.mjs *", "effect": "allow" }
  ]
}
```

结论：

- **`permission.edit` 支持目录/文件 glob 白名单**（对象键即 pattern），并且顺序按 JSON 书写顺序保留；
- **`bash` 在 V1 里映射为 V2 的 `shell`**，同样可用命令 pattern 限制；
- 因为 last match wins，`{"*":"deny","spec.json":"allow","drafts/**":"allow"}` 的语义是：
  默认拒绝写，`spec.json` 与 `drafts/**` 允许写（**依赖顺序，必须把宽规则写在前面**）；
- 现有应用 `opencode.json` 的 V1 写法仍然有效，**不需要迁移**。

### 3. V2 数组写法直接生效

`spike-a2-workspace-config.json` 显示 `permissions` 数组原样保留（包括 `read`、`external_directory`、`skill`）。

### 4. bash/shell 可限制，但命令文本由 scanner 分析

官方（V1/V2）文档明确：

- shell 的 resource 是 **scanner 解析出的命令字符串**；复合命令可能产生多条检查；
- 无法安全分析/动态求值的命令返回 scanner error，不会执行；
- 以 ` *` 结尾的 pattern 也匹配无参数命令（如 `git status *` 匹配 `git status`）；
- shell 以宿主用户权限运行，目录推断是 best-effort，**应使用窄 allowlist，不要试图用 pattern 覆盖所有危险命令**。

### 5. 没有运行时验证的部分

本 spike 没有调用模型，因此没有真正触发一次“模型尝试写 `.opencode/**` 被拒”的工具调用；
只验证了**配置被接受、被归一化、顺序与文档一致**。真实运行时拒绝/询问行为留给 P7-7b 的
真实 opencode（仍可不调模型，靠手工构造工具调用）或 P7-7c 的真实模型闭环。

## 对 P7-7 的结论与建议

**采用 V2 `permissions` 数组写工作室配置**（比 V1 对象更直观、顺序明确、未来兼容），建议：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permissions": [
    { "action": "edit", "resource": "*", "effect": "deny" },
    { "action": "edit", "resource": "drafts/*/spec.json", "effect": "allow" },
    { "action": "edit", "resource": "drafts/*/notes.md", "effect": "allow" },
    { "action": "read", "resource": "*", "effect": "allow" },
    { "action": "shell", "resource": "*", "effect": "deny" },
    { "action": "shell", "resource": "node .opencode/scripts/generate.mjs *", "effect": "allow" },
    { "action": "shell", "resource": "node .opencode/scripts/validate.mjs *", "effect": "allow" },
    { "action": "external_directory", "resource": "*", "effect": "deny" }
  ]
}
```

- `skill` 可用 `{"*":"deny"}` + 白名单来控制“只能加载工作室 skill”（见下方限制：未运行时验证）；
- 工作室目录固定为 location，`external_directory: deny` 阻止读写工作室之外；
- **生成器二次校验**仍是必须的：权限只限制“写哪里”，不保证 spec 内容正确；发布前必须跑生成器校验。

## 若不支持/行为不符时的兜底

1. 退回 V1 `permission.edit` 对象写法（本 spike 已证明会被归一化，现有应用已在用）；
2. 不依赖 agent 写文件：让 agent 只输出 spec JSON 到聊天，后端解析后写盘（权限可全 deny edit）；
3. 每草稿独立 location + 把 `.opencode` 复制进草稿目录（spike B3 证明祖先目录的 `.opencode` 不会被加载；
   复制后可做到“每个草稿只能写自己的 spec.json”，代价是资产重复与初始化变慢）。

## 限制

- 未启动 serve、未调用模型、未触发真实工具调用；
- 未验证 `skill` 权限 deny 后 `/api/skill` 的实际可见性（文档描述与代码行为需 P7-7b 复核）；
- 未验证 `external_directory` 在 Windows 盘符/UNC 路径下的规范化细节；
- 全局配置（`~/.config/opencode/opencode.json`）会与项目配置合并；工作室仍需以项目级 rules 覆盖默认 allow。

## 评审补充（2026-11-21）

评审指出：本 spike 仅验证配置归一化，**未验证真实 edit resource 是 location 相对还是绝对路径**。
设计稿因此把工作室 allow 规则写成 `*drafts/*/spec.json` / `*drafts/*/notes.md`（前导 `*` 覆盖两种形式），
并在 P7-7b 用真实工具调用复核；生成/发布后端再次校验当前草稿，权限结果不作为唯一保障。
原始 A1/A2 配置与归一化输出未修改。
