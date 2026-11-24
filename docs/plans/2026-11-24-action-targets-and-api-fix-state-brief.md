# B6—B7 实施单：动作目标 actionTargets / 临时表单 / 接口「让 AI 修」一键发送

- 日期：2026-11-24
- 状态：已实施（待评审）
- 范围：设计预览交互层（`interaction.js` / `DesignPreviewApp` / `ContractActionDialog`）、页面契约（`pages.json` 可选 `actionTargets`）、接口设计「让 AI 修」交互与状态
- 不改：DB 表/列、需求模板中心（`TemplateLibraryDialog` / `requirement_templates` / `adw-template-req-*`）、`templates/design-system/**`、`templates/afc-remote/**`、`templates/workshop/**`；未做 git、未启停真实 3300/4771、未调模型、未写真实 `projects/`/`data/`/`.env`（app1 仅只读参考）。

## 1. 根因（app1）

`projects/app1/docs/design/pages.json`（只读参考）：

- `goods-list`（entity `goods`, recipe `list`, toolbar `create`）→ 同实体候选 `goods-view(detail)`、`goods-form(main-sub)`；
- `goods-form` 是完整表单页（`type: form` / `recipe: main-sub` / `form.presentation: page`），但 B5 的 `CREATE_RECIPES` 只有 `dialog-form/page-form/wizard`，于是 create 解析为 `none`，提示「该页面集未设计新增页」；
- `goods-detail-list` → `goods-detail-form(dialog-form)` 正常弹窗；`order-list` → `order-create(main-sub)` 同样受影响；
- `goods-view` / `order-detail` 是 `detail`，不是新增表单。

结论：不是 AI 判断问题，是**解析器漏了 `main-sub`** + **契约没有显式动作映射**。

## 2. 决策

- **B6-0**：`main-sub` 纳入 create/edit 表单目标；`dialog-form` → 弹窗，`page-form/main-sub/wizard` → 父层切页面 Tab；`detail` 只做详情，不参与启发式新增/编辑。
- **B6-1**：页面级可选 `actionTargets`（AI 写，显式优先）。目标必须同页面集；无效显式目标忽略并回退启发式，同时返回 `invalidTarget` 供 UI 提示。启发式仍按同实体 + 配方优先级；**仅当没有同实体候选页**时才放宽到同页面集表单页（唯一 → 采用并标 `inferred`；多个 → 关键词优先，否则数组第一个）。`none` 返回 `reason` + `candidates`。
- **B6-2**：无可用表单页时打开**临时表单**（`dialog-form` 形态，用实体字段），明确标注「临时表单 · 未设计表单页」，并提示原因与同实体候选；不伪造正式页面、不写文件、不调接口。
- **校验口径**：只 warning、不阻断。`create/edit` 目标配方非表单、`detail` 目标非 detail、目标不存在/跨页面集、页面声明 create/edit 但既无 `actionTargets` 也无同实体表单页 → warning（后端 artifacts 与 `validate.mjs` 同口径）。旧设计只有 `type:"form"` 无 recipe 时仍视为表单页（避免误报）。
- **B7**：接口设计「让 AI 修」改为**一键填入并发送**，面板显示修复状态（正在修复 / 修复完成：警告 6 → 2 / 修复结束，仍有 N 个警告），完成后刷新产物；其它视图（设计全局问题条）仍保持只填 Composer。

## 3. 改动

### 3.1 B6（动作目标 / 临时表单）

- `frontend/src/design-preview/interaction.js`
  - `FORM_RECIPES = ['dialog-form','page-form','main-sub','wizard']`；`kindOfRecipe` 只有 `dialog-form` → `dialog`；
  - `resolveActionTarget` 新增显式优先 `actionTargets`（同页面集校验）、`invalidTarget`、`inferred`、`candidates`、`reason`；
  - 放宽兜底仅在“同一页面集 + 同实体候选为空”时生效；
  - 新增纯函数 `buildTemporaryFormPage(sourcePage, entity)`（字段来自实体 `code/name`；无字段返回 `null`）。
- `frontend/src/design-preview/DesignPreviewApp.vue`
  - `none` → 若可生成临时表单则打开 `ContractActionDialog(temporary=true)` + `ElMessage.warning(reason)`，否则只提示；
  - `actionDialog` 增加 `temporary`。
- `frontend/src/design-preview/ContractActionDialog.vue`
  - 新增 `temporary?: boolean`；标题「临时表单 · 未设计表单页」+ 说明「仅用于交互预览，建议让 AI 补表单页或 actionTargets」。
- `frontend/src/design/design-adapter.js` / `frontend/src/design/types.ts`
  - `normalizeActionTargets`（对象、键/值非空字符串；非法 warning 后忽略；保留未知动作键）；写入 `page.actionTargets` 与 `original.actionTargets`；`DesignPage` 增加 `actionTargets?: Record<string,string>`。
