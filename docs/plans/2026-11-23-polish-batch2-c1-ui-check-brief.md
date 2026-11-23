# 打磨批 2 · C1：ui-check 文案/状态区分（2026-11-23）

> 状态：**已实施（待评审）**。纯文案/状态区分，不改行为语义。

## 目的

开发视图「流程未完成」提示与一致性检查 hint 此前对 `missing` / `skeleton` 使用同一句话，用户看不出“还没生成”与“已生成但没填”的区别，也不知道下一步该做什么。C1 只做文案与状态区分。

## 范围

- 只改：前端 `design-ref.js` / `DevView.vue` / 前端单测、`fidelity-core.cjs` 的 ui-check hint、后端 `fidelity.test.ts`、`p4-e2e.ts` / `fidelity-e2e.ts` 断言、相关文档。
- 不改：DB/表/API 语义、依赖、`ui-check.ts` 生成与状态判定、digest `ui-check：已生成未填` 口径、`uiCheckLabel` 短文案、其它 fidelity 检查项；不新增“生成对照表”按钮/API（C3 未做）。

## 改动

1. **前端** `frontend/src/dev/design-ref.js`
   - 新增导出 `uiCheckHint(status)`：
     - `missing`：`未生成：在开发视图选中模块并发送首条开发消息后自动生成；实现前先填。`
     - `skeleton`：`已生成未填：先填「实现前」对照表再写代码；未填不阻断。`
     - `filled` / 其它：`''`。
   - `uiCheckLabel` / `uiCheckTone` 保持不变。
2. **前端** `frontend/src/dev/DevView.vue`
   - `dev-ui-check-pending` 文案改为 `{{ uiCheckHint(uiCheckStatus) }}`；保留 testid、`muted warn` 样式与 `uiCheckFlowPending` 显示条件。
3. **后端 fidelity** `templates/agent/skills/adw-frontend-implementation/scripts/lib/fidelity-core.cjs`
   - `uiCheckCheck` 仍 `status:'warn'`、仍 13 项、`evidence` 仍列各模块状态（未生成/已生成未填/已填）。
   - hint 按情况区分：
     - 仅 missing：`未生成：打开开发视图选择模块并发送首条开发消息会自动生成骨架；实现前先填。`
     - 仅 skeleton：`已生成未填：先填 docs/design/<MOD>/ui-check.md 的「实现前」表再写代码；未填不阻断。`
     - 两者都有：两段合并，二者都覆盖。
4. **单测**
   - `frontend/src/dev/design-ref.test.mjs`：新增 `uiCheckHint` missing/skeleton/filled/空值断言，保留 `uiCheckLabel` 断言。
   - `backend/src/dev/fidelity.test.ts`：warn 用例断言 missing hint 含“自动生成”；新增 1 条覆盖 skeleton-only 与混合 hint 差异、evidence 状态列表、仍 13 项；不降低既有检查项/退出码断言。
5. **e2e 断言（只加断言，不改业务）**
   - `backend/scripts/p4-e2e.ts`：初始“未生成”处断言 `dev-ui-check-pending` 含“自动生成”；开发 prompt 后“已生成未填”处断言含“实现前”。**128→130**。
   - `backend/scripts/fidelity-e2e.ts`：ui-check 缺失报告处断言 hint/文本含“自动生成”或“未生成”。**18→19**。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npm test --prefix frontend` | **183/183**（原 182，+1） |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm run build --prefix frontend` | 成功 |
| `npm run check:vue --prefix frontend` | 通过（全部 SFC 导入完整） |
| `npm test --prefix backend`（临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`） | **231/231**（原 230，+1） |
| `tsc -p backend/tsconfig.json --noEmit` | 通过 |
| `npm run build --prefix backend` | 成功 |
| `npm run e2e:p4 --prefix backend` | **130** |
| `npm run e2e:p7-6a --prefix backend` | **19** |
| `npm run e2e:p7-7c --prefix backend` | **108**（未变） |
| `npm run smoke:workspace --prefix backend` | 通过 |

e2e 全部使用临时目录/独立端口/stub opencode；结束核对 3400—3500 / 4400—4500 无残留监听，未触碰真实 3300/4771。

## 偏差 / 未验证

- 真实 3300/4771 未启停；新文案需用户 `restart.cmd` / `restart.sh` 后人工查看。
- 未跑 `e2e:p2` / `e2e:p3`（未改相关路径）。
- `ui-check.md` 仍由开发 prompt 在模块明确时自动生成，没有显式“生成”按钮（C3 未做）；本次只改提示文案与 fidelity hint。
- 未改 DB/API/依赖，未调模型，未读写真实 `data/`/`projects/`/`.env`，未做任何 git 操作。
