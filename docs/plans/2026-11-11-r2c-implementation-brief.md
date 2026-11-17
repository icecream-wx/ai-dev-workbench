# R2c 设计版本策略实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已完成（2026-11-11，实施会话）**，实施结果/偏差见 §7；主会话评审待进行。
上游：`docs/plans/2026-11-10-design-stage-entity-prototype.md`、`docs/plans/2026-11-11-r2b-implementation-brief.md`、`docs/STATUS.md`「I-09a 完成」「I-09a 评审」。
范围：**R2c**——设计项目版本 checkpoint 化、确认设计留档、手动“保存版本”、版本来源/变更单标签；顺手修 I-09a 压缩 toast 文案。**不做** I-09b、R4。

---

## 1. 已确认决策

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 自动保存 | 实体/页面/页面集自动保存**不再产版本**，只更新内容与 `updated_at`。 |
| 2 | 关键节点 | **确认设计**、模板切换、AI 生成实体/页面、同步设计输入、版本回滚、变更取消恢复、手动保存。**单个实体/页面集确认不单独产版本**（中间状态）。 |
| 3 | 确认设计 | `confirmDesign` **即使内容未变也生成 `confirm` 版本**，保证 C1 `base_design_version`/取消恢复指向已确认快照。 |
| 4 | 手动保存 | 设计版本弹窗新增“保存版本”（`POST /design/versions`），draft 可用；confirmed 409。 |
| 5 | 保留 | 不删除/裁剪任何设计版本；列表加来源/变更单标签即可。 |
| 6 | 截图 | PNG/HTML 快照不产版本、不参与回滚（现状），文档写清。 |

---

## 2. 后端

### 2.1 版本来源

`DesignVersionSource` 扩展：

```ts
'ai' | 'manual' | 'template-change' | 'confirm' | 'sync' | 'rollback' | 'restore'
```

- `confirm`：确认设计；`sync`：同步设计输入；`rollback`：版本回滚；`manual`：手动保存/默认页面集生成。
- `restore`：变更取消恢复（已有）。

### 2.2 自动保存不产版本

- `saveEntities` / `savePageSets` / `savePageSet` / `savePage`：
  - 默认**不递增版本、不写版本快照**；
  - 只更新实体/页面内容与 `app_design_projects.updated_at`（`version` 不变）；
  - 保留显式 `snapshot:true` 能力（内部用）。
- 现有 `bumpVersion(appId, source)` 拆成：
  - `snapshotVersion`（+1 并写快照）；
  - `touchProject`（只更新 `updated_at`）。
  - 或给 `bumpVersion` 加 `snapshot` 参数；调用点按下表调整。

### 2.3 关键节点

| 动作 | 版本 |
| --- | --- |
| 实体/页面/页面集自动保存 | 不产版本（touch） |
| 单个实体确认 / 单个页面集确认 / 页面确认 | 不产版本（touch） |
| **确认设计**（`confirmDesign`） | `confirm`，**总是 +1**（即使在已确认判断之前只执行一次；重复确认幂等不重复产版本） |
| 切换原型模板（`switchProtoTemplate`） | `template-change`（保持） |
| AI 生成实体/页面集 | `ai`（`saveEntities/savePageSets` 显式 snapshot） |
| 同步设计输入（`syncDesignInput`） | `sync` |
| 版本回滚（`rollbackDesignVersion`） | `rollback` |
| 变更取消恢复（`restoreDesignVersionConfirmed`） | `restore`（保持） |
| 默认页面集生成（`generateDefaultPageSets`） | `manual`（用户动作，保留 checkpoint） |
| 手动“保存版本” | `manual` |

- `confirmDesign`：在确认事务内更新 `status='confirmed'`、`confirmed_at`，并 `snapshotVersion(..., 'confirm', 新版本)`；快照内容是当前实体/页面集。保证 `project.version` 增加。
- `savePageSnapshot`（PNG）保持**不产版本**。

