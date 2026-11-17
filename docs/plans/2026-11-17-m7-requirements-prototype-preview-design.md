# M7（#8）需求阶段原型预览 设计稿

日期：2026-11-17
状态：**待用户确认**（确认后再写实施交接单并派实施会话；本文不含代码改动）
上游：
- `docs/plans/2026-11-13-module-requirements-design.md` §6.4 / §12（#8 原始定稿）
- `docs/plans/2026-11-13-app-templates-brief.md` §1.5（#7 只读模板解析，明确供 #8 使用）
- `docs/plans/2026-11-17-main-review-handoff.md`（当前基线）

---

## 0. 本轮用户决策（2026-11-17，覆盖上游两条旧描述）

| # | 问题 | 决策 |
| --- | --- | --- |
| 1 | 产物定位与入口 | 原型预览**本身就是设计阶段页面集同构的产物**，只是把它提前到需求阶段做"提前预览"。因此入口挂**需求大纲树每个模块下的独立节点「原型预览」**（与需求模板章节节点同级），不放在文档头部 tab、不做独立一级页签 |
| 2 | 线框程度 | **纯骨架占位**：只画筛选区/表格/表单/详情等骨架，不合成字段名，避免展示"假字段" |
| 3 | "全部模块" | **不做单独的全模块聚合视图**：每个模块各自有「原型预览」节点，切换模块即切换预览。上游 §6.4 / §12 的"当前模块 + 全部模块切换"按本条调整为"按模块分别预览" |

推论：预览产物必须**按模块 + 按 Epic** 组织（Epic = 页面集，Story = 页面），与 D-RMP 设计阶段的生成语义保持一致；但需求阶段**不落库、不产 PNG、不建设计项目、不进交接包**。

---

## 1. 目标与非目标

**目标**

1. 需求确认前，用户能按模块看到"将来设计阶段会生成哪些页面集与页面"（Epic→页面集、Story→页面），从而发现漏页、错分层、Story 归属问题。
2. 视觉风格跟随 #7 解析出的原型模板（企业级/简洁/sidebar 深浅/圆角/密度），与设计阶段观感一致（骨架级）。
3. 完全确定性：零模型调用、零写库、零文件产物；文档变化后自动刷新。

**非目标（明确不做）**

- 不创建/更新设计项目、实体、页面集、页面、设计版本；不产 PNG、不写 `prototypes/`；不参与交接包与覆盖度。
- 不作编辑：页面类型、字段、布局、Story 增删都在需求文档/设计阶段完成。
- 不新增数据库表或列；不做旧应用数据兼容（沿用 2026-11-13 政策）。
- 不做"全部模块"聚合视图、不做导出、不做批注、不做移动端手机壳渲染。
- 不改设计阶段（D-RMP）、交接包、Change Set、U7。

---

## 2. 数据来源与派生规则

### 2.1 输入

| 来源 | 用途 |
| --- | --- |
| `app_modules`（`moduleOrThrow` / `defaultModule`） | 模块头、排序、归档标记；**只读**，不懒创建模块 |
| `app_requirement_docs` + `app_requirement_doc_sections` | `section.sectionKey='epics'` 的 `data`（`RequirementEpic[]` / `RequirementStory[]`）；**只读**，不建文档 |
| `prototype_templates`（经 `appPrototypeTemplate(appId, moduleId)`） | `tokens`/`shell`/`patterns`/`pageSetRules` + `source`（`design-project`/`app-default`/`global-default`） |
| ~~设计项目实体/页面集~~ | **不读**：需求阶段预览与设计数据解耦，避免互相污染 |

### 2.2 派生顺序（确定性、可单测）

