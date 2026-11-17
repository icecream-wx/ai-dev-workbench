# 设计阶段模块/Epic 对齐设计稿（D-RMP）

日期：2026-11-16
状态：**已定稿（用户 2026-11-16 确认）**。
上游：`docs/plans/2026-11-13-module-requirements-design.md`、M4/M5/M6 交接单、`docs/plans/2026-11-16-requirements-module-planning-design.md`、RMP-1/RMP-2 交接单、`docs/STATUS.md`「RMP-2 完成」。
政策：**不做旧设计数据迁移/兼容**；用户会重新跑需求→设计流程体验；实现只用临时数据验证。

---

## 1. 问题与现状

M4 已把设计表/设计项目按模块拆开：

- 每个模块独立设计项目、实体、页面集、页面、版本、确认、设计输入、stale；
- 页面集已有 `epicId` / `storyIds`，页面有 `requirementRefs`；
- 设计 AI 的页面集 prompt 已按 Epic 组织；实体有 `requirementRefs`。

仍缺：

1. **设计页导航**仍是独立左侧 `DesignModuleRail`（平铺模块），没有像需求大纲一样的模块树/Epic 节点；
2. **AI 实体生成是模块级一次性**：实体 prompt 读取整个模块全部 Epics/Stories；页面集生成也是模块级一次性，未按 Epic 逐段执行；
3. 缺少 **按 Epic 合并**：现有 `saveEntities`/`savePageSets` 只写传入集合，若只生成一个 Epic 的实体/页面集会删除其它 Epic 的数据；
4. 缺少“按 Epic 生成”的进度/失败重试/版本粒度。

本设计补齐导航、生成粒度、合并与版本语义；**不改数据库表结构**。

---

## 2. 已确认决策（2026-11-16）

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 导航 | 用**设计大纲树**替换左侧 `设计模块` rail；模块为根节点 |
| 2 | 数据集 | **模块级共享实体池**；按 Epic/Story 生成/合并；不按 Epic 复制实体 |
| 3 | 生成粒度 | **按 Epic 生成实体+页面集**；模块节点支持批量逐 Epic；保留整模块生成作兜底 |
| 4 | 应用方式 | 生成后**自动应用 + 设计版本/可回滚**（沿用现有设计 AI 行为）；不自动确认 |
| 5 | 版本 | **每个 Epic 一个设计版本** |
| 6 | 页面集 | 每个 Epic 默认一个生成页面集；重新生成替换该 Epic 页面集；手动可再加 |
| 7 | 存量 | **不做旧设计数据迁移/兼容**；用户重新跑流程 |

---

## 3. 信息架构

### 3.1 布局

- `>1024`：对话（400/336）+ 画布；画布内左侧 **设计大纲 260px（≤1280 220px）** + 右侧 Tabs/内容。
- `≤1024`：对话、大纲两个抽屉；画布全宽；“模块”按钮改为“大纲”。
- `≤768`：单栏 + 顶栏两行 + 大纲抽屉；内部滚动、无横向溢出。
- 删除 `DesignModuleRail` 的使用；“设计总览 / 原型模板”入口移到大纲头部。

### 3.2 树结构

```text
▾ MOD-001 商品管理  已确认 v2  [设计总览] [原型模板] [按 Epic 生成]
  ├ 数据集（共享实体 3）  [查看全部]
  │   ├ 商品        [STORY-001, STORY-004]  已确认
  │   ├ 商品明细    [STORY-002]             草稿
  │   └ 未归属实体（如有）
  ├ ▾ EPIC-001 商品档案   页面集 1 · Story 3/3   [生成此 Epic]
  │   ├ 页面集：商品档案（4 页，已生成/草稿/缺图）
  │   └ 相关实体：商品、商品明细（过滤入口，不重复建节点）
  ├ ▸ EPIC-002 商品明细   …
  └ 未归属 Epic/场景：页面集/实体
▸ MOD-002 订单管理  …
```

- **模块根**：key/标题/状态/版本/缺图/必选/本次变更；当前模块高亮；只展开当前模块（手风琴）；点其它模块切换设计项目（先 flush 全部编辑）。
- **数据集（模块共享）**：列出模块实体，显示状态、需求 refs、缺图无关；点实体切到实体 Tab 并选中。
- **Epic 节点**：来自 `project.input.epics`；显示页面集数、页面数、Story 覆盖、生成状态；点 Epic：
  - 选中 Epic，实体/原型 Tab 过滤到该 Epic 相关项（顶部“当前 Epic”chip，可清除）；
  - 设计对话 focus 设为 Epic；
  - 展开显示页面集（可能多个；生成页面集排第一）与“相关实体”链接。
