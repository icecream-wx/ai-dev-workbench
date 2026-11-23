---
name: adw-frontend-implementation
description: 开发视图实现前端页面时加载：按设计系统/页面契约/蓝图施工，先填 ui-check 对照表，使用 PageTemplates/pm-*/GlobalPreference，完成后截图比对并汇报差异与未实现项
---

# 前端实现（设计 → 代码）

开发阶段的产物是**工作区里的代码**：`frontend/`（独立 Module Federation remote）+ `docs/` 下的需求/设计文件。
本 skill 负责把设计契约与蓝图落成页面，并留下可核对的对照证据；不替代 `design.json`、蓝图或团队 skill。

## 1. 何时加载

- 开发视图开始实现/修改 Vue3 页面时。
- 收到“按设计实现页面”“还原蓝图”“补齐列表/表单/树页面”等请求时。
- 只改 EOS 后端结构/接口时不需要本 skill（但样式不要改后端）。

## 2. 读取顺序（不要跳步）

1. `AGENTS.md`：应用约定、受管资源、禁止事项。
2. `docs/design/design-system.json`：pack / 应用类型 / 视觉风格 / 页面库 / 蓝图根。
3. `docs/design/<MOD>/design.json`：数据模型与页面契约（recipe / catalogRef / blueprint /
   filters / columns / rowActions / toolbarActions / form / tree / components）。
4. `docs/design/<MOD>/design-brief.md`、`tokens.json`、`prototypes/*.png`：
   视觉变量与模板风格截图（无显式契约的旧设计为线框）；PNG 过期（`prototypes/_manifest.json` 的 designHash 与当前
   design.json 不一致）先说明，不盲从。
5. `docs/design/template/<applicationType>/pages/*.vue` + `structure.css` +
   `docs/design/template/styles/shared.css` + `docs/design/template/styles/<styleId>/style.css`：
   蓝图与结构/风格基准（具体路径以 `design-system.json` 的 `styles` 为准）。
6. `frontend/` 现有代码：`src/router/index.js`、`src/views/`、`src/components/PageTemplates/`、
   `src/preferences/GlobalPreference.js`；相似页面优先复用，不重写。
7. 团队 skill：`../afcenter-page-generation/SKILL.md`（页面配方/偏好/安装）、
   `../pm-components-usage/SKILL.md`（pm-* 字段组件用法）。

