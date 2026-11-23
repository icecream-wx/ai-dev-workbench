# 打磨批 5 · B：开发视图真实模型复跑（2026-11-23）

> 临时实例 + 真实 opencode 2.2.5 + 真实模型 `packycode-deepseek/deepseek-flash`，跑通
> **自定义模板（已发布）→ 新建应用 → 需求/design.json fixture → 开发视图真实 agent 实现 → ui-check / 前端产物 / fidelity 13 项 / Playwright 证据**。
> 未触碰真实 3300/4771 与真实 `data/`/`projects/`/`.env`；未执行 git；未改产品代码。

## 1. 环境

| 项 | 值 |
| --- | --- |
| 临时根 | `C:\Users\icecream\AppData\Local\Temp\workbench-dev-real-D3YBPq`（`fs.mkdtempSync`；保留供复核） |
| 后端 | `127.0.0.1:3488`（`node backend/dist/index.js`，PID 8，11:00 起） |
| opencode serve | `127.0.0.1:4788`（真实 2.2.5，PID 23512；`OPENCODE_AUTO_START=true`） |
| 模型 | `packycode-deepseek/deepseek-flash`（`GET /api/opencode/models` 命中；`PUT /apps/:id/model stage=development` 生效） |
| 自定义模板 | `goods-hub` /「商品管理模板」/ `data-cyan` / base `operations-management` |
| 应用 | `p77-dev-real` /「P77 开发视图真实模型」 |
| 开发会话 | `307af128-d591-458f-894c-8a879ec7c50e`（opencode `ses_df9a760c3ffeQPTWCqSezxPj9y`） |
| 时间 | 2026-11-23 10:59:13 启动 → 11:00:01 发 prompt → 11:08:35 收尾 → 11:09:44 清理 |
| 说明 | 真实 3300（PID 39828）/ 4771（PID 19608）前后一致、健康检查 200 |

## 2. 步骤与结果

| 步骤 | 结果 |
| --- | --- |
| 自定义模板 | 草稿 `POST /design-templates/drafts`（id=goods-hub）→ 写 fixture spec（reference `goods-list` 引用 `operations-management/list` + contract `goods-form` `dialog-form`）→ `POST .../generate` **errors 0 / warnings 0** → `POST .../publish` **1.0.0**；`GET /api/design-system` 可见 `templateKind=custom` |
| 新建应用 | `POST /api/apps` 选自定义 pack；工作区 `docs/design/design-system.json`（origin/preview/kind/contractFile）、reference 蓝图、`contracts/goods-form.json`、合并 `structure.css`、`styles/{shared,data-cyan}`、`adw-template-proto-goods-hub` skill 均存在 |
| fixture | `docs/requirements/MOD-001-商品管理.md`（frontmatter module/title/order/template）+ `docs/design/MOD-001/design.json`（2 页：list + dialog-form，实体/列/筛选/表单分组/控件映射与模板页一致）；无 brief/tokens/PNG |
| 模型 | `PUT /apps/p77-dev-real/model` `{stage:'development', model:{providerID:'packycode-deepseek', id:'deepseek-flash'}}`；会话记录 model 一致 |
| 开发会话 | `POST /development/session`（view=development, module=MOD-001）→ `POST /development/prompt`（1772 字符中文 prompt：先读 AGENTS/design-system/design.json/template/ui-check → 先填 ui-check「实现前」→ 用 PageTemplates + pm-* + GlobalPreference 实现列表与弹窗 → 挂路由 → 跑 `check-fidelity.mjs` 自查 → 中文汇报；禁止 npm install/build/git/改受管文件） |
| 收尾 | **自动收尾**（`succeeded`，连续 2 次稳定；无需 interrupt）；**514,242 ms ≈ 8m34s** |
| 统计 | **74 条消息** / **108 次工具**（read 47、shell 29、edit 25、grep 4、write 3）；2 个步骤；上下文 208,878 / 1,048,576（19.9%，ok）；tokens input 137,614 / output 26,967 / reasoning 52,975 / cacheRead 10,560,512 |
| 失败工具（4） | 见 §5；**0 次 `permission.rejected`**，0 次待处理权限/表单 |

## 3. 前端实现产物（应用工作区，非仓库）

