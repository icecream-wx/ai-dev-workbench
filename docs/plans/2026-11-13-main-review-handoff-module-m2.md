# 主会话/评审接续单（2026-11-16，模块化 M2—M6 完成 → 真实 E2E）

用途：新开**主会话 + 评审会话**继续；文档是事实来源，不依赖旧聊天记录。
状态：**M2—M6 已完成并评审；真实模型全链路 E2E 已通过（2026-11-16）；M7 为非阻塞后续。**
原则：主会话负责设计/评审/交接单，不直接改代码；实施通过新会话；同一时间只一个会话改文件。

---

## 1. 当前基线

| 项 | 状态 |
| --- | --- |
| 后端测试 | ✅ **224/224**（`npm test --prefix backend`） |
| 前端测试 | ✅ **121/121**（`npm test --prefix frontend`） |
| 前端检查 | ✅ `typecheck` / `build` / `check:vue` |
| 冒烟 | ✅ `smoke:requirements` / `smoke:modules` / `smoke:change-set` / `smoke:design-handoff` / `smoke:dev-phases` / `smoke:design` |
| 真实工作台 | 3300 运行 M6 构建（含 MF-M6b-2 修复），opencode 4771 ready；`apps=0` |
| 真实数据 | `apps=0`；需求/设计/变更单/开发阶段模块化；模板保留（需求 4 / 原型 2）；无 `*_legacy` |
| 仓库 | 非 git；`projects/`、`data/`、`.env` 不提交 |
| 已完成 | U7-1/2/3、需求/原型修复、ER、start/stop、开发/需求 UX、#7、**#6 M2—M6** |

**政策（2026-11-13，用户确认，见 `AGENTS.md`）**：开发前期未定版，**大框架调整默认删除旧应用、不做数据迁移/兼容**；只有用户明确要求兼容时才迁移。app1 已删除，且其全部临时备份/截图/检查脚本也已清理（无 app1 数据残留）。

关键文档：

- #6 设计稿：`docs/plans/2026-11-13-module-requirements-design.md`
- M2：`docs/plans/2026-11-13-module-m2-implementation-brief.md`
- M3：`docs/plans/2026-11-13-module-m3-implementation-brief.md`
- M4：`docs/plans/2026-11-13-module-m4-implementation-brief.md`
- M5：`docs/plans/2026-11-16-module-m5-implementation-brief.md`
- M6：`docs/plans/2026-11-16-module-m6-implementation-brief.md`（M6a/M6b）
- 最新状态：`docs/STATUS.md`「M6a 完成」「M6b 完成」「政策」
- U7：`docs/plans/2026-11-12-u7-phased-development-design.md`

---

## 2. 已交付（M2—M6）

- **M2**：需求模块数据底座（`app_modules`/bundle/`module_id`/`moduleId` API/ID 全局唯一/测试隔离）。
- **M3**：需求模块 UI（rail/总览/应用级模板切换/按模块 chat/排序/确认/完成需求阶段）。
- **M4**：设计表与 UI 模块化（实体/页面集/页面/版本/确认/输入 stale/chat 按模块；跨模块 FK；应用级原型模板切换；无迁移空库升级）。
- **M5**：Change Set 模块选择（`app_change_set_modules`/只改选中模块/未选不动/取消按模块恢复+同事务 bundle/新增模块取消归档）；设计输入 v2（bundle 版本/hash、bundleDrift）；只读设计总览覆盖率；前端范围条/未选只读/历史模块行。
- **M6**：应用级交接包模块化（modules + 00—05/manifest/prototypes/规模；#1 写模块行；#2+ 按选中模块 diff、未选“未变更”；全部必选模块 confirmed/非 stale/PNG 门禁）；U7 模块+Epic 两层阶段（manifest phases/module columns/模块里程碑只读/Epic 会话与摘要/PhaseBar·PhaseDialog 分组/单模块平铺零回归）。
- **单模块旧行为**：C1、设计确认、交接包、开发会话、U7 单层阶段保持可用。

---

## 3. 已完成：真实模型全链路 E2E（2026-11-16）

