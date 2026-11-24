# 能力包 + 技术基座 + `code/` 布局（C0 设计稿）

> 状态：**设计稿（待评审）**，2026-11-24。
> 依据：用户 2026-11-24 的决策；对 `C:\Users\icecream\Desktop\ai优化建议\test-app` 的只读盘点（`.opencode` 6 skills + 2 plugins + scripts/docs/tests，`code/backend` EOS 结构，`code/frontend` MF remote + standalone，含业务样例）。
> 本文只定义模型、目录、契约、改造清单与分批；**不改代码/模板/DB，不启停真实 3300/4771，不调真实模型，不做 git**。
> 目标：把"公司平台能力 = 可插拔资产"落成工作台机制；能力清单未出之前先把**逻辑与钩子**留好，后续只加数据包、不改架构。

---

## 1. 已拍板（2026-11-24）

| # | 决策 | 落地含义 |
| --- | --- | --- |
| 1 | 应用目录统一为 `code/backend` + `code/frontend` | 生成的应用最终结构就是这样；趁现在直接改。**工作台仓库自身的 `frontend/`（UI）不变** |
| 2 | 新 EOS 基座**替换**旧模板，不并存 | 以 `test-app` 的 `code/backend|frontend` 为基础，重新梳理成**无 demo/业务代码**的模板；旧 `templates/eos-app`、`templates/afc-remote` 退役 |
| 3 | 高内聚能力先作为一个能力包 | 当前 `eos-dev-kit` = 6 skills + 2 plugins + scripts/docs/tests/e2e，整体安装；后续按耦合度再拆 |
| 4 | 插件默认启用；不设计多版本兼容 | 工作台版本 ↔ opencode 版本一一对应；当前仍做**最小可用性检查 + 降级**，不做 semver 矩阵 |
| 5 | 基座剥离 demo；demo 另做可选包 | 基座不允许出现业务表/业务页面 |
| 6 | 敏感值全部参数化 | 创建应用时由配置 schema 收集，只写 `projects/`，不进 DB；`sourcesyskey` 视为 secret |
| 7 | 能力版本暂不设计 | 一个能力一个版本，不做升级/回滚/版本比较；只记录来源与内容 hash |
| 8 | 现在就加 `runtime` 元数据 | 基座标注运行时（`eos-9`，未来 `spring-boot-3`）；能力声明 `requires.runtime`，迁移时重映射 |
| 9 | `skill-test` 是工作台自己的开发 agent 测评工具 | 用来评估开发 agent 的效率/质量，不作为应用内能力 |

---

## 2. 目标与非目标

### 2.1 目标

1. 新建应用时可选 **基座（单选）** 与 **能力（多选，应用级）**；不选能力 = 工作台原生（方法 skill + 默认设计模板 + 空能力）。
2. 能力以**声明式包 + 受信运行资产**安装到应用工作区；需求/设计/开发会话都能感知并使用。
3. 基座与能力都可注册、校验、安装、同步、删除保护；文件是唯一事实源，DB 不加表。
4. 目录统一 `code/backend` + `code/frontend`，工作台自身 UI 不受影响。
5. 为后续 Spring Boot 基座与能力清单留好扩展点：**只加包，不改机制**。

### 2.2 非目标（本期明确不做）

- 不做网络插件市场/远程分发；只从内置目录与本机 `<dataDir>` 注册表安装。
- 不做任意 install/postInstall 脚本执行；插件/脚本只作为**受信文件**复制。
- 不新增 DB 表；能力选择/基座用工作区文件 + `app_settings` 镜像。
- 不做能力版本升级/回滚/依赖求解；一个能力一个版本。
- 不做旧应用迁移；旧 `backend/`+`frontend/` 布局硬切，不提供兼容层。
- 本期不接 MCP（留 `provides.mcp` 钩子，后续单批）。
- 不在本设计内实现 Spring Boot 基座（等你们产物）。
- 不改需求模板中心、`templates/design-system/**`、`templates/workshop/**`。

---

## 3. 术语与包类型

| 术语 | 定义 | 数量 |
| --- | --- | --- |
| **base（技术基座）** | 决定 `code/backend` + `code/frontend` 项目骨架、构建/运行、宿主集成、占位符/密钥 schema、基座 AGENTS 片段、运行时标记 | 应用**单选** |
| **capability（能力包）** | 可插拔资产：skills / plugins / pluginConfig / scripts / docs / tests / e2e / checks；可声明对 base/runtime 的要求 | 应用**多选** |
| **registry（注册表）** | 内置 `templates/bases|capabilities/` + 本机 `<dataDir>/bases|capabilities/` | 全局 |
| **selection（应用选择）** | `<app>/docs/capabilities.json`（权威）+ `app_settings` 镜像 | 每应用 |
| **managed copy（受管副本）** | 由工作台写入、带 `_manifest.json` 白名单的目录；同步覆盖、按白名单清理 | 每应用 |
| **trusted runtime asset（受信运行资产）** | 来自受信注册表的插件/脚本/测试文件；只复制，不执行安装逻辑 | 每能力 |
| **degraded（降级）** | 能力声明可用但运行条件不满足（如 opencode hook 不可用/文件缺失）；必须显式标记，agent 不得假装可用 | 每能力 |

包类型只有 `base` 与 `capability` 两种；需求模板/设计模板保持现有机制（`requirement_templates` + 设计 pack），**不并入本期**。

---

## 4. 目标应用目录

