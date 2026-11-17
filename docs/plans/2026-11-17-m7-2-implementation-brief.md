# M7-2（#8 v2）需求阶段 AI 参考原型 实施交接单

日期：2026-11-17
状态：**待用户确认后派实施会话**（本单不改代码）
设计稿：`docs/plans/2026-11-17-m7-2-ai-prototype-spec-design.md`（§0 决策、§2 数据模型、§3 生成、§4 接口、§5 渲染、§6 UI、§8 测试）
上游：M7（2026-11-17 已评审）——沿用大纲树入口、只读模板解析、确定性 Epic 范围统计；**替换"纯骨架"呈现**。

---

## 1. 范围

- 需求阶段「原型预览」改为**AI 参考原型**：从模块 PRD 生成 `entities/fields/pages` 规格（存 `app_settings`），用设计阶段渲染器 + 示例数据渲染真实字段页面。
- 显式生成/重新生成、过期提示、失败重试、Story 覆盖统计。
- **只写** `app_settings` 一个键；不写需求/设计/交接包/Change Set/阶段/会话/PNG。

**不做**：规格手工编辑、多模块合并、交互跳转、移动端手机壳、PNG 导出、进交接包、设计阶段读取预览规格、新增表/列/迁移、旧数据兼容、`<768`。

---

## 2. 前置

| 项 | 值 |
| --- | --- |
| 基线 | 后端 **280/280**、前端 **163/163**、`typecheck`/`build`/`check:vue` 通过 |
| 真实实例 | 3300 已由用户重启（当前含 M7）；本批**不启停** |
| 验证环境 | 临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 独立端口（3442 等）+ `OPENCODE_AUTO_START=false` + stub 模型 |

---

## 3. 后端任务

### B1 生成与归一化（新 `src/requirements/prototype-spec.ts`）

```ts
export interface PrototypeSpecEntityField { name: string; label: string; type: SpecFieldType; required?: boolean; unique?: boolean; options?: string[]; target?: string; note?: string }
export interface PrototypeSpecEntity { id: string; name: string; description: string; fields: PrototypeSpecEntityField[] }
export interface PrototypeSpecPage { id: string; title: string; type: PrototypePageType; epicId: string | null; storyIds: string[]; entityId: string | null; fields: string[]; actions: string[] }
export interface PrototypeSpec {
  schema: 'requirements-prototype/1'; generatedAt: string; model: string | null
  base: { docVersion: number; docUpdatedAt: string | null }
  entities: PrototypeSpecEntity[]; pages: PrototypeSpecPage[]; notes: string[]
  stats: { entities: number; fields: number; pages: number }
}
export function buildPrototypeSpecPrompt(input: PrototypeSpecPromptInput): string
export function parsePrototypeSpecOutput(raw: string, context: SpecNormalizeContext): PrototypeSpec   // 解析/归一化/校验；失败抛 RequirementDocError(502, …)
export function readStoredPrototypeSpec(appId: string, moduleId: string): PrototypeSpec | null
export function specStateOf(appId: string, moduleId: string, current: { docVersion: number; docUpdatedAt: string | null }, spec: PrototypeSpec | null): { status: 'missing'|'ready'|'stale'; staleReason: 'doc-changed'|null }
export function coverageOf(spec: PrototypeSpec | null, stories: RequirementStory[]): { stories: number; coveredStories: number; uncoveredStoryIds: string[] }
export async function generatePrototypeSpec(appId: string, moduleId?: string, options?: { signal?: AbortSignal; generator?: (input: PrototypeSpecPromptInput) => Promise<string> }): Promise<PrototypeSpec>
```

实现要点（严格按设计稿 §3）：

