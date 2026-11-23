---
name: 设计产物编写与维护
description: 基于需求文档、设计系统与设计模板生成/更新实体、页面契约与原型数据，保证可施工且与需求一致
---

# 设计产物编写与维护

设计产物是**工作区里的 JSON 文件**：`docs/design/<MOD>/design.json`，一个需求模块一个文件。
工作台读取它来渲染 ER 与线框原型，开发阶段按页面契约与蓝图施工，因此格式必须符合 schema。

## 1. 先读，再写

- 先读 `docs/requirements/*.md`（模块 frontmatter + 章节）与 `AGENTS.md`。
- 再读 `references/design.schema.json`（本 skill 目录内）——它是**唯一**格式来源。
- 参考 `references/design-example.json` 了解完整字段（含 tree-list / dialog-form 示例）。
- 读应用级设计系统：`docs/design/design-system.json`（pack / applicationType / style / 页面库）；
  没有该文件时读 `adw-template-proto-<id>` skill 或应用设计系统接口，并在回复里说明来源。
- 加载当前设计模板对应的 `adw-template-proto-*` skill：
  - 页面库：有哪些页面、`recipe`、`blueprint`、`components`；
  - 视觉风格：tokens/shell/patterns（只约束 Vue3 前端）。
- 需要看团队页面写法时读 `docs/design/template/` 下的蓝图副本或模板 skill 指向的蓝图路径；
  **不要修改模板/蓝图文件**（受管资源，会被工作台覆盖）。
- 已有 `docs/design/<MOD>/design.json` 时增量修改，不要整篇重写。

## 2. 文件契约（摘要）

```jsonc
{
  "module": "MOD-001",
  "title": "商品管理",
  "designSystem": {
    "pack": "afcenter-app-templates-v1",
    "applicationType": "enterprise-application-platform",
    "style": "platform-blue"
  },
  "entities": [
    {
      "id": "product",
      "name": "商品",
      "table": "biz_product",
      "fields": [
        { "name": "商品编码", "type": "string", "required": true, "unique": true },
        { "name": "状态", "type": "enum", "options": ["上架", "下架"] }
      ]
    }
  ],
  "relations": [{ "from": "product", "to": "category", "type": "N:1", "label": "所属分类" }],
  "pages": [
    {
      "id": "product-list",
      "name": "商品列表",
      "type": "list",
      "recipe": "tree-list",
      "catalogRef": "enterprise-application-platform/organization",
      "blueprint": "application-types/enterprise-application-platform/pages/OrganizationUsers.vue",
      "entity": "product",
      "filters": ["商品名称", "状态"],
      "columns": ["商品编码", "商品名称", "状态"],
      "rowActions": ["detail", "edit", "delete"],
      "toolbarActions": ["create", "batchAssignRole"],
      "selection": true,
      "pagination": { "layout": "three-part", "pageSize": 20 },
      "tree": {
        "titleField": "商品名称",
        "parentField": "所属分类",
        "actionStyle": "header",
        "selectionStyle": "dot"
      },
      "components": { "状态": "pm-select" },
      "actions": ["新增", "编辑", "删除"]
    },
    {
      "id": "product-form",
      "name": "商品编辑",
      "type": "form",
      "recipe": "dialog-form",
      "form": {
        "presentation": "dialog",
        "columns": 2,
        "width": 800,
        "fields": ["商品编码", "商品名称", "状态"],
        "groups": [{ "title": "基本信息", "fields": ["商品编码", "商品名称"] }]
      }
    }
  ]
}
```

- `module` 必须与需求模块 key 一致；`title` 与需求模块标题一致。
- 页面 `type`：`list` / `form` / `detail` / `dashboard` / `kanban` / `gantt` / `calendar`（渲染形态）。
- 页面 `recipe`：`list` / `tree-list` / `dialog-form` / `page-form` / `main-sub` / `detail` / `dashboard` / `wizard`（来自模板页面的配方）。
- 以上 `designSystem` 与页面契约字段**全部可选**；旧设计不写也能继续渲染，但新设计应尽量补齐。
- 可以写 `requirementRefs: ["#4.2 商品列表"]`（自由文本，不校验）。

## 3. 页面契约与模板来源

写每个页面前先确定“从模板页面库认领，还是用通用页面”：

