# P10b 实施单：所有显式契约页面模板风格兜底 + PNG 文案同步（2026-11-20）

> 用户要求（2026-11-20）：**不支持配方也要尽量跟模板风格一致**，不要再默认灰阶线框；PNG 文案也要一致。
> 前置：P9（list/tree-list/page-form/dialog-form 模板渲染）、P10（detail/dashboard + 模板风格 PNG）。
> 本单：把 **main-sub / wizard / 未知显式配方** 也纳入模板风格渲染（通用兜底，不再默认线框）；同步应用 AGENTS/开发 prompt/skill 中“PNG 是线框草图”的旧表述。

---

## 0. 出口标准

1. **任何有显式契约的页面**（`recipe` 或 `catalogRef` 或 `blueprint`）都走模板风格渲染，不再默认线框：
   - `main-sub`：模板 `page-heading` + 表单分组 panel + 子表 panel（`pm-table`，多个子表用页签）；
   - `wizard`：模板 `page-heading` + `pm-steps` + 当前步骤表单分组 panel + 上一步/下一步/提交；
   - 未知/无映射配方：按 `page.type` 映射到 `list` / `page-form` / `detail` / `dashboard` 的模板通用页；仍无法判断时用模板 `detail` 空态（`page-heading` + `panel` + 提示），**不出现 `wf-*` 灰阶线框**。
   - 仅“无任何显式契约的旧设计”才默认线框；「线框」仍可手动切换。
2. PNG：所有显式契约页面走模板风格截图（含 main-sub/wizard/未知映射）；无契约旧设计/截图失败才用线框兜底。
3. 同步旧文案（“PNG 是线框草图” → “PNG 是模板风格截图；不支持配方/旧设计为线框”）：
   - `backend/src/apps/scaffold.ts`（应用 AGENTS）
   - `backend/src/chat/service.ts`（开发 prompt 3 处）
   - `backend/src/dev/service.ts`（首条提示）
   - `backend/src/dev/ui-check.ts`（骨架说明）
   - `backend/src/templates/distribution.ts`（设计模板 skill 文案）
   - `templates/agent/commands/check-design-fidelity.md`
   - `templates/afc-remote/README.md`
   - `templates/agent/skills/adw-frontend-implementation/SKILL.md`（如含旧表述）
   - 其他 grep 到的旧表述
   对应 e2e/单测若断言这些字符串，按新文案更新（不要削弱断言）。
4. 回归：`e2e:p10` 扩展后通过；`e2e:p9` 67、`p7-4b` 48、`p3` 126、`preview` 83、`p7-3b` 38、`p2/p4` 116/128；后端 133、前端 141+；`build:report`。

---

## 1. 支持判定与配方映射

文件：`frontend/src/design-preview/contract-preview.js`、`DesignPrototypePanel.vue`、`DesignView.vue`

- `TEMPLATE_RENDER_RECIPES` 增加 `main-sub`、`wizard`。
- `hasExplicitContract(page)` 改为：`recipe || catalogRef || blueprint` 任一存在。
- `supportsTemplateRender(page, templatePages)` 改为：`hasExplicitContract(page)` 即可（不再限制配方列表）。
- `resolveContractRecipe(page, templatePages)`：
  - 显式 `recipe` 属于支持集合 → 原样；
  - 显式 `recipe` 不支持/未知 → 按 `page.type` 映射：`form → page-form`、`list/tree-list → list`、`detail/workspace/permission/workflow → detail`、`dashboard → dashboard`、其他 → `detail`；
  - 无 recipe 有 catalogRef → 模板页 recipe（同前）；
  - 无 recipe 有 blueprint → 按 type 映射；
  - 最后兜底 `detail`。
  - 返回的配方必须在支持集合内（`detail` 兜底），保证 `ContractPage` 不会落到“未支持”。
- `supportsTemplateRender` 仍要求 `hasExplicitContract`（无契约旧设计保持线框，`e2e:p3` 126 不变）。
- `prototypeModeFor` 不变（支持→template，否则 wireframe）。
- `DesignPrototypePanel` 的 `supportsTemplateRender` 引用同步；提示文案改为“该页面无显式设计契约，默认线框；模板风格需要 recipe/catalogRef/blueprint”。

