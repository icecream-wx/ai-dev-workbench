# 打磨批 5 · B：开发视图真实模型复跑（2026-11-23）

> 证据：[`evidence/2026-11-23-dev-view-real-model/`](evidence/2026-11-23-dev-view-real-model/README.md)

## 范围

- 真实模型 `packycode-deepseek/deepseek-flash` + 真实 opencode 2.2.5；临时实例，不启停真实 3300/4771。
- 链路：自定义模板（草稿 → spec → 生成 → 发布 1.0.0）→ 新建应用 → 需求 + `design.json` fixture → 开发视图 agent 实现 → ui-check / 前端产物 / fidelity 13 项 / Playwright。
- 只允许临时目录/独立端口；不读写真实 `data/`/`projects/`/`.env`；不做 git；不改产品代码。

## 环境

| 项 | 值 |
| --- | --- |
| 临时根 | `%TEMP%\workbench-dev-real-D3YBPq`（保留供复核） |
| 端口 | 后端 3488 / opencode 4788（临时）；真实 3300/4771 未动（PID 39828/19608） |
| 模板 / 应用 | `goods-hub`（data-cyan，base=operations-management，2 页） / `p77-dev-real` |
| 会话 | `307af128-d591-458f-894c-8a879ec7c50e`（opencode `ses_df9a760c…`） |
| 模型 | `packycode-deepseek/deepseek-flash`（development stage 显式设置） |

## 结果

| 项 | 结果 |
| --- | --- |
| 模板生成/发布 | errors 0 / warnings 0；**1.0.0**；应用工作区 design-system/蓝图/契约/structure/styles/skill 齐全 |
| 开发会话 | **自动收尾**（succeeded，无需 interrupt）；**8m34s**；**74 消息 / 108 工具**（read 47、shell 29、edit 25、grep 4、write 3）；0 待处理权限 |
| 实现 | `frontend/src/views/goods/GoodsList.vue`（BusinessListPage/QueryPanel/RowActions/ThreePartPagination + pm-table + v-auto-height）、`GoodsForm.vue`（pm-form-dialog + FormSection + pm-*）、`router/index.js`（`/goods`）、`build/mfp.config.js` 暴露 `./goods-list`；两页均用 GlobalPreference |
| ui-check | **filled**（实现前/实现后/未实现与待确认） |
| fidelity | **13 项：pass 12 / warn 1 / fail 0**；唯一 warn = `prototypes`（未导出 PNG，fixture 未提供，预期） |
| Playwright | 开发视图状态「本轮完成」、13 张 fidelity 卡片、最终汇报可见；**0 console error / 0 pageerror / 0 请求失败 / 0 外部请求** |
| 权限/越界 | `permission.rejected` **0**；仓库 `backend/src`/`frontend/src`/`templates/**`、真实 `data/`、`projects/` 前后 hash **0 变化**；应用工作区仅预期文件变化 |
| 清理 | 3488/4788 无 LISTENING，临时 PID 消失；真实 3300/4771 PID/启动时间一致、健康检查 200 |

## 偏差

- 模型在应用工作区还修改了 `frontend/build/mfp.config.js`（暴露 `./goods-list`）与 `frontend/README.md`，属预期。
- 需求有“批量操作/批量选择”，`design.json` 未列 `batchActions`；模型按需求+模板默认补批量删除并在 ui-check/汇报中标注待确认（契约缺口，非阻断）。
- reference 页保留两栏结构与组件，但文案改为商品语义；检索由左栏移到表格上方 `QueryPanel`，未实现蓝图“导出台账”（模型已记录取舍）。
- 4 个失败工具均为工具/驱动侧：便携 shell 扫描器拒绝复杂单行 `node -e`、`edit` oldString 不匹配（已重试）、fidelity CLI 管道调用退出码 1（单独运行正常）。无权限拒绝。

## 未验证

- 应用前端未 `npm install` / 构建 / 启动，未做应用页面浏览器交互与截图（只做静态实现 + 一致性 CLI 自查）；Playwright 只验证工作台开发视图。
- 真实 AFCenter 宿主 `pm-*` 运行态、EOS 构建/运行、真实 401/403、应用 <768px 布局。
- **D2（PNG 像素级 diff）暂不做、`pm-sheet` 暂不动**（用户 2026-11-23 决定）。
- 未发现阻塞性产品 bug；本轮未改产品代码，因此不改测试/基线数字。