| 文件 | 内容 |
| --- | --- |
| `frontend/src/views/goods/GoodsList.vue`（18.7 KB） | 商品列表：蓝图两栏台账结构（页头 + 左侧「商品概览/今日关注」+ 右侧明细），`BusinessListPage`、`QueryPanel`、`RowActions`、`ThreePartPagination`、`pm-table` + `v-auto-height`；列 `code/name/category/status/price/stock`，筛选 `name/status`，行 `edit/delete`，工具栏 `create`，three-part 每页 20；批量删除、删除末页回退、翻页/筛选清空选择；24 条标注演示数据 |
| `frontend/src/views/goods/GoodsForm.vue`（7.1 KB） | `pm-form-dialog` + `FormSection`：2 列、宽 `min(800px, 100vw - 32px)`；3 组 8 字段；控件按契约（pm-select/pm-number/pm-select-user/pm-textarea/pm-input）；备注 `pt-field-full`；code/name 必填 + code 唯一校验 |
| `frontend/src/router/index.js` | 注册 `/goods`（name `goods-list`）；弹窗由列表内打开，不单独占路由 |
| `frontend/build/mfp.config.js` | 追加 MF 暴露 `./goods-list` |
| `frontend/README.md` | 同步暴露入口/路由说明 |
| `docs/design/MOD-001/ui-check.md` | 增量填写「实现前」「实现后」「未实现/待确认」（保留骨架 marker） |

- 两页均导入 `GlobalPreference` 并在页面 computed 合并（未改全局单例）；根容器使用 `visual-style-data-cyan` 宿主风格类。
- `ui-check` 状态：**filled**（`POST /design-fidelity` 的 `ui-check` 项 pass：`MOD-001: 已填`；开发视图显示「已填」）。

## 4. fidelity 13 项（`POST /api/apps/p77-dev-real/design-fidelity` `{module:'MOD-001'}`）

**pass 12 / warn 1 / fail 0**（`summary.status=warn`）

| 检查 | 状态 | 证据 / warn 原因 |
| --- | --- | --- |
| 应用设计系统 | pass | `goods-hub v1.0.0 · goods-hub · data-cyan · 2 页蓝图` |
| 页面契约 | pass | 2 页均含 recipe 与 blueprint/catalogRef/契约文件 |
| 蓝图文件 | pass | 1 个蓝图存在；另 1 个契约页（无蓝图） |
| 实现视图/路由 | pass | 视图匹配 2/2；路由 2 条；`goods-list→GoodsList.vue`、`goods-form→GoodsForm.vue` |
| PageTemplates | pass | FormSection、BusinessListPage、QueryPanel、RowActions、ThreePartPagination |
| pm-* 组件 | pass | 9 个 |
| 表单弹窗/FormSection | pass | 表单页使用 pm-form-dialog/FormSection |
| 列表 v-auto-height | pass | 列表页使用 v-auto-height |
| GlobalPreference | pass | 已引用 views/goods/GoodsForm.vue |
| 结构/风格导入 | pass | 命中 2 文件（含 visual-style-*） |
| 模板契约页 | pass | 契约文件存在、recipe 一致 |
| ui-check 对照表 | pass | MOD-001: 已填 |
| **PNG 原型** | **warn** | `MOD-001: 未导出`；本模块未生成 `prototypes/_manifest.json`/PNG（fixture 未提供，属预期；不影响静态一致性结论） |

## 5. 失败工具与权限/越界

**权限拒绝：0**（`messages-summary.json#permissionRejections=[]`）。4 个失败工具均为**工具/驱动侧**，不是产品缺陷：

1. `shell node -e "<复杂单行脚本>"` → `error.type=unknown`，`Portable shell scanner cannot analyze command: invalid-structure`（opencode 便携 shell 扫描器限制；模型随后写临时脚本 `%TEMP%\opencode\check-vue-tags.cjs` 并成功自检）。
2. `edit frontend/src/views/goods/GoodsForm.vue` → `oldString` 不匹配（模型重试后成功）。
3. `shell ... check-fidelity.mjs --json 2>&1 | node -e ...` → 退出码 1（管道/JSON 解析为驱动式调用问题；单独运行 CLI 退出码 0）。
4. `shell ... check-fidelity.mjs ... | Select-Object -First 40` → 退出码 1（ PowerShell 提前关管道 EPIPE）。

**越界前后 hash（`hash-before.json` / `hash-after.json` / `hash-diff.json`）**：

