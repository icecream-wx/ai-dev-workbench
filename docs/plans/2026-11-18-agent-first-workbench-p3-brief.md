# Agent-First 工作台 P3「设计视图」实施交接单（2026-11-18）

> 上游：`docs/plans/2026-11-18-agent-first-workbench-design.md` v3（§3.2 设计文件、§4.2 design skill、§5 commands、§7 变化检测、§8 视图）。
> P1/P2 已完成并通过评审（后端 73/73、前端 32/32、`e2e:p2` 104 断言、真实模型生成+小文档编辑通过）。
> 本单只做 **设计视图**（替换占位页）+ P2 遗留的 skill should-fix；开发视图不动（P4）。
> 真实 3300 保持旧构建、不重建不重启；全部验证用临时目录 + 独立端口；不调真实模型（主会话另跑）。

---

## 0. 出口标准

1. 设计视图不再是占位页：**模块列表 + ER / 原型两个 Tab + AI 对话**（≥1280 三栏；1024/768 抽屉）。
2. `docs/design/<MOD>/design.json` 能渲染：实体/字段/关系、页面/列/动作；无设计时给「生成设计」空态。
3. ER 图复用 `ErGraph`（表卡片、关系、缩放、选中）；选中实体可看字段清单。
4. 原型复用 `PrototypeCanvas`（白纸、模板皮肤、mockRows），页面可切换、缩放 75/100/125、可导出 PNG。
5. 生成/修改走命令：`generate-design`（当前模块）+ `check-consistency`；命令按钮与空态按钮一致。
6. 校验错误可读：`designs[].errors` → 顶部错误条（文件 · 字段 · 期望）+「让 AI 修」（填入 Composer，不自动发送）。
7. `docs/` 变化 ≤1.5s 自动刷新（ER/原型/错误/计数）。
8. 跨模块引用（`MOD-002/order`）不崩：当前模块图只画本模块实体，外部引用给非阻塞警告；页面 entity 缺失时降级渲染并提示。
9. 需求视图「去设计」落到真实设计视图。
10. **P2 遗留 should-fix**：两个 skill 的"交付与汇报"增加"修改后回读文件，核对用户要求的具体取值/规则是否出现；没有就继续改"。
11. 测试：后端回归 73+、前端单测（adapter 等）、`e2e:p2` 回归 + 新增 `e2e:p3`、浅/深 × 1440/1024/768、0 console/page error、0 意外 API≥400。

## 1. 不做

- 开发视图（P4）、交接包/版本/确认/变更单/覆盖度/门禁。
- 设计产物在线编辑表单（实体/页面编辑器）：本版只渲染 + 对话改；手工编辑文件由用户/agent 自行完成。
- 应用级原型模板切换 UI（P1 没有该接口；本版只显示当前模板；切换留到后续）。
- 原型模板 CRUD UI（走 API；需求模板库已在 P2）。
- 跨模块聚合 ER（多模块一图）；`<768` 移动端。

## 2. 后端

**无新增接口**。沿用：
- `GET /api/apps/:id/artifacts`（designs 已含 entities/relations/pages/errors）
- `POST /api/apps/:id/development/prompt`（`view=design` + `module` + `command`，P2 已支持）
- 会话/事件/compact/权限/表单（`view=design`）
- `GET /api/apps/:id/templates`（拿 prototype.id/name）与 `GET /api/prototype-templates`（拿 tokens/shell）

仅需：`shared/template-api.ts` 的 `PrototypeTemplate` 接口补 `tokens/shell`（API 已返回），或新增 `getPrototypeTemplate(id)`；不改后端。

## 3. 设计 → 渲染契约 adapter（新 `frontend/src/design/design-adapter.js` + 单测）

输入：某个 `DesignArtifact`（`{module,title,entities,relations,pages,file,errors,warnings}`）+ 需求模块列表（取标题/跨模块提示）。
输出：

