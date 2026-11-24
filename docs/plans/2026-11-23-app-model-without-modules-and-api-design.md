# 去模块：单需求文档 + 实体/页面集/接口设计（2026-11-23）

> 状态：**设计稿（待评审）**。本文只定义目标模型、文件契约、接口设计标准、影响面与分批；不改代码、不启停真实实例、不调模型、不做 git。
>
> 本文替代此前“模块 = 需求分组 + 设计目录 + 工作范围”的模型。旧应用/旧 `MOD-*` 结构**不做兼容、不做迁移、不做 legacy 分支**（已确认：开发初期，大调整不考虑旧数据）。

## 1. 结论与已拍板

### 1.1 为什么去掉模块

模块最初服务于团队分工：一个模块 = 一个可分配的工作单元。未来是一个应用一个人负责，应用内没有多人协作，模块带来的成本大于收益：

- 需求要维护多个 `MOD-xxx-*.md`，模块之间的依赖/引用只能靠文字；
- 设计按模块分目录，实体关系被切开，无法在一张 ER 图里展示；
- 设计/开发/一致性检查/PNG/ui-check 都要带模块上下文，路径和提示词重复。

去掉模块后：

- 需求阶段产出一份需求文档；
- 设计阶段实体全局一张 ER 图；
- 页面用“页面集”分组，页面集 = Epic；
- 新增第三份设计产物：接口设计文档；
- 会话粒度 = 应用 × 视图，不再有模块/页面集会话层级。

### 1.2 已拍板

| 决策 | 结论 |
| --- | --- |
| 页面集粒度 | **Epic**；页面集是设计/展示分组，不是目录、权限或会话边界 |
| 设计产物 | **三份文件**：`entities.json`、`pages.json`、`api-design.md` |
| 字段命名 | 实体字段必须有英文 `code` + 中文 `name`；页面契约引用 `code` |
| 接口设计 | **只做文档**：接口规范、path、入参出参、错误码、权限、覆盖矩阵；不做后端代码生成 |
| 接口文档形态 | **Markdown 固定模板** + 内置规范/模板/示例/校验，不让模型自由发挥 |
| 需求文档 | 一份 `docs/requirements/requirements.md`；新建应用时按所选需求模板生成骨架 |
| 支撑产物 | `design-brief.md`、`tokens.json`、`prototypes/*.png`、`ui-check.md` 全部应用级 |
| 会话 | 应用 × 视图，一个活跃会话；不按页面集切 |
| 旧数据 | 硬切；不读取旧 `MOD-*`、不迁移、不做 legacy |
| DB | **不改表**；仍为 `apps`、`app_settings`、`app_sessions`、`requirement_templates` |

### 1.3 非目标

- 不做旧模块数据迁移/兼容/回填。
- 不生成 Java Controller/Service/Entity，不承诺 EOS 构建。
- 不做 OpenAPI 导出（后续可从固定模板结构化生成）。
- 不做页面集级会话、权限、文件目录。
- 不改需求模板中心 UI/表结构。
- 不做 git 操作；不启停真实 3300/4771；不读写真实 `data/`、`projects/`、`.env`。

---

## 2. 目标目录与文件树

```text
docs/
  requirements/
    requirements.md              # 唯一需求文档（单文档）
  design/
    entities.json                # 实体集：实体 + 关系（全局 ER）
    pages.json                   # 页面集：Epic + 页面契约
    api-design.md                # 接口设计文档（固定模板）
    design-system.json           # 应用设计系统（现有，受管）
    design-brief.md              # 设计说明（应用级）
    tokens.json                  # 设计变量（工作台生成）
    prototypes/
      _manifest.json             # 应用级 manifest
      <page-id>.png              # 页面截图
    ui-check.md                  # 开发对照表（应用级，按 Epic 分节）
```

- 不再有 `docs/design/<MOD>/`。
- `design-system.json` 仍由工作台管理，不属于“三份设计产物”；它描述模板/应用类型/风格/页面库。
- `design-brief.md` / `tokens.json` / `prototypes` / `ui-check.md` 是支撑产物，全部应用级。

---

## 3. 文件契约

### 3.1 `docs/requirements/requirements.md`

frontmatter：

```markdown
---
title: 商品管理应用
template: builtin-prd
---
```

- 无 `module`、无 `order`。
- `template` 是应用级需求模板 id；模板中心/DB 不变。
- 正文按模板章节展开；Epic 使用稳定 ID，供页面集引用：

```markdown
## 3. Epics & Stories

### EP-001 商品管理

**目标**：...

#### US-001 商品列表

- 作为...
- 验收标准：...
```

- Epic ID 规则：`EP-<3位以上数字>`；Story ID：`US-<3位以上数字>`。
- 新建应用时由需求模板渲染骨架（不调模型、不生成内容）；已存在不覆盖。
- 需求视图不再有“新建模块/改名/排序/切模块模板”。

### 3.2 `docs/design/entities.json`（实体集）

```json
{
  "schemaVersion": 2,
  "entities": [
    {
      "id": "goods",
      "name": "商品",
      "table": "biz_goods",
      "description": "商品主数据",
      "fields": [
        {
          "code": "goodsCode",
          "name": "商品编码",
          "type": "string",
          "required": true,
          "unique": true
        },
        {
          "code": "status",
          "name": "状态",
          "type": "enum",
          "options": [
            { "value": "ON_SALE", "label": "上架" },
            { "value": "OFF_SALE", "label": "下架" }
          ]
        }
      ]
    }
  ],
  "relations": [
    { "from": "goods", "to": "category", "type": "N:1", "label": "所属分类" }
  ]
}
```

规则：

- `entities[].id`：应用内唯一，建议小写 slug（`goods`、`orderItem` 均可，但同一应用统一风格）；
- `fields[].code`：应用内实体字段唯一，推荐 lowerCamel（`goodsCode`）；API/JSON/DB 使用它；
- `fields[].name`：中文显示名；
- `type`：`string/text/number/decimal/date/datetime/time/boolean/enum/ref`；
- `enum` 必须用 `options: [{value,label}]`；`value` 是接口值，`label` 是显示值；
- `ref` 必须写 `ref: <entityId>`；
- `relations.from/to` 直接引用实体 id，不再有 `MOD-xxx/entity`；
- 实体/关系全局唯一，ER 永远是一张图。

### 3.3 `docs/design/pages.json`（页面集）

```json
{
  "schemaVersion": 2,
  "pageSets": [
    {
      "id": "goods",
      "epic": "EP-001",
      "title": "商品管理",
      "description": "商品建档、上下架与库存查看",
      "primaryEntity": "goods",
      "pages": [
        {
          "id": "goods-list",
          "name": "商品列表",
          "type": "list",
          "recipe": "list",
          "entity": "goods",
          "columns": ["goodsCode", "name", "status", "price", "stock"],
          "filters": ["goodsCode", "name", "status"],
          "rowActions": ["detail", "edit", "delete"],
          "toolbarActions": ["create", "batchDelete", "export"],
          "selection": true,
          "pagination": { "layout": "three-part", "pageSize": 20 },
          "components": { "status": "pm-select" },
          "catalogRef": "enterprise-application-platform/applications",
          "blueprint": "application-types/enterprise-application-platform/pages/ApplicationCenter.vue"
        },
        {
          "id": "goods-form",
          "name": "商品编辑",
          "type": "form",
          "recipe": "dialog-form",
          "entity": "goods",
          "form": {
            "presentation": "dialog",
            "columns": 2,
            "width": 800,
            "fields": ["goodsCode", "name", "status", "price", "stock"],
            "groups": [
              { "title": "基本信息", "fields": ["goodsCode", "name"] },
              { "title": "销售信息", "fields": ["status", "price", "stock"] }
            ]
          }
        }
      ]
    }
  ]
}
```