- **Story 粒度**：不单独建 Story 节点；Epic 节点显示 `覆盖 Story x/y`；页面 `requirementRefs` / 页面集 `storyIds` 保持 Story 级；coverage Tab 继续展示 Story 明细。
- **未归属**：无 Epic 的页面集/实体（手工/fallback）归入“未归属 Epic/场景”。
- fallback（设计输入无 Epic）：使用 `SCENE-xxx` 作为场景节点，行为同 Epic；页面集 `sceneKey=SCENE-xxx`、`epicId=null`。

### 3.3 节点状态

- 模块：设计状态/版本/缺图（designModules 摘要）+ 当前项目详情。
- Epic：
  - `未生成`：无页面集且无相关实体；
  - `草稿`：有页面集/实体但未全部确认；
  - `已确认`：页面集及页面、相关实体全部 confirmed（且模块设计非 draft）；
  - `缺图`：页面缺 PNG；
  - `需同步`：项目 stale；
  - `生成失败`：仅本地运行态（刷新不保留）。
- Story 覆盖：`storyIds`/页面 `requirementRefs` 命中数。

---

## 4. 生成模型

### 4.1 共享实体池

- 实体属于**模块**，ID 全应用唯一；一个实体可服务多个 Epic/Story。
- 生成以 Epic 为单位，但写入模块实体池：
  - 新实体：追加；
  - 已有实体：按 id/name 匹配，合并字段/关系（按名称更新/新增，**不删除未提及字段/关系/实体**），`requirementRefs` 取并集；
  - 其它 Epic 的实体**绝不删除/覆盖**（除非本次生成明确更新了它）；
  - 不按 Epic 复制实体，避免重复表/FK。
- 页面集按 Epic；页面按 Story；页面只能绑定模块实体（跨模块实体引用沿用 M4 warning）。

### 4.2 每个 Epic 的生成流程

1. 读取模块设计输入、当前 Epic + Stories、模块现有实体、该 Epic 现有页面集（primary）。
2. **实体生成**（一次模型调用）：
   - prompt 聚焦当前 Epic/Stories；全模块上下文用于复用/关系；
   - 只输出“本 Epic 需要新增/变更的实体”；已有实体需保留 id/name；requirementRefs 限本 Epic 的 Story/Epic；
   - 不输出无关实体；字段/关系完整（对要更新的实体）。
3. **内存合并**实体（§4.1），得到 mergedEntities；不落库。
4. **页面集生成**（一次模型调用）：
   - 输入当前 Epic + Stories、mergedEntities、原型模板、该 Epic 现有页面集；
   - 输出**一个**页面集：`epicId`/`sceneKey` 当前 Epic，`storyIds` 本 Epic 下 Stories；页面覆盖 Stories，页面 `requirementRefs` 为 Story；
   - 页面类型 list/form/detail、模板规则沿用现有。
5. 合并页面集：
   - 找该 Epic 的 primary 页面集（`epicId` 匹配，按 position 第一个）；有则替换其 pages/spec（保留页面集 id），无则追加；
   - 其它 Epic 页面集、手工额外页面集保留；
   - 替换的页面集/页面为 draft（若原 confirmed，见 §5）。
6. 校验 mergedEntities/pageSets（现有 validate）；失败不写库。
7. 写入实体 + 页面集（尽量同一事务），追加**一个**设计版本（source=`ai`），更新项目；不自动确认。
8. 返回项目、warnings、新增/更新实体数、页面集/页面数、reopened 列表。

- 任一模型调用/解析/校验失败：**不写实体/页面集/版本**，可重试整个 Epic。
- 页面集页面替换语义：该 Epic primary 页面集整体重新生成；手工额外页面集不受影响。
- 实体合并语义：不删除其它 Epic 实体；不删除已有字段/关系（只更新/新增）。

### 4.3 批量

- 模块根 `按 Epic 生成`：
  - 选择 Epic（默认勾选“未生成/有缺口”的 Epic；可全选）；
  - 列出将受影响的已确认实体/页面集，需勾选“允许重新打开已确认项”（如有）；
  - 逐 Epic 顺序调用；进度/成功/失败/重试/停止剩余；
  - 每个 Epic 一个版本；完成后刷新模块摘要/项目/大纲，选中第一个生成项；
  - 生成中禁止再次生成/切模块（或切模块前先停止/确认）。
- Epic 节点 `生成此 Epic`：单个；相同确认/进度。
- 现有整模块 AI 按钮保留为“整模块生成（兜底）”，放到“更多”菜单，不默认展示；避免误覆盖全部 Epic。