- `templates/agent/skills/adw-design-artifacts/references/pages.schema.json`
  - 页面级新增可选 `actionTargets`（`additionalProperties: string`，`x-adw-warning`）。
- `templates/agent/skills/adw-design-artifacts/references/pages-example.json`
  - `goods-list` 增加 `actionTargets`（create/edit → goods-form，detail → goods-detail）；补 `goods-detail`；`category-tree` 增加 `actionTargets` 并补 `category-form`（保持示例 0 warning）。
- `templates/agent/skills/adw-design-artifacts/scripts/validate.mjs`
  - schema 校验后追加页面集语义检查（`pageSetSemanticWarnings`），输出 `warnings[]`、不阻断。
- `backend/src/workspace/design-contract.ts`
  - 新增页面集级 `actionTargets` 语义 warning；仅在真实 `pageSets` 上执行（pack 的单页契约兼容路径不做页面集语义）。
- 设计 prompt：`templates/agent/skills/adw-design-artifacts/SKILL.md`、`templates/agent/commands/generate-design.md`、`backend/src/chat/service.ts`（设计视图 framing）明确 create/edit → 表单页 + `actionTargets`、`main-sub` 合法、`detail` 不当 create 目标、写完跑 `validate.mjs`。

### 3.2 B7（接口「让 AI 修」一键发送 + 状态）

- `frontend/src/workbench/AgentChatPanel.vue`
  - `send()` → `Promise<boolean>`；新增并暴露 `sendComposer(text?)`（进程内检查与 send 一致；被阻止返回 `false`）。
- `frontend/src/workbench/DesignView.vue`
  - 新增 `apiFixState: 'idle'|'running'|'done'` / `apiFixSummary` / `apiFixBefore`；
  - `fixApiWithAi` 改为 async：忙时提示；记录 before 计数；窄屏打开对话；running 状态；`await chatRef.value?.sendComposer(text)`；失败回 idle；
  - `chatBusy` true→false 后 **延迟 400ms 确认**（避免发送 ack 被误判为完成；期间若又回到运行中则不结束），再 `loadAll(true)`、计算 after、done + 摘要；
  - 切换 Tab / 重新生成时重置状态；卸载清理定时器。
- `frontend/src/workbench/ApiDesignPanel.vue`
  - props 增加 `fixState` / `fixSummary`；「让 AI 修」在 `busy || fixState==='running'` 时 disabled；
  - 新增状态条 `data-testid="api-design-fix-status"`（running 带 spinner；done 显示摘要；idle 不显示）。
- `frontend/src/workbench/api-design-helpers.js`
  - 新增纯函数 `apiDesignFixSummary(before, after)`（支持 artifact 或计数对象）。

## 4. 测试与结果（实跑）

### 4.1 单测 / 类型 / 构建

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **230 pass / 0 fail**（基线 213；+17） |
| `npm run typecheck --prefix frontend` | 通过（无输出） |
| `npm run check:vue --prefix frontend` | `OK: 全部 SFC 导入完整` |
| `npm test --prefix backend`（`RG_DATA_DIR`/`RG_PROJECTS_DIR` 指向临时目录） | **243 pass / 0 fail**（基线 238；+5） |
| `npm run build --prefix backend` | 通过 |
| `npm run build --prefix frontend` | 通过（vite build，exit 0） |
| `npm run smoke:workspace --prefix backend` | 全部通过（临时库/端口 3416） |
| `npm run smoke:assets --prefix backend` | 通过（skills/commands 齐全） |

新增单测：

- `frontend/src/design-preview/interaction.test.mjs`：app1 形状（`goods-list` + `goods-form(main-sub)` → navigate；`goods-detail-form(dialog-form)` → dialog；`order-create(main-sub)` → navigate；`detail` 不被 create 选中）、显式优先、显式 dialog、无效/跨页面集显式回退 + `invalidTarget`、放宽唯一表单页/多表单关键词、同实体候选存在时不放宽、none 原因+候选、临时表单字段/无字段 `null`。
- `frontend/src/design/design-adapter.test.mjs`：`actionTargets` 保留（含未知动作键）、非对象/空值 warning 与跳过。
- `frontend/src/workbench/api-design-helpers.test.mjs`：`apiDesignFixSummary` 警告减少/清零/仍有/无变化/artifact 输入。
- `backend/src/design/contract.test.ts`：目标不存在/跨页面集 warning（后端与 `validate.mjs` 双路径）、配方不匹配、create/edit 无映射且无同实体表单页 warning、显式映射不报、表单页自身声明 create 不误报、pack 单页契约不触发页面集语义。