### 2.4 手动保存版本

`POST /api/apps/:id/design/versions`

- 设计项目存在；`status='draft'` 时把当前实体/页面集快照为 `manual` 版本（+1），更新 `updated_at`；
- `status='confirmed'` → 409「设计已确认；确认版本已存在，如需新版本请先重新编辑设计」；
- 返回完整 `DesignProjectPayload`（与现有设计接口一致）。
- 守卫：仅 doc 模式（设计路由已有）。

### 2.5 版本列表带变更单

`GET /design/versions`（列表）与 `GET /design/versions/:v`（详情）增加：

- `changeSetId`（已有列）；
- `changeSetSeq` / `changeSetTitle`（LEFT JOIN `app_change_sets`，删除后为 null）。

---

## 3. 前端

### 3.1 版本弹窗

`DesignVersionsDialog.vue`：

- 来源标签：`确认设计` / `AI 生成` / `模板切换` / `同步设计输入` / `版本回滚` / `变更取消恢复` / `手动保存`；
- 显示 `变更 #N`（有 `changeSetSeq` 时）；
- 顶部/底部“保存版本”按钮：先 flush 当前编辑（`EntityDesignTab`/`PrototypeTab` 的 `flushSave`），再调用 `POST /design/versions`；成功刷新并提示 `已保存设计版本 vN`；confirmed 时禁用并提示“设计已确认，确认版本已存在；如需新版本请先重新编辑设计”；
- 提示文案：`自动保存不会生成版本；需要留档时点“保存版本”。`
- 回滚确认文案保持，补充“回滚只恢复实体/页面规格，不恢复原型截图”。

### 3.2 设计 Studio

- 顶部 `设计 vN` 现在是 checkpoint 版本；无需改逻辑，确认后版本会 +1。
- 版本入口保留（弹窗内新增保存按钮）。
- `DesignStudio` 的 `flushActiveTab` 可复用给版本弹窗的 beforeSave。

### 3.3 I-09a 小修

- `DevView.compactContext` 成功提示改为：`已提交压缩请求，结果见时间线`（避免与“没有可压缩的上下文”矛盾）。

---

## 4. 测试与验证

后端：

- 更新既有测试：D1—D4/设计相关测试中“每次保存递增版本”的断言改为“自动保存不产版本”；`smoke:design`、`smoke:handoff-input`、`smoke:change-set` 相应调整。
- 新增：
  - 实体/页面自动保存多次 → `version` 不变、内容更新；
  - 单个实体/页面集确认 → 不产版本；
  - `confirmDesign` → +1 且 source=`confirm`（重复确认不重复产版本）；
  - AI 生成实体/页面 → +1 且 source=`ai`；
  - 同步设计输入 → source=`sync`；回滚 → `rollback`；取消恢复 → `restore`；模板切换 → `template-change`；
  - 手动保存版本 → +1 且 source=`manual`；confirmed 409；
  - 版本列表返回 `changeSetSeq`；
  - PNG 快照不产版本。
- `npm run build --prefix backend`、`npm test --prefix backend`。
- 回归：`smoke:design`、`smoke:design-handoff`、`smoke:handoff-input`、`smoke:change-set`、`smoke:requirements`、`smoke:dev-health`。

前端：

- `npm test --prefix frontend`（来源/标签纯逻辑单测，如有）；`npm run typecheck --prefix frontend`、`npm run build --prefix frontend`、`node check-vue-imports.cjs`。
- Playwright（真实后端/API 预置，不强制模型）：编辑实体/页面多次版本不变 → 确认设计出现“确认设计”版本（v+1）→ 手动保存版本 → 版本弹窗来源/变更单/保存按钮 → 回滚提示；0 console error / 0 非预期 API >=400。
- 顺带验证 I-09a 压缩 toast 文案。

---

## 5. 不做 / 边界