| 情况 | 写法 |
| --- | --- |
| 模板页面库有对应页面 | 写 `catalogRef: "<applicationType>/<pageId>"` + 该页面的 `blueprint` + `recipe`，并按页面实际字段/操作补齐契约 |
| 没有对应页面 | 不写 `catalogRef`/`blueprint`，`recipe` 按最接近的通用配方（如 `list` / `page-form`），并在 brief 说明“无模板页面，按通用 PageTemplates” |
| 页面有树 | `type: "list"` + `recipe: "tree-list"` + `tree`（标题/父级字段、操作与选中形态与蓝图一致） |
| 新增/编辑表单 | `type: "form"` + `recipe: "dialog-form"`（默认弹窗）或 `page-form`；`form.presentation` 与蓝图一致 |
| 主从页面 | `recipe: "main-sub"` + `subTables: [{ entity, title, columns, mode: "tab" | "flow" }]` |

- `filters`、`columns` 用**字段名**；`rowActions`、`toolbarActions` 推荐用动作码：
  `create/edit/delete/detail/batchDelete/import/export/submit/cancel/enable/disable/approve/reject/print/copy`
  （中文标签等自定义值会保留原值，只产生 warning，不阻断；新契约尽量用动作码）。
- `tree.actionStyle` 推荐 `header` / `footer` / `none`；`tree.selectionStyle` 推荐
  `platform` / `dot` / `background`；未知值保留原值并 warning，不阻断。
- `pagination.layout`：`bar` / `split` / `three-part`；`pageSize` 用正整数。
- `form.columns` 只能是 `1` 或 `2`；字段超过 8 个或多行文本时按模板 conformance 选择双列/整行。
- `components` 由设计模板 pack 的 `componentMap` 推导；页面需要覆盖时再写（字段 → `pm-*`）。
- 蓝图是**视觉/结构基准**；页面契约与蓝图冲突时，先按需求与蓝图各自取证，把冲突写进 `design-brief.md` 的“冲突与决策”，不要静默选一边。

## 4. 设计参考包（brief / tokens / PNG）

- 写完或改完 `design.json` 后，维护 `docs/design/<MOD>/design-brief.md`（自由文本，不校验格式）：
  - 概览 / 导航 / 页面 / 组件 / 风格；
  - **页面契约表**：设计页 → `recipe` → `catalogRef` → 蓝图 → 字段/筛选/列 → 操作 → 分页/表单/树 → 组件 → 差异；
  - **冲突与决策**：需求 vs 模板页 vs 蓝图的冲突、取舍与理由；
  - **未认领页面**：模板页面库中相关但本模块暂未实现的页面。
- 颜色、间距引用 `tokens.json`，不要复制大段 JSON；PNG 只当模板风格截图参考（无显式契约的旧设计为线框）。
- `docs/design/<MOD>/tokens.json` 与 `prototypes/*.png` 由工作台生成，**不要手改**。
- 设计结构变化后提醒用户在工作台重新导出原型 PNG；PNG 过期时结构仍以 `design.json` 为准。
- `design-brief.md` 缺失不阻塞；但开发会按 design.json 契约 + brief/tokens/PNG/蓝图施工，建议补齐。

## 5. 跨模块共享

- 其它模块已定义的实体用 `"entity": "MOD-002/order"` 引用，不要重复定义。
- 同名字段/实体重复定义会产生非阻塞告警；确认确实重复时合并或改成引用。

## 6. 自查

- 写完运行本 skill 的 `scripts/validate.mjs <design.json>` 自查：
  - `errors[]` 是旧字段的结构问题，需改到通过；
  - `warnings[]` 是设计系统/页面契约新字段的类型/枚举问题（含非推荐动作码、未知树形态），
    不阻断，但应尽量清零；
  - 输出 `ok` 只受 `errors` 影响。
- **最终校验以后端读取结果为准**（`GET /api/apps/:id/artifacts` 会返回结构化错误）。
- schema 报错时按“文件/字段/期望”改到通过，不要把文件删掉重写。

## 7. 与需求一致

- 需求与设计不一致时，优先按用户最新意图调整，并明确说明改了哪一边。
- 需求里的页面/操作/表单形态必须能在 `pages[]` 的契约字段中找到对应；缺失项先在回复里列出。
- 需要新增/删除需求模块时，先改需求文件，再同步设计文件。

## 8. 边界

- 不要动 `.opencode/skills/**`、`.opencode/commands/**`（受管资源会被覆盖）。
- 不要执行任何 git 操作。
- 修改后回读目标文件，核对用户要求的具体取值/规则/字段是否已出现；没有就继续改，不要只回复“已完成”。
- 完成后用中文汇报：设计判断、设计模板/风格/蓝图来源、改了哪些文件、校验结果（errors/warnings）、待确认项。