```text
projects/<app>/
  AGENTS.md                         # 受管区块组合（base + workbench + capabilities + user）
  README.md                         # 由 base + workbench 组合生成
  opencode.json                     # 权限底线 + 能力贡献（allowlist 合并）
  .opencode/
    skills/
      adw-requirements-document/    # 工作台方法 skill（always）
      adw-design-artifacts/
      adw-api-design/
      adw-frontend-implementation/
      eos-development-efficiency/   # 能力 skill（eos-dev-kit）
      eos-pm-page-dev/
      eos-afcenter-integration/
      eos-data-access/
      eos-app-validation/
      eos-skill-maintenance/
      adw-template-req-<id>/        # 需求模板 skill（现有机制）
      adw-template-proto-<type>/    # 设计模板 skill（现有机制）
    commands/                       # 工作台 6 个 command + 能力 command（如有）
    plugins/                        # 能力插件（受管）；logs/ 不进仓库
      config/
      lib/
    scripts/                        # 能力脚本（受管）
    docs/                           # 能力工具文档（受管）
    tests/                          # 能力/插件回归（受管）
  docs/
    requirements/requirements.md
    design/                         # entities/pages/api-design/design-system/brief/tokens/prototypes/ui-check
    capabilities.json               # 基座 + 能力选择（权威）
    capabilities/
      index.md                      # 给人/agent 的能力索引（生成）
      eos-dev-kit/                  # 能力自带说明（受管）
  code/
    backend/                        # 基座模板（EOS 9，业务为空）
    frontend/                       # 基座模板（MF remote + standalone + PageTemplates/GlobalPreference）
```

说明：

- **工作台仓库**仍是 `backend/`（服务）+ `frontend/`（UI）；本节只约束**生成的应用工作区**。实现时禁止全局替换（`backend/src/index.ts` 的 `../../frontend/dist` 是工作台 UI，必须保持）。
- 应用工作区建议生成 `.gitignore`：`code/frontend/node_modules/`、`code/frontend/dist/`、`code/backend/target/`、`.opencode/plugins/logs/`、`code/frontend/e2e/.auth/`、`code/frontend/e2e/artifacts/`。
- `docs/capabilities.json` 是选择权威；`app_settings` 的 `app.<id>.capabilities` 只是镜像（列表/跨应用引用查询用）。

---

## 5. 包格式

### 5.1 目录

```text
templates/bases/<baseId>/
  pack.json
  AGENTS.base.md
  backend/**            # 目标 code/backend
  frontend/**           # 目标 code/frontend

templates/capabilities/<capabilityId>/
  pack.json
  skills/**
  plugins/**
  scripts/**
  docs/**
  tests/**
  app/e2e/**            # 目标 code/frontend/e2e
  docs-md/**            # 目标 docs/capabilities/<id>
```

自定义/已安装包：`<dataDir>/bases/<baseId>/`、`<dataDir>/capabilities/<capabilityId>/`（同结构）。

### 5.2 base `pack.json`

```jsonc
{
  "schemaVersion": 1,
  "kind": "base",
  "id": "eos-app",
  "name": "EOS 9 应用基座",
  "version": "2.0.0",
  "runtime": "eos-9",
  "summary": "EOS 9.0 + Spring Boot 后端骨架；AFCenter MF remote + standalone 前端",
  "provides": {
    "backend": {
      "from": "backend",
      "to": "code/backend",
      "placeholders": ["APP_ID", "APP_NAME", "PORT", "EOS_SYS_KEY",
                       "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD",
                       "MAIL_HOST", "MAIL_USERNAME", "MAIL_PASSWORD",
                       "AFCENTER_GATEWAY", "AFCENTER_SOURCESYSKEY", "AFCENTER_APPID",
                       "COMPONENTS_CLIENT_URL"]
    },
    "frontend": {
      "from": "frontend",
      "to": "code/frontend",
      "modes": ["mf-remote", "standalone"]
    },
    "configSchema": [
      { "key": "AFCENTER_GATEWAY", "label": "AFCenter 网关", "type": "string", "default": "http://127.0.0.1:28077" },
      { "key": "AFCENTER_SOURCESYSKEY", "label": "X-EOS-SourceSysKey", "type": "secret" },
      { "key": "AFCENTER_APPID", "label": "应用菜单 appId", "type": "string" },
      { "key": "COMPONENTS_CLIENT_URL", "label": "pm-components remoteEntry", "type": "string" },
      { "key": "DB_HOST", "label": "DB Host", "type": "string", "secret": false },
      { "key": "DB_PASSWORD", "label": "DB Password", "type": "secret" }
    ],
    "secrets": ["EOS_SYS_KEY", "DB_PASSWORD", "MAIL_PASSWORD", "AFCENTER_SOURCESYSKEY"],
    "agentsFragment": "AGENTS.base.md",
    "checks": [
      { "id": "backend-build-files", "kind": "static", "paths": ["code/backend/pom.xml", "code/backend/src"] },
      { "id": "frontend-build-files", "kind": "static", "paths": ["code/frontend/package.json", "code/frontend/build/mfp.config.js"] }
    ]
  }
}
```

规则：

- `placeholders` 只允许 ASCII 值（沿用现有 `assertAsciiSecrets` 限制）；未提供写 `CHANGE_ME`。
- `secrets` 只声明名称；值只写应用目录，不写 DB、不进日志。
- `runtime` 是迁移锚点：能力 `requires.runtime` 必须匹配。
- 基座不得包含业务代码；由 `template-cleanliness` 测试断言（见 §13）。

### 5.3 capability `pack.json`

