# P7-3a 实施单：全量预览宿主（25 页 × 4 风格）（2026-11-19）

> 上游：`2026-11-19-design-template-and-dev-linkage-p7-design.md`、P7-2 spike、P7-1 pack。
> 本轮只做 **P7-3a**：把 `templates/design-system/afcenter-app-templates-v1/` 的 25 页、4 风格全部接入工作台 `preview.html`，支持 `?type=&style=&page=`、后端静态托管、修 `pm-tree` 高亮、补齐组件依赖。
> **不做**：设计模板中心 UI（P7-3b）、新建应用/设计视图集成（P7-3b）、design.json 契约（P7-4）、MF remote/蓝图分发（P7-5）、自定义 builder（P7-7）。

---

## 0. 出口标准

1. `preview.html?type=<applicationType>&style=<styleId>&page=<pageId>` 可渲染 4 个应用类型的 25 个页面。
2. 4 套视觉风格可切换（platform-blue / classic-warm / data-cyan / high-contrast-tool），布局与颜色即时变化。
3. 预览不依赖 AFCenter 宿主：pm-v3 子集 + mock 数据 + 本地样式。
4. 后端 `npm start` 后可直接访问 `/preview.html` 及其 assets（不只是 Vite dev）。
5. `pm-tree` 当前根节点下所有文字变蓝的问题修复（模板层覆盖或组件内改）。
6. 现有 frontend 59/59、backend 100/100、build/typecheck/check:vue 全绿。
7. 代表页面 Playwright：无 console error、无外部请求；至少覆盖 4 个应用类型 + 4 种风格。

---

## 1. 页面与风格接入

来源（已存在）：

```text
templates/design-system/afcenter-app-templates-v1/
  application-types/<type>/structure.css
  application-types/<type>/pages/*.vue
  styles/shared.css
  styles/<style>/style.css
```

实现建议：

- 在 `frontend/src/preview/templates/` 下复制 4 个应用类型页面 + structure.css，以及 4 套 style.css + shared.css；保持与 pack 同名，便于后续对照。
- 生成静态 registry：`type/pageId → () => import(...)`，用 `defineAsyncComponent` 或路由动态组件。
- `PreviewApp.vue` 读取 `?type=&style=&page=`：
  - 缺省：`enterprise-application-platform / platform-blue / organization`；
  - 校验 type/style/page；非法值回退默认并显示提示（不白屏）；
  - 应用 `visual-style-<style>` 类和对应 structure.css；切换风格不重建页面（避免丢状态）。
- 页面标题/面包屑可选；在 iframe 内不显示工作台壳。
- 预览角标保留“mock 数据”。

## 2. pm-v3 组件补齐

- 扫描 25 页实际 `<pm-*>` 标签，补齐未复制的组件 + 共享 composables/utils/i18n。
- 先按页面增量复制；不要整库搬运。
- 重组件按需：
  - `pm-echarts`（echarts）
  - `pm-richtext`（tinymce / @tinymce/tinymce-vue）
  - `pm-sheet`（luckyexcel）
  - `pm-ocr` / `pm-upload` / `pm-image` / `pm-calendar` 等按实际页面需要
- 如某重组件暂时无法接入：页面该区域用“预览占位（组件未接入）”并记录，不得伪造。
- 依赖安装在 `frontend/` 内；不要用 `npm install --prefix`；根 `package.json` 不动。
- `pm-select` 家族如仍静态导入过大，可在本阶段改为按需动态 import；不改业务语义。

## 3. 平台数据 mock

- 继续使用 `frontend/src/design-system/pm-v3/mock/`：
  - dict / user / org / position / entity 常见查询；
  - `Controllers` 与 `window.globalConfig.dispatchProxy`；
  - 上传/图片/OCR 用本地占位；
  - 不连接真实平台/后端。
- 25 页的 mock 数据要能展示表格、树、表单、看板、图表、日历等；不要求业务正确，但不能空白。

## 4. 后端静态托管

- `backend/src/index.ts` 当前 catch-all 只放行 `index.html`；增加：
  - `/preview.html` 返回 `frontend/dist/preview.html`；
  - `/assets/*` 已由静态中间件处理则确认；
  - `/preview.html` 不存在时回退 404 或清晰提示（不返回 index.html）。
- 不改 API 路由；不启停真实 3300。

## 5. pm-tree 修复

- 问题：上游 `.el-tree-node.is-current .pm-tree__node--custom` 为后代选择器，当前根节点下所有后代节点文字变蓝。
- 在 preview 的模板层样式覆盖为直接子节点/正确节点选择器；或修改复制组件中的选择器。
- 验证：仅当前节点高亮，子节点不染色；切换节点正常。

## 6. 验证

| 命令 | 要求 |
| --- | --- |
| `npm run build --prefix frontend` | 通过；`dist/preview.html` 存在 |
| `npm run typecheck --prefix frontend` | 通过 |
| `npm test --prefix frontend` | 59/59 |
| `npm run check:vue --prefix frontend` | 通过 |
| `npm run build --prefix backend` | 通过 |
| `npm test --prefix backend` | 100/100 |
| `npm run smoke:workspace --prefix backend` | 通过（临时目录/端口） |

Playwright（临时端口，不占 3300）：

- 4 个应用类型各至少 1 页：organization、OperationsList、DataTaskList、IncidentList；
- 4 种风格切换各至少 1 次；
- 检查标题、关键区块、表格/树/表单可见；
- console error/pageerror = 0；外部请求 = 0；
- 截图保存到 `C:\Users\icecream\AppData\Local\Temp\opencode\p7-3a-*.png`。

## 7. 收尾

- 更新 P7 设计稿的 P7-3a 实施记录（结果/偏差/未验证）。
- 更新 `docs/STATUS.md`（P7-3a 完成；P7-3b 未完成）。
- 回报：页面/风格覆盖清单、组件/依赖增量、构建体积、Playwright 结果、未接入重组件、环境确认。
- 不做 git；不读写真实 data/projects/.env；不调真实模型。
