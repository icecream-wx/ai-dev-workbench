---
name: 接口设计文档编写与维护
description: 按固定模板与规范编写 docs/design/api-design.md（接口索引/覆盖矩阵/接口详情/错误码/权限），并运行内置校验；只做 Markdown 文档，不生成后端代码
---

# 接口设计文档编写与维护

接口设计产物是**一份 Markdown 文档**：`docs/design/api-design.md`。只做文档，不生成 Java Controller/Service/Entity，不做 OpenAPI 导出。

> 设计阶段通常由 `adw-design-artifacts` 在生成 entities/pages 的**同一轮**调用本 skill 写接口文档；只有单独补/更新接口时才使用 command `generate-api-design`（“补/更新接口设计”）。

## 1. 先读，再写

- `docs/requirements/requirements.md`（Epic/Story）
- `docs/design/entities.json`（实体、字段 `code`/`name`/类型/枚举/ref）
- `docs/design/pages.json`（页面集 = Epic、页面、`rowActions/toolbarActions/form`）
- 本 skill 的 `references/api-conventions.md`（固定规范）
- `references/api-design-template.md`（固定骨架；文档结构以它为准）
- `references/api-design-example.md`（完整示例）
- 已有 `docs/design/api-design.md` 时增量修改，不要整篇重写。

## 2. 文件结构（固定）

```markdown
# <应用名> · 接口设计

## 0. 文档信息
## 1. 接口规范
## 2. 接口索引
## 3. 覆盖矩阵
### 3.1 页面动作覆盖
### 3.2 实体 CRUD 覆盖
### 3.3 非 CRUD / 后台接口
## 4. 公共模型 / 枚举（可选）
## 5. 接口详情
### 5.1 EP-001 <Epic>
#### <API-ID> <名称>
## 6. 待确认 / 不做
## 7. 变更记录
```

- 章节标题、表格列名**不要改**；固定模板之外不要自创结构。
- 接口索引固定列：`ID | 方法 | 路径 | 名称 | 操作 | Epic/页面集 | 页面 | 实体 | 权限`。
- 接口详情固定元信息：`方法/路径 | 操作 | 页面集 | 页面 | 实体 | 权限 | 说明`，并包含 **请求参数**、**响应 data**、**错误码**、**示例**。
- 接口 ID 用 `<resource>.<action>`（如 `goods.list`）；路径必须写完整路径且以 `/api` 开头。

## 3. 操作字段（D2 补充）

`操作` 固定取值：`list / detail / create / update / delete / batchDelete / export / import / action / other`。

- 实体 CRUD 覆盖用 `操作` 判断；
- 页面动作覆盖用覆盖矩阵 3.1：动作来自 `pages.json` 的 `rowActions/toolbarActions`，表单页加 `submit`；
- 字典/选项/文件/后台任务用 `other`，并在说明写 `background`（如未被页面引用）。

## 4. 覆盖矩阵

- **3.1 页面动作覆盖**：每个页面动作一行（页面集/页面/动作/接口/说明）。已声明动作必须有接口，纯前端行为写“无接口（纯前端）”。
- **3.2 实体 CRUD 覆盖**：每个实体一行，列出 list/detail/create/update/delete 接口；没有的写“—”。
- **3.3 非 CRUD / 后台接口**：看板、报表、工作流、文件、字典等。

## 5. 校验

写完运行：

```bash
node .opencode/skills/adw-api-design/scripts/validate-api-design.mjs --app .
```

- errors：缺必需章节、ID 重复、method+path 重复、路径不以 `/api` 开头、方法非法、引用不存在、索引/详情不一致、缺请求/响应/错误码、列表缺分页、字段 code 不存在；
- warnings：页面动作/实体 CRUD 未覆盖、接口未被页面引用、权限/错误码/示例缺失、Epic 标题不一致、响应字段未标来源；
- **errors 必须清零**；warnings 尽量清零，不能清零时在回复里说明。
- 最终以后端 `GET /api/apps/:id/artifacts` 的 `apiDesign` 与开发视图「检查一致性」为准。

## 6. 与需求/设计一致

- 页面集 = Epic；接口 `页面集` 必须对应 `pages.json` 的 Epic；
- 页面/实体/字段 code 必须与 `pages.json`/`entities.json` 一致；
- 需求变化先改需求/设计，再同步接口文档，并说明改了哪边。

## 7. 边界

- 不生成后端代码（Controller/Service/Entity/Mapper）；不导出 OpenAPI；
- 不改 `.opencode/skills/**`、`.opencode/commands/**`（受管资源）；
- 不执行任何 git 操作；
- 完成后用中文汇报：接口数/Epic、改了哪些章节、校验结果（errors/warnings）、未覆盖项与待确认项。