| 范围 | 结果 |
| --- | --- |
| 仓库 `backend/src`（90）/ `frontend/src`（251）/ `templates/**`（210） | **0 added / 0 removed / 0 changed**（sha256 全部一致） |
| `frontend/dist`（97）/ `backend/dist`（182） | 0 变化（本轮未重建前端） |
| 真实 `data/`（122 项） | 元数据快照**无差异**（只读；未读写内容） |
| 真实 `projects/` | 指纹不变（28,968 文件 / 828,471,575 B，最大 mtime 不变） |
| 应用工作区 | 新增/修改仅 `frontend/src/views/goods/**`、`router/index.js`、`build/mfp.config.js`、`README.md`、`docs/design/MOD-001/ui-check.md`（预期） |
| 应用外写入 | 模型在 `%TEMP%\opencode\check-vue-tags.cjs` 写了一个临时自检脚本（不在仓库/模板/真实工作区） |

## 6. Playwright（开发视图）

- 打开 `/#/apps/p77-dev-real/development`，选择 `MOD-001`；状态「本轮完成」，ui-check「已填」，时间线 229,774 字符含工具卡与最终汇报；「检查一致性」点开后 13 张卡片（含 warn 说明）。
- **0 console error / 0 pageerror / 0 请求失败 / 0 外部请求**（`ui-audit.json`）。
- 截图（`screenshots/`）：`dev-view-window.png`、`dev-view-full.png`、`dev-timeline.png`、`dev-design-ref.png`、`dev-fidelity-report.png`、`dev-view-fidelity-full.png`。

## 7. 清理

- `POST /api/opencode/stop` + `taskkill /PID 8 /T /F`；3488/4788 **无 LISTENING**（仅 TIME_WAIT），临时 PID 8 / 23512 均不存在。
- 真实 3300（PID 39828，启动 09:10:41.929）与 4771（PID 19608，启动 09:10:42.417）**前后一致**；`/api/health` 200、`runtime.ready:true`。见 `cleanup-before.json` / `cleanup.json`。

## 8. 偏差、未验证与产品 bug

- **无阻塞性产品 bug**；未改产品代码（`backend/src`、`frontend/src`、`templates/**` 前后 hash 0 变化）。
- **未验证运行态**：按要求未执行 `npm install` / `npm run build` / dev server，应用前端**未编译、未启动、未做浏览器交互**（无应用页面截图）；模型也明确声明“不能声称视觉已还原”。本轮 Playwright 只验证**工作台开发视图**，不验证应用运行态。
- **契约缺口（非阻断）**：需求写“批量操作/批量选择”，`design.json` 未列 `batchActions`；模型按需求与模板默认能力补了批量删除并在 ui-check/汇报中标注待设计确认。另：检索由蓝图左栏移到表格上方 `QueryPanel`、未实现蓝图“导出台账”；reference 页文案改为商品语义（保留两栏结构与组件）。这些是模型记录在案的合理取舍。
- **PNG** 未导出 → `prototypes` warn（预期）。
- **未做（用户 2026-11-23 决定）**：**D2 PNG 像素级 diff 暂不做**；**`pm-sheet` 暂不动**。
- 未采集：真实 AFCenter 宿主 `pm-*` 运行态、EOS 构建、真实 401/403、<768px 应用页面布局。

## 9. 证据文件

| 文件 | 说明 |
| --- | --- |
| `driver.log` | 全量轮询时间线（3s；含收尾判定） |
| `polls.json` | 每次轮询快照（状态/消息/工具/失败/pending） |
| `messages-summary.json` | 脱敏后的统计、工具明细、permissionRejections、最终文本 |
| `final-message.md` | 模型中文汇报全文 |
| `design.json` / `design-system.json` / `design-system-pages.json` / `contracts-goods-form.json` | 应用设计 fixture 与受管设计系统/契约 |
| `ui-check.md` | 模型填写的对照表（实现前/实现后/未实现） |
| `fidelity.json` | 13 项只读报告（pass 12 / warn 1 / fail 0） |
| `implemented/**` | 实现的 GoodsList.vue / GoodsForm.vue / router / mfp.config.js / README / 需求文件副本 |
| `screenshots/**` | 开发视图、时间线、设计参考、fidelity 报告 |
| `hash-before.json` / `hash-after.json` / `hash-diff.json` | 仓库/真实 data/projects 前后指纹与差异 |
| `spec.json` / `generation.json` / `publish.json` / `pack.json` | 自定义模板 spec、生成、发布、pack |
| `env.json` / `session.json` / `model-set.json` / `prompt.md` | 环境、会话、模型、prompt 原文 |
| `ui-text.json` / `ui-audit.json` / `app-tree.txt` | 开发视图文本/审计、应用文件树 |
| `cleanup-before.json` / `cleanup.json` / `opencode-stop.json` | 清理前后端口/PID/健康检查 |