```jsonc
{
  "schemaVersion": 1,
  "kind": "capability",
  "id": "eos-dev-kit",
  "name": "EOS 开发能力套件",
  "version": "2.0.0",
  "summary": "EOS 开发期技能、护栏插件、工具文档与验收底座",
  "requires": { "base": ["eos-app"], "runtime": ["eos-9"] },
  "provides": {
    "skills": ["skills/eos-*"],
    "plugins": ["plugins/**"],
    "pluginConfig": ["plugins/config/**"],
    "scripts": ["scripts/**"],
    "docs": ["docs/**"],
    "tests": ["tests/**"],
    "e2e": [{ "from": "app/e2e/**", "to": "code/frontend/e2e/**" }],
    "capabilityDocs": [{ "from": "docs-md/**", "to": "docs/capabilities/eos-dev-kit/**" }],
    "checks": [
      { "id": "plugin-regression", "kind": "command", "command": "node --test .opencode/tests/*.test.cjs" },
      { "id": "backend-boundary", "kind": "command", "command": "node --test code/backend/tests/*.cjs" }
    ]
  }
}
```

规则：

- `requires` 只做**前置校验**：不满足则不可选（创建时）或 `degraded`（已安装后条件变化）。
- `provides` 的已知 section 由安装器实现；**未知 section 只 warning、不阻断**（为能力清单未出留钩子）。
- `checks` 是"可运行的检查声明"，默认**不自动执行**；供 agent/开发者按需运行，fidelity 只做静态检查。
- 不提供 `install`/`postInstall` 执行入口。
- `_meta.json`（slug/version/publishedAt）保留在 skill 目录内，不覆盖；包版本以 `pack.json.version` 为准。

---

## 6. 注册表、安装与受信资产

### 6.1 注册表 API（设计）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/capabilities` | 列出 base/capability（含 `installed`、`referencedApps`） |
| GET | `/api/capabilities/:id` | 包详情（manifest + 文件清单摘要） |
| POST | `/api/capabilities/:id/install` | 从本机目录安装到 `<dataDir>/capabilities/<id>`（原子） |
| DELETE | `/api/capabilities/:id` | 内置 403；被应用引用 409 + 应用列表 |
| POST | `/api/capabilities/validate` | 校验目录/包（CLI 同源） |

基座同理：`/api/bases`（`eos-app` 内置只读；未来可安装）。

### 6.2 安装校验

- manifest schema：字段/类型/枚举；
- 路径安全：拒绝 `..`、绝对路径、盘符、符号链接、目标越界；
- 文件清单：存在性、大小上限（建议单包 ≤ 30MB）、扩展名 allowlist（`.md/.json/.js/.cjs/.mjs/.vue/.ts/.css/.svg/.png/.jpg/.jpeg/.properties/.xml/.tpl/.yaml/.yml`）；
- 不允许包内出现凭据文件/`.env`/`.auth`/`node_modules`/`target`/`dist`；
- 包内容 hash（`sha256`）记录，用于应用侧幂等同步与"内容变化"提示（不是版本升级流程）。

### 6.3 受信运行资产规则

1. 只从受信注册表（内置/本机）复制；无网络下载。
2. 插件/脚本按**精确文件清单**复制；不执行包内任何脚本。
3. 插件能力**不能降低** `opencode.json` 权限底线（`.opencode/skills/**`、`.opencode/commands/**` 始终 deny 给模型编辑）。
4. 插件日志目录不进仓库；日志只记元数据（不记命令/正文/凭据）。
5. 能力移除只删受管副本；**不删除/不改写用户业务代码**，并提示"代码中的能力引用需 agent 清理"。
6. 运行条件不满足 → `degraded`：UI 与 prompt 都明确"该能力未生效"。

---

## 7. 应用装配算法（幂等）

创建应用：

```text
1. 校验 selection：base 存在、capability 存在、requires.base/runtime 满足 → 否则 400
2. 校验目标目录不存在（projects/<app> 为空）
3. scaffoldBase：
   a. copy base.backend → code/backend（占位符一次替换；未给 secret 写 CHANGE_ME）
   b. copy base.frontend → code/frontend
   c. 写配置（setting.json / application*.properties 中声明的项）
4. installCapabilities（按选择顺序）：
   a. 复制 skills → .opencode/skills/<skill>/（写 _manifest.json）
   b. 复制 plugins/pluginConfig → .opencode/plugins/**（config 随插件）
   c. 复制 scripts/docs/tests → .opencode/{scripts,docs,tests}/**
   d. 复制 e2e → code/frontend/e2e/**
   e. 复制 capabilityDocs → docs/capabilities/<id>/**
5. composeAgents：base 片段 + workbench 约定 + 能力索引 + 用户区块（受管标记）
6. writeOpencodeJson：权限底线 + 能力贡献（allowlist；本期无 mcp）
7. writeCapabilitiesDoc：docs/capabilities.json + docs/capabilities/index.md
   + app_settings 镜像 app.<id>.capabilities
8. 安装工作台方法 skill / 需求模板 skill / 设计模板 skill（现有机制）
9. 生成 docs/requirements/requirements.md 骨架（现有机制）
10. expectedAssetIds 记录并校验（缺失 → warning；插件不可用 → capability degraded）
失败：清理半成品目录，不登记 DB。
```

应用打开/会话启动（`ensureWorkspaceAssets`）：

```text
- 重新同步工作台方法 skill/command（现有）
- 按 docs/capabilities.json 重新同步能力受管副本（内容 hash 不同才写）
- 不覆盖：用户 AGENTS 区块、业务代码、docs 正文、能力包之外的 skill
- 清理：只删 _manifest.json 白名单里的过期受管目录
```

