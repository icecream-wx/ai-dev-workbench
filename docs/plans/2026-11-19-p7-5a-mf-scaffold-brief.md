# P7-5a 实施单：MF remote 脚手架 + 设计系统/蓝图/团队 skill 分发（2026-11-19）

> 上游：P7-1 设计系统、P7-3a/b 模板中心/预览、P7-4a 页面契约、`2026-11-19-design-template-and-dev-linkage-p7-design.md` 第 7 节。
> 本轮只做 **P7-5a**：生成物改为独立 MF remote（appTemplateDemo 形态）+ 工作区设计系统/蓝图/团队 skill/PageTemplates 分发 + pack 型模板 skill。
> **不做**：开发 prompt/digest/module/ui-check 软门禁（P7-5b）、一致性验收（P7-6）、自定义 builder（P7-7）。
> 需求模板中心、旧应用、现有 design.json 渲染不得破坏。

---

## 0. 出口标准

1. 新建应用（带设计系统）后，`projects/<app>/` 包含：
   - `frontend/`：MF remote 骨架（webpack + Module Federation，类似 appTemplateDemo）；
   - `frontend/src/components/PageTemplates/`（团队 PageTemplates + styles）；
   - `frontend/src/preferences/GlobalPreference.js`；
   - `frontend/src/views/AppIndex.vue`（占位入口，开发替换/扩展）；
   - `docs/design/design-system.json`（应用级只读摘要：pack/applicationType/style/pages/blueprintRoot）；
   - `docs/design/template/<applicationType>/pages/*.vue` + `structure.css`；
   - `docs/design/template/styles/shared.css` + 选中风格 `style.css`；
   - `.opencode/skills/afcenter-page-generation`、`pm-components-usage`、`adw-template-proto-<applicationType>`。
2. 旧应用（legacy 原型模板）行为不变；不 seed `prototype_templates`；不改 DB 表。
3. 前端/后端测试、smoke、build 全绿；新增 scaffold 测试。
4. MF 骨架不要求在本轮 `npm install`/构建（宿主依赖 pm-*），但文件/配置/README 必须完整可交给开发。

---

## 1. 资产

### 1.1 MF remote 种子

来源参考：`C:\Users\icecream\Desktop\ai优化建议\appTemplateDemo\appTemplateDemo`。

新建 `templates/afc-remote/`：

```text
templates/afc-remote/
  package.json                 # vue3 + element-plus + vue-router + webpack/MF + sass 等
  setting.json                 # app.name/port/hostname 占位（scaffold 替换）
  build/
    mfp.config.js
    webpack.config.js
    webpack.dev.js
    webpack.prod.js
    utils.js
    plugins/...（按需）
  public/index_app.html
  static/...（按需，可空）
  src/
    main.js
    bootstrap.js
    App.vue
    router/index.js
    views/AppIndex.vue         # 占位：标题 + 菜单/页面提示
    preferences/GlobalPreference.js
    components/PageTemplates/  # 从团队 skill assets 复制（不含 docs/examples/verify）
  README.md
```

要求：