---

## 2. ContractPage：main-sub / wizard / 通用兜底

文件：`frontend/src/design-preview/ContractPage.vue`（可新增 `ContractSubTables.vue`、`ContractWizard.vue`）

### 2.1 main-sub

- 结构：`page-heading` + `panel.form-panel`（`ContractFormFields`，同 page-form）+ 子表 `panel`：
  - 子表来源：`buildDetailModel({ page, entity, row: rows[0], subTables: layout.subTables, entities })` 的 `subTables`（含 rows/columns），或新建 `buildSubTablesModel`；
  - 多个子表 → 模板页签样式（复用 detail 现有 `contract-subtabs`/`contract-subtab` 类）或 `pm-tabs`；单子表直接展示；
  - 子表表格 `pm-table`，`data-testid="contract-main-sub-subtables"`。
- 表单/子表布局：与 page-form 一致，保持模板 `panel`/`form-panel` 风格。
- 无实体：page-heading + panel 空态。

### 2.2 wizard

- 结构：`page-heading` + `pm-steps` + `panel`（当前步骤字段）+ 底部按钮。
  - 步骤：`buildForm(...).groups`；无分组 → 单步“基本信息”；步骤 label 用组标题，缺省“步骤 N”。
  - `pm-steps` 用法：`:options="steps.map((g,i)=>({ value:i, label: g.title || `步骤 ${i+1}` }))"` + `v-model="activeStep"`（数字索引）；`data-testid="contract-wizard-steps"`。
  - 当前步骤字段：复用 `ContractFormFields`，传入 `form = { ...form, groups: [groups[activeStep]] }`（或给组件加 `onlyGroup` prop）。
  - 底部：上一步（activeStep>0）/下一步/提交；`data-testid="contract-wizard-footer"`；按钮只做 notify。
- 无实体/无字段：page-heading + panel 空态 + steps 可选。

### 2.3 通用兜底

- `ContractPage` 的 `v-else` 不再显示“暂未支持模板风格渲染”作为主路径（防御保留但不应命中）；改为 **模板 detail 通用页**：
  - `page-heading` + `panel` + `info-grid`（实体字段/值）或空态；
  - 若 `page.type === 'list'` 且有 columns → 复用 list 结构；`form` → page-form；
  - 保证至少渲染 `page-heading` + `panel`，不出现 `wf-*`。
- 若 `resolveContractRecipe` 已映射到支持配方，则正常走对应分支；v-else 仅防御。

---

## 3. PNG 与测试

### 3.1 PNG

- `shouldTemplateCapture` 使用新的 `supportsTemplateRender` → main-sub/wizard/未知契约页都模板截图；无契约/失败才线框。
- `DesignPrototypePanel` 的提示文案、导出提示同步（“导出 PNG 使用模板风格截图；不支持配方/旧设计为线框”）。
- 不改变 PNG 写入接口/后端。

### 3.2 `e2e:p10` 扩展

- fixture 增加：
  - `main-sub` 页：`type=form`、`recipe=main-sub`、form.groups 2 组、`subTables` 2 个（employee/org），实体 product；
  - `wizard` 页：`type=form`、`recipe=wizard`、form.groups 3 组；
  - `unknown` 页：`type=list`、`recipe=detail`？不，用一个显式但未知的 `page.type='workspace'` + `blueprint`（无 recipe 或 recipe 不在支持集合）验证兜底到模板（detail/list），**断言不出现 `wf-page`**。
- 断言（新增 ≥12，总数约 66）：
  - main-sub：`contract-main-sub-subtables` 存在、子表页签/表格、pm-table；
  - wizard：`pm-steps`/`.el-steps`、步骤标题、当前组字段、footer 按钮；点击下一步后切换组；
  - unknown：`contract-page-*` 模板结构、`page-heading`/`panel` 存在、`wf-page` 不存在；
  - PNG manifest 页数更新（含新页）；至少对 wizard/main-sub PNG 做主色采样（同现有）；
  - 0 console/pageerror/请求失败/外部请求。
