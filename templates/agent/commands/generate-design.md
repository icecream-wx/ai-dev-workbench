---
description: 按需求与设计模板一次生成/更新 entities.json + pages.json + api-design.md（页面集 = Epic；接口同轮生成）
---

# 生成/更新设计

- 范围：`$ARGUMENTS` 为空表示按用户目标判断；如需指定 Epic/页面集，可直接写 `EP-001` 或页面集 id。
- 先读 `docs/requirements/requirements.md`、`AGENTS.md`、
  `.opencode/skills/adw-design-artifacts/references/entities.schema.json` 与 `pages.schema.json`，
  以及 `.opencode/skills/adw-api-design/references/api-conventions.md`、`api-design-template.md`、`api-design-example.md`。
- 产物路径（**同一轮全部生成/更新**）：
  - `docs/design/entities.json`：实体/关系（全局一张 ER 图；字段必须有 `code`/`name`/`type`）；
  - `docs/design/pages.json`：页面集（`epic` = 需求 Epic）+ 页面契约；
  - `docs/design/api-design.md`：接口设计（固定模板：索引/覆盖矩阵/详情/错误码/权限）。
- 页面集 = Epic；不要再建模块目录、不要写 `MOD-xxx/entity`。
- 字段引用一律用字段 `code`；页面不再写 `actions`（从 `rowActions/toolbarActions` 派生）。
- 列表/树表页面声明了 `create`/`edit` 时，补同页面集同实体表单页，并写 `actionTargets`
  （显式优先；目标必须同页面集；create/edit 用 `dialog-form/page-form/main-sub/wizard`，`main-sub` 是合法表单目标；
  `detail` 只做详情目标，不当作 create/edit）。
- 先确定页面来源（模板页面库 catalogRef/blueprint 或通用配方），再补契约；
  蓝图/模板文件是受管资源，不要修改。
- 写完页面契约后**同轮写接口文档**：索引/详情含 `操作`，覆盖矩阵覆盖页面动作（`rowActions/toolbarActions`，form 补 `submit`）与实体 CRUD。
- 写完维护 `docs/design/design-brief.md`（概览/页面集/冲突与决策/未实现）。
- 完成后同时运行两个 validator：
  - `node .opencode/skills/adw-design-artifacts/scripts/validate.mjs docs/design/entities.json docs/design/pages.json`
  - `node .opencode/skills/adw-api-design/scripts/validate-api-design.mjs --app .`
  按 errors/warnings 修正；errors 必须清零。
- 用中文汇报：设计判断、模板/风格/蓝图来源、改了哪些文件、接口数/覆盖、两个校验结果、待确认项。
- 不要修改 `.opencode/skills/**`、`.opencode/commands/**`；不要执行任何 git 操作。
