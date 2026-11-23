---
description: 运行设计一致性静态检查（脚本/API 同规则），汇总通过/警告/失败并给修复建议
---

请对当前应用做一次**设计一致性静态检查**，只报告、不阻断、不自动改代码。

- 范围：$ARGUMENTS（为空表示全部设计模块；也可给单个 `MOD-xxx`）
- 运行（在应用工作区根目录）：

```bash
node .opencode/skills/adw-frontend-implementation/scripts/check-fidelity.mjs --app . --module <MOD-xxx>
```

  不确定模块时去掉 `--module`；需要机器 JSON 时加 `--json`。工作台开发视图的「检查一致性」按钮调用同一套规则
  （`POST /api/apps/:id/design-fidelity`），两边结果应一致。

- 检查项（均来自静态文件，不做截图像素比对）：
  - `design-system`：`docs/design/design-system.json` 是否存在/合法（pack/应用类型/风格/页面库）；
  - `page-contract`：`docs/design/<MOD>/design.json` 的页面是否含 `recipe` 与 `blueprint`/`catalogRef`（契约页用 `contracts/<page>.json`）；
  - `blueprint-files`：`docs/design/template/` 下蓝图文件是否存在；**契约页跳过蓝图、校验契约文件**（缺失 warn，不 fail）；
  - `implementation`：按蓝图文件名/页面 id/名称启发式匹配 `frontend/src/views/`，并看路由是否注册；
  - `page-templates`：`BusinessListPage/TreeListPage/StandardFormPage/FormSection/QueryPanel/RowActions/ThreePartPagination` 是否导入/使用；
  - `pm-components`：是否使用宿主 `pm-*` 组件（不要自造/重复打包）；
  - `form-dialog`：表单页是否使用 `pm-form-dialog` / `FormSection` / `StandardFormPage`；
  - `auto-height`：列表是否使用 `v-auto-height`（不要固定 height）；
  - `global-preference`：是否统一引用 `src/preferences/GlobalPreference.js`；
  - `style-imports`：是否接入 `structure.css` / `styles/shared.css` / `styles/<styleId>/style.css` / `visual-style-*`；
  - `template-contract`：设计页 `catalogRef` 解析到应用设计模板的契约页时，`contracts/<page>.json` 是否存在、recipe 是否一致（只报告）；
  - `ui-check`：`docs/design/<MOD>/ui-check.md` 是否已生成/已填；
  - `prototypes`：`prototypes/_manifest.json` 是否缺失、过期（designHash 不一致）或为空。
- 输出：
  1. 总体状态（通过 / 有警告 / 有失败）与通过/警告/失败计数；
  2. 逐项列出 `检查项 → 状态 → 证据`；
  3. 对 fail/warn 给出**具体修复建议**：补哪个文件/页面/组件/导入/ui-check 行/PNG 导出；
  4. 明确区分“真实缺口”和“启发式无法判断”（例如页面文件名与 id 不一致、宿主提供样式）。
- 约束：
  - 只读检查，不修改任何文件；用户明确要求修复时再按建议改，并说明改了哪里；
  - 不改 `docs/design/design-system.json`、`docs/design/template/**`、`tokens.json`、`prototypes/**`
    （受管/工作台生成）；PNG 是模板风格截图（无显式契约的旧设计为线框），过期先说明；
  - 缺少 `frontend/`、蓝图或设计时先报告缺什么，不要凭感觉造页面；
  - 不执行任何 git 操作。
- 所有面向用户的文字——回复、思考/进度说明、工具说明、汇报——一律使用中文；代码、命令、标识符、文件路径除外。
