# P7-4a 实施单：design.json 页面契约（schema/adapter/skill）（2026-11-19）

> 上游：P7-1 pack/API、P7-3b 模板中心、`2026-11-19-design-template-and-dev-linkage-p7-design.md` 第 6 节。
> 本轮只做 **P7-4a**：design.json 页面契约字段、adapter 映射、design skill/command、验证与测试。
> **不做**：线框渲染器的树/弹窗视觉增强（P7-4b）、开发 prompt/MF remote（P7-5）、一致性验收（P7-6）。
> 需求模板中心、旧 design.json 兼容、现有 prototype 渲染不得破坏。

---

## 0. 出口标准

1. `design.schema.json` 新增可选字段（向后兼容）：
   - 顶层 `designSystem`：`{pack, applicationType, style}`（可选）；
   - 页面：`recipe/catalogRef/blueprint/filters/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components`；
   - 表单：`form.presentation: dialog|page`、`columns: 1|2`、`width`、`fields`、`groups`；
   - 分页：`pagination.layout: bar|split|three-part`、`pageSize`；
   - 树：`tree.titleField/parentField/actionStyle/selectionStyle`；
   - 子表：`subTables[] {entity,title,columns,mode}`。
2. `validate.mjs` 接受新字段；缺失/类型错误只出 warning（不阻断）；旧 design.json 继续通过。
3. `design-adapter.js`：
   - 保留 `designSystem`；
   - 映射 filters→layout.table.searchFields；columns→table.columns；pagination.pageSize→table.pageSize；
   - 映射 form/tree/subTables/components/selection/rowActions/toolbarActions 到 `PageLayout`/页面 spec；
   - 旧页面无新字段行为不变。
4. `PageLayout` 类型增加可选字段（form/tree/selection/rowActions/pagination/components），渲染器可暂不消费。
5. `adw-design-artifacts` skill / `generate-design` / `check-consistency` 更新：页面契约、blueprint/catalogRef、brief 页面表与冲突决策、validate 自查。
6. 新增/更新测试；现有 100/76 全绿；e2e p3/p4 prompt/skill 断言不回归（如涉及）。

---

## 1. Schema

文件：`templates/agent/skills/adw-design-artifacts/references/design.schema.json`

- 顶层增加 `designSystem`（object，可选）：
  - `pack`、`applicationType`、`style` 字符串；
- `pages.items.properties` 增加：
  - `recipe`：string enum（list/tree-list/dialog-form/page-form/main-sub/detail/dashboard/wizard）；
  - `catalogRef`：string；
  - `blueprint`：string；
  - `filters`：string[]；
  - `rowActions`：string[]；
  - `toolbarActions`：string[]；
  - `selection`：boolean；
  - `pagination`：object（layout enum、pageSize integer）；
  - `form`：object（presentation enum、columns enum 1/2、width integer、fields string[]、groups array）；
  - `tree`：object（titleField/parentField/actionStyle/selectionStyle）；
  - `subTables`：array（entity/title/columns/mode）；
  - `components`：object（additionalProperties string）。
- 所有新字段可选；不改变 required。
- `design-example.json` 增加一页 tree-list + 一页 dialog-form 示例（可选字段）。
- `scripts/validate.mjs`：若现有脚本只校验 required/类型，补充新字段的轻量校验（类型/枚举），错误输出 warning；不要引入外部依赖。

## 2. Adapter

文件：`frontend/src/design/design-adapter.js`、`frontend/src/design/prototype/spec-types.ts`、`frontend/src/design/types.ts`（如需要）

- `adaptDesign` 输出增加 `designSystem`（原样保留/规范化）。
- 页面：
  - 读取 `filters/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components/recipe/catalogRef/blueprint`；
  - `layout.table.searchFields = filters`；
  - `layout.table.pageSize = pagination.pageSize`；
  - `layout.pagination = { layout, pageSize }`（新类型字段）；
  - `layout.selection = selection`（新类型字段）；
  - `layout.rowActions = rowActions`（新类型字段）；
  - `layout.form = form`（新类型字段）；
  - `layout.tree = tree`（新类型字段）；
  - `layout.subTables = subTables.map(...)`（沿用现有 target/title/columns/hidden；mode 可放入扩展字段）；
  - `layout.components = components`（新类型字段）或页面 spec.components；
  - 兼容：没有新字段时，保持现有 columns/actions 行为。
