# 商品管理应用 · 接口设计

## 0. 文档信息

| 项 | 值 |
| --- | --- |
| 版本 | 1.0 |
| 更新时间 | 2026-11-23 |
| Base path | `/api` |
| 依据 | `docs/requirements/requirements.md`、`docs/design/entities.json`、`docs/design/pages.json` |
| 范围 | 本应用全部接口，按 Epic/页面集分组 |

## 1. 接口规范

固定规范见 skill 的 `references/api-conventions.md`；本节保留摘要，不改结构。

### 1.1 基础

- JSON UTF-8；AFCenter 宿主登录态；时间 ISO-8601；ID 为 string；金额 decimal 字符串。

### 1.2 URL 规范

- 资源复数、kebab-case；路径为完整路径（含 `/api`）。

### 1.3 请求规范

- 列表 `page`/`size`/`sort`/`keyword`；字段筛选与实体字段 `code` 同名。

### 1.4 响应规范

- `{ code, message, data }`；分页 `data = { total, items }`；错误码稳定大写蛇形。

### 1.5 权限规范

- `<resource>:<action>`；无权限控制写 `public`。

### 1.6 数据类型

- `string / number / decimal / boolean / date / datetime / enum / ref / file / object / array`。

### 1.7 批量 / 导入导出 / 文件

- 批量删除 `POST /goods/batch-delete`；导出 `POST /goods/export`；文件上传 `POST /files`。

## 2. 接口索引

| ID | 方法 | 路径 | 名称 | 操作 | Epic/页面集 | 页面 | 实体 | 权限 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| goods.list | GET | /api/goods | 商品分页列表 | list | EP-001 商品管理 | goods-list | goods | goods:read |
| goods.detail | GET | /api/goods/{id} | 商品详情 | detail | EP-001 商品管理 | goods-list | goods | goods:read |
| goods.create | POST | /api/goods | 新建商品 | create | EP-001 商品管理 | goods-list | goods | goods:write |
| goods.update | PUT | /api/goods/{id} | 更新商品 | update | EP-001 商品管理 | goods-form | goods | goods:write |
| goods.delete | DELETE | /api/goods/{id} | 删除商品 | delete | EP-001 商品管理 | goods-list | goods | goods:delete |
| goods.batchDelete | POST | /api/goods/batch-delete | 批量删除商品 | batchDelete | EP-001 商品管理 | goods-list | goods | goods:delete |
| goods.export | POST | /api/goods/export | 导出商品 | export | EP-001 商品管理 | goods-list | goods | goods:export |
| category.options | GET | /api/categories/options | 分类选项 | other | EP-001 商品管理 | goods-form | | category:read |

## 3. 覆盖矩阵

### 3.1 页面动作覆盖

| 页面集 | 页面 | 动作 | 接口 | 说明 |
| --- | --- | --- | --- | --- |
| EP-001 商品管理 | goods-list | create | goods.create | |
| EP-001 商品管理 | goods-list | detail | goods.detail | |
| EP-001 商品管理 | goods-list | edit | goods.update | |
| EP-001 商品管理 | goods-list | delete | goods.delete | |
| EP-001 商品管理 | goods-list | batchDelete | goods.batchDelete | |
| EP-001 商品管理 | goods-list | export | goods.export | |
| EP-001 商品管理 | goods-form | submit | goods.update | 新建/编辑共用 |

### 3.2 实体 CRUD 覆盖

| 实体 | list | detail | create | update | delete | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| goods | goods.list | goods.detail | goods.create | goods.update | goods.delete | |

### 3.3 非 CRUD / 后台接口

| 场景 | 接口 | 页面/触发 | 说明 |
| --- | --- | --- | --- |
| 分类选项 | category.options | goods-form | 表单分类下拉 |

## 4. 公共模型 / 枚举（可选）

### ENUM-goodsStatus

来源 `entities.json` 的 `goods.status.options`：`ON_SALE`（上架）、`OFF_SALE`（下架）。

## 5. 接口详情

### 5.1 EP-001 商品管理

#### goods.list 商品分页列表

| 项 | 值 |
| --- | --- |
| 方法/路径 | `GET /api/goods` |
| 操作 | `list` |
| 页面集 | EP-001 商品管理 |
| 页面 | goods-list |
| 实体 | goods |
| 权限 | goods:read |
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

#### goods.detail 商品详情

| 项 | 值 |
| --- | --- |
| 方法/路径 | `GET /api/goods/{id}` |
| 操作 | `detail` |
| 页面集 | EP-001 商品管理 |
| 页面 | goods-list |
| 实体 | goods |
| 权限 | goods:read |
| 说明 | 单个商品详情 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- | --- |
| id | path | string | 是 | - | 商品 ID |

**响应 data**

| 字段 | 类型 | 来源/说明 |
| --- | --- | --- |
| goodsCode | string | 实体 goods.goodsCode |
| name | string | 实体 goods.name |
| status | enum(goodsStatus) | 实体 goods.status |

**错误码**

| code | http | 说明 |
| --- | --- | --- |
| GOODS_NOT_FOUND | 404 | 商品不存在 |

**示例**

```http
GET /api/goods/1001
```

#### goods.create 新建商品

| 项 | 值 |
| --- | --- |
| 方法/路径 | `POST /api/goods` |
| 操作 | `create` |
| 页面集 | EP-001 商品管理 |
| 页面 | goods-list |
| 实体 | goods |
| 权限 | goods:write |
| 说明 | 新建商品 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- | --- |
| goodsCode | body | string | 是 | - | 商品编码 |
| name | body | string | 是 | - | 商品名称 |
| status | body | enum(goodsStatus) | 否 | ON_SALE | 状态 |