规则：

- `pageSets[].id`：应用内唯一 slug；`epic` 必须对应需求文档中的 Epic ID；
- `pageSets[].title` 建议与 Epic 标题一致（不一致只 warning）；
- `primaryEntity` 可选；页面集可以跨多个实体（看板/审批流）；
- `pages[].id`：应用内唯一，建议 kebab-case（`goods-list`）；
- `pages[].entity`、`subTables[].entity`、`columns`、`filters`、`form.fields` 等字段引用**字段 code**；
- 页面契约字段（`recipe/catalogRef/blueprint/filters/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components/actionTargets`）沿用现有语义；
- **`actionTargets`（B6，可选）**：动作码 → 同页面集目标页面 id（显式优先）；`create/edit` 目标用表单配方 `dialog-form/page-form/main-sub/wizard`（`main-sub` 是整页表单 + 子表，合法），`detail` 只做详情目标、不当作 create/edit；目标不存在/跨页面集/配方不匹配只 warning，交互预览回退启发式；无表单页时打开临时表单（明确标注，不写文件）；
- `actions` 不再写入；渲染器从 `rowActions/toolbarActions` 派生；旧字段不再兼容；
- 页面顺序 = 数组顺序；页面集顺序 = 数组顺序。

### 3.4 `docs/design/api-design.md`（接口设计）

接口设计是**文档**，不是可执行契约；固定模板见第 5 节。核心要求：

- 按 Epic/页面集分组；
- 有全局接口规范、接口索引、覆盖矩阵、接口详情、错误码、权限、示例；
- 通过 `pageRefs`/`entity` 与 `pages.json`/`entities.json` 互相引用；
- 校验只 warning/fail 报告，不阻断设计保存；生成时按模板强制。

### 3.5 支撑产物

| 文件 | 位置 | 规则 |
| --- | --- | --- |
| `design-system.json` | `docs/design/` | 由工作台管理；模板/应用类型/风格/页面库/蓝图/契约路径 |
| `design-brief.md` | `docs/design/` | agent 维护；概览/导航/页面集/组件/风格/冲突与决策/未实现 |
| `tokens.json` | `docs/design/` | 工作台按视觉风格生成；不手改 |
| `prototypes/_manifest.json` | `docs/design/prototypes/` | 应用级 manifest；`designHash` + `styleId` + 页面条目 |
| `prototypes/<page-id>.png` | `docs/design/prototypes/` | 模板风格截图；无契约/失败回退线框 |
| `ui-check.md` | `docs/design/` | 开发对照表；应用级，按 Epic 分节；首次开发 prompt 生成，不覆盖 |

### 3.6 ID、命名与引用

| 对象 | 规则 | 示例 |
| --- | --- | --- |
| Epic | `EP-<3位以上数字>` | `EP-001` |
| Story | `US-<3位以上数字>` | `US-001` |
| 页面集 | 应用内唯一 slug | `goods` |
| 页面 | 应用内唯一 kebab-case | `goods-list` |
| 实体 | 应用内唯一 slug/camel | `goods` |
| 字段 code | 实体内唯一 lowerCamel | `goodsCode` |
| 表名 | 可选 snake_case | `biz_goods` |
| 接口 ID | `<resource>.<action>` | `goods.list` |

引用规则：

- 页面集 → Epic：`epic`；
- 页面 → 实体：`entity`；
- 页面字段 → 实体字段：`entityId.fieldCode`（在接口文档中）；页面契约内直接写字段 code；
- 接口 → 页面/实体：`pageRefs[]` / `entity`；
- 不允许跨模块前缀；所有 id 应用内唯一。

### 3.7 `designHash` 与 PNG

- `designHash = sha256(entities.json + pages.json + design-system.json)`（固定顺序、字节级拼接；不包含 `api-design.md`）；
- API 文档变化不应让 PNG 过期；
- `prototypes/_manifest.json` 记录 `designHash`、`styleId`、`exportedAt`、`pages{pageId:{file,hash,exportedAt,pageSet}}`；
- `POST /api/apps/:id/design/prototypes` 不再带 `module`；
- PNG 导出遍历全部页面；页面多时按页面集筛选导出，但 manifest 只有一个。

---

## 4. 目标工作模型

### 4.1 需求

- 单文档 + TOC/章节大纲；
- 新建应用生成骨架；
- agent 通过 `adw-requirements-document` 维护文档；
- 需求模板仍由应用创建时选择；没有模块级模板覆盖。

### 4.2 设计

- agent 读需求、实体、页面、接口设计；
- 写 `entities.json` → `pages.json` → `api-design.md`；
- 实体全局一张 ER；页面集按 Epic 分组；
- 设计视图三块：实体关系 / 页面集 / 接口设计；
- 页面集只做展示/生成分组，不做文件目录、权限、会话。

### 4.3 开发

- 会话 = 应用 × 视图；不按页面集切；
- 用户在对话里指定 Epic/页面集；
- 开发 prompt 读取单需求文档、`entities.json`、`pages.json`、`api-design.md`、`design-system.json`、brief/tokens/PNG、ui-check；
- 开发 digest 应用级，按 Epic 摘要；
- ui-check 应用级；
- fidelity 应用级 14 项（新增 `api-design`）。

### 4.4 页面集 = Epic

- 一个 Epic 一个页面集；
- 页面集标题与 Epic 标题一致；
- 页面集可以有 `primaryEntity`，也可以跨实体；
- 页面集不是“模块重命名”：不建目录、不做权限、不做会话、不做独立设计文件。

---

## 5. 接口设计文档标准

### 5.1 形态与理由

**文件**：`docs/design/api-design.md`
**形态**：Markdown 固定模板 + 固定表格。
**理由**：

1. 现阶段是设计文档，给人评审、给 agent 开发参考；
2. OpenAPI 的 `$ref/schema` 机械结构多、评审成本高，EOS/AFCenter 的 URL/响应封装尚未完全定；
3. Markdown 最适合“场景需要哪些接口、path、入参出参、错误码、权限”；
4. 固定模板 + 校验脚本可以约束模型，避免自由发挥；
5. 后续需要机器契约时，可从固定模板生成 OpenAPI。

### 5.2 内置能力

```text
templates/agent/skills/adw-api-design/
  SKILL.md
  references/api-conventions.md       # 固定规范
  references/api-design-template.md   # 固定文档骨架
  references/api-design-example.md    # 商品管理完整示例
  scripts/lib/api-design-core.cjs     # 共享校验核心
  scripts/validate-api-design.mjs     # CLI
templates/agent/commands/generate-api-design.md
```

- 应用内 `.opencode/skills/` 分发同一份；
- 设计 prompt、开发 digest、应用 `AGENTS.md` 指向它；
- 模型每次生成接口设计前必须读 `SKILL.md` + `api-conventions.md` + `api-design-template.md`；
- 不允许自由 Markdown 结构。

### 5.3 文档骨架

