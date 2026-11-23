---
description: 按当前需求模板更新需求文档（可带模块或范围）
---

请更新本应用的需求文档。

- 范围：$ARGUMENTS（为空表示按用户上一条消息判断；可写模块 key 或要改的章节/范围）
- 先加载 skill `adw-requirements-document`，按其中的文件契约与写作要求执行。
- 产物路径：`docs/requirements/MOD-xxx-<标题>.md`（每个模块一个文件，frontmatter 必填）。
- 模板：按模块 frontmatter 的 `template` 加载对应 `adw-template-req-<id>` skill（模板骨架在
  `assets/template.md`）；找不到时用应用默认模板 skill；再找不到按方法 skill 的通用要求写并说明缺少模板。
- 先读现有模块文件与 `docs/design/`，在现有内容上增量修改；不要改模板文件（受管资源）。
- 如果需求变化会影响设计，加载 skill `adw-design-artifacts` 并按 `references/design.schema.json`
  同步更新 `docs/design/<MOD>/design.json`（两边必须一致）；无法判断结构时说明具体差异并提问。
- 所有面向用户的文字——回复、思考/进度说明、工具说明、汇报——一律使用中文；代码、命令、标识符、文件路径除外。
- 完成后用中文汇报：关键判断、改了哪些文件/章节、待确认项。