---

## 8. 基座模板梳理（EOS clean base）

### 8.1 来源与目标

- 来源：`test-app/code/backend`、`test-app/code/frontend`（只读参考）。
- 目标：`templates/bases/eos-app/backend|frontend`。
- 旧 `templates/eos-app`、`templates/afc-remote` 在 C2 完成后删除（不并存）。

### 8.2 保留（清理后）

**backend**

- `pom.xml`：EOS parent + 现有依赖（保留注释中的低码/AFC/BPS 依赖作为参考，不启用）。
- `src/application*.properties`、`bootstrap.properties`、`logback-spring.xml`、`serialkiller.xml`。
- `src/META-INF/**`（含 license 示例）。
- `src/com/primeton/gocom/lowcode/Application.java`。
- `src/com/primeton/gocom/lowcode/common/`：`ApiException`、`BaseController`、`CurrentUser`、`CurrentUserService`、`HealthController`（**移除 `MaterialFileController`**）。
- `src/com/primeton/gocom/lowcode/config/MybatisPlusConfig.java`。
- `sql/README.md`（DDL 约定）。
- `tests/app-boundary.test.cjs`（平台边界回归）。
- `README.md`（重写：去业务、去真实 IP/密钥）。

**frontend**

- `build/**`（webpack + MF + dev/prod + `mfp.config.js`）。
- `public/index_app.html`、`src/main.js`、`src/bootstrap.js`、`src/App.vue`、`src/router/index.js`。
- `src/standalone/**`（登录/菜单/守卫/dispatch/pm 注册/请求封装/api views）。
- `src/components/DynamicView.vue`、`src/components/PageRender.vue`（保留但 README 标注 `ide/pageViewer` 地雷，不默认暴露）。
- `src/store/index.js`、`src/actions/**`、`src/views/index.vue`（开发导航）。
- `scripts/**`（`buildApi.js`、`config.js`、`fileUtil.js`、`tpl/*`）。
- `playwright.config.cjs`、`e2e/{account-store.cjs,login.cjs,accounts.example.json,README.md,auth.setup.cjs,login.fixture.spec.cjs}`、`tests/**`。
- `setting.json`（模板化）、`package.json`、`babel.config.js`、`.gitignore`。

**从工作台合并进来（必须）**

- `src/components/PageTemplates/**`（来自 `templates/afc-remote/src/components/PageTemplates`，与 `templates/agent/skills/afcenter-page-generation/assets/PageTemplates` 同源）。
- `src/preferences/GlobalPreference.js`。
- 原因：设计契约、开发 prompt、fidelity（`page-templates`/`global-preference`/`form-dialog`/`auto-height`）都依赖它们；kit 的 frontend 目前没有这两块，合并后才能保持工作台链路一致。

### 8.3 剥离（不进入基座）

- 业务后端：`order/**`、`supplier/**`、`MaterialFileController`。
- 业务 SQL：`sql/01-supplier-order-ddl.sql`、`sql/02-test-data.sql`。
- 业务/演示前端：`src/views/config/BusinessOwnerConfig.vue`、`src/views/dev/PmSelectors.vue`（可选保留为示例包）、`examples/EffectProbeDashboard.vue`。
- e2e：`debug.app.spec.cjs`、`e2e/artifacts/**`、`e2e/.auth/**`（登录态）、`e2e/.DS_Store`。
- 构建/缓存：`node_modules/**`、`dist/**`、`target/**`、`logs/**`、`.DS_Store`。
- `code/frontend/opencode.json`（`edit/bash/external_directory: allow`）：**不随基座分发**。
- `frontend/README.md` 中 `.agents/skills/afcenter-app-dev`、`E:\vue3\...` 等本地/失效引用。
- `reports/`、`support/`（工作区不生成；由工作台报告机制另行管理）。

### 8.4 参数化（必须）

| 文件 | 占位符 |
| --- | --- |
| `code/backend/pom.xml` | `{{APP_ID}}`（artifactId） |
| `application.properties` | `{{APP_ID}}`、`{{PORT}}`、`{{EOS_SYS_KEY}}`、Redis/Nacos 环境变量保留 |
| `user-config.xml` | `{{DB_HOST}}`/`{{DB_PORT}}`/`{{DB_NAME}}`/`{{DB_USER}}`/`{{DB_PASSWORD}}` |
| `application-job.properties` | `{{MAIL_HOST}}`/`{{MAIL_USERNAME}}`/`{{MAIL_PASSWORD}}` |
| `frontend/setting.json` | `{{APP_ID}}`（app.name）、`{{AFCENTER_GATEWAY}}`、`{{AFCENTER_SOURCESYSKEY}}`、`{{AFCENTER_APPID}}`、`{{COMPONENTS_CLIENT_URL}}`、`{{WEBPACK_DEV_HOST}}`/`{{WEBPACK_DEV_PORT}}` |
| `frontend/src/application` 相关 | 无（保持现有） |

把 `test-app` 中真实感的 `eos.application.sys-key`（32 hex）与 `setting.json` 的 `sourcesyskey`/内网 IP 全部替换为 `CHANGE_ME`/占位符；README 示例同步脱敏。

### 8.5 基座模板验收（静态）

- 不出现 `supplier|order|material|BusinessOwnerConfig|PmSelectors` 等业务标识（测试白名单）；
- 不出现真实 sys-key/IP/密码（正则扫描 32 hex、`192.168.`、`dc6baaed...` 等）；
- `code/backend/tests/app-boundary.test.cjs`、`code/frontend/tests/standalone-dev.test.cjs` 可运行；
- `code/frontend` 含 PageTemplates + GlobalPreference；
- `setting.json` 仅有占位符/安全默认值。