```markdown
# <应用名> · 接口设计

## 0. 文档信息
- 版本 / 更新时间
- 依据：docs/requirements/requirements.md、entities.json、pages.json
- 范围：本应用全部接口，按 Epic/页面集分组

## 1. 接口规范（固定）
### 1.1 基础
### 1.2 URL 规范
### 1.3 请求规范
### 1.4 响应规范
### 1.5 权限规范
### 1.6 数据类型
### 1.7 批量 / 导入导出 / 文件

## 2. 接口索引
| ID | 方法 | 路径 | 名称 | 操作 | Epic/页面集 | 页面 | 实体 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 3. 覆盖矩阵
### 3.1 页面动作覆盖
| 页面集 | 页面 | 动作 | 接口 | 说明 |
| --- | --- | --- | --- | --- |

### 3.2 实体 CRUD 覆盖
| 实体 | list | detail | create | update | delete | 说明 |
| --- | --- | --- | --- | --- | --- | --- |

### 3.3 非 CRUD / 后台接口
| 场景 | 接口 | 页面/触发 | 说明 |
| --- | --- | --- | --- |

## 4. 公共模型 / 枚举（可选）
### ENUM-<name>
### DTO-<name>

## 5. 接口详情
### 5.1 EP-001 商品管理
#### API-GOODS-LIST 商品分页列表

## 6. 待确认 / 不做

## 7. 变更记录
```

> **D2 补充（操作字段）**：接口索引与详情元信息都增加「操作」列，固定取值
> `list / detail / create / update / delete / batchDelete / export / import / action / other`。
> 原因：覆盖矩阵要机器判断实体 CRUD 覆盖（list/detail/create/update/delete）与页面动作覆盖；
> 这是对 §5.3 骨架的必要补充，模板/示例/校验已同步（见 §5.6、§5.7）。

### 5.4 固定规范

#### 1. 基础

- Base path：`/api`（可配置，但必须在文档信息中写明）；
- 传输：JSON UTF-8；文件上传 `multipart/form-data`；
- 认证：AFCenter 宿主登录态；不在 URL 放 token；
- 时间：ISO-8601；日期 `YYYY-MM-DD`；
- ID：string（避免 JS 精度问题）；
- 金额：decimal 字符串，保留 2 位；
- 枚举：使用 `entities.json` 的 `options[].value`；显示用 `label`。

#### 2. URL 规范

- 资源复数、kebab-case：`/goods`、`/goods/{id}`；
- 嵌套只用于真实从属，最多两层：`/orders/{orderId}/items`；
- 方法：
  - `GET /goods`：列表
  - `GET /goods/{id}`：详情
  - `POST /goods`：新建
  - `PUT /goods/{id}`：更新
  - `DELETE /goods/{id}`：删除
  - `POST /goods/batch-delete`：批量删除
  - `POST /goods/{id}/approve`：业务动作
  - `POST /goods/export`：导出
  - `POST /goods/import`：导入
  - `POST /files`：上传；`GET /files/{id}`：下载
- 路径必须是完整路径（含 basePath），如 `/api/goods`。

#### 3. 请求规范

- 列表：`page`（从 1）、`size`（默认 20，最大 200）、`sort=field,asc|desc`、`keyword`；
- 字段筛选：与实体字段 `code` 同名；日期区间用 `<field>From`/`<field>To`；
- 请求体：JSON；路径参数/查询参数/请求体在文档中分行写清；
- 幂等：create/import/batch 可选 `Idempotency-Key`。

#### 4. 响应规范

```json
{ "code": "OK", "message": "ok", "data": null }
```

- 成功：`code = "OK"`；
- 分页：`data = { "total": 123, "items": [] }`；
- 失败：`code` 为稳定大写蛇形错误码，如 `GOODS_NOT_FOUND`；同时给 HTTP 状态；
- 校验失败：`code = "VALIDATION_FAILED"`，`data = { fields: [{ field, message }] }`；
- 不允许在成功响应里混入 `success: true` 等额外字段；以 `code` 为准。

#### 5. 权限规范

- `<resource>:<action>`：`goods:read`、`goods:write`、`goods:delete`、`goods:export`、`goods:import`、`goods:approve`；
- 无权限控制的接口写 `public`，并在说明中写原因。

#### 6. 数据类型

`string / number / decimal / boolean / date / datetime / enum / ref / file / object / array`。

- `enum` 必须写枚举名和取值来源；
- `ref` 写实体 id，接口值为实体主键；
- `file` 写 MIME 限制和大小上限。

#### 7. 批量 / 导入导出 / 文件

- 批量删除：`POST /goods/batch-delete`，body `{ ids: [] }`，返回 `{ deleted, failed: [{id, reason}] }`；
- 导入：`POST /goods/import`，multipart，返回 `{ taskId }`；用 `GET /tasks/{id}` 轮询；
- 导出：小数据直接返回文件；大数据返回 `{ taskId }`；文档写清阈值；
- 文件：上传返回 `{ id, name, size, mime }`；下载带权限校验。

### 5.5 接口详情写法

每个接口固定格式：

````markdown
#### API-GOODS-LIST 商品分页列表

| 项 | 值 |
| --- | --- |
| 方法/路径 | `GET /api/goods` |
| 操作 | `list` |
| 页面集 | EP-001 商品管理 |
| 页面 | `goods-list` |
| 实体 | `goods` |
| 权限 | `goods:read` |
| 说明 | 商品列表分页、筛选、排序 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- | --- |
| keyword | query | string | 否 | - | 编码/名称模糊 |
| status | query | enum(goodsStatus) | 否 | - | 上架/下架 |
| page | query | integer | 否 | 1 | 页码 |
| size | query | integer | 否 | 20 | 每页 |

**响应 data**

| 字段 | 类型 | 来源/说明 |
| --- | --- | --- |
| total | integer | 总数 |
| items[].goodsCode | string | 实体 goods.goodsCode |
| items[].name | string | 实体 goods.name |
| items[].status | enum(goodsStatus) | 实体 goods.status |

**错误码**

| code | http | 说明 |
| --- | --- | --- |
| AUTH_FORBIDDEN | 403 | 无权限 |

**示例**

```http
GET /api/goods?keyword=笔记本&status=ON_SALE&page=1&size=20
```
````

### 5.6 覆盖矩阵

接口文档不能只列接口，必须证明页面动作有接口支撑。

```markdown
### 3.1 页面动作覆盖

| 页面集 | 页面 | 动作 | 接口 | 说明 |
| --- | --- | --- | --- | --- |
| EP-001 商品管理 | goods-list | create | goods.create | |
| EP-001 商品管理 | goods-list | detail | goods.detail | |
| EP-001 商品管理 | goods-list | edit | goods.update | |
| EP-001 商品管理 | goods-list | delete | goods.delete | |
| EP-001 商品管理 | goods-list | batchDelete | goods.batchDelete | |
| EP-001 商品管理 | goods-list | export | goods.export | |
| EP-001 商品管理 | goods-list | changeStatus | goods.changeStatus | |
| EP-001 商品管理 | goods-form | submit | goods.create / goods.update | |
| EP-001 商品管理 | goods-form | categorySelect | category.options | |
```

```markdown
### 3.2 实体 CRUD 覆盖

| 实体 | list | detail | create | update | delete | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| goods | goods.list | goods.detail | goods.create | goods.update | goods.delete | |
```

- 非 CRUD（看板、报表、工作流、文件、字典）在 3.3 列出；
- 每个页面动作必须有接口或明确写“无接口（纯前端）”；缺失只 warning。

### 5.7 校验规则

共享核心：`scripts/lib/api-design-core.cjs`；CLI `validate-api-design.mjs`；后端 `dev/api-design.ts` 复用同一份。

**errors（阻断生成/标红）**

- 缺少必需章节（文档信息/接口规范/接口索引/覆盖矩阵/接口详情）；
- 接口 ID 重复；`method+path` 重复；
- 路径不以 `/` 开头或不符合 `basePath`；
- 方法不在 `GET/POST/PUT/DELETE/PATCH`；
- 页面集/页面/实体不存在；
- 接口详情缺少请求、响应或错误码；
- 索引与详情不一致（有索引无详情/有详情无索引）；
- 页面/字段引用不存在的 code；
- 列表接口缺少分页参数或分页响应。

