# R2b 需求文档版本策略实施交接单

日期：2026-11-11
状态：**已完成（2026-11-11，实施会话）**；实施结果/偏差见 §7。主会话评审待进行。
用途：**新开实施会话**使用；主会话负责设计/评审。
上游：`docs/plans/2026-11-10-requirements-stage-doc-design.md`、`docs/plans/2026-11-11-r2a-implementation-brief.md`、`docs/STATUS.md`「R2a 完成」「R2a 评审」。
范围：**R2b**——需求文档版本 checkpoint 化、手动“保存版本”、建议消息裁剪、R2a 两个 UX 修复。**只做需求文档**；设计/交接包版本策略留 **R2c**（排在 I-10 之后）；不做 I-10/I-09/R4。

---

## 1. 已确认决策

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 自动保存 | 章节自动保存**不再生成版本**，只更新内容/`updated_at`。 |
| 2 | 关键节点 | 模板切换、AI 应用、确认需求、版本回滚、变更取消恢复生成版本；新增**手动“保存版本”**。 |
| 3 | 保留策略 | **先不删除**任何版本；等真实使用观察后再定裁剪。 |
| 4 | 设计版本 | 本轮不动；**R2c** 在 I-10 会话列表之后再做。 |
| 5 | 建议消息 | 持久化时裁剪行级 diff，展示时再计算，避免对话消息膨胀。 |

---

## 2. 后端：版本 checkpoint 化

### 2.1 版本来源

`RequirementDocVersionSource` 扩展为：

```ts
'ai' | 'manual' | 'template-change' | 'confirm' | 'rollback' | 'restore'
```

- `manual`：手动“保存版本”（以及显式 `snapshot:true` 的章节保存，若有）。
- `ai`：AI 建议应用。
- `template-change`：切换模板。
- `confirm`：确认需求。
- `rollback`：版本回滚。
- `restore`：变更取消恢复（已有）。

### 2.2 自动保存不产版本

- `saveDocSection`：`snapshot` 默认改为 **false**（显式 `snapshot:true` 仍生效）。
- `saveDoc`（全文/章节更新）：保持默认 snapshot true（这是显式保存动作）；`source='ai'` 时 snapshot true。
- `commit`/其它内部调用若需要版本，显式传 true。

### 2.3 关键节点

- `confirmRequirementDoc`：确认时**必须**生成一个 `confirm` 版本（即使内容与上一版相同），保证 `startChangeSet` 的 `base_requirements_version` 指向已确认内容，取消变更可恢复。把现在的 `'manual'` 改为 `'confirm'`。
- `rollbackDocVersion`：source 改为 `'rollback'`。
- `switchDocTemplate`：保持 `'template-change'`。
- `restoreRequirementDocVersionConfirmed`：保持 `'restore'`。
- `reopenRequirementDoc`：内容不变，不生成版本。

### 2.4 手动“保存版本” API

`POST /api/apps/:id/requirements-doc/versions`

- 仅 `requirements_mode='doc'`（router 守卫已有）。
- 文档可编辑（draft）时：把当前内容快照为新版本（source `manual`），`version + 1`，返回 `{ version, createdAt, source }` 或完整 payload（与现有返回风格一致）。
- 文档已确认（只读）：返回 409「文档已确认；确认版本已存在，如需新版本请先重新编辑」。
- 不传 `contentMd/sections`（保存的是当前服务器内容，先由前端 flush 未保存编辑再调用）。
- 并发/重复点击：正常递增，无需幂等。

### 2.5 版本列表带变更单

`listDocVersions` / `getDocVersion` 返回 `changeSetId` 与 `changeSetSeq`（LEFT JOIN `app_change_sets`，取 `seq/title`），供 UI 显示 `变更 #N`。已有 `change_set_id` 列。

---

## 3. 前端

### 3.1 自动保存

- `RequirementsDocView.vue` 章节编辑器、`OutlineEditor.vue` 的结构化保存：PUT 时显式 `snapshot: false`（即使后端默认已改，显式更清晰）。
- 自动保存后仍刷新内容/`updated_at`，但版本号不变；UI 不需要“未保存版本”提示。

### 3.2 版本弹窗

