# EOS 应用模板（来自 eos-demo）

本目录来自用户提供的 `eos-demo.zip`，用于新工作台创建应用时生成 `backend/` 的起步结构。保留示例的目录形态、`pom.xml` 最小依赖和 EOS 配置骨架；不直接带入示例环境的真实凭据。

## 模板占位符

应用创建时由工作台做确定性渲染，至少替换：

| 占位符 | 含义 | 示例 |
| --- | --- | --- |
| `{{APP_ID}}` | 应用标识（同时用于 artifactId / sys-code / manifest） | `leave-demo` |
| `{{APP_NAME}}` | 应用显示名 | `请假管理` |
| `{{PORT}}` | 后端端口 | `8081` |
| `{{EOS_SYS_KEY}}` | EOS 应用 sys-key | 由环境提供，禁止提交真实值 |
| `{{DB_HOST}}` / `{{DB_PORT}}` / `{{DB_NAME}}` / `{{DB_USER}}` / `{{DB_PASSWORD}}` | 数据库连接 | 由环境提供 |
| `{{MAIL_HOST}}` / `{{MAIL_USERNAME}}` / `{{MAIL_PASSWORD}}` | 邮件（可选） | 由环境提供 |

`application.properties`、`bootstrap.properties`、`application-nacos.properties`、`application-job.properties` 中的 Nacos/Redis/邮件配置已改为环境变量占位（`${NACOS_ADDR:...}` 等）。`src/META-INF/_srv/config/user-config.xml` 使用 `{{...}}` 占位，需在创建应用时渲染。

## 结构

- `pom.xml`：parent `com.primeton.eos:eos-pom:9.0.0`；最小依赖为 Nacos Discovery、EOS DAP SDK Starter、EOS Server Starter、EOS Foundation、AFC SDK、BFP Framework Starter、Message SDK、MySQL Connector。
- `src/`：EOS 的源码根（不是 `src/main/java`）。
- `src/META-INF/_srv/`：EOS 运行配置、handler、license。
- `src/application*.properties`、`src/bootstrap.properties`：Spring/EOS 配置。
- `.project`、`.classpath`、`.settings`、`.library`：Primeton Studio / Eclipse 元数据，可按团队习惯保留或删除。

## 安全与限制

- 示例原文件中的真实 DB 密码、Nacos 密码、Redis 地址、`eos.application.sys-key` 已替换为占位符；**不要把任何真实凭据提交到仓库**。
- `src/META-INF/_srv/primetonlicense.xml` 是示例 license，可能绑定团队/环境；正式使用前替换为团队自己的 license。
- 示例原 DB 为 MySQL 5.7 且使用旧驱动类；模板已改为 `com.mysql.cj.jdbc.Driver`，目标环境按 MySQL 8.x 验证。
- 模板只保证“结构和最小依赖参考”；是否能离线构建取决于内部 Maven 仓库、EOS 制品、license、Nacos/MySQL/Redis 环境，需在真实环境验证。
- 开发 Agent 可以按任务调整业务代码与配置，但默认应保持该结构和 pom 的最小依赖基线。