**warnings（不阻断）**

- 页面动作未覆盖；
- 实体 CRUD 未覆盖；
- 接口未被任何页面引用且未标 `background`；
- 权限缺失；
- 错误码缺失；
- 响应字段未标注来源；
- Epic 标题与页面集标题不一致；
- 接口没有示例。

### 5.8 示例：商品管理

`EP-001 商品管理` 通常需要：

| 接口 | 作用 |
| --- | --- |
| `goods.list` | 分页列表、筛选、排序 |
| `goods.detail` | 详情 |
| `goods.create` | 新建 |
| `goods.update` | 更新 |
| `goods.delete` | 删除 |
| `goods.batchDelete` | 批量删除 |
| `goods.export` | 导出 |
| `goods.changeStatus` | 上架/下架 |
| `category.options` | 表单分类下拉 |
| `dict.options` | 字典/枚举选项（如需要） |

覆盖矩阵保证 `goods-list` 的 create/detail/edit/delete/batchDelete/export 和 `goods-form` 的 submit/categorySelect 都有接口。

### 5.9 工作台展示与开发使用

- 设计视图新增「接口设计」Tab：渲染 `api-design.md`（Markdown），顶部显示接口数、Epic 数、校验摘要、覆盖警告；
- 错误可「让 AI 修」：把 errors/warnings 作为上下文**一键填入并发送**，面板显示「正在修复 / 修复完成：警告 6 → 2 / 修复结束，仍有 N 个警告」，完成后刷新校验结果（B7；其它视图问题条仍只填 Composer）；
- 开发 digest 增加接口摘要（数量/Epic/关键 path），不注入整篇文档；
- 开发 prompt 要求实现前读 `api-design.md`；后端按文档实现，前端按 path/入参出参调用；
- ui-check 增加「接口」列（页面动作 → 接口 → 后端实现 → 前端调用）；
- fidelity 第 14 项 `api-design`：文件存在、必需章节、索引/详情一致、引用存在、覆盖矩阵；只报告不阻断。

---

## 6. 字段 code/label 标准化

接口设计要写 path/入参出参，实体字段必须有英文 code。新模型：

```json
{
  "code": "goodsCode",
  "name": "商品编码",
  "type": "string",
  "required": true,
  "unique": true
}
```

- `code` 用于 API/JSON/DB 字段名；
- `name` 用于页面显示；
- `enum.options` 改为 `{ value, label }`；
- `pages.json` 的 `columns/filters/form.fields/tree.titleField/tree.parentField/subTables.columns/components` 全部引用 `code`；
- 设计预览/线框/模板渲染通过实体解析 `code → name` 显示；
- 旧中文 `name` 当字段 code 的做法不再支持（硬切）。

---

## 7. Prompt / Skill / Command

### 7.1 需求

- `adw-requirements-document`：单文档、无模块；Epic/Story ID；模板仍用 `adw-template-req-<id>`；
- `update-requirements` command：目标 `docs/requirements/requirements.md`；
- 需求 prompt：读单文档 + 设计三文件；不再有 module 行。

### 7.2 设计

- `adw-design-artifacts`：写 `entities.json` + `pages.json`；页面集=Epic；字段 code/label；全局 ER；
- 新增 `adw-api-design`：写 `api-design.md`；固定模板/规范/校验；
- `generate-design` command：生成实体/页面集；
- `generate-api-design` command：生成接口设计文档；
- 设计 prompt：读需求 + 现有三文件；不要改受管文件；完成后自查 `validate` + `validate-api-design`。

### 7.3 开发

- 开发 prompt：单需求文档、三份设计文件、brief/tokens/PNG、ui-check；不再有 module；
- 开发 digest：应用级，按 Epic/页面集摘要；
- `check-design-fidelity`：无 `--module`；应用级 14 项；
- `check-consistency`：路径更新；
- ui-check：应用级，按 Epic 分节；首次开发 prompt 生成；
- 开发 skill/command/AGENTS 路径全部更新。

### 7.4 scaffold

- 创建应用时：
  - 写 `docs/requirements/requirements.md` 骨架（按所选需求模板；不调模型、不生成内容；已存在不覆盖）；
  - 写 `docs/design/design-system.json` / `template/` / `styles/`（现有）；
  - 建空 `docs/design/` 目录；`entities.json`/`pages.json`/`api-design.md` 由设计 agent 首次生成（设计视图空态提示）。
- 应用 `AGENTS.md`/`README.md` 全部去模块化，写清三份设计文件与接口文档。

---

## 8. UI 影响

### 8.1 需求视图

- 单文档 + TOC/章节大纲（Epic/Story 可点击定位）；
- 去掉模块列表、新建/改名/排序、模块模板切换；
- 空态：无文档时「生成需求文档骨架」；
- header 摘要：`需求文档 · X 个 Epic · 最后更新`；
- AI 面板不再带 module 上下文。

### 8.2 设计视图

- 左侧：页面集列表（Epic 标题、页面数）+ 实体列表（实体名、字段数）；
- 中部 Tab：**实体关系 / 页面集 / 接口设计**；
- 实体关系：全局 ER，支持按页面集高亮/筛选、实体搜索、选中看字段；
- 页面集：页面 chips + 模板原生原型 + 页面契约；
- 接口设计：Markdown 文档 + 摘要/校验 + 「让 AI 修」；
- 顶部摘要：`X 实体 · Y 页面集 · Z 页面 · W 接口`；
- `design-preview.html` URL 去掉 `module`：`?app=&page=&type=&style=&embed=1&v=<designHash>&capture=1`；
- PNG 导出应用级，manifest 一个。

### 8.3 开发视图

- 去掉模块下拉；
- 显示设计参考摘要：Epic/页面集/实体/接口数量；可查看设计视图；
- 会话/时间线/权限/表单/停止/compact 行为不变；
- ui-check 状态应用级；fidelity 报告应用级 14 项；
- 开始卡提示：先读需求/三份设计/接口，按 Epic 实现，先填 ui-check。

### 8.4 首页/外壳

- 应用摘要改为：`X 个 Epic · Y 个页面 · Z 个接口`（或类似人话）；不再显示模块数；
- 状态文案、导航、主题、模型、更多菜单不变。

### 8.5 模板中心 / Studio

- 设计模板中心/Studio 使用 pack 页面，不涉及应用模块，基本不变；
- Studio 契约/模板作者文档中的 `design.json` 路径改为 `pages.json` 页面契约；
- `template-preview.html`/`preview.html`/`design-preview.html` 的页面/契约字段继续复用同一份页面契约定义；
- 自定义模板应用闭环 e2e 的路径改为新设计文件。

---

## 9. 后端 / 前端改动清单

### 9.1 后端

