---
name: 设计产物编写与维护
description: 基于需求文档与设计系统生成/更新 docs/design 三份设计文件：entities.json（全局实体/关系）、pages.json（页面集 = Epic + 页面契约）、api-design.md（接口设计，同轮生成）
---

# 设计产物编写与维护

设计产物是工作区里的 **三份设计文件**：

- `docs/design/entities.json`：实体集（实体 + 关系，全局一张 ER 图）；
- `docs/design/pages.json`：页面集（页面集 = Epic）+ 页面契约；
- `docs/design/api-design.md`：接口设计（固定模板：索引/覆盖矩阵/详情/错误码/权限）。

工作台读取它们渲染全局 ER、模板风格原型与「接口设计」Tab；开发按页面契约与蓝图施工。

## 1. 先读，再写

- 先读 `docs/requirements/requirements.md`（Epic/Story）与 `AGENTS.md`；
- 再读本 skill 的 `references/entities.schema.json`、`references/pages.schema.json`（唯一格式来源）；
- 参考 `references/entities-example.json`、`references/pages-example.json`；
- 读应用级设计系统 `docs/design/design-system.json`（pack/applicationType/style/页面库），
  并加载 `adw-template-proto-<applicationType>` skill；
- 加载/参考 `adw-api-design` skill（`references/api-conventions.md`、`api-design-template.md`、`api-design-example.md`），接口文档必须同轮生成；
- 已有文件时增量修改，不要整篇重写；**不要修改模板/蓝图文件**（受管）。

## 2. entities.json

```json
{
  "schemaVersion": 2,
  "entities": [
    {
      "id": "goods",
      "name": "商品",
      "table": "biz_goods",
      "fields": [
        { "code": "goodsCode", "name": "商品编码", "type": "string", "required": true, "unique": true },
        {
          "code": "status",
          "name": "状态",
          "type": "enum",
          "options": [
            { "value": "ON_SALE", "label": "上架" },
            { "value": "OFF_SALE", "label": "下架" }
          ]
        },
        { "code": "categoryId", "name": "分类", "type": "ref", "ref": "category" }
      ]
    }
  ],
  "relations": [{ "from": "goods", "to": "category", "type": "N:1", "label": "所属分类" }]
}
```

规则：

- 实体 `id` 应用内唯一；关系 `from/to` 直接引用实体 id（不要 `MOD-xxx/entity`）；
- 字段必须有英文 `code`（lowerCamel，API/JSON/DB 用）+ 中文 `name`（显示用）+ `type`；
- `type`：`string/text/number/decimal/date/datetime/time/boolean/enum/ref`；
- `enum` 必须写 `options:[{value,label}]`；`ref` 必须写 `ref:<entityId>`；
- 实体/关系全局唯一，ER 永远是一张图。

## 3. pages.json

```json
{
  "schemaVersion": 2,
  "pageSets": [
    {
      "id": "goods",
      "epic": "EP-001",
      "title": "商品管理",
      "primaryEntity": "goods",
      "pages": [
        {
          "id": "goods-list",
          "name": "商品列表",
          "type": "list",
          "recipe": "list",
          "entity": "goods",
          "columns": ["goodsCode", "name", "status"],
          "filters": ["goodsCode", "status"],
          "rowActions": ["detail", "edit", "delete"],
          "toolbarActions": ["create", "batchDelete", "export"],
          "selection": true,
          "pagination": { "layout": "three-part", "pageSize": 20 },
          "components": { "status": "pm-select" },
          "catalogRef": "enterprise-application-platform/applications",
          "blueprint": "application-types/enterprise-application-platform/pages/ApplicationCenter.vue"
        }
      ]
    }
  ]
}
```

规则：