- `VersionHistoryDialog.vue`：
  - 来源标签：`确认需求` / `AI 应用` / `模板切换` / `版本回滚` / `变更取消恢复` / `手动保存`；
  - 显示所属变更单 `变更 #N`（有 `changeSetSeq` 时）；
  - 顶部/底部增加 **“保存版本”** 按钮：先 flush 当前编辑（`beforeSend`/`flushSave`），再调用 `POST /versions`，成功后刷新列表并提示 `已保存版本 vN`；文档已确认时禁用并提示；
  - 回滚确认文案保持现有。
- `RequirementsDocView.vue` 工具栏或版本入口：确保能打开版本弹窗（现有入口保留）。

### 3.3 建议消息裁剪

- `doc-diff.js` 增加：
  - `trimSuggestion(suggestion)`：持久化前删除各 entry 的 `lineDiff`（保留 `markdownBefore`/`markdown`/`title` 等应用所需字段）；`applied`/`ignored` 保留。
  - `hydrateSuggestion(suggestion)`：读取历史消息后，对 `change==='modified'` 且缺 `lineDiff` 的 entry 用 `markdownBefore`/`markdown` 现算。
- `DocChatPanel.vue`：
  - `saveDocChat` 前对 messages 做 `trimSuggestion`；加载后 `hydrateSuggestion`。
  - `AiSuggestionCard` 仍用 entry.lineDiff 展示；hydrate 保证刷新后可用。
- 目标：对话消息不再存储整份行 diff；应用载荷不变。

### 3.4 R2a UX 修复

1. **stale 允许忽略**：`AiSuggestionCard` 的 `ignoreDisabled` 不再包含 `stale`（仅 `applied/ignored/streaming`）；只读文档也允许忽略（不写库）。
2. **应用前先判断版本**：`onApplySuggestion` 先比较 `suggestion.baseVersion` 与当前 `docVersion`；不一致直接提示“请重新生成”，不再先 flush；一致后再 flush，flush 后再次校验版本，若因保存变化则提示“已保存未提交编辑，请重新生成建议”（不要静默应用）。

---

## 4. 测试与验证

后端：

- 更新受影响测试：原先“章节保存递增版本”的断言改为“版本不变、内容更新”；新增：
  - 章节自动保存两次 → version 不变、`updated_at` 变化；
  - 确认需求 → +1 且 source=`confirm`；
  - AI 应用 → +1 且 source=`ai`；
  - 手动保存版本 → +1 且 source=`manual`；confirmed 时 409；
  - 回滚 → source=`rollback`；取消恢复 → source=`restore`；模板切换 → source=`template-change`；
  - 版本列表返回 `changeSetSeq`（在 Change Set 内生成的版本）。
- `npm run build --prefix backend`、`npm test --prefix backend`。
- `npm run smoke:requirements` 扩展：自动保存不产版本、确认/AI/手动/回滚/恢复来源正确、版本列表带变更单；回归 `smoke:change-set` / `smoke:design-handoff` / `smoke:design` / `smoke:handoff-input`。

前端：

- `npm test --prefix frontend`（新增 trim/hydrate 单测 + 现有 doc-diff 继续通过）
- `npm run typecheck --prefix frontend`、`npm run build --prefix frontend`
- Playwright（可用 API 预置，不需要真实模型）：编辑章节多次 → 版本号不变；确认需求 → 出现“确认需求”版本；手动“保存版本” → 新版本；版本弹窗显示来源/变更单；滚动/回滚路径正常；0 console error / 0 非预期 API >=400。
- 建议消息裁剪：用 R2a 的建议卡（可 mock/真实模型）刷新页面后仍显示 diff、可应用/忽略；消息体积明显下降。

---

## 5. 不做 / 边界

- 不删除任何版本；不做保留/压缩。
- 不改设计版本、交接包版本、`base_design_version`/取消恢复语义（R2c）。
- 不做 I-10/I-09/R4。
- 不改 R2a 的 preview/removeSectionKeys 语义。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 6. 文档

更新 `docs/STATUS.md`（「R2b 完成」+ 摘要表 + 总状态）、本交接单状态/实施结果、`docs/plans/2026-11-11-main-review-handoff.md`（下一步 I-10，R2c 之后）、`docs/plans/2026-11-10-requirements-stage-doc-design.md`（版本策略记录）。

