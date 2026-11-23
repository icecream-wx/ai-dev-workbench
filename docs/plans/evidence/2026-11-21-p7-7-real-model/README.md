# P7-7c-2 真实模型闭环证据（2026-11-21）

临时实例 + 真实 opencode 2.2.5 + 真实模型 `packycode-deepseek/deepseek-flash`，跑通
**模板工作室 → 真实 agent 写 spec → 生成 → 发布 → 新建应用 → 设计预览/PNG → fidelity**。
未触碰真实 3300/4771、真实 `data/`/`projects/`/`.env`；未执行 git。

## 1. 环境

| 项 | 值 |
| --- | --- |
| 临时根 | `C:\Users\icecream\AppData\Local\Temp\workbench-p7-7-real-s8BRUr`（`fs.mkdtempSync`） |
| 后端 | `127.0.0.1:3487`（`node backend/dist/index.js`） |
| opencode serve | `127.0.0.1:4787`（真实 2.2.5；`OPENCODE_AUTO_START=true`） |
| 模型 | `packycode-deepseek/deepseek-flash`（63 个候选模型中命中；工作室 `PUT /studio/model` 显式设置） |
| 草稿/模板 | `supplier-management` / 「供应商管理模板」 / `data-cyan` |
| 应用 | `p77c2-real`（P7-7C-2 真实模型闭环） |
| 时间 | 2026-11-21 21:35:18 — 21:38:21（约 3 分 3 秒，含预览/PNG/fidelity） |

## 2. 结果总览

| 步骤 | 结果 |
| --- | --- |
| 工作室真实会话 | 成功；opencode `ses_e01ae7141fferiTjGGiWEbVKZD`；模型 deepseek-flash |
| 首条 prompt 到收尾 | **64,149ms**；21 条消息 / **29 次工具**；1 次权限拒绝 |
| `spec.json` | 3 页：`supplier-list`（reference `operations-management/list`）、`supplier-form`（contract `dialog-form`）、`supplier-detail`（contract `detail`）；`data-cyan`；`baseApplicationType=operations-management` |
| 生成 | agent 自行运行 `generate.cjs`：**errors 0 / warnings 0**，3 页，212 条 CSS 规则，0 冲突 |
| 发布 | **1.0.0**；`GET /api/design-system` 可见 `templateKind=custom` |
| 新建应用 | `POST /api/apps` 选自定义 pack；`docs/design/design-system.json`（origin/preview/kind/contractFile）、reference 蓝图、2 个契约 JSON、合并 structure、`styles/*`、`adw-template-proto-supplier-management` skill 齐全 |
| 设计预览 | 自定义 structure 注入 > 1000 字符；`data-cyan` 风格类；base 短类 `application-type-operations`；`template-kind=custom` |
| PNG | 3 页（`supplier-detail` / `supplier-form` / `supplier-list`）；2880×1800；data-cyan 主色像素 2011 |
| fidelity | 13 项：**pass 5 / warn 8 / fail 0**；`template-contract` **pass**；`prototypes` pass；`blueprint-files` pass（contract 页不计蓝图） |
| 浏览器 | 设计视图/预览/开发视图 0 console error / 0 pageerror / 0 请求失败 / 0 外部请求 |
| 清理 | 3487/4787/3300/4771 均无监听；真实实例未被本会话启停 |

`fidelity` 的 8 个 warn 都是**未实现前端**导致的（实现视图/PageTemplates/pm-*/GlobalPreference/样式导入/ui-check），
不是契约或模板问题：`template-contract`、`blueprint-files`、`page-contract`、`design-system`、`prototypes` 均 pass。

## 3. 真实权限/越界检查

agent 实际工具调用（`messages-summary.json`）：

- `write drafts/supplier-management/spec.json`、`write drafts/supplier-management/notes.md`：**允许**；
- `shell node .opencode/scripts/generate.cjs --draft supplier-management`：**允许**并成功；
- `shell node .opencode/scripts/validate.cjs --draft supplier-management`：**允许**并成功；
- `shell Get-ChildItem -Force drafts ...`：**被拒绝**，事件 `error.type=permission.rejected`、`message=Permission denied: shell`；
  模型随后改用 `read`/`glob`/`grep` 继续，未卡死。

前后 hash（`hash-before.json` / `hash-after.json`）：

| 范围 | 结果 |
| --- | --- |
| `_workshop/catalog/**`（48 文件） | 未变化（added/removed 均空） |
| `_workshop/.opencode/**`（9 文件） | 未变化 |
| `projects/**`（prompt 前为空） | 未变化 |
| 仓库 `backend/src` + `frontend/src` + `templates/{design-system,workshop,agent}`（474 文件） | 未变化（sha256 相同） |
| 草稿 `pack/` | 由生成脚本写入（允许），见 `generation.json` |

## 4. 真实模型发现与最小修复

**首轮真实运行暴露阻塞性问题**：模型 8.7 秒、10 次 `read` 后被误判为 `succeeded`，`spec.json` 仍为 0 页，
驱动因此提前收尾。查看 opencode 会话导出（`pre-fix-early-stop/session-export.json`）确认最后一条 assistant
`finish=tool-calls`（还有下一轮），且会话 `time.busy` 是**时间戳**（`1795267894965`），不是 boolean。

问题在 `backend/src/opencode/session-state.ts`：

1. `transcriptComplete()` 把任意 `finish`（含 `tool-calls`）当作收尾；
2. `sessionCompletion()` 只认 `time.busy === true || time.busy === 1`，时间戳被当成“不忙”。

修复（最小）：

