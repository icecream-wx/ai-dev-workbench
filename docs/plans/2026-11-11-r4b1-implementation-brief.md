# R4b-1 前端 shared 抽取 + 旧 UI 删除实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已实施（2026-11-11，待评审）**。实施结果见 §8。
上游：`docs/STATUS.md`（R4a 评审、R4 讨论）、`AGENTS.md`。
范围：**R4b-1**——把 doc/design 仍依赖的 shared 模块从 `requirements-grooming/` 抽出，删除旧 structured UI；**不动后端、不删应用/数据**（R4b-2 做）。目标：前端只保留 doc/design/dev/change-set 所需代码。

---

## 1. 当前依赖（必须先抽再用删）

doc/design 仍依赖 `requirements-grooming/` 的：

- `ui/SettingsDialog.vue` + `settings/store.ts`（模型设置；AppShell 使用）；
- `styles/theme.css`、`pinia-setup`（全局样式/Pinia）；
- `storage/local.ts`（loadJson/saveJson）、`storage/workspace-persist.ts`（get/setActiveAppId、wsReady）；
- `conversation/protocol-output.js`（doc/design 协议解析共用）；
- `ui/prototype/*`（`PrototypeRenderer`、`Wireframe*`、`layout`、`mock`、`wireframe.css`、`FieldControl`）+ `spec/types.ts`（design `PrototypeCanvas` 使用）。

## 2. 抽取映射（建议；可按依赖微调）

| 从 | 到 |
| --- | --- |
| `requirements-grooming/styles/theme.css` | `frontend/src/shared/theme.css` |
| `requirements-grooming/pinia-setup.ts` | `frontend/src/shared/pinia.ts` |
| `requirements-grooming/storage/local.ts` | `frontend/src/shared/storage.ts` |
| `requirements-grooming/storage/workspace-persist.ts` 的 activeAppId 部分 | `frontend/src/shared/app-context.ts`（`setActiveAppId/getActiveAppId`；删掉 workspace 水合/wsReady） |
| `requirements-grooming/settings/store.ts` | `frontend/src/settings/store.ts`（依赖改为 shared storage/app-context） |
| `requirements-grooming/ui/SettingsDialog.vue` | `frontend/src/settings/SettingsDialog.vue` |
| `requirements-grooming/conversation/protocol-output.js`（+ 通用测试） | `frontend/src/shared/protocol-output.js`（doc/design import 更新） |
| `requirements-grooming/ui/prototype/` 整个目录 + `requirements-grooming/spec/types.ts` | `frontend/src/design/prototype/`（内部 import 调整；`PrototypeCanvas` 更新） |

## 3. 删除（抽取后）

- `frontend/src/requirements-grooming/` 其余全部（MainApp、场景树、卡片、批次、diff/undo/actions、spec 对话、TestView/DesignView、旧模板/设计面板、store 等）。
- `frontend/src/workbench/HandoffDialog.vue`（旧 P3 structured 交接包弹窗）。
- `frontend/src/llm/client.ts` 及旧 spec 对话/任务代码（若审计确认无 doc/design 引用；doc/design 用 `requirements/api`、`design/api`、`dev/api`）。
- 旧 `SPEC_JSON` 协议/旧需求卡片 UI（若仍独立存在）。
- 旧 structured 入口/文案/组件引用。

## 4. 简化（前端）

- `App.vue`：只保留路由 + `AppShell`/`HomeShell`；移除 `workspace-persist`/`wsReady`/doc-template/conversation/ui store 水合；改为 shared theme/pinia + 必要的 `settings.init()`；`ready` 可直接为 true。
- `AppShell.vue`：移除 `MainApp`、`HandoffDialog`、`docMode` 分支（doc 是唯一模式）、`ui.activeView`；保留 RequirementsDocView / DesignStudio / DevView / DesignHandoffDialog / 变更弹窗 / 模型设置。
- `HomeShell.vue`：移除 structured 统计（modules/confirmed）、旧需求卡片信息；显示文档版本/状态/完成度。
- `workbench/api.ts`：移除 structured-only 类型/字段（`stats.modules/confirmed`、旧 `Handoff*` 类型、`requirementsMode` 如不再使用）；后端暂时仍返回多余字段可忽略。
- 保留 `changesets/`、`requirements/`、`design/`、`dev/`、`settings/`、`shared/`、`workbench/`。

## 5. 不做

- 不动后端（旧 handoff/modules/workspace API 暂留，R4b-2 删）。
- 不删 `data/`、`projects/`、应用登记（R4b-2）。
- 不删 MySQL demo 数据（R4c）。
- 不做视觉/响应式打磨。
- 不读取/打印/提交真实密码。

## 6. 验证

