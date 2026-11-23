# AFCenter 子应用前端骨架（MF remote）

本目录由工作台按 `templates/afc-remote/` 生成到 `projects/<app-id>/frontend/`，是可运行的 Module Federation remote 骨架：

- 运行时：Vue 3 + Element Plus + Vue Router；
- 构建：webpack 5 + Module Federation（`build/mfp.config.js`）；
- 暴露入口：`./index`（占位）与 `./goods-list`（MOD-001 商品管理，`src/views/goods/GoodsList.vue`）。

## 安装与运行

```bash
npm install          # 本目录内执行（宿主依赖已在本 package.json 声明）
npm run dev          # 开发服务器：http://localhost:4002/<app.name>/
npm run build:prod   # 产物：dist/<app.name>/（remoteEntry.js + index.html + assets/）
```

`setting.json` 的 `app.name` 是 remote 名称与产物目录名，由工作台在创建应用时写入；
`webpack.dev.port` 可改（避免与其它子应用/工作台 3300 冲突）。

## 宿主提供的能力（不要重复打包）

- `pm-*`（priston-form-components-v3）由 AFCenter 宿主全局注册；**不要在本工程重复注册/打包**；
- 登录态、菜单、路由基座、权限由宿主提供；
- `vue` / `vue-router` / `element-plus` 通过 Module Federation `shared` 共享。

## 页面从哪里来

1. 读 `AGENTS.md`、`docs/design/design-system.json`（应用类型/风格/页面库）；
2. 读 `docs/design/template/<applicationType>/pages/*.vue` 蓝图与 `structure.css`；
3. 读 `docs/design/template/styles/shared.css` 与选中风格的
   `docs/design/template/styles/<styleId>/style.css`（以 `design-system.json` 的 `styles` 为准）；
4. 先填 `docs/design/<MOD>/ui-check.md` 的对照表（软门禁，不阻断），再把蓝图复制到
   `src/views/`，保留结构/样式/组件，替换 mock/接口；
5. 优先使用 `src/components/PageTemplates/` 的模板与宿主 `pm-*` 组件，偏好统一读
   `src/preferences/GlobalPreference.js`；
6. 把新页面挂到 `src/router/index.js`，需要给宿主单独消费时在 `build/mfp.config.js`
   的 `exposes` 追加。

## 开发规范（模板与本项目一致）

- 列表/树/表单优先用 PageTemplates：
  `BusinessListPage / TreeListPage / StandardFormPage / FormSection / QueryPanel / RowActions / ThreePartPagination`；
- 新增/编辑默认 `pm-form-dialog`；`el-table` 统一 `v-auto-height`；业务字段 > 8 用双列；
  批量操作放 `batch-actions`；树节点菜单用 `MoreFilled`；
- 统一导入 `GlobalPreference`，预设只在页面 computed 合并；
- 禁止手写一套表格/表单/样式替代 PageTemplates/pm-*；缺少宿主组件时停下说明，不自造。

蓝图/预览是视觉与结构基准；`prototypes/*.png` 是模板风格截图（无显式契约的旧设计为线框）。与需求或 `design.json` 冲突时
先上报并说明，不要静默偏离；偏离写进 `ui-check.md` 与完成汇报。EOS 后端不吃风格。

## 目录

```text
build/                  webpack + Module Federation 配置
public/index_app.html   独立 dev 的 HTML 模板
src/main.js             入口（异步加载 bootstrap）
src/bootstrap.js        创建 Vue 应用
src/App.vue             <router-view />
src/router/index.js     路由（占位入口 + MOD-001 `/goods`）
src/views/AppIndex.vue  占位入口（remote 暴露 ./index）
src/components/PageTemplates/  团队页面模板（来自 afcenter-page-generation）
src/preferences/GlobalPreference.js  应用级偏好单例
static/                 随包静态资源
```

页面模板与样式是团队资产，直接升级时以 `afcenter-page-generation` skill 的
`assets/PageTemplates/` 为准；不要只改这里而忘记同步 skill。
