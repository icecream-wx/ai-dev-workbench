# R4c 收尾实施交接单

日期：2026-11-11
用途：**新开实施会话**使用；主会话负责设计/评审。
状态：**已完成（2026-11-11，实施会话）**；实施结果见 §8，主会话评审结论待补。
上游：`docs/STATUS.md`（R4b-2 评审、R4 讨论）、`AGENTS.md`。
范围：**R4c**——MySQL demo 清理 SQL（用户自己执行，不连接数据库）、依赖清理、最终文档收尾与验证。**不做**视觉/响应式/深浅色打磨（单独一轮）、I-09b。

---

## 1. 已确认决策

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | MySQL demo 行 | **A：只生成 SQL，用户自己执行；工作台不连接数据库**。 |
| 2 | 依赖清理 | 随 R4c 做（移除未使用依赖、同步 lock）。 |
| 3 | 视觉打磨 | 单独一轮，不在 R4c。 |

---

## 2. MySQL 清理 SQL（已生成，核对即可）

`docs/ops/cleanup-demo.sql` 已由主会话生成，内容：

- 预览 `quarterly_reporting_date` / `quarterly_reporting_business_atm` 中 `id LIKE '%-demo-%'` 的行；
- `START TRANSACTION` 后先删 ATM 再删 date，`COMMIT`（可 `ROLLBACK`）；
- 表/列名来自备份的 DAO（`id`、`quarterly_reporting_date.year/quarter`、`...business_atm.dateId`）；
- 不含凭据。

本轮只核对 SQL 正确性/无凭据；**不要连接 MySQL、不要执行 SQL**。

---

## 3. 依赖清理

1. `frontend/package.json` 移除未使用的 `@element-plus/icons-vue`（代码无 import）。
2. `backend/package.json`、`frontend/package.json` 移除未使用的 `"ai-dev-workbench": "file:.."`（代码无 import；根 package 仅提供脚本/concurrently）。
3. 在 `backend`、`frontend` 分别 `npm install` 更新 `package-lock.json`；确认没有 peer/engine 新增错误（`@vueuse/core` 的 Node>=22 警告为既有）。
4. 不移除 `concurrently`（根 devDependency，`npm run dev` 使用）。

## 4. 文档收尾

- `README.md`：
  - 确认只描述 doc/design/dev 单模式；删除/改写已不存在的 structured/legacy 描述；
  - 启动方式、目录结构、测试/冒烟命令与当前一致；
  - 增加 `docs/ops/cleanup-demo.sql` 说明（仅用户手动执行；备份 zip 含配置，用后建议删除）。
- `AGENTS.md`：确认“已明确方向/工程边界”无 stale structured 引用（历史说明可保留）；更新“后续”列表为：视觉/响应式/深浅色打磨（单独一轮）、I-09b（分阶段，后续评估）、Nacos/Redis/license、真实 401/403、真实模型需求/设计重跑（需新建应用）。
- `docs/STATUS.md`：
  - 新增「R4c 完成」；摘要表/总状态；
  - 写明最终本地状态：`apps` 空、`projects/` 空、旧表已删、`data/requirements.db` 保留空 schema；
  - 未验证/遗留：视觉打磨、I-09b、Nacos/Redis/license、真实 401/403、真实模型需求/设计重跑；MySQL demo 需用户执行 SQL；
  - 备份 zip 路径与“含配置、用后删除”提示。
- `docs/plans/2026-11-11-main-review-handoff.md`：下一步视觉打磨/I-09b。
- 旧 P3/P5 计划标注历史（若尚未）；不删除历史文档。

## 5. 验证