1. 输入聚合：模块行；PRD 全章节 `{title,kind,markdown}`（单章节 ≤6KB、总 ≤40KB，超出写 note）；活跃 Epics/Stories（id/title/goal/description/acceptance/priority）；模板 `{name,description,patterns,pageSetRules}`；应用名。**不得读设计表**。
2. Prompt：`<<<PREVIEW_SPEC_JSON>>>` + 输出契约 + 规则（只写文档事实、`> 待确认` 进 notes、type 白名单、enum 必须 options、ref 指向本模块实体、页面优先对齐「页面与交互需求」、每个 Epic 至少一个列表页、Story 尽量挂 `storyIds`、label 用中文业务名、不写表结构/接口）。
3. 解析容错：代码块/尾逗号/前后噪声；失败 → `502 原型生成结果无法解析，请重试`。
4. 归一化：实体名去空白/去重；字段 label 去空白/同名合并；type 白名单（`string|text|number|decimal|date|datetime|time|boolean|enum|ref`，其余→string+note）；enum 无 options→string+note；ref 悬空→string+note；`epicId` 不在活跃 Epic→null+note；`storyIds` 过滤活跃 Story；`entity` 名字匹配否则 null；`fields` 过滤为该实体字段 label；上限 entities 30/fields 40/pages 80/actions 8/options 20；字符串 ≤200/note ≤300；`id` 服务端 `PE-n`/`PP-n`；`pages` 为空 → 502 `模型没有产出可预览的页面，请重试`。
5. 字段 `name`：由 label 生成稳定 ASCII key（如 `f1…`/拼音不可用就 `field1`）+ 保持 label 原文；渲染器用 `label` 展示。
6. 落库：`writeSetting('app.<appId>.requirementsPrototype.<moduleId>', spec)`；`base` 用当前 doc。
7. 模型调用：`ensureAppAgents(appId)` → `opencode.ensureAgent(appDirOf(appId),'req')` → `resolveChatModel(appId,'requirements',dir)` → `generateText({directory,agent:'req',model,prompt,signal,timeoutMs:120000})`；返回的模型 id 若可得则写入 `spec.model`（取 `resolveChatModel` 结果字符串，取不到写 null）。
8. 并发锁：模块级 `Map<moduleId, AbortController>`；并发 → 409 `正在生成原型参考，请稍候`；finally 清理。
9. 失败/取消不写库（保留旧规格）；`signal.aborted` → 499。

### B2 接口（`src/requirements/routes.ts` + `src/apps/routes.ts`）

- **扩展** `GET /api/apps/:id/requirements-prototype?moduleId=`：响应增加 `spec`（null 或规格）与 `specState`（`status/staleReason/coverage`）；其余字段（`module/template/pageSets/stats/warnings`）保持不变。**只读**，不创建任何东西。
- **新增** `POST /api/apps/:id/requirements-prototype/spec?moduleId=`：
  - body 忽略（可接受 `{regenerate:true}`）。
  - 守卫：应用 404、模块 404、归档 409、无文档/文档为空 409、并发 409。
  - 实现用 `res.on('close')` abort（**禁止 `req.on('close')`**）。
  - 成功 `{ spec, specState }`；错误走 `requirementErrorHandler`。
- `apps/routes.ts`：把两条路由挂在同一 `requirementPrototypeRoutes`（GET `/`、POST `/spec`）。

### B3 后端测试（新 `src/requirements/prototype-spec.test.ts`，注册进 `package.json`）

至少 14 项：prompt 内容/截断/不读设计；解析容错与 502；归一化（type/enum/ref/epicId/storyIds/entity/fields/上限/id/label→name）；空页面 502；模型异常 502；取消 499；守卫（404/409×3）；**只写 `app_settings`、其余表与项目目录不变、失败不覆盖旧规格**；GET 三态（missing/ready/stale）+ coverage；HTTP GET/POST（含 stub generator 的真实 `res.on('close')` 回归）。

> 注：归一化与 HTTP 层用注入 `generator`（service 层参数），生产路由不暴露 generator。

---

## 4. 前端任务

### F1 spec → 渲染映射（新 `src/requirements/prototype-spec-helpers.js` + `.test.mjs`，注册进 `package.json`）

- `toSpecEntity(entity)`：`DesignField`-compatible `SpecEntity`（`status:'draft'`，`decimal→number`，`ref→ref`+`target` 实体 id；`enum` 带 `options`）。
- `toSpecPage(page)`：`SpecPage`（`entity=entityId`、`fields=字段 name 子集`、`actions`、`status:'draft'`）。
- `groupPagesByEpic(spec, pageSets)`：按 `pageSets` 顺序分组，未被任何 Epic 覆盖的页面进「其他页面」（key 稳定）。
- `ensurePageSelection(groups, prev)`：回退规则（组/页面丢失 → 首项）。
- `specMetaLabel(spec)`、`coverageLabel(specState?.coverage)`、`specStateLabel(stale)`、`emptyReason(spec, module)`。
- 6—10 项单测。

### F2 渲染与状态（改造 `RequirementsPrototypePreview.vue`；新 `RequirementsPrototypeViewer.vue` 可拆）

- 保留：大纲树入口、模板徽标、Epic/页面集 chips 外壳、只读/变更横幅、`open-doc`、响应式、`--proto-*` 与白纸、缩放。
- 新增：
  - `spec === null`：空态卡「还没有原型参考」+ 说明 + **生成原型参考**；显示 M7 的 Epic/Story 范围统计与「Story 覆盖 —」。
  - 生成中：占位 + 进度文案 + 取消（abort）；禁用重复点击；错误卡 + 重试。
  - 成功：`PrototypeRenderer` 渲染真实字段/示例数据；顶部 `模型 · 生成时间 · 基vN · N 实体 · M 字段 · K 页面 · Story 覆盖 x/y`；「重新生成」（`ElMessageBox.confirm` 二次确认）与「查看文档」。
  - `stale`：黄色横幅「需求已更新（vN→vM），建议重新生成」+ 按钮；旧规格可看。
  - 声明常驻：`AI 参考原型 · 仅用于需求评审，不进入设计阶段/交接包`。
  - 归档模块：生成按钮禁用 + 提示（后端 409 兜底）。
