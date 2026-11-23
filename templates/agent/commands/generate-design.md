---
description: 按需求文档、设计系统与设计模板生成/更新设计（实体、页面契约、原型数据）
---

请生成或更新本应用的设计产物。

- 范围：$ARGUMENTS（为空表示按模块大纲判断；可写模块 key）
- 先加载 skill `adw-design-artifacts`，按其中的文件契约与自查要求执行。
- 先读 `docs/requirements/` 下对应模块（frontmatter 与章节）、应用 `AGENTS.md`、
  `docs/design/design-system.json`（pack / 应用类型 / 视觉风格 / 页面库）与
  `.opencode/skills/adw-design-artifacts/references/design.schema.json`。
- 产物路径：`docs/design/<MOD>/design.json`（一个模块一个文件）。
- 顶层写 `designSystem: { pack, applicationType, style }`（从应用设计系统读取；旧应用没有时省略）。
- 页面契约：
  - 能对应模板页面库时写 `recipe` / `catalogRef` / `blueprint`，并说明来源页面；
  - 写 `filters` / `columns` / `rowActions` / `toolbarActions` / `selection` / `pagination`；
  - 表单页写 `form.presentation/columns/width/fields/groups`；
  - 树页写 `tree.titleField/parentField/actionStyle/selectionStyle`；
  - 主从页写 `subTables[]`；字段需要特定组件时写 `components`；
  - 无对应模板页面时不要编造 `catalogRef`/`blueprint`，按通用 PageTemplates 并在 brief 说明。
- 原型模板：加载 `adw-template-proto-<应用默认原型模板 id>` skill（含 `assets/tokens.json` 与
  `assets/template.json`）；蓝图/模板文件只读，不要修改。
- 跨模块实体用 `MOD-xxx/entity` 引用，不重复定义。
- 写完运行 `scripts/validate.mjs` 自查：`errors[]` 必须清零，`warnings[]`（新契约字段）说明原因；
  最终以后端 artifacts 校验为准。
- 写完/改完 `design.json` 后维护 `docs/design/<MOD>/design-brief.md`：
  概览/导航/页面/组件/风格 + **页面契约表**（页 → recipe/catalogRef/蓝图 → 字段/列/操作 → 表单/树/分页 → 差异）
  + **冲突与决策**（需求/模板页/蓝图冲突及取舍）。
  `tokens.json` 与 `prototypes/*.png` 由工作台生成，不要手改。
- 需求与设计必须一致；不一致时按用户最新意图调整并说明改了哪一边。
- 需要改需求时，按 skill `adw-requirements-document` 的文件契约（frontmatter + 章节）同步修改
  `docs/requirements/MOD-xxx-*.md`，两边保持一致。
- 所有面向用户的文字——回复、思考/进度说明、工具说明、汇报——一律使用中文；代码、命令、标识符、文件路径除外。
- 完成后用中文汇报：设计判断、设计模板/风格/蓝图来源、改了哪些文件、校验结果、冲突与待确认项。
