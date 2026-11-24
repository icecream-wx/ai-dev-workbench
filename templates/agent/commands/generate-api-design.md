---
description: 补/更新接口设计文档 docs/design/api-design.md（设计阶段通常由 generate-design 同轮生成；只做文档，不生成后端代码）
---

# 补/更新接口设计

- 使用场景：设计阶段通常已由 `generate-design` 在生成 entities/pages 的同一轮写 `api-design.md`；本命令只用于补写或更新接口文档。

- 范围：`$ARGUMENTS` 为空表示全应用；可指定 Epic（`EP-001`）或页面集。
- 先读：
  - `docs/requirements/requirements.md`（Epic/Story）；
  - `docs/design/entities.json`（字段 code/name/类型/枚举/ref）；
  - `docs/design/pages.json`（页面集 = Epic、页面 `rowActions/toolbarActions/form`）；
  - `.opencode/skills/adw-api-design/references/api-conventions.md`、`api-design-template.md`、`api-design-example.md`。
- 产物：`docs/design/api-design.md`，固定章节与表格列，不要自创结构：
  - `0 文档信息 / 1 接口规范 / 2 接口索引 / 3 覆盖矩阵 / 4 公共模型（可选）/ 5 接口详情 / 6 待确认 / 7 变更记录`；
  - 索引与详情元信息必须写 `操作`（list/detail/create/update/delete/batchDelete/export/import/action/other）。
- 覆盖矩阵：
  - 3.1 页面动作覆盖：动作来自 `pages.json` 的 `rowActions/toolbarActions`，表单页加 `submit`；
  - 3.2 实体 CRUD 覆盖：按 `操作` 列判断；
  - 3.3 非 CRUD/后台/字典/文件接口。
- 不生成 Java Controller/Service/Entity/Mapper，不导出 OpenAPI；不修改 `.opencode/skills/**`、`.opencode/commands/**`。
- 写完运行 `node .opencode/skills/adw-api-design/scripts/validate-api-design.mjs --app .`，errors 清零；
  warnings 尽量清零，不能清零在回复里说明。
- 用中文汇报：接口数/Epic、覆盖矩阵摘要、改了哪些章节、校验结果、待确认项。
- 不要执行任何 git 操作。