| 文件/模块 | 改动 |
| --- | --- |
| `workspace/artifacts.ts` | 改为 `requirement` + `entities` + `pages` + `apiDesign`；全局实体/页面集；错误/警告/hash |
| `requirements/module-files.ts` | 删除/替换为 `requirements/doc-file.ts`：单文档骨架/缺失创建；无模块 CRUD |
| `requirements/templates.ts`、`templates/distribution.ts` | 模板使用/删除保护扫描单文档 frontmatter；去模块 |
| `templates/render.ts` | 渲染单需求文档骨架 |
| `apps/scaffold.ts` | 创建 `requirements.md` 骨架；AGENTS/README 去模块；设计目录 |
| `apps/routes.ts` | 删除 `requirements-modules` 路由；新增单文档骨架接口；prototypes 去 module；fidelity body 去 module |
| `design/prototypes.ts` | 应用级路径/manifest/designHash；去 module；manifest 加 pageSet |
| `dev/digest.ts` | 应用级摘要；读三份设计；无 module |
| `dev/ui-check.ts` | 应用级 `docs/design/ui-check.md`；按 Epic 分节 |
| `dev/fidelity.ts`、`fidelity-core.cjs` | 应用级扫描；14 项（+api-design）；去 module |
| `dev/service.ts`/`routes.ts` | 会话/消息去 module |
| `chat/service.ts` | prompt 去 module；读三份设计；digest 应用级 |
| `sessions/store.ts` | 不改（本来无 module 列） |
| `design-template/studio.ts` | 文档/契约路径文案更新；pack 逻辑不变 |
| `design/pack.ts`/`system-file.ts` | pack 页面/模板契约不变；应用设计文件路径更新 |

### 9.2 前端

| 文件/模块 | 改动 |
| --- | --- |
| `design/design-adapter.js` | 接受 entities/pages artifacts；全局实体/页面集；字段 code→label；去 module |
| `design/types.ts` | 新实体/页面集/字段/接口类型 |
| `design/design-export.js` | 应用级 designHash/路径；去 module |
| `design/template-capture.ts` | URL 去 module；page + designHash |
| `design-preview/DesignPreviewApp.vue` | URL 去 module；读 entities/pages；按 page id 选择 |
| `design-preview/contract-preview.js` | 字段 code；页面集；去 module；mock 用 label |
| `workbench/RequirementsView/Outline/Document` | 单文档 + TOC；去模块 CRUD |
| `workbench/DesignView` | 页面集/实体列表；三个 Tab；去 module |
| `workbench/DesignErPanel` | 全局 ER + 页面集/实体筛选 |
| `workbench/DesignPrototypePanel` | 页面集 + 页面 chips；URL 去 module |
| 新增 `workbench/ApiDesignPanel.vue` | Markdown 渲染 + 摘要/校验 + AI 修 |
| `dev/DevView.vue` | 去模块下拉；设计参考摘要；fidelity 应用级 |
| `dev/design-ref.js` | 去模块选择；Epic/页面/接口摘要；ui-check 应用级 |
| `workbench/AgentChatPanel.vue` | 去 moduleKey/上下文 pill |
| `workbench/chat-empty.js` | 文案/示例去模块；提 Epic/页面集 |
| `workbench/view-commands.js` | 命令参数去 module |
| `workbench/HomeShell/AppShell` | 摘要去模块；Epic/页面/接口 |
| `shared/design-system-api.ts` | 类型/摘要 |
| `template-preview`/`Studio` | 文案/契约路径更新；pack 逻辑不变 |

### 9.3 资产/文档

- `templates/agent/skills/adw-requirements-document/SKILL.md`
- `templates/agent/skills/adw-design-artifacts/SKILL.md` + `references/*.schema.json` + `design-example.json`
- 新增 `templates/agent/skills/adw-api-design/**`
- `templates/agent/commands/{update-requirements,generate-design,generate-api-design,check-design-fidelity,check-consistency}.md`
- `templates/agent/skills/adw-frontend-implementation/**`（fidelity 14 项、路径）
- `templates/afc-remote/README.md`、`src/views/AppIndex.vue`、`src/router/index.js`
- `templates/workshop/skills/adw-design-template-authoring/**`（文案/契约路径）
- `AGENTS.md`、`README.md`、`docs/STATUS.md`、`docs/plans/README.md`、`docs/ops/switch-to-agent-first.md`、`docs/report/**`

---

## 10. 兼容与迁移

- **硬切**：不读取 `docs/requirements/MOD-*`、`docs/design/<MOD>/*`；不做迁移、不做 legacy、不回填。
- 旧应用要用：按新结构重建（或用户自行手工整理）。
- 工作台遇到旧结构时不需要兼容；可以在文档/空态中提示“旧模块结构不再支持”，但**不实现读取/迁移代码**（是否加提示由 D1 决定，默认不做）。
- DB 4 表不变；`app_sessions` 本来没有 module 列。

---

## 11. 测试与回归

### 11.1 单测

- 后端：artifacts（单文档/实体/页面集/接口摘要）、entities/pages schema、字段 code/label、api-design core/validator、prototypes/designHash、digest、ui-check、fidelity 14 项、scaffold（需求骨架/AGENTS）、distribution（模板扫描）、chat prompt（无 module）、design system。
- 前端：design-adapter（全局 ER/页面集/code→label）、design-export、template-capture URL、contract-preview、design-ref、requirements helpers（TOC）、chat-empty、view-commands、ApiDesign 摘要/解析、Home/App 摘要。

### 11.2 e2e

| 脚本 | 变化 |
| --- | --- |
| `e2e:p2` | 单需求文档、TOC、骨架、无模块 CRUD、AI 上下文 |
| `e2e:p3` | 全局 ER、页面集、三 Tab、接口 Tab、无 module |
| `e2e:p4` | 应用级会话、无模块下拉、ui-check/fidelity 应用级 |
| `e2e:p7-4b` | 页面集/页面契约/线框（去 module） |
| `e2e:p9` | 设计预览 URL 去 module、全局实体/页面集 |
| `e2e:p10` | PNG 应用级 manifest/designHash、页面集 |
| `e2e:p7-6a` | fidelity 14 项（+api-design） |
| `e2e:p7-7c` | 自定义模板应用闭环新路径 |
| 新增 `e2e:api-design` | 接口 Tab、模板校验、覆盖矩阵、AI 修、0 console |

- 断言数不沿用旧基线；按新实跑记录。
- `e2e:p7-3b`/`p7-7b`（模板中心/Studio）原则上保持，若路径/文案变化则更新。

### 11.3 静态/烟测

- `npm test --prefix backend`、`npm test --prefix frontend`
- `build`、`typecheck`、`check:vue`
- `smoke:workspace`、`smoke:assets`
- 临时目录/独立端口/stub opencode；不启停真实 3300/4771。

### 11.4 真实模型

- 放在 D3 之后，用户明确同意后执行；
- 临时后端/opencode 端口 + 真实 `deepseek-flash`；
- 验证：需求单文档 → 实体/页面集 → 接口文档 → 应用 → 开发视图 digest/ui-check/fidelity；
- 不读写真实 `data/`、`projects/`、`.env`。

---

## 12. 分批实施

### D1：去模块底座（需求单文档 + 实体/页面集）

**范围**

- 需求单文档：路径、frontmatter、Epic/Story ID、scaffold 骨架、解析、UI、prompt/skill/command、模板扫描；
- 设计三文件中的 entities/pages：schema、解析、路径、全局 ER、页面集=Epic、字段 code/label、设计预览/PNG/ui-check/fidelity/digest 基础路径；
- 去模块：删除 `requirements-modules` 路由/模块文件逻辑、`docs/design/<MOD>` 路径、module prompt/会话参数、前端模块列表/下拉；
- 支撑产物应用级：brief/tokens/prototypes/ui-check；
- 测试：重写 p2/p3/p7-4b/p9/p10/p7-7c + 单测。

**出口**

- 新建应用生成 `requirements.md` 骨架；
- 设计 agent 能写 `entities.json` + `pages.json`；
- 设计视图全局 ER/页面集；无 module；
- 开发视图无模块下拉；ui-check/fidelity 应用级（fidelity 13 项，API 第 14 项留给 D2）；
- 所有静态检查/单测/e2e 通过。