---

## 9. 能力包梳理（`eos-dev-kit`）

### 9.1 内容

| 区块 | 内容 | 目标 |
| --- | --- | --- |
| skills | 6 个 `eos-*`（含 references/assets/_meta.json） | `.opencode/skills/` |
| plugins | `prohibition-guard.js`、`skill-compaction-policy.js` | `.opencode/plugins/` |
| pluginConfig | `config/skill-priority.json`、`config/skill-compaction-policy.json` | `.opencode/plugins/config/` |
| scripts | `test-account.cjs` + `lib/test-account-store.cjs` | `.opencode/scripts/` |
| docs | `tool-usage.md`、`tool-docs/commands.md`、`tool-docs/testing-api.md` | `.opencode/docs/` |
| tests | 4 个 `.opencode/tests/*.test.cjs` | `.opencode/tests/` |
| e2e | `frontend/e2e/**`（account store/login/config/fixtures/README） | `code/frontend/e2e/` |
| capabilityDocs | 能力说明（新增，见 §9.3） | `docs/capabilities/eos-dev-kit/` |

### 9.2 不进入能力包

- `tools/skill-test/run.js`：**工作台自己的 agent 测评工具**（见 §9.4），不进应用。
- 业务样例、demo SQL、e2e artifacts、`.auth`、`.DS_Store`、`node_modules`、`target`、`dist`。
- `reports/`、`support/`。

### 9.3 能力文档（新增）

`docs/capabilities/eos-dev-kit/README.md`（生成/受管）至少包含：

- 能力名/版本/来源/安装时间；
- 已安装 skills/plugins/scripts（清单）；
- 使用入口：`eos-development-efficiency`（主路由）→ 页面/平台/数据/验收/维护；
- 护栏状态：`prohibition-guard` 已启用/降级；`skill-compaction-policy` P0 来源；
- 平台边界：只读公开契约、不探测平台源码、不猜接口/凭据；
- 验收：默认不自动启动 Playwright；真实登录账号只在本机账号库，密码不进聊天；
- 降级说明（如 opencode hook 不满足）。

### 9.4 `skill-test` 的归属（工作台测评工具）

- 位置（建议）：仓库内 `tools/agent-eval/`（或 `backend/scripts/agent-eval/`），**不随应用分发**。
- 用途：用真实 opencode/模型对"开发 agent"跑固定用例，评估效率/质量（是否遵守 P0、是否落到 `src/views`、是否构建通过等）。
- 与工作台测试分离：不进入 `npm test` 默认路径；显式命令 + 真实模型授权；产物写临时目录/证据目录，不入库。
- C4 再定具体形态（本设计只确认归属）。

### 9.5 skill 权威与重叠（C2 评审点）

当前工作台已有 `afcenter-page-generation`、`pm-components-usage` 两个团队 skill；kit 的 `eos-pm-page-dev`、`eos-afcenter-integration` 与其有重叠。初始策略：

- **EOS 基座下，kit 的 6 个 skill 为权威**（页面/平台/数据/验收/路由/维护）；
- `afcenter-page-generation` 保留为 **PageTemplates 资产来源**（基座已复制，skill 可继续存在但优先级低）；
- `pm-components-usage` 作为 pm-* 组件参考保留，AGENTS 明确"冲突时以 kit skill 为准"；
- 不复制 P0 规则到多处；P0 以 `.opencode/plugins/config/skill-priority.json` 为唯一权威。
- 后续单独批次做"团队 skill 与 kit skill 归并"，不在 C2 扩大范围。

---

## 10. AGENTS / opencode.json / prompt 组合

### 10.1 AGENTS.md 受管区块

```markdown
# 应用约定

<!-- adw:base:begin -->
（基座片段：项目结构、构建/运行、平台边界、开发约定）
<!-- adw:base:end -->

<!-- adw:workbench:begin -->
（工作台约定：需求/设计/开发三文件、优先级、ui-check、能力索引位置）
<!-- adw:workbench:end -->

<!-- adw:capabilities:begin -->
已启用能力：eos-dev-kit。入口 skill：eos-development-efficiency；详见 docs/capabilities/index.md。
<!-- adw:capabilities:end -->

<!-- adw:user:begin -->
（用户可编辑；同步时保留）
<!-- adw:user:end -->
```

规则：

- 受管区块覆盖式更新；`user` 区块永不覆盖。
- P0 规则**不在 AGENTS 复制全文**；AGENTS 只给入口与摘要，权威在 `skill-priority.json`（避免双权威）。
- 若 kit 的 P0 清单引用了 AGENTS 行（如 `no-platform-source-probing`），C2 需做一致性检查：确保这些行存在于 base/workbench 片段，或把 source 改指 `skill-priority.json`。