- `npm install --prefix backend` / `--prefix frontend` 成功；`package-lock` 更新。
- `npm run build --prefix backend`、`npm test --prefix backend`（113/113 基线）。
- `npm test --prefix frontend`、`npm run typecheck --prefix frontend`、`npm run build --prefix frontend`、`node check-vue-imports.cjs`。
- 根 `npm run build` 通过。
- 回归：`smoke:requirements`、`smoke:design-handoff`（至少两支）；依赖改动如影响再补。
- 校验：`projects/` 空、`data/workbench.pid` 不存在、`data/requirements.db` `apps` 空；仓库无凭据（`docs/ops/cleanup-demo.sql` 仅表名/LIKE）。
- 不启动 MySQL、不执行 cleanup SQL。

## 6. 不做

- 不做视觉/响应式/深浅色打磨。
- 不做 I-09b。
- 不重新生成真实模型需求/设计（旧应用已删；需新建应用）。
- 不读取/打印/提交真实密码；`projects/`、`data/`、`.env` 不提交。

## 7. 文档/回传

更新 `docs/STATUS.md`、本交接单状态与实施结果、`AGENTS.md`、`README.md`、`docs/plans/2026-11-11-main-review-handoff.md`。

回传：依赖移除/lock 结果、验证命令/结果、最终本地状态、偏差、遗留项（视觉打磨/I-09b/MySQL SQL 待用户执行）。

---

## 8. 实施结果（2026-11-11，实施会话）

### 8.1 MySQL 清理 SQL（只核对，未连接/未执行）

- 核对 `docs/ops/cleanup-demo.sql`：两张表名/列名与备份 DAO 命名一致（`quarterly_reporting_date(id, year, quarter)`、`quarterly_reporting_business_atm(id, dateId)`），先 ATM 后 date、事务内可 `ROLLBACK`、预览段可先单独跑；无凭据（只有表名与 `LIKE '%-demo-%'`）。
- **未连接 MySQL、未执行任何 SQL**；表/列是否与真实 schema 完全一致需用户在执行前用预览段确认。

### 8.2 依赖移除与 lock

| 项 | 结果 |
| --- | --- |
| `frontend/package.json` `@element-plus/icons-vue` | 已移除（代码无 import）；仍作为 `element-plus@2.14.7` 的传递依赖安装（`npm ls` 显示 `element-plus └── @element-plus/icons-vue@2.3.2`），运行时不受影响 |
| `backend/package.json`、`frontend/package.json` `ai-dev-workbench: file:..` | 已移除（package.json + `package-lock.json` 的 `packages[""]`/`node_modules/ai-dev-workbench` 条目 + `node_modules` junction） |
| 根 `concurrently` | 保留 |
| lock 变化 | backend 129 → 127 包（`found 0 vulnerabilities`）；frontend 97 → 95 包（`3 moderate` 为既有 dev 依赖 `vue-tsc → @vue/language-core → minimatch`，修复需 `vue-tsc@3` 破坏性升级，未处理） |
| engine/peer | 仅既有 `@vueuse/core|metadata|shared@15.0.0` 的 Node>=22 警告（本机 Node 20.20.1）；无新增 peer/engine 错误 |

**发现的 npm 行为（偏差，需评审知悉）**：本机 npm 10.8.2 下，在仓库根执行 `npm install --prefix backend|frontend` 会把**当前目录的包**当作安装目标写进目标包：`package.json` 被加回 `"ai-dev-workbench": "file:.."`（或绝对 `file:E:/...`）并创建 `node_modules/ai-dev-workbench` junction。已用独立 `C:\...\r4c-probe` 空包复现：从仓库根 `npm install --prefix <probe>` 会写入 `file:E:/work_space_primeton/ai-dev-workbench`；在 probe 内直接 `npm install` 则保持干净。该行为正是这两个 "未使用自引用依赖" 的来源。为避免每次安装又把依赖加回，安装命令改为**在各自目录内执行**：

- 根 `package.json`：`install:all` → `cd backend && npm install && cd ../frontend && npm install`；
- `start.cmd`：`pushd "%ROOT%\backend"` + `call npm install` + `popd`（frontend 同）；
- `start.sh`：`( cd "$target" && npm ci|install --include=dev )`。