- 页面 chips = 当前 Epic 的 spec 页面；「其他页面」分组排在最后。
- 画布：`PrototypeRenderer` 以 `readonly`、`notes=[]`、`layout=undefined`、`rows=mockRows(entity,8)`、`pages=[]`、`moduleId='requirements-preview'`；无实体页面给「未绑定实体」空态。
- 删除 M7 的 `PrototypeSkeleton.vue` 与骨架渲染分支（grep 确认零引用后删除），清理对应样式；`prototype-helpers.js` 中不再使用的导出一并删除。

### F3 API（`src/requirements/api.ts`）

- 扩展 `RequirementsPrototypePreview` 类型（`spec`/`specState/coverage`）与 `getRequirementsPrototype` 返回值。
- 新增 `generateRequirementsPrototypeSpec(appId, moduleId?, signal?)`（POST）。
- 规格类型与后端 §3.1 一一对应。

### F4 现有 M7 交互保持

- 切模块 flush/只读语义、章节点击退出预览、隐藏 mode-tabs、`refreshKey` 自动重新 GET（不触发模型）、`返回文档`、空态跳 epics。

---

## 5. 验证

| 项 | 要求 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时目录） | 全绿；新增 14—18（基线 280） |
| `npm test --prefix frontend` | 全绿；新增 6—10（基线 163） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | OK |
| `smoke:requirements`、`smoke:modules`、`smoke:design`、`smoke:design-handoff`、`smoke:change-set` | 全过（临时目录） |
| Playwright（stub `generateText` 返回固定 spec；临时目录 + 独立端口） | 覆盖设计稿 §8 全部前端断言；0 console/page error、0 意外 API≥400、0 页面级横向溢出 |

Playwright 必测：
1. 空态 → 生成 → 真实字段出现在列表列/表单字段/详情分区（断言 3 个字段名）。
2. 重新生成二次确认（取消不发请求；确认后覆盖、统计更新）。
3. 过期：改文档后重回 → stale 横幅；重新生成后消失。
4. 失败：stub 抛错 → 502 错误卡 + 重试成功；旧规格未覆盖。
5. 归档模块按钮禁用（后端 409 提示）。
6. 网络：渲染期无写请求；一次生成仅 1 次 POST。
7. 1440/1280/1024/768 × 浅/深截图；无横向溢出；生成中禁用重复点击。

---

## 6. 边界与安全

- 唯一写入 = `app_settings` 预览规格键；断言其它表行数与 `projects/<app>/` 目录树不变。
- 不调真实模型（stub）；不触碰真实 3300/`data/`/`projects/`/`.env`；不打印凭据；不提交临时截图。
- 不新增表/列/迁移/依赖；不改 `frontend/src/design/*` 既有文件（只 import CSS 与 `PrototypeRenderer`/`mockRows`/类型）；不改设计阶段行为、交接包、Change Set、U7。
- 模型输出全部白名单/长度/引用校验后再渲染（渲染器无 `v-html`）。

---

## 7. 回传

按上表逐项给实际数字；附：改动文件、与设计稿偏差、未验证项、本单 §8 回填。

---

## 8. 实施结果（已回填 2026-11-17）