### 10.2 opencode.json

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "edit": {
      "*": "allow",
      ".opencode/skills/**": "deny",
      ".opencode/commands/**": "deny"
    }
  }
}
```

- 能力只能在 allowlist 键上追加（本期无）；**不得**出现 `external_directory: allow` 或放开受管目录。
- 若未来接 MCP，`mcp` 由能力声明、工作台合并，凭据只引用环境变量名。

### 10.3 prompt 能力目录

`buildViewPrompt` 增加一段（≤500 token）：

```text
已启用能力：eos-dev-kit（EOS 9）。能力入口与路由见 docs/capabilities/index.md；
开发期先按 eos-development-efficiency 判断范围，再按页面/平台/数据/验收分别加载对应 skill。
护栏：prohibition-guard 已启用；平台源码/契约探测与凭据读取被禁止。
```

- 不再复述 6 个 skill 的细则；细节由 skill 懒加载。
- 需求/设计视图同样注入"可用能力"摘要；若能力未提供需求/设计约束，则不加额外规则。
- 开发 digest 增加：应用代码目录 `code/backend`、`code/frontend`；已启用能力；能力文档路径。

---

## 11. 需求 / 设计 / 开发 / 验收如何使用

| 视图 | 能力带来的内容 | 工作台注入 |
| --- | --- | --- |
| 需求 | 平台能力边界（不把平台能力写成自研）、可用的平台入口 | 能力目录摘要；不生成平台接口细节 |
| 设计 | 页面/实体/接口约束（本期 kit 无设计页模板；后续能力可提供 `pageTemplates`） | 能力目录；设计 prompt 增加"实现需遵循已启用能力的平台边界" |
| 开发 | 6 skills + 插件 + 工具文档 + e2e/账号 + 边界测试 | AGENTS + digest + skills；代码路径 `code/frontend/src/views`、`code/backend/src` |
| 验收 | `eos-app-validation` + 原生 Playwright + 账号库 | 默认不自动启动；用户明确要求时执行；密码不进聊天 |

`skill-test` 是**工作台维护者**评估开发 agent 的工具，不进入应用视图，也不作为应用能力。

---

## 12. UI（创建/能力中心/应用能力）

### 12.1 新建应用（C3）

- **基座**：单选（当前仅 `eos-app`，显示为只读/默认）；
- **能力**：多选（当前仅 `eos-dev-kit`，默认勾选）；按 `requires.base/runtime` 过滤；
- **配置**：由 `base.configSchema` + 能力 `configSchema` 渲染；secret 字段不回显、不入日志；
- 摘要：显示"基座 + 能力 + 代码目录 `code/`"；
- 保留现有需求模板/设计模板选择。

### 12.2 能力中心（C3，可后置）

- 列出内置/已安装 base 与 capability；显示版本、来源、被引用应用；
- 安装（本机目录）/删除（内置 403、被引用 409）；
- 不做版本升级/回滚（按决策 7）。

### 12.3 应用能力管理（C3，可后置）

- 应用内显示已启用能力与护栏状态（启用/降级）；
- 增删能力：同步受管副本；删除时提示"业务代码引用需 agent 清理"；
- 不做版本切换。

---

## 13. 校验 / fidelity / ui-check

### 13.1 包校验

- 新增共享 core + CLI（建议 `templates/agent/skills/adw-...` 或 `backend/src/capabilities/manifest.ts` 单源）：
  - manifest schema、路径安全、文件清单、大小/扩展名、包内禁止项；
  - base/capability 的 `requires` 校验；
  - 未知 section → warning。
- `npm run validate:capabilities`（新脚本）供 CI/实施会话使用。

### 13.2 fidelity 新增（只报告、不阻断）

| 检查 | 内容 |
| --- | --- |
| `app-layout` | `code/backend/pom.xml`、`code/frontend/package.json` 存在；不存在旧 `backend/`/`frontend/`（应用根） |
| `capabilities-doc` | `docs/capabilities.json` 存在且与已安装受管目录一致 |
| `capability-assets` | 能力声明的 skills/plugins/scripts/docs/tests 存在；`_manifest.json` hash 一致 |
| `agents-blocks` | AGENTS 受管区块存在；P0 权威文件存在 |
| `permission-floor` | `opencode.json` 保留 `.opencode/skills/**`、`.opencode/commands/**` deny |
| `base-cleanliness` | 基座无业务样例/真实凭据（静态扫描） |
| `e2e-harness` | 能力启用时 `code/frontend/e2e` 与账号说明存在（缺失 warn） |

现有 14 项保留；新增项按实际数量更新 `fidelity-core.cjs`、`check-fidelity.mjs`、`e2e:p7-6a`、`smoke:workspace`。

### 13.3 ui-check

- 新增"能力/平台约束"列（C4）：记录本页使用的平台能力（用户/组织/字典/租户/权限/附件）与边界；
- 未填写不阻断（沿用软门禁）。

---

## 14. 版本、迁移与 opencode

### 14.1 能力版本（按决策 7）

- `pack.json.version` 只作来源标识；应用记录安装版本与内容 hash；
- **不做**升级/回滚/版本比较 UI；
- `ensureWorkspaceAssets` 以内容 hash 判断是否需要重写受管副本；变化时写 `docs/capabilities/<id>/README.md` 的"来源"信息，不提示升级；
- 删除能力 = 移除受管副本 + 更新 `docs/capabilities.json`；业务代码不动。

### 14.2 目录迁移（硬切）

- 生成应用：`code/backend` + `code/frontend`；旧 `backend/`/`frontend/` 不再生成。
- 旧应用不兼容（用户已确认硬切）；工作台不读取/迁移旧应用代码目录。
- 历史文档不重写；在新文档/STATUS 注明"历史记录中的 `frontend/` 为旧口径"。

### 14.3 opencode 版本

- 策略：一个工作台版本对应一个受支持 opencode 版本；不做多版本矩阵。
- 现状风险：kit 的插件 README 写 v2.2.6；当前环境为 2.2.5。C2 必须先做独立端口 spike：
  - 2.2.5 可加载 V2 hooks → 继续；
  - 不可加载 → 二选一：升级 opencode（推荐，符合一一对应）或能力降级为"仅 skills"（不推荐，护栏失效），并由用户决定。
- 能力包不写 semver 矩阵；只在 `docs/capabilities/eos-dev-kit/README.md` 标注实际验证版本。

### 14.4 Spring Boot 迁移（未来）

- 新增 `templates/bases/spring-boot-app`（`runtime: spring-boot-3`），替换 `eos-app` 作为默认基座；
- 能力声明 `requires.runtime`；EOS 专属能力（afcenter/data-access/pm-page-dev）迁移或重写为 Spring Boot 版本；
- 通用能力（development-efficiency、app-validation、skill-maintenance、护栏）可直接复用；
- 迁移只换基座包 + 能力 runtime 标记，不改工作台机制。

---

## 15. 改造清单（文件级）

### 15.1 后端（工作台）

| 文件/模块 | 改动 |
| --- | --- |
| 新增 `backend/src/capabilities/{paths,manifest,registry,install,sync,routes}.ts` | 包模型、注册表、校验、安装、同步、API |
| `backend/src/apps/scaffold.ts` | 基座替换、`code/` 布局、配置 schema、占位符/密钥、AGENTS 组合、opencode.json 合并、能力安装 |
| `backend/src/apps/scaffold.test.ts` | 大量 fixture 路径改 `code/`；新增 clean base 断言 |
| `backend/src/apps/routes.ts`/`payload.ts` | 创建入参 `base/capabilities/config`；payload 返回选择；校验 |
| `backend/src/templates/distribution.ts` | 期望 skill/command 含能力；受管 manifest 清理；团队 skill 与 kit 权威说明 |
| `backend/src/chat/service.ts` | prompt：`code/frontend`、能力目录、基座 framing |
| `backend/src/dev/digest.ts` | 代码目录、能力摘要 |
| `backend/src/dev/ui-check.ts` | 能力/平台约束列（C4） |
| `backend/src/dev/service.ts` | 提示文案路径 |
| `backend/src/design/system-file.ts` | 注释/文案路径 |
| `backend/src/index.ts` | **不改**工作台 UI 的 `../../frontend/dist`；仅必要时加能力文档静态托管 |
| `backend/src/dev/fidelity.test.ts`、`timeline.test.ts` | fixture 路径改 `code/` |
| `templates/agent/skills/adw-frontend-implementation/scripts/lib/fidelity-core.cjs` | **约 16 处** `frontend/` → `code/frontend/`；新增能力检查 |
| `templates/agent/skills/adw-frontend-implementation/SKILL.md`、`check-fidelity.mjs` | 路径/检查数更新 |
| `templates/agent/skills/adw-api-design/scripts/lib/api-design-core.cjs` | 路径文案（1 处） |
| `templates/agent/commands/{preview-app,check-consistency}.md` | 路径更新 |
| `backend/scripts/workspace-smoke.ts` | 校验 `code/backend/pom.xml`、`code/frontend/...`；能力资产 |
| `backend/scripts/verify-agent-assets.ts` + `smoke:assets` | 期望 skills/commands/plugins 动态化 |
| 新增/更新 e2e | `e2e:capabilities`（stub）；p2/p3/p7-3b/p7-7c/p9/p10/p7-6a/ui*-shots 的路径 fixture |

> 注意：`backend/src/index.ts` 的 `path.resolve(__dirname, '../../frontend/dist')` 是**工作台 UI**，不是应用工作区，禁止替换。

### 15.2 前端（工作台 UI）

| 文件 | 改动 |
| --- | --- |
| `frontend/src/workbench/NewAppDialog.vue` | 基座/能力选择 + schema 配置表单（C3） |
| `frontend/src/workbench/api.ts` | `AppInfo.base/capabilities`、创建入参 |
| `frontend/src/workbench/AppShell.vue` / `HomeShell.vue` | 能力/基座摘要（C3） |
| 新增 `frontend/src/workbench/CapabilityCenter.vue`（C3） | 能力中心 |
| 文案 | `projects/<app>/` 说明改为 `code/` |

### 15.3 模板

| 路径 | 动作 |
| --- | --- |
| 新增 `templates/bases/eos-app/**` | 清理后的 EOS 基座（§8） |
| 新增 `templates/capabilities/eos-dev-kit/**` | 能力包（§9） |
| `templates/eos-app/**`、`templates/afc-remote/**` | C2 完成后删除 |
| `templates/agent/**` | 方法 skill/命令路径改 `code/`；不并入 kit |
| `templates/design-system/**`、`templates/workshop/**` | 不改 |
| `templates/agent/skills/afcenter-page-generation` | 保留（PageTemplates 资产源） |

### 15.4 文档

- `AGENTS.md`/`README.md`：C1/C2 落地后更新（目录、能力、基座、opencode 版本）；
- `docs/STATUS.md`：每批实施结果；
- `docs/ops/switch-to-agent-first.md`：目录/基座/能力与 opencode 版本；
- `docs/report/**`：后续统一更新（本轮不动）；
- 历史 `docs/plans/**`：不重写，仅新增本稿与后续记录。

---

## 16. 分批实施

| 期 | 范围 | 出口 / 测试 |
| --- | --- | --- |
| **C0**（本文） | 设计稿 | 只写文档 |
| **C1a 目录切换** | 生成应用改 `code/backend|code/frontend`；scaffold/prompt/digest/fidelity/smoke/e2e fixture/文档路径全量更新；**不接能力** | 新建应用目录正确；`npm test` 前后端、`typecheck`、`check:vue`、`build`、`smoke:workspace`、`e2e:p2/p3/p7-3b/p7-7c/p9/p10/p7-6a` 按实跑通过 |
| **C1b 能力钩子** | capability/base manifest + 注册表 + 校验 CLI + 安装/同步/清理 + `docs/capabilities.json` + `app_settings` 镜像 + prompt 目录 + AGENTS 组合；注册表为空 | 单测：schema/路径安全/幂等/清理/未知 section warning/降级；新建空能力应用正常；回归 p2/p4 |
| **C2 接入基座与 kit** | 清理 EOS 基座 + `eos-dev-kit` 能力包 + 安装（skills/plugins/scripts/docs/tests/e2e）+ opencode.json 合并 + 插件 spike（2.2.5/2.2.6）+ smoke | 单测 + 独立端口 spike；新建应用资产齐全；`e2e:capabilities`（stub）；p7-7c/p7-3b/p7-6a 回归 |
| **C3 UI** | 新建应用 schema 表单 + 能力中心 + 应用能力增删 + 外壳展示 | e2e：创建/配置/装配/增删/删除保护/兼容过滤；无整页溢出 |
| **C4 质量与测评** | fidelity 新检查、ui-check 能力列、`tools/agent-eval`（skill-test 归位）、token 实测 | 全量回归；真实模型测评需用户单独授权，不进默认测试 |
| **C5 Spring Boot 基座** | 你们产物就绪后新增 `spring-boot-app`，能力 runtime 重映射 | scaffold + 全量回归 |
| **C6 MCP（未来）** | `provides.mcp` + opencode.json 合并 + 凭据/健康/降级 | 独立端口 spike + stub e2e |

原则：每批只派**唯一**实施会话；每批完成后更新 STATUS/交接记录；不沿用旧断言数，按实跑记录。

---

## 17. 风险与未决

| # | 风险/未决 | 建议 |
| --- | --- | --- |
| 1 | **opencode 2.2.5 vs kit 2.2.6**：插件 V2 hooks 可能不可用 | C2 先 spike；不可用则升级 opencode（推荐）或降级为仅 skills（需用户确认） |
| 2 | **PageTemplates/GlobalPreference**：kit 前端没有，工作台契约依赖 | 按 §8.2 合并进基座（推荐）；否则 fidelity/prompt 需大幅放宽 |
| 3 | **skill 重叠**：`afcenter-page-generation`/`pm-components-usage` vs `eos-*` | 初期 kit 为权威 + AGENTS 写明；归并另开一批 |
| 4 | **目录迁移爆炸半径**：prompt/skill/fidelity/e2e/smoke/docs 约 60+ 处 | C1a 单批处理；先 grep 清单再改；e2e fixture 同步 |
| 5 | **基座残留敏感值**：sys-key/内网 IP/`sourcesyskey`、`e2e/.auth`、artifacts | C2 清理 + 静态测试（32 hex/`192.168.`/`.auth`） |
| 6 | **权限底线冲突**：kit 的 `code/frontend/opencode.json` 过于宽松 | 不随基座分发；工作台合并时设底线 |
| 7 | **token 成本**：`context` hook 每请求注入 P0 | C4 实测；P0 保持短小；必要时调 policy |
| 8 | **双权威**：AGENTS 与 `skill-priority.json` 重复 P0 | 以 `skill-priority.json` 为唯一权威；AGENTS 只给入口 |
| 9 | **能力版本冻结**：内容变化无升级提示 | 只做 hash 同步；后续再设计版本化 |
| 10 | **`PageRender.vue` 的 `ide/pageViewer` 地雷** | 保留但不默认暴露；README 标注；不引用即不编译 |
| 11 | **package-lock 内网 registry** | 模板保留锁文件（内部可用）；README 说明，不强行替换 |

---

## 18. 验收标准

1. 新建应用目录为 `code/backend` + `code/frontend`，应用根不再出现 `backend/`/`frontend/`。
2. 基座模板**无业务样例**、无真实 sys-key/IP/密码；配置文件仅占位符与安全默认值。
3. `docs/capabilities.json` 记录 base/capability；`app_settings` 有镜像；`docs/capabilities/index.md` 可读。
4. `.opencode` 内方法 skill + 6 个 `eos-*` skill + 插件/配置/脚本/文档/测试齐全；`_manifest.json` 自洽；`expectedAssetIds` 可校验。
5. AGENTS 受管区块存在且用户区块不被覆盖；`opencode.json` 权限底线保留。
6. 新建应用 UI 可选基座/能力并按 schema 填配置；secret 不回显、不入 DB。
7. 需求/设计/开发 prompt 均能看到能力目录；开发 digest 指向 `code/`。
8. fidelity 新增检查只报告；契约页/设计模板/开发链路不回归。
9. 单测/e2e/smoke/build/typecheck/check:vue 按实跑通过；未启停真实 3300/4771、未调真实模型（除非授权）。
10. 工作台自身 `frontend/`（UI）不受影响。

---

## 19. 仍建议确认的 3 点

1. **PageTemplates/GlobalPreference 合并**：同意按 §8.2 合并进新基座（推荐），还是接受去掉这两块并相应放宽设计与 fidelity？
2. **opencode 当前版本**：C2 若 2.2.5 不支持插件 hooks，是否同意升级到受支持版本（符合"一个工作台版本 ↔ 一个 opencode 版本"）？
3. **skill 归并时机**：C2 先"kit 权威 + 团队 skill 保留"，归并另开一批（推荐），还是 C2 直接归并（范围更大）？
