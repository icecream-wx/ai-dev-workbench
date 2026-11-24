---
description: 运行设计一致性静态检查（应用级 14 项，只报告不阻断）并解读结果
---

# 检查设计一致性

- 范围：整个应用（`$ARGUMENTS` 可忽略；D1 为应用级扫描）。
- 运行：

```bash
node .opencode/skills/adw-frontend-implementation/scripts/check-fidelity.mjs --app .
```

- 需要机器可读 JSON 时加 `--json`；工作台开发视图的「检查一致性」按钮调用同一套规则。
- 检查项（14 项）：
  - `design-system`：`docs/design/design-system.json`（pack/应用类型/风格/页面库/样式）；
  - `page-contract`：`docs/design/pages.json` 页面是否含 `recipe` 与 `blueprint`/`catalogRef`，契约页是否有 `contracts/<page>.json`；
  - `blueprint-files`：蓝图/契约文件是否存在；
  - `implementation`：视图/路由启发式匹配；
  - `page-templates` / `pm-components` / `form-dialog` / `auto-height` / `global-preference` / `style-imports`；
  - `template-contract`：契约页与模板契约是否一致；
  - `ui-check`：`docs/design/ui-check.md` 是否生成/填写；
  - `prototypes`：`docs/design/prototypes/_manifest.json` 的 designHash 是否过期；
  - `api-design`：`docs/design/api-design.md` 是否存在、必需章节/索引详情/引用/覆盖矩阵（14 项）。
- 输出按 `pass/warn/fail + evidence` 解读：fail 先修；warn 说明是真实缺口还是启发式无法判断。
- 只报告、不阻断、不改代码；退出码默认 0（`--strict` 才在 fail 时非 0）。