验证：`npm run install:all` 退出码 0，执行后 backend/frontend 的 `package.json` 无 `file:..`、无 junction。`npm run build` / `npm test` 等 `--prefix` 用法不受影响（只有 `install` 触发）。

### 8.3 验证（命令/结果）

| 检查 | 结果 |
| --- | --- |
| `npm run build --prefix backend` | ✅ `tsc` 通过 |
| `npm test --prefix backend` | ✅ 113/113 |
| `npm test --prefix frontend` | ✅ 63/63 |
| `npm run typecheck --prefix frontend` | ✅ 通过 |
| `npm run build --prefix frontend` | ✅ 1832 modules，`index-*.js` 647.10 kB、`element-plus-*.js` 1025.09 kB（与 R4b-2 一致） |
| `node check-vue-imports.cjs` | ✅ 全部 SFC 导入完整 |
| 根 `npm run build` | ✅ 退出码 0 |
| `npm run smoke:requirements` | ✅ 模板/文档/v1—v10 版本/AI 预览与忽略/模板保护/确认需求/删除应用 |
| `npm run smoke:design-handoff` | ✅ 需求→设计→预览→生成 v1（Change Set #1）→读取→重生成 v2→PNG 缺失阻塞→完成→删除 |
| `npm install --loglevel=error`（各自目录） | ✅ 退出码 0；无新增警告 |

### 8.4 最终本地状态

| 项 | 结果 |
| --- | --- |
| `projects/` | 空（0 项） |
| `data/workbench.pid` | 不存在；无 node 进程监听 3300/4771 |
| `data/requirements.db` | `apps` 0 行；`app_*`/`design_handoffs` 全部 0 行；无 `modules`/`module_docs`/`handoffs` 旧表；仅内置模板（`requirement_templates` 4、`prototype_templates` 2） |
| 运行时残留 | `data/opencode-serve-4771.json`（2026-11-10 的旧 serve pid 记录，进程已不在；启动时会按 pid 清理）——未改动 `data/` |
| 凭据 | 仓库内仅占位符/测试夹具（`s3&cret`、`real-secret` 等 test 变量）与 `{{DB_HOST}}` 占位；`docs/ops/cleanup-demo.sql` 无凭据；`projects/`、`data/`、`.env` 未提交 |
| 备份 zip | `C:\Users\icecream\AppData\Local\Temp\opencode\r4b2-backup-20261111-155329\projects.zip`（951,520 字节）仍存在；**含应用配置，用后建议删除**（本轮未解压/未打印） |
| 仓库根遗留 zip | `ai-dev-workbench.zip`（19,759,156 字节，2026-11-10 11:23）是 R4a/R4b 之前的整仓快照（含 `legacy/`、`data/requirements.db`；**无** `projects/`/`.env`；只读文件名核对，未解压）；未被 `.gitignore` 覆盖，建议用户删除/移出仓库，本轮未动 |

### 8.5 偏差 / 遗留

1. **安装脚本改动**（见 8.2）：为保持依赖移除不被 `npm install --prefix` 回填，改了根 `install:all`、`start.cmd`、`start.sh` 的安装方式；行为不变（仍是缺依赖时安装 + 构建 + 启动），需要评审确认可接受。
2. **`@element-plus/icons-vue` 仍会安装**：作为 `element-plus` 的传递依赖存在，删掉的只是直接依赖声明。
3. **MySQL demo 行仍存在**：`docs/ops/cleanup-demo.sql` 待用户自行连接数据库执行；工作台/本轮会话未连接、未执行。
4. **前端 3 个 moderate 审计告警**：既有 dev 依赖（`vue-tsc` → `minimatch`），修复需破坏性升级，未在 R4c 处理。
5. 未做：视觉/响应式/深浅色打磨、I-09b、真实模型需求/设计重跑、Nacos/Redis/license、真实 401/403。

