# P7-6a 实施单：设计一致性检查（脚本/命令/API/开发视图）（2026-11-19）

> 上游：P7-5b 开发链路、P7-4a 页面契约、`2026-11-19-design-template-and-dev-linkage-p7-design.md` 第 7.4 节。
> 本轮只做 **P7-6a**：静态一致性检查（脚本 + command + API + 开发视图按钮/报告）。
> **不做**：真实模型 E2E（P7-6b，需用户授权）、截图自动像素比对、自定义 builder。
> 只报告，不做硬门禁。

---

## 0. 出口标准

1. 新增一致性检查脚本（可独立在应用目录跑）：
   - 输入：应用根目录、可选 module；
   - 读取 `docs/design/design-system.json`、`docs/design/<MOD>/design.json`、`docs/design/template/`、`frontend/src/`、`ui-check.md`；
   - 检查：页面/蓝图覆盖、路由/视图文件（启发式）、PageTemplates 导入、`pm-*` 使用、`pm-form-dialog`、`v-auto-height`、GlobalPreference、structure/style/visual-style 导入、ui-check 状态、PNG stale；
   - 输出 JSON + 人类可读摘要；`ok`/`warnings`/`errors`，不阻断（exit 0）。
2. 新增 command `check-design-fidelity`：指导 agent 运行脚本并按结果汇报/修复。
3. 后端 API：`POST /api/apps/:id/design-fidelity`（body module 可选）返回报告；无应用/无设计 4xx/空报告不 500。
4. 开发视图：新增「检查一致性」按钮 + 只读报告面板（通过/警告/失败、缺失页面/组件/文件、ui-check 状态）；不阻断。
5. 测试：脚本 fixture、API、前端报告渲染/交互；现有 115/83、e2e 基线保持。
6. 不做真实模型/截图像素比对；不启停真实 3300；不读写真实 data/projects/.env；不 git。

---

## 1. 脚本

新增 `templates/agent/skills/adw-frontend-implementation/scripts/check-fidelity.mjs`：

- 参数：`--app <dir>`（默认 cwd）、`--module <MOD-xxx>`（可选）。
- 读取：
  - `docs/design/design-system.json`（pack/type/style/blueprintRoot/pages）；
  - `docs/design/<MOD>/design.json`（pages 契约）；
  - `docs/design/template/`（蓝图/structure/style）；
  - `frontend/src/`（views/routes/components/imports）；
  - `docs/design/<MOD>/ui-check.md`。
- 检查项（报告 `id/label/status: pass|warn|fail/evidence`）：
  1. designSystem 存在/合法；
  2. 页面契约字段（recipe/catalogRef/blueprint）覆盖；
  3. blueprint 文件存在；
  4. 实现视图文件/路由（按 blueprint 文件名、页面 id/name 做启发式匹配；无法判断给 warn 并列出候选）；
  5. PageTemplates 导入（BusinessListPage/TreeListPage/StandardFormPage/FormSection/QueryPanel/RowActions/ThreePartPagination）；
  6. `pm-*` 使用（统计标签；无 pm 给 warn）；
  7. 表单页 `pm-form-dialog`/FormSection；
  8. 列表 `v-auto-height`；
  9. GlobalPreference 导入/使用；
  10. structure/style/visual-style 导入；
  11. ui-check 存在/已填；
  12. prototypes stale。
- 输出：
  - stdout JSON（机器）；
  - `--json` 仅 JSON；默认先打印人类摘要再 JSON（或分离）。
- 退出码：默认 0（只报告）；`--strict` 时可 1（本期不默认）。
- 不引入依赖（Node fs/path）。

## 2. Command

新增 `templates/agent/commands/check-design-fidelity.md`：

- 运行 `node .opencode/skills/adw-frontend-implementation/scripts/check-fidelity.mjs --app . --module <当前模块>`；
- 汇总 pass/warn/fail；对 fail/warn 给出具体修复建议（页面/组件/导入/ui-check/PNG）；
- 只报告，不阻断；不修改代码（除非用户要求修复）。

## 3. 后端 API

新增 `backend/src/dev/fidelity.ts` + route：

- `POST /api/apps/:id/design-fidelity` body `{ module?: string }`：
  - 校验应用/目录；无设计返回 `{ ok: true, empty: true, reason }` 或 404（明确）；
  - 运行检查（建议在 TS 实现同一套规则，或调用脚本；避免重复逻辑可抽共享）；
  - 返回 `{ ok, generatedAt, module, designSystem, checks: [...], summary }`；
  - 不抛 500；文件缺失给 warn。
- 可选 `GET /api/apps/:id/design-fidelity?module=` 只读缓存？本期 POST 足够。

## 4. 开发视图

`frontend/src/dev/DevView.vue`：

- 设计参考面板增加「检查一致性」按钮；调用 API；显示：
  - 总体状态（通过/有警告/有失败）；
  - 检查项列表（label/status/evidence）；
  - ui-check/PNG stale 状态；
  - 失败/警告的建议文本。
- 只读，不自动改代码；不影响会话/时间线。
- 纯函数/渲染测试 + e2e。

## 5. 测试

- 脚本：
  - fixture 应用（design-system/design.json/blueprint/frontend）覆盖 pass/warn/fail；
  - 缺设计/缺 frontend/缺 ui-check；
  - `--module` 过滤。
- 后端：
  - API 正常/无应用/无设计/模块非法；
  - 检查项内容抽样。
- 前端：
  - 报告渲染/状态映射纯函数；
  - e2e 点击按钮、报告可见、0 console error。
- 回归：115/83、e2e:preview 77、e2e:p7-3b 45、e2e:p2/p3/p4 116/126/128。

## 6. 边界

- 不改需求模板中心/需求 skill/DB 表；不改 P7-3a/b 预览/模板中心；不做真实模型/截图像素比对；不启停真实 3300；不读写真实 data/projects/.env；不 git；不调模型。

## 7. 收尾

- 更新 P7 设计稿 P7-6a 实施记录与 docs/STATUS.md。
- 回报：脚本/command/API/UI、检查项、测试结果、偏差、未验证项、环境确认。

---

## 8. 实施结果（2026-11-19）

- 脚本/规则：`templates/agent/skills/adw-frontend-implementation/scripts/lib/fidelity-core.cjs`（共享规则）+ `scripts/check-fidelity.mjs`（CLI：`--app/--module/--json/--strict`；默认 exit 0）。
- Command：`templates/agent/commands/check-design-fidelity.md`（command 4 → 5）。
- API：`backend/src/dev/fidelity.ts` + `POST /api/apps/:id/design-fidelity`；无应用 404、目录缺失 409、模块非法 400、无设计 200 `empty`，不 500。
- UI：`DevView.vue` 设计参考「检查一致性」+ 只读报告；类型/API/纯函数与测试同步。
- 测试：后端 **123/123**、前端 **85/85**、`build`/`typecheck`/`check:vue`、`smoke:workspace`、`smoke:assets`（5 command）、`e2e:p7-6a` **15**、`e2e:preview` **77**、`e2e:p7-3b` **45**、`e2e:p2/p3/p4` **116/126/128** 全部通过。
- 偏差/未验证：实现/路由为启发式；PNG 仅 designHash 判断；未做真实模型 P7-6b、截图自动像素比对、生成物 install/build、真实 AFCenter/EOS/3300；未读写真实 `data/`、`projects/`、`.env`；未 git、未调模型。