```ts
{
  module, title, file,
  entities: DesignEntity[],          // id/name/table/description/fields/relations(本模块内)
  relations: DesignRelation[],
  pageSet: DesignPageSet,            // id = `${module}-main`, title, pages(原样 DesignPage)
  pages: DesignPageRender[],         // title=name, pageSetId, entityId, spec, layout
  warnings: string[]                 // 未知实体、重复 id、跨模块引用、未知页面类型
}
```

规则：
- 字段类型按 `DesignFieldType` 原样；`ref` 目标保留字符串。
- `page.entity`：
  - 本模块实体 id → `entityId=id`；
  - `MOD-xxx/entity` → `entityId=null` + warning「引用其它模块实体，当前仅占位」；
  - 找不到 → `entityId=null` + warning。
- `spec.columns = page.columns`、`spec.actions = page.actions`、`layout.table.columns = page.columns`、`layout.toolbar.actions = page.actions`（其余由 `layout.ts` 推默认）。
- 页面类型未知 → 降级 `list` + warning。
- 重复实体/页面 id → 保留第一个 + warning。
- ER 只用本模块 `entities`（`relations` 挂在实体上，供 `er-layout` 使用）。

## 4. 视图布局（新 `workbench/DesignView.vue`）

```
┌ 工具栏：设计视图 · 模板徽标 · 实体/页面计数 · 错误数 · 刷新 ─────────────┐
├ 模块列表(240) ┬ Tab：ER 图 / 原型（flex） ───────────┬ AI 对话(380) ────┤
│ MOD-001 商品  │ ER：ErGraph + 选中实体字段面板        │ generate-design  │
│  · 有设计     │ 原型：页面 chips + PrototypeCanvas    │ check-consistency│
│ MOD-002 订单  │        + 缩放/导出 PNG                │ 时间线/权限/表单 │
└───────────────┴───────────────────────────────────────┴──────────────────┘
```

- 模块列表 = `artifacts.modules`（需求模块）；每项显示设计状态：`有设计 N 实体 / M 页面`、`未生成`、`错误 K`；无需求模块时给提示。
- 选中模块：有 design → 渲染；无 → 空态（说明 + 「生成设计」+ 2 个示例指令）。
- 工具栏「生成/更新设计」：发送 `generate-design`（参数=当前模块 key），生成中禁用。
- 错误条：`designs[].errors` + adapter warnings；「让 AI 修」填 Composer。
- 设计文件路径/更新时间/模板徽标展示。
- `AgentChatPanel` 增加 props/默认命令映射：`view=requirements` → `update-requirements` + `check-consistency`；`view=design` → `generate-design` + `check-consistency`；并暴露 `runCommand(name)` 供空态按钮调用。
- `AppShell.vue`：design → `DesignView`；`PlaceholderView` 若不再被引用则删除。

## 5. ER 渲染

- `ErGraph :entities="adapter.entities"` + `@select`；右侧/下方字段面板显示选中实体的字段（名称/类型/必填/唯一/枚举/ref）。
- 无实体 → 空态「还没有实体，先让 agent 生成设计」。
- 关系标签/基数字段沿用 `DesignRelation.type`（1:1 / 1:N / N:1 / N:M）。

## 6. 原型渲染

- 页面集：单页集 = 当前模块（`pageSet`）；页面 chips 按 `pages` 顺序。
- `PrototypeCanvas :page :pageSet :page-sets :entities :template :app-name :zoom`；模板取 `GET /apps/:id/templates` 的 prototype.id → `listPrototypeTemplates()` 匹配（tokens/shell 已补类型）；找不到 → 用第一个原型模板并 warning。
- 缩放 75/100/125；「导出 PNG」用 `captureElementPng(paperRef)` + `downloadDataUrl`，文件名 `<MOD>-<page-id>.png`；失败给错误提示。
- 深色下保持白纸（现有 `.proto-*` 语义不变）。
- 无页面 → 空态提示生成设计。

## 7. 生成 / 修改 / 错误