- `e2e:p9` 67、`p7-4b` 48、`p3` 126 保持；若 p9 因支持判定变化（其页面都有 recipe）不受影响。

### 3.3 文案测试

- `e2e:p4` 断言开发 prompt 的 `prototypes/*.png`/优先级：按新文案更新，不减少断言。
- 后端单测若断言 AGENTS/prompt 文案，按新文案更新。
- `smoke:workspace`/`smoke:assets` 若断言旧文案，更新。

---

## 4. 文档

- `docs/STATUS.md` 新增 P10b 节；把“main-sub/wizard 回退线框”改为“模板风格通用兜底；仅无契约旧设计/手动线框”。
- P7 设计稿新增「§30 P10b 全契约模板兜底 + PNG 文案」。
- `AGENTS.md`/`README.md`：支持配方描述改为“所有显式契约页面模板风格；unknown 按 type 映射；无契约旧设计/手动线框”；PNG 文案同步。
- `docs/report/*` 更新并 `build:report`。
- 本实施单末尾追加「实施结果（2026-11-20）」。

---

## 5. 边界

- 只改：`frontend/src/design-preview/**`、`frontend/src/workbench/**`、`frontend/src/design/**`（复用）、`backend/src/apps/scaffold.ts`、`backend/src/chat/service.ts`、`backend/src/dev/{service,ui-check}.ts`、`backend/src/templates/distribution.ts`、`templates/agent/commands/**`、`templates/agent/skills/adw-frontend-implementation/**`、`templates/afc-remote/README.md`、`backend/scripts/**`、`docs/**`、`README.md`、`AGENTS.md`。
- 不改：DB/表、PNG 写入 API、`templates/design-system/**`、需求模板中心、模板中心/`preview.html` 业务。
- 不新增依赖；不 npm install；不做 git；不启停真实 3300；不读写真实 `data/`/`projects/`/`.env`；不调真实模型；e2e 临时目录/端口（3447 或新 3448），结束清理。
- 真实 3300 前端静态托管即时生效；本单后端只改文案字符串/构建产物，**不自动重启**；如用户需要新后端文案，由用户自行构建重启。

---

## 6. 收尾与回报

- 结果 → 验证数字（后端/前端、p10 扩展后数字、p9/p7-4b/p3/preview/p7-3b/p2/p4、build:report）→ 偏差 → 未验证 → 环境确认。
- 明确写清：所有显式契约页面都模板风格（main-sub/wizard/unknown 走通用兜底）；仅无契约旧设计/手动/截图失败用线框；PNG 文案已同步。

---

## 实施结果（2026-11-20）

### 结果

- **所有有显式契约（`recipe` / `catalogRef` / `blueprint`）的页面**都走模板风格渲染与模板截图：list / tree-list / page-form / dialog-form / detail / dashboard / **main-sub** / **wizard**；未知/无映射配方按 `page.type` 映射到通用模板页（最后兜底 `detail`）。
- **只有无任何显式契约的旧设计才默认线框**（「线框」仍可手动切换）；无契约/截图失败才用线框兜底。
- 开发 prompt / 应用 AGENTS / 开发方法 skill / command / afc-remote README 的 PNG 文案统一为“模板风格截图（无显式契约的旧设计为线框）”。

### 关键实现

