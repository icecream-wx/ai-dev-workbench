# 接口设计固定规范

本文件是 `docs/design/api-design.md` 的**固定规范**。写接口设计前必须读本文件与 `api-design-template.md`；不得自创 Markdown 结构。

## 1. 基础

- Base path：`/api`（可配置，但必须在「0. 文档信息」写明）；路径一律写完整路径（含 basePath）。
- 传输：JSON UTF-8；文件上传 `multipart/form-data`。
- 认证：AFCenter 宿主登录态；不在 URL 放 token。
- 时间：ISO-8601；日期 `YYYY-MM-DD`。
- ID：string（避免 JS 精度问题）。
- 金额：decimal 字符串，保留 2 位。
- 枚举：使用 `entities.json` 的 `options[].value`；显示用 `label`。

## 2. URL 规范

- 资源复数、kebab-case：`/goods`、`/goods/{id}`；
- 嵌套只用于真实从属，最多两层：`/orders/{orderId}/items`；
- 方法：
  - `GET /goods` 列表
  - `GET /goods/{id}` 详情
  - `POST /goods` 新建
  - `PUT /goods/{id}` 更新
  - `DELETE /goods/{id}` 删除
  - `POST /goods/batch-delete` 批量删除
  - `POST /goods/{id}/approve` 业务动作
  - `POST /goods/export` 导出
  - `POST /goods/import` 导入
  - `POST /files` 上传；`GET /files/{id}` 下载

## 3. 请求规范

- 列表：`page`（从 1）、`size`（默认 20，最大 200）、`sort=field,asc|desc`、`keyword`；
- 字段筛选：与实体字段 `code` 同名；日期区间用 `<field>From`/`<field>To`；
- 请求体：JSON；路径参数/查询参数/请求体在文档中分行写清；
- 幂等：create/import/batch 可选 `Idempotency-Key`。

## 4. 响应规范

```json
{ "code": "OK", "message": "ok", "data": null }
```

- 成功：`code = "OK"`；
- 分页：`data = { "total": 123, "items": [] }`；
- 失败：`code` 为稳定大写蛇形错误码，如 `GOODS_NOT_FOUND`；同时给 HTTP 状态；
- 校验失败：`code = "VALIDATION_FAILED"`，`data = { fields: [{ field, message }] }`；
- 不允许在成功响应里混入 `success: true` 等额外字段；以 `code` 为准。

## 5. 权限规范

- `<resource>:<action>`：`goods:read`、`goods:write`、`goods:delete`、`goods:export`、`goods:import`、`goods:approve`；
- 无权限控制的接口写 `public`，并在说明中写原因。

## 6. 数据类型

`string / number / decimal / boolean / date / datetime / enum / ref / file / object / array`。

- `enum` 必须写枚举名和取值来源；
- `ref` 写实体 id，接口值为实体主键；
- `file` 写 MIME 限制和大小上限。

## 7. 批量 / 导入导出 / 文件

- 批量删除：`POST /goods/batch-delete`，body `{ ids: [] }`，返回 `{ deleted, failed: [{id, reason}] }`；
- 导入：`POST /goods/import`，multipart，返回 `{ taskId }`；用 `GET /tasks/{id}` 轮询；
- 导出：小数据直接返回文件；大数据返回 `{ taskId }`；文档写清阈值；
- 文件：上传返回 `{ id, name, size, mime }`；下载带权限校验。

## 8. 操作（D2 补充）

接口索引与详情元信息必须写 **操作**，取值固定：

| 操作 | 含义 |
| --- | --- |
| `list` | 分页列表 |
| `detail` | 详情 |
| `create` | 新建 |
| `update` | 更新 |
| `delete` | 删除 |
| `batchDelete` | 批量删除 |
| `export` | 导出 |
| `import` | 导入 |
| `action` | 业务动作（审批/上下架等） |
| `other` | 字典/选项/文件等非 CRUD 接口 |

- 实体 CRUD 覆盖用 `操作` 字段判断（list/detail/create/update/delete）；
- 页面动作覆盖用覆盖矩阵 3.1：页面动作来自 `pages.json` 的 `rowActions/toolbarActions`，表单页加 `submit`；
- 未被页面引用且非后台/字典/文件接口的接口，应在说明写 `background`，否则会 warning。

## 9. 校验

- 共享核心：`scripts/lib/api-design-core.cjs`；CLI：`scripts/validate-api-design.mjs`；后端/fidelity 复用同一份。
- errors 阻断：缺必需章节、ID 重复、method+path 重复、路径不以 `/api` 开头、方法非法、引用不存在、索引/详情不一致、缺请求/响应/错误码、列表缺分页、字段 code 不存在。
- warnings 不阻断：页面动作/实体 CRUD 未覆盖、接口未被页面引用、权限/错误码/示例缺失、Epic 标题不一致、响应字段未标来源。
