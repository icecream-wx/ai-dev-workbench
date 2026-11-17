# M7（#8）需求阶段原型预览 实施交接单

日期：2026-11-17
状态：**待用户确认后派实施会话**（本单不改代码）
设计稿：`docs/plans/2026-11-17-m7-requirements-prototype-preview-design.md`（§0 决策、§2 派生规则、§3 API、§4 UI、§6 测试）
上游：#6 `2026-11-13-module-requirements-design.md` §6.4（含 2026-11-17 调整注）、#7 `2026-11-13-app-templates-brief.md` §1.5

---

## 1. 范围

**只做 M7**：

- 需求阶段新增**按模块**的只读「原型预览」：Epic → 页面集、Story → 页面，确定性派生。
- 后端一个只读端点 + 前端大纲树节点 + 骨架线框面板。

**不做**（越界即退回）：

- 不改设计阶段（`DesignStudio`/`EntityDesignTab`/`PrototypeTab`/`D-RMP` 生成链路）、交接包、Change Set、U7、阶段门禁。
- 不写任何表/列；不新增迁移；不建设计项目/实体/页面集/页面/版本；不产 PNG/文件；不调模型/SSE。
- 不做页面/字段编辑、导出、批注、移动端手机壳、全模块聚合视图。
- 不做旧应用数据兼容（2026-11-13 政策）。
- 不启停/触碰真实 3300、真实 `data/`、`projects/`、`.env`。

---

## 2. 前置状态（开工前核对）

| 项 | 值 |
| --- | --- |
| 后端测试基线 | 268/268 |
| 前端测试基线 | 155/155 |
| 静态检查 | `typecheck` / `build` / `check:vue` 通过 |
| 真实实例 | 3300 正在运行（最新构建）；**本批不动** |
| 验证环境 | 临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` + 独立端口（如 3440）+ `OPENCODE_AUTO_START=false` |

---

## 3. 后端任务

### B1 只读读取（`src/requirements/doc.ts`）

新增只读导出，**不得**调用 `ensureRequirementDoc`：

```ts
export interface RequirementDocReadOnly {
  doc: RequirementDoc | null
  sections: RequirementDocSection[]
}
/** 只读：文档不存在返回 { doc: null, sections: [] }，不建文档/不产版本 */
export function readRequirementDocIfExists(appId: string, moduleId: string): RequirementDocReadOnly
```

- 复用私有 `docRowOf`/`readSections`/`rowToDoc`；`rowToDoc` 需要 `module_key`，从 `app_modules` 读（只读）。
- 加注释说明"供 #8 预览使用，禁止写操作"。

### B2 派生模块（新文件 `src/requirements/prototype-preview.ts`）

导出类型与函数：

```ts
export type PrototypePreviewPageType = 'list'|'form'|'detail'|'dashboard'|'kanban'|'calendar'|'gantt'|'custom'
export interface PrototypePreviewPage { key: string; storyId: string; title: string; type: PrototypePreviewPageType; priority: string; summary: string }
export interface PrototypePreviewPageSet { key: string; epicId: string | null; title: string; goal: string; priority: string; pages: PrototypePreviewPage[] }
export interface PrototypePreviewWarning { code: 'no-module'|'no-epics'|'epic-without-story'|'story-without-title'|'unassigned-stories'; message: string; epicId?: string; storyId?: string }
export interface RequirementPrototypePreview { appId; generatedAt; module: {...}|null; template: {...}|null; pageSets: PrototypePreviewPageSet[]; stats; warnings: PrototypePreviewWarning[] }