| 项 | 位置 |
| --- | --- |
| 支持判定/配方映射 | `frontend/src/design-preview/contract-preview.js`（`TEMPLATE_RENDER_RECIPES`、`hasExplicitContract`、`supportsTemplateRender`、`resolveContractRecipe`） |
| main-sub | `ContractPage.vue`：`page-heading` + `panel.form-panel` + 子表 `panel`/`pm-table`（多子表 `contract-subtabs` 页签） |
| wizard | `ContractPage.vue`：`page-heading` + `pm-steps` + 当前分组表单（`ContractFormFields#onlyGroup`）+ 上一步/下一步/提交 |
| 通用兜底 | `ContractPage.vue` 的 `v-else` → 模板 detail 通用页（`page-heading` + `panel` + `info-grid`/空态），不出现 `wf-*` |
| PNG | `design/template-capture.ts#shouldTemplateCapture` 跟随新判定；`DesignPrototypePanel` 提示/导出文案同步 |
| 文案 | `backend/src/{apps/scaffold,chat/service,dev/service,dev/ui-check,templates/distribution}.ts`、`templates/agent/skills/adw-frontend-implementation/{SKILL.md,scripts/lib/fidelity-core.cjs,scripts/check-fidelity.mjs}`、`templates/agent/commands/check-design-fidelity.md`、`templates/agent/skills/adw-design-artifacts/SKILL.md`、`templates/afc-remote/README.md` |
| e2e | `backend/scripts/template-png-e2e.ts`：+main-sub/wizard/未知类型（仅 blueprint）三页；`backend/scripts/design-preview-e2e.ts`：无契约提示断言按新文案 |

### 验证（实跑）

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **142 / 142** |
| `npm run typecheck / build / check:vue --prefix frontend` | 通过（build 2818 modules） |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **133 / 133** |
| `node node_modules/typescript/bin/tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm run e2e:p10 --prefix backend` | **78 条断言**；端口 3447 已关闭；overview 2880×1996、main-sub 2880×2002，data-cyan 主色像素 > 0 |
| `npm run e2e:p9 --prefix backend` | **67 条断言** |
| `npm run e2e:p7-4b --prefix backend` | **48 条断言** |
| `npm run e2e:p3 --prefix backend` | **126 条断言** |
| `npm run e2e:p2 / p4 --prefix backend` | **116 / 128 条断言** |
| `npm run e2e:preview / p7-3b --prefix backend` | **83 / 38 条断言** |
| `npm run smoke:workspace / smoke:assets --prefix backend` | 均通过（临时目录；真实 opencode 2.2.5，不调模型） |
| `npm run build:report --prefix backend` | 通过：HTML **722.1 KB**（739,418B）、PDF **1,123.6 KB**（1,150,579B，约 15 页）、flow PNG 567,720B；离线 / 0 console error / 三档无横向溢出 |

### 偏差

1. `e2e:p10` 实际 **78 条**（原 54 + 24），高于实施单“约 66”：main-sub 7、wizard 9、未知/仅蓝图 5、manifest 2 处取值更新、main-sub PNG 3；未削减任何原有断言。
2. 未知显式 `recipe` 在 `design-adapter.js` 会先被丢弃（soft warning、保留 `blueprint`），预览侧实际走“仅蓝图 → 按 `page.type` 映射”；未知 recipe 的 `resolveContractRecipe` 映射由单测覆盖。
3. `pm-steps` 点击步条不发 `update:modelValue`，wizard 用底部上一步/下一步切换（与模板组件的现状一致）；点击步条不作为验收项。
4. `ContractPage` 的 `v-else` 已改为模板 detail 通用页，不会再出现“该配方暂未支持模板风格渲染”。

### 未验证

- 真实 AFCenter 宿主/EOS 运行态的 `pm-steps`/`pm-table` 表现；真实 3300 上 main-sub/wizard 的人工视觉验收。
- 真实模型按 main-sub/wizard 契约写页面后的渲染效果；PNG 像素级模板比对（仍只有宽高 + 主色采样）；长表/超大页面截图稳定性。

### 环境确认

- 未启停真实 3300/4771；未读写真实 `data/`/`projects/`/`.env`；未调用真实模型；未新增依赖/未 npm install；未做 git；未改 DB/表、PNG 写入 API、`templates/design-system/**`、需求模板中心、模板中心/`preview.html` 业务。
- e2e 全部使用临时根目录 + 独立端口（3447/3446/3444/3423/3425/3422 等），结束后端口已关闭、临时目录已清理。
- `frontend/dist` 已重建为 P10b，真实 3300 静态托管刷新即生效；`backend/dist` 为旧构建，后端文案/`/design-preview.html` 显式 404 路由需用户自行 `npm run build --prefix backend` + 重启后生效。