---

## 5. 确认/重开/版本

- 生成结果实体/页面集/页面均为 **draft**；不自动确认。
- 设计项目 `confirmed`（模块级）时禁止生成；提示先“重新编辑设计”。
- 项目 draft 但目标实体/页面集/页面已 confirmed：
  - 预览/确认框列出受影响 confirmed 项；
  - 用户显式勾选 `允许重新打开已确认项`（前端 `reopenConfirmed` / 后端 body）后才允许；
  - 生成后仅受影响项退回 draft（实体/页面集/页面），其它 confirmed 保留。
- 设计输入 stale：禁止生成；先同步需求（现有同步弹窗）。
- 每个 Epic 生成追加一个设计版本（source=`ai`）；版本历史显示“AI 生成”，不单独存 Epic 列（本批不新增表/列）；用户可按版本回滚。
- 模块设计确认门禁/交接包/Change Set 语义不变；生成后仍需逐模块确认。

---

## 6. 对话 focus（对齐 Epic）

- 点击 Epic 时设置设计对话 `focus = { kind: 'epic', id: EPIC-xxx }`；清除时恢复模块级。
- 后端设计 prompt `focusBrief` 增加 Epic：当前 Epic、Stories、相关实体/页面集、生成建议；快速提示增加“按当前 Epic 生成设计/补充该 Epic 页面”。
- 设计对话仍用 `<<<DESIGN_JSON>>>`，可 module-level 输出；不改协议。focus Epic 仅收窄上下文，不强制。
- Entity/PageSet focus 保持；点击实体/页面集时覆盖 Epic focus。

---

## 7. API / 数据

### 7.1 新生成接口

`POST /api/apps/:id/design/generate-epic`

body：
```jsonc
{ "moduleId": "...", "epicId": "EPIC-001", "reopenConfirmed": false }
```
- `epicId` 可为 EPIC-xxx；fallback 场景 SCENE-xxx。
- 守卫：应用存在、模块可写、设计项目可编辑（非 confirmed）、需求已确认、非 stale、epic 属于设计输入、active Change Set 范围内。
- 返回：
```jsonc
{
  "project": { /* DesignProjectPayload */ },
  "warnings": [],
  "epicId": "EPIC-001",
  "entitiesAdded": 1, "entitiesUpdated": 2,
  "pageSetId": "ps-...", "pages": 4,
  "reopened": ["ent-...", "ps-...", "pg-..."]
}
```
- 内部两次模型调用（实体、页面集），内存合并，校验后一次写入/一个版本。
- 失败不写库；错误可读。

### 7.2 现有接口

- `POST /design/generate-entities`、`POST /design/page-sets/generate`（含 default）保留为整模块兜底，不改行为。
- `POST /design/page-sets/generate` 的 default（模板）仍可用。
- 不新增表/列；版本仍用 `app_design_versions`。

### 7.3 合并实现约束

- 新 `mergeEntitiesForEpic(existing, generated, epic)`：
  - 按 id/name 匹配；新实体追加；已有实体合并字段（按 name）与关系（按 name/target），缺失的保留；`requirementRefs` 并集；`status='draft'`；`position` 稳定；
  - 未提及的现有实体原样保留。
- 新 `mergePageSetForEpic(existing, generated, epic)`：
  - 按 epicId 找 primary（position 最小）；有则保留 id、替换 title/pages/storyIds/spec，状态 draft；无则追加；
  - 其它页面集原样保留。
- 全局 ID/引用解析沿用现有 normalizeEntities/normalizePageSets/validation；新增实体 ID 后端分配。
- 版本：写入后 `appendVersion(source='ai')` 一次。

---

## 8. UI 组件/交互

### 8.1 新增/修改

- 新增 `DesignOutlineTree.vue`：模块/数据集/Epic/页面集/未归属；选中/展开/操作/状态；设计总览/原型模板按钮；按 Epic 生成。
- 新增 `DesignEpicGenerationProgress.vue`（或复用通用进度样式）：Epic 列表/状态/重试/停止。
- 修改 `DesignStudio.vue`：删除 `DesignModuleRail`，画布内加大纲列；`selectedEpicId`；模块切换 flush；Epic focus；生成批处理；刷新 designModules/project；窄屏抽屉改“大纲”。
- 修改 `EntityDesignTab.vue`：
  - 支持 `focusEpicId` 过滤（实体 requirementRefs 含 Epic 或其 Stories）；
  - 暴露 `selectEntity(id)`（已有）；过滤 chip；
  - 整模块 AI 生成按钮移到“更多”或保留但标注兜底。