- 不删除/裁剪设计版本；不做版本压缩。
- PNG/HTML 快照仍不参与版本/回滚。
- 不做 I-09b、R4；不改需求版本策略（R2b 已完成）。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 6. 文档

更新 `docs/STATUS.md`（「R2c 完成」+ 摘要表 + 总状态 + 未验证）、本交接单状态/实施结果、`docs/plans/2026-11-11-main-review-handoff.md`（下一步 R4，I-09b 后续）、`docs/plans/2026-11-10-design-stage-entity-prototype.md`（版本策略记录）、`AGENTS.md`。

完成后回传主会话：改动文件、命令/结果、未验证项、偏差、需决策问题。主会话再评审。

---

## 7. 实施结果（2026-11-11，实施会话）

### 改动文件

后端：

- `backend/src/design/types.ts`：`DesignVersionSource` 扩展为 `ai | manual | template-change | confirm | sync | rollback | restore`；`DesignVersionMeta` 增加 `changeSetId/changeSetSeq/changeSetTitle`。
- `backend/src/design/service.ts`：
  - `saveEntities`/`savePageSets` 默认只更新内容 + `updated_at`（`touchProject`），不再产版本；新增内部选项 `{ snapshot: true }`（AI 生成/应用显式传入）。
  - `bumpVersion` 拆为 `appendVersion`（关键节点 +1 并写快照，退回 draft）与 `touchProject`（只更新 `updated_at`）；`savePageSet`/`savePage`（单实体/页面集确认）走自动保存，不产版本。
  - `generateDefaultPageSets` → `manual`；`switchProtoTemplate` → `template-change`；`syncDesignInput` → `sync`；`rollbackDesignVersion` → `rollback`；`restoreDesignVersionConfirmed` 保持 `restore`；`savePageSnapshot` 保持不产版本。
  - `confirmDesign` 在确认事务内**总是 +1 并写 `confirm` 快照**（重复确认幂等不重复），并用新版本号更新 active 变更单的 `current_design_version`。
  - 新增 `createDesignVersion`：draft 时快照当前实体/页面集为 `manual`（+1），confirmed 返回 409；`listDesignVersions`/`getDesignVersion` LEFT JOIN `app_change_sets` 返回 `changeSetSeq/changeSetTitle`。
- `backend/src/design/routes.ts`：新增 `POST /api/apps/:id/design/versions`；`PUT /entities`、`PUT /page-sets` 接受 `snapshot:true`（内部/AI 用）；`sourceOf` 支持全部来源。
- `backend/src/design/service.test.ts`：更新“每次保存递增版本”断言为自动保存不产版本；新增单实体确认/页面确认不产版本、confirm 总是 +1/source、AI 显式 snapshot、sync/restore 来源、手动保存 + 409、`changeSetSeq`、PNG 不产版本。
- `backend/scripts/design-smoke.ts`：自动保存/页面规格/PNG/单实体确认不产版本；确认设计/模板切换/手动保存版本来源与 409；版本列表来源校验。

前端：