结果：**31/31 断言通过**，临时应用已删除（apps=0），`projects/` 无残留；详见 `docs/STATUS.md`「真实模型全链路 E2E」。

| 项 | 实测 |
| --- | --- |
| 模型 | 真实 opencode 2.2.5 + `packycode-deepseek/deepseek-flash` |
| 需求 | 2 模块（库存/订单）真实模型 doc chat；A 8 Story、B 9 Story；确认 + bundle confirm |
| 设计 | 两模块 AI 实体 + 页面集；每页 PNG 存档；两模块设计确认 |
| 交接包 | large：8 场景 / 6 Epic / 17 Story / 7 实体 / 52 字段 / 13 关系 / 6 页面集 / 30 页面·PNG；模块结构/manifest/#1 模块行正确 |
| 开发 | 2 模块阶段 + 6 Epic；Epic 会话标题/brief 带模块；完成 1/3 后模块 `in_progress` |
| 变更 | 完成应用 → #2 只选 MOD-001 → 交接包 v2：A changed / B unchanged，05-CHANGES 含两模块 |
| 耗时 | 约 191s；需求 37/56s、设计实体 15/20s、页面集 33/28s |

下一步（由用户/后续会话决定）：

- 用户新建应用跑全程（当前 `apps=0`，可直接创建）。
- M7（#8 需求阶段确定性原型预览，模块 tab + #7 模板解析）为非阻塞后续；需要时另写交接单。
- 已记录的小观察：发起变更瞬间 DevView 在途轮询可能出现 1—2 次 `409 GET /development` 控制台资源错误（既有竞态，不影响功能），可在后续顺手修。

---

## 4. 验证命令

```powershell
npm run build --prefix backend
npm test --prefix backend
npm run smoke:requirements --prefix backend
npm run smoke:modules --prefix backend
npm run smoke:change-set --prefix backend
npm run smoke:design-handoff --prefix backend
npm run smoke:dev-phases --prefix backend
npm run smoke:design --prefix backend
npm test --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run check:vue --prefix frontend
```

基线：后端 224、前端 121。

启动/停止：`start.cmd` / `stop.cmd`（默认 3300 + opencode 4771）。E2E 如需独立 opencode，使用独立 `OPENCODE_PORT`，别占用 4771。

---

## 5. 新主会话开场提示（可直接粘贴）

> 在 `E:\work_space_primeton\ai-dev-workbench` 继续，作为主会话/评审。先读 `AGENTS.md`、`docs/STATUS.md`（M2—M6 完成 + 真实 E2E + 政策）、本接续单，再读 #6 设计稿与 M2—M6 交接单。
> 当前基线：后端 224/224、前端 121/121、冒烟全过（含 `smoke:dev-phases`）；真实库 apps=0；3300 运行 M6（含全部 must-fix），opencode 4771 ready；`projects/` 空。
> 已完成：#6 M2—M6（需求/设计/变更单/交接包/开发阶段全模块化）与真实模型全链路 E2E（2 模块/17 Story/30 页面/large/2 模块+6 Epic/单模块变更 v2，31/31 断言）；app1 及其所有临时备份/截图已删除。
> 本轮目标：等我指定下一批（当前无应用，也可先由我新建应用跑全程；M7 #8 预览为非阻塞后续）。不要主动开始 M7/修改核心实现，先给方案/交接单并等我确认。
> 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

---

## 6. 新实施会话开场提示（M7 或后续，可直接粘贴）

> 在 `E:\work_space_primeton\ai-dev-workbench` 继续。先读 `AGENTS.md`、`docs/STATUS.md`（M2—M6 完成 + 真实 E2E 结果）、本接续单、#6 设计稿与相关交接单。
> 只做用户指定的下一批（M7 #8 预览或修复项）；不做旧数据兼容；不启停/修改真实实例（除非主会话明确要求）；验证用临时 `RG_DATA_DIR`/`RG_PROJECTS_DIR`/端口。
> 完成后更新交接单/STATUS，回传测试数、Playwright/E2E、偏差与未验证项。