优先级：**需求 > design-system/design.json 契约 > 蓝图（布局/组件） > brief/tokens
（视觉变量） > prototypes/*.png（模板风格截图；无显式契约的旧设计为线框）**。

## 3. 先填 `ui-check.md`（软门禁）

工作台会在 `docs/design/<MOD>/ui-check.md` 生成骨架；实现前先补「实现前」表：

| 设计页 | 路由 | 蓝图 | 字段/列 | 操作 | 布局/交互 | 差异/决策 |
| --- | --- | --- | --- | --- | --- | --- |

- 页面/路由/蓝图/字段/列/操作/布局以 design.json + 页面库 + 需求为准；
- 差异/决策写冲突取证与取舍（不要只写“按蓝图”）；
- 实现后在「实现后」表补：实现文件、截图、一致项、差异、原因/处理；
- 未填写**不阻断**，但完成汇报必须标记“流程未完成”，并在下一步补齐；
- 工作台骨架已存在时**不要删除/覆盖**整份文件，增量填入。

## 4. 输出页面对照表（回复里也给一份）

| 页面 | 路由 | 蓝图 | 字段/列 | 操作 | 布局/配方 | 差异 |
| --- | --- | --- | --- | --- | --- | --- |

- 对照表是“施工计划 + 验收证据”，不是装饰；缺少契约时先说明缺什么，不要凭感觉造页面。

## 5. 蓝图复制 / 适配

1. 从 `docs/design/template/<applicationType>/pages/<Blueprint>.vue` 选择最接近的页面，
   复制到 `frontend/src/views/<业务目录>/`（按现有工程结构组织）。
2. **保留**：模板结构、样式、PageTemplates 区块、组件组合、偏好读取方式。
3. **替换**：mock 数据/静态数组 → 实际接口或明确的演示数据；文案 → 业务字段；
   路由/菜单按目标工程接入；权限/字典按真实接口，缺失时明确标注，不伪造。
4. 蓝图里 import 的样式/静态资源按目标目录调整路径；不要修改 `docs/design/template/`
   下的受管蓝图与样式。
5. 多个页面共用区块时抽到 `src/components/`，但不要改造成“另一套模板”。

## 6. 页面模板与组件规范

- 列表/树/表单优先使用 `frontend/src/components/PageTemplates/`：
  `BusinessListPage`、`TreeListPage`、`StandardFormPage`、`FormSection`、`QueryPanel`、
  `RowActions`、`ThreePartPagination`（按目标工程实际导出名选择）。
- 新增/编辑默认 `pm-form-dialog`；独立页面表单用 `StandardFormPage`。
- 所有 `el-table` 使用 `v-auto-height`，不要固定 height/max-height。
- 业务字段 > 8 用双列；备注/描述等多行文本 `pt-field-full` 独占整行；双列弹窗宽度 ≤ 800px。
- 批量操作（依赖勾选记录）放 `batch-actions`，不要放顶部 actions；树节点菜单用 MoreFilled。
- 统一导入 `frontend/src/preferences/GlobalPreference.js`；页面特殊要求用显式属性覆盖，
  预设只在页面 computed 合并，不修改全局单例、不复制固定外观参数到每页。
- `pm-*` 由 AFCenter 宿主全局提供：**不重复注册/打包**，不复制宿主私有源码。
- 禁止手写一套表格/表单/样式替代 PageTemplates/pm-*；缺少组件时停下报告，不自造同名组件。

## 7. 完成后的验证与截图

1. 能启动就启动目标前端（按 `frontend/README.md` 的 `npm install` / `npm run dev` /
   `build:prod`）；不能启动时明确说明原因。
2. 逐页对照蓝图/预览：导航、区域、字段/列、操作、空态/错误态、主色/间距/圆角。
3. 可截图时保存到工作区（如 `docs/screenshots/`）并写进 ui-check「实现后」表；
   无法截图时写清未验证项，不要声称“视觉已还原”。
4. 检查基础交互：查询/翻页、校验/回显、保存锁、删除末页回退、选择清理、
   失败保留输入；未验证就说明。

## 7.1 一致性自查（只报告）

完成后在应用根目录运行：

```bash
node .opencode/skills/adw-frontend-implementation/scripts/check-fidelity.mjs --app . --module <MOD-xxx>
```

- 覆盖：设计系统、页面契约、蓝图文件、实现视图/路由（启发式）、PageTemplates、
  `pm-*`、`pm-form-dialog/FormSection`、`v-auto-height`、GlobalPreference、
  structure/style/visual-style、ui-check、PNG stale；
- 按 `pass/warn/fail + evidence` 逐项处理：fail 先修，warn 说明“真实缺口”还是
  “启发式无法判断”；不要为了通过检查而伪造文件；
- 开发视图「检查一致性」按钮调用同一套规则（`POST /api/apps/:id/design-fidelity`）；
- 只报告、不阻断、不自动改代码；退出码默认 0（`--strict` 才在 fail 时非 0）。

## 8. 冲突与偏离

- 需求 / design-system / design.json / brief / tokens / PNG / 蓝图冲突时**先报告**：
  列出冲突文件与字段、各自说法、推荐取舍；不要静默选一边。
- 用户明确指定优先于蓝图；此时把偏离写进 ui-check「差异/决策」与完成汇报。
- tokens/PNG 只约束 Vue3 前端；EOS 后端不吃风格，不要为样式改后端结构或字段。
- PNG 是模板风格截图（无显式契约的旧设计为线框）；蓝图/预览是视觉事实。PNG 过期先说明再决定是否参考。

## 9. 完成汇报

用中文汇报：

- 实现了哪些页面/路由/文件；
- 每页的蓝图来源与对照结果（一致项/差异/原因）；
- 使用了哪些 PageTemplates / `pm-*` / GlobalPreference；
- ui-check.md 是否已填（未填标记“流程未完成”）；
- 截图路径（若有）、启动/自测结果；
- 未实现项、未验证项、待确认项。

## 10. 边界

- 不改 `.opencode/skills/**`、`.opencode/commands/**`（受管资源会被覆盖）。
- 不改 `docs/design/design-system.json`、`docs/design/template/**`、`tokens.json`、
  `prototypes/**`（受管/工作台生成）。
- 不执行任何 git 操作；不提交真实凭据；不启停真实环境。
- 需求/设计需要改动时，回到对应视图改源文件，再同步代码，不要只在代码里“实现需求”。