- **改动文件**
  - 后端新增 `backend/src/requirements/prototype-spec.ts`：输入聚合（模块 PRD 全章节，单章节 6KB / 总量 40KB 截断）、`buildPrototypeSpecPrompt`（`<<<PREVIEW_SPEC_JSON>>>`）、`parsePrototypeSpecOutput`（容错解析 + 归一化/白名单/引用过滤/上限/服务端 `PE-n`/`PP-n`/label→稳定 ASCII `name`）、`readStoredPrototypeSpec`、`specStateOf`、`coverageOf`、`buildPrototypeSpecView`、`generatePrototypeSpec`（模块级并发锁、`res.on('close')` 配套 signal、失败/取消不覆盖、唯一写 `app.<appId>.requirementsPrototype.<moduleId>`）；`setPrototypeSpecGeneratorForTests` 仅测试注入。
  - 后端 `backend/src/requirements/routes.ts`：`GET /requirements-prototype` 增量返回 `spec/specState`（M7 字段不变）；新增 `POST /requirements-prototype/spec`（`res.on('close')` abort、`requirementErrorHandler`）。
  - 后端新增 `backend/src/requirements/prototype-spec.test.ts`（15 项），注册进 `backend/package.json`。
  - 前端新增 `frontend/src/requirements/prototype-spec-helpers.js` + `.test.mjs`（10 项），注册进 `frontend/package.json`：`toSpecEntity`/`toSpecPage`/`groupPagesByEpic`（其他页面最后）/`ensureSpecSelection`/`specMetaLabel`/`coverageLabel`/`rangeLabel`/`specStateLabel`/`specEmptyReason`/`baseLabel`/`generatedAtLabel`/查找与标题兜底。
  - 前端 `frontend/src/requirements/api.ts`：`RequirementsPrototypeSpec`/`SpecEntity`/`SpecPage`/`SpecState`/`Coverage` 类型、`RequirementsPrototypePreview.spec/specState`、`generateRequirementsPrototypeSpec`（POST）。
  - 前端重写 `frontend/src/requirements/RequirementsPrototypePreview.vue`：空态（生成按钮 + M7 范围统计 + Story 覆盖 —）/生成中占位与取消/成功 `PrototypeRenderer` + `mockRows(...,8)` 真实字段/重新生成二次确认/stale 黄条/错误卡 + 重试/归档禁用 + 提示/模型·时间·基vN·统计·覆盖度/notes 折叠/常驻 AI 声明；外层 chips 仍按 Epic，页面 chips = 该 Epic 的 AI 页面，无 epicId 进「其他页面」；保留大纲入口/模板徽标/只读 hint/响应式/白纸缩放。
  - 删除 `frontend/src/requirements/PrototypeSkeleton.vue`（grep 零引用）；`prototype-helpers.js` 只保留 `PAGE_TYPE_LABELS`/`TEMPLATE_SOURCE_LABELS`/`typeLabel`/`templateSourceLabel`/`fitScale`/`warningText`（测试由 8 项精简为 3 项）；`RequirementOutlineTree.vue` 原型节点文案「AI」+ tooltip 改为 AI 参考原型；`RequirementsDocView.vue` 注释同步。
  - 未改 `frontend/src/design/` 既有文件（仅 import CSS/渲染器/mock/类型）；未改设计阶段/交接包/Change Set/U7/阶段门禁。
- **测试**：后端 **295/295 通过**（基线 280，新增 15）；前端 **165/165 通过**（新增 10 项 spec-helpers；prototype-helpers 8→3，净 +2）。
- **静态检查**：`npm run build --prefix backend`、`npm run typecheck --prefix frontend`、`npm run build --prefix frontend`、`npm run check:vue --prefix frontend` 全部通过。
- **冒烟**（各自临时目录/端口）：`smoke:requirements`、`smoke:modules`、`smoke:design`、`smoke:design-handoff`、`smoke:change-set` 全部通过。
- **Playwright**（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 端口 3442/4442 + `OPENCODE_AUTO_START=false` + harness 注入固定 spec；生产构建由后端同时托管）：**71/71 断言通过**，0 console/page error、0 意外 API≥400、0 页面级横向溢出；覆盖空态→生成→真实字段（列表/表单/详情/订单）、顶部模型/时间/基vN/统计/覆盖度、重新生成二次确认（取消不发请求）、stale（改文档 + 刷新）+ 重新生成消失、失败 502 错误卡 + 重试成功且旧规格保留、生成中按钮禁用/重复点击不发第二次 POST/取消保留旧规格、归档模块禁用 + 后端 409、仅 1 次 `POST .../spec`/渲染期无写请求、1440/1280/1024/768 × 浅/深、截图 9 张。目录：`C:\Users\icecream\AppData\Local\Temp\opencode\m72-e2e-2026-11-17T02-09-36\screens`。
- **偏差**
  1. 「无分隔符但为合法 JSON」按容错接受（与 module-generation/replan 一致）；只有不可解析才 502。
  2. 增加 `entities` 为空 → 502「模型没有产出可预览的实体，请重试」（设计稿 §2 约束 entities 1—30；页面为空仍 502）。
  3. 测试注入用 service `options.generator` 与模块级 `setPrototypeSpecGeneratorForTests`（生产路由不暴露）；HTTP 测试用后者。
  4. stale 横幅与「重新生成」共用二次确认（有旧规格时统一确认覆盖）。
  5. 顶部信息第二行展示模型（`providerID/id`）/生成时间/基vN/统计/覆盖度；notes 用折叠区展示。
  6. `ref` 目标按实体名称解析为 `PE-n`（模板未提供 target 字段时接受 `target/ref/entity` 作为实体名）。
- **未验证**：真实模型 E2E（主会话另跑临时应用）；`<768`；多实例并发锁；真实 3300/`data/`/`projects/`/`.env`（本批未触碰）。