1. Epic 顺序 = 文档 `data.epics` 数组顺序；Story 顺序 = `data.stories` 数组顺序（不重排、不按优先级排序）。
2. 过滤 `archived === true` 的 Epic 与 Story；过滤后为空的 Epic 仍保留（见规则 6）。
3. **每个 Epic → 一个页面集**：`{ key: 'pv:<moduleKey>:<epicId>', epicId, title: epic.title, goal, priority, pages: [...] }`。
4. **每个 Story → 一个页面**：`{ key: 'pv:<moduleKey>:<storyId>', storyId, title: story.title, type: inferPageType(title), priority, summary: 截断后的 description }`。
5. Story 的 `epicId` 为空、或指向不存在/已归档的 Epic → 归入**「未归属 Story」虚拟页面集**（`epicId: null`，`key: 'pv:<moduleKey>:unassigned'`；仅在存在此类 Story 时出现）。
6. Epic 过滤后没有 Story → 该页面集 `pages: []` + warning `epic-without-story`。
7. 无 `epics` 章节、或过滤后 `epics.length === 0` → `pageSets: []` + warning `no-epics`（前端空态）。
8. 模块无文档 / 文档为空 → 同规则 7，并置 `module.hasDoc=false`；**不创建文档、不产版本**。
9. 所有 `key` 为**预览期合成键**，不写入任何表、不占用 `SCENE/EPIC/STORY`/页面/页面集 ID 空间。

### 2.3 页面类型推断（只看 Story 标题，按表顺序首个命中）

| 优先级 | 类型 | 关键词 |
| --- | --- | --- |
| 1 | `dashboard` | 报表、统计、概览、大盘、分析、指标 |
| 2 | `kanban` | 看板、泳道、卡片墙、拖拽 |
| 3 | `calendar` | 日历、排期、日程 |
| 4 | `gantt` | 甘特、进度计划、里程碑 |
| 5 | `form` | 新增、创建、编辑、录入、提交、维护、配置、设置、导入 |
| 6 | `detail` | 详情、查看、查阅、回看、预览 |
| 7 | `list` | 查询、列表、检索、筛选、搜索、管理、台账 |
| — | `list`（兜底） | 无命中 |

- 顺序即优先级：`查询商品详情` → `detail`；`统计报表` → `dashboard`；`商品列表` → `list`。
- 标题为空/纯空白 → `list` + warning `story-without-title`。
- 规则固定、无模型、无随机；后续如需人工覆盖，另开一批做（本次不做）。

### 2.4 警告码（非阻塞，前端以 chip 展示）

| code | 触发 |
| --- | --- |
| `no-module` | 应用下没有任何未归档模块（缺省 moduleId 时） |
| `no-epics` | 模块无 epics 数据 |
| `epic-without-story` | 某 Epic 无 Story |
| `story-without-title` | Story 标题为空 |
| `unassigned-stories` | 存在未归属 Story（附数量） |

---

## 3. 后端接口（只读）

### 3.1 `GET /api/apps/:id/requirements-prototype?moduleId=`

- 挂载方式：`apps.use('/:id/requirements-prototype', requirementPrototypeRoutes)`（与 `requirements-doc` 一致）。
- `moduleId` 缺省 → 默认模块（`defaultModule`，**不懒创建**）；显式传值 → `moduleOrThrow`（未知 404；**已归档允许只读**）。
- 应用不存在 → 404；无模块/无文档 → **200 + 空态**（不是 404，绝不写库）。
- 无 SSE、无模型、无文件写入；响应可缓存语义为"每次请求现算"。

