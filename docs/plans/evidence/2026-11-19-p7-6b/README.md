# P7-6b 真实模型闭环证据（2026-11-19）

临时实例、真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash`，未触碰真实 3300/4771、`data/`、`projects/`、`.env`，未执行 git。

## 环境

- 临时根：`C:\Users\icecream\AppData\Local\Temp\workbench-p7-6b-RsoJCm`（`fs.mkdtempSync`）
- 后端：`127.0.0.1:3441`；opencode serve：`127.0.0.1:4741`
- 应用：`p7-6b-e2e`；设计系统 `afcenter-app-templates-v1 / enterprise-application-platform / platform-blue`
- 模型：`packycode-deepseek/deepseek-flash`（设计/开发同一模型）
- 时间：2026-11-19 17:29:57 — 17:35:55

## 文件

| 文件 | 说明 |
| --- | --- |
| `design.json` | 设计会话产物（MOD-001，3 实体/3 关系/2 页面契约），5,077B |
| `design-brief.md` | 设计说明（页面契约表/冲突决策），13,079B |
| `ui-check.md` | 开发填写的对照表（状态 filled），5,884B |
| `OrganizationView.vue` | 开发产物（蓝图 OrganizationUsers.vue 适配），18,141B / 497 行 |
| `evidence.json` | 驱动脚本汇总（步骤/耗时/契约/ui-check/实现/fidelity/轨迹） |
| `driver.log` | 驱动脚本时间线日志 |
| `trace-summary.json` | 两个会话的工具调用摘要（名称/状态/路径） |
| `fidelity-final.json` | 中断后独立复跑的 CLI 一致性检查 JSON |

## 结果

- 设计会话：**90,474ms**；13 条消息 / 20 次工具；`validate.mjs` 0 error / 0 warning。
- 开发会话：**265,196ms**；37 条消息 / 82 次工具（2 个 error：1 个路径读错、1 个被中断的 shell）；17:33:01 先填 ui-check，17:33:11 写页面。
- 一致性：**11 pass / 1 warn / 0 fail**；唯一 warn 为 `prototypes`（PNG 未导出）；无修复轮。
- 清理：opencode stop + 进程树结束；3441/4741 无残留监听；真实 3300/4771 PID 不变。

## 重要偏差

开发会话在最后一条自查 shell 执行时（17:35:54.725）被**另一个工作台会话**调用
`POST /api/apps/p7-6b-e2e/development/interrupt` 中止（见 `evidence.json` 与 `trace-summary.json`），
因此没有开发 agent 的最终文字汇报。中断前所有目标文件已落盘，17:35:20 自查已是 11/1/0；
`OrganizationView.vue` 的最终 `<script setup>` 已独立 `node --check` 通过，fidelity 已独立复跑。

## 未验证

- 生成物 `frontend/` 的 `npm install` / `dev` / `build:prod`（本轮明确不执行）。
- 真实 AFCenter 宿主 `pm-*` 运行态、页面截图/像素比对、PNG 导出。
- EOS 构建与真实 3300 运行态。