- `SpecPage`/`PageLayout` 增加可选字段类型；渲染器暂不消费不报错。
- 页面 `actions`：如未提供 actions 但有 rowActions/toolbarActions，合并供现有渲染器使用；不改变旧页面。

## 3. Design skill / command

文件：
- `templates/agent/skills/adw-design-artifacts/SKILL.md`
- `templates/agent/commands/generate-design.md`
- `templates/agent/commands/check-consistency.md`
- 如需要，`templates/agent/skills/adw-design-artifacts/references/design-example.json`

要求：
- 写完/改完 design.json 必须：
  - 顶层写 `designSystem`（从应用设计系统读取；老应用可省略）；
  - 页面写 `recipe/catalogRef/blueprint`（能对应模板页面库时）；写 filters/columns/rowActions/toolbarActions/selection/pagination/form/tree/subTables/components；
  - 写/更新 `design-brief.md` 的“页面契约”表与“冲突与决策”；
  - 运行 `scripts/validate.mjs` 自查；
  - 说明设计模板/风格/蓝图来源。
- `generate-design.md` 同步上述要求。
- `check-consistency.md`：
  - 对照需求 / design.json / design-system / brief / 原型 / 蓝图；
  - 只报告差异，不做门禁；
  - 输出“缺失页面/字段/操作/表单形态/蓝图缺失/冲突未记录”清单。

## 4. 测试

- 后端：`design/reference.test.ts` 或新测试：
  - 含新字段的 design.json 通过；
  - 非法枚举/类型 → warning/不阻断（按现有 schema 校验行为）；
  - 旧 design.json 不变。
- 前端：`design-adapter.test.mjs` 增加：
  - filters/columns/pagination/selection/rowActions/toolbarActions/form/tree/subTables/components 映射；
  - 无新字段时旧行为；
  - designSystem 保留。
- `validate.mjs` 可用临时 fixture 直接跑（node）。
- e2e：如 `e2e:p3` 涉及设计 skill/prompt 文本，更新断言；p2/p4 保持。
- 回归：backend 100+、frontend 76+、build/typecheck/check:vue、e2e:preview 77、e2e:p7-3b 45（如时间允许）。

## 5. 边界

- 不改需求模板中心/需求 skill/DB/表；不改 P7-3a 预览页；不做渲染器视觉增强；不做 MF/dev prompt；不启停真实 3300；不读写真实 data/projects/.env；不 git；不调模型。

## 6. 收尾

- 更新 P7 设计稿 P7-4a 实施记录与 docs/STATUS.md。
- 回报：schema/adapter 字段清单、skill/command 变更、测试结果、偏差、未验证项、环境确认。

---

## 7. 实施结果（2026-11-19）

- 结果：schema（designSystem + 11 个页面契约字段）、validate.mjs（新字段 warning 不阻断；旧字段 errors）、design-example（tree-list + dialog-form）、adapter（designSystem 保留 + filters/columns/pagination/selection/row/toolbar actions/form/tree/subTables/components 映射；旧页面不变）、类型（PageLayout/SpecPage 可选字段）、设计 skill/generate-design/check-consistency 均已更新。
- 验证：后端 **105/105**（新增 contract 5）、前端 **79/79**（新增 adapter 3）、`build`/`typecheck`/`check:vue` 通过、`smoke:workspace` 通过、`e2e:preview/p7-3b/p2/p3/p4` = **77/45/116/126/97** 保持。
- 偏差：validate.mjs 新字段问题是 warnings，后端 artifacts 仍是 errors（HTTP 200、不阻断）；渲染器未接线新 layout 字段（P7-4b）；页面 type 不扩模板类型，配方用 recipe。
- 未验证：真实模型写页面契约/brief 冲突、设计视图展示契约/蓝图、蓝图/catalogRef 自动校验、真实 AFCenter/EOS/3300。
- 详细记录见 `2026-11-19-design-template-and-dev-linkage-p7-design.md` 第 18 节。