### D2：接口设计文档

**范围**

- 新增 `api-design.md` 固定模板/规范/示例/校验（core + CLI + backend）；
- 新增 `adw-api-design` skill/command；
- 设计 prompt + 开发 digest + ui-check 接口列；
- 设计视图「接口设计」Tab；
- fidelity 第 14 项 `api-design`；
- 新增 `e2e:api-design`，更新 p3/p7-6a。

**出口**

- 设计 agent 按模板生成接口文档；
- 工作台渲染/校验/覆盖矩阵/AI 修；
- 开发 digest 能引用接口；
- 不生成后端代码。

### D3：开发联动 + 文档 + 回归

**范围**

- 开发 prompt/skill/AGENTS 全链路去模块化；
- 开发视图设计参考/开始卡/空态文案；
- 首页/外壳摘要；
- 文档：STATUS/README/AGENTS/plans/ops/report；
- 全量回归；
- 可选真实模型闭环。

**出口**

- 全链路无 module；接口文档参与开发参考；
- 文档与实际一致；
- 真实验证按用户授权执行。

---

## 13. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 单需求文档变大 | 章节 TOC/Epic 定位；agent 只读必要章节；不拆文件（避免重新引入分组） |
| `entities.json`/`pages.json` 变大 | 三文件已拆开；页面集只是数组分组；agent 增量修改；schema 校验 |
| ER 实体过多 | 全局 ER + 页面集高亮/筛选 + 实体搜索；不做聚合拆分 |
| 字段 code 命名不统一 | 内置命名规范 + 校验 warning；设计 skill 给示例 |
| 接口文档自由发挥 | 固定模板 + 规范 + 示例 + validator；errors 阻断生成 |
| 旧应用不可用 | 已确认硬切；不做迁移/legacy |
| e2e 大面积重写 | 按 D1/D2/D3 分批；断言数按实跑记录；不保留旧 fixture |
| 开发会话上下文变大 | digest 只给摘要；agent 按需读文件；用户在对话里指定 Epic |
| EOS/AFCenter 接口规范不一致 | 先在文档中显式写 basePath/响应包/权限；不声称已对接 |

---

## 14. 验收标准

1. 新建应用生成 `docs/requirements/requirements.md` 骨架（模板章节，无 module/order）。
2. 需求视图只有单文档/TOC/AI，不再有模块节点。
3. 设计 agent 产出 `entities.json`、`pages.json`、`api-design.md`（D2 后）。
4. ER 是全局一张图；实体/关系/页面集/字段 code 全部可校验。
5. 页面集 = Epic；页面集不做目录/权限/会话。
6. 接口文档有固定规范、索引、覆盖矩阵、详情、错误码；validator 可运行；设计视图可渲染。
7. 开发会话应用级；无模块下拉；ui-check/fidelity 应用级；fidelity 14 项。
8. 全仓库不再有应用模块路径/API/prompt 参数（除历史文档/删除证据）。
9. 单测/静态检查/e2e/smoke 按 D1—D3 实跑记录；真实模型验证按用户授权另记。
10. DB 4 表不变；需求模板中心不变。

---

## 15. 待评审点

本文已按用户 2026-11-23 的决定收敛：

- 页面集 = Epic；
- 三份设计文件；
- 字段 code/label；
- 接口设计只做 Markdown 文档 + 内置模板/校验；
- 支撑产物应用级；
- 需求文档创建应用时生成骨架；
- 会话应用级；
- 旧数据硬切。

评审通过后按 D1 → D2 → D3 派**唯一**实施会话；同一时间只允许一个会话改文件。实施记录追加在本文文末。

---

## D1 实施记录（2026-11-23）

> 范围：去模块底座（单需求文档 + entities/pages）。**不做** D2 接口设计；未启停真实 3300/4771，未调真实模型，未读写真实 `data/`/`projects/`/`.env`，未做 git。

### 改动

- **需求单文档**：新增 `docs/requirements/requirements.md`（frontmatter 仅 `title`/`template`）；`backend/src/requirements/doc-file.ts`（缺失时按模板生成骨架、已存在不覆盖、frontmatter template 读取）；`templates/render.ts` 改为 `renderRequirementsMarkdown`（Epic `EP-001`/Story `US-001` 约定）；删除 `requirements/module-files.ts` 及其测试；`apps/scaffold.ts` 创建应用时写骨架；`apps/routes.ts` 新增 `GET/POST /:id/requirements-document`，删除 `requirements-modules` 路由。
- **产物**：`workspace/artifacts.ts` 重写为 `{appId, requirement, entities, pages, errors, hashes, designHash}` + `prototypes/brief/tokens/uiCheck`；新增 `design/hash.ts`（`sha256(entities.json + pages.json + design-system.json)`）；`design/prototypes.ts` 应用级路径/manifest（`pageSet`）/designHash；`requirements/templates.ts`、`templates/distribution.ts` 模板引用/删除保护扫描单文档 frontmatter。
- **设计 UI**：`design-adapter.js` 接受 entities/pages（全局实体/关系 + 页面集）；`DesignView` 左侧页面集/实体，Tab「实体关系 / 页面集」；`DesignErPanel` 全局 ER + 页面集筛选/实体搜索 + code/label；`DesignPrototypePanel`/`design-preview.html` URL 去 `module`；`DesignPreviewApp` 读 artifacts；`design-export`/`template-capture` 应用级。
- **开发联动**：`chat/service.ts` 去除 module/`allowModule`，prompt 读单文档 + entities/pages；`dev/digest.ts` 应用级摘要（Epic/页面集/实体，不注入整篇）；`dev/ui-check.ts` → `docs/design/ui-check.md`（按 Epic 分节）；`dev/fidelity.ts` + `fidelity-core.cjs` 应用级 **13 项**（`api-design` 留给 D2）；`DevView` 去模块下拉，设计参考显示 Epic/页面集/页面/实体。
- **资产/文档**：`adw-requirements-document`/`adw-design-artifacts`/`adw-frontend-implementation` skill 与 4 个 command 去模块；新增 `entities.schema.json`/`pages.schema.json` 与示例，删除 `design.schema.json`/`design-example.json`；`validate.mjs` 校验 entities/pages；`afc-remote`/`workshop` 文案路径更新。