完成后回传主会话：改动文件、命令/结果、未验证项、偏差、需决策问题。主会话再评审。

---

## 7. 实施结果（2026-11-11，实施会话）

### 改动文件

后端：

- `backend/src/requirements/types.ts`：版本来源扩展 `confirm/rollback`；版本 Meta/Detail 增加 `changeSetId/changeSetSeq`。
- `backend/src/requirements/doc.ts`：
  - `saveDocSection` snapshot 默认 false；
  - `confirmRequirementDoc` 事务内生成 `confirm` 版本（重算 contentMd，version+1；幂等不重复）；
  - `rollbackDocVersion` → `rollback`；`createManualDocVersion` 新增（confirmed 409）；
  - `listDocVersions`/`getDocVersion` LEFT JOIN `app_change_sets` 返回 `changeSetSeq`。
- `backend/src/requirements/routes.ts`：新增 `POST /versions`；路由注释更新。
- `backend/src/requirements/doc.test.ts`：自动保存不产版本（两次 + `updated_at` 变化 + 显式 snapshot）；confirm 版本/幂等；manual + 409；rollback/restore 来源；changeSetSeq（含变更单删除后为 null）。
- `backend/src/requirements/routes.test.ts`：structured 应用 `POST /versions` 409；手动保存接口 200/来源/manual + changeSetSeq=null。
- `backend/scripts/requirements-smoke.ts`：自动保存不产版本、手动保存 v2、变更中版本 changeSetSeq=7、回滚 rollback、确认 confirm 版本、确认后手动保存 409。

前端：

- `frontend/src/requirements/api.ts`：来源类型、`changeSetId/changeSetSeq`、`createDocVersion`。
- `frontend/src/requirements/RequirementsDocView.vue`：自动保存/结构化保存 `snapshot:false`；版本弹窗 `before-save`/`saved`。
- `frontend/src/requirements/VersionHistoryDialog.vue`：来源标签、`变更 #N`、“保存版本”（先 flush；confirmed 禁用）。
- `frontend/src/requirements/doc-diff.js` + `doc-diff.test.mjs`：`trimSuggestion`/`hydrateSuggestion` + 2 项单测。
- `frontend/src/requirements/DocChatPanel.vue`：保存裁剪/加载 hydrate；应用前先判 `baseVersion`、flush 后再判一次。
- `frontend/src/requirements/AiSuggestionCard.vue`：`ignoreDisabled` 仅 streaming/applied/ignored。

### 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 115/115 |
| `npm run smoke:requirements --prefix backend` | ✅ 扩展通过（自动保存/手动/变更单/回滚/confirm/409） |
| 回归 `smoke:change-set` / `smoke:design-handoff` / `smoke:design` / `smoke:handoff-input` | ✅ 全部通过 |
| `npm test --prefix frontend` | ✅ 46/46 |
| `npm run typecheck` / `npm run build`（frontend） | ✅ 通过 |
| `node check-vue-imports.cjs`（frontend） | ✅ 通过 |
| Playwright（API 预置） | ✅ 版本不变/手动保存/确认版本/变更单号/回滚/建议裁剪+hydrate/stale 忽略；0 console error / 0 非预期 API >=400 |

E2E 脚本与截图（临时目录）：`C:\Users\icecream\AppData\Local\Temp\opencode\r2b-e2e\run.mjs`、`shots\01…07`。

### 偏差 / 澄清

1. 手动保存版本返回完整 payload（与保存接口一致），未单独返回 `{version,createdAt,source}`。
2. confirm 版本在确认事务内生成并重算 `content_md`；确认前的编辑由前端 flush（自动保存）落库。
3. `changeSetSeq` 按 `app_requirement_doc_versions.change_set_id` LEFT JOIN 当前变更单；变更单被删除时为 null。
4. 空草稿也允许“保存版本”（不删除任何版本是本期策略）。
5. Playwright 用 API 预置建议（不依赖真实模型）；真实模型生成建议已在 R2a 验证。

### 未验证 / 已知限制

- 未做版本删除/压缩（明确不做）。
- 设计/交接包版本策略未动（R2c）。
- 并发重复点击“保存版本”正常递增，无幂等约束。
- `review` 状态文案仍沿用 R1 观察项（本轮未改）。
