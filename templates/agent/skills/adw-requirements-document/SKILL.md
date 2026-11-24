---
name: 需求文档编写与维护
description: 维护应用唯一需求文档 docs/requirements/requirements.md（单文档、Epic/Story 稳定 ID），与设计产物保持一致
---

# 需求文档编写与维护

需求产物是**一份文件**：`docs/requirements/requirements.md`。没有模块文件、没有模块目录。

## 1. 先读，再写

- 先读 `AGENTS.md` 与 `docs/requirements/requirements.md`。
- 设计文件（`docs/design/entities.json`、`pages.json`、`api-design.md`）**如存在才读；不存在跳过，不要报错、不要创建空设计文件**。
- 只有用户明确要求“同步设计”时才读设计文件并判断是否需要同步；不存在是正常的。
- 章节结构以 frontmatter 的 `template` 对应 `adw-template-req-<id>` skill 为准（骨架在 `assets/template.md`）；
  找不到时用应用默认模板 skill。
- 只做**增量修改**：不要整篇重写，不要新建 `MOD-xxx-*.md`。

## 2. 文件契约

frontmatter 只允许：

```markdown
---
title: 商品管理应用
template: builtin-prd
---
```

- `title`：应用/文档标题；
- `template`：应用级需求模板 id（模板中心/DB 不变）；
- **不要写 `module` / `order`**（已移除）。
- 正文用 `##` 章节；Epic/Story 用稳定 ID：

```markdown
## 3. Epics & Stories

### EP-001 商品管理

**目标**：...

#### US-001 商品列表

- 作为...
- 验收标准：...
```

- Epic ID：`EP-<3位以上数字>`；Story ID：`US-<3位以上数字>`；
- 设计页面集的 `epic` 必须引用这里的 Epic ID。

## 3. 写作范围

- 写业务目标、范围、角色、规则、Epic/Story、验收标准、非功能需求、待确认问题；
- 不写 Controller/Service 类名、内部表结构、接口 path（属于设计与代码）；
- 需求与设计冲突：先报告并说明取舍，不要静默偏离。

## 4. 与设计一致

- 设计文件**存在时**才检查 `docs/design/entities.json`、`pages.json`、`api-design.md` 是否需要同步；不存在时跳过，不要报错、不要创建空设计文件。
- 用户明确要求同步设计时，页面集（Epic）/页面/字段/枚举/操作必须能在需求中找到依据；
- 不确定结构时先读 `adw-design-artifacts` skill 的 schema/示例，仍无法判断时在回复里说明。

## 5. 自查

- frontmatter 只有 `title`/`template`；Epic/Story 不被重命名（ID 稳定）；
- 每个 Epic 至少一个 Story；验收标准可验证；
- 完成后用中文汇报：改了哪些章节、与设计的同步点、待确认项。

## 6. 边界

- 不要动 `.opencode/skills/**`、`.opencode/commands/**`（受管资源会被覆盖）；
- 不要执行任何 git 操作；
- 修改后回读目标文件，核对用户要求的具体取值/规则/字段是否已出现。