export function inferPreviewPageType(title: string): PrototypePreviewPageType
export function buildRequirementPrototypePreview(appId: string, moduleId?: string): RequirementPrototypePreview
```

实现要点（严格按设计稿 §2）：

1. 模块解析：显式 `moduleId` → `moduleOrThrow`（未知 404、归档允许只读）；缺省 → `defaultModule`（**不懒创建**）；无模块 → `module: null` + `no-module` + 空 `pageSets`。
2. 文档：`readRequirementDocIfExists`；无文档 → `hasDoc:false` + `no-epics`。
3. 结构化数据：取 `section.sectionKey === 'epics'` 的 `data`；`epics`/`stories` 缺省视为空数组；过滤 `archived`。
4. 页面集/页面 key 用 `pv:<moduleKey>:<epicId|storyId|unassigned>`；**不写库、不占 ID**。
5. 未归属 Story（`epicId` 为空 / 指向不存在或已归档 Epic）→ 虚拟页面集 `epicId:null`，置于真实页面集之后。
6. 类型推断只看 `story.title`，按设计稿 §2.3 表顺序首个命中；空标题 → `list` + `story-without-title`。
7. 模板：`appPrototypeTemplate(appId, moduleId)`（只读）；`template` 只返回渲染所需字段（`tokens/shell/patterns/pageSetRules` + `source`），**不含 `prompt`**。
8. `stats`：`epics`（不含归档）、`stories`（不含归档）、`pages`（= stories）、`unmappedStories`。
9. `summary`：Story `description` 去换行后截断 160 字。

### B3 路由（`src/requirements/routes.ts` + `src/apps/routes.ts`）

- 新 `requirementPrototypeRoutes = Router({ mergeParams: true })`，挂 `GET '/'` → `res.json(buildRequirementPrototypePreview(appId, moduleIdOf(req)))`。
- 复用 `requireApp` 守卫与 `route()` 包装；错误走现有 `requirementErrorHandler`。
- `apps/routes.ts` 挂载：`apps.use('/:id/requirements-prototype', requirementPrototypeRoutes)`（放在 `requirements-doc` 附近）。
- 协议：`GET /api/apps/:id/requirements-prototype?moduleId=`；无 SSE；`Cache-Control: no-store` 可选。

### B4 后端测试（新文件 `src/requirements/prototype-preview.test.ts`，并注册到 `package.json` 的 `test` 脚本）

覆盖设计稿 §6 后端 1—11 项，最低要求：

1. 2 Epic / 5 Story → 2 页面集、5 页面、顺序与文档一致。
2. 归档 Epic/Story 不出现；仅归档后被清空的 Epic 保留 + `epic-without-story`。
3. 类型推断 8 类 + 并列优先级（`查询商品详情`→detail、`统计报表`→dashboard）+ 空标题兜底。
4. Story `epicId=null` / 指向已归档 Epic → 未归属页面集 + `unassigned-stories`。
5. 无文档模块 → `pageSets: []` + `no-epics` + `hasDoc:false`，**断言 `app_requirement_docs` 与 sections 行数不变**。
6. 0 模块应用 → `module:null` + `no-module`，**断言 `app_modules` 行数不变**（未被懒创建）。
7. 未知 moduleId → 404；归档模块 → 200。
8. 模板来源三档（`design-project`/`app-default`/`global-default`）+ 删除模板回退不 500。
9. 只读断言：请求前后 `app_modules`、`app_requirement_docs`、`app_requirement_doc_sections`、`app_requirement_doc_versions`、`app_design_projects`、`app_entities`、`app_page_sets`、`app_pages`、`app_design_versions`、`handoffs` 行数不变；`projects/<app>/prototypes/` 不存在或未新增。
10. HTTP 层：真实 Express 挂载（参照 `module-ui-support.test.ts` 的 request 辅助），200 结构断言 + 404。

---

## 4. 前端任务

### F1 helpers（`src/requirements/prototype-helpers.js` + `.test.mjs`）

- `pageSetsOf(preview)`、`pagesOf(pageSet)`、`typeLabel(type)`、`ensureSelection(preview, prev)`（选中不存在时回退首项）、`emptyReason(preview)`、`fitScale(containerWidth, contentWidth)`、`warningText(w)`。
- 5—8 项单测（含选中回退、缩放边界 0/负值、空态判断）。

### F2 骨架组件（`src/requirements/PrototypeSkeleton.vue`）

- props：`type`、`template`（取 `patterns`/`pageSetRules`）。
- 只画骨架块（灰条/占位），**不出现真实字段名**；底部固定提示 `粗略预览 · 字段与交互在设计阶段按实体生成`。
- `list`/`form`/`detail`/`dashboard`/`kanban`/`calendar`/`gantt`/`custom` 八种形态；`form` 按 `patterns.form.labelPosition`，`list` 按 `pageSetRules.defaultSearchFields/defaultPageSize`。
- 类名加前缀（如 `.pv-sk-*`），避免与 `.wf-*` 冲突。

### F3 预览面板（`src/requirements/RequirementsPrototypePreview.vue`）

- props：`appId`、`moduleId`、`moduleTitle`、`refreshKey`（字符串/数字）、`docReadonlyHint?`。
- emits：`open-doc`（切回章节编辑并定位 epics）、`refresh`。
- 结构按设计稿 §4.2：头部（模块 + 徽标 + 模板来源 + `vN` + 统计 + 刷新 + 查看文档）→ 说明条 → 页面集 chips → 页面 chips → `.proto-skin` 画布（侧栏 = 页面集，白纸 = 骨架）。
- 状态：loading / error（重试）/ 空态（`no-epics` + 去补充需求）/ 正常；warning chips。
- 模板 CSS 变量：与 `PrototypeCanvas.vue` 相同的 `--proto-*` 写法；导入 `../../design/design-skin.css` 与 `../../design/prototype/wireframe.css`（只引用，不改这两个文件）。
- ResizeObserver 计算 `fitScale`（上限 1，最小 0.5），画布内部滚动。
- 请求：`watch([moduleId, refreshKey])` + AbortController；卸载 abort；切模块清空选中。
- token 化 + 深浅色 + 1024/768 纵向堆叠。

### F4 接线

- `RequirementOutlineTree.vue`：模块展开区在模板章节之后加「原型预览」节点（`data-testid="outline-prototype-<moduleId>"`，含 `aria-current`），新增 emit `prototype(moduleId)`；新增 prop `prototypeModuleId?: string | null`。
- `RequirementsDocView.vue`：
  - 新增 `view = ref<'doc'|'prototype'>('doc')`；
  - `onOutlinePrototype(moduleId)`：沿用现有切模块（含 flush/只读守卫）→ `view='prototype'`；切模块失败则保持原状；
  - 章节点击/切模块到文档时 `view='doc'`；
  - `view==='prototype'` 时隐藏 mode-tabs 与 `模板中心/版本/导出 .md`，显示 chip「原型预览」+「返回文档」；`AI 规划模块` 在预览下隐藏；`确认本模块/完成需求阶段` 保留；
  - `refreshKey` = `${doc.updatedAt}|${doc.version}|${maxSectionUpdatedAt}`；
  - 渲染 `<RequirementsPrototypePreview>` 占满 `.doc-scroll`（大纲树保留，作为模块入口）。

### F5 API（`src/requirements/api.ts`）

- `getRequirementsPrototype(appId, moduleId?)`：GET 上述端点，带 `signal`。
- 类型：`RequirementsPrototypePreview`（与后端字段一一对应，`type` 用字符串联合）。

### F6 前端单测

- `prototype-helpers.test.mjs` 注册进 `frontend/package.json` 的 `test` 脚本。

---

## 5. 验证（实施会话必须逐条回传实际数字）

| 项 | 要求 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | 全绿；新增预计 12—16 项（基线 268） |
| `npm test --prefix frontend` | 全绿；新增 5—8 项（基线 155） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | OK |
| `smoke:requirements`、`smoke:modules`、`smoke:design`、`smoke:design-handoff`、`smoke:change-set` | 全过（临时数据目录） |
| Playwright（临时数据目录 + 独立端口 + stub 模型） | 覆盖设计稿 §6 前端全部断言；0 console error / 0 pageerror / 0 意外 API≥400 / 0 页面级横向溢出 |

Playwright 必测（对应设计稿 §6）：

1. 大纲树每模块有「原型预览」节点；点击 → 模块切换 + 节点高亮 + 文档 mode-tabs 隐藏。
2. 2 模块页面集/页面数/标题与 Story 一致；类型标签正确。
3. 骨架随页面类型变化；抽查断言**不含**真实字段名；含"粗略预览"提示。
4. 模板：应用默认（简洁后台）/ 设计项目覆盖 / 全局默认三档徽标；删除模板回退。
5. 空态 + 「去补充需求」定位 epics。
6. Story 标题保存后预览自动刷新；手动刷新可用。
7. 只读网络断言：预览期间无非 GET 请求。
8. 1440/1280/1024/768 × 浅/深 截图；无横向溢出。

---

## 6. 边界与安全

- 只读端点：**任何情况下不写库、不建目录、不产文件**；测试必须含行数对比断言。
- 不调用 `ensureRequirementDoc` / `resolveModule`（会写库）；用 `readRequirementDocIfExists` / `moduleOrThrow` / `defaultModule`。
- 不触碰真实 3300、真实 `data/`、`projects/`、`.env`；不打印/提交凭据；不提交临时截图。
- 不改 `frontend/src/design/*` 的任何既有文件（只 import 其 CSS）；不改设计阶段行为。
- 不新增依赖、不新增表/列。

---

## 7. 回传格式

1. 改动文件清单（新增/修改）。
2. 后端/前端测试数与新增用例数；`typecheck`/`build`/`check:vue` 结果。
3. 冒烟与 Playwright 实际断言数、截图目录（仓库外）。
4. 与设计稿/本单的偏差（逐条说明原因）。
5. 未验证项（如 <768、真实模型）。
6. 本单 §8 回填。

---

## 8. 实施结果（2026-11-17 实施会话已回填）

- 改动文件：
  - 后端新增 `src/requirements/prototype-preview.ts`、`src/requirements/prototype-preview.test.ts`；修改 `src/requirements/doc.ts`（`readRequirementDocIfExists` + `moduleById` 引入）、`src/requirements/routes.ts`（`requirementPrototypeRoutes` + 头注释）、`src/apps/routes.ts`（挂载 `/:id/requirements-prototype`）、`package.json`（注册新测试）。
  - 前端新增 `src/requirements/prototype-helpers.js`、`prototype-helpers.test.mjs`、`PrototypeSkeleton.vue`、`RequirementsPrototypePreview.vue`；修改 `src/requirements/api.ts`（类型 + `getRequirementsPrototype`）、`RequirementOutlineTree.vue`（节点/prop/emit/样式）、`RequirementsDocView.vue`（`view`/refreshKey/接线/滚动高亮守卫/样式）、`package.json`（注册新测试）。
  - 未新增表/列/迁移/依赖；未改 `frontend/src/design/` 既有文件；未改设计阶段、交接包、Change Set、U7、阶段门禁。
- 测试：后端 **280/280**（基线 268，新增 12：`prototype-preview.test.ts`）；前端 **163/163**（基线 155，新增 8：`prototype-helpers.test.mjs`）。
- 静态检查：`npm run build --prefix backend` ✅（重新生成 `backend/dist`，未重启真实 3300）；`npm run typecheck --prefix frontend` ✅；`npm run build --prefix frontend` ✅；`npm run check:vue --prefix frontend` ✅。
- 冒烟（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`）：`smoke:requirements` ✅、`smoke:modules` ✅、`smoke:design` ✅、`smoke:design-handoff` ✅、`smoke:change-set` ✅。
- Playwright：临时数据目录 + 端口 3440/4440 + `OPENCODE_AUTO_START=false` + stub `opencode.generateText`（直接抛错，证明不调模型）；**70/70 断言**，8 张截图（1440/1280/1024/768 × 浅/深），0 console error / 0 pageerror / 0 意外 API≥400 / 0 页面级横向溢出。脚本 `C:\Users\icecream\AppData\Local\Temp\opencode\m7-pw\`（`harness.mts`/`run.mjs`/`summary.json`），截图 `C:\Users\icecream\AppData\Local\Temp\m7-pw-2026-11-17T01-27-37\screens\`。
- 偏差：
  1. `readRequirementDocIfExists` 用 `moduleById`（只读）取 `module_key`，不走 `ensureRequirementDoc`/`resolveModule`。
  2. `summary` 截断 160 字后加 `…`（≤161 字符），只作 chip tooltip。
  3. 空标题 Story 保留 `title=''`（`story-without-title` warning），前端展示「未命名 Story」，类型兜底 list。
  4. `ensureSelection`：页面集不存在→第一项；原页面在新集合则保留；页面集无页面→`pageKey=''`（画布提示“该页面集还没有 Story”）。
  5. 手动刷新由父组件 `prototypeNonce` 并入 `refreshKey`（不重复请求），刷新前 best-effort flush。
  6. 预览隐藏新手引导；只读/变更范围横幅按设计保留在面板上方；≥1024 左侧对话栏不隐藏（设计只要求保留大纲）。
  7. `backend/dist` 已重建，但真实 3300 进程未重启（新端点重启后生效）。
  8. `custom` 类型不会被关键词推断命中（设计稿 §2.3 无该关键词），骨架组件仍支持。
- 未验证：<768 移动端；归档模块节点/只读横幅下预览的 Playwright 专项（后端归档可读 200 有单测，节点与文档共用渲染逻辑）；真实模型/SSE（本批确定性与只读）；真实 3300/data/projects 未触碰、未重启。