### 命令与结果（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **230 / 230** |
| `npm test --prefix frontend` | **177 / 177** |
| `npm run typecheck --prefix frontend` / `npm run check:vue --prefix frontend` | 通过 |
| `npm run build --prefix backend` / `--prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过 |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型） |
| `e2e:p2` | **101** 条断言 |
| `e2e:p3` | **126** 条断言 |
| `e2e:p4` | **134** 条断言 |
| `e2e:p7-4b` | **57** 条断言 |
| `e2e:p9` | **79** 条断言 |
| `e2e:p10` | **81** 条断言 |
| `e2e:p7-6a` | **19** 条断言 |
| `e2e:p7-7c` | **117** 条断言 |
| `e2e:p7-3b` / `e2e:p7-7b` | **77 / 73** 条断言 |

e2e 均为临时目录 + 独立端口 + stub opencode；断言数按本轮实跑记录，未沿用旧基线。

### 偏差

- `e2e:p9` 的弹窗宽度断言改为“CSS 变量为契约 760px 且在可用宽度内 clamp（600—760）”：设计视图三栏变窄后 iframe 可用宽度不足 760，实际 clamp 到 676；不是契约丢失。
- 内部 `DesignField.name` 作为渲染键复用字段 `code`，中文显示名放 `label`（页面契约文件仍严格使用 `code`/`name`）。渲染器因此无需大改。
- 历史 UI 截图脚本 `backend/scripts/ui1b-shots.ts`、`ui2a-shots.ts`、`ui2b-shots.ts`、`ui3a-shots.ts`、`ui3b-shots.ts` **D1 时未更新**去模块（**D3 已更新到单文档 + entities/pages + 新 testid 并实跑，见 D3 记录**）。
- 内部 testid/CSS class 仍沿用 `module-outline`（需求章节大纲容器）、`design-module-list`（设计左侧页面集/实体）、`design-module-loading` 等命名；功能语义已去模块（D1 保留 testid 以减少 e2e 抖动），**D3 已清理为 `requirements-outline`/`design-pageset-list`/`design-outline-loading` 等并同步 e2e/单测**。
- `e2e:preview` 未重跑（模板预览宿主未改）；首页/外壳原本不显示模块数，未新增 Epic/页面摘要（需要逐应用读 artifacts，D2/D3 再评估）。

### 未验证

- 真实 3300/4771 的重启后人工视觉验收（本轮不启停；由用户 `restart.cmd`/`restart.sh` 后复核）。
- 真实模型驱动的新链路（单文档 → 实体/页面集 → 接口文档）在 D3 后按用户授权执行。
- 旧应用硬切后的用户手工重建（不提供迁移/兼容代码）。

---

## D2 实施记录（2026-11-23）

> 范围：接口设计文档（`docs/design/api-design.md`）固定模板/规范/示例/校验 + 设计视图 Tab + 开发引用。**不做** D3；不生成后端代码/OpenAPI；未启停真实 3300/4771，未调真实模型，未读写真实 `data/`/`projects/`/`.env`，未做 git。

### 改动

- **内置标准/skill**：新增 `templates/agent/skills/adw-api-design/`（`SKILL.md`、`references/api-conventions.md`、`api-design-template.md`、`api-design-example.md`、`scripts/lib/api-design-core.cjs`、`scripts/validate-api-design.mjs`）与 `templates/agent/commands/generate-api-design.md`（应用 command 5→6）。共享 core 只解析 Markdown 表格/章节，返回 `{ok,interfaces,byEpic,errors,warnings,coverage}`；CLI 失败退出 1、参数/目录错误退出 2。
- **「操作」字段（D0 补充）**：索引与详情元信息均新增 `操作`（`list/detail/create/update/delete/batchDelete/export/import/action/other`）；实体 CRUD 覆盖按该字段判断，页面动作覆盖按 `pages.json` 的 `rowActions/toolbarActions`（form 页补 `submit`）。设计稿 §5.3 已加补充说明并同步模板/示例/校验。
- **后端**：新增 `dev/api-design.ts`（`readApiDesign`，缺失文件 `exists:false` 不抛 500，附原始 `markdown`）；`workspace/artifacts.ts` 增 `apiDesign` 并把其 errors 并入 `errors`；`dev/digest.ts` 增接口摘要（数量/Epic/前 8 条，超长省略，不注入整篇）；`dev/ui-check.ts` 增「接口对照（页面动作 → 接口）」表（无文档也生成“待填”行，hash marker 保留）；`fidelity-core.cjs` 增第 14 项 `api-design`（缺文件/覆盖缺口 warn，errors fail，只报告）；`check-fidelity.mjs`/`check-design-fidelity.md`/`adw-frontend-implementation` 文案 13→14；`templates/distribution.ts` 方法 skill 增 `adw-api-design`，应用 AGENTS/README/设计 skill 文案补 `api-design.md`；`chat/service.ts` 设计/开发 prompt 增接口文档与 skill、`APP_EXPECTED_COMMANDS` 增 `generate-api-design`；`apps/scaffold.ts` 应用 AGENTS/README 补接口规则（不生成文件）；`workspace-smoke`（6 command/14 项）、`verify-agent-assets`（API skill/6 command）同步。
- **前端**：新增 `workbench/ApiDesignPanel.vue`（`MarkdownView` 渲染 `api-design.md`，顶部摘要、覆盖与校验问题、错误「让 AI 修」、空态「生成接口设计」、渲染失败提示不白屏）与纯逻辑 `workbench/api-design-helpers.js`；**B7 起「让 AI 修」改为自动发送 + 修复状态条（`api-design-fix-status`），不再只填 Composer**；`workbench/api.ts` 增 `ApiDesignArtifact`/`ArtifactsResponse.apiDesign`；`DesignView` 增第三 Tab「接口设计」与摘要接口数，`generate` 走 `runCommand('generate-api-design')`、`fix` 走 `sendComposer` + 完成刷新；`dev/view-commands.js` design 增 `generate-api-design`；`dev/design-ref.js`/`DevView` 增接口数（`dev-api-count`）；`workbench/chat-empty.js` 设计示例加“生成接口设计”。
- **资产/文档**：`templates/afc-remote/README.md`、`src/views/AppIndex.vue` 读 `api-design.md`；`backend/scripts/api-design-e2e.ts`（新 `e2e:api-design`）；本设计稿 §5 增「操作」补充并追加本记录；`docs/STATUS.md`、`docs/plans/README.md`、`AGENTS.md`、`README.md` 更新。

### 命令与结果（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **235 / 235**（新增 `dev/api-design.test.ts` 5 项，其余 artifacts/digest/ui-check/fidelity/distribution/scaffold/chat 同步） |
| `npm test --prefix frontend` | **181 / 181**（新增 `api-design-helpers.test.mjs` 4 项，view-commands/design-ref 同步） |
| `npm run typecheck --prefix frontend` / `npm run check:vue --prefix frontend` | 通过 |
| `npm run build --prefix backend` / `--prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过（6 command、fidelity 14 项） |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型；加载 `adw-api-design` + 6 command） |
| `e2e:api-design`（新增，stub opencode + 临时目录 + 端口 3449/4449） | **26** 条断言，0 console error / 0 pageerror / 0 请求失败 / 0 外部请求 |
| `e2e:p3` | **129** 条断言 |
| `e2e:p4` | **135** 条断言 |
| `e2e:p7-6a` | **21** 条断言 |
| `e2e:p7-7c` | **118** 条断言 |
| `e2e:p7-3b` / `e2e:p7-7b` | **77 / 73** 条断言 |

e2e 均为临时目录 + 独立端口 + stub opencode；断言数按本轮实跑记录，未沿用旧基线。

### 偏差

- **「操作」字段是对 D0 §5.3 的必要补充**：原骨架只有「名称」列，无法机器判断实体 CRUD 覆盖；已在索引/详情增加 `操作` 并同步示例/校验（不影响旧文档硬切口径）。
- **共享 core 双路径**：`fidelity-core.cjs` 与后端优先加载仓库 `templates/agent/skills/adw-api-design/...`，回退应用内 `.opencode/skills/...`；CLI 内 `require('./lib/api-design-core.cjs')`。三处规则完全一致。
- **ui-check 新接口表在 hash marker 覆盖范围内**：旧版 `ui-check.md` 骨架的 hash 不再匹配，会被判定为 `filled`（视为用户已编辑，不自动重写）；新应用/缺失文件生成新骨架。
- **fidelity 缺文件只 warn**：未生成 `api-design.md` 不会 fail（符合“只报告不阻断”）；errors 存在才 fail。
- **错误码缺失按 errors 处理**：设计稿 errors/warnings 两处都提到错误码；实现取更严格口径（缺错误码 → error，错误码表存在但为空 → warning），与 errors 列表一致。
- **页面动作只校验已声明动作**：来源 `rowActions/toolbarActions`，form 页额外补 `submit`；未声明动作不产生 warning。
- **UI-3b 之后的前端 dist 需用户 restart 才在真实 3300 生效**（本轮不启停实例）。

