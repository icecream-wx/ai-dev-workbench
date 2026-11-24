# <应用名> · 接口设计

<!-- 固定模板：章节标题、表格列名不要改；只替换 <...> 与表格内容。 -->

## 0. 文档信息

| 项 | 值 |
| --- | --- |
| 版本 | 1.0 |
| 更新时间 | <YYYY-MM-DD> |
| Base path | `/api` |
| 依据 | `docs/requirements/requirements.md`、`docs/design/entities.json`、`docs/design/pages.json` |
| 范围 | 本应用全部接口，按 Epic/页面集分组 |

## 1. 接口规范

固定规范见 skill 的 `references/api-conventions.md`；本节保留摘要，不改结构。

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
| `<resource>.<action>` | `GET/POST/PUT/DELETE/PATCH` | `/api/<resource>` | <名称> | `<list/detail/create/update/delete/batchDelete/export/import/action/other>` | `EP-001 <Epic>` | `<page-id>` | `<entity-id>` | `<resource>:<action>` |

## 3. 覆盖矩阵

### 3.1 页面动作覆盖

| 页面集 | 页面 | 动作 | 接口 | 说明 |
| --- | --- | --- | --- | --- |
| `EP-001 <Epic>` | `<page-id>` | `<action>` | `<interface-id>` | |

### 3.2 实体 CRUD 覆盖

| 实体 | list | detail | create | update | delete | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `<entity-id>` | `<interface-id>` | `<interface-id>` | `<interface-id>` | `<interface-id>` | `<interface-id>` | |

### 3.3 非 CRUD / 后台接口

| 场景 | 接口 | 页面/触发 | 说明 |
| --- | --- | --- | --- |
| <字典/文件/后台任务> | `<interface-id>` | <页面或 background> | |

## 4. 公共模型 / 枚举（可选）

### ENUM-<name>
### DTO-<name>

## 5. 接口详情

### 5.1 EP-001 <Epic 标题>

#### <API-ID> <接口名称>

| 项 | 值 |
| --- | --- |
| 方法/路径 | `GET /api/<resource>` |
| 操作 | `<list/detail/create/update/delete/batchDelete/export/import/action/other>` |
| 页面集 | EP-001 <Epic 标题> |
| 页面 | `<page-id>` |
| 实体 | `<entity-id>` |
| 权限 | `<resource>:<action>` |
| 说明 | |

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- | --- |
| page | query | integer | 否 | 1 | 页码 |
| size | query | integer | 否 | 20 | 每页 |

**响应 data**

| 字段 | 类型 | 来源/说明 |
| --- | --- | --- |
| total | integer | 总数 |
| items[].<fieldCode> | <type> | 实体 <entity>.<fieldCode> |

**错误码**

| code | http | 说明 |
| --- | --- | --- |
| AUTH_FORBIDDEN | 403 | 无权限 |

**示例**

```http
GET /api/<resource>?page=1&size=20
```

## 6. 待确认 / 不做

- 

## 7. 变更记录

| 日期 | 变更 | 作者 |
| --- | --- | --- |
| <YYYY-MM-DD> | 初稿 | agent |