- `npm run typecheck --prefix frontend`、`npm run build --prefix frontend`、`npm test --prefix frontend`、`node check-vue-imports.cjs`。
- 全局搜索：无 `requirements-grooming`、`HandoffDialog`、`wsReady`、`useConversationStore`、`useDocTemplateStore`、`useUiStore` 残留（shared 映射除外）。
- 后端回归不变：`npm test --prefix backend`（本批不改后端）。
- 用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR` 创建 doc 应用（API 或现有 E2E 脚本），Playwright 快速验证：首页/需求文档/设计 Studio/开发页/变更历史/模型设置能打开；0 console error / 0 非预期 API >=400。当前真实 DB 里的两个 structured 应用本批后不可打开，属预期（R4b-2 删除）。
- 截图放临时目录。

## 7. 文档

更新 `docs/STATUS.md`（「R4b-1 完成」+ 摘要表/总状态）、本交接单状态与实施结果、`AGENTS.md`（下一步 R4b-2）、`docs/plans/2026-11-11-main-review-handoff.md`。

完成后回传：抽取/删除文件清单、残留引用审计、验证命令/结果、偏差、需 R4b-2 处理的项。

---

## 8. 实施结果（2026-11-11，实施会话）

### 8.1 抽取（新建）

| 文件 | 来源 / 说明 |
| --- | --- |
| `frontend/src/shared/theme.css` | `requirements-grooming/styles/theme.css` 原样复制 |
| `frontend/src/shared/pinia.ts` | `pinia-setup.ts`（Pinia 兜底） |
| `frontend/src/shared/storage.ts` | `storage/local.ts`（`loadJson/saveJson/removeKey`） |
| `frontend/src/shared/app-context.ts` | `workspace-persist` 的 activeAppId：`setActiveAppId/getActiveAppId`；workspace 水合/wsReady/落库全部删除 |
| `frontend/src/shared/protocol-output.js` + `.test.mjs` | `conversation/protocol-output.js` + 通用解析测试；注释改为 doc/design 共用 |
| `frontend/src/settings/store.ts` | `settings/store.ts`；依赖 `shared/storage` + `shared/app-context`；删除零引用 `setTheme/toggleTheme/isConfigured`（保留主题读取与应用） |
| `frontend/src/settings/SettingsDialog.vue` | 模型设置弹窗 |
| `frontend/src/design/prototype/`（16 个文件） | `ui/prototype/` 除 `PrototypePanel.vue` + `spec/types.ts` → `spec-types.ts`（裁剪为渲染所需类型）+ `refs.ts`（纯解析 + 空 `findEntityInModule`，不依赖旧 workspace store）；`PrototypeCanvas.vue` import 更新 |

同时 `design/prototype/layout.ts` 删除抽取后零引用的 `resolvePageEntity`、`sanitizeBlocks`；`PrototypeRenderer.vue` 去掉重复的 `pages` prop 声明（无行为变化）。

### 8.2 删除

- `frontend/src/requirements-grooming/` 整个目录（含 MainApp/场景树/卡片/批次/diff/undo/actions/llm/spec 对话/TestView/DesignView/旧模板/旧设计面板/workspace/spec/conversation/test/agent store）。
- `frontend/src/workbench/HandoffDialog.vue`（旧 P3）、`frontend/e2e-flow.ts`（旧 structured 流程脚本，未被任何 script/tsconfig 引用）。
- 前端依赖 `ajv`、`monaco-editor` 与 `vite.config.ts` 的 monaco chunk（仅旧代码使用；`package-lock.json` 已同步）。

### 8.3 简化

- `App.vue`：路由 + `AppShell`/`HomeShell`；`shared/theme.css`、`shared/pinia`；进入应用时 `setActiveAppId` + `settings.init()`；移除 workspace/wsReady/doc-template/conversation/ui store 水合与 boot 遮罩（`ready` 恒真）。
- `AppShell.vue`：移除 `MainApp`、`HandoffDialog`、`docMode` 分支、`ui.activeView`、structured 确认（`confirmStage`）与 `confirmRequirements/confirmDesign`；顶栏只保留“确认完成开发”。
- `HomeShell.vue`：仅显示需求文档版本/状态/模板（移除 `stats.modules/confirmed`）。
- `workbench/api.ts`：移除 `RequirementsMode`、`AppInfo.stats/requirementsMode`、旧 `HandoffMeta/HandoffFile*`/预览/生成/读取类型与函数、`confirmStage`、`AppIssue`；`ApiError` 收敛为 `{status,message}`。
- `dev/DevView.vue` 交接包固定走设计交接包；`dev/types.ts` 去掉 `requirementsMode`。
- `check-vue-imports.cjs` 扫描整个 `src/`；`package.json` test 路径改为 `src/shared/protocol-output.test.mjs`。

### 8.4 验证

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck --prefix frontend` | ✅ |
| `npm run build --prefix frontend` | ✅（无 monaco 空 chunk） |
| `npm test --prefix frontend` | ✅ 63/63 |
| `node check-vue-imports.cjs` | ✅ 全部 SFC 导入完整 |
| `npm test --prefix backend` | ✅ 126/126（未改后端） |
| Playwright（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`，PORT=3400，`OPENCODE_AUTO_START=false`） | ✅ 首页/需求文档/设计 Studio（页面原型 wireframe 实际渲染）/开发页/变更历史/模型设置；0 console error、0 page error、0 意外 API>=400；截图在临时目录 |

### 8.5 偏差 / 需 R4b-2

1. 后端 `appPayload` 仍返回 `requirementsMode/stats`，`/api/workspace`、`/api/modules/*`、`/api/agents`、旧 `handoffs` 表/接口保留；前端已忽略（后端删除属 R4b-2）。
2. 现有真实 DB 的 2 个 structured 应用本批后前端不可打开（属预期；登记/目录/demo 数据留给 R4b-2/R4c）。
3. `@element-plus/icons-vue`、`ai-dev-workbench: file:..` 依赖保留未处理。
4. 原型跨模块引用与关系子表在设计阶段仍不解析（与抽取前一致）。
5. 未跑后端冒烟脚本（本批不改后端，以 126 测试为基线）；真实 opencode 相关冒烟可按评审需要复跑。