### 未验证

- 真实 3300/4771 的视觉验收（设计视图「接口设计」Tab、Markdown 渲染、覆盖表）——本轮不启停，由用户 `restart.cmd`/`restart.sh` 后复核。
- 真实模型按 `adw-api-design` skill 生成接口文档的闭环（D3 后按用户授权执行）。
- 历史 `backend/scripts/ui*-shots.ts` 仍为 D1 前旧 API/testid（继续保留为历史遗留，不属于 D2 回归）。
- D3（开发联动全链路去模块、首页/外壳摘要、文档与全量回归）未开始。

---

## D3 实施记录（2026-11-23）

> 范围：D1/D2 残留命名清理 + 历史 UI 截图脚本更新 + 全量回归 + 文档/汇报。**不执行**真实模型闭环（需用户另行授权）；未启停真实 3300/4771；未读写真实 `data/`/`projects/`/`.env`；未做 git。

### 改动

- **残留命名清理**：`RequirementsOutline` 的 `module-outline`/`module-outline-loading`/`new-module-btn` → `requirements-outline`/`requirements-outline-loading`/`generate-requirements-btn`；`DesignView` 的 `design-module-list`/`design-module-loading` → `design-pageset-list`/`design-outline-loading`，CSS `col-modules`/`modules-head`/`modules`/`module`/`module-*` → `col-outline`/`outline-head`/`outline-list`/`outline-item`/`item-*`；`view-commands.commandArgs` 去掉 module 参数（`AgentChatPanel`/单测同步）；`p2-e2e`/`p3-e2e` 引用同步；清理 e2e/fixture 中的 `requirements-modules`、`design-module-*`、`MOD-001` 语义残留（历史文档/证据保留）。
- **历史 UI 截图脚本**：新增共享 fixture `backend/scripts/ui-shots-fixtures.ts`（单文档 + entities/pages）；`ui1b/ui2a/ui2b/ui3a/ui3b` 更新到当前模型与新 testid；删除已不存在的「新建模块对话框」截图与断言（ui3b 24→23），保留卡片/tab/dialog/无溢出口径。实跑：**ui1b 11 / ui2a 10 / ui2b 7 / ui3a 13 / ui3b 23** 张截图；ui2a/2b/3a/3b 输出到 `docs/plans/evidence/2026-11-23-ui2a|ui2b|ui3a|ui3b/`，ui1b 输出临时目录。
- **全量回归**：见下表；`p2` 断言因无模块 CRUD 从 120 降到 **101**，其余按实际。
- **文档/汇报**：本记录；`docs/STATUS.md` D3 节；`docs/plans/README.md`；`AGENTS.md`/`README.md`/`docs/ops/switch-to-agent-first.md` 当前口径；`docs/report/ai-dev-workbench-overview.md` 更新到去模块/单文档/entities+pages+api-design/14 项/3 方法 skill/6 command，并重新生成 HTML/PDF；`docs/report/README.md` 同步。

### 命令与结果（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **235 / 235** |
| `npm test --prefix frontend` | **181 / 181** |
| `npm run typecheck --prefix frontend` / `npm run check:vue --prefix frontend` | 通过 |
| `npm run build --prefix backend` / `--prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过 |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode 2.2.5 / 4719，不调模型） |
| `e2e:p2` / `p3` / `p4` | **101 / 129 / 135** |
| `e2e:preview` / `p7-3b` / `p7-4b` / `p9` / `p10` | **93 / 77 / 57 / 79 / 81** |
| `e2e:p7-6a` / `p7-7b` / `p7-7c` / `api-design` | **21 / 73 / 118 / 26** |
| `npx tsx scripts/ui1b-shots.ts` | **11** 张，9 次无溢出 |
| `npx tsx scripts/ui2a-shots.ts` | **10** 张，10 次无溢出 |
| `npx tsx scripts/ui2b-shots.ts` | **7** 张，7 次无溢出 |
| `npx tsx scripts/ui3a-shots.ts` | **13** 张，12 次无溢出 |
| `npx tsx scripts/ui3b-shots.ts` | **23** 张，22 次无溢出，17 次口径测量 |
| `npm run build:report --prefix backend` | HTML 743,241B；PDF 1,213,383B，约 **15** 页；离线/无溢出/版心检查通过 |

e2e/UI 截图均为临时目录 + 独立端口 + stub opencode（不调模型）；断言数按本轮实跑记录。

### 偏差

- **`design-module-loading` → `design-outline-loading`**：直接改 `design-loading` 会与主画布已有 `design-loading` testid 冲突（重复 testid 破坏 Playwright 严格定位），故采用语义更明确的 `design-outline-loading`。
- **报告打印 CSS 略收紧**：字号 10.2pt / 行高 1.6 / 页边距 12mm，使 PDF 保持 ≤15 页（原 16 页）；HTML/PDF 已重新生成。
- **报告截图未重截**：`docs/report/assets/view-*.png` 仍为旧截图（部分显示模块/旧 13 项），已在报告与 README 明确标注“沿用”；当前 UI 证据指向 `evidence/2026-11-23-ui2a|ui2b|ui3a|ui3b/`。
- **ui3b 少 1 张截图**：需求视图「新建模块」对话框已不存在，删除该截图与 footer 断言（24→23）；卡片/tab/dialog 口径仍覆盖。
- **首页/外壳未新增摘要**：没有为 Epic/页面/接口数新增逐应用 artifacts 请求；现有需求/设计模板摘要不变。
- **`e2e:p2` 101**：无模块 CRUD/新建模块断言后自然下降（原 120），不是功能回退。
- **后端 `dist` 已构建**：但真实 3300 运行进程为旧代码；D3 未改后端运行时代码，前端 dist 重建后由 Express 即时托管。

### 未验证

- **真实模型闭环未执行（需用户另行授权）**：需求单文档 → 实体/页面集 → 接口设计 → 应用 → 开发 digest/ui-check/fidelity 全链路。
- 真实 3300/4771 视觉验收（本轮只读核对：3300 PID **31532**、4771 PID **45096**，启动 **2026-11-23 15:08:35/36**；未启停）。
- 报告截图/流程图未重截；真实 AFCenter 宿主 `pm-*`、EOS 构建/运行、真实 401/403 未验证。
- 旧应用硬切后的用户手工重建（不提供迁移/兼容代码）。

> **O1—O3 后续调整（2026-11-23）**：按用户确认删除需求左侧章节大纲，改为「左对话（可拖拽）+ 右文档」；设计改为「左对话 + 中页面集/实体 + 右主区」；≤1024 对话/页面集左抽屉互斥；`generate-design` 同轮生成 entities/pages/api-design。详见 `docs/plans/2026-11-23-layout-and-api-generation-polish-brief.md`。

> **B6—B7 后续调整（2026-11-24，待评审）**：`pages.json` 新增页面级可选 `actionTargets`（显式优先、同页面集；create/edit 目标 `dialog-form/page-form/main-sub/wizard`，`main-sub` 合法；detail 只做详情）；交互预览把 `main-sub` 纳入 create/edit 表单目标，无表单页时打开临时表单并标注「临时表单 · 未设计表单页」+ 原因/候选；接口设计「让 AI 修」改为一键发送 + 修复状态（不再只填 Composer）。详见 `docs/plans/2026-11-24-action-targets-and-api-fix-state-brief.md`。