**响应 data**

| 字段 | 类型 | 来源/说明 |
| --- | --- | --- |
| id | string | 实体 goods.id |
| goodsCode | string | 实体 goods.goodsCode |

**错误码**

| code | http | 说明 |
| --- | --- | --- |
| VALIDATION_FAILED | 400 | 参数校验失败 |
| GOODS_CODE_DUPLICATED | 409 | 商品编码重复 |

**示例**

```http
POST /api/goods
Content-Type: application/json

{"goodsCode":"P-1001","name":"笔记本","status":"ON_SALE"}
```

#### goods.update 更新商品

| 项 | 值 |
| --- | --- |
| 方法/路径 | `PUT /api/goods/{id}` |
| 操作 | `update` |
| 页面集 | EP-001 商品管理 |
| 页面 | goods-form |
| 实体 | goods |
| 权限 | goods:write |
| 说明 | 更新商品（新建/编辑表单提交） |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- | --- |
| id | path | string | 是 | - | 商品 ID |
| goodsCode | body | string | 是 | - | 商品编码 |
| name | body | string | 是 | - | 商品名称 |
| status | body | enum(goodsStatus) | 否 | - | 状态 |

**响应 data**

| 字段 | 类型 | 来源/说明 |
| --- | --- | --- |
| id | string | 实体 goods.id |
| status | enum(goodsStatus) | 实体 goods.status |

**错误码**

| code | http | 说明 |
| --- | --- | --- |
| GOODS_NOT_FOUND | 404 | 商品不存在 |
| VALIDATION_FAILED | 400 | 参数校验失败 |

**示例**

```http
PUT /api/goods/1001
Content-Type: application/json

{"goodsCode":"P-1001","name":"笔记本 Pro","status":"ON_SALE"}
```

#### goods.delete 删除商品

| 项 | 值 |
| --- | --- |
| 方法/路径 | `DELETE /api/goods/{id}` |
| 操作 | `delete` |
| 页面集 | EP-001 商品管理 |
| 页面 | goods-list |
| 实体 | goods |
| 权限 | goods:delete |
| 说明 | 删除商品 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- | --- |
| id | path | string | 是 | - | 商品 ID |

**响应 data**

| 字段 | 类型 | 来源/说明 |
| --- | --- | --- |
| data | object | 空对象 |

**错误码**

| code | http | 说明 |
| --- | --- | --- |
| GOODS_NOT_FOUND | 404 | 商品不存在 |

**示例**

```http
DELETE /api/goods/1001
```

#### goods.batchDelete 批量删除商品

| 项 | 值 |
| --- | --- |
| 方法/路径 | `POST /api/goods/batch-delete` |
| 操作 | `batchDelete` |
| 页面集 | EP-001 商品管理 |
| 页面 | goods-list |
| 实体 | goods |
| 权限 | goods:delete |
| 说明 | 按 id 批量删除 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- | --- |
| ids | body | array<string> | 是 | - | 商品 ID 列表 |

**响应 data**

| 字段 | 类型 | 来源/说明 |
| --- | --- | --- |
| deleted | integer | 删除数量 |
| failed[].id | string | 实体 goods.id |

**错误码**

| code | http | 说明 |
| --- | --- | --- |
| VALIDATION_FAILED | 400 | ids 为空 |

**示例**

```http
POST /api/goods/batch-delete
Content-Type: application/json

{"ids":["1001","1002"]}
```

#### goods.export 导出商品

| 项 | 值 |
| --- | --- |
| 方法/路径 | `POST /api/goods/export` |
| 操作 | `export` |
| 页面集 | EP-001 商品管理 |
| 页面 | goods-list |
| 实体 | goods |
| 权限 | goods:export |
| 说明 | 导出商品台账（小数据直接返回文件） |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- | --- |
| keyword | body | string | 否 | - | 导出范围筛选 |

**响应 data**

| 字段 | 类型 | 来源/说明 |
| --- | --- | --- |
| file | file | xlsx 文件流 |

**错误码**

| code | http | 说明 |
| --- | --- | --- |
| AUTH_FORBIDDEN | 403 | 无权限 |

**示例**

```http
POST /api/goods/export
Content-Type: application/json

{"keyword":"笔记本"}
```

#### category.options 分类选项

| 项 | 值 |
| --- | --- |
| 方法/路径 | `GET /api/categories/options` |
| 操作 | `other` |
| 页面集 | EP-001 商品管理 |
| 页面 | goods-form |
| 实体 | |
| 权限 | category:read |
| 说明 | 表单分类下拉选项 |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- | --- |
| parentId | query | string | 否 | - | 上级分类 |

**响应 data**

| 字段 | 类型 | 来源/说明 |
| --- | --- | --- |
| value | string | 分类 id |
| label | string | 分类名称 |

**错误码**

| code | http | 说明 |
| --- | --- | --- |
| AUTH_FORBIDDEN | 403 | 无权限 |

**示例**

```http
GET /api/categories/options
```

## 6. 待确认 / 不做

- 商品图片上传暂不在本期范围。
- 商品审批流由后续 Epic 定义。

## 7. 变更记录

| 日期 | 变更 | 作者 |
| --- | --- | --- |
| 2026-11-23 | 初稿 | agent |