- `finish` 为 `tool-calls / tool_calls / tool-use / tool_use` 时不算收尾；
- `time.busy` 为任意有限正数时间戳时视为仍在忙；
- `backend/src/chat/service.test.ts` 增补 3 条断言（tool-calls 不收尾、finish=stop 可收尾、数字 busy 不收尾）。

修复后同一 prompt 复跑：模型正常继续读取 → 写 spec（write）→ 运行生成/校验 → 中文汇报，耗时 64s。
证据见 `pre-fix-early-stop/`（修复前）与根目录文件（修复后）。此修复同时影响应用需求/设计/开发视图的“完成判定”，
避免长工具/多轮工具调用被提前标成完成。

## 5. 偏差与说明

1. **`baseApplicationType`**：草稿创建时按要求为 `enterprise-application-platform`；模型按技能 §7
   “reference 来源类型优先”写成 `operations-management`。生成/skill/design-system/预览均以
   `operations-management` 为 base（短类 `application-type-operations`），参考页与结构样式同源、只合并一份。
   这是模型合理默认，不是错误；任务里的“base=enterprise”只作为草稿初值。
2. **agent 主动生成**：模型自己运行了 `generate.cjs` 与 `validate.cjs`，未使用后端 `POST /generate` 兜底
   （`generation.json` 与工具的 `generate.cjs: completed` 一致）。
3. **reference 页语义**：模型在汇报中明确“列表页原样复制源蓝图，标题仍是源页公告文案”，并给出改用
   `contract + list` 的选项。这是 reference 快照语义的固有限制，与设计稿一致。
4. **驱动脚本分两段**（均为临时脚本，不进仓库）：
   - 第 2 次完整运行在“复制契约到证据目录”时因**驱动脚本未建目标目录**失败（产品/模型步骤均已成功）；
   - 随后 `resume.cjs` 复用同一临时根补齐应用校验/预览/PNG/fidelity，**未重复调用模型**；
   - 续跑两次分别因 Playwright 路径与 `tokens.json` 白名单（驱动侧）修正，最终 71 条断言通过。
   这些是驱动问题，已在 `driver.log` 保留，不计为产品失败。
5. **ui-check 未生成**：本轮未启动开发会话（不做额外模型调用），fidelity 的 `ui-check` 为 warn；
   digest/ui-check 的契约页识别已由 `e2e:p7-7c`（108 断言，stub）覆盖。
6. **非阻塞观察（未修）**：预览/PNG 中同一行的多个枚举列显示同一选项，原因是
   `frontend/src/design-preview/contract-preview.js#mockFieldValue` 的既有确定性 mock 规则
   （`options[i % options.length]`）；不影响契约/模板/渲染结论，本轮不扩大范围修改。

## 6. 证据文件

| 文件 | 说明 |
| --- | --- |
| `spec.json` | 真实模型写的 3 页 spec（reference + 2 contract） |
| `generation.json` | 生成报告（0 error / 0 warning / 212 CSS 规则 / 0 冲突） |
| `pack.json` / `publish.json` | 发布后的 pack（1.0.0）与发布结果 |
| `design-system.json` / `design-system-pages.json` | 应用受管设计系统摘要与页面（kind/source/contractFile） |
| `contracts/*.json` | `supplier-form` / `supplier-detail` 契约副本 |
| `design.json` | 应用 fixture 设计产物（3 页/1 实体，用于预览与 fidelity） |
| `fidelity.json` | 13 项只读报告（pass 5 / warn 8 / fail 0） |
| `png.json` | PNG 页清单 + 尺寸/主色采样 |
| `messages-summary.json` | 脱敏后的工具/耗时/统计/最终文本 |
| `final-message.md` | 模型中文汇报全文 |
| `driver.log` | 时间线（含模型轮询、工具、失败与续跑） |
| `models.json` | 实际模型列表与命中项 |
| `hash-before.json` / `hash-after.json` | catalog/.opencode/projects/仓库前后哈希 |
| `file-tree-before-preview.txt` / `file-tree-after-preview.txt` / `app-tree-diff.json` | 应用文件树与新增文件（仅 prototypes + tokens.json） |
| `shots/` | 工作室、设计列表、dialog-form、detail、development-fidelity、PNG、应用文件树 |
| `pre-fix-early-stop/` | 修复前“提前完成”证据：driver.log、messages-summary、session-export、final-message |

## 7. 回归（本次实跑）

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm test --prefix backend`（临时 RG） | **230 / 230** |
| `npm test --prefix frontend` | **178 / 178** |
| `npm run typecheck --prefix frontend` / `check:vue` | 通过 |
| `npm run e2e:p7-7c --prefix backend` | **108** 条断言 |
| `npm run e2e:p7-7b / p7-6a / preview / p7-4b` | **51 / 18 / 83 / 48** |
| `npm run e2e:p9 / p10 / p2 / p3 / p4` | **70 / 79 / 116 / 126 / 128** |
| `npm run smoke:workspace / smoke:assets` | 通过（opencode 2.2.5 / 4719；不调模型） |

## 8. 未验证

- 真实 3300/4771 人工验收（仍由用户执行；本会话未启停）。
- `edit`/`write` 越界拒绝路径未被真实触发（模型只写 spec/notes；配置与前后 hash 证明未越界）；本轮真实验证的是 `shell` 拒绝。
- 真实 AFCenter 宿主 `pm-*` 运行态、EOS 构建/运行态；PNG 像素级模板比对（仍只校验宽高 + 主色采样）。
- 开发视图真实模型实现（本轮只做工作室→应用→预览→fidelity，不额外跑开发模型）。
- `<768px` 移动端布局；多实例并发；发布后已打开应用的自动同步。