```jsonc
{
  "appId": "app-xxx",
  "generatedAt": "2026-11-17T09:12:33.000Z",
  "module": {
    "id": "MOD-001", "key": "MOD-001", "title": "商品管理",
    "archived": false,
    "hasDoc": true, "docVersion": 3, "docStatus": "draft", "docUpdatedAt": "2026-11-17T09:10:02.000Z"
  },
  "template": {
    "id": "builtin-prototype-enterprise", "name": "企业级专业管理", "category": "enterprise",
    "source": "app-default",
    "tokens": { "primary": "#2563eb", "accent": "#0f766e", "neutral": "#475569", "background": "#f8fafc", "font": "...", "radius": 6, "spacing": 12, "density": "compact" },
    "shell": { "type": "sidebar", "sidebarDark": true, "contentWidth": 1280 },
    "patterns": { "list": { "filters": true, "rowActions": true, "pagination": true, "selection": true },
                  "form": { "presentation": "dialog", "labelPosition": "top", "groups": true },
                  "detail": { "sections": true, "relatedLists": true } },
    "pageSetRules": { "defaultPages": ["list", "form", "detail"], "formModes": ["create", "edit"],
                      "createAs": "dialog", "editAs": "dialog", "defaultPageSize": 10, "defaultSearchFields": 3 }
  },
  "pageSets": [
    { "key": "pv:MOD-001:EPIC-001", "epicId": "EPIC-001", "title": "商品档案维护", "goal": "…", "priority": "P0",
      "pages": [
        { "key": "pv:MOD-001:STORY-001", "storyId": "STORY-001", "title": "新增商品", "type": "form", "priority": "P0", "summary": "…" },
        { "key": "pv:MOD-001:STORY-002", "storyId": "STORY-002", "title": "商品列表", "type": "list", "priority": "P0", "summary": "…" }
      ] }
  ],
  "stats": { "epics": 2, "stories": 8, "pages": 8, "unmappedStories": 0 },
  "warnings": [ { "code": "epic-without-story", "message": "EPIC-002「商品明细维护」还没有 Story", "epicId": "EPIC-002" } ]
}
```

### 3.2 只读实现约束

- 新增 `doc.ts` 只读导出（如 `readRequirementDocIfExists(appId, moduleId)` → `{ doc, sections } | null`），**禁止**调用 `ensureRequirementDoc`。
- 不调用 `resolveModule`（它会懒创建默认模块）；用 `moduleOrThrow` / `defaultModule`。
- 只读断言要进测试：请求前后 `app_modules`/`app_requirement_docs`/`app_requirement_doc_sections`/`app_requirement_doc_versions`/`app_design_projects`/`app_design_*`/`app_design_versions`/`handoffs` 行数不变，`prototypes/` 无新增文件。

---

## 4. 前端 UI

### 4.1 需求大纲树（入口）

- `RequirementOutlineTree`：每个模块展开后，在模板章节列表**之后**新增节点「原型预览」（独立图标/徽标，`data-testid="outline-prototype-<moduleId>"`）。
- 点击节点 → 选中该模块（沿用现有切模块 flush 逻辑）+ 打开预览；当前打开的模块节点高亮（`aria-current`）。
- 归档模块同样保留节点（只读查看）。
- 点击任一模板章节节点 → 退出预览、回到该章节的编辑/预览（现有行为）。

### 4.2 预览面板（文档区中央）

```text
┌ MOD-001 商品管理 › [原型预览]     模板：企业级专业管理（应用默认）  v3  2 Epic · 8 页   [刷新] [查看文档]
├ 说明条：需求阶段粗略预览（骨架）· 不产出原型图 · 字段与交互在设计阶段生成
├ 页面集：[EPIC-001 商品档案维护 4] [EPIC-002 商品明细维护 4] [未归属 Story 1]
├ 页面：[新增商品 · 表单] [商品列表 · 列表] [商品详情 · 详情] …
├ ┌ .proto-skin 外壳（模板 tokens/shell）────────────────────────────┐
│ │ 侧栏导航 = 页面集（当前高亮） │ 顶栏 = 模块名 + 页面类型            │
│ │ 白纸：骨架（筛选区/表格/表单/详情/图表…），无真实字段名            │
│ └──────────────────────────────────────────────────────────────────┘
└
```

- **页面集 chips** = 派生出的页面集（Epic）；**页面 chips** = 当前页面集的页面（Story 标题 + 类型标签）。
- 默认选中第一个页面集的第一个页面；切换页面集时，若原页面不在新集合则重置为该集合第一页。
- 模板徽标显示 `design-project` → 「设计项目模板」/ `app-default` → 「应用默认」/ `global-default` → 「全局默认」。
- 空态（`no-epics`）：说明「先在需求文档补全「Epics & User Stories」，预览会自动按 Epic/Story 生成」+ 按钮「去补充需求」（切回章节编辑并定位 `epics` 章节）。
- 警告：说明条下展示 warning chips（非阻塞，可点击定位到对应 Epic/Story 章节）。
- 刷新：进入预览、切换模块、文档保存/AI 应用/版本回滚后自动刷新（父组件以 `doc.updatedAt + doc.version + 章节 max updatedAt` 作为 `refreshKey`）；另有手动「刷新」。
- 只读：预览面板内无任何编辑控件；`doc` 只读横幅（变更单未含本模块、已确认、归档、非需求阶段）在预览面板上方保留原样式。

