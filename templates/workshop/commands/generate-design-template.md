---
description: 按当前草稿 spec.json 生成设计模板包并校验（不发布）
---

按当前草稿 `drafts/$ARGUMENTS/spec.json` 生成设计模板包（`$ARGUMENTS` 为 pack id）。

1. 先读 `AGENTS.md`、`catalog/index.json` 与当前 `drafts/$ARGUMENTS/spec.json`；
2. 运行 `node .opencode/scripts/generate.cjs --draft $ARGUMENTS`（允许的 shell）；
3. 把输出里的 `pack`（id/version/pageCount）、`pages`（reference/contract）、`css`（来源/规则/去重/冲突）、
   `errors`、`warnings` 用中文汇报；有 error 时按 `errors[].path` 说明要改 spec 的哪里；
4. **不要发布**（发布由用户点「发布」），不要修改 spec 之外的文件。

用户参数：$ARGUMENTS