- 空态「生成设计」与工具栏按钮都走 `generate-design`（命令），`text` 传模块 key。
- 对话普通消息（非命令）也能改设计：`view=design` + 当前模块。
- 错误条与 P2 相同：`文件 · 字段 · 说明（期望）`；「让 AI 修」把摘要填 Composer，不自动发送。
- 生成中禁用生成/命令按钮；停止/compact/权限/表单沿用 P2 面板能力。

## 8. 响应式 / 主题

- ≥1280 三栏；1024 模块列表与对话抽屉（互斥 + Esc）；768 单栏 + 顶部抽屉按钮 + Tab 保持。
- ER 画布内部滚动；原型画布内部滚动；页面无横向溢出；深浅色 token。

## 9. 测试与验收

| 项 | 要求 |
| --- | --- |
| 前端单测 | `design-adapter.test.mjs`：基本映射、跨模块 ref、未知实体、重复 id、未知页面类型、无页面；页面集/标题；命令映射（若抽纯函数） |
| Playwright `e2e:p3` | 新增 harness 场景（可扩展现有 stub）：① 无设计空态→生成命令→stub 写 design.json→ER 出现实体/关系；② 切换原型页→列/动作渲染；③ 缩放/导出 PNG（断言下载或 dataURL 生成）；④ 非法 design.json→错误条+让 AI 修；⑤ 外部改文件→≤1.5s 刷新；⑥ 跨模块引用 warning；⑦ 1024/768 抽屉互斥；⑧ 浅/深 × 1440/1024/768 截图 |
| 回归 | `e2e:p2` 全过；后端 73/73、前端 32+、build/typecheck/check:vue、`smoke:workspace`、`smoke:assets`（改了 SKILL 文本必须重跑） |
| 真实模型 | 主会话另跑：需求生成 → 设计生成 → ER/原型渲染 → 指令修改后刷新 |

## 10. P2 遗留 should-fix（本单必做）

- `templates/agent/skills/adw-requirements-document/SKILL.md` 与 `adw-design-artifacts/SKILL.md` 的"交付与汇报"各加一条：
  **修改后回读目标文件，核对用户要求的具体取值/规则/字段是否已出现；没有就继续改，不要只回复"已完成"。**
- 不改 `name`/`description`；改完跑 `smoke:assets` 确认加载。

## 11. 交付与风险

- 完成后回填 `docs/STATUS.md` 与 P3 brief 的「实施结果」；主会话复核后再开 P4。
- 风险：
  1. `design.json` pages 是扁平列表，没有页面集概念 → 单页集按模块派生，不要假装有 Epic。
  2. 跨模块实体引用无法在当前 ErGraph 画 → 仅警告，不做聚合布局。
  3. 原型模板类型当前不含 tokens/shell → 补类型或用 `unknown` 断言，避免 `any` 扩散。
  4. 大设计（>20 实体）ER 高度过大 → 画布内部滚动 + 缩放。
  5. PNG 导出依赖 html2canvas 与白纸样式；深色主题下不要改 `.proto-paper` 背景。

---

## 实施结果（2026-11-18，P3）

### 改动 / 新增 / 删除文件

**前端新增**
- `frontend/src/design/design-adapter.js` + `design-adapter.test.mjs`：design.json → `DesignEntity[]` / `DesignRelation[]` / `DesignPageSet` / `DesignPageRender[]` + warnings；`designSummaryOf`、`pickPrototypeTemplate`。
- `frontend/src/dev/view-commands.js` + `view-commands.test.mjs`：按视图的默认命令与参数规则。
- `frontend/src/workbench/DesignView.vue`、`DesignErPanel.vue`、`DesignPrototypePanel.vue`。

**前端修改**
- `workbench/AgentChatPanel.vue`：按视图渲染命令按钮、暴露 `runCommand(name)`、新增 `busy-changed`（P2 行为/testid 不变）。
- `workbench/AppShell.vue`：design → `DesignView`。
- `shared/template-api.ts`：`PrototypeTemplate` 补可选 `tokens/shell`。
- `workbench/api.ts`：新增 `getAppTemplates` 客户端封装（无新后端接口）。
- `frontend/package.json`：测试清单 +2 文件。

