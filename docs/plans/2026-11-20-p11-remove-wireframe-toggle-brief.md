# P11 实施单：设计视图移除「线框」切换（只保留设计产物）（2026-11-20）

> 用户决策（2026-11-20）：按方案 A。设计视图里不再让用户在线框/模板之间选；**只有“设计产物”（模板风格）**。旧灰阶线框只作为内部兜底/调试（`?prototype=wireframe`），不在 UI 暴露；无显式契约的旧设计自动显示“结构草图（无契约）”并说明，不提供切换。
> 前置：P9/P10/P10b（模板风格渲染 + 模板风格 PNG + 全契约兜底）。

---

## 0. 出口标准

1. 设计视图「原型」Tab：
   - **契约页面**（recipe/catalogRef/blueprint 任一）：只显示模板风格设计产物（`design-preview.html` iframe）；**不显示「模板风格/线框」切换按钮**。
   - **无显式契约的旧设计**：自动显示 P7-4b 线框（`PrototypeCanvas`），顶部/提示明确“该页面无显式设计契约，显示结构草图；补齐 recipe/catalogRef/blueprint 后自动套模板”；**不显示切换按钮**。
   - 调试入口：仅当 URL 带 `?prototype=wireframe`（query，hash 前）时，强制线框并显示“调试：结构草图”小标识；正常用户界面不出现。
   - 「导出 PNG」保持整包模板风格导出（无契约/截图失败为线框），不因模式变化。
2. 回归：`e2e:p3` 126（无契约自动线框，仍 `prototype-paper`）、`e2e:p9`/`p10` 去掉模式切换断言后通过、`e2e:p7-4b` 48（改用 `?prototype=wireframe` 进入后断言）、`preview` 83、`p7-3b` 38、`p2/p4` 116/128、后端 133、前端 142+。
3. 文档/AGENTS/README 说明“设计视图只有设计产物；结构草图仅无契约/调试”，删除“模板风格/线框切换”的用户可操作描述。

---

## 1. 前端改动

### 1.1 `DesignPrototypePanel.vue`

- 删除头部模式按钮（`prototype-mode-preview` / `prototype-mode-wireframe`）与 `setMode`；不再暴露任何“线框/模板”选择。
- 内部 `mode` 改为 computed：
  - `debugWireframe = new URLSearchParams(window.location.search).get('prototype') === 'wireframe'`；
  - `mode = debugWireframe ? 'wireframe' : (previewable ? 'template' : 'wireframe')`。
- `previewable` 条件保持：显式契约 + 支持配方 + `appId/applicationType/styleId` 存在。
- 头部显示只读状态：
  - 模板：`设计产物 · 模板风格`（`data-testid="prototype-render-mode"` 文本）；
  - 无契约：`结构草图（无契约）`；
  - 调试：`调试 · 结构草图`。
- 提示文案：
  - 模板：`当前为设计产物（按所选模板渲染，类型 · 风格）；导出 PNG 使用模板风格截图。`
  - 无契约：`该页面没有显式设计契约（recipe/catalogRef/blueprint），显示结构草图；补齐契约后自动套模板。`
- 缩放组只在 wireframe（无契约/调试）显示；模板模式不显示缩放（与 P10 一致）。
- 「导出 PNG」保留：模板/线框都可用，整包导出（模板优先、无契约/失败线框）；文案“导出 PNG（模板风格；无契约/失败为线框）”。
- 删除/清理 P8/P9 遗留的 `mode` 按钮相关 CSS（可保留未用类但优先清理）。

### 1.2 `DesignView.vue`

- 不新增 UI；确认传给 Panel 的 `appId/applicationType/styleId/designHash/designLabel` 仍完整。
- 自动导出/手动导出逻辑不变（模板截图优先、线框兜底）。

### 1.3 无契约页面的线框

- `supportsTemplateRender` 保持“有显式契约”判定；无契约页面自动线框（不提供切换）。
- 线框渲染器（`PrototypeCanvas`）与 PNG 线框兜底保留；不做用户可见入口。

---

## 2. e2e 调整

### 2.1 `e2e:p7-4b`（线框渲染器验收）

- 入口改为 `http://127.0.0.1:<port>/?prototype=wireframe#/apps/<app>/design`（或 goto 后设置 query 再进入），确保强制线框。
- 删除点击 `prototype-mode-wireframe` 的步骤；断言数保持 48（模式按钮相关断言改为“无按钮 + 调试标识/`wf-page`”）。
- 切页后仍由 `?prototype=wireframe` 保持线框，无需重复点击。

### 2.2 `e2e:p9` / `e2e:p10`

- 删除模式切换按钮相关断言/点击（`prototype-mode-preview/wireframe`）；改为：
  - 断言 `[data-testid=prototype-render-mode]` 文本为“设计产物 · 模板风格”；
  - 断言 iframe 存在、`wf-page` 不存在；
  - 断言页面内无 `prototype-mode-*` 按钮（`count()===0`）。
- p10 的 PNG 导出/主色采样/模板结构断言保持；删除“切线框/切回”段落，断言数相应减少并如实更新。
- `e2e:p3`：无契约页自动线框，仍 `prototype-paper`；断言 126 不变；确认没有模式按钮断言。

### 2.3 新增/调整无契约提示

- p9 或 p10 fixture 增加一个无契约页（或复用 p9 的 local-page）：
  - 断言自动线框 + `prototype-render-mode` 文本“结构草图（无契约）” + 无模式按钮；
  - 契约页无 `wf-page`。