- 页面集 `id` 应用内唯一；`epic` 必须对应需求文档的 Epic ID；`title` 建议与 Epic 标题一致；
- `primaryEntity` 可选；页面集可以跨实体；
- 页面 `id` 应用内唯一（kebab-case）；页面 `entity` 引用实体 id；
- **字段引用一律用字段 `code`**（columns/filters/form.fields/tree.titleField/tree.parentField/subTables.columns/components）；
- 页面契约字段：`recipe/catalogRef/blueprint/filters/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components/actionTargets`，语义与模板页面一致；
- **不再写 `actions`**；渲染器从 `rowActions/toolbarActions` 派生；
- **动作目标 `actionTargets`（可选，显式优先）**：`{ "create": "<页面id>", "edit": "...", "detail": "..." }`，
  目标必须是**同一页面集**的页面；create/edit 目标用表单配方（`dialog-form/page-form/main-sub/wizard`），
  detail 目标用 `detail`；
- 列表/树表页面声明了 `create`/`edit` 时，应有同页面集同实体的表单页，并写 `actionTargets` 明确指向；
  `main-sub`（整页表单 + 子表）是合法表单目标；`detail` 只用于详情，**不要**当作 create/edit 目标；
- 页面/页面集顺序 = 数组顺序；

## 3.5 接口设计（同轮生成）

- 设计阶段通常由本 skill **同轮**写 `docs/design/api-design.md`，不把接口设计留到后续单独命令；
- 读取 `adw-api-design` 的 `references/api-conventions.md` / `api-design-template.md` / `api-design-example.md`；索引/详情写 `操作`；
- 覆盖矩阵 3.1 从 `pages.json` 的 `rowActions/toolbarActions` 派生（form 页补 `submit`），3.2 按实体 CRUD 覆盖；
- errors 必须清零；warnings 尽量清零；
- 单独补/更新接口时才使用 command `generate-api-design`（“补/更新接口设计”）。

## 4. 模板来源

| 情况 | 写法 |
| --- | --- |
| 模板页面库有对应页面 | 写 `catalogRef: "<applicationType>/<pageId>"` + `blueprint` + `recipe` |
| 没有对应页面 | 不写 catalogRef/blueprint，recipe 用最接近的通用配方，并在 brief 说明 |
| 树列表 | `type:"list"` + `recipe:"tree-list"` + `tree` |
| 新增/编辑表单 | `type:"form"` + `recipe:"dialog-form"`（默认）、`page-form`、`main-sub`（整页表单 + 子表）或 `wizard` |
| 主从页面 | `recipe:"main-sub"` + `subTables[]` |

蓝图/页面库是**结构与视觉基准**；与契约冲突时先取证并写入 design-brief 的“冲突与决策”。

## 5. 支撑产物

- `docs/design/design-brief.md`：概览/导航/页面集/组件/风格/冲突与决策/未实现；
- `docs/design/tokens.json`、`docs/design/prototypes/*.png`：工作台生成，**不要手改**；
- PNG 是模板风格截图（无显式契约的旧设计为线框）；过期时结构仍以 pages.json 为准。

## 6. 自查

- 运行 `scripts/validate.mjs docs/design/entities.json docs/design/pages.json`：
  - `errors[]` 必须清零；`warnings[]` 尽量清零（动作码/树形态/actionTargets 只 warning；
    create/edit 缺同实体表单页或目标不存在也会 warning，按提示补表单页或 `actionTargets`）；
- 运行 `scripts/validate-api-design.mjs --app .`（或 `node .opencode/skills/adw-api-design/scripts/validate-api-design.mjs --app .`）：
  - 接口文档 errors 必须清零；
- 最终以后端 `GET /api/apps/:id/artifacts`（含 `apiDesign`）为准；
- 不要把文件删掉重写；按“文件/字段/期望”修正。

## 7. 与需求一致

- 页面集 = Epic；Epic 标题/范围必须与需求一致；
- 需求变化先改需求文档，再同步 entities/pages，并说明改了哪边。

## 8. 边界

- 不要动 `.opencode/skills/**`、`.opencode/commands/**`（受管资源）；
- 不要执行任何 git 操作；
- 完成后用中文汇报：设计判断、模板/风格/蓝图来源、改了哪些文件、校验结果（errors/warnings）、待确认项。