**前端删除**
- `workbench/PlaceholderView.vue`（不再被引用）。

**资产**
- `templates/agent/skills/adw-requirements-document/SKILL.md`、`adw-design-artifacts/SKILL.md`：交付与汇报增加“修改后回读目标文件核对取值/规则”一条（name/description 未动）。

**测试脚本**
- `backend/scripts/p2-e2e-harness.ts`：参数化 `P2_APP_ID`/`P2_APP_NAME`、状态 `ready`、`generate-design` 落地 `design.json`（仍为测试专用 stub，不进生产路由）。
- `backend/scripts/p3-e2e.ts`（新增，`e2e:p3`）；`backend/package.json` 增加脚本。

**后端代码**：无改动。

### 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend`（临时目录） | **73 / 73** |
| `npm test --prefix frontend` | **46 / 46**（新增 adapter 10 + view-commands 4） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 通过 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run smoke:workspace --prefix backend` | 通过 |
| `npm run smoke:assets --prefix backend` | 通过（真实 opencode / 4719，不调模型；SKILL 文本修改后重跑） |
| `npm run e2e:p2 --prefix backend` | 通过：104 条断言（回归） |
| `npm run e2e:p3 --prefix backend` | **通过：63 条断言**；14/场景合并覆盖；浅/深 × 1440/1024/768；外部改 design.json ≤1.5s；PNG 导出触发下载；0 console/page error、0 意外 API≥400、0 横向溢出 |

### Playwright e2e:p3 覆盖

1. 无设计空态 → 「生成设计」→ 命令 `generate-design`（参数 MOD-001）→ stub 写 `design.json` → ER 出现 2 实体/1 关系（≤1.5s）。
2. ER 选中实体 → 字段面板（名称/类型/必填/唯一/枚举）。
3. 原型 Tab → 页面 chips → 表单页动作/列表页列与动作渲染。
4. 缩放 75/100/125（style 断言）；导出 PNG（下载文件名 `<MOD>-<page-id>.png`）。
5. 非法 design.json → 错误条（文件/原因）≤1.5s →「让 AI 修」填 Composer → 恢复后消失。
6. 跨模块实体引用、未知实体、未知页面类型 → 非阻塞 warning。
7. 外部 Node fs 修改 design.json → ER ≤1.5s 更新。
8. 需求视图「去设计」→ 真实设计视图。
9. 1024/768 抽屉互斥 + Esc；深浅色 × 三档截图（含浅/深原型截图与深色白纸断言）。

### 偏差

1. `e2e:p3` 复用扩展 P2 stub harness（`P2_APP_ID/P2_APP_NAME` + generate-design 写文件），端口 3423，未复制第二套后端。
2. PNG 导出以 Playwright `download` 事件断言（headless Chromium + html2canvas）。
3. ErGraph 的“关系在实体编辑里维护”提示在本视图隐藏（不做在线编辑）。
4. 单页集按模块派生（`<MOD>-main`），不做 Epic 分层。
5. 设计“更新时间”使用前端读取时间（artifacts 无 mtime；未新增接口）。
6. 原型模板按应用模板 id 匹配；缺 tokens/shell 回退第一个可用模板并 warning。
7. 错误条合并全部 designs.errors + 当前模块 adapter warnings，内显前 3 条（工具栏显示总数）。
8. 需求视图「去设计」仍为 hash 导航，未同步 `apps.status`（P2 遗留非阻塞观察保留）。

### 未验证项

- 真实模型 E2E（主会话另跑）：需求生成 → 设计生成 → ER/原型渲染 → 指令修改后刷新。
- 真实 opencode 事件形状下的设计对话流式/权限/表单。
- 真实 3300（旧构建，未重启）与 EOS 运行态。
- 非 headless 浏览器的 PNG 导出效果。

### 环境确认

- 未启停/未重启真实 3300；未读写真实 `data/`/`projects/`/`.env`；全部使用临时目录与 3423/3422/3416/3419/4719 端口。
- 未执行任何 git 操作；未调用真实模型（单测与 e2e 均为 stub）。
