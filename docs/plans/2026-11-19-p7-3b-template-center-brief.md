# P7-3b 实施单：设计模板中心 UI + 新建应用/设计视图集成（2026-11-19）

> 上游：P7-1 pack/API、P7-2/P7-3a 预览宿主、`2026-11-19-design-template-and-dev-linkage-p7-design.md`。
> 本轮只做 **P7-3b**：设计模板中心 UI（应用类型 × 视觉风格 + 页面库 + iframe 预览）、新建应用选择设计模板、设计视图徽标/入口。
> **不做**：design.json 页面契约（P7-4）、MF remote/蓝图分发/开发 prompt（P7-5）、自定义 builder（P7-7）。
> **需求模板中心保持不变**：`TemplateLibraryDialog`、`requirement_templates`、`adw-template-req-*`、模块 frontmatter `template` 均不改。

---

## 0. 出口标准

1. 首页出现「设计模板」入口（与「模板库」并列；「模板库」仍是需求模板中心）。
2. 设计模板中心：
   - 4 个应用类型卡片（分类/搜索/页面数/组件数/CSS 缩略图）；
   - 进入详情：4 个视觉风格切换 + 页面集卡片；
   - 点击页面：iframe 加载 `/preview.html?type=&style=&page=`；
   - 「使用此模板」返回选择（picker 模式）；
   - 自定义模板卡片显示“即将支持”（预留）。
3. 新建应用：
   - 「需求模板」下拉**保持原样**；
   - 「设计原型模板」改为「设计模板」：显示应用类型 + 风格摘要，可打开模板中心选择；
   - 创建应用时传 `designPack/designApplicationType/designStyle`，后端已支持。
4. 设计视图：
   - 徽标显示应用类型 + 视觉风格（新应用）；旧应用仍显示旧原型模板；
   - 提供「模板页面库」入口（打开模板中心浏览模式），不改动现有 design.json 渲染/导出。
5. 现有测试/构建全绿；新增 UI 的 Playwright 证据。

---

## 1. 设计模板中心

新增 `frontend/src/workbench/DesignTemplateCenter.vue`（或拆 `DesignTemplateGallery.vue` + `DesignTemplatePreview.vue`）：

- props：`modelValue`（打开）、`mode: 'browse' | 'picker'`、`selection`（pack/applicationType/style）。
- 数据：`listDesignPacks()`；默认取第一个 pack；再 `getDesignPack(id)` 取完整页面/风格。
- 列表视图：
  - 分类 tabs（全部/平台管理/运营管理/数据分析/工具应用）+ 搜索；
  - 卡片：名称、描述、页面数、组件数、CSS 缩略图（参考 demo 的 mock-browser 卡片，不依赖真实截图）；
  - 自定义卡片：虚线 + “即将支持”（禁用）。
- 详情视图：
  - 顶部风格切换（4 个，带 signature 色点）；
  - 页面集 grid（页面名/类型/描述/组件列表/“进入页面”）；
  - 右侧/弹层 iframe 预览：`/preview.html?type=<id>&style=<id>&page=<id>`；
  - 切换风格只改 iframe URL（重载即可）；页面切换同理；
  - 预览加载失败显示提示，不白屏。
- 底部/顶部：
  - browse 模式：关闭/返回；
  - picker 模式：「使用此模板」emit selection 并关闭。
- 不引入 demo 的 Element Plus 依赖问题（工作台已有 Element Plus）。

## 2. 新建应用

`frontend/src/workbench/NewAppDialog.vue`：

- 保留需求模板 select 与校验/说明文字。
- 设计模板字段：
  - 显示当前选择（应用类型名 + 风格名）；
  - 「选择设计模板」打开 `DesignTemplateCenter`（picker 模式）；
  - 默认：pack 默认应用类型 + 默认风格；
  - 表单新增 `designPack/designApplicationType/designStyle`。
- `createApp` payload 带上设计字段；`CreateAppInput`/`AppInfo` 类型扩展。
- 旧 `prototypeTemplateId` 字段保留在 API 类型中（旧应用兼容），但新 UI 不再让用户选旧原型模板；如需要，折叠在“旧版兼容”里。

## 3. 首页与设计视图

`frontend/src/workbench/HomeShell.vue`：

- 保留「模板库」按钮（需求模板中心）。
- 新增「设计模板」按钮，打开 `DesignTemplateCenter` browse 模式。
- 应用卡片/列表可显示设计系统摘要（应用类型 · 风格），旧应用显示旧原型模板。

`frontend/src/workbench/DesignView.vue`：

- 通过 `getAppDesignSystem(appId)` 读取应用设计系统；
- 新应用：徽标显示 `<applicationType.name> · <style.name>`；点击可打开模板中心；
- 旧应用：保持现有 `prototypeTemplate` 徽标/逻辑；
- 增加「模板页面库」按钮（打开模板中心 browse 模式，定位当前应用类型/风格）；
- 不改现有 prototype 渲染/导出逻辑（P7-4 再接入页面契约）。

## 4. API/类型

- `frontend/src/workbench/api.ts`：`CreateAppInput`/`AppInfo` 增加 designSystem 字段（或引用 design-system-api 类型）；`createApp` 透传。
- 复用 `frontend/src/shared/design-system-api.ts`。
- 纯函数（默认选择/页面分组/预览 URL）抽到 `frontend/src/workbench/design-template-helpers.js`，便于 node --test。

## 5. 测试

- 前端单测：默认选择、非法/缺失回退、页面按类型分组、预览 URL 构造、picker 选择结果。
- Playwright：
  - 打开首页 → 设计模板 → 4 卡片；
  - 进入企业级应用 → 4 风格切换 → 页面集 → iframe 加载 organization；
  - 新建应用 → 需求模板 select 仍在 → 选择设计模板 → 创建（临时后端/临时 projects）；
  - 旧应用（若有 fixture）设计视图仍显示旧原型模板；
  - console error 0；需求模板中心仍可打开。
- 回归：`npm test`（frontend 66+）、`npm run typecheck`、`npm run build`、`check:vue`、backend 100/100、`e2e:preview` 77、`e2e:p2/p3/p4`（如时间允许）。
- 截图：`C:\Users\icecream\AppData\Local\Temp\opencode\p7-3b-*.png`。

## 6. 边界

- 不改 `TemplateLibraryDialog.vue`、`requirement_templates`、`adw-template-req-*`、模块 frontmatter。
- 不改 DB 表；不 seed 原型模板；不做 git；不启停真实 3300；不读写真实 data/projects/.env；不调模型。
- 预览 iframe 用相对 `/preview.html`；生产由后端托管（P7-3a 已加路由）。

## 7. 收尾

- 更新 P7 设计稿 P7-3b 实施记录与 `docs/STATUS.md`。
- 回报：UI 入口/页面、picker 流程、创建应用字段、测试/截图、偏差、未验证项、环境确认。