### 4.2 e2e（临时目录 + 独立端口 + stub opencode）

| 命令 | 结果 |
| --- | --- |
| `npm run e2e:design-interaction --prefix backend` | **30 条断言**通过（原 24；+6：main-sub 切页、显式 actionTargets 覆盖、临时表单 7.1—7.6） |
| `npm run e2e:api-design --prefix backend` | **28 条断言**通过（原 26；+2：自动发送 prompt、修复完成状态） |
| `npm run e2e:p2 --prefix backend` | **105** |
| `npm run e2e:p3 --prefix backend` | **177** |
| `npm run e2e:p4 --prefix backend` | **135** |
| `npm run e2e:p9 --prefix backend` | **69** |
| `npm run e2e:p10 --prefix backend` | **81** |
| `npm run e2e:p7-4b --prefix backend` | **47**（脚本 `check()` 上限 47；README 旧口径 57 为历史数字） |
| `npm run e2e:p7-7c --prefix backend` | **118** |
| `npm run e2e:p7-6a --prefix backend` | **21** |
| `npx tsx scripts/ui3b-shots.ts`（backend 目录） | **23 张截图 / 22 次无溢出 / 27 次口径测量** |

`e2e:design-interaction` fixture 扩展为 1 页面集 / 5 实体 / 12 页：新增 `invoice-list` + `invoice-form(main-sub)`、`ticket-list`（显式 `actionTargets.create=ticket-page`）+ `ticket-dialog(dialog-form)` + `ticket-page(page-form)`、`report-view(detail)`；`report-list` create → 临时表单（原因含 `report-view(detail)`，不切页、可取消）。

`e2e:api-design` 第 2 段改为：点「让 AI 修」→ 等 harness `prompts` 增加并断言包含 `api-design.md` 与错误原因 → 断言状态条「正在修复」+ `chat-status`「运行中」→ stub 回写合法文档并流式回复 → 断言「修复完成」且问题条消失。harness 新增可选 `P2_API_DESIGN_FIX_FILE`（仅测试设置，其它 e2e 不设置、行为不变）。

## 5. 偏差

- **`main-sub` 优先级**：按规格顺序 `dialog-form > page-form > main-sub > wizard`（`main-sub` 排在 `wizard` 前）。
- **显式覆盖**：显式目标即使配方不匹配也会采用（后端/validate 只 warning），与“显式优先”一致；**显式 `actionTargets` 对自定义/未知动作码（如 `approve`/`changeStatus`）同样生效**（先查显式目标，再判断是否已知动作走启发式；未知动作无显式目标仍 `notify`）。
- **放宽兜底条件**：实现为“**同实体候选为空**”才放宽；若有同实体 detail 但没有表单页，则不放宽到其它实体表单页，而是 `none` → 临时表单。这样避免把别的实体表单当作当前实体默认目标；`none` 的候选提示会说明原因。
- **临时表单**：只在 create/edit 且实体有字段时生成；`detail` 不生成；实体无字段只提示。
- **B7 完成判定**：采用 `chatBusy` true→false + 400ms 延迟确认。真实模型长任务不受影响；stub 修复场景把流式时长调到约 1s 以稳定观察「正在修复」。
- **e2e 数字变化**：`design-interaction` 24→30、`api-design` 26→28；`p7-4b` 实跑 47（脚本上限 47，README 旧 57 为历史口径，本轮未改该脚本与断言）；`p4` 实跑 135。
- **示例文档**：`pages-example.json` 补了 `goods-detail` / `category-form`，保持示例 `validate.mjs` 0 error / 0 warning。

## 6. 未验证

- 真实模型（`deepseek-flash`）是否稳定写 `actionTargets`、修复接口时是否按提示补齐（本轮未调模型）。
- 真实 3300 视觉/交互验收（真实实例在运行，未启停）。
- 真实触摸板/移动端手势（本轮只做桌面 e2e）。
- 复杂契约（多页面集、跨实体主从、多层子表）与超大数据量下的交互预览/临时表单表现。
- 页面集总览与 ER 性能（本轮未改）。
- PNG 像素级 diff（仍只校验宽高/主色）。
- AFCenter / EOS 构建与运行（外部前提，未验证）。
- `docs/report/**` 未更新（本轮只更新 `docs/STATUS.md`、`docs/plans/**`、`AGENTS.md`、`README.md`、ui3b 证据截图）。

## 7. 结束核对

- 测试端口无残留（各 e2e 结束关闭临时端口；ui3b 3438 已关闭）。
- 真实 3300/4771 只读核对前后 PID 一致（未启停）。
- 未做 git、未写真实 `projects/`/`data/`/`.env`、未改 DB/需求模板中心；`projects/app1` 仅只读参考。