- `frontend/src/design/types.ts` / `api.ts`：来源类型、版本 `changeSetId/changeSetSeq/changeSetTitle`、`createDesignVersion`；`saveDesignEntities`/`saveDesignPageSets` 支持 `snapshot`。
- `frontend/src/design/DesignVersionsDialog.vue`：来源标签（确认设计/AI 生成/模板切换/同步设计输入/版本回滚/变更取消恢复/手动保存）、`变更 #N`、顶部“保存版本”（先 flush 编辑；confirmed 禁用并提示）、提示“自动保存不会生成版本”、回滚文案补“不恢复原型截图”。
- `frontend/src/design/PrototypeTab.vue`：版本弹窗传 `before-save=flushSave`，保存/恢复后同步项目。
- `frontend/src/design/DesignStudio.vue`：切换 Tab 前先 flush 当前编辑；版本弹窗可由原型 Tab 打开。
- `frontend/src/design/DesignChatPanel.vue`：AI 应用实体/页面集显式 `snapshot:true`（来源 `ai`）。
- `frontend/src/design/EntityDesignTab.vue`：保存提示去掉版本号（自动保存不产版本）。
- `frontend/src/design/version-labels.js` + `version-labels.test.mjs`：来源/变更单标签纯逻辑与单测。
- `frontend/src/dev/DevView.vue`：compact 成功提示改为 `已提交压缩请求，结果见时间线`。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 126/126（设计测试 21 项；新增 R2c 覆盖） |
| `npm run smoke:design --prefix backend` | ✅ 自动保存不产版本、确认设计 confirm v3、重复确认不产版本、手动保存 v5/v6、确认后 409、模板切换来源 |
| 回归 `smoke:design-handoff` / `smoke:handoff-input` / `smoke:change-set` / `smoke:requirements` / `smoke:dev-health` | ✅ 全部通过（`smoke:dev-health` 真实 opencode 2.2.5） |
| `npm test --prefix frontend` | ✅ 63/63（新增版本标签 3 项） |
| `npm run typecheck --prefix frontend` | ✅ `vue-tsc --noEmit` |
| `npm run build --prefix frontend` | ✅ vite 构建通过 |
| `node check-vue-imports.cjs`（frontend） | ✅ 全部 SFC 导入完整 |
| Playwright（真实后端 + API 预置，不依赖模型） | ✅ 实体/页面多次自动保存版本仍 v2；手动保存 v3（变更 #2）；确认实体/页面集不产版本；确认设计 v4「确认设计」；确认后保存禁用；重新编辑后手动保存 v5、回滚 v6「版本回滚」；回滚提示“不恢复原型截图”；compact toast 文案；0 console error / 0 非预期 API >=400 |

E2E 脚本与截图（临时目录）：`C:\Users\icecream\AppData\Local\Temp\opencode\r2c-e2e\run.mjs`、`shots\00-design-studio.png` … `07-compact-toast.png`。

### 偏差 / 澄清

1. **默认页面集生成保持 `manual` checkpoint**（交接单 §2.3 表格）；因此“生成页面集”会产一个来源为“手动保存”的版本（UI 文案如此，语义为显式动作）。
2. `POST /design/versions` 返回完整 `DesignProjectPayload`（与保存接口一致），前端用 `project.version` 刷新。
3. `changeSetSeq` 为写入时记录的 active 变更单 id + LEFT JOIN 当前变更单表；变更单物理删除后 `changeSetSeq/changeSetTitle` 为 null，`changeSetId` 仍保留历史列值。
4. `confirmDesign` 的 confirm 快照在事务内读取当前实体/页面集；确认前未落盘的编辑仍由前端 flush。
5. 版本弹窗由页面原型 Tab 承载（入口保留）；切 Tab 时新增 flush，避免“保存版本”读到未落盘编辑。
6. 快照只存实体/页面集 JSON，不含 PNG/HTML 文件内容；页面对象保留 `imagePath/htmlPath` 引用（与 D5 现状一致，避免取消恢复后交接包缺图），回滚不会重写或重截截图文件。

### 未验证 / 已知限制

- 未做版本删除/压缩（明确不做）。
- 旧数据（R2c 之前已确认的设计）没有 `confirm` 快照；`base_design_version` 指向最近一次保存版本，取消恢复仍可用但不保证“已确认态快照”。重新编辑并确认一次即可补齐，未做数据回填。
- 未为“AI 生成”单独跑真实模型（AI 应用路径用 `saveEntities/savePageSets` 的 `snapshot:true` 单测覆盖；真实模型生成已在 D1—D4/R2a 验证）。
- 真实长会话 compact 成功路径仍只由单测/route mock 覆盖（I-09a 既有未验证项）。
- Playwright 的 compact 用路由注入 mock，不启动 opencode；toast 文案已断言。