### 4.3 骨架渲染

- 复用 `design-skin.css` + `prototype/wireframe.css` 的 `.proto-skin/.proto-shell/.proto-paper` 白纸语义与模板 CSS 变量（`--proto-primary/--proto-radius/--proto-spacing/...`），不复制模板逻辑。
- 新增轻量 `PrototypeSkeleton.vue`，只按类型画骨架：
  - `list`：筛选行（模板 `defaultSearchFields` 个占位）+ 表格列头 + `defaultPageSize` 行灰条 + 分页；
  - `form`：`patterns.form.labelPosition` 决定标签位置，6 行占位 + 底部按钮；
  - `detail`：`patterns.detail.sections` → 2 个分组 × 描述行；
  - `dashboard`：4 指标卡 + 2 图表占位；`kanban`：3 列卡；`calendar`：月网格；`gantt`：5 行条形；`custom`：文本块。
- 纸面固定标注：`粗略预览 · 字段与交互在设计阶段按实体生成`。
- 不使用 `PrototypeRenderer.vue`（它强依赖实体字段/mock 数据），避免展示假数据。

### 4.4 响应式与主题

- ≥1280：页面集 chips 与页面 chips 各一行，画布占满剩余宽高，内部滚动。
- 1024/768：纵向堆叠（chips 换行 → 画布），画布按容器宽度等比缩小（上限 100%），**不产生页面级横向溢出**；大纲抽屉打开预览后自动关闭。
- 深浅色：面板/说明条/chips 用 `--rg-*` token；画布维持"白纸"语义（与 V2 一致，不做深色反转）。
- 不新增一级页签、不改顶栏三阶段。

---

## 5. 复用与新增

**复用**

- `apps/template-resolution.ts#appPrototypeTemplate`（只读；不建设计项目）。
- `requirements/modules.ts`（`moduleOrThrow`/`defaultModule`/`listModules`）、`requirements/routes.ts` 的 `requireApp`/`route`/`moduleIdOf` 模式与 `requirementErrorHandler`。
- `frontend/src/design/design-skin.css`、`frontend/src/design/prototype/wireframe.css` 的 `.proto-*` 语义与模板 CSS 变量。
- `RequirementOutlineTree` 的模块节点/展开/选中结构；`RequirementsDocView` 的模块切换与 flush。

**新增（预计）**

| 位置 | 文件 | 内容 |
| --- | --- | --- |
| backend | `src/requirements/prototype-preview.ts` | 派生规则、类型推断、warning、模板解析接入、只读聚合 |
| backend | `src/requirements/routes.ts` | `requirementPrototypeRoutes`（GET `/`）+ 类型导出 |
| backend | `src/apps/routes.ts` | 挂载 `/:id/requirements-prototype` |
| backend | `src/requirements/doc.ts` | 只读 `readRequirementDocIfExists`（不建文档） |
| backend | `src/requirements/prototype-preview.test.ts` | 派生/推断/空态/只读/HTTP 测试 |
| frontend | `src/requirements/RequirementsPrototypePreview.vue` | 面板：chips、模板徽标、画布、空态/警告/刷新/缩放 |
| frontend | `src/requirements/PrototypeSkeleton.vue` | 纯骨架线框（类型驱动） |
| frontend | `src/requirements/prototype-helpers.js` + `.test.mjs` | 页面集/页面分组、选中回退、类型标签、缩放计算、空态推导 |
| frontend | `src/requirements/RequirementOutlineTree.vue` | 新增「原型预览」节点 + emit |
| frontend | `src/requirements/RequirementsDocView.vue` | `view: 'doc' \| 'prototype'`、节点接线、refreshKey、返回文档 |
| frontend | `src/requirements/api.ts` | `getRequirementsPrototype` + 类型 |