- 以 appTemplateDemo 的 webpack/MF 配置为蓝本，适配为通用骨架；不要带 demo 业务页/actions/store。
- `setting.json` 的 `app.name` 用占位（如 `__APP_ID__`），scaffold 写入真实 app id；dev/prod 端口可保留/可配置。
- `AppIndex.vue` 是最小可用壳（提示“页面由开发 agent 从蓝图复制”），确保 remote 能暴露 `./index`。
- `PageTemplates` 从 `C:\Users\icecream\Desktop\ai优化建议\afcenter-page-generation\assets\PageTemplates\` 复制：`index.js`、`ListPage.vue`、`TreeListPage.vue`、`TreePanel.vue`、`FormPage.vue`、`FormSection.vue`、`FormSectionCard.vue`、`FormSectionDivider.vue`、`QueryPanel.vue`、`RowActions.vue`、`ThreePartPagination.vue`、`BlueListPage.vue`、`utils.js`、`style.css`、`appearance.css`、`table-white.css`、`table-blue.css`、`toolbar-blue.css`、`list-blue.css`；不含 examples/docs/verify。
- `GlobalPreference.js`：`reactive({})` 单例 + 默认值参考 PageTemplates docs；页面统一导入。
- README：说明这是 AFCenter 子应用 remote、`npm install`/`npm run dev`/`build:prod`、pm-* 由宿主提供、页面从 `docs/design/template` 复制。

### 1.2 团队 skill 入库

复制到 `templates/agent/skills/`：

- `afcenter-page-generation/`（含 assets/PageTemplates、ApplicationPageTemplates、references、scripts；可保留，体积可接受）
- `pm-components-usage/`（含 references）
- 新建 `adw-frontend-implementation/` 可留到 P7-5b，本轮不创建。

保持两个 skill 同级，`../pm-components-usage` 相对链接可用；不修改其内容。

### 1.3 pack 型模板 skill

在 `backend/src/templates/distribution.ts` 增加/改造：

- 对应用设计系统（pack/applicationType/style）生成 `adw-template-proto-<applicationType>/`：
  - `SKILL.md`：应用类型/风格/pack 版本、页面库/蓝图路径、两个团队 skill 相对路径、页面配方/组件映射/conformance、设计/开发读取顺序、冲突上报、`ui-check.md` 要求（文字可先写，P7-5b 落机制）；
  - `assets/design-system.json`：应用级摘要（pack/type/style/pages）；
  - `_manifest.json`：managed/kind/sourceId=applicationType/templateName/hash。
- 旧 legacy 模板 skill 生成逻辑保留；新应用不再用旧原型模板生成。
- `expectedSkillIds`/verify assets 期望：2 方法 skill + 2 团队 skill + 当前设计模板 skill；旧应用仍按旧逻辑（兼容）。
- 清理只按 manifest 白名单，不碰团队/用户 skill。

工作区同步：创建/打开/会话启动时幂等；不改 docs/requirements、docs/design 正文。

---

## 2. Scaffold

修改 `backend/src/apps/scaffold.ts` / `apps/routes.ts`：

- `scaffoldApp` 接收设计系统选择（pack/applicationType/style）或从 app_settings 读取；新建应用时在写完 DB 前/后写入。
- 复制 `templates/afc-remote` → `projects/<app>/frontend/`；替换 `setting.json` app.name/端口占位、package.json name。
- 生成 `docs/design/design-system.json`：
  ```json
  {
    "schemaVersion": 1,
    "pack": "afcenter-app-templates-v1",
    "applicationType": "enterprise-application-platform",
    "style": "platform-blue",
    "blueprintRoot": "docs/design/template",
    "pages": [ ...页面元数据... ],
    "skills": ["afcenter-page-generation","pm-components-usage"]
  }
  ```
- 复制蓝图：
  - `docs/design/template/<applicationType>/pages/*.vue`、`structure.css`；
  - `docs/design/template/styles/shared.css`、选中风格 `style.css`；
  - 只复制选中的应用类型，不复制 4 套全部。
- 写入团队 skill（`installAgentAssets` 会复制 templates/agent/skills；确认包含两个团队 skill）。
- 旧应用/无设计系统：不生成 frontend/design-system（或 legacy 行为不变）；不要破坏现有 app1/app2。
- `README.md`/`AGENTS.md` 暂不在本轮大改（P7-5b 统一写开发规则）；可加 frontend 说明链接。

---

## 3. 测试

- 后端 scaffold 测试：
  - 新应用带设计系统：frontend 骨架/PageTemplates/GlobalPreference/design-system.json/蓝图/团队 skill/模板 skill 存在；
  - 路径/文件内容抽样；setting.json app.name 替换；
  - 旧应用仍只有后端/旧模板（或现有行为不变）；
  - 非法设计系统不创建目录。
- distribution 测试：pack 型模板 skill 生成/manifest/hash/expectedSkillIds；团队 skill 存在；旧模板 skill 兼容。
- 现有 105/79、smoke:workspace/assets、e2e p2/p3/p4 保持；如 smoke:assets 期望 skill 列表，更新。
- 不需要真实 `npm install`/构建 frontend（宿主依赖）；可做 JSON/文件存在性校验。

---

## 4. 边界

- 不改需求模板中心/需求 skill/DB 表；不 seed prototype_templates。
- 不改 P7-3a 预览页/P7-3b 模板中心业务。
- 不写开发 prompt/digest/ui-check 机制（P7-5b）。
- 不启停真实 3300；不读写真实 data/projects/.env；不 git；不调模型。

---

## 5. 收尾

- 更新 P7 设计稿 P7-5a 实施记录与 docs/STATUS.md。
- 回报：种子/资产清单、scaffold 产物、skill 分发、测试结果、偏差、未验证项、环境确认。

---

## 6. 实施结果（2026-11-19）

- 资产：`templates/afc-remote/`（MF remote 骨架 + 19 个 PageTemplates 运行文件 + GlobalPreference）、`templates/agent/skills/afcenter-page-generation`（68 文件）、`templates/agent/skills/pm-components-usage`（6 文件）。
- scaffold：带设计系统的新应用生成 `frontend/`（setting/package 应用名替换）、`docs/design/design-system.json`、`docs/design/template/<type>/`（pages + structure.css + assets）与 `styles/{shared,style}.css`；旧应用不生成。
- 分发：`adw-template-proto-<applicationType>`（SKILL.md + assets/design-system.json + `_manifest.json`，kind=`design-system`）；团队 skill 随资产分发；`expectedSkillIds` 含 2 方法 + 2 团队 + 当前模板 skill；旧 legacy 兼容。
- 验证：后端 **109/109**、前端 **79/79**；`build`/`typecheck`/`check:vue`；`smoke:workspace`、`smoke:assets`（真实 opencode 2.2.5）；`e2e:preview` 77、`e2e:p7-3b` 45、`e2e:p2/p3/p4` 116/126/97。
- 偏差：额外复制应用类型 assets（svg）；设计 skill manifest kind=`design-system`；新应用不生成旧原型模板 skill；p2 3.3 改等待徽标；生成物未安装/构建（宿主依赖）。
- 未验证：生成 frontend 的 npm install/dev/build、真实 AFCenter 宿主、开发 digest/ui-check（P7-5b）、一致性（P7-6）、自定义 builder（P7-7）、真实 3300/EOS 运行态。

