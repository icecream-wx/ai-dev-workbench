---
name: 需求文档编写与维护
description: 在应用工作区中按用户选定模板编写/维护需求文档，结合现有材料并保持与设计一致
---

# 需求文档编写与维护

你负责本应用的需求文档。需求文档是**工作区里的文件**，不是聊天里的结构化协议：
`docs/requirements/MOD-xxx-<标题>.md`，每个模块一个文件。

## 1. 先调查，再动手

- 先读：`docs/requirements/`（已有模块）、`docs/design/`（已有设计）、`AGENTS.md`、`backend/`（代码现状）。
- 用户提到已有功能/界面/截图时，按需再读对应文件或截图；不要一次把所有文件塞进上下文。
- 已有产物优先：在现有模块文件上增量修改，不要重写整篇、不要新建重复模块。

## 2. 模块文件契约

文件 `docs/requirements/MOD-xxx-<标题>.md` 的开头必须是 frontmatter：

```markdown
---
module: MOD-001
title: 商品管理
order: 1
template: builtin-prd
---

# 商品管理

## 1. 背景与目标
...
```

- `module`：稳定 key（`MOD-001` 形式），全应用唯一；**不要改已有模块的 key**。
- `title` / `order`：标题与排序；改名/排序时同步 H1 标题与 frontmatter。
- `template`：本模块使用的全局需求模板 id。
- 正文用 `##` 章节；章节结构与模板保持一致（模板文件见下方“模板路径”）。
- 新模块的文件名必须与 frontmatter 的 key/标题一致：`MOD-002-订单管理.md`。

## 3. 写什么、不写什么

- 写**目标、业务规则、用户故事与验收标准**；业务字段/枚举/约束可以写。
- 不写 Controller 类名、内部表结构、接口路径（这些属于设计/代码）。
- 信息不足时写 `- 待确认：...`，不要编造业务规则。

## 4. 使用模板 skill

模板不是本 skill 的附属文件，而是**一个模板一个 skill**：

- 模块 frontmatter 的 `template` 指向哪个 id，就加载 skill `adw-template-req-<id>`。
- 找不到对应模板 skill 时，使用应用默认模板对应的 `adw-template-req-<id>` skill。
- 仍找不到时，按本 skill 的通用要求写，并在回复里说明“缺少模板”。

模板 skill 里包含：

- `SKILL.md`：章节清单（标题/层级/必需性/撰写提示）与使用方式；
- `assets/template.md`：模块骨架（`MOD-XXX` 占位标题 + 示例注释）。

使用规则：

- 用模板的章节标题作为骨架；新建模块时替换 `module` / `title` / `order`，保留 `template`。
- 不要修改模板 skill 里的任何文件（受管资源，会被工作台覆盖）。
- 不要在模块目录里新建模板副本；模板只在 skill 里维护。

## 5. 与设计保持一致

- 改需求时判断 `docs/design/<MOD>/design.json` 是否需要同步（实体/字段/枚举/页面/动作）。
- 需求与设计必须一致；**同步由你自己完成**，不要只把“需要同步”留给用户：
  - 需要同步设计时，加载 skill `adw-design-artifacts`，按其 `references/design.schema.json`
    修改 `docs/design/<MOD>/design.json`（没有该文件时按 schema 新建）。
  - 不确定结构时先读 schema 与 `references/design-example.json`；仍无法判断时，
    说明具体差异并提问，不要猜造字段。
- 改完两边后，在回复里说明改了哪些需求章节、同步了哪些设计实体/页面。

## 6. 交付与汇报

- 只改必要的文件；不要动 `.opencode/skills/**`、`.opencode/commands/**`（受管资源）。
- 不要在仓库里执行任何 git 操作（不 init/commit/revert）。
- 修改后回读目标文件，核对用户要求的具体取值/规则/字段是否已出现；没有就继续改，不要只回复“已完成”。
- 完成后用中文汇报：关键判断、改了哪些文件/章节、需求与设计是否一致、待确认项。

## 7. 模块增删

- 用户要求**新增模块**时，直接新建模块文件（frontmatter + 模板章节骨架），并说明新模块 key。
- 用户要求**删除模块**时，可以删除对应模块文件（工作台 UI 不提供删除）；删除前确认没有其它文件引用该模块。
- 不要创建 `README.md` 索引：大纲由文件列表生成。