不新增表/列/迁移；不新增依赖。

---

## 6. 测试计划

**后端（新增 `prototype-preview.test.ts`，预计 12—16 项）**

1. Epic→页面集、Story→页面；顺序保持文档顺序；`archived` 过滤。
2. 类型推断表：8 类 + 优先级并列（`查询商品详情` → detail、`统计报表` → dashboard）+ 兜底 list。
3. Story 未归属（`epicId=null` / 指向已归档 Epic）→ 「未归属 Story」页面集。
4. Epic 无 Story → 空页面集 + warning。
5. 无文档 / 无 epics → `pageSets: []` + warning；**断言未创建文档**。
6. 无模块（应用存在、0 模块）→ 200 空态 + `no-module`，**断言未创建模块**。
7. 未知 moduleId → 404；归档模块显式读取 → 200 且只读。
8. 模板解析：`design-project` > `app-default` > `global-default`；模板被删除 → 回退且不 500。
9. 只读断言：请求前后各表行数不变、`projects/<app>/prototypes/` 无新增。
10. HTTP：GET 200 结构、缺省 moduleId、404 应用/模块、未知查询参数忽略。
11. 回归：`requirements/*` 现有测试全绿。

**前端（新增 `prototype-helpers.test.mjs`，预计 5—8 项）**

- 页面集/页面扁平化与选中回退、类型标签、空态判定、缩放系数（>内容宽、<内容宽）、warning 文案映射。

**Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 独立端口；stub 模型；不调真实模型）**

- 大纲树：每模块出现「原型预览」节点；点击后模块切换 + 节点高亮 + 文档模式 tabs 隐藏。
- 派生展示：2 模块各自页面集/页面数量与 Story 标题一致；类型标签正确。
- 骨架：页面切换后骨架类型变化；断言页面文本**不含**真实字段名（抽查 2 个）；含"粗略预览"提示。
- 模板：创建应用选「简洁后台」→ 徽标/侧栏浅色与 `app-default`；设计阶段切模板后（API 预置或 UI）→ `design-project`；全局默认回退。
- 空态：无 Epics 的模块 → 空态 + 「去补充需求」跳章节编辑并定位 epics。
- 刷新：修改 Story 标题保存后预览自动更新（无需手动刷新）；手动刷新可用。
- 响应式：1440/1280/1024/768 × 浅/深，0 console/page error、0 意外 API≥400、0 页面级横向溢出。
- 只读：预览期间无写请求（网络断言 PUT/POST 0 次）。
- 回归：`npm run smoke:requirements`、`smoke:modules`、`smoke:design`、`smoke:design-handoff`、`smoke:change-set` 全过；既有需求页 Playwright 主路径不回归。

---

## 7. 风险 / 待验证

| 风险 | 处理 |
| --- | --- |
| 关键词推断误判（标题无动作词） | 固定规则 + 兜底 list；页面 chips 显示类型便于用户发现；后续可加人工覆盖（本批不做） |
| 用户把骨架误当最终原型 | 面板与纸面双处"粗略预览"提示；无字段名、无交互 |
| 复用设计阶段 CSS 导致样式漂移 | 只复用 `.proto-*` 外壳与模板变量；骨架为独立组件，不改设计阶段文件 |
| 需求阶段无 Epic/Story（早期） | 明确空态 + 去补充入口，不报错 |
| `<768` 移动端 | 本批不验证（沿用既有范围） |
| 宽画布在 768 下缩放 | ResizeObserver 计算 scale，画布内部滚动；Playwright 断言无页面级溢出 |

---

## 8. 待确认（用户）

1. 「原型预览」节点放在模块展开列表的**最后**（模板章节之后）是否可接受？还是希望置于章节之前？（本稿默认最后）
2. 预览是否需要"导出/打印"（本次按不做处理）。
3. 页面 chips 是否显示 Story 描述摘要（默认不显示，仅 tooltip）。