- 修改 `PrototypeTab.vue`：
  - 支持 `focusEpicId` 过滤页面集（epicId 或 storyIds 命中）；
  - 暴露 `selectSetById`/`selectPageById`；过滤 chip；
  - 整模块 AI/按场景生成收进“更多”。
- 修改 `DesignChatPanel.vue`/`design/api.ts`：focus type 增加 `epic`；生成 API。
- 删除 `DesignModuleRail.vue`（grep 零引用后）；保留 `DesignOverviewDialog`/`DesignTemplateSwitchDialog`，入口移入大纲/头部。
- 样式 token/深浅色/响应式；大纲 260/220；≤1024 抽屉；≤768 单栏；无横向溢出。

### 8.2 交互

- 模块根点击：切换模块（flush 当前 Tab/chat/实体/页面集）；当前展开；其它折叠。
- Epic 点击：`selectedEpicId`；实体/原型过滤；chat focus；页面集展开。
- 实体点击：清 Epic 过滤/切实体 Tab/选中。
- 页面集点击：切原型 Tab/选中；若属于 Epic，设 Epic focus。
- `生成此 Epic`/`按 Epic 生成`：
  - 检查 readonly/stale/project confirmed/out-of-scope；给确认（受影响 confirmed 项 + 页面集替换说明）；
  - 单 Epic：loading；成功刷新；失败重试。
  - 批量：勾选 Epic；逐项状态；失败继续/重试/停止剩余；完成后刷新。
- 生成中禁用再次生成/切换模块（可先停止）；完成后设计总览/大纲状态即时更新。

---

## 9. 不做

- 不改需求阶段/RMP-1/RMP-2；
- 不做旧设计数据迁移/兼容（用户重新跑）；
- 不新增数据库表/列；不改设计确认/交接包/Change Set 语义；
- 不做按 Story 独立实体集/页面集（页面按 Story，页面集按 Epic；实体模块共享）；
- 不做设计阶段模块增删/归档（沿用需求模块，设计只读模块管理）；
- 不做后台任务队列；批量生成为当前会话顺序执行，可停止剩余/重试；
- 不做 <768 移动端专项优化（沿用既有范围）。

---

## 10. 验收 / 测试

### 10.1 验收

1. 设计页无独立模块 rail；模块为设计大纲根节点；当前模块展开；切模块先 flush。
2. 模块根下显示数据集（共享实体）+ Epics + 页面集 + 未归属；Epic 状态/Story 覆盖可见。
3. 点 Epic 过滤实体/页面集、聚焦对话；点实体/页面集切 Tab 并选中。
4. 单 Epic 生成：实体/页面集按 Epic 生成并合并；其它 Epic 实体/页面集不丢；页面按 Story；一个版本。
5. 批量生成：勾选/进度/失败继续/重试/停止；每 Epic 一个版本。
6. 已确认目标：警告 + 显式勾选后重开；项目 confirmed 阻止；stale 阻止。
7. 整模块兜底仍可用；设计确认/交接包/Change Set 回归。
8. 1440/1280/1024/768、深浅色、无横向溢出、0 console/API 错误。

### 10.2 测试

- 后端单测（注入模型输出）：prompt 聚焦 Epic；merge 保留其它 Epic/字段/关系；页面集 primary 替换、其它保留；confirmed 重开/409；版本每 Epic 一次；失败不写库；fallback 场景；守卫；API。
- 前端纯逻辑：树构建（模块/数据集/Epic/页面集/未归属）、Epic 状态/Story 覆盖、过滤、批量选择/进度状态机、受影响 confirmed 计算。
- Playwright mock：树/手风琴/切换、Epic 过滤/焦点、单 Epic 生成、批量/失败重试/停止、confirmed 勾选、页面集替换/其它保留、版本、响应式深浅色；设计确认/交接包回归。
- 真实模型 E2E（主会话）：新应用需求两模块（商品/订单）→ 设计；按 Epic 生成；验证实体/页面集/页面/Story 覆盖、互不覆盖；记录耗时；临时应用删除。

---

## 11. 实施里程碑

- **D-RMP-1a：设计大纲树 + Epic 过滤/焦点 + 响应式**（UI 为主；不生成）。
- **D-RMP-1b：按 Epic 生成 + merge + 版本 + 批量进度/确认重开**（后端 + UI）。
- 建议同一实施会话先 1a 后 1b，完成后统一回传；主会话评审；RMP 需求链路不受影响。

---

## 12. 已确认

用户 2026-11-16 确认：1—7 全部按推荐；不做旧设计数据迁移；实现完成后用户重新跑需求→设计流程体验。
