---
description: 检查需求/设计系统/设计/蓝图/代码之间的一致性并输出具体差异
---

请检查本应用的需求、设计与代码之间是否一致。

- 范围：$ARGUMENTS（为空表示全部模块）
- 输入：`docs/requirements/*.md`、`docs/design/design-system.json`、`docs/design/<MOD>/design.json`、
  `docs/design/<MOD>/design-brief.md`、`docs/design/<MOD>/tokens.json`、`docs/design/<MOD>/prototypes/*.png`、
  应用设计模板 skill / `docs/design/template/` 蓝图、`backend/` 与前端代码。
- 对照点：
  - 需求模块 key/标题 ↔ 设计文件 `module`/`title`；
  - 需求里的实体/字段/枚举 ↔ 设计 `entities[].fields`；
  - 需求页面与操作 ↔ 设计 `pages[]` 的 `recipe`/`filters`/`columns`/`rowActions`/`toolbarActions`/`selection`/`pagination`；
  - 需求表单形态 ↔ 设计 `form.presentation/columns/fields/groups`；树/主从 ↔ `tree`/`subTables`；
  - 需求字段与控件 ↔ 设计 `components` 与设计模板 `componentMap`；
  - 设计顶层 `designSystem` ↔ `docs/design/design-system.json`（pack / 应用类型 / 风格）；
  - 设计页面 `catalogRef`/`blueprint` ↔ 设计模板页面库（是否存在、路径是否存在）；
  - `design-brief.md` 的**页面契约表**与**冲突与决策**是否覆盖设计页和已知冲突；
  - 设计里的实体 ↔ 代码中的表/模型/接口（存在时）。
- 设计 vs 代码（存在前端/后端代码时）：对照 `design.json` 的页面契约与字段，
  列出代码中缺失的页面/路由、缺失或命名不一致的字段、缺失的操作/表单形态/树结构/分页，
  以及明显风格不一致（导航/主色/间距）；
  `design-brief.md`、`tokens.json`、`prototypes/*.png` 只作为风格参考；
  PNG 过期（manifest designHash 不匹配）时先标注“PNG 已过期”，不要据此断言结构差异。
- 输出清单（只报告，不门禁、不改文件）：
  - 缺失页面 / 未认领模板页面；
  - 缺失或不一致的字段、筛选、列、行操作、工具栏操作、多选、分页；
  - 表单形态（dialog/page、列数、分组）不一致；
  - 树字段/操作形态不一致；子表缺失或 mode 不一致；
  - 蓝图缺失、`catalogRef` 指向不存在的页面；
  - 设计系统与 design-system.json 不一致；
  - brief 未记录的冲突与决策。
- 输出格式：按模块列出“差异 + 证据（文件/章节/字段）+ 建议改哪边”，
  不要直接大改文件；用户确认后再改。
- 如果设计文件不符合 schema，先报“文件/字段/期望”，不要静默跳过。
- 所有面向用户的文字——回复、思考/进度说明、工具说明、汇报——一律使用中文；代码、命令、标识符、文件路径除外。
- 不要执行任何 git 操作。
