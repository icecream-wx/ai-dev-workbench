# 修复前“提前完成”证据（P7-7c-2 首轮真实运行）

2026-11-21 21:31，临时后端 3487 / opencode 4787，真实 `deepseek-flash`。
首条 prompt 发出后约 **8.75 秒**，工作室状态被判定为 `succeeded`：

- 会话 `ses_e01b1e215ffeDTbGvNcy7LmAGv`；6 条消息 / **10 次 read** / 0 write；
- `spec.json` 仍是 starter（`pages: []`）；
- 模型最后一条 assistant `finish=tool-calls`（表示还有下一轮），并无 `idle` 消息；
- 会话 `time.busy = 1795267894965`（时间戳），`time.idle` 不存在。

`session-export.json` 是 opencode 原始会话导出的证据（含 reasoning/tool 内容，无密钥）。
`messages-summary.json` 是当时的驱动摘要；`driver.log` 记录了驱动因 `pages=0` 终止。

根因与修复见上一级 `README.md` 第 4 节：
`backend/src/opencode/session-state.ts` 把 `finish=tool-calls` 当成收尾、且未把数值型 `time.busy` 视为忙碌。