- 若 p9 已有无契约页断言，按新文案更新。

---

## 3. 文档

- `docs/STATUS.md` 新增 P11 节；删除“模板风格/线框切换”的用户操作描述；写明只有无契约/调试才线框。
- `AGENTS.md`/`README.md`/P7 设计稿 §31：
  - 设计视图原型 = **只有设计产物（模板风格）**；
  - 无契约旧设计自动“结构草图（无契约）”，不提供切换；
  - 调试 `?prototype=wireframe` 仅内部/测试；
  - PNG 仍整包模板风格（无契约/失败线框）。
- `docs/report/*` 更新并 `build:report`。
- 本实施单末尾追加「实施结果（2026-11-20）」。

---

## 4. 边界

- 只改：`frontend/src/workbench/DesignPrototypePanel.vue`（及必要的 DesignView/样式）、`backend/scripts/{renderer-e2e,design-preview-e2e,template-png-e2e}.ts`、`docs/**`、`README.md`、`AGENTS.md`。
- 不改：模板渲染器/线框渲染器行为、PNG 导出服务、后端 src/DB/API、`templates/**`、需求模板中心、模板中心/`preview.html` 业务。
- 不新增依赖；不 npm install；不做 git；不启停真实 3300；不读写真实 `data/`/`projects/`/`.env`；不调真实模型；e2e 临时目录/端口，结束清理。
- 前端静态托管即时生效，刷新即可见；不自动重启。

---

## 5. 收尾与回报

- 结果 → 验证数字（p3 126、p7-4b 48、p9/p10 新数字、preview 83、p7-3b 38、p2/p4 116/128、后端 133、前端 142+、build:report）→ 偏差 → 未验证 → 环境确认。
- 明确写清：设计视图不再有可点线框；无契约/调试才线框；PNG 模板风格。

---

## 实施结果（2026-11-20）

**结果**：方案 A 已落地。设计视图「原型」Tab 不再有「模板风格/线框」按钮；契约页只显示 `design-preview` iframe（只读状态「设计产物 · 模板风格」）；无显式契约页自动结构草图 + 文案「该页面没有显式设计契约（recipe/catalogRef/blueprint），显示结构草图；补齐契约后自动套模板。」+ 只读状态「结构草图（无契约）」；调试入口仅 `?prototype=wireframe`（只读状态「调试 · 结构草图」）。缩放组仅结构草图显示；PNG 仍整包模板风格（无契约/失败线框）。

**改动文件**：
- `frontend/src/workbench/DesignPrototypePanel.vue`：删除模式按钮/`setMode`/模式按钮 CSS；`mode` 改 computed；新增 `debugWireframe`、`renderModeLabel`（`prototype-render-mode`）；提示与导出 title 更新；缩放组仅 wireframe。
- `frontend/src/workbench/DesignView.vue`：未改（传参完整：`app-id/module-key/application-type/style-id/design-hash/design-label/template-pages`）。
- `backend/scripts/renderer-e2e.ts`：`?prototype=wireframe` 入口；删除 3 处点击模式按钮；1.1/1.2 合并“无模式按钮/调试标识”断言（仍 48）。
- `backend/scripts/design-preview-e2e.ts`：删除切线框段；新增只读状态/无按钮/无 `wf-page`/无契约自动结构草图/缩放仅结构草图/模板模式无缩放断言（70）。
- `backend/scripts/template-png-e2e.ts`：删除切线框段；同一类断言替换（79）。
- 文档：`docs/STATUS.md`（P11 节）、`AGENTS.md`、`README.md`、`docs/plans/2026-11-19-design-template-and-dev-linkage-p7-design.md`（§31）、`docs/report/*` + `build:report`。

**验证数字（实跑）**：

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm test --prefix frontend` | **142 / 142** |
| `npm run build --prefix frontend` | 通过（2818 modules） |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm test --prefix backend`（临时目录） | **133 / 133** |
| `npm run e2e:p7-4b` | **48** |
| `npm run e2e:p9` | **70** |
| `npm run e2e:p10` | **79** |
| `npm run e2e:p3` | **126** |
| `npm run e2e:preview / p7-3b` | **83 / 38** |
| `npm run e2e:p2 / p4` | **116 / 128** |
| `npm run build:report --prefix backend` | 通过：HTML 739,859B / PDF 1,154,252B（约 15 页）/ flow PNG 567,720B |

**偏差**：p9 67→70、p10 78→79（删切换段、加只读状态/无按钮/无 `wf-page`/无契约标识）；p7-4b 保持 48（新增覆盖并入原有断言）。`renderModeLabel` 增加第 4 种防御值「结构草图（缺设计模板）」（应用缺设计系统时，不冒充“无契约”）。未改模板/线框渲染器行为、PNG 导出服务、后端 src/DB/API、`templates/**`、需求模板中心、模板中心/`preview.html`。

**未验证**：真实 3300 上人工打开设计视图确认“无线框按钮”（`frontend/dist` 已重建、静态托管即时生效，本会话未打开真实实例）；真实无契约旧应用的结构草图视觉（e2e fixture 覆盖）。

**环境确认**：未新增依赖/未 npm install/未做 git；未启停真实 3300/4771；未读写真实 `data/`/`projects/`/`.env`；未调真实模型；e2e 临时目录与端口（3444/3446/3447）均已清理。
